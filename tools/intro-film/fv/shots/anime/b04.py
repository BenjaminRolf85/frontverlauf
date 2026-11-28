"""
B04 (31-35 s): "Millionen verloren alles, was sie hatten." Der Ort fuer das Kind: ein Aschefeld in einer Ruine. An der
Mauer eine Kinderzeichnung in Kreide (Haus, Sonne, Menschen), davor im Schutt ein Holzpferd, in der Asche ein Stueck
Kreide in einem Lichtfleck; Asche faellt. Kamera: halbnah, langsame Zufahrt auf die Kreide (dort greift spaeter die
Hand des Kindes).
B04 (31-35 s): "Millions lost everything they had." The place for the child: an ash field in a ruin. On the wall a
child's chalk drawing (house, sun, people), a wooden horse in the rubble before it, a piece of chalk in the ash in a
patch of light; ash falls. Camera: medium close, a slow push towards the chalk (the child's hand will reach there).

Das Kind kommt aus dem Figuren-Baukasten; sein Platz ist links der Kreide (CHILD). / the child comes from the
character kit; its place is left of the chalk (CHILD).
"""
import math

import numpy as np
from mathutils import Vector

from ... import anime as A
from ... import atmo as AT
from ... import lib as L
from ... import props as P
from ... import scenery as S
from ... import world as W
from . import b03 as B03

DUR = 4.0
CHALK = (0.55, 0.0, 0.0)
CHILD = (-0.55, 0.35, 0.0)   # Standpunkt des Kindes (Sohlen) / where the child stands (soles)


def chalk_wall(name='b04_wall'):
    """Mauerstueck mit Putz, Rissen und der Kreidezeichnung / a piece of wall with render, cracks and the chalk drawing"""
    c = A.cmix
    area = (-4.0, 0.0, 4.0, 3.2)
    cv = S.Canvas(area, 2048, c('mud700', 'smoke400', 0.45))
    cv.wash(c('smoke700', 'mud700', 0.5), 0.6, 0.8, 3, thr=0.55)
    cv.wash(c('smoke400', 'dust300', 0.4), 0.5, 1.3, 7, thr=0.6)
    # Ziegel, wo der Putz fehlt / bricks where the render is gone
    for (x0, y0, x1, y1) in ((-4.0, 0.0, -2.6, 0.9), (2.3, 1.9, 4.0, 3.2), (1.2, 0.0, 2.2, 0.5)):
        cv.rect(x0, y0, x1, y1, c('rust', 'mud700', 0.5), 0.9)
        for j, y in enumerate(np.arange(y0, y1, 0.14)):
            cv.rect(x0, y, x1, y + 0.02, c('mud700', 'scorch900', 0.4), 0.8)
            for x in np.arange(x0 + (0.16 if j % 2 else 0.0), x1, 0.32):
                cv.rect(x, y, x + 0.02, y + 0.14, c('mud700', 'scorch900', 0.4), 0.8)
    for (p0, p1) in (((-1.9, 3.2), (-1.5, 2.3)), ((-1.5, 2.3), (-1.7, 1.6)), ((3.1, 0.0), (2.8, 0.9)), ((2.8, 0.9), (3.0, 1.5))):
        cv.line(p0, p1, 0.03, c('scorch900', 'mud700', 0.3), 0.9)
    cv.wash(c('scorch900', 'mud700', 0.3), 0.55, 1.0, 13, thr=0.5, area=(-4.0, 0.0, 4.0, 0.7))
    ch = A.cmix('chalk', 'paper50', 0.5)
    w = 0.035
    # Haus / house
    cv.poly([(-1.0, 0.75), (-1.0, 1.5), (0.0, 1.5), (0.0, 0.75), (-1.0, 0.75)], w, ch, 0.92)
    cv.poly([(-1.12, 1.48), (-0.5, 2.0), (0.12, 1.48)], w, ch, 0.92)
    cv.poly([(-0.62, 0.75), (-0.62, 1.15), (-0.38, 1.15), (-0.38, 0.75)], w, ch, 0.9)
    cv.poly([(-0.9, 1.15), (-0.9, 1.35), (-0.72, 1.35), (-0.72, 1.15), (-0.9, 1.15)], w * 0.8, ch, 0.9)
    cv.poly([(-0.25, 1.82), (-0.25, 2.1), (-0.12, 2.1), (-0.12, 1.7)], w * 0.8, ch, 0.9)
    # Sonne / sun
    cv.disc((1.3, 2.35), 0.24, ch, 0.92, ring=0.035)
    for k in range(10):
        a = k * math.pi / 5
        cv.line((1.3 + 0.32 * math.cos(a), 2.35 + 0.32 * math.sin(a)), (1.3 + 0.5 * math.cos(a), 2.35 + 0.5 * math.sin(a)), w * 0.8, ch, 0.9)
    # drei Menschen, Hand in Hand / three people, hand in hand
    for (x, hgt) in ((0.55, 0.62), (0.95, 0.72), (1.38, 0.44)):
        y0 = 0.75
        cv.disc((x, y0 + hgt), 0.085, ch, 0.92, ring=0.03)
        cv.line((x, y0 + hgt - 0.085), (x, y0 + hgt * 0.42), w * 0.8, ch, 0.9)
        cv.line((x, y0 + hgt * 0.42), (x - 0.09, y0), w * 0.8, ch, 0.9)
        cv.line((x, y0 + hgt * 0.42), (x + 0.09, y0), w * 0.8, ch, 0.9)
        cv.line((x - 0.2, y0 + hgt * 0.62), (x + 0.2, y0 + hgt * 0.62), w * 0.8, ch, 0.9)
    cv.line((-1.6, 0.74), (1.9, 0.74), w, ch, 0.8)
    return cv.image(name), area


