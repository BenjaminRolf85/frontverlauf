/**
 * Einheiten des KI-Kollektivs NEXUS / units of the AI collective NEXUS:
 * Androide, Spinnenroboter, Quad-Drohne, Railgun-Plattform, Titan. Keine Menschen.
 * Android, spider bot, quad drone, railgun platform, titan. No humans.
 * Weisse Platten, Kanonenmetall, cyan leuchtende Linien und Augen, Sechseckpaneele.
 * White plates, gunmetal, cyan glowing lines and eyes, hexagonal panels.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { robotHead } from './headgear';
import {
  ammoBox, boltRing, cable, finRings, grille, piston, rivets, seam, sensorCluster, squareHatch, towHook, vents,
} from './detailVehicles';
import { Builder, ball, fine, geo, shade, softBox, type ColorLike, type V3 } from './kit';
import { look, mat, type Look } from './look';
import { antenna, tracks } from './tanks';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/**
 * Gliedsegment als gefaster Quader; hohe Qualitaet: staerker gerundet (zwei Rundungsschritte) mit Leuchtfuge
 * Limb segment as a chamfered box; high quality: rounder (two rounding steps) with a glowing seam
 */
export function limb(b: Builder, a: V3, c: V3, w: number, d: number, col: ColorLike, lite: boolean) {
  if (!lite && fine()) {
    b.segment(V(a), V(c), (l) => softBox(w, l + 0.01, d, Math.min(w, d) * 0.3, 2), col, (l) => {
      b.box(w * 0.5, 0.003, 0.003, shade(col, 0.6), [0, l * 0.5, d / 2 + 0.0005]);
    });
    return;
  }
  b.segment(V(a), V(c), (l) => (lite ? geo.box(w, l + 0.01, d) : geo.rbox(w, l + 0.01, d, Math.min(w, d) * 0.25)), col);
}

export function joint(b: Builder, p: V3, r: number, lite: boolean, col: ColorLike = mat.gunmetal) {
  b.add(geo.sphere(r, lite ? 6 : 10, lite ? 3 : 5), col, { p });
}

/** Sechseckpaneel auf einer Flaeche / hexagon panel on a face */
export function hexPanel(b: Builder, p: V3, r: number, col: ColorLike, rot: V3) {
  b.add(geo.cyl(r, r, 0.005, 6), col, { p, r: rot });
}

/** Leuchtspulen entlang +z / glowing coils along +z */
export function coils(b: Builder, x: number, y: number, z0: number, z1: number, n: number, r: number, square = false) {
  for (let i = 0; i < n; i++) {
    const z = z0 + ((i + 0.5) / n) * (z1 - z0);
    b.add(geo.torus(r, r * 0.16, 3, square ? 4 : 10), mat.cyanGlow, { p: [x, y, z], r: [0, 0, square ? Math.PI / 4 : 0] });
  }
}

// ---------- Androide / android ----------

export function android(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.jacket, metal = mat.gunmetal, glow = mat.cyanGlow;
  if (!lite && fine()) androidDetail(b, L, plate);
  // Beine / legs
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.04, 0.165, 0], knee: V3 = [s * 0.045, 0.092, 0.022], ankle: V3 = [s * 0.046, 0.028, 0];
    limb(b, hip, knee, 0.046, 0.05, plate, lite);
    limb(b, knee, ankle, 0.038, 0.042, metal, lite);
    joint(b, knee, 0.024, lite);
    b.box(0.006, 0.03, 0.006, glow, [s * 0.046, 0.06, 0.03]);
    b.add(lite ? geo.box(0.05, 0.026, 0.085) : geo.rtaper(0.052, 0.09, 0.044, 0.06, 0.026, 0.006, 0.01), metal, { p: [s * 0.046, 0.013, 0.012] });
  }
  // Becken + Rumpf mit Kern / pelvis + torso with core
  b.add(geo.rbox(0.11, 0.04, 0.07, 0.012), metal, { p: [0, 0.172, 0] });
  b.cyl(0.035, 0.04, 0.03, lite ? 6 : 10, metal, [0, 0.198, 0]);
  b.add(lite ? geo.taper(0.11, 0.07, 0.15, 0.085, 0.11) : geo.rtaper(0.11, 0.07, 0.15, 0.085, 0.11, 0.014), plate, { p: [0, 0.265, 0] });
  b.add(geo.sphere(0.016, lite ? 6 : 10, lite ? 3 : 5), glow, { p: [0, 0.27, 0.042] });
  if (!lite) {
    b.add(geo.torus(0.022, 0.005, 3, 10), metal, { p: [0, 0.27, 0.043] });
    for (const s of [-1, 1]) {
      b.box(0.004, 0.09, 0.004, glow, [s * 0.05, 0.265, 0.04], [0, 0, s * 0.18]);
      hexPanel(b, [s * 0.075, 0.27, 0.0], 0.022, L.primary, [0, 0, HALF_PI]);
    }
    addEmblem(b, f, 0.018, 0.004, L.primary, { p: [-0.03, 0.3, 0.043] });
    // Energierucksack / power pack
    b.add(geo.cbox(0.09, 0.08, 0.04, 0.01), metal, { p: [0, 0.27, -0.06] });
    for (const y of [0.25, 0.27, 0.29]) b.box(0.07, 0.004, 0.004, glow, [0, y, -0.081]);
    antenna(b, 0.03, 0.31, -0.06, 0.12, glow);
  }
  // Kopf / head
  b.group({ p: [0, 0.32, 0], s: 0.95 }, () => robotHead(b, L, lite ? 1 : 2, false));
  // rechter Arm = Waffe / right arm = weapon
  const shR: V3 = [0.09, 0.3, 0], elR: V3 = [0.105, 0.23, 0.04];
  joint(b, shR, 0.026, lite, L.primary);
  limb(b, shR, elR, 0.036, 0.04, plate, lite);
  joint(b, elR, 0.02, lite);
  // uebergrosse Armkanone / oversized arm cannon
  b.add(geo.rbox(0.056, 0.056, 0.12, 0.012), metal, { p: [0.1, 0.225, 0.11] });
  b.add(geo.rbox(0.06, 0.016, 0.1, 0.005), plate, { p: [0.1, 0.258, 0.11] });
  b.cyl(0.018, 0.02, 0.16, lite ? 6 : 12, metal, [0.1, 0.228, 0.24], [HALF_PI, 0, 0]);
  if (!lite) coils(b, 0.1, 0.228, 0.18, 0.3, 4, 0.024);
  b.cyl(0.024, 0.024, 0.02, lite ? 6 : 12, mat.dark, [0.1, 0.228, 0.32], [HALF_PI, 0, 0]);
  b.add(geo.ico(0.016, lite ? 0 : 1), glow, { p: [0.1, 0.228, 0.33] });
  // linker Arm stuetzt / left arm supports
  const shL: V3 = [-0.09, 0.3, 0], elL: V3 = [-0.1, 0.23, 0.05], hL: V3 = [0.06, 0.215, 0.12];
  joint(b, shL, 0.026, lite, L.primary);
  limb(b, shL, elL, 0.036, 0.04, plate, lite);
  joint(b, elL, 0.02, lite);
  limb(b, elL, hL, 0.032, 0.036, metal, lite);
  b.add(geo.rbox(0.03, 0.028, 0.03, 0.008), metal, { p: hL });
  return b;
}

