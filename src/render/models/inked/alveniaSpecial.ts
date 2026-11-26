/**
 * Gezeichnete Einheiten: Sonderbauarten der Alvenia (Atlas 'faith'): Reliquiar, Sonnenlanze, Goettlicher Funke.
 * Inked units: Alvenia's special designs (atlas 'faith'): Reliquary, Sun Lance, Divine Spark.
 *
 * Formensprache "Orden im Feld": weisse Panzerplatten, Goldborten, koenigsblaues Tuch, Buntglas, Sonnenkraenze. Die
 * Leuchtfarben (FAITH.halo, FAITH.tech, FAITH.glassBlue, FAITH.glassGold) stehen GENAU so in den Vertexfarben eigener
 * Teile: daraus entsteht die Leuchtmaske (withGlow), nachts leuchten Buntglas, Sonnenkranz und Lichtkristall. Borten,
 * Sterne und Beschlaege in Gold sind in Zellen gezeichnet, die nur Alvenia gehoeren (Name mit ':alvenia').
 * Design language "Order in the field": white armour plates, gold trim, royal blue cloth, stained glass, sun halos.
 * The glow colours (FAITH.halo, FAITH.tech, FAITH.glassBlue, FAITH.glassGold) sit EXACTLY like that in the vertex
 * colours of their own parts: the glow mask (withGlow) is derived from them, at night stained glass, halo and light
 * crystal glow. Trim, stars and fittings in gold are drawn in cells that belong to Alvenia only (name with ':alvenia').
 */
import type { FactionId } from '../../../data/balance';
import { FAITH } from '../alveniaFaith';
import { fine, shade, softBox, type V3 } from '../kit';
import { mat } from '../look';
import { CREW, figure, standPose } from './figure';
import { ball, crate, loftZ, onBuild, polyDecal, polygonOut, rod, sheet, TIP, torus, trackLoop, tub } from './navalKit';
import { runningGear, wheel, type TrackSpec } from './trim';
import { AtlasLayout, loft, quad, UvBuilder, type Ring } from './uvkit';

type Q = [V3, V3, V3, V3];
/** Spitzbogen als Umriss in -1..1 / pointed arch as an outline in -1..1 */
const ARCH: [number, number][] = [[-1, -1], [1, -1], [1, 0.3], [0.55, 0.74], [0, 1], [-0.55, 0.74], [-1, 0.3]];
/** Kreis als Umriss / circle as an outline */
const DISC: [number, number][] = Array.from({ length: 12 }, (_, i): [number, number] => [Math.cos((i / 12) * Math.PI * 2), Math.sin((i / 12) * Math.PI * 2)]);

/** Schwebender Sonnenkranz / floating sun halo */
function halo(b: UvBuilder, p: V3, r: number, tube = 0.005): void {
  torus(b, p, r, tube, FAITH.halo, { gloss: 0.8 });
}

/** Lichtrohr entlang +z: weisses Rohr mit Goldringen und Leuchtkristall an der Spitze / light barrel along +z: white tube with gold rings and a glowing crystal at the tip */
function lightBarrel(b: UvBuilder, A: AtlasLayout, p: V3, len: number, r0: number, r1: number, rings: number[], rot?: V3): void {
  const seg = fine() ? 16 : 8;
  const list: Parameters<typeof loftZ>[0] = [{ z: 0, rx: r0, hard: true, c: FAITH.plateShade }];
  const rAt = (t: number) => r0 + (r1 - r0) * t;
  for (const t of rings) {
    const z = len * t, r = rAt(t);
    list.push({ z: z - 0.011, rx: r, hard: true, c: FAITH.gold }, { z: z - 0.008, rx: r * 1.28, hard: true }, { z: z + 0.006, rx: r * 1.28, hard: true }, { z: z + 0.009, rx: r, hard: true, c: FAITH.plateShade });
  }
  list.push({ z: len, rx: r1, hard: true });
  b.group({ p, r: rot }, () => {
    b.add(loftZ(list, { seg, region: A.get('lightGun:alvenia'), capLast: true }), null, { gloss: 0.5 });
    // Lichtkristall / light crystal
    b.add(loftZ([{ z: len - 0.004, rx: r1 * 0.9, c: FAITH.halo }, { z: len + 0.012, rx: r1 * 1.25 }, { z: len + 0.05, rx: TIP }], { seg: 6, region: A.get('blank') }), null, { gloss: 1, crease: 0.6 });
  });
}

