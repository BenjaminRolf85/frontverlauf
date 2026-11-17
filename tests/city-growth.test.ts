/**
 * Stadtwachstum je Stufe, weniger Siedlungen, Sendetuerme in freien Partien, schnellere Einheiten.
 * City growth per level, fewer settlements, transmitter towers in free games, faster units.
 */
import { describe, expect, it } from 'vitest';
import { generateMap } from '../src/core';
import { MAPGEN, MAP_SIZES, type FactionId, type MapType } from '../src/data/balance';

const FOUR: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon'];

describe('Weniger Siedlungen / fewer settlements', () => {
  it('30 % weniger neutrale Siedlungen, Heimatsiedlungen bleiben / 30 % fewer neutral settlements, home villages stay', () => {
    expect(MAPGEN.villageShare).toBe(0.7);
    for (const type of ['continent', 'lakes', 'continents'] as MapType[]) {
      let now = 0, before = 0;
      for (const size of MAP_SIZES) for (const seed of [1, 2, 3, 4]) {
        const m = generateMap(seed * 17 + size, size, type, FOUR);
        // vorher: alle platzierten Siedlungen bleiben / before: all placed settlements stay
        const share = MAPGEN.villageShare;
        MAPGEN.villageShare = 1;
        let o;
        try { o = generateMap(seed * 17 + size, size, type, FOUR); } finally { MAPGEN.villageShare = share; }
        // jede Startinsel hat ihre Heimatsiedlung, dieselbe wie vorher / every start island keeps its home village, the same as before
        expect(m.villages.length).toBeGreaterThanOrEqual(m.starts.length);
        expect(m.villages.slice(0, m.starts.length)).toEqual(o.villages.slice(0, m.starts.length));
        expect(m.villages.length).toBe(Math.max(m.starts.length, Math.round(o.villages.length * 0.7)));
        now += m.villages.length; before += o.villages.length;
      }
      // insgesamt etwa 30 % weniger (Heimatsiedlungen als Untergrenze) / about 30 % fewer in total (home villages as the floor)
      expect(now / before, type).toBeGreaterThan(0.65);
      expect(now / before, type).toBeLessThan(0.75);
    }
  });
});
