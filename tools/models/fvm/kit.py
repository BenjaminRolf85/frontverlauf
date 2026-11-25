"""
Modellier-Baukasten fuer die Blender-Modelle: Grundformen als echte Meshes, Modifikatoren (Unterteilung, Fase, Boolesch,
Solidify, Spiegel, Reihe an Kurve, Voxel-Remesh), Verschmelzen zu einer Flaeche, Wichtung an Knochen, Verdeckungslicht
in Vertexfarben, Export als glTF.
Modelling kit for the Blender models: base shapes as real meshes, modifiers (subdivision, bevel, boolean, solidify,
mirror, array on curve, voxel remesh), fusing into one surface, bone weights, ambient occlusion in vertex colours, glTF
export.

Koordinaten wie in Blender ueblich: z oben, Figur blickt nach -y, links ist +x. Der Export dreht auf y oben (Blick +z),
passend zu Three.js und zum Spiel.
Coordinates as usual in Blender: z up, figure faces -y, left is +x. The export turns to y up (facing +z), matching
Three.js and the game.

Farben stehen NICHT im Modell: jede Flaeche traegt nur eine Farbrolle (SLOTS) als UV-Koordinate in eine Palette mit
PALETTE_SIZE Feldern. Die Palette baut das Spiel beim Laden aus den Design-Tokens der Fraktion.
Colours are NOT in the model: every face only carries a colour role (SLOTS) as a UV coordinate into a palette with
PALETTE_SIZE cells. The game builds the palette at load time from the faction's design tokens.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

# Farbrollen: Reihenfolge = Palettenfeld; muss zu src/render/models/proto/c/palette.ts passen
# colour roles: order = palette cell; must match src/render/models/proto/c/palette.ts
SLOTS = [
    'skin', 'skinDark', 'hair', 'eyeWhite', 'ink', 'jacket', 'pants', 'helmet', 'gear', 'boots',
    'primary', 'emblem', 'canvas', 'wood', 'metal', 'metalLight', 'hull', 'hullDark', 'trim', 'rubber',
    'track', 'lamp', 'glass', 'jacketDark', 'woodDark', 'primaryDark', 'brass', 'badge', 'hullLight', 'trimDark',
]
PALETTE_SIZE = 32
# FV_VERBOSE=1: Dreiecke je Teil ausgeben / print triangles per part
# Clips werden mit jedem FRAME_STEP-ten Bild abgetastet (24 Bilder je Sekunde) / clips are sampled at every FRAME_STEP-th frame (24 frames per second)
FRAME_STEP = 2
VERBOSE = bool(__import__('os').environ.get('FV_VERBOSE'))


def slot_index(name):
    return SLOTS.index(name)


# ---------- Szene / scene ----------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def activate(o):
    bpy.context.view_layer.update()
    for x in bpy.context.scene.objects:
        x.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def new_object(name, bm, slot=None, smooth=True, recalc=True):
    """bmesh -> Objekt; slot faerbt alle Flaechen / bmesh -> object; slot colours all faces"""
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    if smooth:
        me.shade_smooth()
    if slot is not None:
        set_slot(o, slot)
    return o


def set_slot(o, slot):
    """Farbrolle fuer alle Flaechen (oder Funktion Flaechenmitte -> Rolle) / colour role for all faces (or function face centre -> role)"""
    me = o.data
    a = me.attributes.get('slot') or me.attributes.new('slot', 'INT', 'FACE')
    if callable(slot):
        vals = [slot_index(slot(p.center)) for p in me.polygons]
    else:
        vals = [slot_index(slot)] * len(me.polygons)
    a.data.foreach_set('value', vals)
    return o


def paint_slot(o, fn):
    """Rolle nur dort setzen, wo fn(Flaechenmitte, Normale) einen Namen liefert / set the role only where fn(face centre, normal) returns a name"""
    me = o.data
    a = me.attributes['slot']
    vals = [0] * len(me.polygons)
    a.data.foreach_get('value', vals)
    for p in me.polygons:
        s = fn(p.center, p.normal)
        if s:
            vals[p.index] = slot_index(s)
    a.data.foreach_set('value', vals)
    return o


def transform(o, m):
    o.data.transform(m)
    o.data.update()
    return o


def move(o, v):
    return transform(o, Matrix.Translation(Vector(v)))


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def trs(p=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1)):
    """Matrix aus Ort, Drehung (Grad, Reihenfolge x dann y dann z) und Massstab / matrix from location, rotation (degrees, order x then y then z) and scale"""
    m = Matrix.Translation(Vector(p))
    m = m @ rot('Z', r[2]) @ rot('Y', r[1]) @ rot('X', r[0])
    if isinstance(s, (int, float)):
        s = (s, s, s)
    return m @ Matrix.Diagonal((s[0], s[1], s[2], 1))


def copy_object(o, name=None):
    c = o.copy()
    c.data = o.data.copy()
    c.name = name or o.name + '.copy'
    return link(c)


def delete(objs):
    for o in objs:
        me = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if me and me.users == 0:
            if isinstance(me, bpy.types.Mesh):
                bpy.data.meshes.remove(me)
            elif isinstance(me, bpy.types.Curve):
                bpy.data.curves.remove(me)


# ---------- Grundformen / base shapes ----------

def ellipsoid(name, c, r, slot, m=None, seg=20, rings=12):
    """UV-Kugel mit Halbachsen r um c, optional gedreht / UV sphere with semi-axes r around c, optionally rotated"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    if isinstance(r, (int, float)):
        r = (r, r, r)
    mat = Matrix.Translation(Vector(c)) @ (m or Matrix.Identity(4)) @ Matrix.Diagonal((r[0], r[1], r[2], 1))
    bmesh.ops.transform(bm, matrix=mat, verts=bm.verts)
    return new_object(name, bm, slot)


