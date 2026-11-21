/**
 * Stuetzpunkte (BASES): Verteilung der Arten (deterministisch, Standortregeln, gleiche Heimat-Art, Gelaende und Orte eines
 * Seeds unveraendert gegenueber main), Wirkung jeder Art fuer eine Menschen-Fraktion und fuer Zyrr, Kult oder NEXUS, keine
 * Ausbildung an Wohnbloecken und Supermarkt, Einnahme und Verlust, alte Spielstaende, KI (eingebaute Staette, Zielwahl).
 * Bases (BASES): distribution of the kinds (deterministic, site rules, same home kind, terrain and places of a seed
 * unchanged against main), effect of every kind for a human faction and for Zyrr, cult or NEXUS, no training at
 * residential blocks and the supermarket, capture and loss, old saves, AI (built-in site, target choice).
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, baseDiscount, baseStars, buildCheck, cityHasSite, cityIncome, cityUpgradeCheck, citySites, computeStats, createGame, defaultConfig,
  dist, effectiveDefense, freeUnitSlots, generateMap, healAmount, income, missionConfig, recruitCheck, rewardOptions, rosterUnits, siteNeed,
  supplySlots, trainCheck, unitCost, buyLevelCheck, levelUpCost, tributeStars, unitLimit, upgradeCheck, usesSites, basesOn, noTraining, neighbors, idx,
  type City, type GameConfig, type GameState,
} from '../src/core';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { baseCaptureWorth, basePreference, baseWorth } from '../src/ai/bases';
import { buildCtx } from '../src/ai/analysis';
import {
  AI, BASES, BASE_KINDS, CITY_UPGRADES, FACTION_IDS, HEALING, INCOME, PRODUCTION, ROCKETS, UNITS, XENO,
  type BaseKind, type FactionId, type MapSize, type MapType, type UnitTypeId,
} from '../src/data/balance';
import { isValidState, migrateState } from '../src/save/save';
import { TUTORIAL_CONFIG } from '../src/ui/tutorial';
import { baseEffectText, baseRulesLines } from '../src/ui/bases';
import { troopCards } from '../src/ui/troops';
import { rulesHtml } from '../src/ui/rules';
import { setLanguage } from '../src/i18n/i18n';
import { addCity, addUnit, blankGame, fails, ok, setTerrain, tile } from './helpers';

const fnv = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
/** Stuetzpunkt in einen Testzustand setzen / put a base into a test state */
function addBase(s: GameState, x: number, y: number, owner: number | null, kind: BaseKind, level = 1): City {
  const c = addCity(s, x, y, owner, { level });
  c.base = kind;
  return c;
}

