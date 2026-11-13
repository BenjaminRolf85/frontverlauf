/**
 * Baukasten fuer prozedurale Low-Poly-Modelle / toolkit for procedural low-poly models.
 * Jedes Teil wird nicht-indiziert, transformiert, flach schattiert und mit Vertexfarbe versehen;
 * am Ende wird alles zu einer BufferGeometry verschmolzen.
 * Every part is made non-indexed, transformed, flat-shaded and vertex-coloured;
 * finally everything is merged into one BufferGeometry.
 */
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { semantic } from '../../design/tokens';

export type ColorLike = string | THREE.Color;
export type V3 = readonly [number, number, number];
/** Transformation: Position, Euler-Rotation (rad, XYZ), Skalierung / position, rotation, scale */
export interface Xf { p?: V3; r?: V3; s?: V3 | number }

// ---------- Farben / colours ----------

/** Token-Farbe als THREE.Color (Kopie) / token colour as THREE.Color (copy) */
export function col(c: ColorLike): THREE.Color {
  return typeof c === 'string' ? new THREE.Color(c) : c.clone();
}
/** f < 1 dunkler, f > 1 heller (Richtung Weiss) / f < 1 darker, f > 1 lighter (towards white) */
export function shade(c: ColorLike, f: number): THREE.Color {
  const out = col(c);
  if (f <= 1) return out.multiplyScalar(f);
  return out.lerp(new THREE.Color(semantic.white), Math.min(1, f - 1));
}
export function mix(a: ColorLike, b: ColorLike, t: number): THREE.Color {
  return col(a).lerp(col(b), t);
}

// ---------- Zufall / random ----------

/** Deterministischer Zufall (mulberry32) / deterministic random */
export function rng(seed: number): () => number {
  let a = (seed | 0) ^ 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ---------- Cache ----------

const cache = new Map<string, THREE.BufferGeometry>();
/** Ergebnis je Schluessel einmal erzeugen / build once per key */
export function memo(key: string, fn: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = fn();
    g.name = key;
    cache.set(key, g);
  }
  return g;
}

// ---------- Transformationen / transforms ----------

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
export function xfMatrix(xf?: Xf): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  if (!xf) return m;
  const p = xf.p ?? [0, 0, 0];
  const r = xf.r ?? [0, 0, 0];
  const s = typeof xf.s === 'number' ? [xf.s, xf.s, xf.s] : (xf.s ?? [1, 1, 1]);
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  return m.compose(_v.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
}

/** Dreiecke umdrehen (bei Spiegelung) / flip triangle winding (for mirroring) */
function flipWinding(g: THREE.BufferGeometry) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name] as THREE.BufferAttribute;
    const n = a.itemSize;
    const arr = a.array as Float32Array;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k;
        const i2 = (t + 2) * n + k;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
}

/** Entartete Dreiecke entfernen / drop degenerate triangles */
function dropDegenerate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const keep: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    const area = b.sub(a).cross(c.sub(a)).lengthSq();
    if (area > 1e-14) keep.push(t);
  }
  if (keep.length * 3 === pos.count) return g;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const src = g.attributes[name] as THREE.BufferAttribute;
    const n = src.itemSize;
    const arr = new Float32Array(keep.length * 3 * n);
    keep.forEach((t, i) => {
      for (let k = 0; k < 3 * n; k++) arr[i * 3 * n + k] = (src.array as Float32Array)[t * n + k];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  return out;
}

// ---------- Detailstufe / detail scope ----------

/**
 * Detailbereich: skaliert Rundungssegmente und fast Quader (fuer Einheiten).
 * Detail scope: scales radial segments and bevels boxes (used for units).
 */
let DETAIL = { seg: 1, bevel: false };
export function withDetail<T>(seg: number, bevel: boolean, fn: () => T): T {
  const prev = DETAIL;
  DETAIL = { seg, bevel };
  try {
    return fn();
  } finally {
    DETAIL = prev;
  }
}
/** Segmentanzahl im aktuellen Detailbereich / segment count in the current detail scope */
function S(n: number, min = 3): number {
  return Math.max(min, Math.round(n * DETAIL.seg));
}
/** Quader, im Detailbereich mit Fasen / box, bevelled inside the detail scope */
function detailBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const m = Math.min(w, h, d);
  if (!DETAIL.bevel || m < 0.008) return new THREE.BoxGeometry(w, h, d);
  if (m >= 0.025) return geo.rbox(w, h, d, m * 0.2);
  return geo.cbox(w, h, d, Math.min(w, d) * 0.2);
}

