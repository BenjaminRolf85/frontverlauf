/**
 * Regressionstests fuer die Fehler und Luecken aus dem Regel-Audit.
 * Regression tests for the bugs and exploits found in the rules audit.
 */
import { describe, expect, it } from 'vitest';
import {
  cityTiles, combatPreview, counterFactor, createGame, defaultConfig, defenseBonus, dist, erupts, hitOdds, income,
  outpostCheck, rangedCover, repairCheck, researchCost, unitClass, unitUpkeep, upkeep, victoryStatus, weatherFor,
  type GameEvent, type GameState,
} from '../src/core';
import { BARRIER, COUNTER, JUNGLE, REMAINS, UNITS, WEATHER, type FactionId } from '../src/data/balance';
import { migrateState } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile, unit, untilTurnOf } from './helpers';

function game(factions: FactionId[] = ['korvat', 'dravon'], o: { hitChance?: boolean; stars?: number } = {}) {
  const s = blankGame({ factions, hitChance: o.hitChance ?? false, stars: o.stars ?? 0 });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

/** Kopie mit anderem Zufallszustand / copy with a different rng state */
const withRng = (base: GameState, seed: number): GameState => { const s = JSON.parse(JSON.stringify(base)) as GameState; s.rng = seed; return s; };
const attackEvent = (evs: GameEvent[]) => evs.find((e) => e.t === 'attack') as Extract<GameEvent, { t: 'attack' }>;

describe('1. Geordneter Rueckzug gibt keine Extrabewegung / orderly retreat grants no extra movement', () => {
  it('a unit that already attacked cannot retreat', () => {
    const s = game();
    const j = addUnit(s, 'jeep', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    ok(s, { type: 'attack', unit: j.id, target: d.id });
    // Jeep darf nach dem Angriff noch fahren (Ausweichen), aber nicht zuruecksetzen / the jeep may still drive (escape), but not retreat
    fails(s, { type: 'retreat', unit: j.id, target: d.id }, 'unitExhausted');
  });

  it('move, attack and then retreat is impossible: the attack ends the action', () => {
    const s = game();
    const a = addUnit(s, 'infantry', 0, 4, 5);
    const d = addUnit(s, 'mg', 1, 6, 5);
    ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 5 } });
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    fails(s, { type: 'retreat', unit: a.id, target: d.id }, 'unitExhausted');
  });

  it('a retreat after a move is one action: the step is allowed, then the unit is exhausted', () => {
    const s = game();
    const a = addUnit(s, 'infantry', 0, 4, 4);
    const d = addUnit(s, 'infantry', 1, 6, 4);
    ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 4 } });
    ok(s, { type: 'retreat', unit: a.id, target: d.id });
    const u = unit(s, a.id)!;
    expect(dist(u, d)).toBe(2);
    expect(u.moved && u.attacked && u.exhausted).toBe(true);
    fails(s, { type: 'move', unit: a.id, to: { x: u.x - 1, y: u.y } });
    fails(s, { type: 'attack', unit: a.id, target: d.id });
  });

  it('a unit whose move was ended by a mine cannot step out with a retreat', () => {
    const s = game();
    tile(s, 5, 5).mine = { owner: 1 };
    const a = addUnit(s, 'infantry', 0, 4, 5);
    const d = addUnit(s, 'mg', 1, 6, 5);
    ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 5 } });
    expect(unit(s, a.id)!.moveDone).toBe(true);
    fails(s, { type: 'retreat', unit: a.id, target: d.id }, 'unitExhausted');
  });
});

