import { describe, expect, it } from 'vitest';
import { captureKind, cityIncome, levelUpCost, rewardOptions, score, unitLimit, cityTiles, trainCheck } from '../src/core';
import { CITY, SCORE } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, explored, fails, ok, setTerrain, tile, unit, untilTurnOf } from './helpers';

function growGame() {
  const s = blankGame({ stars: 500 });
  const hq = addCity(s, 5, 5, 0, { hq: true });
  addCity(s, 10, 10, 1, { hq: true });
  s.factions[0].techs.push('supply');
  return { s, hq };
}

/** Bevoelkerung per Vorratslager hinzufuegen / add population via storehouses */
function addStorehouses(s: ReturnType<typeof growGame>['s'], positions: [number, number][]) {
  for (const [x, y] of positions) {
    setTerrain(s, x, y, 'plain', { resource: 'supplies' });
    ok(s, { type: 'build', building: 'storehouse', x, y });
  }
}

describe('Wachstum / growth', () => {
  it('level n -> n+1 needs n+1 population points', () => {
    expect(CITY.levelUpCost(1)).toBe(2);
    expect(CITY.levelUpCost(4)).toBe(5);
    const { s, hq } = growGame();
    expect(levelUpCost(s, hq)).toBe(2);
    addStorehouses(s, [[4, 4]]);
    expect(hq.level).toBe(1);
    expect(hq.pop).toBe(1);
    addStorehouses(s, [[4, 5]]);
    expect(hq.level).toBe(2);
    expect(hq.pop).toBe(0);
    expect(s.pendingRewards).toEqual([{ cityId: hq.id, level: 2 }]);
    expect(levelUpCost(s, hq)).toBe(3);
  });

  it('end of turn is blocked while a level reward is pending', () => {
    const { s, hq } = growGame();
    addStorehouses(s, [[4, 4], [4, 5]]);
    fails(s, { type: 'endTurn' }, 'pendingReward');
    ok(s, { type: 'reward', city: hq.id, choice: 'a' });
    endTurn(s);
  });

  it('reward options per level', () => {
    const { hq } = growGame();
    expect(rewardOptions(hq, 2)).toEqual(['factory', 'drone']);
    expect(rewardOptions(hq, 3)).toEqual(['bunkerRing', 'stars']);
    expect(rewardOptions(hq, 4)).toEqual(['expand', 'population']);
    expect(rewardOptions(hq, 5)).toEqual(['govQuarter', 'tank']);
    expect(rewardOptions(hq, 7)).toEqual(['govQuarter', 'tank']);
  });

  it('level 2: A factory (+5 income), B drone reveals a large area', () => {
    const { s, hq } = growGame();
    s.pendingRewards.push({ cityId: hq.id, level: 2 });
    const before = cityIncome(s, hq);
    ok(s, { type: 'reward', city: hq.id, choice: 'a' });
    expect(hq.factory).toBe(true);
    expect(cityIncome(s, hq)).toBe(before + 5);
    const g = growGame();
    g.s.pendingRewards.push({ cityId: g.hq.id, level: 2 });
    expect(explored(g.s, 0, 9, 9)).toBe(false);
    ok(g.s, { type: 'reward', city: g.hq.id, choice: 'b' });
    expect(explored(g.s, 0, 9, 9)).toBe(true); // Radius 4
    expect(explored(g.s, 0, 1, 1)).toBe(true);
  });

  it('level 3: A bunker ring (defense 4.0), B 25 stars', () => {
    const { s, hq } = growGame();
    s.pendingRewards.push({ cityId: hq.id, level: 3 }, { cityId: hq.id, level: 3 });
    ok(s, { type: 'reward', city: hq.id, choice: 'a' });
    expect(hq.bunkerRing).toBe(true);
    const stars = s.factions[0].stars;
    ok(s, { type: 'reward', city: hq.id, choice: 'b' });
    expect(s.factions[0].stars).toBe(stars + 25);
  });

  it('level 4: A expands the city area to 5x5, B gives 3 population', () => {
    const { s, hq } = growGame();
    expect(cityTiles(s, hq)).toHaveLength(9);
    s.pendingRewards.push({ cityId: hq.id, level: 4 });
    ok(s, { type: 'reward', city: hq.id, choice: 'a' });
    expect(hq.radius).toBe(2);
    expect(cityTiles(s, hq)).toHaveLength(25);
    const g = growGame();
    g.hq.level = 4;
    g.s.pendingRewards.push({ cityId: g.hq.id, level: 4 });
    ok(g.s, { type: 'reward', city: g.hq.id, choice: 'b' });
    expect(g.hq.pop).toBe(3);
  });

  it('expansion never takes tiles of another city (each tile belongs to at most one city)', () => {
    const { s, hq } = growGame();
    const other = addCity(s, 8, 5, 0);
    expect(tile(s, 7, 5).territory).toBe(other.id);
    s.pendingRewards.push({ cityId: hq.id, level: 4 });
    ok(s, { type: 'reward', city: hq.id, choice: 'a' });
    expect(tile(s, 7, 5).territory).toBe(other.id);
    expect(tile(s, 3, 3).territory).toBe(hq.id);
  });

  it('level 5+: A government quarter (+5 income, 250 points), B a tank', () => {
    const { s, hq } = growGame();
    s.pendingRewards.push({ cityId: hq.id, level: 5 });
    const sc = score(s, 0);
    const inc = cityIncome(s, hq);
    ok(s, { type: 'reward', city: hq.id, choice: 'a' });
    expect(hq.govQuarter).toBe(true);
    expect(cityIncome(s, hq)).toBe(inc + 5);
    expect(score(s, 0)).toBe(sc + SCORE.govQuarter);
    s.pendingRewards.push({ cityId: hq.id, level: 6 });
    ok(s, { type: 'reward', city: hq.id, choice: 'b' });
    const tank = s.units.find((u) => u.type === 'tank')!;
    expect(tank).toBeDefined();
    expect(tank.owner).toBe(0);
    expect(tank.hp).toBe(40);
  });

  it('no reward without pending level-up', () => {
    const { s, hq } = growGame();
    fails(s, { type: 'reward', city: hq.id, choice: 'a' }, 'noReward');
  });
});

