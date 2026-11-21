/**
 * Schwebende Akademie der Velkar (ACADEMY): Forschungsposten, Gebiet und Wachstum fuer die Akademie, Abheben, Fliegen,
 * Landen, Produktionspause, Angriffe in der Luft, Schutzschild, Kampagne und eine KI-Partie.
 * Velkar floating academy (ACADEMY): research posts, territory and growth for the academy, lift-off, flight, landing,
 * production pause, attacks in the air, shield, campaign and an AI game.
 */
import { describe, expect, it } from 'vitest';
import {
  academyAttackCheck, academyMoves, academyOf, applyCommand, captureKind, cityIncome, cityTiles, createGame, defaultConfig, isExplored, landingOk,
  missionConfig, MISSION_IDS, reachable, trainCheck, trainSlots, unitLimit, type City, type GameEvent, type GameState,
} from '../src/core';
import { ACADEMY, AI, BASES, CITY, INCOME, UNITS } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { ACADEMY_MODEL, academyGeometry, researchPostGeometry } from '../src/render/models/academy';
import { addCity, addUnit, blankGame, fails, ok, revealAll, tile, untilTurnOf } from './helpers';
import { migrateState } from '../src/save/save';

/** Velkar (0) mit Akademie bei (2, 2), Korvat (1) mit Hauptstadt / Velkar (0) with the academy at (2, 2), Korvat (1) with a capital */
function setup(stars = 300): { s: GameState; ac: City; foe: City } {
  const s = blankGame({ factions: ['velkar', 'korvat'], stars, size: 14 });
  const ac = addCity(s, 2, 2, 0, { hq: true });
  ac.academy = true;
  const foe = addCity(s, 11, 11, 1, { hq: true });
  revealAll(s, 0);
  revealAll(s, 1);
  return { s, ac, foe };
}

/** Zuege beenden bis f am Zug ist, Ereignisse sammeln / end turns until f moves, collecting events */
function untilTurnOfEvents(s: GameState, f: number): GameEvent[] {
  const out: GameEvent[] = [];
  let guard = 0;
  do { const r = applyCommand(s, { type: 'endTurn' }); expect(r.ok).toBe(true); out.push(...r.events); } while (s.current !== f && guard++ < 20);
  return out;
}

/** Einheit bereit zum Einnehmen (stand zu Beginn des Zuges dort) / unit ready to capture (stood there at the start of the turn) */
const captureWith = (s: GameState, type: 'infantry' | 'tank', owner: number, x: number, y: number) => {
  const u = addUnit(s, type, owner, x, y);
  ok(s, { type: 'capture', unit: u.id });
  return u;
};

