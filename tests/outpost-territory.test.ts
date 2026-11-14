import { describe, expect, it } from 'vitest';
import { cityTiles, territoryOwner } from '../src/core';
import { addCity, addUnit, blankGame, ok, revealAll, tile } from './helpers';

function og() {
  const s = blankGame({ stars: 200, factions: ['meridon', 'dravon'] });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  for (const f of s.factions) f.techs.push('fortification');
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Aussenposten erweitern das Gebiet / outposts extend territory', () => {
  it('an outpost bordering own territory adds the free 3x3 around it to the adjacent city', () => {
    const s = og();
    const hq = s.cities.find((c) => c.owner === 0)!;
    const before = cityTiles(s, hq).length;
    expect(territoryOwner(s, tile(s, 3, 3))).toBeNull();
    const u = addUnit(s, 'infantry', 0, 3, 3);
    ok(s, { type: 'outpost', unit: u.id });
    for (const [x, y] of [[3, 3], [4, 4], [2, 4], [4, 2]]) expect(territoryOwner(s, tile(s, x, y)), `${x},${y}`).toBe(0);
    // 3x3 um (3,3) ohne das schon eigene Feld (2,2) / 3x3 around (3,3) minus the already owned tile (2,2)
    expect(cityTiles(s, hq).length).toBe(before + 8);
  });

  it('an outpost away from own territory does not extend it', () => {
    const s = og();
    const u = addUnit(s, 'infantry', 0, 5, 5);
    ok(s, { type: 'outpost', unit: u.id });
    expect(tile(s, 5, 5).territory).toBeNull();
    expect(tile(s, 5, 5).outpost?.owner).toBe(0);
  });

  it('never takes territory that already belongs to another city', () => {
    const s = og();
    // feindliches Gebiet bei (8..10, 8..10); Posten bei (7,7) grenzt nicht an eigenes Gebiet
    s.current = 1;
    const u = addUnit(s, 'infantry', 1, 7, 7);
    ok(s, { type: 'outpost', unit: u.id });
    expect(territoryOwner(s, tile(s, 7, 7))).toBe(1);
    expect(territoryOwner(s, tile(s, 8, 8))).toBe(1);
    expect(territoryOwner(s, tile(s, 2, 2))).toBe(0);
  });

  it('a captured outpost releases its tiles; the captor only claims them if it borders its own territory', () => {
    const s = og();
    const u = addUnit(s, 'infantry', 0, 3, 3);
    ok(s, { type: 'outpost', unit: u.id });
    expect(territoryOwner(s, tile(s, 4, 4))).toBe(0);
    // Gegner erobert den Posten: Dravon-Gebiet liegt weit weg, also werden die Felder frei
    s.units = s.units.filter((x) => x.id !== u.id);
    const e = addUnit(s, 'infantry', 1, 3, 3);
    s.current = 1;
    ok(s, { type: 'capture', unit: e.id });
    expect(tile(s, 3, 3).outpost?.owner).toBe(1);
    expect(tile(s, 4, 4).territory).toBeNull();
    expect(tile(s, 3, 3).territory).toBeNull();
    // das eigentliche Stadtgebiet bleibt / the real city territory stays
    expect(territoryOwner(s, tile(s, 2, 2))).toBe(0);
  });
});
