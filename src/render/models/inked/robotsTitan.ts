/**
 * Gezeichnete Einheiten: Titan der NEXUS, der schwere Kampflaeufer.
 * Inked units: the NEXUS Titan, the heavy battle walker.
 *
 * Kennformen: breite Schultern mit Panzern in Fraktionsfarbe, leuchtender Kern in der Brust, Armkanone rechts mit
 * Leuchtspulen, Armklinge links, zwei Reaktoren mit Antennen auf dem Ruecken. Der Oberkoerper dreht sich als Turm zum
 * Ziel (Builder.turret). Rumpf, Kopf und Glieder sind Lofts mit gezeichneten Fugen, Schlitzen und Leuchtlinien.
 * Marks of identity: broad shoulders with pauldrons in the faction colour, a glowing core in the chest, arm cannon on
 * the right with glowing coils, arm blade on the left, two reactors with antennas on the back. The upper body turns
 * towards the target as a turret (Builder.turret). Torso, head and limbs are lofts with drawn joints, slots and
 * glow lines.
 */
import type { FactionId } from '../../../data/balance';
import { fine, geo, shade, softBox, taperSoft, type V3 } from '../kit';
import { look, mat } from '../look';
import { antenna, can, HALF_PI, limb, orb } from './robotKit';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, projectBox, UvBuilder } from './uvkit';

/** Massstab zur Endgroesse (quer etwas breiter, wie UNIT_SHAPE des bisherigen Modells) / scale to final size (a little wider across, as UNIT_SHAPE of the previous model) */
const TITAN_SCALE: V3 = [1.1, 1.03, 1.03];