describe('Forschungsposten / research posts', () => {
  it('neutraler Ort: ein Feld mit Sternen und Sicht, keine Produktion; Umland und Bevoelkerung an die Akademie / neutral place: one tile with stars and vision, no production; surroundings and population to the academy', () => {
    const { s, ac } = setup();
    s.factions[0].explored = s.factions[0].explored.map(() => 0);
    const v = addCity(s, 7, 7, null);
    v.base = 'tankFactory';
    const pop = ac.pop;
    const r = captureWith(s, 'infantry', 0, 7, 7);
    expect(r).toBeTruthy();
    expect(v.owner).toBe(0);
    expect(v.post).toBe(true);
    expect(v.radius).toBe(0);
    expect(cityTiles(s, v)).toEqual([{ x: 7, y: 7 }]);
    // das Umland gehoert der Akademie / the surroundings belong to the academy
    for (const [x, y] of [[6, 6], [8, 8], [6, 8]]) expect(tile(s, x, y).territory).toBe(ac.id);
    expect(tile(s, 7, 7).territory).toBe(v.id);
    // Sterne: Stufe 1 plus Ersatz-Sterne der Produktions-Art / stars: level 1 plus the production kind's substitute stars
    expect(cityIncome(s, v)).toBe(INCOME.perCityLevel + BASES.gapStars);
    // Sicht im Umkreis ACADEMY.postVision / vision within ACADEMY.postVision
    expect(isExplored(s, 0, 7 + ACADEMY.postVision, 7)).toBe(true);
    // keine Produktion, keine Einheiten, kein Ausbau / no production, no units, no upgrade
    expect(trainCheck(s, v, 'infantry')).toBe('noTraining');
    expect(trainCheck(s, v, 'teslaTank')).toBe('noTraining');
    expect(unitLimit(s, v)).toBe(0);
    fails(s, { type: 'buyLevel', city: v.id }, 'cannotBuild');
    // Bevoelkerung fuer die Akademie, Plaetze fuer ihr Limit / population for the academy, slots for its limit
    // Stufe 1 -> 2 braucht 2 Punkte (CITY.levelUpCost) / level 1 -> 2 needs 2 points (CITY.levelUpCost)
    expect(pop).toBe(0);
    expect(ACADEMY.postPop).toBe(CITY.levelUpCost(1));
    expect(ac.level).toBe(2);
    expect(ac.pop).toBe(0);
    expect(unitLimit(s, ac)).toBe(ac.level + CITY.unitLimitExtra + ACADEMY.postUnits);
  });

  it('feindliche Stadt: Gebiet geht an die Akademie, Stufe treibt das Wachstum / hostile city: territory goes to the academy, its level drives growth', () => {
    const { s, ac } = setup();
    const town = addCity(s, 7, 2, 1, { level: 4 });
    const before = ac.level * 100 + ac.pop;
    captureWith(s, 'infantry', 0, 7, 2);
    expect(town.post).toBe(true);
    expect(town.level).toBe(1);
    for (const [x, y] of [[6, 1], [8, 3], [6, 3]]) expect(tile(s, x, y).territory).toBe(ac.id);
    // Bevoelkerung ACADEMY.postPop + postPopPerLevel x 3 = 5: Akademie steigt von Stufe 1 auf 3 (2 + 3 Punkte)
    // population ACADEMY.postPop + postPopPerLevel x 3 = 5: the academy rises from level 1 to 3 (2 + 3 points)
    const gain = ACADEMY.postPop + ACADEMY.postPopPerLevel * 3;
    expect(gain).toBe(CITY.levelUpCost(1) + CITY.levelUpCost(2));
    expect(ac.level).toBe(3);
    expect(ac.pop).toBe(0);
    expect(ac.level * 100 + ac.pop).toBeGreaterThan(before);
    // Aufstieg: Belohnung fuer die Akademie, keine fuer den Posten / level-up: reward for the academy, none for the post
    expect(s.pendingRewards.map((p) => p.cityId)).toEqual([ac.id, ac.id]);
    // die Akademie traegt das Gebiet der Posten: Felder ueberall auf der Karte / the academy holds the posts' land: tiles anywhere on the map
    expect(cityTiles(s, ac).some((p) => p.x === 8 && p.y === 3)).toBe(true);
  });

  it('Akademie bildet mehrere Einheiten je Zug auf Nachbarfeldern aus / the academy trains several units per turn onto adjacent tiles', () => {
    const { s, ac } = setup();
    for (const [x, y] of [[7, 7], [9, 2], [2, 9], [6, 11]]) { addCity(s, x, y, null); captureWith(s, 'infantry', 0, x, y); }
    for (const p of s.pendingRewards.slice()) ok(s, { type: 'reward', city: p.cityId, choice: 'b' });
    ac.works = ['trainingCamp'];
    const slots = trainSlots(s, ac);
    // mit jedem Posten mehr Einheiten auf einmal (Spielerwunsch) / more units at once with every post (player request)
    expect(slots).toBe(Math.min(ACADEMY.maxSlots, ACADEMY.baseSlots + Math.floor(4 / ACADEMY.postsPerSlot)));
    expect(slots).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < slots; i++) ok(s, { type: 'train', city: ac.id, unitType: 'infantry' });
    const fresh = s.units.filter((u) => u.owner === 0 && u.fresh);
    expect(fresh.length).toBe(slots);
    expect(fresh.every((u) => Math.max(Math.abs(u.x - ac.x), Math.abs(u.y - ac.y)) <= 1)).toBe(true);
    fails(s, { type: 'train', city: ac.id, unitType: 'infantry' }, 'occupied');
  });
});

