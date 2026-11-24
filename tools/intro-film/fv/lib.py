"""
Gemeinsame Bausteine des Introfilms in Blender: Szene, Comic-Material (Stufen-Schattierung, Rasterpunkte, Leuchten),
Tuschekontur (Inverted Hull), Spielmodelle aus dem Export, Himmel, Effekte und Kamerahilfen.
Shared building blocks of the intro film in Blender: scene, comic material (banded shading, halftone dots, glow),
ink outline (inverted hull), game models from the export, sky, effects and camera helpers.

Alle Farben kommen aus src/design/tokens.ts (ueber .cache/tokens.json, siehe export-models.mjs).
All colours come from src/design/tokens.ts (via .cache/tokens.json, see export-models.mjs).

Massstab: 1 Brettfeld des Spiels = 10 Blender-Einheiten (Meter), z zeigt nach oben.
Scale: 1 game board tile = 10 Blender units (metres), z points up.
"""
import base64
import json
import math
import os
import random

import bpy
import numpy as np
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(HERE, '.cache')
FPS = 12
TILE = 10.0
HULL = float(os.environ.get("FV_HULL", "2.2"))

_TOK = None


def tokens():
    global _TOK
    if _TOK is None:
        with open(os.path.join(CACHE, 'tokens.json')) as fh:
            _TOK = json.load(fh)
    return _TOK


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(value, mul=1.0):
    """Hex-Farbe oder Tokenname -> lineares RGBA / hex colour or token name -> linear RGBA"""
    if not value.startswith('#'):
        t = tokens()
        value = t['intro'].get(value) or t['semantic'].get(value) or t['color'][value]
    h = value.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (_lin(r) * mul, _lin(g) * mul, _lin(b) * mul, 1.0)


def fac(f, key='primary'):
    return rgb(tokens()['faction'][f][key])


def mix(a, b, p):
    return tuple(a[i] + (b[i] - a[i]) * p for i in range(4))


# ---------- Zeit und Kurven / time and curves ----------
def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def seg(t, a, b):
    return clamp((t - a) / (b - a)) if b != a else (1.0 if t >= b else 0.0)


def lerp(a, b, p):
    return a + (b - a) * p


def vlerp(a, b, p):
    return Vector(a).lerp(Vector(b), p)


def ease_io(p):
    return 4 * p * p * p if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def ease_out(p):
    return 1 - (1 - p) ** 3


def ease_in(p):
    return p * p * p


def ease_back(p):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2


def shake(t, at, amp, decay=7.0):
    """Kamerawackeln nach einem Treffer / camera shake after a hit"""
    d = t - at
    if d < 0 or d > 1.2:
        return Vector((0, 0, 0))
    a = amp * math.exp(-d * decay)
    return Vector((math.sin(d * 71 + at) * a, math.cos(d * 53 + at * 1.7) * a, math.sin(d * 37 + at * 0.3) * a * 0.6))


# ---------- Szene / scene ----------
class Shot:
    """Rahmen einer Einstellung: Szene, Kamera, Aktualisierung je Bild / frame of a shot: scene, camera, update per frame"""

    def __init__(self, dur, w=1280, h=720, samples=1):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.sc = sc = bpy.context.scene
        self.dur = dur
        self.w, self.h = w, h
        sc.render.engine = 'BLENDER_EEVEE'
        sc.eevee.taa_render_samples = samples
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
        sc.render.fps = FPS
        sc.frame_start, sc.frame_end = 1, int(round(dur * FPS))
        sc.render.filter_size = 0.9
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGB'
        sc.render.image_settings.compression = 15
        sc.render.film_transparent = False
        # grobe Schatten genuegen im Comic-Look und halbieren die Rechenzeit / coarse shadows suit the comic look and halve the render time
        sc.eevee.shadow_resolution_scale = 0.25
        self.updaters = []
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        sc.collection.objects.link(cam)
        cam.data.lens = 35
        cam.data.clip_start = 0.1
        cam.data.clip_end = 4000
        cam.data.sensor_fit = 'HORIZONTAL'
        sc.camera = cam
        self.cam = cam
        self.sun = None
        self.toon = ToonGroup()

    @property
    def frames(self):
        return self.sc.frame_end

    def on(self, fn):
        """fn(t) wird vor jedem Bild aufgerufen / fn(t) runs before every frame"""
        self.updaters.append(fn)
        return fn

    def update(self, t):
        for fn in self.updaters:
            fn(t)

    def look(self, pos, target, roll=0.0):
        self.cam.location = Vector(pos)
        d = Vector(target) - Vector(pos)
        q = d.to_track_quat('-Z', 'Y')
        self.cam.rotation_euler = q.to_euler()
        if roll:
            self.cam.rotation_euler.rotate_axis('Z', roll)

    def sunlight(self, rot=(0.8, 0.2, 0.6), strength=math.pi, angle=0.02):
        if self.sun is None:
            self.sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
            self.sc.collection.objects.link(self.sun)
        self.sun.rotation_euler = Euler(rot)
        self.sun.data.energy = strength
        self.sun.data.angle = angle
        self.sun.data.shadow_maximum_resolution = 0.2
        return self.sun

    def px(self, dist):
        """Weltgroesse eines Bildpunkts in Entfernung dist / world size of one pixel at distance dist"""
        fov = 2 * math.atan(self.cam.data.sensor_width / (2 * self.cam.data.lens))
        return 2 * dist * math.tan(fov / 2) / self.w

    def render(self, out_dir, first=1, last=None, every=1):
        os.makedirs(out_dir, exist_ok=True)
        last = last or self.frames
        import time
        for f in range(first, last + 1, every):
            t = (f - 1) / FPS
            if os.environ.get('FV_RESUME') and os.path.exists(os.path.join(out_dir, '%04d.png' % f)):
                continue
            self.sc.frame_set(f)
            self.update(t)
            self.sc.render.filepath = os.path.join(out_dir, '%04d.png' % f)
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            print('FRAME %d/%d %.1fs' % (f, self.frames, time.time() - t0), flush=True)


