import { describe, expect, it } from 'vitest';
import { createGame, defaultConfig, neighbors, buildCheck } from '../src/core';
import { MAPGEN, type MapType } from '../src/data/balance';
import type { GameState } from '../src/core';

const isLand = (s: GameState, k: number) => s.tiles[k].terrain !== 'shallow' && s.tiles[k].terrain !== 'ocean';
function mass(s: GameState, x: number, y: number): number {
  const start = y * s.size + x;
  const seen = new Set([start]); const stack = [start];
  while (stack.length) {
    const k = stack.pop()!;
    for (const p of neighbors(s.size, k % s.size, Math.floor(k / s.size))) {
      const q = p.y * s.size + p.x;
      if (isLand(s, q) && !seen.has(q)) { seen.add(q); stack.push(q); }
    }
  }
  return seen.size;
}

describe('Startinseln / start islands', () => {
  for (const mapType of ['islands', 'waterworld', 'continents'] as MapType[]) {
    it(`${mapType}: keine Mini-Insel und auf Inseln ein Hafenplatz / no tiny island and a harbour site on islands`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        for (const size of [11, 14, 18] as const) {
          const s = createGame(defaultConfig({ seed, size, mapType, factions: [
            { id: 'korvat', human: true, difficulty: 'normal' }, { id: 'dravon', human: false, difficulty: 'normal' },
            { id: 'alvenia', human: false, difficulty: 'normal' }, { id: 'meridon', human: false, difficulty: 'normal' }] }));
          for (const c of s.cities.filter((cc) => cc.isHQ)) {
            const m = mass(s, c.x, c.y);
            expect(m, `seed ${seed} size ${size} hq ${c.x},${c.y}`).toBeGreaterThanOrEqual(MAPGEN.minStartIsland - 1);
            if (m < MAPGEN.coastalStartBelow) {
              const owner = c.owner!;
              s.factions[owner].techs.push('coastalEconomy');
              const harbour = neighbors(s.size, c.x, c.y).some((p) => { const r = buildCheck(s, owner, 'navalBase', p.x, p.y); return r.ok || r.error === 'notEnoughStars'; });
              expect(harbour, `seed ${seed} size ${size} hq ${c.x},${c.y} mass ${m}`).toBe(true);
            }
          }
        }
      }
    }, 120000);
  }
});
