import { describe, expect, it } from 'vitest';
import {
  applyCommand, attackTargets, cloneState, createGame, defaultConfig, generateMap, hashSeed, ownCities, reachable, replay,
  trainCheck, type Command, type GameConfig, type GameState,
} from '../src/core';
import { FACTION_IDS } from '../src/data/balance';

/** Einfache deterministische Spielweise fuer Tests / simple deterministic play for tests */
function playTurn(s: GameState, log: Command[]) {
  const f = s.current;
  const exec = (c: Command) => { const r = applyCommand(s, c); if (r.ok) log.push(c); return r.ok; };
  for (const p of s.pendingRewards.filter((p) => s.cities.find((c) => c.id === p.cityId)?.owner === f)) {
    exec({ type: 'reward', city: p.cityId, choice: (p.level + s.round) % 2 ? 'a' : 'b' });
  }
  for (const u of s.units.filter((o) => o.owner === f).map((o) => o.id)) {
    const me = s.units.find((o) => o.id === u);
    if (!me) continue;
    if (exec({ type: 'capture', unit: u })) continue;
    const t = attackTargets(s, me)[0];
    if (t) { exec({ type: 'attack', unit: u, target: t.id }); continue; }
    const r = reachable(s, me);
    if (r.length) exec({ type: 'move', unit: u, to: { x: r[(s.round * 7 + u) % r.length].x, y: r[(s.round * 7 + u) % r.length].y } });
  }
  for (const c of ownCities(s, f)) if (trainCheck(s, c, 'infantry') === 'ok') exec({ type: 'train', city: c.id, unitType: 'infantry' });
  if (s.factions[f].stars > 60) exec({ type: 'research', tech: s.factions[f].techs.includes('motorization') ? 'roadbuilding' : 'motorization' });
  exec({ type: 'endTurn' });
}

function play(config: GameConfig, turns: number) {
  const s = createGame(config);
  const log: Command[] = [];
  for (let i = 0; i < turns && !s.over; i++) playTurn(s, log);
  return { s, log };
}

describe('Determinismus / determinism', () => {
  it('same seed => same map (all sizes and types)', () => {
    for (const size of [11, 14, 16, 18] as const) {
      for (const type of ['continent', 'lakes', 'continents', 'islands', 'waterworld'] as const) {
        const a = generateMap(777, size, type, ['korvat', 'dravon', 'velkar']);
        const b = generateMap(777, size, type, ['korvat', 'dravon', 'velkar']);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
    const c = defaultConfig({ seed: 4242 });
    expect(JSON.stringify(createGame(c))).toBe(JSON.stringify(createGame(c)));
  });

  it('different seeds => different maps', () => {
    const a = createGame(defaultConfig({ seed: 1 }));
    const b = createGame(defaultConfig({ seed: 2 }));
    expect(JSON.stringify(a.tiles)).not.toBe(JSON.stringify(b.tiles));
  });

  it('text seeds are hashed deterministically', () => {
    expect(hashSeed('Frontverlauf')).toBe(hashSeed('Frontverlauf'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });

  it('same command sequence => same state (replay)', () => {
    const config = defaultConfig({
      seed: 99, size: 14, mapType: 'continent',
      factions: FACTION_IDS.slice(0, 3).map((id) => ({ id, human: true, difficulty: 'normal' as const })),
    });
    const { s, log } = play(config, 60);
    expect(log.length).toBeGreaterThan(60);
    const r = replay(config, log);
    expect(JSON.stringify(r)).toBe(JSON.stringify(s));
    // Kommandos sind serialisierbar / commands are serialisable
    const r2 = replay(JSON.parse(JSON.stringify(config)), JSON.parse(JSON.stringify(log)));
    expect(JSON.stringify(r2)).toBe(JSON.stringify(s));
  });

  it('state is plain JSON: clone and continue gives the same result', () => {
    const config = defaultConfig({ seed: 5, size: 11 });
    const { s } = play(config, 10);
    const c = cloneState(s);
    expect(c).toEqual(s);
    const l1: Command[] = [], l2: Command[] = [];
    for (let i = 0; i < 10; i++) { playTurn(s, l1); playTurn(c, l2); }
    expect(l1).toEqual(l2);
    expect(JSON.stringify(c)).toBe(JSON.stringify(s));
  });

  it('invalid commands do not change the state', () => {
    const s = createGame(defaultConfig({ seed: 8 }));
    const before = JSON.stringify(s);
    expect(applyCommand(s, { type: 'move', unit: 9999, to: { x: 0, y: 0 } }).ok).toBe(false);
    expect(applyCommand(s, { type: 'research', tech: 'logistics' }).ok).toBe(false);
    expect(applyCommand(s, { type: 'build', building: 'farm', x: 0, y: 0 }).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
});
