/**
 * Vorschlag A: geformte Figur. Ein Koerper aus zusammenhaengenden Flaechen statt aus Quader, Roehren und Kugel:
 * Rumpf (Feldbluse) als ein Schlauch mit Brust, Taille, Schoss und Schultern; Aermel und Hosenbeine als verjuengte
 * Schlaeuche mit Ellbogen, Knie, Buendchen und Falten; Stiefel mit Schaft, Fuss und Sohle; Haende mit einzelnen
 * Fingern; modellierter Kopf (Werkzeuge aus sculpt.ts) mit Kiefer, Nase, Ohren, Hals; Helm als Schale mit Krempe,
 * Innenseite, Futter und Kinnriemen. Die Haltung kommt aus einer Koerperkurve (Standbein, Spielbein, gedrehte
 * Schultern) und Zwei-Knochen-IK. Proportionen: rund 4,5 Helmhoehen statt bisher rund 3 (weniger Chibi).
 * Proposal A: sculpted figure. One body of continuous surfaces instead of box, tubes and ball: torso (field tunic) as
 * one tube with chest, waist, skirt and shoulders; sleeves and trouser legs as tapered tubes with elbows, knees, cuffs
 * and folds; boots with shaft, foot and sole; hands with separate fingers; sculpted head (tools from sculpt.ts) with
 * jaw, nose, ears, neck; helmet as a shell with brim, inside, liner and chin strap. The stance comes from a body curve
 * (weight leg, free leg, turned shoulders) and two-bone IK. Proportions: about 4.5 helmet heights instead of about 3
 * so far (less chibi).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../../data/balance';
import { addEmblem } from '../../emblems';
import { col, mix, shade, type V3 } from '../../kit';
import { mat, type Look } from '../../look';
import { faceInk, ink as faceStroke, Sculpt } from '../../sculpt';
import type { Assembly } from './assemble';
import { A3, TAU, Tube, PMesh, V, angDiff, basis, bell, clamp, dens, lathe, lerp, mat4, outward, rich, rod, softCage, sstep, type P3, type Station } from './mesh';

// ---------- Masse (Ruhehaltung, Fuesse auf y=0, Blick +z, +x = linke Seite der Figur) ----------
// ---------- dimensions (rest stance, feet on y=0, facing +z, +x = the figure's left side) ----------
export const HIP_Y = 0.228;
export const HIP_X = 0.03;
export const SHOULDER_Y = 0.345;
export const SHOULDER_X = 0.056;
export const NECK_Y = 0.362;
export const HEAD_Y = 0.407;
const THIGH = 0.1, SHIN = 0.096, UPPER = 0.082, FORE = 0.072;
/** Kopfradien / head radii */
const HEAD_R: V3 = [0.0335, 0.041, 0.0375];
/**
 * Comic-Zugaben fuer die Lesbarkeit auf dem Brett: Kopf mit Helm, Haende und Glieder etwas kraeftiger als natuerlich.
 * Comic allowances for readability on the board: head with helmet, hands and limbs a little stronger than natural.
 */
export const HEAD_K = 1.14;
export const HAND_K = 1.24;
const LIMB_K = 1.1;

export interface FigurePose {
  /** Beckenversatz / pelvis offset */
  pelvis: P3;
  /** Becken: Neigung zur Seite, Drehung, Neigung nach vorn (rad) / pelvis: roll, yaw, pitch (rad) */
  pelvisRoll: number; pelvisYaw: number; pelvisPitch: number;
  /** Brust ebenso / chest likewise */
  chestRoll: number; chestYaw: number; chestPitch: number;
  /** Kopf gegen die Brust: Drehung, Nicken, Neigung / head against the chest: yaw, pitch, roll */
  head: P3;
  /** Knoechel und Fussdrehung, Index 0 = rechts (-x), 1 = links (+x) / ankles and foot yaw, index 0 = right (-x), 1 = left (+x) */
  ankle: [P3, P3];
  footYaw: [number, number];
  kneePole: [P3, P3];
  elbowPole: [P3, P3];
}

/**
 * Koerperkurve: bildet die aufrechte Ruhehaltung auf die Pose ab. Alles am Rumpf (Kleidung, Guertel, Gepaeck) wird in
 * der Ruhehaltung gebaut und hiermit verformt; Kopf, Arme und Beine setzen an den verformten Gelenken an.
 * Body curve: maps the upright rest stance onto the pose. Everything on the torso (clothing, belt, pack) is built in
 * the rest stance and deformed with this; head, arms and legs attach to the deformed joints.
 */
export class Body {
  private readonly y0 = 0.14;
  private readonly step = 0.002;
  private readonly o: THREE.Vector3[] = [];
  private readonly q: THREE.Quaternion[] = [];

  constructor(readonly pose: FigurePose) {
    const n = Math.round((0.52 - this.y0) / this.step);
    const quat = (h: number) => {
      const t = sstep(HIP_Y, SHOULDER_Y, h);
      const e = new THREE.Euler(lerp(pose.pelvisPitch, pose.chestPitch, t), lerp(pose.pelvisYaw, pose.chestYaw, t), lerp(pose.pelvisRoll, pose.chestRoll, t), 'ZXY');
      return new THREE.Quaternion().setFromEuler(e);
    };
    const iHip = Math.round((HIP_Y - this.y0) / this.step);
    const up = new THREE.Vector3();
    for (let i = 0; i <= n; i++) { this.q.push(quat(this.y0 + i * this.step)); this.o.push(new THREE.Vector3()); }
    this.o[iHip].set(pose.pelvis[0], HIP_Y + pose.pelvis[1], pose.pelvis[2]);
    for (let i = iHip + 1; i <= n; i++) this.o[i].copy(this.o[i - 1]).add(up.set(0, this.step, 0).applyQuaternion(this.q[i - 1]));
    for (let i = iHip - 1; i >= 0; i--) this.o[i].copy(this.o[i + 1]).sub(up.set(0, this.step, 0).applyQuaternion(this.q[i + 1]));
  }
  private idx(h: number): [number, number] {
    const s = clamp((h - this.y0) / this.step, 0, this.o.length - 1.001);
    return [Math.floor(s), s - Math.floor(s)];
  }
  /** Punkt der Ruhehaltung in die Pose / rest-stance point into the pose */
  warp = (p: THREE.Vector3): void => {
    const [i, f] = this.idx(p.y);
    const o = this.o[i].clone().lerp(this.o[i + 1], f), q = this.q[i].clone().slerp(this.q[i + 1], f);
    p.set(p.x, 0, p.z).applyQuaternion(q).add(o);
  };
  point(p: P3): THREE.Vector3 {
    const v = V(p);
    this.warp(v);
    return v;
  }
  /** Starre Abbildung fuer Teile, die in Hoehe h sitzen / rigid map for parts sitting at height h */
  rigid(h: number): THREE.Matrix4 {
    const [i, f] = this.idx(h);
    const o = this.o[i].clone().lerp(this.o[i + 1], f), q = this.q[i].clone().slerp(this.q[i + 1], f);
    return new THREE.Matrix4().compose(o, q, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -h, 0));
  }
}

