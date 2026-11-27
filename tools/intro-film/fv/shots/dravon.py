"""
12 Dravon (90-97 s): Betonbunker am Hang, Sandsaecke, Geschuetz feuert, Minenfeld blinkt, ein Kultbuggy faehrt auf eine
Mine. Eiserner Drill: Soldaten in Reihe.
12 Dravon (90-97 s): concrete bunkers on the slope, sandbags, the gun fires, the minefield blinks, a cult buggy drives
onto a mine. Iron drill: soldiers in a row.
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L

SHOTS = (1.2, 2.6, 4.0)
MINE_HIT = 5.0


def build():
    s = L.Shot(L.shot_dur('dravon'))
    R = random.Random(91)
    s.toon.set_light((0.4, 0.38, 0.38, 1), (0.74, 0.72, 0.64, 1), (1.0, 0.96, 0.86, 1))
    s.sunlight(rot=(0.85, 0.15, -2.0))
    L.sky(s, [(-1, 'desert300'), (0.0, 'dust300'), (0.2, 'hazeDay'), (1, 'sky700')])

    def h(x, y):
        return max(0.0, (y - 10) * 0.12) + 1.2 * math.sin(x * 0.05) * math.cos(y * 0.04)
    # trockenes Gras: Mischung zweier Tokens / dry grass: a mix of two tokens
    L.ground(s, L.mix(L.rgb('khaki500'), L.rgb('grass400'), 0.3), size=800, sub=60, height=h)
    s.cam.data.lens = 30
    gun_rot = -38
    emps = []
    for x, y, r in ((0, 40, gun_rot), (-34, 50, -30), (34, 46, -45)):
        emps.append(L.model(s, 'emplacement_dravon', loc=(x, y, h(x, y) - 0.3), rot=r, scale=3.0))
    rot = Euler((0, 0, math.radians(gun_rot)))
    muzzle = emps[0].location + (Vector((0, -0.6, 0.163)) * 10 * 3.0) @ rot.to_matrix().transposed()
    for i in range(10):
        a = -0.9 + i * 0.2
        L.model(s, 'sandbags', loc=(math.sin(a) * 18, 40 - math.cos(a) * 14, h(0, 28)), rot=math.degrees(-a), scale=5)
    # Reihe naeher an der Kamera und enger, damit die Soldaten gross genug im Bild stehen / row closer to the camera and tighter so the soldiers stand large enough in frame
    troops = K.unit_row(s, 'infantry_dravon', 6, (-12, 18, 0), (6.5, -1.6, 0), rot=-38, scale=1.6, seed=5)
    for tr in troops:
        tr.location.z = h(tr.location.x, tr.location.y)
    mines = []
    for i in range(16):
        x, y = R.uniform(-50, 50), R.uniform(-30, 8)
        mines.append((L.model(s, 'mine_dravon', loc=(x, y, h(x, y)), rot=R.uniform(0, 360), scale=3.0), R.uniform(0, 6)))
    buggy = L.model(s, 'doomBuggy_vesper', loc=(-60, -10, 0), rot=90, scale=2.2)
    target_mine = Vector((-6, -12, h(-6, -12)))
    flashes = [L.prim(s, 'ico', L.flat('fireHot'), loc=muzzle, size=1, sub=1, px=0.4) for _ in SHOTS]
    shells = [L.prim(s, 'uv', L.flat('tracer'), loc=muzzle, size=0.8, segments=8, px=1) for _ in SHOTS]
    fdir = Vector((math.sin(math.radians(gun_rot)), -math.cos(math.radians(gun_rot)), 0))
    impacts = [K.Boom(s, at + 0.7, emps[0].location + fdir * (110 + 15 * k) + Vector((R.uniform(-10, 10), 0, 0)), size=10, seed=k, n=5) for k, at in enumerate(SHOTS)]
    mine_boom = K.Boom(s, MINE_HIT, target_mine + Vector((0, 0, 2)), size=12, seed=9, n=7)
    gun = emps[0]
    gun0 = Vector(gun.location)

    @s.on
    def update(t):
        recoil = 0.0
        for k, at in enumerate(SHOTS):
            d = t - at
            on = 0 <= d < 0.18
            flashes[k].scale = (6 * (1 - d / 0.18),) * 3 if on else (0.001,) * 3
            recoil += math.exp(-max(d, 0) * 10) * (1 if d >= 0 else 0)
            sp = muzzle + fdir * 160 * d
            shells[k].location = sp
            L.hide(shells[k], not (0 < d < 0.7))
            impacts[k].update(t)
        gun.location = gun0 - fdir * 0.6 * recoil
        for mn, ph in mines:
            mn['glowoff'] = 0.0 if int(t * 3 + ph) % 2 else 1.0
            mn.update_tag()
        bp = L.seg(t, 0, MINE_HIT)
        pos = Vector((-60, -10, 0)).lerp(target_mine, bp)
        pos.z = h(pos.x, pos.y)
        if t > MINE_HIT:
            dd = t - MINE_HIT
            pos = target_mine + Vector((6 * dd, 0, 18 * dd - 15 * dd * dd))
            buggy.rotation_euler = Euler((dd * 4, dd * 2, math.radians(90)))
        buggy.location = pos
        L.hide(buggy, t > MINE_HIT + 2.2)
        mine_boom.update(t)
        p = L.ease_io(L.seg(t, 0, s.dur))
        cam = L.vlerp((40, -12, 6), (32, -24, 8), p)
        s.look(cam + L.shake(t, SHOTS[0], 0.5, 6) + L.shake(t, SHOTS[1], 0.5, 6) + L.shake(t, SHOTS[2], 0.5, 6) + L.shake(t, MINE_HIT, 1.2, 4),
               L.vlerp((-6, 24, 6), (-22, 0, 6), p))

    update(0)
    return s
