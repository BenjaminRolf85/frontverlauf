/**
 * Modellierwerkzeuge fuer Gesichter: hochaufgeloeste Kopfkugel, per Vertex verformt (Schaedel, Augenhoehlen,
 * Nase, Lippen, Kinn, Falten), glatte Normalen, Vertexfarben-Bemalung; dazu Augen mit Lidern, Ohren, Hals
 * und Straehnen (Haare, Bart, Brauen) als verjuengte Roehren.
 * Sculpting tools for faces: high-resolution head sphere deformed per vertex (skull, eye sockets, nose, lips,
 * chin, wrinkles), smooth normals, painted vertex colours; plus eyes with lids, ears, neck and strands
 * (hair, beard, brows) as tapered tubes.
 */
import * as THREE from 'three';
import { Builder, col, mix, shade, type ColorLike, type V3, type Xf } from './kit';
import { mat } from './look';

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Anisotrope Gaussglocke / anisotropic gaussian */
export function gauss(p: THREE.Vector3, c: V3, s: V3): number {
  const dx = (p.x - c[0]) / s[0], dy = (p.y - c[1]) / s[1], dz = (p.z - c[2]) / s[2];
  return Math.exp(-(dx * dx + dy * dy + dz * dz));
}
/** Abstand eines Punktes zu einer Strecke in der Bildebene / distance of a point to a segment in the picture plane */
export function segDist(x: number, y: number, a: [number, number], b: [number, number]): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const t = clamp(((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy));
  return Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t);
}

export interface Bump { c: V3; s: V3; a: number }
export interface Groove { a: [number, number]; b: [number, number]; w: number; d: number }

/** Gesichtsform in normierten Kopfkoordinaten (Kugel r=1, Gesicht +z) / face shape in normalised head coordinates */
export interface FaceShape {
  jaw: number; chin: number; chinDown: number; back: number; crown: number;
  socket: number; brow: number; cheek: number; hollow: number; temple: number;
  noseBridge: number; noseLen: number; noseW: number; noseY: number;
  lipU: number; lipL: number; mouthW: number; mouthY: number; smile: number; asym: number; mouthDepth: number;
  fold: number; age: number; frown: number;
  eyeX: number; eyeY: number;
  /** Abflachung der Gesichtsebene / face-plane flattening */
  flat?: number;
  /** untere Gesichtshaelfte strecken / stretch the lower face */
  lowY?: number;
  /** Nasenloch-Tusche (0 = keine) / nostril ink (0 = none) */
  nostrils?: number;
  /** Falten als Geometrie (sonst nur Tusche) / wrinkles as geometry (otherwise ink only) */
  ageGeo?: number;
  frownGeo?: number;
  bumps?: Bump[];
  grooves?: Groove[];
}

export const BASE_FACE: FaceShape = {
  flat: 0.08, lowY: 0,
  jaw: 0.25, chin: 0.12, chinDown: 0.05, back: 0.08, crown: 0.0,
  socket: 0.1, brow: 0.05, cheek: 0.06, hollow: 0, temple: 0.04,
  noseBridge: 0.08, noseLen: 0.2, noseW: 1, noseY: -0.25,
  lipU: 0.04, lipL: 0.05, mouthW: 0.42, mouthY: -0.55, smile: 0, asym: 0, mouthDepth: 0.045,
  fold: 0.01, age: 0, frown: 0,
  eyeX: 0.36, eyeY: 0.1,
};

export type Painter = (p: THREE.Vector3, w: FaceWeights) => THREE.Color | null;
export interface FaceWeights { lipU: number; lipL: number; mouth: number; cheek: number; nose: number; socket: number; jaw: number; front: number }

/** Modellierter Kopf / sculpted head */
export class Sculpt {
  readonly f: FaceShape;
  constructor(readonly centre: V3, readonly radii: V3, f: Partial<FaceShape>) {
    this.f = { ...BASE_FACE, ...f };
  }

  /** Mundlinie y(x) / mouth line y(x) */
  mouthLine(x: number): number {
    const u = (2 * x) / this.f.mouthW;
    return this.f.mouthY + this.f.smile * u * u + this.f.asym * u;
  }

  weights(p: THREE.Vector3): FaceWeights {
    const f = this.f, front = smoothstep(0.35, 0.8, p.z);
    const dy = p.y - this.mouthLine(p.x);
    const mx = Math.exp(-((p.x / (f.mouthW * 0.55)) ** 6));
    return {
      lipU: front * mx * Math.exp(-(((dy - 0.035) / 0.03) ** 2)) * (1 - 0.5 * Math.exp(-((p.x / 0.04) ** 2)) * smoothstep(0.03, 0.06, dy)),
      lipL: front * Math.exp(-((p.x / (f.mouthW * 0.47)) ** 6)) * Math.exp(-(((dy + 0.045) / 0.035) ** 2)),
      mouth: front * mx * Math.exp(-((dy / 0.022) ** 2)),
      cheek: Math.max(gauss(p, [f.eyeX + 0.12, -0.2, 0.8], [0.17, 0.15, 0.4]), gauss(p, [-f.eyeX - 0.12, -0.2, 0.8], [0.17, 0.15, 0.4])),
      nose: gauss(p, [0, f.noseY, 1], [0.1 * f.noseW, 0.1, 0.4]),
      socket: Math.max(gauss(p, [f.eyeX, f.eyeY, 0.93], [0.17, 0.13, 0.4]), gauss(p, [-f.eyeX, f.eyeY, 0.93], [0.17, 0.13, 0.4])),
      jaw: smoothstep(-0.35, -0.75, p.y) * smoothstep(0.0, 0.5, p.z),
      front,
    };
  }

