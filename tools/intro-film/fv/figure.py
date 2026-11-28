"""
Filmfiguren mit Skelett (Anime-Schnitt): Anfuehrer, Soldaten, Pferde aus tools/intro-film/web/figure*.ts.
Film figures with a skeleton (anime cut): leaders, soldiers, horses from tools/intro-film/web/figure*.ts.

Der Export liefert je Teil (Koerper, Kopf, Umhang) ein gezeichnetes Modell in der Bindehaltung, dazu das Skelett und je
Ecke: Knochen, Gewicht gegen den Elternknochen, Tuchwert. Hier wird daraus eine bewegliche Figur:
- Pose = Tabelle {Knochen: Winkel in Grad} (fv/poses.py), dazu Kuerzel fuer die Haende ('handL': 'point').
  Nicht genannte Knochen bleiben in der Bindehaltung.
- Je Bild: Vorwaertskinematik, dann jede Ecke um ihr Gelenk drehen. Zwischen Knochen und Elternknochen wird die
  DREHUNG gemischt (Quaternion), nicht der Ort: Aermel und Hosenbeine beugen wie ein Schlauch und schrumpfen nicht.
  Tuch (Umhang, Fahnen, Maehne) bekommt vorher eine Windverformung nach seinem Tuchwert.
- Die Tusche (Huelle, Knicklinien) wird mit denselben Gewichten bewegt, die Linienbreite regelt lib.units_refresh.
- Bewegung: track() mit Schluesselposen und weichem Uebergang, layer() fuer Atmen und Wiegen, face() fuer Blinzeln
  und Mienenwechsel (zweite Gesichtszeichnung wird eingeblendet).
- Heere: bake() friert eine Pose als geteiltes Netz ein, Flipbook wechselt gebackene Phasen (Galopp, Marsch).
The export delivers one inked model per piece (body, head, cape) in the bind pose, plus the skeleton and per vertex:
bone, weight against the parent bone, cloth value. This module turns that into a movable figure:
- pose = table {bone: angles in degrees} (fv/poses.py), plus shorthands for the hands ('handL': 'point'). Bones not
  named stay in the bind pose.
- per frame: forward kinematics, then every vertex is rotated about its joint. Between bone and parent the ROTATION
  is blended (quaternion), not the place: sleeves and trouser legs bend like a hose and do not shrink. Cloth (cape,
  flags, mane) gets a wind deformation by its cloth value first.
- the ink (hull, crease lines) moves with the same weights; lib.units_refresh sets the line width.
- motion: track() with key poses and eased transitions, layer() for breathing and sway, face() for blinks and
  changes of expression (a second face drawing is blended in).
- armies: bake() freezes a pose as a shared mesh, Flipbook switches baked phases (gallop, march).
"""
import math

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

from . import lib as L

D = math.pi / 180.0


# ---------- Gelenke / joints (dieselben Formeln wie web/figureKit.ts jointRot / the same formulas as jointRot) ----------
def _rx(a):
    c, s = math.cos(a * D), math.sin(a * D)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def _ry(a):
    c, s = math.cos(a * D), math.sin(a * D)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def _rz(a):
    c, s = math.cos(a * D), math.sin(a * D)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def joint_rot(kind, side, a):
    """Drehung eines Gelenks aus seinen Winkeln (Grad) / rotation of a joint from its angles (degrees)"""
    s = -1.0 if side < 0 else 1.0
    v = lambda i: (a[i] if i < len(a) else 0.0)  # noqa: E731
    if kind == 'spine':
        return _ry(v(2)) @ _rx(v(0)) @ _rz(-v(1))
    if kind == 'clav':
        return _rz(s * v(0)) @ _ry(-s * v(1))
    if kind == 'ball':
        return _rx(-v(0)) @ _rz(s * v(1)) @ _ry(s * v(2))
    if kind == 'elbow':
        return _rx(-v(0))
    if kind == 'knee':
        return _rx(v(0))
    if kind == 'wrist':
        return _ry(s * v(2)) @ _rz(-s * v(0)) @ _rx(-v(1))
    if kind == 'foot':
        return _ry(s * v(1)) @ _rx(-v(0)) @ _rz(v(2))
    if kind == 'curl':
        return _rx(-v(1)) @ _rz(-s * v(0))
    if kind == 'thumb':
        return _ry(s * v(1)) @ _rx(v(0)) @ _rz(s * v(2))
    if kind == 'tcurl':
        return _rx(v(0))
    return _ry(v(1)) @ _rx(v(0)) @ _rz(v(2))


