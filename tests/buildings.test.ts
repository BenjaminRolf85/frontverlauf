import { describe, expect, it } from 'vitest';
import { buildCheck, researchCenterPoints, score, reachable } from '../src/core';
import { BUILDINGS, SCORE, type BuildingId, type ResourceId, type TechId, type TerrainId } from '../src/data/balance';
import { addCity, addUnit, blankGame, fails, ok, setTerrain, tile } from './helpers';

function bgame() {
  const s = blankGame({ stars: 1000, factions: ['korvat', 'dravon'] });
  const hq = addCity(s, 5, 5, 0, { hq: true, radius: 2 });
  addCity(s, 10, 0, 1, { hq: true });
  return { s, hq };
}

describe('Gebaeude / buildings (table of section 6)', () => {
  const table: [BuildingId, number, number, TerrainId, ResourceId | null, TechId | null][] = [
    ['storehouse', 10, 1, 'plain', 'supplies', 'supply'],
    ['ranch', 10, 1, 'plain', 'livestock', 'livestock'],
    ['fishery', 10, 1, 'shallow', 'fish', 'coastalEconomy'],
    ['lumberCamp', 15, 1, 'forest', null, 'forestry'],
    ['farm', 25, 2, 'plain', 'farmland', 'agritech'],
    ['mine', 25, 2, 'mountain', 'ore', 'mining'],
    ['navalBase', 35, 1, 'shallow', null, 'coastalEconomy'],
    ['researchCenter', 100, 1, 'plain', null, 'aerodynamics'],
  ];
  for (const [b, cost, pop, terrain, resource, tech] of table) {
    it(`${b}: ${cost} stars, ${pop} population on ${terrain}${resource ? ' with ' + resource : ''}`, () => {
      expect(BUILDINGS[b].cost).toBe(cost);
      const { s, hq } = bgame();
      // Stufe hoch genug, damit kein Aufstieg die Bevoelkerung verbraucht / high level so no level-up eats pop
      hq.level = 9;
      setTerrain(s, 4, 4, terrain, { resource });
      if (tech && !s.factions[0].techs.includes(tech)) expect(buildCheck(s, 0, b, 4, 4)).toMatchObject({ ok: false, error: 'techMissing' });
      if (tech && !s.factions[0].techs.includes(tech)) s.factions[0].techs.push(tech);
      if (resource) {
        tile(s, 4, 4).resource = null;
        expect(buildCheck(s, 0, b, 4, 4).ok).toBe(false);
        tile(s, 4, 4).resource = resource;
      }
      ok(s, { type: 'build', building: b, x: 4, y: 4 });
      expect(tile(s, 4, 4).building).toBe(b);
      expect(s.factions[0].stars).toBe(1000 - cost);
      expect(hq.pop).toBe(pop);
      fails(s, { type: 'build', building: b, x: 4, y: 4 });
    });
  }

  it('buildings only inside the own city area', () => {
    const { s } = bgame();
    s.factions[0].techs.push('supply');
    setTerrain(s, 8, 8, 'plain', { resource: 'supplies' });
    fails(s, { type: 'build', building: 'storehouse', x: 8, y: 8 }, 'notInTerritory');
    setTerrain(s, 9, 1, 'plain', { resource: 'supplies' }); // Gebiet der Fraktion 1 / territory of faction 1
    fails(s, { type: 'build', building: 'storehouse', x: 9, y: 1 }, 'notInTerritory');
  });

  it('not enough stars', () => {
    const { s } = bgame();
    s.factions[0].stars = 9;
    s.factions[0].techs.push('supply');
    setTerrain(s, 4, 4, 'plain', { resource: 'supplies' });
    fails(s, { type: 'build', building: 'storehouse', x: 4, y: 4 }, 'notEnoughStars');
  });

  it('materials plant: 1 population per adjacent lumber camp, one per city', () => {
    const { s, hq } = bgame();
    hq.level = 9;
    s.factions[0].techs.push('forestry', 'ballistics');
    setTerrain(s, 3, 3, 'forest'); setTerrain(s, 4, 3, 'forest');
    ok(s, { type: 'build', building: 'lumberCamp', x: 3, y: 3 });
    ok(s, { type: 'build', building: 'lumberCamp', x: 4, y: 3 });
    expect(hq.pop).toBe(2);
    ok(s, { type: 'build', building: 'materialsPlant', x: 4, y: 4 });
    expect(hq.pop).toBe(4);
    fails(s, { type: 'build', building: 'materialsPlant', x: 6, y: 6 }, 'onePerCity');
    // spaeter angrenzender Forstbetrieb zaehlt auch / a later adjacent lumber camp also counts
    setTerrain(s, 3, 5, 'forest');
    ok(s, { type: 'build', building: 'lumberCamp', x: 3, y: 5 });
    expect(hq.pop).toBe(4 + 1 + 1);
  });

  it('food factory: 1 per adjacent farm; steel mill: 2 per adjacent mine', () => {
    const { s, hq } = bgame();
    hq.level = 30;
    s.factions[0].techs.push('agritech', 'foodIndustry', 'mountainTraining', 'mining', 'armsIndustry');
    setTerrain(s, 3, 3, 'plain', { resource: 'farmland' });
    setTerrain(s, 3, 6, 'mountain', { resource: 'ore' });
    setTerrain(s, 3, 7, 'mountain', { resource: 'ore' });
    ok(s, { type: 'build', building: 'farm', x: 3, y: 3 });
    ok(s, { type: 'build', building: 'mine', x: 3, y: 6 });
    ok(s, { type: 'build', building: 'mine', x: 3, y: 7 });
    expect(hq.pop).toBe(6);
    ok(s, { type: 'build', building: 'foodFactory', x: 4, y: 4 });
    expect(hq.pop).toBe(7);
    ok(s, { type: 'build', building: 'steelMill', x: 4, y: 6 });
    expect(hq.pop).toBe(7 + 4);
    fails(s, { type: 'build', building: 'steelMill', x: 6, y: 6 }, 'onePerCity');
    fails(s, { type: 'build', building: 'foodFactory', x: 6, y: 6 }, 'onePerCity');
  });

  it('logistics centre: one per city', () => {
    const { s } = bgame();
    s.factions[0].techs.push('roadbuilding', 'logistics');
    ok(s, { type: 'build', building: 'logisticsCenter', x: 4, y: 4 });
    fails(s, { type: 'build', building: 'logisticsCenter', x: 6, y: 6 }, 'onePerCity');
  });

  it('asphalt road: 15 per tile on land, halves movement', () => {
    const { s } = bgame();
    s.factions[0].techs.push('roadbuilding');
    ok(s, { type: 'build', building: 'road', x: 4, y: 5 });
    ok(s, { type: 'build', building: 'road', x: 3, y: 5 });
    expect(s.factions[0].stars).toBe(970);
    expect(tile(s, 4, 5).road).toBe(true);
    fails(s, { type: 'build', building: 'road', x: 4, y: 5 }, 'alreadyBuilt');
    setTerrain(s, 6, 6, 'shallow');
    fails(s, { type: 'build', building: 'road', x: 6, y: 6 }, 'invalidTile');
    const u = addUnit(s, 'infantry', 0, 5, 5);
    expect(reachable(s, u).some((p) => p.x === 3 && p.y === 5)).toBe(true);
  });

  it('steel bridge: on shallow water between two land tiles, walkable', () => {
    const { s } = bgame();
    s.factions[0].techs.push('roadbuilding');
    for (let y = 0; y < 11; y++) setTerrain(s, 6, y, 'shallow');
    setTerrain(s, 7, 7, 'ocean');
    ok(s, { type: 'build', building: 'bridge', x: 6, y: 5 });
    expect(s.factions[0].stars).toBe(975);
    const u = addUnit(s, 'infantry', 0, 5, 5);
    expect(reachable(s, u).some((p) => p.x === 6 && p.y === 5)).toBe(true);
    // Ozean / ocean not allowed
    fails(s, { type: 'build', building: 'bridge', x: 7, y: 7 });
  });

  it('research centre: tech depends on terrain; points grow every 3 rounds up to 300', () => {
    const { s, hq } = bgame();
    hq.level = 9;
    const cases: [TerrainId, TechId][] = [['plain', 'aerodynamics'], ['forest', 'fieldResearch'], ['mountain', 'highAltitude'], ['shallow', 'coastalDefense']];
    for (const [terrain, tech] of cases) {
      const g = bgame();
      setTerrain(g.s, 4, 4, terrain);
      g.s.factions[0].techs.push('mountainTraining');
      expect(buildCheck(g.s, 0, 'researchCenter', 4, 4)).toMatchObject({ ok: false, error: 'techMissing' });
      g.s.factions[0].techs.push(tech);
      expect(buildCheck(g.s, 0, 'researchCenter', 4, 4).ok).toBe(true);
    }
    s.factions[0].techs.push('aerodynamics');
    const before = score(s, 0);
    ok(s, { type: 'build', building: 'researchCenter', x: 4, y: 4 });
    const t = tile(s, 4, 4);
    expect(t.researchBuilt).toBe(s.round);
    expect(researchCenterPoints(s, t)).toBe(100);
    expect(score(s, 0)).toBe(before + 100);
    const r0 = s.round;
    s.round = r0 + 2; expect(researchCenterPoints(s, t)).toBe(100);
    s.round = r0 + 3; expect(researchCenterPoints(s, t)).toBe(150);
    s.round = r0 + 6; expect(researchCenterPoints(s, t)).toBe(200);
    s.round = r0 + 12; expect(researchCenterPoints(s, t)).toBe(SCORE.researchCenterMax);
    s.round = r0 + 30; expect(researchCenterPoints(s, t)).toBe(300);
  });

  it('naval base: 1 population, embarkation and sea connection', () => {
    const { s, hq } = bgame();
    s.factions[0].techs.push('coastalEconomy');
    setTerrain(s, 6, 5, 'shallow');
    ok(s, { type: 'build', building: 'navalBase', x: 6, y: 5 });
    expect(hq.pop).toBe(1);
  });

  it('buildings cannot be placed on cities, features or occupied resource tiles of another type', () => {
    const { s } = bgame();
    s.factions[0].techs.push('supply', 'agritech');
    expect(buildCheck(s, 0, 'farm', 5, 5).ok).toBe(false);
    setTerrain(s, 4, 4, 'plain', { feature: 'bunker', resource: 'supplies' });
    expect(buildCheck(s, 0, 'storehouse', 4, 4).ok).toBe(false);
    setTerrain(s, 4, 6, 'plain', { resource: 'supplies' });
    expect(buildCheck(s, 0, 'farm', 4, 6).ok).toBe(false);
  });
});

