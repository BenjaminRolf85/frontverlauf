"""
6 Die Glocke (46-52 s): Glockenturm in einem Dorf in der Abenddaemmerung. Die Glocke beginnt von selbst zu schwingen,
Schallringe laufen ueber das Land.
6 The bell (46-52 s): bell tower in a village at dusk. The bell starts to swing by itself, sound rings run across the land.
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L


def build():
    s = L.Shot(L.shot_dur('bell'))
    R = random.Random(41)
    s.toon.set_light((0.3, 0.26, 0.42, 1), (0.6, 0.5, 0.6, 1), (1.0, 0.86, 0.72, 1))
    s.sunlight(rot=(1.3, 0.0, 1.0))
    L.sky(s, [(-1, 'skyDusk'), (0.0, 'sunDusk'), (0.12, 'skyDusk'), (0.6, 'skyMid'), (1, 'skyHigh')], stars=0.3)
    h = K.hills(2.0, 0.025, 1)
    L.ground(s, 'grass600', size=800, sub=50, height=h)
    tower = L.model(s, 'bell_tower', loc=(0, 0, h(0, 0) - 0.2), scale=5.0)
    # Glocke im Glockenstuhl / bell in the belfry
    pivot = L.prim(s, 'cube', L.toon(s, 'ink700'), loc=(0, 0, 22.2), size=0.3, ink=False)
    bell = L.prim(s, 'cyl', L.toon(s, 'brass400'), loc=(0, 0, -1.4), size=(2.6, 2.6, 2.4), segments=14, top=0.28)
    bell.parent = pivot
    clap = L.prim(s, 'uv', L.toon(s, 'ink700'), loc=(0, 0, -2.8), size=0.7, segments=8)
    clap.parent = pivot
    for i in range(14):
        a = R.uniform(0, 6.28)
        r = R.uniform(22, 70)
        x, y = math.cos(a) * r, math.sin(a) * r + 20
        L.model(s, 'house_red', loc=(x, y, h(x, y)), rot=R.uniform(0, 360), scale=5.5)
    for i in range(24):
        a = R.uniform(0, 6.28)
        r = R.uniform(30, 120)
        x, y = math.cos(a) * r, math.sin(a) * r + 40
        L.model(s, 'leafy_%d' % (i % 2), loc=(x, y, h(x, y)), rot=R.uniform(0, 360), scale=R.uniform(4, 6))
    rings = [L.ring(s, L.flat('hazard'), (0, 0, 21), radius=1, tube=0.007, rot=(math.pi / 2, 0, 0)) for _ in range(5)]
    rings_h = [L.ring(s, L.flat('accent'), (0, 0, 1), radius=1, tube=0.012) for _ in range(3)]

    @s.on
    def update(t):
        amp = 0.55 * L.seg(t, 0.5, 2.0)
        sw = math.sin((t - 0.5) * 3.4) * amp
        pivot.rotation_euler = Euler((sw, 0, 0))
        clap.location = (0, math.sin((t - 0.5) * 3.4 - 0.6) * amp * 1.2, -2.8)
        for i, rg in enumerate(rings):
            at = 1.2 + i * 0.9
            d = t - at
            on = 0 < d < 2.0
            r = 3 + d * 30
            rg.scale = (max(r, 0.01),) * 3
            rg.location = (0, 0, 21)
            rg.rotation_euler = Euler((math.pi / 2, 0, s.cam.rotation_euler.z))
            L.hide(rg, not on)
        for i, rg in enumerate(rings_h):
            at = 1.5 + i * 1.4
            d = t - at
            on = 0 < d < 3.0
            rg.scale = (max(10 + d * 70, 0.01),) * 2 + (1,)
            rg.location = (0, 0, h(0, 0) + 1.5)
            L.hide(rg, not on)
        p = L.ease_io(L.seg(t, 0, s.dur))
        s.look(L.vlerp((10, -48, 4), (6, -36, 8), p), (0, 0, 17 + 3 * p))

    update(0)
    return s
