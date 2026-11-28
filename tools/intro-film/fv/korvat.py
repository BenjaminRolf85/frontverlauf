"""
Die Welt der Korvat fuer den Anime-Schnitt (Einstellungen E1a, E1b, E1c): Kornsteppe am Abend in wahrem Massstab
(1 Einheit = 1 Meter, der Marschall ist 1,86 m gross). Ein flacher Hoehenruecken mit einer Felsnase, davor das Tal mit
Kolchosfeldern, einer Staubstrasse und dem Heer: Reiterbloecke im Galopp mit Lanzen und Bannern, eine Panzerkolonne,
Infanterie im Marsch. Am Horizont Fabriken, darueber der gemalte Abendhimmel mit der Rauchfahne der Absturzstelle.
The Korvat world for the anime cut (shots E1a, E1b, E1c): grain steppe in the evening at true scale (1 unit = 1 metre,
the marshal is 1.86 m tall). A low ridge with a rock nose, in front of it the valley with collective farm fields, a
dust road and the army: blocks of riders at a gallop with lances and banners, a tank column, marching infantry. On the
horizon factories, above them the painted evening sky with the smoke plume of the crash site.

Schichten fuer die Tiefe / depth layers: Vordergrundgras und Fels (dunkel, scharf) - Figur - Heer im Tal (leichter
Dunst) - Felder und Fabriken (starker Dunst) - Himmel. Gemalt wird mit numpy an Weltkoordinaten (deterministisch).
"""
import math
import random

import bpy
import numpy as np
from mathutils import Vector

from . import anime as A
from . import army as AR
from . import figure as F
from . import lib as L

# Standort des Marschalls, Strasse (Punkt und Richtung als Azimut in Grad), Sonne
# the marshal's place, road (point and heading as an azimuth in degrees), sun
# Version der gemalten Bilder dieser Welt (erhoehen, wenn sich ein Maler aendert) / version of this world's painted pictures
KV = 5
M = (0.0, 0.0)
ROAD_P = (0.0, 30.0)
ROAD_AZ = 62.0
SUN_AZ, SUN_EL = 96.0, 15.0
SMOKE_AZ = 51.0
RD = (math.sin(math.radians(ROAD_AZ)), math.cos(math.radians(ROAD_AZ)))
RN = (RD[1], -RD[0])      # quer zur Strasse, zum Ruecken hin / across the road, towards the ridge
UNIT_ROT = 180.0 - ROAD_AZ


def road_uv(x, y):
    """(Weg entlang der Strasse, Abstand quer: + zum Ruecken hin) / (distance along the road, offset across: + towards the ridge)"""
    dx, dy = x - ROAD_P[0], y - ROAD_P[1]
    return dx * RD[0] + dy * RD[1], dx * RN[0] + dy * RN[1]


def road_xy(s, d):
    return ROAD_P[0] + RD[0] * s + RN[0] * d, ROAD_P[1] + RD[1] * s + RN[1] * d


def _rise(x, y):
    u = (x + 14.0) * 0.82 + (y + 16.0) * 0.57
    v = -(x + 14.0) * 0.57 + (y + 16.0) * 0.82
    return np.exp(-(((u / 30.0) ** 2 + (v / 40.0) ** 2) ** 1.4))


# Zusaetzliche Bodenwellen (x, y, Hoehe, Radius): eine Einstellung legt hier vor dem Aufbau ihren Vordergrund an
# extra ground humps (x, y, height, radius): a shot sets up its foreground here before the build
BUMPS = []


def height(x, y):
    """Gelaende: Ruecken (4,4 m) mit Kuppe am Standort, davor das Tal mit flachen Wellen / terrain: ridge (4.4 m) with a knoll at the standing place, the valley with gentle waves in front"""
    k = _rise(x, y)
    knoll = 1.25 * np.exp(-((x - M[0]) ** 2 + (y - M[1]) ** 2) / 34.0)
    valley = 0.45 * np.sin(x * 0.021 + 1.0) * np.cos(y * 0.017) + 0.25 * np.sin(0.047 * y + 0.031 * x)
    far = 3.0 * np.sin(x * 0.0041 + 0.5) * np.cos(y * 0.0033) + 2.0 * np.sin(y * 0.0074 + x * 0.002)
    d = np.hypot(x, y)
    fk = np.clip((d - 220.0) / 500.0, 0, 1)
    out = 4.4 * k + knoll + valley * (1 - 0.8 * k) + far * fk * fk * (3 - 2 * fk)
    for bx, by, bh, br in BUMPS:
        out = out + bh * np.exp(-(((x - bx) ** 2 + (y - by) ** 2) / (br * br)) ** 1.3)
    return out


def hz(x, y):
    return float(height(np.float64(x), np.float64(y)))


# ---------- Rauschen an Weltkoordinaten / noise at world coordinates ----------
def wnoise(X, Y, cell, seed):
    x, y = X / cell, Y / cell
    xi, yi = np.floor(x), np.floor(y)
    fx, fy = x - xi, y - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)

    def h(ix, iy):
        return np.abs(np.modf(np.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453)[0])

    a, b, c, d = h(xi, yi), h(xi + 1, yi), h(xi, yi + 1), h(xi + 1, yi + 1)
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy


def wfbm(X, Y, cell, seed, octaves=3):
    out, amp, tot = 0.0, 1.0, 0.0
    for o in range(octaves):
        out = out + amp * wnoise(X, Y, cell / 2 ** o, seed + o * 17)
        tot += amp
        amp *= 0.5
    return out / tot


def paint_land(area, n):
    """
    Draufsicht des Landes fuer den Bereich area = (x0, y0, x1, y1) in n x n Bildpunkten, an Weltkoordinaten gemalt:
    jede Gelaendeschicht (fern, mittel, nah) bekommt denselben Maler in ihrer Aufloesung, die Farben passen an den
    Raendern. Feines (Furchen, Halme, Hufspuren) erscheint erst, wenn ein Bildpunkt klein genug ist.
    Top view of the land for area = (x0, y0, x1, y1) at n x n pixels, painted at world coordinates: every terrain layer
    (far, mid, near) gets the same painter at its own resolution, the colours match at the borders. Fine detail
    (furrows, blades, hoof marks) only appears once a pixel is small enough.
    """
    # in Zeilenbaendern malen (alles haengt nur vom Ort ab): spart Arbeitsspeicher / paint in row bands (everything depends on the place only): saves memory
    return np.concatenate([_paint_rows(area, n, r, min(n, r + 384)) for r in range(0, n, 384)], 0)


