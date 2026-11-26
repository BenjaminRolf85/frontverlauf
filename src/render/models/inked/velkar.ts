/**
 * Gezeichnete Einheiten: Bauarten der Velkar ("Labor im Feld") auf Ketten und in der Luft: Sensortraeger (statt des
 * Gelaendewagens), Spulenwerfer (statt des Geschuetzes), Tesla-Panzer, Oktokopter.
 * Inked units: the Velkar designs ("lab in the field") on tracks and in the air: sensor carrier (instead of the field
 * car), coil launcher (instead of the gun), Tesla tank, octocopter.
 *
 * Formensprache: helle glatte Schalen (TECH.shell) auf grauem Geraet (TECH.gear), tuerkise Leuchten (TECH.glow) als
 * eigene Teile in der Leuchtfarbe; die Leuchtmaske entsteht daraus von selbst. Fugen, Klappen und Kennung sind
 * gezeichnet (velkarPaint.ts). Bewegliche Teile (Rotoren, Lichtboegen) haengt das Brett an feste Punkte
 * (techParts in velkarTech.ts): diese Punkte bleiben hier unveraendert.
 * Design language: light smooth shells (TECH.shell) on grey gear (TECH.gear), teal lights (TECH.glow) as parts of their
 * own in the glow colour; the glow mask follows from that. Joints, flaps and markings are drawn (velkarPaint.ts).
 * Moving parts (rotors, arcs) are attached by the board at fixed points (techParts in velkarTech.ts): those points
 * stay unchanged here.
 */
import type { FactionId } from '../../../data/balance';
import { fine, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat } from '../look';
import { isTech, OCTO_BLADE, OCTO_ROTOR_Y, TECH, TESLA_TOPS } from '../velkarTech';
import { block, boxed, crew, cupola, hullZ, machineGun, shaped, TIP, tub, tube } from './body';
import { tankGear, tankHull, type HullSpec } from './tanks';
import { standPose } from './figure';
import { emblemDecal, runningGear, type TrackSpec } from './trim';
import { AtlasLayout, loft, UvBuilder, type BoxFaces } from './uvkit';

const HALF_PI = Math.PI / 2;
/** Schwebehoehe des Oktokopters wie in velkarTech.ts / the octocopter's hover height as in velkarTech.ts */
const OCTO_LIFT = 0.1;

/** Leuchtring um eine senkrechte Achse / glow ring about a vertical axis */
export function glowRing(b: UvBuilder, A: AtlasLayout, p: V3, r: number, h: number, c: ColorLike = TECH.glow): void {
  b.add(loft([{ y: h / 2, rx: r * 0.86, hard: true }, { y: h / 2, rx: r, hard: true }, { y: -h / 2, rx: r, hard: true }, { y: -h / 2, rx: r * 0.86, hard: true }], { seg: fine() ? 14 : 8, region: A.get('glowStrip'), color: c }), null, { xf: { p }, crease: 0 });
}
/** Leuchtpunkt (Kugel) / glow dot (sphere) */
export function glowDot(b: UvBuilder, A: AtlasLayout, p: V3, r: number, c: ColorLike = TECH.glow): void {
  b.add(loft([{ y: r, rx: TIP }, { y: r * 0.6, rx: r * 0.8 }, { y: 0, rx: r }, { y: -r * 0.6, rx: r * 0.8 }, { y: -r, rx: TIP }], { seg: fine() ? 8 : 5, region: A.get('blank'), color: c }), null, { xf: { p }, crease: 0 });
}
/** Leuchtleiste als flacher Quader, Zeichnung auf der Seite dir / glow bar as a flat box, drawing on the face dir */
export function glowBar(b: UvBuilder, A: AtlasLayout, p: V3, w: number, h: number, d: number, face: 'py' | 'pz' | 'nz' | 'px' | 'nx', r: V3 = [0, 0, 0], c: ColorLike = TECH.glow): void {
  b.add(boxed(softBox(w, h, d, Math.min(w, h, d) * 0.3), { p, r }, { [face]: A.get('glowStrip'), all: A.get('blank') } as BoxFaces), c, { crease: 0 });
}

