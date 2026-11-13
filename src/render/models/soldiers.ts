/**
 * Soldaten-Grundform mit Gelenken und Infanterie-Einheiten / jointed base soldier and infantry-type units.
 * Arme und Beine werden per Zwei-Knochen-IK zu Zielpunkten (Haende, Knoechel) gefuehrt.
 * Arms and legs are posed by two-bone IK towards targets (hands, ankles).
 * Comic-Proportionen: grosser Kopf und Helm, kurze Beine. Blickrichtung +z.
 * Comic proportions: big head and helmet, short legs. Facing +z.
 * Detailstufen / detail levels: 2 = Einzelfigur / hero figure, 1 = Trupp / team, 0 = Besatzung / crew.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng, shade, xfMatrix, type V3 } from './kit';
import { headgear } from './headgear';
import { look, mat } from './look';

export type Detail = 0 | 1 | 2;
const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

// Masse / dimensions
const HIP_X = 0.043;
const HIP_Y = -0.012;
const TORSO_Y = 0.02;
const SHOULDER_X = 0.098;
const SHOULDER_Y = 0.098;
const NECK_Y = 0.115;
const THIGH = 0.062;
const SHIN = 0.058;
const UPPER = 0.072;
const FORE = 0.085;

export interface Pose {
  /** Beckenmitte / pelvis centre */
  pelvis: V3;
  /** Drehung des ganzen Koerpers (z. B. liegend) / whole-body rotation (e.g. prone) */
  body?: V3;
  /** Oberkoerper-Drehung gegen das Becken / torso rotation against the pelvis */
  twist?: V3;
  /** Kopfdrehung gegen den Oberkoerper / head rotation against the torso */
  head?: V3;
  handL: V3;
  handR: V3;
  /** Knoechel / ankles */
  footL: V3;
  footR: V3;
  bootL?: V3;
  bootR?: V3;
  kneePoleL?: V3;
  kneePoleR?: V3;
  elbowPoleL?: V3;
  elbowPoleR?: V3;
}

export interface SoldierOpts {
  detail?: Detail;
  pack?: 'pack' | 'medbag' | 'pioneer' | 'none';
  armband?: boolean;
  coat?: boolean;
  hat?: 'fedora';
  seed?: number;
  /** Kutte bis zu den Knoecheln mit Schaerpe (Kult) / ankle-length robe with sash (cult) */
  robe?: boolean;
  /** Beine weglassen (Besatzung in Luken) / omit legs (crew in hatches) */
  noLegs?: boolean;
}

/** Zwei-Knochen-IK / two-bone IK */
function ik(s: THREE.Vector3, t: THREE.Vector3, a: number, b: number, pole: THREE.Vector3) {
  const dir = t.clone().sub(s);
  let d = dir.length();
  dir.normalize();
  const max = (a + b) * 0.995;
  const min = Math.abs(a - b) + 1e-3;
  d = Math.min(max, Math.max(min, d));
  const end = s.clone().addScaledVector(dir, d);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1);
  p.normalize();
  return { joint: s.clone().addScaledVector(dir, x).addScaledVector(p, h), end };
}

/** Standpose mit haengenden Armen / standing pose with hanging arms */
export function standPose(hands?: [V3, V3]): Pose {
  return {
    pelvis: [0, 0.155, 0],
    handL: hands?.[0] ?? [-0.118, 0.14, 0.02],
    handR: hands?.[1] ?? [0.118, 0.14, 0.02],
    footL: [-0.046, 0.034, 0.01],
    footR: [0.046, 0.034, -0.01],
  };
}

/** Kniepose / kneeling pose */
export function kneelPose(hands: [V3, V3]): Pose {
  return {
    pelvis: [0, 0.105, 0],
    handL: hands[0],
    handR: hands[1],
    footL: [-0.046, 0.036, 0.085],
    footR: [0.046, 0.034, -0.085],
    kneePoleL: [0, 0.4, 1],
    kneePoleR: [0, -1, 0.5],
    bootR: [0.9, 0, 0],
  };
}

/** Sitzpose (Fahrzeug) / seated pose (vehicle) */
export function seatPose(hands: [V3, V3]): Pose {
  return {
    pelvis: [0, 0.03, 0],
    handL: hands[0],
    handR: hands[1],
    footL: [-0.046, -0.06, 0.1],
    footR: [0.046, -0.06, 0.1],
    kneePoleL: [0, 1, 0.3],
    kneePoleR: [0, 1, 0.3],
  };
}

/**
 * Soldat aufbauen (lokal: Fuesse auf y=0, Blick +z) / build a soldier (local: feet at y=0, facing +z).
 */
