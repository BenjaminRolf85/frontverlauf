/**
 * Einheiten des Kults der Letzten Stunde (Vesper) / units of the Last Hour cult (Vesper):
 * Eiferer, Fackeltraeger, Prophet, Untergangs-Buggy, Raketenkarren, Untergangs-Raupe.
 * Zealot, torchbearer, prophet, doom buggy, rocket cart, doom crawler.
 * Zerlumpte Kutten, Knochenmasken, Blutrot, Glut, Schrott, Ketten und Glocken.
 * Ragged robes, bone masks, blood red, ember glow, scrap, chains and bells.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng, shade, type V3 } from './kit';
import { look, mat } from './look';
import { rifle, seatPose, soldier, standPose } from './soldiers';
import { antenna, commander, roofMg, tracks } from './tanks';
import { wheel } from './vehicles';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
function along(p: V3, dir: V3, t: number): V3 {
  const v = V(dir).normalize();
  return [p[0] + v.x * t, p[1] + v.y * t, p[2] + v.z * t];
}

/** Flamme entlang +z / flame along +z */
function flame(b: Builder, p: V3, dir: V3, len: number, lite: boolean) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  b.group({ p, r: [e.x, e.y, e.z] }, () => {
    b.add(geo.cone(len * 0.28, len, lite ? 6 : 10), mat.ember, { p: [0, len / 2, 0], r: [Math.PI, 0, 0] });
    b.add(geo.cone(len * 0.15, len * 0.7, lite ? 5 : 8), mat.yellow, { p: [0, len * 0.35, 0], r: [Math.PI, 0, 0] });
    if (!lite) for (let i = 0; i < 4; i++) b.add(geo.ico(len * (0.1 + i * 0.03), 0), i % 2 ? mat.ember : mat.yellow, { p: [(i - 1.5) * len * 0.08, len * (0.85 + i * 0.12), 0] });
  });
}

/** Glutlampe (Laterne) / ember lantern */
function lantern(b: Builder, p: V3, s: number) {
  b.cyl(0.014 * s, 0.016 * s, 0.008 * s, 8, mat.rustDark, [p[0], p[1], p[2]]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.box(0.004 * s, 0.04 * s, 0.004 * s, mat.rustDark, [p[0] + Math.sin(a) * 0.014 * s, p[1] + 0.022 * s, p[2] + Math.cos(a) * 0.014 * s]);
  }
  b.add(geo.ico(0.012 * s, 1), mat.ember, { p: [p[0], p[1] + 0.022 * s, p[2]] });
  b.add(geo.cone(0.02 * s, 0.018 * s, 8), mat.rustDark, { p: [p[0], p[1] + 0.05 * s, p[2]] });
}

/** Kette aus Gliedern / chain of links */
function chainLinks(b: Builder, a: V3, c: V3, n: number) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p: V3 = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.015, a[2] + (c[2] - a[2]) * t];
    b.add(geo.torus(0.006, 0.0018, 3, 6), mat.gunmetal, { p, r: [0, i % 2 ? HALF_PI : 0, 0] });
  }
}

/** Knochen / bone */
function bone(b: Builder, a: V3, c: V3) {
  b.tube(a, c, 0.004, 5, mat.bone);
  for (const p of [a, c]) b.add(geo.ico(0.007, 0), mat.bone, { p });
}

function rustPatches(b: Builder, seed: number, n: number, x: number, y0: number, y1: number, z0: number, z1: number) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    b.box(0.006, 0.02 + R() * 0.03, 0.03 + R() * 0.04, i % 3 ? mat.rustDark : mat.rust, [s * x, y0 + R() * (y1 - y0), z0 + R() * (z1 - z0)]);
  }
}

// ---------- Eiferer / zealot ----------

