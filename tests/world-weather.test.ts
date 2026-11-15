/**
 * Wetter der Welten: Pools je Thema, Sandsturm, Meteorschauer (Wueste), Saeureregen (Alienwelt), Erdbeben (Hoehle).
 * Weather of the worlds: pools per theme, dust storm, meteor shower (desert), acid rain (alien world), earthquake (cavern).
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, createGame, effectiveMove, effectiveRange, hasWeather, hitOdds, missionConfig, quakeFor, quakeLocked, reachable, unitClass,
  visionRadius, weather, weatherFor, MISSIONS, type GameState, type Unit,
} from '../src/core';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI, HIT, UNITS, WEATHER, type WeatherId } from '../src/data/balance';
import { addCity, addUnit, blankGame, revealAll } from './helpers';

const pool = (theme: 'desert' | 'alien' | 'cavern' | undefined) => {
  const seen = new Set<WeatherId>();
  for (let seed = 1; seed < 60; seed++) for (let r = 2; r < 60; r++) seen.add(weatherFor(seed, r, theme));
  return seen;
};

/** Spiel mit festem Wetter in Runde 2 (Seed gesucht) / game with a fixed weather in round 2 (seed searched) */
function withWeather(w: WeatherId, theme: 'desert' | 'alien' | 'cavern' | undefined): GameState {
  let seed = 1;
  while (weatherFor(seed, 2, theme) !== w && seed < 5000) seed++;
  const s = blankGame({ factions: ['korvat', 'zyrr'], weather: true, seed });
  s.config.seed = seed;
  if (theme) s.config.theme = theme;
  expect(weather(s)).toBe(w);
  return s;
}

/** Zug beider Fraktionen beenden, Runde 3 beginnt (Wetter wird zu Rundenbeginn wirksam) / end both turns, round 3 starts */
function nextRound(s: GameState) {
  const ev = [];
  for (let i = 0; i < s.factions.length; i++) ev.push(...applyCommand(s, { type: 'endTurn' }).events);
  return ev;
}

