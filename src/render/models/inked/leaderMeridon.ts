/**
 * Gezeichnete Anfuehrerin der Meridon: die Kapitaenin und Entdeckerin.
 * Inked leader of the Meridon: the captain and explorer.
 *
 * Vorlage ist das Portraet des Spiels (public/leaders/img/meridon_neutral.webp): Frau mit breitkrempigem gruenem Hut,
 * darauf eine Messingbrille mit blauen Glaesern und bunte Federn (orange, weiss, tuerkis); blondes Haar mit schraeger
 * Stirnlocke und langem Zopf ueber der linken Schulter, Messing-Monokel vor dem rechten Auge, Ohrgehaenge mit
 * tuerkisem Stein; gruener Mantel mit hochgestelltem Kragen, weisser Hemdkragen, orangefarbenes Halstuch, Lederriemen
 * und das Medaillon mit der Kompassrose (Emblem der Fraktion).
 * The model is the game's portrait (public/leaders/img/meridon_neutral.webp): a woman with a wide-brimmed green hat,
 * brass goggles with blue lenses and coloured feathers (orange, white, teal) on it; blonde hair with a slanted fringe
 * and a long braid over the left shoulder, a brass monocle in front of the right eye, earrings with a teal stone; a
 * green coat with a raised collar, a white shirt collar, an orange neckerchief, a leather strap and the medallion with
 * the compass rose (the faction's emblem).
 */
import * as THREE from 'three';
import { fine, mix, shade, type V3 } from '../kit';
import { look, mat } from '../look';
import { Sculpt } from '../sculpt';
import { arc, spline, type Cell, type Pen, type Pt } from './atlas';
import { paintEmblem } from './emblem';
import { aimZ } from './figkit';
import { chestAt, chestMap, earGeometry, faceMap, gemDome, headGeometry, onFace, polyPlate, revolve, revolveAt, scalpMap, sheet, stud, torsoGeometry, torsoShell, tube, type TorsoSpec } from './leaderKit';
import type { LeaderDef } from './leaders';
import { bodyCells, drawBrow, drawEye, drawMouth, drawNose, fold, goldDisc, leaf, lineScale, shadow, strands, wrinkle, type MoodArt } from './leaderPaint';
import { loft, ribbon, type AtlasLayout, type UvBuilder } from './uvkit';

const L = look('meridon');
const SKIN = shade(mix(mat.skin, mat.orange, 0.16), 1);
const HAIR = mix(mat.gold, mat.sand, 0.42);
const HAIR_DARK = shade(mix(mat.gold, mat.wood, 0.35), 0.82);
const GREEN = shade(mix(L.primary, mat.green, 0.5), 0.5);
const GREEN_LIGHT = shade(mix(L.primary, mat.green, 0.5), 0.72);
const BRASS = mix(mat.gold, mat.wood, 0.28);
const BRASS_DARK = shade(BRASS, 0.6);
const BRASS_LIGHT = mix(BRASS, mat.white, 0.55);
const LEATHER = mat.wood;
const LENS = mix(mat.blue, mat.glass, 0.45);
const ORANGE = L.secondary;
const LIPS = mix(mat.red, mat.wood, 0.42);
const EYE = mix(mat.teal, mat.blue, 0.45);
/** Glas des Monokels: faengt das Licht (leuchtet leicht) / the monocle's glass: catches the light (glows slightly) */
const LENS_GOLD = mix(mat.lamp, mat.white, 0.4);

const T: TorsoSpec = { w: 0.44, d: 0.21, h: 0.335, slope: 0.095, neckR: 0.1, rise: 0.055, square: 0.26, z: -0.01, chest: 0.024 };
const HEAD_C: V3 = [0, 0.645, 0.03], HEAD_R: V3 = [0.18, 0.198, 0.176];
const MOUTH = { y: -0.55, w: 0.2 };

function sculpt(m: MoodArt): Sculpt {
  return new Sculpt(HEAD_C, HEAD_R, {
    jaw: 0.28, chin: 0.13, chinDown: 0.04 + m.open * 0.05, lowY: 0.02 + m.open * 0.06, socket: 0.07, brow: 0.035, cheek: 0.1, temple: 0.04,
    noseBridge: 0.07, noseLen: 0.21, noseW: 0.88, noseY: -0.24, lipU: 0.05, lipL: 0.065, mouthDepth: 0.012 + 0.04 * m.open, mouthW: MOUTH.w * 2, mouthY: MOUTH.y,
    smile: 0.03 + m.smile, asym: 0.02 + m.asym, fold: 0.008, eyeY: 0.1, eyeX: 0.36, flat: 0.1, frownGeo: m.frown * 0.6,
  });
}

// ---------- Hut / hat ----------

const HAT_Y = 0.772;
/** Profil [Radius, Hoehe]: Unterseite der Krempe nach aussen, Oberseite zurueck, Krone / profile [radius, height]: underside of the brim outward, top side back, crown */
const HAT: [number, number][] = ([
  [0.15, 0.012], [0.27, -0.012], [0.405, -0.062], [0.418, -0.056], [0.4, -0.046],
  [0.29, 0.006], [0.2, 0.026], [0.192, 0.034],
  [0.19, 0.09], [0.184, 0.14], [0.166, 0.18], [0.122, 0.204], [0.06, 0.214], [1e-4, 0.216],
] as [number, number][]).map(([r, y]) => [r, HAT_Y + y]);
const HAT_O = { centre: [0, 0.014] as [number, number], front: 1.04, tilt: () => -0.07, pivot: [HAT_Y, 0] as [number, number] };

