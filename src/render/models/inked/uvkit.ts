/**
 * Gezeichnete Einheiten: Baukasten fuer Modelle MIT Texturkoordinaten.
 * Inked units: toolkit for models WITH texture coordinates.
 *
 * Wie kit.ts entsteht jedes Modell aus wenigen Teilen und wird zu einer nicht-indizierten Geometrie verschmolzen.
 * Neu: jedes Teil bekommt UVs in einen Bereich eines Atlas (AtlasLayout), dazu je Ecke einen Glanzwert und ein
 * Gewicht fuer die Knicklinien der Tusche. Die Farbe der Fraktion bleibt in den Vertexfarben; die Textur traegt nur
 * neutrale Zeichnung (siehe atlas.ts), deshalb genuegt eine Textur fuer alle Fraktionen.
 * Like kit.ts every model is made of a few parts and merged into one non-indexed geometry. New: every part gets UVs
 * into a region of an atlas (AtlasLayout), plus a gloss value and a weight for the ink crease lines per vertex. The
 * faction colour stays in the vertex colours; the texture only carries neutral drawing (see atlas.ts), so one texture
 * serves every faction.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder, col, fine, withDetail, xfMatrix, type ColorLike, type TurretRange, type V3, type Xf } from '../kit';
import { semantic } from '../../../design/tokens';

// ---------- Atlas ----------

/** Bereich im Atlas in Bezugspixeln (Atlas = REF x REF) / region of the atlas in reference pixels (atlas = REF x REF) */
export interface Region { name: string; x: number; y: number; w: number; h: number }

/** Bezugsgroesse des Atlas; die echte Textur darf kleiner oder groesser sein / reference atlas size; the real texture may be smaller or larger */
export const REF = 1024;

/**
 * Aufteilung des Atlas in Bereiche (Regalverfahren, deterministisch). Geometrie und Malerei benutzen dieselbe Aufteilung.
 * Layout of the atlas into regions (shelf packing, deterministic). Geometry and painting share the same layout.
 */
export class AtlasLayout {
  readonly regions = new Map<string, Region>();
  private cx: number;
  private cy: number;
  private rowH = 0;
  constructor(readonly pad = 8) {
    this.cx = pad;
    this.cy = pad;
  }
  alloc(name: string, w: number, h: number): Region {
    if (this.regions.has(name)) throw new Error(`atlas: region ${name} exists`);
    w = Math.round(w); h = Math.round(h);
    if (this.cx + w + this.pad > REF) { this.cx = this.pad; this.cy += this.rowH + this.pad; this.rowH = 0; }
    if (this.cy + h + this.pad > REF) throw new Error(`atlas: full at ${name}`);
    const r: Region = { name, x: this.cx, y: this.cy, w, h };
    this.cx += w + this.pad;
    this.rowH = Math.max(this.rowH, h);
    this.regions.set(name, r);
    return r;
  }
  /** Bereich an fester Stelle (Ueberlappung wird abgelehnt) / region at a fixed place (overlap is rejected) */
  place(name: string, x: number, y: number, w: number, h: number): Region {
    if (this.regions.has(name)) throw new Error(`atlas: region ${name} exists`);
    if (x < 0 || y < 0 || x + w > REF || y + h > REF) throw new Error(`atlas: ${name} outside`);
    for (const o of this.regions.values()) {
      if (x < o.x + o.w + this.pad && o.x < x + w + this.pad && y < o.y + o.h + this.pad && o.y < y + h + this.pad) throw new Error(`atlas: ${name} overlaps ${o.name}`);
    }
    const r: Region = { name, x, y, w, h };
    this.regions.set(name, r);
    return r;
  }
  get(name: string): Region {
    const r = this.regions.get(name);
    if (!r) throw new Error(`atlas: no region ${name}`);
    return r;
  }
  /** Belegte Hoehe in Bezugspixeln / used height in reference pixels */
  get usedHeight(): number { return Math.max(0, ...[...this.regions.values()].map((r) => r.y + r.h)) + this.pad; }
}

