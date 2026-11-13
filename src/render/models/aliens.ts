/**
 * Einheiten der Zyrr (Fremdwesen) / Zyrr (alien) units:
 * Grauer (kleiner Fremder mit Lasergewehr), Terraformer (schwebendes Wesen mit Sporenstrahl),
 * Gleiter (Schwebescheibe), Mech (Zweibeiner mit Rueckwaertsknien), Dreibeiner (Untertasse mit Todesstrahl).
 * Grey (small alien with laser rifle), terraformer (floating creature with spore beam),
 * skimmer (hover disc), mech (biped with reverse knees), tripod (saucer with death ray).
 * Grundstoffe bleiben fremdartig, Fraktionsfarben kommen vom Besitzer / base materials stay alien, faction colours come from the owner.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { alienHead } from './headgear';
import { Builder, geo, mix, rng, type ColorLike, type V3 } from './kit';
import { look, mat, type Look } from './look';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Glieder-Kette durch Punkte / jointed chain through points */
function chain(b: Builder, pts: V3[], r0: number, r1: number, seg: number, c: ColorLike, joint: ColorLike | null) {
  for (let i = 0; i < pts.length - 1; i++) {
    const ra = r0 + (r1 - r0) * (i / (pts.length - 1));
    const rb = r0 + (r1 - r0) * ((i + 1) / (pts.length - 1));
    b.tube(pts[i], pts[i + 1], ra, seg, c, rb);
    if (joint && i > 0) b.add(geo.sphere(ra * 1.15, seg, Math.max(3, seg / 2)), joint, { p: pts[i] });
  }
}

/** Quadratische Bezierkurve / quadratic Bezier curve */
function bezier(a: V3, c: V3, e: V3, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(lerp3(lerp3(a, c, t), lerp3(c, e, t), t));
  }
  return out;
}

/** Lasergewehr entlang dir, Griff bei grip / laser rifle along dir, grip at grip */
function laserRifle(b: Builder, L: Look, grip: V3, dir: V3, lite: boolean) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  b.group({ p: grip, r: [e.x, e.y, e.z], s: lite ? 1 : 1.4 }, () => {
    b.add(geo.rtaper(0.022, 0.06, 0.03, 0.08, 0.034, 0.008, 0.01), mat.alienMetal, { p: [0, 0.004, -0.04] });
    b.add(geo.rbox(0.03, 0.036, 0.13, 0.01), L.primaryDark, { p: [0, 0.004, 0.06] });
    b.add(geo.rtaper(0.016, 0.02, 0.014, 0.016, 0.04, 0.004), mat.alienMetal, { p: [0, -0.024, 0.01], r: [-0.3, 0, 0] });
    b.cyl(0.009, 0.012, 0.11, lite ? 6 : 10, mat.alienMetalLight, [0, 0.006, 0.17], [HALF_PI, 0, 0]);
    for (let i = 0; i < 3; i++) b.add(geo.torus(0.013, 0.004, 3, lite ? 6 : 8), mat.acid, { p: [0, 0.006, 0.14 + i * 0.03] });
    b.add(geo.ico(0.014, 0), mat.acid, { p: [0, 0.006, 0.235] });
    b.cyl(0.008, 0.008, 0.04, 8, mat.acid, [0.018, 0.0, 0.05], [HALF_PI, 0, 0]);
    b.add(geo.taper(0.004, 0.05, 0.002, 0.02, 0.02), L.secondary, { p: [0, 0.03, 0.07] });
  });
}

// ---------- Grauer / grey ----------

