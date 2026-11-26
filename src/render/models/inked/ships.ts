/**
 * Gezeichnete Einheiten: Kriegsschiffe (Zerstoerer, Schlachtschiff, U-Boot). Wasserlinie bei y = 0, Bug in +z.
 * Inked units: warships (destroyer, battleship, submarine). Waterline at y = 0, bow towards +z.
 *
 * Jedes Schiff besteht aus wenigen glatten Koerpern: Rumpf aus Stationen (navalKit.shipHull), Aufbauten, Schornsteine
 * und Tuerme als Lofts. Plattenstoesse, Nieten, Bullaugen, Planken, Luken, Ankerketten, Hubschrauberdeck sind
 * gezeichnet (shipsPaint.ts); Kennnummer und Emblem liegen als Auflagen darueber. Die Bauformen der Fraktionen
 * (Aufbau, Turm, Schornstein) bleiben wie im bisherigen Modell: Korvat kantig mit Fensterband, Dravon verjuengt und
 * nach hinten geneigt, Alvenia rund mit Kuppeltuermen, Meridon mit Containern, Velkar verjuengt mit Leuchtband.
 * Every ship is made of a few smooth bodies: a hull from stations (navalKit.shipHull), superstructure, funnels and
 * turrets as lofts. Plate butts, rivets, portholes, planks, hatches, anchor chains, the helideck are drawn
 * (shipsPaint.ts); hull number and emblem lie on top as decals. The factions' shapes (superstructure, turret, funnel)
 * stay as in the previous model: Korvat boxy with a window band, Dravon tapered and raked aft, Alvenia round with
 * domed turrets, Meridon with containers, Velkar tapered with a glow band.
 */
import type { FactionId } from '../../../data/balance';
import { fine, mix, shade, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat, styleOf, type HumanStyle, type Look } from '../look';
import { TECH } from '../velkarTech';
import { CREW, figure } from './figure';
import { ball, crate, insignia, loftZ, polygonOut, rod, sheet, shipHull, shipOutline, TIP, turretInfo, type HullRow } from './navalKit';
import { decal } from './trim';
import { AtlasLayout, loft, UvBuilder, type Ring } from './uvkit';

/** Schwenkgrenze der Schiffstuerme / traverse limit of ship turrets */
const SHIP_TURRET_ARC = (Math.PI * 3) / 4;

/** Lage der Zeilen in der Bordwandzelle: Dollbord, Unterkante Zierstreifen, Wasserlinie / rows in the ship side cell: gunwale, lower edge of the trim stripe, waterline */
export const SIDE_T = { trim: 0.13, mid: 0.46, water: 0.8 };

/** Zeilen einer Bordwand mit Zierstreifen oben und dunklem Unterwasserschiff / rows of a ship side with a trim stripe on top and a dark underwater hull */
export function sideRows(top: ColorLike, hull: ColorLike, below: ColorLike, o: { gun: number; keel: number; flare?: number; rake?: number; stripe?: number }): HullRow[] {
  const kw = 1 - (o.flare ?? 0.07), rake = o.rake ?? 0.03;
  return [
    { h: 1, dy: o.gun, k: 1, t: 0, c: top, hard: true },
    { h: 1, dy: o.gun - (o.stripe ?? 0.012), k: 0.997, t: SIDE_T.trim, c: hull, hard: true },
    { h: 0.5, k: (1 + kw) / 2 + 0.012, rake: rake * 0.4, t: SIDE_T.mid },
    { h: 0, dy: 0.004, k: kw, rake, t: SIDE_T.water, c: below, hard: true },
    { h: 0, dy: -o.keel, k: kw - 0.08, rake: rake * 1.4, t: 1 },
  ];
}

/** Masse der Schiffe (Endgroesse) / ship dimensions (final size) */
export const DESTROYER = { z0: -0.4, z1: 0.4, beam: 0.23, bow: 0.2, deck: 0.07, gun: 0.008, sheer: 0.02, inset: 0.93 };
export const BATTLESHIP = { z0: -0.44, z1: 0.44, beam: 0.44, bow: 0.23, deck: 0.076, gun: 0.008, sheer: 0.018, inset: 0.95 };
export const SUB = { z0: -0.43, z1: 0.43, beam: 0.23, deck: 0.058, sail: 0.06 };
export type ShipDims = typeof DESTROYER;

/** Deckhoehe mit Sprung zum Bug / deck height with sheer towards the bow */
const sheerY = (D: ShipDims) => (z: number) => { const f = Math.max(0, (z - (D.z1 - D.bow)) / D.bow); return D.deck + D.sheer * f * f; };

