/**
 * Gezeichnete Einheiten: Kampfhubschrauber aller Fraktionen / inked units: the combat helicopter of every faction.
 *
 * Erkennungsmerkmale bleiben: schwebender Rumpf auf Kufen, grosser Rotor mit farbigen Blattspitzen, Kanzel, Heckausleger
 * mit Leitwerk und Heckrotor, Stummelfluegel mit Raketenbehaeltern, Bugkanone. Rumpf, Kanzel und Ausleger sind je EIN
 * weicher Koerper; Tueren, Fugen, Ansauggitter, Russ und die Kanzelstreben sind gezeichnet. Je Fraktion eigene Form:
 * Korvat kantig, Dravon gepanzerte Kanzel und grosse Bugkanone, Alvenia runde Glaskanzel, Meridon schlank mit drei
 * Blaettern, Hightech breit mit dunklem Glas und Leuchten. Die Besatzung sitzt hinter Glas und ist nicht zu sehen.
 * The marks of identity stay: hovering fuselage on skids, large rotor with coloured blade tips, canopy, tail boom with
 * fin and tail rotor, stub wings with rocket pods, chin gun. Fuselage, canopy and boom are ONE soft body each; doors,
 * joints, intake grille, soot and the canopy struts are drawn. One shape per faction: Korvat boxy, Dravon armoured
 * canopy and a large chin gun, Alvenia round glass canopy, Meridon slim with three blades, hi-tech wide with dark glass
 * and lights. The crew sit behind glass and cannot be seen.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { fine, type ColorLike, type V3 } from '../kit';
import { look, mat, styleOf, type HumanStyle } from '../look';
import { arc, rrect, spline, type Cell, type Pen } from './atlas';
import { block, boxed, hullZ, machineGun, TIP, tube } from './body';
import { BARE, digitDecal, emblemDecal, SOOT, streaks } from './trim';
import { AtlasLayout, loft, UvBuilder, type BoxFaces } from './uvkit';

const HALF_PI = Math.PI / 2;

/** Grenzen der Rumpfprojektion (Flanke) / bounds of the fuselage projection (flank) */
const FUS = { z0: -0.14, z1: 0.215, y0: 0.14, y1: 0.262 };

/** Rumpfflanke (288 x 96): Bug links, Oberkante oben / fuselage flank: bow at the left, top edge up */
function paintHeliSide(p: Pen): void {
  const W = p.w, H = p.h;
  const X = (z: number) => ((FUS.z1 - z) / (FUS.z1 - FUS.z0)) * W, Y = (y: number) => ((FUS.y1 - y) / (FUS.y1 - FUS.y0)) * H;
  // Schiebetuer mit Laufschiene und Griff / sliding door with rail and handle
  const d0 = X(0.07), d1 = X(-0.03);
  const door = rrect(d0, Y(0.238), d1 - d0, Y(0.156) - Y(0.238), 7);
  p.shade(door, 0.92, 0.85);
  p.panel(door.concat([[d1 - 7, Y(0.238)]]), 1.7);
  p.line([[d0 - 6, Y(0.244)], [d1 + 30, Y(0.244)]], 1.4, { taper: 0.05, wobble: 0.2 });
  p.line(spline([[d1 - 20, Y(0.2)], [d1 - 14, Y(0.2) - 3], [d1 - 8, Y(0.2)]], 4), 2.2, { taper: 0.15 });
  // Ansauggitter am Triebwerk, Wartungsklappe, Trittstufe / intake grille at the engine, service flap, step
  const gx = X(-0.06), gy = Y(0.246);
  p.fill(rrect(gx, gy, 46, 22, 3), SOOT, 0.92);
  for (let y = gy + 4; y < gy + 20; y += 5.5) p.crease([[gx + 3, y], [gx + 43, y]], 1.6, 1.9, 0.9, { taper: 0, wobble: 0 });
  p.panel(rrect(gx - 3, gy - 3, 52, 28, 4).concat([[gx + 45, gy - 3]]), 1.5);
  p.panel(rrect(X(0.16), Y(0.21), 34, 26, 5).concat([[X(0.16) + 29, Y(0.21)]]), 1.4);
  p.fill(rrect(X(0.02) - 14, Y(0.15), 28, 6, 2), BARE);
  p.line(rrect(X(0.02) - 14, Y(0.15), 28, 6, 2), 1.2, { closed: true, wobble: 0.1 });
  // Nietenreihe am Rumpfboden, Fugen / rivet row at the belly, joints
  p.rivets([X(0.19), Y(0.15)], [X(-0.12), Y(0.15)], 12, 2.1);
  p.panel([[X(-0.045), Y(0.256)], [X(-0.045), Y(0.146)]], 1.4);
  // Russfahne hinter dem Auspuff / soot plume behind the exhaust
  p.gradient(X(-0.07), 0, W - X(-0.07), H * 0.5, [X(-0.07), 0], [W, 0], 1, 0.62, 0.8);
  p.splatter(X(-0.08), 0, W - X(-0.08), H * 0.5, 14, SOOT, 951, { size: 5, alpha: 0.5, rise: 0.7 });
  streaks(p, 0, 6, W, H * 0.5, 6, 953);
  p.scratches(8, 10, W - 16, H - 24, 8, 957, 20);
  p.chips(0, 0, W, 8, 10, BARE, 961, 2.6);
  p.chips(0, H - 9, W, 8, 12, BARE, 967, 2.6);
}