export function soldier(b: Builder, f: FactionId, pose: Pose, o: SoldierOpts = {}): void {
  const L = look(f);
  const d: Detail = o.detail ?? 2;
  const R = rng(o.seed ?? 1);
  // Teil-Geometrie je Detailstufe / part geometry per detail level
  const part = (w: number, h: number, dd: number, ch = 0.22, minDetail: Detail = 2) =>
    d >= minDetail ? (d === 2 ? geo.rbox(w, h, dd, Math.min(w, h, dd) * ch) : geo.cbox(w, h, dd, Math.min(w, dd) * ch)) : geo.box(w, h, dd);
  const Mp = xfMatrix({ p: pose.pelvis, r: pose.body });
  const Mt = Mp.clone().multiply(xfMatrix({ p: [0, TORSO_Y, 0], r: pose.twist }));
  const sleeve = o.coat ? L.primary : L.jacket;

  // ---- Becken + Oberkoerper + Kopf / pelvis + torso + head ----
  b.group({ p: pose.pelvis, r: pose.body }, () => {
    b.add(part(0.148, 0.05, 0.094, 0.22, 1), L.pants, { p: [0, 0, 0] });
    b.add(part(0.156, 0.022, 0.1, 0.25, 1), L.gear, { p: [0, 0.02, 0] });
    if (d >= 1) b.box(0.026, 0.02, 0.01, L.secondary, [0, 0.02, 0.051]);
    if (d === 2 && !o.coat) {
      // Taschen am Koppel / belt pouches
      for (const [x, z] of [[-0.05, 0.048], [0.05, 0.048]] as [number, number][]) {
        b.box(0.034, 0.032, 0.016, shade(L.gear, 0.85), [x, 0.008, z]);
        b.box(0.036, 0.008, 0.018, shade(L.gear, 0.7), [x, 0.022, z]);
      }
      // Handgranaten, Holster, Messer / grenades, holster, knife
      for (const x of [-0.02, 0.02]) b.add(geo.sphere(0.011, 6, 4), mix(L.gear, mat.dark, 0.5), { p: [x, 0.012, 0.055] });
      b.box(0.018, 0.05, 0.034, mat.dark, [0.084, -0.008, 0.006]);
      b.box(0.012, 0.04, 0.012, mat.wood, [-0.082, -0.01, -0.02]);
    }
    if (o.robe) {
      // Kutte bis zu den Knoecheln, zerfranster Saum / ankle-length robe, ragged hem
      b.add(d >= 1 ? geo.rtaper(0.21, 0.16, 0.158, 0.106, 0.13, 0.012) : geo.taper(0.21, 0.16, 0.158, 0.106, 0.13), L.jacket, { p: [0, -0.06, 0] });
      if (d >= 1) for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.box(0.03, 0.02, 0.012, shade(L.jacket, 0.8), [Math.sin(a) * 0.095, -0.123, Math.cos(a) * 0.072], [0, a, 0]);
      }
    }
    if (o.coat) {
      // Mantelschoss bis zum Knie / coat skirt to the knee
      b.add(d >= 1 ? geo.rtaper(0.2, 0.135, 0.158, 0.104, 0.1, 0.01) : geo.taper(0.2, 0.135, 0.158, 0.104, 0.1), L.primary, { p: [0, -0.04, 0] });
      b.box(0.012, 0.09, 0.006, L.primaryDark, [0.0, -0.04, 0.06], [0.08, 0, 0]);
    }
    b.group({ p: [0, TORSO_Y, 0], r: pose.twist }, () => {
      const jacket = o.coat ? L.primary : L.jacket;
      b.add(d >= 1 ? geo.ctaper(0.146, 0.09, 0.17, 0.102, 0.11, 0.016) : geo.taper(0.146, 0.09, 0.17, 0.102, 0.11), jacket, { p: [0, 0.055, 0] });
      if (o.coat) {
        // Kragen hochgeschlagen, Revers, Guertel / turned-up collar, lapels, belt
        for (const s of [-1, 1]) {
          b.add(geo.taper(0.05, 0.016, 0.06, 0.016, 0.06), shade(L.primary, 0.85), { p: [s * 0.04, 0.115, 0.04], r: [0.25, s * 0.35, s * -0.25] });
          b.box(0.03, 0.07, 0.006, shade(L.primary, 0.85), [s * 0.026, 0.07, 0.053], [0, 0, s * 0.3]);
        }
        b.add(part(0.168, 0.018, 0.104, 0.3, 1), L.primaryDark, { p: [0, 0.0, 0] });
        b.box(0.045, 0.03, 0.006, L.secondary, [0, 0.085, 0.052]);
      } else if (d >= 1) {
        b.box(0.07, 0.018, 0.06, shade(jacket, 0.85), [0, 0.108, 0.0]);
        if (d === 2) {
          for (const s of [-1, 1]) {
            b.box(0.014, 0.115, 0.008, L.gear, [s * 0.04, 0.058, 0.05]);
            b.box(0.03, 0.026, 0.01, shade(jacket, 0.82), [s * 0.045, 0.072, 0.051]);
            b.box(0.03, 0.008, 0.012, shade(jacket, 0.7), [s * 0.045, 0.086, 0.052]);
            b.box(0.016, 0.012, 0.006, L.secondary, [s * 0.026, 0.104, 0.04], [0.4, 0, 0]);
          }
          // Brustplakette mit Emblem / chest badge with emblem
          b.box(0.02, 0.02, 0.004, L.secondary, [-0.045, 0.098, 0.051]);
        }
      }
      if (o.robe) {
        // rote Schaerpe / red sash
        b.box(0.03, 0.16, 0.012, L.primary, [0, 0.055, 0.053], [0, 0, 0.7]);
        b.box(0.03, 0.16, 0.012, L.primary, [0, 0.055, -0.053], [0, 0, -0.7]);
        b.box(0.028, 0.08, 0.008, L.primary, [0.05, -0.03, 0.056], [0, 0, 0.1]);
      }
      // Fraktionszubehoer / faction extras
      if (f === 'meridon' && !o.coat) {
        b.add(d >= 1 ? geo.ctaper(0.156, 0.098, 0.176, 0.108, 0.08, 0.014) : geo.taper(0.156, 0.098, 0.176, 0.108, 0.08), L.secondary, { p: [0, 0.06, 0] });
        if (d >= 1) for (const s of [-1, 1]) b.box(0.034, 0.03, 0.012, shade(L.secondary, 0.75), [s * 0.04, 0.045, 0.056]);
      }
      if (f === 'korvat' && !o.coat) b.box(0.026, 0.13, 0.012, L.secondary, [0.0, 0.06, 0.053], [0, 0, 0.62]);
      if (f === 'dravon' && !o.coat) {
        b.add(geo.taper(0.1, 0.012, 0.08, 0.012, 0.05), L.secondary, { p: [0, 0.07, 0.052] });
        b.add(geo.taper(0.09, 0.01, 0.07, 0.01, 0.04), shade(L.jacket, 0.8), { p: [0, 0.07, 0.056] });
      }
      if (f === 'alvenia' && !o.coat && d >= 1) {
        b.box(0.11, 0.014, 0.008, L.secondary, [0, 0.08, 0.052]);
        b.box(0.11, 0.014, 0.008, L.secondary, [0, 0.04, 0.05]);
      }
      if (f === 'velkar' && !o.coat) {
        const n = d === 2 ? 5 : d === 1 ? 3 : 0;
        for (let i = 0; i < n; i++) {
          const front = R() < 0.6;
          const side = R() < 0.5 ? -1 : 1;
          const w = 0.026 + R() * 0.03, h = 0.018 + R() * 0.024, y = 0.015 + R() * 0.08;
          if (front) b.box(w, h, 0.008, mat.snow, [side * R() * 0.05, y, 0.051]);
          else b.box(0.008, h, w, mat.snow, [side * 0.082, y, (R() - 0.5) * 0.05]);
        }
        if (d >= 1) b.box(0.03, 0.016, 0.008, L.secondary, [-0.035, 0.09, 0.052]);
      }
      // Rucksack / pack
      if (o.pack === 'pack' || o.pack === 'pioneer') {
        b.add(part(0.12, 0.1, 0.055, 0.2, 1), L.gear, { p: [0, 0.058, -0.078] });
        if (d >= 1) {
          b.box(0.1, 0.03, 0.02, shade(L.gear, 0.85), [0, 0.03, -0.108]);
          if (o.pack === 'pack') b.cyl(0.022, 0.022, 0.13, d === 2 ? 10 : 8, L.secondary, [0, 0.118, -0.075], [0, 0, HALF_PI]);
        }
        if (d === 2 && o.pack === 'pack') b.cyl(0.018, 0.018, 0.045, 8, mat.metal, [0.075, 0.02, -0.06]);
      }
      if (o.pack === 'pioneer') {
        // Spitzhacke auf dem Ruecken / pickaxe on the back
        b.tube([-0.07, -0.02, -0.112], [0.08, 0.17, -0.112], 0.007, 6, mat.wood);
        b.group({ p: [0.08, 0.17, -0.112], r: [0, 0, 0.67] }, () => {
          b.add(geo.taper(0.018, 0.016, 0.006, 0.01, 0.07), mat.metalLight, { p: [0.035, 0, 0], r: [0, 0, -HALF_PI] });
          b.add(geo.taper(0.018, 0.016, 0.006, 0.01, 0.06), mat.metalLight, { p: [-0.03, 0, 0], r: [0, 0, HALF_PI] });
          b.box(0.02, 0.022, 0.02, mat.metal, [0, 0, 0]);
        });
      }
      if (o.pack === 'medbag') {
        b.add(part(0.15, 0.13, 0.075, 0.18, 1), mat.white, { p: [0, 0.065, -0.088] });
        b.add(part(0.156, 0.03, 0.08, 0.25, 1), L.primary, { p: [0, 0.085, -0.088] });
        if (d >= 1) {
          for (const s of [-1, 1]) b.box(0.03, 0.06, 0.05, mat.white, [s * 0.088, 0.045, -0.085]);
          b.box(0.13, 0.022, 0.07, shade(mat.white, 0.9), [0, 0.133, -0.088]);
        }
      }
      // Kopf / head
      b.group({ p: [0, NECK_Y, 0], r: pose.head, s: 1.1 }, () => {
        b.cyl(0.03, 0.034, 0.03, d === 2 ? 10 : 6, mat.skin, [0, -0.005, 0]);
        headgear(b, f, L, d, o.hat === 'fedora', o.seed ?? 1);
      });
    });
  });

  // ---- Arme / arms ----
  for (const side of [-1, 1] as const) {
    const S = new THREE.Vector3(side * SHOULDER_X, SHOULDER_Y, 0).applyMatrix4(Mt);
    const T = V(side < 0 ? pose.handL : pose.handR);
    const pole = V((side < 0 ? pose.elbowPoleL : pose.elbowPoleR) ?? [side * 0.8, -0.6, -0.35]);
    const { joint: E, end: H } = ik(S, T, UPPER, FORE, pole);
    b.segment(S, E, (len) => part(0.05, len + 0.014, 0.052), sleeve, (len) => {
      if (o.armband && side < 0) b.box(0.058, 0.024, 0.06, L.secondary, [0, len * 0.45, 0]);
      if (d === 2 && !o.armband && !o.coat) {
        b.box(0.054, 0.016, 0.03, L.secondary, [side * 0.004, len * 0.25, 0.0]);
        if (side < 0) addEmblem(b, f, 0.012, 0.004, L.emblem, { p: [-0.027, len * 0.55, 0], r: [0, -HALF_PI, 0] });
      }
      if (f === 'dravon' && !o.coat) b.box(0.064, 0.016, 0.064, L.secondary, [0, 0.004, 0]);
    });
    b.segment(E, H, (len) => part(0.046, Math.max(0.01, len - 0.022), 0.048, 0.22, 1).translate(0, -0.011, 0), sleeve, (len) => {
      if (d === 2) b.box(0.05, 0.014, 0.052, shade(sleeve, 0.82), [0, len - 0.03, 0]);
      b.add(part(0.04, 0.042, 0.044, 0.28), mat.skin, { p: [0, len, 0] });
    });
  }

  // ---- Beine / legs ----
  if (!o.noLegs) for (const side of [-1, 1] as const) {
    const S = new THREE.Vector3(side * HIP_X, HIP_Y, 0).applyMatrix4(Mp);
    const T = V(side < 0 ? pose.footL : pose.footR);
    const pole = V((side < 0 ? pose.kneePoleL : pose.kneePoleR) ?? [0, 0, 1]);
    const { joint: K, end: A } = ik(S, T, THIGH, SHIN, pole);
    b.segment(S, K, (len) => part(0.062, len + 0.014, 0.066), L.pants);
    b.segment(K, A, (len) => part(0.056, len + 0.006, 0.06, 0.22, 1), L.pants, (len) => {
      if (d === 2) {
        b.box(0.05, 0.03, 0.02, shade(L.gear, 0.9), [0, 0.006, 0.03]);
        b.box(0.062, 0.016, 0.066, mat.dark, [0, len - 0.004, 0]);
      }
    });
    b.group({ p: [A.x, A.y, A.z], r: (side < 0 ? pose.bootL : pose.bootR) ?? [0, 0, 0] }, () => {
      b.add(part(0.064, 0.04, 0.094, 0.22), mat.dark, { p: [0, -0.016, 0.014] });
      if (d === 2) {
        b.box(0.066, 0.008, 0.098, mat.ink, [0, -0.032, 0.014]);
        for (const z of [0.02, 0.035]) b.box(0.03, 0.004, 0.004, mat.paper, [0, 0.003, z]);
      }
      if (f === 'velkar' && d >= 1) b.box(0.068, 0.012, 0.03, mat.snow, [0, -0.004, -0.02]);
    });
  }
}