function hat(b: UvBuilder, A: AtlasLayout): void {
  const seg = fine() ? 64 : 32;
  const part = (i0: number, i1: number, cellName: string, sub: number, c: THREE.Color, crease = 1) => b.add(revolve(HAT.slice(i0, i1 + 1), { ...HAT_O, seg, sub: fine() ? sub : Math.max(1, sub - 1), region: A.get(cellName), mirror: true, color: c }), null, { crease });
  part(0, 2, 'brimUnder', 3, shade(GREEN, 0.62));
  part(2, 4, 'blank', 1, GREEN);
  part(4, 7, 'brim', 3, GREEN);
  part(7, 13, 'crown', 2, GREEN);
  // Brille auf dem Hut: zwei Messingtoepfe mit blauen Glaesern, Steg mit Spitze / goggles on the hat: two brass cups with blue lenses, bridge with a finial
  const k = 8.55;
  for (const s of [-1, 1]) {
    const p0 = revolveAt(HAT, HAT_O, 0.5 + s * 0.075, k), n = new THREE.Vector3(s * 0.34, 0.2, 1).normalize();
    b.add(loft([{ y: 0, rx: 0.066, c: BRASS }, { y: 0.04, rx: 0.063, hard: true }, { y: 0.044, rx: 0.052, hard: true }, { y: 0.036, rx: 0.05 }], { seg: fine() ? 20 : 12, region: A.get('blank') }), null, { gloss: 0.6, crease: 0.9, xf: { p: [p0.x - n.x * 0.012, p0.y - n.y * 0.012, p0.z - n.z * 0.012], r: aimY(n) } });
    stud(b, A, p0.clone().addScaledVector(n, 0.028), n, 0.051, 0.004, 'lensBlue', LENS, 0.15, 18);
  }
  const mid = revolveAt(HAT, HAT_O, 0.5, k + 0.25), nf = new THREE.Vector3(0, 0.25, 1).normalize();
  b.add(polyPlate([[-0.03, -0.022], [0.03, -0.022], [0.03, 0.022], [0, 0.04], [-0.03, 0.022]], 0.03, A.get('blank'), BRASS, BRASS_DARK), null, { gloss: 0.6, crease: 1, xf: { p: [mid.x, mid.y, mid.z - 0.004], r: aimZ([nf.x, nf.y, nf.z]) } });
  b.add(loft([{ y: 0.052, rx: 1e-7, c: BRASS }, { y: 0.03, rx: 0.011 }, { y: 0.016, rx: 0.006 }, { y: 0.008, rx: 0.014 }, { y: 0, rx: 0.014 }], { seg: 8, region: A.get('blank') }), null, { gloss: 0.6, crease: 0.5, xf: { p: [mid.x, mid.y + 0.034, mid.z + 0.012] } });
  // Federn an der linken Hutseite (im Bild rechts): orange, weiss, tuerkis / feathers at the left side of the hat (right in the picture): orange, white, teal
  const feathers: { c: THREE.Color; len: number; dir: V3; bend: V3; w: number; root: V3 }[] = [
    { c: mat.paper, len: 0.3, dir: [0.42, 0.9, -0.1], bend: [0.3, -0.25, -0.2], w: 0.05, root: [0.16, 0.865, 0.06] },
    { c: ORANGE, len: 0.33, dir: [0.75, 0.62, -0.2], bend: [0.25, -0.4, -0.2], w: 0.062, root: [0.172, 0.85, 0.04] },
    { c: L.primary, len: 0.26, dir: [0.92, 0.3, -0.25], bend: [0.1, -0.45, -0.2], w: 0.052, root: [0.18, 0.84, 0.0] },
  ];
  for (const f of feathers) {
    const d = new THREE.Vector3(...f.dir).normalize(), bd = new THREE.Vector3(...f.bend), r0 = new THREE.Vector3(...f.root);
    const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1)).normalize();
    b.add(sheet((u, v) => {
      const w = f.w * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + v * 0.9)), 0.6) * (1 - 0.35 * v);
      return r0.clone().addScaledVector(d, f.len * v).addScaledVector(bd, f.len * 0.32 * v * v).addScaledVector(side, (u - 0.5) * 2 * w).add(new THREE.Vector3(0, 0, -0.03 * Math.abs(2 * u - 1) ** 2));
    }, { nu: 4, nv: fine() ? 12 : 6, region: A.get('feather'), thick: 0.005, color: f.c, backColor: shade(f.c, 0.7), st: (u, v) => [v, u] }), null, { crease: 0.8 });
  }
}
/** Rotations-Euler, der +y auf n dreht / Euler rotation turning +y onto n */
function aimY(n: THREE.Vector3): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

// ---------- Aufbau / build ----------

const MEDAL: [number, number] = [-0.165, 0.105];

