"""
A04, Totale (15-19 s; die Nahaufnahme davor kommt aus dem Figuren-Baukasten): der Grosse Stillstand. Nacht ueber
Meridon, die Stadt leuchtet; dann sterben die Lichter Viertel fuer Viertel von den Huegeln zur Kamera hin, Bahnen,
Kraene und Schiffe bleiben stehen. Zuletzt ist alles dunkel bis auf das Rechenzentrum von NEXUS am Horizont: kaltes
Cyan, eine Lichtsaeule, ihr Spiegel im Hafenbecken. Kamera: Totale von oben, gehalten mit kaum merklicher Zufahrt.
A04, wide part (15-19 s; the close-up before it comes from the character kit): the Great Standstill. Night over
Meridon, the city glows; then the lights die district by district from the hills towards the camera, trams, cranes and
ships stop. In the end everything is dark except the NEXUS data centre on the horizon: cold cyan, a pillar of light,
its mirror image in the harbour basin. Camera: wide from above, held with a barely noticeable push.
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

DUR = 4.0
WAVE = (0.55, 2.75)   # erste und letzte Abschaltung / first and last switch-off
STILL = 2.2           # Stillstand der Bewegung / motion stops
CAM0, CAM1 = (-168.0, -356.0, 86.0), (-160.0, -338.0, 84.0)
LOOK = (258.0, 700.0, 36.0)
SKY_SCALE = float(os.environ.get('FV_SKY', '1.0'))


def night_sky(s, centre, name='sky_a04'):
    c = A.cmix
    w = int(4096 * SKY_SCALE)
    deep, mid, low = c('sky900', 'ink900', 0.45), c('sky900', 'sky800', 0.5), c('sky800', 'sky700', 0.45)
    bands = [
        {'el': 10.0, 'az': (-40, 80), 'n': 7, 'len': (30, 70), 'thick': (1.6, 3.6), 'jitter': 2.5, 'seed': 4, 'rim': 0.0,
         'cols': (c('sky900', 'ink900', 0.55), c('sky900', 'sky800', 0.55), c('sky900', 'sky800', 0.55)), 'split': 0.25},
        {'el': 21.0, 'az': (-45, 85), 'n': 6, 'len': (40, 80), 'thick': (2.4, 5.0), 'jitter': 3.5, 'seed': 9, 'rim': 0.0,
         'cols': (c('sky900', 'ink900', 0.7), c('sky900', 'sky800', 0.3), c('sky900', 'sky800', 0.3)), 'split': 0.3},
    ]
    return AT.sky(s, name, centre, radius=6000.0, bands=bands, w=w, h=int(w * 0.40), az=(-48.0, 88.0), el=(-10.0, 34.0), sun=(20.0, -6.0),
                  grad=[(-10, low), (0.0, c('sky700', 'sky800', 0.35)), (3.0, low), (9, mid), (20, deep), (34, c('ink900', 'sky900', 0.3))], seed=5,
                  clouds=[{'at': (-12, 3.4), 'w': 60, 'h': 7.0, 'size': 2.4, 'tone': 0.2}, {'at': (60, 4.0), 'w': 54, 'h': 9.0, 'size': 2.8, 'tone': 0.3},
                          {'at': (24, 12.0), 'w': 70, 'h': 6.0, 'size': 3.0, 'tone': 0.5, 'flat': True}],
                  cloud_cols=(c('sky900', 'ink900', 0.55), c('sky900', 'sky800', 0.4), c('sky800', 'sky900', 0.3), c('sky800', 'nexusSteel', 0.18)),
                  land=[{'el': 1.5, 'amp': 2.2, 'waves': 4, 'seed': 5, 'col': c('sky900', 'sky800', 0.55), 'rim': c('sky800', 'sky700', 0.5)},
                        {'el': 0.9, 'amp': 1.4, 'waves': 7, 'seed': 8, 'col': c('sky900', 'ink900', 0.2), 'rim': c('sky800', 'sky700', 0.2)}])


def build():
    s = L.Shot(DUR)
    c = A.cmix
    s.cam.data.lens = 34
    s.cam.data.clip_start, s.cam.data.clip_end = 6.0, 16000.0
    s.look(CAM0, LOOK)
    # Nachtlicht: kuehles Restlicht von links oben gibt den Koerpern Form / night light: cool residual light from the upper left gives the bodies form
    # (aus der Richtung von NEXUS: nach dem Stromausfall die einzige Lichtquelle; Daecher und Kanten fangen kaltes Cyan)
    # (from the direction of NEXUS: after the blackout the only light source; roofs and edges catch cold cyan)
    rot, d = A.sun_rot(20.0, 16.0)
    s.sunlight(rot=tuple(rot))
    lights = (A.lin(c('sky900', 'ink900', 0.45)), A.lin(c('sky800', 'sky700', 0.2)), A.lin(c('sky700', 'nexusSteel', 0.55)))
    s.toon.set_light(*lights)
    s.toon.t1.default_value, s.toon.t2.default_value = 0.05, 0.2
    city = M.Meridon(s, CAM0, wave=WAVE, lit=0.62, glass=c('sky900', 'sky800', 0.5), sail_glow=0.0, nexus_beam=0.9, people=False, ink=1.1, mirror_nexus=True,
                     smoke_tint=tuple(A.lin(c('sky800', 'smoke700', 0.35))[:3]), wake_col=c('sky700', 'moon300', 0.2),
                     place={'sail_near': ((-112.0, -62.0, 0.0), 160.0, (-1.2, 0.5)), 'freighter_out': ((70.0, -64.0, 0.0), 174.0, (-3.0, 0.3))})
    sky, spec = night_sky(s, (CAM0[0], CAM0[1], 0.0))
    S.Water(s, (-5000, -2500, 5000, 2600), CAM0, near=c('sky900', 'ink900', 0.35), mid=c('sky900', 'sky800', 0.6), far=c('sky800', 'sky700', 0.5),
            hi=c('sky700', 'moon300', 0.22), lo=c('ink900', 'sky900', 0.4), far_dist=1300.0, alpha=(0.62, 0.5), dash=(0.32, 0.42), hi_thr=(0.74, 0.55), speed=0.25,
            sun_az=math.degrees(math.atan2(M.NEXUS[0] - CAM0[0], M.NEXUS[1] - CAM0[1])), sun_col='nexusGlow', sun_width=2.0, sun_gain=1.0,
            calm=0.4, calm_col=c('sky800', 'sky700', 0.3))
    # Lichtglocke der Stadt am Himmel: warme Hoefe, die mit den Vierteln erloeschen / the city's glow on the sky: warm halos that die with the districts
    glow = W.MeshB()
    for (x, y, wd, hh) in ((-220, 420, 620, 150), (120, 520, 700, 170), (430, 460, 620, 150), (0, 900, 900, 190), (520, 980, 800, 170), (-330, 880, 700, 150), (60, 200, 520, 110)):
        glow.card((x, y, M.height(x, y) + 46.0), wd, hh, CAM0, c('sunDusk', 'window300', 0.5), mat=0, alpha=0.26, off=city.off(x, y) - 0.1, hsh=0.5)
    glow.build(s, 'city_glow', [city.halo], weld=False, shadow=False)
    for k, (y, z1, a) in enumerate(((214, 52, 0.10), (322, 70, 0.12), (452, 92, 0.15), (600, 120, 0.2), (900, 170, 0.28))):
        AT.haze_bank(s, (-1500, y), (1800, y), M.height(0, y) - 4, z1, c('sky800', 'hazeNight', 0.5), alpha=a, name='bank%d' % k)
    W.haze(s, c('sky700', 'hazeNight', 0.6), start=220.0, dist=800.0, amount=0.9, hfloor=0.6, hscale=120.0, ink=0.62)

    def update(t):
        p = L.ease_out(L.clamp(t / DUR)) * 0.6 + 0.4 * L.clamp(t / DUR)
        s.look(L.vlerp(CAM0, CAM1, p), LOOK)
        W.clock(t)
        # Bewegung laeuft weich aus / motion eases to a stop
        tm = t if t < STILL - 0.5 else (STILL - 0.5) + 0.5 * (1 - math.exp(-(t - (STILL - 0.5)) / 0.25))
        city.update(t, moving=tm)
        # mit dem Stadtlicht verliert auch das Restlicht an Waerme / as the city's light goes, the residual light cools down
        k = L.seg(t, WAVE[0], WAVE[1])
        f = 1.0 - 0.25 * k
        s.toon.set_light(tuple(v * f for v in lights[0][:3]) + (1,), tuple(v * f for v in lights[1][:3]) + (1,), lights[2])
        AT.sky_tint(sky, (1 - 0.16 * k, 1 - 0.14 * k, 1 - 0.08 * k))
    s.on(update)
    return s
