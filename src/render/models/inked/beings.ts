/**
 * Gezeichnete Einheiten: Fusstruppen der Fremden und der Maschinen (Grauer der Zyrr, Androide und Cyborg der NEXUS).
 * Inked units: foot troops of the aliens and the machines (Zyrr grey, NEXUS android and cyborg).
 *
 * Keine Menschenfigur: der Graue ist duenn mit grossem Kopf und Lasergewehr, die Roboter sind kantige Platten auf
 * Gelenkkugeln mit einer Armkanone statt der rechten Hand. Der Cyborg traegt Schulterpanzer in Fraktionsfarbe und zwei
 * hohe Kuehlschlote, die ueber den Kopf ragen (Kennform gegen den schlanken Androiden).
 * No human figure: the grey is thin with a big head and a laser rifle, the robots are angular plates on joint balls
 * with an arm cannon instead of the right hand. The cyborg carries pauldrons in the faction colour and two tall
 * cooling stacks rising above the head (signature against the slim android).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { fine, shade, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat } from '../look';
import { headSegments } from './figure';
import { aimZ, along, bead, box, cell, frontLoft, rod, TIP } from './figkit';
import { greyHead, robotHead } from './heads';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, UvBuilder, type Ring } from './uvkit';

const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
const FRONT = new THREE.Vector3(0, 0, 1);

// ---------- Grauer / grey ----------

/** duennes Glied von a ueber m nach c / thin limb from a over m to c */
function thinLimb(b: UvBuilder, A: AtlasLayout, pts: [V3, V3, V3], r0: number, r1: number, seg: number, c: ColorLike, joint: ColorLike): void {
  const rm = (r0 + r1) / 2;
  b.bone(V(pts[0]), V(pts[1]), FRONT, (len) => b.add(loft([{ y: -r0, rx: TIP, c }, { y: 0, rx: r0 }, { y: len, rx: rm }, { y: len + rm, rx: TIP }], { seg, region: A.get('blank') }), null, { crease: 0 }));
  b.bone(V(pts[1]), V(pts[2]), FRONT, (len) => b.add(loft([{ y: -rm, rx: TIP, c }, { y: 0, rx: rm }, { y: len, rx: r1 }, { y: len + r1, rx: TIP }], { seg, region: A.get('blank') }), null, { crease: 0 }));
  bead(b, A, pts[1], rm * 1.25, joint, 6);
}

/** Lasergewehr entlang dir, Griff bei grip / laser rifle along dir, grip at grip */
function laserRifle(b: UvBuilder, A: AtlasLayout, L: ReturnType<typeof look>, grip: V3, dir: V3): void {
  const hi = fine();
  b.group({ p: grip, r: aimZ(dir), s: 1.05 }, () => {
    box(b, A, [0.024, 0.032, 0.07], 0.007, {}, mat.alienMetal, { xf: { p: [0, 0.004, -0.04] } });
    box(b, A, [0.031, 0.037, 0.13], 0.01, { px: 'case', nx: 'case' }, L.primaryDark, { xf: { p: [0, 0.004, 0.06] }, gloss: 0.3 });
    box(b, A, [0.015, 0.04, 0.016], 0.004, {}, mat.alienMetal, { xf: { p: [0, -0.024, 0.01], r: [-0.3, 0, 0] } });
    rod(b, A, [0, 0.006, 0.115], [0, 0.006, 0.225], 0.012, 0.009, hi ? 10 : 6, mat.alienMetalLight, { gloss: 0.7 });
    for (let i = 0; i < 3; i++) rod(b, A, [0, 0.006, 0.137 + i * 0.03], [0, 0.006, 0.145 + i * 0.03], 0.0165, 0.0165, hi ? 8 : 6, mat.acid, { gloss: 1, crease: 0.6 });
    bead(b, A, [0, 0.006, 0.234], 0.014, mat.acid, 6, { gloss: 1 });
    box(b, A, [0.004, 0.02, 0.05], 0.001, {}, L.secondary, { xf: { p: [0, 0.03, 0.07] }, crease: 0.6 });
  });
}

