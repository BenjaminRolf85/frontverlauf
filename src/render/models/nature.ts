/**
 * Gelaende-Dekoration, Ressourcen und Wolken / terrain decoration, resources and clouds.
 */
import type * as THREE from 'three';
import type { ResourceId, TerrainId } from '../../data/balance';
import { Builder, geo, memo, mix, rng, shade } from './kit';
import { mat } from './look';

const HALF_PI = Math.PI / 2;

function tree(b: Builder, x: number, z: number, s: number, R: () => number) {
  const ry = R() * 3;
  b.cyl(0.018 * s, 0.024 * s, 0.07 * s, 5, mat.wood, [x, 0.035 * s, z]);
  if (R() < 0.3) {
    // Laubbaum / broadleaf tree
    b.add(geo.dodeca(0.085 * s), mat.leaf, { p: [x, 0.13 * s, z], r: [0, ry, 0.3] });
    b.add(geo.dodeca(0.055 * s), shade(mat.leaf, 1.15), { p: [x + 0.03 * s, 0.19 * s, z - 0.02 * s], r: [0.4, ry, 0] });
  } else {
    // Nadelbaum in zwei Stufen / conifer in two tiers
    b.add(geo.cone(0.1 * s, 0.15 * s, 6), mat.leafDark, { p: [x, 0.12 * s, z], r: [0, ry, 0] });
    b.add(geo.cone(0.075 * s, 0.13 * s, 6), mat.leaf, { p: [x, 0.21 * s, z], r: [0, ry + 0.5, 0] });
  }
}

/** Rind (eigene Geometrie) / cow (own geometry) */
export function cattle(variant: number): THREE.BufferGeometry {
  const v = Math.abs(variant | 0) % 3;
  return memo(`cattle|${v}`, () => {
    const b = new Builder();
    const coat = v === 1 ? shade(mat.wood, 1.25) : mat.white;
    b.block(0, 0.04, 0, 0.07, 0.055, 0.12, coat);
    b.block(0, 0.06, 0.07, 0.045, 0.045, 0.045, coat);
    b.block(0, 0.06, 0.095, 0.04, 0.025, 0.012, mix(mat.skin, mat.red, 0.25));
    for (const s of [-1, 1]) b.box(0.03, 0.008, 0.008, mat.paper, [s * 0.03, 0.105, 0.075], [0, 0, s * 0.4]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(sx * 0.024, 0, sz * 0.045, 0.016, 0.04, 0.016, mat.dark);
    if (v !== 1) {
      b.block(0.02, 0.07, -0.02, 0.074, 0.03, 0.04, mat.ink);
      b.block(-0.015, 0.05, 0.03, 0.074, 0.03, 0.03, mat.ink);
    }
    b.box(0.008, 0.05, 0.008, coat, [0, 0.07, -0.065], [-0.4, 0, 0]);
    return b.build();
  });
}

function rocks(b: Builder, R: () => number, n: number, spread: number, size: number) {
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2;
    const r = R() * spread;
    const s = size * (0.6 + R() * 0.6);
    b.add(geo.dodeca(s), i % 2 ? mat.rock : mat.rockDark, { p: [Math.cos(a) * r, s * 0.45, Math.sin(a) * r], r: [R(), R() * 3, R()], s: [1, 0.7, 1] });
  }
}

function peak(b: Builder, x: number, z: number, r: number, h: number, snowK: number, R: () => number) {
  const ry = R() * 3;
  b.add(geo.cone(r, h, 6), R() < 0.5 ? mat.rock : shade(mat.rock, 0.92), { p: [x, h / 2, z], r: [0, ry, 0] });
  if (snowK > 0) b.add(geo.cone(r * snowK * 1.05, h * snowK * 1.05, 6), mat.snow, { p: [x, h - (h * snowK * 1.05) / 2 + 0.004, z], r: [0, ry, 0] });
}

