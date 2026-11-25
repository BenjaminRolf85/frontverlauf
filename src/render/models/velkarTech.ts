/**
 * Velkar "Labor im Feld": gemeinsame Hightech-Formensprache der Velkar-Einheiten.
 * Frostweisse Panzerplatten, graues Laborgeraet, tuerkise Leuchten (leuchten ueber KEYS in atmosphere.ts), Generatoren mit
 * Kabeln und Antennen. Dazu die eigenen Bauarten (Tesla-Panzer, Oktokopter, Railgun-Schuetze), der Sensortraeger (Jeep) und
 * der Spulenwerfer (Artillerie) sowie die beweglichen Teile (Rotoren, Lichtboegen, Messdrohnen) fuer das Spielbrett.
 * Velkar "lab in the field": shared high-tech design language of the Velkar units.
 * Frost-white armour plates, grey lab gear, teal lights (glow via KEYS in atmosphere.ts), generators with cables and
 * antennas. Plus the own designs (Tesla tank, octocopter, railgun marksman), the sensor carrier (jeep) and the coil
 * launcher (artillery), and the moving parts (rotors, arcs, survey drones) for the board.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import * as THREE from 'three';
import type { FactionId, UnitTypeId } from '../../data/balance';
import { semantic } from '../../design/tokens';
import { addEmblem } from './emblems';
import {
  antennaBase, boltRing, cable, finRings, grille, headlight, mudBand, piston, rivets, seam, sensorCluster, squareHatch, towHook, vents,
} from './detailVehicles';
import { Builder, col, fine, geo, rng, shade, type V3 } from './kit';
import { look, mat } from './look';
import { kneelPose, seatPose, soldier, standPose, type Detail } from './soldiers';
import { tracks } from './tanks';

const HALF_PI = Math.PI / 2;

/** Farben der Formensprache / colours of the design language */
export const TECH = {
  shell: col(semantic.velkarTechShell),
  shellShade: shade(semantic.velkarTechShell, 0.82),
  gear: col(semantic.velkarTechGear),
  gearDark: shade(semantic.velkarTechGear, 0.62),
  /** leuchtet (KEYS) / glows (KEYS) */
  glow: col(semantic.velkarTechGlow),
  coil: col(semantic.velkarTechCoil),
  /** leuchtet (KEYS) / glows (KEYS) */
  arc: col(semantic.velkarTechArc),
};

/** Nur Velkar selbst bekommt die Formensprache (nicht Zyrr/NEXUS mit Velkar-Bauform) / only Velkar itself gets the design language */
export const isTech = (f: FactionId | 'neutral') => f === 'velkar';

/** Leuchtende Kugel / glowing dot */
export function techDot(b: Builder, p: V3, r = 0.008) {
  b.add(geo.ico(r, 0), TECH.glow, { p });
}

/**
 * Generator-Rucksack (lokal im Oberkoerper, Ruecken bei -z): Rahmen, Frostschale, tuerkiser Kern, Kuehlrippen, Antenne, Kabel nach vorn.
 * Generator backpack (torso local, back towards -z): frame, frost shell, teal core, cooling ribs, antenna, cable to the front.
 */
export function techPack(b: Builder, d: Detail, big = 1) {
  const z = -0.078 - (big - 1) * 0.03, y = 0.06 + (big - 1) * 0.03;
  b.add(d >= 1 ? geo.cbox(0.118 * big, 0.11 * big, 0.05 * big, 0.012) : geo.box(0.118 * big, 0.11 * big, 0.05 * big), TECH.gear, { p: [0, y, z] });
  b.add(d >= 1 ? geo.rtaper(0.12 * big, 0.04, 0.1 * big, 0.034, 0.1 * big, 0.01) : geo.box(0.11 * big, 0.1 * big, 0.04), TECH.shell, { p: [0, y + 0.004, z - 0.03 * big] });
  // tuerkiser Kern im Fenster / teal core in its window
  b.cyl(0.026 * big, 0.026 * big, 0.012, d >= 1 ? 10 : 6, TECH.glow, [0, y + 0.01, z - 0.05 * big], [HALF_PI, 0, 0]);
  if (d >= 1) {
    b.cyl(0.032 * big, 0.032 * big, 0.008, 10, TECH.gearDark, [0, y + 0.01, z - 0.047 * big], [HALF_PI, 0, 0]);
    for (const s of [-1, 1]) for (const k of [0, 1, 2]) b.box(0.01, 0.07 * big, 0.04 * big, TECH.gearDark, [s * (0.064 + k * 0.012) * big, y, z]);
  }
  // Antenne mit Leuchtspitze / antenna with a glowing tip
  b.tube([0.045 * big, y + 0.05 * big, z - 0.01], [0.06 * big, y + 0.2 * big, z - 0.03], 0.0035, 4, mat.dark);
  techDot(b, [0.06 * big, y + 0.205 * big, z - 0.03], 0.009);
  // Kabel vom Generator zur Huefte vorn / cable from the generator to the front of the hip
  if (d >= 1) {
    b.tube([-0.05 * big, y - 0.045 * big, z - 0.01], [-0.085, -0.01, -0.02], 0.006, 5, TECH.gearDark);
    b.tube([-0.085, -0.01, -0.02], [-0.07, -0.015, 0.05], 0.006, 5, TECH.gearDark);
  }
}

/**
 * Frostweisse Brustplatte mit Leuchtleiste (lokal im Oberkoerper) / frost-white chest plate with a light strip (torso local).
 */
export function techArmour(b: Builder, d: Detail) {
  b.add(d >= 1 ? geo.rtaper(0.13, 0.02, 0.15, 0.02, 0.085, 0.008) : geo.box(0.14, 0.085, 0.02), TECH.shell, { p: [0, 0.058, 0.05] });
  b.box(0.07, 0.01, 0.006, TECH.glow, [0, 0.074, 0.062]);
  if (d === 2) {
    b.box(0.13, 0.008, 0.016, TECH.gear, [0, 0.016, 0.052]);
    for (const s of [-1, 1]) b.box(0.03, 0.03, 0.008, TECH.shellShade, [s * 0.048, 0.04, 0.062]);
  }
}