class Rig:
    """Skelett aus dem Export / skeleton from the export"""

    def __init__(self, fig):
        self.bones = fig['bones']
        self.names = [b['name'] for b in self.bones]
        self.index = {n: i for i, n in enumerate(self.names)}
        self.parent = np.array([b['parent'] for b in self.bones], np.int64)
        self.offset = np.array([b['offset'] for b in self.bones], np.float64)
        self.head = np.array([b['head'] for b in self.bones], np.float64)
        # rot: Achsen x, y, z als Zeilen -> Spalten der Drehmatrix / axes as rows -> columns of the rotation matrix
        self.rot = np.array([np.array(b['rot'], np.float64).reshape(3, 3).T for b in self.bones])
        self.bind = {b['name']: list(b['bind']) for b in self.bones}
        self.marks = fig.get('marks', {})
        self.meta = fig.get('meta', {})
        # Probe: die Bindehaltung muss aus den Bindewinkeln entstehen (prueft joint_rot gegen figureKit.ts)
        # check: the bind pose must come out of the bind angles (tests joint_rot against figureKit.ts)
        R, p = self.fk({})
        assert np.abs(R - self.rot).max() < 1e-4 and np.abs(p - self.head).max() < 1e-4, 'bind pose mismatch'

    def fk(self, pose, scale=None, shift=None):
        """Vorwaertskinematik: Weltdrehung und Gelenkort je Knochen (Modellkoordinaten) / forward kinematics"""
        n = len(self.bones)
        R = np.zeros((n, 3, 3))
        p = np.zeros((n, 3))
        for i, b in enumerate(self.bones):
            ang = pose.get(b['name'], self.bind[b['name']])
            j = b['parent']
            if isinstance(ang, str):
                # 'flat' oder 'flat:12': Sohle waagerecht, Spitze in Laufrichtung des Unterschenkels (+ Grad nach aussen)
                # 'flat' or 'flat:12': sole level, toe along the shin's heading (+ degrees outward)
                f = R[j][:, 2]
                yaw = math.degrees(math.atan2(f[0], f[2])) + (float(ang.split(':')[1]) if ':' in ang else 0.0) * (1 if b['side'] >= 0 else -1)
                loc = R[j].T @ _ry(yaw)
            else:
                loc = joint_rot(b['kind'], b['side'], ang)
            if j < 0:
                R[i] = loc
                p[i] = self.offset[i] + (0 if shift is None else np.asarray(shift, np.float64))
            else:
                R[i] = R[j] @ loc
                off = self.offset[i] * (scale[self.names[j]] if scale and self.names[j] in scale else 1.0)
                p[i] = p[j] + R[j] @ off
        return R, p

    def mark(self, name, R, p):
        m = self.marks[name]
        return p[m['bone']] + R[m['bone']] @ np.array(m['p'], np.float64)


def _quats(Q):
    """Drehmatrizen -> Quaternionen (w, x, y, z) / rotation matrices -> quaternions"""
    out = np.zeros((len(Q), 4))
    for i, m in enumerate(Q):
        q = Matrix(m.tolist()).to_quaternion()
        out[i] = (q.w, q.x, q.y, q.z)
    return out


def _qrot(q, v):
    """Vektoren mit Quaternionen drehen (je Zeile) / rotate vectors by quaternions (per row)"""
    u = q[:, 1:]
    w = q[:, :1]
    t = 2.0 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


class _Skin:
    """Gewichte einer Punktmenge: Knochen, Elternknochen, Gewicht, Tuch, Ort relativ zum Gelenk / weights of a point set"""

    def __init__(self, rig, P, S):
        self.rig = rig
        self.P = np.asarray(P, np.float64)
        self.b = np.round(S[:, 0]).astype(np.int64)
        par = rig.parent[self.b]
        self.pb = np.where(par < 0, self.b, par)
        self.w = S[:, 1].astype(np.float64)[:, None]
        self.cloth = S[:, 2].astype(np.float64)
        self.rel = self.P - rig.head[self.b]
        self.has_cloth = bool((self.cloth > 1e-4).any())
        self.q = None

    def apply(self, q, pos, disp=None, scale=None):
        """Orte in der Pose; q = Quaternionen der Knochen (Pose mal Bindehaltung^-1), pos = Gelenkorte / posed places"""
        qa, qb = q[self.pb], q[self.b]
        qb = np.where((np.sum(qa * qb, 1) < 0)[:, None], -qb, qb)
        qv = qa * (1 - self.w) + qb * self.w
        qv /= np.linalg.norm(qv, axis=1, keepdims=True)
        self.q = qv
        rel = self.rel if disp is None else self.rel + disp
        if scale:
            # Massstab je Knochen in dessen Bindeachsen, nach dem Gewicht eingeblendet / scale per bone in its bind axes, faded in by the weight
            rel = rel.copy()
            for name, s in scale.items():
                i = self.rig.index[name]
                m = self.b == i
                if not m.any():
                    continue
                Rb = self.rig.rot[i]
                k = 1 + (np.asarray(s, np.float64)[None, :] - 1) * self.w[m]
                rel[m] = (rel[m] @ Rb * k) @ Rb.T
        return pos[self.b] + _qrot(qv, rel)

    def vec(self, v):
        """Richtungen (Normalen) mit der zuletzt gerechneten Drehung / directions (normals) with the last rotation"""
        return _qrot(self.q, v)