  /** Radiale Verschiebung / radial displacement */
  field(p: THREE.Vector3): number {
    const f = this.f, w = this.weights(p), fr = w.front;
    let d = 0;
    for (const s of [-1, 1]) {
      const ex = s * f.eyeX;
      d -= f.socket * gauss(p, [ex, f.eyeY, 0.93], [0.19, 0.14, 0.3]);
      d += f.brow * gauss(p, [ex * 1.02, f.eyeY + 0.2, 0.9], [0.22, 0.065, 0.3]);
      d += f.cheek * gauss(p, [s * (f.eyeX + 0.17), -0.1, 0.78], [0.17, 0.12, 0.3]);
      d -= f.hollow * gauss(p, [s * 0.5, -0.38, 0.75], [0.14, 0.14, 0.3]);
      d -= f.temple * gauss(p, [s * 0.76, 0.32, 0.52], [0.14, 0.2, 0.3]);
      // Nasenfluegel und Nasenloecher / nostril wings and nostrils
      d += f.noseLen * 0.4 * gauss(p, [s * 0.11 * f.noseW, f.noseY - 0.04, 0.97], [0.065, 0.055, 0.3]);
      d -= 0.035 * gauss(p, [s * 0.065 * f.noseW, f.noseY - 0.085, 0.97], [0.03, 0.022, 0.3]);
      // Nasolabialfalte / nasolabial fold
      const dist = segDist(p.x, p.y, [s * 0.17 * f.noseW, f.noseY - 0.04], [s * (f.mouthW * 0.6), this.mouthLine(s * f.mouthW * 0.5) - 0.03]);
      d -= f.fold * fr * Math.exp(-((dist / 0.03) ** 2));
      d += f.fold * 0.5 * fr * Math.exp(-(((dist - 0.06) / 0.04) ** 2)) * (Math.abs(p.x) > 0.17 ? 1 : 0);
      // Mundwinkel / mouth corners
      d -= 0.012 * gauss(p, [s * f.mouthW * 0.52, this.mouthLine(s * f.mouthW * 0.52), 0.95], [0.04, 0.035, 0.3]);
      // Kraehenfuesse und Traenensaecke / crow's feet and eye bags
      const ageG = f.ageGeo ?? 0;
      if (ageG > 0) {
        for (const a of [-0.45, 0, 0.45]) {
          const ax = s * (f.eyeX + 0.2), ay = f.eyeY;
          const dd = segDist(p.x, p.y, [ax, ay], [ax + s * Math.cos(a) * 0.12, ay + Math.sin(a) * 0.12]);
          d -= ageG * 0.006 * fr * Math.exp(-((dd / 0.012) ** 2));
        }
        const bag = segDist(p.x, p.y, [ex - 0.12, f.eyeY - 0.13], [ex + 0.1, f.eyeY - 0.12]);
        d -= ageG * 0.006 * fr * Math.exp(-((bag / 0.013) ** 2));
        d += ageG * 0.004 * fr * Math.exp(-(((bag - 0.035) / 0.025) ** 2)) * (p.y < f.eyeY - 0.12 ? 1 : 0);
      }
    }
    // Glabella, Nasenruecken, Nasenspitze / glabella, nose bridge, nose tip
    d += f.brow * 0.6 * gauss(p, [0, f.eyeY + 0.17, 1], [0.1, 0.07, 0.3]);
    d += f.noseBridge * gauss(p, [0, (f.eyeY + f.noseY) / 2, 1], [0.07 * f.noseW, Math.abs(f.eyeY - f.noseY) * 0.6, 0.3]);
    d += f.noseLen * gauss(p, [0, f.noseY, 1], [0.085 * f.noseW, 0.075, 0.3]);
    d -= 0.03 * gauss(p, [0, f.noseY - 0.075, 1], [0.04, 0.025, 0.3]);
    // Philtrum / philtrum
    const phY = (f.noseY - 0.1 + this.mouthLine(0) + 0.06) / 2;
    d -= 0.012 * gauss(p, [0, phY, 1], [0.025, 0.05, 0.3]);
    for (const s of [-1, 1]) d += 0.008 * gauss(p, [s * 0.045, phY, 1], [0.02, 0.05, 0.3]);
    // Lippen und Mundlinie / lips and mouth line
    d += f.lipU * w.lipU + f.lipL * w.lipL - f.mouthDepth * w.mouth;
    // Kinn / chin
    d += 0.06 * gauss(p, [0, this.mouthLine(0) - 0.3, 0.8], [0.2, 0.12, 0.3]);
    d -= 0.01 * fr * gauss(p, [0, this.mouthLine(0) - 0.16, 0.9], [0.15, 0.04, 0.3]);
    // Stirnfalten und Zornesfalten / forehead lines and frown lines
    if ((f.ageGeo ?? 0) > 0) for (const yk of [0.48, 0.58, 0.68]) {
      const yy = yk + 0.03 * Math.cos(p.x * 4);
      d -= (f.ageGeo ?? 0) * 0.006 * fr * Math.exp(-(((p.y - yy) / 0.014) ** 2)) * Math.exp(-((p.x / 0.42) ** 4));
    }
    if ((f.frownGeo ?? 0) > 0) for (const s of [-1, 1]) {
      const dd = segDist(p.x, p.y, [s * 0.05, f.eyeY + 0.12], [s * 0.07, f.eyeY + 0.3]);
      d -= (f.frownGeo ?? 0) * 0.012 * Math.exp(-((dd / 0.014) ** 2));
    }
    for (const b of f.bumps ?? []) d += b.a * gauss(p, b.c, b.s);
    for (const g of f.grooves ?? []) d -= g.d * fr * Math.exp(-((segDist(p.x, p.y, g.a, g.b) / g.w) ** 2));
    return d;
  }

