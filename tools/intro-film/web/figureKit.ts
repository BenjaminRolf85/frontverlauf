/**
 * Nur Filmexport (Anime-Schnitt): Figurenbaukasten. Ganze Figuren (Anfuehrer, Soldaten, Pferde) als gezeichnete
 * Modelle mit einem einfachen Skelett. Das Spiel ruft nichts davon auf: seine Modelle, Budgets und Tests bleiben
 * unveraendert.
 * Film export only (anime cut): figure kit. Full figures (leaders, soldiers, horses) as inked models with a simple
 * skeleton. The game calls none of this: its models, budgets and tests stay unchanged.
 *
 * Idee / idea:
 * - Ein Skelett (Rig) aus Knochen: Elternknochen, Versatz im Rahmen des Elternknochens, Gelenkart, Bindewinkel. Die
 *   Figur wird EINMAL in der Bindehaltung gebaut (A-Haltung: Arme und Beine leicht abgespreizt, damit die Verdeckung
 *   sauber gebacken wird). Posen sind Tabellen von Gelenkwinkeln und leben in Blender (fv/poses.py); dort bewegt
 *   fv/figure.py die Ecken je Bild.
 * - Jede Ecke haengt an EINEM Knochen mit einem Gewicht w gegen dessen Elternknochen (w = 1: starr am Knochen, w = 0:
 *   starr am Elternknochen, dazwischen eine weiche Beuge um das Gelenk). Dazu ein Tuchwert (0 = fest, 1 = frei im
 *   Wind). So bleiben Aermel, Hosenbeine und Hals ueber dem Gelenk ein durchgehendes Stueck Stoff ohne Naht; starre
 *   Teile (Hand im Aufschlag, Arm unter dem Schulterstueck, Schenkel unter dem Rockschoss) ueberlappen.
 * - Der Export (figureExtras) haengt Skelett und Gewichte an die normale Ausgabe der gezeichneten Modelle an: je Ecke
 *   der Flaeche, je Ecke der Tuschehuelle und je Ende einer Knicklinie.
 * - A skeleton (rig) of bones: parent, offset in the parent's frame, joint kind, bind angles. The figure is built ONCE
 *   in the bind pose (an A pose: arms and legs slightly spread so the occlusion bakes cleanly). Poses are tables of
 *   joint angles and live in Blender (fv/poses.py); fv/figure.py moves the vertices per frame there.
 * - Every vertex hangs on ONE bone with a weight w against that bone's parent (w = 1: rigid on the bone, w = 0: rigid
 *   on the parent, in between a soft bend around the joint). Plus a cloth value (0 = fixed, 1 = free in the wind).
 *   Sleeves, trouser legs and the neck thus stay one continuous piece of cloth across the joint, without a seam;
 *   rigid parts (hand in the cuff, arm below the epaulette, thigh below the skirt) overlap.
 * - The export (figureExtras) appends skeleton and weights to the normal output of the inked models: per fill vertex,
 *   per vertex of the ink hull and per end of a crease line.
 *
 * Koordinaten wie die Heldenbuesten: y oben, Blick +z, +x ist die linke Seite der Figur. Masse in Einheiten der
 * Bueste (Kopfhoehe 0.38); in Blender wird die Figur auf ihre wahre Groesse skaliert.
 * Coordinates as the hero busts: y up, facing +z, +x is the figure's left side. Sizes in units of the bust (head
 * height 0.38); Blender scales the figure to its true size.
 */
import * as THREE from 'three';
import { col, type ColorLike, type V3 } from '../../../src/render/models/kit';
import { inkFor } from '../../../src/render/models/inked/ink';
import { sheet } from '../../../src/render/models/inked/leaderKit';
import type { Region, UvBuilder } from '../../../src/render/models/inked/uvkit';

// ---------- Gelenke / joints ----------

