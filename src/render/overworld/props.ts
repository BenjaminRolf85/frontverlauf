/**
 * Kleine Requisiten fuer die Oberwelt, direkt im Weltmassstab (Scheibenradius 1.6) und bewusst sparsam an Dreiecken,
 * weil sie hundertfach instanziert werden: Nadel- und Laubbaeume, Haeuser, Felder, Voegel, Rauch, Pflanzen, Felsen
 * mit Bewuchs, Saeulen, Knochen. Farben nur aus den Design-Tokens.
 * Small props for the overworld, directly at world scale (disc radius 1.6) and deliberately low on triangles because
 * they are instanced hundreds of times: conifers and leafy trees, houses, fields, birds, smoke, plants, rocks with
 * growth, columns, bones. Colours only from the design tokens.
 */
import * as THREE from 'three';
import { semantic, primitives } from '../../design/tokens';
import { Builder, geo, mix, shade } from '../models/kit';

const c = primitives.color;

/** Nadelbaum (Spitze nach oben, Ursprung am Fuss) / conifer (tip up, origin at the foot) */
export function conifer(tone = 0): THREE.BufferGeometry {
  const b = new Builder();
  const green = tone ? c.forest700 : c.forest500;
  b.add(geo.cyl(0.006, 0.008, 0.03, 5), semantic.timber, { p: [0, 0.015, 0] });
  b.add(geo.cone(0.042, 0.07, 6), green, { p: [0, 0.055, 0] });
  b.add(geo.cone(0.032, 0.06, 6), shade(green, 1.12), { p: [0, 0.088, 0] });
  b.add(geo.cone(0.02, 0.045, 6), shade(green, 1.22), { p: [0, 0.118, 0] });
  return b.build();
}

/** Laubbaum mit runder Krone / leafy tree with a round crown */
export function leafy(tone = 0): THREE.BufferGeometry {
  const b = new Builder();
  const green = tone ? c.grass600 : c.jungle400;
  b.add(geo.cyl(0.007, 0.01, 0.045, 5), semantic.timber, { p: [0, 0.022, 0] });
  b.add(geo.ico(0.042, 0), green, { p: [0, 0.07, 0], s: [1, 0.9, 1] });
  b.add(geo.ico(0.026, 0), shade(green, 1.15), { p: [0.018, 0.09, 0.01] });
  return b.build();
}

/** Haus mit Satteldach und Schornstein / house with gable roof and chimney */
export function house(roof: string): THREE.BufferGeometry {
  const b = new Builder();
  b.add(geo.box(0.05, 0.034, 0.038), semantic.bone, { p: [0, 0.017, 0] });
  b.add(geo.profileZY([[-0.024, 0], [0.024, 0], [0, 0.024]], 0.056), roof, { p: [0, 0.034, 0], r: [0, Math.PI / 2, 0] });
  b.add(geo.box(0.008, 0.02, 0.008), semantic.cliffDark, { p: [0.014, 0.05, 0.006] });
  b.add(geo.box(0.01, 0.014, 0.002), semantic.ink, { p: [0, 0.01, 0.0195] });
  return b.build();
}

/** Feld: flaches Beet mit Furchen / field: flat bed with furrows */
export function field(color: string): THREE.BufferGeometry {
  const b = new Builder();
  b.add(geo.box(0.16, 0.012, 0.11), color, { p: [0, 0.006, 0] });
  for (let i = 0; i < 4; i++) b.add(geo.box(0.15, 0.004, 0.008), shade(color, 0.8), { p: [0, 0.013, -0.04 + i * 0.027] });
  return b.build();
}

/** Vogel als Comic-Haken (zwei Fluegel) / bird as a comic tick (two wings) */
export function bird(): THREE.BufferGeometry {
  const b = new Builder();
  for (const s of [-1, 1]) b.add(geo.box(0.04, 0.004, 0.012), semantic.ink, { p: [s * 0.018, 0.006, 0], r: [0, 0, s * 0.45] });
  return b.build();
}

/** Rauchwolke (Kugel mit Vertexfarbe) / smoke puff (sphere with vertex colour) */
export function puff(color: string): THREE.BufferGeometry {
  const b = new Builder();
  b.add(geo.ico(1, 1), color);
  return b.build();
}

