/**
 * Neue Baureihen von NEXUS: Cyborg-Infanterie, Flammenwerferpanzer, Kamikaze-Laufdrohne. Gleiche Formensprache wie
 * robots.ts: weisse Platten, Kanonenmetall, cyan leuchtende Linien und Augen, Sechseckpaneele.
 * New NEXUS series: cyborg infantry, flamethrower tank, kamikaze walker drone. Same design language as robots.ts:
 * white plates, gunmetal, cyan glowing lines and eyes, hexagonal panels.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { robotHead } from './headgear';
import {
  antennaBase, boltRing, cable, finRings, grille, piston, rivets, roundHatch, seam, sensorCluster, squareHatch, towHook, vents,
} from './detailVehicles';
import { Builder, ball, capsule, fine, geo, shade, type V3 } from './kit';
import { look, mat, type Look } from './look';
import { coils, hexPanel, joint, limb } from './robots';
import { antenna, tracks } from './tanks';

const HALF_PI = Math.PI / 2;

// ---------- Cyborg-Infanterie / cyborg infantry ----------

/**
 * Schwerer Maschinensoldat: breiter gepanzerter Rumpf mit Schulterpanzern in Fraktionsfarbe, Servo-Gelenke, Visierkopf,
 * schwere Armkanone mit Spulen und Kuehlrippen, Reaktorrucksack.
 * Heavy machine soldier: broad armoured torso with pauldrons in the faction colour, servo joints, visor head, heavy arm
 * cannon with coils and cooling fins, reactor backpack.
 */
