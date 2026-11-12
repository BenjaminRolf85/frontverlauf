# -*- coding: utf-8 -*-
"""
Frontverlauf - Blender-Asset-Pipeline / Blender asset pipeline.

Baut die Grundmodelle (Soldat, Jeep, Panzer, Kampfhubschrauber, Schiffsrumpfe, Haus) mit denselben
Proportionen und Farben wie src/render/models/ nach und exportiert sie als binaeres glTF (.glb) mit
Draco-komprimierter Geometrie nach public/assets/.
Rebuilds the base meshes (soldier, jeep, tank, combat helicopter, ship hulls, house) with the same
proportions and colours as src/render/models/ and exports them as binary glTF (.glb) with
Draco-compressed geometry to public/assets/.

Aufruf / usage (im Projektordner / from the project root):
    blender -b -P blender/generate_assets.py
    blender -b -P blender/generate_assets.py -- --out public/assets --blend blender/frontverlauf_models.blend

Farben werden aus src/design/tokens.ts gelesen (einzige Farbquelle).
Colours are read from src/design/tokens.ts (single source of colour).

Koordinaten: Die Modelle sind in Three.js-Koordinaten beschrieben (y oben, Einheiten blicken nach +z)
und werden fuer Blender (z oben) umgerechnet; der glTF-Export rechnet wieder auf y oben zurueck.
Coordinates: models are described in Three.js coordinates (y up, units face +z) and converted for
Blender (z up); the glTF export converts back to y up.

Lizenz / licence: CC0, eigene Schoepfung / own creation (Frontverlauf-Projekt).
"""
import math
import os
import re
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FACTIONS = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar']


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.join(ROOT, 'public', 'assets')
    blend = None
    i = 0
    while i < len(argv):
        if argv[i] == '--out':
            out = os.path.abspath(argv[i + 1])
            i += 1
        elif argv[i] == '--blend':
            blend = os.path.abspath(argv[i + 1])
            i += 1
        i += 1
    return out, blend


# ---------- Farben aus den Tokens / colours from the tokens ----------

def read_tokens():
    path = os.path.join(ROOT, 'src', 'design', 'tokens.ts')
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    prim = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", src.split('font:')[0]))
    sem_block = src[src.index('export const semantic'):src.index('export interface FactionTokens')]
    sem = {k: prim[v] for k, v in re.findall(r"(\w+):\s*c\.(\w+)", sem_block)}
    fac = {}
    for fid, p, s in re.findall(r"(\w+):\s*\{\s*primary:\s*c\.(\w+),\s*secondary:\s*c\.(\w+)", src):
        fac[fid] = {'primary': prim[p], 'secondary': prim[s]}
    return prim, sem, fac


PRIM, SEM, FAC = read_tokens()


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hexstr):
    h = hexstr.lstrip('#')
    return [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]


def shade(hexstr_or_rgb, f):
    c = rgb(hexstr_or_rgb) if isinstance(hexstr_or_rgb, str) else list(hexstr_or_rgb)
    if f <= 1:
        return [v * f for v in c]
    t = min(1.0, f - 1)
    return [v + (1 - v) * t for v in c]


def mix(a, b, t):
    ca = rgb(a) if isinstance(a, str) else a
    cb = rgb(b) if isinstance(b, str) else b
    return [ca[i] + (cb[i] - ca[i]) * t for i in range(3)]


def C(x):
    """Farbe normalisieren (sRGB-Liste) / normalise colour (sRGB list)"""
    return rgb(x) if isinstance(x, str) else list(x)


MAT = {
    'ink': C(SEM['ink']),
    'dark': C(PRIM['ink800']),
    'metal': C(SEM['metal']),
    'white': C(SEM['white']),
    'skin': mix(PRIM['paper200'], PRIM['orange500'], 0.14),
    'wood': shade(PRIM['paper300'], 0.55),
    'woodLight': shade(PRIM['paper300'], 0.78),
    'glass': mix(PRIM['water300'], PRIM['white'], 0.35),
    'glassDark': mix(PRIM['sky700'], PRIM['water500'], 0.35),
    'window': C(PRIM['sky800']),
    'concrete': C(PRIM['rock400']),
    'concreteLight': shade(PRIM['rock400'], 1.25),
    'snow': C(SEM['snow']),
    'paper': C(PRIM['paper50']),
}


