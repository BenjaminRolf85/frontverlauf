"""
B01 (19-23 s): Nacht, Kaelte. Vor dem geschlossenen Tor der Bank steht eine Menge; das Bronzetor ist vergittert und mit
einer Kette verschlossen, Zettel kleben an den Saeulen, die Laterne ist erloschen, Atem steht in der Luft, es schneit
duenn. Kamera: Halbtotale von hinten ueber die Menge, langsamer Schwenk vom dunklen Giebel hinab auf das Tor.
B01 (19-23 s): night, cold. A crowd stands at the bank's shut gate; the bronze gate is barred and chained, notices
stick to the columns, the street lamp is dead, breath hangs in the air, thin snow falls. Camera: medium wide from
behind over the crowd, a slow tilt from the dark pediment down to the gate.

Die Menge sind Silhouetten von hinten (Karten); eine oder zwei Figuren im Vordergrund koennten spaeter aus dem
Figuren-Baukasten kommen. / the crowd are silhouettes from behind (cards); one or two foreground figures could come
from the character kit later.
"""
import math
import os

import numpy as np

from ... import anime as A
from ... import arch as AR
from ... import atmo as AT
from ... import lib as L
from ... import props as P
from ... import scenery as S
from ... import world as W

DUR = 4.0
CAM = (2.2, -58.6, 1.85)
PITCH = (36.0, 13.0)
AZ = (-3.5, -4.5)
SKY_SCALE = float(os.environ.get('FV_SKY', '1.0'))


def cold_sky(s, centre, name='sky_b01'):
    c = A.cmix
    w = int(3072 * SKY_SCALE)
    bands = [
        {'el': 26.0, 'az': (-60, 60), 'n': 7, 'len': (30, 70), 'thick': (3.0, 7.0), 'jitter': 5.0, 'seed': 4, 'rim': 0.0,
         'cols': (c('sky900', 'ink900', 0.6), c('sky900', 'sky800', 0.5), c('sky900', 'sky800', 0.5)), 'split': 0.25},
        {'el': 46.0, 'az': (-60, 60), 'n': 6, 'len': (36, 80), 'thick': (5.0, 10.0), 'jitter': 6.0, 'seed': 9, 'rim': 0.0,
         'cols': (c('sky900', 'ink900', 0.75), c('sky900', 'sky800', 0.3), c('sky900', 'sky800', 0.3)), 'split': 0.3},
    ]
    # ein fahler Riss in der Wolkendecke links oben: von dort kommt das Mondlicht / a pale rift in the cloud deck upper left: the moonlight comes from there
    return AT.sky(s, name, centre, radius=3000.0, bands=bands, w=w, h=int(w * 0.8), az=(-62.0, 62.0), el=(-6.0, 66.0), sun=(-34.0, 50.0),
                  grad=[(-6, c('sky800', 'sky700', 0.4)), (4, c('sky800', 'sky900', 0.3)), (20, c('sky900', 'sky800', 0.4)), (45, c('sky900', 'ink900', 0.35)),
                        (66, c('ink900', 'sky900', 0.4))], seed=7, glow=(c('sky700', 'moon300', 0.25), c('moon300', 'sky700', 0.35)),
                  clouds=[{'at': (-20, 34.0), 'w': 70, 'h': 16.0, 'size': 6.0, 'tone': 0.6}, {'at': (30, 22.0), 'w': 70, 'h': 14.0, 'size': 6.0, 'tone': 0.5},
                          {'at': (-36, 54.0), 'w': 50, 'h': 14.0, 'size': 6.0, 'tone': 0.9}],
                  cloud_cols=(c('sky900', 'ink900', 0.6), c('sky900', 'sky800', 0.35), c('sky800', 'sky700', 0.3), c('sky700', 'moon300', 0.3)))


def aim(pos, az, el, dist=60.0):
    a, e = math.radians(az), math.radians(el)
    return (pos[0] + math.sin(a) * math.cos(e) * dist, pos[1] + math.cos(a) * math.cos(e) * dist, pos[2] + math.sin(e) * dist)


