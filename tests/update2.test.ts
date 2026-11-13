import { describe, expect, it } from 'vitest';
import { cityIncome, continueEndless, createGame, defaultConfig, effectiveMove, healAmount, weatherFor } from '../src/core';
import { CITY_UPGRADES, HEALING, MAP_SIZES, WEATHER } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, tile, untilTurnOf } from './helpers';

const roundWith = (seed: number, w: string) => { for (let r = 2; r < 400; r++) if (weatherFor(seed, r) === w) return r; throw new Error('none'); };

describe('Grosse Karten / big maps', () => {
  it('22 und 26 Felder sind waehlbar und spielbar / 22 and 26 tiles are available and playable', () => {
    expect(MAP_SIZES).toContain(22); expect(MAP_SIZES).toContain(26);
    for (const size of [22, 26] as const) {
      const s = createGame(defaultConfig({ seed: 4, size, mapType: 'continents' }));
      expect(s.tiles.length).toBe(size * size);
      expect(s.cities.length).toBeGreaterThan(20);
    }
  });
});

describe('Schnee und Wind / snow and wind', () => {
  it('Schnee: Fahrzeuge 1 Feld weniger, Infanterie normal / snow: vehicles -1, infantry unchanged', () => {
    const s = blankGame({ weather: true });
    s.round = roundWith(s.config.seed, 'snow');
    const jeep = addUnit(s, 'jeep', 0, 5, 5), inf = addUnit(s, 'infantry', 0, 3, 3);
    expect(effectiveMove(s, jeep)).toBe(1);
    expect(effectiveMove(s, inf)).toBe(1);
    s.round = roundWith(s.config.seed, 'clear');
    expect(effectiveMove(s, jeep)).toBe(2);
  });
  it('Wind: Hubschrauber verbrauchen 2 Sprit pro Runde / wind: helicopters burn 2 fuel', () => {
    const s = blankGame({ weather: true });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    s.factions[0].techs.push('armyAviation');
    const h = addUnit(s, 'heli', 0, 5, 5, { fuel: 4 });
    s.round = roundWith(s.config.seed, 'wind');
    endTurn(s);
    expect(h.fuel).toBe(4 - WEATHER.wind.fuelBurn);
  });
});

describe('Neue Ausbauten / new upgrades', () => {
  function g() {
    const s = blankGame({ stars: 200 });
    for (const f of s.factions) f.techs.push(...Object.values(CITY_UPGRADES.tech));
    const hq = addCity(s, 2, 2, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    return { s, hq };
  }
  it('Lazarett: +2 Heilung auf und neben der Stadt / hospital: +2 healing', () => {
    const { s, hq } = g();
    const u = addUnit(s, 'infantry', 0, 3, 3, { hp: 2 });
    const base = healAmount(s, u);
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'hospital' });
    expect(healAmount(s, u)).toBe(base + CITY_UPGRADES.hospitalHeal);
    const far = addUnit(s, 'infantry', 0, 6, 6, { hp: 2 });
    expect(healAmount(s, far)).toBe(HEALING.elsewhere);
  });
  it('Depot: +5 Sterne pro Runde / depot: +5 stars per round', () => {
    const { s, hq } = g();
    const before = cityIncome(s, hq);
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'depot' });
    expect(cityIncome(s, hq)).toBe(before + CITY_UPGRADES.depotIncome);
  });
  it('Flugabwehr trifft feindliche Hubschrauber am Zugende / flak hits hostile helicopters at turn end', () => {
    const { s } = g();
    const enemy = s.cities.find((c) => c.owner === 1)!;
    enemy.upgrades = ['flak'];
    s.factions[0].techs.push('armyAviation');
    const h = addUnit(s, 'heli', 0, 8, 8, { fuel: 4 });
    const r = endTurn(s);
    expect(h.hp).toBe(10 - CITY_UPGRADES.flakDamage);
    expect(r.events.some((e) => e.t === 'flak')).toBe(true);
  });
  it('nur 3 Slots fuer 6 Ausbauten / only 3 slots for 6 upgrades', () => {
    const { s, hq } = g();
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'depot' });
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'hospital' });
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'bunker' });
    expect(s.factions[0].stars).toBe(200 - 30 - 20 - 25);
    fails(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'flak' });
  });
});

describe('Kriegsspuren / war marks', () => {
  it('Artillerie hinterlaesst Krater, Infanterie Brandflecken / artillery leaves craters, infantry scorch marks', () => {
    const s = blankGame();
    for (const f of s.factions) f.techs.push(...Object.values(CITY_UPGRADES.tech));
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 10, 10, 1, { hq: true });
    const a = addUnit(s, 'artillery', 0, 5, 3), v = addUnit(s, 'tank', 1, 5, 5);
    revealAll(s, 0);
    ok(s, { type: 'attack', unit: a.id, target: v.id });
    expect(tile(s, 5, 5).marks?.[0].k).toBe('crater');
    const i = addUnit(s, 'infantry', 0, 4, 5);
    ok(s, { type: 'attack', unit: i.id, target: v.id });
    expect(tile(s, 5, 5).marks?.map((m) => m.k)).toEqual(['crater', 'scorch']);
  });
});

describe('Endlos / endless', () => {
  it('Endlos-Modus hat kein Rundenlimit; Punkte-Partie kann endlos weiterlaufen / endless has no limit; points game can continue', () => {
    expect(defaultConfig({ mode: 'endless' }).roundLimit).toBeNull();
    const s = createGame(defaultConfig({ seed: 2, size: 11, roundLimit: 2, factions: [{ id: 'korvat', human: true, difficulty: 'normal' }, { id: 'dravon', human: true, difficulty: 'normal' }] }));
    for (let i = 0; i < 4; i++) endTurn(s);
    expect(s.over).toBe(true);
    continueEndless(s);
    expect(s.over).toBe(false);
    expect(s.config.roundLimit).toBeNull();
    for (let i = 0; i < 6; i++) endTurn(s);
    expect(s.over).toBe(false);
    untilTurnOf(s, 0);
    expect(s.round).toBeGreaterThan(3);
  });
});