/**
 * Androide, hohe Qualitaet: Hydraulik an den Waden, Kniekappen, geteilte Zehenplatten, Hueftgelenke, Bauchringe,
 * Brustschlitze, Halsring, Schulterplatten, Energiekabel vom Rucksack zur Armkanone, Kuehlschlitze und Energiezelle an der
 * Kanone, Finger der Stuetzhand.
 * Android, high quality: calf hydraulics, knee caps, split toe plates, hip joints, abdominal rings, chest slots, neck ring,
 * shoulder plates, power cable from the pack to the arm cannon, cooling slots and power cell on the cannon, fingers of the
 * supporting hand.
 */
function androidDetail(b: Builder, L: Look, plate: ColorLike) {
  const metal = mat.gunmetal, glow = mat.cyanGlow;
  // Hueftplatten, Brustbolzen, Ellbogenkappen, Kanonenbaender / hip plates, chest bolts, elbow caps, cannon bands
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.04, 0.012, 0.034, 0.01, 0.045, 0.004), plate, { p: [s * 0.04, 0.152, 0.036], r: [-0.15, 0, s * 0.1] });
    b.box(0.03, 0.003, 0.003, glow, [s * 0.04, 0.142, 0.043]);
    b.add(geo.rtaper(0.014, 0.05, 0.012, 0.04, 0.05, 0.004), plate, { p: [s * 0.062, 0.15, 0.0], r: [0, 0, s * 0.18] });
    for (const y of [0.25, 0.3]) b.box(0.005, 0.005, 0.005, shade(plate, 0.6), [s * 0.065, y, 0.04]);
    b.add(geo.hemi(0.014, 10, 3), L.primary, { p: [s * 0.105, 0.232, 0.025], r: [-1.2, 0, 0] });
  }
  for (const z of [0.18, 0.205, 0.23]) b.add(geo.torus(0.021, 0.0035, 3, 12), mat.dark, { p: [0.1, 0.228, z] });
  b.add(geo.rbox(0.04, 0.03, 0.06, 0.008), plate, { p: [-0.02, 0.22, 0.09], r: [0, 1.2, 0] });
  for (const s of [-1, 1]) {
    piston(b, [s * 0.046, 0.088, -0.016], [s * 0.046, 0.034, -0.02], 0.0055, metal);
    b.add(geo.hemi(0.02, 10, 3), L.primary, { p: [s * 0.045, 0.094, 0.044], r: [HALF_PI - 0.2, 0, 0], s: [1, 0.5, 1] });
    for (const dx of [-0.012, 0.012]) b.add(geo.cbox(0.02, 0.012, 0.022, 0.004), shade(metal, 1.15), { p: [s * 0.046 + dx, 0.01, 0.06] });
    b.add(ball(0.019, 10, 6), metal, { p: [s * 0.042, 0.168, 0] });
    seam(b, [s * 0.064, 0.15, 0.012], [s * 0.066, 0.11, 0.03], shade(plate, 0.7));
    // Schulterplatte mit Leuchtkante / shoulder plate with a light edge
    b.add(geo.rtaper(0.05, 0.06, 0.04, 0.05, 0.016, 0.006), plate, { p: [s * 0.088, 0.33, 0], r: [0, 0, s * -0.35] });
    b.box(0.04, 0.003, 0.004, glow, [s * 0.09, 0.331, 0.031], [0, 0, s * -0.35]);
    vents(b, [s * 0.042, 0.296, 0.043], [HALF_PI, 0, 0], 3, 0.022, 0.008);
  }
  for (const y of [0.19, 0.205]) b.add(geo.torus(0.04, 0.005, 4, 16), mat.dark, { p: [0, y, 0], r: [HALF_PI, 0, 0] });
  b.add(geo.torus(0.028, 0.005, 4, 14), metal, { p: [0, 0.322, 0], r: [HALF_PI, 0, 0] });
  // Energiekabel und Energiezelle der Kanone / power cable and power cell of the cannon
  cable(b, [0.035, 0.245, -0.08], [0.1, 0.205, 0.06], 0.02, 0.0045, mat.dark);
  b.add(geo.cyl(0.014, 0.014, 0.03, 10), glow, { p: [0.1, 0.258, 0.06], r: [HALF_PI, 0, 0] });
  for (const s of [-1, 1]) vents(b, [0.1 + s * 0.029, 0.225, 0.11], [0, 0, s * HALF_PI], 4, 0.03, 0.02);
  for (const s of [-1, 1]) b.box(0.006, 0.01, 0.12, mat.dark, [0.1 + s * 0.02, 0.247, 0.24]);
  // Finger der Stuetzhand / fingers of the supporting hand
  for (let i = 0; i < 3; i++) b.box(0.008, 0.008, 0.022, mat.gunmetal, [0.05 + i * 0.01, 0.204, 0.13], [0.5, 0, 0]);
}

