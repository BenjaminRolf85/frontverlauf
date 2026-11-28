"""
B03 (25-31 s): die Verteilungskriege. Schlachtfeld im Staub, braunes Gegenlicht: Silhouetten unter vielen Fahnen
kaempfen um einen Tankwagen, rostende Panzer, Krater mit Pfuetzen, Stacheldraht, Rauchsaeulen, ein brennendes Wrack.
Kamera: Totale, seitliche Fahrt auf Augenhoehe; Vordergrund, Mitte und Ferne gleiten gegeneinander, die tiefe Sonne
wandert hinter den Fahnentraeger auf dem Tankwagen.
B03 (25-31 s): the distribution wars. A battlefield in dust, brown back light: silhouettes under many flags fight over
a fuel truck, rusting tanks, craters with puddles, barbed wire, smoke columns, a burning wreck. Camera: wide, lateral
track at eye level; foreground, middle and distance slide against each other, the low sun travels behind the standard
bearer on the fuel truck.

Die Figuren sind Silhouetten (Karten); wer hier spaeter eine ganze Figur braucht, steht im WORLD-GUIDE.
The figures are silhouettes (cards); the WORLD-GUIDE lists who needs a full figure here later.
"""
import math
import os

import numpy as np
from mathutils import Vector

from ... import anime as A
from ... import atmo as AT
from ... import lib as L
from ... import props as P
from ... import scenery as S
from ... import world as W

DUR = 6.0
SUN = (6.0, 8.5)
SKY_SCALE = float(os.environ.get('FV_SKY', '1.0'))
TRUCK = (2.0, 27.0)
TRUCK_ROT, TRUCK_SCALE = 12.0, 1.15
CRATERS = [(-9.0, 15.5, 3.6, 1.1), (11.5, 13.0, 2.6, 0.8), (-21.0, 30.0, 5.0, 1.5), (19.0, 39.0, 6.0, 1.8), (-4.0, 52.0, 7.5, 2.2), (-40.0, 58.0, 8.0, 2.2),
           (40.0, 70.0, 10.0, 2.6), (-18.0, 96.0, 11.0, 2.8), (30.0, 120.0, 12.0, 3.0), (-60.0, 140.0, 14.0, 3.2), (3.5, 7.0, 1.7, 0.45), (-27.0, 12.0, 2.4, 0.7)]
TRENCH = [([(17.0, 22.0), (33.0, 26.0), (56.0, 23.0), (90.0, 30.0)], 2.0, 1.6), ([(-90.0, 76.0), (-52.0, 82.0), (-30.0, 77.0)], 2.4, 1.8)]
FACTIONS = ('korvat', 'alvenia', 'meridon', 'velkar', 'dravon')


def war_sky(s, centre, name='sky_b03'):
    c = A.cmix
    w = int(4096 * SKY_SCALE)
    dust, brown, dark = c('dust300', 'flash100', 0.4), c('mud500', 'dust300', 0.35), c('smoke700', 'mud700', 0.5)
    bands = [
        {'el': 16.0, 'az': (-70, 80), 'n': 8, 'len': (26, 60), 'thick': (1.4, 3.4), 'jitter': 3.5, 'seed': 4, 'rim': 2.0,
         'cols': (c('smoke700', 'mud700', 0.6), c('mud500', 'smoke700', 0.45), c('dust300', 'fire400', 0.35)), 'split': 0.1},
        {'el': 27.0, 'az': (-70, 80), 'n': 7, 'len': (34, 80), 'thick': (2.4, 5.0), 'jitter': 4.0, 'seed': 9, 'rim': 0.0,
         'cols': (c('ink700', 'mud700', 0.5), c('smoke700', 'mud700', 0.5), c('mud500', 'smoke700', 0.5)), 'split': 0.2},
    ]
    return AT.sky(s, name, centre, radius=6000.0, bands=bands, w=w, h=int(w * 0.44), az=(-68.0, 82.0), el=(-8.0, 42.0), sun=SUN,
                  grad=[(-8, c('dust300', 'mud500', 0.3)), (0, dust), (5, c('dust300', 'fire400', 0.16)), (11, brown), (20, c('mud500', 'smoke700', 0.5)), (30, dark),
                        (42, c('ink700', 'smoke700', 0.4))],
                  glow=(c('dust300', 'fire400', 0.25), A.hexc('flash100')), rays=0.8, seed=17,
                  clouds=[{'at': (-36, 4.0), 'w': 42, 'h': 15.0, 'size': 3.4, 'tone': 0.5, 'peak': 1.2}, {'at': (40, 3.0), 'w': 36, 'h': 20.0, 'size': 3.8, 'tone': 0.7, 'peak': 1.1},
                          {'at': (70, 2.5), 'w': 30, 'h': 11.0, 'size': 3.0, 'tone': 0.3}],
                  cloud_cols=(c('ink700', 'mud700', 0.55), c('smoke700', 'mud500', 0.4), c('mud500', 'dust300', 0.45), c('dust300', 'fire400', 0.4)),
                  land=[{'el': 0.3, 'amp': 1.3, 'waves': 6, 'seed': 5, 'col': c('mud500', 'dust300', 0.5), 'rim': c('dust300', 'flash100', 0.3)}])


