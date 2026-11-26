/**
 * Gezeichnete Einheiten: Flugabwehr und Minenleger aller Fraktionen / inked units: anti-air and mine layer of every faction.
 *
 * Beide stehen auf dem Wannenbau der Panzer (tankHull) mit kleineren Massen und teilen dessen Wannenzellen.
 * - Flugabwehr: offener Drehturm mit zwei Seitenschilden und vier steil gerichteten Rohren, Radar am Turmheck. Meridon
 *   faehrt den Turm auf einem sechsraedrigen Lastwagen, die Hightech-Bauart traegt einen Raketenkasten mit Leuchtkappen.
 * - Minenleger: flacher Kettentraeger mit Raeumschild (Warnstreifen gezeichnet), Fahrer im offenen Stand (Massstab CREW),
 *   Minen in einer Wanne am Heck, Wimpel.
 * Both stand on the tanks' hull construction (tankHull) with smaller dimensions and share its hull cells.
 * - Anti-air: open rotating turret with two side shields and four steeply laid barrels, radar at the turret rear.
 *   Meridon carries the turret on a six-wheeled lorry, the hi-tech design carries a missile box with glowing caps.
 * - Mine layer: flat tracked carrier with a dozer blade (warning stripes drawn), driver in an open station (scale CREW),
 *   mines in a tray at the rear, pennant.
 */
import type { FactionId } from '../../../data/balance';
import { fine, geo, shade, softBox, type V3 } from '../kit';
import { look, mat, styleOf, type Look } from '../look';
import { arc, rrect, type Cell, type Pen } from './atlas';
import { block, boxed, crew, CREW_DIM, gripPose, hullZ, TIP, tube } from './body';
import { wheelPair } from './car';
import { CREW } from './figure';
import { hullFittings, ringZ, tankGear, tankHull, type HullSpec } from './tanks';
import { BARE, emblemDecal, MUD_DRY, MUD_WET, SOOT, type TrackSpec } from './trim';
import { AtlasLayout, loft, UvBuilder, type BoxFaces } from './uvkit';

const HALF_PI = Math.PI / 2;

// ---------- Zellen / cells ----------

/** Raeumschild (256 x 72): Warnstreifen gelb / schwarz als Lackierung, Kratzer, Schlamm an der Schneide / dozer blade: yellow / black warning stripes as paint, scratches, mud at the cutting edge */
function paintDozer(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill([[0, 8], [W, 8], [W, H - 14], [0, H - 14]], mat.yellow, 0.96);
  for (let x = -H; x < W + H; x += 44) p.fill([[x, H - 14], [x + 22, H - 14], [x + 22 + (H - 22), 8], [x + (H - 22), 8]], mat.ink, 0.96);
  for (const y of [8, H - 14]) p.line([[-2, y], [W + 2, y]], 1.5, { taper: 0, wobble: 0.25 });
  p.rivets([10, 4], [W - 10, 4], 12, 2.2);
  p.fill([[0, H - 9], [W, H - 9], [W, H], [0, H]], BARE, 0.9);
  p.scratches(0, 10, W, H - 26, 14, 1001, 26);
  p.chips(0, 8, W, H - 22, 22, BARE, 1009, 3.4);
  p.mud(0, H * 0.5, W, H * 0.5, MUD_WET, MUD_DRY, 1013, 0.3);
}
/** Mine von oben (64 x 64): Druckplatte, Tragegriff, Verschraubung / mine from above: pressure plate, carrying handle, fuse cap */
function paintMine(p: Pen): void {
  const c = p.w / 2;
  p.line(arc(c, c, 28, 28, 0, Math.PI * 2, 24), 2, { closed: true, wobble: 0.2 });
  p.dab(c, c, 21, 0.8, 0.9);
  p.line(arc(c, c, 20, 20, 0, Math.PI * 2, 20), 1.6, { closed: true, wobble: 0.2 });
  p.fill(arc(c, c, 7, 7, 0, Math.PI * 2, 12), mat.red, 0.95);
  p.line(arc(c, c, 7, 7, 0, Math.PI * 2, 12), 1.5, { closed: true, wobble: 0.1 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; p.rivet(c + Math.cos(a) * 24.5, c + Math.sin(a) * 24.5, 1.9); }
  p.line(arc(c, c, 14, 14, 0.5, 2.2, 6), 2.6, { taper: 0.15 });
  p.splatter(4, 4, p.w - 8, p.h - 8, 6, MUD_DRY, 1019, { size: 3, alpha: 0.6, rise: 1 });
}
/** Schild der Flugabwehr (128 x 160): von der Seite, Oberkante oben; Trittstufen, Sehschlitz, Nieten / anti-air shield: from the side, top edge up; steps, vision slit, rivets */
function paintFlakShield(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(8, 8, W - 16, H - 16, 6).concat([[W - 14, 8]]), 1.6);
  p.rivets([14, 16], [W - 14, 16], 6, 2.3);
  p.rivets([14, H - 14], [W - 14, H - 14], 7, 2.3);
  p.fill(rrect(W * 0.3, H * 0.3, 44, 8, 2.5), SOOT);
  p.panel(rrect(W * 0.3 - 5, H * 0.3 - 5, 54, 18, 4).concat([[W * 0.3 + 44, H * 0.3 - 5]]), 1.5);
  for (const y of [H * 0.56, H * 0.72]) { p.line([[W * 0.2, y], [W * 0.5, y]], 2.6, { taper: 0.1, wobble: 0.2 }); p.crease([[W * 0.2, y + 3], [W * 0.5, y + 3]], 2.4, 0.74, 0.6, { taper: 0.2 }); }
  p.scratches(8, 12, W - 16, H - 28, 9, 1021, 22);
  p.chips(0, 0, W, 8, 8, BARE, 1031, 2.8);
  p.chips(0, H - 9, W, 8, 8, BARE, 1033, 2.8);
}