// ---------- Spinnenroboter / spider bot ----------

export function spider(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const y = 0.15;
  b.cyl(0.11, 0.12, 0.05, 6, plate, [0, y, 0], [0, Math.PI / 6, 0]);
  b.cyl(0.1, 0.105, 0.006, 6, glow, [0, y - 0.022, 0], [0, Math.PI / 6, 0]);
  b.add(geo.sphere(0.075, lite ? 8 : 14, lite ? 5 : 8), metal, { p: [0, y + 0.01, -0.13], s: [1, 0.75, 1.15] });
  if (!lite) for (let i = 0; i < 3; i++) b.box(0.1 - i * 0.02, 0.004, 0.006, glow, [0, y + 0.06 - i * 0.002, -0.1 - i * 0.04]);
  // Kopf mit vier Augen / head with four eyes
  b.add(geo.rtaper(0.1, 0.06, 0.08, 0.05, 0.05, 0.012), plate, { p: [0, y + 0.005, 0.11] });
  for (const [x, yy] of [[-0.022, 0.012], [0.022, 0.012], [-0.03, -0.01], [0.03, -0.01]] as [number, number][]) b.add(geo.sphere(0.01, 8, 4), glow, { p: [x, y + yy, 0.14] });
  // Sechs Beine / six legs
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = -0.06 + i * 0.06;
    const base: V3 = [s * 0.095, y, z];
    const knee: V3 = [s * 0.21, y + 0.12, z * 1.8];
    const foot: V3 = [s * 0.32, 0.01, Math.max(-0.38, Math.min(0.38, z * 2.6))];
    joint(b, base, 0.02, lite);
    b.tube(base, knee, 0.013, lite ? 5 : 8, plate, 0.011);
    joint(b, knee, 0.017, lite, L.primary);
    if (!lite) b.add(geo.torus(0.019, 0.004, 3, 10), glow, { p: knee, r: [0, 0, HALF_PI] });
    b.tube(knee, foot, 0.01, lite ? 5 : 8, metal, 0.006);
    b.add(geo.cone(0.01, 0.025, 6), metal, { p: [foot[0], 0.012, foot[2]], r: [Math.PI, 0, 0] });
  }
  if (!lite && fine()) spiderDetail(b, L, y);
  // Turm mit Doppelkanone / turret with twin guns
  b.cyl(0.045, 0.05, 0.02, lite ? 8 : 12, metal, [0, y + 0.035, 0]);
  b.add(geo.rbox(0.09, 0.045, 0.1, 0.014), plate, { p: [0, y + 0.068, 0.0] });
  b.box(0.06, 0.006, 0.004, glow, [0, y + 0.075, 0.051]);
  for (const x of [-0.022, 0.022]) {
    b.cyl(0.008, 0.009, 0.15, lite ? 6 : 10, metal, [x, y + 0.068, 0.12], [HALF_PI, 0, 0]);
    if (!lite) coils(b, x, y + 0.068, 0.08, 0.17, 2, 0.012);
    b.add(geo.ico(0.008, 0), glow, { p: [x, y + 0.068, 0.198] });
  }
  if (!lite) {
    addEmblem(b, f, 0.022, 0.004, L.primary, { p: [0, y + 0.091, -0.03], r: [-HALF_PI, 0, 0] });
    antenna(b, -0.03, y + 0.09, -0.04, 0.1, glow);
  }
  return b;
}

/**
 * Spinnenroboter, hohe Qualitaet: Hydraulik und Panzerplatten an den Oberbeinen, Krallen, Bolzen am Rumpf, Gitter und
 * Ringe am Hinterleib, Mundwerkzeuge, Sensorgruppe, Munitionskasten und Kuehlringe am Turm.
 * Spider bot, high quality: hydraulics and armour plates on the upper legs, claws, bolts on the body, grille and rings on
 * the abdomen, mandibles, sensor cluster, ammo box and cooling rings on the turret.
 */
