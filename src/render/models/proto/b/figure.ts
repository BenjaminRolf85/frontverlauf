/**
 * Vorschlag B: Figur (Schuetze, Besatzung) als wenige glatte Koerper mit Texturkoordinaten.
 * Proposal B: figure (rifleman, crew) as a few smooth bodies with texture coordinates.
 *
 * Statt vieler kleiner Quader traegt die Figur ihre Einzelheiten gezeichnet (figurePaint.ts): Taschen, Naehte, Gesicht.
 * Die Koerper selbst sind Lofts: ein Rumpf mit Schultern, Taille, Koppel und Rockschoss in einem Stueck, Glieder mit
 * Muskel- und Stoffprofil statt Rohren, ein Kopf mit Kinn und Nase, eine Faust statt des Faeustlings.
 * Proportionen: weniger "Chibi" als bisher, der Kopf misst rund ein Fuenftel der Hoehe (vorher ein Drittel).
 * Instead of many small boxes the figure carries its detail drawn (figurePaint.ts): pockets, seams, face. The bodies
 * themselves are lofts: a torso with shoulders, waist, belt and tunic skirt in one piece, limbs with a muscle and
 * cloth profile instead of tubes, a head with chin and nose, a fist instead of the mitten.
 * Proportions: less "chibi" than before, the head is about a fifth of the height (a third before).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../../data/balance';
import { geo, mix, shade, softBox, xfMatrix, type V3, type Xf } from '../../kit';
import { look, mat, type Look } from '../../look';
import { AtlasLayout, loft, loftAt, projectBox, ribbon, UvBuilder, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
/** geschlossene Spitze eines Lofts / closed tip of a loft */
const TIP = 1e-7;

// ---------- Masse / dimensions ----------

/** Kopfmassstab gegen den Koerper / head scale against the body */
export const HEAD_SCALE = 1.3;
const HIP_X = 0.036, HIP_Y = -0.008;
const SHOULDER_X = 0.077, SHOULDER_Y = 0.141;
const NECK_Y = 0.184;
const THIGH = 0.135, SHIN = 0.125, UPPER = 0.095, FORE = 0.09;
/** Hoehe der Fussachse ueber dem Boden / height of the foot axis above the ground */
const FOOT_Y = 0.029;
export const ANKLE_Y = 0.045;

/** Ringe des Kopfes von oben nach unten (Kopfkoordinaten, Kinn bei y = 0) / head rings top to bottom (head coordinates, chin at y = 0) */
export const HEAD: Ring[] = [
  { y: 0.108, rx: TIP },
  { y: 0.104, rx: 0.018, rzB: 0.02 },
  { y: 0.094, rx: 0.031, rz: 0.031, rzB: 0.035 },
  { y: 0.08, rx: 0.039, rz: 0.039, rzB: 0.045, e: 2.15 },
  { y: 0.064, rx: 0.0425, rz: 0.0425, rzB: 0.048, e: 2.2 },
  { y: 0.05, rx: 0.043, rz: 0.043, rzB: 0.046, e: 2.25 },
  { y: 0.036, rx: 0.0415, rz: 0.0435, rzB: 0.04, e: 2.35 },
  { y: 0.024, rx: 0.038, rz: 0.043, rzB: 0.032, e: 2.5 },
  { y: 0.012, rx: 0.031, rz: 0.04, rzB: 0.024, e: 2.6, cz: 0.001 },
  { y: 0.004, rx: 0.022, rz: 0.032, rzB: 0.018, e: 2.5, cz: 0.002 },
  { y: 0, rx: TIP, cz: 0.006 },
];
/** Gesichtshoehen in Kopfkoordinaten / face heights in head coordinates */
export const FACE = { brow: 0.0655, eye: 0.053, eyeX: 0.0178, nose: 0.036, mouth: 0.0225, chin: 0.006, rim: 0.071 };