/** Zellen von Flugabwehr und Minenleger / cells of anti-air and mine layer */
export function supportCells(): Cell[] {
  return [
    { name: 'dozer', w: 256, h: 72, paint: paintDozer },
    { name: 'mine', w: 64, h: 64, paint: paintMine },
    { name: 'flakShield', w: 128, h: 160, paint: paintFlakShield },
  ];
}

// ---------- Flugabwehr / anti-air ----------

/** Drehturm der Flugabwehr um den Ursprung (Turmkranz) / the anti-air turret about the origin (turret ring) */
function flakTurret(b: UvBuilder, A: AtlasLayout, L: Look, f: FactionId, tech: boolean): void {
  const hi = fine();
  b.add(loft([{ y: 0.022, rx: 0.086, hard: true }, { y: 0.022, rx: 0.096, hard: true }, { y: 0, rx: 0.104 }], { seg: hi ? 22 : 11, region: A.get('blank'), capFirst: true, color: L.hullDark }), null);
  if (tech) {
    // Raketenkasten mit vier Leuchtkappen, kleiner Radarschirm / missile box with four glowing caps, small radar dish
    b.add(loft([{ y: 0.09, rx: 0.04, hard: true }, { y: 0.02, rx: 0.06 }], { seg: hi ? 12 : 7, region: A.get('blank'), color: L.hullDark }), null);
    b.group({ p: [0, 0.16, 0.0], r: [-0.55, 0, 0] }, () => {
      b.add(boxed(softBox(0.2, 0.11, 0.21, 0.012, hi ? 1 : 0), {}, { px: A.get('plate'), nx: A.get('plate'), py: A.get('plate'), all: A.get('blank') }), L.hull);
      for (const x of [-0.048, 0.048]) for (const y of [-0.026, 0.026]) {
        b.add(loft([{ y: 0.006, rx: 0.02, hard: true }, { y: 0.006, rx: 0.025, hard: true }, { y: -0.004, rx: 0.025 }], { seg: hi ? 12 : 7, region: A.get('blank'), color: mat.dark }), null, { xf: { p: [x, y, 0.105], r: [HALF_PI, 0, 0] } });
        b.add(loft([{ y: 0.004, rx: TIP }, { y: 0.002, rx: 0.014 }, { y: 0, rx: 0.019 }], { seg: hi ? 10 : 6, region: A.get('blank'), color: L.secondary }), null, { xf: { p: [x, y, 0.111], r: [HALF_PI, 0, 0] }, crease: 0 });
      }
    });
        tube(b, A, [0.086, 0.02, -0.07], [0.086, 0.345, -0.08], 0.006, 0.004, mat.dark, 5);
    b.add(loft([{ y: 0.012, rx: 0.01, hard: true }, { y: 0.006, rx: 0.03 }, { y: 0, rx: 0.042, hard: true }, { y: -0.008, rx: 0.018 }], { seg: hi ? 12 : 7, region: A.get('blank'), color: shade(L.hull, 1.1) }), null, { xf: { p: [0.086, 0.35, -0.08], r: [0.3, 0, 0] } });
    return;
  }
  // zwei Seitenschilde / two side shields
  const shieldF: BoxFaces = { px: A.get('flakShield'), nx: A.get('flakShield'), mirrorNx: true, all: A.get('blank') };
  for (const s of [-1, 1]) b.add(boxed(geo.profileZY([[-0.078, 0], [0.092, 0], [0.036, 0.19], [-0.078, 0.226]], 0.012), { p: [s * 0.088, 0.018, 0] }, shieldF), L.hull);
  b.add(block(0.17, 0.05, 0.012, 0.004), L.hull, { xf: { p: [0, 0.046, -0.076] } });
  // Wiege und vier Rohre, steil gerichtet / cradle and four barrels, laid steeply
  b.group({ p: [0, 0.1, -0.02], r: [-1.06, 0, 0] }, () => {
    b.add(block(0.11, 0.07, 0.1, 0.012), mat.dark, { xf: { p: [0, 0, -0.01] }, gloss: 0.3 });
    for (const x of [-0.03, 0.03]) for (const y of [-0.02, 0.02]) {
      b.add(loft([{ y: 0.34, rx: 0.0105, hard: true }, { y: 0.08, rx: 0.012, hard: true }, { y: 0.08, rx: 0.016, hard: true }, { y: 0, rx: 0.016, hard: true }], { seg: hi ? 10 : 6, region: A.get('blank'), color: mat.darkMid }), null, { xf: { p: [x, y, 0.03], r: [HALF_PI, 0, 0] }, gloss: 0.5 });
      b.add(loft([{ y: 0.03, rx: 0.014, hard: true }, { y: 0.03, rx: 0.018, hard: true }, { y: 0, rx: 0.016, hard: true }], { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [x, y, 0.37], r: [HALF_PI, 0, 0] }, gloss: 0.4 });
    }
    for (const s of [-1, 1]) b.add(loft([{ y: 0.03, rx: 0.03, hard: true }, { y: -0.03, rx: 0.03, hard: true }], { seg: hi ? 12 : 7, region: A.get('drum'), capFirst: A.get('drumEnd'), capLast: A.get('drumEnd'), color: L.trim }), null, { xf: { p: [s * 0.062, 0, -0.02], r: [0, 0, HALF_PI] } });
  });
  // Radar am Turmheck: Mast und Balkenantenne / radar at the turret rear: mast and bar antenna
  tube(b, A, [0.05, 0.02, -0.085], [0.05, 0.215, -0.1], 0.006, 0.0045, mat.dark, 5);
  b.add(boxed(block(0.11, 0.03, 0.01, 0.003), { p: [0.05, 0.22, -0.1], r: [0.2, 0.3, 0] }, { pz: A.get('grille'), nz: A.get('grille'), all: A.get('blank') }), mat.darkMid);
  emblemDecal(b, A, f, [0.0945, 0.075, -0.02], [1, 0, 0], 0.04, L.hull);
  emblemDecal(b, A, f, [-0.0945, 0.075, -0.02], [-1, 0, 0], 0.04, L.hull);
}