def paint_ground(h, people, name='b03_ground'):
    """
    Naher Boden in drei Toenen: dunkler nasser Schlamm, staubige Erde, helles Wasser (Pfuetzen und Spurrillen spiegeln
    den Himmel im Gegenlicht); Kettenspuren fuehren ins Bild, Schatten der Figuren laufen zur Kamera.
    Near ground in three tones: dark wet mud, dusty earth, bright water (puddles and ruts mirror the sky against the
    light); track marks lead into the picture, the figures' shadows run towards the camera.
    """
    c = A.cmix
    area = (-130.0, -6.0, 130.0, 194.0)
    cv = S.Canvas(area, 4096, c('mud500', 'dust300', 0.22))
    wet, water, dry = c('mud700', 'scorch900', 0.35), c('dust300', 'flash100', 0.5), c('dust300', 'mud500', 0.45)
    cv.wash(c('mud700', 'mud500', 0.4), 0.85, 16, 3, thr=0.52)
    cv.wash(dry, 0.8, 24, 7, thr=0.6)
    cv.wash(wet, 0.9, 7, 11, thr=0.62)
    cv.wash(water, 1.0, 3.2, 23, thr=0.68, area=(-40, -6, 40, 24))
    cv.wash(water, 1.0, 5.5, 31, thr=0.72, area=(-60, 24, 60, 70))
    cv.wash(water, 1.0, 9.0, 29, thr=0.75, area=(-130, 60, 130, 194))
    R = np.random.default_rng(3)
    # Kettenspuren: zwei Rillen, in denen Wasser steht / track marks: two ruts holding water
    for k, (x0, y0, ang) in enumerate(((-6.0, -6.0, 1.42), (9.0, -6.0, 1.72), (-34.0, -6.0, 1.2), (30.0, -6.0, 1.95), (-70.0, 10.0, 0.9), (70.0, 20.0, 2.2), (-14.0, 60.0, 1.0),
                                       (20.0, 70.0, 2.0))):
        pts = [(x0, y0)]
        for i in range(16):
            ang += R.uniform(-0.07, 0.07)
            pts.append((pts[-1][0] + math.cos(ang) * 8, pts[-1][1] + math.sin(ang) * 8))
        for off in (-1.15, 1.15):
            q = [(p[0] + off * math.sin(ang), p[1] - off * math.cos(ang)) for p in pts]
            cv.poly(q, 0.7, wet, 0.9)
            cv.poly(q, 0.3, water, 0.85 if k < 4 else 0.5)
            for a, b in zip(q[:-1], q[1:]):
                for t in np.arange(0, 1, 0.11):
                    px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                    cv.rect(px - 0.42, py - 0.1, px + 0.42, py + 0.1, wet, 0.8)
    for cx, cy, r, dep in CRATERS:
        cv.disc((cx, cy), r * 1.5, dry, 0.6, soft=r * 0.5)
        cv.disc((cx, cy), r * 1.02, c('scorch900', 'mud700', 0.4), 0.92, soft=r * 0.25)
        cv.disc((cx + r * 0.08, cy - r * 0.05), r * 0.52, water, 1.0, squash=0.8)
        cv.disc((cx + r * 0.08, cy - r * 0.05), r * 0.52, wet, 0.9, squash=0.8, ring=max(0.1, r * 0.05))
    for pts, wd, dep in TRENCH:
        cv.poly(pts, wd * 1.5, c('scorch900', 'mud700', 0.5), 0.9, soft=0.5)
    cv.flecks(900, (0.05, 0.22), c('scorch900', 'mud700', 0.3), 5, alpha=0.9, area=(-60, -6, 60, 70))
    cv.flecks(500, (0.04, 0.16), dry, 6, alpha=0.9, area=(-60, -6, 60, 70))
    # Schlagschatten der Figuren (Karten werfen keinen) / cast shadows of the figures (cards cast none)
    sa = math.radians(SUN[0])
    ln = 1.75 / math.tan(math.radians(SUN[1])) * 0.85
    for (x, y, z, k, *rest) in people:
        cv.line((x, y), (x - math.sin(sa) * ln, y - math.cos(sa) * ln), 0.5, c('scorch900', 'mud700', 0.25), 0.62, soft=0.22)
    return cv.image(name), area


