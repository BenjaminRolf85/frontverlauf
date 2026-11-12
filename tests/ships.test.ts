import { describe, expect, it } from 'vitest';
import { reachable, upgradeCheck, score } from '../src/core';
import { UNITS } from '../src/data/balance';
import { addCity, addUnit, blankGame, fails, ok, setTerrain, unit, untilTurnOf } from './helpers';

/** Kueste: Land x<=4, Flachwasser x=5..7, Ozean x>=8 / coast: land x<=4, shallow 5..7, ocean >=8 */
function coast() {
  const s = blankGame({ factions: ['meridon', 'dravon'], stars: 500 });
  for (let y = 0; y < 11; y++) {
    for (let x = 5; x < 11; x++) setTerrain(s, x, y, x <= 7 ? 'shallow' : 'ocean');
  }
  setTerrain(s, 10, 0, 'plain');
  const hq = addCity(s, 4, 5, 0, { hq: true });
  addCity(s, 10, 0, 1, { hq: true });
  return { s, hq };
}

describe('Schiffe / ships', () => {
  it('ship stats of the spec', () => {
    expect(UNITS.landingBoat).toMatchObject({ cost: 0, attack: 0, defense: 1, move: 2, range: 0, tech: 'coastalEconomy' });
    expect(UNITS.submarine).toMatchObject({ cost: 25, attack: 2, defense: 1, move: 3, range: 2, vision: 2, tech: 'diving' });
    expect(UNITS.destroyer).toMatchObject({ cost: 25, attack: 3, defense: 3, move: 3, range: 1, tech: 'shipbuilding' });
    expect(UNITS.battleship).toMatchObject({ cost: 75, attack: 3, defense: 2, move: 2, range: 3, tech: 'navalArtillery' });
  });

  it('a land unit becomes a landing boat for free at an own naval base', () => {
    const { s } = coast();
    ok(s, { type: 'build', building: 'navalBase', x: 5, y: 5 });
    const stars = s.factions[0].stars;
    const u = addUnit(s, 'mg', 0, 4, 4);
    const r = ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 5 } });
    expect(r.events.some((e) => e.t === 'embark')).toBe(true);
    const boat = unit(s, u.id)!;
    expect(boat.type).toBe('landingBoat');
    expect(boat.carried).toBe('mg');
    expect(boat.hp).toBe(15);
    expect(s.factions[0].stars).toBe(stars);
  });

  it('no embarking without a naval base or at a foreign one', () => {
    const { s } = coast();
    const u = addUnit(s, 'infantry', 0, 4, 4);
    expect(reachable(s, u).some((p) => p.x === 5)).toBe(false);
    setTerrain(s, 5, 4, 'shallow', { building: 'navalBase', territory: null });
    expect(reachable(s, u).some((p) => p.x === 5 && p.y === 4)).toBe(false);
  });

  it('landing boat moves 2 on water, ocean only with diving', () => {
    const { s } = coast();
    const b = addUnit(s, 'landingBoat', 0, 7, 5);
    const r = reachable(s, b);
    expect(r.some((p) => p.x === 8)).toBe(false);
    expect(r.some((p) => p.x === 6 && p.y === 3)).toBe(true);
    s.factions[0].techs.push('diving');
    expect(reachable(s, b).some((p) => p.x === 9 && p.y === 5)).toBe(true);
  });

  it('upgrade in own territory for the upgrade price; not outside', () => {
    const { s } = coast();
    s.factions[0].techs.push('shipbuilding', 'diving', 'navalArtillery');
    const b = addUnit(s, 'landingBoat', 0, 5, 5);
    const far = addUnit(s, 'landingBoat', 0, 7, 9);
    expect(upgradeCheck(s, far, 'destroyer')).toBe('notInTerritory');
    fails(s, { type: 'upgrade', unit: far.id, to: 'destroyer' }, 'notInTerritory');
    ok(s, { type: 'upgrade', unit: b.id, to: 'destroyer' });
    expect(unit(s, b.id)!.type).toBe('destroyer');
    expect(s.factions[0].stars).toBe(475);
    ok(s, { type: 'upgrade', unit: b.id, to: 'battleship' });
    expect(s.factions[0].stars).toBe(400);
    expect(upgradeCheck(s, b, 'landingBoat')).toBe('invalid');
    const land = addUnit(s, 'infantry', 0, 3, 3);
    expect(upgradeCheck(s, land, 'destroyer')).toBe('invalid');
  });

  it('upgrade needs the tech and enough stars', () => {
    const { s } = coast();
    const b = addUnit(s, 'landingBoat', 0, 5, 5);
    expect(upgradeCheck(s, b, 'submarine')).toBe('techMissing');
    s.factions[0].techs.push('diving');
    s.factions[0].stars = 24;
    fails(s, { type: 'upgrade', unit: b.id, to: 'submarine' }, 'notEnoughStars');
  });

  it('a ship entering land becomes the carried unit again', () => {
    const { s } = coast();
    s.factions[0].techs.push('shipbuilding');
    const b = addUnit(s, 'destroyer', 0, 5, 3, { carried: 'jeep' });
    const r = ok(s, { type: 'move', unit: b.id, to: { x: 4, y: 3 } });
    expect(r.events.some((e) => e.t === 'disembark')).toBe(true);
    const u = unit(s, b.id)!;
    expect(u.type).toBe('jeep');
    expect(u.carried).toBeNull();
    expect(u.exhausted).toBe(true);
    untilTurnOf(s, 0);
    expect(reachable(s, unit(s, b.id)!).length).toBeGreaterThan(0);
  });

  it('disembarking onto a mountain needs mountain training', () => {
    const { s } = coast();
    setTerrain(s, 4, 2, 'mountain');
    const b = addUnit(s, 'landingBoat', 0, 5, 2);
    expect(reachable(s, b).some((p) => p.x === 4 && p.y === 2)).toBe(false);
  });

  it('score of a ship: carried unit price plus upgrade price', () => {
    const { s } = coast();
    s.factions[0].explored = s.factions[0].explored.map(() => 0);
    const base = score(s, 0);
    addUnit(s, 'battleship', 0, 6, 6, { carried: 'mg' });
    expect(score(s, 0)).toBe(base + 25 + 75);
  });
});
