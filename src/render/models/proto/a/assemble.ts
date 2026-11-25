/**
 * Vorschlag A: Zusammenbau, Groessenklasse und Tuschelinie fuer die geformten Modelle.
 * - Assembly sammelt Netze (PMesh) und fertige Geometrien, auch mit Drehturm (gleiche userData.turrets wie der
 *   Builder, damit splitTurrets() des Spiels unveraendert funktioniert).
 * - finishProto ist eine Kopie von finishUnit aus index.ts (dort nicht exportiert): Comic-Vergroesserung und
 *   Helligkeitsverlauf, damit Vorschlag und heutiges Modell gleich behandelt werden.
 * - inkHull baut die Huelle fuer die Tuschelinie und beruecksichtigt die Tuschestaerke je Flaeche: feine Teile (Finger,
 *   Visier, Riemen) bekommen eine duennere Kontur statt eines schwarzen Kleckses. Das Konturmaterial des Spiels bleibt
 *   unveraendert, die Staerke steckt in der Laenge der Huellennormalen.
 * Proposal A: assembly, size class and ink line for the sculpted models.
 * - Assembly collects meshes (PMesh) and finished geometries, also with a turret (the same userData.turrets as the
 *   Builder, so the game's splitTurrets() works unchanged).
 * - finishProto is a copy of finishUnit from index.ts (not exported there): comic enlargement and value ramp, so the
 *   proposal and today's model are treated alike.
 * - inkHull builds the hull for the ink line and honours the ink weight per face: fine parts (fingers, sights, straps)
 *   get a thinner outline instead of a black blot. The game's outline material stays unchanged, the weight lives in
 *   the length of the hull normals.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder, scaleWithTurrets, type TurretRange } from '../../kit';
import type { PMesh } from './mesh';

/** Tuschestaerke als Attribut ergaenzen / add the ink weight as an attribute */
export function withInk(g: THREE.BufferGeometry, w: number): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  g.setAttribute('ink', new THREE.BufferAttribute(new Float32Array(n).fill(w), 1));
  return g;
}

export class Assembly {
  private parts: THREE.BufferGeometry[] = [];
  private sink = this.parts;
  private turrets: { pivot: [number, number, number]; parts: THREE.BufferGeometry[] }[] = [];

  private matrix: THREE.Matrix4 | null = null;

