/**
 * Natuerliche Landschaft der Standardwelt: Saeume, Strand, Sandbank, Bodenton und Wiesen-Varianten sind deterministisch
 * und verraten nichts ueber Felder unter dem Kriegsnebel.
 * Natural landscape of the default world: fringes, beach, sand shoal, ground tone and meadow variants are deterministic
 * and reveal nothing about tiles under the fog of war.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGame, defaultConfig, isExplored, type GameState, type Tile } from '../src/core';
import { Board } from '../src/render/board';
import { MAP_TYPES, type MapType } from '../src/data/balance';
import { semantic } from '../src/design/tokens';
import { BIOME_LIFT, MEADOW_VARIANTS, PEAK_LIFT, biomeDecoration, biomeTop, meadowVariant } from '../src/render/biomes';
import { TILE_TOP } from '../src/render/config';
import { NATURAL, beachCoast, buildLandscape, groundTone, growthRank, type LandInput } from '../src/render/landscape';
import { SHOAL, buildWater, setWaterTheme, waterMaterial } from '../src/render/water';
import { fringeGeometry, decorationGeometry } from '../src/render/models';

const water = (t: Tile) => t.terrain === 'shallow' || t.terrain === 'ocean';
const top = (t: Tile) => TILE_TOP[t.terrain] + (t.biome && !water(t) ? BIOME_LIFT[t.biome] : 0) + (t.terrain === 'mountain' ? PEAK_LIFT[t.peak ?? 2] : 0);
const topColor = (t: Tile) => (water(t) ? null : biomeTop(t.terrain, t.biome)?.top ?? (t.terrain === 'forest' ? semantic.terrainForest : t.terrain === 'mountain' ? semantic.terrainMountain : semantic.terrainPlain));

function game(mapType: MapType, seed: number): GameState {
  return createGame(defaultConfig({ seed, size: 16, mapType, mode: 'conquest', factions: [{ id: 'korvat', human: true, difficulty: 'normal' }, { id: 'dravon', human: false, difficulty: 'normal' }] }));
}
function input(s: GameState, explored: (x: number, y: number) => boolean, segments: number = NATURAL.segments.high): LandInput {
  return {
    size: s.size, tiles: s.tiles, explored, top, topColor,
    natural: { seed: s.config.seed, segments, rank: growthRank, tone: (x, y) => groundTone(x, y, s.config.seed), meadow: (t) => t.terrain === 'plain' && !t.resource },
  };
}
const arr = (g: THREE.BufferGeometry | null, name: string) => (g ? Array.from(g.getAttribute(name).array as Float32Array) : []);
/** linke Kartenhaelfte erkundet / left half of the map explored */
const leftHalf = (s: GameState) => (x: number, _y: number) => x < s.size / 2;

describe('Kriegsnebel / fog of war', () => {
  it('Saeume und Felsen haengen nur von erkundeten Feldern ab / fringes and rocks depend on explored tiles only', () => {
    for (const mapType of Object.keys(MAP_TYPES) as MapType[]) {
      const s = game(mapType, 11), explored = leftHalf(s);
      const a = buildLandscape(input(s, explored));
      // alles Unerkundete umkrempeln: Land wird Wasser, Wasser wird Wald / turn everything unexplored upside down: land becomes water, water becomes forest
      const t2 = s.tiles.map((t, k) => (explored(k % s.size, Math.floor(k / s.size)) ? t : { ...t, terrain: water(t) ? 'forest' as const : 'ocean' as const, biome: 'jungle' as const }));
      const b = buildLandscape({ ...input(s, explored), tiles: t2 });
      expect(arr(a.strips, 'position').length, mapType).toBeGreaterThan(0);
      expect(arr(b.strips, 'position'), mapType).toEqual(arr(a.strips, 'position'));
      expect(arr(b.strips, 'color'), mapType).toEqual(arr(a.strips, 'color'));
      expect(b.cliffs.map((c) => c.m.elements), mapType).toEqual(a.cliffs.map((c) => c.m.elements));
    }
  });

  it('Ufer und Sandbank haengen nur von erkundeten Feldern ab / shore and sand shoal depend on explored tiles only', () => {
    const s = game('islands', 23), explored = leftHalf(s);
    const sandy = (l: Tile, w: Tile) => beachCoast(l, top(l), top(w));
    const a = buildWater(s, explored, 5, sandy)!;
    const s2 = { ...s, tiles: s.tiles.map((t, k) => (explored(k % s.size, Math.floor(k / s.size)) ? t : { ...t, terrain: water(t) ? 'plain' as const : 'ocean' as const })) };
    const b = buildWater(s2, explored, 5, sandy)!;
    expect(arr(a.geometry, 'shoal').some((v) => v === 1)).toBe(true);
    expect(arr(b.geometry, 'shoal')).toEqual(arr(a.geometry, 'shoal'));
    // Tiefe, Uferabstand und Hoehe der Oberflaeche: nichts haengt vom Nebel ab / depth, shore distance and surface height: nothing depends on the fog
    expect(arr(b.geometry, 'water')).toEqual(arr(a.geometry, 'water'));
    expect(arr(b.geometry, 'position')).toEqual(arr(a.geometry, 'position'));
  });

  it('ein Feld am Nebelrand bekommt keinen Saum zur Nebelseite / a tile at the fog edge gets no fringe towards the fog', () => {
    const s = game('continents', 11), half = s.size / 2;
    const g = buildLandscape(input(s, leftHalf(s))).strips!;
    const pos = g.getAttribute('position');
    // kein Punkt jenseits der Kante der letzten erkundeten Spalte / no vertex beyond the edge of the last explored column
    const limit = half - 1 - (s.size - 1) / 2 + 0.49 + 1e-6;
    for (let i = 0; i < pos.count; i++) expect(pos.getX(i)).toBeLessThanOrEqual(limit);
  });
});

