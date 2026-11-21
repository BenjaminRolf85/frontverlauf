/**
 * Koepfe und Kopfbedeckungen je Fraktion / heads and headgear per faction.
 * Jede Fraktion ist allein an der Silhouette der Kopfbedeckung erkennbar (auch von oben):
 * Each faction is recognisable by its headgear silhouette alone (also from above):
 * - Korvat: runder Serien-Stahlhelm mit breiter, ausgestellter Krempe, rotem Band, Nieten, Kinnriemen, Zahnrad-Plakette
 *   / round mass-produced steel helmet with wide flared rim, red band, rivets, chinstrap, cog badge
 * - Dravon: schwarze Sturmhaube mit Augenausschnitt, Strickrillen und kleinem goldenen Faust-Abzeichen
 *   / black balaclava with eye opening, knit ribs and a small gold fist badge
 * - Alvenia: weisser Paladinhelm mit Wangenschutz, Goldkamm und Stirnstern, tuerkise Seitenleuchten, schwebender Sonnenkranz
 *   / white paladin helmet with cheek guards, gold crest and brow star, teal side lights, floating sun halo
 * - Meridon: schraeges Barett mit Kompassrosen-Abzeichen, Headset mit Mikrofon, Sonnenbrille
 *   / tilted beret with compass-rose badge, headset with mic boom, sunglasses
 * - Velkar: frostweisser Visierhelm mit tuerkiser Leuchtlinse, Kamm, Antenne, Sensorleuchte, Sechseck-Abzeichen ("Labor im Feld")
 *   / frost-white visor helmet with a glowing teal lens, crest, antenna, sensor lamp, hexagon badge ("lab in the field")
 * Kopf: Boden bei y=0, Gesicht nach +z / head: base at y=0, face towards +z.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { ball, Builder, fine, geo, mix, rng, shade, softBox, type ColorLike, type LathePoint, type V3 } from './kit';
import { mat, type Look } from './look';
import { TECH } from './velkarTech';
import { FAITH, faithStar, haloRing } from './alveniaFaith';

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
export function face(b: Builder, d: Detail, glasses: 'none' | 'sun' | 'spy', seed: number) {
  const R = rng(seed);
  // runder Kopf: Rundungsschritte je Detailstufe / round head: rounding steps per detail level
  b.add(softBox(0.104, 0.098, 0.1, 0.027, headSteps(d)), mat.skin, { p: [0, 0.049, 0] });
  // Nase / nose
  const roundNose = d === 2 || (d === 1 && fine());
  b.add(roundNose ? ball(1, d === 2 ? 8 : 6, d === 2 ? 5 : 4) : geo.box(0.022, 0.026, 0.018), shade(mat.skin, 0.9), { p: [0, 0.04, roundNose ? 0.053 : 0.056], s: roundNose ? [0.0125, 0.015, 0.0125] : 1 });
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
  if (d === 2) for (const s of [-1, 1]) b.add(softBox(0.014, 0.03, 0.024, 0.006, fine() ? 1 : 0), shade(mat.skin, 0.9), { p: [s * 0.055, 0.048, -0.004] });
}

/** Rundungsschritte eines Kopfes: bei hoher Qualitaet 1 (Besatzung 0), sonst 0 / rounding steps of a head: 1 on high quality (crew 0), else 0 */
function headSteps(d: Detail): number {
  return d >= 1 && fine() ? 1 : 0;
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

/** Kultkapuze mit Knochenmaske (Vesper) / cult hood with bone mask (Vesper) */
export function cultHood(b: Builder, L: Look, d: Detail, spy: boolean) {
  const seg = d === 2 ? 16 : d === 1 ? 12 : 8;
  const robe = L.helmet;
  b.add(geo.sphere(0.084, seg, Math.max(4, Math.round(seg * 0.6))), robe, { p: [0, 0.075, -0.012], s: [1.02, 1.12, 1.06] });
  b.add(geo.cone(0.05, 0.08, d >= 1 ? 8 : 5), robe, { p: [0, 0.15, -0.055], r: [-0.95, 0, 0] });
  b.add(geo.torus(0.058, 0.013, 4, seg), shade(robe, 0.75), { p: [0, 0.07, 0.058], s: [1, 1.2, 1] });
  b.add(geo.sphere(0.05, Math.max(6, seg - 4), 4), mat.ink, { p: [0, 0.07, 0.05], s: [1, 1.15, 0.4] });
  // Knochenmaske mit Glut-Augenschlitzen / bone mask with ember eye slits
  b.add(d >= 1 ? geo.rtaper(0.074, 0.016, 0.064, 0.014, 0.086, 0.006) : geo.box(0.07, 0.086, 0.015), mat.bone, { p: [0, 0.068, 0.064], r: [-0.08, 0, 0] });
  for (const sx of [-1, 1]) b.box(0.022, 0.008, 0.004, mat.ember, [sx * 0.018, 0.08, 0.073], [0, 0, sx * 0.3]);
  if (d >= 1) {
    for (const x of [-0.012, 0, 0.012]) b.box(0.004, 0.016, 0.004, mat.ink, [x, 0.042, 0.072]);
    b.box(0.006, 0.03, 0.004, shade(mat.bone, 0.75), [0.022, 0.06, 0.072], [0, 0, 0.4]);
  }
  // rotes Stirnband / red headband
  b.add(geo.cyl(0.0875, 0.0875, 0.016, seg, true), L.primary, { p: [0, 0.112, -0.012], s: [1.02, 1, 1.07] });
  if (d === 2) for (const sx of [-1, 1]) b.box(0.012, 0.04, 0.004, L.primary, [sx * 0.012, 0.09, -0.105], [0.2, 0, sx * 0.3]);
  if (spy) {
    b.cyl(0.125, 0.127, 0.01, seg, robe, [0, 0.16, -0.01]);
    b.add(geo.cyl(0.058, 0.066, 0.055, seg), robe, { p: [0, 0.19, -0.01], s: [1, 1, 0.92] });
    b.add(geo.cyl(0.067, 0.067, 0.016, seg, true), L.primary, { p: [0, 0.172, -0.01], s: [1, 1, 0.93] });
  }
}

/** Roboterkopf mit leuchtendem Visierstreifen (Nexus) / robot head with glowing visor strip (Nexus) */
export function robotHead(b: Builder, L: Look, d: Detail, spy: boolean) {
  const plate = L.helmet;
  const metal = mat.gunmetal;
  const glow = mat.cyanGlow;
  b.add(softBox(0.104, 0.1, 0.104, 0.02, headSteps(d)), plate, { p: [0, 0.058, 0] });
  b.add(d >= 1 ? geo.rtaper(0.084, 0.07, 0.074, 0.06, 0.03, 0.008) : geo.box(0.08, 0.03, 0.07), metal, { p: [0, 0.012, 0.008] });
  b.box(0.104, 0.03, 0.006, metal, [0, 0.066, 0.052]);
  b.box(0.092, 0.014, 0.006, glow, [0, 0.066, 0.055]);
  for (const sx of [-1, 1]) {
    b.cyl(0.022, 0.022, 0.014, d >= 1 ? 10 : 6, metal, [sx * 0.057, 0.058, 0], [0, 0, HALF_PI]);
    if (d >= 1) b.add(geo.torus(0.015, 0.003, 3, 10), glow, { p: [sx * 0.065, 0.058, 0], r: [0, HALF_PI, 0] });
    if (d === 2) b.box(0.004, 0.06, 0.004, glow, [sx * 0.053, 0.06, 0.04]);
  }
  b.cyl(0.03, 0.03, 0.008, 6, shade(plate, 0.85), [0, 0.11, -0.004]);
  b.tube([0.03, 0.105, -0.03], [0.04, 0.17, -0.045], 0.003, 4, metal);
  b.add(geo.ico(0.007, 0), glow, { p: [0.04, 0.173, -0.046] });
  if (spy) {
    b.cyl(0.095, 0.097, 0.006, d >= 1 ? 12 : 8, metal, [0, 0.11, 0]);
    b.cyl(0.05, 0.054, 0.045, d >= 1 ? 12 : 8, metal, [0, 0.135, 0]);
    b.add(geo.cyl(0.055, 0.055, 0.01, d >= 1 ? 12 : 8, true), glow, { p: [0, 0.12, 0] });
  }
}

/** Spionage-Hut je Fraktion / spy hat per faction */
function spyHat(b: Builder, f: FactionId, L: Look, d: Detail, ws: number) {
  if (f === 'vesper' || f === 'nexus') {
    if (f === 'vesper') cultHood(b, L, d, true);
    else robotHead(b, L, d, true);
    return;
  }
  if (f === 'zyrr') {
    // Fremdwesen mit Hut und Sonnenbrille / alien with hat and sunglasses
    alienHead(b, L, d, false);
    sunglasses(b, d);
    b.cyl(0.14, 0.142, 0.012, ws, L.primary, [0, 0.142, -0.006]);
    b.add(geo.cyl(0.056, 0.064, 0.055, ws), L.primary, { p: [0, 0.172, -0.006], s: [1, 1, 0.92] });
    ring(b, 0.065, 0.016, ws, L.secondary, [0, 0.155, -0.006], [1, 1, 0.93]);
    return;
  }
  face(b, d, 'spy', 5);
  sunglasses(b, d);
  switch (f) {
    case 'korvat':
      // breiter Schlapphut mit Band / wide slouch hat with band
      b.add(geo.cyl(0.142, 0.15, 0.014, ws), L.secondary, { p: [0, 0.094, 0], r: [0.08, 0, 0] });
      b.add(geo.rtaper(0.11, 0.11, 0.09, 0.075, 0.07, 0.02), L.secondary, { p: [0, 0.135, -0.004] });
      ring(b, 0.058, 0.018, ws, L.primary, [0, 0.112, -0.004], [1.02, 1, 1]);
      b.box(0.018, 0.012, 0.06, shade(L.secondary, 0.75), [0, 0.171, -0.004]);
      break;
    case 'dravon':
      // schwarzer Fedora mit Goldband / black fedora with gold band
      b.cyl(0.138, 0.142, 0.012, ws, L.helmet, [0, 0.092, 0]);
      b.add(geo.rtaper(0.11, 0.11, 0.095, 0.08, 0.065, 0.02), L.helmet, { p: [0, 0.13, 0] });
      ring(b, 0.058, 0.016, ws, L.secondary, [0, 0.108, 0], [1.02, 1, 1]);
      b.box(0.02, 0.012, 0.06, shade(L.helmet, 0.75), [0, 0.164, 0]);
      break;
    case 'alvenia':
      // weisser Breitkrempenhut mit blauem Band / white wide-brim hat with blue band
      b.cyl(0.15, 0.152, 0.012, ws, shade(L.primary, 0.85), [0, 0.092, 0]);
      b.add(geo.cyl(0.052, 0.06, 0.06, ws), shade(L.primary, 0.85), { p: [0, 0.128, 0], s: [1, 1, 0.92] });
      ring(b, 0.061, 0.018, ws, L.secondary, [0, 0.107, 0], [1, 1, 0.93]);
      addEmblem(b, 'alvenia', 0.009, 0.004, L.secondary, { p: [-0.035, 0.108, 0.048], r: [0, -0.6, 0] });
      break;
    case 'meridon':
      // flacher Strohhut / flat straw hat
      b.cyl(0.158, 0.16, 0.01, ws, mix(L.secondary, mat.sand, 0.45), [0, 0.092, 0]);
      b.cyl(0.055, 0.06, 0.04, ws, mix(L.secondary, mat.sand, 0.45), [0, 0.115, 0]);
      ring(b, 0.061, 0.016, ws, L.primary, [0, 0.104, 0]);
      break;
    case 'velkar':
      // breiter Pelzhut mit Krempe und Bommel / wide fur hat with brim and bobble
      b.cyl(0.14, 0.144, 0.014, ws, shade(L.primary, 0.6), [0, 0.09, -0.004]);
      b.add(geo.hemi(0.07, ws, 4), L.primary, { p: [0, 0.092, -0.004], s: [1.06, 1.05, 1.08] });
      ring(b, 0.072, 0.016, ws, L.secondary, [0, 0.1, -0.004], [1, 1, 1.02]);
      b.add(geo.ico(0.02, d >= 1 ? 1 : 0), mat.snow, { p: [0, 0.172, -0.004] });
      break;
  }
}

/** Kopf + Kopfbedeckung / head + headgear */
export function headgear(b: Builder, f: FactionId, L: Look, d: Detail, fedora: boolean, seed = 1) {
  // hohe Qualitaet: volle Rundung der Helme; niedrige Qualitaet: der Helm der Fusstruppen ist kleiner (HEAD_FOOT), dort reichen
  // weniger Segmente / high quality: full roundness of the helmets; low quality: the foot troops' helmet is smaller (HEAD_FOOT),
  // fewer segments suffice there
  const ws = d === 2 ? (fine() ? 18 : 12) : d === 1 ? (fine() ? 12 : 10) : fine() ? 12 : 10;
  const hs = d === 2 ? (fine() ? 6 : 5) : d === 1 ? (fine() ? 5 : 4) : fine() ? 4 : 3;
  const hc = L.helmet;
  if (fedora) {
    spyHat(b, f, L, d, ws);
    return;
  }
  if (f === 'zyrr') {
    alienHead(b, L, d);
    return;
  }
  if (f === 'vesper') {
    cultHood(b, L, d, false);
    return;
  }
  if (f === 'nexus') {
    robotHead(b, L, d, false);
    return;
  }
  switch (f) {
    case 'korvat': {
      face(b, d, 'none', seed);
      const C: V3 = [0, 0.068, -0.004];
      const S: V3 = [1, 0.9, 1.06];
      // Kuppel, rotes Band, Krempe mit rotem Krempenband, Kante und Unterseite als EIN Drehkoerper in mehreren
      // Farben. Aufgesetzte Ringe und Scheiben bekamen von der Tuschelinie schwebende Striche neben dem Helm; so
      // liegt alles buendig und die Linie laeuft nur um den Umriss.
      // dome, red band, rim with its red rim band, edge and underside as ONE turned part in several colours. Rings
      // and discs set on top got floating strokes beside the helmet from the ink line; this way everything lies flush
      // and the line only runs around the silhouette.
      const R = 0.086, bandTop = Math.acos(0.019 / R), rows = Math.max(3, Math.round(hs * 1.4));
      const prof: LathePoint[] = [];
      for (let i = 0; i <= rows; i++) { const a = (i / rows) * bandTop; prof.push([R * Math.sin(a), R * Math.cos(a)]); }
      prof.push([R, 0, true], [0.105, -0.0052], [0.1165, -0.0133, true], [0.1165, -0.02, true], [0.084, -0.012]);
      const rim = shade(hc, 0.55);
      const parts: [number, number, ColorLike][] = [
        [0, rows, hc], [rows, rows + 2, L.primary], [rows + 2, rows + 3, shade(hc, 0.85)], [rows + 3, rows + 5, rim],
      ];
      for (const [from, to, c] of parts) b.add(geo.lathe(prof, ws, [from, to]), c, { p: C, s: S });
      if (d === 2) {
        // Nieten als offene, einseitige Plaettchen: sie bekommen keine Tuschelinie (eine Kugel dieser Groesse wuerde
        // von der Kontur zu einem Klecks am Helmrand aufgeblasen)
        // rivets as open one-sided discs: they get no ink line (a sphere of this size would be inflated by the outline
        // into a blot at the helmet's edge)
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          onDome(b, C, 0.0872, S, a, 1.15, () => new THREE.CircleGeometry(0.0062, 6).rotateX(-HALF_PI), shade(hc, 0.6));
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
      b.add(softBox(0.112, 0.106, 0.108, 0.032, headSteps(d)), hc, { p: [0, 0.052, 0] });
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
      // Strickbund am Hals: ein Wulst, buendig am gerundeten Kopf (abstehende Ringe bekamen von der Tuschelinie
      // schwebende Striche) / knit collar at the neck: one roll, flush with the rounded head (rings standing proud
      // got floating strokes from the ink line)
      if (d >= 1) b.add(geo.lathe([[0.046, -0.004], [0.051, 0.006], [0.046, 0.016]], d === 2 ? ws : 7), knit, { p: [0, 0.006, 0], s: [1, 1, 0.98] });
      // Oberseite rund (Kuppe innerhalb der gerundeten Kanten), kleines goldenes Faust-Abzeichen seitlich
      // rounded top (cap inside the rounded edges), small gold fist badge on the side
      b.add(geo.hemi(0.058, ws, hs), hc, { p: [0, 0.099, 0], s: [0.72, 0.36, 0.7] });
      if (d >= 1) {
        b.group({ p: [-0.057, 0.056, 0.004], r: [0, -HALF_PI, 0] }, () => {
          b.cyl(0.015, 0.015, 0.004, 10, L.secondary, [0, 0, 0], [HALF_PI, 0, 0]);
          addEmblem(b, 'dravon', 0.011, 0.004, hc, { p: [0, 0, 0.003] });
        });
      }
      break;
    }
    case 'alvenia': {
      // Heiliges Alvenia: weisser Paladinhelm, offenes Gesicht / Holy Alvenia: white paladin helmet, open face
      face(b, d, 'none', seed);
      const C: V3 = [0, 0.074, -0.004];
      b.add(geo.hemi(0.088, ws, hs), FAITH.plate, { p: C, s: [1, 1.02, 1.06] });
      ring(b, 0.0895, 0.014, ws, FAITH.gold, [0, 0.078, -0.004], [1, 1, 1.06], 0.091);
      // Goldkamm von vorn nach hinten / gold crest from front to back
      b.add(geo.cbox(0.014, 0.03, 0.15, 0.006), FAITH.gold, { p: [0, 0.155, -0.006] });
      // Stirnstern / brow star
      faithStar(b, [0, 0.112, 0.088], 0.024, [-0.25, 0, 0]);
      if (d >= 1) {
        // Wangenschutz mit Goldkante und tuerkiser Leuchte / cheek guards with gold edge and teal light
        for (const s of [-1, 1]) {
          b.add(geo.cbox(0.012, 0.07, 0.06, 0.004), FAITH.plate, { p: [s * 0.078, 0.05, 0.02] });
          b.box(0.014, 0.008, 0.062, FAITH.gold, [s * 0.078, 0.016, 0.02]);
          b.add(geo.ico(0.008, 0), FAITH.tech, { p: [s * 0.088, 0.088, 0.0] });
        }
      }
      // duenner goldener Sonnenkranz ueber dem Helm / thin golden sun halo above the helmet
      haloRing(b, [0, 0.21, -0.02], 0.07, d >= 1 ? 0.0045 : 0.006, d === 2 ? 20 : 12, -0.12);
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
      // Labor im Feld: frostweisser Visierhelm, Visier unten mit tuerkiser Leuchtlinse, Kamm, Antenne, Sensorleuchte
      // lab in the field: frost-white visor helmet, visor down with a glowing teal lens, crest, antenna, sensor lamp
      const C: V3 = [0, 0.068, -0.006];
      const S: V3 = [1, 1, 1.05];
      b.add(geo.hemi(0.089, ws, hs), TECH.shell, { p: C, s: S });
      ring(b, 0.091, 0.024, ws, TECH.gear, [0, 0.068, -0.006], [1, 1, 1.05], 0.092);
      // Kamm und Seitenschienen / crest and side rails
      if (d >= 1) {
        b.add(geo.rtaper(0.022, 0.15, 0.016, 0.13, 0.03, 0.006), TECH.gear, { p: [0, 0.152, -0.016] });
        for (const s of [-1, 1]) b.box(0.012, 0.03, 0.1, TECH.shellShade, [s * 0.088, 0.09, -0.02]);
      }
      // Visier ueber den Augen mit Leuchtlinse / visor over the eyes with a glowing lens
      b.add(geo.rtaper(0.13, 0.03, 0.124, 0.024, 0.044, d >= 1 ? 0.006 : 0.001), mat.glassDark, { p: [0, 0.062, 0.05] });
      b.box(0.11, 0.016, 0.008, TECH.glow, [0, 0.062, 0.066]);
      for (const s of [-1, 1]) b.cyl(0.012, 0.012, 0.014, 8, TECH.gear, [s * 0.07, 0.07, 0.03], [0, 0, HALF_PI]);
      // Antenne links mit Leuchtspitze, Sensorleuchte rechts / antenna left with a glowing tip, sensor lamp right
      b.add(d >= 1 ? geo.cbox(0.016, 0.03, 0.024, 0.005) : geo.box(0.016, 0.03, 0.024), mat.dark, { p: [-0.09, 0.09, -0.03] });
      b.tube([-0.09, 0.1, -0.034], [-0.1, 0.24, -0.06], 0.0045, 5, mat.dark);
      b.add(geo.ico(0.013, 0), TECH.glow, { p: [-0.1, 0.245, -0.061] });
      b.add(geo.cyl(0.013, 0.015, 0.034, 10), mat.dark, { p: [0.09, 0.085, 0.022], r: [HALF_PI, 0, 0] });
      b.cyl(0.011, 0.011, 0.004, 10, TECH.glow, [0.09, 0.085, 0.04], [HALF_PI, 0, 0]);
      // Ohrschalen / ear cups
      if (d >= 1) for (const s of [-1, 1]) b.cyl(0.024, 0.024, 0.02, 10, TECH.gear, [s * 0.066, 0.05, -0.004], [0, 0, HALF_PI]);
      // Sechseck-Abzeichen / hexagon badge
      if (d >= 1) addEmblem(b, 'velkar', 0.014, 0.004, L.secondary, { p: [0, 0.14, 0.06], r: [-0.7, 0, 0] });
      break;
    }
  }
}
