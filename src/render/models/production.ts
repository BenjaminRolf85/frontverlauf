/**
 * Produktionsstaetten der Menschen (PRODUCTION): je ein Comic-Modell, auf einen Blick erkennbar.
 * Kaserne mit grosser Flagge, Ruestungswerk mit Munitionskisten, Fahrzeugwerk mit Garagentoren, Panzerwerk mit Schlot und
 * Erzlore, Geschuetzgiesserei mit Gluehofen und Rohr, Flugfeld mit Landeplatz, Trockendock mit Rumpf im Becken.
 * Human production sites (PRODUCTION): one comic model each, recognisable at a glance.
 * Barracks with a big flag, armoury with ammo crates, motor pool with garage doors, tank works with a chimney and an ore
 * cart, foundry with a glowing furnace and a gun barrel, airfield with a landing pad, dry dock with a hull in the basin.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { HALF_PI, band, barrel, chimney, crate, flagPole, gableRoof, sandbag } from './architecture';
import { addEmblem } from './emblems';
import { Builder, geo } from './kit';
import { look, mat } from './look';

/** Lange Baracke mit Satteldach und Fensterreihe / long barracks hut with a gable roof and a row of windows */
function barrack(b: Builder, f: FactionId | null, x: number, z: number, w: number, d: number, h: number, ry = 0) {
  const L = look(f);
  b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    b.block(0, 0, 0, w, h, d, L.wall);
    band(b, 0, h * 0.45, 0, w, d, h * 0.22, mat.window);
    for (let i = 0; i < 5; i++) b.box(0.006, h * 0.24, d + 0.012, L.wallDark, [-w / 2 + ((i + 0.5) / 5) * w, h * 0.56, 0]);
    gableRoof(b, 0, h, 0, d + 0.03, w + 0.03, 0.06, L.roof, HALF_PI);
    b.box(0.03, 0.05, 0.006, mat.darkMid, [0, 0.025, d / 2 + 0.004]);
  });
}

/** Kaserne: zwei Baracken, Exerzierplatz und ein hoher Fahnenmast / barracks: two huts, parade ground and a tall flag pole */
function trainingCamp(b: Builder, f: FactionId | null) {
  const L = look(f);
  b.block(0.06, 0, 0.12, 0.42, 0.01, 0.26, mat.concrete);
  for (let i = 0; i < 3; i++) b.block(-0.06 + i * 0.12, 0.01, 0.12, 0.05, 0.002, 0.2, mat.white);
  barrack(b, f, -0.08, -0.2, 0.42, 0.13, 0.1);
  barrack(b, f, -0.28, 0.08, 0.3, 0.11, 0.09, HALF_PI);
  // hoher Mast mit grosser Flagge: das Zeichen der Kaserne / tall pole with a big flag: the sign of the barracks
  flagPole(b, f, 0.3, 0, 0.0, 0.46, 1.3);
  b.cyl(0.04, 0.05, 0.02, 8, mat.concreteLight, [0.3, 0.01, 0.0]);
  for (let i = 0; i < 3; i++) sandbag(b, 0.12 + i * 0.09, 0, 0.3, 0);
  // Helmreihe am Appellplatz / row of helmets on the parade ground
  for (const x of [-0.04, 0.04, 0.12]) b.add(geo.hemi(0.018, 6, 2), L.helmet, { p: [x, 0.012, 0.04] });
}

