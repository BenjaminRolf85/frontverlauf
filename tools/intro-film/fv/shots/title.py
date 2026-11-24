"""
16 Titel (117-124 s): Strahlenkranz in Warnfarben, der Schriftzug FRONTVERLAUF (Eigenname, in beiden Sprachen gleich)
schlaegt ein. Den Slogan "Halte die Front / Hold the front" blendet das Spiel in der Spielsprache ein.
16 Title (117-124 s): a sunburst in hazard colours, the lettering FRONTVERLAUF (a proper name, the same in both languages)
slams in. The game overlays the tagline "Halte die Front / Hold the front" in the game language.
"""
import math

from mathutils import Euler, Vector

from .. import lib as L

SLAM = 0.5


def build():
    s = L.Shot(L.shot_dur('title'))
    s.toon.set_light((0.62, 0.58, 0.66, 1), (0.86, 0.84, 0.88, 1), (1.0, 1.0, 1.0, 1))
    s.toon.dots.outputs[0].default_value = 1.0
    s.sunlight(rot=(0.5, -0.3, 0.2))
    L.sky(s, [(-1, 'ink900'), (1, 'ink900')])
    s.look((0, -60, 0), (0, 0, 0))
    s.cam.data.lens = 50
    # Strahlenkranz / sunburst
    n = 24
    verts, faces = [(0, 0, 0)], []
    for i in range(n * 2):
        a = math.pi * i / n
        verts.append((math.cos(a) * 200, 0, math.sin(a) * 200))
    for i in range(0, n * 2, 2):
        faces.append((0, i + 1, (i + 1) % (n * 2) + 1))
    burst = L.mesh_obj(s, 'burst', verts, faces, L.flat('hazard'), loc=(0, 40, 0))
    L.prim(s, 'cube', L.flat('accent'), loc=(0, 42, 0), size=(400, 1, 400), ink=False)
    title = L.text_obj(s, 'FRONTVERLAUF', size=9.5, extrude=1.2, color='paper50', loc=(0, 0, 4), px=2.2)
    shadow = L.text_obj(s, 'FRONTVERLAUF', size=9.5, extrude=0.6, color='stamp', loc=(0.9, 3, 3.1), px=0.0, ink=False)
    bar = L.prim(s, 'cube', L.toon(s, 'stamp'), loc=(0, 2, -6.5), size=(56, 1, 3.2), px=2.2)
    tanks = [L.model(s, 'tank_%s' % f, loc=(x, 10, -16), rot=180 + r, scale=1.4) for f, x, r in
             (('korvat', -24, 25), ('alvenia', -12, 12), ('dravon', 0, 0), ('velkar', 12, -12), ('meridon', 24, -25))]
    for tk in tanks:
        tk.rotation_euler = Euler((math.radians(-15), 0, tk.rotation_euler.z))

    @s.on
    def update(t):
        p = L.seg(t, 0, SLAM)
        k = 1 + 3.0 * (1 - L.ease_in(p))
        title.scale = shadow.scale = (k, k, k)
        title.location = Vector((0, -20 * (1 - p), 4))
        L.hide(shadow, p < 1)
        bar.scale = (56 * L.ease_back(L.seg(t, SLAM + 0.2, SLAM + 0.7)) + 0.01, 1, 3.2)
        burst.rotation_euler = Euler((0, t * 0.12, 0))
        for i, tk in enumerate(tanks):
            q = L.ease_back(L.seg(t, SLAM + 0.5 + i * 0.12, SLAM + 0.9 + i * 0.12))
            tk.location.z = -40 + 24 * q
        cam = Vector((0, -60 + 4 * L.seg(t, SLAM, s.dur), 0)) + L.shake(t, SLAM, 1.4, 5)
        s.look(cam, (0, 0, 0))

    update(0)
    return s