// ---------- Waffen / weapons ----------

export interface RifleOpts {
  len?: number;
  back?: number;
  scope?: boolean;
  /** Zweibein: Laenge der Beine / bipod: leg length */
  bipod?: number;
  detail?: Detail;
  heavy?: number;
}

/** Gewehr: Griff bei `grip`, Laufrichtung `dir` / rifle with grip at `grip`, barrel along `dir` */
export function rifle(b: Builder, grip: V3, dir: V3, o: RifleOpts = {}): void {
  const len = o.len ?? 0.27;
  const back = o.back ?? 0.1;
  const k = o.heavy ?? 1;
  const d = o.detail ?? 2;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  b.group({ p: grip, r: [e.x, e.y, e.z] }, () => {
    // Schaft / stock
    if (d >= 1) {
      b.add(geo.profileZY([[-back, -0.028 * k], [-back, 0.014 * k], [-0.035, 0.016 * k], [0.005, 0.012 * k], [0.005, -0.012 * k], [-0.045, -0.014 * k]], 0.024 * k), mat.wood);
      b.box(0.026 * k, 0.044 * k, 0.008, mat.dark, [0, -0.007, -back]);
    } else {
      b.box(0.024 * k, 0.04 * k, back, mat.wood, [0, -0.006, -back / 2]);
    }
    b.add(d >= 1 ? geo.taper(0.018, 0.022, 0.018, 0.018, 0.04) : geo.box(0.018, 0.04, 0.02), mat.dark, { p: [0, -0.024, 0.012], r: [-0.35, 0, 0] });
    b.add(d >= 1 ? geo.cbox(0.03 * k, 0.036 * k, 0.11, 0.007) : geo.box(0.03 * k, 0.036 * k, 0.11), mat.dark, { p: [0, 0, 0.055] });
    b.add(d >= 1 ? geo.taper(0.02, 0.028, 0.022, 0.026, 0.05) : geo.box(0.02, 0.05, 0.026), mat.dark, { p: [0, -0.038, 0.07], r: [0.3, 0, 0] });
    b.add(d >= 1 ? geo.cbox(0.032 * k, 0.03 * k, 0.09, 0.008) : geo.box(0.03 * k, 0.028 * k, 0.09), mat.woodLight, { p: [0, -0.002, 0.15] });
    const bl = len - 0.19;
    b.cyl(0.0075 * k, 0.0075 * k, bl, d === 2 ? 8 : 6, mat.metal, [0, 0.004, 0.19 + bl / 2], [HALF_PI, 0, 0]);
    b.cyl(0.011 * k, 0.011 * k, 0.025, d === 2 ? 8 : 6, mat.dark, [0, 0.004, len - 0.012], [HALF_PI, 0, 0]);
    b.box(0.006, 0.018, 0.008, mat.dark, [0, 0.016, len - 0.03]);
    if (d === 2) {
      // Schiene, Visier, Riemen, Bajonetthalter / rail, sights, sling, bayonet lug
      b.box(0.014, 0.008, 0.1, mat.ink, [0, 0.021, 0.07]);
      b.add(geo.rbox(0.014, 0.016, 0.022, 0.004), mat.dark, { p: [0, 0.03, 0.03] });
      b.box(0.004, 0.02, 0.004, mat.dark, [0, 0.018, len - 0.05]);
      b.box(0.004, 0.006, 0.17, mat.darkMid, [0.014, -0.022, 0.03]);
      b.box(0.01, 0.01, 0.02, mat.dark, [0, -0.012, 0.2]);
    }
    if (o.scope) {
      b.cyl(0.014, 0.014, 0.1, 10, mat.ink, [0, 0.038, 0.06], [HALF_PI, 0, 0]);
      b.cyl(0.019, 0.016, 0.026, 8, mat.ink, [0, 0.038, 0.12], [HALF_PI, 0, 0]);
      b.cyl(0.016, 0.019, 0.02, 8, mat.ink, [0, 0.038, 0.0], [HALF_PI, 0, 0]);
      b.cyl(0.015, 0.015, 0.004, 8, mat.glass, [0, 0.038, 0.134], [HALF_PI, 0, 0]);
      b.box(0.008, 0.02, 0.01, mat.dark, [0, 0.022, 0.035]);
      b.box(0.008, 0.02, 0.01, mat.dark, [0, 0.022, 0.085]);
    }
    if (o.bipod) {
      for (const s of [-1, 1]) b.tube([0, -0.006, len - 0.07], [s * 0.05, -o.bipod, len - 0.03], 0.0045, 5, mat.dark);
      b.cyl(0.008, 0.008, 0.02, 6, mat.dark, [0, -0.01, len - 0.07], [0, 0, HALF_PI]);
    }
  });
}