/** Bugwelle und Kielwasser als flache helle Flaechen auf dem Wasser / bow wave and wake as flat light areas on the water */
export function foam(b: UvBuilder, A: AtlasLayout, w: number, z0: number, z1: number, bow: number, wake = 0.03): void {
  const y = 0.004, r = A.get('foam');
  for (const s of [1, -1]) {
    const pts: V3[] = [[s * w * 1.02, y, z1 - bow * 0.85], [s * w * 0.62, y, z1 - bow * 0.5], [0, y, z1 - 0.012], [0, y, z1 + 0.008]];
    b.add(polygonOut(pts, [0, 1, 0], r, [[0, 1], [0.4, 1], [1, 0.3], [1, 0]]), mat.white, { crease: 0 });
  }
  // das Kielwasser bleibt auf der Kachel: sonst verkleinert buildInked das ganze Schiff / the wake stays on the tile: otherwise buildInked shrinks the whole ship
  if (wake > 0) b.add(polygonOut([[-w * 0.62, y, z0 + 0.012], [-w * 0.9, y, z0 - wake], [w * 0.9, y, z0 - wake], [w * 0.62, y, z0 + 0.012]], [0, 1, 0], r, [[0.1, 0], [0, 1], [1, 1], [0.9, 0]]), mat.white, { crease: 0 });
}

/** Grundfarbe der Aufbauten je Bauform / base colour of the superstructure per style */
function houseColor(st: HumanStyle, L: Look): ColorLike {
  return st === 'alvenia' || st === 'korvat' ? mat.concreteLight : st === 'meridon' ? mat.paper : st === 'dravon' ? shade(L.primary, 1.35) : shade(L.primary, 1.15);
}

/**
 * Aufbau-Block im Fraktionsstil als ein Loft: Wand mit Zeichnung (Fensterband oder Bullaugen), Dach mit Ueberstand.
 * bridge = oberes Stockwerk mit Fensterband.
 * Superstructure block in faction style as one loft: wall with drawing (window band or portholes), overhanging roof.
 * bridge = upper tier with a window band.
 */
export function house(b: UvBuilder, A: AtlasLayout, f: FactionId, L: Look, x: number, y: number, z: number, w: number, h: number, d: number, bridge = false): void {
  const st = styleOf(f), base = houseColor(st, L);
  const seg = fine() ? 24 : 14;
  const hw = w / 2, hd = d / 2;
  // die verjuengten Bauformen tragen ein Farbband statt des Fensterbands / the tapered styles carry a colour band instead of the window band
  const cell = A.get(bridge && st !== 'dravon' && st !== 'velkar' ? 'bridge' : 'house'), roofCell = A.get('roof');
  let rings: Ring[];
  if (st === 'dravon' || st === 'velkar') {
    // verjuengt, Dravon nach hinten geneigt; Farbband statt Fenster / tapered, Dravon raked aft; a colour band instead of windows
    const kw = st === 'dravon' ? 0.7 : 0.72, kd = st === 'dravon' ? 0.6 : 0.72, dz = st === 'dravon' ? -d * 0.12 : 0;
    const band = f === 'velkar' ? TECH.glow : L.secondary;
    const at = (t: number, extra: Partial<Ring> = {}): Ring => ({ y: y + h * t, rx: hw * (1 - (1 - kw) * t), rz: hd * (1 - (1 - kd) * t), cz: dz * t, e: 5, ...extra });
    rings = [at(1, { hard: true, c: base }), at(0.78, { hard: true, c: band }), at(0.62, { hard: true, c: base }), at(0)];
  } else {
    const e = st === 'alvenia' ? 2 : 5;
    const roof = st === 'meridon' ? L.secondary : L.primary, over = st === 'meridon' ? 0.01 : 0.005;
    rings = [
      { y: y + h + 0.007, rx: hw + over, rz: hd + over, e, hard: true, c: roof },
      { y: y + h, rx: hw + over, rz: hd + over, e, hard: true },
      { y: y + h, rx: hw, rz: hd, e, hard: true, c: base },
      { y, rx: hw, rz: hd, e },
    ];
  }
  // die Zelle beginnt an der Wandoberkante: die Dachkante bekommt den obersten Streifen / the cell starts at the top of the wall: the roof edge takes the topmost strip
  b.add(loft(rings, { seg, region: cell, capFirst: roofCell }), null, { xf: { p: [x, 0, z] } });
}

/** Schornstein: Loft mit Kappenband und dunkler Muendung / funnel: loft with a cap band and a dark mouth */
export function funnel(b: UvBuilder, A: AtlasLayout, f: FactionId, L: Look, z: number, y: number, h: number, r: number, rx = r): void {
  const st = styleOf(f);
  const seg = fine() ? 18 : 12;
  // Neigung und Verjuengung je Bauform / rake and taper per style
  const rake = st === 'alvenia' ? -0.15 * h : st === 'dravon' ? -r * 0.6 : 0;
  const k = st === 'velkar' ? 0.7 : st === 'dravon' ? 0.8 : st === 'alvenia' ? 0.92 : 1;
  const e = st === 'alvenia' ? 2 : st === 'korvat' || st === 'meridon' ? 3.2 : 4.5;
  const at = (t: number, extra: Partial<Ring> = {}): Ring => ({ y: y + h * t, rx: rx * (1 - (1 - k) * t), rz: r * 1.2 * (1 - (1 - k) * t), cz: rake * t, e, ...extra });
  // von unten nach oben, dann der Rand nach innen: so zeigt die dunkle Muendung nach oben (t laeuft dafuer rueckwaerts)
  // bottom to top, then the rim inward: that way the dark mouth faces up (t runs backwards for it)
  b.add(loft([
    at(0, { c: L.hull }), at(0.86, { hard: true, c: L.trim }), at(1, { hard: true, c: mat.ink }),
    { ...at(1), rx: at(1).rx * 0.72, rz: (at(1).rz ?? r) * 0.72, hard: true },
  ], { seg, region: A.get('funnel'), capLast: true, t0: 1, t1: 0 }), null, { xf: { p: [0, 0, z] } });
}