function build(b: UvBuilder, A: AtlasLayout, m: MoodArt): void {
  const S = sculpt(m);
  b.add(torsoGeometry(T, { chest: A.get('chest'), back: A.get('back'), side: A.get('side'), top: A.get('top'), blank: A.get('blank') }, GREEN), null, { crease: 0.6 });
  b.add(loft([{ y: 0.6, rx: 0.072, cz: 0.0, c: SKIN }, { y: 0.48, rx: 0.075, cz: -0.004 }, { y: 0.33, rx: 0.088, cz: -0.01 }], { seg: fine() ? 28 : 14, region: A.get('neck') }), null, { crease: 0 });
  // hochgestellter Mantelkragen: hinten geschlossen, vorn offen mit Spitzen / raised coat collar: closed at the back, open at the front with points
  b.add(sheet((u, v) => {
    const a = (u - 0.5) * 5.1, front = Math.pow(Math.abs(2 * u - 1), 2.2);
    const r = 0.128 + (0.06 + 0.03 * front) * v;
    return new THREE.Vector3(-Math.sin(a) * r * 1.06, 0.345 + (0.155 - 0.055 * front) * v + 0.02 * front, -0.012 - Math.cos(a) * r * 0.94);
  }, { nu: fine() ? 40 : 20, nv: fine() ? 6 : 3, region: A.get('collar'), back: A.get('collarIn'), thick: 0.012, color: GREEN, backColor: GREEN_LIGHT, st: (u, v) => [Math.abs(2 * u - 1), 1 - v] }), null, { crease: 0.9 });
  // weisser Hemdkragen: zwei Spitzen / white shirt collar: two points
  for (const s of [-1, 1]) {
    const q = chestAt(T, s * 0.048, 0.33), n = q.n.clone().add(new THREE.Vector3(s * 0.25, 0.5, 0.2)).normalize();
    b.add(polyPlate([[-s * 0.01, 0.045], [s * 0.045, 0.034], [s * 0.03, -0.05], [-s * 0.016, -0.008]], 0.008, A.get('shirt'), mat.paper, shade(mat.paper, 0.7)), null, { crease: 1, xf: { p: [q.p.x, q.p.y + 0.035, q.p.z + 0.012], r: aimZ([n.x, n.y, n.z]) } });
  }
  // Halstuch: Wulst um den Hals, Knoten, zwei Zipfel / neckerchief: roll around the neck, knot, two tails
  {
    const ring: V3[] = [];
    for (let i = 0; i <= 8; i++) { const a = -1.5 + (i / 8) * 3; ring.push([Math.sin(a) * 0.105, 0.385 - 0.06 * Math.cos(a), -0.005 + Math.cos(a) * 0.112]); }
    b.add(tube(ring, (t) => [0.02 + 0.016 * Math.sin(Math.PI * t), 0.034 + 0.026 * Math.sin(Math.PI * t)], { seg: fine() ? 10 : 6, samples: fine() ? 18 : 9, region: A.get('scarf'), out: (t) => { const a = -1.5 + t * 3; return new THREE.Vector3(Math.sin(a), 0.2, Math.cos(a)); }, front: true, color: ORANGE }), null, { crease: 0.5 });
    b.add(loft([{ y: 0.03, rx: 1e-7, c: ORANGE }, { y: 0.022, rx: 0.024 }, { y: 0, rx: 0.034 }, { y: -0.024, rx: 0.026 }, { y: -0.034, rx: 1e-7 }], { seg: fine() ? 12 : 8, region: A.get('blank') }), null, { crease: 0, xf: { p: [0.004, 0.3, 0.135], s: [1.5, 1.25, 0.9] } });
    // Tuch: Dreieck ueber der Brust, folgt dem Koerper / cloth: a triangle over the chest, following the body
    b.add(sheet((u, v) => {
      const half = 0.105 * (1 - v) ** 0.8 + 0.006, q = chestAt(T, (2 * u - 1) * half + 0.01 * Math.sin(v * 5), 0.305 - 0.25 * v);
      return q.p.addScaledVector(q.n, 0.03 - 0.012 * v + 0.012 * Math.cos((2 * u - 1) * Math.PI * 1.5) * (1 - v));
    }, { nu: fine() ? 10 : 5, nv: fine() ? 10 : 5, region: A.get('scarfDrape'), back: A.get('blank'), thick: 0.01, flip: true, color: ORANGE, backColor: shade(ORANGE, 0.6) }), null, { crease: 0.9 });
  }

  b.add(headGeometry(S, { skin: SKIN, face: A.get('face'), scalp: A.get('scalp'), cut: (p) => p.y > 0.74 }), null, { crease: 0 });
  b.mirrorX(() => {
    b.group({ p: S.dir([1, -0.06, -0.06], -0.03), r: [0, -0.5, 0.06] }, () => b.add(earGeometry(A.get('ear'), 0.056, SKIN), null, { crease: 0.5 }));
    // Ohrgehaenge: Goldperle und tuerkiser Stein in Rautenform / earring: gold bead and a teal stone cut as a lozenge
    const lobe = new THREE.Vector3(...S.dir([0.97, -0.33, 0.12], 0.02));
    gemDome(b, A, lobe.clone().add(new THREE.Vector3(0, -0.004, 0)), new THREE.Vector3(0, -1, 0), 0.008, 0.012, BRASS, 0.7);
    b.add(loft([{ y: 0, rx: 1e-7, c: mix(L.primary, mat.glass, 0.35) }, { y: -0.026, rx: 0.02, hard: true }, { y: -0.058, rx: 1e-7 }], { seg: 4, region: A.get('blank') }), null, { gloss: 1, crease: 1, xf: { p: [lobe.x, lobe.y - 0.014, lobe.z], r: [0, 0.6, 0], s: [1, 1, 0.5] } });
  });

  // Haar: schraege Stirnlocke von rechts oben nach links unten, Seitenstraehnen / hair: slanted fringe from the upper right to the lower left, side locks
  const lock = (pts: [number, number, number][], rn: number, rb: number, out: V3, cellName = 'lock') => {
    const path = pts.map(([x, y, l]) => onFace(S, x, y, l));
    b.add(tube(path.map((q): V3 => [q.x, q.y, q.z]), (t) => { const k = Math.sin(Math.PI * Math.min(1, 0.22 + t * 0.7)) * (1 - Math.pow(t, 3)); return [0.003 + rn * k, 0.004 + rb * k]; },
      { seg: fine() ? 10 : 6, samples: fine() ? 18 : 9, region: A.get(cellName), out, front: true, color: HAIR }), null, { crease: 0.5 });
  };
  lock([[0.44, 0.64, 0.02], [0.12, 0.56, 0.06], [-0.3, 0.48, 0.07], [-0.64, 0.32, 0.07], [-0.84, 0.04, 0.06], [-0.9, -0.3, 0.04]], 0.02, 0.06, [-0.2, 0.2, 1]);
  lock([[-0.5, 0.62, 0.03], [-0.8, 0.3, 0.07], [-0.93, -0.1, 0.07], [-0.9, -0.5, 0.06], [-0.78, -0.78, 0.04]], 0.022, 0.07, [-0.9, 0, 0.5]);
  lock([[0.5, 0.62, 0.03], [0.76, 0.4, 0.06], [0.92, 0.08, 0.07], [0.95, -0.25, 0.06], [0.9, -0.48, 0.04]], 0.022, 0.07, [0.9, 0, 0.5]);
  // Zopf ueber die linke Schulter (im Bild rechts) / braid over the left shoulder (right in the picture)
  {
    const start = new THREE.Vector3(...S.dir([0.93, -0.3, -0.05], 0.05));
    const pts: V3[] = [[start.x, start.y, start.z], [0.215, 0.5, 0.06], [0.235, 0.41, 0.12], [0.225, 0.3, 0.2], [0.21, 0.19, 0.232], [0.2, 0.08, 0.232], [0.195, 0.0, 0.225]];
    b.add(tube(pts, (t) => { const r = 0.038 * (1 + 0.16 * Math.abs(Math.sin(t * Math.PI * 7))) * (t > 0.9 ? 0.55 + 0.45 * (1 - (t - 0.9) / 0.1) : 1) * (0.7 + 0.3 * Math.min(1, t * 6)); return [r * 0.8, r]; },
      { seg: fine() ? 12 : 8, samples: fine() ? 56 : 24, region: A.get('braid'), out: [0.25, 0.1, 1], front: true, color: HAIR }), null, { crease: 0.5 });
    // Zopfband / hair tie
    b.add(tube([[0.197, 0.04, 0.228], [0.196, 0.018, 0.226]], () => 0.031, { seg: fine() ? 10 : 6, samples: 2, region: A.get('blank'), color: ORANGE }), null, { crease: 0.6 });
  }
  // Monokel vor dem rechten Auge (im Bild links): Messingring, Glas, Buegel zur Schlaefe
  // monocle in front of the right eye (left in the picture): brass ring, glass, bracket to the temple
  {
    const c = onFace(S, -0.37, 0.1, 0.1), n = new THREE.Vector3(-0.12, 0, 1).normalize();
    const e1 = new THREE.Vector3(1, 0, 0.12).normalize(), e2 = new THREE.Vector3(0, 1, 0);
    const ring: V3[] = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; const q = c.clone().addScaledVector(e1, Math.cos(a) * 0.058).addScaledVector(e2, Math.sin(a) * 0.058); ring.push([q.x, q.y, q.z]); }
    b.add(tube(ring, () => 0.011, { seg: fine() ? 8 : 5, samples: fine() ? 32 : 16, region: A.get('blank'), color: BRASS }), null, { gloss: 0.7, crease: 0.4 });
    stud(b, A, c.clone().addScaledVector(n, -0.004), n, 0.053, 0.004, 'lensGold', LENS_GOLD, 0.15, 18);
    const t0 = c.clone().addScaledVector(e1, -0.058), t1 = new THREE.Vector3(...S.dir([-0.9, 0.2, 0.42], 0.03));
    b.add(tube([[t0.x, t0.y, t0.z], [(t0.x + t1.x) / 2 - 0.01, t0.y + 0.012, (t0.z + t1.z) / 2 + 0.01], [t1.x, t1.y, t1.z]], () => 0.007, { seg: 5, samples: 6, region: A.get('blank'), color: BRASS }), null, { gloss: 0.6, crease: 0.4 });
    gemDome(b, A, c.clone().addScaledVector(e2, -0.06).addScaledVector(n, 0.004), n, 0.012, 0.01, BRASS, 0.7);
  }
  hat(b, A);

  // Schulterklappen mit Goldstickerei / shoulder caps with gold embroidery
  b.mirrorX(() => {
    b.add(torsoShell(T, (u, v) => [0.8 - u * 1.6, 0.9 - 0.36 * v, 0.014 + 0.012 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)],
      { nu: fine() ? 12 : 6, nv: fine() ? 6 : 3, region: A.get('shoulder'), back: A.get('blank'), thick: 0.012, flip: true, color: GREEN_LIGHT, backColor: shade(GREEN, 0.6) }), null, { crease: 0.9 });
  });
  // Lederriemen quer ueber die Brust, Medaillon mit Kompassrose / leather strap across the chest, medallion with the compass rose
  {
    const path = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; path.push(chestAt(T, -0.37 + 0.3 * t, 0.3 - 0.3 * t)); }
    b.add(ribbon(path, 0.022, A.get('strap'), 0.006), LEATHER, { crease: 1 });
    const q = chestAt(T, MEDAL[0], MEDAL[1]);
    stud(b, A, q.p.clone().addScaledVector(q.n, 0.006), q.n, 0.07, 0.012, 'medallion', BRASS, 0.6, 22);
    gemDome(b, A, q.p.clone().addScaledVector(q.n, 0.02), q.n, 0.012, 0.008, mix(L.primary, mat.glass, 0.35), 1);
  }
}