/** Flugabwehr / anti-air */
export function flak(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), st = styleOf(f), hi = fine();
  if (st === 'meridon') {
    // sechsraedriger Lastwagen: Fahrerhaus, Pritsche in der Zweitfarbe, Turm auf der Pritsche / six-wheeled lorry: cab, bed in the secondary colour, turret on the bed
    for (const z of [0.142, -0.04, -0.15]) wheelPair(b, A, 0.142, z, 0.052, 0.046, L.trim);
    b.add(block(0.2, 0.03, 0.4, 0.006), mat.dark, { xf: { p: [0, 0.07, -0.005] } });
    b.add(hullZ([
      { z: 0.212, w: 0.092, up: 0.03, down: 0.044, cy: 0.118, e: 5, hard: true },
      { z: 0.2, w: 0.1, up: 0.04, down: 0.05, cy: 0.122, e: 5 },
      { z: 0.14, w: 0.104, up: 0.076, down: 0.054, cy: 0.126, e: 5 },
      { z: 0.062, w: 0.104, up: 0.08, down: 0.054, cy: 0.126, e: 5, hard: true },
    ], { px: A.get('hatchSquare'), nx: A.get('hatchSquare'), pz: A.get('grille'), all: A.get('blank'), seg: hi ? 18 : 9, capFirst: true, capLast: true }), L.hull);
    b.add(boxed(softBox(0.17, 0.05, 0.005, 0.002), { p: [0, 0.176, 0.177], r: [-0.62, 0, 0] }, { pz: A.get('glass'), py: A.get('glass'), all: A.get('blank') }), mat.glass, { gloss: 0.9, crease: 0 });
    b.add(boxed(softBox(0.25, 0.034, 0.27, 0.006), { p: [0, 0.103, -0.078] }, { px: A.get('crate'), nx: A.get('crate'), nz: A.get('crate'), py: A.get('plate'), all: A.get('blank') }), L.trim);
    for (const s of [-1, 1]) emblemDecal(b, A, f, [s * 0.1045, 0.15, 0.1], [s, 0, 0], 0.036, L.hull);
    b.turret([0, 0.12, -0.078], () => b.group({ p: [0, 0.12, -0.078] }, () => flakTurret(b, A, L, f, false)));
    return b;
  }
  const H: HullSpec = { y0: 0.078, y1: 0.092, y2: 0.128, xb: 0.182, xd: 0.154, zf: 0.202, zr: -0.202, zdf: 0.152, zdr: -0.166 };
  const T: TrackSpec = { x: 0.13, w: 0.084, len: 0.404, h: 0.078, links: 38, thick: 0.01 };
  tankHull(b, A, L, f, H, T, { emblem: st === 'velkar' ? 0.03 : 0 });
  tankGear(b, A, T, 5, L.hullDark, st === 'velkar' ? L.hullDark : L.trim, shade(L.hullDark, 0.5));
  hullFittings(b, A, L, H, st === 'velkar' ? L.secondary : mat.lamp);
  if (st === 'dravon') for (const s of [-1, 1]) b.add(block(0.006, 0.01, 0.34, 0.002), L.trim, { xf: { p: [s * (H.xb + 0.002), H.y1 - 0.003, 0] }, gloss: 0.5 });
  if (st === 'alvenia') for (const s of [-1, 1]) b.add(block(0.007, 0.007, H.zdf - H.zdr, 0.002), L.trim, { xf: { p: [s * H.xd, H.y2 + 0.001, (H.zdf + H.zdr) / 2] }, gloss: 0.6 });
  const tz = ringZ(H);
  b.turret([0, H.y2, tz], () => b.group({ p: [0, H.y2, tz] }, () => flakTurret(b, A, L, f, st === 'velkar')));
  return b;
}

