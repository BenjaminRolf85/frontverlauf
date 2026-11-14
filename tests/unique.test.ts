/**
 * Einzigartige Einheiten, einzigartige Gebaeude und zweite Fraktionsmerkmale.
 * Unique units, unique buildings and second faction traits.
 */
import { describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import {
  barrierCheck, buildCheck, combatPreview, effectiveAttack, effectiveMove, healAmount, income, outpostCheck, reachable, researchCost,
  rosterUnits, techUnlocks, trainCheck, upgradeCheck, visionRadius,
} from '../src/core';
import {
  BARRIER, BUILDINGS, ECON, FACTION_IDS, FACTIONS, LAND_UNITS, PERKS2, UNIQUE, UNIQUE_BUILDINGS, UNIQUE_UNITS, UNITS,
  type FactionId, type UnitTypeId,
} from '../src/data/balance';
import { createGame, defaultConfig } from '../src/core';
import { playAiTurn } from '../src/ai/ai';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile, unit, untilTurnOf } from './helpers';

const CLASSIC: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'];

/** Zwei Fraktionen mit Hauptquartier, alles aufgedeckt / two factions with HQ, everything revealed */
function duel(a: FactionId, b: FactionId = a === 'dravon' ? 'korvat' : 'dravon', stars = 200) {
  const s = blankGame({ factions: [a, b], stars });
  revealAll(s, 0); revealAll(s, 1);
  const hq = addCity(s, 2, 2, 0, { hq: true, level: 3 });
  addCity(s, 9, 9, 1, { hq: true });
  return { s, hq };
}

