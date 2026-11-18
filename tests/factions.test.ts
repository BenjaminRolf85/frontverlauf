import { describe, expect, it } from 'vitest';
import { embassyCost, embassyIncome, income, levelUpCost, researchCost, shadowBankIncome, siteOf, unitCost, unitLimit, veteranKills } from '../src/core';
import { FACTIONS, FACTION_IDS, PERKS, UNITS, type FactionId, type UnitTypeId } from '../src/data/balance';
import { addCity, addUnit, blankGame, ok, revealAll, unit } from './helpers';

function game(f: FactionId, other: FactionId = f === 'korvat' ? 'dravon' : 'korvat') {
  const s = blankGame({ factions: [f, other], stars: 1000 });
  const hq = addCity(s, 2, 2, 0, { hq: true });
  addCity(s, 8, 8, 1, { hq: true });
  return { s, hq };
}

describe('Fraktionen / factions', () => {
  it('five human factions with start techs of the spec, plus the Zyrr without tech', () => {
    expect(FACTION_IDS).toEqual(['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'vesper', 'nexus']);
    expect(FACTIONS.zyrr.startTech).toBeNull();
    expect(FACTIONS.nexus.startTech).toBe('coastalEconomy');
    expect(FACTIONS.vesper.startTech).toBe('livestock');
    expect(FACTIONS.korvat.startTech).toBe('livestock');
    expect(FACTIONS.dravon.startTech).toBe('motorization');
    expect(FACTIONS.alvenia.startTech).toBe('supply');
    expect(FACTIONS.meridon.startTech).toBe('coastalEconomy');
    expect(FACTIONS.velkar.startTech).toBe('mountainTraining');
  });

  describe('20 % unit discounts (Dravon and Meridon 30 %) / Einheitenrabatte (Dravon und Meridon 30 %)', () => {
    const cases: [FactionId, UnitTypeId, number, number, string | null][] = [
      ['korvat', 'infantry', 8, 10, null],
      // Dravon startet mit der Doktrin Motorisierung: 15*0.7=10.5 -> 11, dann Fahrzeuge -15 % -> 10
      // Dravon starts with the motorization doctrine: 15*0.7=10.5 -> 11, then vehicles -15 % -> 10
      ['dravon', 'jeep', 10, 15, 'motorization'],
      ['alvenia', 'sunLance', 36, 45, 'ballistics'],
      // Meridon: Spione 30 % billiger (Schattenflotte, vorher 20 %): 40*0.7 = 28 / Meridon: spies 30 % cheaper (shadow fleet, formerly 20 %): 40*0.7 = 28
      ['meridon', 'spy', 28, 40, 'intelligence'],
      ['velkar', 'pioneer', 12, 15, 'fortification'],
    ];
    for (const [f, type, price, full, tech] of cases) {
      it(`${f}: ${type} ${price} instead of ${full}`, () => {
        const { s, hq } = game(f);
        expect(FACTIONS[f].discountUnit).toBe(type);
        expect(unitCost(s, 0, type)).toBe(price);
        // andere Fraktion zahlt voll / other faction pays full price
        expect(UNITS[type].cost).toBe(full);
        if (!UNITS[type].faction) expect(unitCost(s, 1, type)).toBe(full);
        if (tech && !s.factions[0].techs.includes(tech as never)) s.factions[0].techs.push(tech as never);
        // Produktionsstaette der Einheit / the unit's production site
        hq.works = [siteOf(type)!];
        ok(s, { type: 'train', city: hq.id, unitType: type });
        expect(s.factions[0].stars).toBe(1000 - price);
      });
    }
  });

  it('Korvat (mass mobilisation): every city supports one more unit', () => {
    const { s, hq } = game('korvat');
    expect(unitLimit(s, hq)).toBe(hq.level + 2);
    const other = game('dravon').s;
    expect(unitLimit(other, other.cities[0])).toBe(2);
    // praktisch: 3 Einheiten in Stufe-1-Stadt / in practice: 3 units in a level-1 city
    for (let i = 0; i < 3; i++) {
      ok(s, { type: 'train', city: hq.id, unitType: 'infantry' });
      const u = s.units[s.units.length - 1]; u.x = i; u.y = 5;
    }
    expect(s.units.filter((u) => u.homeCity === hq.id)).toHaveLength(3);
  });

  it('Dravon (drill): veteran after 2 instead of 3 kills', () => {
    const { s } = game('dravon');
    revealAll(s, 0);
    const a = addUnit(s, 'tank', 0, 5, 5, { hp: 30 });
    expect(veteranKills(s, a)).toBe(2);
    for (let i = 0; i < 2; i++) {
      const d = addUnit(s, 'infantry', 1, 6, 5, { hp: 1 });
      const me = unit(s, a.id)!; me.attacked = false; me.exhausted = false;
      ok(s, { type: 'attack', unit: a.id, target: d.id });
    }
    expect(unit(s, a.id)!.veteran).toBe(true);
    expect(unit(s, a.id)!.maxHp).toBe(45);
    expect(unit(s, a.id)!.hp).toBe(45);
    const k = game('korvat').s;
    expect(veteranKills(k, addUnit(k, 'infantry', 0, 5, 5))).toBe(3);
  });

  it('Alvenia: embassies cost and bring the same as for everyone (no more alliance policy)', () => {
    const { s } = game('alvenia');
    const k = game('korvat', 'dravon').s;
    expect(embassyCost(k, 0)).toBe(25);
    expect(embassyCost(s, 0)).toBe(25);
    s.factions[0].embassies = [1];
    k.factions[0].embassies = [1];
    expect(embassyCost(s, 0)).toBe(50);
    expect(embassyIncome(s, 0)).toBe(6);
    expect(embassyIncome(k, 0)).toBe(6);
    expect(embassyIncome(s, 1)).toBe(6);
  });

  it('Meridon (Shadow Bank, formerly Boom): normal growth, but stars per own coastal city', () => {
    // Schattenbank statt Boom: Stadtaufstieg wie bei allen / Shadow Bank instead of Boom: level-ups as for everyone
    const { s, hq } = game('meridon');
    expect(levelUpCost(s, hq)).toBe(2);
    hq.level = 4;
    expect(levelUpCost(s, hq)).toBe(5);
    expect(FACTIONS.meridon.perk).toBe('shadowBank');
    // ohne Wasser keine Schattenbank, mit Wasser am Stadtfeld PERKS.shadowBankPerCoastalCity je Stadt
    // without water no Shadow Bank, with water next to the city tile PERKS.shadowBankPerCoastalCity per city
    const dry = income(s, 0);
    expect(shadowBankIncome(s, 0)).toBe(0);
    s.tiles[3 * s.size + 3].terrain = 'shallow';
    expect(shadowBankIncome(s, 0)).toBe(PERKS.shadowBankPerCoastalCity);
    expect(income(s, 0)).toBe(dry + PERKS.shadowBankPerCoastalCity);
    // andere Fraktionen: keine Schattenbank / other factions: no Shadow Bank
    const k = game('korvat');
    k.s.tiles[3 * k.s.size + 3].terrain = 'shallow';
    expect(shadowBankIncome(k.s, 0)).toBe(0);
  });

  it('Velkar (research lead): all technologies cost 12 % less', () => {
    const v = game('velkar').s;
    const k = game('korvat').s;
    expect(researchCost(k, 0, 'motorization')).toBe(25);
    expect(researchCost(v, 0, 'motorization')).toBe(22); // 25*0.88
    expect(researchCost(k, 0, 'logistics')).toBe(35);
    expect(researchCost(v, 0, 'logistics')).toBe(31); // 35*0.88=30.8
  });
});
