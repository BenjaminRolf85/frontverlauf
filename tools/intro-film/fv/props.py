"""
Welt-Baukasten, Teil Requisiten und Kriegslandschaft: Ruinenmauern mit leeren Fenstern, Gelaende mit Kratern und
Graeben, Stacheldraht, tote Baeume, Schutt, Tankwagen, Schlagbaum, Bronzetor mit Kette, erloschene Laterne, Feuer.
World kit, props and war landscape: ruined walls with empty windows, terrain with craters and trenches, barbed wire,
dead trees, rubble, a tanker truck, a border barrier, a bronze gate with a chain, a dead street lamp, fire.

Lokale Achsen wie in arch.py: Front nach -y, x nach rechts, z oben. / local axes as in arch.py.
"""
import math

import bpy
import numpy as np

from . import anime as A
from . import lib as L
from . import world as W


# ---------- Gelaende / terrain ----------
def war_height(craters=(), trenches=(), amp=1.0, freq=0.03, seed=0, flat=None):
    """
    Hoehenfunktion eines Schlachtfelds: sanfte Wellen, Krater (cx, cy, Radius, Tiefe) mit Randwall, Graeben als
    Linienzuege [(x, y), ...] mit Breite und Tiefe. flat = (y0, y1): dort eben (Standflaeche).
    Height function of a battlefield: gentle swells, craters (cx, cy, radius, depth) with a rim, trenches as polylines
    with width and depth. flat = (y0, y1): level there (standing ground).
    """
    ph = [seed * 1.7 + 0.3, seed * 0.9 + 1.1, seed * 2.3 + 2.0]

    def h(x, y):
        z = amp * (math.sin(x * freq + ph[0]) * math.cos(y * freq * 0.8 + ph[1]) + 0.5 * math.sin((x + y) * freq * 2.3 + ph[2]))
        if flat is not None:
            k = L.clamp((y - flat[0]) / 6.0) * L.clamp((flat[1] - y) / 6.0)
            z *= 1.0 - 0.85 * k
        for cx, cy, r, dep in craters:
            d = math.hypot(x - cx, y - cy)
            if d < r * 1.7:
                if d < r:
                    z -= dep * (1 - (d / r) ** 2) ** 2
                z += 0.3 * dep * math.exp(-((d - r) / (0.28 * r)) ** 2)
        for pts, wd, dep in trenches:
            best = 1e9
            for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
                dx, dy = bx - ax, by - ay
                t = L.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy + 1e-9))
                best = min(best, math.hypot(x - ax - t * dx, y - ay - t * dy))
            if best < wd * 1.6:
                z -= dep * L.clamp(1.5 - best / (wd * 0.6)) if best < wd else 0.0
                z += 0.35 * dep * math.exp(-((best - wd * 1.15) / (0.3 * wd)) ** 2)
        return z
    return h


# ---------- Ruinen / ruins ----------
def ruin_wall(mb, R, length, floors, color, bay=3.6, fh=3.4, thick=0.7, damage=0.5, dark=None, peak=None):
    """
    Ruinenwand entlang x (ab 0): Pfeiler, Bruestungen und Stuerze um leere Fensterhoehlen, nach oben und zu einer Seite
    ausgebrochen; durch die Fenster sieht man den Himmel. peak = Stelle (0..1) der hoechsten erhaltenen Mauer.
    Ruined wall along x (from 0): piers, spandrels and lintels around empty window holes, broken away towards the top
    and one side; the sky shows through the windows. peak = position (0..1) of the highest surviving wall.
    """
    nb = max(1, int(length / bay))
    peak = R.uniform(0.2, 0.8) if peak is None else peak
    dark = color if dark is None else dark
    pw = bay * 0.24
    for i in range(nb):
        u = (i + 0.5) / nb
        keep = floors * max(0.0, 1.0 - damage * 2.2 * abs(u - peak)) + R.uniform(-0.6, 0.6)
        x0, x1 = i * bay, (i + 1) * bay
        for f in range(floors):
            if f + 0.35 > keep:
                # abgebrochene Mauerkrone: Zacken / broken crown: jags
                if f < keep + 0.7:
                    h = fh * R.uniform(0.15, 0.6)
                    mb.box(x0, 0, f * fh, x0 + pw + R.uniform(0, bay * 0.3), thick, f * fh + h, color, g0=1.0, g1=1.0)
                    if R.random() < 0.5:
                        mb.box(x1 - pw, 0, f * fh, x1, thick, f * fh + h * R.uniform(0.4, 1.2), color)
                break
            z0, z1 = f * fh, (f + 1) * fh
            g0, g1 = f / floors, (f + 1) / floors
            mb.box(x0, 0, z0, x0 + pw, thick, z1, color, g0=g0, g1=g1)
            mb.box(x1 - pw, 0, z0, x1, thick, z1, color, g0=g0, g1=g1)
            mb.box(x0 + pw, 0, z0, x1 - pw, thick, z0 + fh * 0.26, color, g0=g0, g1=g0)
            mb.box(x0 + pw, 0, z1 - fh * 0.16, x1 - pw, thick, z1, dark, g0=g1, g1=g1)
    return nb * bay