/** Helm (Korvat): Kuppel, rotes Band, Krempe; Mitte C, Radius R / helmet (Korvat): dome, red band, rim; centre C, radius R */
const HELMET = { C: 0.084, R: 0.0525, rim: 0.0665, band: 62 };
export function helmetRings(L: Look): Ring[] {
  const { C, R, rim } = HELMET;
  const out: Ring[] = [];
  const a1 = (HELMET.band * Math.PI) / 180, rows = 6;
  for (let i = 0; i <= rows; i++) {
    const a = (i / rows) * a1;
    out.push({ y: C + R * Math.cos(a), rx: Math.max(TIP, R * Math.sin(a)), ...(i === 0 ? { c: L.helmet } : {}), ...(i === rows ? { c: L.primary } : {}) });
  }
  const a2 = (a1 + HALF_PI) / 2;
  out.push({ y: C + R * Math.cos(a2), rx: R * Math.sin(a2) });
  out.push({ y: C, rx: R, c: shade(L.helmet, 0.92) });
  out.push({ y: C - 0.0055, rx: R + (rim - R) * 0.55 });
  out.push({ y: C - 0.012, rx: rim, hard: true, c: shade(L.helmet, 0.6) });
  out.push({ y: C - 0.0155, rx: rim - 0.001, hard: true, c: shade(L.helmet, 0.42) });
  out.push({ y: C - 0.009, rx: R - 0.004 });
  return out.map((r) => ({ ...r, rz: r.rx * 1.07, rzB: r.rx * 1.1 }));
}

/** Rumpf von oben nach unten (Beckenkoordinaten): Hals, Schultern, Brust, Taille, Koppel, Rockschoss, Schritt / torso top to bottom (pelvis coordinates) */
export function torsoRings(L: Look, jacket: THREE.Color = L.jacket): Ring[] {
  return [
    { y: 0.176, rx: 0.023, rz: 0.023, c: jacket },
    { y: 0.163, rx: 0.042, rz: 0.033, e: 2.2 },
    { y: 0.148, rx: 0.077, rz: 0.044, rzB: 0.043, e: 2.7 },
    { y: 0.122, rx: 0.083, rz: 0.053, rzB: 0.047, e: 2.5 },
    { y: 0.09, rx: 0.078, rz: 0.054, rzB: 0.045, e: 2.4 },
    { y: 0.055, rx: 0.068, rz: 0.048, rzB: 0.042, e: 2.4 },
    { y: 0.0295, rx: 0.067, rz: 0.047, rzB: 0.043, e: 2.4, hard: true },
    { y: 0.0285, rx: 0.0705, rz: 0.0505, rzB: 0.0465, e: 2.4, hard: true, c: L.gear },
    { y: 0.005, rx: 0.0705, rz: 0.0505, rzB: 0.0465, e: 2.4, hard: true },
    { y: 0.004, rx: 0.068, rz: 0.048, rzB: 0.045, e: 2.4, hard: true, c: jacket },
    { y: -0.024, rx: 0.073, rz: 0.052, rzB: 0.05, e: 2.5, hard: true },
    { y: -0.025, rx: 0.067, rz: 0.047, rzB: 0.046, e: 2.4, hard: true, c: L.pants },
    { y: -0.045, rx: 0.05, rz: 0.04, e: 2.2 },
    { y: -0.056, rx: TIP },
  ];
}

// ---------- Atlas ----------

/** Atlas der Figur (Bezug 1024): das untere Viertel bleibt frei fuer die Kopfbedeckungen der anderen Fraktionen / figure atlas (reference 1024): the bottom quarter stays free for the other factions' headgear */
export function figureLayout(): AtlasLayout {
  const a = new AtlasLayout();
  a.place('head', 8, 8, 640, 288);
  a.place('thigh', 656, 8, 240, 150);
  a.place('hand', 904, 8, 112, 70);
  a.place('nose', 904, 86, 56, 44);
  a.place('ear', 968, 86, 48, 44);
  a.place('blank', 904, 138, 16, 16);
  a.place('shin', 656, 166, 208, 130);
  a.place('boot', 872, 166, 144, 130);
  a.place('torso', 8, 304, 448, 208);
  a.place('helmet', 464, 304, 448, 128);
  a.place('strap', 464, 440, 256, 24);
  a.place('rollEnd', 728, 440, 48, 48);
  a.place('canteen', 920, 304, 64, 80);
  a.place('pouch', 920, 392, 64, 64);
  a.place('packBack', 8, 520, 160, 136);
  a.place('packSide', 176, 520, 72, 136);
  a.place('upperArm', 256, 520, 176, 104);
  a.place('foreArm', 440, 520, 160, 100);
  a.place('bedroll', 608, 520, 160, 96);
  a.place('packTop', 776, 520, 160, 72);
  a.place('rifle', 8, 664, 512, 96);
  return a;
}

