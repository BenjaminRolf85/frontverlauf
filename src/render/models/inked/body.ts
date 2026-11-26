/**
 * Gezeichnete Einheiten: Formhilfen der Fahrzeuggruppe (Koerper mit Wuerfelprojektion, kantige Koerper, Rohre, Besatzung).
 * Inked units: shape helpers of the vehicle group (bodies with box projection, faceted bodies, tubes, crew).
 *
 * - shaped(): ein Loft (weiche Form) bekommt seine Zeichnung ueber die Wuerfelprojektion: Flanken, Dach, Bug und Heck
 *   je aus einer eigenen Zelle, so wie man die Seite von aussen sieht. Damit teilen sich viele Fahrzeuge dieselben
 *   Zellen, obwohl ihre Karosserien verschieden geformt sind.
 * - facet(): kantiger Koerper aus Vielecken (harte Kanten = Tuschelinien), fuer die scharfkantigen Bauarten.
 * - crew(): Besatzung, IMMER dieselbe Figur im einen Massstab CREW (Vorgabe: "das muss einheitlich sein").
 * - shaped(): a loft (soft form) receives its drawing through the box projection: flanks, roof, bow and stern each from
 *   their own cell as seen from outside. Many vehicles thus share the same cells although their bodies differ in shape.
 * - facet(): faceted body from polygons (hard edges = ink lines), for the sharp-edged designs.
 * - crew(): crews, ALWAYS the same figure at the one scale CREW (rule: it has to be uniform).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { fine, softBox, xfMatrix, type ColorLike, type V3, type Xf } from '../kit';
import { mat } from '../look';
import { CREW, figure, type FigurePose } from './figure';
import { AtlasLayout, loft, projectBox, quad, REF, UvBuilder, type BoxFaces, type PartOpts, type Region, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;
export const TIP = 1e-7;

// ---------- weiche Koerper / soft bodies ----------

export interface ShapedOpts extends BoxFaces {
  seg: number;
  /** Lage des Lofts vor der Projektion / placement of the loft before the projection */
  xf?: Xf;
  capFirst?: boolean;
  capLast?: boolean;
  color?: ColorLike;
}

/** Loft an seinen Platz bringen und dann per Wuerfelprojektion zeichnen lassen / move a loft into place, then let the box projection draw it */
export function shaped(rings: Ring[], o: ShapedOpts): THREE.BufferGeometry {
  const blank = (o.all ?? o.px ?? o.py ?? o.pz)!;
  const g = loft(rings, { seg: o.seg, region: blank, capFirst: o.capFirst, capLast: o.capLast, color: o.color });
  if (o.xf) g.applyMatrix4(xfMatrix(o.xf));
  g.computeBoundingBox();
  const out = projectBox(g, o);
  out.userData.smooth = true;
  return out;
}

/**
 * Querschnitt eines Koerpers entlang z (Bug +z): Stelle z, halbe Breite w, Hoehe ueber (up) und unter (down) der Mitte
 * cy, Kantigkeit e (2 = rund, 6 = Kasten).
 * Cross-section of a body along z (bow +z): position z, half width w, height above (up) and below (down) the centre
 * cy, boxiness e (2 = round, 6 = box).
 */
export interface Section { z: number; w: number; up: number; down?: number; cy: number; cx?: number; e?: number; hard?: boolean; c?: ColorLike }

/** Ringe fuer shaped() aus Querschnitten; dazu gehoert die Lage ALONG_Z / rings for shaped() from cross-sections; goes with the placement ALONG_Z */
export function sections(list: Section[]): Ring[] {
  return list.map((s): Ring => ({ y: -s.z, rx: s.w, rz: s.up, rzB: s.down ?? s.up, cz: s.cy, cx: s.cx, e: s.e, hard: s.hard, c: s.c }));
}
/** Loft-Achse nach z legen (Ring.y = -z, Loft-vorn = oben) / lay the loft axis along z (ring.y = -z, loft front = up) */
export const ALONG_Z: Xf = { r: [-HALF_PI, 0, 0] };

/** Koerper entlang z aus Querschnitten, gezeichnet per Wuerfelprojektion / body along z from cross-sections, drawn by box projection */
export function hullZ(list: Section[], o: ShapedOpts): THREE.BufferGeometry {
  return shaped(sections(list), { ...o, xf: ALONG_Z });
}

