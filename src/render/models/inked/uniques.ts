/**
 * Gezeichnete Einheiten: einzigartige Einheiten der klassischen Fraktionen zu Fuss, zu Pferd und auf zwei Beinen.
 * Inked units: unique units of the classic factions on foot, on horseback and on two legs.
 * - Korvat: Steppenreiter (Pferd, Lanze mit Wimpel) / Steppe Rider (horse, lance with pennant)
 * - Dravon: Sturmbrecher (Kuerass, Sturmschild, Vorschlaghammer, Trommelflinte) / Stormbreaker (cuirass, assault shield, sledgehammer, drum shotgun)
 * - Alvenia: Friedenswacht als Ordenswacht (zwei Waechter mit Turmschilden, Wegschrein); andere Besitzer: Kontrollposten
 *   mit Schilderhaus und Schlagbaum / Peacekeepers as the Order Guard (two wardens with tower shields, wayside shrine);
 *   other owners: checkpoint with sentry box and boom barrier
 * - Velkar: Prototyp-Laeufer (Zweibeiner mit Moerser und Teslaspule) / Prototype Walker (biped with mortar and tesla coil)
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { FAITH, haloRing } from '../alveniaFaith';
import { fine, geo, mix, shade, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat } from '../look';
import { ANKLE_Y, FIG, figure, rifle, standPose, torsoRings } from './figure';
import { bead, box, cell, faces, frontLoft, plain, rod, shellRows, TIP } from './figkit';
import { caseBox, sandbag, shield, sledge } from './props';
import { censer, holyRifle } from './specials';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, loftAt, projectBox, ribbon, UvBuilder, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

// ---------- Korvat: Steppenreiter / steppe rider ----------

/** Rumpf des Pferdes entlang z (v nach vorn): Kruppe, Bauch, Widerrist, Brust / the horse's barrel along z (v forward): croup, belly, withers, chest */
function horseBarrel(coat: ColorLike): Ring[] {
  const R = (v: number, rx: number, up: number, down: number, cz = 0): Ring => ({ y: -v, rx, rz: up, rzB: down, cz, e: 2.2 });
  return [
    { y: 0.238, rx: TIP, cz: 0.02, c: coat },
    R(-0.222, 0.034, 0.04, 0.04, 0.02), R(-0.165, 0.061, 0.063, 0.064, 0.012), R(-0.06, 0.064, 0.052, 0.07), R(0.05, 0.062, 0.055, 0.072),
    R(0.145, 0.058, 0.066, 0.066, 0.006), R(0.2, 0.04, 0.05, 0.05, 0.012),
    { y: -0.224, rx: TIP, cz: 0.014 },
  ];
}
/** Schritt der Reiter: Massstab zwischen Besatzung und Fusstruppe, damit Pferd und Reiter unter dem Lebensbalken bleiben / the rider's scale: between crew and foot troops so horse and rider stay below the HP badge */
export const RIDER = 0.7;