function spiderDetail(b: Builder, L: Look, y: number) {
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  // Gelenkscheiben am Knie, Leuchtschlitze am Hinterleib, Sensorstaebe / joint discs at the knee, glowing slits on the abdomen, sensor rods
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = -0.06 + i * 0.06;
    const knee: V3 = [s * 0.21, y + 0.12, z * 1.8];
    b.add(geo.cyl(0.022, 0.022, 0.006, 12), metal, { p: [knee[0] + s * 0.012, knee[1], knee[2]], r: [0, 0, HALF_PI] });
    b.add(geo.cyl(0.012, 0.012, 0.008, 10), L.primary, { p: [knee[0] + s * 0.017, knee[1], knee[2]], r: [0, 0, HALF_PI] });
  }
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) b.box(0.003, 0.012, 0.03, glow, [s * 0.068, y + 0.01, -0.12 - i * 0.03]);
  // Spinndruesen-Behaelter am Hinterleib / spinneret canister at the abdomen
  b.add(geo.cyl(0.022, 0.026, 0.03, 12), metal, { p: [0, y - 0.01, -0.21], r: [HALF_PI, 0, 0] });
  b.add(geo.cyl(0.016, 0.016, 0.004, 12), glow, { p: [0, y - 0.01, -0.226], r: [HALF_PI, 0, 0] });
  for (const s of [-1, 1]) b.tube([s * 0.03, y + 0.03, 0.12], [s * 0.05, y + 0.07, 0.1], 0.0022, 4, mat.dark);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = -0.06 + i * 0.06;
    const base: V3 = [s * 0.095, y, z];
    const knee: V3 = [s * 0.21, y + 0.12, z * 1.8];
    const foot: V3 = [s * 0.32, 0.01, Math.max(-0.38, Math.min(0.38, z * 2.6))];
    piston(b, [base[0] + s * 0.01, base[1] - 0.012, base[2]], [knee[0] - s * 0.03, knee[1] - 0.03, knee[2] * 0.95], 0.005, metal);
    b.segment(V(base), V(knee), (len) => geo.rbox(0.028, len * 0.55, 0.012, 0.004), shade(plate, 0.92), (len) => {
      b.box(0.004, len * 0.4, 0.004, glow, [0, len * 0.5, 0.007]);
    });
    for (const k of [-1, 1]) b.add(geo.cone(0.005, 0.02, 5), metal, { p: [foot[0] + s * 0.01, 0.01, foot[2] + k * 0.01], r: [k * 0.5, 0, s * 1.9] });
  }
  boltRing(b, [0, y + 0.026, 0], 0.1, 12, shade(plate, 0.7), 0.005, Math.PI / 12);
  grille(b, [0, y + 0.065, -0.14], 0.07, 0.06, 4, metal);
  for (const z of [-0.09, -0.17]) b.add(geo.torus(0.07, 0.004, 3, 16), mat.dark, { p: [0, y + 0.01, z], s: [1, 0.75, 1] });
  for (const s of [-1, 1]) b.add(geo.cone(0.008, 0.035, 6), metal, { p: [s * 0.02, y - 0.015, 0.145], r: [HALF_PI + 0.5, 0, 0] });
  sensorCluster(b, [0, y + 0.03, 0.128], 3, 0.005, glow);
  ammoBox(b, [-0.055, y + 0.048, -0.01], HALF_PI, metal, 0.9);
  for (const x of [-0.022, 0.022]) finRings(b, x, y + 0.068, 0.06, 0.075, 2, 0.013, mat.dark);
}

// ---------- Quad-Drohne / quad drone ----------

export function quadDrone(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const y = 0.22;
  b.add(geo.rbox(0.12, 0.05, 0.15, 0.016), plate, { p: [0, y, 0] });
  hexPanel(b, [0, y + 0.027, -0.01], 0.035, L.primary, [0, 0, 0]);
  b.add(geo.sphere(0.018, lite ? 6 : 10, lite ? 3 : 5), glow, { p: [0, y, 0.075] });
  // Arme + Rotoren mit Schutzring / arms + rotors with guard rings
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c: V3 = [sx * 0.16, y + 0.012, sz * 0.16];
    b.tube([sx * 0.05, y + 0.01, sz * 0.05], c, 0.01, lite ? 5 : 8, metal);
    b.cyl(0.016, 0.018, 0.03, lite ? 6 : 10, metal, [c[0], c[1] + 0.005, c[2]]);
    b.add(geo.torus(0.08, 0.008, 4, lite ? 10 : 20), plate, { p: [c[0], c[1] + 0.012, c[2]], r: [HALF_PI, 0, 0] });
    b.add(geo.torus(0.08, 0.004, 3, lite ? 10 : 20), glow, { p: [c[0], c[1] + 0.006, c[2]], r: [HALF_PI, 0, 0] });
    for (const a of [0.4, 0.4 + HALF_PI]) b.box(0.14, 0.003, 0.016, mat.dark, [c[0], c[1] + 0.022, c[2]], [0, a, 0]);
    if (!lite) b.tube([sx * 0.05, y - 0.02, sz * 0.05], [sx * 0.07, y - 0.07, sz * 0.07], 0.004, 4, metal);
  }
  if (!lite && fine()) quadDetail(b, L, y);
  // Unterflur-Waffe / underslung gun
  b.add(geo.rbox(0.04, 0.03, 0.06, 0.008), metal, { p: [0, y - 0.04, 0.03] });
  b.cyl(0.008, 0.009, 0.12, lite ? 6 : 10, metal, [0, y - 0.04, 0.11], [HALF_PI, 0, 0]);
  if (!lite) coils(b, 0, y - 0.04, 0.07, 0.15, 2, 0.012);
  b.add(geo.ico(0.009, 0), glow, { p: [0, y - 0.04, 0.175] });
  // Schwebeanzeige am Boden / hover indicator on the ground
  if (!lite) {
    for (const r of [0.12, 0.2]) b.add(geo.torus(r, 0.005, 3, 20), shade(glow, 1.15), { p: [0, 0.003, 0], r: [HALF_PI, 0, 0], s: [1, 1, 0.3] });
    addEmblem(b, f, 0.02, 0.004, L.primary, { p: [0, y + 0.03, -0.06], r: [-HALF_PI, 0, 0] });
  }
  return b;
}

/**
 * Quad-Drohne, hohe Qualitaet: Plattenfugen und Schlitze auf dem Rumpf, Sensorgruppe vorn, Kuehlrippen und Nabenkappen an
 * den Motoren, farbige Blattspitzen, Fusspolster, Munitionstrommel, Antenne.
 * Quad drone, high quality: panel joints and slots on the body, front sensor cluster, cooling fins and hub caps on the
 * motors, coloured blade tips, foot pads, ammo drum, antenna.
 */
