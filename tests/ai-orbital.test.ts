/**
 * KI mit dem Orbitallaser: Velkar baut das Relay und schiesst, ohne Fehlbefehle, ueber mehrere Seeds und Modi.
 * AI with the orbital laser: Velkar builds the relay and fires, without failed commands, over several seeds and modes.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, cityUpgradeCheck, createGame, defaultConfig, missionConfig, type GameState } from '../src/core';
import { AI, type FactionId, type GameMode, type MapSize } from '../src/data/balance';
import { aiDebug, planNextCommand } from '../src/ai/ai';

interface Run { fails: number; relay: boolean; shots: number; hits: number; ownHits: number }

function play(seed: number, mode: GameMode, ids: FactionId[], size: MapSize, rounds: number): Run {
  const s: GameState = createGame(defaultConfig({
    seed, size, mode, mapType: 'continent', roundLimit: mode === 'points' ? rounds : null,
    factions: ids.map((id) => ({ id, human: false, difficulty: 'hard' as const })),
  }));
  const v = ids.indexOf('velkar');
  const r: Run = { fails: 0, relay: false, shots: 0, hits: 0, ownHits: 0 };
  while (!s.over && s.round <= rounds) {
    const f = s.current;
    for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
      const cmd = planNextCommand(s, f);
      const res = applyCommand(s, cmd);
      if (!res.ok) r.fails++;
      for (const e of res.events) {
        if (e.t === 'cityUpgrade' && e.upgrade === 'satRelay' && e.faction === v) r.relay = true;
        if (e.t === 'orbitalStrike' && e.faction === v) {
          r.shots++;
          for (const h of e.hits) {
            const u = h.unit !== undefined ? s.units.find((x) => x.id === h.unit) : undefined;
            if (u?.owner === v) r.ownHits++; else r.hits++;
          }
        }
      }
      if (cmd.type === 'endTurn' && res.ok) break;
    }
  }
  return r;
}

describe('KI-Orbitallaser / AI orbital laser', () => {
  it('baut das Relay und feuert, ohne Fehlbefehle / builds the relay and fires, without failed commands', () => {
    const errors = aiDebug.errors;
    const runs: (Run & { seed: number; mode: GameMode })[] = [];
    const cases: [number, GameMode, FactionId[], MapSize][] = [
      [1, 'points', ['velkar', 'korvat', 'dravon'], 14],
      [2, 'conquest', ['korvat', 'velkar', 'alvenia', 'meridon'], 14],
      [3, 'points', ['dravon', 'meridon', 'velkar', 'zyrr', 'vesper'], 16],
      [4, 'conquest', ['velkar', 'nexus', 'korvat'], 14],
      [5, 'points', ['meridon', 'velkar', 'alvenia'], 14],
      [6, 'conquest', ['velkar', 'dravon', 'vesper', 'korvat'], 16],
    ];
    for (const [seed, mode, ids, size] of cases) runs.push({ seed, mode, ...play(seed, mode, ids, size, 45) });
    for (const r of runs) expect(r.fails, `seed ${r.seed} ${r.mode}`).toBe(0);
    expect(aiDebug.errors).toBe(errors);
    expect(runs.filter((r) => r.relay).length).toBeGreaterThanOrEqual(3);
    expect(runs.reduce((n, r) => n + r.shots, 0)).toBeGreaterThan(0);
    // trifft vor allem Feinde / hits mostly enemies
    const hits = runs.reduce((n, r) => n + r.hits, 0), own = runs.reduce((n, r) => n + r.ownHits, 0);
    expect(hits).toBeGreaterThan(own * 2);
  }, 240000);

  it('Kampagne als Velkar: m4 und m9 (Hoehle) laufen ohne Fehlbefehle; in der Hoehle kein Relay / campaign as Velkar: m4 and m9 (cavern) run without failed commands; no relay in the cavern', () => {
    const errors = aiDebug.errors;
    for (const id of ['m4', 'm9']) {
      const s = createGame(missionConfig(id, 'velkar'));
      s.factions[0].human = false;
      s.factions[0].techs.push('highAltitude');
      s.factions[0].stars += 100;
      let fails = 0, strikes = 0;
      while (!s.over && s.round <= 12) {
        const f = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          strikes += r.events.filter((e) => e.t === 'orbitalStrike').length;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
      expect(fails, id).toBe(0);
      // Nachschublinien der Hoehle haben keine Ausbau-Slots / the cavern's supply lines have no upgrade slots
      if (id === 'm9') {
        for (const c of s.cities.filter((x) => x.owner === 0)) expect(cityUpgradeCheck(s, 0, c, 'satRelay')).toBe('noSlot');
        expect(strikes).toBe(0);
      }
    }
    expect(aiDebug.errors).toBe(errors);
  }, 180000);
});
