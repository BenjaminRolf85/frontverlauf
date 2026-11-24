"""
7b Erwachen, Feld 2: der Kult der Letzten Stunde erhebt sich. Tempel mit Feuerschalen, Eiferer, Berserker und Prophet.
7b Awakening, panel 2: the Cult of the Final Hour rises. Temple with braziers, zealots, berserkers and the prophet.
"""
import math

from mathutils import Vector

from .. import kit as K
from .. import lib as L
from .awaken_nexus import PANEL


def build():
    s = L.Shot(L.shot_dur('awaken'), w=PANEL[0], h=PANEL[1])
    s.toon.set_light((0.3, 0.14, 0.18, 1), (0.62, 0.36, 0.34, 1), (1.0, 0.78, 0.6, 1))
    s.toon.cell.outputs[0].default_value = PANEL[0] / 6.0
    s.sunlight(rot=(1.25, 0.0, -0.6))
    L.sky(s, [(-1, 'skyBurn'), (0.0, 'fire'), (0.08, 'skyBurn'), (0.5, 'blood700'), (1, 'ink900')])
    L.ground(s, 'char800', size=500, sub=2)
    s.cam.data.lens = 30
    s.cam.data.sensor_fit = 'VERTICAL'
    L.model(s, 'temple', loc=(0, 40, 0), rot=0, scale=3.4)
    crowd = []
    for i, (n, x, y) in enumerate([('zealot_vesper', -8, 6), ('torchbearer_vesper', -3, 2), ('berserker_vesper', 3, 3), ('zealot_vesper', 8, 7),
                                   ('torchbearer_vesper', -11, 12), ('zealot_vesper', 11, 13), ('berserker_vesper', -5, 10), ('zealot_vesper', 5, 11)]):
        crowd.append((L.model(s, n, loc=(x, y, 0), rot=(x * 2), scale=1.7), Vector((x, y, 0)), i))
    prophet = L.model(s, 'prophet_vesper', loc=(0, 18, 3.5), rot=0, scale=2.4)
    fires = [L.Puffs(s, 5, 'fire', (x, 34, 6), spread=0.8, rise=6, size=(1.0, 2.0), life=1.2, seed=k, glow=1.0) for k, x in enumerate((-14, 14))]
    for f in fires:
        for ob, *_ in f.items:
            ob.material_slots[0].material = L.flat('fire')

    @s.on
    def update(t):
        for ob, base, i in crowd:
            jump = max(0.0, math.sin(t * 7 + i * 1.3)) * 0.8 * L.seg(t, 3.6, 4.4)
            ob.location = base + Vector((0, 0, jump))
        prophet.location = Vector((0, 18, 3.5 + 2.5 * L.ease_back(L.seg(t, 4.6, 5.8))))
        for f in fires:
            f.update(t)
        p = L.ease_io(L.seg(t, 0, s.dur))
        s.look(L.vlerp((0, -50, 5), (0, -40, 7), p), (0, 22, 14))

    update(0)
    return s
