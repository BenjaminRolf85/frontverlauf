"""
Heere aus Filmfiguren (Anime-Schnitt): Reiter auf Pferden, Marschkolonnen, Banner. Eine bewegliche Figur je Bild zu
verformen kostet wenig, hundert davon viel; deshalb werden die Phasen einer Gangart einmal gebacken (Daumenkino) und
alle Reiter eines Typs teilen sich die Netze. Abwechslung: Typ (Reiter, Lanzenreiter, Offizier, Bannertraeger),
Fellfarbe, Phasenversatz, Ort und Richtung.
Armies of film figures (anime cut): riders on horses, marching columns, banners. Deforming one movable figure per frame
is cheap, a hundred of them is not; so the phases of a gait are baked once (flip book) and all riders of a type share
the meshes. Variation: type (rider, lancer, officer, standard bearer), coat colour, phase offset, place and heading.
"""
import math

import numpy as np
from mathutils import Vector

from . import anime as A
from . import figure as F
from . import lib as L
from . import poses as P

HORSE = 'fig_korvat_horse'
# Widerristhoehe in Metern; der Reiter teilt den Massstab des Pferds (Soldat 1,80 m) / withers height in metres; the rider shares the horse's scale (soldier 1.80 m)
WITHERS = 1.55
RIDER_POSES = {'fig_korvat_rider': P.RIDE, 'fig_korvat_lancer': P.RIDE_LANCE, 'fig_korvat_officer': P.RIDE_SABRE}


class Mounted:
    """Ein Reiter auf seinem Pferd als bewegliche Figuren (zum Backen oder fuer Nahaufnahmen) / one rider on his horse as movable figures (for baking or close shots)"""

    def __init__(self, shot, kit='fig_korvat_rider', loc=(0, 0, 0), rot=0.0, wind=None, crease_k=1.2):
        self.horse = F.Figure(shot, [HORSE], loc=loc, rot=rot, height=WITHERS, wind=wind, crease_k=crease_k, ground=P.HOOVES, name='horse')
        self.rider = F.Figure(shot, [kit], wind=wind, crease_k=crease_k, ground=(), name='rider', parent=self.horse)
        self.kit = kit
        self.seat = np.array(self.rider.rig.offset[0])

    def pose(self, kind='stand', phase=0.0, rider=None, t=0.0):
        base = rider or RIDER_POSES.get(self.kit, P.RIDE)
        if kind == 'stand':
            hp, down = dict(P.HORSE_STAND), list(P.HOOVES)
            rp = dict(base)
        else:
            hp, down = P.horse_gait(phase, kind)
            rp = P.rider_on(hp, base, kind, phase)
        h = self.horse
        h.ground = down
        h.set_pose(hp)
        h.update(t)
        # Sitz: Huefte des Reiters ueber dem Sattel, mit der Neigung des Pferderueckens / seat: the rider's hips above the saddle, with the tilt of the horse's back
        saddle = h.rig.mark('saddle', h.R, h.p)
        body = h.R[h.rig.index['body']]
        pitch = math.degrees(math.atan2(body[1, 2], body[1, 1]))
        rp['pos'] = tuple(saddle + body @ np.array([0.0, 0.115, 0.02]) - self.seat)
        r = list(rp.get('root', [0, 0, 0]))
        rp['root'] = [r[0] - pitch * 0.7, r[1], r[2]]
        self.rider.set_pose(rp)
        self.rider.update(t)
        return self

    def bake(self, ink_px=None, lod=None):
        return self.horse.bake(ink_px=ink_px, lod=lod) + self.rider.bake(ink_px=ink_px, lod=lod)

    def hide(self, hidden=True):
        self.horse.hide(hidden)
        self.rider.hide(hidden)


def far_frames(frames, ratio=0.3):
    """Phasen fuer ferne Kopien: vereinfachte Flaeche, keine Tusche / phases for far copies: simplified fill, no ink"""
    return [[(F.decimate(f, ratio), None, d, 0.5) for f, _i, d, _w in fr] for fr in frames]