def _paint_rows(area, n, r0, r1):
    x0, y0, x1, y1 = area
    px = (x1 - x0) / n
    X, Y = np.meshgrid(np.linspace(x0, x1, n, dtype=np.float64), np.linspace(y1, y0, n, dtype=np.float64)[r0:r1])
    S, Dv = road_uv(X, Y)
    rows = r1 - r0

    def show(period):
        return float(np.clip((period / px - 2.0) / 3.0, 0, 1))

    # Felder: Streifen laengs der Strasse / fields: strips along the road
    warp = (wfbm(X, Y, 180.0, 11) - 0.5) * 22.0
    vs = (Dv + warp + 4000.0) / 46.0
    strip = np.floor(vs)
    hs = np.abs(np.modf(np.sin(strip * 91.7) * 43758.5453)[0])
    us = (S + hs * 300.0 + 6000.0) / (110.0 + hs * 190.0)
    field = np.floor(us)
    hsh = np.abs(np.modf(np.sin(strip * 12.9898 + field * 78.233) * 43758.5453)[0])
    wheat = A.cmix('steppe300', 'yellow400', 0.38)
    wheat2 = A.cmix('steppe300', 'paper300', 0.35)
    stubble = A.cmix('paper300', 'khaki500', 0.45)
    green = A.cmix('olive400', 'grass500', 0.3)
    plough = A.cmix('soil500', 'mud500', 0.5)
    kinds = [wheat, stubble, wheat2, wheat, green, plough, stubble, wheat2]
    kk = np.minimum((hsh * len(kinds)).astype(int), len(kinds) - 1)
    img = np.zeros((rows, n, 3), np.float32)
    for i, c in enumerate(kinds):
        img[kk == i] = c
    # grosse Pinselflecken in zwei Toenen, harte Kante / large brush patches in two tones, hard edge
    blot = wfbm(X + warp, Y, 26.0, 3) > 0.54
    img *= np.where(blot, 0.9, 1.0)[..., None].astype(np.float32)
    # Reihen und Furchen laengs der Strasse / rows and furrows along the road
    for sel, period, depth in (((kk == 5), 1.5, 0.3), ((kk == 1) | (kk == 6), 0.7, 0.16), ((kk == 0) | (kk == 2) | (kk == 3) | (kk == 7), 1.1, 0.1)):
        a = show(period)
        if a > 0:
            line = (np.modf((Dv + warp * 0.2 + 4000.0) / period)[0] < 0.36) & sel
            img[line] *= 1 - depth * a
    # Feldraine / field edges
    fv = np.abs(vs - np.round(vs)) * 46.0
    fu = np.abs(us - np.round(us)) * (110.0 + hs * 190.0)
    edge = (fv < 0.9 + px * 0.5) | (fu < 0.9 + px * 0.5)
    img[edge] = img[edge] * 0.5 + A.cmix('track700', 'olive600', 0.5) * 0.5

    # Reiterbahn zwischen Ruecken und Strasse: zertretenes Stoppelfeld / riders' lane between ridge and road: trampled stubble
    lane = np.clip(1 - np.abs(Dv - 10.5) / 9.5, 0, 1)
    lane = lane * lane * (3 - 2 * lane)
    churn = wfbm(X, Y, 5.0, 7) * 0.6 + 0.4 * wfbm(X, Y, 1.3, 9)
    dust = A.cmix('dust300', 'steppe300', 0.45)
    lk = (lane * (0.35 + 0.5 * (churn > 0.5)))[..., None].astype(np.float32)
    img = img * (1 - lk) + dust[None, None, :] * lk
    a = show(0.5)
    if a > 0:
        hoof = (wnoise(X, Y, 0.22, 5) > 0.74) & (lane > 0.3)
        img[hoof] *= 1 - 0.22 * a

    # Staubstrasse mit Fahrspuren und Kettenabdruck / dust road with ruts and track marks
    ad = np.abs(Dv + 3.0 * (wnoise(S, S * 0 + 1.0, 60.0, 2) - 0.5))
    road = A.cmix('track500', 'dust300', 0.45)
    verge = A.cmix('track700', 'olive600', 0.45)
    img[ad < 5.4] = verge
    img[ad < 4.2] = road * (0.93 + 0.1 * (wfbm(X, Y, 3.0, 4)[ad < 4.2, None] > 0.5))
    rut = (np.abs(ad - 1.45) < 0.34) & (ad < 4.2)
    img[rut] = A.cmix('track700', 'mud500', 0.4)
    a = show(0.42)
    if a > 0:
        tread = rut & (np.modf((S + 4000.0) / 0.42)[0] < 0.45)
        img[tread] *= 1 - 0.3 * a

    # Hoehenruecken: Steppengras in Pinselstrichen, kahle Stellen am Fels / ridge: steppe grass in brush strokes, bare patches at the rock
    k = np.clip((_rise(X, Y) - 0.1) / 0.16, 0, 1) + np.clip(1.25 * np.exp(-((X - M[0]) ** 2 + (Y - M[1]) ** 2) / 34.0) - 0.2, 0, 1)
    k = np.clip(k, 0, 1)
    k = (k * k * (3 - 2 * k))[..., None].astype(np.float32)
    g_lit = A.cmix('steppe300', 'khaki500', 0.42)
    g_mid = A.cmix('steppe500', 'olive400', 0.35)
    g_dark = A.cmix('olive600', 'steppe500', 0.45)
    st = wfbm(X * 0.5 + Y * 0.25, Y - X * 0.2, 7.0, 21, 3)
    gcol = np.where((st > 0.57)[..., None], g_lit, np.where((st > 0.42)[..., None], g_mid, g_dark)).astype(np.float32)
    a = show(0.3)
    if a > 0:
        fl = wnoise(X * 1.0, Y * 0.35 + X * 0.2, 0.16, 31)
        gcol = gcol * np.where(fl > 0.7, 1 - 0.2 * a, np.where(fl < 0.22, 1 + 0.12 * a, 1.0))[..., None].astype(np.float32)
    bare = (np.exp(-((X - M[0] - 0.6) ** 2 + (Y - M[1] - 0.4) ** 2) / 9.0) + 0.25 * (wfbm(X, Y, 2.2, 13) - 0.5)) > 0.42
    earth = A.cmix('rock400', 'khaki500', 0.45) * (0.92 + 0.12 * (wfbm(X, Y, 0.8, 15)[..., None] > 0.5))
    gcol = np.where(bare[..., None], earth, gcol).astype(np.float32)
    img = img * (1 - k) + gcol * k
    return np.clip(img, 0, 1)


