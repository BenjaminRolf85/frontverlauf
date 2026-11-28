/**
 * Nur Filmexport (Anime-Schnitt): Grossmarschall Ilja Brodnik als ganze Figur. Der Kopf, die Muetze, der Oberkoerper
 * mit Orden und Schulterstuecken sind genau die Heldenbueste des Spiels (leaderKorvat.ts, unveraendert aufgerufen);
 * dieser Baustein setzt darunter den Rest der Figur an: Rockschoss der Uniform mit Koppel, Reithose mit Biese,
 * Reitstiefel, Arme mit Aufschlaegen und Handschuhen, Saebel. Der Umhang (Mantel ueber den Schultern) ist ein eigenes
 * Modell, damit Blender ihn im Wind bewegen kann.
 * Haltung: Heldenpose auf einer Anhoehe. Der linke Fuss steht erhoeht (auf einem Fels), der linke Arm zeigt nach vorn
 * zum Horizont, die rechte Faust stuetzt sich in die Huefte.
 * Das Spiel ruft diesen Baustein nie auf: Bueste, Einheiten und ihre Tests bleiben unveraendert. Der Heldenatlas ist
 * ein eigener ('leader-korvat-film'): die Zellen der Bueste plus die Zellen des Koerpers.
 *
 * Export only (anime cut): Grand Marshal Ilja Brodnik as a full figure. Head, cap, torso with medals and epaulettes
 * are exactly the game's hero bust (leaderKorvat.ts, called unchanged); this module attaches the rest of the figure
 * below: the uniform's skirt with belt, breeches with a stripe, riding boots, arms with cuffs and gloves, a sabre. The
 * cape (greatcoat worn over the shoulders) is a model of its own so Blender can move it in the wind.
 * Pose: a hero pose on a rise. The left foot stands raised (on a rock), the left arm points forward to the horizon,
 * the right fist rests on the hip.
 * The game never calls this module: bust, units and their tests stay unchanged. The hero atlas is a separate one
 * ('leader-korvat-film'): the bust's cells plus the body's cells.
 *
 * Masse in Einheiten der Bueste (Ursprung der Bueste = unteres Ende des Brustkorbs, Kopf bei y = 0.665, Muetze bis
 * y = 1.0); die Figur steht mit den Sohlen bei y = FLOOR. Blick +z, +x ist die linke Seite der Figur.
 * Sizes in units of the bust (the bust's origin = the bottom of the rib cage, head at y = 0.665, cap up to y = 1.0);
 * the figure stands with its soles at y = FLOOR. Facing +z, +x is the figure's left side.
 */
import * as THREE from 'three';
import { rng, shade, type V3 } from '../../../src/render/models/kit';
import { look, mat } from '../../../src/render/models/look';
import { bakeAO } from '../../../src/render/models/inked/ao';
import { atlasDef, defineAtlas, hasAtlas, spline, type Cell, type Pen, type Pt } from '../../../src/render/models/inked/atlas';
import { korvat } from '../../../src/render/models/inked/leaderKorvat';
import { sheet, torsoPoint, tube, type TorsoSpec } from '../../../src/render/models/inked/leaderKit';
import { fold, GOLD, GOLD_DARK, GOLD_LIGHT, lineScale, moodArt } from '../../../src/render/models/inked/leaderPaint';
import { loft, UvBuilder, type AtlasLayout } from '../../../src/render/models/inked/uvkit';

const L = look('korvat');
/** Oberkoerper der Bueste (Abschrift von T in leaderKorvat.ts) / the bust's torso (copy of T in leaderKorvat.ts) */
const T: TorsoSpec = { w: 0.45, d: 0.22, h: 0.35, slope: 0.085, neckR: 0.11, rise: 0.055, square: 0.3, z: -0.01, chest: 0.012 };
const COAT = L.primary;
const PANTS = L.pants;
const BOOT = mat.dark;
const GLOVE = mat.paper;
const BELT = shade(mat.wood, 0.7);
const CAPE_C = L.helmet;
const LINING = shade(L.primary, 0.8);
/** Sohle / soles */
export const FLOOR = -2.05;
/** Hoehe des Felsens unter dem linken Fuss / height of the rock under the left foot */
export const STEP = 0.36;
export const ATLAS = 'leader-korvat-film';
export const CAPE_ATLAS = 'leader-korvat-cape';

const v3 = (p: V3 | THREE.Vector3) => (p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]));
const arr = (p: THREE.Vector3): V3 => [p.x, p.y, p.z];

/**
 * Zwei Knochen zwischen Wurzel a und Ende c mit den Laengen l1, l2; das Gelenk biegt Richtung pole.
 * Two bones between root a and end c with lengths l1, l2; the joint bends towards pole.
 */
