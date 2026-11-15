/**
 * Kampagnenfortschritt: Freischalten, Ergebnisse, Feldzuege je Fraktion, Uebernahme des alten Stands,
 * Zeitschleife und robustes Einlesen (reine Funktionen).
 * Campaign progress: unlocking, results, runs per faction, migration of the old state, time loop and robust parsing
 * (pure functions).
 */
import { describe, expect, it } from 'vitest';
import {
  chooseFaction, clearNotice, currentMissionId, emptyProgress, emptyStore, isCompleted, isUnlocked, loopDone, loopsDone, MIGRATION_FACTION,
  nextMissionId, parseProgress, parseStore, recordResult, recordRunResult, runOf, totalStars,
} from '../src/save/progress';
import { FINALE_ID, MISSION_IDS } from '../src/core';

const ORDER = ['a', 'b', 'c'];

describe('Kampagnenfortschritt / campaign progress', () => {
  it('am Anfang ist nur die erste Mission frei / initially only the first mission is unlocked', () => {
    const p = emptyProgress();
    expect(isUnlocked(p, ORDER, 'a')).toBe(true);
    expect(isUnlocked(p, ORDER, 'b')).toBe(false);
    expect(isUnlocked(p, ORDER, 'zz')).toBe(false);
    expect(currentMissionId(p, ORDER)).toBe('a');
    expect(totalStars(p)).toBe(0);
  });

  it('ein Sieg schaltet die naechste frei, eine Niederlage nicht / a win unlocks the next, a defeat does not', () => {
    const p0 = emptyProgress();
    const lost = recordResult(p0, 'a', false, 0, 9);
    expect(lost).toBe(p0);
    const p1 = recordResult(p0, 'a', true, 2, 9);
    expect(p0.missions.a).toBeUndefined(); // unveraendert / unchanged
    expect(isCompleted(p1, 'a')).toBe(true);
    expect(isUnlocked(p1, ORDER, 'b')).toBe(true);
    expect(isUnlocked(p1, ORDER, 'c')).toBe(false);
    expect(currentMissionId(p1, ORDER)).toBe('b');
    expect(nextMissionId(ORDER, 'a')).toBe('b');
    expect(nextMissionId(ORDER, 'c')).toBeNull();
  });

  it('beste Wertung und schnellste Runde bleiben / best rating and fastest round are kept', () => {
    let p = recordResult(emptyProgress(), 'a', true, 3, 12);
    p = recordResult(p, 'a', true, 1, 8);
    expect(p.missions.a).toEqual({ stars: 3, bestRound: 8, wins: 2 });
    p = recordResult(p, 'b', true, 7, 5);
    expect(p.missions.b.stars).toBe(3);
    expect(totalStars(p)).toBe(6);
  });

  it('Fortschritt liegt je Fraktion getrennt / progress is stored per faction', () => {
    let st = chooseFaction(emptyStore(), 'alvenia');
    expect(st.faction).toBe('alvenia');
    st = recordRunResult(st, 'alvenia', 'm1', true, 2, 6);
    st = recordRunResult(st, 'velkar', 'm1', true, 3, 4);
    st = recordRunResult(st, 'velkar', 'm2', true, 1, 9);
    expect(totalStars(runOf(st, 'alvenia'))).toBe(2);
    expect(totalStars(runOf(st, 'velkar'))).toBe(4);
    expect(isUnlocked(runOf(st, 'alvenia'), MISSION_IDS, 'm3')).toBe(false);
    expect(isUnlocked(runOf(st, 'velkar'), MISSION_IDS, 'm3')).toBe(true);
    expect(runOf(st, 'korvat').missions).toEqual({});
    // Sonderfraktionen sind nicht waehlbar / special factions cannot be chosen
    expect(chooseFaction(st, 'zyrr').faction).toBe('alvenia');
    expect(recordRunResult(st, 'nexus', 'm1', true, 3, 3)).toBe(st);
    // Wechsel behaelt alle Feldzuege / switching keeps every run
    const sw = chooseFaction(st, 'velkar');
    expect(sw.runs).toEqual(st.runs);
    expect(parseStore(JSON.stringify(sw))).toEqual(sw);
  });

  it('alter Fortschritt wird einmalig der Korvat-Feldzug / old progress becomes the Korvat run once', () => {
    const v1 = JSON.stringify({ v: 1, missions: { m1: { stars: 2, wins: 1, bestRound: 7 }, m2: { stars: 3, wins: 2, bestRound: 5 } } });
    const st = parseStore(null, v1);
    expect(MIGRATION_FACTION).toBe('korvat');
    expect(st.faction).toBe('korvat');
    expect(st.notice).toBe('migrated');
    expect(runOf(st, 'korvat').missions.m2).toEqual({ stars: 3, wins: 2, bestRound: 5 });
    expect(currentMissionId(runOf(st, 'korvat'), MISSION_IDS)).toBe('m3');
    // Hinweis gelesen, v2 hat Vorrang vor v1 / notice read, v2 wins over v1
    const read = clearNotice(st);
    expect(read.notice).toBeUndefined();
    expect(parseStore(JSON.stringify(read), v1)).toEqual(read);
    // leerer alter Stand: keine Uebernahme / empty old state: nothing carried over
    expect(parseStore(null, JSON.stringify({ v: 1, missions: {} }))).toEqual(emptyStore());
    expect(parseStore(null, null)).toEqual(emptyStore());
  });

  it('Zeitschleife: Finale gewonnen markiert die Fraktion / time loop: winning the finale marks the faction', () => {
    let st = emptyStore();
    for (const id of MISSION_IDS) st = recordRunResult(st, 'meridon', id, true, 1, 10);
    expect(FINALE_ID).toBe('m9');
    expect(loopDone(st, 'meridon', FINALE_ID)).toBe(true);
    expect(loopDone(st, 'korvat', FINALE_ID)).toBe(false);
    expect(loopsDone(st, FINALE_ID)).toEqual(['meridon']);
    st = recordRunResult(st, 'dravon', FINALE_ID, true, 2, 12);
    expect(loopsDone(st, FINALE_ID)).toEqual(['dravon', 'meridon']);
    expect(currentMissionId(runOf(st, 'meridon'), MISSION_IDS)).toBeNull();
    expect(totalStars(runOf(st, 'meridon'))).toBe(MISSION_IDS.length);
  });

  it('liest gespeicherte Daten robust / parses stored data robustly', () => {
    const p = recordResult(emptyProgress(), 'a', true, 2, 7);
    expect(parseProgress(JSON.stringify({ v: 1, ...p }))).toEqual(p);
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('kaputt{')).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ v: 2, missions: {} }))).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ v: 1, missions: { a: { stars: 'x' }, b: { stars: 9, wins: 1, bestRound: 4 } } })))
      .toEqual({ missions: { b: { stars: 3, wins: 1, bestRound: 4 } } });
    expect(parseStore('kaputt{')).toEqual(emptyStore());
    expect(parseStore(JSON.stringify({ v: 2, faction: 'zyrr', runs: { zyrr: { missions: {} }, korvat: { missions: { m1: { stars: 1, wins: 1, bestRound: 3 } } } } })))
      .toEqual({ v: 2, faction: null, runs: { korvat: { missions: { m1: { stars: 1, wins: 1, bestRound: 3 } } } } });
  });
});
