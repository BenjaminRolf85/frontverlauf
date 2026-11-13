import { describe, expect, it } from 'vitest';
import { income, netIncome, unitUpkeep, upkeep } from '../src/core';
import { UNITS, UPKEEP } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, revealAll, untilTurnOf } from './helpers';

describe('Sold / upkeep', () => {
  it('die ersten 5 Einheiten sind frei, danach 20 % des Kaufpreises, Panzer pauschal 10 / first 5 free, then 20 %, tanks flat 10', () => {
    const s = blankGame({ stars: 100, factions: ['korvat', 'dravon'] });
    addCity(s, 2, 2, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    revealAll(s, 0);
    for (let i = 0; i < 5; i++) addUnit(s, 'infantry', 0, 1 + i, 5);
    expect(upkeep(s, 0)).toBe(0);
    const art = addUnit(s, 'artillery', 0, 1, 6);
    const tank = addUnit(s, 'tank', 0, 2, 6);
    expect(unitUpkeep(art)).toBe(Math.ceil(UNITS.artillery.cost! * 0.2));
    expect(unitUpkeep(tank)).toBe(10);
    expect(UPKEEP.freeUnits).toBe(5);
    expect(upkeep(s, 0)).toBe(8 + 10);
    expect(netIncome(s, 0)).toBe(income(s, 0) - 18);
  });
  it('wird zu Rundenbeginn abgezogen, Sterne fallen nicht unter 0 / deducted at turn start, never below 0', () => {
    const s = blankGame({ stars: 3, factions: ['korvat', 'dravon'] });
    addCity(s, 2, 2, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    for (let i = 0; i < 5; i++) addUnit(s, 'infantry', 0, 1 + i, 5);
    for (let i = 0; i < 4; i++) addUnit(s, 'tank', 0, 1 + i, 7);
    endTurn(s); untilTurnOf(s, 0);
    expect(s.factions[0].stars).toBe(Math.max(0, 3 + income(s, 0) - 40));
  });
});
