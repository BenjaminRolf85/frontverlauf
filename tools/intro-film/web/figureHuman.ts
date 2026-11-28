/**
 * Nur Filmexport (Anime-Schnitt): der Mensch des Figurenbaukastens. Skelett mit anime-heroischen Proportionen (rund
 * 7,5 Koepfe), dazu die Koerperteile mit Anatomie im Umriss: Arme mit Schulterkappe, Bizeps, Ellbogen und
 * Unterarm; Haende mit Handteller, Daumen und vier Fingern aus je drei Gliedern; Beine mit Schenkel, Knie und Wade;
 * Stiefel mit Schaft, Fuss, Sohle und Absatz; der Rumpf unter dem Brustkorb mit Taille, Huefte und Rockschoss.
 * Jedes Teil bekommt seine Gewichte (figureKit.Skinner), die Zeichnung kommt vom Kostuem der Figur (Zellen).
 * Film export only (anime cut): the human of the figure kit. A skeleton with anime-heroic proportions (about 7.5
 * heads), plus the body parts with anatomy in the silhouette: arms with shoulder cap, biceps, elbow and forearm; hands
 * with palm, thumb and four fingers of three bones each; legs with thigh, knee and calf; boots with shaft, foot, sole
 * and heel; the trunk below the rib cage with waist, hips and skirt. Every part gets its weights (figureKit.Skinner),
 * the drawing comes from the figure's costume (cells).
 */
import * as THREE from 'three';
import { type ColorLike, type V3 } from '../../../src/render/models/kit';
import { sheet } from '../../../src/render/models/inked/leaderKit';
import type { Region, UvBuilder } from '../../../src/render/models/inked/uvkit';
import { bump, curve, ell, limb, lod, outward, Rig, Skinner, smooth, type SkinFn } from './figureKit';

/** Masse des Menschen in Einheiten der Bueste (Kopfhoehe 0.38, Scheitel bei y = 0.855) / the human's sizes in units of the bust (head height 0.38, crown at y = 0.855) */
export interface HumanProp {
  /** Hueftgelenk: Hoehe und halber Abstand / hip joint: height and half spacing */
  hipY: number; hipX: number;
  thigh: number; shin: number;
  /** Knoechel ueber der Sohle / ankle above the sole */
  ankle: number;
  waistY: number; chestY: number; neckY: number; headY: number;
  /** linke Schulter und linker Schluesselbeinansatz / left shoulder and left clavicle root */
  shoulder: V3; clav: V3;
  upperArm: number; foreArm: number;
  /** Massstab der Hand (1 = 0.31 lang) / scale of the hand (1 = 0.31 long) */
  hand: number;
}

/** Heldenfigur: gut 7,5 Koepfe (2.95 hoch), Sohle bei y = -2.095 / hero figure: a good 7.5 heads (2.95 tall), sole at y = -2.095 */
export const HERO: HumanProp = {
  hipY: -0.5, hipX: 0.15, thigh: 0.77, shin: 0.69, ankle: 0.135,
  waistY: -0.22, chestY: -0.02, neckY: 0.4, headY: 0.53,
  shoulder: [0.345, 0.225, -0.012], clav: [0.1, 0.34, -0.012],
  upperArm: 0.5, foreArm: 0.43, hand: 1,
};
/** Sohle der Figur / the figure's sole */
export const floorY = (P: HumanProp): number => P.hipY - P.thigh - P.shin - P.ankle;

/** Fingerglieder: [Name, Ansatz im Rahmen der Hand (links), Laengen, Radius, Spreizung der Bindehaltung] / finger bones */
const FINGERS: [string, V3, [number, number, number], number, number][] = [
  ['index', [0.004, -0.158, 0.046], [0.062, 0.04, 0.032], 0.0195, 5],
  ['middle', [0.006, -0.166, 0.016], [0.067, 0.044, 0.034], 0.02, 1],
  ['ring', [0.004, -0.158, -0.014], [0.061, 0.04, 0.032], 0.019, -3],
  ['pinky', [0, -0.144, -0.042], [0.047, 0.031, 0.028], 0.017, -8],
];
const THUMB: [number, number, number] = [0.066, 0.05, 0.04];

