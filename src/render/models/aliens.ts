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
import { Builder, capsule, fine, geo, mix, rng, shade, type ColorLike, type V3 } from './kit';
import { bez, boltRing, cable, grille, lerpV, rivetRow, whip } from './detailFleet';
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
    if (!lite && fine()) {
      // Kuehlrippen, Energiezelle mit Leitung, Zielsensor, Griffschale / cooling fins, energy cell with a lead, target sensor, grip shell
      for (let i = 0; i < 4; i++) b.box(0.03, 0.004, 0.006, mat.alienMetalLight, [0, 0.024, 0.03 + i * 0.018]);
      b.cyl(0.009, 0.009, 0.03, 8, mat.xenoGlow, [-0.02, 0.004, 0.0], [HALF_PI, 0, 0]);
      for (const z of [-0.016, 0.016]) b.cyl(0.011, 0.011, 0.004, 8, mat.alienMetal, [-0.02, 0.004, z], [HALF_PI, 0, 0]);
      cable(b, [[-0.02, 0.004, 0.017], [-0.018, 0.0, 0.04], [-0.012, 0.0, 0.07]], 0.002, mat.acid);
      b.add(geo.rbox(0.012, 0.012, 0.022, 0.003), mat.alienMetal, { p: [0, 0.032, 0.13] });
      b.box(0.008, 0.008, 0.002, mat.acid, [0, 0.032, 0.142]);
      b.box(0.022, 0.004, 0.11, L.secondary, [0, -0.012, 0.06]);
    }
  });
}

// ---------- Grauer / grey ----------

export function grey(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  // hohe Qualitaet: rundere Glieder / high quality: rounder limbs
  const seg = lite ? 6 : fine() ? 11 : 8;
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
  if (!lite && fine()) greyRich(b, L);
  return b;
}

/**
 * Grauer bei hoher Qualitaet: Halsdichtung, Nahtlinien und Leuchtnaehte am Anzug, Guertel mit Leuchtschnalle und
 * Taschen, Schlaeuche vom Rueckengeraet zu den Schultern, Gelenkringe an Knien, Implantat mit Leuchtpunkten am Kopf.
 * Grey on high quality: neck seal, seam lines and glowing seams on the suit, a belt with a glowing buckle and pouches,
 * hoses from the back unit to the shoulders, joint rings at the knees, an implant with light dots on the head.
 */