def _vnormals(P, tri):
    """Glatte Eckennormalen aus Dreiecken / smooth vertex normals from triangles"""
    fn = np.cross(P[tri[:, 1]] - P[tri[:, 0]], P[tri[:, 2]] - P[tri[:, 0]])
    N = np.zeros_like(P)
    for k in range(3):
        np.add.at(N, tri[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


class Wind:
    """
    Wind fuer Tuch: Richtung (Modellkoordinaten der Figur: +z vorn, +x links, y oben), Staerke (Auslenkung des Saums in
    Modelleinheiten), dazu laufende Wellen. Deterministisch.
    Wind for cloth: direction (the figure's model coordinates: +z front, +x left, y up), strength (deflection of the hem
    in model units), plus travelling waves. Deterministic.
    """

    def __init__(self, direction=(-0.6, 0.0, -0.8), strength=0.5, wave=0.09, speed=1.0, gust=0.25, lift=0.4, phase=0.0, scale=1.0):
        d = np.asarray(direction, np.float64)
        self.d = d / np.linalg.norm(d)
        self.strength, self.wave, self.speed, self.gust, self.lift, self.phase, self.scale = strength, wave, speed, gust, lift, phase, scale
        side = np.cross(self.d, (0, 1, 0))
        self.side = side / max(np.linalg.norm(side), 1e-9)

    def disp(self, P, cloth, t):
        """Versatz je Punkt (Bindehaltung) / offset per point (bind pose)"""
        c = cloth[:, None]
        tt = t * self.speed + self.phase
        k = 1.0 / self.scale
        along = P @ self.d
        across = P @ self.side
        y = P[:, 1]
        gust = 1.0 + self.gust * (0.6 * math.sin(tt * 1.3) + 0.4 * math.sin(tt * 2.9 + 1.7))
        # stehender Bausch und laufende Wellen (zum Saum hin staerker) / standing billow and travelling waves (stronger towards the hem)
        push = self.strength * gust * c ** 1.35
        ph1 = (y * 3.4 + across * 2.2) * k - tt * 4.2
        ph2 = (y * 7.3 - across * 5.1 + along * 2.0) * k - tt * 7.4 + 1.3
        ph3 = (across * 11.0 + y * 4.0) * k - tt * 11.0
        w1 = np.sin(ph1)[:, None]
        w2 = np.sin(ph2)[:, None]
        w3 = np.sin(ph3)[:, None]
        wave = self.wave * c ** 1.1
        out = self.d[None, :] * (push + wave * (0.8 * w1 + 0.35 * w2)) + self.side[None, :] * wave * (0.55 * np.cos(ph1)[:, None] + 0.3 * w2 + 0.25 * w3 * c)
        # das Tuch hebt sich, wenn es ausschwingt / the cloth rises as it swings out
        out[:, 1] += (self.lift * push[:, 0] + 0.3 * wave[:, 0] * (w1[:, 0] + 0.5 * w3[:, 0]))
        return out


# ---------- Netze / meshes ----------
def _blender(P):
    """Modell (y oben) -> Blender (z oben), Brettfeld -> Meter / model (y up) -> Blender (z up), tile -> metres"""
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1) * L.TILE


class Piece:
    """Ein Teil einer Figur: eigene Netze fuer Flaeche und Tusche, je Bild neu gesetzt / one piece of a figure: own meshes for fill and ink, reset per frame"""

    def __init__(self, shot, name, rig=None, floor=0.0, crease_k=1.0, cloth_normals=None, ao=(0.1, 0.6)):
        d = L.unit_data(name)
        assert d.get('figure'), '%s: no figure data' % name
        fig = d['figure']
        self.name, self.data = name, d
        self.rig = rig or Rig(fig)
        self.floor = floor
        with open(L.cache_file('units', name + '.bin'), 'rb') as fh:
            blob = fh.read()

        def arr(ref, width):
            dt = np.float32 if ref['type'] == 'f32' else np.uint32
            return np.frombuffer(blob, dtype=dt, count=ref['n'], offset=ref['off']).reshape(-1, width)

        part = d['parts'][0]
        skin = arr(fig['skin'], 3)
        pos = part['pos'].astype(np.float64)
        # verschweissen nach Ort und Gewicht / weld by place and weight
        key = np.concatenate([np.round(pos / 1e-4), np.round(skin * [1, 1000, 1000])], 1).astype(np.int64)
        uniq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1)
        tri = inv.reshape(-1, 3)
        ok = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
        corner = np.repeat(ok, 3)
        self.tri = tri[ok]
        self.fskin = _Skin(self.rig, pos[first], skin[first])
        self.loop_vert = inv[corner]
        self.nor = part['nor'][corner].astype(np.float64)
        self.cloth_normals = self.fskin.has_cloth if cloth_normals is None else cloth_normals
        me = bpy.data.meshes.new(name + '|fill')
        me.from_pydata(_blender(self.fskin.P).tolist(), [], self.tri.tolist())
        me.update()
        n = int(corner.sum())
        assert len(me.loops) == n
        uv = part['uv'][corner].astype(np.float32).copy()
        uv[:, 1] = 1.0 - uv[:, 1]
        me.uv_layers.new(name='UVMap').data.foreach_set('uv', uv.ravel())
        rgba = np.concatenate([part['col'][corner], np.ones((n, 1), np.float32)], 1).astype(np.float32)
        me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER').data.foreach_set('color', rgba.ravel())
        # Verdeckung fuer grosse Stoffflaechen beruhigen: erst ab ao[0], dann mit ao[1] gewichtet (sonst fleckige
        # Lichtbaender auf Rock und Umhang) / calm the occlusion for large cloth surfaces: only from ao[0] on, then
        # weighted by ao[1] (otherwise blotchy light bands on coat and cape)
        fx = part['fx'][corner].astype(np.float32).copy()
        fx[:, 1] = 1.0 - np.clip((1.0 - fx[:, 1]) - ao[0], 0.0, 1.0) * ao[1]
        for nm, val in (('glow', part['glow'][corner]), ('fx', fx)):
            v3 = np.concatenate([val, np.zeros((n, 1), np.float32)], 1).astype(np.float32)
            me.attributes.new(nm, 'FLOAT_VECTOR', 'CORNER').data.foreach_set('vector', v3.ravel())
        for poly in me.polygons:
            poly.use_smooth = True
        # freie Normalen je Flaechenecke: werden je Bild mitgedreht / free normals per face corner: rotated along per frame
        me.attributes.new('custom_normal', 'FLOAT_VECTOR', 'CORNER')
        self.fill_me = me

        # Tusche / ink
        ink = part['ink']
        st = L.style()
        self.hskin = _Skin(self.rig, ink['pos'].astype(np.float64), arr(fig['inkSkin'], 3))
        self.hnor = ink['nor'].astype(np.float64)
        self.hfaces = ink['idx'][:, [0, 2, 1]].astype(np.int64)
        cs = arr(fig['creaseSkin'], 6)
        self.nc = len(ink['a'])
        self.askin = _Skin(self.rig, ink['a'].astype(np.float64), cs[:, :3])
        self.bskin = _Skin(self.rig, ink['b'].astype(np.float64), cs[:, 3:])
        self.cw = ink['w'].astype(np.float64)
        self.r0 = st['creaseHalfWidth'] * L.TILE * crease_k
        nv, nc = len(self.hskin.P), self.nc
        p3 = ink['pos'].astype(np.float64)
        wav = L._noise3(p3 * 34.0) * 0.65 + L._noise3(p3 * 11.0) * 0.35
        base = nv + np.arange(nc)[:, None] * 8
        quads = [np.stack([base[:, 0] + k, base[:, 0] + (k + 1) % 4, base[:, 0] + 4 + (k + 1) % 4, base[:, 0] + 4 + k], 1) for k in range(4)]
        quads = np.concatenate(quads, 0) if nc else np.zeros((0, 4), np.int64)
        me2 = bpy.data.meshes.new(name + '|ink')
        me2.from_pydata(np.zeros((nv + nc * 8, 3)).tolist(), [], self.hfaces.tolist() + quads.tolist())
        me2.update()
        me2.attributes.new('off', 'FLOAT_VECTOR', 'POINT')
        me2.attributes.new('rad', 'FLOAT_VECTOR', 'POINT')
        me2.attributes.new('wav', 'FLOAT', 'POINT').data.foreach_set('value', np.concatenate([wav, np.zeros(nc * 8)]).astype(np.float32))
        me2.materials.append(L.ink_mat())
        me2.materials.append(L.ink_line_mat())
        me2.polygons.foreach_set('material_index', np.concatenate([np.zeros(len(self.hfaces), np.int32), np.ones(len(quads), np.int32)]))
        self.ink_me = me2
        self.mat = L.inked_mat(shot, d['atlas'])
        me.materials.append(self.mat)

    def pose(self, q, pos, wind=None, t=0.0, scale=None):
        """Netze in die Pose setzen / put the meshes into the pose"""
        sh = np.array([0.0, -self.floor, 0.0])

        def place(sk):
            disp = wind.disp(sk.P, sk.cloth, t) if (wind is not None and sk.has_cloth) else None
            return sk.apply(q, pos, disp, scale) + sh

        # Flaeche / fill
        P = place(self.fskin)
        me = self.fill_me
        me.vertices.foreach_set('co', _blender(P).astype(np.float32).ravel())
        if self.cloth_normals:
            N = _vnormals(P, self.tri)[self.loop_vert]
        else:
            N = _qrot(self.fskin.q[self.loop_vert], self.nor)
        me.attributes['custom_normal'].data.foreach_set('vector', (_blender(N) / L.TILE).astype(np.float32).ravel())
        me.update()
        # Tusche: Huelle und Knickprismen wie lib._ink_mesh / ink: hull and crease prisms as lib._ink_mesh
        H = place(self.hskin)
        if self.cloth_normals:
            HN = -_vnormals(H, self.hfaces)
        else:
            HN = self.hskin.vec(self.hnor)
        nv, nc = len(H), self.nc
        if nc:
            a, b = _blender(place(self.askin)), _blender(place(self.bskin))
            d = b - a
            d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
            ref = np.where(np.abs(d[:, 2:3]) > 0.9, np.array([[1.0, 0, 0]]), np.array([[0, 0, 1.0]]))
            u = np.cross(d, ref)
            u /= np.maximum(np.linalg.norm(u, axis=1, keepdims=True), 1e-9)
            v = np.cross(d, u)
            r0, w = self.r0, self.cw
            a2 = a - d * (0.7 * r0) * w[:, 0:1]
            b2 = b + d * (0.7 * r0) * w[:, 1:2]
            dirs = np.stack([u, v, -u, -v], 1)
            cpos = np.concatenate([np.repeat(a2[:, None, :], 4, 1), np.repeat(b2[:, None, :], 4, 1)], 1).reshape(-1, 3)
            crad = np.concatenate([dirs * (1.15 * r0) * w[:, 0, None, None], dirs * (1.15 * r0) * w[:, 1, None, None]], 1).reshape(-1, 3)
        else:
            cpos = crad = np.zeros((0, 3))
        me2 = self.ink_me
        me2.vertices.foreach_set('co', np.concatenate([_blender(H), cpos], 0).astype(np.float32).ravel())
        me2.attributes['off'].data.foreach_set('vector', np.concatenate([_blender(HN) / L.TILE, np.zeros((nc * 8, 3))], 0).astype(np.float32).ravel())
        me2.attributes['rad'].data.foreach_set('vector', np.concatenate([np.zeros((nv, 3)), crad], 0).astype(np.float32).ravel())
        me2.update()


