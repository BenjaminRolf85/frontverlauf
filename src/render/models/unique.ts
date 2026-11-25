/**
 * Einzigartige Einheiten und Gebaeude der fuenf klassischen Fraktionen.
 * Unique units and buildings of the five classic factions.
 * - Korvat: Steppenreiter (Pferd, Lanze mit Wimpel) und Kolchose (Kollektivscheune, Weizenfeld, Wasserturm)
 *   / Steppe Riders (horse, lance with pennant) and kolkhoz (collective barn, wheat field, water tower)
 * - Dravon: Sturmbrecher (Panzerplatten, Sturmschild, Vorschlaghammer) und Soeldnerkaserne (Baracken, Exerzierplatz)
 *   / Stormbreakers (armour plates, assault shield, sledgehammer) and mercenary barracks (huts, parade ground)
 * - Alvenia: Friedenswacht (Kontrollposten mit Schlagbaum) und Botschaftspalast (Saeulen, Kuppel, Flaggenreihe)
 *   / Peacekeepers (checkpoint with boom barrier) and embassy palace (columns, dome, row of flags)
 * - Meridon: Kaperschiff (schnelles Kanonenboot mit Segel und Beute) und Handelskontor (Treppengiebel, Ladekran)
 *   / Privateer (fast gunboat with sail and loot) and trading post (stepped gable, hoist)
 * - Velkar: Prototyp-Laeufer (Zweibeiner mit Teslaspule) und Versuchslabor (Teslaturm, Reaktortanks)
 *   / Prototype Walker (biped with tesla coil) and test lab (tesla tower, reactor tanks)
 * Einheiten blicken nach +z, Ursprung unten mittig / units face +z, origin bottom centre.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { HALF_PI, band, barrel, crate, flagPole, gableRoof, sandbag } from './architecture';
import { hall, tractor } from './buildings';
import { addEmblem } from './emblems';
import { ball, Builder, capsule, fine, geo, mix, rng, shade, type ColorLike, type V3 } from './kit';
import { headlight, lens, rivet, rivetRow, seam } from './detailFigures';
import { look, mat } from './look';
import { hull, lifeRings, mast, superBlock } from './ships';
import { rifle, soldier, standPose } from './soldiers';
import { cathedral, orderGuard } from './alveniaFaith';

const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/** Warnstreifen (gelb/schwarz) entlang x / hazard stripes along x */
function stripes(b: Builder, x: number, y: number, z: number, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) b.box(w / n, h, 0.004, i % 2 ? mat.ink : mat.yellow, [x - w / 2 + (i + 0.5) * (w / n), y, z]);
}

// ---------- Korvat: Steppenreiter / steppe riders ----------

/**
 * Steppenpferd bei hoher Qualitaet: modellierter Rumpf mit Brust und Kruppe, runder Hals, Kopf mit Maul, Nuestern,
 * Augen und Ohren, Zaumzeug, Beine mit Gelenken, Fesseln und beschlagenen Hufen, Maehne und Schweif aus Straehnen.
 * Gleiche Haltung und Masse wie die einfache Form.
 * Steppe horse on high quality: sculpted barrel with chest and croup, round neck, head with muzzle, nostrils, eyes and
 * ears, bridle, legs with joints, fetlocks and shod hooves, mane and tail from strands. Same stance and size as the
 * simple form.
 */
function fineHorse(b: Builder, coat: ColorLike, mane: ColorLike, tack: ColorLike) {
  const dark = shade(coat, 0.78), light = mix(coat, mat.paper, 0.25);
  // Rumpf, Brust, Kruppe, Bauch / barrel, chest, croup, belly
  b.add(ball(1, 22, 14), coat, { p: [0, 0.2, 0], s: [0.05, 0.052, 0.135], r: [-0.08, 0, 0] });
  b.add(ball(1, 16, 10), coat, { p: [0, 0.205, -0.1], s: [0.051, 0.054, 0.06] });
  for (const s of [-1, 1]) b.add(ball(1, 12, 8), coat, { p: [s * 0.022, 0.218, -0.115], s: [0.034, 0.042, 0.048] });
  b.add(ball(1, 14, 10), coat, { p: [0, 0.205, 0.095], s: [0.046, 0.052, 0.045] });
  b.add(ball(1, 12, 6), light, { p: [0, 0.168, 0.0], s: [0.04, 0.02, 0.1] });
  // Hals / neck
  b.segment(V([0, 0.21, 0.1]), V([0, 0.34, 0.185]), (l) => capsule(0.034, 0.022, l + 0.04, 14, 2), coat);
  // Kopf: Schaedel, Ganasche, Maul, Nuestern, Augen, Ohren, Stirnschopf / head: skull, cheek, muzzle, nostrils, eyes, ears, forelock
  b.group({ p: [0, 0.34, 0.2], r: [0.75, 0, 0] }, () => {
    b.add(capsule(0.021, 0.016, 0.11, 14, 2), coat, { p: [0, 0.04, -0.004], s: [1, 1, 1.25] });
    b.add(ball(1, 12, 8), coat, { p: [0, 0.006, 0.008], s: [0.023, 0.027, 0.028] });
    b.add(ball(1, 12, 8), dark, { p: [0, 0.092, 0.002], s: [0.018, 0.017, 0.022] });
    for (const s of [-1, 1]) {
      b.group({ p: [s * 0.009, 0.104, -0.008], r: [-HALF_PI + 0.3, 0, 0] }, () => b.add(lens(6, 3), mat.ink, { s: [0.0045, 0.0065, 0.002] }));
      // Auge mit Lichtpunkt / eye with a glint
      b.group({ p: [s * 0.02, 0.022, -0.012], r: [0, s * HALF_PI, 0] }, () => {
        b.add(lens(8, 5), mat.ink, { s: [0.0062, 0.0055, 0.003] });
        b.add(lens(4, 2), mat.white, { p: [0.0015 * s, 0.0018, 0.0026], s: 0.0016 });
      });
      // Ohren mit Innenseite / ears with inner side
      b.group({ p: [s * 0.013, 0.008, -0.05], r: [-0.4, 0, s * 0.3] }, () => {
        b.add(capsule(0.0075, 0.0015, 0.032, 8, 1), coat, { s: [1, 1, 0.6] });
        b.add(lens(5, 3), dark, { p: [0, 0, 0.003], s: [0.004, 0.012, 0.0015] });
      });
    }
    for (let i = 0; i < 4; i++) b.tube([(i - 1.5) * 0.004, 0.012, -0.04], [(i - 1.5) * 0.008, 0.04, -0.03], 0.0035, 4, mane);
    // Zaumzeug: Nasenriemen, Backenstueck, Stirnriemen, Trensenring / bridle: noseband, cheek piece, brow band, bit ring
    b.add(geo.torus(0.0205, 0.0028, 3, 16), tack, { p: [0, 0.075, 0.001], r: [HALF_PI, 0, 0], s: [1, 1.25, 1] });
    b.add(geo.torus(0.0215, 0.0028, 3, 16), tack, { p: [0, 0.008, -0.01], r: [HALF_PI - 0.4, 0, 0], s: [1.05, 1.35, 1] });
    for (const s of [-1, 1]) {
      b.tube([s * 0.022, 0.008, -0.01], [s * 0.019, 0.075, 0.0], 0.0026, 3, tack);
      b.add(geo.torus(0.0055, 0.0014, 3, 8), mat.metalLight, { p: [s * 0.019, 0.094, 0.014], r: [0, HALF_PI, 0] });
    }
  });
  // Beine mit Gelenken und beschlagenen Hufen / legs with joints and shod hooves
  const legs: [number, number, V3, V3][] = [
    [-0.035, 0.1, [-0.035, 0.11, 0.12], [-0.034, 0.0, 0.12]],
    [0.035, 0.1, [0.04, 0.14, 0.17], [0.04, 0.09, 0.2]],
    [-0.035, -0.1, [-0.036, 0.1, -0.12], [-0.036, 0.0, -0.15]],
    [0.035, -0.1, [0.036, 0.11, -0.09], [0.036, 0.0, -0.07]],
  ];
  for (const [x, z, knee, hoof] of legs) {
    b.segment(V([x, 0.2, z]), V(knee), (l) => capsule(0.026, 0.013, l + 0.03, 12, 2), coat);
    b.segment(V(knee), V(hoof), (l) => capsule(0.0105, 0.0095, l + 0.006, 10, 1), dark);
    b.add(ball(1, 10, 6), coat, { p: knee, s: [0.014, 0.016, 0.015] });
    b.add(ball(1, 8, 6), dark, { p: [hoof[0], hoof[1] + 0.028, hoof[2]], s: [0.012, 0.013, 0.013] });
    b.cyl(0.015, 0.018, 0.022, 12, mat.ink, [hoof[0], hoof[1] + 0.011, hoof[2]]);
    b.add(geo.torus(0.0165, 0.0022, 3, 12), mat.metalLight, { p: [hoof[0], hoof[1] + 0.002, hoof[2]], r: [HALF_PI, 0, 0] });
    // Fesselbehang / feathering at the fetlock
    b.add(geo.cyl(0.0145, 0.0175, 0.012, 10, true), light, { p: [hoof[0], hoof[1] + 0.026, hoof[2]] });
  }
  // Maehne aus Straehnen entlang des Halses / mane from strands along the neck
  const R = rng(23);
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const root: V3 = [0, 0.235 + t * 0.12, 0.075 + t * 0.09];
    const sx = (i % 2 ? 1 : -1) * (0.012 + R() * 0.01);
    b.tube(root, [sx, root[1] - 0.04 - R() * 0.015, root[2] - 0.022], 0.0075, 5, mane, 0.002);
  }
  // Schweif aus Straehnen / tail from strands
  for (let i = 0; i < 6; i++) {
    const a = (i / 5 - 0.5) * 0.8;
    const mid: V3 = [Math.sin(a) * 0.015, 0.2, -0.205];
    b.tube([0, 0.232, -0.165], mid, 0.011, 6, mane, 0.008);
    b.tube(mid, [Math.sin(a) * 0.035, 0.1 + R() * 0.03, -0.235 - R() * 0.02], 0.008, 6, mane, 0.002);
  }
}

