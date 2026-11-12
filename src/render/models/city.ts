/**
 * Staedte, die mit jeder Stufe sichtbar wachsen / cities that grow visibly with every level.
 * 3x3-Raster aus Zellen; Fabrikhalle, Regierungsviertel und HQ-Mast belegen feste Zellen,
 * der Bunkerring umschliesst die Stadt.
 * 3x3 grid of cells; factory hall, government quarter and HQ mast take fixed cells,
 * the bunker ring encloses the city.
 */
import type { FactionId } from '../../data/balance';
import { HALF_PI, band, chimney, flagPole, house } from './architecture';
import { sawtoothHall } from './buildings';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng } from './kit';
import { look, mat } from './look';

export interface CityFlags { hq: boolean; factory: boolean; bunkerRing: boolean; govQuarter: boolean }

const C = 0.255; // Zellabstand / cell pitch
type Cell = { id: string; x: number; z: number };
const ORDER: Cell[] = [
  { id: 'c', x: 0, z: 0 },
  { id: 'fr', x: C, z: C },
  { id: 'f', x: 0, z: C },
  { id: 'r', x: C, z: 0 },
  { id: 'l', x: -C, z: 0 },
  { id: 'b', x: 0, z: -C },
  { id: 'fl', x: -C, z: C },
  { id: 'bl', x: -C, z: -C },
  { id: 'br', x: C, z: -C },
];

function houseCount(level: number, neutral: boolean): number {
  const n = [0, 3, 4, 5, 7, 8, 9, 10, 11][Math.min(8, Math.max(1, level))];
  return neutral ? Math.min(n, 6) : n;
}

function govQuarter(b: Builder, f: FactionId | null, x: number, z: number) {
  const L = look(f);
  b.group({ p: [x, 0, z] }, () => {
    b.block(0, 0, 0, 0.23, 0.02, 0.23, mat.concreteLight);
    b.block(0, 0.02, -0.01, 0.2, 0.12, 0.16, mat.paper);
    band(b, 0, 0.08, -0.01, 0.2, 0.16, 0.016, mat.window);
    for (let i = 0; i < 4; i++) b.cyl(0.011, 0.013, 0.11, 6, mat.white, [-0.075 + i * 0.05, 0.075, 0.085]);
    b.block(0, 0.13, 0.0, 0.22, 0.02, 0.2, mat.concreteLight);
    b.cyl(0.07, 0.075, 0.05, 12, mat.paper, [0, 0.175, 0]);
    b.add(geo.hemi(0.072, 12, 4), f ? L.primary : mat.gold, { p: [0, 0.2, 0] });
    b.cyl(0.008, 0.012, 0.07, 6, mat.gold, [0, 0.3, 0]);
    b.add(geo.ico(0.014, 0), mat.gold, { p: [0, 0.34, 0] });
  });
}

function factory(b: Builder, f: FactionId | null, x: number, z: number) {
  sawtoothHall(b, f, x + 0.02, z + 0.02, 0.2, 0.2, 0.1, 3);
  chimney(b, x - 0.08, 0, z - 0.08, 0.36, 0.028, mat.concreteLight);
}

function hq(b: Builder, f: FactionId | null, x: number, z: number, level: number) {
  const L = look(f);
  // Kommandogebaeude + Mast mit Fraktionsflagge / command building + mast with faction flag
  b.group({ p: [x + 0.03, 0, z - 0.02] }, () => {
    b.block(0, 0, 0, 0.16, 0.1, 0.13, f ? L.wallDark : mat.concrete);
    band(b, 0, 0.055, 0, 0.16, 0.13, 0.02, f ? L.primary : mat.neutral);
    b.block(0, 0.1, 0, 0.17, 0.015, 0.14, f ? L.roofDark : mat.concreteDark);
    if (f) addEmblem(b, f, 0.03, 0.006, L.emblem, { p: [0, 0.03, 0.068] });
  });
  flagPole(b, f, x - 0.08, 0, z + 0.07, 0.5 + Math.min(level, 6) * 0.03, 1.15);
}