function horse(b: UvBuilder, A: AtlasLayout, coat: ColorLike, mane: ColorLike): void {
  const hi = fine(), seg = hi ? 16 : 8, dark = shade(coat, 0.78);
  const barrel = horseBarrel(coat);
  b.group({ p: [0, 0.262, 0], r: [-HALF_PI, 0, 0] }, () => b.add(loft(barrel, { seg, region: cell(A, 'horseBody') }), null, { crease: 0 }));
  // Hals und Kopf / neck and head
  b.bone(V([0, 0.285, 0.165]), V([0, 0.452, 0.272]), new THREE.Vector3(0, 0.4, 1), (len) => {
    b.add(loft([{ y: -0.03, rx: 0.036, rz: 0.05, rzB: 0.05, c: coat }, { y: len * 0.5, rx: 0.03, rz: 0.04, rzB: 0.042 }, { y: len + 0.01, rx: 0.025, rz: 0.03, rzB: 0.036 }, { y: len + 0.03, rx: TIP }], { seg: hi ? 12 : 8, region: A.get('blank') }), null, { crease: 0 });
  });
  b.bone(V([0, 0.478, 0.262]), V([0, 0.375, 0.378]), new THREE.Vector3(0, 1, 0.9), () => {
    b.add(loft([
      { y: -0.022, rx: TIP, c: coat }, { y: -0.008, rx: 0.024, rz: 0.026 }, { y: 0.03, rx: 0.03, rz: 0.03, rzB: 0.036 }, { y: 0.08, rx: 0.025, rz: 0.024, rzB: 0.03 },
      { y: 0.122, rx: 0.019, rz: 0.019, rzB: 0.023 }, { y: 0.146, rx: 0.021, rz: 0.02, rzB: 0.022, c: dark }, { y: 0.162, rx: 0.015, rz: 0.014 }, { y: 0.168, rx: TIP },
    ], { seg: hi ? 12 : 8, region: cell(A, 'horseHead') }), null, { crease: 0 });
  });
  // Ohren, Maehne als Kamm, Schweif / ears, mane as a crest, tail
  for (const s of [-1, 1]) b.add(loft([{ y: 0, rx: 0.011, rz: 0.007 }, { y: 0.04, rx: TIP }], { seg: 5, region: A.get('blank'), color: coat }), null, { xf: { p: [s * 0.018, 0.492, 0.25], r: [-0.3, 0, s * -0.3] }, crease: 0.5 });
  b.add(plain(geo.profileZY([[0.14, 0.33], [0.2, 0.4], [0.262, 0.492], [0.292, 0.5], [0.258, 0.455], [0.21, 0.375], [0.165, 0.31]], 0.014)), mane, { crease: 0.7 });
  b.bone(V([0, 0.3, -0.225]), V([0, 0.105, -0.3]), new THREE.Vector3(0, 0, -1), (len) => {
    b.add(loft([{ y: -0.01, rx: 0.014, c: mane }, { y: len * 0.3, rx: 0.026, rz: 0.03 }, { y: len * 0.75, rx: 0.022, rz: 0.026 }, { y: len, rx: TIP }], { seg: hi ? 8 : 6, region: A.get('blank') }), null, { crease: 0.4 });
  });
  // Beine: vorn rechts angehoben / legs: front right raised
  const legs: [V3, V3, V3][] = [
    [[-0.04, 0.245, 0.15], [-0.04, 0.125, 0.166], [-0.04, 0.022, 0.158]],
    [[0.04, 0.245, 0.15], [0.046, 0.165, 0.235], [0.046, 0.095, 0.262]],
    [[-0.043, 0.255, -0.15], [-0.043, 0.122, -0.172], [-0.043, 0.022, -0.208]],
    [[0.043, 0.255, -0.14], [0.043, 0.127, -0.112], [0.043, 0.022, -0.09]],
  ];
  const ls = hi ? 10 : 6, leg = cell(A, 'horseLeg');
  for (const [hip, knee, hoof] of legs) {
    const front = new THREE.Vector3(0, 0, 1);
    b.bone(V(hip), V(knee), front, (len) => b.add(loft([{ y: -0.03, rx: TIP, c: coat }, { y: -0.012, rx: 0.026, rz: 0.03 }, { y: 0.03, rx: 0.029, rz: 0.034 }, { y: len, rx: 0.017, rz: 0.018 }, { y: len + 0.014, rx: TIP }], { seg: ls, region: leg, t1: 0.5 }), null, { crease: 0 }));
    b.bone(V(knee), V(hoof), front, (len) => {
      b.add(loft([{ y: -0.012, rx: TIP, c: dark }, { y: 0, rx: 0.016 }, { y: len * 0.5, rx: 0.0125 }, { y: len - 0.008, rx: 0.016, hard: true }, { y: len - 0.008, rx: 0.019, hard: true, c: mat.ink }, { y: len + 0.02, rx: 0.022, hard: true }], { seg: ls, region: leg, t0: 0.5, capLast: true }), null, { crease: 0.6 });
    });
  }
}

