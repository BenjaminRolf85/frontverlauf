/**
 * Gezeichnete Einheiten: Baukasten der Gruppe Roboter und Kultfahrzeuge (Geometrie mit UV).
 * Inked units: kit of the group robots and cult vehicles (geometry with UVs).
 *
 * Was Laeufer, Drohnen und Schrottfahrzeuge gemeinsam brauchen: kantige Glieder als Loft, Gelenkkugeln, Rohre,
 * Stacheln, Antennen, flache Ringe, dazu eine Abbildung fertiger three.js-Formen (Torus) in eine Atlaszelle. Die
 * Fahrzeugteile (Kette, Rad, Auflagen) kommen unveraendert aus trim.ts.
 * What walkers, drones and scrap vehicles share: boxy limbs as lofts, joint balls, tubes, spikes, antennas, flat
 * rings, plus a mapping of ready-made three.js shapes (torus) into an atlas cell. The vehicle parts (track, wheel,
 * decals) come unchanged from trim.ts.
 */
import * as THREE from 'three';
import { fine, type ColorLike, type V3 } from '../kit';
import { mat } from '../look';
import { AtlasLayout, loft, REF, UvBuilder, type Region, type Ring } from './uvkit';

export const HALF_PI = Math.PI / 2;
/** geschlossene Spitze eines Lofts / closed tip of a loft */
export const TIP = 1e-7;
export const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Form mit eigenen UV (0..1, wie three.js sie liefert) in eine Atlaszelle legen: u laeuft nach rechts, v nach oben.
 * Put a shape with its own UVs (0..1, as three.js provides them) into an atlas cell: u runs right, v up.
 */
export function inCell(g0: THREE.BufferGeometry, r: Region): THREE.BufferGeometry {
  const g = g0.index ? g0.toNonIndexed() : g0;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (r.x + clamp01(uv.getX(i)) * r.w) / REF, (r.y + clamp01(1 - uv.getY(i)) * r.h) / REF);
  g.userData.smooth = true;
  return g;
}

/** Ringe einer Kugel oder eines Ellipsoids von oben nach unten / rings of a sphere or ellipsoid top to bottom */
export function orbRings(r: number, rows: number, o: { sy?: number; sz?: number; c?: ColorLike } = {}): Ring[] {
  const out: Ring[] = [];
  for (let i = 0; i <= rows; i++) {
    const a = (i / rows) * Math.PI, rx = Math.max(TIP, r * Math.sin(a));
    out.push({ y: r * (o.sy ?? 1) * Math.cos(a), rx, rz: rx * (o.sz ?? 1) });
  }
  if (o.c) out[0].c = o.c;
  return out;
}

export interface OrbOpts { cell?: string; sy?: number; sz?: number; gloss?: number; crease?: number; seg?: number; rows?: number; r?: V3 }
/** Kugel (Gelenk, Linse, Leuchte) / ball (joint, lens, lamp) */
export function orb(b: UvBuilder, A: AtlasLayout, p: V3, r: number, c: ColorLike, o: OrbOpts = {}): void {
  const hi = fine();
  b.add(loft(orbRings(r, o.rows ?? (hi ? 6 : 3), { sy: o.sy, sz: o.sz }), { seg: o.seg ?? (hi ? 10 : 6), region: A.get(o.cell ?? 'blank'), arc: true, color: c }), null, { xf: { p, r: o.r }, gloss: o.gloss ?? 0.3, crease: o.crease ?? 0 });
}

export interface LimbOpts {
  /** Breite und Tiefe am Anfang, optional am Ende / width and depth at the start, optionally at the end */
  w: number; d: number; w1?: number; d1?: number;
  cell?: string;
  /** Querschnitt: 4 = kantig, 2 = rund / cross-section: 4 = boxy, 2 = round */
  e?: number;
  seg?: number;
  gloss?: number;
  crease?: number;
  /** Ueberstand ueber die Gelenkpunkte / overshoot beyond the joint points */
  over?: number;
  /** Zelle spiegeln (linke Seite) / mirror the cell (left side) */
  flip?: boolean;
}
/**
 * Glied von a nach c als Loft mit gefasten Enden; die Zellenmitte (s = 0.5) zeigt nach `front`. t laeuft von a nach c.
 * Limb from a to c as a loft with chamfered ends; the cell centre (s = 0.5) faces `front`. t runs from a to c.
 */
export function limb(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, front: V3, color: ColorLike, o: LimbOpts): void {
  b.bone(V(a), V(c), V(front), (len) => {
    const e = o.e ?? 4, ov = o.over ?? 0.006, w1 = o.w1 ?? o.w, d1 = o.d1 ?? o.d, k = 0.76;
    const ch = Math.min(0.007, (len + 2 * ov) * 0.14);
    b.add(loft([
      { y: -ov, rx: (o.w / 2) * k, rz: (o.d / 2) * k, e, hard: true },
      { y: -ov + ch, rx: o.w / 2, rz: o.d / 2, e, hard: true },
      { y: len + ov - ch, rx: w1 / 2, rz: d1 / 2, e, hard: true },
      { y: len + ov, rx: (w1 / 2) * k, rz: (d1 / 2) * k, e, hard: true },
    ], { seg: o.seg ?? 8, region: A.get(o.cell ?? 'blank'), capFirst: true, capLast: true, color, ...(o.flip ? { s0: 1, s1: 0 } : {}) }), null, { gloss: o.gloss ?? 0, crease: o.crease ?? 1 });
  });
}