// ---------- Einheiten / units ----------

/** Zielpunkt entlang einer Waffe / point along a weapon */
function along(p: V3, dir: V3, t: number): V3 {
  const v = V(dir).normalize();
  return [p[0] + v.x * t, p[1] + v.y * t, p[2] + v.z * t];
}

export function infantry(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const d: Detail = lite ? 1 : 2;
  const G: V3 = [0.035, 0.2, 0.06];
  const D: V3 = [-0.3, 0.12, 1];
  soldier(b, f, {
    ...standPose([along(G, D, 0.092), G]),
    footL: [-0.05, 0.034, 0.04],
    footR: [0.052, 0.034, -0.035],
    bootR: [0, 0.35, 0],
    twist: [0, 0.45, 0],
    head: [0, -0.35, 0],
  }, { detail: d, pack: 'pack', seed: 11 });
  rifle(b, G, D, { len: 0.28, detail: d });
  return b;
}

export function sniper(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d: Detail = lite ? 0 : 2;
  // liegend, Koerper leicht schraeg zur Waffe / prone, body slightly angled to the weapon
  const yaw = 0.35;
  const G: V3 = [0.03, 0.078, 0.06];
  const inv = new THREE.Matrix4().makeRotationY(-yaw);
  const local = (p: V3): V3 => {
    const v = V(p).applyMatrix4(inv);
    return [v.x, v.y, v.z];
  };
  const pelvis: V3 = [0.0, 0.05, -0.14];
  const body: V3 = [HALF_PI, 0, 0];
  b.group({ p: [0, 0, 0], r: [0, yaw, 0] }, () => {
    soldier(b, f, {
      pelvis, body, head: [-1.2, 0, 0],
      handL: local(along(G, [0, 0, 1], 0.08)),
      handR: local(G),
      footL: [-0.07, 0.03, -0.255],
      footR: [0.06, 0.03, -0.26],
      bootL: [HALF_PI, 0.2, 0],
      bootR: [HALF_PI, -0.2, 0],
      kneePoleL: [0, -1, 0],
      kneePoleR: [0, -1, 0],
      elbowPoleL: [-0.6, -1, 0],
      elbowPoleR: [0.6, -1, 0],
    }, { detail: d, armband: true, seed: 23 });
    // Ghillie-Tarnung auf Ruecken und Beinen / ghillie camo on back and legs
    const R = rng(77);
    const tones = [mat.leaf, mat.leafDark, mat.grass, mix(mat.leaf, L.primary, 0.3)];
    const n = lite ? 8 : 26;
    b.group({ p: pelvis, r: body }, () => {
      for (let i = 0; i < n; i++) {
        const y = -0.12 + R() * 0.27;
        const x = (R() - 0.5) * (y < 0 ? 0.13 : 0.16);
        const s = 0.026 + R() * 0.018;
        b.add(geo.ico(s, 0), tones[i % tones.length], { p: [x, y, -0.05 - R() * 0.02], r: [R() * 3, R() * 3, R() * 3], s: [1, 1, 0.6] });
      }
      if (!lite) {
        // Ghillie-Kapuze um den Kopf / ghillie hood around the head
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          b.add(geo.cone(0.014, 0.07, 4), tones[i % 4], { p: [Math.cos(a) * 0.07, 0.2 + Math.sin(a) * 0.03, -0.02 + Math.sin(a) * 0.04], r: [-0.6 + (R() - 0.5) * 0.6, 0, Math.cos(a) * 1.2] });
        }
      }
      if (!lite) for (let i = 0; i < 24; i++) {
        const y = -0.05 + R() * 0.2;
        const x = (R() < 0.5 ? -1 : 1) * (0.07 + R() * 0.02);
        b.add(geo.cone(0.012, 0.06, 4), tones[(i + 1) % 4], { p: [x, y, -0.04], r: [R() - 0.5, 0, (x > 0 ? -1 : 1) * (1.2 + R() * 0.4)] });
      }
    });
  });
  rifle(b, G, [0, -0.02, 1], { len: 0.4, back: 0.11, scope: true, bipod: 0.075, detail: lite ? 1 : 2 });
  return b;
}

