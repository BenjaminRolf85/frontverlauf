import { describe, expect, it } from 'vitest';
import { contactStars, embassyCost, embassyIncome, isHostile, score } from '../src/core';
import { ECON, type TechId, INCOME } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, untilTurnOf } from './helpers';

describe('Erstkontakt / first contact', () => {
  function cg() {
    const s = blankGame({ contacts: false, stars: 0 });
    addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 0, 10, 1, { hq: true }); // Ecke: 4 Gebietsfelder / corner: 4 territory tiles
    return s;
  }

  it('15 stars per started 1000 points of the other faction, at most 60', () => {
    expect(ECON.firstContactPer1000).toBe(15);
    expect(ECON.firstContactMax).toBe(60);
    const s = cg();
    // Fraktion 1: Stadt 50 + 4 Felder*20 + Motorisierung 100 = 230 / faction 1 score
    expect(score(s, 1)).toBe(230);
    expect(contactStars(s, 1)).toBe(15);
    const add = (techs: TechId[]) => s.factions[1].techs.push(...techs);
    add(['roadbuilding', 'logistics', 'aerodynamics', 'armyAviation']); // +1000 -> 1230
    expect(score(s, 1)).toBe(1230);
    expect(contactStars(s, 1)).toBe(30);
    add(['supply', 'agritech', 'foodIndustry', 'fortification', 'intelligence']); // +1100 -> 2330
    expect(contactStars(s, 1)).toBe(45);
    add(['mountainTraining', 'mining', 'armsIndustry']); // +600 -> 2930
    expect(contactStars(s, 1)).toBe(45);
    add(['highAltitude']); // 3130
    expect(contactStars(s, 1)).toBe(60);
    add(['cybernetics', 'coastalEconomy', 'diving', 'navalArtillery']); // 4030
    expect(score(s, 1)).toBe(4030);
    expect(contactStars(s, 1)).toBe(60);
  });

  it('meeting another faction for the first time gives the stars once', () => {
    const s = cg();
    addUnit(s, 'infantry', 1, 6, 6);
    const u = addUnit(s, 'infantry', 0, 4, 6);
    const expected = contactStars(s, 1);
    const r = ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 6 } });
    expect(r.events.find((e) => e.t === 'contact')).toMatchObject({ a: 0, b: 1, stars: expected });
    expect(s.factions[0].stars).toBe(expected);
    expect(s.factions[0].contacts).toEqual([1]);
    const me = s.units.find((o) => o.id === u.id)!;
    me.moved = false;
    const r2 = ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 5 } });
    expect(r2.events.some((e) => e.t === 'contact')).toBe(false);
    // die andere Seite erhaelt ihren Kontakt, sobald sie selbst trifft / the other side gets its own contact when it meets
    endTurn(s);
    expect(s.factions[1].contacts).toEqual([]); // sieht nichts / sees nothing yet
    revealAll(s, 1);
    s.factions[1].stars = 100;
    ok(s, { type: 'research', tech: 'roadbuilding' });
    expect(s.factions[1].contacts).toEqual([0]);
  });

  it('diplomacy requires contact', () => {
    const s = cg();
    fails(s, { type: 'diplomacy', action: 'proposePeace', target: 1 }, 'noContact');
  });
});