# ---------- Material / material ----------
def _nodes(m):
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return nt, nt.nodes, nt.links


class ToonGroup:
    """
    Gemeinsame Knotengruppe aller Comic-Materialien. Globale Regler (je Bild aenderbar): Licht der Stufen, Rasterpunkte,
    Fensterlicht, Leuchtstaerke. Shared node group of all comic materials. Global controls (changeable per frame):
    band light, halftone dots, window light, glow strength.
    """

    def __init__(self):
        g = bpy.data.node_groups.new('ToonCore', 'ShaderNodeTree')
        self.g = g
        g.interface.new_socket('Base', in_out='INPUT', socket_type='NodeSocketColor')
        g.interface.new_socket('Glow', in_out='INPUT', socket_type='NodeSocketFloat')
        g.interface.new_socket('Win', in_out='INPUT', socket_type='NodeSocketFloat')
        g.interface.new_socket('Color', in_out='OUTPUT', socket_type='NodeSocketColor')
        n, L = g.nodes, g.links
        gi = n.new('NodeGroupInput')
        go = n.new('NodeGroupOutput')

        def val(name, v):
            x = n.new('ShaderNodeValue')
            x.name = x.label = name
            x.outputs[0].default_value = v
            return x

        def col(name, v):
            x = n.new('ShaderNodeRGB')
            x.name = x.label = name
            x.outputs[0].default_value = v
            return x

        self.shadow = col('shadow', (0.50, 0.47, 0.62, 1))
        self.mid = col('mid', (0.80, 0.78, 0.86, 1))
        self.lit = col('lit', (1.0, 1.0, 1.0, 1))
        self.dots_col = col('dots_col', (0.74, 0.74, 0.8, 1))
        self.win_col = col('win_col', rgb('window300'))
        self.t1 = val('t1', 0.10)
        self.t2 = val('t2', 0.42)
        self.dots = val('dots', 1.0)
        self.win = val('win', 0.0)
        self.glow = val('glow', 1.0)
        self.cell = val('cell', 1280 / 6.0)

        dif = n.new('ShaderNodeBsdfDiffuse')
        dif.inputs[0].default_value = (1, 1, 1, 1)
        s2r = n.new('ShaderNodeShaderToRGB')
        L.new(dif.outputs[0], s2r.inputs[0])
        bw = n.new('ShaderNodeRGBToBW')
        L.new(s2r.outputs[0], bw.inputs[0])

        def cmpgt(a, b):
            m = n.new('ShaderNodeMath')
            m.operation = 'GREATER_THAN'
            L.new(a, m.inputs[0])
            L.new(b, m.inputs[1])
            return m.outputs[0]

        def mixc(fac_out, a, b):
            m = n.new('ShaderNodeMix')
            m.data_type = 'RGBA'
            L.new(fac_out, m.inputs['Factor'])
            L.new(a, m.inputs[6])
            L.new(b, m.inputs[7])
            return m.outputs[2]

        above1 = cmpgt(bw.outputs[0], self.t1.outputs[0])
        above2 = cmpgt(bw.outputs[0], self.t2.outputs[0])
        band = mixc(above1, self.shadow.outputs[0], self.mid.outputs[0])
        band = mixc(above2, band, self.lit.outputs[0])

        # Rasterpunkte im Bildraum, um 45 Grad gedreht / halftone dots in screen space, rotated 45 degrees
        tc = n.new('ShaderNodeTexCoord')
        asp = n.new('ShaderNodeCombineXYZ')
        L.new(self.cell.outputs[0], asp.inputs[0])
        div = n.new('ShaderNodeMath')
        div.operation = 'MULTIPLY'
        div.inputs[1].default_value = 9 / 16
        L.new(self.cell.outputs[0], div.inputs[0])
        L.new(div.outputs[0], asp.inputs[1])
        asp.inputs[2].default_value = 1
        sc_ = n.new('ShaderNodeVectorMath')
        sc_.operation = 'MULTIPLY'
        L.new(tc.outputs['Window'], sc_.inputs[0])
        L.new(asp.outputs[0], sc_.inputs[1])
        rot = n.new('ShaderNodeVectorRotate')
        rot.rotation_type = 'Z_AXIS'
        rot.inputs['Angle'].default_value = math.radians(45)
        L.new(sc_.outputs[0], rot.inputs['Vector'])
        fr = n.new('ShaderNodeVectorMath')
        fr.operation = 'FRACTION'
        L.new(rot.outputs[0], fr.inputs[0])
        sub = n.new('ShaderNodeVectorMath')
        sub.operation = 'SUBTRACT'
        sub.inputs[1].default_value = (0.5, 0.5, 0)
        L.new(fr.outputs[0], sub.inputs[0])
        sep = n.new('ShaderNodeSeparateXYZ')
        L.new(sub.outputs[0], sep.inputs[0])
        cxy = n.new('ShaderNodeCombineXYZ')
        L.new(sep.outputs[0], cxy.inputs[0])
        L.new(sep.outputs[1], cxy.inputs[1])
        ln = n.new('ShaderNodeVectorMath')
        ln.operation = 'LENGTH'
        L.new(cxy.outputs[0], ln.inputs[0])
        # Radius: gross im Schatten, klein im Mittelton, keiner im Licht / radius: big in shadow, small in mid tone, none in light
        def inv(x):
            m = n.new('ShaderNodeMath')
            m.operation = 'SUBTRACT'
            m.inputs[0].default_value = 1.0
            L.new(x, m.inputs[1])
            return m.outputs[0]

        def madd(x, k, y=None):
            m = n.new('ShaderNodeMath')
            m.operation = 'MULTIPLY_ADD'
            L.new(x, m.inputs[0])
            m.inputs[1].default_value = k
            if y is None:
                m.inputs[2].default_value = 0.0
            else:
                L.new(y, m.inputs[2])
            return m.outputs[0]

        r_mid = madd(inv(above2), 0.2)
        r_all = madd(inv(above1), 0.14, r_mid)
        rad2 = n.new('ShaderNodeMath')
        rad2.operation = 'MULTIPLY'
        L.new(r_all, rad2.inputs[0])
        L.new(self.dots.outputs[0], rad2.inputs[1])
        dot = cmpgt(rad2.outputs[0], ln.outputs['Value'])
        dotted = n.new('ShaderNodeMix')
        dotted.data_type = 'RGBA'
        dotted.blend_type = 'MULTIPLY'
        L.new(dot, dotted.inputs['Factor'])
        L.new(band, dotted.inputs[6])
        L.new(self.dots_col.outputs[0], dotted.inputs[7])

        shaded = n.new('ShaderNodeMix')
        shaded.data_type = 'RGBA'
        shaded.blend_type = 'MULTIPLY'
        shaded.inputs['Factor'].default_value = 1
        L.new(gi.outputs['Base'], shaded.inputs[6])
        L.new(dotted.outputs[2], shaded.inputs[7])
        # Eigenleuchten: Grundfarbe ungeschattet und heller / self glow: base colour unshaded and brighter
        gl = n.new('ShaderNodeMath')
        gl.operation = 'MULTIPLY'
        gl.use_clamp = True
        L.new(gi.outputs['Glow'], gl.inputs[0])
        L.new(self.glow.outputs[0], gl.inputs[1])
        bright = n.new('ShaderNodeMix')
        bright.data_type = 'RGBA'
        bright.blend_type = 'SCREEN'
        bright.inputs['Factor'].default_value = 0.35
        L.new(gi.outputs['Base'], bright.inputs[6])
        L.new(gi.outputs['Base'], bright.inputs[7])
        out1 = mixc(gl.outputs[0], shaded.outputs[2], bright.outputs[2])
        # Fensterlicht / window light
        wl = n.new('ShaderNodeMath')
        wl.operation = 'MULTIPLY'
        wl.use_clamp = True
        L.new(gi.outputs['Win'], wl.inputs[0])
        L.new(self.win.outputs[0], wl.inputs[1])
        wl2 = n.new('ShaderNodeMath')
        wl2.operation = 'MULTIPLY'
        wl2.inputs[1].default_value = 2.0
        wl2.use_clamp = True
        L.new(wl.outputs[0], wl2.inputs[0])
        out2 = mixc(wl2.outputs[0], out1, self.win_col.outputs[0])
        L.new(out2, go.inputs['Color'])

    def set_light(self, shadow, mid, lit=(1, 1, 1, 1), dots=None):
        self.shadow.outputs[0].default_value = shadow
        self.mid.outputs[0].default_value = mid
        self.lit.outputs[0].default_value = lit
        self.dots_col.outputs[0].default_value = dots or (0.74, 0.74, 0.8, 1)

    def night(self):
        self.set_light((0.16, 0.17, 0.30, 1), (0.30, 0.32, 0.50, 1), (0.55, 0.58, 0.80, 1))

    def day(self):
        self.set_light((0.50, 0.47, 0.62, 1), (0.80, 0.78, 0.86, 1))