/** Weihrauchfass an einem Galgen / incense censer on a gallows */
function censer(b: UvBuilder, A: AtlasLayout, foot: V3, top: V3): void {
  rod(b, foot, top, 0.004, FAITH.goldDark, { cap: false });
  rod(b, top, [top[0], top[1] - 0.04, top[2]], 0.0012, FAITH.goldDark, { seg: 3, cap: false });
  ball(b, A, [top[0], top[1] - 0.055, top[2]], 0.016, FAITH.gold, { ry: 0.019, gloss: 0.8, rows: fine() ? 5 : 3, seg: fine() ? 9 : 6 });
  ball(b, A, [top[0], top[1] - 0.03, top[2] - 0.006], 0.011, mat.cloud, { rows: 3, seg: 6 });
}

// ---------- Reliquiar / reliquary ----------

export const RELIQUARY = {
  track: { x: 0.168, w: 0.088, len: 0.43, h: 0.086, links: 40, thick: 0.011 } as TrackSpec,
  /** Wanne: Unterkante, Deck, halbe Breite und Laenge / hull: lower edge, deck, half width and length */
  y0: 0.08, y1: 0.162, hw: 0.168, hl: 0.215,
  /** Schrein: Mitte, halbe Breite und Tiefe, Wandhoehe, Firsthoehe / shrine: centre, half width and depth, wall height, ridge height */
  sz: -0.055, sw: 0.128, sd: 0.115, wall: 0.125, ridge: 0.105,
};

export function reliquary(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine();
  const R = RELIQUARY;
  b.mirrorX(() => {
    runningGear(b, A, R.track, { wheels: 5, wheelR: 0.031, wheelColor: FAITH.plateShade, sprocketColor: FAITH.goldDark, idlerColor: FAITH.goldDark, bayColor: shade(FAITH.plateShade, 0.45), rollers: 2 });
    // blaue Schuerze mit Goldsaum und Sternen ueber der Kette / blue skirt with a gold hem and stars over the track
    crate(b, 0.012, 0.064, 0.37, 0.004, { px: A.get('skirt:alvenia'), all: A.get('blank') }, FAITH.cloth, { p: [R.track.x + R.track.w / 2 + 0.008, 0.066, 0] });
  });
  // Wanne: weisse Platte, Goldborte, darunter Schatten / hull: white plate, gold trim, shade below
  b.add(loft([
    { y: R.y1, rx: R.hw * 0.94, rz: R.hl * 0.93, e: 5, hard: true, c: FAITH.plate }, { y: R.y1 - 0.012, rx: R.hw, rz: R.hl, e: 5, hard: true, c: FAITH.gold },
    { y: R.y1 - 0.024, rx: R.hw, rz: R.hl, e: 5, hard: true, c: FAITH.plateShade }, { y: R.y0, rx: R.hw * 0.97, rz: R.hl * 0.98, e: 5 },
  ], { seg: hi ? 24 : 12, region: A.get('faithHull:alvenia'), capFirst: A.get('faithDeck:alvenia') }), null, { gloss: 0.2 });
  // Schrein mit Lichtgeschuetz dreht sich zum Ziel / shrine with the light gun turns towards the target
  const sy = R.y1, sz = R.sz;
  b.turret([0, sy, sz], () => {
    b.add(loft([
      { y: sy + R.wall, rx: R.sw, rz: R.sd, e: 6, hard: true, c: FAITH.plate }, { y: sy + 0.016, rx: R.sw, rz: R.sd, e: 6, hard: true, c: FAITH.gold },
      { y: sy + 0.01, rx: R.sw + 0.006, rz: R.sd + 0.006, e: 6, hard: true }, { y: sy, rx: R.sw + 0.006, rz: R.sd + 0.006, e: 6 },
    ], { seg: hi ? 24 : 12, region: A.get('shrine:alvenia') }), null, { xf: { p: [0, 0, sz] } });
    // Spitzdach in Koenigsblau mit goldenem First / pointed roof in royal blue with a gold ridge
    const ry = sy + R.wall, rt = ry + R.ridge, ow = R.sw + 0.012, od = R.sd + 0.012;
    for (const s of [1, -1]) {
      const q: Q = [[s * ow, ry, sz + od], [s * ow, ry, sz - od], [0, rt, sz - od], [0, rt, sz + od]];
      b.add(quad(s > 0 ? q : [q[1], q[0], q[3], q[2]], A.get('roof:alvenia'), s > 0 ? [[0, 1], [1, 1], [1, 0], [0, 0]] : [[1, 1], [0, 1], [0, 0], [1, 0]]), FAITH.cloth);
      // Unterseite des Dachueberstands / underside of the eave
      b.add(quad(s > 0 ? [q[1], q[0], [0, ry, sz + od], [0, ry, sz - od]] : [q[0], q[1], [0, ry, sz - od], [0, ry, sz + od]], A.get('blank')), shade(FAITH.clothDeep, 0.7), { crease: 0 });
    }
    for (const s of [1, -1]) b.add(polygonOut([[-ow, ry, sz + s * od], [ow, ry, sz + s * od], [0, rt, sz + s * od]], [0, 0, s], A.get('gable:alvenia'), [[0, 1], [1, 1], [0.5, 0]]), FAITH.plate);
    rod(b, [0, rt, sz - od - 0.004], [0, rt, sz + od + 0.004], 0.007, FAITH.gold, { seg: hi ? 6 : 4, cap: true, gloss: 0.7 });
    // Buntglas: Spitzbogenfenster an den Seiten, Rosette vorn (leuchten) / stained glass: pointed windows on the sides, rose window at the front (they glow)
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
      polyDecal(b, A, 'glass:alvenia', [s * R.sw, sy + 0.068, sz - 0.07 + i * 0.07], [s, 0, 0], [0, 1, 0], 0.044, 0.078, ARCH, i % 2 ? FAITH.glassGold : FAITH.glassBlue, { gloss: 0.6 }, 0.002);
    }
    polyDecal(b, A, 'rose:alvenia', [0, sy + 0.094, sz + R.sd], [0, 0, 1], [0, 1, 0], 0.056, 0.056, DISC, FAITH.glassBlue, { gloss: 0.6 }, 0.002);
    // Lichtgeschuetz: Gehaeuse und langes Rohr mit Goldringen / light gun: housing and a long barrel with gold rings
    crate(b, 0.1, 0.062, 0.07, 0.012, { all: A.get('faithBox:alvenia') }, FAITH.plate, { p: [0, sy + 0.04, sz + R.sd + 0.02] });
    lightBarrel(b, A, [0, sy + 0.04, sz + R.sd + 0.05], 0.44 - (sz + R.sd + 0.05), 0.024, 0.018, hi ? [0.22, 0.48, 0.74, 0.97] : [0.48, 0.97]);
    halo(b, [0, rt + 0.05, sz], 0.075, 0.006);
    if (hi) {
      // Fialen an den Dachecken / pinnacles on the roof corners
      for (const sx of [-1, 1]) for (const dz of [-1, 1]) b.add(loft([{ y: 0.05, rx: TIP, c: FAITH.gold }, { y: 0.016, rx: 0.008 }, { y: 0.012, rx: 0.011, hard: true }, { y: 0, rx: 0.011 }], { seg: 6, region: A.get('blank') }), null, { xf: { p: [sx * (ow - 0.004), ry, sz + dz * (od - 0.004)] }, gloss: 0.7, crease: 0.6 });
    }
  });
  // Weihrauchfass am Heck / incense censer at the rear
  censer(b, A, [-0.1, R.y1, -R.hl + 0.012], [-0.1, R.y1 + 0.15, -R.hl - 0.03]);
  return b;
}