// ---------- Bewegliche Teile / moving parts ----------

/** Art eines beweglichen Teils / kind of a moving part */
export type TechPartKind = 'rotor' | 'arc' | 'drone';
/** Bewegliches Teil an einer Einheit (Modellkoordinaten vor der Comic-Vergroesserung) / moving part on a unit (model coords before the comic enlargement) */
export interface TechPart { kind: TechPartKind; p: V3; dir?: 1 | -1; variant?: number }

/** Rotorblaetter (2 Blaetter, um y drehbar) / rotor blades (2 blades, spin around y) */
export function rotorBlades(r: number): Builder {
  const b = new Builder();
  for (const s of [-1, 1]) b.add(geo.cbox(0.018, 0.005, r, 0.005), TECH.gearDark, { p: [0, 0, s * r * 0.5], r: [s * 0.12, 0, 0] });
  b.box(0.02, 0.006, 0.012, TECH.glow, [0, 0.002, r * 0.92]);
  return b;
}

/** Messdrohne: kleine Scheibe mit Ring, Linse und Antenne / survey drone: small disc with ring, lens and antenna */
export function surveyDrone(): Builder {
  const b = new Builder();
  b.add(geo.sphere(0.03, 10, 5), TECH.shell, { s: [1, 0.55, 1] });
  b.add(geo.torus(0.042, 0.007, 4, 14), TECH.gear, { r: [HALF_PI, 0, 0] });
  b.cyl(0.014, 0.014, 0.012, 8, TECH.glow, [0, -0.012, 0.022], [1.2, 0, 0]);
  b.box(0.05, 0.006, 0.006, TECH.glow, [0, 0.012, 0]);
  b.tube([0.01, 0.014, -0.01], [0.016, 0.06, -0.02], 0.0025, 4, mat.dark);
  return b;
}

/**
 * Lichtbogen zwischen zwei Punkten als Zickzack aus duennen Quadern (deterministisch je Variante).
 * Arc between two points as a zigzag of thin boxes (deterministic per variant).
 */
export function arcBolt(a: V3, c: V3, variant: number, width = 0.01): Builder {
  const b = new Builder();
  const R = rng(97 + variant * 31);
  const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c);
  const n = 5;
  const pts: THREE.Vector3[] = [A];
  const dir = C.clone().sub(A);
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  for (let i = 1; i < n; i++) pts.push(A.clone().lerp(C, i / n).addScaledVector(side, (R() - 0.5) * 0.07).add(new THREE.Vector3(0, (R() - 0.5) * 0.05, 0)));
  pts.push(C);
  for (let i = 0; i < n; i++) b.segment(pts[i], pts[i + 1], (len) => geo.box(width, len + width, width), TECH.arc);
  return b;
}

/** Bewegliche Teile einer Einheit (nur Velkar) / moving parts of a unit (Velkar only) */
export function techParts(type: UnitTypeId, f: FactionId): TechPart[] {
  if (!isTech(f)) return [];
  switch (type) {
    case 'octocopter':
      return OCTO_ARMS.map((p, i) => ({ kind: 'rotor' as const, p: [p[0], OCTO_ROTOR_Y, p[2]] as V3, dir: (i % 2 ? 1 : -1) as 1 | -1 }));
    case 'teslaTank':
      return [0, 1, 2].map((v) => ({ kind: 'arc' as const, p: [0, 0, 0] as V3, variant: v }));
    // Messdrohnen begleiten Laborwache und Railgun-Schuetzen / survey drones accompany the lab guard and the railgun marksman
    case 'infantry': return [{ kind: 'drone', p: [-0.17, 0.4, -0.06] }];
    case 'railSniper': return [{ kind: 'drone', p: [0.17, 0.38, -0.12] }];
    case 'sniper': return [{ kind: 'drone', p: [-0.12, 0.26, -0.1] }];
    default: return [];
  }
}

/** Lichtbogen-Geometrie des Tesla-Panzers je Variante (zwischen den Spulen und zum Deck) / Tesla tank arc geometry per variant */
export function teslaArc(variant: number): Builder {
  const b = new Builder();
  const [l, r] = TESLA_TOPS;
  // Spruenge zwischen den Spulensaeulen und Entladungen von den Kugeln zur Wanne (unter dem Lebensbalken sichtbar)
  // jumps between the coil columns and discharges from the spheres to the hull (visible below the health badge)
  const z = l[2], gap = Math.abs(l[0]) - 0.035;
  const parts: [V3, V3][] = variant === 0 ? [[[-gap, 0.36, z], [gap, 0.32, z]], [l, [-0.19, 0.19, 0.1]]]
    : variant === 1 ? [[[-gap, 0.3, z], [gap, 0.37, z]], [r, [0.19, 0.19, 0.09]]]
    : [[[-gap, 0.34, z], [gap, 0.34, z]], [l, [-0.2, 0.17, -0.1]], [r, [0.2, 0.18, -0.09]]];
  parts.forEach(([a, c], i) => b.addColored(arcBolt(a, c, variant * 3 + i, 0.016).build()));
  return b;
}

// ---------- Tesla-Panzer / Tesla tank ----------

/** Spitzen der beiden Tesla-Spulen (fuer Lichtboegen und Muendung) / tops of both Tesla coils (for arcs and muzzle) */
export const TESLA_TOPS: [V3, V3] = [[-0.075, 0.45, -0.02], [0.075, 0.45, -0.02]];

