/**
 * Weiche Landschaft: Uebergaenge zwischen verschiedenen Boeden, Sandstrand an der Kueste und Felsabbrueche an
 * Hoehenstufen zwischen Nachbarfeldern. Die Standardwelt bekommt geschwungene Saeume, Wiesenflecken und einen Bodenton
 * je Feld (NATURAL), Hoehle, Wueste und Alienwelt behalten die gezackten Streifen.
 * Soft landscape: transitions between different grounds, sandy beach at the coast and rock cliffs on height steps
 * between neighbouring tiles. The default world gets curved fringes, meadow patches and a ground tone per tile
 * (NATURAL); cavern, desert and alien world keep the jagged strips.
 */
import * as THREE from 'three';
import type { Tile } from '../core';
import { hex, semantic } from '../design/tokens';
import { withGlow } from './atmosphere';

/** Ab diesem Hoehenunterschied gibt es Felsen statt Streifen / from this height step on, rocks instead of strips */
export const CLIFF_STEP = 0.05;
/** Bis zu dieser Stufe zum Wasser gibt es Strand, darueber Felsen / up to this step down to the water a beach, above it rocks */
const BEACH_STEP = 0.14;
/** Halbe Feldbreite / half tile width */
const EDGE = 0.49;
const SEGMENTS = 7;
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const hash = (a: number, b: number, c: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Natuerliche Landschaft der Standardwelt (nur Optik). Alle Saeume liegen auf dem eigenen Feld und enden an der
 * Feldkante, das Raster bleibt also lesbar; ihre Breite laeuft entlang der Gitterlinie in Weltkoordinaten weiter, damit
 * eine Grenze ueber mehrere Felder als eine geschwungene Linie erscheint und nicht als Zackenreihe je Feld.
 * Natural landscape of the default world (visual only). Every fringe lies on its own tile and ends at the tile edge, so
 * the grid stays readable; its width continues along the grid line in world coordinates, so a border across several
 * tiles reads as one curved line instead of a row of teeth per tile.
 */
export const NATURAL = {
  /** Stuetzpunkte je Kante (hoch, niedrig) / samples per edge (high, low quality) */
  segments: { high: 10, low: 7 },
  /** Strand an flacher Kueste: Sandband [min, Zusatz], weicher Rand dahinter / beach on flat coasts: sand band [min, extra], soft rim behind it */
  beach: { min: 0.07, extra: 0.1, rim: 0.05, rimMix: 0.45 },
  /** Bewuchs greift ins kargere Nachbarfeld (Wald in Wiese, Wiese in Steppe und Wueste) / growth reaches into the barer neighbour */
  spill: { min: 0.025, extra: 0.135, rim: 0.045, rimMix: 0.5 },
  /** gleichrangige Boeden mischen sich beidseitig / grounds of equal rank blend on both sides */
  blend: { min: 0.04, extra: 0.06, rim: 0.06, mix: 0.5, rimMix: 0.25 },
  /** Wellenlaengen der Saumbreite in Feldern / wavelengths of the fringe width in tiles */
  wave: { long: 1.55, short: 0.68, shortShare: 0.4 },
  /** Viertelkreis an Aussenecken (Segmente) / quarter disc on outer corners (segments) */
  cornerSegments: 4,
  /** Bodenton je Feld: Helligkeit und Waerme in weichen Flecken ueber mehrere Felder, dazu ein wenig je Feld / ground tone per tile: lightness and warmth in soft patches across several tiles, plus a little per tile */
  tone: { light: 0.07, warm: 0.06, jitter: 0.012, scaleLight: 4.2, scaleWarm: 3.1 },
  /** Wiesenflecken: Anteil der Felder ohne, mit einem, sonst zwei; Radius; Farbfaktoren hell und dunkel / meadow patches: share of tiles with none, with one, otherwise two; radius; light and dark colour factors */
  patch: { none: 0.3, one: 0.75, rMin: 0.15, rMax: 0.29, light: 1.09, dark: 0.9, points: 9, lift: 0.0012 },
  /** Waldsaum: Wahrscheinlichkeit je Kante, Hoechstzahl je Wiesenfeld, Abstand von der Feldmitte / forest fringe: chance per edge, maximum per plains tile, distance from the tile centre */
  fringe: { chance: 0.7, max: 2, near: 0.3, far: 0.39, variants: 2 },
} as const;

/** Was die natuerliche Landschaft ueber ein Feld wissen muss / what the natural landscape needs to know about a tile */
export interface NaturalInput {
  seed: number;
  segments: number;
  /** Bewuchsrang; null = Feld ohne Saeume (z. B. Schlachtfeld) / growth rank; null = tile without fringes (e.g. battlefield) */
  rank: (t: Tile) => number | null;
  /** Farbton je Feld (Multiplikator) / tone per tile (multiplier) */
  tone: (x: number, y: number) => THREE.Color | null;
  /** Feld bekommt Wiesenflecken (freie Wiese) / tile gets meadow patches (free plains) */
  meadow?: (t: Tile, x: number, y: number) => boolean;
}

export interface LandInput {
  size: number;
  tiles: Tile[];
  explored: (x: number, y: number) => boolean;
  /** Oberflaechenfarbe (null fuer Wasser) / top colour (null for water) */
  topColor: (t: Tile) => string | null;
  top: (t: Tile) => number;
  /** fehlt = bisherige gezackte Streifen (Hoehle, Wueste, Alienwelt) / absent = the previous jagged strips (cavern, desert, alien world) */
  natural?: NaturalInput;
}

/**
 * Bewuchsrang eines Landfeldes: das hoehere greift mit einem geschwungenen Saum ins niedrigere. Wald zaehlt ueber der
 * Wiese seiner Landschaft, Xeno-Boden wuchert ueber alles.
 * Growth rank of a land tile: the higher one reaches into the lower one with a curved fringe. Forest ranks above the
 * plains of its biome, xeno ground overgrows everything.
 */
export function growthRank(t: Tile): number {
  if (t.xeno) return 8;
  const lush = !t.biome || t.biome === 'grassland' || t.biome === 'hills';
  const base = lush ? 4 : t.biome === 'jungle' ? 6 : t.biome === 'swamp' ? 3 : t.biome === 'steppe' ? 2 : t.biome === 'tundra' ? 1 : 0;
  return t.terrain === 'forest' ? base + (lush ? 1 : 0.5) : base;
}

/**
 * Flache Kueste mit Strand (sonst Felsen): kein Berg, keine hohe Stufe zum Wasser, kein Dschungelwald.
 * Flat coast with a beach (otherwise rocks): no mountain, no high step down to the water, no jungle forest.
 */
export function beachCoast(land: Tile, landTop: number, waterTop: number): boolean {
  return land.terrain !== 'mountain' && landTop - waterTop <= BEACH_STEP && !(land.terrain === 'forest' && land.biome === 'jungle');
}

/** Weiches Rauschen -1..1 aus Gitterwerten / smooth noise -1..1 from lattice values */
function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy) * 2 - 1;
}

