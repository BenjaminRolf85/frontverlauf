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
  });
  if (!lite) {
    // Radar hinten / radar at the rear
    if (st === 'alvenia' || st === 'velkar') dish(b, 0.06, top + 0.03, tz - 0.12, 0.05, -0.5, st === 'velkar' ? L.hullDark : mat.white);
    else {
      b.tube([0.07, top + 0.03, tz - 0.11], [0.07, top + 0.13, tz - 0.11], 0.006, 5, mat.dark);
      b.box(0.11, 0.035, 0.008, mat.metal, [0.07, top + 0.145, tz - 0.11], [0, 0.4, 0]);
      for (let i = 0; i < 4; i++) b.box(0.004, 0.035, 0.01, mat.dark, [0.03 + i * 0.027, top + 0.145, tz - 0.105], [0, 0.4, 0]);
    }
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
  // Proportion: das laengste und flachste Kettenfahrzeug (Wanne 0.44 statt 0.36 lang), damit es sich in Masse und Umriss
  // vom Panzer (hoher Turm) und von der Flak (kurz, hoch) trennt / proportion: the longest and flattest tracked vehicle (hull
  // 0.44 instead of 0.36 long) so it separates in mass and outline from the tank (tall turret) and the AA (short, tall)
  const HL = 0.44, dz = (HL - 0.36) / 2;
  // niedrige Qualitaet: vier Laufrollen wie zuvor (gleiches Budget) / low quality: four road wheels as before (same budget)
  tracks(b, { x: 0.125, w: 0.065, len: HL, h: 0.08, wheels: unitLow() ? 4 : 5, wr: 0.026, sprocket: L.trim, hub: L.secondary, lite, links: 8 });
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
  // Minenwanne hinten: eine flache Lage Tellerminen hinter niedrigen Bordwaenden (statt des hohen Gestells, das wie ein Turm wirkte)
  // mine tray at the rear: one flat layer of disc mines behind low side boards (instead of the tall rack that read as a turret)
  const rz = -0.1 - dz;
  b.box(0.23, 0.01, 0.2, mat.darkMid, [0, top + 0.005, rz]);
  for (const s of [-1, 1]) b.add(lite ? geo.box(0.012, 0.035, 0.2) : geo.cbox(0.012, 0.035, 0.2, 0.004), L.trim, { p: [s * 0.115, top + 0.022, rz] });
  b.add(lite ? geo.box(0.23, 0.035, 0.012) : geo.cbox(0.23, 0.035, 0.012, 0.004), L.trim, { p: [0, top + 0.022, rz - 0.1] });
  if (!lite) hazardStripes(b, 0, top + 0.022, rz - 0.107, 0.2, 0.024, 5, Math.PI);
  for (const x of [-0.06, 0.0, 0.06]) for (const z of [rz - 0.05, rz + 0.04]) discMine(b, [x, top + 0.022, z], 0.03, L.hullDark, L.secondary, lite);
  // Rutsche mit fallender Mine / chute with a dropping mine
  b.group({ p: [0, 0.09, -0.22 - dz], r: [-0.7, 0, 0] }, () => {
    b.box(0.08, 0.006, 0.12, mat.metal, [0, 0, -0.04]);
    for (const s of [-1, 1]) b.box(0.006, 0.02, 0.12, mat.metal, [s * 0.04, 0.01, -0.04]);
  });
  discMine(b, [0, 0.014, -0.28 - dz], 0.032, L.hullDark, L.secondary, lite);
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
