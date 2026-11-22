/**
 * Schwebende Akademie der Velkar (ACADEMY): Forschungsposten, Gebiet und Wachstum fuer die Akademie, Abheben, Fliegen,
 * Landen, Produktionspause, Angriffe in der Luft, Schutzschild, Kampagne und eine KI-Partie.
 * Velkar floating academy (ACADEMY): research posts, territory and growth for the academy, lift-off, flight, landing,
 * production pause, attacks in the air, shield, campaign and an AI game.
 * Terraformen vor der Landung (ACADEMY.terraform): Zusatzrunde, Gelaende, Rohstoff, Gebaeude, Abbrechen, Notlandung,
 * Spielstand, neutrale Orte einebnen. Terraforming before landing: extra round, terrain, resource, buildings, cancel,
 * emergency landing, save, levelling neutral places.
 */
import { describe, expect, it } from 'vitest';
import {
  academyAttackCheck, academyMoves, academyOf, applyCommand, captureKind, cityIncome, cityTiles, createGame, defaultConfig, isExplored, landCheck, landingOk,
  missionConfig, MISSION_IDS, reachable, trainCheck, trainSlots, unitLimit, type City, type GameEvent, type GameState,
} from '../src/core';
import { ACADEMY, AI, BASES, CITY, INCOME, UNITS } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { ACADEMY_MODEL, academyBeacon, academyGeometry, academyPose, academyRadarGeometry, poseY, researchPostGeometry } from '../src/render/models/academy';
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

  it('keine Produktion vom Abheben bis zum Zug nach der Landung, Landen dauert eine Runde mehr / no production from lift-off until the turn after landing, landing takes one extra round', () => {
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
    // Landen startet das Terraformen: die Akademie bleibt in der Luft / landing starts terraforming: the academy stays in the air
    const r = ok(s, { type: 'landAcademy', city: ac.id });
    expect(r.events.some((e) => e.t === 'academy' && e.what === 'terraform')).toBe(true);
    expect(ac.air).toEqual({ phase: 'terraform', steps: 0 });
    expect(ACADEMY.terraform.rounds).toBe(1);
    expect(trainCheck(s, ac, 'infantry')).toBe('academyBusy');
    fails(s, { type: 'liftAcademy', city: ac.id }, 'airborne');
    // Landung zu Beginn des naechsten eigenen Zuges, Produktion erst im Zug danach / landing at the start of the next own turn, production only in the turn after
    const landRound = s.round + 1;
    const ev = untilTurnOfEvents(s, 0);
    expect(s.round).toBe(landRound);
    expect(ev.some((e) => e.t === 'academy' && e.what === 'land' && e.city === ac.id)).toBe(true);
    expect(ac.air).toBeUndefined();
    expect(trainCheck(s, ac, 'infantry')).toBe('academyBusy');
    fails(s, { type: 'liftAcademy', city: ac.id }, 'academyBusy');
    untilTurnOf(s, 0);
    expect(trainCheck(s, ac, 'infantry')).toBe('ok');
    ok(s, { type: 'train', city: ac.id, unitType: 'infantry' });
  });

  it('Landeplatz mit Terraformen: Berg, Wald und Rohstoff erlaubt; fremdes Gebiet, Meer und Abstand zu Orten mit Besitzer nicht; neutrales Umland wird Gebiet / landing site with terraforming: mountain, forest and resource allowed; foreign territory, ocean and distance to owned places not; neutral surroundings become territory', () => {
    const { s, ac, foe } = setup();
    ok(s, { type: 'liftAcademy', city: ac.id });
    untilTurnOf(s, 0);
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 4, y: 4 } });
    const t = tile(s, 4, 4);
    t.volcano = false;
    // frueher gesperrt, jetzt terraformt / blocked before, now terraformed
    t.resource = 'ore';
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(true);
    t.resource = null;
    t.terrain = 'mountain';
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(true);
    t.terrain = 'shallow';
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(true);
    // tiefes Meer und Vulkan nicht / deep ocean and volcano not
    t.terrain = 'ocean';
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(false);
    t.terrain = 'mountain'; t.volcano = true;
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(false);
    t.volcano = false; t.terrain = 'plain';
    // fremdes Gebiet und Nachbarschaft eines Orts mit Besitzer / foreign territory and next to an owned place
    expect(landingOk(s, ac, { x: foe.x - 1, y: foe.y })).toBe(false);
    const town = addCity(s, 6, 5, 1, { radius: 0 });
    expect(landingOk(s, ac, { x: 5, y: 5 })).toBe(false);
    // neutrale Orte sperren den Abstand nicht mehr / neutral places no longer block the distance
    town.owner = null;
    expect(landingOk(s, ac, { x: 5, y: 5 })).toBe(true);
    s.cities = s.cities.filter((c) => c.id !== town.id); tile(s, 6, 5).cityId = null; tile(s, 6, 5).territory = null;
    expect(landingOk(s, ac, { x: 4, y: 4 })).toBe(true);
    ok(s, { type: 'landAcademy', city: ac.id });
    untilTurnOf(s, 0);
    expect(ac.air).toBeUndefined();
    for (const [x, y] of [[3, 3], [5, 5], [3, 5]]) expect(tile(s, x, y).territory).toBe(ac.id);
    // altes Gebiet bleibt (Flickenteppich) / old territory stays (patchwork)
    expect(tile(s, 1, 1).territory).toBe(ac.id);
  });
});

