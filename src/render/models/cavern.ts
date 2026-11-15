/**
 * Hoehlen-Modelle fuer das Kampagnenfinale (m9): mutierte Leuchtpilze, Felssaeulen mit Kristalladern, Hoehlenboden,
 * Skelette (Verdan-Ruestungen, Alien-Knochen, riesige Kreaturenschaedel), Krater-Risse und Truemmer, Felswaende und
 * Tropfsteine, Nachschublinien (Foerderturm, Stollenmund, Gleise, Kisten, Laternen) und die Verdan-Geschuetze.
 * Leuchtende Teile nutzen exakt die Leuchtfarben (caveGlow*, caveLantern, caveCrystal, verdanEye, artifact*),
 * damit withGlow sie erkennt (KEYS in atmosphere.ts).
 * Cavern models for the campaign finale (m9): mutated glowing mushrooms, rock pillars with crystal veins, cave floor,
 * skeletons (Verdan armour, alien bones, huge creature skulls), crater cracks and debris, rock walls and stalactites,
 * supply lines (headframe, tunnel mouth, rails, crates, lanterns) and the Verdan guns.
 * Glowing parts use exactly the glow colours (caveGlow*, caveLantern, caveCrystal, verdanEye, artifact*)
 * so withGlow picks them up (KEYS in atmosphere.ts).
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { factionTokens, semantic } from '../../design/tokens';
import { Builder, geo, memo, mix, rng, shade } from './kit';

const S = semantic;
const GLOWS = [S.caveGlowTeal, S.caveGlowMagenta, S.caveGlowLime] as const;
const CAPS = [S.mushroomCapA, S.mushroomCapB, S.mushroomCapC] as const;
const TAU = Math.PI * 2;

// ---------- Pilze / mushrooms ----------

/** Riesenpilz mit leuchtenden Punkten und leuchtenden Lamellen / giant mushroom with glowing spots and glowing gills */
function mushroom(b: Builder, x: number, z: number, h: number, capR: number, R: () => number, tone: number, spots = true) {
  const lean = (R() - 0.5) * 0.25;
  const glow = GLOWS[tone % 3];
  b.group({ p: [x, 0, z], r: [lean, R() * TAU, lean * 0.6] }, () => {
    // Stiel mit Knolle / stem with bulb
    b.add(geo.cyl(capR * 0.22, capR * 0.32, h, 5), S.mushroomStem, { p: [0, h / 2, 0] });
    // Lamellen leuchten von unten / gills glow from below
    b.add(geo.cone(capR * 0.92, capR * 0.32, 8), glow, { p: [0, h - capR * 0.08, 0], r: [Math.PI, 0, 0] });
    // Hut / cap
    b.add(geo.hemi(capR, 8, 3), CAPS[(tone + 1) % 3], { p: [0, h - capR * 0.06, 0], s: [1, 0.55, 1] });
    if (!spots) return;
    // Leuchtpunkte auf dem Hut / glowing spots on the cap
    const n = 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R() * 0.6;
      const rr = capR * (0.35 + R() * 0.45);
      const yy = h - capR * 0.06 + Math.sqrt(Math.max(0, 1 - (rr / capR) ** 2)) * capR * 0.55;
      b.add(geo.sphere(capR * (0.1 + R() * 0.05), 4, 2), GLOWS[(tone + i) % 3], { p: [Math.cos(a) * rr, yy, Math.sin(a) * rr], s: [1, 0.5, 1] });
    }
  });
}

/**
 * Mutierter Leuchtpilzwald statt Wald (4 Varianten); low = weniger Pilze fuer niedrige Qualitaet.
 * Mutated glowing mushroom forest instead of a forest (4 variants); low = fewer mushrooms for low quality.
 */
export function mushroomForest(variant: number, low = false): THREE.BufferGeometry {
  const v = ((variant % 4) + 4) % 4;
  return memo(`cave|mushrooms|${v}|${+low}`, () => {
    const R = rng(7100 + v * 31);
    const b = new Builder();
    const spots: [number, number][] = [[-0.2, -0.18], [0.2, -0.22], [0.02, 0.06], [-0.26, 0.24], [0.26, 0.2], [0.04, 0.32], [-0.05, -0.33]];
    const n = low ? 3 : 4 + (v % 2);
    for (let i = 0; i < n; i++) {
      const [x, z] = spots[(i * 2 + v) % spots.length];
      const big = i === 0;
      mushroom(b, x + (R() - 0.5) * 0.06, z + (R() - 0.5) * 0.06, big ? 0.62 + R() * 0.16 : 0.26 + R() * 0.18, big ? 0.3 : 0.13 + R() * 0.07, R, v + i);
    }
    // kleine Pilze und Moos dazwischen / small mushrooms and moss in between
    for (let i = 0; i < (low ? 1 : 3); i++) {
      const a = R() * TAU, r = 0.18 + R() * 0.24;
      mushroom(b, Math.cos(a) * r, Math.sin(a) * r, 0.07 + R() * 0.05, 0.04 + R() * 0.02, R, v + i + 1, false);
    }
    for (let i = 0; i < (low ? 1 : 3); i++) {
      const a = R() * TAU, r = R() * 0.32;
      b.add(geo.cyl(0.1 + R() * 0.06, 0.12 + R() * 0.06, 0.012, 7), i % 2 ? S.caveMoss : S.caveMossLight, { p: [Math.cos(a) * r, 0.006, Math.sin(a) * r] });
    }
    return b.build();
  });
}