def box(name, c, size, slot, m=None, bevel=0.0, segs=2, smooth=None):
    """Quader, optional mit Fase (weiche Kanten) / box, optionally bevelled (soft edges)"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((size[0], size[1], size[2], 1)), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segs, profile=0.5, affect='EDGES')
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(c)) @ (m or Matrix.Identity(4)), verts=bm.verts)
    o = new_object(name, bm, slot, smooth=bevel > 0 if smooth is None else smooth)
    if bevel > 0:
        o.data.set_sharp_from_angle(angle=math.radians(50))
    return o


def cylinder(name, a, b, r, slot, seg=16, r2=None, cap=True):
    """Zylinder oder Kegelstumpf von a nach b / cylinder or cone frustum from a to b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=d.length)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=bm.verts)
    o = new_object(name, bm, slot)
    o.data.set_sharp_from_angle(angle=math.radians(40))
    return o


def _frames(centres):
    """Mitlaufende Achsen entlang einer Mittellinie (paralleler Transport) / moving frames along a centre line (parallel transport)"""
    n = len(centres)
    tang = []
    for i in range(n):
        t = centres[min(i + 1, n - 1)] - centres[max(i - 1, 0)]
        tang.append(t.normalized() if t.length > 1e-9 else Vector((0, 0, 1)))
    t0 = tang[0]
    ref = Vector((1, 0, 0)) if abs(t0.x) < 0.9 else Vector((0, 1, 0))
    u = (ref - t0 * ref.dot(t0)).normalized()
    out = []
    for i in range(n):
        if i > 0:
            q = tang[i - 1].rotation_difference(tang[i])
            u = (q @ u)
            u = (u - tang[i] * u.dot(tang[i])).normalized()
        out.append((u, tang[i].cross(u).normalized(), tang[i]))
    return out


def tube(name, rings, slot, seg=12, power=2.0, ref=None, cap=True, flat=(False, False)):
    """
    Schlauch durch Ringe [(Mitte, rx, ry)]: Querschnitt Superellipse (power 2 = Ellipse, groesser = kantiger). rx liegt
    entlang ref (auf die Ringebene projiziert), ry quer dazu. Die Enden werden zu einer Kuppe geschlossen.
    Tube through rings [(centre, rx, ry)]: superellipse cross-section (power 2 = ellipse, larger = boxier). rx lies along
    ref (projected into the ring plane), ry across it. The ends are closed into a dome.
    """
    cs = [Vector(r[0]) for r in rings]
    fr = _frames(cs)
    bm = bmesh.new()
    loops = []
    for i, r in enumerate(rings):
        u, v, t = fr[i]
        if ref is not None:
            rv = Vector(ref)
            rv = rv - t * rv.dot(t)
            if rv.length > 1e-6:
                u = rv.normalized()
                v = t.cross(u).normalized()
        rx, ry = r[1], r[2] if len(r) > 2 else r[1]
        pw = r[3] if len(r) > 3 else power
        loop = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ca, sa = math.cos(a), math.sin(a)
            x = math.copysign(abs(ca) ** (2 / pw), ca) * rx
            y = math.copysign(abs(sa) ** (2 / pw), sa) * ry
            loop.append(bm.verts.new(cs[i] + u * x + v * y))
        loops.append(loop)
    for i in range(len(loops) - 1):
        a, b = loops[i], loops[i + 1]
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    if cap:
        for loop, i, sgn, fl in ((loops[0], 0, -1, flat[0]), (loops[-1], len(loops) - 1, 1, flat[1])):
            r = rings[i]
            tip = bm.verts.new(cs[i] + fr[i][2] * sgn * (0.0 if fl else 0.35) * min(r[1], r[2] if len(r) > 2 else r[1]))
            for k in range(seg):
                f = (loop[k], loop[(k + 1) % seg], tip)
                bm.faces.new(f if sgn > 0 else f[::-1])
    return new_object(name, bm, slot)


