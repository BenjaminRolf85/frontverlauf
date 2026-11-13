/**
 * Konter-Einheiten / counter units:
 * Panzerabwehr-Trupp (grosses Raketenrohr), Flakpanzer (Zwillings-/Vierlingsflak nach oben), Minenleger (Raeumschild + Minengestell),
 * Kult-Panzerfaust-Eiferer, NEXUS-Flak-Drohne und die verdeckte Mine (nur fuer den Besitzer sichtbar).
 * Anti-tank squad (big rocket tube), AA vehicle (twin/quad guns pointing up), mine layer (plough + mine rack),
 * cult rocket zealot, NEXUS flak drone and the hidden mine (visible to its owner only).
 * Klare Silhouetten fuer die Lesbarkeit auf der Karte / clear silhouettes for readability on the map.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { semantic } from '../../design/tokens';
import { dish } from './architecture';
import { addEmblem } from './emblems';
import { Builder, col, geo, rng, shade, type ColorLike, type V3 } from './kit';
import { look, mat, styleOf, type Look } from './look';
import { kneelPose, soldier } from './soldiers';
import { antenna, commander, tracks } from './tanks';
import { wheel } from './vehicles';

const HALF_PI = Math.PI / 2;

/** Warnstreifen schraeg ueber eine Flaeche (Blick +z) / hazard stripes across a face (facing +z) */
function hazardStripes(b: Builder, x: number, y: number, z: number, w: number, h: number, n: number, rx = 0) {
  b.group({ p: [x, y, z], r: [rx, 0, 0] }, () => {
    b.box(w, h, 0.006, mat.ink, [0, 0, 0]);
    for (let i = 0; i < n; i++) b.box(w / (n * 2), h * 1.25, 0.008, mat.yellow, [-w / 2 + (i + 0.5) * (w / n), 0, 0.001], [0, 0, 0.6]);
  });
}

/** Emblem beidseitig / emblem on both sides */
function sideEmblems(b: Builder, f: FactionId, L: Look, x: number, y: number, z: number, size: number) {
  addEmblem(b, f, size, 0.006, L.emblem, { p: [x, y, z], r: [0, HALF_PI, 0] });
  addEmblem(b, f, size, 0.006, L.emblem, { p: [-x, y, z], r: [0, -HALF_PI, 0] });
}

// ---------- Raketenrohr / rocket tube ----------

interface TubeOpts { r: number; len: number; c: ColorLike; band: ColorLike; style: 'korvat' | 'dravon' | 'alvenia' | 'meridon' | 'velkar' | 'cult'; lite: boolean }