/** Skelett des Menschen / the human's skeleton */
export function humanRig(P: HumanProp): Rig {
  const rig = new Rig();
  const k = P.hand;
  rig.add({ name: 'root', parent: null, offset: [0, P.hipY, 0], kind: 'root' });
  rig.add({ name: 'spine', parent: 'root', offset: [0, P.waistY - P.hipY, -0.01], kind: 'spine' });
  rig.add({ name: 'chest', parent: 'spine', offset: [0, P.chestY - P.waistY, -0.01], kind: 'spine' });
  rig.add({ name: 'neck', parent: 'chest', offset: [0, P.neckY - P.chestY, 0.01], kind: 'spine' });
  rig.add({ name: 'head', parent: 'neck', offset: [0, P.headY - P.neckY, 0.012], kind: 'spine' });
  for (const [S, s] of [['L', 1], ['R', -1]] as [string, number][]) {
    rig.add({ name: `clav${S}`, parent: 'chest', offset: [s * P.clav[0], P.clav[1] - P.chestY, P.clav[2] + 0.02], kind: 'clav', side: s });
    rig.add({ name: `arm${S}`, parent: `clav${S}`, offset: [s * (P.shoulder[0] - P.clav[0]), P.shoulder[1] - P.clav[1], P.shoulder[2] - P.clav[2]], kind: 'ball', side: s, bind: [4, 30, 0] });
    rig.add({ name: `elbow${S}`, parent: `arm${S}`, offset: [0, -P.upperArm, 0], kind: 'elbow', side: s, bind: [10] });
    rig.add({ name: `hand${S}`, parent: `elbow${S}`, offset: [0, -P.foreArm, 0], kind: 'wrist', side: s });
    rig.add({ name: `thumb1${S}`, parent: `hand${S}`, offset: [-s * 0.012 * k, -0.035 * k, 0.04 * k], kind: 'thumb', side: s, bind: [-38, 40, 0] });
    rig.add({ name: `thumb2${S}`, parent: `thumb1${S}`, offset: [0, -THUMB[0] * k, 0], kind: 'tcurl', side: s, bind: [8] });
    rig.add({ name: `thumb3${S}`, parent: `thumb2${S}`, offset: [0, -THUMB[1] * k, 0], kind: 'tcurl', side: s, bind: [8] });
    for (const [f, o, len, , spread] of FINGERS) {
      rig.add({ name: `${f}1${S}`, parent: `hand${S}`, offset: [s * o[0] * k, o[1] * k, o[2] * k], kind: 'curl', side: s, bind: [10, spread] });
      rig.add({ name: `${f}2${S}`, parent: `${f}1${S}`, offset: [0, -len[0] * k, 0], kind: 'curl', side: s, bind: [12] });
      rig.add({ name: `${f}3${S}`, parent: `${f}2${S}`, offset: [0, -len[1] * k, 0], kind: 'curl', side: s, bind: [8] });
    }
    rig.add({ name: `leg${S}`, parent: 'root', offset: [s * P.hipX, 0, 0], kind: 'ball', side: s, bind: [0, 5, 4] });
    rig.add({ name: `knee${S}`, parent: `leg${S}`, offset: [0, -P.thigh, 0], kind: 'knee', side: s, bind: [3] });
    rig.add({ name: `foot${S}`, parent: `knee${S}`, offset: [0, -P.shin, 0], kind: 'foot', side: s, bind: [-3, 6, 0] });
    // Punkte fuer Blender: Sohle (Ballen, Ferse), Griffmitte der Hand, Spitze des Zeigefingers
    // points for Blender: sole (ball, heel), the hand's grip centre, the index fingertip
    rig.mark(`ball${S}`, `foot${S}`, [0, -P.ankle, 0.2]);
    rig.mark(`heel${S}`, `foot${S}`, [0, -P.ankle, -0.06]);
    rig.mark(`grip${S}`, `hand${S}`, [-s * 0.045 * k, -0.11 * k, 0.01 * k]);
    rig.mark(`tip${S}`, `index3${S}`, [0, -FINGERS[0][2][2] * k, 0]);
    rig.mark(`wrist${S}`, `hand${S}`, [0, 0, 0]);
  }
  rig.mark('eyes', 'head', [0, 0.16, 0.16]);
  rig.mark('crown', 'head', [0, 0.855 - P.headY, 0]);
  return rig;
}

