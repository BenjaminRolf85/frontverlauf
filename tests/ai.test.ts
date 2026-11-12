import { describe, it, expect } from 'vitest';
import { applyCommand, createGame, defaultConfig, type GameConfig, type GameState } from '../src/core';
import { AI, type Difficulty, type FactionId, type GameMode, type MapSize, type MapType } from '../src/data/balance';
import { aiDebug, planNextCommand, playAiTurn } from '../src/ai/ai';

const IDS: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'];

function config(o: {
  seed: number; size: MapSize; mode: GameMode; mapType?: MapType; diffs?: Difficulty[]; n?: number;
  startStars?: number; roundLimit?: number | null;
}): GameConfig {
  const n = o.n ?? 4;
  const diffs = o.diffs ?? ['normal'];
  return defaultConfig({
    seed: o.seed, size: o.size, mode: o.mode, mapType: o.mapType ?? 'continent',
    factions: IDS.slice(0, n).map((id, i) => ({ id, human: false, difficulty: diffs[i % diffs.length] })),
    startStars: o.startStars, roundLimit: o.roundLimit,
  });
}

interface Stats { fails: number; crashes: number; maxTurnMs: number; helis: number; commands: number }

/** Spielt Befehl fuer Befehl wie die Oberflaeche / plays command by command like the UI */
function run(s: GameState, maxRounds: number): Stats {
  const st: Stats = { fails: 0, crashes: 0, maxTurnMs: 0, helis: 0, commands: 0 };
  const helis = new Set<number>();
  while (!s.over && s.round <= maxRounds) {
    const f = s.current;
    const t0 = performance.now();
    let ended = false;
    for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
      const cmd = planNextCommand(s, f);
      const res = applyCommand(s, cmd);
      st.commands++;
      if (!res.ok) st.fails++;
      for (const e of res.events) if (e.t === 'crash') st.crashes++;
      if (cmd.type === 'endTurn' && res.ok) { ended = true; break; }
    }
    st.maxTurnMs = Math.max(st.maxTurnMs, performance.now() - t0);
    expect(ended || s.over).toBe(true);
    for (const u of s.units) if (u.type === 'heli') helis.add(u.id);
  }
  st.helis = helis.size;
  return st;
}

describe('KI / AI', () => {
  it('spielt ein Punktespiel (4 KI, 14x14, 30 Runden) ohne Fehlbefehle / plays a points game without failed commands', () => {
    const errors = aiDebug.errors;
    const s = createGame(config({ seed: 1, size: 14, mode: 'points', mapType: 'continents' }));
    const st = run(s, 99);
    expect(s.over).toBe(true);
    expect(s.round).toBe(31);
    expect(s.winner).not.toBeNull();
    expect(st.fails).toBe(0);
    expect(aiDebug.errors).toBe(errors);
    // die KI waechst / the AI grows
    for (const fa of s.factions) expect(fa.techs.length).toBeGreaterThan(3);
    expect(s.cities.filter((c) => c.owner === null).length).toBeLessThan(4);
  }, 120_000);

  it('beendet Eroberungsspiele (4 KI, 11x11) mit Sieger / finishes conquest games with a winner', () => {
    const rounds: number[] = [];
    for (const [seed, mapType] of [[4, 'continent'], [6, 'continent'], [8, 'continent'], [4, 'lakes']] as const) {
      const s = createGame(config({ seed, size: 11, mode: 'conquest', mapType }));
      const st = run(s, 150);
      expect(st.fails).toBe(0);
      expect(s.over).toBe(true);
      expect(s.winner).not.toBeNull();
      expect(s.factions.filter((f) => f.alive).length).toBe(1);
      rounds.push(s.round);
    }
    for (const r of rounds) expect(r).toBeLessThan(150);
  }, 120_000);

  it('ist deterministisch / is deterministic', () => {
    const play = () => {
      const s = createGame(config({ seed: 3, size: 11, mode: 'points', mapType: 'lakes', diffs: ['easy', 'normal', 'hard', 'extreme'] }));
      const cmds: string[] = [];
      while (!s.over) cmds.push(...playAiTurn(s).map((c) => JSON.stringify(c)));
      return { state: JSON.stringify(s), cmds: cmds.join('|') };
    };
    const a = play(), b = play();
    expect(a.cmds).toBe(b.cmds);
    expect(a.state).toBe(b.state);
  }, 120_000);

  it('bleibt pro Zug unter 2 Sekunden (18x18, 5 Fraktionen) / stays under 2 s per turn', () => {
    const s = createGame(config({ seed: 5, size: 18, mode: 'points', mapType: 'continents', n: 5, diffs: ['extreme', 'hard'], roundLimit: 25 }));
    let max = 0;
    while (!s.over) {
      const t0 = performance.now();
      const cmds = playAiTurn(s);
      max = Math.max(max, performance.now() - t0);
      expect(cmds[cmds.length - 1]?.type === 'endTurn' || s.over).toBe(true);
      expect(cmds.length).toBeLessThanOrEqual(AI.maxCommandsPerTurn + 1);
    }
    expect(max).toBeLessThan(AI.maxMillis);
  }, 120_000);

  it('spielt alle vier Schwierigkeitsgrade fehlerfrei / plays all four difficulty levels without errors', () => {
    const errors = aiDebug.errors;
    for (const d of ['easy', 'normal', 'hard', 'extreme'] as Difficulty[]) {
      const s = createGame(config({ seed: 11, size: 11, mode: 'points', mapType: 'lakes', diffs: [d], roundLimit: 20 }));
      const st = run(s, 99);
      expect(st.fails).toBe(0);
      expect(s.over).toBe(true);
    }
    expect(aiDebug.errors).toBe(errors);
  }, 120_000);

  it('laesst Hubschrauber nicht abstuerzen / never lets helicopters crash', () => {
    let crashes = 0, helis = 0;
    for (const seed of [2, 9]) {
      // viele Startsterne, damit frueh Hubschrauber entstehen / many start stars so helicopters appear early
      const s = createGame(config({ seed, size: 14, mode: 'sandbox', mapType: 'continents', startStars: 200, roundLimit: 45, diffs: ['hard', 'extreme'] }));
      const st = run(s, 99);
      expect(st.fails).toBe(0);
      crashes += st.crashes;
      helis += st.helis;
    }
    expect(helis).toBeGreaterThan(0);
    expect(crashes).toBe(0);
  }, 120_000);

  it('spielt neben Menschen und nur im eigenen Zug / plays alongside humans and only on its own turn', () => {
    const c = config({ seed: 7, size: 11, mode: 'points' });
    c.factions[0].human = true;
    c.roundLimit = 10;
    const s = createGame(c);
    expect(planNextCommand(s, 1)).toEqual({ type: 'endTurn' }); // nicht am Zug / not its turn
    while (!s.over) {
      if (s.factions[s.current].human) {
        // Mensch: Belohnungen waehlen, dann Zug beenden / human: pick rewards, then end turn
        for (const p of s.pendingRewards.slice()) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
        expect(applyCommand(s, { type: 'endTurn' }).ok).toBe(true);
      } else {
        const f = s.current;
        const cmds = playAiTurn(s);
        expect(cmds.length).toBeGreaterThan(0);
        expect(s.current !== f || s.over).toBe(true);
      }
    }
    expect(s.over).toBe(true);
  }, 120_000);
});
