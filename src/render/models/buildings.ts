/**
 * Wirtschaftsgebaeude, Aussenposten, Strasse, Bruecke, Forschungszentrum, Grossprojekte, Kartenobjekte.
 * Economy buildings, outpost, road, bridge, research centre, grand projects, map features.
 * Gebaeude sind modern; Fraktionsfarbe an Dach, Akzenten und Flagge.
 * Buildings are modern; faction colour on roofs, accents and flag.
 */
import type { BuildingId, FactionId, GrandProjectId } from '../../data/balance';
import {
  HALF_PI, band, barrel, chimney, container, crate, dish, flagPole, gableRoof, house, sandbag,
} from './architecture';
import { addEmblem } from './emblems';
import { Builder, geo, rng, shade } from './kit';
import { look, mat } from './look';
import { cattle } from './nature';

type Kind = BuildingId | 'outpost' | GrandProjectId;

/** Kleine Halle mit Satteldach / small hall with gable roof */
function hall(b: Builder, f: FactionId | null, x: number, z: number, w: number, d: number, h: number, ry = 0, wall = look(f).wall) {
  const L = look(f);
  b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    b.block(0, 0, 0, w, h, d, wall);
    b.block(0, 0, d / 2 + 0.002, w * 0.45, h * 0.7, 0.006, mat.darkMid);
    for (let i = 0; i < 3; i++) b.block(0, h * 0.12 + i * h * 0.2, d / 2 + 0.005, w * 0.45, 0.006, 0.004, mat.metal);
    gableRoof(b, 0, h, 0, w + 0.03, d + 0.03, Math.min(0.09, w * 0.35), L.roof, HALF_PI);
    // Fensterreihe, Dachfirst, Regenrinnen, Lampe / window row, ridge, gutters, lamp
    const n = Math.max(2, Math.round(w / 0.07));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ((i + 0.5) / n) * w;
      if (Math.abs(x) < w * 0.25) continue;
      b.block(x, h * 0.55, d / 2 + 0.002, 0.03, 0.03, 0.006, mat.window);
      b.block(x, h * 0.55 - 0.004, d / 2 + 0.004, 0.036, 0.004, 0.008, L.wallDark);
    }
    for (let i = 0; i < 3; i++) b.block(w / 2 + 0.002, h * 0.55, -d / 2 + ((i + 0.5) / 3) * d, 0.006, 0.03, 0.03, mat.window);
    b.box(w + 0.04, 0.012, 0.012, L.roofDark, [0, h + Math.min(0.09, w * 0.35), 0]);
    for (const s of [-1, 1]) b.box(w + 0.03, 0.008, 0.01, mat.metal, [0, h - 0.002, s * (d / 2 + 0.018)]);
    b.box(0.014, 0.01, 0.014, mat.yellow, [0, h * 0.8, d / 2 + 0.01]);
  });
}

/** Saegezahnhalle (Fabrik) / sawtooth factory hall */
export function sawtoothHall(b: Builder, f: FactionId | null, x: number, z: number, w: number, d: number, h: number, teeth = 3) {
  const L = look(f);
  b.block(x, 0, z, w, h, d, L.wallDark);
  band(b, x, h * 0.45, z, w, d, 0.02, mat.window);
  const tw = d / teeth;
  for (let i = 0; i < teeth; i++) {
    const z0 = z - d / 2 + i * tw;
    b.add(geo.profileZY([[0, 0], [tw, 0], [tw, 0.055], [tw - 0.012, 0.055]], w), L.roof, { p: [x, h, z0] });
    b.add(geo.profileZY([[tw - 0.012, 0.0], [tw, 0.0], [tw, 0.05], [tw - 0.012, 0.05]], w * 0.9), mat.glass, { p: [x, h + 0.002, z0 + 0.002] });
  }
}

function tree(b: Builder, x: number, z: number, s: number, seed: number) {
  const R = rng(seed);
  b.cyl(0.012 * s, 0.016 * s, 0.06 * s, 5, mat.wood, [x, 0.03 * s, z]);
  b.add(geo.cone(0.075 * s, 0.12 * s, 6), mat.leafDark, { p: [x, 0.1 * s, z], r: [0, R() * 3, 0] });
  b.add(geo.cone(0.055 * s, 0.1 * s, 6), mat.leaf, { p: [x, 0.17 * s, z], r: [0, R() * 3, 0] });
}

function tractor(b: Builder, f: FactionId | null, x: number, z: number, ry: number) {
  const L = look(f);
  b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    b.block(0, 0.03, 0.02, 0.06, 0.04, 0.1, L.primary);
    b.block(0, 0.03, -0.03, 0.07, 0.07, 0.05, L.primary);
    b.block(0, 0.1, -0.03, 0.074, 0.008, 0.055, L.secondary);
    for (const s of [-1, 1]) {
      b.cyl(0.035, 0.035, 0.02, 8, mat.dark, [s * 0.045, 0.035, -0.035], [0, 0, HALF_PI]);
      b.cyl(0.02, 0.02, 0.016, 8, mat.dark, [s * 0.04, 0.02, 0.06], [0, 0, HALF_PI]);
    }
  });
}

function rails(b: Builder, x0: number, z0: number, x1: number, z1: number) {
  b.tube([x0 - 0.015, 0.006, z0], [x1 - 0.015, 0.006, z1], 0.004, 4, mat.metal);
  b.tube([x0 + 0.015, 0.006, z0], [x1 + 0.015, 0.006, z1], 0.004, 4, mat.metal);
}