/** Bauzustand eines Menschen / build state of a human */
export interface Human { b: UvBuilder; sk: Skinner; rig: Rig; P: HumanProp }

const SIDES: [string, 1 | -1][] = [['L', 1], ['R', -1]];
const gauss = (x: number, w: number) => Math.exp(-((x / w) ** 2));

export interface ArmOpts {
  sleeve: Region; cuff: Region; color: ColorLike; cuffColor: ColorLike;
  /** Dicke (1 = kraeftiger Mann im Uniformrock) / thickness (1 = a strong man in a uniform coat) */
  bulk?: number;
  /** Aufschlag: Laenge und Zugabe / cuff: length and extra radius */
  cuffLen?: number; cuffGrow?: number;
  crease?: number;
}
/** Arme im Aermel: Schulterkappe (unter dem Schulterstueck), Bizeps, Ellbogen, Unterarm; Aufschlag am Handgelenk / arms in the sleeve */
export function arms(H: Human, o: ArmOpts): void {
  const { b, sk, rig, P } = H, k = o.bulk ?? 1;
  for (const [S, s] of SIDES) {
    const sh = rig.head(`arm${S}`), el = rig.head(`elbow${S}`), wr = rig.head(`hand${S}`);
    const dU = el.clone().sub(sh).normalize(), dF = wr.clone().sub(el).normalize();
    const d0 = 0.09 * k, U = P.upperArm, F = P.foreArm;
    const R = curve([
      [0, 0.1, 0.1], [d0 + 0.1, 0.103, 0.106], [d0 + U * 0.6, 0.093, 0.098], [d0 + U - 0.05, 0.083, 0.088], [d0 + U, 0.081, 0.087],
      [d0 + U + 0.09, 0.082, 0.089], [d0 + U + F * 0.6, 0.071, 0.076], [d0 + U + F - 0.02, 0.064, 0.068],
    ]);
    const out = rig.dir(`arm${S}`, [s, 0, 0]);
    sk.part(sk.chain([`arm${S}`, `elbow${S}`], 0.075), () => {
      b.add(limb([sh.clone().addScaledVector(dU, -d0), el, wr.clone().addScaledVector(dF, -0.01)], (d, a) => {
        const [rn, rb] = R(d);
        // Ellbogenspitze hinten, Deltamuskel aussen / elbow point at the back, deltoid on the outside
        return k * (ell(rn, rb, a) + 0.011 * gauss(d - (d0 + U), 0.04) * bump(a, -Math.PI / 2, 1.0) + 0.007 * gauss(d - (d0 + 0.07), 0.08) * bump(a, 0, 1.3));
      }, { seg: 28, step: 0.02, region: o.sleeve, out, mirror: s < 0, color: o.color, cap0: d0, cap1: 0.03 }), null, { crease: o.crease ?? 0.4 });
    });
    // Aufschlag / cuff
    const cl = o.cuffLen ?? 0.115, cg = o.cuffGrow ?? 0.012;
    sk.part(`elbow${S}`, () => {
      b.add(limb([wr.clone().addScaledVector(dF, -cl), wr.clone().addScaledVector(dF, 0.016)], (d, a) => k * (ell(0.066, 0.07, a) + cg + 0.004 * smooth(0, cl, d)),
        { seg: 28, step: 0.012, region: o.cuff, out, mirror: s < 0, color: o.cuffColor, cap0: 0.008, cap1: 0.014 }), null, { crease: 1 });
    });
  }
}