/** Hoehlenboden: Moos, kleine Leuchtpilze, Kiesel (8 Varianten, manche leer) / cave floor: moss, small glowing fungi, pebbles */
export function caveFloorDeco(variant: number): THREE.BufferGeometry | null {
  const v = ((variant % 8) + 8) % 8;
  if (v === 3 || v === 6) return null;
  return memo(`cave|floor|${v}`, () => {
    const R = rng(7300 + v * 17);
    const b = new Builder();
    for (let i = 0; i < 2 + (v % 2); i++) {
      const a = R() * TAU, r = 0.1 + R() * 0.25;
      b.add(geo.cyl(0.07 + R() * 0.07, 0.09 + R() * 0.07, 0.01, 7), i % 2 ? S.caveMoss : S.caveMossLight, { p: [Math.cos(a) * r, 0.005, Math.sin(a) * r], s: [1, 1, 0.7 + R() * 0.5] });
    }
    const fungi = 2 + (v % 3);
    for (let i = 0; i < fungi; i++) {
      const a = R() * TAU, r = 0.12 + R() * 0.28;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.05 + R() * 0.06;
      b.add(geo.cyl(0.009, 0.012, h, 4), S.mushroomStem, { p: [x, h / 2, z] });
      b.add(geo.hemi(0.028 + R() * 0.016, 6, 2), GLOWS[(v + i) % 3], { p: [x, h, z], s: [1, 0.6, 1] });
    }
    for (let i = 0; i < 2; i++) {
      const a = R() * TAU, r = R() * 0.35, s = 0.025 + R() * 0.02;
      b.add(geo.dodeca(s), i ? S.caveRock : S.caveRockDark, { p: [Math.cos(a) * r, s * 0.4, Math.sin(a) * r], r: [R(), R() * 3, R()], s: [1, 0.6, 1] });
    }
    return b.build();
  });
}

// ---------- Fels / rock ----------

/** Kristallader: Splitter in Leuchtfarbe / crystal vein: shards in glow colour */
function crystalShards(b: Builder, x: number, y: number, z: number, s: number, R: () => number, c: string = S.caveCrystal, n = 3) {
  for (let i = 0; i < n; i++) {
    const h = (0.05 + R() * 0.06) * s;
    b.group({ p: [x, y, z], r: [(R() - 0.5) * 1.4, R() * 3, (R() - 0.5) * 1.4] }, () => {
      b.add(geo.cyl(0.012 * s, 0.016 * s, h, 4), c, { p: [0, h / 2, 0] });
      b.add(geo.cone(0.012 * s, 0.03 * s, 4), c, { p: [0, h + 0.015 * s, 0] });
    });
  }
}

/** Felssaeulen und Stalagmiten mit Kristalladern statt Bergen (4 Varianten) / rock pillars and stalagmites with crystal veins instead of mountains */
export function rockPillars(variant: number, ore: boolean): THREE.BufferGeometry {
  const v = ((variant % 4) + 4) % 4;
  return memo(`cave|pillars|${v}|${+ore}`, () => {
    const R = rng(7500 + v * 23 + (ore ? 5 : 0));
    const b = new Builder();
    // Hauptsaeule: gestapelte, verjuengte Fels-Trommeln / main pillar: stacked tapered rock drums
    const mainH = 0.62 + R() * 0.2;
    const px = (R() - 0.5) * 0.12, pz = (R() - 0.5) * 0.12;
    let y = 0, r = 0.27;
    for (let i = 0; i < 4; i++) {
      const h = mainH / 4;
      const r2 = r * (0.78 + R() * 0.08);
      b.add(geo.cyl(r2, r, h, 7), i % 2 ? S.caveRock : S.caveRockDark, { p: [px + (R() - 0.5) * 0.03, y + h / 2, pz + (R() - 0.5) * 0.03], r: [0, R() * 3, 0] });
      y += h; r = r2;
    }
    b.add(geo.cone(r, 0.16, 7), S.caveRock, { p: [px, y + 0.08, pz], r: [0, R() * 3, 0] });
    // Nebenstalagmiten / side stalagmites
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + v, rr = 0.25 + R() * 0.08;
      const h = 0.18 + R() * 0.2;
      b.add(geo.cone(0.07 + R() * 0.04, h, 6), i % 2 ? S.caveRockDark : S.caveWallLight, { p: [Math.cos(a) * rr, h / 2, Math.sin(a) * rr], r: [(R() - 0.5) * 0.2, R() * 3, (R() - 0.5) * 0.2] });
    }
    // Kristalladern in der Saeule / crystal veins in the pillar
    for (let i = 0; i < 2 + (v % 2); i++) {
      const a = R() * TAU, hh = 0.12 + R() * mainH * 0.7;
      crystalShards(b, px + Math.cos(a) * 0.2, hh, pz + Math.sin(a) * 0.2, 1.1, R);
    }
    // Erz: goldene Adern und Brocken / ore: golden veins and lumps
    if (ore) {
      for (let i = 0; i < 2; i++) crystalShards(b, (R() - 0.5) * 0.4, 0.02, 0.28 - R() * 0.1, 1.5, R, S.caveLantern);
      for (let i = 0; i < 3; i++) b.add(geo.dodeca(0.04), S.artifactGold, { p: [0.2 - i * 0.12, 0.02, 0.3], r: [R(), R(), R()] });
    }
    return b.build();
  });
}

/** Grober Felsbrocken fuer Waende und Gewoelbe (instanziert) / rough rock lump for walls and vaults (instanced) */
export function caveRockLump(variant: number): THREE.BufferGeometry {
  const v = ((variant % 3) + 3) % 3;
  return memo(`cave|lump|${v}`, () => {
    const R = rng(7700 + v * 41);
    const b = new Builder();
    const c = [S.caveWall, S.caveWallDark, S.caveWallLight][v];
    b.add(geo.dodeca(0.5), c, { s: [1, 0.9 + R() * 0.3, 1], r: [R(), R() * 3, R()] });
    b.add(geo.dodeca(0.3), shade(c, 1.12), { p: [0.25, 0.22, 0.1], r: [R(), R(), R()] });
    b.add(geo.dodeca(0.28), shade(c, 0.85), { p: [-0.2, -0.15, -0.2], r: [R(), R(), R()] });
    // Kristallader im Fels / crystal vein in the rock
    if (v !== 1) crystalShards(b, 0.3, 0.1, 0.35, 3.2, R, v === 2 ? S.caveGlowMagenta : S.caveCrystal, 2);
    return b.build();
  });
}