/** Steppenpferd im Galopp-Stand / steppe horse in a mid-stride stance */
function horse(b: Builder, coat: ColorLike, mane: ColorLike, lite: boolean, tack: ColorLike = mat.dark) {
  if (fine() && !lite) {
    fineHorse(b, coat, mane, tack);
    return;
  }
  const ws = lite ? 8 : 12;
  // Rumpf: Brust vorn hoeher / barrel body, chest higher at the front
  b.add(geo.sphere(0.1, ws, lite ? 5 : 8), coat, { p: [0, 0.2, 0], s: [0.5, 0.52, 1.35], r: [-0.08, 0, 0] });
  b.add(geo.sphere(0.06, ws, lite ? 4 : 6), coat, { p: [0, 0.205, -0.1], s: [0.85, 0.9, 1] });
  // Hals und Kopf / neck and head
  b.segment(V([0, 0.22, 0.1]), V([0, 0.33, 0.17]), (l) => geo.rtaper(0.05, 0.07, 0.036, 0.05, l + 0.03, 0.012), coat);
  b.group({ p: [0, 0.34, 0.2], r: [0.75, 0, 0] }, () => {
    b.add(lite ? geo.taper(0.045, 0.06, 0.03, 0.04, 0.11) : geo.rtaper(0.045, 0.06, 0.032, 0.042, 0.11, 0.01), coat, { p: [0, 0.035, 0] });
    b.box(0.034, 0.02, 0.038, shade(coat, 0.75), [0, 0.09, 0]);
    if (!lite) for (const s of [-1, 1]) b.box(0.006, 0.008, 0.008, mat.ink, [s * 0.022, 0.0, 0.012]);
  });
  for (const s of [-1, 1]) b.add(geo.cone(0.01, 0.03, 4), coat, { p: [s * 0.014, 0.385, 0.165], r: [-0.3, 0, s * 0.25] });
  // Maehne / mane
  const n = lite ? 3 : 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    b.box(0.014, 0.04, 0.03, mane, [0, 0.25 + t * 0.11, 0.08 + t * 0.075], [0.6, 0, 0]);
  }
  // Beine: vorn rechts angehoben / legs: front right raised
  const legs: [number, number, V3, V3][] = [
    [-0.035, 0.1, [-0.035, 0.11, 0.12], [-0.034, 0.0, 0.12]],
    [0.035, 0.1, [0.04, 0.14, 0.17], [0.04, 0.09, 0.2]],
    [-0.035, -0.1, [-0.036, 0.1, -0.12], [-0.036, 0.0, -0.15]],
    [0.035, -0.1, [0.036, 0.11, -0.09], [0.036, 0.0, -0.07]],
  ];
  for (const [x, z, knee, hoof] of legs) {
    b.segment(V([x, 0.19, z]), V(knee), (l) => geo.taper(0.034, 0.04, 0.026, 0.03, l + 0.02), coat);
    b.segment(V(knee), V(hoof), (l) => geo.box(0.018, l + 0.01, 0.022), shade(coat, 0.85));
    b.cyl(0.016, 0.018, 0.022, lite ? 5 : 8, mat.ink, [hoof[0], hoof[1] + 0.011, hoof[2]]);
  }
  // Schweif / tail
  b.tube([0, 0.23, -0.16], [0, 0.12, -0.22], 0.014, lite ? 4 : 6, mane, 0.022);
}

export function steppeRider(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const coat = mix(mat.wood, mat.orange, 0.18);
  // Pferd gross, Reiter etwas kleiner (Comic-Proportion) / big horse, slightly smaller rider (comic proportion)
  const K = 1.4;
  b.group({ p: [0, 0, 0.0], s: K }, () => {
    horse(b, coat, mat.dark, lite);
    // Sattel mit Decke in Fraktionsfarbe, Steigbuegel / saddle with faction blanket, stirrups
    b.add(geo.rbox(0.11, 0.012, 0.11, 0.004), L.primary, { p: [0, 0.255, -0.02] });
    b.box(0.112, 0.008, 0.02, L.secondary, [0, 0.257, 0.03]);
    b.add(geo.rbox(0.07, 0.02, 0.07, 0.008), mat.wood, { p: [0, 0.27, -0.02] });
    if (!lite) for (const s of [-1, 1]) {
      b.tube([s * 0.05, 0.26, -0.01], [s * 0.065, 0.19, 0.0], 0.003, 4, mat.dark);
      b.box(0.02, 0.006, 0.02, mat.metal, [s * 0.065, 0.188, 0.0]);
    }
    // Satteltaschen und Bettrolle / saddlebags and bedroll
    for (const s of [-1, 1]) b.add(geo.rbox(0.02, 0.05, 0.05, 0.008), L.gear, { p: [s * 0.06, 0.225, -0.09] });
    b.cyl(0.018, 0.018, 0.11, lite ? 6 : 10, shade(L.gear, 1.25), [0, 0.275, -0.1], [0, 0, HALF_PI]);
    if (fine() && !lite) {
      // Sattelknauf und Hinterzwiesel, Sattelgurt mit Schnalle, Deckenkante, Riemen um die Bettrolle, Taschenklappen
      // saddle horn and cantle, girth with buckle, blanket edge, straps around the bedroll, bag flaps
      b.add(capsule(0.009, 0.007, 0.03, 10, 1), shade(mat.wood, 0.8), { p: [0, 0.288, 0.012], r: [0.3, 0, 0] });
      b.add(geo.torus(0.03, 0.007, 4, 12, ), shade(mat.wood, 0.8), { p: [0, 0.283, -0.05], r: [0.2, 0, 0], s: [1.1, 1, 0.6] });
      b.add(geo.torus(0.053, 0.0035, 3, 22), mat.dark, { p: [0, 0.2, -0.01], r: [0, HALF_PI, 0], s: [1, 1.02, 1.0] });
      for (const s of [-1, 1]) {
        b.box(0.006, 0.014, 0.012, mat.metalLight, [s * 0.052, 0.21, -0.01]);
        b.box(0.022, 0.012, 0.052, shade(L.gear, 0.75), [s * 0.06, 0.247, -0.09]);
        rivet(b, [s * 0.071, 0.24, -0.09], [s, 0, 0], 0.004, mat.metalLight);
      }
      b.box(0.114, 0.006, 0.112, L.secondary, [0, 0.249, -0.02]);
      for (const x of [-0.035, 0.035]) b.add(geo.torus(0.0195, 0.0025, 3, 12), mat.dark, { p: [x, 0.275, -0.1], r: [0, HALF_PI, 0] });
    }
  });
  {
    // Reiter rittlings / rider astride
    b.group({ p: [0, 0.255 * K, -0.03 * K], s: 0.85 }, () => {
      soldier(b, f, {
        pelvis: [0, 0.03, 0],
        twist: [0.12, 0.1, 0],
        head: [0.05, -0.1, 0],
        handL: [-0.05, 0.1, 0.12],
        handR: [0.1, 0.13, 0.05],
        footL: [-0.07, -0.08, 0.03],
        footR: [0.07, -0.08, 0.03],
        kneePoleL: [-1, 0.2, 0.6],
        kneePoleR: [1, 0.2, 0.6],
      }, { detail: lite ? 0 : 1, pack: 'none', seed: 71 });
      // Zuegel / reins
      b.tube([-0.05, 0.1, 0.12], [-0.01, 0.06, 0.26], 0.003, 3, mat.dark);
      b.tube([-0.05, 0.1, 0.12], [0.012, 0.06, 0.26], 0.003, 3, mat.dark);
      // eingelegte Lanze mit rotem Wimpel und Emblem / couched lance with red pennant and emblem
      b.tube([0.09, 0.08, -0.16], [0.12, 0.2, 0.34], 0.007, lite ? 4 : 6, mat.wood);
      b.add(geo.cone(0.012, 0.05, 4), mat.metalLight, { p: [0.122, 0.208, 0.365], r: [HALF_PI - 0.24, 0, 0] });
      b.group({ p: [0.12, 0.2, 0.3], r: [-0.24, 0, 0] }, () => {
        b.add(geo.profileZY([[0, 0], [0, 0.07], [-0.14, 0.035]], 0.005), L.primary, {});
        if (!lite) addEmblem(b, f, 0.016, 0.007, L.emblem, { p: [0, 0.035, -0.035], r: [0, HALF_PI, 0] });
      });
      // Saebel an der Seite / sabre at the side
      if (!lite) b.add(geo.taper(0.006, 0.012, 0.004, 0.006, 0.12), mat.metalLight, { p: [-0.07, 0.0, -0.04], r: [1.2, 0, 0.1] });
    });
  }
  return b;
}