// ---------- Zeichnung / drawing ----------

function paintFace(p: Pen, m: MoodArt): void {
  const M = faceMap(p.w, p.h), P = M.P, lw = lineScale(M.u(1) / HEAD_R[0]);
  // Schlagschatten der Krempe ueber Stirn und Augen: harte Kante / cast shadow of the brim over forehead and eyes: hard edge
  p.shade(spline([P(-0.95, 0.22), P(-0.5, 0.33), P(0, 0.36), P(0.5, 0.33), P(0.95, 0.22)], 6).concat([P(0.95, 0.95), P(-0.95, 0.95)]), 0.84, 0.95);
  shadow(p, M, [[0.34, -0.26], [0.48, -0.14], [0.56, -0.32], [0.46, -0.56], [0.3, -0.76], [0.27, -0.52]], 0.84, 0.9, false);
  shadow(p, M, [[-0.4, -0.3], [-0.5, -0.2], [-0.55, -0.36], [-0.44, -0.6], [-0.33, -0.72]], 0.9, 0.9, false);
  shadow(p, M, [[0.09, 0.19], [0.3, 0.225], [0.54, 0.2], [0.58, 0.12], [0.3, 0.17], [0.12, 0.13]], 0.82, 0.9);
  for (const s of [-1, 1]) { const c = P(s * 0.42, -0.2); p.dab(c[0], c[1], M.u(0.16), [1.08, 0.84, 0.8], 0.55); }
  shadow(p, M, [[-0.13, -0.68], [0, -0.695], [0.13, -0.68], [0.09, -0.735], [0, -0.75], [-0.09, -0.735]], 0.82, 0.9, false);
  p.gradient(0, P(0, -0.82)[1], p.w, p.h - P(0, -0.82)[1], P(0, -0.82), P(0, -1), 1, 0.68);
  // Haaransatz: blond ueber der Stirn und an den Schlaefen / hairline: blonde above the forehead and at the temples
  const line = spline([P(-0.95, -0.2), P(-0.8, 0.2), P(-0.56, 0.44), P(-0.2, 0.53), P(0.2, 0.56), P(0.56, 0.44), P(0.78, 0.2), P(0.95, -0.25)], 8);
  p.fill([...line, P(0.95, 0.95), P(-0.95, 0.95)], HAIR);
  p.line(line, lw(1.6), { taper: 0.1, wobble: 0.5 });
  strands(p, line, line.map((q): Pt => [q[0], q[1] - M.u(0.3)]), 6, lw(1.1), 53, { from: 0.1, to: 0.9 });
  if (m.frown > 0.5) wrinkle(p, M, [[0.045, 0.19 + m.browIn(1) * 0.4], [0.06, 0.25], [0.05, 0.3]], lw(1.6));
  for (const s of [-1, 1] as const) {
    drawEye(p, M, s, {
      x: 0.36, y: 0.1, w: 0.17, h: 0.09, tilt: 0.1, upper: 0.24 + m.upper(s), lower: 0.1 + m.lower(s), iris: EYE, irisR: 0.08 * m.iris,
      look: [0, 0.03], crease: 0.03, lid: 4.4, wing: 0.045, lashes: 3, shadow: mix(SKIN, mat.wood, 0.4),
    }, lw);
    drawBrow(p, M, s, { x0: 0.09, y0: 0.215 + m.browIn(s), x1: 0.62, y1: 0.285 + m.browOut(s) + (s > 0 ? 0.02 : 0), arch: 0.04, thick: 0.055, colour: HAIR_DARK, strands: 2, seed: 61 + s }, lw);
  }
  drawNose(p, M, { y: -0.24, w: 0.88, top: 0.15, shade: 0.85 }, lw);
  drawMouth(p, M, { y: MOUTH.y, w: MOUTH.w, smile: 0.03 + m.smile, asym: 0.02 + m.asym, lipU: 0.046, lipL: 0.062, colour: LIPS, shine: 0.5, open: m.open * 0.75, line: 2.8 }, lw);
  wrinkle(p, M, [[-0.07, -0.85], [0, -0.865], [0.07, -0.85]], lw(1.2), false);
  // Sommersprosse? nein: ein kleiner Schoenheitsfleck an der Wange / no freckles: one small beauty mark on the cheek
  { const c = P(0.5, -0.12); p.dot(c[0], c[1], lw(1.3)); }
}