/** Schultergestuetztes Raketenrohr, Mitte bei p, Richtung +z (in der Gruppe) / shoulder rocket tube, centre at p, along +z */
function rocketTube(b: Builder, p: V3, pitch: number, o: TubeOpts) {
  const seg = o.lite ? 8 : 12;
  b.group({ p, r: [pitch, 0, 0] }, () => {
    if (o.style === 'velkar') {
      // eckiges Hightech-Rohr mit Sensorkasten / square hi-tech tube with sensor box
      b.add(o.lite ? geo.box(o.r * 2, o.r * 2, o.len) : geo.cbox(o.r * 2, o.r * 2, o.len, o.r * 0.4), o.c, {});
      b.box(o.r * 2.1, o.r * 0.5, o.len * 0.92, o.band, [0, o.r * 0.9, 0]);
    } else {
      b.cyl(o.r, o.r, o.len, seg, o.c, [0, 0, 0], [HALF_PI, 0, 0]);
    }
    // Muendung mit Gefechtskopf / muzzle with warhead
    const warhead = o.style === 'cult' ? mat.rust : o.style === 'dravon' ? o.band : shade(o.c, 0.7);
    b.cyl(o.r * 1.08, o.r * 1.08, 0.02, seg, mat.dark, [0, 0, o.len / 2 - 0.01], [HALF_PI, 0, 0]);
    b.cyl(o.r * 0.95, o.r * 1.25, o.r * 2, seg, warhead, [0, 0, o.len / 2 + o.r], [HALF_PI, 0, 0]);
    b.add(geo.cone(o.r * 1.25, o.r * 2.6, seg), warhead, { p: [0, 0, o.len / 2 + o.r * 3.3], r: [HALF_PI, 0, 0] });
    // Trichter hinten / rear flare
    b.add(geo.cyl(o.r * 1.45, o.r, 0.05, seg, true), mat.dark, { p: [0, 0, -o.len / 2 - 0.02], r: [HALF_PI, 0, 0] });
    if (o.style === 'alvenia') {
      b.add(geo.torus(o.r * 1.02, o.r * 0.18, 4, seg), o.band, { p: [0, 0, -o.len * 0.15] });
      b.add(geo.torus(o.r * 1.02, o.r * 0.18, 4, seg), o.band, { p: [0, 0, o.len * 0.2] });
    } else if (o.style === 'meridon') {
      hazardStripes(b, 0, o.r * 0.6, -o.len * 0.32, o.r * 1.6, o.r * 0.9, 3, -HALF_PI);
    } else if (o.style !== 'velkar') {
      for (const t of [-0.22, 0.18]) b.cyl(o.r * 1.12, o.r * 1.12, 0.018, seg, o.band, [0, 0, o.len * t], [HALF_PI, 0, 0]);
    }
    // Visier + Griffe / sight + grips
    b.add(geo.cbox(0.02, 0.026, 0.04, 0.005), mat.dark, { p: [-o.r - 0.012, o.r * 0.4, o.len * 0.08] });
    if (!o.lite) b.cyl(0.008, 0.008, 0.006, 6, mat.glass, [-o.r - 0.012, o.r * 0.4, o.len * 0.08 + 0.022], [HALF_PI, 0, 0]);
    b.box(0.014, 0.04, 0.016, mat.dark, [0, -o.r - 0.016, 0.02], [0.3, 0, 0]);
    b.box(0.014, 0.034, 0.016, mat.dark, [0, -o.r - 0.014, o.len * 0.24], [0.2, 0, 0]);
    if (o.style === 'cult' && !o.lite) {
      // Klebeband und Knochen-Glocke / tape and bone bell
      b.box(o.r * 2.2, o.r * 2.2, 0.03, mat.paper, [0, 0, -o.len * 0.05]);
      b.add(geo.hemi(o.r * 0.6, 8, 3), mat.gold, { p: [o.r * 1.2, -o.r * 1.4, -o.len * 0.3], s: [1, 1.3, 1] });
    }
  });
}

/** Ersatzrakete (liegend) / spare rocket (lying) */
function spareRocket(b: Builder, p: V3, ry: number, r: number, c: ColorLike, lite: boolean) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.cyl(r, r, 0.1, lite ? 6 : 8, c, [0, r, 0], [HALF_PI, 0, 0]);
    b.add(geo.cone(r, r * 2.2, lite ? 6 : 8), mat.dark, { p: [0, r, 0.05 + r * 1.1], r: [HALF_PI, 0, 0] });
    if (!lite) for (const s of [-1, 1]) b.box(0.004, r * 2.6, 0.02, mat.dark, [s * r * 0.7, r, -0.045]);
  });
}

// ---------- Panzerabwehr-Trupp / anti-tank squad ----------