// ---------- kantige Koerper / faceted bodies ----------

/** Vieleck in der Hoehe y: Ecken [x, z], von hinten links ueber vorn nach hinten rechts (von aussen gesehen nach rechts) / polygon at height y: corners [x, z] from rear left via the front to rear right (to the right as seen from outside) */
export interface Poly { y: number; pts: [number, number][]; c?: ColorLike }

export interface FacetOpts {
  region: Region;
  /** Deckel oben / unten: eben von oben projiziert (Bug oben) / cap top / bottom: planar from above (bow up) */
  top?: Region | false;
  bottom?: Region | false;
  color: ColorLike;
  /** erste Ecke liegt bei s0 der Zelle; die Seiten laufen bis s1 / the first corner sits at s0 of the cell; the sides run to s1 */
  s0?: number; s1?: number;
  /** Ausschnitt der Zelle in der Hoehe / sub-range of the cell in height */
  t0?: number; t1?: number;
  opts?: PartOpts;
}

/**
 * Kantiger Koerper zwischen Vielecken gleicher Eckenzahl (oben nach unten). Jede Seite ist eine ebene Flaeche mit
 * eigener Normale, die Kanten zeichnet die Tusche. s laeuft um den Koerper (nach Umfang), t von oben nach unten.
 * Faceted body between polygons of equal corner count (top to bottom). Every side is a flat face with its own normal,
 * the ink draws the edges. s runs around the body (by perimeter), t from top to bottom.
 */
export function facet(b: UvBuilder, polys: Poly[], o: FacetOpts): void {
  const n = polys[0].pts.length;
  const s0 = o.s0 ?? 0, s1 = o.s1 ?? 1;
  const y0 = polys[0].y, y1 = polys[polys.length - 1].y;
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? 1;
  const T = polys.map((p, i) => t0 + (t1 - t0) * (Math.abs(y1 - y0) < 1e-9 ? i / (polys.length - 1) : (p.y - y0) / (y1 - y0)));
  // Umfangsanteile aus dem groessten Vieleck / perimeter shares from the largest polygon
  const ref = polys.reduce((a, p) => (per(p.pts) > per(a.pts) ? p : a), polys[0]);
  const acc = [0];
  for (let j = 0; j < n; j++) acc.push(acc[j] + Math.hypot(ref.pts[(j + 1) % n][0] - ref.pts[j][0], ref.pts[(j + 1) % n][1] - ref.pts[j][1]));
  const S = (j: number) => s0 + (s1 - s0) * (acc[j] / acc[n]);
  let c = o.color;
  const mid: [number, number] = [ref.pts.reduce((a, q) => a + q[0], 0) / n, ref.pts.reduce((a, q) => a + q[1], 0) / n];
  for (let i = 0; i < polys.length - 1; i++) {
    const A = polys[i], B = polys[i + 1];
    if (A.c !== undefined) c = A.c;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const pa: V3 = [A.pts[j][0], A.y, A.pts[j][1]], pb: V3 = [A.pts[k][0], A.y, A.pts[k][1]];
      const pc: V3 = [B.pts[k][0], B.y, B.pts[k][1]], pd: V3 = [B.pts[j][0], B.y, B.pts[j][1]];
      // von aussen gesehen laeuft die Zelle von links nach rechts: gegen den Uhrzeigersinn von oben = nach rechts
      // seen from outside the cell runs left to right: counter-clockwise from above = to the right
      const st: [number, number][] = [[S(j), T[i]], [S(j), T[i + 1]], [S(j + 1), T[i + 1]], [S(j + 1), T[i]]];
      // Wicklung nach aussen richten (gegen die Mitte des Vielecks pruefen) / orient the winding outward (checked against the polygon centre)
      const e1 = [pd[0] - pa[0], pd[1] - pa[1], pd[2] - pa[2]], e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1], nz = e1[0] * e2[1] - e1[1] * e2[0];
      if (Math.abs(nx) + Math.abs(nz) < 1e-12) { const f1 = [pb[0] - pa[0], pb[2] - pa[2]]; nx = f1[1]; nz = -f1[0]; }
      const out = nx * ((pa[0] + pc[0]) / 2 - mid[0]) + nz * ((pa[2] + pc[2]) / 2 - mid[1]) >= 0;
      b.add(out ? quad([pa, pd, pc, pb], o.region, st) : quad([pa, pb, pc, pd], o.region, [st[0], st[3], st[2], st[1]]), c, o.opts);
    }
  }
  const cap = (P: Poly, r: Region | false | undefined, up: boolean, colour: ColorLike) => {
    if (!r) return;
    const xs = P.pts.map((q) => q[0]), zs = P.pts.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const uv = (x: number, z: number): [number, number] => [(r.x + ((x1 - x) / (x1 - x0 || 1)) * r.w) / REF, (r.y + ((z1 - z) / (z1 - z0 || 1)) * r.h) / REF];
    const pos: number[] = [], st: number[] = [];
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const a = P.pts[j], d = P.pts[k];
      // Normale des Dreiecks (Mitte, a, d): y-Anteil = (a - m) x (d - m) / normal of the triangle (centre, a, d): its y part
      const ny = (a[1] - cz) * (d[0] - cx) - (a[0] - cx) * (d[1] - cz);
      const tri: [number, number][] = (ny >= 0) === up ? [[cx, cz], a, d] : [[cx, cz], d, a];
      for (const q of tri) { pos.push(q[0], P.y, q[1]); st.push(...uv(q[0], q[1])); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(st, 2));
    b.add(g, colour, o.opts);
  };
  cap(polys[0], o.top, true, polys[0].c ?? o.color);
  cap(polys[polys.length - 1], o.bottom, false, c);
}
const per = (pts: [number, number][]) => pts.reduce((s, p, j) => s + Math.hypot(pts[(j + 1) % pts.length][0] - p[0], pts[(j + 1) % pts.length][1] - p[1]), 0);