export interface HandOpts { back: Region; finger: Region; color: ColorLike; crease?: number }
/** Haende (Handschuh oder Haut): Handteller, Daumen mit Ballen, vier Finger aus drei Gliedern / hands (glove or skin): palm, thumb with its pad, four fingers of three bones */
export function hands(H: Human, o: HandOpts): void {
  const { b, sk, rig, P } = H, k = P.hand;
  for (const [S, s] of SIDES) {
    const hn = `hand${S}`;
    const back = rig.dir(hn, [s, 0, 0]);
    // Handteller: vom Handgelenk (im Aufschlag) bis zu den Knoecheln / palm: from the wrist (inside the cuff) to the knuckles
    const W = curve([[0, 0.031, 0.044], [0.05, 0.03, 0.05], [0.1, 0.031, 0.066], [0.17, 0.027, 0.073], [0.215, 0.023, 0.07]].map((r) => r.map((v) => v * k)));
    sk.part(hn, () => {
      b.add(limb([rig.point(hn, [0, 0.045 * k, 0]), rig.point(hn, [0.004 * s * k, -0.07 * k, 0.004 * k]), rig.point(hn, [0.004 * s * k, -0.172 * k, 0.002 * k])], (d, a) => {
        const [rn, rb] = W(d);
        // Handruecken flach gewoelbt, Handflaeche mit Ballen an der Daumenseite / back of the hand gently domed, palm with the pad on the thumb side
        return ell(rn, rb, a) + 0.004 * k * bump(a, Math.PI, 1.2) * gauss(d - 0.09 * k, 0.06 * k);
      }, { seg: 24, step: 0.01 * k, region: o.back, out: back, mirror: s < 0, color: o.color, cap0: 0.01 * k, cap1: 0.03 * k }), null, { crease: o.crease ?? 0.5 });
    });
    // Daumen: Ballen (Mittelhandknochen) und zwei Glieder / thumb: pad (metacarpal) and two bones
    const tn = [`thumb1${S}`, `thumb2${S}`, `thumb3${S}`];
    const tp = [rig.point(tn[0], [0, 0.02 * k, 0]), rig.head(tn[1]), rig.head(tn[2]), rig.point(tn[2], [0, -THUMB[2] * k, 0])];
    const TR = curve([[0, 0.03], [THUMB[0] * 0.6, 0.029], [THUMB[0] + 0.02, 0.0225], [THUMB[0] + THUMB[1] + 0.02, 0.0205], [THUMB[0] + THUMB[1] + THUMB[2] + 0.02, 0.0185]].map((r) => r.map((v) => v * k)));
    sk.part(sk.chain(tn, [0.03 * k, 0.012 * k, 0.012 * k], true), () => {
      b.add(limb(tp, (d) => TR(d)[0], { seg: 14, step: 0.008 * k, region: o.finger, out: rig.dir(tn[0], [0, 0, 1]), mirror: s < 0, color: o.color, cap0: 0.02 * k, cap1: 0.018 * k }), null, { crease: o.crease ?? 0.5 });
    });
    for (const [f, , len, r] of FINGERS) {
      const fn = [`${f}1${S}`, `${f}2${S}`, `${f}3${S}`];
      const pts = [rig.point(fn[0], [0, 0.018 * k, 0]), rig.head(fn[1]), rig.head(fn[2]), rig.point(fn[2], [0, -len[2] * k, 0])];
      const total = (len[0] + len[1] + len[2] + 0.018) * k;
      sk.part(sk.chain(fn, 0.011 * k), () => {
        b.add(limb(pts, (d, a) => {
          // Glieder: leicht verjuengt, an den Gelenken etwas dicker / bones: slightly tapered, a little thicker at the joints
          const j = gauss(d - (0.018 + len[0]) * k, 0.012 * k) + gauss(d - (0.018 + len[0] + len[1]) * k, 0.01 * k);
          return r * k * (1 - 0.16 * (d / total)) * (1 + 0.05 * j) * (1 - 0.06 * bump(a, Math.PI, 1.3));
        }, { seg: 12, step: 0.007 * k, region: o.finger, out: rig.dir(fn[0], [s, 0, 0]), mirror: s < 0, color: o.color, cap0: 0.012 * k, cap1: r * k * 0.95 }), null, { crease: o.crease ?? 0.5 });
      });
    }
  }
}

