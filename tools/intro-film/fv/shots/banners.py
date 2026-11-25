"""
15 Fuenf Banner (111-117 s): die fuenf Anfuehrer auf einem Huegel, hinter jedem das Banner der Fraktion. Vor ihnen
leuchtet die Kreidelinie der Front auf und wandert. Kamera faehrt im Bogen.
15 Five banners (111-117 s): the five leaders on a hill, behind each the faction's banner. In front of them the chalk
line of the front lights up and moves. The camera moves in an arc.
"""
import math

from mathutils import Vector

from .. import kit as K
from .. import lib as L

ORDER = ['korvat', 'alvenia', 'dravon', 'velkar', 'meridon']


def build():
    s = L.Shot(L.shot_dur('banners'))
    s.toon.set_light((0.42, 0.36, 0.46, 1), (0.76, 0.68, 0.7, 1), (1.0, 0.94, 0.84, 1))
    s.sunlight(rot=(1.0, 0.1, -2.6))
    L.sky(s, [(-1, 'grass600'), (0.0, 'sunDawn'), (0.12, 'skyDawn'), (0.5, 'sky700'), (1, 'sky900')])

    def h(x, y):
        return 6 * math.exp(-(x * x + y * y) / 3000.0)
    L.ground(s, 'grass500', size=900, sub=60, height=h)
    s.cam.data.lens = 24
    flags = []
    leaders = []
    tok = L.tokens()['faction']
    for i, f in enumerate(ORDER):
        x = (i - 2) * 13
        y = 4 + abs(i - 2) * 3
        flags.append(K.flag(s, tok[f]['primary'], (x - 1, y + 4, h(x, y)), w=7.5, h=5, pole=17, stripe=tok[f]['secondary']))
        leaders.append(L.model(s, 'leader_%s' % f, loc=(x, y, h(x, y)), rot=(i - 2) * 6, scale=1.0))
    from .chalk import chalk_line
    line = chalk_line(s, z=0.4, width=1.8, mat=L.toon(s, 'hazard', glow=0.6))
    base = [Vector(o.location) for o in line]

    @s.on
    def update(t):
        for f, wave in flags:
            wave(t, 1.2)
        for o, b in zip(line, base):
            p = b * 1.6 + Vector((0, -46 + 5 * math.sin(t * 0.8), 0))
            p.y += 4 * math.sin(b.x * 0.15 + t * 2)
            o.location = p
            o.location.z = h(p.x, p.y) + 0.4
        a = -0.55 + 0.5 * L.ease_io(L.seg(t, 0, s.dur))
        r = 33
        cam = Vector((math.sin(a) * r, -math.cos(a) * r, 8 + 3 * L.seg(t, 0, s.dur)))
        s.look(cam, (0, 4, 9))

    update(0)
    return s