export function steppeRider(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const coat = mix(mat.wood, mat.orange, 0.18);
  b.group({ p: [0, 0, -0.03], s: 0.96 }, () => {
    horse(b, A, coat, mat.dark);
    // Satteldecke in Fraktionsfarbe folgt dem Ruecken, Sattel, Taschen, Bettrolle / saddle blanket in the faction colour follows the back, saddle, bags, bedroll
    const barrel = horseBarrel(coat);
    b.group({ p: [0, 0.262, 0], r: [-HALF_PI, 0, 0] }, () => {
      const rows = [
        { y: 0.078, g: -0.004, c: L.secondary }, { y: 0.075, g: 0.005, hard: true }, { y: 0.064, g: 0.005, hard: true, c: L.primary },
        { y: -0.05, g: 0.005, hard: true }, { y: -0.061, g: 0.005, hard: true, c: L.secondary }, { y: -0.064, g: -0.004 },
      ];
      b.add(frontLoft(shellRows(barrel, rows, { front: true }), { seg: hi ? 16 : 8, region: cell(A, 'cloth') }), null, { crease: 0.7 });
    });
    box(b, A, [0.084, 0.03, 0.105], 0.01, { py: 'pouch' }, mat.wood, { xf: { p: [0, 0.338, -0.005] } });
    if (hi) rod(b, A, [0, 0.345, 0.04], [0, 0.372, 0.052], 0.01, 0.008, 6, shade(mat.wood, 0.8));
    for (const s of [-1, 1]) box(b, A, [0.024, 0.06, 0.06], 0.008, { px: 'pouch', nx: 'pouch' }, L.gear, { xf: { p: [s * 0.066, 0.275, -0.1] } });
    b.add(loft([{ y: 0.062, rx: 0.018, hard: true }, { y: 0.056, rx: 0.021 }, { y: -0.056, rx: 0.021 }, { y: -0.062, rx: 0.018, hard: true }], { seg: hi ? 10 : 6, region: cell(A, 'bedroll'), capFirst: cell(A, 'rollEnd'), capLast: cell(A, 'rollEnd') }), shade(L.gear, 1.25), { xf: { p: [0, 0.345, -0.085], r: [0, 0, HALF_PI] } });
    // Reiter rittlings / rider astride
    const seat: V3 = [0, 0.352, -0.012];
    const HL: V3 = [-0.07, 0.19, 0.2], HR: V3 = [0.15, 0.24, 0.1];
    b.group({ p: seat, s: RIDER }, () => {
      figure(b, A, f, {
        pelvis: [0, 0.03, 0], twist: [0.12, 0.1, 0], head: [0.05, -0.1, 0], handL: HL, handR: HR,
        footL: [-0.118, -0.2, 0.07], footR: [0.118, -0.2, 0.07], kneePoleL: [-1, 0.2, 0.6], kneePoleR: [1, 0.2, 0.6],
      }, { detail: hi ? 1 : 0, pack: 'none', seed: 71 });
      // eingelegte Lanze mit Wimpel und Emblem / couched lance with pennant and emblem
      const a: V3 = [0.14, 0.13, -0.3], c: V3 = [0.185, 0.365, 0.6];
      rod(b, A, a, c, 0.0085, 0.0075, hi ? 6 : 5, mat.wood);
      rod(b, A, c, [c[0] + 0.004, c[1] + 0.018, c[2] + 0.07], 0.012, 0.001, 5, mat.metalLight, { gloss: 0.8, crease: 0.6 });
      b.group({ p: [0.178, 0.33, 0.47], r: [-0.24, 0, 0] }, () => {
        b.add(projectBox(geo.profileZY([[0, 0], [0, 0.085], [-0.17, 0.042]], 0.006), faces(A, { px: 'cloth', nx: 'cloth' })), L.primary, { crease: 0.7 });
        if (hi) emblemDecal(b, A, f, [0.0035, 0.042, -0.045], [1, 0, 0], 0.04, L.primary);
      });
      // Saebel an der Seite / sabre at the side
      if (hi) box(b, A, [0.007, 0.014, 0.17], 0.002, {}, mat.metalLight, { xf: { p: [-0.1, -0.02, -0.06], r: [0.4, 0, 0.1] }, gloss: 0.8 });
    });
    // Zuegel / reins
    const hand: V3 = [seat[0] + HL[0] * RIDER, seat[1] + HL[1] * RIDER, seat[2] + HL[2] * RIDER];
    for (const s of [-1, 1]) rod(b, A, hand, [s * 0.022, 0.4, 0.345], 0.003, 0.003, 4, mat.dark);
  });
  return b;
}