// ---------- Dravon: Sturmbrecher / stormbreakers ----------

export function stormbreaker(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d = lite ? 1 : 2;
  const armour = mix(mat.gunmetal, L.primary, 0.25);
  const G: V3 = [0.075, 0.2, 0.07];
  b.group({ p: [0, 0, -0.03] }, () => {
    soldier(b, f, {
      ...standPose([[-0.09, 0.2, 0.13], G]),
      footL: [-0.06, 0.034, 0.06],
      footR: [0.056, 0.034, -0.05],
      bootL: [0, -0.3, 0],
      twist: [0.1, -0.2, 0],
      head: [0, 0.15, 0],
      elbowPoleL: [-1, -0.2, 0.4],
    }, { detail: d, pack: 'none', seed: 81 });
    // Brustpanzer und Schulterplatten / breastplate and pauldrons
    b.group({ p: [0, 0.155 + 0.02, 0], r: [0.1, -0.2, 0] }, () => {
      b.add(geo.ctaper(0.16, 0.11, 0.185, 0.12, 0.1, 0.02), armour, { p: [0, 0.06, 0.004] });
      b.box(0.12, 0.012, 0.012, L.secondary, [0, 0.1, 0.064]);
      b.box(0.012, 0.07, 0.01, L.secondary, [0, 0.055, 0.064]);
      for (const s of [-1, 1]) {
        b.add(geo.rtaper(0.07, 0.08, 0.05, 0.06, 0.035, 0.008), armour, { p: [s * 0.1, 0.11, 0], r: [0, 0, s * -0.35] });
        b.box(0.07, 0.006, 0.08, L.secondary, [s * 0.1, 0.093, 0], [0, 0, s * -0.35]);
      }
      // Vorschlaghammer auf dem Ruecken / sledgehammer on the back
      b.tube([-0.08, -0.02, -0.07], [0.08, 0.2, -0.08], 0.008, 6, mat.wood);
      b.group({ p: [0.085, 0.21, -0.08], r: [0, 0, 0.62] }, () => {
        b.add(geo.cbox(0.09, 0.045, 0.045, 0.008), mat.dark, {});
        b.box(0.092, 0.012, 0.047, L.secondary, [0, 0, 0]);
        // hohe Qualitaet: Schlagflaechen, Keil, Stielwicklung / high quality: striking faces, wedge, grip wrap
        if (fine() && !lite) for (const sx of [-1, 1]) b.add(geo.cyl(0.02, 0.022, 0.006, 12), mat.metalLight, { p: [sx * 0.047, 0, 0], r: [0, 0, HALF_PI] });
      });
      if (fine() && !lite) {
        for (let i = 0; i < 4; i++) b.add(geo.torus(0.0095, 0.0025, 3, 10), mat.dark, { p: [-0.065 + i * 0.012, -0.004 + i * 0.0165, -0.071], r: [HALF_PI, 0, -0.95] });
        // Nieten und Kanten am Brustpanzer und an den Schulterplatten / rivets and edges on the breastplate and pauldrons
        rivetRow(b, [-0.072, 0.022, 0.061], [0.072, 0.022, 0.061], 7, [0, 0, 1], 0.0045, mat.metalLight);
        for (const s of [-1, 1]) {
          rivetRow(b, [s * 0.082, 0.04, 0.062], [s * 0.088, 0.095, 0.064], 3, [s * 0.4, 0, 1], 0.0045, mat.metalLight);
          rivetRow(b, [s * 0.075, 0.128, 0.02], [s * 0.115, 0.115, 0.02], 3, [s * 0.3, 1, 0.3], 0.004, mat.metalLight);
        }
        seam(b, [[-0.06, 0.035, 0.062], [0, 0.03, 0.065], [0.06, 0.035, 0.062]], 0.0018, shade(armour, 0.7));
      }
    });
    // Sturmschild mit Sehschlitz / assault shield with vision slit
    b.group({ p: [-0.075, 0.03, 0.15], r: [0.04, 0.35, 0] }, () => {
      b.add(d === 2 ? geo.rbox(0.15, 0.27, 0.02, 0.006) : geo.box(0.15, 0.27, 0.02), armour, { p: [0, 0.135, 0] });
      b.box(0.156, 0.016, 0.024, L.secondary, [0, 0.264, 0]);
      b.box(0.156, 0.016, 0.024, L.secondary, [0, 0.008, 0]);
      for (const s of [-1, 1]) b.box(0.012, 0.27, 0.024, shade(armour, 0.8), [s * 0.072, 0.135, 0]);
      b.box(0.08, 0.012, 0.006, mat.glassDark, [0, 0.215, 0.012]);
      addEmblem(b, f, 0.035, 0.008, L.secondary, { p: [0, 0.13, 0.012] });
      if (!lite) for (const x of [-0.05, 0.05]) for (const y of [0.04, 0.23]) b.add(geo.sphere(0.006, 5, 3), L.secondary, { p: [x, y, 0.012] });
      if (fine() && !lite) {
        // Nietrand, Sehschlitzrahmen, Kratzer, Griff hinten / rivet border, slit frame, scratches, grip at the back
        for (const y of [0.018, 0.252]) rivetRow(b, [-0.055, y, 0.0105], [0.055, y, 0.0105], 6, [0, 0, 1], 0.0038, mat.metalLight);
        for (const x of [-0.06, 0.06]) rivetRow(b, [x, 0.07, 0.0105], [x, 0.2, 0.0105], 4, [0, 0, 1], 0.0038, mat.metalLight);
        for (const y of [0.205, 0.225]) b.box(0.092, 0.005, 0.006, shade(armour, 0.65), [0, y, 0.012]);
        for (const [x, y, a] of [[-0.03, 0.08, 0.5], [0.035, 0.17, -0.4], [0.02, 0.06, 0.9]] as [number, number, number][]) b.box(0.03, 0.0025, 0.002, shade(armour, 1.35), [x, y, 0.0105], [0, 0, a]);
        b.add(geo.torus(0.018, 0.004, 3, 10), mat.dark, { p: [0, 0.135, -0.018], r: [0, 0, 0], s: [1, 1.4, 1] });
      }
    });
  });
  // schwere Schrotflinte mit Trommel / heavy drum-fed shotgun
  rifle(b, [G[0], G[1], G[2] - 0.03], [0.1, 0.1, 1], { len: 0.24, back: 0.07, detail: d, heavy: 1.6, drum: true });
  if (!lite) {
    // Patronengurt und Truemmer / bandolier and rubble
    b.box(0.02, 0.18, 0.01, L.secondary, [0, 0.245, 0.036], [0.1, -0.2, 0.7]);
    for (const [x, z, s] of [[0.15, -0.12, 0.05], [0.12, -0.18, 0.035], [-0.16, -0.14, 0.04]] as [number, number, number][]) {
      b.add(geo.dodeca(s), mat.concrete, { p: [x, s * 0.5, z], r: [x * 9, z * 7, 0] });
    }
  }
  return b;
}

