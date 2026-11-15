/**
 * Ressourcengebaeude der Fraktionen (je eins, siehe RESOURCE in balance.ts), im Comicstil aus den Bausatz-Teilen.
 * Faction resource buildings (one each, see RESOURCE in balance.ts), comic style from the kit parts.
 * - Korvat: Traktorstation (rote Scheune, Werkstatt, Traktoren, rote Banner) / tractor station (red barn, workshop, tractors, red banners)
 * - Dravon: Tiefbauzeche (Foerderturm mit Seilscheiben, Foerderband, Erzloren, Oliv und Gold) / deep mine (headframe with sheaves, conveyor, ore carts, olive and gold)
 * - Alvenia: Huegelweingut (Rebzeilen, Villa, Zypressen, Faesser, blaue Fahne) / hill vineyard (vine rows, villa, cypresses, barrels, blue flag)
 * - Meridon: Handelshafen (Hafenkran, Lagerhaeuser, Container, Goldmuenzen) / trade harbour (harbour crane, warehouses, containers, gold coins)
 * - Velkar: Polarstation (Kuppeln, Antennenmast, Schnee, Schneemobil) / polar station (domes, antenna mast, snow, snowmobile)
 * - Zyrr: Wrackschmelze (fremder Schmelzofen ueber einem Panzerwrack, violettes Leuchten) / wreck smelter (alien furnace over a tank wreck, violet glow)
 * - Vesper: Pilgerstaette (Zelte, Glockengalgen, Feuer, Pilger) / pilgrimage site (tents, bell gallows, fires, pilgrims)
 * - NEXUS: Depotknoten (automatisches Depot, Cyan-Lichter, Drohnen, Greifarm) / depot node (automated depot, cyan lights, drones, gripper arm)
 * Ursprung unten mittig, Grundflaeche innerhalb der Kachel / origin bottom centre, footprint inside the tile.
 */
import type { FactionId } from '../../data/balance';
import { HALF_PI, barrel, container, crate, flagPole, house } from './architecture';
import { hall, tractor } from './buildings';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng, shade, type ColorLike } from './kit';
import { look, mat } from './look';
import { crystal, tendril, zyrrSpire } from './xeno';
import { monasteryVineyard } from './alveniaFaith';

/** Stapel Goldmuenzen / stack of gold coins */
function coins(b: Builder, x: number, y: number, z: number, n: number) {
  for (let i = 0; i < n; i++) b.cyl(0.022, 0.022, 0.008, 10, i % 2 ? mat.gold : shade(mat.gold, 0.85), [x + (i % 2) * 0.002, y + 0.004 + i * 0.009, z]);
}

/** Lagerfeuer mit Steinring / campfire with stone ring */
function fire(b: Builder, x: number, z: number, s = 1) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(geo.dodeca(0.014 * s), mat.concreteDark, { p: [x + Math.sin(a) * 0.035 * s, 0.008 * s, z + Math.cos(a) * 0.035 * s] });
  }
  for (const a of [0.3, 1.9, 3.6]) b.tube([x + Math.sin(a) * 0.03 * s, 0.004, z + Math.cos(a) * 0.03 * s], [x - Math.sin(a) * 0.012 * s, 0.03 * s, z - Math.cos(a) * 0.012 * s], 0.006 * s, 4, mat.wood);
  b.add(geo.cone(0.032 * s, 0.08 * s, 7), mat.ember, { p: [x, 0.045 * s, z] });
  b.add(geo.cone(0.016 * s, 0.05 * s, 6), mat.yellow, { p: [x, 0.035 * s, z] });
}

/** Erzlore auf Schienen / ore cart on rails */
function oreCart(b: Builder, x: number, z: number, ry: number, c: ColorLike) {
  b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    b.add(geo.taper(0.05, 0.07, 0.07, 0.09, 0.045), c, { p: [0, 0.04, 0] });
    b.box(0.072, 0.006, 0.092, shade(c, 0.7), [0, 0.06, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.012, 0.012, 0.008, 8, mat.dark, [sx * 0.03, 0.013, sz * 0.03], [0, 0, HALF_PI]);
    b.add(geo.dodeca(0.026), mat.gold, { p: [0.008, 0.07, -0.01] });
    b.add(geo.dodeca(0.02), mat.concreteDark, { p: [-0.015, 0.068, 0.018] });
  });
}

// ---------- Korvat: Traktorstation / tractor station ----------