export function grey(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const seg = lite ? 6 : 8;
  // duenne Beine mit Dreizehenfuessen / thin legs with three-toed feet
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.03, 0.13, 0];
    const knee: V3 = [s * 0.036, 0.075, 0.02];
    const ankle: V3 = [s * 0.038, 0.018, -0.004];
    chain(b, [hip, knee, ankle], 0.015, 0.01, seg, L.pants, L.pants);
    for (const a of lite ? [0] : [-0.45, 0, 0.45]) {
      b.add(geo.taper(0.012, 0.01, 0.006, 0.006, 0.05), L.gear, { p: [s * 0.038 + Math.sin(a) * 0.022, 0.006, 0.018 + Math.cos(a) * 0.012], r: [HALF_PI, a, 0] });
    }
    b.add(geo.sphere(0.014, seg, 4), L.gear, { p: ankle });
  }
  // Anzug / suit
  b.add(geo.rtaper(0.07, 0.05, 0.06, 0.045, 0.04, 0.01), L.pants, { p: [0, 0.14, 0] });
  b.add(geo.rtaper(0.066, 0.05, 0.088, 0.06, 0.085, 0.014), L.jacket, { p: [0, 0.18, 0] });
  b.add(geo.rtaper(0.06, 0.012, 0.074, 0.012, 0.06, 0.004), L.secondary, { p: [0, 0.188, 0.03] });
  b.add(geo.sphere(0.013, seg, 5), mat.acid, { p: [0, 0.19, 0.038] });
  b.box(0.08, 0.012, 0.062, L.gear, [0, 0.142, 0]);
  for (const s of [-1, 1]) b.add(geo.sphere(0.02, seg, 5), L.primary, { p: [s * 0.048, 0.212, 0], s: [1, 0.7, 1] });
  if (!lite) {
    addEmblem(b, f, 0.012, 0.004, L.secondary, { p: [-0.064, 0.214, 0], r: [0, -HALF_PI, 0] });
    b.add(geo.rbox(0.05, 0.05, 0.03, 0.008), mat.alienMetal, { p: [0, 0.19, -0.04] });
    b.cyl(0.008, 0.008, 0.05, 8, mat.acid, [0, 0.19, -0.058]);
  }
  // Hals + grosser Kopf / neck + big head
  b.tube([0, 0.215, 0], [0, 0.24, 0.005], 0.012, seg, mat.alienSkin);
  b.group({ p: [0, 0.228, 0.004], s: 1.22 }, () => alienHead(b, L, lite ? 0 : 2));
  // Lasergewehr + Arme / laser rifle + arms
  const G: V3 = [0.035, 0.15, 0.04];
  const D: V3 = [-0.18, 0.1, 1];
  const n = V(D).normalize();
  const H2: V3 = [G[0] + n.x * 0.1, G[1] + n.y * 0.1, G[2] + n.z * 0.1];
  for (const [s, hand] of [[1, G], [-1, H2]] as [number, V3][]) {
    const sh: V3 = [s * 0.05, 0.205, 0];
    const el: V3 = [s * 0.06 + (hand[0] - s * 0.05) * 0.3, (0.205 + hand[1]) / 2 - 0.03, hand[2] * 0.4];
    chain(b, [sh, el, hand], 0.009, 0.007, seg, L.jacket, mat.alienSkin);
    b.add(geo.sphere(0.012, seg, 4), mat.alienSkin, { p: hand });
    if (!lite) for (const a of [-0.4, 0, 0.4]) b.box(0.004, 0.004, 0.022, mat.alienSkin, [hand[0] + Math.sin(a) * 0.008, hand[1] - 0.006, hand[2] + 0.012], [0, a, 0]);
  }
  laserRifle(b, L, G, D, lite);
  return b;
}

// ---------- Terraformer ----------

