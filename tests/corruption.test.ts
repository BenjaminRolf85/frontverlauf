/**
 * Korruption, Nachteil der Handelsliga Meridon (CORRUPTION), als Zufallsereignis: Wurf je Runde aus Seed, Runde und Fraktion,
 * hoechstens cap-mal in window Runden, nur mit Zufallsereignissen, nur Meridon, Anteil mit Minimum und Obergrenze, nie unter 0,
 * alte Spielstaende ohne Feld, KI ohne Fehlbefehle.
 * Corruption, drawback of the Meridon Trade League (CORRUPTION), as a random event: roll per round from seed, round and
 * faction, at most cap times in window rounds, only with random events, only Meridon, share with minimum and cap, never below
 * 0, old saves without the field, AI without failed commands.
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  applyCommand, corruptionLoss, corruptionRule, corruptionWindowOpen, createGame, defaultConfig, income, upkeep,
  type GameEvent, type GameState,
} from '../src/core';
import { eventHash } from '../src/core/events';
import { AI, CORRUPTION, FACTION_IDS, type FactionId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { setLanguage, t } from '../src/i18n/i18n';
import { migrateState } from '../src/save/save';
import { factionTraits } from '../src/ui/factionInfo';
import { rulesHtml } from '../src/ui/rules';
import { addCity, blankGame, endTurn } from './helpers';

const RULE = CORRUPTION.faction.meridon!;
const CHANCE = RULE.chance;

/** Meridon (0) gegen Dravon (1), je ein Hauptquartier, mit Zufallsereignissen / Meridon (0) vs Dravon (1), one HQ each, with random events */
function duel(factions: FactionId[] = ['meridon', 'dravon'], seed = 1): GameState {
  const s = blankGame({ factions, seed });
  s.config.events = true;
  addCity(s, 2, 2, 0, { hq: true }); addCity(s, 8, 8, 1, { hq: true });
  return s;
}

/** Fraktion 0 und 1 beenden ihren Zug; liefert die Ereignisse des Zugwechsels zu Fraktion 0 / both end their turn; returns the events of the switch to faction 0 */
function nextRound(s: GameState): GameEvent[] {
  endTurn(s);
  return endTurn(s).events;
}

/** Erwartete Faelle nach Wurf und Fenster (volle Kasse) / expected hits from roll and window (full treasury) */
function predictHits(seed: number, f: number, from: number, to: number): number[] {
  const hits: number[] = [];
  for (let r = from; r <= to; r++) {
    if (r <= 1 || !corruptionWindowOpen(RULE, hits, r)) continue;
    if (eventHash(seed, r, CORRUPTION.salt + f) < RULE.chance) hits.push(r);
  }
  return hits;
}

/** Runden mit Korruption bei Fraktion f ueber n Runden, Kasse immer voll / rounds with corruption for faction f over n rounds, treasury kept full */
function playRounds(s: GameState, n: number, f = 0): number[] {
  const rounds: number[] = [];
  for (let k = 0; k < n; k++) {
    s.factions[f].stars = 5000;
    const ev = endTurn(s).events.concat(endTurn(s).events);
    for (const e of ev) if (e.t === 'corruption') { expect(e.faction).toBe(f); rounds.push(s.round); }
  }
  return rounds;
}

/** hoechstens cap Faelle in jedem Fenster aus window aufeinanderfolgenden Runden / at most cap hits in every window of window consecutive rounds */
function maxInWindow(hits: number[]): number {
  let worst = 0;
  for (const h of hits) worst = Math.max(worst, hits.filter((r) => r >= h && r < h + RULE.window).length);
  return worst;
}