export function zealot(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d = lite ? 1 : 2;
  const G: V3 = [0.035, 0.2, 0.06];
  const D: V3 = [-0.3, 0.12, 1];
  soldier(b, f, {
    ...standPose([along(G, D, 0.092), G]),
    footL: [-0.05, 0.034, 0.04], footR: [0.052, 0.034, -0.035], bootR: [0, 0.35, 0],
    twist: [0, 0.45, 0], head: [0, -0.35, 0],
  }, { detail: d, robe: true, seed: 11 });
  rifle(b, G, D, { len: 0.28, detail: d });
  // Klebeband am Gewehr / tape on the rifle
  if (!lite) for (const t of [0.0, 0.14]) {
    const p = along(G, D, t);
    b.box(0.04, 0.044, 0.014, mat.paper, p, [0, -0.29, 0]);
  }
  // Untergangs-Schild auf dem Ruecken / doom placard on the back
  b.tube([0.02, 0.15, -0.09], [0.04, 0.52, -0.12], 0.006, 5, mat.wood);
  b.group({ p: [0.045, 0.47, -0.123], r: [-0.08, 0.2, 0.06] }, () => {
    b.add(lite ? geo.box(0.18, 0.12, 0.01) : geo.cbox(0.18, 0.12, 0.01, 0.012), mat.woodLight, {});
    if (!lite) for (const sy of [-1, 1]) b.box(0.19, 0.012, 0.014, mat.wood, [0, sy * 0.058, 0]);
    addEmblem(b, 'vesper', 0.048, 0.006, L.primary, { p: [0, 0, -0.006], r: [0, Math.PI, 0] });
    addEmblem(b, 'vesper', 0.048, 0.006, L.primary, { p: [0, 0, 0.006] });
  });
  // Handglocke am Strick / hand bell on a cord
  b.tube([-0.08, 0.15, 0.02], [-0.085, 0.11, 0.025], 0.002, 3, mat.wood);
  b.add(geo.hemi(0.018, 10, 3), mat.gold, { p: [-0.085, 0.09, 0.025], s: [1, 1.3, 1] });
  return b;
}

// ---------- Fackeltraeger / torchbearer ----------

export function torchbearer(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d = lite ? 1 : 2;
  const G: V3 = [0.045, 0.175, 0.07];
  const D: V3 = [-0.12, 0.02, 1];
  soldier(b, f, {
    ...standPose([along(G, D, 0.1), G]),
    footL: [-0.05, 0.034, 0.04], footR: [0.052, 0.034, -0.035], twist: [0, 0.25, 0], head: [0, -0.2, 0],
  }, { detail: d, robe: true, seed: 21 });
  // Flammenwerfer-Rohr / flamethrower wand
  const back = along(G, D, -0.06);
  const tip = along(G, D, 0.24);
  b.tube(back, tip, 0.011, lite ? 6 : 10, mat.rust);
  b.add(geo.cbox(0.03, 0.035, 0.08, 0.008), mat.rustDark, { p: along(G, D, 0.02) });
  b.cyl(0.016, 0.014, 0.03, 8, mat.dark, along(G, D, 0.245), [HALF_PI, -0.12, 0]);
  flame(b, along(G, D, 0.26), D, lite ? 0.13 : 0.19, lite);
  // rostige Tanks auf dem Ruecken / rusty tanks on the back
  for (const sx of [-1, 1]) {
    b.cyl(0.028, 0.028, 0.13, lite ? 8 : 12, sx > 0 ? mat.rust : L.primaryDark, [sx * 0.032, 0.24, -0.1]);
    b.add(geo.hemi(0.028, lite ? 8 : 12, 3), mat.rustDark, { p: [sx * 0.032, 0.305, -0.1] });
    if (!lite) b.cyl(0.006, 0.006, 0.02, 6, mat.metal, [sx * 0.032, 0.335, -0.1]);
    b.add(geo.cyl(0.029, 0.029, 0.01, lite ? 8 : 12, true), mat.ember, { p: [sx * 0.032, 0.22, -0.1] });
  }
  // Schlauch / hose
  const hose: V3[] = [[0.03, 0.18, -0.1], [0.09, 0.12, -0.05], [0.09, 0.13, 0.02], back];
  for (let i = 0; i < hose.length - 1; i++) b.tube(hose[i], hose[i + 1], 0.007, 6, mat.dark);
  // Gasmasken-Filter / gas mask filter
  b.cyl(0.016, 0.018, 0.03, 8, mat.rustDark, [0.01, 0.335, 0.09], [HALF_PI, 0, 0]);
  b.cyl(0.012, 0.012, 0.006, 8, mat.dark, [0.01, 0.335, 0.107], [HALF_PI, 0, 0]);
  return b;
}

// ---------- Prophet ----------