/** Zwei-Knochen-IK (wie soldiers.ts) / two-bone IK (as in soldiers.ts) */
function ik(s: THREE.Vector3, t: THREE.Vector3, a: number, b: number, pole: THREE.Vector3) {
  const dir = t.clone().sub(s);
  let d = dir.length();
  dir.normalize();
  d = Math.min((a + b) * 0.995, Math.max(Math.abs(a - b) + 1e-3, d));
  const end = s.clone().addScaledVector(dir, d);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1);
  p.normalize();
  return { joint: s.clone().addScaledVector(dir, x).addScaledVector(p, h), end };
}

/** Station an einem Punkt / station at a point */
const st = (p: THREE.Vector3, rx: number, rf = rx, rb = rf, n = 2): Station => ({ p: A3(p), rx, rf, rb, n });
const along = (a: THREE.Vector3, d: THREE.Vector3, t: number) => a.clone().addScaledVector(d, t);
/** Station eines Arms oder Beins (mit Comic-Zugabe) / station of an arm or leg (with the comic allowance) */
const lm = (p: THREE.Vector3, rx: number, rf = rx, rb = rf, n = 2): Station => st(p, rx * LIMB_K, rf * LIMB_K, rb * LIMB_K, n);

/** Farben der Figur aus der Fraktionsoptik / figure colours from the faction look */
export interface FigureColours {
  tunic: THREE.Color; tunicDark: THREE.Color; breeches: THREE.Color; piping: THREE.Color; boot: THREE.Color; bootLight: THREE.Color;
  leather: THREE.Color; leatherDark: THREE.Color; brass: THREE.Color; skin: THREE.Color; hair: THREE.Color; gear: THREE.Color;
  roll: THREE.Color; helmet: THREE.Color; band: THREE.Color; steel: THREE.Color; wood: THREE.Color; woodDark: THREE.Color;
}
export function figureColours(L: Look): FigureColours {
  return {
    tunic: col(L.jacket), tunicDark: shade(L.jacket, 0.78), breeches: col(L.pants), piping: col(L.primary),
    boot: mix(mat.dark, mat.wood, 0.22), bootLight: mix(mat.dark, mat.wood, 0.45),
    leather: shade(mat.wood, 0.92), leatherDark: shade(mat.wood, 0.62), brass: mix(mat.gold, mat.wood, 0.25),
    skin: col(mat.skin), hair: shade(mat.wood, 0.55), gear: col(L.gear), roll: mix(L.secondary, mat.sand, 0.22),
    helmet: col(L.helmet), band: col(L.primary), steel: col(mat.gunmetal), wood: mix(mat.wood, mat.orange, 0.12), woodDark: shade(mat.wood, 0.7),
  };
}

/** Matrix eines Teils auf einer Flaeche: z = nach aussen, y = entlang u / matrix of a part on a surface: z = outward, y = along u */
export function onSurface(t: Tube, u: number, a: number, lift = 0): THREE.Matrix4 {
  const p = t.at(u, a, lift), z = t.normalAt(u, a);
  const y = t.at(u + 0.2, a, lift).sub(t.at(u - 0.2, a, lift));
  y.addScaledVector(z, -y.dot(z)).normalize();
  return basis(p, y.clone().cross(z).normalize(), y, z);
}

// ---------- Rumpf / torso ----------

/** Stationen der Feldbluse (Ruhehaltung) / stations of the field tunic (rest stance) */
export const TORSO = { hem: 0, skirt: 1, under: 2, belt: 3, over: 4, ribs: 5, chest: 6, armpit: 7, shoulder: 8, trap: 9, collar: 10, top: 11 };
export function torsoTube(body: Body, o: { skirt?: boolean } = {}): Tube {
  const S = (y: number, rx: number, rf: number, rb: number, n = 2.25): Station => ({ p: [0, y, 0], rx, rf, rb, n });
  const stations: Station[] = [
    S(0.198, 0.056, 0.043, 0.045, 2.2), S(0.221, 0.0545, 0.041, 0.044), S(0.25, 0.046, 0.0345, 0.035), S(0.262, 0.0435, 0.0325, 0.0335),
    S(0.275, 0.0475, 0.0365, 0.0345), S(0.296, 0.053, 0.0405, 0.0365), S(0.318, 0.058, 0.0435, 0.0385, 2.4), S(0.335, 0.0595, 0.0405, 0.0395, 2.4),
    S(0.348, 0.0545, 0.0335, 0.0365, 2.3), S(0.3575, 0.038, 0.0265, 0.0305), S(0.364, 0.0235, 0.0215, 0.0245), S(0.372, 0.0205, 0.02, 0.0215),
  ];
  if (o.skirt === false) stations.splice(0, 2);
  const t = new Tube(stations, { seg: 40, ring: 0.0052 });
  const k = o.skirt === false ? -2 : 0;
  // Falten: am Guertel gerafft, Schoss leicht wellig, Bausch ueber dem Guertel / folds: gathered at the belt, wavy skirt, blouse over the belt
  t.displace((u0, a) => {
    const u = u0 - k;
    const gather = bell(u, 3.75, 0.55) * 0.0016 + bell(u, 2.3, 0.5) * 0.0013;
    let d = gather * Math.cos(11 * a + 0.6) * (0.6 + 0.4 * Math.cos(3 * a + 1));
    d += sstep(2.4, 0, u) * 0.0022 * Math.cos(6 * a + 0.4);
    // Brust und Schulterblaetter / chest and shoulder blades
    d += 0.0022 * bell(u, 6.2, 0.9) * (bell(angDiff(a, 0.55), 0, 0.42) + bell(angDiff(a, -0.55), 0, 0.42));
    d += 0.0016 * bell(u, 6.6, 0.9) * (bell(angDiff(a, Math.PI - 0.6), 0, 0.4) + bell(angDiff(a, Math.PI + 0.6), 0, 0.4));
    d -= 0.0012 * bell(u, 5.5, 1.6) * bell(angDiff(a, Math.PI), 0, 0.16);
    // Zugfalten von der Achsel zur Brust / pull folds from the armpit towards the chest
    d += 0.0009 * bell(u, 6.6, 0.8) * Math.sin(u * 7 + Math.abs(angDiff(a, 0)) * 6) * sstep(0.7, 1.3, Math.abs(angDiff(a, 0))) * sstep(2.4, 1.6, Math.abs(angDiff(a, 0)));
    return d;
  });
  t.warp((p) => body.warp(p));
  return t;
}

