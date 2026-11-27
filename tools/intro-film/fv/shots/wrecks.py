"""
2 Wracks (16-24 s): staubiger Tag nach dem Krieg. Rostende Panzerwracks, Ruinen Verdans, Krater, Rauchfaeden.
Kamerafahrt seitlich, tief am Boden.
2 Wrecks (16-24 s): dusty day after the war. Rusting tank wrecks, Verdan ruins, craters, threads of smoke.
Sideways camera track, low to the ground.
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L


def build():
    s = L.Shot(L.shot_dur('wrecks'))
    R = random.Random(11)
    s.toon.set_light((0.52, 0.45, 0.45, 1), (0.78, 0.7, 0.66, 1), (1.0, 0.93, 0.84, 1))
    s.sunlight(rot=(0.95, 0.1, 2.3))
    L.sky(s, [(-1, 'dust300'), (0.0, 'dust300'), (0.25, 'hazeDusk'), (1, 'smoke400')])
    s.look((-30, -26, 5), (-20, 20, 3))
    h = K.hills(1.6, 0.03, 2)
    L.ground(s, 'mud500', size=600, sub=60, height=h)
    # Krater / craters
    for i in range(14):
        x, y = R.uniform(-60, 70), R.uniform(-5, 80)
        c = L.prim(s, 'cyl', L.toon(s, 'mud700'), loc=(x, y, h(x, y) + 0.05), size=(R.uniform(4, 9), R.uniform(4, 9), 0.2), segments=10, ink=False)
        c.rotation_euler = Euler((0, 0, R.uniform(0, 3)))
    burnt = L.toon_attr(s, tint='scorch900', amount=0.7)
    wrecks = []
    # Wracks: die gezeichneten Fahrzeuge der fuenf Fraktionen ohne Besatzung (Export hulk_*), rostig oder verbrannt eingefaerbt (die Zeichnung bleibt als
    # Hell-Dunkel erhalten, die Fraktionsfarbe scheint noch durch), schief eingesunken, Tuerme verdreht
    # wrecks: the inked vehicles of the five factions without crew (export hulk_*), tinted rusty or burnt (the drawing survives as light and dark, the
    # faction colour still shows through), sunk in at an angle, turrets twisted
    spots = [(-34, 8, 'hulk_tank_dravon'), (-14, 18, 'hulk_artillery_korvat'), (-2, 6, 'hulk_tank_korvat'), (14, 20, 'hulk_heli_korvat'), (28, 9, 'hulk_tank_meridon'),
             (44, 24, 'hulk_heli_velkar'), (58, 10, 'hulk_tank_velkar'), (-24, 34, 'hulk_tank_alvenia'), (6, 40, 'hulk_artillery_dravon'), (36, 44, 'hulk_jeep_dravon')]
    for i, (x, y, n) in enumerate(spots):
        ob = L.model(s, n, loc=(x, y, h(x, y) - 0.5), rot=R.uniform(0, 360), scale=2.2, tint=('rust600', 0.78, 'wash') if i % 3 else ('smoke700', 0.82, 'wash'))
        ob.rotation_euler = Euler((R.uniform(-0.25, 0.25), R.uniform(-0.3, 0.3), ob.rotation_euler.z))
        for tur in L.turrets(s, ob):
            tur.rotation_euler = Euler((R.uniform(-0.12, 0.12), R.uniform(-0.1, 0.1), R.uniform(-2.2, 2.2)))
        wrecks.append(ob)
    # verkohlte Truemmerhaufen aus dem Wrackbauer des Spiels zwischen den Wracks / charred debris piles from the game's wreck builder between the wrecks
    for i, (x, y, n) in enumerate([(-24, 2, 'wreck_jeep_korvat_0'), (20, 4, 'wreck_tank_alvenia_1'), (50, 30, 'wreck_heli_dravon_0'), (-46, 26, 'wreck_tank_velkar_0')]):
        L.model(s, n, loc=(x, y, h(x, y) - 0.05), rot=R.uniform(0, 360), scale=1.8)
    for i, n in enumerate(['verdan_ruin', 'verdan_remains_0', 'verdan_remains_1', 'verdan_remains_2', 'emplacement_ruin', 'verdan_desert_ruin_0', 'verdan_turret_off', 'verdan_desert_ruin_2']):
        x, y = -50 + i * 16 + R.uniform(-3, 3), 30 + R.uniform(0, 30)
        L.model(s, n, loc=(x, y, h(x, y) - 0.2), rot=R.uniform(0, 360), scale=2.4)
    # tote Baeume / dead trees
    for i in range(10):
        x, y = R.uniform(-60, 80), R.uniform(40, 120)
        L.model(s, 'conifer_%d' % (i % 3), loc=(x, y, h(x, y)), scale=R.uniform(1.8, 2.6), mat=burnt)
    smoke = [L.Puffs(s, 7, 'smoke400', (wrecks[k].location.x, wrecks[k].location.y, wrecks[k].location.z + 3), spread=0.8, rise=16,
                     size=(1.4, 3.2), life=5.0, seed=k, wind=(5, 3, 0)) for k in (0, 2, 4, 6)]

    @s.on
    def update(t):
        p = L.ease_io(L.seg(t, 0, s.dur))
        s.look(L.vlerp((-40, -30, 9), (36, -28, 11), p), L.vlerp((-22, 24, 1), (44, 28, 2), p))
        for sm in smoke:
            sm.update(t + 3)

    update(0)
    return s
