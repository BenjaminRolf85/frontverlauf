"""
Anime-Schnitt, Stilbild Korvat (4-6 s): "Wer die Zukunft produziert, beherrscht sie."
Grossmarschall Ilja Brodnik steht als ganze Figur auf einem Felsen am Rand eines Hoehenzugs der Korvat-Steppe, der
Umhang weht, der linke Arm zeigt nach rechts zum Horizont, wo die Rauchsaeule der Absturzstelle steht. Unter ihm im
Tal die Kornfelder der Kolchosen, darauf seine Armee: eine Panzerkolonne auf der Strasse, Bloecke von Steppenreitern
und Infanterie mit roten Fahnen, alle nach rechts unterwegs. Am Horizont die Schlote der Fabriken. Abendlicht von
rechts, gemalter Himmel mit Wolkenbaenken und Lichtfingern, Dunst in der Ferne. Langsame Kamerafahrt auf ihn zu.
Anime cut, Korvat style frame (4-6 s): "Whoever produces the future rules it."
Grand Marshal Ilja Brodnik stands as a full figure on a rock at the edge of a ridge of the Korvat steppe, the cape
blowing, the left arm pointing right to the horizon where the smoke column of the crash site stands. Below him in the
valley the grain fields of the collective farms, on them his army: a tank column on the road, blocks of steppe riders
and infantry with red flags, all heading right. On the horizon the factory chimneys. Evening light from the right, a
painted sky with cloud banks and crepuscular rays, haze in the distance. A slow camera push towards him.

FV_ANIME_T: Laenge in Sekunden (Standard 5) / length in seconds (default 5).
"""
import math
import os
import random

import numpy as np
from mathutils import Vector

from ... import anime as A
from ... import kit as K
from ... import lib as L

DUR = float(os.environ.get('FV_ANIME_T', '5'))
# Ort der Figur, Kamera, Sonne / place of the figure, camera, sun
LEADER = (-4.0, 44.0)
LEADER_ROT = 32.0
LEADER_SCALE = 0.42
SUN_AZ, SUN_EL = 104.0, 24.0
# Strasse der Panzerkolonne im Tal (Richtung nach rechts und in die Tiefe) / road of the tank column in the valley
ROAD = ((10.0, 120.0), (760.0, 520.0))
AREA = (-700.0, -300.0, 1500.0, 1900.0)
# Kamera: Ort (x, y, Hoehe ueber Grund), Blickziel relativ zur Figur / camera: place, look target relative to the figure
CAM0 = (-19.0, 7.0, 6.5)
AIM = (13.0, 30.0, -3.5)


def ridge_edge(y):
    """x der Kante des Hoehenzugs bei y / x of the ridge's edge at y"""
    return 10.0 + 0.16 * y


def height(x, y):
    """
    Gelaende: links ein Hoehenzug (30 m) mit einer Kante, die nach rechts ins Tal faellt, im Tal flache Wellen.
    Terrain: on the left a ridge (30 m) with an edge that drops right into the valley, gentle waves in the valley.
    """
    e = ridge_edge(y)
    k = 1.0 / (1.0 + math.exp((x - e) / 7.5))
    ridge = 30.0 * k
    # Kuppe am Standort der Figur (Felsnase) / knoll at the figure's place (rock nose)
    knoll = 2.0 * math.exp(-((x - LEADER[0]) ** 2 + (y - LEADER[1]) ** 2) / 260.0)
    rough = 0.7 * math.sin(x * 0.045 + 1.3) * math.cos(y * 0.035) * k + 0.25 * math.sin(x * 0.11 + y * 0.09)
    valley = 3.0 * math.sin(x * 0.006 + 0.5) * math.cos(y * 0.004) + 2.0 * math.sin(y * 0.011 + x * 0.003)
    # Hoehenzug laeuft links in die Tiefe weiter und wird flacher / the ridge runs on into the depth on the left and gets lower
    fade = 1.0 / (1.0 + math.exp((y - 700.0) / 120.0))
    return ridge * (0.45 + 0.55 * fade) + knoll + rough + valley * (1 - k)