function paintScalp(p: Pen): void {
  const B = scalpMap(p.w, p.h), lw = lineScale((p.w / 4.36) / HEAD_R[0]);
  p.fill([[-6, -6], [p.w + 6, -6], [p.w + 6, p.h + 6], [-6, p.h + 6]], HAIR);
  for (let i = 0; i < 9; i++) {
    const a = -1.8 + (i / 8) * 3.6;
    const pts: Pt[] = [];
    for (const y of [0.6, 0.3, 0.0, -0.35, -0.6]) { const c = Math.sqrt(1 - y * y); pts.push(B(Math.sin(a + y * 0.1) * c, y, -Math.cos(a + y * 0.1) * c)); }
    p.line(spline(pts, 4), lw(1.2), { taper: 0.42, wobble: 0.5 });
  }
  const band: Pt[] = [];
  for (let i = 0; i <= 26; i++) { const a = -2.2 + (i / 26) * 4.4, y = 0.5, c = Math.sqrt(1 - y * y); band.push(B(Math.sin(a) * c, y, -Math.cos(a) * c)); }
  p.shade([...band, [band[26][0], -6], [band[0][0], -6]], 0.7, 0.9);
}

/** Haarlocke (s vom Ansatz zur Spitze, t rundum): Schatten unten, Licht oben, wenige Straehnen / lock of hair (s from root to tip, t around): shade below, light on top, a few strands */
function paintLock(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.3);
  p.shade([[0, H * 0.68], [W, H * 0.62], [W, H + 3], [0, H + 3]], 0.76, 0.95);
  p.shade(spline([[W * 0.1, H * 0.2], [W * 0.4, H * 0.13], [W * 0.7, H * 0.2], [W * 0.66, H * 0.3], [W * 0.4, H * 0.25], [W * 0.12, H * 0.31]], 5, true), 1.3, 0.8);
  for (const [x0, y0, x1, y1, w] of [[0.03, 0.4, 0.8, 0.44, 1.5], [0.1, 0.62, 0.9, 0.54, 1.2], [0.25, 0.82, 0.7, 0.7, 1.3], [0.4, 0.12, 0.95, 0.4, 1.1]]) p.line(spline([[W * x0, H * y0], [W * (x0 + x1) / 2, H * ((y0 + y1) / 2 + 0.04)], [W * x1, H * y1]], 6), lw(w), { taper: 0.44, wobble: 0.5, press: 0.35 });
}