_MATS = {}


def toon_attr(shot, name='toon_attr', tint=None, amount=0.5):
    """
    Comic-Material mit Vertexfarben der Spielmodelle; tint faerbt Richtung einer Farbe (Rost, Verdan-Rot).
    Objekt-Eigenschaften lightsoff/glowoff (0..1) schalten Fenster und Leuchten je Objekt aus.
    Comic material with the game models' vertex colours; tint shifts towards a colour (rust, Verdan red).
    Object properties lightsoff/glowoff (0..1) switch windows and glow off per object.
    """
    key = name if tint is None else '%s_%s_%.2f' % (name, tint, amount)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    ca = n.new('ShaderNodeAttribute')
    ca.attribute_name = 'Col'
    ga = n.new('ShaderNodeAttribute')
    ga.attribute_name = 'glow'
    sep = n.new('ShaderNodeSeparateXYZ')
    L.new(ga.outputs['Vector'], sep.inputs[0])
    base = ca.outputs['Color']
    if tint is not None:
        mx = n.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = 'MIX'
        mx.inputs['Factor'].default_value = amount
        L.new(base, mx.inputs[6])
        mx.inputs[7].default_value = rgb(tint) if isinstance(tint, str) else tint
        base = mx.outputs[2]

    def off(prop, src):
        oa = n.new('ShaderNodeAttribute')
        oa.attribute_type = 'OBJECT'
        oa.attribute_name = prop
        inv = n.new('ShaderNodeMath')
        inv.operation = 'SUBTRACT'
        inv.inputs[0].default_value = 1.0
        L.new(oa.outputs['Fac'], inv.inputs[1])
        mul = n.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        L.new(src, mul.inputs[0])
        L.new(inv.outputs[0], mul.inputs[1])
        return mul.outputs[0]

    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g
    L.new(base, tg.inputs['Base'])
    L.new(off('glowoff', sep.outputs[0]), tg.inputs['Glow'])
    L.new(off('lightsoff', sep.outputs[1]), tg.inputs['Win'])
    em = n.new('ShaderNodeEmission')
    L.new(tg.outputs[0], em.inputs[0])
    L.new(em.outputs[0], out.inputs[0])
    _MATS[key] = m
    return m


