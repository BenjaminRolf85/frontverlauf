/**
 * Korruption, Nachteil der Handelsliga Meridon (CORRUPTION): alle paar Runden ein Anteil der Sterne, mindestens ein fester
 * Betrag, hoechstens eine Obergrenze, nie unter 0; nur Meridon; als Spielereignis; KI ohne Fehlbefehle.
 * Corruption, drawback of the Meridon Trade League (CORRUPTION): a share of the stars every few rounds, at least a fixed
 * amount, at most a cap, never below 0; only Meridon; as a game event; AI without failed commands.
 */
import { afterAll, describe, expect, it } from 'vitest';
import {
  applyCommand, corruptionLoss, corruptionRound, corruptionRule, createGame, defaultConfig, income, nextCorruption, upkeep,
  type GameEvent, type GameState,
} from '../src/core';
import { AI, CORRUPTION, FACTION_IDS, type FactionId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { setLanguage, t } from '../src/i18n/i18n';
import { factionTraits } from '../src/ui/factionInfo';
import { rulesHtml } from '../src/ui/rules';
import { addCity, blankGame, endTurn } from './helpers';

const RULE = CORRUPTION.faction.meridon!;

/** Meridon (0) gegen Dravon (1), je ein Hauptquartier, ohne Zufallsereignisse / Meridon (0) vs Dravon (1), one HQ each, without random events */
function duel(factions: FactionId[] = ['meridon', 'dravon']): GameState {
  const s = blankGame({ factions });
  s.config.events = false;
  addCity(s, 2, 2, 0, { hq: true }); addCity(s, 8, 8, 1, { hq: true });
  return s;
}

/** Faction 0 und 1 beenden ihren Zug; liefert die Ereignisse des Zugwechsels zu Fraktion 0 / both end their turn; returns the events of the switch to faction 0 */
function nextRound(s: GameState): GameEvent[] {
  endTurn(s);
  return endTurn(s).events;
}

describe('Korruption / corruption', () => {
  afterAll(() => setLanguage('de'));

  it('Verlust: Anteil abgerundet, mindestens min, hoechstens max, nie mehr als vorhanden / loss: share rounded down, at least min, at most max, never more than there is', () => {
    expect(RULE.interval).toBeGreaterThan(1);
    expect(corruptionLoss(RULE, 0)).toBe(0);
    expect(corruptionLoss(RULE, 100)).toBe(Math.floor(100 * RULE.share));
    expect(corruptionLoss(RULE, 101)).toBe(Math.floor(101 * RULE.share));
    // Mindestbetrag bei kleiner Kasse / minimum with a small treasury
    expect(corruptionLoss(RULE, RULE.min + 1)).toBe(RULE.min);
    // weniger als das Minimum: alles, nie mehr / less than the minimum: everything, never more
    expect(corruptionLoss(RULE, RULE.min - 1)).toBe(RULE.min - 1);
    // Obergrenze bei grosser Kasse / cap with a large treasury
    expect(corruptionLoss(RULE, 10_000)).toBe(RULE.max);
  });

  it('nur in Vielfachen des Abstands, nie in Runde 1 / only on multiples of the interval, never in round 1', () => {
    for (let r = 1; r <= 4 * RULE.interval; r++) expect(corruptionRound(RULE, r), `round ${r}`).toBe(r > 1 && r % RULE.interval === 0);
  });

  it('zu Beginn des Meridon-Zuges nach dem Einkommen, als Ereignis / at the start of the Meridon turn after income, as an event', () => {
    const s = duel();
    s.round = RULE.interval - 1;
    s.factions[0].stars = 100;
    const inc = income(s, 0) - upkeep(s, 0);
    const ev = nextRound(s);
    expect(s.round % RULE.interval).toBe(0);
    expect(s.current).toBe(0);
    const lost = corruptionLoss(RULE, 100 + inc);
    expect(lost).toBeGreaterThan(0);
    expect(s.factions[0].stars).toBe(100 + inc - lost);
    expect(ev.filter((e) => e.t === 'corruption')).toEqual([{ t: 'corruption', faction: 0, stars: lost }]);
  });

  it('in den Runden dazwischen nichts / nothing in the rounds between', () => {
    const s = duel();
    s.round = RULE.interval;
    s.current = 0;
    for (let k = 1; k < RULE.interval; k++) {
      const before = s.factions[0].stars;
      const inc = income(s, 0) - upkeep(s, 0);
      const ev = nextRound(s);
      expect(ev.some((e) => e.t === 'corruption')).toBe(false);
      expect(s.factions[0].stars).toBe(before + inc);
    }
    // die naechste Korruptionsrunde trifft wieder / the next corruption round hits again
    const ev = nextRound(s);
    expect(s.round).toBe(2 * RULE.interval);
    expect(ev.some((e) => e.t === 'corruption' && e.faction === 0)).toBe(true);
  });

  it('Mindestbetrag und nie unter 0 / minimum amount and never below 0', () => {
    const s = duel();
    const inc = income(s, 0) - upkeep(s, 0);
    // knapp ueber dem Minimum: der Anteil waere kleiner, es zaehlt das Minimum / just above the minimum: the share would be smaller, the minimum counts
    s.round = RULE.interval - 1;
    s.factions[0].stars = Math.max(0, RULE.min + 2 - inc);
    const have = s.factions[0].stars + inc;
    expect(Math.floor(have * RULE.share)).toBeLessThan(RULE.min);
    nextRound(s);
    expect(s.factions[0].stars).toBe(have - RULE.min);
    // Kasse unter dem Minimum: alles weg, aber nie negativ / treasury below the minimum: all gone, but never negative
    const s2 = duel();
    s2.round = RULE.interval - 1;
    // ohne Einkommen (keine Stadt mehr als das HQ, das in dieser Runde nichts abwirft) / without income (the HQ yields nothing this round)
    for (const c of s2.cities) if (c.owner === 0) c.noIncomeNext = true;
    const inc2 = income(s2, 0) - upkeep(s2, 0);
    s2.factions[0].stars = 0;
    nextRound(s2);
    const after = s2.factions[0].stars;
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBe(Math.max(0, inc2) - corruptionLoss(RULE, Math.max(0, inc2)));
  });

  it('nur Meridon / only Meridon', () => {
    for (const f of FACTION_IDS) expect(!!CORRUPTION.faction[f], f).toBe(f === 'meridon');
    // Dravon an Stelle 0 mit gleicher Kasse verliert nichts / Dravon in slot 0 with the same treasury loses nothing
    const s = duel(['dravon', 'meridon']);
    s.round = RULE.interval - 1;
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

  it('Vorschau: Zuege bis zur Korruption aus Sicht der Fraktion / preview: turns until corruption from the faction\'s view', () => {
    const s = duel();
    s.round = RULE.interval - 1; s.current = 0;
    s.factions[0].stars = 50;
    // Meridon am Zug in Runde interval-1: naechster eigener Zug ist die Korruptionsrunde / Meridon to move: the next own turn is the corruption round
    expect(nextCorruption(s, 0)).toEqual({ turns: 1, stars: corruptionLoss(RULE, 50) });
    // Dravon am Zug: Meridon hat seinen Zug schon gehabt / Dravon to move: Meridon already had its turn
    s.current = 1;
    expect(nextCorruption(s, 0)?.turns).toBe(1);
    // Runde interval, Dravon am Zug: die naechste trifft erst nach einem vollen Abstand / round interval, Dravon to move: the next hits after a full interval
    s.round = RULE.interval;
    expect(nextCorruption(s, 0)?.turns).toBe(RULE.interval);
    expect(nextCorruption(s, 1)).toBeNull();
    // Meridon an Stelle 1, Runde interval, Fraktion 0 am Zug: Meridons Zug in dieser Runde kommt noch / Meridon's turn this round is still to come
    const s2 = duel(['dravon', 'meridon']);
    s2.round = RULE.interval; s2.current = 0;
    expect(nextCorruption(s2, 1)?.turns).toBe(1);
  });

  it('Merkmal und Regeltext mit Zahlen aus balance.ts, zweisprachig / trait and rules text with numbers from balance.ts, bilingual', () => {
    for (const lang of ['de', 'en'] as const) {
      setLanguage(lang);
      const tr = factionTraits('meridon').find((x) => x.kind === 'drawback');
      expect(tr?.value).toBe(t('factions.meridon.drawback'));
      for (const n of [RULE.interval, Math.round(RULE.share * 100), RULE.min, RULE.max]) expect(tr?.desc).toContain(String(n));
      expect(tr?.desc).not.toMatch(/\{\w+\}/);
      for (const f of FACTION_IDS.filter((x) => x !== 'meridon')) expect(factionTraits(f).some((x) => x.kind === 'drawback'), f).toBe(false);
      expect(rulesHtml()).toContain(t('factions.meridon.drawback'));
      expect(t('events.corruption', { n: 7 })).toContain('7');
    }
  });

  it('KI-Meridon spielt mit Korruption ohne Fehlbefehle / the Meridon AI plays with corruption without failed commands', () => {
    const s = createGame(defaultConfig({
      seed: 4242, size: 14, mapType: 'continent', mode: 'conquest', events: true,
      factions: (['meridon', 'korvat', 'vesper'] as FactionId[]).map((id) => ({ id, human: false, difficulty: 'normal' as const })),
    }));
    let fails = 0, hits = 0;
    while (!s.over && s.round <= 30) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const res = applyCommand(s, cmd);
        if (!res.ok) fails++;
        for (const e of res.events) if (e.t === 'corruption') { hits++; expect(s.factions[e.faction].id).toBe('meridon'); expect(s.round % RULE.interval).toBe(0); }
        if (cmd.type === 'endTurn' && res.ok) break;
      }
      for (const fa of s.factions) expect(fa.stars).toBeGreaterThanOrEqual(0);
    }
    expect(fails).toBe(0);
    // Meridon lebt lange genug, um Korruption zu erleben / Meridon lives long enough to suffer corruption
    expect(hits).toBeGreaterThan(0);
  }, 120_000);
});