/** Titan; A = Roboter-Atlas / Titan; A = robot atlas */
export function titan(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const seg = hi ? 16 : 8, ball = { seg: hi ? 10 : 6, rows: hi ? 5 : 3 };
  b.group({ s: TITAN_SCALE }, () => {
    // ---- Beine und Becken / legs and pelvis ----
    b.mirrorX((side) => {
      const hip: V3 = [0.086, 0.25, 0], kn: V3 = [0.096, 0.15, 0.045], ankle: V3 = [0.096, 0.044, 0];
      limb(b, A, hip, kn, [0, 0, 1], plate, { w: 0.072, d: 0.076, cell: 'rLimb', flip: side < 0 });
      limb(b, A, kn, ankle, [0, 0, 1], metal, { w: 0.062, d: 0.066, w1: 0.056, d1: 0.06, cell: 'rLimbDark', gloss: 0.3 });
      orb(b, A, [0.1, 0.253, 0], 0.036, metal, ball);
      orb(b, A, kn, 0.033, metal, ball);
      // Knieschutz und Hueftplatte in Fraktionsfarbe / knee guard and hip plate in the faction colour
      b.add(taperSoft(softBox(0.07, 0.052, 0.022, 0.007), 0.052, 0.72, 1), L.primary, { xf: { p: [0.096, 0.157, 0.083], r: [-0.3, 0, 0] } });
      if (hi) b.add(softBox(0.016, 0.07, 0.056, 0.005), L.primary, { xf: { p: [0.136, 0.205, 0.016], r: [0.3, 0, 0.08] } });
      // Fuss mit gezeichneten Zehen / foot with drawn toes
      b.add(projectBox(taperSoft(softBox(0.092, 0.042, 0.142, 0.01), 0.042, 0.8, 0.66, -0.012), { py: A.get('rFoot'), all: A.get('blank') }), metal, { xf: { p: [0.096, 0.021, 0.016] }, gloss: 0.3 });
    });
    b.add(softBox(0.184, 0.062, 0.112, 0.018), metal, { xf: { p: [0, 0.27, 0] }, gloss: 0.3 });
    b.add(can(A, 0.07, 0.062, 0.03, metal, { seg: hi ? 14 : 8 }), null, { xf: { p: [0, 0.296, 0] } });

    // ---- Oberkoerper als Drehturm / upper body as a turret ----
    b.turret([0, 0.3, 0], () => {
      // Rumpf: unten schmal, breite Schultern; Zeichnung in rChest / torso: narrow below, broad shoulders; drawing in rChest
      b.add(loft([
        { y: 0.468, rx: 0.112, rz: 0.058, e: 4, hard: true, c: plate }, { y: 0.456, rx: 0.136, rz: 0.076, e: 4 }, { y: 0.4, rx: 0.132, rz: 0.076, e: 4 },
        { y: 0.335, rx: 0.098, rz: 0.064, e: 4 }, { y: 0.318, rx: 0.084, rz: 0.055, e: 4, hard: true },
      ], { seg: hi ? 20 : 8, region: A.get('rChest'), capFirst: A.get('rTop'), capLast: true }), null);
      // Leuchtkern in dunkler Fassung / glowing core in a dark bezel
      b.add(loft([{ y: 0.014, rx: 0.034, hard: true }, { y: 0.014, rx: 0.046, hard: true }, { y: 0, rx: 0.05 }], { seg: hi ? 14 : 8, region: A.get('blank'), capFirst: true, color: metal }), null, { xf: { p: [0, 0.39, 0.071], r: [HALF_PI, 0, 0] }, gloss: 0.4 });
      orb(b, A, [0, 0.39, 0.078], 0.031, glow, { seg: hi ? 14 : 8, rows: hi ? 6 : 4, gloss: 0.9 });
      emblemDecal(b, A, f, [-0.088, 0.432, 0.0745], [0, 0.1, 1], 0.036, plate);
      // Kopf mit Visier und Kamm / head with visor and crest
      b.add(can(A, 0.036, 0.031, 0.02, metal, { seg: hi ? 10 : 6 }), null, { xf: { p: [0, 0.462, 0] } });
      b.add(loft([
        { y: 0.064, rx: 0.034, rz: 0.035, e: 4, hard: true, c: plate }, { y: 0.056, rx: 0.042, rz: 0.043, e: 4 }, { y: 0.006, rx: 0.043, rz: 0.044, e: 4 }, { y: 0, rx: 0.038, rz: 0.039, e: 4, hard: true },
      ], { seg, region: A.get('rHead'), capFirst: true, capLast: true }), null, { xf: { p: [0, 0.476, 0.008] } });
      b.add(taperSoft(softBox(0.064, 0.02, 0.074, 0.006), 0.02, 0.8, 0.72), L.primary, { xf: { p: [0, 0.549, 0.002] } });
      // Schultern: Gelenk und schwerer Panzer / shoulders: joint and heavy pauldron
      b.mirrorX(() => {
        orb(b, A, [0.15, 0.432, 0], 0.036, metal, ball);
        b.add(projectBox(taperSoft(softBox(0.104, 0.072, 0.124, 0.016), 0.072, 0.8, 0.82), { px: A.get('rPauldron'), py: A.get('rPauldron'), all: A.get('blank') }), L.primary, { xf: { p: [0.172, 0.462, 0], r: [0, 0, -0.2] } });
      });
      for (const s of [-1, 1]) emblemDecal(b, A, f, [s * 0.2215, 0.4595, 0], [s, 0.34, 0], 0.036, L.primary);
      // rechter Arm: Armkanone mit Leuchtspulen / right arm: arm cannon with glowing coils
      limb(b, A, [0.172, 0.425, 0], [0.192, 0.332, 0.03], [1, 0, 0], plate, { w: 0.058, d: 0.062, cell: 'rLimb' });
      orb(b, A, [0.192, 0.332, 0.03], 0.031, metal, ball);
      b.add(projectBox(softBox(0.074, 0.074, 0.104, 0.016), { px: A.get('rCap'), all: A.get('blank') }), metal, { xf: { p: [0.192, 0.31, 0.08] }, gloss: 0.3 });
      b.add(loft([
        { y: 0, rx: 0.039, hard: true, c: metal }, { y: -0.016, rx: 0.039, hard: true }, { y: -0.016, rx: 0.034, hard: true }, { y: -0.168, rx: 0.031, hard: true },
        { y: -0.168, rx: 0.038, hard: true, c: mat.dark }, { y: -0.184, rx: 0.038, hard: true }, { y: -0.184, rx: 0.027, hard: true, c: mat.ink },
      ], { seg: hi ? 16 : 8, region: A.get('rBarrel'), arc: true, capLast: true }), null, { xf: { p: [0.192, 0.31, 0.122], r: [-HALF_PI, 0, 0] }, gloss: 0.5 });
      orb(b, A, [0.192, 0.31, 0.305], 0.02, glow, { ...ball, gloss: 0.9 });
      // linker Arm: Armklinge mit Leuchtschneide / left arm: arm blade with a glowing edge
      limb(b, A, [-0.172, 0.425, 0], [-0.192, 0.332, 0.03], [-1, 0, 0], plate, { w: 0.058, d: 0.062, cell: 'rLimb', flip: true });
      orb(b, A, [-0.192, 0.332, 0.03], 0.031, metal, ball);
      b.add(softBox(0.064, 0.064, 0.124, 0.014), metal, { xf: { p: [-0.192, 0.31, 0.09] }, gloss: 0.3 });
      b.add(projectBox(geo.profileZY([[0.12, -0.022], [0.335, -0.004], [0.365, 0.03], [0.14, 0.032]], 0.013), { px: A.get('rSword'), nx: A.get('rSword'), mirrorNx: true, all: A.get('blank') }), plate, { xf: { p: [-0.192, 0.31, 0] } });
      // Ruecken: zwei Reaktoren mit Leuchtring, Antennen / back: two reactors with a glow ring, antennas
      for (const s of [-1, 1]) {
        b.add(loft([
          { y: 0.47, rx: 0.024, hard: true, c: metal }, { y: 0.466, rx: 0.031, hard: true, c: glow }, { y: 0.45, rx: 0.031, hard: true, c: metal }, { y: 0.352, rx: 0.035, hard: true }, { y: 0.346, rx: 0.028 },
        ], { seg: hi ? 12 : 6, region: A.get('blank'), capFirst: true }), null, { xf: { p: [s * 0.06, 0, -0.1] }, gloss: 0.3 });
        antenna(b, A, [s * 0.104, 0.462, -0.066], 0.118, glow, -0.12);
      }
      if (hi) b.add(softBox(0.2, 0.09, 0.02, 0.006), shade(plate, 0.92), { xf: { p: [0, 0.4, -0.078], r: [0.12, 0, 0] } });
    });
  });
  return b;
}