def toon(shot, color, name=None, glow=0.0):
    """Comic-Material in einer Farbe; color ist Token, Hex oder RGBA / comic material in one colour"""
    c = rgb(color) if isinstance(color, str) else tuple(color)
    key = name or 'toon_%s_%.2f' % (','.join('%.3f' % x for x in c), glow)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    cc = n.new('ShaderNodeRGB')
    cc.name = 'base'
    cc.outputs[0].default_value = c
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g
    L.new(cc.outputs[0], tg.inputs['Base'])
    tg.inputs['Glow'].default_value = glow
    em = n.new('ShaderNodeEmission')
    L.new(tg.outputs[0], em.inputs[0])
    L.new(em.outputs[0], out.inputs[0])
    _MATS[key] = m
    return m


def flat(color, name=None, strength=1.0, alpha=None):
    """Ungeschattete Farbe (Feuer, Strahl, Himmel); mit alpha halbtransparent / unshaded colour; with alpha translucent"""
    c = rgb(color) if isinstance(color, str) else tuple(color)
    key = name or 'flat_%s_%.2f_%s' % (','.join('%.3f' % x for x in c), strength, alpha)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    em = n.new('ShaderNodeEmission')
    em.name = 'em'
    em.inputs[0].default_value = c
    em.inputs[1].default_value = strength
    if alpha is None:
        L.new(em.outputs[0], out.inputs[0])
    else:
        tr = n.new('ShaderNodeBsdfTransparent')
        mx = n.new('ShaderNodeMixShader')
        mx.name = 'mix'
        mx.inputs[0].default_value = alpha
        L.new(tr.outputs[0], mx.inputs[1])
        L.new(em.outputs[0], mx.inputs[2])
        L.new(mx.outputs[0], out.inputs[0])
        try:
            m.surface_render_method = 'BLENDED'
        except AttributeError:
            m.blend_method = 'BLEND'
        m.use_backface_culling = False
    _MATS[key] = m
    return m