def build():
    s = L.Shot(DUR)
    c = A.cmix
    R = np.random.default_rng(11)
    s.cam.data.lens = 30
    s.cam.data.clip_start, s.cam.data.clip_end = 0.4, 14000.0
    cam0, cam1 = Vector((-5.5, 0.0, 2.0)), Vector((5.5, 0.0, 2.05))
    s.look(cam0, (0, 30, 3.4))
    rot, d = A.sun_rot(*SUN)
    s.sunlight(rot=tuple(rot))
    s.toon.set_light(A.lin(c('mud700', 'smoke700', 0.3)), A.lin(c('mud500', 'dust300', 0.5)), tuple(v * 1.12 for v in A.lin(c('dust300', 'flash100', 0.45))[:3]) + (1,))
    s.toon.t1.default_value, s.toon.t2.default_value = 0.08, 0.36
    h = P.war_height(CRATERS, TRENCH, amp=0.5, freq=0.045, seed=2)
    mats = S.facade_mats(s, glass='scorch900')
    halo = W.sprite_mat('halo', attr_col=True, add=True, shape='disc', keep=0.7)
    cam_mid = (0.0, 0.0, 2.0)

    # ----- Figuren: zwei Haufen um den Tankwagen, Fahnentraeger, Schuetzen im Graben / figures -----
    kinds = ['soldier', 'run', 'bearer', 'fist', 'soldier', 'run', 'push', 'bearer']
    dark = c('scorch900', 'ink800', 0.5)
    rim = c('dust300', 'flash100', 0.55)
    atl_l = AT.people_atlas('b03_people_l', kinds, dark, rim=rim, seed=4, back=True, rim_px=1.6, cell=(240, 432))
    atl_r = AT.people_atlas('b03_people_r', kinds, dark, rim=rim, seed=5, back=True, rim_px=1.6, cell=(240, 432), flip=[True] * len(kinds))
    left, right, flags = [], [], []
    spots_l = [(-3.4, 25.0, 3), (-5.6, 27.6, 0), (-7.8, 23.6, 1), (-10.2, 26.6, 2), (-12.8, 22.8, 4), (-15.5, 28.4, 5), (-18.5, 25.0, 0), (-9.0, 31.5, 4), (-23.0, 27.5, 2),
               (-28.0, 24.0, 1), (-6.2, 20.6, 6)]
    spots_r = [(8.2, 25.4, 3), (10.6, 28.0, 0), (12.8, 24.0, 1), (15.4, 27.2, 2), (18.2, 23.4, 4), (21.0, 29.0, 5), (24.5, 25.5, 7), (13.5, 32.0, 0), (29.5, 26.5, 1), (10.4, 21.2, 6)]
    fi = 0
    for spots, out in ((spots_l, left), (spots_r, right)):
        for (x, y, k) in spots:
            z = h(x, y)
            out.append((x, y, z, k))
            if kinds[k] == 'bearer':
                flags.append(((x + (0.28 if out is left else -0.28), y, z + 1.9 * 1.75), FACTIONS[fi % 5], 1.0))
                fi += 1
    # der Fahnentraeger auf dem Tankwagen: Spitze des Bildes, die Sonne tritt hinter ihn
    # the standard bearer on the fuel truck: the apex of the picture, the sun moves behind him
    tz = h(*TRUCK) + 3.72 * TRUCK_SCALE
    top = (TRUCK[0] - 1.2, TRUCK[1] - 0.2, tz, 2)
    flags.append(((top[0] + 0.28, top[1], tz + 1.9 * 1.75), 'korvat', 1.25))
    top2 = (TRUCK[0] + 0.5, TRUCK[1] - 0.1, tz, 3)
    fi = 1
    # ferne Trupps / far squads
    far_l, far_r = [], []
    for i in range(40):
        x, y = float(R.uniform(-150, 150)), float(R.uniform(58, 230))
        k = int(R.integers(0, len(kinds)))
        (far_l if x < 0 else far_r).append((x, y, h(x, y), k))
        if kinds[k] == 'bearer':
            flags.append(((x + (0.28 if x < 0 else -0.28), y, h(x, y) + 1.9 * 1.75), FACTIONS[fi % 5], 1.3))
            fi += 1
    # Koepfe im Graben / heads in the trench
    trench = [(19.5, 23.2, 0), (23.5, 24.0, 4), (28.5, 25.4, 0), (37.0, 25.4, 4), (43.0, 24.6, 0)]
    trench = [(x, y, h(x, y) + 0.3, k) for (x, y, k) in trench]

    tex, area = paint_ground(h, left + right)
    S.ground(s, h, (260.0, 200.0), (260, 200), tex, area, name='b03_near', loc=(0.0, 94.0, 0))
    fc = S.Canvas((-2500.0, 190.0, 2500.0, 5190.0), 1024, c('mud500', 'dust300', 0.22))
    fc.wash(c('mud700', 'mud500', 0.4), 0.8, 120, 3, thr=0.52)
    fc.wash(c('dust300', 'mud500', 0.45), 0.7, 200, 7, thr=0.58)
    S.ground(s, lambda x, y: 0.6 * math.sin(x * 0.011) * math.cos(y * 0.008) - 0.4, (5000.0, 5000.0), (80, 80),
             fc.image('b03_far'), (-2500.0, 190.0, 2500.0, 5190.0), name='b03_farground', loc=(0.0, 2693.0, 0.0))

    AT.people(s, 'b03_left', atl_l, left + far_l + [top], cam=cam_mid)
    AT.people(s, 'b03_right', atl_r, right + far_r + trench + [top2], cam=cam_mid)
    fl = []
    for i, (p, f, sz) in enumerate(flags):
        tok = L.tokens()['faction'][f]
        fl.append(AT.Flag(s, p, 2.0 * sz, 1.25 * sz, tok['primary'], stripe=(tok['secondary'], lambda u, v: 0.36 < v < 0.64), wind=(1.0, 0.12), seed=i + 3, amp=1.2, glow=0.6,
                          nx=10, ny=3, droop=0.3))

    # ----- Tankwagen und Wracks / the fuel truck and wrecks -----
    mb = W.MeshB()
    mb.push(TRUCK[0], TRUCK[1], h(*TRUCK) + 0.05, rot=TRUCK_ROT, scale=TRUCK_SCALE)
    P.tanker(mb)
    mb.pop()
    mb.build(s, 'tanker', mats, ink=1.6)
    fg = W.MeshB()
    # Vordergrund: Stacheldraht, Grabzeichen, toter Baum, Schutt / foreground: barbed wire, a grave marker, a dead tree, rubble
    pts = [(x, 5.2 + 0.9 * math.sin(x * 0.3), 0.0) for x in np.arange(4.0, 30.0, 2.9)]
    pts = [(x, y, h(x, y)) for (x, y, _) in pts]
    P.wire_fence(fg, R, pts, h=1.4)
    pts = [(x, 9.0 + 0.8 * math.sin(x * 0.4), 0.0) for x in np.arange(-34.0, -15.0, 3.1)]
    P.wire_fence(fg, R, [(x, y, h(x, y)) for (x, y, _) in pts], h=1.4)
    gx, gy = 6.4, 6.2
    fg.ink = 0.6
    fg.tube((gx, gy, h(gx, gy) - 0.2), (gx + 0.14, gy, h(gx, gy) + 1.25), 0.035, c('char800', 'timber', 0.3), n=5)
    fg.box(gx - 0.05, gy - 0.03, h(gx, gy) + 0.9, gx + 0.2, gy + 0.03, h(gx, gy) + 1.2, c('char800', 'timber', 0.3))
    fg.ink = 1.0
    hz = h(gx, gy) + 1.2
    fg.revolve(gx + 0.14, gy, [(0.2, hz), (0.19, hz + 0.1), (0.13, hz + 0.2), (0.0, hz + 0.24)], c('olive700', 'char800', 0.5), n=10)
    fg.revolve(gx + 0.14, gy, [(0.25, hz - 0.03), (0.2, hz)], c('olive700', 'char800', 0.6), n=10, cap=False)
    fg.push(15.5, 16.5, h(15.5, 16.5))
    P.dead_tree(fg, R, h=7.5)
    fg.pop()
    fg.push(-30.0, 34.0, h(-30.0, 34.0))
    P.dead_tree(fg, R, h=6.5)
    fg.pop()
    for (x, y, n) in ((7.0, 17.0, 10), (-24.0, 20.0, 9), (26.0, 18.0, 8), (-1.0, 33.0, 9), (-10.0, 13.5, 6)):
        P.rubble(fg, R, x, y, h(x, y), n, c('mud700', 'smoke700', 0.4), spread=2.6, size=(0.2, 0.6))
    # zerbrochenes Wagenrad und Planken im Vordergrund / a broken cart wheel and planks in the foreground
    wx, wy = -4.6, 5.6
    fg.push(wx, wy, h(wx, wy) + 0.62, rot=24)
    wood = c('char800', 'timber', 0.35)
    fg.ink = 0.7
    ring = [(0.7 * math.cos(a_), 0.0, 0.7 * math.sin(a_)) for a_ in np.linspace(0.5, 2 * math.pi - 0.4, 15)]
    for a_, b_ in zip(ring[:-1], ring[1:]):
        fg.tube((a_[0], a_[1] + a_[2] * 0.28, a_[2]), (b_[0], b_[1] + b_[2] * 0.28, b_[2]), 0.06, wood, n=5)
    for k in range(7):
        a_ = 0.5 + k * 0.82
        fg.tube((0, 0, 0), (0.66 * math.cos(a_), 0.66 * math.sin(a_) * 0.28, 0.66 * math.sin(a_)), 0.035, wood, n=4)
    fg.ink = 1.0
    fg.cyl(0, -0.08, -0.1, 0.12, 0.2, wood, n=6)
    fg.pop()
    for (px_, py_, rt, ln) in ((-1.8, 4.6, 12, 2.6), (1.2, 8.2, -30, 2.2), (-7.4, 7.6, 70, 2.0), (9.6, 9.4, 40, 2.4)):
        fg.push(px_, py_, h(px_, py_) + 0.03, rot=rt)
        fg.box(-ln / 2, -0.11, 0, ln / 2, 0.11, 0.07, c('timber', 'mud700', 0.5))
        fg.pop()
    fg.build(s, 'b03_fg', mats, ink=1.8, cam=cam_mid)
    # rostende Panzer und Wracks / rusting tanks and wrecks
    tank = L.model(s, 'tank_dravon', loc=(-13.0, 11.5, h(-13.0, 11.5) - 0.25), rot=118, scale=1.45, tint=('rust', 0.62, 'wash'))
    tank.rotation_euler.x = math.radians(-5)
    L.aim(s, tank, (40.0, 60.0, 30.0))
    for (name, x, y, rt, sc) in (('hulk_tank_dravon', 27.0, 44.0, 140, 1.9), ('hulk_jeep_meridon', -17.0, 41.0, 60, 1.8), ('hulk_tank_velkar', -48.0, 64.0, 20, 2.1),
                                  ('hulk_artillery_alvenia', 52.0, 88.0, 250, 2.2), ('hulk_tank_alvenia', -8.0, 110.0, 100, 2.4), ('hulk_heli_dravon', 84.0, 140.0, 30, 2.6),
                                  ('hulk_tank_meridon', -96.0, 150.0, 300, 2.6), ('hulk_jeep_korvat', 40.0, 170.0, 170, 2.4), ('hulk_tank_korvat', 120.0, 250.0, 80, 2.8),
                                  ('hulk_artillery_velkar', -150.0, 280.0, 10, 2.8), ('hulk_tank_dravon', -40.0, 330.0, 210, 3.0)):
        L.model(s, name, loc=(x, y, (h(x, y) if y < 190 else -0.3) - 0.2), rot=rt, scale=sc, tint=('rust', 0.6, 'wash'))
    A.rim_units(s, d, c('dust300', 'flash100', 0.4), width=0.3, amount=0.9)

    # ----- Ruinen und tote Baeume in der Ferne / ruins and dead trees in the distance -----
    far = W.MeshB()
    stone = c('mud700', 'smoke700', 0.5)
    for (x, y, ln, fl_, rt) in ((-150, 170, 60, 4, 8), (70, 200, 80, 5, -6), (-60, 260, 90, 6, 4), (180, 300, 110, 6, -10), (-260, 340, 120, 5, 12), (20, 400, 140, 7, 0),
                                (300, 460, 160, 6, -5), (-200, 520, 160, 8, 6), (120, 600, 200, 8, -3), (-420, 640, 220, 7, 5), (440, 700, 240, 9, 0)):
        far.push(x, y, -1.0, rot=rt, scale=1.0 + y / 500.0)
        P.ruin_wall(far, R, ln, fl_, stone, damage=0.55, thick=1.2)
        far.pop()
    for i in range(26):
        x, y = float(R.uniform(-220, 220)), float(R.uniform(50, 330))
        far.push(x, y, h(x, y) if y < 190 else -0.4, scale=1.0 + y / 260.0)
        P.dead_tree(far, R, h=float(R.uniform(5, 9)))
        far.pop()
    far.build(s, 'b03_far', mats, ink=1.2, cam=cam_mid, ink_max=420)

    # ----- Feuer, Rauch, Staub / fire, smoke, dust -----
    fire_at = (-17.0, 41.0, h(-17.0, 41.0) + 0.9)
    fire = P.Fire(s, 'fire', fire_at, width=3.6, height=4.4, n=10, seed=2)
    fire2 = P.Fire(s, 'fire2', (52.0, 88.0, h(52.0, 88.0) + 1.2), width=5.0, height=6.5, n=9, seed=5)
    gl = W.MeshB()
    gl.card((fire_at[0], fire_at[1] - 0.5, fire_at[2] + 1.6), 20, 14, cam_mid, 'fire400', mat=0, alpha=0.5)
    gl.card((52.0, 87.0, h(52.0, 88.0) + 3.0), 30, 22, cam_mid, 'fire400', mat=0, alpha=0.42)
    S.flat_disc(gl, (fire_at[0], fire_at[1] - 2.0, h(fire_at[0], fire_at[1]) + 0.12), 8.0, 'fire400', 0, alpha=0.45)
    gl.build(s, 'fire_glow', [halo], weld=False, shadow=False)
    smoke_atlas = AT.puff_atlas('b03_smoke', (3, 8, 14, 21), c('scorch900', 'mud700', 0.35), c('smoke700', 'mud500', 0.35), rim=c('dust300', 'fire400', 0.35), size=(256, 192), n=8,
                                flat_base=False, light_dir=(0.2, -0.9))
    cols = []
    for k, (x, y, sz, rise, wind, n) in enumerate(((-17.0, 42.0, (1.4, 11.0), 60.0, (22.0, 0.0), 30), (52.0, 89.0, (2.5, 20.0), 110.0, (38.0, 0.0), 30),
                                                    (-80.0, 170.0, (5.0, 34.0), 190.0, (60.0, 0.0), 30), (130.0, 260.0, (8.0, 50.0), 270.0, (85.0, 0.0), 30),
                                                    (-30.0, 380.0, (10.0, 66.0), 340.0, (110.0, 0.0), 28), (-300.0, 520.0, (14.0, 90.0), 430.0, (140.0, 0.0), 26),
                                                    (330.0, 620.0, (16.0, 110.0), 520.0, (170.0, 0.0), 26))):
        tr = AT.Trail(s, 'col%d' % k, smoke_atlas, n=n, size=sz, wind=wind, rise=rise, life=50.0 + 6 * k, alpha=0.97, seed=7 + k, jitter=0.2, fade=0.45, grow=0.75, keep=0.55)
        tr.origin = np.array([x, y, (h(x, y) if y < 190 else 0.0) + 1.0])
        cols.append(tr)
    # Staub: flache weiche Baenke dicht am Boden, in Schichten / dust: flat soft banks close to the ground, in layers
    dimg, duv = AT.puff_atlas('b03_dust', (5, 9, 13), c('dust300', 'mud500', 0.3), c('dust300', 'flash100', 0.3), size=(384, 128), n=10, soft=20.0)
    dust = []
    for k, (y, n, wd, a, v) in enumerate(((17.0, 4, 30.0, 0.22, 1.5), (36.0, 6, 50.0, 0.32, 1.0), (70.0, 7, 90.0, 0.4, 0.7), (130.0, 8, 150.0, 0.46, 0.45), (260.0, 9, 280.0, 0.5, 0.3))):
        items = []
        for i in range(n):
            x = (i + 0.5 - n / 2) * wd * 0.8 + float(R.uniform(-0.3, 0.3)) * wd
            items.append(((x, y + float(R.uniform(-4, 4)), (h(x, y) if y < 190 else -0.4) - wd * 0.03), wd * float(R.uniform(0.8, 1.3)), wd * 0.16 * float(R.uniform(0.7, 1.3)),
                          a * float(R.uniform(0.6, 1.0)), None, duv[i % len(duv)]))
        dust.append(AT.Cards(s, 'dust%d' % k, dimg, items, cam=cam_mid, drift=(v, 0, 0)))
    AT.shafts(s, [((x, 150.0, 80.0), (x - 14.0, 50.0, -2.0), 9.0, 22.0) for x in (-64.0, -24.0, 26.0, 70.0)], c('dust300', 'flash100', 0.5), alpha=0.14)
    embers = AT.Particles(s, 'embers', 70, ((fire_at[0] - 6, fire_at[1] - 3, fire_at[2]), (fire_at[0] + 14, fire_at[1] + 3, fire_at[2] + 13)), (1.6, 0.0, 2.4), (0.04, 0.1),
                          c('fire400', 'yellow400', 0.4), mode='ember', seed=3, sway=0.5)
    ash = AT.Particles(s, 'ash', 220, ((-26, 2, 0), (26, 40, 13)), (0.9, -0.1, -0.7), (0.01, 0.03), c('scorch900', 'mud700', 0.4), mode='flake', seed=5, sway=0.5, alpha=0.9)
    crows = AT.Birds(s, 'crows', 9, (36.0, 150.0, 42.0), 55.0, c('scorch900', 'ink800', 0.5), size=(1.1, 1.7), speed=8.0, seed=4, spread_z=10.0)
    # Muendungsfeuer / muzzle flashes
    mz = W.MeshB()
    muzzles = [(p[0] + 0.78, p[1] - 0.2, p[2] + 1.45) for p in left if kinds[p[3]] == 'soldier'] + [(p[0] - 0.78, p[1] - 0.2, p[2] + 1.45) for p in right + trench if kinds[p[3]] == 'soldier']
    for p in muzzles:
        mz.card(p, 1.3, 1.3, cam_mid, c('flash100', 'yellow400', 0.3), mat=0, alpha=1.0)
    mzo = mz.build(s, 'muzzle', [W.sprite_mat('muzzle', attr_col=True, add=True, shape='disc', keep=0.8)], weld=False, shadow=False)
    mcol = np.empty(len(muzzles) * 16, np.float32)
    mzo.data.color_attributes['Col'].data.foreach_get('color', mcol)
    mcol = mcol.reshape(-1, 4)

    war_sky(s, (0.0, 0.0, 0.0))
    W.haze(s, c('dust300', 'mud500', 0.2), start=20.0, dist=230.0, amount=0.93, hfloor=0.7, hscale=160.0, ink=0.86)

    def update(t):
        u = L.clamp(t / DUR)
        p = 0.6 * u + 0.4 * u * u * (3 - 2 * u)
        pos = cam0.lerp(cam1, p)
        s.look(pos, (pos.x * 0.5 + 1.0, 30.0, 3.5))
        W.clock(t)
        for f in fl:
            f.update(t)
        fire.update(t)
        fire2.update(t)
        for tr in cols:
            tr.update(t + 20.0)
        for dc in dust:
            dc.update(t)
        embers.update(t)
        ash.update(t)
        crows.update(t)
        # Feuerschein flackert / the fire glow flickers
        W.set_alpha(halo, 0.85 + 0.15 * math.sin(t * 23.0) * math.sin(t * 7.3 + 1.0))
        # Muendungsfeuer: jeder Schuetze blitzt kurz in eigenem Takt / muzzle flashes: each rifle flashes briefly at its own beat
        fr = int(round(t * 24))
        a = np.array([1.0 if ((fr + i * 7) % (17 + (i * 5) % 11)) < 2 else 0.0 for i in range(len(muzzles))], np.float32)
        mcol[:, 3] = np.repeat(a, 4)
        mzo.data.color_attributes['Col'].data.foreach_set('color', mcol.ravel())
        mzo.data.update()
    s.on(update)
    return s
