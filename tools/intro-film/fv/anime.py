"""
Bausteine des Anime-Schnitts (nur neue Einstellungen unter fv/shots/anime, die bisherigen bleiben unberuehrt):
gemalter Himmel als Rundhorizont, gemaltes Gelaende mit Relief, Luftperspektive (Dunst nach Entfernung) fuer alle
Materialien, Randlicht auf den gezeichneten Figuren, die ganze Figur eines Anfuehrers mit wehendem Umhang, Felsen.
Building blocks of the anime cut (only new shots under fv/shots/anime, the previous ones stay untouched): a painted
sky as a cyclorama, painted terrain with relief, aerial perspective (haze by distance) for all materials, rim light on
the inked figures, a leader's full figure with a cape in the wind, rocks.

Gemalt wird mit numpy in sRGB, deterministisch (feste Zufallszahlen), Farben nur aus den Design-Tokens (gemischt).
Die Bilder liegen als PNG im Cache der Stufe (paint/), damit Bild fuer Bild nicht neu gemalt wird.
Painting uses numpy in sRGB, deterministic (fixed random numbers), colours only from the design tokens (mixed).
The pictures are stored as PNG in the level's cache (paint/) so they are not repainted for every frame.
"""
import math
import os
import zlib
import struct

import bpy
import numpy as np
from mathutils import Vector

from . import lib as L

PAINT = os.path.join(L.CACHE, 'paint')
# Version der Malerei: erhoehen, wenn sich ein Maler aendert (alte Bilder werden dann neu gemalt)
# version of the painting: raise when a painter changes (old pictures are then repainted)
PAINT_VERSION = 10


