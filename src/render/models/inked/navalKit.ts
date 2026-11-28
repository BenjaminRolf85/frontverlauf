/**
 * Gezeichnete Einheiten, Gruppe See und Fremde: Bausteine fuer Schiffe, Fremdmaschinen und Sonderbauarten.
 * Inked units, group sea and aliens: building blocks for ships, alien machines and special designs.
 *
 * Ergaenzt uvkit.ts um Formen, die dort fehlen: Flaeche aus einem Punktgitter (Bordwand, Segel), Schiffsrumpf aus
 * Stationen, Schlauch entlang einer Kurve (Tentakel, Beine, Masten), Loft entlang z, Vieleck-Auflage (Buntglas) und
 * Nacharbeit der fertigen Geometrie (Ruhestellung und Schwenkgrenze der Tuerme, Muendung). Nichts hier aendert den
 * Baukasten selbst; die Liste steht in der Uebergabe, damit sie spaeter in uvkit.ts / trim.ts wandern kann.
 * Adds shapes uvkit.ts lacks: a surface from a point grid (ship side, sail), a ship hull from stations, a tube along a
 * curve (tentacles, legs, masts), a loft along z, a polygon decal (stained glass) and post-processing of the built
 * geometry (rest heading and traverse limit of turrets, muzzle). Nothing here changes the kit itself; the list is in
 * the hand-back so it can move into uvkit.ts / trim.ts later.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { semantic } from '../../../design/tokens';
import { col, filmSeg, fine, softBox, type ColorLike, type TurretRange, type V3, type Xf } from '../kit';
import { digitDecal, emblemDecal } from './trim';
import { AtlasLayout, loft, projectBox, REF, UvBuilder, type BoxFaces, type PartOpts, type Region, type Ring } from './uvkit';

export const HALF_PI = Math.PI / 2;
/** geschlossene Spitze eines Lofts / closed tip of a loft */
export const TIP = 1e-7;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

// ---------- Nacharbeit / post-processing ----------

/**
 * fn auf die fertige Geometrie anwenden (userData), ohne den Baukasten zu aendern: build() wird umhuellt.
 * Apply fn to the built geometry (userData) without changing the kit: build() is wrapped.
 */
export function onBuild(b: UvBuilder, fn: (g: THREE.BufferGeometry) => void): UvBuilder {
  const base = b.build.bind(b);
  b.build = () => { const g = base(); fn(g); return g; };
  return b;
}
/**
 * Ruhestellung (yaw, rad um y) und Schwenkgrenze (arc) der Tuerme in Baureihenfolge nachtragen: UvBuilder.turret kennt
 * beide nicht (Heckturm zeigt nach -z, Schiffstuerme schwenken hoechstens 135 Grad).
 * Add the rest heading (yaw, rad about y) and traverse limit (arc) of the turrets in build order: UvBuilder.turret knows
 * neither (an aft turret points to -z, ship turrets traverse at most 135 degrees).
 */
export function turretInfo(b: UvBuilder, info: { yaw?: number; arc?: number }[]): UvBuilder {
  return onBuild(b, (g) => {
    const t = g.userData.turrets as TurretRange[] | undefined;
    if (!t) return;
    g.userData.turrets = t.map((r, i): TurretRange => ({ ...r, yaw: info[i]?.yaw ?? r.yaw, ...(info[i]?.arc !== undefined ? { arc: info[i].arc } : {}) }));
  });
}

// ---------- Gitterflaeche / grid surface ----------

export interface GridOpts {
  region: Region;
  /** Bereichskoordinaten je Punkt / region coordinates per point */
  st: (i: number, j: number) => [number, number];
  /** Richtung nach aussen (Vorzeichen der Normalen) / outward direction (sign of the normals) */
  out: (p: THREE.Vector3) => THREE.Vector3;
  /** Zeilen j mit harter Kante / rows j with a hard edge */
  hard?: number[];
  /** Farbe der Felder ab Zeile j / colour of the quads from row j on */
  rowColor?: (j: number) => ColorLike | undefined;
  color?: ColorLike;
}

/**
 * Glatte Flaeche aus einem Punktgitter P[i][j] (i entlang, j quer) mit Normalen aus den Nachbarn, UV je Punkt und
 * Farbe je Zeile. Entartete Dreiecke (zusammenfallende Punkte am Bug) fallen weg.
 * Smooth surface from a point grid P[i][j] (i along, j across) with normals from the neighbours, UV per point and a
 * colour per row. Degenerate triangles (coinciding points at the bow) are dropped.
 */