/** Sandsack-Reihe fuer Graeben / row of sandbags for trenches */
export function sandbags(): THREE.BufferGeometry {
  const b = new Builder();
  for (let i = 0; i < 3; i++) b.add(geo.rbox(0.03, 0.014, 0.018, 0.005), i % 2 ? semantic.dust : semantic.beach, { p: [(i - 1) * 0.03, 0.007, 0] });
  b.add(geo.rbox(0.03, 0.014, 0.018, 0.005), semantic.dust, { p: [0.015, 0.02, 0] });
  return b.build();
}

/** Glockenturm (Akt II, die Glocke) / bell tower (act II, the Bell) */
export function bellTower(): THREE.BufferGeometry {
  const b = new Builder();
  const stone = semantic.verdanStone, dark = semantic.verdanStoneDark;
  b.add(geo.box(0.11, 0.03, 0.11), dark, { p: [0, 0.015, 0] });
  b.add(geo.taper(0.08, 0.08, 0.07, 0.07, 0.24, 0), stone, { p: [0, 0.15, 0] });
  for (let i = 0; i < 3; i++) b.add(geo.box(0.012, 0.03, 0.002), semantic.ink, { p: [0, 0.07 + i * 0.06, 0.036] });
  // offene Glockenstube / open belfry
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.add(geo.box(0.014, 0.08, 0.014), stone, { p: [x * 0.03, 0.31, z * 0.03] });
  b.add(geo.box(0.08, 0.014, 0.08), dark, { p: [0, 0.355, 0] });
  b.add(geo.cone(0.07, 0.12, 4), semantic.stamp, { p: [0, 0.42, 0], r: [0, Math.PI / 4, 0] });
  b.add(geo.cone(0.026, 0.04, 8), c.dravonGold, { p: [0, 0.3, 0] });
  b.add(geo.cyl(0.03, 0.03, 0.008, 8), c.dravonGold, { p: [0, 0.282, 0] });
  b.add(geo.cyl(0.002, 0.002, 0.08, 4), semantic.ink, { p: [0, 0.5, 0] });
  return b.build();
}

/** Schlot mit Bandstreifen / smokestack with bands */
export function smokestack(h = 0.32): THREE.BufferGeometry {
  const b = new Builder();
  b.add(geo.cyl(0.018, 0.026, h, 8), semantic.metal, { p: [0, h / 2, 0] });
  for (let i = 1; i < 3; i++) b.add(geo.cyl(0.0235 - i * 0.002, 0.0235 - i * 0.002, 0.02, 8), semantic.beacon, { p: [0, h * (0.35 + i * 0.25), 0] });
  return b.build();
}

/** Grosse Knollenpflanze mit Leuchtkapseln (Leuchtteile separat) / bulbous plant with glowing pods (glow parts separate) */
export function bulbPlant(variant: number): THREE.BufferGeometry {
  const b = new Builder();
  const stalk = variant % 2 ? semantic.alienMoss : semantic.xenoGroundDark;
  const head = variant % 2 ? semantic.alienMoss : semantic.xenoGround;
  const h = 0.12 + (variant % 3) * 0.04;
  b.tube([0, 0, 0], [0.01, h * 0.5, 0.005], 0.009, 5, stalk, 0.012);
  b.tube([0.01, h * 0.5, 0.005], [-0.005, h, 0], 0.007, 5, stalk, 0.009);
  b.add(geo.sphere(0.035 + (variant % 2) * 0.01, 6, 4), head, { p: [-0.005, h + 0.025, 0], s: [1, 1.15, 1] });
  b.add(geo.sphere(0.012, 5, 4), semantic.alienCrystal, { p: [0.02, h + 0.035, 0.022] });
  return b.build();
}

/** Spiralwedel / spiral frond */
export function spiralFrond(): THREE.BufferGeometry {
  const b = new Builder();
  let prev: [number, number, number] = [0, 0, 0];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const a = t * Math.PI * 1.6;
    const p: [number, number, number] = [Math.sin(a) * 0.04 * t, t * 0.16, (1 - Math.cos(a)) * 0.03 * t];
    b.tube(prev, p, 0.008 * (1 - t * 0.6), 4, semantic.alienMoss, 0.008 * (1 - (t - 0.2) * 0.6));
    prev = p;
  }
  b.add(geo.torus(0.022, 0.006, 4, 10), semantic.xenoGround, { p: [prev[0], prev[1] + 0.01, prev[2]], r: [1.2, 0, 0] });
  return b.build();
}