export interface TubeOpts { seg?: number; cell?: string; gloss?: number; crease?: number; tip?: boolean; front?: V3 }
/** Rundes Rohr von a nach c; tip = am Ende spitz zulaufend / round tube from a to c; tip = pointed at the end */
export function tube(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, r0: number, r1: number, color: ColorLike, o: TubeOpts = {}): void {
  b.bone(V(a), V(c), V(o.front ?? [0, 1, 0]), (len) => {
    const rings: Ring[] = o.tip
      ? [{ y: 0, rx: r0 }, { y: len * 0.8, rx: r1 }, { y: len, rx: TIP }]
      : [{ y: 0, rx: r0 }, { y: len, rx: r1 }];
    b.add(loft(rings, { seg: o.seg ?? (fine() ? 8 : 5), region: A.get(o.cell ?? 'blank'), capFirst: true, capLast: !o.tip, color }), null, { gloss: o.gloss ?? 0.3, crease: o.crease ?? 0 });
  });
}

/** Rohr entlang mehrerer Punkte (Schlauch, Kabel) / tube along several points (hose, cable) */
export function hose(b: UvBuilder, A: AtlasLayout, pts: V3[], r: number, color: ColorLike, seg = fine() ? 7 : 5): void {
  for (let i = 0; i < pts.length - 1; i++) tube(b, A, pts[i], pts[i + 1], r, r, color, { seg, gloss: 0.2 });
}

/** Stachel: Fuss p, Richtung dir / spike: base p, direction dir */
export function spike(b: UvBuilder, A: AtlasLayout, p: V3, dir: V3, r: number, len: number, color: ColorLike, seg = fine() ? 7 : 5): void {
  const d = V(dir).normalize().multiplyScalar(len);
  b.bone(V(p), V(p).add(d), new THREE.Vector3(0, 1, 0), (l) => {
    b.add(loft([{ y: 0, rx: r, hard: true }, { y: l, rx: TIP }], { seg, region: A.get('blank'), capFirst: true, color }), null, { crease: 0.6 });
  });
}

/** Stabantenne mit Fuss und farbiger Spitze / whip antenna with base and coloured tip */
export function antenna(b: UvBuilder, A: AtlasLayout, p: V3, h: number, tip: ColorLike, lean = -0.1): void {
  const hi = fine();
  b.add(loft([{ y: 0.012, rx: 0.0045, hard: true }, { y: 0, rx: 0.0065 }], { seg: hi ? 8 : 5, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p } });
  const top: V3 = [p[0], p[1] + h * Math.cos(lean), p[2] + h * Math.sin(lean)];
  tube(b, A, [p[0], p[1] + 0.01, p[2]], top, 0.0026, 0.0015, mat.dark, { seg: hi ? 5 : 3, crease: 0 });
  b.add(loft([{ y: 0.007, rx: TIP }, { y: 0, rx: 0.006 }, { y: -0.007, rx: TIP }], { seg: hi ? 6 : 4, region: A.get('blank'), color: tip }), null, { xf: { p: top }, crease: 0 });
}

/** Flacher Ring auf dem Boden (nach oben sichtbar) / flat ring on the ground (visible from above) */
export function annulus(r0: number, r1: number, seg: number, region: Region): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [];
  const put = (r: number, a: number, s: number, t: number) => {
    pos.push(Math.sin(a) * r, 0, Math.cos(a) * r); nor.push(0, 1, 0);
    uv.push((region.x + s * region.w) / REF, (region.y + t * region.h) / REF);
  };
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, s0 = i / seg, s1 = (i + 1) / seg;
    put(r0, a0, s0, 1); put(r1, a0, s0, 0); put(r1, a1, s1, 0);
    put(r0, a0, s0, 1); put(r1, a1, s1, 0); put(r0, a1, s1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.userData.smooth = true;
  return g;
}

/**
 * Zylinder oder Kegelstumpf entlang y mit harten Kanten: Boden bei y = 0, Deckel bei y = h; Zelle rundum, optional
 * eigene Zelle fuer den Deckel.
 * Cylinder or frustum along y with hard edges: base at y = 0, lid at y = h; cell around, optionally its own cell for
 * the lid.
 */
export function can(A: AtlasLayout, r0: number, r1: number, h: number, color: ColorLike, o: { seg?: number; cell?: string; top?: string; e?: number; rz?: number } = {}): THREE.BufferGeometry {
  const k = o.rz ?? 1;
  return loft([
    { y: h, rx: r1 * 0.86, rz: r1 * 0.86 * k, e: o.e, hard: true }, { y: h - Math.min(0.004, h * 0.2), rx: r1, rz: r1 * k, e: o.e, hard: true }, { y: 0, rx: r0, rz: r0 * k, e: o.e, hard: true },
  ], { seg: o.seg ?? (fine() ? 12 : 8), region: A.get(o.cell ?? 'blank'), capFirst: o.top ? A.get(o.top) : true, capLast: true, color });
}
