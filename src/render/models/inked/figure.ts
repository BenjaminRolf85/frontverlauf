/**
 * Gezeichnete Figur: EIN Weg fuer alle Fusstruppen und Besatzungen (Ersatz fuer soldier() in soldiers.ts).
 * Inked figure: ONE path for all foot troops and crews (replacement for soldier() in soldiers.ts).
 *
 * Statt vieler kleiner Quader traegt die Figur ihre Einzelheiten gezeichnet (figurePaint.ts): Taschen, Naehte, Gesicht.
 * Die Koerper sind Lofts: ein Rumpf mit Schultern, Taille, Koppel und Rockschoss in einem Stueck, Glieder mit Profil
 * statt Rohren, ein Kopf mit Kinn und Nase, eine Faust statt des Faeustlings.
 * Proportionen: der Kopf misst rund ein Fuenftel der Hoehe (bisher ein Drittel). Die Figur wird in Baugroesse
 * modelliert (Becken bei 0.302) und von der Einheit mit FIG verkleinert, stehend ist sie dann 0.58 hoch.
 * Zubehoer der Fraktionen (Ruestung, Umhang, Generator, Kopfbedeckung) kommt vorerst ueber die Bruecke
 * UvBuilder.legacy() aus den bisherigen Funktionen: es wird mitgetuscht und schattiert, traegt aber keine Zeichnung.
 * Instead of many small boxes the figure carries its detail drawn (figurePaint.ts): pockets, seams, face. The bodies
 * are lofts: a torso with shoulders, waist, belt and tunic skirt in one piece, limbs with a profile instead of tubes,
 * a head with chin and nose, a fist instead of the mitten.
 * Proportions: the head is about a fifth of the height (a third before). The figure is modelled at build size (pelvis
 * at 0.302) and scaled down by the unit with FIG; standing it is then 0.58 tall.
 * Faction accessories (armour, cape, generator, headgear) come through the bridge UvBuilder.legacy() from the existing
 * functions for now: they get ink and shading but carry no drawing.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { faithArmour, faithCape, faithPauldron, faithTabard } from '../alveniaFaith';
import { gloveOf } from '../detailFigures';
import { headgear as legacyHeadgear } from '../headgear';
import { Builder, fine, geo, mix, shade, softBox, xfMatrix, type ColorLike, type V3, type Xf } from '../kit';
import { look, mat, type Look } from '../look';
import { TECH, techArmour, techDot, techPack } from '../velkarTech';
import { AtlasLayout, loft, loftAt, projectBox, ribbon, UvBuilder, type Ring } from './uvkit';

export type Detail = 0 | 1 | 2;
const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
/** geschlossene Spitze eines Lofts / closed tip of a loft */
const TIP = 1e-7;

// ---------- Masse / dimensions ----------

/** Massstab von der Baugroesse zur Einheit: stehend 0.58 hoch (Helmkuppe) / scale from build size to the unit: 0.58 tall standing (helmet top) */
export const FIG = 0.87;
/** Kopfmassstab gegen den Koerper / head scale against the body */
export const HEAD_SCALE = 1.3;
export const PELVIS_Y = 0.302;
const HIP_X = 0.036, HIP_Y = -0.008;
const SHOULDER_X = 0.077, SHOULDER_Y = 0.141;
const NECK_Y = 0.184;
export const THIGH = 0.135, SHIN = 0.125, UPPER = 0.095, FORE = 0.09;
/** Hoehe der Fussachse und des Knoechels ueber dem Boden / height of the foot axis and of the ankle above the ground */
const FOOT_Y = 0.029;
export const ANKLE_Y = 0.045;
/** Alter Oberkoerper (soldiers.ts) auf den neuen: dort sitzt das Zubehoer der Fraktionen / old torso (soldiers.ts) onto the new one: faction accessories sit there */
const TORSO_FIT: Xf = { p: [0, 0.03, 0], s: [0.98, 1.07, 1.02] };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/**
 * Alte Kopfbedeckung (headgear.ts, fuer den grossen Kopf gebaut) auf den neuen Kopf: Teile auf Gesichtshoehe (Brille,
 * Kopfhoerer) bleiben dort, Helm und Hut ruecken zusammen, hohe Aufsaetze (Antenne, Kranz) werden gestaucht, damit die
 * Figur unter dem Lebensbalken bleibt.
 * Old headgear (headgear.ts, built for the big head) onto the new head: parts at face level (glasses, headset) stay
 * there, helmet and hat shrink together, tall attachments (antenna, halo) are squashed so the figure stays below the
 * HP badge.
 */
function hatWarp(v: THREE.Vector3, brim = 0.74): void {
  const y = v.y > 0.15 ? 0.15 + (v.y - 0.15) * 0.18 : v.y;
  const t = Math.min(1, Math.max(0, (v.y - 0.066) / 0.028)), s = t * t * (3 - 2 * t);
  v.x *= lerp(0.82, brim, s);
  v.z = v.z * lerp(0.86, brim + 0.04, s) + 0.001;
  v.y = lerp(v.y + 0.004, 0.0336 + 0.72 * y, s);
}
/** Hut des Spions: die breite Krempe ruecken wir staerker zusammen / the spy's hat: the wide brim is pulled in more */
function fedoraWarp(v: THREE.Vector3): void {
  hatWarp(v, 0.6);
}
/** Ganzer alter Kopf (Fremdwesen, Kult, Roboter) auf die neue Kopfgroesse / whole old head (aliens, cult, robots) to the new head size */
function headWarp(v: THREE.Vector3): void {
  v.x *= 0.86;
  v.y = v.y * 1.03 + 0.006;
  v.z = v.z * 0.92 + 0.001;
}

