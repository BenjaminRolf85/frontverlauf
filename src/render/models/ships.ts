/**
 * Schiffe: Landungsboot, U-Boot, Zerstoerer, Kriegsschiff. Wasserlinie bei y=0, Bug in +z.
 * Ships: landing boat, submarine, destroyer, battleship. Waterline at y=0, bow towards +z.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, shade } from './kit';
import { look, mat, type Look } from './look';

const HALF_PI = Math.PI / 2;

/** Rumpf mit spitzem Bug / hull with pointed bow */
function hull(b: Builder, L: Look, len: number, beam: number, top: number, bow: number, deck: THREE.Color) {
  const h = len / 2;
  const w = beam / 2;
  const outline = (s: number): [number, number][] => [
    [-w * s * 0.85, -h * s], [w * s * 0.85, -h * s], [w * s, -h * s + 0.04], [w * s, h * s - bow],
    [w * s * 0.6, h * s - bow * 0.35], [0, h * s], [-w * s * 0.6, h * s - bow * 0.35], [-w * s, h * s - bow], [-w * s, -h * s + 0.04],
  ];
  // Unterwasser + Wasserpass + Bordwand / underwater + boot-topping + side
  b.add(geo.prismXZ(outline(0.94), 0.03), L.hullDark, { p: [0, -0.03, 0] });
  b.add(geo.prismXZ(outline(0.97), 0.016), mat.ink, { p: [0, 0.0, 0] });
  b.add(geo.prismXZ(outline(1), top - 0.016), L.hull, { p: [0, 0.016, 0] });
  b.add(geo.prismXZ(outline(0.9), 0.008), deck, { p: [0, top, 0] });
}

/** Aufbau-Block im Fraktionsstil / superstructure block in faction style */
function superBlock(b: Builder, f: FactionId, L: Look, x: number, y: number, z: number, w: number, h: number, d: number) {
  const base = f === 'alvenia' || f === 'korvat' ? mat.concreteLight : f === 'meridon' ? mat.paper : f === 'dravon' ? shade(L.primary, 1.35) : shade(L.primary, 1.15);
  switch (f) {
    case 'korvat':
      b.block(x, y, z, w, h, d, base);
      b.block(x, y + h * 0.62, z, w + 0.006, h * 0.16, d + 0.006, mat.window);
      break;
    case 'dravon':
      b.add(geo.taper(w, d, w * 0.7, d * 0.6, h, -d * 0.12), base, { p: [x, y + h / 2, z] });
      b.add(geo.taper(w * 0.88, d * 0.8, w * 0.84, d * 0.74, h * 0.14, -d * 0.1), L.secondary, { p: [x, y + h * 0.7, z] });
      break;
    case 'alvenia':
      b.add(geo.cyl(0.5, 0.5, h, 12), base, { p: [x, y + h / 2, z], s: [w, 1, d] });
      b.add(geo.cyl(0.5, 0.5, h * 0.16, 12), mat.window, { p: [x, y + h * 0.7, z], s: [w + 0.006, 1, d + 0.006] });
      break;
    case 'meridon':
      b.block(x, y, z, w, h, d, base);
      b.block(x, y + h * 0.62, z, w + 0.006, h * 0.16, d + 0.006, mat.window);
      break;
    case 'velkar':
      b.add(geo.taper(w, d, w * 0.72, d * 0.72, h), base, { p: [x, y + h / 2, z] });
      b.add(geo.taper(w * 0.86, d * 0.86, w * 0.82, d * 0.82, h * 0.13), L.secondary, { p: [x, y + h * 0.65, z] });
      break;
  }
}