/** Feldbluse mit Knopfleiste, Taschen, Kragen, Schulterklappen und Koppel / tunic with placket, pockets, collar, shoulder boards and belt */
export function torso(asm: Assembly, t: Tube, C: FigureColours, L: Look, o: { skirt?: boolean; belt?: boolean } = {}): void {
  const k = o.skirt === false ? -2 : 0;
  const U = (u: number) => u + k;
  const tm = new PMesh();
  t.mesh(tm, C.tunic, { capA: true });
  asm.add(tm, 50);
  const m = new PMesh();
  // Knopfleiste / button placket
  t.band(m, U(3.3), U(10.1), 0.0011, C.tunicDark, { a0: -0.1, a1: 0.1, nu: dens(14, 4), na: 2, thick: 0.0011 });
  // Brusttaschen mit Klappe / chest pockets with flap
  for (const s of [-1, 1]) {
    const a0 = s * 0.3, a1 = s * 0.98;
    t.band(m, U(5.25), U(6.45), 0.0013, C.tunic, { a0: Math.min(a0, a1), a1: Math.max(a0, a1), nu: 4, bulge: 0.0016, thick: 0.0013 });
    t.band(m, U(6.2), U(6.62), 0.0034, C.tunicDark, { a0: Math.min(a0, a1) - 0.02, a1: Math.max(a0, a1) + 0.02, nu: 2, thick: 0.0018 });
    // Schulterklappe / shoulder board
    t.band(m, U(8.25), U(9.75), 0.0019, col(L.secondary), { a0: s * Math.PI / 2 - 0.3, a1: s * Math.PI / 2 + 0.3, nu: 4, thick: 0.0019 });
    t.band(m, U(8.4), U(9.6), 0.0027, C.piping, { a0: s * Math.PI / 2 - 0.07, a1: s * Math.PI / 2 + 0.07, nu: 3, na: 2, thick: 0.001 });
  }
  // Stehkragen, vorn offen, mit Kragenspiegeln / stand collar, open at the front, with collar tabs
  t.band(m, U(9.95), U(11), 0.0026, C.tunicDark, { a0: 0.16, a1: TAU - 0.16, nu: 3, thick: 0.0026 });
  for (const s of [-1, 1]) t.band(m, U(10.15), U(10.85), 0.0036, col(L.secondary), { a0: s * 0.62 - 0.36, a1: s * 0.62 + 0.36, nu: 2, thick: 0.0012 });
  m.setInk(0.25);
  asm.add(m, 50);

  const small = new PMesh();
  const button = (u: number, a: number, r = 0.0021, c = C.brass) => small.add(lathe([[0, 0.0012], [r * 0.6, 0.001], [r, 0.0003], [r, -0.001]], 8, c, { fixed: true }), onSurface(t, u, a, 0.0012).multiply(mat4([0, 0, 0], [Math.PI / 2, 0, 0])));
  for (const u of [4.1, 5.3, 6.5, 7.7, 9.0]) button(U(u), 0);
  for (const s of [-1, 1]) {
    button(U(6.4), s * 0.64, 0.0018);
    button(U(9.45), s * Math.PI / 2, 0.0017);
    button(U(10.5), s * 0.62, 0.0014);
  }
  if (o.belt !== false) {
    // Koppel mit Schloss und Schlaufen / belt with buckle and keepers
    const belt = new PMesh();
    t.band(belt, U(2.62), U(3.38), 0.0032, C.leather, { nu: 2, thick: 0.003 });
    asm.add(belt, 40);
    small.add(softCage(0.0145, 0.0125, 0.0035, C.brass, { tight: 2, round: 1 }), onSurface(t, U(3), 0, 0.0045));
    small.add(softCage(0.006, 0.006, 0.0022, shade(C.brass, 0.7), { tight: 1, round: 1 }), onSurface(t, U(3), 0, 0.0068));
    for (const a of [-0.2, 0.2]) small.add(softCage(0.0032, 0.0135, 0.0026, C.leatherDark, { tight: 1, round: 1 }), onSurface(t, U(3), a, 0.0044));
  }
  small.setInk(0.3);
  asm.add(small, 40);
}

// ---------- Arme und Beine / arms and legs ----------

/**
 * Aermel von der Schulter bis zum Buendchen. Rueckgabe: Schlauch (fuer Abzeichen) und Winkel der Aussenseite.
 * Sleeve from the shoulder to the cuff. Returns the tube (for insignia) and the angle of the outer side.
 */
export function sleeve(asm: Assembly, shoulder: THREE.Vector3, wrist: THREE.Vector3, pole: THREE.Vector3, side: number, C: FigureColours): { tube: Tube; elbow: THREE.Vector3; end: THREE.Vector3 } {
  const { joint: E, end: W } = ik(shoulder, wrist, UPPER, FORE, pole);
  const d1 = E.clone().sub(shoulder).normalize(), d2 = W.clone().sub(E).normalize();
  const inward = new THREE.Vector3(-side, 0, 0);
  const stations: Station[] = [
    lm(along(shoulder, d1, -0.014).addScaledVector(inward, 0.006), 0.009), lm(along(shoulder, d1, -0.005), 0.0185), lm(along(shoulder, d1, 0.012), 0.0212),
    lm(along(shoulder, d1, 0.042), 0.0183), lm(along(E, d1, -0.015), 0.0172), lm(E, 0.0172), lm(along(E, d2, 0.016), 0.0176),
    lm(along(E, d2, 0.044), 0.0148), lm(along(W, d2, -0.013), 0.0128), lm(along(W, d2, -0.002), 0.0124),
  ];
  const t = new Tube(stations, { seg: 22, ring: 0.0046, front: [0, 0, 1] });
  const bend = Math.acos(clamp(d1.dot(d2), -1, 1));
  const inner = d1.clone().negate().add(d2).normalize();
  const aIn = t.angleOf(5, inner);
  t.displace((u, a) => {
    const din = angDiff(a, aIn);
    // Falten in der Armbeuge, Ellbogenspitze aussen, lockerer Stoff am Unterarm / folds inside the elbow, elbow point outside, loose cloth on the forearm
    let d = -0.0026 * bend * bell(din, 0, 0.9) * bell(u, 5, 0.75) * (0.55 + 0.45 * Math.cos((u - 5) * 9));
    d += 0.0022 * Math.min(1, bend) * bell(angDiff(din, Math.PI), 0, 0.8) * bell(u, 5.05, 0.5);
    d += 0.0011 * bell(u, 7.4, 0.7) * Math.cos(5 * a + 1.3);
    d += 0.001 * bell(u, 3.2, 0.8) * Math.sin(u * 6 + a * 2);
    d += 0.0016 * bell(u, 7.9, 0.28);
    return d;
  });
  const m = new PMesh();
  t.mesh(m, (u) => (u > 8 ? C.tunicDark : C.tunic), { capB: true, capA: true });
  asm.add(m, 55);
  return { tube: t, elbow: E, end: W };
}