/** Tesla-Spule: Isolatorfuss, Spulensaeule mit Leuchtringen, Toroid, Kugel / Tesla coil: insulator base, coil column with glowing rings, toroid, sphere */
function teslaCoil(b: Builder, x: number, y: number, z: number, lite: boolean) {
  for (let i = 0; i < 3; i++) b.cyl(0.042 - i * 0.006, 0.046 - i * 0.006, 0.016, 10, TECH.gearDark, [x, y + 0.008 + i * 0.018, z]);
  const cy = y + 0.05, ch = 0.2;
  b.cyl(0.03, 0.034, ch, 10, TECH.coil, [x, cy + ch / 2, z]);
  // Wicklung: Leuchtringe und Frostringe abwechselnd / winding: glowing and frost rings alternating
  const rings = lite ? 2 : 4;
  for (let i = 0; i < rings; i++) {
    const ry = cy + 0.02 + (i / (rings - 1)) * (ch - 0.04);
    b.add(geo.torus(0.036, 0.0065, 4, lite ? 10 : 14), i % 2 ? TECH.shell : TECH.glow, { p: [x, ry, z], r: [HALF_PI, 0, 0] });
  }
  // Toroid mit Kugel / toroid with sphere
  b.add(geo.torus(0.05, 0.021, lite ? 5 : 6, lite ? 10 : 14), TECH.shell, { p: [x, cy + ch + 0.012, z], r: [HALF_PI, 0, 0] });
  b.add(geo.sphere(0.022, 10, 6), TECH.arc, { p: [x, cy + ch + 0.032, z] });
}

export function teslaTank(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  tracks(b, { x: 0.135, w: 0.085, len: 0.4, h: 0.085, wheels: 5, wr: 0.029, sprocket: TECH.gearDark, hub: TECH.coil, lite, links: 9, rich: true });
  if (!lite && fine()) teslaDetail(b);
  // kantige Prototyp-Wanne: Frostschale ueber dunklem Unterbau / angular prototype hull: frost shell over a dark lower hull
  b.add(geo.profileZY([[-0.19, 0.035], [0.13, 0.035], [0.205, 0.075], [0.18, 0.12], [0.06, 0.155], [-0.16, 0.16], [-0.2, 0.115]], 0.2), TECH.gear);
  b.add(geo.profileZY([[-0.17, 0.1], [0.06, 0.1], [0.18, 0.118], [0.06, 0.163], [-0.15, 0.168], [-0.18, 0.13]], 0.26), TECH.shell);
  // geschlossene, schraege Kettenschuerzen mit Leuchtleiste / enclosed sloped track skirts with a light strip
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.022, 0.4, 0.016, 0.36, 0.08, 0.006), TECH.shell, { p: [s * 0.186, 0.064, 0] , r: [0, 0, s * 0.12] });
    b.box(0.006, 0.008, 0.3, TECH.glow, [s * 0.198, 0.07, 0]);
    if (!lite) for (const z of [-0.12, 0, 0.12]) b.box(0.008, 0.05, 0.006, TECH.gear, [s * 0.196, 0.06, z]);
  }
  // Sensorvisier am Bug / sensor visor on the bow
  b.add(geo.rtaper(0.2, 0.012, 0.18, 0.01, 0.026, 0.004), mat.glassDark, { p: [0, 0.128, 0.165], r: [-0.95, 0, 0] });
  b.box(0.16, 0.009, 0.006, TECH.glow, [0, 0.13, 0.172], [-0.95, 0, 0]);
  for (const s of [-1, 1]) b.cyl(0.013, 0.013, 0.008, 8, TECH.glow, [s * 0.09, 0.09, 0.2], [HALF_PI, 0, 0]);
  // Kuehlrippen am Heck und an den Flanken / cooling fins at the rear and on the flanks
  const fins = lite ? 4 : 7;
  for (let i = 0; i < fins; i++) b.box(0.006, 0.05, 0.075, TECH.gearDark, [-0.075 + (i / (fins - 1)) * 0.15, 0.19, -0.14]);
  if (!lite) for (const s of [-1, 1]) for (let i = 0; i < 4; i++) b.box(0.03, 0.006, 0.05, TECH.gearDark, [s * 0.135, 0.12 + i * 0.012, -0.05], [0, 0, s * 0.35]);
  // Kondensatorbank mit Anzeigen / capacitor bank with indicators
  b.add(geo.cbox(0.16, 0.04, 0.05, 0.01), TECH.gear, { p: [0, 0.185, 0.06] });
  if (!lite) for (const x of [-0.05, -0.02, 0.01]) b.box(0.012, 0.012, 0.006, TECH.glow, [x, 0.19, 0.087]);
  // zwei grosse Tesla-Spulen / two large Tesla coils
  for (const [x, , z] of TESLA_TOPS) teslaCoil(b, x, 0.165, z, lite);
  // Hochspannungskabel zwischen Bank und Spulen / high-voltage cables between bank and coils
  if (!lite) for (const [x, , z] of TESLA_TOPS) b.tube([x * 0.5, 0.2, 0.04], [x, 0.2, z + 0.03], 0.006, 5, TECH.gearDark);
  // Sensormast hinten / sensor mast at the rear
  b.tube([0.11, 0.17, -0.12], [0.12, 0.33, -0.14], 0.004, 4, mat.dark);
  techDot(b, [0.12, 0.335, -0.14], 0.011);
  addEmblem(b, f, 0.034, 0.006, L.secondary, { p: [0.2, 0.09, 0.12], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.034, 0.006, L.secondary, { p: [-0.2, 0.09, 0.12], r: [0, -HALF_PI, 0] });
  return b;
}

/**
 * Tesla-Panzer, hohe Qualitaet: Rippen-Isolatoren an den Spulenfuessen, Klemmen und Leuchtringe, Plattenfugen der
 * Frostschale, Wartungsklappen, Hochspannungs-Warnschild, Kabelkanaele, Sensorkuppel, Abschleppoesen, Schnee an den Schuerzen.
 * Tesla tank, high quality: ribbed insulators at the coil feet, clamps and glow rings, panel joints of the frost shell,
 * service hatches, high-voltage warning plate, cable ducts, sensor dome, tow eyes, snow on the skirts.
 */
