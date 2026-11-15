/**
 * Sendetuerme der Kampagne je Welt: Erde = Gittermast mit Schuessel, rotem Licht und Generatorhuette; Alienwelt =
 * gerippte, organische Zyrr-Antenne mit violetter Kugel; Wueste = verwitterter Verdan-Signalmast mit Fluegelwappen.
 * Besetzt: Ring und Wimpel in der Fraktionsfarbe. Lichter in Leuchtfarben (KEYS in atmosphere.ts).
 * Campaign transmitter towers per world: Earth = lattice mast with a dish, red light and generator hut; alien world =
 * ribbed, organic Zyrr antenna with a violet orb; desert = weathered Verdan signal mast with the winged emblem.
 * Occupied: ring and pennant in the faction colour. Lights in glow colours (KEYS in atmosphere.ts).
 * Kachel 1x1, Ursprung unten mittig / tile 1x1, origin bottom centre.
 */
import type * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { factionTokens, semantic } from '../../design/tokens';
import { Builder, col, geo, memo, mix, shade } from './kit';
import { mat } from './look';
import { verdanEmblem } from './cavern';

const S = semantic;
export type TowerWorld = 'earth' | 'alien' | 'desert';

/** Fraktionsmarke am Fuss / faction marker at the foot */
function marker(b: Builder, faction: FactionId | null) {
  if (!faction) return;
  const c = col(factionTokens[faction].primary);
  b.add(geo.torus(0.34, 0.018, 4, 18), c, { p: [0, 0.015, 0], r: [Math.PI / 2, 0, 0] });
  b.add(geo.cyl(0.008, 0.01, 0.36, 5), mat.metal, { p: [0.28, 0.18, 0.2] });
  b.add(geo.box(0.12, 0.08, 0.008), c, { p: [0.34, 0.31, 0.2] });
}

/** Sendeturm einer Welt, besetzt von faction (null = frei) / transmitter tower of a world, held by faction (null = free) */
export function towerGeometry(world: TowerWorld, faction: FactionId | null): THREE.BufferGeometry {
  return memo(`tower|${world}|${faction}`, () => {
    const b = new Builder();
    if (world === 'earth') {
      // Betonsockel und Generatorhuette / concrete plinth and generator hut
      b.add(geo.cbox(0.5, 0.05, 0.5, 0.06), mat.concreteDark, { p: [0, 0.025, 0] });
      b.add(geo.box(0.2, 0.14, 0.16), mat.concrete, { p: [-0.2, 0.12, 0.16] });
      b.add(geo.box(0.22, 0.03, 0.18), mat.darkMid, { p: [-0.2, 0.2, 0.16] });
      b.add(geo.box(0.05, 0.04, 0.01), mat.window, { p: [-0.2, 0.13, 0.245] });
      // Gittermast: vier Beine und Querstreben / lattice mast: four legs and cross braces
      const h = 0.95;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.tube([sx * 0.13, 0.05, sz * 0.13], [sx * 0.025, 0.05 + h, sz * 0.025], 0.009, 4, mat.metal);
      for (let i = 1; i < 6; i++) {
        const y = 0.05 + (h * i) / 6, w = 0.13 - (0.105 * i) / 6;
        for (const r of [0, Math.PI / 2]) b.add(geo.box(w * 2, 0.008, 0.008), mat.metalLight, { p: [0, y, 0], r: [0, r, 0] });
        b.add(geo.box(w * 2.2, 0.006, 0.006), mat.metal, { p: [0, y - h / 12, w], r: [0, 0, i % 2 ? 0.5 : -0.5] });
      }
      // Schuessel und Antennen / dish and antennas
      b.add(geo.hemi(0.1, 10, 3), mat.paper, { p: [0.04, 0.05 + h * 0.62, 0.06], r: [-1.1, 0.4, 0] });
      b.add(geo.cyl(0.004, 0.004, 0.2, 4), mat.metal, { p: [0, 0.15 + h, 0] });
      // rotes Warnlicht an der Spitze und auf halber Hoehe / red warning light at the top and halfway up
      b.add(geo.sphere(0.025, 8, 6), S.verdanEye, { p: [0, 0.26 + h, 0] });
      b.add(geo.sphere(0.018, 6, 4), S.verdanEye, { p: [0.06, 0.05 + h * 0.5, 0.06] });
    } else if (world === 'alien') {
      // gerippte Spire aus Chitin, oben eine pulsierende Kugel / ribbed chitin spire with a pulsing orb on top
      const rock = col(S.alienRock), dark = col(S.alienRockDark), ground = col(S.alienGround);
      b.add(geo.hemi(0.3, 10, 4), ground, { p: [0, 0, 0], s: [1, 0.35, 1] });
      for (let i = 0; i < 9; i++) {
        const y = 0.06 + i * 0.1, r = 0.12 - i * 0.011;
        b.add(geo.torus(r, 0.022 - i * 0.0015, 4, 10), i % 2 ? rock : dark, { p: [Math.sin(i * 0.7) * 0.02, y, 0], r: [Math.PI / 2, 0, 0] });
      }
      b.tube([0, 0.05, 0], [0.02, 0.95, 0], 0.06, 7, dark, 0.02);
      for (let i = 0; i < 3; i++) b.tube([0, 0.4 + i * 0.15, 0], [Math.cos(i * 2.1) * 0.18, 0.55 + i * 0.15, Math.sin(i * 2.1) * 0.18], 0.012, 4, rock, 0.004);
      b.add(geo.sphere(0.08, 12, 8), mat.xenoGlow, { p: [0.02, 1.02, 0] });
      b.add(geo.torus(0.1, 0.01, 4, 14), mat.acid, { p: [0.02, 1.02, 0], r: [1.2, 0, 0] });
    } else {
      // verwitterter Verdan-Signalmast / weathered Verdan signal mast
      const stone = mix(S.verdanStone, S.desertSandLight, 0.35), dark = mix(S.verdanStoneDark, S.desertRockDark, 0.3);
      b.add(geo.cbox(0.5, 0.06, 0.5, 0.1), dark, { p: [0, 0.03, 0] });
      b.add(geo.ctaper(0.26, 0.26, 0.18, 0.18, 0.36, 0.05), stone, { p: [0, 0.24, 0] });
      b.add(geo.cyl(0.03, 0.04, 0.6, 6), S.verdanMetal, { p: [0, 0.72, 0] });
      for (let i = 0; i < 3; i++) b.add(geo.box(0.22 - i * 0.05, 0.012, 0.012), shade(S.verdanMetal, 1.15), { p: [0, 0.6 + i * 0.14, 0], r: [0, i * 0.7, 0] });
      b.group({ p: [0, 0.32, 0.135] }, () => verdanEmblem(b, 1.8));
      // rot-weisse Baender und das Auge an der Spitze / red and white bands and the eye at the top
      b.add(geo.cyl(0.042, 0.042, 0.03, 6), S.verdanRed, { p: [0, 0.5, 0] });
      b.add(geo.cyl(0.04, 0.04, 0.03, 6), S.verdanWhite, { p: [0, 0.53, 0] });
      b.add(geo.sphere(0.035, 8, 6), S.verdanEye, { p: [0, 1.04, 0] });
      b.add(geo.dodeca(0.05), dark, { p: [0.2, 0.06, -0.18] });
      b.add(geo.sphere(1, 8, 4), S.desertSandLight, { p: [-0.2, 0.05, 0.2], s: [0.14, 0.04, 0.1] });
    }
    marker(b, faction);
    return b.build();
  });
}
