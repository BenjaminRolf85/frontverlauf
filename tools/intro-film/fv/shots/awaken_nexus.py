"""
7a Erwachen, Feld 1 (52-62 s, Hochformat-Panel): NEXUS erwacht. Rechenzentrum und Kraftwerk, die Augen der
Androiden gehen an, ein Titan richtet sich auf. assemble.py setzt die drei Felder zu einer Comicseite zusammen.
7a Awakening, panel 1 (52-62 s, portrait panel): NEXUS awakens. Data centre and power plant, the androids' eyes light
up, a titan rises. assemble.py puts the three panels together into a comic page.
"""
import math

from mathutils import Vector

from .. import kit as K
from .. import lib as L

PANEL = (416, 664)


def build():
    s = L.Shot(L.shot_dur('awaken'), w=PANEL[0], h=PANEL[1])
    s.toon.night()
    s.toon.cell.outputs[0].default_value = PANEL[0] / 6.0
    s.sunlight(rot=(1.0, 0.1, 2.4), strength=math.pi * 0.8)
    L.sky(s, [(-1, 'skyNight'), (0.0, 'hazeNight'), (0.3, 'skyNight'), (1, 'space950')], stars=0.8, star_col='starCool')
    L.ground(s, 'basalt700', size=500, sub=2)
    s.cam.data.lens = 30
    s.cam.data.sensor_fit = 'VERTICAL'
    dc = L.model(s, 'datacenter_nexus', loc=(0, 24, 0), rot=10, scale=4.2)
    pp = L.model(s, 'powerplant_nexus', loc=(-26, 40, 0), rot=-20, scale=4.0)
    ht = L.model(s, 'hacktower_nexus', loc=(24, 38, 0), rot=30, scale=4.0)
    titan = L.model(s, 'titan_nexus', loc=(12, 10, 0), rot=-15, scale=2.6)
    droids = K.unit_row(s, 'android_nexus', 4, (-9, -6, 0), (5.0, -1.2, 0), rot=5, scale=1.6, jitter=0.6, seed=2)
    spider = L.model(s, 'spider_nexus', loc=(-12, 8, 0), rot=20, scale=1.8)
    machines = [dc, pp, ht, titan, spider] + droids
    on_at = {ob.name: 0.6 + i * 0.35 for i, ob in enumerate(machines)}
    t_base = Vector(titan.location)

    @s.on
    def update(t):
        for ob in machines:
            v = 1 - L.seg(t, on_at[ob.name], on_at[ob.name] + 0.2)
            if 0 < t - on_at[ob.name] < 0.3:
                v = 0.0 if int(t * 24) % 2 else 1.0
            ob['glowoff'] = v
            ob['lightsoff'] = v
            ob.update_tag()
        rise = L.ease_back(L.seg(t, 2.6, 4.0))
        titan.location = t_base + Vector((0, 0, -6 + 6 * rise))
        p = L.ease_io(L.seg(t, 0, s.dur))
        s.look(L.vlerp((4, -62, 9), (2, -50, 11), p), (0, 16, 12))

    update(0)
    return s
