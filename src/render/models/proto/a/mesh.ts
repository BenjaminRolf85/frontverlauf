/**
 * Vorschlag A "Geformt": Netz-Baukasten fuer zusammenhaengende, organisch geformte Modelle.
 * Statt fertige Grundkoerper zu stapeln, entstehen Flaechen als Polygonnetz mit gemeinsamen Ecken: Schlaeuche entlang
 * einer Leitkurve mit frei geformten Querschnitten (Tube), Drehkoerper, Profile mit Fase, dazu Catmull-Clark-Unterteilung
 * und glatte Normalen mit Knickwinkel (runde Formen weich, harte Kanten hart). Am Ende steht dieselbe Art Geometrie wie
 * im Spiel: nicht indiziert, Position, Normale, Vertexfarbe - keine Texturen.
 * Proposal A "Sculpted": mesh toolkit for continuous, organically shaped models. Instead of stacking ready-made
 * primitives, surfaces are built as polygon meshes with shared vertices: tubes along a guide curve with freely shaped
 * cross-sections (Tube), turned parts, bevelled profiles, plus Catmull-Clark subdivision and smooth normals with a
 * crease angle (round forms soft, hard edges hard). The result is the same kind of geometry the game uses: non-indexed,
 * position, normal, vertex colour - no textures.
 */
import * as THREE from 'three';
import { col, type ColorLike } from '../../kit';

export type P3 = readonly [number, number, number];
export const V = (p: P3) => new THREE.Vector3(p[0], p[1], p[2]);
export const A3 = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];
export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Glocke um c mit Breite w / bell around c with width w */
export const bell = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
/** Winkelabstand (rad, -PI..PI) / angular distance */
export const angDiff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

// ---------- Netzdichte / mesh density ----------

/**
 * Netzdichte: 1 = Prototyp in voller Aufloesung, kleiner = dieselben Formen mit weniger Ringen und Segmenten
 * (Handy-Stufe). Alle Formgeber fragen ihre Segmentzahlen ueber dens() ab.
 * Mesh density: 1 = prototype at full resolution, smaller = the same shapes with fewer rings and segments (phone
 * level). All shape builders ask for their segment counts through dens().
 */
let DENSITY = 1;
export function withDensity<T>(d: number, fn: () => T): T {
  const prev = DENSITY;
  DENSITY = d;
  try { return fn(); } finally { DENSITY = prev; }
}
export const density = () => DENSITY;
/** Segmentzahl in der aktuellen Dichte / segment count at the current density */
export const dens = (n: number, min = 3) => Math.max(min, Math.round(n * DENSITY));
/** Zusatzdetail nur ab dieser Dichte / extra detail only from this density */
export const rich = (from = 0.75) => DENSITY >= from;

// ---------- Polygonnetz / polygon mesh ----------

const WHITE = new THREE.Color(1, 1, 1);
export interface LoftOpts {
  closed?: boolean;
  loop?: boolean;
  capA?: 'fan' | 'poly';
  capB?: 'fan' | 'poly';
  c?: THREE.Color | ((ring: number, seg: number) => THREE.Color);
  capColA?: THREE.Color;
  capColB?: THREE.Color;
  ink?: number;
}

/**
 * Polygonnetz mit gemeinsamen Ecken; Farbe und Tuschestaerke je Flaeche (scharfe Farbgrenzen ohne Textur).
 * Polygon mesh with shared vertices; colour and ink weight per face (crisp colour borders without a texture).
 */
export class PMesh {
  pos: number[] = [];
  faces: number[][] = [];
  cols: THREE.Color[] = [];
  /** Tuschestaerke 0..1: feine Teile bekommen eine duennere Kontur / ink weight 0..1: fine parts get a thinner outline */
  inks: number[] = [];

  get vcount(): number { return this.pos.length / 3; }
  v(x: number, y: number, z: number): number {
    this.pos.push(x, y, z);
    return this.pos.length / 3 - 1;
  }
  vp(p: P3 | THREE.Vector3): number {
    return p instanceof THREE.Vector3 ? this.v(p.x, p.y, p.z) : this.v(p[0], p[1], p[2]);
  }
  get(i: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
  }
  f(ids: number[], c: THREE.Color, ink = 1): this {
    this.faces.push(ids);
    this.cols.push(c);
    this.inks.push(ink);
    return this;
  }
  triCount(): number {
    let n = 0;
    for (const f of this.faces) n += f.length - 2;
    return n;
  }
  /** Ecken verformen / deform the vertices */
  warp(fn: (p: THREE.Vector3) => void): this {
    const p = new THREE.Vector3();
    for (let i = 0; i < this.pos.length; i += 3) {
      p.set(this.pos[i], this.pos[i + 1], this.pos[i + 2]);
      fn(p);
      this.pos[i] = p.x; this.pos[i + 1] = p.y; this.pos[i + 2] = p.z;
    }
    return this;
  }
  apply(m: THREE.Matrix4): this {
    this.warp((p) => p.applyMatrix4(m));
    if (m.determinant() < 0) this.flip();
    return this;
  }
  move(x: number, y: number, z: number): this {
    for (let i = 0; i < this.pos.length; i += 3) { this.pos[i] += x; this.pos[i + 1] += y; this.pos[i + 2] += z; }
    return this;
  }
  flip(): this {
    for (const f of this.faces) f.reverse();
    return this;
  }
  /** Anderes Netz anhaengen (optional transformiert) / append another mesh (optionally transformed) */
  add(o: PMesh, m?: THREE.Matrix4): this {
    const base = this.vcount;
    const p = new THREE.Vector3();
    const flip = !!m && m.determinant() < 0;
    const n = o.pos.length, nf = o.faces.length;
    for (let i = 0; i < n; i += 3) {
      p.set(o.pos[i], o.pos[i + 1], o.pos[i + 2]);
      if (m) p.applyMatrix4(m);
      this.pos.push(p.x, p.y, p.z);
    }
    for (let k = 0; k < nf; k++) {
      const ids = o.faces[k].map((i) => i + base);
      if (flip) ids.reverse();
      this.f(ids, o.cols[k], o.inks[k]);
    }
    return this;
  }
  /** Spiegelbild an x=0 anhaengen / append the mirror image across x=0 */
  mirrorX(): this {
    const c = new PMesh();
    c.add(this, new THREE.Matrix4().makeScale(-1, 1, 1));
    return this.add(c);
  }
  paint(c: ColorLike): this {
    const cc = col(c);
    this.cols = this.cols.map(() => cc);
    return this;
  }
  setInk(w: number): this {
    this.inks = this.inks.map(() => w);
    return this;
  }