describe('Verteilung / distribution', () => {
  // Fingerabdruecke berechnet auf main (c8efa9c) mit denselben Aufrufen: Gelaende, Startpunkte, Siedlungen, Bunker, Radars
  // der Karte, und alle Orte der Partie in Reihenfolge (Hauptquartiere, Siedlungen, Sendetuerme) samt Zahl der Tuerme
  // fingerprints computed on main (c8efa9c) with the same calls: terrain, starts, villages, bunkers, radars of the map, and
  // all places of the game in order (headquarters, villages, transmitter towers) with the number of towers
  const CASES: [number, MapSize, MapType, FactionId[], string, string][] = [
    [1, 14, 'continent', ['korvat', 'dravon', 'vesper'], '261cf154', '4758e5:3'],
    [2, 16, 'lakes', ['zyrr', 'nexus', 'alvenia', 'meridon'], 'b06394ca', 'f3b9ab8c:4'],
    [3, 14, 'continents', ['velkar', 'vesper', 'korvat', 'nexus', 'zyrr'], '1bebe3d5', '24e621cf:2'],
    [900001, 16, 'continent', ['meridon', 'dravon'], 'f649d6bc', '9ded648a:4'],
    [4242, 11, 'continent', ['korvat', 'dravon'], 'a80d61e8', '29773e15:2'],
    [77, 18, 'islands', ['alvenia', 'zyrr', 'vesper'], 'dd805166', 'cb78e989:4'],
    [5, 22, 'waterworld', ['nexus', 'velkar', 'meridon', 'korvat'], 'f6bb2f09', 'c630d7ac:3'],
  ];
  const game = (seed: number, size: MapSize, mapType: MapType, facs: FactionId[], extra: Partial<GameConfig> = {}) =>
    createGame(defaultConfig({ seed, size, mapType, factions: facs.map((id) => ({ id, human: false, difficulty: 'normal' as const })), ...extra }));

  it('Gelaende und Orte eines Seeds bleiben wie auf main; die Sendetuerme sind dort jetzt Stuetzpunkte / terrain and places of a seed stay as on main; the transmitter towers there are bases now', () => {
    for (const [seed, size, type, facs, hash, placeHash] of CASES) {
      const m = generateMap(seed, size, type, facs);
      expect(fnv(JSON.stringify({ tiles: m.tiles, starts: m.starts, villages: m.villages, bunkers: m.bunkers, radars: m.radars })), `seed ${seed}`).toBe(hash);
      // dieselben Felder wie auf main; was dort Sendeturm war (nach Hauptquartieren und Siedlungen), ist hier ein Stuetzpunkt
      // the same tiles as on main; what was a transmitter tower there (after HQs and villages) is a base here
      const s = game(seed, size, type, facs);
      const formerTower = (i: number) => i >= facs.length + m.villages.length;
      expect(`${fnv(JSON.stringify(s.cities.map((c, i) => [c.x, c.y, c.isHQ, formerTower(i)])))}:${s.cities.filter((_, i) => formerTower(i)).length}`, `seed ${seed}`).toBe(placeHash);
      expect(s.cities.some((c) => c.tower)).toBe(false);
      s.cities.forEach((c, i) => { if (formerTower(i)) { expect(c.base, `seed ${seed}`).toBeDefined(); expect(c.base).not.toBe(BASES.home); } });
      // ohne Stuetzpunkte bleiben es Sendetuerme / without bases they stay transmitter towers
      const off = game(seed, size, type, facs, { bases: false });
      expect(`${fnv(JSON.stringify(off.cities.map((c) => [c.x, c.y, c.isHQ, !!c.tower])))}:${off.cities.filter((c) => c.tower).length}`, `seed ${seed}`).toBe(placeHash);
    }
  });

  it('deterministisch, Standortregeln, Obergrenzen, gleiche Heimat-Art, garantierte Mischung / deterministic, site rules, caps, same home kind, guaranteed mix', () => {
    const types: MapType[] = ['continent', 'lakes', 'continents'];
    const pool: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'vesper', 'nexus'];
    const always = BASE_KINDS.filter((k) => k !== BASES.home && !BASES.place[k] && !BASES.noTraining.includes(k));
    let maps = 0, nexusMaps = 0, allHomes = 0, full = 0;
    const seen = new Set<BaseKind>();
    const few: Record<number, number> = { 14: 0, 16: 0 };
    const count: Record<number, number> = { 14: 0, 16: 0 };
    for (let seed = 1; seed <= 240; seed++) {
      const size: MapSize = seed % 6 === 0 ? 22 : seed % 2 ? 14 : 16;
      const n = 2 + (seed % 4);
      const facs = Array.from({ length: n }, (_, i) => pool[(seed + i * 3) % pool.length]).filter((f, i, a) => a.indexOf(f) === i);
      const s = game(seed, size, types[seed % 3], facs);
      expect(game(seed, size, types[seed % 3], facs).cities.map((c) => c.base), `seed ${seed}`).toEqual(s.cities.map((c) => c.base));
      maps++;
      const T = (p: { x: number; y: number }) => s.tiles[idx(size, p.x, p.y)];
      const water = (p: { x: number; y: number }) => T(p).terrain === 'shallow' || T(p).terrain === 'ocean';
      const seaSize = (p: { x: number; y: number }) => {
        const seenK = new Set([idx(size, p.x, p.y)]); const q = [p];
        for (let i = 0; i < q.length; i++) for (const o of neighbors(size, q[i].x, q[i].y)) if (water(o) && !seenK.has(idx(size, o.x, o.y))) { seenK.add(idx(size, o.x, o.y)); q.push(o); }
        return q.length;
      };
      const coast = (p: { x: number; y: number }) => neighbors(size, p.x, p.y).some((o) => water(o) && seaSize(o) >= BASES.minSea);
      const fits = (k: BaseKind, p: { x: number; y: number }): boolean => {
        switch (BASES.place[k]) {
          case 'coast': return coast(p);
          case 'water': return coast(p) || !!T(p).river || neighbors(size, p.x, p.y).some((o) => T(o).river);
          case 'wind': return coast(p) || T(p).biome === 'hills' || neighbors(size, p.x, p.y).some((o) => T(o).terrain === 'mountain');
          case 'plain': return T(p).terrain === 'plain';
          default: return true;
        }
      };
      const places = s.cities.filter((c) => !c.isHQ);
      for (const c of places) { expect(c.base, `seed ${seed}`).toBeDefined(); expect(c.tower).toBeUndefined(); expect(c.owner).toBeNull(); }
      // Heimat: jede Kaserne liegt bei einem eigenen Startpunkt, sonst kommt die Kaserne nicht vor
      // (selten findet die Kartenerzeugung fuer einen Startpunkt keinen Heimatort, wie schon auf main; dann fehlt nur dessen Kaserne)
      // home: every barracks lies at a start of its own, the barracks appears nowhere else
      // (rarely map generation finds no home place for a start, as on main already; then only its barracks is missing)
      const hqs = s.cities.filter((c) => c.isHQ);
      const homes = places.filter((c) => c.base === BASES.home);
      expect(homes.length, `seed ${seed}`).toBeLessThanOrEqual(hqs.length);
      if (homes.length === hqs.length) allHomes++;
      const taken = new Set<number>();
      for (const h of homes) {
        const own = hqs.findIndex((q, k) => !taken.has(k) && dist(q, h) <= 5);
        expect(own, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        taken.add(own);
      }
      const rest = places.filter((c) => c.base !== BASES.home);
      for (const c of rest) { seen.add(c.base!); expect(fits(c.base!, c), `seed ${seed} ${c.base}`).toBe(true); }
      // Obergrenzen: Atomkraftwerk, Arten ohne Ausbildung / caps: nuclear plant, kinds without training
      const noTrainCap = Math.floor(rest.length * BASES.noTrainShare);
      const noTrain = rest.filter((c) => BASES.noTraining.includes(c.base!)).length;
      expect(rest.filter((c) => c.base === 'nuclearPlant').length, `seed ${seed}`).toBeLessThanOrEqual(BASES.maxPerMap.nuclearPlant!);
      expect(noTrain, `seed ${seed}`).toBeLessThanOrEqual(noTrainCap);
      // Mischung: so viele verschiedene Arten wie Orte, solange die Arten reichen, die ueberall stehen duerfen
      // mix: as many different kinds as places while the kinds that may stand anywhere last
      const counts = new Map<BaseKind, number>();
      for (const c of rest) counts.set(c.base!, (counts.get(c.base!) ?? 0) + 1);
      if (rest.length <= always.length) expect(counts.size, `seed ${seed}`).toBe(rest.length);
      if (counts.size === rest.length) full++;
      // keine Art doppelt, solange sich eine fehlende noch unterbringen liesse: einer fehlenden Art bleiben nur Orte, an
      // denen eine andere Art mit Standortregel steht (oder ihre Obergrenze ist erreicht)
      // no kind twice while a missing one could still be accommodated: a missing kind only has places left where another
      // kind with a site rule stands (or its cap is reached)
      if (counts.size < rest.length) {
        for (const k of BASE_KINDS) {
          if (k === BASES.home || counts.has(k)) continue;
          if (BASES.noTraining.includes(k) && noTrain >= noTrainCap) continue;
          for (const c of rest) if (fits(k, c)) expect(BASES.place[c.base!], `seed ${seed}: ${k} fehlt, ${c.base} doppelt`).toBeDefined();
        }
        expect(Math.max(...counts.values()), `seed ${seed}`).toBeLessThanOrEqual(Math.ceil(rest.length / always.length) + 1);
      }
      // mit NEXUS: ein Kraftwerk, sobald ein freier Ort eines tragen kann (offene Ebene reicht fuer die Solarfarm)
      // with NEXUS: a power kind as soon as a free place can carry one (open plain is enough for the solar farm)
      if (facs.includes('nexus') && rest.some((c) => T(c).terrain === 'plain')) {
        nexusMaps++;
        expect(rest.some((c) => BASES.energy[c.base!] !== undefined), `seed ${seed}`).toBe(true);
      }
      // Vielfalt auf den ueblichen Karten: 14x14 mindestens 3, 16x16 mindestens 4 verschiedene Arten ausser der Kaserne,
      // auf engen Karten mit 5 Fraktionen gelegentlich weniger
      // variety on the usual maps: 14x14 at least 3, 16x16 at least 4 different kinds besides the barracks, on crowded maps
      // with 5 factions occasionally fewer
      if (size === 14 || size === 16) {
        count[size]++;
        if (counts.size < (size === 14 ? 3 : 4)) few[size]++;
        // harte Untergrenzen: bis 3 Fraktionen 2 (14x14) bzw. 3 (16x16), bis 4 Fraktionen nie keine / hard minima: up to 3 factions 2 (14x14) or 3 (16x16), up to 4 factions never none
        if (n <= 3) expect(counts.size, `seed ${seed}`).toBeGreaterThanOrEqual(size === 14 ? 2 : 3);
        if (n <= 4) expect(counts.size, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      }
    }
    expect(maps).toBe(240);
    expect(allHomes / maps).toBeGreaterThan(0.95);
    expect(nexusMaps).toBeGreaterThan(20);
    // ueber viele Karten kommt jede Art vor, und fast jede Karte zeigt so viele Arten wie Orte
    // over many maps every kind appears, and almost every map shows as many kinds as places
    for (const k of BASE_KINDS) if (k !== BASES.home) expect(seen.has(k), k).toBe(true);
    expect(full / maps).toBeGreaterThan(0.8);
    expect(few[14] / count[14]).toBeLessThan(0.15);
    expect(few[16] / count[16]).toBeLessThan(0.1);
  }, 240_000);

  it('createGame: Stuetzpunkte nur in freien Partien der Standardwelt; Hauptquartiere bleiben Staedte, die Kampagne behaelt ihre Sendetuerme / bases only in free games on the default world; HQs stay cities, the campaign keeps its towers', () => {
    const facs: FactionId[] = ['korvat', 'nexus'];
    const s = game(11, 16, 'continent', facs);
    expect(basesOn(s.config)).toBe(true);
    for (const c of s.cities) {
      if (c.isHQ) expect(c.base).toBeUndefined();
      else { expect(BASE_KINDS).toContain(c.base); expect(c.owner).toBeNull(); expect(c.tower).toBeUndefined(); }
    }
    expect(s.cities.filter((c) => c.base === BASES.home)).toHaveLength(2);
    // die frueheren Sendetuerme verhalten sich wie jeder Stuetzpunkt: Stadtlimit und Einkommen einer Stadt, Ausbauten moeglich
    // the former transmitter towers behave like any base: a city's unit limit and income, upgrades possible
    const former = s.cities[s.cities.length - 1];
    former.owner = 0;
    expect(unitLimit(s, former)).toBeGreaterThanOrEqual(former.level + 1);
    expect(cityIncome(s, former)).toBeGreaterThanOrEqual(INCOME.perCityLevel);
    expect(cityUpgradeCheck(s, 0, former, 'radioTower')).not.toBe('noSlot');
    former.owner = null;
    // aus: gewoehnliche Siedlungen und Sendetuerme an denselben Orten / off: ordinary villages and transmitter towers at the same places
    const off = game(11, 16, 'continent', facs, { bases: false });
    expect(off.cities.every((c) => c.base === undefined)).toBe(true);
    expect(off.cities.some((c) => c.tower)).toBe(true);
    expect(off.cities.map((c) => [c.x, c.y])).toEqual(s.cities.map((c) => [c.x, c.y]));
    expect(JSON.stringify(off.tiles.map((t) => t.terrain))).toBe(JSON.stringify(s.tiles.map((t) => t.terrain)));
    // ohne die zusaetzlichen Orte (towers: false) bleiben nur die Siedlungen als Stuetzpunkte / without the extra places only the villages remain as bases
    const few = game(11, 16, 'continent', facs, { towers: false });
    expect(few.cities.length).toBe(off.cities.filter((c) => !c.tower).length);
    expect(few.cities.every((c) => c.isHQ || c.base !== undefined)).toBe(true);
    // Tutorial und Kampagne (alle Welten) bleiben bei Siedlungen und Sendetuermen / tutorial and campaign (all worlds) keep villages and towers
    expect(createGame(TUTORIAL_CONFIG).cities.every((c) => c.base === undefined)).toBe(true);
    for (const m of ['m1', 'm4', 'm7', 'm9', 'm12']) expect(basesOn(missionConfig(m, 'korvat')), m).toBe(false);
    const m1 = createGame(missionConfig('m1', 'korvat'));
    expect(m1.cities.every((c) => c.base === undefined)).toBe(true);
    expect(m1.cities.some((c) => c.tower)).toBe(true);
  });
});

describe('Wirkung je Art / effect per kind', () => {
  it('Kaserne: eingebaute Staette und staerkere Fusstruppen (Menschen, NEXUS, Zyrr, Kult) / barracks: built-in site and stronger foot troops', () => {
    const s = blankGame({ factions: ['velkar', 'nexus', 'zyrr', 'vesper'], stars: 200 });
    const b = addBase(s, 2, 2, 0, 'barracks');
    expect(citySites(s, b)).toEqual(['trainingCamp']);
    // gewoehnliche Stadt derselben Fraktion: keine Kaserne / ordinary city of the same faction: no barracks
    const plain = addCity(s, 8, 8, 0);
    expect(trainCheck(s, plain, 'infantry')).toBe('buildingMissing');
    expect(trainCheck(s, b, 'infantry')).toBe('ok');
    const r = ok(s, { type: 'train', city: b.id, unitType: 'infantry' });
    const inf = s.units.find((u) => u.id === (r.events.find((e) => e.t === 'train') as { unit: number }).unit)!;
    expect(inf.maxHp).toBe(UNITS.infantry.hp + BASES.footHp);
    expect(inf.hp).toBe(inf.maxHp);
    expect(inf.veteran).toBe(false);
    // NEXUS: Androide (Fusstruppe) staerker, Spinne (Fahrzeug) nicht / NEXUS: android (foot) stronger, spider (vehicle) not
    const nb = addBase(s, 2, 8, 1, 'barracks');
    s.current = 1;
    let e = ok(s, { type: 'train', city: nb.id, unitType: 'android' });
    const android = s.units.find((u) => u.id === (e.events.find((x) => x.t === 'train') as { unit: number }).unit)!;
    expect(android.maxHp).toBe(UNITS.android.hp + BASES.footHp);
    // Zyrr: Grauer auf terraformtem Stadtfeld / Zyrr: Grey on a terraformed city tile
    const zb = addBase(s, 8, 2, 2, 'barracks');
    tile(s, 8, 2).xeno = true;
    s.current = 2;
    e = ok(s, { type: 'train', city: zb.id, unitType: 'grey' });
    const grey = s.units.find((u) => u.id === (e.events.find((x) => x.t === 'train') as { unit: number }).unit)!;
    expect(grey.maxHp).toBe(UNITS.grey.hp + BASES.footHp);
    // Kult: Rekrut neben der eigenen Kaserne staerker, fern davon nicht / cult: recruit next to the own barracks stronger, away from it not
    addBase(s, 5, 5, 3, 'barracks');
    const near = addUnit(s, 'zealot', 3, 5, 6);
    const far = addUnit(s, 'zealot', 3, 9, 5);
    s.current = 3;
    e = ok(s, { type: 'recruit', unit: near.id, unitType: 'zealot', x: 4, y: 6 });
    expect(s.units.find((u) => u.id === (e.events.find((x) => x.t === 'recruit') as { unit: number }).unit)!.maxHp).toBe(UNITS.zealot.hp + BASES.footHp);
    e = ok(s, { type: 'recruit', unit: far.id, unitType: 'zealot', x: 10, y: 5 });
    expect(s.units.find((u) => u.id === (e.events.find((x) => x.t === 'recruit') as { unit: number }).unit)!.maxHp).toBe(UNITS.zealot.hp);
  });

  it('Bunker und Wohnbloecke: Schutz fuer die Besatzung, Bunker deutlich mehr; der Ausbau Bunker ist dort schon eingebaut / protection for the garrison, the bunker clearly more', () => {
    const s = blankGame({ factions: ['korvat', 'vesper'], stars: 200 });
    const bunker = addBase(s, 2, 2, 0, 'bunker');
    const housing = addBase(s, 6, 2, 0, 'housing');
    const plain = addCity(s, 2, 6, 0);
    const cultBunker = addBase(s, 8, 8, 1, 'bunker');
    const base = UNITS.infantry.defense;
    expect(effectiveDefense(s, addUnit(s, 'infantry', 0, bunker.x, bunker.y))).toBe(base + BASES.defense.bunker!);
    expect(effectiveDefense(s, addUnit(s, 'infantry', 0, housing.x, housing.y))).toBe(base + BASES.defense.housing!);
    expect(effectiveDefense(s, addUnit(s, 'infantry', 0, plain.x, plain.y))).toBe(base);
    expect(BASES.defense.bunker!).toBeGreaterThan(CITY_UPGRADES.bunkerDefense);
    expect(BASES.defense.housing!).toBeLessThan(CITY_UPGRADES.bunkerDefense);
    // Kult: gleicher Schutz / cult: the same protection
    expect(effectiveDefense(s, addUnit(s, 'zealot', 1, cultBunker.x, cultBunker.y))).toBe(UNITS.zealot.defense + BASES.defense.bunker!);
    // ein Feind auf fremdem Bunker bekommt nichts, ein Flieger auch nicht / an enemy on a foreign bunker gets nothing, neither does a flyer
    s.units = s.units.filter((u) => !(u.x === bunker.x && u.y === bunker.y));
    expect(effectiveDefense(s, addUnit(s, 'zealot', 1, bunker.x, bunker.y))).toBe(UNITS.zealot.defense);
    s.units = s.units.filter((u) => !(u.x === bunker.x && u.y === bunker.y));
    expect(effectiveDefense(s, addUnit(s, 'heli', 0, bunker.x, bunker.y))).toBe(UNITS.heli.defense);
    // Ausbau Bunker: im Bunker schon eingebaut, in den Wohnbloecken kaufbar (Forschung gesetzt) / bunker upgrade: built into the bunker, buyable in the residential blocks
    s.factions[0].techs.push(CITY_UPGRADES.tech.bunker);
    expect(cityUpgradeCheck(s, 0, bunker, 'bunker')).toBe('alreadyBuilt');
    expect(cityUpgradeCheck(s, 0, housing, 'bunker')).toBe('ok');
  });

  it('Panzerfabrik, Militaerflughafen, Geschuetzwerk: Menschen bauen sofort, Zyrr, Kult und NEXUS zahlen weniger / humans build right away, Zyrr, cult and NEXUS pay less', () => {
    const s = blankGame({ factions: ['velkar', 'nexus', 'zyrr', 'vesper', 'meridon'], stars: 300 });
    const tf = addBase(s, 2, 2, 0, 'tankFactory');
    const ab = addBase(s, 5, 2, 0, 'airbase');
    const gw = addBase(s, 8, 2, 0, 'gunWorks');
    // Menschen: Staette eingebaut, ohne Tagebau und Forstbetrieb; eine zweite laesst sich dort nicht bauen
    // humans: site built in, without mine and lumber camp; a second one cannot be built there
    expect(citySites(s, tf)).toEqual(['tankWorks']);
    expect(trainCheck(s, tf, 'teslaTank')).toBe('ok');
    expect(trainCheck(s, ab, 'octocopter')).toBe('ok');
    expect(trainCheck(s, gw, 'artillery')).toBe('ok');
    expect(trainCheck(s, tf, 'artillery')).toBe('buildingMissing');
    expect(buildCheck(s, 0, 'tankWorks', 1, 1)).toMatchObject({ ok: false, error: 'onePerCity' });
    // kein Rabatt fuer Menschen / no discount for humans
    expect(unitCost(s, 0, 'teslaTank')).toBe(UNITS.teslaTank.cost);
    expect(baseStars(s, tf)).toBe(0);
    // NEXUS, Zyrr, Kult ohne Stuetzpunkt: voller Preis / without a base: full price
    const full = (t: UnitTypeId) => UNITS[t].cost!;
    const cut = (t: UnitTypeId) => Math.ceil(full(t) * (1 - BASES.discount));
    for (const [f, t] of [[1, 'titan'], [1, 'quadDrone'], [1, 'railgun'], [2, 'mech'], [2, 'skimmer'], [2, 'tripod'], [3, 'doomCrawler'], [3, 'rocketCart']] as [number, UnitTypeId][]) expect(unitCost(s, f, t), t).toBe(full(t));
    // NEXUS haelt alle drei: passende Einheiten billiger, andere nicht, nicht stapelbar / NEXUS holds all three: matching units cheaper, others not, no stacking
    for (const c of [tf, ab, gw]) c.owner = 1;
    expect(unitCost(s, 1, 'titan')).toBe(cut('titan'));
    expect(unitCost(s, 1, 'quadDrone')).toBe(cut('quadDrone'));
    expect(unitCost(s, 1, 'railgun')).toBe(cut('railgun'));
    expect(unitCost(s, 1, 'android')).toBe(full('android'));
    addBase(s, 2, 8, 1, 'tankFactory');
    expect(unitCost(s, 1, 'titan')).toBe(cut('titan'));
    expect(baseDiscount(s, 1, 'titan')).toBe(BASES.discount);
    // Zyrr / Zyrr
    for (const c of s.cities) if (c.base) c.owner = 2;
    expect(unitCost(s, 2, 'mech')).toBe(cut('mech'));
    expect(unitCost(s, 2, 'skimmer')).toBe(cut('skimmer'));
    expect(unitCost(s, 2, 'tripod')).toBe(cut('tripod'));
    expect(unitCost(s, 2, 'grey')).toBe(full('grey'));
    // Kult: Panzerfabrik und Geschuetzwerk Rabatt; am Flughafen keine Flieger, also Ersatz-Sterne (Tribut)
    // cult: tank factory and gun works discount; no aircraft at the airfield, so substitute stars (tribute)
    for (const c of s.cities) if (c.base) c.owner = 3;
    expect(unitCost(s, 3, 'doomCrawler')).toBe(cut('doomCrawler'));
    expect(unitCost(s, 3, 'rocketCart')).toBe(cut('rocketCart'));
    expect(unitCost(s, 3, 'zealot')).toBe(full('zealot'));
    expect(cityIncome(s, ab)).toBe(tributeStars(BASES.gapStars));
    expect(cityIncome(s, ab)).toBeGreaterThan(0);
    expect(cityIncome(s, tf)).toBe(0);
    // Meridon baut keine Panzer: an der Panzerfabrik Ersatz-Sterne / Meridon builds no tanks: substitute stars at the tank factory
    tf.owner = 4;
    expect(cityIncome(s, tf)).toBe(INCOME.perCityLevel + BASES.gapStars);
    tf.owner = 0;
    expect(cityIncome(s, tf)).toBe(INCOME.perCityLevel);
  });

  it('keine Art ist fuer eine Fraktion wertlos: passende Einheit oder Ersatz-Sterne / no kind is worthless for a faction: a matching unit or substitute stars', () => {
    const s = blankGame({ factions: [...FACTION_IDS].slice(0, 5) });
    const s2 = blankGame({ factions: [...FACTION_IDS].slice(3) });
    for (const st of [s, s2]) st.factions.forEach((fa, f) => {
      for (const kind of Object.keys(BASES.discountUnits) as BaseKind[]) {
        const site = BASES.sites[kind]!;
        const matching = usesSites(st, f)
          ? site === 'navalBase' || rosterUnits(st, f).some((t) => PRODUCTION.units[site].includes(t))
          : BASES.discountUnits[kind]!.some((t) => (UNITS[t].faction ? UNITS[t].faction === fa.id : UNITS[t].ship && fa.id !== XENO.faction));
        expect(matching !== !!BASES.gap[kind]?.includes(fa.id), `${fa.id} ${kind}`).toBe(true);
      }
      // und die KI sieht in jeder Art einen Wert / and the AI sees a worth in every kind
      for (const kind of BASE_KINDS) {
        const c = addBase(st, 5, 5, null, kind);
        expect(baseWorth(st, f, c), `${fa.id} ${kind}`).toBeGreaterThan(0);
        st.cities = st.cities.filter((x) => x !== c);
        tile(st, 5, 5).cityId = null;
      }
    });
  });

  it('Marinestuetzpunkt: Zerstoerer sofort, Trockendock ohne weiteren Stuetzpunkt; Zyrr Sterne, NEXUS Rabatt / naval base: destroyers right away, dry dock without a further base; Zyrr stars, NEXUS discount', () => {
    const s = blankGame({ factions: ['korvat', 'zyrr', 'nexus'], stars: 300 });
    for (let y = 0; y < s.size; y++) setTerrain(s, 0, y, 'shallow');
    const nb = addBase(s, 1, 3, 0, 'navalStation');
    const town = addCity(s, 1, 8, 0);
    expect(cityHasSite(s, nb, 'navalBase')).toBe(true);
    expect(trainCheck(s, nb, 'destroyer')).toBe('ok');
    expect(trainCheck(s, town, 'destroyer')).toBe('buildingMissing');
    // Schlachtschiff braucht weiter das Trockendock; dessen Voraussetzung ist hier erfuellt / the battleship still needs the dry dock; its prerequisite is met here
    expect(trainCheck(s, nb, 'battleship')).toBe('buildingMissing');
    expect(siteNeed(s, nb, 'dryDock')).toBeNull();
    expect(siteNeed(s, town, 'dryDock')).toEqual(['navalBase']);
    expect(buildCheck(s, 0, 'dryDock', 0, 3).ok).toBe(true);
    expect(cityIncome(s, nb)).toBe(INCOME.perCityLevel);
    // Zyrr haben keine Schiffe: Ersatz-Sterne / the Zyrr have no ships: substitute stars
    nb.owner = 1;
    expect(cityIncome(s, nb)).toBe(INCOME.perCityLevel + BASES.gapStars);
    // NEXUS: Schiffe billiger / NEXUS: ships cheaper
    expect(unitCost(s, 2, 'destroyer')).toBe(UNITS.destroyer.cost);
    nb.owner = 2;
    expect(unitCost(s, 2, 'destroyer')).toBe(Math.ceil(UNITS.destroyer.cost! * (1 - BASES.discount)));
    expect(cityIncome(s, nb)).toBe(INCOME.perCityLevel);
  });

  it('Lazarett: mehr Heilung auf und neben dem Stuetzpunkt (Menschen und NEXUS) / field hospital: more healing on and next to the base', () => {
    const s = blankGame({ factions: ['dravon', 'nexus'], stars: 100 });
    const h = addBase(s, 3, 3, 0, 'fieldHospital');
    const nh = addBase(s, 8, 8, 1, 'fieldHospital');
    expect(healAmount(s, addUnit(s, 'infantry', 0, 3, 3, { hp: 2 }))).toBe(HEALING.ownTerritory + BASES.heal);
    expect(healAmount(s, addUnit(s, 'infantry', 0, 4, 4, { hp: 2 }))).toBe(HEALING.ownTerritory + BASES.heal);
    // zwei Felder entfernt (neutrales Land): nur die Grundheilung / two tiles away (neutral land): base healing only
    expect(healAmount(s, addUnit(s, 'infantry', 0, 5, 5, { hp: 2 }))).toBe(HEALING.elsewhere);
    expect(healAmount(s, addUnit(s, 'android', 1, 8, 7, { hp: 2 }))).toBe(HEALING.ownTerritory + BASES.heal);
    // ein fremdes Lazarett heilt nicht / a foreign hospital does not heal
    expect(healAmount(s, addUnit(s, 'android', 1, 2, 5, { hp: 2 }))).toBe(HEALING.elsewhere);
    expect(BASES.heal).toBeGreaterThan(CITY_UPGRADES.hospitalHeal);
    s.factions[0].techs.push(CITY_UPGRADES.tech.hospital);
    expect(cityUpgradeCheck(s, 0, h, 'hospital')).toBe('alreadyBuilt');
    expect(nh.base).toBe('fieldHospital');
  });

  it('Nachschubdepot, Fabrik, Kraftwerke: Sterne; NEXUS bekommt von den Kraftwerken dazu Energie / supply depot, factory, power kinds: stars; NEXUS gets energy on top from the power kinds', () => {
    const s = blankGame({ factions: ['alvenia', 'nexus', 'vesper'], stars: 300 });
    const depot = addBase(s, 2, 2, 0, 'supplyDepot');
    const factory = addBase(s, 5, 2, 0, 'factory');
    const nuclear = addBase(s, 8, 2, 0, 'nuclearPlant');
    const solar = addBase(s, 2, 6, 0, 'solarFarm');
    const wind = addBase(s, 5, 6, 0, 'windFarm');
    const town = addCity(s, 8, 6, 0);
    const base = INCOME.perCityLevel;
    expect(cityIncome(s, town)).toBe(base);
    expect(cityIncome(s, depot)).toBe(base + BASES.stars.supplyDepot!);
    expect(cityIncome(s, factory)).toBe(base + BASES.stars.factory!);
    expect(cityIncome(s, nuclear)).toBe(base + BASES.stars.nuclearPlant!);
    expect(cityIncome(s, solar)).toBe(base + BASES.stars.solarFarm!);
    expect(cityIncome(s, wind)).toBe(base + BASES.stars.windFarm!);
    // Fabrik nur Sterne und am meisten; Depot Sterne und Einheiten; Kraftwerke unter der Fabrik und untereinander verschieden
    // factory stars only and the most; depot stars and units; power kinds below the factory and different from each other
    expect(BASES.stars.factory!).toBeGreaterThan(BASES.stars.supplyDepot!);
    expect(BASES.stars.factory!).toBeGreaterThan(BASES.stars.nuclearPlant!);
    expect(BASES.stars.nuclearPlant!).toBeGreaterThan(BASES.stars.solarFarm!);
    expect(BASES.stars.solarFarm!).toBeGreaterThan(BASES.stars.windFarm!);
    expect(unitLimit(s, depot)).toBe(unitLimit(s, town) + BASES.units.supplyDepot!);
    expect(unitLimit(s, factory)).toBe(unitLimit(s, town));
    // Depot: Ausbau Depot eingebaut, laedt Raketen nach / depot: depot upgrade built in, reloads rockets
    s.factions[0].techs.push(CITY_UPGRADES.tech.depot);
    expect(cityUpgradeCheck(s, 0, depot, 'depot')).toBe('alreadyBuilt');
    expect(cityUpgradeCheck(s, 0, factory, 'depot')).toBe('ok');
    // NEXUS: dieselben Sterne wie alle und dazu Energie = Rechenleistung ohne Rechenzentrum
    // NEXUS: the same stars as everyone and on top energy = compute without a data centre
    expect(computeStats(s, 1)).toMatchObject({ energy: 0, compute: 0 });
    const nexusTown = addBase(s, 2, 9, 1, 'factory');
    expect(trainCheck(s, nexusTown, 'railgun')).toBe('computeMissing');
    for (const c of [nuclear, solar, wind]) c.owner = 1;
    expect(cityIncome(s, nuclear)).toBe(base + BASES.stars.nuclearPlant!);
    expect(cityIncome(s, solar)).toBe(base + BASES.stars.solarFarm!);
    expect(cityIncome(s, wind)).toBe(base + BASES.stars.windFarm!);
    expect(cityIncome(s, nexusTown)).toBe(base + BASES.stars.factory!);
    const sum = BASES.energy.nuclearPlant! + BASES.energy.solarFarm! + BASES.energy.windFarm!;
    expect(computeStats(s, 1)).toMatchObject({ energy: sum, compute: sum, dataCenters: 0, powerPlants: 0 });
    expect(UNITS.railgun.compute!).toBeLessThanOrEqual(sum);
    expect(trainCheck(s, nexusTown, 'railgun')).toBe('ok');
    // verliert NEXUS die Kraftwerke, ist die Rechenleistung weg / when NEXUS loses the power kinds the compute is gone
    for (const c of [nuclear, solar, wind]) c.owner = 0;
    expect(trainCheck(s, nexusTown, 'railgun')).toBe('computeMissing');
    // fuer Menschen keine Energie / no energy for humans
    expect(computeStats(s, 0).energy).toBe(0);
    // Kult: Staedte bringen nichts ein, die Sterne der Stuetzpunkte bekommt er als Tribut / cult: cities bring nothing, it receives the bases' stars as tribute
    const cultTown = addCity(s, 8, 9, 2);
    expect(cityIncome(s, cultTown)).toBe(0);
    factory.owner = 2; nuclear.owner = 2;
    const tribute = tributeStars;
    expect(tribute(BASES.stars.factory!)).toBeLessThan(BASES.stars.factory!);
    expect(cityIncome(s, factory)).toBe(tribute(BASES.stars.factory!));
    expect(cityIncome(s, nuclear)).toBe(tribute(BASES.stars.nuclearPlant!));
    expect(cityIncome(s, factory)).toBeGreaterThan(0);
    expect(income(s, 2)).toBeGreaterThanOrEqual(tribute(BASES.stars.factory!) + tribute(BASES.stars.nuclearPlant!));
  });

  it('Nachschubdepot laedt Raketen nach wie der Ausbau Depot / the supply depot reloads rockets like the depot upgrade', () => {
    const s = blankGame({ factions: ['zyrr', 'korvat'], stars: 50 });
    addCity(s, 10, 0, 1, { hq: true });
    const depot = addBase(s, 3, 3, 0, 'supplyDepot');
    const town = addCity(s, 7, 7, 0);
    const type = ROCKETS.units[0];
    const a = addUnit(s, type, 0, depot.x, depot.y);
    const b = addUnit(s, type, 0, town.x, town.y);
    a.rockets = 0; b.rockets = 0;
    ok(s, { type: 'endTurn' });
    ok(s, { type: 'endTurn' });
    expect(a.rockets).toBe(ROCKETS.max);
    expect(b.rockets).toBe(0);
  });

  it('Fabrik: die Zyrr bekommen zusaetzlich sofort Xeno-Boden, Menschen nicht / factory: the Zyrr additionally get xeno ground at once, humans do not', () => {
    const s = blankGame({ factions: ['zyrr', 'korvat'], stars: 50 });
    // der Xeno-Boden des urspruenglichen Zyrr-Hauptquartiers bleibt im leeren Testspiel liegen: entfernen / the xeno ground of the original Zyrr HQ stays in the blank test game: remove it
    for (const t of s.tiles) delete t.xeno;
    addCity(s, 0, 10, 0, { hq: true });
    addCity(s, 10, 0, 1, { hq: true });
    const f1 = addBase(s, 3, 3, null, 'factory');
    const f2 = addBase(s, 7, 7, null, 'factory');
    const bunker = addBase(s, 3, 7, null, 'bunker');
    setTerrain(s, 2, 2, 'ocean');
    const grey = addUnit(s, 'grey', 0, 3, 3);
    const grey2 = addUnit(s, 'grey', 0, 3, 7);
    const inf = addUnit(s, 'infantry', 1, 7, 7);
    ok(s, { type: 'capture', unit: grey.id });
    ok(s, { type: 'capture', unit: grey2.id });
    // Stadtfeld und Gebiet (3x3) sind Xeno-Boden, Ozean nicht / city tile and territory (3x3) are xeno ground, ocean is not
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(!!tile(s, 3 + dx, 3 + dy).xeno, `${dx},${dy}`).toBe(!(dx === -1 && dy === -1));
    expect(tile(s, 5, 3).xeno).toBeFalsy();
    // sofort ausbilden, ohne zu terraformen / train at once, without terraforming
    expect(cityIncome(s, f1)).toBe(INCOME.perCityLevel + BASES.stars.factory!);
    // ein anderer Stuetzpunkt wird nicht terraformt / another base is not terraformed
    expect(tile(s, bunker.x, bunker.y).xeno).toBeFalsy();
    expect(trainCheck(s, bunker, 'grey')).toBe('invalid');
    s.units = s.units.filter((u) => u !== grey);
    s.factions[0].stars = 100;
    expect(trainCheck(s, f1, 'grey')).toBe('ok');
    // Menschen: dieselben Sterne, kein Xeno-Boden / humans: the same stars, no xeno ground
    ok(s, { type: 'endTurn' });
    ok(s, { type: 'capture', unit: inf.id });
    expect(f2.owner).toBe(1);
    expect(cityIncome(s, f2)).toBe(INCOME.perCityLevel + BASES.stars.factory!);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(tile(s, 7 + dx, 7 + dy).xeno).toBeFalsy();
  });
});

describe('Wohnbloecke und Supermarkt / residential blocks and supermarket', () => {
  it('liefern keine Truppen: keine Ausbildung, keine Staette, kein Schiff, kein Aufruesten, kein Rekrut, kein Panzer als Belohnung / deliver no troops', () => {
    for (const kind of BASES.noTraining) {
      // Korvat hat sonst in jeder Stadt eine Kaserne (PRODUCTION.citySites) / Korvat otherwise has barracks in every city
      const s = blankGame({ factions: ['korvat', 'nexus', 'zyrr', 'vesper'], stars: 500 });
      for (let y = 0; y < s.size; y++) setTerrain(s, 0, y, 'shallow');
      const c = addBase(s, 1, 3, 0, kind);
      const town = addCity(s, 1, 8, 0);
      expect(noTraining(c)).toBe(true);
      expect(citySites(s, town)).toEqual(['trainingCamp']);
      expect(citySites(s, c)).toEqual([]);
      // eingebaute Staetten aus alten Spielstaenden zaehlen dort auch nicht / built-in sites from old saves do not count there either
      c.works = ['trainingCamp', 'tankWorks', 'navalBase'];
      expect(citySites(s, c)).toEqual([]);
      expect(cityHasSite(s, c, 'trainingCamp')).toBe(false);
      for (const t of ['infantry', 'tank', 'steppeColossus', 'landingBoat', 'destroyer'] as UnitTypeId[]) expect(trainCheck(s, c, t), `${kind} ${t}`).toBe('noTraining');
      fails(s, { type: 'train', city: c.id, unitType: 'infantry' }, 'noTraining');
      // keine Produktionsstaette im Gebiet; der Marinestuetzpunkt als Einschiffungsort bleibt erlaubt, liefert aber kein Kriegsschiff
      // no production site in the territory; the naval base as an embarking point stays allowed but delivers no warship
      expect(buildCheck(s, 0, 'trainingCamp', 2, 2)).toMatchObject({ ok: false, error: 'cannotBuild' });
      expect(buildCheck(s, 0, 'armory', 2, 4)).toMatchObject({ ok: false, error: 'cannotBuild' });
      expect(buildCheck(s, 0, 'navalBase', 0, 3).ok).toBe(true);
      tile(s, 0, 3).building = 'navalBase';
      expect(cityHasSite(s, c, 'navalBase')).toBe(false);
      expect(trainCheck(s, c, 'destroyer')).toBe('noTraining');
      // kein Aufruesten im Gebiet / no upgrading in the territory
      const boat = addUnit(s, 'landingBoat', 0, 0, 4);
      expect(upgradeCheck(s, boat, 'destroyer')).toBe('noTraining');
      // Belohnung ab Stufe 5: kein Panzer / reward from level 5: no tank
      expect(rewardOptions(c, 5)).not.toContain('tank');
      expect(rewardOptions(town, 5)).toContain('tank');
      // keine Truppenkarten / no troop cards
      expect(troopCards(s, c, () => undefined)).toHaveLength(0);
      expect(troopCards(s, town, () => undefined).length).toBeGreaterThan(0);
      // NEXUS und Zyrr bilden dort ebenfalls nichts aus / NEXUS and the Zyrr train nothing there either
      c.owner = 1;
      expect(trainCheck(s, c, 'android')).toBe('noTraining');
      c.owner = 2;
      tile(s, c.x, c.y).xeno = true;
      expect(trainCheck(s, c, 'grey')).toBe('noTraining');
      // Kult: kein Rekrut auf dem Feld des Stuetzpunkts, daneben schon / cult: no recruit on the base's tile, next to it yes
      c.owner = 3;
      s.units = [];
      const z = addUnit(s, 'zealot', 3, 2, 3);
      expect(recruitCheck(s, 3, z.id, 'zealot', c.x, c.y)).toBe('invalidTile');
      expect(recruitCheck(s, 3, z.id, 'zealot', 3, 3)).toBe('ok');
    }
  });

  it('tragen Einheiten anderer Staedte: mehr Plaetze, volle Staedte bilden weiter aus / support units of other cities: more slots, full cities keep training', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 500 });
    const town = addCity(s, 2, 2, 0);
    const market = addBase(s, 6, 2, 0, 'supermarket');
    const blocks = addBase(s, 9, 2, null, 'housing');
    const plainLimit = unitLimit(s, town);
    expect(unitLimit(s, market)).toBe(plainLimit + BASES.units.supermarket!);
    expect(BASES.units.supermarket!).toBeGreaterThan(BASES.units.housing!);
    expect(BASES.units.housing!).toBeGreaterThan(BASES.units.supplyDepot!);
    expect(supplySlots(s, 0)).toBe(unitLimit(s, market));
    // Stadt fuellen / fill the city
    for (let i = 0; i < plainLimit; i++) addUnit(s, 'infantry', 0, 10, 4 + i, { homeCity: town.id });
    expect(freeUnitSlots(s, town)).toBe(unitLimit(s, market));
    expect(trainCheck(s, town, 'infantry')).toBe('ok');
    const r = ok(s, { type: 'train', city: town.id, unitType: 'infantry' });
    const u = s.units.find((x) => x.id === (r.events.find((e) => e.t === 'train') as { unit: number }).unit)!;
    // der Supermarkt traegt die Einheit / the supermarket supports the unit
    expect(u.homeCity).toBe(market.id);
    expect(supplySlots(s, 0)).toBe(unitLimit(s, market) - 1);
    // Versorger voll: Limit erreicht / supplier full: limit reached
    s.units = s.units.filter((x) => x !== u);
    for (let i = 0; i < unitLimit(s, market); i++) addUnit(s, 'infantry', 0, 8, 4 + i, { homeCity: market.id });
    expect(trainCheck(s, town, 'infantry')).toBe('unitLimit');
    // ein neutraler oder fremder Versorger zaehlt nicht; eingenommen schon / a neutral or foreign supplier does not count; a captured one does
    expect(supplySlots(s, 0)).toBe(0);
    blocks.owner = 0;
    expect(supplySlots(s, 0)).toBe(unitLimit(s, blocks));
    expect(unitLimit(s, blocks)).toBe(plainLimit + BASES.units.housing!);
    expect(trainCheck(s, town, 'infantry')).toBe('ok');
  });

  it('Verlust: die getragenen Einheiten verlieren ihre Heimat, die Plaetze gehen an den Eroberer / loss: the supported units lose their home, the slots go to the conqueror', () => {
    const s = blankGame({ factions: ['velkar', 'dravon'], stars: 100 });
    addCity(s, 0, 10, 0, { hq: true });
    addCity(s, 10, 0, 1, { hq: true });
    const market = addBase(s, 5, 5, 0, 'supermarket');
    const mine = addUnit(s, 'infantry', 0, 1, 1, { homeCity: market.id });
    const raider = addUnit(s, 'infantry', 1, 5, 5);
    ok(s, { type: 'endTurn' });
    ok(s, { type: 'capture', unit: raider.id });
    expect(market.owner).toBe(1);
    expect(market.base).toBe('supermarket');
    expect(mine.homeCity).toBeNull();
    expect(supplySlots(s, 0)).toBe(0);
    expect(supplySlots(s, 1)).toBe(unitLimit(s, market));
  });
});