function teslaDetail(b: Builder) {
  for (const [x, , z] of TESLA_TOPS) {
    for (let i = 0; i < 4; i++) b.add(geo.cyl(0.04, 0.04, 0.004, 14), TECH.shellShade, { p: [x, 0.168 + i * 0.012, z] });
    boltRing(b, [x, 0.168, z], 0.044, 8, mat.dark, 0.0045);
    b.add(geo.cyl(0.036, 0.036, 0.006, 14), TECH.gearDark, { p: [x, 0.225, z] });
    b.add(geo.cyl(0.036, 0.036, 0.006, 14), TECH.gearDark, { p: [x, 0.39, z] });
  }
  for (const s of [-1, 1]) {
    seam(b, [s * 0.09, 0.166, -0.15], [s * 0.09, 0.168, 0.06], TECH.shellShade);
    squareHatch(b, s * 0.06, 0.163, 0.12, 0.045, 0.035, TECH.shell);
    towHook(b, s * 0.08, 0.06, 0.2, 1, TECH.gearDark);
    towHook(b, s * 0.1, 0.07, -0.2, -1, TECH.gearDark);
    b.add(geo.cbox(0.008, 0.012, 0.3, 0.003), TECH.gearDark, { p: [s * 0.132, 0.13, -0.02] });
    rivets(b, [s * 0.198, 0.095, -0.17], [s * 0.198, 0.095, 0.17], 9, TECH.gearDark, 0.0045);
  }
  // Warnschild Hochspannung / high-voltage warning plate
  b.box(0.05, 0.03, 0.003, mat.yellow, [0, 0.185, 0.086]);
  b.add(geo.profileXY([[-0.006, 0.01], [0.004, 0.002], [-0.001, 0.0], [0.006, -0.01], [-0.004, -0.002], [0.001, 0.0]], 0.003), mat.ink, { p: [0, 0.185, 0.088] });
  b.add(geo.hemi(0.012, 10, 3), mat.glassDark, { p: [-0.09, 0.168, -0.1] });
  antennaBase(b, 0.11, 0.17, -0.12, TECH.gearDark);
  vents(b, [0, 0.2, -0.14], [0, 0, 0], 4, 0.14, 0.014, TECH.glow);
  mudBand(b, 83, 0.198, 0.03, 0.07, -0.18, 0.18, 10, true, [mat.snow, shade(mat.snow, 0.9)]);
}

// ---------- Oktokopter / octocopter ----------

/** Armenden (Motoren) des Oktokopters / arm ends (motors) of the octocopter */
const OCTO_R = 0.28;
const OCTO_ARMS: V3[] = Array.from({ length: 8 }, (_, i) => {
  const a = ((i + 0.5) / 8) * Math.PI * 2;
  return [Math.sin(a) * OCTO_R, 0, Math.cos(a) * OCTO_R] as V3;
});
const OCTO_LIFT = 0.1;
export const OCTO_ROTOR_Y = OCTO_LIFT + 0.13;
/** Radius der Rotorblaetter / rotor blade radius */
export const OCTO_BLADE = 0.085;

export function octocopter(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const by = OCTO_LIFT + 0.06;
  // Landekufen / landing skids
  for (const s of [-1, 1]) {
    b.cyl(0.007, 0.007, 0.22, 4, TECH.gearDark, [s * 0.075, OCTO_LIFT - 0.02, 0], [HALF_PI, 0, 0]);
    for (const z of [-0.06, 0.06]) b.tube([s * 0.075, OCTO_LIFT - 0.02, z], [s * 0.045, by - 0.02, z], 0.005, 4, TECH.gearDark);
  }
  // Rumpfkapsel: Frostschale, dunkler Guertel / body pod: frost shell, dark belt
  b.add(geo.sphere(0.1, lite ? 10 : 14, lite ? 6 : 8), TECH.shell, { p: [0, by + 0.03, 0], s: [1, 0.55, 1.2] });
  b.add(geo.cyl(0.1, 0.1, 0.02, lite ? 10 : 16), TECH.gear, { p: [0, by + 0.02, 0], s: [1, 1, 1.2] });
  b.add(geo.hemi(0.05, 10, 3), mat.glassDark, { p: [0, by + 0.07, 0.02], s: [1, 0.6, 1.3] });
  b.box(0.05, 0.008, 0.006, TECH.glow, [0, by + 0.04, 0.12]);
  // Arme mit Motoren, Rotornaben, Schutzringen und Statuslichtern / arms with motors, rotor hubs, guard rings and status lights
  OCTO_ARMS.forEach(([x, , z], i) => {
    b.tube([x * 0.25, by + 0.03, z * 0.25], [x, by + 0.045, z], 0.011, 5, TECH.gear);
    b.cyl(0.022, 0.026, 0.04, 8, TECH.gearDark, [x, by + 0.045, z]);
    b.cyl(0.008, 0.008, OCTO_ROTOR_Y - by - 0.04, 6, mat.dark, [x, (OCTO_ROTOR_Y + by + 0.04) / 2, z]);
    if (!lite) b.add(geo.torus(OCTO_BLADE + 0.012, 0.005, 3, 16), TECH.shellShade, { p: [x, OCTO_ROTOR_Y, z], r: [HALF_PI, 0, 0] });
    techDot(b, [x * 1.08, by + 0.025, z * 1.08], 0.009);
    // vordere Arme mit Leuchtband / front arms with a light band
    if (!lite && i % 4 === 0) b.box(0.04, 0.006, 0.006, TECH.glow, [x * 0.6, by + 0.05, z * 0.6], [0, Math.atan2(x, z) + HALF_PI, 0]);
  });
  if (!lite && fine()) octoDetail(b, by);
  // Sensor- und Waffenkapsel unter dem Rumpf / sensor and weapon pod under the body
  b.cyl(0.012, 0.012, 0.03, 6, mat.dark, [0, by - 0.035, 0.03]);
  b.add(geo.sphere(0.04, 10, 6), TECH.gearDark, { p: [0, by - 0.06, 0.04] });
  b.cyl(0.02, 0.02, 0.012, 10, TECH.glow, [0, by - 0.06, 0.08], [HALF_PI, 0, 0]);
  for (const s of [-1, 1]) {
    b.cyl(0.014, 0.014, 0.09, 8, TECH.shellShade, [s * 0.075, by - 0.02, 0.05], [HALF_PI, 0, 0]);
    if (!lite) b.cyl(0.009, 0.009, 0.006, 6, mat.dark, [s * 0.075, by - 0.02, 0.097], [HALF_PI, 0, 0]);
  }
  if (!lite) {
    // Antennen und Emblem / antennas and emblem
    b.tube([-0.03, by + 0.07, -0.08], [-0.045, by + 0.16, -0.11], 0.003, 4, mat.dark);
    techDot(b, [-0.045, by + 0.165, -0.11], 0.008);
    addEmblem(b, f, 0.03, 0.006, L.secondary, { p: [0, by + 0.075, -0.06], r: [-HALF_PI + 0.3, 0, 0] });
  }
  return b;
}

