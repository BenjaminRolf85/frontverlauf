import { describe, expect, it } from 'vitest';
import { embassyCost, embassyIncome, levelUpCost, researchCost, unitCost, unitLimit, veteranKills } from '../src/core';
import { FACTIONS, FACTION_IDS, type FactionId, type UnitTypeId } from '../src/data/balance';
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
    expect(FACTIONS.nexus.startTech).toBeNull();
    expect(FACTIONS.vesper.startTech).toBe('livestock');
    expect(FACTIONS.korvat.startTech).toBe('livestock');
    expect(FACTIONS.dravon.startTech).toBe('motorization');
    expect(FACTIONS.alvenia.startTech).toBe('supply');
    expect(FACTIONS.meridon.startTech).toBe('coastalEconomy');
    expect(FACTIONS.velkar.startTech).toBe('mountainTraining');
  });

  describe('20 % unit discounts / Einheitenrabatte', () => {
    const cases: [FactionId, UnitTypeId, number, number, string | null][] = [
      ['korvat', 'infantry', 8, 10, null],
      ['dravon', 'jeep', 12, 15, 'motorization'],
      ['alvenia', 'medic', 20, 25, 'cybernetics'],
      ['meridon', 'spy', 32, 40, 'intelligence'],
      ['velkar', 'pioneer', 12, 15, 'fortification'],
    ];
    for (const [f, type, price, full, tech] of cases) {
      it(`${f}: ${type} ${price} instead of ${full}`, () => {
        const { s, hq } = game(f);
        expect(FACTIONS[f].discountUnit).toBe(type);
        expect(unitCost(s, 0, type)).toBe(price);
        // andere Fraktion zahlt voll / other faction pays full price
        expect(unitCost(s, 1, type)).toBe(full);
        if (tech && !s.factions[0].techs.includes(tech as never)) s.factions[0].techs.push(tech as never);
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

  it('Alvenia (alliance policy): embassies cost half and bring double income', () => {
    const { s } = game('alvenia');
    const k = game('korvat', 'dravon').s;
    expect(embassyCost(k, 0)).toBe(25);
    expect(embassyCost(s, 0)).toBe(13); // ceil(25*0.5)
    s.factions[0].embassies = [1];
    k.factions[0].embassies = [1];
    expect(embassyCost(s, 0)).toBe(25); // ceil(50*0.5)
    expect(embassyIncome(s, 0)).toBe(20);
    expect(embassyIncome(k, 0)).toBe(10);
    // die Gastgeberseite bekommt normales Einkommen / the host side gets normal income
    expect(embassyIncome(s, 1)).toBe(10);
  });

  it('Meridon (boom): each level-up needs one population point less, at least 1', () => {
    const { s, hq } = game('meridon');
    expect(levelUpCost(s, hq)).toBe(1); // 2-1
    hq.level = 4;
    expect(levelUpCost(s, hq)).toBe(4); // 5-1
    const k = game('korvat');
    expect(levelUpCost(k.s, k.hq)).toBe(2);
    // praktisch: 1 Punkt reicht fuer Stufe 2 / in practice: 1 point is enough for level 2
    const m = game('meridon');
    m.s.factions[0].techs.push('supply');
    m.s.tiles[1 * m.s.size + 1].resource = 'supplies';
    ok(m.s, { type: 'build', building: 'storehouse', x: 1, y: 1 });
    expect(m.hq.level).toBe(2);
  });

  it('Velkar (research lead): all technologies cost 20 % less', () => {
    const v = game('velkar').s;
    const k = game('korvat').s;
    expect(researchCost(k, 0, 'motorization')).toBe(25);
    expect(researchCost(v, 0, 'motorization')).toBe(20);
    expect(researchCost(k, 0, 'logistics')).toBe(35);
    expect(researchCost(v, 0, 'logistics')).toBe(28);
  });
});