export function gridSurface(P: THREE.Vector3[][], o: GridOpts): THREE.BufferGeometry {
  const n = P.length, m = P[0].length;
  const hard = new Set(o.hard ?? []);
  const du = new THREE.Vector3(), dv = new THREE.Vector3();
  const normal = (i: number, j: number, row: number): THREE.Vector3 => {
    const h = hard.has(j) || j === 0 || j === m - 1;
    const ja = h ? row : j - 1, jb = h ? row + 1 : j + 1;
    let ia = Math.max(0, i - 1), ib = Math.min(n - 1, i + 1);
    // zusammenfallende Nachbarn ueberspringen / skip coinciding neighbours
    if (P[ib][j].distanceToSquared(P[ia][j]) < 1e-12) { ia = Math.max(0, i - 2); ib = Math.min(n - 1, i + 2); }
    du.copy(P[ib][j]).sub(P[ia][j]);
    dv.copy(P[i][jb]).sub(P[i][ja]);
    const out = new THREE.Vector3().crossVectors(du, dv);
    const want = o.out(P[i][j]);
    if (out.lengthSq() < 1e-20) return want.clone().normalize();
    out.normalize();
    if (out.dot(want) < 0) out.negate();
    return out;
  };
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], colr: number[] = [];
  let cc = col(o.color ?? semantic.white);
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  type Vtx = { p: THREE.Vector3; n: THREE.Vector3; st: [number, number] };
  const put = (v: Vtx) => {
    pos.push(v.p.x, v.p.y, v.p.z); nor.push(v.n.x, v.n.y, v.n.z);
    uv.push((o.region.x + v.st[0] * o.region.w) / REF, (o.region.y + v.st[1] * o.region.h) / REF);
    colr.push(cc.r, cc.g, cc.b);
  };
  const tri = (a: Vtx, b: Vtx, c: Vtx) => {
    fn.crossVectors(e1.copy(b.p).sub(a.p), e2.copy(c.p).sub(a.p));
    if (fn.lengthSq() < 1e-22) return;
    const flip = fn.dot(e1.copy(a.n).add(b.n).add(c.n)) < 0;
    for (const v of flip ? [a, c, b] : [a, b, c]) put(v);
  };
  for (let j = 0; j < m - 1; j++) {
    const rc = o.rowColor?.(j);
    if (rc !== undefined) cc = col(rc);
    for (let i = 0; i < n - 1; i++) {
      const v = (ii: number, jj: number): Vtx => ({ p: P[ii][jj], n: normal(ii, jj, j), st: o.st(ii, jj) });
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      tri(a, b, c); tri(a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}

/** Ebenes Vieleck (Faecher um den ersten Punkt) mit eigenen Bereichskoordinaten je Ecke / flat polygon (fan around the first point) with region coordinates per corner */
export function polygon(pts: V3[], r: Region, st: [number, number][]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) for (const k of [0, i, i + 1]) {
    pos.push(...pts[k]);
    uv.push((r.x + st[k][0] * r.w) / REF, (r.y + st[k][1] * r.h) / REF);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/**
 * Vieleck-Auflage knapp ueber einer Flaeche: Mitte c, Normale n, Bildoberkante nach up, Umriss in -1..1 (x nach rechts,
 * y nach oben). Die Vertexfarbe ist frei waehlbar: mit einer Leuchtfarbe leuchtet die ganze Auflage (Buntglas).
 * Polygon decal just above a surface: centre c, normal n, image top towards up, outline in -1..1 (x right, y up). The
 * vertex colour is free: with a glow colour the whole decal glows (stained glass).
 */
export function polyDecal(b: UvBuilder, A: AtlasLayout, cell: string, c: V3, n: V3, up: V3, w: number, h: number, outline: [number, number][], color: ColorLike, o: PartOpts = {}, lift = 0.003): void {
  const N = V(n).normalize(), U = V(up);
  U.addScaledVector(N, -U.dot(N)).normalize();
  const R = new THREE.Vector3().crossVectors(U, N);
  const C = V(c).addScaledVector(N, lift);
  const pts = outline.map(([sx, sy]): V3 => { const v = C.clone().addScaledVector(R, (sx * w) / 2).addScaledVector(U, (sy * h) / 2); return [v.x, v.y, v.z]; });
  const st = outline.map(([sx, sy]): [number, number] => [(sx + 1) / 2, (1 - sy) / 2]);
  // nach aussen gewickelt: Umriss gegen den Uhrzeigersinn von aussen gesehen / wound outward: outline counter-clockwise as seen from outside
  const e1 = V(pts[1]).sub(V(pts[0])), e2 = V(pts[2]).sub(V(pts[0]));
  const ccw = new THREE.Vector3().crossVectors(e1, e2).dot(N) > 0;
  b.add(polygon(ccw ? pts : [...pts].reverse(), A.get(cell), ccw ? st : [...st].reverse()), color, { crease: 0, ...o });
}

// ---------- Schiffsrumpf / ship hull ----------

/**
 * Zeile der Bordwand von oben nach unten: h = Anteil der Deckhoehe (1 = Deck, 0 = Wasserlinie) plus dy, k = Anteil der
 * Decksbreite, rake = Versatz nach achtern am Bug (Steven faellt zurueck), t = Lage in der Zelle, c = Farbe ab hier.
 * Row of the ship side from top to bottom: h = share of the deck height (1 = deck, 0 = waterline) plus dy, k = share of
 * the deck beam, rake = shift aft at the bow (the stem falls back), t = position in the cell, c = colour from here on.
 */
export interface HullRow { h: number; dy?: number; k: number; rake?: number; t: number; c?: ColorLike; hard?: boolean }

export interface HullSpec {
  /** Decksumriss vom Heck zum Bug: [z, halbe Breite] / deck outline from stern to bow: [z, half beam] */
  outline: [number, number][];
  /** Deckhoehe (Sprung) / deck height (sheer) */
  deckY: (z: number) => number;
  rows: HullRow[];
  /** ab hier beginnt der Bug (fuer rake) / the bow starts here (for rake) */
  bowZ: number;
  side: Region;
  /** Deck: Bereich, Farbe, Einzug gegen die Bordwand (Anteil), Hoehe unter der Oberkante / deck: region, colour, inset against the side (share), drop below the top edge */
  deck?: { region: Region; color: ColorLike; inset: number; drop: number; lip: ColorLike };
  /** Offener Laderaum statt Deck: Boden, breiter Dollbord / open well instead of a deck: floor, wide gunwale */
  well?: { region: Region; floor: number; inset: number; floorColor: ColorLike; wall: ColorLike; lip: ColorLike; lipRegion?: Region };
  /** Heckspiegel / transom */
  transom?: Region;
  /** stumpfer Bug (Rampe, Prahm): Bugspiegel / blunt bow (ramp, barge): bow plate */
  bowPlate?: Region;
}

/** Decksumriss mit rundem Bug und leicht eingezogenem Heck: [z, halbe Breite] / deck outline with a round bow and a slightly drawn-in stern */
export function shipOutline(z0: number, z1: number, beam: number, bow: number, stern = 0.8, n = fine() ? 9 : 6, power = 0.8): [number, number][] {
  const w = beam / 2;
  const out: [number, number][] = [[z0, w * stern], [z0 + 0.03, w * (stern + (1 - stern) * 0.75)], [z0 + 0.075, w]];
  const zb = z1 - bow;
  const mid = fine() ? 3 : 2;
  for (let i = 1; i <= mid; i++) out.push([z0 + 0.075 + ((zb - z0 - 0.075) * i) / (mid + 1), w]);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * HALF_PI;
    out.push([zb + bow * Math.sin(a), i === n ? 0 : w * Math.pow(Math.cos(a), power)]);
  }
  return out;
}

/** Punkte der Bordwand einer Seite (sx = 1 oder -1) / points of one ship side (sx = 1 or -1) */
function sidePoints(h: HullSpec, sx: number): THREE.Vector3[][] {
  const z1 = h.outline[h.outline.length - 1][0];
  return h.outline.map(([z, w]) => h.rows.map((r) => {
    const f = Math.max(0, Math.min(1, (z - h.bowZ) / Math.max(1e-6, z1 - h.bowZ)));
    return new THREE.Vector3(sx * w * r.k, r.h * h.deckY(z) + (r.dy ?? 0), z - (r.rake ?? 0) * f * f * (3 - 2 * f));
  }));
}

/**
 * Rumpf: zwei glatte Bordwaende (Zelle side: s = Bug -> Heck, auf beiden Seiten gleich; t je Zeile), Deck oder offener
 * Laderaum (Zelle: s = Heck -> Bug, t = quer von Steuerbord nach Backbord), Dollbord, Heckspiegel.
 * Hull: two smooth ship sides (cell side: s = bow -> stern, the same on both sides; t per row), deck or open well
 * (cell: s = stern -> bow, t = across from starboard to port), gunwale, transom.
 */
export function shipHull(b: UvBuilder, h: HullSpec): void {
  const z0 = h.outline[0][0], z1 = h.outline[h.outline.length - 1][0];
  const S = (z: number) => (z1 - z) / (z1 - z0);
  const wMax = Math.max(...h.outline.map((o) => o[1]));
  const hard = h.rows.map((r, j) => (r.hard ? j : -1)).filter((j) => j >= 0);
  const n = h.outline.length;
  for (const sx of [1, -1]) {
    const P = sidePoints(h, sx);
    b.add(gridSurface(P, {
      region: h.side, hard, color: h.rows[0].c,
      st: (i, j) => [S(h.outline[i][0]), h.rows[j].t],
      out: () => new THREE.Vector3(sx, 0.15, 0),
      rowColor: (j) => h.rows[j].c,
    }), null);
  }
  // Deck oder Laderaum / deck or well
  const top = (i: number) => h.rows[0].h * h.deckY(h.outline[i][0]) + (h.rows[0].dy ?? 0);
  const rim = (i: number, sx: number, k: number, y: number) => new THREE.Vector3(sx * h.outline[i][1] * h.rows[0].k * k, y, h.outline[i][0] - (1 - k) * 0.02 * (i === n - 1 ? 1 : 0));
  // die Deckszelle reicht quer genau ueber die groesste Decksbreite / across, the deck cell spans exactly the widest deck beam
  const flat = (rows: (i: number, sx: number) => THREE.Vector3, region: Region, color: ColorLike, opts: PartOpts = {}) => {
    const P: THREE.Vector3[][] = [];
    for (let i = 0; i < n; i++) P.push([rows(i, 1), rows(i, -1)]);
    const wd = Math.max(1e-6, ...P.map((r) => Math.abs(r[0].x)));
    b.add(gridSurface(P, { region, color, st: (i, j) => [1 - S(h.outline[i][0]), 0.5 + (j ? 1 : -1) * (Math.abs(P[i][j].x) / (2 * wd))], out: () => new THREE.Vector3(0, 1, 0) }), null, opts);
  };
  const strip = (a: (i: number, sx: number) => THREE.Vector3, c: (i: number, sx: number) => THREE.Vector3, color: ColorLike, region: Region | undefined, outY: number) => {
    for (const sx of [1, -1]) {
      const P: THREE.Vector3[][] = [];
      for (let i = 0; i < n; i++) P.push([a(i, sx), c(i, sx)]);
      b.add(gridSurface(P, { region: region ?? b.blank, color, st: (i, j) => (region ? [S(h.outline[i][0]), j] : [0.5, 0.5]), out: () => new THREE.Vector3(-sx * (1 - Math.abs(outY)), outY, 0) }), null);
    }
  };
  if (h.deck) {
    const d = h.deck;
    flat((i, sx) => rim(i, sx, d.inset, top(i) - d.drop), d.region, d.color);
    if (d.drop > 1e-4) strip((i, sx) => rim(i, sx, 1, top(i)), (i, sx) => rim(i, sx, d.inset, top(i) - d.drop), d.lip, undefined, 0.6);
  }
  if (h.well) {
    const w = h.well;
    strip((i, sx) => rim(i, sx, 1, top(i)), (i, sx) => rim(i, sx, w.inset, top(i)), w.lip, w.lipRegion, 1);
    strip((i, sx) => rim(i, sx, w.inset, top(i)), (i, sx) => rim(i, sx, w.inset, w.floor), w.wall, undefined, 0);
    flat((i, sx) => rim(i, sx, w.inset, w.floor), w.region, w.floorColor);
  }
  for (const [region, at, dir] of [[h.transom, 0, -1], [h.bowPlate, n - 1, 1]] as [Region | undefined, number, number][]) {
    if (!region) continue;
    const P = [sidePoints(h, 1)[at], sidePoints(h, -1)[at]];
    b.add(gridSurface(P, {
      region, hard, color: h.rows[0].c,
      st: (i, j) => [0.5 + (i ? 1 : -1) * dir * (Math.abs(P[i][j].x) / (2 * wMax)), h.rows[j].t],
      out: () => new THREE.Vector3(0, 0, dir), rowColor: (j) => h.rows[j].c,
    }), null);
  }
}

/**
 * Wanne (Steuerstand, MG-Stand): Wand aussen, Rand oben, dunkle Oeffnung knapp darunter; die Besatzung ragt bis zur
 * Brust heraus. Eine echte Innenwand gibt es nicht (ein Loft zeigt immer nach aussen), die dunkle Flaeche liegt
 * deshalb dicht unter dem Rand.
 * Tub (helm, MG position): outer wall, rim on top, a dark opening just below it; the crew sticks out up to the chest.
 * There is no real inner wall (a loft always faces outward), so the dark area sits close below the rim.
 */
export function tub(b: UvBuilder, A: AtlasLayout, p: V3, rx: number, rz: number, h: number, color: ColorLike, o: { cell?: string; e?: number; wall?: number; seg?: number; rim?: ColorLike } = {}): void {
  const e = o.e ?? 4, t = o.wall ?? 0.007, seg = o.seg ?? (fine() ? 16 : 10);
  // Rand von aussen nach innen: so zeigt der flache Ring nach oben / rim from outside to inside: that way the flat ring faces up
  b.add(loft([
    { y: 0, rx: rx * 1.03, rz: rz * 1.03, e, c: color }, { y: h, rx, rz, e, hard: true, c: o.rim ?? color }, { y: h, rx: rx - t, rz: rz - t, e, hard: true },
  ], { seg, region: A.get(o.cell ?? 'blank'), t0: 1, t1: 0 }), null, { xf: { p } });
  b.add(loft([{ y: h - 0.004, rx: rx - t, rz: rz - t, e, hard: true }, { y: h - 0.006, rx: rx - t, rz: rz - t, e }], { seg, region: A.get('blank'), capFirst: true, color: col(color).clone().multiplyScalar(0.32) }), null, { xf: { p }, crease: 0 });
}

// ---------- Schlauch entlang einer Kurve / tube along a curve ----------

/** Glatte Kurve durch Punkte (Catmull-Rom) / smooth curve through points (Catmull-Rom) */
export function curve3(pts: V3[], per: number): V3[] {
  const n = pts.length;
  if (n < 3 || per < 2) return pts.slice();
  const at = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  const out: V3[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  out.push(pts[n - 1]);
  return out;
}
/** Quadratische Bezierkurve / quadratic Bezier curve */
export function bez3(a: V3, c: V3, e: V3, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * e[0], u * u * a[1] + 2 * u * t * c[1] + t * t * e[1], u * u * a[2] + 2 * u * t * c[2] + t * t * e[2]]);
  }
  return out;
}

