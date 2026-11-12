import { describe, expect, it } from 'vitest';
import { barrierCheck, barrierTargets, reachable } from '../src/core';
import { BARRIER } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, tile, untilTurnOf } from './helpers';

function g() {
  const s = blankGame({ stars: 100 });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 10, 10, 1, { hq: true });
  s.factions[0].techs.push('fortification', 'motorization');
  s.factions[1].techs.push('fortification', 'motorization');
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Panzersperre / tank barrier', () => {
  it('nur der Pioniertrupp baut sie, mit Stellungsbau, fuer 10 Sterne neben sich / only pioneers, with Fortification, 10 stars, adjacent', () => {
    const s = g();
    const p = addUnit(s, 'pioneer', 0, 5, 5);
    const inf = addUnit(s, 'infantry', 0, 3, 3);
    expect(barrierCheck(s, inf, 3, 4)).toBe('cannotCapture');
    expect(barrierCheck(s, p, 7, 5)).toBe('outOfRange');
    expect(barrierTargets(s, p)).toHaveLength(8);
    ok(s, { type: 'barrier', unit: p.id, x: 6, y: 5 });
    expect(tile(s, 6, 5).barrier).toEqual({ owner: 0 });
    expect(s.factions[0].stars).toBe(100 - BARRIER.cost);
    // verbraucht den Zug / consumes the turn
    fails(s, { type: 'barrier', unit: p.id, x: 4, y: 5 });
  });

  it('nicht ohne Technologie, nicht auf Wasser, Staedten oder Einheiten / not without tech, on water, cities or units', () => {
    const s = g();
    const p = addUnit(s, 'pioneer', 0, 2, 2);
    addUnit(s, 'infantry', 0, 3, 2);
    expect(barrierCheck(s, p, 1, 1)).toBe('invalidTile');
    expect(barrierCheck(s, p, 3, 2)).toBe('occupied');
    tile(s, 3, 3).terrain = 'shallow';
    expect(barrierCheck(s, p, 3, 3)).toBe('invalidTile');
    s.factions[0].techs = s.factions[0].techs.filter((t) => t !== 'fortification');
    expect(barrierCheck(s, p, 2, 3)).toBe('techMissing');
  });

  it('ein feindliches Fahrzeug haelt an und faehrt naechste Runde nur 1 Feld / a hostile vehicle stops and moves only 1 tile next round', () => {
    const s = g();
    tile(s, 5, 5).barrier = { owner: 1 };
    const jeep = addUnit(s, 'jeep', 0, 4, 5);
    // ohne Sperre 2 Felder weit, durch die Sperre hindurch nicht / without barrier 2 tiles, not through the barrier
    expect(reachable(s, jeep).some((r) => r.path.slice(0, -1).some((q) => q.x === 5 && q.y === 5))).toBe(false);
    expect(reachable(s, jeep).some((r) => r.x === 5 && r.y === 5)).toBe(true);
    const r = ok(s, { type: 'move', unit: jeep.id, to: { x: 5, y: 5 } });
    expect(r.events.some((e) => e.t === 'barrierHit')).toBe(true);
    endTurn(s); untilTurnOf(s, 0);
    const j = s.units.find((u) => u.id === jeep.id)!;
    expect(j.slowed).toBe(true);
    const far = Math.max(...reachable(s, j).map((p) => Math.max(Math.abs(p.x - 5), Math.abs(p.y - 5))));
    expect(far).toBe(1);
    // eine Runde spaeter wieder normal / back to normal one round later
    ok(s, { type: 'move', unit: j.id, to: { x: 6, y: 6 } });
    endTurn(s); untilTurnOf(s, 0);
    expect(Math.max(...reachable(s, j).map((p) => Math.max(Math.abs(p.x - 6), Math.abs(p.y - 6))))).toBe(2);
  });

  it('eigene Fahrzeuge, Infanterie und Hubschrauber sind nicht betroffen / own vehicles, infantry and helicopters are unaffected', () => {
    const s = g();
    tile(s, 5, 5).barrier = { owner: 0 };
    const own = addUnit(s, 'jeep', 0, 4, 5);
    expect(reachable(s, own).some((r) => r.x === 6 && r.y === 5)).toBe(true);
    tile(s, 5, 7).barrier = { owner: 1 };
    s.factions[0].techs.push('armyAviation');
    const heli = addUnit(s, 'heli', 0, 4, 7);
    expect(reachable(s, heli).some((r) => r.x === 7 && r.y === 7)).toBe(true);
    const inf = addUnit(s, 'infantry', 0, 4, 8);
    ok(s, { type: 'move', unit: inf.id, to: { x: 5, y: 7 } });
    expect(s.units.find((u) => u.id === inf.id)!.slowedNext).toBeFalsy();
  });

  it('die Sperre bleibt stehen / the barrier stays', () => {
    const s = g();
    tile(s, 5, 5).barrier = { owner: 1 };
    const tank = addUnit(s, 'tank', 0, 4, 5);
    ok(s, { type: 'move', unit: tank.id, to: { x: 5, y: 5 } });
    endTurn(s); untilTurnOf(s, 0);
    expect(tile(s, 5, 5).barrier).toEqual({ owner: 1 });
  });
});