function greyRich(b: Builder, L: Look) {
  b.add(geo.torus(0.015, 0.004, 4, 12), mat.alienMetalLight, { p: [0, 0.219, 0.001], r: [HALF_PI, 0, 0] });
  // Nahtlinien am Anzug / seam lines on the suit
  for (const sx of [-1, 1]) {
    b.box(0.003, 0.07, 0.003, shade(L.jacket, 0.7), [sx * 0.022, 0.182, 0.037], [0.12, 0, 0]);
    b.box(0.003, 0.05, 0.003, mat.acid, [sx * 0.04, 0.18, 0.026], [0.1, 0, sx * 0.1]);
  }
  // Guertel mit Leuchtschnalle und Taschen / belt with a glowing buckle and pouches
  b.box(0.016, 0.012, 0.004, mat.acid, [0, 0.142, 0.033]);
  for (const sx of [-1, 1]) b.add(geo.rbox(0.018, 0.018, 0.012, 0.004), mat.alienMetal, { p: [sx * 0.034, 0.138, 0.028] });
  // Schlaeuche vom Rueckengeraet zu den Schultern / hoses from the back unit to the shoulders
  for (const sx of [-1, 1]) cable(b, [[sx * 0.018, 0.212, -0.04], [sx * 0.036, 0.224, -0.028], [sx * 0.046, 0.222, -0.01]], 0.0035, mat.alienMetalLight);
  b.box(0.034, 0.004, 0.004, mat.acid, [0, 0.21, -0.056]);
  b.box(0.034, 0.004, 0.004, mat.acid, [0, 0.172, -0.056]);
  // Gelenkringe an den Knien / joint rings at the knees
  for (const sx of [-1, 1]) b.add(geo.torus(0.016, 0.0035, 4, 10), L.primary, { p: [sx * 0.036, 0.075, 0.02], r: [HALF_PI, 0, 0] });
  // Handgelenk- und Knoechelringe, Brustring / wrist and ankle rings, chest ring
  b.add(geo.torus(0.017, 0.003, 3, 12), mat.alienMetalLight, { p: [0, 0.19, 0.039] });
  for (const sx of [-1, 1]) b.add(geo.torus(0.014, 0.003, 3, 10), L.secondary, { p: [sx * 0.038, 0.024, -0.004], r: [HALF_PI, 0, 0] });
  // Schulterplatten mit Leuchtkante / shoulder plates with a glowing edge
  for (const sx of [-1, 1]) {
    b.add(geo.rbox(0.03, 0.008, 0.034, 0.003), L.primaryDark, { p: [sx * 0.05, 0.226, 0], r: [0, 0, sx * -0.35] });
    b.box(0.004, 0.004, 0.03, mat.acid, [sx * 0.064, 0.22, 0], [0, 0, sx * -0.35]);
  }
  // Rueckengeraet: Lueftungsgitter / back unit: vent grille
  grille(b, [0, 0.19, -0.0555], 0.036, 0.03, 3, mat.alienMetal, mat.ink, [0, Math.PI, 0]);
  // Handgelenk-Rechner mit Leuchtfeld, Holster mit kleiner Waffe am Oberschenkel / wrist computer with a glowing screen, holster with a small weapon on the thigh
  b.add(geo.rbox(0.02, 0.012, 0.026, 0.004), mat.alienMetal, { p: [-0.062, 0.15, 0.03], r: [0.4, 0, 0.3] });
  b.box(0.014, 0.003, 0.016, mat.xenoGlow, [-0.062, 0.157, 0.032], [0.4, 0, 0.3]);
  b.add(geo.rbox(0.012, 0.03, 0.02, 0.004), L.gear, { p: [0.046, 0.115, 0.004], r: [0, 0, -0.1] });
  b.cyl(0.004, 0.004, 0.016, 6, mat.acid, [0.046, 0.134, 0.01]);
  // Knieschienen und Zehenkrallen / knee guards and toe claws
  for (const sx of [-1, 1]) {
    b.add(geo.rbox(0.022, 0.03, 0.01, 0.004), L.primaryDark, { p: [sx * 0.036, 0.08, 0.034], r: [-0.3, 0, 0] });
    for (const a of [-0.45, 0, 0.45]) b.add(geo.cone(0.003, 0.012, 4), mat.ink, { p: [sx * 0.038 + Math.sin(a) * 0.046, 0.006, 0.018 + Math.cos(a) * 0.036], r: [HALF_PI, a, 0] });
  }
  // Implantat am Kopf mit Leuchtpunkten / head implant with light dots
  b.group({ p: [-0.083, 0.345, -0.01], r: [0, 0, 0.2] }, () => {
    b.add(geo.rbox(0.008, 0.032, 0.03, 0.003), mat.alienMetal, {});
    for (const dz of [-0.008, 0.0, 0.008]) b.box(0.004, 0.004, 0.004, mat.acid, [-0.004, 0.004, dz]);
  });
}

// ---------- Terraformer ----------