/**
 * Gelenkarten mit sprechenden Winkeln in Grad (dieselben Formeln stehen in fv/figure.py, joint_rot):
 * Joint kinds with speaking angles in degrees (the same formulas are in fv/figure.py, joint_rot):
 * - root / free: [Nicken, Drehen, Rollen] / [pitch, yaw, roll]
 * - spine: [vorbeugen, zur linken Seite neigen, nach links drehen] / [bend forward, lean left, turn left]
 * - clav: [heben, vorziehen] / [raise, pull forward]
 * - ball (Schulter, Huefte): [nach vorn, abspreizen, Aussendrehung] / (shoulder, hip): [forward, out, outward twist]
 * - elbow: [beugen] / [bend];  knee: [beugen] / [bend]
 * - wrist: [beugen zur Handflaeche, zur Daumenseite, Aussendrehung] / [flex to the palm, to the thumb side, supination]
 * - foot: [Spitze heben, Spitze nach aussen, kippen] / [toes up, toes out, roll]
 * - curl (Fingerglied): [beugen, spreizen zur Daumenseite] / (finger bone): [curl, spread to the thumb side]
 * - thumb (Daumenwurzel): [Nicken, Drehen, Rollen], gespiegelt je Seite / (thumb root): [pitch, yaw, roll], mirrored per side
 * - tcurl (Daumenglied): [beugen] / (thumb bone): [curl]
 * In Ruhe (alle Winkel 0) haengen Arme und Beine gerade nach unten (-y), Handflaechen zum Koerper, Fuesse nach +z.
 * At rest (all angles 0) arms and legs hang straight down (-y), palms towards the body, feet towards +z.
 */
export type JointKind = 'root' | 'free' | 'spine' | 'clav' | 'ball' | 'elbow' | 'knee' | 'wrist' | 'foot' | 'curl' | 'thumb' | 'tcurl';

const D = Math.PI / 180;
const rx = (a: number) => new THREE.Matrix4().makeRotationX(a * D);
const ry = (a: number) => new THREE.Matrix4().makeRotationY(a * D);
const rz = (a: number) => new THREE.Matrix4().makeRotationZ(a * D);
const mul = (...m: THREE.Matrix4[]) => m.reduce((a, b) => a.clone().multiply(b));

/** Drehung eines Gelenks aus seinen Winkeln; s = Seite (+1 links, -1 rechts) / rotation of a joint from its angles; s = side (+1 left, -1 right) */
export function jointRot(kind: JointKind, side: number, a: readonly number[]): THREE.Matrix4 {
  const s = side < 0 ? -1 : 1, v = (i: number) => a[i] ?? 0;
  switch (kind) {
    case 'spine': return mul(ry(v(2)), rx(v(0)), rz(-v(1)));
    case 'clav': return mul(rz(s * v(0)), ry(-s * v(1)));
    case 'ball': return mul(rx(-v(0)), rz(s * v(1)), ry(s * v(2)));
    case 'elbow': return rx(-v(0));
    case 'knee': return rx(v(0));
    case 'wrist': return mul(ry(s * v(2)), rz(-s * v(0)), rx(-v(1)));
    case 'foot': return mul(ry(s * v(1)), rx(-v(0)), rz(v(2)));
    case 'curl': return mul(rx(-v(1)), rz(-s * v(0)));
    case 'thumb': return mul(ry(s * v(1)), rx(v(0)), rz(s * v(2)));
    case 'tcurl': return rx(v(0));
    default: return mul(ry(v(1)), rx(v(0)), rz(v(2)));
  }
}

export interface BoneDef {
  name: string;
  parent: string | null;
  /** Versatz des Gelenks im Rahmen des Elternknochens (Wurzel: Ort im Modell) / the joint's offset in the parent's frame (root: place in the model) */
  offset: V3;
  kind: JointKind;
  side?: number;
  /** Winkel der Bindehaltung / angles of the bind pose */
  bind?: number[];
}

/** Skelett in der Bindehaltung: Gelenkorte und Achsen im Modell / skeleton in the bind pose: joint places and axes in the model */
export class Rig {
  readonly bones: BoneDef[] = [];
  private idx = new Map<string, number>();
  private mats: THREE.Matrix4[] = [];
  /** benannte Punkte (Sohle, Fingerspitze, Sattel) im Rahmen eines Knochens / named points (sole, fingertip, saddle) in a bone's frame */
  readonly marks: Record<string, { bone: number; p: V3 }> = {};

