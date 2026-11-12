import { describe, expect, it } from 'vitest';
import { captureKind, defenseBonus, heliSafe, heliWillCrash, isRefuelSpot, MAX_FUEL, reachable } from '../src/core';
import { FUEL } from '../src/data/balance';
import { addCity, addUnit, blankGame, ok, setTerrain, tile, unit, untilTurnOf } from './helpers';

function hg() {
  const s = blankGame({ size: 18, stars: 200 });
  const hq = addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 16, 16, 1, { hq: true });
  return { s, hq };
}

describe('Kampfhubschrauber / helicopter', () => {
  it('the tank holds 4 rounds', () => {
    expect(FUEL.tank).toBe(4);
    expect(MAX_FUEL).toBe(4);
    const { s, hq } = hg();
    s.factions[0].techs.push('motorization', 'aerodynamics', 'armyAviation');
    ok(s, { type: 'train', city: hq.id, unitType: 'heli' });
    expect(s.units[s.units.length - 1].fuel).toBe(4);
  });

  it('fuel drops by 1 at the end of each own turn away from a refuel spot and the heli crashes at 0', () => {
    const { s } = hg();
    const h = addUnit(s, 'heli', 0, 9, 9);
    const fuels: number[] = [];
    for (let i = 0; i < 3; i++) {
      untilTurnOf(s, 0);
      fuels.push(unit(s, h.id)!.fuel!);
    }
    expect(fuels).toEqual([3, 2, 1]);
    expect(heliWillCrash(s, unit(s, h.id)!)).toBe(true);
    const r = ok(s, { type: 'endTurn' });
    expect(unit(s, h.id)).toBeUndefined();
    expect(r.events.some((e) => e.t === 'crash' && e.unit === h.id)).toBe(true);
  });

  it('fuel does not drop on or next to an own city and is full again at the start of the next own turn', () => {
    const { s } = hg();
    const h = addUnit(s, 'heli', 0, 2, 2, { fuel: 1 }); // neben HQ / next to HQ
    expect(isRefuelSpot(s, 0, 2, 2)).toBe(true);
    expect(heliWillCrash(s, h)).toBe(false);
    untilTurnOf(s, 0);
    expect(unit(s, h.id)!.fuel).toBe(4);
    const h2 = addUnit(s, 'heli', 0, 1, 1, { fuel: 2 }); // auf HQ / on HQ
    untilTurnOf(s, 0);
    expect(unit(s, h2.id)!.fuel).toBe(4);
  });

  it('a city of another faction is no refuel spot', () => {
    const { s } = hg();
    expect(isRefuelSpot(s, 0, 15, 15)).toBe(false);
    const h = addUnit(s, 'heli', 0, 15, 15, { fuel: 1 });
    untilTurnOf(s, 0);
    expect(unit(s, h.id)).toBeUndefined();
  });

  it('flies 3 tiles over any terrain including ocean and mountains without technology', () => {
    const { s } = hg();
    for (let y = 0; y < 18; y++) for (let x = 5; x < 12; x++) setTerrain(s, x, y, (x + y) % 2 ? 'ocean' : 'mountain');
    setTerrain(s, 6, 6, 'forest');
    const h = addUnit(s, 'heli', 0, 5, 5);
    const r = reachable(s, h);
    expect(r.some((p) => p.x === 8 && p.y === 5)).toBe(true);
    expect(r.some((p) => p.x === 8 && p.y === 8)).toBe(true);
    expect(r.some((p) => p.x === 9 && p.y === 5)).toBe(false);
    ok(s, { type: 'move', unit: h.id, to: { x: 8, y: 8 } });
  });

  it('never gets a terrain bonus', () => {
    const { s } = hg();
    setTerrain(s, 5, 5, 'forest');
    s.factions[0].techs.push('camouflage');
    tile(s, 5, 5).outpost = { owner: 0 };
    expect(defenseBonus(s, addUnit(s, 'heli', 0, 5, 5))).toBe(1);
  });

  it('cannot capture anything', () => {
    const { s } = hg();
    addCity(s, 8, 8, null);
    expect(captureKind(s, addUnit(s, 'heli', 0, 8, 8))).toBeNull();
    tile(s, 9, 9).outpost = { owner: 1 };
    expect(captureKind(s, addUnit(s, 'heli', 0, 9, 9))).toBeNull();
  });

  it('heliSafe distinguishes tiles with a safe return from tiles without', () => {
    const { s } = hg();
    const h = addUnit(s, 'heli', 0, 4, 4, { fuel: 2 });
    // mit Tank 2 bleibt nach dem Zug 1 Runde = 3 Felder zu einem Tankfeld (Nachbar der Stadt, Abstand <=1)
    expect(heliSafe(s, h, 2, 2)).toBe(true); // Tankfeld / refuel spot
    expect(heliSafe(s, h, 5, 5)).toBe(true); // 3 Felder bis (2,2)
    expect(heliSafe(s, h, 6, 6)).toBe(false); // 4 Felder
    h.fuel = 1;
    expect(heliSafe(s, h, 2, 2)).toBe(true);
    expect(heliSafe(s, h, 3, 3)).toBe(false); // Absturz am Zugende / crash at end of turn
    h.fuel = 4;
    expect(heliSafe(s, h, 11, 11)).toBe(true); // 9 Felder in 3 Runden
    expect(heliSafe(s, h, 12, 12)).toBe(false);
    // Aussenposten zaehlt als Tankfeld / outpost counts as refuel spot
    tile(s, 13, 13).outpost = { owner: 0 };
    expect(heliSafe(s, h, 15, 15)).toBe(true);
    // Nicht-Hubschrauber sind immer sicher / non-helicopters are always safe
    expect(heliSafe(s, addUnit(s, 'infantry', 0, 7, 7), 17, 17)).toBe(true);
  });
});