# ---------- Farben / colours ----------
def hexc(name):
    """Token -> sRGB 0..1 (numpy) / token -> sRGB 0..1 (numpy)"""
    t = L.tokens()
    v = name if name.startswith('#') else (t['intro'].get(name) or t['semantic'].get(name) or t['color'][name])
    v = v.lstrip('#')
    return np.array([int(v[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def cmix(a, b, t):
    a = hexc(a) if isinstance(a, str) else np.asarray(a, np.float32)
    b = hexc(b) if isinstance(b, str) else np.asarray(b, np.float32)
    return a + (b - a) * t


def lin(c):
    """sRGB (numpy) -> lineares RGBA fuer Blender / sRGB (numpy) -> linear RGBA for Blender"""
    c = np.asarray(c, np.float64)
    out = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return (float(out[0]), float(out[1]), float(out[2]), 1.0)


# ---------- Bilder / pictures ----------
def _png(path, img):
    """RGB float 0..1 (oben zuerst) als 8-Bit-PNG / RGB float 0..1 (top row first) as 8-bit PNG"""
    h, w, _ = img.shape
    data = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
    raw = b''.join(b'\x00' + data[y].tobytes() for y in range(h))

    def chunk(t, body):
        return struct.pack('>I', len(body)) + t + body + struct.pack('>I', zlib.crc32(t + body) & 0xffffffff)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def painted(name, painter, *args):
    """Gemaltes Bild aus dem Cache oder neu malen / painted picture from the cache or paint anew"""
    path = os.path.join(PAINT, '%s_v%d.png' % (name, PAINT_VERSION))
    if not os.path.exists(path):
        _png(path, painter(*args))
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = 'sRGB'
    return img


def _noise2(h, w, cell, seed):
    """Weiches Wertrauschen 0..1 / smooth value noise 0..1"""
    R = np.random.default_rng(seed)
    gh, gw = int(h / cell) + 3, int(w / cell) + 3
    g = R.random((gh, gw)).astype(np.float32)
    y = np.arange(h, dtype=np.float32) / cell
    x = np.arange(w, dtype=np.float32) / cell
    yi, xi = y.astype(int), x.astype(int)
    fy, fx = y - yi, x - xi
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a = g[yi][:, xi]
    b = g[yi][:, xi + 1]
    c = g[yi + 1][:, xi]
    d = g[yi + 1][:, xi + 1]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def fbm(h, w, cell, seed, octaves=4):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * _noise2(h, w, max(2.0, cell / 2 ** o), seed + o * 17)
        tot += amp
        amp *= 0.5
    return out / tot


def _smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------- Himmel / sky ----------
class SkySpec:
    """
    Gemalter Himmel: Bildbereich in Azimut (Grad, von +y nach +x) und Hoehenwinkel (Grad), Sonne, Wolkenbaenke,
    Rauchsaeule. Farben sind Tokennamen oder Mischungen (sRGB).
    Painted sky: picture range in azimuth (degrees, from +y towards +x) and elevation (degrees), sun, cloud banks,
    smoke column. Colours are token names or mixes (sRGB).
    """

    def __init__(self, **kw):
        self.w, self.h = kw.get('w', 4096), kw.get('h', 1792)
        self.az = kw.get('az', (-40.0, 75.0))
        self.el = kw.get('el', (-6.0, 46.0))
        self.sun = kw.get('sun', (58.0, 4.5))
        self.grad = kw['grad']
        self.glow = kw.get('glow')
        self.clouds = kw.get('clouds', [])
        self.cloud_cols = kw['cloud_cols']
        self.land = kw.get('land', [])
        self.smoke = kw.get('smoke')
        self.rays = kw.get('rays', 0.0)
        self.seed = kw.get('seed', 1)


def _sky_xy(spec):
    """Azimut und Hoehenwinkel je Bildpunkt (Zylinder: Zeile linear in tan(Hoehe)) / azimuth and elevation per pixel"""
    w, h = spec.w, spec.h
    az = np.linspace(spec.az[0], spec.az[1], w, dtype=np.float32)
    t0, t1 = math.tan(math.radians(spec.el[1])), math.tan(math.radians(spec.el[0]))
    el = np.degrees(np.arctan(np.linspace(t0, t1, h, dtype=np.float32)))
    return az, el


def _blur(a, r, passes=3):
    """Weichzeichnen (mehrfacher Kastenfilter, getrennt) / blur (repeated box filter, separable)"""
    r = max(1, int(r))
    out = a.astype(np.float32)
    for _ in range(passes):
        for ax in (0, 1):
            c = np.cumsum(np.pad(out, [(r + 1, r) if k == ax else (0, 0) for k in range(2)], mode='edge'), axis=ax)
            if ax == 0:
                out = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
            else:
                out = (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)
    return out


def _el_row(spec, e):
    """Bildzeile eines Hoehenwinkels / picture row of an elevation"""
    return float(np.interp(math.tan(math.radians(e)), [math.tan(math.radians(spec.el[0])), math.tan(math.radians(spec.el[1]))], [spec.h - 1, 0]))


def _paint_clouds(img, spec, E, A):
    """
    Wolkenbaenke wie gemalte Anime-Kumuli: flache Unterkante, Blumenkohl-Oberkante aus Kreisen entlang einer Huellkurve,
    Inneres aus grossen Kreisen. Schattierung aus einem weichgezeichneten Hoehenfeld (die Form, nicht die einzelnen
    Kreise), drei harte Toene (Schatten, Mitte, Licht) mit weichem Verlauf im Schatten, schmaler heller Saum an den zur
    Sonne gewandten Raendern. Die Sonne steht tief hinter den Wolken.
    Cloud banks like painted anime cumuli: flat base, cauliflower top from circles along an envelope, interior from big
    circles. Shading from a blurred height field (the shape, not the single circles), three hard tones (shadow, mid,
    light) with a soft gradient in the shadow, a narrow bright fringe at the edges facing the sun. The sun stands low
    behind the clouds.
    """
    w, h = spec.w, spec.h
    px_az = (spec.az[1] - spec.az[0]) / w
    sa, se = spec.sun
    sun_x, sun_y = (sa - spec.az[0]) / px_az, _el_row(spec, se)
    shadow_c, mid_c, lit_c, rim_c = [np.asarray(c, np.float32) for c in spec.cloud_cols]
    R = np.random.default_rng(spec.seed)
    # hintere Baenke zuerst / far banks first
    for bank in sorted(spec.clouds, key=lambda b: b.get('tone', 0)):
        ca, ce, bw, bh, size = bank['at'][0], bank['at'][1], bank['w'], bank['h'], bank['size']
        tone = bank.get('tone', 0.0)
        sdf = np.full((h, w), -1e6, np.float32)

        def blob(a, e, r):
            cx, cy, rp = (a - spec.az[0]) / px_az, _el_row(spec, e), r / px_az
            x0, x1 = int(max(0, cx - rp - 2)), int(min(w, cx + rp + 2))
            y0, y1 = int(max(0, cy - rp - 2)), int(min(h, cy + rp + 2))
            if x0 >= x1 or y0 >= y1:
                return
            yy_, xx_ = np.mgrid[y0:y1, x0:x1].astype(np.float32)
            sub = sdf[y0:y1, x0:x1]
            np.maximum(sub, rp - np.sqrt((xx_ - cx) ** 2 + (yy_ - cy) ** 2), out=sub)
        # Huellkurve der Oberkante: Haufen mit Nebenkuppen / envelope of the top: a heap with secondary domes
        ph = R.uniform(0, 6.28, 3)
        steps = max(8, int(bw / (size * 0.45)))
        for i in range(steps + 1):
            u = -1 + 2 * i / steps
            env = (1 - abs(u) ** bank.get('peak', 1.6)) * (0.75 + 0.25 * math.sin(u * 5 + ph[0]) * math.cos(u * 3 + ph[1]))
            top = ce + bh * max(0.08, env)
            a = ca + u * bw / 2 + R.uniform(-0.3, 0.3) * size
            r = size * R.uniform(0.6, 1.2) * (0.55 + 0.45 * max(0.1, env))
            blob(a, top - r * 0.55, r)
            # Fuellung darunter / filling below
            e = top - r
            while e > ce - size * 0.3:
                rr = size * R.uniform(1.0, 1.6)
                blob(a + R.uniform(-0.4, 0.4) * size, e - rr * 0.3, rr)
                e -= rr * 0.9
        # flache Unterkante / flat base
        base = _el_row(spec, ce)
        if bank.get('flat', True):
            yy = np.arange(h, dtype=np.float32)[:, None]
            sdf = np.minimum(sdf, (base - yy) * 1.0 + bank.get('soft', 0.0))
        # ausgefranste Raender / frayed edges
        sdf += (fbm(h, w, 26, spec.seed + int(ca * 7) % 97, 3) - 0.5) * 7.0
        alpha = np.clip(sdf / 1.4 + 0.5, 0, 1)
        if alpha.max() <= 0:
            continue
        # Hoehenfeld: weichgezeichnete Form, daraus die Normale / height field: the blurred shape, the normal from it
        rb = int(size / px_az * 0.55)
        hf = _blur((sdf > 0).astype(np.float32), rb, 3)
        gy, gx = np.gradient(hf)
        gx, gy = -gx * rb * 1.4, -gy * rb * 1.4
        nz = np.sqrt(np.clip(1 - gx * gx - gy * gy, 0.0, 1))
        nn = np.sqrt(gx * gx + gy * gy + nz * nz) + 1e-6
        nx, ny, nz = gx / nn, gy / nn, nz / nn
        XX = np.arange(w, dtype=np.float32)[None, :]
        YY = np.arange(h, dtype=np.float32)[:, None]
        lx, ly = sun_x - XX, sun_y - YY
        ln = np.sqrt(lx * lx + ly * ly) + 1e-3
        lz = 0.05
        lnorm = np.sqrt(1 + lz * lz)
        lit = (nx * lx / ln + ny * ly / ln + nz * lz) / lnorm
        near = np.exp(-(ln / (w * 0.3)) ** 2)
        k_lit = lit > (0.2 - 0.15 * near)
        k_mid = lit > (-0.28 + 0.1 * (1 - near))
        cc = np.where(k_lit[..., None], lit_c, np.where(k_mid[..., None], mid_c, shadow_c))
        # im Schatten: unten dunkler, oben ein Hauch Himmel / in the shadow: darker below, a touch of sky above
        vert = np.clip((YY - base) / (rb * 3 + 1) + 1, 0, 1)
        cc = cc * (1 - 0.1 * vert[..., None] * (~k_lit)[..., None])
        # Saum an zur Sonne gewandten Raendern / fringe at edges facing the sun
        rim = (sdf > 0) & (sdf < 3.5 + 9 * near) & ((gx * lx + gy * ly) / ln > 0.02)
        cc = np.where(rim[..., None], rim_c, cc)
        # ferne Baenke naeher am Himmel / far banks closer to the sky
        if tone < 0:
            cc = cc + (img - cc) * (-tone) * 0.6
        img = img * (1 - alpha[..., None]) + cc * alpha[..., None]
        if tone >= 0.9:
            edge = np.clip(1 - np.abs(sdf - 0.6) / 1.0, 0, 1)
            img = img * (1 - 0.35 * edge[..., None]) + hexc('ink700')[None, None, :] * 0.35 * edge[..., None]
    return img


def paint_sky(spec):
    w, h = spec.w, spec.h
    az, el = _sky_xy(spec)
    E = np.repeat(el[:, None], w, 1)
    A = np.repeat(az[None, :], h, 0)
    img = np.zeros((h, w, 3), np.float32)
    # Verlauf nach Hoehe / gradient by elevation
    stops = [(e, hexc(c) if isinstance(c, str) else np.asarray(c, np.float32)) for e, c in spec.grad]
    for k in range(3):
        img[..., k] = np.interp(E, [s[0] for s in stops], [s[1][k] for s in stops])
    # Leuchten um die Sonne (weit und eng) / glow around the sun (wide and tight)
    sa, se = spec.sun
    d = np.sqrt(((A - sa) * math.cos(math.radians(se))) ** 2 + (E - se) ** 2)
    if spec.glow:
        wide, tight = spec.glow
        img += (wide[None, None, :] - img) * (np.exp(-(d / 28.0) ** 2) * 0.55)[..., None]
        img += (tight[None, None, :] - img) * (np.exp(-(d / 7.0) ** 2) * 0.85)[..., None]
        # Sonnenscheibe mit harter Kante / sun disc with a hard edge
        disc = _smooth(1.35, 1.1, d)
        img += (hexc('flash100')[None, None, :] - img) * disc[..., None]
    # Pinselspuren: waagerechte Streifen, leichte Helligkeitsschwankung / brush marks: horizontal streaks, slight brightness variation
    streak = fbm(h, w // 8, 18, spec.seed + 5, 3)
    streak = np.repeat(streak, 8, 1)[:, :w]
    img *= (0.975 + 0.05 * streak)[..., None]

    # Strahlen von der Sonne (Lichtfinger) / rays from the sun (crepuscular rays)
    if spec.rays:
        ang = np.arctan2(E - se, (A - sa) * math.cos(math.radians(se)))
        R = np.random.default_rng(spec.seed + 9)
        # wenige schmale Finger (Keile im Winkel), weich auslaufend / a few narrow fingers (wedges in angle), fading softly
        ray = np.zeros_like(ang)
        for i in range(9):
            a0 = R.uniform(0.25, math.pi - 0.25)
            wd = R.uniform(0.012, 0.035)
            ray += np.exp(-((ang - a0) / wd) ** 2) * R.uniform(0.4, 1.0)
        ray = np.clip(ray, 0, 1) * np.exp(-d / 40.0) * _smooth(0.5, 4.0, d) * (E > se - 1) * spec.rays
        img += (hexc('flash100')[None, None, :] - img) * ray[..., None]

    px_az = (spec.az[1] - spec.az[0]) / w
    yy = np.arange(h, dtype=np.float32)[:, None]
    # Rauchsaeule am Horizont (Absturzstelle) / smoke column on the horizon (crash site)
    if spec.smoke:
        sm = spec.smoke
        R2 = np.random.default_rng(spec.seed + 21)
        col_s = sm['col']
        for i in range(160):
            k = i / 159.0
            e = sm['base'][1] + k * sm['height']
            axis = sm['base'][0] + sm['lean'] * k ** 1.6
            a = axis + R2.uniform(-0.35, 0.35) * k * (1 + 2 * k)
            r = (sm['r0'] + (sm['r1'] - sm['r0']) * k ** 0.8) * R2.uniform(0.85, 1.15)
            r_axis = sm['r0'] + (sm['r1'] - sm['r0']) * k ** 0.8
            cxa = (axis - spec.az[0]) / px_az
            cx = (a - spec.az[0]) / px_az
            cy = np.interp(math.tan(math.radians(e)), [math.tan(math.radians(spec.el[0])), math.tan(math.radians(spec.el[1]))], [h - 1, 0])
            rp = r / px_az
            x0, x1 = int(max(0, cx - rp - 2)), int(min(w, cx + rp + 2))
            y0, y1 = int(max(0, cy - rp - 2)), int(min(h, cy + rp + 2))
            if x0 >= x1 or y0 >= y1:
                continue
            yy2, xx2 = np.mgrid[y0:y1, x0:x1].astype(np.float32)
            dist = np.sqrt((xx2 - cx) ** 2 + (yy2 - cy) ** 2)
            al = np.clip((rp - dist) / 1.6 + 0.5, 0, 1) * 0.95 * (1 - k ** 1.4)
            # Licht von rechts unten auf der Saeule / light from the lower right on the column
            # Lichtseite nach der Achse der Saeule (nicht je Kreis), sonst wird die Grenze treppig
            # lit side by the column's axis (not per circle), otherwise the border gets stair-stepped
            litk = (xx2 - cxa) / (r_axis / px_az) + 0.15 * np.sin((yy2 - cy) * 0.05 + i)
            c = col_s[0] + (col_s[1] - col_s[0]) * (litk > 0.25)[..., None]
            img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - al[..., None]) + c * al[..., None]
        # Glut am Fuss / glow at the foot
        ga, ge = sm['base']
        dg = np.sqrt(((A - ga) * 1.0) ** 2 + ((E - ge) * 2.2) ** 2)
        img += (sm['glow'][None, None, :] - img) * (np.exp(-(dg / 1.6) ** 2) * 0.7)[..., None]

    # Wolkenbaenke (ueber der Rauchsaeule, die in die Wolkendecke steigt) / cloud banks (over the smoke column, which rises into the cloud deck)
    img = _paint_clouds(img, spec, E, A)

    # Ferne Landschaft in Schichten (unten): Silhouetten mit Luftperspektive / far land in layers (bottom): silhouettes with aerial perspective
    for layer in spec.land:
        R3 = np.random.default_rng(layer['seed'])
        prof = np.zeros(w, np.float32)
        x = np.arange(w, dtype=np.float32)
        for k in range(6):
            f = R3.uniform(0.5, 1.5) * (k + 1) * 2 * math.pi / w * layer['waves']
            prof += np.sin(x * f + R3.uniform(0, 6.28)) / (k + 1)
        prof = layer['el'] + layer['amp'] * (prof - prof.min()) / (np.ptp(prof) + 1e-6)
        ty = np.interp(np.tan(np.radians(prof)), [math.tan(math.radians(spec.el[0])), math.tan(math.radians(spec.el[1]))], [h - 1, 0])
        m = np.clip(yy - ty[None, :] + 0.5, 0, 1)
        c = np.asarray(layer['col'], np.float32)
        # oben am Kamm heller (Gegenlicht-Saum) / lighter at the crest (backlight fringe)
        fringe = np.clip(1 - (yy - ty[None, :]) / 3.0, 0, 1) * (yy >= ty[None, :])
        cc2 = c[None, None, :] + (np.asarray(layer.get('rim', c), np.float32) - c)[None, None, :] * fringe[..., None]
        img = img * (1 - m[..., None]) + cc2 * m[..., None]
    return np.clip(img, 0, 1)


def cyclorama(shot, spec, centre, radius=3000.0, name='sky_korvat', drift=None):
    """
    Rundhorizont: Zylinderstueck um centre mit dem gemalten Himmel, unbeleuchtet, ohne Schatten. drift = Grad je Sekunde
    (Wolken ziehen: die Textur wandert, Sonne und Land bleiben im Bild fest, deshalb nur kleine Werte).
    Cyclorama: a cylinder segment around centre with the painted sky, unlit, no shadows. drift = degrees per second.
    """
    img = painted(name, paint_sky, spec)
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
    tc = n.new('ShaderNodeUVMap')
    mp = n.new('ShaderNodeMapping')
    mp.name = 'map'
    Ln.new(tc.outputs['UV'], mp.inputs['Vector'])
    tx = n.new('ShaderNodeTexImage')
    tx.image = img
    tx.interpolation = 'Cubic'
    tx.extension = 'EXTEND'
    Ln.new(mp.outputs['Vector'], tx.inputs['Vector'])
    em = n.new('ShaderNodeEmission')
    Ln.new(tx.outputs['Color'], em.inputs[0])
    L._no_shadow(m, em.outputs[0], out)
    m['fv_nohaze'] = 1
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector((centre[0], centre[1], centre[2]))
    ob.visible_shadow = False
    return ob


# ---------- Gelaende / terrain ----------
def terrain(shot, height, size, sub, tex, area, name='terrain', loc=(0, 0, 0)):
    """
    Gelaende mit Relief und gemalter Textur (Draufsicht ueber area = (x0, y0, x1, y1)), Comic-Lichtbaender mit
    Schattenwurf aus der Gruppe des Films. Die Textur liefert die Grundfarbe im Licht.
    Terrain with relief and a painted texture (top view over area), the film's comic light bands with cast shadows.
    The texture gives the base colour in the light.
    """
    if isinstance(size, (int, float)):
        size = (size, size)
    nx_, ny_ = (sub, sub) if isinstance(sub, int) else sub
    xs = np.linspace(-size[0] / 2, size[0] / 2, nx_ + 1) + loc[0]
    ys = np.linspace(-size[1] / 2, size[1] / 2, ny_ + 1) + loc[1]
    verts = []
    for y in ys:
        for x in xs:
            verts.append((x, y, height(x, y)))
    faces = []
    for j in range(ny_):
        for i in range(nx_):
            a = j * (nx_ + 1) + i
            faces.append((a, a + 1, a + nx_ + 2, a + nx_ + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    m = bpy.data.materials.new(name)
    nt, n, Ln = L._nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    tc = n.new('ShaderNodeTexCoord')
    mp = n.new('ShaderNodeMapping')
    x0, y0, x1, y1 = area
    mp.inputs['Location'].default_value = (-x0 / (x1 - x0), -y0 / (y1 - y0), 0)
    mp.inputs['Scale'].default_value = (1 / (x1 - x0), 1 / (y1 - y0), 1)
    Ln.new(tc.outputs['Object'], mp.inputs['Vector'])
    tx = n.new('ShaderNodeTexImage')
    tx.image = tex
    tx.interpolation = 'Linear'
    tx.extension = 'EXTEND'
    Ln.new(mp.outputs['Vector'], tx.inputs['Vector'])
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g
    Ln.new(tx.outputs['Color'], tg.inputs['Base'])
    em = n.new('ShaderNodeEmission')
    Ln.new(tg.outputs[0], em.inputs[0])
    Ln.new(em.outputs[0], out.inputs[0])
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    return ob


# ---------- Luftperspektive / aerial perspective ----------
def haze_all(shot, color, start=40.0, dist=900.0, amount=0.85, ink_amount=0.95):
    """
    Dunst nach Entfernung in jedes Material der Szene einfuegen (vor die Emission): fern wird alles heller und naeher
    an der Dunstfarbe, Tuschelinien eingeschlossen, wie die Luftperspektive gemalter Hintergruende. Materialien mit
    fv_nohaze (Himmel) bleiben.
    Insert haze by distance into every material of the scene (before the emission): far things become lighter and
    closer to the haze colour, ink lines included, like the aerial perspective of painted backgrounds. Materials
    flagged fv_nohaze (sky) stay as they are.
    """
    hz = lin(color) if not isinstance(color, tuple) else color
    for m in bpy.data.materials:
        if not m.use_nodes or m.get('fv_nohaze') or m.get('fv_hazed'):
            continue
        nt = m.node_tree
        ems = [x for x in nt.nodes if x.type == 'EMISSION']
        for em in ems:
            sock = em.inputs[0]
            cd = nt.nodes.new('ShaderNodeCameraData')
            mr = nt.nodes.new('ShaderNodeMapRange')
            mr.clamp = True
            nt.links.new(cd.outputs['View Distance'], mr.inputs['Value'])
            mr.inputs['From Min'].default_value = start
            mr.inputs['From Max'].default_value = start + dist * 3
            mr.inputs['To Min'].default_value = 0
            mr.inputs['To Max'].default_value = 1
            # 1 - exp(-3 x): weich ansteigend / soft rise
            ex = nt.nodes.new('ShaderNodeMath')
            ex.operation = 'MULTIPLY'
            ex.inputs[1].default_value = -3.0
            nt.links.new(mr.outputs[0], ex.inputs[0])
            e2 = nt.nodes.new('ShaderNodeMath')
            e2.operation = 'EXPONENT'
            nt.links.new(ex.outputs[0], e2.inputs[0])
            f = nt.nodes.new('ShaderNodeMath')
            f.operation = 'MULTIPLY_ADD'
            f.inputs[1].default_value = -(ink_amount if m.name in ('ink', 'ink_line') else amount)
            f.inputs[2].default_value = ink_amount if m.name in ('ink', 'ink_line') else amount
            nt.links.new(e2.outputs[0], f.inputs[0])
            mx = nt.nodes.new('ShaderNodeMix')
            mx.data_type = 'RGBA'
            nt.links.new(f.outputs[0], mx.inputs['Factor'])
            if sock.is_linked:
                src = sock.links[0].from_socket
                nt.links.new(src, mx.inputs[6])
            else:
                mx.inputs[6].default_value = tuple(sock.default_value)
            mx.inputs[7].default_value = hz
            nt.links.new(mx.outputs[2], sock)
        m['fv_hazed'] = 1


# ---------- Randlicht / rim light ----------
def rim_units(shot, direction, color, width=0.32, amount=1.0):
    """
    Randlicht auf den gezeichneten Einheiten: schmaler heller Saum an der Silhouette, wo die Flaeche zum Gegenlicht
    zeigt (Anime: Kante gegen den hellen Himmel). Wird zwischen Lichtbaender und Tusche eingesetzt, die Tusche bleibt
    oben. direction = Richtung zum Licht (Welt).
    Rim light on the inked units: a narrow bright fringe at the silhouette where the surface faces the back light
    (anime: the edge against the bright sky). Inserted between the light bands and the ink, the ink stays on top.
    direction = direction towards the light (world).
    """
    d = Vector(direction).normalized()
    rc = lin(color) if not isinstance(color, tuple) else color
    for m in bpy.data.materials:
        if not m.name.startswith('inked_') or m.get('fv_rim'):
            continue
        nt = m.node_tree
        ink = L.rgb('ink')
        target = None
        for x in nt.nodes:
            if x.type == 'MIX' and getattr(x, 'data_type', '') == 'RGBA' and not x.inputs[7].is_linked and x.inputs[6].is_linked:
                if all(abs(x.inputs[7].default_value[i] - ink[i]) < 1e-4 for i in range(3)):
                    target = x
        if target is None:
            continue
        src = target.inputs[6].links[0].from_socket
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        # Silhouette: 1 - |N . V| / silhouette: 1 - |N . V|
        ndv = nt.nodes.new('ShaderNodeVectorMath')
        ndv.operation = 'DOT_PRODUCT'
        nt.links.new(geo.outputs['Normal'], ndv.inputs[0])
        nt.links.new(geo.outputs['Incoming'], ndv.inputs[1])
        ab = nt.nodes.new('ShaderNodeMath')
        ab.operation = 'ABSOLUTE'
        nt.links.new(ndv.outputs['Value'], ab.inputs[0])
        sil = nt.nodes.new('ShaderNodeMath')
        sil.operation = 'LESS_THAN'
        sil.inputs[1].default_value = width
        nt.links.new(ab.outputs[0], sil.inputs[0])
        # zum Licht gewandt / facing the light
        ndl = nt.nodes.new('ShaderNodeVectorMath')
        ndl.operation = 'DOT_PRODUCT'
        nt.links.new(geo.outputs['Normal'], ndl.inputs[0])
        ndl.inputs[1].default_value = tuple(d)
        fl = nt.nodes.new('ShaderNodeMath')
        fl.operation = 'GREATER_THAN'
        fl.inputs[1].default_value = 0.05
        nt.links.new(ndl.outputs['Value'], fl.inputs[0])
        k = nt.nodes.new('ShaderNodeMath')
        k.operation = 'MULTIPLY'
        nt.links.new(sil.outputs[0], k.inputs[0])
        nt.links.new(fl.outputs[0], k.inputs[1])
        k2 = nt.nodes.new('ShaderNodeMath')
        k2.operation = 'MULTIPLY'
        k2.inputs[1].default_value = amount
        nt.links.new(k.outputs[0], k2.inputs[0])
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = 'SCREEN'
        nt.links.new(k2.outputs[0], mx.inputs['Factor'])
        nt.links.new(src, mx.inputs[6])
        mx.inputs[7].default_value = rc
        nt.links.new(mx.outputs[2], target.inputs[6])
        m['fv_rim'] = 1


# ---------- Wind im Umhang / wind in the cape ----------
def _wave_group():
    g = bpy.data.node_groups.get('CapeWave')
    if g:
        return g
    g = bpy.data.node_groups.new('CapeWave', 'GeometryNodeTree')
    g.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    for nm in ('Time', 'Amp', 'Top', 'Hem'):
        g.interface.new_socket(nm, in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    g.is_modifier = True
    n, Ln = g.nodes, g.links
    gi = n.new('NodeGroupInput')
    go = n.new('NodeGroupOutput')
    pos = n.new('GeometryNodeInputPosition')
    sep = n.new('ShaderNodeSeparateXYZ')
    Ln.new(pos.outputs[0], sep.inputs[0])

    def m(op, a, b=None, c=None):
        x = n.new('ShaderNodeMath')
        x.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                x.inputs[i].default_value = v
            else:
                Ln.new(v, x.inputs[i])
        return x.outputs[0]
    # Gewicht: 0 an der Schulter, 1 am Saum, nach unten staerker / weight: 0 at the shoulder, 1 at the hem, stronger downwards
    wgt = m('POWER', m('MINIMUM', m('MAXIMUM', m('DIVIDE', m('SUBTRACT', gi.outputs['Top'], sep.outputs[2]), m('SUBTRACT', gi.outputs['Top'], gi.outputs['Hem'])), 0.0), 1.0), 1.6)
    t = gi.outputs['Time']
    # Wellen laufen von der Schulter zum Saum und quer ueber die Breite / waves run from the shoulder to the hem and across the width
    w1 = m('SINE', m('ADD', m('MULTIPLY', t, 3.1), m('ADD', m('MULTIPLY', sep.outputs[2], 0.32), m('MULTIPLY', sep.outputs[0], 0.55))))
    w2 = m('SINE', m('ADD', m('MULTIPLY', t, 5.3), m('ADD', m('MULTIPLY', sep.outputs[2], 0.61), m('MULTIPLY', sep.outputs[0], -0.9))))
    a = m('MULTIPLY', wgt, gi.outputs['Amp'])
    ox = m('MULTIPLY', a, m('ADD', m('MULTIPLY', w1, 0.55), m('MULTIPLY', w2, 0.25)))
    oy = m('MULTIPLY', a, m('ADD', m('MULTIPLY', w2, 0.6), m('ADD', m('MULTIPLY', w1, 0.35), 0.4)))
    oz = m('MULTIPLY', a, m('MULTIPLY', w1, 0.18))
    cv = n.new('ShaderNodeCombineXYZ')
    Ln.new(ox, cv.inputs[0])
    Ln.new(oy, cv.inputs[1])
    Ln.new(oz, cv.inputs[2])
    sp = n.new('GeometryNodeSetPosition')
    Ln.new(gi.outputs['Geometry'], sp.inputs['Geometry'])
    Ln.new(cv.outputs[0], sp.inputs['Offset'])
    Ln.new(sp.outputs['Geometry'], go.inputs['Geometry'])
    return g


class CapeWind:
    """
    Wind im Umhang: derselbe Wellen-Modifikator auf Flaeche und Tusche (vor dem Tuschemodifikator), damit die Linien
    auf dem Tuch bleiben. Werte in Modellkoordinaten (Meter vor der Skalierung).
    Wind in the cape: the same wave modifier on fill and ink (before the ink modifier) so the lines stay on the cloth.
    Values in model coordinates (metres before scaling).
    """

    def __init__(self, shot, cape, amp=1.2, top=3.2, hem=-15.0):
        self.mods = []
        g = _wave_group()
        rec = L.unit_rec(shot, cape)
        by = {it.name: it.identifier for it in g.interface.items_tree if getattr(it, 'in_out', '') == 'INPUT'}
        self.by = by
        parts = []
        for fill, line, ink in rec['parts']:
            mf = fill.modifiers.new('wave', 'NODES')
            mf.node_group = g
            # Tusche: Welle zuerst, dann die Linienbreite / ink: the wave first, then the line width
            ng = ink.node_group
            line.modifiers.remove(ink)
            ml = line.modifiers.new('wave', 'NODES')
            ml.node_group = g
            ink2 = line.modifiers.new('ink', 'NODES')
            ink2.node_group = ng
            parts.append((fill, line, ink2))
            for mm in (mf, ml):
                ins = mm.properties.inputs
                getattr(ins, by['Amp']).value = float(amp)
                getattr(ins, by['Top']).value = float(top)
                getattr(ins, by['Hem']).value = float(hem)
                self.mods.append(mm)
        rec['parts'] = parts

    def update(self, t):
        for mm in self.mods:
            getattr(mm.properties.inputs, self.by['Time']).value = float(t)
            mm.id_data.update_tag()


# ---------- Felsen / rocks ----------
def rock(shot, loc, size, color, seed=1, px=2.6, squash=(1, 1, 0.7), sub=3):
    """Felsbrocken: verformte Ikosphaere mit flachen Facetten und Tusche / boulder: deformed icosphere with flat facets and ink"""
    import bmesh
    R = np.random.default_rng(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=0.5)
    ph = R.random(3) * 6.28
    for v in bm.verts:
        p = v.co
        k = 1 + 0.22 * math.sin(p.x * 7 + ph[0]) * math.cos(p.y * 6 + ph[1]) + 0.12 * math.sin(p.z * 9 + ph[2])
        v.co = Vector((p.x * squash[0], p.y * squash[1], p.z * squash[2])) * k
    me = bpy.data.meshes.new('rock')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(L.toon(shot, color))
    ob = bpy.data.objects.new('rock', me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.scale = (size, size, size) if isinstance(size, (int, float)) else size
    L._ink_shared(shot, ob, px)
    return ob


# ---------- Ganze Figur / full figure ----------
# Masse aus tools/intro-film/web/leaderFigure.ts (Modell-Einheiten, x TILE = Meter vor der Skalierung)
# sizes from tools/intro-film/web/leaderFigure.ts (model units, x TILE = metres before scaling)
FIG_FLOOR = -2.05
FIG_STEP = 0.36
FIG_ROCK = (0.24, 0.34)
FIG_CAPE = (0.34, -1.5)


def leader_figure(shot, faction, loc, rot, scale, rock_col=None, wind=1.2):
    """
    Anfuehrer als ganze Figur (Koerper + Umhang), die Sohlen auf loc; der linke Fuss steht auf einem Felsen.
    Rueckgabe: (Koerper, Umhang, Wind, Felsen).
    Leader as a full figure (body + cape), the soles on loc; the left foot stands on a rock.
    Returns (body, cape, wind, rock).
    """
    z = loc[2] - FIG_FLOOR * L.TILE * scale
    body = L.model(shot, 'leaderFull_%s' % faction, loc=(loc[0], loc[1], z), rot=rot, scale=scale)
    cape = L.model(shot, 'leaderCape_%s' % faction, loc=(loc[0], loc[1], z), rot=rot, scale=scale)
    cw = CapeWind(shot, cape, amp=wind, top=FIG_CAPE[0] * L.TILE, hem=FIG_CAPE[1] * L.TILE)
    # Felsen unter dem linken Fuss: Oberkante = Sohle / rock under the left foot: top = sole
    a = math.radians(rot)
    rx, rz = FIG_ROCK[0] * L.TILE * scale, FIG_ROCK[1] * L.TILE * scale
    # three (x, z) -> Blender (x, -z), dann um z drehen / three (x, z) -> Blender (x, -z), then rotate about z
    bx, by = rx, -rz
    wx = loc[0] + bx * math.cos(a) - by * math.sin(a)
    wy = loc[1] + bx * math.sin(a) + by * math.cos(a)
    top = loc[2] + FIG_STEP * L.TILE * scale
    rs = 3.4 * scale * L.TILE * 0.2
    rk = rock(shot, (wx, wy, top - rs * 0.32), (rs * 1.15, rs, rs * 0.75), rock_col or 'rock400', seed=3)
    return body, cape, cw, rk


def sun_rot(az, el):
    """Euler-Drehung einer Sonne, deren Licht aus Azimut az / Hoehe el kommt / Euler rotation of a sun lit from az / el"""
    d = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), math.cos(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))))
    return d.to_track_quat('Z', 'Y').to_euler(), d


# ---------- Gras im Vordergrund / foreground grass ----------
def grass(shot, height, centre, radius, n, cols, seed=1, blade=(1.2, 2.6), keep=None, px=1.6):
    """
    Grasbueschel als ein Netz: je Bueschel 5 duenne, gebogene Halme, zwei Toene im Wechsel, Tusche als Huelle.
    keep(x, y) -> bool waehlt die Stellen (z. B. nur im Bild, nicht unter der Figur).
    Grass tufts as one mesh: 5 thin curved blades per tuft, two tones alternating, ink as a hull.
    keep(x, y) -> bool picks the places (e.g. only in frame, not under the figure).
    """
    R = np.random.default_rng(seed)
    verts, faces, mats = [], [], []
    made = 0
    tries = 0
    while made < n and tries < n * 20:
        tries += 1
        r = radius * math.sqrt(R.random())
        a = R.random() * 2 * math.pi
        x, y = centre[0] + math.cos(a) * r, centre[1] + math.sin(a) * r
        if keep and not keep(x, y):
            continue
        z = height(x, y)
        made += 1
        lean = R.uniform(-0.6, 0.6)
        for b in range(5):
            hb = R.uniform(*blade)
            ang = R.uniform(0, 2 * math.pi)
            wdt = R.uniform(0.12, 0.22)
            bx, by = x + R.uniform(-0.4, 0.4), y + R.uniform(-0.4, 0.4)
            dx, dy = math.cos(ang), math.sin(ang)
            bend = R.uniform(0.2, 0.6) * hb
            k = len(verts)
            # drei Punkte: Fuss links/rechts, Mitte, Spitze / three rows: base left/right, middle, tip
            verts += [(bx - dy * wdt, by + dx * wdt, z - 0.2), (bx + dy * wdt, by - dx * wdt, z - 0.2),
                      (bx + dx * bend * 0.3 + lean * 0.3 - dy * wdt * 0.6, by + dy * bend * 0.3 + dx * wdt * 0.6, z + hb * 0.55),
                      (bx + dx * bend * 0.3 + lean * 0.3 + dy * wdt * 0.6, by + dy * bend * 0.3 - dx * wdt * 0.6, z + hb * 0.55),
                      (bx + dx * bend + lean, by + dy * bend, z + hb)]
            faces += [(k, k + 1, k + 3, k + 2), (k + 2, k + 3, k + 4)]
            mats += [b % 2, b % 2]
    me = bpy.data.meshes.new('grass')
    me.from_pydata(verts, [], faces)
    me.update()
    for c in cols:
        me.materials.append(L.toon(shot, c))
    me.polygons.foreach_set('material_index', mats)
    ob = bpy.data.objects.new('grass', me)
    shot.sc.collection.objects.link(ob)
    L._ink_shared(shot, ob, px)
    return ob


class Plume:
    """
    Rauchfahne aus einem Schlot: runde Ballen (feiner als Puffs), die steigen, wachsen, mit dem Wind treiben und
    zuletzt schrumpfen; Comic-Lichtbaender der Umgebung, Tusche.
    Smoke plume from a chimney: round puffs (finer than Puffs) that rise, grow, drift with the wind and finally shrink;
    the environment's comic light bands, ink.
    """

    def __init__(self, shot, origin, color, n=14, life=14.0, rise=55.0, size=(12, 28), wind=(-120, 20, 0), seed=1, px=1.8):
        R = np.random.default_rng(seed)
        mat = L.toon(shot, color)
        self.items = []
        for i in range(n):
            ob = L.prim(shot, 'ico', mat, loc=origin, size=1, sub=3, px=px / ((size[0] + size[1]) / 2), ink=True, smooth=True)
            self.items.append((ob, -life + i * life / n, R.uniform(*size), Vector((R.uniform(-1, 1), R.uniform(-1, 1), 0)) * 3, R.uniform(0.8, 1.2)))
        self.origin, self.life, self.rise, self.wind = Vector(origin), life, rise, Vector(wind)

    def update(self, t):
        for ob, birth, sz, off, sp in self.items:
            p = ((t - birth) % self.life) / self.life
            k = math.sin(min(1.0, p * 1.2) * math.pi * 0.5) * (1 - L.seg(p, 0.8, 1.0)) * (0.35 + 0.65 * p)
            ob.scale = (max(sz * k, 0.001),) * 3
            ob.location = self.origin + off * (0.3 + p) + Vector((0, 0, self.rise * math.sqrt(p) * sp)) + self.wind * p * p
