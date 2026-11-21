/**
 * Hacken der NEXUS (HACK): Fernuebernahme neutraler Orte (Ladungen je Rechenzentrum), Stadt-Hack (aufdecken), Hackturm
 * (mechanisierte Einheiten fuer zwei Zuege uebernehmen, mit Wurf am Ende: zurueck, dauerhaft uebernommen, abgeschaltet),
 * Randfaelle, Spielstaende, Kampagne und ein KI-Zug.
 * NEXUS hacking (HACK): remote takeover of neutral places (charges per data centre), city hack (reveal), hack tower (take
 * over mechanised units for two turns, with a roll at the end: returned, permanently taken over, shut down), edge cases,
 * saves, campaign and an AI turn.
 */
import { afterAll, describe, expect, it } from 'vitest';
import {
  MISSION_IDS, applyCommand, canSeeUnit, cityHackRoundsLeft, cityHackWait, cloneState, createGame, hackCapacity, hackCharges, hackCheck, hackCost,
  hackTowerCheck, hacksOn, hijackCheck, hijackOutcome, hijackRoundsLeft, hijackTargets, isExplored, isMechanised, missionConfig, paidUnits, reachable,
  supportedUnits, towerLink, towerWait, type GameState,
} from '../src/core';
import { nextRandom } from '../src/core/rng';
import { HACK, UNITS } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { isValidState, migrateState } from '../src/save/save';
import { setLanguage } from '../src/i18n/i18n';
import { cityHackHtml } from '../src/ui/hacking';
import { hackTowerGeometry } from '../src/render/models/hacking';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, tile, unit, untilTurnOf } from './helpers';

/** NEXUS (0) gegen Korvat (1); NEXUS-Hauptquartier mit Rechenzentren, Runde ab firstRound / NEXUS (0) against Korvat (1) */
function duel(o: { dc?: number; stars?: number; reveal?: boolean; third?: boolean } = {}) {
  const s = blankGame({ factions: o.third ? ['nexus', 'korvat', 'dravon'] : ['nexus', 'korvat'], stars: o.stars ?? 400, size: 16 });
  if (o.third) addCity(s, 3, 13, 2, { hq: true, radius: 1 });
  s.round = HACK.place.firstRound;
  const hq = addCity(s, 3, 3, 0, { hq: true, radius: 2 });
  const foe = addCity(s, 12, 12, 1, { hq: true, radius: 2 });
  const spots = [[2, 2], [4, 2], [2, 4], [4, 4]];
  for (let i = 0; i < (o.dc ?? 1); i++) tile(s, spots[i][0], spots[i][1]).building = 'dataCenter';
  if (o.reveal !== false) { revealAll(s, 0); revealAll(s, 1); }
  return { s, hq, foe };
}

/** Zufallsstand suchen, bei dem der naechste Wurf den gewuenschten Ausgang ergibt / find an RNG state whose next roll gives the wanted outcome */
function forceOutcome(s: GameState, want: 'kept' | 'shutdown' | 'returned') {
  for (let r = 1; r < 100000; r++) {
    if (hijackOutcome(nextRandom({ rng: r })) === want) { s.rng = r; return; }
  }
  throw new Error('no rng');
}

/** Turm auf (6, 3) im NEXUS-Gebiet (Stadtradius 2 reicht bis x = 5: Gebiet erweitern) / tower at (6, 3) */
function withTower(s: GameState, x = 5, y = 3) {
  ok(s, { type: 'hackTower', x, y });
  return { x, y };
}

