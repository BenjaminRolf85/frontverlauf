"""
B02 (23-25 s): "Grenzen fielen zu." Aufprallbild: ein Schlagbaum schlaegt in seine Gabel, die Kette springt, harte
Speedlines; dahinter der gesperrte Weg mit Wartenden, Wachhaus und Turm im Staub. Kamera: Detail von unten an der
Gabel, leicht gekippt; im Aufschlag ein weisses Bild, zwei Bilder Schwarz auf Weiss mit Speedlines, ein weisses Bild,
danach Wackeln, Staub und die pendelnde Kette.
B02 (23-25 s): "Borders slammed shut." Impact frame: a barrier slams into its fork, the chain jumps, hard speed lines;
behind it the blocked road with people waiting, a guard hut and a tower in dust. Camera: a low detail at the fork,
slightly canted; at the hit one white frame, two frames of black on white with speed lines, one white frame, then
shake, dust and the swinging chain.
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

DUR = 2.0
HIT = 10            # Bildnummer (ab 0) des Aufschlags / frame number (from 0) of the hit
T_HIT = HIT / 24.0
LEN = 9.0


def boom_angle(t):
    """Winkel des Baums in Grad (0 = liegt in der Gabel) / the boom's angle in degrees (0 = rests in the fork)"""
    if t < T_HIT:
        return 74.0 * (1.0 - (t / T_HIT) ** 2.4)
    d = t - T_HIT
    return 4.2 * math.exp(-d * 7.0) * abs(math.sin(d * 19.0))