export function antiTank(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const st = styleOf(f);
  // Schuetze kniend, Rohr auf der rechten Schulter, leicht nach oben / gunner kneeling, tube on the right shoulder, slightly raised
  const pitch = -0.12;
  const tubeR = st === 'dravon' ? 0.034 : 0.028;
  const tubeLen = st === 'dravon' ? 0.46 : 0.42;
  const sy = 0.262, sx = 0.075, sz = 0.0;
  b.group({ p: [0.02, 0, -0.02] }, () => {
    soldier(b, f, {
      ...kneelPose([[0.05, 0.24, 0.13], [0.07, 0.215, 0.03]]),
      head: [0.15, -0.15, 0],
      elbowPoleL: [-0.6, -1, 0.3],
      elbowPoleR: [0.8, -1, 0],
    }, { detail: lite ? 0 : 1, seed: 71 });
    rocketTube(b, [sx, sy, sz], pitch, { r: tubeR, len: tubeLen, c: st === 'velkar' ? L.hullDark : L.hull, band: L.secondary, style: st, lite });
  });
  // Ladeschuetze mit Rakete / loader with a rocket
  if (!lite) {
    b.group({ p: [-0.17, 0, -0.1], r: [0, 0.6, 0] }, () => {
      soldier(b, f, kneelPose([[-0.035, 0.16, 0.11], [0.04, 0.16, 0.11]]), { detail: 0, pack: 'pack', seed: 73 });
      b.group({ p: [0, 0.16, 0.12], r: [0, HALF_PI, 0] }, () => {
        b.cyl(0.02, 0.02, 0.1, 8, L.hull, [0, 0, 0], [HALF_PI, 0, 0]);
        b.add(geo.cone(0.024, 0.05, 8), mat.dark, { p: [0, 0, 0.075], r: [HALF_PI, 0, 0] });
      });
    });
  }
  // Raketenkiste mit Ersatzraketen / rocket crate with spares
  b.add(geo.cbox(0.1, 0.035, 0.07, 0.008), mat.wood, { p: [-0.13, 0.018, 0.14] });
  spareRocket(b, [-0.155, 0.035, 0.14], 0.1, 0.016, L.hull, lite);
  if (!lite) spareRocket(b, [-0.105, 0.035, 0.14], 0.1, 0.016, L.hull, lite);
  if (!lite) addEmblem(b, f, 0.022, 0.005, L.emblem, { p: [-0.13, 0.02, 0.177] });
  return b;
}

// ---------- Flakpanzer / anti-aircraft vehicle ----------

/** Flakrohre nach oben (Gruppe am Drehpunkt) / AA barrels pointing up (group at the pivot) */
function aaGuns(b: Builder, L: Look, n: 2 | 4, len: number, r: number, spread: number, lite: boolean, glow?: ColorLike) {
  const seg = lite ? 6 : 8;
  // Wiege / cradle
  b.add(lite ? geo.box(spread * 2 + 0.05, 0.05, 0.08) : geo.cbox(spread * 2 + 0.05, 0.05, 0.08, 0.01), L.hullDark, {});
  const xs = n === 2 ? [-spread, spread] : [-spread, spread];
  const ys = n === 2 ? [0] : [-0.018, 0.022];
  for (const x of xs) for (const y of ys) {
    b.cyl(r * 1.6, r * 1.6, 0.06, seg, mat.dark, [x, y, 0.05], [HALF_PI, 0, 0]);
    b.cyl(r, r, len, seg, mat.dark, [x, y, 0.05 + len / 2], [HALF_PI, 0, 0]);
    b.cyl(r * 1.5, r * 1.3, 0.03, seg, glow ?? mat.metal, [x, y, 0.05 + len], [HALF_PI, 0, 0]);
  }
  if (!lite) for (const s of [-1, 1]) b.add(geo.cbox(0.03, 0.05, 0.06, 0.006), L.gear, { p: [s * (spread + 0.05), -0.02, -0.01] });
}