function joint(a: THREE.Vector3, c: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3): THREE.Vector3 {
  const d = c.clone().sub(a), len = Math.min(d.length(), l1 + l2 - 1e-4);
  const dir = d.normalize();
  const x = (l1 * l1 - l2 * l2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const side = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  return a.clone().addScaledVector(dir, x).addScaledVector(side, h);
}

// ---------- Glieder / limbs ----------

interface Limb { root: THREE.Vector3; mid: THREE.Vector3; end: THREE.Vector3 }

const LEG = { thigh: 0.74, shin: 0.74, hip: 0.155 };
const ARM = { upper: 0.5, fore: 0.45 };

/** Beine: rechts gestreckt, links auf dem Fels / legs: right one straight, left one on the rock */
function legs(): Record<'l' | 'r', Limb> {
  const hipY = -0.4;
  const mk = (s: 1 | -1, ankle: V3, pole: V3): Limb => {
    const root = v3([s * LEG.hip, hipY, 0.0]), end = v3(ankle);
    return { root, mid: joint(root, end, LEG.thigh, LEG.shin, v3(pole)), end };
  };
  return {
    r: mk(-1, [-0.25, FLOOR + 0.105, -0.06], [0, 0, 1]),
    l: mk(1, [0.24, FLOOR + STEP + 0.105, 0.34], [0, 0.2, 1]),
  };
}
/** Arme: links zeigt nach vorn, rechts Faust in der Huefte / arms: left one points forward, right fist on the hip */
function arms(): Record<'l' | 'r', Limb & { hand: THREE.Vector3 }> {
  const sl = v3([0.385, 0.285, -0.005]), sr = v3([-0.385, 0.285, -0.005]);
  // Zeigerichtung: nach vorn, etwas zur linken Seite und ueber den Horizont / pointing: forward, a little to the left side and above the horizon
  const dir = v3([0.42, 0.2, 0.88]).normalize();
  const lEnd = sl.clone().addScaledVector(dir, ARM.upper + ARM.fore - 0.03);
  const lMid = joint(sl, lEnd, ARM.upper, ARM.fore, v3([0.3, -1, -0.2]));
  const rEnd = v3([-0.41, -0.2, 0.08]);
  const rMid = joint(sr, rEnd, ARM.upper, ARM.fore, v3([-1, 0.1, -0.35]));
  return {
    l: { root: sl, mid: lMid, end: lEnd, hand: lEnd.clone().addScaledVector(dir, 0.2) },
    r: { root: sr, mid: rMid, end: rEnd, hand: v3([-0.33, -0.27, 0.12]) },
  };
}

/** Pfad durch drei Gelenke mit weichem Knick / path through three joints with a soft bend */
function bent(l: Limb, k = 0.08): V3[] {
  const a = l.mid.clone().lerp(l.root, k), c = l.mid.clone().lerp(l.end, k);
  return [arr(l.root), arr(l.root.clone().lerp(l.mid, 0.5)), arr(a), arr(l.mid), arr(c), arr(l.mid.clone().lerp(l.end, 0.5)), arr(l.end)];
}

function lowerBody(b: UvBuilder, A: AtlasLayout): void {
  const hi = true;
  // Rockschoss: schliesst an den unteren Rand des Oberkoerpers an (gleicher Querschnitt), Koppel in der Taille
  // skirt: joins the bottom edge of the torso (same cross-section), belt at the waist
  const e = 2 + (T.square) * 4, rx0 = T.w * 0.86, rz0 = T.d * 0.92, cz = T.z ?? 0;
  b.add(loft([
    { y: 0.035, rx: rx0 * 0.985, rz: rz0 * 0.985, cz, e },
    { y: -0.0, rx: rx0, rz: rz0, cz, e },
    { y: -0.12, rx: rx0 * 0.95, rz: rz0 * 0.97, cz, e },
    { y: -0.24, rx: rx0 * 0.93, rz: rz0 * 0.98, cz: cz + 0.005, e: e * 0.9 },
    { y: -0.36, rx: rx0 * 0.99, rz: rz0 * 1.05, cz: cz + 0.01, e: e * 0.85 },
    { y: -0.5, rx: rx0 * 1.06, rz: rz0 * 1.15, cz: cz + 0.015, e: e * 0.8 },
    { y: -0.56, rx: rx0 * 1.08, rz: rz0 * 1.18, cz: cz + 0.015, e: e * 0.8, hard: true },
    { y: -0.555, rx: rx0 * 0.9, rz: rz0 * 0.95, cz: cz + 0.015, e: e * 0.8 },
  ], { seg: hi ? 72 : 36, region: A.get('skirt'), color: COAT }), null, { crease: 0.7 });
  // Koppel mit Schnalle / belt with buckle
  b.add(loft([
    { y: -0.205, rx: rx0 * 0.93 + 0.004, rz: rz0 * 0.98 + 0.004, cz: cz + 0.005, e: e * 0.9 },
    { y: -0.2, rx: rx0 * 0.93 + 0.014, rz: rz0 * 0.98 + 0.014, cz: cz + 0.005, e: e * 0.9, hard: true },
    { y: -0.14, rx: rx0 * 0.94 + 0.014, rz: rz0 * 0.975 + 0.014, cz: cz + 0.004, e: e * 0.9, hard: true },
    { y: -0.135, rx: rx0 * 0.94 + 0.004, rz: rz0 * 0.975 + 0.004, cz: cz + 0.004, e: e * 0.9 },
  ], { seg: hi ? 72 : 36, region: A.get('belt'), color: BELT }), null, { crease: 1, gloss: 0.35 });
  const buckleZ = cz + 0.005 + rz0 * 0.98 + 0.016;
  b.add(sheet((u, v) => new THREE.Vector3((u - 0.5) * 0.1, -0.2 + v * 0.064, buckleZ + 0.004 * Math.sin(Math.PI * u)),
    { nu: 6, nv: 3, region: A.get('buckle'), back: A.get('blank'), thick: 0.008, color: GOLD, backColor: GOLD_DARK, flip: true }), null, { gloss: 0.7, crease: 1 });

  // Beine: Reithose (oben weit), Stiefel ab dem Knie / legs: breeches (wide at the top), boots from the knee
  const lg = legs();
  for (const [s, l] of [[-1, lg.r], [1, lg.l]] as [number, Limb][]) {
    const path = bent(l, 0.1);
    const out: V3 = [s, 0, 0];
    b.add(tube(path, (t) => {
      // Hueftansatz, Ausbuchtung der Reithose, Knie, Wade im Stiefel / hip root, the breeches' flare, knee, calf in the boot
      const flare = Math.exp(-((t - 0.24) ** 2) / 0.018) * 0.045;
      const r = t < 0.5 ? 0.125 - 0.04 * (t / 0.5) + flare : 0.085 - 0.012 * ((t - 0.5) / 0.5);
      return [r, r * 0.95];
    }, { seg: 28, samples: 34, region: A.get('breeches'), out, color: PANTS }), null, { crease: 0.4 });
    // Stiefelschaft vom Knie zum Knoechel (etwas weiter als das Bein) / boot shaft from the knee to the ankle (slightly wider than the leg)
    const k0 = l.mid.clone().lerp(l.end, 0.07), k1 = l.end.clone();
    const shaft: V3[] = [arr(k0.clone().lerp(l.mid, 0.2).add(new THREE.Vector3(0, 0.02, 0.012))), arr(k0), arr(k0.clone().lerp(k1, 0.5)), arr(k1)];
    b.add(tube(shaft, (t) => { const r = t < 0.12 ? 0.098 : 0.094 - 0.025 * Math.pow((t - 0.12) / 0.88, 1.3); return [r, r * 0.96]; },
      { seg: 26, samples: 24, region: A.get('boot'), out: [0, 0, 1], color: BOOT }), null, { crease: 0.6, gloss: 0.55 });
    // Fuss: von der Ferse zur Spitze, flach auf der Sohle / foot: heel to toe, flat on the sole
    const fy = l.end.y - 0.105, fwd = new THREE.Vector3(s * 0.12, 0, 1).normalize();
    const heel = new THREE.Vector3(l.end.x, fy, l.end.z).addScaledVector(fwd, -0.075);
    const foot: V3[] = [arr(heel.clone().add(new THREE.Vector3(0, 0.07, 0))), arr(heel.clone().addScaledVector(fwd, 0.1).add(new THREE.Vector3(0, 0.075, 0))),
      arr(heel.clone().addScaledVector(fwd, 0.22).add(new THREE.Vector3(0, 0.055, 0))), arr(heel.clone().addScaledVector(fwd, 0.31).add(new THREE.Vector3(0, 0.04, 0)))];
    b.add(tube(foot, (t) => { const k = Math.sin(Math.PI * Math.min(1, 0.35 + t * 0.7)); return [0.062 * Math.max(0.35, k), 0.066 * Math.max(0.5, k)]; },
      { seg: 20, samples: 16, region: A.get('boot'), out: [0, 1, 0], color: BOOT }), null, { crease: 0.6, gloss: 0.55 });
    // Sohle und Absatz / sole and heel
    b.add(sheet((u, v) => heel.clone().addScaledVector(fwd, -0.02 + 0.36 * u).add(new THREE.Vector3((v - 0.5) * 0.115 * (u > 0.85 ? 0.75 : 1), 0.012, 0)).add(new THREE.Vector3(0, 0, 0)),
      { nu: 6, nv: 2, region: A.get('blank'), thick: 0.016, color: shade(BOOT, 0.6), flip: false }), null, { crease: 1 });
  }

  // Arme / arms
  const am = arms();
  for (const [s, a] of [[-1, am.r], [1, am.l]] as [number, Limb & { hand: THREE.Vector3 }][]) {
    const path = bent(a, 0.12);
    // Wurzel etwas im Oberkoerper versteckt / root slightly hidden inside the torso
    path[0] = arr(a.root.clone().add(new THREE.Vector3(-s * 0.05, 0.01, 0)));
    b.add(tube(path, (t) => { const r = 0.092 - 0.026 * t + 0.008 * Math.exp(-((t - 0.5) ** 2) / 0.01); return [r, r * 0.92]; },
      { seg: 26, samples: 30, region: A.get('sleeve'), out: [s, 0.3, 0], color: COAT }), null, { crease: 0.4 });
    // Aufschlag / cuff
    const w0 = a.end.clone().lerp(a.mid, 0.16), w1 = a.end.clone().lerp(a.mid, -0.03);
    b.add(tube([arr(w0), arr(w0.clone().lerp(w1, 0.5)), arr(w1)], () => [0.074, 0.07], { seg: 24, samples: 6, region: A.get('cuff'), out: [s, 0.3, 0], color: COAT }), null, { crease: 1 });
    hand(b, A, a.end, a.hand, s === 1 ? 'point' : 'fist', s);
  }

  // Saebel an der linken Huefte, Scheide nach hinten geneigt / sabre at the left hip, scabbard tilted back
  const top = v3([0.43, -0.27, 0.06]), tip = v3([0.52, -1.18, -0.36]);
  b.add(tube([arr(top), arr(top.clone().lerp(tip, 0.5).add(new THREE.Vector3(0.01, 0, 0.01))), arr(tip)], (t) => [0.024 - 0.006 * t, 0.034 - 0.01 * t],
    { seg: 14, samples: 16, region: A.get('scabbard'), out: [1, 0, 0], color: shade(mat.dark, 1.2) }), null, { crease: 0.7, gloss: 0.45 });
  const hilt0 = top.clone().add(new THREE.Vector3(-0.004, 0.035, 0.03)), hilt1 = top.clone().add(new THREE.Vector3(-0.03, 0.17, 0.12));
  b.add(tube([arr(hilt0), arr(hilt0.clone().lerp(hilt1, 0.5)), arr(hilt1)], (t) => 0.019 + 0.006 * Math.sin(Math.PI * t), { seg: 12, samples: 8, region: A.get('blank'), color: shade(mat.wood, 0.8) }), null, { crease: 0.8, gloss: 0.3 });
  // Buegel (Korb) in Gold / guard in gold
  b.add(tube([arr(hilt0), arr(hilt0.clone().add(new THREE.Vector3(0.05, 0.05, 0.06))), arr(hilt1.clone().add(new THREE.Vector3(0.03, 0.0, 0.015)))], () => 0.009,
    { seg: 8, samples: 12, region: A.get('blank'), color: GOLD }), null, { crease: 0.8, gloss: 0.7 });
  // Knauf / pommel
  b.add(tube([arr(hilt1), arr(hilt1.clone().add(new THREE.Vector3(-0.006, 0.018, 0.012)))], () => 0.026, { seg: 12, samples: 4, region: A.get('blank'), color: GOLD }), null, { crease: 0.8, gloss: 0.7 });
}

/** Handschuh: Zeigehand oder Faust / glove: pointing hand or fist */
function hand(b: UvBuilder, A: AtlasLayout, wrist: THREE.Vector3, to: THREE.Vector3, kind: 'point' | 'fist', s: number): void {
  const front = new THREE.Vector3(0, 1, 0.2);
  const g = A.get('glove');
  b.bone(wrist, to, front, (len) => {
    const k = len / 0.2;
    // Handruecken / back of the hand (local +y = along the hand, +z = back of the hand side up)
    b.add(loft([
      { y: -0.01 * k, rx: 0.046 * k, rz: 0.04 * k },
      { y: 0.03 * k, rx: 0.052 * k, rz: 0.034 * k },
      { y: 0.085 * k, rx: 0.056 * k, rz: 0.03 * k },
      { y: 0.11 * k, rx: 0.05 * k, rz: 0.028 * k },
      { y: 0.125 * k, rx: 0.001, rz: 0.001 },
    ], { seg: 20, region: g, color: GLOVE }), null, { crease: 0.4 });
    // Daumen / thumb
    b.add(tube([[-s * 0.04 * k, 0.02 * k, -0.01 * k], [-s * 0.065 * k, 0.07 * k, -0.025 * k], [-s * 0.06 * k, 0.11 * k, -0.035 * k]], (t) => 0.019 * k * (1 - 0.25 * t),
      { seg: 10, samples: 8, region: g, color: GLOVE }), null, { crease: 0.6 });
    if (kind === 'point') {
      // Zeigefinger gestreckt, die anderen eingerollt / index finger straight, the others curled
      b.add(tube([[-s * 0.03 * k, 0.1 * k, 0.0], [-s * 0.032 * k, 0.16 * k, 0.004 * k], [-s * 0.03 * k, 0.21 * k, 0.006 * k]], (t) => 0.0165 * k * (1 - 0.2 * t),
        { seg: 10, samples: 8, region: g, color: GLOVE }), null, { crease: 0.6 });
      for (const x of [-0.004, 0.02, 0.044]) {
        const xx = x * s;
        b.add(tube([[xx * k, 0.1 * k, 0.0], [xx * k, 0.135 * k, -0.012 * k], [xx * k, 0.125 * k, -0.04 * k], [xx * k, 0.095 * k, -0.04 * k]], () => 0.016 * k,
          { seg: 10, samples: 8, region: g, color: GLOVE }), null, { crease: 0.6 });
      }
    } else {
      // Faust: vier eingerollte Finger / fist: four curled fingers
      for (let i = 0; i < 4; i++) {
        const xx = (-0.036 + i * 0.024) * s;
        b.add(tube([[xx * k, 0.1 * k, 0.0], [xx * k, 0.14 * k, -0.016 * k], [xx * k, 0.13 * k, -0.05 * k], [xx * k, 0.1 * k, -0.052 * k]], () => 0.0165 * k,
          { seg: 10, samples: 8, region: g, color: GLOVE }), null, { crease: 0.6 });
      }
    }
  });
}

// ---------- Umhang / cape ----------

/** Winkel der Umhangkanten (torsoPoint: 0 = +x, PI/2 = vorn, 3 PI/2 = hinten) / angles of the cape's edges */
const CAPE_A0 = Math.PI + 0.32, CAPE_A1 = 2 * Math.PI - 0.32;
export const CAPE_Y = { top: T.h * 0.97, hem: -1.5 };
/**
 * Umhang: haengt hinter den Schultern bis zur Wade, weitet sich nach unten, mit grossen Falten und einem Zug nach
 * hinten links (Wind). In Blender kommt die Bewegung dazu (Wellen nach der Hoehe).
 * Cape: hangs behind the shoulders down to the calf, widens downward, with large folds and a pull to the back left
 * (wind). Blender adds the motion (waves by height).
 */
function cape(b: UvBuilder, A: AtlasLayout): void {
  const folds = 5;
  const at = (u: number, v: number): THREE.Vector3 => {
    const a = CAPE_A0 + (CAPE_A1 - CAPE_A0) * u;
    const top = torsoPoint(T, a, 0.6);
    const ca = Math.cos(a), sa = Math.sin(a);
    // Haenge-Linie: oben auf der Schulter, dann frei nach unten und aussen / hang line: on top of the shoulder, then freely down and out
    const drop = Math.pow(v, 0.9);
    const y = CAPE_Y.top + 0.01 - (CAPE_Y.top - CAPE_Y.hem) * drop + 0.05 * (1 - Math.cos(Math.PI * (u - 0.5) * 2)) * v * 0.6;
    const spread = 0.035 + 0.3 * Math.pow(v, 1.15);
    const ripple = Math.sin(u * folds * 2 * Math.PI) * 0.045 * Math.pow(v, 1.3) * Math.sin(Math.PI * Math.min(1, u * 1.08 + 0.02));
    const r = spread + ripple;
    const p = new THREE.Vector3(top.x + ca * r * 1.05, y, top.z + sa * r * 1.2 - 0.04 * v);
    // Wind: der Saum weht nach hinten und zur rechten Seite (-x) / wind: the hem blows back and to the right side (-x)
    const w = Math.pow(v, 1.6);
    p.x += -0.16 * w;
    p.z += -0.12 * w;
    p.y += 0.08 * w * (0.4 + 0.6 * (1 - u));
    // oben eng an der Schulter / tight at the shoulder on top
    if (v < 0.08) { const k = v / 0.08; p.lerp(top.clone().add(new THREE.Vector3(ca * 0.035, 0.012, sa * 0.035)), 1 - k); }
    return p;
  };
  b.add(sheet(at, { nu: 60, nv: 34, region: A.get('cape'), back: A.get('capeIn'), thick: 0.013, color: CAPE_C, backColor: LINING }), null, { crease: 0.5 });
  // Kragen: gerollter Wulst entlang der Oberkante / collar: rolled bulge along the top edge
  const pts: V3[] = [];
  for (let i = 0; i <= 14; i++) { const p = at(i / 14, 0.02); pts.push([p.x, p.y + 0.015, p.z]); }
  b.add(tube(pts, (t) => { const k = Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.84)); return [0.03 * k + 0.008, 0.026 * k + 0.008]; },
    { seg: 14, samples: 40, region: A.get('capeCollar'), out: [0, 1, -0.4], color: shade(CAPE_C, 0.92) }), null, { crease: 0.6 });
}

