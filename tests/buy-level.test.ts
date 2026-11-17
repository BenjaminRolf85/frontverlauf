/**
 * Stufe mit Sternen kaufen und Einheitenlimit durch Stadt-Ausbauten.
 * Buying a city level with stars and the unit limit from city upgrades.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, buyLevelCheck, cityIncome, cultSlots, levelUpCost, rewardOptions, trainCheck, unitLimit, upgradeUnitLimit } from '../src/core';
import { CITY, CITY_UPGRADES, INCOME, PERKS, SUPPLY_LINE, TOWER } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { addCity, addUnit, blankGame, endTurn, fails, giveSites, ok, untilTurnOf } from './helpers';

function g(stars = 500) {
  const s = blankGame({ stars, size: 14 });
  const hq = addCity(s, 2, 2, 0, { hq: true });
  addCity(s, 11, 11, 1, { hq: true });
  for (const f of s.factions) f.techs.push(...Object.values(CITY_UPGRADES.tech));
  return { s, hq };
}

describe('Stufe kaufen / buy level', () => {
  it('Preis steigt mit der Stufe und ist gut doppelt so hoch wie Wachstum / price rises with the level, a good twice the cost of growth', () => {
    expect(CITY.buyLevelCost(1)).toBe(50);
    expect(CITY.buyLevelCost(2)).toBe(75);
    expect(CITY.buyLevelCost(3)).toBe(100);
    expect(CITY.buyLevelCost(5)).toBe(150);
    // ein Bevoelkerungspunkt kostet ueber Gebaeude hoechstens etwa 12,5 Sterne / a population point costs at most about 12.5 stars via buildings
    for (let lv = 1; lv <= 8; lv++) expect(CITY.buyLevelCost(lv)).toBeGreaterThanOrEqual(2 * 12.5 * CITY.levelUpCost(lv) - 1e-9);
  });

  it('hebt die Stadt, zieht Sterne ab und behaelt die Bevoelkerung / raises the city, takes stars and keeps the population', () => {
    const { s, hq } = g();
    hq.pop = 1;
    const inc = cityIncome(s, hq);
    const limit = unitLimit(s, hq);
    const r = ok(s, { type: 'buyLevel', city: hq.id });
    expect(hq.level).toBe(2);
    expect(hq.pop).toBe(1);
    expect(s.factions[0].stars).toBe(500 - 50);
    expect(cityIncome(s, hq)).toBe(inc + INCOME.perCityLevel);
    expect(unitLimit(s, hq)).toBe(limit + 1);
    expect(r.events).toContainEqual({ t: 'cityLevel', city: hq.id, level: 2, bought: true });
    // naechster Aufstieg durch Bevoelkerung wie gewohnt / next level-up by population as usual
    expect(levelUpCost(s, hq)).toBe(CITY.levelUpCost(2));
  });

  it('Belohnung wie beim normalen Aufstieg, Zugende erst nach der Wahl / reward as with a normal level-up, end of turn only after the choice', () => {
    const { s, hq } = g();
    ok(s, { type: 'buyLevel', city: hq.id });
    expect(s.pendingRewards).toEqual([{ cityId: hq.id, level: 2 }]);
    fails(s, { type: 'endTurn' }, 'pendingReward');
    expect(rewardOptions(hq, 2)).toEqual(['factory', 'drone']);
    ok(s, { type: 'reward', city: hq.id, choice: 'a' });
    expect(hq.factory).toBe(true);
    expect(s.pendingRewards).toEqual([]);
    endTurn(s);
  });

  it('einmal je Stadt und Runde / once per city and round', () => {
    const { s, hq } = g();
    const second = addCity(s, 6, 2, 0);
    ok(s, { type: 'buyLevel', city: hq.id });
    ok(s, { type: 'reward', city: hq.id, choice: 'b' });
    fails(s, { type: 'buyLevel', city: hq.id }, 'alreadyBought');
    expect(buyLevelCheck(s, 0, hq)).toBe('alreadyBought');
    // eine andere Stadt in derselben Runde geht / another city in the same round works
    ok(s, { type: 'buyLevel', city: second.id });
    ok(s, { type: 'reward', city: second.id, choice: 'b' });
    untilTurnOf(s, 0);
    expect(buyLevelCheck(s, 0, hq)).toBe('ok');
    ok(s, { type: 'buyLevel', city: hq.id });
    expect(hq.level).toBe(3);
  });

  it('nicht ohne Sterne, nicht in fremden Staedten / not without stars, not in foreign cities', () => {
    const { s, hq } = g(49);
    fails(s, { type: 'buyLevel', city: hq.id }, 'notEnoughStars');
    s.factions[0].stars = 500;
    const enemy = s.cities.find((c) => c.owner === 1)!;
    fails(s, { type: 'buyLevel', city: enemy.id }, 'notYourCity');
    fails(s, { type: 'buyLevel', city: 9999 }, 'notYourCity');
  });

  it('nicht fuer den Kult, Sendetuerme und Nachschublinien / not for the cult, towers and supply lines', () => {
    const cult = blankGame({ stars: 500, factions: ['vesper', 'korvat'] });
    const cc = addCity(cult, 2, 2, 0, { hq: true });
    addCity(cult, 9, 9, 1, { hq: true });
    fails(cult, { type: 'buyLevel', city: cc.id }, 'cannotBuild');

    const { s, hq } = g();
    const tower = addCity(s, 6, 6, 0);
    tower.tower = true;
    fails(s, { type: 'buyLevel', city: tower.id }, 'cannotBuild');
    s.config.theme = 'cavern';
    expect(buyLevelCheck(s, 0, hq)).toBe('cannotBuild');
  });

  it('alte Spielstaende ohne levelBought laden und kaufen / old saves without levelBought load and buy', () => {
    const { s, hq } = g();
    const old = JSON.parse(JSON.stringify(s));
    expect(old.cities[0].levelBought).toBeUndefined();
    expect(buyLevelCheck(old, 0, old.cities[0])).toBe('ok');
    expect(applyCommand(old, { type: 'buyLevel', city: hq.id }).ok).toBe(true);
  });

  it('die KI kauft reich Stufen, ohne Fehlbefehle / the AI buys levels when rich, without failed commands', () => {
    const { s, hq } = g(2000);
    for (const f of s.factions) f.contacts = [];
    s.factions[0].stars = 2000;
    const before = hq.level;
    let bought = 0;
    for (let i = 0; i < 200 && s.current === 0; i++) {
      const cmd = planNextCommand(s, 0);
      const res = applyCommand(s, cmd);
      expect(res.ok, JSON.stringify(cmd)).toBe(true);
      if (cmd.type === 'buyLevel') bought++;
      if (cmd.type === 'endTurn') break;
    }
    expect(bought).toBeGreaterThan(0);
    expect(hq.level).toBeGreaterThan(before);
    expect(s.pendingRewards.filter((p) => p.cityId === hq.id)).toEqual([]);
  });

  it('die KI kauft arm keine Stufe / the AI does not buy a level when poor', () => {
    const { s, hq } = g(60);
    for (let i = 0; i < 200 && s.current === 0; i++) {
      const cmd = planNextCommand(s, 0);
      expect(cmd.type).not.toBe('buyLevel');
      expect(applyCommand(s, cmd).ok).toBe(true);
      if (cmd.type === 'endTurn') break;
    }
    expect(hq.level).toBe(1);
  });
});

describe('Einheitenlimit durch Ausbauten / unit limit from upgrades', () => {
  it('jeder Ausbau +1 / every upgrade +1', () => {
    const { s, hq } = g();
    // Korvat: Massenmobilisierung +1 (PERKS) / Korvat: mass mobilisation +1 (PERKS)
    const base = hq.level + CITY.unitLimitExtra + PERKS.massMobilizationExtraUnits;
    expect(unitLimit(s, hq)).toBe(base);
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'bunker' });
    expect(upgradeUnitLimit(s, hq)).toBe(1);
    expect(unitLimit(s, hq)).toBe(base + 1);
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'hospital' });
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'depot' });
    expect(unitLimit(s, hq)).toBe(base + 3 * CITY.unitLimitPerUpgrade);
  });

  it('das zusaetzliche Limit erlaubt Ausbildung / the extra limit allows training', () => {
    const { s, hq } = g();
    giveSites(hq, 'trainingCamp');
    for (let i = 0; i < unitLimit(s, hq); i++) addUnit(s, 'infantry', 0, 5 + i, 8, { homeCity: hq.id });
    expect(trainCheck(s, hq, 'infantry')).toBe('unitLimit');
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'bunker' });
    expect(trainCheck(s, hq, 'infantry')).toBe('ok');
    ok(s, { type: 'train', city: hq.id, unitType: 'infantry' });
  });

  it('Sendetuerme, Nachschublinien und der Kult bleiben unveraendert / towers, supply lines and the cult stay unchanged', () => {
    const { s, hq } = g();
    hq.upgrades = ['bunker', 'depot'];
    const tower = addCity(s, 6, 6, 0);
    tower.tower = true;
    tower.upgrades = ['bunker'];
    const extra = PERKS.massMobilizationExtraUnits;
    expect(unitLimit(s, tower)).toBe(TOWER.unitLimit + extra);
    s.config.theme = 'cavern';
    expect(unitLimit(s, hq)).toBe(SUPPLY_LINE.mainShaftUnitLimit + extra);
    expect(upgradeUnitLimit(s, hq)).toBe(0);
    // der Kult nutzt eroberte Ausbauten nicht / the cult does not use captured upgrades
    const cult = blankGame({ factions: ['vesper', 'korvat'] });
    const cc = addCity(cult, 2, 2, 0, { level: 2 });
    cc.upgrades = ['bunker', 'depot'];
    expect(unitLimit(cult, cc)).toBe(2 + CITY.unitLimitExtra);
    expect(cultSlots(cult, cc)).toBe(2 + CITY.unitLimitExtra);
  });

  it('mit dem Relay geht auch der Platz verloren / losing the relay also loses its slot', () => {
    const s = blankGame({ stars: 500, factions: ['velkar', 'korvat'] });
    const c = addCity(s, 2, 2, 0, { hq: true, level: 3 });
    addCity(s, 9, 9, 1, { hq: true });
    addCity(s, 5, 9, 0);
    c.upgrades = ['satRelay', 'bunker'];
    expect(unitLimit(s, c)).toBe(3 + CITY.unitLimitExtra + 2);
    // die Stadt faellt: der Eroberer behaelt den Bunker, das Relay wird abgebaut / the city falls: the conqueror keeps the bunker, the relay is dismantled
    const inf = addUnit(s, 'infantry', 1, 2, 3);
    s.current = 1;
    ok(s, { type: 'move', unit: inf.id, to: { x: 2, y: 2 } });
    endTurn(s); untilTurnOf(s, 1);
    ok(s, { type: 'capture', unit: inf.id });
    expect(c.owner).toBe(1);
    expect(c.upgrades).toEqual(['bunker']);
    // Korvat erobert: Massenmobilisierung +1, Bunker +1 / Korvat captures: mass mobilisation +1, bunker +1
    expect(unitLimit(s, c)).toBe(c.level + CITY.unitLimitExtra + PERKS.massMobilizationExtraUnits + 1);
  });
});