export function cyborg(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.jacket, metal = mat.gunmetal, glow = mat.cyanGlow;
  if (!lite && fine()) cyborgDetail(b, L);
  // Beine mit Kniepanzern / legs with knee guards
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.05, 0.17, 0], knee: V3 = [s * 0.055, 0.095, 0.025], ankle: V3 = [s * 0.056, 0.03, 0];
    limb(b, hip, knee, 0.056, 0.06, plate, lite);
    limb(b, knee, ankle, 0.046, 0.05, metal, lite);
    joint(b, knee, 0.028, lite);
    b.add(geo.rtaper(0.05, 0.03, 0.04, 0.02, 0.05, 0.008), L.primary, { p: [s * 0.056, 0.1, 0.05], r: [-0.25, 0, 0] });
    b.add(lite ? geo.box(0.06, 0.03, 0.095) : geo.rtaper(0.062, 0.1, 0.05, 0.07, 0.03, 0.008, 0.01), metal, { p: [s * 0.056, 0.015, 0.014] });
    if (!lite) b.box(0.006, 0.034, 0.006, glow, [s * 0.084, 0.06, 0.02]);
  }
  // Becken, breiter Rumpf / pelvis, broad torso
  b.add(geo.rbox(0.13, 0.045, 0.08, 0.014), metal, { p: [0, 0.18, 0] });
  b.cyl(0.04, 0.045, 0.03, lite ? 6 : 10, metal, [0, 0.21, 0]);
  b.add(lite ? geo.taper(0.13, 0.08, 0.18, 0.1, 0.12) : geo.rtaper(0.13, 0.08, 0.18, 0.1, 0.12, 0.016), plate, { p: [0, 0.28, 0] });
  // Brustpanzer mit Leuchtkern / chest plate with glowing core
  b.add(geo.rtaper(0.12, 0.02, 0.15, 0.02, 0.08, 0.006), L.primary, { p: [0, 0.285, 0.05] });
  b.add(geo.sphere(0.018, lite ? 6 : 10, lite ? 3 : 5), glow, { p: [0, 0.29, 0.063] });
  if (!lite) {
    b.add(geo.torus(0.024, 0.005, 3, 10), metal, { p: [0, 0.29, 0.064] });
    hexPanel(b, [0, 0.245, 0.051], 0.02, shade(plate, 0.85), [HALF_PI, 0, 0]);
    addEmblem(b, f, 0.018, 0.004, L.emblem, { p: [-0.045, 0.315, 0.062] });
    antenna(b, 0.04, 0.34, -0.07, 0.11, glow);
  }
  // Reaktorrucksack mit hohen Kuehlschloten; Lesbarkeit: die zwei Schlote ragen ueber den Kopf (Kennform des Cyborgs gegen
  // den schlanken Androiden) / reactor backpack with tall cooling stacks; readability: the two stacks rise above the head
  // (the cyborg's signature against the slim android)
  b.add(lite ? geo.box(0.13, 0.12, 0.06) : geo.cbox(0.13, 0.12, 0.06, 0.014), metal, { p: [0, 0.29, -0.075] });
  for (const s of [-1, 1]) {
    b.cyl(0.022, 0.026, 0.22, lite || !fine() ? 6 : 10, metal, [s * 0.048, 0.36, -0.105]);
    b.add(geo.cyl(0.026, 0.026, 0.03, lite || !fine() ? 6 : 10), glow, { p: [s * 0.048, 0.47, -0.105] });
    if (!lite && fine()) b.cyl(0.03, 0.03, 0.016, 10, mat.dark, [s * 0.048, 0.445, -0.105]);
  }
  // Kopf mit Visier / head with visor
  b.group({ p: [0, 0.335, 0.005], s: 0.95 }, () => robotHead(b, L, lite ? 1 : 2, false));
  // Schulterpanzer / pauldrons
  for (const s of [-1, 1]) {
    joint(b, [s * 0.105, 0.325, 0], 0.03, lite, metal);
    b.add(lite ? geo.box(0.07, 0.05, 0.08) : geo.rtaper(0.07, 0.085, 0.055, 0.07, 0.05, 0.012), L.primary, { p: [s * 0.115, 0.345, 0], r: [0, 0, s * -0.25] });
    if (!lite) b.box(0.004, 0.04, 0.07, glow, [s * 0.15, 0.34, 0], [0, 0, s * -0.25]);
  }
  // rechter Arm: schwere Armkanone mit Kuehlrippen / right arm: heavy arm cannon with cooling fins
  const shR: V3 = [0.11, 0.31, 0], elR: V3 = [0.125, 0.235, 0.04];
  limb(b, shR, elR, 0.042, 0.046, plate, lite);
  joint(b, elR, 0.024, lite);
  b.add(geo.rbox(0.066, 0.066, 0.13, 0.014), metal, { p: [0.125, 0.228, 0.11] });
  if (!lite) for (let i = 0; i < 4; i++) b.box(0.074, 0.006, 0.008, mat.dark, [0.125, 0.262, 0.07 + i * 0.026]);
  b.cyl(0.022, 0.024, 0.15, lite ? 6 : 12, metal, [0.125, 0.228, 0.24], [HALF_PI, 0, 0]);
  if (!lite) coils(b, 0.125, 0.228, 0.19, 0.3, 3, 0.028);
  b.add(geo.ico(0.018, lite ? 0 : 1), glow, { p: [0.125, 0.228, 0.32] });
  // linker Arm stuetzt die Kanone / left arm supports the cannon
  const shL: V3 = [-0.11, 0.31, 0], elL: V3 = [-0.12, 0.235, 0.05], hL: V3 = [0.08, 0.215, 0.12];
  limb(b, shL, elL, 0.042, 0.046, plate, lite);
  joint(b, elL, 0.024, lite);
  limb(b, elL, hL, 0.036, 0.04, metal, lite);
  b.add(geo.rbox(0.034, 0.03, 0.034, 0.008), metal, { p: hL });
  return b;
}

/**
 * Cyborg, hohe Qualitaet: Wadenhydraulik, Kniebolzen, Hueftplatten, Guertel mit Taschen, Bolzen um die Brustplatte,
 * Kuehlleitungen zu den Schloten, Rippen am Rucksack, Unterarmpanzer und Finger links, Energiezelle und Schienen an der
 * Kanone, Halsring.
 * Cyborg, high quality: calf hydraulics, knee bolts, hip plates, belt with pouches, bolts around the chest plate, coolant
 * lines to the stacks, fins on the backpack, left forearm armour and fingers, power cell and rails on the cannon, neck ring.
 */