/** Kanonenrohr entlang +z ab (x, y, z0), leicht erhoeht / gun barrel along +z from (x, y, z0), slightly elevated */
function navalBarrel(b: UvBuilder, A: AtlasLayout, L: Look, x: number, y: number, z0: number, len: number, r: number): void {
  const seg = fine() ? 12 : 8;
  b.group({ p: [x, y, z0], r: [-0.06, 0, 0] }, () => {
    b.add(loftZ([
      { z: -0.004, rx: r * 1.9, hard: true, c: mix(mat.sand, L.hullDark, 0.45) }, { z: len * 0.14, rx: r * 1.25, hard: true, c: mat.dark },
      { z: len * 0.14 + 0.003, rx: r * 1.12, hard: true }, { z: len * 0.9 - 0.003, rx: r * 0.9, hard: true, c: mat.ink },
      { z: len * 0.9, rx: r * 1.2, hard: true }, { z: len, rx: r * 1.2, hard: true },
    ], { seg, region: A.get('navGun'), capLast: true }), null, { gloss: 0.5 });
  });
}

/**
 * Geschuetzturm im Fraktionsstil, drehbar. sx / sz = halbe Breite und Tiefe, aft = Heckturm (zeigt nach -z).
 * Gun turret in faction style, rotating. sx / sz = half width and depth, aft = aft turret (points to -z).
 */
function gunTurret(b: UvBuilder, A: AtlasLayout, f: FactionId, L: Look, z: number, y: number, sx: number, sz: number, h: number, barrels: number, aft: boolean, reach = 1): void {
  const st = styleOf(f);
  const hi = fine();
  const seg = hi ? 24 : 14;
  const wall = A.get('navTurret'), topCell = A.get('navTurretTop');
  b.group({ p: [0, y, z], r: [0, aft ? Math.PI : 0, 0] }, () => b.turret([0, 0, 0], () => {
    // Drehkranz / turret ring
    b.add(loft([{ y: 0.012, rx: sx * 0.86, rz: sz * 0.86, hard: true }, { y: 0, rx: sx * 0.92, rz: sz * 0.92 }], { seg, region: A.get('blank'), color: L.hullDark }), null);
    let rings: Ring[];
    if (st === 'alvenia') {
      rings = [
        { y: h * 1.2, rx: TIP, c: L.hull }, { y: h * 1.14, rx: sx * 0.42, rz: sz * 0.42 }, { y: h * 0.98, rx: sx * 0.78, rz: sz * 0.78 },
        { y: h * 0.72, rx: sx * 0.95, rz: sz * 0.95 }, { y: h * 0.4, rx: sx, rz: sz, hard: true }, { y: 0.01, rx: sx * 1.04, rz: sz * 1.04 },
      ];
    } else if (st === 'dravon') {
      rings = [
        { y: h * 1.05, rx: sx * 0.88, rz: sz * 1.08, rzB: sz * 0.8, e: 2.3, hard: true, c: L.trim },
        { y: h * 0.82, rx: sx * 0.96, rz: sz * 1.2, rzB: sz * 0.86, e: 2.3, hard: true, c: L.hull },
        { y: 0.01, rx: sx * 1.02, rz: sz * 1.28, rzB: sz * 0.9, e: 2.3 },
      ];
    } else if (st === 'velkar') {
      rings = [
        { y: h, rx: sx * 0.7, rz: sz * 0.52, rzB: sz * 0.72, e: 5, hard: true, c: L.hull },
        { y: 0.01, rx: sx, rz: sz * 0.95, e: 5 },
      ];
    } else {
      rings = [
        { y: h, rx: sx * 0.84, rz: sz * 0.7, rzB: sz * 0.9, e: 4, hard: true, c: L.hull },
        { y: h * 0.78, rx: sx * 0.93, rz: sz * 0.9, rzB: sz * 0.96, e: 4 },
        { y: 0.01, rx: sx, rz: sz, e: 4 },
      ];
    }
    b.add(loft(rings, { seg, region: wall, capFirst: st === 'alvenia' ? undefined : topCell, arc: st === 'alvenia' }), null);
    // Entfernungsmesser quer ueber dem Turmheck / rangefinder across the turret rear
    const ears = sx * (st === 'alvenia' ? 2.1 : 2.3);
    b.add(softBox(ears, h * 0.2, sz * 0.2, h * 0.06), L.hullDark, { xf: { p: [0, h * (st === 'alvenia' ? 0.62 : 0.84), -sz * 0.52] } });
    if (st === 'meridon') b.add(softBox(sx, h * 0.24, sz * 0.6, 0.004), L.trim, { xf: { p: [0, h * 1.1, -sz * 0.4] } });
    const big = st === 'dravon' ? 1.3 : 1;
    const front = st === 'dravon' ? sz * 1.02 : st === 'velkar' ? sz * 0.7 : st === 'alvenia' ? sz * 0.8 : sz * 0.82;
    // reach = groesster Abstand der Muendung vom Drehpunkt (Rohr bleibt ueber dem Schiff) / reach = largest distance of the muzzle from the pivot (the barrel stays above the ship)
    const len = Math.min(sz * 2.3 * (st === 'dravon' ? 1.2 : 1), reach - front);
    for (let i = 0; i < barrels; i++) {
      const x = barrels === 1 ? 0 : (i - (barrels - 1) / 2) * sx * 0.7;
      navalBarrel(b, A, L, x, h * 0.56, front, len, h * 0.16 * big);
    }
  }));
}