  add(b: BoneDef): this {
    if (this.idx.has(b.name)) throw new Error(`bone ${b.name} twice`);
    const parent = b.parent === null ? null : this.mats[this.id(b.parent)];
    const local = jointRot(b.kind, b.side ?? 1, b.bind ?? []).setPosition(b.offset[0], b.offset[1], b.offset[2]);
    this.idx.set(b.name, this.bones.length);
    this.bones.push(b);
    this.mats.push(parent ? parent.clone().multiply(local) : local);
    return this;
  }
  id(name: string): number {
    const i = this.idx.get(name);
    if (i === undefined) throw new Error(`no bone ${name}`);
    return i;
  }
  has(name: string): boolean { return this.idx.has(name); }
  parentOf(i: number): number { const p = this.bones[i].parent; return p === null ? i : this.id(p); }
  /** Weltmatrix des Knochens in der Bindehaltung / world matrix of the bone in the bind pose */
  matrix(name: string): THREE.Matrix4 { return this.mats[this.id(name)]; }
  /** Gelenkort / joint place */
  head(name: string): THREE.Vector3 { return new THREE.Vector3().setFromMatrixPosition(this.matrix(name)); }
  /** Punkt aus dem Rahmen des Knochens ins Modell / point from the bone's frame into the model */
  point(name: string, p: V3): THREE.Vector3 { return new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(this.matrix(name)); }
  /** Richtung aus dem Rahmen des Knochens ins Modell / direction from the bone's frame into the model */
  dir(name: string, d: V3): THREE.Vector3 { return new THREE.Vector3(d[0], d[1], d[2]).transformDirection(this.matrix(name)); }
  mark(name: string, bone: string, p: V3): this { this.marks[name] = { bone: this.id(bone), p }; return this; }
  /** Ausgabe fuer den Export / output for the export */
  dump() {
    return {
      bones: this.bones.map((b, i) => {
        const e = this.mats[i].elements;
        return {
          name: b.name, parent: b.parent === null ? -1 : this.id(b.parent), kind: b.kind, side: b.side ?? 1, offset: [...b.offset], bind: b.bind ?? [],
          head: [e[12], e[13], e[14]],
          // Achsen als Zeilen x, y, z (Spalten der Drehmatrix) / axes as rows x, y, z (columns of the rotation matrix)
          rot: [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]],
        };
      }),
      marks: this.marks,
    };
  }
}

// ---------- Gewichte / weights ----------

/** [Knochen, Gewicht gegen den Elternknochen, Tuch] / [bone, weight against the parent, cloth] */
export type Skin = [number, number, number];
export type SkinFn = (p: THREE.Vector3) => Skin;