  /**
   * Ringe zu einer Flaeche verbinden (alle Ringe gleich viele Punkte). closed: Ring geschlossen; loop: letzter Ring an
   * den ersten; capA/capB: Enden mit Faecher ('fan') oder trianguliertem Deckel ('poly') schliessen.
   * Connect rings into a surface (all rings with the same point count). closed: ring closed; loop: last ring joins the
   * first; capA/capB: close the ends with a fan ('fan') or a triangulated lid ('poly').
   */
  loft(rings: (P3 | THREE.Vector3)[][], o: LoftOpts = {}): this {
    const n = rings[0].length, closed = o.closed ?? true;
    const base = this.vcount;
    for (const r of rings) for (const p of r) this.vp(p);
    const id = (i: number, j: number) => base + i * n + (j % n);
    const colour = (i: number, j: number) => (typeof o.c === 'function' ? o.c(i, j) : o.c ?? WHITE);
    const ink = o.ink ?? 1;
    const nr = rings.length, last = o.loop ? nr : nr - 1;
    for (let i = 0; i < last; i++) {
      const i1 = (i + 1) % nr;
      for (let j = 0; j < (closed ? n : n - 1); j++) this.f([id(i, j), id(i, j + 1), id(i1, j + 1), id(i1, j)], colour(i, j), ink);
    }
    const cap = (i: number, kind: 'fan' | 'poly' | undefined, rev: boolean, c: THREE.Color) => {
      if (!kind) return;
      const ids = Array.from({ length: n }, (_, j) => id(i, j));
      if (kind === 'fan') {
        const ctr = new THREE.Vector3();
        for (const k of ids) ctr.add(this.get(k));
        const ci = this.vp(ctr.multiplyScalar(1 / n));
        for (let j = 0; j < n; j++) this.f(rev ? [ci, ids[(j + 1) % n], ids[j]] : [ci, ids[j], ids[(j + 1) % n]], c, ink);
      } else {
        for (const t of triangulate(ids.map((k) => this.get(k)))) this.f(rev ? [ids[t[0]], ids[t[2]], ids[t[1]]] : [ids[t[0]], ids[t[1]], ids[t[2]]], c, ink);
      }
    };
    cap(0, o.capA, true, o.capColA ?? colour(0, 0));
    cap(nr - 1, o.capB, false, o.capColB ?? colour(Math.max(0, nr - 2), 0));
    return this;
  }

  /**
   * Nicht-indizierte Geometrie mit Position, Normale, Farbe und Tuschestaerke. Normalen: je Ecke einer Flaeche der
   * Mittelwert aller Nachbarflaechen, deren Normale um hoechstens `crease` Grad abweicht.
   * Non-indexed geometry with position, normal, colour and ink weight. Normals: per face corner the mean of all
   * neighbouring faces whose normal deviates by at most `crease` degrees.
   */
  toGeometry(crease = 42): THREE.BufferGeometry {
    const nf = this.faces.length, P = this.pos;
    const fn = new Float32Array(nf * 3);
    // Flaechennormalen nach Newell, Laenge = doppelte Flaeche (gewichtet die Mittelung)
    // face normals after Newell, length = twice the area (weights the averaging)
    for (let k = 0; k < nf; k++) {
      const f = this.faces[k];
      let x = 0, y = 0, z = 0;
      for (let i = 0; i < f.length; i++) {
        const p = f[i] * 3, q = f[(i + 1) % f.length] * 3;
        x += (P[p + 1] - P[q + 1]) * (P[p + 2] + P[q + 2]);
        y += (P[p + 2] - P[q + 2]) * (P[p] + P[q]);
        z += (P[p] - P[q]) * (P[p + 1] + P[q + 1]);
      }
      fn[k * 3] = x; fn[k * 3 + 1] = y; fn[k * 3 + 2] = z;
    }
    // Flaechen je Ecke / faces per vertex
    const count = new Uint32Array(this.vcount + 1);
    for (const f of this.faces) for (const i of f) count[i + 1]++;
    for (let i = 0; i < this.vcount; i++) count[i + 1] += count[i];
    const fill = count.slice(0, this.vcount);
    const adj = new Uint32Array(count[this.vcount]);
    for (let k = 0; k < nf; k++) for (const i of this.faces[k]) adj[fill[i]++] = k;
    const cosC = Math.cos((crease * Math.PI) / 180);
    const tris = this.triCount();
    const pos = new Float32Array(tris * 9), nor = new Float32Array(tris * 9), colr = new Float32Array(tris * 9), ink = new Float32Array(tris * 3);
    let o = 0;
    const cn: number[] = [];
    const d2 = (i: number, j: number) => (P[i * 3] - P[j * 3]) ** 2 + (P[i * 3 + 1] - P[j * 3 + 1]) ** 2 + (P[i * 3 + 2] - P[j * 3 + 2]) ** 2;
    for (let k = 0; k < nf; k++) {
      const f = this.faces[k];
      const nx = fn[k * 3], ny = fn[k * 3 + 1], nz = fn[k * 3 + 2];
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-16) continue;
      cn.length = 0;
      for (let i = 0; i < f.length; i++) {
        const vi = f[i];
        let sx = 0, sy = 0, sz = 0;
        for (let q = count[vi]; q < count[vi + 1]; q++) {
          const g = adj[q];
          const gx = fn[g * 3], gy = fn[g * 3 + 1], gz = fn[g * 3 + 2];
          const gl = Math.hypot(gx, gy, gz);
          if (gl < 1e-16) continue;
          if (g === k || (gx * nx + gy * ny + gz * nz) / (gl * nl) >= cosC) { sx += gx; sy += gy; sz += gz; }
        }
        const sl = Math.hypot(sx, sy, sz) || 1;
        cn.push(sx / sl, sy / sl, sz / sl);
      }
      // Viereck entlang der kuerzeren Diagonale teilen / split a quad along its shorter diagonal
      let order: number[];
      if (f.length === 3) order = TRI;
      else if (f.length === 4) order = d2(f[0], f[2]) <= d2(f[1], f[3]) ? QUAD_A : QUAD_B;
      else {
        order = [];
        for (let i = 1; i < f.length - 1; i++) order.push(0, i, i + 1);
      }
      const cc = this.cols[k], w = this.inks[k];
      for (const i of order) {
        const vi = f[i] * 3;
        pos[o * 3] = P[vi]; pos[o * 3 + 1] = P[vi + 1]; pos[o * 3 + 2] = P[vi + 2];
        nor[o * 3] = cn[i * 3]; nor[o * 3 + 1] = cn[i * 3 + 1]; nor[o * 3 + 2] = cn[i * 3 + 2];
        colr[o * 3] = cc.r; colr[o * 3 + 1] = cc.g; colr[o * 3 + 2] = cc.b;
        ink[o] = w;
        o++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, o * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.slice(0, o * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(colr.slice(0, o * 3), 3));
    g.setAttribute('ink', new THREE.BufferAttribute(ink.slice(0, o), 1));
    return dropDegenerate(g);
  }
}
const TRI = [0, 1, 2], QUAD_A = [0, 1, 2, 0, 2, 3], QUAD_B = [0, 1, 3, 1, 2, 3];

/** Entartete Dreiecke entfernen / drop degenerate triangles */
function dropDegenerate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const keep: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-20) keep.push(t);
  }
  if (keep.length * 3 === pos.count) return g;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const src = g.getAttribute(name) as THREE.BufferAttribute;
    const n = src.itemSize, arr = new Float32Array(keep.length * 3 * n);
    keep.forEach((t, i) => arr.set((src.array as Float32Array).subarray(t * n, (t + 3) * n), i * 3 * n));
    out.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  return out;
}