  /** Normierten Kugelpunkt verformen / deform a normalised sphere point */
  deform(p: THREE.Vector3): THREE.Vector3 {
    const f = this.f;
    const q = p.clone().multiplyScalar(1 + this.field(p));
    if (q.y < 0) {
      q.y *= 1 + (f.lowY ?? 0);
      const t = smoothstep(0, 0.95, -q.y);
      q.x *= 1 - f.jaw * t ** 1.4;
      if (q.z > 0) q.z *= 1 + f.chin * t * t;
      q.y -= f.chinDown * t * t * Math.max(0, q.z);
    }
    if (q.z < 0) q.z *= 1 + f.back;
    // flachere Gesichtsebene / flatter face plane
    else q.z *= 1 - (f.flat ?? 0.08) * smoothstep(0.4, 1, p.z);
    if (q.y > 0) q.y *= 1 + f.crown * q.y;
    return q;
  }

  toWorld(q: THREE.Vector3): V3 {
    return [this.centre[0] + q.x * this.radii[0], this.centre[1] + q.y * this.radii[1], this.centre[2] + q.z * this.radii[2]];
  }

  /** Oberflaechenpunkt vorn bei (x, y), um lift (normiert) nach aussen versetzt / front surface point lifted outward */
  surf(x: number, y: number, lift = 0): V3 {
    const p = new THREE.Vector3(x, y, Math.sqrt(Math.max(0.0001, 1 - x * x - y * y))).normalize();
    return this.at(p, lift);
  }
  /** Oberflaechenpunkt in Richtung d / surface point in direction d */
  dir(d: V3, lift = 0): V3 {
    return this.at(new THREE.Vector3(d[0], d[1], d[2]).normalize(), lift);
  }
  private at(p: THREE.Vector3, lift: number): V3 {
    const q = this.deform(p);
    q.addScaledVector(q.clone().normalize(), lift);
    return this.toWorld(q);
  }
  /** Weltlaenge aus normierter Laenge / world length from a normalised length */
  len(n: number): number { return n * this.radii[0]; }

  /** Kopfgeometrie mit glatten Normalen und Bemalung / head geometry with smooth normals and paint */
  /**
   * Tuschelinien wie im Comic (0..1): Nasenloecher, Nasolabialfalte, Stirn-, Zornes- und Lachfalten.
   * Comic ink lines (0..1): nostrils, nasolabial fold, forehead, frown and laughter lines.
   */
  lines(p: THREE.Vector3): number {
    const f = this.f, fr = smoothstep(0.45, 0.8, p.z);
    const ln = (d: number, w: number) => Math.exp(-((d / w) ** 2));
    let v = 0;
    for (const s of [-1, 1]) {
      const nk = f.nostrils ?? 1;
      v = Math.max(v, 0.9 * nk * gauss(p, [s * 0.065 * f.noseW, f.noseY - 0.085, 0.97], [0.028, 0.017, 0.4]));
      // Nasenfluegelbogen / nostril wing arc
      const wing = Math.abs(Math.hypot((p.x - s * 0.11 * f.noseW) / 0.07, (p.y - f.noseY + 0.03) / 0.06) - 1);
      if (p.y < f.noseY + 0.01 && s * p.x > 0.1 * f.noseW) v = Math.max(v, 0.6 * nk * ln(wing, 0.12));
      if (f.fold > 0.015) {
        const d = segDist(p.x, p.y, [s * 0.19 * f.noseW, f.noseY - 0.05], [s * (f.mouthW * 0.6), this.mouthLine(s * f.mouthW * 0.5) - 0.06]);
        v = Math.max(v, Math.min(1, f.fold * 20) * ln(d, 0.012));
      }
      if (f.age > 0) {
        for (const a of [-0.45, 0, 0.45]) {
          const ax = s * (f.eyeX + 0.21), ay = f.eyeY;
          v = Math.max(v, 0.7 * f.age * ln(segDist(p.x, p.y, [ax, ay], [ax + s * Math.cos(a) * 0.1, ay + Math.sin(a) * 0.1]), 0.008));
        }
        v = Math.max(v, 0.6 * f.age * ln(segDist(p.x, p.y, [s * f.eyeX - 0.11, f.eyeY - 0.14], [s * f.eyeX + 0.1, f.eyeY - 0.13]), 0.009));
      }
      if (f.frown > 0) v = Math.max(v, 0.8 * f.frown * ln(segDist(p.x, p.y, [s * 0.045, f.eyeY + 0.13], [s * 0.065, f.eyeY + 0.28]), 0.009));
    }
    // Lachfalten an den Mundwinkeln / smile creases at the mouth corners
    if (f.smile > 0.03) for (const s of [-1, 1]) {
      const cx = s * f.mouthW * 0.6, cy = this.mouthLine(s * f.mouthW * 0.5);
      const arc = Math.abs(Math.hypot((p.x - cx + s * 0.02) / 0.05, (p.y - cy) / 0.07) - 1);
      if (s * (p.x - cx) > -0.01) v = Math.max(v, 0.55 * ln(arc, 0.12) * smoothstep(0.03, 0.08, f.smile + s * f.asym));
    }
    if (f.age > 0) for (const yk of [0.5, 0.6, 0.7]) {
      const yy = yk + 0.03 * Math.cos(p.x * 4);
      v = Math.max(v, 0.6 * f.age * ln(p.y - yy, 0.008) * Math.exp(-((p.x / 0.38) ** 4)));
    }
    return clamp(v) * fr;
  }

