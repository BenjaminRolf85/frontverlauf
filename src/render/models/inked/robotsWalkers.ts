/**
 * Gezeichnete Einheiten: Laeufer und Drohnen der NEXUS (Spinnenroboter, Kamikaze-Laufdrohne, Flak-Drohne,
 * Quad-Drohne).
 * Inked units: walkers and drones of NEXUS (spider bot, kamikaze walker drone, flak drone, quad drone).
 *
 * Wenige glatte Koerper: Sechseck-Plattform, Hinterleib, Sprengkugel, Rumpfgondel; die Beine sind kantige Lofts mit
 * gezeichneten Fugen und Leuchtfuge, die Gelenke Kugeln in Fraktionsfarbe mit Leuchtring. Kennformen bleiben
 * modelliert (Beine, Rotorringe, Rohre, das gelbe Warnband), alles Kleine ist gezeichnet (robotPaint.ts).
 * A few smooth bodies: hexagonal platform, abdomen, charge sphere, fuselage pod; the legs are boxy lofts with drawn
 * joints and a glow seam, the joints are balls in the faction colour with a glow ring. The marks of identity stay
 * modelled (legs, rotor rings, barrels, the yellow hazard band), everything small is drawn (robotPaint.ts).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { fine, shade, softBox, taperSoft, type ColorLike, type V3 } from '../kit';
import { look, mat, type Look } from '../look';
import { annulus, antenna, can, HALF_PI, inCell, limb, orb, spike, TIP, tube } from './robotKit';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, projectBox, UvBuilder, type Ring } from './uvkit';

/** Kniegelenk: Kugel in der Farbe c mit Leuchtring am Aequator (hohe Qualitaet) / knee joint: ball in colour c with a glow ring at the equator (high quality) */
function knee(b: UvBuilder, A: AtlasLayout, p: V3, r: number, c: ColorLike, ring = true): void {
  if (!fine() || !ring) { orb(b, A, p, r, c, { seg: 6, rows: 3 }); return; }
  const at = (deg: number) => ({ y: r * Math.cos((deg * Math.PI) / 180), rx: Math.max(TIP, r * Math.sin((deg * Math.PI) / 180)) });
  b.add(loft([
    { ...at(0), c }, at(40), { ...at(76), hard: true, c: mat.cyanGlow }, { ...at(104), hard: true, c }, at(140), at(180),
  ], { seg: 8, region: A.get('blank') }), null, { xf: { p }, gloss: 0.3, crease: 0.5 });
}

interface LegOpts { upW: number; upD: number; loR: number; hipR: number; kneeR: number; upColor: ColorLike; loColor: ColorLike; kneeColor: ColorLike; upCell: string }
/** Laufbein: Hueftkugel, kantiger Oberschenkel, Knie, spitz zulaufender Unterschenkel / walker leg: hip ball, boxy upper leg, knee, lower leg tapering to a point */
function walkerLeg(b: UvBuilder, A: AtlasLayout, hip: V3, kn: V3, foot: V3, o: LegOpts): void {
  const hi = fine();
  orb(b, A, hip, o.hipR, mat.gunmetal, { seg: hi ? 8 : 6, rows: hi ? 4 : 3 });
  limb(b, A, hip, kn, [0, 1, 0], o.upColor, { w: o.upW, d: o.upD, w1: o.upW * 0.86, d1: o.upD * 0.86, cell: o.upCell, over: 0.004 });
  knee(b, A, kn, o.kneeR, o.kneeColor);
  tube(b, A, kn, foot, o.loR, o.loR * 0.62, o.loColor, { seg: hi ? 7 : 5, tip: true, gloss: 0.4 });
}

/** Sechseck-Plattform: Ringe von oben nach unten, flache Seite vorn / hexagonal platform: rings top to bottom, flat side in front */
function hexBody(b: UvBuilder, A: AtlasLayout, rings: Ring[]): void {
  b.add(loft(rings, { seg: 6, region: A.get('blank'), capFirst: A.get('rHex'), capLast: true }), null, { xf: { r: [0, Math.PI / 6, 0] } });
}

