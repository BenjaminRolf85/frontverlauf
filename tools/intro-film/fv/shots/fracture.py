"""
9 Die Front zerbricht (70-76 s): die alte Karte reisst entlang der Kreidegrenze, zerfaellt in fuenf Scherben in den
Farben der Menschenfraktionen, die Scherben treiben auseinander, auf jeder steht eine Figur der Fraktion.
9 The front breaks (70-76 s): the old map tears along the chalk border, falls apart into five shards in the colours of
the human factions, the shards drift apart, each carries a figure of its faction.
"""
import math
import random

from mathutils import Euler, Vector

from .. import lib as L
from .chalk import FACTIONS, map_material

CRACK = 1.2


def build():
    s = L.Shot(L.shot_dur('fracture'))
    R = random.Random(61)
    s.toon.set_light((0.42, 0.36, 0.42, 1), (0.78, 0.7, 0.66, 1), (1.0, 0.95, 0.85, 1))
    s.sunlight(rot=(0.55, 0.25, 0.9))
    L.sky(s, [(-1, 'ink900'), (1, 'ink800')])
    L.prim(s, 'cube', L.toon(s, 'ink800'), loc=(0, 0, -30), size=(600, 600, 2), ink=False)
    s.look((0, -40, 80), (0, 0, 0))
    # fuenf Keile um einen versetzten Mittelpunkt / five wedges around an offset centre
    c = Vector((4, -3, 0))
    corners = [Vector(p) for p in ((-48, -35, 0), (48, -35, 0), (48, 35, 0), (-48, 35, 0))]
    angles = [math.radians(a) for a in (-100, -20, 50, 120, 190)]

    def edge_point(a):
        d = Vector((math.cos(a), math.sin(a), 0))
        best = None
        for k in range(200):
            p = c + d * k
            if abs(p.x) > 48 or abs(p.y) > 35:
                return Vector((max(-48, min(48, p.x)), max(-35, min(35, p.y)), 0))
        return best

    shards = []
    for i, f in enumerate(FACTIONS):
        a0, a1 = angles[i], angles[(i + 1) % 5] + (2 * math.pi if i == 4 else 0)
        pts = [c.copy()]
        steps = 8
        for k in range(steps + 1):
            a = a0 + (a1 - a0) * k / steps
            pts.append(edge_point(a))
        # Rand gezackt / jagged edge
        verts = []
        for j, p in enumerate(pts):
            jit = Vector((R.uniform(-1.2, 1.2), R.uniform(-1.2, 1.2), 0)) if 0 < j < len(pts) - 1 and j in (1, len(pts) - 1) else Vector()
            verts.append(p + jit)
        mid = sum(verts, Vector()) / len(verts)
        top = [v - mid for v in verts]
        nv = len(top)
        vs = [(v.x, v.y, 0.6) for v in top] + [(v.x, v.y, -0.6) for v in top]
        faces = [tuple(range(nv)), tuple(reversed(range(nv, 2 * nv)))] + [(k, (k + 1) % nv, nv + (k + 1) % nv, nv + k) for k in range(nv)]
        mat = map_material(s, tint=L.mix(L.fac(f), (1, 1, 1, 1), 0.25), amount=0.8, name='map_' + f)
        ob = L.mesh_obj(s, 'shard_' + f, vs, faces, mat, loc=mid, ink=True, px=3.0)
        fig = L.model(s, 'infantry_%s' % f, loc=(0, 0, 0.6), rot=R.uniform(0, 360), scale=2.2)
        fig.parent = ob
        dirv = (mid - c).normalized()
        shards.append((ob, Vector(mid), dirv, R.uniform(-0.25, 0.25), R.uniform(0.6, 1.0)))
    # Kreide-Riss: Blitz entlang der Grenze / chalk crack: flash along the border
    crack = L.beam(s, L.flat('chalk'), (-40, -30, 1), (40, 30, 1), radius=0.7, segments=6, ink=True)

    @s.on
    def update(t):
        d = t - CRACK
        for ob, mid, dirv, spin, sp in shards:
            p = L.ease_out(L.seg(d, 0, 4.0))
            jolt = math.sin(t * 40) * 0.4 * L.seg(t, CRACK - 0.6, CRACK) * (1 - L.seg(t, CRACK, CRACK + 0.01))
            ob.location = mid + dirv * (26 * p * sp + jolt) + Vector((0, 0, -10 * p * p))
            ob.rotation_euler = Euler((dirv.y * 0.25 * p, -dirv.x * 0.25 * p, spin * p))
        L.hide(crack, not (CRACK - 0.05 < t < CRACK + 0.35))
        pz = L.ease_io(L.seg(t, 0, s.dur))
        s.look(Vector((0, -46 - 20 * pz, 82 + 30 * pz)) + L.shake(t, CRACK, 1.6, 4), (0, 0, 0))

    update(0)
    return s
