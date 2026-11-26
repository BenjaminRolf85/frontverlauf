/**
 * Gezeichnete Einheiten: Boote und der Lenkflugkoerper der Meridon (Atlas 'boat'): Landungsboot, Kaperschiff,
 * Nebelkutter, Lenkflugkoerper. Wasserlinie bei y = 0, Bug in +z.
 * Inked units: boats and Meridon's guided missile (atlas 'boat'): landing boat, privateer, fog cutter, guided missile.
 * Waterline at y = 0, bow towards +z.
 *
 * Landungsboot und Nebelkutter tragen Ladung: unitGeometry() reicht das (bisherige, vereinfachte) Modell der getragenen
 * Einheit ueber withBoatCargo() herein; es steht ohne Zeichnung im Laderaum (wie ein Teil ueber die Bruecke).
 * Landing boat and fog cutter carry cargo: unitGeometry() hands in the (previous, simplified) model of the carried unit
 * through withBoatCargo(); it stands in the well without drawing (like a part through the bridge).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { fine, mix, shade, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat, type Look } from '../look';
import { TECH } from '../velkarTech';
import { CREW, figure } from './figure';
import { ball, crate, insignia, loftZ, rod, sheet, shipHull, shipOutline, TIP, tub, type HullRow } from './navalKit';
import { foam, house, SIDE_T, sideRows } from './ships';
import { decal, emblemDecal, wheel } from './trim';
import { AtlasLayout, loft, UvBuilder } from './uvkit';

// ---------- Ladung / cargo ----------

let cargo: THREE.BufferGeometry | null = null;
/**
 * fn mit Ladung bauen: die Geometrie der getragenen Einheit (position, normal, color) steht waehrenddessen bereit.
 * Build fn with cargo: the carried unit's geometry (position, normal, color) is available meanwhile.
 */
export function withBoatCargo<T>(g: THREE.BufferGeometry | null, fn: () => T): T {
  const prev = cargo;
  cargo = g;
  try { return fn(); } finally { cargo = prev; }
}
/** Ladung in halber Groesse an p, sonst eine Kiste unter Plane / cargo at half size at p, else a crate under a tarp */
function stow(b: UvBuilder, A: AtlasLayout, L: Look, p: V3, floor: number): void {
  if (cargo) {
    const g = cargo.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    g.userData = { smooth: true };
    b.add(g, null, { xf: { p: [p[0], floor, p[2]], s: 0.5 }, crease: 0.7 });
  } else crate(b, 0.092, 0.056, 0.092, 0.008, { all: A.get('cargo') }, L.gear, { p: [p[0], floor + 0.028, p[2]] });
}

// ---------- Landungsboot / landing boat ----------

export const BOAT = { z0: -0.235, z1: 0.215, beam: 0.42, top: 0.076, floor: 0.026, inset: 0.855 };