// ---------- Zeichnung / drawing ----------

function paintSkirt(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 2.6);
  // s rundum (0.5 = vorn), t von oben nach unten / s around (0.5 = front), t from top to bottom
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1, 0.84);
  // Seitennaehte, Knopfleiste vorn / side seams, button front
  for (const x of [0.25, 0.75]) p.line(spline([[W * x, 2], [W * x + 2, H * 0.5], [W * x, H - 4]], 4), lw(1.4), { taper: 0.2, wobble: 0.4 });
  p.line(spline([[W * 0.5 + 3, 0], [W * 0.5 + 3, H * 0.6], [W * 0.5 + 2, H - 4]], 4), lw(1.5), { taper: 0.1, wobble: 0.3 });
  p.crease(spline([[W * 0.5 + 8, 0], [W * 0.5 + 8, H - 4]], 3), 6, 0.78, 0.9, { taper: 0.05 });
  // Taschenklappen vorn mit Goldknopf / pocket flaps at the front with a gold button
  for (const x of [0.37, 0.63]) {
    const cx = W * x, y0 = H * 0.5, w = W * 0.06, h = H * 0.11;
    const flap: Pt[] = [[cx - w, y0], [cx + w, y0], [cx + w * 0.9, y0 + h], [cx, y0 + h * 1.35], [cx - w * 0.9, y0 + h]];
    p.shade(flap.map((q): Pt => [q[0] + 2, q[1] + 3]), 0.7, 0.9);
    p.line(flap, lw(1.5), { closed: true, wobble: 0.2 });
    p.spot(cx, y0 + h * 0.85, 4.5, GOLD);
    p.line(spline([[cx - 4.5, y0 + h * 0.85], [cx, y0 + h * 0.85 - 4.5], [cx + 4.5, y0 + h * 0.85], [cx, y0 + h * 0.85 + 4.5]], 3, true), lw(1), { closed: true });
    // Taschennaht / pocket seam
    p.stitch([[cx - w, y0 + h * 1.6], [cx + w, y0 + h * 1.6]], 3, 2.6, 1, 0.6);
  }
  // Falten unter dem Koppel und am Saum / folds below the belt and at the hem
  const R = rng(31);
  for (let i = 0; i < 9; i++) {
    const x = W * (0.06 + 0.88 * (i / 8)) + (R() - 0.5) * 12;
    fold(p, spline([[x, H * 0.42], [x + (R() - 0.5) * 8, H * 0.7], [x + (R() - 0.5) * 10, H - 6]], 4), lw(1.2), 6, 0.82);
  }
  // Saum dunkel / hem dark
  p.shade([[0, H - 10], [W, H - 10], [W, H], [0, H]], 0.72, 0.9);
  p.line([[0, H - 10], [W, H - 10]], lw(1.4), { taper: 0, wobble: 0.3 });
}