/** Tropfstein, haengt nach unten (Spitze bei y = -h) / stalactite hanging down (tip at y = -h) */
export function stalactite(variant: number): THREE.BufferGeometry {
  const v = ((variant % 3) + 3) % 3;
  return memo(`cave|stalactite|${v}`, () => {
    const R = rng(7900 + v * 13);
    const b = new Builder();
    const h = 1;
    b.add(geo.cone(0.16, h, 6), v === 1 ? S.caveWallDark : S.caveWall, { p: [0, -h / 2, 0], r: [Math.PI, R() * 3, 0] });
    b.add(geo.cone(0.08, h * 0.55, 6), S.caveWallLight, { p: [0.14, -h * 0.27, 0.06], r: [Math.PI, R() * 3, 0] });
    b.add(geo.cone(0.06, h * 0.4, 5), S.caveWallDark, { p: [-0.12, -h * 0.2, -0.08], r: [Math.PI, 0, 0] });
    // leuchtender Tropfen an der Spitze / glowing drop at the tip
    b.add(geo.sphere(0.03, 5, 4), v === 2 ? S.caveGlowLime : S.caveGlowTeal, { p: [0, -h - 0.02, 0] });
    return b.build();
  });
}

// ---------- Krater / crater ----------

/**
 * Glimmende Risse auf einem Kraterfeld, entlang +z (vom Artefakt weg). ring 0 = Mitte, 1, 2 = aussen.
 * Glowing cracks on a crater tile, along +z (away from the artifact). ring 0 = centre, 1, 2 = outer.
 */
export function craterCracks(ring: number, variant: number): THREE.BufferGeometry {
  const v = ((variant % 3) + 3) % 3;
  return memo(`cave|cracks|${ring}|${v}`, () => {
    const R = rng(8100 + ring * 7 + v * 29);
    const b = new Builder();
    // verkohlter Fleck / scorched patch
    b.add(geo.box(0.98, 0.006, 0.98), ring === 0 ? S.craterScorch : mix(S.craterScorch, S.craterAsh, 0.25 + ring * 0.15), { p: [0, 0.003, 0] });
    const lines = ring === 0 ? 6 : 3 - Math.floor(ring / 2);
    for (let i = 0; i < lines; i++) {
      const base = ring === 0 ? (i / lines) * TAU : (i - (lines - 1) / 2) * 0.55 + (R() - 0.5) * 0.3;
      // Riss als Zickzack aus flachen Leisten / crack as a zigzag of flat strips
      let x = ring === 0 ? 0 : Math.sin(base) * 0.3 - 0.0, z = ring === 0 ? 0 : -0.5;
      let ang = base;
      const steps = ring === 0 ? 3 : 4;
      for (let k = 0; k < steps; k++) {
        const len = 0.18 + R() * 0.1;
        const nx = x + Math.sin(ang) * len, nz = z + Math.cos(ang) * len;
        const c = (k + i) % 3 === 0 ? S.artifactGold : S.artifactGlow;
        b.group({ p: [(x + nx) / 2, 0.009, (z + nz) / 2], r: [0, ang, 0] }, () => {
          b.add(geo.box(0.05 - k * 0.007, 0.007, len), c);
          b.add(geo.box(0.1 - k * 0.012, 0.003, len * 1.05), S.artifactGlowDeep, { p: [0, -0.002, 0] });
        });
        x = nx; z = nz; ang += (R() - 0.5) * 0.9;
        if (Math.abs(x) > 0.48 || Math.abs(z) > 0.5) break;
      }
    }
    // Ascheklumpen / ash lumps
    for (let i = 0; i < 2; i++) {
      const a = R() * TAU, r = 0.15 + R() * 0.25, s = 0.03 + R() * 0.03;
      b.add(geo.dodeca(s), i ? S.craterAsh : S.craterScorch, { p: [Math.cos(a) * r, s * 0.4, Math.sin(a) * r], r: [R(), R(), R()], s: [1, 0.6, 1] });
    }
    return b.build();
  });
}

/** Truemmerring am Kraterrand: Brocken und Splitter (3 Varianten) / debris ring at the crater rim: chunks and shards */
export function craterDebris(variant: number): THREE.BufferGeometry {
  const v = ((variant % 3) + 3) % 3;
  return memo(`cave|debris|${v}`, () => {
    const R = rng(8300 + v * 19);
    const b = new Builder();
    for (let i = 0; i < 5; i++) {
      const a = R() * TAU, r = 0.1 + R() * 0.32, s = 0.04 + R() * 0.06;
      b.add(geo.dodeca(s), [S.craterAsh, S.craterScorch, S.caveRockDark][i % 3], { p: [Math.cos(a) * r, s * 0.45, Math.sin(a) * r], r: [R(), R() * 3, R()], s: [1, 0.7, 1.2] });
    }
    // Obsidiansplitter des Artefakts / obsidian shards of the artifact
    for (let i = 0; i < 2; i++) {
      const a = R() * TAU, r = 0.2 + R() * 0.2;
      b.group({ p: [Math.cos(a) * r, 0, Math.sin(a) * r], r: [(R() - 0.5) * 0.8, R() * 3, (R() - 0.5) * 0.8] }, () => {
        b.add(geo.cone(0.035, 0.14, 4), S.artifactObsidian, { p: [0, 0.06, 0] });
        b.add(geo.box(0.01, 0.1, 0.012), S.artifactGlow, { p: [0.018, 0.05, 0] });
      });
    }
    return b.build();
  });
}