export function terraformer(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const seg = lite ? 6 : 10;
  const C: V3 = [0, 0.27, -0.03];
  // schwebender Panzerkoerper / floating carapace body
  b.add(geo.hemi(0.115, lite ? 10 : 16, lite ? 4 : 5), L.primary, { p: C, s: [1, 0.78, 1.15] });
  b.add(geo.sphere(0.105, lite ? 10 : 14, lite ? 5 : 7), mat.alienSkin, { p: [C[0], C[1] - 0.005, C[2]], s: [1, 0.55, 1.1] });
  if (!lite) {
    for (let i = 0; i < 3; i++) b.add(geo.torus(0.1 - i * 0.025, 0.006, 3, 16), L.secondary, { p: [C[0], C[1] + 0.035 + i * 0.022, C[2]], r: [HALF_PI, 0, 0], s: [1, 1.15, 1] });
    addEmblem(b, f, 0.026, 0.004, L.secondary, { p: [C[0], C[1] + 0.09, C[2] - 0.01], r: [-HALF_PI, 0, 0] });
  }
  // drei Augen / three eyes
  for (const [x, y] of [[-0.035, 0.0], [0.035, 0.0], [0, 0.03]] as [number, number][]) {
    b.add(geo.sphere(0.018, seg, 5), mat.ink, { p: [x, C[1] + y, C[2] + 0.115] });
    b.add(geo.sphere(0.006, 6, 3), mat.acid, { p: [x, C[1] + y + 0.004, C[2] + 0.13] });
  }
  // Tankbehaelter mit leuchtender Fluessigkeit / tank with glowing fluid
  b.cyl(0.03, 0.03, 0.08, seg, mat.acid, [0, C[1] + 0.06, C[2] - 0.11], [HALF_PI * 0.6, 0, 0]);
  for (const dz of [-0.04, 0.04]) b.cyl(0.034, 0.034, 0.01, seg, mat.alienMetal, [0, C[1] + 0.06 + dz * 0.8, C[2] - 0.11 - dz * 0.6], [HALF_PI * 0.6, 0, 0]);
  // vier Tentakelbeine / four tentacle legs
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const s0: V3 = [Math.sin(a) * 0.06, C[1] - 0.04, C[2] + Math.cos(a) * 0.06];
    const c1: V3 = [Math.sin(a) * 0.24, C[1] + 0.02, C[2] + Math.cos(a) * 0.24];
    const e: V3 = [Math.sin(a) * 0.27, 0.01, C[2] + Math.cos(a) * 0.27];
    const pts = bezier(s0, c1, e, lite ? 3 : 4);
    chain(b, pts, 0.018, 0.007, lite ? 5 : 7, mat.alienSkinDark, lite ? null : L.primary);
    b.add(geo.sphere(0.012, seg, 4), mat.acid, { p: e });
  }
  // Terraform-Emitter mit Sporenstrahl / terraforming emitter with spore beam
  const arm0: V3 = [0, C[1] - 0.05, C[2] + 0.07];
  const nozzle: V3 = [0, 0.17, 0.15];
  b.tube(arm0, nozzle, 0.014, seg, mat.alienMetal);
  b.add(geo.cyl(0.03, 0.012, 0.05, seg), mat.alienMetalLight, { p: [0, 0.155, 0.165], r: [0.6, 0, 0] });
  for (let i = 0; i < 2; i++) b.add(geo.torus(0.022 + i * 0.006, 0.004, 3, 10), mat.acid, { p: [0, 0.15 - i * 0.012, 0.172 + i * 0.008], r: [HALF_PI + 0.6, 0, 0] });
  const lens: V3 = [0, 0.13, 0.19];
  b.add(geo.sphere(0.018, seg, 5), mat.xenoGlow, { p: lens });
  b.tube(lens, [0, 0.004, 0.3], 0.01, lite ? 6 : 12, mix(mat.xenoGlow, L.primary, 0.25), 0.05);
  b.cyl(0.075, 0.08, 0.004, lite ? 8 : 14, mat.xenoGlow, [0, 0.002, 0.3]);
  if (!lite) {
    const R = rng(91);
    for (let i = 0; i < 10; i++) {
      const t = R();
      const p = lerp3(lens, [0, 0.0, 0.3], t);
      b.add(geo.ico(0.006 + R() * 0.006, 0), i % 2 ? mat.acid : mat.xenoGlow, { p: [p[0] + (R() - 0.5) * 0.08, p[1] + 0.01, p[2] + (R() - 0.5) * 0.06] });
    }
  }
  return b;
}

// ---------- Gleiter / skimmer ----------

