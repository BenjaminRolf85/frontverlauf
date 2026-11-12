import { describe, expect, it } from 'vitest';
import { captureKind, cityTiles, combatPreview, defenseBonus, healAmount, income, isRefuelSpot, outpostCheck } from '../src/core';
import { DEFENSE_BONUS, ECON, INFANTRY_TYPES, type UnitTypeId } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile, unit, untilTurnOf } from './helpers';

function og() {
  const s = blankGame({ stars: 100 });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  s.factions[0].techs.push('fortification');
  s.factions[1].techs.push('fortification');
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Aussenposten bauen / building outposts', () => {
  it('infantry types are infantry, MG, sniper and pioneer', () => {
    expect([...INFANTRY_TYPES].sort()).toEqual(['infantry', 'mg', 'pioneer', 'sniper']);
  });

  it('every infantry type builds it for 25 stars on its own tile, also outside own borders', () => {
    for (const type of INFANTRY_TYPES) {
      const s = og();
      const u = addUnit(s, type, 0, 5, 5);
      expect(tile(s, 5, 5).territory).toBeNull();
      const r = ok(s, { type: 'outpost', unit: u.id });
      expect(r.events[0]).toMatchObject({ t: 'build', building: 'outpost', x: 5, y: 5 });
      expect(tile(s, 5, 5).outpost).toEqual({ owner: 0 });
      expect(s.factions[0].stars).toBe(100 - ECON.outpostCost);
    }
  });

  it('allowed on plain, forest and mountain; not on water', () => {
    for (const terrain of ['plain', 'forest', 'mountain'] as const) {
      const s = og();
      setTerrain(s, 5, 5, terrain);
      expect(outpostCheck(s, addUnit(s, 'infantry', 0, 5, 5))).toBe('ok');
    }
    const s = og();
    setTerrain(s, 5, 5, 'shallow', { building: 'bridge' });
    expect(outpostCheck(s, addUnit(s, 'infantry', 0, 5, 5))).toBe('invalidTile');
  });

  it('requires the fortification tech and 25 stars', () => {
    const s = og();
    s.factions[0].techs = s.factions[0].techs.filter((t) => t !== 'fortification');
    const u = addUnit(s, 'infantry', 0, 5, 5);
    fails(s, { type: 'outpost', unit: u.id }, 'techMissing');
    s.factions[0].techs.push('fortification');
    s.factions[0].stars = 24;
    fails(s, { type: 'outpost', unit: u.id }, 'notEnoughStars');
  });

  it('non-infantry units cannot build outposts', () => {
    for (const type of ['jeep', 'artillery', 'tank', 'medic', 'heli', 'spy'] as UnitTypeId[]) {
      const s = og();
      expect(outpostCheck(s, addUnit(s, type, 0, 5, 5))).toBe('cannotCapture');
    }
  });

  it('produces neither income nor city area', () => {
    const s = og();
    const before = income(s, 0);
    const u = addUnit(s, 'infantry', 0, 5, 5);
    ok(s, { type: 'outpost', unit: u.id });
    expect(income(s, 0)).toBe(before);
    expect(tile(s, 5, 5).territory).toBeNull();
    expect(s.cities.reduce((n, c) => n + cityTiles(s, c).length, 0)).toBe(18);
  });
});