def build():
    s = L.Shot(DUR)
    c = A.cmix
    R = np.random.default_rng(41)
    s.cam.data.lens = 30
    s.cam.data.clip_start, s.cam.data.clip_end = 0.2, 14000.0
    cam0 = Vector((7.15, -3.9, 0.62))
    look0 = Vector((8.1, 0.0, 1.22))
    s.look(cam0, look0, roll=math.radians(-7))
    sun = (-12.0, 9.0)
    rot, d = A.sun_rot(*sun)
    s.sunlight(rot=tuple(rot))
    lights = (A.lin(c('mud700', 'smoke700', 0.3)), A.lin(c('mud500', 'dust300', 0.5)), tuple(v * 1.12 for v in A.lin(c('dust300', 'flash100', 0.45))[:3]) + (1,))
    s.toon.set_light(*lights)
    s.toon.t1.default_value, s.toon.t2.default_value = 0.08, 0.36
    mats = S.facade_mats(s, glass='scorch900')
    piv = (0.0, 0.0, 1.15)

    # ----- Schlagbaum / barrier -----
    post, boom = W.MeshB(), W.MeshB()
    fx = P.barrier(post, boom, length=LEN)
    ob_post = post.build(s, 'barrier_post', mats, ink=None)
    ob_post.location = piv
    ob_boom = boom.build(s, 'barrier_boom', mats, ink=None)
    ob_boom.location = piv
    L.bpy.context.view_layer.update()
    W.add_ink(s, ob_post, 2.2, tuple(cam0))
    W.add_ink(s, ob_boom, 2.2, tuple(cam0))
    # Kette am Baumende: pendelt / chain at the boom's end: swings
    ch = W.MeshB()
    P.chain(ch, [(0, 0, 0), (0, 0, -0.95)], r=0.05, link=0.13)
    ch.cbox(0, 0, -1.12, 0.16, 0.07, 0.2, c('smoke700', 'ink700', 0.4))
    ob_chain = ch.build(s, 'chain', mats, ink=None)
    W.add_ink(s, ob_chain, 1.2, tuple(cam0))
    # Kette um die Gabel gelegt / chain laid around the fork
    ch2 = W.MeshB()
    P.chain(ch2, [(fx - 0.2, -0.42, 1.2), (fx + 0.05, -0.5, 0.7), (fx + 0.1, -0.42, 0.2), (fx + 0.5, -0.5, 0.03), (fx + 1.2, -0.7, 0.03)], r=0.05, link=0.13)
    ch2.build(s, 'chain2', mats, ink=1.4, cam=tuple(cam0))

    # ----- Strasse, Wachhaus, Zaun, Turm / road, guard hut, fence, tower -----
    area = (-30.0, -14.0, 40.0, 126.0)
    cv = S.Canvas(area, 3072, c('mud500', 'dust300', 0.25))
    cv.wash(c('mud700', 'mud500', 0.4), 0.8, 9, 3, thr=0.54)
    cv.wash(c('dust300', 'mud500', 0.45), 0.7, 14, 7, thr=0.6)
    asph = c('asphalt700', 'mud700', 0.35)
    cv.rect(1.8, -14, 7.2, 126, asph)
    cv.wash(c('asphalt500', 'dust300', 0.3), 0.6, 2.5, 13, thr=0.6, area=(1.8, -14, 7.2, 126))
    for y in np.arange(-14, 126, 5.0):
        cv.rect(4.42, y, 4.58, y + 2.4, A.cmix('paper100', 'dust300', 0.4), 0.8)
    for x in (1.8, 7.05):
        cv.rect(x, -14, x + 0.15, 126, A.cmix('paper100', 'dust300', 0.5), 0.6)
    # Haltelinie und Warnschraffur / stop line and hazard hatching
    cv.rect(1.8, -1.4, 7.2, -1.0, A.cmix('paper100', 'dust300', 0.3), 0.9)
    for k in range(9):
        cv.line((1.9 + k * 0.6, -0.5), (2.5 + k * 0.6, 0.5), 0.2, A.cmix('hazard', 'mud500', 0.3), 0.85)
    cv.wash(c('dust300', 'flash100', 0.5), 1.0, 1.6, 23, thr=0.74, area=(-10, -8, 20, 12))
    kinds = ['woman', 'carry', 'old', 'child', 'stand', 'hat', 'woman', 'carry']
    wait = []
    for i in range(40):
        x, y = float(R.uniform(2.0, 7.0)), float(9.0 + abs(R.normal(0, 1)) * 18 + i * 0.6)
        wait.append((x, y, 0.0, int(R.integers(0, len(kinds)))))
    wait += [(3.4, 6.4, 0.0, 0), (4.0, 6.2, 0.0, 3), (5.6, 7.4, 0.0, 2), (6.5, 8.0, 0.0, 1), (2.6, 8.2, 0.0, 4)]
    sa, ln = math.radians(sun[0]), 1.75 / math.tan(math.radians(sun[1])) * 0.8
    for (x, y, z, k) in wait:
        cv.line((x, y), (x - math.sin(sa) * ln, y - math.cos(sa) * ln), 0.5, c('scorch900', 'mud700', 0.3), 0.6, soft=0.2)
    S.ground(s, lambda x, y: 0.0, (70.0, 140.0), (4, 4), cv.image('b02_ground'), area, name='b02_ground', loc=(5.0, 56.0, 0))
    fc = S.Canvas((-2500.0, 126.0, 2500.0, 5126.0), 512, c('mud500', 'dust300', 0.25))
    fc.wash(c('mud700', 'mud500', 0.4), 0.8, 120, 3, thr=0.52)
    S.ground(s, lambda x, y: -0.05, (5000.0, 5200.0), (8, 8), fc.image('b02_far'), (-2500.0, 126.0, 2500.0, 5126.0), name='b02_farground', loc=(0.0, 2500.0, 0.0))
    atlas = AT.people_atlas('b02_people', kinds, c('scorch900', 'ink800', 0.5), rim=c('dust300', 'flash100', 0.5), seed=4, back=True, rim_px=1.0, cell=(320, 576),
                            flip=[bool(i % 2) for i in range(len(kinds))])
    wait.sort(key=lambda p: -p[1])
    AT.people(s, 'b02_people', atlas, wait, cam=tuple(cam0))

    env = W.MeshB()
    hut = c('olive600', 'smoke700', 0.45)
    env.push(14.5, 9.5, 0.0, rot=-6)
    env.box(-1.6, -1.5, 0, 1.6, 1.5, 2.7, hut, mat=S.MAT['plain'], bay=3.2, floor=2.7, g0=0.2, g1=1.0, top=AR_dark(c))
    env.box(-1.9, -1.8, 2.7, 1.9, 1.8, 2.95, AR_dark(c), bottom=True)
    env.face([(-1.62, -0.7, 1.2), (-1.62, 0.7, 1.2), (-1.62, 0.7, 2.1), (-1.62, -0.7, 2.1)][::-1], c('sky800', 'smoke400', 0.3))
    env.face([(-0.8, -1.52, 1.2), (0.8, -1.52, 1.2), (0.8, -1.52, 2.1), (-0.8, -1.52, 2.1)], c('sky800', 'smoke400', 0.3))
    env.pop()
    # Wachturm / watchtower
    env.push(-7.5, 16.0, 0.0)
    env.ink = 0.5
    for sx in (-1, 1):
        for sy in (-1, 1):
            env.tube((sx * 1.6, sy * 1.6, 0), (sx * 1.2, sy * 1.2, 8.0), 0.12, hut, n=4)
    for z0 in (2.0, 5.0):
        for a_, b_ in (((-1.5, -1.5), (1.4, -1.4)), ((1.5, -1.5), (-1.4, -1.4))):
            env.tube((a_[0], a_[1], z0), (b_[0], b_[1], z0 + 2.8), 0.06, hut, n=4)
    env.ink = 1.0
    env.box(-1.7, -1.7, 8.0, 1.7, 1.7, 9.2, hut)
    env.box(-2.1, -2.1, 10.6, 2.1, 2.1, 10.85, AR_dark(c), bottom=True)
    for sx in (-1.6, 1.6):
        for sy in (-1.6, 1.6):
            env.tube((sx, sy, 9.2), (sx, sy, 10.6), 0.07, hut, n=4)
    env.pop()
    # Zaun mit Stacheldraht zu beiden Seiten / fence with barbed wire on both sides
    P.wire_fence(env, R, [(x, 0.5 + 0.2 * math.sin(x), 0.0) for x in np.arange(fx + 1.0, 40.0, 2.6)], h=2.1, wires=5)
    P.wire_fence(env, R, [(x, 0.6 + 0.2 * math.sin(x), 0.0) for x in np.arange(-30.0, -1.2, 2.6)], h=2.1, wires=5)
    # Verbotsschild / no-entry sign
    env.tube((9.4, 0.9, 0.0), (9.4, 0.9, 2.5), 0.05, AR_dark(c), n=5)
    ring = [(9.4 + 0.45 * math.cos(t), 0.84, 2.5 + 0.45 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
    env.face(ring, 'red500')
    env.face([(9.08, 0.8, 2.42), (9.72, 0.8, 2.42), (9.72, 0.8, 2.58), (9.08, 0.8, 2.58)], 'paper50')
    for i in range(7):
        x, y = float(R.uniform(-60, 70)), float(R.uniform(40, 200))
        if 0 < x < 9:
            continue
        env.push(x, y, 0.0, scale=1.0 + y / 200.0)
        P.dead_tree(env, R, h=float(R.uniform(5, 8)))
        env.pop()
    env.build(s, 'b02_env', mats, ink=1.8, cam=tuple(cam0), ink_max=260)
    far = W.MeshB()
    stone = c('mud700', 'smoke700', 0.5)
    for (x, y, lnn, fl_, rt) in ((-120, 170, 60, 4, 8), (60, 210, 80, 5, -6), (-40, 300, 90, 6, 4), (180, 330, 110, 6, -10), (20, 460, 140, 7, 0)):
        far.push(x, y, -1.0, rot=rt, scale=1.0 + y / 500.0)
        P.ruin_wall(far, R, lnn, fl_, stone, damage=0.55, thick=1.2)
        far.pop()
    far.build(s, 'b02_far', mats, ink=None)

    # ----- Staub / dust -----
    dimg, duv = AT.puff_atlas('b02_dust', (5, 9, 13), c('dust300', 'mud500', 0.3), c('dust300', 'flash100', 0.3), size=(384, 128), n=10, soft=20.0)
    dust = []
    for k, (y, n, wd, a, v) in enumerate(((14.0, 4, 26.0, 0.25, 1.2), (36.0, 6, 50.0, 0.34, 0.8), (90.0, 7, 110.0, 0.42, 0.5), (220.0, 8, 240.0, 0.5, 0.3))):
        items = [(((i + 0.5 - n / 2) * wd * 0.8 + float(R.uniform(-0.3, 0.3)) * wd, y, -wd * 0.03), wd * float(R.uniform(0.8, 1.3)), wd * 0.16, a * float(R.uniform(0.6, 1.0)), None, duv[i % 3])
                 for i in range(n)]
        dust.append(AT.Cards(s, 'dust%d' % k, dimg, items, cam=tuple(cam0), drift=(v, 0, 0)))
    pimg = AT.puff_atlas('b02_burst', (4, 7, 11), c('mud500', 'dust300', 0.4), c('dust300', 'flash100', 0.35), rim=c('flash100', 'dust300', 0.3), size=(256, 192), n=7, flat_base=False)
    burst = AT.Burst(s, 'burst', pimg, (fx, 0.0, 0.95), T_HIT, n=12, life=1.1, reach=1.3, size=(0.06, 0.34), alpha=0.85, seed=3, up=0.5)
    burst2 = AT.Burst(s, 'burst2', pimg, (fx, -0.2, 0.05), T_HIT + 0.04, n=9, life=1.4, reach=1.6, size=(0.08, 0.42), alpha=0.7, seed=5, up=0.15)
    ash = AT.Particles(s, 'ash', 160, ((-4, -3, 0), (16, 22, 9)), (1.2, -0.1, -0.5), (0.008, 0.024), c('scorch900', 'mud700', 0.4), mode='flake', seed=5, sway=0.4, alpha=0.9)

    sky, spec = B03.war_sky(s, (0.0, 0.0, 0.0), name='sky_b02')
    W.haze(s, c('dust300', 'mud500', 0.2), start=10.0, dist=150.0, amount=0.93, hfloor=0.7, hscale=160.0, ink=0.86)
    # Aufprallbild: weisse Flaeche und Speedlines vor der Kamera / impact frame: a white plane and speed lines in front of the camera
    white = L.cam_plane(s, L.flat('white', name='b02_white'), dist=0.25, scale=1.3, name='white')
    white.visible_shadow = False
    lines = L.speed_lines(s, n=64, dist=0.3, seed=7, inner=0.28, color='ink')
    lines.visible_shadow = False
    hz = W.haze_group().nodes['color'].outputs[0]
    hz0 = tuple(hz.default_value)

    def update(t):
        fr = int(round(t * 24))
        th = boom_angle(t)
        ob_boom.rotation_euler = (0, -math.radians(th), 0)
        tip = Vector(piv) + Vector((math.cos(math.radians(th)) * (LEN - 1.6), 0.0, math.sin(math.radians(th)) * (LEN - 1.6) - 0.11))
        ob_chain.location = tip
        dsw = max(0.0, t - T_HIT)
        ob_chain.rotation_euler = (0, math.radians(th * 0.3) + 0.55 * math.exp(-dsw * 2.2) * math.sin(dsw * 9.0) * (t > T_HIT), 0.25 * math.exp(-dsw * 2.0) * math.sin(dsw * 7.0))
        # Kamera: wartet, zuckt beim Aufschlag, rueckt danach etwas nach / camera: waits, jolts at the hit, then creeps in
        k = L.ease_out(L.clamp(dsw / 1.4))
        pos = cam0.lerp(cam0 + (look0 - cam0) * 0.07, k) + L.shake(t, T_HIT, 0.16, decay=6.0)
        s.look(pos, look0 + L.shake(t, T_HIT, 0.1, decay=6.0), roll=math.radians(-7 + 2.0 * math.exp(-dsw * 5.0) * math.sin(dsw * 30.0) * (t > T_HIT)))
        phase = fr - HIT
        L.hide(white, phase not in (0, 3))
        L.hide(lines, phase not in (1, 2))
        if phase in (1, 2):
            # Schwarz auf Weiss: alle Flaechen schwarz, Himmel und Dunst weiss / black on white: all faces black, sky and haze white
            s.toon.set_light((0, 0, 0, 1), (0, 0, 0, 1), (0, 0, 0, 1))
            AT.sky_tint(sky, (30, 30, 30))
            hz.default_value = (1, 1, 1, 1)
            lines.scale = (1.0, 1.0, 1.0) if phase == 1 else (1.12, 1.12, 1.0)
            lines.rotation_euler = (0, 0, 0.0 if phase == 1 else 0.05)
        else:
            s.toon.set_light(*lights)
            AT.sky_tint(sky, (1, 1, 1))
            hz.default_value = hz0
        W.clock(t)
        for dc in dust:
            dc.update(t)
        burst.update(t)
        burst2.update(t)
        ash.update(t)
    s.on(update)
    return s


def AR_dark(c):
    return c('char800', 'smoke700', 0.3)