// ---------- Alvenia: Friedenswacht / peacekeepers ----------

export function peacekeeper(f: FactionId, lite = false): Builder {
  // Heiliges Alvenia: Ordenswacht (alveniaFaith.ts); andere Besitzer behalten den alten Kontrollposten
  // Holy Alvenia: Order Guard (alveniaFaith.ts); other owners keep the old checkpoint
  if (f === 'alvenia') return orderGuard(f, lite);
  const b = new Builder();
  const L = look(f);
  const d = lite ? 1 : 2;
  // Kontrollposten: Schilderhaus und Schlagbaum / checkpoint: sentry box and boom barrier
  b.group({ p: [-0.2, 0, -0.19] }, () => {
    b.block(0, 0, 0, 0.13, 0.25, 0.12, mat.white);
    b.block(0, 0.14, 0.061, 0.08, 0.06, 0.004, mat.window);
    b.block(0.066, 0.14, 0, 0.004, 0.06, 0.07, mat.window);
    b.block(0, 0.075, 0, 0.134, 0.018, 0.124, L.primary);
    b.add(geo.cbox(0.16, 0.02, 0.15, 0.012), L.primary, { p: [0, 0.26, 0] });
    if (!lite) addEmblem(b, f, 0.022, 0.006, L.emblem, { p: [0, 0.2, 0.063] });
    if (fine() && !lite) {
      // Fensterrahmen und Sprossen, Tuer, Lampe, Telefonkasten / window frames and bars, door, lamp, phone box
      for (const [w, h, x, y, z, ry] of [[0.084, 0.064, 0, 0.17, 0.063, 0], [0.074, 0.064, 0.068, 0.17, 0, HALF_PI]] as number[][]) {
        b.group({ p: [x, y, z], r: [0, ry, 0] }, () => {
          for (const sy of [-1, 1]) b.box(w, 0.005, 0.006, mat.white, [0, sy * h / 2, 0]);
          for (const sx of [-1, 0, 1]) b.box(0.005, h, 0.006, mat.white, [sx * w / 2, 0, 0]);
        });
      }
      b.box(0.05, 0.1, 0.004, shade(mat.white, 0.85), [0.04, 0.05, 0.062]);
      b.add(ball(1, 6, 4), mat.dark, { p: [0.058, 0.05, 0.065], s: 0.004 });
      headlight(b, [0, 0.235, 0.07], [0, -0.3, 1], 0.012, mat.dark, false);
      b.add(geo.rbox(0.024, 0.034, 0.016, 0.004), mat.dark, { p: [-0.068, 0.12, 0.02] });
    }
  });
  // Schlagbaum entlang der rechten Seite / boom barrier along the right side
  b.group({ p: [0.24, 0, -0.24] }, () => {
    b.block(0, 0, 0, 0.04, 0.13, 0.04, mat.concreteLight);
    b.block(0, 0.13, 0, 0.044, 0.012, 0.044, L.primary);
    b.cyl(0.022, 0.022, 0.05, lite ? 6 : 10, mat.dark, [0, 0.11, 0], [0, 0, HALF_PI]);
    // gestreift in Fraktionsfarbe, leicht geoeffnet / striped in faction colour, slightly raised
    b.group({ p: [0, 0.11, 0], r: [-0.22, 0, 0] }, () => {
      const n = lite ? 4 : 8;
      for (let i = 0; i < n; i++) b.box(0.022, 0.022, 0.42 / n, i % 2 ? L.primary : mat.white, [0, 0, 0.02 + (i + 0.5) * (0.42 / n)]);
      b.box(0.03, 0.03, 0.03, mat.red, [0, 0, 0.44]);
    });
  });
  // Wachposten mit erhobener Hand / sentry raising a hand
  const G: V3 = [0.09, 0.17, 0.05];
  b.group({ p: [-0.04, 0, 0.06] }, () => {
    soldier(b, f, {
      ...standPose([[-0.13, 0.33, 0.06], G]),
      twist: [0, 0.2, 0],
      head: [0.05, -0.1, 0],
      elbowPoleL: [-1, 0.2, -0.2],
    }, { detail: d, pack: 'pack', armband: true, seed: 91 });
    rifle(b, G, [0.0, 0.85, 0.5], { len: 0.27, detail: d, heavy: 1.2 });
    // Verband am Arm als Zeichen der Selbstheilung / bandage on the arm as a sign of self-repair
    if (!lite) b.box(0.056, 0.02, 0.058, mat.white, [-0.11, 0.24, 0.02], [0, 0, 0.6]);
  });
  // Sandsack und Signalkelle / sandbag and signal paddle
  b.add(geo.ctaper(0.11, 0.07, 0.095, 0.05, 0.045, 0.014), mat.sandbag, { p: [-0.22, 0.023, 0.12], r: [0, 0.4, 0] });
  if (!lite) {
    b.cyl(0.004, 0.004, 0.06, 4, mat.dark, [-0.22, 0.075, 0.12]);
    b.cyl(0.024, 0.024, 0.006, 12, L.primary, [-0.22, 0.115, 0.12], [HALF_PI, 0, 0]);
    b.cyl(0.015, 0.015, 0.008, 12, mat.white, [-0.22, 0.115, 0.12], [HALF_PI, 0, 0]);
    // Verbandskasten am Posten (Selbstheilung) / first-aid box at the post (self-repair)
    b.add(geo.rbox(0.06, 0.045, 0.04, 0.008), mat.white, { p: [-0.12, 0.0225, -0.1] });
    b.box(0.062, 0.012, 0.042, L.primary, [-0.12, 0.03, -0.1]);
  }
  return b;
}

// ---------- Meridon: Kaperschiff / privateer ----------