describe('Korruption / corruption', () => {
  afterAll(() => setLanguage('de'));
  afterEach(() => { RULE.chance = CHANCE; });

  it('Verlust: Anteil abgerundet, mindestens min, hoechstens max, nie mehr als vorhanden / loss: share rounded down, at least min, at most max, never more than there is', () => {
    expect(corruptionLoss(RULE, 0)).toBe(0);
    expect(corruptionLoss(RULE, 100)).toBe(Math.floor(100 * RULE.share));
    expect(corruptionLoss(RULE, 101)).toBe(Math.floor(101 * RULE.share));
    // Mindestbetrag bei kleiner Kasse / minimum with a small treasury
    expect(Math.floor((RULE.min + 1) * RULE.share)).toBeLessThan(RULE.min);
    expect(corruptionLoss(RULE, RULE.min + 1)).toBe(RULE.min);
    // weniger als das Minimum: alles, nie mehr / less than the minimum: everything, never more
    expect(corruptionLoss(RULE, RULE.min - 1)).toBe(RULE.min - 1);
    // Obergrenze bei grosser Kasse / cap with a large treasury
    expect(corruptionLoss(RULE, 10_000)).toBe(RULE.max);
  });

  it('gleitendes Fenster: hoechstens cap Faelle in window Runden / sliding window: at most cap hits in window rounds', () => {
    expect(RULE.cap).toBe(3);
    expect(RULE.window).toBe(10);
    expect(corruptionWindowOpen(RULE, undefined, 5)).toBe(true);
    expect(corruptionWindowOpen(RULE, [2, 3], 4)).toBe(true);
    expect(corruptionWindowOpen(RULE, [2, 3, 4], 11)).toBe(false);
    // Runde 2 faellt aus dem Fenster 3..12 / round 2 drops out of the window 3..12
    expect(corruptionWindowOpen(RULE, [2, 3, 4], 12)).toBe(true);
  });

  it('zu Beginn des Meridon-Zuges nach dem Einkommen, als Ereignis, mit Runde im Spielstand / at the start of the Meridon turn after income, as an event, round stored in the state', () => {
    RULE.chance = 1;
    const s = duel();
    s.factions[0].stars = 100;
    const inc = income(s, 0) - upkeep(s, 0);
    const ev = nextRound(s);
    expect(s.round).toBe(3);
    const lost = corruptionLoss(RULE, 100 + inc);
    expect(s.factions[0].stars).toBe(100 + inc - lost);
    expect(ev.filter((e) => e.t === 'corruption')).toEqual([{ t: 'corruption', faction: 0, stars: lost }]);
    expect(s.factions[0].corruptionHits).toEqual([3]);
  });

  it('der Wurf haengt nur an Seed, Runde und Fraktion / the roll depends only on seed, round and faction', () => {
    for (const seed of [1, 7, 4242]) {
      const a = duel(['meridon', 'dravon'], seed), b = duel(['meridon', 'dravon'], seed);
      const ha = playRounds(a, 60), hb = playRounds(b, 60);
      expect(ha).toEqual(hb);
      expect(ha).toEqual(predictHits(seed, 0, 3, 62));
      expect(ha.length).toBeGreaterThan(0);
    }
    // anderer Seed, andere Runden / another seed, other rounds
    expect(predictHits(1, 0, 3, 62)).not.toEqual(predictHits(7, 0, 3, 62));
  });

  it('nie mehr als cap Faelle in window aufeinanderfolgenden Runden, auch bei sicherem Wurf / never more than cap hits in window consecutive rounds, even with a certain roll', () => {
    const s = duel();
    const hits = playRounds(s, 200);
    expect(maxInWindow(hits)).toBeLessThanOrEqual(RULE.cap);
    // das Fenster greift auch wirklich: irgendwo stehen cap Faelle dicht / the window really bites: somewhere cap hits are close together
    expect(maxInWindow(hits)).toBe(RULE.cap);
    RULE.chance = 1;
    const s2 = duel();
    const all = playRounds(s2, 40);
    // Runde 1 nie; dann je Fenster genau drei Faelle in Folge / never round 1; then exactly three hits in a row per window
    expect(all.slice(0, 6)).toEqual([3, 4, 5, 13, 14, 15]);
    expect(maxInWindow(all)).toBe(RULE.cap);
    // gespeichert werden nur die Faelle im Fenster / only the hits within the window are stored
    expect(s2.factions[0].corruptionHits!.length).toBeLessThanOrEqual(RULE.cap);
  });

  it('nicht in Runde 1, nicht ohne Zufallsereignisse / not in round 1, not without random events', () => {
    RULE.chance = 1;
    const s = createGame(defaultConfig({ seed: 3, size: 11, mode: 'conquest', events: true,
      factions: [{ id: 'meridon', human: true, difficulty: 'normal' }, { id: 'dravon', human: true, difficulty: 'normal' }] }));
    expect(s.round).toBe(1);
    expect(s.factions[0].corruptionHits).toBeUndefined();
    const off = duel();
    off.config.events = false;
    off.factions[0].stars = 100;
    const inc = income(off, 0) - upkeep(off, 0);
    for (let k = 0; k < 12; k++) {
      const before = off.factions[0].stars;
      const ev = nextRound(off);
      expect(ev.some((e) => e.t === 'corruption')).toBe(false);
      expect(off.factions[0].stars).toBe(before + inc);
    }
  });

  it('Mindestbetrag und nie unter 0 / minimum amount and never below 0', () => {
    RULE.chance = 1;
    const s = duel();
    const inc = income(s, 0) - upkeep(s, 0);
    s.factions[0].stars = Math.max(0, RULE.min + 1 - inc);
    const have = s.factions[0].stars + inc;
    nextRound(s);
    expect(s.factions[0].stars).toBe(have - corruptionLoss(RULE, have));
    // leere Kasse ohne Einkommen: nichts zu holen, kein Fall / empty treasury without income: nothing to take, no hit
    const s2 = duel();
    for (const c of s2.cities) if (c.owner === 0) c.noIncomeNext = true;
    s2.factions[0].stars = 0;
    s2.current = 1;
    const ev = endTurn(s2).events;
    expect(s2.factions[0].stars).toBe(0);
    expect(ev.some((e) => e.t === 'corruption')).toBe(false);
    expect(s2.factions[0].corruptionHits).toBeUndefined();
  });

  it('nur Meridon / only Meridon', () => {
    for (const f of FACTION_IDS) expect(!!CORRUPTION.faction[f], f).toBe(f === 'meridon');
    RULE.chance = 1;
    // Dravon an Stelle 0 mit gleicher Kasse verliert nichts / Dravon in slot 0 with the same treasury loses nothing
    const s = duel(['dravon', 'meridon']);
    s.factions[0].stars = 100;
    s.factions[1].stars = 100;
    const inc0 = income(s, 0) - upkeep(s, 0);
    const ev = nextRound(s);
    expect(corruptionRule(s, 0)).toBeNull();
    expect(s.factions[0].stars).toBe(100 + inc0);
    expect(ev.some((e) => e.t === 'corruption')).toBe(false);
    // Meridon an Stelle 1 trifft es zu Beginn ihres Zuges / Meridon in slot 1 is hit at the start of its turn
    const ev1 = endTurn(s).events;
    expect(ev1.filter((e) => e.t === 'corruption').map((e) => (e as { faction: number }).faction)).toEqual([1]);
  });

  it('alter Spielstand ohne Feld: keine Faelle, laeuft weiter / old save without the field: no hits, keeps running', () => {
    RULE.chance = 1;
    const s = duel();
    nextRound(s); nextRound(s);
    expect(s.factions[0].corruptionHits).toEqual([3, 4]);
    // wie ein alter Spielstand: Feld fehlt / like an old save: the field is missing
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    delete old.factions[0].corruptionHits;
    const loaded = migrateState(old);
    expect(loaded.factions[0].corruptionHits).toBeUndefined();
    loaded.factions[0].stars = 500;
    nextRound(loaded);
    expect(loaded.factions[0].corruptionHits).toEqual([loaded.round]);
  });

  it('Merkmal, Tooltip und Regeltext mit Zahlen aus balance.ts, zweisprachig / trait, tooltip and rules text with numbers from balance.ts, bilingual', () => {
    for (const lang of ['de', 'en'] as const) {
      setLanguage(lang);
      const tr = factionTraits('meridon').find((x) => x.kind === 'drawback');
      expect(tr?.value).toBe(t('factions.meridon.drawback'));
      for (const n of [Math.round(RULE.chance * 100), Math.round(RULE.share * 100), RULE.min, RULE.max, RULE.cap, RULE.window]) expect(tr?.desc).toContain(String(n));
      expect(tr?.desc).not.toMatch(/\{\w+\}/);
      expect(t('hud.corruptionRisk')).not.toMatch(/\{\w+\}/);
      expect(t('hud.corruptionRisk')).toContain(`${RULE.cap}`);
      for (const f of FACTION_IDS.filter((x) => x !== 'meridon')) expect(factionTraits(f).some((x) => x.kind === 'drawback'), f).toBe(false);
      expect(rulesHtml()).toContain(t('factions.meridon.drawback'));
      expect(t('randomEvents.corruption.body', { name: 'Meridon', n: 7 })).toContain('7');
    }
  });

  it('KI-Meridon spielt mit Korruption ohne Fehlbefehle / the Meridon AI plays with corruption without failed commands', () => {
    const s = createGame(defaultConfig({
      seed: 4242, size: 14, mapType: 'continent', mode: 'conquest', events: true,
      factions: (['meridon', 'korvat', 'vesper'] as FactionId[]).map((id) => ({ id, human: false, difficulty: 'normal' as const })),
    }));
    let fails = 0;
    const hits: number[] = [];
    while (!s.over && s.round <= 40) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const res = applyCommand(s, cmd);
        if (!res.ok) fails++;
        for (const e of res.events) if (e.t === 'corruption') { hits.push(s.round); expect(s.factions[e.faction].id).toBe('meridon'); }
        if (cmd.type === 'endTurn' && res.ok) break;
      }
      for (const fa of s.factions) expect(fa.stars).toBeGreaterThanOrEqual(0);
    }
    expect(fails).toBe(0);
    // Meridon lebt lange genug, um Korruption zu erleben; das Fenster haelt / Meridon lives long enough to suffer corruption; the window holds
    expect(hits.length).toBeGreaterThan(0);
    expect(maxInWindow(hits)).toBeLessThanOrEqual(RULE.cap);
  }, 120_000);
});