export function grey(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine(), seg = hi ? 10 : 6;
  b.group({ s: 1.3 }, () => {
    // duenne Beine mit Dreizehenfuessen / thin legs with three-toed feet
    b.mirrorX(() => {
      const ankle: V3 = [0.038, 0.02, -0.004];
      thinLimb(b, A, [[0.03, 0.132, 0], [0.036, 0.076, 0.02], ankle], 0.016, 0.0105, seg, L.pants, L.primary);
      b.add(softBox(0.03, 0.013, 0.05, 0.005), L.gear, { xf: { p: [0.038, 0.007, 0.012] } });
      if (hi) for (const a of [-0.45, 0, 0.45]) rod(b, A, [0.038 + Math.sin(a) * 0.01, 0.006, 0.03], [0.038 + Math.sin(a) * 0.03, 0.005, 0.03 + Math.cos(a) * 0.028], 0.006, 0.003, 4, L.gear);
    });
    // Anzug: Becken, Guertel, Jacke bis zu den Schultern, Hals / suit: pelvis, belt, jacket up to the shoulders, neck
    const suit: Ring[] = [
      { y: 0.234, rx: 0.012, c: mat.alienSkin }, { y: 0.224, rx: 0.014, hard: true }, { y: 0.2235, rx: 0.024, rz: 0.02, hard: true, c: L.jacket },
      { y: 0.214, rx: 0.049, rz: 0.03, e: 2.5 }, { y: 0.196, rx: 0.048, rz: 0.036, e: 2.4 }, { y: 0.166, rx: 0.036, rz: 0.03 },
      { y: 0.152, rx: 0.034, rz: 0.027, hard: true }, { y: 0.1515, rx: 0.037, rz: 0.03, hard: true, c: L.gear }, { y: 0.14, rx: 0.037, rz: 0.03, hard: true },
      { y: 0.1395, rx: 0.036, rz: 0.029, hard: true, c: L.pants }, { y: 0.124, rx: 0.034, rz: 0.027 }, { y: 0.112, rx: TIP },
    ];
    b.add(loft(suit, { seg: hi ? 14 : 8, region: cell(A, 'greySuit') }), null, { crease: 0.7 });
    // Brustfeld in der Zweitfarbe mit Saeurekern / chest panel in the secondary colour with an acid core
    b.add(frontLoft([{ y: 0.214, rx: 0.02, rz: 0.03, rzB: 0.01, c: L.secondary }, { y: 0.206, rx: 0.034, rz: 0.038, rzB: 0.01 }, { y: 0.178, rx: 0.03, rz: 0.038, rzB: 0.01 }, { y: 0.166, rx: 0.016, rz: 0.03, rzB: 0.01 }], { seg: 8, region: A.get('blank') }), null, { crease: 0.6 });
    bead(b, A, [0, 0.19, 0.039], 0.0125, mat.acid, hi ? 8 : 6, { gloss: 1 });
    for (const s of [-1, 1]) bead(b, A, [s * 0.05, 0.213, 0], 0.019, L.primary, hi ? 8 : 6, {}, [1, 0.7, 1]);
    // Rueckengeraet / back unit
    box(b, A, [0.05, 0.05, 0.03], 0.008, { nz: 'case' }, mat.alienMetal, { xf: { p: [0, 0.19, -0.042] } });
    rod(b, A, [0, 0.168, -0.06], [0, 0.214, -0.06], 0.008, 0.008, 6, mat.acid, { gloss: 1 });
    if (hi) emblemDecal(b, A, f, [-0.0495, 0.196, 0], [-1, 0, 0], 0.02, L.jacket);
    // grosser Kopf / big head
    const d = hi ? 2 : 1;
    b.group({ p: [0, 0.23, 0.004], s: 1.02 }, () => greyHead(b, A, L, d, headSegments(d)));
    // Arme und Lasergewehr / arms and laser rifle
    const G: V3 = [0.035, 0.152, 0.04], D: V3 = [-0.18, 0.1, 1];
    const H2 = along(G, D, 0.1);
    for (const [s, hand] of [[1, G], [-1, H2]] as [number, V3][]) {
      const sh: V3 = [s * 0.05, 0.207, 0];
      const el: V3 = [s * 0.062 + (hand[0] - s * 0.05) * 0.3, (0.207 + hand[1]) / 2 - 0.03, hand[2] * 0.4];
      thinLimb(b, A, [sh, el, hand], 0.0095, 0.0075, seg, L.jacket, mat.alienSkin);
      bead(b, A, hand, 0.012, mat.alienSkin, 6);
    }
    laserRifle(b, A, L, G, D);
  });
  return b;
}