function cyborgDetail(b: Builder, L: Look) {
  const plate = L.jacket, metal = mat.gunmetal, glow = mat.cyanGlow;
  // Schulterhydraulik, Zehenplatten, Hueftgelenke, Rueckenplatte / shoulder hydraulics, toe plates, hip joints, back plate
  for (const s of [-1, 1]) {
    piston(b, [s * 0.09, 0.36, -0.03], [s * 0.12, 0.25, 0.02], 0.006, metal);
    for (const dx of [-0.014, 0.014]) b.add(geo.cbox(0.024, 0.012, 0.024, 0.004), shade(metal, 1.15), { p: [s * 0.056 + dx, 0.008, 0.068] });
    b.add(ball(0.022, 12, 8), metal, { p: [s * 0.05, 0.172, 0] });
    b.add(geo.cyl(0.016, 0.016, 0.008, 12), L.primary, { p: [s * 0.072, 0.172, 0], r: [0, 0, HALF_PI] });
  }
  b.add(geo.rtaper(0.12, 0.02, 0.11, 0.016, 0.06, 0.006), shade(plate, 0.9), { p: [0, 0.25, -0.05] });
  b.box(0.08, 0.003, 0.004, glow, [0, 0.262, -0.061]);
  for (const s of [-1, 1]) {
    piston(b, [s * 0.056, 0.09, -0.02], [s * 0.056, 0.036, -0.024], 0.0065, metal);
    for (const dx of [-0.014, 0.014]) b.box(0.0045, 0.0045, 0.0045, mat.dark, [s * 0.056 + dx, 0.112, 0.064]);
    b.add(geo.rtaper(0.016, 0.06, 0.013, 0.05, 0.05, 0.005), plate, { p: [s * 0.072, 0.16, 0.0], r: [0, 0, s * 0.16] });
    b.add(geo.cbox(0.03, 0.026, 0.018, 0.005), L.gear, { p: [s * 0.05, 0.178, 0.046] });
    b.box(0.02, 0.004, 0.02, shade(L.gear, 0.75), [s * 0.05, 0.19, 0.046]);
    // Kuehlleitung vom Rucksack zum Schlot, Rippen / coolant line from the pack to the stack, fins
    cable(b, [s * 0.06, 0.26, -0.105], [s * 0.048, 0.3, -0.13], 0.004, 0.004, mat.dark);
    for (let i = 0; i < 3; i++) b.box(0.006, 0.09, 0.05, shade(metal, 1.1), [s * (0.068 + i * 0.008), 0.29, -0.075]);
    b.add(geo.torus(0.026, 0.004, 3, 12), mat.dark, { p: [s * 0.048, 0.4, -0.105], r: [HALF_PI, 0, 0] });
  }
  rivets(b, [-0.065, 0.322, 0.062], [0.065, 0.322, 0.062], 6, mat.dark, 0.0045);
  rivets(b, [-0.055, 0.25, 0.058], [0.055, 0.25, 0.058], 5, mat.dark, 0.0045);
  b.box(0.13, 0.01, 0.084, mat.dark, [0, 0.196, 0]);
  vents(b, [0, 0.29, -0.106], [-HALF_PI, 0, 0], 4, 0.07, 0.014);
  b.add(geo.torus(0.03, 0.005, 4, 14), metal, { p: [0, 0.338, 0], r: [HALF_PI, 0, 0] });
  // Unterarm links, Finger / left forearm, fingers
  b.add(geo.rbox(0.046, 0.034, 0.08, 0.008), plate, { p: [-0.02, 0.225, 0.088], r: [0, 1.1, 0.1] });
  for (let i = 0; i < 3; i++) b.box(0.009, 0.009, 0.024, metal, [0.07 + i * 0.011, 0.2, 0.135], [0.5, 0, 0]);
  // Kanone: Energiezelle, Schienen, Muendungsschlitze / cannon: power cell, rails, muzzle slots
  b.add(geo.cyl(0.016, 0.016, 0.04, 10), glow, { p: [0.125, 0.268, 0.1], r: [HALF_PI, 0, 0] });
  for (const s of [-1, 1]) b.box(0.006, 0.012, 0.13, mat.dark, [0.125 + s * 0.026, 0.248, 0.24]);
  finRings(b, 0.125, 0.228, 0.165, 0.18, 2, 0.03, mat.dark);
}

// ---------- Flammenwerferpanzer / flamethrower tank ----------

/**
 * Kettenfahrzeug mit Sechseckpanzerung, gedrungener Turm mit breiter Flammenduese und Zuendflamme, zwei Brennstofftanks
 * auf dem Heck mit Leitungen zum Turm.
 * Tracked vehicle with hexagonal armour, squat turret with a wide flame nozzle and pilot flame, two fuel tanks on the
 * rear deck with hoses to the turret.
 */
