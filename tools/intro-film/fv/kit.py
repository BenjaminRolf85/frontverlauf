"""
Wiederverwendbare Szenenteile: Gelaende, Explosionen, Truemmer, Flaggen, Meer, Wolken, Lichtbogen.
Reusable scene parts: terrain, explosions, debris, flags, sea, clouds, arcs.
"""
import math
import random

import bpy
from mathutils import Euler, Vector

from . import lib as L


def hills(amp=3.0, freq=0.02, seed=0):
    """Weiche Huegel als Hoehenfunktion / soft hills as a height function"""
    def h(x, y):
        return amp * (math.sin(x * freq + seed) * math.cos(y * freq * 0.8 + seed * 0.5) + 0.5 * math.sin(x * freq * 2.3 + y * freq * 1.7 + seed))
    return h


def dunes(amp=4.0):
    def h(x, y):
        return amp * (math.sin(x * 0.035 + math.sin(y * 0.02) * 2) * 0.6 + math.sin(y * 0.05 + x * 0.01) * 0.4) + amp
    return h


class Boom:
    """Comic-Explosion: Feuerball (unbeleuchtet), Rauchring, Funken / comic explosion: fireball (unlit), smoke ring, sparks"""

    def __init__(self, shot, at, loc, size=6.0, seed=1, smoke=True, n=7):
        R = random.Random(seed)
        self.at, self.loc, self.size = at, Vector(loc), size
        hot, fire, smk = L.flat('fireHot'), L.flat('fire'), L.toon(shot, 'smoke700')
        self.balls = []
        for i in range(n):
            mat = hot if i % 3 == 0 else fire
            ob = L.prim(shot, 'ico', mat, loc=loc, size=1.0, sub=1, px=3.0 / max(1.0, size * 0.5))
            d = Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(0.2, 1.2))).normalized()
            self.balls.append((ob, d, R.uniform(0.5, 1.0), R.uniform(0.0, 0.15)))
        self.smoke = []
        if smoke:
            for i in range(n):
                ob = L.prim(shot, 'ico', smk, loc=loc, size=1.0, sub=1, px=3.0 / max(1.0, size * 0.5))
                d = Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(0.6, 1.5))).normalized()
                self.smoke.append((ob, d, R.uniform(0.6, 1.1)))
        self.sparks = []
        for i in range(10):
            ob = L.prim(shot, 'cube', hot, loc=loc, size=1.0, ink=False)
            d = Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(0.5, 1.6)))
            self.sparks.append((ob, d))

    def update(self, t):
        d = t - self.at
        S = self.size
        for ob, dirv, sz, delay in self.balls:
            p = L.seg(d - delay, 0, 0.9)
            on = 0 < d - delay < 0.9
            r = S * sz * math.sin(min(1, p * 2.2) * math.pi / 2) * (1 - L.ease_in(L.seg(p, 0.55, 1)))
            ob.scale = (max(r, 0.001),) * 3 if on else (0.001,) * 3
            ob.location = self.loc + dirv * S * 0.6 * L.ease_out(p)
        for ob, dirv, sz in self.smoke:
            p = L.seg(d, 0.25, 2.6)
            on = 0.25 < d < 2.6
            r = S * 0.9 * sz * math.sin(min(1, p * 2) * math.pi / 2) * (1 - L.seg(p, 0.7, 1))
            ob.scale = (max(r, 0.001),) * 3 if on else (0.001,) * 3
            ob.location = self.loc + dirv * S * (0.5 + 1.2 * L.ease_out(p)) + Vector((0, 0, S * p))
        for ob, v in self.sparks:
            p = d
            on = 0 < d < 0.8
            ob.scale = (S * 0.06,) * 3 if on else (0.001,) * 3
            ob.location = self.loc + v * S * 2.2 * p + Vector((0, 0, -S * 2.0 * p * p))


