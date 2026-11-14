import { describe, expect, it } from 'vitest';
import { cityUpgradeCheck, combatPreview, effectiveDefense, radioTargets } from '../src/core';
import { CITY_UPGRADES, UNITS, VETERAN } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, explored, fails, ok, untilTurnOf } from './helpers';

function g(stars = 200) {
  const s = blankGame({ stars, size: 16 });
  const hq = addCity(s, 2, 2, 0, { hq: true });
  addCity(s, 13, 13, 1, { hq: true });
  // alle Ausbau-Technologien erforscht / all upgrade techs researched
  for (const f of s.factions) f.techs.push(...Object.values(CITY_UPGRADES.tech));
  return { s, hq };
}

describe('Stadt-Ausbauten / city upgrades', () => {
  it('drei Slots, jeder Ausbau einmal, Preis aus der Balancing-Datei / three slots, each once, price from balancing', () => {
    const { s, hq } = g();
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'bunker' });
    expect(s.factions[0].stars).toBe(200 - CITY_UPGRADES.cost.bunker);
    fails(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'bunker' }, 'alreadyBuilt');
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'barracks' });
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'radioTower', target: { x: 7, y: 7 } });
    expect(hq.upgrades).toEqual(['bunker', 'barracks', 'radioTower']);
    expect(CITY_UPGRADES.slots).toBe(3);
  });

  it('nicht ohne Sterne, nicht in fremden Staedten / not without stars, not in foreign cities', () => {
    const { s, hq } = g(10);
    fails(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'barracks' }, 'notEnoughStars');
    const enemy = s.cities.find((c) => c.owner === 1)!;
    s.factions[0].stars = 100;
    expect(cityUpgradeCheck(s, 0, enemy, 'bunker')).toBe('notYourCity');
    fails(s, { type: 'cityUpgrade', city: enemy.id, upgrade: 'bunker' });
  });

  it('Funkturm deckt einmalig einen 5x5-Bereich im Umkreis 6 auf / radio tower reveals a 5x5 area within range 6 once', () => {
    const { s, hq } = g();
    s.factions[0].explored = s.factions[0].explored.map(() => 0);
    expect(radioTargets(s, 0, hq).length).toBeGreaterThan(0);
    fails(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'radioTower' }, 'invalidTarget');
    fails(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'radioTower', target: { x: 12, y: 12 } }, 'invalidTarget');
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'radioTower', target: { x: 8, y: 6 } });
    for (let y = 4; y <= 8; y++) for (let x = 6; x <= 10; x++) expect(explored(s, 0, x, y)).toBe(true);
    expect(explored(s, 0, 11, 6)).toBe(false);
    fails(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'radioTower', target: { x: 3, y: 7 } }, 'alreadyBuilt');
  });

  it('Bunker: +2 Verteidigung fuer eigene Einheiten in der Stadt / bunker: +2 defence for own units in the city', () => {
    const { s, hq } = g();
    const def = addUnit(s, 'infantry', 0, 2, 2);
    const att = addUnit(s, 'infantry', 1, 3, 2);
    const before = combatPreview(s, att, def);
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'bunker' });
    expect(effectiveDefense(s, def)).toBe(UNITS.infantry.defense + CITY_UPGRADES.bunkerDefense);
    const after = combatPreview(s, att, def);
    expect(after.toDefender).toBeLessThan(before.toDefender);
    // ausserhalb der Stadt kein Bonus / no bonus outside the city
    const out = addUnit(s, 'infantry', 0, 5, 5);
    expect(effectiveDefense(s, out)).toBe(UNITS.infantry.defense);
  });

  it('Kaserne: ausgebildete Einheiten sind sofort Veteranen / barracks: trained units are veterans right away', () => {
    const { s, hq } = g();
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'barracks' });
    ok(s, { type: 'train', city: hq.id, unitType: 'infantry' });
    const u = s.units.find((x) => x.owner === 0 && x.x === hq.x && x.y === hq.y)!;
    expect(u.veteran).toBe(true);
    expect(u.maxHp).toBe(UNITS.infantry.hp + VETERAN.bonusHp);
    expect(u.hp).toBe(u.maxHp);
  });

  it('Ausbauten bleiben beim Eroberer / upgrades stay with the conqueror', () => {
    const { s } = g();
    const c = addCity(s, 8, 8, 1);
    c.upgrades = ['bunker', 'barracks'];
    const u = addUnit(s, 'infantry', 0, 8, 8);
    endTurn(s); untilTurnOf(s, 0);
    ok(s, { type: 'capture', unit: u.id });
    expect(c.owner).toBe(0);
    expect(c.upgrades).toEqual(['bunker', 'barracks']);
  });
});

describe('Stadt-Ausbauten brauchen Forschung / city upgrades need research', () => {
  it('ohne Technologie gesperrt, mit Technologie frei; ohne Forschung nach Stadtstufe / locked without tech; level for no-research factions', async () => {
    const { cityUpgradeCheck } = await import('../src/core');
    const s = blankGame({ stars: 200, size: 16 });
    const hq = addCity(s, 2, 2, 0, { hq: true });
    addCity(s, 13, 13, 1, { hq: true });
    s.factions[0].techs = [];
    expect(cityUpgradeCheck(s, 0, hq, 'bunker')).toBe('techMissing');
    s.factions[0].techs.push(CITY_UPGRADES.tech.bunker);
    expect(cityUpgradeCheck(s, 0, hq, 'bunker')).toBe('ok');
    const z = blankGame({ stars: 200, size: 16, factions: ['zyrr', 'korvat'] });
    const zc = addCity(z, 2, 2, 0, { hq: true });
    addCity(z, 13, 13, 1, { hq: true });
    expect(cityUpgradeCheck(z, 0, zc, 'depot')).toBe('cityLevel');
    zc.level = 4;
    expect(cityUpgradeCheck(z, 0, zc, 'depot')).toBe('ok');
  });
});
