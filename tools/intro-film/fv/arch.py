"""
Welt-Baukasten, Teil Architektur: Bauwerke, die auf Filmentfernung als Ort lesbar sind. Alles wird in einen Netzbauer
(world.MeshB) gesetzt: Haeuserblock, Turm, Lagerhaus, die grosse Bank (Saeulen, Giebel, Kuppel, Emblem), Leuchtturm,
Hafenkran, Bogenbruecke, Kai, Frachter, Segelschiff, Laternen. Varianten kommen aus einem Zufallsgenerator je Bauwerk
(Breite, Geschosse, Fassadenstil, Dachform, Aufbauten), damit eine Silhouette keine sichtbare Wiederholung hat.
World kit, architecture: buildings that read as a place at film distance. Everything is put into a mesh builder
(world.MeshB): city block, tower, warehouse, the grand bank (columns, pediment, dome, emblem), lighthouse, harbour
crane, arch bridge, quay, freighter, sailing ship, street lamps. Variants come from a random generator per building
(width, storeys, facade style, roof shape, roof clutter) so a skyline has no repeats that show.

Lokale Achsen eines Bauwerks: Front nach -y, x nach rechts, z nach oben, Fuss bei z = 0.
Local axes of a building: front towards -y, x to the right, z up, base at z = 0.
"""
import math

import numpy as np

from . import anime as A
from . import scenery as S
from . import world as W

MAT = S.MAT


class Palette:
    """Farben eines Ortes (Tokens und Mischungen) / colours of a place (tokens and mixes)"""

    def __init__(self, walls, roofs, trim, accents, dark='ink700', metal='smoke700', lamp='window300'):
        self.walls, self.roofs, self.trim, self.accents, self.dark, self.metal, self.lamp = walls, roofs, trim, accents, dark, metal, lamp


def meridon_palette():
    """Meridon: Elfenbein, Sandstein, Kupfergruen, Ziegel; Akzente in den Fraktionsfarben / ivory, sandstone, copper green, tile"""
    c = A.cmix
    return Palette(
        walls=[c('paper50', 'paper100', 0.5), c('paper100', 'paper200', 0.4), c('paper200', 'sunDusk', 0.25), c('paper100', 'rock400', 0.3),
               c('sand300', 'paper50', 0.5), c('paper200', 'meridonTeal', 0.14), c('verdanWhite', 'paper200', 0.3), c('paper300', 'paper100', 0.4),
               c('paper100', 'meridonOrange', 0.16)],
        roofs=[c('meridonTeal', 'ink700', 0.42), c('meridonOrange', 'mud500', 0.55), c('smoke700', 'sky700', 0.3), c('rust', 'mud700', 0.3),
               c('teal500', 'smoke700', 0.5)],
        trim=c('paper50', 'white', 0.3), accents=['meridonTeal', 'meridonOrange', 'yellow400', 'red700'],
        dark=c('ink700', 'sky800', 0.4), metal=c('smoke700', 'ink700', 0.3))


def _dk(c, k):
    """Farbe abdunkeln (sRGB) / darken a colour (sRGB)"""
    return np.asarray(A.hexc(c) if isinstance(c, str) else c, np.float32) * k


# ---------- Dachaufbauten / roof clutter ----------
def _clutter(mb, R, x0, y0, x1, y1, z, pal, n=3):
    for _ in range(n):
        k = R.integers(0, 5)
        cx, cy = R.uniform(x0 + 1.5, x1 - 1.5), R.uniform(y0 + 1.5, y1 - 1.5)
        if k == 0:
            # Wassertank auf Beinen / water tank on legs
            r = R.uniform(1.1, 1.7)
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                mb.tube((cx + dx * r * 0.6, cy + dy * r * 0.6, z), (cx + dx * r * 0.6, cy + dy * r * 0.6, z + 1.6), 0.12, pal.dark, n=4)
            mb.cyl(cx, cy, z + 1.6, r, r * 1.5, R.choice(pal.roofs), n=10)
            mb.revolve(cx, cy, [(r * 1.08, z + 1.6 + r * 1.5), (0.0, z + 1.6 + r * 2.0)], pal.dark, n=10)
        elif k == 1:
            # Treppenhaus / stair hut
            mb.cbox(cx, cy, z, R.uniform(2.4, 3.6), R.uniform(2.4, 3.2), R.uniform(2.2, 2.8), pal.trim, top=pal.dark)
        elif k == 2:
            # Schornsteine / chimneys
            for i in range(R.integers(1, 4)):
                mb.cbox(cx + i * 1.1, cy, z, 0.8, 0.8, R.uniform(1.6, 2.6), R.choice(pal.roofs), top=pal.dark)
        elif k == 3:
            # Oberlicht / skylight
            w = R.uniform(2.5, 4.5)
            mb.gable(cx - w / 2, cy - 1.0, cx + w / 2, cy + 1.0, z, 0.9, pal.metal)
        else:
            # Antenne / aerial
            h = R.uniform(3.5, 7.0)
            mb.tube((cx, cy, z), (cx, cy, z + h), 0.09, pal.dark, n=4)
            mb.tube((cx - 0.9, cy, z + h * 0.8), (cx + 0.9, cy, z + h * 0.8), 0.06, pal.dark, n=4)


def block(mb, R, w, d, floors, pal, style=None, roof=None, ground='shop', fh=3.5, lit=0.5, wall=None):
    """
    Stadthaus: Sockelgeschoss (Laeden oder Bogen), Gurtgesims, Fassade im Stil, Kranzgesims, Dach (flach mit Aufbauten,
    Sattel, Mansarde mit Gauben, Walm). Rueckgabe: Hoehe bis zur Traufe.
    Town house: ground storey (shops or arches), belt cornice, facade in a style, main cornice, roof (flat with clutter,
    gable, mansard with dormers, hip). Returns the height to the eaves.
    """
    style = style or R.choice(['res', 'res', 'res', 'grand', 'office'])
    roof = roof or R.choice(['flat', 'flat', 'gable', 'mansard', 'mansard', 'hip'])
    wall = wall if wall is not None else pal.walls[R.integers(0, len(pal.walls))]
    rc = pal.roofs[R.integers(0, len(pal.roofs))]
    uo = int(R.integers(0, 400)) * 2
    bay = {'res': 3.3, 'grand': 4.4, 'office': 4.0, 'ware': 4.6, 'slit': 3.2, 'glass': 3.6, 'plain': 5.0}[style]
    gh = fh * 1.3
    x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2
    H = gh + 0.5 + floors * fh
    gd = _dk(wall, 0.86)
    mb.box(x0, y0, 0, x1, y1, gh, gd, mat=MAT[ground], bay=4.2, floor=gh, uo=uo + 7, g0=0.0, g1=gh / H, dens=min(1.0, lit * 1.6), cap=False)
    mb.box(x0 - 0.35, y0 - 0.35, gh, x1 + 0.35, y1 + 0.35, gh + 0.5, pal.trim, g0=0.4, g1=0.4, bottom=True)
    mb.box(x0, y0, gh + 0.5, x1, y1, H, wall, mat=MAT[style], bay=bay, floor=fh, uo=uo, g0=gh / H, g1=1.0, dens=lit, cap=False)
    mb.box(x0 - 0.6, y0 - 0.6, H, x1 + 0.6, y1 + 0.6, H + 0.75, pal.trim, bottom=True)
    z = H + 0.75
    if roof == 'flat':
        mb.box(x0 - 0.2, y0 - 0.2, z, x1 + 0.2, y1 + 0.2, z + 0.9, wall, top=_dk(rc, 0.8))
        mb.box(x0 + 0.5, y0 + 0.5, z + 0.9, x1 - 0.5, y1 - 0.5, z + 0.92, _dk(rc, 0.8), sides='')
        _clutter(mb, R, x0, y0, x1, y1, z + 0.9, pal, n=int(R.integers(2, 5)))
        top = z + 0.9
    elif roof == 'gable':
        rh = min(w, d) * R.uniform(0.28, 0.4)
        mb.gable(x0, y0, x1, y1, z, rh, rc, wall=wall, axis='x' if w >= d else 'y', over=0.5)
        for i in range(R.integers(1, 3)):
            cx = R.uniform(x0 + 2, x1 - 2)
            mb.cbox(cx, R.uniform(y0 + 2, y1 - 2), z, 1.0, 1.0, rh + R.uniform(0.6, 1.6), _dk(rc, 0.9), top=pal.dark)
        top = z + rh
    elif roof == 'mansard':
        rh = fh * 0.95
        mb.frustum(x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3, z, rh, 1.5, rc, top=_dk(rc, 0.75))
        # Gauben mit Fenster / dormers with a window
        nb = max(1, int(w / 5.0))
        for i in range(nb):
            cx = x0 + (i + 0.5) * w / nb
            for sy, key in ((y0 + 0.5, 's'), (y1 - 0.5, 'n')):
                mb.box(cx - 0.9, sy - 0.7, z + 0.3, cx + 0.9, sy + 0.7, z + rh * 0.82, pal.trim, top=_dk(rc, 0.75))
                yy = sy - 0.72 if key == 's' else sy + 0.72
                pts = [(cx - 0.55, yy, z + 0.7), (cx + 0.55, yy, z + 0.7), (cx + 0.55, yy, z + rh * 0.72), (cx - 0.55, yy, z + rh * 0.72)]
                on = R.random() < lit
                mb.face(pts if key == 's' else pts[::-1], pal.lamp if on else pal.dark, emit=1.0 if on else 0.0)
        _clutter(mb, R, x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5, z + rh, pal, n=int(R.integers(1, 3)))
        top = z + rh
    else:
        rh = min(w, d) * 0.3
        mb.frustum(x0 - 0.4, y0 - 0.4, x1 + 0.4, y1 + 0.4, z, rh, min(w, d) * 0.42, rc, top=_dk(rc, 0.8))
        top = z + rh
    return top