/** Schalenflaechen: Flanken und Stirnseiten mit der Schalenzeichnung / shell faces: flanks and ends with the shell drawing */
export function shellFaces(A: AtlasLayout): BoxFaces {
  const p = A.get('panel:velkar');
  return { px: p, nx: p, pz: p, nz: p, py: A.get('blank'), ny: A.get('blank') };
}
/** Kettenfahrgestell der Velkar: Laufwerk und graue Wanne / Velkar tracked chassis: running gear and grey hull */
export function techChassis(b: UvBuilder, A: AtlasLayout, T: TrackSpec, wheels: number, zc = 0): void {
  b.group({ p: [0, 0, zc] }, () => {
    b.mirrorX(() => runningGear(b, A, T, { wheels, wheelR: T.h * 0.36, wheelColor: TECH.coil, sprocketColor: TECH.gearDark, idlerColor: TECH.gearDark, bayColor: mat.dark, rollers: 0 }));
    // Deckplatte ueber den Ketten, dunkle Unterwanne dazwischen / deck slab above the tracks, dark lower hull in between
    const hw = T.x + T.w / 2 - 0.002, y0 = T.h - 0.006, y1 = T.h + 0.046, h = (y1 - y0) / 2;
    b.add(hullZ([
      { z: T.len / 2 + 0.006, w: hw - 0.014, up: h - 0.01, down: h - 0.004, cy: (y0 + y1) / 2, e: 6, hard: true },
      { z: T.len / 2 - 0.012, w: hw, up: h, down: h, cy: (y0 + y1) / 2, e: 6 },
      { z: -T.len / 2 + 0.008, w: hw, up: h, down: h, cy: (y0 + y1) / 2, e: 6 },
      { z: -T.len / 2 - 0.004, w: hw - 0.01, up: h - 0.006, down: h - 0.004, cy: (y0 + y1) / 2, e: 6, hard: true },
    ], { px: A.get('plateMud'), nx: A.get('plateMud'), pz: A.get('plateMud'), nz: A.get('plateMud'), py: A.get('plate'), ny: A.get('blank'), seg: fine() ? 16 : 8, capFirst: true, capLast: true }), TECH.gear);
    b.add(softBox(2 * (T.x - T.w / 2) + 0.01, T.h * 0.62, T.len - 0.07, 0.01), TECH.gearDark, { xf: { p: [0, T.h * 0.6, 0] } });
  });
}

