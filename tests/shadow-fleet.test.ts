/**
 * Schattenflotte der Handelsliga Meridon: Tarnung, Absetzen, Feuerkraft, Seemacht, Sabotage, Radar, Raketensilo, Brand,
 * Lenkflugkoerper, Liste der Einheiten und Spielstaende.
 * Shadow fleet of the Meridon Trade League: camouflage, withdrawal, firepower, sea power, sabotage, radar, rocket silo,
 * fire, guided missile, unit roster and saves.
 */
import { describe, expect, it } from 'vitest';
import {
  attackTargets, canSeeUnit, cloneState, combatPreview, emplacementTargets, factionVariant, firepowerFactor, isExplored, reachable,
  radarCheck, rosterShips, rosterUnits, sabotageTargets, siloArea, siloCheck, siloPreview, siloWait, trainCheck, unitCost,
  buildCheck, shipUpgradeCost, radarEcho, onFire, type GameState,
} from '../src/core';
import { BUILDINGS, FACTIONS, FIREPOWER, RADAR, SABOTAGE, SEA_POWER, SHIPYARD, SILO, UNITS, VISION, WITHDRAW, type FactionId } from '../src/data/balance';
import { isValidState, migrateState } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, fails, giveSites, ok, revealAll, tile, unit, untilTurnOf } from './helpers';