/** Ruestungswerk: Fabrikhalle mit Munitionskisten und Rohrbuendeln / armoury: factory hall with ammo crates and barrel bundles */
function armory(b: Builder, f: FactionId | null) {
  const L = look(f);
  b.block(-0.06, 0, -0.1, 0.4, 0.15, 0.26, L.wallDark);
  band(b, -0.06, 0.08, -0.1, 0.4, 0.26, 0.025, mat.window);
  // Saegezahndach / sawtooth roof
  for (let i = 0; i < 3; i++) {
    const z0 = -0.23 + i * 0.087;
    b.add(geo.profileZY([[0, 0], [0.087, 0], [0.087, 0.05], [0.075, 0.05]], 0.4), L.roof, { p: [-0.06, 0.15, z0] });
  }
  // Tor mit Warnstreifen / gate with warning stripes
  b.block(-0.06, 0, 0.032, 0.14, 0.1, 0.006, mat.darkMid);
  for (let i = 0; i < 4; i++) b.box(0.035, 0.012, 0.004, i % 2 ? mat.yellow : mat.ink, [-0.11 + i * 0.035, 0.105, 0.037]);
  // Munitionskisten und Granatenstapel / ammo crates and shell stacks
  crate(b, 0.24, 0, 0.12, 0.07, L.primaryDark);
  crate(b, 0.24, 0.07, 0.12, 0.06, mat.green);
  crate(b, 0.16, 0, 0.2, 0.06, mat.green);
  for (let i = 0; i < 4; i++) {
    b.cyl(0.012, 0.012, 0.06, 6, mat.gold, [-0.22 + i * 0.03, 0.03, 0.2]);
    b.add(geo.cone(0.012, 0.025, 6), mat.metal, { p: [-0.22 + i * 0.03, 0.072, 0.2] });
  }
  // Rohrbuendel auf Boecken / barrel bundle on trestles
  for (const z of [0.27, 0.3]) b.tube([-0.12, 0.05, z], [0.1, 0.05, z], 0.012, 6, mat.gunmetal);
  for (const x of [-0.1, 0.08]) b.block(x, 0, 0.285, 0.02, 0.04, 0.08, mat.wood);
  flagPole(b, f, 0.3, 0, -0.26, 0.3, 0.8);
}