def tower(mb, R, w, floors, pal, crown=None, fh=3.6, lit=0.5, style=None):
    """Turm aus Stufen mit Gesimsen und Krone (Helm, Kuppel, Uhr, Mast) / tower of setbacks with cornices and a crown"""
    crown = crown or R.choice(['spire', 'dome', 'spire', 'mast', 'spire', 'dome', 'clock'])
    wall = pal.walls[R.integers(0, len(pal.walls))]
    rc = pal.roofs[R.integers(0, len(pal.roofs))]
    style = style or R.choice(['slit', 'office', 'grand', 'res'])
    uo = int(R.integers(0, 400)) * 2
    z = 0.0
    H = floors * fh
    steps = [(1.0, 0.55), (0.78, 0.3), (0.58, 0.15)]
    for k, (s, share) in enumerate(steps):
        h = max(fh, round(H * share / fh) * fh)
        a = w * s / 2
        mb.box(-a, -a, z, a, a, z + h, wall, mat=MAT[style if k < 2 else 'slit'], bay=3.4 if style != 'grand' else 4.2, floor=fh, uo=uo + k * 13,
               g0=z / H, g1=min(1.0, (z + h) / H), dens=lit, cap=False)
        z += h
        mb.box(-a - 0.5, -a - 0.5, z, a + 0.5, a + 0.5, z + 0.7, pal.trim, bottom=True)
        z += 0.7
    a = w * steps[-1][0] / 2
    if crown == 'spire':
        mb.revolve(0, 0, [(a * 1.25, z), (a * 0.5, z + a * 1.6), (0.0, z + a * 5.0)], rc, n=4, smooth=False, a0=45, a1=405)
        mb.tube((0, 0, z + a * 5.0), (0, 0, z + a * 5.0 + 3.0), 0.12, 'gold', n=4)
        z += a * 5 + 3
    elif crown == 'dome':
        prof = [(a * 1.05 * math.cos(t), z + a * 1.2 * math.sin(t)) for t in np.linspace(0, math.pi / 2, 6)]
        mb.revolve(0, 0, prof, rc, n=12)
        mb.cyl(0, 0, z + a * 1.2, a * 0.22, a * 0.7, pal.trim, n=8)
        mb.revolve(0, 0, [(a * 0.3, z + a * 1.9), (0, z + a * 2.6)], 'gold', n=8)
        z += a * 2.6
    elif crown == 'clock':
        mb.box(-a, -a, z, a, a, z + a * 1.8, pal.trim, cap=True)
        for ang in (0, 90, 180, 270):
            mb.push(rot=ang)
            cz = z + a * 0.9
            pts = [(a * 0.5 * math.cos(t), -a - 0.06, cz + a * 0.5 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 14, endpoint=False)]
            mb.face(pts, A.cmix('window300', 'paper50', 0.5), emit=1.0)
            mb.pop()
        mb.revolve(0, 0, [(a * 1.3, z + a * 1.8), (0.0, z + a * 3.6)], rc, n=4, smooth=False, a0=45, a1=405)
        z += a * 3.6
    else:
        mb.box(-a * 0.7, -a * 0.7, z, a * 0.7, a * 0.7, z + 2.2, pal.metal)
        mb.tube((0, 0, z + 2.2), (0, 0, z + 2.2 + w * 1.4), 0.2, pal.dark, n=4, r2=0.05)
        mb.cbox(0, 0, z + 2.2 + w * 1.4, 0.5, 0.5, 0.5, 'red500', emit=1.0)
        z += 2.2 + w * 1.4
    return z


def warehouse(mb, R, w, d, pal, h=9.0, sign=None, lit=0.3):
    """Lagerhaus: langer Ziegelbau mit Satteldach, Toren, Schildband / warehouse: long brick shed with a gable roof, doors, a sign band"""
    wall = A.cmix(R.choice(['rust', 'mud500', 'paper300']), 'paper200', R.uniform(0.25, 0.55))
    rc = pal.roofs[R.integers(0, len(pal.roofs))]
    uo = int(R.integers(0, 400)) * 2
    x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2
    mb.box(x0, y0, 0, x1, y1, h, wall, mat=MAT['ware'], bay=4.6, floor=h / 2, uo=uo, g0=0.0, g1=1.0, dens=lit, cap=False)
    mb.box(x0 - 0.4, y0 - 0.4, h, x1 + 0.4, y1 + 0.4, h + 0.5, pal.trim, bottom=True)
    rh = d * 0.26
    mb.gable(x0, y0, x1, y1, h + 0.5, rh, rc, wall=wall, axis='x', over=0.8)
    # Dachreiter mit Oberlichtband / roof monitor with a skylight band
    mb.box(x0 + w * 0.12, -1.6, h + 0.5 + rh * 0.55, x1 - w * 0.12, 1.6, h + 0.5 + rh + 0.9, pal.lamp, emit=0.0, top=_dk(rc, 0.8))
    # Tore / doors
    nd = max(1, int(w / 14))
    for i in range(nd):
        cx = x0 + (i + 0.5) * w / nd
        mb.face([(cx - 2.6, y0 - 0.08, 0), (cx + 2.6, y0 - 0.08, 0), (cx + 2.6, y0 - 0.08, 5.2), (cx - 2.6, y0 - 0.08, 5.2)], pal.dark)
        mb.face([(cx - 2.6, y0 - 0.1, 5.2), (cx + 2.6, y0 - 0.1, 5.2), (cx + 2.6, y0 - 0.1, 5.6), (cx - 2.6, y0 - 0.1, 5.6)], pal.trim)
    if sign is not None:
        mb.face([(x0 + w * 0.2, y0 - 0.1, h - 2.6), (x1 - w * 0.2, y0 - 0.1, h - 2.6), (x1 - w * 0.2, y0 - 0.1, h - 0.6), (x0 + w * 0.2, y0 - 0.1, h - 0.6)], sign)
    return h + 0.5 + rh


# ---------- Die grosse Bank / the grand bank ----------
BANK_W, BANK_D = 104.0, 62.0