/** Meridon (0) gegen Korvat (1) auf leerer Ebene / Meridon (0) against Korvat (1) on an empty plain */
function duel(o: { factions?: FactionId[]; size?: 11 | 14 | 16; stars?: number } = {}) {
  const s = blankGame({ factions: o.factions ?? ['meridon', 'korvat'], stars: o.stars ?? 300, size: o.size ?? 14 });
  const hq = addCity(s, 2, 2, 0, { hq: true });
  const foe = addCity(s, s.size - 3, s.size - 3, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return { s, hq, foe };
}

describe('Liste der Einheiten / unit roster', () => {
  it('Meridon: kein Panzer, keine Artillerie, kein MG; Schattenkommando, Lenkflugkoerper und Radarwagen statt dessen', () => {
    const { s, hq } = duel();
    const list = rosterUnits(s, 0);
    for (const t of ['tank', 'artillery', 'mg'] as const) expect(list, t).not.toContain(t);
    for (const t of ['shadowCommando', 'guidedMissile', 'radarTruck'] as const) expect(list, t).toContain(t);
    expect(list.filter((t) => t === 'guidedMissile')).toHaveLength(1);
    giveSites(hq, 'armory', 'foundry', 'tankWorks', 'motorPool');
    for (const t of ['tank', 'artillery', 'mg'] as const) expect(trainCheck(s, hq, t), t).toBe('invalid');
    for (const t of ['shadowCommando', 'guidedMissile', 'radarTruck'] as const) expect(trainCheck(s, hq, t), t).toBe('ok');
    // Stadtbelohnung und Kampagne: statt Panzer ein Lenkflugkoerper / city reward and campaign: a Guided Missile instead of the tank
    expect(factionVariant(s, 0, 'tank')).toBe('guidedMissile');
    // andere Fraktionen behalten ihre Liste / other factions keep their roster
    const k = rosterUnits(s, 1);
    expect(k).toContain('mg');
    expect(k).not.toContain('shadowCommando');
    expect(trainCheck(s, s.cities[1], 'shadowCommando')).toBe('invalid');
  });

  it('Werft: Nebelkutter statt Transportboot, Kaperschiff bleibt, alles 20 % billiger; Marinestuetzpunkt auch', () => {
    const { s, hq } = duel();
    for (let y = 0; y < 14; y++) tile(s, 3, y).terrain = 'shallow';
    const ships = rosterShips(s, 0);
    expect(ships[0]).toBe('fogCutter');
    expect(ships).not.toContain('landingBoat');
    expect(ships).toContain('privateer');
    expect(rosterShips(s, 1)[0]).toBe('landingBoat');
    const d = SEA_POWER.discount.meridon!;
    expect(d).toBe(0.2);
    expect(unitCost(s, 0, 'fogCutter')).toBe(Math.ceil(SHIPYARD.fogCutterCost * (1 - d)));
    expect(unitCost(s, 0, 'destroyer')).toBe(Math.ceil(UNITS.destroyer.cost! * (1 - d)));
    expect(unitCost(s, 1, 'destroyer')).toBe(UNITS.destroyer.cost);
    expect(shipUpgradeCost(s, 0, 'battleship')).toBe(Math.ceil(UNITS.battleship.cost! * (1 - d)));
    expect(shipUpgradeCost(s, 1, 'battleship')).toBe(UNITS.battleship.cost);
    // Marinestuetzpunkt im eigenen Gebiet auf Flachwasser / naval base in own territory on shallow water
    const nb = buildCheck(s, 0, 'navalBase', 3, 2);
    expect(nb.cost).toBe(Math.ceil(BUILDINGS.navalBase.cost * (1 - d)));
    // Kauf: leerer Nebelkutter mit Rumpf-LP / purchase: empty Fog Cutter with hull HP
    const before = s.factions[0].stars;
    const r = ok(s, { type: 'train', city: hq.id, unitType: 'fogCutter' });
    const b = unit(s, (r.events.find((e) => e.t === 'train') as { unit: number }).unit)!;
    expect(b.type).toBe('fogCutter');
    expect(b.carried).toBeNull();
    expect(b.hp).toBe(SHIPYARD.hullHp.fogCutter);
    expect(s.factions[0].stars).toBe(before - unitCost(s, 0, 'fogCutter')!);
    // Lotsenwesen: auch der Nebelkutter faehrt weiter / harbour pilots: the Fog Cutter moves further too
    b.fresh = false; b.exhausted = false;
    expect(Math.max(...reachable(s, b).map((q) => q.cost))).toBe(UNITS.fogCutter.move + 1);
  });

  it('Spione 30 % billiger, die anderen Merkmale bleiben', () => {
    expect(FACTIONS.meridon.discountUnit).toBe('spy');
    expect(FACTIONS.meridon.discount).toBe(0.3);
    expect(FACTIONS.meridon.perk2).toBe('harbourPilots');
  });
});

describe('Tarnung / camouflage', () => {
  it('nur Schattenkommando und Nebelkutter sind getarnt / only the Shadow Commando and the Fog Cutter are camouflaged', () => {
    const camo = (Object.keys(UNITS) as (keyof typeof UNITS)[]).filter((t) => UNITS[t].abilities.includes('camo'));
    expect(camo.sort()).toEqual(['fogCutter', 'shadowCommando']);
    expect(UNITS.privateer.abilities).not.toContain('camo');
  });

  it('unsichtbar ohne Nachbarn; Einheit, Stadt oder Bauwerk daneben enttarnt / invisible without neighbours; unit, city or structure next to it reveals', () => {
    const { s } = duel();
    const c = addUnit(s, 'shadowCommando', 0, 7, 7);
    expect(canSeeUnit(s, 1, c)).toBe(false);
    expect(canSeeUnit(s, 0, c)).toBe(true);
    // Feind zwei Felder weg: weiter getarnt / enemy two tiles away: still camouflaged
    const k = addUnit(s, 'infantry', 1, 9, 7);
    expect(canSeeUnit(s, 1, c)).toBe(false);
    k.x = 8;
    expect(canSeeUnit(s, 1, c)).toBe(true);
    k.x = 11;
    // Stadt daneben / city next to it
    addCity(s, 8, 8, 1);
    expect(canSeeUnit(s, 1, c)).toBe(true);
    s.cities = s.cities.filter((x) => !(x.x === 8 && x.y === 8));
    tile(s, 8, 8).cityId = null;
    expect(canSeeUnit(s, 1, c)).toBe(false);
    // eigenes Bauwerk des Gegners daneben / the enemy's own structure next to it
    tile(s, 6, 6).turret = { hp: 20, active: true, owner: 1 };
    expect(canSeeUnit(s, 1, c)).toBe(true);
    // ein normales MG daneben bleibt immer sichtbar, eine normale Infanterie ohne Nachbarn auch / a normal unit is always visible
    const inf = addUnit(s, 'infantry', 0, 3, 11);
    expect(canSeeUnit(s, 1, inf)).toBe(true);
  });

  it('Angriff enttarnt bis zum naechsten eigenen Zug; Gegner koennen dann zurueckschlagen / attacking reveals until the next own turn', () => {
    const { s } = duel();
    const c = addUnit(s, 'shadowCommando', 0, 6, 6);
    const k = addUnit(s, 'infantry', 1, 7, 6);
    // daneben: sichtbar; der Gegner zieht weg, dann wieder getarnt / adjacent: visible; enemy moves away, camouflaged again
    k.x = 8;
    const k2 = addUnit(s, 'infantry', 1, 9, 9);
    expect(canSeeUnit(s, 1, c)).toBe(false);
    k.x = 7;
    ok(s, { type: 'attack', unit: c.id, target: k.id });
    const cc = unit(s, c.id)!;
    expect(cc.revealed).toBe(true);
    // Absetzen weg vom Feind / withdraw away from the enemy
    ok(s, { type: 'move', unit: c.id, to: { x: 4, y: 6 } });
    endTurn(s);
    // Zug des Gegners: weiter sichtbar trotz Abstand / enemy's turn: still visible despite the distance
    expect(s.current).toBe(1);
    expect(canSeeUnit(s, 1, unit(s, c.id)!)).toBe(true);
    endTurn(s);
    // naechster eigener Zug: wieder getarnt / next own turn: camouflaged again
    expect(s.current).toBe(0);
    expect(unit(s, c.id)!.revealed).toBe(false);
    expect(canSeeUnit(s, 1, unit(s, c.id)!)).toBe(false);
    expect(k2).toBeDefined();
  });

  it('Gegner koennen Getarnte weder angreifen noch blind beschiessen / enemies can neither attack nor target hidden ones', () => {
    const { s } = duel();
    const c = addUnit(s, 'shadowCommando', 0, 6, 6);
    const art = addUnit(s, 'artillery', 1, 8, 8);
    s.current = 1;
    expect(attackTargets(s, art).map((o) => o.id)).not.toContain(c.id);
    fails(s, { type: 'attack', unit: art.id, target: c.id }, 'outOfRange');
  });

  it('Nebelkutter traegt eine Einheit und bleibt getarnt / the Fog Cutter carries one unit and stays camouflaged', () => {
    const { s } = duel();
    for (let y = 0; y < 14; y++) for (let x = 5; x < 9; x++) tile(s, x, y).terrain = 'shallow';
    const boat = addUnit(s, 'fogCutter', 0, 5, 4, { carried: null });
    boat.hp = boat.maxHp = SHIPYARD.hullHp.fogCutter!;
    const inf = addUnit(s, 'infantry', 0, 4, 4);
    ok(s, { type: 'move', unit: inf.id, to: { x: 5, y: 4 } });
    const u = unit(s, inf.id)!;
    expect(u.type).toBe('fogCutter');
    expect(u.carried).toBe('infantry');
    expect(canSeeUnit(s, 1, u)).toBe(false);
    // ein Transportboot anderer Fraktionen ist sichtbar / another faction's transport boat is visible
    const lb = addUnit(s, 'landingBoat', 1, 7, 10);
    expect(canSeeUnit(s, 0, lb)).toBe(true);
  });
});

describe('Absetzen / withdraw', () => {
  function fight() {
    const r = duel();
    const k = addUnit(r.s, 'infantry', 1, 7, 6, { hp: 40 });
    k.maxHp = 40;
    return { ...r, k };
  }

  it('nach eigenem Angriff ohne Bewegung bis zu 2 Felder zurueck, danach kein Angriff / after an own attack without moving up to 2 tiles back, no attack afterwards', () => {
    const { s, k } = fight();
    const u = addUnit(s, 'infantry', 0, 6, 6);
    ok(s, { type: 'attack', unit: u.id, target: k.id });
    const a = unit(s, u.id)!;
    expect(a.withdraw).toBe(true);
    expect(a.exhausted).toBe(false);
    const dests = reachable(s, a);
    expect(dests.length).toBeGreaterThan(0);
    expect(Math.max(...dests.map((d) => d.cost))).toBeLessThanOrEqual(WITHDRAW.tiles);
    expect(dests.some((d) => d.x === 4 && d.y === 6)).toBe(true);
    // kein zweiter Angriff / no second attack
    expect(attackTargets(s, a)).toHaveLength(0);
    ok(s, { type: 'move', unit: u.id, to: { x: 4, y: 6 } });
    const b = unit(s, u.id)!;
    expect(b.exhausted).toBe(true);
    expect(b.withdraw).toBeUndefined();
    expect(reachable(s, b)).toHaveLength(0);
  });

  it('nicht nach einer Bewegung, nicht fuer andere Fraktionen, nicht fuer Flieger / not after a move, not for other factions, not for flyers', () => {
    const { s, k } = fight();
    const u = addUnit(s, 'infantry', 0, 5, 6);
    ok(s, { type: 'move', unit: u.id, to: { x: 6, y: 6 } });
    ok(s, { type: 'attack', unit: u.id, target: k.id });
    expect(unit(s, u.id)!.withdraw).toBeUndefined();
    expect(unit(s, u.id)!.exhausted).toBe(true);
    // Korvat: kein Absetzen / Korvat: no withdrawal
    const o = duel({ factions: ['korvat', 'meridon'] });
    const m = addUnit(o.s, 'infantry', 1, 7, 6, { hp: 40 });
    const ku = addUnit(o.s, 'infantry', 0, 6, 6);
    ok(o.s, { type: 'attack', unit: ku.id, target: m.id });
    expect(unit(o.s, ku.id)!.exhausted).toBe(true);
    expect(reachable(o.s, unit(o.s, ku.id)!)).toHaveLength(0);
    // Hubschrauber nicht / helicopter not
    const h = addUnit(s, 'heli', 0, 6, 8);
    const k2 = addUnit(s, 'infantry', 1, 7, 9, { hp: 40 });
    ok(s, { type: 'attack', unit: h.id, target: k2.id });
    expect(unit(s, h.id)!.withdraw).toBeUndefined();
  });

  it('angegriffen werden loest kein Absetzen aus / being attacked does not trigger a withdrawal', () => {
    const { s } = duel();
    const u = addUnit(s, 'infantry', 0, 6, 6);
    const k = addUnit(s, 'infantry', 1, 7, 6);
    s.current = 1;
    ok(s, { type: 'attack', unit: k.id, target: u.id });
    expect(unit(s, u.id)!.withdraw).toBeUndefined();
  });

  it('der Jeep behaelt seine volle Bewegung nach dem Angriff / the jeep keeps its full movement after attacking', () => {
    const { s, k } = fight();
    const j = addUnit(s, 'jeep', 0, 6, 6);
    ok(s, { type: 'attack', unit: j.id, target: k.id });
    const a = unit(s, j.id)!;
    expect(a.withdraw).toBeUndefined();
    expect(Math.max(...reachable(s, a).map((d) => d.cost))).toBeGreaterThan(WITHDRAW.tiles);
  });
});

describe('Feuerkraft / firepower', () => {
  it('Meridon-Landeinheiten -10 %, Schiffe und Lenkflugkoerper nicht / Meridon land units -10 %, ships and guided missiles not', () => {
    const { s } = duel();
    const m = addUnit(s, 'infantry', 0, 6, 6);
    const ship = addUnit(s, 'destroyer', 0, 1, 1);
    const missile = addUnit(s, 'guidedMissile', 0, 1, 2);
    expect(firepowerFactor(s, m)).toBe(0.9);
    expect(firepowerFactor(s, ship)).toBe(1);
    expect(firepowerFactor(s, missile)).toBe(1);
    expect(FIREPOWER.land.meridon).toBe(0.9);
    // gleiche Lage mit Korvat: Schaden x 0,9 (gerundet) / same situation with Korvat: damage x 0.9 (rounded)
    const target = addUnit(s, 'mg', 1, 7, 6);
    const pm = combatPreview(s, m, target);
    const o = duel({ factions: ['korvat', 'dravon'] });
    const om = addUnit(o.s, 'infantry', 0, 6, 6);
    const ot = addUnit(o.s, 'mg', 1, 7, 6);
    const po = combatPreview(o.s, om, ot);
    expect(pm.toDefender).toBeLessThan(po.toDefender);
    expect(Math.abs(pm.toDefender - po.toDefender * FIREPOWER.land.meridon!)).toBeLessThanOrEqual(1);
    // Gegenschlag eines Meridon-Verteidigers ebenso schwaecher / return fire of a Meridon defender weaker as well
    s.current = 1;
    const pr = combatPreview(s, target, m);
    o.s.current = 1;
    const or = combatPreview(o.s, ot, om);
    expect(pr.retFull).toBeLessThanOrEqual(or.retFull);
  });
});

describe('Sabotage / sabotage', () => {
  function site() {
    const r = duel();
    const { s, foe } = r;
    // feindliche Strasse, Gebaeude und Aussenposten im Gebiet des Gegners / hostile road, building and outpost in the enemy's territory
    tile(s, foe.x - 1, foe.y).road = true;
    tile(s, foe.x, foe.y - 1).building = 'farm';
    tile(s, foe.x - 1, foe.y - 1).outpost = { owner: 1 };
    return r;
  }

  it('zerstoert Aussenposten, Gebaeude oder Strasse daneben, nie Staedte; Aktion, Enttarnung und Sperre / destroys an outpost, building or road nearby, never cities', () => {
    const { s, foe } = site();
    const c = addUnit(s, 'shadowCommando', 0, foe.x - 2, foe.y - 1);
    const targets = sabotageTargets(s, c);
    expect(targets).toContainEqual({ x: foe.x - 1, y: foe.y - 1 });
    expect(targets).toContainEqual({ x: foe.x - 1, y: foe.y });
    expect(targets.some((p) => p.x === foe.x && p.y === foe.y)).toBe(false);
    ok(s, { type: 'sabotage', unit: c.id, x: foe.x - 1, y: foe.y - 1 });
    expect(tile(s, foe.x - 1, foe.y - 1).outpost).toBeNull();
    const u = unit(s, c.id)!;
    expect(u.exhausted).toBe(true);
    expect(u.revealed).toBe(true);
    expect(u.sabotageReady).toBe(s.round + SABOTAGE.cooldown + 1);
    // Sperre / cooldown
    u.exhausted = false;
    fails(s, { type: 'sabotage', unit: c.id, x: foe.x - 1, y: foe.y }, 'sabotageCooldown');
    // nach der Sperre: Strasse / after the cooldown: road
    s.round = u.sabotageReady!;
    ok(s, { type: 'sabotage', unit: c.id, x: foe.x - 1, y: foe.y });
    expect(tile(s, foe.x - 1, foe.y).road).toBe(false);
    // Gebaeude / building
    const c2 = addUnit(s, 'shadowCommando', 0, foe.x - 1, foe.y - 2);
    ok(s, { type: 'sabotage', unit: c2.id, x: foe.x, y: foe.y - 1 });
    expect(tile(s, foe.x, foe.y - 1).building).toBeNull();
    // Stadt: kein Ziel / city: no target
    const c3 = addUnit(s, 'shadowCommando', 0, foe.x - 1, foe.y + 1);
    fails(s, { type: 'sabotage', unit: c3.id, x: foe.x, y: foe.y }, 'noTarget');
    // zu weit / too far
    fails(s, { type: 'sabotage', unit: c3.id, x: foe.x - 3, y: foe.y + 1 }, 'outOfRange');
  });

  it('nur das Schattenkommando, nur im Krieg, keine eigenen Ziele / only the Shadow Commando, only at war, no own targets', () => {
    const { s, foe, hq } = site();
    const inf = addUnit(s, 'infantry', 0, foe.x - 2, foe.y - 1);
    fails(s, { type: 'sabotage', unit: inf.id, x: foe.x - 1, y: foe.y - 1 }, 'cannotBuild');
    tile(s, hq.x + 1, hq.y).road = true;
    const c = addUnit(s, 'shadowCommando', 0, hq.x + 1, hq.y + 1);
    fails(s, { type: 'sabotage', unit: c.id, x: hq.x + 1, y: hq.y }, 'noTarget');
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    const c2 = addUnit(s, 'shadowCommando', 0, foe.x - 2, foe.y - 1);
    expect(sabotageTargets(s, c2)).toHaveLength(0);
  });
});

describe('Radar / radar', () => {
  it('Impuls: feindliche Einheiten im Umkreis 6 sichtbar, auch unter Wolken und getarnte; Felder bleiben unerkundet', () => {
    const s = blankGame({ factions: ['meridon', 'korvat'], stars: 100, size: 14 });
    addCity(s, 2, 2, 0, { hq: true });
    addCity(s, 11, 11, 1, { hq: true });
    const radar = addUnit(s, 'radarTruck', 0, 5, 5);
    const far = addUnit(s, 'infantry', 1, 5 + RADAR.radius, 5);
    const out = addUnit(s, 'infantry', 1, 5 + RADAR.radius + 1, 5);
    const sub = addUnit(s, 'submarine', 1, 9, 9);
    const spy = addUnit(s, 'spy', 1, 8, 4);
    const commando = addUnit(s, 'shadowCommando', 1, 3, 9);
    expect(isExplored(s, 0, far.x, far.y)).toBe(false);
    expect(canSeeUnit(s, 0, far)).toBe(false);
    ok(s, { type: 'radarSweep', unit: radar.id });
    for (const u of [far, sub, spy, commando]) expect(canSeeUnit(s, 0, u), u.type).toBe(true);
    expect(canSeeUnit(s, 0, out)).toBe(false);
    expect(isExplored(s, 0, far.x, far.y)).toBe(false);
    expect(radarEcho(s, 0, far)).toBe(true);
    // Aktion verbraucht, Sperrzeit / action spent, cooldown
    expect(unit(s, radar.id)!.exhausted).toBe(true);
    unit(s, radar.id)!.exhausted = false;
    fails(s, { type: 'radarSweep', unit: radar.id }, 'radarCooldown');
    // der Impuls folgt dem Wagen / the sweep follows the truck
    ok(s, { type: 'move', unit: radar.id, to: { x: 6, y: 5 } });
    expect(canSeeUnit(s, 0, out)).toBe(true);
    // Dauer: diese und die naechste Runde / duration: this and the next round
    untilTurnOf(s, 0);
    expect(canSeeUnit(s, 0, out)).toBe(true);
    untilTurnOf(s, 0);
    expect(canSeeUnit(s, 0, out)).toBe(false);
    expect(radarCheck(s, unit(s, radar.id)!)).toBe('radarCooldown');
    untilTurnOf(s, 0);
    untilTurnOf(s, 0);
    expect(s.round).toBeGreaterThanOrEqual(2 + RADAR.cooldown);
    expect(radarCheck(s, unit(s, radar.id)!)).toBe('ok');
  });

  it('faellt der Radarwagen, endet der Impuls; nur der Radarwagen kann es / if the truck falls the sweep ends; only the truck can do it', () => {
    const s = blankGame({ factions: ['meridon', 'korvat'], stars: 100, size: 14 });
    addCity(s, 2, 2, 0, { hq: true });
    addCity(s, 11, 11, 1, { hq: true });
    const radar = addUnit(s, 'radarTruck', 0, 5, 5);
    const far = addUnit(s, 'infantry', 1, 10, 5);
    revealAll(s, 1);
    ok(s, { type: 'radarSweep', unit: radar.id });
    expect(canSeeUnit(s, 0, far)).toBe(true);
    s.current = 1;
    const k = addUnit(s, 'tank', 1, 6, 5);
    unit(s, radar.id)!.hp = 1;
    ok(s, { type: 'attack', unit: k.id, target: radar.id });
    expect(unit(s, radar.id)).toBeUndefined();
    expect(canSeeUnit(s, 0, far)).toBe(false);
    s.current = 0;
    const inf = addUnit(s, 'infantry', 0, 3, 3);
    fails(s, { type: 'radarSweep', unit: inf.id }, 'cannotBuild');
  });

  it('Aufklaerungsdrohne und Funkturm sehen getarnte Einheiten bis Rundenende / recon drone and radio tower see camouflaged units until the end of the round', () => {
    const { s, foe } = duel({ factions: ['korvat', 'meridon'] });
    const c = addUnit(s, 'shadowCommando', 1, 6, 6);
    expect(canSeeUnit(s, 0, c)).toBe(false);
    const hq = s.cities[0];
    s.factions[0].techs.push('aerodynamics');
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'radioTower', target: { x: 6, y: 6 } });
    expect(canSeeUnit(s, 0, c)).toBe(true);
    untilTurnOf(s, 0);
    expect(canSeeUnit(s, 0, unit(s, c.id)!)).toBe(false);
    expect(foe).toBeDefined();
    expect(VISION.droneRadius).toBeGreaterThan(0);
  });
});

