"""
7c Erwachen, Feld 3: die Zyrr bauen ein Tor in ihre Heimatwelt. Graue und Dreibeiner am Geruest, das Tor waechst
vom Rohbau zum leuchtenden Ring.
7c Awakening, panel 3: the Zyrr build a gate to their homeworld. Greys and tripods at the scaffold, the gate grows from
the shell to the glowing ring.
"""
import math

from mathutils import Vector

from .. import kit as K
from .. import lib as L
from .awaken_nexus import PANEL


def build():
    s = L.Shot(L.shot_dur('awaken'), w=PANEL[0], h=PANEL[1])
    s.toon.night()
    s.toon.cell.outputs[0].default_value = PANEL[0] / 6.0
    s.sunlight(rot=(1.0, 0.0, 2.0), strength=math.pi * 0.85)
    L.sky(s, [(-1, 'alienSky900'), (0.0, 'alienSky500'), (0.2, 'alienSky700'), (1, 'alienSky900')], stars=1.0)
    L.ground(s, 'xeno600', size=500, sub=2)
    s.cam.data.lens = 30
    s.cam.data.sensor_fit = 'VERTICAL'
    p0 = L.model(s, 'portal_0', loc=(0, 20, 0), scale=4.0)
    p2 = L.model(s, 'portal_2', loc=(0, 20, 0), scale=4.0)
    greys = K.unit_row(s, 'grey_zyrr', 5, (-10, 6, 0), (5, 0.6, 0), rot=160, scale=1.6, jitter=1.2, seed=4)
    trip = L.model(s, 'tripod_zyrr', loc=(-15, 24, 0), rot=30, scale=2.2)
    mech = L.model(s, 'mech_zyrr', loc=(14, 24, 0), rot=-30, scale=2.0)
    beams = [L.beam(s, L.flat('alienGlow'), (0, 0, 0), (0, 0, 1), radius=0.25, segments=6, ink=False) for _ in greys]
    flash = L.ring(s, L.flat('alienGlow'), (0, 20, 2), radius=1, tube=0.04)

    @s.on
    def update(t):
        built = t >= 8.0
        L.hide(p0, built)
        L.hide(p2, not built)
        for g, b in zip(greys, beams):
            on = (t < 8.0) and int(t * 6 + g.location.x) % 3 != 0
            L.set_beam(b, g.location + Vector((0, 0, 3.0)), Vector((g.location.x * 0.3, 20, 9)), 0.25 if on else 0.0001)
        d = t - 8.0
        flash.scale = (max(0.01, 4 + d * 60),) * 2 + (1,)
        L.hide(flash, not (0 < d < 1.0))
        p = L.ease_io(L.seg(t, 0, s.dur))
        s.look(L.vlerp((6, -44, 7.5), (2, -36, 9), p), (0, 20, 14))

    update(0)
    return s