describe('Aussenposten im Kampf / outposts in combat', () => {
  function fight(defType: UnitTypeId, attType: UnitTypeId = 'infantry') {
    const s = og();
    tile(s, 5, 5).outpost = { owner: 1 };
    const d = addUnit(s, defType, 1, 5, 5);
    const a = addUnit(s, attType, 0, attType === 'artillery' ? 3 : 4, 5);
    return { s, d, a };
  }

  it('defense bonus 3.0 for all infantry types', () => {
    for (const t of INFANTRY_TYPES) {
      const { s, d, a } = fight(t);
      expect(defenseBonus(s, d, a)).toBe(DEFENSE_BONUS.outpost);
    }
  });

  it('exact numbers: infantry vs infantry in outpost', () => {
    const { s, d, a } = fight('infantry');
    // 2 vs 2*3=6, Summe 8: round(2/8*2*4.5)=round(2.25)=2 ; round(6/8*2*4.5)=round(6.75)=7
    expect(combatPreview(s, a, d)).toMatchObject({ toDefender: 2, toAttacker: 7 });
  });

  it('vehicles, artillery and tanks may enter but get no bonus', () => {
    for (const t of ['jeep', 'artillery', 'tank', 'medic'] as UnitTypeId[]) {
      const { s, d, a } = fight(t);
      expect(defenseBonus(s, d, a)).toBe(DEFENSE_BONUS.open);
    }
    const s = og();
    tile(s, 5, 5).outpost = { owner: 0 };
    const j = addUnit(s, 'jeep', 0, 4, 5);
    ok(s, { type: 'move', unit: j.id, to: { x: 5, y: 5 } });
  });

  it('the bonus only applies to the outpost owner', () => {
    const s = og();
    tile(s, 5, 5).outpost = { owner: 0 };
    const d = addUnit(s, 'infantry', 1, 5, 5);
    expect(defenseBonus(s, d)).toBe(DEFENSE_BONUS.open);
  });

  it('artillery ignores the outpost bonus and deals full damage', () => {
    const { s, d, a } = fight('infantry', 'artillery');
    expect(defenseBonus(s, d, a)).toBe(DEFENSE_BONUS.open);
    const p = combatPreview(s, a, d);
    // 4 vs 2: round(4/6*4*4.5)=12
    expect(p.toDefender).toBe(12);
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect(unit(s, d.id)).toBeUndefined();
    // anderer Angreifer: Bonus gilt / other attacker: bonus applies
    const f = fight('infantry', 'mg');
    expect(defenseBonus(f.s, f.d, f.a)).toBe(3);
  });

  it('terrain bonus still applies against artillery (forest outpost with camouflage)', () => {
    const { s, d, a } = fight('infantry', 'artillery');
    setTerrain(s, 5, 5, 'forest');
    s.factions[1].techs.push('camouflage');
    expect(defenseBonus(s, d, a)).toBe(1.5);
  });
});

describe('Aussenposten: Besitz, Heilung, Tanken / ownership, healing, refuel', () => {
  it('an empty enemy outpost is taken by infantry standing on it at turn start', () => {
    const s = og();
    tile(s, 5, 5).outpost = { owner: 1 };
    const u = addUnit(s, 'infantry', 0, 4, 5);
    ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 5 } });
    fails(s, { type: 'capture', unit: u.id }, 'cannotCapture');
    untilTurnOf(s, 0);
    expect(captureKind(s, unit(s, u.id)!)).toBe('outpost');
    const r = ok(s, { type: 'capture', unit: u.id });
    expect(r.events[0]).toMatchObject({ t: 'outpostCapture', x: 5, y: 5, faction: 0 });
    expect(tile(s, 5, 5).outpost).toEqual({ owner: 0 });
  });

  it('only infantry types take outposts', () => {
    const s = og();
    tile(s, 5, 5).outpost = { owner: 1 };
    const j = addUnit(s, 'jeep', 0, 5, 5);
    expect(captureKind(s, j)).toBeNull();
    const t = addUnit(s, 'tank', 0, 6, 6);
    tile(s, 6, 6).outpost = { owner: 1 };
    expect(captureKind(s, t)).toBeNull();
  });

  it('own outposts and those of factions at peace cannot be captured', () => {
    const s = og();
    tile(s, 5, 5).outpost = { owner: 0 };
    expect(captureKind(s, addUnit(s, 'infantry', 0, 5, 5))).toBeNull();
    tile(s, 6, 6).outpost = { owner: 1 };
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    expect(captureKind(s, addUnit(s, 'infantry', 0, 6, 6))).toBeNull();
  });

  it('units heal in the own outpost as in own territory (4 instead of 2)', () => {
    const s = og();
    const u = addUnit(s, 'infantry', 0, 5, 5, { hp: 3 });
    expect(healAmount(s, u)).toBe(2);
    tile(s, 5, 5).outpost = { owner: 0 };
    expect(healAmount(s, u)).toBe(4);
    ok(s, { type: 'heal', unit: u.id });
    expect(unit(s, u.id)!.hp).toBe(7);
  });

  it('helicopters refuel on or next to an own outpost', () => {
    const s = og();
    tile(s, 5, 5).outpost = { owner: 0 };
    expect(isRefuelSpot(s, 0, 5, 5)).toBe(true);
    expect(isRefuelSpot(s, 0, 6, 6)).toBe(true);
    expect(isRefuelSpot(s, 0, 7, 7)).toBe(false);
    expect(isRefuelSpot(s, 1, 6, 6)).toBe(false);
    const h = addUnit(s, 'heli', 0, 6, 6, { fuel: 1 });
    endTurn(s);
    expect(unit(s, h.id)).toBeDefined();
    untilTurnOf(s, 0);
    expect(unit(s, h.id)!.fuel).toBe(4);
  });
});