export function flameTank(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  tracks(b, { x: 0.135, w: 0.085, len: 0.4, h: 0.085, wheels: 5, wr: 0.028, sprocket: L.primary, hub: glow, lite, links: 10, rich: true });
  const hi = !lite && fine();
  if (hi) flameHull(b, L);
  // Wanne mit Bugplatte / hull with glacis
  b.add(geo.rtaper(0.34, 0.4, 0.3, 0.34, 0.07, 0.016), plate, { p: [0, 0.12, 0] });
  if (!lite) {
    for (const s of [-1, 1]) {
      b.box(0.004, 0.004, 0.34, glow, [s * 0.16, 0.152, 0]);
      for (let i = 0; i < 4; i++) hexPanel(b, [s * 0.172, 0.075, -0.13 + i * 0.085], 0.024, shade(plate, 0.9), [0, 0, HALF_PI]);
    }
    for (const x of [-0.08, 0, 0.08]) hexPanel(b, [x, 0.156, 0.15], 0.022, shade(plate, 0.9), [0, 0, 0]);
    addEmblem(b, f, 0.024, 0.004, L.primary, { p: [0.11, 0.157, 0.06], r: [-HALF_PI, 0, 0] });
  }
  // Brennstofftanks auf dem Heck; Lesbarkeit: aufrecht und hoch wie zwei Tuerme (Kennform des Flammenpanzers gegen den
  // Railgun-Traeger mit langen Schienen) / fuel tanks on the rear deck; readability: upright and tall like two towers (the
  // flame tank's signature against the railgun carrier with its long rails)
  for (const s of [-1, 1]) {
    b.cyl(0.056, 0.056, 0.27, lite ? 8 : 14, L.primary, [s * 0.075, 0.29, -0.12]);
    b.add(geo.hemi(0.056, lite ? 8 : 14, lite ? 2 : 4), L.primary, { p: [s * 0.075, 0.425, -0.12], s: [1, 0.6, 1] });
    if (!lite) {
      for (const y of [0.2, 0.38]) b.cyl(0.059, 0.059, 0.014, 14, metal, [s * 0.075, y, -0.12]);
      // Warnband / hazard band
      b.add(geo.cyl(0.0585, 0.0585, 0.02, 14, true), mat.yellow, { p: [s * 0.075, 0.29, -0.12] });
      b.cyl(0.012, 0.012, 0.02, 8, metal, [s * 0.075, 0.465, -0.12]);
    }
    b.cyl(0.03, 0.034, 0.03, lite ? 6 : 10, metal, [s * 0.075, 0.15, -0.12]);
  }
  // gedrungener Turm vorn / squat turret at the front
  const ty = 0.155, tz = 0.05;
  // Leitungen von den Tanks zum Turmkranz bleiben an der Wanne / hoses from the tanks to the turret ring stay on the hull
  if (hi) for (const s of [-1, 1]) {
    // gewellte Schlaeuche mit Schellen / corrugated hoses with clamps
    cable(b, [s * 0.075, 0.33, -0.065], [s * 0.03, ty + 0.02, tz - 0.03], 0.02, 0.008, mat.dark);
    for (const t of [0.2, 0.5, 0.8]) b.add(geo.torus(0.009, 0.0025, 3, 8), mat.metal, { p: [s * (0.075 - 0.045 * t), 0.33 - (0.33 - ty - 0.02) * t - Math.sin(t * Math.PI) * 0.02, -0.065 + (tz - 0.03 + 0.065) * t], r: [0.6, 0, 0] });
  } else if (!lite) for (const s of [-1, 1]) b.tube([s * 0.075, 0.33, -0.065], [s * 0.03, ty + 0.02, tz - 0.03], 0.008, 6, mat.dark);
  // Drehturm um den Turmkranz / turret rotating around the turret ring
  b.turret([0, ty, tz], () => {
    b.cyl(0.07, 0.08, 0.025, lite ? 8 : 12, metal, [0, ty + 0.012, tz]);
    b.add(geo.rtaper(0.16, 0.15, 0.12, 0.11, 0.07, 0.018), plate, { p: [0, ty + 0.06, tz] });
    b.box(0.1, 0.008, 0.006, glow, [0, ty + 0.07, tz + 0.074]);
    // Flammenwerfer: Rohr, breite Duese, Zuendflamme / flamethrower: barrel, wide nozzle, pilot flame
    const gy = ty + 0.05;
    b.cyl(0.024, 0.028, 0.16, lite ? 8 : 12, metal, [0, gy, tz + 0.15], [HALF_PI, 0, 0]);
    b.add(geo.cyl(0.044, 0.026, 0.06, lite ? 8 : 12), mat.dark, { p: [0, gy, tz + 0.255], r: [HALF_PI, 0, 0] });
    b.add(geo.cyl(0.036, 0.036, 0.006, lite ? 8 : 12, true), mat.ink, { p: [0, gy, tz + 0.286], r: [HALF_PI, 0, 0] });
    b.add(geo.ico(0.016, lite ? 0 : 1), mat.orange, { p: [0, gy - 0.034, tz + 0.27] });
    if (!lite) {
      b.add(geo.ico(0.009, 0), mat.yellow, { p: [0, gy - 0.03, tz + 0.282] });
      b.cyl(0.006, 0.006, 0.05, 6, metal, [0, gy - 0.03, tz + 0.245], [HALF_PI, 0, 0]);
      for (let i = 0; i < 3; i++) b.box(0.05, 0.006, 0.006, mat.dark, [0, gy + 0.03, tz + 0.1 + i * 0.03]);
      // Sensorkopf / sensor head
      b.add(geo.rbox(0.04, 0.025, 0.03, 0.007), plate, { p: [-0.05, ty + 0.11, tz - 0.02] });
      b.box(0.03, 0.01, 0.004, glow, [-0.05, ty + 0.11, tz - 0.004]);
      antenna(b, 0.05, ty + 0.095, tz - 0.04, 0.12, glow);
    }
    if (hi) {
      // Kuehlrippen am Rohr, Bolzenkranz, Zuendleitung, Panzerbolzen / cooling fins on the barrel, bolt ring, igniter line, armour bolts
      finRings(b, 0, gy, tz + 0.1, tz + 0.2, 5, 0.034, mat.dark);
      boltRing(b, [0, ty + 0.026, tz], 0.076, 12, mat.dark, 0.0045);
      b.tube([0.03, gy - 0.02, tz + 0.1], [0.008, gy - 0.03, tz + 0.23], 0.0025, 4, mat.yellow);
      for (const s of [-1, 1]) rivets(b, [s * 0.075, ty + 0.06, tz - 0.05], [s * 0.075, ty + 0.06, tz + 0.06], 4, mat.dark, 0.0045);
      roundHatch(b, 0.03, ty + 0.095, tz - 0.03, 0.02, plate);
    }
  });
  return b;
}