/** Sensortraeger: Kabine vorn, Geraetedeck, Teleskopmast mit breitem Radarschirm / sensor carrier: cab at the front, equipment deck, telescopic mast with a wide radar dish */
export function sensorCarrier(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine(), seg = hi ? 18 : 9;
  const T: TrackSpec = { x: 0.122, w: 0.074, len: 0.38, h: 0.074, links: 34, thick: 0.01 };
  techChassis(b, A, T, 4, -0.02);
  const deck = T.h + 0.046;
  const F = shellFaces(A);
  // Kabine: schraege Front mit dunklem Glas, Dach mit Luk / cab: sloped front with dark glass, roof with a hatch
  const roof = deck + 0.098;
  b.add(hullZ([
    { z: 0.178, w: 0.098, up: 0.012, down: 0.016, cy: deck + 0.014, e: 5, hard: true },
    { z: 0.166, w: 0.104, up: 0.022, down: 0.02, cy: deck + 0.018, e: 5 },
    { z: 0.092, w: 0.108, up: (roof - deck) / 2 - 0.004, down: (roof - deck) / 2, cy: (roof + deck) / 2, e: 5 },
    { z: 0.07, w: 0.108, up: (roof - deck) / 2, down: (roof - deck) / 2, cy: (roof + deck) / 2, e: 5 },
    { z: -0.04, w: 0.106, up: (roof - deck) / 2, down: (roof - deck) / 2, cy: (roof + deck) / 2, e: 5, hard: true },
  ], { ...F, seg, capFirst: true, capLast: true }), TECH.shell);
  const tilt = Math.atan2(roof - deck - 0.05, 0.076);
  b.add(boxed(softBox(0.168, 0.05, 0.005, 0.002), { p: [0, deck + 0.064, 0.136], r: [-(HALF_PI - tilt), 0, 0] }, { pz: A.get('glass'), py: A.get('glass'), all: A.get('blank') }), mat.glassDark, { gloss: 0.35, crease: 0 });
  glowBar(b, A, [0, deck + 0.03, 0.174], 0.15, 0.007, 0.006, 'pz');
  for (const s of [-1, 1]) b.add(loft([{ y: 0.004, rx: TIP }, { y: 0.003, rx: 0.011 }, { y: 0, rx: 0.013, hard: true }, { y: -0.006, rx: 0.013 }], { seg: hi ? 10 : 6, region: A.get('blank'), color: TECH.glow }), null, { xf: { p: [s * 0.078, deck + 0.004, 0.183], r: [HALF_PI, 0, 0] }, crease: 0 });
  // Fahrer im Dachluk / driver in the roof hatch
  cupola(b, A, f, [-0.042, roof, 0.022], TECH.gear, TECH.shell, { seed: 3 });
  if (hi) machineGun(b, A, [0.058, roof + 0.03, 0.03], { k: 0.9, len: 0.1 });
  if (hi) tube(b, A, [0.058, roof, 0.03], [0.058, roof + 0.02, 0.03], 0.006, 0.005, mat.dark, 6);
  // Geraetedeck mit Generator, Leuchtanzeigen / equipment deck with generator, indicator lights
  b.add(boxed(softBox(0.19, 0.062, 0.15, 0.012, hi ? 1 : 0), { p: [0, deck + 0.031, -0.125] }, { ...F, py: A.get('grille') }), TECH.shell);
  for (const x of [-0.06, -0.03, 0]) glowBar(b, A, [x, deck + 0.05, -0.2015], 0.018, 0.01, 0.004, 'nz');
  // Teleskopmast mit Leuchtringen / telescopic mast with glow rings
  const mx = 0.04, mz = -0.125, my = deck + 0.062;
  for (const [y0, h, r, c] of [[0, 0.11, 0.022, TECH.gear], [0.11, 0.11, 0.0155, TECH.shellShade], [0.22, 0.075, 0.0095, TECH.gear]] as const) {
    b.add(loft([{ y: h, rx: r * 0.9, hard: true }, { y: 0, rx: r * 1.08 }], { seg: hi ? 12 : 7, region: A.get('blank'), color: c }), null, { xf: { p: [mx, my + y0, mz] } });
  }
  for (const y of [my + 0.11, my + 0.22]) glowRing(b, A, [mx, y, mz], 0.021, 0.008);
  // flacher, breiter Radarschirm: die waagrechte Scheibe ist die Kennform / flat, wide radar dish: the horizontal disc is the signature shape
  const dy = my + 0.305, R = 0.15;
  b.add(loft([{ y: 0.03, rx: 0.03, hard: true }, { y: 0.024, rx: 0.07 }, { y: 0.012, rx: 0.12 }, { y: 0, rx: R, hard: true }], { seg: hi ? 24 : 12, region: A.get('dish'), color: TECH.shell }), null, { xf: { p: [mx, dy, mz] } });
  b.add(loft([{ y: 0, rx: R, hard: true }, { y: -0.008, rx: R - 0.004, hard: true }, { y: -0.016, rx: 0.09 }, { y: -0.024, rx: 0.02 }], { seg: hi ? 24 : 12, region: A.get('blank'), color: TECH.gearDark }), null, { xf: { p: [mx, dy, mz] }, crease: 0 });
  b.add(loft([{ y: 0.052, rx: 0.016, hard: true }, { y: 0.03, rx: 0.034, hard: true }], { seg: hi ? 12 : 7, region: A.get('blank'), capFirst: true, color: TECH.gear }), null, { xf: { p: [mx, dy, mz] } });
  glowDot(b, A, [mx, dy + 0.058, mz], 0.011);
  // Antenne mit Leuchtspitze, Embleme / antenna with a glow tip, emblems
  tube(b, A, [-0.075, deck + 0.06, -0.185], [-0.085, deck + 0.24, -0.205], 0.003, 0.002, mat.dark, hi ? 5 : 3);
  glowDot(b, A, [-0.085, deck + 0.245, -0.205], 0.008);
  for (const s of [-1, 1]) emblemDecal(b, A, f, [s * 0.0955, deck + 0.034, -0.16], [s, 0, 0], 0.034, TECH.shell);
  return b;
}

