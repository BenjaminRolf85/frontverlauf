import { describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import { FACTION_IDS } from '../src/data/balance';
import {
  DISPATCH_OCCASIONS, dispatchMood, gameOverSpeaker, pickLine, planDispatches,
} from '../src/ui/dispatchPlan';
import { blankGame } from './helpers';

/** Drei Fraktionen: 0 Mensch, 1 und 2 KI / three factions: 0 human, 1 and 2 AI */
function game() {
  const s = blankGame({ factions: ['korvat', 'dravon', 'meridon'] });
  s.factions[1].human = false;
  s.factions[2].human = false;
  return s;
}

describe('Funksprueche: Anlaesse / dispatches: occasions', () => {
  it('first contact: the other leader greets the human', () => {
    const s = game();
    expect(planDispatches({ t: 'contact', a: 0, b: 1, stars: 5 }, s)).toEqual([{ occasion: 'contact', speaker: 1, target: 0 }]);
    // KI trifft Menschen: der Mensch weiss davon nichts / AI meets the human: the human does not know yet
    expect(planDispatches({ t: 'contact', a: 1, b: 0, stars: 5 }, s)).toEqual([]);
    expect(planDispatches({ t: 'contact', a: 1, b: 2, stars: 5 }, s)).toEqual([]);
  });

  it('diplomacy towards a human: break, war, offer, peace, declined offer', () => {
    const s = game();
    expect(planDispatches({ t: 'breakAnnounced', from: 1, to: 0 }, s)[0]).toMatchObject({ occasion: 'break', speaker: 1, target: 0 });
    expect(planDispatches({ t: 'war', a: 1, b: 0 }, s)[0]).toMatchObject({ occasion: 'war', speaker: 1, target: 0 });
    expect(planDispatches({ t: 'war', a: 0, b: 2 }, s)[0]).toMatchObject({ occasion: 'war', speaker: 2, target: 0 });
    expect(planDispatches({ t: 'war', a: 1, b: 2 }, s)).toEqual([]);
    expect(planDispatches({ t: 'peaceOffer', from: 2, to: 0 }, s)[0]).toMatchObject({ occasion: 'peaceOffer', speaker: 2 });
    expect(planDispatches({ t: 'peaceOffer', from: 0, to: 2 }, s)).toEqual([]);
    expect(planDispatches({ t: 'peace', a: 0, b: 2 }, s)[0]).toMatchObject({ occasion: 'peaceAccepted', speaker: 2, target: 0 });
    // Mensch lehnt das Angebot von 1 ab / the human declines the offer of 1
    expect(planDispatches({ t: 'peaceDeclined', from: 0, to: 1 }, s)[0]).toMatchObject({ occasion: 'peaceRejected', speaker: 1, target: 0 });
    expect(planDispatches({ t: 'peaceDeclined', from: 1, to: 0 }, s)).toEqual([]);
  });

  it('captures: the loser is shocked or angry, the winner smug', () => {
    const s = game();
    expect(planDispatches({ t: 'capture', city: 7, faction: 0, from: 1 }, s)[0]).toMatchObject({ occasion: 'cityLost', speaker: 1, target: 0, city: 7 });
    expect(planDispatches({ t: 'capture', city: 7, faction: 2, from: 0 }, s)[0]).toMatchObject({ occasion: 'cityTaken', speaker: 2, target: 0 });
    expect(planDispatches({ t: 'capture', city: 7, faction: 0, from: null }, s)).toEqual([]);
    expect(planDispatches({ t: 'capture', city: 7, faction: 1, from: 2 }, s)).toEqual([]);
  });

  it('elimination and grand projects only when the human knows the faction', () => {
    const s = game();
    s.factions[0].contacts = [];
    expect(planDispatches({ t: 'eliminated', faction: 1 }, s)).toEqual([]);
    expect(planDispatches({ t: 'grandProject', id: 'academy', faction: 2 }, s)).toEqual([]);
    s.factions[0].contacts = [1, 2];
    expect(planDispatches({ t: 'eliminated', faction: 1 }, s)[0]).toMatchObject({ occasion: 'eliminated', speaker: 1, target: 0 });
    expect(planDispatches({ t: 'grandProject', id: 'academy', faction: 2 }, s)[0]).toMatchObject({ occasion: 'grandProject', speaker: 2 });
    // eigenes Grossprojekt: kein Funkspruch / own grand project: no dispatch
    expect(planDispatches({ t: 'grandProject', id: 'academy', faction: 0 }, s)).toEqual([]);
  });

  it('moods follow the personality', () => {
    expect(dispatchMood('briefing', 'korvat')).toBe('neutral');
    expect(dispatchMood('contact', 'meridon')).toBe('smug');
    expect(dispatchMood('contact', 'nexus')).toBe('neutral');
    expect(dispatchMood('war', 'alvenia')).toBe('angry');
    expect(dispatchMood('cityLost', 'dravon')).toBe('angry');
    expect(dispatchMood('cityLost', 'velkar')).toBe('shocked');
    expect(dispatchMood('victory', 'zyrr')).toBe('smug');
    expect(dispatchMood('defeat', 'zyrr')).toBe('shocked');
  });

  it('game over: winner speaks if human, otherwise the human viewer', () => {
    const s = game();
    s.winner = 0;
    expect(gameOverSpeaker(s, 0)).toEqual({ faction: 0, occasion: 'victory' });
    s.winner = 2;
    expect(gameOverSpeaker(s, 0)).toEqual({ faction: 0, occasion: 'defeat' });
    s.factions[0].human = false;
    expect(gameOverSpeaker(s, -1)).toBeNull();
  });
});

describe('Funksprueche: Zeilen / dispatches: lines', () => {
  it('never the same line twice in a row', () => {
    let last: number | undefined;
    for (let round = 1; round < 30; round++) {
      for (let i = 0; i < 3; i++) {
        const n = pickLine(3, round, 2, last);
        expect(n).not.toBe(last);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(3);
        last = n;
      }
    }
    expect(pickLine(0, 1, 1, undefined)).toBe(-1);
  });

  it('three short lines per faction and occasion in both languages', () => {
    for (const dict of [de, en] as unknown as { dispatch: Record<string, Record<string, string[]>> }[]) {
      for (const f of FACTION_IDS) {
        for (const o of DISPATCH_OCCASIONS) {
          const lines = dict.dispatch[f]?.[o];
          expect(lines, `${f}.${o}`).toHaveLength(3);
          for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(90);
          expect(new Set(lines).size).toBe(3);
        }
      }
    }
  });
});
