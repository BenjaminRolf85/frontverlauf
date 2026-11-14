import { describe, expect, it } from 'vitest';
import { combatPreview, rangedCover, rocketTargets, rocketsLeft } from '../src/core';
import { RANGED_COVER, ROCKETS } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, unit, untilTurnOf } from './helpers';

function game() {
  const s = blankGame({ factions: ['zyrr', 'korvat'], size: 11 });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Mech-Raketen / mech rockets', () => {
  it('fire only at targets exactly two tiles away and use up ammo', () => {
    const s = game();
    const m = addUnit(s, 'mech', 0, 5, 5);
    const near = addUnit(s, 'infantry', 1, 6, 5);
    const far = addUnit(s, 'tank', 1, 5, 7);
    expect(rocketsLeft(m)).toBe(ROCKETS.max);
    expect(rocketTargets(s, m).map((u) => u.id)).toEqual([far.id]);
    fails(s, { type: 'rocket', unit: m.id, target: near.id }, 'outOfRange');
    const r = ok(s, { type: 'rocket', unit: m.id, target: far.id });
    expect(r.events.some((e) => e.t === 'attack' && e.rocket)).toBe(true);
    expect(unit(s, far.id)!.hp).toBeLessThan(far.maxHp);
    expect(rocketsLeft(unit(s, m.id)!)).toBe(ROCKETS.max - 1);
  });

  it('cannot fire without rockets; reloads only in an own city with a depot', () => {
    const s = game();
    const m = addUnit(s, 'mech', 0, 5, 5);
    addUnit(s, 'infantry', 1, 5, 7);
    m.rockets = 0;
    expect(rocketTargets(s, m)).toEqual([]);
    endTurn(s); untilTurnOf(s, 0);
    expect(rocketsLeft(unit(s, m.id)!)).toBe(0);
    const c = addCity(s, 3, 3, 0);
    const mu = unit(s, m.id)!;
    mu.x = 3; mu.y = 3;
    endTurn(s); untilTurnOf(s, 0);
    expect(rocketsLeft(unit(s, m.id)!)).toBe(0);
    c.upgrades = ['depot'];
    endTurn(s); untilTurnOf(s, 0);
    expect(rocketsLeft(unit(s, m.id)!)).toBe(ROCKETS.max);
  });

  it('other units have no rockets', () => {
    const s = game();
    const g = addUnit(s, 'grey', 0, 5, 5);
    addUnit(s, 'infantry', 1, 5, 7);
    expect(rocketsLeft(g)).toBe(0);
    fails(s, { type: 'rocket', unit: g.id, target: s.units[s.units.length - 1].id }, 'noRockets');
  });
});

describe('Deckung gegen Fernangriffe / cover against ranged attacks', () => {
  it('troops and tanks in forests or cities take less damage from 2+ tiles, not in melee', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], size: 11 });
    revealAll(s, 0);
    const art = addUnit(s, 'artillery', 0, 2, 5);
    const inf = addUnit(s, 'infantry', 1, 4, 5);
    const open = combatPreview(s, art, inf).toDefender;
    setTerrain(s, 4, 5, 'forest');
    expect(rangedCover(s, art, inf)).toBe(RANGED_COVER.factor);
    expect(combatPreview(s, art, inf).toDefender).toBeLessThan(open);
    // Nahkampf: keine zusaetzliche Deckung / melee: no extra cover
    const mg = addUnit(s, 'infantry', 0, 3, 5);
    expect(rangedCover(s, mg, inf)).toBe(1);
    // Panzer in einer Stadt / tank in a city
    const tank = addUnit(s, 'tank', 1, 6, 7);
    addCity(s, 6, 7, 1);
    const art2 = addUnit(s, 'artillery', 0, 6, 9);
    expect(rangedCover(s, art2, tank)).toBe(RANGED_COVER.factor);
    // Flieger bekommen keine Deckung / fliers get no cover
    const heli = addUnit(s, 'heli', 1, 8, 3);
    setTerrain(s, 8, 3, 'forest');
    const art3 = addUnit(s, 'artillery', 0, 8, 5);
    expect(rangedCover(s, art3, heli)).toBe(1);
  });
});