function paintBelt(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 2.6);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.1, 0.8);
  p.stitch([[0, H * 0.3], [W, H * 0.3]], 3, 2.4, 0.9, 0.6);
  p.stitch([[0, H * 0.7], [W, H * 0.7]], 3, 2.4, 0.9, 0.6);
  p.scratches(0, 0, W, H, 6, 77, 14);
  p.line([[0, 1], [W, 1]], lw(1), { taper: 0 });
}

function paintBuckle(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.1);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.15, 0.8);
  p.line([[3, 3], [W - 3, 3], [W - 3, H - 3], [3, H - 3]], lw(1.4), { closed: true, wobble: 0.1 });
  // Stern im Schild / star on the plate
  const cx = W / 2, cy = H / 2, r = H * 0.33, pts: Pt[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  p.fill(pts, L.primary);
  p.line(pts, lw(1.1), { closed: true, wobble: 0.05 });
}

function paintBreeches(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.3);
  // s entlang des Beins, t rundum (0.5 = aussen) / s along the leg, t around (0.5 = outside)
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.86, 1.0);
  p.gradient(0, H * 0.5, W, H * 0.5, [0, H * 0.5], [0, H], 1.0, 0.82);
  // Biese an der Aussennaht (doppelter roter Streifen) / stripe at the outer seam (double red stripe)
  for (const y of [0.46, 0.54]) p.band([[-4, H * y], [W * 0.58, H * y]], 5, L.primary, lw(0.9));
  // Falten der weiten Reithose und am Knie / folds of the wide breeches and at the knee
  const R = rng(19);
  for (let i = 0; i < 6; i++) {
    const x = W * (0.1 + 0.07 * i), y = H * (0.15 + R() * 0.7);
    fold(p, spline([[x, y - H * 0.1], [x + 8, y], [x + 4, y + H * 0.12]], 4), lw(1.2), 5, 0.82);
  }
  for (let i = 0; i < 3; i++) {
    const y = H * (0.25 + 0.25 * i);
    fold(p, spline([[W * 0.44, y], [W * 0.5, y + 6], [W * 0.56, y + 2]], 4), lw(1.1), 4, 0.8);
  }
}