/** Bereichskoordinate (s nach rechts, t nach unten, 0..1) in Atlas-UV / region coordinate (s right, t down, 0..1) to atlas UV */
function atlasUV(r: Region, s: number, t: number, out: number[]): void {
  out.push((r.x + s * r.w) / REF, (r.y + t * r.h) / REF);
}

// ---------- Drehkoerper mit freiem Querschnitt / loft ----------

/**
 * Ring eines Loft-Koerpers: Hoehe y, Halbachsen rx (quer) und rz (nach vorn, rzB nach hinten), Mittelpunkt cx / cz,
 * Exponent e des Querschnitts (2 = Ellipse, 4 = fast Rechteck), harte Kante, Farbe ab diesem Ring.
 * Ring of a loft: height y, half axes rx (across) and rz (forward, rzB backward), centre cx / cz, exponent e of the
 * cross-section (2 = ellipse, 4 = nearly a rectangle), hard edge, colour from this ring on.
 */
export interface Ring { y: number; rx: number; rz?: number; rzB?: number; cx?: number; cz?: number; e?: number; hard?: boolean; c?: ColorLike }

export interface LoftOpts {
  seg: number;
  region: Region;
  /** Ausschnitt des Bereichs / sub-range of the region */
  s0?: number; s1?: number; t0?: number; t1?: number;
  /** t nach Bogenlaenge statt nach Hoehe (Kuppeln) / t by arc length instead of height (domes) */
  arc?: boolean;
  /** Deckel am ersten / letzten Ring; mit Bereich: eben projiziert / cap at the first / last ring; with a region: planar */
  capFirst?: boolean | Region;
  capLast?: boolean | Region;
  color?: ColorLike;
}

/** t-Werte der Ringe wie im Loft (fuer die Malerei) / t values of the rings as in the loft (for the painting) */
export function ringT(rings: Ring[], arc = false): number[] {
  const m = rings.length;
  if (!arc) {
    const y0 = rings[0].y, y1 = rings[m - 1].y;
    return rings.map((r, i) => (Math.abs(y1 - y0) < 1e-9 ? i / (m - 1) : (r.y - y0) / (y1 - y0)));
  }
  const acc = [0];
  for (let i = 1; i < m; i++) {
    const a = rings[i - 1], b = rings[i];
    acc.push(acc[i - 1] + Math.hypot(b.y - a.y, Math.max(b.rx, b.rz ?? b.rx) - Math.max(a.rx, a.rz ?? a.rx), (b.cz ?? 0) - (a.cz ?? 0)));
  }
  return acc.map((v) => v / (acc[m - 1] || 1));
}

const sgnPow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

/**
 * Loft entlang y: Ringe mit freiem Querschnitt, glatte Normalen, UV zylindrisch (s = Umfang, Naht hinten, vorn bei
 * s = 0.5, +x bei 0.75; t vom ersten zum letzten Ring). Deckt Kapsel, Zylinder, Kuppel und Drehkoerper ab.
 * Loft along y: rings with a free cross-section, smooth normals, cylindrical UV (s = around, seam at the back, front at
 * s = 0.5, +x at 0.75; t from the first to the last ring). Covers capsule, cylinder, dome and turned parts.
 */