/** Schwebender Fels mit kleinen Pflanzen obenauf / floating rock with small plants on top */
export function floatingIsle(): THREE.BufferGeometry {
  const b = new Builder();
  b.add(geo.cyl(0.07, 0.055, 0.03, 7), semantic.alienMoss, { p: [0, 0.0, 0] });
  b.add(geo.cone(0.058, 0.13, 7), semantic.alienRock, { p: [0, -0.08, 0], r: [Math.PI, 0, 0] });
  b.add(geo.dodeca(0.03), semantic.alienRockDark, { p: [0.03, -0.05, 0.02] });
  b.add(geo.cyl(0.004, 0.005, 0.05, 4), semantic.alienMoss, { p: [-0.02, 0.04, 0] });
  b.add(geo.sphere(0.014, 5, 4), semantic.xenoGround, { p: [-0.02, 0.068, 0] });
  b.add(geo.cone(0.012, 0.05, 4), semantic.alienCrystal, { p: [0.025, 0.035, -0.01], r: [0.2, 0, -0.2] });
  return b.build();
}

/** Saeule der Verdan, heil oder abgebrochen / Verdan column, whole or broken */
export function column(broken: boolean): THREE.BufferGeometry {
  const b = new Builder();
  const h = broken ? 0.09 : 0.2;
  b.add(geo.box(0.05, 0.016, 0.05), semantic.verdanStoneDark, { p: [0, 0.008, 0] });
  b.add(geo.cyl(0.017, 0.02, h, 7), semantic.verdanStone, { p: [0, 0.016 + h / 2, 0] });
  if (broken) b.add(geo.cone(0.018, 0.035, 7), semantic.verdanStone, { p: [0.004, 0.016 + h + 0.012, 0], r: [0.4, 0, 0.3] });
  else b.add(geo.box(0.048, 0.014, 0.048), semantic.verdanStoneDark, { p: [0, 0.016 + h + 0.007, 0] });
  return b.build();
}

/** Rippenbogen eines riesigen Skeletts (Ursprung am Boden, entlang x) / rib arc of a giant skeleton (origin on the ground, along x) */
export function ribcage(): THREE.BufferGeometry {
  const b = new Builder();
  const bone = semantic.alienBone;
  b.tube([-0.26, 0.03, 0], [0.26, 0.05, 0], 0.016, 6, bone, 0.012);
  for (let i = 0; i < 6; i++) {
    const x = -0.2 + i * 0.075;
    const h = 0.18 - Math.abs(i - 2.5) * 0.025;
    for (const s of [-1, 1]) {
      let prev: [number, number, number] = [x, 0.045, 0];
      for (let k = 1; k <= 4; k++) {
        const a = (k / 4) * Math.PI * 0.55;
        const p: [number, number, number] = [x + k * 0.004, 0.045 + Math.sin(a) * h * 0.55 - (k === 4 ? 0.02 : 0), s * (1 - Math.cos(a)) * h * 0.65];
        b.tube(prev, p, 0.008 - k * 0.0012, 4, bone);
        prev = p;
      }
    }
  }
  return b.build();
}

/** Halb versunkene Statue mit Fluegelschild / half-buried statue with a winged shield */
export function statue(): THREE.BufferGeometry {
  const b = new Builder();
  const st = mix(semantic.verdanStone, semantic.marsSandLight, 0.25);
  b.group({ r: [0.25, 0, 0.18] }, () => {
    b.add(geo.taper(0.07, 0.04, 0.09, 0.05, 0.12, 0), st, { p: [0, 0.04, 0] });
    b.add(geo.box(0.04, 0.045, 0.04), st, { p: [0, 0.125, 0] });
    b.add(geo.box(0.05, 0.012, 0.045), semantic.verdanStoneDark, { p: [0, 0.155, 0] });
    // Schild mit Wappen / shield with emblem
    b.add(geo.cyl(0.032, 0.032, 0.01, 10), semantic.verdanRed, { p: [0.0, 0.065, 0.028], r: [Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) b.add(geo.box(0.045, 0.01, 0.006), semantic.verdanWhite, { p: [s * 0.04, 0.072, 0.03], r: [0, 0, s * 0.45] });
  });
  b.add(geo.cyl(0.07, 0.08, 0.02, 8), semantic.marsSand, { p: [0, 0.0, 0] });
  return b.build();
}