export function prophet(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d = lite ? 1 : 2;
  b.group({ s: 1.12 }, () => {
    soldier(b, f, {
      ...standPose([[-0.06, 0.2, 0.1], [0.12, 0.22, 0.04]]),
      head: [0.1, 0, 0],
    }, { detail: d, robe: true, seed: 31 });
    // Stab mit Glutlaterne / staff with ember lantern
    b.tube([0.13, 0.0, 0.05], [0.12, 0.5, 0.035], 0.008, 6, mat.wood);
    b.tube([0.12, 0.5, 0.035], [0.15, 0.53, 0.035], 0.006, 5, mat.wood);
    b.tube([0.15, 0.53, 0.035], [0.15, 0.505, 0.035], 0.002, 3, mat.dark);
    lantern(b, [0.15, 0.44, 0.035], 1.5);
    // heiliges Buch / holy book
    b.add(geo.rbox(0.07, 0.016, 0.055, 0.004), L.primaryDark, { p: [-0.06, 0.205, 0.11], r: [0.5, 0.2, 0] });
    b.add(geo.box(0.064, 0.012, 0.05), mat.bone, { p: [-0.06, 0.212, 0.107], r: [0.5, 0.2, 0] });
    // Mitra-Hut mit Sonnenzeichen / mitre-like hat with sun mark
    b.add(geo.taper(0.09, 0.07, 0.03, 0.03, 0.1), L.primary, { p: [0, 0.48, 0.0] });
    b.box(0.092, 0.012, 0.072, mat.ember, [0, 0.44, 0.0]);
    addEmblem(b, 'vesper', 0.022, 0.004, mat.bone, { p: [0, 0.49, 0.03], r: [-0.18, 0, 0] });
    // rote Stola / red stole
    for (const sx of [-1, 1]) {
      b.box(0.024, 0.2, 0.008, L.primary, [sx * 0.035, 0.2, 0.06], [0, 0, sx * 0.05]);
      b.box(0.026, 0.014, 0.01, mat.ember, [sx * 0.04, 0.105, 0.061]);
    }
    if (!lite) chainLinks(b, [-0.06, 0.29, 0.055], [0.06, 0.29, 0.055], 6);
  });
  return b;
}

// ---------- Untergangs-Buggy / doom buggy ----------

export function doomBuggy(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const wr = 0.07;
  for (const sx of [-1, 1]) for (const z of [-0.13, 0.14]) {
    wheel(b, sx * 0.13, wr, z, wr, 0.05, { rim: L.trim, lite, seg: 12 });
  }
  const cy = wr + 0.01;
  b.box(0.2, 0.03, 0.38, mat.rustDark, [0, cy, 0]);
  const by = cy + 0.015;
  // Wanne + Haube / tub + hood
  b.add(geo.profileZY([[-0.17, 0], [0.18, 0], [0.2, 0.03], [0.12, 0.06], [-0.05, 0.06], [-0.1, 0.07], [-0.18, 0.07]], 0.22), L.hull, { p: [0, by, 0] });
  addEmblem(b, 'vesper', 0.045, 0.006, mat.bone, { p: [0, by + 0.052, 0.11], r: [-HALF_PI + 0.35, 0, 0] });
  if (!lite) rustPatches(b, 5, 6, 0.112, by + 0.01, by + 0.05, -0.15, 0.15);
  // Ueberrollkaefig / roll cage
  const top = by + 0.2;
  for (const sx of [-1, 1]) {
    b.tube([sx * 0.1, by + 0.05, 0.05], [sx * 0.085, top, 0.0], 0.007, 6, mat.gunmetal);
    b.tube([sx * 0.1, by + 0.06, -0.15], [sx * 0.085, top, -0.1], 0.007, 6, mat.gunmetal);
    b.tube([sx * 0.085, top, 0.0], [sx * 0.085, top, -0.1], 0.007, 6, mat.gunmetal);
  }
  b.tube([-0.085, top, 0.0], [0.085, top, 0.0], 0.007, 6, mat.gunmetal);
  b.tube([-0.085, top, -0.1], [0.085, top, -0.1], 0.007, 6, mat.gunmetal);
  b.tube([-0.085, top, 0.0], [0.085, top, -0.1], 0.006, 5, mat.gunmetal);
  // Fahrer + Dach-MG / driver + roof MG
  if (!lite) b.group({ p: [-0.045, by - 0.055, -0.04], s: 0.75 }, () => soldier(b, f, seatPose([[-0.045, 0.125, 0.11], [0.045, 0.125, 0.11]]), { detail: 0, seed: 3, noLegs: true }));
  roofMg(b, L, 0.03, top, -0.05, L.primary);
  // Stachelbuegel vorn / spiked front bar
  b.box(0.26, 0.02, 0.02, mat.gunmetal, [0, by + 0.01, 0.2]);
  for (let i = 0; i < 5; i++) b.add(geo.cone(0.012, 0.05, lite ? 4 : 6), mat.bone, { p: [-0.1 + i * 0.05, by + 0.01, 0.235], r: [HALF_PI, 0, 0] });
  // Auspuffe mit Glut / exhausts with ember glow
  for (const sx of [-1, 1]) {
    b.tube([sx * 0.07, by + 0.05, -0.17], [sx * 0.08, by + 0.17, -0.2], 0.01, 6, mat.rust);
    b.add(geo.ico(0.014, 0), mat.ember, { p: [sx * 0.08, by + 0.18, -0.2] });
  }
  if (!lite) {
    // Ketten, Knochen, Ersatzreifen, Banner / chains, bones, spare tyre, banner
    chainLinks(b, [-0.085, top, 0.0], [-0.1, by + 0.06, 0.05], 6);
    chainLinks(b, [0.085, top, -0.1], [0.1, by + 0.07, -0.15], 6);
    bone(b, [0.06, top + 0.004, -0.004], [0.06, top - 0.05, 0.02]);
    bone(b, [-0.06, top + 0.004, -0.096], [-0.03, top - 0.05, -0.11]);
    b.group({ p: [0, by + 0.06, -0.205], r: [0, HALF_PI, 0] }, () => wheel(b, 0, 0, 0, 0.05, 0.03, { rim: L.trim }));
    b.tube([-0.09, by + 0.07, -0.17], [-0.09, top + 0.12, -0.18], 0.004, 4, mat.wood);
    b.box(0.006, 0.07, 0.06, L.primary, [-0.09, top + 0.08, -0.15]);
  }
  return b;
}

