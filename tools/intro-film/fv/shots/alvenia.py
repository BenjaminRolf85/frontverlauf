"""
11 Alvenia (83-90 s): Heiliges Alvenia in den gruenen Huegeln. Der Goettliche Funke sammelt Sonnenlicht in der Muendung,
dann faellt der Funke vom Himmel auf ein feindliches Feldlager und taucht es in Licht. Lichtschuetzen im Vordergrund.
11 Alvenia (83-90 s): Holy Alvenia in the green hills. The Divine Spark gathers sunlight in its muzzle, then the spark
falls from the sky onto an enemy camp and bathes it in light. Light Wardens in the foreground.
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L

FIRE, STRIKE = 2.6, 3.4


def build():
    s = L.Shot(L.shot_dur('alvenia'))
    R = random.Random(81)
    s.toon.set_light((0.42, 0.42, 0.55, 1), (0.78, 0.76, 0.8, 1), (1.0, 0.97, 0.88, 1))
    s.sunlight(rot=(0.75, 0.1, -2.4))
    L.sky(s, [(-1, 'grass500'), (0.0, 'sunDawn'), (0.15, 'skyDawn'), (0.6, 'sky700'), (1, 'sky800')])
    h = K.hills(3.0, 0.02, 5)
    L.ground(s, 'grass400', size=1000, sub=60, height=h)
    s.cam.data.lens = 28
    spark = L.model(s, 'divineSpark_alvenia', loc=(0, 0, h(0, 0) - 0.2), rot=-35, scale=3.2)
    # Muendung aus dem Export (userData.muzzle des Spielmodells) / muzzle from the export (the game model's userData.muzzle)
    muzzle = L.unit_point(spark, L.unit_data('divineSpark_alvenia')['muzzle'])
    # Lichtschuetzen links vor dem Geschuetz, quer zur Blickrichtung gestaffelt, damit die ganzen Figuren im Bild stehen
    # Light Wardens left in front of the gun, staggered across the view so the whole figures are in frame
    wardens = K.unit_row(s, 'lightWarden_alvenia', 4, (-18.8, -25.6, 0), (1.7, 5.2, 0), rot=38, scale=1.8, jitter=0.5, seed=3)
    for w in wardens:
        w.location.z = h(w.location.x, w.location.y)
    rel = L.model(s, 'reliquary_alvenia', loc=(24, 6, h(24, 6)), rot=-50, scale=2.2)
    lance = L.model(s, 'sunLance_alvenia', loc=(-22, 8, h(-22, 8)), rot=-15, scale=2.0)
    for i in range(14):
        x, y = R.uniform(-120, 120), R.uniform(30, 220)
        L.model(s, 'leafy_%d' % (i % 2), loc=(x, y, h(x, y)), rot=R.uniform(0, 360), scale=R.uniform(3, 4.5))
    # feindliches Lager / enemy camp
    camp = Vector((-110, 150, 0))
    camp.z = h(camp.x, camp.y)
    for i, n in enumerate(['doomBuggy_vesper', 'shrine_vesper', 'zealot_vesper', 'doomCrawler_vesper', 'zealot_vesper']):
        p = camp + Vector((R.uniform(-14, 14), R.uniform(-10, 10), 0))
        L.model(s, n, loc=(p.x, p.y, h(p.x, p.y)), rot=R.uniform(0, 360), scale=2.0)
    orb = L.prim(s, 'ico', L.flat('shieldCore'), loc=muzzle, size=1, sub=2, px=0.5)
    halo = L.ring(s, L.flat('shield'), muzzle, radius=1, tube=0.06)
    rays = [L.beam(s, L.flat('shield'), (0, 0, 0), (0, 0, 1), radius=0.3, segments=6, ink=False) for _ in range(6)]
    ray_src = [Vector((R.uniform(-120, 120), R.uniform(-40, 160), 220)) for _ in rays]
    column = L.beam(s, L.flat('shieldCore'), camp + Vector((0, 0, 400)), camp, radius=1, segments=16, ink=True, px=3)
    column_out = L.beam(s, L.flat('shield'), camp + Vector((0, 0, 400)), camp, radius=1, segments=16, ink=True, px=3)
    dome = L.prim(s, 'uv', L.flat('shieldCore'), loc=camp, size=1, segments=24, px=0.05)
    dome_ring = L.ring(s, L.flat('shield'), camp + Vector((0, 0, 1)), radius=1, tube=0.05)

    @s.on
    def update(t):
        g = L.seg(t, 0.3, FIRE)
        orb.scale = (max(0.01, 4.5 * L.ease_out(g) * (1 - L.seg(t, FIRE, FIRE + 0.15)) + 0.4 * math.sin(t * 20) * g),) * 3
        halo.scale = (max(0.01, 14 * g * (1 + 0.1 * math.sin(t * 9))),) * 3
        halo.rotation_euler = Euler((math.pi / 2, 0, t))
        L.hide(halo, t > FIRE + 0.1)
        for b, src in zip(rays, ray_src):
            L.set_beam(b, src, muzzle, 0.35 if 0.3 < t < FIRE else 0.0001)
        d = t - STRIKE
        cw = 18 * L.ease_out(L.seg(d, 0, 0.25)) * (1 - L.seg(d, 1.6, 2.4))
        L.set_beam(column, camp + Vector((0, 0, 420)), camp, max(cw * 0.6, 0.001))
        L.set_beam(column_out, camp + Vector((0, 0, 420)), camp, max(cw, 0.001))
        dm = 75 * L.ease_out(L.seg(d, 0.05, 1.0)) * (1 - L.ease_in(L.seg(d, 2.4, 3.6)))
        dome.scale = (max(dm, 0.01),) * 3
        dome_ring.scale = (max(0.01, 90 * L.ease_out(L.seg(d, 0, 1.6))),) * 2 + (1,)
        L.hide(dome_ring, not (0 < d < 1.6))
        p = L.ease_io(L.seg(t, 0, FIRE + 0.4))
        q = L.ease_io(L.seg(t, FIRE + 0.2, STRIKE + 0.6))
        cam = L.vlerp((22, -36, 7.5), (16, -30, 9.0), p)
        tgt = L.vlerp(muzzle, camp + Vector((0, 0, 20)), q)
        cam = cam.lerp(Vector((6, -30, 34)), q)
        cam.z += h(cam.x, cam.y)
        s.look(cam + L.shake(t, STRIKE, 1.0, 3), tgt)

    update(0)
    return s