/** Bohlen-Steg auf Pfaehlen / plank pier on piles */
function pier(b: Builder, x: number, z: number, w: number, d: number, y = 0.035, c = mat.woodLight) {
  b.block(x, y - 0.012, z, w, 0.012, d, c);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.01, 0.01, y + 0.02, 5, mat.wood, [x + sx * (w / 2 - 0.012), (y - 0.02) / 2, z + sz * (d / 2 - 0.012)]);
}

// ---------- Wirtschaft / economy ----------

function storehouse(b: Builder, f: FactionId | null) {
  const L = look(f);
  hall(b, f, -0.05, -0.08, 0.36, 0.26, 0.15);
  crate(b, 0.2, 0, 0.14, 0.07);
  crate(b, 0.12, 0, 0.18, 0.06, L.secondary);
  crate(b, 0.19, 0.07, 0.15, 0.055);
  barrel(b, -0.2, 0, 0.18, L.primary);
  barrel(b, -0.14, 0, 0.2, mat.metal);
  b.block(0.04, 0, 0.2, 0.1, 0.012, 0.08, mat.wood);
  flagPole(b, f, 0.27, 0, -0.25, 0.3, 0.8);
}

function ranch(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Scheune / barn
  b.group({ p: [-0.12, 0, -0.12] }, () => {
    b.block(0, 0, 0, 0.22, 0.13, 0.2, mat.wood);
    b.block(0, 0, 0.102, 0.08, 0.1, 0.006, mat.woodLight);
    b.box(0.08, 0.008, 0.006, mat.white, [0, 0.05, 0.106], [0, 0, 0.9]);
    b.box(0.08, 0.008, 0.006, mat.white, [0, 0.05, 0.106], [0, 0, -0.9]);
    gableRoof(b, 0, 0.13, 0, 0.26, 0.23, 0.1, L.roof);
  });
  // Silo
  b.cyl(0.05, 0.05, 0.26, 8, L.wall, [0.06, 0.13, -0.2]);
  b.add(geo.hemi(0.05, 8, 2), L.roof, { p: [0.06, 0.26, -0.2] });
  // Zaun / fence
  const R = 0.36;
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    const a1 = ((i + 1) / 12) * Math.PI * 2;
    if (i === 2) continue;
    const p0: [number, number] = [Math.cos(a0) * R, Math.sin(a0) * R];
    const p1: [number, number] = [Math.cos(a1) * R, Math.sin(a1) * R];
    b.cyl(0.008, 0.008, 0.07, 4, mat.wood, [p0[0], 0.035, p0[1]]);
    b.tube([p0[0], 0.05, p0[1]], [p1[0], 0.05, p1[1]], 0.005, 4, mat.woodLight);
  }
  b.addColored(cattle(1), { p: [0.14, 0, 0.12], r: [0, 0.6, 0] });
  b.addColored(cattle(2), { p: [-0.1, 0, 0.2], r: [0, -1.2, 0] });
}

function fishery(b: Builder, f: FactionId | null) {
  const L = look(f);
  pier(b, 0, -0.1, 0.5, 0.22);
  pier(b, 0.15, 0.15, 0.1, 0.32);
  // Huette / hut
  b.group({ p: [-0.12, 0.035, -0.12] }, () => {
    b.block(0, 0, 0, 0.16, 0.1, 0.12, L.wall);
    b.block(0, 0, 0.062, 0.04, 0.07, 0.004, mat.wood);
    gableRoof(b, 0, 0.1, 0, 0.19, 0.15, 0.07, L.roof, HALF_PI);
  });
  // Trockengestell mit Fischen / drying rack with fish
  for (const x of [0.04, 0.2]) b.cyl(0.006, 0.006, 0.12, 4, mat.wood, [x, 0.095, -0.06]);
  b.tube([0.04, 0.15, -0.06], [0.2, 0.15, -0.06], 0.004, 4, mat.wood);
  for (const x of [0.07, 0.11, 0.15]) b.add(geo.taper(0.012, 0.03, 0.004, 0.02, 0.05), mat.metalLight, { p: [x, 0.12, -0.06] });
  crate(b, 0.0, 0.035, -0.03, 0.05, L.secondary);
  // Boot / boat
  b.group({ p: [-0.18, 0, 0.18], r: [0, 0.3, 0] }, () => {
    b.add(geo.prismXZ([[-0.04, -0.09], [0.04, -0.09], [0.045, 0.05], [0, 0.11], [-0.045, 0.05]], 0.035), L.primary, { p: [0, -0.01, 0] });
    b.add(geo.prismXZ([[-0.03, -0.08], [0.03, -0.08], [0.035, 0.05], [0, 0.09], [-0.035, 0.05]], 0.004), mat.woodLight, { p: [0, 0.022, 0] });
  });
  // Bojen / buoys
  b.cyl(0.02, 0.025, 0.04, 8, mat.red, [0.3, 0.01, 0.3]);
  b.cyl(0.021, 0.021, 0.012, 8, mat.white, [0.3, 0.02, 0.3]);
}