// ---------- Raketenkarren / rocket cart ----------

export function rocketCart(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const wr = 0.06;
  for (const sx of [-1, 1]) for (const z of [-0.14, 0.13]) wheel(b, sx * 0.125, wr, z, wr, 0.045, { rim: L.trim, lite, seg: 12 });
  const cy = wr + 0.01;
  b.box(0.2, 0.03, 0.4, mat.rustDark, [0, cy, 0]);
  const by = cy + 0.015;
  // Fuehrerhaus + Haube / cab + hood
  b.add(geo.cbox(0.22, 0.06, 0.12, 0.012), L.hull, { p: [0, by + 0.03, 0.14] });
  b.add(geo.rbox(0.22, 0.09, 0.1, 0.014), L.hull, { p: [0, by + 0.105, 0.04] });
  // Panzerschlitze statt Fenster / armour slits instead of windows
  b.box(0.18, 0.04, 0.006, mat.dark, [0, by + 0.115, 0.093]);
  for (let i = 0; i < 4; i++) b.box(0.18, 0.006, 0.008, mat.rust, [0, by + 0.1 + i * 0.012, 0.094]);
  for (const sx of [-1, 1]) {
    b.box(0.006, 0.04, 0.06, mat.dark, [sx * 0.112, by + 0.115, 0.04]);
    addEmblem(b, 'vesper', 0.024, 0.005, mat.bone, { p: [sx * 0.112, by + 0.04, 0.04], r: [0, sx * HALF_PI, 0] });
  }
  // Ladeflaeche / bed
  b.block(0, by, -0.1, 0.22, 0.012, 0.2, mat.rustDark);
  for (const sx of [-1, 1]) b.block(sx * 0.105, by, -0.1, 0.012, 0.05, 0.2, L.hull);
  b.block(0, by, -0.198, 0.22, 0.05, 0.012, L.hull);
  // Raketengestell aus Rohren / rocket rack from pipes
  b.group({ p: [0, by + 0.14, -0.09], r: [-0.4, 0, 0] }, () => {
    b.box(0.18, 0.01, 0.17, mat.gunmetal, [0, -0.035, 0]);
    for (const sx of [-1, 1]) b.box(0.01, 0.08, 0.17, mat.gunmetal, [sx * 0.085, 0.0, 0]);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const x = -0.05 + c * 0.05, y = -0.012 + r * 0.04;
      b.cyl(0.018, 0.018, 0.17, lite ? 6 : 10, (r + c) % 2 ? mat.rust : shade(mat.rust, 1.25), [x, y, 0], [HALF_PI, 0, 0]);
      if (!lite) b.add(geo.cyl(0.019, 0.019, 0.012, 10, true), mat.rustDark, { p: [x, y, 0.06], r: [HALF_PI, 0, 0] });
      b.add(geo.cone(0.013, 0.04, lite ? 5 : 8), (r + c) % 2 ? L.primary : mat.ember, { p: [x, y, 0.1], r: [HALF_PI, 0, 0] });
    }
  });
  b.cyl(0.014, 0.018, 0.12, 6, mat.gunmetal, [0, by + 0.06, -0.1]);
  if (!lite) {
    // Fahrer, Banner, Kisten, Stossstange / driver, banners, crates, bumper
    for (const sx of [-1, 1]) {
      b.tube([sx * 0.1, by + 0.05, -0.19], [sx * 0.1, by + 0.27, -0.2], 0.004, 4, mat.wood);
      b.box(0.006, 0.09, 0.05, L.primary, [sx * 0.1, by + 0.22, -0.172]);
      b.add(geo.profileZY([[0, 0], [0.025, -0.02], [0.05, 0]], 0.006), L.primary, { p: [sx * 0.1, by + 0.175, -0.197] });
    }
    b.add(geo.cbox(0.24, 0.022, 0.02, 0.005), mat.gunmetal, { p: [0, cy, 0.21] });
    for (let i = 0; i < 3; i++) b.add(geo.cone(0.01, 0.04, 6), mat.bone, { p: [-0.08 + i * 0.08, cy, 0.235], r: [HALF_PI, 0, 0] });
    rustPatches(b, 9, 5, 0.112, by + 0.02, by + 0.08, -0.18, 0.18);
    antenna(b, 0.08, by + 0.15, 0.02, 0.15, mat.ember);
    // Ersatzrad, Suchscheinwerfer, Auspuffe, Kisten, Ketten / spare wheel, searchlight, exhausts, crates, chains
    b.group({ p: [-0.122, by + 0.06, 0.13], r: [0, 0, HALF_PI] }, () => wheel(b, 0, 0, 0, 0.045, 0.025, { rim: L.trim }));
    b.cyl(0.016, 0.018, 0.022, 10, mat.gunmetal, [0.06, by + 0.16, 0.06], [HALF_PI - 0.3, 0, 0]);
    b.cyl(0.013, 0.013, 0.004, 10, mat.yellow, [0.06, by + 0.164, 0.073], [HALF_PI - 0.3, 0, 0]);
    for (const sx of [-1, 1]) {
      b.tube([sx * 0.112, by + 0.03, -0.02], [sx * 0.118, by + 0.16, -0.03], 0.008, 6, mat.rust);
      b.add(geo.ico(0.012, 0), mat.ember, { p: [sx * 0.118, by + 0.168, -0.03] });
      chainLinks(b, [sx * 0.112, by + 0.05, 0.1], [sx * 0.112, by + 0.04, 0.17], 5);
    }
    b.add(geo.cbox(0.05, 0.035, 0.04, 0.006), mat.woodLight, { p: [0.07, by + 0.03, -0.17] });
    b.add(geo.cbox(0.04, 0.03, 0.035, 0.006), L.primaryDark, { p: [-0.07, by + 0.028, -0.17] });
    rustPatches(b, 19, 6, 0.112, by + 0.02, by + 0.1, -0.18, 0.15);
  }
  return b;
}