/** Geschuetzturm / gun turret; dir 1 = nach vorn, -1 = nach hinten */
function turret(b: Builder, f: FactionId, L: Look, z: number, y: number, size: number, barrels: number, dir: 1 | -1) {
  const big = f === 'dravon' ? 1.45 : 1;
  b.group({ p: [0, y, z], r: [0, dir === 1 ? 0 : Math.PI, 0] }, () => {
    if (f === 'alvenia') {
      b.cyl(size * 0.5, size * 0.55, size * 0.38, 10, L.hull, [0, size * 0.19, 0]);
      b.add(geo.sphere(size * 0.5, 10, 3), L.hull, { p: [0, size * 0.38, 0], s: [1, 0.3, 1] });
    } else if (f === 'dravon') {
      b.add(geo.prismXZ([[-size * 0.55, -size * 0.45], [size * 0.55, -size * 0.45], [size * 0.5, size * 0.25], [0, size * 0.55], [-size * 0.5, size * 0.25]], size * 0.38), L.hull, {});
      b.add(geo.prismXZ([[-size * 0.56, -size * 0.46], [size * 0.56, -size * 0.46], [size * 0.51, size * 0.26], [-size * 0.51, size * 0.26]], size * 0.08), L.trim, { p: [0, size * 0.18, 0] });
    } else if (f === 'velkar') {
      b.add(geo.taper(size * 1.0, size * 0.95, size * 0.7, size * 0.6, size * 0.34, -size * 0.06), L.hull, { p: [0, size * 0.17, 0] });
    } else {
      b.add(geo.taper(size * 0.95, size * 0.9, size * 0.85, size * 0.75, size * 0.36), L.hull, { p: [0, size * 0.18, 0] });
      if (f === 'meridon') b.block(0, size * 0.36, -size * 0.2, size * 0.5, size * 0.1, size * 0.3, L.trim);
    }
    const len = size * 1.1 * big;
    for (let i = 0; i < barrels; i++) {
      const x = barrels === 1 ? 0 : (i - (barrels - 1) / 2) * size * 0.32;
      b.cyl(size * 0.07 * big, size * 0.08 * big, len, 6, mat.dark, [x, size * 0.2, size * 0.35 + len / 2], [HALF_PI - 0.06, 0, 0]);
    }
  });
}

function mast(b: Builder, L: Look, f: FactionId, z: number, y: number, h: number) {
  b.cyl(0.008, 0.012, h, 5, mat.dark, [0, y + h / 2, z]);
  b.box(0.12, 0.008, 0.008, mat.dark, [0, y + h * 0.75, z]);
  if (f === 'velkar' || f === 'alvenia') b.add(geo.sphere(0.03, 8, 4), mat.white, { p: [0, y + h * 0.55, z] });
  if (f === 'velkar') b.add(geo.ico(0.01, 0), L.secondary, { p: [0, y + h + 0.01, z] });
  // Wimpel in Fraktionsfarbe / pennant in faction colour
  b.add(geo.profileZY([[0, 0], [-0.07, -0.015], [0, -0.03]], 0.004), L.trim, { p: [0, y + h, z - 0.004] });
}

function funnel(b: Builder, f: FactionId, L: Look, z: number, y: number, h: number, r: number) {
  if (f === 'alvenia') b.cyl(r, r * 1.1, h, 10, L.hull, [0, y + h / 2, z], [-0.15, 0, 0]);
  else if (f === 'velkar') b.add(geo.taper(r * 2, r * 2.4, r * 1.4, r * 1.6, h), L.hull, { p: [0, y + h / 2, z] });
  else if (f === 'dravon') b.add(geo.taper(r * 2, r * 2.6, r * 1.6, r * 1.6, h, -r * 0.6), L.hull, { p: [0, y + h / 2, z] });
  else b.block(0, y, z, r * 2, h, r * 2.4, L.hull);
  b.block(0, y + h - 0.02, z + (f === 'dravon' ? -r * 0.6 : 0), r * 2.1, 0.02, r * 2.5, L.trim);
  b.block(0, y + h, z + (f === 'dravon' ? -r * 0.6 : 0), r * 1.5, 0.004, r * 1.8, mat.ink);
}

/** Container-Stapel (Meridon) / container stack */
function containers(b: Builder, L: Look, z: number, y: number) {
  const tones = [L.trim, L.primary, shade(L.trim, 0.8)];
  [[-0.045, 0], [0.045, 0], [0, 1]].forEach(([x, lvl], i) => {
    b.block(x, y + lvl * 0.04, z, 0.085, 0.04, 0.1, tones[i % 3]);
    for (const dz of [-0.03, 0, 0.03]) b.block(x, y + lvl * 0.04 + 0.002, z + dz, 0.089, 0.036, 0.006, shade(tones[i % 3], 0.75));
  });
}