  mesh(skin: ColorLike, o: { paint?: Painter; ws?: number; hs?: number; hair?: { c: ColorLike; at: (p: THREE.Vector3) => number }; soften?: number; cut?: (p: THREE.Vector3) => boolean } = {}): THREE.BufferGeometry {
    const g = new THREE.SphereGeometry(1, o.ws ?? 96, o.hs ?? 72);
    const pos = g.getAttribute('position');
    const cols = new Float32Array(pos.count * 3);
    const base = col(skin);
    const p = new THREE.Vector3();
    const ref = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      p.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      ref.set([p.x, p.y, p.z], i * 3);
      const w = this.weights(p);
      let c = o.paint?.(p, w) ?? null;
      // eine flache Hautfarbe; Schattierung kommt aus der Form / one flat skin colour; shading comes from the form
      if (!c) c = base.clone();
      if (o.hair && o.hair.at(p) > 0.5) c = col(o.hair.c);
      cols.set([c.r, c.g, c.b], i * 3);
      const q = this.deform(p);
      pos.setXYZ(i, q.x * this.radii[0], q.y * this.radii[1], q.z * this.radii[2]);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    smoothNormals(g, o.soften ?? 14);
    if (o.cut && g.index) {
      // Dreiecke ausschneiden (z. B. Augenschlitz) / cut out triangles (e.g. eye slit)
      const src = g.index.array, keep: number[] = [], q = new THREE.Vector3();
      for (let t = 0; t < src.length; t += 3) {
        let all = true;
        for (let k = 0; k < 3; k++) {
          const vi = src[t + k];
          q.set(ref[vi * 3], ref[vi * 3 + 1], ref[vi * 3 + 2]);
          if (!o.cut(q)) { all = false; break; }
        }
        if (!all) keep.push(src[t], src[t + 1], src[t + 2]);
      }
      g.setIndex(keep);
    }
    g.translate(this.centre[0], this.centre[1], this.centre[2]);
    return g;
  }
}

/**
 * Normalen ueber Nachbarn mitteln: feine Rillen bleiben als Form, die Toon-Schattierung folgt den grossen Formen.
 * Average normals over neighbours: fine grooves stay as shape, toon shading follows the large forms.
 */
export function smoothNormals(g: THREE.BufferGeometry, iterations: number) {
  if (!g.index || iterations <= 0) return;
  const idx = g.index.array, nor = g.getAttribute('normal') as THREE.BufferAttribute, pos = g.getAttribute('position');
  const n = nor.count;
  // gleiche Positionen (Naht) zusammenfassen / merge equal positions (seam)
  const key = new Map<string, number>(), rep = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    const r = key.get(k);
    if (r === undefined) { key.set(k, i); rep[i] = i; } else rep[i] = r;
  }
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (let t = 0; t < idx.length; t += 3) {
    const a = rep[idx[t]], b = rep[idx[t + 1]], c = rep[idx[t + 2]];
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  let cur = Float32Array.from(nor.array as Float32Array);
  for (let it = 0; it < iterations; it++) {
    const next = new Float32Array(cur.length);
    for (let i = 0; i < n; i++) {
      if (rep[i] !== i) continue;
      let x = cur[i * 3] * 2, y = cur[i * 3 + 1] * 2, z = cur[i * 3 + 2] * 2;
      for (const j of nb[i]) { x += cur[j * 3]; y += cur[j * 3 + 1]; z += cur[j * 3 + 2]; }
      const l = Math.hypot(x, y, z) || 1;
      next[i * 3] = x / l; next[i * 3 + 1] = y / l; next[i * 3 + 2] = z / l;
    }
    for (let i = 0; i < n; i++) if (rep[i] !== i) next.set(next.subarray(rep[i] * 3, rep[i] * 3 + 3), i * 3);
    cur = next;
  }
  nor.array.set(cur);
  nor.needsUpdate = true;
}

// ---------- Hilfsteile / helper parts ----------