// ---------- Grundkoerper / primitives (zentriert / centred) ----------

export const geo = {
  box: (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt: number, rb: number, h: number, seg = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, S(seg), 1, open),
  cone: (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, S(seg), 1),
  sphere: (r: number, ws = 8, hs = 6) => new THREE.SphereGeometry(r, S(ws), S(hs, 2)),
  ico: (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail),
  dodeca: (r: number) => new THREE.DodecahedronGeometry(r, 0),
  /** Halbkugel, Boden bei y=0 / hemisphere, base at y=0 */
  hemi: (r: number, ws = 8, hs = 3) => new THREE.SphereGeometry(r, S(ws), S(hs, 2), 0, Math.PI * 2, 0, Math.PI / 2),
  torus: (r: number, tube: number, rs = 4, ts = 12) => new THREE.TorusGeometry(r, tube, S(rs), S(ts)),
  /**
   * Quader mit verjuengter Oberseite / box with a tapered top.
   * Unten wb x db, oben wt x dt, Hoehe h, Oberseite um dz in z verschoben. Zentriert.
   */
  taper: (wb: number, db: number, wt: number, dt: number, h: number, dz = 0, dx = 0) => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const top = p.getY(i) > 0;
      p.setXYZ(i, p.getX(i) * (top ? wt : wb) + (top ? dx : 0), p.getY(i) * h, p.getZ(i) * (top ? dt : db) + (top ? dz : 0));
    }
    return g;
  },
  /**
   * Quader mit gefasten Kanten (Fase c), optional verjuengt; zentriert.
   * Box with chamfered edges (chamfer c), optionally tapered; centred.
   */
  rtaper: (wb: number, db: number, wt: number, dt: number, h: number, c: number, dz = 0) => {
    const pts: THREE.Vector3[] = [];
    const k = Math.min(c, h / 2.2, Math.min(wb, db, wt, dt) / 2.2);
    for (const top of [false, true]) {
      const y = top ? h / 2 : -h / 2;
      const w = top ? wt : wb, d = top ? dt : db, oz = top ? dz : 0;
      // Punkt auf der Seitenkante etwas innerhalb / point on the side edge slightly inside
      const t = k / h;
      const wi = top ? wt + (wb - wt) * t : wb + (wt - wb) * t;
      const di = top ? dt + (db - dt) * t : db + (dt - db) * t;
      const ozi = top ? dz * (1 - t) : dz * t;
      const yi = top ? y - k : y + k;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * (w / 2 - k), y, sz * d / 2 + oz));
        pts.push(new THREE.Vector3(sx * w / 2, y, sz * (d / 2 - k) + oz));
        pts.push(new THREE.Vector3(sx * wi / 2, yi, sz * di / 2 + ozi));
      }
    }
    return new ConvexGeometry(pts);
  },
  rbox: (w: number, h: number, d: number, c: number) => geo.rtaper(w, d, w, d, h, c),
  /**
   * Nur die senkrechten Kanten gefast (Achtkant-Prisma, 28 Dreiecke), optional verjuengt; zentriert.
   * Only the vertical edges chamfered (octagonal prism, 28 triangles), optionally tapered; centred.
   */
  ctaper: (wb: number, db: number, wt: number, dt: number, h: number, c: number, dz = 0) => {
    const pts: THREE.Vector3[] = [];
    for (const top of [false, true]) {
      const w = top ? wt : wb, d = top ? dt : db, oz = top ? dz : 0;
      const k = Math.min(c, w / 2.2, d / 2.2);
      const y = top ? h / 2 : -h / 2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * (w / 2 - k), y, sz * d / 2 + oz));
        pts.push(new THREE.Vector3(sx * w / 2, y, sz * (d / 2 - k) + oz));
      }
    }
    return new ConvexGeometry(pts);
  },
  cbox: (w: number, h: number, d: number, c: number) => geo.ctaper(w, d, w, d, h, c),
  /** Konvexe Huelle beliebiger Punkte / convex hull of arbitrary points */
  hull: (pts: V3[]) => new ConvexGeometry(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2]))),
  /** Prisma aus Grundriss (x,z), Boden y=0, Dach y=h / prism from a top-view outline */
  prismXZ: (pts: [number, number][], h: number) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    return g;
  },
  /** Seitenprofil (z,y), entlang x mit Breite w extrudiert, zentriert / side profile extruded along x */
  profileZY: (pts: [number, number][], w: number) => {
    const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 1 });
    g.rotateY(-Math.PI / 2);
    g.translate(w / 2, 0, 0);
    return g;
  },
  /** Frontprofil (x,y), entlang z mit Tiefe d extrudiert, zentriert / front profile extruded along z */
  profileXY: (pts: [number, number][], d: number) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -d / 2);
    return g;
  },
  /** Flache Form(en) in XY, entlang z extrudiert / flat shape(s) in XY extruded along z */
  shapes: (shapes: THREE.Shape[], d: number) => {
    const g = new THREE.ExtrudeGeometry(shapes, { depth: d, bevelEnabled: false, curveSegments: 3 });
    g.translate(0, 0, -d / 2);
    return g;
  },
};