/** Zopf (s entlang, t rundum): gekreuzte Straenge als Boegen, je Strang ein Glanz / braid (s along, t around): crossing strands as arcs, a shine per strand */
function paintBraid(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.62);
  const n = 7, seg = W / n;
  p.shade([[0, H * 0.72], [W, H * 0.72], [W, H + 3], [0, H + 3]], 0.76, 0.95);
  for (let i = 0; i < n; i++) {
    const x0 = i * seg;
    // zwei Straenge je Abschnitt, die sich in der Mitte kreuzen / two strands per section crossing in the middle
    p.line(spline([[x0, H * 0.06], [x0 + seg * 0.5, H * 0.34], [x0 + seg * 0.96, H * 0.56]], 5), lw(2.3), { taper: 0.2, wobble: 0.3 });
    p.line(spline([[x0 + seg * 0.5, H * 0.96], [x0 + seg * 0.8, H * 0.72], [x0 + seg * 1.04, H * 0.5]], 5), lw(2.3), { taper: 0.2, wobble: 0.3 });
    p.shade(spline([[x0 + seg * 0.18, H * 0.3], [x0 + seg * 0.5, H * 0.42], [x0 + seg * 0.84, H * 0.6], [x0 + seg * 0.5, H * 0.56]], 4, true), 0.8, 0.8);
    p.shade(spline([[x0 + seg * 0.3, H * 0.14], [x0 + seg * 0.52, H * 0.2], [x0 + seg * 0.62, H * 0.3], [x0 + seg * 0.4, H * 0.24]], 4, true), 1.35, 0.8);
  }
}

/** Krempe oben (gespiegelt, t vom Rand zur Krone): Rand, Naht, Wellen / brim top (mirrored, t from the edge to the crown): edge, seam, waves */
function paintBrim(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.25);
  p.gradient(0, H * 0.6, W, H * 0.4, [0, H * 0.6], [0, H], 1, 0.74);
  p.stitch([[0, H * 0.16], [W, H * 0.16]], 5, 4, 1.2, 1.5);
  p.line([[-3, H * 0.07], [W + 3, H * 0.07]], lw(1.2), { taper: 0, wobble: 0.3 });
  fold(p, spline([[W * 0.3, H * 0.2], [W * 0.33, H * 0.5], [W * 0.31, H * 0.8]], 5), lw(1.2), 7, 0.86);
  fold(p, spline([[W * 0.66, H * 0.2], [W * 0.68, H * 0.55], [W * 0.66, H * 0.85]], 5), lw(1.2), -7, 0.86);
  p.fill(spline([[W * 0.1, H * 0.3], [W * 0.26, H * 0.26], [W * 0.24, H * 0.44], [W * 0.1, H * 0.48]], 4, true), mat.white, 0.1);
}
/** Krempe unten (gespiegelt, t von der Krone zum Rand): im Schatten, Naht am Rand / brim underside (mirrored, t from the crown to the edge): in shade, seam at the edge */
function paintBrimUnder(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.25);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.7, 1.04);
  p.line([[-3, H * 0.9], [W + 3, H * 0.9]], lw(1.2), { taper: 0, wobble: 0.3 });
}
/** Hutkrone (gespiegelt, t vom Band zum Scheitel): Lederband mit Schnallen, Kniff / hat crown (mirrored, t from the band to the top): leather band with buckles, pinch */
function paintCrown(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.6);
  p.gradient(0, H * 0.3, W, H * 0.7, [0, H * 0.3], [0, H], 1, 1.12);
  // Lederband der Brille um die Krone / the goggles' leather band around the crown
  p.band([[-4, H * 0.32], [W + 4, H * 0.32]], H * 0.2, LEATHER, lw(1.3));
  p.stitch([[0, H * 0.25], [W, H * 0.25]], 4, 3.2, 1, 0.6);
  for (const x of [0.36, 0.72]) {
    p.fill([[W * x - 9, H * 0.2], [W * x + 9, H * 0.2], [W * x + 9, H * 0.44], [W * x - 9, H * 0.44]], BRASS);
    p.line([[W * x - 9, H * 0.2], [W * x + 9, H * 0.2], [W * x + 9, H * 0.44], [W * x - 9, H * 0.44]], lw(1.2), { closed: true, wobble: 0.1 });
    p.dot(W * x, H * 0.32, lw(1.2));
  }
  p.line([[-3, H * 0.05], [W + 3, H * 0.05]], lw(1.3), { taper: 0, wobble: 0.3 });
  fold(p, spline([[W * 0.5, H * 0.48], [W * 0.53, H * 0.7], [W * 0.5, H * 0.92]], 5), lw(1.2), 6, 0.85);
  fold(p, spline([[W * 0.86, H * 0.5], [W * 0.88, H * 0.72], [W * 0.86, H * 0.9]], 5), lw(1.2), -6, 0.85);
}

function paintLens(p: Pen, c0: THREE.Color): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.1);
  p.spot(c, c, W * 0.5, c0);
  p.fill(arc(c, c, W * 0.5, W * 0.5, 0.2, Math.PI - 0.5, 14), shade(c0, 0.62));
  p.fill(spline([[W * 0.2, W * 0.38], [W * 0.3, W * 0.2], [W * 0.5, W * 0.14], [W * 0.46, W * 0.26], [W * 0.32, W * 0.36], [W * 0.27, W * 0.5]], 5, true), mat.white, 0.9);
  p.spot(W * 0.68, W * 0.7, W * 0.05, mat.white, 0.9);
  p.line(arc(c, c, W * 0.47, W * 0.47, 0, Math.PI * 2, 26), lw(1.5), { closed: true, wobble: 0.1 });
}