// ---------- Sonnenlanze / sun lance ----------

export const LANCE = { pivot: [0, 0.215, -0.085] as V3, pitch: 0.42, len: 0.44, wheelR: 0.078 };

export function sunLance(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine();
  const seg = hi ? 22 : 10;
  const cz = -0.085;
  // Lafette: weisse Platte mit Goldborte, zwei grosse Raeder mit Goldnaben / carriage: white plate with gold trim, two big wheels with gold hubs
  b.add(loft([
    { y: 0.112, rx: 0.1, rz: 0.14, e: 5, hard: true, c: FAITH.plate }, { y: 0.108, rx: 0.106, rz: 0.146, e: 5, hard: true, c: FAITH.gold },
    { y: 0.096, rx: 0.106, rz: 0.146, e: 5, hard: true, c: FAITH.plateShade }, { y: 0.05, rx: 0.1, rz: 0.14, e: 5 },
  ], { seg: hi ? 20 : 10, region: A.get('faithHull:alvenia'), capFirst: A.get('blank'), capLast: true }), null, { xf: { p: [0, 0, cz] }, gloss: 0.2 });
  b.mirrorX(() => wheel(b, A, 0.134, LANCE.wheelR, cz - 0.01, LANCE.wheelR, 0.03, 'sunWheel:alvenia', FAITH.plate, hi ? 22 : 10));
  // Holm nach hinten mit Sporn / trail to the rear with a spade
  b.add(loftZ([{ z: -0.16, rx: 0.02, ry: 0.012, e: 3, c: FAITH.plateShade, cy: -0.05 }, { z: 0, rx: 0.032, ry: 0.02, e: 3 }], { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true }), null, { xf: { p: [0, 0.07, cz - 0.13] } });
  b.add(softBox(0.08, 0.045, 0.01, 0.003), FAITH.goldDark, { xf: { p: [0, 0.022, cz - 0.292], r: [-0.4, 0, 0] } });
  // Drehlafette mit Stuetze unter dem Verschluss / turntable with a prop below the breech
  b.add(loft([{ y: 0.012, rx: 0.058, hard: true, c: FAITH.goldDark }, { y: 0, rx: 0.066 }], { seg, region: A.get('blank'), capFirst: true }), null, { xf: { p: [0, 0.112, cz + 0.05] }, gloss: 0.5 });
  rod(b, [0, 0.118, cz + 0.055], [0, 0.224, cz + 0.066], 0.028, FAITH.goldDark, { r1: 0.02, seg: hi ? 10 : 6, cap: false, gloss: 0.5 });
  b.group({ p: LANCE.pivot, r: [-LANCE.pitch, 0, 0] }, () => {
    // Spiegelschale aus Gold mit leuchtendem Kern / gold mirror dish with a glowing core
    b.add(loftZ([{ z: -0.07, rx: 0.036, hard: true, c: FAITH.goldDark }, { z: -0.056, rx: 0.056, c: FAITH.gold }, { z: -0.022, rx: 0.1, hard: true }, { z: -0.014, rx: 0.104, hard: true }], { seg, region: A.get('blank'), capFirst: true }), null, { gloss: 0.8 });
    polyDecal(b, A, 'dish:alvenia', [0, 0, -0.016], [0, 0, 1], [0, 1, 0], 0.204, 0.204, DISC, FAITH.gold, { gloss: 0.8 }, 0);
    polyDecal(b, A, 'blank', [0, 0, -0.012], [0, 0, 1], [0, 1, 0], 0.09, 0.09, DISC, FAITH.glassGold, { gloss: 0.9 }, 0);
    ball(b, A, [0, 0, -0.004], 0.026, FAITH.halo, { gloss: 1, rows: hi ? 5 : 3, seg: hi ? 10 : 6 });
    // lange Lanze mit drei Fokusringen und Lichtkristall / long lance with three focusing rings and a light crystal
    lightBarrel(b, A, [0, 0, 0.012], LANCE.len, 0.027, 0.013, [0.24, 0.5, 0.76]);
    if (hi) for (const t of [0.26, 0.52, 0.78]) torus(b, [0, 0, 0.012 + LANCE.len * t + 0.016], 0.03 - t * 0.012, 0.003, FAITH.halo, { rot: [Math.PI / 2, 0, 0], seg: 12, tube: 4 });
  });
  // Bedienung: Klerikerin am Richtpult (Besatzungsmassstab) / crew: cleric at the aiming console (crew scale)
  b.group({ p: [0.185, 0, cz - 0.09], r: [0, -0.55, 0] }, () => {
    b.group({ s: CREW }, () => figure(b, A, f, standPose([[-0.06, 0.4, 0.12], [0.06, 0.4, 0.12]]), { detail: 0, seed: 17, pack: 'none' }));
    rod(b, [0, 0, 0.1], [0, 0.2, 0.1], 0.006, FAITH.goldDark, { cap: false });
    crate(b, 0.085, 0.01, 0.055, 0.003, { py: A.get('console:alvenia'), all: A.get('blank') }, FAITH.goldDark, { p: [0, 0.208, 0.098], r: [0.55, 0, 0] });
  });
  censer(b, A, [-0.11, 0.11, cz - 0.1], [-0.13, 0.25, cz - 0.14]);
  if (hi) {
    // Kristallkiste mit Ersatzkristallen / crystal case with spare crystals
    crate(b, 0.056, 0.034, 0.046, 0.005, { all: A.get('faithBox:alvenia') }, FAITH.plate, { p: [-0.062, 0.129, cz - 0.02] });
    for (const dx of [-0.013, 0.013]) b.add(loft([{ y: 0.03, rx: TIP, c: FAITH.halo }, { y: 0.008, rx: 0.008 }, { y: 0, rx: 0.006 }], { seg: 5, region: A.get('blank') }), null, { xf: { p: [-0.062 + dx, 0.146, cz - 0.02] }, gloss: 1, crease: 0.6 });
  }
  return b;
}