/** Rundungssegmente [Glieder, Rumpf, Kopf] je Detailstufe, niedrige / hohe Qualitaet / radial segments [limbs, torso, head] per detail level, low / high quality */
const SEG_LOW: [number, number, number][] = [[6, 8, 8], [6, 8, 10], [8, 10, 12]];
const SEG_HIGH: [number, number, number][] = [[10, 12, 14], [14, 16, 20], [20, 24, 28]];

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
export function torsoRings(L: Look, jacket: ColorLike = L.jacket, bare = false): Ring[] {
  const skirt = bare ? L.pants : jacket;
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
    { y: 0.004, rx: 0.068, rz: 0.048, rzB: 0.045, e: 2.4, hard: true, c: skirt },
    { y: -0.024, rx: 0.073, rz: 0.052, rzB: 0.05, e: 2.5, hard: true },
    { y: -0.025, rx: 0.067, rz: 0.047, rzB: 0.046, e: 2.4, hard: true, c: L.pants },
    { y: -0.045, rx: 0.05, rz: 0.04, e: 2.2 },
    { y: -0.056, rx: TIP },
  ];
}
/** Mantel oder Kutte: Rumpf bis zum Saum bei hem (Beckenkoordinaten), Guertel in dark / coat or robe: torso down to the hem at hem (pelvis coordinates), belt in dark */
export function coatRings(c: ColorLike, dark: ColorLike, hem: number): Ring[] {
  return [
    { y: 0.176, rx: 0.023, rz: 0.023, c },
    { y: 0.163, rx: 0.043, rz: 0.034, e: 2.2 },
    { y: 0.148, rx: 0.079, rz: 0.046, rzB: 0.045, e: 2.7 },
    { y: 0.122, rx: 0.085, rz: 0.055, rzB: 0.049, e: 2.5 },
    { y: 0.09, rx: 0.08, rz: 0.056, rzB: 0.047, e: 2.4 },
    { y: 0.05, rx: 0.07, rz: 0.05, rzB: 0.044, e: 2.4, hard: true },
    { y: 0.049, rx: 0.0735, rz: 0.053, rzB: 0.047, e: 2.4, hard: true, c: dark },
    { y: 0.03, rx: 0.0735, rz: 0.053, rzB: 0.047, e: 2.4, hard: true },
    { y: 0.029, rx: 0.071, rz: 0.05, rzB: 0.046, e: 2.4, hard: true, c },
    { y: hem * 0.5, rx: 0.084, rz: 0.062, rzB: 0.062, e: 2.5 },
    { y: hem, rx: 0.094, rz: 0.07, rzB: 0.072, e: 2.5, hard: true },
    { y: hem - 0.001, rx: 0.08, rz: 0.058, rzB: 0.06, e: 2.4, hard: true, c: shade(c, 0.45) },
    { y: hem + 0.012, rx: TIP },
  ];
}
/** Grenzen der Mantelzelle in Beckenkoordinaten (fuer die Malerei) / limits of the coat cell in pelvis coordinates (for the painting) */
export const COAT = { top: 0.176, hem: -0.128 };

/** Grenzen des Gewehrs in seiner Seitenansicht (z nach vorn, y nach oben) / bounds of the rifle in its side view (z forward, y up) */
export const RIFLE = { z0: -0.112, z1: 0.392, y0: -0.064, y1: 0.03 };

// ---------- Haltung / pose ----------

/** Haltung wie Pose in soldiers.ts, in Baugroesse der neuen Figur / pose like Pose in soldiers.ts, at the new figure's build size */
export interface FigurePose {
  /** Beckenmitte / pelvis centre */
  pelvis: V3;
  /** Drehung des ganzen Koerpers (z. B. liegend) / whole-body rotation (e.g. prone) */
  body?: V3;
  /** Oberkoerper-Drehung gegen das Becken / torso rotation against the pelvis */
  twist?: V3;
  head?: V3;
  handL: V3;
  handR: V3;
  /** Knoechel / ankles */
  footL: V3;
  footR: V3;
  bootL?: V3;
  bootR?: V3;
  kneePoleL?: V3;
  kneePoleR?: V3;
  elbowPoleL?: V3;
  elbowPoleR?: V3;
}