def look(fid):
    """Wie look.ts / like look.ts"""
    if fid is None:
        return {
            'primary': C(SEM['neutral']), 'secondary': C(PRIM['paper50']), 'helmet': C(SEM['neutral']),
            'jacket': C(SEM['neutral']), 'pants': C(SEM['neutralDark']), 'gear': C(SEM['neutralDark']),
            'hull': C(SEM['neutral']), 'hullDark': C(SEM['neutralDark']), 'trim': C(PRIM['paper50']),
            'wall': C(PRIM['paper100']), 'wallDark': C(PRIM['paper300']), 'roof': shade(PRIM['paper300'], 0.62),
            'roofDark': shade(PRIM['paper300'], 0.45),
        }
    pr, se = FAC[fid]['primary'], FAC[fid]['secondary']
    L = {'primary': C(pr), 'secondary': C(se), 'trim': C(se), 'hull': C(pr), 'hullDark': shade(pr, 0.65)}
    if fid == 'korvat':
        L.update(helmet=shade(se, 0.95), jacket=C(pr), pants=shade(se, 0.8), gear=shade(se, 0.65),
                 hullDark=shade(pr, 0.62), wall=mix(PRIM['rock400'], PRIM['paper200'], 0.45),
                 wallDark=shade(PRIM['rock400'], 0.85), roof=C(pr), roofDark=shade(se, 0.8))
    elif fid == 'dravon':
        L.update(helmet=C(pr), jacket=shade(pr, 1.12), pants=shade(pr, 0.75), gear=C(se), hull=shade(pr, 1.1),
                 hullDark=shade(pr, 0.7), wall=shade(pr, 1.45), wallDark=C(pr), roof=shade(pr, 0.8),
                 roofDark=shade(pr, 0.6))
    elif fid == 'alvenia':
        L.update(helmet=C(pr), jacket=C(pr), pants=mix(se, pr, 0.25), gear=C(se), wall=C(se),
                 wallDark=mix(se, pr, 0.25), roof=C(pr), roofDark=shade(pr, 0.7))
    elif fid == 'meridon':
        L.update(helmet=C(se), jacket=C(pr), pants=shade(pr, 0.6), gear=C(se), wall=C(PRIM['paper100']),
                 wallDark=C(PRIM['paper300']), roof=C(pr), roofDark=C(se))
    elif fid == 'velkar':
        L.update(helmet=shade(pr, 1.1), jacket=C(pr), pants=shade(pr, 1.25), gear=shade(pr, 0.7),
                 hullDark=shade(pr, 0.7), wall=shade(pr, 1.2), wallDark=shade(pr, 0.85), roof=shade(pr, 0.75),
                 roofDark=shade(pr, 0.6))
    return L


# ---------- Baukasten (bmesh) / toolkit (bmesh) ----------

# Three.js (x, y, z) -> Blender (x, -z, y)
TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def xf(p=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1)):
    if isinstance(s, (int, float)):
        s = (s, s, s)
    m = Matrix.Translation(Vector(p)) @ Euler(r, 'XYZ').to_matrix().to_4x4()
    sc = Matrix.Identity(4)
    sc[0][0], sc[1][1], sc[2][2] = s
    return m @ sc


