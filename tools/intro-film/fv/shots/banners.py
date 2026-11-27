"""
15 Fuenf Banner (111-117 s): die fuenf Anfuehrer auf einem Huegel, neben jedem das Banner der Fraktion mit ihrem
Emblem. Appell in fuenf Nahaufnahmen (je knapp eine Sekunde, harter Schnitt wie Comicfelder, die Kamera rueckt dabei
leicht vor und zur Seite): jedes Gesicht fuellt einmal das Bild, das Banner steht lesbar dahinter. Zum Schluss alle
fuenf in einer Reihe, vor ihnen leuchtet die Kreidelinie der Front auf und wandert.
15 Five banners (111-117 s): the five leaders on a hill, beside each the faction's banner with its emblem. A roll
call in five close-ups (just under a second each, hard cuts like comic panels, the camera easing forward and sideways
a little): every face fills the frame once, the banner stands readable behind it. At the end all five in a row, in
front of them the chalk line of the front lights up and moves.
"""
import math

import bpy
from mathutils import Euler, Vector

from .. import lib as L

ORDER = ['korvat', 'alvenia', 'dravon', 'velkar', 'meridon']
# Abstand der Anfuehrer, Schnitte (in Bildern bei 12 je Sekunde), Hoehe der Gesichter ueber dem Sockel
# spacing of the leaders, cuts (in frames at 12 per second), height of the faces above the base
SPACING = 15.0
CUTS = (0, 11, 22, 33, 44, 55)
FACE_Z = 7.0


def banner(shot, f, loc, w=6.4, hgt=13.5):
    """
    Haengendes Banner mit Schwalbenschwanz: Tuch in der Fraktionsfarbe, Streifen in der Zweitfarbe, Emblem in der
    Schriftfarbe der Fraktion. Rueckgabe: der Drehpunkt an der Querstange (fuer das Schwingen).
    Hanging swallow-tailed banner: cloth in the faction colour, stripes in the secondary colour, emblem in the
    faction's ink colour. Returns the pivot at the crossbar (for the sway).
    """
    tok = L.tokens()['faction'][f]
    pole_m = L.toon(shot, 'ink700')
    L.prim(shot, 'cyl', pole_m, loc=(loc[0], loc[1] + 1.0, loc[2] + (hgt + 3.2) / 2), size=(0.36, 0.36, hgt + 3.2), segments=8, px=2.4)
    pivot = bpy.data.objects.new('banner_' + f, None)
    shot.sc.collection.objects.link(pivot)
    pivot.location = Vector((loc[0], loc[1], loc[2] + hgt + 2.4))
    bar = L.prim(shot, 'cyl', pole_m, loc=(0, 0, 0), size=(0.3, 0.3, w + 1.2), rot=(0, math.pi / 2, 0), segments=8, px=2.4)
    bar.parent = pivot
    verts = [(-w / 2, 0, 0), (w / 2, 0, 0), (w / 2, 0, -hgt), (0, 0, -hgt + 1.8), (-w / 2, 0, -hgt)]
    cloth = L.mesh_obj(shot, 'cloth_' + f, verts, [(0, 4, 3), (0, 3, 1), (1, 3, 2)], L.toon(shot, tok['primary']), loc=(0, 0, 0), ink=True, px=2.4)
    cloth.parent = pivot
    stripe = L.toon(shot, tok['secondary'])
    for z, t in ((-0.9, 1.0), (-hgt + 3.4, 0.5)):
        st = L.prim(shot, 'cube', stripe, loc=(0, -0.06, z), size=(w, 0.05, t), ink=False)
        st.parent = pivot
    em = L.model(shot, 'emblem_' + f, loc=(0, -0.12, -5.6), scale=2.3, px=1.0, parent=pivot)
    em.rotation_euler = Euler((0, 0, 0))
    return pivot


