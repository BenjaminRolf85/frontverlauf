/**
 * Fanatiker-Tempel (Kampagne m4) und Kriegsplaene. Der Tempel deckt 2x2 Felder ab (Ursprung in der Mitte der Flaeche,
 * Boden y = 0, Eingang nach +z): Stufenpyramide aus dunklem Stein, Halle mit Knochensaeulen und Untergangssonne,
 * Glockenturm mit goldener Glocke, vier Feuerschalen (leuchten ueber die Farbschluessel templeFire*) und rote Banner.
 * Eine Geometrie je Detailstufe (verschmolzen), low = weniger Teile.
 * Die Kriegsplaene sind ein Lederkoecher mit Pergament und rotem Siegel: am Traeger schwebend oder am Boden liegend.
 * Fanatic temple (campaign m4) and war plans. The temple covers 2x2 tiles (origin at the centre of the footprint,
 * floor y = 0, entrance towards +z): stepped pyramid of dark stone, hall with bone columns and a doom sun, bell tower
 * with a golden bell, four braziers (glowing via the colour keys templeFire*) and red banners. One geometry per detail
 * level (merged), low = fewer parts.
 * The war plans are a leather case with parchment and a red seal: floating at the carrier or lying on the ground.
 */
import type * as THREE from 'three';
import { semantic } from '../../design/tokens';
import { addEmblem } from './emblems';
import { Builder, geo, memo, rng, shade } from './kit';
import { look, mat } from './look';

const HALF_PI = Math.PI / 2;
const stone = { dark: semantic.templeStoneDark, mid: semantic.templeStone, light: semantic.templeStoneLight };

/** Feuerschale auf Dreibein mit hoher Flamme / brazier on a tripod with a tall flame */
function brazier(b: Builder, x: number, y: number, z: number, s: number, low: boolean) {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    b.tube([x + Math.sin(a) * 0.05 * s, y, z + Math.cos(a) * 0.05 * s], [x + Math.sin(a) * 0.022 * s, y + 0.15 * s, z + Math.cos(a) * 0.022 * s], 0.007 * s, 4, mat.rustDark);
  }
  b.add(geo.cyl(0.08 * s, 0.04 * s, 0.05 * s, low ? 6 : 10), mat.rust, { p: [x, y + 0.17 * s, z] });
  b.add(geo.torus(0.078 * s, 0.01 * s, 3, low ? 6 : 10), mat.rustDark, { p: [x, y + 0.195 * s, z], r: [HALF_PI, 0, 0] });
  // Flamme aus drei verdrehten Zungen und hellem Kern / flame of three twisted tongues and a bright core
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(geo.cone(0.035 * s, (0.17 + (i % 2) * 0.05) * s, 5), semantic.templeFire, { p: [x + Math.sin(a) * 0.025 * s, y + (0.28 + (i % 2) * 0.02) * s, z + Math.cos(a) * 0.025 * s], r: [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25] });
  }
  b.add(geo.cone(0.045 * s, 0.12 * s, low ? 5 : 7), semantic.templeFireCore, { p: [x, y + 0.255 * s, z] });
  if (!low) for (let i = 0; i < 3; i++) b.add(geo.ico(0.013 * s, 0), semantic.templeFireCore, { p: [x + (i - 1) * 0.03 * s, y + (0.42 + i * 0.035) * s, z + (i % 2) * 0.02 * s] });
}

/** Banner am Mast mit Untergangssonne / banner on a pole with the doom sun */
function banner(b: Builder, x: number, z: number, h: number, red: THREE.Color | string, low: boolean) {
  b.tube([x, 0, z], [x, h, z], 0.016, 5, mat.wood);
  b.box(0.24, 0.016, 0.016, mat.wood, [x, h - 0.03, z]);
  b.add(geo.cone(0.024, 0.07, 5), mat.gold, { p: [x, h + 0.03, z] });
  // Tuch mit Zipfeln, Sonne in Glut / cloth with tails, sun in ember
  b.box(0.22, 0.42, 0.01, red, [x, h - 0.25, z]);
  b.add(geo.profileXY([[-0.11, 0], [0.11, 0], [0.11, -0.08], [0.045, -0.03], [0, -0.1], [-0.045, -0.03], [-0.11, -0.08]], 0.01), red, { p: [x, h - 0.46, z] });
  b.box(0.22, 0.02, 0.012, mat.gold, [x, h - 0.05, z]);
  addEmblem(b, 'vesper', 0.15, 0.008, mat.ember, { p: [x, h - 0.24, z + 0.008] });
  if (!low) addEmblem(b, 'vesper', 0.15, 0.008, mat.ember, { p: [x, h - 0.24, z - 0.008], r: [0, Math.PI, 0] });
}