/** Grenzen des Gewehrs in seiner Seitenansicht (z nach vorn, y nach oben) / bounds of the rifle in its side view (z forward, y up) */
export const RIFLE = { z0: -0.112, z1: 0.392, y0: -0.064, y1: 0.03 };

// ---------- Haltung / pose ----------

export interface FigurePose {
  pelvis: V3;
  twist?: number;
  head?: V3;
  handL: V3;
  handR: V3;
  footL?: V3;
  footR?: V3;
  /** Drehung der Stiefel um die Hochachse / yaw of the boots */
  bootL?: number;
  bootR?: number;
  elbowPoleL?: V3;
  elbowPoleR?: V3;
}

export interface FigureOpts {
  legs?: boolean;
  pack?: boolean;
  /** Schaerpe der Korvat quer ueber die Brust / the Korvat sash across the chest */
  sash?: boolean;
  /** Rundungssegmente (hohe / niedrige Qualitaet) / radial segments (high / low quality) */
  seg?: number;
}

/** Zwei-Knochen-IK wie soldiers.ts / two-bone IK like soldiers.ts */
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

/** Teil erst an seinen Platz bringen, dann projizieren (gemeinsame Grenzen) / move a part into place first, then project (shared bounds) */
function placed(g: THREE.BufferGeometry, xf: Xf): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (g.userData.smooth) out.userData.smooth = true;
  out.applyMatrix4(xfMatrix(xf));
  return out;
}

// ---------- Kopf / head ----------

/** Kopf mit Nase, Ohren und Helm; Ursprung am Kinn, Blick +z / head with nose, ears and helmet; origin at the chin, facing +z */
export function head(b: UvBuilder, A: AtlasLayout, L: Look, seg = 28): void {
  const skin = { crease: 0, hatch: 0 };
  b.add(loft(HEAD, { seg, region: A.get('head'), color: mat.skin }), null, skin);
  // Nase: schmaler Ruecken, breite Spitze / nose: narrow bridge, broad tip
  b.bone(new THREE.Vector3(0, FACE.eye + 0.006, 0.0405), new THREE.Vector3(0, FACE.nose + 0.001, 0.0525), new THREE.Vector3(0, -0.4, 1), () => {
    b.add(loft([
      { y: -0.004, rx: TIP }, { y: 0, rx: 0.0036, rz: 0.0034 }, { y: 0.011, rx: 0.005, rz: 0.005 }, { y: 0.02, rx: 0.0078, rz: 0.007, e: 2.3 },
      { y: 0.0255, rx: 0.0074, rz: 0.0066, e: 2.3 }, { y: 0.0285, rx: TIP, cz: -0.003 },
    ], { seg: Math.max(8, Math.round(seg / 3)), region: A.get('nose'), color: mat.skin }), null, skin);
  });
  // Ohren / ears
  b.mirrorX(() => b.bone(new THREE.Vector3(0.0395, 0.036, -0.008), new THREE.Vector3(0.0415, 0.062, -0.012), new THREE.Vector3(1, 0, -0.5), () => {
    b.add(loft([
      { y: -0.001, rx: TIP }, { y: 0.004, rx: 0.006, rz: 0.0035 }, { y: 0.014, rx: 0.0095, rz: 0.0048 }, { y: 0.022, rx: 0.009, rz: 0.0045 }, { y: 0.027, rx: TIP },
    ], { seg: 10, region: A.get('ear'), color: mat.skin }), null, skin);
  }));
  // Helm leicht in den Nacken geschoben, damit das Gesicht frei bleibt / helmet pushed back slightly so the face stays open
  b.group({ p: [0, 0.004, -0.004], r: [-0.1, 0, 0] }, () => {
    b.add(loft(helmetRings(L), { seg, region: A.get('helmet'), arc: true }), null);
  });
}