export interface LegOpts {
  trouser: Region; color: ColorLike;
  /** Ausbuchtung der Reithose (0 = gerade Hose) / flare of riding breeches (0 = straight trousers) */
  flare?: number;
  /** Hosenbein bis zum Knoechel (ohne Stiefelschaft) / trouser leg down to the ankle (no boot shaft) */
  long?: boolean;
  bulk?: number;
  crease?: number;
}
/** Beine in der Hose: Hueftkappe (unter dem Rockschoss), Schenkel, Knie mit Scheibe, Wade / legs in trousers */
export function legs(H: Human, o: LegOpts): void {
  const { b, sk, rig, P } = H, k = o.bulk ?? 1, fl = o.flare ?? 0;
  for (const [S, s] of SIDES) {
    const hip = rig.head(`leg${S}`), kn = rig.head(`knee${S}`), an = rig.head(`foot${S}`);
    const dT = kn.clone().sub(hip).normalize(), dS = an.clone().sub(kn).normalize();
    const d0 = 0.11, T = P.thigh, low = o.long ? P.shin - 0.02 : 0.24;
    const R = curve([
      [0, 0.15, 0.142], [d0 + 0.1, 0.152 + 0.02 * fl, 0.146], [d0 + 0.28, 0.142 + 0.014 * fl, 0.14], [d0 + T * 0.72, 0.116, 0.12], [d0 + T - 0.04, 0.104, 0.108], [d0 + T, 0.1, 0.105],
      [d0 + T + 0.12, 0.092, 0.1], [d0 + T + 0.3, 0.09, 0.098], [d0 + T + P.shin - 0.12, 0.07, 0.074], [d0 + T + P.shin, 0.064, 0.068],
    ]);
    const out = rig.dir(`leg${S}`, [s, 0, 0]);
    sk.part(sk.chain([`leg${S}`, `knee${S}`], 0.085), () => {
      b.add(limb([hip.clone().addScaledVector(dT, -d0), kn, kn.clone().addScaledVector(dS, low)], (d, a) => {
        const [rn, rb] = R(d);
        // Reithose: aussen weit; Kniescheibe vorn; Wade hinten / breeches: wide on the outside; kneecap in front; calf at the back
        return k * (ell(rn, rb, a) + 0.046 * fl * gauss(d - (d0 + 0.3), 0.17) * bump(a, 0, 1.2) + 0.011 * gauss(d - (d0 + T), 0.045) * bump(a, Math.PI / 2, 0.9)
          + 0.012 * gauss(d - (d0 + T + 0.2), 0.11) * bump(a, -Math.PI / 2, 1.1));
      }, { seg: 32, step: 0.022, region: o.trouser, out, mirror: s < 0, color: o.color, cap0: d0, cap1: 0.03 }), null, { crease: o.crease ?? 0.4 });
    });
  }
}