export function landingBoat(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const B = BOAT, w = B.beam / 2;
  // flacher Kasten mit gefasten Ecken, offener Laderaum, breiter Dollbord / flat box with chamfered corners, open well, wide gunwale
  const outline: [number, number][] = [[B.z0, w * 0.9], [B.z0 + 0.03, w], [-0.08, w], [0.07, w], [B.z1 - 0.04, w], [B.z1, w * 0.86]];
  shipHull(b, {
    outline, deckY: () => B.top, bowZ: B.z1,
    rows: sideRows(L.trim, L.hull, L.hullDark, { gun: 0, keel: 0.026, flare: 0.035, rake: 0, stripe: 0.01 }),
    side: A.get('boatSide'), transom: A.get('blank'), bowPlate: A.get('blank'),
    well: { region: A.get('deck:boat'), floor: B.floor, inset: B.inset, floorColor: mat.woodLight, wall: shade(L.hull, 0.8), lip: L.trim },
  });
  // Bugrampe mit Rippen, leicht nach vorn geneigt / bow ramp with ribs, leaning slightly forward
  crate(b, w * 1.66, 0.112, 0.016, 0.004, { pz: A.get('ramp'), nz: A.get('ramp'), all: A.get('blank') }, L.hullDark, { p: [0, 0.068, B.z1 + 0.004], r: [-0.2, 0, 0] });
  for (const s of [-1, 1]) rod(b, [s * (w - 0.022), B.top, B.z1 - 0.04], [s * (w - 0.022), 0.118, B.z1 - 0.004], 0.0035, mat.metal, { cap: true });
  // Heckaufbau: Motorraum quer, darauf Steuerwanne (Steuerbord) und Motorhaube mit Auspuff (Backbord)
  // stern block: engine room across, on it the helm tub (starboard) and the engine cover with exhausts (port)
  const bz = B.z0 + 0.05, by = 0.094;
  crate(b, B.beam - 0.03, by - 0.014, 0.08, 0.008, { pz: A.get('bulkhead'), all: A.get('blank') }, L.hull, { p: [0, 0.014 + (by - 0.014) / 2, bz] });
  tub(b, A, [0.085, by, bz - 0.002], 0.058, 0.036, 0.05, L.hull, { rim: L.trim });
  b.group({ p: [0.085, by + 0.056 - 0.443 * CREW, bz - 0.004], s: CREW }, () => {
    figure(b, A, f, { pelvis: [0, 0.302, 0], head: [-0.1, -0.25, 0], handL: [-0.075, 0.4, 0.075], handR: [0.075, 0.4, 0.075], footL: [0, 0, 0], footR: [0, 0, 0], elbowPoleL: [-1, -0.2, -0.3], elbowPoleR: [1, -0.2, -0.3] }, { detail: 0, noLegs: true, seed: 9 });
  });
  crate(b, 0.12, 0.034, 0.064, 0.008, { py: A.get('grille'), all: A.get('blank') }, L.hullDark, { p: [-0.09, by + 0.017, bz] });
  if (hi) for (const dx of [-0.03, 0.03]) b.add(loft([{ y: 0.05, rx: 0.0055, hard: true }, { y: 0.05, rx: 0.007, hard: true }, { y: 0, rx: 0.008 }], { seg: 8, region: A.get('exhaust'), capFirst: A.get('blank'), color: mat.darkMid }), null, { xf: { p: [-0.09 + dx, by + 0.03, bz - 0.024], r: [-0.2, 0, 0] } });
  // Funkmast mit Wimpel / radio mast with a pennant
  rod(b, [0.165, by, bz - 0.02], [0.165, by + 0.2, bz - 0.026], 0.0035, mat.dark, { r1: 0.002 });
  sheet(b, [[0.165, by + 0.2, bz - 0.028], [0.165, by + 0.19, bz - 0.088], [0.165, by + 0.184, bz - 0.088], [0.165, by + 0.174, bz - 0.028]], 0.004, A.get('blank'), L.trim, { nu: 2, nv: 1 });
  // Positionslichter, Emblem / navigation lights, emblem
  if (hi) for (const s of [-1, 1]) b.add(softBox(0.012, 0.012, 0.012, 0.003), s < 0 ? mat.red : mat.green, { xf: { p: [s * (w - 0.016), B.top + 0.006, 0.15] }, gloss: 0.6, crease: 0 });
  for (const s of [-1, 1]) insignia(b, A, f, [s * (w * 0.985 + 0.001), 0.042, -0.045], [s, -0.06, 0], 0.032, L.primaryDark);
  // Velkar: Leuchtleisten auf dem Dollbord / Velkar: light strips on the gunwale
  if (f === 'velkar') for (const s of [-1, 1]) decal(b, A, 'glowStrip', [s * (w - 0.016), B.top - 0.002, 0.03], [0, 1, 0], [s, 0, 0], 0.27, 0.01, TECH.glow);
  stow(b, A, L, [-0.01, 0, 0.04], B.floor);
  if (hi) {
    // Bord-MG auf Pivot mit Schild an Backbord / pintle MG with a shield on the port side
    b.group({ p: [-(w - 0.016), B.top, 0.02] }, () => {
      rod(b, [0, 0, 0], [0, 0.036, 0], 0.0045, mat.dark, { cap: false });
      b.add(softBox(0.014, 0.014, 0.05, 0.003), mat.dark, { xf: { p: [0, 0.042, 0.008] }, gloss: 0.4 });
      rod(b, [0, 0.043, 0.03], [0, 0.045, 0.085], 0.0036, mat.darkMid);
      b.add(softBox(0.046, 0.032, 0.004, 0.0015), L.hullDark, { xf: { p: [0, 0.048, 0.034] } });
    });
  }
  return b;
}