export function terraformer(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const seg = lite ? 6 : fine() ? 12 : 10;
  const C: V3 = [0, 0.27, -0.03];
  // schwebender Panzerkoerper / floating carapace body
  b.add(geo.hemi(0.115, lite ? 10 : fine() ? 22 : 16, lite ? 4 : fine() ? 7 : 5), L.primary, { p: C, s: [1, 0.78, 1.15] });
  b.add(geo.sphere(0.105, lite ? 10 : fine() ? 20 : 14, lite ? 5 : fine() ? 10 : 7), mat.alienSkin, { p: [C[0], C[1] - 0.005, C[2]], s: [1, 0.55, 1.1] });
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
    const pts = bezier(s0, c1, e, lite ? 3 : fine() ? 6 : 4);
    chain(b, pts, 0.018, 0.007, lite ? 5 : fine() ? 9 : 7, mat.alienSkinDark, lite ? null : L.primary);
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
  if (!lite && fine()) terraformerRich(b, L, C);
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

/**
 * Terraformer bei hoher Qualitaet: Panzerrippen auf dem Ruecken, Leuchtporen, Saugnaepfe an den Tentakeln, Leitungen vom
 * Tank zum Koerper, Kiemenschlitze, Fokusrippen am Emitter, Sporenwolke am Boden.
 * Terraformer on high quality: armour ribs on the back, glowing pores, suckers on the tentacles, pipes from the tank to the
 * body, gill slits, focusing ribs on the emitter, a spore cloud on the ground.
 */
function terraformerRich(b: Builder, L: Look, C: V3) {
  // Panzerrippen vom Scheitel zum Rand / armour ribs from the crown to the rim
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const pts: V3[] = [];
    for (let k = 1; k <= 4; k++) {
      const t = (k / 5) * HALF_PI;
      pts.push([Math.sin(a) * Math.sin(t) * 0.117, C[1] + Math.cos(t) * 0.09 + 0.002, C[2] + Math.cos(a) * Math.sin(t) * 0.134]);
    }
    cable(b, pts, 0.004, shade(L.primary, 0.72), 4);
  }
  // Leuchtporen am Bauch / glowing pores on the belly
  const R = rng(93);
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI * 2, t = 0.55 + R() * 0.35;
    b.add(geo.sphere(0.005, 5, 3), mat.acid, { p: [Math.sin(a) * 0.105 * t, C[1] - 0.045, C[2] + Math.cos(a) * 0.115 * t] });
  }
  // Saugnaepfe an der Unterseite der Tentakel / suckers on the underside of the tentacles
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const pts = bez([Math.sin(a) * 0.06, C[1] - 0.04, C[2] + Math.cos(a) * 0.06], [Math.sin(a) * 0.24, C[1] + 0.02, C[2] + Math.cos(a) * 0.24], [Math.sin(a) * 0.27, 0.01, C[2] + Math.cos(a) * 0.27], 8);
    for (let k = 2; k < 8; k++) b.add(geo.sphere(0.0055 - k * 0.0003, 6, 3), mix(mat.alienSkin, mat.acid, 0.35), { p: [pts[k][0], pts[k][1] - 0.012 + k * 0.0006, pts[k][2]] });
  }
  // Leitungen vom Tank zum Koerper / pipes from the tank to the body
  for (const sx of [-1, 1]) cable(b, [[sx * 0.02, C[1] + 0.08, C[2] - 0.13], [sx * 0.05, C[1] + 0.1, C[2] - 0.08], [sx * 0.06, C[1] + 0.07, C[2] - 0.02]], 0.0045, mat.alienMetalLight);
  // Kiemenschlitze an den Flanken / gill slits on the flanks
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.box(0.004, 0.022, 0.004, mat.ink, [sx * 0.11, C[1] + 0.01, C[2] - 0.03 + i * 0.022], [0, 0, sx * 0.4]);
  // Fokusrippen am Emitter / focusing ribs on the emitter
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.box(0.004, 0.03, 0.012, mat.alienMetal, [Math.sin(a) * 0.024, 0.155 + Math.cos(a) * 0.02, 0.165], [0.6, 0, -a]);
  }
  // Sporenwolke am Boden / spore cloud on the ground
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(geo.sphere(0.012 + (i % 3) * 0.004, 6, 3), i % 2 ? mat.xenoGlow : mix(mat.acid, mat.white, 0.3), { p: [Math.sin(a) * 0.075, 0.01, 0.3 + Math.cos(a) * 0.05], s: [1, 0.5, 1] });
  }
}

// ---------- Gleiter / skimmer ----------

export function skimmer(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const y = 0.16;
  const ws = lite ? 12 : fine() ? 30 : 24;
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
  if (!lite && fine()) skimmerRich(b, L, y);
  return b;
}

/**
 * Gleiter bei hoher Qualitaet: Plattenfugen auf der Scheibe, Randlichter, Luftschlitze, Kanzelrahmen mit Pilot, zwei
 * Triebwerksgondeln mit Leuchtduesen, Antenne, Duesenringe auf der Unterseite.
 * Skimmer on high quality: plate seams on the disc, rim lights, air slots, a canopy frame with a pilot, two engine pods
 * with glowing nozzles, an antenna, thruster rings on the underside.
 */