describe('2. Nur echter Schaden unterbricht Wunder / only real damage interrupts wonders', () => {
  function portalGame() {
    const s = blankGame({ factions: ['dravon', 'zyrr'], hitChance: true });
    addCity(s, 0, 0, 0, { hq: true }); addCity(s, 8, 8, 1, { hq: true, radius: 2 });
    const p = addUnit(s, 'portal', 1, 7, 7); p.wonder = { stage: 0, progress: 5 };
    revealAll(s, 0);
    return { s, p };
  }

  it('a miss keeps the phase progress, a hit resets it', () => {
    const { s: base, p } = portalGame();
    const inf = addUnit(base, 'infantry', 0, 6, 6);
    const seen = new Set<string>();
    for (let seed = 1; seed < 500 && seen.size < 2; seed++) {
      const s = withRng(base, seed);
      const r = ok(s, { type: 'attack', unit: inf.id, target: p.id });
      const ev = attackEvent(r.events);
      const interrupted = r.events.some((e) => e.t === 'wonder' && e.what === 'interrupted');
      if (ev.dmg === 0) { expect(unit(s, p.id)!.wonder!.progress).toBe(5); expect(interrupted).toBe(false); seen.add('miss'); }
      else { expect(unit(s, p.id)!.wonder!.progress).toBe(0); expect(interrupted).toBe(true); seen.add('hit'); }
    }
    expect(seen.size).toBe(2);
  });

  it('splash damage of 0 (missed shot) does not interrupt a neighbouring wonder', () => {
    const { s: base, p } = portalGame();
    setTerrain(base, 4, 7, 'shallow');
    const bs = addUnit(base, 'battleship', 0, 4, 7, { carried: 'infantry' });
    const g = addUnit(base, 'grey', 1, 6, 7);
    expect(dist(g, p)).toBe(1);
    let checkedMiss = false;
    for (let seed = 1; seed < 500 && !checkedMiss; seed++) {
      const s = withRng(base, seed);
      const r = ok(s, { type: 'attack', unit: bs.id, target: g.id });
      const ev = attackEvent(r.events);
      const sp = ev.splash?.find((x) => x.unit === p.id);
      if (sp && sp.dmg === 0) { expect(unit(s, p.id)!.wonder!.progress).toBe(5); checkedMiss = true; }
    }
    expect(checkedMiss).toBe(true);
  });

  it('a volcano eruption that damages a wonder interrupts it', () => {
    const s = blankGame({ factions: ['zyrr', 'korvat'] });
    addCity(s, 7, 5, 0, { hq: true }); addCity(s, 1, 9, 1, { hq: true });
    setTerrain(s, 5, 5, 'mountain', { volcano: true });
    const p = addUnit(s, 'portal', 0, 6, 5); p.wonder = { stage: 0, progress: 0 };
    let r = s.round + 1;
    while (!erupts(5, 5, r)) r++;
    while (s.round < r - 1 || s.current !== 0) untilTurnOf(s, 0);
    p.wonder.progress = 3;
    const hp = p.hp;
    untilTurnOf(s, 0);
    expect(s.round).toBe(r);
    expect(unit(s, p.id)!.hp).toBeLessThan(hp);
    // zurueckgesetzt, dann eine Runde Fortschritt zu Zugbeginn / reset, then one round of progress at turn start
    expect(unit(s, p.id)!.wonder).toEqual({ stage: 0, progress: 1 });
    expect(s.log.some((e) => e.t === 'wonder' && e.what === 'interrupted' && e.unit === p.id)).toBe(true);
  });
});

describe('3. Ausscheiden meldet entfernte Einheiten / elimination reports removed units', () => {
  it('emits killed for every removed unit and destroyed for the wonder', () => {
    const s = blankGame({ factions: ['korvat', 'velkar'] });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 8, 8, 1, { hq: true, radius: 2 });
    const w = addUnit(s, 'fusionPlant', 1, 6, 6); w.wonder = { stage: 0, progress: 10 };
    for (const [x, y] of [[7, 6], [6, 7], [7, 7]]) tile(s, x, y).wonderOf = w.id;
    const v = addUnit(s, 'infantry', 1, 4, 8);
    const inf = addUnit(s, 'infantry', 0, 8, 8);
    const r = ok(s, { type: 'capture', unit: inf.id });
    expect(r.events.some((e) => e.t === 'eliminated')).toBe(true);
    for (const id of [w.id, v.id]) expect(r.events.some((e) => e.t === 'killed' && e.unit === id), `killed ${id}`).toBe(true);
    expect(r.events.some((e) => e.t === 'wonder' && e.what === 'destroyed' && e.unit === w.id)).toBe(true);
    expect(tile(s, 7, 7).wonderOf).toBeNull();
  });
});