/** Fahrzeugwerk: Werkstatt mit drei Garagentoren und einem Jeep davor / motor pool: workshop with three garage doors and a jeep in front */
function motorPool(b: Builder, f: FactionId | null) {
  const L = look(f);
  b.block(0, 0, -0.14, 0.56, 0.15, 0.22, L.wall);
  b.block(0, 0.15, -0.14, 0.58, 0.02, 0.24, L.roof);
  for (let i = 0; i < 3; i++) {
    const x = -0.18 + i * 0.18;
    // Rolltor mit Lamellen / roller door with slats
    b.block(x, 0, -0.027, 0.13, 0.11, 0.006, mat.metal);
    for (let k = 0; k < 5; k++) b.box(0.13, 0.004, 0.004, mat.darkMid, [x, 0.012 + k * 0.022, -0.022]);
    b.box(0.14, 0.012, 0.012, L.primary, [x, 0.118, -0.02]);
  }
  // Jeep vor dem Tor / jeep in front of the door
  b.group({ p: [0.0, 0, 0.12] }, () => {
    b.block(0, 0.02, 0, 0.08, 0.04, 0.14, L.hull);
    b.block(0, 0.06, -0.02, 0.075, 0.025, 0.05, L.hullDark);
    b.box(0.07, 0.03, 0.004, mat.glass, [0, 0.075, 0.012], [-0.4, 0, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.02, 0.02, 0.016, 8, mat.dark, [sx * 0.045, 0.02, sz * 0.045], [0, 0, HALF_PI]);
  });
  // Zapfsaeule und Fass / fuel pump and barrel
  b.block(0.26, 0, 0.1, 0.04, 0.08, 0.03, mat.red);
  b.block(0.26, 0.08, 0.1, 0.045, 0.012, 0.035, mat.white);
  barrel(b, 0.3, 0, 0.2, L.primary);
  barrel(b, -0.28, 0, 0.16, mat.metal);
  // Werkzeugwand mit Reifenstapel / tool wall with a tyre stack
  for (let i = 0; i < 3; i++) b.cyl(0.03, 0.03, 0.016, 10, mat.dark, [-0.2, 0.008 + i * 0.016, 0.22]);
  flagPole(b, f, 0.34, 0, -0.3, 0.3, 0.7);
}

/** Panzerwerk: dunkle Halle, hoher Schlot, Gleis mit Erzlore und ein Panzerrumpf / tank works: dark hall, tall chimney, track with ore cart and a tank hull */
function tankWorks(b: Builder, f: FactionId | null) {
  const L = look(f);
  b.block(-0.06, 0, -0.12, 0.44, 0.18, 0.28, mat.concreteDark);
  band(b, -0.06, 0.12, -0.12, 0.44, 0.28, 0.025, mat.windowLit);
  b.block(-0.06, 0.18, -0.12, 0.46, 0.02, 0.3, L.roofDark);
  b.block(-0.06, 0, 0.022, 0.2, 0.14, 0.006, mat.darkMid);
  // hoher Schlot mit Rauch / tall chimney with smoke
  chimney(b, 0.28, 0, -0.24, 0.5, 0.035, mat.concreteLight);
  chimney(b, -0.3, 0.2, -0.22, 0.16, 0.022, mat.concrete, false);
  // Gleis mit Erzlore / track with ore cart
  b.tube([0.2, 0.006, 0.32], [0.2, 0.006, -0.02], 0.004, 4, mat.metal);
  b.tube([0.24, 0.006, 0.32], [0.24, 0.006, -0.02], 0.004, 4, mat.metal);
  for (let i = 0; i < 6; i++) b.block(0.22, 0, 0.3 - i * 0.06, 0.06, 0.006, 0.012, mat.wood);
  b.block(0.22, 0.012, 0.2, 0.07, 0.045, 0.09, L.secondary);
  for (const [dx, dz] of [[-0.015, -0.02], [0.015, 0.01], [0, 0.03]]) b.add(geo.ico(0.022, 0), mat.rust, { p: [0.22 + dx, 0.065, 0.2 + dz] });
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.cyl(0.012, 0.012, 0.01, 6, mat.dark, [0.22 + sx * 0.038, 0.012, 0.2 + sz * 0.03], [0, 0, HALF_PI]);
  // Panzerrumpf vor dem Tor / tank hull in front of the gate
  b.group({ p: [-0.1, 0, 0.18] }, () => {
    b.block(0, 0.012, 0, 0.13, 0.04, 0.17, L.hull);
    for (const s of [-1, 1]) b.block(s * 0.07, 0, 0, 0.03, 0.04, 0.18, mat.dark);
    b.cyl(0.042, 0.048, 0.03, 8, L.hullDark, [0, 0.067, -0.01]);
    b.tube([0, 0.072, 0.0], [0, 0.072, 0.14], 0.01, 6, mat.gunmetal);
  });
  if (f) addEmblem(b, f, 0.035, 0.008, L.emblem, { p: [-0.06, 0.1, 0.03] });
  flagPole(b, f, -0.34, 0, 0.3, 0.28, 0.7);
}

/** Geschuetzgiesserei: Kuppelofen mit Glut, Giesshalle, ein frisch gegossenes Rohr und Holzstapel / foundry: dome furnace with embers, casting hall, a freshly cast barrel and a log pile */
function foundry(b: Builder, f: FactionId | null) {
  const L = look(f);
  b.block(0.1, 0, -0.14, 0.32, 0.14, 0.22, L.wallDark);
  gableRoof(b, 0.1, 0.14, -0.14, 0.34, 0.24, 0.07, L.roof);
  // Kuppelofen mit gluehender Oeffnung / dome furnace with a glowing mouth
  b.cyl(0.11, 0.12, 0.1, 10, mat.concreteDark, [-0.2, 0.05, -0.14]);
  b.add(geo.hemi(0.11, 10, 3), mat.concreteDark, { p: [-0.2, 0.1, -0.14] });
  b.block(-0.2, 0.02, -0.03, 0.06, 0.05, 0.01, mat.orange);
  b.add(geo.ico(0.02, 0), mat.yellow, { p: [-0.2, 0.04, -0.02] });
  chimney(b, -0.2, 0.18, -0.14, 0.24, 0.03, mat.concreteLight);
  // frisch gegossenes Geschuetzrohr auf Lafette / freshly cast gun barrel on a carriage
  b.group({ p: [0.06, 0, 0.17] }, () => {
    b.tube([-0.18, 0.06, 0], [0.16, 0.06, 0], 0.022, 8, mat.gunmetal, 0.014);
    b.cyl(0.03, 0.03, 0.03, 8, mat.gunmetal, [-0.19, 0.06, 0], [0, 0, HALF_PI]);
    for (const x of [-0.12, 0.08]) b.block(x, 0, 0, 0.03, 0.045, 0.07, L.primaryDark);
    for (const s of [-1, 1]) b.cyl(0.03, 0.03, 0.012, 10, mat.wood, [-0.02, 0.03, s * 0.05], [HALF_PI, 0, 0]);
  });
  // Holzstapel fuer Lafetten / log pile for gun carriages
  for (let i = 0; i < 3; i++) b.cyl(0.016, 0.016, 0.14, 6, mat.wood, [0.3, 0.016 + i * 0.024, -0.02 + (i % 2) * 0.016], [HALF_PI, 0, 0]);
  flagPole(b, f, -0.34, 0, 0.26, 0.26, 0.7);
}

/** Flugfeld: Landeplatz mit H, Windsack, Kontrollturm und Halbtonnen-Hangar / airfield: landing pad with an H, windsock, control tower and a Quonset hangar */
function airfield(b: Builder, f: FactionId | null) {
  const L = look(f);
  b.block(0.06, 0, 0.08, 0.4, 0.012, 0.4, mat.asphalt);
  b.cyl(0.15, 0.15, 0.004, 16, mat.yellow, [0.06, 0.013, 0.08]);
  b.cyl(0.135, 0.135, 0.005, 16, mat.asphalt, [0.06, 0.014, 0.08]);
  // grosses H / big H
  for (const s of [-1, 1]) b.block(0.06 + s * 0.05, 0.016, 0.08, 0.025, 0.003, 0.15, mat.white);
  b.block(0.06, 0.016, 0.08, 0.1, 0.003, 0.025, mat.white);
  // Halbtonnen-Hangar / Quonset hangar
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10, 1, false, 0, Math.PI), L.wallDark, { p: [-0.26, 0, -0.1], r: [0, 0, HALF_PI] });
  b.block(-0.14, 0, -0.1, 0.006, 0.08, 0.14, mat.darkMid);
  // Kontrollturm / control tower
  b.group({ p: [0.3, 0, -0.28] }, () => {
    b.block(0, 0, 0, 0.06, 0.2, 0.06, L.wall);
    b.block(0, 0.2, 0, 0.1, 0.05, 0.1, mat.glass);
    b.block(0, 0.25, 0, 0.11, 0.012, 0.11, L.roof);
  });
  // Windsack / windsock
  b.cyl(0.004, 0.005, 0.18, 4, mat.metalLight, [-0.3, 0.09, 0.3]);
  b.add(geo.cone(0.02, 0.08, 6), mat.orange, { p: [-0.26, 0.17, 0.3], r: [0, 0, -HALF_PI] });
  b.box(0.012, 0.03, 0.03, mat.white, [-0.25, 0.17, 0.3]);
  flagPole(b, f, -0.06, 0, -0.32, 0.26, 0.6);
}