def _road_dist(x, y):
    (ax, ay), (bx, by) = ROAD
    dx, dy = bx - ax, by - ay
    t = np.clip(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    px, py = ax + t * dx, ay + t * dy
    # leichte Kurve / slight bend
    py = py + 18 * np.sin(t * math.pi * 1.5)
    return np.hypot(x - px, y - py), t


def paint_fields(n):
    """
    Draufsicht der Kolchosfelder: Streifen in Richtung der Strasse, Weizen, Stoppeln, Gruenland, umgepfluegte Aecker
    mit Furchen; Feldraine und Wege dunkel; Hoehenzug als Steppengras. sRGB, Zeile 0 = Norden (y1).
    Top view of the collective farm fields: strips along the road, wheat, stubble, grassland, ploughed fields with
    furrows; field edges and tracks dark; the ridge as steppe grass. sRGB, row 0 = north (y1).
    """
    x0, y0, x1, y1 = AREA
    xs = np.linspace(x0, x1, n, dtype=np.float32)
    ys = np.linspace(y1, y0, n, dtype=np.float32)
    X, Y = np.meshgrid(xs, ys)
    img = np.zeros((n, n, 3), np.float32)
    # Feldstreifen: entlang der Strassenrichtung / field strips along the road direction
    (ax, ay), (bx, by) = ROAD
    ang = math.atan2(by - ay, bx - ax)
    u = X * math.cos(ang) + Y * math.sin(ang)
    v = -X * math.sin(ang) + Y * math.cos(ang)
    warp = (A.fbm(n, n, n / 14, 11, 3) - 0.5) * 30
    vs = (v + warp) / 70.0
    strip = np.floor(vs)
    R = np.random.default_rng(5)
    offs = R.random(400) * 300
    lens = 120 + R.random(400) * 260
    si = (strip.astype(int) % 400)
    us = (u + offs[si]) / lens[si]
    field = np.floor(us)
    hsh = (np.sin(strip * 12.9898 + field * 78.233) * 43758.5453) % 1.0
    wheat = A.cmix('steppe300', 'yellow400', 0.35)
    wheat2 = A.cmix('steppe300', 'paper300', 0.4)
    stubble = A.cmix('paper300', 'khaki500', 0.45)
    green = A.cmix('olive400', 'grass500', 0.35)
    green2 = A.cmix('olive500', 'steppe500', 0.4)
    plough = A.cmix('soil500', 'mud500', 0.5)
    kinds = [wheat, wheat, wheat2, stubble, green, plough, wheat, green2]
    kk = np.minimum((hsh * len(kinds)).astype(int), len(kinds) - 1)
    for i, c in enumerate(kinds):
        img[kk == i] = c
    # Reihen und Furchen in Laengsrichtung / rows and furrows lengthwise
    rows = 0.5 + 0.5 * np.sin(v * 2 * math.pi / 2.2)
    fu = (kk == 5)
    img[fu] *= (0.82 + 0.18 * rows[fu])[:, None]
    wh = (kk == 0) | (kk == 1) | (kk == 2) | (kk == 6)
    img[wh] *= (0.94 + 0.06 * rows[wh])[:, None]
    # Pinselrauschen / brush noise
    nz = A.fbm(n, n, n / 40, 3, 4)
    img *= (0.9 + 0.2 * nz)[..., None]
    # Raine zwischen den Feldern / edges between the fields
    fv = np.abs(vs - np.round(vs)) * 70.0
    fu_ = np.abs(us - np.round(us)) * lens[si]
    edge = (fv < 1.6) | (fu_ < 1.6)
    img[edge] = img[edge] * 0.55 + A.cmix('track700', 'olive600', 0.5) * 0.45
    # Strasse / road
    d, _ = _road_dist(X, Y)
    img[d < 5.5] = A.cmix('track500', 'dust300', 0.35)
    img[(d >= 5.5) & (d < 7.0)] = A.hexc('track700')
    # Hoehenzug: Steppengras mit Pinselstrichen / ridge: steppe grass with brush strokes
    e = 10.0 + 0.16 * Y
    k = 1.0 / (1.0 + np.exp((X - e + 6) / 5.0))
    grass = A.cmix('steppe300', 'khaki500', 0.5)
    grass_d = A.cmix('steppe500', 'olive400', 0.4)
    strokes = A.fbm(n, n, n / 160, 21, 3)
    gcol = grass[None, None, :] + (grass_d - grass)[None, None, :] * (strokes > 0.52)[..., None]
    gcol *= (0.92 + 0.16 * nz)[..., None]
    img = img * (1 - k[..., None]) + gcol * k[..., None]
    # Felsige Hangkante / rocky slope edge
    slope = np.exp(-((X - e) / 7.0) ** 2) * (A.fbm(n, n, n / 90, 41, 2) > 0.45)
    img = img * (1 - 0.7 * slope[..., None]) + A.cmix('rock400', 'khaki500', 0.4) * 0.7 * slope[..., None]
    return np.clip(img, 0, 1)


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
            # grosse Bank im Gegenlicht ueber der Sonne / big bank in the back light above the sun
            {'at': (58, 7.5), 'w': 34, 'h': 9.5, 'n': 70, 'size': 2.6, 'tone': 1.0, 'peak': 1.3},
            # Turm links, fern / tower on the left, far
            {'at': (-12, 5.0), 'w': 28, 'h': 11, 'n': 55, 'size': 2.6, 'tone': 0.2, 'peak': 1.1},
            {'at': (22, 12.0), 'w': 16, 'h': 5, 'n': 30, 'size': 1.8, 'tone': 0.5, 'peak': 1.4},
            # tiefe Baenke am Horizont / low banks on the horizon
            {'at': (15, 1.0), 'w': 50, 'h': 3, 'n': 40, 'size': 2.2, 'tone': -0.6, 'peak': 2},
        ],
        smoke={'base': (43.0, 0.25), 'height': 13.0, 'lean': -6.0, 'r0': 0.55, 'r1': 3.2,
               'col': (A.cmix('smoke700', 'char800', 0.4), A.cmix('smoke400', 'orange500', 0.3)), 'glow': A.cmix('zyrrViolet', 'flash100', 0.25)},
        land=[
            {'el': 0.15, 'amp': 1.3, 'waves': 5, 'seed': 2, 'col': A.cmix('hazeDusk', 'skyMid', 0.18), 'rim': A.cmix('hazeDusk', 'flash100', 0.5)},
            {'el': -0.2, 'amp': 0.9, 'waves': 9, 'seed': 3, 'col': A.cmix('hazeDusk', 'olive500', 0.25), 'rim': A.cmix('sunDusk', 'flash100', 0.4)},
        ],
    )