describe('Abheben, Fliegen, Landen / lift-off, flight, landing', () => {
  it('Abheben dauert eine Runde, danach 2 Felder je Zug / lifting takes one round, then 2 tiles per turn', () => {
    const { s, ac } = setup();
    ok(s, { type: 'liftAcademy', city: ac.id });
    expect(ac.air?.phase).toBe('lifting');
    fails(s, { type: 'moveAcademy', city: ac.id, to: { x: 3, y: 3 } }, 'lifting');
    fails(s, { type: 'landAcademy', city: ac.id }, 'lifting');
    untilTurnOf(s, 0);
    expect(ac.air).toEqual({ phase: 'flying', steps: ACADEMY.move });
    expect(ACADEMY.move).toBe(2);
    // drei Felder auf einmal zu weit / three tiles at once too far
    fails(s, { type: 'moveAcademy', city: ac.id, to: { x: 5, y: 2 } }, 'outOfRange');
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 3, y: 2 } });
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 4, y: 3 } });
    expect(ac.x).toBe(4); expect(ac.y).toBe(3);
    expect(tile(s, 4, 3).cityId).toBe(ac.id);
    expect(tile(s, 2, 2).cityId).toBeNull();
    // das alte Feld bleibt Gebiet der Akademie / the old tile stays academy territory
    expect(tile(s, 2, 2).territory).toBe(ac.id);
    fails(s, { type: 'moveAcademy', city: ac.id, to: { x: 5, y: 3 } }, 'noSteps');
    expect(academyMoves(s, ac)).toEqual([]);
    // fliegt ueber Wasser / flies over water
    untilTurnOf(s, 0);
    tile(s, 6, 3).terrain = 'ocean';
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 6, y: 3 } });
    fails(s, { type: 'landAcademy', city: ac.id }, 'landingSite');
  });

  it('keine Produktion vom Abheben bis zum Zug nach der Landung / no production from lift-off until the turn after landing', () => {
    const { s, ac } = setup();
    ac.works = ['trainingCamp'];
    expect(trainCheck(s, ac, 'infantry')).toBe('ok');
    ok(s, { type: 'liftAcademy', city: ac.id });
    expect(trainCheck(s, ac, 'infantry')).toBe('academyBusy');
    fails(s, { type: 'train', city: ac.id, unitType: 'infantry' }, 'academyBusy');
    fails(s, { type: 'cityUpgrade', city: ac.id, upgrade: 'depot' }, 'academyBusy');
    fails(s, { type: 'academyShield', city: ac.id }, 'academyBusy');
    untilTurnOf(s, 0);
    expect(trainCheck(s, ac, 'infantry')).toBe('academyBusy');
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 4, y: 4 } });
    ok(s, { type: 'landAcademy', city: ac.id });
    expect(ac.air).toBeUndefined();
    // Landerunde: noch keine Produktion / landing round: no production yet
    expect(trainCheck(s, ac, 'infantry')).toBe('academyBusy');
    fails(s, { type: 'liftAcademy', city: ac.id }, 'academyBusy');
    untilTurnOf(s, 0);
    expect(trainCheck(s, ac, 'infantry')).toBe('ok');
    ok(s, { type: 'train', city: ac.id, unitType: 'infantry' });
  });

  it('Landeplatz: Land ohne Rohstoff, nicht fremdes Gebiet, Abstand zu Orten; neutrales Umland wird Gebiet / landing site: land without resource, not foreign territory, distance to places; neutral surroundings become territory', () => {
    const { s, ac, foe } = setup();
    ok(s, { type: 'liftAcademy', city: ac.id });
    untilTurnOf(s, 0);
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 4, y: 4 } });
    tile(s, 4, 4).resource = 'ore';
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(false);
    tile(s, 4, 4).resource = null;
    tile(s, 4, 4).terrain = 'mountain';
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(false);
    tile(s, 4, 4).terrain = 'plain';
    // fremdes Gebiet und Nachbarschaft eines Ortes / foreign territory and next to a place
    expect(landingOk(s, ac, { x: foe.x - 1, y: foe.y })).toBe(false);
    const v = addCity(s, 6, 5, null);
    expect(landingOk(s, ac, { x: 5, y: 5 })).toBe(false);
    expect(v.owner).toBeNull();
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(true);
    ok(s, { type: 'landAcademy', city: ac.id });
    for (const [x, y] of [[3, 3], [5, 5], [3, 5]]) expect(tile(s, x, y).territory).toBe(ac.id);
    // altes Gebiet bleibt (Flickenteppich) / old territory stays (patchwork)
    expect(tile(s, 1, 1).territory).toBe(ac.id);
  });
});