def _objects(shot, name, fill_me, ink_me, parent=None, data=None, inkw=None):
    """
    Flaeche + Tusche als Objekte. Ohne inkw: bei lib.units_refresh angemeldet (Linienbreite je Bild nach der Kamera).
    Mit inkw: die Tusche ist schon ins Netz gebacken (bake(ink_px=...)), kein Modifikator: viele Objekte teilen dann
    wirklich ein Netz (Heere).
    Fill + ink as objects. Without inkw: registered with lib.units_refresh (line width per frame by the camera). With
    inkw: the ink is already baked into the mesh (bake(ink_px=...)), no modifier: many objects then truly share one
    mesh (armies).
    """
    fill = bpy.data.objects.new(name, fill_me)
    shot.sc.collection.objects.link(fill)
    fill['glowoff'] = 0.0
    fill['inkw'] = 0.05 if inkw is None else float(inkw)
    if parent is not None:
        fill.parent = parent
    if ink_me is None:
        # fern: nur die Flaeche (Umrisse waeren unter einem Bildpunkt), kein Schattenwurf / far: fill only (outlines would be below one pixel), no cast shadow
        fill.visible_shadow = False
        return fill, None
    line = bpy.data.objects.new(name + '.ink', ink_me)
    shot.sc.collection.objects.link(line)
    line.parent = fill
    line.visible_shadow = False
    if inkw is None:
        mod = line.modifiers.new('ink', 'NODES')
        mod.node_group = L._ink_geo()
        shot.units.append({'name': name, 'parts': [(fill, line, mod)], 'turrets': [], 'data': data or {}})
    return fill, line