export interface SweepOpts {
  seg: number;
  region: Region;
  color?: ColorLike;
  /** Farbe ab Anteil t der Laenge / colour from share t of the length */
  colorAt?: (t: number) => ColorLike | undefined;
  /** Richtung, zu der die Mitte der Zelle (s = 0.5) zeigt / direction the middle of the cell (s = 0.5) faces */
  face?: V3;
  /** Querschnitt gestaucht: [zur Seite, in Richtung face] / squashed cross-section: [sideways, towards face] */
  squash?: [number, number];
  capStart?: boolean; capEnd?: boolean;
  t0?: number; t1?: number;
}

/**
 * Schlauch entlang eines Pfads mit Radius je Punkt: glatte Normalen, UV s rundum (Naht gegenueber face), t entlang der
 * Bogenlaenge. Radius TIP schliesst das Ende.
 * Tube along a path with a radius per point: smooth normals, UV s around (seam opposite face), t along the arc length.
 * A radius of TIP closes the end.
 */
export function sweep(path: V3[], radius: number | ((t: number, i: number) => number), o: SweepOpts): THREE.BufferGeometry {
  const m = path.length, n = Math.max(3, Math.round(filmSeg(o.seg)));
  const C = path.map(V);
  const acc = [0];
  for (let i = 1; i < m; i++) acc.push(acc[i - 1] + C[i].distanceTo(C[i - 1]));
  const total = acc[m - 1] || 1;
  const T = acc.map((v) => v / total);
  const rad = T.map((t, i) => (typeof radius === 'number' ? radius : radius(t, i)));
  const tan = C.map((_, i) => C[Math.min(m - 1, i + 1)].clone().sub(C[Math.max(0, i - 1)]).normalize());
  // Rahmen mitfuehren / transport the frame
  const face = V(o.face ?? [0, 0, 1]);
  let nrm = face.clone().addScaledVector(tan[0], -face.dot(tan[0]));
  if (nrm.lengthSq() < 1e-8) nrm.set(1, 0, 0).addScaledVector(tan[0], -tan[0].x);
  nrm.normalize();
  const P: THREE.Vector3[][] = [], N: THREE.Vector3[][] = [];
  const sq = o.squash ?? [1, 1];
  for (let i = 0; i < m; i++) {
    nrm = nrm.clone().addScaledVector(tan[i], -nrm.dot(tan[i])).normalize();
    const bin = new THREE.Vector3().crossVectors(tan[i], nrm);
    const row: THREE.Vector3[] = [], nr: THREE.Vector3[] = [];
    for (let j = 0; j <= n; j++) {
      const a = (j / n) * Math.PI * 2 - Math.PI;
      const cs = Math.cos(a) * sq[1], sn = Math.sin(a) * sq[0];
      const d = nrm.clone().multiplyScalar(cs).addScaledVector(bin, sn);
      row.push(C[i].clone().addScaledVector(d, rad[i]));
      // Normale der Ellipse / normal of the ellipse
      nr.push(nrm.clone().multiplyScalar(Math.cos(a) / sq[1]).addScaledVector(bin, Math.sin(a) / sq[0]).normalize());
    }
    row[n].copy(row[0]);
    P.push(row); N.push(nr);
  }
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], colr: number[] = [];
  let cc = col(o.color ?? semantic.white);
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? 1;
  type Vtx = { p: THREE.Vector3; n: THREE.Vector3; s: number; t: number };
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  const tri = (a: Vtx, b: Vtx, c: Vtx) => {
    fn.crossVectors(e1.copy(b.p).sub(a.p), e2.copy(c.p).sub(a.p));
    if (fn.lengthSq() < 1e-22) return;
    const flip = fn.dot(e1.copy(a.n).add(b.n).add(c.n)) < 0;
    for (const v of flip ? [a, c, b] : [a, b, c]) {
      pos.push(v.p.x, v.p.y, v.p.z); nor.push(v.n.x, v.n.y, v.n.z);
      uv.push((o.region.x + v.s * o.region.w) / REF, (o.region.y + v.t * o.region.h) / REF);
      colr.push(cc.r, cc.g, cc.b);
    }
  };
  const tip = (i: number) => rad[i] < 1e-6;
  for (let i = 0; i < m - 1; i++) {
    const c = o.colorAt?.(T[i]);
    if (c !== undefined) cc = col(c);
    for (let j = 0; j < n; j++) {
      const v = (ii: number, jj: number): Vtx => ({
        p: P[ii][jj], n: tip(ii) ? tan[ii].clone().multiplyScalar(ii === 0 ? -1 : 1) : N[ii][jj],
        s: jj / n, t: t0 + (t1 - t0) * T[ii],
      });
      const a = v(i, j), b2 = v(i + 1, j), c2 = v(i + 1, j + 1), d = v(i, j + 1);
      tri(a, b2, c2); tri(a, c2, d);
    }
  }
  const cap = (i: number, dir: number) => {
    if (tip(i)) return;
    const nn = tan[i].clone().multiplyScalar(dir);
    const mk = (p: THREE.Vector3): Vtx => ({ p, n: nn, s: 0.5, t: t0 + (t1 - t0) * T[i] });
    for (let j = 0; j < n; j++) tri(mk(C[i]), mk(P[i][j]), mk(P[i][j + 1]));
  };
  if (o.capStart) { const c = o.colorAt?.(0); if (c !== undefined) cc = col(c); else if (o.color) cc = col(o.color); cap(0, -1); }
  if (o.capEnd) { const c = o.colorAt?.(1); if (c !== undefined) cc = col(c); cap(m - 1, 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}

/** Duenner Stab zwischen zwei Punkten (Mast, Antenne, Reling) ohne Zeichnung / thin rod between two points (mast, antenna, rail) without drawing */
export function rod(b: UvBuilder, a: V3, c: V3, r: number, color: ColorLike, o: PartOpts & { r1?: number; seg?: number; cap?: boolean } = {}): void {
  b.add(sweep([a, c], (t) => r + ((o.r1 ?? r) - r) * t, { seg: o.seg ?? (fine() ? 6 : 4), region: b.blank, color, capStart: o.cap, capEnd: o.cap ?? true, face: Math.abs(c[1] - a[1]) > Math.hypot(c[0] - a[0], c[2] - a[2]) ? [0, 0, 1] : [0, 1, 0] }), null, { crease: 0, ...o });
}

// ---------- Lofts ----------

/** Ring eines Lofts entlang z: Halbachsen rx (quer), ry (nach oben, ryB nach unten) / ring of a loft along z: half axes rx (across), ry (up, ryB down) */
export interface ZRing { z: number; rx: number; ry?: number; ryB?: number; cx?: number; cy?: number; e?: number; hard?: boolean; c?: ColorLike }

/**
 * Loft entlang +z (Ringe in steigender z-Folge): die Mitte der Zelle (s = 0.5) liegt oben, die Naht unten, t laeuft
 * vom ersten zum letzten Ring.
 * Loft along +z (rings in ascending z order): the middle of the cell (s = 0.5) is on top, the seam below, t runs from
 * the first to the last ring.
 */
export function loftZ(rings: ZRing[], o: Omit<Parameters<typeof loft>[1], 'region'> & { region: Region }): THREE.BufferGeometry {
  const g = loft(rings.map((r): Ring => ({ y: -r.z, rx: r.rx, rz: r.ry ?? r.rx, rzB: r.ryB ?? r.ry ?? r.rx, cx: r.cx, cz: r.cy, e: r.e, hard: r.hard, c: r.c })), o);
  g.applyMatrix4(new THREE.Matrix4().makeRotationX(-HALF_PI));
  return g;
}

/** Kugel oder Ellipsoid als Loft (t von oben nach unten) / sphere or ellipsoid as a loft (t from top to bottom) */
export function ballRings(r: number, ry = r, rows = fine() ? 7 : 4, c?: ColorLike, a0 = 0, a1 = Math.PI): Ring[] {
  const out: Ring[] = [];
  // Filmexport: mehr Breitenkreise / film export: more rows of latitude
  rows = Math.round(filmSeg(rows));
  for (let i = 0; i <= rows; i++) {
    const a = a0 + ((a1 - a0) * i) / rows;
    out.push({ y: Math.cos(a) * ry, rx: Math.max(TIP, Math.sin(a) * r), ...(i === 0 && c !== undefined ? { c } : {}) });
  }
  return out;
}
/** Kugel hinzufuegen / add a ball */
export function ball(b: UvBuilder, A: AtlasLayout, p: V3, r: number, color: ColorLike, o: PartOpts & { cell?: string; ry?: number; rows?: number; seg?: number; s?: V3 } = {}): void {
  b.add(loft(ballRings(r, o.ry ?? r, o.rows), { seg: o.seg ?? (fine() ? 14 : 9), region: A.get(o.cell ?? 'blank'), arc: true, color }), null, { xf: { p, s: o.s, ...(o.xf ?? {}) }, crease: 0, ...o });
}

/** Weicher Quader mit Wuerfelprojektion / soft box with box projection */
export function crate(b: UvBuilder, w: number, h: number, d: number, r: number, faces: BoxFaces, color: ColorLike, xf: Xf, o: PartOpts = {}): void {
  b.add(projectBox(softBox(w, h, d, r), faces), color, { xf, ...o });
}

/**
 * Gewoelbte Flaeche zwischen vier Ecken (Segel, Flagge, Banner), beidseitig: a oben vorn, c oben hinten, d unten hinten,
 * e unten vorn; bulge woelbt entlang der Normalen.
 * Bulged sheet between four corners (sail, flag, banner), two-sided: a top fore, c top aft, d bottom aft, e bottom fore;
 * bulge bows it along the normal.
 */
export function sheet(b: UvBuilder, corners: [V3, V3, V3, V3], bulge: number, region: Region, color: ColorLike, o: PartOpts & { nu?: number; nv?: number; back?: ColorLike; backRegion?: Region; thick?: number } = {}): void {
  const [a, c, d, e] = corners.map(V);
  const nu = o.nu ?? (fine() ? 4 : 2), nv = o.nv ?? (fine() ? 4 : 2);
  const nn = new THREE.Vector3().crossVectors(c.clone().sub(a), e.clone().sub(a));
  // dreieckiges Segel: a und c fallen zusammen / triangular sail: a and c coincide
  if (nn.lengthSq() < 1e-12) nn.crossVectors(d.clone().sub(a), e.clone().sub(a));
  nn.normalize();
  const P: THREE.Vector3[][] = [];
  for (let i = 0; i <= nu; i++) {
    const row: THREE.Vector3[] = [];
    for (let j = 0; j <= nv; j++) {
      const u = i / nu, v = j / nv;
      const top = a.clone().lerp(c, u), bot = e.clone().lerp(d, u);
      row.push(top.lerp(bot, v).addScaledVector(nn, bulge * Math.sin(u * Math.PI) * Math.sin(v * Math.PI)));
    }
    P.push(row);
  }
  // Vorder- und Rueckseite liegen eine Tuchstaerke auseinander: zwei deckungsgleiche Flaechen stoeren den Tuscheumriss
  // (die umgestuelpte Huelle der einen laege in der anderen)
  // front and back lie one cloth thickness apart: two coincident faces upset the ink silhouette (the inverted hull of
  // one would lie inside the other)
  const thick = o.thick ?? 0.005;
  for (const side of [1, -1]) {
    const Q = side > 0 ? P : P.map((row) => row.map((p) => p.clone().addScaledVector(nn, -thick)));
    b.add(gridSurface(Q, { region: side > 0 ? region : (o.backRegion ?? region), color: side > 0 ? color : (o.back ?? color), st: (i, j) => [side > 0 ? i / nu : 1 - i / nu, j / nv], out: () => nn.clone().multiplyScalar(side) }), null, { crease: 0, ...o });
  }
}

/**
 * Texturkoordinaten aller Ecken eben von oben in den Bereich legen (Untertasse, Panzerruecken): Mitte (cx, cz),
 * Halbmesser R, Bug (+z) oben im Bild, +x links wie bei projectBox; below spiegelt fuer die Unterseite.
 * Put the texture coordinates of all vertices flat from above into the region (saucer, carapace): centre (cx, cz),
 * radius R, bow (+z) at the top of the image, +x on the left as in projectBox; below mirrors for the underside.
 */
export function planarY(g: THREE.BufferGeometry, region: Region, R: number, cx = 0, cz = 0, below = false): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const cl = (v: number) => Math.max(0.01, Math.min(0.99, v));
  for (let i = 0; i < pos.count; i++) {
    const s = cl(0.5 + ((below ? 1 : -1) * (pos.getX(i) - cx)) / (2 * R)), t = cl(0.5 - (pos.getZ(i) - cz) / (2 * R));
    uv[i * 2] = (region.x + s * region.w) / REF;
    uv[i * 2 + 1] = (region.y + t * region.h) / REF;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Flacher Ring auf Hoehe y (Bodenwelle, Lichtkranz) / flat ring at height y (ground ripple, light ring) */
export function flatRing(b: UvBuilder, p: V3, r: number, half: number, color: ColorLike, o: PartOpts & { rz?: number; seg?: number } = {}): void {
  const k = (o.rz ?? r) / r;
  b.add(loft([{ y: 0, rx: r + half, rz: (r + half) * k, hard: true }, { y: 0, rx: r - half, rz: (r - half) * k, hard: true }], { seg: o.seg ?? (fine() ? 28 : 14), region: b.blank, color }), null, { xf: { p }, crease: 0, ...o });
}

/**
 * Ringwulst (Sonnenkranz, Leuchtring) um die lokale y-Achse: R = Ringhalbmesser, r = Rohrhalbmesser; ohne Zeichnung.
 * Torus (sun halo, glow ring) around the local y axis: R = ring radius, r = tube radius; without drawing.
 */
export function torus(b: UvBuilder, p: V3, R: number, r: number, color: ColorLike, o: PartOpts & { seg?: number; tube?: number; rot?: V3; rz?: number } = {}): void {
  const n = o.seg ?? (fine() ? 24 : 12), m = o.tube ?? (fine() ? 6 : 4);
  const k = (o.rz ?? R) / R;
  const P: THREE.Vector3[][] = [], C: THREE.Vector3[][] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((i % n) / n) * Math.PI * 2;
    const c = new THREE.Vector3(Math.sin(a) * R, 0, Math.cos(a) * R * k);
    const row: THREE.Vector3[] = [], cr: THREE.Vector3[] = [];
    for (let j = 0; j <= m; j++) {
      const t = ((j % m) / m) * Math.PI * 2;
      row.push(new THREE.Vector3(Math.sin(a) * (R + Math.cos(t) * r), Math.sin(t) * r, Math.cos(a) * (R + Math.cos(t) * r) * k));
      cr.push(c);
    }
    P.push(row); C.push(cr);
  }
  // Normale = Richtung von der Rohrmitte weg / normal = direction away from the tube centre
  const centre = new Map<THREE.Vector3, THREE.Vector3>();
  P.forEach((row, i) => row.forEach((q, j) => centre.set(q, C[i][j])));
  b.add(gridSurface(P, { region: b.blank, color, st: () => [0.5, 0.5], out: (q) => q.clone().sub(centre.get(q)!) }), null, { xf: { p, r: o.rot }, crease: 0, ...o });
}

/** Ebenes Vieleck, so gewickelt, dass es nach out zeigt / flat polygon wound so that it faces out */
export function polygonOut(pts: V3[], out: V3, r: Region, st: [number, number][]): THREE.BufferGeometry {
  const e1 = V(pts[1]).sub(V(pts[0])), e2 = V(pts[2]).sub(V(pts[0]));
  const ok = new THREE.Vector3().crossVectors(e1, e2).dot(V(out)) > 0;
  return polygon(ok ? pts : [...pts].reverse(), r, ok ? st : [...st].reverse());
}

/**
 * Kettenschleife ohne modellierte Raeder: Laufflaeche als Band (Zelle tread: s quer, t einmal rundum), Aussenseite als
 * ebene Flaeche (Zelle side: dort sind Laufrollen und Treibrad GEZEICHNET), Innenseite dunkel. Fuer Fahrzeuge mit
 * vielen Ketten (Goettlicher Funke), bei denen runningGear() das Budget sprengt.
 * Track loop without modelled wheels: tread as a band (cell tread: s across, t once around), outer side as a flat face
 * (cell side: road wheels and sprocket are DRAWN there), inner side dark. For vehicles with many tracks (Divine
 * Spark) where runningGear() would blow the budget.
 */
export function trackLoop(b: UvBuilder, x: number, w: number, len: number, h: number, tread: Region, side: Region | null, color: ColorLike, outer = 1): void {
  const r = h / 2, half = len / 2 - r;
  const k = fine() ? 6 : 4;
  const loop: [number, number][] = [];
  for (let i = 0; i <= k; i++) { const a = -Math.PI / 2 + (i / k) * Math.PI; loop.push([half + Math.cos(a) * r, r + Math.sin(a) * r]); }
  for (let i = 0; i <= k; i++) { const a = Math.PI / 2 + (i / k) * Math.PI; loop.push([-half + Math.cos(a) * r, r + Math.sin(a) * r]); }
  loop.push(loop[0]);
  const P = loop.map(([z, y]) => [new THREE.Vector3(x - w / 2, y, z), new THREE.Vector3(x + w / 2, y, z)]);
  const acc = [0];
  for (let i = 1; i < loop.length; i++) acc.push(acc[i - 1] + Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]));
  b.add(gridSurface(P, { region: tread, color, st: (i, j) => [j, acc[i] / acc[acc.length - 1]], out: (q) => new THREE.Vector3(0, q.y - r, Math.abs(q.z) > half ? q.z - Math.sign(q.z) * half : 0) }), null, { crease: 0.5 });
  // Seitenflaechen nur, wo man sie sieht: side = null laesst beide weg (Ketten zwischen anderen Ketten)
  // side faces only where they show: side = null drops both (tracks between other tracks)
  if (!side) return;
  for (const s of [1, -1]) {
    const face = s * outer > 0 ? side : null;
    const xs = x + (s * w) / 2;
    const pts: V3[] = loop.slice(0, -1).map(([z, y]): V3 => [xs, y, z]);
    const st = loop.slice(0, -1).map(([z, y]): [number, number] => [0.5 - (s * outer * z) / len, 1 - y / h]);
    b.add(polygonOut(pts, [s, 0, 0], face ?? b.blank, face ? st : st.map((): [number, number] => [0.5, 0.5])), face ? color : col(color).clone().multiplyScalar(0.6), { crease: 0.4 });
  }
}