describe('Angriffe und Schutzschild / attacks and shield', () => {
  /** Akademie bei (5, 5) schwebend / academy floating at (5, 5) */
  function floating() {
    const r = setup();
    const { s, ac } = r;
    ok(s, { type: 'liftAcademy', city: ac.id });
    untilTurnOf(s, 0);
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 4, y: 4 } });
    untilTurnOf(s, 0);
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 5, y: 5 } });
    untilTurnOf(s, 1);
    return r;
  }

  it('schwebend greifen nur Flieger, Flak und Panzer an; Bodentruppen kommen nicht aufs Feld / floating: only flyers, flak and tanks attack; ground troops cannot enter the tile', () => {
    const { s, ac } = floating();
    const inf = addUnit(s, 'infantry', 1, 6, 5);
    const mg = addUnit(s, 'mg', 1, 6, 6);
    const tank = addUnit(s, 'tank', 1, 4, 5);
    const heli = addUnit(s, 'heli', 1, 5, 6);
    const aa = addUnit(s, 'antiAir', 1, 7, 5);
    expect(academyAttackCheck(s, inf, ac)).toBe('airTarget');
    expect(academyAttackCheck(s, mg, ac)).toBe('airTarget');
    fails(s, { type: 'attackAcademy', unit: inf.id, city: ac.id }, 'airTarget');
    expect(academyAttackCheck(s, tank, ac)).toBe('ok');
    expect(academyAttackCheck(s, heli, ac)).toBe('ok');
    expect(academyAttackCheck(s, aa, ac)).toBe('ok');
    expect(UNITS.antiAir.abilities).toContain('flak');
    // kein Bodentruppen-Zug auf das Feld der schwebenden Akademie, kein Einnehmen / no ground move onto the floating academy's tile, no capture
    expect(reachable(s, inf).some((p) => p.x === 5 && p.y === 5)).toBe(false);
    // ohne Schild: ein Treffer erzwingt die Notlandung / without a shield: a hit forces an emergency landing
    const r = ok(s, { type: 'attackAcademy', unit: tank.id, city: ac.id });
    expect(r.events.some((e) => e.t === 'academy' && e.what === 'forced')).toBe(true);
    expect(ac.air).toBeUndefined();
    // am Boden ohne Schild: kein Beschuss, Einnehmen wie jede Stadt / on the ground without a shield: no shooting, capture like any city
    expect(academyAttackCheck(s, heli, ac)).toBe('invalidTarget');
  });

  it('Schild faengt zuerst ab und schuetzt ohne Besatzung / the shield absorbs first and protects without a garrison', () => {
    const { s, ac } = setup();
    const before = s.factions[0].stars;
    ok(s, { type: 'academyShield', city: ac.id });
    expect(s.factions[0].stars).toBe(before - ACADEMY.shield.cost);
    expect(ac.shield).toEqual({ hp: ACADEMY.shield.hp, max: ACADEMY.shield.hp });
    fails(s, { type: 'academyShield', city: ac.id }, 'alreadyBuilt');
    // Besatzung auf der Akademie: der Schild nimmt den Schaden / garrison on the academy: the shield takes the damage
    const guard = addUnit(s, 'infantry', 0, 2, 2);
    untilTurnOf(s, 1);
    const tank = addUnit(s, 'tank', 1, 4, 2);
    const r = ok(s, { type: 'attack', unit: tank.id, target: guard.id });
    const hit = r.events.find((e): e is Extract<GameEvent, { t: 'shield' }> => e.t === 'shield' && e.what === 'hit');
    expect(hit).toBeTruthy();
    expect(guard.hp).toBe(UNITS.infantry.hp);
    expect(ac.shield!.hp).toBe(ACADEMY.shield.hp - hit!.dmg!);
    // ohne Besatzung: Einnehmen gesperrt, solange der Schild steht / without a garrison: capture blocked while the shield stands
    s.units = s.units.filter((u) => u.id !== guard.id);
    const inf = addUnit(s, 'infantry', 1, 2, 2);
    expect(captureKind(s, inf)).toBeNull();
    fails(s, { type: 'capture', unit: inf.id }, 'cannotCapture');
    // Beschuss des Schilds bis er faellt, dann ist die Akademie einnehmbar / shoot the shield until it falls, then the academy can be captured
    let guardRounds = 0;
    while (ac.shield && guardRounds++ < 20) {
      const shooter = addUnit(s, 'tank', 1, 3, 3 + (guardRounds % 2));
      if (s.units.filter((u) => u.x === shooter.x && u.y === shooter.y).length > 1) { s.units.pop(); continue; }
      ok(s, { type: 'attackAcademy', unit: shooter.id, city: ac.id });
      s.units = s.units.filter((u) => u.id !== shooter.id);
    }
    expect(ac.shield).toBeUndefined();
    expect(ac.shieldReady).toBe(s.round + ACADEMY.shield.rebuildRounds);
    expect(captureKind(s, inf)).toBe('city');
  });

  it('Schild laedt auf und wirkt auch in der Luft / the shield recharges and works in the air too', () => {
    const { s, ac } = setup();
    ok(s, { type: 'academyShield', city: ac.id });
    ac.shield!.hp = 5;
    untilTurnOf(s, 0);
    expect(ac.shield!.hp).toBe(5 + ACADEMY.shield.regen);
    ok(s, { type: 'liftAcademy', city: ac.id });
    untilTurnOf(s, 1);
    const heli = addUnit(s, 'heli', 1, 3, 3);
    const hp = ac.shield!.hp;
    ok(s, { type: 'attackAcademy', unit: heli.id, city: ac.id });
    // der Schild nimmt den Treffer, keine Notlandung / the shield takes the hit, no emergency landing
    expect(ac.shield?.hp ?? 0).toBeLessThan(hp);
    expect(ac.air).toBeTruthy();
  });
});