/** Optionen wie SoldierOpts in soldiers.ts / options like SoldierOpts in soldiers.ts */
export interface FigureOpts {
  /** 2 = Einzelfigur, 1 = Trupp, 0 = Besatzung / 2 = hero figure, 1 = team, 0 = crew */
  detail?: Detail;
  pack?: 'pack' | 'medbag' | 'pioneer' | 'none';
  armband?: boolean;
  coat?: boolean;
  hat?: 'fedora';
  seed?: number;
  /** Kutte bis zu den Knoecheln (Kult) / ankle-length robe (cult) */
  robe?: boolean;
  /** Beine weglassen (Besatzung in Luken) / omit legs (crew in hatches) */
  noLegs?: boolean;
  coatColor?: ColorLike;
  /** eigener Kopf statt der Kopfbedeckung der Fraktion (Kopfkoordinaten, Kinn bei y = 0) / own head instead of the faction's headgear (head coordinates, chin at y = 0) */
  head?: (b: UvBuilder, A: AtlasLayout, L: Look, d: Detail) => void;
  headScale?: number;
  /** eigene Uniformfarben statt der Fraktionsoptik / own uniform colours instead of the faction look */
  colors?: Partial<Pick<Look, 'jacket' | 'pants' | 'gear'>>;
  /** ohne Fraktionszubehoer / without faction extras */
  plain?: boolean;
  /** nackter Oberkoerper (Berserker) / bare upper body (berserker) */
  bare?: boolean;
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

/** Stehend, Arme haengen / standing, arms hanging */
export function standPose(hands?: [V3, V3]): FigurePose {
  return {
    pelvis: [0, PELVIS_Y, 0],
    handL: hands?.[0] ?? [-0.112, 0.262, 0.02], handR: hands?.[1] ?? [0.112, 0.262, 0.02],
    footL: [-0.05, ANKLE_Y, 0.012], footR: [0.05, ANKLE_Y, -0.012],
  };
}
/** Kniend: linkes Bein aufgestellt, rechtes Knie am Boden / kneeling: left leg up, right knee on the ground */
export function kneelPose(hands: [V3, V3]): FigurePose {
  return {
    pelvis: [0, 0.2, 0], handL: hands[0], handR: hands[1],
    footL: [-0.052, ANKLE_Y, 0.15], footR: [0.052, 0.082, -0.175],
    kneePoleL: [0, 0.4, 1], kneePoleR: [0, -1, 0.5], bootR: [0.95, 0, 0],
  };
}
/** Sitzend (Fahrzeug) / seated (vehicle) */
export function seatPose(hands: [V3, V3]): FigurePose {
  return {
    pelvis: [0, 0.06, 0], handL: hands[0], handR: hands[1],
    footL: [-0.05, -0.11, 0.2], footR: [0.05, -0.11, 0.2], kneePoleL: [0, 1, 0.3], kneePoleR: [0, 1, 0.3],
  };
}

/** Teil erst an seinen Platz bringen, dann projizieren (gemeinsame Grenzen) / move a part into place first, then project (shared bounds) */
function placed(g: THREE.BufferGeometry, xf: Xf): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (g.userData.smooth) out.userData.smooth = true;
  out.applyMatrix4(xfMatrix(xf));
  return out;
}

// ---------- Kopf / head ----------

/** Menschlicher Kopf mit gezeichnetem Gesicht, Nase, Ohren; Ursprung am Kinn / human head with drawn face, nose, ears; origin at the chin */
export function bareHead(b: UvBuilder, A: AtlasLayout, seg: number, cell = 'head', skinC: ColorLike = mat.skin): void {
  const skin = { crease: 0, hatch: 0 };
  b.add(loft(HEAD, { seg, region: A.get(cell), color: skinC }), null, skin);
  b.bone(new THREE.Vector3(0, FACE.eye + 0.006, 0.0405), new THREE.Vector3(0, FACE.nose + 0.001, 0.0525), new THREE.Vector3(0, -0.4, 1), () => {
    b.add(loft([
      { y: -0.004, rx: TIP }, { y: 0, rx: 0.0036, rz: 0.0034 }, { y: 0.011, rx: 0.005, rz: 0.005 }, { y: 0.02, rx: 0.0078, rz: 0.007, e: 2.3 },
      { y: 0.0255, rx: 0.0074, rz: 0.0066, e: 2.3 }, { y: 0.0285, rx: TIP, cz: -0.003 },
    ], { seg: Math.max(5, Math.round(seg / 3)), region: A.get('nose'), color: skinC }), null, skin);
  });
  if (seg >= 12 && cell === 'head') b.mirrorX(() => b.bone(new THREE.Vector3(0.0395, 0.036, -0.008), new THREE.Vector3(0.0415, 0.062, -0.012), new THREE.Vector3(1, 0, -0.5), () => {
    b.add(loft([
      { y: -0.001, rx: TIP }, { y: 0.004, rx: 0.006, rz: 0.0035 }, { y: 0.014, rx: 0.0095, rz: 0.0048 }, { y: 0.022, rx: 0.009, rz: 0.0045 }, { y: 0.027, rx: TIP },
    ], { seg: seg >= 20 ? 10 : 6, region: A.get('ear'), color: skinC }), null, skin);
  }));
}

/** Kopf samt Kopfbedeckung der Fraktion (Kopfkoordinaten, Kinn bei y = 0, Blick +z) / head with the faction's headgear (head coordinates, chin at y = 0, facing +z) */
export function factionHead(b: UvBuilder, A: AtlasLayout, f: FactionId, L: Look, d: Detail, seg: number, fedora: boolean, seed: number): void {
  const whole = f === 'zyrr' || f === 'vesper' || f === 'nexus';
  const bridge = (bare: boolean) => b.legacy((k) => legacyHeadgear(k, f, L, d, fedora, seed, bare), { map: whole ? headWarp : fedora ? fedoraWarp : hatWarp });
  // Fremdwesen, Kult, Roboter: eigener Kopf aus dem alten Baukasten / aliens, cult, robots: their own head from the old toolkit
  if (whole) { bridge(false); return; }
  if (fedora) { bareHead(b, A, seg); bridge(true); return; }
  switch (f) {
    case 'korvat':
      bareHead(b, A, seg);
      // Helm leicht in den Nacken geschoben, damit das Gesicht frei bleibt / helmet pushed back slightly so the face stays open
      b.group({ p: [0, 0.004, -0.004], r: [-0.1, 0, 0] }, () => b.add(loft(helmetRings(L), { seg, region: A.get('helmet:korvat'), arc: true }), null));
      break;
    case 'dravon':
      // Sturmhaube: derselbe Kopf in Schwarz mit gezeichnetem Augenausschnitt, flaches Barett / balaclava: the same head in black with a drawn eye opening, flat beret
      bareHead(b, A, seg, 'head:dravon', L.helmet);
      b.add(loft([{ y: 0.114, rx: TIP }, { y: 0.112, rx: 0.026 }, { y: 0.104, rx: 0.04, rzB: 0.044 }, { y: 0.096, rx: 0.041, rzB: 0.046, hard: true }, { y: 0.094, rx: 0.036 }], { seg, region: A.get('blank'), color: shade(L.helmet, 1.5) }), null, { xf: { p: [0.004, 0.001, -0.002], r: [0.06, 0, -0.14] } });
      break;
    default:
      // Alvenia, Meridon, Velkar: gezeichnetes Gesicht, Kopfbedeckung ueber die Bruecke / drawn face, headgear through the bridge
      bareHead(b, A, seg);
      bridge(true);
  }
}