// ---------- Builder ----------

export class Builder {
  private parts: THREE.BufferGeometry[] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  private get top(): THREE.Matrix4 {
    return this.stack[this.stack.length - 1];
  }

  /** Teile in einer lokalen Transformation bauen / build parts inside a local transform */
  group(xf: Xf, fn: () => void): this {
    this.stack.push(this.top.clone().multiply(xfMatrix(xf)));
    try {
      fn();
    } finally {
      this.stack.pop();
    }
    return this;
  }

  /** Spiegelt die Teile von fn an der x=0-Ebene zusaetzlich / adds a mirrored copy (x -> -x) */
  mirrorX(fn: () => void): this {
    fn();
    this.group({ s: [-1, 1, 1] }, fn);
    return this;
  }

  /** Geometrie in einer Farbe hinzufuegen / add a geometry in one colour */
  add(g0: THREE.BufferGeometry, c: ColorLike, xf?: Xf): this {
    let g = g0.index ? g0.toNonIndexed() : g0.clone();
    g0.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.morphAttributes = {};
    g.clearGroups();
    const m = this.top.clone().multiply(xfMatrix(xf));
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    g = dropDegenerate(g);
    g.computeVertexNormals();
    const cc = col(c);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = cc.r;
      arr[i * 3 + 1] = cc.g;
      arr[i * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.parts.push(g);
    return this;
  }

  /** Fertige, gefaerbte Geometrie uebernehmen / add an already coloured geometry */
  addColored(src: THREE.BufferGeometry, xf?: Xf): this {
    let g = src.index ? src.toNonIndexed() : src.clone();
    const m = this.top.clone().multiply(xfMatrix(xf));
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    g = dropDegenerate(g);
    g.computeVertexNormals();
    this.parts.push(g);
    return this;
  }

  // Kurzformen; p = Mittelpunkt / shorthands; p = centre
  box(w: number, h: number, d: number, c: ColorLike, p: V3, r?: V3): this {
    return this.add(detailBox(w, h, d), c, { p, r });
  }
  /** Quader mit Unterkante bei y / box with its bottom at y */
  block(x: number, y: number, z: number, w: number, h: number, d: number, c: ColorLike, ry = 0): this {
    return this.add(detailBox(w, h, d), c, { p: [x, y + h / 2, z], r: [0, ry, 0] });
  }
  cyl(rt: number, rb: number, h: number, seg: number, c: ColorLike, p: V3, r?: V3): this {
    return this.add(geo.cyl(rt, rb, h, seg), c, { p, r });
  }
  /** Rohr von a nach b / tube from a to b */
  tube(a: V3, b: V3, r: number, seg: number, c: ColorLike, r2 = r): this {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const g = geo.cyl(r2, r, len, seg);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return this.add(g, c);
  }

  /**
   * Teil entlang der Strecke a->c (lokale y-Achse = Richtung); make(len) liefert eine um y zentrierte Geometrie.
   * Part along segment a->c (local y = direction); make(len) returns geometry centred on y.
   */
  segment(a: THREE.Vector3, c: THREE.Vector3, make: (len: number) => THREE.BufferGeometry, col: ColorLike, inner?: (len: number) => void): this {
    const dir = c.clone().sub(a);
    const len = Math.max(1e-4, dir.length());
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
    this.group({ p: [a.x, a.y, a.z], r: [e.x, e.y, e.z] }, () => {
      this.add(make(len), col, { p: [0, len / 2, 0] });
      inner?.(len);
    });
    return this;
  }

  triangles(): number {
    return this.parts.reduce((s, g) => s + g.attributes.position.count / 3, 0);
  }

  build(): THREE.BufferGeometry {
    const g = this.parts.length ? mergeGeometries(this.parts, false) : new THREE.BufferGeometry();
    if (!g) throw new Error('mergeGeometries failed');
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}