export function skimmer(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const y = 0.16;
  const ws = lite ? 12 : 24;
  // Linsenscheibe / lens disc
  b.add(geo.hemi(0.19, ws, lite ? 3 : 5), L.primary, { p: [0, y, 0], s: [1, 0.28, 1.1] });
  b.add(geo.hemi(0.18, ws, lite ? 3 : 4), mat.alienMetal, { p: [0, y, 0], r: [Math.PI, 0, 0], s: [1, 0.22, 1.08] });
  b.add(geo.torus(0.19, 0.012, 4, ws), L.secondary, { p: [0, y, 0], r: [HALF_PI, 0, 0], s: [1, 1.1, 1] });
  // Kanzel / canopy
  b.add(geo.hemi(0.06, lite ? 10 : 16, 4), mix(mat.xenoGlow, mat.glassDark, 0.55), { p: [0, y + 0.045, 0.03], s: [1, 0.9, 1.25] });
  b.add(geo.torus(0.06, 0.006, 3, lite ? 10 : 16), mat.alienMetalLight, { p: [0, y + 0.047, 0.03], r: [HALF_PI, 0, 0], s: [1, 1.25, 1] });
  // Heckflossen / tail fins
  for (const s of [-1, 1]) {
    b.add(geo.profileXY([[0, 0], [0.12, 0.0], [0.06, 0.05]], 0.012), L.primary, { p: [s * 0.08, y + 0.03, -0.16], r: [0, s > 0 ? 0.5 : Math.PI - 0.5, 0.3 * s] });
    b.box(0.08, 0.006, 0.014, mat.acid, [s * 0.13, y + 0.035, -0.17], [0, s * 0.5, s * 0.3]);
  }
  // Bugzinken mit Laserkanonen / nose prongs with laser cannons
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.03, 0.06, 0.02, 0.06, 0.02, 0.006), L.primaryDark, { p: [s * 0.06, y + 0.005, 0.22], r: [HALF_PI, 0, 0] });
    b.cyl(0.008, 0.008, 0.06, lite ? 6 : 10, mat.alienMetalLight, [s * 0.06, y + 0.005, 0.27], [HALF_PI, 0, 0]);
    b.add(geo.ico(0.011, lite ? 0 : 1), mat.acid, { p: [s * 0.06, y + 0.005, 0.305] });
  }
  // leuchtende Unterseite + Bodenwellen / glowing underside + ground ripples
  b.add(geo.torus(0.1, 0.01, 4, ws), mat.acid, { p: [0, y - 0.036, 0], r: [HALF_PI, 0, 0] });
  b.cyl(0.06, 0.06, 0.008, ws, mat.xenoGlow, [0, y - 0.04, 0]);
  if (!lite) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.add(geo.sphere(0.012, 8, 4), mat.xenoGlow, { p: [Math.sin(a) * 0.15, y - 0.018, Math.cos(a) * 0.16] });
    }
    for (const r of [0.13, 0.22]) b.add(geo.torus(r, 0.005, 3, ws), mix(mat.xenoGlow, mat.white, 0.3), { p: [0, 0.003, 0], r: [HALF_PI, 0, 0], s: [1, 1, 0.3] });
    addEmblem(b, f, 0.03, 0.004, L.secondary, { p: [0, y + 0.05, -0.1], r: [-HALF_PI + 0.25, 0, 0] });
  }
  return b;
}

// ---------- Mech ----------