// ---------- Kaperschiff / privateer ----------

export const PRIVATEER = { z0: -0.4, z1: 0.375, beam: 0.26, bow: 0.25, deck: 0.056, gun: 0.01, inset: 0.92 };

export function privateer(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const P = PRIVATEER, w = P.beam / 2, dk = P.deck;
  // schlanker Holzrumpf mit Sprung an Bug und Heck / slim wooden hull with sheer at bow and stern
  const deckY = (z: number) => { const fb = Math.max(0, (z - (P.z1 - P.bow)) / P.bow), fs = Math.max(0, (-0.22 - z) / 0.18); return dk + 0.026 * fb * fb + 0.012 * fs * fs; };
  shipHull(b, {
    outline: shipOutline(P.z0, P.z1, P.beam, P.bow, 0.72, hi ? 7 : 4, 0.75), deckY, bowZ: P.z1 - P.bow,
    rows: sideRows(L.trim, L.hull, L.hullDark, { gun: P.gun, keel: 0.026, flare: 0.1, rake: 0.05 }),
    side: A.get('plankSide'), transom: A.get('blank'),
    deck: { region: A.get('deck:privateer'), color: mat.woodLight, inset: P.inset, drop: P.gun, lip: shade(L.hull, 0.78) },
  });
  foam(b, A, w, P.z0 + 0.02, P.z1, P.bow);
  // Steuerhaus achtern mit kleinem Radarmast / wheelhouse aft with a small radar mast
  house(b, A, f, L, 0, dk, -0.16, 0.15, 0.072, 0.11, true);
  rod(b, [0, dk + 0.075, -0.17], [0, dk + 0.16, -0.17], 0.004, mat.dark);
  b.add(softBox(0.07, 0.012, 0.008, 0.003), mat.white, { xf: { p: [0, dk + 0.13, -0.17], r: [0, 0.6, 0] } });
  // Hauptmast, Gaffelsegel in Zweitfarbe, Rahsegel quer, Klueverfock am Bugspriet
  // main mast, gaff sail in the secondary colour, square sail across, jib on the bowsprit
  const mz = 0.045, top = dk + 0.44;
  rod(b, [0, dk, mz], [0, top, mz], 0.009, mat.wood, { r1: 0.005, seg: hi ? 8 : 5 });
  rod(b, [0, dk + 0.07, mz - 0.01], [0, dk + 0.085, mz - 0.19], 0.0045, mat.wood);
  rod(b, [0, dk + 0.385, mz - 0.006], [0, dk + 0.335, mz - 0.14], 0.004, mat.wood);
  sheet(b, [[0, dk + 0.385, mz - 0.012], [0, dk + 0.335, mz - 0.138], [0, dk + 0.088, mz - 0.185], [0, dk + 0.075, mz - 0.012]], 0.006, A.get('sail'), L.secondary);
  for (const s of [-1, 1]) emblemDecal(b, A, f, [-0.0055, dk + 0.22, mz - 0.085], [s, 0, 0], 0.07, L.secondary);
  const yz = mz + 0.012, y1 = dk + 0.4, y0 = dk + 0.17;
  rod(b, [-0.2, y1, yz], [0.2, y1, yz], 0.0045, mat.wood, { cap: true });
  sheet(b, [[-0.195, y1 - 0.004, yz], [0.195, y1 - 0.004, yz], [0.175, y0, yz + 0.012], [-0.175, y0, yz + 0.012]], -0.03, A.get('sail'), mat.paper);
  if (hi) for (const s of [-1, 1]) rod(b, [s * 0.175, y0, yz + 0.012], [s * w * 0.9, dk + 0.012, mz - 0.07], 0.0013, shade(mat.wood, 0.7), { seg: 3, cap: false });
  rod(b, [0, dk + 0.03, P.z1 - 0.05], [0, dk + 0.062, P.z1 + 0.05], 0.0045, mat.wood, { r1: 0.003 });
  sheet(b, [[0, dk + 0.4, mz + 0.016], [0, dk + 0.4, mz + 0.016], [0, dk + 0.066, P.z1 + 0.04], [0, dk + 0.06, mz + 0.04]], 0.012, A.get('sail'), mat.paper, { nu: 3, nv: 3 });
  // Kaperflagge: schwarz mit Emblem / letter-of-marque flag: black with the emblem
  sheet(b, [[0, top, mz - 0.004], [0, top - 0.004, mz - 0.075], [0, top - 0.048, mz - 0.075], [0, top - 0.044, mz - 0.004]], 0.003, A.get('blank'), mat.ink, { nu: 2, nv: 1 });
  for (const s of [-1, 1]) emblemDecal(b, A, f, [-0.003, top - 0.024, mz - 0.04], [s, 0, 0], 0.032, mat.ink);
  // Bugkanone hinter Schild / bow gun behind a shield
  b.add(loft([{ y: 0.02, rx: 0.028, hard: true }, { y: 0, rx: 0.033 }], { seg: hi ? 12 : 8, region: A.get('blank'), capFirst: true, color: L.hullDark }), null, { xf: { p: [0, dk, 0.2] } });
  b.add(softBox(0.07, 0.04, 0.008, 0.003), L.hull, { xf: { p: [0, dk + 0.04, 0.222], r: [-0.25, 0, 0] } });
  rod(b, [0, dk + 0.036, 0.2], [0, dk + 0.046, 0.31], 0.0075, mat.dark, { r1: 0.006, seg: hi ? 8 : 5 });
  // Beute: Truhe mit Gold, Kiste, Fass / loot: chest with gold, crate, barrel
  crate(b, 0.064, 0.04, 0.044, 0.006, { all: A.get('chest') }, mat.wood, { p: [0.04, dk + 0.02, 0.11] });
  crate(b, 0.045, 0.036, 0.045, 0.004, { all: A.get('cargo') }, L.trim, { p: [-0.05, dk + 0.018, 0.115], r: [0, 0.3, 0] });
  b.add(loft([{ y: 0.05, rx: 0.016, hard: true }, { y: 0.038, rx: 0.02 }, { y: 0.012, rx: 0.02 }, { y: 0, rx: 0.016, hard: true }], { seg: hi ? 10 : 6, region: A.get('keg'), capFirst: true, color: L.primary }), null, { xf: { p: [-0.055, dk, -0.05] } });
  // Aussenborder / twin outboards
  for (const s of [-1, 1]) {
    b.add(softBox(0.034, 0.05, 0.036, 0.008), mat.dark, { xf: { p: [s * 0.045, dk + 0.012, P.z0 - 0.012] }, gloss: 0.3 });
    b.add(softBox(0.01, 0.06, 0.014, 0.003), mat.darkMid, { xf: { p: [s * 0.045, 0.012, P.z0 - 0.016] } });
  }
  if (hi) {
    // Takelage: Wanten und Stagen / rigging: shrouds and stays
    const rope = shade(mat.wood, 0.7);
    for (const s of [-1, 1]) for (const z of [mz - 0.03, mz + 0.05]) rod(b, [0, top - 0.03, mz], [s * w * 0.93, dk + 0.012, z], 0.0016, rope, { seg: 3, cap: false });
    rod(b, [0, top - 0.02, mz], [0, dk + 0.1, -0.2], 0.0016, rope, { seg: 3, cap: false });
    // Keine Figur an Deck: im einheitlichen Besatzungsmassstab (CREW) waere sie so hoch wie das Steuerhaus und verdeckte
    // die Segel; die Besatzung steht im Steuerhaus hinter dem Fensterband.
    // No figure on deck: at the uniform crew scale (CREW) it would be as tall as the wheelhouse and hide the sails; the
    // crew stands in the wheelhouse behind the window band.
  }
  return b;
}