describe('Beamer-Relay / beam relay', () => {
  /** Akademie bei (2, 2), Posten bei (10, 3) mit Relay, Infanterie neben der Akademie / academy at (2, 2), post at (10, 3) with a relay, infantry next to the academy */
  function beamSetup() {
    const r = setup();
    const { s } = r;
    addCity(s, 10, 3, null);
    captureWith(s, 'infantry', 0, 10, 3);
    const post = s.cities.find((c) => c.post)!;
    for (const p of s.pendingRewards.slice()) ok(s, { type: 'reward', city: p.cityId, choice: 'b' });
    const before = s.factions[0].stars;
    ok(s, { type: 'buildBeamer', city: post.id });
    expect(s.factions[0].stars).toBe(before - ACADEMY.beamer.cost);
    expect(post.relay).toBe(true);
    fails(s, { type: 'buildBeamer', city: post.id }, 'alreadyBuilt');
    const u = addUnit(s, 'mg', 0, 3, 2);
    return { ...r, post, u };
  }

  it('Relay nur auf eigenen Posten / relay only on own posts', () => {
    const { s, ac } = setup();
    fails(s, { type: 'buildBeamer', city: ac.id }, 'invalidTarget');
  });

  it('Beamen dauert eine Runde, die Einheit kommt einsatzbereit am Relay an / beaming takes one round, the unit arrives ready at the relay', () => {
    const { s, post, u } = beamSetup();
    // Einheit am Posten steht im Weg: Ankunft daneben / the unit at the post is in the way: arrival next to it
    ok(s, { type: 'beam', unit: u.id, city: post.id });
    expect(s.units.some((o) => o.id === u.id)).toBe(false);
    expect(s.transit?.length).toBe(1);
    // ein Beamvorgang je Relay und Runde / one beam per relay and round
    const v = addUnit(s, 'infantry', 0, 1, 2);
    fails(s, { type: 'beam', unit: v.id, city: post.id }, 'beamUsed');
    // fern der Akademie nicht / not far from the academy
    const far = addUnit(s, 'infantry', 0, 6, 6);
    fails(s, { type: 'beam', unit: far.id, city: post.id }, 'notAtAcademy');
    untilTurnOf(s, 0);
    const back = s.units.find((o) => o.id === u.id)!;
    expect(back).toBeTruthy();
    expect(Math.max(Math.abs(back.x - post.x), Math.abs(back.y - post.y))).toBeLessThanOrEqual(1);
    expect(s.transit).toBeUndefined();
    // einsatzbereit: kann ziehen / ready: can move
    expect(back.exhausted || back.moved || back.fresh).toBe(false);
  });

  it('Relay faellt unterwegs: die Einheit kehrt zur Akademie zurueck / relay falls in transit: the unit returns to the academy', () => {
    const { s, ac, post, u } = beamSetup();
    // der Posten ist leer: die Infanterie, die ihn nahm, wird abgezogen / the post is empty: the infantry that took it is removed
    s.units = s.units.filter((o) => !(o.x === post.x && o.y === post.y));
    ok(s, { type: 'beam', unit: u.id, city: post.id });
    untilTurnOf(s, 1);
    captureWith(s, 'infantry', 1, post.x, post.y);
    expect(post.owner).toBe(1);
    expect(post.relay).toBeUndefined();
    const r = untilTurnOfEvents(s, 0);
    const back = s.units.find((o) => o.id === u.id)!;
    expect(back).toBeTruthy();
    expect(Math.max(Math.abs(back.x - ac.x), Math.abs(back.y - ac.y))).toBeLessThanOrEqual(1);
    expect(r.some((e) => e.t === 'beam' && e.what === 'return' && e.unit === u.id)).toBe(true);
  });

  it('Einheiten unterwegs bleiben im Spielstand / units in transit stay in the save', () => {
    const { s, post, u } = beamSetup();
    ok(s, { type: 'beam', unit: u.id, city: post.id });
    const loaded = migrateState(JSON.parse(JSON.stringify(s)) as GameState);
    expect(loaded.transit?.map((b) => b.unit.id)).toEqual([u.id]);
    untilTurnOf(loaded, 0);
    expect(loaded.units.some((o) => o.id === u.id)).toBe(true);
  });
});