describe('Einheitenlimit und Ausbildung / unit limit and training', () => {
  it('a city supports level + 1 units', () => {
    const s = blankGame({ factions: ['dravon', 'korvat'], stars: 500 });
    const c = addCity(s, 5, 5, 0, { hq: true, level: 2 });
    expect(unitLimit(s, c)).toBe(3);
    for (let i = 0; i < 3; i++) {
      ok(s, { type: 'train', city: c.id, unitType: 'infantry' });
      const u = s.units[s.units.length - 1];
      u.x = 1 + i; u.y = 1; // Stadtfeld freimachen / free the city tile
    }
    fails(s, { type: 'train', city: c.id, unitType: 'infantry' }, 'unitLimit');
  });

  it('trained units appear on the city tile and act only next turn', () => {
    const s = blankGame({ stars: 100 });
    const c = addCity(s, 5, 5, 0, { hq: true });
    addCity(s, 10, 10, 1, { hq: true });
    const r = ok(s, { type: 'train', city: c.id, unitType: 'infantry' });
    const u = s.units[s.units.length - 1];
    expect(r.events[0]).toMatchObject({ t: 'train', unit: u.id });
    expect([u.x, u.y]).toEqual([5, 5]);
    expect(u.homeCity).toBe(c.id);
    fails(s, { type: 'move', unit: u.id, to: { x: 5, y: 4 } }, 'fresh');
    // Stadtfeld besetzt / city tile occupied
    fails(s, { type: 'train', city: c.id, unitType: 'infantry' }, 'occupied');
    untilTurnOf(s, 0);
    ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 4 } });
  });

  it('training requires tech, stars and an own city; the tank cannot be bought', () => {
    const s = blankGame({ stars: 12 });
    const c = addCity(s, 5, 5, 0, { hq: true });
    const e = addCity(s, 9, 9, 1, { hq: true });
    expect(trainCheck(s, c, 'jeep')).toBe('techMissing');
    expect(trainCheck(s, c, 'tank')).toBe('invalid');
    expect(trainCheck(s, c, 'landingBoat')).toBe('invalid');
    fails(s, { type: 'train', city: e.id, unitType: 'infantry' }, 'notYourCity');
    s.factions[0].stars = 7;
    fails(s, { type: 'train', city: c.id, unitType: 'infantry' }, 'notEnoughStars');
  });
});