export function landingBoat(f: FactionId, carried: THREE.BufferGeometry | null): Builder {
  const b = new Builder();
  const L = look(f);
  const len = 0.62, w = 0.3, top = 0.07;
  // flacher Kasten-Rumpf / flat box hull
  b.block(0, -0.03, 0, w - 0.02, 0.03, len - 0.02, L.hullDark);
  b.block(0, 0.0, 0, w, 0.014, len, mat.ink);
  b.block(0, 0.014, -0.02, w - 0.02, 0.012, len - 0.06, mat.woodLight);
  for (const s of [-1, 1]) b.block(s * (w / 2 - 0.015), 0.014, -0.01, 0.03, top - 0.014, len - 0.02, L.hull);
  b.block(0, 0.014, -len / 2 + 0.03, w, top - 0.014 + 0.015, 0.06, L.hull);
  // Bugrampe / bow ramp
  b.box(w - 0.02, 0.1, 0.018, L.hullDark, [0, 0.06, len / 2 - 0.03], [-0.2, 0, 0]);
  for (const y of [0.04, 0.07]) b.box(w - 0.04, 0.008, 0.012, L.trim, [0, y, len / 2 - 0.02 + (y - 0.06) * 0.2], [-0.2, 0, 0]);
  // Steuerstand / helm station
  b.block(0.08, top, -len / 2 + 0.05, 0.1, 0.08, 0.07, L.hull);
  b.block(0.08, top + 0.045, -len / 2 + 0.05, 0.104, 0.02, 0.074, mat.window);
  b.block(0.08, top + 0.08, -len / 2 + 0.05, 0.11, 0.01, 0.08, L.trim);
  b.cyl(0.004, 0.004, 0.12, 4, mat.dark, [0.11, top + 0.14, -len / 2 + 0.04]);
  b.add(geo.profileZY([[0, 0], [-0.06, -0.012], [0, -0.024]], 0.004), L.trim, { p: [0.11, top + 0.2, -len / 2 + 0.036] });
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [-w / 2 - 0.003, 0.045, -0.12], r: [0, -HALF_PI, 0] });
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [w / 2 + 0.003, 0.045, -0.12], r: [0, HALF_PI, 0] });
  // Ladung: kleine getragene Einheit / cargo: tiny carried unit marker
  if (carried) b.addColored(carried, { p: [-0.02, 0.026, 0.04], s: 0.5 });
  else b.block(0, 0.026, 0.04, 0.08, 0.05, 0.08, L.gear);
  return b;
}