function lumberCamp(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Blockhuette / log cabin
  b.group({ p: [-0.12, 0, -0.1] }, () => {
    b.block(0, 0, 0, 0.2, 0.12, 0.16, mat.wood);
    for (let i = 0; i < 4; i++) b.block(0, 0.015 + i * 0.03, 0, 0.21, 0.008, 0.17, mat.woodLight);
    b.block(0, 0, 0.082, 0.04, 0.08, 0.006, mat.darkMid);
    gableRoof(b, 0, 0.12, 0, 0.24, 0.2, 0.09, L.roof, HALF_PI);
  });
  // Stammstapel / log pile
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) {
      const x = 0.1 + (i - (2 - row) / 2) * 0.05;
      b.cyl(0.024, 0.024, 0.24, 6, mat.wood, [x, 0.024 + row * 0.042, 0.15], [HALF_PI, 0, 0]);
      b.cyl(0.018, 0.018, 0.242, 6, mat.woodLight, [x, 0.024 + row * 0.042, 0.15], [HALF_PI, 0, 0]);
    }
  }
  // Saegebock + Stumpf + Axt / sawhorse + stump + axe
  b.cyl(0.035, 0.04, 0.05, 7, mat.wood, [0.25, 0.025, -0.15]);
  b.cyl(0.03, 0.03, 0.006, 7, mat.woodLight, [0.25, 0.053, -0.15]);
  b.box(0.008, 0.08, 0.008, mat.wood, [0.25, 0.09, -0.15], [0, 0, 0.3]);
  b.box(0.03, 0.02, 0.006, mat.metalLight, [0.26, 0.125, -0.15]);
  b.block(-0.2, 0, 0.17, 0.1, 0.02, 0.05, L.secondary);
  tree(b, 0.3, 0.3, 1.1, 3);
  tree(b, -0.3, 0.3, 0.9, 4);
}

function farm(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Feld mit Reihen / field with rows
  b.block(0.1, 0, 0.12, 0.34, 0.012, 0.3, shade(mat.wood, 1.1));
  for (let i = 0; i < 5; i++) b.block(0.1, 0.012, 0.0 + i * 0.06, 0.32, 0.03, 0.026, i % 2 ? mat.yellow : mat.green);
  // Hof / farmhouse
  house(b, f, -0.2, 0.1, 0.16, 0.14, 0.11, { seed: 5 });
  // Silos
  for (const [x, z] of [[-0.24, -0.22], [-0.12, -0.26]] as [number, number][]) {
    b.cyl(0.05, 0.05, 0.32, 8, mat.concreteLight, [x, 0.16, z]);
    b.cyl(0.052, 0.052, 0.02, 8, L.primary, [x, 0.27, z]);
    b.add(geo.hemi(0.05, 8, 2), L.roof, { p: [x, 0.32, z] });
  }
  tractor(b, f, 0.15, -0.18, 0.8);
}

function mine(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Tagebau-Stufen / open pit terraces
  b.cyl(0.3, 0.32, 0.03, 8, mat.rockDark, [0, 0.015, 0.02]);
  b.cyl(0.22, 0.24, 0.03, 8, mat.rock, [0, 0.045, 0.02]);
  b.cyl(0.12, 0.14, 0.02, 8, mat.rockDark, [0, 0.07, 0.02]);
  // Foerdergeruest / headframe
  b.group({ p: [-0.18, 0, -0.18] }, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([sx * 0.06, 0, sz * 0.06], [sx * 0.025, 0.36, sz * 0.025], 0.008, 4, L.primaryDark);
    b.block(0, 0.34, 0, 0.08, 0.03, 0.08, L.primary);
    b.cyl(0.035, 0.035, 0.015, 8, mat.dark, [0, 0.39, 0], [0, 0, HALF_PI]);
    b.block(0, 0.12, 0, 0.09, 0.012, 0.09, mat.metal);
  });
  // Erzhaufen + Lore / ore heaps + mine cart
  b.add(geo.cone(0.08, 0.08, 6), mat.concreteDark, { p: [0.22, 0.04, -0.2] });
  b.add(geo.ico(0.025, 0), mat.yellow, { p: [0.22, 0.06, -0.17] });
  b.add(geo.ico(0.02, 0), mat.yellow, { p: [0.19, 0.04, -0.23] });
  rails(b, 0.0, -0.3, 0.0, 0.0);
  b.block(0.0, 0.01, -0.12, 0.07, 0.04, 0.09, L.secondary);
  b.add(geo.ico(0.03, 0), mat.yellow, { p: [0.0, 0.06, -0.12] });
  flagPole(b, f, 0.28, 0, 0.2, 0.26, 0.7);
}

function materialsPlant(b: Builder, f: FactionId | null) {
  const L = look(f);
  hall(b, f, 0.12, 0.1, 0.24, 0.24, 0.13, 0, L.wall);
  // Mischturm mit Trichter / batching tower with hopper
  b.block(-0.16, 0, -0.14, 0.14, 0.26, 0.14, mat.concreteLight);
  band(b, -0.16, 0.18, -0.14, 0.14, 0.14, 0.03, L.primary);
  b.add(geo.cyl(0.08, 0.02, 0.1, 4), L.secondary, { p: [-0.16, 0.31, -0.14], r: [0, Math.PI / 4, 0] });
  b.block(-0.16, 0.36, -0.14, 0.12, 0.04, 0.12, L.roof);
  // Foerderband / conveyor
  b.group({ p: [0.02, 0.15, -0.16], r: [0, 0, -0.45] }, () => {
    b.box(0.3, 0.014, 0.04, mat.dark, [0, 0, 0]);
    b.box(0.3, 0.004, 0.03, mat.metalLight, [0, 0.009, 0]);
  });
  b.tube([0.12, 0, -0.16], [0.12, 0.1, -0.16], 0.006, 4, mat.metal);
  // Kieshaufen / gravel heaps
  b.add(geo.cone(0.09, 0.09, 7), mat.sand, { p: [0.24, 0.045, -0.2] });
  b.add(geo.cone(0.07, 0.07, 7), mat.concrete, { p: [-0.25, 0.035, 0.15] });
  b.cyl(0.045, 0.045, 0.16, 8, mat.concreteLight, [-0.1, 0.08, 0.2]);
  b.add(geo.cyl(0.045, 0.01, 0.04, 8), mat.concrete, { p: [-0.1, -0.0, 0.2] });
}