/** Feder (s vom Kiel zur Spitze, t quer): Kiel, wenige Einschnitte / feather (s from quill to tip, t across): quill, a few notches */
function paintFeather(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.3);
  p.shade([[0, H * 0.5], [W, H * 0.5], [W, H], [0, H]], 0.82, 0.9);
  p.line([[2, H * 0.5], [W - 4, H * 0.5]], lw(1.5), { taper: 0.2, wobble: 0.2 });
  for (const [x, up] of [[0.22, 1], [0.4, -1], [0.56, 1], [0.7, -1], [0.83, 1]] as [number, number][]) p.line([[W * x, H * 0.5], [W * (x + 0.08), H * (0.5 - up * 0.36)]], lw(1.1), { taper: 0.4, wobble: 0.3 });
}

/** Mantelkragen aussen (gespiegelt: x = 0 hinten, x = W Spitze vorn; t von der Oberkante zum Ansatz) / coat collar outside (mirrored: x = 0 back, x = W front point; t from the top edge to the base) */
function paintCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.6);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.08, 0.82);
  p.band([[-4, 6], [W + 4, 6]], 7, BRASS, lw(1.2));
  p.stitch([[0, 16], [W, 16]], 4, 3.2, 1, 0.6);
}
function paintCollarIn(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.6);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.05, 0.7);
  p.band([[-4, 6], [W + 4, 6]], 7, BRASS, lw(1.2));
  fold(p, spline([[W * 0.7, H * 0.2], [W * 0.74, H * 0.55], [W * 0.7, H * 0.9]], 4), lw(1.2), 5, 0.84);
}
function paintShirt(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.13);
  p.shade([[0, H * 0.6], [W, H * 0.5], [W, H], [0, H]], 0.86, 0.9);
  p.line([[W * 0.3, H * 0.2], [W * 0.5, H * 0.8]], lw(1.1), { taper: 0.4, wobble: 0.2 });
}
function paintScarf(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.3);
  p.shade([[0, H * 0.66], [W, H * 0.66], [W, H + 2], [0, H + 2]], 0.76, 0.95);
  for (const [x, d] of [[0.2, 1], [0.48, -1], [0.74, 1]] as [number, number][]) fold(p, spline([[W * x, H * 0.14], [W * (x + 0.05 * d), H * 0.5], [W * x, H * 0.86]], 4), lw(1.3), 5 * d, 0.84);
}

/** Halstuch ueber der Brust (s quer, t vom Knoten zur Spitze): Falten vom Knoten aus / neckerchief over the chest (s across, t from the knot to the point): folds from the knot */
function paintScarfDrape(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.21);
  p.shade([[0, 0], [W, 0], [W, H * 0.16], [0, H * 0.16]], 0.72, 0.9);
  fold(p, spline([[W * 0.44, H * 0.06], [W * 0.34, H * 0.4], [W * 0.42, H * 0.84]], 5), lw(1.4), 7, 0.82);
  fold(p, spline([[W * 0.58, H * 0.06], [W * 0.68, H * 0.36], [W * 0.56, H * 0.72]], 5), lw(1.4), -7, 0.82);
  fold(p, spline([[W * 0.3, H * 0.1], [W * 0.16, H * 0.3], [W * 0.22, H * 0.5]], 5), lw(1.2), 6, 0.84);
  p.shade([[W * 0.5, H * 0.2], [W, H * 0.2], [W, H], [W * 0.5, H]], 0.88, 0.9);
}

/** Medaillon: Messingscheibe, Kompassrose, Gradteilung als vier Kerben / medallion: brass disc, compass rose, graduation as four notches */
function paintMedallion(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.14);
  goldDisc(p, c, c, W * 0.49, lw(1.5), BRASS);
  p.spot(c, c, W * 0.385, BRASS_DARK);
  p.line(arc(c, c, W * 0.385, W * 0.385, 0, Math.PI * 2, 26), lw(1.3), { closed: true, wobble: 0.1 });
  paintEmblem(p, 'meridon', c, c, W * 0.34, BRASS_LIGHT, lw(1.1));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; p.dot(c + Math.cos(a) * W * 0.44, c + Math.sin(a) * W * 0.44, lw(1.1)); }
}

/** Riemen (s entlang): Naehte, Schnalle / strap (s along): stitching, buckle */
function paintStrap(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.42);
  p.stitch([[0, 5], [W, 5]], 4, 3.2, 1, 0.55);
  p.stitch([[0, H - 5], [W, H - 5]], 4, 3.2, 1, 0.55);
  const x = W * 0.3;
  p.fill([[x - 16, 2], [x + 16, 2], [x + 16, H - 2], [x - 16, H - 2]], BRASS);
  p.line([[x - 16, 2], [x + 16, 2], [x + 16, H - 2], [x - 16, H - 2]], lw(1.4), { closed: true, wobble: 0.1 });
  p.fill([[x - 8, 8], [x + 8, 8], [x + 8, H - 8], [x - 8, H - 8]], shade(LEATHER, 0.7));
  p.line([[x - 8, H / 2], [x + 12, H / 2]], lw(1.4), { taper: 0, wobble: 0 });
  for (const k of [0.56, 0.68, 0.8]) p.dot(W * k, H / 2, lw(1.2));
}

/** Schulterklappe (s von vorn nach hinten, t vom Hals nach aussen): Goldborte und Rankenstickerei / shoulder cap (s from front to back, t from the neck outward): gold trim and scroll embroidery */
function paintShoulder(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.4);
  p.shade([[0, 0], [W, 0], [W, H], [0, H]], 0.7, 1);
  p.band([[5, 4], [5, H - 6], [W - 5, H - 6], [W - 5, 4]], 9, BRASS, lw(1.2));
  const stem = spline([[W * 0.14, H * 0.62], [W * 0.3, H * 0.4], [W * 0.5, H * 0.5], [W * 0.7, H * 0.38], [W * 0.86, H * 0.56]], 6);
  p.mark(stem, lw(1.8), BRASS, 1, { taper: 0.2, wobble: 0.2 });
  for (const [x, y, dx, dy] of [[0.24, 0.48, 0.02, -0.26], [0.4, 0.44, 0.1, 0.24], [0.58, 0.44, 0.0, -0.26], [0.76, 0.44, 0.1, 0.22]]) leaf(p, [W * x, H * y], [W * (x + dx), H * (y + dy)], 8, BRASS, lw(1.1));
}