function paintBoot(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.7);
  // Lack: dunkel, ein harter Glanzstreifen vorn, Knautschfalten am Knoechel / lacquer: dark, one hard shine stripe at the front, creases at the ankle
  p.gradient(0, 0, W, H, [0, 0], [W, 0], 1.0, 0.9);
  p.fill(spline([[W * 0.1, H * 0.06], [W * 0.5, H * 0.05], [W * 0.92, H * 0.07], [W * 0.92, H * 0.13], [W * 0.5, H * 0.12], [W * 0.1, H * 0.13]], 4, true), mat.white, 0.42);
  p.fill(spline([[W * 0.15, H * 0.9], [W * 0.6, H * 0.88], [W * 0.85, H * 0.9], [W * 0.85, H * 0.95], [W * 0.15, H * 0.96]], 4, true), mat.white, 0.25);
  for (let i = 0; i < 4; i++) {
    const x = W * (0.72 + i * 0.06);
    p.line(spline([[x, H * 0.3], [x - 6, H * 0.5], [x, H * 0.7]], 4), lw(1.1), { taper: 0.4, wobble: 0.4 });
  }
  // Schaftrand / top edge of the shaft
  p.band([[2, -4], [2, H + 4]], 6, shade(BOOT, 1.4), lw(1.2));
}