function foodFactory(b: Builder, f: FactionId | null) {
  const L = look(f);
  sawtoothHall(b, f, -0.06, 0.04, 0.32, 0.3, 0.13, 3);
  // Tanks / tanks
  for (const [x, z] of [[0.25, -0.15], [0.25, 0.0]] as [number, number][]) {
    b.cyl(0.055, 0.055, 0.2, 10, mat.white, [x, 0.1, z]);
    b.add(geo.hemi(0.055, 10, 2), mat.metalLight, { p: [x, 0.2, z] });
    b.cyl(0.057, 0.057, 0.02, 10, L.primary, [x, 0.15, z]);
  }
  b.tube([0.25, 0.18, -0.15], [0.1, 0.18, -0.08], 0.008, 4, mat.metal);
  chimney(b, -0.2, 0, -0.18, 0.32, 0.03, mat.concreteLight);
  // Konservendosen-Paletten / can pallets
  for (const x of [0.17, 0.23]) for (const z of [0.18, 0.24]) b.cyl(0.022, 0.022, 0.04, 8, L.secondary, [x, 0.03, z]);
  b.block(0.2, 0, 0.21, 0.13, 0.01, 0.13, mat.wood);
}

function steelMill(b: Builder, f: FactionId | null) {
  const L = look(f);
  hall(b, f, 0.1, 0.12, 0.3, 0.22, 0.14, 0, L.wallDark);
  // Hochofen / blast furnace
  b.cyl(0.08, 0.1, 0.24, 10, mat.metal, [-0.17, 0.12, -0.12]);
  b.cyl(0.05, 0.08, 0.08, 10, mat.dark, [-0.17, 0.28, -0.12]);
  b.cyl(0.085, 0.085, 0.02, 10, L.primary, [-0.17, 0.2, -0.12]);
  b.tube([-0.17, 0.32, -0.12], [-0.05, 0.38, -0.2], 0.014, 5, mat.metal);
  b.tube([-0.05, 0.38, -0.2], [-0.05, 0.0, -0.2], 0.014, 5, mat.metal);
  // Gluehende Kokille / glowing ladle
  b.cyl(0.04, 0.03, 0.04, 8, mat.dark, [-0.25, 0.02, 0.15]);
  b.cyl(0.035, 0.035, 0.006, 8, mat.orange, [-0.25, 0.041, 0.15]);
  b.add(geo.ico(0.012, 0), mat.yellow, { p: [-0.25, 0.05, 0.15] });
  chimney(b, 0.22, 0, -0.2, 0.42, 0.03, mat.concreteLight);
  chimney(b, 0.12, 0, -0.24, 0.36, 0.025, mat.concreteLight, false);
  b.add(geo.cone(0.07, 0.06, 6), mat.rockDark, { p: [-0.05, 0.03, 0.25] });
}

function logisticsCenter(b: Builder, f: FactionId | null) {
  const L = look(f);
  hall(b, f, -0.12, -0.14, 0.3, 0.2, 0.13);
  const tones = [L.primary, L.secondary, mat.neutral, L.primaryDark];
  container(b, 0.18, 0, 0.1, tones[0], HALF_PI);
  container(b, 0.25, 0, 0.1, tones[1], HALF_PI);
  container(b, 0.215, 0.06, 0.1, tones[2], HALF_PI);
  container(b, -0.05, 0, 0.24, tones[3]);
  container(b, -0.22, 0, 0.24, tones[1]);
  // Portalkran / gantry crane
  for (const x of [0.1, 0.33]) b.block(x, 0, 0.1, 0.014, 0.2, 0.014, mat.yellow);
  for (const x of [0.1, 0.33]) b.block(x, 0, -0.06, 0.014, 0.2, 0.014, mat.yellow);
  b.block(0.215, 0.2, 0.1, 0.25, 0.02, 0.02, mat.yellow);
  b.block(0.215, 0.2, -0.06, 0.25, 0.02, 0.02, mat.yellow);
  b.block(0.2, 0.17, 0.02, 0.05, 0.03, 0.18, L.primaryDark);
  // Lkw / truck
  b.group({ p: [0.12, 0, -0.22], r: [0, HALF_PI, 0] }, () => {
    b.block(0, 0.02, 0.06, 0.07, 0.06, 0.05, L.primary);
    b.block(0, 0.05, 0.075, 0.072, 0.02, 0.02, mat.glass);
    b.block(0, 0.02, -0.04, 0.07, 0.065, 0.14, L.secondary);
    for (const z of [-0.08, 0.0, 0.06]) for (const s of [-1, 1]) b.cyl(0.018, 0.018, 0.014, 6, mat.dark, [s * 0.035, 0.018, z], [0, 0, HALF_PI]);
  });
  flagPole(b, f, -0.3, 0, 0.0, 0.28, 0.7);
}