  /** Teile aus fn mit einer Abbildung einsetzen (z. B. Besatzung im Turm) / place the parts from fn through a transform (e.g. crew in the turret) */
  within(m: THREE.Matrix4, fn: () => void): this {
    const prev = this.matrix;
    this.matrix = prev ? prev.clone().multiply(m) : m;
    try { fn(); } finally { this.matrix = prev; }
    return this;
  }
  private push(g: THREE.BufferGeometry): void {
    if (this.matrix) g.applyMatrix4(this.matrix);
    this.sink.push(g);
  }
  /** Netz mit Knickwinkel-Normalen uebernehmen / take a mesh with crease-angle normals */
  add(m: PMesh, crease = 42): this {
    if (m.faces.length) this.push(m.toGeometry(crease));
    return this;
  }
  /** Teile aus dem vorhandenen Baukasten (Builder) uebernehmen / take parts from the existing kit (Builder) */
  addBuilt(fn: (b: Builder) => void, ink = 1): this {
    const b = new Builder();
    fn(b);
    if (b.triangles() > 0) this.push(withInk(b.build(), ink));
    return this;
  }
  /** Drehturm: Teile aus fn drehen um die senkrechte Achse durch pivot / turret: parts from fn turn about the vertical axis through pivot */
  turret(pivot: [number, number, number], fn: () => void): this {
    const t = { pivot, parts: [] as THREE.BufferGeometry[] };
    this.turrets.push(t);
    this.sink = t.parts;
    try { fn(); } finally { this.sink = this.parts; }
    return this;
  }
  build(): THREE.BufferGeometry {
    const turrets = this.turrets.filter((t) => t.parts.length);
    const all = [...this.parts, ...turrets.flatMap((t) => t.parts)];
    const g = mergeGeometries(all, false);
    if (!g) throw new Error('proto A: mergeGeometries failed');
    if (turrets.length) {
      const verts = (list: THREE.BufferGeometry[]) => list.reduce((n, p) => n + p.getAttribute('position').count, 0);
      let start = verts(this.parts);
      g.userData.turrets = turrets.map((t): TurretRange => {
        const count = verts(t.parts);
        const r: TurretRange = { start, count, pivot: t.pivot, yaw: 0 };
        start += count;
        return r;
      });
    }
    for (const p of all) p.dispose();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** Hoechste Modellhoehe unter dem Lebensbalken (wie index.ts) / highest model point below the HP badge (as in index.ts) */
const MAX_H = 0.62;

/**
 * Kopie von finishUnit (index.ts): Form je Typ, Groessenklasse, Helligkeitsverlauf. size/shape wie dort fuer
 * 'infantry' (1.2) und 'tank' (1.1, [1.18, 1, 1]).
 * Copy of finishUnit (index.ts): shape per type, size class, value ramp. size/shape as there for 'infantry' (1.2) and
 * 'tank' (1.1, [1.18, 1, 1]).
 */
export function finishProto(g: THREE.BufferGeometry, want: number, shape?: [number, number, number]): THREE.BufferGeometry {
  if (shape) {
    g.computeBoundingBox();
    const bx = g.boundingBox!;
    const fit = (k: number, ext: number) => (k > 1 ? Math.max(1, Math.min(k, 0.45 / ext)) : k);
    const sy = Math.min(shape[1], Math.max(1, MAX_H / bx.max.y));
    scaleWithTurrets(g, fit(shape[0], Math.max(-bx.min.x, bx.max.x)), sy, fit(shape[2], Math.max(-bx.min.z, bx.max.z)));
  }
  g.computeBoundingBox();
  let bb = g.boundingBox!;
  const ext = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
  const room = Math.min(0.45 / ext, MAX_H / bb.max.y);
  const s = want < 1 ? Math.min(want, room) : Math.max(1, Math.min(want, room));
  if (Math.abs(s - 1) > 0.001) { scaleWithTurrets(g, s, s, s); g.computeBoundingBox(); bb = g.boundingBox!; }
  g.userData.finishScale = s;
  const H = Math.max(0.15, bb.max.y);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), colr = g.getAttribute('color');
  const floor = 0.66;
  for (let i = 0; i < pos.count; i++) {
    const h = Math.min(1, Math.max(0, pos.getY(i) / (H * 0.42)));
    let k = floor + (1 - floor) * h * h * (3 - 2 * h);
    const ny = nor.getY(i);
    if (ny < -0.35) k *= 0.78;
    else if (ny > 0.55) k *= 1 + 0.2 * Math.min(1, Math.max(0, (pos.getY(i) / H - 0.25) / 0.6));
    colr.setXYZ(i, Math.min(1, colr.getX(i) * k), Math.min(1, colr.getY(i) * k), Math.min(1, colr.getZ(i) * k));
  }
  colr.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

const hullCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
/**
 * Huelle fuer die Tuschelinie: Ecken gleicher Position verschmelzen, Normalen glaetten und mit der Tuschestaerke
 * skalieren (kleinster Wert der beteiligten Flaechen). Passt zu outlineMaterial() aus toon.ts, das
 * position + normal * Breite rechnet.
 * Hull for the ink line: weld vertices at the same position, smooth the normals and scale them by the ink weight
 * (smallest value of the faces involved). Fits outlineMaterial() from toon.ts, which computes position + normal * width.
 */
export function inkHull(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const cached = hullCache.get(g);
  if (cached) return cached;
  const pos = g.getAttribute('position') as THREE.BufferAttribute, ink = g.getAttribute('ink') as THREE.BufferAttribute | undefined;
  const P = pos.array as Float32Array, n = pos.count;
  const map = new Map<number, number>();
  const outP: number[] = [], outN: number[] = [], outW: number[] = [];
  const index = new Uint32Array(n);
  const Q = 20000;
  for (let i = 0; i < n; i++) {
    const x = Math.round(P[i * 3] * Q), y = Math.round(P[i * 3 + 1] * Q), z = Math.round(P[i * 3 + 2] * Q);
    const key = ((x + 32768) * 65536 + (y + 32768)) * 65536 + (z + 32768);
    let id = map.get(key);
    if (id === undefined) {
      id = outW.length;
      map.set(key, id);
      outP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      outN.push(0, 0, 0);
      outW.push(1);
    }
    index[i] = id;
    if (ink) outW[id] = Math.min(outW[id], ink.getX(i));
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const keep: number[] = [];
  for (let t = 0; t < n; t += 3) {
    const i0 = index[t], i1 = index[t + 1], i2 = index[t + 2];
    if (i0 === i1 || i1 === i2 || i0 === i2) continue;
    a.fromArray(outP, i0 * 3); b.fromArray(outP, i1 * 3); c.fromArray(outP, i2 * 3);
    b.sub(a); c.sub(a); b.cross(c);
    for (const i of [i0, i1, i2]) { outN[i * 3] += b.x; outN[i * 3 + 1] += b.y; outN[i * 3 + 2] += b.z; }
    keep.push(i0, i1, i2);
  }
  for (let i = 0; i < outW.length; i++) {
    const l = Math.hypot(outN[i * 3], outN[i * 3 + 1], outN[i * 3 + 2]) || 1, w = outW[i] / l;
    outN[i * 3] *= w; outN[i * 3 + 1] *= w; outN[i * 3 + 2] *= w;
  }
  const h = new THREE.BufferGeometry();
  h.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
  h.setAttribute('normal', new THREE.Float32BufferAttribute(outN, 3));
  h.setIndex(keep);
  hullCache.set(g, h);
  return h;
}

/**
 * Geometrie an der Ebene x=0 spiegeln (Position, Normale, Wicklung) / mirror a geometry across the plane x=0
 * (position, normal, winding).
 */
export function mirrorX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute, n = a.itemSize, arr = a.array as Float32Array;
    if (name === 'position' || name === 'normal') for (let i = 0; i < arr.length; i += 3) arr[i] = -arr[i];
    for (let t = 0; t < a.count; t += 3) for (let k = 0; k < n; k++) {
      const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k, tmp = arr[i1];
      arr[i1] = arr[i2];
      arr[i2] = tmp;
    }
    a.needsUpdate = true;
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