function paintSleeve(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.95);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.86, 1.02);
  p.gradient(0, H * 0.5, W, H * 0.5, [0, H * 0.5], [0, H], 1.0, 0.8);
  // Ellenbogenfalten, Naht innen / elbow folds, inner seam
  const R = rng(23);
  for (let i = 0; i < 5; i++) {
    const x = W * (0.46 + 0.05 * i) + (R() - 0.5) * 6;
    fold(p, spline([[x, H * 0.2], [x - 7, H * 0.5], [x + 2, H * 0.8]], 4), lw(1.2), 5, 0.8);
  }
  p.line([[0, 3], [W, 3]], lw(1.2), { taper: 0.3, wobble: 0.4 });
  p.stitch([[0, 8], [W, 8]], 3, 2.6, 0.9, 0.6);
}

function paintCuff(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.2);
  // Goldener Aufschlag mit Eichenlaub-Andeutung / gold cuff with a hint of oak leaves
  p.fill([[0, 0], [W, 0], [W, H], [0, H]], GOLD);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.1, 0.78);
  p.band([[0, H * 0.2], [W, H * 0.2]], 4, GOLD_LIGHT, lw(1));
  for (let i = 0; i < 6; i++) {
    const x = W * (i + 0.5) / 6;
    p.line(spline([[x - 6, H * 0.75], [x, H * 0.45], [x + 6, H * 0.75]], 3), lw(1), { taper: 0.4, wobble: 0.2 });
  }
  p.line([[0, H - 2], [W, H - 2]], lw(1.4), { taper: 0 });
}