def ink_px(shot, dist):
    """Bildpunktgroessen in der Entfernung dist fuer gebackene Linien / pixel sizes at distance dist for baked lines"""
    return shot.px(dist), shot.px_out(dist)


def bake_cavalry(shot, kit='fig_korvat_rider', kind='gallop', phases=8, rider=None, wind=None, dist=None, lod=None):
    """
    Phasen einer Gangart backen: Liste von Netzsaetzen fuer figure.Baked. dist = Entfernung der Kopien von der Kamera
    (Meter): die Linienbreite wird dafuer ins Netz gebacken; ohne dist regelt sie lib.units_refresh je Kopie.
    Bake the phases of a gait: a list of mesh sets for figure.Baked. dist = distance of the copies from the camera
    (metres): the line width is baked into the mesh for it; without dist lib.units_refresh sets it per copy.
    """
    m = Mounted(shot, kit, wind=wind)
    frames = []
    n = 1 if kind == 'stand' else phases
    for i in range(n):
        m.pose(kind, i / n, rider, t=i / n * 0.6)
        frames.append(m.bake(ink_px(shot, dist) if dist else None, lod if dist else None))
    m.hide()
    _drop(shot, m.horse)
    _drop(shot, m.rider)
    return frames


def bake_infantry(shot, kit='fig_korvat_foot', phases=8, pose=None, dist=None, lod=None):
    """Marschschritt backen (oder eine stehende Pose) / bake the marching step (or one standing pose)"""
    f = F.Figure(shot, [kit], height=1.8, crease_k=1.2, name='soldier')
    frames = []
    for i in range(1 if pose else phases):
        f.set_pose(pose or P.march(i / phases))
        f.update(0.0)
        frames.append(f.bake(ink_px=ink_px(shot, dist) if dist else None, lod=lod if dist else None))
    f.hide()
    _drop(shot, f)
    return frames, f.scale


def _drop(shot, fig):
    """Die Vorlage aus der Linienpflege nehmen (sie ist versteckt) / take the template out of the line upkeep (it is hidden)"""
    obs = {fill for fill, _line in fig.obs.values()}
    shot.units[:] = [r for r in shot.units if r['parts'][0][0] not in obs]


def coat(shot, baked, colour, amount=0.6):
    """Fellfarbe eines gebackenen Pferds (das erste Teil ist das Pferd) / coat colour of a baked horse (the first piece is the horse)"""
    fill = baked.parts[0][0]
    fill.material_slots[0].link = 'OBJECT'
    fill.material_slots[0].material = L.inked_mat(shot, 'fig-korvat-army', (colour, amount))


COATS = (None, ('ink700', 0.55), ('paper300', 0.5), ('rust', 0.35), ('ink800', 0.7), ('sand300', 0.45))


class Banner:
    """Banner an einer Stange: bewegliches Tuch; mehrere Banner koennen ein Netz teilen (share) / banner on a pole: moving cloth; several banners can share a mesh"""

    def __init__(self, shot, loc=(0, 0, 0), rot=0.0, height=3.3, wind=None, share=None, parent=None):
        if share is None:
            self.fig = F.Figure(shot, ['fig_korvat_banner'], loc=loc, rot=rot, height=height, wind=wind or F.Wind((-1, 0, 0.15), 0.25, 0.14, speed=1.3), ground=(), crease_k=1.2, name='banner')
            self.root = self.fig.root
            self.frames = None
        else:
            self.fig = None
            b = F.Baked(shot, [share.fig.bake_shared()], loc=loc, rot=rot, scale=share.fig.scale, name='banner')
            self.root = b.root
        if parent is not None:
            self.root.parent = parent

    def update(self, t):
        if self.fig is not None:
            self.fig.update(t)


def shrink_atlas(atlas='fig-korvat-army', size=2048):
    """Atlas des Heers verkleinern (Figuren in mittlerer Entfernung): spart Bildspeicher / shrink the army's atlas (figures at mid distance): saves image memory"""
    for img in L.atlas_images(atlas):
        if img.size[0] > size:
            img.scale(size, size)