describe('Fernuebernahme neutraler Orte / remote takeover of neutral places', () => {
  it('nur neutrale, aufgedeckte Orte; feindliche Staedte nie / only neutral, explored places; never enemy cities', () => {
    const { s, foe } = duel({ reveal: false });
    const v = addCity(s, 8, 8, null);
    fails(s, { type: 'hack', city: v.id }, 'notVisible');
    s.factions[0].explored[8 * s.size + 8] = 1;
    expect(hackCheck(s, 0, v)).toBe('ok');
    s.factions[0].explored[foe.y * s.size + foe.x] = 1;
    fails(s, { type: 'hack', city: foe.id }, 'invalidTarget');
    // fremde Einheit auf dem Ort sperrt / a foreign unit on the place blocks
    const k = addUnit(s, 'infantry', 1, 8, 8);
    fails(s, { type: 'hack', city: v.id }, 'occupied');
    s.units = s.units.filter((u) => u.id !== k.id);
    // andere Fraktionen hacken nicht / other factions do not hack
    s.current = 1;
    fails(s, { type: 'hack', city: v.id }, 'wrongFaction');
  });

  it('gehackter Ort verhaelt sich wie ein eingenommener / a hacked place behaves like a captured one', () => {
    const { s } = duel();
    const v = addCity(s, 8, 8, null);
    v.base = 'supplyDepot';
    const stars = s.factions[0].stars;
    const r = ok(s, { type: 'hack', city: v.id });
    expect(v.owner).toBe(0);
    expect(v.level).toBe(1);
    expect(v.base).toBe('supplyDepot');
    expect(tile(s, 8, 8).territory).toBe(v.id);
    expect(tile(s, 9, 9).territory).toBe(v.id);
    expect(s.factions[0].stars).toBe(stars - HACK.place.cost);
    expect(r.events.some((e) => e.t === 'capture' && e.hack && e.city === v.id && e.from === null)).toBe(true);
  });

  it('Ladungen folgen der Zahl der Rechenzentren und laden nach / charges follow the data-centre count and recharge', () => {
    const { s } = duel({ dc: 2 });
    expect(hackCapacity(s, 0)).toBe(2);
    expect(hackCharges(s, 0)).toBe(2);
    const vs = [addCity(s, 8, 8, null), addCity(s, 8, 13, null), addCity(s, 13, 3, null)];
    ok(s, { type: 'hack', city: vs[0].id });
    // hoechstens ein Hack je Zug / at most one hack per turn
    fails(s, { type: 'hack', city: vs[1].id }, 'hackTurn');
    untilTurnOf(s, 0);
    expect(hackCharges(s, 0)).toBe(1);
    // Preis steigt mit jedem gehackten Ort / the price rises with every hacked place
    expect(hackCost(s, 0, vs[1])).toBe(HACK.place.cost + HACK.place.perHacked);
    ok(s, { type: 'hack', city: vs[1].id });
    untilTurnOf(s, 0);
    expect(hackCharges(s, 0)).toBe(0);
    fails(s, { type: 'hack', city: vs[2].id }, 'hackCharges');
    // ein drittes Rechenzentrum gibt sofort eine Ladung / a third data centre gives a charge at once
    tile(s, 2, 4).building = 'dataCenter';
    expect(hackCharges(s, 0)).toBe(1);
    tile(s, 2, 4).building = null;
    // nach recharge Runden ist die erste Ladung wieder da / after recharge rounds the first charge is back
    while (s.round < HACK.place.firstRound + HACK.place.recharge) untilTurnOf(s, 0);
    expect(hackCharges(s, 0)).toBe(1);
    ok(s, { type: 'hack', city: vs[2].id });
  });

  it('ohne Rechenzentrum und vor firstRound kein Hack / no hack without a data centre and before firstRound', () => {
    const { s } = duel({ dc: 0 });
    const v = addCity(s, 8, 8, null);
    fails(s, { type: 'hack', city: v.id }, 'hackCharges');
    tile(s, 2, 2).building = 'dataCenter';
    s.round = HACK.place.firstRound - 1;
    fails(s, { type: 'hack', city: v.id }, 'hackEarly');
  });
});