function bunkerRing(b: Builder, f: FactionId | null) {
  const L = look(f);
  const R = 0.4;
  const t = 0.035;
  const h = 0.075;
  const trim = f ? L.primary : mat.concreteDark;
  for (let side = 0; side < 4; side++) {
    b.group({ r: [0, side * HALF_PI, 0] }, () => {
      // zwei Mauerstuecke mit Tor in der Mitte / two wall pieces with a gate in the middle
      for (const s of [-1, 1]) {
        const len = R - 0.07;
        b.block(s * (0.07 + len / 2), 0, R, len, h, t, mat.concrete);
        b.block(s * (0.07 + len / 2), h, R, len, 0.012, t + 0.006, trim);
        for (let k = 0; k < 3; k++) b.block(s * (0.1 + k * 0.1), h + 0.012, R, 0.04, 0.025, t, mat.concreteLight);
      }
      // Torpfosten / gate posts
      for (const s of [-1, 1]) b.block(s * 0.07, 0, R, 0.04, h + 0.03, t + 0.012, mat.concreteDark);
    });
  }
  // Ecktuerme / corner towers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cyl(0.042, 0.048, 0.11, 6, mat.concreteLight, [sx * R, 0.055, sz * R]);
    b.cyl(0.05, 0.05, 0.016, 6, trim, [sx * R, 0.118, sz * R]);
    b.box(0.03, 0.012, 0.012, mat.ink, [sx * R, 0.08, sz * R + sz * 0.04], [0, 0, 0]);
  }
}

export function city(f: FactionId | null, level: number, flags: CityFlags): Builder {
  const b = new Builder();
  const L = look(f);
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  const R = rng(lv * 131 + (f ? f.length * 17 + f.charCodeAt(0) : 3));
  // Platz / plaza
  const plaza = f ? mix(mat.concreteLight, L.wall, 0.35) : mix(mat.sand, mat.concreteLight, 0.3);
  b.block(0, 0, 0, 0.8, 0.01, 0.8, plaza);
  b.block(0, 0.01, 0, 0.06, 0.003, 0.8, f ? mat.concrete : mat.sand);
  b.block(0, 0.01, 0, 0.8, 0.003, 0.06, f ? mat.concrete : mat.sand);
  const reserved = new Set<string>();
  if (flags.factory) reserved.add('bl');
  if (flags.govQuarter) reserved.add('br');
  if (flags.hq) reserved.add('fl');
  const cells = ORDER.filter((c) => !reserved.has(c.id));
  const n = houseCount(lv, f === null);
  type Slot = { x: number; z: number; w: number; d: number; centre: boolean };
  const slots: Slot[] = [];
  const free = cells.length;
  let split = Math.max(0, n - free);
  for (const c of cells) {
    if (slots.length >= n) break;
    const centre = c.id === 'c';
    if (!centre && split > 0) {
      split--;
      slots.push({ x: c.x - 0.058, z: c.z, w: 0.095, d: 0.16, centre: false });
      slots.push({ x: c.x + 0.062, z: c.z, w: 0.095, d: 0.16, centre: false });
    } else {
      slots.push({ x: c.x, z: c.z, w: centre ? 0.2 : 0.165, d: centre ? 0.2 : 0.15, centre });
    }
  }
  const neutral = f === null;
  slots.forEach((s, i) => {
    let h: number;
    if (s.centre) h = neutral ? 0.1 + lv * 0.02 : [0, 0.13, 0.2, 0.3, 0.4, 0.5, 0.56, 0.6, 0.62][lv];
    else h = Math.min(0.36, 0.07 + lv * 0.022 + R() * (0.02 + lv * 0.012));
    if (neutral) h = Math.min(h, 0.2);
    const jitter = s.centre ? 0 : (R() - 0.5) * 0.02;
    house(b, f, s.x + jitter, s.z + jitter, s.w, s.d, h, {
      seed: i * 7 + lv, landmark: s.centre && lv >= 3, ry: s.w < 0.1 ? 0 : (R() < 0.3 ? HALF_PI : 0),
    });
  });
  if (flags.factory) factory(b, f, -C, -C);
  if (flags.govQuarter) govQuarter(b, f, C, -C);
  if (flags.hq) hq(b, f, -C, C, lv);
  if (flags.bunkerRing) bunkerRing(b, f);
  // Kleine Baeume im neutralen Dorf / small trees in the neutral village
  if (neutral && !flags.bunkerRing) {
    for (const [x, z] of [[-0.36, 0.36], [0.37, -0.36]] as [number, number][]) {
      b.cyl(0.01, 0.012, 0.05, 5, mat.wood, [x, 0.025, z]);
      b.add(geo.dodeca(0.045), mat.leaf, { p: [x, 0.08, z] });
    }
  }
  return b;
}