// ---------- Nebelkutter / fog cutter ----------

export const CUTTER = { z0: -0.3, z1: 0.26, beam: 0.36, top: 0.05, inset: 0.9 };
/** Tarngrau der Schattenflotte / camo grey of the shadow fleet */
export const shadowGrey = (f: FactionId): ColorLike => mix(look(f).primaryDark, mat.ink, 0.45);

export function fogCutter(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const C = CUTTER, w = C.beam / 2, top = C.top;
  const grey = shadowGrey(f);
  // flacher Rumpf mit Keilbug: Gummiwulst, graue Bordwand, Wasserlinie in Fraktionsfarbe / flat hull with a wedge bow: rubber collar, grey side, waterline in the faction colour
  const outline: [number, number][] = [[C.z0, w * 0.94], [C.z0 + 0.03, w], [-0.08, w], [0.08, w], [0.17, w * 0.74], [0.225, w * 0.38], [C.z1, 0]];
  const rows: HullRow[] = [
    { h: 1, k: 1, t: 0, c: mat.dark, hard: true },
    { h: 1, dy: -0.012, k: 1.005, t: SIDE_T.trim, c: grey, hard: true },
    { h: 0.24, k: 0.98, rake: 0.016, t: 0.62, c: L.primary, hard: true },
    { h: 0, dy: 0.006, k: 0.965, rake: 0.025, t: SIDE_T.water, c: mat.ink, hard: true },
    { h: 0, dy: -0.018, k: 0.9, rake: 0.04, t: 1 },
  ];
  shipHull(b, {
    outline, deckY: () => top, bowZ: 0.08, rows, side: A.get('cutterSide'), transom: A.get('blank'),
    deck: { region: A.get('deck:cutter'), color: shade(grey, 1.3), inset: C.inset, drop: 0.006, lip: mat.dark },
  });
  foam(b, A, w * 0.62, C.z0 + 0.03, C.z1, 0.1);
  // flache Bruecke mit schraeger Scheibe / low bridge with a sloped screen
  const bz = -0.115;
  b.add(loft([
    { y: 0.062, rx: 0.07, rz: 0.035, rzB: 0.055, e: 4.5, hard: true, c: L.trim }, { y: 0.054, rx: 0.073, rz: 0.04, rzB: 0.057, e: 4.5, hard: true, c: shade(grey, 0.9) },
    { y: 0, rx: 0.075, rz: 0.066, rzB: 0.058, e: 4.5 },
  ], { seg: hi ? 18 : 10, region: A.get('cutterBridge'), capFirst: A.get('blank') }), null, { xf: { p: [0, top - 0.006, bz] } });
  // Mast mit Radarbalken und Gold-Wimpel / mast with a radar bar and a gold pennant
  const mz = bz - 0.066, mx = 0.045;
  rod(b, [mx, top - 0.006, mz], [mx, top + 0.2, mz], 0.0045, mat.dark, { r1: 0.0028 });
  b.add(softBox(0.075, 0.01, 0.009, 0.003), mat.white, { xf: { p: [mx, top + 0.15, mz], r: [0, 0.5, 0] } });
  sheet(b, [[mx, top + 0.2, mz - 0.002], [mx, top + 0.192, mz - 0.055], [mx, top + 0.187, mz - 0.055], [mx, top + 0.178, mz - 0.002]], 0.003, A.get('blank'), mat.gold, { nu: 2, nv: 1 });
  // zwei Aussenborder / two outboard motors
  for (const s of [-1, 1]) {
    b.add(loft([{ y: 0.05, rx: 0.02, rz: 0.022, e: 3, hard: true, c: L.primary }, { y: 0.04, rx: 0.023, rz: 0.026, e: 3, hard: true, c: mat.darkMid }, { y: 0, rx: 0.021, rz: 0.024, e: 3 }], { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true }), null, { xf: { p: [s * 0.07, top - 0.004, C.z0 - 0.004] }, gloss: 0.3 });
    b.add(softBox(0.014, 0.05, 0.02, 0.004), mat.dark, { xf: { p: [s * 0.07, 0.02, C.z0 - 0.014] } });
  }
  // Tarnnetz ueber dem Heck / camo net over the stern
  b.add(loft([
    { y: 0.034, rx: TIP, c: mix(grey, mat.leafDark, 0.35) }, { y: 0.03, rx: 0.055, rz: 0.028 }, { y: 0.016, rx: 0.115, rz: 0.05, e: 2.6 }, { y: 0, rx: 0.135, rz: 0.06, e: 3 },
  ], { seg: hi ? 16 : 8, region: A.get('camo'), arc: true }), null, { xf: { p: [0, top - 0.006, -0.235] }, crease: 0 });
  // Nebelwerfer: zwei Rohre am Heck mit Nebelschwaden / smoke throwers: two tubes at the stern with puffs of fog
  for (const s of [-1, 1]) {
    rod(b, [s * 0.125, top, -0.25], [s * 0.145, top + 0.05, -0.275], 0.012, mat.darkMid, { r1: 0.013, seg: hi ? 8 : 5 });
    ball(b, A, [s * 0.155, top + 0.078, -0.285], 0.022, mat.cloud, { rows: hi ? 5 : 3, seg: hi ? 9 : 6 });
  }
  // Emblem und Kennnummer an der Bordwand / emblem and hull number on the side
  for (const s of [-1, 1]) {
    insignia(b, A, f, [s * (w * 0.995 + 0.001), 0.0255, -0.02 + s * 0.02], [s, -0.05, 0], 0.021, L.primaryDark, hi ? [3, 1] : []);
  }
  stow(b, A, L, [0, 0, 0.06], top - 0.006);
  if (hi) {
    // MG-Stand in der Dachluke der Bruecke mit Schuetze / MG position in the bridge's roof hatch with a gunner
    const ry = top + 0.056;
    tub(b, A, [0, ry, bz - 0.006], 0.05, 0.034, 0.014, shade(grey, 0.9), { rim: mat.dark });
    b.group({ p: [0, ry + 0.018 - 0.443 * CREW, bz - 0.008], s: CREW }, () => {
      figure(b, A, f, { pelvis: [0, 0.302, 0], head: [-0.08, 0, 0], handL: [-0.03, 0.42, 0.1], handR: [0.04, 0.4, 0.085], footL: [0, 0, 0], footR: [0, 0, 0], elbowPoleL: [-1, -0.3, -0.2], elbowPoleR: [1, -0.3, -0.2] }, { detail: 0, noLegs: true, seed: 12 });
    });
    b.add(softBox(0.016, 0.018, 0.06, 0.004), mat.dark, { xf: { p: [0, ry + 0.034, bz + 0.05] }, gloss: 0.4 });
    rod(b, [0, ry + 0.036, bz + 0.075], [0, ry + 0.04, bz + 0.14], 0.004, mat.dark);
    rod(b, [0, ry, bz + 0.045], [0, ry + 0.03, bz + 0.05], 0.004, mat.darkMid, { cap: false });
  }
  return b;
}