export function tractorStation(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'korvat');
  const red = f ? L.primary : mat.red;
  // Hof aus gestampfter Erde, Ackerstreifen hinten rechts / yard of packed earth, field strips back right
  b.block(0, 0, 0, 0.7, 0.01, 0.66, shade(mat.wood, 1.25));
  for (let i = 0; i < 4; i++) b.block(0.2, 0.01, -0.28 + i * 0.05, 0.26, 0.022, 0.026, i % 2 ? mat.yellow : mat.green);
  // grosse rote Scheune mit Rundbogendach / big red barn with rounded roof
  b.group({ p: [-0.13, 0, -0.14] }, () => {
    b.block(0, 0, 0, 0.3, 0.16, 0.22, red);
    b.add(geo.cyl(0.155, 0.155, 0.24, 12, false), shade(L.roofDark, 1.1), { p: [0, 0.16, 0], r: [HALF_PI, 0, 0], s: [1, 1, 0.55] });
    b.block(0, 0, 0.112, 0.12, 0.12, 0.006, mat.white);
    b.block(0, 0, 0.115, 0.1, 0.11, 0.006, shade(red, 0.75));
    b.box(0.14, 0.008, 0.006, mat.white, [0, 0.06, 0.119], [0, 0, 0.73]);
    b.box(0.14, 0.008, 0.006, mat.white, [0, 0.06, 0.119], [0, 0, -0.73]);
    b.block(0, 0.17, 0.12, 0.05, 0.04, 0.006, mat.white);
    b.block(0, 0.175, 0.124, 0.03, 0.03, 0.004, mat.window);
    // Banner mit Emblem ueber dem Tor / banner with emblem above the gate
    b.block(0, 0.125, 0.12, 0.2, 0.03, 0.006, mat.white);
    if (f) addEmblem(b, f, 0.012, 0.006, red, { p: [0, 0.14, 0.126] });
  });
  // Werkstatthalle mit offener Front / workshop hall with open front
  hall(b, f, 0.2, 0.06, 0.18, 0.16, 0.11, -HALF_PI);
  // Dieseltank auf Boecken / diesel tank on trestles
  b.cyl(0.035, 0.035, 0.14, 10, mat.concreteLight, [0.26, 0.07, 0.27], [0, 0, HALF_PI]);
  b.cyl(0.036, 0.036, 0.012, 10, red, [0.26, 0.07, 0.27], [0, 0, HALF_PI]);
  for (const s of [-1, 1]) b.block(0.26 + s * 0.05, 0, 0.27, 0.01, 0.04, 0.06, mat.dark);
  // drei Traktoren in Reihe / three tractors in a row
  tractor(b, f, -0.22, 0.17, 0.1);
  tractor(b, f, -0.08, 0.2, -0.15);
  tractor(b, f, 0.07, 0.24, -0.5);
  // Pflug am letzten Traktor / plough behind the last tractor
  b.group({ p: [0.12, 0, 0.32], r: [0, -0.5, 0] }, () => {
    b.box(0.08, 0.01, 0.012, mat.metal, [0, 0.02, 0]);
    for (const x of [-0.03, 0, 0.03]) b.add(geo.taper(0.012, 0.03, 0.004, 0.008, 0.03), mat.metalLight, { p: [x, 0.012, 0.01], r: [0.4, 0, 0] });
  });
  // rote Banner an Masten / red banners on poles
  for (const [x, z] of [[-0.32, 0.31], [0.33, -0.05]] as [number, number][]) {
    b.tube([x, 0, z], [x, 0.34, z], 0.006, 5, mat.wood);
    b.box(0.006, 0.14, 0.07, red, [x, 0.26, z + 0.036]);
    b.add(geo.profileZY([[0, 0], [0.035, -0.03], [0.07, 0]], 0.006), red, { p: [x, 0.19, z + 0.001] });
    if (f) addEmblem(b, f, 0.014, 0.008, L.emblem, { p: [x, 0.28, z + 0.036], r: [0, HALF_PI, 0] });
  }
  // Heuballen / hay bales
  for (const [x, z] of [[-0.3, -0.3], [-0.24, -0.31]] as [number, number][]) b.cyl(0.028, 0.028, 0.045, 10, mat.yellow, [x, 0.028, z], [0, 0, HALF_PI]);
  flagPole(b, f, 0.33, 0.01, -0.31, 0.3, 0.7);
}

// ---------- Dravon: Tiefbauzeche / deep mine ----------