describe('Verlust der Akademie / losing the academy', () => {
  it('ein Posten wird die neue Akademie (halbe Stufe) und erbt das ferne Gebiet / a post becomes the new academy (half the level) and inherits the distant land', () => {
    const { s, ac } = setup();
    ac.level = 6;
    addCity(s, 9, 3, null);
    captureWith(s, 'infantry', 0, 9, 3);
    const post = s.cities.find((c) => c.post)!;
    untilTurnOf(s, 1);
    captureWith(s, 'infantry', 1, 2, 2);
    expect(ac.owner).toBe(1);
    expect(ac.academy).toBeUndefined();
    expect(post.academy).toBe(true);
    expect(post.post).toBeUndefined();
    expect(post.level).toBe(3);
    expect(academyOf(s, 0)?.id).toBe(post.id);
    expect(tile(s, 8, 4).territory).toBe(post.id);
    expect(s.factions[0].alive).toBe(true);
  });
});

describe('Kampagne / campaign', () => {
  it('Kampagne behaelt die alten Regeln: keine Akademie, Eroberungen bleiben Staedte / the campaign keeps the old rules: no academy, captures stay cities', () => {
    for (const id of MISSION_IDS) {
      const s = createGame(missionConfig(id, 'velkar'));
      expect(s.cities.some((c) => c.academy || c.post), id).toBe(false);
    }
  });

  it('freie Partie: die Hauptstadt der Velkar ist die Akademie / free game: the Velkar capital is the academy', () => {
    const s = createGame(defaultConfig({ seed: 5, size: 14, mapType: 'continent', mode: 'conquest', factions: [{ id: 'velkar', human: true, difficulty: 'normal' }, { id: 'korvat', human: false, difficulty: 'normal' }], startStars: 25, roundLimit: null }));
    const ac = academyOf(s, 0)!;
    expect(ac.isHQ).toBe(true);
    expect(s.cities.filter((c) => c.academy).length).toBe(1);
  });
});

