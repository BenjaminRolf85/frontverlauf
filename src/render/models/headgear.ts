/**
 * Koepfe und Kopfbedeckungen je Fraktion / heads and headgear per faction.
 * Jede Fraktion ist allein an der Silhouette der Kopfbedeckung erkennbar (auch von oben):
 * Each faction is recognisable by its headgear silhouette alone (also from above):
 * - Korvat: runder Serien-Stahlhelm mit breiter, ausgestellter Krempe, rotem Band, Nieten, Kinnriemen, Zahnrad-Plakette
 *   / round mass-produced steel helmet with wide flared rim, red band, rivets, chinstrap, cog badge
 * - Dravon: schwarze Sturmhaube mit Augenausschnitt, Strickrillen und kleinem goldenen Faust-Abzeichen
 *   / black balaclava with eye opening, knit ribs and a small gold fist badge
 * - Alvenia: offener Helm mit Schirm, Schutzbrille mit Riemen, Seitenschienen, Stern-im-Ring-Abzeichen
 *   / open helmet with peak, strapped goggles, side rails, star-in-ring badge
 * - Meridon: schraeges Barett mit Kompassrosen-Abzeichen, Headset mit Mikrofon, Sonnenbrille
 *   / tilted beret with compass-rose badge, headset with mic boom, sunglasses
 * - Velkar: Hightech-Helm mit hochgeklapptem Visier, Antenne, Sensorleuchte, Sechseck-Abzeichen, Schneetarnbezug
 *   / high-tech helmet with flipped-up visor, antenna, sensor lamp, hexagon badge, snow-camo cover
 * Kopf: Boden bei y=0, Gesicht nach +z / head: base at y=0, face towards +z.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng, shade, type ColorLike, type V3 } from './kit';
import { mat, type Look } from './look';

export type Detail = 0 | 1 | 2;
const HALF_PI = Math.PI / 2;

/** Offener Ring (Band) / open ring (band) */
function ring(b: Builder, r: number, h: number, seg: number, c: ColorLike, p: V3, s: V3 = [1, 1, 1], r2 = r) {
  b.add(geo.cyl(r, r2, h, seg, true), c, { p, s });
}

/** Teil auf einer Kugelflaeche, entlang der Normalen ausgerichtet / part on a sphere surface, aligned to the normal */
function onDome(b: Builder, centre: V3, rad: number, scale: V3, theta: number, phi: number, make: () => THREE.BufferGeometry, c: ColorLike) {
  const n = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
  const p = new THREE.Vector3(n.x * rad * scale[0], n.y * rad * scale[1], n.z * rad * scale[2]).add(new THREE.Vector3(...centre));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  b.add(make(), c, { p: [p.x, p.y, p.z], r: [e.x, e.y, e.z] });
}

/** Gesicht mit Augen, Brauen, Nase, Mund / face with eyes, brows, nose, mouth */
function face(b: Builder, d: Detail, glasses: 'none' | 'sun' | 'spy', seed: number) {
  const R = rng(seed);
  b.add(d >= 1 ? geo.rbox(0.104, 0.098, 0.1, 0.02) : geo.box(0.104, 0.098, 0.1), mat.skin, { p: [0, 0.049, 0] });
  // Nase / nose
  b.add(d === 2 ? geo.rtaper(0.024, 0.022, 0.018, 0.014, 0.03, 0.005) : geo.box(0.022, 0.026, 0.018), shade(mat.skin, 0.9), { p: [0, 0.04, 0.056] });
  if (glasses === 'none') {
    for (const s of [-1, 1]) {
      if (d >= 1) {
        b.box(0.022, 0.024, 0.006, mat.white, [s * 0.024, 0.058, 0.0505]);
        b.box(0.011, 0.018, 0.006, mat.ink, [s * 0.021, 0.056, 0.0525]);
      } else {
        b.box(0.015, 0.026, 0.008, mat.ink, [s * 0.024, 0.058, 0.051]);
      }
      if (d === 2) b.box(0.026, 0.007, 0.007, mat.ink, [s * 0.025, 0.078 + R() * 0.004, 0.0515], [0, 0, s * (-0.12 - R() * 0.15)]);
    }
  }
  if (d >= 1) b.box(0.03, 0.006, 0.005, shade(mat.skin, 0.55), [0.004, 0.018, 0.0505], [0, 0, -0.08]);
  if (d === 2) for (const s of [-1, 1]) b.add(geo.rbox(0.014, 0.03, 0.024, 0.005), shade(mat.skin, 0.9), { p: [s * 0.055, 0.048, -0.004] });
}

