/**
 * Sonderbauten: Kultschrein (Vesper), Rechenzentrum und Fusionskraftwerk (Nexus).
 * Special buildings: cult shrine (Vesper), data centre and fusion power plant (Nexus).
 */
import type { FactionId } from '../../data/balance';
import { flagPole } from './architecture';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng, shade } from './kit';
import { look, mat } from './look';

const HALF_PI = Math.PI / 2;

function candle(b: Builder, x: number, y: number, z: number, h: number) {
  b.cyl(0.008, 0.009, h, 6, mat.bone, [x, y + h / 2, z]);
  b.add(geo.cone(0.006, 0.016, 5), mat.ember, { p: [x, y + h + 0.008, z] });
}

function brazier(b: Builder, x: number, z: number) {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.tube([x + Math.sin(a) * 0.03, 0, z + Math.cos(a) * 0.03], [x + Math.sin(a) * 0.015, 0.08, z + Math.cos(a) * 0.015], 0.004, 4, mat.rustDark);
  }
  b.add(geo.cyl(0.04, 0.022, 0.03, 10), mat.rust, { p: [x, 0.09, z] });
  b.add(geo.cone(0.03, 0.05, 8), mat.ember, { p: [x, 0.125, z] });
  b.add(geo.cone(0.016, 0.035, 6), mat.yellow, { p: [x, 0.12, z] });
}

// ---------- Kultschrein / cult shrine ----------

export function shrine(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'vesper');
  const stone = mix(mat.concrete, mat.robe, 0.3);
  // Stufenaltar / stepped altar
  b.add(geo.cbox(0.6, 0.03, 0.5, 0.03), shade(stone, 0.85), { p: [0, 0.015, 0] });
  b.add(geo.cbox(0.44, 0.03, 0.34, 0.02), stone, { p: [0, 0.045, -0.02] });
  b.add(geo.cbox(0.22, 0.06, 0.12, 0.012), shade(stone, 1.1), { p: [0, 0.09, 0.02] });
  b.box(0.23, 0.012, 0.13, L.primary, [0, 0.12, 0.02]);
  // grosse Untergangssonne auf Pfosten / big doom sun disc on posts
  for (const s of [-1, 1]) b.add(geo.cbox(0.03, 0.34, 0.03, 0.006), mat.wood, { p: [s * 0.15, 0.2, -0.12] });
  b.group({ p: [0, 0.27, -0.11] }, () => {
    b.cyl(0.13, 0.13, 0.016, 24, mat.ember, [0, 0, 0], [HALF_PI, 0, 0]);
    b.add(geo.torus(0.13, 0.01, 4, 24), mat.rustDark, {});
    addEmblem(b, 'vesper', 0.11, 0.024, L.primary, { p: [0, 0, 0.004] });
    for (let i = 0; i < 9; i++) {
      const a = -HALF_PI * 0.9 + (i / 8) * Math.PI * 0.9;
      b.box(0.012, 0.06, 0.006, mat.ember, [Math.sin(a) * 0.17, Math.cos(a) * 0.17, 0], [0, 0, -a]);
    }
  });
  // Kerzen auf dem Altar / candles on the altar
  const R = rng(3);
  for (let i = 0; i < 9; i++) candle(b, -0.18 + i * 0.045, 0.06, 0.1 + (R() - 0.5) * 0.04, 0.02 + R() * 0.03);
  for (const s of [-1, 1]) candle(b, s * 0.06, 0.12, 0.04, 0.05);
  // Feuerschalen an den Ecken / braziers at the corners
  for (const [x, z] of [[-0.25, 0.2], [0.25, 0.2], [-0.25, -0.2], [0.25, -0.2]] as [number, number][]) brazier(b, x, z);
  // rote Banner, Knochenhaufen, Glocke / red banners, bone pile, bell
  for (const s of [-1, 1]) {
    b.tube([s * 0.28, 0, -0.05], [s * 0.28, 0.32, -0.06], 0.006, 5, mat.wood);
    b.box(0.006, 0.14, 0.07, L.primary, [s * 0.28, 0.24, -0.02]);
    b.add(geo.profileZY([[0, 0], [0.035, -0.03], [0.07, 0]], 0.006), L.primary, { p: [s * 0.28, 0.17, -0.055] });
  }
  for (let i = 0; i < 6; i++) b.tube([0.12 + R() * 0.08, 0.03, -0.2 + R() * 0.05], [0.12 + R() * 0.08, 0.04, -0.2 + R() * 0.05], 0.005, 5, mat.bone);
  b.add(geo.sphere(0.022, 8, 6), mat.bone, { p: [0.16, 0.05, -0.18] });
  b.add(geo.hemi(0.03, 12, 3), mat.gold, { p: [0, 0.4, -0.12], r: [Math.PI, 0, 0], s: [1, 1.3, 1] });
  b.box(0.32, 0.016, 0.016, mat.wood, [0, 0.43, -0.12]);
  if (f) flagPole(b, f, -0.27, 0.03, 0.15, 0.2, 0.6);
}

// ---------- Rechenzentrum / data centre ----------