function skimmerRich(b: Builder, L: Look, y: number) {
  // Plattenfugen: Speichen auf der Scheibe / plate seams: spokes on the disc
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const pts: V3[] = [];
    for (const r of [0.075, 0.12, 0.165]) {
      const h = Math.sqrt(Math.max(0, 1 - (r / 0.19) ** 2)) * 0.19 * 0.28;
      pts.push([Math.sin(a) * r, y + h + 0.0015, Math.cos(a) * r * 1.1]);
    }
    cable(b, pts, 0.0022, shade(L.primary, 0.7), 3);
  }
  // Randlichter und Luftschlitze / rim lights and air slots
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.box(0.006, 0.006, 0.006, i % 2 ? mat.acid : mat.xenoGlow, [Math.sin(a) * 0.203, y + 0.004, Math.cos(a) * 0.209], [0, a, 0]);
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.box(0.02, 0.003, 0.004, mat.ink, [sx * 0.11, y + 0.036 - i * 0.002, -0.02 + i * 0.012], [0, sx * 0.3, 0]);
  // Kanzelrahmen mit Pilot / canopy frame with a pilot
  for (const a of [-0.6, 0, 0.6]) b.group({ p: [0, y + 0.045, 0.03], r: [0, a, 0] }, () => b.add(geo.torus(0.06, 0.003, 3, 12), mat.alienMetalLight, { s: [1, 0.9, 1.25] }));
  b.group({ p: [0, y + 0.03, 0.035], s: 0.42 }, () => alienHead(b, L, 1, false));
  // Triebwerksgondeln mit Leuchtduesen / engine pods with glowing nozzles
  for (const sx of [-1, 1]) {
    b.add(capsule(0.022, 0.018, 0.09, 10, 2), mat.alienMetal, { p: [sx * 0.07, y + 0.03, -0.14], r: [HALF_PI, 0, 0] });
    b.cyl(0.018, 0.018, 0.006, 10, mat.xenoGlow, [sx * 0.07, y + 0.03, -0.187], [HALF_PI, 0, 0]);
    for (const z of [-0.12, -0.155]) b.add(geo.torus(0.0225, 0.003, 3, 10), L.secondary, { p: [sx * 0.07, y + 0.03, z] });
  }
  whip(b, [0.03, y + 0.045, -0.05], [0.05, y + 0.095, -0.09], mat.alienMetalLight, mat.acid);
  // Duesenringe auf der Unterseite / thruster rings on the underside
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.add(geo.torus(0.016, 0.004, 3, 10), mat.alienMetalLight, { p: [Math.sin(a) * 0.12, y - 0.03, Math.cos(a) * 0.13], r: [HALF_PI, 0, 0] });
    b.cyl(0.012, 0.012, 0.004, 10, mat.xenoGlow, [Math.sin(a) * 0.12, y - 0.032, Math.cos(a) * 0.13]);
  }
}

// ---------- Mech ----------

export function mech(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const seg = lite ? 6 : fine() ? 16 : 12;
  // Beine mit Rueckwaertsknien / legs with reverse knees
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.075, 0.22, -0.01];
    const knee: V3 = [s * 0.088, 0.14, 0.07];
    const ankle: V3 = [s * 0.088, 0.05, -0.03];
    b.segment(V(hip), V(knee), (l) => geo.rbox(0.05, l + 0.02, 0.055, 0.012), L.primary);
    b.segment(V(knee), V(ankle), (l) => geo.rbox(0.04, l + 0.01, 0.045, 0.01), mat.alienMetal);
    if (!lite) b.tube([s * 0.11, 0.2, 0.0], [s * 0.11, 0.12, 0.05], 0.007, 8, mat.alienMetalLight);
    for (const j of [hip, knee, ankle]) b.add(geo.sphere(0.026, lite ? 6 : fine() ? 14 : 10, lite ? 3 : fine() ? 7 : 5), mat.alienMetal, { p: j });
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
    b.add(geo.sphere(0.035, lite ? 6 : fine() ? 14 : 10, lite ? 3 : fine() ? 7 : 5), mat.alienMetal, { p: [s * 0.115, 0.315, 0] });
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
  if (!lite && fine()) mechRich(b, L);
  return b;
}

/**
 * Mech bei hoher Qualitaet: Hydraulikzylinder an den Beinen, Nietreihen und Plattenfugen an der Kanzel, Kanzelstreben,
 * Hueftschuerzen, Munitionszufuehrung an den Armkanonen, Kuehlrippen, Kabelstraenge, Krallen an den Zehen, Raketenspitzen.
 * Mech on high quality: hydraulic rams on the legs, rivet rows and plate seams on the cockpit, canopy struts, hip skirts,
 * ammo feeds on the arm cannons, cooling fins, cable runs, toe claws, missile tips.
 */