describe('Determinismus / determinism', () => {
  it('gleicher Seed, gleiche Landschaft / same seed, same landscape', () => {
    const s = game('continents', 11), all = () => true;
    const a = buildLandscape(input(s, all)), b = buildLandscape(input(s, all));
    expect(arr(b.strips, 'position')).toEqual(arr(a.strips, 'position'));
    expect(arr(b.strips, 'color')).toEqual(arr(a.strips, 'color'));
    expect(groundTone(3, 7, 11).getHex()).toBe(groundTone(3, 7, 11).getHex());
    expect(groundTone(3, 7, 11).getHex()).not.toBe(groundTone(3, 7, 12).getHex());
  });

  it('Bodenton bleibt dezent, Nachbarn unterscheiden sich wenig / ground tone stays subtle, neighbours differ little', () => {
    const T = NATURAL.tone, max = T.light + T.jitter + T.warm + 0.01;
    for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) {
      const c = groundTone(x, y, 4711), n = groundTone(x + 1, y, 4711);
      for (const v of [c.r, c.g, c.b]) { expect(v).toBeGreaterThan(1 - max * 1.1); expect(v).toBeLessThan(1 + max * 1.1); }
      expect(Math.abs(c.g - n.g)).toBeLessThan(0.08);
    }
  });
});