function quadDetail(b: Builder, L: Look, y: number) {
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  // Speichen der Schutzringe, Akkupack, Kamera-Gimbal, Armverkleidung / guard ring spokes, battery pack, camera gimbal, arm covers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c: V3 = [sx * 0.16, y + 0.024, sz * 0.16];
    b.segment(V([sx * 0.06, y + 0.018, sz * 0.06]), V([sx * 0.13, y + 0.02, sz * 0.13]), (len) => geo.rbox(0.026, len, 0.014, 0.005), plate, (len) => {
      b.box(0.004, len * 0.7, 0.003, glow, [0, len * 0.5, 0.0075]);
    });
    for (const a of [0.0, HALF_PI, Math.PI, -HALF_PI]) b.box(0.004, 0.004, 0.064, plate, [c[0] + Math.sin(a) * 0.046, c[1], c[2] + Math.cos(a) * 0.046], [0, a, 0]);
    cable(b, [sx * 0.05, y - 0.008, sz * 0.05], [c[0] * 0.92, y - 0.002, c[2] * 0.92], 0.006, 0.0025, mat.dark);
  }
  b.add(geo.cbox(0.08, 0.02, 0.08, 0.006), metal, { p: [0, y - 0.034, -0.035] });
  for (let i = 0; i < 4; i++) b.box(0.07, 0.003, 0.004, glow, [0, y - 0.045, -0.06 + i * 0.016]);
  b.add(geo.sphere(0.016, 10, 6), mat.dark, { p: [0, y - 0.03, 0.06] });
  b.add(geo.cyl(0.008, 0.008, 0.006, 8), mat.glassDark, { p: [0, y - 0.032, 0.076], r: [HALF_PI, 0, 0] });
  seam(b, [-0.058, y + 0.026, 0.04], [0.058, y + 0.026, 0.04], shade(plate, 0.7));
  seam(b, [-0.058, y + 0.026, -0.05], [0.058, y + 0.026, -0.05], shade(plate, 0.7));
  vents(b, [0, y + 0.026, 0.058], [0, 0, 0], 3, 0.05, 0.007);
  sensorCluster(b, [0, y - 0.014, 0.076], 3, 0.005, glow);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c: V3 = [sx * 0.16, y + 0.012, sz * 0.16];
    for (const dy of [-0.006, 0.0, 0.006]) b.add(geo.cyl(0.021, 0.021, 0.003, 10), mat.dark, { p: [c[0], c[1] + 0.005 + dy, c[2]] });
    b.add(geo.hemi(0.012, 10, 3), L.primary, { p: [c[0], c[1] + 0.026, c[2]] });
    for (const a of [0.4, 0.4 + HALF_PI]) for (const e of [-1, 1]) b.box(0.016, 0.0035, 0.017, L.primary, [c[0] + Math.cos(a) * e * 0.062, c[1] + 0.022, c[2] - Math.sin(a) * e * 0.062], [0, a, 0]);
    b.add(geo.cyl(0.01, 0.012, 0.005, 8), mat.dark, { p: [sx * 0.07, y - 0.072, sz * 0.07] });
    b.box(0.004, 0.003, 0.05, glow, [sx * 0.1, y + 0.002, sz * 0.1], [0, Math.atan2(sx, sz), 0]);
  }
  b.add(geo.cyl(0.02, 0.02, 0.03, 12), metal, { p: [0.03, y - 0.04, 0.02], r: [0, 0, HALF_PI] });
  b.add(geo.cyl(0.021, 0.021, 0.004, 12), glow, { p: [0.046, y - 0.04, 0.02], r: [0, 0, HALF_PI] });
  // flache Klingenantenne / flat blade antenna
  b.add(geo.cbox(0.004, 0.018, 0.03, 0.002), mat.dark, { p: [-0.03, y + 0.034, -0.055], r: [-0.3, 0, 0] });
}

// ---------- Railgun-Plattform / railgun platform ----------

export function railgun(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  tracks(b, { x: 0.13, w: 0.08, len: 0.38, h: 0.08, wheels: 5, wr: 0.026, sprocket: L.primary, hub: glow, lite, links: 9, rich: true });
  if (!lite && fine()) railgunDetail(b, L);
  // Wanne mit Sechseckpaneelen / hull with hexagon panels
  b.add(geo.rtaper(0.34, 0.38, 0.28, 0.32, 0.06, 0.014), plate, { p: [0, 0.11, -0.01] });
  if (!lite) {
    for (const x of [-0.08, 0, 0.08]) hexPanel(b, [x, 0.142, 0.12], 0.025, shade(plate, 0.9), [0, 0, 0]);
    for (const s of [-1, 1]) {
      b.box(0.004, 0.004, 0.3, glow, [s * 0.15, 0.135, -0.01]);
      for (let i = 0; i < 4; i++) hexPanel(b, [s * 0.172, 0.06, -0.13 + i * 0.085], 0.024, shade(plate, 0.92), [0, 0, HALF_PI]);
    }
    b.box(0.2, 0.004, 0.004, glow, [0, 0.14, 0.17]);
  }
  // Turm + sehr lange Railgun / turret + very long railgun
  b.cyl(0.06, 0.07, 0.025, lite ? 8 : 12, metal, [0, 0.152, -0.04]);
  b.add(geo.rtaper(0.17, 0.17, 0.13, 0.13, 0.06, 0.016), plate, { p: [0, 0.195, -0.05] });
  const gy = 0.21;
  for (const x of [-0.02, 0.02]) b.add(lite ? geo.box(0.014, 0.034, 0.42) : geo.cbox(0.014, 0.034, 0.42, 0.004), metal, { p: [x, gy, 0.22] });
  b.box(0.026, 0.012, 0.42, mat.dark, [0, gy - 0.012, 0.22]);
  coils(b, 0, gy, 0.05, 0.43, lite ? 3 : 8, 0.034, true);
  b.add(geo.ico(0.012, lite ? 0 : 1), glow, { p: [0, gy, 0.435] });
  if (!lite) {
    // Kondensatorbaenke + Sensormast / capacitor banks + sensor mast
    for (const s of [-1, 1]) {
      b.add(geo.cbox(0.04, 0.05, 0.1, 0.01), metal, { p: [s * 0.1, 0.2, -0.06] });
      for (let i = 0; i < 3; i++) b.cyl(0.009, 0.009, 0.042, 8, glow, [s * 0.1, 0.228, -0.09 + i * 0.03]);
      addEmblem(b, f, 0.022, 0.006, L.primary, { p: [s * 0.121, 0.2, -0.06], r: [0, s * HALF_PI, 0] });
    }
    b.tube([0.05, 0.225, -0.1], [0.05, 0.31, -0.11], 0.005, 6, metal);
    b.add(geo.rbox(0.04, 0.025, 0.03, 0.007), plate, { p: [0.05, 0.32, -0.11] });
    b.box(0.03, 0.01, 0.004, glow, [0.05, 0.32, -0.094]);
    antenna(b, -0.06, 0.225, -0.1, 0.14, glow);
  }
  return b;
}