/**
 * Bodenton eines Feldes als Farbmultiplikator: benachbarte Felder unterscheiden sich nur wenig, ganze Gegenden
 * driften heller, dunkler, gelblicher oder blaeulicher. Deterministisch aus Seed und Koordinaten.
 * Ground tone of a tile as a colour multiplier: neighbouring tiles differ only a little, whole regions drift lighter,
 * darker, yellower or bluer. Deterministic from seed and coordinates.
 */
export function groundTone(x: number, y: number, seed: number): THREE.Color {
  const T = NATURAL.tone, sd = (seed | 0) % 9973;
  const light = 1 + T.light * valueNoise(x / T.scaleLight + 11.3, y / T.scaleLight + 5.7, sd) + T.jitter * (hash(x, y, sd + 3) - 0.5) * 2;
  const warm = T.warm * valueNoise(x / T.scaleWarm + 40.1, y / T.scaleWarm + 17.9, sd + 7);
  return new THREE.Color(light * (1 + warm), light * (1 + warm * 0.25), light * (1 - warm));
}

export interface Cliff { m: THREE.Matrix4; color: THREE.Color }

/**
 * Uebergangsstreifen als ein Mesh mit Vertexfarben plus Felsen-Matrizen.
 * Transition strips as one mesh with vertex colours plus rock matrices.
 */