def decimate(me, ratio):
    """Netz vereinfachen (Kopien in der Ferne) / simplify a mesh (copies in the distance)"""
    ob = bpy.data.objects.new('tmp_decimate', me)
    bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new('d', 'DECIMATE')
    m.ratio = ratio
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    for mat in me.materials:
        if mat.name not in [x.name for x in out.materials if x]:
            out.materials.append(mat)
    return out


def ink_values(scale, px, px_out):
    """Linienwerte wie lib.units_refresh fuer eine feste Bildpunktgroesse px (Welt): (A, B, R, inkw) / line values as lib.units_refresh for a fixed pixel size px (world)"""
    st = L.style()
    width = st['outline'] * L.TILE * scale
    lo = min(max(0.25 * width, L.INK_MIN_PX * px), L.INK_MAX_PX * px)
    hi = min(max(1.75 * width, L.INK_MIN_PX * px), L.INK_MAX_PX * px)
    wpx = 2 * st['creaseHalfWidth'] * L.TILE * scale / px
    rr = max(wpx, 0.5) * L._smooth(0.16, 0.62, wpx) / max(wpx, 1e-6)
    inkw = min(0.5, st['ref'] / (2.0 * st['sdfRange']) * L.INK_SOFT * px_out / (L.TILE * scale))
    return lo / scale, (hi - lo) / scale, rr, inkw


# Kuerzel fuer die Haende: Fingerwinkel je Geste (ohne Seitenzeichen) / shorthands for the hands: finger angles per gesture (without the side letter)
HANDS = {
    'relaxed': {'thumb1': [-38, 40, 0], 'thumb2': [10], 'thumb3': [12], 'index1': [14, 5], 'index2': [20], 'index3': [12], 'middle1': [20, 1], 'middle2': [26], 'middle3': [14],
                'ring1': [26, -3], 'ring2': [30], 'ring3': [16], 'pinky1': [30, -8], 'pinky2': [32], 'pinky3': [18]},
    'open': {'thumb1': [-52, 22, 0], 'thumb2': [2], 'thumb3': [2], 'index1': [3, 9], 'index2': [5], 'index3': [3], 'middle1': [3, 1], 'middle2': [5], 'middle3': [3],
             'ring1': [4, -6], 'ring2': [6], 'ring3': [3], 'pinky1': [6, -15], 'pinky2': [8], 'pinky3': [4]},
    'fist': {'thumb1': [-12, 72, 24], 'thumb2': [34], 'thumb3': [58], 'index1': [78, 0], 'index2': [100], 'index3': [62], 'middle1': [82, 0], 'middle2': [102], 'middle3': [64],
             'ring1': [84, 0], 'ring2': [102], 'ring3': [64], 'pinky1': [86, -2], 'pinky2': [100], 'pinky3': [62]},
    'point': {'thumb1': [-14, 70, 22], 'thumb2': [32], 'thumb3': [52], 'index1': [2, 2], 'index2': [3], 'index3': [2], 'middle1': [82, 0], 'middle2': [102], 'middle3': [64],
              'ring1': [84, 0], 'ring2': [102], 'ring3': [64], 'pinky1': [86, -2], 'pinky2': [100], 'pinky3': [62]},
    'grip': {'thumb1': [-26, 78, 12], 'thumb2': [22], 'thumb3': [34], 'index1': [52, 0], 'index2': [74], 'index3': [40], 'middle1': [56, 0], 'middle2': [78], 'middle3': [42],
             'ring1': [58, 0], 'ring2': [80], 'ring3': [44], 'pinky1': [60, -2], 'pinky2': [80], 'pinky3': [44]},
}


def expand(pose):
    """Kuerzel aufloesen: 'fingersL': 'fist' -> Fingerknochen / resolve shorthands: 'fingersL': 'fist' -> finger bones"""
    out = {}
    for k, v in pose.items():
        if k in ('fingersL', 'fingersR'):
            preset = HANDS[v] if isinstance(v, str) else v
            for bone, ang in preset.items():
                out[bone + k[-1]] = list(ang)
        else:
            out[k] = v
    return out