export function privateer(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  const top = 0.05;
  // schlanker, schneller Rumpf / slim fast hull
  hull(b, L, 0.78, 0.18, top, 0.26, mat.woodLight, 8);
  const dk = top + 0.008;
  // Deckplanken / deck planks
  for (let i = 0; i < 5; i++) b.box(0.003, 0.002, 0.5, shade(mat.woodLight, 0.8), [-0.06 + i * 0.03, dk + 0.001, -0.04]);
  // Steuerhaus / wheelhouse
  superBlock(b, f, L, 0, dk, -0.12, 0.11, 0.06, 0.1);
  mast(b, L, f, -0.12, dk + 0.06, 0.08);
  // Hauptmast mit Gaffelsegel in Zweitfarbe / main mast with gaff sail in the secondary colour
  b.cyl(0.006, 0.008, 0.42, 6, mat.wood, [0, dk + 0.21, 0.04]);
  b.add(geo.profileZY([[-0.16, 0.06], [0.0, 0.06], [0.0, 0.4], [-0.12, 0.32]], 0.006), L.secondary, { p: [0, dk, 0.035] });
  b.add(geo.profileZY([[-0.16, 0.06], [0.0, 0.06], [0.0, 0.08], [-0.16, 0.08]], 0.008), L.primary, { p: [0, dk, 0.035] });
  addEmblem(b, f, 0.04, 0.012, L.primary, { p: [0, dk + 0.22, -0.055], r: [0, HALF_PI, 0] });
  b.tube([0, dk + 0.06, 0.035], [0, dk + 0.065, -0.17], 0.004, 4, mat.wood);
  // Proportion: Rahsegel quer ueber dem Deck, damit das Segel aus jeder Richtung als Flaeche steht (sonst nur von der Seite)
  // und das Kaperschiff sich vom Zerstoerer trennt / proportion: square sail across the deck so the sail reads as an area
  // from every heading (otherwise only from the side) and the privateer separates from the destroyer
  b.cyl(0.005, 0.005, 0.32, 6, mat.wood, [0, dk + 0.37, 0.048], [0, 0, HALF_PI]);
  b.add(geo.profileZY([[-0.15, 0.0], [0.15, 0.0], [0.13, -0.22], [-0.13, -0.22]], 0.006), mat.paper, { p: [0, dk + 0.365, 0.05], r: [0, HALF_PI, 0] });
  b.box(0.26, 0.016, 0.008, L.secondary, [0, dk + 0.2, 0.05]);
  // Klüverfock am Bugspriet / jib on the bowsprit
  b.tube([0, dk + 0.01, 0.37], [0, dk + 0.035, 0.435], 0.004, 4, mat.wood);
  b.add(geo.profileZY([[0.05, 0.03], [0.4, 0.04], [0.05, 0.38]], 0.004), mat.paper, { p: [0, dk, 0.0] });
  // Kaperflagge (schwarz mit Emblem) / letter-of-marque flag (black with emblem)
  b.block(0.04, dk + 0.4, 0.04, 0.07, 0.045, 0.004, mat.ink);
  addEmblem(b, f, 0.016, 0.008, L.secondary, { p: [0.04, dk + 0.4225, 0.04] });
  // Bugkanone / bow gun
  b.cyl(0.03, 0.034, 0.02, 10, L.hullDark, [0, dk + 0.01, 0.2]);
  b.add(geo.cbox(0.04, 0.03, 0.05, 0.008), L.hull, { p: [0, dk + 0.035, 0.2] });
  b.cyl(0.008, 0.009, 0.12, 8, mat.dark, [0, dk + 0.04, 0.27], [HALF_PI - 0.08, 0, 0]);
  // Beute: Truhe mit Gold und Kisten / loot: chest with gold and crates
  b.add(geo.rbox(0.06, 0.035, 0.04, 0.006), mat.wood, { p: [0.03, dk + 0.018, 0.1] });
  b.box(0.062, 0.006, 0.042, mat.gold, [0.03, dk + 0.033, 0.1]);
  // Muenzen nur bei hoher Qualitaet (gleicht das Rahsegel im Budget aus) / coins on high quality only (offsets the square sail in the budget)
  if (fine()) for (let i = 0; i < 4; i++) b.cyl(0.008, 0.008, 0.004, 8, mat.gold, [0.025 + i * 0.006, dk + 0.04 + i * 0.002, 0.1 + (i % 2) * 0.006]);
  crate(b, -0.04, dk, 0.12, 0.035, L.trim);
  barrel(b, -0.045, dk, -0.03, L.primary);
  // Aussenborder und Kielwasser / twin outboards and wake
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.03, 0.05, 0.035, 0.008), mat.dark, { p: [s * 0.04, dk + 0.01, -0.39] });
    b.box(0.008, 0.06, 0.012, mat.darkMid, [s * 0.04, -0.015, -0.4]);
  }
  b.add(geo.prismXZ([[-0.08, -0.4], [0.08, -0.4], [0.12, -0.435], [-0.12, -0.435]], 0.006), mat.white, { p: [0, 0, 0] });
  lifeRings(b, 0.082, dk + 0.02, [0.0]);
  if (fine()) {
    // Takelage: Wanten zum Deck, Stagen zu Bug und Heck, Segelnaehte, Klampen, Taurolle, Laterne, Lafette mit Raedern
    // rigging: shrouds to the deck, stays to bow and stern, sail seams, cleats, rope coil, lantern, gun carriage with wheels
    const rope = shade(mat.wood, 0.7);
    for (const s of [-1, 1]) for (const z of [0.0, 0.07]) b.tube([0, dk + 0.4, 0.04], [s * 0.075, dk + 0.006, z], 0.0018, 3, rope);
    b.tube([0, dk + 0.41, 0.04], [0, dk + 0.03, 0.43], 0.002, 3, rope);
    b.tube([0, dk + 0.41, 0.04], [0, dk + 0.08, -0.3], 0.002, 3, rope);
    for (const y of [0.08, 0.15, 0.22, 0.29]) b.box(0.007, 0.003, 0.15 * (0.4 - y + 0.06) / 0.4 + 0.02, shade(L.secondary, 0.85), [0, dk + y, -0.05], [0, 0, 0]);
    for (const x of [-0.08, 0.0, 0.08]) b.box(0.003, 0.2, 0.008, shade(mat.paper, 0.88), [x * 0.95, dk + 0.255, 0.05], [0, HALF_PI, 0]);
    for (const s of [-1, 1]) for (const z of [-0.25, 0.25]) {
      b.cyl(0.006, 0.008, 0.012, 8, mat.dark, [s * 0.07, dk + 0.006, z]);
      b.box(0.004, 0.004, 0.02, mat.dark, [s * 0.07, dk + 0.013, z]);
    }
    b.add(geo.torus(0.016, 0.0045, 4, 14), rope, { p: [0.05, dk + 0.005, -0.2], r: [HALF_PI, 0, 0] });
    b.add(geo.torus(0.009, 0.0045, 4, 10), rope, { p: [0.05, dk + 0.011, -0.2], r: [HALF_PI, 0, 0] });
    b.cyl(0.004, 0.004, 0.06, 5, mat.dark, [0.05, dk + 0.09, -0.12]);
    headlight(b, [0.05, dk + 0.125, -0.115], [0, 0, 1], 0.009, mat.dark, false);
    for (const s of [-1, 1]) b.cyl(0.013, 0.013, 0.006, 10, mat.wood, [s * 0.024, dk + 0.012, 0.2], [0, 0, HALF_PI]);
    rivetRow(b, [-0.02, dk + 0.045, 0.226], [0.02, dk + 0.045, 0.226], 3, [0, 0, 1], 0.003, mat.metalLight);
    b.add(geo.torus(0.0095, 0.002, 3, 10), mat.metalLight, { p: [0, dk + 0.04 + 0.115 * Math.sin(0.08), 0.27 + 0.06], r: [-0.08, 0, 0] });
    // Kaperfahrer an Deck (Truppfigur) mit Fernrohr / privateer on deck (team figure) with a spyglass
    b.group({ p: [0.045, dk, -0.03], r: [0, -0.4, 0], s: 0.6 }, () => {
      soldier(b, f, { ...standPose([[-0.06, 0.33, 0.1], [0.11, 0.15, 0.03]]), head: [-0.15, 0, 0] }, { detail: 1, pack: 'none', seed: 77 });
      b.tube([-0.06, 0.33, 0.1], [-0.055, 0.36, 0.2], 0.009, 8, mat.gold, 0.007);
    });
  }
  return b;
}

// ---------- Velkar: Prototyp-Laeufer / prototype walker ----------