export const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Sammelt die Gewichte zu den Teilen eines UvBuilder: alles, was innerhalb von part() gebaut wird, bekommt die
 * Gewichtsfunktion (nach dem Ort der Ecke in der Bindehaltung).
 * Collects the weights for the parts of a UvBuilder: everything built inside part() gets the weight function (by the
 * vertex's place in the bind pose).
 */
export class Skinner {
  private ranges: { v0: number; v1: number; fn: SkinFn }[] = [];
  private open = false;
  constructor(readonly b: UvBuilder, readonly rig: Rig) {}

  part(skin: SkinFn | string, fn: () => void): this {
    if (this.open) throw new Error('Skinner.part: nested');
    this.open = true;
    const v0 = this.b.triangles() * 3;
    try { fn(); } finally { this.open = false; }
    this.ranges.push({ v0, v1: this.b.triangles() * 3, fn: typeof skin === 'string' ? this.rigid(skin) : skin });
    return this;
  }
  /** starr an einem Knochen / rigid on one bone */
  rigid(bone: string, cloth = 0): SkinFn { const i = this.rig.id(bone); return () => [i, 1, cloth]; }
  /**
   * Kette von Knochen (Arm, Bein, Finger, Rumpf): jedes Gelenk der Kette (ab dem zweiten Knochen) beugt weich ueber
   * +-blend entlang der Gliedrichtung. first = true: auch das erste Gelenk beugt weich gegen seinen Elternknochen.
   * Chain of bones (arm, leg, finger, trunk): every joint of the chain (from the second bone on) bends softly across
   * +-blend along the limb's direction. first = true: the first joint bends softly against its parent as well.
   */
  chain(bones: string[], blend: number | number[], first = false): SkinFn {
    const rig = this.rig;
    const ids = bones.map((n) => rig.id(n)), heads = bones.map((n) => rig.head(n));
    const dirs = heads.map((h, k) => {
      const prev = k > 0 ? h.clone().sub(heads[k - 1]).normalize() : null;
      const next = k < heads.length - 1 ? heads[k + 1].clone().sub(h).normalize() : null;
      return (prev && next ? prev.add(next) : (prev ?? next ?? new THREE.Vector3(0, -1, 0))).normalize();
    });
    const bl = (k: number) => (typeof blend === 'number' ? blend : blend[Math.min(k, blend.length - 1)]);
    return (p) => {
      for (let k = ids.length - 1; k >= (first ? 0 : 1); k--) {
        const d = p.clone().sub(heads[k]).dot(dirs[k]);
        if (d > -bl(k)) return [ids[k], smooth(-bl(k), bl(k), d), 0];
      }
      return first ? [ids[0], 0, 0] : [ids[0], 1, 0];
    };
  }
  /** Gewichte je Ecke der fertigen Geometrie (Reihenfolge wie UvBuilder.build) / weights per vertex of the built geometry (order as UvBuilder.build) */
  attribute(g: THREE.BufferGeometry, fallback: string): Float32Array {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const out = new Float32Array(pos.count * 3), p = new THREE.Vector3(), fb = this.rig.id(fallback);
    for (let i = 0; i < pos.count; i++) { out[i * 3] = fb; out[i * 3 + 1] = 1; }
    for (const r of this.ranges) {
      for (let i = r.v0; i < r.v1; i++) {
        const [bone, w, cloth] = r.fn(p.fromBufferAttribute(pos, i));
        out[i * 3] = bone; out[i * 3 + 1] = w; out[i * 3 + 2] = cloth;
      }
    }
    return out;
  }
}

// ---------- Formen / shapes ----------

/** Stueckweise glatte Kurve durch Stuetzstellen [u, Wert...] (monoton in u) / piecewise smooth curve through knots [u, value...] (monotone in u) */
export function curve(knots: number[][]): (u: number) => number[] {
  return (u) => {
    if (u <= knots[0][0]) return knots[0].slice(1);
    for (let i = 1; i < knots.length; i++) {
      if (u <= knots[i][0]) {
        const a = knots[i - 1], b = knots[i], t = smooth(a[0], b[0], u);
        return a.slice(1).map((v, k) => v + (b[k + 1] - v) * t);
      }
    }
    return knots[knots.length - 1].slice(1);
  };
}

/**
 * Feinheit der Netze: 1 = Heldenfigur; kleiner fuer Figuren in der Menge (weniger Segmente und Ringe).
 * Mesh fineness: 1 = hero figure; smaller for figures in a crowd (fewer segments and rings).
 */
let LOD = 1;
export function withLod<T>(k: number, fn: () => T): T {
  const prev = LOD;
  LOD = k;
  try { return fn(); } finally { LOD = prev; }
}
export const lod = (): number => LOD;

export interface LimbOpts {
  /** Segmente rundum, Abstand der Ringe entlang / segments around, ring spacing along */
  seg: number; step?: number;
  region: Region;
  /** Richtung der Aussenseite: dorthin zeigt die Mitte der Zelle (t = 0.5), die Naht liegt gegenueber / direction of the outer side: the cell's middle (t = 0.5) faces there, the seam lies opposite */
  out: THREE.Vector3;
  /** Abwicklung spiegeln (rechte Seite der Figur: dieselbe Zelle, vorn bleibt vorn) / mirror the unwrap (the figure's right side: same cell, front stays front) */
  mirror?: boolean;
  color?: ColorLike | ((d: number) => ColorLike);
  /** Zellausschnitt entlang / cell range along */
  s0?: number; s1?: number;
  /** Enden rund schliessen (Halbkugel ueber diese Laenge) / close the ends round (hemisphere across this length) */
  cap0?: number; cap1?: number;
}

/**
 * Glied entlang eines Linienzugs (Gelenkorte der Bindehaltung): radius(d, a) liefert den Radius beim Weg d (Modell-
 * einheiten ab dem Anfang) und Winkel a rundum (0 = Aussenseite, +PI/2 = Querseite: bei out = seitlich ist das vorn,
 * mit mirror ebenfalls). UV: s entlang, t rundum.
 * Limb along a polyline (joint places of the bind pose): radius(d, a) returns the radius at distance d (model units
 * from the start) and angle a around (0 = outer side, +PI/2 = cross side: with out = lateral that is the front, with
 * mirror as well). uv: s along, t around.
 */
export function limb(path: THREE.Vector3[], radius: (d: number, a: number) => number, o: LimbOpts): THREE.BufferGeometry {
  const acc = [0];
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + path[i].distanceTo(path[i - 1]));
  const total = acc[acc.length - 1];
  const nv = Math.max(4, Math.round((total / (o.step ?? 0.02)) * LOD));
  const at = (d: number): { c: THREE.Vector3; t: THREE.Vector3 } => {
    let i = 1;
    while (i < path.length - 1 && acc[i] < d) i++;
    const k = (d - acc[i - 1]) / Math.max(1e-9, acc[i] - acc[i - 1]);
    // Richtung an den Gelenken weich wechseln / change the direction softly at the joints
    const t0 = path[i].clone().sub(path[i - 1]).normalize();
    const tp = i > 1 ? path[i - 1].clone().sub(path[i - 2]).normalize() : t0, tn = i < path.length - 1 ? path[i + 1].clone().sub(path[i]).normalize() : t0;
    const t = t0.clone().multiplyScalar(1).addScaledVector(tp, 0.5 * (1 - smooth(0, 0.35, k))).addScaledVector(tn, 0.5 * smooth(0.65, 1, k)).normalize();
    return { c: path[i - 1].clone().lerp(path[i], k), t };
  };
  const capR = (d: number): number => {
    let k = 1;
    if (o.cap0 && d < o.cap0) k = Math.sqrt(Math.max(0, 1 - (1 - d / o.cap0) ** 2));
    if (o.cap1 && d > total - o.cap1) k = Math.min(k, Math.sqrt(Math.max(0, 1 - (1 - (total - d) / o.cap1) ** 2)));
    return Math.max(k, 0.02);
  };
  const s0 = o.s0 ?? 0, s1 = o.s1 ?? 1, sign = o.mirror ? -1 : 1;
  const g = sheet((u, v) => {
    const d = v * total, { c, t } = at(d);
    const n = o.out.clone().addScaledVector(t, -o.out.dot(t)).normalize();
    const b = new THREE.Vector3().crossVectors(t, n).multiplyScalar(sign);
    // u = 0.5 ist die Aussenseite; b zeigt bei out = +x und Glied nach -y nach +z (vorn)
    // u = 0.5 is the outer side; with out = +x and the limb along -y, b points to +z (front)
    const a = (u - 0.5) * Math.PI * 2;
    const r = radius(d, a) * capR(d);
    return c.addScaledVector(n, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r);
  }, { nu: Math.max(6, Math.round(o.seg * LOD)), nv, region: o.region, closedU: true, flip: !!o.mirror, st: (u, v) => [s0 + (s1 - s0) * v, u], color: typeof o.color === 'function' ? undefined : o.color, colorAt: typeof o.color === 'function' ? (_u, v) => (o.color as (d: number) => ColorLike)(v * total) : undefined });
  return outward(g);
}