export function antiAir(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const st = styleOf(f);
  let top = 0.15;
  if (st === 'meridon') {
    // leichter Lastwagen mit Vierlingsflak auf der Ladeflaeche / light truck with quad AA on the bed
    const wr = 0.058;
    for (const sx of [-1, 1]) for (const z of [-0.15, 0.02, 0.16]) wheel(b, sx * 0.13, wr, z, wr, 0.045, { rim: L.trim, lite });
    b.box(0.22, 0.03, 0.42, L.hullDark, [0, wr + 0.01, 0]);
    b.block(0, wr + 0.025, 0.16, 0.22, 0.1, 0.1, L.hull);
    b.box(0.2, 0.04, 0.006, mat.glass, [0, wr + 0.1, 0.212], [-0.2, 0, 0]);
    b.block(0, wr + 0.025, -0.06, 0.26, 0.03, 0.3, L.trim);
    hazardStripes(b, 0, wr + 0.04, -0.212, 0.24, 0.024, 4);
    top = wr + 0.055;
  } else {
    tracks(b, { x: 0.13, w: 0.07, len: 0.42, h: 0.085, wheels: 5, wr: 0.026, sprocket: L.trim, hub: L.secondary, lite, links: 9 });
    switch (st) {
      case 'korvat':
        b.block(0, 0.06, 0, 0.27, 0.08, 0.42, L.hull);
        b.block(0, 0.14, 0.17, 0.25, 0.012, 0.06, shade(L.hull, 0.85));
        if (!lite) for (const z of [-0.15, -0.05, 0.05, 0.15]) for (const s of [-1, 1]) b.add(geo.sphere(0.006, 5, 3), mat.dark, { p: [s * 0.136, 0.12, z] });
        break;
      case 'dravon':
        b.add(geo.profileZY([[-0.21, 0], [0.2, 0], [0.23, 0.04], [0.1, 0.09], [-0.19, 0.09], [-0.22, 0.05]], 0.27), L.hull, { p: [0, 0.06, 0] });
        for (const s of [-1, 1]) b.box(0.012, 0.012, 0.4, L.trim, [s * 0.136, 0.13, 0]);
        break;
      case 'alvenia':
        b.add(geo.rtaper(0.28, 0.42, 0.24, 0.36, 0.085, 0.03), L.hull, { p: [0, 0.1, 0] });
        b.box(0.03, 0.006, 0.36, L.trim, [0, 0.145, 0]);
        break;
      default:
        // velkar: kompakt, schraege Platten, Schuerzen, Schneeflecken / compact, sloped plates, skirts, snow patches
        b.add(geo.rtaper(0.28, 0.42, 0.22, 0.32, 0.085, 0.014, -0.01), L.hull, { p: [0, 0.1, 0] });
        for (const s of [-1, 1]) b.block(s * 0.17, 0.035, 0, 0.012, 0.06, 0.4, L.hullDark);
        if (!lite) {
          const R = rng(9);
          for (let i = 0; i < 6; i++) b.box(0.006, 0.02 + R() * 0.02, 0.03 + R() * 0.03, mat.snow, [(i % 2 ? 1 : -1) * 0.178, 0.05 + R() * 0.03, -0.15 + R() * 0.3]);
        }
        break;
    }
    if (!lite) sideEmblems(b, f, L, st === 'velkar' ? 0.18 : 0.138, 0.1, 0.1, 0.03);
  }
  // offener Drehturm mit Seitenschilden / open turret with side shields
  const tz = st === 'meridon' ? -0.07 : -0.03;
  b.cyl(0.09, 0.1, 0.025, lite ? 8 : 12, L.hullDark, [0, top + 0.012, tz]);
  b.block(0, top + 0.02, tz, 0.2, 0.04, 0.16, L.hull);
  for (const s of [-1, 1]) {
    if (st === 'alvenia') b.add(geo.rtaper(0.014, 0.16, 0.014, 0.1, 0.09, 0.006), L.hull, { p: [s * 0.105, top + 0.1, tz] });
    else b.add(geo.taper(0.014, 0.16, 0.014, 0.1, 0.09, 0.0), L.hull, { p: [s * 0.105, top + 0.1, tz] });
    if (st === 'dravon') b.box(0.016, 0.012, 0.16, L.trim, [s * 0.105, top + 0.06, tz]);
  }
  const quad = st === 'korvat' || st === 'meridon';
  const dravon = st === 'dravon';
  b.group({ p: [0, top + 0.1, tz], r: [-0.95, 0, 0] }, () => {
    aaGuns(b, L, quad ? 4 : 2, dravon ? 0.3 : 0.24, dravon ? 0.013 : 0.01, quad ? 0.04 : 0.045, lite, st === 'velkar' ? L.secondary : undefined);
  });
  // Visier / sight
  b.add(geo.cbox(0.03, 0.03, 0.03, 0.006), mat.dark, { p: [-0.07, top + 0.14, tz + 0.03] });
  if (!lite) {
    // Radar hinten / radar at the rear
    if (st === 'alvenia' || st === 'velkar') dish(b, 0.06, top + 0.03, tz - 0.12, 0.05, -0.5, st === 'velkar' ? L.hullDark : mat.white);
    else {
      b.tube([0.07, top + 0.03, tz - 0.11], [0.07, top + 0.13, tz - 0.11], 0.006, 5, mat.dark);
      b.box(0.11, 0.035, 0.008, mat.metal, [0.07, top + 0.145, tz - 0.11], [0, 0.4, 0]);
      for (let i = 0; i < 4; i++) b.box(0.004, 0.035, 0.01, mat.dark, [0.03 + i * 0.027, top + 0.145, tz - 0.105], [0, 0.4, 0]);
    }
    antenna(b, -0.08, top + 0.04, tz - 0.08, 0.13, L.secondary);
    // Munitionsgurte / ammo belts
    for (let i = 0; i < 5; i++) b.box(0.01, 0.022, 0.008, mat.gold, [-0.06 + i * 0.012, top + 0.055, tz + 0.085]);
  }
  return b;
}