/** Ebenes Polygon triangulieren (auch konkav) / triangulate a planar polygon (concave too) */
function triangulate(pts: THREE.Vector3[]): number[][] {
  const n = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    n.x += (p.y - q.y) * (p.z + q.z); n.y += (p.z - q.z) * (p.x + q.x); n.z += (p.x - q.x) * (p.y + q.y);
  }
  n.normalize();
  const u = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(n).normalize() : new THREE.Vector3(1, 0, 0).cross(n).normalize();
  const w = n.clone().cross(u);
  const flat = pts.map((p) => new THREE.Vector2(p.dot(u), p.dot(w)));
  return THREE.ShapeUtils.triangulateShape(flat, []);
}

// ---------- Catmull-Clark ----------

export interface SubdivOpts {
  /** Kanten mit groesserem Knick (Grad) bleiben scharf / edges with a larger dihedral angle (degrees) stay sharp */
  sharp?: number;
  /** so viele Stufen bleiben sie scharf, danach rund: ergibt eine weiche Fase / they stay sharp for this many levels, round after: gives a soft bevel */
  sharpLevels?: number;
}

/**
 * Catmull-Clark-Unterteilung mit halbscharfen Kanten (three bringt keine Unterteilung mit). Offene Raender bleiben
 * Raender; Farbe und Tuschestaerke erben die Teilflaechen.
 * Catmull-Clark subdivision with semi-sharp edges (three ships no subdivision). Open borders stay borders; the child
 * faces inherit colour and ink weight.
 */
export function subdivide(m: PMesh, levels = 1, o: SubdivOpts = {}): PMesh {
  let cur = m;
  let sharp: Set<number> | null = null;
  for (let lv = 0; lv < levels; lv++) {
    const V0 = cur.vcount, key = (a: number, b: number) => (a < b ? a * V0 + b : b * V0 + a);
    const P = cur.pos;
    // Flaechenpunkte / face points
    const fp: number[] = [];
    for (const f of cur.faces) {
      let x = 0, y = 0, z = 0;
      for (const i of f) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; }
      fp.push(x / f.length, y / f.length, z / f.length);
    }
    // Kanten / edges
    const edges = new Map<number, { a: number; b: number; f: number[]; id: number }>();
    cur.faces.forEach((f, k) => {
      for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length], kk = key(a, b);
        let e = edges.get(kk);
        if (!e) { e = { a, b, f: [], id: edges.size }; edges.set(kk, e); }
        e.f.push(k);
      }
    });
    if (lv === 0 && o.sharp !== undefined && (o.sharpLevels ?? 1) > 0) {
      // scharfe Kanten aus dem Knickwinkel des Ausgangsnetzes / sharp edges from the dihedral angle of the base mesh
      sharp = new Set<number>();
      const fnorm = cur.faces.map((f) => {
        const n = new THREE.Vector3();
        for (let i = 0; i < f.length; i++) {
          const p = f[i] * 3, q = f[(i + 1) % f.length] * 3;
          n.x += (P[p + 1] - P[q + 1]) * (P[p + 2] + P[q + 2]); n.y += (P[p + 2] - P[q + 2]) * (P[p] + P[q]); n.z += (P[p] - P[q]) * (P[p + 1] + P[q + 1]);
        }
        return n.normalize();
      });
      const cosS = Math.cos((o.sharp * Math.PI) / 180);
      for (const [kk, e] of edges) if (e.f.length === 2 && fnorm[e.f[0]].dot(fnorm[e.f[1]]) < cosS) sharp.add(kk);
    }
    const isSharp = (kk: number, e: { f: number[] }) => e.f.length !== 2 || (sharp?.has(kk) ?? false);
    const E = edges.size, F = cur.faces.length;
    const out = new PMesh();
    out.pos = new Array<number>((V0 + E + F) * 3).fill(0);
    // Nachbarschaft je Ecke / neighbourhood per vertex
    const vF: number[][] = Array.from({ length: V0 }, () => []);
    const vE: { other: number; sharp: boolean }[][] = Array.from({ length: V0 }, () => []);
    cur.faces.forEach((f, k) => { for (const i of f) vF[i].push(k); });
    for (const [kk, e] of edges) {
      const s = isSharp(kk, e);
      vE[e.a].push({ other: e.b, sharp: s });
      vE[e.b].push({ other: e.a, sharp: s });
      // Kantenpunkt / edge point
      const oi = (V0 + e.id) * 3;
      let x = P[e.a * 3] + P[e.b * 3], y = P[e.a * 3 + 1] + P[e.b * 3 + 1], z = P[e.a * 3 + 2] + P[e.b * 3 + 2];
      if (s) { x /= 2; y /= 2; z /= 2; } else {
        x = (x + fp[e.f[0] * 3] + fp[e.f[1] * 3]) / 4; y = (y + fp[e.f[0] * 3 + 1] + fp[e.f[1] * 3 + 1]) / 4; z = (z + fp[e.f[0] * 3 + 2] + fp[e.f[1] * 3 + 2]) / 4;
      }
      out.pos[oi] = x; out.pos[oi + 1] = y; out.pos[oi + 2] = z;
    }
    for (let k = 0; k < F; k++) { const oi = (V0 + E + k) * 3; out.pos[oi] = fp[k * 3]; out.pos[oi + 1] = fp[k * 3 + 1]; out.pos[oi + 2] = fp[k * 3 + 2]; }
    // Eckpunkte / vertex points
    for (let i = 0; i < V0; i++) {
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      const es = vE[i], sh = es.filter((e) => e.sharp);
      let x = px, y = py, z = pz;
      if (es.length === 0) { /* frei / loose */ } else if (sh.length === 2) {
        x = (6 * px + P[sh[0].other * 3] + P[sh[1].other * 3]) / 8;
        y = (6 * py + P[sh[0].other * 3 + 1] + P[sh[1].other * 3 + 1]) / 8;
        z = (6 * pz + P[sh[0].other * 3 + 2] + P[sh[1].other * 3 + 2]) / 8;
      } else if (sh.length < 2) {
        const n = es.length;
        let fx = 0, fy = 0, fz = 0, rx = 0, ry = 0, rz = 0;
        for (const k of vF[i]) { fx += fp[k * 3]; fy += fp[k * 3 + 1]; fz += fp[k * 3 + 2]; }
        const nf = vF[i].length;
        for (const e of es) { rx += (px + P[e.other * 3]) / 2; ry += (py + P[e.other * 3 + 1]) / 2; rz += (pz + P[e.other * 3 + 2]) / 2; }
        x = (fx / nf + (2 * rx) / n + (n - 3) * px) / n;
        y = (fy / nf + (2 * ry) / n + (n - 3) * py) / n;
        z = (fz / nf + (2 * rz) / n + (n - 3) * pz) / n;
      }
      out.pos[i * 3] = x; out.pos[i * 3 + 1] = y; out.pos[i * 3 + 2] = z;
    }
    // Teilflaechen / child faces
    const next = new Set<number>();
    const keep: boolean = sharp !== null && lv + 1 < (o.sharpLevels ?? 1);
    const V1 = V0 + E + F, key1 = (a: number, b: number) => (a < b ? a * V1 + b : b * V1 + a);
    cur.faces.forEach((f, k) => {
      const n = f.length;
      for (let i = 0; i < n; i++) {
        const v = f[i], nx = f[(i + 1) % n], pv = f[(i + n - 1) % n];
        const e1 = edges.get(key(v, nx))!, e0 = edges.get(key(pv, v))!;
        out.f([v, V0 + e1.id, V0 + E + k, V0 + e0.id], cur.cols[k], cur.inks[k]);
      }
    });
    if (keep) for (const kk of sharp!) {
      const e = edges.get(kk);
      if (!e) continue;
      next.add(key1(e.a, V0 + e.id));
      next.add(key1(e.b, V0 + e.id));
    }
    sharp = keep ? next : sharp !== null ? new Set<number>() : null;
    cur = out;
  }
  return cur;
}