def bank(mb, pal, lit=0.85, cols=10, gate='shut'):
    """
    Die grosse Bank Meridons: Freitreppe, Saeulenhalle mit Gebaelk, Giebel mit dem Emblem der Republik, Seitenfluegel
    mit Balkon, Attika, Tambour mit Lichtkranz, Kupferkuppel mit Laterne. Rueckgabe: wichtige Punkte (lokal).
    Meridon's grand bank: open stairs, colonnade with an entablature, a pediment with the republic's emblem, side wings
    with a balcony, attic, drum with a ring of lights, copper dome with a lantern. Returns key points (local).
    """
    stone, stone2, trim = A.cmix('paper50', 'paper100', 0.6), A.cmix('paper100', 'paper200', 0.6), pal.trim
    copper, gold = A.cmix('meridonTeal', 'paper100', 0.12), A.cmix('gold', 'goldDark', 0.3)
    teal = A.hexc('meridonTeal')
    hw = BANK_W / 2
    pw = 31.0      # halbe Breite der Saeulenhalle / half width of the portico
    base = 5.0     # Sockelhoehe / podium height
    fy = -BANK_D / 2  # Front der Fluegel / front of the wings
    py = fy - 9.0  # Saeulenreihe / column row
    mb.dens = lit
    # Sockel und Freitreppe / podium and open stairs
    mb.box(-hw - 3, fy - 2, 0, hw + 3, BANK_D / 2 + 2, base, stone2, mat=MAT['plain'], bay=6, floor=base, g0=0.0, g1=0.12)
    nst = 10
    for i in range(nst):
        z1 = base * (nst - i) / nst
        mb.box(-pw - 2 + i * 0.0, py - 3 - (i + 1) * 1.15, 0, pw + 2, py - 3 - i * 1.15, z1, stone if i % 2 else stone2, g0=0.05, g1=0.1)
    mb.box(-pw - 2, py - 3, 0, pw + 2, fy, base, stone, g0=0.05, g1=0.12)
    for sx in (-1, 1):
        # Treppenwangen mit Leuchtern / stair cheeks with lamp standards
        mb.box(sx * (pw + 2) - 2.2, py - 3 - nst * 1.15, 0, sx * (pw + 2) + 2.2, py - 1, base + 1.2, stone2, top=trim, g0=0.05, g1=0.14)
        cx, cy = sx * (pw + 2), py - 3 - nst * 1.15 + 2.4
        mb.cyl(cx, cy, base + 1.2, 0.5, 5.0, pal.dark, n=6, r2=0.25)
        mb.revolve(cx, cy, [(0.0, base + 6.0), (0.95, base + 6.7), (0.95, base + 7.4), (0.0, base + 8.1)], pal.lamp, n=8, emit=1.0)
    # Fluegel / wings
    fh, wf = 5.4, 3
    hz = base + wf * fh
    for sx in (-1, 1):
        x0, x1 = (pw, hw) if sx > 0 else (-hw, -pw)
        mb.box(x0, fy, base, x1, BANK_D / 2, hz, stone, mat=MAT['grand'], bay=5.2, floor=fh, uo=40 + sx * 6, g0=0.12, g1=0.6, cap=False)
        mb.box(x0 - 0.8, fy - 0.8, hz, x1 + 0.8, BANK_D / 2 + 0.8, hz + 1.2, trim, bottom=True)
        # Balustrade und Eckpavillon / balustrade and corner pavilion
        mb.box(x0 - 0.2, fy - 0.2, hz + 1.2, x1 + 0.2, BANK_D / 2 + 0.2, hz + 2.4, stone2, top=_dk(stone2, 0.7))
        ex = x1 - 7 if sx > 0 else x0 + 7
        mb.box(ex - 7.6, fy - 1.6, base, ex + 7.6, fy + 14, hz + 6.5, stone, mat=MAT['grand'], bay=5.0, floor=fh + 2.1, uo=90 + sx * 4, g0=0.12, g1=0.72, cap=False)
        mb.box(ex - 8.3, fy - 2.3, hz + 6.5, ex + 8.3, fy + 14.7, hz + 7.6, trim, bottom=True)
        mb.frustum(ex - 7.9, fy - 1.9, ex + 7.9, fy + 14.3, hz + 7.6, 5.5, 4.6, copper, top=_dk(copper, 0.75))
        mb.tube((ex, fy + 6.2, hz + 13.1), (ex, fy + 6.2, hz + 24), 0.18, pal.dark, n=4)
        # Balkon ueber dem Erdgeschoss des Fluegels (A03) / balcony above the wing's ground storey (A03)
        bx0, bx1 = (x0 + 3.0, ex - 9.0) if sx > 0 else (ex + 9.0, x1 - 3.0)
        mb.box(bx0, fy - 3.4, base + fh - 0.6, bx1, fy, base + fh, trim, bottom=True, g0=0.3, g1=0.3)
        nb = int((bx1 - bx0) / 0.9)
        for i in range(nb + 1):
            bx = bx0 + 0.2 + i * (bx1 - bx0 - 0.4) / nb
            mb.box(bx - 0.14, fy - 3.3, base + fh, bx + 0.14, fy - 3.0, base + fh + 1.0, trim, g0=0.3, g1=0.3)
        mb.box(bx0, fy - 3.4, base + fh + 1.0, bx1, fy - 2.9, base + fh + 1.25, trim, bottom=True, g0=0.3, g1=0.3)
        for cx in (bx0 + 0.6, bx1 - 0.6):
            mb.box(cx - 0.5, fy - 3.4, base + fh - 3.0, cx + 0.5, fy - 0.2, base + fh - 0.6, stone2, g0=0.2, g1=0.3)
    # Mittelbau hinter den Saeulen / central block behind the columns
    ch = 25.0
    mb.box(-pw, fy, base, pw, BANK_D / 2, base + ch, stone, mat=MAT['grand'], bay=6.2, floor=ch / 3, uo=20, g0=0.12, g1=0.8, cap=False)
    # Portal / gate
    gw, gh2 = 5.2, 13.0
    gy = fy - 0.25
    arc = [(-gw, gy, base), (gw, gy, base)] + [(gw * math.cos(t), gy, base + gh2 - gw + gw * math.sin(t)) for t in np.linspace(0, math.pi, 9)]
    mb.face([(-gw - 1.2, gy + 0.1, base), (gw + 1.2, gy + 0.1, base), (gw + 1.2, gy + 0.1, base + gh2 + 1.4), (-gw - 1.2, gy + 0.1, base + gh2 + 1.4)], trim)
    mb.face(arc, A.cmix('goldDark', 'ink700', 0.55) if gate == 'shut' else pal.lamp, emit=0.0 if gate == 'shut' else 1.0)
    # Saeulen / columns
    chh = ch - 2.0
    for i in range(cols):
        cx = -pw + 2.2 + i * (2 * pw - 4.4) / (cols - 1)
        mb.box(cx - 1.9, py - 1.9, base, cx + 1.9, py + 1.9, base + 1.0, stone2, g0=0.12, g1=0.14)
        mb.revolve(cx, py, [(1.45, base + 1.0), (1.3, base + chh * 0.6), (1.18, base + chh - 1.2)], trim, n=14)
        mb.revolve(cx, py, [(1.2, base + chh - 1.2), (1.75, base + chh - 0.6), (1.75, base + chh)], stone2, n=14)
        mb.box(cx - 1.95, py - 1.95, base + chh, cx + 1.95, py + 1.95, base + chh + 0.6, trim)
    ez = base + chh + 0.6
    # Gebaelk: Architrav, Fries (Goldband), Gesims / entablature: architrave, frieze (gold band), cornice
    mb.box(-pw - 0.4, py - 2.2, ez, pw + 0.4, fy + 0.5, ez + 1.6, stone, bottom=True)
    mb.box(-pw - 0.2, py - 2.0, ez + 1.6, pw + 0.2, fy + 0.5, ez + 3.8, stone2)
    mb.face([(-pw + 3, py - 2.06, ez + 1.9), (pw - 3, py - 2.06, ez + 1.9), (pw - 3, py - 2.06, ez + 3.5), (-pw + 3, py - 2.06, ez + 3.5)], gold, emit=0.0)
    mb.box(-pw - 1.4, py - 3.2, ez + 3.8, pw + 1.4, fy + 0.5, ez + 4.8, trim, bottom=True)
    pz = ez + 4.8
    # Giebel mit Emblem / pediment with the emblem
    ph = 11.0
    mb.face([(-pw - 1.4, py - 3.0, pz), (pw + 1.4, py - 3.0, pz), (0, py - 3.0, pz + ph)], stone)
    mb.face([(-pw - 1.4, py - 3.0, pz), (0, py - 3.0, pz + ph), (0, fy + 0.5, pz + ph), (-pw - 1.4, fy + 0.5, pz)], _dk(copper, 0.9))
    mb.face([(0, py - 3.0, pz + ph), (pw + 1.4, py - 3.0, pz), (pw + 1.4, fy + 0.5, pz), (0, fy + 0.5, pz + ph)], _dk(copper, 0.9))
    for a, b in (((-pw - 1.4, pz), (0, pz + ph)), ((0, pz + ph), (pw + 1.4, pz))):
        mb.tube((a[0], py - 3.25, a[1] + 0.3), (b[0], py - 3.25, b[1] + 0.3), 0.55, trim, n=4)
    ey, ecz = py - 3.1, pz + ph * 0.4
    mb.face([(4.3 * math.cos(t), ey, ecz + 4.3 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 28, endpoint=False)], gold)
    mb.face([(3.6 * math.cos(t), ey - 0.06, ecz + 3.6 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 28, endpoint=False)], teal)
    star = [((3.1 if k % 2 == 0 else 0.85) * math.sin(k * math.pi / 4), ey - 0.12, ecz + (3.1 if k % 2 == 0 else 0.85) * math.cos(k * math.pi / 4)) for k in range(8)]
    for k in range(8):
        mb.face([(0, ey - 0.12, ecz), star[k], star[(k + 1) % 8]], 'paper50')
    # Attika und Dach des Mittelbaus / attic and roof of the central block
    az = base + ch
    mb.box(-pw - 0.8, fy - 0.2, az, pw + 0.8, BANK_D / 2 + 0.8, az + 1.2, trim, bottom=True)
    mb.box(-pw + 4, fy + 6, az + 1.2, pw - 4, BANK_D / 2 - 4, az + 9.0, stone, mat=MAT['slit'], bay=4.0, floor=7.8, uo=70, g0=0.8, g1=0.9, cap=False)
    mb.box(-pw + 3.2, fy + 5.2, az + 9.0, pw - 3.2, BANK_D / 2 - 3.2, az + 10.2, trim, bottom=True, top=_dk(copper, 0.8))
    # Tambour und Kuppel / drum and dome
    dz = az + 10.2
    cy = 6.0
    dr = 17.0
    mb.revolve(0, cy, [(dr + 1.2, dz), (dr + 1.2, dz + 1.6), (dr, dz + 1.6)], trim, n=32)
    mb.revolve(0, cy, [(dr, dz + 1.6), (dr, dz + 12.0)], stone, n=32)
    nwin = 20
    for k in range(nwin):
        a = 2 * math.pi * (k + 0.5) / nwin
        mb.push(0, cy, 0, rot=math.degrees(a) + 90)
        # Pilaster und hohes Fenster / pilaster and tall window
        mb.box(-0.55, -dr - 0.55, dz + 1.6, 0.55, -dr + 0.2, dz + 11.6, trim, g0=0.9, g1=0.95)
        mb.pop()
        a2 = 2 * math.pi * k / nwin
        mb.push(0, cy, 0, rot=math.degrees(a2) + 90)
        yy = -dr * math.cos(math.pi / nwin) - 0.08
        pts = [(-1.15, yy, dz + 3.2), (1.15, yy, dz + 3.2), (1.15, yy, dz + 9.2)] + [(1.15 * math.cos(t), yy, dz + 9.2 + 1.15 * math.sin(t)) for t in np.linspace(0, math.pi, 6)][1:-1] + [(-1.15, yy, dz + 9.2)]
        mb.face(pts, pal.lamp, emit=1.0)
        mb.pop()
    mb.revolve(0, cy, [(dr, dz + 12.0), (dr + 1.5, dz + 12.6), (dr + 1.5, dz + 13.8), (dr - 0.4, dz + 13.8)], trim, n=32)
    kz = dz + 13.8
    prof = [((dr - 0.4) * math.cos(t) ** 0.85, kz + (dr * 1.12) * math.sin(t)) for t in np.linspace(0, math.pi / 2 * 0.93, 10)]
    mb.revolve(0, cy, prof, copper, n=32)
    # Rippen der Kuppel / ribs of the dome
    for k in range(16):
        a = 2 * math.pi * k / 16
        for (r0, z0), (r1, z1) in zip(prof[:-1], prof[1:]):
            mb.tube((math.cos(a) * (r0 + 0.1), cy + math.sin(a) * (r0 + 0.1), z0), (math.cos(a) * (r1 + 0.1), cy + math.sin(a) * (r1 + 0.1), z1), 0.3, A.cmix('meridonTeal', 'paper50', 0.5), n=4)
    lz = prof[-1][1]
    lr = prof[-1][0]
    # Laterne / lantern
    mb.revolve(0, cy, [(lr + 0.6, lz - 0.3), (lr + 0.6, lz + 0.6), (lr * 0.82, lz + 0.6)], trim, n=16)
    mb.cyl(0, cy, lz + 0.6, lr * 0.8, 5.0, pal.lamp, n=12, emit=1.0)
    for k in range(8):
        a = 2 * math.pi * k / 8
        mb.tube((math.cos(a) * lr * 0.84, cy + math.sin(a) * lr * 0.84, lz + 0.6), (math.cos(a) * lr * 0.84, cy + math.sin(a) * lr * 0.84, lz + 5.6), 0.22, trim, n=4)
    mb.revolve(0, cy, [(lr + 0.3, lz + 5.6), (lr * 0.9, lz + 6.4), (lr * 0.45, lz + 8.2), (0.0, lz + 9.2)], copper, n=16)
    mb.revolve(0, cy, [(0.0, lz + 9.0), (0.75, lz + 9.9), (0.0, lz + 10.8)], gold, n=8)
    mb.tube((0, cy, lz + 10.6), (0, cy, lz + 15.5), 0.16, gold, n=4, r2=0.03)
    return {'top': lz + 15.5, 'base': base, 'gate': (0.0, gy, base), 'steps': (0.0, py - 3 - nst * 1.15, 0.0), 'front': fy, 'portico': py,
            'balcony': (pw + 3.0 + (hw - 14 - 9 - pw - 3) / 2, fy - 3.2, base + fh), 'flags': [(-(hw - 7), fy + 6.2, hz + 24), (hw - 7, fy + 6.2, hz + 24)],
            'dome': (0.0, cy, kz)}