function paintChest(p: Pen): void {
  const C = chestMap(T, p.w, p.h), P = C.P, u = C.u, lw = lineScale(u(1));
  const top = T.h + T.rise;
  p.gradient(0, P(0, 0.11)[1], p.w, p.h - P(0, 0.11)[1], P(0, 0.11), P(0, 0), 1, 0.8);
  for (const s of [-1, 1]) p.shade(spline([P(s * 0.16, top), P(s * 0.22, 0.29), P(s * 0.34, 0.24), P(s * 0.46, 0.25), P(s * 0.47, top)], 6), 0.74, 0.9);
  // weisses Hemd im Mantelausschnitt, Knopfleiste / white shirt inside the coat opening, placket
  const shirt: Pt[] = [P(-0.085, top), P(0.085, top), P(0.06, 0.2), P(0.03, -0.01), P(-0.03, -0.01), P(-0.06, 0.2)];
  p.fill(shirt, mat.paper);
  p.fill([P(-0.085, top), P(0.085, top), P(0.07, 0.27), P(0, 0.24), P(-0.07, 0.27)], shade(mat.paper, 0.72));
  p.line(spline([P(0.002, 0.24), P(0, 0.1), P(0, -0.01)], 4), lw(1.2), { taper: 0.1, wobble: 0.3 });
  for (const y of [0.11, 0.045]) { const c = P(0, y); p.spot(c[0], c[1], lw(2.4), shade(mat.paper, 0.8)); p.line(arc(c[0], c[1], lw(2.4), lw(2.4), 0, Math.PI * 2, 10), lw(0.9), { closed: true, wobble: 0.1 }); }
  // Mantelkanten mit Goldpaspel, Revers / coat edges with gold piping, lapels
  for (const s of [-1, 1]) {
    const edge = spline([P(s * 0.085, top), P(s * 0.07, 0.25), P(s * 0.045, 0.1), P(s * 0.032, -0.01)], 6);
    p.band(edge, u(0.011), BRASS, lw(1.2));
    const lapel: Pt[] = [P(s * 0.09, top - 0.02), P(s * 0.19, 0.27), P(s * 0.13, 0.19), P(s * 0.065, 0.2)];
    p.shade(lapel, 1.25, 0.9);
    p.line(lapel, lw(1.5), { closed: true, wobble: 0.3 });
    p.line(spline([P(s * 0.345, 0.3), P(s * 0.372, 0.2), P(s * 0.392, 0.08), P(s * 0.395, -0.01)], 6), lw(1.5), { taper: 0.12, wobble: 0.4 });
    fold(p, spline([P(s * 0.38, 0.16), P(s * 0.32, 0.135), P(s * 0.27, 0.13)], 5), lw(1.3), u(0.013) * s, 0.8);
    fold(p, spline([P(s * 0.38, 0.07), P(s * 0.31, 0.045), P(s * 0.25, 0.04)], 5), lw(1.3), u(0.014) * s, 0.8);
  }
  // Knoepfe am Mantel (im Bild rechts), Schatten von Riemen, Medaillon und Zopf / coat buttons (right in the picture), shade of strap, medallion and braid
  for (const y of [0.16, 0.07]) { const c = P(0.1, y); goldDisc(p, c[0], c[1], u(0.014), lw(1.1), BRASS); }
  p.shade([P(-0.385, 0.29), P(-0.345, 0.31), P(-0.05, 0.01), P(-0.09, -0.01)].map((q): Pt => [q[0] + u(0.012), q[1] + u(0.014)]), 0.64, 0.9);
  { const c = P(MEDAL[0] + 0.01, MEDAL[1] - 0.014); p.dab(c[0], c[1], u(0.09), 0.6, 0.9); }
  p.shade(spline([P(0.17, top), P(0.18, 0.2), P(0.165, -0.01)], 4).concat([P(0.285, -0.01), P(0.3, 0.2), P(0.29, top)]), 0.68, 0.9);
}

function cells(m: MoodArt): Cell[] {
  return [
    { name: 'face', w: 512, h: 512, paint: (p) => paintFace(p, m) },
    { name: 'scalp', w: 192, h: 192, paint: paintScalp },
    { name: 'chest', w: 640, h: 272, paint: paintChest },
    ...bodyCells(),
    { name: 'brim', w: 416, h: 120, paint: paintBrim },
    { name: 'brimUnder', w: 256, h: 96, paint: paintBrimUnder },
    { name: 'crown', w: 320, h: 144, paint: paintCrown },
    { name: 'lensBlue', w: 96, h: 96, paint: (p) => paintLens(p, LENS) },
    { name: 'lensGold', w: 96, h: 96, paint: (p) => paintLens(p, LENS_GOLD) },
    { name: 'feather', w: 208, h: 64, paint: paintFeather },
    { name: 'lock', w: 256, h: 96, paint: paintLock },
    { name: 'braid', w: 400, h: 64, paint: paintBraid },
    { name: 'collar', w: 256, h: 88, paint: paintCollar },
    { name: 'collarIn', w: 192, h: 64, paint: paintCollarIn },
    { name: 'shirt', w: 80, h: 80, paint: paintShirt },
    { name: 'scarf', w: 160, h: 64, paint: paintScarf },
    { name: 'scarfDrape', w: 144, h: 176, paint: paintScarfDrape },
    { name: 'medallion', w: 128, h: 128, paint: paintMedallion },
    { name: 'strap', w: 256, h: 40, paint: paintStrap },
    { name: 'shoulder', w: 176, h: 96, paint: paintShoulder },
  ];
}

export const meridon: LeaderDef = { cells, build, glow: [LENS_GOLD], side: 1 };