/**
 * Hoheitszeichen: aufgemaltes Farbfeld mit dem Emblem der Fraktion und optional einer Kennnummer daneben. Das Feld in
 * eigener Farbe macht die Auflage zur gewollten Flaeche: eine Auflage direkt auf der Bordwand faellt sonst leicht in
 * einen anderen Tonwert als die Wand (eigene Normale, eigene Verdeckung an nur vier Ecken) und steht als blasses
 * Rechteck da.
 * Insignia: a painted colour field with the faction's emblem and optionally a number beside it. The field in its own
 * colour makes the decal a deliberate area: a decal straight on the ship side otherwise easily lands in another tone
 * than the wall (own normal, own occlusion at just four corners) and shows as a pale rectangle.
 */
export function insignia(b: UvBuilder, A: AtlasLayout, f: FactionId, c: V3, n: V3, size: number, field: ColorLike, digits: number[] = [], up: V3 = [0, 1, 0]): void {
  const N = V(n).normalize(), U = V(up);
  U.addScaledVector(N, -U.dot(N)).normalize();
  const R = new THREE.Vector3().crossVectors(U, N);
  const at = (d: number): V3 => { const v = V(c).addScaledVector(R, d); return [v.x, v.y, v.z]; };
  const w = size * 1.18 + (digits.length ? digits.length * size * 0.5 + size * 0.1 : 0);
  polyDecal(b, A, 'blank', at((w - size * 1.18) / 2), n, up, w, size * 1.18, [[-1, -1], [1, -1], [1, 1], [-1, 1]], field, { crease: 1 }, 0.0014);
  emblemDecal(b, A, f, c, n, size, field, up);
  digits.forEach((d, i) => digitDecal(b, A, d, at(size * 0.86 + i * size * 0.5), n, size * 0.8, field, up));
}
