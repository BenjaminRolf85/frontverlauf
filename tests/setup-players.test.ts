/**
 * Einsatzplanung: Teilnehmerliste mit Fraktionskarten (eigene Fraktion, Gegner hinzufuegen/entfernen/tauschen, Mindestzahl).
 * Game setup: participant list with faction cards (own faction, add/remove/swap opponents, minimum count).
 */
import { describe, expect, it } from 'vitest';
import { FACTION_IDS, PLAYER_LIMITS } from '../src/data/balance';
import {
  DEFAULT_OWN_FACTION, MAX_OPPONENTS, addOpponent, addRandomOpponent, availableFactions, canAddOpponent, canStart, initialPlayers,
  missingOpponents, opponentCount, removeOpponent, setDifficulty, setFaction, setHuman,
} from '../src/ui/setupPlayers';

describe('Einsatzplanung: Teilnehmer / game setup: participants', () => {
  it('startet nur mit der eigenen Fraktion als Mensch / starts with only the own faction as human', () => {
    const p = initialPlayers();
    expect(p).toEqual([{ id: DEFAULT_OWN_FACTION, human: true, difficulty: 'normal' }]);
    expect(opponentCount(p)).toBe(0);
    expect(canStart(p)).toBe(false);
    expect(missingOpponents(p)).toBe(PLAYER_LIMITS.min - 1);
  });

  it('nimmt die gemerkte Fraktion, ungueltige Werte fallen auf Korvat zurueck / uses the remembered faction, invalid values fall back to Korvat', () => {
    expect(initialPlayers('vesper')[0].id).toBe('vesper');
    expect(initialPlayers('nonsense')[0].id).toBe(DEFAULT_OWN_FACTION);
    expect(initialPlayers(null)[0].id).toBe(DEFAULT_OWN_FACTION);
  });

  it('fuegt Gegner als KI auf Normal hinzu, nur freie Fraktionen / adds opponents as AI on normal, free factions only', () => {
    let p = initialPlayers('dravon');
    expect(availableFactions(p)).not.toContain('dravon');
    p = addOpponent(p, 'alvenia');
    expect(p[1]).toEqual({ id: 'alvenia', human: false, difficulty: 'normal' });
    expect(canStart(p)).toBe(true);
    expect(missingOpponents(p)).toBe(0);
    // belegte Fraktion: unveraendert / taken faction: unchanged
    expect(addOpponent(p, 'alvenia')).toEqual(p);
    expect(addOpponent(p, 'dravon')).toEqual(p);
  });

  it('respektiert die Hoechstzahl / respects the maximum', () => {
    let p = initialPlayers();
    for (const f of FACTION_IDS) p = addOpponent(p, f);
    expect(p.length).toBe(PLAYER_LIMITS.max);
    expect(opponentCount(p)).toBe(MAX_OPPONENTS);
    expect(canAddOpponent(p)).toBe(false);
    expect(addRandomOpponent(p, () => 0.5)).toEqual(p);
    expect(canStart(p)).toBe(true);
  });

  it('Zufallsgegner nimmt eine freie Fraktion / random opponent picks a free faction', () => {
    let p = initialPlayers('korvat');
    p = addRandomOpponent(p, () => 0);
    expect(p[1].id).toBe(availableFactions(initialPlayers('korvat'))[0]);
    p = addRandomOpponent(p, () => 0.9999);
    expect(new Set(p.map((x) => x.id)).size).toBe(3);
    expect(p.every((x, i) => i === 0 || (!x.human && x.difficulty === 'normal'))).toBe(true);
  });

  it('entfernt Gegner, die eigene Fraktion nie / removes opponents, never the own faction', () => {
    let p = addOpponent(addOpponent(initialPlayers(), 'dravon'), 'meridon');
    expect(removeOpponent(p, 0)).toEqual(p);
    p = removeOpponent(p, 1);
    expect(p.map((x) => x.id)).toEqual(['korvat', 'meridon']);
    p = removeOpponent(p, 1);
    expect(canStart(p)).toBe(false);
  });

  it('tauscht belegte Fraktionen, Mensch/KI bleibt am Platz / swaps taken factions, human/AI stays with the slot', () => {
    let p = addOpponent(addOpponent(initialPlayers('korvat'), 'dravon'), 'meridon');
    p = setDifficulty(p, 1, 'hard');
    p = setFaction(p, 0, 'dravon');
    expect(p.map((x) => x.id)).toEqual(['dravon', 'korvat', 'meridon']);
    expect(p[0].human).toBe(true);
    expect(p[1]).toMatchObject({ human: false, difficulty: 'hard' });
    p = setFaction(p, 2, 'zyrr');
    expect(p[2].id).toBe('zyrr');
    expect(canStart(p)).toBe(true);
  });

  it('Hotseat: Gegner auf Mensch, die eigene Fraktion bleibt Mensch / hotseat: opponent to human, the own faction stays human', () => {
    let p = addOpponent(initialPlayers(), 'velkar');
    p = setHuman(p, 1, true);
    expect(p[1].human).toBe(true);
    p = setHuman(p, 0, false);
    expect(p[0].human).toBe(true);
  });
});