describe('Terraformen vor der Landung / terraforming before landing', () => {
  /** Akademie schwebt bei (5, 5), Velkar am Zug / academy floats at (5, 5), Velkar to move */
  function hovering() {
    const r = setup();
    const { s, ac } = r;
    ok(s, { type: 'liftAcademy', city: ac.id });
    untilTurnOf(s, 0);
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 4, y: 4 } });
    untilTurnOf(s, 0);
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 5, y: 5 } });
    for (const t of s.tiles) t.volcano = false;
    return r;
  }

  it('Gelaende wird Ebene und Wiese und bleibt es nach dem Abheben; Meer nicht / terrain becomes plain grassland and stays so after lift-off; ocean not', () => {
    for (const [terrain, biome] of [['mountain', 'tundra'], ['forest', 'swamp'], ['shallow', undefined], ['plain', 'desert']] as const) {
      const { s, ac } = hovering();
      const t = tile(s, 5, 5);
      t.terrain = terrain; t.biome = biome; t.peak = terrain === 'mountain' ? 3 : undefined;
      for (const [x, y] of [[4, 5], [6, 5], [5, 4]]) tile(s, x, y).biome = 'hills';
      ok(s, { type: 'landAcademy', city: ac.id });
      // waehrend des Terraformens unveraendert / unchanged while terraforming
      expect(t.terrain).toBe(terrain);
      const ev = untilTurnOfEvents(s, 0);
      const land = ev.find((e): e is Extract<GameEvent, { t: 'academy' }> => e.t === 'academy' && e.what === 'land');
      expect(land, terrain).toBeTruthy();
      expect(t.terrain, terrain).toBe('plain');
      expect(t.biome, terrain).toBe('grassland');
      expect(t.peak).toBeUndefined();
      expect(land!.terrain).toBe(terrain === 'plain' ? undefined : terrain);
      if (biome) expect(land!.biome).toBe(biome);
      // die Spur bleibt, wenn die Akademie weiterzieht / the mark stays when the academy moves on
      untilTurnOf(s, 0);
      ok(s, { type: 'liftAcademy', city: ac.id });
      untilTurnOf(s, 0);
      ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 7, y: 7 } });
      expect(t.terrain).toBe('plain');
      expect(t.cityId).toBeNull();
    }
    const { s, ac } = hovering();
    tile(s, 5, 5).terrain = 'ocean';
    fails(s, { type: 'landAcademy', city: ac.id }, 'landingSite');
  });

  it('Rohstoff wird aufgenommen, neutrale Gebaeude und Merkmale eingeebnet; eigene Gebaeude, Geschuetze, Wunder, Aussenposten und fremde Sperren nie / resource absorbed, neutral buildings and features levelled; own buildings, guns, wonders, outposts and foreign barriers never', () => {
    {
      const { s, ac } = hovering();
      const t = tile(s, 5, 5);
      t.resource = 'farmland'; t.building = 'farm'; t.feature = 'labRuin';
      t.remains = { kind: 'wreck', unit: 'tank', faction: 1, round: 1 };
      const pop = ac.pop, level = ac.level;
      ok(s, { type: 'landAcademy', city: ac.id });
      const ev = untilTurnOfEvents(s, 0);
      const land = ev.find((e): e is Extract<GameEvent, { t: 'academy' }> => e.t === 'academy' && e.what === 'land')!;
      expect(land.resource).toBe('farmland');
      expect(land.cleared).toBe('farm');
      expect(t.resource).toBeNull();
      expect(t.building).toBeNull();
      expect(t.feature).toBeNull();
      expect(t.remains).toBeNull();
      // +resourcePop Bevoelkerung fuer die Akademie / +resourcePop population for the academy
      expect(ac.level * 100 + ac.pop).toBeGreaterThan(level * 100 + pop);
      expect(ACADEMY.terraform.resourcePop).toBe(1);
    }
    const blocked: [string, (t: ReturnType<typeof tile>, s: GameState, ac: City) => void][] = [
      ['own building', (t, _s, ac) => { t.territory = ac.id; t.building = 'farm'; }],
      ['gun', (t) => { t.turret = { hp: 10, active: false }; }],
      ['own emplacement', (t) => { t.turret = { hp: 10, active: true, owner: 0 }; }],
      ['wonder', (t) => { t.wonderOf = 99; }],
      ['temple', (t) => { t.temple = true; }],
      ['mothership', (t) => { t.feature = 'mothership'; }],
      ['outpost', (t) => { t.outpost = { owner: 0 }; }],
      ['grand project', (t, _s, ac) => { t.territory = ac.id; t.grandProject = 'academy'; }],
      ['foreign barrier', (t) => { t.barrier = { owner: 1 }; }],
      ['foreign territory', (t, s) => { t.territory = s.cities.find((c) => c.owner === 1)!.id; }],
    ];
    for (const [what, set] of blocked) {
      const { s, ac } = hovering();
      set(tile(s, 5, 5), s, ac);
      expect(landingOk(s, ac, { x: 5, y: 5 }), what).toBe(false);
      fails(s, { type: 'landAcademy', city: ac.id }, 'landingSite');
    }
    // eigene Sperre wird geraeumt, eine Strasse bleibt / own barrier is cleared, a road stays
    const { s, ac } = hovering();
    const t = tile(s, 5, 5);
    t.barrier = { owner: 0 }; t.territory = ac.id; t.building = 'road'; t.road = true;
    ok(s, { type: 'landAcademy', city: ac.id });
    untilTurnOf(s, 0);
    expect(ac.air).toBeUndefined();
    expect(t.barrier).toBeNull();
    expect(t.building).toBe('road');
  });

  it('kein Ziehen waehrend des Terraformens, schwebend angreifbar, Treffer ohne Schild erzwingt die Notlandung / no moving while terraforming, attackable as airborne, a hit without a shield forces the emergency landing', () => {
    const { s, ac } = hovering();
    untilTurnOf(s, 0);
    tile(s, 5, 5).terrain = 'mountain';
    ok(s, { type: 'landAcademy', city: ac.id });
    expect(ac.air?.steps).toBe(0);
    fails(s, { type: 'moveAcademy', city: ac.id, to: { x: 6, y: 6 } }, 'terraforming');
    fails(s, { type: 'landAcademy', city: ac.id }, 'terraforming');
    expect(academyMoves(s, ac)).toEqual([]);
    untilTurnOf(s, 1);
    const inf = addUnit(s, 'infantry', 1, 6, 5);
    const tank = addUnit(s, 'tank', 1, 4, 5);
    expect(academyAttackCheck(s, inf, ac)).toBe('airTarget');
    expect(academyAttackCheck(s, tank, ac)).toBe('ok');
    expect(reachable(s, inf).some((p) => p.x === 5 && p.y === 5)).toBe(false);
    const r = ok(s, { type: 'attackAcademy', unit: tank.id, city: ac.id });
    // Notlandung wie bisher: sofort, ohne Terraformen (der Berg bleibt) / emergency landing as before: at once, without terraforming (the mountain stays)
    expect(r.events.some((e) => e.t === 'academy' && e.what === 'forced')).toBe(true);
    expect(ac.air).toBeUndefined();
    expect(ac.x).toBe(5); expect(ac.y).toBe(5);
    expect(tile(s, 5, 5).terrain).toBe('mountain');
    // Produktion ruht bis nach dem naechsten eigenen Zug (wie bisher) / production rests until after the next own turn (as before)
    expect(ac.calm).toBe(s.round + 2);
  });

  it('mit Schild: der Schild nimmt den Treffer, das Terraformen laeuft weiter / with a shield: the shield takes the hit, terraforming continues', () => {
    const { s, ac } = setup();
    ok(s, { type: 'academyShield', city: ac.id });
    ok(s, { type: 'liftAcademy', city: ac.id });
    untilTurnOf(s, 0);
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 4, y: 4 } });
    ok(s, { type: 'landAcademy', city: ac.id });
    untilTurnOf(s, 1);
    const heli = addUnit(s, 'heli', 1, 5, 5);
    ok(s, { type: 'attackAcademy', unit: heli.id, city: ac.id });
    expect(ac.air?.phase).toBe('terraform');
    untilTurnOf(s, 0);
    expect(ac.air).toBeUndefined();
    expect(ac.x).toBe(4);
  });

  it('abbrechen: schwebt weiter ohne Felder in diesem Zug, im naechsten Zug wieder voll / cancel: keeps floating without tiles this turn, full again next turn', () => {
    const { s, ac } = hovering();
    fails(s, { type: 'cancelTerraform', city: ac.id }, 'notTerraforming');
    ok(s, { type: 'landAcademy', city: ac.id });
    const r = ok(s, { type: 'cancelTerraform', city: ac.id });
    expect(r.events.some((e) => e.t === 'academy' && e.what === 'cancel')).toBe(true);
    expect(ac.air).toEqual({ phase: 'flying', steps: 0 });
    fails(s, { type: 'moveAcademy', city: ac.id, to: { x: 6, y: 6 } }, 'noSteps');
    // gleich wieder terraformen geht / terraforming again right away works
    ok(s, { type: 'landAcademy', city: ac.id });
    ok(s, { type: 'cancelTerraform', city: ac.id });
    untilTurnOf(s, 0);
    expect(ac.air).toEqual({ phase: 'flying', steps: ACADEMY.move });
    fails(s, { type: 'cancelTerraform', city: ac.id }, 'notTerraforming');
  });

  it('Lage aendert sich: wird das Feld fremdes Gebiet, schwebt die Akademie weiter / situation changes: if the tile becomes foreign territory, the academy keeps floating', () => {
    const { s, ac, foe } = hovering();
    ok(s, { type: 'landAcademy', city: ac.id });
    untilTurnOf(s, 1);
    tile(s, 5, 5).territory = foe.id;
    const ev = untilTurnOfEvents(s, 0);
    expect(ev.some((e) => e.t === 'academy' && e.what === 'abort')).toBe(true);
    expect(ac.air).toEqual({ phase: 'flying', steps: ACADEMY.move });
    expect(tile(s, 5, 5).terrain).toBe('plain');
  });

  it('Spielstand mitten im Terraformen: nach dem Laden landet sie im naechsten Zug / save mid-terraform: after loading it lands next turn', () => {
    const { s, ac } = hovering();
    tile(s, 5, 5).terrain = 'forest';
    ok(s, { type: 'landAcademy', city: ac.id });
    const loaded = migrateState(JSON.parse(JSON.stringify(s)) as GameState);
    const lac = loaded.cities.find((c) => c.id === ac.id)!;
    expect(lac.air?.phase).toBe('terraform');
    untilTurnOf(loaded, 0);
    expect(lac.air).toBeUndefined();
    expect(loaded.tiles[5 * loaded.size + 5].terrain).toBe('plain');
  });
});

