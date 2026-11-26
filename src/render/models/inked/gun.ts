/**
 * Gezeichnete Einheiten: Feldgeschuetz (Artillerie) aller Fraktionen / inked units: the field gun (artillery) of every faction.
 *
 * Erkennungsmerkmale bleiben: zwei grosse Raeder, Spreizlafette, Schutzschild in der Form der Fraktion, langes angehobenes
 * Rohr mit Muendungsbremse, zwei Mann Bedienung (Richtschuetze, Ladeschuetze mit Granate), Munitionskiste.
 * Der Schild ist eine Flaeche mit eigener Zeichnung (Sehschlitz, Rohrausschnitt, Nieten, Abplatzer); Raeder und Rohr
 * kommen aus dem Fahrzeug-Baukasten. Die Bedienung sind dieselben Figuren wie die Fusstruppen im Massstab CREW, mit
 * Beinen, weil sie neben dem Geschuetz stehen.
 * The marks of identity stay: two large wheels, split trail, gun shield in the faction's shape, long raised barrel with
 * a muzzle brake, two crew (gunner, loader with a shell), ammunition crate. The shield is one surface with its own
 * drawing (vision slit, barrel cut-out, rivets, chips); wheels and barrel come from the vehicle kit. The crew are the
 * same figures as the foot troops at the scale CREW, with legs because they stand beside the gun.
 */
import type { FactionId } from '../../../data/balance';
import { fine, geo, softBox, type V3 } from '../kit';
import { look, mat, styleOf, type Look } from '../look';
import { rrect, type Cell, type Pen } from './atlas';
import { block, boxed, crew, shaped, TIP, tube } from './body';
import { standPose } from './figure';
import { BARE, barrel, emblemDecal, MUD_DRY, MUD_WET, SOOT, streaks, wheel } from './trim';
import { AtlasLayout, loft, UvBuilder, type BoxFaces } from './uvkit';

const HALF_PI = Math.PI / 2;
/** Massstab des Geschuetzes gegen seine Baumasse / scale of the gun against its build dimensions */
const GUN_SCALE = 1.2;

/** Schutzschild (256 x 128): von vorn, Oberkante oben / gun shield: from the front, top edge up */
function paintShield(p: Pen): void {
  const W = p.w, H = p.h, c = W / 2;
  // Rohrausschnitt unten in der Mitte, Sehschlitz links davon / barrel cut-out at the bottom centre, vision slit left of it
  const notch = [[c - 26, H + 2], [c - 26, H * 0.56], ...[0, 1, 2, 3, 4, 5, 6].map((i): [number, number] => [c - 26 * Math.cos((i / 6) * Math.PI), H * 0.56 - 22 * Math.sin((i / 6) * Math.PI)]), [c + 26, H * 0.56], [c + 26, H + 2]] as [number, number][];
  p.fill(notch, SOOT, 0.94);
  p.panel(notch.slice(1, -1), 1.9);
  const vx = W * 0.26, vy = H * 0.34;
  p.fill(rrect(vx - 20, vy - 5, 40, 10, 2.5), SOOT);
  p.panel(rrect(vx - 26, vy - 11, 52, 22, 4).concat([[vx + 22, vy - 11]]), 1.6);
  for (const bx of [vx - 31, vx + 31]) p.rivet(bx, vy, 2.2);
  // Schildfluegel: zwei Fugen, Nieten rundum / shield wings: two joints, rivets all round
  for (const x of [W * 0.14, W * 0.86]) p.panel([[x, 8], [x, H - 8]], 1.6);
  p.rivets([12, 9], [W - 12, 9], 14, 2.4);
  for (const x of [8, W - 8]) p.rivets([x, 22], [x, H - 14], 5, 2.3);
  // Halter der Zieloptik / sight bracket
  p.fill(rrect(W * 0.7, H * 0.26, 22, 14, 2), BARE);
  p.line(rrect(W * 0.7, H * 0.26, 22, 14, 2), 1.3, { closed: true, wobble: 0.1 });
  streaks(p, 0, 6, W, H * 0.6, 8, 901);
  p.scratches(10, 14, W - 20, H - 40, 12, 907, 24);
  p.chips(0, 0, W, 8, 16, BARE, 911, 3);
  p.chips(0, H - 9, W, 8, 10, BARE, 919, 2.8);
  p.mud(0, H * 0.62, W * 0.36, H * 0.38, MUD_WET, MUD_DRY, 929, 0.3);
  p.mud(W * 0.64, H * 0.62, W * 0.36, H * 0.38, MUD_WET, MUD_DRY, 937, 0.3);
}

/** Zellen des Feldgeschuetzes / cells of the field gun */
export function gunCells(): Cell[] {
  return [{ name: 'shield', w: 256, h: 128, paint: paintShield }];
}

/** Granate entlang x / shell along x */
export function shell(b: UvBuilder, A: AtlasLayout, p: V3, len: number, r: number, rot: V3 = [0, 0, -HALF_PI]): void {
  b.add(loft([{ y: len * 0.5 + r * 2.4, rx: TIP, c: mat.dark }, { y: len * 0.5 + r * 0.9, rx: r * 0.7 }, { y: len * 0.5, rx: r, hard: true }, { y: len * 0.5, rx: r, hard: true, c: mat.gold }, { y: -len * 0.5, rx: r, hard: true }], { seg: fine() ? 8 : 5, region: A.get('blank'), capLast: true }), null, { xf: { p, r: rot }, gloss: 0.6, crease: 0.5 });
}