describe('Stadt-Hack / city hack', () => {
  it('deckt eine aufgedeckte, nicht sichtbare feindliche Stadt auf: Radius, Dauer, Sperre / reveals an explored, not visible enemy city: radius, duration, lock', () => {
    const { s, foe } = duel({ reveal: false });
    // nur das Stadtfeld ist bekannt / only the city tile is known
    s.factions[0].explored[foe.y * s.size + foe.x] = 1;
    const spy = addUnit(s, 'spy', 1, 13, 13);
    const tankFar = addUnit(s, 'tank', 1, 12, 6);
    expect(canSeeUnit(s, 0, spy)).toBe(false);
    const stars = s.factions[0].stars;
    ok(s, { type: 'hackCity', city: foe.id });
    expect(s.factions[0].stars).toBe(stars - HACK.city.cost);
    const r = foe.radius + HACK.city.radius;
    expect(isExplored(s, 0, foe.x - r, foe.y)).toBe(true);
    expect(isExplored(s, 0, foe.x - r - 1, foe.y)).toBe(false);
    // Sichtung zeigt auch Verdeckte im Umkreis / the sighting shows hidden units in the radius too
    expect(canSeeUnit(s, 0, spy)).toBe(true);
    expect(canSeeUnit(s, 0, tankFar)).toBe(false);
    expect(cityHackRoundsLeft(s, foe)).toBe(HACK.city.rounds);
    fails(s, { type: 'hackCity', city: foe.id }, 'cityHackCooldown');
    // nach rounds Runden vorbei / over after rounds rounds
    for (let i = 0; i < HACK.city.rounds; i++) untilTurnOf(s, 0);
    expect(cityHackRoundsLeft(s, foe)).toBe(0);
    expect(canSeeUnit(s, 0, spy)).toBe(false);
    expect(cityHackWait(s, 0)).toBe(Math.max(0, HACK.city.cooldown - HACK.city.rounds));
  });

  it('Daten nur fuer den Hacker, Marke auch fuer den Besitzer; Frieden und fehlendes Rechenzentrum sperren / data for the hacker only, mark for the owner too; peace and no data centre block', () => {
    setLanguage('en');
    const { s, foe } = duel();
    addUnit(s, 'tank', 1, 12, 13, { homeCity: foe.id });
    s.factions[1].stars = 123;
    ok(s, { type: 'hackCity', city: foe.id });
    const mine = cityHackHtml(s, foe, 0);
    expect(mine).toContain('123');
    expect(mine).toContain('Tank');
    const theirs = cityHackHtml(s, foe, 1);
    expect(theirs).toContain('NEXUS');
    expect(theirs).not.toContain('123');
    const b = duel({ dc: 0 });
    fails(b.s, { type: 'hackCity', city: b.foe.id }, 'noDataCenter');
    const c = duel();
    c.s.factions[0].relations[1] = 'peace'; c.s.factions[1].relations[0] = 'peace';
    fails(c.s, { type: 'hackCity', city: c.foe.id }, 'peace');
  });
});
afterAll(() => setLanguage('de'));

describe('Hackturm: Bau / hack tower: construction', () => {
  it('nur im eigenen Gebiet, Limit je Stadt, Abstand, Preis; feuert nie / own territory only, limit per city, spacing, price; never fires', () => {
    const { s } = duel({ stars: 60 });
    expect(hackTowerCheck(s, 0, 9, 9)).toBe('notInTerritory');
    expect(hackTowerCheck(s, 0, 3, 3)).toBe('invalidTile');
    ok(s, { type: 'hackTower', x: 5, y: 3 });
    expect(tile(s, 5, 3).turret).toMatchObject({ kind: 'hack', owner: 0, hp: HACK.tower.hp });
    expect(s.factions[0].stars).toBe(60 - HACK.tower.cost);
    // eine Stadt: Limit 1 / one city: limit 1
    expect(hackTowerCheck(s, 0, 1, 5)).toBe('emplacementLimit');
    addCity(s, 3, 9, 0, { radius: 2 });
    expect(hackTowerCheck(s, 0, 4, 5)).toBe('emplacementSpacing');
    s.factions[0].stars = 0;
    expect(hackTowerCheck(s, 0, 1, 9)).toBe('notEnoughStars');
    // ein feindlicher Panzer daneben wird nie beschossen / a hostile tank next to it is never shot at
    const t = addUnit(s, 'tank', 1, 6, 3);
    untilTurnOf(s, 0);
    expect(t.hp).toBe(UNITS.tank.hp);
  });

  it('Modell: Dreiecke im Rahmen, verbunden mit Signalringen / model: triangles within budget, linked with signal rings', () => {
    const a = hackTowerGeometry('nexus', false), b = hackTowerGeometry('nexus', true);
    const tris = (g: { getAttribute(n: string): { count: number } }) => g.getAttribute('position').count / 3;
    expect(tris(a)).toBeGreaterThan(100);
    expect(tris(a)).toBeLessThan(3000);
    expect(tris(b)).toBeGreaterThan(tris(a));
    expect(tris(b)).toBeLessThan(3000);
  });
});