def rubble(mb, R, x, y, z, n, color, spread=4.0, size=(0.3, 1.2)):
    """Schutt: verkantete Bloecke und Balken / rubble: tilted blocks and beams"""
    for _ in range(n):
        s = R.uniform(*size)
        cx, cy = x + R.normal(0, spread * 0.5), y + R.normal(0, spread * 0.35)
        mb.push(cx, cy, z - s * 0.2, rot=R.uniform(0, 180))
        c = A.hexc(color) * R.uniform(0.75, 1.05) if isinstance(color, str) else np.asarray(color) * R.uniform(0.75, 1.05)
        if R.random() < 0.25:
            mb.box(-s * 1.8, -s * 0.18, 0, s * 1.8, s * 0.18, s * 0.3, c)
        else:
            mb.box(-s * 0.6, -s * 0.45, 0, s * 0.6, s * 0.45, s * R.uniform(0.4, 0.9), c)
        mb.pop()


def dead_tree(mb, R, h=7.0, color=None):
    """Verbrannter Baum: Stamm und wenige Aeste / burnt tree: trunk and a few limbs"""
    c = A.cmix('char800', 'mud700', 0.3) if color is None else color
    top = (R.uniform(-0.5, 0.5), R.uniform(-0.3, 0.3), h)
    mb.ink = 0.6
    mb.tube((0, 0, -0.3), (top[0] * 0.5, top[1] * 0.5, h * 0.55), 0.3, c, n=5, r2=0.2)
    mb.tube((top[0] * 0.5, top[1] * 0.5, h * 0.55), top, 0.2, c, n=5, r2=0.06)
    for k in range(int(R.integers(3, 6))):
        z = h * R.uniform(0.35, 0.85)
        a = R.uniform(0, 6.28)
        ln = h * R.uniform(0.18, 0.38)
        b0 = (top[0] * 0.5 * z / (h * 0.55) if z < h * 0.55 else top[0] * 0.5, 0.0, z)
        b1 = (b0[0] + math.cos(a) * ln, math.sin(a) * ln * 0.5, z + ln * R.uniform(0.3, 0.8))
        mb.tube(b0, b1, 0.1, c, n=4, r2=0.03)
        if R.random() < 0.6:
            mb.tube(b1, (b1[0] + math.cos(a + 0.7) * ln * 0.5, b1[1], b1[2] + ln * 0.4), 0.05, c, n=4, r2=0.02)
    mb.ink = 1.0


def wire_fence(mb, R, pts, h=1.5, color=None, wires=3):
    """Stacheldrahtzaun entlang eines Linienzugs: schiefe Pfosten, durchhaengende Draehte / barbed wire fence along a polyline"""
    c = A.cmix('char800', 'rust', 0.25) if color is None else color
    tops = []
    mb.ink = 0.5
    for (x, y, z) in pts:
        lx, ly = R.uniform(-0.25, 0.25), R.uniform(-0.2, 0.2)
        mb.tube((x, y, z - 0.3), (x + lx, y + ly, z + h), 0.07, c, n=4)
        tops.append(((x, y, z), (x + lx, y + ly, z + h)))
    mb.ink = 0.22
    for (a0, a1), (b0, b1) in zip(tops[:-1], tops[1:]):
        for k in range(wires):
            u = (k + 0.6) / wires
            p = np.array(a0) + (np.array(a1) - np.array(a0)) * u
            q = np.array(b0) + (np.array(b1) - np.array(b0)) * u
            seg = 5
            last = p
            for i in range(1, seg + 1):
                t = i / seg
                cur = p + (q - p) * t + np.array([0, 0, -0.16 * math.sin(math.pi * t) * R.uniform(0.6, 1.4)])
                mb.tube(tuple(last), tuple(cur), 0.022, c, n=4)
                last = cur
    mb.ink = 1.0


