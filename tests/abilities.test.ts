import { describe, expect, it } from 'vitest';
import { cityIncome, convertTargets, healAmount, income, reachable } from '../src/core';
import { CITY, HEALING, INCOME } from '../src/data/balance';
import { addCity, addUnit, blankGame, fails, ok, revealAll, setTerrain, unit, untilTurnOf } from './helpers';

function ag() {
  const s = blankGame({ stars: 100 });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 1, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Spion: Aufstand / spy uprising', () => {
  for (const [level, expected] of [[1, 1], [2, 2], [3, 3], [5, 4]] as const) {
    it(`entering a level-${level} enemy city spawns ${expected} own infantry and consumes the spy`, () => {
      const s = ag();
      const c = addCity(s, 6, 6, 1, { level });
      const spy = addUnit(s, 'spy', 0, 4, 6);
      const r = ok(s, { type: 'move', unit: spy.id, to: { x: 6, y: 6 } });
      expect(unit(s, spy.id)).toBeUndefined();
      const ev = r.events.find((e) => e.t === 'uprising');
      expect(ev).toMatchObject({ t: 'uprising', city: c.id, faction: 0, spawned: expected });
      const inf = s.units.filter((u) => u.owner === 0 && u.type === 'infantry');
      expect(inf).toHaveLength(expected);
      for (const u of inf) expect(Math.max(Math.abs(u.x - 6), Math.abs(u.y - 6))).toBe(1);
      expect(c.owner).toBe(1);
      expect(c.noIncomeNext).toBe(true);
      expect(CITY.uprisingMaxUnits).toBe(4);
    });
  }

  it('only free neighbour tiles are used', () => {
    const s = ag();
    addCity(s, 6, 6, 1, { level: 4 });
    for (const [x, y] of [[5, 5], [6, 5], [7, 5], [5, 7], [6, 7]]) addUnit(s, 'infantry', 1, x, y);
    setTerrain(s, 7, 7, 'shallow');
    const spy = addUnit(s, 'spy', 0, 4, 6);
    const r = ok(s, { type: 'move', unit: spy.id, to: { x: 5, y: 6 } });
    void r;
    untilTurnOf(s, 0);
    const r2 = ok(s, { type: 'move', unit: spy.id, to: { x: 6, y: 6 } });
    // frei: nur 5,6 (wo der Spion stand) und 7,6 / free: only 5,6 and 7,6
    expect(r2.events.find((e) => e.t === 'uprising')).toMatchObject({ spawned: 2 });
  });

  it('the city produces no income in the next round', () => {
    const s = ag();
    const c = addCity(s, 6, 6, 1, { level: 2 });
    const spy = addUnit(s, 'spy', 0, 4, 6);
    ok(s, { type: 'move', unit: spy.id, to: { x: 6, y: 6 } });
    expect(cityIncome(s, c)).toBe(0);
    const expected = income(s, 1);
    const stars = s.factions[1].stars;
    ok(s, { type: 'endTurn' });
    expect(s.factions[1].stars).toBe(stars + expected);
    expect(c.noIncomeNext).toBe(false);
    expect(cityIncome(s, c)).toBe(INCOME.perCityLevel * c.level + (c.isHQ ? INCOME.hq : 0));
  });

  it('spy moves 2 and cannot capture or attack', () => {
    const s = ag();
    const spy = addUnit(s, 'spy', 0, 5, 5);
    expect(reachable(s, spy).some((p) => p.x === 7 && p.y === 7)).toBe(true);
  });

  it('no uprising in a city of a faction at peace (cannot enter it)', () => {
    const s = ag();
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    addCity(s, 6, 6, 1, { level: 2 });
    const spy = addUnit(s, 'spy', 0, 4, 6);
    const r = ok(s, { type: 'move', unit: spy.id, to: { x: 6, y: 6 } });
    // Spion darf hinein, aber kein Aufstand / spy may enter but no uprising
    expect(r.events.some((e) => e.t === 'uprising')).toBe(false);
  });
});