export function submarine(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  // Rumpf als gestreckter Koerper / hull as stretched body
  b.add(geo.sphere(0.1, 12, 6), L.hullDark, { p: [0, 0.0, 0], s: [0.85, 0.6, 4.1] });
  b.add(geo.sphere(0.1, 12, 4), L.hull, { p: [0, 0.012, 0], s: [0.75, 0.42, 3.8] });
  b.box(0.02, 0.008, 0.5, L.trim, [0, 0.055, 0]);
  // Turm / sail
  const sz = 0.06;
  switch (f) {
    case 'korvat':
      b.block(0, 0.03, sz, 0.07, 0.12, 0.14, L.hull);
      b.block(0, 0.12, sz, 0.074, 0.016, 0.144, L.trim);
      break;
    case 'dravon':
      b.add(geo.profileZY([[-0.08, 0], [0.09, 0], [0.04, 0.15], [-0.07, 0.15]], 0.07), L.hull, { p: [0, 0.03, sz] });
      b.add(geo.profileZY([[-0.075, 0.1], [0.06, 0.1], [0.05, 0.12], [-0.073, 0.12]], 0.074), L.trim, { p: [0, 0.03, sz] });
      break;
    case 'alvenia':
      b.add(geo.cyl(0.5, 0.5, 0.12, 12), L.hull, { p: [0, 0.09, sz], s: [0.07, 1, 0.15] });
      b.add(geo.cyl(0.5, 0.5, 0.016, 12), L.trim, { p: [0, 0.13, sz], s: [0.075, 1, 0.155] });
      break;
    case 'meridon':
      b.block(0, 0.03, sz, 0.065, 0.11, 0.13, L.hull);
      b.block(0, 0.05, -0.12, 0.09, 0.035, 0.12, L.trim);
      for (const z of [-0.16, -0.12, -0.08]) b.block(0, 0.051, z, 0.094, 0.036, 0.008, shade(L.trim, 0.78));
      break;
    case 'velkar':
      b.add(geo.taper(0.08, 0.16, 0.04, 0.1, 0.12, -0.01), L.hull, { p: [0, 0.09, sz] });
      b.box(0.042, 0.012, 0.06, L.secondary, [0, 0.12, sz - 0.01]);
      break;
  }
  b.box(0.16, 0.008, 0.035, L.hullDark, [0, 0.11, sz + 0.03]);
  b.cyl(0.006, 0.006, 0.09, 4, mat.dark, [0, 0.19, sz + 0.02]);
  b.box(0.006, 0.006, 0.025, mat.dark, [0, 0.235, sz + 0.03]);
  b.cyl(0.004, 0.004, 0.06, 4, mat.dark, [0.015, 0.18, sz - 0.03]);
  // Heckruder / stern rudders
  b.box(0.008, 0.11, 0.05, L.hullDark, [0, 0.0, -0.4]);
  b.box(0.13, 0.008, 0.05, L.hullDark, [0, 0.0, -0.4]);
  addEmblem(b, f, 0.03, 0.006, L.emblem, { p: [0.04, 0.09, sz], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.03, 0.006, L.emblem, { p: [-0.04, 0.09, sz], r: [0, -HALF_PI, 0] });
  return b;
}

export function destroyer(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  const top = 0.06;
  hull(b, L, 0.84, 0.2, top, 0.22, mat.metalLight);
  const d = top + 0.008;
  superBlock(b, f, L, 0, d, 0.06, 0.13, 0.07, 0.16);
  superBlock(b, f, L, 0, d + 0.07, 0.08, 0.1, 0.055, 0.08);
  mast(b, L, f, 0.06, d + 0.125, 0.16);
  funnel(b, f, L, -0.06, d, 0.13, 0.03);
  turret(b, f, L, 0.24, d, 0.09, 1, 1);
  turret(b, f, L, -0.25, d, 0.075, 1, -1);
  if (f === 'meridon') containers(b, L, -0.14, d);
  else b.block(0, d, -0.15, 0.06, 0.03, 0.08, L.hullDark);
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [0.101, 0.035, 0.18], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [-0.101, 0.035, 0.18], r: [0, -HALF_PI, 0] });
  return b;
}

export function battleship(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  const top = 0.07;
  hull(b, L, 0.88, 0.28, top, 0.24, mat.woodLight);
  const d = top + 0.008;
  // Mehrere Tuerme: zwei vorn (ueberhoehend), einer hinten / multiple turrets: two fore (superfiring), one aft
  turret(b, f, L, 0.235, d, 0.11, 2, 1);
  b.block(0, d, 0.12, 0.1, 0.035, 0.1, L.hullDark);
  turret(b, f, L, 0.12, d + 0.035, 0.11, 2, 1);
  turret(b, f, L, -0.25, d, 0.11, 2, -1);
  // Aufbau mit Turmmast / superstructure with tower mast
  superBlock(b, f, L, 0, d, 0.0, 0.17, 0.07, 0.2);
  superBlock(b, f, L, 0, d + 0.07, 0.02, 0.12, 0.06, 0.11);
  superBlock(b, f, L, 0, d + 0.13, 0.03, 0.08, 0.05, 0.06);
  mast(b, L, f, 0.03, d + 0.18, 0.14);
  funnel(b, f, L, -0.1, d, 0.15, 0.035);
  if (f === 'meridon') containers(b, L, -0.18, d);
  // Nebengeschuetze / secondary guns
  for (const s of [-1, 1]) for (const z of [-0.05, 0.08]) {
    b.block(s * 0.1, d, z, 0.04, 0.025, 0.04, L.hull);
    b.cyl(0.005, 0.005, 0.05, 4, mat.dark, [s * 0.1, d + 0.015, z + 0.035], [HALF_PI, 0, 0]);
  }
  addEmblem(b, f, 0.04, 0.006, L.emblem, { p: [0.141, 0.04, 0.2], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.04, 0.006, L.emblem, { p: [-0.141, 0.04, 0.2], r: [0, -HALF_PI, 0] });
  return b;
}