function templeModel(low: boolean): Builder {
  const b = new Builder();
  const L = look('vesper');
  const red = L.primary;
  const R = rng(4404);
  // Stufenpyramide: drei Terrassen, Kanten heller / stepped pyramid: three terraces, lighter edges
  const tiers: [number, number, string][] = [[1.84, 0.12, stone.dark], [1.52, 0.15, stone.mid], [1.18, 0.15, stone.dark]];
  let y = 0;
  tiers.forEach(([w, h, c], i) => {
    b.add(geo.cbox(w, h, w, 0.04), c, { p: [0, y + h / 2, 0] });
    b.box(w + 0.01, 0.018, w + 0.01, i % 2 ? stone.light : stone.mid, [0, y + h - 0.008, 0]);
    y += h;
  });
  const top = y;
  // Treppe nach vorn (+z) ueber alle Terrassen / staircase to the front (+z) across all terraces
  for (let i = 0; i < 6; i++) b.box(0.42, top - i * (top / 6), 0.06, i % 2 ? stone.light : stone.mid, [0, (top - i * (top / 6)) / 2, 0.6 + i * 0.055]);
  b.box(0.06, top + 0.02, 0.42, stone.dark, [-0.24, (top + 0.02) / 2, 0.73]);
  b.box(0.06, top + 0.02, 0.42, stone.dark, [0.24, (top + 0.02) / 2, 0.73]);
  // Halle: dunkler Block, schraeges Dach, Knochensaeulen, Tor mit Glut / hall: dark block, sloped roof, bone columns, ember gate
  const hy = top;
  b.add(geo.cbox(0.82, 0.34, 0.66, 0.03), stone.mid, { p: [0.08, hy + 0.17, 0.02] });
  b.add(geo.taper(0.92, 0.76, 0.5, 0.36, 0.2), stone.dark, { p: [0.08, hy + 0.44, 0.02] });
  b.box(0.52, 0.035, 0.4, red, [0.08, hy + 0.555, 0.02]);
  b.box(0.94, 0.03, 0.78, red, [0.08, hy + 0.345, 0.02]);
  for (const sx of [-1, 1]) for (const k of [0, 1]) {
    const x = 0.08 + sx * (0.12 + k * 0.17);
    b.cyl(0.03, 0.036, 0.34, low ? 6 : 8, mat.bone, [x, hy + 0.17, 0.39]);
    b.add(geo.cbox(0.08, 0.03, 0.08, 0.01), stone.light, { p: [x, hy + 0.355, 0.39] });
  }
  b.box(0.7, 0.05, 0.1, stone.light, [0.08, hy + 0.37, 0.39]);
  // Tor: dunkle Oeffnung mit Glutschein / gate: dark opening with an ember glow
  b.box(0.18, 0.24, 0.02, mat.ink, [0.08, hy + 0.12, 0.355]);
  b.box(0.12, 0.08, 0.022, semantic.templeFire, [0.08, hy + 0.04, 0.356]);
  // Untergangssonne ueber dem Tor / doom sun above the gate
  b.group({ p: [0.08, hy + 0.5, 0.36] }, () => {
    b.cyl(0.11, 0.11, 0.02, low ? 12 : 20, mat.ember, [0, 0, 0], [HALF_PI, 0, 0]);
    b.add(geo.torus(0.11, 0.012, 4, low ? 12 : 20), mat.rustDark, {});
    if (!low) {
      addEmblem(b, 'vesper', 0.1, 0.02, red, { p: [0, 0, 0.012] });
      for (let i = 0; i < 9; i++) {
        const a = -HALF_PI * 0.9 + (i / 8) * Math.PI * 0.9;
        b.box(0.014, 0.06, 0.008, mat.ember, [Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0], [0, 0, -a]);
      }
    }
  });
  // Glockenturm hinten links / bell tower at the back left
  const tx = -0.4, tz = -0.36, th = 0.85;
  b.add(geo.ctaper(0.34, 0.34, 0.28, 0.28, th, 0.03), stone.mid, { p: [tx, hy + th / 2, tz] });
  for (let i = 1; i < 3; i++) b.box(0.33 - i * 0.02, 0.025, 0.33 - i * 0.02, stone.light, [tx, hy + i * (th / 3), tz]);
  // offene Glockenstube: vier Pfeiler, Glocke, Joch / open belfry: four piers, bell, yoke
  const by = hy + th;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.04, 0.3, 0.04, stone.dark, [tx + sx * 0.13, by + 0.15, tz + sz * 0.13]);
  b.box(0.32, 0.025, 0.04, mat.wood, [tx, by + 0.27, tz]);
  // grosse goldene Glocke, gut sichtbar zwischen den Pfeilern / big golden bell, well visible between the piers
  b.add(geo.hemi(0.105, low ? 8 : 14, 3), mat.gold, { p: [tx, by + 0.255, tz], r: [Math.PI, 0, 0], s: [1, 1.55, 1] });
  b.add(geo.torus(0.105, 0.014, 4, low ? 10 : 16), shade(mat.gold, 0.8), { p: [tx, by + 0.095, tz], r: [HALF_PI, 0, 0] });
  b.add(geo.sphere(0.026, 6, 4), mat.gunmetal, { p: [tx, by + 0.07, tz] });
  b.add(geo.cbox(0.36, 0.03, 0.36, 0.02), stone.light, { p: [tx, by + 0.315, tz] });
  b.add(geo.cone(0.25, 0.42, 4), stone.dark, { p: [tx, by + 0.54, tz], r: [0, Math.PI / 4, 0] });
  b.add(geo.cone(0.025, 0.2, 5), mat.gold, { p: [tx, by + 0.84, tz] });
  // Glutfenster im Turm / ember windows in the tower
  for (const [dx, dz] of [[0, 0.171], [0.171, 0]] as [number, number][]) b.box(dz ? 0.07 : 0.012, 0.14, dz ? 0.012 : 0.07, semantic.templeFire, [tx + dx, hy + th * 0.55, tz + dz]);
  // Feuerschalen an den Ecken der zweiten Terrasse / braziers on the corners of the second terrace
  const c2 = 0.66, b2 = tiers[0][1] + tiers[1][1];
  for (const [x, z] of [[c2, c2], [-c2, c2], [c2, -c2], [-c2, -c2]] as [number, number][]) brazier(b, x, b2, z, 1.25, low);
  // Feuerschalen an der Treppe / braziers at the stairs
  for (const sx of [-1, 1]) brazier(b, sx * 0.24, top + 0.02, 0.56, 0.9, low);
  // rote Banner vorn, an den Ecken der unteren Terrasse / red banners at the front corners of the lower terrace
  for (const sx of [-1, 1]) banner(b, sx * 0.84, 0.84, 1.15, red, low);
  if (!low) {
    // Banner hinten rechts und Knochen, Kerzen, Ketten / banner at the back right, bones, candles, chains
    banner(b, 0.84, -0.84, 1.0, red, low);
    for (let i = 0; i < 10; i++) {
      const a = R() * Math.PI * 2, r = 0.62 + R() * 0.2;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (Math.abs(x) < 0.3 && z > 0.4) continue;
      b.cyl(0.009, 0.01, 0.03 + R() * 0.04, 5, mat.bone, [x, tiers[0][1] + 0.025, z]);
      b.add(geo.cone(0.007, 0.018, 4), semantic.templeFireCore, { p: [x, tiers[0][1] + 0.07 + R() * 0.02, z] });
    }
    for (const sx of [-1, 1]) b.add(geo.sphere(0.035, 6, 4), mat.bone, { p: [0.08 + sx * 0.3, hy + 0.06, 0.45] });
  }
  return b;
}