function sunglasses(b: Builder, d: Detail, c: ColorLike = mat.ink) {
  for (const s of [-1, 1]) {
    b.add(d >= 1 ? geo.rbox(0.036, 0.02, 0.008, 0.004) : geo.box(0.036, 0.02, 0.008), c, { p: [s * 0.024, 0.06, 0.054] });
    if (d >= 1) b.box(0.004, 0.006, 0.07, c, [s * 0.053, 0.064, 0.02]);
  }
  b.box(0.016, 0.006, 0.006, c, [0, 0.064, 0.054]);
}

/** Fremdwesen-Kopf statt Helm (Zyrr) / alien head instead of a helmet (Zyrr) */
export function alienHead(b: Builder, L: Look, d: Detail, antenna = true) {
  const seg = d === 2 ? 16 : d === 1 ? 12 : 8;
  const skin = mat.alienSkin;
  b.add(geo.sphere(0.072, seg, Math.max(4, Math.round(seg * 0.6))), skin, { p: [0, 0.085, -0.006], s: [1.02, 1.12, 1.0] });
  b.add(geo.sphere(0.042, Math.max(8, seg - 4), 5), skin, { p: [0, 0.03, 0.012], s: [0.8, 1.0, 0.85] });
  // grosse schwarze Mandelaugen / big black almond eyes
  for (const sx of [-1, 1]) {
    b.add(geo.sphere(0.024, Math.max(8, seg - 4), 6), mat.ink, { p: [sx * 0.031, 0.072, 0.056], r: [0, sx * 0.35, sx * -0.5], s: [1.5, 0.72, 0.55] });
    if (d === 2) b.add(geo.sphere(0.006, 6, 3), mat.white, { p: [sx * 0.024, 0.08, 0.068] });
  }
  if (d >= 1) {
    for (const sx of [-1, 1]) b.box(0.004, 0.004, 0.004, mat.alienSkinDark, [sx * 0.006, 0.042, 0.05]);
    b.box(0.018, 0.003, 0.004, mat.alienSkinDark, [0, 0.022, 0.046]);
    // Zeichnung in Fraktionsfarbe / markings in faction colour
    for (const sx of [-1, 1]) b.box(0.006, 0.05, 0.02, L.primary, [sx * 0.07, 0.1, -0.01], [0, 0, sx * 0.2]);
  }
  if (antenna) {
    b.tube([0.02, 0.15, -0.01], [0.038, 0.205, -0.022], 0.0035, 4, mat.alienSkinDark);
    b.add(geo.ico(0.009, 0), mat.acid, { p: [0.039, 0.208, -0.023] });
  }
}