/**
 * Flammenwerferpanzer-Wanne, hohe Qualitaet: Wartungsklappen, Sensorkuppeln, Abschleppoesen, Gitter, Plattenfugen,
 * Ventile mit Handrad, Druckanzeigen und Leitersprossen an den Brennstofftanks.
 * Flamethrower tank hull, high quality: service hatches, sensor domes, tow eyes, grilles, panel joints, valves with
 * handwheels, pressure gauges and ladder rungs on the fuel tanks.
 */
function flameHull(b: Builder, L: Look) {
  const plate = L.hull, metal = mat.gunmetal;
  squareHatch(b, -0.09, 0.155, 0.12, 0.05, 0.04, shade(plate, 0.95));
  for (const s of [-1, 1]) {
    b.add(geo.hemi(0.01, 10, 3), mat.glassDark, { p: [s * 0.14, 0.155, 0.16] });
    towHook(b, s * 0.08, 0.09, 0.205, 1, metal);
    towHook(b, s * 0.1, 0.09, -0.205, -1, metal);
    seam(b, [s * 0.14, 0.156, -0.18], [s * 0.14, 0.156, 0.1], shade(plate, 0.72));
    // Tank: Ventil mit Handrad, Druckanzeige, Leitersprossen / tank: valve with handwheel, pressure gauge, ladder rungs
    const x = s * 0.075;
    b.cyl(0.006, 0.006, 0.02, 6, metal, [x + s * 0.03, 0.44, -0.12]);
    b.add(geo.torus(0.012, 0.0022, 3, 10), mat.red, { p: [x + s * 0.03, 0.452, -0.12], r: [HALF_PI, 0, 0] });
    b.add(geo.cyl(0.012, 0.012, 0.006, 12), mat.dark, { p: [x, 0.33, -0.12 + 0.058], r: [HALF_PI, 0, 0] });
    b.add(geo.cyl(0.009, 0.009, 0.003, 12), mat.glass, { p: [x, 0.33, -0.12 + 0.062], r: [HALF_PI, 0, 0] });
    for (let i = 0; i < 5; i++) b.box(0.02, 0.004, 0.004, mat.dark, [x + s * 0.058, 0.2 + i * 0.04, -0.12]);
    for (const z of [-0.127, -0.113]) b.box(0.004, 0.18, 0.004, mat.dark, [x + s * 0.06, 0.28, z]);
  }
  grille(b, [0, 0.155, -0.2], 0.12, 0.03, 3, metal);
  sensorCluster(b, [0, 0.13, 0.205], 3, 0.006, mat.cyanGlow);
}

