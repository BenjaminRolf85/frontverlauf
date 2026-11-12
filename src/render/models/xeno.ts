/**
 * Fremdwesen-Bauten und Flora / alien buildings and flora:
 * Brutstock (organische Kapseln, Ranken, leuchtende Schlote), Extraktor (Kristallbohrer),
 * Flora fuer terraformte Felder (Kristalle, Ranken, Sporenkapseln).
 * Brood hive (organic pods, tendrils, glowing vents), extractor (crystal drill),
 * flora for terraformed tiles (crystals, tendrils, spore pods).
 */
import type { FactionId } from '../../data/balance';
import { Builder, geo, mix, rng, shade, type ColorLike, type V3 } from './kit';
import { look, mat } from './look';

const HALF_PI = Math.PI / 2;
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Ranke als gebogene Rohrkette / tendril as curved tube chain */
export function tendril(b: Builder, a: V3, c: V3, e: V3, r0: number, r1: number, n: number, col: ColorLike, tip: ColorLike | null) {
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = lerp3(lerp3(a, c, t), lerp3(c, e, t), t);
    b.tube(prev, p, r0 + (r1 - r0) * ((i - 1) / n), 5, col, r0 + (r1 - r0) * t);
    prev = p;
  }
  if (tip) b.add(geo.ico(r1 * 2.2 + 0.004, 0), tip, { p: e });
}

/** Kristall (Doppelspitze) / crystal (double point) */
export function crystal(b: Builder, x: number, z: number, h: number, r: number, c: ColorLike, tilt: V3 = [0, 0, 0]) {
  b.group({ p: [x, 0, z], r: tilt }, () => {
    b.add(geo.cyl(r, r * 0.8, h * 0.7, 5), c, { p: [0, h * 0.35, 0] });
    b.add(geo.cone(r, h * 0.3, 5), shade(c, 1.2), { p: [0, h * 0.85, 0] });
  });
}

/** Antennenturm mit Leuchtkugel (Zyrr statt Fahnenmast) / antenna spire with glowing orb (Zyrr instead of a flag mast) */
export function zyrrSpire(b: Builder, x: number, y: number, z: number, h: number, size = 1) {
  const L = look('zyrr');
  b.add(geo.cyl(0.004 * size, 0.022 * size, h, 6), L.primaryDark, { p: [x, y + h / 2, z] });
  for (let i = 0; i < 3; i++) b.add(geo.torus(0.016 * size * (1 - i * 0.2), 0.004 * size, 3, 8), mat.acid, { p: [x, y + h * (0.3 + i * 0.22), z], r: [HALF_PI, 0, 0] });
  b.add(geo.ico(0.03 * size, 1), mat.xenoGlow, { p: [x, y + h + 0.02 * size, z] });
  b.add(geo.torus(0.045 * size, 0.004 * size, 3, 12), mat.acid, { p: [x, y + h + 0.02 * size, z], r: [HALF_PI - 0.4, 0.3, 0] });
}

// ---------- Brutstock / brood hive ----------