def blend(rig, a, b, k):
    """Zwei Posen mischen (Winkel je Knochen linear; 'pos' und 'scale' ebenso) / blend two poses (angles per bone linearly; 'pos' and 'scale' too)"""
    a, b = expand(a), expand(b)
    out = {}
    for name in set(a) | set(b):
        if name == 'scale':
            sa, sb = a.get('scale', {}), b.get('scale', {})
            out['scale'] = {n: tuple(np.asarray(sa.get(n, (1, 1, 1)), float) * (1 - k) + np.asarray(sb.get(n, (1, 1, 1)), float) * k) for n in set(sa) | set(sb)}
            continue
        if name == 'pos':
            out['pos'] = tuple(np.asarray(a.get('pos', (0, 0, 0)), float) * (1 - k) + np.asarray(b.get('pos', (0, 0, 0)), float) * k)
            continue
        if name not in rig.bind:
            continue
        base = rig.bind[name]
        if isinstance(a.get(name, base), str) or isinstance(b.get(name, base), str):
            out[name] = a.get(name, base) if k < 0.5 else b.get(name, base)
            continue
        va, vb = list(a.get(name, base)), list(b.get(name, base))
        n = max(len(va), len(vb), 1)
        va += [0.0] * (n - len(va))
        vb += [0.0] * (n - len(vb))
        out[name] = [va[i] * (1 - k) + vb[i] * k for i in range(n)]
    return out


def add(rig, a, b, k=1.0):
    """Pose b (Winkelzugaben) auf a aufschlagen / add pose b (angle offsets) onto a"""
    out = dict(expand(a))
    for name, v in b.items():
        if name == 'scale':
            sc = dict(out.get('scale', {}))
            for n, s in v.items():
                sc[n] = tuple(np.asarray(sc.get(n, (1, 1, 1)), float) * (1 + (np.asarray(s, float) - 1) * k))
            out['scale'] = sc
            continue
        if name == 'pos':
            out['pos'] = tuple(np.asarray(out.get('pos', (0, 0, 0)), float) + np.asarray(v, float) * k)
            continue
        if isinstance(out.get(name), str) or isinstance(v, str):
            continue
        base = list(out.get(name, rig.bind.get(name, [])))
        n = max(len(base), len(v))
        base += [0.0] * (n - len(base))
        out[name] = [base[i] + (v[i] * k if i < len(v) else 0.0) for i in range(n)]
    return out