/**
 * Normalen nach aussen richten (weg vom Schwerpunkt): fuer geschlossene Schlaeuche und Ringe, deren Umlaufsinn von der
 * Bauweise abhaengt. Dreht bei Bedarf Normalen und Wicklung.
 * Point the normals outward (away from the centroid): for closed tubes and rings whose sense of rotation depends on
 * how they are built. Flips normals and winding where needed.
 */
export function outward<G extends THREE.BufferGeometry>(g: G, toward?: THREE.Vector3): G {
  const pos = g.getAttribute('position') as THREE.BufferAttribute, nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const c = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) c.add(p.fromBufferAttribute(pos, i));
  c.multiplyScalar(1 / Math.max(1, pos.count));
  let sum = 0;
  // toward: stattdessen in diese feste Richtung (Unterseiten) / toward: this fixed direction instead (undersides)
  for (let i = 0; i < pos.count; i++) sum += n.fromBufferAttribute(nor, i).dot(toward ?? p.fromBufferAttribute(pos, i).sub(c));
  if (sum >= 0) return g;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute, k = a.itemSize;
    for (let t = 0; t < a.count; t += 3) for (let j = 0; j < k; j++) { const v = a.getComponent(t + 1, j); a.setComponent(t + 1, j, a.getComponent(t + 2, j)); a.setComponent(t + 2, j, v); }
  }
  return g;
}

/** Radius als Ellipse: [zur Aussenseite, quer] / radius as an ellipse: [towards the outer side, across] */
export function ell(rn: number, rb: number, a: number): number {
  const c = Math.cos(a), s = Math.sin(a);
  return (rn * rb) / Math.sqrt((rb * c) ** 2 + (rn * s) ** 2);
}
/** Beule um die Richtung a0 (Winkel rundum) / bump around the direction a0 (angle around) */
export function bump(a: number, a0: number, width = 1.1): number {
  let d = Math.abs(a - a0) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d > width ? 0 : 0.5 + 0.5 * Math.cos((d / width) * Math.PI);
}