export function loft(rings: Ring[], o: LoftOpts): THREE.BufferGeometry {
  const m = rings.length, n = Math.max(3, Math.round(o.seg));
  const P: THREE.Vector3[][] = [];
  for (const r of rings) {
    const row: THREE.Vector3[] = [];
    const p = 2 / (r.e ?? 2);
    for (let j = 0; j <= n; j++) {
      const a = (j / n) * Math.PI * 2 - Math.PI;
      const sn = Math.sin(a), cs = Math.cos(a);
      const rz = cs >= 0 ? (r.rz ?? r.rx) : (r.rzB ?? r.rz ?? r.rx);
      row.push(new THREE.Vector3((r.cx ?? 0) + r.rx * sgnPow(sn, p), r.y, (r.cz ?? 0) + rz * sgnPow(cs, p)));
    }
    // Naht exakt schliessen / close the seam exactly
    row[n].copy(row[0]);
    P.push(row);
  }
  const T = ringT(rings, o.arc);
  const s0 = o.s0 ?? 0, s1 = o.s1 ?? 1, t0 = o.t0 ?? 0, t1 = o.t1 ?? 1;
  const centre = (i: number) => new THREE.Vector3(rings[i].cx ?? 0, rings[i].y, rings[i].cz ?? 0);
  const tiny = (i: number) => Math.max(rings[i].rx, rings[i].rz ?? rings[i].rx) < 1e-6;
  const du = new THREE.Vector3(), dv = new THREE.Vector3();
  /** Normale der Ecke (i, j), gesehen aus der Reihe row / normal of vertex (i, j) as seen from quad row `row` */
  const normal = (i: number, j: number, row: number): THREE.Vector3 => {
    const out = new THREE.Vector3();
    if (tiny(i)) {
      const other = i === 0 ? 1 : i === m - 1 ? m - 2 : row === i ? i + 1 : i - 1;
      return out.copy(centre(i)).sub(centre(other)).normalize();
    }
    const hard = rings[i].hard === true || i === 0 || i === m - 1;
    const a = hard ? row : i - 1, b = hard ? row + 1 : i + 1;
    dv.copy(P[b][j]).sub(P[a][j]);
    du.copy(P[i][(j + 1) % n]).sub(P[i][(j - 1 + n) % n]);
    out.crossVectors(du, dv);
    if (out.lengthSq() < 1e-20) out.copy(P[i][j]).sub(centre(i));
    out.normalize();
    // nach aussen richten / orient outward
    if (out.dot(dv.copy(P[i][j]).sub(centre(i))) < 0) out.negate();
    return out;
  };
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], colr: number[] = [];
  let cc = col(o.color ?? rings[0].c ?? semantic.white);
  const put = (p: THREE.Vector3, nn: THREE.Vector3, r: Region, s: number, t: number) => {
    pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); atlasUV(r, s, t, uv); colr.push(cc.r, cc.g, cc.b);
  };
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  type Vtx = { p: THREE.Vector3; n: THREE.Vector3; r: Region; s: number; t: number };
  const tri = (a: Vtx, b: Vtx, c: Vtx) => {
    fn.crossVectors(e1.copy(b.p).sub(a.p), e2.copy(c.p).sub(a.p));
    if (fn.lengthSq() < 1e-22) return;
    const flip = fn.dot(e1.copy(a.n).add(b.n).add(c.n)) < 0;
    for (const v of flip ? [a, c, b] : [a, b, c]) put(v.p, v.n, v.r, v.s, v.t);
  };
  for (let i = 0; i < m - 1; i++) {
    if (rings[i].c !== undefined) cc = col(rings[i].c!);
    for (let j = 0; j < n; j++) {
      const v = (ii: number, jj: number): Vtx => ({
        p: P[ii][jj], n: normal(ii, jj % n, i), r: o.region,
        s: s0 + (s1 - s0) * (jj / n), t: t0 + (t1 - t0) * T[ii],
      });
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      tri(a, b, c); tri(a, c, d);
    }
  }
  // Deckel / caps
  const cap = (i: number, spec: boolean | Region | undefined) => {
    if (!spec || tiny(i)) return;
    // Richtung des Deckels: weg vom naechsten Ring anderer Hoehe / direction of the cap: away from the next ring at another height
    let dy = 0;
    for (let k = 1; k < m && Math.abs(dy) < 1e-9; k++) dy = i === 0 ? rings[0].y - rings[k].y : rings[m - 1].y - rings[m - 1 - k].y;
    const up = new THREE.Vector3(0, dy >= 0 ? 1 : -1, 0);
    const R = Math.max(rings[i].rx, rings[i].rz ?? rings[i].rx, rings[i].rzB ?? 0) || 1;
    const c0 = centre(i);
    const mk = (p: THREE.Vector3, jj: number): Vtx => (spec === true
      ? { p, n: up, r: o.region, s: s0 + (s1 - s0) * (jj / n), t: t0 + (t1 - t0) * T[i] }
      : { p, n: up, r: spec, s: 0.5 - (p.x - c0.x) / (2 * R), t: 0.5 - (p.z - c0.z) / (2 * R) });
    for (let j = 0; j < n; j++) tri(mk(c0, j), mk(P[i][j], j), mk(P[i][j + 1], j + 1));
  };
  cc = col(o.color ?? rings[0].c ?? semantic.white);
  cap(0, o.capFirst);
  for (let i = 0; i < m - 1; i++) if (rings[i].c !== undefined) cc = col(rings[i].c!);
  cap(m - 1, o.capLast);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}