function navalBase(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Betonkai / concrete quay
  b.block(-0.1, -0.03, -0.12, 0.6, 0.075, 0.18, mat.concreteLight);
  b.block(0.12, -0.03, 0.12, 0.12, 0.075, 0.32, mat.concreteLight);
  b.block(-0.1, 0.045, -0.035, 0.6, 0.01, 0.012, mat.yellow);
  for (const x of [-0.3, -0.1, 0.1]) b.cyl(0.012, 0.014, 0.025, 6, mat.dark, [x, 0.058, -0.04]);
  // Hafenbuero / harbour office
  b.group({ p: [-0.22, 0.045, -0.15] }, () => {
    b.block(0, 0, 0, 0.14, 0.12, 0.1, L.wall);
    band(b, 0, 0.07, 0, 0.14, 0.1, 0.02, mat.window);
    b.block(0, 0.12, 0, 0.15, 0.014, 0.11, L.roof);
    b.block(0.03, 0.134, 0, 0.05, 0.05, 0.05, L.wall);
    b.block(0.03, 0.184, 0, 0.06, 0.012, 0.06, L.roof);
  });
  // Hafenkran / harbour crane
  b.group({ p: [0.0, 0.045, -0.16] }, () => {
    b.block(0, 0, 0, 0.05, 0.22, 0.05, L.primary);
    b.block(0, 0.22, 0, 0.07, 0.05, 0.07, L.primaryDark);
    b.group({ p: [0, 0.255, 0], r: [0, -0.5, -0.35] }, () => b.box(0.3, 0.02, 0.02, L.secondary, [0.12, 0, 0]));
    b.tube([0.23, 0.33, 0.13], [0.23, 0.12, 0.13], 0.002, 3, mat.dark);
  });
  flagPole(b, f, -0.36, 0.045, -0.2, 0.28, 0.7);
  // Patrouillenboot / patrol boat
  b.group({ p: [-0.12, 0, 0.17], r: [0, HALF_PI, 0] }, () => {
    b.add(geo.prismXZ([[-0.04, -0.12], [0.04, -0.12], [0.045, 0.06], [0, 0.14], [-0.045, 0.06]], 0.045), L.primary, { p: [0, -0.015, 0] });
    b.block(0, 0.03, -0.02, 0.06, 0.04, 0.08, mat.concreteLight);
    b.block(0, 0.055, -0.0, 0.062, 0.012, 0.04, mat.window);
  });
}

function road(b: Builder) {
  // Gerades Strassenstueck entlang z ueber die ganze Kachel / straight road piece along z across the tile
  b.block(0, 0, 0, 0.3, 0.014, 1.0, mat.asphalt);
  for (const s of [-1, 1]) b.block(s * 0.155, 0, 0, 0.018, 0.018, 1.0, mat.concrete);
  for (let i = 0; i < 4; i++) b.block(0, 0.014, -0.375 + i * 0.25, 0.022, 0.003, 0.12, mat.yellow);
}

function bridge(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Stahlbruecke entlang z / steel bridge along z
  const y = 0.1;
  b.block(0, y, 0, 0.3, 0.025, 1.0, mat.concrete);
  b.block(0, y + 0.025, 0, 0.26, 0.004, 1.0, mat.asphalt);
  for (const s of [-1, 1]) {
    const x = s * 0.155;
    b.block(x, y + 0.025, 0, 0.012, 0.012, 1.0, L.primary);
    b.block(x, y + 0.13, 0, 0.014, 0.014, 0.8, L.primary);
    for (let i = 0; i <= 4; i++) {
      const z = -0.4 + i * 0.2;
      b.block(x, y + 0.025, z, 0.012, 0.11, 0.012, L.primary);
      if (i < 4) b.tube([x, y + 0.03, z], [x, y + 0.135, z + 0.2], 0.005, 4, L.primaryDark);
    }
  }
  for (let i = 0; i <= 4; i++) b.block(0, y + 0.137, -0.4 + i * 0.2, 0.31, 0.01, 0.012, L.primaryDark);
  // Pfeiler / piers
  for (const z of [-0.25, 0.25]) {
    b.block(0, -0.03, z, 0.2, y + 0.03, 0.06, mat.concreteLight);
    b.block(0, -0.03, z, 0.22, 0.02, 0.08, mat.concreteDark);
  }
  for (const z of [-0.47, 0.47]) b.block(0, 0, z, 0.32, y, 0.06, mat.concrete);
}

function researchCenter(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Laborgebaeude / laboratory
  b.block(-0.05, 0, 0.08, 0.36, 0.14, 0.2, mat.white);
  band(b, -0.05, 0.05, 0.08, 0.36, 0.2, 0.025, mat.glassDark);
  band(b, -0.05, 0.1, 0.08, 0.36, 0.2, 0.012, L.primary);
  b.block(-0.05, 0.14, 0.08, 0.37, 0.014, 0.21, L.roof);
  // Kuppel-Observatorium / dome observatory
  b.cyl(0.08, 0.08, 0.06, 10, mat.concreteLight, [-0.15, 0.184, 0.08]);
  b.add(geo.hemi(0.08, 10, 3), mat.white, { p: [-0.15, 0.214, 0.08] });
  b.box(0.02, 0.06, 0.13, mat.dark, [-0.15, 0.25, 0.08], [0, 0, 0.6]);
  // Schuessel + Antenne / dish + antenna
  dish(b, 0.2, 0, -0.2, 0.11, 0.5, mat.white, Math.PI / 4);
  b.tube([-0.25, 0, -0.25], [-0.25, 0.4, -0.25], 0.008, 4, mat.metal);
  b.add(geo.ico(0.015, 0), mat.red, { p: [-0.25, 0.41, -0.25] });
  if (f) addEmblem(b, f, 0.04, 0.006, L.primary, { p: [0.08, 0.075, 0.185] });
}

