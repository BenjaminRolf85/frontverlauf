"""
13 Velkar (97-104 s): eisiger Norden. Die Akademie schwebt ueber dem Eis, Tesla-Panzer mit Lichtboegen, Oktokopter.
Der Orbitallaser schlaegt aus dem Himmel ein (2,4 s), dann trifft der Neutronenstrahl der Akademie einen Titan (4,6 s).
13 Velkar (97-104 s): the icy north. The Academy floats above the ice, Tesla tanks with arcs, octocopters.
The orbital laser strikes from the sky (2.4 s), then the Academy's neutron beam hits a titan (4.6 s).
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L

LASER, RAY = 2.4, 4.6


def build():
    s = L.Shot(L.shot_dur('velkar'))
    R = random.Random(101)
    s.toon.set_light((0.42, 0.48, 0.62, 1), (0.74, 0.8, 0.9, 1), (1.0, 1.0, 1.0, 1))
    s.sunlight(rot=(1.1, 0.1, 2.0))
    L.sky(s, [(-1, 'tundra100'), (0.0, 'velkarFrost'), (0.2, 'sky700'), (1, 'sky900')], stars=0.2, star_col='starCool')
    h = K.hills(2.0, 0.02, 7)
    L.ground(s, 'snow100', size=1000, sub=60, height=h)
    s.cam.data.lens = 28
    acad = L.model(s, 'academy_air', loc=(0, 60, 26), rot=15, scale=6.0)
    a0 = Vector(acad.location)
    tesla = [L.model(s, 'teslaTank_velkar', loc=(x, y, h(x, y)), rot=r, scale=2.4) for x, y, r in ((-16, 8, 20), (14, 14, -10))]
    octo = [L.model(s, 'octocopter_velkar', loc=(x, y, z), rot=R.uniform(0, 360), scale=2.0) for x, y, z in ((-26, 36, 22), (24, 40, 18), (4, 24, 28))]
    o0 = [Vector(o.location) for o in octo]
    snipers = K.unit_row(s, 'railSniper_velkar', 3, (-6, -6, 0), (6, -1, 0), rot=-20, scale=1.7, seed=2)
    for sn in snipers:
        sn.location.z = h(sn.location.x, sn.location.y)
    for i in range(10):
        x, y = R.uniform(-160, 160), R.uniform(80, 300)
        L.prim(s, 'cone', L.toon(s, 'velkarFrost'), loc=(x, y, h(x, y) + 8), size=(R.uniform(18, 40), R.uniform(18, 40), R.uniform(16, 40)), segments=6)
    arcs = [K.arc(s, t.location + Vector((0, 0, 6)), t.location + Vector((6, -4, 9)), n=6, color='velkarArc', jitter=1.2, radius=0.18) for t in tesla]
    # Orbitallaser / orbital laser
    hit1 = Vector((-70, 160, 0))
    hit1.z = h(hit1.x, hit1.y)
    core = L.beam(s, L.flat('laserCore'), hit1 + Vector((0, 0, 600)), hit1, radius=1, segments=12, ink=False)
    outer = L.beam(s, L.flat('laser'), hit1 + Vector((0, 0, 600)), hit1, radius=1, segments=12, ink=True, px=3)
    boom1 = K.Boom(s, LASER + 0.1, hit1 + Vector((0, 0, 4)), size=22, seed=3, n=8)
    # Neutronenstrahl auf einen Titan / neutron beam onto a titan
    titan = L.model(s, 'titan_nexus', loc=(70, 140, 0), rot=200, scale=3.2)
    titan.location.z = h(70, 140)
    ray = L.beam(s, L.flat('nexusIce'), (0, 0, 0), (0, 0, 1), radius=1, segments=10, ink=True, px=3)
    ray_core = L.beam(s, L.flat('white'), (0, 0, 0), (0, 0, 1), radius=1, segments=10, ink=False)
    boom2 = K.Boom(s, RAY + 0.15, titan.location + Vector((0, 0, 12)), size=16, seed=4, n=7)

    @s.on
    def update(t):
        acad.location = a0 + Vector((0, 0, math.sin(t * 1.4) * 1.2))
        for o, b in zip(octo, o0):
            o.location = b + Vector((math.sin(t * 1.1 + b.x) * 2, 0, math.sin(t * 2 + b.y) * 1))
        for k, (a, tk) in enumerate(zip(arcs, tesla)):
            a(t, on=int(t * 8 + k * 3) % 4 != 0,
              aa=tk.location + Vector((0, 0, 6)), bb=tk.location + Vector((5 * math.sin(t * 3 + k), -5, 8)))
        d = t - LASER
        w = 9 * L.ease_out(L.seg(d, 0, 0.15)) * (1 - L.seg(d, 1.1, 1.5))
        L.set_beam(core, hit1 + Vector((0, 0, 600)), hit1, max(w * 0.45, 0.001))
        L.set_beam(outer, hit1 + Vector((0, 0, 600)), hit1, max(w, 0.001))
        boom1.update(t)
        r = t - RAY
        src = acad.location + Vector((0, -6, -6))
        dst = titan.location + Vector((0, 0, 12))
        rw = 2.4 * L.ease_out(L.seg(r, 0, 0.12)) * (1 - L.seg(r, 0.8, 1.1))
        L.set_beam(ray, src, src.lerp(dst, L.ease_out(L.seg(r, 0, 0.15))), max(rw, 0.001))
        L.set_beam(ray_core, src, src.lerp(dst, L.ease_out(L.seg(r, 0, 0.15))), max(rw * 0.4, 0.001))
        boom2.update(t)
        L.hide(titan, t > RAY + 0.6)
        p = L.ease_io(L.seg(t, 0, s.dur))
        cam = L.vlerp((-34, -46, 7), (-10, -58, 14), p)
        cam.z += h(cam.x, cam.y)
        s.look(cam + L.shake(t, LASER + 0.1, 1.4, 3) + L.shake(t, RAY + 0.15, 0.9, 4), L.vlerp((-10, 60, 18), (10, 80, 22), p))

    update(0)
    return s