/** Kanzel (128 x 96): Glas mit Streben und Glanzlichtern; dieselbe Zeichnung von jeder Seite / canopy: glass with struts and highlights; the same drawing from every side */
function paintCanopy(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(3, 3, W - 6, H - 6, 12), 2.4, { closed: true, wobble: 0.2 });
  p.line(spline([[W * 0.5, 4], [W * 0.52, H * 0.5], [W * 0.5, H - 4]], 5), 2.2, { taper: 0.04, wobble: 0.2 });
  p.line([[5, H * 0.56], [W - 5, H * 0.56]], 1.8, { taper: 0.04, wobble: 0.2 });
  p.fill([[12, H * 0.48], [W * 0.3, 10], [W * 0.4, 10], [24, H * 0.48]], mat.white, 0.42);
  p.fill([[W * 0.58, H * 0.48], [W * 0.78, 12], [W * 0.84, 12], [W * 0.66, H * 0.48]], mat.white, 0.3);
  p.gradient(0, H * 0.6, W, H * 0.4, [0, H * 0.6], [0, H], 1, 0.74, 0.9);
  p.line(arc(W * 0.26, H * 0.78, 5, 5, 0, Math.PI * 2, 10), 1.3, { closed: true, wobble: 0.1 });
}

/** Zellen des Hubschraubers / cells of the helicopter */
export function heliCells(): Cell[] {
  return [
    { name: 'heliSide', w: 288, h: 96, paint: paintHeliSide },
    { name: 'canopy', w: 128, h: 96, paint: paintCanopy },
  ];
}

interface HeliStyle {
  /** halbe Rumpfbreite, Kantigkeit / half fuselage width, boxiness */
  hw: number; e: number;
  /** Kanzel: Laenge, Hoehe ueber dem Rumpf, Kantigkeit, Farbe / canopy: length, height above the fuselage, boxiness, colour */
  canLen: number; canUp: number; canE: number;
  blades: number;
  gun: number;
}
const STYLE: Record<HumanStyle, HeliStyle> = {
  korvat: { hw: 0.066, e: 4, canLen: 0.13, canUp: 0.05, canE: 3.4, blades: 4, gun: 1 },
  dravon: { hw: 0.07, e: 6, canLen: 0.12, canUp: 0.044, canE: 5, blades: 4, gun: 1.45 },
  alvenia: { hw: 0.07, e: 2.6, canLen: 0.15, canUp: 0.06, canE: 2.2, blades: 4, gun: 1 },
  meridon: { hw: 0.054, e: 3.2, canLen: 0.14, canUp: 0.052, canE: 2.8, blades: 3, gun: 1 },
  velkar: { hw: 0.075, e: 3.6, canLen: 0.13, canUp: 0.046, canE: 3.6, blades: 4, gun: 1 },
};