// ---------- Skelette / skeletons ----------

/** Wappen der Verdan: rote Scheibe mit weissen Fluegeln (Blick +z) / Verdan emblem: red disc with white wings (facing +z) */
export function verdanEmblem(b: Builder, s: number) {
  b.add(geo.cyl(0.05 * s, 0.05 * s, 0.012, 10), S.verdanRed, { r: [Math.PI / 2, 0, 0] });
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      b.add(geo.box(0.07 * s - k * 0.012 * s, 0.014 * s, 0.01), S.verdanWhite, {
        p: [side * (0.075 + k * 0.006) * s, (0.018 - k * 0.018) * s, 0.002], r: [0, 0, side * (0.35 + k * 0.25)],
      });
    }
  }
  b.add(geo.cyl(0.018 * s, 0.018 * s, 0.016, 6), S.verdanWhite, { p: [0, 0, 0.002], r: [Math.PI / 2, 0, 0] });
}

/** Gefallener Verdan-Soldat in alter Ruestung (3 Varianten) / fallen Verdan soldier in old armour */
export function verdanRemains(variant: number): THREE.BufferGeometry {
  const v = ((variant % 3) + 3) % 3;
  return memo(`cave|verdanBones|${v}`, () => {
    const R = rng(8500 + v * 11);
    const b = new Builder();
    b.group({ r: [0, v * 2.1, 0] }, () => {
      // Schaedel / skull
      b.add(geo.ico(0.07, 0), S.bone, { p: [0, 0.05, 0.2] });
      b.add(geo.box(0.022, 0.022, 0.01), S.ink, { p: [-0.024, 0.065, 0.264] });
      b.add(geo.box(0.022, 0.022, 0.01), S.ink, { p: [0.024, 0.065, 0.264] });
      // Brustpanzer mit Wappen / breastplate with emblem
      b.add(geo.rbox(0.2, 0.06, 0.2, 0.02), S.verdanMetal, { p: [0, 0.035, 0.02] });
      b.group({ p: [0, 0.07, 0.03], r: [-Math.PI / 2, 0, 0] }, () => verdanEmblem(b, 0.9));
      // Arme und Beine / arms and legs
      for (const [x, z, a] of [[-0.14, 0.04, 0.5], [0.14, 0.0, -0.8], [-0.05, -0.2, 0.2], [0.07, -0.21, -0.3]] as const) {
        b.add(geo.cyl(0.014, 0.014, 0.16, 5), S.bone, { p: [x, 0.014, z], r: [Math.PI / 2, 0, a] });
      }
      // Beinschienen und Helm mit Kamm / greaves and crested helmet
      b.add(geo.cyl(0.024, 0.024, 0.07, 6), S.verdanMetal, { p: [-0.06, 0.02, -0.25], r: [Math.PI / 2, 0, 0.2] });
      b.group({ p: [0.2, 0, 0.2], r: [0.5 + R() * 0.3, R() * 3, 0.4] }, () => {
        b.add(geo.hemi(0.075, 8, 3), S.verdanMetal);
        b.add(geo.box(0.014, 0.05, 0.12), S.verdanRed, { p: [0, 0.07, 0] });
      });
      // rostiges Gewehr / rusty rifle
      b.add(geo.box(0.022, 0.02, 0.3), S.rust, { p: [-0.18, 0.012, -0.05], r: [0, 0.6, 0] });
    });
    return b.build();
  });
}

/** Alien-Knochen: langer Schaedel, gebogene Rippen, Krallen (3 Varianten) / alien bones: long skull, curved ribs, claws */
export function alienBones(variant: number): THREE.BufferGeometry {
  const v = ((variant % 3) + 3) % 3;
  return memo(`cave|alienBones|${v}`, () => {
    const R = rng(8700 + v * 37);
    const b = new Builder();
    b.group({ r: [0, v * 1.7 + 0.4, 0] }, () => {
      // langgezogener Schaedel mit grossen Augenhoehlen / elongated skull with big eye sockets
      b.add(geo.sphere(0.09, 8, 6), S.alienBone, { p: [0, 0.07, 0.18], s: [0.8, 0.7, 1.5], r: [0.3, 0, 0] });
      for (const sx of [-1, 1]) b.add(geo.sphere(0.03, 6, 4), S.ink, { p: [sx * 0.042, 0.08, 0.27], s: [1, 1.3, 0.6] });
      // Wirbelsaeule mit Rippenboegen / spine with rib arcs
      b.add(geo.box(0.022, 0.02, 0.34), S.alienBone, { p: [0, 0.015, -0.06] });
      for (let i = 0; i < 4; i++) {
        b.add(geo.torus(0.1 - i * 0.012, 0.009, 3, 10), S.alienBone, { p: [0, 0.02, 0.06 - i * 0.07], r: [0, Math.PI / 2, 0], s: [1, 0.8, 1] });
      }
      // dreifingrige Klauen / three-fingered claws
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
        b.add(geo.cone(0.012, 0.09, 4), S.alienBone, { p: [sx * (0.18 + k * 0.025), 0.01, 0.1 - k * 0.02], r: [Math.PI / 2, 0, sx * 0.4] });
      }
      // leuchtende Reste von Xeno-Gewebe / glowing remains of xeno tissue
      b.add(geo.cyl(0.07, 0.08, 0.008, 7), S.xenoGlow, { p: [(R() - 0.5) * 0.1, 0.004, -0.15] });
    });
    return b.build();
  });
}

