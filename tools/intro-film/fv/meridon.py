"""
Der Ort Meridon der alten Welt (Akt I): Hafenmetropole am Hang. Hafenbecken, Kai mit Promenade, Ostpier mit Kraenen
und Lagerhaeusern, Mole mit Leuchtturm, Kanal mit Bogenbruecken, elf Haeuserreihen auf Terrassen, die grosse Bank auf
ihrer Terrasse, ferne Viertel auf den Huegeln, das Rechenzentrum von NEXUS auf dem Kamm. Alles haengt an einer
Abschaltzeit je Viertel (Stromausfall-Welle von hinten zur Kamera).
The place Meridon of the old world (act I): a harbour metropolis on a slope. Harbour basin, quay with a promenade, an
east pier with cranes and warehouses, a mole with a lighthouse, a canal with arch bridges, eleven rows of houses on
terraces, the grand bank on its terrace, far districts on the hills, the NEXUS data centre on the ridge. Everything
hangs on a switch-off time per district (blackout wave from the back towards the camera).

Achsen / axes: x nach Osten (rechts), y landeinwaerts, z oben; Wasser bei y < 0, Kaikante y = 0, Wasserspiegel z = 0.
"""
import math

import numpy as np
from mathutils import Vector

from . import anime as A
from . import arch as AR
from . import atmo as AT
from . import lib as L
from . import scenery as S
from . import world as W

QUAY_Z = 3.2
BANK = (40.0, 132.0, 8.0)
BANK_SCALE = 1.12
NEXUS = (430.0, 1420.0)
CANAL = (-186.0, -154.0)
PLAZA = (-28.0, 108.0)
PIER = (214.0, 330.0, -214.0)
# Reihen: (Vorderkante y, Tiefe, Gelaendehoehe) / rows: (front y, depth, ground height)
ROWS = [(16, 22, 3.2), (54, 22, 4.6), (94, 22, 8.0), (136, 24, 12.5), (180, 24, 17.5), (228, 26, 23.0), (280, 26, 29.5), (336, 28, 36.5),
        (398, 30, 44.0), (468, 32, 52.5), (548, 36, 61.0)]
_HPTS = [(-1e4, QUAY_Z), (42, QUAY_Z)] + [(y + d / 2, z) for y, d, z in ROWS[1:]] + [(700, 74.0), (1000, 92.0), (1500, 112.0), (1e4, 112.0)]
CROSS = (-262.0, -92.0, 150.0, 292.0)


def height(x, y):
    """Gelaendehoehe: Terrassen zum Hang, Plateau der Bank, Kanal, Huegel hinten / terrain height"""
    ys = [p[0] for p in _HPTS]
    zs = [p[1] for p in _HPTS]
    z = float(np.interp(y, ys, zs))
    if y > 42:
        z *= 1.0 + 0.10 * math.sin(x / 190.0 + 0.6) * min(1.0, (y - 42) / 200.0)
    if y > 600:
        k = min(1.0, (y - 600) / 500.0)
        z += k * (38.0 * math.exp(-((x - NEXUS[0]) / 420.0) ** 2) + 26.0 * math.sin(x / 310.0 + 2.0) + 14.0 * math.sin(x / 130.0))
    # Plateau der Bank und Freitreppe / the bank's plateau and esplanade
    px = L.clamp((x - (PLAZA[0] - 14)) / 14.0) * L.clamp(((PLAZA[1] + 14) - x) / 14.0)
    py = L.clamp((y - 40) / 28.0) * L.clamp((214 - y) / 20.0)
    z = z + (BANK[2] - z) * px * py if y < 214 else z
    if CANAL[0] < x < CANAL[1] and y < 132:
        z = -1.6
    # Westkueste: das Kap faellt zum offenen Meer ab / west coast: the head falls to the open sea
    k = L.clamp((x - coast(y)) / 16.0)
    return -3.0 + (z + 3.0) * k


def coast(y):
    """x der Westkueste bei y / x of the west coast at y"""
    return -356.0 - 0.35 * max(0.0, y)


