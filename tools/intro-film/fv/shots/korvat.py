"""
10 Korvat (76-83 s): Steppensturm. Die Steppenreiter galoppieren auf die Kamera zu, dahinter Panzer und rote Fahnen,
Gewitterwolken, ein Blitz, am Ende Speedlines.
10 Korvat (76-83 s): Steppe Storm. The steppe riders gallop towards the camera, behind them tanks and red flags,
storm clouds, a lightning strike, speed lines at the end.
"""
import math
import random

from mathutils import Vector

from .. import kit as K
from .. import lib as L


def build():
    s = L.Shot(L.shot_dur('korvat'))
    R = random.Random(71)
    s.toon.set_light((0.36, 0.36, 0.4, 1), (0.66, 0.66, 0.66, 1), (1.0, 0.96, 0.88, 1))
    s.sunlight(rot=(0.7, 0.15, 2.6))
    L.sky(s, [(-1, 'steppe500'), (0.0, 'smoke400'), (0.2, 'smoke700'), (1, 'ink800')])
    h = K.hills(2.5, 0.018, 3)
    L.ground(s, 'steppe300', size=1000, sub=60, height=h)
    s.cam.data.lens = 26
    riders = []
    for i in range(9):
        x, y = (i % 5 - 2) * 9 + R.uniform(-2, 2), 30 + (i // 5) * 14 + R.uniform(-3, 3)
        ob = L.model(s, 'steppeRider_korvat', loc=(x, y, 0), rot=R.uniform(-6, 6), scale=2.0)
        riders.append((ob, Vector((x, y, 0)), R.uniform(0, 6)))
    tanks = [L.model(s, 'tank_korvat', loc=(x, y, 0), rot=R.uniform(-5, 5), scale=2.2) for x, y in ((-30, 80), (26, 90), (-4, 110))]
    tank0 = [Vector(t.location) for t in tanks]
    storm = L.model(s, 'stormbreaker_korvat', loc=(40, 70, 0), rot=-20, scale=2.0)
    flags = [K.flag(s, 'korvatRed', (x, y, h(x, y)), w=7, h=4.5, pole=16, stripe='korvatOlive') for x, y in ((-46, 70), (52, 96))]
    K.clouds(s, 14, (-300, 300, 160, 520), 70, color='smoke700', scale=(60, 110), seed=7)
    bolt = K.arc(s, (60, 400, 140), (40, 380, 0), n=8, color='flash', jitter=10, radius=0.9)
    dust = [L.Puffs(s, 5, 'dust300', (0, 0, 0), spread=1.5, rise=3, size=(1.5, 3.0), life=1.0, seed=k) for k in range(4)]
    speed = L.speed_lines(s, n=48, dist=2.0, inner=0.42)

    @s.on
    def update(t):
        run = t * 16
        for ob, base, ph in riders:
            p = base + Vector((0, -run, 0))
            p.z = h(p.x, p.y) + abs(math.sin(t * 9 + ph)) * 0.9
            ob.location = p
            ob.rotation_euler.x = math.sin(t * 9 + ph) * 0.06
        for k, d in enumerate(dust):
            ob, base, ph = riders[k * 2]
            d.origin = ob.location + Vector((0, 4, 0.5))
            d.update(t)
        for tk, b in zip(tanks, tank0):
            p = b + Vector((0, -t * 9, 0))
            p.z = h(p.x, p.y)
            tk.location = p
        for f, wave in flags:
            wave(t, 1.4)
        bolt(t, on=2.9 < t < 3.2 or 5.0 < t < 5.15)
        L.hide(speed, t < 4.6)
        p = L.ease_io(L.seg(t, 0, s.dur))
        cam = Vector((4 - 6 * p, -26 - run * 0.92, 5.5 + 1.5 * p))
        cam.z += h(cam.x, cam.y)
        s.look(cam + L.shake(t, 3.0, 0.4, 5), Vector((0, cam.y + 60, 4 + h(0, cam.y + 60))))

    update(0)
    return s