function paintGlove(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.2);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.0, 0.82);
  p.line(spline([[W * 0.3, H * 0.2], [W * 0.32, H * 0.6]], 3), lw(1), { taper: 0.4 });
  p.line(spline([[W * 0.6, H * 0.2], [W * 0.62, H * 0.6]], 3), lw(1), { taper: 0.4 });
}

function paintScabbard(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.9);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.1, 0.8);
  for (const x of [0.05, 0.4, 0.97]) { p.fill([[W * x - 5, 0], [W * x + 5, 0], [W * x + 5, H], [W * x - 5, H]], GOLD); p.line([[W * x - 5, 0], [W * x - 5, H]], lw(1)); p.line([[W * x + 5, 0], [W * x + 5, H]], lw(1)); }
  p.fill([[W * 0.1, H * 0.4], [W * 0.9, H * 0.4], [W * 0.9, H * 0.5], [W * 0.1, H * 0.5]], mat.white, 0.25);
}

/** Umhang aussen: Wolle, grosse Faltenlinien, dunkler zum Saum / cape outside: wool, large fold lines, darker towards the hem */
function paintCape(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.4);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.04, 0.82);
  // Faltentaeler (5 Falten wie die Geometrie: Taeler bei sin = -1) / fold valleys (5 folds as the geometry: valleys at sin = -1)
  for (let j = 0; j < 5; j++) {
    const x = W * ((j + 0.75) / 5);
    p.crease(spline([[x, H * 0.12], [x - 3, H * 0.55], [x + 4, H - 6]], 4), 14, 0.78, 0.85, { taper: 0.5, wobble: 0.8 });
    p.line(spline([[x + 1, H * 0.3], [x - 2, H * 0.62], [x + 5, H - 10]], 4), lw(1.4), { taper: 0.5, wobble: 0.6, press: 0.4 });
  }
  // Ruecken-Naht / back seam
  p.line(spline([[W * 0.5, 4], [W * 0.5 + 2, H * 0.5], [W * 0.5 - 2, H - 4]], 4), lw(1.1), { taper: 0.3, wobble: 0.4 });
  // Saum mit roter Paspel / hem with red piping
  p.band([[-4, H - 5], [W + 4, H - 5]], 6, L.primary, lw(1.2));
  // Schulter-Schatten unter dem Kragen / shoulder shade below the collar
  p.shade([[0, 0], [W, 0], [W, H * 0.06], [0, H * 0.1]], 0.72, 0.9);
}
/** Umhang innen: rotes Futter / cape inside: red lining */
function paintCapeIn(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.4);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.8, 1.05);
  for (let j = 0; j < 5; j++) {
    const x = W * ((j + 0.25) / 5);
    p.crease(spline([[x, H * 0.15], [x + 3, H * 0.6], [x - 3, H - 6]], 4), 10, 0.75, 0.85, { taper: 0.5, wobble: 0.8 });
    p.line(spline([[x, H * 0.35], [x + 2, H * 0.65], [x - 2, H - 10]], 4), lw(1.2), { taper: 0.5, wobble: 0.5 });
  }
}
function paintCapeCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.0);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.82, 1.08);
  const R = rng(5);
  for (let i = 0; i < 7; i++) { const x = W * (0.08 + 0.13 * i) + (R() - 0.5) * 6; p.line(spline([[x, H * 0.2], [x + 4, H * 0.8]], 3), lw(1), { taper: 0.4, wobble: 0.4 }); }
}