describe('Stadtverbindung / city connection', () => {
  it('a city connected to the HQ by road gives both 1 population', () => {
    const s = blankGame({ stars: 1000 });
    const hq = addCity(s, 2, 5, 0, { hq: true });
    const c = addCity(s, 5, 5, 0);
    hq.level = 9; c.level = 9;
    addCity(s, 10, 10, 1, { hq: true });
    s.factions[0].techs.push('roadbuilding');
    ok(s, { type: 'build', building: 'road', x: 3, y: 5 });
    expect(c.connected).toBe(false);
    const r = ok(s, { type: 'build', building: 'road', x: 4, y: 5 });
    expect(c.connected).toBe(true);
    expect(r.events.some((e) => e.t === 'connected' && e.city === c.id)).toBe(true);
    expect(hq.pop).toBe(1);
    expect(c.pop).toBe(1);
  });

  it('connection over a bridge', () => {
    const s = blankGame({ stars: 1000 });
    const hq = addCity(s, 2, 5, 0, { hq: true });
    const c = addCity(s, 5, 5, 0);
    hq.level = 9; c.level = 9;
    addCity(s, 10, 10, 1, { hq: true });
    for (let y = 0; y < 11; y++) setTerrain(s, 4, y, 'shallow');
    s.factions[0].techs.push('roadbuilding');
    ok(s, { type: 'build', building: 'road', x: 3, y: 5 });
    expect(c.connected).toBe(false);
    ok(s, { type: 'build', building: 'bridge', x: 4, y: 5 });
    expect(c.connected).toBe(true);
    expect(hq.pop).toBe(1);
    expect(c.pop).toBe(1);
  });

  it('connection over naval bases on the same water', () => {
    const s = blankGame({ stars: 1000 });
    const hq = addCity(s, 2, 5, 0, { hq: true });
    const c = addCity(s, 8, 5, 0);
    hq.level = 9; c.level = 9;
    addCity(s, 10, 10, 1, { hq: true });
    for (let y = 0; y < 11; y++) for (const x of [3, 4, 5, 6, 7]) setTerrain(s, x, y, 'shallow');
    s.factions[0].techs.push('coastalEconomy');
    ok(s, { type: 'build', building: 'navalBase', x: 3, y: 5 });
    expect(c.connected).toBe(false);
    ok(s, { type: 'build', building: 'navalBase', x: 7, y: 5 });
    expect(c.connected).toBe(true);
    // je 1 vom Hafen + 1 von der Verbindung / 1 each from the port + 1 from the connection
    expect(hq.pop).toBe(2);
    expect(c.pop).toBe(2);
  });
});
