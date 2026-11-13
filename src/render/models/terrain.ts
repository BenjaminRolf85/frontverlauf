/**
 * Gelaende-Sondermodelle: Vulkan, Vulkanrauch, Lava-Ueberlagerung, Absturzstelle, Dschungel.
 * Special terrain models: volcano, volcano smoke, lava overlay, crash site, jungle.
 * Kacheloberseite bei y=0, Grundflaeche innerhalb von ~0.95 / tile top at y=0, footprint within ~0.95.
 */
import * as THREE from 'three';
import { primitives } from '../../design/tokens';
import { Builder, col, geo, mix, rng, shade, type V3 } from './kit';
import { mat } from './look';

const HALF_PI = Math.PI / 2;
const p = primitives.color;
const C = {
  basalt: mix(p.ink700, p.rock600, 0.35),
  basaltDark: mix(p.ink800, p.rock600, 0.2),
  ash: mix(p.ink500, p.rock400, 0.4),
  lava: col(p.orange500),
  lavaHot: col(p.yellow400),
  lavaRed: col(p.red500),
  crust: mix(p.ink800, p.ink700, 0.5),
  smoke: mix(p.ink500, p.ink700, 0.35),
  smokeLight: mix(p.ink500, p.cloud300, 0.35),
  hull: mix(p.white, p.rock400, 0.45),
  hullDark: mix(p.rock400, p.ink700, 0.4),
  dirt: mix(p.paper300, p.rock600, 0.6),
  dirtDark: mix(p.rock600, p.ink700, 0.45),
  leaf: col(p.forest700),
  leafMid: col(p.forest500),
  leafDeep: mix(p.forest700, p.ink800, 0.3),
  fern: col(p.green700),
  trunk: shade(p.paper300, 0.45),
  trunkLight: shade(p.paper300, 0.6),
  flowerRed: col(p.red500),
  flowerYellow: col(p.yellow400),
};

/** Unregelmaessiger Umriss / irregular outline */
function blob(R: () => number, cx: number, cz: number, r: number, n: number, jitter: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - jitter / 2 + R() * jitter);
    pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
  }
  return pts;
}

/** Flamme / flame tongue */
function flameTongue(b: Builder, x: number, y: number, z: number, h: number, R: () => number) {
  b.add(geo.cone(h * 0.3, h, 6), C.lava, { p: [x, y + h / 2, z], r: [(R() - 0.5) * 0.3, R() * 3, (R() - 0.5) * 0.3] });
  b.add(geo.cone(h * 0.16, h * 0.65, 5), C.lavaHot, { p: [x, y + h * 0.33, z] });
}

/** Kegel mit verrauschten Ecken / cone with jittered vertices */
function jaggedCone(rTop: number, rBot: number, h: number, seg: number, rows: number, R: () => number, amp: number) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, rows, true);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const q = (n: number) => Math.round(n * 10000) + 0;
  const key = (x: number, y: number, z: number) => `${q(x)}|${q(y)}|${q(z)}`;
  const off = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!off.has(k)) off.set(k, 1 + (R() - 0.5) * amp);
    const s = off.get(k)!;
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i), pos.getZ(i) * s);
  }
  return g;
}

// ---------- Vulkan / volcano ----------