describe('4. Erobern eines Aussenpostens nimmt kein Kerngebiet / capturing an outpost takes no core territory', () => {
  it('tiles within the city radius stay city territory after the outpost is captured', () => {
    const s = blankGame({ stars: 200, size: 14 });
    const c = addCity(s, 4, 4, 0, { hq: true });
    addCity(s, 12, 12, 1, { hq: true });
    s.factions[0].techs.push('supply', 'fortification');
    const i = addUnit(s, 'infantry', 0, 6, 4);
    ok(s, { type: 'outpost', unit: i.id });
    s.pendingRewards.push({ cityId: c.id, level: 4 });
    ok(s, { type: 'reward', city: c.id, choice: 'a' });
    expect(c.radius).toBe(2);
    s.units = s.units.filter((u) => u.id !== i.id);
    s.current = 1;
    const e = addUnit(s, 'infantry', 1, 6, 4);
    ok(s, { type: 'capture', unit: e.id });
    const lost: string[] = [];
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) if (tile(s, x, y).territory !== c.id) lost.push(`${x},${y}`);
    expect(lost).toEqual([]);
    // Felder ausserhalb des Radius werden frei / tiles outside the radius are released
    expect(tile(s, 7, 4).territory).toBeNull();
    expect(cityTiles(s, c).length).toBe(25);
  });
});

describe('5. Kein Aussenposten im Feindgebiet / no outpost in enemy territory', () => {
  it('fails with enemyTerritory on a tile owned by another faction', () => {
    const s = game(['korvat', 'dravon'], { stars: 100 });
    s.factions[0].techs.push('fortification');
    const i = addUnit(s, 'infantry', 0, 8, 8, { hp: 5 });
    expect(outpostCheck(s, i)).toBe('enemyTerritory');
    fails(s, { type: 'outpost', unit: i.id }, 'enemyTerritory');
    // neutrales Gelaende bleibt erlaubt / neutral ground stays allowed
    const n = addUnit(s, 'infantry', 0, 5, 5);
    ok(s, { type: 'outpost', unit: n.id });
  });
});

describe('6. Unbezahlter Sold / unpaid upkeep', () => {
  it('disbands the newest paid units until the rest is affordable, never wonders', () => {
    const s = blankGame({ factions: ['velkar', 'dravon'] });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    for (let i = 0; i < 4; i++) addUnit(s, 'infantry', 0, 3 + i, 3);
    const w = addUnit(s, 'fusionPlant', 0, 3, 6); w.wonder = { stage: 0, progress: 0 };
    const tank = addUnit(s, 'tank', 0, 3, 4);
    const mg = addUnit(s, 'mg', 0, 4, 4);
    const inf = addUnit(s, 'infantry', 0, 5, 4);
    expect(upkeep(s, 0)).toBe(12 + unitUpkeep(mg) + unitUpkeep(inf));
    // genug fuer den Panzer, nicht mehr / enough for the tank, no more
    s.factions[0].stars = 12 + 1 - income(s, 0);
    expect(s.factions[0].stars).toBeGreaterThanOrEqual(0);
    endTurn(s); untilTurnOf(s, 0);
    expect(unit(s, inf.id)).toBeUndefined();
    expect(unit(s, mg.id)).toBeUndefined();
    expect(unit(s, tank.id)).toBeDefined();
    expect(unit(s, w.id)).toBeDefined();
    expect(s.factions[0].stars).toBe(1);
    const deserted = s.log.filter((e) => e.t === 'deserted');
    expect(deserted.map((e) => (e as { unit: number }).unit)).toEqual([inf.id, mg.id]);
  });

  it('keeps everything when the upkeep can be paid', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 100 });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    for (let i = 0; i < 6; i++) addUnit(s, 'mg', 0, 3 + i, 3);
    const n = s.units.length;
    endTurn(s); untilTurnOf(s, 0);
    expect(s.units.length).toBe(n);
    expect(s.log.some((e) => e.t === 'deserted')).toBe(false);
  });
});