function sandbag(b: Builder, x: number, y: number, z: number, ry: number, d: Detail) {
  b.add(d >= 1 ? geo.ctaper(0.118, 0.072, 0.1, 0.056, 0.046, 0.016) : geo.taper(0.118, 0.072, 0.1, 0.056, 0.046), mat.sandbag, { p: [x, y + 0.023, z], r: [0, ry, 0] });
}

export function pioneer(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const d: Detail = lite ? 1 : 2;
  // Schaufel schraeg vor dem Koerper / shovel held diagonally in front
  const G: V3 = [0.075, 0.215, -0.02];
  const B: V3 = [-0.075, 0.03, 0.15];
  const D: V3 = [B[0] - G[0], B[1] - G[1], B[2] - G[2]];
  b.group({ p: [0, 0, -0.1] }, () => {
    soldier(b, f, {
      ...standPose([along(G, D, 0.11), G]),
      twist: [0, 0.25, 0],
      head: [0.1, -0.2, 0],
      footL: [-0.05, 0.034, 0.03],
      footR: [0.05, 0.034, -0.02],
    }, { detail: d, pack: 'pioneer', seed: 31 });
    const len = V(D).length();
    b.tube(along(G, D, -0.02), along(G, D, len - 0.04), 0.008, 6, mat.wood);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(D).normalize().negate());
    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
    b.group({ p: along(G, D, -0.03), r: [e.x, e.y, e.z] }, () => {
      b.add(geo.rbox(0.05, 0.012, 0.012, 0.003), mat.dark, { p: [0, 0.0, 0] });
    });
    b.group({ p: along(G, D, len - 0.02), r: [e.x, e.y, e.z] }, () => {
      b.add(d >= 1 ? geo.rtaper(0.06, 0.012, 0.072, 0.008, 0.08, 0.004) : geo.taper(0.06, 0.012, 0.072, 0.008, 0.08), mat.metalLight, { p: [0, -0.045, 0] });
      b.cyl(0.011, 0.014, 0.025, 6, mat.metal, [0, -0.005, 0]);
    });
  });
  // Sandsackstapel / sandbag stack
  sandbag(b, -0.13, 0, 0.21, 0.35, d);
  sandbag(b, -0.01, 0, 0.24, 0.05, d);
  sandbag(b, 0.11, 0, 0.22, -0.3, d);
  if (!lite) sandbag(b, -0.07, 0.046, 0.225, 0.2, d);
  sandbag(b, 0.05, 0.046, 0.23, -0.12, d);
  if (!lite) sandbag(b, -0.01, 0.092, 0.23, 0.05, d);
  if (!lite) sandbag(b, 0.23, 0, 0.1, -1.0, 1);
  return b;
}