export function volcano(variant: number): Builder {
  const v = ((variant % 3) + 3) % 3;
  const R = rng(700 + v * 53);
  const b = new Builder();
  const H = 0.72 + v * 0.02;
  // steiler Basaltkegel / steep basalt cone
  b.add(jaggedCone(0.11, 0.42, H, 16, 4, R, 0.22), C.basalt, { p: [0, H / 2, 0] });
  b.add(jaggedCone(0.3, 0.44, 0.12, 16, 1, R, 0.15), C.basaltDark, { p: [0, 0.06, 0] });
  // gezackter Kraterrand / jagged crater rim
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + R() * 0.3;
    b.add(geo.cone(0.035 + R() * 0.015, 0.05 + R() * 0.05, 5), i % 2 ? C.basalt : C.basaltDark, { p: [Math.cos(a) * 0.105, H + 0.015, Math.sin(a) * 0.105], r: [(R() - 0.5) * 0.4, R() * 3, (R() - 0.5) * 0.4] });
  }
  // gluehender Krater / glowing crater
  b.cyl(0.095, 0.095, 0.01, 14, C.lavaRed, [0, H - 0.01, 0]);
  b.cyl(0.07, 0.07, 0.012, 12, C.lava, [0, H - 0.004, 0]);
  b.cyl(0.04, 0.04, 0.012, 10, C.lavaHot, [0, H + 0.002, 0]);
  for (let i = 0; i < 4; i++) b.add(geo.sphere(0.012 + R() * 0.01, 6, 4), C.lavaHot, { p: [(R() - 0.5) * 0.08, H + 0.006, (R() - 0.5) * 0.08] });
  // Lavastroeme an zwei Seiten / lava streams down two sides
  for (const a0 of [0.6 + v * 0.7, 0.6 + v * 0.7 + 2.5]) {
    let prev: THREE.Vector3 | null = null;
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + Math.sin(t * 5 + v) * 0.12;
      const y = H - 0.005 - t * (H - 0.12);
      const r = 0.11 + t * (0.42 - 0.11) * 0.97 + 0.012;
      const pt = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      if (prev) {
        const w = 0.045 - t * 0.02;
        b.segment(prev, pt, (l) => geo.box(w, l + 0.01, 0.014), C.lava);
        b.segment(prev, pt, (l) => geo.box(w * 0.45, l + 0.01, 0.018), C.lavaHot);
      }
      prev = pt;
    }
    if (prev) b.add(geo.sphere(0.035, 8, 4), C.lava, { p: [prev.x * 1.03, 0.07, prev.z * 1.03], s: [1, 0.35, 1] });
  }
  // gluehende Risse / glowing cracks
  for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2;
    const t = 0.25 + R() * 0.55;
    const y = H - t * (H - 0.1);
    const r = (0.11 + t * 0.31) * 1.02;
    b.box(0.006, 0.05 + R() * 0.05, 0.008, i % 2 ? C.lavaRed : C.lava, [Math.cos(a) * r, y, Math.sin(a) * r], [0, -a, (R() - 0.5) * 0.8]);
  }
  // Felsbrocken am Fuss / boulders at the foot
  for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2;
    const s = 0.03 + R() * 0.03;
    b.add(geo.dodeca(s), i % 2 ? C.basaltDark : C.ash, { p: [Math.cos(a) * 0.43, s * 0.5, Math.sin(a) * 0.43], r: [R(), R() * 3, R()] });
  }
  return b;
}

export function volcanoSmoke(): Builder {
  const b = new Builder();
  const puffs: [number, number, number, number][] = [[0, 0.05, 0, 0.07], [0.04, 0.12, -0.02, 0.06], [-0.03, 0.17, 0.02, 0.055], [0.01, 0.23, -0.01, 0.045]];
  puffs.forEach(([x, y, z, r], i) => b.add(geo.ico(r, 1), i % 2 ? C.smokeLight : C.smoke, { p: [x, y, z], s: [1, 0.85, 1] }));
  return b;
}

// ---------- Lava-Ueberlagerung / lava overlay ----------

export function lava(variant: number): Builder {
  const v = ((variant % 3) + 3) % 3;
  const R = rng(900 + v * 37);
  const b = new Builder();
  // grosse Lavaflaeche + Stroeme / big lava pool + streams
  b.add(geo.prismXZ(blob(R, 0, 0, 0.4, 14, 0.35), 0.012), C.lava, { p: [0, 0, 0] });
  for (let i = 0; i < 3; i++) {
    const a = R() * Math.PI * 2;
    b.add(geo.prismXZ(blob(R, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.12 + R() * 0.06, 9, 0.5), 0.006), C.lavaHot, { p: [0, 0.012, 0] });
  }
  // dunkle Krustenplatten / dark crust plates
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2;
    const r = 0.08 + R() * 0.28;
    b.add(geo.prismXZ(blob(R, Math.cos(a) * r, Math.sin(a) * r, 0.035 + R() * 0.04, 6, 0.5), 0.016), i % 3 ? C.crust : C.basaltDark, { p: [0, 0.004, 0] });
  }
  // kleine Flammenzungen / small flame tongues
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2;
    const r = R() * 0.3;
    flameTongue(b, Math.cos(a) * r, 0.01, Math.sin(a) * r, 0.04 + R() * 0.05, R);
  }
  return b;
}

// ---------- Absturzstelle / crash site ----------