/** Spulenwerfer: Kondensatorbank, Drehlafette, lange Schiene mit Spulenringen, ein Bediener mit Steuertafel / coil launcher: capacitor bank, turntable, long rail with coil rings, one operator with a control panel */
export function coilLauncher(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine();
  const T: TrackSpec = { x: 0.124, w: 0.074, len: 0.36, h: 0.074, links: 32, thick: 0.01 };
  techChassis(b, A, T, 4, -0.03);
  const deck = T.h + 0.046;
  const F = shellFaces(A);
  // Kondensatorbank mit Kuehlrippen (gezeichnetes Gitter obenauf) / capacitor bank with cooling fins (drawn grille on top)
  b.add(boxed(softBox(0.2, 0.064, 0.13, 0.012, hi ? 1 : 0), { p: [0, deck + 0.032, -0.135] }, { ...F, py: A.get('grille') }), TECH.shell);
  glowBar(b, A, [0, deck + 0.05, -0.0685], 0.12, 0.008, 0.004, 'pz');
  for (const s of [-1, 1]) emblemDecal(b, A, f, [s * 0.1005, deck + 0.034, -0.15], [s, 0, 0], 0.034, TECH.shell);
  // Drehlafette / turntable
  b.add(loft([{ y: 0.03, rx: 0.062, hard: true }, { y: 0.03, rx: 0.07, hard: true }, { y: 0, rx: 0.08 }], { seg: hi ? 18 : 9, region: A.get('blank'), capFirst: true, color: TECH.gearDark }), null, { xf: { p: [0, deck, 0.03] } });
  // Werfer, angehoben: Verschluss, Schiene, Spulenringe (abwechselnd Schale und Leuchte), Muendung
  // launcher, raised: breech, rail, coil rings (alternating shell and glow), muzzle
  b.group({ p: [0, deck + 0.064, 0.012], r: [-0.48, 0, 0] }, () => {
    const len = 0.42;
    b.add(boxed(softBox(0.086, 0.076, 0.12, 0.012, hi ? 1 : 0), { p: [0, 0, -0.03] }, F), TECH.shell);
    b.add(softBox(0.05, 0.05, len, 0.01), TECH.gear, { xf: { p: [0, 0, 0.03 + len / 2] } });
    b.add(softBox(0.012, 0.058, len * 0.92, 0.003), TECH.coil, { xf: { p: [0, 0, 0.03 + len / 2] } });
    const n = hi ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const z = 0.075 + (i / (n - 1)) * (len - 0.09), glow = i % 2 === 0;
      b.add(loft([{ y: 0.01, rx: 0.031, e: 4, hard: true }, { y: 0.01, rx: 0.04, e: 4, hard: true }, { y: -0.01, rx: 0.04, e: 4, hard: true }, { y: -0.01, rx: 0.031, e: 4, hard: true }], { seg: hi ? 12 : 8, region: A.get(glow ? 'glowStrip' : 'blank'), color: glow ? TECH.glow : TECH.shell }), null, { xf: { p: [0, 0, z], r: [HALF_PI, 0, 0] }, crease: glow ? 0 : 1 });
    }
    b.add(softBox(0.074, 0.074, 0.024, 0.01), TECH.gearDark, { xf: { p: [0, 0, 0.03 + len] } });
    b.add(loft([{ y: 0.004, rx: TIP }, { y: 0.003, rx: 0.02 }, { y: 0, rx: 0.026, hard: true }], { seg: hi ? 12 : 7, region: A.get('blank'), color: TECH.glow }), null, { xf: { p: [0, 0, 0.042 + len], r: [HALF_PI, 0, 0] }, crease: 0 });
    if (hi) for (const s of [-1, 1]) b.add(softBox(0.006, 0.012, len * 0.85, 0.002), TECH.gearDark, { xf: { p: [s * 0.029, 0.02, 0.03 + len / 2] } });
  });
  // Bediener mit Steuertafel: dieselbe Figur im Massstab CREW, mit Beinen / operator with a control panel: the same figure at the scale CREW, with legs
  crew(b, A, f, {
    p: [0.215, 0, -0.14], yaw: -0.6, legs: true, seed: 13,
    pose: { ...standPose([[-0.04, 0.35, 0.1], [0.04, 0.35, 0.1]]), head: [0.1, 0.1, 0] },
    extra: () => {
      b.add(softBox(0.12, 0.012, 0.085, 0.004), TECH.gearDark, { xf: { p: [0, 0.345, 0.13], r: [0.6, 0, 0] } });
      glowBar(b, A, [0, 0.354, 0.132], 0.085, 0.006, 0.05, 'py', [0.6, 0, 0]);
    },
  });
  // Antenne mit Leuchtspitze / antenna with a glow tip
  tube(b, A, [-0.08, deck + 0.064, -0.19], [-0.09, deck + 0.25, -0.21], 0.003, 0.002, mat.dark, hi ? 5 : 3);
  glowDot(b, A, [-0.09, deck + 0.255, -0.21], 0.008);
  return b;
}

