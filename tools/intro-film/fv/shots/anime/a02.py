"""
A02 (4-10 s): Meridons Hafenstadt in der goldenen Daemmerung, die Eroeffnungstotale des Films. Die Kuppel der Bank als
Mittelpunkt, Handelsschiffe, Kraene, glaenzendes Wasser. Kamera: Totale, Schwenk nach rechts mit leichter Zufahrt.
A02 (4-10 s): Meridon's harbour city at golden dusk, the establishing shot of the film. The bank's dome as the focal
point, trade ships, cranes, gleaming water. Camera: wide, pan right with a slight push.

FV_A02_CAM=high rendert dieselbe Szene von oben (Kontrolle des Ortes) / renders the same scene from above (checking the place).
"""
import math
import os

from mathutils import Vector

from ... import anime as A
from ... import atmo as AT
from ... import lib as L
from ... import meridon as M
from ... import scenery as S
from ... import world as W

DUR = 6.0
SUN = (-34.0, 5.5)      # gemalte Sonne im Himmel / painted sun in the sky
LIGHT = (-102.0, 10.0)  # Lichtrichtung der Baender: von links, damit die Fassaden Form bekommen / band light: from the left so the facades get form
CAM0, CAM1 = (-34.0, -338.0, 9.5), (-16.0, -306.0, 10.5)
AIM0, AIM1 = (-13.0, 4.4), (9.0, 5.2)   # Azimut, Neigung in Grad / azimuth, pitch in degrees
SKY_SCALE = float(os.environ.get('FV_SKY', '1.0'))


def dusk_sky(s, centre, name='sky_a02'):
    c = A.cmix
    w = int(5120 * SKY_SCALE)
    peach, mint = c('sunDusk', 'skyDusk', 0.5), c('skyDusk', 'teal500', 0.42)
    bands = [
        {'el': 14.0, 'az': (-70, 55), 'n': 13, 'len': (14, 40), 'thick': (0.7, 1.8), 'jitter': 3.0, 'seed': 4,
         'cols': (c('skyMid', 'sunDusk', 0.42), c('sunDusk', 'red500', 0.14), c('yellow400', 'flash100', 0.5)), 'split': -0.15},
        {'el': 24.0, 'az': (-75, 60), 'n': 10, 'len': (22, 56), 'thick': (1.0, 2.6), 'jitter': 4.0, 'seed': 9,
         'cols': (c('sky700', 'teal500', 0.3), c('sunDusk', 'skyMid', 0.25), c('sunDusk', 'yellow400', 0.45)), 'split': 0.0},
        {'el': 6.0, 'az': (-75, 60), 'n': 12, 'len': (8, 24), 'thick': (0.3, 0.8), 'jitter': 1.6, 'seed': 13,
         'cols': (c('sunDusk', 'skyMid', 0.3), c('yellow400', 'flash100', 0.5), A.hexc('flash100')), 'split': -0.3},
    ]

    def ridge(az, prof):
        # ueber dem offenen Meer (links) kein Gebirge / no mountains over the open sea (left)
        import numpy as np
        return prof - 6.0 * np.clip((-40.0 - az) / 12.0, 0, 1)
    return AT.sky(s, name, centre, radius=6000.0, bands=bands, w=w, h=int(w * 0.4156), az=(-78.0, 62.0), el=(-8.0, 40.0), sun=SUN,
                  grad=[(-8, c('hazeDusk', 'sunDusk', 0.4)), (0, c('yellow400', 'paper50', 0.45)), (3.5, c('yellow400', 'sunDusk', 0.4)), (7, c('sunDusk', 'orange500', 0.10)),
                        (11.5, peach), (16.5, mint), (24, c('teal500', 'sky700', 0.45)), (40, c('sky700', 'water700', 0.25))],
                  glow=(c('yellow400', 'sunDusk', 0.3), A.hexc('flash100')), rays=0.5, seed=11,
                  clouds=[{'at': (-20, 2.2), 'w': 46, 'h': 3.4, 'size': 1.5, 'tone': -0.55}, {'at': (34, 2.6), 'w': 40, 'h': 4.4, 'size': 1.8, 'tone': -0.4},
                          {'at': (-62, 2.0), 'w': 30, 'h': 3.0, 'size': 1.4, 'tone': -0.5}],
                  cloud_cols=(c('skyMid', 'sunDusk', 0.5), c('sunDusk', 'orange500', 0.15), c('yellow400', 'flash100', 0.4), A.hexc('flash100')),
                  land=[{'el': 0.6, 'amp': 2.6, 'waves': 4, 'seed': 5, 'col': c('hazeDusk', 'skyMid', 0.25), 'rim': c('sunDusk', 'yellow400', 0.5), 'shape': ridge},
                        {'el': 0.2, 'amp': 1.5, 'waves': 7, 'seed': 8, 'col': c('hazeDusk', 'skyMid', 0.40), 'rim': c('sunDusk', 'yellow400', 0.3), 'shape': ridge}])