/** Trockendock: Betonbecken im Wasser mit Rumpf auf Pallen und Portalkran / dry dock: concrete basin in the water with a hull on blocks and a gantry crane */
function dryDock(b: Builder, f: FactionId | null) {
  const L = look(f);
  // Beckenwaende / basin walls
  for (const s of [-1, 1]) b.block(s * 0.17, -0.03, 0.02, 0.06, 0.08, 0.56, mat.concreteLight);
  b.block(0, -0.03, -0.27, 0.4, 0.08, 0.06, mat.concreteLight);
  b.block(0, -0.04, 0.02, 0.28, 0.01, 0.5, mat.concreteDark);
  // Rumpf auf Pallen / hull on keel blocks
  for (const z of [-0.12, 0.02, 0.16]) b.block(0, -0.03, z, 0.05, 0.03, 0.03, mat.wood);
  b.add(geo.prismXZ([[-0.07, -0.2], [0.07, -0.2], [0.075, 0.12], [0, 0.24], [-0.075, 0.12]], 0.07), L.hullDark, { p: [0, 0.0, 0] });
  b.block(0, 0.07, -0.04, 0.09, 0.05, 0.12, L.hull);
  // Portalkran ueber dem Becken / gantry crane over the basin
  for (const s of [-1, 1]) b.block(s * 0.17, 0.05, 0.08, 0.02, 0.24, 0.02, mat.yellow);
  b.block(0, 0.29, 0.08, 0.38, 0.03, 0.03, mat.yellow);
  b.block(0.04, 0.25, 0.08, 0.05, 0.04, 0.05, L.primary);
  b.tube([0.04, 0.25, 0.08], [0.04, 0.13, 0.08], 0.003, 3, mat.dark);
  flagPole(b, f, -0.17, 0.05, -0.27, 0.24, 0.6);
}

/** Modell einer Produktionsstaette (ohne Marinestuetzpunkt, der hat sein eigenes) / model of a production site (except the naval base, which has its own) */
export function productionSite(b: Builder, kind: 'trainingCamp' | 'armory' | 'motorPool' | 'tankWorks' | 'foundry' | 'airfield' | 'dryDock', f: FactionId | null) {
  switch (kind) {
    case 'trainingCamp': trainingCamp(b, f); break;
    case 'armory': armory(b, f); break;
    case 'motorPool': motorPool(b, f); break;
    case 'tankWorks': tankWorks(b, f); break;
    case 'foundry': foundry(b, f); break;
    case 'airfield': airfield(b, f); break;
    case 'dryDock': dryDock(b, f); break;
  }
}