describe('Einnahme, Verlust, Spielstaende / capture, loss, saves', () => {
  it('ein eingenommener Stuetzpunkt verhaelt sich wie eine Stadt und behaelt seine Art beim Besitzwechsel / a captured base behaves like a city and keeps its kind when the owner changes', () => {
    const s = blankGame({ factions: ['velkar', 'nexus'], stars: 300 });
    addCity(s, 0, 10, 0, { hq: true });
    addCity(s, 10, 0, 1, { hq: true });
    const tf = addBase(s, 4, 4, null, 'tankFactory');
    const inf = addUnit(s, 'infantry', 0, 4, 4);
    ok(s, { type: 'capture', unit: inf.id });
    expect(tf.owner).toBe(0);
    expect(tf.base).toBe('tankFactory');
    expect(tf.level).toBe(1);
    expect(tile(s, 5, 5).territory).toBe(tf.id);
    expect(cityIncome(s, tf)).toBe(INCOME.perCityLevel);
    // waechst, steigt auf, laesst sich ausbauen wie jede Stadt / grows, levels up and can be upgraded like any city
    expect(buyLevelCheck(s, 0, tf)).toBe('ok');
    expect(levelUpCost(s, tf)).toBe(levelUpCost(s, addCity(s, 0, 5, 0)));
    s.factions[0].techs.push(CITY_UPGRADES.tech.bunker);
    s.factions[0].stars = 300;
    expect(cityUpgradeCheck(s, 0, tf, 'bunker')).toBe('ok');
    s.units = s.units.filter((u) => u !== inf);
    expect(trainCheck(s, tf, 'teslaTank')).toBe('ok');
    // NEXUS erobert die Fabrik: Velkar verliert die Staette, NEXUS bekommt den Rabatt / NEXUS conquers the factory: Velkar loses the site, NEXUS gets the discount
    const raider = addUnit(s, 'android', 1, 4, 4);
    ok(s, { type: 'endTurn' });
    expect(unitCost(s, 1, 'titan')).toBe(UNITS.titan.cost);
    ok(s, { type: 'capture', unit: raider.id });
    expect(tf.owner).toBe(1);
    expect(tf.base).toBe('tankFactory');
    expect(unitCost(s, 1, 'titan')).toBe(Math.ceil(UNITS.titan.cost! * (1 - BASES.discount)));
    const home = addCity(s, 9, 9, 0);
    expect(trainCheck(s, home, 'teslaTank')).toBe('buildingMissing');
  });

  it('leere Panzerfabrik finden, einnehmen, nutzen: keine Verteidiger, ein Zug spaeter rollt der Panzer, ohne weitere Voraussetzung / find an empty tank factory, capture it, use it: no defenders, one turn later the tank rolls, no further prerequisite', () => {
    // jede Produktionsart mit einer Menschen-Fraktion durchgespielt: einnehmen, naechster Zug, Einheit der Art ausbilden
    // every production kind played through with a human faction: capture, next turn, train the kind's unit
    const cases: [BaseKind, UnitTypeId][] = [['tankFactory', 'tank'], ['airbase', 'heli'], ['gunWorks', 'artillery'], ['navalStation', 'destroyer'], ['barracks', 'infantry']];
    for (const [kind, unit] of cases) {
      const s = blankGame({ factions: ['dravon', 'korvat'], stars: 0 });
      for (let y = 0; y < s.size; y++) setTerrain(s, 0, y, 'shallow');
      const hq = addCity(s, 9, 9, 0, { hq: true });
      addCity(s, 9, 1, 1, { hq: true });
      const base = addBase(s, 1, 5, null, kind);
      // neutral: niemand steht darauf, kein Gebiet, kein Gebaeude, keine Forschung der Fraktion / neutral: nobody stands on it, no territory, no building, no research of the faction
      expect(s.units.some((u) => u.x === base.x && u.y === base.y)).toBe(false);
      expect(s.tiles.some((t) => t.building !== null)).toBe(false);
      s.factions[0].techs = [];
      // die Einheit steht seit Zugbeginn auf dem Stuetzpunkt und nimmt ihn ein (wie jede Siedlung) / the unit has stood on the base since the start of the turn and captures it (like any village)
      const inf = addUnit(s, 'infantry', 0, base.x, base.y);
      ok(s, { type: 'capture', unit: inf.id });
      expect(base.owner, kind).toBe(0);
      expect(base.level).toBe(1);
      // naechster eigener Zug: Einheit zieht vom Stadtfeld, die Fabrik liefert / next own turn: the unit leaves the city tile, the factory delivers
      ok(s, { type: 'endTurn' });
      ok(s, { type: 'endTurn' });
      expect(s.current).toBe(0);
      ok(s, { type: 'move', unit: inf.id, to: { x: 2, y: 5 } });
      // einzige Bedingung sind die Sterne / the only condition is the stars
      s.factions[0].stars = 0;
      expect(trainCheck(s, base, unit), kind).toBe('notEnoughStars');
      s.factions[0].stars = unitCost(s, 0, unit)!;
      expect(trainCheck(s, base, unit), kind).toBe('ok');
      const r = ok(s, { type: 'train', city: base.id, unitType: unit });
      const made = s.units.find((u) => u.id === (r.events.find((e) => e.t === 'train') as { unit: number }).unit)!;
      expect(made.type, kind).toBe(unit);
      expect(made.owner).toBe(0);
      expect(made.homeCity).toBe(base.id);
      expect(s.factions[0].stars).toBe(0);
      // im Hauptquartier ohne die Staette geht dasselbe nicht (ausser der Kaserne, die es dort eingebaut hat)
      // the same does not work at the HQ without the site (except the barracks, which is built in there)
      s.factions[0].stars = 500;
      expect(trainCheck(s, hq, unit), kind).toBe(kind === 'barracks' ? 'ok' : kind === 'navalStation' ? 'noCoast' : 'buildingMissing');
    }
  });

  it('alter Spielstand ohne Arten laedt und spielt wie zuvor / an old save without kinds loads and plays as before', () => {
    const facs = [{ id: 'alvenia' as FactionId, human: false, difficulty: 'normal' as const }, { id: 'nexus' as FactionId, human: false, difficulty: 'normal' as const }];
    const fresh = createGame(defaultConfig({ seed: 21, size: 14, mapType: 'continent', mode: 'conquest', factions: facs }));
    // wie vor den Stuetzpunkten gespeichert: keine Art an den Orten, kein Feld in der Konfiguration / as saved before the bases: no kind on the places, no field in the config
    const old = JSON.parse(JSON.stringify(fresh)) as GameState;
    for (const c of old.cities) delete c.base;
    delete old.config.bases;
    expect(isValidState(old)).toBe(true);
    const s = migrateState(old);
    expect(s.cities.every((c) => c.base === undefined)).toBe(true);
    const village = s.cities.find((c) => c.owner === null && !c.tower)!;
    expect(noTraining(village)).toBe(false);
    expect(baseStars(s, village)).toBe(0);
    aiDebug.errors = 0;
    let failed = 0;
    while (!s.over && s.round <= 12) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const r = applyCommand(s, cmd);
        if (!r.ok) failed++;
        if (cmd.type === 'endTurn' && r.ok) break;
      }
    }
    expect(failed).toBe(0);
    expect(aiDebug.errors).toBe(0);
    expect(s.cities.every((c) => c.base === undefined)).toBe(true);
    // Einkommen einer eingenommenen Siedlung wie frueher / income of a captured village as before
    const taken = s.cities.find((c) => c.owner !== null && !c.isHQ && !c.tower && !s.factions[c.owner].id.startsWith('ves'));
    if (taken) expect(baseStars(s, taken)).toBe(0);
    // ein neuer Spielstand mit Arten uebersteht Speichern und Laden / a new save with kinds survives saving and loading
    const round = migrateState(JSON.parse(JSON.stringify(fresh)) as GameState);
    expect(round.cities.map((c) => c.base)).toEqual(fresh.cities.map((c) => c.base));
  }, 120_000);
});