export function deepMine(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'dravon');
  const steel = f ? L.primaryDark : mat.metal;
  const gold = f ? L.secondary : mat.gold;
  // befestigte Plattform / paved platform
  b.add(geo.cbox(0.66, 0.03, 0.6, 0.04), mat.concreteDark, { p: [0, 0.015, 0] });
  // Foerderturm (Strebengeruest) mit zwei Seilscheiben / headframe (strut frame) with two sheaves
  b.group({ p: [-0.12, 0.03, -0.1] }, () => {
    const h = 0.48;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([sx * 0.08, 0, sz * 0.07], [sx * 0.035, h, sz * 0.035], 0.01, 4, steel);
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * h, w = 0.08 - (i / 4) * 0.045, d = 0.07 - (i / 4) * 0.035;
      for (const s of [-1, 1]) {
        b.box(w * 2, 0.008, 0.008, steel, [0, y, s * d]);
        b.box(0.008, 0.008, d * 2, steel, [s * w, y, 0]);
      }
    }
    // Schraegstrebe zum Maschinenhaus / back strut to the winding house
    b.tube([0, h, 0.03], [0.22, 0.04, 0.2], 0.009, 4, steel);
    b.block(0, h, 0, 0.1, 0.03, 0.1, gold);
    for (const s of [-1, 1]) {
      b.add(geo.torus(0.06, 0.01, 4, 16), gold, { p: [s * 0.03, h + 0.07, 0], r: [0, HALF_PI, 0] });
      b.box(0.008, 0.1, 0.008, mat.dark, [s * 0.03, h + 0.07, 0]);
      b.box(0.008, 0.008, 0.1, mat.dark, [s * 0.03, h + 0.07, 0]);
    }
    b.cyl(0.008, 0.008, 0.08, 6, mat.metalLight, [0, h + 0.07, 0], [0, 0, HALF_PI]);
    // Foerderkorb im Schacht / cage in the shaft
    b.block(0, 0.02, 0, 0.06, 0.08, 0.06, mat.metalLight);
    b.tube([0, 0.1, 0], [0, h + 0.02, 0], 0.002, 3, mat.dark);
    // Warnlampe / warning lamp
    b.add(geo.ico(0.014, 0), mat.red, { p: [0, h + 0.135, 0] });
  });
  // Maschinenhaus mit Goldband / winding house with gold band
  b.group({ p: [0.16, 0.03, 0.12] }, () => {
    b.block(0, 0, 0, 0.2, 0.13, 0.16, L.wallDark);
    b.block(0, 0.08, 0, 0.206, 0.018, 0.166, gold);
    b.add(geo.cone(0.13, 0.08, 4).rotateY(Math.PI / 4), L.roof, { p: [0, 0.17, 0], s: [1, 1, 0.8] });
    for (const x of [-0.05, 0.05]) b.block(x, 0.035, 0.082, 0.035, 0.035, 0.006, mat.windowLit);
    b.block(0, 0, 0.082, 0.04, 0.06, 0.006, mat.dark);
    if (f) addEmblem(b, f, 0.018, 0.006, gold, { p: [0.06, 0.105, 0.085] });
  });
  // Foerderband zum Erzbunker / conveyor to the ore bunker
  b.group({ p: [0.08, 0.03, -0.17], r: [0, 0, 0.42] }, () => {
    b.box(0.3, 0.012, 0.05, mat.dark, [0, 0, 0]);
    b.box(0.3, 0.006, 0.04, mat.concreteLight, [0, 0.009, 0]);
    for (let i = 0; i < 5; i++) b.add(geo.dodeca(0.012), i % 2 ? mat.gold : mat.concreteDark, { p: [-0.12 + i * 0.06, 0.022, 0] });
    for (const x of [-0.1, 0.05]) b.box(0.008, 0.12, 0.008, steel, [x, -0.06, 0.022]);
  });
  // Erzbunker / ore bunker
  b.group({ p: [0.26, 0.03, -0.24] }, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(sx * 0.04, 0, sz * 0.035, 0.012, 0.1, 0.012, steel);
    b.add(geo.cyl(0.07, 0.03, 0.08, 4), gold, { p: [0, 0.14, 0], r: [0, Math.PI / 4, 0] });
    b.add(geo.cone(0.05, 0.03, 6), mat.concreteDark, { p: [0, 0.195, 0] });
  });
  // Schienen mit drei Erzloren / rails with three ore carts
  for (const s of [-1, 1]) b.tube([-0.33, 0.035, 0.24 + s * 0.016], [0.06, 0.035, 0.24 + s * 0.016], 0.004, 4, mat.metal);
  for (let i = 0; i < 8; i++) b.block(-0.31 + i * 0.05, 0.03, 0.24, 0.012, 0.006, 0.05, mat.wood);
  oreCart(b, -0.25, 0.24, HALF_PI, steel);
  oreCart(b, -0.15, 0.24, HALF_PI, shade(steel, 1.2));
  oreCart(b, -0.05, 0.24, HALF_PI, steel);
  // Abraumhalde und Goldhaufen / spoil heap and gold heap
  b.add(geo.cone(0.09, 0.09, 7), mat.rockDark, { p: [-0.28, 0.075, 0.08] });
  b.add(geo.cone(0.05, 0.05, 6), gold, { p: [0.0, 0.055, 0.32] });
  for (let i = 0; i < 3; i++) b.add(geo.ico(0.014, 0), mat.yellow, { p: [0.02 + i * 0.02, 0.04, 0.29 + (i % 2) * 0.02] });
  flagPole(b, f, -0.33, 0.03, -0.3, 0.28, 0.7);
}

// ---------- Alvenia: Huegelweingut / hill vineyard ----------

export function hillVineyard(b: Builder, f: FactionId | null) {
  // Heiliges Alvenia: Klosterweingut (ID hillVineyard) / Holy Alvenia: monastery vineyard (ID hillVineyard)
  if (f === null || f === 'alvenia') { monasteryVineyard(b); return; }
  const L = look(f);
  const grape = mix(mat.blue, mat.red, 0.45);
  // zwei Hangterrassen / two slope terraces
  b.add(geo.cbox(0.7, 0.03, 0.34, 0.03), shade(mat.grass, 0.95), { p: [0, 0.015, 0.16] });
  b.add(geo.cbox(0.7, 0.06, 0.34, 0.03), shade(mat.grass, 0.85), { p: [0, 0.03, -0.16] });
  b.block(0, 0.03, 0.0, 0.7, 0.03, 0.012, mat.concreteLight);
  // Rebzeilen: Pfaehle, Draht, Laub, Trauben / vine rows: posts, wire, leaves, grapes
  const R = rng(23);
  for (let row = 0; row < 4; row++) {
    const z = 0.06 + row * 0.075;
    const x0 = -0.32, x1 = 0.05;
    for (let i = 0; i < 4; i++) b.cyl(0.004, 0.004, 0.08, 4, mat.wood, [x0 + (i / 3) * (x1 - x0), 0.07, z]);
    b.tube([x0, 0.1, z], [x1, 0.1, z], 0.002, 3, mat.metal);
    for (let i = 0; i < 5; i++) {
      const x = x0 + 0.04 + i * 0.07;
      b.add(geo.dodeca(0.024 + R() * 0.006), i % 2 ? mat.leaf : mat.green, { p: [x, 0.09, z], s: [1.3, 0.9, 0.8] });
      b.add(geo.sphere(0.011, 6, 4), grape, { p: [x + 0.01, 0.065, z + 0.016], s: [1, 1.4, 1] });
    }
  }
  // Villa mit blauem Dach und Turm / villa with blue roof and tower
  b.group({ p: [0.15, 0.06, -0.17] }, () => {
    house(b, 'alvenia', 0, 0, 0.24, 0.16, 0.12, { seed: 9 });
    b.group({ p: [-0.15, 0, 0.02] }, () => house(b, 'alvenia', 0, 0, 0.07, 0.07, 0.18, { landmark: true }));
    // Laubengang vor dem Haus / pergola in front of the house
    for (const x of [-0.08, 0.0, 0.08]) b.cyl(0.004, 0.004, 0.07, 4, mat.white, [x, 0.035, 0.12]);
    b.box(0.2, 0.006, 0.05, mat.wood, [0, 0.072, 0.1]);
    b.add(geo.dodeca(0.03), mat.leaf, { p: [-0.05, 0.08, 0.1], s: [1.6, 0.5, 1] });
  });
  // Zypressen / cypresses
  for (const [x, z, h] of [[-0.3, -0.24, 0.24], [-0.22, -0.28, 0.2], [0.32, 0.05, 0.22]] as [number, number, number][]) {
    const y = z < 0 ? 0.06 : 0.03;
    b.cyl(0.008, 0.01, 0.03, 5, mat.wood, [x, y + 0.015, z]);
    b.add(geo.cone(0.03, h, 7), mat.leafDark, { p: [x, y + 0.03 + h / 2, z] });
  }
  // Weinfaesser liegend / wine barrels lying down
  for (const [x, z] of [[0.18, 0.12], [0.26, 0.14], [0.22, 0.2]] as [number, number][]) {
    b.cyl(0.03, 0.03, 0.055, 10, mat.wood, [x, 0.06, z], [HALF_PI, 0, 0.5]);
    for (const s of [-1, 1]) b.add(geo.torus(0.03, 0.003, 3, 10), mat.dark, { p: [x + s * 0.01, 0.06, z + s * 0.017], r: [0, 0.5, 0] });
  }
  // Weingut-Schild in Fraktionsfarbe / estate sign in faction colour
  for (const s of [-1, 1]) b.cyl(0.004, 0.004, 0.08, 4, mat.wood, [-0.06 + s * 0.04, 0.07, 0.33]);
  b.block(-0.06, 0.08, 0.33, 0.1, 0.035, 0.006, L.primary);
  if (f) addEmblem(b, f, 0.012, 0.006, L.emblem, { p: [-0.06, 0.0975, 0.334] });
  // Traubenkorb / grape basket
  b.cyl(0.03, 0.022, 0.03, 10, mat.woodLight, [0.08, 0.045, 0.3]);
  for (let i = 0; i < 4; i++) b.add(geo.sphere(0.012, 6, 4), grape, { p: [0.07 + (i % 2) * 0.02, 0.064, 0.29 + (i >> 1) * 0.018] });
  flagPole(b, f, 0.33, 0.06, -0.3, 0.3, 0.75);
}