/**
 * Railgun-Plattform, hohe Qualitaet: Wartungsklappen, Plattenfugen, Lueftungsgitter, Abschleppoesen, Sensorkuppeln,
 * Schienenhalter, Kabel von den Kondensatoren zu den Schienen, Kuehlrippen am Turm.
 * Railgun platform, high quality: service hatches, panel joints, ventilation grilles, tow eyes, sensor domes, rail
 * brackets, cables from the capacitors to the rails, cooling fins on the turret.
 */
function railgunDetail(b: Builder, L: Look) {
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow, gy = 0.21;
  for (const s of [-1, 1]) {
    squareHatch(b, s * 0.1, 0.14, 0.06, 0.05, 0.04, shade(plate, 0.95));
    seam(b, [s * 0.13, 0.141, -0.17], [s * 0.13, 0.141, 0.15], shade(plate, 0.72));
    grille(b, [s * 0.1, 0.14, -0.15], 0.06, 0.04, 4, metal);
    towHook(b, s * 0.08, 0.08, 0.19, 1, metal);
    towHook(b, s * 0.09, 0.08, -0.2, -1, metal);
    b.add(geo.hemi(0.01, 10, 3), mat.glassDark, { p: [s * 0.15, 0.14, 0.15] });
    cable(b, [s * 0.1, 0.225, -0.02], [s * 0.022, gy - 0.012, 0.04], 0.01, 0.004, mat.dark);
    b.box(0.004, 0.004, 0.12, glow, [s * 0.13, 0.1425, 0.06]);
  }
  for (const z of [0.12, 0.24, 0.36]) b.box(0.07, 0.008, 0.012, mat.dark, [0, gy - 0.022, z]);
  for (let i = 0; i < 5; i++) b.box(0.004, 0.03, 0.12, metal, [-0.06 + i * 0.03, 0.235, -0.07]);
  boltRing(b, [0, 0.166, -0.04], 0.066, 10, mat.dark, 0.0045);
}

// ---------- Titan ----------