describe('7. Schiffe senken den Sold nicht / ships do not lower upkeep', () => {
  it('a ship costs at least the upkeep of its carried unit', () => {
    const s = blankGame();
    const de = addUnit(s, 'destroyer', 0, 9, 1, { carried: 'tank' });
    const lb = addUnit(s, 'landingBoat', 0, 9, 0, { carried: 'tank' });
    const di = addUnit(s, 'destroyer', 0, 8, 1, { carried: 'infantry' });
    expect(unitUpkeep(de)).toBe(12);
    expect(unitUpkeep(lb)).toBe(12);
    expect(unitUpkeep(di)).toBe(Math.ceil(UNITS.destroyer.cost! * 0.3));
  });
});

describe('8. Wunder-Bauwerke / wonder structures', () => {
  it('cannot be healed, medic-healed or repaired', () => {
    const s = game(['velkar', 'nexus']);
    const w = addUnit(s, 'fusionPlant', 0, 4, 4, { hp: 20 }); w.wonder = { stage: 0, progress: 0 };
    fails(s, { type: 'heal', unit: w.id }, 'invalid');
    const m = addUnit(s, 'medic', 0, 3, 4);
    ok(s, { type: 'medicHeal', unit: m.id });
    expect(unit(s, w.id)!.hp).toBe(20);
    const h = addUnit(s, 'hackRelay', 1, 6, 6, { hp: 10 }); h.wonder = { stage: 0, progress: 0 };
    tile(s, 6, 7).remains = { kind: 'wreck', unit: 'tank', faction: 0, round: 1 };
    expect(repairCheck(s, h)).toBe('cannotRepair');
  });

  it('have their own combat class: hit like vehicles by counters, no foot cover', () => {
    for (const k of ['portal', 'hackRelay', 'fusionPlant', 'waal'] as const) expect(unitClass(k)).toBe('structure');
    expect(unitClass('coreDrill')).toBe('vehicle');
    expect(counterFactor('antiTank', 'portal')).toBe(UNITS.antiTank.bonusVs!.vehicle);
    expect(counterFactor('antiTank', 'waal')).toBe(UNITS.antiTank.bonusVs!.vehicle);
    const s = game(['zyrr', 'korvat']);
    setTerrain(s, 5, 5, 'forest', { biome: 'jungle' });
    const p = addUnit(s, 'portal', 0, 5, 5);
    const sn = addUnit(s, 'sniper', 1, 7, 5);
    expect(defenseBonus(s, p, sn)).toBe(1);
    expect(rangedCover(s, sn, p)).toBe(1);
  });

  it('wonder progress pauses while the anchor tile is not own territory', () => {
    const s = blankGame({ factions: ['zyrr', 'korvat'] });
    const c = addCity(s, 3, 3, 0, { hq: true, radius: 2 }); addCity(s, 9, 9, 1, { hq: true });
    addCity(s, 9, 1, 0);
    const p = addUnit(s, 'portal', 0, 2, 2); p.wonder = { stage: 0, progress: 2 };
    c.owner = 1;
    untilTurnOf(s, 0); untilTurnOf(s, 0);
    expect(unit(s, p.id)!.wonder).toEqual({ stage: 0, progress: 2 });
    expect(victoryStatus(s, 0).paused).toBe(true);
    c.owner = 0;
    untilTurnOf(s, 0);
    expect(unit(s, p.id)!.wonder).toEqual({ stage: 0, progress: 3 });
  });
});