export interface BootOpts {
  shaft: Region; foot: Region; color: ColorLike; soleColor: ColorLike;
  /** Schafthoehe ab dem Knoechel (Reitstiefel bis unters Knie) / shaft height from the ankle (riding boots reach just below the knee) */
  height?: number;
  gloss?: number;
  /** Sporn in dieser Farbe / spur in this colour */
  spur?: ColorLike;
}
/** Stiefel: Schaft mit Wade, Fuss mit Spann und Kappe, Sohle und Absatz / boots: shaft with calf, foot with instep and toe cap, sole and heel */
export function boots(H: Human, o: BootOpts): void {
  const { b, sk, rig, P } = H, gloss = o.gloss ?? 0.5;
  const hgt = o.height ?? P.shin - 0.075;
  for (const [S, s] of SIDES) {
    const kn = rig.head(`knee${S}`), an = rig.head(`foot${S}`);
    const dS = an.clone().sub(kn).normalize();
    const out = rig.dir(`knee${S}`, [s, 0, 0]);
    const R = curve([[0, 0.107, 0.109], [0.035, 0.105, 0.108], [hgt * 0.38, 0.103, 0.107], [hgt * 0.72, 0.087, 0.092], [hgt - 0.03, 0.076, 0.083], [hgt + 0.04, 0.072, 0.08]]);
    sk.part(sk.chain([`knee${S}`, `foot${S}`], 0.05), () => {
      b.add(limb([an.clone().addScaledVector(dS, -hgt), an.clone().addScaledVector(dS, 0.04)], (d, a) => {
        const [rn, rb] = R(d);
        // Wade hinten, vorn die Schienbeinkante; oberer Rand vorn hoeher geschnitten / calf at the back, shin edge in front
        return ell(rn, rb, a) + 0.016 * gauss(d - hgt * 0.3, hgt * 0.24) * bump(a, -Math.PI / 2, 1.2) - 0.004 * gauss(d - hgt * 0.5, hgt * 0.3) * bump(a, Math.PI / 2, 0.6);
      }, { seg: 32, step: 0.02, region: o.shaft, out, mirror: s < 0, color: o.color, cap0: 0.012, cap1: 0.05 }), null, { crease: 0.6, gloss });
    });
    // Fuss im Rahmen des Fussknochens: Knoechel im Ursprung, Sohle bei y = -ankle, Spitze nach +z
    // foot in the foot bone's frame: ankle at the origin, sole at y = -ankle, toe towards +z
    const fb = `foot${S}`, A = P.ankle;
    const yc = curve([[0, -A + 0.085], [0.04, -A + 0.08], [0.09, -A + 0.088], [0.17, -A + 0.076], [0.27, -A + 0.058], [0.35, -A + 0.049], [0.4, -A + 0.046]]);
    const FR = curve([[0, 0.05, 0.054], [0.04, 0.062, 0.06], [0.09, 0.07, 0.064], [0.17, 0.056, 0.068], [0.27, 0.038, 0.073], [0.35, 0.029, 0.064], [0.4, 0.026, 0.05]]);
    const z0 = -0.095, len = 0.4;
    const path: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) { const d = (i / 10) * len; path.push(rig.point(fb, [0, yc(d)[0], z0 + d])); }
    sk.part(fb, () => {
      b.add(limb(path, (d, a) => {
        const [rv, rh] = FR(d);
        // unten flach (steht auf der Sohle) / flat below (stands on the sole)
        const c = Math.cos(a);
        return ell(rv, rh, a) * (c < 0 ? 1 - 0.22 * c * c : 1);
      }, { seg: 28, step: 0.014, region: o.foot, out: rig.dir(fb, [0, 1, 0]), color: o.color, cap0: 0.045, cap1: 0.04 }), null, { crease: 0.6, gloss });
      // Sohle (Rahmen) und Absatz / sole (welt) and heel
      const hw = curve([[0, 0.03], [0.03, 0.056], [0.1, 0.06], [0.17, 0.062], [0.27, 0.076], [0.35, 0.068], [0.395, 0.04], [0.41, 0.012]]);
      const plate = (za: number, zb: number, top: number, bottom: number) => {
        b.add(sheet((u, v) => {
          const d = za + (zb - za) * u, w = hw(d)[0] * Math.cos((v - 0.5) * 0.4);
          return rig.point(fb, [(v - 0.5) * 2 * w, top, z0 - 0.005 + d]);
        }, { nu: 14, nv: 6, region: b.blank, thick: top - bottom, color: o.soleColor, flip: true }), null, { crease: 1 });
      };
      plate(0, 0.41, -A + 0.026, -A + 0.012);
      plate(0.14, 0.41, -A + 0.014, -A);
      plate(0, 0.115, -A + 0.014, -A);
      if (o.spur) {
        // Sporn: Buegel um die Ferse, kurzer Hals mit Raedchen / spur: band around the heel, short neck with a rowel
        const sp: THREE.Vector3[] = [];
        for (let i = 0; i <= 8; i++) { const a = -1.9 + (i / 8) * 3.8; sp.push(rig.point(fb, [Math.sin(a) * 0.062, -A + 0.062, -0.03 - Math.cos(a) * 0.068])); }
        b.add(limb(sp, () => 0.008, { seg: 8, step: 0.012, region: b.blank, out: rig.dir(fb, [0, 1, 0]), color: o.spur }), null, { crease: 0.8, gloss: 0.7 });
        b.add(limb([rig.point(fb, [0, -A + 0.062, -0.095]), rig.point(fb, [0, -A + 0.066, -0.135])], (d) => 0.007 + 0.012 * gauss(d - 0.036, 0.008), { seg: 8, step: 0.006, region: b.blank, out: rig.dir(fb, [0, 1, 0]), color: o.spur, cap1: 0.004 }), null, { crease: 0.8, gloss: 0.7 });
      }
    });
  }
}