class Figure:
    """
    Bewegliche Figur aus mehreren Teilen an einem Skelett. loc = Standpunkt (die tiefste Sohle liegt dort), rot = Drehung
    um die Hochachse in Grad (0: Blick nach -y, wie die Einheiten), height = Koerperhoehe in Metern (Sohle bis Scheitel).
    Movable figure of several pieces on one skeleton. loc = standing point (the lowest sole lies there), rot = rotation
    about the vertical axis in degrees (0: facing -y, as the units), height = body height in metres (sole to crown).
    """

    def __init__(self, shot, pieces, loc=(0, 0, 0), rot=0.0, height=1.86, wind=None, crease_k=1.5, ground=('ballL', 'heelL', 'ballR', 'heelR'), name='figure', parent=None):
        self.shot = shot
        first = L.unit_data(pieces[0])['figure']
        self.rig = Rig(first)
        self.floor = float(self.rig.meta.get('floor', 0.0))
        self.model_h = float(self.rig.meta.get('height', 0.855 - self.floor))
        self.root = bpy.data.objects.new(name, None)
        shot.sc.collection.objects.link(self.root)
        if parent is not None:
            # im Rahmen einer anderen Figur (Reiter auf dem Pferd): gleiche Modelleinheiten, Ort ueber die Pose ('pos')
            # in another figure's frame (rider on the horse): the same model units, placed through the pose ('pos')
            self.root.parent = parent.root
            self.scale = parent.scale
            self.floor = parent.floor
        else:
            self.scale = height / (self.model_h * L.TILE)
            self.root.location = Vector(loc)
            self.root.rotation_euler = Euler((0, 0, math.radians(rot)))
            self.root.scale = (self.scale,) * 3
        self.pieces = []
        self.obs = {}
        for pn in pieces:
            pc = Piece(shot, pn, self.rig, self.floor, crease_k)
            fill, line = _objects(shot, pn, pc.fill_me, pc.ink_me, self.root, pc.data)
            self.pieces.append(pc)
            self.obs[pn] = (fill, line)
        self.wind = wind
        self.ground = [g for g in ground if g in self.rig.marks]
        self.base = {}
        self.keys = []
        self.layers = []
        self.faces = None
        self.R = self.p = None
        self.shift = np.zeros(3)
        self.update(0.0)

    # --- Posen / poses ---
    def set_pose(self, pose):
        self.base = expand(pose)
        self.keys = []
        return self

    def track(self, keys):
        """Schluesselposen [(t, Pose[, Uebergang])]; Uebergang = Funktion 0..1 -> 0..1 (Standard ease_io) / key poses [(t, pose[, ease])]"""
        self.keys = [(k[0], expand(k[1]), k[2] if len(k) > 2 else L.ease_io) for k in sorted(keys, key=lambda k: k[0])]
        return self

    def layer(self, fn):
        """fn(t) -> Winkelzugaben, die auf die Pose aufgeschlagen werden (Atmen, Wiegen) / fn(t) -> angle offsets added onto the pose (breathing, sway)"""
        self.layers.append(fn)
        return self

    def pose_at(self, t):
        if not self.keys:
            pose = dict(self.base)
        elif t <= self.keys[0][0]:
            pose = dict(self.keys[0][1])
        elif t >= self.keys[-1][0]:
            pose = dict(self.keys[-1][1])
        else:
            for i in range(1, len(self.keys)):
                if t <= self.keys[i][0]:
                    t0, a, _ = self.keys[i - 1]
                    t1, b, ease = self.keys[i]
                    pose = blend(self.rig, a, b, ease((t - t0) / max(1e-9, t1 - t0)))
                    break
        for fn in self.layers:
            pose = add(self.rig, pose, fn(t))
        return pose

    def update(self, t):
        pose = self.pose_at(t)
        scale = pose.get('scale')
        R, p = self.rig.fk(pose, scale, pose.get('pos'))
        # auf den Boden stellen: die tiefste Sohle auf die Standhoehe / put on the ground: the lowest sole at standing height
        if self.ground:
            low = min(self.rig.mark(g, R, p)[1] for g in self.ground)
            p = p + np.array([0.0, self.floor - low, 0.0])
        self.R, self.p = R, p
        Q = R @ np.transpose(self.rig.rot, (0, 2, 1))
        q = _quats(Q)
        for pc in self.pieces:
            pc.pose(q, p, self.wind, t, scale)
        if self.faces:
            self._face_update(t)

    def bone_scale(self, pose, name):
        return pose.get('scale', {}).get(name)

    # --- Punkte / points ---
    def local(self, name):
        """Benannter Punkt in Blender-Koordinaten der Figur (vor Ort, Drehung, Massstab) / named point in the figure's Blender coordinates"""
        v = self.rig.mark(name, self.R, self.p) - np.array([0.0, self.floor, 0.0])
        return Vector((v[0], -v[2], v[1])) * L.TILE

    def world(self, name):
        """Benannter Punkt (Sohle, Fingerspitze, Augen) in der Welt / named point (sole, fingertip, eyes) in the world"""
        return L._world(self.root) @ self.local(name)

    def bone_world(self, bone, p=(0, 0, 0)):
        i = self.rig.index[bone]
        v = self.p[i] + self.R[i] @ np.asarray(p, np.float64) - np.array([0.0, self.floor, 0.0])
        return L._world(self.root) @ (Vector((v[0], -v[2], v[1])) * L.TILE)

    # --- Mimik / expression ---
    def face_setup(self, piece, atlases):
        """
        Gesichtszeichnungen eines Teils (Kopf): das Material bekommt ein zweites Texturpaar und einen Mischregler.
        Face drawings of one piece (head): the material gets a second texture pair and a blend control.
        """
        pc = [x for x in self.pieces if x.name == piece][0]
        nt = pc.mat.node_tree
        tex = [n for n in nt.nodes if n.type == 'TEX_IMAGE']
        paint = [n for n in tex if not n.image.colorspace_settings.is_data and n.image.name.endswith('-paint')][0]
        ink = [n for n in tex if n.image.name.endswith('-ink')][0]
        k = nt.nodes.new('ShaderNodeValue')
        k.outputs[0].default_value = 0.0
        second = []
        for src in (paint, ink):
            t2 = nt.nodes.new('ShaderNodeTexImage')
            t2.image = src.image
            t2.interpolation = src.interpolation
            t2.extension = src.extension
            nt.links.new(src.inputs['Vector'].links[0].from_socket, t2.inputs['Vector'])
            for out in ('Color', 'Alpha'):
                links = [(l.to_socket) for l in src.outputs[out].links]
                if not links:
                    continue
                mx = nt.nodes.new('ShaderNodeMix')
                mx.data_type = 'RGBA'
                nt.links.new(k.outputs[0], mx.inputs['Factor'])
                nt.links.new(src.outputs[out], mx.inputs[6])
                nt.links.new(t2.outputs[out], mx.inputs[7])
                for to in links:
                    nt.links.new(mx.outputs[2], to)
            second.append(t2)
        self.faces = {'k': k, 'tex': second, 'images': {a: L.atlas_images(a) for a in atlases}, 'keys': []}
        return self

    def face(self, keys):
        """Mimik-Spur [(t, Atlasname, Anteil 0..1)]: zwischen den Stuetzstellen linear, je Abschnitt eine Zielzeichnung / expression track"""
        self.faces['keys'] = sorted(keys, key=lambda k: k[0])
        return self

    def _face_update(self, t):
        f = self.faces
        keys = f['keys']
        if not keys:
            return
        cur = keys[0]
        nxt = None
        for i, kf in enumerate(keys):
            if kf[0] <= t:
                cur = kf
                nxt = keys[i + 1] if i + 1 < len(keys) else None
        atlas, k = cur[1], cur[2]
        if nxt is not None and t > cur[0]:
            u = (t - cur[0]) / max(1e-9, nxt[0] - cur[0])
            if nxt[1] != cur[1] and cur[2] <= 1e-6:
                atlas = nxt[1]
            k = cur[2] + (nxt[2] - cur[2]) * u if nxt[1] == atlas or cur[2] <= 1e-6 else cur[2]
        # Einblenden in Stufen (begrenzte Animation: 0, 1/2, 1) / fade in steps (limited animation: 0, 1/2, 1)
        k = round(k * 2) / 2
        paint, ink = f['images'][atlas]
        if f['tex'][0].image != paint:
            f['tex'][0].image = paint
            f['tex'][1].image = ink
        f['k'].outputs[0].default_value = float(k)

    # --- Einfrieren / freezing ---
    def bake(self, name=None, ink_px=None, lod=None):
        """
        Aktuelle Pose als geteilte Netze je Teil: [(Flaeche, Tusche, Daten, inkw)]. ink_px = (Weltgroesse eines
        Bildpunkts, eines ausgegebenen Bildpunkts) in der Entfernung, in der die Kopien stehen: die Linienbreite wird
        dann ins Tuschenetz gebacken (inkw gesetzt), Kopien brauchen keinen Modifikator. lod = Anteil der Dreiecke
        (mit ink_px): vereinfachte Flaeche und Huelle ohne Innenlinien fuer mittlere Entfernungen.
        The current pose as shared meshes per piece: [(fill, ink, data, inkw)]. ink_px = (world size of one pixel, of
        one output pixel) at the distance where the copies stand: the line width is then baked into the ink mesh (inkw
        set), copies need no modifier. lod = share of the triangles (with ink_px): simplified fill and hull without
        inner lines for mid distances.
        """
        out = []
        for pc in self.pieces:
            f = pc.fill_me.copy()
            i = pc.ink_me.copy()
            inkw = None
            if ink_px is not None:
                a, b, r, inkw = ink_values(self.scale, ink_px[0], ink_px[1])
                n = len(i.vertices)
                co = np.empty(n * 3, np.float32)
                off = np.empty(n * 3, np.float32)
                rad = np.empty(n * 3, np.float32)
                wav = np.empty(n, np.float32)
                i.vertices.foreach_get('co', co)
                i.attributes['off'].data.foreach_get('vector', off)
                i.attributes['rad'].data.foreach_get('vector', rad)
                i.attributes['wav'].data.foreach_get('value', wav)
                co = co.reshape(-1, 3) + off.reshape(-1, 3) * (a + b * wav)[:, None] + rad.reshape(-1, 3) * r
                if lod:
                    # mittlere Entfernung: nur die Huelle, vereinfacht; Flaeche vereinfacht / mid distance: the hull only, simplified; fill simplified
                    nv = len(pc.hskin.P)
                    hull = bpy.data.meshes.new(i.name)
                    hull.from_pydata(co[:nv].tolist(), [], pc.hfaces.tolist())
                    hull.update()
                    hull.materials.append(L.ink_mat())
                    bpy.data.meshes.remove(i)
                    i = decimate(hull, lod)
                    bpy.data.meshes.remove(hull)
                    f2 = decimate(f, lod)
                    bpy.data.meshes.remove(f)
                    f = f2
                else:
                    i.vertices.foreach_set('co', co.astype(np.float32).ravel())
                    for nm in ('off', 'rad', 'wav'):
                        i.attributes.remove(i.attributes[nm])
                    i.update()
            if name:
                f.name, i.name = name + '|' + pc.name + '|fill', name + '|' + pc.name + '|ink'
            out.append((f, i, pc.data, inkw))
        return out

    def bake_shared(self):
        """Die lebenden Netze selbst teilen (weitere Objekte bewegen sich mit) / share the live meshes themselves (further objects move along)"""
        return [(pc.fill_me, pc.ink_me, pc.data, None) for pc in self.pieces]

    def no_rim(self, piece):
        """Kein Rand- und Bodenlicht auf diesem Teil (Tuch mit vielen Falten wuerde fleckig) / no rim and bounce light on this piece (cloth with many folds would get blotchy)"""
        for pc in self.pieces:
            if pc.name == piece:
                pc.mat['fv_rim'] = 1
                pc.mat['fv_bounce'] = 1
        return self

    def hide(self, hidden=True):
        for fill, line in self.obs.values():
            L.hide(fill, hidden)
            L.hide(line, hidden)


