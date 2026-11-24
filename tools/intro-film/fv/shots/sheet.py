"""Modellbogen zur Kontrolle von Ausrichtung und Groesse / model sheet to check orientation and size"""
from .. import lib as L

NAMES = ['divineSpark_alvenia', 'academy_air', 'emplacement_dravon', 'silo_meridon', 'portal_2', 'mothership',
         'temple', 'datacenter_nexus', 'privateer_meridon', 'steppeRider_korvat', 'leader_korvat', 'bell_tower',
         'crash_site_0', 'teslaTank_velkar', 'android_nexus', 'zealot_vesper']


def build():
    s = L.Shot(1)
    s.toon.day()
    s.sunlight(rot=(0.9, 0.2, 0.5))
    L.sky(s, [(-1, 'hazeDay'), (1, 'sky700')])
    s.look((0, -95, 55), (0, 10, 0))
    s.cam.data.lens = 30
    L.ground(s, 'paper100', size=400, sub=2)
    for i, n in enumerate(NAMES):
        x = (i % 4 - 1.5) * 26
        y = (i // 4) * 24
        L.model(s, n, loc=(x, y, 0), scale=1.6)
    return s