def ink_mat():
    if 'ink' in _MATS:
        return _MATS['ink']
    m = bpy.data.materials.new('ink')
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    em = n.new('ShaderNodeEmission')
    em.inputs[0].default_value = rgb('ink')
    L.new(em.outputs[0], out.inputs[0])
    m.use_backface_culling = True
    _MATS['ink'] = m
    return m


def outline(shot, ob, px=2.4, dist=None, thickness=None):
    """Tuschekontur als umgedrehte Huelle / ink outline as an inverted hull"""
    if thickness is None:
        if dist is None:
            dist = (ob.matrix_world.translation - shot.cam.location).length
        thickness = shot.px(max(dist, 1.0)) * px
    if ink_mat().name not in [s.name for s in ob.data.materials if s]:
        ob.data.materials.append(ink_mat())
    mod = ob.modifiers.get('ink') or ob.modifiers.new('ink', 'SOLIDIFY')
    mod.thickness = -thickness / max(1e-6, max(ob.scale))
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(ob.data.materials) - 1
    mod.use_even_offset = False
    return ob


# ---------- Spielmodelle / game models ----------
_MESH = {}


def _arr(b64, dtype=np.float32):
    return np.frombuffer(base64.b64decode(b64), dtype=dtype)


def model_mesh(name):
    """Spielmodell als Blender-Mesh (geteilt) / game model as a Blender mesh (shared)"""
    if name in _MESH:
        return _MESH[name]
    with open(os.path.join(CACHE, 'models', name + '.json')) as fh:
        d = json.load(fh)
    p = _arr(d['pos']).reshape(-1, 3).astype(np.float64)
    nrm = _arr(d['nor']).reshape(-1, 3)
    col = _arr(d['col']).reshape(-1, 3)
    glow = _arr(d['glow']).reshape(-1, 2)
    # three (y oben) -> Blender (z oben), Massstab / three (y up) -> Blender (z up), scale
    pb = np.stack([p[:, 0], -p[:, 2], p[:, 1]], 1) * TILE
    nb = np.stack([nrm[:, 0], -nrm[:, 2], nrm[:, 1]], 1)
    q = np.round(pb / 1e-3).astype(np.int64)
    uniq, inv = np.unique(q, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    verts = np.zeros((len(uniq), 3))
    np.add.at(verts, inv, pb)
    cnt = np.bincount(inv, minlength=len(uniq)).reshape(-1, 1)
    verts /= cnt
    tri = inv.reshape(-1, 3)
    ok = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
    corner_ok = np.repeat(ok, 3)
    tri = tri[ok]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], tri.tolist())
    me.update()
    nl = len(me.loops)
    c = col[corner_ok]
    rgba = np.concatenate([c, np.ones((len(c), 1), np.float32)], 1).astype(np.float32)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    if len(rgba) == nl:
        ca.data.foreach_set('color', rgba.ravel())
        ga = me.attributes.new('glow', 'FLOAT2', 'CORNER')
        ga.data.foreach_set('vector', glow[corner_ok].astype(np.float32).ravel())
        try:
            me.normals_split_custom_set([tuple(v) for v in nb[corner_ok]])
        except Exception as e:  # noqa: BLE001
            print('normals', name, e)
    else:
        print('WARN loop count mismatch', name, nl, len(rgba))
    _MESH[name] = me
    return me


def model(shot, name, loc=(0, 0, 0), rot=0.0, scale=1.0, ink=True, px=3.6, mat=None, parent=None):
    """Spielmodell in die Szene setzen; rot = Drehung um z (Grad) / place a game model; rot = rotation about z (degrees)"""
    me = model_mesh(name)
    if not me.materials:
        me.materials.append(toon_attr(shot))
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    if mat is not None:
        # eigenes Material je Objekt (z. B. Rost), das Mesh bleibt geteilt / own material per object (e.g. rust), the mesh stays shared
        ob.material_slots[0].link = 'OBJECT'
        ob.material_slots[0].material = mat
    ob.location = Vector(loc)
    ob.rotation_euler = Euler((0, 0, math.radians(rot)))
    ob.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    if parent:
        ob.parent = parent
    if ink:
        _ink_shared(shot, ob, px)
    return ob