function outpost(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Sandsackring / sandbag ring
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (i === 3) continue;
    const r = 0.3;
    sandbag(b, Math.cos(a) * r, 0, Math.sin(a) * r, -a + HALF_PI, 1.1);
    if (i % 2 === 0) sandbag(b, Math.cos(a + 0.25) * r, 0.048, Math.sin(a + 0.25) * r, -a - 0.25 + HALF_PI, 1.05);
  }
  // Wachturm / watchtower
  b.group({ p: [-0.05, 0, -0.05] }, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([sx * 0.07, 0, sz * 0.07], [sx * 0.05, 0.24, sz * 0.05], 0.008, 4, mat.wood);
    b.tube([-0.07, 0.08, 0.07], [0.07, 0.16, 0.07], 0.005, 4, mat.woodLight);
    b.block(0, 0.24, 0, 0.15, 0.015, 0.15, mat.woodLight);
    for (const [x, z, w, d] of [[0, 0.07, 0.15, 0.01], [0, -0.07, 0.15, 0.01], [0.07, 0, 0.01, 0.15], [-0.07, 0, 0.01, 0.15]] as [number, number, number, number][]) {
      b.block(x, 0.255, z, w, 0.05, d, f ? L.primary : mat.sandbag);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(sx * 0.065, 0.255, sz * 0.065, 0.01, 0.1, 0.01, mat.wood);
    b.add(geo.cone(0.13, 0.07, 4).rotateY(Math.PI / 4), f ? L.roof : mat.wood, { p: [0, 0.39, 0] });
  });
  flagPole(b, f, 0.15, 0, -0.18, 0.4, 0.85);
  crate(b, 0.12, 0, 0.12, 0.06, mat.woodLight);
}

// ---------- Grossprojekte / grand projects ----------

function plinth(b: Builder, w: number, h: number) {
  b.block(0, 0, 0, w, h * 0.5, w, mat.concreteLight);
  b.block(0, h * 0.5, 0, w * 0.8, h * 0.5, w * 0.8, mat.concrete);
}