describe('Frieden / peace', () => {
  function pg(n = 2) {
    const ids = (['korvat', 'dravon', 'alvenia', 'meridon'] as const).slice(0, n);
    const s = blankGame({ factions: [...ids], stars: 500 });
    addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 9, 1, 1, { hq: true });
    if (n > 2) addCity(s, 1, 9, 2, { hq: true });
    if (n > 3) addCity(s, 9, 9, 3, { hq: true });
    for (const f of s.factions) revealAll(s, f.index);
    return s;
  }

  it('factions start at war', () => {
    const s = pg();
    expect(isHostile(s, 0, 1)).toBe(true);
  });

  it('two factions make peace: offer and acceptance', () => {
    const s = pg();
    ok(s, { type: 'diplomacy', action: 'proposePeace', target: 1 });
    expect(s.factions[1].peaceOffers).toEqual([0]);
    fails(s, { type: 'diplomacy', action: 'proposePeace', target: 1 }, 'invalid');
    endTurn(s);
    ok(s, { type: 'diplomacy', action: 'acceptPeace', target: 0 });
    expect(s.factions[0].relations[1]).toBe('peace');
    expect(s.factions[1].relations[0]).toBe('peace');
    expect(isHostile(s, 1, 0)).toBe(false);
  });

  it('a counter-proposal also makes peace; offers can be declined', () => {
    const s = pg();
    ok(s, { type: 'diplomacy', action: 'proposePeace', target: 1 });
    endTurn(s);
    ok(s, { type: 'diplomacy', action: 'proposePeace', target: 0 });
    expect(s.factions[0].relations[1]).toBe('peace');
    const s2 = pg();
    ok(s2, { type: 'diplomacy', action: 'proposePeace', target: 1 });
    endTurn(s2);
    ok(s2, { type: 'diplomacy', action: 'declinePeace', target: 0 });
    expect(s2.factions[1].peaceOffers).toEqual([]);
    expect(s2.factions[0].relations[1]).toBe('war');
    fails(s2, { type: 'diplomacy', action: 'acceptPeace', target: 0 }, 'invalid');
  });

  it('a break must be announced one round ahead', () => {
    const s = pg();
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    fails(s, { type: 'attack', unit: a.id, target: d.id }, 'peace');
    const round = s.round;
    ok(s, { type: 'diplomacy', action: 'announceBreak', target: 1 });
    expect(s.factions[0].relations[1]).toBe('breaking');
    expect(s.factions[1].relations[0]).toBe('breaking');
    // in derselben Runde noch kein Angriff / no attack in the same round
    fails(s, { type: 'attack', unit: a.id, target: d.id }, 'peace');
    endTurn(s);
    // Gegenseite kann waehrend der Ankuendigung auch nicht angreifen / the other side cannot attack either
    fails(s, { type: 'attack', unit: d.id, target: a.id }, 'peace');
    endTurn(s);
    expect(s.round).toBe(round + 1);
    expect(s.factions[0].relations[1]).toBe('war');
    expect(s.factions[1].relations[0]).toBe('war');
    ok(s, { type: 'attack', unit: a.id, target: d.id });
  });

  it('announcing a break needs peace', () => {
    const s = pg();
    fails(s, { type: 'diplomacy', action: 'announceBreak', target: 1 }, 'invalid');
  });
});

describe('Botschaft / embassy', () => {
  function eg() {
    const s = blankGame({ factions: ['korvat', 'dravon', 'meridon', 'velkar'], stars: 500 });
    addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 9, 1, 1, { hq: true });
    addCity(s, 1, 9, 2, { hq: true });
    addCity(s, 9, 9, 3, { hq: true });
    revealAll(s, 0);
    s.factions[0].techs.push('supply', 'fortification', 'intelligence');
    return s;
  }

  it('needs the intelligence technology', () => {
    const s = eg();
    s.factions[0].techs = ['livestock'];
    fails(s, { type: 'diplomacy', action: 'embassy', target: 1 }, 'techMissing');
  });

  it('the HQ of the other faction must be known', () => {
    const s = eg();
    s.factions[0].explored = s.factions[0].explored.map(() => 0);
    fails(s, { type: 'diplomacy', action: 'embassy', target: 1 }, 'invalidTarget');
  });

  it('first costs 25, each further one 25 more than the previous', () => {
    const s = eg();
    expect(embassyCost(s, 0)).toBe(25);
    ok(s, { type: 'diplomacy', action: 'embassy', target: 1 });
    expect(s.factions[0].stars).toBe(475);
    expect(embassyCost(s, 0)).toBe(50);
    ok(s, { type: 'diplomacy', action: 'embassy', target: 2 });
    expect(s.factions[0].stars).toBe(425);
    expect(embassyCost(s, 0)).toBe(75);
    ok(s, { type: 'diplomacy', action: 'embassy', target: 3 });
    expect(s.factions[0].stars).toBe(350);
    fails(s, { type: 'diplomacy', action: 'embassy', target: 3 }, 'alreadyBuilt');
  });

  it('brings both sides 10 stars per round', () => {
    const s = eg();
    const before1 = s.factions[1].stars;
    ok(s, { type: 'diplomacy', action: 'embassy', target: 1 });
    expect(embassyIncome(s, 0)).toBe(10);
    expect(embassyIncome(s, 1)).toBe(10);
    expect(embassyIncome(s, 2)).toBe(0);
    endTurn(s);
    expect(s.factions[1].stars).toBe(before1 + INCOME.perCityLevel + INCOME.hq + 10); // HQ + Botschaft 10 / HQ + embassy 10
    untilTurnOf(s, 0);
    expect(s.factions[0].stars).toBe(475 + INCOME.perCityLevel + INCOME.hq + 10);
  });

  it('an embassy ends when the host HQ is lost', () => {
    const s = eg();
    ok(s, { type: 'diplomacy', action: 'embassy', target: 1 });
    addCity(s, 5, 5, 1);
    const hq1 = s.cities.find((c) => c.isHQ && c.owner === 1)!;
    const u = addUnit(s, 'infantry', 0, hq1.x, hq1.y);
    ok(s, { type: 'capture', unit: u.id });
    expect(s.factions[0].embassies).toEqual([]);
    expect(embassyIncome(s, 0)).toBe(0);
  });
});