// ---------- Untergangs-Raupe / doom crawler ----------

export function doomCrawler(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  tracks(b, { x: 0.15, w: 0.1, len: 0.4, h: 0.11, wheels: 5, wr: 0.04, sprocket: L.trim, hub: mat.rustDark, lite, links: 10 });
  // gepanzerter Rumpf / armoured hull
  b.add(geo.cbox(0.24, 0.12, 0.38, 0.02), L.hull, { p: [0, 0.13, -0.02] });
  b.add(geo.cbox(0.4, 0.02, 0.4, 0.02), mat.rustDark, { p: [0, 0.12, -0.02] });
  for (const sx of [-1, 1]) b.add(geo.cbox(0.02, 0.06, 0.36, 0.006), L.hull, { p: [sx * 0.2, 0.1, -0.02] });
  if (!lite) {
    rustPatches(b, 13, 6, 0.211, 0.08, 0.12, -0.18, 0.15);
    for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) b.box(0.006, 0.006, 0.006, mat.gunmetal, [sx * 0.211, 0.123, -0.16 + i * 0.07]);
  }
  // riesige Stachelschaufel / giant spiked blade
  const bz = 0.2;
  b.add(geo.profileZY([[0, 0.0], [0.035, 0.0], [0.05, 0.05], [0.04, 0.13], [0.02, 0.17], [0.0, 0.16], [0.018, 0.12], [0.025, 0.05]], 0.44), mat.rustDark, { p: [0, 0.005, bz] });
  b.box(0.44, 0.012, 0.03, mat.bone, [0, 0.008, bz + 0.035]);
  for (let i = 0; i < 7; i++) b.add(geo.cone(0.016, 0.07, lite ? 4 : 8), mat.bone, { p: [-0.18 + i * 0.06, 0.09 + (i % 2) * 0.03, bz + 0.07], r: [HALF_PI, 0, 0] });
  for (const sx of [-1, 1]) b.box(0.03, 0.03, 0.12, mat.gunmetal, [sx * 0.11, 0.1, bz - 0.04], [0.3, 0, 0]);
  addEmblem(b, 'vesper', 0.06, 0.006, mat.ember, { p: [0, 0.1, bz + 0.035], r: [-0.25, 0, 0] });
  // Fuehrerhaus mit Glutschlitzen / cab with ember slits
  b.add(geo.cbox(0.16, 0.08, 0.11, 0.016), L.hull, { p: [0, 0.23, 0.07] });
  b.box(0.12, 0.012, 0.006, mat.ember, [0, 0.245, 0.127]);
  // Glockenturm + Untergangsbanner / bell tower + doom banner
  const tz = -0.06, ty = 0.19;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.012, 0.14, 0.012, mat.wood, [sx * 0.045, ty + 0.07, tz + sz * 0.045]);
  b.add(geo.cone(0.085, 0.07, 4).rotateY(Math.PI / 4), L.primaryDark, { p: [0, ty + 0.175, tz] });
  b.add(geo.hemi(0.03, lite ? 8 : 12, 3), mat.gold, { p: [0, ty + 0.13, tz], r: [Math.PI, 0, 0], s: [1, 1.4, 1] });
  b.add(geo.cyl(0.032, 0.032, 0.006, lite ? 8 : 12, true), shade(mat.gold, 0.7), { p: [0, ty + 0.088, tz] });
  b.tube([0, ty + 0.21, tz], [0, ty + 0.36, tz], 0.005, 5, mat.wood);
  b.box(0.11, 0.008, 0.008, mat.wood, [0.05, ty + 0.35, tz]);
  b.box(0.1, 0.12, 0.006, L.primary, [0.055, ty + 0.285, tz]);
  addEmblem(b, 'vesper', 0.032, 0.012, mat.bone, { p: [0.055, ty + 0.29, tz] });
  // Schlote mit Glut und Rauch / smoke stacks with ember and smoke
  for (const sx of [-1, 1]) {
    b.cyl(0.02, 0.025, 0.16, lite ? 6 : 10, mat.rust, [sx * 0.08, 0.27, -0.17]);
    b.add(geo.cyl(0.022, 0.022, 0.012, lite ? 6 : 10, true), mat.ember, { p: [sx * 0.08, 0.35, -0.17] });
    if (!lite) {
      b.add(geo.ico(0.03, 1), mat.cloudShade, { p: [sx * 0.08, 0.39, -0.18] });
      b.add(geo.ico(0.022, 0), mix(mat.cloudShade, mat.ink, 0.3), { p: [sx * 0.09, 0.43, -0.2] });
    }
  }
  if (!lite) {
    // Ketten, Knochen, Kultist im Luk / chains, bones, cultist in the hatch
    chainLinks(b, [-0.2, 0.15, 0.15], [-0.2, 0.12, -0.05], 6);
    chainLinks(b, [0.2, 0.15, 0.15], [0.2, 0.12, -0.05], 6);
    bone(b, [-0.12, 0.2, 0.17], [-0.06, 0.2, 0.17]);
    bone(b, [0.06, 0.21, 0.17], [0.12, 0.2, 0.17]);
    commander(b, f, 0.08, 0.2, -0.02, 9);
    b.cyl(0.03, 0.034, 0.02, 10, L.hullDark, [0.08, 0.2, -0.02]);
    roofMg(b, L, -0.09, 0.19, 0.05, L.primary);
  }
  return b;
}