// ---------- Lenkflugkoerper / guided missile ----------

/** Masse des Flugkoerpers: Laenge, Radius, Neigung der Startschiene / missile dimensions: length, radius, slope of the launch rail */
export const MISSILE = { len: 0.45, r: 0.05, slope: 0.3 };

export function guidedMissile(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const grey = shadowGrey(f);
  const wr = 0.045, seg = hi ? 20 : 8;
  // Startwagen: Rahmen, zwei Achsen, Stuetzen mit Tellern / launch trailer: frame, two axles, outriggers with pads
  b.mirrorX(() => { for (const z of [-0.125, 0.088]) wheel(b, A, 0.106, wr, z, wr, 0.036, 'wheel', L.trim, hi ? 16 : 8); });
  crate(b, 0.19, 0.036, 0.42, 0.008, { px: A.get('trailerSide'), nx: A.get('trailerSide'), mirrorNx: true, pz: A.get('hazard'), nz: A.get('hazard'), all: A.get('blank') }, grey, { p: [0, wr + 0.026, -0.022] });
  crate(b, 0.15, 0.018, 0.37, 0.005, { py: A.get('trailerTop'), all: A.get('blank') }, shade(grey, 0.8), { p: [0, wr + 0.053, -0.022] });
  for (const s of [-1, 1]) insignia(b, A, f, [s * 0.095, wr + 0.026, -0.02], [s, 0, 0], 0.026, L.primaryDark);
  for (const s of [-1, 1]) for (const z of [-0.205, 0.165]) {
    rod(b, [s * 0.085, wr + 0.026, z], [s * 0.138, 0.012, z], 0.008, mat.darkMid, { cap: false, seg: hi ? 6 : 4 });
    b.add(loft([{ y: 0.01, rx: 0.02, hard: true }, { y: 0, rx: 0.023 }], { seg: hi ? 10 : 6, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [s * 0.138, 0, z] } });
  }
  // Startschiene, schraeg nach vorn oben, mit Hubzylinder / launch rail sloping up to the front, with a lifting ram
  const rp: V3 = [0, wr + 0.07, -0.2], ang = MISSILE.slope;
  rod(b, [0, wr + 0.06, 0.1], [0, wr + 0.135, 0.07], 0.014, mat.metal, { seg: hi ? 8 : 5, gloss: 0.5 });
  b.group({ p: rp, r: [-ang, 0, 0] }, () => {
    crate(b, 0.062, 0.026, 0.45, 0.006, { px: A.get('rail'), nx: A.get('rail'), mirrorNx: true, all: A.get('blank') }, mat.darkMid, { p: [0, 0, 0.21] });
    const my = 0.014 + MISSILE.r + 0.012, R = MISSILE.r, len = MISSILE.len;
    // Rumpf: Duese hinten, Nase vorn / body: nozzle at the rear, nose at the front
    b.add(loftZ([
      { z: 0, rx: R * 0.62, hard: true, c: mat.dark }, { z: 0.036, rx: R * 0.74, hard: true }, { z: 0.044, rx: R * 0.96, hard: true }, { z: 0.086, rx: R, c: mat.white },
      { z: len * 0.66, rx: R, c: L.primary }, { z: len * 0.75, rx: R * 0.95 }, { z: len * 0.83, rx: R * 0.81 }, { z: len * 0.91, rx: R * 0.53 }, { z: len * 0.975, rx: R * 0.22 }, { z: len, rx: TIP },
    ], { seg, region: A.get('missile'), capFirst: true }), null, { xf: { p: [0, my, 0.02] }, gloss: 0.35 });
    // Leitwerk: vier gepfeilte Flossen hinten, vier kleine Ruder vorn / tail: four swept fins at the rear, four small canards at the front
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      b.group({ p: [0, my, 0.02], r: [0, 0, a] }, () => {
        sheet(b, [[0, R * 2.3, 0.095], [0, R * 2.3, 0.15], [0, R * 0.95, 0.19], [0, R * 0.95, 0.075]], 0, A.get('fin'), L.primaryDark, { nu: 1, nv: 1, crease: 1 });
        if (hi) sheet(b, [[0, R * 1.55, 0.335], [0, R * 1.55, 0.355], [0, R * 0.9, 0.365], [0, R * 0.9, 0.325]], 0, A.get('blank'), L.primaryDark, { nu: 1, nv: 1, crease: 1 });
      });
    }
    // Startschuhe / launch shoes
    for (const z of [0.09, 0.3]) b.add(softBox(0.046, 0.022, 0.034, 0.005), mat.dark, { xf: { p: [0, 0.02, z + 0.02] } });
  });
  // Steuerkasten mit Kabeltrommel / control box with a cable drum
  crate(b, 0.06, 0.05, 0.06, 0.008, { pz: A.get('console'), all: A.get('blank') }, L.trim, { p: [0.058, wr + 0.087, 0.14] });
  if (hi) {
    b.add(loft([{ y: 0.02, rx: 0.03, hard: true, c: mat.dark }, { y: 0.016, rx: 0.03, hard: true, c: mat.yellow }, { y: 0.013, rx: 0.022, hard: true }, { y: -0.013, rx: 0.022, hard: true, c: mat.dark }, { y: -0.016, rx: 0.03, hard: true }, { y: -0.02, rx: 0.03, hard: true }], { seg: 12, region: A.get('blank'), capFirst: true, capLast: true }), null, { xf: { p: [-0.06, wr + 0.092, 0.14], r: [0, 0, Math.PI / 2] } });
    rod(b, [-0.06, wr + 0.1, 0.12], [0, wr + 0.11, -0.02], 0.0035, mat.ink, { seg: 4, cap: false });
    // Deichsel mit Zugoese / drawbar with a towing eye
    rod(b, [0, wr + 0.02, 0.18], [0, wr + 0.005, 0.27], 0.008, mat.darkMid, { seg: 5 });
  }
  return b;
}