/** Kleiner Aufbau mit gezeichneter Wand und Dach (Zellen rTurret / rTop) / small superstructure with drawn wall and roof (cells rTurret / rTop) */
function head(b: UvBuilder, A: AtlasLayout, L: Look, p: V3, rx: number, rz: number, h: number): void {
  const hi = fine();
  b.add(loft([
    { y: h, rx: rx * 0.8, rz: rz * 0.8, e: 4, hard: true }, { y: h - 0.008, rx: rx * 0.95, rz: rz * 0.95, e: 4 }, { y: 0.006, rx, rz, e: 4 }, { y: 0, rx: rx * 0.94, rz: rz * 0.94, e: 4, hard: true },
  ], { seg: hi ? 16 : 8, region: A.get('rTurret'), capFirst: A.get('rTop'), capLast: true, color: L.hull }), null, { xf: { p } });
}

/** Duennes Rohr entlang +z mit Verschlussstueck und leuchtender Muendung / thin barrel along +z with breech collar and glowing muzzle */
function gunBarrel(b: UvBuilder, A: AtlasLayout, p: V3, len: number, r: number): void {
  const hi = fine();
  b.add(loft([
    { y: 0, rx: r * 1.4, hard: true, c: mat.gunmetal }, { y: -len * 0.28, rx: r * 1.4, hard: true }, { y: -len * 0.28, rx: r, hard: true },
    { y: -len + 0.014, rx: r, hard: true, c: mat.cyanGlow }, { y: -len + 0.014, rx: r * 1.25, hard: true }, { y: -len, rx: r * 1.25, hard: true },
  ], { seg: hi ? 8 : 5, region: A.get('blank'), capLast: true }), null, { xf: { p, r: [-HALF_PI, 0, 0] }, gloss: 0.5, crease: 0.6 });
}

// ---------- Spinnenroboter / spider bot ----------

const SPIDER_SCALE = 1.15;

/** Spinnenroboter; A = Roboter-Atlas / spider bot; A = robot atlas */
export function spider(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const y = 0.15;
  b.group({ s: SPIDER_SCALE }, () => {
    // Rumpf: Sechseckplatte mit Leuchtfuge unten / body: hexagonal plate with a glow seam below
    hexBody(b, A, [
      { y: y + 0.026, rx: 0.108, hard: true, c: plate }, { y: y + 0.02, rx: 0.117, hard: true }, { y: y - 0.016, rx: 0.123, hard: true, c: glow },
      { y: y - 0.024, rx: 0.123, hard: true, c: metal }, { y: y - 0.036, rx: 0.085 },
    ]);
    // Hinterleib / abdomen
    orb(b, A, [0, y + 0.012, -0.132], 0.076, metal, { cell: 'rAbdomen', sy: 1.15, sz: 0.76, seg: hi ? 16 : 8, rows: hi ? 8 : 4, r: [-HALF_PI, 0, 0], gloss: 0.4 });
    // Kopf mit vier Augen, Mundwerkzeuge / head with four eyes, mandibles
    b.add(projectBox(taperSoft(softBox(0.1, 0.052, 0.064, 0.012), 0.052, 0.8, 0.82, 0.004), { pz: A.get('rFace'), all: A.get('blank') }), plate, { xf: { p: [0, y + 0.004, 0.112] } });
    for (const s of [-1, 1]) spike(b, A, [s * 0.022, y - 0.014, 0.138], [s * 0.2, -0.55, 1], 0.008, 0.036, metal);
    // sechs Beine / six legs
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const z = -0.06 + i * 0.06;
      walkerLeg(b, A, [s * 0.098, y, z], [s * 0.21, y + 0.12, z * 1.8], [s * 0.325, 0.004, Math.max(-0.38, Math.min(0.38, z * 2.6))],
        { upW: 0.03, upD: 0.024, loR: 0.0115, hipR: 0.021, kneeR: 0.019, upColor: plate, loColor: metal, kneeColor: L.primary, upCell: 'rLimb' });
    }
    // Aufbau mit Doppelkanone / superstructure with twin guns
    b.add(can(A, 0.052, 0.047, 0.022, metal, { seg: hi ? 12 : 8 }), null, { xf: { p: [0, y + 0.024, 0] } });
    head(b, A, L, [0, y + 0.045, 0], 0.047, 0.052, 0.05);
    for (const x of [-0.022, 0.022]) gunBarrel(b, A, [x, y + 0.068, 0.04], 0.16, 0.0085);
    emblemDecal(b, A, f, [0, y + 0.0955, 0.004], [0, 1, 0], 0.036, plate, [0, 0, 1]);
    antenna(b, A, [-0.03, y + 0.094, -0.036], 0.1, glow);
  });
  return b;
}