// ---------- Meridon: Handelshafen / trade harbour ----------

export function tradeHarbour(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'meridon');
  // Kaimauer auf Pfaehlen / quay on piles
  b.block(0, 0.02, -0.1, 0.7, 0.025, 0.42, mat.concreteLight);
  for (let i = 0; i < 6; i++) b.cyl(0.014, 0.014, 0.05, 6, mat.concreteDark, [-0.3 + i * 0.12, 0.0, 0.1]);
  b.block(0, 0.045, 0.1, 0.7, 0.006, 0.014, mat.yellow);
  for (const x of [-0.25, 0.0, 0.25]) b.cyl(0.012, 0.016, 0.02, 6, mat.dark, [x, 0.056, 0.09]);
  // zwei Lagerhaeuser / two warehouses
  b.group({ p: [0, 0.045, 0] }, () => {
    hall(b, f, -0.18, -0.2, 0.28, 0.16, 0.12, 0, L.wall);
    hall(b, f, 0.18, -0.24, 0.2, 0.14, 0.1, 0, mix(L.wall, L.primary, 0.3));
  });
  // Portalkran mit Ausleger ueber dem Wasser / gantry crane with boom over the water
  b.group({ p: [0.12, 0.045, -0.02] }, () => {
    const h = 0.36;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([sx * 0.05, 0, sz * 0.04], [sx * 0.04, h, sz * 0.03], 0.008, 4, L.secondary);
    for (const s of [-1, 1]) b.box(0.1, 0.008, 0.008, L.secondary, [0, h * 0.5, s * 0.035]);
    b.block(0, h, 0, 0.12, 0.05, 0.08, L.secondary);
    b.block(0.03, h + 0.01, 0.042, 0.04, 0.03, 0.004, mat.window);
    b.box(0.016, 0.016, 0.42, mat.dark, [0, h + 0.05, 0.12], [-0.12, 0, 0]);
    b.box(0.016, 0.016, 0.12, mat.dark, [0, h + 0.03, -0.1]);
    b.block(0, h + 0.005, -0.15, 0.06, 0.05, 0.05, mat.concreteDark);
    b.tube([0, h + 0.03, 0.3], [0, 0.12, 0.3], 0.002, 3, mat.dark);
  });
  // haengender Container und Stapel / hanging container and stacks
  container(b, 0.12, 0.06, 0.3, L.primary, HALF_PI, 0.12);
  container(b, -0.24, 0.045, 0.02, L.secondary, 0, 0.16);
  container(b, -0.24, 0.105, 0.02, L.primary, 0, 0.16);
  container(b, -0.06, 0.045, 0.04, mat.red, 0, 0.14);
  // Goldmuenzen und Geldsaecke auf der Kaimauer / gold coins and money bags on the quay
  coins(b, 0.3, 0.045, 0.05, 6);
  coins(b, 0.27, 0.045, 0.0, 4);
  coins(b, 0.33, 0.045, 0.0, 3);
  b.add(geo.sphere(0.03, 8, 6), mat.sand, { p: [0.32, 0.07, -0.06], s: [1, 1.1, 1] });
  b.cyl(0.012, 0.016, 0.014, 6, mat.sand, [0.32, 0.105, -0.06]);
  crate(b, 0.03, 0.045, -0.06, 0.045, mat.woodLight);
  barrel(b, -0.08, 0.045, -0.06, L.secondary);
  // Frachtschiff am Kai / freighter at the quay
  b.group({ p: [-0.12, 0, 0.27] }, () => {
    b.add(geo.prismXZ([[-0.24, -0.05], [0.18, -0.05], [0.26, 0], [0.18, 0.05], [-0.24, 0.05]], 0.05), L.primaryDark, { p: [0, -0.015, 0] });
    b.block(-0.02, 0.035, 0, 0.42, 0.006, 0.09, mat.white);
    b.block(-0.18, 0.035, 0, 0.06, 0.06, 0.07, mat.white);
    b.block(-0.18, 0.07, 0.036, 0.05, 0.012, 0.004, mat.window);
    b.cyl(0.012, 0.014, 0.05, 6, L.secondary, [-0.18, 0.12, 0]);
    container(b, -0.06, 0.04, 0, mat.red, 0, 0.1);
    container(b, 0.06, 0.04, 0, L.secondary, 0, 0.1);
  });
  if (f) addEmblem(b, f, 0.022, 0.006, L.emblem, { p: [-0.18, 0.13, -0.11] });
  flagPole(b, f, 0.33, 0.045, -0.3, 0.28, 0.7);
}