# ---------- Hafen / harbour ----------
def lighthouse(mb, pal, h=34.0, r=3.6):
    """Leuchtturm mit Baendern, Galerie und Laterne; Rueckgabe: Hoehe des Lichts / banded lighthouse; returns the light's height"""
    mb.cyl(0, 0, 0, r * 1.9, 2.6, A.cmix('rock400', 'paper200', 0.4), n=14)
    nb = 5
    for k in range(nb):
        z0, z1 = 2.6 + k * (h - 2.6) / nb, 2.6 + (k + 1) * (h - 2.6) / nb
        r0, r1 = r * (1 - 0.38 * k / nb), r * (1 - 0.38 * (k + 1) / nb)
        mb.revolve(0, 0, [(r0, z0), (r1, z1)], 'paper50' if k % 2 == 0 else 'meridonTeal', n=14, cap=False)
    rt = r * 0.62
    mb.revolve(0, 0, [(rt, h), (rt * 1.7, h + 0.5), (rt * 1.7, h + 1.0), (rt * 0.95, h + 1.0)], pal.dark, n=14)
    for k in range(10):
        a = 2 * math.pi * k / 10
        mb.tube((math.cos(a) * rt * 1.62, math.sin(a) * rt * 1.62, h + 1.0), (math.cos(a) * rt * 1.62, math.sin(a) * rt * 1.62, h + 2.3), 0.07, pal.dark, n=4)
    mb.cyl(0, 0, h + 1.0, rt * 0.85, 3.2, pal.lamp, n=12, emit=1.0)
    mb.revolve(0, 0, [(rt * 1.1, h + 4.2), (rt * 0.9, h + 4.8), (0.0, h + 6.6)], A.cmix('meridonTeal', 'ink700', 0.3), n=12)
    mb.tube((0, 0, h + 6.5), (0, 0, h + 8.6), 0.1, pal.dark, n=4)
    return h + 2.6