def lathe(name, profile, slot, seg=24, origin=(0, 0, 0), m=None, sx=1.0, sy=1.0):
    """Drehkoerper um z aus Profil [(Radius, Hoehe)]; Radius 0 schliesst die Spitze / turned part around z from profile [(radius, height)]; radius 0 closes the tip"""
    bm = bmesh.new()
    loops = []
    for r, z in profile:
        if r <= 1e-9:
            loops.append([bm.verts.new((0, 0, z))])
        else:
            loops.append([bm.verts.new((math.cos(2 * math.pi * k / seg) * r * sx, math.sin(2 * math.pi * k / seg) * r * sy, z)) for k in range(seg)])
    for i in range(len(loops) - 1):
        a, b = loops[i], loops[i + 1]
        for k in range(seg):
            k2 = (k + 1) % seg
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[k], b[k2]))
            elif len(b) == 1:
                bm.faces.new((a[k], a[k2], b[0]))
            else:
                bm.faces.new((a[k], a[k2], b[k2], b[k]))
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(origin)) @ (m or Matrix.Identity(4)), verts=bm.verts)
    return new_object(name, bm, slot)


def extrude_profile(name, pts, depth, slot, axis='X', bevel=0.0, segs=2):
    """
    Umriss [(a, b)] als Platte der Dicke depth: axis X -> Punkte in (y, z), Y -> (x, z), Z -> (x, y); mittig auf der Achse.
    Outline [(a, b)] as a slab of thickness depth: axis X -> points in (y, z), Y -> (x, z), Z -> (x, y); centred on the axis.
    """
    bm = bmesh.new()

    def p3(a, b, h):
        return {'X': (h, a, b), 'Y': (a, h, b), 'Z': (a, b, h)}[axis]
    lo = [bm.verts.new(p3(a, b, -depth / 2)) for a, b in pts]
    hi = [bm.verts.new(p3(a, b, depth / 2)) for a, b in pts]
    n = len(pts)
    bm.faces.new(lo)
    bm.faces.new(hi[::-1])
    for i in range(n):
        bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segs, profile=0.5, affect='EDGES')
    o = new_object(name, bm, slot)
    o.data.set_sharp_from_angle(angle=math.radians(40))
    return o


# ---------- Modifikatoren / modifiers ----------

def apply_modifiers(o):
    """Alle Modifikatoren ausrechnen und einbrennen / evaluate and bake all modifiers"""
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = o.data
    o.modifiers.clear()
    o.data = me
    me.name = o.name
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return o


