import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, defaultConfig, score, aliveFactions } from '../src/core';
import { MODES } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok } from './helpers';

describe('Punktemodus / points mode', () => {
  it('default config: points mode with 30 rounds', () => {
    expect(MODES.pointsRounds).toBe(30);
    const c = defaultConfig();
    expect(c.mode).toBe('points');
    expect(c.roundLimit).toBe(30);
  });

  it('a full game ends after 30 rounds, highest score wins', () => {
    const s = createGame(defaultConfig({ seed: 21, size: 11 }));
    let turns = 0;
    while (!s.over) {
      expect(s.round).toBeLessThanOrEqual(30);
      const r = applyCommand(s, { type: 'endTurn' });
      if (!r.ok) {
        // offene Belohnungen waehlen / choose pending rewards
        const p = s.pendingRewards[0];
        applyCommand(s, { type: 'reward', city: p.cityId, choice: 'b' });
        continue;
      }
      turns++;
    }
    expect(turns).toBe(60);
    expect(s.round).toBe(31);
    const scores = s.factions.map((f) => score(s, f.index));
    expect(s.winner).toBe(scores.indexOf(Math.max(...scores)));
    expect(s.log.some((e) => e.t === 'gameOver')).toBe(true);
    fails(s, { type: 'endTurn' }, 'gameOver');
  });

  it('the faction with the higher score wins', () => {
    const s = blankGame({ mode: 'points', roundLimit: 30 });
    addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 9, 9, 1, { hq: true, level: 5 });
    s.round = 30;
    endTurn(s);
    expect(s.over).toBe(false);
    endTurn(s);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(1);
  });
});

describe('Eroberung / conquest', () => {
  function cq() {
    const s = blankGame({ mode: 'conquest', factions: ['korvat', 'dravon', 'velkar'] });
    addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 9, 1, 1, { hq: true });
    addCity(s, 5, 9, 2, { hq: true });
    return s;
  }

  it('has no round limit', () => {
    expect(defaultConfig({ mode: 'conquest' }).roundLimit).toBeNull();
    const s = cq();
    s.round = 500;
    endTurn(s); endTurn(s); endTurn(s);
    expect(s.over).toBe(false);
  });

  it('a faction without cities is eliminated, the last one with a city wins', () => {
    const s = cq();
    const e2 = addUnit(s, 'infantry', 2, 7, 7);
    const a = addUnit(s, 'infantry', 0, 5, 9);
    const r = ok(s, { type: 'capture', unit: a.id });
    expect(r.events.some((e) => e.t === 'eliminated' && e.faction === 2)).toBe(true);
    expect(s.factions[2].alive).toBe(false);
    expect(s.units.find((u) => u.id === e2.id)).toBeUndefined();
    expect(aliveFactions(s)).toEqual([0, 1]);
    expect(s.over).toBe(false);
    // eliminierte Fraktionen werden uebersprungen / eliminated factions are skipped
    endTurn(s);
    expect(s.current).toBe(1);
    endTurn(s);
    expect(s.current).toBe(0);
    const b = addUnit(s, 'infantry', 0, 9, 1);
    ok(s, { type: 'capture', unit: b.id });
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
  });

  it('a faction with units but no city is eliminated; units alone do not keep it alive', () => {
    const s = cq();
    addUnit(s, 'tank', 2, 3, 3);
    const a = addUnit(s, 'infantry', 0, 5, 9);
    ok(s, { type: 'capture', unit: a.id });
    expect(s.factions[2].alive).toBe(false);
  });
});

describe('Sandkasten / sandbox', () => {
  it('map size, map type, number of opponents, difficulty and start stars are free', () => {
    const s = createGame(defaultConfig({
      mode: 'sandbox', size: 16, mapType: 'islands', startStars: 200,
      factions: [
        { id: 'velkar', human: true, difficulty: 'normal' },
        { id: 'korvat', human: false, difficulty: 'easy' },
        { id: 'meridon', human: false, difficulty: 'extreme' },
        { id: 'alvenia', human: false, difficulty: 'hard' },
      ],
    }));
    expect(s.size).toBe(16);
    expect(s.tiles).toHaveLength(256);
    expect(s.config.mapType).toBe('islands');
    expect(s.factions).toHaveLength(4);
    expect(s.factions.map((f) => f.difficulty)).toEqual(['normal', 'easy', 'extreme', 'hard']);
    expect(s.factions.every((f) => f.stars === 200)).toBe(true);
    expect(s.config.roundLimit).toBeNull();
  });
});