export function titan(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const hi = !lite && fine();
  if (hi) titanLegs(b, L);
  // schwere Beine / heavy legs
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.085, 0.25, 0], knee: V3 = [s * 0.095, 0.15, 0.045], ankle: V3 = [s * 0.095, 0.045, 0];
    limb(b, hip, knee, 0.07, 0.075, plate, lite);
    limb(b, knee, ankle, 0.06, 0.065, metal, lite);
    joint(b, hip, 0.035, lite);
    joint(b, knee, 0.032, lite);
    b.add(geo.rtaper(0.07, 0.03, 0.05, 0.02, 0.06, 0.008), L.primary, { p: [s * 0.095, 0.155, 0.08], r: [-0.3, 0, 0] });
    b.add(lite ? geo.box(0.09, 0.04, 0.13) : geo.rtaper(0.09, 0.14, 0.07, 0.09, 0.04, 0.01, 0.01), metal, { p: [s * 0.095, 0.02, 0.015] });
    if (!lite) {
      b.box(0.006, 0.06, 0.006, glow, [s * 0.13, 0.1, 0.02]);
      for (const dx of [-0.025, 0.025]) b.add(geo.rtaper(0.024, 0.03, 0.018, 0.02, 0.022, 0.005), metal, { p: [s * 0.095 + dx, 0.011, 0.09] });
    }
  }
  // Becken + Rumpf mit Leuchtkern / pelvis + torso with glowing core
  b.add(geo.rbox(0.18, 0.06, 0.11, 0.018), metal, { p: [0, 0.27, 0] });
  b.cyl(0.06, 0.07, 0.04, lite ? 8 : 12, metal, [0, 0.305, 0]);
  // Oberkoerper dreht sich zum Ziel (Torso-Drehung, siehe Builder.turret) / upper body turns towards the target (torso twist, see Builder.turret)
  b.turret([0, 0.3, 0], () => {
    b.add(lite ? geo.taper(0.18, 0.12, 0.27, 0.15, 0.15) : geo.rtaper(0.18, 0.12, 0.27, 0.15, 0.15, 0.022), plate, { p: [0, 0.385, 0] });
    b.add(geo.sphere(0.032, lite ? 8 : 14, lite ? 4 : 8), glow, { p: [0, 0.385, 0.075] });
    b.add(geo.torus(0.042, 0.009, 4, lite ? 10 : 18), metal, { p: [0, 0.385, 0.078] });
    if (!lite) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.box(0.004, 0.022, 0.004, glow, [Math.sin(a) * 0.06, 0.385 + Math.cos(a) * 0.06, 0.076], [0, 0, -a]);
      }
      addEmblem(b, f, 0.026, 0.006, L.primary, { p: [-0.08, 0.42, 0.074] });
      for (const s of [-1, 1]) hexPanel(b, [s * 0.11, 0.37, 0.062], 0.024, shade(plate, 0.9), [HALF_PI, 0, 0]);
    }
    // Kopf mit Visier / head with visor
    b.cyl(0.03, 0.035, 0.03, lite ? 6 : 10, metal, [0, 0.47, 0]);
    b.add(geo.rbox(0.08, 0.06, 0.08, 0.016), plate, { p: [0, 0.505, 0.01] });
    b.box(0.07, 0.012, 0.006, glow, [0, 0.51, 0.052]);
    b.add(geo.rtaper(0.06, 0.07, 0.02, 0.05, 0.02, 0.006), L.primary, { p: [0, 0.545, 0.0] });
    // schwere Schulterpanzer / heavy pauldrons
    for (const s of [-1, 1]) {
      joint(b, [s * 0.15, 0.43, 0], 0.035, lite);
      b.add(lite ? geo.box(0.1, 0.07, 0.12) : geo.rtaper(0.1, 0.12, 0.08, 0.1, 0.07, 0.016), L.primary, { p: [s * 0.17, 0.46, 0], r: [0, 0, s * -0.2] });
      if (!lite) {
        b.box(0.004, 0.06, 0.1, glow, [s * 0.22, 0.45, 0], [0, 0, s * -0.2]);
        addEmblem(b, f, 0.024, 0.006, plate, { p: [s * 0.22, 0.46, 0], r: [0, s * HALF_PI, s * -0.2] });
      }
    }
    // rechter Arm: Armkanone / right arm: arm cannon
    limb(b, [0.17, 0.42, 0], [0.19, 0.33, 0.03], 0.055, 0.06, plate, lite);
    joint(b, [0.19, 0.33, 0.03], 0.03, lite);
    b.add(geo.rbox(0.07, 0.07, 0.1, 0.016), metal, { p: [0.19, 0.31, 0.08] });
    b.cyl(0.032, 0.038, 0.2, lite ? 8 : 14, metal, [0.19, 0.31, 0.2], [HALF_PI, 0, 0]);
    if (!lite) coils(b, 0.19, 0.31, 0.13, 0.28, 4, 0.04);
    b.cyl(0.026, 0.026, 0.012, lite ? 8 : 14, mat.ink, [0.19, 0.31, 0.302], [HALF_PI, 0, 0]);
    b.add(geo.ico(0.02, lite ? 0 : 1), glow, { p: [0.19, 0.31, 0.305] });
    // linker Arm: Armklinge / left arm: arm blade
    limb(b, [-0.17, 0.42, 0], [-0.19, 0.33, 0.03], 0.055, 0.06, plate, lite);
    joint(b, [-0.19, 0.33, 0.03], 0.03, lite);
    b.add(geo.rbox(0.06, 0.06, 0.12, 0.014), metal, { p: [-0.19, 0.31, 0.09] });
    b.add(geo.profileZY([[0.12, -0.02], [0.33, 0.0], [0.36, 0.03], [0.14, 0.03]], 0.012), plate, { p: [-0.19, 0.31, 0] });
    b.box(0.014, 0.006, 0.22, glow, [-0.19, 0.31, 0.24], [-0.06, 0, 0]);
    // Ruecken: Reaktorpacks + Antennen / back: reactor packs + antennas
    for (const s of [-1, 1]) {
      b.cyl(0.03, 0.034, 0.12, lite ? 6 : 12, metal, [s * 0.06, 0.41, -0.1]);
      b.add(geo.cyl(0.031, 0.031, 0.014, lite ? 6 : 12, true), glow, { p: [s * 0.06, 0.45, -0.1] });
      if (!lite) antenna(b, s * 0.1, 0.46, -0.07, 0.12, glow);
    }
    if (hi) titanUpper(b, L);
  });
  return b;
}