def subsurf(o, levels=1, apply=True):
    m = o.modifiers.new('subsurf', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    return apply_modifiers(o) if apply else o


def bevel(o, width, segs=2, angle=35, apply=True):
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    if apply:
        apply_modifiers(o)
        o.data.shade_smooth()
        o.data.set_sharp_from_angle(angle=math.radians(40))
    return o


def solidify(o, thickness, offset=-1.0, apply=True, rim_slot=None):
    m = o.modifiers.new('solidify', 'SOLIDIFY')
    m.thickness = thickness
    m.offset = offset
    m.use_even_offset = True
    return apply_modifiers(o) if apply else o


def boolean(o, cutter, op='DIFFERENCE', apply=True, keep=False):
    m = o.modifiers.new('bool', 'BOOLEAN')
    m.object = cutter
    m.operation = op
    m.solver = 'EXACT'
    if apply:
        apply_modifiers(o)
        if not keep:
            delete([cutter])
    return o


def mirror_x(o, apply=True):
    """Spiegelung an der Ebene x = 0 / mirror across the plane x = 0"""
    m = o.modifiers.new('mirror', 'MIRROR')
    m.use_axis = (True, False, False)
    m.use_clip = True
    m.merge_threshold = 1e-5
    return apply_modifiers(o) if apply else o


def decimate(o, ratio=None, tris=None, apply=True):
    """Dreiecke zusammenlegen bis ratio oder Zielzahl / collapse triangles down to ratio or a target count"""
    if tris is not None:
        o.data.calc_loop_triangles()
        cur = len(o.data.loop_triangles)
        ratio = min(1.0, tris / max(1, cur))
    if ratio >= 0.999:
        return o
    m = o.modifiers.new('decimate', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = ratio
    m.use_collapse_triangulate = True
    return apply_modifiers(o) if apply else o


def join(objs, name):
    """Objekte zu einem Mesh vereinen (Attribute bleiben) / join objects into one mesh (attributes are kept)"""
    objs = [o for o in objs if o is not None]
    activate(objs[0])
    for o in objs:
        o.select_set(True)
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]


def fuse(name, parts, slot, voxel=0.01, smooth=3, tris=2000, cutters=(), smooth_factor=0.5, keep_weights=True, adaptivity=0.0):
    """
    Teile zu EINER geschlossenen Flaeche verschmelzen (Voxel-Remesh), glaetten, optional ausschneiden, auf die
    Zielzahl an Dreiecken reduzieren. Knochengewichte der Teile werden auf die neue Flaeche uebertragen.
    Fuse parts into ONE closed surface (voxel remesh), smooth, optionally cut, reduce to the target triangle count.
    Bone weights of the parts are transferred to the new surface.
    """
    src = join(list(parts), name + '.src')
    o = copy_object(src, name)
    o.vertex_groups.clear()
    m = o.modifiers.new('remesh', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    m.adaptivity = adaptivity
    m.use_smooth_shade = True
    apply_modifiers(o)
    if smooth:
        s = o.modifiers.new('smooth', 'SMOOTH')
        s.factor = smooth_factor
        s.iterations = smooth
        apply_modifiers(o)
    for c in cutters:
        boolean(o, c, 'DIFFERENCE')
    if cutters:
        s = o.modifiers.new('smooth', 'SMOOTH')
        s.factor = 0.4
        s.iterations = 1
        apply_modifiers(o)
    hi = copy_object(o, name + '.hi')
    decimate(o, tris=tris)
    o.data.shade_smooth()
    transfer_normals(hi, o)
    delete([hi])
    set_slot(o, slot)
    if keep_weights and len(src.vertex_groups):
        transfer_weights(src, o)
        smooth_weights(o, 4)
    delete([src])
    return o


def transfer_normals(hi, lo):
    """
    Normalen der feinen Flaeche auf die reduzierte uebertragen: die Lichtstufen des Comic-Looks laufen dann so glatt wie
    auf dem feinen Modell, obwohl nur ein Bruchteil der Dreiecke bleibt.
    Transfer the fine surface's normals to the reduced one: the comic look's light steps then run as smoothly as on the
    fine model although only a fraction of the triangles remains.
    """
    bm = bmesh.new()
    bm.from_mesh(hi.data)
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm)
    normals = []
    for v in lo.data.vertices:
        loc, _n, fi, _d = tree.find_nearest(v.co)
        acc = Vector((0, 0, 0))
        for fv in bm.faces[fi].verts:
            acc += fv.normal / ((fv.co - loc).length + 1e-6)
        normals.append(acc.normalized() if acc.length > 1e-9 else v.normal.copy())
    bm.free()
    lo.data.normals_split_custom_set_from_vertices(normals)


# ---------- Knochengewichte / bone weights ----------

def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-12, ab.length_squared)))
    return (p - (a + ab * t)).length


def skin_rigid(o, bone):
    """Alles an einen Knochen / everything to one bone"""
    o.vertex_groups.clear()
    g = o.vertex_groups.new(name=bone)
    g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    return o


def skin_bones(o, bones, segs, power=6.0, bias=None):
    """
    Wichtung nach Abstand zu den Knochenstrecken, nur unter den genannten Knochen. power gross = schmale Uebergaenge.
    Weights by distance to the bone segments, among the named bones only. Large power = narrow blends.
    segs: {name: (head, tail)}; bias: {name: factor} macht einen Knochen staerker (>1) / makes a bone stronger (>1).
    """
    o.vertex_groups.clear()
    groups = [o.vertex_groups.new(name=b) for b in bones]
    for v in o.data.vertices:
        ws = []
        for b in bones:
            d = _seg_dist(v.co, segs[b][0], segs[b][1])
            w = 1.0 / (d ** power + 1e-9)
            if bias and b in bias:
                w *= bias[b]
            ws.append(w)
        tot = sum(ws)
        for g, w in zip(groups, ws):
            w /= tot
            if w > 0.02:
                g.add([v.index], w, 'REPLACE')
    return o


def skin_fn(o, fn):
    """Wichtung aus Funktion Ort -> {Knochen: Gewicht} / weights from a function location -> {bone: weight}"""
    o.vertex_groups.clear()
    groups = {}
    for v in o.data.vertices:
        ws = fn(v.co)
        tot = sum(ws.values())
        for b, w in ws.items():
            if w / tot > 0.01:
                if b not in groups:
                    groups[b] = o.vertex_groups.new(name=b)
                groups[b].add([v.index], w / tot, 'REPLACE')
    return o