export function dataCenter(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'nexus');
  const wall = mix(mat.plate, mat.concrete, 0.25);
  b.add(geo.cbox(0.62, 0.02, 0.52, 0.02), mat.gunmetal, { p: [0, 0.01, 0] });
  b.add(geo.cbox(0.5, 0.2, 0.38, 0.03), wall, { p: [0, 0.12, -0.02] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.006, 0.2, 0.006, mat.cyanGlow, [sx * 0.236, 0.12, -0.02 + sz * 0.176]);
  // Rack-Fronten mit Blinklichtern / rack fronts with blinking lights
  const R = rng(7);
  for (let c = 0; c < 6; c++) {
    const x = -0.2 + c * 0.08;
    b.box(0.06, 0.15, 0.006, mat.ink, [x, 0.11, 0.172]);
    for (let r = 0; r < 5; r++) {
      b.box(0.05, 0.004, 0.004, mat.gunmetal, [x, 0.05 + r * 0.03, 0.176]);
      const lit = R();
      b.box(0.008, 0.006, 0.004, lit < 0.6 ? mat.cyanGlow : mat.green, [x - 0.016 + R() * 0.03, 0.058 + r * 0.03, 0.177]);
    }
  }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) b.box(0.004, 0.12, 0.05, mat.ink, [s * 0.252, 0.11, -0.16 + i * 0.09]);
  // Dachluefter / rooftop cooling fans
  b.add(geo.cbox(0.46, 0.012, 0.34, 0.02), L.roof, { p: [0, 0.226, -0.02] });
  for (const x of [-0.13, 0.0, 0.13]) for (const z of [-0.09, 0.05]) {
    b.cyl(0.05, 0.05, 0.03, 14, mat.gunmetal, [x, 0.245, z]);
    b.add(geo.cyl(0.052, 0.052, 0.006, 14, true), mat.cyanGlow, { p: [x, 0.258, z] });
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) b.box(0.08, 0.003, 0.016, mat.dark, [x, 0.258, z], [0, a + x * 3, 0]);
    b.cyl(0.01, 0.01, 0.008, 8, mat.plate, [x, 0.262, z]);
  }
  // Kabeltrasse, Eingang, Antennen / cable tray, entrance, antennas
  b.box(0.04, 0.03, 0.5, mat.gunmetal, [0.28, 0.06, -0.02]);
  b.box(0.08, 0.1, 0.008, mix(mat.cyanGlow, mat.ink, 0.5), [0.2, 0.06, 0.174]);
  b.add(geo.cyl(0.03, 0.03, 0.005, 6), L.primary, { p: [-0.12, 0.234, 0.13] });
  addEmblem(b, 'nexus', 0.05, 0.008, L.primary, { p: [0, 0.18, 0.176] });
  if (f) flagPole(b, f, 0.27, 0.02, 0.22, 0.2, 0.6);
}

// ---------- Fusionskraftwerk / fusion power plant ----------

export function powerPlant(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'nexus');
  b.add(geo.cyl(0.36, 0.38, 0.03, 8), mat.gunmetal, { p: [0, 0.015, 0], r: [0, Math.PI / 8, 0] });
  b.add(geo.cyl(0.3, 0.32, 0.02, 8), mix(mat.plate, mat.concrete, 0.2), { p: [0, 0.04, 0], r: [0, Math.PI / 8, 0] });
  // Warnstreifen / warning stripes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.box(0.05, 0.004, 0.016, i % 2 ? mat.yellow : mat.ink, [Math.sin(a) * 0.33, 0.032, Math.cos(a) * 0.33], [0, a, 0]);
  }
  // Torusring mit Leuchtkern auf Stuetzen / torus ring with glowing core on pylons
  const cy = 0.2;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    b.add(geo.cbox(0.04, cy, 0.04, 0.008), mat.gunmetal, { p: [Math.sin(a) * 0.17, 0.05 + cy / 2, Math.cos(a) * 0.17] });
  }
  b.add(geo.torus(0.17, 0.045, 10, 28), mix(mat.plate, mat.metal, 0.3), { p: [0, cy, 0], r: [HALF_PI, 0, 0] });
  b.add(geo.torus(0.17, 0.047, 3, 28), L.primary, { p: [0, cy, 0], r: [HALF_PI, 0, 0], s: [1, 1, 0.25] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(0.03, 0.1, 0.012, mat.gunmetal, [Math.sin(a) * 0.17, cy, Math.cos(a) * 0.17], [0, a, 0]);
  }
  b.add(geo.ico(0.07, 2), mat.cyanGlow, { p: [0, cy, 0] });
  b.add(geo.torus(0.1, 0.008, 4, 20), mix(mat.cyanGlow, mat.white, 0.3), { p: [0, cy, 0], r: [HALF_PI - 0.5, 0.4, 0] });
  b.add(geo.torus(0.1, 0.008, 4, 20), mix(mat.cyanGlow, mat.white, 0.3), { p: [0, cy, 0], r: [HALF_PI + 0.5, -0.4, 0] });
  // kleiner Kuehlturm mit Dampf / small cooling tower with steam
  b.add(geo.cyl(0.05, 0.075, 0.14, 14), mat.plate, { p: [-0.25, 0.12, -0.2] });
  b.add(geo.cyl(0.06, 0.05, 0.08, 14), mat.plate, { p: [-0.25, 0.23, -0.2] });
  b.add(geo.cyl(0.061, 0.061, 0.012, 14, true), L.primary, { p: [-0.25, 0.26, -0.2] });
  b.add(geo.ico(0.05, 1), mat.cloud, { p: [-0.25, 0.31, -0.2] });
  b.add(geo.ico(0.04, 1), mat.cloudShade, { p: [-0.22, 0.36, -0.22] });
  // Leitungen zu den Kuehlrippen / lines to the cooling fins
  for (const s of [-1, 1]) {
    b.tube([s * 0.1, 0.06, 0.2], [s * 0.15, 0.15, 0.1], 0.01, 8, mat.gunmetal);
    for (let i = 0; i < 5; i++) b.box(0.006, 0.07, 0.08, mat.metalLight, [s * 0.25 + i * 0.012 * s, 0.09, 0.2]);
  }
  addEmblem(b, 'nexus', 0.04, 0.008, L.primary, { p: [0, 0.07, 0.31] });
  if (f) flagPole(b, f, 0.28, 0.03, -0.24, 0.2, 0.6);
}
