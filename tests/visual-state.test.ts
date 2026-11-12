import { describe, expect, it } from 'vitest';
import { createGame, defaultConfig } from '../src/core';
import { TRACKS } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, ok, revealAll, tile, untilTurnOf } from './helpers';

describe('Kettenspuren / track marks', () => {
  it('ein Panzer hinterlaesst Spuren auf Start- und Zielfeld, die nach einigen Runden verschwinden / a tank leaves marks that fade', () => {
    const s = blankGame({ stars: 0 });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 10, 10, 1, { hq: true });
    revealAll(s, 0);
    const tank = addUnit(s, 'tank', 0, 5, 5);
    ok(s, { type: 'move', unit: tank.id, to: { x: 6, y: 5 } });
    expect(tile(s, 5, 5).tracks).toHaveLength(1);
    expect(tile(s, 6, 5).tracks![0].a).toBeCloseTo(Math.PI / 2);
    const inf = addUnit(s, 'infantry', 0, 3, 3);
    ok(s, { type: 'move', unit: inf.id, to: { x: 3, y: 4 } });
    expect(tile(s, 3, 4).tracks ?? []).toHaveLength(0);
    for (let i = 0; i < TRACKS.keepRounds; i++) { endTurn(s); untilTurnOf(s, 0); }
    const t2 = s.units.find((u) => u.id === tank.id)!;
    ok(s, { type: 'move', unit: t2.id, to: { x: 5, y: 5 } });
    expect(tile(s, 5, 5).tracks).toHaveLength(1);
  });
});

describe('Berghoehen / mountain heights', () => {
  it('jeder Berg hat Hoehe 1 bis 3, alle Hoehen kommen vor / every mountain has height 1-3', () => {
    const seen = new Set<number>();
    for (const seed of [3, 5, 9]) {
      const s = createGame(defaultConfig({ seed, size: 18, mapType: 'continent', factions: [{ id: 'velkar', human: false, difficulty: 'normal' }, { id: 'dravon', human: false, difficulty: 'normal' }] }));
      for (const t of s.tiles) if (t.terrain === 'mountain') { expect([1, 2, 3]).toContain(t.peak); seen.add(t.peak!); }
    }
    expect(seen.size).toBe(3);
  });
});