// ---------- Minenleger / mine layer ----------

/** Tellermine / disc mine */
function discMine(b: Builder, p: V3, r: number, body: ColorLike, cap: ColorLike, lite: boolean) {
  b.cyl(r, r * 1.05, r * 0.42, lite ? 6 : 8, body, p);
  b.cyl(r * 0.45, r * 0.5, r * 0.18, lite ? 6 : 8, cap, [p[0], p[1] + r * 0.28, p[2]]);
  if (!lite) b.cyl(r * 0.12, r * 0.12, r * 0.18, 5, mat.dark, [p[0], p[1] + r * 0.42, p[2]]);
}

export function mineLayer(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const st = styleOf(f);
  tracks(b, { x: 0.125, w: 0.065, len: 0.36, h: 0.08, wheels: 4, wr: 0.026, sprocket: L.trim, hub: L.secondary, lite, links: 8 });
  // Wanne / hull
  switch (st) {
    case 'dravon':
      b.add(geo.profileZY([[-0.18, 0], [0.17, 0], [0.19, 0.035], [0.06, 0.075], [-0.17, 0.08], [-0.19, 0.04]], 0.25), L.hull, { p: [0, 0.06, -0.01] });
      break;
    case 'alvenia':
      b.add(geo.rtaper(0.26, 0.36, 0.22, 0.3, 0.08, 0.028), L.hull, { p: [0, 0.1, -0.01] });
      break;
    case 'velkar':
      b.add(geo.rtaper(0.27, 0.36, 0.21, 0.28, 0.08, 0.012, 0.01), L.hull, { p: [0, 0.1, -0.01] });
      for (const s of [-1, 1]) b.block(s * 0.163, 0.035, -0.01, 0.012, 0.055, 0.34, L.hullDark);
      break;
    default:
      b.block(0, 0.06, -0.01, 0.25, 0.08, 0.36, L.hull);
      if (st === 'meridon') for (const z of [-0.12, -0.06, 0.0]) b.block(0, 0.062, z, 0.254, 0.076, 0.008, shade(L.hull, 0.8));
      break;
  }
  // Fahrerhaus vorn / cab at the front
  const top = 0.14;
  b.add(lite ? geo.box(0.16, 0.07, 0.1) : geo.cbox(0.16, 0.07, 0.1, 0.012), L.hullDark, { p: [0, top + 0.035, 0.08] });
  b.box(0.13, 0.03, 0.006, mat.glass, [0, top + 0.045, 0.132], [-0.15, 0, 0]);
  if (!lite) commander(b, f, -0.04, top + 0.075, 0.06, 81);
  // Raeumschild vorn mit Warnstreifen / mine plough at the front with hazard stripes
  b.group({ p: [0, 0.05, 0.25], r: [0.25, 0, 0] }, () => {
    b.add(lite ? geo.box(0.32, 0.07, 0.016) : geo.cbox(0.32, 0.07, 0.016, 0.004), L.trim, {});
    hazardStripes(b, 0, 0.0, 0.01, 0.3, 0.03, 6);
    // Zinken / tines
    for (let i = 0; i < (lite ? 4 : 7); i++) b.add(geo.cone(0.01, 0.05, 4), mat.metal, { p: [-0.135 + i * (0.27 / (lite ? 3 : 6)), -0.045, 0.012], r: [Math.PI + 0.3, 0, 0] });
  });
  for (const s of [-1, 1]) b.tube([s * 0.1, 0.1, 0.16], [s * 0.1, 0.06, 0.24], 0.01, 5, mat.dark);
  // Minengestell hinten / mine rack at the rear
  const rz = -0.11;
  for (const s of [-1, 1]) for (const z of [rz - 0.07, rz + 0.07]) b.tube([s * 0.1, top, z], [s * 0.1, top + 0.11, z], 0.006, 4, mat.dark);
  for (const y of [top + 0.005, top + 0.055]) {
    b.box(0.22, 0.008, 0.16, mat.darkMid, [0, y, rz]);
    for (const x of [-0.055, 0.055]) for (const z of [rz - 0.04, rz + 0.04]) discMine(b, [x, y + 0.016, z], 0.034, L.hullDark, L.secondary, lite);
  }
  b.box(0.22, 0.008, 0.008, mat.dark, [0, top + 0.11, rz - 0.07]);
  b.box(0.22, 0.008, 0.008, mat.dark, [0, top + 0.11, rz + 0.07]);
  // Rutsche mit fallender Mine / chute with a dropping mine
  b.group({ p: [0, 0.09, -0.22], r: [-0.7, 0, 0] }, () => {
    b.box(0.08, 0.006, 0.12, mat.metal, [0, 0, -0.04]);
    for (const s of [-1, 1]) b.box(0.006, 0.02, 0.12, mat.metal, [s * 0.04, 0.01, -0.04]);
  });
  discMine(b, [0, 0.014, -0.28], 0.032, L.hullDark, L.secondary, lite);
  if (!lite) {
    addEmblem(b, f, 0.028, 0.006, L.emblem, { p: [0.128, 0.1, 0.0], r: [0, HALF_PI, 0] });
    addEmblem(b, f, 0.028, 0.006, L.emblem, { p: [-0.128, 0.1, 0.0], r: [0, -HALF_PI, 0] });
    // Markierungsfaehnchen / marker pennants
    for (const s of [-1, 1]) {
      b.tube([s * 0.12, top, -0.19], [s * 0.12, top + 0.13, -0.19], 0.003, 4, mat.dark);
      b.box(0.004, 0.03, 0.045, s > 0 ? mat.yellow : L.primary, [s * 0.12, top + 0.115, -0.165]);
    }
  }
  return b;
}