function bodyCells(): Cell[] {
  return [
    { name: 'skirt', w: 320, h: 88, paint: paintSkirt },
    { name: 'belt', w: 224, h: 16, paint: paintBelt },
    { name: 'buckle', w: 32, h: 24, paint: paintBuckle },
    { name: 'breeches', w: 176, h: 72, paint: paintBreeches },
    { name: 'boot', w: 112, h: 56, paint: paintBoot },
    { name: 'sleeve', w: 144, h: 56, paint: paintSleeve },
    { name: 'cuff', w: 64, h: 16, paint: paintCuff },
    { name: 'glove', w: 32, h: 32, paint: paintGlove },
    { name: 'scabbard', w: 96, h: 16, paint: paintScabbard },
  ];
}
/** Der Umhang hat einen eigenen Heldenatlas (der der Bueste ist voll) / the cape has a hero atlas of its own (the bust's is full) */
function capeCells(): Cell[] {
  return [
    { name: 'cape', w: 768, h: 480, paint: paintCape },
    { name: 'capeIn', w: 640, h: 400, paint: paintCapeIn },
    { name: 'capeCollar', w: 512, h: 96, paint: paintCapeCollar },
  ];
}

// ---------- Aufbau / build ----------

const AO = { voxel: 0.011, reach: 0.16 };

/**
 * Wie buildLeader (leaders.ts), aber mit dem eigenen Heldenatlas und dem Koerper: fill + inkSrc nach dem Vertrag der
 * gezeichneten Einheiten. part = 'body' (Bueste + Koerper) oder 'cape'.
 * As buildLeader (leaders.ts), but with its own hero atlas and the body: fill + inkSrc following the inked units'
 * contract. part = 'body' (bust + body) or 'cape'.
 */
export function buildFigure(part: 'body' | 'cape'): THREE.BufferGeometry {
  const m = moodArt('neutral', korvat.side ?? 1);
  const id = part === 'body' ? ATLAS : CAPE_ATLAS;
  if (!hasAtlas(id)) defineAtlas(id, part === 'body' ? [...korvat.cells(m), ...bodyCells()] : capeCells(), { hero: true });
  const A = atlasDef(id).layout;
  const b = new UvBuilder(A.get('blank'));
  if (part === 'body') {
    korvat.build(b, A, m);
    lowerBody(b, A);
  } else cape(b, A);
  const raw = b.build();
  const fill = new THREE.BufferGeometry();
  for (const name of Object.keys(raw.attributes)) fill.setAttribute(name, raw.getAttribute(name));
  bakeAO(fill, { voxel: AO.voxel, rays: 24, reach: AO.reach, ground: false });
  const src = raw.getAttribute('fx') as THREE.BufferAttribute, ao = fill.getAttribute('ao') as THREE.BufferAttribute;
  const fx = new Float32Array(src.count * 2);
  for (let i = 0; i < src.count; i++) { fx[i * 2] = src.getX(i); fx[i * 2 + 1] = ao.getX(i); }
  fill.setAttribute('fx', new THREE.BufferAttribute(fx, 2));
  fill.deleteAttribute('ao');
  fill.userData = { inked: { atlas: id, creases: true }, inkSrc: raw, finishScale: 1, leader: { faction: 'korvat', mood: 'neutral', figure: part } };
  fill.computeBoundingBox();
  fill.computeBoundingSphere();
  return fill;
}