// ---------- Dravon: Sturmbrecher / stormbreaker ----------

export function stormbreaker(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const armour = mix(mat.gunmetal, L.primary, 0.25);
  const G: V3 = [0.105, 0.355, 0.1], HL: V3 = [-0.135, 0.36, 0.17];
  const pelvis: V3 = [0, 0.3, 0], twist: V3 = [0.06, -0.2, 0];
  b.group({ p: [0.02, 0, -0.05], s: FIG }, () => {
    figure(b, A, f, {
      ...standPose([HL, G]), pelvis, twist, head: [0, 0.15, 0],
      footL: [-0.075, ANKLE_Y, 0.07], footR: [0.07, ANKLE_Y, -0.06], bootL: [0, -0.3, 0], elbowPoleL: [-1, -0.2, 0.4],
    }, { pack: 'none', plain: true, seed: 81 });
    // Kuerass, Schulterplatten, Patronengurt, Hammer im Rahmen des Oberkoerpers / cuirass, pauldrons, bandolier, hammer in the torso frame
    const T = torsoRings(L);
    const cuirass = shellRows(T, [
      { y: 0.158, g: -0.004, c: L.secondary }, { y: 0.156, g: 0.011, hard: true }, { y: 0.147, g: 0.011, hard: true }, { y: 0.1465, g: 0.01, hard: true, c: armour },
      { y: 0.11, g: 0.013 }, { y: 0.07, g: 0.012 }, { y: 0.04, g: 0.011, hard: true }, { y: 0.04, g: -0.004, c: shade(armour, 0.5) },
    ]);
    b.group({ p: pelvis }, () => b.group({ r: twist }, () => {
      b.add(loft(cuirass, { seg: hi ? 20 : 10, region: cell(A, 'plate') }), null, { gloss: 0.35 });
      for (const s of [-1, 1]) {
        b.add(loft([
          { y: 0.038, rx: TIP, c: armour }, { y: 0.032, rx: 0.026 }, { y: 0.012, rx: 0.047 }, { y: -0.012, rx: 0.052, hard: true },
          { y: -0.0125, rx: 0.054, hard: true, c: L.secondary }, { y: -0.021, rx: 0.054, hard: true }, { y: -0.021, rx: 0.044, c: shade(armour, 0.5) },
        ], { seg: hi ? 12 : 8, region: A.get('blank') }), null, { xf: { p: [s * 0.098, 0.158, 0], r: [0, 0, s * -0.4] }, gloss: 0.35 });
      }
      // Patronengurt quer ueber den Kuerass / bandolier across the cuirass
      const n = hi ? 12 : 6;
      const path = [];
      for (let i = 0; i <= n; i++) { const u = i / n; path.push(loftAt(cuirass, 0.34 + u * 0.32, 0.146 - u * 0.1)); }
      b.add(ribbon(path, 0.012, cell(A, 'webbing'), 0.0025), L.secondary);
      sledge(b, A, [-0.1, 0.02, -0.085], [0.105, 0.3, -0.1], L.secondary);
    }));
    // Sturmschild mit Sehschlitz und Emblem am linken Arm / assault shield with a vision slit and the emblem on the left arm
    b.group({ p: [-0.135, 0.07, 0.215], r: [0.04, 0.35, 0] }, () => shield(b, A, { w: 0.21, h: 0.37, t: 0.024, c: armour, trim: L.secondary, emblem: f, emblemSize: 0.085 }));
    // schwere Trommelflinte / heavy drum-fed shotgun
    rifle(b, A, [G[0], G[1], G[2] - 0.03], [0.1, 0.1, 1], { scale: 1.12, drum: true, bayonet: false });
    // Truemmer / rubble
    if (hi) for (const [x, z, s] of [[0.2, -0.18, 0.045], [0.16, -0.26, 0.03], [-0.2, -0.2, 0.036]] as [number, number, number][]) bead(b, A, [x, s * 0.5, z], s, mat.concrete, 5, { crease: 0.8 }, [1, 0.6, 0.8]);
  });
  return b;
}