describe('Neutrale Orte einebnen / levelling neutral places', () => {
  /** Akademie schwebt bei (5, 5), neutrale Siedlung bei (6, 5) mit Gebiet, Velkar am Zug / academy floats at (5, 5), neutral settlement at (6, 5) with territory, Velkar to move */
  function nearVillage() {
    const r = setup();
    const { s, ac } = r;
    ok(s, { type: 'liftAcademy', city: ac.id });
    untilTurnOf(s, 0);
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 4, y: 4 } });
    untilTurnOf(s, 0);
    for (const t of s.tiles) t.volcano = false;
    const v = addCity(s, 6, 5, null, { level: 2 });
    for (const [x, y] of [[7, 5], [7, 6], [6, 6]]) tile(s, x, y).territory = v.id;
    tile(s, 6, 5).territory = v.id;
    ok(s, { type: 'moveAcademy', city: ac.id, to: { x: 5, y: 5 } });
    return { ...r, v };
  }

  it('Einebnen: der Ort verschwindet, sein Gebiet wird Akademie-Gebiet, keine Belohnung; Namen der anderen Orte bleiben / levelling: the place vanishes, its territory becomes academy territory, no reward; the other places keep their names', async () => {
    const { s, ac, v, foe } = nearVillage();
    const other = addCity(s, 10, 2, null);
    const { cityNameOf } = await import('../src/i18n/cityNames');
    const before = [cityNameOf(s, other.id), cityNameOf(s, foe.id), cityNameOf(s, ac.id)];
    // nur benachbart und nur mit Ort auf dem Feld / only adjacent and only with a place on the tile
    fails(s, { type: 'landAcademy', city: ac.id, at: { x: 7, y: 5 } }, 'outOfRange');
    fails(s, { type: 'landAcademy', city: ac.id, at: { x: 6, y: 6 } }, 'invalidTile');
    const stars = s.factions[0].stars;
    ok(s, { type: 'landAcademy', city: ac.id, at: { x: 6, y: 5 } });
    expect(ac.air).toEqual({ phase: 'terraform', steps: 0, at: { x: 6, y: 5 } });
    expect(v.owner).toBeNull();
    const ev = untilTurnOfEvents(s, 0);
    const land = ev.find((e): e is Extract<GameEvent, { t: 'academy' }> => e.t === 'academy' && e.what === 'land')!;
    expect(land.razed).toBe('village');
    expect(land.from).toEqual({ x: 5, y: 5 });
    expect(s.cities.some((c) => c.id === v.id)).toBe(false);
    expect(ac.x).toBe(6); expect(ac.y).toBe(5);
    expect(tile(s, 6, 5).cityId).toBe(ac.id);
    expect(tile(s, 5, 5).cityId).toBeNull();
    for (const [x, y] of [[7, 5], [7, 6], [6, 6]]) expect(tile(s, x, y).territory).toBe(ac.id);
    expect(s.tiles.some((t) => t.territory === v.id || t.cityId === v.id)).toBe(false);
    // keine Eroberung: kein Posten, keine Belohnung, keine Sterne / no capture: no post, no reward, no stars
    expect(s.cities.some((c) => c.post)).toBe(false);
    expect(s.pendingRewards).toEqual([]);
    expect(s.factions[0].stars).toBeGreaterThanOrEqual(stars);
    expect(ev.some((e) => e.t === 'capture' || e.t === 'post')).toBe(false);
    expect([cityNameOf(s, other.id), cityNameOf(s, foe.id), cityNameOf(s, ac.id)]).toEqual(before);
    // Spielstand / save
    const loaded = migrateState(JSON.parse(JSON.stringify(s)) as GameState);
    expect(loaded.cities.some((c) => c.id === v.id)).toBe(false);
    expect(loaded.razed?.map((c) => c.id)).toEqual([v.id]);
  });

  it('neutraler Stuetzpunkt wird eingeebnet, Spielstand mitten im Einebnen / a neutral base is levelled, save mid-levelling', () => {
    const { s, ac, v } = nearVillage();
    v.base = 'tankFactory';
    ok(s, { type: 'landAcademy', city: ac.id, at: { x: 6, y: 5 } });
    const loaded = migrateState(JSON.parse(JSON.stringify(s)) as GameState);
    const ev = untilTurnOfEvents(loaded, 0);
    expect(ev.some((e) => e.t === 'academy' && e.what === 'land' && e.razed === 'base')).toBe(true);
    expect(loaded.cities.some((c) => c.id === v.id)).toBe(false);
    expect(loaded.cities.find((c) => c.id === ac.id)!.x).toBe(6);
  });

  it('Besitz einer Fraktion nie: eigene und fremde Orte, Posten, Hauptquartiere / never anything owned: own and foreign places, posts, headquarters', () => {
    const { s, ac, v } = nearVillage();
    v.owner = 1;
    expect(landCheck(s, 0, ac, { x: 6, y: 5 })).toBe('landingSite');
    v.owner = 0; v.post = true;
    expect(landCheck(s, 0, ac, { x: 6, y: 5 })).toBe('landingSite');
    v.owner = null; v.post = undefined; v.isHQ = true;
    expect(landCheck(s, 0, ac, { x: 6, y: 5 })).toBe('landingSite');
    v.isHQ = false;
    expect(landCheck(s, 0, ac, { x: 6, y: 5 })).toBe('ok');
    // fremde Einheit im Ort / foreign unit in the place
    const u = addUnit(s, 'infantry', 1, 6, 5);
    expect(landCheck(s, 0, ac, { x: 6, y: 5 })).toBe('landingSite');
    s.units = s.units.filter((o) => o.id !== u.id);
    // Abstand zu Orten mit Besitzer gilt weiter / the distance to owned places still applies
    addCity(s, 7, 4, 1, { radius: 0 });
    expect(landCheck(s, 0, ac, { x: 6, y: 5 })).toBe('landingSite');
  });

  it('Ort wird waehrend des Terraformens eingenommen: Landung bricht ab / place captured while terraforming: the landing is aborted', () => {
    const { s, ac, v } = nearVillage();
    ok(s, { type: 'landAcademy', city: ac.id, at: { x: 6, y: 5 } });
    untilTurnOf(s, 1);
    const u = addUnit(s, 'infantry', 1, 6, 5);
    ok(s, { type: 'capture', unit: u.id });
    expect(v.owner).toBe(1);
    const ev = untilTurnOfEvents(s, 0);
    expect(ev.some((e) => e.t === 'academy' && e.what === 'abort')).toBe(true);
    expect(s.cities.some((c) => c.id === v.id)).toBe(true);
    expect(ac.air?.phase).toBe('flying');
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
    for (const k of ['post', 'lift', 'move', 'terraform', 'land', 'built']) expect(seen.has(k), k).toBe(true);
  }, 120_000);
});