# ---------- Himmel / sky ----------
def sky_spec():
    """Abendhimmel der Korvat: Gold am Horizont, Lachs, oben Violettblau; Wolkenbaenke im Gegenlicht / Korvat evening sky"""
    return A.SkySpec(
        w=4096, h=1792, az=(-45.0, 85.0), el=(-6.0, 48.0), sun=(62.0, 3.2), seed=4,
        grad=[(-6, A.cmix('hazeDusk', 'sunDusk', 0.4)), (0, A.cmix('sunDusk', 'yellow400', 0.35)), (3, 'sunDusk'),
              (9, A.cmix('sunDusk', 'orange500', 0.35)), (18, A.cmix('orange500', 'red700', 0.35)),
              (30, A.cmix('red700', 'skyMid', 0.55)), (48, A.cmix('skyMid', 'sky800', 0.6))],
        glow=(A.cmix('sunDusk', 'yellow400', 0.5), A.hexc('flash100')),
        rays=0.3,
        cloud_cols=(A.cmix('skyMid', 'sunDusk', 0.3), A.cmix('orange500', 'red500', 0.35), A.cmix('sunDusk', 'yellow400', 0.4), A.hexc('flash100')),
        clouds=[
            {'at': (77, 6.0), 'w': 22, 'h': 7.5, 'n': 70, 'size': 2.6, 'tone': 1.0, 'peak': 1.3},
            {'at': (-12, 5.0), 'w': 28, 'h': 11, 'n': 55, 'size': 2.6, 'tone': 0.2, 'peak': 1.1},
            {'at': (20, 13.0), 'w': 16, 'h': 5, 'n': 30, 'size': 1.8, 'tone': 0.5, 'peak': 1.4},
            {'at': (15, 1.0), 'w': 50, 'h': 3, 'n': 40, 'size': 2.2, 'tone': -0.6, 'peak': 2},
        ],
        land=[
            {'el': 0.15, 'amp': 1.3, 'waves': 5, 'seed': 2, 'col': A.cmix('hazeDusk', 'skyMid', 0.18), 'rim': A.cmix('hazeDusk', 'flash100', 0.5)},
            {'el': -0.2, 'amp': 0.9, 'waves': 9, 'seed': 3, 'col': A.cmix('hazeDusk', 'olive500', 0.25), 'rim': A.cmix('sunDusk', 'flash100', 0.4)},
        ],
    )


def paint_sky_korvat(spec):
    """
    Himmel mit der Rauchfahne der Absturzstelle: fern, schmal, steigt mit Knicken im Wind, stoesst in der Hoehe an eine
    Sperrschicht und zieht dort als flache Fahne nach links ab. Kein Trichter: der Stamm bleibt duenn, nur die Fahne
    breitet sich aus. Zwei flache Toene, heller Saum zur Sonne, violette Glut am Fuss.
    Sky with the smoke plume of the crash site: far, narrow, rising with kinks in the wind, hitting an inversion at
    altitude and drifting off to the left as a flat banner there. No funnel: the stem stays thin, only the banner
    spreads. Two flat tones, a bright fringe towards the sun, violet glow at the foot.
    """
    img = A.paint_sky(spec)
    w, h = spec.w, spec.h
    px_az = (spec.az[1] - spec.az[0]) / w
    t0, t1 = math.tan(math.radians(spec.el[0])), math.tan(math.radians(spec.el[1]))

    def row(e):
        return np.interp(math.tan(math.radians(e)), [t0, t1], [h - 1, 0])

    px_el = abs(row(1.0) - row(0.0))
    sdf = np.full((h, w), -1e6, np.float32)
    R = np.random.default_rng(spec.seed + 77)

    def blob(a, e, ra, re):
        cx, cy = (a - spec.az[0]) / px_az, row(e)
        rx, ry = ra / px_az, re * px_el
        x0_, x1_ = int(max(0, cx - rx - 3)), int(min(w, cx + rx + 3))
        y0_, y1_ = int(max(0, cy - ry - 3)), int(min(h, cy + ry + 3))
        if x0_ >= x1_ or y0_ >= y1_:
            return
        yy, xx = np.mgrid[y0_:y1_, x0_:x1_].astype(np.float32)
        d = (1 - np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)) * min(rx, ry)
        np.maximum(sdf[y0_:y1_, x0_:x1_], d, out=sdf[y0_:y1_, x0_:x1_])

    base_az, base_el, top_el = SMOKE_AZ, 0.25, 6.6
    # Stamm: duenn, mit Knicken / stem: thin, with kinks
    for i in range(90):
        k = i / 89.0
        e = base_el + (top_el - base_el) * k
        a = base_az + 0.55 * math.sin(k * 3.4) + 1.1 * k * k + R.uniform(-0.07, 0.07)
        r = 0.13 + 0.26 * k ** 0.9 + R.uniform(0, 0.08)
        blob(a, e, r, r * 0.9)
    # Fahne: flach, nach links, duenner werdend / banner: flat, to the left, thinning out
    top_az = base_az + 0.55 * math.sin(3.4) + 1.1
    for i in range(90):
        k = i / 89.0
        a = top_az + 15.0 * k ** 0.85 + R.uniform(-0.25, 0.25)
        e = top_el + 0.6 * math.sin(k * 2.2) - 0.35 * k + R.uniform(-0.1, 0.14) * (1 - k)
        ra = (0.5 + 1.15 * math.sin(min(1.0, k * 1.5) * math.pi * 0.5)) * (1 - 0.6 * k) * R.uniform(0.75, 1.2)
        blob(a, e, ra, ra * (0.5 - 0.22 * k))
    sdf += (A.fbm(h, w, 22, spec.seed + 61, 3) - 0.5) * 5.0
    alpha = np.clip(sdf / 1.3 + 0.5, 0, 1)
    A_, E_ = np.meshgrid(np.linspace(spec.az[0], spec.az[1], w, dtype=np.float32), np.arange(h, dtype=np.float32))
    far = np.clip((A_ - top_az) / 15.0, 0, 1)
    alpha *= 1 - 0.75 * far ** 1.5
    dark = A.cmix(A.cmix('smoke700', 'skyMid', 0.45), 'red700', 0.18)
    mid = A.cmix(A.cmix('smoke400', 'orange500', 0.35), 'skyMid', 0.2)
    rim = A.cmix('sunDusk', 'flash100', 0.35)
    gy, gx = np.gradient(A._blur((sdf > 0).astype(np.float32), 5, 2))
    lit = (-gx * 0.9 + gy * 0.35) > 0.012        # zur Sonne (rechts unten) / towards the sun (lower right)
    cc = np.where(lit[..., None], mid, dark).astype(np.float32)
    edge = (sdf > 0) & (sdf < 2.6) & (-gx > 0.02)
    cc = np.where(edge[..., None], rim, cc)
    # Luftperspektive: zum Himmel hin gemischt / aerial perspective: mixed towards the sky
    cc = cc * 0.8 + img * 0.2
    img = img * (1 - alpha[..., None]) + cc * alpha[..., None]
    # Glut am Fuss / glow at the foot
    dg = np.sqrt(((A_ - base_az) * 1.0) ** 2 + ((E_ - row(base_el)) / px_el * 2.4) ** 2)
    glow = A.cmix('zyrrViolet', 'flash100', 0.3)
    img += (glow[None, None, :] - img) * (np.exp(-(dg / 1.3) ** 2) * 0.75)[..., None]
    return np.clip(img, 0, 1)