/** Einfarbig bemalen / paint a single colour */
export function paint(g: THREE.BufferGeometry, c: ColorLike | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)): THREE.BufferGeometry {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const arr = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const one = typeof c === 'function' ? null : col(c);
  for (let i = 0; i < pos.count; i++) {
    let cc = one;
    if (!cc) {
      p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
      cc = (c as (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)(p, n);
    }
    arr.set([cc.r, cc.g, cc.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Glattes Ellipsoid / smooth ellipsoid */
export function blob(b: Builder, c: ColorLike, xf: Xf, ws = 32, hs = 24) {
  b.addSmooth(paint(new THREE.SphereGeometry(1, ws, hs), c), xf);
}

/**
 * Verjuengte Straehne entlang einer Kurve (Haar, Bart, Braue) / tapered strand along a curve.
 * r0 an der Wurzel, r1 an der Spitze; Farbe von c0 nach c1.
 */
export function strand(b: Builder, pts: V3[], r0: number, r1: number, c0: ColorLike, c1: ColorLike = c0, o: { seg?: number; samples?: number; flat?: number; brush?: boolean; up?: THREE.Vector3 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])));
  const n = o.samples ?? Math.max(6, Math.round(pts.length * 2.5)), seg = o.seg ?? 5;
  const fr = curve.computeFrenetFrames(n, false);
  const verts: number[] = [], cols: number[] = [], idx: number[] = [];
  const a = col(c0), bcol = col(c1), cc = new THREE.Color();
  const flat = o.flat ?? 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const P = curve.getPointAt(t);
    // leicht bauchig, zur Spitze duenn / slightly bulging, thin at the tip
    const r = o.brush ? r0 * (0.15 + 0.85 * Math.sin(Math.PI * t) ** 0.6) : (r0 + (r1 - r0) * t) * (1 + 0.25 * Math.sin(Math.PI * t * 0.8));
    cc.copy(a).lerp(bcol, t);
    let N = fr.normals[i], B = fr.binormals[i];
    if (o.up) {
      // Flachseite zur Oberflaeche / flat side towards the surface
      const T = fr.tangents[i];
      B = o.up.clone().sub(T.clone().multiplyScalar(o.up.dot(T))).normalize();
      N = T.clone().cross(B).normalize();
    }
    for (let k = 0; k < seg; k++) {
      const ang = (k / seg) * Math.PI * 2;
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r * flat;
      verts.push(P.x + N.x * x + B.x * y, P.y + N.y * x + B.y * y, P.z + N.z * x + B.z * y);
      cols.push(cc.r, cc.g, cc.b);
    }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < seg; k++) {
    const a0 = i * seg + k, a1 = i * seg + ((k + 1) % seg), b0 = a0 + seg, b1 = a1 + seg;
    idx.push(a0, a1, b0, a1, b1, b0);
  }
  // Wurzel schliessen / close the root
  const centre = verts.length / 3;
  const P0 = curve.getPointAt(0);
  verts.push(P0.x, P0.y, P0.z); cols.push(a.r, a.g, a.b);
  for (let k = 0; k < seg; k++) idx.push(centre, (k + 1) % seg, k);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.addSmooth(g);
}

export interface EyeOpts {
  r?: number;
  iris: ColorLike;
  /** Oberlid: Polwinkel der Lidkante in Grad (60 weit offen, 85 schlaefrig) / upper lid edge polar angle in degrees */
  lid?: number;
  /** Unterlid in Grad vom unteren Pol / lower lid in degrees from the bottom pole */
  lower?: number;
  /** Lidneigung (positiv = aussen hoch) / lid tilt */
  tilt?: number;
  look?: [number, number];
  lidCol: ColorLike;
  lash?: ColorLike;
  lashes?: boolean;
  white?: ColorLike;
  irisSize?: number;
  /** Narbe ueber dem Lid / scar across the lid */
  scar?: ColorLike;
  depth?: number;
}

/** Auge mit Augapfel, Iris, Pupille, Glanzlicht und modellierten Lidern / eye with eyeball, iris, pupil, highlight and lids */
export function eye(b: Builder, S: Sculpt, side: -1 | 1, o: EyeOpts) {
  const f = S.f, rN = o.r ?? 0.2, r = S.len(rN);
  const x = side * f.eyeX, y = f.eyeY;
  const c = S.surf(x, y, -rN * (o.depth ?? 0.55));
  const look = new THREE.Vector3((o.look?.[0] ?? 0) * 0.35, (o.look?.[1] ?? 0) * 0.3, 1).normalize();
  const irisA = Math.cos(0.5 * (o.irisSize ?? 1)), pupA = Math.cos(0.22 * (o.irisSize ?? 1)), limA = Math.cos(0.54 * (o.irisSize ?? 1));
  const white = col(o.white ?? mat.white), iris = col(o.iris), irisD = shade(o.iris, 0.6), pupil = col(mat.ink);
  const ball = paint(new THREE.SphereGeometry(r, 32, 24), (p) => {
    const d = p.clone().normalize().dot(look);
    if (d > pupA) return pupil;
    if (d > irisA) return iris.clone().lerp(irisD, smoothstep(irisA + (1 - irisA) * 0.6, irisA, d) * 0.6 + smoothstep(pupA + 0.02, pupA, d) * 0.3);
    if (d > limA) return irisD;
    return white.clone().lerp(shade(white, 0.85), smoothstep(0.3, -0.2, p.y / r));
  });
  b.addSmooth(ball, { p: c });
  // Glanzlichter / highlights
  const hl = look.clone().add(new THREE.Vector3(-0.25, 0.3, 0)).normalize().multiplyScalar(r * 1.0);
  blob(b, mat.white, { p: [c[0] + hl.x, c[1] + hl.y, c[2] + hl.z], s: r * 0.16 }, 12, 8);
  const hl2 = look.clone().add(new THREE.Vector3(0.18, -0.2, 0)).normalize().multiplyScalar(r * 1.0);
  blob(b, mat.white, { p: [c[0] + hl2.x, c[1] + hl2.y, c[2] + hl2.z], s: r * 0.07 }, 10, 6);
  // Oberlid / upper lid
  const lidA = THREE.MathUtils.degToRad(o.lid ?? 68), tilt = (o.tilt ?? 0) * side;
  const lidC = col(o.lidCol), lash = col(o.lash ?? mat.ink), crease = shade(o.lidCol, 0.8);
  const upper = paint(new THREE.SphereGeometry(r * 1.08, 48, 18, 0, Math.PI * 2, 0, lidA + 0.06), (p) => {
    const th = Math.acos(clamp(p.y / (r * 1.08), -1, 1));
    if (o.scar && Math.abs(p.x - side * r * 0.15 + (p.y - r * 0.3) * 0.6) < r * 0.1 && p.z > 0) return col(o.scar);
    if (th > lidA - 0.08) return lash;
    if (Math.abs(th - lidA * 0.6) < 0.05) return crease;
    return lidC;
  });
  b.addSmooth(upper, { p: c, r: [0.04, 0, tilt] });
  // Unterlid / lower lid
  const lowA = THREE.MathUtils.degToRad(o.lower ?? 62);
  const lower = paint(new THREE.SphereGeometry(r * 1.06, 48, 12, 0, Math.PI * 2, Math.PI - lowA, lowA), (p) => {
    const th = Math.PI - Math.acos(clamp(p.y / (r * 1.06), -1, 1));
    return th > lowA - 0.07 ? shade(o.lidCol, 0.78) : shade(o.lidCol, 0.97);
  });
  b.addSmooth(lower, { p: c, r: [-0.1, 0, -tilt * 0.4] });
  // Wimpern / eyelashes
  if (o.lashes) {
    for (let i = 0; i < 6; i++) {
      const a = 0.15 + i * 0.16;
      const ex = side * Math.sin(a + 0.2) * r * 1.05, ey = Math.cos(lidA) * r * 1.05 + Math.cos(a) * r * 0.02, ez = Math.sin(lidA) * Math.cos(a + 0.2) * r * 1.05;
      const p0: V3 = [c[0] + ex, c[1] + ey, c[2] + ez];
      const p1: V3 = [p0[0] + side * r * (0.15 + i * 0.06), p0[1] + r * 0.2, p0[2] + r * 0.1];
      const p2: V3 = [p1[0] + side * r * (0.12 + i * 0.05), p1[1] + r * 0.12, p1[2] - r * 0.02];
      strand(b, [p0, p1, p2], r * 0.05, r * 0.012, lash, lash, { seg: 4, samples: 6 });
    }
  }
  return c;
}

/**
 * Augenbraue aus Straehnen; arch = Bogen, ang = Winkel (positiv = aussen hoch = streng).
 * Eyebrow made of strands; arch = curvature, ang = angle (positive = outer end up = stern).
 */
export function browStrands(b: Builder, S: Sculpt, side: -1 | 1, o: { y?: number; w?: number; ang?: number; arch?: number; n?: number; thick?: number; c: ColorLike; c1?: ColorLike; wild?: number; x0?: number }) {
  const f = S.f, n = o.n ?? 14, w = o.w ?? 0.34, x0 = o.x0 ?? 0.1;
  const y0 = (o.y ?? f.eyeY + 0.2);
  const R = mulberry(Math.round(side * 17 + n * 3));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = side * (x0 + t * w);
    const by = (tt: number) => y0 + (o.arch ?? 0.04) * Math.sin(Math.PI * tt) + (o.ang ?? 0) * (tt - 0.35);
    const yy = by(t) + (R() - 0.5) * 0.03;
    const len = 0.1 + (1 - Math.abs(t - 0.4)) * 0.05;
    const t1 = Math.min(1, t + len / w);
    const x1 = side * (x0 + t1 * w), y1 = by(t1) + 0.02 * (1 - t) + (R() - 0.5) * (o.wild ?? 0.02);
    const th = (o.thick ?? 0.028) * (1.2 - t * 0.6);
    strand(b, [S.surf(x, yy, 0.005), S.surf((x + x1) / 2, (yy + y1) / 2 + 0.012, th * 0.9), S.surf(x1, y1, th * 0.4)], S.len(th), S.len(th * 0.25), o.c, o.c1 ?? o.c, { seg: 5, samples: 8, flat: 0.6 });
  }
}