// ---------- Tesla-Panzer / Tesla tank ----------

/** Tesla-Spule: Isolatorfuss, Saeule mit Leuchtringen, Toroid, Kugel; top = Hoehe der Kugelkuppe / Tesla coil: insulator base, column with glow rings, toroid, sphere; top = height of the sphere's top */
function teslaCoil(b: UvBuilder, A: AtlasLayout, x: number, y: number, z: number, top: number): void {
  const hi = fine(), seg = hi ? 16 : 8;
  b.add(loft([{ y: 0.05, rx: 0.03, hard: true }, { y: 0.05, rx: 0.036, hard: true }, { y: 0.034, rx: 0.038, hard: true }, { y: 0.034, rx: 0.043, hard: true }, { y: 0.017, rx: 0.045, hard: true }, { y: 0.017, rx: 0.05, hard: true }, { y: 0, rx: 0.052 }], { seg, region: A.get('blank'), color: TECH.gearDark }), null, { xf: { p: [x, y, z] } });
  const c0 = y + 0.05, sy = top - 0.024, ty = sy - 0.024, ch = ty - c0;
  b.add(loft([{ y: ch, rx: 0.032 }, { y: 0, rx: 0.036 }], { seg, region: A.get('coil'), color: TECH.coil }), null, { xf: { p: [x, c0, z] }, gloss: 0.3 });
  const n = hi ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const ry = c0 + 0.022 + (i / (n - 1)) * (ch - 0.05);
    if (i % 2 === 0) glowRing(b, A, [x, ry, z], 0.045, 0.018);
    else b.add(loft([{ y: 0.01, rx: 0.035 }, { y: 0.005, rx: 0.046 }, { y: -0.005, rx: 0.046 }, { y: -0.01, rx: 0.035 }], { seg, region: A.get('blank'), color: TECH.shell }), null, { xf: { p: [x, ry, z] } });
  }
  // Toroid und Kugel / toroid and sphere
  b.add(loft([{ y: 0.024, rx: 0.028, hard: true }, { y: 0.021, rx: 0.05 }, { y: 0.011, rx: 0.068 }, { y: 0, rx: 0.074 }, { y: -0.011, rx: 0.068 }, { y: -0.021, rx: 0.05 }, { y: -0.024, rx: 0.028 }], { seg: hi ? 20 : 10, region: A.get('blank'), color: TECH.shell }), null, { xf: { p: [x, ty, z] }, crease: 0 });
  b.add(loft([{ y: 0.024, rx: TIP }, { y: 0.019, rx: 0.015 }, { y: 0.008, rx: 0.023 }, { y: -0.008, rx: 0.023 }, { y: -0.02, rx: 0.014 }], { seg: hi ? 12 : 7, region: A.get('blank'), color: mat.glass }), null, { xf: { p: [x, sy, z] }, gloss: 1, crease: 0 });
}

