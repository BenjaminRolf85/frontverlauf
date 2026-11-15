/**
 * Grundkoerper einer Scheibenwelt: flache Oberseite mit sanften Huegeln (eine Farbe je Dreieck, Low-Poly wie das Brett),
 * eine Erdschicht am Rand, eine felsige, geschichtete Unterseite, die spitz nach unten zulaeuft, haengende Wurzeln,
 * Tropfsteine und lose Felsbrocken darunter. Dazu die Wegpunkte der Einsaetze auf der Oberseite.
 * Base body of a disc world: flat top with gentle hills (one colour per triangle, low-poly like the board), a soil
 * layer at the rim, a rocky layered underside tapering to a point, dangling roots, stalactites and loose rocks below.
 * Plus the waypoints of the missions on the top.
 *
 * Koordinaten: Mittelpunkt der Oberseite im Ursprung, Rand bei radius, Blick der Kamera aus +z.
 * Coordinates: centre of the top at the origin, rim at radius, camera looking from +z.
 */
import * as THREE from 'three';
import { Builder, geo } from '../models/kit';
import { rand, type Look } from './kit';

export interface DiscSpec {
  radius: number;
  seed: number;
  low: boolean;
  /** Hoehe der Oberseite (wird zum Rand hin auf 0 gefuehrt) / height of the top (faded to 0 at the rim) */
  height: (x: number, z: number) => number;
  /** Token-Farbe eines Dreiecks der Oberseite / token colour of a top triangle */
  top: (x: number, z: number, h: number, r: number, steep: number) => string;
  /** Erdschicht unter dem Rand / soil layer below the rim */
  soil: string;
  /** Gesteinsschichten der Unterseite von oben nach unten / rock layers of the underside top to bottom */
  strata: readonly string[];
  depth: number;
  root?: string;
  rock: string;
  /** Leuchtender Spalt in der Unterseite (Hoehle der Vergessenen) / glowing crack in the underside (cave of the Forgotten) */
  crack?: { angle: number };
  /** Zusaetzliches an der Unterseite (Ranken, Kristalle); surf(winkel, tiefe 0..1) liefert einen Punkt darauf / extra on the underside */
  under?: (b: Builder, surf: (a: number, f: number) => THREE.Vector3, rnd: () => number) => void;
  /** Wurzeln/Ranken je Scheibe / roots or tendrils per disc */
  roots?: number;
}

export interface Disc {
  group: THREE.Group;
  /** Hoehe der Oberseite / top height */
  heightAt: (x: number, z: number) => number;
  radius: number;
}

const TAU = Math.PI * 2;