/** Rechteck als Vieleck (Mitte cx / cz, halbe Breite w, halbe Laenge d, abgeschraegte Ecken k) / rectangle as a polygon (centre, half width, half length, chamfered corners k) */
export function rectPoly(y: number, w: number, d: number, k = 0, cz = 0, cx = 0, c?: ColorLike): Poly {
  const pts: [number, number][] = k > 0
    ? [[-w + k, -d], [-w, -d + k], [-w, d - k], [-w + k, d], [w - k, d], [w, d - k], [w, -d + k], [w - k, -d]]
    : [[-w, -d], [-w, d], [w, d], [w, -d]];
  return { y, pts: pts.map(([x, z]): [number, number] => [x + cx, z + cz]), c };
}

// ---------- Rohre und Streben / tubes and struts ----------

/** Rundstab von a nach c (Radien ra / rc), ohne Zeichnung / round bar from a to c (radii ra / rc), no drawing */
export function tube(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, ra: number, rc: number, color: ColorLike, seg = 6, o: PartOpts = {}): void {
  b.bone(new THREE.Vector3(...a), new THREE.Vector3(...c), new THREE.Vector3(0, 0, 1), (len) => {
    b.add(loft([{ y: len, rx: rc }, { y: 0, rx: ra }], { seg, region: A.get('blank'), capFirst: true, capLast: true, color }), null, { crease: 0, ...o });
  });
}
/** Stab durch mehrere Punkte / bar through several points */
export function pipe(b: UvBuilder, A: AtlasLayout, pts: V3[], r: number, color: ColorLike, seg = 6, o: PartOpts = {}): void {
  for (let i = 0; i < pts.length - 1; i++) tube(b, A, pts[i], pts[i + 1], r, r, color, seg, o);
}
/** Scheibe / Trommel entlang der Achse von a nach c mit gezeichneten Deckeln / disc or drum along the axis a -> c with drawn caps */
export function drumBetween(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, r: number, color: ColorLike, seg: number, wall: string, cap: string, o: PartOpts = {}): void {
  b.bone(new THREE.Vector3(...a), new THREE.Vector3(...c), new THREE.Vector3(0, 1, 0), (len) => {
    b.add(loft([{ y: len, rx: r, hard: true }, { y: 0, rx: r, hard: true }], { seg, region: A.get(wall), capFirst: A.get(cap), capLast: A.get(cap), color }), null, o);
  });
}

// ---------- Besatzung / crew ----------