/** Ring mit freiem Querschnitt um die y-Achse: at(a, k) liefert den Punkt bei Winkel a (0 = +x, PI/2 = vorn) und Reihe k / ring surface around the y axis */
export function shell(rows: number, cols: number, at: (a: number, k: number) => THREE.Vector3, region: Region, st: (u: number, k: number) => [number, number], color: ColorLike): THREE.BufferGeometry {
  return outward(sheet((u, v) => at(u * Math.PI * 2, v * rows), { nu: cols, nv: rows, region, closedU: true, st: (u, v) => st(u, v * rows), color }));
}

/** Vertexfarbe eines Teils / vertex colour of a part */
export function paintAll<G extends THREE.BufferGeometry>(g: G, c: ColorLike): G {
  const cc = col(c), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/**
 * Dreiecke einer fertigen Geometrie auswaehlen (z. B. Kopf oder Koerper aus der Heldenbueste): keep(t) bekommt
 * Schwerpunkt und Texturkoordinate des Dreiecks.
 * Pick triangles of a built geometry (e.g. head or body out of the hero bust): keep(t) gets the triangle's centroid
 * and texture coordinate.
 */
export function pickTriangles(g: THREE.BufferGeometry, keep: (c: THREE.Vector3, u: number, v: number) => boolean): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const idx: number[] = [], c = new THREE.Vector3(), p = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(p.fromBufferAttribute(pos, t + k));
    c.multiplyScalar(1 / 3);
    if (keep(c, (uv.getX(t) + uv.getX(t + 1) + uv.getX(t + 2)) / 3, (uv.getY(t) + uv.getY(t + 1) + uv.getY(t + 2)) / 3)) idx.push(t, t + 1, t + 2);
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute, n = a.itemSize, arr = new Float32Array(idx.length * n);
    idx.forEach((v, i) => { for (let k = 0; k < n; k++) arr[i * n + k] = a.getComponent(v, k); });
    out.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  out.userData.smooth = true;
  return out;
}

// ---------- Export ----------

interface Packer { put(a: Float32Array | Uint32Array): { off: number; n: number; type: 'f32' | 'u32' } }

/**
 * Skelett und Gewichte fuer den Export: g ist die fertige Flaeche (userData.figure = { rig, skin }), deren Tusche
 * aus userData.inkSrc entsteht (dieselbe Eckenfolge wie die Flaeche). Huellenecken und Knickenden uebernehmen die
 * Gewichte der Rohecke am selben Ort.
 * Skeleton and weights for the export: g is the finished fill (userData.figure = { rig, skin }) whose ink is made from
 * userData.inkSrc (same vertex order as the fill). Hull vertices and crease ends take the weights of the raw vertex
 * at the same place.
 */
export function figureExtras(g: THREE.BufferGeometry, pack: Packer) {
  const f = g.userData.figure as { rig: Rig; skin: Float32Array; meta?: Record<string, unknown> };
  const src = (g.userData.inkSrc as THREE.BufferGeometry | undefined) ?? g;
  const pos = src.getAttribute('position') as THREE.BufferAttribute;
  const key = (x: number, y: number, z: number) => `${Math.round(x * 20000)},${Math.round(y * 20000)},${Math.round(z * 20000)}`;
  const first = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) { const k = key(pos.getX(i), pos.getY(i), pos.getZ(i)); if (!first.has(k)) first.set(k, i); }
  const ig = inkFor(g);
  const ip = ig.getAttribute('position') as THREE.BufferAttribute;
  const creases = (ig.userData.creases as number) ?? 0, nv = ip.count - creases * 4;
  const at = (i: number): number => {
    const r = first.get(key(ip.getX(i), ip.getY(i), ip.getZ(i)));
    if (r === undefined) throw new Error('figureExtras: ink vertex without a raw vertex');
    return r;
  };
  const hull = new Float32Array(nv * 3), hullRaw = new Uint32Array(nv);
  for (let i = 0; i < nv; i++) { const r = at(i); hullRaw[i] = r; hull.set(f.skin.subarray(r * 3, r * 3 + 3), i * 3); }
  const cr = new Float32Array(creases * 6);
  for (let c = 0; c < creases; c++) {
    const a = at(nv + c * 4), b = at(nv + c * 4 + 2);
    cr.set(f.skin.subarray(a * 3, a * 3 + 3), c * 6);
    cr.set(f.skin.subarray(b * 3, b * 3 + 3), c * 6 + 3);
  }
  return { ...f.rig.dump(), meta: f.meta ?? {}, skin: pack.put(f.skin), inkSkin: pack.put(hull), inkRaw: pack.put(hullRaw), creaseSkin: pack.put(cr) };
}