def crane_base(mb, pal, h=22.0, w=9.0, color=None):
    """Portal eines Hafenkrans (steht fest) / portal of a harbour crane (static)"""
    c = color if color is not None else A.cmix('yellow500', 'mud500', 0.3)
    mb.ink = 0.4
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.tube((sx * w / 2, sy * w / 2, 0), (sx * w * 0.24, sy * w * 0.24, h), 0.5, c, n=4)
            mb.cbox(sx * w / 2, sy * w / 2, 0, 1.6, 2.6, 1.0, pal.dark)
    for k in (0.3, 0.62):
        a = w / 2 * (1 - k) + w * 0.24 * k
        p = [(-a, -a), (a, -a), (a, a), (-a, a)]
        for i in range(4):
            mb.tube((p[i][0], p[i][1], h * k), (p[(i + 1) % 4][0], p[(i + 1) % 4][1], h * k), 0.28, c, n=4)
    mb.ink = 1.0
    mb.cyl(0, 0, h, w * 0.32, 1.4, pal.dark, n=10)
    return h + 1.4


def crane_top(mb, pal, jib=34.0, color=None, lit=True):
    """
    Drehteil eines Wippkrans, Drehpunkt im Ursprung, Ausleger nach +y: Maschinenhaus mit Fuehrerstand, Ausleger als
    schlankes Fachwerk in einer Ebene, Stuetzbock mit Abspannung, Gegengewicht, Seil mit Last.
    Slewing part of a luffing crane, pivot at the origin, jib towards +y: machine house with a cab, the jib as a slender
    truss in one plane, an A-frame with stays, counterweight, cable with a load.
    """
    c = color if color is not None else A.cmix('yellow500', 'mud500', 0.3)
    house = A.cmix('paper200', 'meridonTeal', 0.25)
    mb.box(-2.8, -6.0, 0, 2.8, 3.0, 4.4, house, top=pal.dark)
    mb.box(-2.9, 3.0, 1.4, -0.4, 5.0, 4.0, house, top=pal.dark)
    for x in (-2.92, -0.38):
        pts = [(x, 3.3, 2.4), (x, 4.8, 2.4), (x, 4.8, 3.7), (x, 3.3, 3.7)]
        mb.face(pts[::-1] if x < -1 else pts, pal.lamp, emit=1.0 if lit else 0.0)
    mb.face([(-2.7, 5.02, 2.4), (-0.6, 5.02, 2.4), (-0.6, 5.02, 3.7), (-2.7, 5.02, 3.7)][::-1], pal.lamp, emit=1.0 if lit else 0.0)
    mb.box(-2.4, -9.5, 0.4, 2.4, -6.0, 3.4, pal.dark)
    mb.ink = 0.35
    a0, a1, tip = (0.0, 2.6, 4.2), (0.0, 0.6, 7.6), (0.0, 2.6 + jib * 0.84, 4.2 + jib * 0.54)
    n = 9
    lo = [tuple(a0[i] + (tip[i] - a0[i]) * k / n for i in range(3)) for k in range(n + 1)]
    hi = [tuple(a1[i] + (tip[i] - a1[i]) * k / n for i in range(3)) for k in range(n + 1)]
    for k in range(n):
        mb.tube(lo[k], lo[k + 1], 0.3, c, n=4)
        mb.tube(hi[k], hi[k + 1], 0.3, c, n=4)
        if k < n - 1:
            mb.tube(lo[k] if k % 2 == 0 else hi[k], hi[k + 1] if k % 2 == 0 else lo[k + 1], 0.14, c, n=4)
    # Stuetzbock und Abspannung / A-frame and stays
    top = (0.0, -2.4, 14.0)
    for sx in (-1, 1):
        mb.tube((sx * 2.2, -5.4, 4.4), top, 0.25, c, n=4)
        mb.tube((sx * 2.2, 0.6, 4.4), top, 0.25, c, n=4)
    mb.tube(top, hi[n - 2], 0.09, pal.dark, n=4)
    mb.tube(top, (0, -8.6, 3.4), 0.09, pal.dark, n=4)
    # Seil und Last / cable and load
    drop = jib * 0.36
    mb.tube(tip, (tip[0], tip[1], tip[2] - drop), 0.07, pal.dark, n=4)
    mb.ink = 1.0
    cc = A.hexc(pal.accents[1]) * 0.9
    mb.cbox(tip[0], tip[1], tip[2] - drop - 2.6, 3.4, 2.6, 2.6, cc, top=_dk(cc, 0.75))
    mb.cbox(tip[0], tip[1], tip[2], 0.6, 0.6, 0.6, 'red500', emit=1.0)
    return tip


def bridge(mb, pal, length, width=12.0, spans=3, rise=7.0, deck=9.0):
    """Steinerne Bogenbruecke entlang x, Mitte im Ursprung / stone arch bridge along x, centred at the origin"""
    stone, dark = A.cmix('paper200', 'rock400', 0.4), A.cmix('rock600', 'ink700', 0.4)
    sp = length / spans
    for sy in (-1, 1):
        y = sy * width / 2
        for k in range(spans):
            x0 = -length / 2 + k * sp
            m = 10
            for i in range(m):
                ta, tb = math.pi * i / m, math.pi * (i + 1) / m
                xa, xb = x0 + sp / 2 - math.cos(ta) * (sp / 2 - 1.4), x0 + sp / 2 - math.cos(tb) * (sp / 2 - 1.4)
                za, zb = math.sin(ta) * rise, math.sin(tb) * rise
                pts = [(xa, y, za), (xb, y, zb), (xb, y, deck), (xa, y, deck)]
                mb.face(pts if sy < 0 else pts[::-1], stone, mat=MAT['plain'], uvs=[(xa / 5, 0), (xb / 5, 0), (xb / 5, 1), (xa / 5, 1)], grad=(0.3, 0.3, 1, 1))
                if sy < 0:
                    # Bogenleibung / arch soffit
                    mb.face([(xa, -width / 2, za), (xa, width / 2, za), (xb, width / 2, zb), (xb, -width / 2, zb)], dark)
    for k in range(spans + 1):
        x = -length / 2 + k * sp
        mb.box(x - 1.4, -width / 2 - 0.6, -3, x + 1.4, width / 2 + 0.6, deck + 0.4, stone, g0=0.2, g1=0.9)
    mb.box(-length / 2, -width / 2 - 0.3, deck, length / 2, width / 2 + 0.3, deck + 0.5, pal.trim, bottom=True)
    for sy in (-1, 1):
        mb.box(-length / 2, sy * width / 2 - 0.25, deck + 0.5, length / 2, sy * width / 2 + 0.25, deck + 1.5, stone)
    return deck + 0.5