/** Unregelmaessiger Rand / irregular rim */
const rimRadius = (R: number, a: number, seed: number) => R * (1 + Math.sin(a * 5 + seed) * 0.022 + Math.sin(a * 13 - seed * 2) * 0.012);

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Dreiecke mit einer Farbe je Dreieck schreiben / write triangles with one colour each */
class Tris {
  pos: number[] = [];
  col: number[] = [];
  private c = new THREE.Color();
  add(a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, color: string, shade = 1) {
    this.c.set(color).multiplyScalar(shade);
    for (const p of [a, b, d]) { this.pos.push(p.x, p.y, p.z); this.col.push(this.c.r, this.c.g, this.c.b); }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Scheibe bauen / build a disc */
export function buildDisc(spec: DiscSpec, look: Look): Disc {
  const { radius: R, seed, low } = spec;
  const R0 = rand(seed);
  const seg = low ? 40 : 72;
  const rings = low ? 10 : 20;
  const heightAt = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    return spec.height(x, z) * (1 - smooth(R * 0.78, R * 0.97, r));
  };
  const tris = new Tris();
  // --- Oberseite: Polargitter / top: polar grid ---
  const grid: THREE.Vector3[][] = [];
  for (let i = 0; i <= rings; i++) {
    const row: THREE.Vector3[] = [];
    for (let s = 0; s < seg; s++) {
      // leicht versetzte Winkel je Ring: weniger regelmaessig / slightly shifted angles per ring: less regular
      const a = (s / seg) * TAU + (i % 2) * (Math.PI / seg);
      const rr = rimRadius(R, a, seed) * (i / rings);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      row.push(new THREE.Vector3(x, i === rings ? 0 : heightAt(x, z), z));
    }
    grid.push(row);
  }
  const colourAt = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const x = (a.x + b.x + c.x) / 3, z = (a.z + b.z + c.z) / 3, h = (a.y + b.y + c.y) / 3;
    // Steilheit aus der Flaechennormale (0 flach, 1 senkrecht) / steepness from the face normal (0 flat, 1 vertical)
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    return spec.top(x, z, h, Math.hypot(x, z) / R, 1 - Math.abs(n.y));
  };
  const centre = new THREE.Vector3(0, heightAt(0, 0), 0);
  for (let s = 0; s < seg; s++) {
    const a = grid[1][s], b = grid[1][(s + 1) % seg];
    tris.add(centre, b, a, colourAt(centre, a, b));
  }
  for (let i = 1; i < rings; i++) {
    const inner = grid[i], outer = grid[i + 1];
    // Ringe sind abwechselnd um einen halben Schritt gedreht: Dreiecke greifen ineinander
    // rings are alternately rotated by half a step: triangles interlock
    const shift = i % 2;
    for (let s = 0; s < seg; s++) {
      const i0 = inner[s], i1 = inner[(s + 1) % seg];
      const o0 = outer[(s + shift) % seg], o1 = outer[(s + 1 + shift) % seg];
      tris.add(i0, i1, o0, colourAt(i0, i1, o0));
      tris.add(o0, i1, o1, colourAt(o0, i1, o1));
    }
  }
  // --- Erdschicht und Unterseite / soil layer and underside ---
  const rimRow = grid[rings];
  const levels: THREE.Vector3[][] = [rimRow];
  const soil = 0.13;
  const K = low ? 5 : 8;
  for (let k = 0; k <= K; k++) {
    const f = k / K;
    const row: THREE.Vector3[] = [];
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * TAU + (rings % 2) * (Math.PI / seg);
      const jitter = k === 0 ? 1 : 0.88 + R0() * 0.2;
      const rr = rimRadius(R, a, seed) * (k === 0 ? 1.0 : (1 - 0.86 * Math.pow(f, 1.25)) * jitter);
      const y = -soil - spec.depth * Math.pow(f, 0.85) + (k > 0 ? (R0() - 0.5) * 0.08 : 0);
      row.push(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
    }
    levels.push(row);
  }
  for (let k = 0; k < levels.length - 1; k++) {
    const up = levels[k], dn = levels[k + 1];
    const color = k === 0 ? spec.soil : spec.strata[(k - 1) % spec.strata.length];
    for (let s = 0; s < seg; s++) {
      const a = up[s], b = up[(s + 1) % seg], c = dn[s], d = dn[(s + 1) % seg];
      // Bruchkanten: abwechselnd heller und dunkler / broken facets: alternating lighter and darker
      const shade = 0.9 + ((s * 7 + k * 3) % 5) * 0.045;
      tris.add(a, b, c, color, shade);
      tris.add(b, d, c, color, shade * 0.94);
    }
  }
  const tip = new THREE.Vector3((R0() - 0.5) * 0.2, -soil - spec.depth * 1.18, (R0() - 0.5) * 0.2);
  const last = levels[levels.length - 1];
  for (let s = 0; s < seg; s++) tris.add(last[(s + 1) % seg], tip, last[s], spec.strata[spec.strata.length - 1], 0.85);
  const body = tris.geometry();
  const group = new THREE.Group();
  group.add(look.inked(body, 0.028));