// ---------- Alvenia: Friedenswacht / peacekeepers ----------

/** Turmschild der Ordenswacht: weisse Platte, blaues Feld, Goldleisten, Emblem / the Order Guard's tower shield: white plate, blue field, gold bars, emblem */
function towerShield(b: UvBuilder, A: AtlasLayout, f: FactionId, d2: boolean): void {
  shield(b, A, { w: 0.2, h: 0.4, t: 0.024, c: FAITH.plate, trim: FAITH.gold });
  box(b, A, [0.15, 0.3, 0.008], 0.004, { pz: 'cloth' }, FAITH.cloth, { xf: { p: [0, 0.2, 0.0125] } });
  emblemDecal(b, A, f, [0, 0.215, 0.0168], [0, 0, 1], 0.1, FAITH.cloth);
  if (d2) bead(b, A, [0, 0.375, 0.014], 0.0085, FAITH.tech, 6, { gloss: 1 });
}
function orderGuard(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine();
  // vorderer Waechter mit Schild und Kurzgewehr / front warden with shield and carbine
  const HR: V3 = [0.13, 0.31, 0.06];
  b.group({ p: [0.1, 0, 0.03], s: FIG }, () => {
    figure(b, A, f, { ...standPose([[-0.1, 0.345, 0.13], HR]), twist: [0, -0.15, 0] }, { detail: 1, seed: 91 });
    b.group({ p: [-0.06, 0.02, 0.165] }, () => towerShield(b, A, f, true));
    holyRifle(b, A, HR, [0.15, 0.6, 0.6], 0.36, false);
  });
  // zweiter Waechter, Schild schraeg / second warden, shield at an angle
  b.group({ p: [-0.22, 0, -0.07], r: [0, 0.45, 0], s: FIG }, () => {
    figure(b, A, f, standPose([[-0.09, 0.345, 0.13], [0.09, 0.345, 0.13]]), { detail: 0, seed: 93 });
    b.group({ p: [0, 0.02, 0.165] }, () => towerShield(b, A, f, hi));
  });
  // Wegschrein mit Sonnenkranz und Weihrauchfass / wayside shrine with a sun halo and a censer
  b.group({ p: [0.27, 0, -0.27] }, () => {
    box(b, A, [0.085, 0.2, 0.07], 0.008, { all: 'plate' }, FAITH.plate, { xf: { p: [0, 0.1, 0] }, gloss: 0.25 });
    b.add(plain(geo.profileXY([[-0.058, 0], [0.058, 0], [0, 0.058]], 0.086)), FAITH.cloth, { xf: { p: [0, 0.2, 0] } });
    box(b, A, [0.04, 0.07, 0.006], 0.003, { pz: 'lens' }, FAITH.glassGold, { xf: { p: [0, 0.1, 0.037] }, gloss: 1 });
    b.legacy((k) => haloRing(k, [0, 0.3, 0], 0.036, 0.004, 12));
    if (hi) censer(b, A, [0.062, 0.17, 0.03], 0.05);
  });
  return b;
}