def dusk_light(s):
    c = A.cmix
    rot, d = A.sun_rot(*LIGHT)
    s.sunlight(rot=tuple(rot))
    s.toon.set_light(A.lin(c(c('sky700', 'skyMid', 0.4), 'sunDusk', 0.26)), A.lin(c('sunDusk', 'paper50', 0.3) * 0.9), tuple(x * 1.15 for x in A.lin(c('paper50', 'yellow400', 0.3))[:3]) + (1,))
    return d


def aim(pos, az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector(pos) + Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e))) * 100.0


def foreground(s, city):
    """
    Vordergrund der Schlusskomposition: ein Holzsteg vom Suedufer ins Becken mit Laternen, Kisten und Hafenarbeitern
    als Silhouetten (Arbeit unten, Reichtum gegenueber). / foreground of the end composition: a wooden jetty from the
    south shore into the basin with lamps, crates and dock workers as silhouettes (labour below, wealth opposite).
    """
    import numpy as np
    from ... import arch as AR
    R = np.random.default_rng(21)
    a, b = Vector((118.0, -318.0)), Vector((2.0, -226.0))
    rot = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
    ln = (b - a).length
    mb, lights = W.MeshB(), W.MeshB()
    mb.push(a.x, a.y, 0.0, rot=rot)
    lights.push(a.x, a.y, 0.0, rot=rot)
    AR.jetty(mb, R, city.pal, ln, width=6.5, z=2.4)
    AR.crates(mb, R, ln - 9.0, 0.9, 2.4, 9, city.pal, spread=3.0, plain=True, size=(0.8, 1.5))
    AR.crates(mb, R, ln - 34.0, -0.9, 2.4, 7, city.pal, spread=3.0, plain=True, size=(0.8, 1.4))
    AR.crates(mb, R, ln - 58.0, 1.0, 2.4, 5, city.pal, spread=2.5, plain=True, size=(0.8, 1.3))
    for k, x in enumerate((ln - 3.0, ln - 29.0, ln - 55.0, ln - 81.0)):
        AR.lamp(lights, CAM1, city.pal, x, 2.7, 2.4, h=5.2, halo=1, pool=2, hsh=0.2 + 0.2 * k, size=0.9)
    mb.pop()
    lights.pop()
    ob = mb.build(s, 'jetty', city.mats, ink=1.3, cam=CAM1)
    lo = lights.build(s, 'jetty_lights', [city.mats[0], city.halo, city.pool], weld=False, shadow=False)
    # Hafenarbeiter / dock workers
    kinds = ['carry', 'push', 'stand', 'carry', 'hat', 'lean', 'old', 'child']
    atlas = AT.people_atlas('jetty_people', kinds, A.cmix('ink800', 'sky800', 0.4), rim=A.cmix('sunDusk', 'yellow400', 0.5), light=(-1.0, 0.35), seed=9,
                            flip=[False, True, False, True, True, False, False, True])
    d = (b - a).normalized()
    side = Vector((-d.y, d.x))
    places = []
    for u, v, k in ((ln - 3.5, -1.8, 2), (ln - 13.0, -1.6, 0), (ln - 17.5, -0.6, 3), (ln - 24.0, 1.5, 4), (ln - 38.0, 1.4, 1), (ln - 44.0, 0.8, 5), (ln - 51.0, -1.4, 0),
                    (ln - 66.0, 1.4, 6), (ln - 25.6, 2.0, 7), (ln - 72.0, -1.2, 3), (ln - 80.0, 0.3, 1), (ln - 21.0, -1.9, 5)):
        q = a + d * u + side * v
        places.append((q.x, q.y, 2.4, k))
    ppl = AT.people(s, 'jetty_people', atlas, places, cam=CAM1)
    S.mirror(s, [ob, lo, ppl.ob], stretch=1.45)
    return ob