class Model:
    """Sammelt Teile in einem bmesh (Three.js-Koordinaten) / collects parts in one bmesh (Three.js coords)"""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new('Color')
        self.stack = [Matrix.Identity(4)]

    def push(self, m):
        self.stack.append(self.stack[-1] @ m)

    def pop(self):
        self.stack.pop()

    def _finish(self, verts, faces, color, m):
        mat = self.stack[-1] @ m
        for v in verts:
            v.co = mat @ v.co
        if mat.determinant() < 0:
            bmesh.ops.reverse_faces(self.bm, faces=faces)
        lin = [srgb_to_linear(c) for c in C(color)] + [1.0]
        for f in faces:
            f.smooth = False
            for loop in f.loops:
                loop[self.col] = lin

    def box(self, w, h, d, color, p=(0, 0, 0), r=(0, 0, 0)):
        self.taper(w, d, w, d, h, color, p, r)

    def block(self, x, y, z, w, h, d, color, ry=0.0):
        self.box(w, h, d, color, (x, y + h / 2, z), (0, ry, 0))

    def taper(self, wb, db, wt, dt, h, color, p=(0, 0, 0), r=(0, 0, 0), dz=0.0, s=(1, 1, 1)):
        """Quader mit verjuengter Oberseite (zentriert) / box with tapered top (centred)"""
        bm = self.bm
        pts = []
        for top in (0, 1):
            w, d = (wt, dt) if top else (wb, db)
            y = h / 2 if top else -h / 2
            oz = dz if top else 0.0
            pts += [(-w / 2, y, -d / 2 + oz), (w / 2, y, -d / 2 + oz), (w / 2, y, d / 2 + oz), (-w / 2, y, d / 2 + oz)]
        vs = [bm.verts.new(Vector(q)) for q in pts]
        idx = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        faces = [bm.faces.new([vs[i] for i in f]) for f in idx]
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._finish(vs, faces, color, xf(p, r, s))

    def cyl(self, rt, rb, h, seg, color, p=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1)):
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                    radius1=rb, radius2=max(rt, 1e-5), depth=h)
        verts = res['verts']
        for v in verts:  # Blender-Kegel steht in z; nach y drehen / cone is along z; rotate to y
            v.co = Vector((v.co.x, v.co.z, -v.co.y))
        faces = list({f for v in verts for f in v.link_faces})
        self._finish(verts, faces, color, xf(p, r, s))

    def sphere(self, rad, u, v, color, p=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1), hemi=False):
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=u, v_segments=v, radius=rad)
        verts = res['verts']
        for vv in verts:
            vv.co = Vector((vv.co.x, vv.co.z, -vv.co.y))
        if hemi:
            low = [vv for vv in verts if vv.co.y < -1e-6]
            bmesh.ops.delete(self.bm, geom=low, context='VERTS')
            verts = [vv for vv in verts if vv.is_valid]
            ring = [vv for vv in verts if abs(vv.co.y) < 1e-6]
            ring.sort(key=lambda q: math.atan2(q.co.z, q.co.x))
            if len(ring) >= 3:
                self.bm.faces.new(ring)
        faces = list({f for vv in verts for f in vv.link_faces})
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self._finish(verts, faces, color, xf(p, r, s))

    def prism(self, pts2d, h, color, plane='xz', p=(0, 0, 0), r=(0, 0, 0)):
        """Prisma: 'xz' Grundriss (Hoehe y), 'zy' Seitenprofil (Breite x) / prism: top outline or side profile"""
        bm = self.bm
        n = len(pts2d)
        if plane == 'xz':
            a = [Vector((x, 0, z)) for x, z in pts2d]
            b = [Vector((x, h, z)) for x, z in pts2d]
        else:
            a = [Vector((-h / 2, y, z)) for z, y in pts2d]
            b = [Vector((h / 2, y, z)) for z, y in pts2d]
        va = [bm.verts.new(q) for q in a]
        vb = [bm.verts.new(q) for q in b]
        faces = [bm.faces.new(va[::-1]), bm.faces.new(vb)]
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new([va[i], va[j], vb[j], vb[i]]))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._finish(va + vb, faces, color, xf(p, r))

    def to_object(self, collection):
        # in Blender-Koordinaten umrechnen / convert to Blender coordinates
        bmesh.ops.transform(self.bm, matrix=TO_BLENDER, verts=self.bm.verts)
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        if hasattr(me, 'color_attributes') and me.color_attributes:
            me.color_attributes.active_color = me.color_attributes['Color']
        ob = bpy.data.objects.new(self.name, me)
        ob.data.materials.append(vertex_color_material())
        collection.objects.link(ob)
        return ob


_MAT = None