/** Hosenbein (Reithose), Stiefel und Fuss / trouser leg (breeches), boot and foot */
export function leg(asm: Assembly, hip: THREE.Vector3, ankle: THREE.Vector3, yaw: number, pole: THREE.Vector3, side: number, C: FigureColours): void {
  const { joint: K, end: A } = ik(hip, ankle, THIGH, SHIN, pole);
  const d1 = K.clone().sub(hip).normalize(), d2 = A.clone().sub(K).normalize();
  const out = new THREE.Vector3(side, 0, 0);
  const tr = new Tube([
    lm(along(hip, d1, -0.016), 0.024, 0.028), lm(along(hip, d1, 0.012), 0.0295, 0.031), lm(along(hip, d1, 0.046), 0.0275, 0.0275, 0.0285),
    lm(along(K, d1, -0.022), 0.0215, 0.022, 0.0215), lm(K, 0.0195, 0.0205, 0.0195), lm(along(K, d2, 0.017), 0.0187, 0.018, 0.0195), lm(along(K, d2, 0.036), 0.0162),
  ], { seg: 24, ring: 0.0052 });
  const bend = Math.acos(clamp(d1.dot(d2), -1, 1));
  const aOut = tr.angleOf(2, out), aBack = tr.angleOf(4, pole.clone().negate());
  tr.displace((u, a) => {
    // Reithose: aussen weit; Kniefalten; Bausch ueber dem Stiefel / breeches: wide outside; knee folds; blousing over the boot
    let d = 0.0056 * bell(u, 1.75, 0.95) * Math.max(0, Math.cos(angDiff(a, aOut))) ** 1.5;
    d -= 0.0022 * (0.4 + bend) * bell(angDiff(a, aBack), 0, 1.0) * bell(u, 4, 0.7) * (0.5 + 0.5 * Math.cos((u - 4) * 10));
    d += 0.0034 * bell(u, 5.25, 0.42) * (1 + 0.28 * Math.cos(7 * a + side));
    d += 0.001 * bell(u, 2.8, 0.9) * Math.sin(u * 5 + a * 3);
    return d;
  });
  const m = new PMesh();
  tr.mesh(m, C.breeches);
  // Biese an der Aussennaht / piping along the outer seam
  tr.band(m, 0.9, 5.3, 0.0007, C.piping, { a0: aOut - 0.075, a1: aOut + 0.075, nu: dens(12, 4), na: 2, thick: 0.0007 });
  asm.add(m, 55);

  // Stiefelschaft / boot shaft
  const top = along(K, d2, 0.027);
  const sh = new Tube([
    lm(top, 0.0196), lm(along(K, d2, 0.036), 0.0188, 0.0186, 0.0192), lm(along(K, d2, 0.058), 0.0168, 0.0166, 0.0192),
    lm(along(A, d2, -0.02), 0.0146, 0.0148, 0.0158), lm(along(A, d2, -0.004), 0.014, 0.0152, 0.0142), lm(along(A, d2, 0.011), 0.013, 0.014, 0.013),
  ], { seg: 20, ring: 0.005 });
  sh.displace((u, a) => 0.0013 * bell(u, 3.5, 0.55) * Math.cos((u - 3.5) * 13) * (0.6 + 0.4 * Math.cos(a - 0.5)) + 0.0009 * bell(u, 0.05, 0.25));
  const bm = new PMesh();
  sh.mesh(bm, (u) => (u < 0.3 ? C.bootLight : C.boot), { capA: true });
  // Fuss: Schlauch von der Ferse zur Spitze, unten flach / foot: tube from heel to toe, flat underneath
  const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const base = new THREE.Vector3(A.x, 0, A.z);
  const F = (t: number, y: number, rx: number, rf: number, rb: number, n = 2.6): Station => ({ p: A3(along(base, f, t).setY(y)), rx, rf, rb, n });
  const foot = new Tube([
    F(-0.0215, 0.0165, 0.006, 0.006, 0.006), F(-0.017, 0.017, 0.0122, 0.013, 0.0108), F(-0.004, 0.0182, 0.0138, 0.0165, 0.0118), F(0.012, 0.0162, 0.0146, 0.0122, 0.0102, 2.5),
    F(0.028, 0.0134, 0.0158, 0.0088, 0.0074, 2.5), F(0.0405, 0.012, 0.0144, 0.0072, 0.006, 2.4), F(0.0478, 0.0112, 0.0075, 0.0042, 0.004),
  ], { seg: 18, ring: 0.005, front: [0, 1, 0] });
  foot.mesh(bm, C.boot, { capA: true, capB: true });
  asm.add(bm, 55);
  // Sohle mit Absatz / sole with heel
  const x = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const sole = new PMesh();
  const outline: [number, number][] = [[-0.0124, -0.022], [0.0124, -0.022], [0.0132, -0.004], [0.0158, 0.027], [0.0128, 0.045], [0, 0.0495], [-0.0128, 0.045], [-0.0158, 0.027], [-0.0132, -0.004]];
  const ring = (y: number, k: number) => outline.map(([px, pz]) => along(base, x, px * k).addScaledVector(f, pz * (0.5 + 0.5 * k)).setY(y));
  const dark = col(mat.ink);
  sole.loft([ring(0.0012, 0.94), ring(0.0028, 1), ring(0.0066, 1), ring(0.008, 0.9)], { c: dark, capA: 'poly', capB: 'poly' });
  outward(sole);
  const heel = new PMesh();
  const hr = (y: number) => [[-0.0122, -0.0218], [0.0122, -0.0218], [0.0128, -0.0045], [-0.0128, -0.0045]].map(([px, pz]) => along(base, x, px).addScaledVector(f, pz).setY(y));
  heel.loft([hr(0), hr(0.004)], { c: dark, capA: 'poly', capB: 'poly' });
  sole.add(outward(heel));
  asm.add(sole, 35);
}

// ---------- Haende / hands ----------