/** Dreibeinmast mit Radarbalken, Rah und Wimpel / tripod mast with a radar bar, yard and pennant */
export function mast(b: UvBuilder, A: AtlasLayout, f: FactionId, L: Look, z: number, y: number, h: number, spread = 0.03): void {
  const st = styleOf(f), hi = fine();
  for (const [x, dz] of [[-spread, -spread * 0.8], [spread, -spread * 0.8], [0, spread]] as [number, number][]) rod(b, [x, y, z + dz], [0, y + h * 0.7, z], 0.005, mat.dark, { cap: false });
  rod(b, [0, y + h * 0.66, z], [0, y + h, z], 0.0065, mat.dark, { r1: 0.004 });
  b.add(loft([{ y: 0.008, rx: 0.03, hard: true }, { y: 0, rx: 0.03, hard: true }], { seg: hi ? 12 : 8, region: A.get('blank'), capFirst: true, capLast: true, color: L.hullDark }), null, { xf: { p: [0, y + h * 0.69, z] } });
  rod(b, [-0.06, y + h * 0.86, z], [0.06, y + h * 0.86, z], 0.003, mat.dark, { cap: true });
  // Radarbalken / radar bar
  b.add(softBox(0.09, 0.018, 0.008, 0.003), mat.white, { xf: { p: [0, y + h * 0.75, z], r: [0, 0.6, 0] } });
  if (st === 'velkar' || st === 'alvenia') ball(b, A, [0, y + h * 0.58, z + 0.035], 0.026, mat.white);
  if (st === 'velkar') {
    ball(b, A, [0, y + h + 0.008, z], 0.01, f === 'velkar' ? TECH.glow : L.secondary, { rows: 3, seg: 6 });
    // Velkar: Sensorringe am Mast / Velkar: sensor rings on the mast
    if (f === 'velkar') for (const k of [0.45, 0.6]) b.add(loft([{ y: 0.004, rx: 0.014, hard: true }, { y: -0.004, rx: 0.014, hard: true }], { seg: 8, region: A.get('blank'), color: TECH.glow }), null, { xf: { p: [0, y + h * k, z] }, crease: 0 });
  }
  // Wimpel in Fraktionsfarbe / pennant in faction colour
  sheet(b, [[0, y + h, z - 0.004], [0, y + h - 0.012, z - 0.07], [0, y + h - 0.018, z - 0.07], [0, y + h - 0.03, z - 0.004]], 0.004, A.get('blank'), L.trim, { nu: 2, nv: 1 });
  if (hi) {
    // Signalleinen bis an Deck / halyards down to the deck
    for (const s of [-1, 1]) rod(b, [s * 0.058, y + h * 0.86, z], [s * 0.05, y + 0.01, z - 0.07], 0.0009, mat.dark, { seg: 3, cap: false });
  }
}

/** Rettungsboot unter Persenning an beiden Seiten / lifeboat under a canvas cover on both sides */
function lifeboats(b: UvBuilder, A: AtlasLayout, x: number, y: number, z: number): void {
  const seg = fine() ? 10 : 6;
  for (const s of [-1, 1]) {
    b.add(loftZ([
      { z: -0.045, rx: TIP, c: mat.white }, { z: -0.04, rx: 0.011, ry: 0.011, ryB: 0.012 }, { z: 0, rx: 0.016, ry: 0.013, ryB: 0.015 },
      { z: 0.036, rx: 0.011, ry: 0.011, ryB: 0.012 }, { z: 0.046, rx: TIP },
    ], { seg, region: A.get('lifeboat') }), null, { xf: { p: [s * x, y, z] } });
    // Davits / davits
    if (fine()) for (const dz of [-0.03, 0.03]) rod(b, [s * (x - 0.014), y - 0.03, z + dz], [s * (x + 0.002), y + 0.022, z + dz], 0.0024, mat.dark, { cap: false });
  }
}