function crystals(b: Builder, x: number, z: number, s: number, R: () => number) {
  for (let i = 0; i < 4; i++) {
    const tilt = (R() - 0.5) * 0.9;
    const h = (0.08 + R() * 0.08) * s;
    const c = i % 3 === 0 ? mat.gold : i % 3 === 1 ? mat.yellow : mix(mat.yellow, mat.white, 0.4);
    b.group({ p: [x + (R() - 0.5) * 0.06 * s, 0, z + (R() - 0.5) * 0.06 * s], r: [tilt, R() * 3, (R() - 0.5) * 0.9] }, () => {
      b.add(geo.cyl(0.02 * s, 0.025 * s, h, 5), c, { p: [0, h / 2, 0] });
      b.add(geo.cone(0.02 * s, 0.04 * s, 5), c, { p: [0, h + 0.02 * s, 0] });
    });
  }
}

function fish(b: Builder, x: number, z: number, ry: number, jump: number, c: THREE.Color) {
  // springender Fisch mit Wellenring / jumping fish with ripple ring
  b.add(geo.torus(0.07, 0.008, 3, 12), mat.white, { p: [x, 0.004, z], r: [HALF_PI, 0, 0], s: [1, 1, 0.5] });
  b.group({ p: [x, 0.05 + jump, z], r: [0, ry, jump > 0 ? 0.5 : -0.3] }, () => {
    b.add(geo.sphere(0.05, 8, 4), c, { s: [1.7, 0.85, 0.55] });
    b.add(geo.sphere(0.03, 6, 3), mat.white, { p: [0.01, -0.018, 0], s: [2, 0.6, 0.6] });
    b.add(geo.profileXY([[-0.075, 0], [-0.13, 0.045], [-0.12, 0], [-0.13, -0.045]], 0.012), mat.orange);
    b.add(geo.profileXY([[-0.02, 0.035], [0.03, 0.04], [0.0, 0.07]], 0.008), mat.orange);
    b.box(0.012, 0.012, 0.03, mat.ink, [0.06, 0.012, 0]);
  });
}

function buoy(b: Builder, x: number, z: number) {
  b.cyl(0.035, 0.05, 0.07, 8, mat.red, [x, 0.01, z]);
  b.cyl(0.037, 0.037, 0.02, 8, mat.white, [x, 0.04, z]);
  b.cyl(0.006, 0.006, 0.09, 4, mat.dark, [x, 0.09, z]);
  b.add(geo.ico(0.018, 0), mat.yellow, { p: [x, 0.14, z] });
}

