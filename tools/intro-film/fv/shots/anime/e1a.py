"""
Anime-Schnitt E1a (3 s): die Kornsteppe der Korvat am Abend. Die Kamera steht am Rand der Reiterbahn im Stoppelfeld und
faehrt wie an einem Kran hoch: Reiter mit Lanzen und Bannern galoppieren an ihr vorbei nach rechts in die Tiefe, links
dahinter rollt die Panzerkolonne auf der Staubstrasse, Infanterie marschiert; Kolchosfelder bis zu den Fabrikschloten
am Horizont, darueber die Rauchfahne der Absturzstelle.
Anime cut E1a (3 s): the Korvat grain steppe in the evening. The camera stands at the edge of the riders' lane in the
stubble field and rises as on a crane: riders with lances and banners gallop past it to the right into the depth, behind
them on the left the tank column rolls along the dust road, infantry marches; collective farm fields up to the factory
chimneys on the horizon, above them the smoke plume of the crash site.
"""
import math
import os

from mathutils import Vector

from ... import korvat as K
from ... import lib as L

DUR = 3.0
PLAN = [
    ('cav', -47, 14.5, 3, 4), ('cav', -17, 10, 4, 5), ('cav', 16, 13, 4, 4), ('cav', 44, 8, 5, 5), ('cav', 84, 12, 4, 5), ('cav', 128, 8, 4, 5), ('cav', 190, 12, 3, 5), ('cav', 270, 9, 3, 5),
    ('tanks', 96, 0, 11, 17), ('inf', 36, -11.5, 8, 8), ('inf', 86, -12, 8, 8), ('inf', 150, -12, 6, 8),
]
# Kamera: Ort an der Strasse (Weg s, Abstand d), Hoehe am Anfang und am Ende, Blickrichtung (Azimut)
# camera: place at the road (distance s, offset d), height at the start and the end, view azimuth
CAM = (-34.0, 21.5, 1.15, 5.6, 47.0)


def build():
    s = L.Shot(DUR)
    sdir = K.lights(s)
    s.cam.data.lens = 30
    s.cam.data.clip_end = 6000
    cx, cy = K.road_xy(CAM[0], CAM[1])
    g = K.hz(cx, cy)
    cam0 = Vector((cx, cy, g + CAM[2]))
    K.sky(s, cam0)
    K.land(s, (cx + 9, cy + 10))
    army = K.Army(s, PLAN, cam0, seed=11, near=17.0, far_from=70.0) if os.environ.get('FV_E1A_PLAN', '1') == '1' else None
    plumes = K.horizon(s)
    a = math.radians(CAM[4])
    fwd = Vector((math.sin(a), math.cos(a), 0))

    def keep(x, y):
        # nur diesseits der Reiterbahn / only on this side of the riders' lane
        return K.road_uv(x, y)[1] > 17.2 and math.hypot(x - cam0.x, y - cam0.y) > 1.3
    grass = K.Grass(s, (cam0.x + fwd.x * 4, cam0.y + fwd.y * 4), 13.0, int(os.environ.get('FV_GRASS', '9000')), seed=8, keep=keep, flowers=0.0, tall=0.0, size=0.8)
    # ein paar Feldsteine am Rain / a few field stones at the verge
    for i, (ds, dd, sz) in enumerate(((5.5, 20.5, 0.45), (9.0, 22.5, 0.3), (2.5, 19.0, 0.25))):
        x, y = K.road_xy(CAM[0] + ds, dd)
        K.facet_rock(s, (x, y, K.hz(x, y) + sz * 0.1), (sz, sz * 0.8, sz * 0.6), K.A.lin(K.A.cmix('rock400', 'khaki500', 0.35)), seed=60 + i, top=K.A.lin(K.A.cmix('rock400', 'sunDusk', 0.25)), px=1.8, rot=i)
    K.finish_light(s, sdir)

    @s.on
    def update(t):
        if army:
            army.update(t)
        for pl in plumes:
            pl.update(t + 20)
        grass.update(t)
        # Kranfahrt: steigt und neigt sich, zieht leicht mit / crane move: rises and tilts, tracks slightly
        p = L.ease_io(L.seg(t, -0.4, DUR + 0.5))
        cam = cam0 + Vector((0, 0, (CAM[3] - CAM[2]) * p)) + fwd * (2.2 * p)
        tgt = cam + fwd * 40 + Vector((0, 0, 3.0 - 9.5 * p))
        s.look(cam, tgt)

    update(0)
    return s
