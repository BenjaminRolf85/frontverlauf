import { describe, it, expect } from 'vitest';
import { createGame, defaultConfig, applyCommand, score, reachable, ownUnits } from '../src/core';

describe('smoke', () => {
  it('creates and plays rounds', () => {
    const s = createGame(defaultConfig({ seed: 7, size: 11, mapType: 'continent' }));
    expect(s.cities.length).toBeGreaterThan(2);
    const u = ownUnits(s, 0)[0];
    const r = reachable(s, u);
    expect(r.length).toBeGreaterThan(0);
    const res = applyCommand(s, { type: 'move', unit: u.id, to: r[0] });
    expect(res.ok).toBe(true);
    for (let i = 0; i < 10; i++) expect(applyCommand(s, { type: 'endTurn' }).ok).toBe(true);
    expect(s.round).toBe(6);
    expect(score(s, 0)).toBeGreaterThan(0);
  });
});