def quay(mb, pal, x0, x1, y, z=3.2, depth=6.0, cap=None, side='s'):
    """
    Kaimauer entlang x (Wasser auf der Seite -y): Mauer mit Fugenband, Deckstein, Algenband an der Wasserlinie, Poller,
    Reifenfender, Leitern. / quay wall along x (water on the -y side): wall with a joint band, coping, an algae band at
    the waterline, bollards, tyre fenders, ladders.
    """
    stone = A.cmix('rock400', 'paper300', 0.35)
    mb.box(x0, y, 0, x1, y + depth, z - 0.45, stone, mat=MAT['plain'], bay=5.0, floor=z + 2.5, g0=0.0, g1=0.9, sides='sew', cap=False)
    mb.box(x0 - 0.2, y - 0.35, z - 0.45, x1 + 0.2, y + depth, z + 0.14, pal.trim if cap is None else cap, bottom=True)
    mb.face([(x0, y - 0.06, -0.2), (x1, y - 0.06, -0.2), (x1, y - 0.06, 0.75), (x0, y - 0.06, 0.75)], A.cmix('forest700', 'ink700', 0.5))
    n = int((x1 - x0) / 11)
    for i in range(n + 1):
        x = x0 + 2 + i * (x1 - x0 - 4) / max(1, n)
        mb.cyl(x, y + 1.0, z, 0.38, 0.75, pal.dark, n=8)
        mb.cyl(x, y + 1.0, z + 0.75, 0.52, 0.22, pal.dark, n=8)
        if i % 2 == 0:
            mb.push(x + 4, y - 0.3, 1.6)
            mb.revolve(0, 0, [(0.45, -0.25), (0.9, -0.25), (0.9, 0.25), (0.45, 0.25)], pal.dark, n=8, cap=False)
            mb.pop()
        if i % 5 == 2:
            for k in range(6):
                mb.box(x + 6.6, y - 0.22, 0.3 + k * 0.5, x + 7.6, y - 0.1, 0.42 + k * 0.5, pal.dark)


def lamp(mb, cam, pal, x, y, z, h=6.5, halo=1, pool=2, off=None, hsh=0.5, size=1.0, color=None, arm=0.0):
    """
    Laterne: Mast, Leuchte, Lichthof (Karte zur Kamera, Material halo) und Lichtkreis am Boden (Material pool).
    Street lamp: pole, lamp, halo (card facing the camera, material halo) and a pool of light on the ground.
    """
    c = pal.lamp if color is None else color
    mb.tube((x, y, z), (x, y, z + h), 0.11 * size, pal.dark, n=4)
    lx = x + arm
    if arm:
        mb.tube((x, y, z + h), (lx, y, z + h + 0.3), 0.08 * size, pal.dark, n=4)
    old = mb.off
    if off is not None:
        mb.off = off
    mb.cbox(lx, y, z + h, 0.6 * size, 0.6 * size, 0.75 * size, c, emit=1.0)
    mb.off = old
    if halo is not None:
        mb.card((lx, y, z + h + 0.4), 6.5 * size, 6.5 * size, cam, c, mat=halo, alpha=0.55, off=off, hsh=hsh)
    if pool is not None:
        S.flat_disc(mb, (lx, y, z + 0.08), 6.0 * size, c, pool, alpha=0.30, off=off, hsh=hsh)


# ---------- Schiffe / ships ----------
def _hull(mb, length, beam, depth, sheer, color, boot, deck, n=14, bow=1.6, stern=0.6, draft=1.2):
    """
    Rumpf entlang x (Bug bei +x), Wasserlinie z = 0: Spanten mit Bugverjuengung und Sprung, Wasserpass in zweiter Farbe.
    Hull along x (bow at +x), waterline z = 0: stations with bow taper and sheer, boot topping in a second colour.
    """
    st = []
    for i in range(n + 1):
        u = i / n
        x = (u - 0.5) * length
        k = 1.0
        if u > 0.62:
            k = max(0.0, 1 - ((u - 0.62) / 0.38) ** bow)
        elif u < 0.14:
            k = stern + (1 - stern) * (u / 0.14) ** 0.6
        zd = depth + sheer * (2 * u - 1) ** 2 + (sheer * 0.8 if u > 0.8 else 0) * ((u - 0.8) / 0.2)
        flare = 1.0 + 0.10 * max(0.0, (u - 0.6) / 0.4)
        st.append((x + (0.06 * length * (zd / depth - 0.2) if u > 0.9 else 0), beam / 2 * k, zd, flare))
    for sy in (-1, 1):
        for i in range(n):
            (xa, ba, za, fa), (xb, bb, zb, fb) = st[i], st[i + 1]
            xa0, xb0 = (xa - (st[i][0] - ((i / n) - 0.5) * length), xb - (st[i + 1][0] - (((i + 1) / n) - 0.5) * length))
            lo = [(xa0, sy * ba * 0.9, -draft), (xb0, sy * bb * 0.9, -draft), (xb0, sy * bb * 0.96, 0.55), (xa0, sy * ba * 0.96, 0.55)]
            hi = [(xa0, sy * ba * 0.96, 0.55), (xb0, sy * bb * 0.96, 0.55), (xb, sy * bb * fb, zb), (xa, sy * ba * fa, za)]
            mb.face(lo if sy < 0 else lo[::-1], boot)
            mb.face(hi if sy < 0 else hi[::-1], color, grad=(0.5, 0.5, 1, 1))
    for i in range(n):
        (xa, ba, za, fa), (xb, bb, zb, fb) = st[i], st[i + 1]
        mb.face([(xa, -ba * fa, za), (xb, -bb * fb, zb), (xb, bb * fb, zb), (xa, ba * fa, za)], deck)
    (xa, ba, za, fa) = st[0]
    mb.face([(xa, ba * 0.9, -draft), (xa, -ba * 0.9, -draft), (xa, -ba * fa, za), (xa, ba * fa, za)], color)
    return st