export function xenoHive(b: Builder, f: FactionId | null) {
  const L = look(f);
  const skin = mix(mat.alienSkinDark, mat.xenoGround, 0.4);
  // Grundmasse / base mass
  b.add(geo.hemi(0.3, 16, 4), skin, { p: [0, 0, 0], s: [1, 0.25, 1] });
  // bauchige Kapseln / bulbous pods
  const pods: [number, number, number][] = [[0, 0.16, -0.02], [-0.14, 0.11, 0.08], [0.15, 0.12, 0.06], [0.06, 0.09, -0.17], [-0.1, 0.08, -0.15]];
  pods.forEach(([x, r, z], i) => {
    b.add(geo.sphere(r, 12, 8), i === 0 ? mat.xenoGround : mix(mat.xenoGround, L.primary, 0.3), { p: [x, r * 0.85, z], s: [1, 1.15, 1] });
    // Adern / veins
    for (let k = 0; k < 2; k++) b.add(geo.torus(r * 1.0, 0.005, 3, 12), L.primary, { p: [x, r * 0.85, z], r: [0, (k / 2) * Math.PI + 0.3, 0], s: [1, 1.15, 1] });
    // leuchtende Oeffnung / glowing opening
    b.add(geo.sphere(r * 0.35, 8, 5), mat.acid, { p: [x, r * 1.4, z + r * 0.55], s: [1, 0.6, 0.6] });
  });
  // Sporenschlot / spore chimney
  b.add(geo.cyl(0.03, 0.06, 0.18, 10), skin, { p: [0, 0.36, -0.02] });
  b.add(geo.torus(0.035, 0.008, 4, 12), mat.acid, { p: [0, 0.45, -0.02], r: [HALF_PI, 0, 0] });
  b.add(geo.ico(0.035, 1), mat.xenoGlow, { p: [0, 0.48, -0.02] });
  for (let i = 0; i < 5; i++) b.add(geo.ico(0.012 + i * 0.002, 0), mix(mat.xenoGlow, mat.white, 0.3), { p: [0.02 * Math.sin(i * 2), 0.52 + i * 0.03, -0.02 + 0.015 * Math.cos(i * 2)] });
  // Ranken ueber den Boden / tendrils across the ground
  const R = rng(17);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + R() * 0.3;
    const r0 = 0.18, r1 = 0.32 + R() * 0.08;
    tendril(b, [Math.sin(a) * r0, 0.04, Math.cos(a) * r0], [Math.sin(a + 0.4) * (r0 + r1) / 2, 0.06, Math.cos(a + 0.4) * (r0 + r1) / 2], [Math.sin(a + 0.2) * r1, 0.01, Math.cos(a + 0.2) * r1], 0.014, 0.005, 5, skin, i % 2 ? mat.acid : mat.xenoGlow);
  }
  // Fraktionszeichen / faction marker
  if (f === 'zyrr' || f === null) zyrrSpire(b, 0.28, 0, -0.26, 0.25, 0.8);
  else b.add(geo.cyl(0.03, 0.03, 0.02, 10), L.primary, { p: [0.28, 0.01, -0.26] });
}

// ---------- Extraktor / harvester ----------

export function xenoHarvester(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Sechseckplattform / hexagon platform
  b.cyl(0.3, 0.33, 0.04, 6, mat.alienMetal, [0, 0.02, 0], [0, Math.PI / 6, 0]);
  b.cyl(0.26, 0.28, 0.02, 6, L.primary, [0, 0.05, 0], [0, Math.PI / 6, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.box(0.08, 0.006, 0.012, mat.acid, [Math.sin(a) * 0.27, 0.062, Math.cos(a) * 0.27], [0, a, 0]);
  }
  // Bohrschaft mit Leuchtringen / drill shaft with glow rings
  b.cyl(0.04, 0.05, 0.12, 12, mat.alienMetalLight, [0, 0.12, 0]);
  for (let i = 0; i < 3; i++) b.add(geo.torus(0.05, 0.007, 4, 14), mat.acid, { p: [0, 0.08 + i * 0.035, 0], r: [HALF_PI, 0, 0] });
  // drei gebogene Arme halten den Kristall / three curved arms hold the crystal
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    tendril(b, [Math.sin(a) * 0.2, 0.06, Math.cos(a) * 0.2], [Math.sin(a) * 0.24, 0.3, Math.cos(a) * 0.24], [Math.sin(a) * 0.08, 0.42, Math.cos(a) * 0.08], 0.018, 0.01, 6, mat.alienMetal, mat.acid);
  }
  // schwebender Kristall / floating crystal
  b.add(geo.cone(0.08, 0.16, 6), mat.xenoGlow, { p: [0, 0.38, 0] });
  b.add(geo.cone(0.08, 0.1, 6), shade(mat.xenoGlow, 0.85), { p: [0, 0.25, 0], r: [Math.PI, 0, 0] });
  b.add(geo.torus(0.11, 0.006, 3, 16), mat.acid, { p: [0, 0.31, 0], r: [HALF_PI - 0.3, 0, 0.2] });
  // Sammelkapseln mit Leitungen / collector pods with pipes
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 3 + (i / 3) * Math.PI * 2;
    const p: V3 = [Math.sin(a) * 0.3, 0.07, Math.cos(a) * 0.3];
    b.add(geo.sphere(0.06, 12, 8), mix(mat.xenoGround, L.primary, 0.3), { p, s: [1, 0.9, 1] });
    b.add(geo.sphere(0.022, 8, 4), mat.acid, { p: [p[0], p[1] + 0.05, p[2]] });
    b.tube([p[0] * 0.75, 0.07, p[2] * 0.75], [Math.sin(a) * 0.06, 0.12, Math.cos(a) * 0.06], 0.009, 6, mat.alienMetalLight);
  }
  // kleine schwebende Splitter / small floating shards
  const R = rng(5);
  for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2;
    b.add(geo.ico(0.012, 0), i % 2 ? mat.acid : mat.xenoGlow, { p: [Math.sin(a) * 0.15, 0.25 + R() * 0.2, Math.cos(a) * 0.15] });
  }
  if (f === 'zyrr' || f === null) zyrrSpire(b, -0.3, 0.04, -0.18, 0.22, 0.7);
}