// ---------- Kamikaze-Laufdrohne / kamikaze walker drone ----------

const KAMIKAZE_SCALE = 1.3;

/** Kamikaze-Laufdrohne; A = Roboter-Atlas / kamikaze walker drone; A = robot atlas */
export function kamikazeDrone(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const y = 0.13;
  b.group({ s: KAMIKAZE_SCALE }, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      walkerLeg(b, A, [sx * 0.048, y - 0.012, sz * 0.044], [sx * 0.12, y + 0.04, sz * 0.11], [sx * 0.162, 0.003, sz * 0.152],
        { upW: 0.026, upD: 0.021, loR: 0.0095, hipR: 0.017, kneeR: 0.0165, upColor: plate, loColor: metal, kneeColor: L.primary, upCell: 'rLimb' });
    }
    // Sprengladung: Kugel mit erhabenem gelbem Warnband am Aequator / charge: sphere with a raised yellow hazard band at the equator
    const R = 0.076, sy = 0.86, cy = y + 0.022;
    const at = (deg: number, k = 1): Ring => ({ y: R * sy * Math.cos((deg * Math.PI) / 180), rx: Math.max(TIP, R * k * Math.sin((deg * Math.PI) / 180)) });
    const upper = hi ? [0, 16, 32, 48, 64] : [0, 26, 54], lower = hi ? [116, 132, 148, 164, 180] : [126, 154, 180];
    const rings: Ring[] = [
      ...upper.map((d) => at(d)), { ...at(79), hard: true }, { ...at(80, 1.05), hard: true, c: mat.yellow }, { ...at(100, 1.05), hard: true, c: plate }, { ...at(101), hard: true }, ...lower.map((d) => at(d)),
    ];
    rings[0].c = plate;
    b.add(loft(rings.map((r) => ({ ...r, rz: r.rx * 1.1 })), { seg: hi ? 20 : 10, region: A.get('kCharge'), arc: true }), null, { xf: { p: [0, cy, 0] } });
    // Sensorauge vorn / sensor eye in front
    b.add(projectBox(softBox(0.052, 0.032, 0.03, 0.008), { pz: A.get('rEye'), all: A.get('blank') }), metal, { xf: { p: [0, y + 0.036, 0.08] }, gloss: 0.3 });
    // Zuender oben: rote Leuchte, Antenne / fuse on top: red light, antenna
    b.add(can(A, 0.015, 0.012, 0.022, metal, { seg: hi ? 8 : 5 }), null, { xf: { p: [0.02, y + 0.078, 0.02] } });
    orb(b, A, [0.02, y + 0.106, 0.02], 0.0115, mat.red, { seg: hi ? 8 : 5, rows: hi ? 4 : 3, gloss: 0.8 });
    antenna(b, A, [-0.026, y + 0.076, -0.03], 0.09, glow);
    emblemDecal(b, A, f, [-0.051, cy + 0.042, 0.0308], [-8.83, 9.83, 4.41], 0.03, plate);
  });
  return b;
}

// ---------- Flak-Drohne / flak drone ----------