/**
 * Oktokopter, hohe Qualitaet: Kuehlrippen und Kappen an den Motoren, Kabel entlang der Arme, Streben der Schutzringe,
 * Kanzelrahmen, Lueftungsschlitze, Sensorgruppe, Kufenfuesse, Muendungsringe der Waffenkapseln.
 * Octocopter, high quality: cooling fins and caps on the motors, cables along the arms, guard ring struts, canopy frame,
 * vent slots, sensor cluster, skid feet, muzzle rings of the weapon pods.
 */
function octoDetail(b: Builder, by: number) {
  OCTO_ARMS.forEach(([x, , z]) => {
    for (const dy of [0.034, 0.044, 0.054]) b.add(geo.cyl(0.028, 0.028, 0.003, 12), TECH.gearDark, { p: [x, by + dy, z] });
    b.add(geo.hemi(0.012, 10, 3), TECH.shell, { p: [x, OCTO_ROTOR_Y + 0.003, z] });
    b.tube([x * 0.3, by + 0.044, z * 0.3], [x * 0.92, by + 0.058, z * 0.92], 0.0025, 4, mat.dark);
    const a = Math.atan2(x, z);
    for (const r of [a, a + HALF_PI]) b.box(0.003, 0.003, OCTO_BLADE * 2 + 0.02, TECH.shellShade, [x, OCTO_ROTOR_Y - 0.014, z], [0, r, 0]);
  });
  b.add(geo.torus(0.05, 0.004, 3, 16), TECH.gearDark, { p: [0, by + 0.072, 0.02], r: [HALF_PI, 0, 0], s: [1, 1.3, 1] });
  b.box(0.004, 0.026, 0.065, TECH.gearDark, [0, by + 0.088, 0.02]);
  vents(b, [0, by + 0.072, -0.07], [0, 0, 0], 4, 0.06, 0.01);
  sensorCluster(b, [0, by + 0.01, 0.124], 3, 0.006, TECH.glow);
  for (const s of [-1, 1]) {
    for (const z of [-0.1, 0.1]) b.add(geo.cbox(0.012, 0.006, 0.03, 0.003), mat.dark, { p: [s * 0.075, OCTO_LIFT - 0.026, z] });
    b.add(geo.cyl(0.016, 0.016, 0.005, 10), TECH.gearDark, { p: [s * 0.075, by - 0.02, 0.092], r: [HALF_PI, 0, 0] });
    seam(b, [s * 0.098, by + 0.03, -0.1], [s * 0.098, by + 0.03, 0.1], TECH.shellShade);
  }
}

// ---------- Railgun-Schuetze / railgun marksman ----------

/** Schienengewehr entlang +z ab dem Griff / rail rifle along +z from the grip */
function railRifle(b: Builder, grip: V3, pitch: number, lite: boolean) {
  b.group({ p: grip, r: [-pitch, 0, 0] }, () => {
    // Kolben, Kondensator, Griff / stock, capacitor, grip
    b.add(geo.cbox(0.03, 0.04, 0.12, 0.008), TECH.gear, { p: [0, 0.005, -0.04] });
    b.add(geo.cbox(0.038, 0.034, 0.07, 0.008), TECH.shell, { p: [0, 0.02, 0.05] });
    b.box(0.02, 0.04, 0.024, mat.dark, [0, -0.025, 0.015], [0.35, 0, 0]);
    // zwei lange Schienen / two long rails
    const len = 0.44;
    for (const y of [0.042, 0.004]) b.box(0.014, 0.009, len, TECH.gearDark, [0, y, 0.08 + len / 2]);
    b.box(0.006, 0.03, len * 0.9, TECH.coil, [0, 0.023, 0.08 + len * 0.47]);
    // Leuchtspulen entlang der Schienen / glowing coils along the rails
    const n = lite ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const z = 0.12 + (i / (n - 1)) * (len - 0.1);
      b.add(geo.cyl(0.026, 0.026, 0.014, 8, true), TECH.glow, { p: [0, 0.023, z], r: [HALF_PI, 0, 0] });
    }
    // Muendung und Zielfernrohr / muzzle and scope
    b.add(geo.cbox(0.034, 0.056, 0.02, 0.006), TECH.shell, { p: [0, 0.023, 0.08 + len] });
    b.cyl(0.012, 0.012, 0.08, 8, mat.ink, [0, 0.075, 0.08], [HALF_PI, 0, 0]);
    b.cyl(0.01, 0.01, 0.004, 8, TECH.glow, [0, 0.075, 0.122], [HALF_PI, 0, 0]);
    // Stuetze vorn / front support
    if (!lite) for (const s of [-1, 1]) b.tube([0, -0.002, 0.3], [s * 0.05, -0.12, 0.33], 0.004, 4, mat.dark);
    if (!lite && fine()) {
      // Schienenklammern, Kuehlrippen, Zweibeinfuesse, Sonnenblende, Ladeanzeige, Kabel / rail clamps, cooling fins, bipod feet, sun hood, charge display, cable
      for (const z of [0.16, 0.3, 0.44]) b.box(0.024, 0.052, 0.008, TECH.gearDark, [0, 0.023, z]);
      finRings(b, 0, 0.02, 0.025, 0.07, 4, 0.024, TECH.gearDark);
      for (const s of [-1, 1]) b.add(geo.cbox(0.016, 0.006, 0.02, 0.003), mat.dark, { p: [s * 0.05, -0.122, 0.33] });
      b.cyl(0.014, 0.014, 0.016, 10, mat.ink, [0, 0.075, 0.128], [HALF_PI, 0, 0]);
      b.box(0.018, 0.008, 0.003, TECH.glow, [0.02, 0.03, 0.05], [0, HALF_PI, 0]);
      cable(b, [0, -0.01, -0.09], [0, -0.03, 0.02], 0.02, 0.003, TECH.gearDark);
    }
  });
}

