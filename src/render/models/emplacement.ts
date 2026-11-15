/**
 * Geschuetzstellung (Festungsbau, Dravon): niedriger Betonbunker mit Schiessscharte und langem Rohr nach +z, Sandsackring,
 * Tarnnetz-Flecken und kleine Fraktionsflagge; Truemmer nach der Zerstoerung. Comic-Silhouette, gut lesbar von oben.
 * Gun emplacement (fortification, Dravon): low concrete bunker with an embrasure and a long barrel towards +z, sandbag ring,
 * camo net patches and a small faction flag; rubble after destruction. Comic silhouette, readable from above.
 * Ursprung unten mittig, Kachel 1x1, Blick +z / origin bottom centre, tile 1x1, facing +z.
 */
import type * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { flagPole, sandbag } from './architecture';
import { addEmblem } from './emblems';
import { Builder, geo, memo, mix, rng, shade } from './kit';
import { look, mat } from './look';

const TAU = Math.PI * 2;

/** Sandsackring mit Luecke hinten (Eingang) / sandbag ring with a gap at the back (entrance) */
function sandbagRing(b: Builder, r: number, n: number, gap: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    // Eingang hinten (-z) frei / entrance at the back (-z) left open
    if (Math.abs(Math.atan2(Math.cos(a), Math.sin(a)) - Math.PI) < gap || Math.abs(Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI) < gap) continue;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    sandbag(b, x, 0, z, -a + Math.PI / 2, 1.05);
    if (i % 2 === 0) sandbag(b, Math.cos(a + 0.17) * r, 0.045, Math.sin(a + 0.17) * r, -a - 0.17 + Math.PI / 2, 1);
  }
}

/** Stellung einer Fraktion (Farbe fuer Flagge und Streifen) / emplacement of a faction (colour for flag and stripes) */
export function emplacementGeometry(f: FactionId): THREE.BufferGeometry {
  return memo(`emplacement|${f}`, () => {
    const L = look(f);
    const b = new Builder();
    const R = rng(4711);
    // flache Erdaufschuettung / low earth berm
    b.add(geo.cyl(0.42, 0.46, 0.04, 12), shade(mat.sand, 0.72), { p: [0, 0.02, 0] });
    sandbagRing(b, 0.38, 16, 0.42);
    // Betonbunker: abgeschraegter Koerper in tarnfarbenem Beton, Dachplatte / concrete bunker: chamfered body in camo-tinted concrete, roof slab
    const concrete = mix(mat.concreteDark, L.primaryDark, 0.25), slab = mix(mat.concrete, L.primary, 0.2);
    b.add(geo.ctaper(0.46, 0.4, 0.36, 0.3, 0.17, 0.035), concrete, { p: [0, 0.125, -0.02] });
    b.add(geo.cbox(0.4, 0.04, 0.34, 0.015), slab, { p: [0, 0.23, -0.02] });
    // Schalungsfugen und Abplatzer / formwork joints and chips
    for (let i = 0; i < 4; i++) b.add(geo.dodeca(0.014 + R() * 0.01), mat.concreteDark, { p: [(R() - 0.5) * 0.36, 0.18 + R() * 0.03, 0.17 + R() * 0.004], r: [R(), R(), R()] });
    // Tarnflecken auf dem Dach in Fraktionsfarbe / camo patches on the roof in faction colour
    b.add(geo.cyl(0.1, 0.11, 0.014, 7), L.primaryDark, { p: [-0.08, 0.256, -0.07], s: [1, 1, 0.8] });
    b.add(geo.cyl(0.07, 0.075, 0.014, 6), L.primary, { p: [0.1, 0.256, -0.13] });
    // Schiessscharte vorn mit dunkler Oeffnung / embrasure at the front with a dark opening
    b.box(0.26, 0.07, 0.03, mat.concreteDark, [0, 0.15, 0.165]);
    b.box(0.2, 0.04, 0.02, mat.ink, [0, 0.15, 0.178]);
    // Streifen in Fraktionsfarbe ueber der Scharte und am Dachrand / faction colour band above the embrasure and on the roof edge
    b.box(0.42, 0.018, 0.36, L.primary, [0, 0.222, -0.02]);
    b.box(0.3, 0.022, 0.012, L.secondary, [0, 0.198, 0.152]);
    // Geschuetz: Blende, langes Rohr mit Muendungsbremse / gun: mantlet, long barrel with muzzle brake
    b.group({ p: [0, 0.15, 0.17] }, () => {
      b.add(geo.cbox(0.11, 0.075, 0.05, 0.012), L.hullDark, { p: [0, -0.037, 0] });
      b.tube([0, 0, 0.02], [0, 0.012, 0.36], 0.026, 8, mat.gunmetal, 0.022);
      b.tube([0, 0.012, 0.36], [0, 0.013, 0.42], 0.034, 8, mat.dark);
      b.box(0.08, 0.016, 0.03, mat.dark, [0, 0.013, 0.395]);
    });
    // Sehschlitz-Kuppel und Antenne auf dem Dach / observation cupola and antenna on the roof
    b.add(geo.cyl(0.05, 0.055, 0.04, 8), mat.concrete, { p: [0.09, 0.27, 0.03] });
    b.add(geo.hemi(0.05, 8, 3), mat.concreteLight, { p: [0.09, 0.29, 0.03] });
    b.box(0.06, 0.008, 0.01, mat.ink, [0.09, 0.282, 0.078]);
    b.tube([-0.14, 0.25, -0.15], [-0.14, 0.44, -0.15], 0.004, 4, mat.dark);
    // Munitionskisten hinten / ammo crates at the back
    b.block(0.2, 0.04, -0.26, 0.08, 0.05, 0.06, mat.wood, 0.3);
    b.block(0.13, 0.04, -0.29, 0.06, 0.04, 0.05, mat.woodLight, -0.2);
    // kleine Fraktionsflagge mit Emblem auf dem Dach / small faction flag with emblem on the roof
    flagPole(b, f, -0.15, 0.25, -0.13, 0.34, 1.05);
    // Emblem auf der Front unter der Scharte / emblem on the front below the embrasure
    addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [0.15, 0.08, 0.2] });
    return b.build();
  });
}

