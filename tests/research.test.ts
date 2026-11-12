import { describe, expect, it } from 'vitest';
import { researchCost, techState, techUnlocks, trainCheck } from '../src/core';
import { ECON, TECHS, TECH_IDS, type TechId } from '../src/data/balance';
import { addCity, blankGame, fails, ok } from './helpers';

function withCities(n: number, faction: 'korvat' | 'velkar' = 'korvat') {
  const s = blankGame({ factions: [faction, 'dravon'], stars: 1000 });
  addCity(s, 0, 0, 0, { hq: true });
  for (let i = 1; i < n; i++) addCity(s, 3 * i, 5, 0);
  addCity(s, 10, 10, 1, { hq: true });
  return s;
}

describe('Forschungskosten / research cost', () => {
  it('(tier x own cities + 4) x 5', () => {
    expect(ECON.researchCost(1, 1)).toBe(25);
    for (const cities of [1, 2, 3]) {
      const s = withCities(cities);
      expect(researchCost(s, 0, 'motorization')).toBe((1 * cities + 4) * 5);
      expect(researchCost(s, 0, 'roadbuilding')).toBe((2 * cities + 4) * 5);
      expect(researchCost(s, 0, 'logistics')).toBe((3 * cities + 4) * 5);
    }
    // jede weitere Stadt verteuert / every further city raises the price
    expect(researchCost(withCities(3), 0, 'logistics')).toBeGreaterThan(researchCost(withCities(2), 0, 'logistics'));
  });

  it('Velkar: 20 % discount, rounded up', () => {
    const s = withCities(1, 'velkar');
    expect(researchCost(s, 0, 'motorization')).toBe(20); // 25*0.8
    expect(researchCost(s, 0, 'roadbuilding')).toBe(24); // 30*0.8
    expect(researchCost(withCities(2, 'velkar'), 0, 'roadbuilding')).toBe(32); // 40*0.8
    expect(researchCost(withCities(3, 'velkar'), 0, 'motorization')).toBe(28); // 35*0.8
  });

  it('cybernetics: 33 % discount on all further techs, rounded up', () => {
    const s = withCities(1);
    s.factions[0].techs.push('cybernetics');
    expect(researchCost(s, 0, 'motorization')).toBe(17); // 25*0.67=16.75
    expect(researchCost(s, 0, 'logistics')).toBe(24); // 35*0.67=23.45
  });

  it('discounts are multiplied and then rounded up to whole stars', () => {
    const s = withCities(1, 'velkar');
    s.factions[0].techs.push('cybernetics');
    expect(researchCost(s, 0, 'motorization')).toBe(14); // 25*0.8*0.67=13.4
    expect(researchCost(s, 0, 'roadbuilding')).toBe(17); // 30*0.8*0.67=16.08
    const s2 = withCities(2, 'velkar');
    s2.factions[0].techs.push('cybernetics');
    expect(researchCost(s2, 0, 'logistics')).toBe(27); // 50*0.8*0.67=26.8
    // nicht: einzeln gerundet / not: rounded separately (ceil(ceil(25*0.8)*0.67)=14, ceil(ceil(30*0.8)*0.67)=17)
    const s3 = withCities(3, 'velkar');
    s3.factions[0].techs.push('cybernetics');
    // 65*0.8*0.67 = 34.84 -> 35 ; einzeln: ceil(52*0.67)=35 ; Vergleich mit Rohwert
    expect(researchCost(s3, 0, 'logistics')).toBe(Math.ceil(65 * 0.8 * 0.67 - 1e-9));
    for (const cities of [1, 2, 3, 4]) {
      const v = withCities(cities, 'velkar');
      v.factions[0].techs.push('cybernetics');
      for (const tech of TECH_IDS) {
        const raw = (TECHS[tech].tier * cities + 4) * 5 * 0.8 * (1 - 0.33);
        expect(researchCost(v, 0, tech)).toBe(Math.ceil(raw - 1e-9));
        expect(Number.isInteger(researchCost(v, 0, tech))).toBe(true);
      }
    }
  });
});