// ---------- Kult: Panzerfaust-Eiferer / cult: rocket zealot ----------

export function faustZealot(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  b.group({ p: [0.02, 0, -0.03] }, () => {
    soldier(b, f, {
      ...kneelPose([[0.05, 0.24, 0.13], [0.07, 0.215, 0.03]]),
      head: [0.15, -0.15, 0],
      elbowPoleL: [-0.6, -1, 0.3],
      elbowPoleR: [0.8, -1, 0],
    }, { detail: lite ? 1 : 2, robe: true, seed: 91 });
    rocketTube(b, [0.075, 0.262, 0], -0.15, { r: 0.03, len: 0.4, c: mat.rust, band: L.primary, style: 'cult', lite });
  });
  // Bueschel Ersatzraketen am Strick / bundle of spare rockets on a cord
  b.group({ p: [-0.13, 0, -0.12], r: [0, 0.5, 0] }, () => {
    for (let i = 0; i < (lite ? 2 : 3); i++) {
      const x = (i - 1) * 0.032;
      b.cyl(0.014, 0.014, 0.16, lite ? 6 : 8, mat.rustDark, [x, 0.08, 0]);
      b.add(geo.cone(0.018, 0.04, lite ? 6 : 8), i % 2 ? mat.ember : mat.rust, { p: [x, 0.18, 0] });
    }
    b.box(0.11, 0.016, 0.03, mat.wood, [0, 0.06, 0]);
  });
  // Weltuntergangs-Banner / doom banner
  if (!lite) {
    b.tube([-0.06, 0.0, -0.2], [-0.07, 0.44, -0.22], 0.005, 5, mat.wood);
    b.box(0.006, 0.1, 0.08, L.primary, [-0.07, 0.38, -0.18]);
    addEmblem(b, 'vesper', 0.028, 0.004, mat.bone, { p: [-0.066, 0.38, -0.18], r: [0, HALF_PI, 0] });
  }
  return b;
}

// ---------- NEXUS: Flak-Drohne / flak drone ----------