describe('Modelle / models', () => {
  const tris = (g: { getAttribute(n: string): { count: number } }) => g.getAttribute('position').count / 3;
  const POSES = ['ground', 'lift', 'air', 'terraform'] as const;
  /**
   * Dreiecksbudget: hoch 5650 (gemessen 5354 plus Luft, vorher 1656), niedrig 3650 (gemessen 3466), Radarantenne 200
   * (gemessen 154); alles unter der Stadtgrenze 6000. Posten 3000.
   * Triangle budget: high 5650 (measured 5354 plus headroom, before 1656), low 3650 (measured 3466), radar array 200
   * (measured 154); all below the city limit 6000. Post 3000.
   */
  it('Dreiecksbudget je Haltung und Qualitaet, unter der Stadtgrenze (6000), Posten 3000 / triangle budget per pose and quality, below the city limit (6000), post 3000', () => {
    const radar = tris(academyRadarGeometry());
    expect(radar).toBeLessThanOrEqual(200);
    for (const f of ['velkar', 'korvat', null] as const) {
      for (let lv = 1; lv <= 8; lv++) for (const p of POSES) {
        const hi = tris(academyGeometry(f, lv, p)), lo = tris(academyGeometry(f, lv, p, true));
        expect(hi, `${f} ${lv} ${p}`).toBeLessThanOrEqual(5650);
        expect(hi + radar, `${f} ${lv} ${p} + radar`).toBeLessThanOrEqual(6000);
        expect(lo, `${f} ${lv} ${p} low`).toBeLessThanOrEqual(3650);
        expect(lo, `${f} ${lv} ${p} low < high`).toBeLessThan(hi);
      }
      // alte Schreibweise (true = schwebend) bleibt gleichwertig / the old form (true = floating) stays equivalent
      expect(academyGeometry(f, 4, true)).toBe(academyGeometry(f, 4, 'air'));
      expect(academyGeometry(f, 4, false)).toBe(academyGeometry(f, 4, 'ground'));
      for (const relay of [false, true]) expect(tris(researchPostGeometry(f, relay)), `${f} post ${relay}`).toBeLessThanOrEqual(3000);
    }
  });
  it('am Boden auf weit ausgefahrenen Beinen, in der Luft mit Duesen unter der Plattform; bleibt im Feld / on the ground on far extended legs, in the air with nozzles below the platform; stays within the tile', () => {
    const box = (p: typeof POSES[number], lv = 4) => { const g = academyGeometry('velkar', lv, p); g.computeBoundingBox(); return g.boundingBox!; };
    expect(box('ground').min.y).toBeGreaterThanOrEqual(-0.001);
    for (const p of ['lift', 'air', 'terraform'] as const) expect(box(p).min.y, p).toBeLessThan(-0.1);
    for (const p of POSES) {
      const b = box(p);
      expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z), p).toBeLessThanOrEqual(0.5);
    }
    // Beine gut sichtbar: Rumpfunterkante deutlich ueber dem Boden, Fuesse am Boden / legs clearly visible: hull bottom well above the ground, feet on the ground
    expect(ACADEMY_MODEL.legs - ACADEMY_MODEL.hull).toBeGreaterThanOrEqual(0.1);
    const pos = academyGeometry('velkar', 4, 'ground').getAttribute('position');
    let feet = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.04 && Math.hypot(pos.getX(i), pos.getZ(i)) > 0.3) feet++;
    expect(feet).toBeGreaterThan(0);
    // die Stufe laesst den Turm wachsen / the level makes the tower grow
    expect(box('ground', 8).max.y).toBeGreaterThan(box('ground', 1).max.y);
    expect(ACADEMY_MODEL.airY).toBeGreaterThan(ACADEMY_MODEL.terraformY);
    expect(ACADEMY_MODEL.terraformY).toBeGreaterThan(ACADEMY_MODEL.liftY);
    // Haltungen aus dem Zustand, Schwebehoehe je Haltung / poses from the state, hover height per pose
    expect(academyPose(undefined)).toBe('ground');
    expect(academyPose({ phase: 'lifting' })).toBe('lift');
    expect(academyPose({ phase: 'flying' })).toBe('air');
    expect(academyPose({ phase: 'terraform' })).toBe('terraform');
    expect(poseY('ground')).toBe(0);
    // Leuchtfeuer sitzt ueber der Tesla-Spitze und steigt mit der Schwebehoehe / the beacon sits above the tesla tip and rises with the hover height
    const top = box('air').max.y;
    const [, by] = academyBeacon(4, ACADEMY_MODEL.airY, 'air');
    expect(by).toBeGreaterThan(ACADEMY_MODEL.airY);
    expect(by).toBeLessThanOrEqual(ACADEMY_MODEL.airY + (top + 0.1) * ACADEMY_MODEL.scale);
  });
});