export interface HandPose {
  /** Beugung je Finger (Zeige- bis kleiner Finger): drei Gelenke (rad) / curl per finger (index to little finger): three joints (rad) */
  curl: [number, number, number][];
  spread?: number;
  /** Daumen: Gelenkpunkte ab der Wurzel (lokal) / thumb: joint points from the root (local) */
  thumb: P3[];
}
/** Griff um einen Schaft von rund 5 mm Radius / grip around a shaft of about 5 mm radius */
export const GRIP: HandPose = {
  curl: [[0.95, 1.2, 0.7], [1.0, 1.25, 0.7], [1.05, 1.25, 0.7], [1.12, 1.2, 0.7]],
  thumb: [[0.0108, 0.0042, 0.0032], [0.0128, 0.0085, 0.0082], [0.0122, 0.0112, 0.0146], [0.0102, 0.0152, 0.0186]],
};
/** Abzugshand: Zeigefinger gestreckt am Abzugsbuegel / trigger hand: index finger straight along the trigger guard */
export const GRIP_TRIGGER: HandPose = { ...GRIP, curl: [[0.5, 0.35, 0.2], [1.0, 1.25, 0.7], [1.05, 1.25, 0.7], [1.12, 1.2, 0.7]] };
/** Entspannt, leicht gekruemmt / relaxed, slightly curled */
export const RELAXED: HandPose = {
  curl: [[0.25, 0.4, 0.3], [0.32, 0.45, 0.3], [0.38, 0.5, 0.35], [0.45, 0.5, 0.35]], spread: 0.6,
  thumb: [[0.0108, 0.0042, 0.003], [0.0158, 0.0105, 0.0052], [0.0172, 0.0172, 0.0068], [0.0168, 0.0225, 0.0082]],
};
/** Achse des gegriffenen Schafts im Handraum / axis of the gripped shaft in hand space */
const GRIP_Y = 0.0195, GRIP_Z = 0.0045;

/**
 * Hand mit Handteller, vier Fingern und Daumen. Handraum: Ursprung Handgelenk, +y zu den Fingern, +z aus der
 * Handflaeche, Daumen bei +x (rechte Hand); die linke Hand ist das Spiegelbild.
 * Hand with palm, four fingers and thumb. Hand space: origin wrist, +y towards the fingers, +z out of the palm,
 * thumb at +x (right hand); the left hand is the mirror image.
 */
export function hand(pose: HandPose, skin: THREE.Color, left: boolean): PMesh {
  const m = new PMesh();
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const palm = new Tube([
    { p: [0, -0.0065, 0], rx: 0.0072, rf: 0.0046, rb: 0.0046, n: 2.4 }, { p: [0, 0.003, 0.0002], rx: 0.0092, rf: 0.0052, rb: 0.0046, n: 2.6 },
    { p: [0, 0.0115, 0.0004], rx: 0.0116, rf: 0.0056, rb: 0.0042, n: 2.8 }, { p: [0, 0.0185, 0.0004], rx: 0.0119, rf: 0.0048, rb: 0.004, n: 3 }, { p: [0, 0.0208, 0.0006], rx: 0.0108, rf: 0.0036, rb: 0.0032, n: 3 },
  ], { seg: 14, ring: 0.0035 });
  palm.mesh(m, skin, { capA: true, capB: true });
  const bx = [0.0086, 0.003, -0.0027, -0.008], by = [0.0188, 0.0198, 0.019, 0.0172], len = [0.019, 0.021, 0.0195, 0.0155], rad = [0.0031, 0.0032, 0.003, 0.0026];
  const splay = [1, 0.3, -0.4, -1];
  for (let k = 0; k < 4; k++) {
    const c = pose.curl[k], sp = (pose.spread ?? 0.35) * splay[k] * 0.14, r = rad[k], L = len[k];
    const dir = (th: number) => P(Math.sin(sp) * Math.cos(th), Math.cos(sp) * Math.cos(th), Math.sin(th));
    const p0 = P(bx[k], by[k], 0.0006), d1 = dir(c[0]), d2 = dir(c[0] + c[1]), d3 = dir(c[0] + c[1] + c[2]);
    const p1 = along(p0, d1, L * 0.46), p2 = along(p1, d2, L * 0.3), p3 = along(p2, d3, L * 0.24);
    const f = new Tube([
      st(along(p0, d1, -0.004), r * 0.9), st(p0, r * 1.06), st(p0.clone().lerp(p1, 0.55), r * 0.97), st(p1, r * 1.05), st(p1.clone().lerp(p2, 0.5), r * 0.92),
      st(p2, r * 0.98), st(p2.clone().lerp(p3, 0.6), r * 0.9), st(p3, r * 0.55),
    ], { seg: 8, ring: 0.0026 });
    f.mesh(m, skin, { capA: true, capB: true });
  }
  const tp = pose.thumb.map((q) => P(q[0], q[1], q[2]));
  const t0 = tp[0].clone().add(P(-0.006, -0.004, -0.0015));
  const th = new Tube([st(t0, 0.0042), st(tp[0], 0.0049), st(tp[1], 0.0041), st(tp[2], 0.0036), st(tp[2].clone().lerp(tp[3], 0.6), 0.0032), st(tp[3], 0.0019)], { seg: 9, ring: 0.0028 });
  th.mesh(m, skin, { capA: true, capB: true });
  m.setInk(0.34);
  if (left) m.apply(new THREE.Matrix4().makeScale(-1, 1, 1));
  return m;
}

/**
 * Lage einer greifenden Hand: Schaftachse durch O, palm = Richtung von der Achse zur Handflaeche, fingers = grobe
 * Richtung der Finger. Rueckgabe: Matrix des Handraums und das Handgelenk.
 * Placement of a gripping hand: shaft axis through O, palm = direction from the axis to the palm, fingers = rough
 * finger direction. Returns the hand-space matrix and the wrist.
 */
export function gripFrame(O: THREE.Vector3, palm: THREE.Vector3, fingers: THREE.Vector3, R: number): { M: THREE.Matrix4; wrist: THREE.Vector3; y: THREE.Vector3 } {
  const z = palm.clone().normalize().negate();
  const y = fingers.clone().addScaledVector(z, -fingers.dot(z)).normalize();
  const x = y.clone().cross(z);
  const wrist = O.clone().addScaledVector(y, -GRIP_Y * HAND_K).addScaledVector(z, -(GRIP_Z * HAND_K + R));
  return { M: basis(wrist, x, y, z).scale(new THREE.Vector3(HAND_K, HAND_K, HAND_K)), wrist, y };
}

// ---------- Kopf und Helm / head and helmet ----------