/** Kampfhubschrauber; A = Atlas der Radfahrzeuge, Geschuetze und Fluggeraete / combat helicopter; A = atlas of wheeled vehicles, guns and aircraft */
export function gunship(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), st = styleOf(f), S = STYLE[st], hi = fine();
  const seg = hi ? 22 : 10;
  const cy = 0.2, { hw } = S;
  const box = new THREE.Box3(new THREE.Vector3(-0.09, FUS.y0, FUS.z0), new THREE.Vector3(0.09, FUS.y1, FUS.z1));
  const side: BoxFaces = { px: A.get('heliSide'), nx: A.get('heliSide'), mirrorNx: true, all: A.get('blank'), bounds: box };
  const tech = st === 'velkar';
  const glassC: ColorLike = tech ? mat.glassDark : st === 'dravon' ? mat.glassDark : mat.glass;

  // in Baumassen gebaut und als Ganzes vergroessert: der Rotor reicht fast bis zum Kachelrand
  // built at build dimensions and enlarged as a whole: the rotor reaches almost to the tile edge
  b.group({ s: 1.08, p: [0, -0.006, 0.055] }, () => {
    // ---- Rumpf: Nase -> Triebwerk -> Heckansatz / fuselage: nose -> engine -> tail root ----
    b.add(hullZ([
      { z: 0.212, w: hw * 0.42, up: 0.022, down: 0.026, cy: cy - 0.014, e: S.e, hard: true },
      { z: 0.19, w: hw * 0.74, up: 0.034, down: 0.044, cy: cy - 0.008, e: S.e },
      { z: 0.11, w: hw, up: 0.046, down: 0.056, cy, e: S.e },
      { z: -0.03, w: hw, up: 0.058, down: 0.056, cy, e: S.e },
      { z: -0.1, w: hw * 0.78, up: 0.05, down: 0.04, cy: cy + 0.006, e: S.e },
      { z: -0.136, w: hw * 0.4, up: 0.03, down: 0.022, cy: cy + 0.018, e: S.e, hard: true },
    ], { ...side, seg, capFirst: true, capLast: true }), L.hull);
    // ---- Kanzel: ein Glaskoerper mit gezeichneten Streben / canopy: one glass body with drawn struts ----
    const can = A.get('canopy'), cz = 0.2 - S.canLen / 2 - 0.02;
    b.add(hullZ([
      { z: cz + S.canLen / 2, w: hw * 0.5, up: 0.006, down: 0.012, cy: cy + 0.03, e: S.canE, hard: true },
      { z: cz + S.canLen * 0.3, w: hw * 0.8, up: S.canUp * 0.74, down: 0.02, cy: cy + 0.04, e: S.canE },
      { z: cz - S.canLen * 0.2, w: hw * 0.84, up: S.canUp, down: 0.02, cy: cy + 0.044, e: S.canE },
      { z: cz - S.canLen / 2, w: hw * 0.8, up: S.canUp * 0.9, down: 0.016, cy: cy + 0.046, e: S.canE, hard: true },
    ], { px: can, nx: can, py: can, pz: can, nz: A.get('blank'), ny: A.get('blank'), seg, capFirst: true, capLast: true }), glassC, { gloss: tech ? 0.4 : 0.9, crease: 0.4 });
    if (st === 'dravon') {
      // Panzerblenden ueber der Kanzel / armour visors over the canopy
      b.add(block(hw * 1.75, 0.012, S.canLen * 0.5, 0.004), L.hull, { xf: { p: [0, cy + 0.046 + S.canUp, cz - S.canLen * 0.2] } });
      for (const s of [-1, 1]) b.add(block(0.008, 0.01, S.canLen * 0.9, 0.003), L.trim, { xf: { p: [s * hw * 0.86, cy + 0.03, cz], r: [0, 0, 0] }, gloss: 0.5 });
    }
    if (tech) for (const s of [-1, 1]) b.add(boxed(block(0.004, 0.008, 0.2, 0.001), { p: [s * (hw + 0.001), cy + 0.012, 0.02] }, { px: A.get('glowStrip'), nx: A.get('glowStrip'), all: A.get('blank') }), L.secondary, { crease: 0 });
    // ---- Triebwerk mit Auspuffen, Rotormast, Nabe / engine with exhausts, rotor mast, hub ----
    const top = cy + 0.058;
    b.add(hullZ([
      { z: 0.03, w: hw * 0.6, up: 0.012, down: 0.016, cy: top + 0.012, e: 3, hard: true },
      { z: 0.0, w: hw * 0.72, up: 0.024, down: 0.02, cy: top + 0.014, e: 3 },
      { z: -0.09, w: hw * 0.66, up: 0.022, down: 0.02, cy: top + 0.012, e: 3 },
      { z: -0.12, w: hw * 0.4, up: 0.012, down: 0.012, cy: top + 0.01, e: 3, hard: true },
    ], { px: A.get('grille'), nx: A.get('grille'), all: A.get('blank'), seg: hi ? 14 : 8, capFirst: true, capLast: true }), L.hullDark);
    for (const s of [-1, 1]) b.add(loft([{ y: 0.04, rx: 0.011, hard: true }, { y: 0.04, rx: 0.014, hard: true }, { y: 0, rx: 0.016 }], { seg: hi ? 10 : 6, region: A.get('exhaust'), capFirst: A.get('blank'), color: mat.darkMid }), null, { xf: { p: [s * hw * 0.52, top + 0.014, -0.1], r: [-HALF_PI + 0.5, 0, 0] } });
    const ry = top + 0.076;
    b.add(loft([{ y: ry - top - 0.026, rx: 0.011, hard: true }, { y: 0, rx: 0.017 }], { seg: hi ? 10 : 6, region: A.get('blank'), color: mat.dark }), null, { xf: { p: [0, top + 0.03, -0.03] } });
    b.add(loft([{ y: 0.014, rx: TIP }, { y: 0.01, rx: 0.02 }, { y: -0.004, rx: 0.026, hard: true }, { y: -0.012, rx: 0.014 }], { seg: hi ? 12 : 7, region: A.get('blank'), color: mat.darkMid }), null, { xf: { p: [0, ry, -0.03] }, gloss: 0.5 });
    // ---- Rotorblaetter mit farbigen Spitzen / rotor blades with coloured tips ----
    const span = 0.298;
    for (let i = 0; i < S.blades; i++) {
      const a = (i / S.blades) * Math.PI * 2 + (S.blades === 3 ? 0.5 : Math.PI / 4);
      b.group({ p: [0, ry, -0.03], r: [0, a, 0] }, () => {
        b.add(block(0.034, 0.005, span - 0.05, 0.002), mat.dark, { xf: { p: [0, 0, 0.02 + (span - 0.05) / 2], r: [0, 0, 0.1] }, crease: 0 });
        b.add(block(0.036, 0.006, 0.034, 0.002), L.trim, { xf: { p: [0, 0, span - 0.014], r: [0, 0, 0.1] }, crease: 0 });
        if (hi) b.add(block(0.036, 0.006, 0.01, 0.002), L.trim, { xf: { p: [0, 0, span - 0.05], r: [0, 0, 0.1] }, crease: 0 });
      });
    }
    // ---- Heckausleger, Leitwerk, Heckrotor / tail boom, fin, tail rotor ----
    b.add(hullZ([
      { z: -0.12, w: 0.03, up: 0.03, down: 0.024, cy: cy + 0.02, e: 3, hard: true },
      { z: -0.26, w: 0.02, up: 0.02, down: 0.018, cy: cy + 0.04, e: 3 },
      { z: -0.395, w: 0.012, up: 0.014, down: 0.012, cy: cy + 0.06, e: 3, hard: true },
    ], { all: A.get('blank'), seg: hi ? 12 : 7, capLast: true }), L.hull);
    const tz = -0.385, tyy = cy + 0.064;
    b.add(block(0.01, 0.1, 0.05, 0.004), L.trim, { xf: { p: [0, tyy + 0.036, tz - 0.016], r: [0.42, 0, 0] } });
    b.add(block(0.12, 0.008, 0.036, 0.003), L.hull, { xf: { p: [0, tyy - 0.004, tz + 0.03] } });
    for (const s of [-1, 1]) b.add(block(0.008, 0.034, 0.03, 0.003), L.trim, { xf: { p: [s * 0.06, tyy + 0.006, tz + 0.03] } });
    const tr: V3 = [0.014, tyy + 0.05, tz - 0.03];
    b.add(loft([{ y: 0.012, rx: 0.008 }, { y: 0, rx: 0.01 }], { seg: 6, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: tr, r: [0, 0, -HALF_PI] } });
    for (const a of [0.5, 0.5 + HALF_PI]) b.add(block(0.004, 0.112, 0.014, 0.002), mat.dark, { xf: { p: [tr[0] + 0.012, tr[1], tr[2]], r: [a, 0, 0] }, crease: 0 });
    if (hi) tube(b, A, [0, cy + 0.04, tz + 0.02], [0, cy + 0.012, tz - 0.02], 0.004, 0.003, mat.dark, 5);
    // ---- Stummelfluegel mit Raketenbehaeltern und Lenkflugkoerpern / stub wings with rocket pods and missiles ----
    const wy = cy - 0.012;
    b.mirrorX(() => {
      b.add(block(0.1, 0.01, 0.06, 0.004), L.hull, { xf: { p: [hw + 0.04, wy, 0.0], r: [0, 0, -0.08] } });
      const px = hw + 0.076, py = wy - 0.022;
      b.add(loft([{ y: 0.062, rx: 0.02, hard: true }, { y: 0.062, rx: 0.025, hard: true }, { y: -0.04, rx: 0.025 }, { y: -0.066, rx: 0.012 }], { seg: hi ? 12 : 7, region: A.get('blank'), capFirst: A.get('drumEnd'), color: L.hullDark }), null, { xf: { p: [px, py, 0], r: [HALF_PI, 0, 0] } });
      if (hi) b.add(loft([{ y: 0.006, rx: 0.0262, hard: true }, { y: 0, rx: 0.0262, hard: true }], { seg: 12, region: A.get('blank'), color: L.trim }), null, { xf: { p: [px, py, 0.02], r: [HALF_PI, 0, 0] }, crease: 0 });
      b.add(loft([{ y: 0.07, rx: TIP, c: mat.red }, { y: 0.056, rx: 0.008 }, { y: 0.05, rx: 0.0095, hard: true }, { y: 0.05, rx: 0.0095, hard: true, c: mat.white }, { y: -0.04, rx: 0.0095, hard: true }], { seg: hi ? 8 : 5, region: A.get('blank'), capLast: true }), null, { xf: { p: [hw + 0.03, wy - 0.018, 0.004], r: [HALF_PI, 0, 0] }, crease: 0.5 });
    });
    // ---- Bugkanone, Kufen / chin gun, skids ----
    machineGun(b, A, [0, cy - 0.062, 0.14], { k: 1.15 * S.gun, len: 0.09, pitch: 0.06 });
    b.add(loft([{ y: 0.018, rx: 0.014 }, { y: 0, rx: 0.02 }], { seg: hi ? 8 : 5, region: A.get('blank'), color: L.hullDark }), null, { xf: { p: [0, cy - 0.066, 0.132], r: [Math.PI, 0, 0] } });
    const sk = 0.082;
    b.mirrorX(() => {
      tube(b, A, [hw + 0.03, sk, -0.1], [hw + 0.03, sk, 0.13], 0.0085, 0.0085, mat.dark, hi ? 8 : 5);
      tube(b, A, [hw + 0.03, sk, 0.13], [hw + 0.03, sk + 0.018, 0.16], 0.0085, 0.007, mat.dark, hi ? 8 : 5);
      for (const z of [0.09, -0.06]) tube(b, A, [hw * 0.7, cy - 0.046, z], [hw + 0.03, sk + 0.004, z], 0.006, 0.006, mat.dark, 5);
    });
    // ---- Embleme und Kennziffern / emblems and digits ----
    for (const s of [-1, 1]) {
      emblemDecal(b, A, f, [s * 0.0245, cy + 0.031, -0.2], [s, 0, 0], 0.036, L.hull);
      if (hi) [4, 2].forEach((n, i) => digitDecal(b, A, n, [s * 0.0185, cy + 0.043, -0.28 - s * (i * 0.018 - 0.009)], [s, 0, 0], 0.024, L.hull));
    }
  });
  return b;
}