describe('Lesbarkeit / readability', () => {
  it('Saeume bleiben auf dem eigenen Feld und schmal / fringes stay on their own tile and narrow', () => {
    const s = game('continents', 11);
    const g = buildLandscape(input(s, () => true)).strips!;
    const pos = g.getAttribute('position'), off = (s.size - 1) / 2;
    const widest = Math.max(NATURAL.beach.min + NATURAL.beach.extra + NATURAL.beach.rim, NATURAL.spill.min + NATURAL.spill.extra + NATURAL.spill.rim, NATURAL.blend.min + NATURAL.blend.extra + NATURAL.blend.rim);
    // hoechstens ein gutes Viertel des Feldes je Kante / at most a good quarter of the tile per edge
    expect(widest).toBeLessThanOrEqual(0.26);
    for (let i = 0; i < pos.count; i += 3) {
      // alle drei Ecken eines Dreiecks liegen im selben Feld / all three corners of a triangle lie in the same tile
      const cx = Math.round((pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 + off), cz = Math.round((pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3 + off);
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(pos.getX(i + k) + off - cx)).toBeLessThanOrEqual(0.4901);
        expect(Math.abs(pos.getZ(i + k) + off - cz)).toBeLessThanOrEqual(0.4901);
      }
    }
  });

  it('Wald greift in die Wiese, nie umgekehrt; Strand nur an flacher Kueste / forest reaches into plains, never the reverse; beach on flat coasts only', () => {
    const plain = { terrain: 'plain', biome: 'grassland' } as Tile, forest = { terrain: 'forest', biome: 'grassland' } as Tile;
    const desert = { terrain: 'plain', biome: 'desert' } as Tile, shallow = { terrain: 'shallow' } as Tile, ocean = { terrain: 'ocean' } as Tile;
    expect(growthRank(forest)).toBeGreaterThan(growthRank(plain));
    expect(growthRank(plain)).toBeGreaterThan(growthRank(desert));
    expect(beachCoast(plain, top(plain), top(shallow))).toBe(true);
    expect(beachCoast(plain, top(plain), top(ocean))).toBe(false);
    expect(beachCoast({ terrain: 'mountain' } as Tile, 0.12, top(shallow))).toBe(false);
    expect(beachCoast({ terrain: 'forest', biome: 'jungle' } as Tile, 0.01, top(shallow))).toBe(false);
  });

  it('Wiesen-Deko und Waldsaum bleiben niedriger als der Wald / meadow decoration and forest fringe stay lower than the forest', () => {
    const height = (g: THREE.BufferGeometry | null) => { if (!g) return 0; g.computeBoundingBox(); return g.boundingBox!.max.y; };
    const tris = (g: THREE.BufferGeometry | null) => (g ? (g.index ? g.index.count : g.getAttribute('position').count) / 3 : 0);
    const forest = Math.max(...[0, 1, 2, 3].map((v) => height(decorationGeometry('forest', null, v))));
    const forestTris = Math.min(...[0, 1, 2, 3].map((v) => tris(decorationGeometry('forest', null, v))));
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(meadowVariant(i / 400));
    for (const v of seen) {
      expect(v).toBeLessThan(MEADOW_VARIANTS);
      const g = biomeDecoration('plain', 'grassland', v);
      // die neuen Sorten (ab 8) sind hoechstens halb so hoch wie der Wald / the new kinds (from 8 on) are at most half as tall as the forest
      if (v >= 8) expect(height(g), `variant ${v}`).toBeLessThan(forest * 0.5);
      expect(tris(g), `variant ${v}`).toBeLessThan(420);
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
    for (let v = 0; v < NATURAL.fringe.variants; v++) {
      const g = fringeGeometry(v);
      expect(height(g)).toBeLessThan(forest * 0.6);
      // ein Saumbaum ist deutlich kleiner als das kleinste Waldfeld / one fringe tree is clearly smaller than the smallest forest tile
      expect(tris(g)).toBeLessThan(forestTris * 0.8);
    }
  });
});

describe('Sandbank / sand shoal', () => {
  it('nur in der Standardwelt / in the default world only', () => {
    const m = waterMaterial();
    setWaterTheme('cavern'); expect(m.uniforms.uShoal.value).toBe(0);
    setWaterTheme('desert'); expect(m.uniforms.uShoal.value).toBe(0);
    setWaterTheme(null); expect(m.uniforms.uShoal.value).toBe(1);
    expect(waterMaterial(true).uniforms.uShoal.value).toBe(0);
    // schmaler als die erste Zelle des Wassergitters, damit die Brandung im Feld bleibt / narrower than the first cell of the water grid so the surf stays inside the tile
    expect(SHOAL.width + SHOAL.swing + SHOAL.lap).toBeLessThanOrEqual(0.2);
  });
});

describe('ganzes Brett / whole board', () => {
  /** Abdruck der statischen Ebene: jede Geometrie mit ihren Instanzen und Farben / fingerprint of the static layer: every geometry with its instances and colours */
  const fingerprint = (b: Board): string[] => {
    const out: string[] = [];
    const r = (a: ArrayLike<number>) => Array.from(a, (v) => Math.round(v * 1e4)).join(',');
    (b as unknown as { staticLayer: THREE.Group }).staticLayer.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.geometry) return;
      const pos = m.geometry.getAttribute('position');
      if (m.isInstancedMesh) {
        const rows: string[] = [];
        for (let i = 0; i < m.count; i++) rows.push(`${r(m.instanceMatrix.array.slice(i * 16, i * 16 + 16))}|${m.instanceColor ? r(m.instanceColor.array.slice(i * 3, i * 3 + 3)) : ''}`);
        out.push(`${m.geometry.name}#${pos.count}#${rows.sort().join(';')}`);
      } else out.push(`${pos.count}#${r(pos.array)}#${['color', 'water', 'shoal'].map((n) => (m.geometry.getAttribute(n) ? r(m.geometry.getAttribute(n).array) : '')).join('#')}`);
    });
    return out.sort();
  };
  const build = (s: GameState, quality: 'low' | 'high') => {
    const b = new Board();
    b.showLabels = false; b.animations = false; b.quality = quality;
    b.rebuild(s, 0);
    return fingerprint(b);
  };

  it('nichts auf dem Brett haengt vom Gelaende unter dem Nebel ab / nothing on the board depends on the terrain under the fog', () => {
    const turn = { plain: 'ocean', ocean: 'forest', forest: 'mountain', mountain: 'shallow', shallow: 'plain' } as const;
    for (const mapType of ['continents', 'islands'] as MapType[]) {
      const s = game(mapType, 11);
      const hidden = s.tiles.map((_, k) => !isExplored(s, 0, k % s.size, Math.floor(k / s.size)));
      expect(hidden.filter(Boolean).length, mapType).toBeGreaterThan(50);
      expect(hidden.filter((h) => !h).length, mapType).toBeGreaterThan(8);
      // unter dem Nebel alles umkrempeln: Gelaende, Landschaft, Fluesse, Ressourcen / turn everything under the fog upside down: terrain, biome, rivers, resources
      const s2: GameState = { ...s, tiles: s.tiles.map((t, k) => (hidden[k] ? { ...t, terrain: turn[t.terrain], biome: t.biome === 'desert' ? 'grassland' as const : 'desert' as const, river: !t.river, resource: null, peak: 3 } : t)) };
      for (const q of ['high', 'low'] as const) expect(build(s2, q), `${mapType} ${q}`).toEqual(build(s, q));
    }
  });

  it('niedrige Qualitaet: weder Waldsaum noch neue Wiesen-Sorten / low quality: neither forest fringe nor new meadow kinds', () => {
    const s = game('continent', 23);
    s.factions[0].explored = s.tiles.map(() => 1);
    const names = (q: 'low' | 'high') => build(s, q).map((row) => row.split('#')[0]);
    expect(names('high').some((n) => n.startsWith('deco|forest|fringe'))).toBe(true);
    expect(names('low').some((n) => n.startsWith('deco|forest|fringe'))).toBe(false);
  });
});