// ---------- Minenleger / mine layer ----------

/** Minenleger / mine layer */
export function mineCarrier(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), st = styleOf(f), hi = fine();
  const H: HullSpec = { y0: 0.07, y1: 0.084, y2: 0.116, xb: 0.202, xd: 0.174, zf: 0.19, zr: -0.3, zdf: 0.15, zdr: -0.272 };
  const T: TrackSpec = { x: 0.15, w: 0.086, len: 0.492, h: 0.072, links: 46, thick: 0.01 };
  b.group({ p: [0, 0, 0] }, () => {
    tankHull(b, A, L, f, H, T, { emblemZ: -0.01, emblem: 0.03 });
    b.group({ p: [0, 0, (H.zf + H.zr) / 2] }, () => tankGear(b, A, T, 6, L.hullDark, L.trim, shade(L.hullDark, 0.5)));
  });
  // ---- Raeumschild mit Warnstreifen, Wangen, Schubarme / dozer blade with warning stripes, cheeks, push arms ----
  const bz = H.zf + 0.07;
  b.add(boxed(softBox(0.42, 0.086, 0.014, 0.004), { p: [0, 0.062, bz], r: [-0.22, 0, 0] }, { pz: A.get('dozer'), all: A.get('blank') }), L.trim);
  for (const s of [-1, 1]) {
    b.add(block(0.018, 0.1, 0.07, 0.005), L.trim, { xf: { p: [s * 0.204, 0.066, bz + 0.016], r: [-0.22, 0, 0] } });
    tube(b, A, [s * 0.13, 0.062, H.zf - 0.01], [s * 0.15, 0.058, bz - 0.006], 0.012, 0.01, mat.dark, hi ? 6 : 4);
  }
  // ---- offener Fahrerstand vorn: Bruestung, Scheibe, Fahrer an den Lenkhebeln / open driver's station at the front: parapet, screen, driver at the steering levers ----
  const dz = 0.045, dx = -0.045, wall = { px: A.get('plate'), nx: A.get('plate'), pz: A.get('plate'), nz: A.get('plate'), all: A.get('blank') } as BoxFaces;
  for (const [w, d, x, z] of [[0.15, 0.012, 0, 0.066], [0.15, 0.012, 0, -0.066], [0.012, 0.132, 0.069, 0], [0.012, 0.132, -0.069, 0]] as const) {
    b.add(boxed(block(w, 0.058, d, 0.004), { p: [dx + x, H.y2 + 0.028, dz + z] }, wall), L.hull);
  }
  b.add(boxed(softBox(0.13, 0.034, 0.004, 0.001), { p: [dx, H.y2 + 0.076, dz + 0.064], r: [-0.3, 0, 0] }, { pz: A.get('glass'), nz: A.get('glass'), all: A.get('blank') }), mat.glass, { gloss: 0.9, crease: 0 });
  for (const s of [-1, 1]) b.add(block(0.008, 0.042, 0.008, 0.002), L.hullDark, { xf: { p: [dx + s * 0.068, H.y2 + 0.076, dz + 0.064], r: [-0.3, 0, 0] } });
  const dp: V3 = [dx, H.y2 - 0.004 - CREW_DIM.pelvis, dz - 0.012];
  const lever = (s: number): V3 => [dx + s * 0.03, H.y2 + 0.064, dz + 0.036];
  for (const s of [-1, 1]) tube(b, A, [lever(s)[0], H.y2 + 0.01, dz + 0.05], lever(s), 0.004, 0.004, mat.dark, 5);
  const hand = (s: number): V3 => [(lever(s)[0] - dp[0]) / CREW, (lever(s)[1] - dp[1]) / CREW, (lever(s)[2] - dp[2]) / CREW];
  crew(b, A, f, { p: dp, pose: gripPose(hand(-1), hand(1), [0.04, 0.06, 0]), seed: 9 });
  // ---- Minenwanne am Heck in der Zweitfarbe, sechs Minen, Ablaufrutsche / mine tray at the rear in the secondary colour, six mines, chute ----
  const tz0 = -0.06, tz1 = -0.262, ty = H.y2;
  const trayF = { px: A.get('crate'), nx: A.get('crate'), nz: A.get('crate'), pz: A.get('crate'), all: A.get('blank') } as BoxFaces;
  for (const s of [-1, 1]) b.add(boxed(block(0.014, 0.05, tz0 - tz1, 0.004), { p: [s * 0.16, ty + 0.025, (tz0 + tz1) / 2] }, trayF), L.trim);
  b.add(boxed(block(0.334, 0.05, 0.014, 0.004), { p: [0, ty + 0.025, tz0] }, trayF), L.trim);
  b.add(block(0.31, 0.006, tz0 - tz1, 0.002), mat.darkMid, { xf: { p: [0, ty + 0.004, (tz0 + tz1) / 2] } });
  for (const x of [-0.104, 0, 0.104]) for (const z of [-0.112, -0.208]) {
    b.add(loft([{ y: 0.022, rx: 0.034, hard: true }, { y: 0.022, rx: 0.041, hard: true }, { y: 0, rx: 0.043 }], { seg: hi ? 14 : 8, region: A.get('blank'), capFirst: A.get('mine'), color: st === 'alvenia' ? shade(L.hull, 0.86) : L.hullDark }), null, { xf: { p: [x, ty + 0.006, z] } });
  }
  b.add(block(0.3, 0.008, 0.07, 0.003), mat.darkMid, { xf: { p: [0, ty - 0.012, H.zr - 0.014], r: [-0.5, 0, 0] } });
  // ---- Wimpel, Scheinwerfer, Antenne der Hightech-Bauart / pennant, headlights, the hi-tech design's antenna ----
  hullFittings(b, A, L, { ...H, zdr: H.zdr + 0.012 }, st === 'velkar' ? L.secondary : mat.lamp);
  const fp: V3 = [0.16, ty + 0.05, tz1 + 0.01];
  tube(b, A, fp, [fp[0], fp[1] + 0.1, fp[2]], 0.004, 0.003, mat.dark, 5);
  b.add(block(0.004, 0.03, 0.05, 0.001), L.hull, { xf: { p: [fp[0], fp[1] + 0.082, fp[2] - 0.028] }, crease: 0 });
  if (st === 'velkar') {
    tube(b, A, [-0.16, ty + 0.05, tz1 + 0.01], [-0.165, ty + 0.15, tz1], 0.003, 0.002, mat.dark, 4);
    b.add(loft([{ y: 0.008, rx: TIP }, { y: 0, rx: 0.008 }, { y: -0.008, rx: TIP }], { seg: 6, region: A.get('blank'), color: L.secondary }), null, { xf: { p: [-0.165, ty + 0.155, tz1] }, crease: 0 });
  }
  return b;
}