function mechRich(b: Builder, L: Look) {
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.075, 0.22, -0.01], knee: V3 = [s * 0.088, 0.14, 0.07], ankle: V3 = [s * 0.088, 0.05, -0.03];
    // Hydraulikzylinder: Huefte zum Knie, Knie zum Knoechel (innen) / hydraulic rams: hip to knee, knee to ankle (inside)
    const a1 = lerpV(hip, knee, 0.15), b1 = lerpV(hip, knee, 0.85);
    b.tube([a1[0] - s * 0.03, a1[1], a1[2] - 0.02], [b1[0] - s * 0.03, b1[1], b1[2] - 0.02], 0.008, 8, mat.alienMetalLight);
    b.tube(lerpV([a1[0] - s * 0.03, a1[1], a1[2] - 0.02], [b1[0] - s * 0.03, b1[1], b1[2] - 0.02], 0.5), [b1[0] - s * 0.03, b1[1], b1[2] - 0.02], 0.0045, 6, mat.metalLight);
    const a2 = lerpV(knee, ankle, 0.2), b2 = lerpV(knee, ankle, 0.8);
    b.tube([a2[0] - s * 0.028, a2[1], a2[2] + 0.012], [b2[0] - s * 0.028, b2[1], b2[2] + 0.012], 0.006, 8, mat.alienMetalLight);
    // Panzerplatte auf dem Oberschenkel mit Leuchtnaht / armour plate on the thigh with a glowing seam
    b.segment(new THREE.Vector3(...lerpV(hip, knee, 0.2)), new THREE.Vector3(...lerpV(hip, knee, 0.75)), (l) => geo.rbox(0.058, l, 0.012, 0.004), shade(L.primary, 0.85), (l) => {
      b.box(0.04, 0.004, 0.004, mat.acid, [0, l * 0.5, 0.007]);
    });
    // Krallen an den Zehen / claws on the toes
    for (const a of [-0.4, 0, 0.4]) b.add(geo.cone(0.006, 0.02, 5), mat.ink, { p: [s * 0.088 + Math.sin(a) * 0.058, 0.008, -0.03 + Math.cos(a) * 0.072], r: [HALF_PI, a, 0] });
    // Hueftschuerze / hip skirt
    b.add(geo.rbox(0.05, 0.04, 0.01, 0.004), mat.alienMetal, { p: [s * 0.05, 0.205, 0.035], r: [0.25, 0, 0] });
    // Munitionszufuehrung von der Schulter zur Armkanone, Kuehlrippen / ammo feed from the shoulder to the arm cannon, cooling fins
    cable(b, [[s * 0.12, 0.3, -0.02], [s * 0.16, 0.295, 0.02], [s * 0.155, 0.285, 0.06]], 0.007, mat.alienMetalLight, 6);
    for (let i = 0; i < 5; i++) b.box(0.004, 0.06, 0.008, mat.alienMetalLight, [s * 0.14, 0.27, 0.105 + i * 0.022], [0, 0, 0]);
    // Nietreihe und Fuge an der Kanzelseite / rivet row and seam on the cockpit side
    rivetRow(b, [s * 0.101, 0.33, -0.07], [s * 0.101, 0.33, 0.06], 7, 0.004, mat.alienMetalLight);
    b.box(0.003, 0.08, 0.003, mat.ink, [s * 0.1, 0.3, 0.03]);
  }
  // Kanzelstreben ueber der Scheibe / canopy struts over the screen
  for (const x of [-0.035, 0, 0.035]) b.box(0.004, 0.062, 0.004, mat.alienMetal, [x, 0.33, 0.088], [-0.45, 0, 0]);
  // Raketenspitzen und Kuehlgitter am Ruecken / missile tips and cooling grille on the back
  for (const x of [-0.125, -0.095]) for (const y of [0.36, 0.38]) b.add(geo.cone(0.006, 0.012, 6), mat.acid, { p: [x, y, 0.024], r: [HALF_PI, 0, 0] });
  grille(b, [0, 0.33, -0.077], 0.09, 0.04, 5, mat.alienMetal, mat.ink, [0, Math.PI, 0]);
  // Kabelstrang vom Reaktor zur Kanzel / cable run from the reactor to the cockpit
  for (const sx of [-1, 1]) cable(b, [[sx * 0.02, 0.33, -0.1], [sx * 0.05, 0.36, -0.07], [sx * 0.075, 0.35, -0.03]], 0.004, mat.acid);
  for (const s of [-1, 1]) {
    // Schienbeinplatte mit Leuchtnaht / shin plate with a glowing seam
    const knee: V3 = [s * 0.088, 0.14, 0.07], ankle: V3 = [s * 0.088, 0.05, -0.03];
    b.segment(new THREE.Vector3(...lerpV(knee, ankle, 0.15)), new THREE.Vector3(...lerpV(knee, ankle, 0.7)), (l) => geo.rbox(0.046, l, 0.01, 0.004), L.primaryDark, (l) => {
      b.add(geo.box(0.004, l * 0.8, 0.004), mat.acid, { p: [0, l * 0.5, 0.006] });
    });
    // Schulterpanzer mit Nieten / shoulder armour with rivets
    b.add(geo.rbox(0.06, 0.016, 0.07, 0.006), L.primary, { p: [s * 0.122, 0.348, 0.0], r: [0, 0, s * -0.3] });
    rivetRow(b, [s * 0.11, 0.358, -0.028], [s * 0.11, 0.358, 0.028], 4, 0.004, mat.alienMetalLight);
    // Auspuffstutzen am Ruecken mit Gluehring / exhaust stacks on the back with a glow ring
    b.cyl(0.01, 0.012, 0.05, 10, mat.alienMetal, [s * 0.04, 0.38, -0.085]);
    b.add(geo.torus(0.0105, 0.0025, 3, 10), mat.acid, { p: [s * 0.04, 0.405, -0.085], r: [HALF_PI, 0, 0] });
  }
  // Sensorbuendel und Scheinwerfer an der Kanzel / sensor cluster and searchlight on the cockpit
  for (const [x, y] of [[0.075, 0.345], [0.085, 0.33], [0.068, 0.326]] as [number, number][]) b.cyl(0.006, 0.006, 0.01, 8, mat.xenoGlow, [x, y, 0.095], [HALF_PI, 0, 0]);
  b.cyl(0.012, 0.01, 0.016, 10, mat.alienMetal, [-0.07, 0.34, 0.095], [HALF_PI, 0, 0]);
  b.cyl(0.009, 0.009, 0.003, 10, mat.lamp, [-0.07, 0.34, 0.104], [HALF_PI, 0, 0]);
  // Dachluke / roof hatch
  b.cyl(0.026, 0.028, 0.006, 12, mat.alienMetal, [0, 0.358, -0.04]);
  b.box(0.03, 0.004, 0.004, mat.acid, [0, 0.362, -0.04]);
}