describe('Einzigartige Einheiten / unique units', () => {
  it('each classic faction has exactly one unique unit and one unique building', () => {
    for (const f of CLASSIC) {
      const u = UNIQUE.units[f]!;
      expect(UNITS[u].faction).toBe(f);
      expect(UNIQUE_UNITS).toContain(u);
      expect(UNIQUE_BUILDINGS).toContain(UNIQUE.buildings[f]!);
    }
    expect(UNIQUE_UNITS).toHaveLength(5);
    expect(UNIQUE_BUILDINGS).toHaveLength(5);
  });

  for (const f of CLASSIC) {
    const type = UNIQUE.units[f]!;
    if (UNITS[type].ship) continue;
    it(`${type} can only be trained by ${f} and needs ${UNITS[type].tech}`, () => {
      const { s, hq } = duel(f);
      s.factions[0].techs = s.factions[0].techs.filter((t) => t !== UNITS[type].tech);
      expect(trainCheck(s, hq, type)).toBe('techMissing');
      s.factions[0].techs.push(UNITS[type].tech!);
      expect(trainCheck(s, hq, type)).toBe('ok');
      expect(rosterUnits(s, 0)).toContain(type);
      expect(techUnlocks(UNITS[type].tech!, f).units).toContain(type);
      const r = ok(s, { type: 'train', city: hq.id, unitType: type });
      expect(r.events[0]).toMatchObject({ t: 'train' });
      expect(s.factions[0].stars).toBe(200 - UNITS[type].cost!);
      // alle anderen Fraktionen nicht, auch nicht mit der Technik / no other faction, not even with the tech
      for (const g of FACTION_IDS) {
        if (g === f) continue;
        const o = duel(g, f === 'korvat' ? 'dravon' : 'korvat');
        o.s.factions[0].techs.push(UNITS[type].tech!);
        expect(trainCheck(o.s, o.hq, type), `${g} ${type}`).toBe('invalid');
        expect(rosterUnits(o.s, 0)).not.toContain(type);
        expect(techUnlocks(UNITS[type].tech!, g).units).not.toContain(type);
        fails(o.s, { type: 'train', city: o.hq.id, unitType: type }, 'invalid');
      }
    });
  }

  it('the base tech tree without faction shows no unique units or buildings', () => {
    expect(techUnlocks('livestock')).toEqual({ units: [], buildings: ['ranch'] });
    expect(techUnlocks('mining')).toEqual({ units: [], buildings: ['mine'] });
    expect(techUnlocks('coastalEconomy').units).toEqual(['landingBoat']);
    expect(techUnlocks('coastalEconomy', 'nexus').units).not.toContain('privateer');
    expect(techUnlocks('coastalEconomy', 'meridon').units).toContain('privateer');
    expect(techUnlocks('livestock', 'korvat').buildings).toEqual(['ranch', 'kolkhoz']);
    expect(LAND_UNITS.some((u) => UNIQUE_UNITS.includes(u as never))).toBe(false);
  });

  it('privateer: only Meridon can upgrade a ship to it, it is never trained', () => {
    for (const f of FACTION_IDS) {
      const s = blankGame({ factions: [f, f === 'korvat' ? 'dravon' : 'korvat'], stars: 100 });
      addCity(s, 2, 2, 0, { hq: true });
      setTerrain(s, 3, 3, 'shallow');
      s.factions[0].techs.push('coastalEconomy');
      const boat = addUnit(s, 'landingBoat', 0, 3, 3);
      expect(upgradeCheck(s, boat, 'privateer'), f).toBe(f === 'meridon' ? 'ok' : 'invalid');
    }
    const { s, hq } = duel('meridon');
    expect(trainCheck(s, hq, 'privateer')).toBe('invalid');
  });

  it('privateer: prize money of 10 stars per destroyed unit', () => {
    const { s } = duel('meridon', 'dravon', 0);
    setTerrain(s, 5, 5, 'shallow');
    const p = addUnit(s, 'privateer', 0, 5, 5, { carried: 'mg' });
    addUnit(s, 'infantry', 1, 6, 5, { hp: 1 });
    ok(s, { type: 'attack', unit: p.id, target: s.units[1].id });
    expect(s.factions[0].stars).toBe(UNIQUE.plunderStars);
    expect(unit(s, p.id)!.kills).toBe(1);
  });

  it('stormbreakers (shock): the target never strikes back', () => {
    const { s } = duel('dravon');
    const a = addUnit(s, 'stormbreaker', 0, 5, 5);
    const d = addUnit(s, 'mg', 1, 6, 5);
    const pre = combatPreview(s, a, d);
    expect(pre.kills).toBe(false);
    expect(pre.retaliates).toBe(false);
    expect(pre.toAttacker).toBe(0);
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect(unit(s, a.id)!.hp).toBe(UNITS.stormbreaker.hp);
    expect(unit(s, d.id)!.hp).toBe(15 - pre.toDefender);
    // als Verteidiger schlaegt der Sturmbrecher normal zurueck / as a defender it strikes back normally
    const back = combatPreview(s, unit(s, d.id)!, unit(s, a.id)!);
    expect(back.retaliates).toBe(true);
  });

  it('peacekeepers (mend): heal 2 HP at the start of their own turn, never above max', () => {
    const { s } = duel('alvenia');
    const pk = addUnit(s, 'peacekeeper', 0, 5, 5, { hp: 10 });
    const full = addUnit(s, 'peacekeeper', 0, 6, 6);
    untilTurnOf(s, 0);
    expect(unit(s, pk.id)!.hp).toBe(10 + UNIQUE.mendHp);
    expect(unit(s, full.id)!.hp).toBe(UNITS.peacekeeper.hp);
    unit(s, pk.id)!.hp = 14;
    untilTurnOf(s, 0);
    expect(unit(s, pk.id)!.hp).toBe(15);
  });

  it('steppe riders move 2 tiles on open ground and are foot troops', () => {
    const { s } = duel('korvat');
    const r = addUnit(s, 'steppeRider', 0, 5, 5);
    expect(reachable(s, r).some((p) => p.x === 7 && p.y === 5)).toBe(true);
    expect(UNITS.steppeRider.cost!).toBeLessThan(UNITS.jeep.cost!);
  });

  it('prototype walker: splash damage hits the neighbours of the target', () => {
    const { s } = duel('velkar');
    const w = addUnit(s, 'protoWalker', 0, 4, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    const n = addUnit(s, 'infantry', 1, 7, 5);
    const r = ok(s, { type: 'attack', unit: w.id, target: d.id });
    const ev = r.events.find((e) => e.t === 'attack') as { splash: { unit: number; dmg: number }[] };
    expect(ev.splash.map((x) => x.unit)).toContain(n.id);
    expect(unit(s, n.id)!.hp).toBeLessThan(10);
  });
});

describe('Einzigartige Gebaeude / unique buildings', () => {
  it('only their faction can build them', () => {
    for (const f of CLASSIC) {
      const b = UNIQUE.buildings[f]!;
      const { s } = duel(f);
      const tech = BUILDINGS[b].tech;
      if (tech && !s.factions[0].techs.includes(tech)) s.factions[0].techs.push(tech);
      expect(buildCheck(s, 0, b, 3, 2).ok, `${f} ${b}`).toBe(true);
      for (const g of FACTION_IDS) {
        if (g === f) continue;
        const o = duel(g, g === 'korvat' ? 'dravon' : 'korvat');
        if (tech) o.s.factions[0].techs.push(tech);
        expect(buildCheck(o.s, 0, b, 3, 2)).toMatchObject({ ok: false });
      }
    }
  });

  it('kolkhoz: +1 population for its city every 5 rounds', () => {
    const { s, hq } = duel('korvat');
    ok(s, { type: 'build', building: 'kolkhoz', x: 3, y: 2 });
    expect(hq.pop).toBe(BUILDINGS.kolkhoz.pop);
    fails(s, { type: 'build', building: 'kolkhoz', x: 1, y: 2 }, 'onePerCity');
    const pops: number[] = [];
    for (let i = 0; i < 10; i++) { untilTurnOf(s, 0); pops.push(s.cities[0].pop + s.cities[0].level * 100); }
    // Runden 3..12: Wachstum in Runde 5 und 10 / rounds 3..12: growth in rounds 5 and 10
    const grew = pops.map((p, i) => (i === 0 ? p - (BUILDINGS.kolkhoz.pop + 300) : p - pops[i - 1]));
    expect(grew.filter((g) => g !== 0)).toHaveLength(2);
  });

  it('mercenary barracks: units trained in that city start as veterans', () => {
    const { s, hq } = duel('dravon');
    const other = addCity(s, 6, 2, 0, { level: 2 });
    ok(s, { type: 'build', building: 'mercenaryBarracks', x: 3, y: 2 });
    const r = ok(s, { type: 'train', city: hq.id, unitType: 'infantry' });
    const u = s.units.find((x) => x.homeCity === hq.id)!;
    expect(u.veteran).toBe(true);
    expect(u.maxHp).toBe(15);
    expect(r.events.some((e) => e.t === 'veteran')).toBe(true);
    ok(s, { type: 'train', city: other.id, unitType: 'infantry' });
    expect(s.units.find((x) => x.homeCity === other.id)!.veteran).toBe(false);
  });

  it('embassy palace: +4 stars per round per peace treaty, one per faction', () => {
    const s = blankGame({ factions: ['alvenia', 'dravon', 'korvat'], stars: 200 });
    addCity(s, 2, 2, 0, { hq: true, level: 3 });
    addCity(s, 6, 2, 0, { level: 2 });
    addCity(s, 9, 9, 1, { hq: true });
    addCity(s, 9, 1, 2, { hq: true });
    s.factions[0].techs.push('intelligence');
    const base = income(s, 0);
    ok(s, { type: 'build', building: 'embassyPalace', x: 3, y: 2 });
    expect(income(s, 0)).toBe(base);
    fails(s, { type: 'build', building: 'embassyPalace', x: 6, y: 3 }, 'alreadyBuilt');
    for (const g of [1, 2]) { s.factions[0].relations[g] = 'peace'; s.factions[g].relations[0] = 'peace'; }
    expect(income(s, 0)).toBe(base + 2 * UNIQUE.palacePerPeace);
    s.factions[0].relations[2] = 'breaking';
    expect(income(s, 0)).toBe(base + UNIQUE.palacePerPeace);
  });

  it('trading post: +3 stars per round per connected harbour city', () => {
    const { s, hq } = duel('meridon');
    const port = addCity(s, 6, 2, 0, { level: 1 });
    setTerrain(s, 1, 1, 'shallow', { building: 'navalBase' });
    setTerrain(s, 7, 1, 'shallow', { building: 'navalBase' });
    const base = income(s, 0);
    ok(s, { type: 'build', building: 'tradingPost', x: 3, y: 2 });
    // nur das HQ zaehlt, die zweite Stadt ist nicht verbunden / only the HQ counts, the second city is not connected
    expect(income(s, 0)).toBe(base + UNIQUE.tradingPostPerHarbour);
    port.connected = true;
    expect(income(s, 0)).toBe(base + 2 * UNIQUE.tradingPostPerHarbour);
    expect(hq.isHQ).toBe(true);
  });

  it('test lab: research 5 % cheaper per lab, at most 3 labs', () => {
    const { s } = duel('velkar', 'dravon', 500);
    s.factions[0].techs.push('highAltitude');
    const cities = [s.cities[0], addCity(s, 6, 2, 0), addCity(s, 2, 6, 0), addCity(s, 6, 6, 0)];
    const before = researchCost(s, 0, 'fieldResearch');
    ok(s, { type: 'build', building: 'testLab', x: 3, y: 2 });
    const one = researchCost(s, 0, 'fieldResearch');
    expect(one).toBeLessThan(before);
    ok(s, { type: 'build', building: 'testLab', x: 7, y: 2 });
    ok(s, { type: 'build', building: 'testLab', x: 3, y: 6 });
    const three = researchCost(s, 0, 'fieldResearch');
    ok(s, { type: 'build', building: 'testLab', x: 7, y: 6 });
    expect(researchCost(s, 0, 'fieldResearch')).toBe(three);
    expect(three).toBeLessThan(one);
    expect(cities).toHaveLength(4);
  });
});

describe('Zweite Fraktionsmerkmale / second faction traits', () => {
  it('every faction has a distinct second trait with DE and EN texts', () => {
    const seen = new Set<string>();
    for (const f of FACTION_IDS) {
      seen.add(FACTIONS[f].perk2);
      for (const d of [de, en] as { factions: Record<string, { perk2?: string; perk2Desc?: string }>; units: Record<string, string>; buildings: Record<string, string> }[]) {
        expect(d.factions[f].perk2, f).toBeTruthy();
        expect(d.factions[f].perk2Desc, f).toBeTruthy();
      }
    }
    expect(seen.size).toBe(FACTION_IDS.length);
    for (const d of [de, en] as { units: Record<string, string>; buildings: Record<string, string>; buildingDesc: Record<string, string> }[]) {
      for (const u of UNIQUE_UNITS) expect(d.units[u], u).toBeTruthy();
      for (const b of UNIQUE_BUILDINGS) { expect(d.buildings[b], b).toBeTruthy(); expect(d.buildingDesc[b], b).toBeTruthy(); }
    }
  });

  it('Korvat (earthworks): outposts cost 15 instead of 25', () => {
    const { s } = duel('korvat');
    s.factions[0].techs.push('fortification');
    s.factions[0].stars = PERKS2.earthworksOutpostCost;
    const u = addUnit(s, 'infantry', 0, 5, 5);
    expect(outpostCheck(s, u)).toBe('ok');
    ok(s, { type: 'outpost', unit: u.id });
    expect(s.factions[0].stars).toBe(0);
    const o = duel('dravon');
    o.s.factions[0].techs.push('fortification');
    o.s.factions[0].stars = PERKS2.earthworksOutpostCost;
    expect(outpostCheck(o.s, addUnit(o.s, 'infantry', 0, 5, 5))).toBe('notEnoughStars');
    expect(ECON.outpostCost).toBe(25);
  });

  it('Dravon (battle-hardened): veterans attack with +0.5', () => {
    const { s } = duel('dravon');
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'mg', 1, 6, 5);
    const plain = combatPreview(s, a, d).toDefender;
    a.veteran = true;
    expect(effectiveAttack(s, a)).toBe(UNITS.infantry.attack + PERKS2.battleHardenedAttack);
    expect(combatPreview(s, a, d).toDefender).toBeGreaterThan(plain);
    const k = duel('korvat');
    const b = addUnit(k.s, 'infantry', 0, 5, 5);
    b.veteran = true;
    expect(effectiveAttack(k.s, b)).toBe(UNITS.infantry.attack);
  });

  it('Alvenia (field hospitals): +1 healing', () => {
    const { s } = duel('alvenia');
    const u = addUnit(s, 'infantry', 0, 5, 5, { hp: 3 });
    const o = duel('dravon');
    const v = addUnit(o.s, 'infantry', 0, 5, 5, { hp: 3 });
    expect(healAmount(s, u)).toBe(healAmount(o.s, v) + PERKS2.fieldHospitalsHeal);
  });

  it('Meridon (harbour pilots): landing boats move 1 tile further', () => {
    const { s } = duel('meridon');
    const o = duel('dravon');
    for (const g of [s, o.s]) for (let x = 0; x < g.size; x++) setTerrain(g, x, 7, 'shallow');
    const m = addUnit(s, 'landingBoat', 0, 3, 7);
    const d = addUnit(o.s, 'landingBoat', 0, 3, 7);
    expect(effectiveMove(s, m)).toBe(effectiveMove(o.s, d) + PERKS2.harbourPilotsMove);
    expect(effectiveMove(s, addUnit(s, 'destroyer', 0, 6, 7))).toBe(UNITS.destroyer.move);
  });

  it('Velkar (engineer corps): tank barriers cost 5 instead of 10', () => {
    const { s } = duel('velkar');
    s.factions[0].techs.push('fortification');
    s.factions[0].stars = PERKS2.engineerCorpsBarrierCost;
    const p = addUnit(s, 'pioneer', 0, 5, 5);
    expect(barrierCheck(s, p, 6, 5)).toBe('ok');
    ok(s, { type: 'barrier', unit: p.id, x: 6, y: 5 });
    expect(s.factions[0].stars).toBe(0);
    expect(BARRIER.cost).toBe(10);
  });

  it('Zyrr (forest brood): +1 healing in forests only', () => {
    const { s } = duel('zyrr');
    setTerrain(s, 5, 5, 'forest');
    // Ausserirdische heilen nur auf Xeno-Boden / aliens heal only on xeno ground
    s.tiles[5 * s.size + 5].xeno = true; s.tiles[6 * s.size + 6].xeno = true;
    const inForest = addUnit(s, 'grey', 0, 5, 5, { hp: 3 });
    const inPlain = addUnit(s, 'grey', 0, 6, 6, { hp: 3 });
    expect(healAmount(s, inForest)).toBe(healAmount(s, inPlain) + PERKS2.forestSpawnHeal);
  });

  it('Vesper (martyrdom): +3 stars for every own unit that falls in battle', () => {
    const { s } = duel('dravon', 'vesper', 0);
    const a = addUnit(s, 'mg', 0, 5, 5);
    const z = addUnit(s, 'zealot', 1, 6, 5, { hp: 1 });
    ok(s, { type: 'attack', unit: a.id, target: z.id });
    expect(unit(s, z.id)).toBeUndefined();
    expect(s.factions[1].stars).toBe(PERKS2.martyrdomStars);
    expect(s.factions[0].stars).toBe(0);
  });

  it('NEXUS (sensor net): all units see 1 tile further', () => {
    const { s } = duel('nexus');
    const o = duel('dravon');
    const a = addUnit(s, 'android', 0, 5, 5);
    const i = addUnit(o.s, 'infantry', 0, 5, 5);
    expect(visionRadius(s, a)).toBe(visionRadius(o.s, i) + PERKS2.sensorNetVision);
    endTurn(s);
    expect(tile(s, 5, 5).terrain).toBe('plain');
  });
});

describe('KI / AI', () => {
  it('trains unique units and builds unique buildings', () => {
    const ids: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon'];
    // zwei Partien, weil das Trefferglueck den Verlauf einer einzelnen Partie stark veraendert
    // two games, because hit luck changes the course of a single game a lot
    const types = new Set<string>();
    const built = new Set<string | null>();
    for (const seed of [7, 8]) {
      const s = createGame(defaultConfig({ seed, size: 14, mode: 'points', mapType: 'continent', factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' })) }));
      for (let i = 0; i < 4 * 20 && !s.over; i++) playAiTurn(s);
      for (const u of s.units) types.add(u.type);
      for (const r of s.history?.fallen ?? []) types.add(r.type);
      for (const t of s.tiles) built.add(t.building);
    }
    const units = UNIQUE_UNITS.filter((u) => types.has(u));
    const buildings = UNIQUE_BUILDINGS.filter((b) => built.has(b));
    expect(units.length).toBeGreaterThanOrEqual(2);
    expect(buildings.length).toBeGreaterThanOrEqual(2);
  }, 120_000);
});

/** Kurze Typpruefung der Einheiten-Liste / short type check of the unit list */
export const _units: UnitTypeId[] = UNIQUE_UNITS;
