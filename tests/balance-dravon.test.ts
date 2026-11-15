/**
 * Balance-Messung Dravon (nur mit BALANCE=1, langsam): Siegquote Dravons in KI-Partien mit 3 bis 5 Fraktionen.
 * Balance measurement Dravon (only with BALANCE=1, slow): Dravon's win share in AI games with 3 to 5 factions.
 * BALANCE_FROM / BALANCE_TO waehlen den Seed-Bereich / pick the seed range.
 */
import { describe, it } from 'vitest';
import { applyCommand, createGame, defaultConfig, type GameState } from '../src/core';
import { AI, FACTION_IDS, type FactionId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const on = env.BALANCE === '1';

/** Fraktionen einer Partie: Dravon plus n-1 andere, deterministisch aus dem Seed / factions of a game: Dravon plus n-1 others, deterministic from the seed */
export function lineup(seed: number): FactionId[] {
  const n = 3 + (seed % 3);
  const pool = FACTION_IDS.filter((f) => f !== 'dravon');
  let h = Math.imul(seed, 2654435761) >>> 0;
  const out: FactionId[] = [];
  while (out.length < n - 1) { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  out.splice(seed % n, 0, 'dravon');
  return out;
}

function play(s: GameState): number {
  let fails = 0;
  while (!s.over && s.round <= 60) {
    const f = s.current;
    for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
      const cmd = planNextCommand(s, f);
      const res = applyCommand(s, cmd);
      if (!res.ok) fails++;
      if (cmd.type === 'endTurn' && res.ok) break;
    }
  }
  return fails;
}

describe.skipIf(!on)('Balance Dravon', () => {
  it('misst die Siegquote / measures the win share', () => {
    const from = Number(env.BALANCE_FROM ?? 1), to = Number(env.BALANCE_TO ?? 40);
    let games = 0, wins = 0, expected = 0, fails = 0, built = 0, fired = 0;
    const lines: string[] = [];
    for (let seed = from; seed <= to; seed++) {
      const ids = lineup(seed);
      const s = createGame(defaultConfig({
        seed, size: ids.length >= 5 ? 16 : 14, mapType: seed % 2 ? 'continents' : 'continent', mode: 'points',
        factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' })),
      }));
      // Zaehler ueber alle Ereignisse (das Protokoll ist gekuerzt) / counters over all events (the log is truncated)
      const orig = s.log.push.bind(s.log);
      let g = 0, fi = 0;
      s.log.push = (...e: GameState['log']) => {
        for (const x of e) { const k = (x as { t: string }).t; if (k === 'emplacement') g++; else if (k === 'turretFire' && (x as { owner?: number }).owner !== undefined) fi++; }
        return orig(...e);
      };
      fails += play(s);
      const d = ids.indexOf('dravon');
      built += g; fired += fi;
      games++; expected += 1 / ids.length;
      if (s.winner === d) wins++;
      lines.push(`${seed} ${ids.join(',')} winner=${s.winner === null ? '-' : ids[s.winner]} ${s.victory?.kind ?? ''} guns=${g} shots=${fi}`);
    }
    console.log(lines.join('\n'));
    console.log(`RESULT games=${games} dravonWins=${wins} expected=${expected.toFixed(2)} fails=${fails} emplacements=${built} shots=${fired}`);
  }, 3_600_000);
});
