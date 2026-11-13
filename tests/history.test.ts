/**
 * Spielverlauf: Aufzeichnung je Runde, Verluste, Eroberungen, Heldenliste, Speichern und Laden.
 * Game history: recording per round, losses, captures, hero list, saving and loading.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyCommand, createGame, defaultConfig, ensureHistory, historySeries, HISTORY, topUnits, factionTotals, type GameState,
} from '../src/core';
import { isValidState, loadGame, saveGame } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, ok, revealAll } from './helpers';

/** Zwei Fraktionen mit je einer Stadt / two factions with one city each */
function duel(): GameState {
  const s = blankGame();
  revealAll(s, 0); revealAll(s, 1);
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  return s;
}

/** Einfacher localStorage-Ersatz fuer Node / simple localStorage stand-in for Node */
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

describe('Spielverlauf / game history', () => {
  it('records one snapshot per round when the round wraps', () => {
    const s = duel();
    addUnit(s, 'infantry', 0, 2, 2);
    expect(s.history).toBeUndefined();
    endTurn(s); // Fraktion 0 -> 1
    expect(s.history?.rounds.length ?? 0).toBe(0);
    endTurn(s); // Runde 2 -> 3
    expect(s.round).toBe(3);
    const h = s.history!;
    expect(h.rounds.length).toBe(1);
    const r = h.rounds[0];
    expect(r.round).toBe(2);
    expect(r.cities).toEqual([1, 1]);
    expect(r.units).toEqual([1, 0]);
    expect(r.score.length).toBe(2);
    expect(r.stars.length).toBe(2);
    expect(r.techs).toEqual(s.factions.map((f) => f.techs.length));
    endTurn(s); endTurn(s);
    expect(h.rounds.map((x) => x.round)).toEqual([2, 3]);
  });

  it('series appends the live state without duplicating a round', () => {
    const s = duel();
    endTurn(s); endTurn(s);
    const series = historySeries(s);
    expect(series.map((x) => x.round)).toEqual([2, 3]);
    // Live-Stand ersetzt eine gleiche Runde / live state replaces an equal round
    ensureHistory(s).rounds.push({ ...series[1] });
    expect(historySeries(s).map((x) => x.round)).toEqual([2, 3]);
  });

  it('counts losses, kills and captures and keeps fallen heroes', () => {
    const s = duel();
    const a = addUnit(s, 'tank', 0, 4, 4);
    const b = addUnit(s, 'infantry', 1, 5, 4, { hp: 1 });
    ok(s, { type: 'attack', unit: a.id, target: b.id });
    expect(s.history!.losses).toEqual([0, 1]);
    expect(s.factions[0].kills).toBe(1);
    // Held stirbt spaeter: bleibt in der Liste / hero dies later: stays in the list
    a.kills = 3; a.veteran = true;
    const c = addUnit(s, 'infantry', 1, 4, 5);
    a.hp = 1;
    c.kills = 1;
    endTurn(s);
    ok(s, { type: 'attack', unit: c.id, target: a.id });
    expect(s.units.find((u) => u.id === a.id)).toBeUndefined();
    expect(s.history!.losses).toEqual([1, 1]);
    const top = topUnits(s);
    expect(top[0]).toMatchObject({ id: a.id, type: 'tank', faction: 0, kills: 3, veteran: true, alive: false, round: s.round });
    expect(top[1]).toMatchObject({ id: c.id, alive: true, kills: 2 });
    expect(topUnits(s, 5, [1]).every((h) => h.faction === 1)).toBe(true);
    // Eroberung / capture
    const v = addCity(s, 7, 4, null);
    const inf = addUnit(s, 'infantry', 1, 7, 4);
    inf.startX = 7; inf.startY = 4;
    ok(s, { type: 'capture', unit: inf.id });
    expect(cityOwner(s, v.id)).toBe(1);
    expect(s.history!.captures).toEqual([0, 1]);
    const tot = factionTotals(s);
    expect(tot[1]).toMatchObject({ faction: 1, kills: 1, losses: 1, captures: 1 });
  });

  it('keeps the fallen list bounded and sorted', () => {
    const s = duel();
    ensureHistory(s);
    for (let i = 0; i < HISTORY.maxFallen + 5; i++) {
      const u = addUnit(s, 'infantry', i % 2, (i % 9) + 1, 5);
      u.kills = i + 1;
      const killer = addUnit(s, 'tank', (i + 1) % 2, (i % 9) + 1, 6);
      u.hp = 1;
      if (killer.owner !== s.current) endTurn(s);
      ok(s, { type: 'attack', unit: killer.id, target: u.id });
      s.units = s.units.filter((x) => x.id !== killer.id);
    }
    const fallen = s.history!.fallen;
    expect(fallen.length).toBe(HISTORY.maxFallen);
    expect(fallen.map((f) => f.kills)).toEqual([...fallen.map((f) => f.kills)].sort((x, y) => y - x));
    expect(fallen[0].kills).toBe(HISTORY.maxFallen + 5);
  });

  it('is deterministic over a played game', () => {
    const cfg = defaultConfig({ seed: 4242, size: 11, factions: [{ id: 'korvat', human: false, difficulty: 'normal' }, { id: 'dravon', human: false, difficulty: 'normal' }] });
    const play = () => {
      const s = createGame(cfg);
      for (let i = 0; i < 12; i++) applyCommand(s, { type: 'endTurn' });
      return s;
    };
    const a = play(), b = play();
    expect(a.history!.rounds.length).toBe(6);
    expect(JSON.stringify(a.history)).toBe(JSON.stringify(b.history));
  });

  it('repairs damaged or missing history', () => {
    const s = duel();
    (s as unknown as { history: unknown }).history = { rounds: 'x', losses: [1] };
    const h = ensureHistory(s);
    expect(h.rounds).toEqual([]);
    expect(h.losses).toEqual([1, 0]);
    expect(h.captures).toEqual([0, 0]);
    expect(h.fallen).toEqual([]);
  });
});

function cityOwner(s: GameState, id: number) { return s.cities.find((c) => c.id === id)?.owner; }

describe('Speichern mit Verlauf / saving with history', () => {
  const g = globalThis as unknown as { localStorage?: MemStorage };
  let prev: MemStorage | undefined;
  beforeEach(() => { prev = g.localStorage; g.localStorage = new MemStorage(); });
  afterEach(() => { g.localStorage = prev; });

  it('saves and loads the history with the game', () => {
    const s = duel();
    endTurn(s); endTurn(s); endTurn(s); endTurn(s);
    expect(saveGame(s)).toBe(true);
    const l = loadGame()!;
    expect(l).not.toBeNull();
    expect(l.history).toEqual(s.history);
    // nach dem Laden geht die Aufzeichnung weiter / recording continues after loading
    endTurn(l); endTurn(l);
    expect(l.history!.rounds.map((r) => r.round)).toEqual([2, 3, 4]);
  });

  it('loads old saves without history and starts recording', () => {
    const s = duel();
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    delete old.history;
    expect(isValidState(old)).toBe(true);
    g.localStorage!.setItem('frontverlauf.save.v1', JSON.stringify(old));
    const l = loadGame()!;
    expect(l).not.toBeNull();
    expect(l.history).toBeUndefined();
    expect(historySeries(l).length).toBe(1);
    expect(topUnits(l)).toEqual([]);
    endTurn(l); endTurn(l);
    expect(l.history!.rounds.length).toBe(1);
    expect(l.history!.losses).toEqual([0, 0]);
  });
});