/** Tesla-Panzer: breite helle Wanne, zwei Spulen (Spitzen = TESLA_TOPS, dort haengt das Brett die Lichtboegen an) / Tesla tank: wide light hull, two coils (tops = TESLA_TOPS, where the board attaches the arcs) */
export function teslaTank(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  // flache Wanne: die Spulen sollen sie ueberragen, ihre Kuppen liegen fest / flat hull: the coils are meant to tower over it, their tops are fixed
  const H: HullSpec = { y0: 0.088, y1: 0.104, y2: 0.14, xb: 0.246, xd: 0.208, zf: 0.252, zr: -0.252, zdf: 0.192, zdr: -0.206 };
  const T: TrackSpec = { x: 0.178, w: 0.108, len: 0.492, h: 0.088, links: 48, thick: 0.012 };
  tankHull(b, A, L, f, H, T, { color: TECH.shell, emblem: 0.042, emblemZ: 0.14 });
  tankGear(b, A, T, 6, TECH.coil, TECH.gearDark, mat.dark);
  // Leuchtleisten an den Flanken, Leuchtband am Bug / light strips on the flanks, light band at the bow
  glowBar(b, A, [H.xb + 0.002, H.y1 + 0.001, -0.02], 0.006, 0.01, 0.36, 'px');
  glowBar(b, A, [-H.xb - 0.002, H.y1 + 0.001, -0.02], 0.006, 0.01, 0.36, 'nx');
  glowBar(b, A, [0, (H.y1 + H.y2) / 2 + 0.003, (H.zf + H.zdf) / 2 + 0.002], 0.24, 0.008, 0.012, 'py', [Math.atan2(H.y2 - H.y1, H.zf - H.zdf), 0, 0]);
  for (const s of [-1, 1]) glowDot(b, A, [s * (H.xd - 0.02), H.y1 + 0.012, H.zf - 0.004], 0.012);
  const F = shellFaces(A);
  // Steuerpult vorn mit Leuchtanzeige, zwei Kondensatorkaesten / control console at the front with a lit display, two capacitor boxes
  b.add(softBox(0.13, 0.05, 0.07, 0.01), TECH.gear, { xf: { p: [0, H.y2 + 0.025, 0.11] } });
  glowBar(b, A, [0, H.y2 + 0.052, 0.112], 0.07, 0.006, 0.036, 'py');
  for (const s of [-1, 1]) b.add(boxed(softBox(0.07, 0.05, 0.09, 0.008, hi ? 1 : 0), { p: [s * 0.16, H.y2 + 0.025, 0.1] }, { ...F, py: A.get('hatchSquare') }), TECH.shell);
  // zwei Spulen: Kugelkuppen an den festen Punkten der Lichtboegen / two coils: sphere tops at the fixed points of the arcs
  for (const [x, y, z] of TESLA_TOPS) teslaCoil(b, A, x, H.y2, z, y);
  // Kondensatorbank am Heck mit Kuehlgitter, Antenne / capacitor bank at the rear with a cooling grille, antenna
  b.add(boxed(softBox(0.3, 0.07, 0.1, 0.012, hi ? 1 : 0), { p: [0, H.y2 + 0.035, -0.15] }, { ...F, py: A.get('grille') }), TECH.gear);
  for (const s of [-1, 1]) b.add(softBox(0.046, 0.044, 0.09, 0.008), TECH.gearDark, { xf: { p: [s * 0.182, H.y2 + 0.022, -0.1] } });
  tube(b, A, [0.17, H.y2 + 0.09, -0.15], [0.175, H.y2 + 0.27, -0.17], 0.0045, 0.003, mat.dark, hi ? 6 : 4);
  glowDot(b, A, [0.175, H.y2 + 0.278, -0.17], 0.011);
  return b;
}

// ---------- Oktokopter / octocopter ----------

/** Arme wie in velkarTech.ts (dort haengt das Brett die Rotoren an) / arms as in velkarTech.ts (where the board attaches the rotors) */
const OCTO_R = 0.28;
const OCTO_ARMS: V3[] = Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return [Math.sin(a) * OCTO_R, 0, Math.cos(a) * OCTO_R] as V3; });