def _ink_shared(shot, ob, px):
    # Die Huelle braucht das Tuschematerial im geteilten Mesh / the hull needs the ink material in the shared mesh
    me = ob.data
    if ink_mat().name not in [s.name for s in me.materials if s]:
        me.materials.append(ink_mat())
    dist = (ob.matrix_world.translation - shot.cam.location).length
    th = shot.px(max(dist, 1.0)) * px
    mod = ob.modifiers.new('ink', 'SOLIDIFY')
    mod.thickness = -th / max(1e-6, max(ob.scale)) * HULL
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(me.materials) - 1
    mod.use_even_offset = False


def ink_refresh(shot, obs, px=2.4):
    """Konturstaerke nach aktueller Kamera neu setzen / reset outline width for the current camera"""
    for ob in obs:
        mod = ob.modifiers.get('ink')
        if mod:
            dist = (ob.matrix_world.translation - shot.cam.location).length
            mod.thickness = -shot.px(max(dist, 1.0)) * px / max(1e-6, max(ob.scale))


# ---------- Grundformen / primitives ----------
def mesh_obj(shot, name, verts, faces, mat, loc=(0, 0, 0), ink=False, px=2.4, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    if ink:
        _ink_shared(shot, ob, px)
    return ob


def prim(shot, kind, mat, loc=(0, 0, 0), size=1.0, rot=(0, 0, 0), ink=True, px=3.6, segments=12, smooth=False, **kw):
    """Grundform ueber bmesh, ohne Operator-Kontext / primitive via bmesh, without operator context"""
    import bmesh
    bm = bmesh.new()
    if kind == 'cube':
        bmesh.ops.create_cube(bm, size=1.0)
    elif kind == 'ico':
        bmesh.ops.create_icosphere(bm, subdivisions=kw.get('sub', 1), radius=0.5)
    elif kind == 'uv':
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=max(4, segments // 2), radius=0.5)
    elif kind == 'cyl':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=0.5, radius2=kw.get('top', 0.5), depth=1.0)
    elif kind == 'cone':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=0.5, radius2=0.0, depth=1.0)
    elif kind == 'plane':
        bmesh.ops.create_grid(bm, x_segments=kw.get('sub', 1), y_segments=kw.get('sub', 1), size=0.5)
    elif kind == 'torus':
        r1, r2 = 0.5, kw.get('tube', 0.06)
        verts = []
        segs, tubes = segments * 2, 6
        for i in range(segs):
            a = 2 * math.pi * i / segs
            for j in range(tubes):
                b = 2 * math.pi * j / tubes
                verts.append(bm.verts.new(((r1 + r2 * math.cos(b)) * math.cos(a), (r1 + r2 * math.cos(b)) * math.sin(a), r2 * math.sin(b))))
        for i in range(segs):
            for j in range(tubes):
                a = i * tubes + j
                b_ = ((i + 1) % segs) * tubes + j
                c = ((i + 1) % segs) * tubes + (j + 1) % tubes
                d = i * tubes + (j + 1) % tubes
                bm.faces.new((verts[a], verts[b_], verts[c], verts[d]))
    me = bpy.data.meshes.new(kind)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(kind, me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = Euler(rot)
    ob.scale = (size, size, size) if isinstance(size, (int, float)) else size
    if ink:
        _ink_shared(shot, ob, px)
    return ob


def ground(shot, color, size=400, sub=60, height=None, loc=(0, 0, 0), ink=False, name='ground'):
    """Gelaende als Gitter mit Hoehenfunktion height(x, y) / terrain as a grid with height function height(x, y)"""
    n = sub
    verts, faces = [], []
    for j in range(n + 1):
        for i in range(n + 1):
            x = (i / n - 0.5) * size
            y = (j / n - 0.5) * size
            verts.append((x, y, height(x + loc[0], y + loc[1]) if height else 0.0))
    for j in range(n):
        for i in range(n):
            a = j * (n + 1) + i
            faces.append((a, a + 1, a + n + 2, a + n + 1))
    mat = toon(shot, color) if isinstance(color, (str, tuple)) else color
    return mesh_obj(shot, name, verts, faces, mat, loc=loc, ink=ink)


# ---------- Himmel / sky ----------
def sky(shot, stops, stars=0.0, star_col='starWarm'):
    """
    Himmel nur fuer Kamerastrahlen (Verlauf nach Hoehe), Licht kommt nur von der Sonne.
    Sky for camera rays only (gradient by height), light only comes from the sun.
    stops: [(pos -1..1, Farbe)], pos = z der Blickrichtung / pos = z of the view direction
    """
    w = bpy.data.worlds.new('sky')
    shot.sc.world = w
    nt, n, L = _nodes(w)
    out = n.new('ShaderNodeOutputWorld')
    tc = n.new('ShaderNodeTexCoord')
    sep = n.new('ShaderNodeSeparateXYZ')
    norm = n.new('ShaderNodeVectorMath')
    norm.operation = 'NORMALIZE'
    L.new(tc.outputs['Generated'], norm.inputs[0])
    L.new(norm.outputs[0], sep.inputs[0])
    mr = n.new('ShaderNodeMapRange')
    mr.inputs[1].default_value = -1
    mr.inputs[2].default_value = 1
    L.new(sep.outputs[2], mr.inputs[0])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.name = 'ramp'
    cr = ramp.color_ramp
    stops = [((p + 1) / 2, rgb(c) if isinstance(c, str) else c) for p, c in stops]
    cr.elements[0].position, cr.elements[0].color = stops[0]
    cr.elements[1].position, cr.elements[1].color = stops[-1]
    for p, c in stops[1:-1]:
        e = cr.elements.new(p)
        e.color = c
    L.new(mr.outputs[0], ramp.inputs[0])
    col = ramp.outputs[0]
    if stars:
        vor = n.new('ShaderNodeTexVoronoi')
        vor.feature = 'F1'
        vor.inputs['Scale'].default_value = 90
        L.new(norm.outputs[0], vor.inputs['Vector'])
        th = n.new('ShaderNodeMath')
        th.operation = 'LESS_THAN'
        th.inputs[1].default_value = 0.035
        L.new(vor.outputs['Distance'], th.inputs[0])
        up = n.new('ShaderNodeMath')
        up.operation = 'MULTIPLY'
        up.name = 'stars'
        up.inputs[1].default_value = stars
        L.new(th.outputs[0], up.inputs[0])
        mx = n.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        L.new(up.outputs[0], mx.inputs['Factor'])
        L.new(col, mx.inputs[6])
        mx.inputs[7].default_value = rgb(star_col)
        col = mx.outputs[2]
    bg = n.new('ShaderNodeBackground')
    L.new(col, bg.inputs[0])
    dark = n.new('ShaderNodeBackground')
    dark.inputs[0].default_value = (0, 0, 0, 1)
    lp = n.new('ShaderNodeLightPath')
    ms = n.new('ShaderNodeMixShader')
    L.new(lp.outputs['Is Camera Ray'], ms.inputs[0])
    L.new(dark.outputs[0], ms.inputs[1])
    L.new(bg.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs[0])
    return w


def sky_ramp(shot):
    return shot.sc.world.node_tree.nodes['ramp'].color_ramp


# ---------- Effekte / effects ----------
class Puffs:
    """Comic-Rauch: Kugeln, die wachsen, steigen und verblassen (schrumpfen) / comic smoke: balls that grow, rise and fade (shrink)"""

    def __init__(self, shot, n, color, origin, spread=3.0, rise=6.0, size=(1.5, 4.0), life=3.0, seed=1, wind=(0, 0, 0), px=2.0, glow=0.0, start=0.0, rate=None):
        R = random.Random(seed)
        self.items = []
        mat = toon(shot, color, glow=glow)
        # Huelle relativ zur spaeteren Groesse / hull relative to the later size
        px_eff = px / max(1.0, (size[0] + size[1]) / 2)
        for i in range(n):
            ob = prim(shot, 'ico', mat, loc=origin, size=1, sub=1, px=px_eff, ink=True)
            off = Vector((R.uniform(-spread, spread), R.uniform(-spread, spread), R.uniform(0, spread * 0.3)))
            birth = start + i * life / n
            self.items.append((ob, off, birth, R.uniform(*size), R.uniform(0.7, 1.3), R.uniform(0, 6.28)))
        self.origin, self.rise, self.life, self.wind = Vector(origin), rise, life, Vector(wind)

    def update(self, t):
        for ob, off, birth, sz, sp, ph in self.items:
            age = (t - birth) % self.life if t >= birth else -1
            if age < 0:
                ob.scale = (0.001,) * 3
                continue
            p = age / self.life
            s = sz * math.sin(min(1.0, p * 1.4) * math.pi * 0.5) * (1 - seg(p, 0.75, 1.0))
            ob.scale = (max(s, 0.001),) * 3
            ob.location = self.origin + off * (0.5 + p) + Vector((0, 0, self.rise * p * sp)) + self.wind * p
            ob.rotation_euler = Euler((ph + p, ph * 0.5, ph + p * 2))


def ring(shot, mat, loc, radius=1.0, tube=0.06, rot=(0, 0, 0), ink=True):
    return prim(shot, 'torus', mat, loc=loc, size=radius * 2, rot=rot, ink=ink, segments=24, tube=tube)


def beam(shot, mat, a, b, radius=1.0, segments=10, ink=True, px=2.0):
    """Zylinder von a nach b / cylinder from a to b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    ob = prim(shot, 'cyl', mat, loc=(a + b) / 2, size=(radius * 2, radius * 2, d.length), segments=segments, ink=ink, px=px)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def set_beam(ob, a, b, radius):
    a, b = Vector(a), Vector(b)
    d = b - a
    ob.location = (a + b) / 2
    ob.scale = (radius * 2, radius * 2, max(d.length, 0.001))
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()


def cam_plane(shot, mat, dist=1.0, scale=1.0, name='overlay'):
    """Flaeche vor der Kamera, fuellt das Bild / plane in front of the camera, fills the frame"""
    w = shot.px(dist) * shot.w * scale
    h = w * shot.h / shot.w
    ob = mesh_obj(shot, name, [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], [(0, 1, 2, 3)], mat)
    ob.parent = shot.cam
    ob.location = (0, 0, -dist)
    return ob


def speed_lines(shot, n=40, dist=2.0, seed=3, inner=0.35, color='ink'):
    """Radiale Speedlines als Dreiecke vor der Kamera / radial speed lines as triangles in front of the camera"""
    R = random.Random(seed)
    w = shot.px(dist) * shot.w
    h = w * shot.h / shot.w
    verts, faces = [], []
    rmax = math.hypot(w, h) * 0.6
    for i in range(n):
        a = 2 * math.pi * i / n + R.uniform(-0.05, 0.05)
        da = R.uniform(0.004, 0.012)
        r0 = rmax * (inner + R.uniform(0, 0.25))
        k = len(verts)
        verts += [(math.cos(a) * r0 * w / rmax / 0.6 * 0.5, math.sin(a) * r0 * h / rmax / 0.6 * 0.5, 0),
                  (math.cos(a - da) * rmax, math.sin(a - da) * rmax, 0), (math.cos(a + da) * rmax, math.sin(a + da) * rmax, 0)]
        faces.append((k, k + 1, k + 2))
    ob = mesh_obj(shot, 'speed', verts, faces, flat(color))
    ob.parent = shot.cam
    ob.location = (0, 0, -dist)
    return ob


def text_obj(shot, body, size=1.0, extrude=0.1, color='hazard', font='bangers', loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), align='CENTER', ink=True, px=3.0):
    cu = bpy.data.curves.new('txt', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = extrude * 0.25
    cu.align_x = align
    cu.align_y = 'CENTER'
    path = font_path(font)
    if path:
        cu.font = bpy.data.fonts.load(path)
    ob = bpy.data.objects.new('txt', cu)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = Euler(rot)
    # in ein Mesh umwandeln, damit die Huelle funktioniert / convert to a mesh so the hull works
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    me.materials.append(toon(shot, color))
    ob = bpy.data.objects.new('txt', me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = Euler(rot)
    if ink:
        _ink_shared(shot, ob, px)
    return ob


def font_path(name):
    """Schrift aus @fontsource (woff) als TTF in den Cache / font from @fontsource (woff) as TTF in the cache"""
    out = os.path.join(CACHE, name + '.ttf')
    if os.path.exists(out):
        return out
    for base in (os.path.join(ROOT, 'node_modules'), os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(ROOT))), 'node_modules')):
        src = os.path.join(base, '@fontsource', name, 'files', '%s-latin-400-normal.woff' % name)
        if os.path.exists(src):
            try:
                from fontTools.ttLib import TTFont
                f = TTFont(src)
                f.flavor = None
                f.save(out)
                return out
            except Exception as e:  # noqa: BLE001
                print('font', e)
    return None


def hide(ob, hidden):
    ob.hide_render = hidden
    for c in ob.children:
        c.hide_render = hidden


def film():
    """Zeitleiste des Films (gemeinsam mit dem Spiel) / film timeline (shared with the game)"""
    with open(os.path.join(ROOT, 'src', 'intro', 'film.json')) as fh:
        return json.load(fh)


def shot_dur(shot_id):
    for s in film()['shots']:
        if s['id'] == shot_id:
            return s['end'] - s['start']
    raise KeyError(shot_id)