/** Ohr als modellierte Muschel / ear as a sculpted shell */
export function ear(b: Builder, S: Sculpt, side: -1 | 1, skin: ColorLike, o: { size?: number; y?: number; pointy?: number } = {}) {
  const s = o.size ?? 1;
  const g = new THREE.SphereGeometry(1, 48, 36);
  const pos = g.getAttribute('position');
  const p = new THREE.Vector3();
  const cols = new Float32Array(pos.count * 3);
  const inner = mix(skin, mat.red, 0.25), deep = shade(skin, 0.6), base = col(skin);
  for (let i = 0; i < pos.count; i++) {
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    // Muschel: aussen (x>0) eingedrueckt / shell: outer side (x>0) dented
    const dent = Math.max(0, p.x) * Math.exp(-((p.y / 0.7) ** 2 + (p.z / 0.75) ** 2));
    const x = p.x * 0.32 - dent * 0.28;
    const y = p.y * (1 + (o.pointy ?? 0) * Math.max(0, p.y) ** 2) * (p.y < 0 ? 0.85 : 1);
    const z = p.z * 0.62 * (p.y < -0.3 ? 0.75 : 1);
    pos.setXYZ(i, x, y, z);
    const c = dent > 0.25 ? deep.clone().lerp(inner, 1 - dent) : dent > 0.05 ? inner : base;
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const at = S.dir([side, o.y ?? -0.02, -0.08], -0.04);
  b.addSmooth(g, { p: at, r: [0, side * 0.3, side * 0.12], s: [side * S.len(0.24) * s, S.len(0.3) * s, S.len(0.24) * s] });
}

/** Hals mit optionalem Adamsapfel / neck with optional Adam's apple */
export function neck(b: Builder, c: ColorLike, o: { r: number; y0: number; h: number; z?: number; adam?: number; shadow?: ColorLike }) {
  const g = new THREE.CylinderGeometry(o.r, o.r * 1.12, o.h, 64, 12, true);
  const pos = g.getAttribute('position');
  const p = new THREE.Vector3();
  const cols = new Float32Array(pos.count * 3);
  const base = col(c), sh = col(o.shadow ?? shade(c, 0.75));
  for (let i = 0; i < pos.count; i++) {
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const a = (o.adam ?? 0) * Math.exp(-((p.x / (o.r * 0.25)) ** 2 + ((p.y - o.h * 0.05) / (o.h * 0.18)) ** 2)) * (p.z > 0 ? 1 : 0);
    p.z += a * o.r;
    pos.setXYZ(i, p.x, p.y, p.z);
    const k = smoothstep(0, o.h * 0.5, p.y) * (p.z > 0 ? 1 : 0.3);
    const cc = base.clone().lerp(sh, k * 0.6);
    cols.set([cc.r, cc.g, cc.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  b.addSmooth(g, { p: [0, o.y0 + o.h / 2, o.z ?? -0.01] });
}

/** Einfacher Zufall / simple random */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Haarstraehnen ueber dem Schaedel: von der Wurzel (Richtung) entlang der Kopfoberflaeche bis zur Spitze.
 * Hair strands over the skull: from the root (direction) along the head surface to the tip.
 */
export function hairLock(b: Builder, S: Sculpt, path: V3[], lift: number, r0: number, r1: number, c0: ColorLike, c1: ColorLike, seg = 5) {
  const pts = path.map((d, i) => S.dir(d, lift * (0.6 + 0.4 * Math.sin((i / Math.max(1, path.length - 1)) * Math.PI)) + 0.01));
  strand(b, pts, S.len(r0), S.len(r1), c0, c1, { seg, samples: Math.max(8, path.length * 3) });
}

// ---------- Comic-Tusche und Lippen / comic ink and lips ----------

/**
 * Tuschestrich auf der Gesichtsoberflaeche als offenes, einseitiges Band (Pinselform, an beiden Enden duenn).
 * Ein offenes Band bekommt von der Inverted-Hull-Kontur keinen Rand, bleibt also so fein wie gezeichnet.
 * Ink stroke on the face surface as an open one-sided ribbon (brush shape). An open ribbon gets no rim from
 * the inverted-hull outline, so it stays as fine as drawn.
 */
export function ink(b: Builder, S: Sculpt, pts: [number, number][], w: number, o: { lift?: number; c?: ColorLike; taper?: number } = {}) {
  const lift = o.lift ?? 0.008;
  ribbon(b, pts.map(([x, y]) => S.surf(x, y, lift)), S.centre, S.len(w), o.c ?? mat.ink, o.taper ?? 0.15);
}

/** Offenes Band entlang von Weltpunkten, Vorderseite weg von `centre` / open ribbon along world points, front facing away from `centre` */
export function ribbon(b: Builder, pts: V3[], centre: V3, half: number, c: ColorLike, taper = 0.15, samples = 0) {
  const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])));
  const n = samples || Math.max(10, pts.length * 6);
  const C = new THREE.Vector3(centre[0], centre[1], centre[2]);
  const verts: number[] = [], idx: number[] = [], nors: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const P = curve.getPointAt(t), T = curve.getTangentAt(t);
    const N = P.clone().sub(C).normalize();
    const side = N.clone().cross(T).normalize();
    const h = half * (taper + (1 - taper) * Math.sin(Math.PI * t) ** 0.7);
    verts.push(P.x + side.x * h, P.y + side.y * h, P.z + side.z * h, P.x - side.x * h, P.y - side.y * h, P.z - side.z * h);
    nors.push(N.x, N.y, N.z, N.x, N.y, N.z);
  }
  for (let i = 0; i < n; i++) {
    const a0 = i * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3;
    idx.push(a0, a1, b0, a1, b1, b0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nors, 3));
  g.setIndex(idx);
  // Wicklung pruefen: Dreiecksnormale soll nach aussen zeigen / check winding: face normal should point outward
  const A = new THREE.Vector3().fromArray(verts, 0), B = new THREE.Vector3().fromArray(verts, 3), D = new THREE.Vector3().fromArray(verts, 6);
  const fn = B.clone().sub(A).cross(D.clone().sub(A));
  if (fn.dot(new THREE.Vector3().fromArray(nors, 0)) < 0) {
    for (let k = 0; k < idx.length; k += 3) { const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; }
    g.setIndex(idx);
  }
  b.addSmooth(paint(g, c));
}