class Debris:
    """Ballistische Truemmerbrocken / ballistic debris chunks"""

    def __init__(self, shot, at, loc, n=14, speed=20, size=(0.4, 1.4), color='smoke700', seed=2, gravity=20, glow=0.0):
        R = random.Random(seed)
        self.at, self.loc, self.g = at, Vector(loc), gravity
        mat = L.toon(shot, color, glow=glow)
        self.items = []
        for i in range(n):
            s = R.uniform(*size)
            ob = L.prim(shot, 'cube', mat, loc=loc, size=(s, s * R.uniform(0.5, 1.2), s * R.uniform(0.4, 1)), px=3.0)
            v = Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(0.6, 1.5))).normalized() * speed * R.uniform(0.5, 1.1)
            spin = Vector((R.uniform(-6, 6), R.uniform(-6, 6), R.uniform(-6, 6)))
            self.items.append((ob, v, spin))

    def update(self, t):
        d = t - self.at
        for ob, v, spin in self.items:
            if d < 0:
                L.hide(ob, True)
                continue
            L.hide(ob, False)
            p = self.loc + v * d + Vector((0, 0, -0.5 * self.g * d * d))
            if p.z < 0:
                p.z = 0
            ob.location = p
            ob.rotation_euler = Euler((spin.x * min(d, 2), spin.y * min(d, 2), spin.z * min(d, 2)))


def flag(shot, color, loc, w=6.0, h=4.0, pole=12.0, stripe=None, seg=10, px=3.0):
    """Flagge mit Mast; wehen() bewegt das Tuch / flag with a pole; wave() moves the cloth"""
    L.prim(shot, 'cyl', L.toon(shot, 'ink700'), loc=(loc[0], loc[1], loc[2] + pole / 2), size=(0.35, 0.35, pole), segments=8, px=px)
    verts, faces = [], []
    for j in range(3):
        for i in range(seg + 1):
            verts.append((i / seg * w, 0, -j / 2 * h))
    for j in range(2):
        for i in range(seg):
            a = j * (seg + 1) + i
            faces.append((a, a + 1, a + seg + 2, a + seg + 1))
    mat = L.toon(shot, color)
    ob = L.mesh_obj(shot, 'flag', verts, faces, mat, loc=(loc[0] + 0.2, loc[1], loc[2] + pole - 0.2))
    if stripe:
        sm = L.toon(shot, stripe)
        ob.data.materials.append(sm)
        for k, p in enumerate(ob.data.polygons):
            p.material_index = 1 if (k % seg) in (seg // 2 - 1, seg // 2) else 0
    ob.data.materials.append(L.ink_mat())
    mod = ob.modifiers.new('ink', 'SOLIDIFY')
    mod.thickness = -shot.px((ob.location - shot.cam.location).length) * px * L.HULL
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(ob.data.materials) - 1
    base = [Vector(v) for v in verts]
    ph = random.random() * 6

    def wave(t, amp=0.9):
        for i, v in enumerate(ob.data.vertices):
            b = base[i]
            k = b.x / w
            v.co = (b.x, math.sin(t * 6 + k * 5 + ph) * amp * k, b.z + math.sin(t * 4 + k * 4) * 0.2 * k)
        ob.data.update()
    return ob, wave


class Sea:
    """Meer als Gitter mit animierten Wellen / sea as a grid with animated waves"""

    def __init__(self, shot, size=600, sub=50, color='sea', amp=0.8, loc=(0, 0, 0)):
        self.ob = L.ground(shot, L.toon(shot, color), size=size, sub=sub, loc=loc, name='sea')
        self.base = [Vector(v.co) for v in self.ob.data.vertices]
        self.amp = amp

    def update(self, t):
        for i, v in enumerate(self.ob.data.vertices):
            b = self.base[i]
            v.co.z = self.amp * (math.sin(b.x * 0.08 + t * 1.6) + 0.6 * math.sin(b.y * 0.11 - t * 1.2 + b.x * 0.03))
        self.ob.data.update()


def clouds(shot, n, area, z, color='cloud300', scale=(30, 60), seed=4, glow=0.0):
    """Wolken aus Spielmodellen, eingefaerbt / clouds from game models, tinted"""
    R = random.Random(seed)
    mat = L.toon_attr(shot, tint=color, amount=0.85) if color else None
    out = []
    for i in range(n):
        x = R.uniform(area[0], area[1])
        y = R.uniform(area[2], area[3])
        ob = L.model(shot, 'cloud_%d' % (i % 3), loc=(x, y, z + R.uniform(-8, 8)), rot=R.uniform(0, 360), scale=R.uniform(*scale) / 10, mat=mat)
        out.append(ob)
    return out


def arc(shot, a, b, n=7, color='velkarArc', jitter=1.0, radius=0.25):
    """Zickzack-Lichtbogen aus Strahlstuecken / zigzag arc from beam pieces"""
    mat = L.flat(color)
    segs = [L.beam(shot, mat, a, b, radius=radius, segments=6, ink=False) for _ in range(n)]
    a, b = Vector(a), Vector(b)

    def update(t, on=True, aa=None, bb=None):
        A = Vector(aa) if aa is not None else a
        B = Vector(bb) if bb is not None else b
        R = random.Random(int(t * 24))
        pts = [A]
        for i in range(1, n):
            p = A.lerp(B, i / n) + Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(-1, 1))) * jitter
            pts.append(p)
        pts.append(B)
        for i, sg in enumerate(segs):
            L.set_beam(sg, pts[i], pts[i + 1], radius if on else 0.0001)
    return update