// ---------- Velkar: Polarstation / polar station ----------

export function polarStation(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'velkar');
  const glow = f ? L.secondary : mat.teal;
  const shell = mix(mat.white, f ? L.primary : mat.blue, 0.5);
  // Schneedecke mit Verwehungen / snow cover with drifts
  b.add(geo.hemi(0.36, 18, 3), mat.snow, { s: [1, 0.06, 0.92] });
  for (const [x, z, r] of [[-0.28, 0.22, 0.07], [0.3, 0.2, 0.06], [0.28, -0.28, 0.05]] as [number, number, number][]) b.add(geo.hemi(r, 8, 3), mat.snow, { p: [x, 0.0, z], s: [1.6, 0.5, 1] });
  // drei Kuppeln mit Verbindungsroehren / three domes with connecting tubes
  const domes: [number, number, number][] = [[-0.1, -0.06, 0.15], [0.16, -0.08, 0.1], [-0.04, 0.19, 0.095]];
  for (const [x, z, r] of domes) {
    b.cyl(r, r, 0.03, 14, mat.concreteLight, [x, 0.03, z]);
    b.add(geo.ico(r, 1), shell, { p: [x, 0.045, z], s: [1, 0.8, 1] });
    b.add(geo.hemi(r * 0.98, 14, 3), mat.snow, { p: [x, 0.045 + r * 0.42, z], s: [0.7, 0.45, 0.7] });
    b.add(geo.torus(r, 0.006, 3, 14), glow, { p: [x, 0.048, z], r: [HALF_PI, 0, 0] });
    b.block(x, 0.02, z + r - 0.005, 0.035, 0.05, 0.03, L.primaryDark);
    b.block(x, 0.045, z + r + 0.012, 0.025, 0.012, 0.004, mat.windowLit);
  }
  b.tube([-0.1, 0.06, -0.06], [0.16, 0.06, -0.08], 0.025, 8, mat.concrete);
  b.tube([-0.1, 0.06, -0.06], [-0.04, 0.06, 0.19], 0.022, 8, mat.concrete);
  // Emblem auf der Stirnseite der Verbindungsroehre / emblem on the face of the connecting tube
  if (f) addEmblem(b, f, 0.02, 0.008, glow, { p: [0.05, 0.1, -0.05], r: [0, 0.2, 0] });
  // Antennenmast mit Abspannseilen und Leuchtfeuer / antenna mast with guy wires and beacon
  b.group({ p: [0.2, 0.02, -0.27] }, () => {
    const h = 0.5;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.tube([Math.sin(a) * 0.022, 0, Math.cos(a) * 0.022], [Math.sin(a) * 0.008, h, Math.cos(a) * 0.008], 0.005, 4, mat.metalLight);
      b.tube([0, h * 0.7, 0], [Math.sin(a + 0.5) * 0.12, 0, Math.cos(a + 0.5) * 0.12], 0.0015, 3, mat.dark);
    }
    for (let i = 1; i < 5; i++) b.add(geo.torus(0.022 - i * 0.003, 0.003, 3, 8), mat.red, { p: [0, i * 0.1, 0], r: [HALF_PI, 0, 0] });
    b.tube([-0.06, h * 0.82, 0], [0.06, h * 0.82, 0], 0.003, 3, mat.metal);
    b.tube([0, h * 0.82, -0.05], [0, h * 0.82, 0.05], 0.003, 3, mat.metal);
    b.add(geo.ico(0.016, 0), mat.red, { p: [0, h + 0.016, 0] });
    b.add(geo.ico(0.01, 0), glow, { p: [0, h * 0.6, 0.012] });
  });
  // Wetterhuette und Parabolschuessel auf Stelzen / weather hut and dish on stilts
  b.group({ p: [-0.27, 0, -0.18] }, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(sx * 0.03, 0, sz * 0.025, 0.008, 0.06, 0.008, mat.wood);
    b.block(0, 0.06, 0, 0.08, 0.05, 0.07, mat.white);
    for (let i = 0; i < 3; i++) b.block(0, 0.068 + i * 0.013, 0.036, 0.07, 0.004, 0.004, mat.concrete);
    b.block(0, 0.11, 0, 0.09, 0.012, 0.08, mat.snow);
    b.cyl(0.04, 0.015, 0.025, 10, mat.white, [0.03, 0.16, -0.01], [0.7, 0, 0.3]);
    b.cyl(0.004, 0.004, 0.05, 4, mat.metal, [0.02, 0.135, -0.01]);
  });
  // Schneemobil mit Kufen und Schlitten / snowmobile with skids and sled
  b.group({ p: [0.08, 0.02, 0.29], r: [0, -0.35, 0] }, () => {
    b.add(geo.rtaper(0.06, 0.12, 0.05, 0.08, 0.04, 0.01, -0.01), L.primary, { p: [0, 0.035, 0] });
    b.block(0, 0.05, -0.03, 0.05, 0.03, 0.04, mat.glassDark);
    for (const s of [-1, 1]) b.box(0.008, 0.006, 0.16, mat.dark, [s * 0.03, 0.006, 0.0]);
    b.block(0, 0, -0.08, 0.05, 0.02, 0.06, mat.dark);
    b.block(0, 0.006, -0.17, 0.07, 0.012, 0.09, mat.wood);
    crate(b, 0, 0.018, -0.17, 0.04, glow);
  });
  // Treibstofftanks / fuel tanks
  for (const [x, z] of [[0.29, 0.1], [0.31, 0.02]] as [number, number][]) {
    b.cyl(0.025, 0.025, 0.07, 8, mat.red, [x, 0.055, z]);
    b.add(geo.hemi(0.026, 8, 2), mat.snow, { p: [x, 0.09, z] });
  }
  flagPole(b, f, -0.3, 0.02, 0.1, 0.28, 0.7);
}