// ---------- Kurven / curves ----------

/** Nicht-uniforme Catmull-Rom-Auswertung (Barry-Goldman) / non-uniform Catmull-Rom evaluation (Barry-Goldman) */
function crEval(p0: number, p1: number, p2: number, p3: number, t0: number, t1: number, t2: number, t3: number, t: number): number {
  const a1 = ((t1 - t) * p0 + (t - t0) * p1) / (t1 - t0);
  const a2 = ((t2 - t) * p1 + (t - t1) * p2) / (t2 - t1);
  const a3 = ((t3 - t) * p2 + (t - t2) * p3) / (t3 - t2);
  const b1 = ((t2 - t) * a1 + (t - t0) * a2) / (t2 - t0);
  const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
  return ((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1);
}

/** Glatte Kurve durch Punkte, n Abschnitte je Teilstueck (zentripetal) / smooth curve through points, n steps per span (centripetal) */
export function spline(pts: P3[], steps: number, loop = false): [number, number, number][] {
  const n = pts.length;
  const get = (i: number): P3 => {
    if (loop) return pts[((i % n) + n) % n];
    if (i < 0) return [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1], 2 * pts[0][2] - pts[1][2]];
    if (i >= n) return [2 * pts[n - 1][0] - pts[n - 2][0], 2 * pts[n - 1][1] - pts[n - 2][1], 2 * pts[n - 1][2] - pts[n - 2][2]];
    return pts[i];
  };
  const d = (a: P3, b: P3) => Math.max(1e-6, Math.sqrt(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])));
  const out: [number, number, number][] = [];
  const spans = loop ? n : n - 1;
  for (let k = 0; k < spans; k++) {
    const p0 = get(k - 1), p1 = get(k), p2 = get(k + 1), p3 = get(k + 2);
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let j = 0; j < steps; j++) {
      const t = t1 + ((t2 - t1) * j) / steps;
      out.push([0, 1, 2].map((c) => crEval(p0[c], p1[c], p2[c], p3[c], t0, t1, t2, t3, t)) as [number, number, number]);
    }
  }
  if (!loop) out.push([pts[n - 1][0], pts[n - 1][1], pts[n - 1][2]]);
  return out;
}

// ---------- Schlauch / tube ----------

/** Querschnitt an einer Stelle der Leitkurve / cross-section at one place of the guide curve */
export interface Station {
  p: P3;
  /** halbe Breite (lokal x) / half width (local x) */
  rx: number;
  /** Tiefe nach vorn (lokal +z) / depth to the front (local +z) */
  rf: number;
  /** Tiefe nach hinten, fehlt = rf / depth to the back, missing = rf */
  rb?: number;
  /** Superellipsen-Exponent: 2 rund, groesser kantiger / superellipse exponent: 2 round, larger boxier */
  n?: number;
  /** Verdrehung um die Leitkurve (rad) / twist about the guide curve (rad) */
  tw?: number;
}
export interface TubeOpts {
  /** Segmente im Umfang / segments around */
  seg: number;
  /** Ringabstand entlang der Kurve / ring spacing along the curve */
  ring: number;
  /** Richtung "vorn" am Anfang / the "front" direction at the start */
  front?: P3;
  /** geschlossene Schleife / closed loop */
  loop?: boolean;
  /** Stationen ohne Glaettung direkt als Ringe / stations used directly as rings, no smoothing */
  linear?: boolean;
  /** Dichte ignorieren (schon sparsam) / ignore the density (already lean) */
  fixed?: boolean;
}
type Colour2 = ColorLike | ((u: number, a: number) => THREE.Color);

/**
 * Parametrische Flaeche S(u, a): u = Stationskoordinate (0 = erste Station, 1.5 = zwischen zweiter und dritter),
 * a = Winkel um die Leitkurve (0 = vorn, PI/2 = lokal +x). Koerperteile, Kleidung und Zubehoer fragen dieselbe Flaeche
 * ab: Baender, Taschen und Riemen liegen dadurch buendig auf dem Koerper.
 * Parametric surface S(u, a): u = station coordinate (0 = first station, 1.5 = between the second and third),
 * a = angle around the guide curve (0 = front, PI/2 = local +x). Body parts, clothing and gear query the same surface,
 * so bands, pockets and straps sit flush on the body.
 */
export class Tube {
  readonly seg: number;
  readonly loop: boolean;
  /** Ringe [ring][seg] / rings */
  readonly rings: THREE.Vector3[][] = [];
  readonly us: number[] = [];
  readonly centres: THREE.Vector3[] = [];
  readonly frames: { X: THREE.Vector3; T: THREE.Vector3; Z: THREE.Vector3 }[] = [];
  private normals: THREE.Vector3[][] | null = null;