def ballistic(p0, v, t, g=9.8):
    return Vector(p0) + Vector(v) * t + Vector((0, 0, -0.5 * g * t * t))


def bob(ob, base, t, amp=0.3, freq=8.0, ph=0.0):
    ob.location = Vector(base) + Vector((0, 0, abs(math.sin(t * freq + ph)) * amp))


def unit_row(shot, name, n, start, step, rot=0.0, scale=1.6, jitter=0.0, seed=1, mat=None):
    R = random.Random(seed)
    out = []
    for i in range(n):
        p = Vector(start) + Vector(step) * i + Vector((R.uniform(-jitter, jitter), R.uniform(-jitter, jitter), 0))
        out.append(L.model(shot, name, loc=p, rot=rot + R.uniform(-8, 8) * (1 if jitter else 0), scale=scale, mat=mat))
    return out


def set_alpha(mat, a):
    mat.node_tree.nodes['mix'].inputs[0].default_value = a


def set_strength(mat, v):
    mat.node_tree.nodes['em'].inputs[1].default_value = v


def set_color(mat, c):
    mat.node_tree.nodes['em'].inputs[0].default_value = L.rgb(c) if isinstance(c, str) else c


def ground_obj_height(ob, h):
    """Objekt auf das Gelaende setzen / put an object onto the terrain"""
    ob.location.z = h(ob.location.x, ob.location.y)
    return ob


def emission_ramp(shot, name, stops):
    """Verlaufsmaterial nach Hoehe (z, lokal), unbeleuchtet / gradient material by height (local z), unlit"""
    m = bpy.data.materials.new(name)
    nt, n, Lk = L._nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    tc = n.new('ShaderNodeTexCoord')
    sep = n.new('ShaderNodeSeparateXYZ')
    Lk.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], L.rgb(stops[0][1])
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], L.rgb(stops[-1][1])
    for p, c in stops[1:-1]:
        e = cr.elements.new(p)
        e.color = L.rgb(c)
    Lk.new(sep.outputs[2], ramp.inputs[0])
    em = n.new('ShaderNodeEmission')
    Lk.new(ramp.outputs[0], em.inputs[0])
    Lk.new(em.outputs[0], out.inputs[0])
    return m