// ---------- Figur / figure ----------

/** Figur aufbauen (Fuesse auf y = 0, Blick +z) / build the figure (feet at y = 0, facing +z) */
export function figure(b: UvBuilder, A: AtlasLayout, f: FactionId, pose: FigurePose, o: FigureOpts = {}): void {
  const L = look(f);
  const seg = o.seg ?? 20;
  const twist = pose.twist ?? 0;
  const Mt = xfMatrix({ p: pose.pelvis, r: [0, twist, 0] });
  const T = torsoRings(L);
  const boot = mat.dark;

  b.group({ p: pose.pelvis, r: [0, twist, 0] }, () => {
    b.add(loft(T, { seg: seg + 4, region: A.get('torso') }), null);
    // Stehkragen: offen, die Kante zeichnet die Tusche / stand collar: open, the ink draws its edge
    b.add(loft([{ y: 0.189, rx: 0.0285, rz: 0.029, cz: 0.001 }, { y: 0.169, rx: 0.036, rz: 0.035, cz: 0.001 }], { seg, region: A.get('blank'), color: shade(L.jacket, 0.82) }), null);
    b.add(loft([{ y: 0.2, rx: 0.0205 }, { y: 0.166, rx: 0.0225 }], { seg: 12, region: A.get('blank'), color: shade(mat.skin, 0.94) }), null, { crease: 0, hatch: 0 });
    if (o.sash !== false && f === 'korvat') {
      // Schaerpe in Fraktionsfarbe als Auflage: Farbe aus der Vertexfarbe, Zeichnung aus dem Atlas
      // sash in the faction colour as a decal: colour from the vertex colour, drawing from the atlas
      const path = [];
      for (let i = 0; i <= 12; i++) { const u = i / 12; path.push(loftAt(T, 0.655 - u * 0.33, 0.15 - u * 0.118)); }
      b.add(ribbon(path, 0.0115, A.get('strap'), 0.0022), L.secondary);
    }
    if (o.pack !== false) {
      // Tornister, Deckenrolle, Feldflasche / pack, bedroll, canteen
      b.add(projectBox(softBox(0.118, 0.106, 0.052, 0.013, 1), { nz: A.get('packBack'), px: A.get('packSide'), nx: A.get('packSide'), mirrorNx: true, py: A.get('packTop'), all: A.get('blank') }), L.gear, { xf: { p: [0, 0.093, -0.077] } });
      b.add(loft([{ y: 0.071, rx: 0.0215, hard: true }, { y: 0.064, rx: 0.0235 }, { y: -0.064, rx: 0.0235 }, { y: -0.071, rx: 0.0215, hard: true }], { seg: 14, region: A.get('bedroll'), capFirst: A.get('rollEnd'), capLast: A.get('rollEnd') }), L.secondary, { xf: { p: [0, 0.163, -0.074], r: [0, 0, HALF_PI] } });
      b.add(loft([{ y: 0.03, rx: TIP }, { y: 0.027, rx: 0.008, rz: 0.008 }, { y: 0.02, rx: 0.0085, rz: 0.0085, hard: true }, { y: 0.019, rx: 0.019, rz: 0.012 }, { y: 0, rx: 0.0235, rz: 0.0145 }, { y: -0.02, rx: 0.02, rz: 0.012 }, { y: -0.026, rx: TIP }], { seg: 12, region: A.get('canteen') }), shade(L.gear, 1.25), { xf: { p: [-0.058, -0.012, -0.047], r: [0, 0.5, 0] } });
    }
    // Koppeltaschen / belt pouches
    for (const s of [-1, 1]) b.add(projectBox(softBox(0.031, 0.036, 0.017, 0.005), { pz: A.get('pouch'), all: A.get('blank') }), shade(L.gear, 0.82), { xf: { p: [s * 0.043, 0.012, 0.052], r: [0, s * 0.25, 0] } });
    b.group({ p: [0, NECK_Y, 0.003], r: pose.head, s: HEAD_SCALE }, () => head(b, A, L, seg + 8));
  });

  // ---- Arme / arms ----
  for (const side of [-1, 1] as const) {
    const S = new THREE.Vector3(side * SHOULDER_X, SHOULDER_Y, 0).applyMatrix4(Mt);
    const out = new THREE.Vector3(side, 0, 0).transformDirection(Mt);
    const target = V(side < 0 ? pose.handL : pose.handR);
    const pole = V((side < 0 ? pose.elbowPoleL : pose.elbowPoleR) ?? [side * 0.8, -0.6, -0.35]);
    const { joint: E, end: H } = ik(S, target, UPPER, FORE, pole);
    const flip = side < 0 ? { s0: 1, s1: 0 } : {};
    b.bone(S, E, out, (len) => {
      b.add(loft([
        { y: -0.026, rx: TIP }, { y: -0.018, rx: 0.018 }, { y: -0.006, rx: 0.0275 }, { y: 0.014, rx: 0.031, rz: 0.0315 }, { y: 0.048, rx: 0.0275 },
        { y: len - 0.012, rx: 0.0255 }, { y: len + 0.01, rx: 0.0235 }, { y: len + 0.022, rx: TIP },
      ], { seg, region: A.get('upperArm'), color: L.jacket, ...flip }), null, { crease: 0 });
    });
    b.bone(E, H, out, (len) => {
      b.add(loft([
        { y: -0.02, rx: TIP }, { y: -0.01, rx: 0.02 }, { y: 0.006, rx: 0.0255 }, { y: 0.036, rx: 0.0245 }, { y: len - 0.027, rx: 0.022, hard: true },
        { y: len - 0.026, rx: 0.0248, hard: true, c: shade(L.jacket, 0.8) }, { y: len - 0.007, rx: 0.0248, hard: true }, { y: len - 0.006, rx: 0.017, hard: true },
      ], { seg, region: A.get('foreArm'), color: L.jacket, capLast: true, ...flip }), null);
    });
    // Faust: Handruecken nach aussen, Daumen oben / fist: back of the hand outward, thumb on top
    const dir = H.clone().sub(E).normalize();
    const z = out.clone().addScaledVector(dir, -out.dot(dir)).normalize();
    const x = new THREE.Vector3().crossVectors(dir, z);
    const sx = x.y >= 0 ? 1 : -1;
    b.bone(H, H.clone().addScaledVector(dir, 0.05), out, () => {
      b.add(loft([
        { y: -0.008, rx: 0.0145, rz: 0.013 }, { y: 0.006, rx: 0.021, rz: 0.017, e: 2.6 }, { y: 0.026, rx: 0.0238, rz: 0.0195, e: 2.9 },
        { y: 0.04, rx: 0.0215, rz: 0.0185, e: 2.8 }, { y: 0.048, rx: 0.014, rz: 0.012, e: 2.4 }, { y: 0.0505, rx: TIP },
      ], { seg: 14, region: A.get('hand'), color: mat.skin, ...(sx < 0 ? { s0: 1, s1: 0 } : {}) }), null, { crease: 0, hatch: 0 });
      b.add(loft([{ y: -0.002, rx: TIP }, { y: 0.004, rx: 0.0075 }, { y: 0.02, rx: 0.0072 }, { y: 0.03, rx: 0.006 }, { y: 0.034, rx: TIP }], { seg: 8, region: A.get('blank'), color: mat.skin }), null, { crease: 0, hatch: 0, xf: { p: [sx * 0.0215, 0.006, 0.003], r: [0, 0, -sx * 0.42] } });
    });
  }

  // ---- Beine / legs ----
  if (o.legs !== false) for (const side of [-1, 1] as const) {
    const Mp = xfMatrix({ p: pose.pelvis });
    const S = new THREE.Vector3(side * HIP_X, HIP_Y, 0).applyMatrix4(Mp);
    const Aa = V((side < 0 ? pose.footL : pose.footR) ?? [side * 0.05, ANKLE_Y, 0]);
    const fwd = new THREE.Vector3(0, 0, 1);
    const { joint: K, end: An } = ik(S, Aa, THIGH, SHIN, new THREE.Vector3(0, 0, 1));
    const flip = side < 0 ? { s0: 1, s1: 0 } : {};
    b.bone(S, K, fwd, (len) => {
      b.add(loft([
        { y: -0.03, rx: TIP }, { y: -0.018, rx: 0.026 }, { y: 0, rx: 0.0365, rz: 0.039 }, { y: 0.03, rx: 0.0375, rz: 0.04 }, { y: 0.08, rx: 0.034, rz: 0.035 },
        { y: len - 0.008, rx: 0.031 }, { y: len + 0.012, rx: 0.028 }, { y: len + 0.024, rx: TIP },
      ], { seg, region: A.get('thigh'), color: L.pants, ...flip }), null, { crease: 0 });
    });
    b.bone(K, An, fwd, (len) => {
      b.add(loft([
        { y: -0.02, rx: TIP }, { y: -0.008, rx: 0.025 }, { y: 0.01, rx: 0.031, rz: 0.0325 }, { y: 0.04, rx: 0.031, rz: 0.03, rzB: 0.0355 }, { y: len - 0.07, rx: 0.03, rzB: 0.033 },
        { y: len - 0.056, rx: 0.0345 }, { y: len - 0.047, rx: 0.0335, hard: true }, { y: len - 0.045, rx: 0.0295, hard: true, c: boot },
        { y: len - 0.01, rx: 0.027 }, { y: len + 0.014, rx: 0.0275 },
      ], { seg, region: A.get('shin'), color: L.pants, capLast: true, ...flip }), null, { gloss: 0 });
    });
    // Stiefel: Loft von der Ferse zur Spitze, Sohle und Absatz / boot: loft from heel to toe, sole and heel
    const yaw = (side < 0 ? pose.bootL : pose.bootR) ?? 0;
    const d = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const heel = new THREE.Vector3(An.x, FOOT_Y, An.z).addScaledVector(d, -0.031);
    b.bone(heel, heel.clone().addScaledVector(d, 0.102), new THREE.Vector3(0, 1, 0), () => {
      b.add(loft([
        { y: 0, rx: TIP, cz: -0.004 }, { y: 0.004, rx: 0.018, rz: 0.02, rzB: 0.019, e: 3 }, { y: 0.02, rx: 0.0235, rz: 0.03, rzB: 0.021, e: 3 },
        { y: 0.042, rx: 0.0255, rz: 0.03, rzB: 0.021, e: 3 }, { y: 0.062, rx: 0.027, rz: 0.019, rzB: 0.021, e: 3 }, { y: 0.084, rx: 0.0258, rz: 0.0155, rzB: 0.021, e: 3 },
        { y: 0.096, rx: 0.019, rz: 0.012, rzB: 0.019, e: 2.6 }, { y: 0.102, rx: TIP, cz: -0.004 },
      ], { seg: 16, region: A.get('boot'), color: boot, ...flip }), null, { crease: 0, gloss: 0.5 });
      b.add(softBox(0.058, 0.108, 0.008, 0.003), mat.ink, { xf: { p: [0, 0.051, -0.025] } });
      b.add(softBox(0.05, 0.032, 0.012, 0.003), mat.ink, { xf: { p: [0, 0.018, -0.0245] } });
    });
  }
}

