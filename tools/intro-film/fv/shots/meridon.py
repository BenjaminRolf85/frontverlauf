"""
14 Meridon (104-111 s): Meer in der Abenddaemmerung, Nebel. Kaperschiffe und Zerstoerer der Schattenflotte, ein
Landungsboot mit Marines laeuft auf die Kueste zu, aus einem Silo an der Kueste steigt eine Rakete.
14 Meridon (104-111 s): sea at dusk, fog. Privateers and destroyers of the shadow fleet, a landing boat with marines
heads for the coast, a rocket rises from a silo on the coast.
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L

LAUNCH = 2.2


def build():
    s = L.Shot(L.shot_dur('meridon'))
    R = random.Random(111)
    s.toon.set_light((0.3, 0.3, 0.42, 1), (0.6, 0.6, 0.7, 1), (1.0, 0.9, 0.8, 1))
    s.sunlight(rot=(1.25, 0.0, 1.6))
    L.sky(s, [(-1, 'seaDeep'), (0.0, 'sunDusk'), (0.1, 'skyDusk'), (0.5, 'skyMid'), (1, 'skyHigh')], stars=0.2)
    sea = K.Sea(s, size=700, sub=46, color='sea', amp=0.7)
    s.cam.data.lens = 28
    # Kueste mit Silo / coast with a silo
    coast = L.prim(s, 'cyl', L.toon(s, 'sand300'), loc=(80, 170, -2), size=(160, 110, 6), segments=10)
    cliff = L.prim(s, 'cyl', L.toon(s, 'rock600'), loc=(95, 190, 4), size=(110, 70, 10), segments=8)
    silo = L.model(s, 'silo_meridon', loc=(70, 160, 9), rot=0, scale=3.0)
    post = L.model(s, 'trading_post_meridon', loc=(110, 170, 9), rot=-30, scale=3.0)
    rocket = L.model(s, 'guidedMissile_meridon', loc=(70, 160, 10), rot=0, scale=4.0)
    r0 = Vector(rocket.location)
    ships = []
    for n, x, y, r, sc in (('privateer_meridon', -26, 30, 20, 3.0), ('destroyer_meridon', 22, 70, 30, 3.2), ('privateer_meridon', -50, 90, 10, 3.0),
                           ('battleship_meridon', -10, 140, 25, 3.4), ('landingBoat_meridon_marine', 8, 12, 25, 2.6)):
        ob = L.model(s, n, loc=(x, y, 0), rot=r, scale=sc)
        ships.append((ob, Vector((x, y, 0)), r, R.uniform(0, 6)))
    fog = [L.Puffs(s, 6, 'smokeLight', (x, y, 1), spread=12, rise=2, size=(8, 14), life=7.0, seed=k, wind=(10, 0, 0))
           for k, (x, y) in enumerate(((-40, 60), (30, 110), (-80, 130), (60, 40)))]
    trail = L.Puffs(s, 10, 'paper100', (70, 160, 12), spread=1.5, rise=0, size=(3, 6), life=2.5, seed=8)
    flame = L.prim(s, 'cone', L.flat('fireHot'), loc=r0, size=(3, 3, 8), segments=8, px=0.6)

    @s.on
    def update(t):
        sea.update(t)
        for ob, b, r, ph in ships:
            sp = 3.0 if 'landing' in ob.name else 1.6
            d = Vector((math.sin(math.radians(r)) * -1, -math.cos(math.radians(r)) * -1, 0))
            p = b + d * sp * t
            p.z = 0.7 * math.sin(t * 1.6 + b.x * 0.08) - 0.3
            ob.location = p
            ob.rotation_euler = Euler((math.sin(t * 1.3 + ph) * 0.04, math.sin(t * 1.1 + ph) * 0.05, math.radians(r)))
        for f in fog:
            f.update(t + 4)
        d = t - LAUNCH
        if d > 0:
            pos = r0 + Vector((0, -4 * d * d, 14 * d * d + 6 * d))
            rocket.location = pos
            rocket.rotation_euler = Euler((-0.25 * L.seg(d, 0, 3), 0, 0))
            flame.location = pos + Vector((0, 0, -4))
            flame.rotation_euler = Euler((math.pi, 0, 0))
            flame.scale = (3, 3, 8 + 2 * math.sin(t * 30))
            trail.origin = pos + Vector((0, 0, -6))
            trail.update(t)
        else:
            rocket.location = r0 + Vector((0, 0, 0.3 * math.sin(t * 40) * L.seg(t, LAUNCH - 0.8, LAUNCH)))
            flame.scale = (0.001,) * 3
            trail.update(-20)
        p = L.ease_io(L.seg(t, 0, s.dur))
        cam = L.vlerp((-2, -20, 4.5), (-10, -12, 6.5), p)
        tgt = L.vlerp((0, 40, 6), (40, 150, 30 + 20 * L.seg(t, LAUNCH, s.dur)), L.ease_io(L.seg(t, 0.8, s.dur)))
        s.look(cam + L.shake(t, LAUNCH, 0.5, 3), tgt)

    update(0)
    return s
