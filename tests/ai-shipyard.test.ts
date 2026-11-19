/**
 * KI und Werft: Transportboote auf Insel- und Wasserkarten ohne Fehlbefehle (SHIPYARD).
 * AI and shipyard: transport boats on island and water maps without failed commands (SHIPYARD).
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, defaultConfig } from '../src/core';
import { AI, type FactionId, type MapSize, type MapType } from '../src/data/balance';
import { aiDebug, planNextCommand } from '../src/ai/ai';

interface Naval { fails: number; boats: number; boards: number; disembarks: number; worstMs: number }

function play(seed: number, size: MapSize, mapType: MapType, factions: FactionId[], rounds: number): Naval {
  const s = createGame(defaultConfig({ seed, size, mode: 'conquest', mapType, factionVictory: false,
    factions: factions.map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));
  const r: Naval = { fails: 0, boats: 0, boards: 0, disembarks: 0, worstMs: 0 };
  while (!s.over && s.round <= rounds) {
    const f = s.current;
    const t0 = performance.now();
    for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
      const cmd = planNextCommand(s, f);
      const res = applyCommand(s, cmd);
      if (!res.ok) r.fails++;
      // Transportboot der Werft: Landungsboot, bei Meridon der Nebelkutter / shipyard transport: landing boat, the Fog Cutter for Meridon
      if (res.ok && cmd.type === 'train' && (cmd.unitType === 'landingBoat' || cmd.unitType === 'fogCutter')) r.boats++;
      for (const e of res.events) {
        if (e.t === 'embark' && e.boat !== undefined) r.boards++;
        if (e.t === 'disembark') r.disembarks++;
      }
      if (cmd.type === 'endTurn' && res.ok) break;
    }
    r.worstMs = Math.max(r.worstMs, performance.now() - t0);
  }
  return r;
}

describe('KI und Werft / AI and shipyard', () => {
  // feste Seeds aus einer Stichprobe von 40 Insel- und Kontinentpartien, in denen die KI frueh Boote kauft
  // fixed seeds from a sample of 40 island and continents games in which the AI buys boats early
  it('buys transport boats, boards them and lands troops without failed commands', () => {
    const errors = aiDebug.errors;
    const games = [
      play(7006, 11, 'islands', ['nexus', 'dravon', 'velkar', 'zyrr'], 50),
      play(7001, 14, 'continents', ['vesper', 'korvat', 'meridon', 'nexus'], 50),
      play(7002, 14, 'waterworld', ['alvenia', 'meridon', 'korvat', 'dravon'], 40),
    ];
    for (const g of games) expect(g.fails).toBe(0);
    expect(aiDebug.errors).toBe(errors);
    // Insel- und Kontinentkarte: Boote gekauft, bestiegen, Truppen angelandet; die Wasserwelt nur fehlerfrei
    // island and continents map: boats bought, boarded, troops landed; the water world only without errors
    for (const g of games.slice(0, 2)) {
      expect(g.boats).toBeGreaterThan(0);
      expect(g.boards).toBeGreaterThan(0);
      expect(g.disembarks).toBeGreaterThan(0);
      // KI-Zug deutlich unter einer Sekunde / AI turn well under one second
      expect(g.worstMs).toBeLessThan(1000);
    }
  }, 120_000);
});