describe('9. Gegenschlag nach dem Treffer / return fire after the hit', () => {
  it('a harder hit draws weaker return fire (a miss draws the most)', () => {
    const base = game(['korvat', 'dravon'], { hitChance: true });
    const a = addUnit(base, 'mg', 0, 5, 5); const d = addUnit(base, 'mg', 1, 6, 5);
    const ret: Record<string, number> = {};
    for (let seed = 1; seed < 600; seed++) {
      const s = withRng(base, seed);
      const ev = attackEvent(ok(s, { type: 'attack', unit: a.id, target: d.id }).events);
      if (ev.retHit === 'full') ret[ev.hit!] = ev.ret;
    }
    expect(Object.keys(ret).sort()).toEqual(['crit', 'full', 'graze', 'miss', 'partial']);
    expect(ret.miss).toBeGreaterThan(ret.full);
    expect(ret.full).toBeGreaterThan(ret.crit);
    expect(ret.graze).toBeGreaterThanOrEqual(ret.partial);
  });

  it('without hit luck the preview matches the actual return fire, based on the HP after the hit', () => {
    const s = game();
    const a = addUnit(s, 'mg', 0, 5, 5); const d = addUnit(s, 'mg', 1, 6, 5);
    const p = combatPreview(s, a, d);
    const ev = attackEvent(ok(s, { type: 'attack', unit: a.id, target: d.id }).events);
    expect(ev.ret).toBe(p.toAttacker);
    expect(p.expectedRet).toBe(p.toAttacker);
    // unverletzt haette das MG mit voller Kraft geantwortet: round(3 / 6 * 3 * 4.5) = 7; nach dem Treffer (8/15 LP) weniger
    // unhurt the mg would have answered at full force: round(3 / 6 * 3 * 4.5) = 7; after the hit (8/15 HP) less
    expect(ev.dmg).toBe(7);
    expect(p.toAttacker).toBe(Math.round(((3 * 8 / 15) / (3 + 3 * 8 / 15)) * 3 * 4.5));
    expect(p.toAttacker).toBeLessThan(7);
  });
});

describe('10. Trefferrasse und Heilung / hit race and healing', () => {
  it('ships take the race of their owner faction', () => {
    const s = blankGame({ factions: ['nexus', 'vesper'], hitChance: true });
    const d = addUnit(s, 'destroyer', 0, 5, 5, { carried: 'android' });
    const a = addUnit(s, 'android', 0, 6, 6);
    expect(hitOdds(s, d)).toEqual(hitOdds(s, a));
    const c = addUnit(s, 'destroyer', 1, 7, 7, { carried: 'zealot' });
    const z = addUnit(s, 'zealot', 1, 8, 8);
    expect(hitOdds(s, c)).toEqual(hitOdds(s, z));
  });

  it('medics do not heal aliens off xeno ground', () => {
    const s = game(['alvenia', 'zyrr']);
    const g = addUnit(s, 'grey', 0, 5, 5, { hp: 4 });
    const m = addUnit(s, 'medic', 0, 4, 5);
    const i = addUnit(s, 'infantry', 0, 4, 6, { hp: 4 });
    ok(s, { type: 'medicHeal', unit: m.id });
    expect(unit(s, g.id)!.hp).toBe(4);
    expect(unit(s, i.id)!.hp).toBeGreaterThan(4);
  });

  it('mech rockets count as ranged for the wind rule', () => {
    const s = blankGame({ factions: ['korvat', 'zyrr'], weather: true, hitChance: true });
    let r = 2;
    while (weatherFor(s.config.seed, r) !== 'wind') r++;
    s.round = r;
    addCity(s, 0, 0, 0, { hq: true }); addCity(s, 10, 10, 1, { hq: true });
    const m = addUnit(s, 'mech', 1, 5, 5);
    const e = addUnit(s, 'infantry', 0, 7, 5);
    s.current = 1;
    expect(hitOdds(s, m, true).miss).toBeGreaterThan(hitOdds(s, m).miss);
    expect(combatPreview(s, m, e, true).odds).toEqual(hitOdds(s, m, true));
  });
});