export function buildLandscape(inp: LandInput): { strips: THREE.BufferGeometry | null; cliffs: Cliff[] } {
  const { size, tiles, explored } = inp;
  const off = (size - 1) / 2;
  const pos: number[] = [], col: number[] = [];
  const cliffs: Cliff[] = [];
  const cA = new THREE.Color(), cB = new THREE.Color();
  const beach = new THREE.Color(hex(semantic.beach));
  const rock = new THREE.Color(hex(semantic.cliff));

  /** gezackter Streifen entlang einer Kante / jagged strip along an edge */
  const strip = (x: number, y: number, dx: number, dy: number, yTop: number, inner: number, outer: number, color: THREE.Color, layer: number) => {
    const cx = x - off, cz = y - off;
    const tx = -dy, tz = dx; // Tangente / tangent
    const pts: [number, number, number, number][] = [];
    for (let k = 0; k <= SEGMENTS; k++) {
      const s = -EDGE + (2 * EDGE * k) / SEGMENTS;
      // Zacken, an den Ecken schmaler / teeth, narrower at the corners
      const corner = 1 - Math.pow(Math.abs(s) / EDGE, 3) * 0.6;
      const w = (inner + (k % 2 ? 0.35 : -0.15) * inner + (hash(x * 4 + dx, y * 4 + dy, k) - 0.5) * inner * 0.5) * corner;
      const ox = cx + dx * (EDGE - outer) + tx * s, oz = cz + dy * (EDGE - outer) + tz * s;
      pts.push([ox, oz, ox - dx * w, oz - dy * w]);
    }
    const yy = yTop + 0.002 + layer * 0.0006;
    for (let k = 0; k < SEGMENTS; k++) {
      const [ax, az, aix, aiz] = pts[k], [bx, bz, bix, biz] = pts[k + 1];
      // zwei Dreiecke, nach oben gerichtet / two triangles, facing up
      const quad = [[ax, az], [aix, aiz], [bx, bz], [bx, bz], [aix, aiz], [bix, biz]];
      // Umlaufsinn so waehlen, dass die Normale nach oben zeigt / choose winding so the normal points up
      const cross = (aix - ax) * (bz - az) - (aiz - az) * (bx - ax);
      const order = cross < 0 ? quad : [quad[0], quad[2], quad[1], quad[3], quad[5], quad[4]];
      for (const [px, pz] of order) { pos.push(px, yy, pz); col.push(color.r, color.g, color.b); }
    }
  };

  // ---------- natuerliche Saeume der Standardwelt / natural fringes of the default world ----------
  const nat = inp.natural;
  const TAU = Math.PI * 2;
  const sd = nat ? (nat.seed | 0) % 9973 : 0;
  /** Phasen der Welle je Gitterlinie: [senkrecht, waagrecht] x [lang, kurz] / wave phases per grid line: [vertical, horizontal] x [long, short] */
  const phase = [0, 1].map((o) => Array.from({ length: nat ? size + 1 : 0 }, (_, line) => [hash(line, o ? 7 : 3, sd) * TAU, hash(line, o ? 13 : 11, sd + 1) * TAU]));
  /** Welle 0..1 entlang einer Gitterlinie; u = Feldkoordinate laengs der Linie / wave 0..1 along a grid line; u = tile coordinate along the line */
  const wave = (vertical: boolean, line: number, u: number) => {
    const W = NATURAL.wave, p = phase[vertical ? 0 : 1][line];
    return 0.5 + 0.5 * ((1 - W.shortShare) * Math.sin((u * TAU) / W.long + p[0]) + W.shortShare * Math.sin((u * TAU) / W.short + p[1]));
  };
  /**
   * Je erkundetem Feld einmal: Farbe (mit Bodenton), Hoehe, Rang. Unerkundete Felder bleiben null, sie gehen in keine
   * Entscheidung ein: Saeume verraten nie, was unter dem Nebel liegt.
   * Once per explored tile: colour (with ground tone), height, rank. Unexplored tiles stay null and enter no decision:
   * fringes never reveal what lies under the fog.
   */
  interface Cell { t: Tile; base: string | null; top: number; rank: number | null; color: THREE.Color }
  const cells: (Cell | null)[] = [];
  if (nat) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const t = tiles[y * size + x];
      if (!explored(x, y)) { cells.push(null); continue; }
      const base = inp.topColor(t);
      const color = new THREE.Color(base === null ? 0xffffff : hex(base));
      const tone = base === null ? null : nat.tone(x, y);
      if (tone) color.multiply(tone);
      cells.push({ t, base, top: inp.top(t), rank: base === null ? null : nat.rank(t), color });
    }
  }
  const seen = (x: number, y: number) => (x < 0 || y < 0 || x >= size || y >= size ? null : cells[y * size + x]);
  const NONE = 0, BEACH = 1, SPILL = 2, BLEND = 3;
  const SHAPE = [NATURAL.blend, NATURAL.beach, NATURAL.spill, NATURAL.blend];
  /**
   * Saum, den Feld B auf Feld A legt (beide erkundet): Strand vom Wasser her, Bewuchs vom ranghoeheren Land her,
   * beidseitige Mischung bei gleichem Rang. Ueber Eck (diagonal) gibt es nur Strand und Bewuchs.
   * Fringe that tile B lays onto tile A (both explored): beach from the water, growth from the higher-ranking land,
   * a blend on both sides at equal rank. Across a corner (diagonal) only beach and growth exist.
   */
  const fringeKind = (a: Cell | null, b: Cell | null, diagonal = false): number => {
    if (!a || !b || a.base === null || a.rank === null) return NONE;
    if (b.base === null) return beachCoast(a.t, a.top, b.top) ? BEACH : NONE;
    if (b.rank === null || Math.abs(a.top - b.top) >= CLIFF_STEP || b.base === a.base) return NONE;
    return b.rank > a.rank ? SPILL : b.rank === a.rank && !diagonal ? BLEND : NONE;
  };
  /** Farben des Saums von B auf A in cA (Flaeche) und cB (weicher Rand) / colours of the fringe of B on A in cA (body) and cB (soft rim) */
  const look = (a: Cell, b: Cell, kind: number) => {
    if (kind === BEACH) { cA.copy(a.color).lerp(beach, 0.9); cB.copy(a.color).lerp(beach, NATURAL.beach.rimMix); }
    else if (kind === SPILL) { cA.copy(b.color); cB.copy(b.color).lerp(a.color, NATURAL.spill.rimMix); }
    else { cA.copy(a.color).lerp(b.color, NATURAL.blend.mix); cB.copy(a.color).lerp(b.color, NATURAL.blend.rimMix); }
  };
  const yOf = (top: number, layer: number) => top + 0.002 + layer * 0.0003;
  const tri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number, yy: number, color: THREE.Color) => {
    // Umlaufsinn so waehlen, dass die Normale nach oben zeigt / choose winding so the normal points up
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0) pos.push(ax, yy, az, bx, yy, bz, cx, yy, cz);
    else pos.push(ax, yy, az, cx, yy, cz, bx, yy, bz);
    col.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
  };
  const widths: number[] = [];
  /** geschwungenes Band entlang einer Kante: Breiten aus widths plus extra / curved band along an edge: widths from widths plus extra */
  const band = (x: number, y: number, dx: number, dy: number, yy: number, extra: number, color: THREE.Color) => {
    const n = nat!.segments, cx = x - off, cz = y - off, tx = -dy, tz = dx;
    let px = 0, pz = 0, pix = 0, piz = 0;
    for (let k = 0; k <= n; k++) {
      const s = -EDGE + (2 * EDGE * k) / n, w = widths[k] + extra;
      const ox = cx + dx * EDGE + tx * s, oz = cz + dy * EDGE + tz * s, ix = ox - dx * w, iz = oz - dy * w;
      if (k) { tri(px, pz, pix, piz, ox, oz, yy, color); tri(ox, oz, pix, piz, ix, iz, yy, color); }
      px = ox; pz = oz; pix = ix; piz = iz;
    }
  };
  /** Viertelellipse in der Feldecke (sx, sy), Halbachsen rx und rz / quarter ellipse in the tile corner (sx, sy), semi-axes rx and rz */
  const corner = (x: number, y: number, sx: number, sy: number, yy: number, rx: number, rz: number, color: THREE.Color) => {
    const n = NATURAL.cornerSegments, cx = x - off + sx * EDGE, cz = y - off + sy * EDGE;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * (Math.PI / 2), a1 = ((k + 1) / n) * (Math.PI / 2);
      tri(cx, cz, cx - sx * rx * Math.cos(a0), cz - sy * rz * Math.sin(a0), cx - sx * rx * Math.cos(a1), cz - sy * rz * Math.sin(a1), yy, color);
    }
  };
  const lineOf = (x: number, y: number, dx: number, dy: number) => (dx ? x + (dx > 0 ? 1 : 0) : y + (dy > 0 ? 1 : 0));
  /**
   * Wiesenflecken: ein bis zwei flache, unregelmaessige Flecken in etwas hellerem oder dunklerem Ton, ganz innerhalb
   * des Feldes. Sie liegen unter den Saeumen und unter allen Bodenmarken (deren Tiefenversatz ist groesser).
   * Meadow patches: one or two flat irregular patches in a slightly lighter or darker tone, entirely inside the tile.
   * They lie below the fringes and below all ground marks (whose depth offset is larger).
   */
  const patches = (x: number, y: number, top: number, base: THREE.Color) => {
    const P = NATURAL.patch, pick = hash(x, y, sd + 21);
    const count = pick < P.none ? 0 : pick < P.one ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const h = (k: number) => hash(x * 3 + i, y * 3 + k, sd + 23);
      const r = P.rMin + (P.rMax - P.rMin) * h(0), squash = 0.6 + 0.4 * h(1), turn = h(2) * Math.PI;
      const room = EDGE - 0.02 - r, cosT = Math.cos(turn), sinT = Math.sin(turn);
      const px = x - off + (h(3) - 0.5) * 2 * room, pz = y - off + (h(4) - 0.5) * 2 * room;
      cA.copy(base).multiplyScalar(h(5) < 0.5 ? P.light : P.dark);
      let lx = 0, lz = 0;
      for (let k = 0; k <= P.points; k++) {
        const a = ((k % P.points) / P.points) * TAU, rr = r * (0.7 + 0.3 * hash(k % P.points, i + x * 7, y + sd));
        const ex = Math.cos(a) * rr, ez = Math.sin(a) * rr * squash;
        const qx = px + ex * cosT - ez * sinT, qz = pz + ex * sinT + ez * cosT;
        if (k) tri(px, pz, lx, lz, qx, qz, top + P.lift, cA);
        lx = qx; lz = qz;
      }
    }
  };
  const natural = (x: number, y: number, c: Cell) => {
    if (nat!.meadow?.(c.t, x, y)) patches(x, y, c.top, c.color);
    for (let dir = 0; dir < 4; dir++) {
      const [dx, dy] = DIRS[dir];
      const n = seen(x + dx, y + dy);
      if (!n) continue;
      const kind = fringeKind(c, n);
      if (kind) {
        const S = SHAPE[kind], line = lineOf(x, y, dx, dy), vertical = dx !== 0, layer = kind === BEACH ? 10 : 0, segs = nat!.segments;
        for (let k = 0; k <= segs; k++) widths[k] = S.min + S.extra * wave(vertical, line, (dx ? y : x) + (dx ? dx : -dy) * (-EDGE + (2 * EDGE * k) / segs));
        look(c, n, kind);
        band(x, y, dx, dy, yOf(c.top, layer + dir), S.rim, cB);
        band(x, y, dx, dy, yOf(c.top, layer + 4 + dir), 0, cA);
        continue;
      }
      // Felsen wie bisher: an Bergen und hohen Stufen zum Wasser, an Hoehenstufen im Land / rocks as before: on mountains and high steps to the water, on height steps inland
      if (n.base === null) { if (c.t.terrain === 'mountain' || c.top - n.top > BEACH_STEP) addCliff(x, y, dx, dy, c.top, n.top + 0.06); }
      else if (c.top - n.top >= CLIFF_STEP) addCliff(x, y, dx, dy, c.top, n.top);
    }
    // Aussenecken: das Nachbarfeld ueber Eck rundet seinen Saum auf diesem Feld ab / outer corners: the diagonal neighbour rounds off its fringe on this tile
    for (let i = 0; i < 4; i++) {
      const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1;
      const d = seen(x + sx, y + sy), kind = fringeKind(c, d, true);
      if (!kind || !d) continue;
      const o1 = seen(x, y + sy), o2 = seen(x + sx, y);
      if (!o1 || !o2 || Math.abs(o1.top - c.top) >= CLIFF_STEP || Math.abs(o2.top - c.top) >= CLIFF_STEP) continue;
      if (fringeKind(o1, d) !== kind || fringeKind(o2, d) !== kind) continue;
      const S = SHAPE[kind], layer = kind === BEACH ? 18 : 8;
      const rx = S.min + S.extra * wave(true, lineOf(x, y + sy, sx, 0), y + sy * 0.5);
      const rz = S.min + S.extra * wave(false, lineOf(x + sx, y, 0, sy), x + sx * 0.5);
      look(c, d, kind);
      corner(x, y, sx, sy, yOf(c.top, layer), rx + S.rim, rz + S.rim, cB);
      corner(x, y, sx, sy, yOf(c.top, layer + 1), rx, rz, cA);
    }
  };
  if (nat) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const c = cells[y * size + x]; if (c && c.base !== null) natural(x, y, c); }

  // bisherige gezackte Streifen (Hoehle, Wueste, Alienwelt) / the previous jagged strips (cavern, desert, alien world)
  for (let y = 0; !nat && y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!explored(x, y)) continue;
      const t = tiles[y * size + x];
      const own = inp.topColor(t);
      if (own === null) continue;
      const top = inp.top(t);
      cA.set(hex(own));
      DIRS.forEach(([dx, dy], dir) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || !explored(nx, ny)) return;
        const n = tiles[ny * size + nx];
        const other = inp.topColor(n);
        const ntop = inp.top(n);
        const step = top - ntop;
        if (other === null) {
          // Kueste: Sandstrand auf flachem Land, Felsen an Bergen und Huegeln / coast: beach on flat land, rocks on mountains and hills
          if (t.terrain === 'mountain' || step > BEACH_STEP) addCliff(x, y, dx, dy, top, ntop + 0.06);
          else if (t.terrain !== 'forest' || t.biome !== 'jungle') {
            strip(x, y, dx, dy, top, 0.07, 0, cB.copy(cA).lerp(beach, 0.8), dir + 5);
            strip(x, y, dx, dy, top, 0.13, 0, cB.copy(cA).lerp(beach, 0.4), dir);
          }
          return;
        }
        if (step >= CLIFF_STEP) { addCliff(x, y, dx, dy, top, ntop); return; }
        if (Math.abs(step) >= CLIFF_STEP || other === own) return;
        // weicher Uebergang in zwei Stufen / soft transition in two steps
        cB.set(hex(other));
        strip(x, y, dx, dy, top, 0.06, 0, cB.clone().lerp(cA, 0.5), dir + 5);
        strip(x, y, dx, dy, top, 0.14, 0, cB.clone().lerp(cA, 0.75), dir);
      });
    }
  }

  function addCliff(x: number, y: number, dx: number, dy: number, top: number, low: number) {
    const h = top - low;
    if (h < CLIFF_STEP * 0.8) return;
    const cx = x - off, cz = y - off;
    const tx = -dy, tz = dx;
    const t = tiles[y * size + x];
    // Felsfarbe leicht nach Landschaft getoent / rock colour slightly tinted by biome
    const tint = inp.topColor(t);
    const color = rock.clone();
    if (tint && t.terrain !== 'mountain') color.lerp(new THREE.Color(hex(tint)), 0.25);
    const n = 3;
    for (let k = 0; k < n; k++) {
      const r = hash(x * 3 + dx * 7, y * 3 + dy * 5, k);
      const s = -0.32 + (0.64 * k) / (n - 1) + (r - 0.5) * 0.1;
      const w = 0.24 + r * 0.12;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(cx + dx * (EDGE + 0.005) + tx * s, low + h * 0.48, cz + dy * (EDGE + 0.005) + tz * s),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dy) + (r - 0.5) * 0.4),
        new THREE.Vector3(w, h * (0.95 + r * 0.2), 0.1 + r * 0.05),
      );
      cliffs.push({ m, color: color.clone().multiplyScalar(0.92 + r * 0.16) });
    }
  }

  if (!pos.length) return { strips: null, cliffs };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  withGlow(g, 'none');
  return { strips: g, cliffs };
}

let rockGeo: THREE.BufferGeometry | null = null;
/** Kantiger Felsbrocken (Einheitsgroesse, Vertexfarben hell oben, dunkel unten) / angular rock (unit size, light top, dark bottom) */
export function cliffRock(): THREE.BufferGeometry {
  if (rockGeo) return rockGeo;
  // Polyeder sind schon nicht indiziert / polyhedra are already non-indexed
  const g = new THREE.DodecahedronGeometry(0.62, 0);
  g.scale(1, 0.85, 1);
  g.computeVertexNormals();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const light = new THREE.Color(hex(semantic.white)), dark = new THREE.Color(hex(semantic.cliffDark)).lerp(light, 0.35);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = nor.getY(i) > 0.3 ? light : dark;
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  rockGeo = withGlow(g, 'none');
  return rockGeo;
}