describe('Hackturm: Uebernahme / hack tower: takeover', () => {
  it('Reichweite 4, nur mechanisierte, sichtbare Feinde / reach 4, only mechanised, visible enemies', () => {
    const { s } = duel();
    const tw = withTower(s);
    const near = addUnit(s, 'tank', 1, tw.x + HACK.tower.reach, tw.y);
    const far = addUnit(s, 'tank', 1, tw.x + HACK.tower.reach + 1, tw.y);
    const inf = addUnit(s, 'infantry', 1, tw.x + 2, tw.y + 1);
    const heli = addUnit(s, 'heli', 1, tw.x + 1, tw.y + 2);
    const ship = addUnit(s, 'destroyer', 1, tw.x + 2, tw.y + 3);
    const ids = hijackTargets(s, 0, tw.x, tw.y).map((u) => u.id);
    expect(ids).toContain(near.id);
    expect(ids).toContain(heli.id);
    expect(ids).not.toContain(far.id);
    expect(ids).not.toContain(inf.id);
    expect(ids).not.toContain(ship.id);
    expect(hijackCheck(s, 0, tw.x, tw.y, far)).toBe('outOfRange');
    expect(hijackCheck(s, 0, tw.x, tw.y, inf)).toBe('notMechanised');
    expect(hijackCheck(s, 0, tw.x, tw.y, ship)).toBe('notMechanised');
    for (const t of ['guidedMissile', 'coreDrill', 'swarmMother', 'kamikazeDrone', 'landingBoat'] as const) expect(isMechanised(t), t).toBe(false);
    for (const t of ['tank', 'jeep', 'heli', 'mech', 'steppeColossus', 'radarTruck', 'artillery'] as const) expect(isMechanised(t), t).toBe(true);
    // unter den Wolken nicht sichtbar / not visible under the clouds
    s.factions[0].explored[near.y * s.size + near.x] = 0;
    expect(hijackCheck(s, 0, tw.x, tw.y, near)).toBe('notVisible');
    // Einheit in einer Stadt nicht / not a unit in a city
    const c = addCity(s, tw.x + 3, tw.y + 3, 1, { radius: 1 });
    const garrison = addUnit(s, 'tank', 1, c.x, c.y);
    expect(hijackCheck(s, 0, tw.x, tw.y, garrison)).toBe('invalidTarget');
  });

  it('genau zwei Zuege Steuerung, dann zurueck mit den LP, erschoepft; eine Einheit je Turm / exactly two turns of control, then back with its HP, exhausted; one unit per tower', () => {
    const { s, hq } = duel();
    const tw = withTower(s);
    const home = addCity(s, 12, 3, 1, { radius: 1 });
    const tank = addUnit(s, 'tank', 1, 8, 3, { homeCity: home.id });
    const tank2 = addUnit(s, 'tank', 1, 8, 5);
    const victim = addUnit(s, 'infantry', 1, 9, 2);
    const village = addCity(s, 10, 4, null);
    const start = s.round;
    const r = ok(s, { type: 'hijack', x: tw.x, y: tw.y, target: tank.id });
    expect(r.events.some((e) => e.t === 'hijack' && e.unit === tank.id && e.from === 1 && e.until === start + 1)).toBe(true);
    expect(tank.owner).toBe(0);
    expect(hijackRoundsLeft(s, tank)).toBe(2);
    expect(towerLink(s, tw.x, tw.y)?.id).toBe(tank.id);
    // eine Einheit je Turm / one unit per tower
    fails(s, { type: 'hijack', x: tw.x, y: tw.y, target: tank2.id }, 'towerBusy');
    // sofort handlungsfaehig: Angriff auf die eigene fruehere Seite / ready at once: attack on its former side
    ok(s, { type: 'attack', unit: tank.id, target: victim.id });
    // kein Sold fuer niemanden, Platz der Heimatstadt bleibt belegt / no upkeep for anyone, the home city's slot stays taken
    expect(paidUnits(s, 0).some((u) => u.id === tank.id)).toBe(false);
    expect(paidUnits(s, 1).some((u) => u.id === tank.id)).toBe(false);
    expect(supportedUnits(s, home)).toBe(1);
    // keine Stadt betreten, nicht einnehmen / enter no city, capture nothing
    expect(reachable(s, tank, true).some((p) => p.x === village.x && p.y === village.y)).toBe(false);
    expect(reachable(s, tank, true).some((p) => p.x === 9 && p.y === 4)).toBe(true);
    void hq;
    fails(s, { type: 'capture', unit: tank.id }, 'hijacked');
    fails(s, { type: 'upgrade', unit: tank.id, to: 'destroyer' }, 'hijacked');
    const hp = tank.hp;
    forceOutcome(s, 'returned');
    endTurn(s);
    // Korvat-Zug: die Einheit gehoert weiter NEXUS / Korvat's turn: the unit still belongs to NEXUS
    expect(s.current).toBe(1);
    expect(tank.owner).toBe(0);
    fails(s, { type: 'move', unit: tank.id, to: { x: 8, y: 4 } }, 'notYourUnit');
    endTurn(s);
    expect(hijackRoundsLeft(s, tank)).toBe(1);
    forceOutcome(s, 'returned');
    const end = endTurn(s);
    const ev = end.events.find((e) => e.t === 'hijackEnd');
    expect(ev).toMatchObject({ unit: tank.id, faction: 1, by: 0, reason: 'time' });
    expect(ev && 'outcome' in ev ? ev.outcome : undefined).toBeUndefined();
    expect(tank.owner).toBe(1);
    expect(tank.hijack).toBeUndefined();
    expect(tank.hp).toBe(hp);
    expect(towerLink(s, tw.x, tw.y)).toBeNull();
    // Turm laedt ab der Uebernahme / the tower recharges from the takeover
    expect(towerWait(s, tw.x, tw.y)).toBe(Math.max(0, start + HACK.tower.cooldown - s.round));
  });

  it('Wurf am Ende: dauerhaft uebernommen oder abgeschaltet, deterministisch / roll at the end: permanently taken over or shut down, deterministic', () => {
    for (const want of ['kept', 'shutdown'] as const) {
      const { s, hq } = duel();
      const tw = withTower(s);
      const tank = addUnit(s, 'tank', 1, 8, 3);
      ok(s, { type: 'hijack', x: tw.x, y: tw.y, target: tank.id });
      endTurn(s); endTurn(s);
      forceOutcome(s, want);
      const end = endTurn(s);
      const ev = end.events.find((e) => e.t === 'hijackEnd');
      expect(ev).toMatchObject({ unit: tank.id, outcome: want, reason: 'time' });
      if (want === 'kept') {
        // gewoehnliche NEXUS-Einheit: Heimatstadt, Sold, Limit / ordinary NEXUS unit: home city, upkeep, limit
        expect(tank.owner).toBe(0);
        expect(tank.hijack).toBeUndefined();
        expect(tank.homeCity).toBe(hq.id);
        expect(supportedUnits(s, hq)).toBe(1);
        expect(s.factions[0].kills).toBe(0);
      } else {
        expect(unit(s, tank.id)).toBeUndefined();
        expect(tile(s, 8, 3).remains?.kind).toBe('wreck');
        expect(end.events.some((e) => e.t === 'killed' && e.unit === tank.id && e.by === null)).toBe(true);
        expect(s.factions[0].kills).toBe(0);
      }
    }
    // gleicher Zustand, gleicher Ausgang / same state, same outcome
    expect(hijackOutcome(0.05)).toBe('kept');
    expect(hijackOutcome(HACK.tower.keepChance + 0.01)).toBe('shutdown');
    expect(hijackOutcome(0.99)).toBe('returned');
  });

  it('Turm zerstoert: Einheit sofort zurueck; Einheit faellt: Turm wieder frei nach der Sperre / tower destroyed: unit back at once; unit falls: tower free after the lock', () => {
    const { s } = duel();
    const tw = withTower(s);
    const tank = addUnit(s, 'tank', 1, 8, 3);
    ok(s, { type: 'hijack', x: tw.x, y: tw.y, target: tank.id });
    endTurn(s);
    // Korvat zerstoert den Turm mit einer Artillerie / Korvat destroys the tower with artillery
    tile(s, tw.x, tw.y).turret!.hp = 1;
    const art = addUnit(s, 'artillery', 1, tw.x + 2, tw.y);
    const r = ok(s, { type: 'attackTurret', unit: art.id, x: tw.x, y: tw.y });
    expect(tile(s, tw.x, tw.y).turret).toBeNull();
    expect(r.events.some((e) => e.t === 'hijackEnd' && e.unit === tank.id && e.reason === 'tower')).toBe(true);
    expect(tank.owner).toBe(1);
    expect(tank.exhausted).toBe(true);

    const b = duel();
    const tb = withTower(b.s);
    const heli = addUnit(b.s, 'heli', 1, 8, 3);
    ok(b.s, { type: 'hijack', x: tb.x, y: tb.y, target: heli.id });
    heli.hp = 1;
    const foeTank = addUnit(b.s, 'tank', 1, 9, 3);
    endTurn(b.s);
    ok(b.s, { type: 'attack', unit: foeTank.id, target: heli.id });
    expect(unit(b.s, heli.id)).toBeUndefined();
    expect(towerLink(b.s, tb.x, tb.y)).toBeNull();
    expect(tile(b.s, tb.x, tb.y).turret?.link).toBeUndefined();
    // Verlust zaehlt fuer den eigentlichen Besitzer / the loss counts for the actual owner
    expect(b.s.history?.losses[1] ?? 0).toBeGreaterThan(0);
  });

  it('Spielstand mitten in der Uebernahme: laden, weiterspielen, Rueckgabe / save in the middle of the takeover: load, play on, return', () => {
    const { s } = duel();
    const tw = withTower(s);
    const tank = addUnit(s, 'tank', 1, 8, 3);
    ok(s, { type: 'hijack', x: tw.x, y: tw.y, target: tank.id });
    endTurn(s);
    const loaded = migrateState(JSON.parse(JSON.stringify(s)));
    expect(isValidState(loaded)).toBe(true);
    const lt = unit(loaded, tank.id)!;
    expect(lt.hijack).toEqual(tank.hijack);
    expect(towerLink(loaded, tw.x, tw.y)?.id).toBe(tank.id);
    endTurn(loaded);
    forceOutcome(loaded, 'returned');
    endTurn(loaded);
    expect(unit(loaded, tank.id)!.owner).toBe(1);
    // gleiche Befehle, gleiches Ergebnis (deterministisch) / same commands, same result (deterministic)
    const copy = cloneState(s);
    endTurn(copy); forceOutcome(copy, 'returned'); endTurn(copy);
    expect(unit(copy, tank.id)!.owner).toBe(1);
  });

  it('Hacker scheidet aus: Einheit kehrt zurueck; Besitzer scheidet aus: Einheit zerfaellt / hacker eliminated: unit returns; owner eliminated: unit falls apart', () => {
    const { s, hq } = duel();
    const tw = withTower(s);
    const tank = addUnit(s, 'tank', 1, 8, 3);
    ok(s, { type: 'hijack', x: tw.x, y: tw.y, target: tank.id });
    // Korvat nimmt das NEXUS-Hauptquartier ein / Korvat takes the NEXUS HQ
    endTurn(s);
    const inf = addUnit(s, 'infantry', 1, hq.x, hq.y);
    inf.startX = hq.x; inf.startY = hq.y;
    ok(s, { type: 'capture', unit: inf.id });
    expect(s.factions[0].alive).toBe(false);
    expect(unit(s, tank.id)?.owner).toBe(1);

    // drei Fraktionen: NEXUS nimmt die letzte Korvat-Stadt, die uebernommene Einheit zerfaellt am Ende der Uebernahme
    // three factions: NEXUS takes the last Korvat city, the taken-over unit falls apart at the end of the takeover
    const b = duel({ third: true });
    const tb = withTower(b.s);
    const t2 = addUnit(b.s, 'tank', 1, 8, 3);
    ok(b.s, { type: 'hijack', x: tb.x, y: tb.y, target: t2.id });
    const a = addUnit(b.s, 'android', 0, b.foe.x, b.foe.y);
    a.startX = b.foe.x; a.startY = b.foe.y;
    ok(b.s, { type: 'capture', unit: a.id });
    expect(b.s.factions[1].alive).toBe(false);
    expect(b.s.over).toBe(false);
    expect(unit(b.s, t2.id)?.owner).toBe(0);
    untilTurnOf(b.s, 0);
    const end = endTurn(b.s);
    expect(end.events.some((e) => e.t === 'hijackEnd' && e.unit === t2.id && e.lost)).toBe(true);
    expect(unit(b.s, t2.id)).toBeUndefined();
  });
});