// ---------- Zyrr: Wrackschmelze / wreck smelter ----------

export function wreckSmelter(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'zyrr');
  const violet = f ? L.primary : mat.alienMetalLight;
  const glow = mat.xenoGlow;
  const R = rng(41);
  // verbrannter Boden mit Saeureflecken / scorched ground with acid puddles
  b.add(geo.cyl(0.36, 0.38, 0.012, 14), mix(mat.concreteDark, mat.xenoGroundDark, 0.5), { p: [0, 0.006, 0] });
  b.add(geo.cyl(0.14, 0.15, 0.006, 12), mat.acid, { p: [0.14, 0.014, 0.2], s: [1.3, 1, 0.8] });
  b.add(geo.torus(0.3, 0.008, 3, 24), mix(violet, mat.white, 0.25), { p: [0, 0.014, 0], r: [HALF_PI, 0, 0] });
  // rostiges Panzerwrack, halb zerlegt / rusty tank wreck, half dismantled
  b.group({ p: [-0.02, 0, 0.02], r: [0, 0.5, 0.06] }, () => {
    b.add(geo.rtaper(0.2, 0.32, 0.16, 0.26, 0.07, 0.015), mat.rust, { p: [0, 0.06, 0] });
    for (const s of [-1, 1]) b.add(geo.cbox(0.04, 0.05, 0.34, 0.01), mat.rustDark, { p: [s * 0.11, 0.035, 0] });
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) b.cyl(0.018, 0.018, 0.01, 8, mat.dark, [s * 0.134, 0.03, -0.12 + i * 0.08], [0, 0, HALF_PI]);
    // abgerissener Turm schief daneben / torn-off turret lying askew
    b.group({ p: [0.15, 0.04, -0.17], r: [0.3, 0.8, 0.5] }, () => {
      b.add(geo.cyl(0.06, 0.07, 0.04, 10), mat.rustDark, {});
      b.tube([0, 0, 0.04], [0, 0.01, 0.18], 0.01, 6, mat.rust);
    });
    // aufgeschnittene Platten / cut-open plates
    b.add(geo.cbox(0.1, 0.008, 0.08, 0.01), mat.rust, { p: [-0.05, 0.1, 0.08], r: [0.5, 0.2, 0.3] });
  });
  // dreibeiniger Schmelzofen ueber dem Wrack / three-legged furnace above the wreck
  b.group({ p: [0, 0, 0] }, () => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      tendril(b, [Math.sin(a) * 0.3, 0.0, Math.cos(a) * 0.3], [Math.sin(a) * 0.3, 0.3, Math.cos(a) * 0.3], [Math.sin(a) * 0.07, 0.38, Math.cos(a) * 0.07], 0.02, 0.012, 6, mat.alienMetal, null);
      b.add(geo.cone(0.035, 0.03, 6), mat.alienMetalLight, { p: [Math.sin(a) * 0.3, 0.015, Math.cos(a) * 0.3] });
    }
    // Ofenkessel mit Leuchtband / furnace crucible with glow band
    b.add(geo.sphere(0.09, 14, 8), violet, { p: [0, 0.4, 0], s: [1, 0.8, 1] });
    b.add(geo.torus(0.092, 0.01, 4, 16), glow, { p: [0, 0.4, 0], r: [HALF_PI, 0, 0] });
    b.add(geo.cyl(0.04, 0.06, 0.06, 12), mat.alienMetal, { p: [0, 0.33, 0] });
    b.add(geo.cone(0.05, 0.07, 10), glow, { p: [0, 0.27, 0], r: [Math.PI, 0, 0] });
    // Schmelzstrahl auf das Wrack / melting beam onto the wreck
    b.add(geo.cyl(0.018, 0.034, 0.16, 8), mix(glow, mat.white, 0.3), { p: [0, 0.16, 0] });
    b.add(geo.cyl(0.07, 0.08, 0.012, 12), mat.acid, { p: [0, 0.105, 0] });
    // Kristallemitter oben / crystal emitter on top
    b.add(geo.cone(0.035, 0.1, 6), glow, { p: [0, 0.51, 0] });
    b.add(geo.torus(0.07, 0.005, 3, 14), mat.acid, { p: [0, 0.48, 0], r: [HALF_PI - 0.3, 0, 0.2] });
  });
  // gegossene Barren und Kristalle / cast ingots and crystals
  for (let i = 0; i < 4; i++) b.add(geo.taper(0.07, 0.03, 0.05, 0.02, 0.022), i % 2 ? violet : mat.alienMetalLight, { p: [-0.22 + (i % 2) * 0.075, 0.023 + (i >> 1) * 0.022, -0.26], r: [0, 0.2, 0] });
  crystal(b, 0.28, -0.12, 0.12, 0.022, glow, [0.2, 0, -0.2]);
  crystal(b, 0.3, -0.05, 0.08, 0.016, mat.acid, [-0.2, 0, 0.3]);
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2;
    b.add(geo.ico(0.01, 0), i % 2 ? mat.acid : glow, { p: [Math.sin(a) * 0.12, 0.2 + R() * 0.15, Math.cos(a) * 0.12] });
  }
  if (f === 'zyrr' || f === null) zyrrSpire(b, -0.3, 0, 0.24, 0.24, 0.8);
  else flagPole(b, f, -0.3, 0, 0.24, 0.26, 0.7);
}