export function protoWalker(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const seg = lite ? 6 : 10;
  const metal = mat.gunmetal;
  const glow = L.secondary;
  // Vogelbeine mit Hydraulikkolben / bird legs with hydraulic pistons
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.085, 0.27, -0.02], knee: V3 = [s * 0.1, 0.17, -0.1], ankle: V3 = [s * 0.095, 0.05, -0.0];
    b.segment(V(hip), V(knee), (l) => geo.rbox(0.065, l + 0.03, 0.07, 0.014), L.hull);
    b.segment(V(knee), V(ankle), (l) => geo.rbox(0.045, l + 0.01, 0.05, 0.01), L.hullDark);
    // Kniepanzer in Fraktionsfarbe / knee armour in faction colour
    b.add(geo.rtaper(0.07, 0.03, 0.05, 0.02, 0.06, 0.008), L.primary, { p: [s * 0.1, 0.17, -0.125], r: [0.5, 0, 0] });
    if (!lite) {
      b.tube([s * 0.12, 0.25, -0.03], [s * 0.12, 0.13, -0.06], 0.008, 6, mat.metalLight);
      b.tube([s * 0.12, 0.19, -0.045], [s * 0.12, 0.13, -0.06], 0.012, 6, mat.yellow);
    }
    for (const j of [hip, knee, ankle]) b.add(geo.sphere(0.026, seg, lite ? 3 : 5), metal, { p: j });
    // breite Krallenfuesse / wide clawed feet
    for (const a of [-0.45, 0, 0.45]) b.add(geo.rtaper(0.024, 0.07, 0.014, 0.034, 0.022, 0.005), metal, { p: [s * 0.095 + Math.sin(a) * 0.035, 0.012, 0.03 + Math.cos(a) * 0.03], r: [0, a, 0] });
    b.add(geo.taper(0.02, 0.05, 0.01, 0.022, 0.02), metal, { p: [s * 0.095, 0.012, -0.05] });
  }
  // Becken und Kanzel mit Sichtschlitz / pelvis and cockpit with vision slit
  b.add(geo.rbox(0.15, 0.05, 0.09, 0.014), metal, { p: [0, 0.27, -0.02] });
  b.add(lite ? geo.taper(0.22, 0.2, 0.17, 0.15, 0.13, 0.02) : geo.rtaper(0.22, 0.2, 0.17, 0.15, 0.13, 0.022, 0.02), L.hull, { p: [0, 0.36, 0.0] });
  b.add(geo.rtaper(0.15, 0.04, 0.12, 0.02, 0.04, 0.006), mat.glassDark, { p: [0, 0.385, 0.095], r: [-0.4, 0, 0] });
  b.box(0.13, 0.008, 0.008, glow, [0, 0.36, 0.106]);
  stripes(b, 0, 0.305, 0.101, 0.2, 0.02, lite ? 4 : 8);
  // Prototyp-Nummer und Emblem / prototype number plate and emblem
  b.box(0.05, 0.03, 0.004, mat.white, [0.11, 0.37, 0.03], [0, HALF_PI, 0]);
  b.box(0.03, 0.006, 0.006, mat.ink, [0.112, 0.372, 0.03], [0, HALF_PI, 0]);
  if (!lite) addEmblem(b, f, 0.026, 0.006, glow, { p: [-0.112, 0.36, 0.0], r: [0, -HALF_PI, 0] });
  // Moerserkanone (Flaechenschaden) / mortar cannon (splash)
  b.group({ p: [0, 0.43, -0.02] }, () => {
    b.cyl(0.05, 0.055, 0.03, seg, metal, [0, 0.015, 0]);
    b.add(geo.cbox(0.09, 0.05, 0.1, 0.012), L.hullDark, { p: [0, 0.05, 0] });
    b.cyl(0.026, 0.03, 0.2, seg, metal, [0, 0.07, 0.12], [HALF_PI - 0.35, 0, 0]);
    b.cyl(0.034, 0.034, 0.03, seg, mat.ink, [0, 0.105, 0.21], [HALF_PI - 0.35, 0, 0]);
    if (!lite) for (const z of [0.07, 0.12]) b.add(geo.torus(0.032, 0.005, 3, seg), glow, { p: [0, 0.07 + (z - 0.07) * 0.34, z], r: [-0.35, 0, 0] });
  });
  // Teslaspule auf dem Ruecken / tesla coil on the back
  b.group({ p: [0, 0.36, -0.11] }, () => {
    b.cyl(0.03, 0.036, 0.1, seg, metal, [0, 0.05, 0]);
    const rings = lite ? 2 : 4;
    for (let i = 0; i < rings; i++) b.add(geo.torus(0.032, 0.007, 3, seg), mat.metalLight, { p: [0, 0.02 + i * 0.025, 0], r: [HALF_PI, 0, 0] });
    b.cyl(0.006, 0.006, 0.1, 4, mat.metalLight, [0, 0.15, 0]);
    b.add(geo.sphere(0.03, seg, lite ? 4 : 6), glow, { p: [0, 0.21, 0] });
    if (!lite) {
      // Funkenblitze / spark arcs
      const R = rng(5);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const p0: V3 = [Math.sin(a) * 0.03, 0.21, Math.cos(a) * 0.03];
        const p1: V3 = [Math.sin(a) * 0.07, 0.2 + R() * 0.04, Math.cos(a) * 0.07];
        const p2: V3 = [Math.sin(a + 0.4) * 0.1, 0.17 + R() * 0.03, Math.cos(a + 0.4) * 0.1];
        b.tube(p0, p1, 0.003, 3, mat.yellow);
        b.tube(p1, p2, 0.003, 3, mat.yellow);
      }
    }
  });
  if (!lite) {
    // Kabelbuendel und Kuehlrippen / cable bundles and cooling fins
    for (const s of [-1, 1]) {
      b.tube([s * 0.03, 0.43, -0.09], [s * 0.1, 0.3, -0.06], 0.006, 5, mat.red);
      for (let i = 0; i < 4; i++) b.box(0.004, 0.06, 0.05, mat.metalLight, [s * (0.112 + i * 0.008), 0.34, -0.06]);
    }
    b.add(geo.ico(0.012, 0), mat.snow, { p: [0.06, 0.43, 0.04] });
  }
  if (fine() && !lite) {
    // Nietreihen an der Kanzel, Kanzelrahmen, Scheinwerfer, Gelenkbolzen, Hydraulikschlaeuche, Leiter, Auspuff
    // rivet rows on the cockpit, cockpit frame, headlights, joint bolts, hydraulic hoses, ladder, exhaust
    for (const y of [0.31, 0.415]) rivetRow(b, [-0.085, y, 0.093 + (y - 0.31) * -0.18], [0.085, y, 0.093 + (y - 0.31) * -0.18], 8, [0, 0.2, 1], 0.004, mat.metalLight);
    for (const s of [-1, 1]) {
      rivetRow(b, [s * 0.107, 0.31, -0.07], [s * 0.107, 0.31, 0.07], 6, [s, 0, 0], 0.004, mat.metalLight);
      b.box(0.008, 0.05, 0.008, mat.dark, [s * 0.075, 0.385, 0.1], [-0.4, 0, 0]);
      headlight(b, [s * 0.075, 0.33, 0.105], [0, -0.1, 1], 0.014, metal, true);
      for (const j of [[s * 0.085, 0.27, -0.02], [s * 0.1, 0.17, -0.1], [s * 0.095, 0.05, -0.0]] as V3[]) {
        b.add(geo.cyl(0.012, 0.012, 0.008, 10), mat.metalLight, { p: [j[0] + s * 0.026, j[1], j[2]], r: [0, 0, HALF_PI] });
        b.add(geo.cyl(0.005, 0.005, 0.012, 6), mat.dark, { p: [j[0] + s * 0.03, j[1], j[2]], r: [0, 0, HALF_PI] });
      }
      seam(b, [[s * 0.07, 0.3, -0.06], [s * 0.12, 0.22, -0.1], [s * 0.115, 0.13, -0.1], [s * 0.1, 0.07, -0.03]], 0.0035, mat.dark);
      seam(b, [[s * 0.06, 0.3, -0.08], [s * 0.065, 0.2, -0.125], [s * 0.08, 0.1, -0.09]], 0.003, mat.red);
    }
    for (let i = 0; i < 4; i++) b.box(0.07, 0.006, 0.01, mat.metalLight, [0, 0.31 + i * 0.025, -0.084]);
    for (const s of [-1, 1]) b.box(0.006, 0.11, 0.01, mat.metalLight, [s * 0.035, 0.345, -0.084]);
    b.cyl(0.012, 0.014, 0.08, 10, metal, [0.07, 0.47, -0.07]);
    b.add(geo.cyl(0.015, 0.015, 0.012, 10, true), mat.dark, { p: [0.07, 0.51, -0.07] });
    // Luftschlitze, Plattennaehte, Kabel an den Unterschenkeln, Zehenkrallen / vents, plate seams, shin cables, toe claws
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) b.box(0.006, 0.006, 0.05, mat.dark, [s * 0.103, 0.34 + i * 0.012, 0.02]);
      seam(b, [[s * 0.098, 0.3, -0.075], [s * 0.088, 0.425, -0.06]], 0.0018, shade(L.hull, 0.7));
      seam(b, [[s * 0.07, 0.15, -0.09], [s * 0.075, 0.08, -0.02]], 0.004, mat.dark);
      for (const a of [-0.45, 0, 0.45]) b.add(capsule(0.006, 0.002, 0.022, 6, 1), mat.metalLight, { p: [s * 0.095 + Math.sin(a) * 0.07, 0.008, 0.03 + Math.cos(a) * 0.066], r: [HALF_PI, a, 0] });
    }
    seam(b, [[-0.09, 0.36, 0.105], [0.09, 0.36, 0.105]], 0.0016, shade(L.hull, 0.7));
  }
  return b;
}

// ---------- Gebaeude / buildings ----------