export function mech(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const seg = lite ? 6 : 12;
  // Beine mit Rueckwaertsknien / legs with reverse knees
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.075, 0.22, -0.01];
    const knee: V3 = [s * 0.088, 0.14, 0.07];
    const ankle: V3 = [s * 0.088, 0.05, -0.03];
    b.segment(V(hip), V(knee), (l) => geo.rbox(0.05, l + 0.02, 0.055, 0.012), L.primary);
    b.segment(V(knee), V(ankle), (l) => geo.rbox(0.04, l + 0.01, 0.045, 0.01), mat.alienMetal);
    if (!lite) b.tube([s * 0.11, 0.2, 0.0], [s * 0.11, 0.12, 0.05], 0.007, 8, mat.alienMetalLight);
    for (const j of [hip, knee, ankle]) b.add(geo.sphere(0.026, lite ? 6 : 10, lite ? 3 : 5), mat.alienMetal, { p: j });
    if (!lite) b.add(geo.torus(0.028, 0.005, 3, 12), mat.acid, { p: knee, r: [0, 0, HALF_PI] });
    // Dreizehenfuss mit Sporn / three-toed foot with spur
    for (const a of [-0.4, 0, 0.4]) b.add(geo.rtaper(0.022, 0.06, 0.012, 0.03, 0.022, 0.005), mat.alienMetal, { p: [s * 0.088 + Math.sin(a) * 0.03, 0.012, -0.03 + Math.cos(a) * 0.04], r: [0, a, 0] });
    b.add(geo.taper(0.016, 0.04, 0.008, 0.02, 0.02), mat.alienMetal, { p: [s * 0.088, 0.012, -0.07] });
  }
  b.add(geo.rbox(0.14, 0.05, 0.08, 0.014), mat.alienMetal, { p: [0, 0.225, -0.01] });
  // Kanzel mit kleinem Fremden / cockpit with a little alien
  b.add(geo.rtaper(0.2, 0.2, 0.16, 0.14, 0.11, 0.024, 0.01), L.primary, { p: [0, 0.3, -0.005] });
  b.add(geo.rtaper(0.13, 0.03, 0.11, 0.02, 0.06, 0.006), mix(mat.xenoGlow, mat.glassDark, 0.5), { p: [0, 0.33, 0.085], r: [-0.45, 0, 0] });
  b.group({ p: [0, 0.335, 0.03], s: 0.75 }, () => alienHead(b, L, lite ? 0 : 1));
  for (const s of [-1, 1]) {
    b.box(0.006, 0.02, 0.15, L.secondary, [s * 0.098, 0.31, -0.005]);
    if (!lite) addEmblem(b, f, 0.026, 0.006, L.secondary, { p: [s * 0.102, 0.28, -0.03], r: [0, s * HALF_PI, 0] });
  }
  // Schultern + Armkanonen / shoulders + arm cannons
  for (const s of [-1, 1]) {
    b.add(geo.sphere(0.035, lite ? 6 : 10, lite ? 3 : 5), mat.alienMetal, { p: [s * 0.115, 0.315, 0] });
    b.add(geo.rbox(0.05, 0.05, 0.08, 0.014), L.primaryDark, { p: [s * 0.14, 0.28, 0.02] });
    b.cyl(0.026, 0.03, 0.2, seg, mat.alienMetal, [s * 0.14, 0.27, 0.15], [HALF_PI, 0, 0]);
    for (let i = 0; i < (lite ? 1 : 3); i++) b.add(geo.torus(0.031, 0.005, 3, seg), mat.acid, { p: [s * 0.14, 0.27, 0.1 + i * 0.045] });
    b.cyl(0.02, 0.02, 0.012, seg, mat.ink, [s * 0.14, 0.27, 0.255], [HALF_PI, 0, 0]);
    b.add(geo.ico(0.012, lite ? 0 : 1), mat.acid, { p: [s * 0.14, 0.27, 0.262] });
  }
  if (!lite) {
    // Raketenkapsel links, Sensor + Antenne rechts / missile pod left, sensor + antenna right
    b.add(geo.cbox(0.06, 0.05, 0.07, 0.01), L.primaryDark, { p: [-0.11, 0.37, -0.02] });
    for (const x of [-0.125, -0.095]) for (const y of [0.36, 0.38]) b.cyl(0.007, 0.007, 0.006, 8, mat.ink, [x, y, 0.016], [HALF_PI, 0, 0]);
    b.add(geo.rbox(0.03, 0.025, 0.035, 0.006), mat.alienMetal, { p: [0.1, 0.37, 0.01] });
    b.box(0.02, 0.01, 0.004, mat.acid, [0.1, 0.372, 0.03]);
    b.tube([0.11, 0.38, -0.04], [0.12, 0.5, -0.07], 0.003, 4, mat.dark);
    b.add(geo.ico(0.008, 0), mat.acid, { p: [0.12, 0.505, -0.071] });
    // Reaktor am Ruecken / reactor on the back
    b.cyl(0.03, 0.03, 0.07, seg, mat.acid, [0, 0.3, -0.1]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.box(0.006, 0.08, 0.006, mat.alienMetal, [Math.sin(a) * 0.034, 0.3, -0.1 + Math.cos(a) * 0.034]);
    }
    for (const s of [-1, 1]) b.cyl(0.012, 0.014, 0.04, 8, mat.alienMetalLight, [s * 0.05, 0.35, -0.08], [-0.4, 0, 0]);
  }
  return b;
}

// ---------- Dreibeiner / tripod ----------