describe('Forschungsbaum / research tree', () => {
  it('25 technologies in 5 branches: root (tier 1) and two paths with tier 2 and tier 3', () => {
    expect(TECH_IDS).toHaveLength(25);
    for (let b = 0; b < 5; b++) {
      const techs = TECH_IDS.filter((t) => TECHS[t].branch === b);
      expect(techs).toHaveLength(5);
      const roots = techs.filter((t) => TECHS[t].tier === 1);
      expect(roots).toHaveLength(1);
      expect(TECHS[roots[0]].parent).toBeNull();
      const t2 = techs.filter((t) => TECHS[t].tier === 2);
      expect(t2).toHaveLength(2);
      for (const t of t2) expect(TECHS[t].parent).toBe(roots[0]);
      const t3 = techs.filter((t) => TECHS[t].tier === 3);
      expect(t3).toHaveLength(2);
      expect(new Set(t3.map((t) => TECHS[t].parent))).toEqual(new Set(t2));
    }
  });

  it('matches the tree of the spec', () => {
    const tree: Record<string, [TechId, TechId | null]> = {
      roadbuilding: ['roadbuilding', 'motorization'], logistics: ['logistics', 'roadbuilding'],
      aerodynamics: ['aerodynamics', 'motorization'], armyAviation: ['armyAviation', 'aerodynamics'],
      agritech: ['agritech', 'supply'], foodIndustry: ['foodIndustry', 'agritech'],
      fortification: ['fortification', 'supply'], intelligence: ['intelligence', 'fortification'],
      mining: ['mining', 'mountainTraining'], armsIndustry: ['armsIndustry', 'mining'],
      highAltitude: ['highAltitude', 'mountainTraining'], cybernetics: ['cybernetics', 'highAltitude'],
      diving: ['diving', 'coastalEconomy'], navalArtillery: ['navalArtillery', 'diving'],
      shipbuilding: ['shipbuilding', 'coastalEconomy'], coastalDefense: ['coastalDefense', 'shipbuilding'],
      camouflage: ['camouflage', 'livestock'], fieldResearch: ['fieldResearch', 'camouflage'],
      forestry: ['forestry', 'livestock'], ballistics: ['ballistics', 'forestry'],
    };
    for (const [t, parent] of Object.values(tree)) expect(TECHS[t].parent).toBe(parent);
  });

  it('unlocks of the spec', () => {
    expect(techUnlocks('motorization').units).toEqual(['jeep']);
    expect(techUnlocks('roadbuilding').buildings).toEqual(['road', 'bridge']);
    expect(techUnlocks('logistics').buildings).toEqual(['logisticsCenter']);
    expect(techUnlocks('aerodynamics').buildings).toEqual(['researchCenter']);
    expect(techUnlocks('armyAviation').units).toEqual(['heli']);
    expect(techUnlocks('supply').buildings).toEqual(['storehouse']);
    expect(techUnlocks('agritech').buildings).toEqual(['farm']);
    expect(techUnlocks('foodIndustry').buildings).toEqual(['foodFactory']);
    expect(techUnlocks('fortification').units).toEqual(['pioneer']);
    expect(techUnlocks('intelligence').units).toEqual(['spy']);
    expect(techUnlocks('mining').buildings).toEqual(['mine']);
    expect(techUnlocks('armsIndustry')).toEqual({ units: ['mg'], buildings: ['steelMill'] });
    expect(techUnlocks('highAltitude').buildings).toEqual(['researchCenter']);
    expect(techUnlocks('cybernetics').units).toEqual(['medic']);
    expect(techUnlocks('coastalEconomy')).toEqual({ units: ['landingBoat'], buildings: ['fishery', 'navalBase'] });
    expect(techUnlocks('diving').units).toEqual(['submarine']);
    expect(techUnlocks('navalArtillery').units).toEqual(['battleship']);
    expect(techUnlocks('shipbuilding').units).toEqual(['destroyer']);
    expect(techUnlocks('coastalDefense').buildings).toEqual(['researchCenter']);
    expect(techUnlocks('livestock').buildings).toEqual(['ranch']);
    expect(techUnlocks('camouflage').units).toEqual(['sniper']);
    expect(techUnlocks('fieldResearch').buildings).toEqual(['researchCenter']);
    expect(techUnlocks('forestry').buildings).toEqual(['lumberCamp']);
    expect(techUnlocks('ballistics')).toEqual({ units: ['artillery'], buildings: ['materialsPlant'] });
  });

  it('a tech requires its predecessor; costs are deducted; no double research', () => {
    const s = withCities(1);
    s.factions[0].stars = 100;
    fails(s, { type: 'research', tech: 'roadbuilding' }, 'parentMissing');
    expect(techState(s, 0, 'roadbuilding')).toBe('locked');
    expect(techState(s, 0, 'motorization')).toBe('available');
    ok(s, { type: 'research', tech: 'motorization' });
    expect(s.factions[0].stars).toBe(75);
    expect(techState(s, 0, 'motorization')).toBe('researched');
    fails(s, { type: 'research', tech: 'motorization' }, 'alreadyResearched');
    ok(s, { type: 'research', tech: 'roadbuilding' });
    expect(s.factions[0].stars).toBe(45);
    s.factions[0].stars = 10;
    expect(techState(s, 0, 'logistics')).toBe('expensive');
    fails(s, { type: 'research', tech: 'logistics' }, 'notEnoughStars');
  });

  it('research unlocks training (jeep after motorization)', () => {
    const s = withCities(1);
    const hq = s.cities[0];
    expect(trainCheck(s, hq, 'jeep')).toBe('techMissing');
    ok(s, { type: 'research', tech: 'motorization' });
    expect(trainCheck(s, hq, 'jeep')).toBe('ok');
  });

  it('the tank is outside the tree', () => {
    for (const t of TECH_IDS) expect(techUnlocks(t).units).not.toContain('tank');
  });
});