export function railSniper(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const d: Detail = lite ? 1 : 2;
  const L = look(f);
  const grip: V3 = [0.035, 0.205, 0.02];
  b.group({ p: [0, 0, -0.12] }, () => {
    soldier(b, f, { ...kneelPose([[-0.035, 0.215, 0.13], [0.035, 0.2, 0.02]]), head: [0.1, 0, 0], twist: [0, 0.05, 0] }, { detail: d, seed: 29 });
    railRifle(b, grip, 0.12, lite);
  });
  if (!lite) {
    // Kondensator-Koffer neben dem Schuetzen / capacitor case next to the marksman
    b.add(geo.cbox(0.07, 0.05, 0.1, 0.01), TECH.shell, { p: [-0.15, 0.025, -0.16], r: [0, 0.3, 0] });
    b.box(0.03, 0.01, 0.006, TECH.glow, [-0.14, 0.04, -0.105], [0, 0.3, 0]);
    b.tube([-0.13, 0.04, -0.16], [-0.06, 0.1, -0.2], 0.005, 4, TECH.gearDark);
    addEmblem(b, f, 0.024, 0.005, L.secondary, { p: [-0.11, 0.03, -0.21], r: [0, Math.PI + 0.3, 0] });
    if (fine()) {
      // Koffer: Griff, Verschluesse, Anzeige, Rippen / case: handle, latches, display, ribs
      b.group({ p: [-0.15, 0.025, -0.16], r: [0, 0.3, 0] }, () => {
        b.box(0.03, 0.006, 0.006, mat.dark, [0, 0.03, 0]);
        for (const s of [-1, 1]) b.box(0.008, 0.012, 0.004, mat.metal, [s * 0.025, 0.012, 0.051]);
        for (let i = 0; i < 4; i++) b.box(0.074, 0.003, 0.004, TECH.shellShade, [0, -0.012 + i * 0.008, 0.051]);
        for (let i = 0; i < 3; i++) b.box(0.004, 0.04, 0.09, TECH.gearDark, [-0.037, 0, -0.03 + i * 0.03]);
      });
    }
  }
  return b;
}

// ---------- Sensortraeger (Jeep) / sensor carrier (jeep) ----------