function grandProject(b: Builder, kind: GrandProjectId, f: FactionId | null) {
  const L = look(f);
  switch (kind) {
    case 'peaceMonument': {
      // Friedensdenkmal: offener Ring auf Sockel mit zwei Bogen / open ring on plinth with arches
      plinth(b, 0.6, 0.06);
      b.add(geo.torus(0.17, 0.03, 6, 16), mat.white, { p: [0, 0.26, 0] });
      b.add(geo.torus(0.17, 0.016, 4, 16), L.secondary, { p: [0, 0.26, 0], r: [0, HALF_PI, 0] });
      b.cyl(0.04, 0.05, 0.05, 8, mat.concrete, [0, 0.085, 0]);
      for (const a of [0, Math.PI]) {
        b.group({ r: [0, a, 0] }, () => {
          b.add(geo.cone(0.05, 0.14, 4), mat.leaf, { p: [0.12, 0.06 + 0.07 + 0.03, 0.2], r: [0, 0, -0.5] });
          b.add(geo.cone(0.04, 0.12, 4), mat.leafDark, { p: [0.16, 0.12, 0.2], r: [0, 0, -0.9] });
        });
      }
      b.cyl(0.18, 0.2, 0.015, 12, L.primary, [0, 0.067, 0]);
      break;
    }
    case 'stateBank': {
      // Staatsbank: Saeulenhalle mit Giebel und Goldstapel / colonnade with pediment and gold stacks
      b.block(0, 0, 0, 0.62, 0.04, 0.48, mat.concreteLight);
      b.block(0, 0.04, -0.05, 0.54, 0.2, 0.3, mat.paper);
      for (let i = 0; i < 6; i++) b.cyl(0.022, 0.025, 0.2, 8, mat.white, [-0.23 + i * 0.092, 0.14, 0.15]);
      b.block(0, 0.24, 0.0, 0.58, 0.03, 0.42, mat.concreteLight);
      b.add(geo.profileXY([[-0.3, 0], [0.3, 0], [0, 0.1]], 0.42), L.roof, { p: [0, 0.27, 0.0] });
      b.add(geo.profileXY([[-0.22, 0.015], [0.22, 0.015], [0, 0.07]], 0.01), L.secondary, { p: [0, 0.27, 0.212] });
      for (let i = 0; i < 4; i++) b.cyl(0.03, 0.03, 0.012, 10, mat.gold, [0.25, 0.046 + i * 0.013, 0.21]);
      for (let i = 0; i < 3; i++) b.cyl(0.03, 0.03, 0.012, 10, mat.gold, [-0.25, 0.046 + i * 0.013, 0.21]);
      break;
    }
    case 'victoryColumn': {
      // Siegessaeule: Saeule mit vergoldetem Lorbeerring und Kugel / column with gilded laurel ring and orb
      plinth(b, 0.42, 0.1);
      b.cyl(0.07, 0.085, 0.06, 10, mat.concreteLight, [0, 0.13, 0]);
      b.cyl(0.05, 0.06, 0.4, 10, mat.white, [0, 0.36, 0]);
      for (let i = 0; i < 5; i++) b.box(0.012, 0.36, 0.012, mat.concreteLight, [Math.cos(i * 1.2566) * 0.052, 0.36, Math.sin(i * 1.2566) * 0.052]);
      b.cyl(0.066, 0.066, 0.03, 10, L.primary, [0, 0.54, 0]);
      b.cyl(0.075, 0.06, 0.03, 10, mat.concreteLight, [0, 0.575, 0]);
      b.add(geo.torus(0.05, 0.014, 4, 12), mat.gold, { p: [0, 0.63, 0], r: [HALF_PI, 0, 0] });
      b.add(geo.ico(0.04, 1), mat.gold, { p: [0, 0.63, 0] });
      for (const a of [0, HALF_PI, Math.PI, -HALF_PI]) b.add(geo.dodeca(0.03), mat.leafDark, { p: [Math.sin(a) * 0.17, 0.1, Math.cos(a) * 0.17] });
      break;
    }
    case 'worldTradeCenter': {
      // Welthandelszentrum: drei gestaffelte Glastuerme um einen Globus / three staggered glass towers around a globe
      b.block(0, 0, 0, 0.7, 0.03, 0.7, mat.concreteLight);
      const towers: [number, number, number, number][] = [[-0.16, -0.12, 0.5, 0.16], [0.14, -0.16, 0.38, 0.14], [0.15, 0.13, 0.28, 0.13]];
      towers.forEach(([x, z, h, w], i) => {
        b.block(x, 0.03, z, w, h, w, mat.glassDark, i * 0.3);
        for (let k = 1; k < Math.floor(h / 0.06); k++) band(b, x, 0.03 + k * 0.06, z, w, w, 0.008, mat.glass, i * 0.3);
        b.block(x, 0.03 + h, z, w * 0.7, 0.03, w * 0.7, L.primary, i * 0.3);
      });
      b.add(geo.ico(0.08, 1), L.secondary, { p: [-0.15, 0.15, 0.17] });
      b.add(geo.torus(0.1, 0.008, 3, 14), mat.gold, { p: [-0.15, 0.15, 0.17], r: [1.1, 0.3, 0] });
      b.cyl(0.02, 0.03, 0.07, 6, mat.concrete, [-0.15, 0.065, 0.17]);
      break;
    }
    case 'governmentPalace': {
      // Regierungspalast: Fluegel, Mittelbau mit Kuppel und Turm / wings, central block with dome and tower
      b.block(0, 0, 0, 0.72, 0.03, 0.5, mat.concreteLight);
      for (const s of [-1, 1]) {
        b.block(s * 0.22, 0.03, -0.04, 0.2, 0.16, 0.3, L.wall);
        band(b, s * 0.22, 0.1, -0.04, 0.2, 0.3, 0.02, mat.window);
        gableRoof(b, s * 0.22, 0.19, -0.04, 0.22, 0.32, 0.06, L.roof, HALF_PI);
      }
      b.block(0, 0.03, -0.02, 0.24, 0.22, 0.34, mat.paper);
      for (let i = 0; i < 4; i++) b.cyl(0.016, 0.018, 0.18, 6, mat.white, [-0.09 + i * 0.06, 0.12, 0.16]);
      b.cyl(0.1, 0.1, 0.06, 12, mat.paper, [0, 0.28, -0.02]);
      b.add(geo.hemi(0.1, 12, 4), L.primary, { p: [0, 0.31, -0.02] });
      b.cyl(0.015, 0.02, 0.08, 6, mat.gold, [0, 0.44, -0.02]);
      flagPole(b, f, 0.02, 0.48, -0.02, 0.16, 0.7);
      break;
    }
    case 'academy': {
      // Akademie: Hoersaalbau mit Uhrturm / lecture hall with clock tower
      b.block(0, 0, 0, 0.66, 0.03, 0.5, mat.concreteLight);
      b.block(0.06, 0.03, 0.0, 0.42, 0.17, 0.3, L.wall);
      for (let i = 0; i < 2; i++) band(b, 0.06, 0.07 + i * 0.07, 0.0, 0.42, 0.3, 0.02, mat.window);
      gableRoof(b, 0.06, 0.2, 0.0, 0.32, 0.44, 0.1, L.roof, HALF_PI);
      // Uhrturm / clock tower
      b.block(-0.22, 0.03, 0.0, 0.12, 0.42, 0.12, mat.paper);
      b.block(-0.22, 0.32, 0.0, 0.13, 0.016, 0.13, L.primary);
      for (const r of [0, HALF_PI, Math.PI, -HALF_PI]) {
        b.group({ p: [-0.22, 0.38, 0], r: [0, r, 0] }, () => {
          b.cyl(0.035, 0.035, 0.008, 10, mat.white, [0, 0, 0.062], [HALF_PI, 0, 0]);
          b.box(0.006, 0.026, 0.004, mat.ink, [0, 0.008, 0.068]);
          b.box(0.018, 0.006, 0.004, mat.ink, [0.006, 0, 0.068]);
        });
      }
      b.add(geo.cone(0.1, 0.14, 4).rotateY(Math.PI / 4), L.roof, { p: [-0.22, 0.52, 0] });
      // offenes Buch als Skulptur / open book sculpture
      b.group({ p: [0.22, 0.03, 0.22] }, () => {
        b.box(0.08, 0.01, 0.1, mat.white, [-0.038, 0.03, 0], [0, 0, 0.25]);
        b.box(0.08, 0.01, 0.1, mat.white, [0.038, 0.03, 0], [0, 0, -0.25]);
        b.block(0, 0, 0, 0.06, 0.02, 0.06, mat.concrete);
      });
      break;
    }
    case 'satelliteCenter': {
      // Satellitenzentrale: grosse Schuessel, Kontrollgebaeude, Antennenmast / big dish, control building, mast
      b.block(0, 0, 0, 0.7, 0.025, 0.7, mat.concreteLight);
      dish(b, -0.08, 0.025, -0.05, 0.22, 0.55, mat.white, Math.PI / 4);
      b.block(0.2, 0.025, 0.2, 0.2, 0.1, 0.14, mat.white);
      band(b, 0.2, 0.06, 0.2, 0.2, 0.14, 0.02, mat.glassDark);
      b.block(0.2, 0.125, 0.2, 0.21, 0.014, 0.15, L.roof);
      dish(b, 0.25, 0.025, -0.24, 0.06, 0.5, mat.white, 0.3);
      for (const s of [-1, 1]) b.tube([0.3 + s * 0.03, 0.025, 0.0], [0.3, 0.5, 0.0], 0.006, 4, mat.red);
      b.add(geo.ico(0.015, 0), mat.yellow, { p: [0.3, 0.51, 0.0] });
      break;
    }
  }
  if (kind !== 'governmentPalace') flagPole(b, f, -0.3, 0.03, 0.27, 0.28, 0.7);
}