// ---------- Goettlicher Funke / Divine Spark ----------

/** Masse: Wanne (Profil in z / y), Kasematte, Rohr / dimensions: hull (profile in z / y), casemate, barrel */
export const SPARK = {
  th: 0.096, tl: 0.88, tx: [0.145, 0.26, 0.375], tw: 0.1,
  hy: 0.215, xw: 0.31,
  /** Profil der Wanne: Heck unten, Bug unten, Nase, Bugplatte oben, Deck hinten, Heck oben / hull profile: rear bottom, front bottom, nose, glacis top, deck rear, rear top */
  z: { a: -0.42, b: 0.3, c: 0.37, d: 0.27, e: -0.37, f: -0.42 }, y: { a: 0.105, c: 0.14, f: 0.18 },
  tz: -0.1,
  trunnion: [0, 0.3, -0.13] as V3, elevation: 0.42, len: 0.6,
};
/** Muendung des Hauptrohrs in Ruhestellung (Modellkoordinaten): dort verlaesst der Funke das Geschuetz / muzzle of the main barrel at rest (model coordinates): the spark leaves the gun there */
export const SPARK_MUZZLE_INKED: V3 = [SPARK.trunnion[0], SPARK.trunnion[1] + Math.sin(SPARK.elevation) * (SPARK.len + 0.01), SPARK.trunnion[2] + Math.cos(SPARK.elevation) * (SPARK.len + 0.01)];