describe('Raketensilo / rocket silo', () => {
  function armed(o: { factions?: FactionId[]; size?: 14 | 16 } = {}) {
    const r = duel(o);
    const p = addUnit(r.s, 'pioneer', 0, 2, 3);
    ok(r.s, { type: 'emplacement', unit: p.id, x: 3, y: 3 });
    const g = tile(r.s, 3, 3).turret!;
    g.ready = r.s.round;
    return { ...r, silo: { x: 3, y: 3 } };
  }

  it('Bau: Pionier, eigenes Gebiet, Preis, eine je Stadt, Aufladezeit / building: pioneer, own territory, price, one per city, charge', () => {
    const { s } = duel();
    const p = addUnit(s, 'pioneer', 0, 2, 3);
    expect(emplacementTargets(s, p).length).toBeGreaterThan(0);
    const before = s.factions[0].stars;
    const r = ok(s, { type: 'emplacement', unit: p.id, x: 3, y: 3 });
    expect(r.events.find((e) => e.t === 'emplacement')).toMatchObject({ kind: 'silo' });
    expect(s.factions[0].stars).toBe(before - SILO.cost);
    const g = tile(s, 3, 3).turret!;
    expect(g.kind).toBe('silo');
    expect(g.hp).toBe(SILO.hp);
    expect(siloWait(s, 3, 3)).toBe(SILO.charge);
    // eine je Stadt / one per city
    const p2 = addUnit(s, 'pioneer', 0, 1, 1);
    expect(emplacementTargets(s, p2)).toHaveLength(0);
    fails(s, { type: 'emplacement', unit: p2.id, x: 1, y: 2 }, 'emplacementLimit');
    // nur Meridon baut Silos, Korvat gar keine Bauwerke / only Meridon builds silos, Korvat no structures at all
    const k = duel({ factions: ['korvat', 'meridon'] });
    const kp = addUnit(k.s, 'pioneer', 0, 2, 3);
    fails(k.s, { type: 'emplacement', unit: kp.id, x: 3, y: 3 }, 'wrongFaction');
  });

  it('Start: Reichweite 12, 2x2-Flaeche, 9 Schaden an allen Einheiten (auch eigenen), Brand und Sperrzeit / launch: range 12, 2x2 area, 9 damage on all units (own too), fire and cooldown', () => {
    const { s, silo } = armed();
    const tx = 9, ty = 9;
    expect(siloArea(s, tx, ty)).toEqual([{ x: 9, y: 9 }, { x: 10, y: 9 }, { x: 9, y: 10 }, { x: 10, y: 10 }]);
    // am Rand nach innen geschoben / shifted inwards at the edge
    expect(siloArea(s, 13, 13)[0]).toEqual({ x: 12, y: 12 });
    const a = addUnit(s, 'tank', 1, 9, 9);
    const b = addUnit(s, 'infantry', 1, 10, 10, { hp: 9 });
    const own = addUnit(s, 'infantry', 0, 10, 9);
    const outside = addUnit(s, 'infantry', 1, 11, 9);
    const pre = siloPreview(s, 0, silo.x, silo.y, tx, ty);
    expect(pre.check).toBe('ok');
    expect(pre.hits).toHaveLength(3);
    expect(pre.hits.filter((h) => h.own)).toHaveLength(1);
    expect(pre.fire).toHaveLength(4);
    const kills = s.factions[0].kills;
    ok(s, { type: 'siloLaunch', x: silo.x, y: silo.y, tx, ty });
    expect(unit(s, a.id)!.hp).toBe(UNITS.tank.hp - SILO.damage);
    expect(unit(s, b.id)).toBeUndefined();
    expect(unit(s, own.id)!.hp).toBe(UNITS.infantry.hp - SILO.damage);
    expect(unit(s, outside.id)!.hp).toBe(UNITS.infantry.hp);
    expect(s.factions[0].kills).toBe(kills + 1);
    for (const p of siloArea(s, tx, ty)) {
      expect(onFire(s, tile(s, p.x, p.y))).toBe(true);
      expect(tile(s, p.x, p.y).scar?.v ?? 0).toBeGreaterThan(0);
    }
    expect(siloWait(s, silo.x, silo.y)).toBe(SILO.cooldown);
    fails(s, { type: 'siloLaunch', x: silo.x, y: silo.y, tx, ty }, 'siloCooldown');
  });

  it('Brand: 3 Runden je 2 LP zu Rundenbeginn, danach erloschen / fire: 3 rounds of 2 HP at the start of the round, then out', () => {
    const { s, silo } = armed();
    const a = addUnit(s, 'tank', 1, 9, 9);
    ok(s, { type: 'siloLaunch', x: silo.x, y: silo.y, tx: 9, ty: 9 });
    const hp0 = unit(s, a.id)!.hp;
    // der Gegner bleibt stehen / the enemy stays put
    for (let i = 1; i <= SILO.fireRounds; i++) {
      untilTurnOf(s, 0);
      expect(unit(s, a.id)!.hp).toBe(hp0 - i * SILO.fireDamage);
    }
    untilTurnOf(s, 0);
    expect(unit(s, a.id)!.hp).toBe(hp0 - SILO.fireRounds * SILO.fireDamage);
    expect(onFire(s, tile(s, 9, 9))).toBe(false);
    expect(tile(s, 9, 9).fire ?? null).toBeNull();
  });

  it('Grenzen: Reichweite, Sicht, Frieden, nur eigene Silos / limits: range, vision, peace, own silos only', () => {
    const { s, silo } = armed({ factions: ['meridon', 'korvat'], size: 16 });
    // genau 12 Felder (Schachbrett-Abstand) ja, 13 nein / exactly 12 tiles (Chebyshev distance) yes, 13 no
    expect(siloCheck(s, 0, silo.x, silo.y, silo.x + SILO.launchRange, silo.y)).toBe('ok');
    expect(siloCheck(s, 0, silo.x, silo.y, silo.x + SILO.launchRange, silo.y + SILO.launchRange)).toBe('ok');
    tile(s, 3, 3).turret = null;
    tile(s, 0, 0).turret = { hp: SILO.hp, active: true, owner: 0, kind: 'silo', ready: s.round };
    expect(siloCheck(s, 0, 0, 0, SILO.launchRange + 1, 0)).toBe('outOfRange');
    // unerkundetes Zielfeld / unexplored target tile
    s.factions[0].explored[5 * s.size + 5] = 0;
    expect(siloCheck(s, 0, 0, 0, 5, 5)).toBe('notVisible');
    // Frieden: sichtbare Einheit sperrt / peace: a visible unit blocks
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    addUnit(s, 'infantry', 1, 7, 7);
    expect(siloCheck(s, 0, 0, 0, 7, 7)).toBe('peace');
    // fremdes Silo / foreign silo
    expect(siloCheck(s, 1, 0, 0, 7, 7)).toBe('noUnit');
  });

  it('feuert nie von selbst, ist angreifbar und ohne Gegenschlag; geschleift bei Gebietsverlust / never fires on its own, attackable without return fire', () => {
    const { s, silo } = armed();
    addUnit(s, 'infantry', 1, 4, 4);
    untilTurnOf(s, 1);
    // kein Schuss zu Rundenbeginn / no shot at the start of the round
    expect(s.log.some((e) => e.t === 'turretFire')).toBe(false);
    const k = s.units.find((u) => u.owner === 1 && u.type === 'infantry')!;
    k.exhausted = false; k.attacked = false; k.moved = false;
    const r = ok(s, { type: 'attackTurret', unit: k.id, x: silo.x, y: silo.y });
    const hit = r.events.find((e) => e.t === 'turretHit') as { ret: number; dmg: number };
    expect(hit.dmg).toBeGreaterThan(0);
    expect(hit.ret).toBe(0);
  });

  it('Spielstand: Silo, Sperrzeit, Brand, Sichtung und Sperren ueberleben; alte Spielstaende ohne Felder laden / save: silo, cooldown, fire, sighting and locks survive', () => {
    const { s, silo } = armed();
    const radar = addUnit(s, 'radarTruck', 0, 4, 4);
    ok(s, { type: 'radarSweep', unit: radar.id });
    addUnit(s, 'tank', 1, 9, 9);
    ok(s, { type: 'siloLaunch', x: silo.x, y: silo.y, tx: 9, ty: 9 });
    const raw = JSON.parse(JSON.stringify(s)) as GameState;
    expect(isValidState(raw)).toBe(true);
    const m = migrateState(raw);
    expect(m.tiles[3 * m.size + 3].turret).toMatchObject({ kind: 'silo', ready: s.round + SILO.cooldown });
    expect(m.tiles[9 * m.size + 9].fire).toEqual({ until: s.round + SILO.fireRounds, owner: 0 });
    expect(m.factions[0].sightings?.[0]).toMatchObject({ unit: radar.id, r: RADAR.radius });
    expect(m.units.find((u) => u.id === radar.id)!.sweepReady).toBe(s.round + RADAR.cooldown);
    // alter Spielstand ohne die neuen Felder / old save without the new fields
    const old = cloneState(s);
    for (const t of old.tiles) { delete t.fire; if (t.turret) { delete t.turret.kind; delete t.turret.ready; } }
    for (const f of old.factions) delete f.sightings;
    for (const u of old.units) { delete u.withdraw; delete u.sweepReady; delete u.sabotageReady; }
    const mo = migrateState(JSON.parse(JSON.stringify(old)));
    expect(isValidState(mo)).toBe(true);
    endTurn(mo);
    expect(mo.current).toBe(1);
  });
});