/** Spionage-Hut je Fraktion / spy hat per faction */
function spyHat(b: Builder, f: FactionId, L: Look, d: Detail, ws: number) {
  if (f === 'zyrr') {
    // Fremdwesen mit Hut und Sonnenbrille / alien with hat and sunglasses
    alienHead(b, L, d, false);
    sunglasses(b, d);
    b.cyl(0.1, 0.102, 0.01, ws, L.primary, [0, 0.142, -0.006]);
    b.add(geo.cyl(0.056, 0.064, 0.055, ws), L.primary, { p: [0, 0.172, -0.006], s: [1, 1, 0.92] });
    ring(b, 0.065, 0.016, ws, L.secondary, [0, 0.155, -0.006], [1, 1, 0.93]);
    return;
  }
  face(b, d, 'spy', 5);
  sunglasses(b, d);
  switch (f) {
    case 'korvat':
      // Schiebermuetze / flat cap with peak
      b.add(geo.sphere(0.07, ws, 5), L.secondary, { p: [0, 0.098, -0.006], s: [1.08, 0.42, 1.12] });
      b.add(geo.cyl(0.05, 0.05, 0.008, ws), shade(L.secondary, 0.7), { p: [0, 0.088, 0.055], s: [1.1, 1, 0.75], r: [0.15, 0, 0] });
      b.cyl(0.008, 0.008, 0.006, 6, L.primary, [0, 0.127, -0.004]);
      ring(b, 0.072, 0.012, ws, L.primary, [0, 0.09, -0.006], [1.04, 1, 1.08]);
      break;
    case 'dravon':
      // schwarzer Fedora mit Goldband / black fedora with gold band
      b.cyl(0.094, 0.096, 0.012, ws, L.helmet, [0, 0.092, 0]);
      b.add(geo.rtaper(0.11, 0.11, 0.095, 0.08, 0.065, 0.02), L.helmet, { p: [0, 0.13, 0] });
      ring(b, 0.058, 0.016, ws, L.secondary, [0, 0.108, 0], [1.02, 1, 1]);
      b.box(0.02, 0.012, 0.06, shade(L.helmet, 0.75), [0, 0.164, 0]);
      break;
    case 'alvenia':
      // weisser Breitkrempenhut mit blauem Band / white wide-brim hat with blue band
      b.cyl(0.108, 0.11, 0.01, ws, L.secondary, [0, 0.092, 0]);
      b.add(geo.cyl(0.052, 0.06, 0.06, ws), L.secondary, { p: [0, 0.128, 0], s: [1, 1, 0.92] });
      ring(b, 0.061, 0.018, ws, L.primary, [0, 0.107, 0], [1, 1, 0.93]);
      addEmblem(b, 'alvenia', 0.009, 0.004, L.secondary, { p: [-0.035, 0.108, 0.048], r: [0, -0.6, 0] });
      break;
    case 'meridon':
      // flacher Strohhut / flat straw hat
      b.cyl(0.118, 0.12, 0.008, ws, mix(L.secondary, mat.sand, 0.45), [0, 0.092, 0]);
      b.cyl(0.055, 0.06, 0.04, ws, mix(L.secondary, mat.sand, 0.45), [0, 0.115, 0]);
      ring(b, 0.061, 0.016, ws, L.primary, [0, 0.104, 0]);
      break;
    case 'velkar':
      // Strickmuetze mit Streifen und Bommel / knit cap with stripe and bobble
      b.add(geo.hemi(0.07, ws, 4), L.primary, { p: [0, 0.075, -0.004], s: [1.06, 1.2, 1.08] });
      ring(b, 0.075, 0.02, ws, shade(L.primary, 0.8), [0, 0.08, -0.004], [1, 1, 1.02]);
      ring(b, 0.07, 0.012, ws, L.secondary, [0, 0.105, -0.004], [0.96, 1, 1]);
      b.add(geo.ico(0.02, d >= 1 ? 1 : 0), mat.snow, { p: [0, 0.165, -0.004] });
      break;
  }
}