  constructor(readonly stations: Station[], o: TubeOpts) {
    const k = o.fixed ? 1 : density();
    this.seg = Math.max(o.fixed ? 3 : 5, Math.round(o.seg * k));
    this.loop = !!o.loop;
    const st = stations, ns = st.length;
    const get = (i: number): Station => (this.loop ? st[((i % ns) + ns) % ns] : st[clamp(i, 0, ns - 1)]);
    const ph = (i: number, c: number): number => {
      if (this.loop || (i >= 0 && i < ns)) return get(i).p[c];
      return i < 0 ? 2 * st[0].p[c] - st[1].p[c] : 2 * st[ns - 1].p[c] - st[ns - 2].p[c];
    };
    const dist = (i: number, j: number) => Math.max(1e-5, Math.sqrt(Math.hypot(ph(i, 0) - ph(j, 0), ph(i, 1) - ph(j, 1), ph(i, 2) - ph(j, 2))));
    const samples: { c: THREE.Vector3; rx: number; rf: number; rb: number; n: number; tw: number; u: number }[] = [];
    const sc = (s: Station) => [s.rx, s.rf, s.rb ?? s.rf, s.n ?? 2, s.tw ?? 0];
    const spans = this.loop ? ns : ns - 1;
    for (let s = 0; s < spans; s++) {
      const a = get(s), b = get(s + 1);
      const len = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]);
      const steps = o.linear ? 1 : Math.max(1, Math.round((len / o.ring) * k));
      const t0 = 0, t1 = t0 + dist(s - 1, s), t2 = t1 + dist(s, s + 1), t3 = t2 + dist(s + 1, s + 2);
      const s0 = sc(get(s - 1)), s1 = sc(a), s2 = sc(b), s3 = sc(get(s + 2));
      for (let j = 0; j < steps; j++) {
        const f = j / steps, t = t1 + (t2 - t1) * f;
        const c = o.linear || j === 0 ? new THREE.Vector3(a.p[0], a.p[1], a.p[2])
          : new THREE.Vector3(crEval(ph(s - 1, 0), a.p[0], b.p[0], ph(s + 2, 0), t0, t1, t2, t3, t), crEval(ph(s - 1, 1), a.p[1], b.p[1], ph(s + 2, 1), t0, t1, t2, t3, t), crEval(ph(s - 1, 2), a.p[2], b.p[2], ph(s + 2, 2), t0, t1, t2, t3, t));
        // Radien: halb Gerade mit weichem Uebergang, halb Kurve (kaum Ueberschwingen) / radii: half eased line, half curve (hardly any overshoot)
        const e = f * f * (3 - 2 * f);
        const val = (q: number) => (j === 0 ? s1[q] : lerp(lerp(s1[q], s2[q], e), crEval(s0[q], s1[q], s2[q], s3[q], t0, t1, t2, t3, t), 0.5));
        samples.push({ c, rx: val(0), rf: val(1), rb: val(2), n: val(3), tw: val(4), u: s + f });
      }
    }
    if (!this.loop) {
      const z = st[ns - 1], q = sc(z);
      samples.push({ c: new THREE.Vector3(z.p[0], z.p[1], z.p[2]), rx: q[0], rf: q[1], rb: q[2], n: q[3], tw: q[4], u: ns - 1 });
    }
    // Rahmen durch Paralleltransport / frames by parallel transport
    const nr = samples.length;
    const T = new THREE.Vector3();
    let Z = new THREE.Vector3(...(o.front ?? [0, 0, 1]));
    const base: THREE.Vector3[] = [];
    for (let i = 0; i < nr; i++) {
      const prev = samples[this.loop ? (i + nr - 1) % nr : Math.max(0, i - 1)].c, next = samples[this.loop ? (i + 1) % nr : Math.min(nr - 1, i + 1)].c;
      T.copy(next).sub(prev);
      if (T.lengthSq() < 1e-14) T.set(0, 1, 0);
      T.normalize();
      Z = Z.clone().addScaledVector(T, -Z.dot(T));
      if (Z.lengthSq() < 1e-10) {
        Z.set(1, 0, 0);
        if (Math.abs(T.x) > 0.9) Z.set(0, 0, 1);
        Z.addScaledVector(T, -Z.dot(T));
      }
      Z.normalize();
      base.push(Z.clone());
      this.frames.push({ X: new THREE.Vector3(), T: T.clone(), Z: Z.clone() });
    }
    // Schleife: Restverdrehung gleichmaessig verteilen / loop: spread the residual twist evenly
    let fix = 0;
    if (this.loop) {
      const T0 = this.frames[0].T;
      const zEnd = Z.clone().addScaledVector(T0, -Z.dot(T0)).normalize();
      fix = Math.atan2(zEnd.clone().cross(base[0]).dot(T0), zEnd.dot(base[0]));
    }
    for (let i = 0; i < nr; i++) {
      const s = samples[i], fr = this.frames[i];
      const tw = s.tw + (this.loop ? (fix * i) / nr : 0);
      if (tw) fr.Z.applyAxisAngle(fr.T, tw);
      fr.X.copy(fr.T).cross(fr.Z).normalize();
      const ring: THREE.Vector3[] = [];
      const ex = 2 / s.n;
      for (let j = 0; j < this.seg; j++) {
        const a = (j / this.seg) * TAU, sn = Math.sin(a), cs = Math.cos(a);
        const x = s.rx * Math.sign(sn) * Math.abs(sn) ** ex;
        const z = (cs >= 0 ? s.rf : s.rb) * Math.sign(cs) * Math.abs(cs) ** ex;
        ring.push(s.c.clone().addScaledVector(fr.X, x).addScaledVector(fr.Z, z));
      }
      this.rings.push(ring);
      this.us.push(s.u);
      this.centres.push(s.c);
    }
  }

  get nr(): number { return this.rings.length; }
  /** hoechste Stationskoordinate / highest station coordinate */
  get uMax(): number { return this.loop ? this.stations.length : this.stations.length - 1; }

  private computeNormals(): THREE.Vector3[][] {
    if (this.normals) return this.normals;
    const nr = this.nr, n = this.seg, out: THREE.Vector3[][] = [];
    const du = new THREE.Vector3(), da = new THREE.Vector3();
    for (let i = 0; i < nr; i++) {
      const row: THREE.Vector3[] = [];
      const i0 = this.loop ? (i + nr - 1) % nr : Math.max(0, i - 1), i1 = this.loop ? (i + 1) % nr : Math.min(nr - 1, i + 1);
      for (let j = 0; j < n; j++) {
        du.copy(this.rings[i1][j]).sub(this.rings[i0][j]);
        da.copy(this.rings[i][(j + 1) % n]).sub(this.rings[i][(j + n - 1) % n]);
        const nn = da.clone().cross(du);
        if (nn.lengthSq() < 1e-22) {
          // entarteter Ring (Spitze): radial vom Mittelpunkt / degenerate ring (tip): radial from the centre
          nn.copy(this.rings[i][j]).sub(this.centres[i]);
          if (nn.lengthSq() < 1e-22) nn.copy(this.frames[i].T).multiplyScalar(i === 0 ? -1 : 1);
        }
        row.push(nn.normalize());
      }
      out.push(row);
    }
    this.normals = out;
    return out;
  }

  /** Winkel a, unter dem eine Weltrichtung an der Stelle u liegt / angle a at which a world direction lies at u */
  angleOf(u: number, dir: P3 | THREE.Vector3): number {
    const d = dir instanceof THREE.Vector3 ? dir : V(dir);
    const fr = this.frames[this.ringAt(u)[0]];
    return Math.atan2(d.dot(fr.X), d.dot(fr.Z));
  }
  /** Mittelpunkt der Leitkurve bei u / centre of the guide curve at u */
  centreAt(u: number): THREE.Vector3 {
    const [i, f] = this.ringAt(u);
    return this.centres[i].clone().lerp(this.centres[Math.min(this.nr - 1, i + 1)], f);
  }

  private ringAt(u: number): [number, number] {
    const us = this.us, nr = us.length;
    if (u <= us[0]) return [0, 0];
    if (!this.loop && u >= us[nr - 1]) return [nr - 1, 0];
    if (this.loop && u >= us[nr - 1]) return [nr - 1, clamp((u - us[nr - 1]) / (this.uMax - us[nr - 1]))];
    let lo = 0, hi = nr - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (us[mid] <= u) lo = mid; else hi = mid; }
    return [lo, clamp((u - us[lo]) / (us[hi] - us[lo]))];
  }

  /**
   * Flaeche entlang ihrer Normale verschieben (Falten, Muskeln, Buendchen): fn liefert den Versatz je Punkt.
   * Displace the surface along its normal (folds, muscles, cuffs): fn returns the offset per point.
   */
  displace(fn: (u: number, a: number, p: THREE.Vector3) => number): this {
    const N = this.computeNormals();
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.seg; j++) {
      const d = fn(this.us[i], (j / this.seg) * TAU, this.rings[i][j]);
      if (d) this.rings[i][j].addScaledVector(N[i][j], d);
    }
    this.normals = null;
    return this;
  }
  /** Alle Punkte frei verformen / deform all points freely */
  warp(fn: (p: THREE.Vector3, u: number, a: number) => void): this {
    for (let i = 0; i < this.nr; i++) {
      for (let j = 0; j < this.seg; j++) fn(this.rings[i][j], this.us[i], (j / this.seg) * TAU);
      fn(this.centres[i], this.us[i], 0);
    }
    this.normals = null;
    return this;
  }

  /** Flaechenpunkt bei (u, a), um lift nach aussen / surface point at (u, a), lifted outward by lift */
  at(u: number, a: number, lift = 0): THREE.Vector3 {
    const [i, f] = this.ringAt(u);
    const i1 = this.loop ? (i + 1) % this.nr : Math.min(this.nr - 1, i + 1);
    const n = this.seg;
    let s = ((a / TAU) % 1) * n;
    if (s < 0) s += n;
    const j = Math.floor(s) % n, g = s - Math.floor(s), j1 = (j + 1) % n;
    const q = (r: THREE.Vector3[][]) => {
      const p0 = r[i][j].clone().lerp(r[i][j1], g), p1 = r[i1][j].clone().lerp(r[i1][j1], g);
      return p0.lerp(p1, f);
    };
    const p = q(this.rings);
    if (lift) p.addScaledVector(q(this.computeNormals()).normalize(), lift);
    return p;
  }
  normalAt(u: number, a: number): THREE.Vector3 {
    return this.at(u, a, 1).sub(this.at(u, a)).normalize();
  }

  /**
   * Als Netz ausgeben; Farbe je Flaeche aus (u, a) der Flaechenmitte. from/to: nur dieser Stationsbereich.
   * Emit as a mesh; colour per face from (u, a) of the face centre. from/to: only this station range.
   */
  mesh(m: PMesh, c: Colour2, o: { from?: number; to?: number; capA?: boolean; capB?: boolean; ink?: number | ((u: number) => number) } = {}): PMesh {
    const from = o.from ?? 0, to = o.to ?? this.uMax;
    const idx: number[] = [];
    for (let i = 0; i < this.nr; i++) if (this.us[i] >= from - 1e-9 && this.us[i] <= to + 1e-9) idx.push(i);
    const fixed = typeof c === 'function' ? null : col(c);
    const cf = c as (u: number, a: number) => THREE.Color;
    const n = this.seg;
    const base = m.vcount;
    for (const i of idx) for (const p of this.rings[i]) m.vp(p);
    const whole = this.loop && o.from === undefined && o.to === undefined;
    const last = whole ? idx.length : idx.length - 1;
    for (let q = 0; q < last; q++) {
      const q1 = (q + 1) % idx.length;
      const u = whole && q1 === 0 ? (this.us[idx[q]] + this.uMax) / 2 : (this.us[idx[q]] + this.us[idx[q1]]) / 2;
      const ink = typeof o.ink === 'function' ? o.ink(u) : o.ink ?? 1;
      for (let j = 0; j < n; j++) {
        const cc = fixed ?? cf(u, ((j + 0.5) / n) * TAU);
        m.f([base + q * n + j, base + q * n + ((j + 1) % n), base + q1 * n + ((j + 1) % n), base + q1 * n + j], cc, ink);
      }
    }
    const cap = (q: number, rev: boolean) => {
      const ring = this.rings[idx[q]];
      const ctr = new THREE.Vector3();
      for (const p of ring) ctr.add(p);
      const ci = m.vp(ctr.multiplyScalar(1 / n));
      const u = this.us[idx[q]];
      const ink = typeof o.ink === 'function' ? o.ink(u) : o.ink ?? 1;
      for (let j = 0; j < n; j++) {
        const cc = fixed ?? cf(u, ((j + 0.5) / n) * TAU);
        const a = base + q * n + j, b = base + q * n + ((j + 1) % n);
        m.f(rev ? [ci, b, a] : [ci, a, b], cc, ink);
      }
    };
    if (o.capA) cap(0, true);
    if (o.capB) cap(idx.length - 1, false);
    return m;
  }

  /**
   * Band oder Flicken, der buendig auf der Flaeche liegt (Guertel, Kragen, Tasche, Riemen): Bereich u0..u1 und a0..a1,
   * um lift abgehoben, an den Kanten mit einer Stufe der Staerke thick zur Flaeche zurueck.
   * Band or patch lying flush on the surface (belt, collar, pocket, strap): range u0..u1 and a0..a1, lifted by lift,
   * with a step of thickness thick back to the surface at the edges.
   */
  band(m: PMesh, u0: number, u1: number, lift: number | ((u: number, a: number) => number), c: Colour2, o: { a0?: number; a1?: number; nu?: number; na?: number; thick?: number; ink?: number; bulge?: number } = {}): PMesh {
    const full = o.a0 === undefined || o.a1 === undefined;
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU;
    const na = Math.max(2, o.na ?? Math.round((this.seg * Math.abs(a1 - a0)) / TAU)), nu = Math.max(1, o.nu ?? 2);
    const thick = o.thick ?? (typeof lift === 'number' ? lift : 0.002);
    const L = (u: number, a: number) => (typeof lift === 'function' ? lift(u, a) : lift);
    const cols = full ? na : na + 1;
    const fixed = typeof c === 'function' ? null : col(c);
    const cf = c as (u: number, a: number) => THREE.Color;
    const base = m.vcount;
    // Reihen: Stufe unten, Flaeche, Stufe oben / rows: lower step, face, upper step
    const rows: { u: number; down: boolean }[] = [{ u: u0, down: true }];
    for (let i = 0; i <= nu; i++) rows.push({ u: lerp(u0, u1, i / nu), down: false });
    rows.push({ u: u1, down: true });
    for (const r of rows) for (let j = 0; j < cols; j++) {
      const a = lerp(a0, a1, j / na);
      // Bauch: in der Mitte dicker (Polster, Rolle) / bulge: thicker in the middle (padding, roll)
      const fu = Math.sin(Math.PI * clamp((r.u - u0) / (u1 - u0 || 1)));
      const fa = full ? 1 : Math.sin(Math.PI * (j / na)) ** 0.5;
      const l = L(r.u, a) + (o.bulge ?? 0) * fu * fa;
      m.vp(this.at(r.u, a, r.down ? l - thick : l));
    }
    const id = (i: number, j: number) => base + i * cols + (full ? j % cols : j);
    const flip = (a1 - a0) * (u1 - u0) < 0;
    const quad = (q: number[], cc: THREE.Color) => m.f(flip ? q.reverse() : q, cc, o.ink ?? 1);
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < na; j++) {
      const cc = fixed ?? cf((rows[i].u + rows[i + 1].u) / 2, lerp(a0, a1, (j + 0.5) / na));
      quad([id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i + 1, j)], cc);
    }
    if (!full) {
      // Seitenkanten schliessen / close the side edges
      for (const j of [0, na]) {
        const a = lerp(a0, a1, j / na);
        const lowIds: number[] = [];
        for (let i = 1; i < rows.length - 1; i++) lowIds.push(m.vp(this.at(rows[i].u, a, L(rows[i].u, a) - thick)));
        for (let i = 1; i < rows.length - 2; i++) {
          const q = [id(i, j), id(i + 1, j), lowIds[i], lowIds[i - 1]];
          quad(j === 0 ? q : q.reverse(), fixed ?? cf(rows[i].u, a));
        }
      }
    }
    return m;
  }
}

