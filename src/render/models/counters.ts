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
import { Builder, capsule, col, fine, geo, mix, rng, shade, unitLow, type ColorLike, type V3 } from './kit';
import { look, mat, styleOf, type Look } from './look';
import {
  MUD, ammoBox, antennaBase, boltRing, cable, crate, grabRail, grille, headlight, jerryCan, mudBand, muffler, periscope, rivets,
  roundHatch, seam, sensorCluster, squareHatch, tarpRoll, toolSet, towCable, towHook, vents,
} from './detailVehicles';
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
    if (!o.lite && fine()) {
      // hohe Qualitaet: Duese mit Innenring, Visier mit Sonnenblende, Abzugbuegel, Schulterstuetze, Trageriemen, Zuender
      // high quality: venturi with inner ring, sight with sun hood, trigger guard, shoulder rest, sling, fuse
      b.cyl(o.r * 1.2, o.r * 1.2, 0.004, seg, mat.ink, [0, 0, -o.len / 2 - 0.043], [HALF_PI, 0, 0]);
      b.add(geo.torus(o.r * 1.42, o.r * 0.09, 3, seg), shade(o.c, 0.7), { p: [0, 0, -o.len / 2 - 0.036] });
      b.add(geo.cbox(0.012, 0.014, 0.03, 0.003), mat.dark, { p: [-o.r - 0.012, o.r * 0.4 + 0.016, o.len * 0.08 + 0.008] });
      b.box(0.012, 0.0035, 0.008, mat.dark, [-o.r - 0.012, o.r * 0.4 + 0.024, o.len * 0.08 + 0.026]);
      b.add(geo.torus(0.009, 0.0022, 3, 8), mat.dark, { p: [0, -o.r - 0.026, 0.035], r: [0, HALF_PI, 0] });
      b.add(geo.cbox(0.03, 0.012, 0.05, 0.004), shade(o.c, 0.8), { p: [0, -o.r - 0.002, -o.len * 0.2] });
      b.tube([o.r * 0.9, -o.r * 0.3, o.len * 0.3], [o.r * 1.05, -o.r * 0.6, -o.len * 0.35], 0.0028, 4, o.style === 'cult' ? mat.wood : mat.darkMid);
      b.cyl(o.r * 0.2, o.r * 0.34, o.r * 0.7, 8, mat.metal, [0, 0, o.len / 2 + o.r * 4.15], [HALF_PI, 0, 0]);
      b.cyl(o.r * 1.27, o.r * 1.27, 0.005, seg, mat.dark, [0, 0, o.len / 2 + o.r * 2], [HALF_PI, 0, 0]);
      for (const z of [-o.len * 0.4, o.len * 0.38]) for (const s of [-1, 1]) b.box(0.004, 0.004, 0.004, mat.dark, [s * o.r * 0.7, o.r * 0.72, z]);
      if (o.style === 'velkar') b.box(o.r * 0.4, 0.004, o.len * 0.7, mat.ink, [o.r * 0.5, o.r + 0.001, 0]);
    }
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
    if (!lite && fine()) {
      b.box(r * 2.6, 0.004, 0.02, mat.dark, [0, r, -0.045]);
      b.cyl(r * 1.06, r * 1.06, 0.005, 8, mat.yellow, [0, r, 0.03], [HALF_PI, 0, 0]);
    }
  });
}

// ---------- Panzerabwehr-Trupp / anti-tank squad ----------