// ---------- Projektion fuer beliebige Teile / projection for arbitrary parts ----------

export interface BoxFaces {
  /** alle Seiten in denselben Bereich (falls keine eigene Angabe) / all faces into the same region (unless given) */
  all?: Region;
  px?: Region; nx?: Region; py?: Region; ny?: Region; pz?: Region; nz?: Region;
  /** -x spiegelbildlich zu +x (Bug bleibt auf derselben Bildseite) / -x mirrored to +x (the bow stays on the same image side) */
  mirrorNx?: boolean;
  bounds?: THREE.Box3;
}

/**
 * Wuerfelprojektion: jedes Dreieck wird nach seiner Hauptrichtung in den Bereich dieser Seite gelegt, jeweils so, wie
 * man die Seite von aussen sieht (oben: Bug oben). Macht jede kit-Form texturierbar.
 * Box projection: every triangle goes into the region of its dominant direction, each as seen from outside (top: bow
 * up). Makes any kit shape texturable.
 */
export function projectBox(src: THREE.BufferGeometry, f: BoxFaces): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src;
  if (src.userData.smooth) g.userData.smooth = true;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = f.bounds ?? g.boundingBox!;
  const d = new THREE.Vector3().subVectors(bb.max, bb.min);
  const inv = (v: number) => (v > 1e-9 ? 1 / v : 0);
  const ix = inv(d.x), iy = inv(d.y), iz = inv(d.z);
  const uv: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
    nn.crossVectors(b.clone().sub(a), c.clone().sub(a));
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    const axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
    const posSide = (axis === 0 ? nn.x : axis === 1 ? nn.y : nn.z) >= 0;
    const r = (axis === 0 ? (posSide ? f.px : f.nx) : axis === 1 ? (posSide ? f.py : f.ny) : (posSide ? f.pz : f.nz)) ?? f.all;
    if (!r) throw new Error('projectBox: no region for a face');
    for (const p of [a, b, c]) {
      let s: number, tt: number;
      if (axis === 0) { s = posSide || f.mirrorNx ? (bb.max.z - p.z) * iz : (p.z - bb.min.z) * iz; tt = (bb.max.y - p.y) * iy; }
      else if (axis === 1) { s = posSide ? (bb.max.x - p.x) * ix : (p.x - bb.min.x) * ix; tt = (bb.max.z - p.z) * iz; }
      else { s = posSide ? (p.x - bb.min.x) * ix : (bb.max.x - p.x) * ix; tt = (bb.max.y - p.y) * iy; }
      atlasUV(r, s, tt, uv);
    }
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Freies Viereck mit eigenen Bereichskoordinaten je Ecke (a, b, c, d umlaufend) / free quad with region coordinates per corner */
export function quad(pts: [V3, V3, V3, V3], r: Region, st: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...pts[i]); atlasUV(r, st[i][0], st[i][1], uv); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ---------- Builder ----------

/** Dreiecke umdrehen / flip triangle winding */
function flipWinding(g: THREE.BufferGeometry): void {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name] as THREE.BufferAttribute;
    const n = a.itemSize, arr = a.array as Float32Array;
    for (let t = 0; t < a.count; t += 3) for (let k = 0; k < n; k++) {
      const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k;
      const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
    }
  }
}

export interface PartOpts {
  xf?: Xf;
  /** Glanz 0..1 (Metall, Glas) / gloss 0..1 (metal, glass) */
  gloss?: number;
  /** Gewicht der Knicklinien dieses Teils (0 = keine) / weight of this part's crease lines (0 = none) */
  crease?: number;
  /** Anteil der Schraffur im Schatten (Haut: 0 = flacher Ton) / share of hatching in the shadow (skin: 0 = flat tone) */
  hatch?: number;
  /** nur legacy(): Ecken vor dem Einfuegen verformen (z. B. alte Kopfbedeckung auf den neuen Kopf) / legacy() only: warp vertices before adding (e.g. old headgear onto the new head) */
  map?: (v: THREE.Vector3) => void;
}