// ---------- Gewehr / rifle ----------

/** Gewehr mit Bajonett: Griff im Ursprung, Lauf nach +z; Zeichnung aus der Seitenansicht / rifle with bayonet: grip at the origin, barrel along +z; drawing from the side view */
export function rifle(b: UvBuilder, A: AtlasLayout, grip: V3, dir: V3, scale = 1): void {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  const bounds = new THREE.Box3(new THREE.Vector3(-0.02, RIFLE.y0, RIFLE.z0), new THREE.Vector3(0.02, RIFLE.y1, RIFLE.z1));
  const side = (g: THREE.BufferGeometry, xf: Xf = {}) => projectBox(placed(g, xf), { px: A.get('rifle'), nx: A.get('rifle'), mirrorNx: true, all: A.get('blank'), bounds });
  b.group({ p: grip, r: [e.x, e.y, e.z], s: scale }, () => {
    // Kolben mit Pistolengriff als ein Profil / stock with pistol grip as one profile
    b.add(side(geo.profileZY([[-0.106, -0.034], [-0.106, 0.008], [-0.04, 0.0165], [0.004, 0.0165], [0.004, -0.012], [-0.012, -0.014], [-0.022, -0.034], [-0.034, -0.034], [-0.03, -0.014], [-0.06, -0.02]], 0.021)), mat.wood);
    b.add(side(softBox(0.023, 0.03, 0.118, 0.005), { p: [0, 0.004, 0.058] }), mat.dark, { gloss: 0.5 });
    b.add(side(softBox(0.017, 0.05, 0.027, 0.004), { p: [0, -0.034, 0.07], r: [0.22, 0, 0] }), mat.darkMid);
    b.add(side(softBox(0.025, 0.027, 0.105, 0.007), { p: [0, -0.001, 0.166] }), mat.woodLight);
    b.add(side(loft([{ y: 0.21, rx: 0.0072 }, { y: 0.305, rx: 0.0066 }], { seg: 10, region: A.get('blank'), capLast: true }), { r: [HALF_PI, 0, 0], p: [0, 0.006, 0] }), mat.metal, { gloss: 0.8, crease: 0 });
    b.add(side(softBox(0.016, 0.02, 0.022, 0.004), { p: [0, 0.006, 0.294] }), mat.dark);
    b.add(side(softBox(0.006, 0.016, 0.006, 0.001), { p: [0, 0.022, 0.29] }), mat.dark);
    // Bajonett / bayonet
    b.add(side(geo.taper(0.004, 0.015, 0.0015, 0.004, 0.088), { p: [0, -0.006, 0.345], r: [HALF_PI, 0, 0] }), mix(mat.metalLight, mat.white, 0.3), { gloss: 1 });
  });
}