/** Geometrie des Tempels (gecacht je Detailstufe) / temple geometry (cached per detail level) */
export function templeGeometry(low: boolean): THREE.BufferGeometry {
  return memo(`temple|${low ? 'low' : 'high'}`, () => templeModel(low).build());
}

/** Koecher mit Pergament und Siegel, entlang x / case with parchment and seal, along x */
function plansCase(b: Builder, low: boolean) {
  const seg = low ? 6 : 10;
  b.add(geo.cyl(0.042, 0.042, 0.26, seg), semantic.plansCase, { r: [0, 0, HALF_PI] });
  for (const sx of [-1, 1]) {
    b.add(geo.cyl(0.048, 0.048, 0.03, seg), mat.gold, { p: [sx * 0.13, 0, 0], r: [0, 0, HALF_PI] });
    b.add(geo.cyl(0.046, 0.046, 0.014, seg), shade(semantic.plansCase, 0.7), { p: [sx * 0.04, 0, 0], r: [0, 0, HALF_PI] });
  }
  // Pergamentrolle schaut heraus, rotes Siegel mit Band / parchment roll sticks out, red seal with ribbon
  b.add(geo.cyl(0.03, 0.03, 0.06, seg), semantic.plansParchment, { p: [0.17, 0, 0], r: [0, 0, HALF_PI] });
  b.add(geo.cyl(0.024, 0.024, 0.012, seg), look('vesper').primary, { p: [0, 0, 0.044], r: [HALF_PI, 0, 0] });
  b.box(0.012, 0.05, 0.03, look('vesper').primary, [0.01, -0.035, 0.04]);
}

/**
 * Kriegsplaene am Traeger: schraeg schwebender Koecher (Einheitenmarke) / war plans at the carrier: a tilted floating case (unit marker).
 * Kriegsplaene am Boden: liegender Koecher, ausgerolltes Blatt / war plans on the ground: lying case, unrolled sheet.
 */
export function plansGeometry(kind: 'carried' | 'dropped', low: boolean): THREE.BufferGeometry {
  return memo(`plans|${kind}|${low ? 'low' : 'high'}`, () => {
    const b = new Builder();
    if (kind === 'carried') {
      b.group({ r: [0.15, 0.6, 0.35], s: 1.6 }, () => plansCase(b, low));
    } else {
      b.box(0.3, 0.006, 0.22, semantic.plansParchment, [0.06, 0.004, 0.05], [0, 0.3, 0]);
      for (let i = 0; i < 4; i++) b.box(0.2, 0.004, 0.012, shade(semantic.plansParchment, 0.6), [0.06, 0.009, -0.01 + i * 0.04], [0, 0.3, 0]);
      b.box(0.05, 0.008, 0.05, look('vesper').primary, [0.14, 0.01, 0.1], [0, 0.3, 0]);
      b.group({ p: [-0.06, 0.045, -0.1], r: [0, -0.5, 0], s: 1.2 }, () => plansCase(b, low));
    }
    return b.build();
  });
}