/** Riesiger Kreaturenschaedel mit Hoernern, halb im Boden (2 Varianten) / huge creature skull with horns, half buried */
export function giantSkull(variant: number): THREE.BufferGeometry {
  const v = ((variant % 2) + 2) % 2;
  return memo(`cave|giantSkull|${v}`, () => {
    const b = new Builder();
    b.group({ r: [0, v * 2.4, 0.08] }, () => {
      // Schaedeldecke / cranium
      b.add(geo.sphere(0.24, 10, 7), S.bone, { p: [0, 0.1, -0.05], s: [1, 0.75, 1.15] });
      // Schnauze mit Kiefer / snout with jaw
      b.add(geo.rtaper(0.26, 0.3, 0.16, 0.2, 0.16, 0.03), shade(S.bone, 0.95), { p: [0, 0.07, 0.24], r: [-0.25, 0, 0] });
      b.add(geo.box(0.22, 0.04, 0.3), shade(S.bone, 0.85), { p: [0, 0.015, 0.22], r: [0.08, 0, 0] });
      // Zaehne / teeth
      for (let i = 0; i < 6; i++) {
        const x = -0.09 + i * 0.036;
        b.add(geo.cone(0.014, 0.06, 4), S.bone, { p: [x, 0.03, 0.36], r: [Math.PI, 0, 0] });
      }
      // Augenhoehlen leuchten schwach / eye sockets glow faintly
      for (const sx of [-1, 1]) {
        b.add(geo.sphere(0.06, 7, 5), S.ink, { p: [sx * 0.11, 0.17, 0.1], s: [1, 0.8, 0.6] });
        b.add(geo.sphere(0.018, 5, 4), S.caveGlowMagenta, { p: [sx * 0.11, 0.17, 0.13] });
      }
      // gebogene Hoerner aus Segmenten / curved horns from segments
      for (const sx of [-1, 1]) {
        let p = new THREE.Vector3(sx * 0.18, 0.2, -0.05);
        let r = 0.05;
        for (let k = 0; k < 5; k++) {
          const q = p.clone().add(new THREE.Vector3(sx * (0.07 - k * 0.006), 0.05 - k * 0.025, -0.06 - k * 0.01));
          b.tube([p.x, p.y, p.z], [q.x, q.y, q.z], r * 0.78, 6, k % 2 ? shade(S.bone, 0.9) : S.bone, r);
          p = q; r *= 0.78;
        }
      }
      // Sand und Moos um den Schaedel / sand and moss around the skull
      b.add(geo.cyl(0.36, 0.42, 0.03, 9), S.caveRockDark, { p: [0, 0.0, 0.05] });
      b.add(geo.cyl(0.1, 0.12, 0.012, 7), S.caveMossLight, { p: [0.22, 0.02, -0.2] });
    });
    return b.build();
  });
}

// ---------- Nachschublinien / supply lines ----------

/** Laterne an einem Pfahl / lantern on a post */
function lantern(b: Builder, x: number, z: number, h: number) {
  b.add(geo.cyl(0.008, 0.01, h, 4), S.timber, { p: [x, h / 2, z] });
  b.add(geo.box(0.04, 0.008, 0.008), S.timber, { p: [x + 0.018, h, z] });
  b.add(geo.box(0.028, 0.04, 0.028), S.ink, { p: [x + 0.036, h - 0.03, z] });
  b.add(geo.sphere(0.017, 6, 4), S.caveLantern, { p: [x + 0.036, h - 0.03, z] });
}

/** Holzkiste / wooden crate */
function crate(b: Builder, x: number, y: number, z: number, s: number, ry: number) {
  b.add(geo.box(0.09 * s, 0.09 * s, 0.09 * s), S.timber, { p: [x, y + 0.045 * s, z], r: [0, ry, 0] });
  b.add(geo.box(0.094 * s, 0.014 * s, 0.094 * s), shade(S.timber, 0.7), { p: [x, y + 0.045 * s, z], r: [0, ry, 0] });
}

/** Gleise von a nach b mit Schwellen / rails from a to b with sleepers */
function rails(b: Builder, ax: number, az: number, bx: number, bz: number) {
  const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
  b.group({ p: [(ax + bx) / 2, 0, (az + bz) / 2], r: [0, ang, 0] }, () => {
    const n = Math.max(2, Math.round(len / 0.06));
    for (let i = 0; i < n; i++) b.add(geo.box(0.11, 0.01, 0.022), S.timber, { p: [0, 0.006, -len / 2 + (i + 0.5) * (len / n)] });
    for (const sx of [-1, 1]) b.add(geo.box(0.012, 0.014, len), S.verdanMetal, { p: [sx * 0.035, 0.016, 0] });
  });
}

/**
 * Nachschublinie: Stollenmund im Fels, Foerderturm mit Seilrad, Gleise mit Lore, Kisten, Laternen und Fahne in
 * Fraktionsfarbe. Der Hauptschacht ist groesser (hoeherer Turm mit zwei Raedern, Maschinenhaus, mehr Kisten).
 * Supply line: tunnel mouth in rock, headframe with sheave wheel, rails with a mine cart, crates, lanterns and a flag
 * in faction colour. The main shaft is bigger (taller tower with two wheels, engine house, more crates).
 */
