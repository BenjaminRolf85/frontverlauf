import { describe, expect, it } from 'vitest';
import { combatPreview, healAmount, hitOdds, retreatDamage } from '../src/core';
import { HIT, RETREAT, type FactionId } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile, unit, untilTurnOf } from './helpers';

function game(factions: FactionId[] = ['korvat', 'dravon'], hitChance = true) {
  const s = blankGame({ factions, hitChance, size: 11 });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Fanatiker-Raserei / fanatic frenzy', () => {
  it('below 20 % HP cultists get 50 % more crits, taken from full hits', () => {
    const s = game(['vesper', 'korvat']);
    const z = addUnit(s, 'zealot', 0, 5, 5);
    const calm = hitOdds(s, z);
    z.hp = Math.floor(z.maxHp * 0.19);
    const frenzy = hitOdds(s, z);
    expect(frenzy.crit).toBeCloseTo(calm.crit * (1 + HIT.cultFrenzyCrit), 6);
    expect(frenzy.full).toBeCloseTo(calm.full - calm.crit * HIT.cultFrenzyCrit, 6);
    expect(frenzy.miss).toBeCloseTo(calm.miss, 6);
  });
});

describe('Roboter-Verschleiss / robot wear', () => {
  it('robots get less accurate as they lose HP: full at 100 %, clearly worse at 20 %', () => {
    const s = game(['nexus', 'korvat']);
    const r = addUnit(s, 'android', 0, 5, 5);
    const fresh = hitOdds(s, r);
    r.hp = Math.round(r.maxHp * 0.6);
    const mid = hitOdds(s, r);
    r.hp = Math.round(r.maxHp * 0.2);
    const low = hitOdds(s, r);
    expect(mid.full).toBeLessThan(fresh.full);
    expect(low.full).toBeLessThan(mid.full);
    expect(low.miss).toBeGreaterThan(fresh.miss);
    expect(low.crit).toBeCloseTo(fresh.crit, 6);
    // Menschen verlieren keine Genauigkeit / humans keep their accuracy
    const h = addUnit(s, 'infantry', 1, 7, 7);
    const hf = hitOdds(s, h); h.hp = 2;
    expect(hitOdds(s, h)).toEqual(hf);
  });
});

describe('Geordneter Rueckzug / orderly retreat', () => {
  it('deals 20 % damage, takes no return fire and steps one tile away', () => {
    const s = game();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    const full = combatPreview(s, a, d).toDefender;
    const r = ok(s, { type: 'retreat', unit: a.id, target: d.id });
    expect(unit(s, d.id)!.hp).toBe(d.maxHp - Math.max(1, Math.round(full * RETREAT.damage)));
    expect(unit(s, a.id)!.hp).toBe(a.maxHp);
    expect(Math.max(Math.abs(unit(s, a.id)!.x - 6), Math.abs(unit(s, a.id)!.y - 5))).toBe(2);
    expect(r.events.some((e) => e.t === 'attack' && e.retreat)).toBe(true);
    expect(r.events.some((e) => e.t === 'move')).toBe(true);
    expect(unit(s, a.id)!.exhausted).toBe(true);
  });

  it('has a 2-round cooldown', () => {
    const s = game();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'tank', 1, 6, 5);
    ok(s, { type: 'retreat', unit: a.id, target: d.id });
    const used = s.round;
    for (let i = 0; i < 2; i++) { endTurn(s); untilTurnOf(s, 0); }
    expect(s.round).toBe(used + 2);
    const au = unit(s, a.id)!, du = unit(s, d.id)!;
    du.x = au.x + 1; du.y = au.y;
    fails(s, { type: 'retreat', unit: au.id, target: du.id }, 'retreatCooldown');
    endTurn(s); untilTurnOf(s, 0);
    du.x = au.x + 1; du.y = au.y;
    expect(retreatDamage(s, au, du)).toBeGreaterThan(0);
    ok(s, { type: 'retreat', unit: au.id, target: du.id });
  });

  it('needs a free land tile behind the unit, and only humans can do it', () => {
    const s = game(['korvat', 'nexus']);
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'android', 1, 6, 5);
    for (const [x, y] of [[4, 4], [4, 5], [4, 6], [5, 4], [5, 6]]) setTerrain(s, x, y, 'ocean');
    fails(s, { type: 'retreat', unit: a.id, target: d.id }, 'noRetreatTile');
    s.current = 1;
    fails(s, { type: 'retreat', unit: d.id, target: a.id }, 'cannotRetreat');
  });
});

describe('Notreparatur aus Wracks / emergency repair from wrecks', () => {
  it('robots next to a wreck heal 50 % more, use up the wreck and end their turn', () => {
    const s = game(['nexus', 'korvat']);
    const r = addUnit(s, 'android', 0, 5, 5);
    r.hp = 3;
    tile(s, 6, 5).remains = { kind: 'wreck', unit: 'tank', faction: 1, round: 1 };
    const normal = healAmount(s, r);
    ok(s, { type: 'repair', unit: r.id });
    expect(unit(s, r.id)!.hp).toBe(3 + Math.round(normal * 1.5));
    expect(unit(s, r.id)!.exhausted).toBe(true);
    expect(tile(s, 6, 5).remains).toBeNull();
    fails(s, { type: 'attack', unit: r.id, target: r.id });
  });

  it('needs a wreck and a robot', () => {
    const s = game(['nexus', 'korvat']);
    const r = addUnit(s, 'android', 0, 5, 5); r.hp = 3;
    fails(s, { type: 'repair', unit: r.id }, 'noWreck');
    const h = addUnit(s, 'infantry', 1, 2, 8); h.hp = 3;
    tile(s, 2, 9).remains = { kind: 'wreck', unit: 'tank', faction: 0, round: 1 };
    s.current = 1;
    fails(s, { type: 'repair', unit: h.id }, 'cannotRepair');
  });
});

describe('Ausserirdische heilen nur auf Xeno-Boden / aliens heal only on xeno ground', () => {
  it('no healing off xeno ground, normal healing on it; other races unaffected', () => {
    const s = game(['zyrr', 'korvat']);
    const a = addUnit(s, 'grey', 0, 5, 5); a.hp = 3;
    expect(healAmount(s, a)).toBe(0);
    fails(s, { type: 'heal', unit: a.id }, 'noXenoGround');
    tile(s, 5, 5).xeno = true;
    expect(healAmount(s, a)).toBeGreaterThan(0);
    ok(s, { type: 'heal', unit: a.id });
    expect(unit(s, a.id)!.hp).toBeGreaterThan(3);
    const h = addUnit(s, 'infantry', 1, 8, 8); h.hp = 3;
    expect(healAmount(s, h)).toBeGreaterThan(0);
  });
});