// ---------- Harte Formen / hard-surface shapes ----------

/**
 * Drehkoerper um die y-Achse aus einem Profil [Radius, y] (von unten nach oben, Flaeche zeigt nach aussen); Ecken des
 * Profils bleiben harte Kanten (Knickwinkel).
 * Turned part about the y axis from a profile [radius, y] (bottom to top, surface facing outward); corners of the
 * profile stay hard edges (crease angle).
 */
export function lathe(profile: (readonly [number, number])[], seg: number, c: ColorLike | ((i: number) => ColorLike), o: { ink?: number; fixed?: boolean; from?: number; to?: number; sx?: number; sz?: number } = {}): PMesh {
  const m = new PMesh();
  const n = o.fixed ? seg : dens(seg, 6);
  const a0 = o.from ?? 0, a1 = o.to ?? TAU, full = o.from === undefined;
  const cols = full ? n : n + 1;
  const rings = profile.map(([r, y]) => Array.from({ length: cols }, (_, j) => {
    const a = lerp(a0, a1, j / n);
    return [Math.sin(a) * r * (o.sx ?? 1), y, Math.cos(a) * r * (o.sz ?? 1)] as P3;
  }));
  // Farbe je Profilabschnitt i (zwischen Punkt i und i + 1) / colour per profile span i (between point i and i + 1)
  const cc = typeof c === 'function' ? profile.map((_, i) => (i < profile.length - 1 ? col(c(i)) : WHITE)) : null, one = typeof c === 'function' ? WHITE : col(c);
  m.loft(rings, { closed: full, c: cc ? (i) => cc[i] : one, ink: o.ink });
  // Profil von oben nach unten: Flaechen umdrehen, damit sie nach aussen zeigen / profile running top to bottom: flip so the faces point outward
  if (profile[0][1] > profile[profile.length - 1][1]) m.flip();
  return m;
}