/** Korvat: Kolchose / kolkhoz */
export function kolkhoz(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'korvat');
  // Weizenfeld mit Reihen / wheat field with rows
  b.block(0.12, 0, 0.14, 0.4, 0.012, 0.32, shade(mat.wood, 1.1));
  for (let i = 0; i < 6; i++) b.block(0.12, 0.012, 0.01 + i * 0.052, 0.38, 0.034, 0.03, i % 3 === 2 ? mat.green : mat.yellow);
  // lange Kollektivscheune mit Banner / long collective barn with banner
  hall(b, f, -0.1, -0.16, 0.42, 0.2, 0.15);
  b.block(-0.1, 0.11, -0.055, 0.26, 0.035, 0.006, L.primary);
  if (f) addEmblem(b, f, 0.016, 0.006, L.emblem, { p: [-0.1, 0.128, -0.05] });
  // Wasserturm / water tower
  b.group({ p: [0.25, 0, -0.22] }, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([sx * 0.04, 0, sz * 0.04], [sx * 0.03, 0.24, sz * 0.03], 0.006, 4, mat.metal);
    b.cyl(0.055, 0.05, 0.08, 10, L.primary, [0, 0.28, 0]);
    b.add(geo.cone(0.06, 0.04, 10), L.roofDark, { p: [0, 0.34, 0] });
    b.box(0.11, 0.012, 0.006, mat.white, [0, 0.28, 0.054]);
  });
  // Heuballen und Traktor / hay bales and tractor
  for (const [x, z] of [[-0.3, 0.1], [-0.24, 0.16], [-0.3, 0.22]] as [number, number][]) {
    b.cyl(0.032, 0.032, 0.05, 10, mat.yellow, [x, 0.032, z], [0, 0, HALF_PI]);
    b.cyl(0.026, 0.026, 0.052, 10, shade(mat.yellow, 0.85), [x, 0.032, z], [0, 0, HALF_PI]);
  }
  b.cyl(0.032, 0.032, 0.05, 10, mat.yellow, [-0.27, 0.088, 0.16], [0, 0, HALF_PI]);
  tractor(b, f, 0.1, -0.02, -1.2);
  flagPole(b, f, -0.36, 0, -0.3, 0.3, 0.8);
}

/** Dravon: Soeldnerkaserne / mercenary barracks */
export function mercenaryBarracks(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'dravon');
  // Exerzierplatz / parade ground
  b.block(0.04, 0, 0.1, 0.48, 0.012, 0.3, mat.concrete);
  for (let i = 0; i < 4; i++) b.block(-0.16 + i * 0.12, 0.012, 0.1, 0.006, 0.002, 0.26, mat.white);
  // zwei Baracken / two barracks huts
  hall(b, f, -0.12, -0.22, 0.32, 0.14, 0.11, 0, L.wallDark);
  hall(b, f, 0.26, -0.02, 0.16, 0.3, 0.1, HALF_PI, L.wallDark);
  // Uebungspuppen / training dummies
  for (const x of [-0.12, 0.0, 0.1]) {
    b.cyl(0.006, 0.006, 0.08, 4, mat.wood, [x, 0.052, 0.18]);
    b.add(geo.rbox(0.04, 0.05, 0.03, 0.008), mat.sand, { p: [x, 0.09, 0.18] });
    b.add(geo.sphere(0.018, 6, 4), mat.sand, { p: [x, 0.13, 0.18] });
    b.box(0.07, 0.008, 0.008, mat.wood, [x, 0.1, 0.18]);
  }
  // Schiessscheibe / target board
  b.cyl(0.045, 0.045, 0.008, 12, mat.white, [-0.22, 0.08, 0.2], [HALF_PI, 0, 0]);
  b.cyl(0.03, 0.03, 0.01, 12, L.primary, [-0.22, 0.08, 0.2], [HALF_PI, 0, 0]);
  b.cyl(0.012, 0.012, 0.012, 8, mat.ink, [-0.22, 0.08, 0.2], [HALF_PI, 0, 0]);
  for (const s of [-1, 1]) b.tube([-0.22 + s * 0.03, 0, 0.21], [-0.22 + s * 0.02, 0.06, 0.205], 0.004, 4, mat.wood);
  // Wachturm mit Goldakzent / watchtower with gold accent
  b.group({ p: [-0.32, 0, 0.02] }, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([sx * 0.04, 0, sz * 0.04], [sx * 0.03, 0.26, sz * 0.03], 0.006, 4, mat.dark);
    b.block(0, 0.26, 0, 0.09, 0.05, 0.09, L.primary);
    b.block(0, 0.28, 0, 0.095, 0.012, 0.095, L.secondary);
    b.add(geo.cone(0.075, 0.07, 4).rotateY(Math.PI / 4), L.roof, { p: [0, 0.345, 0] });
  });
  // Sandsaecke, Waffenkisten, Werbetafel / sandbags, weapon crates, recruiting board
  for (let i = 0; i < 4; i++) sandbag(b, 0.08 + i * 0.09, 0, 0.3, 0);
  crate(b, 0.3, 0, 0.22, 0.05, L.primaryDark);
  crate(b, 0.24, 0, 0.25, 0.04, mat.woodLight);
  b.block(0.13, 0.13, -0.3, 0.16, 0.08, 0.008, mat.ink);
  b.block(0.13, 0.13, -0.296, 0.15, 0.07, 0.006, L.primary);
  if (f) addEmblem(b, f, 0.024, 0.008, L.secondary, { p: [0.13, 0.17, -0.29] });
  for (const s of [-1, 1]) b.block(0.13 + s * 0.07, 0, -0.3, 0.008, 0.13, 0.008, mat.dark);
  flagPole(b, f, 0.36, 0, 0.32, 0.3, 0.8);
}

/** Alvenia: Botschaftspalast mit Flaggen der Nationen / embassy palace with the flags of the nations */
export function embassyPalace(b: Builder, f: FactionId | null) {
  // Heiliges Alvenia: Lichtdom (ID embassyPalace) / Holy Alvenia: Cathedral of Light (ID embassyPalace)
  if (f === null || f === 'alvenia') { cathedral(b, f); return; }
  const L = look(f);
  // Sockel und Freitreppe / plinth and grand stairs
  b.block(0, 0, -0.05, 0.66, 0.03, 0.44, mat.concreteLight);
  for (let i = 0; i < 3; i++) b.block(0, 0.0 + i * 0.012, 0.19 - i * 0.02, 0.2, 0.012, 0.04, mat.paper);
  // Mittelbau mit Saeulen und Giebel / central block with columns and pediment
  b.block(0, 0.03, -0.1, 0.36, 0.16, 0.2, mat.paper);
  band(b, 0, 0.11, -0.1, 0.36, 0.2, 0.02, mat.window);
  for (let i = 0; i < 6; i++) b.cyl(0.014, 0.016, 0.15, 8, mat.white, [-0.15 + i * 0.06, 0.105, 0.03]);
  b.block(0, 0.18, -0.04, 0.38, 0.02, 0.17, mat.white);
  b.add(geo.profileXY([[-0.19, 0], [0.19, 0], [0, 0.06]], 0.02), L.roof, { p: [0, 0.2, 0.035] });
  if (f) addEmblem(b, f, 0.022, 0.006, L.emblem, { p: [0, 0.22, 0.047] });
  // Seitenfluegel / side wings
  for (const s of [-1, 1]) {
    b.block(s * 0.26, 0.03, -0.12, 0.14, 0.12, 0.18, L.wall);
    band(b, s * 0.26, 0.09, -0.12, 0.14, 0.18, 0.018, mat.window);
    gableRoof(b, s * 0.26, 0.15, -0.12, 0.15, 0.19, 0.05, L.roof, HALF_PI);
  }
  // Kuppel / dome
  b.cyl(0.075, 0.075, 0.05, 14, mat.paper, [0, 0.225, -0.12]);
  b.add(geo.hemi(0.075, 14, 4), L.primary, { p: [0, 0.25, -0.12] });
  b.cyl(0.01, 0.014, 0.05, 6, mat.gold, [0, 0.345, -0.12]);
  b.add(geo.ico(0.014, 0), mat.gold, { p: [0, 0.38, -0.12] });
  // Flaggenreihe der Nationen / row of the nations' flags
  const nations: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'];
  nations.forEach((n, i) => flagPole(b, n, -0.3 + i * 0.13, 0.03, 0.22, 0.2, 0.5));
}