describe('12. Eroberte Fraktionsgebaeude / captured faction buildings', () => {
  it('a captured test lab does not lower the captor research cost', () => {
    const cost = (lab: boolean) => {
      const s = blankGame({ factions: ['korvat', 'velkar'] });
      addCity(s, 1, 1, 0, { hq: true }); const vc = addCity(s, 8, 8, 1, { hq: true }); addCity(s, 4, 8, 1);
      if (lab) tile(s, 8, 7).building = 'testLab';
      vc.owner = 0;
      return researchCost(s, 0, 'camouflage');
    };
    expect(cost(true)).toBe(cost(false));
  });

  it('captured mercenary barracks do not train veterans for the captor', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 100 });
    const c = addCity(s, 3, 3, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    tile(s, 3, 4).building = 'mercenaryBarracks';
    const r = ok(s, { type: 'train', city: c.id, unitType: 'infantry' });
    expect(r.events.some((e) => e.t === 'veteran')).toBe(false);
  });
});

describe('13. Eine Fahrzeugliste / one vehicle list', () => {
  it('barrier, snow, jungle and wreck lists follow the vehicle class', () => {
    for (const v of COUNTER.vehicles) {
      expect(BARRIER.vehicles, v).toContain(v);
      expect(WEATHER.snow.moveUnits, v).toContain(v);
      expect(JUNGLE.vehicles, v).toContain(v);
      expect(REMAINS.wreckUnits, v).toContain(v);
    }
  });

  it('a titan is slowed by a barrier and leaves a wreck', () => {
    const s = game(['velkar', 'nexus']);
    tile(s, 5, 5).barrier = { owner: 0 };
    s.current = 1;
    const t = addUnit(s, 'titan', 1, 6, 5);
    const r = ok(s, { type: 'move', unit: t.id, to: { x: 5, y: 5 } });
    expect(r.events.some((e) => e.t === 'barrierHit')).toBe(true);
    expect(unit(s, t.id)!.slowedNext).toBe(true);
    s.current = 0;
    const tank = addUnit(s, 'tank', 0, 4, 5);
    unit(s, t.id)!.hp = 1;
    ok(s, { type: 'attack', unit: tank.id, target: t.id });
    expect(tile(s, 5, 5).remains?.kind).toBe('wreck');
  });
});

describe('14. Alte Spielstaende / old saves', () => {
  it('missing hitChance and factionVictory load as off, new games default to on', () => {
    const old = createGame(defaultConfig({ seed: 3, size: 11 }));
    delete (old.config as Partial<typeof old.config>).hitChance;
    delete (old.config as Partial<typeof old.config>).factionVictory;
    const loaded = migrateState(JSON.parse(JSON.stringify(old)));
    expect(loaded.config.hitChance).toBe(false);
    expect(loaded.config.factionVictory).toBe(false);
    const fresh = createGame(defaultConfig({ seed: 3, size: 11 }));
    expect(fresh.config.hitChance).toBe(true);
    expect(fresh.config.factionVictory).toBe(true);
    const kept = migrateState(JSON.parse(JSON.stringify(fresh)));
    expect(kept.config.hitChance).toBe(true);
    expect(kept.config.factionVictory).toBe(true);
    // ein Konfigurationsobjekt ohne die Felder startet ausdruecklich mit an / a config without the fields starts explicitly on
    const cfg = defaultConfig({ seed: 3, size: 11 });
    delete (cfg as Partial<typeof cfg>).hitChance; delete (cfg as Partial<typeof cfg>).factionVictory;
    const g = createGame(cfg);
    expect(g.config.hitChance).toBe(true);
    expect(g.config.factionVictory).toBe(true);
  });
});