// ---------- Kamikaze-Laufdrohne / kamikaze walker drone ----------

/**
 * Kleine vierbeinige Laufdrohne: kugelige Sprengladung mit Warnstreifen, Sensorauge, rote Zuendleuchte und Antenne.
 * Small four-legged walker drone: spherical explosive charge with hazard stripes, sensor eye, red fuse light and antenna.
 */
/**
 * Kamikaze-Laufdrohne, hohe Qualitaet: Zuendkapseln mit Draehten rund um die Ladung, Zeitanzeige, Kabelbaum, Fussgelenk-
 * Hydraulik, Sensorgruppe, Antennenfuss. / Kamikaze walker drone, high quality: detonator caps with wires around the charge,
 * timer display, wiring harness, ankle hydraulics, sensor cluster, antenna base.
 */
function kamikazeDetail(b: Builder, L: Look, y: number) {
  const metal = mat.gunmetal, glow = mat.cyanGlow;
  // Tragrahmen um die Ladung, Panzerplatten, Kniekappen / carrying frame around the charge, armour plates, knee caps
  b.add(geo.torus(0.082, 0.004, 4, 24), metal, { p: [0, y + 0.02, 0], r: [0, 0, 0], s: [1, 0.85, 1.1] });
  b.add(geo.torus(0.082, 0.004, 4, 24), metal, { p: [0, y + 0.02, 0], r: [0, HALF_PI, 0], s: [1.1, 0.85, 1] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    hexPanel(b, [Math.sin(a) * 0.066, y + 0.05, Math.cos(a) * 0.072], 0.016, shade(L.hull, 0.88), [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9]);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const foot: V3 = [sx * 0.16, 0.012, sz * 0.15];
    b.add(geo.cyl(0.012, 0.014, 0.006, 10), mat.dark, { p: [foot[0], 0.004, foot[2]] });
    b.add(geo.cyl(0.006, 0.006, 0.02, 8), L.primary, { p: [sx * 0.045 * 1.25, y - 0.01, sz * 0.04 * 1.25], r: [0, 0, HALF_PI] });
  }
  vents(b, [0, y - 0.04, 0.0], [Math.PI, 0, 0], 4, 0.05, 0.01, glow);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const p: V3 = [Math.sin(a) * 0.06, y + 0.075, Math.cos(a) * 0.066];
    b.add(geo.cyl(0.007, 0.008, 0.012, 8), mat.dark, { p, r: [Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6] });
    b.add(geo.cyl(0.004, 0.004, 0.004, 6), mat.red, { p: [p[0] * 1.05, p[1] + 0.007, p[2] * 1.05] });
    cable(b, [p[0] * 1.02, p[1] + 0.006, p[2] * 1.02], [0.02, y + 0.1, 0.02], 0.008, 0.0016, i % 2 ? mat.red : mat.yellow);
  }
  b.add(geo.cbox(0.036, 0.016, 0.006, 0.003), mat.dark, { p: [0, y + 0.07, 0.072], r: [-0.6, 0, 0] });
  for (let i = 0; i < 3; i++) b.box(0.006, 0.009, 0.002, glow, [-0.01 + i * 0.01, y + 0.072, 0.075], [-0.6, 0, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const knee: V3 = [sx * 0.12, y + 0.04, sz * 0.11];
    piston(b, [knee[0] * 0.9, knee[1] - 0.012, knee[2] * 0.9], [sx * 0.15, 0.03, sz * 0.14], 0.004, metal);
  }
  sensorCluster(b, [0, y + 0.012, 0.09], 2, 0.0045, glow);
  antennaBase(b, -0.025, y + 0.07, -0.03, L.hullDark);
}

export function kamikazeDrone(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const plate = L.hull, metal = mat.gunmetal, glow = mat.cyanGlow;
  const y = 0.13;
  // vier Beine; Feinschliff: runde, kraeftigere Glieder mit Kniekappe, Hydraulikleitung und Krallenfuss statt Draht
  // four legs; polish: round, sturdier limbs with a knee cap, hydraulic line and claw foot instead of wire
  // niedrige Qualitaet: duennere Glieder mit weniger Segmenten, ohne Kappen und Leitungen / low quality: thinner limbs with fewer segments, without caps and lines
  const lo = lite || !fine();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const base: V3 = [sx * 0.045, y - 0.01, sz * 0.04];
    const knee: V3 = [sx * 0.12, y + 0.04, sz * 0.11];
    const foot: V3 = [sx * 0.16, 0.012, sz * 0.15];
    joint(b, base, 0.016, lite);
    b.segment(new THREE.Vector3(...base), new THREE.Vector3(...knee), (l) => (lo ? geo.cyl(0.011, 0.009, l, 6) : capsule(0.012, 0.01, l + 0.012, 10, 1)), plate);
    joint(b, knee, 0.015, lite, L.primary);
    b.segment(new THREE.Vector3(...knee), new THREE.Vector3(...foot), (l) => (lo ? geo.cyl(0.008, 0.006, l, 6) : capsule(0.009, 0.007, l + 0.008, 8, 1)), metal);
    if (!lo) {
      b.add(geo.hemi(0.017, 10, 3), plate, { p: [knee[0] * 1.06, knee[1] + 0.004, knee[2] * 1.06], r: [sz * 0.9, 0, -sx * 0.9] });
      b.tube([base[0] * 1.2, base[1] + 0.012, base[2] * 1.2], [knee[0] * 0.9, knee[1] + 0.014, knee[2] * 0.9], 0.0035, 5, mat.yellow);
      for (const k of [-1, 1]) b.add(geo.cone(0.006, 0.022, 6), metal, { p: [foot[0] + k * sz * 0.008, 0.008, foot[2] + k * sx * 0.008], r: [Math.PI, 0, 0] });
    }
    b.add(geo.cone(0.01, 0.024, 8), metal, { p: [foot[0], 0.012, foot[2]], r: [Math.PI, 0, 0] });
  }
  // Sprengladung mit Warnring / explosive charge with a hazard ring
  b.add(geo.sphere(0.075, lite ? 10 : 16, lite ? 6 : 10), plate, { p: [0, y + 0.02, 0], s: [1, 0.85, 1.1] });
  b.add(geo.torus(0.075, 0.012, 4, lite ? 12 : 20), mat.yellow, { p: [0, y + 0.02, 0], r: [HALF_PI, 0, 0], s: [1, 1.1, 1] });
  if (!lite) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box(0.016, 0.026, 0.008, mat.ink, [Math.sin(a) * 0.08, y + 0.02, Math.cos(a) * 0.088], [0, a, 0]);
    }
    hexPanel(b, [0, y + 0.083, -0.01], 0.026, L.primary, [0, 0, 0]);
    addEmblem(b, f, 0.016, 0.004, L.emblem, { p: [0, y + 0.087, -0.01], r: [-HALF_PI, 0, 0] });
  }
  if (!lite && fine()) kamikazeDetail(b, L, y);
  // Sensorauge vorn / sensor eye at the front
  b.add(geo.rbox(0.05, 0.03, 0.03, 0.008), metal, { p: [0, y + 0.03, 0.075] });
  b.add(geo.sphere(0.012, 8, 4), glow, { p: [0, y + 0.03, 0.09] });
  // Zuender oben: rote Leuchte und Antenne / fuse on top: red light and antenna
  b.cyl(0.012, 0.014, 0.02, lite ? 6 : 8, metal, [0.02, y + 0.09, 0.02]);
  b.add(geo.ico(0.011, 0), mat.red, { p: [0.02, y + 0.105, 0.02] });
  if (!lite) antenna(b, -0.025, y + 0.08, -0.03, 0.09, glow);
  return b;
}