export function sensorCarrier(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  tracks(b, { x: 0.115, w: 0.07, len: 0.36, h: 0.07, wheels: 4, wr: 0.026, sprocket: TECH.gearDark, hub: TECH.coil, lite, links: 8, rich: true });
  const by = 0.075;
  if (!lite && fine()) sensorCarrierDetail(b, by);
  // flache Wanne und Kabine vorn / flat hull and cab at the front
  b.add(geo.cbox(0.22, 0.05, 0.38, 0.02), TECH.gear, { p: [0, by + 0.01, 0] });
  b.add(geo.profileZY([[-0.03, 0], [0.17, 0], [0.19, 0.03], [0.13, 0.1], [-0.02, 0.105]], 0.2), TECH.shell, { p: [0, by + 0.035, 0] });
  b.add(geo.rtaper(0.18, 0.012, 0.16, 0.01, 0.05, 0.004), mat.glassDark, { p: [0, by + 0.105, 0.15], r: [-0.85, 0, 0] });
  b.box(0.14, 0.008, 0.006, TECH.glow, [0, by + 0.088, 0.17], [-0.85, 0, 0]);
  for (const s of [-1, 1]) b.cyl(0.012, 0.012, 0.008, 8, TECH.glow, [s * 0.075, by + 0.03, 0.19], [HALF_PI, 0, 0]);
  // Fahrer im Dachluk / driver in the roof hatch
  if (!lite) b.group({ p: [-0.04, by + 0.02, 0.04], s: 0.75 }, () => soldier(b, f, seatPose([[-0.045, 0.14, 0.11], [0.045, 0.14, 0.11]]), { detail: 0, seed: 3, noLegs: true }));
  // Geraetedeck hinten mit Generator / equipment deck at the rear with a generator
  b.add(geo.cbox(0.18, 0.06, 0.15, 0.012), TECH.shell, { p: [0, by + 0.065, -0.1] });
  if (!lite) for (const x of [-0.06, -0.03, 0]) b.box(0.016, 0.01, 0.006, TECH.glow, [x, by + 0.08, -0.023]);
  // ausfahrbarer Sensormast mit Radarschirm und Leuchtringen / telescopic sensor mast with radar dish and glowing rings
  const mx = 0.04, mz = -0.11, my = by + 0.095;
  b.cyl(0.02, 0.024, 0.12, 8, TECH.gear, [mx, my + 0.06, mz]);
  b.cyl(0.014, 0.016, 0.12, 8, TECH.shellShade, [mx, my + 0.18, mz]);
  b.cyl(0.009, 0.01, 0.08, 6, TECH.gear, [mx, my + 0.28, mz]);
  for (const y of [my + 0.12, my + 0.24]) b.add(geo.torus(0.019, 0.004, 3, 10), TECH.glow, { p: [mx, y, mz], r: [HALF_PI, 0, 0] });
  // Lesbarkeit: flacher, breiter Radardom (Linse) oben auf dem Mast: eine waagrechte Scheibe ueber der Wanne ist die Kennform
  // des Sensortraegers gegen die senkrechten Tesla-Spulen / readability: flat, wide radar dome (lens) on top of the mast: a
  // horizontal disc above the hull is the sensor carrier's signature against the upright Tesla coils
  // niedrige Qualitaet: weniger Segmente / low quality: fewer segments
  const ds = lite || !fine() ? 0 : 1;
  b.group({ p: [mx, my + 0.31, mz] }, () => {
    b.add(geo.sphere(0.15, ds ? 20 : 10, ds ? 10 : 4), TECH.shell, { s: [1, 0.2, 1] });
    b.add(geo.cyl(0.152, 0.152, 0.012, ds ? 20 : 10, true), TECH.gearDark, { p: [0, 0, 0] });
    b.add(geo.cyl(0.04, 0.03, 0.02, ds ? 12 : 6), TECH.gear, { p: [0, 0.03, 0] });
    techDot(b, [0, 0.045, 0], 0.011);
  });
  // Antenne und kleines MG / antenna and small MG
  b.tube([-0.07, by + 0.095, -0.15], [-0.08, by + 0.27, -0.17], 0.003, 4, mat.dark);
  techDot(b, [-0.08, by + 0.275, -0.17], 0.008);
  if (!lite) {
    b.add(geo.cbox(0.024, 0.026, 0.07, 0.005), mat.dark, { p: [0.06, by + 0.125, 0.06] });
    b.cyl(0.006, 0.006, 0.09, 6, mat.dark, [0.06, by + 0.128, 0.14], [HALF_PI, 0, 0]);
  }
  addEmblem(b, f, 0.03, 0.005, L.secondary, { p: [0.111, by + 0.065, -0.1], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.03, 0.005, L.secondary, { p: [-0.111, by + 0.065, -0.1], r: [0, -HALF_PI, 0] });
  return b;
}

/**
 * Sensortraeger, hohe Qualitaet: Scheinwerfer, Abschleppoesen, Dachklappe, Kameras an der Kabine, Gitter und Rippen am
 * Generator, Kabel zum Mast, Klemmringe am Teleskopmast, Plattenfugen am Radardom, Schnee an den Flanken.
 * Sensor carrier, high quality: headlights, tow eyes, roof flap, cameras on the cab, grille and fins on the generator,
 * cable to the mast, clamp rings on the telescopic mast, panel joints on the radar dome, snow on the flanks.
 */
function sensorCarrierDetail(b: Builder, by: number) {
  const mx = 0.04, mz = -0.11, my = by + 0.095;
  for (const s of [-1, 1]) {
    headlight(b, s * 0.05, by + 0.03, 0.196, 0.008, TECH.gearDark);
    towHook(b, s * 0.07, by - 0.005, 0.195, 1, TECH.gearDark);
    towHook(b, s * 0.07, by - 0.005, -0.195, -1, TECH.gearDark);
    sensorCluster(b, [s * 0.085, by + 0.12, 0.08], 1, 0.007, TECH.glow);
    seam(b, [s * 0.1, by + 0.04, -0.17], [s * 0.1, by + 0.04, 0.16], TECH.shellShade);
    for (let i = 0; i < 3; i++) b.box(0.006, 0.04, 0.03, TECH.gearDark, [s * (0.092 + i * 0.002), by + 0.065, -0.1 + (i - 1) * 0.04]);
  }
  squareHatch(b, 0.045, by + 0.135, 0.05, 0.05, 0.04, TECH.shell);
  grille(b, [-0.04, by + 0.095, -0.1], 0.07, 0.09, 5, TECH.gearDark);
  cable(b, [-0.02, by + 0.1, -0.06], [mx - 0.02, my + 0.03, mz], 0.015, 0.0035, TECH.gearDark);
  for (const y of [my + 0.002, my + 0.122, my + 0.242]) b.add(geo.cyl(0.026 - (y - my) * 0.05, 0.026 - (y - my) * 0.05, 0.008, 12), TECH.gearDark, { p: [mx, y, mz] });
  b.group({ p: [mx, my + 0.31, mz] }, () => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.box(0.003, 0.004, 0.13, TECH.shellShade, [Math.sin(a) * 0.075, 0.026, Math.cos(a) * 0.075], [0, a, 0]);
    }
    b.add(geo.torus(0.1, 0.003, 3, 24), TECH.glow, { p: [0, 0.018, 0], r: [HALF_PI, 0, 0] });
  });
  mudBand(b, 89, 0.112, 0.06, 0.1, -0.17, 0.17, 8, true, [mat.snow, shade(mat.snow, 0.9)]);
}

// ---------- Spulenwerfer (Artillerie) / coil launcher (artillery) ----------