/**
 * Vieleck mit gerundeten Ecken: je Ecke `steps` Bogenschritte (gleiche Punktzahl fuer alle Radien, damit sich
 * Querschnitte verbinden lassen). Punkte gegen den Uhrzeigersinn.
 * Polygon with rounded corners: `steps` arc steps per corner (the same point count for every radius so that
 * cross-sections can be lofted). Points counter-clockwise.
 */
export function roundPoly(pts: (readonly [number, number])[], r: number | number[], steps = 3): [number, number][] {
  const n = pts.length, out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const rr = typeof r === 'number' ? r : r[i];
    const ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1];
    const la = Math.hypot(ax, ay) || 1e-9, lb = Math.hypot(bx, by) || 1e-9;
    const ang = Math.acos(clamp((ax * bx + ay * by) / (la * lb), -1, 1));
    const d = Math.min(rr / Math.max(1e-6, Math.tan(ang / 2)), la * 0.48, lb * 0.48);
    const p0: [number, number] = [p[0] + (ax / la) * d, p[1] + (ay / la) * d], p1: [number, number] = [p[0] + (bx / lb) * d, p[1] + (by / lb) * d];
    for (let k = 0; k <= steps; k++) {
      // quadratische Bezierkurve durch die Ecke / quadratic Bezier through the corner
      const t = k / steps, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * p[1] + t * t * p1[1]]);
    }
  }
  return out;
}

/** Vieleck nach innen versetzen (Gehrung) / inset a polygon (mitred) */
export function inset(pts: [number, number][], d: number): [number, number][] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    let e0x = p[0] - a[0], e0y = p[1] - a[1], e1x = b[0] - p[0], e1y = b[1] - p[1];
    const l0 = Math.hypot(e0x, e0y) || 1, l1 = Math.hypot(e1x, e1y) || 1;
    e0x /= l0; e0y /= l0; e1x /= l1; e1y /= l1;
    // Innennormalen (gegen den Uhrzeigersinn: links) / inward normals (counter-clockwise: left)
    const nx = -(e0y + e1y), ny = e0x + e1x;
    const l = Math.hypot(nx, ny) || 1;
    const cosH = Math.max(0.35, (nx / l) * -e0y + (ny / l) * e0x);
    return [p[0] + ((nx / l) * d) / cosH, p[1] + ((ny / l) * d) / cosH] as [number, number];
  });
}

/**
 * Profil (2D, gegen den Uhrzeigersinn) entlang einer Achse zum Koerper ausziehen, mit gerundeter Fase an beiden Deckeln.
 * place(x, y, w) bildet Profilpunkt und Tiefe w in den Raum ab; shape(x, y, t) verformt das Profil ueber die Tiefe.
 * Extrude a profile (2D, counter-clockwise) along an axis into a solid, with a rounded bevel at both lids.
 * place(x, y, w) maps a profile point and depth w into space; shape(x, y, t) deforms the profile over the depth.
 */