def build():
    s = L.Shot(DUR)
    R = random.Random(17)
    # Lichtbaender: warmes Licht, violette Schatten / light bands: warm light, violet shadows
    s.toon.set_light(A.lin(A.cmix('skyMid', 'sky700', 0.3) * 0.45 + A.cmix('sunDusk', 'paper100', 0.5) * 0.55),
                     A.lin(A.cmix('sunDusk', 'skyMid', 0.35)), A.lin(A.cmix('paper50', 'sunDusk', 0.35)))
    rot, sdir = A.sun_rot(SUN_AZ, SUN_EL)
    s.sunlight(rot=tuple(rot))
    L.sky(s, [(-1, 'hazeDusk'), (1, 'sky800')])
    s.cam.data.lens = 35
    s.cam.data.clip_end = 6000

    cam0 = Vector(CAM0[:2] + (height(*CAM0[:2]) + CAM0[2],))
    A.cyclorama(s, sky_spec(), (cam0.x, cam0.y, cam0.z - 30), radius=3800)
    tex = A.painted('fields_korvat', paint_fields, 4096)
    A.terrain(s, height, (AREA[2] - AREA[0], AREA[3] - AREA[1]), (220, 220), tex, AREA, loc=((AREA[0] + AREA[2]) / 2, (AREA[1] + AREA[3]) / 2))

    # Die Figur auf dem Felsen / the figure on the rock
    lz = height(*LEADER)
    body, cape, wind, rk = A.leader_figure(s, 'korvat', (LEADER[0], LEADER[1], lz), LEADER_ROT, LEADER_SCALE, rock_col=A.lin(A.cmix('rock400', 'khaki500', 0.3)))
    # Felsnase unter ihm / rock nose below him
    for i, (dx, dy, sz) in enumerate(((3, 4, 7), (-5, 2, 5), (7, -3, 4), (1, -6, 3.5))):
        A.rock(s, (LEADER[0] + dx, LEADER[1] + dy, lz - sz * 0.35), (sz * 1.3, sz, sz * 0.7), A.lin(A.cmix('rock400', 'khaki500', 0.25 + 0.1 * i)), seed=10 + i)

    # Armee im Tal / the army in the valley
    (ax, ay), (bx, by) = ROAD
    rd = Vector((bx - ax, by - ay)).normalized()
    head = math.degrees(math.atan2(rd.x, rd.y))
    # Einheiten blicken in Fahrtrichtung: Modelle zeigen in Ruhe nach -y / units face the direction of travel: models face -y at rest
    unit_rot = 180.0 - head
    tanks = []
    for i in range(14):
        t = 0.03 + i * 0.045
        p = Vector((ax + (bx - ax) * t, ay + (by - ay) * t + 18 * math.sin(t * math.pi * 1.5)))
        ob = L.model(s, 'tank_korvat', loc=(p.x, p.y, height(p.x, p.y)), rot=unit_rot + R.uniform(-3, 3), scale=2.2)
        tanks.append((ob, t))
    blocks = []
    for (cx, cy, nx, ny, kind, sc) in ((70, 205, 5, 3, 'steppeRider_korvat', 2.0), (165, 300, 6, 3, 'steppeRider_korvat', 2.0),
                                       (215, 180, 6, 4, 'infantry_korvat', 2.0), (300, 360, 6, 4, 'infantry_korvat', 2.0),
                                       (110, 400, 5, 3, 'steppeRider_korvat', 2.0), (380, 250, 4, 2, 'stormbreaker_korvat', 2.2)):
        for j in range(ny):
            for i in range(nx):
                p = Vector((cx, cy)) + Vector((rd.y, -rd.x)) * (i - nx / 2) * 9 + rd * (j * 11 + R.uniform(-1.5, 1.5))
                ob = L.model(s, kind, loc=(p.x, p.y, height(p.x, p.y)), rot=unit_rot + R.uniform(-4, 4), scale=sc)
                blocks.append((ob, Vector(ob.location), R.uniform(0, 6)))
        # Fahnen der Bloecke / the blocks' flags
    flags = []
    for (fx, fy) in ((64, 196), (158, 290), (208, 170), (296, 352), (104, 392), (40, 150), (250, 420)):
        flags.append(K.flag(s, 'korvatRed', (fx, fy, height(fx, fy)), w=9, h=5.5, pole=20, seg=16))
    # Reiter am Hangfuss im Mittelgrund (Groesse gegen die Figur) / riders at the foot of the slope in the mid-ground (scale against the figure)
    near = []
    for i in range(6):
        p = Vector((30 + i * 9.5, 78 + i * 4.0))
        ob = L.model(s, 'steppeRider_korvat', loc=(p.x, p.y, height(p.x, p.y)), rot=unit_rot - 8 + R.uniform(-3, 3), scale=2.0)
        near.append((ob, Vector(ob.location), R.uniform(0, 6)))
    flags.append(K.flag(s, 'korvatRed', (36, 70, height(36, 70)), w=10, h=6, pole=22, seg=16))

    # Kolchose und Fabriken am Horizont / collective farm and factories on the horizon
    for (fx, fy, sc, name) in ((-160, 900, 6, 'kolkhoz_korvat'), (-90, 980, 5, 'kolkhoz_korvat'), (300, 1250, 9, 'factory_neutral'),
                               (420, 1320, 8, 'factory_neutral'), (180, 1350, 7, 'nuclear_neutral'), (560, 1200, 7, 'factory_neutral')):
        L.model(s, name, loc=(fx, fy, height(fx, fy)), rot=R.uniform(0, 360), scale=sc)
    stacks = []
    for (fx, fy) in ((330, 1270), (350, 1262), (440, 1340), (465, 1330), (590, 1215), (200, 1370)):
        z0 = height(fx, fy)
        L.model(s, 'smokestack', loc=(fx, fy, z0), scale=(14, 14, 22))
        stacks.append(Vector((fx, fy, z0 + 0.4 * 10 * 22)))
    smoke = [A.Plume(s, p, A.lin(A.cmix('chimneySmoke', 'sunDusk', 0.35)), n=18, size=(22, 44), rise=70, seed=31 + i) for i, p in enumerate(stacks)]
    dust = []
    for k in range(0, len(tanks), 2):
        ob, t = tanks[k]
        dust.append(L.Puffs(s, 5, 'dust300', ob.location, spread=3, rise=6, size=(3, 7), life=2.5, seed=k, start=-2.5))

    # Gras auf dem Hoehenzug vor der Kamera (nicht unter der Figur) / grass on the ridge in front of the camera (not under the figure)
    def keep(x, y):
        return x < ridge_edge(y) - 4 and math.hypot(x - LEADER[0], y - LEADER[1]) > 3.2 and math.hypot(x - cam0.x, y - cam0.y) > 11
    A.grass(s, height, (cam0.x + 8, cam0.y + 26), 32, 700, (A.lin(A.cmix('steppe500', 'olive400', 0.4)), A.lin(A.cmix('steppe300', 'sunDusk', 0.3))), seed=3, keep=keep, blade=(0.6, 1.5))
    for i in range(14):
        gx, gy = cam0.x + R.uniform(-8, 22), cam0.y + R.uniform(6, 40)
        if keep(gx, gy):
            A.rock(s, (gx, gy, height(gx, gy) - 0.3), R.uniform(0.6, 1.6), A.lin(A.cmix('rock400', 'khaki500', 0.4)), seed=40 + i, sub=2)

    # Luftperspektive und Randlicht / aerial perspective and rim light
    A.haze_all(s, A.cmix('hazeDusk', 'sunDusk', 0.25), start=120.0, dist=900.0, amount=0.75)
    A.rim_units(s, sdir, A.cmix('flash100', 'sunDusk', 0.4), width=0.3)

    target0 = Vector((LEADER[0], LEADER[1], lz + 7.0))

    @s.on
    def update(t):
        wind.update(t)
        for f, wave in flags:
            wave(t, 1.6)
        for ob, base, ph in blocks + near:
            ob.location = base + Vector((0, 0, abs(math.sin(t * 2.2 + ph)) * 0.25))
        for (ob, t0) in tanks:
            tt = t0 + t * 0.0025
            p = Vector((ax + (bx - ax) * tt, ay + (by - ay) * tt + 18 * math.sin(tt * math.pi * 1.5)))
            ob.location = Vector((p.x, p.y, height(p.x, p.y)))
        for i, d in enumerate(dust):
            d.origin = tanks[i * 2][0].location + Vector((-rd.x * 8, -rd.y * 8, 0.5))
            d.update(t)
        for sm in smoke:
            sm.update(t)
        # langsame Fahrt auf ihn zu, leicht steigend / slow push towards him, rising slightly
        p = L.ease_io(L.seg(t, 0, DUR))
        cam = cam0 + (target0 - cam0).normalized() * (5.0 * p) + Vector((0, 0, 0.6 * p))
        tgt = target0 + Vector((AIM[0] - 1.5 * p, AIM[1], AIM[2] + 0.6 * p))
        s.look(cam, tgt)

    update(0)
    return s