// ---------- Figur / figure ----------

/** Figur aufbauen (Fuesse auf y = 0, Blick +z, Baugroesse) / build the figure (feet at y = 0, facing +z, build size) */
export function figure(b: UvBuilder, A: AtlasLayout, f: FactionId, pose: FigurePose, o: FigureOpts = {}): void {
  const L: Look = o.colors ? { ...look(f), ...o.colors } : look(f);
  const fx: FactionId | null = o.plain ? null : f;
  const d: Detail = o.detail ?? 2;
  const [seg, segT, segH] = (fine() ? SEG_HIGH : SEG_LOW)[d];
  const rich = d === 2 || (d === 1 && fine());
  const Mp = xfMatrix({ p: pose.pelvis, r: pose.body });
  const Mt = Mp.clone().multiply(xfMatrix({ r: pose.twist }));
  const coatC = o.coatColor ?? L.primary;
  const long = !!o.coat || !!o.robe;
  const jacket: ColorLike = o.bare ? mat.skin : o.coat ? coatC : L.jacket;
  const sleeve = jacket;
  const boot = mat.dark;
  const T = long ? coatRings(o.coat ? coatC : L.jacket, o.coat ? L.primaryDark : shade(L.jacket, 0.7), o.robe ? -0.215 : COAT.hem) : torsoRings(L, jacket, !!o.bare);
  const skinFx = { crease: 0, hatch: 0 };

  b.group({ p: pose.pelvis, r: pose.body }, () => {
    // Alvenia: Wappenrock am Becken / Alvenia: tabard at the pelvis
    if (fx === 'alvenia' && !long && !o.noLegs) b.legacy((k) => faithTabard(k, d));
    b.group({ r: pose.twist }, () => {
      b.add(loft(T, { seg: segT, region: A.get(long ? 'coat' : o.bare ? 'blank' : 'torso') }), null, o.bare ? skinFx : {});
      if (!o.bare) {
        // Stehkragen: offen, die Kante zeichnet die Tusche / stand collar: open, the ink draws its edge
        b.add(loft([{ y: 0.189, rx: 0.0285, rz: 0.029, cz: 0.001 }, { y: 0.169, rx: 0.036, rz: 0.035, cz: 0.001 }], { seg, region: A.get('blank'), color: shade(jacket, 0.82) }), null);
      }
      b.add(loft([{ y: 0.2, rx: 0.0205 }, { y: 0.166, rx: 0.0225 }], { seg: Math.max(6, seg - 4), region: A.get('blank'), color: shade(mat.skin, 0.94) }), null, skinFx);
      if (fx === 'korvat' && !long && !o.bare) {
        // Schaerpe in Fraktionsfarbe als Auflage: Farbe aus der Vertexfarbe, Zeichnung aus dem Atlas
        // sash in the faction colour as a decal: colour from the vertex colour, drawing from the atlas
        const path = [];
        const n = fine() ? 12 : 6;
        for (let i = 0; i <= n; i++) { const u = i / n; path.push(loftAt(T, 0.655 - u * 0.33, 0.15 - u * 0.118)); }
        b.add(ribbon(path, 0.0115, A.get('strap'), 0.0022), L.secondary);
      }
      // Zubehoer der Fraktionen ueber die Bruecke (alter Oberkoerperrahmen) / faction accessories through the bridge (old torso frame)
      const techGen = fx === 'velkar' && !long && !o.noLegs && (o.pack === undefined || o.pack === 'pack');
      const cape = fx === 'alvenia' && !long && !o.noLegs && (o.pack === undefined || o.pack === 'pack');
      b.group(TORSO_FIT, () => b.legacy((k) => {
        if (o.bare || long) return;
        if (fx === 'meridon') {
          k.add(d >= 1 ? geo.ctaper(0.156, 0.098, 0.176, 0.108, 0.08, 0.014) : geo.taper(0.156, 0.098, 0.176, 0.108, 0.08), L.secondary, { p: [0, 0.06, 0] });
          if (d >= 1) for (const s of [-1, 1]) k.box(0.034, 0.03, 0.012, shade(L.secondary, 0.75), [s * 0.04, 0.045, 0.056]);
        }
        if (fx === 'dravon') {
          k.add(geo.taper(0.1, 0.012, 0.08, 0.012, 0.05), L.secondary, { p: [0, 0.07, 0.053] });
          k.add(geo.taper(0.09, 0.01, 0.07, 0.01, 0.04), shade(L.jacket, 0.8), { p: [0, 0.07, 0.057] });
        }
        if (fx === 'alvenia') faithArmour(k, d);
        if (fx === 'velkar') techArmour(k, d);
        if (techGen) techPack(k, d);
        else if (cape) faithCape(k, d);
      }));
      if (!techGen && !cape) pack(b, A, L, fx, d, o.pack ?? 'none');
      // Koppeltaschen / belt pouches
      if (rich && !long && !o.bare) for (const s of [-1, 1]) b.add(projectBox(softBox(0.031, 0.036, 0.017, 0.005), { pz: A.get('pouch'), all: A.get('blank') }), shade(L.gear, 0.82), { xf: { p: [s * 0.043, 0.012, 0.052], r: [0, s * 0.25, 0] } });
      b.group({ p: [0, NECK_Y, 0.003], r: pose.head, s: o.headScale ?? HEAD_SCALE }, () => {
        if (o.head) o.head(b, A, L, d); else factionHead(b, A, f, L, d, segH, o.hat === 'fedora', o.seed ?? 1);
      });
    });
  });

  // ---- Arme / arms ----
  const glove = o.bare ? null : gloveOf(fx);
  for (const side of [-1, 1] as const) {
    const S = new THREE.Vector3(side * SHOULDER_X, SHOULDER_Y, 0).applyMatrix4(Mt);
    const out = new THREE.Vector3(side, 0, 0).transformDirection(Mt);
    const target = V(side < 0 ? pose.handL : pose.handR);
    const pole = V((side < 0 ? pose.elbowPoleL : pose.elbowPoleR) ?? [side * 0.8, -0.6, -0.35]);
    const { joint: E, end: H } = ik(S, target, UPPER, FORE, pole);
    const flip = side < 0 ? { s0: 1, s1: 0 } : {};
    const band = o.armband && side < 0;
    b.bone(S, E, out, (len) => {
      b.add(loft([
        { y: -0.026, rx: TIP, c: sleeve }, { y: -0.018, rx: 0.018 }, { y: -0.006, rx: 0.0275 }, { y: 0.014, rx: 0.031, rz: 0.0315 },
        ...(band ? [{ y: 0.03, rx: 0.0305, c: L.secondary, hard: true }, { y: 0.052, rx: 0.0285, c: sleeve, hard: true }] : [{ y: 0.048, rx: 0.0275 }]),
        { y: len - 0.012, rx: 0.0255 }, { y: len + 0.01, rx: 0.0235 }, { y: len + 0.022, rx: TIP },
      ], { seg, region: A.get(o.bare ? 'blank' : 'upperArm'), ...flip }), null, o.bare ? skinFx : { crease: band ? 0.5 : 0 });
      // Schulterstuecke der Fraktionen / faction shoulder pieces
      if (!long && !o.bare && (fx === 'dravon' || (d >= 1 && (fx === 'alvenia' || fx === 'velkar')))) b.legacy((k) => {
        if (fx === 'dravon') k.box(0.064, 0.016, 0.064, L.secondary, [0, 0.004, 0]);
        if (fx === 'alvenia') faithPauldron(k, side, d);
        if (fx === 'velkar') {
          k.add(geo.rtaper(0.07, 0.07, 0.06, 0.06, 0.03, 0.008), TECH.shell, { p: [0, 0.012, 0] });
          if (d === 2) techDot(k, [side * 0.034, 0.012, 0.02], 0.007);
        }
      });
    });
    b.bone(E, H, out, (len) => {
      const cuff = o.bare ? [] : [{ y: len - 0.026, rx: 0.0248, hard: true, c: shade(sleeve, 0.8) }, { y: len - 0.007, rx: 0.0248, hard: true }];
      b.add(loft([
        { y: -0.02, rx: TIP, c: sleeve }, { y: -0.01, rx: 0.02 }, { y: 0.006, rx: 0.0255 }, { y: 0.036, rx: 0.0245 }, { y: len - 0.027, rx: 0.022, hard: true },
        ...cuff, { y: len - 0.006, rx: 0.017, hard: true },
      ], { seg, region: A.get(o.bare ? 'blank' : 'foreArm'), capLast: true, ...flip }), null, o.bare ? skinFx : {});
    });
    // Faust: Handruecken nach aussen, Daumen oben / fist: back of the hand outward, thumb on top
    const dir = H.clone().sub(E).normalize();
    const z = out.clone().addScaledVector(dir, -out.dot(dir)).normalize();
    const sx = new THREE.Vector3().crossVectors(dir, z).y >= 0 ? 1 : -1;
    const hand = glove ?? mat.skin;
    b.bone(H, H.clone().addScaledVector(dir, 0.05), out, () => {
      b.add(loft([
        { y: -0.008, rx: 0.0145, rz: 0.013 }, { y: 0.006, rx: 0.021, rz: 0.017, e: 2.6 }, { y: 0.026, rx: 0.0238, rz: 0.0195, e: 2.9 },
        { y: 0.04, rx: 0.0215, rz: 0.0185, e: 2.8 }, { y: 0.048, rx: 0.014, rz: 0.012, e: 2.4 }, { y: 0.0505, rx: TIP },
      ], { seg: Math.max(6, Math.round(seg * 0.7)), region: A.get('hand'), color: hand, ...(sx < 0 ? { s0: 1, s1: 0 } : {}) }), null, { crease: 0, hatch: glove ? 1 : 0 });
      if (d >= 1) b.add(loft([{ y: -0.002, rx: TIP }, { y: 0.004, rx: 0.0075 }, { y: 0.02, rx: 0.0072 }, { y: 0.03, rx: 0.006 }, { y: 0.034, rx: TIP }], { seg: fine() ? 8 : 5, region: A.get('blank'), color: hand }), null, { crease: 0, hatch: glove ? 1 : 0, xf: { p: [sx * 0.0215, 0.006, 0.003], r: [0, 0, -sx * 0.42] } });
    });
  }

  // ---- Beine / legs ----
  if (!o.noLegs) for (const side of [-1, 1] as const) {
    const S = new THREE.Vector3(side * HIP_X, HIP_Y, 0).applyMatrix4(Mp);
    const Aa = V(side < 0 ? pose.footL : pose.footR);
    const pole = V((side < 0 ? pose.kneePoleL : pose.kneePoleR) ?? [0, 0, 1]);
    const { joint: K, end: An } = ik(S, Aa, THIGH, SHIN, pole);
    const flip = side < 0 ? { s0: 1, s1: 0 } : {};
    b.bone(S, K, pole, (len) => {
      b.add(loft([
        { y: -0.03, rx: TIP }, { y: -0.018, rx: 0.026 }, { y: 0, rx: 0.0365, rz: 0.039 }, { y: 0.03, rx: 0.0375, rz: 0.04 }, { y: 0.08, rx: 0.034, rz: 0.035 },
        { y: len - 0.008, rx: 0.031 }, { y: len + 0.012, rx: 0.028 }, { y: len + 0.024, rx: TIP },
      ], { seg, region: A.get('thigh'), color: L.pants, ...flip }), null, { crease: 0 });
    });
    b.bone(K, An, pole, (len) => {
      b.add(loft([
        { y: -0.02, rx: TIP }, { y: -0.008, rx: 0.025 }, { y: 0.01, rx: 0.031, rz: 0.0325 }, { y: 0.04, rx: 0.031, rz: 0.03, rzB: 0.0355 }, { y: len - 0.07, rx: 0.03, rzB: 0.033 },
        { y: len - 0.056, rx: 0.0345 }, { y: len - 0.047, rx: 0.0335, hard: true }, { y: len - 0.045, rx: 0.0295, hard: true, c: boot },
        { y: len - 0.01, rx: 0.027 }, { y: len + 0.014, rx: 0.0275 },
      ], { seg, region: A.get('shin'), color: L.pants, capLast: true, ...flip }), null);
    });
    // Stiefel: Loft von der Ferse zur Spitze, Sohle und Absatz; gedreht wie bootL / bootR in soldiers.ts
    // boot: loft from heel to toe, sole and heel; rotated like bootL / bootR in soldiers.ts
    const rot = (side < 0 ? pose.bootL : pose.bootR) ?? [0, 0, 0];
    b.group({ p: [An.x, An.y, An.z], r: rot }, () => b.bone(new THREE.Vector3(0, FOOT_Y - ANKLE_Y, -0.031), new THREE.Vector3(0, FOOT_Y - ANKLE_Y, 0.071), new THREE.Vector3(0, 1, 0), () => {
      b.add(loft([
        { y: 0, rx: TIP, cz: -0.004 }, { y: 0.004, rx: 0.018, rz: 0.02, rzB: 0.019, e: 3 }, { y: 0.02, rx: 0.0235, rz: 0.03, rzB: 0.021, e: 3 },
        { y: 0.042, rx: 0.0255, rz: 0.03, rzB: 0.021, e: 3 }, { y: 0.062, rx: 0.027, rz: 0.019, rzB: 0.021, e: 3 }, { y: 0.084, rx: 0.0258, rz: 0.0155, rzB: 0.021, e: 3 },
        { y: 0.096, rx: 0.019, rz: 0.012, rzB: 0.019, e: 2.6 }, { y: 0.102, rx: TIP, cz: -0.004 },
      ], { seg: Math.max(6, Math.round(seg * 0.8)), region: A.get('boot'), color: boot, ...flip }), null, { crease: 0, gloss: 0.5 });
      b.add(softBox(0.058, 0.108, 0.008, 0.003), mat.ink, { xf: { p: [0, 0.051, -0.025] } });
      if (rich) b.add(softBox(0.05, 0.032, 0.012, 0.003), mat.ink, { xf: { p: [0, 0.018, -0.0245] } });
    }));
    if (fx === 'velkar' && d >= 1) b.group({ p: [An.x, An.y, An.z], r: rot }, () => b.legacy((k) => k.box(0.066, 0.012, 0.03, mat.snow, [0, -0.008, -0.012])));
  }
}