export function mgTeam(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const gy = 0.155;
  // Dreibein + schweres MG / tripod + heavy MG
  b.group({ p: [0, 0, 0.08] }, () => {
    for (const [x, z] of [[0.09, 0.09], [-0.09, 0.09], [0, -0.12]] as [number, number][]) {
      b.tube([0, gy - 0.025, 0.0], [x, 0.004, z], 0.007, 6, mat.dark);
    }
    b.cyl(0.016, 0.02, 0.03, 8, mat.dark, [0, gy - 0.03, 0]);
    b.add(geo.cbox(0.05, 0.052, 0.14, 0.01), mat.dark, { p: [0, gy, 0.0] });
    b.box(0.044, 0.014, 0.1, mat.metal, [0, gy + 0.032, 0.0]);
    b.box(0.012, 0.03, 0.04, mat.dark, [0, gy + 0.05, 0.02]);
    // Laufmantel mit Kuehlringen / barrel jacket with cooling rings
    b.cyl(0.021, 0.021, 0.18, 12, mat.metal, [0, gy + 0.004, 0.16], [HALF_PI, 0, 0]);
    if (!lite) for (const z of [0.11, 0.16, 0.21]) b.add(geo.cyl(0.025, 0.025, 0.008, 12, true), mat.dark, { p: [0, gy + 0.004, z], r: [HALF_PI, 0, 0] });
    b.cyl(0.009, 0.009, 0.06, 8, mat.ink, [0, gy + 0.004, 0.28], [HALF_PI, 0, 0]);
    b.cyl(0.016, 0.013, 0.03, 8, mat.dark, [0, gy + 0.004, 0.3], [HALF_PI, 0, 0]);
    // Griffe / grips
    for (const s of [-1, 1]) b.box(0.012, 0.035, 0.012, mat.wood, [s * 0.03, gy - 0.005, -0.075], [0.3, 0, 0]);
    // Schutzschild mit Fraktionsfarbe + Emblem / gun shield in faction colour + emblem
    b.add(geo.rtaper(0.15, 0.012, 0.13, 0.012, 0.1, 0.006), L.primary, { p: [0, gy + 0.03, 0.075], r: [-0.12, 0, 0] });
    b.box(0.152, 0.016, 0.016, L.secondary, [0, gy + 0.077, 0.08], [-0.12, 0, 0]);
    b.box(0.04, 0.03, 0.006, L.secondary, [0.045, gy + 0.035, 0.083], [-0.12, 0, 0]);
    if (!lite) addEmblem(b, f, 0.022, 0.006, L.emblem, { p: [-0.035, gy + 0.03, 0.084], r: [-0.12, 0, 0] });
    // Munitionskasten + Gurt / ammo box + belt
    b.add(geo.cbox(0.07, 0.055, 0.045, 0.01), L.gear, { p: [0.085, 0.028, 0.0] });
    b.box(0.03, 0.012, 0.03, mat.dark, [0.085, 0.06, 0.0]);
    const n = lite ? 3 : 16;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p: V3 = [0.075 - t * 0.05, 0.06 + Math.sin(t * Math.PI) * 0.06 + t * 0.03, 0.0];
      b.box(0.012, 0.026, 0.009, mat.gold, p, [0, 0, 0.6 - t * 0.9]);
      if (!lite) b.box(0.014, 0.006, 0.011, mat.dark, [p[0], p[1] - 0.01, p[2]], [0, 0, 0.6 - t * 0.9]);
    }
    if (!lite) {
      // Zweibein vorn am Lauf + Deckel am Kasten / bipod at the barrel front + box lid
      for (const sx of [-1, 1]) b.tube([0, gy - 0.005, 0.25], [sx * 0.045, 0.004, 0.29], 0.004, 5, mat.dark);
      b.cyl(0.008, 0.008, 0.02, 6, mat.dark, [0, gy - 0.005, 0.25], [0, 0, HALF_PI]);
      b.add(geo.cbox(0.072, 0.008, 0.047, 0.006), shade(L.gear, 0.8), { p: [0.085, 0.058, 0.0] });
      b.box(0.03, 0.006, 0.006, mat.dark, [0.085, 0.066, 0.0]);
      // Ersatzlauf-Tasche / spare barrel bag
      b.add(geo.cyl(0.014, 0.014, 0.16, 8), L.gear, { p: [-0.09, 0.016, 0.1], r: [HALF_PI, 0.5, 0] });
    }
  });
  // Schuetze kniend an den Griffen / gunner kneeling at the grips
  b.group({ p: [0, 0, -0.1] }, () =>
    soldier(b, f, { ...kneelPose([[-0.03, gy - 0.005, 0.105], [0.03, gy - 0.005, 0.105]]), head: [0.25, 0, 0] }, { detail: lite ? 0 : 1, seed: 41 }),
  );
  // Ladeschuetze mit Gurt / loader feeding the belt
  if (!lite) b.group({ p: [-0.19, 0, -0.03], r: [0, 0.85, 0] }, () => {
    soldier(b, f, kneelPose([[-0.03, 0.15, 0.11], [0.04, 0.14, 0.11]]), { detail: 0, pack: 'pack', seed: 43 });
    b.add(geo.cbox(0.07, 0.05, 0.045, 0.01), L.gear, { p: [0.0, 0.025, 0.14] });
  });
  return b;
}