def vertex_color_material():
    """Ein Material, das die Vertexfarben nutzt / one material using the vertex colours"""
    global _MAT
    if _MAT:
        return _MAT
    m = bpy.data.materials.new('FrontverlaufVertexColor')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    try:
        attr = nt.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Color'
    except RuntimeError:
        attr = nt.nodes.new('ShaderNodeAttribute')
        attr.attribute_name = 'Color'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = 1.0
    _MAT = m
    return m


# ---------- Modelle / models (Masse wie src/render/models) ----------

def soldier(fid):
    L = look(fid)
    m = Model('soldier_' + fid)
    for x in (-0.042, 0.042):
        m.box(0.06, 0.112, 0.065, L['pants'], (x, 0.089, 0))
        m.box(0.066, 0.036, 0.092, MAT['dark'], (x, 0.018, 0.012))
    y0 = 0.145
    m.taper(0.15, 0.09, 0.172, 0.102, 0.125, L['jacket'], (0, y0 + 0.0625, 0))
    m.box(0.156, 0.026, 0.096, L['gear'], (0, y0 + 0.008, 0))
    if fid == 'meridon':
        m.taper(0.158, 0.098, 0.176, 0.108, 0.085, L['secondary'], (0, y0 + 0.07, 0))
    m.taper(0.12, 0.05, 0.11, 0.045, 0.1, L['gear'], (0, y0 + 0.07, -0.072))
    # Arme mit Gewehrhaltung / arms holding the rifle
    for side, rot in ((-1, (-1.15, 0, 0.42)), (1, (-0.85, 0, -0.18))):
        m.push(xf((side * 0.1, 0.255, 0), rot))
        m.box(0.048, 0.125, 0.052, L['jacket'], (0, -0.055, 0))
        m.box(0.042, 0.04, 0.045, MAT['skin'], (0, -0.125, 0))
        m.pop()
    hy = 0.268
    if fid != 'dravon':
        m.box(0.105, 0.098, 0.1, MAT['skin'], (0, hy + 0.049, 0))
        for x in (-0.024, 0.024):
            m.box(0.014, 0.024, 0.008, MAT['ink'], (x, hy + 0.058, 0.051))
    if fid == 'korvat':
        m.sphere(0.08, 10, 6, L['helmet'], (0, hy + 0.072, -0.004), s=(1, 0.95, 1.05), hemi=True)
        m.cyl(0.094, 0.096, 0.012, 10, shade(L['helmet'], 0.8), (0, hy + 0.075, -0.004))
    elif fid == 'dravon':
        m.taper(0.125, 0.12, 0.1, 0.098, 0.13, L['helmet'], (0, hy + 0.065, 0))
        m.box(0.105, 0.018, 0.012, L['secondary'], (0, hy + 0.062, 0.061))
        m.taper(0.018, 0.12, 0.01, 0.1, 0.035, L['secondary'], (0, hy + 0.155, 0))
    elif fid == 'alvenia':
        m.sphere(0.078, 10, 6, L['helmet'], (0, hy + 0.078, -0.004), hemi=True)
        m.cyl(0.081, 0.082, 0.014, 10, L['secondary'], (0, hy + 0.078, -0.004))
        for x in (-0.026, 0.026):
            m.cyl(0.02, 0.02, 0.016, 8, L['secondary'], (x, hy + 0.104, 0.066), (math.pi / 2 - 0.3, 0, 0))
    elif fid == 'meridon':
        m.sphere(0.072, 10, 5, L['helmet'], (0.012, hy + 0.104, -0.004), (0, 0, -0.22), (1.15, 0.42, 1.12))
    elif fid == 'velkar':
        m.sphere(0.082, 10, 6, L['helmet'], (0, hy + 0.07, -0.006), hemi=True)
        m.taper(0.115, 0.03, 0.11, 0.025, 0.04, mix(L['secondary'], MAT['glassDark'], 0.45), (0, hy + 0.06, 0.058))
        m.cyl(0.005, 0.005, 0.11, 4, MAT['dark'], (0.07, hy + 0.155, -0.038))
    # Gewehr / rifle
    m.push(xf((0.035, 0.19, 0.05), (-0.22, -0.12, 0)))
    m.box(0.026, 0.042, 0.085, MAT['wood'], (0, -0.008, -0.045))
    m.box(0.03, 0.038, 0.11, MAT['dark'], (0, 0, 0.05))
    m.box(0.014, 0.014, 0.17, MAT['metal'], (0, 0.008, 0.185))
    m.pop()
    return m


