/**
 * Ressourcengebaeude der Fraktionen: Ortsregeln, Besitz, Wirkung, eroberte Gebaeude, KI.
 * Faction resource buildings: site rules, ownership, effects, captured buildings, AI.
 */
import { describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import {
  FACTION_BUILDINGS, buildCheck, buildingWorksFor, cityIncome, computeStats, countBuildings, income, logisticsIncome, recruitSpot, researchCost,
  techUnlocks, trainCheck, type GameState,
} from '../src/core';
import {
  BUILDINGS, CITY, FACTION_IDS, INCOME, RESOURCE, RESOURCE_BUILDINGS, UNIQUE, UNITS, VETERAN, type BuildingId, type FactionId, type TechId,
} from '../src/data/balance';
import { addCity, addUnit, blankGame, fails, ok, setTerrain, tile, unit } from './helpers';

/**
 * Fraktion f gegen einen Gegner, grosse Stadt (Stufe 9, kein Aufstieg im Test), viele Sterne, Technik des Gebaeudes.
 * Faction f against an opponent, big city (level 9, no level-up during the test), many stars, the building's tech.
 */
function setup(f: FactionId, other: FactionId = f === 'dravon' ? 'korvat' : 'dravon') {
  const s = blankGame({ factions: [f, other], stars: 500 });
  for (const t of s.tiles) t.biome = 'grassland';
  const c = addCity(s, 4, 4, 0, { hq: true, level: 9, radius: 2 });
  const enemy = addCity(s, 9, 9, 1, { hq: true, level: 2 });
  const b = RESOURCE.buildings[f];
  const tech = BUILDINGS[b].tech;
  if (tech && !s.factions[0].techs.includes(tech)) s.factions[0].techs.push(tech);
  // Kult: ohne Einheit ausgeschieden, ein Eiferer in der Ecke haelt ihn im Spiel / cult: eliminated without a unit, a zealot in the corner keeps it in the game
  if (f === 'vesper') addUnit(s, 'zealot', 0, 0, s.size - 1);
  return { s, c, enemy, b };
}

/** Bevoelkerung samt Stufen (Stufe n -> n+1 kostet n+1) / population including levels */
function totalPop(s: GameState, id: number): number {
  const c = s.cities.find((o) => o.id === id)!;
  let p = c.pop;
  for (let l = 1; l < c.level; l++) p += CITY.levelUpCost(l);
  return p;
}

/** Sterne ohne Kampfgeschehen, Einkommen einer Stadt / city income without combat */
const cityInc = (s: GameState, id: number) => cityIncome(s, s.cities.find((o) => o.id === id)!);
/** Bevoelkerung je angrenzendem Agrarbetrieb (Traktorstation) / population per adjacent farm (tractor station) */
const ADJ = BUILDINGS.tractorStation.adjacency!.pop;

describe('Ressourcengebaeude: Besitz / resource buildings: ownership', () => {
  it('every faction has exactly one resource building, owned in FACTION_BUILDINGS, named and described in DE and EN', () => {
    expect(RESOURCE_BUILDINGS).toHaveLength(FACTION_IDS.length);
    expect(new Set(RESOURCE_BUILDINGS).size).toBe(FACTION_IDS.length);
    for (const f of FACTION_IDS) {
      const b = RESOURCE.buildings[f];
      expect(FACTION_BUILDINGS[b]).toBe(f);
      for (const d of [de, en] as { buildings: Record<string, string>; buildingDesc: Record<string, string> }[]) {
        expect(d.buildings[b], b).toBeTruthy();
        expect(d.buildingDesc[b], b).toBeTruthy();
      }
      // Zyrr und NEXUS forschen nicht / Zyrr and NEXUS do not research
      if (f === 'zyrr' || f === 'nexus') expect(BUILDINGS[b].tech).toBeNull();
      else {
        const tech = BUILDINGS[b].tech as TechId;
        expect(techUnlocks(tech, f).buildings).toContain(b);
        for (const g of FACTION_IDS) if (g !== f) expect(techUnlocks(tech, g).buildings).not.toContain(b);
      }
    }
  });

  it('only the own faction can build it, even with the tech', () => {
    for (const f of FACTION_IDS) {
      const b = RESOURCE.buildings[f];
      for (const g of FACTION_IDS) {
        if (g === f) continue;
        const { s } = setup(g, f === 'korvat' ? 'dravon' : 'korvat');
        if (BUILDINGS[b].tech) s.factions[0].techs.push(BUILDINGS[b].tech!);
        expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'wrongFaction' });
      }
    }
  });
});