export function crashSite(variant: number): Builder {
  const v = ((variant % 2) + 2) % 2;
  const R = rng(1300 + v * 71);
  const b = new Builder();
  const ry = v ? -0.5 : 0.4;
  // Furche hinter der Untertasse / furrow behind the saucer
  b.group({ r: [0, ry, 0] }, () => {
    b.add(geo.prismXZ([[-0.08, -0.05], [0.08, -0.05], [0.06, -0.44], [-0.05, -0.44]], 0.008), C.dirtDark, {});
    for (const s of [-1, 1]) {
      b.add(geo.rtaper(0.06, 0.38, 0.02, 0.36, 0.04, 0.01), C.dirt, { p: [s * 0.11, 0.02, -0.25], r: [0, s * 0.06, 0] });
      for (let i = 0; i < 4; i++) b.add(geo.dodeca(0.015 + R() * 0.015), C.dirt, { p: [s * (0.14 + R() * 0.05), 0.01, -0.1 - R() * 0.3] });
    }
    // halb vergrabene, geneigte Untertasse / half-buried tilted saucer
    b.group({ p: [0, 0.05, 0.08], r: [0.18, 0, 0.44] }, () => {
      b.add(geo.hemi(0.27, 22, 5), C.hull, { s: [1, 0.26, 1] });
      b.add(geo.hemi(0.26, 22, 4), C.hullDark, { r: [Math.PI, 0, 0], s: [1, 0.2, 1] });
      // verbogener Rand / bent rim
      b.add(geo.torus(0.27, 0.014, 4, 22), C.hullDark, { r: [HALF_PI, 0, 0] });
      b.add(geo.cbox(0.12, 0.012, 0.05, 0.01), C.hull, { p: [0.24, 0.03, 0.12], r: [0.4, 0.5, 0.6] });
      b.add(geo.cbox(0.08, 0.01, 0.04, 0.008), C.hull, { p: [-0.22, 0.02, -0.15], r: [-0.5, -0.4, -0.3] });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        b.add(geo.sphere(0.01, 6, 3), i % 3 ? mat.white : mat.xenoGlow, { p: [Math.cos(a) * 0.255, 0.008, Math.sin(a) * 0.255] });
      }
      // geborstene Kuppel / cracked dome
      b.add(geo.hemi(0.1, 16, 5), mix(mat.glassDark, mat.xenoGlow, 0.35), { p: [0, 0.06, 0] });
      b.add(geo.cyl(0.103, 0.103, 0.012, 16, true), C.hullDark, { p: [0, 0.064, 0] });
      for (let i = 0; i < 5; i++) b.box(0.004, 0.004, 0.06 + R() * 0.04, mat.ink, [(R() - 0.5) * 0.08, 0.13 + R() * 0.02, (R() - 0.5) * 0.06], [0, R() * 3, 0]);
      b.add(geo.ico(0.03, 0), mat.ink, { p: [0.04, 0.14, 0.03], s: [1, 0.5, 1] });
      // Panzerplatten-Fugen / hull panel seams
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        b.box(0.12, 0.004, 0.004, C.hullDark, [Math.cos(a) * 0.18, 0.045, Math.sin(a) * 0.18], [0, -a, 0]);
      }
    });
  });
  // verstreute Truemmer / scattered hull debris
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2;
    const r = 0.25 + R() * 0.17;
    b.add(geo.cbox(0.04 + R() * 0.05, 0.008, 0.03 + R() * 0.03, 0.008), i % 3 ? C.hull : C.hullDark, { p: [Math.cos(a) * r, 0.01, Math.sin(a) * r], r: [(R() - 0.5) * 0.8, R() * 3, (R() - 0.5) * 0.8] });
  }
  for (let i = 0; i < 4; i++) b.tube([R() * 0.3 - 0.15, 0.005, 0.32 - R() * 0.05], [R() * 0.3 - 0.15, 0.04, 0.36 - R() * 0.05], 0.004, 4, C.hullDark);
  // leuchtendes Leck + kleine Feuer / glowing leak + small fires
  b.add(geo.prismXZ(blob(R, 0.15, 0.2, 0.08, 8, 0.4), 0.004), mat.acid, { p: [0, 0.002, 0] });
  b.add(geo.prismXZ(blob(R, 0.14, 0.2, 0.045, 7, 0.4), 0.004), mat.xenoGlow, { p: [0, 0.006, 0] });
  for (let i = 0; i < 4; i++) b.add(geo.ico(0.008, 0), i % 2 ? mat.acid : mat.xenoGlow, { p: [0.12 + R() * 0.08, 0.02 + R() * 0.04, 0.17 + R() * 0.06] });
  for (const [x, z] of [[-0.2, 0.15], [0.25, -0.12], [-0.05, 0.3]] as [number, number][]) {
    flameTongue(b, x, 0, z, 0.05 + R() * 0.03, R);
    b.add(geo.ico(0.025, 0), C.smoke, { p: [x + 0.01, 0.1 + R() * 0.03, z - 0.01] });
  }
  return b;
}

// ---------- Dschungel / jungle ----------

