"""
4 Der Himmel brennt (32-38 s): Nachthimmel ueber der Wueste faerbt sich rot, das Mutterschiff der Zyrr stuerzt
brennend schraeg herab, gluehende Truemmer ziehen Feuerschweife.
4 The sky burns (32-38 s): the night sky above the desert turns red, the Zyrr mothership plunges down at an angle,
burning, glowing debris draws fire trails.
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L


def build():
    s = L.Shot(L.shot_dur('skyburns'))
    R = random.Random(21)
    s.toon.night()
    s.sunlight(rot=(1.2, 0.0, -2.2), strength=math.pi * 0.8)
    L.sky(s, [(-1, 'dune'), (0.0, 'skyBurn'), (0.1, 'skyMid'), (0.5, 'skyHigh'), (1, 'skyTop')], stars=0.8)
    h = K.dunes(5)
    L.ground(s, 'dune', size=1600, sub=50, height=h)
    s.look((0, -60, 14), (0, 100, 40))
    s.cam.data.lens = 28
    ship = L.model(s, 'mothership', loc=(-160, 420, 260), rot=30, scale=9)
    trail_m = [L.flat('fireHot'), L.flat('fire'), L.flat('lava')]
    trail = [L.prim(s, 'ico', trail_m[i % 3], loc=(0, 0, 0), size=1, sub=1, px=2.5 / 16) for i in range(22)]
    smoke = [L.prim(s, 'ico', L.toon(s, 'smoke700'), size=1, sub=1, px=2.5 / 28) for _ in range(14)]
    bits = []
    for i in range(9):
        p0 = Vector((R.uniform(-260, 120), R.uniform(250, 520), R.uniform(160, 320)))
        v = Vector((R.uniform(40, 90), R.uniform(-30, 10), R.uniform(-90, -50)))
        head = L.prim(s, 'ico', L.flat('fireHot'), size=R.uniform(3, 6), sub=1, px=2.5)
        tail = L.beam(s, L.flat('fire'), (0, 0, 0), (0, 0, 1), radius=1.2, segments=6, ink=True, px=2.0)
        bits.append((head, tail, p0, v, R.uniform(0, 2.5)))
    p_start, p_end = Vector((-170, 430, 270)), Vector((140, 520, -10))

    @s.on
    def update(t):
        burn = L.ease_io(L.seg(t, 0.0, 2.4))
        ramp = L.sky_ramp(s)
        ramp.elements[1].color = L.mix(L.rgb('skyHigh'), L.rgb('skyBurn'), burn)
        ramp.elements[2].color = L.mix(L.rgb('skyHigh'), L.rgb('fire'), burn * 0.9)
        ramp.elements[3].color = L.mix(L.rgb('skyHigh'), L.rgb('skyMid'), burn)
        p = L.seg(t, 0.4, s.dur + 0.6)
        pos = p_start.lerp(p_end, L.ease_in(p) * 0.85 + p * 0.15)
        ship.location = pos
        ship.rotation_euler = Euler((0.35 + 0.1 * math.sin(t * 3), -0.5, math.radians(30) + t * 0.15))
        d = (p_end - p_start).normalized()
        for i, b in enumerate(trail):
            k = i / len(trail)
            wob = Vector((math.sin(t * 9 + i) * 3, math.cos(t * 7 + i) * 3, 0))
            b.location = pos - d * (22 + k * 190) + wob * k
            b.scale = (max(0.5, (26 - k * 18) * (0.8 + 0.2 * math.sin(t * 20 + i))),) * 3
        for i, sm in enumerate(smoke):
            k = (i + 1) / len(smoke)
            sm.location = pos - d * (60 + k * 260) + Vector((0, 0, 20 * k))
            sm.scale = (16 + k * 22,) * 3
        for head, tail, p0, v, delay in bits:
            tt = (t + delay) % 3.5
            hp = p0 + v * tt * 1.6 + Vector((0, 0, -10 * tt * tt))
            head.location = hp
            L.set_beam(tail, hp - v.normalized() * 70, hp, 1.6)
        tgt = pos.lerp(Vector((0, 200, 20)), 0.55)
        s.look(Vector((0, -60, 14)) + L.shake(t, 4.5, 0.5, 2) * (1 + 3 * L.seg(t, 3, 6)), tgt)

    update(0)
    return s