/** Flak-Drohne; A = Roboter-Atlas / flak drone; A = robot atlas */
export function flakDrone(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const y = 0.13;
  // vier kurze Beine mit Leuchtfuss / four short legs with a glowing foot
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hip: V3 = [sx * 0.082, y - 0.004, sz * 0.082], kn: V3 = [sx * 0.168, y + 0.05, sz * 0.168], foot: V3 = [sx * 0.2, 0.026, sz * 0.2];
    limb(b, A, hip, kn, [0, 1, 0], metal, { w: 0.034, d: 0.028, cell: 'rLimbDark', over: 0.004, gloss: 0.3 });
    limb(b, A, kn, foot, [sx, 0.4, sz], plate, { w: 0.03, d: 0.028, w1: 0.024, d1: 0.022, cell: 'rLimb', over: 0.002 });
    orb(b, A, kn, 0.0235, plate, { seg: hi ? 10 : 6, rows: hi ? 5 : 3 });
    b.add(loft([{ y: 0.03, rx: 0.016, hard: true, c: metal }, { y: 0.015, rx: 0.022, hard: true, c: glow }, { y: 0.004, rx: 0.03, hard: true }, { y: 0, rx: 0.028 }], { seg: hi ? 10 : 6, region: A.get('glowStrip'), capFirst: true, t0: 0.4, t1: 0.6 }), null, { xf: { p: [foot[0], 0, foot[2]] } });
  }
  // Sechseck-Plattform mit Leuchtrand / hexagonal platform with a glowing rim
  hexBody(b, A, [
    { y: y + 0.026, rx: 0.124, hard: true, c: plate }, { y: y + 0.021, rx: 0.132, hard: true }, { y: y + 0.013, rx: 0.135, hard: true, c: glow },
    { y: y + 0.004, rx: 0.135, hard: true, c: plate }, { y: y - 0.024, rx: 0.112, hard: true, c: metal }, { y: y - 0.06, rx: 0.058 },
  ]);
  // Drehkopf mit Auge / turret head with its eye
  b.add(can(A, 0.07, 0.062, 0.028, metal, { seg: hi ? 12 : 8 }), null, { xf: { p: [0, y + 0.025, 0] } });
  head(b, A, L, [0, y + 0.05, -0.01], 0.07, 0.05, 0.07);
  orb(b, A, [0, y + 0.09, 0.041], 0.016, glow, { seg: hi ? 10 : 6, rows: hi ? 5 : 3, gloss: 0.8 });
  // vier Rohre schraeg nach oben, Verschlussblock, Munitionstrommeln / four barrels angled up, breech block, ammo drums
  b.group({ p: [0, y + 0.102, 0], r: [-1.0, 0, 0] }, () => {
    b.add(softBox(0.132, 0.052, 0.052, 0.01), metal, { xf: { p: [0, 0.002, 0.03] }, gloss: 0.3 });
    for (const x of [-0.045, 0.045]) for (const yy of [-0.012, 0.016]) gunBarrel(b, A, [x, yy, 0.04], 0.21, 0.0085);
    if (hi) for (const s of [-1, 1]) {
      b.add(can(A, 0.026, 0.026, 0.024, metal, { seg: 12 }), null, { xf: { p: [s * 0.072, 0, 0.02], r: [0, 0, -s * HALF_PI] } });
      b.add(can(A, 0.016, 0.016, 0.004, glow, { seg: 10, cell: 'glowStrip' }), null, { xf: { p: [s * 0.096, 0, 0.02], r: [0, 0, -s * HALF_PI] }, crease: 0.5 });
    }
  });
  // Zielradar-Flosse / targeting radar fin
  b.add(projectBox(softBox(0.012, 0.08, 0.06, 0.004), { px: A.get('rCap'), nx: A.get('rCap'), all: A.get('blank') }), plate, { xf: { p: [0, y + 0.152, -0.062] } });
  b.add(softBox(0.014, 0.05, 0.006, 0.002), glow, { xf: { p: [0, y + 0.152, -0.03] }, crease: 0.4 });
  emblemDecal(b, A, f, [-0.072, y + 0.0265, 0.064], [0, 1, 0], 0.036, plate, [0, 0, 1]);
  return b;
}

// ---------- Quad-Drohne / quad drone ----------

const QUAD_SCALE = 1.25;