/** Emblem und zweistellige Kennnummer an beiden Bugseiten / emblem and a two-digit hull number on both bow sides */
function bowMarks(b: UvBuilder, A: AtlasLayout, f: FactionId, L: Look, w: number, y: number, z: number, size: number, digits: [number, number]): void {
  // die Normale folgt dem Spantausfall / the normal follows the flare
  for (const s of [-1, 1]) insignia(b, A, f, [s * (w + 0.001), y, z], [s, -0.11, 0], size, L.primaryDark, digits);
}

/** Velkar: tuerkise Leuchtlinie an beiden Rumpfseiten / Velkar: teal light line on both hull sides */
function techLine(b: UvBuilder, A: AtlasLayout, w: number, y: number, z: number, len: number): void {
  for (const s of [-1, 1]) decal(b, A, 'glowStrip', [s * (w + 0.001), y, z], [s, -0.08, 0], [0, 1, 0], len, 0.009, TECH.glow);
}

/** Container-Stapel der Meridon / Meridon's container stack */
function containers(b: UvBuilder, A: AtlasLayout, L: Look, z: number, y: number, k = 1): void {
  const tones = [L.trim, L.primary, shade(L.trim, 0.8)];
  ([[-0.05 * k, 0], [0.05 * k, 0], [0, 1]] as [number, number][]).forEach(([x, lvl], i) => {
    crate(b, 0.094 * k, 0.045, 0.1, 0.004, { px: A.get('container'), nx: A.get('container'), mirrorNx: true, all: A.get('blank') }, tones[i % 3], { p: [x, y + 0.0225 + lvl * 0.045, z] });
  });
}

// ---------- Zerstoerer / destroyer ----------

export function destroyer(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), st = styleOf(f), hi = fine();
  const D = DESTROYER, w = D.beam / 2, d = D.deck;
  shipHull(b, {
    outline: shipOutline(D.z0, D.z1, D.beam, D.bow), deckY: sheerY(D), bowZ: D.z1 - D.bow,
    rows: sideRows(L.trim, L.hull, L.hullDark, { gun: D.gun, keel: 0.024 }),
    side: A.get('hullSide'), transom: A.get('blank'),
    deck: { region: A.get('deck:destroyer'), color: mat.metalLight, inset: D.inset, drop: D.gun, lip: shade(L.hull, 0.78) },
  });
  foam(b, A, w, D.z0, D.z1, D.bow, 0.012);
  // Aufbau: zwei Stockwerke, Brueckennocken / superstructure: two tiers, bridge wings
  house(b, A, f, L, 0, d, 0.075, 0.15, 0.085, 0.15);
  house(b, A, f, L, 0, d + 0.085, 0.09, 0.115, 0.066, 0.08, true);
  b.add(softBox(0.17, 0.008, 0.03, 0.003), L.hullDark, { xf: { p: [0, d + 0.089, 0.115] } });
  for (const s of [-1, 1]) b.add(softBox(0.012, 0.016, 0.03, 0.003), mat.white, { xf: { p: [s * 0.079, d + 0.101, 0.115] } });
  mast(b, A, f, L, 0.085, d + 0.151 + (st === 'dravon' || st === 'velkar' ? 0 : 0.007), 0.2);
  // zwei hohe Schornsteine: die Kennform gegen das U-Boot / two tall funnels: the signature against the submarine
  funnel(b, A, f, L, -0.035, d, 0.2, 0.027, 0.032);
  funnel(b, A, f, L, -0.105, d, 0.175, 0.024, 0.028);
  lifeboats(b, A, 0.082, d + 0.05, -0.07);
  gunTurret(b, A, f, L, 0.225, d, 0.052, 0.046, 0.045, 1, false);
  gunTurret(b, A, f, L, -0.285, d, 0.044, 0.04, 0.04, 1, true, 0.125);
  if (st === 'meridon') containers(b, A, L, -0.2, d, 0.9);
  else {
    // Torpedorohre auf Drehkranz / torpedo tubes on a training ring
    b.add(softBox(0.07, 0.02, 0.075, 0.006), L.hullDark, { xf: { p: [0, d + 0.01, -0.2] } });
    for (const x of [-0.017, 0.017]) b.add(loftZ([{ z: -0.05, rx: 0.01, hard: true, c: mat.dark }, { z: -0.042, rx: 0.011, hard: true, c: L.hull }, { z: 0.04, rx: 0.011, hard: true, c: mat.dark }, { z: 0.05, rx: 0.008 }], { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true, capLast: true }), null, { xf: { p: [x, d + 0.03, -0.2] }, gloss: 0.3 });
  }
  // Nahbereichsabwehr auf der Bruecke, Radarkuppel achtern / close-in gun on the bridge, radar dome aft
  ball(b, A, [0, d + 0.172, 0.085], 0.017, mat.white, { ry: 0.02 });
  if (hi) rod(b, [0, d + 0.172, 0.095], [0, d + 0.176, 0.135], 0.0035, mat.dark);
  rod(b, [0, d, -0.158], [0, d + 0.1, -0.158], 0.0055, mat.dark, { cap: false });
  ball(b, A, [0, d + 0.115, -0.158], 0.021, mat.white);
  bowMarks(b, A, f, L, w * 0.975, d * 0.56, 0.17, 0.036, [4, 2]);
  if (f === 'velkar') techLine(b, A, w * 0.985, d * 0.72, -0.07, 0.42);
  return turretInfo(b, [{ yaw: 0, arc: SHIP_TURRET_ARC }, { yaw: Math.PI, arc: SHIP_TURRET_ARC }]);
}