def wheel(m, x, y, z, r, w):
    m.cyl(r, r, w, 8, MAT['dark'], (x, y, z), (0, 0, math.pi / 2))
    m.cyl(r * 0.45, r * 0.45, w + 0.008, 6, MAT['metal'], (x, y, z), (0, 0, math.pi / 2))


def jeep(fid):
    L = look(fid)
    m = Model('jeep_' + fid)
    wr = 0.06 if fid == 'meridon' else 0.05 if fid == 'velkar' else 0.055
    for x in (-0.118, 0.118):
        for z in (-0.12, 0.13):
            wheel(m, x, wr, z, wr, 0.045)
    cy = wr + 0.01
    m.box(0.2, 0.04, 0.36, L['hullDark'], (0, cy, 0))
    by = cy + 0.02
    if fid == 'dravon':
        m.prism([(-0.18, 0), (0.2, 0), (0.21, 0.035), (0.06, 0.08), (-0.17, 0.085), (-0.19, 0.05)], 0.25, L['hull'], 'zy', (0, by, 0))
    elif fid in ('alvenia', 'velkar'):
        m.prism([(-0.18, 0), (0.2, 0), (0.21, 0.03), (0.19, 0.055), (0.12, 0.068), (-0.15, 0.075), (-0.18, 0.06)], 0.24, L['hull'], 'zy', (0, by, 0))
    else:
        m.block(0, by, -0.06, 0.25, 0.075, 0.22, L['hull'])
        m.block(0, by, 0.12, 0.22, 0.065, 0.14, L['hull'])
    m.box(0.22, 0.07, 0.01, L['hullDark'], (0, by + 0.105, 0.05), (-0.25, 0, 0))
    m.box(0.19, 0.05, 0.012, MAT['glass'], (0, by + 0.105, 0.05), (-0.25, 0, 0))
    gs = 1.7 if fid == 'dravon' else 1.0
    m.cyl(0.012, 0.016, 0.13, 6, MAT['dark'], (0.05, by + 0.13, -0.09))
    m.box(0.04 * gs, 0.04 * gs, 0.1, MAT['dark'], (0.05, by + 0.2, -0.07))
    m.cyl(0.011 * gs, 0.011 * gs, 0.17 * gs, 6, MAT['metal'], (0.05, by + 0.205, -0.02 + 0.085 * gs), (math.pi / 2, 0, 0))
    m.box(0.1, 0.06, 0.01, L['trim'], (0.05, by + 0.21, -0.015), (-0.1, 0, 0))
    return m