// ---------- Vesper: Pilgerstaette / pilgrimage site ----------

/** kleiner Pilger in Kutte mit Stab / small robed pilgrim with staff */
function pilgrim(b: Builder, x: number, z: number, ry: number, robe: ColorLike) {
  b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    b.add(geo.cone(0.03, 0.09, 7), robe, { p: [0, 0.045, 0] });
    b.add(geo.sphere(0.014, 6, 4), mat.bone, { p: [0, 0.098, 0] });
    b.add(geo.cone(0.018, 0.03, 6), robe, { p: [0, 0.112, -0.004] });
    b.tube([0.026, 0, 0.01], [0.03, 0.13, 0.012], 0.003, 3, mat.wood);
  });
}

export function pilgrimSite(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'vesper');
  const red = f ? L.primary : mat.red;
  const cloth = mix(mat.sand, mat.paper, 0.3);
  // staubiger Platz / dusty square
  b.add(geo.cyl(0.36, 0.38, 0.012, 14), shade(mat.sand, 0.92), { p: [0, 0.006, 0] });
  // Glockengalgen mit drei Glocken / bell gallows with three bells
  b.group({ p: [0, 0.012, -0.2] }, () => {
    for (const s of [-1, 1]) {
      b.tube([s * 0.17, 0, 0], [s * 0.15, 0.36, 0], 0.012, 6, mat.wood);
      b.tube([s * 0.17, 0, 0.06], [s * 0.15, 0.2, 0], 0.007, 4, mat.wood);
    }
    b.tube([-0.2, 0.36, 0], [0.2, 0.37, 0], 0.012, 6, mat.wood);
    for (const x of [-0.09, 0, 0.09]) {
      const big = x === 0 ? 1.25 : 1;
      // geschlossene Glocke: Kappe, Mantel, Schlagring, Kloeppel / closed bell: crown, body, sound bow, clapper
      b.tube([x, 0.365, 0], [x, 0.325, 0], 0.003, 3, mat.dark);
      b.add(geo.sphere(0.016 * big, 10, 5), mat.gold, { p: [x, 0.315, 0], s: [1, 0.7, 1] });
      b.add(geo.cyl(0.016 * big, 0.034 * big, 0.06 * big, 12), mat.gold, { p: [x, 0.315 - 0.03 * big, 0] });
      b.add(geo.torus(0.033 * big, 0.005 * big, 4, 12), shade(mat.gold, 0.75), { p: [x, 0.315 - 0.06 * big, 0], r: [HALF_PI, 0, 0] });
      b.add(geo.sphere(0.008, 6, 4), mat.dark, { p: [x, 0.315 - 0.07 * big, 0] });
    }
    if (f) addEmblem(b, f, 0.03, 0.01, mat.bone, { p: [0, 0.43, 0] });
  });
  // Pilgerzelte / pilgrim tents
  const tents: [number, number, number][] = [[-0.25, 0.08, 0.4], [0.24, 0.04, -0.3], [-0.12, 0.27, 1.2]];
  tents.forEach(([x, z, ry], i) => {
    b.group({ p: [x, 0.012, z], r: [0, ry, 0] }, () => {
      b.add(geo.cone(0.09, 0.13, 4).rotateY(Math.PI / 4), i === 1 ? red : cloth, { p: [0, 0.065, 0], s: [1, 1, 1.2] });
      b.add(geo.profileXY([[-0.025, 0], [0.025, 0], [0, 0.06]], 0.004), mat.dark, { p: [0, 0, 0.078] });
      b.tube([0, 0.12, 0], [0, 0.17, 0], 0.003, 3, mat.wood);
      b.box(0.004, 0.025, 0.035, red, [0, 0.155, 0.018]);
    });
  });
  // grosses Feuer in der Mitte und Feuerschalen / big central fire and fire bowls
  fire(b, 0.02, 0.06, 1.5);
  for (const [x, z] of [[0.18, -0.08], [-0.2, -0.1]] as [number, number][]) {
    b.cyl(0.006, 0.01, 0.08, 4, mat.rustDark, [x, 0.052, z]);
    b.add(geo.cyl(0.03, 0.016, 0.022, 8), mat.rust, { p: [x, 0.1, z] });
    b.add(geo.cone(0.022, 0.05, 6), mat.ember, { p: [x, 0.13, z] });
  }
  // Pilger um das Feuer / pilgrims around the fire
  const robes = [mat.robe, shade(red, 0.8), mat.robe, cloth];
  for (let i = 0; i < 4; i++) {
    const a = 0.6 + (i / 4) * Math.PI * 1.4;
    pilgrim(b, 0.02 + Math.sin(a) * 0.12, 0.06 + Math.cos(a) * 0.12, a + Math.PI, robes[i]);
  }
  // Steinmal mit Kerzen / cairn with candles
  for (let i = 0; i < 4; i++) b.add(geo.dodeca(0.03 - i * 0.006), mat.concrete, { p: [0.27, 0.025 + i * 0.03, 0.2] });
  for (const [x, z] of [[0.22, 0.25], [0.31, 0.26], [0.25, 0.15]] as [number, number][]) {
    b.cyl(0.006, 0.006, 0.025, 5, mat.bone, [x, 0.025, z]);
    b.add(geo.cone(0.005, 0.012, 4), mat.ember, { p: [x, 0.044, z] });
  }
  flagPole(b, f ?? 'vesper', 0.33, 0.012, -0.3, 0.3, 0.8);
}

// ---------- NEXUS: Depotknoten / depot node ----------