/** Schild je Bauart; Ursprung = Unterkante Mitte, Blick +z / shield per design; origin = bottom centre, facing +z */
function shield(b: UvBuilder, A: AtlasLayout, L: Look, f: FactionId): void {
  const S: BoxFaces = { pz: A.get('shield'), nz: A.get('plate'), all: A.get('blank') };
  const hi = fine();
  switch (styleOf(f)) {
    case 'korvat':
      b.add(boxed(softBox(0.38, 0.19, 0.013, 0.004), { p: [0, 0.095, 0] }, S), L.hull);
      b.add(block(0.386, 0.02, 0.026, 0.006), L.hullDark, { xf: { p: [0, 0.192, -0.004] } });
      break;
    case 'dravon':
      b.add(boxed(geo.profileXY([[-0.2, 0], [0.2, 0], [0.184, 0.128], [0.058, 0.206], [-0.058, 0.206], [-0.184, 0.128]], 0.014), {}, S), L.hull);
      b.add(block(0.36, 0.022, 0.006, 0.002), L.trim, { xf: { p: [0, 0.016, 0.009] }, gloss: 0.5 });
      if (hi) b.add(softBox(0.1, 0.008, 0.006, 0.002), L.trim, { xf: { p: [0, 0.196, 0.008] }, gloss: 0.5 });
      break;
    case 'alvenia':
      // runder Schild mit Goldrand / round shield with a gold rim
      b.add(shaped([{ y: 0.007, rx: 0.19, rz: 0.118, hard: true }, { y: -0.007, rx: 0.19, rz: 0.118, hard: true }], { ...S, seg: hi ? 28 : 14, xf: { p: [0, 0.112, 0], r: [-HALF_PI, 0, 0] }, capFirst: true, capLast: true }), L.hull);
      b.add(loft([{ y: 0.01, rx: 0.186, rz: 0.114, hard: true }, { y: 0.01, rx: 0.198, rz: 0.126, hard: true }, { y: -0.008, rx: 0.198, rz: 0.126, hard: true }], { seg: hi ? 28 : 14, region: A.get('blank'), color: L.trim }), null, { xf: { p: [0, 0.112, 0], r: [HALF_PI, 0, 0] }, gloss: 0.6 });
      break;
    case 'meridon':
      b.add(boxed(softBox(0.34, 0.165, 0.012, 0.004), { p: [0, 0.086, 0] }, S), L.hull);
      for (const s of [-1, 1]) b.add(block(0.014, 0.17, 0.016, 0.004), L.trim, { xf: { p: [s * 0.166, 0.086, 0.002] } });
      break;
    default:
      // Hightech: verjuengter Schild, Zielgeraet mit Leuchte / hi-tech: tapered shield, sight unit with a light
      b.add(boxed(geo.profileXY([[-0.19, 0], [0.19, 0], [0.148, 0.176], [-0.148, 0.176]], 0.014), {}, S), L.hull);
      b.add(block(0.046, 0.03, 0.03, 0.006), mat.dark, { xf: { p: [0.085, 0.15, -0.02] } });
      b.add(boxed(softBox(0.034, 0.008, 0.004, 0.001), { p: [0.085, 0.152, -0.004] }, { pz: A.get('glowStrip'), all: A.get('blank') }), L.secondary, { crease: 0 });
      b.add(boxed(softBox(0.3, 0.007, 0.004, 0.001), { p: [0, 0.172, 0.009] }, { pz: A.get('glowStrip'), all: A.get('blank') }), L.secondary, { crease: 0 });
  }
}