def build():
    s = L.Shot(DUR)
    c = A.cmix
    R = np.random.default_rng(23)
    s.cam.data.lens = 27
    s.cam.data.clip_start, s.cam.data.clip_end = 0.3, 8000.0
    s.look(CAM, aim(CAM, AZ[0], PITCH[0]))
    # Mondlicht von links vorn oben / moonlight from the upper front left
    rot, d = A.sun_rot(-146.0, 40.0)
    s.sunlight(rot=tuple(rot))
    s.toon.set_light(A.lin(c('sky800', 'sky900', 0.35)), A.lin(c('sky700', 'skyNight', 0.3)), A.lin(c('moon300', 'paper50', 0.2)))
    s.toon.t1.default_value, s.toon.t2.default_value = 0.08, 0.4
    pal = AR.meridon_palette()
    mats = S.facade_mats(s, glass=c('sky900', 'sky800', 0.35))
    cam = CAM

    # ----- die Bank, alles erloschen / the bank, everything dead -----
    mb = W.MeshB()
    mb.off = -10.0
    b = AR.bank(mb, pal, lit=0.0, gate='shut', flutes=True)
    base, gy, py = b['base'], b['gate'][1], b['portico']
    mb.push(0.0, gy - 1.72, base)
    g = P.bronze_gate(mb)
    P.chain(mb, g['chain'], r=0.13, link=0.36)
    P.chain(mb, [(-1.7, 0.05, 5.3), (-2.6, 0.2, 6.6)], r=0.13, link=0.36)
    P.chain(mb, [(1.7, 0.05, 5.3), (2.5, 0.2, 6.9)], r=0.13, link=0.36)
    # Vorhaengeschloss / padlock
    lx, ly, lz = g['lock']
    mb.box(lx - 0.34, ly - 0.14, lz - 0.2, lx + 0.34, ly + 0.14, lz + 0.42, A.cmix('goldDark', 'smoke700', 0.5), bottom=True)
    mb.tube((lx - 0.2, ly, lz + 0.42), (lx - 0.2, ly, lz + 0.72), 0.05, A.cmix('smoke700', 'ink700', 0.3), n=5)
    mb.tube((lx + 0.2, ly, lz + 0.42), (lx + 0.2, ly, lz + 0.72), 0.05, A.cmix('smoke700', 'ink700', 0.3), n=5)
    mb.pop()
    # Zettel an Saeulen und Tor / notices on the columns and the gate
    paper = A.cmix('paper50', 'sky700', 0.35)
    for (x, z, w, hh, tilt) in ((-9.6, base + 2.4, 0.55, 0.75, 4), (-3.2, base + 2.0, 0.5, 0.7, -5), (3.2, base + 2.6, 0.6, 0.8, 3), (9.6, base + 2.2, 0.5, 0.7, -3),
                                (-16.0, base + 2.5, 0.55, 0.75, 6), (16.0, base + 2.1, 0.5, 0.7, -6), (3.2, base + 3.6, 0.5, 0.65, -8), (-9.6, base + 3.4, 0.45, 0.6, 7)):
        mb.push(x, py - 1.52, z, rot=0)
        t = math.radians(tilt)
        q = [(-w / 2 * math.cos(t), 0, -w / 2 * math.sin(t)), (w / 2 * math.cos(t), 0, w / 2 * math.sin(t)),
             (w / 2 * math.cos(t) - hh * math.sin(t), 0, w / 2 * math.sin(t) + hh * math.cos(t)), (-w / 2 * math.cos(t) - hh * math.sin(t), 0, -w / 2 * math.sin(t) + hh * math.cos(t))]
        mb.face(q, paper)
        for k in range(4):
            u0, u1 = 0.15, 0.85 - 0.2 * (k % 2)
            v = 0.25 + k * 0.16
            ln = [((-w / 2 + w * u) * math.cos(t) - hh * v * math.sin(t), -0.03, (-w / 2 + w * u) * math.sin(t) + hh * v * math.cos(t)) for u in (u0, u1)]
            mb.tube(ln[0], ln[1], 0.022, A.cmix('ink700', 'sky800', 0.3), n=4)
        mb.pop()
    mb.build(s, 'bank', mats, ink=1.5, cam=cam)

    # ----- Platz: Pflaster, Reif, verstreute Zettel / the square: paving, frost, scattered papers -----
    area = (-70.0, -110.0, 70.0, -40.0)
    cv = S.Canvas(area, 3072, c('rock600', 'sky800', 0.45))
    joint, frost = c('ink700', 'sky900', 0.4), c('moon300', 'sky700', 0.55)
    for x in np.arange(-70, 70, 2.4):
        cv.rect(x, -110, x + 0.12, -40, joint, 0.7)
    for y in np.arange(-110, -40, 2.4):
        cv.rect(-70, y, 70, y + 0.12, joint, 0.7)
    cv.wash(frost, 0.5, 5.0, 3, thr=0.6)
    cv.wash(c('sky900', 'ink900', 0.3), 0.45, 9.0, 8, thr=0.62)
    for _ in range(46):
        x, y = float(R.uniform(-22, 26)), float(R.uniform(-80, -56))
        a = float(R.uniform(0, 3.14))
        cv.line((x, y), (x + 0.5 * math.cos(a), y + 0.5 * math.sin(a)), 0.36, A.cmix('paper50', 'sky700', 0.4), 0.9)
    S.ground(s, lambda x, y: 0.0, (140.0, 70.0), (4, 4), cv.image('b01_ground'), area, name='b01_ground', loc=(0.0, -75.0, 0))

    # ----- erloschene Laternen / dead street lamps -----
    lamps = W.MeshB()
    for (x, y, tilt) in ((-1.3, -52.0, 0.2), (11.5, -51.6, -0.1)):
        lamps.push(x, y, max(0.0, base * (1 - math.ceil((py - 3 - y) / 1.15) / 10)))
        P.dead_lamp(lamps, pal, h=5.6, arm=1.3 if x < 0 else -1.3, tilt=tilt)
        lamps.pop()
    lamps.build(s, 'lamps', mats, ink=1.6, cam=cam)

    # ----- die Menge / the crowd -----
    kinds = ['stand', 'woman', 'hat', 'old', 'child', 'fist', 'lean', 'stand', 'woman', 'hat']
    atlas = AT.people_atlas('b01_people', kinds, c('ink900', 'sky900', 0.5), rim=c('sky700', 'moon300', 0.45), light=(-1.0, 0.55), seed=6, cell=(400, 720),
                            flip=[bool(i % 2) for i in range(len(kinds))], rim_px=1.0)
    places = []
    nst = 10

    def floor(y):
        """Hoehe der Freitreppe bei y / height of the stairs at y"""
        y0 = py - 3
        return base if y > y0 else max(0.0, base * (1 - math.ceil((y0 - y) / 1.15) / nst))
    for i in range(210):
        x = float(R.normal(-0.5, 8.0))
        y = float(R.uniform(-52.5, gy - 2.4))
        if abs(x) > 22 or (y < -47 and abs(x - 1.5) > 9) or (abs(x + 1.3) < 0.7 and abs(y + 52.0) < 0.8):
            continue
        # nicht in einer Saeule stehen / do not stand inside a column
        if abs(y - py) < 2.2 and min(abs(x - (-31 + 2.2 + k * (62 - 4.4) / 9)) for k in range(10)) < 2.0:
            continue
        k = int(R.integers(0, len(kinds)))
        places.append((x, y, floor(y), k, float(R.uniform(0.94, 1.06)) * (1.0 if kinds[k] != 'child' else 1.0)))
    # vorn auf der Treppe: Ruecken dicht vor der Kamera / in front on the stairs: backs close to the camera
    for (x, y, k) in ((-2.6, -53.6, 2), (-0.5, -53.9, 1), (4.4, -53.8, 3), (6.4, -53.2, 7), (-4.6, -53.0, 8), (8.6, -53.9, 5), (3.0, -52.6, 4), (0.9, -52.9, 0)):
        places.append((x, y, floor(y), k, 1.0))
    places.sort(key=lambda p: -p[1])
    AT.people(s, 'b01_people', atlas, places, cam=cam)
    heads = [(p[0], p[1] - 0.25, p[2] + 1.6 * (0.6 if kinds[p[3]] == 'child' else 1.0) * p[4]) for p in places]
    breath = AT.Particles(s, 'breath', len(heads), ((0, 0, 0), (1, 1, 1)), (0.1, -0.04, 0.26), (0.1, 0.19), c('moon300', 'paper50', 0.35), mode='puff', seed=3, alpha=0.42,
                          sway=0.25, life=2.6, origins=heads)
    snow = AT.Particles(s, 'snow', 620, ((-24, -57, 0), (28, -30, 34)), (0.5, -0.2, -1.4), (0.014, 0.04), c('moon300', 'paper50', 0.5), mode='flake', seed=5, alpha=0.85, sway=0.5)

    cold_sky(s, (CAM[0], CAM[1], 0.0))
    W.haze(s, c('sky700', 'skyNight', 0.3), start=3.0, dist=36.0, amount=0.5, hfloor=0.8, hscale=60.0, ink=0.4)

    def update(t):
        u = L.clamp(t / DUR)
        p = 0.35 * u + 0.65 * L.ease_io(u)
        s.look(CAM, aim(CAM, L.lerp(AZ[0], AZ[1], p), L.lerp(PITCH[0], PITCH[1], p)))
        W.clock(t)
        breath.update(t)
        snow.update(t)
    s.on(update)
    return s