/** Querschnitt des Rumpfs unter dem Brustkorb: [y, halbe Breite, halbe Tiefe, Mitte z, Eckigkeit] / cross-section of the trunk below the rib cage */
export type TrunkRow = [number, number, number, number, number];
export interface TrunkOpts {
  region: Region; color: ColorLike;
  rows: TrunkRow[];
  /** Spalten rundum (die Bueste hat 88) / columns around (the bust has 88) */
  cols?: number;
  /** Hoehe des Koppels: darunter folgt der Rockschoss den Schenkeln / belt height: below it the skirt follows the thighs */
  beltY: number;
  /** Anteil, mit dem der Saum dem Schenkel folgt / share by which the hem follows the thigh */
  follow?: number;
  crease?: number;
}
/** Punkt des Rumpfquerschnitts: Winkel a (0 = +x, PI/2 = vorn) / point of the trunk's cross-section: angle a (0 = +x, PI/2 = front) */
export function trunkPoint(rows: TrunkRow[], a: number, y: number): THREE.Vector3 {
  const f = curve(rows.slice().sort((p, q) => p[0] - q[0]));
  const [w, d, cz, e] = f(y);
  const ca = Math.cos(a), sa = Math.sin(a);
  const k = 1 / Math.pow(Math.pow(Math.abs(ca), e) + Math.pow(Math.abs(sa), e), 1 / e);
  return new THREE.Vector3(ca * k * w, y, sa * k * d + cz);
}
/** Gewichte des Rumpfs: Wirbelkette nach der Hoehe, unter dem Koppel folgt der Rockschoss dem Schenkel seiner Seite / weights of the trunk */
export function trunkSkin(H: Human, beltY: number, hemY: number, follow = 0.8): SkinFn {
  const spine = H.sk.chain(['root', 'spine', 'chest', 'neck', 'head'], [0.07, 0.07, 0.07, 0.045, 0.05]);
  const L = H.rig.id('legL'), R = H.rig.id('legR');
  return (p) => {
    if (p.y > beltY - 0.05) return spine(p);
    const w = follow * smooth(beltY - 0.05, hemY, p.y) * smooth(0.02, 0.16, Math.abs(p.x)) * (p.z > -0.02 ? 1 : 0.75);
    return [p.x > 0 ? L : R, w, 0];
  };
}
/**
 * Rumpf unter dem Brustkorb (Rock der Uniform bis zum Saum): schliesst oben genau an den Oberkoerper der Bueste an
 * (gleiche Spalten), unten ein nach innen umgeschlagener Saum. UV: s rundum (0.5 = vorn, Naht hinten), t von oben
 * nach unten.
 * Trunk below the rib cage (the uniform's coat down to the hem): joins the bust's torso exactly at the top (same
 * columns), with a hem turned inward at the bottom. uv: s around (0.5 = front, seam at the back), t from top to bottom.
 */