function palm(b: Builder, x: number, z: number, h: number, lean: number, ry: number, R: () => number) {
  const top: V3 = [x + Math.cos(ry) * lean, h, z + Math.sin(ry) * lean];
  const mid: V3 = [x + Math.cos(ry) * lean * 0.35, h * 0.5, z + Math.sin(ry) * lean * 0.35];
  b.tube([x, 0, z], mid, 0.016, 5, C.trunk, 0.013);
  b.tube(mid, top, 0.013, 5, C.trunk, 0.01);
  b.add(geo.cyl(0.015, 0.015, 0.008, 6, true), C.trunkLight, { p: mid });
  const leaves = 7;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + R() * 0.4;
    b.group({ p: top, r: [0, -a, 0] }, () => {
      b.add(geo.taper(0.05, 0.004, 0.012, 0.003, 0.17), i % 2 ? C.leaf : C.leafMid, { p: [0.075, -0.03, 0], r: [0, 0, -1.15 - R() * 0.3] });
    });
  }
  b.add(geo.ico(0.015, 0), C.trunkLight, { p: [top[0], top[1] - 0.02, top[2]] });
}

function broadleaf(b: Builder, x: number, z: number, h: number, R: () => number, vines: number) {
  b.tube([x, 0, z], [x + (R() - 0.5) * 0.04, h * 0.7, z + (R() - 0.5) * 0.04], 0.02, 6, C.trunk, 0.014);
  const blobs: [number, number, number, number][] = [[0, h * 0.82, 0, 0.12], [0.07, h * 0.72, 0.03, 0.09], [-0.06, h * 0.74, -0.03, 0.09], [0.01, h * 0.95, -0.02, 0.08]];
  blobs.forEach(([dx, y, dz, r], i) => b.add(geo.dodeca(r), [C.leaf, C.leafDeep, C.leafMid, C.leaf][i], { p: [x + dx, y, z + dz], r: [R(), R() * 3, R()], s: [1, 0.8, 1] }));
  for (let i = 0; i < vines; i++) {
    const a = R() * Math.PI * 2;
    const vx = x + Math.cos(a) * 0.09, vz = z + Math.sin(a) * 0.09;
    b.tube([vx, h * 0.72, vz], [vx + (R() - 0.5) * 0.02, h * 0.72 - 0.12 - R() * 0.12, vz], 0.004, 3, C.fern);
  }
}

function fern(b: Builder, x: number, z: number, s: number, R: () => number) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + R() * 0.5;
    b.group({ p: [x, 0.005, z], r: [0, -a, 0] }, () => {
      b.add(geo.taper(0.03 * s, 0.004, 0.006 * s, 0.003, 0.11 * s), i % 2 ? C.fern : C.leafMid, { p: [0.05 * s, 0.025 * s, 0], r: [0, 0, -0.9] });
    });
  }
}

export function jungle(variant: number): Builder {
  const v = ((variant % 4) + 4) % 4;
  const R = rng(1700 + v * 29);
  const b = new Builder();
  const spots: [number, number][] = [[-0.25, -0.25], [0.24, -0.22], [0.0, 0.02], [-0.27, 0.22], [0.26, 0.24], [0.05, -0.32], [-0.05, 0.32], [0.33, 0.0], [-0.33, -0.02]];
  const order = spots.map((s, i) => ({ s, k: (i * 7 + v * 3) % spots.length })).sort((a, c) => a.k - c.k).map((o) => o.s);
  // Palmen und Laubbaeume, hoeher als normaler Wald / palms and broadleaf trees, taller than normal forest
  order.slice(0, 3).forEach(([x, z], i) => palm(b, x + (R() - 0.5) * 0.04, z + (R() - 0.5) * 0.04, 0.42 + R() * 0.18, 0.04 + R() * 0.05, R() * 6, R));
  order.slice(3, 5).forEach(([x, z]) => broadleaf(b, x, z, 0.46 + R() * 0.12, R, 3));
  // Farne, Bluetenbuesche / ferns, flowering bushes
  order.slice(5).forEach(([x, z]) => fern(b, x, z, 0.9 + R() * 0.5, R));
  for (let i = 0; i < 4; i++) {
    const a = R() * Math.PI * 2;
    const r = 0.1 + R() * 0.3;
    b.add(geo.dodeca(0.035 + R() * 0.02), i % 2 ? C.leafDeep : C.fern, { p: [Math.cos(a) * r, 0.03, Math.sin(a) * r], s: [1, 0.7, 1] });
    b.add(geo.ico(0.012, 0), i % 3 ? C.flowerRed : C.flowerYellow, { p: [Math.cos(a) * r + 0.02, 0.06, Math.sin(a) * r] });
  }
  return b;
}