describe('Ressourcengebaeude: Ortsregeln und Wirkung / site rules and effects', () => {
  it('Korvat, tractor station: farmland only, upgrades a farm for the difference, +1 pop per adjacent farm, counts as a farm', () => {
    const { s, c, b } = setup('korvat');
    expect(b).toBe('tractorStation');
    setTerrain(s, 5, 4, 'plain', { resource: null });
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    s.factions[0].techs = s.factions[0].techs.filter((t) => t !== 'agritech');
    setTerrain(s, 5, 4, 'plain', { resource: 'farmland' });
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'techMissing' });
    s.factions[0].techs.push('agritech');
    // Agrarbetrieb daneben, dann Station: 3 + 1 / farm next to it, then the station: 3 + 1
    setTerrain(s, 6, 4, 'plain', { resource: 'farmland' });
    ok(s, { type: 'build', building: 'farm', x: 6, y: 4 });
    let p0 = totalPop(s, c.id);
    ok(s, { type: 'build', building: b, x: 5, y: 4 });
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.tractorStation.pop + ADJ);
    // spaeter gebauter Agrarbetrieb daneben: +2 eigener, +1 fuer die Station / farm built next to it later: +2 own, +1 for the station
    setTerrain(s, 5, 5, 'plain', { resource: 'farmland' });
    p0 = totalPop(s, c.id);
    ok(s, { type: 'build', building: 'farm', x: 5, y: 5 });
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.farm.pop + ADJ);
    // Ausbau des Agrarbetriebs (6,4): Preis = Differenz, Bevoelkerung = Differenz + Nachbarn (5,4) und (5,5)
    // upgrade of the farm at (6,4): price = difference, population = difference + neighbours (5,4) and (5,5)
    const stars = s.factions[0].stars;
    p0 = totalPop(s, c.id);
    const chk = buildCheck(s, 0, b, 6, 4);
    expect(chk).toEqual({ ok: true, cost: BUILDINGS.tractorStation.cost - BUILDINGS.farm.cost });
    ok(s, { type: 'build', building: b, x: 6, y: 4 });
    expect(s.factions[0].stars).toBe(stars - chk.cost);
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.tractorStation.pop - BUILDINGS.farm.pop + 2 * ADJ);
    // zaehlt als Agrarbetrieb fuer die Lebensmittelfabrik / counts as a farm for the food factory
    s.factions[0].techs.push('foodIndustry');
    p0 = totalPop(s, c.id);
    ok(s, { type: 'build', building: 'foodFactory', x: 6, y: 5 });
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.foodFactory.adjacency!.pop * 3);
    // kein Ausbau anderer Gebaeude / no upgrade of other buildings
    setTerrain(s, 3, 3, 'plain', { resource: 'farmland', building: 'storehouse' });
    expect(buildCheck(s, 0, b, 3, 3)).toMatchObject({ ok: false, error: 'alreadyBuilt' });
  });

  it('Dravon, deep mine: ore only, +2 stars per round, upgrades a mine, counts as a mine for steel mill and logistics', () => {
    const { s, c, b } = setup('dravon');
    expect(b).toBe('deepMine');
    setTerrain(s, 5, 4, 'mountain', { resource: null });
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    setTerrain(s, 5, 4, 'mountain', { resource: 'ore' });
    const inc0 = cityInc(s, c.id);
    let p0 = totalPop(s, c.id);
    ok(s, { type: 'build', building: b, x: 5, y: 4 });
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.deepMine.pop);
    expect(cityInc(s, c.id) - inc0).toBe(BUILDINGS.deepMine.stars);
    // Ausbau eines Tagebaus / upgrade of a mine
    s.factions[0].techs.push('mining');
    setTerrain(s, 3, 4, 'mountain', { resource: 'ore' });
    ok(s, { type: 'build', building: 'mine', x: 3, y: 4 });
    expect(buildCheck(s, 0, b, 3, 4)).toEqual({ ok: true, cost: BUILDINGS.deepMine.cost - BUILDINGS.mine.cost });
    p0 = totalPop(s, c.id);
    ok(s, { type: 'build', building: b, x: 3, y: 4 });
    expect(tile(s, 3, 4).building).toBe('deepMine');
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.deepMine.pop - BUILDINGS.mine.pop);
    // Stahlwerk und Logistikzentrum zaehlen die Zeche als Tagebau / steel mill and logistics centre count the deep mine as a mine
    s.factions[0].techs.push('armsIndustry', 'logistics');
    p0 = totalPop(s, c.id);
    ok(s, { type: 'build', building: 'steelMill', x: 4, y: 3 });
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.steelMill.adjacency!.pop * 2);
    expect(logisticsIncome(s, 4, 5)).toBe(INCOME.logisticsPerAdjacent * 2);
  });

  it('Alvenia, hill vineyard: plains in the hills, one per city, +2 stars and +1 per active embassy (at most +3)', () => {
    const { s, c, b } = setup('alvenia');
    expect(b).toBe('hillVineyard');
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    tile(s, 5, 4).biome = 'hills';
    tile(s, 3, 4).biome = 'hills';
    setTerrain(s, 6, 4, 'forest', { biome: 'hills' });
    expect(buildCheck(s, 0, b, 6, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    const inc0 = cityInc(s, c.id);
    ok(s, { type: 'build', building: b, x: 5, y: 4 });
    expect(cityInc(s, c.id) - inc0).toBe(BUILDINGS.hillVineyard.stars);
    expect(buildCheck(s, 0, b, 3, 4)).toMatchObject({ ok: false, error: 'onePerCity' });
    // Botschaft beim Gegner (mit Hauptquartier) / embassy at the opponent (with HQ)
    s.factions[0].embassies = [1];
    expect(cityInc(s, c.id) - inc0).toBe(BUILDINGS.hillVineyard.stars! + RESOURCE.vineyardPerEmbassy);
    // Deckel / cap
    const big = blankGame({ factions: ['alvenia', 'dravon', 'korvat', 'meridon', 'velkar'], stars: 100 });
    const bc = addCity(big, 2, 2, 0, { hq: true, level: 9 });
    for (let i = 1; i < 5; i++) addCity(big, 2 + i * 2, 9, i, { hq: true });
    big.factions[0].techs.push('agritech');
    tile(big, 3, 2).biome = 'hills';
    ok(big, { type: 'build', building: b, x: 3, y: 2 });
    big.factions[0].embassies = [1, 2, 3, 4];
    const base = cityIncome(big, bc);
    big.factions[0].embassies = [];
    expect(base - cityIncome(big, bc)).toBe(RESOURCE.vineyardPerEmbassy * RESOURCE.vineyardEmbassyMax);
  });

  it('Meridon, trade harbour: fish only, upgrades a fishery, +2 stars and +1 with a naval base in the city', () => {
    const { s, c, b } = setup('meridon');
    expect(b).toBe('tradeHarbour');
    s.factions[0].techs = s.factions[0].techs.filter((t) => t !== 'shipbuilding');
    setTerrain(s, 5, 4, 'shallow', { resource: 'fish' });
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'techMissing' });
    s.factions[0].techs.push('shipbuilding');
    setTerrain(s, 5, 3, 'shallow', { resource: null });
    expect(buildCheck(s, 0, b, 5, 3)).toMatchObject({ ok: false, error: 'invalidTile' });
    ok(s, { type: 'build', building: 'fishery', x: 5, y: 4 });
    expect(buildCheck(s, 0, b, 5, 4)).toEqual({ ok: true, cost: BUILDINGS.tradeHarbour.cost - BUILDINGS.fishery.cost });
    const inc0 = cityInc(s, c.id);
    const p0 = totalPop(s, c.id);
    ok(s, { type: 'build', building: b, x: 5, y: 4 });
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.tradeHarbour.pop - BUILDINGS.fishery.pop);
    expect(cityInc(s, c.id) - inc0).toBe(BUILDINGS.tradeHarbour.stars);
    ok(s, { type: 'build', building: 'navalBase', x: 5, y: 3 });
    expect(cityInc(s, c.id) - inc0).toBe(BUILDINGS.tradeHarbour.stars! + RESOURCE.harbourNavalBonus);
  });

  it('Velkar, polar station: tundra only, research 3 % cheaper per station, at most 3, on top of the test lab', () => {
    const { s, b } = setup('velkar');
    expect(b).toBe('polarStation');
    // sieben Staedte: Grundpreis Stufe 3 = (3 x 7 + 4) x 5 = 125, Forschungsvorsprung -12 % = 110
    // seven cities: base price tier 3 = (3 x 7 + 4) x 5 = 125, research lead -12 % = 110
    for (const x of [0, 2, 4, 6, 8, 10]) addCity(s, x, 10, 0);
    expect(researchCost(s, 0, 'logistics')).toBe(110);
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    const spots: [number, number][] = [[5, 4], [3, 4], [4, 5], [4, 3]];
    for (const [x, y] of spots) tile(s, x, y).biome = 'tundra';
    setTerrain(s, 5, 5, 'plain', { resource: 'ore', biome: 'tundra' });
    expect(buildCheck(s, 0, b, 5, 5)).toMatchObject({ ok: false, error: 'invalidTile' });
    setTerrain(s, 3, 3, 'mountain', { biome: 'tundra' });
    expect(buildCheck(s, 0, b, 3, 3)).toMatchObject({ ok: true });
    ok(s, { type: 'build', building: b, x: 5, y: 4 });
    expect(researchCost(s, 0, 'logistics')).toBe(Math.ceil(110 * (1 - RESOURCE.polarDiscount)));
    for (const [x, y] of spots.slice(1)) ok(s, { type: 'build', building: b, x, y });
    expect(countBuildings(s, 0, b)).toBe(4);
    // vier Stationen wirken wie drei / four stations work like three
    expect(researchCost(s, 0, 'logistics')).toBe(Math.ceil(110 * (1 - RESOURCE.polarDiscount * RESOURCE.polarMax) - 1e-9));
    // zusaetzlich zum Versuchslabor (eigene Grenze) / on top of the test lab (own cap)
    setTerrain(s, 6, 6, 'plain', { biome: 'grassland' });
    ok(s, { type: 'build', building: 'testLab', x: 6, y: 6 });
    expect(researchCost(s, 0, 'logistics')).toBe(Math.ceil(110 * (1 - RESOURCE.polarDiscount * RESOURCE.polarMax) * (1 - UNIQUE.testLabDiscount) - 1e-9));
  });

  it('Zyrr, wreck smelter: on a wreck or a salvaged crash site, consumes it, no xeno ground needed, +3 stars', () => {
    const { s, c, b } = setup('zyrr');
    expect(b).toBe('wreckSmelter');
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    tile(s, 5, 4).remains = { kind: 'wreck', unit: 'tank', faction: -1, round: 0 };
    expect(tile(s, 5, 4).xeno).toBeFalsy();
    const inc0 = cityInc(s, c.id);
    const p0 = totalPop(s, c.id);
    ok(s, { type: 'build', building: b, x: 5, y: 4 });
    expect(tile(s, 5, 4).remains).toBeNull();
    expect(totalPop(s, c.id) - p0).toBe(BUILDINGS.wreckSmelter.pop);
    expect(cityInc(s, c.id) - inc0).toBe(BUILDINGS.wreckSmelter.stars);
    // Skelette sind kein Wrack / skeletons are no wreck
    tile(s, 3, 4).remains = { kind: 'skeleton', unit: 'infantry', faction: 1, round: 1 };
    expect(buildCheck(s, 0, b, 3, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    // Absturzstelle erst nach der Bergung / crash site only once salvaged
    setTerrain(s, 4, 5, 'plain', { feature: 'crashSite' });
    expect(buildCheck(s, 0, b, 4, 5)).toMatchObject({ ok: false, error: 'invalidTile' });
    tile(s, 4, 5).looted = true;
    ok(s, { type: 'build', building: b, x: 4, y: 5 });
    expect(tile(s, 4, 5).feature).toBeNull();
    // andere Zyrr-Gebaeude brauchen weiter Xeno-Boden / other Zyrr buildings still need xeno ground
    expect(buildCheck(s, 0, 'xenoHive', 3, 3)).toMatchObject({ ok: false, error: 'invalidTile' });
  });

  it('Vesper, pilgrimage site: desert, steppe or next to a volcano, no stars, recruits next to it start as veterans', () => {
    const { s, c, b } = setup('vesper');
    expect(b).toBe('pilgrimSite');
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    tile(s, 6, 3).volcano = true;
    tile(s, 6, 3).terrain = 'mountain';
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: true });
    tile(s, 3, 3).biome = 'steppe';
    expect(buildCheck(s, 0, b, 3, 3)).toMatchObject({ ok: true });
    ok(s, { type: 'build', building: b, x: 5, y: 4 });
    // Kult-Staedte bringen nichts ein, auch mit Staette nicht / cult cities bring nothing, not even with a site
    expect(BUILDINGS.pilgrimSite.stars).toBeUndefined();
    expect(cityInc(s, c.id)).toBe(0);
    expect(buildCheck(s, 0, b, 3, 3)).toMatchObject({ ok: false, error: 'onePerCity' });
    // Prediger auf (5,5): Rekrut auf einem Feld neben der Staette / preacher at (5,5): recruit on a tile next to the site
    const z = addUnit(s, 'zealot', 0, 5, 6);
    const spot = recruitSpot(s, z, 'zealot')!;
    expect(Math.max(Math.abs(spot.x - 5), Math.abs(spot.y - 4))).toBeLessThanOrEqual(1);
    const r = ok(s, { type: 'recruit', unit: z.id, unitType: 'zealot', x: spot.x, y: spot.y });
    const nu = unit(s, (r.events.find((e) => e.t === 'recruit') as { unit: number }).unit)!;
    expect(nu.veteran).toBe(true);
    expect(nu.maxHp).toBe(UNITS.zealot.hp + VETERAN.bonusHp);
    // fern der Staette kein Veteran / far from the site no veteran
    const z2 = addUnit(s, 'zealot', 0, 2, 2);
    const r2 = ok(s, { type: 'recruit', unit: z2.id, unitType: 'zealot', x: 1, y: 1 });
    expect(unit(s, (r2.events.find((e) => e.t === 'recruit') as { unit: number }).unit)!.veteran).toBe(false);
  });

  it('NEXUS, depot node: ore only, +1 compute without a power plant', () => {
    const { s, c, b } = setup('nexus');
    expect(b).toBe('depotNode');
    setTerrain(s, 5, 4, 'mountain', { resource: null });
    expect(buildCheck(s, 0, b, 5, 4)).toMatchObject({ ok: false, error: 'invalidTile' });
    setTerrain(s, 5, 4, 'mountain', { resource: 'ore' });
    expect(trainCheck(s, c, 'spider')).toBe('computeMissing');
    ok(s, { type: 'build', building: b, x: 5, y: 4 });
    expect(computeStats(s, 0)).toMatchObject({ depotNodes: 1, compute: BUILDINGS.depotNode.compute });
    expect(trainCheck(s, c, 'spider')).toBe('ok');
  });
});