  // --- Wurzeln, Tropfsteine, lose Brocken / roots, stalactites, loose rocks ---
  const b = new Builder();
  const rootCount = spec.root ? Math.round((spec.roots ?? 16) * (low ? 0.45 : 1)) : 0;
  for (let i = 0; i < rootCount; i++) {
    const a = (i / rootCount) * TAU + R0() * 0.4;
    const r0 = rimRadius(R, a, seed) * 0.985;
    let p = new THREE.Vector3(Math.cos(a) * r0, -0.05, Math.sin(a) * r0);
    const len = 0.35 + R0() * 0.55;
    const n = 4;
    for (let k = 0; k < n; k++) {
      const q = p.clone().add(new THREE.Vector3(Math.cos(a) * (0.04 - k * 0.03) + (R0() - 0.5) * 0.06, -len / n, Math.sin(a) * (0.04 - k * 0.03) + (R0() - 0.5) * 0.06));
      const r = 0.026 * (1 - k / n) + 0.006;
      b.tube([p.x, p.y, p.z], [q.x, q.y, q.z], r, 5, spec.root!, r * 0.7);
      p = q;
    }
  }
  const drips = low ? 5 : 10;
  for (let i = 0; i < drips; i++) {
    const k = 1 + Math.floor(R0() * (K - 1));
    const row = levels[k + 1];
    const v = row[Math.floor(R0() * seg)];
    const h = 0.18 + R0() * 0.32;
    b.add(geo.cone(0.05 + R0() * 0.05, h, 5), spec.strata[(k + 1) % spec.strata.length], { p: [v.x * 0.92, v.y - h / 2 + 0.03, v.z * 0.92], r: [Math.PI, R0(), 0] });
  }
  const loose = low ? 2 : 4;
  for (let i = 0; i < loose; i++) {
    const a = R0() * TAU, r = R * (0.35 + R0() * 0.45);
    const s = 0.07 + R0() * 0.09;
    b.add(geo.dodeca(s), spec.rock, { p: [Math.cos(a) * r, -soil - spec.depth * (0.75 + R0() * 0.5), Math.sin(a) * r], r: [R0() * 3, R0() * 3, R0() * 3], s: [1, 0.8, 1] });
  }
  if (spec.under) {
    const surf = (a: number, f: number) => {
      const k = Math.max(1, Math.min(K, Math.round(f * K)));
      const s = Math.round((((a % TAU) + TAU) % TAU) / TAU * seg) % seg;
      return levels[k + 1 > K + 1 ? K + 1 : k + 1][s].clone();
    };
    spec.under(b, surf, R0);
  }
  const extras = b.build();
  if (extras.getAttribute('position')) group.add(look.inked(extras, 0.012));
  else extras.dispose();
  return { group, heightAt, radius: R };
}

/**
 * Wegpunkte der Einsaetze: von links nach rechts ueber die Scheibe, mit Schlenkern; feste Endpunkte moeglich.
 * Mission waypoints: left to right across the disc with meanders; fixed end points possible.
 */
export function waypoints(n: number, R: number, seed: number, end?: { x: number; z: number }): THREE.Vector2[] {
  const R0 = rand(seed * 31 + 7);
  const out: THREE.Vector2[] = [];
  const amp = n >= 4 ? 0.36 : 0.16;
  const phase = R0() * Math.PI;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    let x = (-0.66 + t * 1.32) * R;
    let z = Math.sin(t * Math.PI * 2.2 + phase) * amp * R + (R0() - 0.5) * 0.08 * R;
    if (end && i === n - 1) { x = end.x; z = end.z; }
    // innerhalb des Randes halten / keep inside the rim
    const r = Math.hypot(x, z), lim = R * 0.78;
    if (r > lim) { x *= lim / r; z *= lim / r; }
    out.push(new THREE.Vector2(x, z));
  }
  return out;
}

/** Abstand eines Punkts zu einem Linienzug / distance of a point to a polyline */
export function distToPath(x: number, z: number, path: readonly THREE.Vector2[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dz = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.y + dz * t)));
  }
  if (path.length === 1) best = Math.hypot(x - path[0].x, z - path[0].y);
  return best;
}

/**
 * Freie Plaetze fuer Deko: Abstand zum Weg, zueinander und zum Rand (Verwerfungsverfahren, deterministisch).
 * Free spots for decoration: distance to the path, to each other and to the rim (rejection sampling, deterministic).
 */
export function scatter(count: number, R: number, seed: number, opts: {
  path?: readonly THREE.Vector2[]; pathGap?: number; gap?: number; maxR?: number; minR?: number; taken?: THREE.Vector2[]; accept?: (x: number, z: number) => boolean;
}): THREE.Vector2[] {
  const R0 = rand(seed);
  const out: THREE.Vector2[] = [];
  const taken = opts.taken ?? [];
  const gap = opts.gap ?? 0.25;
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const a = R0() * TAU, r = R * ((opts.minR ?? 0) + Math.sqrt(R0()) * ((opts.maxR ?? 0.86) - (opts.minR ?? 0)));
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (opts.path && distToPath(x, z, opts.path) < (opts.pathGap ?? 0.2)) continue;
    if ([...out, ...taken].some((p) => Math.hypot(p.x - x, p.y - z) < gap)) continue;
    if (opts.accept && !opts.accept(x, z)) continue;
    out.push(new THREE.Vector2(x, z));
  }
  taken.push(...out);
  return out;
}