export function trunk(H: Human, o: TrunkOpts): void {
  const { b, sk } = H;
  const rows = o.rows.slice().sort((p, q) => q[0] - p[0]);
  const top = rows[0][0], hem = rows[rows.length - 1][0];
  const n = Math.max(8, Math.round(((top - hem) / 0.02) * lod()));
  // u laeuft so, dass s = 0.5 vorn liegt: a = 1.5 PI - 2 PI u / u runs so that s = 0.5 is the front
  const ang = (u: number) => 1.5 * Math.PI - u * 2 * Math.PI;
  sk.part(trunkSkin(H, o.beltY, hem, o.follow), () => {
    b.add(outward(sheet((u, v) => trunkPoint(o.rows, ang(u), top + (hem - top) * v), { nu: o.cols ?? 88, nv: n, region: o.region, closedU: true, color: o.color })), null, { crease: o.crease ?? 0.6 });
    // Saum: Unterseite nach innen / hem: underside turned inward
    b.add(outward(sheet((u, v) => { const p = trunkPoint(o.rows, ang(u), hem); p.x *= 1 - 0.12 * v; p.z *= 1 - 0.12 * v; p.y += 0.012 * v; return p; },
      { nu: o.cols ?? 88, nv: 2, region: b.blank, closedU: true, color: o.color }), new THREE.Vector3(0, -1, 0)), null, { crease: 1 });
  });
}
/** Punkt und Normale vorn auf dem Rumpf bei Modellkoordinate (x, y) / point and normal on the trunk's front at model coordinate (x, y) */
export function trunkAt(rows: TrunkRow[], x: number, y: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  let lo = 0.02, hi = Math.PI - 0.02;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (trunkPoint(rows, mid, y).x > x) lo = mid; else hi = mid; }
  const a = (lo + hi) / 2, p = trunkPoint(rows, a, y);
  const du = trunkPoint(rows, a + 0.01, y).sub(trunkPoint(rows, a - 0.01, y)), dv = trunkPoint(rows, a, y + 0.01).sub(trunkPoint(rows, a, y - 0.01));
  const n = new THREE.Vector3().crossVectors(dv, du).normalize();
  if (n.z < 0) n.negate();
  return { p, n };
}
/** Guertel um den Rumpf: Band mit harter Kante, etwas abgehoben / belt around the trunk: a band with a hard edge, slightly raised */
export function belt(H: Human, rows: TrunkRow[], y0: number, y1: number, region: Region, color: ColorLike, lift = 0.012, gloss = 0.35): void {
  const { b, sk } = H;
  const ang = (u: number) => 1.5 * Math.PI - u * 2 * Math.PI;
  sk.part(trunkSkin(H, (y0 + y1) / 2 - 1, -9), () => {
    const prof: [number, number][] = [[y1 + 0.004, 0.002], [y1, lift], [y0, lift], [y0 - 0.004, 0.002]];
    for (let i = 0; i < 3; i++) {
      const [ya, la] = prof[i], [yb, lb] = prof[i + 1];
      const g = (sheet((u, v) => {
        const y = ya + (yb - ya) * v, p = trunkPoint(rows, ang(u), y), q = trunkPoint(rows, ang(u), y).setY(0);
        const l = la + (lb - la) * v, r = Math.hypot(q.x, q.z) || 1;
        p.x += (q.x / r) * l; p.z += (q.z / r) * l;
        return p;
      }, { nu: 88, nv: i === 1 ? 3 : 1, region: i === 1 ? region : b.blank, closedU: true, color }));
      b.add(i === 1 ? outward(g) : outward(g, new THREE.Vector3(0, i === 0 ? 1 : -1, 0)), null, { crease: 1, gloss });
    }
  });
}
