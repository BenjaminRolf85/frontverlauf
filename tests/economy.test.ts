import { describe, expect, it } from 'vitest';
import { createGame, defaultConfig, hqOf, income, ownUnits, cityIncome, logisticsIncome } from '../src/core';
import { FACTIONS, FACTION_IDS, INCOME, START, UNITS } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, ok, setTerrain, untilTurnOf } from './helpers';

describe('Start', () => {
  it('every faction starts with a level-1 HQ, one infantry, 25 stars and its start tech', () => {
    const s = createGame(defaultConfig({
      seed: 99, size: 18, mapType: 'continent',
      factions: FACTION_IDS.map((id) => ({ id, human: true, difficulty: 'normal' as const })),
    }));
    expect(START.stars).toBe(25);
    for (const f of s.factions) {
      const hq = hqOf(s, f.index)!;
      expect(hq).toBeDefined();
      expect(hq.level).toBe(1);
      expect(hq.isHQ).toBe(true);
      expect(s.cities.filter((c) => c.owner === f.index)).toHaveLength(1);
      const units = ownUnits(s, f.index);
      expect(units).toHaveLength(1);
      expect(units[0].type).toBe(f.id === 'zyrr' ? 'grey' : 'infantry');
      expect(units[0].x).toBe(hq.x);
      expect(units[0].y).toBe(hq.y);
      expect(f.stars).toBe(25);
      expect(f.techs).toEqual(FACTIONS[f.id].startTech ? [FACTIONS[f.id].startTech] : []);
    }
    expect(s.round).toBe(1);
    expect(s.current).toBe(0);
  });

  it('start stars follow the config (sandbox)', () => {
    const s = createGame(defaultConfig({ mode: 'sandbox', startStars: 100 }));
    expect(s.factions.every((f) => f.stars === 100)).toBe(true);
  });
});

describe('Einkommen / income', () => {
  it('city 5 per level, HQ +5, factory +5, government quarter +5', () => {
    const s = blankGame();
    const hq = addCity(s, 2, 2, 0, { hq: true, level: 1 });
    const c = addCity(s, 7, 7, 0, { level: 3 });
    expect(cityIncome(s, hq)).toBe(5 + 5);
    expect(cityIncome(s, c)).toBe(15);
    c.factory = true;
    expect(cityIncome(s, c)).toBe(20);
    c.govQuarter = true;
    expect(cityIncome(s, c)).toBe(25);
    expect(income(s, 0)).toBe(35);
    expect(INCOME).toMatchObject({ perCityLevel: 5, hq: 5, factory: 5, govQuarter: 5 });
  });

  it('income is credited at the start of the own turn', () => {
    const s = blankGame();
    addCity(s, 2, 2, 0, { hq: true, level: 2 });
    addCity(s, 8, 8, 1, { hq: true });
    s.factions[0].stars = 3;
    untilTurnOf(s, 0);
    expect(s.factions[0].stars).toBe(3 + 15);
    expect(s.factions[1].stars).toBe(10);
  });

  it('no income in round 1 (start stars only)', () => {
    const s = createGame(defaultConfig({ seed: 5 }));
    expect(s.factions[0].stars).toBe(25);
    endTurn(s);
    expect(s.round).toBe(1);
    expect(s.factions[1].stars).toBe(25);
    endTurn(s);
    expect(s.round).toBe(2);
    expect(s.factions[0].stars).toBe(25 + 10);
  });

  it('neutral settlements produce no income', () => {
    const s = blankGame();
    const v = addCity(s, 5, 5, null);
    expect(cityIncome(s, v)).toBe(0);
  });

  it('logistics centre: 5 stars per adjacent lumber camp / farm / mine, at most 40', () => {
    const s = blankGame();
    const c = addCity(s, 5, 5, 0, { radius: 2 });
    setTerrain(s, 4, 4, 'plain', { building: 'logisticsCenter' });
    setTerrain(s, 3, 3, 'forest', { building: 'lumberCamp' });
    setTerrain(s, 4, 3, 'plain', { building: 'farm' });
    setTerrain(s, 5, 3, 'mountain', { building: 'mine' });
    setTerrain(s, 3, 4, 'plain', { building: 'storehouse' }); // zaehlt nicht / does not count
    expect(logisticsIncome(s, 4, 4)).toBe(15);
    expect(cityIncome(s, c)).toBe(5 + 15);
    // Deckel 40 / cap 40
    expect(INCOME.logisticsMax).toBe(40);
    const s2 = blankGame();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (x !== 1 || y !== 1) setTerrain(s2, x, y, 'plain', { building: 'farm' });
    expect(logisticsIncome(s2, 1, 1)).toBe(40);
  });

  it('AI on hard/extreme gets an income bonus, easy/normal and humans do not', () => {
    const s = blankGame();
    addCity(s, 2, 2, 1, { hq: true });
    const base = income(s, 1);
    for (const [d, bonus] of [['easy', 0], ['normal', 0], ['hard', 5], ['extreme', 10]] as const) {
      s.factions[1].human = false; s.factions[1].difficulty = d;
      expect(income(s, 1)).toBe(base + bonus);
    }
    s.factions[1].human = true; s.factions[1].difficulty = 'extreme';
    expect(income(s, 1)).toBe(base);
  });

  it('all prices and incomes are whole numbers', () => {
    for (const st of Object.values(UNITS)) if (st.cost !== null) expect(Number.isInteger(st.cost)).toBe(true);
    const s = createGame(defaultConfig({ seed: 3 }));
    for (let i = 0; i < 6; i++) endTurn(s);
    for (const f of s.factions) expect(Number.isInteger(f.stars)).toBe(true);
  });

  it('stars are spent on units, buildings and research', () => {
    const s = blankGame({ stars: 100 });
    const hq = addCity(s, 5, 5, 0, { hq: true });
    s.factions[0].techs.push('supply');
    setTerrain(s, 4, 4, 'plain', { resource: 'supplies' });
    ok(s, { type: 'train', city: hq.id, unitType: 'infantry' });
    expect(s.factions[0].stars).toBe(100 - 8); // Korvat-Rabatt / Korvat discount
    ok(s, { type: 'build', building: 'storehouse', x: 4, y: 4 });
    expect(s.factions[0].stars).toBe(82);
    ok(s, { type: 'research', tech: 'motorization' });
    expect(s.factions[0].stars).toBe(82 - 25);
    void addUnit;
  });
});