def build():
    s = L.Shot(DUR)
    high = os.environ.get('FV_A02_CAM') == 'high'
    s.cam.data.lens = 40
    s.cam.data.clip_start, s.cam.data.clip_end = 4.0, 16000.0
    s.look(CAM0, aim(CAM0, *AIM0))
    dusk_light(s)
    c = A.cmix
    city = M.Meridon(s, CAM0, lit=0.5, glass=c('sunDusk', 'sky700', 0.45), nexus_beam=0.12, nexus_lit=0.3)
    sky, spec = dusk_sky(s, (CAM0[0], CAM0[1], 0.0))
    S.Water(s, (-5000, -2500, 5000, 2600), CAM0, near=c('water900', 'sky800', 0.3), mid=c('teal500', 'water700', 0.55), far=c('yellow400', 'sunDusk', 0.5),
            hi=c('flash100', 'yellow400', 0.3), lo=c('sky800', 'water900', 0.5), sun_az=SUN[0], sun_col='flash100', sun_width=6.5, sun_gain=2.2, far_dist=1100.0,
            alpha=(0.9, 0.6), dash=(0.32, 0.42), hi_thr=(0.71, 0.56), calm=0.38)
    for k, (y, z1, a) in enumerate(((122, 34, 0.08), (214, 52, 0.10), (322, 76, 0.13), (452, 104, 0.16), (600, 140, 0.22), (900, 200, 0.30))):
        AT.haze_bank(s, (-1500, y), (1500, y), M.height(0, y) - 4, z1, c('hazeDusk', 'yellow400', 0.12), alpha=a, name='bank%d' % k)
    jetty = foreground(s, city)
    gulls = AT.Birds(s, 'gulls', 12, (-60.0, -150.0, 34.0), 55.0, c('ink700', 'sky800', 0.4), size=(0.8, 1.2), speed=11.0, seed=3, spread_z=10.0)
    gulls2 = AT.Birds(s, 'gulls2', 22, (-250.0, -120.0, 48.0), 70.0, c('ink700', 'sky800', 0.4), size=(1.1, 1.8), speed=10.0, seed=5, spread_z=16.0)
    W.haze(s, c('hazeDusk', 'yellow400', 0.12), start=250.0, dist=640.0, amount=0.9, hfloor=0.55, hscale=110.0)

    def update(t):
        u = L.clamp(t / DUR)
        p = 0.5 * u + 0.5 * u * u * (3 - 2 * u)
        tele = os.environ.get('FV_A02_TELE')
        if tele:
            # Kontrolle: Fernrohr in eine Richtung (az,el,Brennweite) vom Endstandpunkt / check: telescope from the end position
            a_, e_, f_ = [float(v) for v in tele.split(',')]
            s.cam.data.lens = f_
            s.look(CAM1, aim(CAM1, a_, e_))
        elif high:
            s.look((-150, -420, 210), (40, 200, 20))
        else:
            pos = L.vlerp(CAM0, CAM1, p)
            s.look(pos, aim(pos, L.lerp(AIM0[0], AIM1[0], p), L.lerp(AIM0[1], AIM1[1], p)))
        W.clock(t)
        city.update(t)
        gulls.update(t)
        gulls2.update(t)
    s.on(update)
    return s