def _weights_matrix(o):
    names = [g.name for g in o.vertex_groups]
    w = np.zeros((len(o.data.vertices), len(names)), dtype=np.float64)
    for v in o.data.vertices:
        for ge in v.groups:
            w[v.index, ge.group] = ge.weight
    return names, w


def _set_weights(o, names, w, limit=4):
    o.vertex_groups.clear()
    groups = [o.vertex_groups.new(name=n) for n in names]
    for i in range(w.shape[0]):
        row = w[i]
        idx = np.argsort(-row)[:limit]
        tot = row[idx].sum()
        if tot <= 1e-9:
            continue
        for j in idx:
            if row[j] / tot > 0.01:
                groups[j].add([i], float(row[j] / tot), 'REPLACE')


def transfer_weights(src, dst):
    """Gewichte vom naechsten Punkt der Quellflaeche uebernehmen / take weights from the nearest point of the source surface"""
    names, w = _weights_matrix(src)
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm)
    out = np.zeros((len(dst.data.vertices), len(names)))
    for v in dst.data.vertices:
        loc, _n, fi, _d = tree.find_nearest(v.co)
        f = bm.faces[fi]
        acc = np.zeros(len(names))
        tot = 0.0
        for fv in f.verts:
            k = 1.0 / ((fv.co - loc).length + 1e-6)
            acc += w[fv.index] * k
            tot += k
        out[v.index] = acc / tot
    bm.free()
    _set_weights(dst, names, out)


def smooth_weights(o, iterations=3):
    """Gewichte ueber Kanten mitteln (weiche Gelenke) / average weights across edges (soft joints)"""
    names, w = _weights_matrix(o)
    n = len(o.data.vertices)
    e = np.array([ed.vertices[:] for ed in o.data.edges], dtype=np.int64)
    deg = np.zeros(n)
    np.add.at(deg, e[:, 0], 1)
    np.add.at(deg, e[:, 1], 1)
    deg = np.maximum(deg, 1)[:, None]
    for _ in range(iterations):
        acc = np.zeros_like(w)
        np.add.at(acc, e[:, 0], w[e[:, 1]])
        np.add.at(acc, e[:, 1], w[e[:, 0]])
        w = 0.5 * w + 0.5 * acc / deg
    _set_weights(o, names, w)


# ---------- Verdeckungslicht / ambient occlusion ----------

def _hemisphere(n):
    """Feste, gleichmaessige Richtungen der oberen Halbkugel (Kosinus-gewichtet) / fixed, even directions of the upper hemisphere (cosine weighted)"""
    out = []
    for i in range(n):
        u = (i + 0.5) / n
        v = (i * 0.6180339887498949) % 1.0
        r = math.sqrt(u)
        a = 2 * math.pi * v
        out.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(1 - u))))
    return out


def bake_ao(o, occluders=None, samples=40, dist=0.25, floor=None, strength=1.0, gamma=1.0, name='Color'):
    """
    Verdeckungslicht je Vertex in das Farbattribut brennen (Strahlen gegen o und occluders, feste Richtungen =
    wiederholbar). floor: Hoehe einer Bodenebene, die mit verdeckt.
    Bake per-vertex ambient occlusion into the colour attribute (rays against o and occluders, fixed directions =
    repeatable). floor: height of a ground plane that occludes too.
    """
    bm = bmesh.new()
    for src in [o] + list(occluders or []):
        tmp = bmesh.new()
        tmp.from_mesh(src.data)
        tmp.transform(src.matrix_world)
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    if floor is not None:
        s = 50 * dist
        vs = [bm.verts.new((x, y, floor)) for x, y in ((-s, -s), (s, -s), (s, s), (-s, s))]
        bm.faces.new(vs)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    dirs = _hemisphere(samples)
    me = o.data
    vals = np.ones(len(me.vertices))
    # Vertexnormalen geglaettet ueber gleiche Orte, damit harte Kanten keine Flecken geben
    # vertex normals smoothed over coincident locations so hard edges give no blotches
    for v in me.vertices:
        n = v.normal
        if n.length < 1e-6:
            continue
        t = n.orthogonal().normalized()
        b = n.cross(t)
        p = v.co + n * (dist * 0.012)
        hit = 0.0
        for d in dirs:
            w = t * d.x + b * d.y + n * d.z
            loc, _nn, _i, dd = tree.ray_cast(p, w, dist)
            if loc is not None:
                hit += 1.0 - 0.5 * (dd / dist)
        vals[v.index] = 1.0 - hit / samples
    vals = np.clip(vals, 0, 1) ** gamma
    vals = 1.0 - strength * (1.0 - vals)
    if me.attributes.get('bright'):
        br = np.zeros(len(me.vertices), dtype=np.float32)
        me.attributes['bright'].data.foreach_get('value', br)
        vals = np.maximum(vals, br)
    write_color(o, vals, name)
    return o