class Baked:
    """Eingefrorene Figur als Objekt (Heer): teilt die Netze, eigener Ort / frozen figure as an object (army): shares the meshes, own place"""

    def __init__(self, shot, frames, loc=(0, 0, 0), rot=0.0, scale=1.0, name='baked', offset=0.0, rate=0.0):
        """frames = Liste von bake()-Ergebnissen (eine Phase je Eintrag) / list of bake() results (one phase per entry)"""
        self.frames = frames
        self.root = bpy.data.objects.new(name, None)
        shot.sc.collection.objects.link(self.root)
        self.root.location = Vector(loc)
        self.root.rotation_euler = Euler((0, 0, math.radians(rot)))
        self.root.scale = (scale,) * 3
        self.parts = [_objects(shot, name, f, i, self.root, d, w) for f, i, d, w in frames[0]]
        self.offset, self.rate, self.cur = offset, rate, 0

    def update(self, t):
        """Phase wechseln (Daumenkino) / switch the phase (flip book)"""
        if len(self.frames) < 2 or self.rate <= 0:
            return
        k = int(math.floor((t * self.rate + self.offset) % 1.0 * len(self.frames))) % len(self.frames)
        if k == self.cur:
            return
        self.cur = k
        for (fill, line), (f, i, _d, _w) in zip(self.parts, self.frames[k]):
            fill.data = f
            if line is not None:
                line.data = i