export function antiTank(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const st = styleOf(f);
  // Schuetze kniend, Rohr auf der rechten Schulter, leicht nach oben / gunner kneeling, tube on the right shoulder, slightly raised
  // Lesbarkeit: uebergrosses Rohr (doppelt so dick wie zuvor, laenger als die Figur breit ist) in dunklem Ton, damit es sich
  // von der Uniform abhebt: ein langer Balken auf Kopfhoehe ist die Kennform der Panzerabwehr.
  // Readability: oversized tube (twice as thick as before, longer than the figure is wide) in a dark tone so it stands out
  // from the uniform: a long bar at head height is the anti-tank signature.
  const pitch = -0.1;
  const tubeR = st === 'dravon' ? 0.05 : 0.046;
  const tubeLen = st === 'dravon' ? 0.5 : 0.48;
  const sy = 0.275, sx = 0.08, sz = -0.01;
  b.group({ p: [0.02, 0, -0.02] }, () => {
    soldier(b, f, {
      ...kneelPose([[0.05, 0.24, 0.13], [0.07, 0.215, 0.03]]),
      head: [0.15, -0.15, 0],
      elbowPoleL: [-0.6, -1, 0.3],
      elbowPoleR: [0.8, -1, 0],
    }, { detail: lite ? 0 : 1, seed: 71 });
    rocketTube(b, [sx, sy, sz], pitch, { r: tubeR, len: tubeLen, c: st === 'velkar' ? L.hullDark : mix(mat.metal, mat.dark, 0.35), band: L.secondary, style: st, lite });
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
  if (!lite && fine()) {
    crate(b, [-0.13, 0, 0.14], 0.1, 0.035, 0.07, mat.wood, mat.dark);
    for (const s of [-1, 1]) b.box(0.006, 0.01, 0.022, mat.dark, [-0.13 + s * 0.053, 0.022, 0.14]);
    // Deckel angelehnt, Feldflasche / lid leaning, canteen
    b.add(geo.cbox(0.1, 0.006, 0.07, 0.003), mat.woodLight, { p: [-0.13, 0.04, 0.18], r: [1.2, 0, 0] });
    b.cyl(0.014, 0.014, 0.03, 10, mat.leaf, [-0.04, 0.015, 0.16]);
    b.cyl(0.006, 0.006, 0.006, 6, mat.dark, [-0.04, 0.033, 0.16]);
  } else b.add(geo.cbox(0.1, 0.035, 0.07, 0.008), mat.wood, { p: [-0.13, 0.018, 0.14] });
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
  const rich = !lite && fine();
  for (const x of xs) for (const y of ys) {
    b.cyl(r * 1.6, r * 1.6, 0.06, seg, mat.dark, [x, y, 0.05], [HALF_PI, 0, 0]);
    b.cyl(r, r, len, seg, mat.dark, [x, y, 0.05 + len / 2], [HALF_PI, 0, 0]);
    b.cyl(r * 1.5, r * 1.3, 0.03, seg, glow ?? mat.metal, [x, y, 0.05 + len], [HALF_PI, 0, 0]);
    if (rich) {
      // Kuehlmantel mit Loechern, Feuerdaempfer-Schlitze, Federvorholer / cooling jacket with holes, flash hider slots, recoil spring
      b.cyl(r * 1.3, r * 1.3, len * 0.3, 10, mat.darkMid, [x, y, 0.08 + len * 0.15], [HALF_PI, 0, 0]);
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box(0.003, 0.003, 0.004, mat.ink, [x + s * r * 1.3, y, 0.09 + i * len * 0.07]);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        b.box(0.003, 0.003, 0.022, mat.ink, [x + Math.sin(a) * r * 1.42, y + Math.cos(a) * r * 1.42, 0.05 + len]);
      }
      b.cyl(r * 0.45, r * 0.45, len * 0.4, 6, mat.metal, [x, y - r * 1.4, 0.1 + len * 0.2], [HALF_PI, 0, 0]);
    }
  }
  if (rich) {
    // Magazine oben auf den Rohren, Ringvisier mit Kreuz / magazines on top of the barrels, ring sight with cross
    for (const x of xs) {
      b.add(geo.cbox(0.02, 0.026, 0.04, 0.004), L.gear, { p: [x, ys[ys.length - 1] + r + 0.016, 0.03] });
      b.box(0.016, 0.004, 0.03, shade(L.gear, 0.75), [x, ys[ys.length - 1] + r + 0.03, 0.03]);
    }
    b.group({ p: [0, ys[ys.length - 1] + 0.035, 0.12] }, () => {
      b.add(geo.torus(0.02, 0.0018, 3, 16), mat.dark, {});
      b.box(0.04, 0.0025, 0.0025, mat.dark, [0, 0, 0]);
      b.box(0.0025, 0.04, 0.0025, mat.dark, [0, 0, 0]);
      b.box(0.003, 0.035, 0.003, mat.dark, [0, -0.03, 0]);
    });
  }
  if (!lite) for (const s of [-1, 1]) b.add(geo.cbox(0.03, 0.05, 0.06, 0.006), L.gear, { p: [s * (spread + 0.05), -0.02, -0.01] });
}

export function antiAir(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const st = styleOf(f);
  const hi = !lite && fine();
  let top = 0.15;
  if (st === 'meridon') {
    // leichter Lastwagen mit Vierlingsflak auf der Ladeflaeche / light truck with quad AA on the bed
    const wr = 0.058;
    for (const sx of [-1, 1]) for (const z of [-0.15, 0.02, 0.16]) wheel(b, sx * 0.13, wr, z, wr, 0.045, { rim: L.trim, lite, rich: true });
    if (hi) aaTruckDetail(b, L, wr);
    b.box(0.22, 0.03, 0.42, L.hullDark, [0, wr + 0.01, 0]);
    b.block(0, wr + 0.025, 0.16, 0.22, 0.1, 0.1, L.hull);
    b.box(0.2, 0.04, 0.006, mat.glass, [0, wr + 0.1, 0.212], [-0.2, 0, 0]);
    b.block(0, wr + 0.025, -0.06, 0.26, 0.03, 0.3, L.trim);
    hazardStripes(b, 0, wr + 0.04, -0.212, 0.24, 0.024, 4);
    top = wr + 0.055;
  } else {
    tracks(b, { x: 0.13, w: 0.07, len: 0.42, h: 0.085, wheels: 5, wr: 0.026, sprocket: L.trim, hub: L.secondary, lite, links: 9, rich: true });
    if (hi) aaHullDetail(b, L, st);
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
  // Drehturm: dreht sich zum Ziel (siehe Builder.turret) / turret: turns towards the target (see Builder.turret)
  b.turret([0, top, tz], () => {
    b.cyl(0.09, 0.1, 0.025, lite ? 8 : 12, L.hullDark, [0, top + 0.012, tz]);
    b.block(0, top + 0.02, tz, 0.2, 0.04, 0.16, L.hull);
    for (const s of [-1, 1]) {
      // hohe Seitenschilde: die Flak-Lafette wird ein hoher Block / tall side shields: the AA mount becomes a tall block
      if (st === 'alvenia') b.add(geo.rtaper(0.016, 0.17, 0.016, 0.07, 0.17, 0.006), L.hull, { p: [s * 0.105, top + 0.135, tz] });
      else if (st === 'velkar') b.add(geo.taper(0.014, 0.16, 0.014, 0.1, 0.07, 0.0), L.hull, { p: [s * 0.105, top + 0.075, tz] });
      else b.add(geo.taper(0.016, 0.17, 0.016, 0.07, 0.17, 0.0), L.hull, { p: [s * 0.105, top + 0.135, tz] });
      if (st === 'dravon') b.box(0.018, 0.012, 0.17, L.trim, [s * 0.105, top + 0.06, tz]);
    }
    const quad = st === 'korvat' || st === 'meridon';
    const dravon = st === 'dravon';
    // Lesbarkeit: Rohre steil (66 Grad) und lang, das hoechste Fahrzeug mit senkrechten Spitzen (Kennform der Flak); Hoehe bleibt unter MAX_H
    // readability: barrels steep (66 degrees) and long, the tallest vehicle with vertical spikes (the AA signature); height stays below MAX_H
    b.group({ p: [0, top + 0.1, tz], r: [st === 'velkar' ? -0.62 : -1.15, 0, 0] }, () => {
      if (st === 'velkar') {
        // Velkar: Raketenkasten mit sechs Zellen statt Rohren (ein grosser Block, unterscheidet sich von den runden Tesla-Spulen)
        // Velkar: six-cell missile box instead of barrels (one big block, unlike the round Tesla coils)
        b.add(lite ? geo.box(0.2, 0.1, 0.3) : geo.cbox(0.2, 0.1, 0.3, 0.016), L.hull, { p: [0, 0, 0.16] });
        b.add(lite ? geo.box(0.208, 0.02, 0.24) : geo.cbox(0.208, 0.02, 0.24, 0.005), L.hullDark, { p: [0, 0.042, 0.15] });
        for (let i = 0; i < 6; i++) b.add(geo.cyl(0.02, 0.02, 0.012, lite ? 6 : 10), i % 2 ? L.secondary : mat.dark, { p: [-0.06 + (i % 3) * 0.06, -0.02 + Math.floor(i / 3) * 0.04, 0.312], r: [HALF_PI, 0, 0] });
        b.add(geo.cbox(0.2, 0.05, 0.08, 0.01), L.hullDark, {});
      } else aaGuns(b, L, quad ? 4 : 2, dravon ? 0.32 : 0.3, quad ? 0.012 : 0.016, quad ? 0.04 : 0.045, lite);
    });
    // Visier / sight
    b.add(geo.cbox(0.03, 0.03, 0.03, 0.006), mat.dark, { p: [-0.07, top + 0.14, tz + 0.03] });
    // Munitionsgurte / ammo belts
    if (!lite) for (let i = 0; i < 5; i++) b.box(0.01, 0.022, 0.008, mat.gold, [-0.06 + i * 0.012, top + 0.055, tz + 0.085]);
    if (!lite) antenna(b, -0.08, top + 0.04, tz - 0.08, 0.13, L.secondary);
    if (hi) {
      // Drehkranz mit Bolzen, Schildnieten, Handgriffe, Munitionskisten, Richtschuetzensitz / turntable with bolts, shield rivets, handles, ammo boxes, gunner seat
      boltRing(b, [0, top + 0.026, tz], 0.092, 14, mat.dark, 0.0045);
      for (const s of [-1, 1]) {
        if (st !== 'velkar') rivets(b, [s * 0.114, top + 0.06, tz - 0.07], [s * 0.114, top + 0.19, tz - 0.03], 6, L.hullDark, 0.0045);
        grabRail(b, s * 0.1, top + 0.03, tz - 0.06, tz + 0.04, s * 0.008);
        ammoBox(b, [s * 0.075, top + 0.04, tz - 0.055], HALF_PI, L.gear, 0.9);
      }
      b.add(geo.cbox(0.04, 0.008, 0.035, 0.003), mat.darkMid, { p: [0.05, top + 0.065, tz - 0.02] });
      b.box(0.04, 0.03, 0.006, mat.darkMid, [0.05, top + 0.08, tz - 0.038], [-0.2, 0, 0]);
      antennaBase(b, -0.08, top + 0.04, tz - 0.08);
    }
  });
  if (!lite) {
    // Radar hinten / radar at the rear
    if (st === 'alvenia' || st === 'velkar') dish(b, 0.06, top + 0.03, tz - 0.12, 0.05, -0.5, st === 'velkar' ? L.hullDark : mat.white);
    else {
      b.tube([0.07, top + 0.03, tz - 0.11], [0.07, top + 0.13, tz - 0.11], 0.006, 5, mat.dark);
      b.box(0.11, 0.035, 0.008, mat.metal, [0.07, top + 0.145, tz - 0.11], [0, 0.4, 0]);
      for (let i = 0; i < 4; i++) b.box(0.004, 0.035, 0.01, mat.dark, [0.03 + i * 0.027, top + 0.145, tz - 0.105], [0, 0.4, 0]);
      if (hi) {
        // Radar: Antriebskasten, Rahmen, Kabel / radar: drive box, frame, cable
        b.add(geo.cbox(0.026, 0.02, 0.026, 0.004), L.hullDark, { p: [0.07, top + 0.04, tz - 0.11] });
        b.box(0.115, 0.004, 0.012, mat.dark, [0.07, top + 0.164, tz - 0.112], [0, 0.4, 0]);
        b.box(0.115, 0.004, 0.012, mat.dark, [0.07, top + 0.126, tz - 0.112], [0, 0.4, 0]);
        b.tube([0.065, top + 0.03, tz - 0.105], [0.03, top + 0.02, tz - 0.08], 0.0025, 4, mat.dark);
      }
    }
  }
  return b;
}

/**
 * Flakpanzer-Wanne, hohe Qualitaet: Fahrerluke mit Winkelspiegeln, Scheinwerfer mit Schutzbuegel, Abschleppoesen, Werkzeug
 * und Seil an der Flanke, Motorgitter, Auspufftopf, Kanister, Schmutz.
 * AA vehicle hull, high quality: driver hatch with periscopes, headlights with guards, tow eyes, tools and cable on the
 * flank, engine grille, muffler, jerry can, mud.
 */
function aaHullDetail(b: Builder, L: Look, st: string) {
  const top = st === 'korvat' ? 0.14 : st === 'dravon' ? 0.15 : 0.1425;
  const side = st === 'velkar' ? 0.176 : 0.136;
  squareHatch(b, -0.06, top, 0.14, 0.05, 0.04, L.hull);
  for (const x of [-0.075, -0.045]) periscope(b, x, top, 0.17, 0, L.hullDark, 0.85);
  roundHatch(b, 0.06, top, 0.14, 0.02, L.hull);
  for (const s of [-1, 1]) {
    headlight(b, s * 0.1, top - 0.02, 0.205, 0.0095, L.hullDark);
    towHook(b, s * 0.07, 0.07, 0.212, 1, L.hullDark);
    towHook(b, s * 0.09, 0.075, -0.212, -1, L.hullDark);
  }
  toolSet(b, [side + 0.002, 0.11, -0.1], [0, 0, -HALF_PI], 0.14, ['shovel', 'axe']);
  towCable(b, [-side - 0.003, 0.11, -0.17], [-side - 0.003, 0.11, 0.15]);
  grille(b, [0, top, -0.17], 0.14, 0.05, 4, L.hullDark);
  muffler(b, [0.1, top + 0.012, -0.18], 0.05, 0.011, mat.darkMid, -1);
  jerryCan(b, [-0.1, top, -0.17], HALF_PI, L.hullDark, 0.8);
  if (st === 'velkar') mudBand(b, 61, 0.177, 0.01, 0.06, -0.19, 0.19, 10, true, [mat.snow, shade(mat.snow, 0.9)]);
  else mudBand(b, 61, side + 0.001, 0.065, 0.11, -0.2, 0.2, 12);
}

/**
 * Flak-Lastwagen (Meridon), hohe Qualitaet: Kuehlergrill, Scheinwerfer, Spiegel, Tuergriffe, Dachluke, Bordwandbretter,
 * Achsen, Abstuetzungen, Kanister, Abschleppoesen.
 * AA truck (Meridon), high quality: grille, headlights, mirrors, door handles, roof hatch, side boards, axles, outriggers,
 * jerry can, tow eyes.
 */
function aaTruckDetail(b: Builder, L: Look, wr: number) {
  const cab = wr + 0.025;
  b.add(geo.cbox(0.13, 0.05, 0.004, 0.004), L.hullDark, { p: [0, cab + 0.04, 0.212] });
  for (let i = 0; i < 6; i++) b.box(0.006, 0.04, 0.003, mat.ink, [-0.05 + i * 0.02, cab + 0.04, 0.215]);
  for (const s of [-1, 1]) {
    headlight(b, s * 0.085, cab + 0.04, 0.212, 0.012, L.hullDark);
    towHook(b, s * 0.06, wr, 0.22, 1, L.hullDark);
    // Spiegel und Tuergriff / mirror and door handle
    b.tube([s * 0.11, cab + 0.085, 0.19], [s * 0.135, cab + 0.09, 0.19], 0.002, 4, mat.dark);
    b.box(0.004, 0.022, 0.014, mat.glass, [s * 0.137, cab + 0.088, 0.19]);
    b.box(0.004, 0.004, 0.014, mat.dark, [s * 0.112, cab + 0.05, 0.15]);
    seam(b, [s * 0.111, cab + 0.005, 0.12], [s * 0.111, cab + 0.095, 0.12], shade(L.hull, 0.7));
    // Abstuetzungen / outriggers
    b.box(0.05, 0.012, 0.016, mat.dark, [s * 0.15, wr + 0.03, -0.06]);
    b.cyl(0.006, 0.006, 0.05, 6, mat.metal, [s * 0.172, wr + 0.0, -0.06]);
    b.add(geo.cbox(0.026, 0.006, 0.026, 0.003), mat.dark, { p: [s * 0.172, 0.006, -0.06] });
    // Bordwandbretter / side boards
    for (const y of [0.008, 0.02]) b.box(0.003, 0.003, 0.3, shade(L.trim, 0.7), [s * 0.131, wr + 0.025 + y, -0.06]);
  }
  for (const z of [-0.15, 0.02, 0.16]) b.cyl(0.007, 0.007, 0.22, 8, mat.dark, [0, wr, z], [0, 0, HALF_PI]);
  roundHatch(b, -0.03, cab + 0.1, 0.16, 0.022, L.hull);
  jerryCan(b, [0.11, wr + 0.055, -0.19], 0, L.hullDark, 0.8);
  b.box(0.06, 0.016, 0.003, mat.paper, [0, wr, 0.221]);
}

// ---------- Minenleger / mine layer ----------

/** Tellermine / disc mine */
function discMine(b: Builder, p: V3, r: number, body: ColorLike, cap: ColorLike, lite: boolean, rich = false) {
  b.cyl(r, r * 1.05, r * 0.42, lite ? 6 : 8, body, p);
  b.cyl(r * 0.45, r * 0.5, r * 0.18, lite ? 6 : 8, cap, [p[0], p[1] + r * 0.28, p[2]]);
  if (!lite) b.cyl(r * 0.12, r * 0.12, r * 0.18, 5, mat.dark, [p[0], p[1] + r * 0.42, p[2]]);
  if (rich && !lite && fine()) {
    // Rand, Tragegriff und Sicherungsstift / rim, carrying handle and safety pin
    b.add(geo.torus(r * 0.98, r * 0.06, 3, 14), shade(body, 0.7), { p: [p[0], p[1] + r * 0.2, p[2]], r: [HALF_PI, 0, 0] });
    b.box(r * 0.5, r * 0.08, r * 0.1, mat.dark, [p[0] + r * 0.62, p[1] + r * 0.24, p[2]]);
    b.add(geo.torus(r * 0.12, r * 0.03, 3, 6), mat.yellow, { p: [p[0], p[1] + r * 0.52, p[2] + r * 0.16] });
  }
}

export function mineLayer(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const st = styleOf(f);
  // Proportion: das laengste und flachste Kettenfahrzeug (Wanne 0.44 statt 0.36 lang), damit es sich in Masse und Umriss
  // vom Panzer (hoher Turm) und von der Flak (kurz, hoch) trennt / proportion: the longest and flattest tracked vehicle (hull
  // 0.44 instead of 0.36 long) so it separates in mass and outline from the tank (tall turret) and the AA (short, tall)
  const HL = 0.44, dz = (HL - 0.36) / 2;
  const hi = !lite && fine();
  // niedrige Qualitaet: vier Laufrollen wie zuvor (gleiches Budget) / low quality: four road wheels as before (same budget)
  tracks(b, { x: 0.125, w: 0.065, len: HL, h: 0.08, wheels: unitLow() ? 4 : 5, wr: 0.026, sprocket: L.trim, hub: L.secondary, lite, links: 8, rich: true });
  // Wanne / hull
  switch (st) {
    case 'dravon':
      b.add(geo.profileZY([[-0.18 - dz, 0], [0.17 + dz, 0], [0.19 + dz, 0.035], [0.06 + dz, 0.075], [-0.17 - dz, 0.08], [-0.19 - dz, 0.04]], 0.25), L.hull, { p: [0, 0.06, -0.01] });
      break;
    case 'alvenia':
      b.add(geo.rtaper(0.26, HL, 0.22, HL - 0.06, 0.08, 0.028), L.hull, { p: [0, 0.1, -0.01] });
      break;
    case 'velkar':
      b.add(geo.rtaper(0.27, HL, 0.21, HL - 0.08, 0.08, 0.012, 0.01), L.hull, { p: [0, 0.1, -0.01] });
      for (const s of [-1, 1]) b.block(s * 0.163, 0.035, -0.01, 0.012, 0.055, HL - 0.02, L.hullDark);
      break;
    default:
      b.block(0, 0.06, -0.01, 0.25, 0.08, HL, L.hull);
      if (st === 'meridon') for (const z of [-0.12 - dz, -0.06, 0.0]) b.block(0, 0.062, z, 0.254, 0.076, 0.008, shade(L.hull, 0.8));
      break;
  }
  // Fahrerhaus vorn, flach: der Minenleger ist das niedrigste Kettenfahrzeug (kein Turm) / cab at the front, low: the mine
  // layer is the lowest tracked vehicle (no turret)
  const top = 0.14;
  b.add(lite ? geo.box(0.16, 0.05, 0.1) : geo.cbox(0.16, 0.05, 0.1, 0.012), L.hullDark, { p: [0, top + 0.025, 0.08 + dz] });
  b.box(0.13, 0.022, 0.006, mat.glass, [0, top + 0.03, 0.132 + dz], [-0.15, 0, 0]);
  if (!lite) commander(b, f, -0.04, top + 0.045, 0.06 + dz, 81);
  // Raeumschild vorn mit Warnstreifen; Lesbarkeit: breiter als die Ketten und hoch (Kennform des Minenlegers: flache Wanne mit
  // Schaufel vorn, kein Turm) / mine plough at the front with hazard stripes; readability: wider than the tracks and tall
  // (the mine layer's signature: a flat hull with a blade in front, no turret)
  b.group({ p: [0, 0.085, 0.25 + dz], r: [0.25, 0, 0] }, () => {
    b.add(lite ? geo.box(0.42, 0.14, 0.018) : geo.cbox(0.42, 0.14, 0.018, 0.005), L.trim, {});
    for (const s of [-1, 1]) b.add(lite ? geo.box(0.018, 0.14, 0.07) : geo.cbox(0.018, 0.14, 0.07, 0.004), L.trim, { p: [s * 0.205, 0, -0.03] });
    hazardStripes(b, 0, 0.02, 0.011, 0.38, 0.05, 8);
    // Zinken / tines
    for (let i = 0; i < (lite ? 5 : 9); i++) b.add(geo.cone(0.011, 0.055, 4), mat.metal, { p: [-0.18 + i * (0.36 / (lite ? 4 : 8)), -0.082, 0.012], r: [Math.PI + 0.3, 0, 0] });
  });
  for (const s of [-1, 1]) b.tube([s * 0.1, 0.11, 0.16 + dz], [s * 0.1, 0.09, 0.24 + dz], 0.01, 5, mat.dark);
  if (hi) mineLayerDetail(b, L, st, top, dz);
  // Minenwanne hinten: eine flache Lage Tellerminen hinter niedrigen Bordwaenden (statt des hohen Gestells, das wie ein Turm wirkte)
  // mine tray at the rear: one flat layer of disc mines behind low side boards (instead of the tall rack that read as a turret)
  const rz = -0.1 - dz;
  b.box(0.23, 0.01, 0.2, mat.darkMid, [0, top + 0.005, rz]);
  for (const s of [-1, 1]) b.add(lite ? geo.box(0.012, 0.035, 0.2) : geo.cbox(0.012, 0.035, 0.2, 0.004), L.trim, { p: [s * 0.115, top + 0.022, rz] });
  b.add(lite ? geo.box(0.23, 0.035, 0.012) : geo.cbox(0.23, 0.035, 0.012, 0.004), L.trim, { p: [0, top + 0.022, rz - 0.1] });
  if (!lite) hazardStripes(b, 0, top + 0.022, rz - 0.107, 0.2, 0.024, 5, Math.PI);
  for (const x of [-0.06, 0.0, 0.06]) for (const z of [rz - 0.05, rz + 0.04]) discMine(b, [x, top + 0.022, z], 0.03, L.hullDark, L.secondary, lite, true);
  // Rutsche mit fallender Mine / chute with a dropping mine
  b.group({ p: [0, 0.09, -0.22 - dz], r: [-0.7, 0, 0] }, () => {
    b.box(0.08, 0.006, 0.12, mat.metal, [0, 0, -0.04]);
    for (const s of [-1, 1]) b.box(0.006, 0.02, 0.12, mat.metal, [s * 0.04, 0.01, -0.04]);
  });
  discMine(b, [0, 0.014, -0.28 - dz], 0.032, L.hullDark, L.secondary, lite, true);
  if (!lite) {
    addEmblem(b, f, 0.028, 0.006, L.emblem, { p: [0.128, 0.1, 0.0], r: [0, HALF_PI, 0] });
    addEmblem(b, f, 0.028, 0.006, L.emblem, { p: [-0.128, 0.1, 0.0], r: [0, -HALF_PI, 0] });
    // Markierungsfaehnchen / marker pennants
    for (const s of [-1, 1]) {
      b.tube([s * 0.12, top, -0.19 - dz], [s * 0.12, top + 0.1, -0.19 - dz], 0.003, 4, mat.dark);
      b.box(0.004, 0.026, 0.04, s > 0 ? mat.yellow : L.primary, [s * 0.12, top + 0.088, -0.168 - dz]);
    }
  }
  return b;
}

/**
 * Minenleger, hohe Qualitaet: Hydraulikzylinder und Bolzen am Raeumschild, Fahrerhaus mit Luke, Winkelspiegeln, Scheinwerfern
 * und Abschleppoesen, Rutsche mit Rollen, Werkzeug, Auspufftopf, Schmutz.
 * Mine layer, high quality: hydraulic rams and bolts on the plough, cab with hatch, periscopes, headlights and tow eyes,
 * chute with rollers, tools, muffler, mud.
 */
function mineLayerDetail(b: Builder, L: Look, st: string, top: number, dz: number) {
  // Raeumschild: Hydraulikzylinder, Bolzenreihe, Verstrebung / plough: hydraulic rams, bolt row, bracing
  for (const s of [-1, 1]) {
    b.tube([s * 0.06, 0.135, 0.12 + dz], [s * 0.06, 0.12, 0.235 + dz], 0.0085, 8, L.hullDark);
    b.tube([s * 0.06, 0.122, 0.2 + dz], [s * 0.06, 0.115, 0.245 + dz], 0.005, 6, mat.metal);
    b.add(geo.cbox(0.02, 0.02, 0.016, 0.004), mat.dark, { p: [s * 0.06, 0.136, 0.12 + dz] });
    b.tube([s * 0.17, 0.05, 0.23 + dz], [s * 0.12, 0.08, 0.16 + dz], 0.004, 5, mat.dark);
    headlight(b, s * 0.055, top + 0.03, 0.135 + dz, 0.009, L.hullDark);
    towHook(b, s * 0.09, 0.07, -0.235 - dz, -1, L.hullDark);
  }
  b.group({ p: [0, 0.085, 0.25 + dz], r: [0.25, 0, 0] }, () => {
    rivets(b, [-0.19, 0.06, 0.011], [0.19, 0.06, 0.011], 14, shade(L.trim, 0.65), 0.0045);
    for (const x of [-0.12, 0, 0.12]) b.box(0.012, 0.12, 0.012, shade(L.trim, 0.8), [x, 0, -0.014]);
  });
  // Fahrerhaus: Luke, Winkelspiegel, Antenne / cab: hatch, periscopes, antenna
  squareHatch(b, 0.04, top + 0.05, 0.08 + dz, 0.05, 0.05, L.hullDark);
  for (const x of [-0.05, 0.0]) periscope(b, x, top + 0.05, 0.12 + dz, 0, L.hullDark, 0.8);
  antennaBase(b, 0.06, top + 0.05, 0.04 + dz);
  b.tube([0.06, top + 0.065, 0.04 + dz], [0.064, top + 0.13, 0.025 + dz], 0.0018, 4, mat.dark);
  // Rutsche: Rollen / chute: rollers
  b.group({ p: [0, 0.09, -0.22 - dz], r: [-0.7, 0, 0] }, () => {
    for (let i = 0; i < 4; i++) b.cyl(0.004, 0.004, 0.072, 6, mat.dark, [0, 0.006, -0.09 + i * 0.03], [0, 0, HALF_PI]);
  });
  // Flanken: Werkzeug, Seil, Auspuff, Schmutz / flanks: tools, cable, exhaust, mud
  const side = st === 'velkar' ? 0.17 : st === 'alvenia' ? 0.13 : 0.126;
  toolSet(b, [side + 0.002, 0.1, 0.1], [0, 0, -HALF_PI], 0.14, ['shovel', 'bar']);
  towCable(b, [-side - 0.003, 0.1, -0.2], [-side - 0.003, 0.1, 0.18]);
  muffler(b, [-0.09, top + 0.012, 0.0], 0.06, 0.011, mat.darkMid, -1);
  // Kanister und Werkzeugkiste neben dem Fahrerhaus / jerry cans and tool box next to the cab
  for (const z of [0.0, 0.045]) jerryCan(b, [0.098, top, z + dz], 0, L.hullDark, 0.85);
  ammoBox(b, [-0.1, top, 0.06 + dz], HALF_PI, L.gear, 1.1);
  tarpRoll(b, [0.0, top + 0.012, 0.0], 0.1, 0.012, L.gear, mat.dark);
  if (st === 'velkar') mudBand(b, 67, 0.17, 0.01, 0.055, -0.2, 0.2, 10, true, [mat.snow, shade(mat.snow, 0.9)]);
  else mudBand(b, 67, side + 0.001, 0.065, 0.12, -0.22, 0.2, 12);
  for (let i = 0; i < 6; i++) b.box(0.035, 0.006, 0.006, MUD, [-0.16 + i * 0.064, 0.03 + (i % 2) * 0.02, 0.252 + dz - (i % 2) * 0.004], [0.25, 0, 0]);
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
    // uebergrosses Rohr wie beim Panzerabwehr-Trupp (Kennform gegen die anderen Kuttentraeger) / oversized tube like the anti-tank squad (signature against the other robed units)
    rocketTube(b, [0.08, 0.275, -0.01], -0.12, { r: 0.044, len: 0.46, c: mat.rust, band: L.primary, style: 'cult', lite });
  });
  // Bueschel Ersatzraketen am Strick / bundle of spare rockets on a cord
  b.group({ p: [-0.13, 0, -0.12], r: [0, 0.5, 0] }, () => {
    for (let i = 0; i < (lite ? 2 : 3); i++) {
      const x = (i - 1) * 0.032;
      b.cyl(0.014, 0.014, 0.16, lite ? 6 : 8, mat.rustDark, [x, 0.08, 0]);
      b.add(geo.cone(0.018, 0.04, lite ? 6 : 8), i % 2 ? mat.ember : mat.rust, { p: [x, 0.18, 0] });
    }
    b.box(0.11, 0.016, 0.03, mat.wood, [0, 0.06, 0]);
    if (!lite && fine()) {
      // Strick um das Buendel, Leitwerke / cord around the bundle, fins
      for (const y of [0.05, 0.11]) b.box(0.1, 0.006, 0.034, mat.sand, [0, y, 0]);
      for (let i = 0; i < 3; i++) for (const a of [0, HALF_PI]) b.box(0.036, 0.022, 0.003, mat.rustDark, [(i - 1) * 0.032, 0.012, 0], [0, a, 0]);
    }
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
  // vier kurze Laeufer-Beine; Feinschliff: runde Glieder (Kapseln) mit Hydraulikzylinder, Kniekappe und Fussteller statt
  // Vierkantstaeben / four short walker legs; polish: round limbs (capsules) with a hydraulic ram, knee cap and foot pad
  // instead of square bars
  // niedrige Qualitaet: Kapseln mit weniger Segmenten, ohne Zylinder und Kappen / low quality: capsules with fewer segments, without rams and caps
  const lo = lite || !fine();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hip: V3 = [sx * 0.08, y, sz * 0.08];
    const knee: V3 = [sx * 0.17, y + 0.05, sz * 0.17];
    const foot: V3 = [sx * 0.2, 0.024, sz * 0.2];
    b.segment(new THREE.Vector3(...hip), new THREE.Vector3(...knee), (l) => (lite ? geo.box(0.03, l, 0.03) : capsule(0.017, 0.015, l + 0.02, lo ? 6 : 10, 1)), metal);
    b.segment(new THREE.Vector3(...knee), new THREE.Vector3(...foot), (l) => (lite ? geo.box(0.024, l, 0.024) : capsule(0.014, 0.011, l + 0.01, lo ? 6 : 10, 1)), plate, (l) => {
      if (!lo) b.add(geo.cyl(0.0165, 0.0165, l * 0.3, 10, true), mat.dark, { p: [0, l * 0.62, 0] });
    });
    if (!lo) b.tube([hip[0] * 1.05, y + 0.035, hip[2] * 1.05], [knee[0] * 0.93, knee[1] + 0.02, knee[2] * 0.93], 0.005, 6, mat.metalLight);
    b.add(geo.sphere(0.022, lite ? 6 : 10, lite ? 3 : 5), metal, { p: knee });
    if (!lo) b.add(geo.hemi(0.024, 10, 3), plate, { p: [knee[0] * 1.06, knee[1] + 0.004, knee[2] * 1.06], r: [sz * 0.9, 0, -sx * 0.9] });
    b.add(geo.cyl(0.022, 0.03, 0.014, lite ? 6 : 10), glow, { p: [foot[0], 0.007, foot[2]] });
    if (!lo) b.add(geo.cyl(0.016, 0.022, 0.012, 10), metal, { p: [foot[0], 0.019, foot[2]] });
  }
  // Sechseck-Plattform mit Unterbau und Lueftern / hexagonal platform with an underbody and vents
  b.add(geo.cyl(0.13, 0.11, 0.05, 6), plate, { p: [0, y, 0] });
  b.add(geo.cyl(0.132, 0.132, 0.008, 6), glow, { p: [0, y + 0.012, 0] });
  if (!lo) {
    b.add(geo.cyl(0.09, 0.05, 0.04, 6), metal, { p: [0, y - 0.044, 0] });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      b.box(0.04, 0.006, 0.012, mat.dark, [Math.sin(a) * 0.105, y + 0.026, Math.cos(a) * 0.105], [0, a, 0]);
    }
  }
  if (!lo) flakDroneDetail(b, L, y);
  // Drehkopf mit vier Laeufen nach oben / turret head with four barrels pointing up
  b.cyl(0.06, 0.07, 0.03, lite ? 8 : 12, metal, [0, y + 0.04, 0]);
  b.add(lite ? geo.box(0.14, 0.07, 0.1) : geo.rbox(0.14, 0.07, 0.1, 0.018), plate, { p: [0, y + 0.085, -0.01] });
  b.add(geo.sphere(0.016, lite ? 6 : 8, lite ? 3 : 4), glow, { p: [0, y + 0.09, 0.045] });
  b.group({ p: [0, y + 0.1, 0.0], r: [-1.0, 0, 0] }, () => {
    for (const x of [-0.045, 0.045]) for (const yy of [-0.012, 0.016]) {
      b.cyl(0.008, 0.008, 0.22, lite ? 5 : 8, metal, [x, yy, 0.13], [HALF_PI, 0, 0]);
      b.cyl(0.011, 0.011, 0.02, lite ? 5 : 8, glow, [x, yy, 0.24], [HALF_PI, 0, 0]);
      if (!lo) {
        // Kuehlringe und Muendungsschlitze / cooling rings and muzzle slots
        for (const z of [0.09, 0.12, 0.15]) b.add(geo.cyl(0.0105, 0.0105, 0.004, 10), mat.dark, { p: [x, yy, z], r: [HALF_PI, 0, 0] });
        for (const s of [-1, 1]) b.box(0.003, 0.003, 0.014, mat.ink, [x + s * 0.0112, yy, 0.24]);
      }
    }
    if (!lo) {
      // Munitionstrommeln mit Zufuehrung / ammo drums with feed chutes
      for (const s of [-1, 1]) {
        b.add(geo.cyl(0.026, 0.026, 0.022, 14), metal, { p: [s * 0.085, 0.0, 0.02], r: [0, 0, HALF_PI] });
        b.add(geo.cyl(0.018, 0.018, 0.024, 12), glow, { p: [s * 0.085, 0.0, 0.02], r: [0, 0, HALF_PI] });
        b.add(geo.cyl(0.027, 0.027, 0.004, 14), mat.dark, { p: [s * 0.098, 0.0, 0.02], r: [0, 0, HALF_PI] });
        cable(b, [s * 0.075, 0.012, 0.03], [s * 0.05, 0.004, 0.06], 0.004, 0.005, mat.dark);
      }
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

/**
 * Flak-Drohne, hohe Qualitaet: Plattenfugen und Bolzen auf der Plattform, Kabelbuendel zu den Beinen, Sensorgruppe vorn,
 * Lueftungsschlitze am Kopf, Krallen an den Fuessen, Antennenfuss.
 * Flak drone, high quality: panel joints and bolts on the platform, cable bundles to the legs, front sensor cluster, vent
 * slots on the head, claws on the feet, antenna base.
 */
function flakDroneDetail(b: Builder, L: Look, y: number) {
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    seam(b, [Math.sin(a) * 0.07, y + 0.026, Math.cos(a) * 0.07], [Math.sin(a) * 0.12, y + 0.026, Math.cos(a) * 0.12], shade(plate, 0.7));
  }
  boltRing(b, [0, y + 0.027, 0], 0.112, 12, shade(plate, 0.6), 0.0045, Math.PI / 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cable(b, [sx * 0.06, y - 0.03, sz * 0.06], [sx * 0.15, y + 0.03, sz * 0.15], 0.01, 0.0035, mat.dark);
    for (const k of [-1, 1]) b.add(geo.cone(0.005, 0.018, 5), metal, { p: [sx * 0.2 + sx * 0.022, 0.006, sz * 0.2 + k * 0.012], r: [0, 0, -sx * 1.8] });
  }
  sensorCluster(b, [0, y + 0.075, 0.042], 3, 0.0055, glow);
  for (const s of [-1, 1]) vents(b, [s * 0.071, y + 0.085, -0.01], [0, 0, s * HALF_PI], 4, 0.05, 0.012);
  antennaBase(b, 0.04, y + 0.12, -0.04, metal);
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
