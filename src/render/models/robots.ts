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
import { Builder, geo, shade, type ColorLike, type V3 } from './kit';
import { look, mat } from './look';
import { antenna, tracks } from './tanks';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/** Gliedsegment als gefaster Quader / limb segment as chamfered box */
function limb(b: Builder, a: V3, c: V3, w: number, d: number, col: ColorLike, lite: boolean) {
  b.segment(V(a), V(c), (l) => (lite ? geo.box(w, l + 0.01, d) : geo.rbox(w, l + 0.01, d, Math.min(w, d) * 0.25)), col);
}

function joint(b: Builder, p: V3, r: number, lite: boolean, col: ColorLike = mat.gunmetal) {
  b.add(geo.sphere(r, lite ? 6 : 10, lite ? 3 : 5), col, { p });
}

/** Sechseckpaneel auf einer Flaeche / hexagon panel on a face */
function hexPanel(b: Builder, p: V3, r: number, col: ColorLike, rot: V3) {
  b.add(geo.cyl(r, r, 0.005, 6), col, { p, r: rot });
}

/** Leuchtspulen entlang +z / glowing coils along +z */
function coils(b: Builder, x: number, y: number, z0: number, z1: number, n: number, r: number, square = false) {
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
  b.add(geo.rbox(0.042, 0.042, 0.1, 0.01), metal, { p: [0.1, 0.225, 0.1] });
  b.cyl(0.012, 0.014, 0.12, lite ? 6 : 10, metal, [0.1, 0.228, 0.2], [HALF_PI, 0, 0]);
  if (!lite) coils(b, 0.1, 0.228, 0.15, 0.25, 3, 0.017);
  b.add(geo.ico(0.012, lite ? 0 : 1), glow, { p: [0.1, 0.228, 0.265] });
  // linker Arm stuetzt / left arm supports
  const shL: V3 = [-0.09, 0.3, 0], elL: V3 = [-0.1, 0.23, 0.05], hL: V3 = [0.06, 0.215, 0.12];
  joint(b, shL, 0.026, lite, L.primary);
  limb(b, shL, elL, 0.036, 0.04, plate, lite);
  joint(b, elL, 0.02, lite);
  limb(b, elL, hL, 0.032, 0.036, metal, lite);
  b.add(geo.rbox(0.03, 0.028, 0.03, 0.008), metal, { p: hL });
  return b;
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

// ---------- Railgun-Plattform / railgun platform ----------

export function railgun(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  tracks(b, { x: 0.13, w: 0.08, len: 0.38, h: 0.08, wheels: 5, wr: 0.026, sprocket: L.primary, hub: glow, lite, links: 9 });
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

// ---------- Titan ----------

export function titan(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
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
  return b;
}