# ---------- Fahrzeuge / vehicles ----------
def tanker(mb, color=None, stripe='hazard'):
    """Tankwagen entlang x (Front bei +x), Raeder auf z = 0: Fahrerhaus, Tank mit Warnband, Leiter / tanker truck along x"""
    c = A.cmix('olive600', 'smoke700', 0.4) if color is None else color
    dark = A.cmix('char800', 'ink700', 0.4)
    # Rahmen und Raeder / frame and wheels
    mb.box(-4.6, -0.9, 0.75, 3.9, 0.9, 1.05, dark, bottom=True)
    for wx in (-3.6, -2.3, 2.6):
        for sy in (-1, 1):
            mb.push(wx, sy * 1.05, 0.55, rot=0)
            # Rad als Scheibe quer zur Achse / wheel as a disc across the axle
            ring = [(0.55 * math.cos(t), 0.0, 0.55 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 12, endpoint=False)]
            mb.face([(p[0], sy * 0.18, p[2]) for p in (ring if sy > 0 else ring[::-1])], dark)
            for i in range(12):
                a, b = ring[i], ring[(i + 1) % 12]
                q = [(a[0], -0.18, a[2]), (b[0], -0.18, b[2]), (b[0], 0.18, b[2]), (a[0], 0.18, a[2])]
                mb.face(q, dark, smooth=True)
            mb.pop()
    # Fahrerhaus / cab
    mb.box(2.0, -1.15, 1.05, 3.9, 1.15, 2.2, c, g0=0.6, g1=1.0)
    mb.box(2.0, -1.1, 2.2, 3.3, 1.1, 3.15, c, top=A.hexc(c) * 0.8 if isinstance(c, str) else np.asarray(c) * 0.8)
    mb.face([(3.32, -0.95, 2.3), (3.32, 0.95, 2.3), (3.32, 0.95, 3.0), (3.32, -0.95, 3.0)], A.cmix('sky800', 'smoke400', 0.3))
    for sy in (-1, 1):
        q = [(2.2, sy * 1.12, 2.35), (3.1, sy * 1.12, 2.35), (3.1, sy * 1.12, 3.0), (2.2, sy * 1.12, 3.0)]
        mb.face(q if sy < 0 else q[::-1], A.cmix('sky800', 'smoke400', 0.3))
    # Tank: liegender Zylinder mit gewoelbten Boeden / tank: lying cylinder with domed ends
    n = 14
    xs = [(-4.75, 0.55), (-4.45, 1.12), (-3.6, 1.3), (0.9, 1.3), (1.55, 1.12), (1.8, 0.55)]
    for (xa, ra), (xb, rb) in zip(xs[:-1], xs[1:]):
        cc = c
        for i in range(n):
            ta, tb = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            q = [(xa, math.cos(ta) * ra, 2.35 + math.sin(ta) * ra), (xa, math.cos(tb) * ra, 2.35 + math.sin(tb) * ra),
                 (xb, math.cos(tb) * rb, 2.35 + math.sin(tb) * rb), (xb, math.cos(ta) * rb, 2.35 + math.sin(ta) * rb)]
            mb.face(q[::-1], cc, smooth=True)
    for xa in (-2.9, -0.2):
        for i in range(n):
            ta, tb = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            r = 1.33
            q = [(xa, math.cos(ta) * r, 2.35 + math.sin(ta) * r), (xa, math.cos(tb) * r, 2.35 + math.sin(tb) * r),
                 (xa + 0.55, math.cos(tb) * r, 2.35 + math.sin(tb) * r), (xa + 0.55, math.cos(ta) * r, 2.35 + math.sin(ta) * r)]
            mb.face(q[::-1], stripe, smooth=True)
    mb.cyl(-1.4, 0, 3.6, 0.35, 0.3, dark, n=8)
    mb.ink = 0.4
    for sy in (-0.25, 0.25):
        mb.tube((-4.7, sy, 0.9), (-4.7, sy, 3.5), 0.04, dark, n=4)
    mb.ink = 1.0