describe('KI / AI', () => {
  const run = (s: GameState, rounds: number, onEvent?: (e: { t: string } & Record<string, unknown>) => void) => {
    let failed = 0;
    const end = s.round + rounds;
    while (!s.over && s.round < end) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = s.factions[f].human ? { type: 'endTurn' as const } : planNextCommand(s, f);
        const r = applyCommand(s, cmd);
        if (!r.ok) failed++;
        for (const e of r.events) onEvent?.(e as { t: string } & Record<string, unknown>);
        if (cmd.type === 'endTurn' && r.ok) break;
      }
    }
    return failed;
  };

  it('nutzt die eingebaute Staette: Panzer aus der Panzerfabrik ohne eigenes Panzerwerk / uses the built-in site: tanks from the tank factory without a tank works of its own', () => {
    const s = createGame(defaultConfig({ seed: 31, size: 14, mapType: 'continent', mode: 'conquest', roundLimit: null,
      factions: [{ id: 'korvat', human: false, difficulty: 'normal' }, { id: 'dravon', human: true, difficulty: 'normal' }] }));
    // Korvats Heimat-Stuetzpunkt zur eigenen Panzerfabrik machen / turn Korvat's home base into its own tank factory
    const hq = s.cities.find((c) => c.isHQ && c.owner === 0)!;
    const home = s.cities.filter((c) => c.base).sort((a, b) => dist(a, hq) - dist(b, hq))[0];
    home.base = 'tankFactory';
    home.owner = 0;
    for (const p of [...neighbors(s.size, home.x, home.y), { x: home.x, y: home.y }]) { const t = s.tiles[idx(s.size, p.x, p.y)]; if (t.territory === null) t.territory = home.id; }
    s.factions[0].stars = 400;
    const trained = new Set<UnitTypeId>();
    let builtTankWorks = false;
    aiDebug.errors = 0;
    const failed = run(s, 12, (e) => {
      if (e.t === 'train') { const u = s.units.find((x) => x.id === e.unit); if (u && u.owner === 0) trained.add(u.type); }
      if (e.t === 'build' && e.building === 'tankWorks') builtTankWorks = true;
    });
    expect(failed).toBe(0);
    expect(aiDebug.errors).toBe(0);
    expect(trained.has('steppeColossus')).toBe(true);
    expect(builtTankWorks).toBe(false);
  }, 120_000);

  it('plant keine Produktion an Wohnbloecken und nutzt ihre Plaetze, ohne Fehlbefehle / plans no production at residential blocks and uses their slots, no failed commands', () => {
    const s = createGame(defaultConfig({ seed: 33, size: 14, mapType: 'continent', mode: 'conquest', roundLimit: null,
      factions: [{ id: 'velkar', human: false, difficulty: 'normal' }, { id: 'nexus', human: false, difficulty: 'normal' }] }));
    for (const f of [0, 1]) {
      const hq = s.cities.find((c) => c.isHQ && c.owner === f)!;
      const home = s.cities.filter((c) => c.base && c.owner === null).sort((a, b) => dist(a, hq) - dist(b, hq))[0];
      home.base = f === 0 ? 'housing' : 'supermarket';
      home.owner = f;
      for (const p of [...neighbors(s.size, home.x, home.y), { x: home.x, y: home.y }]) { const t = s.tiles[idx(s.size, p.x, p.y)]; if (t.territory === null) t.territory = home.id; }
      // Hauptquartier bis ans Limit fuellen: die naechste Einheit braucht einen Platz beim Versorger
      // fill the HQ up to its limit: the next unit needs a slot at the supplier
      const spots = neighbors(s.size, hq.x, hq.y).filter((p) => s.tiles[idx(s.size, p.x, p.y)].terrain === 'plain' && !s.units.some((u) => u.x === p.x && u.y === p.y));
      while (s.units.filter((u) => u.homeCity === hq.id).length < unitLimit(s, hq)) { const p = spots.pop()!; addUnit(s, f === 0 ? 'infantry' : 'android', f, p.x, p.y, { homeCity: hq.id }); }
      expect(freeUnitSlots(s, hq)).toBe(supplySlots(s, f));
      s.factions[f].stars = 45;
    }
    aiDebug.errors = 0;
    const suppliers = s.cities.filter((c) => noTraining(c) && c.owner !== null).map((c) => c.id);
    let wrong = 0;
    const failed = run(s, 8, (e) => {
      if (e.t === 'train' && suppliers.includes(e.city as number)) wrong++;
      if (e.t === 'build') { const c = s.cities.find((x) => x.id === s.tiles[idx(s.size, e.x as number, e.y as number)].territory); if (c && noTraining(c) && PRODUCTION.sites.includes(e.building as never) && e.building !== 'navalBase') wrong++; }
    });
    expect(failed).toBe(0);
    expect(aiDebug.errors).toBe(0);
    expect(wrong).toBe(0);
    // die Plaetze der Versorger werden belegt, sobald das Hauptquartier voll ist / the suppliers' slots are used once the HQ is full
    expect(s.units.some((u) => u.homeCity !== null && suppliers.includes(u.homeCity))).toBe(true);
  }, 120_000);

  it('Zielwahl nach Fraktionsgruppe: Menschen militaerische Stuetzpunkte, Zyrr die Fabrik, NEXUS Kraftwerke; nie an einem naeheren Ziel vorbei / target choice by faction group; never past a closer target', () => {
    // sachlicher Wert plus Vorliebe / objective worth plus preference
    const v = blankGame({ factions: ['korvat', 'zyrr', 'nexus', 'vesper'] });
    const worthOf = (f: number, kind: BaseKind) => { const c = addBase(v, 5, 5, null, kind); const w = baseCaptureWorth(v, f, c); v.cities = v.cities.filter((x) => x !== c); tile(v, 5, 5).cityId = null; return w; };
    expect(worthOf(0, 'bunker')).toBeGreaterThan(worthOf(0, 'factory'));
    expect(worthOf(0, 'gunWorks')).toBeGreaterThan(worthOf(0, 'solarFarm'));
    expect(worthOf(1, 'factory')).toBeGreaterThan(worthOf(1, 'bunker'));
    expect(worthOf(1, 'factory')).toBeGreaterThan(worthOf(0, 'factory'));
    expect(worthOf(2, 'solarFarm')).toBeGreaterThan(worthOf(2, 'factory'));
    expect(worthOf(2, 'nuclearPlant')).toBeGreaterThan(worthOf(0, 'nuclearPlant'));
    // Vorliebe nur fuer die eigene Gruppe, der Kult hat keine / preference only for the own group, the cult has none
    for (const k of BASE_KINDS) {
      expect(basePreference(v, 0, k) > 0, k).toBe(BASES.military.includes(k));
      expect(basePreference(v, 1, k) > 0, k).toBe(k === 'factory');
      expect(basePreference(v, 2, k) > 0, k).toBe(BASES.energy[k] !== undefined);
      expect(basePreference(v, 3, k), k).toBe(0);
      // die Vorliebe bleibt unter dem Wert von zwei Feldern Weg (Ortsziele: 9 je Feld) / the preference stays below the worth of two tiles of travel
      for (const f of [0, 1, 2]) expect(basePreference(v, f, k)).toBeLessThan(18);
    }
    // kleine Karte: zwei freie Stuetzpunkte links und rechts der einzigen Einheit; welches Ziel gibt ihr die KI?
    // small map: two free bases left and right of the only unit; which target does the AI give it?
    const target = (fid: FactionId, left: BaseKind, right: BaseKind, leftDist = 4, rightDist = 4): BaseKind | null => {
      const s = blankGame({ factions: [fid, 'dravon'], stars: 0, mode: 'conquest', size: 22 });
      s.factions[0].human = false;
      // Karte bekannt: die Wahl haengt am Wert, nicht daran, was zuerst entdeckt wird / map known: the choice depends on the worth, not on what is discovered first
      s.factions[0].explored.fill(1);
      addCity(s, 11, 2, 0, { hq: true });
      // Frieden mit dem Gegner, damit nur die freien Stuetzpunkte zaehlen / peace with the enemy so only the free bases count
      addCity(s, 11, 20, 1, { hq: true });
      s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
      const a = addBase(s, 11 - leftDist, 10, null, left);
      const b = addBase(s, 11 + rightDist, 10, null, right);
      const u = addUnit(s, fid === 'zyrr' ? 'grey' : fid === 'nexus' ? 'android' : fid === 'vesper' ? 'zealot' : 'infantry', 0, 11, 10);
      const g = buildCtx(s, 0).goals.get(u.id);
      if (!g || g.kind !== 'village') return null;
      return g.x === a.x && g.y === a.y ? left : g.x === b.x && g.y === b.y ? right : null;
    };
    // gleich weit: die Vorliebe der Gruppe entscheidet, auf beiden Seiten / same distance: the group's preference decides, on either side
    expect(target('korvat', 'factory', 'bunker')).toBe('bunker');
    expect(target('korvat', 'bunker', 'factory')).toBe('bunker');
    expect(target('velkar', 'solarFarm', 'gunWorks')).toBe('gunWorks');
    expect(target('zyrr', 'bunker', 'factory')).toBe('factory');
    expect(target('zyrr', 'factory', 'bunker')).toBe('factory');
    expect(target('nexus', 'factory', 'solarFarm')).toBe('solarFarm');
    expect(target('nexus', 'windFarm', 'tankFactory')).toBe('windFarm');
    // der Kult hat keine Vorliebe und waehlt nach dem, was er bekommt: Plaetze und Schutz der Wohnbloecke vor dem Drittel
    // der Fabrik-Sterne, das ihm als Tribut bleibt
    // the cult has no preference and chooses by what it gets: the residential blocks' slots and protection before the
    // third of the factory's stars it keeps as tribute
    expect(target('vesper', 'housing', 'factory')).toBe('housing');
    expect(target('vesper', 'factory', 'supermarket')).toBe('supermarket');
    // liegt der bevorzugte Stuetzpunkt deutlich weiter weg (vier Zuege mehr), nimmt die KI den naeheren
    // if the preferred base is clearly farther away (four more turns), the AI takes the closer one
    expect(target('korvat', 'factory', 'bunker', 2, 10)).toBe('factory');
    expect(target('zyrr', 'bunker', 'factory', 2, 10)).toBe('bunker');
    expect(target('nexus', 'factory', 'solarFarm', 2, 10)).toBe('factory');
  }, 120_000);
});