// ---------- Dreibeiner / tripod ----------

export function tripod(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const y = 0.4;
  const ws = lite ? 10 : fine() ? 36 : 22;
  const seg = lite ? 5 : fine() ? 12 : 8;
  // Untertasse / saucer
  b.add(geo.hemi(0.2, ws, lite ? 3 : 6), L.primary, { p: [0, y, 0], s: [1, 0.3, 1] });
  b.add(geo.hemi(0.19, ws, lite ? 3 : 5), mat.alienMetal, { p: [0, y, 0], r: [Math.PI, 0, 0], s: [1, 0.24, 1] });
  b.add(geo.torus(0.2, 0.014, 4, ws), L.secondary, { p: [0, y, 0], r: [HALF_PI, 0, 0] });
  const ports = lite ? 4 : fine() ? 20 : 10;
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
  if (!lite && fine()) tripodRich(b, L, y);
  return b;
}

/**
 * Dreibeiner bei hoher Qualitaet: Plattenrippen auf der Untertasse, Fensterkranz unter der Kuppel, Luftschlitze am Rand,
 * Bolzenring, Hydraulik und Kabel an den Beinen, Fussteller, Lichter und Bodenluke an der Unterseite, Saugnaepfe an den
 * Tentakelspitzen. / Tripod on high quality: plate ribs on the saucer, a ring of windows below the dome, slots at the rim,
 * a bolt ring, hydraulics and cables on the legs, foot pads, lights and a belly hatch underneath, suckers on the tentacle tips.
 */