/** Meridon: Handelskontor mit Treppengiebel / trading post with stepped gable */
export function tradingPost(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'meridon');
  b.block(0, 0, 0, 0.66, 0.012, 0.6, mat.concreteLight);
  // Kontorhaus, Giebel nach vorn / merchant house, gable to the front
  const w = 0.24, d = 0.3, h = 0.24;
  b.block(-0.1, 0.012, -0.08, w, h, d, mat.paper);
  for (let k = 0; k < 4; k++) {
    const sw = w - k * 0.055;
    b.block(-0.1, 0.012 + h + k * 0.04, -0.08 + d / 2 - 0.02, sw, 0.04, 0.04, k % 2 ? L.primary : mat.paper);
  }
  b.add(geo.profileXY([[-w / 2 + 0.01, 0], [w / 2 - 0.01, 0], [0, 0.13]], d - 0.04), L.roof, { p: [-0.1, 0.012 + h, -0.1] });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    if (r === 0 && c === 1) continue;
    b.box(0.034, 0.042, 0.006, mat.window, [-0.1 - 0.07 + c * 0.07, 0.06 + r * 0.07, -0.08 + d / 2 + 0.003]);
    b.box(0.04, 0.006, 0.01, L.primary, [-0.1 - 0.07 + c * 0.07, 0.036 + r * 0.07, -0.08 + d / 2 + 0.004]);
  }
  // Ladetor und Markise / loading door and awning
  b.box(0.05, 0.07, 0.008, mat.wood, [-0.1, 0.047, -0.08 + d / 2 + 0.004]);
  b.add(geo.profileZY([[0, 0], [0.07, -0.03], [0.07, -0.036], [0, -0.006]], 0.12), L.secondary, { p: [-0.1, 0.13, -0.08 + d / 2] });
  // Lastkran am Giebel / hoist beam at the gable
  b.box(0.012, 0.012, 0.09, mat.wood, [-0.1, 0.33, 0.1]);
  b.tube([-0.1, 0.33, 0.14], [-0.1, 0.2, 0.14], 0.002, 3, mat.dark);
  crate(b, -0.12, 0.17, 0.12, 0.04, L.trim);
  // Waren: Kisten, Faesser, Saecke, Waage / goods: crates, barrels, sacks, scale
  crate(b, 0.15, 0.012, 0.15, 0.06, mat.woodLight);
  crate(b, 0.21, 0.012, 0.18, 0.05, L.primary);
  crate(b, 0.17, 0.072, 0.16, 0.045, L.secondary);
  barrel(b, 0.22, 0.012, -0.05, L.primary);
  barrel(b, 0.28, 0.012, 0.0, mat.wood);
  barrel(b, 0.22, 0.012, 0.04, mat.metal);
  for (const [x, z] of [[0.05, 0.24], [0.1, 0.25], [0.075, 0.25]] as [number, number][]) b.add(geo.sphere(0.028, 8, 5), mat.sand, { p: [x, 0.03, z], s: [1, 0.8, 1.2] });
  b.group({ p: [0.24, 0.012, -0.2] }, () => {
    b.cyl(0.006, 0.008, 0.12, 6, mat.dark, [0, 0.06, 0]);
    b.box(0.12, 0.006, 0.006, mat.gold, [0, 0.12, 0]);
    for (const s of [-1, 1]) {
      b.tube([s * 0.055, 0.12, 0], [s * 0.055, 0.08, 0], 0.002, 3, mat.dark);
      b.cyl(0.024, 0.018, 0.01, 10, mat.gold, [s * 0.055, 0.078, 0]);
    }
    for (let i = 0; i < 3; i++) b.cyl(0.012, 0.012, 0.004, 8, mat.gold, [-0.055, 0.086 + i * 0.005, 0]);
  });
  if (f) addEmblem(b, f, 0.026, 0.006, L.emblem, { p: [-0.1, 0.31, -0.08 + d / 2 + 0.006] });
  flagPole(b, f, 0.3, 0.012, -0.28, 0.28, 0.7);
}

/** Velkar: Versuchslabor mit Teslaturm / test lab with tesla tower */
export function testLab(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'velkar');
  const glow = L.secondary;
  b.block(0, 0, 0, 0.66, 0.014, 0.6, mat.concreteDark);
  stripes(b, 0, 0.018, 0.3, 0.6, 0.008, 12);
  // Laborbunker mit Kuppel / lab bunker with dome
  b.add(geo.ctaper(0.34, 0.24, 0.3, 0.2, 0.14, 0.03), mat.concreteLight, { p: [-0.1, 0.084, -0.1] });
  band(b, -0.1, 0.09, -0.1, 0.33, 0.23, 0.02, mat.glassDark);
  b.block(-0.1, 0.154, -0.1, 0.31, 0.012, 0.21, L.roof);
  b.cyl(0.07, 0.07, 0.03, 12, mat.concrete, [-0.16, 0.18, -0.12]);
  b.add(geo.hemi(0.07, 12, 4), mat.white, { p: [-0.16, 0.195, -0.12] });
  b.box(0.02, 0.05, 0.11, mat.dark, [-0.16, 0.235, -0.12], [0, 0, 0.6]);
  b.add(geo.cbox(0.06, 0.07, 0.008, 0.006), mat.yellow, { p: [-0.02, 0.05, 0.022] });
  b.box(0.04, 0.006, 0.01, mat.ink, [-0.02, 0.06, 0.027]);
  if (f) addEmblem(b, f, 0.024, 0.006, glow, { p: [-0.2, 0.09, 0.022] });
  // Teslaturm mit Blitzen / tesla tower with arcs
  b.group({ p: [0.2, 0.014, -0.16] }, () => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.tube([Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06], [0, 0.22, 0], 0.006, 4, mat.metal);
    }
    b.cyl(0.02, 0.026, 0.26, 10, mat.gunmetal, [0, 0.13, 0]);
    for (let i = 0; i < 5; i++) b.add(geo.torus(0.032 - i * 0.003, 0.006, 3, 12), mat.metalLight, { p: [0, 0.08 + i * 0.04, 0], r: [HALF_PI, 0, 0] });
    b.add(geo.sphere(0.045, 12, 8), glow, { p: [0, 0.31, 0] });
    const R = rng(11);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      let p: V3 = [Math.sin(a) * 0.04, 0.31, Math.cos(a) * 0.04];
      for (let k = 1; k <= 3; k++) {
        const q: V3 = [Math.sin(a + (R() - 0.5) * 0.6) * (0.04 + k * 0.035), 0.31 - k * 0.03 + (R() - 0.5) * 0.03, Math.cos(a + (R() - 0.5) * 0.6) * (0.04 + k * 0.035)];
        b.tube(p, q, 0.0035, 3, mat.yellow);
        p = q;
      }
    }
  });
  // Reaktortanks mit leuchtender Fluessigkeit / reactor tanks with glowing liquid
  for (const [x, z] of [[0.08, 0.16], [0.18, 0.12], [0.26, 0.2]] as [number, number][]) {
    b.cyl(0.035, 0.035, 0.012, 10, mat.gunmetal, [x, 0.02, z]);
    b.cyl(0.03, 0.03, 0.1, 10, mix(glow, mat.glass, 0.35), [x, 0.076, z]);
    b.cyl(0.033, 0.033, 0.012, 10, mat.gunmetal, [x, 0.132, z]);
    b.add(geo.sphere(0.008, 6, 4), mat.white, { p: [x + 0.01, 0.09, z + 0.025] });
  }
  b.tube([0.08, 0.13, 0.16], [0.18, 0.13, 0.12], 0.006, 5, mat.metal);
  b.tube([0.18, 0.13, 0.12], [0.26, 0.13, 0.2], 0.006, 5, mat.metal);
  b.tube([0.08, 0.1, 0.16], [-0.05, 0.1, 0.04], 0.008, 5, mat.red);
  // Container mit Schnee, Antenne / container with snow, antenna
  b.block(-0.24, 0.014, 0.18, 0.14, 0.07, 0.08, L.primary);
  b.block(-0.24, 0.084, 0.18, 0.142, 0.012, 0.082, mat.snow);
  b.tube([-0.3, 0.014, -0.25], [-0.3, 0.36, -0.25], 0.005, 4, mat.metal);
  b.add(geo.ico(0.012, 0), glow, { p: [-0.3, 0.37, -0.25] });
  flagPole(b, f, 0.31, 0.014, 0.0, 0.24, 0.6);
}