// ---------- Schlachtschiff / battleship ----------

export function battleship(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), st = styleOf(f), hi = fine();
  const D = BATTLESHIP, w = D.beam / 2, d = D.deck;
  shipHull(b, {
    outline: shipOutline(D.z0, D.z1, D.beam, D.bow, 0.82, hi ? 9 : 6, 0.7), deckY: sheerY(D), bowZ: D.z1 - D.bow,
    rows: sideRows(L.trim, L.hull, L.hullDark, { gun: D.gun, keel: 0.026, flare: 0.06 }),
    side: A.get('hullSide'), transom: A.get('blank'),
    deck: { region: A.get('deck:battleship'), color: mat.woodLight, inset: D.inset, drop: D.gun, lip: shade(L.hull, 0.78) },
  });
  foam(b, A, w, D.z0, D.z1 - 0.002, D.bow, 0.008);
  // drei Tuerme: zwei vorn (ueberhoehend), einer hinten / three turrets: two fore (superfiring), one aft
  gunTurret(b, A, f, L, 0.25, d, 0.085, 0.052, 0.05, 2, false);
  b.add(loft([{ y: 0.04, rx: 0.08, rz: 0.05, hard: true }, { y: 0, rx: 0.086, rz: 0.055 }], { seg: hi ? 18 : 10, region: A.get('blank'), color: L.hullDark, capFirst: true }), null, { xf: { p: [0, d, 0.142] } });
  gunTurret(b, A, f, L, 0.142, d + 0.04, 0.085, 0.052, 0.05, 2, false);
  gunTurret(b, A, f, L, -0.25, d, 0.085, 0.052, 0.05, 2, true, 0.194);
  // Aufbau mit hohem Gefechtsturm (Pagode): die Kennform gegen den flachen Zerstoerer / superstructure with a tall battle tower (pagoda): the signature against the low destroyer
  house(b, A, f, L, 0, d, -0.01, 0.26, 0.075, 0.2);
  house(b, A, f, L, 0, d + 0.075, 0.012, 0.19, 0.066, 0.11, true);
  house(b, A, f, L, 0, d + 0.141 + 0.007, 0.022, 0.125, 0.055, 0.062);
  house(b, A, f, L, 0, d + 0.203 + 0.007, 0.022, 0.16, 0.064, 0.08, true);
  // Leitstand mit Messbasis / fire-control top with a rangefinder
  crate(b, 0.2, 0.036, 0.055, 0.008, { pz: A.get('bridgeSlit'), all: A.get('blank') }, L.hullDark, { p: [0, d + 0.3, 0.022] });
  mast(b, A, f, L, 0.018, d + 0.318, 0.21, 0.035);
  funnel(b, A, f, L, -0.135, d, 0.19, 0.036, 0.052);
  if (st === 'meridon') containers(b, A, L, -0.335, d, 1.2);
  // Nebengeschuetze in Kuppeln / secondary guns in domes
  for (const s of [-1, 1]) for (const z of [-0.055, 0.075]) {
    ball(b, A, [s * 0.165, d + 0.012, z], 0.03, L.hull, { ry: 0.028, cell: 'dome', crease: 0.6 });
    rod(b, [s * 0.165, d + 0.022, z + 0.02], [s * 0.17, d + 0.027, z + 0.075], 0.006, mat.dark, { r1: 0.005 });
  }
  // Flak / anti-aircraft guns
  if (hi) for (const s of [-1, 1]) for (const z of [-0.165, 0.17]) {
    b.add(loft([{ y: 0.016, rx: 0.017, hard: true }, { y: 0, rx: 0.019 }], { seg: 8, region: A.get('blank'), color: shade(L.hull, 0.9), capFirst: true }), null, { xf: { p: [s * 0.17, d, z] } });
    for (const dx of [-0.005, 0.005]) rod(b, [s * 0.17 + dx, d + 0.016, z + 0.004], [s * 0.17 + dx, d + 0.04, z + 0.03], 0.0028, mat.dark);
  }
  lifeboats(b, A, 0.178, d + 0.05, -0.115);
  // Heckkran, Katapult, Bordflugzeug / stern crane, catapult, floatplane
  if (st !== 'meridon') {
    rod(b, [0.1, d, -0.36], [0.1, d + 0.07, -0.36], 0.009, mat.dark, { r1: 0.007 });
    rod(b, [0.1, d + 0.066, -0.365], [0.1, d + 0.105, -0.29], 0.006, mat.dark);
    crate(b, 0.034, 0.01, 0.13, 0.003, { py: A.get('catapult'), all: A.get('blank') }, mat.metal, { p: [-0.075, d + 0.005, -0.36] });
    if (hi) b.group({ p: [-0.075, d + 0.03, -0.36] }, () => {
      b.add(loftZ([{ z: -0.04, rx: TIP, c: L.primaryDark }, { z: -0.03, rx: 0.007 }, { z: 0.02, rx: 0.01 }, { z: 0.036, rx: 0.008 }, { z: 0.042, rx: TIP }], { seg: 8, region: A.get('blank') }), null, { crease: 0 });
      b.add(softBox(0.13, 0.004, 0.024, 0.002), L.primary, { xf: { p: [0, 0.008, 0.008] } });
      b.add(softBox(0.045, 0.004, 0.014, 0.002), L.primary, { xf: { p: [0, 0.006, -0.032] } });
      b.add(loftZ([{ z: -0.03, rx: TIP, c: mat.white }, { z: -0.02, rx: 0.005 }, { z: 0.02, rx: 0.006 }, { z: 0.032, rx: TIP }], { seg: 6, region: A.get('blank') }), null, { xf: { p: [0, -0.016, 0.004] }, crease: 0 });
    });
  }
  bowMarks(b, A, f, L, w * 0.98, d * 0.56, 0.17, 0.042, [0, 7]);
  if (f === 'velkar') techLine(b, A, w * 0.99, d * 0.72, -0.07, 0.46);
  const arc = SHIP_TURRET_ARC;
  return turretInfo(b, [{ yaw: 0, arc }, { yaw: 0, arc }, { yaw: Math.PI, arc }]);
}