class Meridon:
    def __init__(self, shot, cam, wave=None, lit=0.55, ink=1.3, far=True, ships=True, people=True, glass='sky700', gate='shut',
                 rows=None, seed=7, mirror=True, win_gain=1.0, sail_glow=0.85, nexus_beam=0.75, mirror_nexus=False, smoke_tint=(1, 1, 1), wake_col='foam', place=None, nexus_lit=0.78):
        self.shot, self.cam, self.wave, self.lit = shot, tuple(cam), wave, lit
        self.sail_glow, self.nexus_beam, self.smoke_tint, self.wake_col, self.nexus_lit = sail_glow, nexus_beam, smoke_tint, wake_col, nexus_lit
        # place: Schiffe je Einstellung umsetzen {Name: (Ort, Kurs, Fahrt)} / move ships per shot {name: (place, heading, speed)}
        self.place = place or {}
        self.pal = pal = AR.meridon_palette()
        self.mats = S.facade_mats(shot, glass=glass, lit_gain=win_gain)
        self.halo = W.sprite_mat('halo', attr_col=True, add=True, shape='disc', switch=True, keep=0.75)
        self.pool = W.sprite_mat('pool', attr_col=True, add=True, shape='disc', switch=True, keep=0.2)
        self.updaters = []
        self.flags = []
        self.objs = {}
        R = np.random.default_rng(seed)
        self.front = W.MeshB()   # Kai, Promenade, Pier, Mole, erste Reihen: gespiegelt / mirrored
        self.mid = W.MeshB()
        self.back = W.MeshB()
        self.thin = W.MeshB()    # Feingliedriges: Kraene, Masten, Gelaender / fine parts
        self.lights = W.MeshB()  # Lichthoefe und Lichtkreise / halos and pools
        self._quays(R)
        self._bank(gate)
        self._rows(R, rows)
        self._harbour(R)
        if far:
            self._far(R)
            self._nexus(R)
        self._ground()
        mats = self.mats
        self.ob_front = self.front.build(shot, 'city_front', mats, ink=ink, cam=cam)
        self.ob_mid = self.mid.build(shot, 'city_mid', mats, ink=ink, cam=cam, ink_max=900)
        self.ob_back = self.back.build(shot, 'city_back', mats, ink=None)
        self.ob_thin = self.thin.build(shot, 'city_thin', mats, ink=ink * 0.45, cam=cam)
        self.ob_lights = self.lights.build(shot, 'city_lights', [mats[0], self.halo, self.pool], weld=False, shadow=False)
        self.mirrored = [self.ob_front, self.ob_mid, self.ob_thin, self.ob_lights]
        self.moving = []
        if ships:
            self._ships(R)
        self._cranes(R)
        self._flags(R)
        if people:
            self._people(R)
        if mirror_nexus and far:
            self.mirrored.append(self.ob_nexus)
        self.pairs = S.mirror(shot, self.mirrored + self.moving, stretch=1.45) if mirror else []
        self.npairs_static = len(self.mirrored)

    # ----- Abschaltzeit / switch-off time -----
    def off(self, x, y):
        if self.wave is None:
            return W.NEVER
        t0, t1 = self.wave
        ri = min(len(ROWS), max(0, sum(1 for r in ROWS if y > r[0] - 10)))
        if y > 620:
            ri = len(ROWS) + min(4, int((y - 620) / 180))
        di = int((x + 600) // 170)
        n = len(ROWS) + 4
        h = ((ri * 7 + di * 13) * 0.6180339) % 1.0
        return t0 + (t1 - t0) * (1.0 - (ri + 0.55 * h) / n) + 0.04 * (((x * 12.9898 + y * 78.233) * 0.7) % 1.0)

    # ----- Kai, Pier, Mole, Kanal / quay, pier, mole, canal -----
    def _quays(self, R):
        mb, pal = self.front, self.pal
        AR.quay(mb, pal, -340, CANAL[0], 0.0)
        AR.quay(mb, pal, CANAL[1], PIER[0], 0.0)
        AR.quay(mb, pal, PIER[1], 470, 0.0)
        # Kanalmauern und Bruecken / canal walls and bridges
        stone = A.cmix('rock400', 'paper300', 0.35)
        for x in (CANAL[0] - 1.2, CANAL[1]):
            mb.box(x, 0, 0, x + 1.2, 132, QUAY_Z + 0.3, stone, mat=S.MAT['plain'], bay=5, floor=3.5, g0=0.2, g1=0.9, top=pal.trim)
        mb.box(CANAL[0], 131, 0, CANAL[1], 134, 12, stone, top=pal.trim)
        mb.face([(CANAL[0] + 5, 130.9, 0), (CANAL[1] - 5, 130.9, 0), (CANAL[1] - 5, 130.9, 5), (CANAL[0] + 16, 130.9, 8.5), (CANAL[0] + 5, 130.9, 5)], pal.dark)
        for by in (9.0, 46.0, 92.0):
            mb.push((CANAL[0] + CANAL[1]) / 2, by, 0.0)
            AR.bridge(mb, pal, CANAL[1] - CANAL[0] + 4, width=11.0, spans=1, rise=3.6, deck=QUAY_Z + 1.6 if by > 20 else QUAY_Z + 0.2)
            mb.pop()
        # Ostpier / east pier
        x0, x1, y0 = PIER
        mb.box(x0, y0, 0, x1, 0.0, QUAY_Z - 0.45, stone, mat=S.MAT['plain'], bay=5, floor=3.5, g0=0.0, g1=0.9, cap=False)
        mb.box(x0 - 0.3, y0 - 0.3, QUAY_Z - 0.45, x1 + 0.3, 0.0, QUAY_Z, A.cmix('rock400', 'paper200', 0.5), bottom=True)
        mb.face([(x0 - 0.06, 0, -0.2), (x0 - 0.06, y0, -0.2), (x0 - 0.06, y0, 0.75), (x0 - 0.06, 0, 0.75)], A.cmix('forest700', 'ink700', 0.5))
        for i in range(10):
            yy = y0 + 8 + i * 21
            for xx in (x0 + 1.0, x1 - 1.0):
                mb.cyl(xx, yy, QUAY_Z, 0.38, 0.75, pal.dark, n=8)
        for k, (cx, w, d) in enumerate(((x0 + 70, 34, 120), (x0 + 96, 0, 0))):
            if w:
                mb.push(cx, y0 + 80, QUAY_Z, rot=90)
                mb.off = self.off(cx, 0)
                AR.warehouse(mb, R, d, w, pal, h=10.0, sign=A.hexc('meridonTeal'))
                mb.pop()
        AR.crates(mb, R, x0 + 24, y0 + 60, QUAY_Z, 16, pal, spread=10)
        AR.crates(mb, R, x0 + 26, y0 + 130, QUAY_Z, 18, pal, spread=11)
        AR.crates(mb, R, x0 + 22, -20, QUAY_Z, 12, pal, spread=9)
        # Mole mit Leuchtturm / mole with the lighthouse
        a, b = Vector((-336, 6)), Vector((-262, -128))
        n = 9
        rock = A.cmix('rock600', 'paper300', 0.3)
        for i in range(n):
            p = a.lerp(b, (i + 0.5) / n)
            mb.push(p.x, p.y, 0, rot=math.degrees(math.atan2(b.y - a.y, b.x - a.x)) + R.uniform(-4, 4))
            ln = (b - a).length / n + 1.5
            mb.box(-ln / 2, -4.5 + R.uniform(-0.5, 0.5), 0, ln / 2, 4.5 + R.uniform(-0.5, 0.5), 2.6 + R.uniform(-0.3, 0.3), rock, g0=0.2, g1=1.0, top=A.cmix('rock400', 'paper200', 0.4))
            mb.box(-ln / 2, -2.0, 2.4, ln / 2, 2.0, 3.3, A.cmix('rock400', 'paper200', 0.5))
            mb.pop()
        self.lh = (b.x, b.y, 3.0)
        mb.push(b.x, b.y, 0.0)
        mb.cyl(0, 0, 0, 9.0, 3.0, rock, n=12)
        mb.off = self.off(b.x, 0) if self.wave else W.NEVER
        self.lh_z = 3.0 + AR.lighthouse(mb, pal)
        mb.pop()
        # Bastion am Westkap / bastion on the west head
        mb.push(-352, 36, 0)
        mb.cyl(0, 0, 0, 17, 13, A.cmix('rock400', 'paper200', 0.4), n=18, r2=15)
        mb.revolve(0, 0, [(15.8, 13), (15.8, 14.6), (14.2, 14.6)], pal.trim, n=18)
        mb.cyl(0, 0, 13, 6, 9, A.cmix('rock400', 'paper200', 0.5), n=12)
        mb.revolve(0, 0, [(6.8, 22), (0, 28)], pal.roofs[0], n=12)
        mb.pop()
        self.flag_pts = [((-352, 36, 28), 9.0)]
        # Laternen der Promenade / promenade lamps
        for x in np.arange(-330, 462, 21.0):
            if CANAL[0] - 4 < x < CANAL[1] + 4 or PIER[0] - 2 < x < PIER[1] + 2:
                continue
            o = self.off(x, 0)
            AR.lamp(self.lights, self.cam, pal, float(x), 3.4, QUAY_Z, h=6.8, halo=1, pool=2, off=o, hsh=float(R.random()), size=1.15)
        for i in range(9):
            yy = PIER[2] + 12 + i * 23
            AR.lamp(self.lights, self.cam, pal, PIER[0] + 3.0, yy, QUAY_Z, h=7.5, halo=1, pool=2, off=self.off(250, 0), hsh=float(R.random()), size=1.15)
        # Gleise der Hafenbahn sind gemalt (Boden); Waggons / the harbour railway's rails are painted (ground); wagons
        for i in range(5):
            x = 268 + i * 13.5
            c = A.cmix(R.choice(['rust', 'meridonTeal', 'smoke700', 'mud500']), 'paper300', 0.3)
            mb.box(x, 9.2, QUAY_Z + 0.5, x + 12, 12.2, QUAY_Z + 3.6, c, top=AR._dk(c, 0.7))
            for wx in (x + 2, x + 10):
                mb.box(wx - 0.8, 9.4, QUAY_Z, wx + 0.8, 12.0, QUAY_Z + 0.5, pal.dark)

    # ----- Die Bank / the bank -----
    def _bank(self, gate):
        mb = self.front
        mb.off = self.off(BANK[0], BANK[1])
        mb.push(BANK[0], BANK[1], BANK[2], scale=BANK_SCALE)
        b = AR.bank(mb, self.pal, lit=0.92 if self.lit > 0.2 else self.lit, gate=gate)
        mb.pop()
        # Punkte der Bank im Massstab / the bank's points to scale
        b = {k: (v * BANK_SCALE if isinstance(v, (int, float)) else ([tuple(c * BANK_SCALE for c in q) for q in v] if isinstance(v, list) else tuple(c * BANK_SCALE for c in v)))
             for k, v in b.items()}
        self.bank = b
        self.bank_top = BANK[2] + b['top']
        self.flag_pts += [((BANK[0] + p[0], BANK[1] + p[1], BANK[2] + p[2]), 12.0) for p in b['flags']]
        # Laternen auf der Freitreppe und Terrasse / lamps on the esplanade and terrace
        o = self.off(BANK[0], BANK[1])
        for sx in (-1, 1):
            for yy in (46, 60, 74, 88):
                x = BANK[0] + sx * 40
                AR.lamp(self.lights, self.cam, self.pal, x, yy, height(x, yy), h=7.5, halo=1, pool=2, off=o, hsh=0.3 + 0.1 * sx, size=1.3)
        # Lichthoefe: Leuchter an den Treppenwangen, Laterne der Kuppel / halos: stair lamps, the dome's lantern
        for sx in (-1, 1):
            self.lights.card((BANK[0] + sx * 33 * BANK_SCALE, BANK[1] + b['steps'][1] + 2.6, BANK[2] + b['base'] + 7.8), 14, 14, self.cam, self.pal.lamp, mat=1, alpha=0.6, off=o, hsh=0.5)
        dz = BANK[2] + b['dome'][2]
        self.lights.card((BANK[0], BANK[1] + b['dome'][1], self.bank_top - 12.5), 22, 22, self.cam, self.pal.lamp, mat=1, alpha=0.5, off=o, hsh=0.6)
        self.lights.card((BANK[0], BANK[1] - 18, dz - 8), 62, 26, self.cam, self.pal.lamp, mat=1, alpha=0.22, off=o, hsh=0.4)

    # ----- Haeuserreihen / rows of houses -----
    def _rows(self, R, only=None):
        pal = self.pal
        for ri, (y0, depth, _z) in enumerate(ROWS):
            if only is not None and ri not in only:
                continue
            mb = self.front if ri < 3 else (self.mid if ri < 8 else self.back)
            x = max(-330.0, coast(y0 + depth) + 22.0) + R.uniform(0, 8)
            x_end = 468.0 if ri else 205.0
            while x < x_end:
                w = float(R.uniform(13, 30))
                skip = False
                for cx in CROSS:
                    if x < cx + 6 and x + w > cx - 6:
                        x = cx + 6 + R.uniform(0, 2)
                        skip = True
                if skip:
                    continue
                if x < CANAL[1] + 5 and x + w > CANAL[0] - 5 and y0 < 132:
                    x = CANAL[1] + 5
                    continue
                if x < PLAZA[1] + 2 and x + w > PLAZA[0] - 2 and y0 < 200:
                    x = PLAZA[1] + 2
                    continue
                cx, cy = x + w / 2, y0 + depth / 2
                z = min(height(x, y0), height(x + w, y0), height(cx, y0))
                mb.off = self.off(cx, cy)
                near_bank = abs(cx - BANK[0]) < 150
                mb.push(cx, cy, z)
                # Sockel bis unter das Gelaende / plinth down below the terrain
                mb.box(-w / 2, -depth / 2, -9, w / 2, depth / 2, 0.0, A.cmix('rock400', 'paper300', 0.4), sides='sew', cap=False)
                u = R.random()
                if ri == 0 and (cx < -200 or cx > 120):
                    AR.warehouse(mb, R, w, depth, pal, h=float(R.uniform(8.5, 12)), sign=A.hexc(R.choice(pal.accents[:2])) if R.random() < 0.6 else None, lit=self.lit * 0.5)
                elif u < (0.06 if ri > 1 else 0.03) and not near_bank:
                    tw = min(w, depth) * R.uniform(0.6, 0.8)
                    AR.tower(mb, R, tw, int(R.integers(8, 12)), pal, lit=self.lit)
                    w = tw + 2
                else:
                    floors = int(R.integers(3, 7)) + (1 if ri in (0, 4, 5) and R.random() < 0.4 else 0)
                    if near_bank and ri < 4:
                        floors = min(floors, 4)
                    AR.block(mb, R, w, depth, floors, pal, lit=self.lit, style='grand' if (ri == 0 and R.random() < 0.5) else None)
                mb.pop()
                x += w + (R.uniform(3, 5) if R.random() < 0.18 else 0.0)
            # Strassenlaternen vor der Reihe / street lamps in front of the row
            if ri < 9:
                for lx in np.arange(-320, x_end, 34.0 if ri < 5 else 52.0):
                    lx = float(lx + R.uniform(-4, 4))
                    if (PLAZA[0] - 4 < lx < PLAZA[1] + 4 and y0 < 200) or (CANAL[0] - 3 < lx < CANAL[1] + 3 and y0 < 132):
                        continue
                    AR.lamp(self.lights, self.cam, pal, lx, y0 - 4.5, height(lx, y0 - 4.5), h=6.0, halo=1, pool=2 if ri < 6 else None, off=self.off(lx, y0), hsh=float(R.random()),
                            size=1.0 + 0.12 * ri)
        # Wahrzeichen: Uhrturm, Kirche, Hochhaeuser / landmarks: clock tower, church, tall buildings
        for (x, y, w, fl, crown) in ((-128, 150, 15, 12, 'clock'), (212, 196, 16, 12, 'spire'), (-236, 246, 18, 13, 'dome'), (272, 300, 17, 14, 'mast'),
                                     (-300, 352, 15, 12, 'clock'), (360, 420, 20, 15, 'spire'), (-190, 440, 18, 13, 'mast')):
            mb = self.mid if y < 400 else self.back
            mb.off = self.off(x, y)
            mb.push(x, y, height(x, y) - 2)
            AR.tower(mb, R, w, fl, pal, crown=crown, lit=self.lit)
            mb.pop()
        # Baeume auf den Terrassen / trees on the terraces
        for _ in range(150):
            x, y = float(R.uniform(-330, 460)), float(R.uniform(44, 600))
            if x < coast(y) + 20:
                continue
            ri = [i for i, r in enumerate(ROWS) if r[0] - 14 < y < r[0] - 3]
            if not ri or (PLAZA[0] < x < PLAZA[1] and y < 100) or (CANAL[0] - 4 < x < CANAL[1] + 4 and y < 134):
                continue
            mb = self.front if y < 130 else (self.mid if y < 400 else self.back)
            self._tree(mb, R, x, y)
        for sx in (-1, 1):
            for yy in (48, 58, 68, 78, 88):
                self._tree(self.front, R, BANK[0] + sx * 47, yy, kind=1)

    def _tree(self, mb, R, x, y, kind=None):
        z = height(x, y)
        kind = int(R.integers(0, 2)) if kind is None else kind
        g = A.cmix(R.choice(['forest700', 'olive600', 'forest500', 'jungle600']), 'ink700', R.uniform(0.15, 0.4))
        mb.cyl(x, y, z - 1, 0.35, 3.0, A.cmix('timber', 'ink700', 0.4), n=5)
        if kind == 1:
            h = R.uniform(9, 14)
            mb.revolve(x, y, [(0.3, z + 1.5), (1.7, z + 3.5), (1.3, z + h * 0.6), (0.0, z + h)], g, n=7)
        else:
            r = R.uniform(3.0, 5.0)
            mb.revolve(x, y, [(0.4, z + 1.8), (r, z + 1.8 + r * 0.6), (r * 0.85, z + 1.8 + r * 1.3), (0.0, z + 1.8 + r * 1.9)], g, n=8)

    # ----- Hafen / harbour -----
    def _harbour(self, R):
        mb, pal = self.front, self.pal
        # Kisten, Faesser, Netze auf der Promenade / crates, barrels on the promenade
        for cx in (-300, -240, -128, -60, 132, 180, 372, 420):
            AR.crates(mb, R, cx, 9.5, QUAY_Z, int(R.integers(5, 12)), pal, spread=7)
        # Gelaender an der Freitreppe und Promenadenmauer / balustrade at the esplanade
        for sx in (-1, 1):
            x = BANK[0] + sx * 52
            mb.box(x - 0.5, 40, QUAY_Z, x + 0.5, 70, QUAY_Z + 5.6, A.cmix('paper100', 'paper200', 0.5), g0=0.3, g1=1.0, top=pal.trim)

    def _far(self, R):
        """Ferne Viertel auf den Huegeln: schlichte Koerper mit Fensterlicht / far districts on the hills: plain bodies with window light"""
        mb, pal = self.back, self.pal
        for _ in range(760):
            x, y = float(R.uniform(-900, 1700)), float(R.uniform(610, 1380))
            if x < coast(y) + 30:
                continue
            if (x - NEXUS[0]) ** 2 + (y - NEXUS[1]) ** 2 < 170 ** 2:
                continue
            if A._noise2(1, 1, 1.0, int(abs(x) // 140 * 31 + y // 140))[0, 0] < 0.3:
                continue
            w, d = float(R.uniform(18, 46)), float(R.uniform(18, 34))
            fl = int(R.integers(3, 9))
            z = height(x, y) - 3
            mb.off = self.off(x, y)
            wall = pal.walls[R.integers(0, len(pal.walls))]
            mb.push(x, y, z)
            mb.box(-w / 2, -d / 2, 0, w / 2, d / 2, fl * 4.2 + 3, wall, mat=S.MAT[R.choice(['res', 'office', 'res'])], bay=4.4, floor=4.2, uo=int(R.integers(0, 300)) * 2,
                   g0=0.0, g1=1.0, dens=self.lit * 0.9, top=pal.roofs[R.integers(0, len(pal.roofs))])
            if R.random() < 0.3:
                mb.frustum(-w / 2, -d / 2, w / 2, d / 2, fl * 4.2 + 3, 5.0, min(w, d) * 0.4, pal.roofs[R.integers(0, len(pal.roofs))])
            mb.pop()
        for _ in range(14):
            x, y = float(R.uniform(-800, 900)), float(R.uniform(640, 1250))
            if x < coast(y) + 30:
                continue
            if (x - NEXUS[0]) ** 2 + (y - NEXUS[1]) ** 2 < 220 ** 2 or abs(x - (BANK[0] + (y - BANK[1]) * 0.12)) < 150:
                continue
            mb.off = self.off(x, y)
            mb.push(x, y, height(x, y) - 3)
            AR.tower(mb, R, float(R.uniform(22, 32)), int(R.integers(9, 15)), pal, lit=self.lit, fh=4.2)
            mb.pop()

    def _nexus(self, R):
        """
        Rechenzentrum von NEXUS auf dem Kamm: fensterlose Scheiben mit kalten Lichtbaendern, Kuehltuerme, Sendemast.
        Es bleibt an, wenn alles andere erlischt. / the NEXUS data centre on the ridge: windowless slabs with cold bands
        of light, cooling towers, a transmitter mast. It stays lit when everything else dies.
        """
        shot = self.shot
        nm = [W.arch_mat(shot, name='nexus_plain'), W.arch_mat(shot, tex=S.facade('glass'), name='nexus_glass', glass='sky900',
                                                                 win_cols=('nexusGlow', 'nexusIce', 'nexusGlow', 'water300', 'nexusGlow')),
              W.sprite_mat('nexus_halo', attr_col=True, add=True, shape='disc', keep=0.85), W.sprite_mat('nexus_beam', attr_col=True, add=True, shape='hfade', keep=0.9)]
        mb = W.MeshB()
        mb.off, mb.dens = W.NEVER, self.nexus_lit
        x0, y0 = NEXUS
        z = height(x0, y0) - 4
        steel = A.cmix('nexusSteel', 'ink800', 0.72)
        mb.push(x0, y0, z, scale=1.35)
        mb.box(-190, -60, 0, 190, 70, 10, A.cmix('ink700', 'nexusSteel', 0.2), top=steel)
        for (cx, w, d, h) in ((-110, 120, 60, 58), (30, 130, 66, 82), (150, 70, 60, 46), (-30, 60, 50, 34)):
            mb.box(cx - w / 2, -d / 2, 10, cx + w / 2, d / 2, 10 + h, steel, mat=1, bay=5.0, floor=4.6, uo=int(R.integers(0, 200)) * 2, g0=0.2, g1=1.0, top=AR._dk(steel, 0.7))
            mb.box(cx - w / 2 - 1, -d / 2 - 1, 10 + h, cx + w / 2 + 1, d / 2 + 1, 11.5 + h, 'nexusGlow', emit=min(1.0, self.nexus_lit * 1.3), bottom=True)
        for cx in (-176, 190):
            mb.revolve(cx, 30, [(22, 10), (15, 34), (17, 52)], A.cmix('smoke700', 'nexusSteel', 0.3), n=14, cap=False)
        mb.tube((30, 0, 92), (30, 0, 190), 2.2, steel, n=6, r2=0.5)
        for k in range(4):
            mb.cbox(30, 0, 108 + k * 22, 9 - k * 1.5, 9 - k * 1.5, 1.6, 'nexusGlow', emit=1.0)
        mb.pop()
        top = (x0 + 30 * 1.35, y0, z + 190 * 1.35)
        mb.card((x0 + 20, y0 - 40, z + 50), 520, 170, self.cam, 'nexusGlow', mat=2, alpha=0.4 * self.nexus_beam)
        mb.card(top, 60, 60, self.cam, 'nexusIce', mat=2, alpha=min(1.0, 1.2 * self.nexus_beam))
        # Lichtsaeule in den Himmel / pillar of light into the sky
        mb.card((top[0], top[1], top[2] + 330), 16, 660, self.cam, 'nexusGlow', mat=3, alpha=self.nexus_beam, up=(0, 0, 1))
        self.ob_nexus = mb.build(shot, 'nexus', nm, weld=True, shadow=False)
        self.nexus_top = top
        self.nexus_mats = nm

    # ----- Boden / ground -----
    def _ground(self):
        """Gemalter Boden: Pflaster der Promenade, Gleise, Strassen der Terrassen, Platz der Bank, Gruen / painted ground"""
        area = (-700.0, 0.0, 800.0, 1500.0)
        cv = S.Canvas(area, 4096, A.cmix('paper300', 'rock400', 0.45))
        cv.wash(A.cmix('grass600', 'olive600', 0.5), 0.75, 60, 3, thr=0.52, area=(-700, 600, 800, 1500))
        cv.wash(A.cmix('olive600', 'mud500', 0.4), 0.5, 110, 5, thr=0.55, area=(-700, 420, 800, 1500))
        stone, joint = A.cmix('paper200', 'rock400', 0.3), A.cmix('rock600', 'paper300', 0.35)
        asph = A.cmix('asphalt500', 'paper300', 0.25)
        for (y0, depth, _z) in ROWS:
            cv.rect(-700, y0 - 15, 800, y0 - 1, asph)
            cv.rect(-700, y0 - 15.6, 800, y0 - 15.0, A.cmix('paper100', 'rock400', 0.2))
            cv.rect(-700, y0 - 3.2, 800, y0 - 1.0, stone)
            for x in np.arange(-690, 800, 9.0):
                cv.rect(x, y0 - 8.3, x + 4.0, y0 - 7.9, A.hexc('paper100'), 0.7)
        for cx in CROSS:
            cv.rect(cx - 6, 16, cx + 6, 640, asph)
            for y in np.arange(20, 640, 3.0):
                cv.rect(cx - 6, y, cx + 6, y + 0.5, joint, 0.35)
        # Promenade: Plattenraster, Gleise, Kranschienen / promenade: slab grid, rails, crane rails
        cv.rect(-700, 0, 800, 16, stone)
        for x in np.arange(-700, 800, 4.0):
            cv.rect(x, 0, x + 0.3, 16, joint, 0.6)
        for y in (4.0, 8.0, 12.0):
            cv.rect(-700, y, 800, y + 0.3, joint, 0.6)
        for y in (10.0, 11.5):
            cv.rect(-700, y, 800, y + 0.35, A.hexc('ink700'), 0.85)
        cv.rect(-700, 0, 800, 1.0, A.cmix('paper50', 'rock400', 0.2))
        # Platz der Bank: Strahlenpflaster / the bank's square: radial paving
        cv.rect(PLAZA[0], 38, PLAZA[1], 214, A.cmix('paper100', 'paper200', 0.5))
        for k in range(11):
            y = 40 + k * 2.6
            cv.rect(PLAZA[0] + 12, y, PLAZA[1] - 12, y + 1.2, A.cmix('paper200', 'rock400', 0.35), 0.9)
        for x in np.arange(PLAZA[0], PLAZA[1], 6.0):
            cv.rect(x, 70, x + 0.35, 214, joint, 0.45)
        for y in np.arange(70, 214, 6.0):
            cv.rect(PLAZA[0], y, PLAZA[1], y + 0.35, joint, 0.45)
        cv.rect(BANK[0] - 9, 40, BANK[0] + 9, 100, A.cmix('meridonTeal', 'paper200', 0.6), 0.55)
        # Pfuetzen spiegeln den Himmel / puddles mirror the sky
        cv.wash(A.cmix('sunDusk', 'paper50', 0.4), 0.55, 9, 11, thr=0.66, area=(-700, 0, 800, 16))
        self.ground_img = cv.image('meridon_ground')
        self.ob_ground = S.ground(self.shot, height, (2700.0, 1700.0), (225, 150), self.ground_img, area, name='meridon_ground', loc=(650.0, 850.0, 0))
        # Pierdecke: eigenes Pflaster / the pier's top: own paving
        pc = S.Canvas((PIER[0], PIER[2], PIER[1], 0.0), 512, stone)
        for x in np.arange(PIER[0], PIER[1], 4.0):
            pc.rect(x, PIER[2], x + 0.3, 0, joint, 0.6)
        for y in np.arange(PIER[2], 0, 4.0):
            pc.rect(PIER[0], y, PIER[1], y + 0.3, joint, 0.6)
        for x in (PIER[0] + 5, PIER[0] + 14):
            pc.rect(x, PIER[2], x + 0.4, 0, A.hexc('ink700'), 0.85)
        pc.wash(A.cmix('sunDusk', 'paper50', 0.4), 0.5, 9, 13, thr=0.68)
        self.ob_pier = S.ground(self.shot, lambda x, y: QUAY_Z + 0.02, (PIER[1] - PIER[0], -PIER[2]), (2, 2), pc.image('meridon_pier'), (PIER[0], PIER[2], PIER[1], 0.0),
                                name='meridon_pier', loc=((PIER[0] + PIER[1]) / 2, PIER[2] / 2, 0))

    # ----- Schiffe / ships -----
    def _ship(self, name, builder, loc, rot, vel=(0, 0), wake=None, ink=1.3, bob=0.15, seed=1):
        if name in self.place:
            loc, rot, vel = self.place[name]
        R = np.random.default_rng(seed)
        mb = W.MeshB()
        mb.off = self.off(loc[0], max(0.0, loc[1]))
        info = builder(mb, R)
        ob = mb.build(self.shot, name, self.mats, ink=None, cam=self.cam)
        ob.location = Vector(loc)
        ob.rotation_euler = (0, 0, math.radians(rot))
        L.bpy.context.view_layer.update()
        W.add_ink(self.shot, ob, ink, self.cam)
        wk = None
        if wake:
            wm = W.MeshB()
            S.wake(wm, wake[0], wake[1], self.wake_col, 0, alpha=0.75)
            wk = wm.build(self.shot, name + '_wake', [W.sprite_mat('wake', attr_col=True)], weld=False, shadow=False)
            wk.parent = ob
        rec = {'ob': ob, 'loc': Vector(loc), 'vel': Vector((vel[0], vel[1], 0)), 'bob': bob, 'ph': seed * 1.7, 'info': info, 'rot': rot, 'wake': wk}
        self.moving.append(ob)
        self.ships.append(rec)
        return rec

    def _ships(self, R):
        pal = self.pal
        self.ships = []
        self.smokes = []
        g = self.sail_glow
        gold = A.cmix('sail', 'yellow400', 0.22)
        # Frachter am Kai rechts der Bank, unter den Kraenen / freighter at the quay right of the bank, below the cranes
        f1 = self._ship('freighter_quay', lambda mb, r: AR.freighter(mb, r, pal, length=112, beam=16, lit=self.lit, hull=A.cmix('sky800', 'meridonTeal', 0.25)), (182, -11.5, 0), 180,
                        seed=3, bob=0.0)
        # Frachter laeuft aus / freighter leaving
        f2 = self._ship('freighter_out', lambda mb, r: AR.freighter(mb, r, pal, length=58, beam=10.0, lit=self.lit, hull=A.cmix('rust', 'ink800', 0.45)), (-19, -60, 0), 174,
                        vel=(-3.0, 0.3), wake=(110, 13), seed=5, bob=0.1)
        self._ship('freighter_pier', lambda mb, r: AR.freighter(mb, r, pal, length=128, beam=18, lit=self.lit), (PIER[0] - 11.5, -118, 0), -90, seed=4, bob=0.0)
        # Segler / sailing ships
        self._ship('sail_near', lambda mb, r: AR.sailship(mb, r, pal, length=52, beam=10.5, masts=3, lit=1.0, glow=g, sail_col=gold), (-98, -206, 0), 172, vel=(-1.6, 0.2),
                   wake=(60, 9), seed=7, bob=0.25)
        self._ship('sail_far', lambda mb, r: AR.sailship(mb, r, pal, length=44, beam=9, masts=3, lit=1.0, glow=g, sail_col=gold), (-250, -360, 0), 20, vel=(1.1, 0.4), wake=(40, 7),
                   seed=9, bob=0.2)
        self._ship('sail_moor', lambda mb, r: AR.sailship(mb, r, pal, length=40, beam=8.5, masts=2, sails=False, lit=1.0), (-70, -9.5, 0), 0, seed=11, bob=0.08)
        self._ship('sail_moor2', lambda mb, r: AR.sailship(mb, r, pal, length=46, beam=9, masts=3, sails=False, lit=1.0), (-262, -10, 0), 180, seed=12, bob=0.08)
        for k, (loc, rot, vel) in enumerate((((-30, -70, 0), 10, (2.6, 0.4)), ((120, -230, 0), 190, (-3.4, -0.5)), ((-210, -60, 0), -30, (1.8, -1.0)), ((-120, -14, 0), 0, (0, 0)),
                                              ((60, -12, 0), 180, (0, 0)))):
            self._ship('boat%d' % k, lambda mb, r: AR.boat(mb, r, pal), loc, rot, vel=vel, wake=(16, 3.2) if vel[0] else None, seed=20 + k, bob=0.3)
        # Rauch der Schornsteine als gemalte Fahnen / funnel smoke as painted trails
        atlas = AT.puff_atlas('meridon_smoke', (3, 8, 14, 21), A.cmix('smoke400', 'sunDusk', 0.5), A.cmix('paper50', 'sunDusk', 0.45), rim=A.cmix('paper50', 'yellow400', 0.3),
                              flat_base=False, size=(256, 192), n=7)
        for k, (rec, n, sz, wind, rise) in enumerate(((f2, 14, (1.5, 6.5), (15.0, 4.0), 24.0), (f1, 12, (1.6, 7.5), (16.0, 5.0), 26.0))):
            tr = AT.Trail(self.shot, 'funnel%d' % k, atlas, n=n, size=sz, wind=wind, rise=rise, life=13.0, alpha=0.95, seed=5 + k, fade=0.8, tint=self.smoke_tint)
            self.smokes.append((tr, rec, rec['info']['funnel']))
        self._trams()

    def _trams(self):
        """Strassenbahnen auf der Promenade / trams on the promenade"""
        self.trams = []
        for k, (x0, v, col) in enumerate(((-300.0, 6.5, None), (150.0, -5.5, A.cmix('meridonOrange', 'paper100', 0.35)))):
            mb = W.MeshB()
            mb.off = self.off(x0, 0)
            ln = AR.tram(mb, self.pal, color=col)
            self.lights.off = mb.off
            ob = mb.build(self.shot, 'tram%d' % k, self.mats, ink=None)
            ob.location = (x0, 10.75, QUAY_Z + 0.05)
            L.bpy.context.view_layer.update()
            W.add_ink(self.shot, ob, 1.0, self.cam)
            self.trams.append((ob, x0, v))
            self.moving.append(ob)

    def _cranes(self, R):
        pal = self.pal
        self.cranes = []
        spots = [(PIER[0] + 9.5, -40, 80.0, 22.0), (PIER[0] + 9.5, -104, 100.0, 25.0), (PIER[0] + 9.5, -170, 70.0, 22.0), (-300, 9.5, 200.0, 20.0), (-232, 9.5, 160.0, 20.0),
                 (398, 9.5, 170.0, 21.0), (146, 9.5, 165.0, 23.0), (190, 9.5, 205.0, 21.0)]
        for i, (x, y, rot, h) in enumerate(spots):
            z = QUAY_Z
            self.thin.push(x, y, z)
            top = AR.crane_base(self.thin, pal, h=h)
            self.thin.pop()
            mb = W.MeshB()
            mb.off = self.off(x, y)
            AR.crane_top(mb, pal, jib=float(R.uniform(30, 38)))
            ob = mb.build(self.shot, 'crane%d' % i, self.mats, ink=None)
            ob.location = (x, y, z + top)
            ob.rotation_euler = (0, 0, math.radians(rot))
            L.bpy.context.view_layer.update()
            W.add_ink(self.shot, ob, 0.6, self.cam)
            self.cranes.append((ob, rot, float(R.uniform(14, 26)), float(R.uniform(0, 6.28)), float(R.uniform(0.12, 0.2))))
            self.moving.append(ob)

    def _flags(self, R):
        for i, (p, w) in enumerate(self.flag_pts):
            self.flags.append(AT.Flag(self.shot, p, w, w * 0.6, 'meridonTeal', stripe=('meridonOrange', lambda u, v: 0.34 < v < 0.67), wind=(1.0, 0.25), seed=i + 1))
        if hasattr(self, 'ships'):
            for k, rec in enumerate(self.ships[:4]):
                info = rec['info']
                if isinstance(info, dict) and 'flag' in info:
                    pass

    def _people(self, R):
        """Menschen auf Promenade und Freitreppe als Silhouetten (geben den Massstab) / people on the promenade and esplanade as silhouettes (they give the scale)"""
        kinds = ['gent', 'lady', 'carry', 'push', 'stand', 'woman', 'hat', 'carry', 'old', 'child']
        atlas = AT.people_atlas('meridon_people', kinds, A.cmix('ink800', 'sky800', 0.3), rim=A.cmix('sunDusk', 'yellow400', 0.4), light=(-1.0, 0.3), seed=4,
                                flip=[bool(i % 2) for i in range(len(kinds))])
        places = []
        for _ in range(110):
            x = float(R.uniform(-320, 200))
            if CANAL[0] - 3 < x < CANAL[1] + 3:
                continue
            places.append((x, float(R.uniform(1.5, 14.5)), QUAY_Z, int(R.integers(0, len(kinds)))))
        for _ in range(46):
            x, y = float(R.uniform(BANK[0] - 30, BANK[0] + 30)), float(R.uniform(42, 82))
            places.append((x, y, height(x, y), int(R.choice([0, 1, 4, 5, 6, 8]))))
        for _ in range(26):
            x, y = float(R.uniform(PIER[0] + 4, PIER[0] + 40)), float(R.uniform(PIER[2] + 6, -6))
            places.append((x, y, QUAY_Z, int(R.choice([2, 3, 7, 4]))))
        self.people = AT.people(self.shot, 'meridon_people', atlas, places, cam=self.cam)
        self.mirrored_people = self.people.ob

    # ----- Bewegung / motion -----
    def update(self, t, moving=None):
        """moving: eigene Zeit der Bewegung (bleibt beim Stillstand stehen); None = t / own time of the motion (stops at the standstill); None = t"""
        tm = t if moving is None else moving
        for rec in getattr(self, 'ships', []):
            ob = rec['ob']
            p = rec['loc'] + rec['vel'] * tm
            ob.location = (p.x, p.y, math.sin(tm * 0.9 + rec['ph']) * rec['bob'])
            ob.rotation_euler = (math.sin(tm * 0.7 + rec['ph']) * 0.012 * (rec['bob'] > 0), math.sin(tm * 0.53 + rec['ph'] * 2) * 0.008 * (rec['bob'] > 0), math.radians(rec['rot']))
        for ob, rot, amp, ph, sp in self.cranes:
            ob.rotation_euler = (0, 0, math.radians(rot + amp * math.sin(tm * sp + ph)))
        for f in self.flags:
            f.update(t)
        L.bpy.context.view_layer.update()
        for ob, x0, v in getattr(self, 'trams', []):
            ob.location.x = x0 + v * tm
        L.bpy.context.view_layer.update()
        for s, rec, (fx, fy, fz) in getattr(self, 'smokes', []):
            s.origin = np.array(rec['ob'].matrix_world @ Vector((fx, fy, fz)))
            s.update(tm)
        if self.pairs:
            S.mirror_follow(self.pairs[self.npairs_static:])