export function prism(outline: [number, number][], w0: number, w1: number, place: (x: number, y: number, w: number) => P3, c: ColorLike, o: { bevel?: number; steps?: number; ink?: number; mid?: number; shape?: (x: number, y: number, t: number) => [number, number] } = {}): PMesh {
  const m = new PMesh();
  const bev = o.bevel ?? 0, steps = bev > 0 ? o.steps ?? 2 : 0;
  const rings: P3[][] = [];
  const ring = (w: number, ins: number) => {
    const t = (w - w0) / (w1 - w0 || 1);
    const pts = ins > 0 ? inset(outline, ins) : outline;
    rings.push(pts.map(([x, y]) => { const q = o.shape ? o.shape(x, y, t) : [x, y]; return place(q[0], q[1], w); }));
  };
  for (let k = 0; k < steps; k++) { const a = ((k / steps) * Math.PI) / 2; ring(w0 + bev * (1 - Math.sin(a)), bev * (1 - Math.cos(a))); }
  const mid = o.mid ?? 1;
  for (let k = 0; k <= mid; k++) ring(lerp(w0 + bev, w1 - bev, k / mid), 0);
  for (let k = steps - 1; k >= 0; k--) { const a = ((k / steps) * Math.PI) / 2; ring(w1 - bev * (1 - Math.sin(a)), bev * (1 - Math.cos(a))); }
  m.loft(rings, { c: col(c), capA: 'poly', capB: 'poly', ink: o.ink });
  return outward(m);
}

/** Vorzeichenbehaftetes Volumen (positiv = Flaechen zeigen nach aussen) / signed volume (positive = faces point outward) */
export function signedVolume(m: PMesh): number {
  let v = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const f of m.faces) for (let i = 1; i < f.length - 1; i++) {
    m.get(f[0], a); m.get(f[i], b); m.get(f[i + 1], c);
    v += a.dot(b.cross(c));
  }
  return v;
}
/** Flaechen nach aussen drehen (geschlossene Koerper) / turn the faces outward (closed solids) */
export function outward(m: PMesh): PMesh {
  if (signedVolume(m) < 0) m.flip();
  return m;
}

export interface CageOpts {
  /** Oberseite [Breite, Tiefe] / top face [width, depth] */
  top?: [number, number];
  dz?: number;
  dx?: number;
  /** Unterteilung des Kaefigs je Achse / cage divisions per axis */
  cuts?: [number, number, number];
  round?: number;
  tight?: number;
}

/**
 * Quader als Kaefig fuer die Unterteilung (gemeinsame Ecken), optional oben verjuengt; zentriert.
 * Box as a cage for subdivision (shared vertices), optionally tapered at the top; centred.
 */
export function cage(w: number, h: number, d: number, c: ColorLike, o: CageOpts = {}): PMesh {
  const m = new PMesh(), cc = col(c);
  const [cx, cy, cz] = o.cuts ?? [1, 1, 1];
  const tw = o.top?.[0] ?? w, td = o.top?.[1] ?? d;
  const table = new Map<number, number>();
  const id = (i: number, j: number, k: number) => {
    const key = (i * 64 + j) * 64 + k;
    let q = table.get(key);
    if (q === undefined) {
      const fx = i / cx, fy = j / cy, fz = k / cz;
      const ww = lerp(w, tw, fy), dd = lerp(d, td, fy);
      q = m.v((fx - 0.5) * ww + (o.dx ?? 0) * fy, (fy - 0.5) * h, (fz - 0.5) * dd + (o.dz ?? 0) * fy);
      table.set(key, q);
    }
    return q;
  };
  for (let j = 0; j < cy; j++) for (let k = 0; k < cz; k++) { m.f([id(0, j, k), id(0, j, k + 1), id(0, j + 1, k + 1), id(0, j + 1, k)], cc); m.f([id(cx, j, k), id(cx, j + 1, k), id(cx, j + 1, k + 1), id(cx, j, k + 1)], cc); }
  for (let i = 0; i < cx; i++) for (let k = 0; k < cz; k++) { m.f([id(i, 0, k), id(i + 1, 0, k), id(i + 1, 0, k + 1), id(i, 0, k + 1)], cc); m.f([id(i, cy, k), id(i, cy, k + 1), id(i + 1, cy, k + 1), id(i + 1, cy, k)], cc); }
  for (let i = 0; i < cx; i++) for (let j = 0; j < cy; j++) { m.f([id(i, j, 0), id(i, j + 1, 0), id(i + 1, j + 1, 0), id(i + 1, j, 0)], cc); m.f([id(i, j, cz), id(i + 1, j, cz), id(i + 1, j + 1, cz), id(i, j + 1, cz)], cc); }
  return m;
}

/**
 * Quader mit weicher Fase aus der Unterteilung: `tight` scharfe Stufen, dann `round` runde Stufen (mehr scharfe Stufen
 * = engere Fase).
 * Box with a soft bevel from subdivision: `tight` sharp levels, then `round` round levels (more sharp levels = a
 * tighter bevel).
 */
export function softCage(w: number, h: number, d: number, c: ColorLike, o: CageOpts = {}): PMesh {
  const low = density() < 0.75;
  const tight = low ? Math.min(1, o.tight ?? 1) : o.tight ?? 1, round = low ? Math.min(1, o.round ?? 1) : o.round ?? 1;
  return subdivide(cage(w, h, d, c, o), tight + round, { sharp: 30, sharpLevels: tight });
}

/** Matrix aus Position, Euler-Drehung (XYZ) und Massstab / matrix from position, Euler rotation (XYZ) and scale */
export function mat4(p: P3 = [0, 0, 0], r: P3 = [0, 0, 0], s: P3 | number = 1): THREE.Matrix4 {
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : V(s);
  return new THREE.Matrix4().compose(V(p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])), sc);
}
/** Matrix, die +y auf die Strecke a->b legt (Ursprung a) / matrix putting +y on the segment a->b (origin a) */
export function alongY(a: P3 | THREE.Vector3, b: P3 | THREE.Vector3, roll = 0): THREE.Matrix4 {
  const va = a instanceof THREE.Vector3 ? a : V(a), vb = b instanceof THREE.Vector3 ? b : V(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll));
  return new THREE.Matrix4().compose(va.clone(), q, new THREE.Vector3(1, 1, 1));
}
/** Matrix aus Ursprung und Achsen / matrix from an origin and axes */
export function basis(o: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3): THREE.Matrix4 {
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(o);
}

export interface RodOpts { seg?: number; ring?: number; smooth?: boolean; ink?: number; caps?: boolean; n?: number; flat?: number; front?: P3; loop?: boolean }
/** Runder Stab, Draht oder flacher Riemen entlang von Punkten / round rod, wire or flat strap along points */
export function rod(pts: P3[], r: number | ((t: number) => number), c: ColorLike, o: RodOpts = {}): PMesh {
  const total = pts.length - 1;
  const st: Station[] = pts.map((p, i) => {
    const rr = typeof r === 'function' ? r(i / Math.max(1, total)) : r;
    return { p, rx: rr, rf: rr * (o.flat ?? 1), n: o.n };
  });
  const t = new Tube(st, { seg: o.seg ?? 6, ring: o.ring ?? 0.01, linear: o.smooth === false, front: o.front, loop: o.loop, fixed: true });
  const m = new PMesh();
  t.mesh(m, c, { capA: !o.loop && o.caps !== false, capB: !o.loop && o.caps !== false, ink: o.ink });
  return m;
}