/** Ohr wie sculpt.ear, mit waehlbarer Aufloesung / ear like sculpt.ear, with a selectable resolution */
function earMesh(skin: THREE.Color, ws: number, hs: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const pos = g.getAttribute('position');
  const p = new THREE.Vector3();
  const cols = new Float32Array(pos.count * 3);
  const inner = mix(skin, mat.red, 0.25), deep = shade(skin, 0.6);
  for (let i = 0; i < pos.count; i++) {
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const dent = Math.max(0, p.x) * Math.exp(-((p.y / 0.7) ** 2 + (p.z / 0.75) ** 2));
    pos.setXYZ(i, p.x * 0.32 - dent * 0.28, p.y * (p.y < 0 ? 0.85 : 1), p.z * 0.62 * (p.y < -0.3 ? 0.75 : 1));
    const c = dent > 0.25 ? deep.clone().lerp(inner, 1 - dent) : dent > 0.05 ? inner : skin;
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Matrix in Position und Euler-Drehung (XYZ) zerlegen / decompose a matrix into position and Euler rotation (XYZ) */
export function xfOf(M: THREE.Matrix4): { p: V3; r: V3; s: number } {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  M.decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return { p: [p.x, p.y, p.z], r: [e.x, e.y, e.z], s: s.x };
}

/**
 * Kopf: modellierter Schaedel mit Gesicht, Augen mit Lidern, Brauen, Ohren, Haaransatz. Kopfraum: Ursprung Kopfmitte.
 * Head: sculpted skull with face, eyes with lids, brows, ears, hairline. Head space: origin at the head centre.
 */
export function head(asm: Assembly, M: THREE.Matrix4, C: FigureColours, o: { seed?: number } = {}): Sculpt {
  const S = new Sculpt([0, 0, 0], HEAD_R, {
    jaw: 0.13, chin: 0.16, chinDown: 0.06, back: 0.1, socket: 0.12, brow: 0.08, cheek: 0.07, hollow: 0.03, temple: 0.04,
    noseBridge: 0.09, noseLen: 0.25, noseW: 1.15, noseY: -0.33, lipU: 0.04, lipL: 0.055, mouthW: 0.44, mouthY: -0.57, smile: 0.012, asym: (o.seed ?? 0) % 2 ? 0.006 : -0.004,
    mouthDepth: 0.04, fold: 0.014, eyeX: 0.37, eyeY: -0.05, flat: 0.1,
  });
  const xf = xfOf(M);
  const lip = mix(C.skin, mat.red, 0.2), blush = mix(C.skin, mat.red, 0.16), shadow = shade(C.skin, 0.86);
  asm.addBuilt((b) => {
    b.group(xf, () => {
      b.addSmooth(S.mesh(C.skin, {
        ws: dens(44, 20), hs: dens(32, 16), soften: 3,
        paint: (p, w) => {
          if (w.lipL > 0.62) return lip.clone();
          const c = C.skin.clone().lerp(blush, clamp(w.cheek * 1.2));
          // Bartschatten am Kiefer / stubble shadow on the jaw
          return c.lerp(shadow, clamp(w.jaw * 0.9) * sstep(-0.25, -0.5, p.y));
        },
        // Haaransatz: Hinterkopf und Koteletten / hairline: back of the head and sideburns
        hair: { c: C.hair, at: (p) => ((p.z < -0.12 && p.y > -0.4) || (Math.abs(p.x) > 0.78 && p.z < 0.3 && p.y > 0.0 && p.y < 0.5) ? 1 : 0) },
        // unter dem Helm verdeckt / hidden under the helmet
        cut: (p) => p.y > 0.66,
      }));
      // Brauen und Mund als Tuschestriche, Nase mit Comic-Strichen / brows and mouth as ink strokes, nose with comic strokes
      for (const s of [-1, 1]) faceStroke(b, S, [[s * 0.16, 0.17], [s * 0.36, 0.235], [s * 0.59, 0.16]], 0.075, { c: C.hair, lift: 0.045, taper: 0.3 });
      faceStroke(b, S, [[-0.27, S.mouthLine(-0.27) + 0.012], [-0.1, S.mouthLine(-0.1) - 0.004], [0.1, S.mouthLine(0.1) - 0.004], [0.27, S.mouthLine(0.27) + 0.012]], 0.034, { lift: 0.05 });
      faceStroke(b, S, [[-0.1, S.mouthLine(0) - 0.105], [0, S.mouthLine(0) - 0.115], [0.1, S.mouthLine(0) - 0.105]], 0.02, { lift: 0.04, c: shade(C.skin, 0.62) });
      if (rich()) faceInk(b, S, { nose: 0.55, chin: 0.5, width: 1.1 });
      for (const s of [-1, 1] as const) {
        const at = S.dir([s, -0.02, -0.08], -0.04);
        b.addSmooth(earMesh(C.skin, dens(14, 8), dens(10, 6)), { p: at, r: [0, s * 0.3, s * 0.12], s: [s * S.len(0.24), S.len(0.3), S.len(0.24)] });
      }
    });
  }, 0.5);
  // Augen: Augapfel, Iris, Pupille, Glanzlicht, Ober- und Unterlid / eyes: eyeball, iris, pupil, highlight, upper and lower lid
  const eyes = new PMesh();
  const white = col(mat.white), iris = mix(mat.blue, mat.dark, 0.35), inkC = col(mat.ink), lid = shade(C.skin, 0.9);
  const r = S.len(0.2);
  for (const s of [-1, 1]) {
    const c = V(S.surf(s * S.f.eyeX, S.f.eyeY, -0.2 * 0.6));
    // Blick leicht zur Mitte / gaze slightly towards the middle
    const fwd = mat4(A3(c), [Math.PI / 2, 0, s * 0.06]);
    // Kugelkappe um die Blickachse / spherical cap about the gaze axis
    const cap = (R: number, ang: number, cc: THREE.Color, M: THREE.Matrix4) => {
      const prof: [number, number][] = [];
      for (let i = 3; i >= 0; i--) { const a = (ang * i) / 3; prof.push([Math.max(0.00005, Math.sin(a) * R), Math.cos(a) * R]); }
      eyes.add(lathe(prof, 10, cc, { fixed: true }), M);
    };
    eyes.add(lathe([[0.0001, -r], [r * 0.6, -r * 0.8], [r * 0.95, -r * 0.3], [r, 0.1 * r], [r * 0.82, r * 0.57], [r * 0.45, r * 0.9], [0.0001, r]], 12, white, { fixed: true }), fwd);
    cap(r * 1.02, 0.72, iris, fwd);
    cap(r * 1.04, 0.38, inkC, fwd);
    cap(r * 1.06, 0.13, white, mat4(A3(c), [Math.PI / 2 - 0.28, 0, s * 0.06 + 0.25]));
    // Lider als Kugelschalen ueber dem Augapfel / lids as spherical shells over the eyeball
    const lidCap = (a0: number, a1: number, tilt: number, cc: THREE.Color, edge: THREE.Color) => {
      const R = r * 1.1, n = 4;
      const prof: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); prof.push([Math.max(0.0001, Math.sin(a) * R), Math.cos(a) * R]); }
      // Farbe je Profilabschnitt: der letzte liegt an der Lidkante / colour per profile span: the last one lies at the lid edge
      eyes.add(lathe(prof, 12, (i) => (i >= n - 1 ? edge : cc), { fixed: true }), mat4(A3(c), [tilt, 0, 0]));
    };
    lidCap(0, 1.05, 0.12, lid, inkC);
    lidCap(Math.PI, Math.PI - 0.9, -0.08, lid, shade(lid, 0.8));
  }
  eyes.setInk(0);
  eyes.apply(M);
  asm.add(eyes, 60);
  return S;
}