def barrier(mb_post, mb_boom, length=9.0, color='paper50', stripe='red500'):
    """
    Schlagbaum: Pfosten mit Gegengewicht und Auflagegabel (mb_post), Baum mit Warnstreifen und haengender Kette
    (mb_boom, Drehpunkt im Ursprung, Baum entlang +x). Rueckgabe: Abstand der Gabel.
    Border barrier: post with a counterweight and a rest fork (mb_post), boom with warning stripes and a hanging chain
    (mb_boom, pivot at the origin, boom along +x). Returns the fork's distance.
    """
    steel, dark = A.cmix('smoke700', 'ink700', 0.3), A.cmix('char800', 'ink800', 0.4)
    # Pfosten am Drehpunkt (Ursprung in 1,15 m Hoehe) / post at the pivot (origin at 1.15 m height)
    mb_post.box(-0.32, -0.45, -1.15, 0.32, -0.16, 0.35, steel, g0=0.3, g1=1.0)
    mb_post.box(-0.32, 0.16, -1.15, 0.32, 0.45, 0.35, steel, g0=0.3, g1=1.0)
    mb_post.box(-0.5, -0.6, -1.15, 0.5, 0.6, -0.95, dark)
    mb_post.tube((0, -0.5, 0), (0, 0.5, 0), 0.09, dark, n=8)
    # Gabel / fork
    fx = length - 0.5
    mb_post.box(fx - 0.14, -0.14, -1.15, fx + 0.14, 0.14, -0.2, steel, g0=0.3, g1=1.0)
    mb_post.box(fx - 0.14, -0.36, -0.2, fx + 0.14, -0.2, 0.34, steel)
    mb_post.box(fx - 0.14, 0.2, -0.2, fx + 0.14, 0.36, 0.34, steel)
    mb_post.box(fx - 0.14, -0.36, -0.32, fx + 0.14, 0.36, -0.2, steel)
    # Baum: Streifen / boom: stripes
    n = 9
    for i in range(n):
        x0, x1 = -0.2 + i * (length + 0.2) / n, -0.2 + (i + 1) * (length + 0.2) / n
        mb_boom.box(x0, -0.11, -0.11, x1, 0.11, 0.11, stripe if i % 2 else color, bottom=True, sides='ns' + ('e' if i == n - 1 else '') + ('w' if i == 0 else ''))
    mb_boom.box(-1.7, -0.13, -0.13, -0.2, 0.13, 0.13, steel, bottom=True)
    mb_boom.box(-1.9, -0.3, -0.42, -1.1, 0.3, 0.3, dark, bottom=True)
    # runde Sperrscheibe / round stop sign
    cx = length * 0.5
    ring = [(cx + 0.42 * math.cos(t), -0.14, -0.62 + 0.42 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
    mb_boom.face(ring, 'red500')
    mb_boom.face([(cx - 0.3, -0.16, -0.68), (cx + 0.3, -0.16, -0.68), (cx + 0.3, -0.16, -0.56), (cx - 0.3, -0.16, -0.56)], 'paper50')
    mb_boom.tube((cx, 0, -0.1), (cx, 0, -0.25), 0.03, dark, n=4)
    return fx


def chain(mb, pts, r=0.07, color=None, link=0.2):
    """Kette entlang eines Linienzugs: abwechselnd gedrehte Glieder / chain along a polyline: links alternately turned"""
    from mathutils import Vector
    c = A.cmix('smoke700', 'ink700', 0.5) if color is None else color
    k = 0
    for a, b in zip(pts[:-1], pts[1:]):
        a, b = Vector(a), Vector(b)
        d = b - a
        n = max(1, int(d.length / link))
        ax = d.normalized()
        side = ax.cross(Vector((0, 1, 0)))
        side = side.normalized() if side.length > 1e-3 else Vector((1, 0, 0))
        up = ax.cross(side)
        for i in range(n):
            p0, p1 = a + d * (i / n), a + d * ((i + 1) / n)
            w = (side if k % 2 == 0 else up) * r
            mb.tube(tuple(p0 + w), tuple(p1 + w), r * 0.34, c, n=4)
            mb.tube(tuple(p0 - w), tuple(p1 - w), r * 0.34, c, n=4)
            k += 1


def bronze_gate(mb, w=10.4, h=13.0, color=None, depth=1.6):
    """
    Bronzetor in einer Rundbogennische: zwei Fluegel mit Kassetten, Buckeln, Mittelstoss; davor ein Gitter aus Staeben.
    Ursprung unten Mitte, Front nach -y. / bronze gate in a round-arched niche: two leaves with coffers, bosses, a centre
    joint; a grille of bars in front. Origin bottom centre, front towards -y.
    """
    c = A.cmix('goldDark', 'ink700', 0.55) if color is None else color
    lit, dk = A.cmix('goldDark', 'paper300', 0.2), A.cmix('goldDark', 'ink800', 0.75)
    r = w / 2
    sp = h - r
    # Rueckwand der Nische (Fluegel) / back of the niche (leaves)
    arc = [(-r, depth, 0), (r, depth, 0)] + [(r * math.cos(t), depth, sp + r * math.sin(t)) for t in np.linspace(0, math.pi, 13)]
    mb.face(arc, c)
    mb.box(-0.09, depth - 0.12, 0, 0.09, depth, h - 0.2, dk, cap=False)
    for sx in (-1, 1):
        for row in range(4):
            z0 = 0.5 + row * (sp - 0.2) / 4
            z1 = z0 + (sp - 0.2) / 4 - 0.45
            for col_ in range(2):
                x0 = sx * (0.45 + col_ * (r - 0.6) / 2)
                x1 = sx * (0.45 + (col_ + 1) * (r - 0.6) / 2 - 0.35)
                xa, xb = min(x0, x1), max(x0, x1)
                mb.box(xa, depth - 0.16, z0, xb, depth, z1, lit, cap=False, bottom=False)
                mb.box(xa + 0.22, depth - 0.24, z0 + 0.22, xb - 0.22, depth - 0.16, z1 - 0.22, c)
                mb.cbox((xa + xb) / 2, depth - 0.3, (z0 + z1) / 2 - 0.12, 0.24, 0.12, 0.24, lit)
    # Gitter / grille
    mb.ink = 0.5
    bars = 11
    for i in range(bars):
        x = -r + 0.45 + i * (w - 0.9) / (bars - 1)
        top = sp + math.sqrt(max(0.0, r * r - x * x)) - 0.25
        mb.tube((x, 0.25, 0), (x, 0.25, top), 0.085, dk, n=6)
        mb.revolve(x, 0.25, [(0.0, top), (0.16, top + 0.25), (0.0, top + 0.7)], dk, n=4, smooth=False)
    for z in (1.1, sp * 0.52, sp):
        half = r - 0.25 if z <= sp else r * 0.8
        mb.tube((-half, 0.25, z), (half, 0.25, z), 0.1, dk, n=6)
    mb.ink = 1.0
    return {'chain': [(-1.6, 0.05, 5.2), (-0.7, 0.0, 4.5), (0.0, -0.05, 4.2), (0.8, 0.0, 4.6), (1.7, 0.05, 5.3)], 'lock': (0.0, -0.12, 3.6)}


def dead_lamp(mb, pal, h=6.6, arm=1.2, size=1.0, tilt=0.0):
    """Erloschene Laterne: gusseiserner Mast mit Sockel, Ausleger, dunkles Glas / dead street lamp: cast-iron post, arm, dark glass"""
    dk = A.cmix('char800', 'sky900', 0.5)
    mb.cyl(0, 0, 0, 0.26 * size, 0.9 * size, dk, n=8, r2=0.16 * size)
    mb.tube((0, 0, 0.9 * size), (tilt, 0, h), 0.085 * size, dk, n=6, r2=0.06 * size)
    mb.ink = 0.5
    mb.tube((tilt, 0, h), (tilt + arm, 0, h + 0.5), 0.05 * size, dk, n=4)
    mb.tube((tilt, 0, h - 1.0), (tilt + arm * 0.7, 0, h + 0.3), 0.03 * size, dk, n=4)
    mb.ink = 1.0
    lx = tilt + arm
    mb.revolve(lx, 0, [(0.12 * size, h - 0.45), (0.3 * size, h - 0.25), (0.34 * size, h + 0.3), (0.0, h + 0.62)], A.cmix('sky800', 'smoke700', 0.5), n=6, smooth=False)
    mb.revolve(lx, 0, [(0.42 * size, h + 0.3), (0.0, h + 0.75)], dk, n=6, smooth=False)
    return (lx, 0.0, h)


# ---------- Feuer / fire ----------
def flame_atlas(name='flames', n=4, size=(128, 192)):
    """
    Gezeichnete Flammen: Tropfenform mit zuengelndem Rand, drei flache Toene (Spitze rot, Mitte orange, Kern gelb).
    Drawn flames: a teardrop with a licking edge, three flat tones (tip red, middle orange, core yellow).
    """
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    X, Y = (xx + 0.5) / w - 0.5, 1 - (yy + 0.5) / h
    out = []
    for k in range(n):
        R = np.random.default_rng(31 + k)
        ph = R.uniform(0, 6.28, 3)
        wob = 0.05 * np.sin(Y * 9 + ph[0]) + 0.03 * np.sin(Y * 17 + ph[1])
        lean = R.uniform(-0.12, 0.12) * Y * Y
        # Breite nach Hoehe: unten rund, oben spitz / width by height: round below, pointed above
        prof = 0.36 * np.sin(np.clip(Y, 0, 1) ** 0.6 * math.pi) ** 0.8 * (1 - 0.35 * Y)
        d = prof - np.abs(X - wob - lean)
        img = np.zeros((h, w, 4), np.float32)
        for col_, sc in (('flameTip', 1.0), ('flame', 0.66), ('flameCore', 0.36)):
            dd = prof * sc - np.abs(X - wob * sc - lean) - (1 - sc) * 0.02
            m = np.clip(dd * w / 1.4 + 0.5, 0, 1) * (Y < 0.98 * (0.55 + 0.45 * sc)) * (Y > 0.02)
            c = A.hexc(col_)
            img[..., :3] = img[..., :3] * (1 - m[..., None]) + c * m[..., None]
            img[..., 3] = np.maximum(img[..., 3], m)
        out.append(img)
    return W.image(name, np.concatenate(out, 1)), [(i / n + 0.004, 0.0, (i + 1) / n - 0.004, 1.0) for i in range(n)]


class Fire:
    """
    Feuer aus gezeichneten Flammenkarten, die zuengeln (wachsen, steigen, wechseln), dazu ein Lichthof.
    Fire of drawn flame cards that lick (grow, rise, alternate), plus a halo.
    """

    def __init__(self, shot, name, origin, width=4.0, height=5.0, n=9, seed=1, halo=None):
        img, uvs = flame_atlas()
        R = np.random.default_rng(seed)
        self.shot, self.n = shot, n
        self.origin, self.w, self.h = np.array(origin, np.float64), width, height
        self.ph = R.uniform(0, 1, n)
        self.rate = R.uniform(1.3, 2.4, n)
        self.x = R.uniform(-0.5, 0.5, n)
        self.sz = R.uniform(0.55, 1.0, n)
        me = bpy.data.meshes.new(name)
        me.from_pydata([(0, 0, 0)] * (4 * n), [], [(4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3) for i in range(n)])
        uv = me.uv_layers.new(name='UVMap')
        uvl = []
        for i in range(n):
            u0, v0, u1, v1 = uvs[i % len(uvs)]
            if R.random() < 0.5:
                u0, u1 = u1, u0
            uvl += [u0, v0, u1, v0, u1, v1, u0, v1]
        uv.data.foreach_set('uv', np.asarray(uvl, np.float32))
        me.materials.append(W.sprite_mat('flames', tex=img, keep=0.7))
        self.me = me
        self.ob = bpy.data.objects.new(name, me)
        shot.sc.collection.objects.link(self.ob)
        self.ob.visible_shadow = False

    def update(self, t):
        n = self.n
        M = self.shot.cam.matrix_world
        right = np.array(M.col[0][:3])
        p = (self.ph + t * self.rate) % 1.0
        # jede Flamme waechst rasch, steigt und reisst ab / each flame grows quickly, rises and breaks off
        hh = self.h * self.sz * (0.45 + 0.75 * np.sin(np.clip(p * 1.15, 0, 1) * math.pi) ** 0.7)
        ww = self.w * 0.3 * self.sz * (1.0 - 0.3 * p)
        pos = self.origin + np.outer(self.x * self.w, right) + np.outer(p * self.h * 0.12, [0, 0, 1.0])
        v = np.empty((n, 4, 3))
        v[:, 0] = pos - np.outer(ww, right)
        v[:, 1] = pos + np.outer(ww, right)
        v[:, 2] = pos + np.outer(ww, right) + np.outer(hh, [0, 0, 1.0])
        v[:, 3] = pos - np.outer(ww, right) + np.outer(hh, [0, 0, 1.0])
        self.me.vertices.foreach_set('co', v.ravel())
        self.me.update()