/** Bogen als Punktliste / arc as a point list */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 6): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

export interface InkOpts {
  c?: ColorLike;
  /** Seite des Nasenrueckenstrichs (Schattenseite) / side of the nose bridge stroke */
  noseSide?: -1 | 1;
  nose?: number;
  fold?: number;
  smile?: number;
  age?: number;
  frown?: number;
  chin?: number;
  cheek?: number;
  bags?: number;
  /** Strichstaerke / stroke weight */
  width?: number;
}

/**
 * Comic-Tuschestriche fuer ein Gesicht aus Geometrie (scharf, nicht gemalt).
 * Comic ink strokes for a face built as geometry (crisp, not painted).
 */
export function faceInk(b: Builder, S: Sculpt, o: InkOpts = {}) {
  const f = S.f, c = o.c ?? mat.ink, nw = f.noseW, side = o.noseSide ?? 1, W = o.width ?? 1.2;
  const k = o.nose ?? 1;
  if (k > 0) {
    // Nasenruecken-Strich auf der Schattenseite / nose bridge stroke on the shadow side
    const yTop = f.eyeY - 0.06, yBot = f.noseY + 0.02;
    ink(b, S, [[side * 0.05 * nw, yTop], [side * 0.065 * nw, (yTop + yBot) / 2], [side * 0.075 * nw, yBot + 0.02], [side * 0.06 * nw, yBot]], 0.024 * k * W, { c, lift: 0.02 + f.noseBridge * 0.6 });
    // Nasenfluegel / nostril wings
    for (const s of [-1, 1]) ink(b, S, arc(s * 0.1 * nw, f.noseY - 0.035, 0.05 * nw, 0.045, s > 0 ? 1.2 : 1.94, s > 0 ? -0.6 : 3.74, 6), 0.016 * k * W, { c, lift: 0.02 + f.noseLen * 0.3 });
    // Nasenloecher und Spitze unten / nostrils and tip underside
    for (const s of [-1, 1]) ink(b, S, [[s * 0.035 * nw, f.noseY - 0.09], [s * 0.065 * nw, f.noseY - 0.085], [s * 0.085 * nw, f.noseY - 0.07]], 0.013 * k * W, { c, lift: 0.015 + f.noseLen * 0.15 });
  }
  if ((o.fold ?? 0) > 0) for (const s of [-1, 1]) {
    const x0 = s * 0.2 * nw, y0 = f.noseY - 0.03, x1 = s * f.mouthW * 0.62, y1 = S.mouthLine(s * f.mouthW * 0.5) - 0.07;
    ink(b, S, [[x0, y0], [(x0 + x1) / 2 + s * 0.035, (y0 + y1) / 2], [x1, y1]], 0.011 * (o.fold ?? 0) * W, { c });
  }
  if ((o.smile ?? 0) > 0) for (const s of [-1, 1]) {
    const cx = s * f.mouthW * 0.56, cy = S.mouthLine(s * f.mouthW * 0.5);
    const strength = (o.smile ?? 0) * (1 + s * f.asym * 6);
    if (strength > 0.2) ink(b, S, [[cx + s * 0.005, cy + 0.025], [cx + s * 0.02, cy], [cx + s * 0.008, cy - 0.025]], 0.008 * Math.min(1.4, strength) * W, { c });
  }
  if ((o.chin ?? 0) > 0) {
    const y = S.mouthLine(0) - 0.13;
    ink(b, S, [[-0.07, y + 0.01], [0, y - 0.006], [0.07, y + 0.01]], 0.011 * (o.chin ?? 0) * W, { c });
  }
  if ((o.cheek ?? 0) > 0) for (const s of [-1, 1]) {
    // Wangenknochen-Kante / cheekbone plane edge
    ink(b, S, [[s * (f.eyeX + 0.22), f.eyeY - 0.2], [s * (f.eyeX + 0.14), f.eyeY - 0.32], [s * (f.eyeX + 0.02), f.eyeY - 0.4]], 0.01 * (o.cheek ?? 0) * W, { c });
  }
  const age = o.age ?? 0;
  if (age > 0) {
    for (const s of [-1, 1]) for (const a of [-0.4, 0, 0.4]) {
      const ax = s * (f.eyeX + 0.21), ay = f.eyeY - 0.01;
      ink(b, S, [[ax, ay], [ax + s * Math.cos(a) * 0.05, ay + Math.sin(a) * 0.05], [ax + s * Math.cos(a) * 0.1, ay + Math.sin(a) * 0.1 - 0.005]], 0.008 * age * W, { c });
    }
    for (const [yk, wk] of [[0.52, 0.3], [0.61, 0.26], [0.7, 0.2]]) ink(b, S, [[-wk, yk + 0.02], [-wk / 2, yk - 0.01], [0, yk], [wk / 2, yk - 0.01], [wk, yk + 0.02]], 0.008 * age * W, { c });
  }
  if ((o.bags ?? 0) > 0) for (const s of [-1, 1]) {
    const ex = s * f.eyeX;
    ink(b, S, [[ex - s * 0.09, f.eyeY - 0.16], [ex, f.eyeY - 0.19], [ex + s * 0.09, f.eyeY - 0.17]], 0.008 * (o.bags ?? 0) * W, { c });
  }
  if ((o.frown ?? 0) > 0) for (const s of [-1, 1]) ink(b, S, [[s * 0.04, f.eyeY + 0.12], [s * 0.05, f.eyeY + 0.2], [s * 0.065, f.eyeY + 0.28]], 0.01 * (o.frown ?? 0) * W, { c });
}