// ---------- Roboter / robots ----------

/** Plattenglied von a nach c mit kantigem Querschnitt (Zelle 'botLimb') / plate limb from a to c with an angular cross-section (cell 'botLimb') */
function plateLimb(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, w: number, d: number, col: ColorLike): void {
  b.bone(V(a), V(c), FRONT, (len) => {
    b.add(loft([{ y: -0.006, rx: w * 0.38, rz: d * 0.38, e: 3.6, c: col, hard: true }, { y: 0.002, rx: w / 2, rz: d / 2, e: 3.6, hard: true }, { y: len - 0.002, rx: w * 0.46, rz: d * 0.46, e: 3.6, hard: true }, { y: len + 0.006, rx: w * 0.36, rz: d * 0.36, e: 3.6 }], { seg: fine() ? 12 : 8, region: cell(A, 'botLimb'), capFirst: true, capLast: true }), null, { gloss: 0.25 });
  });
}

interface BotSpec { heavy: boolean; hipX: number; shoulderX: number; torsoW: number; torsoD: number; limbK: number }

function robot(f: FactionId, A: AtlasLayout, S: BotSpec): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine(), seg = hi ? 10 : 6;
  const plate = L.jacket, metal = mat.gunmetal, glow = mat.cyanGlow;
  const k = S.limbK, dy = S.heavy ? 0.01 : 0;
  b.group({ s: 1.2 }, () => {
    // Beine: Platte am Oberschenkel, Metall am Unterschenkel, Gelenkkugel / legs: plate thigh, metal shin, joint ball
    b.mirrorX(() => {
      const hip: V3 = [S.hipX, 0.168 + dy / 2, 0], knee: V3 = [S.hipX + 0.005, 0.093, 0.023], ankle: V3 = [S.hipX + 0.006, 0.029, 0];
      plateLimb(b, A, hip, knee, 0.046 * k, 0.05 * k, plate);
      plateLimb(b, A, knee, ankle, 0.038 * k, 0.042 * k, metal);
      bead(b, A, knee, 0.024 * k, metal, seg, { gloss: 0.5 });
      if (S.heavy) b.add(frontLoft([{ y: 0.03, rx: 0.016, rz: 0.02, rzB: 0.006, c: L.primary }, { y: 0.012, rx: 0.028, rz: 0.026, rzB: 0.006 }, { y: -0.02, rx: 0.022, rz: 0.022, rzB: 0.006 }], { seg: 8, region: A.get('blank') }), null, { xf: { p: [knee[0], knee[1] + 0.006, knee[2] + 0.018], r: [-0.25, 0, 0] }, gloss: 0.3 });
      b.add(softBox(0.052 * k, 0.026 * k, 0.09 * k, 0.008), metal, { xf: { p: [ankle[0], 0.013 * k, 0.014] }, gloss: 0.4 });
      if (hi) b.add(softBox(0.006, 0.03, 0.006, 0.002), glow, { xf: { p: [ankle[0] + (S.heavy ? 0.028 : 0), 0.06, S.heavy ? 0.02 : 0.03] }, gloss: 1, crease: 0 });
    });
    // Becken, Taille, Rumpf mit Kern / pelvis, waist, torso with the core
    const w = S.torsoW, dz = S.torsoD, y0 = 0.212 + dy, y1 = 0.325 + dy * 2;
    box(b, A, [w * 0.74, 0.042, dz * 0.85], 0.012, {}, metal, { xf: { p: [0, 0.174 + dy, 0] }, gloss: 0.4 });
    rod(b, A, [0, 0.19 + dy, 0], [0, y0 + 0.004, 0], 0.04 * k, 0.036 * k, seg, metal, { gloss: 0.4, crease: 0.6 });
    const torso: Ring[] = [
      { y: y1, rx: w * 0.36, rz: dz * 0.4, e: 3.4, c: plate }, { y: y1 - 0.008, rx: w / 2, rz: dz / 2, e: 3.6, hard: true }, { y: (y0 + y1) / 2, rx: w * 0.45, rz: dz * 0.47, e: 3.6 },
      { y: y0 + 0.006, rx: w * 0.37, rz: dz * 0.41, e: 3.6, hard: true }, { y: y0, rx: w * 0.3, rz: dz * 0.33, e: 3.4 },
    ];
    b.add(loft(torso, { seg: hi ? 20 : 10, region: cell(A, 'botTorso'), capFirst: true, capLast: true }), null, { gloss: 0.25 });
    const cy = y0 + (y1 - y0) * 0.56;
    if (S.heavy) b.add(frontLoft([{ y: y1 - 0.012, rx: w * 0.3, rz: dz / 2 + 0.006, rzB: 0.01, e: 3.2, c: L.primary }, { y: cy, rx: w * 0.41, rz: dz / 2 + 0.01, rzB: 0.01, e: 3.2 }, { y: y0 + 0.022, rx: w * 0.33, rz: dz / 2 + 0.004, rzB: 0.01, e: 3.2, hard: true }, { y: y0 + 0.022, rx: w * 0.2, rz: dz * 0.3, rzB: 0.01 }], { seg: hi ? 16 : 8, region: cell(A, 'plate') }), null, { gloss: 0.3 });
    bead(b, A, [0, cy, dz / 2 + (S.heavy ? 0.008 : 0.001)], S.heavy ? 0.018 : 0.016, glow, hi ? 10 : 6, { gloss: 1 }, [1, 1, 0.6]);
    if (hi) emblemDecal(b, A, f, [-w * 0.26, y1 - 0.024, dz / 2 + (S.heavy ? 0.0105 : 0.0015)], [0, 0, 1], 0.026, S.heavy ? L.primary : plate);
    // Sechseckfelder an den Flanken (Androide) / hexagon panels on the flanks (android)
    if (!S.heavy && hi) for (const s of [-1, 1]) rod(b, A, [s * (w * 0.46), cy, 0], [s * (w * 0.46 + 0.005), cy, 0], 0.022, 0.022, 6, L.primary, { crease: 0.7 });
    // Energierucksack; Cyborg: Reaktor mit zwei hohen Schloten / power pack; cyborg: reactor with two tall stacks
    const pz = -dz / 2 - 0.022;
    box(b, A, [w * 0.62, S.heavy ? 0.12 : 0.08, S.heavy ? 0.06 : 0.04], 0.012, { nz: 'case' }, metal, { xf: { p: [0, cy + (S.heavy ? 0.006 : 0), pz - (S.heavy ? 0.008 : 0)] }, gloss: 0.4 });
    if (S.heavy) for (const s of [-1, 1]) {
      const x = s * 0.05, z = pz - 0.036, top = 0.468;
      b.add(loft([
        { y: 0.25, rx: 0.027, c: metal, hard: true }, { y: top - 0.045, rx: 0.023, hard: true }, { y: top - 0.045, rx: 0.031, hard: true, c: mat.dark }, { y: top - 0.03, rx: 0.031, hard: true },
        { y: top - 0.03, rx: 0.027, hard: true, c: glow }, { y: top, rx: 0.027, hard: true },
      ], { seg: hi ? 10 : 6, region: cell(A, 'tank'), capFirst: true, capLast: true }), null, { xf: { p: [x, 0, z] }, gloss: 0.5 });
    } else {
      if (hi) for (const y of [-0.02, 0, 0.02]) b.add(softBox(0.07, 0.004, 0.004, 0.001), glow, { xf: { p: [0, cy + y, pz - 0.021] }, gloss: 1, crease: 0 });
      rod(b, A, [0.03, cy + 0.04, pz], [0.036, cy + 0.15, pz - 0.012], 0.003, 0.002, 4, metal);
      bead(b, A, [0.0362, cy + 0.154, pz - 0.0125], 0.0065, glow, 5, { gloss: 1 });
    }
    // Kopf mit Visier / head with visor
    const d = hi ? 2 : 1;
    b.group({ p: [0, y1 - 0.004, 0.004], s: 0.92 }, () => robotHead(b, A, L, d, headSegments(d), !S.heavy));
    // Schultern / shoulders
    const sy = y1 - 0.018, sx = S.shoulderX;
    for (const s of [-1, 1]) {
      bead(b, A, [s * sx, sy, 0], 0.027 * k, S.heavy ? metal : L.primary, seg, { gloss: 0.5 });
      if (S.heavy) {
        b.add(loft([{ y: 0.03, rx: TIP, c: L.primary }, { y: 0.026, rx: 0.022, rz: 0.028, e: 3 }, { y: 0.008, rx: 0.042, rz: 0.046, e: 3 }, { y: -0.018, rx: 0.045, rz: 0.048, e: 3, hard: true }, { y: -0.018, rx: 0.034, rz: 0.038, c: shade(L.primary, 0.5) }], { seg: hi ? 12 : 8, region: A.get('blank') }), null, { xf: { p: [s * (sx + 0.012), sy + 0.022, 0], r: [0, 0, s * -0.3] }, gloss: 0.3 });
        if (hi) b.add(softBox(0.004, 0.03, 0.06, 0.001), glow, { xf: { p: [s * (sx + 0.052), sy + 0.004, 0], r: [0, 0, s * -0.3] }, gloss: 1, crease: 0 });
      }
    }
    // rechter Arm: uebergrosse Armkanone mit Leuchtspulen / right arm: oversized arm cannon with glowing coils
    const elR: V3 = [sx + 0.015, sy - 0.072, 0.04], gx = sx + 0.012, gy = sy - 0.076;
    plateLimb(b, A, [sx, sy, 0], elR, 0.037 * k, 0.041 * k, plate);
    bead(b, A, elR, 0.021 * k, metal, seg, { gloss: 0.5 });
    box(b, A, [0.058 * k, 0.058 * k, 0.125], 0.012, { px: 'plate', nx: 'plate', py: 'plate' }, metal, { xf: { p: [gx, gy, 0.11] }, gloss: 0.4 });
    if (!S.heavy) box(b, A, [0.062, 0.016, 0.1], 0.005, {}, plate, { xf: { p: [gx, gy + 0.033, 0.11] } });
    else if (hi) for (let i = 0; i < 4; i++) b.add(softBox(0.078, 0.007, 0.009, 0.002), mat.dark, { xf: { p: [gx, gy + 0.036, 0.07 + i * 0.026] }, crease: 0.6 });
    rod(b, A, [gx, gy + 0.002, 0.17], [gx, gy + 0.002, 0.32], 0.021 * k, 0.019 * k, hi ? 12 : 6, metal, { cell: 'tube', gloss: 0.5, crease: 0.6 });
    const coils = hi ? (S.heavy ? 3 : 4) : 2;
    for (let i = 0; i < coils; i++) { const z = 0.19 + (i / coils) * 0.11; rod(b, A, [gx, gy + 0.002, z], [gx, gy + 0.002, z + 0.009], 0.027 * k, 0.027 * k, hi ? 10 : 6, glow, { gloss: 1, crease: 0.6 }); }
    rod(b, A, [gx, gy + 0.002, 0.31], [gx, gy + 0.002, 0.33], 0.025 * k, 0.025 * k, hi ? 10 : 6, mat.dark, { crease: 0.6 });
    bead(b, A, [gx, gy + 0.002, 0.333], 0.016 * k, glow, 6, { gloss: 1 });
    // linker Arm stuetzt die Kanone / left arm supports the cannon
    const elL: V3 = [-sx - 0.01, sy - 0.072, 0.05], hL: V3 = [gx - 0.045, gy - 0.012, 0.12];
    plateLimb(b, A, [-sx, sy, 0], elL, 0.037 * k, 0.041 * k, plate);
    bead(b, A, elL, 0.021 * k, metal, seg, { gloss: 0.5 });
    plateLimb(b, A, elL, hL, 0.033 * k, 0.037 * k, metal);
    b.add(softBox(0.032 * k, 0.03 * k, 0.032 * k, 0.008), metal, { xf: { p: hL }, gloss: 0.4 });
  });
  return b;
}

export function android(f: FactionId, A: AtlasLayout): UvBuilder {
  return robot(f, A, { heavy: false, hipX: 0.04, shoulderX: 0.09, torsoW: 0.15, torsoD: 0.085, limbK: 1 });
}
export function cyborg(f: FactionId, A: AtlasLayout): UvBuilder {
  return robot(f, A, { heavy: true, hipX: 0.05, shoulderX: 0.108, torsoW: 0.18, torsoD: 0.1, limbK: 1.2 });
}