function tripodRich(b: Builder, L: Look, y: number) {
  // Plattenrippen von der Kuppel zum Rand / plate ribs from the dome to the rim
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.1;
    const pts: V3[] = [];
    for (const r of [0.075, 0.13, 0.185]) pts.push([Math.sin(a) * r, y + Math.sqrt(Math.max(0, 1 - (r / 0.2) ** 2)) * 0.06 + 0.0015, Math.cos(a) * r]);
    cable(b, pts, 0.0024, shade(L.primary, 0.72), 3);
  }
  // Fensterkranz unter der Kuppel, Bolzenring / ring of windows below the dome, bolt ring
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(0.014, 0.008, 0.004, mix(mat.xenoGlow, mat.glassDark, 0.3), [Math.sin(a) * 0.08, y + 0.052, Math.cos(a) * 0.08], [0, a, 0]);
  }
  boltRing(b, [0, y + 0.06, 0], 0.074, 18, 0.004, mat.alienMetal);
  // Luftschlitze unter dem Rand / slots below the rim
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + 0.16;
    b.box(0.012, 0.004, 0.004, mat.ink, [Math.sin(a) * 0.185, y - 0.012, Math.cos(a) * 0.185], [0, a, 0]);
  }
  // Unterseite: Lichter, Bodenluke / underside: lights, belly hatch
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    b.add(geo.sphere(0.007, 6, 3), mat.acid, { p: [Math.sin(a) * 0.15, y - 0.03, Math.cos(a) * 0.15] });
  }
  b.cyl(0.03, 0.034, 0.006, 12, mat.alienMetalLight, [0, y - 0.045, -0.07]);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 3 + (i / 3) * Math.PI * 2;
    const dir = (r: number): [number, number] => [Math.sin(a) * r, Math.cos(a) * r];
    const [hx, hz] = dir(0.12), [kx, kz] = dir(0.3), [fx, fz] = dir(0.38);
    const hip: V3 = [hx, y - 0.05, hz], knee: V3 = [kx, y + 0.1, kz], foot: V3 = [fx, 0.03, fz];
    // Hydraulik parallel zum Oberschenkel, Kabel am Unterschenkel / hydraulics along the thigh, cable along the shin
    const off: V3 = [Math.cos(a) * 0.016, -0.01, -Math.sin(a) * 0.016];
    const p0 = lerpV(hip, knee, 0.2), p1 = lerpV(hip, knee, 0.8);
    b.tube([p0[0] + off[0], p0[1] + off[1], p0[2] + off[2]], [p1[0] + off[0], p1[1] + off[1], p1[2] + off[2]], 0.006, 6, mat.alienMetalLight);
    const q0 = lerpV(knee, foot, 0.1), q1 = lerpV(knee, foot, 0.85);
    cable(b, [[q0[0] - off[0], q0[1], q0[2] - off[2]], lerpV([q0[0] - off[0], q0[1], q0[2] - off[2]], [q1[0] - off[0], q1[1], q1[2] - off[2]], 0.5), [q1[0] - off[0], q1[1], q1[2] - off[2]]], 0.003, mat.acid);
    for (const t of [0.35, 0.7]) b.add(geo.torus(0.014, 0.003, 3, 8), L.secondary, { p: lerpV(knee, foot, t), r: [Math.atan2(foot[2] - knee[2], foot[1] - knee[1]) + HALF_PI, 0, 0] });
    // Fussteller / foot pad
    b.cyl(0.03, 0.034, 0.008, 12, mat.alienMetal, [fx, 0.004, fz]);
  }
  // Knie-Stacheln und Antennenbuendel an der Spitze / knee spikes and an antenna cluster at the spire
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 3 + (i / 3) * Math.PI * 2;
    b.add(geo.cone(0.01, 0.04, 6), L.primaryDark, { p: [Math.sin(a) * 0.31, y + 0.125, Math.cos(a) * 0.31], r: [0, a, -0.0] });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.tube([Math.sin(a) * 0.012, y + 0.11, Math.cos(a) * 0.012], [Math.sin(a) * 0.03, y + 0.16, Math.cos(a) * 0.03], 0.0022, 4, mat.alienMetalLight);
    b.add(geo.sphere(0.0045, 5, 3), mat.acid, { p: [Math.sin(a) * 0.03, y + 0.163, Math.cos(a) * 0.03] });
  }
  // Saugnaepfe an den Tentakelspitzen / suckers on the tentacle tips
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(geo.sphere(0.007, 6, 4), mat.acid, { p: [Math.sin(a + 0.4) * 0.07, y - 0.205, Math.cos(a + 0.4) * 0.07] });
  }
}