/** Titan-Beine und Becken, hohe Qualitaet: Hydraulik, Zehenplatten, Kniebolzen, Hueftplatten / Titan legs and pelvis, high quality */
function titanLegs(b: Builder, L: Look) {
  const plate = L.hull, metal = mat.gunmetal;
  // Oberschenkel- und Schienbeinpanzer, Krallen, Hueftgelenke / thigh and shin armour, claws, hip joints
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.02, 0.07, 0.016, 0.055, 0.08, 0.006), L.primary, { p: [s * 0.128, 0.205, 0.02], r: [0.3, 0, s * 0.08] });
    for (const y of [0.19, 0.22]) b.box(0.004, 0.004, 0.004, mat.dark, [s * 0.139, y, 0.03]);
    b.add(geo.rtaper(0.06, 0.018, 0.05, 0.014, 0.07, 0.006), plate, { p: [s * 0.095, 0.095, 0.045], r: [-0.12, 0, 0] });
    b.box(0.04, 0.003, 0.004, mat.cyanGlow, [s * 0.095, 0.11, 0.054]);
    for (const dx of [-0.03, 0, 0.03]) b.add(geo.cone(0.007, 0.022, 6), metal, { p: [s * 0.095 + dx, 0.008, 0.115], r: [HALF_PI + 0.3, 0, 0] });
    b.add(ball(0.03, 12, 8), metal, { p: [s * 0.1, 0.255, 0] });
    b.add(geo.cyl(0.024, 0.024, 0.012, 12), L.primary, { p: [s * 0.13, 0.255, 0], r: [0, 0, HALF_PI] });
  }
  for (const s of [-1, 1]) {
    piston(b, [s * 0.125, 0.24, 0.02], [s * 0.13, 0.165, 0.06], 0.008, metal);
    piston(b, [s * 0.095, 0.13, -0.03], [s * 0.095, 0.05, -0.035], 0.008, metal);
    for (const dx of [-0.025, 0.025]) b.box(0.004, 0.004, 0.004, mat.dark, [s * 0.095 + dx, 0.175, 0.092]);
    b.add(geo.rtaper(0.06, 0.02, 0.05, 0.016, 0.06, 0.006), L.primary, { p: [s * 0.105, 0.235, 0.05], r: [-0.2, 0, s * 0.15] });
    seam(b, [s * 0.13, 0.24, -0.02], [s * 0.135, 0.17, 0.03], shade(plate, 0.7));
    b.add(geo.cbox(0.06, 0.012, 0.024, 0.004), shade(metal, 1.1), { p: [s * 0.095, 0.006, -0.05] });
  }
  vents(b, [0, 0.27, 0.056], [HALF_PI, 0, 0], 3, 0.1, 0.012);
}

/**
 * Titan-Oberkoerper, hohe Qualitaet: Bauchschlitze, Brustfugen, Kuehlrippen an den Reaktoren, Kabel zur Armkanone,
 * Schienen und Schlitze an der Kanone, Klingenkante und Bolzen, Sensorhuelsen am Kopf, Nieten an den Schulterpanzern.
 * Titan upper body, high quality: abdominal slots, chest joints, cooling fins on the reactors, cables to the arm cannon,
 * rails and slots on the cannon, blade edge and bolts, sensor pods on the head, rivets on the pauldrons.
 */
function titanUpper(b: Builder, L: Look) {
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  // Brustplatten mit Bolzen, Unterarmpanzer, Armhydraulik, Rueckenplatten / chest plates with bolts, forearm armour, arm hydraulics, back plates
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.08, 0.02, 0.07, 0.016, 0.05, 0.006), L.primary, { p: [s * 0.065, 0.435, 0.07], r: [-0.25, 0, 0] });
    rivets(b, [s * 0.035, 0.452, 0.081], [s * 0.095, 0.452, 0.081], 4, mat.dark, 0.0045);
    piston(b, [s * 0.165, 0.405, -0.03], [s * 0.19, 0.335, 0.0], 0.008, metal);
    b.add(geo.rtaper(0.1, 0.02, 0.09, 0.016, 0.1, 0.008), shade(plate, 0.92), { p: [s * 0.07, 0.4, -0.074], r: [0.15, 0, 0] });
  }
  b.add(geo.rtaper(0.02, 0.09, 0.016, 0.075, 0.06, 0.006), L.primary, { p: [0.228, 0.31, 0.09] });
  // Reaktorkabel und Klingenbolzen / reactor cables and blade bolts
  for (const s of [-1, 1]) cable(b, [s * 0.06, 0.36, -0.13], [s * 0.1, 0.3, -0.06], 0.02, 0.005, mat.dark);
  rivets(b, [-0.196, 0.322, 0.14], [-0.196, 0.322, 0.3], 5, mat.dark, 0.005);
  b.add(geo.rtaper(0.02, 0.09, 0.016, 0.075, 0.06, 0.006), L.primary, { p: [-0.222, 0.31, 0.09] });
  vents(b, [0, 0.335, 0.07], [HALF_PI - 0.35, 0, 0], 4, 0.07, 0.01);
  seam(b, [-0.12, 0.43, 0.06], [0.12, 0.43, 0.06], shade(plate, 0.7));
  for (const s of [-1, 1]) {
    for (const y of [0.37, 0.39, 0.41, 0.43]) b.add(geo.cyl(0.038, 0.038, 0.004, 12), mat.dark, { p: [s * 0.06, y, -0.1] });
    rivets(b, [s * 0.14, 0.497, -0.045], [s * 0.2, 0.48, -0.045], 4, shade(L.primary, 0.65), 0.005);
    rivets(b, [s * 0.14, 0.497, 0.045], [s * 0.2, 0.48, 0.045], 4, shade(L.primary, 0.65), 0.005);
    b.add(geo.cyl(0.01, 0.01, 0.024, 10), metal, { p: [s * 0.045, 0.51, 0.0], r: [0, 0, HALF_PI] });
    b.add(geo.cyl(0.007, 0.007, 0.004, 8), glow, { p: [s * 0.058, 0.51, 0.0], r: [0, 0, HALF_PI] });
  }
  cable(b, [0.075, 0.38, -0.11], [0.19, 0.3, 0.05], 0.03, 0.006, mat.dark);
  for (const s of [-1, 1]) vents(b, [0.19 + s * 0.036, 0.31, 0.08], [0, 0, s * HALF_PI], 4, 0.04, 0.018);
  for (const s of [-1, 1]) b.box(0.006, 0.012, 0.16, mat.dark, [0.19 + s * 0.03, 0.335, 0.2]);
  b.box(0.004, 0.004, 0.2, mat.metalLight, [-0.19, 0.34, 0.24], [-0.06, 0, 0]);
  for (const z of [0.05, 0.1]) b.box(0.016, 0.008, 0.008, mat.dark, [-0.19, 0.31, z]);
  vents(b, [0, 0.49, 0.051], [HALF_PI, 0, 0], 2, 0.04, 0.008);
}

