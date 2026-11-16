import { describe, expect, it } from 'vitest';
import { createGame, defaultConfig, dist, generateMap, hqOf, cityTiles, area } from '../src/core';
import { FACTION_IDS, MAPGEN, MAP_SIZES, type FactionId, type MapType, type ResourceId, type TerrainId } from '../src/data/balance';

const FAIR_MIN: Record<number, number[]> = { 11: [7, 6, 5, 4], 14: [8, 7, 6, 4], 16: [10, 9, 7, 5], 18: [12, 11, 8, 6], 22: [14, 13, 10, 8], 26: [17, 15, 12, 9] };
const TYPES: MapType[] = ['continent', 'lakes', 'continents', 'islands', 'waterworld'];
const landShare = (tiles: { terrain: TerrainId }[]) => tiles.filter((t) => t.terrain !== 'shallow' && t.terrain !== 'ocean').length / tiles.length;

describe('Kartengenerator / map generator', () => {
  it('sizes 11x11 to 26x26', () => {
    expect(MAP_SIZES).toEqual([11, 14, 16, 18, 22, 26]);
    for (const size of MAP_SIZES) {
      const s = createGame(defaultConfig({ seed: 3, size }));
      expect(s.size).toBe(size);
      expect(s.tiles).toHaveLength(size * size);
    }
  });

  it('five map types with decreasing land share', () => {
    const avg = TYPES.map((type) => {
      let sum = 0;
      for (let seed = 1; seed <= 12; seed++) sum += landShare(generateMap(seed, 18, type, ['korvat', 'dravon']).tiles);
      return sum / 12;
    });
    for (let i = 1; i < avg.length; i++) expect(avg[i]).toBeLessThan(avg[i - 1]);
    expect(avg[0]).toBeGreaterThan(0.7); // Festland / mainland
    expect(avg[4]).toBeLessThan(0.45); // Wasserwelt / water world
  });

  it('only the five terrain types; ocean never directly touches land', () => {
    for (const type of TYPES) {
      for (const size of MAP_SIZES) {
        const m = generateMap(size * 31, size, type, ['korvat', 'dravon', 'alvenia']);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const t = m.tiles[y * size + x];
          expect(['plain', 'forest', 'mountain', 'shallow', 'ocean']).toContain(t.terrain);
          if (t.terrain === 'ocean') {
            for (const p of area(size, x, y, 1)) {
              const o = m.tiles[p.y * size + p.x].terrain;
              expect(o === 'ocean' || o === 'shallow').toBe(true);
            }
          }
        }
      }
    }
  });

  it('resources only on fitting terrain (fish on shallow water, ore on mountains, ...)', () => {
    const fits: Record<ResourceId, TerrainId[]> = {
      supplies: ['plain', 'forest'], livestock: ['plain', 'forest'], fish: ['shallow'], farmland: ['plain'], ore: ['mountain'],
    };
    const seen = new Set<ResourceId>();
    for (let seed = 1; seed <= 10; seed++) {
      const m = generateMap(seed, 16, 'continents', FACTION_IDS);
      for (const t of m.tiles) if (t.resource) { expect(fits[t.resource]).toContain(t.terrain); seen.add(t.resource); }
    }
    expect([...seen].sort()).toEqual(['farmland', 'fish', 'livestock', 'ore', 'supplies']);
  });

  it('starts: HQ level 1 on a plain tile with 3x3 area; fair spacing between start points', () => {
    for (const size of MAP_SIZES) {
      for (const n of [2, 3, 4, 5]) {
        const factions = FACTION_IDS.slice(0, n).map((id) => ({ id, human: true, difficulty: 'normal' as const }));
        for (let seed = 0; seed < 15; seed++) {
        const s = createGame(defaultConfig({ seed: seed * 97 + size * 10 + n, size, factions }));
        const hqs = s.factions.map((f) => hqOf(s, f.index)!);
        for (const hq of hqs) {
          expect(s.tiles[hq.y * size + hq.x].terrain).toBe('plain');
          expect(hq.radius).toBe(1);
          expect(cityTiles(s, hq).length).toBe(9);
        }
        let minD = Infinity;
        for (let i = 0; i < hqs.length; i++) for (let j = i + 1; j < hqs.length; j++) minD = Math.min(minD, dist(hqs[i], hqs[j]));
        // faire Abstaende (Untergrenzen aus 300 Seeds je Kombination) / fair spacing (bounds from 300 seeds each)
        expect(minD).toBeGreaterThanOrEqual(FAIR_MIN[size][n - 2]);
        }
      }
    }
  });

  it('every tile belongs to at most one city and lies within that city area', () => {
    const s = createGame(defaultConfig({ seed: 17, size: 11, factions: FACTION_IDS.map((id) => ({ id, human: true, difficulty: 'normal' as const })) }));
    for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) {
      const t = s.tiles[y * s.size + x];
      if (t.territory === null) continue;
      const c = s.cities.find((o) => o.id === t.territory)!;
      expect(c).toBeDefined();
      expect(dist(c, { x, y })).toBeLessThanOrEqual(c.radius);
    }
    // eine Einheit je Feld / one unit per tile
    const keys = s.units.map((u) => `${u.x},${u.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('Siedlungen nie direkt am Kartenrand, mindestens 2 Felder Abstand / settlements never at the edge, at least 2 tiles away', () => {
    expect(MAPGEN.villageEdge).toBe(2);
    let count = 0;
    for (const type of TYPES) for (const size of MAP_SIZES) for (const seed of [1, 2, 3, 4]) {
      const m = generateMap(seed * 31 + size, size, type, ['korvat', 'dravon', 'alvenia', 'meridon']);
      m.villages.forEach((v, i) => {
        const edge = Math.min(v.x, v.y, size - 1 - v.x, size - 1 - v.y);
        // die ersten sind die Heimatsiedlungen (Ausnahme schmale Randinsel: 1 Feld) / the first ones are the home villages (exception narrow edge island: 1 tile)
        const min = i < m.starts.length ? MAPGEN.villageEdgeHome : MAPGEN.villageEdge;
        expect(edge, `${type} ${size} ${seed} ${v.x},${v.y}`).toBeGreaterThanOrEqual(min);
        expect(edge).toBeGreaterThanOrEqual(1);
      });
      count += m.villages.length;
    }
    expect(count).toBeGreaterThan(0);
  });

  it('Heimatsiedlung: erst alle Abstaende mit vollem Randabstand, dann gelockert / home village: all distances with the full edge margin first, then relaxed', () => {
    // Seed 126 (11x11, Festland): Die vierte Insel hat bei Abstand 2 und 3 kein Feld mit 2 Feldern Randabstand, wohl aber bei 4
    // seed 126 (11x11, continent): the fourth island has no tile with a 2-tile edge margin at distance 2 or 3, but one at 4
    const m = generateMap(126, 11, 'continent', ['korvat', 'dravon', 'alvenia', 'meridon']);
    for (const v of m.villages.slice(0, m.starts.length)) expect(Math.min(v.x, v.y, 10 - v.x, 10 - v.y), `${v.x},${v.y}`).toBeGreaterThanOrEqual(MAPGEN.villageEdge);
  });

  it('neutral settlements, abandoned bunkers and radar stations are placed', () => {
    for (const size of MAP_SIZES) {
      const s = createGame(defaultConfig({ seed: size, size }));
      const villages = s.cities.filter((c) => c.owner === null);
      expect(villages.length).toBeGreaterThanOrEqual(2);
      for (const v of villages) {
        expect(['plain', 'forest']).toContain(s.tiles[v.y * size + v.x].terrain);
        expect(v.level).toBe(1);
      }
      const cities = s.cities;
      for (let i = 0; i < cities.length; i++) for (let j = i + 1; j < cities.length; j++) expect(dist(cities[i], cities[j])).toBeGreaterThanOrEqual(2);
      expect(s.tiles.filter((t) => t.feature === 'bunker').length).toBeGreaterThanOrEqual(2);
      expect(s.tiles.filter((t) => t.feature === 'radar')).toHaveLength(4);
    }
  });

  it('home regions: every tile has a home faction, and the terrain follows the faction weights', () => {
    const count = (id: FactionId, terrain: TerrainId[]) => {
      let hit = 0, all = 0;
      for (let seed = 1; seed <= 15; seed++) {
        const m = generateMap(seed, 16, 'continent', id === 'korvat' ? ['korvat', 'velkar'] : ['velkar', 'korvat']);
        for (const t of m.tiles) {
          expect(t.home).not.toBeNull();
          if (t.home !== 0) continue;
          if (t.terrain === 'shallow' || t.terrain === 'ocean') continue;
          all++;
          if (terrain.includes(t.terrain)) hit++;
        }
      }
      return hit / all;
    };
    // Velkar: Gebirge und Wald, Korvat: weite Ebenen / Velkar: mountains & forest, Korvat: wide plains
    expect(count('velkar', ['mountain', 'forest'])).toBeGreaterThan(count('korvat', ['mountain', 'forest']) + 0.2);
    expect(count('korvat', ['plain'])).toBeGreaterThan(0.55);
  });

  it('the area around each start has resources (fair start)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = createGame(defaultConfig({ seed, size: 14 }));
      for (const f of s.factions) {
        const hq = hqOf(s, f.index)!;
        const res = area(s.size, hq.x, hq.y, 1).filter((p) => s.tiles[p.y * s.size + p.x].resource).length;
        expect(res).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('Landschaften und Fluesse / biomes and rivers', () => {
  it('jedes Landfeld hat eine Landschaft, Wasser nie; Fluesse nur an Land / every land tile has a biome, water never; rivers only on land', async () => {
    const { createGame, defaultConfig } = await import('../src/core');
    const { BIOMES } = await import('../src/data/balance');
    for (const seed of [1, 2, 3]) {
      const s = createGame(defaultConfig({ seed, size: 16, mapType: 'continents' }));
      for (const t of s.tiles) {
        const water = t.terrain === 'shallow' || t.terrain === 'ocean';
        if (water) { expect(t.biome).toBeUndefined(); expect(t.river).toBeFalsy(); }
        else expect(BIOMES).toContain(t.biome);
      }
      const used = new Set(s.tiles.map((t) => t.biome).filter(Boolean));
      expect(used.size).toBeGreaterThanOrEqual(3);
    }
  });
  it('Landschaften sind deterministisch / biomes are deterministic', async () => {
    const { createGame, defaultConfig } = await import('../src/core');
    const a = createGame(defaultConfig({ seed: 77, size: 14 })), b = createGame(defaultConfig({ seed: 77, size: 14 }));
    expect(a.tiles.map((t) => `${t.biome}${t.river}`)).toEqual(b.tiles.map((t) => `${t.biome}${t.river}`));
  });
});