export function supplyLineGeometry(faction: FactionId | null, mainShaft: boolean): THREE.BufferGeometry {
  return memo(`cave|supply|${faction ?? 'neutral'}|${+mainShaft}`, () => {
    const R = rng(9100 + (mainShaft ? 3 : 0));
    const b = new Builder();
    const prim = faction ? factionTokens[faction].primary : S.neutral;
    const sec = faction ? factionTokens[faction].secondary : S.neutralDark;
    const k = mainShaft ? 1.25 : 1;
    // Felshuegel mit Stollenmund (hinten links) / rock mound with tunnel mouth (back left)
    b.group({ p: [-0.2, 0, -0.22] }, () => {
      b.add(geo.dodeca(0.22 * k), S.caveRockDark, { p: [0, 0.08 * k, -0.04], s: [1.3, 0.85, 1] });
      b.add(geo.dodeca(0.14 * k), S.caveRock, { p: [0.14 * k, 0.05, -0.08], r: [0.4, 0.2, 0] });
      // Stollen: dunkles Loch mit Holzrahmen / tunnel: dark hole with timber frame
      b.add(geo.box(0.16 * k, 0.15 * k, 0.06), S.caveBackgroundBottom, { p: [0.02, 0.075 * k, 0.17 * k] });
      for (const sx of [-1, 1]) b.add(geo.box(0.022, 0.17 * k, 0.03), S.timber, { p: [0.02 + sx * 0.085 * k, 0.085 * k, 0.2 * k] });
      b.add(geo.box(0.21 * k, 0.026, 0.035), S.timber, { p: [0.02, 0.17 * k, 0.2 * k] });
    });
    rails(b, -0.18, -0.02, 0.32, 0.36);
    // Lore auf den Gleisen / mine cart on the rails
    b.group({ p: [0.08, 0.02, 0.18], r: [0, Math.atan2(0.5, 0.38), 0] }, () => {
      b.add(geo.taper(0.09, 0.12, 0.11, 0.15, 0.06), S.rust, { p: [0, 0.045, 0] });
      b.add(geo.dodeca(0.04), S.caveCrystal, { p: [0, 0.08, 0] });
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.add(geo.cyl(0.016, 0.016, 0.01, 6), S.ink, { p: [sx * 0.045, 0.016, sz * 0.04], r: [0, 0, Math.PI / 2] });
    });
    // Foerderturm (rechts hinten) / headframe (right back)
    const H = 0.66 * k;
    b.group({ p: [0.2, 0, -0.14] }, () => {
      b.add(geo.box(0.2 * k, 0.03, 0.2 * k), S.verdanMetal, { p: [0, 0.015, 0] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.tube([sx * 0.08 * k, 0.02, sz * 0.08 * k], [sx * 0.03, H, sz * 0.03], 0.012, 4, S.timber);
      }
      for (const yy of [0.18, 0.34]) b.add(geo.box(0.13 * k * (1 - yy), 0.016, 0.13 * k * (1 - yy)), S.timber, { p: [0, yy * k, 0] });
      // Seilrad(er) / sheave wheel(s)
      const wheels = mainShaft ? 2 : 1;
      for (let w = 0; w < wheels; w++) {
        const wx = wheels === 2 ? (w ? 0.04 : -0.04) : 0;
        b.add(geo.torus(0.06, 0.01, 4, 12), S.verdanMetal, { p: [wx, H + 0.03, 0], r: [0, Math.PI / 2, 0] });
        b.add(geo.cyl(0.01, 0.01, 0.03, 5), S.ink, { p: [wx, H + 0.03, 0], r: [0, 0, Math.PI / 2] });
      }
      // Foerderkorb im Schacht / cage in the shaft
      b.add(geo.box(0.07, 0.08, 0.07), prim, { p: [0, 0.1, 0] });
      b.add(geo.box(0.004, H - 0.12, 0.004), S.ink, { p: [0, (H + 0.15) / 2, 0.02] });
      // Fahne in Fraktionsfarbe / flag in faction colour
      b.add(geo.cyl(0.007, 0.007, 0.26, 4), S.ink, { p: [0, H + 0.17, 0.05] });
      b.add(geo.box(0.006, 0.1, 0.17), prim, { p: [0, H + 0.24, 0.14] });
      b.add(geo.box(0.007, 0.028, 0.17), sec, { p: [0, H + 0.21, 0.14] });
      // Huette am Turmfuss mit Dach in Fraktionsfarbe / hut at the tower foot with a roof in faction colour
      b.add(geo.box(0.14, 0.09, 0.1), S.timber, { p: [0, 0.045, 0.13] });
      b.add(geo.taper(0.17, 0.13, 0.03, 0.13, 0.05), prim, { p: [0, 0.115, 0.13] });
      b.add(geo.box(0.035, 0.035, 0.01), S.caveLantern, { p: [0.03, 0.05, 0.181] });
    });
    // Kisten und Faesser / crates and barrels
    const crates = mainShaft ? 5 : 3;
    for (let i = 0; i < crates; i++) {
      crate(b, -0.32 + (i % 3) * 0.1, i >= 3 ? 0.09 : 0, 0.2 + (i % 2) * 0.08, 0.9 + R() * 0.3, R());
    }
    b.add(geo.cyl(0.035, 0.035, 0.08, 7), sec, { p: [-0.05, 0.04, 0.34] });
    // Laternen / lanterns
    lantern(b, -0.38, -0.02, 0.2);
    lantern(b, 0.38, 0.12, 0.18);
    if (mainShaft) {
      // Maschinenhaus mit Dach in Fraktionsfarbe / engine house with a roof in faction colour
      b.group({ p: [0.32, 0, 0.3], r: [0, -0.3, 0] }, () => {
        b.add(geo.box(0.18, 0.14, 0.14), S.caveRockDark, { p: [0, 0.07, 0] });
        b.add(geo.taper(0.2, 0.16, 0.04, 0.16, 0.06), prim, { p: [0, 0.17, 0] });
        b.add(geo.box(0.04, 0.04, 0.01), S.caveLantern, { p: [0.03, 0.08, 0.072] });
        b.add(geo.cyl(0.015, 0.018, 0.1, 5), S.ink, { p: [-0.06, 0.22, 0] });
      });
      lantern(b, 0.0, 0.4, 0.22);
    }
    return b.build();
  });
}

// ---------- Verdan-Geschuetze / Verdan guns ----------

/**
 * Altes Verdan-Geschuetz: verwitterter Steinsockel, Metallkuppel mit Doppelrohr und Wappen; das Sensorauge ist
 * schlafend dunkel und wach rot-orange leuchtend (die Rohre heben sich dann).
 * Old Verdan gun: weathered stone plinth, metal dome with twin barrels and emblem; the sensor eye is dark when
 * dormant and glowing red-orange when active (the barrels rise then).
 */
export function verdanTurretGeometry(active: boolean): THREE.BufferGeometry {
  return memo(`cave|verdanGun|${+active}`, () => {
    const R = rng(9300);
    const b = new Builder();
    // Sockel: achteckige Steintrommel mit Rissen und Moos / plinth: octagonal stone drum with cracks and moss
    b.add(geo.cyl(0.34, 0.4, 0.14, 8), S.verdanStoneDark, { p: [0, 0.07, 0], r: [0, Math.PI / 8, 0] });
    b.add(geo.cyl(0.3, 0.33, 0.1, 8), S.verdanStone, { p: [0, 0.19, 0], r: [0, Math.PI / 8, 0] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      b.add(geo.box(0.008, 0.08, 0.02), S.ink, { p: [Math.cos(a) * 0.335, 0.18, Math.sin(a) * 0.335], r: [0, -a, 0.3] });
    }
    b.add(geo.cyl(0.305, 0.315, 0.03, 8), S.verdanRed, { p: [0, 0.2, 0], r: [0, Math.PI / 8, 0] });
    b.add(geo.cyl(0.308, 0.318, 0.012, 8), S.verdanWhite, { p: [0, 0.222, 0], r: [0, Math.PI / 8, 0] });
    b.add(geo.cyl(0.12, 0.14, 0.012, 7), S.caveMossLight, { p: [0.2, 0.245, 0.1] });
    // Abgebrochene Ecke / chipped corner
    b.add(geo.dodeca(0.07), S.verdanStoneDark, { p: [-0.36, 0.04, 0.22], r: [R(), R(), R()] });
    // Drehkranz / turret ring
    b.add(geo.cyl(0.22, 0.24, 0.05, 12), S.verdanMetal, { p: [0, 0.265, 0] });
    b.add(geo.torus(0.22, 0.012, 3, 16), S.rust, { p: [0, 0.29, 0], r: [Math.PI / 2, 0, 0] });
    // Kuppel / dome
    b.group({ p: [0, 0.29, 0] }, () => {
      b.add(geo.hemi(0.19, 10, 4), S.verdanMetal, { s: [1, 0.85, 1.1] });
      b.add(geo.rbox(0.16, 0.08, 0.2, 0.02), shade(S.verdanMetal, 1.1), { p: [0, 0.12, -0.02] });
      // Wappen links und rechts / emblem left and right
      for (const sx of [-1, 1]) b.group({ p: [sx * 0.185, 0.08, 0.0], r: [0, sx * Math.PI / 2, 0] }, () => verdanEmblem(b, 1.35));
      // Wappen auch hinten / emblem at the back too
      b.group({ p: [0, 0.08, -0.205], r: [0, Math.PI, 0] }, () => verdanEmblem(b, 1.2));
      // weiss-rote Streifen vorn / white and red stripes at the front
      b.add(geo.box(0.12, 0.02, 0.02), S.verdanWhite, { p: [0, 0.165, 0.08] });
      b.add(geo.box(0.12, 0.012, 0.022), S.verdanRed, { p: [0, 0.148, 0.08] });
      // Sensorauge / sensor eye
      b.add(geo.cyl(0.07, 0.075, 0.035, 10), S.ink, { p: [0, 0.1, 0.19], r: [Math.PI / 2, 0, 0] });
      b.add(geo.torus(0.062, 0.008, 3, 12), S.verdanWhite, { p: [0, 0.1, 0.208] });
      b.add(geo.sphere(0.05, 8, 6), active ? S.verdanEye : S.verdanEyeDormant, { p: [0, 0.1, 0.21] });
      // Doppelrohr / twin barrels
      const pitch = active ? -0.28 : 0.18;
      for (const sx of [-1, 1]) {
        b.group({ p: [sx * 0.07, 0.07, 0.12], r: [Math.PI / 2 + pitch, 0, 0] }, () => {
          b.add(geo.cyl(0.024, 0.03, 0.34, 8), S.verdanMetal, { p: [0, 0.17, 0] });
          b.add(geo.cyl(0.034, 0.034, 0.05, 8), S.ink, { p: [0, 0.34, 0] });
          if (active) b.add(geo.cyl(0.016, 0.016, 0.012, 8), S.verdanEye, { p: [0, 0.37, 0] });
        });
      }
    });
    return b.build();
  });
}

/** Truemmer eines zerstoerten Verdan-Geschuetzes / rubble of a destroyed Verdan gun */
export function verdanRuinGeometry(): THREE.BufferGeometry {
  return memo('cave|verdanRuin', () => {
    const R = rng(9500);
    const b = new Builder();
    b.add(geo.cyl(0.3, 0.38, 0.12, 8), S.verdanStoneDark, { p: [0, 0.06, 0], r: [0.05, Math.PI / 8, 0.04] });
    for (let i = 0; i < 6; i++) {
      const a = R() * TAU, r = 0.18 + R() * 0.2, s = 0.04 + R() * 0.05;
      b.add(geo.dodeca(s), i % 2 ? S.verdanStone : S.craterAsh, { p: [Math.cos(a) * r, 0.12 + s * 0.3, Math.sin(a) * r], r: [R(), R(), R()] });
    }
    // umgestuerzte Kuppel und Rohr / toppled dome and barrel
    b.group({ p: [0.12, 0.13, 0.05], r: [1.1, 0.6, 0.3] }, () => {
      b.add(geo.hemi(0.17, 9, 3), S.verdanMetal, { s: [1, 0.8, 1.1] });
      b.add(geo.sphere(0.03, 6, 4), S.verdanEyeDormant, { p: [0, 0.09, 0.17] });
    });
    b.add(geo.cyl(0.024, 0.03, 0.32, 7), S.rust, { p: [-0.2, 0.03, 0.2], r: [Math.PI / 2, 0, 1.1] });
    return b.build();
  });
}

// ---------- Kreaturen / creatures ----------

/** Hoehlenkrabbler: Segmentkoerper mit Leuchtpunkten, sechs Beine (Blick +z) / cave crawler: segmented body with glow spots */
export function crawlerGeometry(): THREE.BufferGeometry {
  return memo('cave|crawler', () => {
    const b = new Builder();
    for (let i = 0; i < 3; i++) {
      b.add(geo.sphere(0.04 - i * 0.006, 7, 5), S.caveWallLight, { p: [0, 0.035, 0.04 - i * 0.05], s: [1, 0.7, 1.1] });
      b.add(geo.sphere(0.011, 5, 3), S.caveGlowTeal, { p: [0, 0.062 - i * 0.004, 0.04 - i * 0.05] });
    }
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) {
      b.tube([sx * 0.02, 0.035, 0.03 - i * 0.04], [sx * 0.075, 0.0, 0.05 - i * 0.045], 0.005, 3, S.caveWallDark);
    }
    // Fuehler / antennae
    for (const sx of [-1, 1]) b.tube([sx * 0.012, 0.05, 0.07], [sx * 0.04, 0.09, 0.13], 0.003, 3, S.caveGlowTeal);
    return b.build();
  });
}

/** Schwebender Sporentreiber: leuchtende Blase mit Faeden / floating spore drifter: glowing bulb with tendrils */
export function sporeDrifterGeometry(): THREE.BufferGeometry {
  return memo('cave|drifter', () => {
    const b = new Builder();
    b.add(geo.sphere(0.06, 9, 6), S.mushroomCapA, { s: [1, 0.8, 1] });
    b.add(geo.sphere(0.04, 7, 5), S.caveGlowMagenta, { p: [0, -0.012, 0] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      b.tube([Math.cos(a) * 0.03, -0.03, Math.sin(a) * 0.03], [Math.cos(a) * 0.045, -0.16, Math.sin(a) * 0.045], 0.004, 3, i % 2 ? S.caveGlowMagenta : S.mushroomStem, 0.002);
    }
    return b.build();
  });
}

/** Blinde Echse mit Leuchtflecken (Blick +z) / blind lizard with glowing spots (facing +z) */
export function lizardGeometry(): THREE.BufferGeometry {
  return memo('cave|lizard', () => {
    const b = new Builder();
    b.add(geo.sphere(0.05, 8, 5), S.mushroomStem, { p: [0, 0.03, 0], s: [0.8, 0.5, 1.8] });
    b.add(geo.sphere(0.035, 7, 5), shade(S.mushroomStem, 0.92), { p: [0, 0.035, 0.1], s: [0.9, 0.6, 1.3] });
    b.tube([0, 0.025, -0.08], [0.04, 0.012, -0.2], 0.006, 4, S.mushroomStem, 0.022);
    for (const [x, z] of [[-0.05, 0.05], [0.05, 0.05], [-0.05, -0.05], [0.05, -0.05]] as const) b.tube([x * 0.5, 0.025, z], [x * 1.4, 0.0, z + 0.02], 0.007, 3, S.mushroomStem);
    for (let i = 0; i < 4; i++) b.add(geo.sphere(0.011, 5, 3), S.caveGlowLime, { p: [(i % 2 ? 0.018 : -0.018), 0.052, 0.04 - i * 0.03] });
    return b.build();
  });
}

/** Riesenmotte, Koerper (Blick +z) / giant moth, body (facing +z) */
export function mothBodyGeometry(): THREE.BufferGeometry {
  return memo('cave|mothBody', () => {
    const b = new Builder();
    b.add(geo.sphere(0.026, 7, 5), S.caveWallLight, { s: [0.8, 0.8, 2.2] });
    for (const sx of [-1, 1]) b.tube([sx * 0.008, 0.01, 0.05], [sx * 0.03, 0.04, 0.09], 0.003, 3, S.caveGlowTeal);
    return b.build();
  });
}

/** Fluegel einer Riesenmotte (rechte Seite, Gelenk bei x = 0) / wing of a giant moth (right side, hinge at x = 0) */
export function mothWingGeometry(): THREE.BufferGeometry {
  return memo('cave|mothWing', () => {
    const b = new Builder();
    b.add(geo.cyl(0.08, 0.08, 0.004, 7), S.mushroomCapB, { p: [0.075, 0, 0.015], s: [1, 1, 0.85] });
    b.add(geo.cyl(0.055, 0.055, 0.004, 7), S.mushroomCapA, { p: [0.06, 0, -0.06], s: [1, 1, 0.8] });
    // Leuchtaugen auf den Fluegeln / luminous eye spots on the wings
    b.add(geo.cyl(0.026, 0.026, 0.006, 8), S.caveGlowTeal, { p: [0.09, 0.002, 0.02] });
    b.add(geo.cyl(0.018, 0.018, 0.006, 8), S.caveGlowMagenta, { p: [0.07, 0.002, -0.06] });
    return b.build();
  });
}

/** Wassertropfen und Staubflocke fuer die Hoehlenpartikel / water drop and dust mote for cavern particles */
export function dripGeometry(): THREE.BufferGeometry {
  return memo('cave|drip', () => new Builder().add(geo.cone(0.012, 0.05, 4), S.cavePoolShore, { r: [Math.PI, 0, 0] }).build());
}