export function flakDrone(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const y = 0.13;
  // vier kurze Laeufer-Beine / four short walker legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hip: V3 = [sx * 0.08, y, sz * 0.08];
    const knee: V3 = [sx * 0.17, y + 0.05, sz * 0.17];
    const foot: V3 = [sx * 0.2, 0.01, sz * 0.2];
    b.segment(new THREE.Vector3(...hip), new THREE.Vector3(...knee), (l) => (lite ? geo.box(0.03, l, 0.03) : geo.rbox(0.03, l, 0.03, 0.007)), metal);
    b.segment(new THREE.Vector3(...knee), new THREE.Vector3(...foot), (l) => (lite ? geo.box(0.024, l, 0.024) : geo.rbox(0.024, l, 0.024, 0.006)), plate);
    b.add(geo.sphere(0.02, lite ? 6 : 8, lite ? 3 : 4), metal, { p: knee });
    b.add(geo.cyl(0.02, 0.026, 0.012, lite ? 6 : 8), glow, { p: [foot[0], 0.006, foot[2]] });
  }
  // Sechseck-Plattform / hexagonal platform
  b.add(geo.cyl(0.13, 0.11, 0.05, 6), plate, { p: [0, y, 0] });
  b.add(geo.cyl(0.132, 0.132, 0.008, 6), glow, { p: [0, y + 0.012, 0] });
  // Drehkopf mit vier Laeufen nach oben / turret head with four barrels pointing up
  b.cyl(0.06, 0.07, 0.03, lite ? 8 : 12, metal, [0, y + 0.04, 0]);
  b.add(lite ? geo.box(0.14, 0.07, 0.1) : geo.rbox(0.14, 0.07, 0.1, 0.018), plate, { p: [0, y + 0.085, -0.01] });
  b.add(geo.sphere(0.016, lite ? 6 : 8, lite ? 3 : 4), glow, { p: [0, y + 0.09, 0.045] });
  b.group({ p: [0, y + 0.1, 0.0], r: [-1.0, 0, 0] }, () => {
    for (const x of [-0.045, 0.045]) for (const yy of [-0.012, 0.016]) {
      b.cyl(0.008, 0.008, 0.22, lite ? 5 : 8, metal, [x, yy, 0.13], [HALF_PI, 0, 0]);
      b.cyl(0.011, 0.011, 0.02, lite ? 5 : 8, glow, [x, yy, 0.24], [HALF_PI, 0, 0]);
    }
    b.add(geo.cbox(0.13, 0.05, 0.05, 0.01), metal, { p: [0, 0.002, 0.03] });
  });
  if (!lite) {
    // Zielradar-Flosse / targeting radar fin
    b.add(geo.rbox(0.012, 0.08, 0.06, 0.004), plate, { p: [0.0, y + 0.15, -0.06] });
    b.box(0.014, 0.05, 0.006, glow, [0.0, y + 0.15, -0.028]);
    addEmblem(b, f, 0.022, 0.005, L.primary, { p: [0, y + 0.03, 0.12] });
  }
  return b;
}

// ---------- Mine (verdeckt, nur Besitzer) / mine (hidden, owner only) ----------

/** Halb vergrabene Tellermine mit Erdhuegel und Markierungsfaehnchen / half-buried disc mine with dirt mound and marker pennant */
export function mineModel(f: FactionId | null): Builder {
  const b = new Builder();
  const L = look(f);
  const dirt = col(semantic.terrainPlainSide);
  // etwas groesser als real, damit der Besitzer sie auf der Karte findet / a bit larger than life so the owner finds it on the map
  b.group({ s: 1.4 }, () => mineParts(b, L, dirt));
  return b;
}

function mineParts(b: Builder, L: Look, dirt: THREE.Color) {
  b.add(geo.hemi(0.11, 10, 3), shade(dirt, 0.85), { p: [0.02, 0, -0.01], s: [1, 0.22, 0.9] });
  // nur die obere Haelfte schaut heraus / only the upper half sticks out
  discMine(b, [0.02, 0.012, -0.01], 0.06, L.hullDark, L.secondary, false);
  const R = rng(5);
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2, d = 0.1 + R() * 0.04;
    b.add(geo.dodeca(0.012 + R() * 0.008), shade(dirt, 0.7), { p: [0.02 + Math.cos(a) * d, 0.006, -0.01 + Math.sin(a) * d], r: [R(), R(), R()] });
  }
  // Faehnchen in Fraktionsfarbe / pennant in faction colour
  b.tube([-0.09, 0, 0.07], [-0.09, 0.12, 0.07], 0.004, 4, mat.dark);
  b.add(geo.profileXY([[0, 0], [0.05, -0.016], [0, -0.032]], 0.004), L.primary, { p: [-0.09, 0.118, 0.07] });
}