export function tripod(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const y = 0.4;
  const ws = lite ? 10 : 22;
  const seg = lite ? 5 : 8;
  // Untertasse / saucer
  b.add(geo.hemi(0.2, ws, lite ? 3 : 6), L.primary, { p: [0, y, 0], s: [1, 0.3, 1] });
  b.add(geo.hemi(0.19, ws, lite ? 3 : 5), mat.alienMetal, { p: [0, y, 0], r: [Math.PI, 0, 0], s: [1, 0.24, 1] });
  b.add(geo.torus(0.2, 0.014, 4, ws), L.secondary, { p: [0, y, 0], r: [HALF_PI, 0, 0] });
  const ports = lite ? 4 : 10;
  for (let i = 0; i < ports; i++) {
    const a = (i / ports) * Math.PI * 2;
    b.add(geo.sphere(0.011, 8, 4), i % 2 ? mat.acid : mat.xenoGlow, { p: [Math.sin(a) * 0.205, y + 0.004, Math.cos(a) * 0.205] });
  }
  // Kuppel + Spitze / dome + spire
  b.add(geo.hemi(0.07, lite ? 10 : 18, lite ? 3 : 5), mix(mat.xenoGlow, mat.glassDark, 0.5), { p: [0, y + 0.055, 0] });
  b.add(geo.torus(0.07, 0.008, 3, lite ? 10 : 18), mat.alienMetalLight, { p: [0, y + 0.057, 0], r: [HALF_PI, 0, 0] });
  b.tube([0, y + 0.12, 0], [0, y + 0.2, 0], 0.005, 6, mat.alienMetalLight, 0.002);
  b.add(geo.ico(0.012, lite ? 0 : 1), mat.acid, { p: [0, y + 0.205, 0] });
  if (!lite) {
    addEmblem(b, f, 0.04, 0.006, L.secondary, { p: [0, y + 0.05, -0.13], r: [-HALF_PI + 0.35, 0, 0] });
    for (let i = 0; i < 2; i++) b.add(geo.torus(0.14 - i * 0.04, 0.004, 3, ws), L.primaryDark, { p: [0, y + 0.03 + i * 0.012, 0], r: [HALF_PI, 0, 0] });
  }
  // Todesstrahl-Emitter unter der Scheibe / death-ray emitter under the saucer
  b.cyl(0.03, 0.022, 0.06, seg, mat.alienMetal, [0, y - 0.07, 0.03]);
  b.add(geo.sphere(0.03, seg, 6), mat.alienMetalLight, { p: [0, y - 0.1, 0.035] });
  b.group({ p: [0, y - 0.11, 0.06], r: [1.0, 0, 0] }, () => {
    b.cyl(0.012, 0.016, 0.06, seg, mat.alienMetal, [0, 0.03, 0]);
    b.add(geo.cyl(0.055, 0.016, 0.035, lite ? 10 : 16), mat.alienMetalLight, { p: [0, 0.07, 0] });
    b.add(geo.sphere(0.028, seg, 6), mat.acid, { p: [0, 0.085, 0] });
    if (!lite) for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.tube([Math.sin(a) * 0.045, 0.08, Math.cos(a) * 0.045], [Math.sin(a) * 0.02, 0.13, Math.cos(a) * 0.02], 0.004, 4, mat.alienMetal);
    }
    b.add(geo.ico(0.012, lite ? 0 : 1), mat.xenoGlow, { p: [0, 0.135, 0] });
  });
  // drei lange, duenne Beine / three long thin legs
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 3 + (i / 3) * Math.PI * 2;
    const dir = (r: number): [number, number] => [Math.sin(a) * r, Math.cos(a) * r];
    const [hx, hz] = dir(0.12);
    const [kx, kz] = dir(0.3);
    const [fx, fz] = dir(0.38);
    const hip: V3 = [hx, y - 0.05, hz];
    const knee: V3 = [kx, y + 0.1, kz];
    const foot: V3 = [fx, 0.03, fz];
    b.add(geo.sphere(0.024, seg, 6), mat.alienMetal, { p: hip });
    b.tube(hip, knee, 0.012, seg, L.primaryDark, 0.01);
    b.add(geo.sphere(0.022, seg, 6), mat.alienMetal, { p: knee });
    if (!lite) b.add(geo.torus(0.024, 0.005, 3, 10), mat.acid, { p: knee });
    b.tube(knee, foot, 0.011, seg, mat.alienMetalLight, 0.007);
    if (!lite) b.tube(lerp3(knee, foot, 0.2), lerp3(knee, foot, 0.55), 0.016, seg, L.primary);
    b.add(geo.sphere(0.014, seg, 4), mat.alienMetal, { p: foot });
    for (const da of [-0.6, 0, 0.6]) {
      b.add(geo.taper(0.012, 0.04, 0.004, 0.01, 0.014), mat.alienMetal, { p: [fx + Math.sin(a + da) * 0.02, 0.008, fz + Math.cos(a + da) * 0.02], r: [0, a + da, 0] });
    }
  }
  // haengende Tentakel / hanging tentacles
  if (!lite) for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const s0: V3 = [Math.sin(a) * 0.08, y - 0.04, Math.cos(a) * 0.08];
    chain(b, bezier(s0, [Math.sin(a) * 0.12, y - 0.1, Math.cos(a) * 0.12], [Math.sin(a + 0.4) * 0.07, y - 0.2, Math.cos(a + 0.4) * 0.07], 4), 0.008, 0.004, 5, mat.alienSkinDark, null);
  }
  return b;
}