export function medic(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d: Detail = lite ? 1 : 2;
  soldier(b, f, {
    ...standPose([[-0.105, 0.155, 0.07], [0.125, 0.13, 0.03]]),
    twist: [0, -0.1, 0],
  }, { detail: d, pack: 'medbag', armband: true, seed: 51 });
  // zusammengerollte Trage auf dem Rucksack / rolled stretcher on the pack
  if (!lite) {
    for (const dz of [-0.012, 0.012]) b.tube([-0.12, 0.335, -0.1 + dz], [0.12, 0.335, -0.1 + dz], 0.005, 6, mat.wood);
    b.cyl(0.022, 0.022, 0.19, 12, mix(mat.white, mat.sand, 0.4), [0, 0.335, -0.1], [0, 0, HALF_PI]);
    for (const x of [-0.06, 0.06]) b.add(geo.torus(0.024, 0.004, 3, 12), L.gear, { p: [x, 0.335, -0.1], r: [0, HALF_PI, 0] });
  }
  // Umhaengetasche mit Riemen (kein Schutzzeichen) / shoulder satchel with strap (no protective emblem)
  b.box(0.018, 0.21, 0.012, mat.white, [0.0, 0.235, 0.054], [0, 0, 0.75]);
  b.add(geo.rbox(0.04, 0.07, 0.085, 0.01), mat.white, { p: [-0.1, 0.165, 0.0] });
  b.add(geo.rbox(0.042, 0.02, 0.087, 0.005), L.primary, { p: [-0.1, 0.18, 0.0] });
  // weisser Koffer in der Hand / white case in hand
  b.add(geo.rbox(0.032, 0.065, 0.085, 0.01), mat.white, { p: [0.128, 0.08, 0.03] });
  b.add(geo.rbox(0.034, 0.016, 0.087, 0.004), L.primary, { p: [0.128, 0.08, 0.03] });
  b.add(geo.rbox(0.012, 0.014, 0.04, 0.003), L.secondary, { p: [0.128, 0.118, 0.03] });
  if (!lite) addEmblem(b, f, 0.018, 0.004, L.primary, { p: [0.145, 0.08, 0.03], r: [0, HALF_PI, 0] });
  return b;
}