describe('Ressourcengebaeude: erobert / resource buildings: captured', () => {
  /** Stadt 0 mit dem Gebaeude geht an Fraktion 1 / city 0 with the building goes to faction 1 */
  function capture(s: GameState, id: number) {
    const c = s.cities.find((o) => o.id === id)!;
    c.owner = 1; c.isHQ = false; c.hqOf = null;
  }

  it('captured buildings give nothing but the population gained on construction', () => {
    const cases: { f: FactionId; effect: (s: GameState) => number }[] = [
      { f: 'dravon', effect: (s) => income(s, 1) },
      { f: 'meridon', effect: (s) => income(s, 1) },
      { f: 'alvenia', effect: (s) => income(s, 1) },
      { f: 'zyrr', effect: (s) => income(s, 1) },
      { f: 'vesper', effect: (s) => income(s, 1) },
      { f: 'velkar', effect: (s) => researchCost(s, 1, 'logistics') },
      { f: 'nexus', effect: (s) => computeStats(s, 1).compute },
    ];
    for (const k of cases) {
      const { s, c, b } = setup(k.f);
      const [x, y] = [5, 4];
      const t = tile(s, x, y);
      const st = BUILDINGS[b];
      if (st.terrain[0] === 'shallow' || st.terrain[0] === 'mountain') t.terrain = st.terrain[0];
      if (st.resource) t.resource = st.resource;
      if (st.biomes) t.biome = st.biomes[0];
      if (st.wreck) t.remains = { kind: 'wreck', unit: 'tank', faction: -1, round: 0 };
      const p0 = totalPop(s, c.id);
      ok(s, { type: 'build', building: b, x, y });
      const gained = totalPop(s, c.id) - p0;
      expect(gained, b).toBe(st.pop);
      capture(s, c.id);
      // Wirkung beim neuen Besitzer wie ohne Gebaeude / effect for the new owner as without the building
      const withB = k.effect(s);
      const saved = t.building;
      t.building = null;
      const without = k.effect(s);
      t.building = saved;
      expect(withB, b).toBe(without);
      expect(buildingWorksFor(s, 1, b)).toBe(false);
      expect(countBuildings(s, 1, b)).toBe(0);
      // Bevoelkerung bleibt / population stays
      expect(totalPop(s, c.id)).toBe(p0 + gained);
    }
  });

  it('a captured pilgrimage site makes no veterans, a captured tractor station gives no adjacency population', () => {
    // Pilgerstaette der Vesper in Korvat-Hand / Vesper pilgrimage site in Korvat hands
    const { s, c } = setup('vesper', 'korvat');
    tile(s, 5, 4).biome = 'desert';
    ok(s, { type: 'build', building: 'pilgrimSite', x: 5, y: 4 });
    capture(s, c.id);
    expect(buildingWorksFor(s, 1, 'pilgrimSite')).toBe(false);
    // Traktorstation der Korvat in Dravon-Hand: neuer Agrarbetrieb daneben gibt nur seine eigene Bevoelkerung
    // Korvat tractor station in Dravon hands: a new farm next to it gives only its own population
    const k = setup('korvat', 'dravon');
    setTerrain(k.s, 5, 4, 'plain', { resource: 'farmland' });
    ok(k.s, { type: 'build', building: 'tractorStation', x: 5, y: 4 });
    capture(k.s, k.c.id);
    k.s.current = 1;
    k.s.factions[1].techs.push('agritech');
    k.s.factions[1].stars = 100;
    setTerrain(k.s, 6, 4, 'plain', { resource: 'farmland' });
    const p0 = totalPop(k.s, k.c.id);
    ok(k.s, { type: 'build', building: 'farm', x: 6, y: 4 });
    expect(totalPop(k.s, k.c.id) - p0).toBe(BUILDINGS.farm.pop);
    // und die Dravon koennen sie nicht ausbauen / and the Dravon cannot upgrade it
    fails(k.s, { type: 'build', building: 'tractorStation', x: 6, y: 4 }, 'wrongFaction');
  });
});

/** Kurze Typpruefung / short type check */
export const _ids: BuildingId[] = RESOURCE_BUILDINGS;