def set_line(o, w):
    """Strichstaerke der Tuschelinie fuer dieses Teil (1 = voll, 0 = keine) / ink line weight for this part (1 = full, 0 = none)"""
    me = o.data
    # gespeichert wird 1 - w: zusammengefuegte Teile ohne Angabe bekommen so die volle Linie
    # stored is 1 - w: joined parts without a value thus get the full line
    a = me.attributes.get('thin') or me.attributes.new('thin', 'FLOAT', 'POINT')
    a.data.foreach_set('value', [1.0 - w] * len(me.vertices))
    return o


def set_bright(o, v=1.0):
    """Teil vom Verdeckungslicht ausnehmen (Augen bleiben hell) / exempt a part from the occlusion (eyes stay bright)"""
    me = o.data
    a = me.attributes.get('bright') or me.attributes.new('bright', 'FLOAT', 'POINT')
    a.data.foreach_set('value', [v] * len(me.vertices))
    return o


def concavity(me):
    """Je Vertex 0..1: wie tief er in einer Kehle sitzt (Nachbarn liegen ueber der Tangentialebene) / per vertex 0..1: how deep it sits in a crease (neighbours lie above the tangent plane)"""
    n = len(me.vertices)
    co = np.zeros(n * 3)
    no = np.zeros(n * 3)
    me.vertices.foreach_get('co', co)
    me.vertices.foreach_get('normal', no)
    co = co.reshape(n, 3)
    no = no.reshape(n, 3)
    e = np.array([ed.vertices[:] for ed in me.edges], dtype=np.int64)
    acc = np.zeros((n, 3))
    deg = np.zeros(n)
    ln = np.zeros(n)
    d = co[e[:, 1]] - co[e[:, 0]]
    el = np.linalg.norm(d, axis=1)
    np.add.at(acc, e[:, 0], d)
    np.add.at(acc, e[:, 1], -d)
    np.add.at(deg, e[:, 0], 1)
    np.add.at(deg, e[:, 1], 1)
    np.add.at(ln, e[:, 0], el)
    np.add.at(ln, e[:, 1], el)
    deg = np.maximum(deg, 1)
    c = np.einsum('ij,ij->i', acc / deg[:, None], no) / np.maximum(ln / deg, 1e-9)
    return np.clip(c * 3.0, 0.0, 1.0)


def set_line_fn(o, fn):
    """Strichstaerke je Vertex aus Funktion Ort -> 0..1 / per-vertex line weight from a function location -> 0..1"""
    me = o.data
    a = me.attributes.get('thin') or me.attributes.new('thin', 'FLOAT', 'POINT')
    a.data.foreach_set('value', [1.0 - fn(v.co) for v in me.vertices])
    return o


def write_color(o, ao, name='Color'):
    """Farbattribut: R = Verdeckungslicht, G = Strichstaerke der Tuschelinie, B frei / colour attribute: R = occlusion, G = ink line weight, B spare"""
    me = o.data
    n = len(me.vertices)
    line = np.ones(n, dtype=np.float32)
    if me.attributes.get('thin'):
        me.attributes['thin'].data.foreach_get('value', line)
        line = 1.0 - line
    ca = me.color_attributes.get(name) or me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    cols = np.ones((n, 4), dtype=np.float32)
    cols[:, 0] = ao
    # in Kehlen (dunkles Verdeckungslicht) duennere Linie: dort sticht die Huelle sonst als Zacken durch
    # thinner line in creases (dark occlusion): otherwise the hull pokes through there as spikes
    cols[:, 1] = line * np.clip((np.asarray(ao) - 0.3) / 0.4, 0.15, 1.0) * (1.0 - 0.85 * concavity(me))
    cols[:, 2] = 0.0
    ca.data.foreach_set('color', cols.ravel())
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = list(me.color_attributes).index(ca)


def smooth_ao(o, iterations=1, name='Color'):
    """Verdeckungslicht ueber Kanten weichzeichnen / blur the occlusion across edges"""
    me = o.data
    ca = me.color_attributes[name]
    n = len(me.vertices)
    cols = np.zeros(n * 4, dtype=np.float32)
    ca.data.foreach_get('color', cols)
    cols = cols.reshape(n, 4)
    e = np.array([ed.vertices[:] for ed in me.edges], dtype=np.int64)
    deg = np.zeros(n)
    np.add.at(deg, e[:, 0], 1)
    np.add.at(deg, e[:, 1], 1)
    deg = np.maximum(deg, 1)
    v = cols[:, 0].astype(np.float64)
    for _ in range(iterations):
        acc = np.zeros(n)
        np.add.at(acc, e[:, 0], v[e[:, 1]])
        np.add.at(acc, e[:, 1], v[e[:, 0]])
        v = 0.5 * v + 0.5 * acc / deg
    cols[:, 0] = v
    ca.data.foreach_set('color', cols.ravel())