// ---------- U-Boot / submarine ----------

/** Turm des U-Boots: Ringe je Bauform (oben nach unten) / the submarine's sail: rings per style (top to bottom) */
export function sailRings(st: HumanStyle, L: Look, f: FactionId): { rings: Ring[]; top: number; e: number } {
  const y0 = SUB.deck - 0.004;
  switch (st) {
    case 'dravon': {
      const top = 0.225;
      return { top, e: 3, rings: [
        { y: top, rx: 0.05, rz: 0.045, rzB: 0.07, cz: -0.012, e: 3, hard: true, c: L.hull },
        { y: top - 0.045, rx: 0.052, rz: 0.062, rzB: 0.074, cz: -0.006, e: 3, hard: true, c: L.trim },
        { y: top - 0.07, rx: 0.053, rz: 0.07, rzB: 0.076, cz: -0.004, e: 3, hard: true, c: L.hull },
        { y: y0, rx: 0.055, rz: 0.1, rzB: 0.085, e: 3 },
      ] };
    }
    case 'alvenia': {
      const top = 0.2;
      return { top, e: 2, rings: [
        { y: top, rx: 0.052, rz: 0.085, e: 2, hard: true, c: L.trim }, { y: top - 0.018, rx: 0.052, rz: 0.085, e: 2, hard: true, c: L.hull }, { y: y0, rx: 0.054, rz: 0.09, e: 2 },
      ] };
    }
    case 'velkar': {
      const top = 0.2, band = f === 'velkar' ? TECH.glow : L.secondary;
      return { top, e: 3.2, rings: [
        { y: top, rx: 0.046, rz: 0.058, rzB: 0.066, cz: -0.008, e: 3.2, hard: true, c: L.hull },
        { y: top - 0.04, rx: 0.048, rz: 0.068, rzB: 0.072, cz: -0.005, e: 3.2, hard: true, c: band },
        { y: top - 0.056, rx: 0.049, rz: 0.072, rzB: 0.075, cz: -0.004, e: 3.2, hard: true, c: L.hull },
        { y: y0, rx: 0.055, rz: 0.095, e: 3.2 },
      ] };
    }
    default: {
      const top = 0.2;
      return { top, e: 3.6, rings: [
        { y: top, rx: 0.052, rz: 0.078, e: 3.6, hard: true, c: L.trim }, { y: top - 0.02, rx: 0.052, rz: 0.078, e: 3.6, hard: true, c: L.hull }, { y: y0, rx: 0.053, rz: 0.08, e: 3.6 },
      ] };
    }
  }
}