export interface CrewOpts {
  /** Ort des Figurenursprungs (Fuesse) im Fahrzeug / place of the figure's origin (feet) in the vehicle */
  p: V3;
  /** Drehung um y (Blickrichtung) / yaw */
  yaw?: number;
  pose: FigurePose;
  /** ganze Figur mit Beinen (Geschuetzbedienung); sonst ab der Huefte / whole figure with legs (gun crews); otherwise from the hip up */
  legs?: boolean;
  seed?: number;
  /** Zubehoer in den Koordinaten der Figur (z. B. die getragene Granate) / props in the figure's coordinates (e.g. the shell being carried) */
  extra?: () => void;
}

/**
 * Besatzung: dieselbe Figur wie die Fusstruppen, im einen Massstab CREW. Nie ein eigener Kopf- oder Helmmassstab, nie
 * ein anderer Gruppenmassstab; passt eine Figur nicht in Sitz oder Luke, wird das Fahrzeug geaendert.
 * Crew: the same figure as the foot troops at the one scale CREW. Never an own head or helmet scale, never another
 * group scale; if a figure does not fit a seat or hatch, the vehicle is changed.
 */
export function crew(b: UvBuilder, A: AtlasLayout, f: FactionId, o: CrewOpts): void {
  b.group({ p: o.p, r: [0, o.yaw ?? 0, 0], s: CREW }, () => {
    figure(b, A, f, o.pose, { detail: 0, noLegs: !o.legs, pack: 'none', seed: o.seed ?? 5 });
    o.extra?.();
  });
}
/** Hoehe der Schultern, des Kinns und der Helmkuppe ueber dem Becken, schon im Massstab CREW / shoulder, chin and helmet top above the pelvis, already at the CREW scale */
export const CREW_DIM = { pelvis: 0.302 * CREW, shoulder: 0.141 * CREW, chin: 0.2 * CREW, top: 0.365 * CREW };

/** Im Luk stehend, Haende auf dem Lukenrand (Figurenkoordinaten, Becken bei 0.302) / standing in a hatch, hands on the rim (figure coordinates, pelvis at 0.302) */
export function hatchPose(turn = 0.05): FigurePose {
  return { pelvis: [0, 0.302, 0], head: [0.05, turn * 5, 0], handL: [-0.092, 0.385, 0.062], handR: [0.094, 0.385, 0.058], footL: [0, 0, 0], footR: [0, 0, 0], elbowPoleL: [-1, -0.2, -0.3], elbowPoleR: [1, -0.2, -0.3] };
}
/** Sitzend oder stehend mit den Haenden an zwei Punkten (Lenkrad, Griffe); Becken bei 0.302 / seated or standing with the hands at two points (wheel, grips); pelvis at 0.302 */
export function gripPose(handL: V3, handR: V3, head: V3 = [0.04, 0, 0], twist?: V3): FigurePose {
  return { pelvis: [0, 0.302, 0], twist, head, handL, handR, footL: [-0.04, 0.045, 0.02], footR: [0.04, 0.045, -0.02], elbowPoleL: [-1, -0.6, -0.2], elbowPoleR: [1, -0.6, -0.2] };
}

// ---------- Boegen, Innenwaende, Waffen / arches, inner walls, weapons ----------

/** Dreiecke und Normalen umdrehen: Innenseite eines Lofts (z. B. Wanne eines Schuetzenstands) / flip triangles and normals: the inside of a loft (e.g. the tub of a gunner's station) */
export function flipped(g0: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = g0.index ? g0.toNonIndexed() : g0;
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name] as THREE.BufferAttribute, k = a.itemSize, arr = a.array as Float32Array;
    for (let t = 0; t < a.count; t += 3) for (let i = 0; i < k; i++) { const i1 = (t + 1) * k + i, i2 = (t + 2) * k + i; const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
  }
  const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (nor) for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
  return g;
}

/**
 * Bogenstueck um eine Achse entlang x (Kotfluegel, Schutzbuegel): Winkel a0..a1 (0 = oben, positiv nach vorn),
 * Radien innen / aussen, Breite w, Mitte c. Glatte Normalen, keine Zeichnung.
 * Arch about an axis along x (mudguard, guard hoop): angles a0..a1 (0 = top, positive towards the bow), inner / outer
 * radius, width w, centre c. Smooth normals, no drawing.
 */
