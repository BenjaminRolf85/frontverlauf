/**
 * Zufallsereignisse: Zeitplan, Determinismus, jede Wirkung und volle KI-Partien.
 * Random events: schedule, determinism, every effect and full AI games.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, createGame, defaultConfig, effectiveMove, eventRounds, income, RANDOM_EVENTS, randomEventFor, triggerRandomEvent,
  type GameConfig, type GameEvent, type GameState, type RandomEventKind,
} from '../src/core';
import { processRandomEvents } from '../src/core/events';
import { aiDebug, planNextCommand } from '../src/ai/ai';
import { AI, TECHS } from '../src/data/balance';
import { addCity, addUnit, blankGame, tile, untilTurnOf } from './helpers';

type RE = Extract<GameEvent, { t: 'randomEvent' }>;
const only = (ev: GameEvent[]) => ev.filter((e): e is RE => e.t === 'randomEvent');

describe('Zeitplan / schedule', () => {
  it('etwa alle 6 bis 10 Runden, deterministisch aus dem Seed / roughly every 6 to 10 rounds, deterministic from the seed', () => {
    const kinds = new Set<RandomEventKind>();
    for (let seed = 1; seed <= 60; seed++) {
      const rounds = eventRounds(seed, 120);
      expect(rounds).toEqual(eventRounds(seed, 120));
      expect(rounds[0]).toBeGreaterThanOrEqual(RANDOM_EVENTS.firstMin);
      expect(rounds[0]).toBeLessThanOrEqual(RANDOM_EVENTS.firstMax);
      for (let i = 1; i < rounds.length; i++) {
        const gap = rounds[i] - rounds[i - 1];
        expect(gap).toBeGreaterThanOrEqual(RANDOM_EVENTS.gapMin);
        expect(gap).toBeLessThanOrEqual(RANDOM_EVENTS.gapMax);
      }
      for (let r = 1; r <= 40; r++) {
        const k = randomEventFor(seed, r);
        expect(k !== null).toBe(rounds.includes(r));
        expect(randomEventFor(seed, r)).toBe(k);
        if (k) kinds.add(k);
      }
    }
    // alle Arten kommen vor / every kind occurs
    expect([...kinds].sort()).toEqual(Object.keys(RANDOM_EVENTS.weights).sort());
    expect(eventRounds(1, 120)).not.toEqual(eventRounds(2, 120));
  });
});

describe('Wirkungen / effects', () => {
  it('Sturm: Einheiten im Gebiet fahren eine Runde nur 1 Feld / storm: units in the area move only 1 tile for a round', () => {
    const s = blankGame();
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    const a = addUnit(s, 'jeep', 0, 3, 3);
    addUnit(s, 'infantry', 0, 4, 4);
    const far = addUnit(s, 'tank', 1, 9, 8);
    const ev: GameEvent[] = [];
    expect(triggerRandomEvent(s, 'storm', ev)).toBe(true);
    const e = only(ev)[0];
    const hit = s.units.filter((u) => Math.max(Math.abs(u.x - e.x!), Math.abs(u.y - e.y!)) <= RANDOM_EVENTS.stormRadius);
    expect(e.count).toBe(hit.length);
    for (const u of s.units) expect(!!u.slowedNext).toBe(hit.includes(u));
    expect(hit.length).toBeGreaterThan(0);
    // Die getroffene Seite faehrt im naechsten eigenen Zug nur 1 Feld / the hit side moves 1 tile on its next turn
    const victim = hit.includes(a) ? a : far;
    untilTurnOf(s, victim.owner);
    expect(effectiveMove(s, victim)).toBe(1);
  });

  it('Seuche: kein Einkommen, ausser ein Sanitaeter steht daneben / epidemic: no income unless a medic stands next to it', () => {
    const s = blankGame();
    const hq = addCity(s, 2, 2, 0, { hq: true, level: 3 });
    addCity(s, 9, 9, 1, { hq: true, level: 1 });
    const before = income(s, 0);
    const ev: GameEvent[] = [];
    expect(triggerRandomEvent(s, 'epidemic', ev)).toBe(true);
    expect(only(ev)[0]).toMatchObject({ kind: 'epidemic', faction: 0, city: hq.id, contained: false });
    expect(hq.noIncomeNext).toBe(true);
    expect(income(s, 0)).toBeLessThan(before);

    const t = blankGame();
    const hq2 = addCity(t, 2, 2, 0, { hq: true, level: 3 });
    addCity(t, 9, 9, 1, { hq: true });
    addUnit(t, 'medic', 0, 3, 2);
    const ev2: GameEvent[] = [];
    triggerRandomEvent(t, 'epidemic', ev2);
    expect(only(ev2)[0].contained).toBe(true);
    expect(hq2.noIncomeNext).toBe(false);
  });

  it('Rebellen: Gegner der groessten Macht erhaelt Infanterie an deren Stadt / rebels: enemy of the largest power gets infantry at its city', () => {
    const s = blankGame();
    addCity(s, 1, 1, 0, { hq: true });
    const big = addCity(s, 5, 5, 0, { level: 3, pop: 2 });
    addCity(s, 1, 8, 0);
    addCity(s, 9, 9, 1, { hq: true });
    const ev: GameEvent[] = [];
    expect(triggerRandomEvent(s, 'rebels', ev)).toBe(true);
    expect(only(ev)[0]).toMatchObject({ kind: 'rebels', faction: 0, other: 1, city: big.id, count: RANDOM_EVENTS.rebelsUnits });
    const rebels = s.units.filter((u) => u.owner === 1);
    expect(rebels.length).toBe(RANDOM_EVENTS.rebelsUnits);
    for (const u of rebels) { expect(Math.max(Math.abs(u.x - 5), Math.abs(u.y - 5))).toBe(1); expect(u.fresh).toBe(true); }
    expect(big.pop).toBe(1);
    // im Frieden keine Rebellen / no rebels in peace
    const p = blankGame();
    addCity(p, 1, 1, 0, { hq: true }); addCity(p, 5, 5, 0); addCity(p, 1, 8, 0); addCity(p, 9, 9, 1, { hq: true });
    p.factions[0].relations[1] = 'peace'; p.factions[1].relations[0] = 'peace';
    expect(triggerRandomEvent(p, 'rebels', [])).toBe(false);
  });

  it('Nachschub: die schwaechste Fraktion erhaelt Sterne / convoy: the weakest faction gets stars', () => {
    const s = blankGame({ stars: 5 });
    addCity(s, 1, 1, 0, { hq: true, level: 4 }); addCity(s, 4, 4, 0);
    addCity(s, 9, 9, 1, { hq: true });
    const ev: GameEvent[] = [];
    triggerRandomEvent(s, 'convoy', ev);
    expect(only(ev)[0]).toMatchObject({ kind: 'convoy', faction: 1, stars: RANDOM_EVENTS.convoyStars });
    expect(s.factions[1].stars).toBe(5 + RANDOM_EVENTS.convoyStars);
    expect(s.factions[0].stars).toBe(5);
  });

  it('Ueberlaeufer: die naechste feindliche Einheit wechselt zur schwaechsten Fraktion / defector: the nearest hostile unit joins the weakest', () => {
    const s = blankGame();
    addCity(s, 1, 1, 0, { hq: true, level: 4 }); addCity(s, 3, 1, 0);
    addCity(s, 9, 9, 1, { hq: true });
    const near = addUnit(s, 'infantry', 0, 7, 7);
    const farther = addUnit(s, 'infantry', 0, 2, 2);
    const inCity = addUnit(s, 'infantry', 0, 3, 1);
    const ev: GameEvent[] = [];
    expect(triggerRandomEvent(s, 'defector', ev)).toBe(true);
    expect(only(ev)[0]).toMatchObject({ kind: 'defector', faction: 1, other: 0, unit: near.id });
    expect(near.owner).toBe(1);
    expect(near.fresh).toBe(true);
    expect(farther.owner).toBe(0);
    expect(inCity.owner).toBe(0);
  });

  it('Gluecksfund: Technologie bis Stufe 2, ohne Forschung Sterne / lucky find: tech up to tier 2, stars without research', () => {
    const s = blankGame();
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    const before = s.factions.map((f) => f.techs.length);
    const ev: GameEvent[] = [];
    triggerRandomEvent(s, 'luckyFind', ev);
    const e = only(ev)[0];
    expect(e.tech).toBeDefined();
    expect(TECHS[e.tech!].tier).toBeLessThanOrEqual(RANDOM_EVENTS.luckyMaxTier);
    expect(s.factions[e.faction!].techs.length).toBe(before[e.faction!] + 1);

    const z = blankGame({ factions: ['zyrr', 'nexus'], stars: 0 });
    addCity(z, 1, 1, 0, { hq: true }); addCity(z, 9, 9, 1, { hq: true });
    const ev2: GameEvent[] = [];
    triggerRandomEvent(z, 'luckyFind', ev2);
    const e2 = only(ev2)[0];
    expect(e2.tech).toBeUndefined();
    expect(z.factions[e2.faction!].stars).toBe(RANDOM_EVENTS.luckyStars);
  });

  it('Duerre: zwei Runden Sternverlust je Hof, dann vorbei / drought: two rounds of star loss per farm, then over', () => {
    const s = blankGame({ stars: 50 });
    addCity(s, 2, 2, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    tile(s, 3, 3).building = 'farm';
    tile(s, 1, 2).building = 'ranch';
    const loss = Math.min(RANDOM_EVENTS.droughtMax, 2 * RANDOM_EVENTS.droughtPerFarm);
    const ev: GameEvent[] = [];
    expect(triggerRandomEvent(s, 'drought', ev)).toBe(true);
    expect(only(ev)[0]).toMatchObject({ kind: 'drought', faction: 0, stars: loss, count: 2 });
    expect(s.factions[0].stars).toBe(50 - loss);
    expect(s.factions[1].stars).toBe(50);
    // naechste Runde nochmal, danach nicht mehr / once more next round, then no more
    s.round++;
    const ev2: GameEvent[] = [];
    processRandomEvents(s, ev2);
    expect(only(ev2)[0]).toMatchObject({ kind: 'drought', ongoing: true, stars: loss });
    expect(s.factions[0].stars).toBe(50 - 2 * loss);
    s.round++;
    const ev3: GameEvent[] = [];
    processRandomEvents(s, ev3);
    expect(only(ev3)).toEqual([]);
    expect(s.droughts).toEqual([]);
    // ohne Hoefe keine Duerre / no farms, no drought
    const n = blankGame();
    addCity(n, 2, 2, 0, { hq: true }); addCity(n, 9, 9, 1, { hq: true });
    expect(triggerRandomEvent(n, 'drought', [])).toBe(false);
  });

  it('geplantes Ereignis kommt zu Rundenbeginn, sonst Nachschub / the scheduled event comes at round start, else a convoy', () => {
    const seed = 4242;
    const first = eventRounds(seed, 50)[0];
    const s = blankGame({ seed });
    s.config.events = true;
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    s.round = first - 1;
    s.current = s.factions.length - 1;
    const r = applyCommand(s, { type: 'endTurn' });
    expect(r.ok).toBe(true);
    expect(s.round).toBe(first);
    const evs = only(r.events);
    expect(evs.length).toBe(1);
    const planned = randomEventFor(seed, first)!;
    expect([planned, 'convoy']).toContain(evs[0].kind);
    // ausgeschaltet: nichts / switched off: nothing
    const off = blankGame({ seed });
    addCity(off, 1, 1, 0, { hq: true }); addCity(off, 9, 9, 1, { hq: true });
    off.round = first - 1; off.current = off.factions.length - 1;
    expect(only(applyCommand(off, { type: 'endTurn' }).events)).toEqual([]);
  });
});

describe('KI-Partien mit Ereignissen / AI games with events', () => {
  const cfg = (events: boolean): GameConfig => defaultConfig({
    seed: 77, size: 14, mode: 'points', mapType: 'continents', events, hazards: 'normal',
    factions: (['korvat', 'dravon', 'zyrr', 'vesper'] as const).map((id) => ({ id, human: false, difficulty: 'normal' as const })),
  });
  function run(s: GameState, stopRound = 999) {
    let fails = 0;
    const events: RE[] = [];
    while (!s.over && s.round < stopRound) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const r = applyCommand(s, cmd);
        if (!r.ok) fails++;
        events.push(...only(r.events));
        if (cmd.type === 'endTurn' && r.ok) break;
      }
    }
    return { fails, events };
  }

  it('volle Partie ohne Fehlbefehle, deterministisch / full game without failed commands, deterministic', () => {
    const errors = aiDebug.errors;
    const a = createGame(cfg(true));
    const ra = run(a);
    expect(a.over).toBe(true);
    expect(ra.fails).toBe(0);
    expect(ra.events.filter((e) => !e.ongoing).length).toBeGreaterThanOrEqual(2);
    const b = createGame(cfg(true));
    run(b);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(aiDebug.errors).toBe(errors);
  }, 120_000);

  it('bis zum ersten Ereignis gleich wie ohne Ereignisse / identical to a game without events until the first event', () => {
    const first = eventRounds(77, 99)[0];
    const on = createGame(cfg(true)), off = createGame(cfg(false));
    run(on, first - 1); run(off, first - 1);
    expect(on.round).toBe(first - 1);
    const strip = (s: GameState) => JSON.stringify({ ...s, config: { ...s.config, events: null } });
    expect(strip(on)).toBe(strip(off));
    const offAll = createGame(cfg(false));
    expect(run(offAll).events).toEqual([]);
  }, 120_000);
});