describe('Wetter je Welt / weather per world', () => {
  it('Pools: Erde wie bisher, Alienwelt ohne Schnee mit Saeureregen, Wueste nur klar, Sandsturm, Meteore, Hoehle nur ruhig oder Beben / pools per theme', () => {
    expect(pool(undefined)).toEqual(new Set(['clear', 'rain', 'snow', 'wind']));
    expect(pool('alien')).toEqual(new Set(['clear', 'rain', 'wind', 'acid']));
    expect(pool('desert')).toEqual(new Set(['clear', 'dust', 'meteor']));
    expect(pool('cavern')).toEqual(new Set(['clear', 'quake']));
    // Erde unveraendert: dieselben Wuerfe wie vor den Welten / Earth unchanged: the same rolls as before the worlds
    for (let r = 2; r < 40; r++) expect(['clear', 'rain', 'snow', 'wind']).toContain(weatherFor(1234, r));
    // Missionen: Wuestenwelt hat Wetter, die Hoehle auch (nur Beben) / missions: the desert world has weather, the cavern too (only quakes)
    for (const m of MISSIONS.filter((x) => x.theme === 'desert' || x.theme === 'cavern')) expect(hasWeather(createGame(missionConfig(m.id, 'korvat'))), m.id).toBe(true);
  });

  it('Sandsturm: Sicht, Reichweite, Hubschrauber, Trefferglueck / dust storm: vision, range, helicopter, hit luck', () => {
    const s = withWeather('dust', 'desert');
    s.config.hitChance = true;
    const art = addUnit(s, 'artillery', 0, 3, 3);
    const inf = addUnit(s, 'infantry', 0, 5, 5);
    const heli = addUnit(s, 'heli', 0, 7, 7);
    expect(effectiveRange(s, art)).toBe(UNITS.artillery.range + WEATHER.dust.rangeDelta);
    expect(effectiveRange(s, inf)).toBe(UNITS.infantry.range);
    expect(effectiveMove(s, heli)).toBe(UNITS.heli.move + WEATHER.dust.moveDelta);
    const clear = withWeather('clear', 'desert');
    clear.config.hitChance = true;
    const inf2 = addUnit(clear, 'infantry', 0, 5, 5);
    expect(visionRadius(s, inf)).toBe(Math.max(1, visionRadius(clear, inf2) + WEATHER.dust.visionDelta));
    expect(hitOdds(s, inf).miss).toBeGreaterThan(hitOdds(clear, inf2).miss);
  });

  it('Meteorschauer: nur ungepanzerte Einheiten ohne Deckung, nie toedlich, deterministisch / meteor shower: only unarmoured units without cover, never lethal, deterministic', () => {
    const make = () => {
      const s = withWeather('clear', 'desert');
      // Runde 3 bringt Meteore: Seed so suchen, dass Runde 3 ein Meteorschauer ist / round 3 brings meteors: search a seed so round 3 is a shower
      let seed = 1;
      while (!(weatherFor(seed, 2, 'desert') !== 'meteor' && weatherFor(seed, 4, 'desert') === 'meteor') && seed < 9000) seed++;
      s.config.seed = seed;
      s.round = 3;
      const city = addCity(s, 8, 8, 0);
      const units: Record<string, Unit> = {
        inf: addUnit(s, 'infantry', 0, 2, 2), zyrr: addUnit(s, 'grey', 1, 4, 2), tank: addUnit(s, 'tank', 0, 6, 2),
        low: addUnit(s, 'infantry', 1, 2, 6), inCity: addUnit(s, 'infantry', 0, city.x, city.y), inBunker: addUnit(s, 'infantry', 0, 4, 8),
      };
      s.tiles[8 * s.size + 4].feature = 'bunker';
      units.low.hp = 1;
      return { s, units };
    };
    const a = make(), b = make();
    expect(unitClass('tank')).toBe('vehicle');
    expect(unitClass('infantry')).toBe('foot');
    const hp = Object.fromEntries(Object.entries(a.units).map(([k, u]) => [k, u.hp]));
    const ev = nextRound(a.s);
    nextRound(b.s);
    expect(a.s.round).toBe(4);
    expect(weather(a.s)).toBe('meteor');
    const hit = ev.find((e) => e.t === 'weatherHit');
    expect(hit && hit.t === 'weatherHit' ? hit.kind : null).toBe('meteor');
    const u = a.units;
    for (const k of ['inf', 'zyrr']) {
      expect(u[k].hp, k).toBeLessThan(hp[k]);
      expect(hp[k] - u[k].hp, k).toBeLessThanOrEqual(WEATHER.meteor.damage + 1);
    }
    expect(u.tank.hp).toBe(hp.tank);
    expect(u.inCity.hp).toBe(hp.inCity);
    expect(u.inBunker.hp).toBe(hp.inBunker);
    // nie toedlich / never lethal
    expect(a.s.units.includes(u.low)).toBe(true);
    expect(u.low.hp).toBe(WEATHER.meteor.minHp);
    // deterministisch / deterministic
    expect(JSON.stringify(a.s.units)).toBe(JSON.stringify(b.s.units));
  });

  it('Saeureregen: alle ausser Zyrr, nie toedlich, Deckung schuetzt, Treffer wie Regen / acid rain: everyone but the Zyrr, never lethal, cover protects, odds like rain', () => {
    let seed = 1;
    while (!(weatherFor(seed, 2, 'alien') !== 'acid' && weatherFor(seed, 4, 'alien') === 'acid') && seed < 9000) seed++;
    const s = blankGame({ factions: ['korvat', 'zyrr', 'nexus'], weather: true, seed });
    s.config.seed = seed; s.config.theme = 'alien'; s.round = 3;
    const city = addCity(s, 8, 8, 0);
    const inf = addUnit(s, 'infantry', 0, 2, 2), tank = addUnit(s, 'tank', 0, 4, 2), bot = addUnit(s, 'android', 2, 6, 2);
    const grey = addUnit(s, 'grey', 1, 2, 5), mech = addUnit(s, 'mech', 1, 4, 5), safe = addUnit(s, 'infantry', 0, city.x, city.y);
    const low = addUnit(s, 'jeep', 0, 6, 6);
    low.hp = 1;
    const before = s.units.map((u) => u.hp);
    for (let i = 0; i < 3; i++) applyCommand(s, { type: 'endTurn' });
    expect(weather(s)).toBe('acid');
    for (const u of [inf, tank, bot]) expect(u.hp, u.type).toBeLessThan(before[s.units.indexOf(u)]);
    for (const u of [grey, mech, safe]) expect(u.hp, u.type).toBe(before[s.units.indexOf(u)]);
    expect(low.hp).toBe(WEATHER.acid.minHp);
    expect(HIT.weather.acid).toEqual(HIT.weather.rain);
    // kein Schnee auf der Alienwelt / no snow on the alien world
    expect(pool('alien').has('snow')).toBe(false);
  });

  it('Erdbeben: Fahrzeuge und Mechs stehen, Fusstruppen ziehen, Angriffe gehen, deterministisch / earthquake: vehicles and mechs stand, foot troops move, attacks work, deterministic', () => {
    const s = withWeather('quake', 'cavern');
    s.config.hitChance = false;
    const tank = addUnit(s, 'tank', 0, 3, 3), inf = addUnit(s, 'infantry', 0, 6, 6), foe = addUnit(s, 'grey', 1, 4, 3);
    revealAll(s, 0); revealAll(s, 1);
    expect(quakeLocked(s, tank)).toBe(true);
    expect(quakeLocked(s, inf)).toBe(false);
    expect(reachable(s, tank)).toEqual([]);
    expect(applyCommand(s, { type: 'move', unit: tank.id, to: { x: 2, y: 2 } }).error).toBe('quake');
    expect(applyCommand(s, { type: 'move', unit: inf.id, to: { x: 7, y: 6 } }).ok).toBe(true);
    // angreifen bleibt erlaubt / attacking stays allowed
    expect(applyCommand(s, { type: 'attack', unit: tank.id, target: foe.id }).ok).toBe(true);
    // Vorhersage: dieselbe Funktion fuer die naechste Runde / forecast: the same function for the next round
    for (let r = 2; r < 30; r++) expect(weatherFor(s.config.seed, r, 'cavern') === 'quake').toBe(quakeFor(s.config.seed, r));
    // unter Tage nie Regen oder Schnee / never rain or snow underground
    for (const m of MISSIONS.filter((x) => x.theme === 'cavern')) {
      const g = createGame(missionConfig(m.id, 'velkar'));
      for (let r = 1; r < 40; r++) { g.round = r; expect(['clear', 'quake']).toContain(weather(g)); }
    }
  });

  it('KI mit Erdbeben, Saeureregen und Meteoren ohne Fehlbefehle / AI with earthquakes, acid rain and meteors without failed commands', () => {
    const errors = aiDebug.errors;
    for (const id of ['m9', 'm10', 'm12']) {
      const s = createGame(missionConfig(id, 'dravon'));
      s.factions[0].human = false;
      let fails = 0, guard = 0;
      const kinds = new Set<string>();
      while (!s.over && s.round <= 10 && guard++ < 20000) {
        const fi = s.current;
        kinds.add(weather(s));
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
      expect(fails, id).toBe(0);
    }
    expect(aiDebug.errors).toBe(errors);
  }, 300_000);
});
