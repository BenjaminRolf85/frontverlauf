/**
 * Kampagnenfortschritt: Freischalten, Ergebnisse, Feldzuege je Fraktion, Uebernahme des alten Stands,
 * Zeitschleife und robustes Einlesen (reine Funktionen).
 * Campaign progress: unlocking, results, runs per faction, migration of the old state, time loop and robust parsing
 * (pure functions).
 */
import { describe, expect, it } from 'vitest';
import {
  chooseFaction, clearNotice, currentMissionId, emptyProgress, emptyStore, isCompleted, isUnlocked, loopDone, loopsDone, MIGRATION_FACTION,
  nextMissionId, parseProgress, parseStore, recordResult, recordRunResult, runOf, totalStars, LAYOUT, LAYOUT_MIGRATION, migrateRun,
  LAYOUT2_ORDER, currentMission, missionUnlocked, worldComplete, worldUnlocked, worldOrder, type WorldList,
} from '../src/save/progress';
import { FINALE_ID, MISSION_IDS, WORLDS, missionNumber } from '../src/core';

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
    expect(isUnlocked(runOf(st, 'alvenia'), MISSION_IDS, 'm4')).toBe(false);
    expect(isUnlocked(runOf(st, 'velkar'), MISSION_IDS, 'm4')).toBe(true);
    expect(missionUnlocked(runOf(st, 'velkar'), 'm4')).toBe(true);
    expect(missionUnlocked(runOf(st, 'velkar'), 'm3')).toBe(false);
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
    expect(currentMissionId(runOf(st, 'korvat'), MISSION_IDS)).toBe('m4');
    expect(currentMission(runOf(st, 'korvat'))).toBe('m4');
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

  it('bestRound 0 (unbekannt) wird durch den naechsten Sieg ersetzt / bestRound 0 (unknown) is replaced by the next win', () => {
    const p = { missions: { a: { stars: 2, wins: 1, bestRound: 0 } } };
    expect(recordResult(p, 'a', true, 1, 9).missions.a).toEqual({ stars: 2, wins: 2, bestRound: 9 });
    expect(recordResult(recordResult(p, 'a', true, 1, 9), 'a', true, 1, 7).missions.a.bestRound).toBe(7);
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
    expect(parseStore(JSON.stringify({ v: 2, layout: LAYOUT, faction: 'zyrr', runs: { zyrr: { missions: {} }, korvat: { missions: { m1: { stars: 1, wins: 1, bestRound: 3 } } } } })))
      .toEqual({ v: 2, layout: LAYOUT, faction: null, runs: { korvat: { missions: { m1: { stars: 1, wins: 1, bestRound: 3 } } } } });
  });

  it('Uebernahme der neun alten Einsaetze (Reihe 1) / migration of the nine old missions (layout 1)', () => {
    expect(LAYOUT).toBe(3);
    expect(LAYOUT_MIGRATION).toEqual({ m3: 'm2' });
    const rec = (stars: number, wins: number, bestRound: number) => ({ stars, wins, bestRound });
    const nine = { v: 2, faction: 'korvat', runs: {
      korvat: { missions: { m1: rec(3, 1, 7), m2: rec(1, 1, 9), m3: rec(3, 2, 6), m4: rec(2, 1, 11) } },
      velkar: { missions: { m1: rec(2, 1, 8) } },
    } };
    const st = parseStore(JSON.stringify(nine));
    expect(st.layout).toBe(LAYOUT);
    expect(st.notice).toBe('reordered');
    const k = runOf(st, 'korvat');
    // alte m3 (Die Linie haelt) geht in m2 auf: beste Wertung, schnellste Runde, Siege addiert
    // old m3 (Hold the Line) merges into m2: best rating, fastest round, wins added
    expect(k.missions.m2).toEqual(rec(3, 2 + 1, 6));
    expect(k.missions.m3).toBeUndefined();
    expect(k.missions.m4).toEqual(rec(2, 1, 11));
    expect(totalStars(k)).toBe(3 + 3 + 2);
    // neue Reihenfolge: nach m4 kommt m5 / new order: m5 follows m4
    expect(currentMission(k)).toBe('m5');
    expect(missionUnlocked(k, 'm4')).toBe(true);
    expect(missionUnlocked(k, 'm5')).toBe(true);
    expect(missionUnlocked(k, 'm6')).toBe(false);
    expect(missionUnlocked(k, 'm3')).toBe(false);
    expect(runOf(st, 'velkar').missions).toEqual({ m1: rec(2, 1, 8) });
    // einmalig: der gespeicherte neue Stand wird nicht erneut umgeschrieben / once only: the saved new state is not rewritten again
    let again = recordRunResult(clearNotice(st), 'korvat', 'm3', true, 2, 10);
    again = parseStore(JSON.stringify(again));
    expect(runOf(again, 'korvat').missions.m3).toEqual(rec(2, 1, 10));
    expect(runOf(again, 'korvat').missions.m2).toEqual(rec(3, 3, 6));
    expect(again.notice).toBeUndefined();
    // v1 (ohne Fraktion) wird ebenfalls umgeschrieben / v1 (without a faction) is rewritten as well
    const v1 = parseStore(null, JSON.stringify({ v: 1, missions: { m1: rec(1, 1, 9), m2: rec(2, 1, 8), m3: rec(1, 1, 12) } }));
    expect(v1.notice).toBe('migrated');
    expect(runOf(v1, 'korvat').missions).toEqual({ m1: rec(1, 1, 9), m2: rec(2, 2, 8) });
    expect(migrateRun({ missions: {} })).toEqual({ missions: {} });
  });

  it('Reihe 2 auf drei Welten: IDs bleiben, Gewonnenes bleibt offen, Zeiger auf den ersten offenen Einsatz / layout 2 to three worlds: ids stay, won stays open, pointer to the first open mission', () => {
    const rec = (stars: number, wins: number, bestRound: number) => ({ stars, wins, bestRound });
    // Reihe 2: m1 m2 m3 m10 m11 m4 ... gespielt bis zur Schwarmmutter / layout 2: played up to the Swarm Mother
    const two = { v: 2, layout: 2, faction: 'dravon', runs: {
      dravon: { missions: { m1: rec(3, 1, 7), m2: rec(2, 1, 9), m3: rec(2, 1, 12), m10: rec(1, 1, 16), m11: rec(3, 1, 11) } },
      alvenia: { missions: { m1: rec(1, 1, 9) } },
    } };
    const st = parseStore(JSON.stringify(two));
    expect(st.layout).toBe(3);
    expect(LAYOUT2_ORDER).toHaveLength(11);
    // keine ID wird umgeschrieben, m3 bleibt das Portal / no id is rewritten, m3 stays the portal
    const d = runOf(st, 'dravon');
    expect(d.missions).toEqual(two.runs.dravon.missions);
    // alle Gewonnenen bleiben offen / all won ones stay open
    for (const id of ['m1', 'm2', 'm3', 'm10', 'm11']) expect(missionUnlocked(d, id), id).toBe(true);
    // der Zeiger ist der erste ungewonnene in der neuen Reihenfolge / the pointer is the first unwon one in the new order
    expect(currentMission(d)).toBe('m4');
    expect(missionUnlocked(d, 'm5')).toBe(false);
    // die Wueste folgt der gewonnenen Schwarmmutter / the desert follows the won Swarm Mother
    expect(worldComplete(d, 'alien')).toBe(true);
    expect(worldUnlocked(d, 'forgotten')).toBe(true);
    expect(missionUnlocked(d, 'm12')).toBe(true);
    expect(missionUnlocked(d, 'm13')).toBe(false);
    // Hinweis: die Reihenfolge hat sich fuer diesen Feldzug geaendert / notice: the order changed for this run
    expect(st.notice).toBe('reordered');
    // wer nur m1 hat, merkt nichts (Zeiger bleibt m2) / whoever only has m1 notices nothing (pointer stays m2)
    const fresh = parseStore(JSON.stringify({ v: 2, layout: 2, faction: 'alvenia', runs: { alvenia: { missions: { m1: rec(1, 1, 9) } } } }));
    expect(fresh.notice).toBeUndefined();
    expect(currentMission(runOf(fresh, 'alvenia'))).toBe('m2');
    // wer m1 und m2 hat, bekommt den Hinweis (vorher Portal, jetzt Pilger) / whoever has m1 and m2 gets the notice (portal before, pilgrims now)
    const two2 = parseStore(JSON.stringify({ v: 2, layout: 2, faction: 'velkar', runs: { velkar: { missions: { m1: rec(1, 1, 9), m2: rec(1, 1, 9) } } } }));
    expect(two2.notice).toBe('reordered');
    // einmalig / once
    expect(parseStore(JSON.stringify(clearNotice(st))).notice).toBeUndefined();
  });

  it('Welten: Freischaltung entlang WORLDS, Welt fertig mit ihrem letzten Einsatz / worlds: unlocking along WORLDS, world complete with its last mission', () => {
    let p = emptyProgress();
    expect(worldOrder()).toEqual(MISSION_IDS);
    expect(currentMission(p)).toBe('m1');
    expect(worldUnlocked(p, 'earth')).toBe(true);
    expect(worldUnlocked(p, 'alien')).toBe(false);
    for (const id of WORLDS[0].missions) {
      expect(missionUnlocked(p, id), id).toBe(true);
      expect(worldComplete(p, 'earth')).toBe(false);
      p = recordResult(p, id, true, 1, 9);
    }
    expect(worldComplete(p, 'earth')).toBe(true);
    expect(worldUnlocked(p, 'alien')).toBe(true);
    expect(currentMission(p)).toBe('m10');
    expect(missionUnlocked(p, 'm11')).toBe(false);
    for (const id of MISSION_IDS) p = recordResult(p, id, true, 1, 9);
    expect(currentMission(p)).toBeNull();
    expect(worldComplete(p, 'forgotten')).toBe(true);
  });

  it('Einfuegen eines Einsatzes mitten in eine Welt: Nummern, Freischaltung und Uebernahme bleiben stimmig / inserting a mission into the middle of a world: numbers, unlocking and migration stay consistent', () => {
    const rec = (stars: number, wins: number, bestRound: number) => ({ stars, wins, bestRound });
    // erfundener Einsatz mX zwischen m5 und m6, ein weiterer mY mitten in der Wueste / made-up mission mX between m5 and m6, another mY in the middle of the desert
    const worlds: WorldList = WORLDS.map((w) => ({
      id: w.id,
      missions: w.id === 'earth' ? w.missions.flatMap((id) => (id === 'm5' ? [id, 'mX'] : [id]))
        : w.id === 'forgotten' ? w.missions.flatMap((id) => (id === 'm13' ? [id, 'mY'] : [id])) : [...w.missions],
    }));
    const order = worldOrder(worlds);
    expect(order).toHaveLength(MISSION_IDS.length + 2);
    // Nummern folgen der Reihenfolge, nichts ist fest verdrahtet / numbers follow the order, nothing is hard-wired
    expect(missionNumber('m5', order)).toBe(missionNumber('m5'));
    expect(missionNumber('mX', order)).toBe(missionNumber('m5') + 1);
    expect(missionNumber('m6', order)).toBe(missionNumber('m6') + 1);
    expect(missionNumber('m9', order)).toBe(order.length);
    // Spieler war schon bei m7 (m1..m6 gewonnen) und hatte m10 gewonnen / player was at m7 (m1..m6 won) and had won m10
    const st = parseStore(JSON.stringify({ v: 2, layout: LAYOUT, faction: 'meridon', runs: {
      meridon: { missions: Object.fromEntries(['m1', 'm2', 'm4', 'm5', 'm6', 'm10'].map((id) => [id, rec(2, 1, 9)])) },
    } }));
    const p = runOf(st, 'meridon');
    // die Uebernahme laeuft je ID, Reihenfolge egal / migration works per id, order does not matter
    expect(Object.keys(p.missions).sort()).toEqual(['m1', 'm10', 'm2', 'm4', 'm5', 'm6']);
    // der neue Einsatz hinter Gewonnenem ist sofort spielbar und wird der Zeiger / the new mission behind won ones is playable at once and becomes the pointer
    expect(missionUnlocked(p, 'mX', worlds)).toBe(true);
    expect(currentMission(p, worlds)).toBe('mX');
    // Gewonnenes wird nie gesperrt / won missions are never locked
    for (const id of ['m1', 'm2', 'm4', 'm5', 'm6', 'm10']) expect(missionUnlocked(p, id, worlds), id).toBe(true);
    // m7 folgt auf das gewonnene m6 / m7 follows the won m6
    expect(missionUnlocked(p, 'm7', worlds)).toBe(true);
    // Einsatz mitten in der Wueste: gesperrt bis m13 gewonnen, danach offen / mission in the desert middle: locked until m13 is won, open afterwards
    expect(missionUnlocked(p, 'mY', worlds)).toBe(false);
    let q = p;
    for (const id of order.filter((id) => id !== 'mY' && id !== 'mX')) q = recordResult(q, id, true, 1, 9);
    expect(missionUnlocked(q, 'mY', worlds)).toBe(true);
    expect(currentMission(q, worlds)).toBe('mX');
    // die Welt gilt erst mit ihrem letzten Einsatz als fertig, nicht nach Anzahl / the world is complete only with its last mission, not by count
    expect(worldComplete(q, 'forgotten', worlds)).toBe(true);
    expect(worldComplete({ missions: { ...q.missions, m9: undefined as never } }, 'forgotten', worlds)).toBe(false);
  });
});