export function peacekeeper(f: FactionId, A: AtlasLayout): UvBuilder {
  if (f === 'alvenia') return orderGuard(f, A);
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  // Schilderhaus mit Fenstern, Band und Dach in Fraktionsfarbe / sentry box with windows, band and roof in the faction colour
  b.group({ p: [-0.24, 0, -0.23] }, () => {
    box(b, A, [0.17, 0.33, 0.16], 0.006, { all: 'wood' }, mat.white, { xf: { p: [0, 0.165, 0] } });
    box(b, A, [0.176, 0.024, 0.166], 0.004, {}, L.primary, { xf: { p: [0, 0.1, 0] } });
    box(b, A, [0.21, 0.028, 0.2], 0.012, { py: 'plate' }, L.primary, { xf: { p: [0, 0.345, 0] } });
    box(b, A, [0.1, 0.08, 0.006], 0.003, { pz: 'lens' }, mat.window, { xf: { p: [0, 0.225, 0.081] }, gloss: 1 });
    box(b, A, [0.006, 0.08, 0.09], 0.003, { px: 'lens' }, mat.window, { xf: { p: [0.086, 0.225, 0] }, gloss: 1 });
    if (hi) emblemDecal(b, A, f, [0, 0.3, 0.0835], [0, 0, 1], 0.036, mat.white);
  });
  // Schlagbaum: Pfosten, gestreifter Baum leicht geoeffnet / boom barrier: post, striped boom slightly raised
  b.group({ p: [0.28, 0, -0.28] }, () => {
    box(b, A, [0.05, 0.17, 0.05], 0.006, {}, mat.concreteLight, { xf: { p: [0, 0.085, 0] } });
    box(b, A, [0.056, 0.016, 0.056], 0.004, {}, L.primary, { xf: { p: [0, 0.172, 0] } });
    b.group({ p: [0, 0.145, 0], r: [-0.22, 0, 0] }, () => {
      const n = hi ? 8 : 4, len = 0.54;
      const rings: Ring[] = [];
      for (let i = 0; i < n; i++) rings.push({ y: -(0.02 + (i / n) * len), rx: 0.014, e: 3.4, hard: true, c: i % 2 ? L.primary : mat.white }, { y: -(0.02 + ((i + 1) / n) * len), rx: 0.014, e: 3.4, hard: true });
      rings.push({ y: -(0.02 + len), rx: 0.019, e: 3.4, hard: true, c: mat.red }, { y: -(0.05 + len), rx: 0.019, e: 3.4, hard: true });
      b.add(loft(rings, { seg: 8, region: A.get('blank'), capFirst: true, capLast: true }), null, { xf: { r: [-HALF_PI, 0, 0] }, crease: 0.7 });
    });
  });
  // Wachposten mit erhobener Hand, Gewehr geschultert / sentry raising a hand, rifle shouldered
  const G: V3 = [0.115, 0.33, 0.07];
  b.group({ p: [-0.02, 0, 0.08], s: FIG }, () => {
    figure(b, A, f, { ...standPose([[-0.165, 0.585, 0.08], G]), twist: [0, 0.2, 0], head: [0.05, -0.1, 0], elbowPoleL: [-1, 0.2, -0.2] }, { pack: 'pack', armband: true, seed: 91 });
    rifle(b, A, G, [0, 0.85, 0.5], { scale: 0.95, bayonet: false });
  });
  // Sandsack, Signalkelle, Verbandskasten / sandbag, signal paddle, first-aid box
  sandbag(b, A, -0.3, 0, 0.17, 0.4);
  if (hi) {
    rod(b, A, [-0.3, 0.046, 0.17], [-0.3, 0.13, 0.17], 0.0045, 0.0045, 4, mat.dark);
    rod(b, A, [-0.3, 0.155, 0.166], [-0.3, 0.155, 0.174], 0.03, 0.03, 12, L.primary, { crease: 0.7 });
    caseBox(b, A, [0.075, 0.055, 0.05], mat.white, { p: [-0.07, 0.0275, -0.17] });
    box(b, A, [0.078, 0.014, 0.053], 0.003, {}, L.primary, { xf: { p: [-0.07, 0.036, -0.17] } });
  }
  return b;
}

// ---------- Velkar: Prototyp-Laeufer / prototype walker ----------