/**
 * Wie Builder (kit.ts), aber mit uv, Glanz und Tuschegewicht. Attribute: position, normal, uv, color, fx (Glanz, Knick, Schraffur).
 * Like Builder (kit.ts), but with uv, gloss and ink weight. Attributes: position, normal, uv, color, fx (gloss, crease, hatching).
 */
export class UvBuilder {
  private parts: THREE.BufferGeometry[] = [];
  private sink: THREE.BufferGeometry[] = this.parts;
  private turretList: { pivot: THREE.Vector3; yaw: number; parts: THREE.BufferGeometry[] }[] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  /** blank: neutraler Bereich fuer Teile ohne Zeichnung / neutral region for parts without drawing */
  constructor(readonly blank: Region) {}

  private get top(): THREE.Matrix4 { return this.stack[this.stack.length - 1]; }

  group(xf: Xf, fn: () => void): this {
    this.stack.push(this.top.clone().multiply(xfMatrix(xf)));
    try { fn(); } finally { this.stack.pop(); }
    return this;
  }
  /** fn zusaetzlich gespiegelt (x -> -x) / fn mirrored in addition (x -> -x) */
  mirrorX(fn: (side: 1 | -1) => void): this {
    fn(1);
    this.group({ s: [-1, 1, 1] }, () => fn(-1));
    return this;
  }
  /** Drehturm wie Builder.turret / turret as Builder.turret */
  turret(pivot: V3, fn: () => void): this {
    const t = { pivot: new THREE.Vector3(...pivot).applyMatrix4(this.top), yaw: 0, parts: [] as THREE.BufferGeometry[] };
    this.turretList.push(t);
    this.sink = t.parts;
    try { fn(); } finally { this.sink = this.parts; }
    return this;
  }
  /**
   * Lokaler Rahmen entlang a -> c: +y = Richtung, +z moeglichst nach `front`. fn bekommt die Laenge.
   * Local frame along a -> c: +y = direction, +z as close to `front` as possible. fn receives the length.
   */
  bone(a: THREE.Vector3, c: THREE.Vector3, front: THREE.Vector3, fn: (len: number) => void): this {
    const y = c.clone().sub(a);
    const len = Math.max(1e-5, y.length());
    y.normalize();
    const z = front.clone().addScaledVector(y, -front.dot(y));
    if (z.lengthSq() < 1e-8) z.set(1, 0, 0).addScaledVector(y, -y.x);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(a);
    this.stack.push(this.top.clone().multiply(m));
    try { fn(len); } finally { this.stack.pop(); }
    return this;
  }