describe('KI / AI', () => {
  it('Velkar hebt ab, zieht, landet und baut den Schild; Gegner greifen die Akademie an / Velkar lifts, moves, lands and builds the shield; enemies attack the academy', () => {
    const s = createGame(defaultConfig({
      seed: 900003, size: 14, mapType: 'continent', mode: 'conquest', startStars: 25, roundLimit: null, weather: true, hazards: 'normal', events: true, hitChance: true, factionVictory: false,
      factions: (['velkar', 'korvat', 'dravon'] as const).map((id) => ({ id, human: false, difficulty: 'normal' as const })),
    }));
    const seen = new Set<string>();
    let failed = 0;
    while (!s.over && s.round <= 60 && !(seen.has('lift') && seen.has('move') && seen.has('land') && seen.has('built') && seen.has('post'))) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const r = applyCommand(s, cmd);
        if (!r.ok) failed++;
        for (const e of r.events) {
          if (e.t === 'academy') seen.add(e.what);
          if (e.t === 'shield') seen.add(e.what);
          if (e.t === 'post') seen.add('post');
        }
        if (cmd.type === 'endTurn' && r.ok) break;
      }
    }
    expect(failed).toBe(0);
    for (const k of ['post', 'lift', 'move', 'land', 'built']) expect(seen.has(k), k).toBe(true);
  }, 120_000);
});

describe('Modelle / models', () => {
  const tris = (g: { getAttribute(n: string): { count: number } }) => g.getAttribute('position').count / 3;
  it('Dreiecksbudget wie die Stadt (6000), Posten 3000 / triangle budget like the city (6000), post 3000', () => {
    for (const f of ['velkar', 'korvat', null] as const) {
      for (let lv = 1; lv <= 8; lv++) for (const air of [false, true]) expect(tris(academyGeometry(f, lv, air)), `${f} ${lv} ${air}`).toBeLessThanOrEqual(6000);
      for (const relay of [false, true]) expect(tris(researchPostGeometry(f, relay)), `${f} post ${relay}`).toBeLessThanOrEqual(3000);
    }
  });
  it('am Boden auf Beinen, in der Luft mit Duesen unter der Plattform; bleibt im Feld / on the ground on legs, in the air with nozzles below the platform; stays within the tile', () => {
    const ground = academyGeometry('velkar', 4, false), air = academyGeometry('velkar', 4, true);
    ground.computeBoundingBox(); air.computeBoundingBox();
    expect(ground.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(air.boundingBox!.min.y).toBeLessThan(-0.1);
    for (const g of [ground, air]) {
      const b = g.boundingBox!;
      expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z)).toBeLessThanOrEqual(0.5);
    }
    // die Stufe laesst den Turm wachsen / the level makes the tower grow
    const l1 = academyGeometry('velkar', 1, false), l8 = academyGeometry('velkar', 8, false);
    l1.computeBoundingBox(); l8.computeBoundingBox();
    expect(l8.boundingBox!.max.y).toBeGreaterThan(l1.boundingBox!.max.y);
    expect(ACADEMY_MODEL.airY).toBeGreaterThan(ACADEMY_MODEL.liftY);
  });
});