/** Quad-Drohne; A = Roboter-Atlas / quad drone; A = robot atlas */
export function quadDrone(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const y = 0.22;
  b.group({ s: QUAD_SCALE }, () => {
    // Rumpfgondel: Loft entlang z, Zellenmitte oben, t vom Heck zum Bug / fuselage pod: loft along z, cell centre on top, t from tail to nose
    b.add(loft([
      { y: 0.08, rx: 0.036, rz: 0.015, e: 3, hard: true, c: plate }, { y: 0.068, rx: 0.056, rz: 0.024, e: 3 }, { y: 0.01, rx: 0.063, rz: 0.028, e: 3 },
      { y: -0.052, rx: 0.056, rz: 0.027, e: 3 }, { y: -0.074, rx: 0.038, rz: 0.019, e: 3, hard: true },
    ], { seg: hi ? 16 : 8, region: A.get('rPod'), capFirst: true, capLast: true }), null, { xf: { p: [0, y, 0], r: [-HALF_PI, 0, 0] } });
    orb(b, A, [0, y, 0.074], 0.018, glow, { seg: hi ? 10 : 6, rows: hi ? 5 : 3, gloss: 0.8 });
    // Arme und Rotoren mit Schutzring / arms and rotors with guard rings
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c: V3 = [sx * 0.16, y + 0.012, sz * 0.16];
      limb(b, A, [sx * 0.04, y + 0.006, sz * 0.04], [sx * 0.15, y + 0.01, sz * 0.15], [0, 1, 0], plate, { w: 0.028, d: 0.015, cell: 'rLimb', over: 0.002 });
      b.add(loft([{ y: 0.03, rx: TIP, c: L.primary }, { y: 0.027, rx: 0.011 }, { y: 0.02, rx: 0.016, hard: true, c: metal }, { y: 0.016, rx: 0.019, hard: true }, { y: -0.012, rx: 0.017 }], { seg: hi ? 10 : 6, region: A.get('blank'), capLast: true }), null, { xf: { p: c }, gloss: 0.3 });
      b.add(inCell(new THREE.TorusGeometry(0.08, 0.0085, hi ? 6 : 4, hi ? 22 : 12), A.get('rRing')), plate, { xf: { p: [c[0], c[1] + 0.012, c[2]], r: [HALF_PI, 0, 0] }, crease: 0.6 });
      b.add(inCell(new THREE.TorusGeometry(0.08, 0.0042, 3, hi ? 22 : 12), A.get('glowStrip')), glow, { xf: { p: [c[0], c[1] + 0.003, c[2]], r: [HALF_PI, 0, 0] }, crease: 0 });
      // zwei gekreuzte Blaetter / two crossed blades
      for (const a of [0.4, 0.4 + HALF_PI]) b.add(projectBox(softBox(0.142, 0.003, 0.017, 0.001), { py: A.get('rBlade'), all: A.get('blank') }), mat.dark, { xf: { p: [c[0], c[1] + 0.024, c[2]], r: [0, a, 0] }, crease: 0.4 });
      // Landebein / landing leg
      tube(b, A, [sx * 0.045, y - 0.016, sz * 0.045], [sx * 0.07, y - 0.072, sz * 0.07], 0.0045, 0.004, metal, { seg: hi ? 6 : 4 });
    }
    // Unterflur-Waffe / underslung gun
    b.add(softBox(0.042, 0.03, 0.062, 0.008), metal, { xf: { p: [0, y - 0.04, 0.028] }, gloss: 0.3 });
    gunBarrel(b, A, [0, y - 0.04, 0.05], 0.125, 0.0085);
    emblemDecal(b, A, f, [0, y + 0.0262, -0.047], [0, 1, 0], 0.034, plate, [0, 0, 1]);
    antenna(b, A, [-0.026, y + 0.022, 0.03], 0.05, glow, -0.3);
  });
  // Schwebeanzeige am Boden / hover indicator on the ground
  for (const r of [0.15, 0.25]) b.add(annulus(r - 0.006, r + 0.006, hi ? 28 : 14, A.get('glowStrip')), shade(glow, 1.15), { xf: { p: [0, 0.004, 0] }, crease: 0 });
  return b;
}