  /** Teil hinzufuegen; ohne uv landet es im neutralen Bereich / add a part; without uv it lands in the neutral region */
  add(g0: THREE.BufferGeometry, c: ColorLike | null, o: PartOpts = {}): this {
    const smooth = !!g0.getAttribute('normal') && (g0.userData.smooth === true || (!!g0.getAttribute('uv') && !!g0.getAttribute('color')));
    const g = g0.index ? g0.toNonIndexed() : g0;
    const keep = new Set(['position', 'uv', 'color']);
    if (smooth) keep.add('normal');
    for (const name of Object.keys(g.attributes)) if (!keep.has(name)) g.deleteAttribute(name);
    g.morphAttributes = {};
    g.clearGroups();
    const n = g.attributes.position.count;
    if (!g.getAttribute('uv')) {
      const b = this.blank, u = (b.x + b.w / 2) / REF, v = (b.y + b.h / 2) / REF;
      const arr = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { arr[i * 2] = u; arr[i * 2 + 1] = v; }
      g.setAttribute('uv', new THREE.BufferAttribute(arr, 2));
    }
    if (c !== null || !g.getAttribute('color')) {
      const cc = col(c ?? semantic.white);
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    const fx = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { fx[i * 3] = o.gloss ?? 0; fx[i * 3 + 1] = o.crease ?? 1; fx[i * 3 + 2] = o.hatch ?? 1; }
    g.setAttribute('fx', new THREE.BufferAttribute(fx, 3));
    const m = this.top.clone().multiply(xfMatrix(o.xf));
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    if (!smooth) g.computeVertexNormals();
    // einheitliche Typen fuer das Verschmelzen / uniform types for merging
    for (const name of ['position', 'normal', 'uv', 'color']) {
      const a = g.getAttribute(name) as THREE.BufferAttribute;
      if (!(a.array instanceof Float32Array)) g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(a.array), a.itemSize));
    }
    this.sink.push(g);
    return this;
  }

  /**
   * Bruecke zum alten Baukasten: fn baut mit einem Builder (kit.ts) wie bisher; das Ergebnis kommt ohne Zeichnung
   * (neutrale Zelle) in dieses Modell, mit Vertexfarben, Tuschekanten, Verdeckung und Schraffur. So laufen Zubehoer und
   * noch nicht umgebaute Teile durch denselben Weg; grosse Flaechen sollten trotzdem echte Zellen bekommen.
   * Bridge to the old toolkit: fn builds with a Builder (kit.ts) as before; the result joins this model without drawing
   * (neutral cell), with vertex colours, ink edges, occlusion and hatching. Accessories and parts not converted yet thus
   * take the same path; large surfaces should still get real cells.
   */
  legacy(fn: (k: Builder) => void, o: PartOpts = {}): this {
    const k = new Builder();
    // niedrige Qualitaet: Rundungen der alten Teile ohne Zusatzsegmente / low quality: curves of the old parts without extra segments
    if (fine()) fn(k); else withDetail(1, true, () => fn(k), { smooth: true });
    if (!k.triangles()) return this;
    const g = k.build();
    g.userData = { smooth: true };
    if (o.map) {
      const pos = g.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { o.map(v.fromBufferAttribute(pos, i)); pos.setXYZ(i, v.x, v.y, v.z); }
    }
    return this.add(g, null, o);
  }

  triangles(): number {
    return [...this.parts, ...this.turretList.flatMap((t) => t.parts)].reduce((s, g) => s + g.attributes.position.count / 3, 0);
  }

  /** Verschmelzen; Turmteile am Ende (userData.turrets wie kit.ts) / merge; turret parts last (userData.turrets as kit.ts) */
  build(): THREE.BufferGeometry {
    const turrets = this.turretList.filter((t) => t.parts.length);
    const all = [...this.parts, ...turrets.flatMap((t) => t.parts)];
    const g = mergeGeometries(all, false);
    if (!g) throw new Error('UvBuilder: merge failed');
    if (turrets.length) {
      const verts = (list: THREE.BufferGeometry[]) => list.reduce((s, p) => s + p.attributes.position.count, 0);
      let start = verts(this.parts);
      g.userData.turrets = turrets.map((t): TurretRange => {
        const count = verts(t.parts);
        const r: TurretRange = { start, count, pivot: [t.pivot.x, t.pivot.y, t.pivot.z], yaw: t.yaw };
        start += count;
        return r;
      });
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- Unterteilung / subdivision ----------

/**
 * Grosse Dreiecke teilen, bis keine Kante laenger als maxEdge ist (alle Attribute werden linear mitgefuehrt). Eine
 * Kante wird allein nach ihrer Laenge geteilt, Nachbarn teilen sie also gleich: es entstehen keine T-Stoesse. Noetig,
 * weil die Umgebungsverdeckung in den Ecken liegt: eine grosse Platte haette sonst nur vier Werte. Die Bereiche der
 * Drehtuerme (userData.turrets) bleiben erhalten.
 * Split large triangles until no edge is longer than maxEdge (all attributes follow linearly). An edge is split by its
 * length alone, so neighbours split it alike: no T-junctions. Needed because the ambient occlusion lives in the
 * vertices: a large plate would otherwise have only four values. The turret ranges (userData.turrets) are kept.
 */
export function subdivide(g: THREE.BufferGeometry, maxEdge: number, passes = 4): THREE.BufferGeometry {
  const names = Object.keys(g.attributes);
  const sizes = names.map((nm) => (g.attributes[nm] as THREE.BufferAttribute).itemSize);
  const stride = sizes.reduce((s, v) => s + v, 0);
  const pOff = sizes.slice(0, names.indexOf('position')).reduce((s, v) => s + v, 0);
  const count = g.attributes.position.count;
  // verschachtelte Ecken / interleaved vertices
  let data: number[][] = [];
  for (let i = 0; i < count; i++) {
    const v: number[] = [];
    names.forEach((nm, k) => { const a = g.attributes[nm] as THREE.BufferAttribute; for (let c = 0; c < sizes[k]; c++) v.push((a.array as Float32Array)[i * sizes[k] + c]); });
    data.push(v);
  }
  const turrets = (g.userData.turrets as TurretRange[] | undefined) ?? [];
  // Grenzen in Dreiecken / limits in triangles
  let bounds = [0, ...turrets.map((t) => t.start / 3), count / 3];
  const len2 = (a: number[], b: number[]) => (a[pOff] - b[pOff]) ** 2 + (a[pOff + 1] - b[pOff + 1]) ** 2 + (a[pOff + 2] - b[pOff + 2]) ** 2;
  // symmetrisch, damit beide Nachbarn dieselbe Ecke berechnen / symmetric so both neighbours compute the same vertex
  const mid = (a: number[], b: number[]) => {
    const out = new Array<number>(stride);
    for (let k = 0; k < stride; k++) out[k] = (a[k] + b[k]) / 2;
    return out;
  };
  const L2 = maxEdge * maxEdge;
  for (let pass = 0; pass < passes; pass++) {
    const next: number[][] = [];
    const nb: number[] = [0];
    let changed = false;
    for (let s = 0; s < bounds.length - 1; s++) {
      for (let t = bounds[s]; t < bounds[s + 1]; t++) {
        const a = data[t * 3], b = data[t * 3 + 1], c = data[t * 3 + 2];
        const sab = len2(a, b) > L2, sbc = len2(b, c) > L2, sca = len2(c, a) > L2;
        const k = (sab ? 1 : 0) + (sbc ? 1 : 0) + (sca ? 1 : 0);
        if (k === 0) { next.push(a, b, c); continue; }
        changed = true;
        const ab = sab ? mid(a, b) : null, bc = sbc ? mid(b, c) : null, ca = sca ? mid(c, a) : null;
        if (k === 3) next.push(a, ab!, ca!, ab!, b, bc!, ca!, bc!, c, ab!, bc!, ca!);
        else if (k === 1) {
          if (ab) next.push(a, ab, c, ab, b, c);
          else if (bc) next.push(a, b, bc, a, bc, c);
          else next.push(a, b, ca!, ca!, b, c);
        } else if (!sab) next.push(a, b, bc!, a, bc!, ca!, ca!, bc!, c);
        else if (!sbc) next.push(a, ab!, ca!, ab!, b, c, ab!, c, ca!);
        else next.push(a, ab!, bc!, ab!, b, bc!, a, bc!, c);
      }
      nb.push(next.length / 3);
    }
    data = next;
    bounds = nb;
    if (!changed) break;
  }
  const out = new THREE.BufferGeometry();
  let off = 0;
  names.forEach((nm, k) => {
    const arr = new Float32Array(data.length * sizes[k]);
    for (let i = 0; i < data.length; i++) for (let c = 0; c < sizes[k]; c++) arr[i * sizes[k] + c] = data[i][off + c];
    out.setAttribute(nm, new THREE.BufferAttribute(arr, sizes[k]));
    off += sizes[k];
  });
  // Normalen nach dem Mitteln wieder auf Laenge 1 / normals back to unit length after averaging
  const nrm = out.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (nrm) for (let i = 0; i < nrm.count; i++) {
    const x = nrm.getX(i), y = nrm.getY(i), z = nrm.getZ(i), l = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(i, x / l, y / l, z / l);
  }
  out.userData = { ...g.userData };
  if (turrets.length) out.userData.turrets = turrets.map((t, i): TurretRange => ({ ...t, start: bounds[i + 1] * 3, count: (bounds[i + 2] - bounds[i + 1]) * 3 }));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

// ---------- Auflagen auf einem Loft / decals on a loft ----------

/** Punkt und Normale auf der Loft-Flaeche bei Umfang s (0..1) und Hoehe y / point and normal on the loft surface at s (0..1) around and height y */
export function loftAt(rings: Ring[], s: number, y: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  const at = (ss: number, yy: number): THREE.Vector3 => {
    let i = 0;
    const up = rings[0].y < rings[rings.length - 1].y;
    while (i < rings.length - 2 && (up ? rings[i + 1].y < yy : rings[i + 1].y > yy)) i++;
    const a = rings[i], b = rings[i + 1];
    const f = Math.abs(b.y - a.y) < 1e-9 ? 0 : Math.max(0, Math.min(1, (yy - a.y) / (b.y - a.y)));
    const L = (u: number | undefined, v: number | undefined, d: number) => (u ?? d) + ((v ?? d) - (u ?? d)) * f;
    const rx = L(a.rx, b.rx, 0), rzF = L(a.rz ?? a.rx, b.rz ?? b.rx, 0), rzB = L(a.rzB ?? a.rz ?? a.rx, b.rzB ?? b.rz ?? b.rx, 0);
    const p = 2 / L(a.e, b.e, 2), ang = ss * Math.PI * 2 - Math.PI;
    const sn = Math.sin(ang), cs = Math.cos(ang);
    return new THREE.Vector3(L(a.cx, b.cx, 0) + rx * sgnPow(sn, p), yy, L(a.cz, b.cz, 0) + (cs >= 0 ? rzF : rzB) * sgnPow(cs, p));
  };
  const p = at(s, y);
  const du = at(s + 0.004, y).sub(at(s - 0.004, y)), dv = at(s, y + 0.002).sub(at(s, y - 0.002));
  const n = new THREE.Vector3().crossVectors(du, dv).normalize();
  const c = at(s, y).setX(0).setZ(0);
  if (n.dot(p.clone().sub(c)) < 0) n.negate();
  return { p, n };
}

/**
 * Band entlang eines Pfads auf einer Flaeche (einseitig, offen): traegt eine eigene Vertexfarbe, z. B. ein Riemen in
 * Fraktionsfarbe ueber der Jacke. Offene Kanten bekommen von der Tusche automatisch einen Rand.
 * Strip along a path on a surface (one-sided, open): carries its own vertex colour, e.g. a strap in the faction colour
 * over the jacket. Open edges get an ink border automatically.
 */
export function ribbon(path: { p: THREE.Vector3; n: THREE.Vector3 }[], hw: number, region: Region, lift = 0.002): THREE.BufferGeometry {
  const m = path.length;
  const acc = [0];
  for (let i = 1; i < m; i++) acc.push(acc[i - 1] + path[i].p.distanceTo(path[i - 1].p));
  const L: THREE.Vector3[] = [], Rr: THREE.Vector3[] = [];
  for (let i = 0; i < m; i++) {
    const tan = path[Math.min(m - 1, i + 1)].p.clone().sub(path[Math.max(0, i - 1)].p).normalize();
    const side = new THREE.Vector3().crossVectors(path[i].n, tan).normalize();
    const base = path[i].p.clone().addScaledVector(path[i].n, lift);
    L.push(base.clone().addScaledVector(side, hw));
    Rr.push(base.clone().addScaledVector(side, -hw));
  }
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  const tri = (a: [THREE.Vector3, number, number, number], b: typeof a, c: typeof a) => {
    fn.crossVectors(e1.copy(b[0]).sub(a[0]), e2.copy(c[0]).sub(a[0]));
    const flip = fn.dot(path[a[1]].n) < 0;
    for (const v of flip ? [a, c, b] : [a, b, c]) {
      pos.push(v[0].x, v[0].y, v[0].z);
      const nn = path[v[1]].n; nor.push(nn.x, nn.y, nn.z);
      atlasUV(region, v[2], v[3], uv);
    }
  };
  for (let i = 0; i < m - 1; i++) {
    const s0 = acc[i] / acc[m - 1], s1 = acc[i + 1] / acc[m - 1];
    const a: [THREE.Vector3, number, number, number] = [L[i], i, s0, 0], b: typeof a = [Rr[i], i, s0, 1], c: typeof a = [Rr[i + 1], i + 1, s1, 1], d: typeof a = [L[i + 1], i + 1, s1, 0];
    tri(a, b, c); tri(a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.userData.smooth = true;
  return g;
}