export function arch(c: V3, rIn: number, rOut: number, w: number, a0: number, a1: number, n: number): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [];
  const P = (r: number, a: number, x: number): V3 => [c[0] + x, c[1] + Math.cos(a) * r, c[2] + Math.sin(a) * r];
  const tri = (pts: V3[], ns: V3[]) => { for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...pts[i]); nor.push(...ns[i]); } };
  const h = w / 2;
  const neg = (q: V3): V3 => [-q[0], -q[1], -q[2]];
  for (let i = 0; i < n; i++) {
    const u = a0 + ((a1 - a0) * i) / n, v = a0 + ((a1 - a0) * (i + 1)) / n;
    const nu: V3 = [0, Math.cos(u), Math.sin(u)], nv: V3 = [0, Math.cos(v), Math.sin(v)];
    tri([P(rOut, u, -h), P(rOut, v, -h), P(rOut, v, h), P(rOut, u, h)], [nu, nv, nv, nu]);
    tri([P(rIn, u, h), P(rIn, v, h), P(rIn, v, -h), P(rIn, u, -h)], [neg(nu), neg(nv), neg(nv), neg(nu)]);
    tri([P(rIn, u, h), P(rOut, u, h), P(rOut, v, h), P(rIn, v, h)], [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]);
    tri([P(rIn, v, -h), P(rOut, v, -h), P(rOut, u, -h), P(rIn, u, -h)], [[-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0]]);
  }
  for (const [a, s] of [[a0, -1], [a1, 1]] as const) {
    const t: V3 = [0, -Math.sin(a) * s, Math.cos(a) * s];
    tri([P(rIn, a, -h), P(rOut, a, -h), P(rOut, a, h), P(rIn, a, h)], [t, t, t, t]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.userData.smooth = true;
  // Wicklung an den Normalen ausrichten / align the winding with the normals
  const pa = g.getAttribute('position') as THREE.BufferAttribute, na = g.getAttribute('normal') as THREE.BufferAttribute;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  for (let t = 0; t < pa.count; t += 3) {
    A.fromBufferAttribute(pa, t); B.fromBufferAttribute(pa, t + 1); C.fromBufferAttribute(pa, t + 2);
    N.crossVectors(B.sub(A), C.sub(A));
    if (N.x * na.getX(t) + N.y * na.getY(t) + N.z * na.getZ(t) < 0) {
      for (const at of [pa, na]) { const x = at.getX(t + 1), y = at.getY(t + 1), z = at.getZ(t + 1); at.setXYZ(t + 1, at.getX(t + 2), at.getY(t + 2), at.getZ(t + 2)); at.setXYZ(t + 2, x, y, z); }
    }
  }
  return g;
}

/** Offene Wanne (Schuetzenstand, Korb): Aussenwand mit Zelle, Rand, Innenwand / open tub (gunner's station, basket): outer wall with a cell, rim, inner wall */
export function tub(b: UvBuilder, A: AtlasLayout, p: V3, r: number, h: number, wall: number, seg: number, color: ColorLike, cell = 'blank', inner?: ColorLike): void {
  b.add(loft([{ y: h, rx: r - wall, hard: true }, { y: h, rx: r, hard: true }, { y: 0, rx: r * 0.96 }], { seg, region: A.get(cell), color }), null, { xf: { p } });
  b.add(flipped(loft([{ y: h, rx: r - wall }, { y: 0.004, rx: r * 0.96 - wall }], { seg, region: A.get('blank'), color: inner ?? color })), null, { xf: { p }, crease: 0 });
}

/**
 * Maschinengewehr: Gehaeuse, Lauf mit Mantel, Gurtkasten, Griffe; Ursprung am Drehzapfen, Lauf nach +z. k macht die
 * Waffe groesser (uebergrosse Waffen der Dravon).
 * Machine gun: receiver, barrel with jacket, ammo box, grips; origin at the pintle, barrel towards +z. k enlarges the
 * weapon (Dravon's oversized weapons).
 */
export function machineGun(b: UvBuilder, A: AtlasLayout, p: V3, o: { k?: number; pitch?: number; yaw?: number; shield?: ColorLike; box?: ColorLike; len?: number } = {}): void {
  const k = o.k ?? 1, hi = fine(), len = (o.len ?? 0.12) * k;
  b.group({ p, r: [o.pitch ?? 0, o.yaw ?? 0, 0] }, () => {
    b.add(softBox(0.024 * k, 0.03 * k, 0.085, 0.005), mat.dark, { xf: { p: [0, 0, -0.005] }, gloss: 0.4 });
    b.add(loft([{ y: len * 0.5, rx: 0.0095 * k, hard: true }, { y: 0, rx: 0.0105 * k, hard: true }], { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true, color: mat.darkMid }), null, { xf: { p: [0, 0.003, 0.035], r: [HALF_PI, 0, 0] }, gloss: 0.5 });
    b.add(loft([{ y: len, rx: 0.0052 * k }, { y: 0, rx: 0.006 * k }], { seg: hi ? 8 : 5, region: A.get('blank'), capFirst: true, color: mat.metal }), null, { xf: { p: [0, 0.003, 0.035], r: [HALF_PI, 0, 0] }, gloss: 0.7, crease: 0 });
    b.add(loft([{ y: 0.02, rx: 0.0085 * k, hard: true }, { y: 0, rx: 0.0075 * k, hard: true }], { seg: hi ? 8 : 5, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [0, 0.003, 0.035 + len - 0.012], r: [HALF_PI, 0, 0] }, gloss: 0.4 });
    if (o.box) b.add(softBox(0.026, 0.03, 0.036, 0.004), o.box, { xf: { p: [-0.026 * k, -0.012, 0.0] } });
    if (o.shield) b.add(softBox(0.086, 0.058, 0.005, 0.002), o.shield, { xf: { p: [0, 0.01, 0.045], r: [-0.12, 0, 0] } });
    if (hi) for (const s of [-1, 1]) b.add(loft([{ y: 0.03, rx: 0.0034 }, { y: 0, rx: 0.0034 }], { seg: 5, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [s * 0.011, -0.004, -0.045], r: [-HALF_PI, 0, 0] }, crease: 0 });
  });
}

/** Teil an seinen Platz bringen und per Wuerfelprojektion zeichnen (gemeinsame Grenzen in faces.bounds) / move a part into place and draw it by box projection (shared bounds in faces.bounds) */
export function boxed(g0: THREE.BufferGeometry, xf: Xf, faces: BoxFaces): THREE.BufferGeometry {
  const g = g0.index ? g0.toNonIndexed() : g0;
  if (g0.userData.smooth) g.userData.smooth = true;
  g.applyMatrix4(xfMatrix(xf));
  g.computeBoundingBox();
  return projectBox(g, faces);
}

/**
 * Kommandantenkuppel mit offenem Deckel und Kommandant: Ring auf dem Dach (Oberkante des Dachs bei p), Deckel nach
 * hinten aufgeklappt, Figur ab der Brust sichtbar. Dieselben Masse fuer jedes Fahrzeug.
 * Commander's cupola with open lid and commander: ring on the roof (roof surface at p), lid folded back, figure visible
 * from the chest up. The same dimensions for every vehicle.
 */
export function cupola(b: UvBuilder, A: AtlasLayout, f: FactionId | null, p: V3, ring: ColorLike, lid: ColorLike, o: { seed?: number; yaw?: number; lidYaw?: number } = {}): void {
  const hi = fine(), seg = hi ? 18 : 10;
  b.add(loft([{ y: 0.026, rx: 0.031, hard: true }, { y: 0.026, rx: 0.039, hard: true }, { y: 0.004, rx: 0.042, hard: true }, { y: 0, rx: 0.045 }], { seg, region: A.get('blank'), color: ring }), null, { xf: { p: [p[0], p[1] - 0.002, p[2]] } });
  b.group({ p, r: [0, o.lidYaw ?? 0, 0] }, () => {
    b.add(loft([{ y: 0.007, rx: 0.036, hard: true }, { y: 0, rx: 0.038, hard: true }], { seg, region: A.get('blank'), capFirst: A.get('hatch'), capLast: A.get('hatch'), color: lid }), null, { xf: { p: [0, 0.058, -0.05], r: [-1.2, 0, 0] } });
  });
  if (f) crew(b, A, f, { p: [p[0], p[1] + 0.045 - 0.443 * CREW, p[2]], yaw: o.yaw, pose: hatchPose(), seed: o.seed ?? 7 });
}

/** Quader: hohe Qualitaet mit weichen Kanten, niedrige als schlichter Kasten (12 statt 44 Dreiecke) / box: soft edges on high quality, a plain box on low (12 instead of 44 triangles) */
export function block(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  if (fine()) return softBox(w, h, d, r);
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return g;
}