def tank(fid):
    L = look(fid)
    m = Model('tank_' + fid)
    tw, tx = (0.07, 0.12) if fid == 'meridon' else (0.08, 0.125)
    prof = [(-0.2, 0.025), (-0.17, 0), (0.17, 0), (0.205, 0.03), (0.2, 0.065), (0.18, 0.085), (-0.18, 0.085), (-0.205, 0.06)]
    for s in (-1, 1):
        m.prism(prof, tw, MAT['dark'], 'zy', (s * tx, 0, 0))
        for z in (-0.13, -0.045, 0.045, 0.13):
            m.cyl(0.032, 0.032, 0.012, 8, MAT['metal'], (s * (tx + tw / 2 + 0.004), 0.04, z), (0, 0, math.pi / 2))
    hw = 2 * tx - tw + 0.01
    m.prism([(-0.19, 0.04), (0.15, 0.04), (0.21, 0.09), (0.17, 0.145), (-0.18, 0.145), (-0.2, 0.11)], hw, L['hull'], 'zy')
    m.block(0, 0.085, 0, 2 * tx + tw + 0.01, 0.014, 0.4, L['hull'])
    ty, tz = 0.145, -0.03
    blen, br = 0.27, 0.016
    if fid == 'korvat':
        m.taper(0.21, 0.21, 0.17, 0.17, 0.08, L['hull'], (0, ty + 0.04, tz))
    elif fid == 'dravon':
        m.prism([(-0.12, -0.11), (0.12, -0.11), (0.13, 0.03), (0.05, 0.14), (-0.05, 0.14), (-0.13, 0.03)], 0.075, L['hull'], 'xz', (0, ty, tz))
        blen, br = 0.33, 0.024
    elif fid == 'alvenia':
        m.cyl(0.11, 0.115, 0.06, 12, L['hull'], (0, ty + 0.03, tz))
        m.sphere(0.11, 12, 6, L['hull'], (0, ty + 0.06, tz), s=(1, 0.28, 1), hemi=True)
    elif fid == 'meridon':
        m.taper(0.18, 0.18, 0.15, 0.15, 0.07, L['hull'], (0, ty + 0.035, tz + 0.01))
        m.block(0, ty + 0.005, tz - 0.115, 0.17, 0.06, 0.06, L['trim'])
        blen, br = 0.25, 0.013
    else:
        m.taper(0.2, 0.2, 0.13, 0.15, 0.065, L['hull'], (0, ty + 0.0325, tz), dz=-0.01)
        for s in (-1, 1):
            m.block(s * (tx + tw / 2 + 0.012), 0.02, 0, 0.014, 0.075, 0.38, L['hullDark'])
        blen, br = 0.25, 0.018
    mz = tz + 0.1
    m.box(0.07, 0.05, 0.04, L['hullDark'], (0, ty + 0.035, mz))
    m.cyl(br, br, blen, 8, L['hullDark'], (0, ty + 0.035, mz + blen / 2), (math.pi / 2, 0, 0))
    return m


def heli(fid):
    L = look(fid)
    m = Model('heli_' + fid)
    lift = 0.08
    by = lift + 0.05
    for s in (-1, 1):
        m.box(0.014, 0.014, 0.3, MAT['dark'], (s * 0.085, lift, 0.02))
    if fid == 'alvenia':
        m.sphere(0.1, 10, 6, L['hull'], (0, by + 0.06, 0), s=(0.7, 0.62, 1.35))
        m.sphere(0.07, 10, 5, MAT['glass'], (0, by + 0.08, 0.1), s=(0.85, 0.75, 1.1))
    else:
        m.taper(0.13, 0.28, 0.11, 0.22, 0.11, L['hull'], (0, by + 0.055, 0), dz=-0.01)
        m.taper(0.12, 0.08, 0.09, 0.04, 0.07, MAT['glass'], (0, by + 0.075, 0.16), dz=-0.015)
    m.taper(0.023, 0.023, 0.038, 0.038, 0.24, L['hull'], (0, by + 0.07, -0.24), (math.pi / 2, 0, 0))
    m.taper(0.012, 0.06, 0.008, 0.04, 0.09, L['hull'], (0, by + 0.11, -0.35), dz=-0.02)
    for s in (-1, 1):
        m.box(0.12, 0.012, 0.05, L['hullDark'], (s * 0.11, by + 0.05, 0), (0, 0, -s * 0.1))
        m.cyl(0.024, 0.024, 0.1, 8, L['hullDark'], (s * 0.155, by + 0.03, 0.01), (math.pi / 2, 0, 0))
    top = by + 0.11
    m.cyl(0.014, 0.018, 0.05, 6, MAT['dark'], (0, top + 0.02, 0))
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        m.push(xf((0, top + 0.05, 0), (0, a, 0)))
        m.box(0.04, 0.008, 0.4, MAT['dark'], (0, 0, 0.21), (0, 0, 0.08))
        m.box(0.042, 0.009, 0.04, L['trim'], (0, 0, 0.39), (0, 0, 0.08))
        m.pop()
    return m


def hull_outline(len_, beam, bow, k=1.0):
    h, w = len_ / 2 * k, beam / 2 * k
    b = bow
    return [(-w * 0.85, -h), (w * 0.85, -h), (w, -h + 0.04), (w, h - b), (w * 0.6, h - b * 0.35), (0, h),
            (-w * 0.6, h - b * 0.35), (-w, h - b), (-w, -h + 0.04)]


