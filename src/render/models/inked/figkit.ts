/**
 * Gezeichnete Einheiten: kleine Hilfen der Gruppe Figuren, die der Baukasten (uvkit.ts) noch nicht hat.
 * Inked units: small helpers of group figures that the kit (uvkit.ts) does not have yet.
 *
 * - cell(): Zelle mit Ausweichzelle. Besatzungen stehen in fremden Atlanten (crewCells), dort fehlen manche Zellen
 *   der Figur; die Geometrie bleibt dann dieselbe, nur ohne Zeichnung.
 * - ringAt() / shell(): Schale um einen Loft (Brustplatte, Weste, Umhang folgen dem Rumpf).
 * - rod(), box(), bead(): Rohr, Quader und Kugel mit Texturkoordinaten statt der Bruecke legacy().
 * - cell(): cell with a fallback. Crews live in other atlases (crewCells) where some of the figure's cells are
 *   missing; the geometry then stays the same, only without drawing.
 * - ringAt() / shell(): shell around a loft (chest plate, vest, cape follow the torso).
 * - rod(), box(), bead(): tube, box and sphere with texture coordinates instead of the legacy() bridge.
 */
import * as THREE from 'three';
import { softBox, type ColorLike, type V3 } from '../kit';
import { AtlasLayout, loft, projectBox, UvBuilder, type BoxFaces, type PartOpts, type Region, type Ring } from './uvkit';

/** geschlossene Spitze eines Lofts / closed tip of a loft */
export const TIP = 1e-7;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/** Zelle name oder, wenn der Atlas sie nicht hat, die Ausweichzelle / cell name or, if the atlas lacks it, the fallback */
export function cell(A: AtlasLayout, name: string, fallback = 'blank'): Region {
  return A.regions.get(name) ?? A.regions.get(fallback) ?? A.get('blank');
}
export function hasCell(A: AtlasLayout, name: string): boolean {
  return A.regions.has(name);
}

/** Querschnitt eines Lofts bei der Hoehe y (zwischen den Ringen linear) / cross-section of a loft at height y (linear between rings) */
export function ringAt(T: Ring[], y: number): { y: number; rx: number; rz: number; rzB: number; e: number; cx: number; cz: number } {
  const up = T[0].y < T[T.length - 1].y;
  let i = 0;
  while (i < T.length - 2 && (up ? T[i + 1].y < y : T[i + 1].y > y)) i++;
  const a = T[i], b = T[i + 1];
  const f = Math.abs(b.y - a.y) < 1e-9 ? 0 : Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
  const L = (u: number, v: number) => u + (v - u) * f;
  const rzA = a.rz ?? a.rx, rzC = b.rz ?? b.rx;
  return {
    y, rx: L(a.rx, b.rx), rz: L(rzA, rzC), rzB: L(a.rzB ?? rzA, b.rzB ?? rzC), e: L(a.e ?? 2, b.e ?? 2),
    cx: L(a.cx ?? 0, b.cx ?? 0), cz: L(a.cz ?? 0, b.cz ?? 0),
  };
}

export interface ShellOpts {
  /** Abstand zur Flaeche (Zahl oder je Hoehe) / distance from the surface (number or per height) */
  grow: number | ((y: number) => number);
  /** halbe Breite begrenzen (Platte schmaler als der Rumpf) / limit the half width (plate narrower than the torso) */
  width?: number | ((y: number) => number);
  /** nur vorn: die Rueckseite bleibt im Koerper / front only: the back stays inside the body */
  front?: boolean;
  /** nur hinten / back only */
  back?: boolean;
  /** Querschnitt eckiger / boxier cross-section */
  e?: number;
}
/** Ringe einer Schale um den Loft T an den Hoehen ys / rings of a shell around the loft T at the heights ys */
export function shell(T: Ring[], ys: number[], o: ShellOpts): Ring[] {
  return ys.map((y): Ring => {
    const r = ringAt(T, y);
    const g = typeof o.grow === 'number' ? o.grow : o.grow(y);
    const w = o.width === undefined ? r.rx + g : Math.min(r.rx + g, typeof o.width === 'number' ? o.width : o.width(y));
    const inside = 0.3;
    return {
      y, rx: w, rz: o.back ? r.rz * inside : r.rz + g, rzB: o.front ? r.rzB * inside : r.rzB + g,
      e: o.e ?? r.e, cx: r.cx, cz: r.cz,
    };
  });
}

/** Kuppelringe: Mitte C, Radius R, vom Scheitel bis zum Winkel a1 (Grad) / dome rings: centre C, radius R, from the crown to the angle a1 (degrees) */
export function dome(C: number, R: number, a1: number, rows: number, c?: ColorLike): Ring[] {
  const out: Ring[] = [];
  const end = (a1 * Math.PI) / 180;
  for (let i = 0; i <= rows; i++) {
    const a = (i / rows) * end;
    out.push({ y: C + R * Math.cos(a), rx: Math.max(TIP, R * Math.sin(a)), ...(i === 0 && c !== undefined ? { c } : {}) });
  }
  return out;
}