/** Oktokopter: Rumpfkapsel mit dunkler Glaskuppel, acht Arme mit Motoren und Schutzringen, Sensorkapsel / octocopter: body pod with a dark glass dome, eight arms with motors and guard rings, sensor pod */
export function octocopter(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine();
  const by = 0.16, ry = OCTO_ROTOR_Y;
  // Rumpfkapsel: helle Schale, grauer Guertel / body pod: light shell, grey belt
  const k = 1.22;
  b.add(loft([
    { y: by + 0.074, rx: 0.03, rz: 0.03 * k, hard: true, c: TECH.shell }, { y: by + 0.064, rx: 0.07, rz: 0.07 * k }, { y: by + 0.044, rx: 0.096, rz: 0.096 * k },
    { y: by + 0.03, rx: 0.102, rz: 0.102 * k, hard: true }, { y: by + 0.03, rx: 0.106, rz: 0.106 * k, hard: true, c: TECH.gear }, { y: by + 0.012, rx: 0.106, rz: 0.106 * k, hard: true },
    { y: by + 0.012, rx: 0.1, rz: 0.1 * k, hard: true, c: TECH.shellShade }, { y: by - 0.008, rx: 0.074, rz: 0.074 * k }, { y: by - 0.02, rx: 0.03, rz: 0.03 * k },
  ], { seg: hi ? 24 : 12, region: A.get('panel:velkar'), capFirst: true, capLast: true }), null);
  b.add(shaped([{ y: 0.034, rx: TIP }, { y: 0.029, rx: 0.03, rz: 0.04 }, { y: 0.016, rx: 0.048, rz: 0.064 }, { y: 0, rx: 0.054, rz: 0.072, hard: true }], { py: A.get('canopy'), all: A.get('canopy'), seg: hi ? 16 : 9, xf: { p: [0, by + 0.066, 0.02] } }), mat.glassDark, { gloss: 0.5, crease: 0.3 });
  glowBar(b, A, [0, by + 0.036, 0.128], 0.06, 0.008, 0.006, 'pz');
  // Arme mit Motoren, Naben, Schutzringen und Statuslichtern / arms with motors, hubs, guard rings and status lights
  OCTO_ARMS.forEach(([x, , z], i) => {
    tube(b, A, [x * 0.3, by + 0.022, z * 0.3], [x, by + 0.04, z], 0.012, 0.009, TECH.gear, hi ? 6 : 4);
    b.add(loft([{ y: 0.046, rx: 0.012, hard: true }, { y: 0.04, rx: 0.022, hard: true }, { y: 0, rx: 0.026, hard: true }, { y: -0.006, rx: 0.016 }], { seg: hi ? 10 : 6, region: A.get('blank'), color: TECH.gearDark }), null, { xf: { p: [x, by + 0.02, z] } });
    tube(b, A, [x, by + 0.06, z], [x, ry, z], 0.007, 0.007, mat.dark, 5);
    b.add(loft([{ y: 0.012, rx: TIP }, { y: 0.008, rx: 0.009 }, { y: 0, rx: 0.012 }], { seg: hi ? 8 : 5, region: A.get('blank'), color: TECH.shell }), null, { xf: { p: [x, ry + 0.003, z] }, crease: 0 });
    tub(b, A, [x, ry - 0.016, z], OCTO_BLADE + 0.016, 0.024, 0.01, hi ? 20 : 10, TECH.shell, 'blank', TECH.shellShade);
    if (hi) for (const a of [Math.atan2(x, z), Math.atan2(x, z) + HALF_PI]) b.add(block(0.004, 0.004, OCTO_BLADE * 2 + 0.02, 0.001), TECH.gearDark, { xf: { p: [x, ry - 0.01, z], r: [0, a, 0] }, crease: 0 });
    glowDot(b, A, [x * 1.07, by + 0.022, z * 1.07], 0.009);
    if (i % 4 === 0) glowBar(b, A, [x * 0.62, by + 0.047, z * 0.62], 0.044, 0.006, 0.008, 'py', [0, Math.atan2(x, z) + HALF_PI, 0]);
    // andere Fraktionen haben keine beweglichen Rotoren: feste Blaetter / other factions have no moving rotors: fixed blades
    if (!isTech(f)) b.add(block(0.018, 0.005, OCTO_BLADE * 2, 0.002), TECH.gearDark, { xf: { p: [x, ry, z], r: [0, i * 0.7, 0] }, crease: 0 });
  });
  // Landekufen, Sensorkapsel unter dem Rumpf / landing skids, sensor pod under the body
  for (const s of [-1, 1]) {
    tube(b, A, [s * 0.078, OCTO_LIFT - 0.02, -0.11], [s * 0.078, OCTO_LIFT - 0.02, 0.11], 0.007, 0.007, TECH.gearDark, hi ? 6 : 4);
    for (const z of [-0.06, 0.06]) tube(b, A, [s * 0.078, OCTO_LIFT - 0.018, z], [s * 0.046, by - 0.004, z], 0.005, 0.005, TECH.gearDark, 4);
  }
  b.add(loft([{ y: 0.02, rx: 0.026 }, { y: 0, rx: 0.036 }, { y: -0.022, rx: 0.028 }, { y: -0.03, rx: TIP }], { seg: hi ? 12 : 7, region: A.get('blank'), color: TECH.gearDark }), null, { xf: { p: [0, by - 0.026, 0.04] } });
  glowDot(b, A, [0, by - 0.04, 0.066], 0.011);
  tube(b, A, [0, by + 0.07, -0.07], [0, by + 0.19, -0.09], 0.003, 0.002, mat.dark, hi ? 5 : 3);
  glowDot(b, A, [0, by + 0.196, -0.09], 0.008);
  emblemDecal(b, A, f, [0, by + 0.054, -0.085], [0, 0.82, -0.57], 0.04, TECH.shell, [0, 0.57, 0.82]);
  return b;
}