def ship_hull(m, L, len_, beam, top, bow, deck):
    m.prism(hull_outline(len_, beam, bow, 0.94), 0.03, L['hullDark'], 'xz', (0, -0.03, 0))
    m.prism(hull_outline(len_, beam, bow, 0.97), 0.016, MAT['ink'], 'xz', (0, 0, 0))
    m.prism(hull_outline(len_, beam, bow), top - 0.016, L['hull'], 'xz', (0, 0.016, 0))
    m.prism(hull_outline(len_, beam, bow, 0.9), 0.008, deck, 'xz', (0, top, 0))


def turret(m, L, z, y, size, barrels, direction):
    m.push(xf((0, y, z), (0, 0 if direction > 0 else math.pi, 0)))
    m.taper(size * 0.95, size * 0.9, size * 0.85, size * 0.75, size * 0.36, L['hull'], (0, size * 0.18, 0))
    ln = size * 1.1
    for i in range(barrels):
        x = 0 if barrels == 1 else (i - (barrels - 1) / 2) * size * 0.32
        m.cyl(size * 0.07, size * 0.08, ln, 6, MAT['dark'], (x, size * 0.2, size * 0.35 + ln / 2), (math.pi / 2 - 0.06, 0, 0))
    m.pop()


def ships(fid):
    L = look(fid)
    out = []
    # Landungsboot / landing boat
    m = Model('landingBoat_' + fid)
    ln, w, top = 0.62, 0.3, 0.07
    m.block(0, -0.03, 0, w - 0.02, 0.03, ln - 0.02, L['hullDark'])
    m.block(0, 0.0, 0, w, 0.014, ln, MAT['ink'])
    m.block(0, 0.014, -0.02, w - 0.02, 0.012, ln - 0.06, MAT['woodLight'])
    for s in (-1, 1):
        m.block(s * (w / 2 - 0.015), 0.014, -0.01, 0.03, top - 0.014, ln - 0.02, L['hull'])
    m.block(0, 0.014, -ln / 2 + 0.03, w, top + 0.001, 0.06, L['hull'])
    m.box(w - 0.02, 0.1, 0.018, L['hullDark'], (0, 0.06, ln / 2 - 0.03), (-0.2, 0, 0))
    m.block(0.08, top, -ln / 2 + 0.05, 0.1, 0.08, 0.07, L['hull'])
    out.append(m)
    # U-Boot / submarine
    m = Model('submarine_' + fid)
    m.sphere(0.1, 12, 6, L['hullDark'], (0, 0, 0), s=(0.85, 0.6, 4.1))
    m.sphere(0.1, 12, 4, L['hull'], (0, 0.012, 0), s=(0.75, 0.42, 3.8))
    m.block(0, 0.03, 0.06, 0.07, 0.12, 0.14, L['hull'])
    m.box(0.008, 0.11, 0.05, L['hullDark'], (0, 0, -0.4))
    m.box(0.13, 0.008, 0.05, L['hullDark'], (0, 0, -0.4))
    out.append(m)
    # Zerstoerer / destroyer
    m = Model('destroyer_' + fid)
    ship_hull(m, L, 0.84, 0.2, 0.06, 0.22, shade(SEM['metal'], 1.35))
    d = 0.068
    m.block(0, d, 0.06, 0.13, 0.07, 0.16, MAT['concreteLight'])
    m.block(0, d + 0.07, 0.08, 0.1, 0.055, 0.08, MAT['concreteLight'])
    m.block(0, d, -0.06, 0.06, 0.13, 0.072, L['hull'])
    turret(m, L, 0.24, d, 0.09, 1, 1)
    turret(m, L, -0.25, d, 0.075, 1, -1)
    out.append(m)
    # Kriegsschiff / battleship
    m = Model('battleship_' + fid)
    ship_hull(m, L, 0.88, 0.28, 0.07, 0.24, MAT['woodLight'])
    d = 0.078
    turret(m, L, 0.235, d, 0.11, 2, 1)
    m.block(0, d, 0.12, 0.1, 0.035, 0.1, L['hullDark'])
    turret(m, L, 0.12, d + 0.035, 0.11, 2, 1)
    turret(m, L, -0.25, d, 0.11, 2, -1)
    m.block(0, d, 0.0, 0.17, 0.07, 0.2, MAT['concreteLight'])
    m.block(0, d + 0.07, 0.02, 0.12, 0.06, 0.11, MAT['concreteLight'])
    m.block(0, d + 0.13, 0.03, 0.08, 0.05, 0.06, MAT['concreteLight'])
    m.block(0, d, -0.1, 0.07, 0.15, 0.084, L['hull'])
    out.append(m)
    return out