export interface RodOpts extends PartOpts {
  cell?: string;
  /** offene Enden (kein Deckel) / open ends (no cap) */
  open?: boolean;
}
/** Rohr von a nach c mit den Radien r0 / r1; s rundum, t entlang / tube from a to c with radii r0 / r1; s around, t along */
export function rod(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, r0: number, r1: number, seg: number, color: ColorLike, o: RodOpts = {}): void {
  const va = V(a), vc = V(c);
  const dir = vc.clone().sub(va).normalize();
  const front = Math.abs(dir.z) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  b.bone(va, vc, front, (len) => {
    b.add(loft([{ y: 0, rx: r0 }, { y: len, rx: r1 }], { seg, region: cell(A, o.cell ?? 'blank'), capFirst: !o.open, capLast: !o.open, color }), null, { crease: 0, ...o });
  });
}

/** Zellnamen je Seite eines Quaders / cell names per face of a box */
export type FaceCells = Partial<Record<'all' | 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz', string>> & { mirrorNx?: boolean };
/** Seiten eines Quaders auf Zellen legen (fehlende Zellen: neutral) / map the faces of a box to cells (missing cells: neutral) */
export function faces(A: AtlasLayout, f: FaceCells): BoxFaces {
  const out: BoxFaces = { all: cell(A, f.all ?? 'blank'), mirrorNx: f.mirrorNx };
  for (const k of ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const) if (f[k]) out[k] = cell(A, f[k]!, f.all ?? 'blank');
  return out;
}
/** Weicher Quader mit Zellen je Seite / soft box with cells per face */
export function box(b: UvBuilder, A: AtlasLayout, size: V3, r: number, f: FaceCells, color: ColorLike, o: PartOpts = {}, steps = 0): void {
  b.add(projectBox(softBox(size[0], size[1], size[2], Math.min(r, Math.min(size[0], size[1], size[2]) * 0.45), steps), faces(A, f)), color, o);
}

/** Kleine Kugel (Leuchte, Knauf, Niete im Umriss) / small sphere (lamp, knob, silhouette rivet) */
export function bead(b: UvBuilder, A: AtlasLayout, p: V3, r: number, color: ColorLike, seg = 6, o: PartOpts = {}, squash: V3 = [1, 1, 1]): void {
  b.add(loft([{ y: r, rx: TIP }, { y: r * 0.6, rx: r * 0.8 }, { y: 0, rx: r }, { y: -r * 0.6, rx: r * 0.8 }, { y: -r, rx: TIP }], { seg, region: A.get('blank'), color }), null, { crease: 0, ...o, xf: { p, s: squash, ...(o.xf ?? {}) } });
}

/** Rotations-Euler, der +y auf dir dreht / Euler rotation turning +y onto dir */
export function aimY(dir: V3): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}
/** Rotations-Euler, der +z auf dir dreht / Euler rotation turning +z onto dir */
export function aimZ(dir: V3): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}
/** Punkt p + t * dir (normiert) / point p + t * dir (normalised) */
export function along(p: V3, dir: V3, t: number): V3 {
  const v = V(dir).normalize();
  return [p[0] + v.x * t, p[1] + v.y * t, p[2] + v.z * t];
}

/**
 * Halber Loft: nur die Vorderseite (+z) traegt die ganze Zelle, die Rueckseite steckt im Koerper und bekommt den Rand
 * der Zelle. Fuer Visier, Maske, Brustplatte: die Zelle wird nicht zur Haelfte an eine unsichtbare Flaeche verschenkt.
 * Half loft: only the front (+z) carries the whole cell, the back sits inside the body and gets the cell's edge. For
 * visor, mask, chest plate: no half of the cell is wasted on an invisible surface.
 */
export function frontLoft(rings: Ring[], o: Parameters<typeof loft>[1]): THREE.BufferGeometry {
  const g = loft(rings, { ...o, s0: -0.5, s1: 1.5 });
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const u0 = o.region.x / REF_SIZE, u1 = (o.region.x + o.region.w) / REF_SIZE;
  for (let i = 0; i < uv.count; i++) uv.setX(i, Math.max(u0, Math.min(u1, uv.getX(i))));
  return g;
}
const REF_SIZE = 1024;

/** Zeile einer Schale: Hoehe, Abstand, Farbe ab hier, harte Kante / row of a shell: height, distance, colour from here on, hard edge */
export interface ShellRow { y: number; g: number; c?: ColorLike; hard?: boolean }
/** Schale um den Loft T aus Zeilen (siehe shell) / shell around the loft T from rows (see shell) */
export function shellRows(T: Ring[], rows: ShellRow[], o: Omit<ShellOpts, 'grow'> = {}): Ring[] {
  return rows.map((row): Ring => ({ ...shell(T, [row.y], { ...o, grow: row.g })[0], ...(row.c !== undefined ? { c: row.c } : {}), ...(row.hard ? { hard: true } : {}) }));
}

/** Teil ohne Zeichnung: eigene Texturkoordinaten der Form verwerfen (Extrusionen bringen welche mit), es landet in der neutralen Zelle / part without drawing: drop the shape's own texture coordinates (extrusions bring some), it lands in the neutral cell */
export function plain<G extends THREE.BufferGeometry>(g: G): G {
  g.deleteAttribute('uv');
  return g;
}
