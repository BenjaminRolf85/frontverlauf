"""
Welt-Baukasten, Teil Atmosphaere: gemalter Himmel je Akt (Rundhorizont mit Wolkenbaendern), Dunstbaenke zwischen den
Tiefenschichten, Lichtfinger, gezeichneter Rauch (Ballen mit Lichtkante und Tusche), Staub- und Rauchkarten, Teilchen
(Glut, Asche, Regen, Atem), Voegel, Fahnen und Menschen als Silhouetten.
World kit, atmosphere: painted sky per act (cyclorama with cloud bands), haze banks between the depth layers, light
shafts, drawn smoke (lumps with a light edge and ink), dust and smoke cards, particles (embers, ash, rain, breath),
birds, flags and people as silhouettes.
"""
import hashlib
import math

import bpy
import numpy as np
from mathutils import Vector

from . import anime as A
from . import lib as L
from . import scenery as S
from . import world as W


# ---------- Himmel / sky ----------
def paint_bands(img, spec, bands):
    """
    Flache Wolkenbaender (Stratus) wie in gemalten Abendhimmeln: lange, spitz auslaufende Streifen, von unten beleuchtet
    (die Sonne steht tief): Unterseite hell, Oberseite dunkel, schmaler Saum. band = {el, az=(a0, a1), n, len=(l0, l1),
    thick=(t0, t1) in Grad, cols=(dunkel, hell, Saum), seed, jitter}.
    Flat cloud bands (stratus) as in painted evening skies: long streaks with pointed ends, lit from below (the sun is
    low): bright underside, dark top, a narrow fringe. band = {el, az, n, len, thick in degrees, cols=(dark, light,
    fringe), seed, jitter}.
    """
    h, w = spec.h, spec.w
    px_az = (spec.az[1] - spec.az[0]) / w
    for b in bands:
        R = np.random.default_rng(b.get('seed', 3))
        dark, light, rim = [np.asarray(c, np.float32) for c in b['cols']]
        for i in range(b['n']):
            az = R.uniform(*b['az'])
            el = b['el'] + R.uniform(-1, 1) * b.get('jitter', 1.0)
            rx = R.uniform(*b['len']) / 2 / px_az
            cy = A._el_row(spec, el)
            ry = abs(A._el_row(spec, el + R.uniform(*b['thick']) / 2) - cy)
            cx = (az - spec.az[0]) / px_az
            x0, x1 = int(max(0, cx - rx - 8)), int(min(w, cx + rx + 8))
            y0, y1 = int(max(0, cy - ry * 2.2 - 8)), int(min(h, cy + ry * 2.2 + 8))
            if x1 - x0 < 4 or y1 - y0 < 4:
                continue
            yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
            u, v = (xx - cx) / rx, (yy - cy) / ry
            n1 = A.fbm(y1 - y0, x1 - x0, max(6.0, ry * 3.0), int(R.integers(0, 9999)), 3) - 0.5
            n2 = np.repeat(A.fbm(y1 - y0, (x1 - x0) // 6 + 2, max(3.0, ry * 1.2), int(R.integers(0, 9999)), 2), 6, 1)[:, :x1 - x0] - 0.5
            # Linse mit spitzen Enden, Kante ausgefranst / lens with pointed ends, frayed edge
            d = (1 - np.abs(u) ** 1.6) * (1.0 + 0.9 * n2) - np.abs(v + n1 * 0.8)
            a = np.clip(d * ry / 1.3 + 0.5, 0, 1) * (np.abs(u) < 1)
            lit = (v + n1 * 1.2 + 0.25 * u * b.get('lean', 0.0)) > b.get('split', 0.0)
            c = np.where(lit[..., None], light, dark)
            edge = (d * ry > 0) & (d * ry < b.get('rim', 2.2)) & (v > 0)
            c = np.where(edge[..., None], rim, c)
            a = a * b.get('alpha', 1.0)
            sub = img[y0:y1, x0:x1]
            sub += (c - sub) * a[..., None]
    return img


def paint_stars(img, spec, n, color, seed=5, el_min=4.0):
    R = np.random.default_rng(seed)
    c = np.asarray(color, np.float32)
    row0 = int(A._el_row(spec, el_min))
    xs, ys = R.integers(1, spec.w - 1, n), R.integers(1, max(2, row0), n)
    br = R.uniform(0.25, 1.0, n) ** 2
    for x, y, k in zip(xs, ys, br):
        img[y, x] += (c - img[y, x]) * k
        if k > 0.6:
            img[y, x - 1:x + 2] += (c - img[y, x - 1:x + 2]) * 0.3
            img[y - 1:y + 2, x] += (c - img[y - 1:y + 2, x]) * 0.3
    return img


def sky(shot, name, centre, radius=4500.0, bands=None, stars=None, post=None, **kw):
    """
    Gemalter Himmel als Rundhorizont: anime.paint_sky (Verlauf, Sonne, Kumulusbaenke, ferne Landschichten) plus
    Wolkenbaender, Sterne und ein eigener Nachmaler post(img, spec). Das Bild liegt im Cache (Name + Pruefsumme der
    Angaben). / painted sky as a cyclorama: anime.paint_sky (gradient, sun, cumulus banks, far land layers) plus cloud
    bands, stars and an own post painter. The picture is cached (name + checksum of the settings).
    """
    kw.setdefault('cloud_cols', (A.hexc('smoke400'), A.hexc('smoke300'), A.hexc('cloud300'), A.hexc('cloud100')))
    spec = A.SkySpec(**kw)
    key = hashlib.md5((repr(sorted(kw.items(), key=lambda x: x[0])) + repr(bands) + repr(stars) + (post.__name__ if post else '')).encode()).hexdigest()[:8]

    def painter():
        land, spec.land = spec.land, []
        img = A.paint_sky(spec)
        if stars:
            img = paint_stars(img, spec, *stars)
        if bands:
            img = paint_bands(img, spec, bands)
        if post:
            img = post(img, spec)
        if land:
            # Landschichten zuletzt, vor den Wolken / land layers last, in front of the clouds
            spec.land = land
            img = _land_only(img, spec)
        return np.clip(img, 0, 1)
    img = A.painted('%s_%s' % (name, key), painter)
    nseg = 96
    t0, t1 = math.tan(math.radians(spec.el[0])), math.tan(math.radians(spec.el[1]))
    verts, faces, uvs = [], [], []
    for i in range(nseg + 1):
        a = math.radians(spec.az[0] + (spec.az[1] - spec.az[0]) * i / nseg)
        x, y = math.sin(a) * radius, math.cos(a) * radius
        verts += [(x, y, t0 * radius), (x, y, t1 * radius)]
    for i in range(nseg):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    uv = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index
            uv.data[li].uv = ((vi // 2) / nseg, 0.0 if vi % 2 == 0 else 1.0)
    m = bpy.data.materials.new(name)
    nt, n, Ln = L._nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    tx = n.new('ShaderNodeTexImage')
    tx.image = img
    tx.interpolation = 'Cubic'
    tx.extension = 'EXTEND'
    mul = n.new('ShaderNodeMix')
    mul.name = 'tint'
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs[0].default_value = 1.0
    mul.inputs[7].default_value = (1, 1, 1, 1)
    Ln.new(tx.outputs['Color'], mul.inputs[6])
    em = n.new('ShaderNodeEmission')
    Ln.new(mul.outputs[2], em.inputs[0])
    L._no_shadow(m, em.outputs[0], out)
    m['fv_nohaze'] = 1
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(centre)
    ob.visible_shadow = False
    ob['fv_spec'] = name
    return ob, spec


def sky_tint(ob, c):
    """Himmel abdunkeln oder einfaerben (Faktor je Kanal) / darken or tint the sky (factor per channel)"""
    ob.data.materials[0].node_tree.nodes['tint'].inputs[7].default_value = (c[0], c[1], c[2], 1)


def _land_only(img, spec):
    """Nur die Landschichten von anime.paint_sky (gleiche Formeln) / only the land layers of anime.paint_sky"""
    w, h = spec.w, spec.h
    yy = np.arange(h, dtype=np.float32)[:, None]
    for layer in spec.land:
        R3 = np.random.default_rng(layer['seed'])
        prof = np.zeros(w, np.float32)
        x = np.arange(w, dtype=np.float32)
        for k in range(6):
            f = R3.uniform(0.5, 1.5) * (k + 1) * 2 * math.pi / w * layer['waves']
            prof += np.sin(x * f + R3.uniform(0, 6.28)) / (k + 1)
        prof = layer['el'] + layer['amp'] * (prof - prof.min()) / (np.ptp(prof) + 1e-6)
        if 'shape' in layer:
            prof = layer['shape'](np.linspace(spec.az[0], spec.az[1], w), prof)
        ty = np.interp(np.tan(np.radians(prof)), [math.tan(math.radians(spec.el[0])), math.tan(math.radians(spec.el[1]))], [h - 1, 0])
        m = np.clip(yy - ty[None, :] + 0.5, 0, 1)
        c = np.asarray(layer['col'], np.float32)
        fringe = np.clip(1 - (yy - ty[None, :]) / 3.0, 0, 1) * (yy >= ty[None, :])
        cc2 = c[None, None, :] + (np.asarray(layer.get('rim', c), np.float32) - c)[None, None, :] * fringe[..., None]
        img = img * (1 - m[..., None]) + cc2 * m[..., None]
    return img


# ---------- Dunstbaenke und Lichtfinger / haze banks and light shafts ----------
def haze_bank(shot, a, b, z0, z1, color, alpha=0.5, name='bank'):
    """
    Dunstbank: senkrechte Flaeche von a nach b (xy), unten dicht, nach oben auslaufend. Zwischen zwei Haeuserreihen
    gestellt trennt sie die Tiefenschichten wie auf einem gemalten Hintergrund.
    Haze bank: a vertical plane from a to b (xy), dense below, fading upwards. Placed between two rows of houses it
    separates the depth layers as on a painted background.
    """
    m = W.sprite_mat('%s_%s' % (name, len(bpy.data.materials)), color=color, alpha=alpha, shape='vfade')
    me = bpy.data.meshes.new(name)
    me.from_pydata([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for i, t in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[i].uv = t
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    ob.visible_shadow = False
    return ob


def shafts(shot, items, color, alpha=0.25, name='shafts'):
    """
    Lichtfinger als additive Baender: items = [(oben, unten, Breite oben, Breite unten)], Punkte in Weltmetern; die
    Baender stehen quer zur Blickrichtung. / light shafts as additive ribbons: items = [(top, bottom, width top, width
    bottom)], points in world metres; the ribbons stand across the view direction.
    """
    m = W.sprite_mat('%s_%s' % (name, len(bpy.data.materials)), color=color, alpha=alpha, shape='hfade', add=True)
    verts, faces, uvs = [], [], []
    cam = Vector(shot.cam.location)
    for top, bot, w0, w1 in items:
        top, bot = Vector(top), Vector(bot)
        ax = (bot - top).normalized()
        side = ax.cross((top + bot) / 2 - cam).normalized()
        k = len(verts)
        verts += [tuple(top - side * w0 / 2), tuple(top + side * w0 / 2), tuple(bot + side * w1 / 2), tuple(bot - side * w1 / 2)]
        faces.append((k, k + 1, k + 2, k + 3))
        uvs += [(0, 0), (1, 0), (1, 1), (0, 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name='UVMap')
    uv.data.foreach_set('uv', np.asarray(uvs, np.float32).ravel())
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    ob.visible_shadow = False
    return ob


# ---------- Gezeichneter Rauch / drawn smoke ----------
class Smoke:
    """
    Rauchsaeule als gezeichnetes Volumen: viele runde Ballen, die sich ueberlappen (eine gemeinsame Silhouette mit
    Tuschelinie), unten schmal, nach oben breiter, mit dem Wind geneigt; zwei flache Toene aus der Sonnenrichtung. Die
    Ballen steigen langsam (life in Sekunden fuer den ganzen Weg), drehen sich nicht sichtbar und werden oben kleiner:
    die Form bleibt stehen, nur ihr Inneres wandert, wie bei gezeichnetem Rauch.
    Smoke column as a drawn volume: many round lumps that overlap (one shared silhouette with an ink line), narrow
    below, wider above, leaning with the wind; two flat tones from the sun direction. The lumps rise slowly (life in
    seconds for the whole way) and shrink at the top: the shape stays, only its inside travels, as in drawn smoke.
    """

    def __init__(self, shot, origin, color, height=120.0, n=26, life=30.0, r=(6.0, 26.0), wind=(60.0, 0.0), seed=1, px=1.6, curl=0.35,
                 unit=True, ink=True, mat=None, top_fade=0.2, spread=0.9, vary=(0.45, 1.3)):
        R = np.random.default_rng(seed)
        self.mat = mat or S.toon_mat(shot, color, unit=unit)
        self.items = []
        self.origin, self.h, self.life, self.r, self.wind, self.curl, self.top = Vector(origin), height, life, r, wind, curl, top_fade
        self.shot, self.px, self.spread = shot, px, spread
        for i in range(n):
            ob = L.prim(shot, 'ico', self.mat, loc=origin, size=1, sub=2, ink=False, smooth=True)
            if ink:
                ob.data.materials.append(L.ink_mat())
                mod = ob.modifiers.new('ink', 'SOLIDIFY')
                mod.use_flip_normals = True
                mod.use_rim = False
                mod.material_offset = 1
                mod.use_even_offset = False
            ob.rotation_euler = (R.uniform(0, 6.28), R.uniform(0, 6.28), R.uniform(0, 6.28))
            self.items.append((ob, i / n + R.uniform(-0.3, 0.3) / n, R.uniform(*vary), R.uniform(0, 6.28), R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(-1, 1)))

    def update(self, t):
        cam = self.shot.cam.location
        for ob, ph, sz, a, jx, jy, jz in self.items:
            p = (ph + t / self.life) % 1.0
            r0 = self.r[0] + (self.r[1] - self.r[0]) * p ** 0.75
            rr = r0 * sz
            k = min(1.0, p / 0.06) * (1 - L.seg(p, 1 - self.top, 1.0) ** 1.5)
            s = max(2.0 * rr * k, 0.001)
            z = self.h * p ** 0.85 + jz * r0 * self.spread * 0.6
            sway = math.sin(p * 9.0 + a) * self.curl * rr
            x = self.wind[0] * p ** 1.7 + jx * r0 * self.spread + sway
            y = self.wind[1] * p ** 1.7 + jy * r0 * self.spread
            ob.location = self.origin + Vector((x, y, z))
            ob.scale = (s, s, s * 0.92)
            mod = ob.modifiers.get('ink')
            if mod:
                d = (ob.location - cam).length
                mod.thickness = -self.shot.px(max(d, 1.0)) * self.px * L.HULL / s


def _puff(seed, dark, light, rim=None, n=11, soft=0.0, size=(512, 320), light_dir=(-0.5, -0.8), flat_base=True):
    w, h = size
    R = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sdf = np.full((h, w), -1e6, np.float32)
    base = h * (0.84 if flat_base else 0.6)
    for i in range(n):
        u = (i + 0.5) / n
        env = math.sin(math.pi * u) ** 0.7
        r = h * R.uniform(0.16, 0.3) * (0.5 + 0.6 * env)
        cx = w * (0.14 + 0.72 * u) + R.uniform(-0.03, 0.03) * w
        cy = base - r * R.uniform(0.5, 0.9) - env * h * R.uniform(0.05, 0.32) * (1.0 if flat_base else 0.4)
        np.maximum(sdf, r - np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2), out=sdf)
        rr = r * R.uniform(0.9, 1.3) * (1.0 if flat_base else 0.8)
        np.maximum(sdf, rr - np.sqrt((xx - cx) ** 2 + (yy - (base - rr * 0.55 * (1.0 if flat_base else -0.3))) ** 2), out=sdf)
    if flat_base:
        sdf = np.minimum(sdf, base - yy)
    sdf += (fbm_(h, w, 22, seed + 3, 3) - 0.5) * 9.0
    alpha = np.clip(sdf / 1.4 + 0.5, 0, 1)
    hf = A._blur((sdf > 0).astype(np.float32), h * 0.07, 3)
    gy, gx = np.gradient(hf)
    lit = (-gx * light_dir[0] - gy * light_dir[1]) * h * 0.07 > 0.05
    c = np.where(lit[..., None], np.asarray(light, np.float32), np.asarray(dark, np.float32))
    if rim is not None:
        edge = (sdf > 0) & (sdf < 4.0) & ((-gx * light_dir[0] - gy * light_dir[1]) > 0)
        c = np.where(edge[..., None], np.asarray(rim, np.float32), c)
    if soft > 0:
        alpha = A._blur(alpha, soft, 2)
        c = np.stack([A._blur(c[..., k], soft * 0.5, 1) for k in range(3)], 2)
    return np.concatenate([c, alpha[..., None]], 2)


fbm_ = A.fbm


def puff_image(name, seed, dark, light, rim=None, **kw):
    """
    Gemalte Staub- oder Rauchwolke als Karte: Haufen aus Kreisen (Blumenkohl-Rand), zwei flache Toene, optional ein
    heller Saum zur Lichtseite; soft zeichnet den Rand weich (Staub). RGBA, sRGB.
    Painted dust or smoke cloud as a card: a heap of circles (cauliflower edge), two flat tones, optionally a light
    fringe towards the light; soft blurs the edge (dust). RGBA, sRGB.
    """
    return W.image(name, _puff(seed, dark, light, rim, **kw))


def puff_atlas(name, seeds, dark, light, rim=None, **kw):
    """Mehrere Wolken nebeneinander; Rueckgabe (Bild, UV-Rechtecke) / several clouds side by side; returns (picture, uv rectangles)"""
    k = len(seeds)
    img = np.concatenate([_puff(sd, dark, light, rim, **kw) for sd in seeds], 1)
    return W.image(name, img), [(i / k + 0.004, 0.0, (i + 1) / k - 0.004, 1.0) for i in range(k)]


class Trail:
    """
    Rauchfahne aus gemalten Wolkenkarten: jede Karte wandert vom Ursprung mit dem Wind, steigt, waechst und verblasst;
    zusammen eine weiche, gezeichnete Fahne ohne Kugelkette. Fuer Schornsteine, Schlote, schwelende Wracks.
    Smoke trail of painted cloud cards: each card travels from the origin with the wind, rises, grows and fades;
    together a soft, drawn plume without a chain of balls. For funnels, chimneys, smouldering wrecks.
    """

    def __init__(self, shot, name, atlas, n=16, size=(2.0, 12.0), wind=(30.0, 0.0), rise=14.0, life=14.0, alpha=0.9, seed=1, jitter=0.25, tint=(1, 1, 1),
                 keep=0.0, fade=1.3, grow=0.7):
        img, uvs = atlas
        R = np.random.default_rng(seed)
        self.shot, self.n = shot, n
        self.origin = np.zeros(3)
        self.size, self.wind, self.rise, self.life, self.alpha, self.fade, self.grow = size, np.array([wind[0], wind[1], 0.0]), rise, life, alpha, fade, grow
        self.ph = (np.arange(n) + R.uniform(-0.3, 0.3, n)) / n
        self.var = R.uniform(0.75, 1.3, n)
        self.jit = R.uniform(-1, 1, (n, 3)) * jitter
        self.mat = W.sprite_mat(name, tex=img, attr_col=True, keep=keep)
        me = bpy.data.meshes.new(name)
        me.from_pydata([(0, 0, 0)] * (4 * n), [], [(4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3) for i in range(n)])
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        c = W.col(tint) if isinstance(tint, str) else tint
        self.col = np.tile(np.array([c[0], c[1], c[2], alpha], np.float32), (4 * n, 1))
        ca.data.foreach_set('color', self.col.ravel())
        uv = me.uv_layers.new(name='UVMap')
        uvl = []
        for i in range(n):
            u0, v0, u1, v1 = uvs[int(R.integers(0, len(uvs)))]
            if R.random() < 0.5:
                u0, u1 = u1, u0
            uvl += [u0, v0, u1, v0, u1, v1, u0, v1]
        uv.data.foreach_set('uv', np.asarray(uvl, np.float32))
        me.materials.append(self.mat)
        self.me = me
        self.ob = bpy.data.objects.new(name, me)
        shot.sc.collection.objects.link(self.ob)
        self.ob.visible_shadow = False
        self.aspect = img.size[1] / (img.size[0] / len(uvs))

    def update(self, t):
        n = self.n
        M = self.shot.cam.matrix_world
        right, up = np.array(M.col[0][:3]), np.array([0.0, 0.0, 1.0])
        p = (self.ph + t / self.life) % 1.0
        sz = (self.size[0] + (self.size[1] - self.size[0]) * p ** self.grow) * self.var
        pos = self.origin + np.outer(p ** 1.25, self.wind) + np.outer(p ** 0.8, [0, 0, self.rise]) + self.jit * sz[:, None]
        a = np.clip(p / 0.06, 0, 1) * (1 - p) ** self.fade * self.alpha
        rv, uv_ = np.outer(sz, right), np.outer(sz * self.aspect, up)
        v = np.empty((n, 4, 3))
        v[:, 0] = pos - rv - uv_
        v[:, 1] = pos + rv - uv_
        v[:, 2] = pos + rv + uv_
        v[:, 3] = pos - rv + uv_
        # aeltere (groessere) Karten zuerst zeichnen ist nicht noetig: gleiche Toene / drawing order does not matter: same tones
        self.me.vertices.foreach_set('co', v.ravel())
        self.col[:, 3] = np.repeat(a, 4)
        self.me.color_attributes['Col'].data.foreach_set('color', self.col.ravel())
        self.me.update()


class Burst:
    """
    Einmaliger Stoss aus gemalten Wolkenkarten (Staub beim Aufschlag): ab t0 fliegen die Karten vom Ursprung nach aussen,
    bremsen, wachsen und vergehen. / a one-off burst of painted cloud cards (dust at an impact): from t0 the cards fly
    outwards from the origin, slow down, grow and fade.
    """

    def __init__(self, shot, name, atlas, origin, t0, n=10, life=1.2, reach=3.0, size=(0.3, 1.6), alpha=0.9, seed=1, up=0.6, tint=(1, 1, 1), spread=(1.0, 1.0)):
        img, uvs = atlas
        R = np.random.default_rng(seed)
        self.shot, self.n, self.t0, self.life, self.reach, self.size, self.alpha = shot, n, t0, life, reach, size, alpha
        self.origin = np.array(origin, np.float64)
        a = R.uniform(0, 2 * math.pi, n)
        self.dir = np.stack([np.cos(a) * spread[0], np.sin(a) * spread[1], R.uniform(0.1, 1.0, n) * up], 1)
        self.var = R.uniform(0.6, 1.3, n)
        self.dl = R.uniform(0.0, 0.12, n)
        self.mat = W.sprite_mat(name, tex=img, attr_col=True)
        me = bpy.data.meshes.new(name)
        me.from_pydata([(0, 0, 0)] * (4 * n), [], [(4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3) for i in range(n)])
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        self.col = np.tile(np.array([tint[0], tint[1], tint[2], 0.0], np.float32), (4 * n, 1))
        ca.data.foreach_set('color', self.col.ravel())
        uv = me.uv_layers.new(name='UVMap')
        uvl = []
        for i in range(n):
            u0, v0, u1, v1 = uvs[i % len(uvs)]
            uvl += [u0, v0, u1, v0, u1, v1, u0, v1]
        uv.data.foreach_set('uv', np.asarray(uvl, np.float32))
        me.materials.append(self.mat)
        self.me = me
        self.ob = bpy.data.objects.new(name, me)
        shot.sc.collection.objects.link(self.ob)
        self.ob.visible_shadow = False
        self.aspect = img.size[1] / (img.size[0] / len(uvs))

    def update(self, t):
        n = self.n
        M = self.shot.cam.matrix_world
        right, upv = np.array(M.col[0][:3]), np.array(M.col[1][:3])
        p = np.clip((t - self.t0 - self.dl) / self.life, 0, 1)
        k = 1 - (1 - p) ** 3
        pos = self.origin + self.dir * (k * self.reach * self.var)[:, None]
        sz = (self.size[0] + (self.size[1] - self.size[0]) * k) * self.var * (p > 0)
        a = (1 - p) ** 1.4 * self.alpha * (p > 0)
        rv, uv_ = np.outer(sz, right), np.outer(sz * self.aspect, upv)
        v = np.empty((n, 4, 3))
        v[:, 0] = pos - rv - uv_
        v[:, 1] = pos + rv - uv_
        v[:, 2] = pos + rv + uv_
        v[:, 3] = pos - rv + uv_
        self.me.vertices.foreach_set('co', v.ravel())
        self.col[:, 3] = np.repeat(a, 4)
        self.me.color_attributes['Col'].data.foreach_set('color', self.col.ravel())
        self.me.update()


class Cards:
    """
    Karten zur Kamera gedreht in einem Netz (Staubwolken, Rauchbaenke, Menschen): items = [(Ort, Breite, Hoehe, Deckung,
    Toenung, UV-Rechteck)]. drift bewegt das ganze Netz (Meter je Sekunde).
    Cards turned towards the camera in one mesh (dust clouds, smoke banks, people): items = [(place, width, height,
    alpha, tint, uv rectangle)]. drift moves the whole mesh (metres per second).
    """

    def __init__(self, shot, name, tex, items, cam=None, drift=(0, 0, 0), add=False, keep=0.0, anchor='bottom'):
        mb = W.MeshB()
        cam = cam if cam is not None else tuple(shot.cam.location)
        self.mat = W.sprite_mat(name, tex=tex, attr_col=True, add=add, keep=keep)
        for it in items:
            p, w, h, a = it[0], it[1], it[2], it[3]
            tint = it[4] if len(it) > 4 and it[4] is not None else (1, 1, 1)
            uvr = it[5] if len(it) > 5 else None
            pp = (p[0], p[1], p[2] + (h / 2 if anchor == 'bottom' else 0))
            mb.card(pp, w, h, (cam[0], cam[1], pp[2]), tint, mat=0, alpha=a, uvr=uvr, up=(0, 0, 1))
        self.ob = mb.build(shot, name, [self.mat], weld=False, shadow=False)
        self.base = Vector(self.ob.location)
        self.drift = Vector(drift)

    def update(self, t):
        self.ob.location = self.base + self.drift * t


# ---------- Teilchen / particles ----------
class Particles:
    """
    Teilchen in einem Kasten, als Karten zur Kamera in einem Netz: mode 'flake' (Asche, Schnee: fallen und pendeln),
    'ember' (Glut: steigen, flackern, additiv), 'streak' (Regen: Striche entlang der Fallrichtung), 'puff' (Atem: weiche
    Scheiben, die steigen und vergehen). Der Kasten wandert nicht: Teilchen, die ihn verlassen, kommen gegenueber wieder
    herein. / particles in a box, as cards facing the camera in one mesh: mode 'flake' (ash, snow: fall and sway),
    'ember' (rise, flicker, additive), 'streak' (rain: strokes along the fall direction), 'puff' (breath: soft discs
    that rise and fade). Particles leaving the box re-enter on the opposite side.
    """

    def __init__(self, shot, name, n, box, vel, size, color, mode='flake', seed=1, alpha=1.0, sway=0.6, length=6.0, life=2.5, origins=None, keep=0.0):
        R = np.random.default_rng(seed)
        self.shot, self.n, self.mode = shot, n, mode
        self.lo, self.hi = np.array(box[0], np.float64), np.array(box[1], np.float64)
        self.p0 = self.lo + R.random((n, 3)) * (self.hi - self.lo)
        self.vel = np.array(vel, np.float64)
        self.spd = R.uniform(0.7, 1.3, n)
        self.size = R.uniform(size[0], size[1], n)
        self.ph = R.uniform(0, 6.28, n)
        self.sway, self.length, self.life, self.alpha = sway, length, life, alpha
        self.origins = None if origins is None else np.array(origins, np.float64)[R.integers(0, len(origins), n)]
        c = W.col(color)
        add = mode == 'ember'
        self.mat = W.sprite_mat(name, attr_col=True, add=add, shape='disc' if mode in ('puff', 'ember') else None, keep=keep)
        me = bpy.data.meshes.new(name)
        me.from_pydata([(0, 0, 0)] * (4 * n), [], [(4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3) for i in range(n)])
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        self.col = np.tile(np.array([c[0], c[1], c[2], alpha], np.float32), (4 * n, 1))
        ca.data.foreach_set('color', self.col.ravel())
        uv = me.uv_layers.new(name='UVMap')
        uv.data.foreach_set('uv', np.tile(np.array([0, 0, 1, 0, 1, 1, 0, 1], np.float32), n))
        me.materials.append(self.mat)
        self.me = me
        self.ob = bpy.data.objects.new(name, me)
        shot.sc.collection.objects.link(self.ob)
        self.ob.visible_shadow = False

    def update(self, t):
        n = self.n
        M = self.shot.cam.matrix_world
        right = np.array(M.col[0][:3])
        up = np.array(M.col[1][:3])
        size = self.size.copy()
        if self.mode == 'puff':
            age = ((t + self.ph) % self.life) / self.life
            p = self.origins + np.outer(age * self.life * self.spd, self.vel)
            p[:, 0] += np.sin(self.ph * 3 + t * 1.3) * self.sway * age
            size = self.size * (0.35 + 1.4 * age)
            a = np.sin(np.clip(age * 1.15, 0, 1) * math.pi) ** 1.5 * self.alpha
            self.col[:, 3] = np.repeat(a, 4)
            self.me.color_attributes['Col'].data.foreach_set('color', self.col.ravel())
        else:
            span = self.hi - self.lo
            p = self.p0 + np.outer(t * self.spd, self.vel)
            p[:, 0] += np.sin(self.ph + t * 1.1) * self.sway
            p[:, 1] += np.cos(self.ph * 1.7 + t * 0.9) * self.sway
            p = self.lo + np.mod(p - self.lo, span)
            if self.mode == 'ember':
                size = self.size * (0.6 + 0.4 * np.sin(t * 9.0 + self.ph * 5))
                # am oberen Rand des Kastens verglimmen / die out towards the top of the box
                size *= np.clip((self.hi[2] - p[:, 2]) / (span[2] * 0.35), 0, 1)
        if self.mode == 'streak':
            d = self.vel / (np.linalg.norm(self.vel) + 1e-9)
            upv = np.tile(d * self.length, (n, 1)) * self.spd[:, None]
            rv = np.cross(d, np.array(M.col[2][:3]))
            rv = rv / (np.linalg.norm(rv) + 1e-9)
            rightv = np.outer(size, rv)
        else:
            upv = np.outer(size, up)
            rightv = np.outer(size, right)
        v = np.empty((n, 4, 3))
        v[:, 0] = p - rightv - upv
        v[:, 1] = p + rightv - upv
        v[:, 2] = p + rightv + upv
        v[:, 3] = p - rightv + upv
        self.me.vertices.foreach_set('co', v.ravel())
        self.me.update()


class Birds:
    """
    Vogelschwarm als Silhouetten: jeder Vogel zwei Fluegel (vier Dreiecke), die schlagen und gleiten; die Voegel
    ziehen auf Kreisbahnen um centre oder geradeaus (vel). / flock of birds as silhouettes: each bird two wings that flap
    and glide; the birds circle around centre or fly straight (vel).
    """

    def __init__(self, shot, name, n, centre, radius, color, size=(1.2, 2.0), speed=9.0, seed=1, vel=None, spread_z=12.0, flat=0.35):
        R = np.random.default_rng(seed)
        self.n, self.centre, self.vel = n, np.array(centre, np.float64), None if vel is None else np.array(vel, np.float64)
        self.rad = R.uniform(0.35, 1.0, n) * radius
        self.a0 = R.uniform(0, 6.28, n)
        self.z = R.uniform(-1, 1, n) * spread_z
        self.size = R.uniform(size[0], size[1], n)
        self.ph = R.uniform(0, 6.28, n)
        self.rate = R.uniform(5.0, 8.0, n)
        self.dirn = R.choice([-1.0, 1.0], n) if vel is None else np.ones(n)
        self.speed, self.flat = speed, flat
        self.off = (R.random((n, 3)) - 0.5) * np.array([radius * 2, radius * 2, spread_z * 2])
        me = bpy.data.meshes.new(name)
        me.from_pydata([(0, 0, 0)] * (6 * n), [], [f for i in range(n) for f in ((6 * i, 6 * i + 4, 6 * i + 1), (6 * i + 4, 6 * i + 2, 6 * i + 1), (6 * i, 6 * i + 1, 6 * i + 5), (6 * i + 5, 6 * i + 1, 6 * i + 3))])
        me.materials.append(W.flat_mat(name, color))
        self.me = me
        self.ob = bpy.data.objects.new(name, me)
        shot.sc.collection.objects.link(self.ob)
        self.ob.visible_shadow = False

    def update(self, t):
        n = self.n
        if self.vel is None:
            a = self.a0 + self.dirn * t * self.speed / self.rad
            pos = self.centre + np.stack([np.cos(a) * self.rad, np.sin(a) * self.rad * self.flat, self.z + np.sin(t * 0.7 + self.ph) * 1.5], 1)
            head = np.stack([-np.sin(a) * self.dirn, np.cos(a) * self.dirn * self.flat, np.zeros(n)], 1)
        else:
            pos = self.centre + self.off + np.outer(np.full(n, t), self.vel)
            pos[:, 2] += np.sin(t * 0.9 + self.ph) * 1.2
            head = np.tile(self.vel, (n, 1))
        head /= (np.linalg.norm(head, axis=1, keepdims=True) + 1e-9)
        side = np.stack([-head[:, 1], head[:, 0], np.zeros(n)], 1)
        # Schlag mit Gleitpausen / flap with glide pauses
        fl = np.sin(t * self.rate + self.ph)
        glide = (np.sin(t * 0.8 + self.ph * 2.0) > 0.55)
        ang = np.where(glide, 0.18, fl * 0.75)
        s = self.size[:, None]
        v = np.empty((n, 6, 3))
        v[:, 0] = pos + head * s * 0.45
        v[:, 1] = pos - head * s * 0.35
        tipz = np.sin(ang)[:, None] * s * np.array([0, 0, 1.0])
        tipo = np.cos(ang)[:, None] * s
        v[:, 2] = pos + side * tipo + tipz - head * s * 0.15
        v[:, 3] = pos - side * tipo + tipz - head * s * 0.15
        v[:, 4] = pos + side * tipo * 0.5 + tipz * 0.6 + head * s * 0.2
        v[:, 5] = pos - side * tipo * 0.5 + tipz * 0.6 + head * s * 0.2
        self.me.vertices.foreach_set('co', v.ravel())
        self.me.update()


class Flag:
    """
    Fahne am Mast: Tuch als Gitter, das im Wind laeuft (Welle vom Mast zur freien Kante, deterministisch), Streifen
    oder Feld in zweiter Farbe. / flag on a pole: cloth as a grid running in the wind (wave from the pole to the free
    edge, deterministic), a stripe or field in a second colour.
    """

    def __init__(self, shot, loc, w, h, color, stripe=None, wind=(1.0, 0.0), seed=1, amp=1.0, nx=12, ny=4, unit=True, ink=None, droop=0.25, glow=0.0, ragged=0.0):
        self.loc, self.w, self.h, self.amp, self.nx, self.ny = Vector(loc), w, h, amp, nx, ny
        d = Vector((wind[0], wind[1], 0)).normalized()
        self.d, self.side = d, Vector((-d.y, d.x, 0))
        self.ph = (seed * 2.399) % 6.28
        self.droop = droop
        verts = [(0, 0, 0)] * ((nx + 1) * (ny + 1))
        faces = [(j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i) for j in range(ny) for i in range(nx)]
        me = bpy.data.meshes.new('flag')
        me.from_pydata(verts, [], faces)
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        c0 = W.col(color)
        cols = []
        for j in range(ny):
            for i in range(nx):
                c = c0
                if stripe is not None and stripe[1](i / nx, j / ny):
                    c = W.col(stripe[0])
                cols += [(c[0], c[1], c[2], 1.0)] * 4
        ca.data.foreach_set('color', np.asarray(cols, np.float32).ravel())
        # glow: durchscheinendes Tuch im Gegenlicht (Farbe ungeschattet) / translucent cloth against the light (colour unshaded)
        ax = me.attributes.new('aux', 'FLOAT_VECTOR', 'CORNER')
        ax.data.foreach_set('vector', np.tile(np.array([W.NEVER, 0.5, glow], np.float32), len(cols)))
        for p in me.polygons:
            p.use_smooth = True
        me.materials.append(W.arch_mat(shot, unit=unit, name='flagcloth_%d' % int(unit)))
        self.me = me
        self.ob = bpy.data.objects.new('flag', me)
        shot.sc.collection.objects.link(self.ob)
        self.ob.visible_shadow = False
        if ink:
            me.materials.append(L.ink_mat())
            mod = self.ob.modifiers.new('ink', 'SOLIDIFY')
            mod.thickness = -shot.px((self.loc - shot.cam.location).length) * ink * L.HULL
            mod.use_flip_normals = True
            mod.use_rim = False
            mod.material_offset = 1
        self.update(0.0)

    def update(self, t):
        nx, ny = self.nx, self.ny
        u = np.tile(np.linspace(0, 1, nx + 1), ny + 1)
        v = np.repeat(np.linspace(0, 1, ny + 1), nx + 1)
        wave = np.sin(u * 7.0 - t * 5.2 + self.ph + v * 0.8) * u * self.amp * self.w * 0.09 + np.sin(u * 3.1 - t * 2.3 + self.ph * 2) * u * self.amp * self.w * 0.06
        along = u * self.w * (1 - 0.04 * self.amp)
        z = -v * self.h - u * u * self.droop * self.h + np.sin(u * 5 - t * 4.1 + self.ph) * u * 0.05 * self.h
        co = np.stack([self.loc.x + self.d.x * along + self.side.x * wave, self.loc.y + self.d.y * along + self.side.y * wave, self.loc.z + z], 1)
        self.me.vertices.foreach_set('co', co.ravel())
        self.me.update()


# ---------- Menschen als Silhouetten / people as silhouettes ----------
def _capsule(X, Y, a, b, r):
    dx, dy = b[0] - a[0], b[1] - a[1]
    ln = dx * dx + dy * dy + 1e-9
    t = np.clip(((X - a[0]) * dx + (Y - a[1]) * dy) / ln, 0, 1)
    return r - np.sqrt((X - a[0] - t * dx) ** 2 + (Y - a[1] - t * dy) ** 2)


def _poly(X, Y, pts):
    """Konvexes Vieleck (gegen den Uhrzeigersinn), Abstand grob / convex polygon (counter-clockwise), rough distance"""
    d = np.full(X.shape, 1e6, np.float32)
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        ex, ey = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(ex, ey) + 1e-9
        d = np.minimum(d, ((X - a[0]) * -ey + (Y - a[1]) * ex) / ln)
    return d


FIGURES = ('gent', 'lady', 'carry', 'push', 'stand', 'woman', 'fist', 'child', 'soldier', 'run', 'bearer', 'hat', 'lean', 'old')


def _figure(kind, X, Y, R):
    """
    Eine Figur als Abstandsfeld; Einheit = Koerperhoehe, Fuesse bei y = 0, Mitte x = 0. Schlichte, gut lesbare Posen.
    One figure as a distance field; unit = body height, feet at y = 0, centre x = 0. Plain, readable poses.
    """
    j = lambda s=0.012: R.uniform(-s, s)  # noqa: E731
    d = np.full(X.shape, -1e6, np.float32)

    def add(x):
        np.maximum(d, x, out=d)
    lean = {'carry': 0.10, 'push': 0.16, 'run': 0.14, 'old': 0.07, 'lean': -0.04}.get(kind, 0.0) + j(0.01)
    s = 0.6 if kind == 'child' else 1.0
    hip = (0.0, 0.50 * s)
    sh = (hip[0] + lean * 0.9, 0.80 * s)
    head = (sh[0] + lean * 0.35, 0.92 * s)
    hr = 0.062 * (1.25 if kind == 'child' else 1.0)
    add(_capsule(X, Y, head, (head[0], head[1] + 0.005), hr))
    add(_capsule(X, Y, sh, head, 0.03))
    # Rumpf / torso
    tw = 0.105 if kind in ('gent', 'soldier', 'bearer', 'push', 'carry', 'fist', 'hat', 'run') else 0.09
    add(_capsule(X, Y, (hip[0], hip[1] + 0.03), (sh[0], sh[1] - 0.05), tw * s))
    add(_capsule(X, Y, (sh[0] - tw * 0.75 * s, sh[1] - 0.02), (sh[0] + tw * 0.75 * s, sh[1] - 0.02), 0.045 * s))
    # Beine oder Rock / legs or skirt
    if kind in ('lady', 'woman'):
        wd = 0.2 if kind == 'lady' else 0.13
        add(_poly(X, Y, [(-wd, 0.0), (wd, 0.0), (0.085, hip[1] + 0.06), (-0.085, hip[1] + 0.06)]))
        if kind == 'woman':
            add(_capsule(X, Y, (-0.04, 0.12), (-0.04, 0.0), 0.028))
            add(_capsule(X, Y, (0.04, 0.12), (0.04, 0.0), 0.028))
    elif kind == 'run':
        add(_capsule(X, Y, hip, (0.16, 0.27), 0.05))
        add(_capsule(X, Y, (0.16, 0.27), (0.10, 0.03), 0.04))
        add(_capsule(X, Y, hip, (-0.10, 0.30), 0.05))
        add(_capsule(X, Y, (-0.10, 0.30), (-0.26, 0.16), 0.04))
    else:
        st = {'push': 0.13, 'carry': 0.07, 'gent': 0.045, 'fist': 0.07, 'old': 0.04}.get(kind, 0.05) * s
        for sx in (-1, 1):
            knee = (hip[0] + sx * st * 0.7, 0.27 * s)
            foot = (sx * st * 1.5 - (0.05 if kind == 'push' and sx < 0 else 0), 0.02)
            add(_capsule(X, Y, (hip[0] + sx * 0.04 * s, hip[1]), knee, 0.052 * s))
            add(_capsule(X, Y, knee, foot, 0.042 * s))
            add(_capsule(X, Y, foot, (foot[0] + 0.05 * s, 0.012), 0.022 * s))
        if kind in ('gent', 'stand', 'old', 'hat', 'lean'):
            # Mantelschoss / coat skirt
            add(_poly(X, Y, [(-0.105 * s, 0.30 * s), (0.105 * s, 0.30 * s), (0.10 * s, hip[1] + 0.05), (-0.10 * s, hip[1] + 0.05)]))
    # Arme / arms
    def arm(sx, elbow, hand, r=0.033):
        a0 = (sh[0] + sx * tw * 0.95 * s, sh[1] - 0.03)
        add(_capsule(X, Y, a0, elbow, r * s))
        add(_capsule(X, Y, elbow, hand, r * 0.9 * s))
    if kind == 'carry':
        arm(1, (sh[0] + 0.16, sh[1] + 0.02), (sh[0] + 0.08, sh[1] + 0.13))
        arm(-1, (sh[0] - 0.13, sh[1] - 0.14), (sh[0] - 0.05, sh[1] + 0.10))
        add(_poly(X, Y, [(sh[0] - 0.13, sh[1] + 0.10), (sh[0] + 0.17, sh[1] + 0.14), (sh[0] + 0.15, sh[1] + 0.33), (sh[0] - 0.15, sh[1] + 0.29)]))
    elif kind == 'push':
        arm(1, (sh[0] + 0.14, sh[1] - 0.08), (sh[0] + 0.28, sh[1] - 0.10))
        arm(-1, (sh[0] + 0.10, sh[1] - 0.12), (sh[0] + 0.26, sh[1] - 0.16))
    elif kind == 'fist':
        arm(1, (sh[0] + 0.15, sh[1] + 0.08), (sh[0] + 0.12, sh[1] + 0.27))
        add(_capsule(X, Y, (sh[0] + 0.12, sh[1] + 0.28), (sh[0] + 0.12, sh[1] + 0.29), 0.038))
        arm(-1, (sh[0] - 0.14, sh[1] - 0.15), (sh[0] - 0.12, sh[1] - 0.30))
    elif kind == 'run':
        arm(1, (sh[0] + 0.12, sh[1] - 0.12), (sh[0] + 0.24, sh[1] - 0.04))
        arm(-1, (sh[0] - 0.14, sh[1] - 0.10), (sh[0] - 0.22, sh[1] - 0.22))
    elif kind == 'bearer':
        arm(1, (sh[0] + 0.13, sh[1] - 0.10), (sh[0] + 0.15, sh[1] + 0.06))
        arm(-1, (sh[0] - 0.13, sh[1] - 0.16), (sh[0] - 0.02, sh[1] - 0.22))
        add(_capsule(X, Y, (sh[0] + 0.15, 0.02), (sh[0] + 0.16, 1.9), 0.012))
    elif kind == 'soldier':
        arm(1, (sh[0] + 0.12, sh[1] - 0.15), (sh[0] + 0.02, sh[1] - 0.20))
        arm(-1, (sh[0] - 0.13, sh[1] - 0.14), (sh[0] - 0.04, sh[1] - 0.24))
        add(_capsule(X, Y, (sh[0] - 0.14, sh[1] - 0.32), (sh[0] + 0.20, sh[1] + 0.12), 0.013))
    elif kind == 'lady':
        arm(1, (sh[0] + 0.13, sh[1] - 0.15), (sh[0] + 0.05, sh[1] - 0.26), 0.026)
        arm(-1, (sh[0] - 0.13, sh[1] - 0.15), (sh[0] - 0.17, sh[1] - 0.02), 0.026)
        add(_capsule(X, Y, (sh[0] - 0.19, sh[1] + 0.0), (sh[0] - 0.19, sh[1] + 0.05), 0.022))
    elif kind == 'gent':
        arm(1, (sh[0] + 0.14, sh[1] - 0.15), (sh[0] + 0.19, sh[1] - 0.02))
        add(_capsule(X, Y, (sh[0] + 0.21, sh[1] + 0.0), (sh[0] + 0.21, sh[1] + 0.04), 0.022))
        arm(-1, (sh[0] - 0.13, sh[1] - 0.16), (sh[0] - 0.10, sh[1] - 0.31))
    elif kind == 'old':
        arm(1, (sh[0] + 0.12, sh[1] - 0.15), (sh[0] + 0.20, sh[1] - 0.26))
        add(_capsule(X, Y, (sh[0] + 0.20, sh[1] - 0.26), (sh[0] + 0.24, 0.0), 0.011))
        arm(-1, (sh[0] - 0.12, sh[1] - 0.16), (sh[0] - 0.10, sh[1] - 0.31))
    elif kind == 'lean':
        arm(1, (sh[0] + 0.14, sh[1] - 0.12), (sh[0] + 0.02, sh[1] - 0.17))
        arm(-1, (sh[0] - 0.14, sh[1] - 0.12), (sh[0] - 0.02, sh[1] - 0.19))
    else:
        arm(1, (sh[0] + 0.125 * s, sh[1] - 0.16 * s + j()), (sh[0] + 0.12 * s + j(0.02), sh[1] - 0.31 * s))
        arm(-1, (sh[0] - 0.125 * s, sh[1] - 0.16 * s + j()), (sh[0] - 0.12 * s + j(0.02), sh[1] - 0.31 * s))
    # Kopfbedeckung / headgear
    if kind == 'gent':
        add(_poly(X, Y, [(head[0] - 0.052, head[1] + 0.045), (head[0] + 0.052, head[1] + 0.045), (head[0] + 0.056, head[1] + 0.155), (head[0] - 0.056, head[1] + 0.155)]))
        add(_capsule(X, Y, (head[0] - 0.085, head[1] + 0.045), (head[0] + 0.085, head[1] + 0.045), 0.011))
    elif kind in ('hat', 'stand', 'push'):
        add(_capsule(X, Y, (head[0] - 0.08, head[1] + 0.04), (head[0] + 0.085, head[1] + 0.035), 0.012))
        add(_capsule(X, Y, (head[0] - 0.035, head[1] + 0.06), (head[0] + 0.035, head[1] + 0.06), 0.03))
    elif kind == 'lady':
        add(_capsule(X, Y, (head[0] - 0.02, head[1] + 0.06), (head[0] - 0.03, head[1] + 0.075), 0.04))
    elif kind in ('woman', 'old'):
        # Kopftuch: weiche Haube bis auf die Schultern / headscarf: a soft hood down to the shoulders
        add(_capsule(X, Y, (head[0], head[1] - 0.075), (head[0], head[1] + 0.012), 0.076))
        add(_capsule(X, Y, (sh[0] - 0.06, sh[1] + 0.005), (sh[0] + 0.06, sh[1] + 0.005), 0.05))
    elif kind in ('soldier', 'run', 'bearer'):
        add(_capsule(X, Y, (head[0] - 0.07, head[1] + 0.02), (head[0] + 0.07, head[1] + 0.02), 0.018))
        add(_capsule(X, Y, (head[0] - 0.03, head[1] + 0.045), (head[0] + 0.03, head[1] + 0.045), 0.035))
        if kind != 'bearer':
            add(_poly(X, Y, [(sh[0] - 0.17, sh[1] - 0.27), (sh[0] - 0.07, sh[1] - 0.27), (sh[0] - 0.07, sh[1] - 0.02), (sh[0] - 0.17, sh[1] - 0.05)]))
    elif kind == 'carry':
        add(_capsule(X, Y, (head[0] - 0.06, head[1] + 0.045), (head[0] + 0.08, head[1] + 0.04), 0.014))
    return d


def people_atlas(name, kinds, dark, rim=None, light=(-1.0, 0.4), seed=1, cell=(160, 288), flip=None, back=False, rim_px=2.5):
    """
    Bogen mit Figuren-Silhouetten (eine je Feld): flache dunkle Farbe, optional ein Lichtsaum zur Lichtseite (Gegenlicht).
    Rueckgabe: (Bild, [UV-Rechteck je Figur], Seitenverhaeltnis Breite / Hoehe eines Feldes). Ein Feld ist 1,1 Koerper-
    hoehen breit und 2 hoch (Platz fuer Fahne, Kiste, erhobene Faust).
    Sheet of figure silhouettes (one per cell): a flat dark colour, optionally a light fringe towards the light (back
    light). Returns (picture, [uv rectangle per figure], aspect width / height of a cell). A cell is 1.1 body heights
    wide and 2 high (room for a flag, a crate, a raised fist).
    """
    cw, ch = cell
    n = len(kinds)
    img = np.zeros((ch, cw * n, 4), np.float32)
    R = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:ch, 0:cw].astype(np.float32)
    X = ((xx + 0.5) / cw - 0.5) * 1.1
    Y = (1 - (yy + 0.5) / ch) * 2.0 - 0.02
    px = 2.0 / ch
    dk = np.asarray(dark, np.float32)
    for i, kind in enumerate(kinds):
        Xi = -X if (flip and flip[i]) else X
        d = _figure(kind, Xi, Y, R)
        a = np.clip(d / px / 1.2 + 0.5, 0, 1)
        c = np.tile(dk, (ch, cw, 1))
        if rim is not None:
            k = rim_px * ch / 288.0
            if back:
                # Gegenlicht: Saum an beiden Seiten und oben, nicht an den Sohlen / back light: fringe on both sides and on top, not at the soles
                edge = (d > 0) & ((np.roll(d, int(round(k)), 1) < 0) | (np.roll(d, -int(round(k)), 1) < 0) | (np.roll(d, int(round(k)), 0) < 0)) & (Y > 0.06)
            else:
                sx, sy = int(round(light[0] * k)), int(round(-light[1] * k))
                sh = np.roll(np.roll(d, -sx, 1), -sy, 0)
                edge = (d > 0) & (sh < 0)
            c = np.where(edge[..., None], np.asarray(rim, np.float32), c)
        img[:, i * cw:(i + 1) * cw, :3] = c
        img[:, i * cw:(i + 1) * cw, 3] = a
    uvs = [(i / n + 0.002, 0.0, (i + 1) / n - 0.002, 1.0) for i in range(n)]
    return W.image(name, img), uvs, 1.1 / 2.0


def people(shot, name, atlas, places, height=1.75, tint=None, cam=None, seed=1):
    """
    Figuren aufstellen: places = [(x, y, z, Nummer im Bogen[, Groesse])]. Karten stehen senkrecht und drehen sich zur
    Kamera. / place figures: places = [(x, y, z, index in the sheet[, size])]. Cards stand upright and face the camera.
    """
    img, uvs, asp = atlas
    items = []
    for pl in places:
        k = pl[4] if len(pl) > 4 else 1.0
        hh = height * 2.0 * k
        items.append(((pl[0], pl[1], pl[2] - 0.02 * height * k), hh * asp, hh, 1.0, tint, uvs[pl[3] % len(uvs)]))
    return Cards(shot, name, img, items, cam=cam)