/** Feldgeschuetz; A = Atlas der Radfahrzeuge und Geschuetze / field gun; A = atlas of wheeled vehicles and guns */
export function fieldGun(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), st = styleOf(f), hi = fine();
  const big = st === 'dravon' ? 1.16 : 1;
  const wr = st === 'meridon' ? 0.074 : 0.08;
  // das Geschuetz ist groesser gebaut als die Bedienung (einheitlicher Massstab CREW): so bleibt es die Hauptsache
  // the gun is built larger than its crew (uniform scale CREW): that keeps it the main thing
  b.group({ s: GUN_SCALE }, () => {
    // ---- Raeder, Achse, Spreizlafette mit Spornen / wheels, axle, split trail with spades ----
    b.mirrorX(() => wheel(b, A, 0.152, wr, 0.02, wr, 0.036, 'wheel', L.hull, hi ? 20 : 10));
    tube(b, A, [-0.14, wr, 0.02], [0.14, wr, 0.02], 0.011, 0.011, mat.dark, hi ? 8 : 5);
    b.mirrorX(() => {
      b.group({ p: [0.036, wr - 0.012, -0.03], r: [-0.12, -0.34, 0] }, () => {
        b.add(boxed(block(0.032, 0.032, 0.34, 0.006), { p: [0, 0, -0.17] }, { py: A.get('rivets'), all: A.get('blank') }), L.hullDark);
        b.add(block(0.066, 0.056, 0.012, 0.003), mat.dark, { xf: { p: [0, -0.012, -0.342] } });
        if (hi) b.add(softBox(0.01, 0.014, 0.05, 0.003), mat.dark, { xf: { p: [0.021, 0.006, -0.25] } });
      });
    });
    // ---- Wiege, Schild / cradle, shield ----
    b.add(block(0.1, 0.07, 0.13, 0.014), L.hull, { xf: { p: [0, wr + 0.03, 0] } });
    b.group({ p: [0, wr - 0.012, 0.082], r: [-0.2, 0, 0] }, () => shield(b, A, L, f));
    const sy = wr + 0.09;
    emblemDecal(b, A, f, [st === 'alvenia' ? 0.1 : 0.118, sy + (st === 'alvenia' ? 0.02 : 0.05), 0.082 - (sy + (st === 'alvenia' ? 0.02 : 0.05) - wr + 0.012) * Math.tan(0.2) + 0.008], [0, Math.sin(0.2), Math.cos(0.2)], 0.046, L.hull);
    // ---- Rohr, angehoben: Verschluss, Ruecklaufzylinder, Muendungsbremse / barrel, raised: breech, recoil cylinder, muzzle brake ----
    b.group({ p: [0, wr + 0.066, -0.012], r: [-0.42, 0, 0] }, () => {
      b.add(block(0.064, 0.056, 0.15, 0.012), L.hullDark, { xf: { p: [0, 0, 0] } });
      b.add(block(0.056, 0.058, 0.044, 0.01), mat.dark, { xf: { p: [0, 0, -0.092] }, gloss: 0.3 });
      b.add(loft([{ y: 0.17, rx: 0.011, hard: true }, { y: 0.17, rx: 0.014, hard: true }, { y: 0, rx: 0.014, hard: true }], { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true, color: L.hull }), null, { xf: { p: [0, 0.038, -0.01], r: [HALF_PI, 0, 0] }, gloss: 0.4 });
      barrel(b, A, { x: 0, y: 0, z0: 0.07, len: st === 'dravon' ? 0.318 : 0.3, r: 0.021 * big, color: L.hullDark });
      if (hi) tube(b, A, [0.03, 0, -0.1], [0.046, -0.03, -0.122], 0.0035, 0.0035, mat.metal, 5);
    });
    // Richtrad am Schild / handwheel at the shield
    if (hi) b.legacy((k) => k.add(geo.torus(0.019, 0.003, 4, 12), mat.dark, { p: [0.064, wr + 0.05, -0.03], r: [0, HALF_PI, 0] }), { crease: 0 });
  });
  // ---- Bedienung: Richtschuetze rechts, Ladeschuetze links mit Granate / crew: gunner right, loader left with a shell ----
  crew(b, A, f, { p: [0.25, 0, -0.1], yaw: -0.6, legs: true, seed: 13, pose: { ...standPose([[-0.04, 0.37, 0.11], [0.04, 0.37, 0.11]]), head: [0.06, 0.1, 0] } });
  crew(b, A, f, { p: [-0.25, 0, -0.16], yaw: 0.75, legs: true, seed: 17, pose: { ...standPose([[-0.045, 0.31, 0.11], [0.045, 0.32, 0.11]]), head: [0.05, -0.1, 0] }, extra: () => shell(b, A, [0, 0.33, 0.125], 0.11, 0.022) });
  // ---- Munitionskiste mit Granaten, Huelsen am Boden / ammunition crate with shells, spent cases on the ground ----
  b.add(boxed(block(0.1, 0.044, 0.066, 0.006), { p: [-0.29, 0.022, 0.09] }, { px: A.get('crate'), nx: A.get('crate'), pz: A.get('crate'), nz: A.get('crate'), all: A.get('blank') }), mat.wood);
  for (const x of hi ? [-0.318, -0.29, -0.262] : [-0.31, -0.27]) shell(b, A, [x, 0.07, 0.09], 0.05, 0.011, [0, 0, 0]);
  if (hi) for (const [x, z, a] of [[-0.2, 0.17, 0.3], [-0.16, 0.21, 1.2]] as const) b.add(loft([{ y: 0.022, rx: 0.0095, hard: true }, { y: -0.022, rx: 0.01, hard: true }], { seg: 6, region: A.get('blank'), capFirst: true, capLast: true, color: mat.gold }), null, { xf: { p: [x, 0.01, z], r: [HALF_PI, a, 0] }, gloss: 0.6, crease: 0 });
  b.add(block(0.062, 0.042, 0.042, 0.006), L.gear, { xf: { p: [0.3, 0.021, 0.06], r: [0, 0.2, 0] } });
  if (st === 'meridon') b.add(boxed(softBox(0.12, 0.062, 0.084, 0.006), { p: [0, 0.04, -0.3] }, { px: A.get('crate'), nx: A.get('crate'), pz: A.get('crate'), nz: A.get('crate'), all: A.get('blank') }), L.trim);
  return b;
}
