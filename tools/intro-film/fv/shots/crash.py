"""
5 Absturz (38-46 s): das Mutterschiff schlaegt in die Duenen ein (bei 1,0 s), Feuerball, Druckwelle aus Sand,
Truemmer regnen herab, danach rauchende Absturzstelle. KAWUMM als Sprach-Einblendung im Spiel.
5 Crash (38-46 s): the mothership slams into the dunes (at 1.0 s), fireball, shockwave of sand, debris rains down,
then a smoking crash site. KABOOM as a language overlay in the game.
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L

HIT = 1.0


def build():
    s = L.Shot(L.shot_dur('crash'))
    R = random.Random(31)
    s.toon.set_light((0.32, 0.2, 0.3, 1), (0.62, 0.42, 0.42, 1), (1.0, 0.8, 0.66, 1))
    s.sunlight(rot=(1.15, 0.0, -2.0), strength=math.pi)
    L.sky(s, [(-1, 'dune'), (0.0, 'skyBurn'), (0.08, 'fire'), (0.3, 'skyMid'), (1, 'skyHigh')], stars=0.4)
    h = K.dunes(4)
    L.ground(s, 'desert500', size=1400, sub=70, height=h)
    s.cam.data.lens = 30
    site = Vector((0, 160, h(0, 160)))
    ship = L.model(s, 'mothership', loc=site + Vector((-120, 60, 120)), rot=40, scale=9)
    crash = L.model(s, 'crash_site_0', loc=site + Vector((0, 0, -1)), rot=200, scale=13)
    crash2 = L.model(s, 'crash_site_1', loc=site + Vector((22, -10, -1)), rot=80, scale=8)
    boom = K.Boom(s, HIT, site + Vector((0, 0, 10)), size=70, seed=3, n=10)
    boom2 = K.Boom(s, HIT + 0.35, site + Vector((-40, 18, 6)), size=40, seed=4, n=7)
    ring_m = L.toon(s, 'dust300')
    wave = L.ring(s, ring_m, site + Vector((0, 0, 2)), radius=1, tube=0.12)
    debris = K.Debris(s, HIT, site + Vector((0, 0, 10)), n=22, speed=70, size=(3, 7), color='alienDark', seed=5, gravity=30)
    glowbits = K.Debris(s, HIT + 0.1, site + Vector((0, 0, 10)), n=10, speed=48, size=(1.2, 2.6), color='alienGlow', seed=6, gravity=30, glow=1.0)
    smoke = [L.Puffs(s, 7, 'smoke400', site + Vector((x, y, 10)), spread=10, rise=110, size=(20, 34), life=5.0, seed=k, wind=(30, 10, 0), start=HIT + 0.6)
             for k, (x, y) in enumerate(((0, 0), (-25, 12), (20, -6)))]
    flash = L.cam_plane(s, L.flat('flash', alpha=0.0, name='flash'), dist=1.0, scale=1.2)

    @s.on
    def update(t):
        fall = L.seg(t, 0, HIT)
        ship.location = (site + Vector((-120, 60, 120))).lerp(site + Vector((0, 0, 8)), L.ease_in(fall))
        ship.rotation_euler = Euler((0.4, -0.45, math.radians(40)))
        L.hide(ship, t >= HIT)
        L.hide(crash, t < HIT + 0.25)
        L.hide(crash2, t < HIT + 0.25)
        boom.update(t)
        boom2.update(t)
        d = t - HIT
        wv = L.ease_out(L.seg(d, 0, 2.2))
        wave.scale = (max(0.01, wv * 260),) * 2 + (max(0.01, 4 * (1 - wv)),)
        L.hide(wave, not (0 < d < 2.2))
        debris.update(t)
        glowbits.update(t)
        for sm in smoke:
            sm.update(t)
        K.set_alpha(flash.material_slots[0].material, L.clamp(math.exp(-max(d, 0) * 8) * (1 if d >= 0 else 0)))
        p = L.ease_io(L.seg(t, 0, s.dur))
        cam = L.vlerp((-70, -90, 26), (-40, -70, 34), p) + L.shake(t, HIT, 3.5, 3)
        s.look(cam, site + Vector((0, 0, 16 + 10 * p)))

    update(0)
    return s