/** Truemmer einer zerstoerten Stellung / rubble of a destroyed emplacement */
export function emplacementRuinGeometry(f: FactionId | null): THREE.BufferGeometry {
  return memo(`emplacementRuin|${f ?? 'neutral'}`, () => {
    const L = look(f);
    const b = new Builder();
    const R = rng(4712);
    b.add(geo.cyl(0.4, 0.45, 0.035, 11), shade(mat.sand, 0.6), { p: [0, 0.018, 0] });
    // aufgeplatzter Betonsockel und schiefe Dachplatte / burst concrete base and tilted roof slab
    b.add(geo.ctaper(0.44, 0.38, 0.38, 0.32, 0.08, 0.03), mat.concreteDark, { p: [0, 0.07, -0.02] });
    b.add(geo.cbox(0.3, 0.035, 0.26, 0.012), mat.concrete, { p: [0.05, 0.13, -0.04], r: [0.32, 0.4, -0.2] });
    for (let i = 0; i < 7; i++) {
      const a = R() * TAU, r = 0.16 + R() * 0.22, s = 0.03 + R() * 0.04;
      b.add(geo.dodeca(s), i % 3 ? mat.concrete : mat.concreteDark, { p: [Math.cos(a) * r, 0.04 + s * 0.4, Math.sin(a) * r], r: [R(), R(), R()] });
    }
    // verstreute Sandsaecke / scattered sandbags
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.5;
      sandbag(b, Math.cos(a) * 0.36, 0.0, Math.sin(a) * 0.36, R() * 3, 0.95);
    }
    // abgeknicktes Rohr / bent barrel
    b.tube([0.02, 0.07, 0.12], [0.1, 0.05, 0.3], 0.024, 7, mat.gunmetal, 0.02);
    b.tube([0.1, 0.05, 0.3], [0.2, 0.02, 0.36], 0.022, 7, mat.rustDark);
    // umgeknickter Fahnenmast mit zerrissener Flagge / toppled flag pole with a torn flag
    b.tube([-0.2, 0.03, -0.1], [-0.02, 0.06, -0.3], 0.006, 4, mat.metalLight);
    b.add(geo.profileXY([[0, 0], [0.08, -0.02], [0.03, -0.05], [0, -0.06]], 0.006), f ? L.primaryDark : mat.neutralDark, { p: [-0.05, 0.065, -0.26], r: [Math.PI / 2, 0, 0.6] });
    // Russflecken / soot patches
    b.add(geo.cyl(0.12, 0.13, 0.008, 7), mat.ink, { p: [0.12, 0.04, 0.12] });
    return b.build();
  });
}