def freighter(mb, R, pal, length=110.0, beam=16.0, lit=0.6, cargo=True, hull=None):
    """Frachter: Rumpf, Aufbau achtern mit Bruecke, Schornstein mit Band, Ladebaeume, Ladung / freighter"""
    hull = hull if hull is not None else A.cmix(R.choice(['ink700', 'sky800', 'smoke700', 'rust']), 'ink800', 0.3)
    deckc = A.cmix('timber', 'paper300', 0.45)
    st = _hull(mb, length, beam, 6.5, 1.6, hull, A.cmix('red700', 'rust', 0.4), deckc)
    # weisser Streifen am Schanzkleid / white sheer strake
    for sy in (-1, 1):
        for i in range(len(st) - 1):
            (xa, ba, za, fa), (xb, bb, zb, fb) = st[i], st[i + 1]
            p = [(xa, sy * ba * fa * 1.004, za - 0.9), (xb, sy * bb * fb * 1.004, zb - 0.9), (xb, sy * bb * fb * 1.004, zb - 0.25), (xa, sy * ba * fa * 1.004, za - 0.25)]
            mb.face(p if sy < 0 else p[::-1], pal.trim)
    L_, b = length, beam
    dz = 6.6
    # Aufbau achtern / superstructure aft
    sx0, sx1 = -L_ * 0.40, -L_ * 0.22
    mb.dens = lit
    z = dz
    for k, (inset, h) in enumerate(((0.9, 2.7), (1.5, 2.5), (2.6, 2.5))):
        mb.box(sx0 + k * 1.6, -b / 2 + inset, z, sx1 - k * 0.5, b / 2 - inset, z + h, pal.trim, mat=MAT['res'], bay=1.7, floor=h, uo=int(R.integers(0, 200)) * 2,
               g0=0.7, g1=1.0, top=A.cmix('paper200', 'smoke400', 0.3))
        z += h
    mb.box(sx0 + 1.5, -b / 2 - 0.6, z - 2.6, sx1 - 3.0, b / 2 + 0.6, z - 2.3, pal.trim, bottom=True)
    for sy in (-1, 1):
        for bx in (sx0 + 3.0, sx0 + 9.5):
            mb.box(bx, sy * (b / 2 - 0.2) - 0.9, dz + 3.4, bx + 5.0, sy * (b / 2 - 0.2) + 0.9, dz + 4.8, A.cmix('paper50', 'meridonOrange', 0.15), top=A.cmix('meridonOrange', 'paper200', 0.3))
    # Schornstein / funnel
    fx = (sx0 + sx1) / 2 - 1.5
    fc = A.hexc(R.choice(pal.accents[:2]))
    mb.revolve(fx, 0, [(2.3, z), (2.1, z + 3.2)], hull, n=12, cap=False)
    mb.revolve(fx, 0, [(2.1, z + 3.2), (2.0, z + 5.0)], fc, n=12, cap=False)
    mb.revolve(fx, 0, [(2.0, z + 5.0), (1.95, z + 6.4)], pal.dark, n=12)
    funnel = (fx, 0.0, z + 6.4)
    # Masten und Ladebaeume / masts and derricks
    for mx in (-L_ * 0.08, L_ * 0.16, L_ * 0.36):
        mb.ink = 0.4
        mb.tube((mx, 0, dz), (mx, 0, dz + 15), 0.32, pal.trim, n=6, r2=0.16)
        for sgn in (-1, 1):
            mb.tube((mx, 0, dz + 2.0), (mx + sgn * 9, sgn * 1.5, dz + 10.5), 0.16, pal.trim, n=4)
            mb.tube((mx, 0, dz + 14), (mx + sgn * 9, sgn * 1.5, dz + 10.5), 0.05, pal.dark, n=4)
        mb.cbox(mx, 0, dz + 15, 0.4, 0.4, 0.4, pal.lamp, emit=1.0)
    mb.ink = 1.0
    # Bullaugen / portholes
    for i in range(int(L_ * 0.5 / 2.6)):
        x = -L_ * 0.44 + i * 2.6
        for sy in (-1, 1):
            if R.random() < 0.75:
                yy = sy * (b / 2 + 0.08)
                pts = [(x, yy, 3.6), (x + 0.7, yy, 3.6), (x + 0.7, yy, 4.3), (x, yy, 4.3)]
                mb.face(pts if sy < 0 else pts[::-1], pal.lamp, emit=1.0)
    # Luken und Ladung / hatches and cargo
    cols = [A.cmix(a, 'paper200', 0.25) for a in ('meridonTeal', 'meridonOrange', 'red700', 'yellow500', 'blue600', 'paper200')]
    for k, hx in enumerate((-L_ * 0.15, L_ * 0.03, L_ * 0.25)):
        mb.box(hx - 6.5, -b * 0.3, dz, hx + 6.5, b * 0.3, dz + 1.0, pal.dark, top=A.cmix('smoke700', 'paper300', 0.3))
        if cargo:
            for i in range(R.integers(3, 7)):
                cw, cd, chh = R.uniform(2.2, 4.4), R.uniform(2.0, 3.2), R.uniform(1.6, 2.6)
                cx, cy = hx + R.uniform(-5, 5), R.uniform(-b * 0.22, b * 0.22)
                cc = cols[R.integers(0, len(cols))]
                mb.cbox(cx, cy, dz + 1.0, cw, cd, chh, cc, top=_dk(cc, 0.8))
    # Bugmast und Flagge am Heck (Halter) / jack staff and ensign staff
    mb.ink = 0.3
    mb.tube((L_ * 0.47, 0, 8.0), (L_ * 0.47, 0, 12.5), 0.1, pal.trim, n=4)
    mb.tube((-L_ * 0.49, 0, 7.2), (-L_ * 0.50, 0, 12.0), 0.1, pal.trim, n=4)
    mb.ink = 1.0
    return {'funnel': funnel, 'flag': (-L_ * 0.50, 0.0, 12.0), 'deck': dz}