def write_slot_uv(o):
    """Farbrolle je Flaeche als UV in die Palette schreiben / write the per-face colour role as a UV into the palette"""
    me = o.data
    vals = [0] * len(me.polygons)
    me.attributes['slot'].data.foreach_get('value', vals)
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    data = np.zeros(len(me.loops) * 2, dtype=np.float32)
    for p in me.polygons:
        u = (vals[p.index] + 0.5) / PALETTE_SIZE
        for li in p.loop_indices:
            data[li * 2] = u
            data[li * 2 + 1] = 0.5
    uv.data.foreach_set('uv', data)
    return o


def report(objs):
    """Dreiecke je Teil, nach Namensstamm zusammengefasst / triangles per part, grouped by name stem"""
    acc = {}
    for o in objs:
        k = o.name.split('.')[0]
        acc[k] = acc.get(k, 0) + tri_count(o)
    print('  parts:', ', '.join('%s %d' % kv for kv in sorted(acc.items(), key=lambda kv: -kv[1])), '| total', sum(acc.values()))


def tri_count(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


# ---------- Skelett / skeleton ----------

def make_armature(name, bones):
    """
    bones: Liste (Name, Eltern oder None, Kopf, Ende, deform, [x-Achse]) in Armaturkoordinaten.
    bones: list (name, parent or None, head, tail, deform, [x axis]) in armature coordinates.
    """
    arm = bpy.data.armatures.new(name)
    o = link(bpy.data.objects.new(name, arm))
    activate(o)
    bpy.ops.object.mode_set(mode='EDIT')
    for b in bones:
        nm, parent, head, tail, deform = b[:5]
        eb = arm.edit_bones.new(nm)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        if len(b) > 5 and b[5] is not None:
            # Rolle so setzen, dass die z-Achse des Knochens moeglichst entlang der Vorgabe liegt / roll so the bone z axis follows the hint
            eb.align_roll(Vector(b[5]))
        else:
            eb.align_roll(Vector((0, -1, 0)) if abs((eb.tail - eb.head).normalized().y) < 0.9 else Vector((0, 0, 1)))
        eb.use_deform = deform
        if parent:
            eb.parent = arm.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return o


def bind(mesh, arm):
    """Mesh an das Skelett haengen (Armature-Modifikator, Gruppen = Knochennamen) / bind mesh to the skeleton"""
    mesh.parent = arm
    m = mesh.modifiers.new('armature', 'ARMATURE')
    m.object = arm
    # fehlende Gruppen anlegen, damit jeder Deform-Knochen im Skin steht / create missing groups so every deform bone is in the skin
    for b in arm.data.bones:
        if b.use_deform and b.name not in mesh.vertex_groups:
            mesh.vertex_groups.new(name=b.name)
    return mesh


def new_action(arm, name):
    """Neue Aktion fuer das Skelett, Pose zurueckgesetzt / new action for the skeleton, pose reset"""
    if arm.animation_data is None:
        arm.animation_data_create()
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    return act


def stash(arm_or_key, name):
    """Aktive Aktion als NLA-Spur gleichen Namens ablegen (der Export macht je Spur einen Clip) / stash the active action as an NLA track of the same name (the export makes one clip per track)"""
    ad = arm_or_key.animation_data
    act = ad.action
    if act is None:
        return
    slot = getattr(ad, 'action_slot', None)
    tr = ad.nla_tracks.new()
    tr.name = name
    strip = tr.strips.new(name, int(act.frame_range[0]), act)
    strip.name = name
    if slot is not None and hasattr(strip, 'action_slot'):
        try:
            strip.action_slot = slot
        except Exception:
            pass
    ad.action = None


def key(pb, frame, loc=None, rot_q=None, scale=None):
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert('location', frame=frame)
    if rot_q is not None:
        pb.rotation_quaternion = rot_q
        pb.keyframe_insert('rotation_quaternion', frame=frame)
    if scale is not None:
        pb.scale = scale
        pb.keyframe_insert('scale', frame=frame)


def linear_keys(action):
    """Alle Kurven linear interpolieren (fuer Schleifen mit gleichmaessiger Drehung) / make all curves linear (for loops with even rotation)"""
    for fc in _fcurves(action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


def _fcurves(action):
    if hasattr(action, 'layers') and len(action.layers):
        for layer in action.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    yield from cb.fcurves
    elif hasattr(action, 'fcurves'):
        yield from action.fcurves


# ---------- Export ----------

def export_glb(path, objs, fps=24, meshopt=False, draco=False):
    """Auswahl als .glb schreiben: Skin, Morphziele, NLA-Spuren als Clips / write the selection as .glb: skin, morph targets, NLA tracks as clips"""
    bpy.context.view_layer.update()
    for x in bpy.context.scene.objects:
        x.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.context.scene.render.fps = fps
    kw = dict(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_texcoords=True, export_normals=True, export_tangents=False, export_materials='NONE',
        export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True, export_all_vertex_colors=False,
        export_skins=True, export_def_bones=True, export_influence_nb=4, export_all_influences=False,
        export_morph=True, export_morph_normal=False, export_morph_tangent=False,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=FRAME_STEP,
        export_optimize_animation_size=False,
        export_anim_slide_to_zero=True, export_reset_pose_bones=True, export_morph_animation=True,
        export_cameras=False, export_lights=False, export_extras=False,
        export_meshopt_compression_enable=meshopt, export_draco_mesh_compression_enable=draco,
    )
    bpy.ops.export_scene.gltf(**kw)


# ---------- Riemen und Baender / straps and bands ----------

def _catmull(pts, per=8, closed=False):
    """Glatte Kurve durch Stuetzpunkte / smooth curve through waypoints"""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    out = []
    last = n if closed else n - 1
    for i in range(last):
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[0]
        p1, p2 = pts[i], pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else pts[n - 1]
        for k in range(per):
            t = k / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    if not closed:
        out.append(pts[-1])
    return out


def surface_tree(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree


def strap(name, waypoints, width, slot, target=None, thickness=0.008, offset=0.004, closed=False, per=8, tree=None):
    """
    Riemen entlang von Stuetzpunkten, auf die Oberflaeche von target gelegt und aufgedickt (Solidify).
    Strap along waypoints, laid onto the surface of target and thickened (solidify).
    """
    tree = tree or (surface_tree(target) if target is not None else None)
    path = _catmull(waypoints, per, closed)
    n = len(path)
    bm = bmesh.new()
    rows = []
    for i, p in enumerate(path):
        a = path[(i - 1) % n] if (closed or i > 0) else path[0]
        b = path[(i + 1) % n] if (closed or i < n - 1) else path[n - 1]
        t = (b - a).normalized()
        if tree is not None:
            loc, nor, _i, _d = tree.find_nearest(p)
            nrm = (p - loc)
            nrm = nrm.normalized() if nrm.length > 1e-5 and nrm.dot(nor) > 0 else nor
            base = loc
        else:
            nrm = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            nrm = (nrm - t * nrm.dot(t)).normalized()
            base = p
        w = t.cross(nrm).normalized()
        row = []
        for s in (-1, 1):
            q = base + w * (s * width / 2)
            if tree is not None:
                l2, n2, _i, _d = tree.find_nearest(q + nrm * 0.02)
                q = l2 + nrm * offset
            row.append(bm.verts.new(q))
        rows.append(row)
    for i in range(n - 1 if not closed else n):
        a, b = rows[i], rows[(i + 1) % n]
        bm.faces.new((a[0], a[1], b[1], b[0]))
    o = new_object(name, bm, slot, recalc=False)
    m = o.modifiers.new('solidify', 'SOLIDIFY')
    m.thickness = thickness
    m.offset = 1.0
    apply_modifiers(o)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
    o.data.shade_smooth()
    o.data.set_sharp_from_angle(angle=math.radians(50))
    return o


def frame(origin, y_axis, z_hint):
    """Achsenkreuz als Matrix: y entlang y_axis, z moeglichst entlang z_hint / frame matrix: y along y_axis, z as close as possible to z_hint"""
    y = Vector(y_axis).normalized()
    z = Vector(z_hint)
    z = (z - y * z.dot(y)).normalized()
    x = y.cross(z).normalized()
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = Vector(origin)
    return m


def convex(name, points, slot, bevel_w=0.0, segs=2):
    """Konvexe Huelle der Punkte als Panzerplatten-Koerper, Kanten gefast / convex hull of the points as an armour body, edges bevelled"""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in points]
    bmesh.ops.convex_hull(bm, input=vs)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), verts=bm.verts, edges=bm.edges)
    o = new_object(name, bm, slot, smooth=False)
    if bevel_w > 0:
        bevel(o, bevel_w, segs, angle=20)
    return o


def instance(o, name, m):
    """Kopie eines Teils an neuer Stelle / copy of a part at a new place"""
    c = copy_object(o, name)
    transform(c, m)
    return c
