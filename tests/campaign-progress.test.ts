/**
 * Kampagnenfortschritt: Freischalten, Ergebnisse, robustes Einlesen (reine Funktionen).
 * Campaign progress: unlocking, results, robust parsing (pure functions).
 */
import { describe, expect, it } from 'vitest';
import {
  currentMissionId, emptyProgress, isCompleted, isUnlocked, nextMissionId, parseProgress, recordResult, totalStars,
} from '../src/save/progress';
import { MISSION_IDS } from '../src/core';

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
    expect(isUnlocked(lost, ORDER, 'b')).toBe(false);
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
    expect(currentMissionId(p, ORDER)).toBe('c');
  });

  it('liest gespeicherte Daten robust / parses stored data robustly', () => {
    const p = recordResult(emptyProgress(), 'a', true, 2, 7);
    expect(parseProgress(JSON.stringify(p))).toEqual(p);
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('kaputt{')).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ v: 2, missions: {} }))).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ v: 1, missions: { a: { stars: 'x' }, b: { stars: 9, wins: 1, bestRound: 4 } } })))
      .toEqual({ v: 1, missions: { b: { stars: 3, wins: 1, bestRound: 4 } } });
  });

  it('die echte Missionsreihenfolge laesst sich durchspielen / the real mission order can be played through', () => {
    let p = emptyProgress();
    for (const id of MISSION_IDS) {
      expect(isUnlocked(p, MISSION_IDS, id)).toBe(true);
      p = recordResult(p, id, true, 1, 10);
    }
    expect(currentMissionId(p, MISSION_IDS)).toBeNull();
    expect(totalStars(p)).toBe(MISSION_IDS.length);
  });
});