// ---------- Schuetze / rifleman ----------

/** Schuetze der Fraktion, Gewehr quer vor der Brust / faction rifleman, rifle across the chest */
export function rifleman(f: FactionId, A: AtlasLayout, low = false): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const G: V3 = [0.042, 0.362, 0.092];
  const D: V3 = [-0.4, 0.26, 1];
  const d = V(D).normalize();
  const along = (t: number): V3 => [G[0] + d.x * t, G[1] + d.y * t, G[2] + d.z * t];
  // wie der bisherige Schuetze etwas nach hinten, damit das Gewehr die Groesse nicht begrenzt / moved back a little like the current rifleman so the rifle does not limit the size
  b.group({ p: [0.012, 0, -0.055] }, () => {
    figure(b, A, f, {
      pelvis: [0, 0.302, 0], twist: 0.42, head: [0.04, -0.3, 0],
      handL: along(0.132), handR: [G[0] + 0.004, G[1] - 0.012, G[2] - 0.012],
      footL: [-0.052, ANKLE_Y, 0.04], footR: [0.056, ANKLE_Y, -0.038], bootL: -0.12, bootR: 0.42,
    }, { seg: low ? 12 : 20 });
    // Gewehr etwas ueberzeichnet, damit es auf dem Brett lesbar bleibt / rifle slightly oversized so it stays readable on the board
    rifle(b, A, G, D, 1.14);
  });
  return b;
}