/** kleine Quadrocopter-Drohne / small quadcopter drone */
function drone(b: Builder, x: number, y: number, z: number, ry: number, light: ColorLike) {
  b.group({ p: [x, y, z], r: [0, ry, 0] }, () => {
    b.add(geo.rbox(0.04, 0.014, 0.04, 0.005), mat.gunmetal, {});
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(0.03, 0.004, 0.004, mat.plate, [sx * 0.022, 0.004, sz * 0.022], [0, Math.PI / 4 * sx * sz, 0]);
      b.add(geo.cyl(0.014, 0.014, 0.002, 8, true), light, { p: [sx * 0.03, 0.008, sz * 0.03] });
    }
    b.box(0.012, 0.006, 0.012, light, [0, -0.01, 0]);
    // haengende Kiste / hanging crate
    b.tube([0, -0.012, 0], [0, -0.04, 0], 0.0015, 3, mat.dark);
    b.add(geo.rbox(0.026, 0.02, 0.026, 0.004), mat.plate, { p: [0, -0.05, 0] });
  });
}

export function depotNode(b: Builder, f: FactionId | null) {
  const L = look(f ?? 'nexus');
  const cyan = f === 'nexus' || !f ? mat.cyanGlow : L.secondary;
  const wall = mix(mat.plate, mat.concrete, 0.3);
  // Sechseck-Plattform mit Leuchtkante / hexagon platform with glowing edge
  b.cyl(0.36, 0.38, 0.03, 6, mat.gunmetal, [0, 0.015, 0], [0, Math.PI / 6, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.box(0.3, 0.006, 0.01, cyan, [Math.sin(a) * 0.315, 0.032, Math.cos(a) * 0.315], [0, a, 0]);
  }
  // Depothalle mit Rolltoren und Lichtbaendern / depot hall with roller doors and light strips
  b.group({ p: [-0.08, 0.03, -0.12] }, () => {
    b.add(geo.cbox(0.36, 0.16, 0.2, 0.02), wall, { p: [0, 0.08, 0] });
    b.block(0, 0.16, 0, 0.37, 0.016, 0.21, L.primary);
    for (const x of [-0.11, 0, 0.11]) {
      b.block(x, 0, 0.102, 0.08, 0.11, 0.006, mat.gunmetal);
      for (let i = 0; i < 4; i++) b.block(x, 0.015 + i * 0.025, 0.106, 0.078, 0.004, 0.004, shade(mat.gunmetal, 1.3));
      b.block(x, 0.12, 0.104, 0.08, 0.008, 0.006, cyan);
    }
    b.block(0, 0.135, 0.104, 0.36, 0.006, 0.006, cyan);
    // Solarpaneele auf dem Dach / solar panels on the roof
    for (let i = 0; i < 3; i++) b.box(0.09, 0.006, 0.12, mat.glassDark, [-0.12 + i * 0.12, 0.19, 0], [0.25, 0, 0]);
    if (f) addEmblem(b, f, 0.022, 0.006, cyan, { p: [0.15, 0.08, 0.104] });
  });
  // Containerstapel / container stacks
  container(b, 0.25, 0.03, 0.08, L.primary, HALF_PI, 0.14);
  container(b, 0.25, 0.09, 0.08, mat.plate, HALF_PI, 0.14);
  container(b, 0.18, 0.03, 0.2, mix(L.primary, mat.white, 0.4), 0, 0.12);
  // Greifarm-Kran auf Schiene / gripper crane on a rail
  b.group({ p: [0.06, 0.03, 0.14] }, () => {
    b.cyl(0.035, 0.04, 0.03, 10, mat.gunmetal, [0, 0.015, 0]);
    b.tube([0, 0.03, 0], [0.04, 0.18, -0.02], 0.012, 6, mat.plate);
    b.add(geo.sphere(0.016, 8, 6), cyan, { p: [0.04, 0.18, -0.02] });
    b.tube([0.04, 0.18, -0.02], [0.14, 0.15, -0.04], 0.01, 6, mat.plate);
    for (const s of [-1, 1]) b.tube([0.14, 0.15, -0.04], [0.15, 0.12, -0.04 + s * 0.016], 0.004, 4, mat.gunmetal);
  });
  // Erz-Rutsche aus dem Berg / ore chute from the mountain
  b.group({ p: [-0.28, 0.03, 0.12], r: [0, 0, -0.5] }, () => {
    b.box(0.18, 0.01, 0.06, mat.gunmetal, [0, 0.05, 0]);
    for (const s of [-1, 1]) b.box(0.18, 0.02, 0.006, cyan, [0, 0.06, s * 0.03]);
    for (let i = 0; i < 3; i++) b.add(geo.dodeca(0.014), mat.rockDark, { p: [-0.05 + i * 0.05, 0.065, 0] });
  });
  // Drohnenlandefeld mit zwei schwebenden Drohnen / drone pad with two hovering drones
  b.cyl(0.06, 0.06, 0.006, 12, mat.dark, [-0.12, 0.034, 0.2]);
  b.add(geo.torus(0.05, 0.004, 3, 14), cyan, { p: [-0.12, 0.038, 0.2], r: [HALF_PI, 0, 0] });
  drone(b, -0.12, 0.13, 0.2, 0.3, cyan);
  drone(b, 0.1, 0.36, -0.1, -0.5, cyan);
  // Datenmast mit Lichtern / data mast with lights
  b.cyl(0.008, 0.014, 0.42, 6, mat.gunmetal, [-0.3, 0.24, -0.26]);
  for (let i = 0; i < 4; i++) b.add(geo.ico(0.01, 0), cyan, { p: [-0.3, 0.12 + i * 0.09, -0.252] });
  b.add(geo.ico(0.018, 0), cyan, { p: [-0.3, 0.46, -0.26] });
  if (f !== 'nexus' && f !== null) flagPole(b, f, 0.33, 0.03, -0.3, 0.26, 0.7);
}