export function divineSpark(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine();
  const S = SPARK, hy = S.hy, xw = S.xw, th = S.th;
  const seg = hi ? 16 : 8;
  // Laufwerk: drei breite Ketten je Seite; Laufrollen und Treibrad sind auf die Aussenseite gezeichnet
  // running gear: three wide tracks per side; road wheels and sprocket are drawn onto the outer side
  b.mirrorX(() => {
    S.tx.forEach((tx, i) => trackLoop(b, tx, S.tw, S.tl, th, A.get('sparkTrack'), i === S.tx.length - 1 ? A.get('sparkBay:alvenia') : null, mat.dark));
  });
  // Kotfluegel ueber allen Ketten mit Goldkante / fenders over all tracks with a gold edge
  b.add(loft([
    { y: th + 0.022, rx: 0.442, rz: 0.432, e: 8, hard: true, c: FAITH.gold }, { y: th + 0.014, rx: 0.444, rz: 0.434, e: 8, hard: true, c: FAITH.cloth },
    { y: th - 0.012, rx: 0.444, rz: 0.434, e: 8, hard: true },
  ], { seg: hi ? 24 : 12, region: A.get('blank') }), null);
  b.add(softBox(0.88, 0.004, 0.86, 0.001), FAITH.plateShade, { xf: { p: [0, th + 0.022, 0] }, crease: 0 });
  // Hauptwanne mit schraeger Bugplatte / main hull with a sloped glacis
  const Z = S.z, Y = S.y;
  const add = (pts: Q, cell: string, st: [number, number][], c = FAITH.plate) => b.add(quad(pts, A.get(cell), st), c, { gloss: 0.2 });
  add([[-xw, hy, Z.d], [xw, hy, Z.d], [xw, hy, Z.e], [-xw, hy, Z.e]], 'sparkDeck:alvenia', [[1, 0], [0, 0], [0, 1], [1, 1]]);
  add([[-xw, Y.c, Z.c], [xw, Y.c, Z.c], [xw, hy, Z.d], [-xw, hy, Z.d]], 'sparkGlacis:alvenia', [[1, 1], [0, 1], [0, 0], [1, 0]]);
  add([[-xw, Y.a, Z.b], [xw, Y.a, Z.b], [xw, Y.c, Z.c], [-xw, Y.c, Z.c]], 'blank', [[0, 0], [1, 0], [1, 1], [0, 1]], FAITH.plateShade);
  add([[xw, Y.f, Z.f], [-xw, Y.f, Z.f], [-xw, hy, Z.e], [xw, hy, Z.e]], 'sparkRear:alvenia', [[0, 1], [1, 1], [1, 0], [0, 0]]);
  add([[xw, Y.a, Z.a], [-xw, Y.a, Z.a], [-xw, Y.f, Z.f], [xw, Y.f, Z.f]], 'blank', [[0, 0], [1, 0], [1, 1], [0, 1]], FAITH.plateShade);
  for (const s of [1, -1]) {
    const pts: V3[] = [[s * xw, Y.a, Z.a], [s * xw, Y.a, Z.b], [s * xw, Y.c, Z.c], [s * xw, hy, Z.d], [s * xw, hy, Z.e], [s * xw, Y.f, Z.f]];
    const st = pts.map((p): [number, number] => [(Z.c - p[2]) / (Z.c - Z.a), (hy - p[1]) / (hy - Y.a)]);
    b.add(polygonOut(pts, [s, 0, 0], A.get('sparkSide:alvenia'), st), FAITH.plate, { gloss: 0.2 });
  }
  // Nebentuerme vorn: Kuppel mit Goldring, zwei kurze Rohre schraeg nach aussen / secondary turrets at the front: dome with a gold ring, two short barrels angled outwards
  for (const s of [-1, 1]) {
    b.add(loft([{ y: 0.05, rx: TIP, c: FAITH.plate }, { y: 0.044, rx: 0.024 }, { y: 0.028, rx: 0.042 }, { y: 0.018, rx: 0.046, hard: true, c: FAITH.gold }, { y: 0, rx: 0.05 }], { seg, region: A.get('blank'), arc: true }), null, { xf: { p: [s * 0.2, hy, 0.17] }, gloss: 0.3 });
    for (const dy of hi ? [0.022, 0.038] : [0.03]) rod(b, [s * 0.21, hy + dy, 0.2], [s * 0.25, hy + dy + 0.006, 0.29], 0.0075, FAITH.clothDeep, { seg: hi ? 6 : 4 });
  }
  // Kommandoturm mit Bruecke links hinten, Sonnenkranz darueber / command tower with a bridge at the rear left, a sun halo above it
  const cx = -0.19, cz = -0.3;
  b.add(loft([
    { y: 0.158, rx: 0.092, rz: 0.047, e: 6, hard: true, c: FAITH.plateShade }, { y: 0.156, rx: 0.098, rz: 0.053, e: 6, hard: true, c: FAITH.gold }, { y: 0.146, rx: 0.098, rz: 0.053, e: 6, hard: true, c: FAITH.plateShade },
    { y: 0.1, rx: 0.095, rz: 0.05, e: 6, hard: true, c: FAITH.plate }, { y: 0.096, rx: 0.075, rz: 0.065, e: 6, hard: true }, { y: 0, rx: 0.075, rz: 0.065, e: 6 },
  ], { seg: hi ? 20 : 10, region: A.get('tower:alvenia'), capFirst: A.get('blank') }), null, { xf: { p: [cx, hy, cz] }, gloss: 0.2 });
  // Fensterband der Bruecke in Buntglasblau (leuchtet) / the bridge's window band in stained-glass blue (glows)
  polyDecal(b, A, 'pane:alvenia', [cx, hy + 0.124, cz + 0.053], [0, 0, 1], [0, 1, 0], 0.17, 0.018, [[-1, -1], [1, -1], [1, 1], [-1, 1]], FAITH.glassBlue, { gloss: 0.7 }, 0.002);
  polyDecal(b, A, 'pane:alvenia', [cx + 0.098, hy + 0.124, cz], [1, 0, 0], [0, 1, 0], 0.085, 0.018, [[-1, -1], [1, -1], [1, 1], [-1, 1]], FAITH.glassBlue, { gloss: 0.7 }, 0.002);
  halo(b, [cx - 0.03, hy + 0.21, cz - 0.01], 0.045, 0.0045);
  // Kommandant in der Dachluke (Besatzungsmassstab) / commander in the roof hatch (crew scale)
  tub(b, A, [cx + 0.035, hy + 0.156, cz], 0.046, 0.034, 0.012, FAITH.plateShade, { rim: FAITH.gold });
  b.group({ p: [cx + 0.035, hy + 0.172 - 0.443 * CREW, cz - 0.002], r: [0, 0.35, 0], s: CREW }, () => {
    figure(b, A, f, { pelvis: [0, 0.302, 0], head: [-0.1, 0, 0], handL: [-0.09, 0.385, 0.06], handR: [0.09, 0.385, 0.06], footL: [0, 0, 0], footR: [0, 0, 0], elbowPoleL: [-1, -0.2, -0.3], elbowPoleR: [1, -0.2, -0.3] }, { detail: 0, noLegs: true, seed: 23 });
  });
  // Munitionskran rechts hinten mit haengender Granate und Granatstapel / ammunition crane at the rear right with a hanging shell and a shell stack
  const kx = 0.2, kz = -0.3;
  rod(b, [kx, hy, kz], [kx, hy + 0.15, kz], 0.018, FAITH.goldDark, { r1: 0.014, seg: hi ? 8 : 5 });
  rod(b, [kx, hy + 0.145, kz - 0.02], [kx, hy + 0.172, kz + 0.14], 0.01, FAITH.gold, { seg: hi ? 6 : 4, cap: true });
  rod(b, [kx, hy + 0.168, kz + 0.132], [kx, hy + 0.095, kz + 0.132], 0.0025, mat.ink, { seg: 3, cap: false });
  const shell: Ring[] = [{ y: 0.03, rx: 0.016, hard: true, c: FAITH.goldLight }, { y: -0.02, rx: 0.016, hard: true, c: FAITH.gold }, { y: -0.044, rx: TIP }];
  b.add(loft(shell, { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true }), null, { xf: { p: [kx, hy + 0.066, kz + 0.132] }, gloss: 0.7 });
  for (const [dx, dy] of (hi ? [[-0.018, 0], [0.018, 0], [0, 0.03]] : [[0, 0]]) as [number, number][]) {
    b.add(loft(shell, { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true }), null, { xf: { p: [kx + 0.06 + dx, hy + 0.017 + dy, kz - 0.05], r: [-Math.PI / 2, 0, 0] }, gloss: 0.7 });
  }
  // Abgasrohre am Heck / exhausts at the rear
  for (const x of [-0.06, 0.06]) b.add(loft([{ y: 0.06, rx: 0.014, hard: true }, { y: 0, rx: 0.017 }], { seg: hi ? 10 : 6, region: A.get('exhaust'), capFirst: A.get('blank'), color: mat.darkMid }), null, { xf: { p: [x, hy - 0.004, -0.392] } });
  // heilige Banner an den hinteren Ecken / holy banners on the rear corners
  for (const s of [-1, 1]) {
    const px = s * 0.28, pz = -0.385;
    rod(b, [px, hy, pz], [px, hy + 0.215, pz], 0.0045, FAITH.goldDark, { cap: false });
    b.add(loft([{ y: 0.02, rx: TIP, c: FAITH.gold }, { y: 0, rx: 0.009 }], { seg: 5, region: A.get('blank') }), null, { xf: { p: [px, hy + 0.215, pz] }, gloss: 0.7 });
    sheet(b, [[px, hy + 0.205, pz + 0.006], [px, hy + 0.205, pz + 0.078], [px, hy + 0.095, pz + 0.078], [px, hy + 0.095, pz + 0.006]], 0.004 * s, A.get('banner:alvenia'), FAITH.cloth, { nu: 2, nv: 2 });
  }
  // drehbare Kasematte mit dem Eisenbahngeschuetz / rotating casemate with the railway gun
  const tz = S.tz;
  b.turret([0, hy, tz], () => {
    b.add(loft([{ y: 0.02, rx: 0.16, hard: true, c: FAITH.goldDark }, { y: 0, rx: 0.172 }], { seg: hi ? 24 : 12, region: A.get('blank'), capFirst: true }), null, { xf: { p: [0, hy, tz] }, gloss: 0.4 });
    // Unterbau mit Schraege vorn, Goldkante / base with a slope at the front, gold edge
    b.add(loft([
      { y: 0.06, rx: 0.158, rz: 0.112, rzB: 0.193, e: 6, hard: true, c: FAITH.plate }, { y: 0.058, rx: 0.165, rz: 0.12, rzB: 0.2, e: 6, hard: true, c: FAITH.gold },
      { y: 0.05, rx: 0.172, rz: 0.15, rzB: 0.21, e: 6, hard: true, c: FAITH.plate }, { y: 0, rx: 0.172, rz: 0.18, rzB: 0.21, e: 6 },
    ], { seg: hi ? 24 : 12, region: A.get('casemate:alvenia'), capFirst: A.get('blank') }), null, { xf: { p: [0, hy + 0.02, tz] }, gloss: 0.2 });
    // Verschlusshaus hinten mit blauem Dach / breech house at the rear with a blue roof
    b.add(loft([
      { y: 0.094, rx: 0.126, rz: 0.07, e: 6, hard: true, c: FAITH.cloth }, { y: 0.082, rx: 0.126, rz: 0.07, e: 6, hard: true, c: FAITH.gold },
      { y: 0.076, rx: 0.12, rz: 0.066, e: 6, hard: true, c: FAITH.plate }, { y: 0, rx: 0.12, rz: 0.066, e: 6 },
    ], { seg: hi ? 20 : 10, region: A.get('tower:alvenia'), capFirst: A.get('blank') }), null, { xf: { p: [0, hy + 0.076, tz - 0.14] }, gloss: 0.2 });
    // hohe Lafettenwangen mit Schildzapfen / tall cradle cheeks with trunnions
    const ty = S.trunnion[1], tzz = S.trunnion[2];
    for (const s of [-1, 1]) {
      const cheek: V3[] = [[s * 0.104, hy + 0.076, tz - 0.16], [s * 0.104, hy + 0.076, tz + 0.09], [s * 0.104, ty + 0.03, tzz + 0.05], [s * 0.104, ty + 0.045, tzz - 0.04], [s * 0.104, ty + 0.02, tz - 0.14]];
      const st = cheek.map((p): [number, number] => [(tz + 0.09 - p[2]) / 0.25, (ty + 0.045 - p[1]) / (ty + 0.045 - hy - 0.076)]);
      for (const side of [1, -1]) b.add(polygonOut(cheek.map((p): V3 => [p[0] - s * (side > 0 ? 0 : 0.03), p[1], p[2]]), [s * side, 0, 0], A.get(side > 0 ? 'cheek:alvenia' : 'blank'), side > 0 ? st : st.map((): [number, number] => [0.5, 0.5])), side > 0 ? FAITH.plateShade : shade(FAITH.plateShade, 0.8));
      // Kante der Wange schliessen: jede Kantenflaeche zeigt vom Schwerpunkt weg / close the cheek's edge: every edge face points away from the centroid
      const cy = cheek.reduce((a, p) => a + p[1], 0) / cheek.length, cz2 = cheek.reduce((a, p) => a + p[2], 0) / cheek.length;
      for (let i = 1; i < cheek.length; i++) {
        const p = cheek[i], q = cheek[(i + 1) % cheek.length];
        b.add(polygonOut([p, q, [q[0] - s * 0.03, q[1], q[2]], [p[0] - s * 0.03, p[1], p[2]]], [0, (p[1] + q[1]) / 2 - cy, (p[2] + q[2]) / 2 - cz2], A.get('blank'), [[0, 0], [1, 0], [1, 1], [0, 1]]), FAITH.plateShade, { crease: 0.6 });
      }
      b.add(loft([{ y: 0.012, rx: 0.03, hard: true, c: FAITH.gold }, { y: 0, rx: 0.034 }], { seg, region: A.get('blank'), capFirst: true }), null, { xf: { p: [s * 0.104, ty, tzz], r: [0, 0, -s * Math.PI / 2] }, gloss: 0.7 });
    }
    // Rohr in Artilleriestellung / barrel at an artillery angle
    const L = S.len;
    b.group({ p: S.trunnion, r: [-S.elevation, 0, 0] }, () => {
      b.add(loftZ([
        { z: -0.11, rx: 0.048, hard: true, c: FAITH.cloth }, { z: 0.17, rx: 0.048 }, { z: 0.2, rx: 0.042, hard: true, c: FAITH.gold }, { z: 0.203, rx: 0.049, hard: true }, { z: 0.217, rx: 0.049, hard: true },
        { z: 0.22, rx: 0.0415, hard: true, c: FAITH.cloth }, { z: 0.44, rx: 0.037, hard: true, c: FAITH.gold }, { z: 0.443, rx: 0.044, hard: true }, { z: 0.455, rx: 0.044, hard: true }, { z: 0.458, rx: 0.0365, hard: true, c: FAITH.cloth },
        { z: L - 0.07, rx: 0.034 },
      ], { seg: hi ? 18 : 10, region: A.get('sparkBarrel:alvenia'), capFirst: true }), null, { gloss: 0.4 });
      // weisse Rohrwiege und Rohrbremszylinder / white barrel cradle and recoil cylinders
      b.add(loftZ([{ z: -0.05, rx: 0.058, hard: true, c: FAITH.plate }, { z: 0.15, rx: 0.058, hard: true }, { z: 0.156, rx: 0.049 }], { seg: hi ? 18 : 10, region: A.get('faithPlate:alvenia'), capFirst: true }), null, { gloss: 0.2 });
      for (const x of [-0.032, 0.032]) rod(b, [x, 0.058, -0.07], [x, 0.058, 0.19], 0.016, FAITH.plateShade, { seg: hi ? 8 : 5, cap: true });
      // leuchtende Sonnenkraenze um das Rohr / glowing sun halos around the barrel
      for (const [z, r] of (hi ? [[0.27, 0.07], [0.37, 0.063]] : [[0.32, 0.068]]) as [number, number][]) torus(b, [0, 0, z], r, 0.0055, FAITH.halo, { rot: [Math.PI / 2, 0, 0], seg: hi ? 18 : 10 });
      // grosse Muendungsbremse mit leuchtendem Kern / big muzzle brake with a glowing core
      crate(b, 0.112, 0.086, 0.08, 0.012, { px: A.get('brake:alvenia'), nx: A.get('brake:alvenia'), mirrorNx: true, all: A.get('blank') }, FAITH.goldDark, { p: [0, 0, L - 0.04] }, { gloss: 0.5 });
      polyDecal(b, A, 'blank', [0, 0, L], [0, 0, 1], [0, 1, 0], 0.062, 0.062, DISC, mat.ink, {}, 0.001);
      polyDecal(b, A, 'blank', [0, 0, L], [0, 0, 1], [0, 1, 0], 0.04, 0.04, DISC, FAITH.halo, { gloss: 1 }, 0.003);
    });
  });
  // Muendung fuer den Funken merken (board.animateSpark) / remember the muzzle for the spark (board.animateSpark)
  return onBuild(b, (g) => { g.userData.muzzle = [...SPARK_MUZZLE_INKED]; });
}
