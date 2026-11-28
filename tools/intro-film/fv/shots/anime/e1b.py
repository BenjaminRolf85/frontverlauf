"""
Anime-Schnitt E1b (4 s): Grossmarschall Brodnik auf der Felsnase am Rand des Hoehenruegens. Der linke Fuss steht auf
einem Block, der linke Arm hebt sich und zeigt zum Horizont, wo die Rauchfahne der Absturzstelle steht; die rechte
Faust in der Huefte, der Umhang weht. Unter ihm zieht das Heer nach rechts: Reiterbloecke im Galopp mit Lanzen und
Bannern, dahinter die Panzerkolonne auf der Staubstrasse und Infanterie. Halbtotale von unten, langsames Heranfahren.
Anime cut E1b (4 s): Grand Marshal Brodnik on the rock nose at the edge of the ridge. The left foot stands on a block,
the left arm rises and points to the horizon where the smoke plume of the crash site stands; the right fist on the
hip, the cape blowing. Below him the army moves right: blocks of riders at a gallop with lances and banners, behind
them the tank column on the dust road and infantry. Medium long shot from below, a slow push-in.

FV_E1B_PLAN=0: ohne Heer (schnelle Probe der Figur) / without the army (quick test of the figure).
"""
import math
import os

from mathutils import Vector

from ... import figure as F
from ... import korvat as K
from ... import lib as L
from ... import poses as P

DUR = 4.0
PIECES = ['fig_korvat_body', 'fig_korvat_head', 'fig_korvat_cape']
FACES = ['fig-korvat-head', 'fig-korvat-head-narrow', 'fig-korvat-head-blink']
# Blickrichtung der Figur (Azimut) / the figure's facing (azimuth)
FACING = 204.0
# Heer: am Standbild (2,6 s) steht eine Luecke hinter der Figur, die Bloecke liegen rechts von ihr und links hinter dem Fels
# army: at the still (2.6 s) there is a gap behind the figure, the blocks lie to her right and behind the rock on the left
PLAN = [
    ('cav', -32, 12, 5, 4), ('cav', 22, 8, 4, 5), ('cav', 48, 13, 5, 4), ('cav', 86, 8, 4, 5), ('cav', 136, 12, 4, 4), ('cav', 210, 9, 3, 5),
    ('tanks', 96, 0, 9, 17), ('inf', 86, -12, 7, 8), ('inf', 136, -12, 7, 8),
]
LENS = 62.0
# Kamera: Abstand zur Figur, Blickrichtung (Azimut), Hoehe ueber seiner Standflaeche / camera: distance to the figure, view azimuth, height above his standing surface
CAM = (9.3, 37.0, 0.62)


def marshal(shot, top, wind=None):
    """Brodnik auf der Felsplatte (Standhoehe top), dazu der Block unter dem linken Fuss / Brodnik on the slab (standing height top), plus the block under the left foot"""
    fig = F.Figure(shot, PIECES, loc=(K.M[0], K.M[1], top), rot=180.0 - FACING, wind=wind or F.Wind(direction=(-0.9, 0.0, -0.44), strength=0.85, wave=0.12, speed=1.15, lift=0.5))
    fig.no_rim('fig_korvat_cape')
    fig.set_pose(P.KORVAT_POINT)
    fig.update(0.0)
    p = fig.world('ballL')
    h = fig.world('heelL')
    c = (p + h) * 0.5
    sz = max(0.2, (c.z - top) / 0.78 + 0.12)
    K.facet_rock(shot, (c.x, c.y, c.z - 0.78 * sz), (0.62, 0.5, sz), K.A.lin(K.A.cmix('rock400', 'khaki500', 0.36)), seed=44, top=K.A.lin(K.A.cmix('rock400', 'sunDusk', 0.25)), px=2.0, rot=0.9)
    return fig


def build():
    s = L.Shot(DUR)
    sdir = K.lights(s)
    s.cam.data.lens = LENS
    s.cam.data.clip_end = 6000
    top = K.hz(*K.M) + 0.6
    a = math.radians(CAM[1])
    cam0 = Vector((K.M[0] - math.sin(a) * CAM[0] - 1.0, K.M[1] - math.cos(a) * CAM[0] + 0.9, top + CAM[2]))
    # Vordergrund: grasbewachsene Bodenwelle links unten vor der Kamera / foreground: a grassy hump at the lower left in front of the camera
    fwd = Vector((math.sin(a), math.cos(a), 0))
    left = Vector((-fwd.y, fwd.x, 0))
    hump = cam0 + fwd * 3.5 + left * 0.62
    K.BUMPS[:] = []
    K.BUMPS[:] = [(hump.x, hump.y, cam0.z - 0.52 - K.hz(hump.x, hump.y), 1.9)]
    K.sky(s, cam0)
    K.land(s, (-2.5, -2.5))
    K.outcrop(s, K.M, top)
    fig = marshal(s, top)
    fig.track([(0.0, P.KORVAT_READY), (0.35, P.KORVAT_READY), (1.25, P.KORVAT_POINT, L.ease_io), (DUR, P.KORVAT_POINT)])
    fig.layer(P.breathe(1.0, phase=0.2))
    fig.layer(P.sway(0.5))
    fig.face_setup('fig_korvat_head', FACES)
    fig.face([(0.0, FACES[2], 0.0), (2.55, FACES[2], 0.0), (2.6, FACES[2], 1.0), (2.7, FACES[2], 1.0), (2.76, FACES[2], 0.0)])
    army = K.Army(s, PLAN, cam0) if os.environ.get('FV_E1B_PLAN', '1') == '1' else None
    plumes = K.horizon(s)

    def keep(x, y):
        # nicht auf dem Fels, nicht vor der Linse / not on the rock, not in front of the lens
        return math.hypot(x - K.M[0], y - K.M[1]) > 1.9 and math.hypot(x - cam0.x, y - cam0.y) > 2.5
    grass = K.Grass(s, (hump.x, hump.y), 9.5, int(os.environ.get('FV_GRASS', '13000')), seed=3, keep=keep, dense=1.7, flowers=0.0, tall=0.0, size=0.8)
    K.finish_light(s, sdir)
    aim0 = Vector((K.M[0] + 1.3, K.M[1] + 1.0, top + 1.0))

    @s.on
    def update(t):
        fig.update(t)
        if army:
            army.update(t)
        for pl in plumes:
            pl.update(t + 20)
        grass.update(t)
        # langsames Heranfahren, leicht steigend / slow push-in, rising slightly
        p = L.ease_io(L.seg(t, 0, DUR))
        cam = cam0 + (aim0 - cam0).normalized() * (1.3 * p) + Vector((0, 0, 0.1 * p))
        s.look(cam, aim0 + Vector((0, 0, 0.06 * p)))

    update(0)
    return s