describe('Einnahme / capture', () => {
  function capGame() {
    const s = blankGame({ stars: 0 });
    addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 9, 9, 1, { hq: true });
    return s;
  }

  it('a neutral settlement becomes a level-1 city with 3x3 territory', () => {
    const s = capGame();
    const v = addCity(s, 5, 5, null);
    expect(tile(s, 5, 4).territory).toBeNull();
    const u = addUnit(s, 'infantry', 0, 5, 5);
    expect(captureKind(s, u)).toBe('village');
    const r = ok(s, { type: 'capture', unit: u.id });
    expect(r.events.some((e) => e.t === 'capture')).toBe(true);
    expect(v.owner).toBe(0);
    expect(v.level).toBe(1);
    expect(cityTiles(s, v)).toHaveLength(9);
    // Einnahme verbraucht den Zug / capture uses the unit's turn
    expect(unit(s, u.id)!.exhausted).toBe(true);
    fails(s, { type: 'move', unit: u.id, to: { x: 5, y: 4 } });
  });

  it('the unit must stand on the target at the start of its own turn', () => {
    const s = capGame();
    addCity(s, 5, 5, null);
    const u = addUnit(s, 'infantry', 0, 5, 6);
    ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 5 } });
    expect(captureKind(s, unit(s, u.id)!)).toBeNull();
    fails(s, { type: 'capture', unit: u.id }, 'cannotCapture');
    untilTurnOf(s, 0);
    ok(s, { type: 'capture', unit: u.id });
  });

  it('a unit that already attacked cannot capture', () => {
    const s = capGame();
    addCity(s, 5, 5, null);
    const u = addUnit(s, 'infantry', 0, 5, 5);
    const e = addUnit(s, 'infantry', 1, 5, 6);
    s.factions[0].explored = s.factions[0].explored.map(() => 1);
    ok(s, { type: 'attack', unit: u.id, target: e.id });
    fails(s, { type: 'capture', unit: u.id }, 'cannotCapture');
  });

  it('an enemy city can be captured; its supported units lose their home', () => {
    const s = capGame();
    const c = addCity(s, 5, 5, 1, { level: 3 });
    const supported = addUnit(s, 'infantry', 1, 8, 1, { homeCity: c.id });
    const u = addUnit(s, 'infantry', 0, 5, 5);
    ok(s, { type: 'capture', unit: u.id });
    expect(c.owner).toBe(0);
    expect(c.level).toBe(3);
    expect(unit(s, supported.id)!.homeCity).toBeNull();
    expect(tile(s, 4, 4).territory).toBe(c.id);
  });

  it('own cities and cities of factions at peace cannot be captured', () => {
    const s = capGame();
    const c = addCity(s, 5, 5, 1);
    const u = addUnit(s, 'infantry', 0, 5, 5);
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    expect(captureKind(s, u)).toBeNull();
    const own = addUnit(s, 'infantry', 0, 1, 1);
    expect(captureKind(s, own)).toBeNull();
    void c;
  });

  it('helicopter, ships and spies cannot capture', () => {
    const s = capGame();
    addCity(s, 5, 5, null);
    const h = addUnit(s, 'heli', 0, 5, 5);
    expect(captureKind(s, h)).toBeNull();
    fails(s, { type: 'capture', unit: h.id }, 'cannotCapture');
    h.type = 'spy';
    expect(captureKind(s, h)).toBeNull();
  });

  it('capturing the HQ does not give the captor the HQ bonus', () => {
    const s = capGame();
    addCity(s, 3, 9, 1); // zweite Stadt, damit Fraktion 1 lebt / second city keeps faction 1 alive
    const hq1 = s.cities.find((c) => c.isHQ && c.owner === 1)!;
    const u = addUnit(s, 'infantry', 0, hq1.x, hq1.y);
    ok(s, { type: 'capture', unit: u.id });
    expect(hq1.owner).toBe(0);
    expect(cityIncome(s, hq1)).toBe(5);
    expect(s.factions[1].alive).toBe(true);
  });
});