def house(fid):
    """Haus im Fraktionsstil (wie architecture.ts) / house in faction style"""
    L = look(fid)
    m = Model('house_' + (fid or 'neutral'))
    w, d, h = 0.17, 0.15, 0.2
    if fid == 'velkar':
        r = min(w, d) * 0.56
        m.cyl(r, r, h, 6, L['wall'], (0, h / 2, 0))
        m.cyl(r + 0.004, r + 0.004, 0.012, 6, L['secondary'], (0, h * 0.5, 0))
        m.cyl(r * 0.75, r * 1.04, 0.04, 6, L['roof'], (0, h + 0.02, 0))
        m.cyl(r * 0.55, r * 0.74, 0.016, 6, MAT['snow'], (0, h + 0.048, 0))
        return m
    m.block(0, 0, 0, w, h, d, L['wall'])
    for i in range(2):
        m.block(0, (i + 0.45) * (h / 2), 0, w + 0.008, 0.018, d + 0.008, MAT['window'] if fid != 'dravon' else L['secondary'])
    if fid == 'korvat':
        m.block(0, h, 0, w + 0.016, 0.018, d + 0.016, L['roofDark'])
    elif fid == 'dravon':
        m.taper(w * 1.02, d * 1.02, 0.002, 0.002, 0.14, L['roof'], (0, h + 0.07, 0))
    elif fid == 'meridon':
        m.block(0, h, 0, w + 0.01, 0.014, d + 0.01, L['wallDark'])
        m.box(w * 0.8, 0.008, 0.05, L['secondary'], (0, h * 0.35, d / 2 + 0.022), (0.35, 0, 0))
    else:
        rw, rd, rh = w + 0.03, d + 0.03, min(0.11, w * 0.55)
        m.prism([(-rw / 2, 0), (rw / 2, 0), (0, rh)], rd, L['roof'], 'zy', (0, h, 0), (0, math.pi / 2, 0))
    return m


# ---------- Export ----------

def export_glb(ob, out_dir):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    path = os.path.join(out_dir, ob.name + '.glb')
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
              export_draco_position_quantization=14, export_draco_normal_quantization=10,
              export_draco_color_quantization=10, export_materials='EXPORT')
    # Vertexfarben: Name des Schalters je nach Blender-Version / vertex colours: flag name depends on version
    if 'export_vertex_color' in props:
        kw['export_vertex_color'] = 'ACTIVE'
    elif 'export_colors' in props:
        kw['export_colors'] = True
    kw = {k: v for k, v in kw.items() if k in props or k == 'filepath'}
    bpy.ops.export_scene.gltf(**kw)
    print('  exportiert / exported:', os.path.relpath(path, ROOT))


def main():
    out_dir, blend = parse_args()
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    coll = bpy.data.collections.new('Frontverlauf')
    bpy.context.scene.collection.children.link(coll)
    models = []
    for fid in FACTIONS:
        models += [soldier(fid), jeep(fid), tank(fid), heli(fid), house(fid)]
        models += ships(fid)
    models.append(house(None))
    objects = [m.to_object(coll) for m in models]
    # Vorschau-Anordnung in der .blend / preview layout in the .blend
    for i, ob in enumerate(objects):
        ob.location = ((i % 10) * 1.1, -(i // 10) * 1.1, 0)
    for ob in objects:
        loc = ob.location.copy()
        ob.location = (0, 0, 0)
        export_glb(ob, out_dir)
        ob.location = loc
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=blend)
        print('  gespeichert / saved:', os.path.relpath(blend, ROOT))
    print('Fertig / done: %d Modelle / models' % len(objects))


if __name__ == '__main__':
    main()