# ---------- Fels / rock ----------
def facet_rock(shot, loc, size, color, seed=1, cuts=16, px=2.2, top=None, rot=0.0, crease=0.8):
    """
    Gemalter Fels: ein Block mit grossen ebenen Bruchflaechen (Kugel, von zufaelligen Ebenen beschnitten), flach
    schattiert (jede Flaeche ein Ton), Tusche am Umriss. top = Farbe der nach oben zeigenden Flaechen.
    Painted rock: a block with large flat fracture planes (a sphere cut by random planes), flat shaded (one tone per
    face), ink on the silhouette. top = colour of the faces pointing up.
    """
    import bmesh
    R = np.random.default_rng(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
    planes = []
    for i in range(cuts):
        nrm = R.normal(size=3)
        nrm[2] = abs(nrm[2]) * (0.45 if i > 0 else 0.0) + (0.0 if i > 0 else 1.0)
        if i == 0:
            nrm[:2] *= 0.06
        nrm /= np.linalg.norm(nrm)
        planes.append((Vector(nrm), R.uniform(0.5, 0.86) if i > 0 else 0.78))
    planes.append((Vector((0, 0, -1)), 0.35))
    for v in bm.verts:
        p = v.co.copy()
        for nrm, d in planes:
            k = p.dot(nrm)
            if k > d:
                p -= nrm * (k - d)
        v.co = p
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.012)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.06, verts=bm.verts, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    me = bpy.data.meshes.new('rock')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(L.toon(shot, color))
    if top is not None:
        me.materials.append(L.toon(shot, top))
        me.polygons.foreach_set('material_index', [1 if p.normal.z > 0.8 else 0 for p in me.polygons])
    ob = bpy.data.objects.new('rock', me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = (0, 0, rot)
    ob.scale = (size, size, size) if isinstance(size, (int, float)) else size
    L._ink_shared(shot, ob, px)
    # Bruchkanten: duenne Tuscheprismen entlang der scharfen Kanten, an den Enden auslaufend
    # fracture edges: thin ink prisms along the sharp edges, tapering at the ends
    sz = ob.scale
    dist = (Vector(loc) - shot.cam.location).length
    r = shot.px(max(dist, 1.0)) * crease
    verts, faces = [], []
    import bmesh as _bm
    bm2 = _bm.new()
    bm2.from_mesh(me)
    for e in bm2.edges:
        if len(e.link_faces) != 2 or e.link_faces[0].normal.dot(e.link_faces[1].normal) > 0.9:
            continue
        a = Vector((e.verts[0].co.x * sz[0], e.verts[0].co.y * sz[1], e.verts[0].co.z * sz[2]))
        b = Vector((e.verts[1].co.x * sz[0], e.verts[1].co.y * sz[1], e.verts[1].co.z * sz[2]))
        d = b - a
        if d.length < r * 4:
            continue
        mid = (a + b) * 0.5
        u = d.cross(Vector((0, 0, 1)) if abs(d.normalized().z) < 0.9 else Vector((1, 0, 0))).normalized() * r
        v = d.cross(u).normalized() * r
        k = len(verts)
        verts += [a, mid + u, mid + v, mid - u, mid - v, b]
        faces += [(k, k + 1, k + 2), (k, k + 2, k + 3), (k, k + 3, k + 4), (k, k + 4, k + 1), (k + 5, k + 2, k + 1), (k + 5, k + 3, k + 2), (k + 5, k + 4, k + 3), (k + 5, k + 1, k + 4)]
    bm2.free()
    if verts and crease > 0:
        lm = bpy.data.meshes.new('rock_lines')
        lm.from_pydata([tuple(p) for p in verts], [], faces)
        lm.update()
        lm.materials.append(L.ink_line_mat())
        lo = bpy.data.objects.new('rock_lines', lm)
        shot.sc.collection.objects.link(lo)
        lo.location = Vector(loc)
        lo.rotation_euler = (0, 0, rot)
        lo.visible_shadow = False
    return ob


# ---------- Gras / grass ----------
class Grass:
    """
    Vordergrundgras als gemalte Bueschel: breite gebogene Halme in drei Toenen (unten dunkel, Spitzen hell), dazu
    Federgras mit Aehren und Mohn. Ein Netz, keine Tusche; alle Normalen zeigen nach oben (ein ruhiger Ton je Halm, der
    Schattenwurf bleibt). Der Wind neigt die Halme je Bild.
    Foreground grass as painted tufts: broad curved blades in three tones (dark below, bright tips), plus feather grass
    with ears and poppies. One mesh, no ink; all normals point up (one calm tone per blade, cast shadows stay). The
    wind bends the blades per frame.
    """

    def __init__(self, shot, centre, radius, n, seed=1, keep=None, tall=0.012, flowers=0.03, size=1.0, dense=2.2):
        R = np.random.default_rng(seed)
        cols = [A.lin(A.cmix('olive600', 'ink700', 0.25)), A.lin(A.cmix('steppe500', 'olive400', 0.5)), A.lin(A.cmix('steppe300', 'khaki500', 0.3)), A.lin(A.cmix('steppe300', 'sunDusk', 0.55))]
        dry = A.lin(A.cmix('paper300', 'steppe300', 0.5))
        red = A.lin(A.cmix('korvatRed', 'red500', 0.4))
        V, Fc, C, Hh, Ph = [], [], [], [], []

        def blade(bx, by, bz, ang, hgt, wdt, lean, c0, c1):
            dx, dy = math.cos(ang), math.sin(ang)
            k = len(V)
            for j, (u, wk) in enumerate(((0, 1.0), (0.38, 0.86), (0.72, 0.55))):
                bend = lean * hgt * u * u
                for sgn in (-1, 1):
                    V.append((bx + dx * bend - dy * wdt * wk * sgn, by + dy * bend + dx * wdt * wk * sgn, bz + hgt * u * (1 - 0.18 * lean * u) - (0.06 if j == 0 else 0)))
                    C.append(tuple(c0[i] + (c1[i] - c0[i]) * u for i in range(3)) + (1.0,))
                    Hh.append(hgt * u)
            V.append((bx + dx * lean * hgt, by + dy * lean * hgt, bz + hgt * (1 - 0.18 * lean)))
            C.append(tuple(c1) + (1.0,))
            Hh.append(hgt)
            Fc.extend([(k, k + 1, k + 3, k + 2), (k + 2, k + 3, k + 5, k + 4), (k + 4, k + 5, k + 6)])

        made = tries = 0
        while made < n and tries < n * 30:
            tries += 1
            r = radius * R.random() ** (1.0 / dense)
            a = R.random() * 2 * math.pi
            x, y = centre[0] + math.cos(a) * r, centre[1] + math.sin(a) * r
            if keep and not keep(x, y):
                continue
            z = hz(x, y)
            made += 1
            kind = R.random()
            s = size * R.uniform(0.75, 1.3)
            if kind < tall:
                # Federgras: duenne Halme mit Aehre / feather grass: thin stalks with an ear
                for _ in range(int(R.integers(2, 5))):
                    ang, hgt = R.uniform(0, 6.28), R.uniform(0.55, 0.95) * s
                    bx, by = x + R.uniform(-0.08, 0.08), y + R.uniform(-0.08, 0.08)
                    blade(bx, by, z, ang, hgt, 0.006, R.uniform(0.15, 0.4), cols[1][:3], dry[:3])
                    k = len(V)
                    tip = V[-1]
                    dx, dy = math.cos(ang), math.sin(ang)
                    for (du, dw, dzz) in ((0, 0.011, 0.0), (0, -0.011, 0.0), (0.04, 0, 0.1)):
                        V.append((tip[0] + dx * du - dy * dw, tip[1] + dy * du + dx * dw, tip[2] + dzz))
                        C.append(tuple(dry[:3]) + (1.0,))
                        Hh.append(hgt + dzz)
                    Fc.append((k, k + 1, k + 2))
            elif kind < tall + flowers:
                ang, hgt = R.uniform(0, 6.28), R.uniform(0.3, 0.5) * s
                blade(x, y, z, ang, hgt, 0.007, R.uniform(0.1, 0.3), cols[1][:3], cols[2][:3])
                tip = V[-1]
                k = len(V)
                for i in range(5):
                    aa = i / 5 * 6.28
                    V.append((tip[0] + math.cos(aa) * 0.04, tip[1] + math.sin(aa) * 0.04, tip[2] + 0.012))
                    C.append(tuple(red[:3]) + (1.0,))
                    Hh.append(hgt)
                Fc.append((k, k + 1, k + 2, k + 3, k + 4))
            else:
                nb = int(R.integers(7, 12))
                tone = int(R.integers(0, 3))
                for bi in range(nb):
                    ang = R.uniform(0, 6.28)
                    hgt = R.uniform(0.22, 0.5) * s * (1.25 if bi < 3 else 1.0)
                    c0 = cols[0][:3]
                    c1 = cols[min(3, tone + (1 if bi % 3 == 0 else 0) + 1)][:3]
                    blade(x + R.uniform(-0.06, 0.06), y + R.uniform(-0.06, 0.06), z, ang, hgt, R.uniform(0.014, 0.026) * s, R.uniform(0.25, 0.8), c0, c1)
        me = bpy.data.meshes.new('grass')
        me.from_pydata(V, [], Fc)
        me.update()
        col = np.array(C, np.float32)
        loops = np.empty(len(me.loops), np.int32)
        me.loops.foreach_get('vertex_index', loops)
        me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER').data.foreach_set('color', col[loops].ravel())
        me.attributes.new('custom_normal', 'FLOAT_VECTOR', 'CORNER').data.foreach_set('vector', np.tile(np.array([0, 0, 1], np.float32), len(loops)))
        me.materials.append(L.toon_attr(shot))
        ob = bpy.data.objects.new('grass', me)
        shot.sc.collection.objects.link(ob)
        self.ob, self.me = ob, me
        self.P0 = np.array(V, np.float64)
        self.hh = np.array(Hh, np.float64)
        self.count = made

    def update(self, t, strength=1.0):
        P = self.P0
        ph = P[:, 0] * 0.55 + P[:, 1] * 0.35 - t * 2.6
        sway = (0.06 * np.sin(ph) + 0.03 * np.sin(ph * 2.3 + 1.1) + 0.05) * strength
        k = self.hh ** 1.5
        out = P.copy()
        out[:, 0] -= sway * k * 0.9
        out[:, 1] -= sway * k * 0.3
        self.me.vertices.foreach_set('co', out.astype(np.float32).ravel())
        self.me.update()


# ---------- Licht / light ----------
def bounce_units(shot, color, amount=0.3):
    """
    Bodenlicht auf den gezeichneten Figuren: Flaechen, die nach unten zeigen, bekommen einen warmen Schein vom Boden
    (wie das Aufhelllicht im Anime). Wird wie das Randlicht vor der Tusche eingesetzt.
    Bounce light on the inked figures: faces pointing down get a warm glow from the ground (as the fill light in
    anime). Inserted before the ink like the rim light.
    """
    bc = A.lin(color) if not isinstance(color, tuple) else color
    for m in bpy.data.materials:
        if not m.name.startswith('inked_') or m.get('fv_bounce'):
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
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(geo.outputs['Normal'], sep.inputs[0])
        f = nt.nodes.new('ShaderNodeMath')
        f.operation = 'LESS_THAN'
        f.inputs[1].default_value = -0.45
        nt.links.new(sep.outputs[2], f.inputs[0])
        k = nt.nodes.new('ShaderNodeMath')
        k.operation = 'MULTIPLY'
        k.inputs[1].default_value = amount
        nt.links.new(f.outputs[0], k.inputs[0])
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = 'SCREEN'
        nt.links.new(k.outputs[0], mx.inputs['Factor'])
        nt.links.new(src, mx.inputs[6])
        mx.inputs[7].default_value = bc
        nt.links.new(mx.outputs[2], target.inputs[6])
        m['fv_bounce'] = 1


def lights(shot, az=None, el=None):
    """
    Abendlicht: warmes Hauptlicht tief von rechts, violette Schatten. az / el: Hauptlicht fuer eine Nahaufnahme anders
    setzen (wie am Set: das Licht wird je Einstellung zum Gesicht gedreht).
    Evening light: warm key low from the right, violet shadows. az / el: place the key differently for a close-up (as on
    a set: the light is turned to the face per shot).
    """
    shot.toon.set_light(A.lin(A.cmix('skyMid', 'sky700', 0.3) * 0.42 + A.cmix('sunDusk', 'paper100', 0.5) * 0.58),
                        A.lin(A.cmix('sunDusk', 'skyMid', 0.32)), A.lin(A.cmix('paper50', 'sunDusk', 0.35)))
    rot, sdir = A.sun_rot(SUN_AZ if az is None else az, SUN_EL if el is None else el)
    shot.sunlight(rot=tuple(rot))
    L.sky(shot, [(-1, 'hazeDusk'), (1, 'sky800')])
    return sdir


def finish_light(shot, sdir, haze=(16.0, 300.0, 0.8)):
    """Nach dem Aufbau: Dunst, Randlicht von der Sonne, Bodenlicht / after the build: haze, rim light from the sun, bounce"""
    A.haze_all(shot, A.cmix('hazeDusk', 'sunDusk', 0.25), start=haze[0], dist=haze[1], amount=haze[2])
    A.rim_units(shot, sdir, A.cmix('flash100', 'sunDusk', 0.4), width=0.3)
    bounce_units(shot, A.cmix('sunDusk', 'steppe300', 0.5), 0.28)


def sky(shot, cam):
    spec = sky_spec()
    return A.cyclorama(shot, spec, (cam[0], cam[1], cam[2] - 30), radius=3800, name='sky_korvat_e1_k%d' % KV, painter=paint_sky_korvat)


# ---------- Gelaende / terrain ----------
def land(shot, near_at, near=34.0):
    """Drei Gelaendeschichten mit demselben Maler: fern (2,4 km), mittel (um das Heer), nah (um die Kamera) / three terrain layers with the same painter"""
    out = []
    mid_c = road_xy(40.0, 14.0)
    layers = [
        ('far', (-900.0, -400.0, 1500.0, 2000.0), 150, 4096, 0.0),
        ('mid', (mid_c[0] - 230.0, mid_c[1] - 230.0, mid_c[0] + 230.0, mid_c[1] + 230.0), 200, 4096, 0.03),
        ('near', (near_at[0] - near, near_at[1] - near, near_at[0] + near, near_at[1] + near), 220, 4096, 0.06),
    ]
    for name, area, sub, res, lift in layers:
        tex = A.painted('land_%s_%d_%d_k%d' % (name, int(area[0]), int(area[1]), KV), paint_land, area, res)
        ob = A.terrain(shot, lambda x, y: hz(x, y) + lift, (area[2] - area[0], area[3] - area[1]), (sub, sub), tex, area, name='land_' + name,
                       loc=((area[0] + area[2]) / 2, (area[1] + area[3]) / 2))
        out.append(ob)
    return out


def outcrop(shot, at, top):
    """Felsnase unter dem Marschall: grosse Platte (Standflaeche auf Hoehe top), Bloecke darum / rock nose under the marshal: a big slab (standing surface at height top), blocks around it"""
    c1 = A.lin(A.cmix('rock400', 'khaki500', 0.3))
    c2 = A.lin(A.cmix('rock400', 'sunDusk', 0.25))
    moss = A.lin(A.cmix('steppe500', 'rock400', 0.45))
    rocks = []
    # Platte: der obere Schnitt liegt bei 0.78 der Groesse / slab: the top cut lies at 0.78 of the size
    rocks.append(facet_rock(shot, (at[0], at[1], top - 0.78 * 1.05), (2.1, 1.7, 1.05), c1, seed=21, top=c2, rot=0.5))
    for i, (dx, dy, sz, sq) in enumerate(((1.9, 0.5, 1.1, 0.7), (-1.6, 1.0, 0.9, 0.8), (0.9, -1.7, 0.8, 0.6), (-0.9, -1.6, 1.25, 0.55), (2.6, -1.2, 0.6, 0.7), (-2.7, -0.4, 0.55, 0.8),
                                           (0.3, 2.2, 0.7, 0.6), (3.4, 1.4, 0.45, 0.8))):
        x, y = at[0] + dx, at[1] + dy
        rocks.append(facet_rock(shot, (x, y, hz(x, y) + sz * sq * 0.18), (sz, sz * 0.85, sz * sq), c1 if i % 2 else A.lin(A.cmix('rock400', 'khaki500', 0.42)), seed=30 + i, top=moss if i % 3 == 0 else c2, rot=i * 1.3))
    return rocks


# ---------- Heer / army ----------
FAR = 130.0
# Anteil der Dreiecke in mittlerer Entfernung / share of the triangles at mid distance
MID_LOD = 0.5


class Army:
    """
    Das Heer im Tal. plan = Liste von Bloecken: ('cav', Weg s, Abstand d, Reihen, Rotten[, Gangart]), ('inf', s, d, Reihen,
    Rotten), ('tanks', s, d, Anzahl, Abstand). Alles zieht in Strassenrichtung; update(t) bewegt und wechselt die Phasen.
    The army in the valley. plan = list of blocks: ('cav', distance s, offset d, ranks, files[, gait]), ('inf', s, d,
    ranks, files), ('tanks', s, d, count, spacing). Everything moves along the road; update(t) moves it and switches phases.
    """
    SPEED = {'gallop': 7.2, 'trot': 3.6, 'walk': 1.7, 'march': 1.55, 'tank': 4.2}
    RATE = {'gallop': 2.1, 'trot': 1.5, 'walk': 0.9, 'march': 0.95}

    def __init__(self, shot, plan, cam, seed=5, phases=10, dust=True, atlas=2048, far_from=80.0, near=24.0):
        self.shot = shot
        R = random.Random(seed)
        self.items = []     # (root, s0, d, speed, baked or None)
        self.dust = []
        self.banners = []
        wind = F.Wind((0, 0, -1), strength=0.34, wave=0.1, speed=1.4)
        cav = {}
        AR.shrink_atlas(size=atlas)

        def bucket(s, d):
            # Linienbreite nach Entfernungsklasse (nah, mittel, fern) backen / bake the line width by distance class (near, mid, far)
            x, y = road_xy(s, d)
            dist = math.hypot(x - cam[0], y - cam[1])
            return 14.0 if dist < near else 42.0 if dist < far_from else FAR

        def frames(kit, gait, dist, pose=None, key=None):
            k = (key or kit, gait, dist)
            if k not in cav:
                if dist >= FAR:
                    # fern: aus den mittleren Phasen vereinfacht, ohne Tusche / far: simplified from the mid phases, no ink
                    cav[k] = AR.far_frames(frames(kit, gait, 42.0, pose, key), 0.28)
                else:
                    cav[k] = AR.bake_cavalry(shot, kit, gait, phases, rider=pose, wind=wind, dist=dist, lod=None if dist < 20 else MID_LOD)
            return cav[k]

        horse_scale = AR.WITHERS / (2.46 * L.TILE)
        inf = None
        # zuerst alle Netzsaetze backen (auch die vereinfachten), dann erst die vielen Kopien anlegen: das Vereinfachen
        # wertet die Szene aus und waere mit hunderten Objekten langsam
        # bake all mesh sets first (the simplified ones too), only then create the many copies: simplifying evaluates
        # the scene and would be slow with hundreds of objects
        for blk in sorted((b for b in plan if b[0] == 'cav'), key=lambda b: bucket(b[1], b[2])):
            gait = blk[5] if len(blk) > 5 else 'gallop'
            bd = bucket(blk[1], blk[2])
            frames('fig_korvat_rider', gait, bd, AR.P.RIDE_BANNER, 'bearer')
            for kit in ('fig_korvat_officer', 'fig_korvat_lancer', 'fig_korvat_rider'):
                frames(kit, gait, bd)
        for blk in plan:
            if blk[0] == 'inf' and inf is None:
                inf = AR.bake_infantry(shot, 'fig_korvat_foot', 8, dist=42.0, lod=MID_LOD)
                if bucket(blk[1], blk[2]) >= FAR:
                    inf = (AR.far_frames(inf[0], 0.28), inf[1])
        for blk in plan:
            kind, s0, d0 = blk[0], blk[1], blk[2]
            if kind == 'cav':
                ranks, files = blk[3], blk[4]
                gait = blk[5] if len(blk) > 5 else 'gallop'
                bd = bucket(s0, d0)
                bearer = (R.randrange(0, min(2, ranks)), R.randrange(files))
                for i in range(ranks):
                    for j in range(files):
                        s = s0 - i * R.uniform(3.6, 4.4) + R.uniform(-0.7, 0.7)
                        d = d0 + (j - (files - 1) / 2) * R.uniform(2.2, 2.7) + R.uniform(-0.35, 0.35)
                        is_bearer = (i, j) == bearer
                        if is_bearer:
                            fr = frames('fig_korvat_rider', gait, bd, AR.P.RIDE_BANNER, 'bearer')
                        elif i == 0 and j == files // 2:
                            fr = frames('fig_korvat_officer', gait, bd)
                        else:
                            fr = frames('fig_korvat_lancer' if R.random() < 0.45 else 'fig_korvat_rider', gait, bd)
                        x, y = road_xy(s, d)
                        bk = F.Baked(shot, fr, loc=(x, y, hz(x, y)), rot=UNIT_ROT + R.uniform(-3, 3), scale=horse_scale * R.uniform(0.96, 1.04), name='cav', offset=R.random(), rate=self.RATE[gait])
                        c = R.choice(AR.COATS)
                        if c is not None:
                            AR.coat(shot, bk, c[0], c[1])
                        self.items.append((bk.root, s, d, self.SPEED[gait] * R.uniform(0.97, 1.03), bk))
                        if is_bearer:
                            self._banner(bk, R)
                if dust and bd < FAR:
                    x, y = road_xy(s0 - ranks * 2.0, d0)
                    back = Vector((-RD[0], -RD[1], 0)) * 5.0
                    self.dust.append((Dust(shot, 16, (x, y, hz(x, y)), spread=(files * 1.3, files * 1.3), size=(0.5, 1.1), life=1.6, rise=0.5, back=back, seed=R.randrange(99)), s0 - ranks * 2.0, d0, self.SPEED[gait]))
            elif kind == 'inf':
                ranks, files = blk[3], blk[4]
                for i in range(ranks):
                    for j in range(files):
                        s = s0 - i * 1.5 + R.uniform(-0.08, 0.08)
                        d = d0 + (j - (files - 1) / 2) * 1.15 + R.uniform(-0.06, 0.06)
                        x, y = road_xy(s, d)
                        bk = F.Baked(shot, inf[0], loc=(x, y, hz(x, y)), rot=UNIT_ROT + R.uniform(-2, 2), scale=inf[1] * R.uniform(0.97, 1.03), name='inf', offset=(i * 0.5) % 1.0 + R.uniform(-0.04, 0.04), rate=self.RATE['march'])
                        self.items.append((bk.root, s, d, self.SPEED['march'], bk))
            elif kind == 'tanks':
                count, gap = blk[3], blk[4]
                for i in range(count):
                    s = s0 - i * gap + R.uniform(-0.6, 0.6)
                    d = d0 + R.uniform(-0.25, 0.25)
                    x, y = road_xy(s, d)
                    ob = L.model(shot, 'hulk_tank_korvat', loc=(x, y, hz(x, y)), rot=UNIT_ROT + R.uniform(-2, 2), scale=0.66)
                    self.items.append((ob, s, d, self.SPEED['tank'], None))
                    if dust:
                        back = Vector((-RD[0], -RD[1], 0)) * 3.5
                        self.dust.append((Dust(shot, 7, (x, y, hz(x, y)), spread=(1.2, 1.2), size=(0.5, 1.1), life=1.8, rise=0.6, back=back, seed=R.randrange(99)), s - 3.2, d, self.SPEED['tank']))
                        self.dust.append((Dust(shot, 3, (x, y, hz(x, y)), spread=(0.15, 0.15), size=(0.3, 0.6), life=1.0, rise=1.3, back=back * 0.5, seed=R.randrange(99), color=A.lin(A.cmix('smoke700', 'char800', 0.4))), s - 2.1, d + 0.7, self.SPEED['tank'], 1.9))

    def _banner(self, bk, R):
        """Banner am Reiter: Stange im rechten Steigbuegel / banner on the rider: pole in the right stirrup"""
        wind = F.Wind((-1, 0, 0.12), strength=0.3, wave=0.16, speed=1.5, phase=R.uniform(0, 6))
        if len(self.banners) < 3:
            b = AR.Banner(self.shot, height=3.4, wind=wind)
            self.banners.append(b)
        else:
            b = AR.Banner(self.shot, share=self.banners[R.randrange(3)])
        # Modell (x links, y hoch, z vorn) -> Blender der Figur (x, -z, y) * TILE; das Tuch weht nach hinten
        # model (x left, y up, z front) -> the figure's Blender (x, -z, y) * TILE; the cloth flies backward
        b.root.parent = bk.root
        b.root.location = Vector((-0.5, -0.12, 1.02)) * L.TILE
        b.root.rotation_euler = (math.radians(4), 0, math.radians(-90))
        k = (3.4 / (5.2 * L.TILE)) / bk.root.scale[0]
        b.root.scale = (k, k, k)

    def update(self, t):
        for root, s0, d, v, bk in self.items:
            x, y = road_xy(s0 + v * t, d)
            root.location = Vector((x, y, hz(x, y)))
            if bk is not None:
                bk.update(t)
        for item in self.dust:
            pf, s0, d, v = item[:4]
            x, y = road_xy(s0 + v * t, d)
            pf.origin = Vector((x, y, hz(x, y) + (item[4] if len(item) > 4 else 0.0)))
            pf.update(t)
        for b in self.banners:
            b.update(t)


class Dust:
    """
    Staubfahne hinter Hufen und Ketten: glatte, flache Ballen in zwei Toenen, die am Boden entstehen, nach hinten
    treiben, wachsen und vergehen (schrumpfen). Feine Tusche, wie gemalter Anime-Staub.
    Dust trail behind hooves and tracks: smooth, flat puffs in two tones that form at the ground, drift backward, grow
    and vanish (shrink). Fine ink, like painted anime dust.
    """

    def __init__(self, shot, n, origin, spread=(2.0, 1.0), size=(0.8, 1.8), life=2.0, rise=0.9, back=(0, 0, 0), seed=1, color=None, px=1.1):
        R = random.Random(seed)
        cols = [color or A.lin(A.cmix('dust300', 'steppe300', 0.4)), color or A.lin(A.cmix(A.cmix('dust300', 'steppe300', 0.4), 'paper100', 0.3))]
        self.items = []
        for i in range(n):
            # ohne Tusche (Staub hat keinen Rand), ohne Schattenwurf / no ink (dust has no edge), no cast shadow
            ob = L.prim(shot, 'ico', L.toon(shot, cols[i % 2]), loc=origin, size=1, sub=3, ink=color is not None, px=px / ((size[0] + size[1]) / 2), smooth=True)
            ob.visible_shadow = False
            self.items.append((ob, -life + i * life / n, R.uniform(*size), Vector((R.uniform(-spread[0], spread[0]), R.uniform(-spread[1], spread[1]), 0)), R.uniform(0.8, 1.2), R.uniform(0, 6.28)))
        self.origin, self.life, self.rise, self.back = Vector(origin), life, rise, Vector(back)

    def update(self, t):
        for ob, birth, sz, off, sp, ph in self.items:
            p = ((t - birth) % self.life) / self.life
            k = math.sin(min(1.0, p * 1.5) * math.pi * 0.5) * (1 - L.seg(p, 0.6, 1.0)) * (0.4 + 0.6 * p)
            s = max(sz * k, 0.001)
            ob.scale = (s * 1.3, s * 1.3, s * 0.55)
            ob.location = self.origin + off * (0.4 + 0.8 * p) + self.back * (p * sp) + Vector((0, 0, 0.15 + self.rise * p * sp))
            ob.rotation_euler = (0, 0, ph)


def horizon(shot):
    """Kolchosen und Fabriken am Horizont mit Schloten und Rauchfahnen / collective farms and factories on the horizon with chimneys and plumes"""
    R = random.Random(17)
    for (s, d, sc, name) in ((620, -160, 5, 'kolkhoz_korvat'), (700, -230, 4.5, 'kolkhoz_korvat'), (1150, 240, 7, 'factory_neutral'), (1260, 150, 6.5, 'factory_neutral'),
                             (1040, 420, 6, 'nuclear_neutral'), (1380, -40, 6, 'factory_neutral'), (900, -420, 5, 'factory_neutral')):
        x, y = road_xy(s, d)
        L.model(shot, name, loc=(x, y, hz(x, y)), rot=R.uniform(0, 360), scale=sc)
    plumes = []
    for i, (s, d) in enumerate(((1175, 262), (1195, 250), (1285, 172), (1300, 160), (1400, -20), (1060, 440), (920, -400))):
        x, y = road_xy(s, d)
        z0 = hz(x, y)
        L.model(shot, 'smokestack', loc=(x, y, z0), scale=(11, 11, 17))
        plumes.append(A.Plume(shot, Vector((x, y, z0 + 0.4 * 10 * 17)), A.lin(A.cmix('chimneySmoke', 'sunDusk', 0.35)), n=16, size=(16, 34), rise=55, wind=(-95, 15, 0), seed=31 + i))
    return plumes