def build():
    s = L.Shot(DUR)
    c = A.cmix
    R = np.random.default_rng(51)
    s.cam.data.lens = 40
    s.cam.data.clip_start, s.cam.data.clip_end = 0.1, 14000.0
    cam0, cam1 = Vector((0.9, -5.2, 1.25)), Vector((0.8, -2.7, 0.8))
    look0, look1 = Vector((0.1, 1.5, 0.75)), Vector((0.42, 0.5, 0.3))
    s.look(cam0, look0)
    rot, d = A.sun_rot(38.0, 34.0)
    s.sunlight(rot=tuple(rot))
    s.toon.set_light(A.lin(c('mud700', 'smoke700', 0.45)), A.lin(c('smoke400', 'mud500', 0.4)), tuple(v * 1.05 for v in A.lin(c('dust300', 'paper50', 0.4))[:3]) + (1,))
    s.toon.t1.default_value, s.toon.t2.default_value = 0.2, 0.45
    mats = S.facade_mats(s, glass='scorch900')

    # ----- Boden: Asche mit Spuren, Schutt, Lichtfleck / ground: ash with tracks, rubble, a patch of light -----
    area = (-14.0, -8.0, 14.0, 20.0)
    cv = S.Canvas(area, 4096, c('smoke400', 'smoke300', 0.45))
    cv.wash(c('ash600', 'smoke400', 0.4), 0.75, 1.6, 3, thr=0.55)
    cv.wash(c('smoke300', 'paper100', 0.3), 0.6, 2.4, 7, thr=0.62)
    cv.wash(c('ash600', 'scorch900', 0.3), 0.6, 0.7, 11, thr=0.68)
    cv.flecks(1500, (0.012, 0.06), c('scorch900', 'ash600', 0.2), 5, alpha=0.9, area=(-6, -6, 6, 6))
    cv.flecks(700, (0.01, 0.045), c('smoke300', 'paper50', 0.3), 6, alpha=0.85, area=(-6, -6, 6, 6))
    # kleine Fussspuren zur Mauer / small footprints towards the wall
    for i in range(9):
        t = i / 8.0
        x, y = -2.6 + 2.0 * t + 0.07 * (1 if i % 2 else -1), -4.6 + 4.9 * t
        cv.disc((x, y), 0.075, c('scorch900', 'ash600', 0.35), 0.75, squash=1.7)
    # Lichtfleck um die Kreide / the patch of light around the chalk
    cv.disc((CHALK[0], CHALK[1] + 0.1), 1.3, c('paper100', 'dust300', 0.3), 0.75, soft=0.8, squash=0.7)
    cv.disc((CHALK[0], CHALK[1] + 0.05), 0.55, c('paper50', 'paper100', 0.3), 0.7, soft=0.35, squash=0.7)
    # zerbrochene Schiefertafel mit Strichen: darauf liegt die Kreide / a broken slate with strokes: the chalk lies on it
    sl = c('ink700', 'smoke700', 0.5)
    for k in range(9):
        cv.line((CHALK[0] - 0.24, -0.16 + k * 0.04), (CHALK[0] + 0.26 - 0.03 * (k % 3), -0.16 + k * 0.04), 0.045, sl, 0.97)
    for k in range(4):
        cv.line((CHALK[0] - 0.17 + k * 0.045, 0.07), (CHALK[0] - 0.165 + k * 0.045, 0.15), 0.012, A.cmix('chalk', 'paper50', 0.5), 0.9)
    cv.line((CHALK[0] - 0.19, 0.09), (CHALK[0] - 0.01, 0.13), 0.012, A.cmix('chalk', 'paper50', 0.5), 0.9)
    # Kreidestaub neben dem Stueck / chalk dust beside the piece
    cv.line((CHALK[0] - 0.16, 0.03), (CHALK[0] + 0.2, -0.05), 0.045, A.cmix('chalk', 'paper50', 0.5), 0.6, soft=0.03)
    h = P.war_height([(-6.5, 3.0, 2.6, 0.5), (6.0, -2.0, 2.2, 0.4)], [], amp=0.1, freq=0.4, seed=3, flat=(-3.0, 3.0))
    S.ground(s, h, (28.0, 28.0), (112, 112), cv.image('b04_ground'), area, name='b04_ground', loc=(0.0, 6.0, 0))
    fc = S.Canvas((-600.0, 20.0, 600.0, 1220.0), 512, c('ash600', 'mud500', 0.4))
    fc.wash(c('scorch900', 'ash600', 0.4), 0.7, 40, 3, thr=0.55)
    S.ground(s, lambda x, y: -0.1, (1200.0, 1200.0), (6, 6), fc.image('b04_far'), (-600.0, 20.0, 600.0, 1220.0), name='b04_far', loc=(0.0, 620.0, 0.0))

    # ----- Ruine: Mauer mit der Zeichnung, Fensterhoehlen, Balken / ruin: the wall with the drawing, window holes, beams -----
    wimg, warea = chalk_wall()
    mb = W.MeshB()
    stone = c('mud700', 'smoke400', 0.45)
    # die Zeichnungswand: eigene Flaeche mit gemaltem Bild / the drawing wall: its own face with the painted picture
    wy = 2.6
    mb.box(-4.0, wy, 0.0, 4.0, wy + 0.55, 3.2, stone, sides='new', g0=0.3, g1=1.0)
    jag = [(-4.0, 3.2), (-3.2, 3.9), (-2.4, 3.5), (-1.6, 4.6), (-0.6, 4.2), (0.3, 5.4), (1.0, 4.9), (1.8, 5.8), (2.6, 4.4), (3.3, 4.8), (4.0, 3.6)]
    for (xa, za), (xb, zb) in zip(jag[:-1], jag[1:]):
        mb.face([(xa, wy, 3.2), (xb, wy, 3.2), (xb, wy, zb), (xa, wy, za)], stone)
        mb.face([(xb, wy + 0.55, 3.2), (xa, wy + 0.55, 3.2), (xa, wy + 0.55, za), (xb, wy + 0.55, zb)], stone)
        mb.face([(xa, wy, za), (xb, wy, zb), (xb, wy + 0.55, zb), (xa, wy + 0.55, za)], c('smoke400', 'dust300', 0.4))
    mb.push(4.0, wy, 0.0, rot=90)
    P.ruin_wall(mb, R, 9.0, 3, stone, bay=3.0, fh=3.0, thick=0.55, damage=0.5, peak=0.15)
    mb.pop()
    mb.push(-12.5, wy + 5.0, 0.0, rot=4)
    P.ruin_wall(mb, R, 8.5, 2, stone, bay=2.8, fh=3.0, thick=0.55, damage=0.7, peak=0.9)
    mb.pop()
    # verkohlte Balken / charred beams
    beam = c('char800', 'scorch900', 0.4)
    for (a_, b_, r_) in (((-3.9, 2.2, 0.1), (-2.9, 2.5, 2.6), 0.11), ((3.2, 1.9, 0.05), (3.9, 2.5, 2.4), 0.1), ((-5.5, 0.6, 0.1), (-2.8, 1.6, 0.25), 0.1), ((2.0, 2.2, 0.08), (3.6, 1.4, 0.2), 0.09)):
        mb.tube(a_, b_, r_, beam, n=4)
    for (x, y, n, sp) in ((-3.2, 1.9, 16, 1.4), (2.9, 2.0, 14, 1.2), (-1.0, 2.3, 8, 0.8), (4.6, -0.6, 10, 1.4), (-5.6, -1.2, 10, 1.6), (0.6, 2.35, 6, 0.6)):
        P.rubble(mb, R, x, y, h(x, y), n, c('mud700', 'smoke400', 0.4), spread=sp, size=(0.07, 0.3))
    # Holzpferd im Schutt / wooden horse in the rubble
    hx, hy = -1.55, 1.45
    wood, wd2 = c('timber', 'paper300', 0.35), c('timber', 'ink700', 0.3)
    mb.push(hx, hy, h(hx, hy) + 0.02, rot=-28)
    mb.push(0, 0, 0.0, rot=0)
    mb.box(-0.2, -0.05, 0.2, 0.2, 0.05, 0.36, wood, bottom=True)
    for lx in (-0.16, 0.14):
        mb.box(lx, -0.04, 0.03, lx + 0.045, 0.04, 0.2, wood)
    mb.face([(0.12, -0.045, 0.34), (0.2, -0.045, 0.34), (0.3, -0.045, 0.55), (0.34, -0.045, 0.5), (0.26, -0.045, 0.62), (0.16, -0.045, 0.56)], wood)
    mb.face([(0.12, 0.045, 0.34), (0.16, 0.045, 0.56), (0.26, 0.045, 0.62), (0.34, 0.045, 0.5), (0.3, 0.045, 0.55), (0.2, 0.045, 0.34)], wood)
    mb.ink = 0.5
    mb.tube((-0.2, 0, 0.33), (-0.3, 0, 0.2), 0.012, wd2, n=4)
    for sy in (-0.07, 0.07):
        for wx in (-0.14, 0.16):
            ring = [(wx + 0.045 * math.cos(t), sy, 0.045 + 0.045 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 9, endpoint=False)]
            mb.face(ring if sy < 0 else ring[::-1], 'red700')
    mb.ink = 1.0
    mb.box(-0.24, -0.07, 0.0, 0.26, 0.07, 0.035, wd2)
    mb.pop()
    mb.pop()
    # die Kreide: ein kurzes weisses Stueck / the chalk: a short white piece
    mb.push(CHALK[0], CHALK[1], h(CHALK[0], CHALK[1]) + 0.012, rot=24)
    mb.tube((-0.065, 0, 0.0), (0.065, 0, 0.005), 0.014, A.cmix('chalk', 'white', 0.6), n=7, emit=0.7)
    mb.pop()
    ob = mb.build(s, 'b04_ruin', mats, ink=1.5, cam=tuple(cam0))
    # Zeichnung als eigene Flaeche knapp vor der Mauer / the drawing as its own face just in front of the wall
    dw = W.MeshB()
    dw.card((0.0, wy - 0.012, 1.6), 8.0, 3.2, (0.0, wy - 100.0, 1.6), (1, 1, 1), mat=0, up=(0, 0, 1))
    dw.build(s, 'b04_drawing', [W.sprite_mat('b04_drawing', tex=wimg)], weld=False, shadow=False)
    # ferne Ruinen / far ruins
    far = W.MeshB()
    for (x, y, lnn, fl_, rt) in ((-40, 40, 30, 4, 8), (24, 54, 40, 5, -6), (-14, 90, 60, 6, 4), (70, 110, 70, 6, -10), (-90, 130, 80, 5, 12), (10, 190, 120, 7, 0)):
        far.push(x, y, -0.5, rot=rt, scale=1.0 + y / 220.0)
        P.ruin_wall(far, R, lnn, fl_, c('mud700', 'smoke700', 0.5), damage=0.55, thick=1.2)
        far.pop()
    for i in range(8):
        x, y = float(R.uniform(-40, 40)), float(R.uniform(16, 70))
        far.push(x, y, 0.0, scale=1.0 + y / 90.0)
        P.dead_tree(far, R, h=float(R.uniform(4, 7)))
        far.pop()
    far.build(s, 'b04_far', mats, ink=1.0, cam=tuple(cam0), ink_max=140)

    # ----- Licht, Rauch, Asche / light, smoke, ash -----
    AT.shafts(s, [((CHALK[0] + 4.2, 3.0, 7.5), (CHALK[0] - 0.1, 0.1, 0.0), 0.9, 1.8), ((CHALK[0] + 5.2, 3.4, 7.5), (CHALK[0] + 0.9, 0.6, 0.0), 0.5, 1.0)], c('dust300', 'paper50', 0.5),
              alpha=0.2)
    smoke_atlas = AT.puff_atlas('b04_smoke', (3, 8, 14, 21), c('ash600', 'scorch900', 0.3), c('smoke400', 'ash600', 0.4), size=(256, 192), n=8, flat_base=False, soft=3.0)
    wisps = []
    for k, (x, y, sz, rise, wind) in enumerate(((-3.0, 2.0, (0.1, 1.1), 5.0, (1.6, 0.2)), (3.2, 2.2, (0.1, 0.9), 4.5, (1.3, 0.3)), (-16.0, 34.0, (1.5, 9.0), 40.0, (16.0, 0.0)),
                                                 (22.0, 60.0, (2.5, 14.0), 60.0, (24.0, 0.0)))):
        tr = AT.Trail(s, 'wisp%d' % k, smoke_atlas, n=14 if k < 2 else 22, size=sz, wind=wind, rise=rise, life=9.0 if k < 2 else 40.0, alpha=0.5 if k < 2 else 0.9, seed=3 + k,
                      fade=1.0, keep=0.4)
        tr.origin = np.array([x, y, 0.2])
        wisps.append(tr)
    ash = AT.Particles(s, 'ash', 320, ((-5, -5.5, 0), (6, 6, 5.5)), (0.25, -0.05, -0.45), (0.006, 0.02), c('smoke300', 'ash600', 0.45), mode='flake', seed=5, sway=0.3, alpha=0.9)
    ash2 = AT.Particles(s, 'ash2', 120, ((-5, -5.5, 0), (6, 6, 5.5)), (0.25, -0.05, -0.4), (0.006, 0.016), c('scorch900', 'ash600', 0.3), mode='flake', seed=8, sway=0.3, alpha=0.9)
    sky, spec = B03.war_sky(s, (0.0, 0.0, 0.0), name='sky_b04')
    AT.sky_tint(sky, (0.8, 0.82, 0.86))
    W.haze(s, c('smoke400', 'dust300', 0.4), start=6.0, dist=70.0, amount=0.9, hfloor=0.7, hscale=40.0, ink=0.8)

    def update(t):
        u = L.clamp(t / DUR)
        p = 0.25 * u + 0.75 * L.ease_io(u)
        s.look(cam0.lerp(cam1, p), look0.lerp(look1, p))
        W.clock(t)
        for tr in wisps:
            tr.update(t + 10.0)
        ash.update(t)
        ash2.update(t)
    s.on(update)
    return s