// ---------- Flora / flora ----------

export function xenoFlora(variant: number): Builder {
  const v = ((variant % 6) + 6) % 6;
  const R = rng(300 + v * 41);
  const b = new Builder();
  const glow = [mat.xenoGlow, mat.acid, mix(mat.xenoGlow, mat.white, 0.3)];
  const stalk = mix(mat.alienSkinDark, mat.xenoGround, 0.5);
  const spot = (): [number, number] => [(R() - 0.5) * 0.7, (R() - 0.5) * 0.7];
  if (v === 0 || v === 3) {
    // Kristallgruppen / crystal clusters
    for (let g = 0; g < (v === 0 ? 2 : 3); g++) {
      const [cx, cz] = spot();
      for (let i = 0; i < 4; i++) crystal(b, cx + (R() - 0.5) * 0.06, cz + (R() - 0.5) * 0.06, 0.06 + R() * 0.1, 0.012 + R() * 0.01, glow[(i + g) % 3], [(R() - 0.5) * 0.7, R() * 3, (R() - 0.5) * 0.7]);
    }
  }
  if (v === 1 || v === 4) {
    // Ranken mit Leuchtspitzen / tendrils with glowing tips
    for (let i = 0; i < (v === 1 ? 5 : 3); i++) {
      const [x, z] = spot();
      const h = 0.1 + R() * 0.12;
      tendril(b, [x, 0, z], [x + (R() - 0.5) * 0.1, h * 0.6, z + (R() - 0.5) * 0.1], [x + (R() - 0.5) * 0.12, h, z + (R() - 0.5) * 0.12], 0.012, 0.004, 4, stalk, glow[i % 3]);
    }
  }
  if (v === 2 || v === 4 || v === 5) {
    // Sporenkapseln auf Stielen / spore pods on stalks
    for (let i = 0; i < (v === 2 ? 5 : 3); i++) {
      const [x, z] = spot();
      const h = 0.05 + R() * 0.08;
      b.tube([x, 0, z], [x, h, z], 0.007, 5, stalk, 0.005);
      b.add(geo.sphere(0.025 + R() * 0.015, 8, 5), mix(mat.xenoGround, mat.xenoGlow, 0.4), { p: [x, h + 0.02, z], s: [1, 1.2, 1] });
      b.add(geo.sphere(0.01, 6, 3), mat.acid, { p: [x, h + 0.045, z] });
    }
  }
  if (v === 5 || v === 3) {
    // Leuchtpilze / glowing caps
    for (let i = 0; i < 3; i++) {
      const [x, z] = spot();
      b.cyl(0.006, 0.008, 0.04, 5, stalk, [x, 0.02, z]);
      b.add(geo.hemi(0.03, 8, 2), glow[i % 3], { p: [x, 0.04, z], s: [1, 0.5, 1] });
    }
  }
  return b;
}