/**
 * Stahlhelm als Schale: Kuppel, rotes Band, ausgestellte Krempe mit Wulst, dunkle Innenseite, Lederfutter, Kinnriemen,
 * Plakette mit Fraktionszeichen. Kopfraum wie head().
 * Steel helmet as a shell: dome, red band, flared brim with a rolled edge, dark inside, leather liner, chin strap,
 * plaque with the faction emblem. Head space as in head().
 */
export function helmet(asm: Assembly, M: THREE.Matrix4, S: Sculpt, C: FigureColours, L: Look, f: FactionId): void {
  const ax = 0.0435, az = 0.0495, H = 0.0415;
  const tilt = mat4([0, 0.0128, -0.0035], [-0.1, 0, 0], 1.05);
  const inside = shade(C.helmet, 0.34), rim = shade(C.helmet, 0.6);
  // Profil: [Radiusanteil, Hoehe, Zusatzradius, Farbe] von der Kuppelspitze ueber die Krempe nach innen
  // profile: [radius share, height, extra radius, colour] from the dome top over the brim to the inside
  const prof: { k: number; y: number; e: number; c: THREE.Color }[] = [];
  const rows = dens(11, 5), bandFrom = 1.16, rimA = 1.47;
  for (let i = 1; i <= rows; i++) { const a = (i / rows) * bandFrom; prof.push({ k: Math.sin(a), y: Math.cos(a) * H, e: 0, c: C.helmet }); }
  for (const a of [1.27, 1.38, rimA]) prof.push({ k: Math.sin(a), y: Math.cos(a) * H, e: 0, c: C.band });
  const y0 = Math.cos(rimA) * H;
  prof.push({ k: 1, y: y0 - 0.0012, e: 0.0032, c: C.helmet }, { k: 1, y: y0 - 0.0036, e: 0.0074, c: C.helmet }, { k: 1, y: y0 - 0.0056, e: 0.0098, c: rim },
    { k: 1, y: y0 - 0.0072, e: 0.0094, c: rim }, { k: 1, y: y0 - 0.0066, e: 0.007, c: inside }, { k: 1, y: y0 - 0.0036, e: 0.001, c: inside }, { k: 0.98, y: y0 + 0.004, e: -0.0028, c: inside }, { k: 0.86, y: H * 0.5, e: -0.0028, c: inside });
  const seg = dens(36, 14);
  const m = new PMesh();
  const top = m.v(0, H, 0);
  const ring = (q: { k: number; y: number; e: number }) => Array.from({ length: seg }, (_, j) => {
    const a = (j / seg) * TAU, sn = Math.sin(a), cs = Math.cos(a);
    // Krempe vorn und hinten etwas breiter, Rand leicht geschwungen / brim slightly wider front and back, edge gently curved
    const e = q.e * (1 + 0.22 * cs * cs);
    return [sn * (ax * q.k + e), q.y - Math.max(0, q.e) * 0.16 * (cs * cs - 0.4), cs * (az * q.k + e)] as P3;
  });
  const base = m.vcount;
  const rings = prof.map(ring);
  m.loft(rings, { c: (i) => prof[i + 1].c });
  for (let j = 0; j < seg; j++) m.f([top, base + ((j + 1) % seg), base + j], C.helmet);
  // Profil laeuft von oben nach unten: umdrehen, dann zeigt die Schale nach aussen / the profile runs top to bottom: flip so the shell faces outward
  m.flip();
  // Lederfutter innen (zeigt nach innen) / leather liner inside (facing inward)
  const liner = [0, 1].map((i) => Array.from({ length: seg }, (_, j) => {
    const a = (j / seg) * TAU;
    return [Math.sin(a) * (ax - 0.006 - i * 0.002), y0 - 0.003 + i * 0.011, Math.cos(a) * (az - 0.006 - i * 0.002)] as P3;
  }));
  m.add(new PMesh().loft(liner, { c: C.leather }).flip());
  m.apply(tilt).apply(M);
  asm.add(m, 38);

  const small = new PMesh();
  // Kinnriemen entlang Wange und Kinn / chin strap along cheek and chin
  const strap: P3[] = [];
  const pts: [V3, number][] = [[[0.95, 0.3, 0.12], 0.06], [[0.93, -0.1, 0.2], 0.045], [[0.8, -0.55, 0.3], 0.045], [[0.45, -0.88, 0.36], 0.045], [[0, -1, 0.36], 0.05]];
  for (const [d, l] of pts) strap.push(S.dir(d, l));
  for (let i = pts.length - 2; i >= 0; i--) strap.push(S.dir([-pts[i][0][0], pts[i][0][1], pts[i][0][2]], pts[i][1]));
  small.add(rod(strap, 0.0029, C.leather, { seg: 6, flat: 0.36, n: 4, ring: 0.004, front: [1, 0, 0], caps: false }));
  for (const s of [-1, 1]) small.add(softCage(0.0036, 0.0046, 0.0018, C.brass, { tight: 1, round: 1 }), mat4(S.dir([s * 0.92, -0.2, 0.21], 0.05), [0, s * 1.3, 0]));
  small.apply(M);
  // Plakette vorn auf der Kuppel / plaque on the dome front
  const a = 0.86, plaque = mat4([0, Math.cos(a) * H + 0.0005, Math.sin(a) * az + 0.0006], [-(Math.PI / 2 - a) - 0.12, 0, 0]);
  const PM = M.clone().multiply(tilt).multiply(plaque);
  small.add(lathe([[0.0102, -0.002], [0.0102, 0.0008], [0.0088, 0.0018], [0.0001, 0.0018]], 16, C.band, { fixed: true }), PM.clone().multiply(mat4([0, 0, 0], [Math.PI / 2, 0, 0])));
  small.setInk(0.3);
  asm.add(small, 40);
  const pxf = xfOf(PM);
  asm.addBuilt((b) => b.group(pxf, () => addEmblem(b, f, 0.0074, 0.0012, shade(L.secondary, 1.35), { p: [0, 0, 0.0019] })), 0);
}

/** Hals von der Kragenmitte zum Schaedel / neck from the collar centre to the skull */
export function neck(asm: Assembly, from: THREE.Vector3, to: THREE.Vector3, C: FigureColours): void {
  const m = new PMesh();
  const d = to.clone().sub(from).normalize();
  new Tube([st(along(from, d, -0.006), 0.0165, 0.0165, 0.0175), st(from.clone().lerp(to, 0.5), 0.0152, 0.0152, 0.0165), st(to, 0.0158, 0.016, 0.0175)], { seg: 16, ring: 0.005 }).mesh(m, C.skin);
  asm.add(m, 60);
}

// ---------- Ausruestung am Rumpf / gear on the torso ----------