export function submarine(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), st = styleOf(f), hi = fine();
  const S = SUB, w = S.beam / 2, half = S.z1;
  // Druckkoerper als Walruecken: nur was ueber Wasser liegt, schmales Oberdeck / pressure hull as a whaleback: only what is above water, narrow casing deck
  const n = hi ? 20 : 12;
  const outline: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const z = S.z0 + ((S.z1 - S.z0) * i) / n, u = Math.abs(z / half);
    // stumpfe Enden: laufen die Zeilen in einem Punkt zusammen, faechert die Tusche dort auf / blunt ends: where the rows meet in one point the ink fans out
    outline.push([z, Math.max(0.03, w * Math.pow(Math.max(0, 1 - Math.pow(u, 2.3)), 0.55))]);
  }
  const dark = L.hullDark;
  shipHull(b, {
    outline, bowZ: half, deckY: (z) => S.deck * (1 - 0.8 * Math.pow(Math.abs(z / half), 4)),
    rows: [
      { h: 1, k: 0.25, t: 0, c: L.hull, hard: true }, { h: 0.84, k: 0.5, t: 0.2 }, { h: 0.5, k: 0.82, t: 0.48 },
      { h: 0, dy: 0.006, k: 1, t: 0.8, c: dark, hard: true }, { h: 0, dy: -0.024, k: 0.97, t: 1 },
    ],
    side: A.get('subSide'), transom: A.get('blank'), bowPlate: A.get('blank'),
    deck: { region: A.get('deck:sub'), color: shade(L.hull, 0.86), inset: 1, drop: 0, lip: L.hull },
  });
  foam(b, A, w * 0.55, S.z0 + 0.03, S.z1 - 0.01, 0.13);
  // Turm / sail
  const sz = S.sail, sail = sailRings(st, L, f), top = sail.top;
  b.add(loft(sail.rings, { seg: hi ? 26 : 16, region: A.get('sail'), capFirst: A.get('sailTop') }), null, { xf: { p: [0, 0, sz] } });
  if (st === 'meridon') {
    // Frachtbehaelter hinter dem Turm / cargo pod behind the sail
    crate(b, 0.1, 0.04, 0.12, 0.006, { px: A.get('container'), nx: A.get('container'), mirrorNx: true, all: A.get('blank') }, L.trim, { p: [0, S.deck + 0.018, -0.105] });
  }
  if (f === 'velkar') {
    rod(b, [0, top, sz - 0.04], [0, top + 0.1, sz - 0.05], 0.004, TECH.gear, { cap: false });
    ball(b, A, [0, top + 0.105, sz - 0.05], 0.011, TECH.glow, { rows: 3, seg: 6 });
    for (const s of [-1, 1]) decal(b, A, 'glowStrip', [s * (w * 0.9), 0.022, 0], [s, 0.7, 0], [0, 1, 0], 0.42, 0.008, TECH.glow);
  }
  // Tiefenruder am Turm, Sehrohre, Schnorchel / planes on the sail, periscopes, snorkel
  b.add(softBox(0.2, 0.008, 0.036, 0.004), dark, { xf: { p: [0, 0.125, sz + 0.03] } });
  rod(b, [0.016, top - 0.01, sz - 0.052], [0.016, top + 0.12, sz - 0.052], 0.005, mat.dark);
  b.add(softBox(0.012, 0.014, 0.024, 0.003), mat.dark, { xf: { p: [0.016, top + 0.125, sz - 0.046] }, gloss: 0.4 });
  rod(b, [-0.018, top - 0.01, sz - 0.056], [-0.018, top + 0.075, sz - 0.056], 0.0075, mat.darkMid);
  if (hi) rod(b, [0.034, top - 0.01, sz - 0.04], [0.042, top + 0.11, sz - 0.05], 0.0016, mat.dark, { seg: 3 });
  // Heckruder / stern rudder
  b.add(softBox(0.008, 0.07, 0.05, 0.003), dark, { xf: { p: [0, 0.012, S.z0 + 0.035] } });
  b.add(softBox(0.15, 0.007, 0.045, 0.003), dark, { xf: { p: [0, 0.006, S.z0 + 0.04] } });
  // Bugtiefenruder / bow planes
  if (hi) for (const s of [-1, 1]) b.add(softBox(0.05, 0.006, 0.026, 0.003), dark, { xf: { p: [s * 0.085, 0.014, 0.3], r: [0, s * 0.15, s * -0.1] } });
  // Deckgeschuetz vor dem Turm (ausser Velkar und Alvenia: dort gezeichnete Startluken) / deck gun in front of the sail (except Velkar and Alvenia: drawn launch hatches there)
  if (st !== 'velkar' && st !== 'alvenia') {
    b.add(loft([{ y: 0.03, rx: 0.012, rz: 0.016, e: 3, hard: true }, { y: 0, rx: 0.015 }], { seg: hi ? 10 : 6, region: A.get('blank'), color: L.hullDark, capFirst: true }), null, { xf: { p: [0, S.deck, sz + 0.17] } });
    rod(b, [0, S.deck + 0.026, sz + 0.175], [0, S.deck + 0.034, sz + 0.24], 0.0045, mat.dark, { r1: 0.0038 });
  }
  for (const s of [-1, 1]) insignia(b, A, f, [s * 0.054, top - 0.072, sz - 0.01], [s, 0, 0], 0.038, L.primaryDark);
  // Kommandant im Turm / commander in the sail
  b.group({ p: [0, top + 0.012 - 0.443 * CREW, sz + 0.012], s: CREW }, () => {
    figure(b, A, f, { pelvis: [0, 0.302, 0], head: [-0.14, 0.2, 0], handL: [-0.085, 0.385, 0.07], handR: [0.085, 0.385, 0.07], footL: [0, 0, 0], footR: [0, 0, 0], elbowPoleL: [-1, -0.2, -0.3], elbowPoleR: [1, -0.2, -0.3] }, { detail: 0, noLegs: true, seed: 8 });
  });
  return b;
}