/** Kopf + Kopfbedeckung / head + headgear */
export function headgear(b: Builder, f: FactionId, L: Look, d: Detail, fedora: boolean, seed = 1) {
  const ws = d === 2 ? 18 : d === 1 ? 12 : 10;
  const hs = d === 2 ? 6 : d === 1 ? 5 : 3;
  const hc = L.helmet;
  if (fedora) {
    spyHat(b, f, L, d, ws);
    return;
  }
  if (f === 'zyrr') {
    alienHead(b, L, d);
    return;
  }
  switch (f) {
    case 'korvat': {
      face(b, d, 'none', seed);
      const C: V3 = [0, 0.068, -0.004];
      const S: V3 = [1, 0.9, 1.06];
      b.add(geo.hemi(0.086, ws, hs), hc, { p: C, s: S });
      // breite, ausgestellte Krempe mit Kante / wide flared rim with edge
      b.add(geo.cyl(0.088, 0.116, 0.016, ws), shade(hc, 0.85), { p: [0, 0.061, -0.004], s: [1, 1, 1.05] });
      ring(b, 0.117, 0.007, ws, shade(hc, 0.55), [0, 0.0535, -0.004], [1, 1, 1.05]);
      // rotes Krempenband (auch von oben sichtbar) / red rim band (visible from above)
      b.cyl(0.108, 0.108, 0.004, ws, L.primary, [0, 0.067, -0.004]);
      // rotes Band / red band
      ring(b, 0.0865, 0.016, ws, L.primary, [0, 0.077, -0.004], [1, 1, 1.06], 0.0875);
      if (d === 2) {
        // Nieten / rivets
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          onDome(b, C, 0.086, S, a, 1.15, () => geo.sphere(0.005, 5, 3), shade(hc, 0.65));
        }
        // Kinnriemen / chinstrap
        for (const s of [-1, 1]) b.box(0.006, 0.07, 0.01, mat.dark, [s * 0.055, 0.03, 0.016], [0.12, 0, 0]);
        b.box(0.108, 0.008, 0.012, mat.dark, [0, -0.004, 0.024]);
      }
      if (d >= 1) {
        // Zahnrad-Plakette / cog badge plate
        b.group({ p: [0, 0.107, 0.075], r: [-0.55, 0, 0] }, () => {
          b.cyl(0.021, 0.021, 0.006, 12, L.primary, [0, 0, 0], [HALF_PI, 0, 0]);
          addEmblem(b, 'korvat', 0.016, 0.004, shade(L.secondary, 1.35), { p: [0, 0, 0.004] });
        });
      } else {
        b.box(0.03, 0.022, 0.01, L.primary, [0, 0.106, 0.074], [-0.55, 0, 0]);
      }
      break;
    }
    case 'dravon': {
      // schwarze Sturmhaube mit Augenausschnitt + flaches Barett mit Goldrand und Faust-Abzeichen
      // black balaclava with eye opening + flat beret with gold edge and fist badge
      const knit = shade(hc, 1.35);
      b.add(d >= 1 ? geo.rbox(0.112, 0.106, 0.108, 0.026) : geo.box(0.112, 0.106, 0.108), hc, { p: [0, 0.052, 0] });
      // Augenausschnitt mit Haut und Augen / eye opening with skin and eyes
      b.add(d >= 1 ? geo.rbox(0.082, 0.026, 0.01, 0.006) : geo.box(0.082, 0.026, 0.01), mat.skin, { p: [0, 0.062, 0.051] });
      for (const sx of [-1, 1]) {
        if (d >= 1) {
          b.box(0.02, 0.016, 0.006, mat.white, [sx * 0.021, 0.062, 0.0565]);
          b.box(0.01, 0.012, 0.006, mat.ink, [sx * 0.018, 0.061, 0.0585]);
          if (d === 2) b.box(0.024, 0.006, 0.006, mat.ink, [sx * 0.022, 0.074, 0.0565], [0, 0, sx * -0.25]);
        } else {
          b.box(0.014, 0.016, 0.008, mat.ink, [sx * 0.02, 0.062, 0.057]);
        }
      }
      // Nasenwoelbung und Mundoeffnung / nose bulge and mouth opening
      if (d >= 1) {
        b.add(geo.rtaper(0.024, 0.02, 0.016, 0.012, 0.026, 0.005), hc, { p: [0, 0.04, 0.058] });
        b.add(geo.rbox(0.03, 0.01, 0.008, 0.004), mat.ink, { p: [0, 0.02, 0.054] });
      }
      // Strickrillen am Hals / knit ribs at the neck
      if (d >= 1) {
        for (const y of d === 2 ? [0.004, 0.012, 0.02] : [0.008]) ring(b, 0.058, 0.004, ws, knit, [0, y, 0], [1, 1, 0.98]);
      }
      // Oberseite rund, kleines goldenes Faust-Abzeichen seitlich / rounded top, small gold fist badge on the side
      b.add(geo.hemi(0.058, ws, hs), hc, { p: [0, 0.098, 0], s: [0.98, 0.42, 0.96] });
      if (d >= 1) {
        b.group({ p: [-0.057, 0.056, 0.004], r: [0, -HALF_PI, 0] }, () => {
          b.cyl(0.015, 0.015, 0.004, 10, L.secondary, [0, 0, 0], [HALF_PI, 0, 0]);
          addEmblem(b, 'dravon', 0.011, 0.004, hc, { p: [0, 0, 0.003] });
        });
      }
      break;
    }
    case 'alvenia': {
      face(b, d, 'none', seed);
      const C: V3 = [0, 0.074, -0.004];
      b.add(geo.hemi(0.086, ws, hs), hc, { p: C, s: [1, 0.95, 1.04] });
      ring(b, 0.0875, 0.016, ws, L.secondary, [0, 0.078, -0.004], [1, 1, 1.04], 0.089);
      // Schirm vorn / front peak
      b.add(geo.cyl(0.07, 0.07, 0.008, ws), hc, { p: [0, 0.072, 0.052], s: [1, 1, 0.5], r: [0.14, 0, 0] });
      // Brillenriemen + Brille / goggle strap + goggles
      ring(b, 0.082, 0.012, ws, mat.dark, [0, 0.1, -0.004], [1, 1, 1.04]);
      for (const x of [-0.027, 0.027]) {
        if (d >= 1) b.add(geo.cyl(0.022, 0.022, 0.018, 12, true), L.secondary, { p: [x, 0.108, 0.07], r: [HALF_PI - 0.45, 0, 0] });
        b.cyl(0.017, 0.017, 0.014, d >= 1 ? 12 : 8, mat.glass, [x, 0.108, 0.07], [HALF_PI - 0.45, 0, 0]);
      }
      b.box(0.014, 0.008, 0.008, mat.dark, [0, 0.108, 0.075]);
      if (d >= 1) {
        // Seitenschienen mit Lampe / side rails with lamp
        for (const s of [-1, 1]) {
          b.box(0.008, 0.014, 0.064, mat.dark, [s * 0.085, 0.086, -0.008]);
          if (d === 2) for (const z of [-0.03, 0.014]) b.box(0.006, 0.006, 0.006, mat.metalLight, [s * 0.09, 0.086, z]);
        }
        b.add(geo.cyl(0.008, 0.009, 0.026, 8), mat.dark, { p: [0.092, 0.086, 0.032], r: [HALF_PI, 0, 0] });
        b.cyl(0.007, 0.007, 0.003, 8, mat.yellow, [0.092, 0.086, 0.046], [HALF_PI, 0, 0]);
        // Stern-im-Ring-Abzeichen / star-in-ring badge
        addEmblem(b, 'alvenia', 0.018, 0.004, L.secondary, { p: [-0.084, 0.092, -0.022], r: [0, -HALF_PI, 0.12] });
      }
      if (d === 2) {
        for (const s of [-1, 1]) b.box(0.006, 0.06, 0.008, mat.dark, [s * 0.055, 0.04, 0.022], [0.15, 0, 0]);
        b.box(0.106, 0.008, 0.01, mat.dark, [0, 0.004, 0.03]);
      }
      break;
    }
    case 'meridon': {
      face(b, d, 'sun', seed);
      sunglasses(b, d);
      // Haare / hair
      b.add(d >= 1 ? geo.rbox(0.11, 0.04, 0.07, 0.01) : geo.box(0.11, 0.04, 0.07), mat.dark, { p: [0, 0.084, -0.024] });
      // Barett / beret
      b.group({ p: [0.014, 0.106, -0.004], r: [0.05, 0, -0.26] }, () => {
        b.add(geo.sphere(0.072, ws, hs + 1), hc, { s: [1.2, 0.4, 1.14] });
        ring(b, 0.064, 0.018, ws, shade(L.primary, 0.7), [-0.006, -0.016, 0], [1.02, 1, 1]);
        b.cyl(0.006, 0.008, 0.012, 6, shade(hc, 0.7), [0, 0.034, 0]);
        if (d >= 1) {
          // Kompassrosen-Abzeichen / compass-rose badge
          b.group({ p: [0.02, -0.008, 0.066], r: [0, 0.3, 0] }, () => {
            b.cyl(0.017, 0.017, 0.004, 10, L.primary, [0, 0, 0], [HALF_PI, 0, 0]);
            addEmblem(b, 'meridon', 0.015, 0.004, mat.paper, { p: [0, 0, 0.003] });
          });
        }
      });
      // Headset mit Mikrofon / headset with mic boom
      b.cyl(0.024, 0.024, 0.016, d >= 1 ? 12 : 8, mat.dark, [0.06, 0.05, 0], [0, 0, HALF_PI]);
      b.cyl(0.014, 0.014, 0.018, 8, L.secondary, [0.062, 0.05, 0], [0, 0, HALF_PI]);
      b.box(0.008, 0.07, 0.012, mat.dark, [0.056, 0.09, -0.004], [0, 0, 0.2]);
      b.tube([0.064, 0.044, 0.012], [0.03, 0.02, 0.062], 0.003, 4, mat.dark);
      b.add(geo.ico(0.007, 0), mat.ink, { p: [0.028, 0.019, 0.064] });
      break;
    }
    case 'velkar': {
      face(b, d, 'none', seed);
      const C: V3 = [0, 0.068, -0.006];
      const S: V3 = [1, 1, 1.05];
      b.add(geo.hemi(0.089, ws, hs), hc, { p: C, s: S });
      ring(b, 0.091, 0.024, ws, shade(hc, 0.82), [0, 0.068, -0.006], [1, 1, 1.05], 0.092);
      // Schneetarnbezug / snow-camo cover
      const R = rng(41);
      const tones = [mat.snow, mix(L.secondary, mat.snow, 0.35), shade(hc, 1.25)];
      const n = d === 2 ? 8 : d === 1 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const theta = (i / n) * Math.PI * 2 + R() * 0.5;
        const phi = 0.25 + R() * 1.0;
        onDome(b, C, 0.089, S, theta, phi, () => geo.cyl(0.016 + R() * 0.01, 0.018 + R() * 0.01, 0.006, 6), tones[i % 3]);
      }
      // hochgeklapptes Visier mit Scharnieren / flipped-up visor with hinges
      b.add(geo.rtaper(0.124, 0.014, 0.112, 0.012, 0.046, d >= 1 ? 0.005 : 0.001), mix(L.secondary, mat.glassDark, 0.5), { p: [0, 0.125, 0.06], r: [-0.95, 0, 0] });
      for (const s of [-1, 1]) b.cyl(0.012, 0.012, 0.014, 8, mat.dark, [s * 0.086, 0.1, 0.03], [0, 0, HALF_PI]);
      // Antenne links, Sensorleuchte rechts / antenna left, sensor lamp right
      b.add(d >= 1 ? geo.cbox(0.016, 0.03, 0.024, 0.005) : geo.box(0.016, 0.03, 0.024), mat.dark, { p: [-0.09, 0.09, -0.03] });
      b.tube([-0.09, 0.1, -0.034], [-0.1, 0.24, -0.06], 0.0045, 5, mat.dark);
      b.add(geo.ico(0.013, 0), L.secondary, { p: [-0.1, 0.245, -0.061] });
      b.add(geo.cyl(0.013, 0.015, 0.034, 10), mat.dark, { p: [0.09, 0.085, 0.022], r: [HALF_PI, 0, 0] });
      b.cyl(0.011, 0.011, 0.004, 10, L.secondary, [0.09, 0.085, 0.04], [HALF_PI, 0, 0]);
      // Ohrschalen / ear cups
      if (d >= 1) for (const s of [-1, 1]) b.cyl(0.024, 0.024, 0.02, 10, L.gear, [s * 0.066, 0.05, -0.004], [0, 0, HALF_PI]);
      // Sechseck-Abzeichen / hexagon badge
      if (d >= 1) addEmblem(b, 'velkar', 0.014, 0.004, L.secondary, { p: [0, 0.155, 0.032], r: [-1.0, 0, 0] });
      break;
    }
  }
}