def sailship(mb, R, pal, length=46.0, beam=9.0, masts=3, sails=True, sail_col=None, lit=0.5, glow=0.0):
    """
    Handelssegler: Rumpf mit Heckaufbau, Masten mit Rahen und geblaehten Segeln, Bugspriet mit Kluever, Laterne am Heck.
    Trading sailing ship: hull with a stern castle, masts with yards and bellied sails, bowsprit with jibs, stern lantern.
    """
    hull = A.cmix('timber', 'ink700', 0.45)
    sc = sail_col if sail_col is not None else A.cmix('sail', 'paper50', 0.4)
    spar = A.cmix('timber', 'ink700', 0.3)
    st = _hull(mb, length, beam, 3.6, 1.5, hull, A.cmix('ink700', 'timber', 0.2), A.cmix('timber', 'paper300', 0.5), n=12, bow=1.8, stern=0.7, draft=1.0)
    for sy in (-1, 1):
        for i in range(len(st) - 1):
            (xa, ba, za, fa), (xb, bb, zb, fb) = st[i], st[i + 1]
            p = [(xa, sy * ba * fa * 1.004, za - 0.75), (xb, sy * bb * fb * 1.004, zb - 0.75), (xb, sy * bb * fb * 1.004, zb - 0.35), (xa, sy * ba * fa * 1.004, za - 0.35)]
            mb.face(p if sy < 0 else p[::-1], A.cmix('goldDark', 'timber', 0.3))
    L_ = length
    # Heckaufbau mit Fenstern / stern castle with windows
    mb.dens = lit
    mb.box(-L_ * 0.48, -beam * 0.36, 4.2, -L_ * 0.28, beam * 0.36, 6.6, A.cmix('timber', 'paper300', 0.3), mat=MAT['slit'], bay=1.8, floor=2.4, uo=int(R.integers(0, 99)) * 2,
           top=A.cmix('timber', 'paper300', 0.5))
    mb.cbox(-L_ * 0.49, 0, 7.2, 0.5, 0.5, 0.7, pal.lamp, emit=1.0)
    lantern = (-L_ * 0.49, 0.0, 7.5)
    tops = []
    for k in range(masts):
        mx = L_ * (-0.26 + 0.6 * k / max(1, masts - 1)) if masts > 1 else 0.0
        mh = L_ * (0.86 if k == masts // 2 else 0.74)
        mb.ink = 0.45
        mb.tube((mx, 0, 3.6), (mx, 0, 3.6 + mh), 0.34, spar, n=6, r2=0.12)
        tops.append((mx, 0.0, 3.6 + mh))
        ns = 3
        for j in range(ns):
            z0 = 3.6 + mh * (0.16 + 0.27 * j)
            z1 = z0 + mh * 0.24
            w0, w1 = beam * (1.55 - 0.3 * j), beam * (1.3 - 0.3 * j)
            mb.ink = 0.3
            mb.tube((mx, -w0 / 2 - 0.6, z0), (mx, w0 / 2 + 0.6, z0), 0.16, spar, n=4)
            mb.tube((mx, -w1 / 2 - 0.6, z1), (mx, w1 / 2 + 0.6, z1), 0.16, spar, n=4)
            mb.ink = 0.5
            if sails:
                # geblaehtes Segel: Gitter mit Bauch nach +x / bellied sail: grid bulging towards +x
                nu, nv = 6, 4
                grid = [[(mx + 0.25 + math.sin(math.pi * u / nu) * math.sin(math.pi * (0.15 + 0.85 * v / nv)) * w0 * 0.16,
                          (-0.5 + u / nu) * (w0 + (w1 - w0) * v / nv), z0 + 0.25 + (z1 - z0 - 0.5) * v / nv) for u in range(nu + 1)] for v in range(nv + 1)]
                for v in range(nv):
                    for u in range(nu):
                        mb.face([grid[v][u], grid[v][u + 1], grid[v + 1][u + 1], grid[v + 1][u]], _dk(sc, 0.86 + 0.14 * (v + (u % 2) * 0.35) / nv), smooth=True, emit=glow)
    # Bugspriet und Kluever / bowsprit and jibs
    bs0, bs1 = (L_ * 0.46, 0, 5.0), (L_ * 0.72, 0, 8.4)
    mb.ink = 0.3
    mb.tube(bs0, bs1, 0.2, spar, n=4, r2=0.08)
    if sails and masts:
        top = tops[-1]
        for j in range(2):
            a = (bs0[0] + (bs1[0] - bs0[0]) * (0.45 + 0.5 * j), 0.0, bs0[2] + (bs1[2] - bs0[2]) * (0.45 + 0.5 * j))
            b = (top[0] + 0.5, 0.0, top[2] * (0.62 + 0.3 * j))
            c = (top[0] + 1.0 + j * 2.0, 0.6, 7.0 + j * 1.5)
            mb.ink = 0.5
            mb.face([a, b, c], _dk(sc, 0.92), emit=glow)
            mb.face([a, c, b], _dk(sc, 0.92), emit=glow)
        mb.ink = 0.12
        mb.tube(bs1, tops[-1], 0.05, pal.dark, n=4)
    mb.ink = 0.12
    for i in range(len(tops)):
        # Wanten zu beiden Bordwaenden / shrouds to both sides
        for sy in (-1, 1):
            mb.tube((tops[i][0] - 1.6, sy * beam * 0.46, 4.0), (tops[i][0], 0, tops[i][2] * 0.72), 0.05, pal.dark, n=4)
    mb.tube((-L_ * 0.5, 0, 6.0), tops[0], 0.05, pal.dark, n=4)
    mb.ink = 1.0
    return {'tops': tops, 'lantern': lantern}


def boat(mb, R, pal, length=11.0, lit=True):
    """Barkasse mit Kajuete und Laterne / launch with a cabin and a lantern"""
    hull = A.cmix(R.choice(['meridonTeal', 'red700', 'ink700', 'paper200']), 'ink700', 0.35)
    _hull(mb, length, length * 0.3, 1.3, 0.4, hull, A.cmix('ink700', 'timber', 0.3), A.cmix('timber', 'paper300', 0.5), n=8, draft=0.6)
    mb.box(-length * 0.2, -length * 0.1, 1.3, length * 0.12, length * 0.1, 3.0, pal.trim, mat=MAT['office'], bay=1.6, floor=1.7, top=pal.dark, dens=1.0 if lit else 0.0)
    mb.tube((length * 0.12, 0, 3.0), (length * 0.12, 0, 5.2), 0.07, pal.dark, n=4)
    mb.cbox(length * 0.12, 0, 5.2, 0.3, 0.3, 0.3, pal.lamp, emit=1.0)
    mb.cyl(-length * 0.05, 0, 3.0, 0.3, 1.3, pal.dark, n=6)
    return (length * 0.12, 0.0, 5.35)


def crates(mb, R, x, y, z, n, pal, spread=6.0, plain=False, size=(1.2, 2.4)):
    """Kistenstapel und Faesser; plain = nur Holztoene / crate stacks and barrels; plain = timber tones only"""
    cols = [A.cmix(a, 'paper200', 0.35) for a in ('timber', 'meridonTeal', 'meridonOrange', 'paper300', 'red700', 'yellow500')]
    if plain:
        cols = [A.cmix('timber', 'paper300', k) for k in (0.25, 0.4, 0.55)] + [A.cmix('timber', 'meridonTeal', 0.2), A.cmix('rust', 'paper300', 0.4)]
    for _ in range(n):
        cx, cy = x + R.uniform(-spread, spread), y + R.uniform(-spread * 0.5, spread * 0.5)
        if R.random() < 0.25:
            mb.cyl(cx, cy, z, 0.5, 1.2, A.cmix('timber', 'rust', 0.4), n=8)
            continue
        s = R.uniform(*size)
        cc = cols[R.integers(0, len(cols))]
        mb.push(cx, cy, z, rot=R.uniform(-12, 12))
        mb.cbox(0, 0, 0, s * R.uniform(1.0, 1.7), s, s, cc, top=_dk(cc, 0.82))
        if R.random() < 0.4:
            mb.cbox(R.uniform(-0.3, 0.3), 0, s, s * 0.9, s * 0.8, s * 0.8, cols[R.integers(0, len(cols))])
        mb.pop()


def jetty(mb, R, pal, length, width=6.0, z=2.4):
    """
    Holzsteg entlang +x ab dem Ursprung: Bohlen in wechselnden Toenen, Pfaehle bis ins Wasser mit Kreuzstreben,
    Pfosten mit Tau, Kisten, Faesser, Poller. / wooden jetty along +x from the origin: planks in alternating tones,
    piles down into the water with cross braces, posts with a rope, crates, barrels, bollards.
    """
    t0, t1, dark = A.cmix('timber', 'paper300', 0.45), A.cmix('timber', 'paper300', 0.25), A.cmix('timber', 'ink700', 0.5)
    n = int(length / 1.1)
    for i in range(n):
        x0, x1 = i * length / n, (i + 1) * length / n - 0.08
        c = t0 if (i * 7) % 3 else t1
        mb.box(x0, -width / 2 + R.uniform(-0.12, 0.12), z - 0.3, x1, width / 2 + R.uniform(-0.12, 0.12), z, c, g0=0.6, g1=1.0)
    for sy in (-1, 1):
        mb.box(0, sy * width / 2 - 0.2, z - 0.75, length, sy * width / 2 + 0.2, z - 0.3, dark, bottom=True)
    k = 0
    for x in np.arange(1.0, length, 6.5):
        for sy in (-1, 1):
            top = z + (1.25 if k % 2 == 0 else 0.0)
            mb.cyl(float(x), sy * (width / 2 - 0.1), -0.6, 0.3, top + 0.6, dark, n=7)
            if k % 2 == 0:
                mb.cyl(float(x), sy * (width / 2 - 0.1), top, 0.36, 0.14, A.cmix('timber', 'paper300', 0.4), n=7)
        mb.ink = 0.45
        mb.tube((float(x), -width / 2 + 0.1, 0.25), (float(x), width / 2 - 0.1, z - 0.8), 0.13, dark, n=4)
        mb.tube((float(x), width / 2 - 0.1, 0.25), (float(x), -width / 2 + 0.1, z - 0.8), 0.13, dark, n=4)
        if k % 2 == 0 and x + 13 < length:
            # durchhaengendes Tau / sagging rope
            for sy in (-1, 1):
                pts = [(float(x) + 13.0 * u, sy * (width / 2 - 0.1), z + 1.15 - 0.55 * math.sin(math.pi * u)) for u in np.linspace(0, 1, 7)]
                for a, b in zip(pts[:-1], pts[1:]):
                    mb.tube(a, b, 0.045, A.cmix('paper300', 'timber', 0.4), n=4)
        mb.ink = 1.0
        k += 1


def tram(mb, pal, color=None, cars=2, lit=1.0):
    """Strassenbahn entlang +x: Wagen mit Fensterband, Dach, Stromabnehmer, Scheinwerfer / tram along +x"""
    c = color if color is not None else A.cmix('meridonTeal', 'paper100', 0.3)
    x = 0.0
    for k in range(cars):
        mb.box(x, -1.25, 0.35, x + 12.5, 1.25, 1.45, c, g0=0.8, g1=1.0, cap=False)
        mb.box(x, -1.25, 1.45, x + 12.5, 1.25, 2.75, A.cmix('paper50', 'paper200', 0.5), mat=MAT['glass'], bay=1.55, floor=1.3, uo=k * 6, g0=1.0, g1=1.0, dens=lit, cap=False)
        mb.box(x - 0.1, -1.35, 2.75, x + 12.6, 1.35, 3.05, A.cmix('paper200', 'smoke400', 0.4), bottom=True)
        for wx in (x + 2.2, x + 10.3):
            mb.box(wx - 0.9, -1.2, 0.0, wx + 0.9, 1.2, 0.4, pal.dark)
        x += 13.2
    mb.ink = 0.3
    mb.tube((5.5, 0, 3.05), (7.5, 0, 4.9), 0.07, pal.dark, n=4)
    mb.tube((7.5, -0.8, 4.9), (7.5, 0.8, 4.9), 0.07, pal.dark, n=4)
    mb.ink = 1.0
    return x - 0.7