describe('Lenkflugkoerper / guided missile', () => {
  it('fliegt 5 Felder ueber alles, explodiert beim Angriff und ist verbraucht / flies 5 tiles over everything, explodes when attacking and is spent', () => {
    const { s } = duel();
    for (let x = 4; x < 9; x++) tile(s, x, 6).terrain = 'ocean';
    const m = addUnit(s, 'guidedMissile', 0, 3, 6);
    expect(UNITS.guidedMissile.abilities).toEqual(expect.arrayContaining(['fly', 'kamikaze']));
    const dests = reachable(s, m);
    expect(Math.max(...dests.map((d) => d.cost))).toBe(UNITS.guidedMissile.move);
    expect(dests.some((d) => d.x === 8 && d.y === 6)).toBe(true);
    const t = addUnit(s, 'tank', 1, 9, 6);
    ok(s, { type: 'move', unit: m.id, to: { x: 8, y: 6 } });
    const pre = combatPreview(s, unit(s, m.id)!, t);
    // kein Abzug fuer Feuern nach Bewegung, kein Gegenschlag / no move-fire penalty, no return fire
    expect(pre.moveFire).toBe(false);
    expect(pre.toAttacker).toBe(0);
    const r = ok(s, { type: 'attack', unit: m.id, target: t.id });
    expect(r.events.find((e) => e.t === 'attack')).toMatchObject({ kamikaze: true });
    expect(unit(s, m.id)).toBeUndefined();
    expect(unit(s, t.id)!.hp).toBe(UNITS.tank.hp - pre.toDefender);
    expect(pre.toDefender).toBeGreaterThanOrEqual(5);
  });

  it('Flak holt ihn herunter / flak shoots it down', () => {
    const { s } = duel();
    const m = addUnit(s, 'guidedMissile', 0, 6, 6);
    addUnit(s, 'antiAir', 1, 7, 7);
    endTurn(s);
    expect(unit(s, m.id)).toBeUndefined();
  });
});