/** Gepaeck auf dem Ruecken (Oberkoerperrahmen) / pack on the back (torso frame) */
function pack(b: UvBuilder, A: AtlasLayout, L: Look, fx: FactionId | null, d: Detail, kind: 'pack' | 'medbag' | 'pioneer' | 'none'): void {
  if (kind === 'none') return;
  const hi = fine();
  if (kind === 'pack' || kind === 'pioneer') {
    const big = kind === 'pioneer' ? 1.3 : 1;
    // Tornister, Deckenrolle, Feldflasche / pack, bedroll, canteen
    b.add(projectBox(softBox(0.118 * big, 0.106 * big, 0.052 * big, 0.013, hi && d === 2 ? 1 : 0), { nz: A.get('packBack'), px: A.get('packSide'), nx: A.get('packSide'), mirrorNx: true, py: A.get('packTop'), all: A.get('blank') }), L.gear, { xf: { p: [0, 0.093 + (big - 1) * 0.04, -0.077 - (big - 1) * 0.02] } });
    if (kind === 'pack') b.add(loft([{ y: 0.071, rx: 0.0215, hard: true }, { y: 0.064, rx: 0.0235 }, { y: -0.064, rx: 0.0235 }, { y: -0.071, rx: 0.0215, hard: true }], { seg: hi ? 14 : 8, region: A.get('bedroll'), capFirst: A.get('rollEnd'), capLast: A.get('rollEnd') }), L.secondary, { xf: { p: [0, 0.163, -0.074], r: [0, 0, HALF_PI] } });
    if (kind === 'pack' && d === 2 && hi) b.add(loft([{ y: 0.03, rx: TIP }, { y: 0.027, rx: 0.008, rz: 0.008 }, { y: 0.02, rx: 0.0085, rz: 0.0085, hard: true }, { y: 0.019, rx: 0.019, rz: 0.012 }, { y: 0, rx: 0.0235, rz: 0.0145 }, { y: -0.02, rx: 0.02, rz: 0.012 }, { y: -0.026, rx: TIP }], { seg: 12, region: A.get('canteen') }), shade(L.gear, 1.25), { xf: { p: [-0.058, -0.012, -0.047], r: [0, 0.5, 0] } });
    if (kind === 'pioneer') b.group(TORSO_FIT, () => b.legacy((k) => {
      // Kanister, Seilrolle, Plane und Spitzhacke am schweren Gepaeck / jerrycan, rope coil, tarp and pickaxe on the heavy pack
      if (d >= 1) {
        k.add(geo.cbox(0.036, 0.08, 0.06, 0.008), L.primaryDark, { p: [0.098, 0.05, -0.092] });
        k.box(0.03, 0.012, 0.02, mat.dark, [0.098, 0.096, -0.08]);
        k.add(geo.torus(0.034, 0.011, 4, 12), mat.sand, { p: [-0.095, 0.06, -0.09], r: [0, HALF_PI, 0] });
        k.cyl(0.026, 0.026, 0.17, 10, shade(L.gear, 1.2), [0, 0.135, -0.09], [0, 0, HALF_PI]);
      }
      k.tube([-0.07, -0.02, -0.118], [0.08, 0.17, -0.118], 0.007, 6, mat.wood);
      k.group({ p: [0.08, 0.17, -0.118], r: [0, 0, 0.67] }, () => {
        k.add(geo.taper(0.018, 0.016, 0.006, 0.01, 0.07), mat.metalLight, { p: [0.035, 0, 0], r: [0, 0, -HALF_PI] });
        k.add(geo.taper(0.018, 0.016, 0.006, 0.01, 0.06), mat.metalLight, { p: [-0.03, 0, 0], r: [0, 0, HALF_PI] });
        k.box(0.02, 0.022, 0.02, mat.metal, [0, 0, 0]);
      });
    }));
    return;
  }
  // Sanitaetskraxe: hoch ueber den Helm, gruenes Feld mit weissem Kreuz (kein Schutzzeichen); Velkar: niedriger Rucksack
  // medical frame pack: rising above the helmet, green panel with a white cross (no protected emblem); Velkar: low pack
  b.group(TORSO_FIT, () => b.legacy((k) => {
    const tall = fx !== 'velkar';
    const ph = tall ? 0.31 : 0.2, py = tall ? 0.175 : 0.085;
    const part = (w: number, h: number, dd: number, ch: number) => (d >= 1 ? geo.cbox(w, h, dd, Math.min(w, dd) * ch) : geo.box(w, h, dd));
    k.add(part(0.2, ph, 0.11, 0.18), mat.white, { p: [0, py, -0.11] });
    k.add(part(0.206, 0.04, 0.116, 0.25), L.primary, { p: [0, 0.11, -0.11] });
    if (tall) {
      const cross = (pp: V3, ry: number, s: number) => k.group({ p: pp, r: [0, ry, 0] }, () => {
        k.add(geo.box(0.13 * s, 0.13 * s, 0.006), mat.green, {});
        k.add(geo.box(0.084 * s, 0.026 * s, 0.009), mat.white, {});
        k.add(geo.box(0.026 * s, 0.084 * s, 0.009), mat.white, {});
      });
      cross([0, 0.235, -0.1635], Math.PI, 1);
      if (d >= 1) for (const s of [-1, 1]) cross([s * 0.1005, 0.235, -0.11], s * HALF_PI, 0.75);
      k.add(part(0.21, 0.03, 0.118, 0.3), shade(mat.white, 0.88), { p: [0, 0.325, -0.11] });
      if (d >= 1) for (const s of [-1, 1]) k.box(0.012, 0.31, 0.012, L.gear, [s * 0.098, 0.165, -0.052]);
    }
    if (d >= 1) {
      for (const s of [-1, 1]) k.add(part(0.04, 0.1, 0.08, 0.2), shade(mat.white, 0.92), { p: [s * 0.118, 0.05, -0.105] });
      if (!tall) k.add(part(0.17, 0.035, 0.1, 0.25), shade(mat.white, 0.88), { p: [0, 0.2, -0.11] });
      k.box(0.12, 0.05, 0.012, shade(mat.white, 0.85), [0, 0.04, -0.17]);
    }
  }));
}