function resourceProps(b: Builder, res: ResourceId, R: () => number, v: number) {
  switch (res) {
    case 'farmland': {
      // Getreidereihen + Heuballen / crop rows + hay bale
      for (let i = 0; i < 6; i++) {
        const z = -0.3 + i * 0.12;
        b.block(0, 0, z, 0.66, 0.012, 0.09, shade(mat.wood, 1.1));
        b.block(0, 0.01, z, 0.62, 0.045 + (i % 2) * 0.01, 0.06, i % 3 === 2 ? mat.green : mat.yellow);
      }
      b.cyl(0.05, 0.05, 0.07, 8, mat.gold, [0.28 - v * 0.05, 0.075, 0.33], [0, 0, HALF_PI]);
      break;
    }
    case 'livestock': {
      const n = 2 + (v % 2);
      for (let i = 0; i < n; i++) b.addColored(cattle(i + v), { p: [(R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5], r: [0, R() * 6, 0] });
      for (let i = 0; i < 4; i++) {
        b.cyl(0.008, 0.008, 0.07, 4, mat.wood, [-0.35 + i * 0.12, 0.035, -0.33]);
        if (i < 3) b.box(0.12, 0.01, 0.01, mat.woodLight, [-0.29 + i * 0.12, 0.05, -0.33]);
      }
      break;
    }
    case 'supplies': {
      // Kisten, Faesser, Plane / crates, barrels, tarp
      const ox = (R() - 0.5) * 0.2;
      for (const [x, y, z, s] of [[0, 0, 0, 0.1], [0.11, 0, 0.02, 0.09], [0.05, 0.1, 0.0, 0.08], [-0.02, 0, 0.12, 0.08]] as [number, number, number, number][]) {
        b.block(ox + x, y, z, s, s, s, mat.woodLight, R() * 0.4);
        b.block(ox + x, y + s * 0.42, z, s + 0.006, s * 0.16, s + 0.006, mat.wood, 0);
      }
      b.cyl(0.035, 0.035, 0.09, 8, mat.green, [ox - 0.14, 0.045, -0.06]);
      b.cyl(0.035, 0.035, 0.09, 8, mat.orange, [ox - 0.12, 0.045, 0.04]);
      b.add(geo.taper(0.14, 0.12, 0.06, 0.12, 0.05), mix(mat.leafDark, mat.sand, 0.4), { p: [ox + 0.12, 0.025, -0.16] });
      break;
    }
    case 'ore': {
      rocks(b, R, 3, 0.25, 0.06);
      crystals(b, -0.1, 0.05, 1.2, R);
      crystals(b, 0.15, -0.1, 0.9, R);
      break;
    }
    case 'fish': {
      fish(b, -0.14, 0.06 + v * 0.02, 0.5 + v, 0.07, mix(mat.teal, mat.white, 0.2));
      fish(b, 0.16, -0.14, 2.4 - v, 0.0, mat.metalLight);
      if (v % 2 === 0) fish(b, 0.08, 0.24, -1.0, 0.03, mix(mat.teal, mat.white, 0.2));
      buoy(b, 0.3 - v * 0.03, 0.28);
      buoy(b, -0.3, -0.26 + v * 0.03);
      break;
    }
  }
}

/** Dekoration einer Kachel / decoration of a tile */
export function decoration(terrain: TerrainId, res: ResourceId | null, variant: number): Builder | null {
  const v = ((variant % 4) + 4) % 4;
  const R = rng(1000 + v * 97 + terrain.length * 13 + (res ? res.length * 7 : 0));
  const b = new Builder();
  switch (terrain) {
    case 'forest': {
      const spots: [number, number][] = res
        ? [[-0.28, -0.26], [0.3, -0.24], [-0.3, 0.28]]
        : [[-0.2, -0.2], [0.18, -0.24], [0.0, 0.05], [-0.25, 0.22], [0.24, 0.2], [0.05, 0.32]];
      const n = res ? 3 : 4 + (v % 3);
      for (let i = 0; i < n; i++) {
        const [x, z] = spots[(i + v) % spots.length];
        tree(b, x + (R() - 0.5) * 0.08, z + (R() - 0.5) * 0.08, 0.95 + R() * 0.45, R);
      }
      if (res) resourceProps(b, res, R, v);
      break;
    }
    case 'mountain': {
      if (res === 'ore') {
        peak(b, -0.15, -0.15, 0.22, 0.38, 0.32, R);
        resourceProps(b, 'ore', R, v);
      } else {
        peak(b, -0.05 + (R() - 0.5) * 0.1, -0.05, 0.3, 0.5 + R() * 0.12, 0.38, R);
        if (v % 2 === 0) peak(b, 0.2, 0.18, 0.18, 0.28, 0.0, R);
        else peak(b, -0.22, 0.22, 0.16, 0.24, 0.0, R);
        rocks(b, R, 2, 0.35, 0.05);
        if (res) resourceProps(b, res, R, v);
      }
      break;
    }
    case 'plain':
      if (!res) return null;
      resourceProps(b, res, R, v);
      break;
    case 'shallow':
    case 'ocean':
      if (res !== 'fish') return null;
      resourceProps(b, 'fish', R, v);
      break;
  }
  return b;
}

/** Wolke fuer den Kriegsnebel / fog-of-war cloud */
export function cloud(variant: number): Builder {
  const v = ((variant % 4) + 4) % 4;
  const R = rng(500 + v * 31);
  const b = new Builder();
  // Unterer Ring (schattig) + obere Bauschen (hell) / lower ring (shaded) + upper puffs (bright)
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + v * 0.4;
    const r = 0.3 + R() * 0.06;
    const s = 0.2 + R() * 0.05;
    b.add(geo.ico(s, 1), mat.cloudShade, { p: [Math.cos(a) * r, s * 0.75, Math.sin(a) * r], s: [1, 0.8, 1] });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + R() * 0.8;
    const r = 0.14 + R() * 0.06;
    const s = 0.2 + R() * 0.06;
    b.add(geo.ico(s, 1), mat.cloud, { p: [Math.cos(a) * r, 0.24 + R() * 0.06, Math.sin(a) * r], s: [1, 0.85, 1] });
  }
  b.add(geo.ico(0.24, 1), mat.cloud, { p: [0, 0.32, 0], s: [1, 0.85, 1] });
  return b;
}