export function spy(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d: Detail = lite ? 1 : 2;
  soldier(b, f, {
    ...standPose([[-0.1, 0.165, 0.045], [0.125, 0.135, -0.01]]),
    footL: [-0.045, 0.034, 0.025],
    footR: [0.047, 0.034, -0.02],
    head: [0.1, 0.25, 0],
  }, { detail: d, coat: true, hat: 'fedora', seed: 61 });
  if (!lite) {
    // Mantelknoepfe, Taschenklappen, Schulterklappen / coat buttons, pocket flaps, epaulettes
    for (const y of [0.2, 0.225, 0.25]) for (const x of [-0.03, 0.03]) b.add(geo.sphere(0.005, 5, 3), mat.dark, { p: [x, y, 0.058] });
    for (const s of [-1, 1]) {
      b.box(0.05, 0.012, 0.03, L.primaryDark, [s * 0.075, 0.15, 0.048], [0, s * 0.5, 0]);
      b.box(0.04, 0.008, 0.05, L.primaryDark, [s * 0.08, 0.287, -0.005]);
    }
    // Zeitung unter dem Arm / newspaper under the arm
    b.add(geo.rbox(0.012, 0.05, 0.07, 0.004), mat.paper, { p: [-0.118, 0.2, 0.0], r: [0, 0, 0.15] });
    b.box(0.013, 0.008, 0.06, mat.ink, [-0.118, 0.21, 0.0], [0, 0, 0.15]);
  }
  // Schal in Zweitfarbe / scarf in secondary colour
  b.add(geo.rbox(0.11, 0.022, 0.09, 0.008), L.secondary, { p: [0, 0.29, 0.005] });
  b.add(geo.rbox(0.03, 0.07, 0.012, 0.004), L.secondary, { p: [0.03, 0.25, 0.055], r: [0.1, 0, 0.1] });
  // Aktentasche / briefcase
  b.add(geo.rbox(0.03, 0.07, 0.095, 0.008), mat.dark, { p: [0.128, 0.08, -0.01] });
  b.add(geo.rbox(0.032, 0.012, 0.097, 0.003), shade(mat.dark, 1.4), { p: [0.128, 0.1, -0.01] });
  b.add(geo.rbox(0.01, 0.016, 0.034, 0.003), mat.gold, { p: [0.128, 0.122, -0.01] });
  for (const z of [-0.035, 0.015]) b.box(0.034, 0.012, 0.012, mat.gold, [0.128, 0.104, z]);
  return b;
}