// ---------- Gewehr / rifle ----------

/** Optionen wie RifleOpts in soldiers.ts (ohne len / back: das Gewehr skaliert als Ganzes) / options like RifleOpts in soldiers.ts (no len / back: the rifle scales as a whole) */
export interface RifleOpts {
  /** Massstab des ganzen Gewehrs / scale of the whole rifle */
  scale?: number;
  scope?: boolean;
  /** Zweibein: Laenge der Beine / bipod: leg length */
  bipod?: number;
  bayonet?: boolean;
  drum?: boolean;
  detail?: Detail;
}

/** Gewehr: Griff im Ursprung, Lauf nach +z; Zeichnung aus der Seitenansicht / rifle: grip at the origin, barrel along +z; drawing from the side view */
export function rifle(b: UvBuilder, A: AtlasLayout, grip: V3, dir: V3, o: RifleOpts = {}): void {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  const d = o.detail ?? 2;
  const bounds = new THREE.Box3(new THREE.Vector3(-0.02, RIFLE.y0, RIFLE.z0), new THREE.Vector3(0.02, RIFLE.y1, RIFLE.z1));
  const side = (g: THREE.BufferGeometry, xf: Xf = {}) => projectBox(placed(g, xf), { px: A.get('rifle'), nx: A.get('rifle'), mirrorNx: true, all: A.get('blank'), bounds });
  b.group({ p: grip, r: [e.x, e.y, e.z], s: o.scale ?? 1 }, () => {
    // Kolben mit Pistolengriff als ein Profil / stock with pistol grip as one profile
    b.add(side(geo.profileZY([[-0.106, -0.034], [-0.106, 0.008], [-0.04, 0.0165], [0.004, 0.0165], [0.004, -0.012], [-0.012, -0.014], [-0.022, -0.034], [-0.034, -0.034], [-0.03, -0.014], [-0.06, -0.02]], 0.021)), mat.wood);
    b.add(side(softBox(0.023, 0.03, 0.118, 0.005), { p: [0, 0.004, 0.058] }), mat.dark, { gloss: 0.5 });
    if (!o.drum) b.add(side(softBox(0.017, 0.05, 0.027, 0.004), { p: [0, -0.034, 0.07], r: [0.22, 0, 0] }), mat.darkMid);
    b.add(side(softBox(0.025, 0.027, 0.105, 0.007), { p: [0, -0.001, 0.166] }), mat.woodLight);
    b.add(side(loft([{ y: 0.21, rx: 0.0072 }, { y: 0.305, rx: 0.0066 }], { seg: d === 2 && fine() ? 10 : 6, region: A.get('blank'), capLast: true }), { r: [HALF_PI, 0, 0], p: [0, 0.006, 0] }), mat.metal, { gloss: 0.8, crease: 0 });
    b.add(side(softBox(0.016, 0.02, 0.022, 0.004), { p: [0, 0.006, 0.294] }), mat.dark);
    if (d >= 1) b.add(side(softBox(0.006, 0.016, 0.006, 0.001), { p: [0, 0.022, 0.29] }), mat.dark);
    if (o.bayonet !== false) b.add(side(geo.taper(0.004, 0.015, 0.0015, 0.004, 0.088), { p: [0, -0.006, 0.345], r: [HALF_PI, 0, 0] }), mix(mat.metalLight, mat.white, 0.3), { gloss: 1 });
    // Zielfernrohr, Trommel, Zweibein ohne eigene Zeichnung / scope, drum, bipod without their own drawing
    if (o.scope) {
      b.add(loft([{ y: 0.062, rx: 0.0125, hard: true }, { y: 0.05, rx: 0.0095, hard: true }, { y: -0.04, rx: 0.0095, hard: true }, { y: -0.052, rx: 0.0115, hard: true }], { seg: fine() ? 12 : 8, region: A.get('blank'), capLast: true, color: mat.ink }), null, { xf: { p: [0, 0.036, 0.06], r: [HALF_PI, 0, 0] }, gloss: 0.5 });
      b.add(loft([{ y: 0.0625, rx: 0.0118 }, { y: 0.064, rx: TIP }], { seg: fine() ? 12 : 8, region: A.get('blank'), color: mat.glass }), null, { xf: { p: [0, 0.036, 0.06], r: [HALF_PI, 0, 0] }, gloss: 1, crease: 0 });
      for (const z of [0.035, 0.085]) b.add(softBox(0.008, 0.016, 0.01, 0.002), mat.dark, { xf: { p: [0, 0.024, z] } });
    }
    if (o.drum) b.add(loft([{ y: 0.016, rx: 0.03, hard: true }, { y: 0.016, rx: 0.036, hard: true }, { y: -0.016, rx: 0.036, hard: true }, { y: -0.016, rx: 0.03, hard: true }], { seg: fine() ? 14 : 8, region: A.get('blank'), capFirst: true, capLast: true, color: mat.darkMid }), null, { xf: { p: [0, -0.046, 0.085], r: [0, 0, HALF_PI] }, gloss: 0.4 });
    if (o.bipod) b.legacy((k) => {
      for (const s of [-1, 1]) k.tube([0, 0, 0.27], [s * 0.05, -o.bipod!, 0.3], 0.004, 5, mat.dark);
      k.cyl(0.007, 0.007, 0.02, 6, mat.dark, [0, -0.004, 0.27], [0, 0, HALF_PI]);
    });
  });
}

/** Hilfe fuer Einheiten: Legacy-Teile in Baugroesse der Figur / helper for units: legacy parts at the figure's build size */
export function withProps(b: UvBuilder, fn: (k: Builder) => void): void {
  b.legacy(fn);
}