def build():
    s = L.Shot(L.shot_dur('banners'))
    s.toon.set_light((0.42, 0.36, 0.46, 1), (0.76, 0.68, 0.7, 1), (1.0, 0.94, 0.84, 1))
    s.sunlight(rot=(1.0, 0.1, -2.6))
    L.sky(s, [(-1, 'grass600'), (0.0, 'sunDawn'), (0.12, 'skyDawn'), (0.5, 'sky700'), (1, 'sky900')])

    def h(x, y):
        return 6 * math.exp(-(x * x + y * y) / 6000.0)
    L.ground(s, 'grass500', size=900, sub=60, height=h)
    spots = []
    tops = []
    banners = []
    for i, f in enumerate(ORDER):
        x = (i - 2) * SPACING
        z = h(x, 0) - 0.15
        # Anfuehrer blicken zur Kamera, die aeusseren leicht zur Mitte gedreht / leaders face the camera, the outer ones turned towards the centre a little
        L.model(s, 'leader_%s' % f, loc=(x, 0, z), rot=(i - 2) * 5, scale=1.0)
        banners.append(banner(s, f, (x + 6.2, 4.5, z - 0.4)))
        spots.append(Vector((x, 0, z)))
        # Oberkante der Bueste (Muetze, Helmkamm, Haar) fuer den Bildausschnitt; alte Buesten ohne Kopfdaten: 1 Feld
        # top of the bust (cap, crest, hair) for the framing; old busts without header data: 1 tile
        name = 'leader_%s' % f
        tops.append((L.unit_data(name)['bounds'][1][1] if L.is_unit(name) else 1.0) * L.TILE)
    from .chalk import chalk_line
    line = chalk_line(s, z=0.4, width=1.8, mat=L.toon(s, 'hazard', glow=0.6))
    base = [Vector(o.location) for o in line]

    @s.on
    def update(t):
        for k, b in enumerate(banners):
            b.rotation_euler = Euler((math.sin(t * 2.1 + k * 1.3) * 0.05, 0, math.sin(t * 1.4 + k) * 0.03))
        for o, b in zip(line, base):
            # die Grenze der Kreidekarte, quer vor die Reihe gelegt / the border of the chalk map, laid across in front of the row
            p = Vector((b.x * 1.25 + 3, b.y * 0.4 - 21 + 2.0 * math.sin(t * 0.8), 0))
            p.y += 2.2 * math.sin(b.x * 0.15 + t * 2)
            o.location = p
            o.location.z = h(p.x, p.y) + 0.4
        frame = int(round(t * L.FPS))
        k = max(i for i, c in enumerate(CUTS) if frame >= c)
        if k < len(ORDER):
            # Nahaufnahme: Gesicht links der Mitte, Banner rechts dahinter / close-up: face left of centre, banner behind on the right
            q = (frame - CUTS[k]) / (CUTS[k + 1] - CUTS[k])
            c = spots[k]
            s.cam.data.lens = 40
            # Abstand so, dass die Kopfbedeckung am Ende der Fahrt noch ganz im Bild ist, das Gesicht aber gross bleibt
            # distance such that the headgear is still fully in frame at the end of the move, while the face stays large
            half = math.atan(s.cam.data.sensor_width * 9 / 16 / 2 / s.cam.data.lens)
            near = min(max(14.6, (tops[k] + 0.35 - FACE_Z) / math.tan(half)), 17.0)
            s.look(c + Vector((-2.6 + 1.4 * q, -near - 1.0 + 1.0 * q, FACE_Z - 0.5)), c + Vector((2.0, 0, FACE_Z)))
        else:
            # alle fuenf, die Kamera rueckt vor / all five, the camera moves in
            q = L.ease_out(L.seg(t, CUTS[-1] / L.FPS, s.dur))
            s.cam.data.lens = 28
            z0 = h(0, 0)
            s.look(Vector((3, -70 + 8 * q, z0 + 8.5 - 1.0 * q)), Vector((3, 0, z0 + 7.2)))

    update(0)
    return s
