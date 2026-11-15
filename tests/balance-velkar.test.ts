/**
 * Balance-Messung Velkar (nur mit BALANCE=1, langsam): Siegquote Velkars in KI-Partien (Punktemodus, 3 bis 5 Fraktionen),
 * dazu wie oft Tesla-Panzer, Railgun-Schuetzen und Oktokopter gebaut werden und angreifen.
 * Balance measurement Velkar (only with BALANCE=1, slow): Velkar's win share in AI games (points mode, 3 to 5 factions),
 * plus how often Tesla tanks, railgun marksmen and octocopters are built and attack.
 * BALANCE_FROM / BALANCE_TO waehlen den Seed-Bereich / pick the seed range.
 */
import { describe, it } from 'vitest';
import { applyCommand, createGame, defaultConfig } from '../src/core';
import { AI, FACTION_IDS, type FactionId, type UnitTypeId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const on = env.BALANCE === '1';
/** Node-Modul fuer die Ergebnisdatei (ohne Node-Typen) / Node module for the result file (without Node types) */
const NODE_FS: string = 'node:fs';

/** Fraktionen einer Partie: Velkar plus n-1 andere, deterministisch aus dem Seed / factions of a game: Velkar plus n-1 others, deterministic from the seed */
export function lineup(seed: number): FactionId[] {
  const n = 3 + (seed % 3);
  const pool = FACTION_IDS.filter((f) => f !== 'velkar');
  let h = Math.imul(seed, 2654435761) >>> 0;
  const out: FactionId[] = [];
  while (out.length < n - 1) { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  out.splice(seed % n, 0, 'velkar');
  return out;
}

const WATCH = ['tank', 'heli', 'sniper', 'teslaTank', 'octocopter', 'railSniper'];

describe.skipIf(!on)('Balance Velkar', () => {
  it('misst die Siegquote / measures the win share', async () => {
    const from = Number(env.BALANCE_FROM ?? 1), to = Number(env.BALANCE_TO ?? 40);
    let games = 0, wins = 0, expected = 0, fails = 0;
    const attacks: Record<string, number> = {};
    const lines: string[] = [];
    for (let seed = from; seed <= to; seed++) {
      const ids = lineup(seed);
      const s = createGame(defaultConfig({
        seed, size: ids.length >= 5 ? 16 : 14, mapType: seed % 2 ? 'continents' : 'continent', mode: 'points',
        factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' })),
      }));
      const v = ids.indexOf('velkar');
      const seen = new Map<number, UnitTypeId>();
      while (!s.over && s.round <= 60) {
        const f = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          const att = cmd.type === 'attack' ? s.units.find((u) => u.id === cmd.unit) : undefined;
          const res = applyCommand(s, cmd);
          if (!res.ok) fails++;
          if (att && res.ok && att.owner === v && WATCH.includes(att.type)) attacks[att.type] = (attacks[att.type] ?? 0) + 1;
          if (cmd.type === 'endTurn' && res.ok) break;
        }
        for (const u of s.units) if (u.owner === v && WATCH.includes(u.type)) seen.set(u.id, u.type);
      }
      const built: Record<string, number> = {};
      for (const t of seen.values()) built[t] = (built[t] ?? 0) + 1;
      games++; expected += 1 / ids.length;
      if (s.winner === v) wins++;
      lines.push(`${seed} ${ids.join(',')} winner=${s.winner === null ? '-' : ids[s.winner]} ${s.victory?.kind ?? ''} ${JSON.stringify(built)}`);
    }
    const out = `${lines.join('\n')}\nRESULT games=${games} velkarWins=${wins} expected=${expected.toFixed(2)} fails=${fails} attacks=${JSON.stringify(attacks)}\n`;
    console.log(out);
    // BALANCE_OUT: Ergebnis zusaetzlich in eine Datei schreiben / also write the result to a file
    if (env.BALANCE_OUT) (await import(NODE_FS)).writeFileSync(env.BALANCE_OUT, out);
  }, 7_200_000);
});