export function protoWalker(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine(), seg = hi ? 10 : 6;
  const metal = mat.gunmetal, glow = L.secondary;
  b.group({ s: 1.025 }, () => {
    // Vogelbeine mit Kniepanzer und Krallenfuessen / bird legs with knee armour and clawed feet
    b.mirrorX(() => {
      const hip: V3 = [0.088, 0.27, -0.02], knee: V3 = [0.103, 0.168, -0.1], ankle: V3 = [0.097, 0.05, 0.0];
      const leg = cell(A, 'walkerLeg'), front = new THREE.Vector3(0, 0, 1);
      b.bone(V(hip), V(knee), front, (len) => b.add(loft([{ y: -0.02, rx: 0.026, rz: 0.03, e: 3.4, c: L.hull, hard: true }, { y: -0.012, rx: 0.033, rz: 0.037, e: 3.4, hard: true }, { y: len + 0.012, rx: 0.03, rz: 0.034, e: 3.4, hard: true }, { y: len + 0.02, rx: 0.024, rz: 0.028, e: 3.4 }], { seg: hi ? 12 : 8, region: leg, t1: 0.5, capFirst: true, capLast: true }), null, { gloss: 0.25 }));
      b.bone(V(knee), V(ankle), front, (len) => b.add(loft([{ y: -0.008, rx: 0.02, rz: 0.022, e: 3.4, c: L.hullDark, hard: true }, { y: 0, rx: 0.024, rz: 0.027, e: 3.4, hard: true }, { y: len, rx: 0.021, rz: 0.024, e: 3.4, hard: true }], { seg: hi ? 12 : 8, region: leg, t0: 0.5, capFirst: true, capLast: true }), null, { gloss: 0.25 }));
      b.add(frontLoft([{ y: 0.04, rx: 0.02, rz: 0.03, rzB: 0.01, c: L.primary }, { y: 0.02, rx: 0.036, rz: 0.04, rzB: 0.01, e: 2.8 }, { y: -0.03, rx: 0.03, rz: 0.036, rzB: 0.01, e: 2.8 }, { y: -0.044, rx: 0.016, rz: 0.024, rzB: 0.01 }], { seg: 8, region: cell(A, 'plate') }), null, { xf: { p: [knee[0], knee[1], knee[2] - 0.014], r: [0.5, Math.PI, 0] }, gloss: 0.3 });
      for (const j of [hip, knee, ankle]) bead(b, A, j, 0.027, metal, hi ? 8 : 6, { gloss: 0.5 });
      if (hi) {
        rod(b, A, [0.124, 0.25, -0.03], [0.124, 0.13, -0.06], 0.008, 0.008, 6, mat.metalLight, { gloss: 0.7 });
        rod(b, A, [0.124, 0.19, -0.045], [0.124, 0.13, -0.06], 0.012, 0.012, 6, mat.yellow, { crease: 0.6 });
      }
      for (const a of [-0.45, 0, 0.45]) {
        b.add(softBox(0.026, 0.022, 0.075, 0.006), metal, { xf: { p: [0.097 + Math.sin(a) * 0.036, 0.012, 0.03 + Math.cos(a) * 0.032], r: [0, a, 0] }, gloss: 0.4 });
        // helle Kralle an jeder Zehe / a light claw on every toe
        if (hi) rod(b, A, [0.097 + Math.sin(a) * 0.07, 0.012, 0.03 + Math.cos(a) * 0.066], [0.097 + Math.sin(a) * 0.086, 0.004, 0.03 + Math.cos(a) * 0.082], 0.007, 0.001, 5, mat.metalLight, { gloss: 0.8 });
      }
      b.add(softBox(0.022, 0.02, 0.05, 0.005), metal, { xf: { p: [0.097, 0.012, -0.05] }, gloss: 0.4 });
    });
    // Becken und Kanzel / pelvis and cockpit
    box(b, A, [0.15, 0.052, 0.09], 0.014, {}, metal, { xf: { p: [0, 0.27, -0.02] }, gloss: 0.4 });
    const e = 4;
    const hull: Ring[] = [
      { y: 0.432, rx: 0.07, rz: 0.058, rzB: 0.066, e, c: L.hull }, { y: 0.424, rx: 0.088, rz: 0.076, rzB: 0.082, e, hard: true }, { y: 0.365, rx: 0.111, rz: 0.104, rzB: 0.1, e },
      { y: 0.302, rx: 0.108, rz: 0.094, rzB: 0.094, e, hard: true }, { y: 0.294, rx: 0.084, rz: 0.07, rzB: 0.072, e },
    ];
    b.add(loft(hull, { seg: hi ? 24 : 12, region: cell(A, 'walkerHull'), capFirst: true, capLast: true }), null, { gloss: 0.25 });
    box(b, A, [0.13, 0.009, 0.008], 0.002, {}, glow, { xf: { p: [0, 0.342, 0.1045] }, gloss: 1, crease: 0 });
    emblemDecal(b, A, f, [-0.1115, 0.365, 0.0], [-1, 0, 0], 0.05, L.hull);
    // Moerser auf dem Dach / mortar on the roof
    b.group({ p: [0, 0.43, -0.02] }, () => {
      rod(b, A, [0, 0, 0], [0, 0.03, 0], 0.055, 0.05, seg, metal, { gloss: 0.4, crease: 0.7 });
      box(b, A, [0.092, 0.052, 0.1], 0.012, { all: 'plate' }, L.hullDark, { xf: { p: [0, 0.052, 0] } });
      rod(b, A, [0, 0.062, 0.03], [0, 0.132, 0.22], 0.03, 0.027, seg, metal, { cell: 'tube', gloss: 0.5, crease: 0.7 });
      rod(b, A, [0, 0.127, 0.207], [0, 0.138, 0.236], 0.035, 0.035, seg, mat.ink, { crease: 0.7 });
      if (hi) for (const t of [0.3, 0.55]) rod(b, A, [0, 0.062 + 0.07 * t - 0.003, 0.03 + 0.19 * t - 0.008], [0, 0.062 + 0.07 * t + 0.003, 0.03 + 0.19 * t + 0.008], 0.033, 0.033, seg, glow, { gloss: 1, crease: 0.6 });
    });
    // Teslaspule auf dem Ruecken mit Leuchtkugel und Funken / tesla coil on the back with a glowing ball and sparks
    b.group({ p: [0, 0.36, -0.115] }, () => {
      const rings: Ring[] = [{ y: 0, rx: 0.037, c: metal, hard: true }];
      const n = hi ? 4 : 2;
      for (let i = 0; i < n; i++) { const y = 0.02 + i * (0.075 / n); rings.push({ y, rx: 0.031, hard: true }, { y, rx: 0.039, hard: true, c: mat.metalLight }, { y: y + 0.01, rx: 0.039, hard: true }, { y: y + 0.01, rx: 0.031, hard: true, c: metal }); }
      rings.push({ y: 0.1, rx: 0.03, hard: true });
      b.add(loft(rings, { seg, region: A.get('blank'), capLast: true }), null, { gloss: 0.5 });
      rod(b, A, [0, 0.1, 0], [0, 0.18, 0], 0.006, 0.006, 4, mat.metalLight);
      bead(b, A, [0, 0.207, 0], 0.03, glow, hi ? 10 : 6, { gloss: 1 });
      if (hi) for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const p1: V3 = [Math.sin(a) * 0.066, 0.2 + (i % 2) * 0.03, Math.cos(a) * 0.066];
        rod(b, A, [Math.sin(a) * 0.028, 0.207, Math.cos(a) * 0.028], p1, 0.003, 0.003, 3, mat.yellow);
        rod(b, A, p1, [Math.sin(a + 0.4) * 0.095, 0.17 + (i % 3) * 0.012, Math.cos(a + 0.4) * 0.095], 0.003, 0.002, 3, mat.yellow);
      }
    });
    // Kabel, Kuehlrippen, Schneerest / cables, cooling fins, a rest of snow
    if (hi) b.mirrorX(() => {
      rod(b, A, [0.03, 0.43, -0.09], [0.1, 0.3, -0.06], 0.006, 0.006, 5, mat.red);
      for (let i = 0; i < 3; i++) b.add(softBox(0.004, 0.06, 0.05, 0.001), mat.metalLight, { xf: { p: [0.115 + i * 0.009, 0.345, -0.062] }, crease: 0.6 });
    });
  });
  return b;
}