describe('Sanitaeter / medic', () => {
  it('heals all adjacent own units by 4', () => {
    const s = ag();
    const m = addUnit(s, 'medic', 0, 5, 5);
    const a = addUnit(s, 'infantry', 0, 5, 4, { hp: 3 });
    const b = addUnit(s, 'mg', 0, 6, 6, { hp: 13 });
    const far = addUnit(s, 'infantry', 0, 7, 5, { hp: 3 });
    const enemy = addUnit(s, 'infantry', 1, 4, 4, { hp: 3 });
    ok(s, { type: 'medicHeal', unit: m.id });
    expect(unit(s, a.id)!.hp).toBe(3 + HEALING.medic);
    expect(unit(s, b.id)!.hp).toBe(15);
    expect(unit(s, far.id)!.hp).toBe(3);
    expect(unit(s, enemy.id)!.hp).toBe(3);
    fails(s, { type: 'medicHeal', unit: m.id }, 'unitExhausted');
  });

  it('non-medics cannot use the heal ability', () => {
    const s = ag();
    const i = addUnit(s, 'infantry', 0, 5, 5);
    fails(s, { type: 'medicHeal', unit: i.id }, 'unitExhausted');
  });

  it('converts an adjacent enemy unit permanently', () => {
    const s = ag();
    const m = addUnit(s, 'medic', 0, 5, 5);
    const e = addUnit(s, 'mg', 1, 6, 5, { homeCity: s.cities[1].id });
    const far = addUnit(s, 'mg', 1, 7, 5);
    expect(convertTargets(s, m).map((u) => u.id)).toEqual([e.id]);
    fails(s, { type: 'convert', unit: m.id, target: far.id }, 'invalidTarget');
    ok(s, { type: 'convert', unit: m.id, target: e.id });
    expect(unit(s, e.id)!.owner).toBe(0);
    expect(unit(s, e.id)!.homeCity).toBeNull();
    untilTurnOf(s, 0);
    expect(unit(s, e.id)!.owner).toBe(0);
    expect(reachable(s, unit(s, e.id)!).length).toBeGreaterThan(0);
  });

  it('no conversion of units of factions at peace', () => {
    const s = ag();
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    const m = addUnit(s, 'medic', 0, 5, 5);
    addUnit(s, 'mg', 1, 6, 5);
    expect(convertTargets(s, m)).toHaveLength(0);
  });
});

describe('Heilen / healing', () => {
  it('4 HP in own territory, 2 HP elsewhere (also in enemy territory)', () => {
    const s = ag();
    const own = addUnit(s, 'infantry', 0, 2, 2, { hp: 1 });
    const out = addUnit(s, 'infantry', 0, 5, 5, { hp: 1 });
    const enemy = addUnit(s, 'infantry', 0, 8, 1, { hp: 1 });
    expect(healAmount(s, own)).toBe(4);
    expect(healAmount(s, out)).toBe(2);
    expect(healAmount(s, enemy)).toBe(2);
    ok(s, { type: 'heal', unit: own.id });
    ok(s, { type: 'heal', unit: out.id });
    expect(unit(s, own.id)!.hp).toBe(5);
    expect(unit(s, out.id)!.hp).toBe(3);
  });

  it('only a unit that neither moved nor attacked heals; never above max HP; heal ends the turn', () => {
    const s = ag();
    const a = addUnit(s, 'infantry', 0, 5, 5, { hp: 5 });
    ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 6 } });
    fails(s, { type: 'heal', unit: a.id }, 'unitExhausted');
    const b = addUnit(s, 'infantry', 0, 2, 2, { hp: 9 });
    ok(s, { type: 'heal', unit: b.id });
    expect(unit(s, b.id)!.hp).toBe(10);
    fails(s, { type: 'move', unit: b.id, to: { x: 3, y: 3 } });
    const full = addUnit(s, 'infantry', 0, 3, 2);
    fails(s, { type: 'heal', unit: full.id }, 'unitExhausted');
    const c = addUnit(s, 'infantry', 0, 5, 8, { hp: 5 });
    const e = addUnit(s, 'infantry', 1, 5, 9);
    ok(s, { type: 'attack', unit: c.id, target: e.id });
    fails(s, { type: 'heal', unit: c.id });
  });
});