export function coilLauncher(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  tracks(b, { x: 0.12, w: 0.07, len: 0.34, h: 0.07, wheels: 4, wr: 0.026, sprocket: TECH.gearDark, hub: TECH.coil, lite, links: 5, rollers: 2, rich: true });
  const by = 0.075;
  const hi = !lite && fine();
  if (hi) coilLauncherDetail(b, by);
  b.add(geo.cbox(0.22, 0.05, 0.34, 0.02), TECH.gear, { p: [0, by + 0.01, -0.01] });
  // Kondensatorbank mit Kuehlrippen / capacitor bank with cooling fins
  b.add(geo.cbox(0.2, 0.06, 0.12, 0.012), TECH.shell, { p: [0, by + 0.06, -0.1] });
  if (!lite) for (let i = 0; i < 5; i++) b.box(0.205, 0.04, 0.006, TECH.gearDark, [0, by + 0.06, -0.15 + i * 0.022]);
  b.box(0.12, 0.008, 0.006, TECH.glow, [0, by + 0.075, -0.037]);
  // Drehlafette / turntable
  b.cyl(0.07, 0.08, 0.03, 10, TECH.gearDark, [0, by + 0.05, 0.05]);
  // langer Spulenwerfer, angehoben / long coil launcher, raised
  b.group({ p: [0, by + 0.09, 0.03], r: [-0.48, 0, 0] }, () => {
    b.add(geo.cbox(0.08, 0.07, 0.12, 0.012), TECH.shell, { p: [0, 0, -0.03] });
    const len = 0.42;
    b.add(geo.cbox(0.05, 0.05, len, 0.01), TECH.gear, { p: [0, 0, 0.03 + len / 2] });
    b.box(0.012, 0.056, len * 0.92, TECH.coil, [0, 0, 0.03 + len / 2]);
    const n = lite ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const z = 0.07 + (i / (n - 1)) * (len - 0.08);
      b.add(geo.cbox(0.074, 0.074, 0.018, 0.012), i % 2 ? TECH.shell : TECH.glow, { p: [0, 0, z] });
    }
    b.add(geo.cbox(0.07, 0.07, 0.022, 0.01), TECH.gearDark, { p: [0, 0, 0.03 + len] });
    if (hi) {
      // Seitenschienen, Halteklammern, Verschlussblock mit Bolzen, Muendungsring / side rails, clamps, breech block with bolts, muzzle ring
      for (const s of [-1, 1]) b.box(0.006, 0.012, len * 0.85, TECH.gearDark, [s * 0.028, 0.02, 0.03 + len / 2]);
      for (const z of [0.12, 0.3]) b.box(0.07, 0.006, 0.01, mat.dark, [0, -0.03, z]);
      rivets(b, [-0.03, 0.036, -0.06], [0.03, 0.036, -0.06], 4, mat.dark, 0.0045);
      b.add(geo.cyl(0.03, 0.03, 0.004, 12), TECH.glow, { p: [0, 0, 0.042 + len], r: [HALF_PI, 0, 0] });
      cable(b, [0.03, -0.02, -0.05], [0.03, -0.03, 0.08], 0.015, 0.004, mat.dark);
    }
  });
  // Bedienung mit Steuertafel / crew with a control panel
  if (!lite) {
    b.group({ p: [0.2, 0, -0.14], r: [0, -0.6, 0] }, () => {
      soldier(b, f, standPose([[-0.035, 0.17, 0.1], [0.035, 0.17, 0.1]]), { detail: 1, seed: 13 });
      b.add(geo.cbox(0.07, 0.008, 0.05, 0.003), TECH.gearDark, { p: [0, 0.17, 0.12], r: [0.6, 0, 0] });
      b.box(0.05, 0.004, 0.03, TECH.glow, [0, 0.176, 0.12], [0.6, 0, 0]);
    });
  }
  addEmblem(b, f, 0.032, 0.005, L.secondary, { p: [0.111, by + 0.03, 0.06], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.032, 0.005, L.secondary, { p: [-0.111, by + 0.03, 0.06], r: [0, -HALF_PI, 0] });
  return b;
}

/**
 * Spulenwerfer, hohe Qualitaet: hydraulische Stuetzen mit Tellern hinten, Bolzenkranz der Drehlafette, Magazin mit
 * Geschossen, Abschleppoesen, Wartungsklappe, Kabel, Schnee.
 * Coil launcher, high quality: hydraulic stabilisers with pads at the rear, bolt ring of the turntable, magazine with
 * slugs, tow eyes, service hatch, cables, snow.
 */
function coilLauncherDetail(b: Builder, by: number) {
  for (const s of [-1, 1]) {
    piston(b, [s * 0.1, by + 0.02, -0.16], [s * 0.15, 0.012, -0.2], 0.007, TECH.gearDark);
    b.add(geo.cyl(0.018, 0.02, 0.006, 12), mat.dark, { p: [s * 0.15, 0.003, -0.2] });
    towHook(b, s * 0.07, by - 0.005, 0.165, 1, TECH.gearDark);
    seam(b, [s * 0.1, by + 0.036, -0.17], [s * 0.1, by + 0.036, 0.15], TECH.shellShade);
  }
  boltRing(b, [0, by + 0.066, 0.05], 0.072, 12, mat.dark, 0.0045);
  // Magazin mit Geschossen / magazine with slugs
  b.add(geo.cbox(0.07, 0.02, 0.06, 0.004), TECH.gearDark, { p: [-0.07, by + 0.045, 0.1] });
  for (let i = 0; i < 3; i++) {
    b.cyl(0.008, 0.008, 0.05, 10, TECH.coil, [-0.09 + i * 0.02, by + 0.064, 0.1], [HALF_PI, 0, 0]);
    b.add(geo.cone(0.008, 0.014, 10), TECH.glow, { p: [-0.09 + i * 0.02, by + 0.064, 0.132], r: [HALF_PI, 0, 0] });
  }
  squareHatch(b, 0.06, by + 0.035, 0.11, 0.05, 0.05, TECH.shell);
  // Kabelkanal, Rippen an der Kondensatorbank, Sensoren vorn / cable duct, fins on the capacitor bank, front sensors
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.008, 0.012, 0.26, 0.003), TECH.gearDark, { p: [s * 0.104, by + 0.042, -0.01] });
    for (let i = 0; i < 4; i++) b.box(0.008, 0.05, 0.008, TECH.gearDark, [s * 0.103, by + 0.06, -0.142 + i * 0.028]);
    headlight(b, s * 0.07, by + 0.02, 0.167, 0.008, TECH.gearDark);
  }
  sensorCluster(b, [0, by + 0.03, 0.168], 3, 0.006, TECH.glow);
  mudBand(b, 97, 0.112, 0.06, 0.09, -0.16, 0.16, 8, true, [mat.snow, shade(mat.snow, 0.9)]);
}