/**
 * Gerollter Mantel schraeg ueber Schulter und Huefte: eine geschlossene Rolle, die der Rumpfflaeche folgt, mit Falten
 * und Riemen. side = Schulter, ueber der sie liegt (+1 = links).
 * Rolled greatcoat slung over shoulder and hip: one closed roll following the torso surface, with folds and straps.
 * side = the shoulder it lies on (+1 = left).
 */
export function coatRoll(asm: Assembly, t: Tube, C: FigureColours, side = 1): Tube {
  const n = 22, r = 0.0108;
  const stations: Station[] = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * TAU;
    const u = 6.35 + 2.75 * Math.cos(ph) + 0.25 * Math.sin(ph) ** 2;
    const a = side * (Math.PI / 2 - ph);
    // auf der Schulter dichter am Hals und flacher / on the shoulder closer to the neck and flatter
    const topK = bell(angDiff(ph, 0), 0, 0.5);
    const p = t.at(u, a + side * topK * 0.1, r * (0.82 - 0.2 * topK));
    stations.push({ p: A3(p), rx: r * (1 - 0.08 * topK), rf: r * (1 - 0.18 * topK) });
  }
  const roll = new Tube(stations, { seg: 12, ring: 0.0052, loop: true, front: [0, 0, 1] });
  // Wickelfalten laufen schraeg um die Rolle / wrap folds run diagonally around the roll
  roll.displace((u, a) => 0.0008 * Math.sin(a * 2 + u * 3.1) + 0.0005 * Math.sin(u * 7.3 + 1));
  const m = new PMesh();
  roll.mesh(m, C.roll);
  for (const u of [2.2, 6.2, 9.6, 13.2, 17.4, 20.3]) roll.band(m, u - 0.14, u + 0.14, 0.0009, C.leatherDark, { nu: 1, thick: 0.0014 });
  asm.add(m, 60);
  return roll;
}

/** Patronentaschen, Feldflasche, Spaten, Brotbeutel, Stielgranaten / ammo pouches, canteen, spade, haversack, stick grenades */
export function beltKit(asm: Assembly, t: Tube, C: FigureColours, k = 0): void {
  const m = new PMesh();
  const U = (u: number) => u + k;
  for (const a of [-0.62, -1.02, 0.66, 1.06]) {
    const M = onSurface(t, U(2.9), a, 0.0078);
    m.add(softCage(0.0165, 0.0215, 0.011, C.leather, { tight: 1, round: 1, cuts: [1, 2, 1] }), M);
    m.add(softCage(0.0178, 0.0098, 0.0122, C.leatherDark, { tight: 1, round: 1 }), M.clone().multiply(mat4([0, 0.0072, 0.0006])));
    m.add(lathe([[0, 0.0012], [0.0013, 0.0008], [0.0013, -0.0006]], 6, C.brass, { fixed: true }).setInk(0.2), M.clone().multiply(mat4([0, 0.0032, 0.0066], [Math.PI / 2, 0, 0])));
  }
  // Feldflasche hinten rechts / canteen at the right rear
  const can = onSurface(t, U(2.25), -2.25, 0.012);
  m.add(lathe([[0.0001, -0.019], [0.0105, -0.017], [0.0135, -0.008], [0.0135, 0.004], [0.0095, 0.0125], [0.0048, 0.0155], [0.0048, 0.0195], [0.0001, 0.0195]], 14, (i) => (i >= 5 ? mat.metalLight : C.gear), { sz: 0.66 }), can);
  m.add(softCage(0.006, 0.03, 0.0014, C.leatherDark, { tight: 1, round: 0 }), can.clone().multiply(mat4([0, -0.001, 0.0092])));
  // Klappspaten im Futteral hinten links / entrenching tool in its cover at the left rear
  const sp = onSurface(t, U(2.0), 2.3, 0.0085);
  m.add(softCage(0.03, 0.04, 0.0075, C.gear, { tight: 1, round: 1, top: [0.03, 0.0075], cuts: [1, 2, 1] }), sp.clone().multiply(mat4([0, -0.008, 0], [0, 0, 0.12])));
  m.add(rod([[0, 0.008, 0.001], [0, 0.05, 0.002]], 0.0034, C.wood, { seg: 8, smooth: false }), sp.clone().multiply(mat4([0, 0, 0], [0, 0, 0.12])));
  // Brotbeutel auf dem Ruecken / haversack on the back
  const bag = onSurface(t, U(5.6), Math.PI, 0.016);
  m.add(softCage(0.066, 0.058, 0.03, C.gear, { tight: 0, round: 2, cuts: [2, 2, 1], top: [0.056, 0.022] }), bag);
  m.add(softCage(0.064, 0.026, 0.0315, shade(C.gear, 0.82), { tight: 1, round: 1, top: [0.058, 0.026] }), bag.clone().multiply(mat4([0, 0.02, 0.0012])));
  for (const x of [-0.016, 0.016]) m.add(softCage(0.0052, 0.03, 0.002, C.leatherDark, { tight: 1, round: 0 }), bag.clone().multiply(mat4([x, 0.012, 0.0165])));
  // Tragegurte vom Brotbeutel ueber die Schultern zum Koppel / straps from the haversack over the shoulders to the belt
  for (const s of [-1, 1]) {
    const pts: P3[] = [];
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      // vorn vom Koppel hinauf, ueber die Schulter, hinten hinab / up from the belt in front, over the shoulder, down the back
      const u = f < 0.5 ? lerp(3.3, 9.15, sstep(0, 0.5, f)) : lerp(9.15, 6.4, sstep(0.5, 1, f));
      const a = s * (f < 0.5 ? lerp(0.5, 0.95, f * 2) : lerp(Math.PI - 0.95, Math.PI - 0.5, (f - 0.5) * 2));
      pts.push(A3(t.at(U(u), f < 0.5 ? a : a, 0.0026)));
    }
    m.add(rod(pts, 0.0048, C.gear, { seg: 6, flat: 0.3, n: 4, ring: 0.005, front: [0, 0, 1], caps: false }));
  }
  asm.add(m, 42);
  // Stielhandgranaten im Koppel / stick grenades in the belt
  const g = new PMesh();
  for (const [a, lean] of [[0.3, 0.28], [0.44, 0.2]] as [number, number][]) {
    const M = onSurface(t, U(3.05), a, 0.0075).multiply(mat4([0, 0, 0], [0.05, 0, lean]));
    g.add(lathe([[0.0001, -0.03], [0.0028, -0.03], [0.0028, 0.012], [0.0064, 0.0135], [0.0064, 0.031], [0.0052, 0.0335], [0.0001, 0.0335]], 10, (i) => (i < 2 ? C.wood : mat.darkMid)), M);
  }
  g.setInk(0.5);
  asm.add(g, 40);
}