export interface LipOpts {
  c: ColorLike;
  /** untere Lippe (meist heller) / lower lip colour */
  cl?: ColorLike;
  w?: number;
  hU?: number;
  hL?: number;
  thick?: number;
  bow?: number;
  line?: ColorLike;
  lineW?: number;
}

/** Ober- und Unterlippe als eigene glatte Formen mit Mundlinie / upper and lower lip as separate smooth shapes with mouth line */
export function lips(b: Builder, S: Sculpt, o: LipOpts) {
  const w = o.w ?? S.f.mouthW, hU = o.hU ?? 0.05, hL = o.hL ?? 0.065, th = o.thick ?? 0.05;
  const make = (upper: boolean, c: ColorLike) => {
    const g = new THREE.SphereGeometry(1, 36, 14);
    const pos = g.getAttribute('position');
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const u = clamp(p.x, -1, 1), v = p.y, d = p.z;
      const px = (u * w) / 2;
      const taper = Math.sqrt(Math.max(0, 1 - u * u));
      const yl = S.mouthLine(px);
      const h = (upper ? hU : hL) * (0.25 + 0.75 * taper);
      let py = upper ? yl + 0.004 + h * (0.5 + 0.5 * v) : yl - 0.004 - h * (0.5 - 0.5 * v);
      if (upper && v > 0) py -= (o.bow ?? 0.012) * Math.exp(-((px / 0.035) ** 2)) * v;
      // Volumen nach vorn, an den Mundwinkeln flach / volume forward, flat at the corners
      const vol = Math.sqrt(Math.max(0, 1 - v * v));
      const lift = th * (0.15 + 0.85 * taper) * (0.5 + 0.5 * d) * (0.4 + 0.6 * vol) - th * 0.25;
      const q = S.surf(px, py, lift);
      pos.setXYZ(i, q[0], q[1], q[2]);
    }
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    b.addSmooth(paint(g, c));
  };
  make(true, o.c);
  make(false, o.cl ?? shade(o.c, 1.12));
  // Mundlinie mit Winkeln / mouth line with corners
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const x = (-0.56 + (i / 10) * 1.12) * w;
    pts.push([x, S.mouthLine(x)]);
  }
  ink(b, S, pts, o.lineW ?? 0.008, { c: o.line ?? mat.ink, lift: th * 0.55 });
}