export function building(kind: Kind, f: FactionId | null): Builder {
  const b = new Builder();
  switch (kind) {
    case 'storehouse': storehouse(b, f); break;
    case 'ranch': ranch(b, f); break;
    case 'fishery': fishery(b, f); break;
    case 'lumberCamp': lumberCamp(b, f); break;
    case 'farm': farm(b, f); break;
    case 'mine': mine(b, f); break;
    case 'materialsPlant': materialsPlant(b, f); break;
    case 'foodFactory': foodFactory(b, f); break;
    case 'steelMill': steelMill(b, f); break;
    case 'logisticsCenter': logisticsCenter(b, f); break;
    case 'navalBase': navalBase(b, f); break;
    case 'road': road(b); break;
    case 'bridge': bridge(b, f); break;
    case 'researchCenter': researchCenter(b, f); break;
    case 'outpost': outpost(b, f); break;
    default: grandProject(b, kind, f); break;
  }
  return b;
}

// ---------- Kartenobjekte / map features ----------

export function feature(kind: 'bunker' | 'radar'): Builder {
  const b = new Builder();
  if (kind === 'bunker') {
    // Betonbunker mit Schiessscharte / concrete pillbox with gun slit
    b.cyl(0.22, 0.26, 0.1, 6, mat.concrete, [0, 0.05, 0]);
    b.cyl(0.23, 0.23, 0.03, 6, mat.ink, [0, 0.065, 0]);
    b.cyl(0.16, 0.22, 0.06, 6, mat.concreteLight, [0, 0.13, 0]);
    b.box(0.16, 0.025, 0.06, mat.ink, [0, 0.07, 0.2]);
    b.cyl(0.006, 0.006, 0.14, 4, mat.dark, [0.08, 0.23, -0.05]);
    for (let i = 0; i < 7; i++) {
      const a = -0.6 + (i / 6) * 1.2 + Math.PI;
      sandbag(b, Math.sin(a) * 0.33, 0, Math.cos(a) * 0.33, a, 1);
    }
    b.add(geo.dodeca(0.04), mat.leafDark, { p: [-0.25, 0.03, 0.22] });
    b.add(geo.dodeca(0.035), mat.leaf, { p: [0.28, 0.025, 0.12] });
    crate(b, 0.27, 0, -0.24, 0.07, mat.yellow);
  } else {
    // Radarstation: Gitterturm, Radarschirm, Huette / lattice tower, radar screen, hut
    const h = 0.38;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([sx * 0.09, 0, sz * 0.09], [sx * 0.035, h, sz * 0.035], 0.008, 4, mat.metal);
    for (let i = 0; i < 3; i++) {
      const y0 = i * 0.12, y1 = y0 + 0.12;
      const r0 = 0.09 - (y0 / h) * 0.055, r1 = 0.09 - (y1 / h) * 0.055;
      for (const s of [-1, 1]) {
        b.tube([-r0, y0, s * r0], [r1, y1, s * r1], 0.004, 3, mat.metalLight);
        b.tube([s * r0, y0, -r0], [s * r1, y1, r1], 0.004, 3, mat.metalLight);
      }
    }
    b.block(0, h, 0, 0.1, 0.03, 0.1, mat.red);
    b.group({ p: [0, h + 0.05, 0], r: [0, 0.5, 0] }, () => {
      b.add(geo.profileXY([[-0.2, 0.0], [0.2, 0.0], [0.17, 0.08], [-0.17, 0.08]], 0.014), mat.white, { r: [-0.25, 0, 0] });
      b.cyl(0.012, 0.012, 0.05, 6, mat.dark, [0, -0.01, 0]);
    });
    b.block(0.24, 0, 0.18, 0.14, 0.09, 0.1, mat.concreteLight);
    b.block(0.24, 0.09, 0.18, 0.15, 0.012, 0.11, mat.red);
    b.block(0.24, 0.035, 0.231, 0.08, 0.025, 0.004, mat.window);
    for (const [x, z] of [[-0.25, 0.25], [-0.3, -0.2]] as [number, number][]) b.cyl(0.02, 0.02, 0.06, 6, mat.white, [x, 0.03, z]);
  }
  return b;
}