describe('Kampagne und KI / campaign and AI', () => {
  it('in der Kampagne hackt niemand / nobody hacks in the campaign', () => {
    for (const id of MISSION_IDS) {
      const s = createGame(missionConfig(id));
      for (const f of s.factions) expect(hacksOn(s, f.index), `${id}:${f.id}`).toBe(false);
    }
  });

  it('NEXUS-Einsaetze laufen mit der KI ohne Fehlbefehle / NEXUS missions run with the AI without failed commands', () => {
    for (const id of ['m7', 'm8']) {
      const s = createGame(missionConfig(id));
      let failed = 0;
      for (let turn = 0; turn < 6 && !s.over; turn++) {
        const f = s.current;
        for (let i = 0; i < 200 && !s.over; i++) {
          if (s.factions[f].human) { applyCommand(s, { type: 'endTurn' }); break; }
          const cmd = planNextCommand(s, f);
          const r = applyCommand(s, cmd);
          if (!r.ok) failed++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
      expect(failed, id).toBe(0);
    }
  });

  it('KI-Zug der NEXUS: hackt einen Ort und uebernimmt ein Fahrzeug / NEXUS AI turn: hacks a place and takes over a vehicle', () => {
    const { s } = duel({ stars: 300 });
    s.factions[0].human = false;
    const tw = withTower(s);
    const v = addCity(s, 8, 9, null);
    v.base = 'factory';
    const tank = addUnit(s, 'tank', 1, 8, 4);
    addUnit(s, 'infantry', 1, 9, 5);
    addUnit(s, 'android', 0, 4, 5);
    const events: string[] = [];
    let failed = 0;
    for (let i = 0; i < 120 && s.current === 0 && !s.over; i++) {
      const cmd = planNextCommand(s, 0);
      const r = applyCommand(s, cmd);
      if (!r.ok) failed++;
      for (const e of r.events) events.push(e.t === 'capture' && e.hack ? 'hack' : e.t);
      if (cmd.type === 'endTurn' && r.ok) break;
    }
    expect(failed).toBe(0);
    expect(events).toContain('hack');
    expect(events).toContain('hijack');
    expect(v.owner).toBe(0);
    expect(tw.x).toBe(5);
    void tank;
  });
});