describe('Texte / texts', () => {
  it('Wirkung je Fraktion und Regeln nennen die Zahlen aus BASES in beiden Sprachen / effect per faction and rules name the numbers from BASES in both languages', () => {
    for (const lang of ['de', 'en'] as const) {
      setLanguage(lang);
      for (const kind of BASE_KINDS) for (const f of [null, ...FACTION_IDS]) {
        const text = baseEffectText(kind, f);
        expect(text, `${lang} ${kind} ${f}`).not.toMatch(/\{\w+\}/);
        expect(text.length, `${lang} ${kind} ${f}`).toBeGreaterThan(10);
      }
      expect(baseEffectText('factory', 'korvat')).toContain(`+${BASES.stars.factory}`);
      // die Vorlieben sind sichtbar: Fabrik nennt die Zyrr, Kraftwerke nennen NEXUS / the preferences are visible
      expect(baseEffectText('factory', 'korvat')).toContain('Zyrr');
      for (const k of ['nuclearPlant', 'solarFarm', 'windFarm'] as BaseKind[]) {
        expect(baseEffectText(k, 'dravon')).toContain('NEXUS');
        expect(baseEffectText(k, 'dravon')).toContain(`+${BASES.stars[k]}`);
        expect(baseEffectText(k, 'nexus')).toContain(`+${BASES.energy[k]}`);
        expect(baseEffectText(k, 'nexus')).toContain(`+${BASES.stars[k]} `);
      }
      expect(baseEffectText('bunker', 'vesper')).toContain(`+${BASES.defense.bunker}`);
      expect(baseEffectText('tankFactory', 'nexus')).toContain(`${Math.round(BASES.discount * 100)} %`);
      expect(baseEffectText('tankFactory', 'meridon')).toContain(`+${BASES.gapStars}`);
      expect(baseEffectText('airbase', 'vesper')).toContain(`+${tributeStars(BASES.gapStars)}`);
      expect(baseEffectText('factory', 'vesper')).toContain(`+${tributeStars(BASES.stars.factory!)} `);
      expect(baseEffectText('factory', 'vesper')).not.toContain(`+${BASES.stars.factory} `);
      expect(baseEffectText('navalStation', 'zyrr')).toContain(`+${BASES.gapStars}`);
      const rules = rulesHtml('bases', 'korvat');
      expect(rules).toContain('data-rule="bases"');
      expect(rules).not.toMatch(/\{\w+\}/);
      expect((baseRulesLines().match(/<li/g) ?? []).length).toBe(BASE_KINDS.length);
    }
    setLanguage('de');
  });
});
