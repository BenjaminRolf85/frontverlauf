/**
 * Orbitallaser der Velkar: Satelliten-Relay, Abklingzeit, Sicht, Flaeche 2x2, Schaden, Abschuesse, Frieden, Eroberung,
 * Determinismus und Spielstaende.
 * Velkar orbital laser: satellite relay, cooldown, vision, 2x2 area, damage, kills, peace, capture, determinism and saves.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, cityUpgradeCheck, cloneState, orbitalArea, orbitalCheck, orbitalPreview, orbitalWait, relayCity, replay,
  type Command, type GameState,
} from '../src/core';
import { CITY_UPGRADES, ORBITAL, UNITS, VERDAN, type FactionId } from '../src/data/balance';
import { migrateState } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, tile, untilTurnOf } from './helpers';

/** Velkar (0) mit Hauptstadt, Technik und Sternen; Gegner (1) mit Hauptstadt / Velkar (0) with capital, tech and stars; enemy (1) with capital */
function setup(o: { factions?: FactionId[]; stars?: number; size?: 11 | 14 } = {}) {
  const s = blankGame({ factions: o.factions ?? ['velkar', 'korvat'], stars: o.stars ?? 200, size: o.size ?? 14 });
  const hq = addCity(s, 2, 2, 0, { hq: true });
  const foe = addCity(s, s.size - 3, s.size - 3, 1, { hq: true });
  s.factions[0].techs.push(CITY_UPGRADES.tech.satRelay);
  revealAll(s, 0);
  return { s, hq, foe };
}

/** Relay bauen und die Aufladezeit ueberspringen / build the relay and skip the charge time */
function armed(o: Parameters<typeof setup>[0] = {}) {
  const r = setup(o);
  ok(r.s, { type: 'cityUpgrade', city: r.hq.id, upgrade: 'satRelay' });
  r.s.factions[0].orbitalReady = r.s.round;
  return r;
}

const fire = (s: GameState, x: number, y: number) => ok(s, { type: 'orbitalStrike', x, y });

describe('Satelliten-Relay / satellite relay', () => {
  it('nur Velkar, mit Technik und Sternen; kostet ORBITAL.relayCost / Velkar only, with tech and stars; costs ORBITAL.relayCost', () => {
    const { s, hq } = setup();
    // ohne Technik gesperrt / locked without the tech
    s.factions[0].techs = [];
    expect(cityUpgradeCheck(s, 0, hq, 'satRelay')).toBe('techMissing');
    s.factions[0].techs.push(CITY_UPGRADES.tech.satRelay);
    const before = s.factions[0].stars;
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'satRelay' });
    expect(s.factions[0].stars).toBe(before - ORBITAL.relayCost);
    expect(relayCity(s, 0)?.id).toBe(hq.id);
    // andere Fraktionen koennen es nicht bauen / other factions cannot build it
    const k = setup({ factions: ['korvat', 'velkar'] });
    expect(cityUpgradeCheck(k.s, 0, k.hq, 'satRelay')).toBe('wrongFaction');
    fails(k.s, { type: 'cityUpgrade', city: k.hq.id, upgrade: 'satRelay' }, 'wrongFaction');
  });

  it('hoechstens ein Relay zugleich / at most one relay at a time', () => {
    const { s, hq } = setup();
    const second = addCity(s, 7, 2, 0);
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'satRelay' });
    expect(cityUpgradeCheck(s, 0, second, 'satRelay')).toBe('relayLimit');
    fails(s, { type: 'cityUpgrade', city: second.id, upgrade: 'satRelay' }, 'relayLimit');
    expect(CITY_UPGRADES.perFaction.satRelay).toBe(1);
  });

  it('erobert: Relay weg, Velkar kann anderswo neu bauen / captured: relay gone, Velkar can rebuild elsewhere', () => {
    const { s, hq } = setup();
    const second = addCity(s, 7, 2, 0);
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'satRelay' });
    s.current = 1;
    const e = addUnit(s, 'infantry', 1, hq.x, hq.y);
    ok(s, { type: 'capture', unit: e.id });
    expect(hq.owner).toBe(1);
    expect(hq.upgrades ?? []).not.toContain('satRelay');
    expect(relayCity(s, 0)).toBeNull();
    expect(relayCity(s, 1)).toBeNull();
    expect(orbitalWait(s, 0)).toBeNull();
    s.current = 0;
    fails(s, { type: 'orbitalStrike', x: 5, y: 5 }, 'noRelay');
    ok(s, { type: 'cityUpgrade', city: second.id, upgrade: 'satRelay' });
    expect(relayCity(s, 0)?.id).toBe(second.id);
    // neu gebaut: die Aufladezeit beginnt von vorn / rebuilt: the charge time starts over
    expect(orbitalWait(s, 0)).toBe(ORBITAL.cooldown);
  });
});

describe('Orbitallaser / orbital laser', () => {
  it('Abklingzeit: bereit ORBITAL.cooldown Runden nach dem Bau und nach jedem Schuss / cooldown: ready ORBITAL.cooldown rounds after building and after each shot', () => {
    expect(ORBITAL.cooldown).toBe(5);
    const { s, hq } = setup();
    ok(s, { type: 'cityUpgrade', city: hq.id, upgrade: 'satRelay' });
    const built = s.round;
    expect(orbitalWait(s, 0)).toBe(ORBITAL.cooldown);
    fails(s, { type: 'orbitalStrike', x: 6, y: 6 }, 'orbitalCooldown');
    while (s.round < built + ORBITAL.cooldown) {
      expect(orbitalWait(s, 0)).toBe(built + ORBITAL.cooldown - s.round);
      fails(s, { type: 'orbitalStrike', x: 6, y: 6 }, 'orbitalCooldown');
      untilTurnOf(s, 0);
    }
    expect(orbitalWait(s, 0)).toBe(0);
    fire(s, 6, 6);
    expect(orbitalWait(s, 0)).toBe(ORBITAL.cooldown);
    // kein zweiter Schuss in derselben Runde / no second shot in the same round
    fails(s, { type: 'orbitalStrike', x: 8, y: 8 }, 'orbitalCooldown');
    untilTurnOf(s, 0);
    expect(orbitalWait(s, 0)).toBe(ORBITAL.cooldown - 1);
  });

  it('braucht keine Einheit und verbraucht keine Aktion / needs no unit and uses no action', () => {
    const { s } = armed();
    const u = addUnit(s, 'infantry', 0, 3, 3);
    fire(s, 9, 9);
    expect(u.moved || u.attacked || u.exhausted).toBe(false);
  });

  it('Sicht: das Zielfeld muss aufgedeckt sein, die restliche Flaeche nicht / vision: the target tile must be revealed, the rest of the area need not', () => {
    const { s } = armed();
    const k = 7 * s.size + 7;
    s.factions[0].explored[k] = 0;
    fails(s, { type: 'orbitalStrike', x: 7, y: 7 }, 'notVisible');
    // Ziel (6, 6) sichtbar, Einheit auf (7, 7) im Nebel wird trotzdem getroffen / target (6, 6) visible, unit on (7, 7) in fog is hit anyway
    const hidden = addUnit(s, 'infantry', 1, 7, 7);
    expect(orbitalPreview(s, 0, 6, 6).hits.some((h) => h.unit === hidden.id)).toBe(false);
    fire(s, 6, 6);
    expect(hidden.hp).toBe(UNITS.infantry.hp - ORBITAL.damage);
    expect(ORBITAL.needsVision).toBe(true);
  });

  it('Flaeche 2x2 ab der linken oberen Ecke, am Rand nach innen geschoben / 2x2 area from the top-left corner, shifted inwards at the edge', () => {
    const { s } = armed();
    expect(ORBITAL.area).toEqual({ w: 2, h: 2 });
    expect(orbitalArea(s, 5, 6)).toEqual([{ x: 5, y: 6 }, { x: 6, y: 6 }, { x: 5, y: 7 }, { x: 6, y: 7 }]);
    const n = s.size - 1;
    expect(orbitalArea(s, n, n)).toEqual([{ x: n - 1, y: n - 1 }, { x: n, y: n - 1 }, { x: n - 1, y: n }, { x: n, y: n }]);
    expect(orbitalArea(s, 0, n)).toHaveLength(4);
  });

  it('genau 2 Schaden an allem in der Flaeche, auch eigene; nichts daneben / exactly 2 damage to everything in the area, own included; nothing beside it', () => {
    const { s } = armed({ factions: ['velkar', 'korvat', 'zyrr'] });
    const inside = [addUnit(s, 'infantry', 1, 5, 5), addUnit(s, 'tank', 1, 6, 5), addUnit(s, 'infantry', 0, 5, 6), addUnit(s, 'mech', 2, 6, 6)];
    const outside = [addUnit(s, 'infantry', 1, 4, 5), addUnit(s, 'infantry', 1, 7, 6), addUnit(s, 'infantry', 1, 5, 7), addUnit(s, 'infantry', 0, 4, 4)];
    const before = new Map(s.units.map((u) => [u.id, u.hp]));
    const r = fire(s, 5, 5);
    for (const u of inside) expect(u.hp, u.type).toBe(before.get(u.id)! - ORBITAL.damage);
    for (const u of outside) expect(u.hp, u.type).toBe(before.get(u.id)!);
    const ev = r.events.find((e) => e.t === 'orbitalStrike');
    expect(ev && ev.t === 'orbitalStrike' && ev.hits.map((h) => h.unit).sort()).toEqual(inside.map((u) => u.id).sort());
    expect(ev && ev.t === 'orbitalStrike' && ev.hits.every((h) => h.dmg === ORBITAL.damage)).toBe(true);
    // kein Trefferglueck: ohne Zufall / no hit luck: no randomness used
    expect(ORBITAL.damage).toBe(2);
  });

  it('kein Trefferglueck: gleicher Schaden mit Trefferglueck an / no hit luck: the same damage with hit luck on', () => {
    const { s } = armed();
    s.config.hitChance = true;
    const rng = s.rng;
    const u = addUnit(s, 'infantry', 1, 5, 5);
    fire(s, 5, 5);
    expect(u.hp).toBe(UNITS.infantry.hp - ORBITAL.damage);
    expect(s.rng).toBe(rng);
  });

  it('trifft Verdan-Geschuetze, Stellungen mit Besitzer und die Schwarmmutter; Staedte nicht / hits Verdan guns, owned emplacements and the Swarm Mother; not cities', () => {
    const { s, foe } = armed();
    tile(s, 5, 5).turret = { hp: VERDAN.hp, active: true };
    // generisch ueber t.turret: eine Stellung mit Besitzer (feindlich) / generic over t.turret: an emplacement with an owner (hostile)
    // Stellungen stehen nur im Gebiet ihres Besitzers (sonst geschleift) / emplacements only stand in their owner's territory (otherwise razed)
    tile(s, 6, 5).turret = { hp: 3, active: true, owner: 1 };
    tile(s, 6, 5).territory = foe.id;
    const boss = addUnit(s, 'swarmMother', 1, 5, 6);
    const bossHp = boss.hp;
    const levelBefore = foe.level, popBefore = foe.pop;
    fire(s, 5, 5);
    expect(tile(s, 5, 5).turret?.hp).toBe(VERDAN.hp - ORBITAL.damage);
    expect(tile(s, 6, 5).turret?.hp).toBe(1);
    expect(boss.hp).toBe(bossHp - ORBITAL.damage);
    // Stadt im Ziel: unveraendert / city in the target: unchanged
    s.factions[0].orbitalReady = s.round;
    fire(s, foe.x, foe.y);
    expect([foe.level, foe.pop, foe.owner]).toEqual([levelBefore, popBefore, 1]);
  });

  it('zerstoert Geschuetze mit wenig LP zu Truemmern und weckt schlafende / destroys weak guns into rubble and wakes dormant ones', () => {
    const { s } = armed();
    s.campaign = { mission: 'x', targets: [], status: [], bonus: [], startCities: [], result: null, stars: 0, artifact: { x: 9, y: 9 } };
    tile(s, 5, 5).turret = { hp: 2, active: false };
    tile(s, 9, 6).turret = { hp: VERDAN.hp, active: false };
    tile(s, 6, 6).turret = { hp: VERDAN.hp, active: false };
    const r = applyCommand(s, { type: 'orbitalStrike', x: 5, y: 5 });
    expect(r.ok).toBe(true);
    expect(tile(s, 5, 5).turret).toBeNull();
    expect(tile(s, 5, 5).turretRuin).toBe(true);
    expect(tile(s, 6, 6).turret?.active).toBe(true);
    expect(tile(s, 9, 6).turret?.active).toBe(true);
    expect(r.events.some((e) => e.t === 'verdanActive')).toBe(true);
  });

  it('Abschuesse zaehlen fuer Velkar, ohne Befoerderung; eigene Verluste nicht / kills count for Velkar, without promotion; own losses do not', () => {
    const { s } = armed();
    const a = addUnit(s, 'infantry', 1, 5, 5, { hp: 2 });
    const b = addUnit(s, 'infantry', 1, 6, 5, { hp: 1 });
    const own = addUnit(s, 'infantry', 0, 5, 6, { hp: 2 });
    const r = fire(s, 5, 5);
    expect(s.units.find((u) => [a.id, b.id, own.id].includes(u.id))).toBeUndefined();
    expect(s.factions[0].kills).toBe(2);
    const killed = r.events.filter((e) => e.t === 'killed');
    expect(killed.map((e) => e.t === 'killed' && e.unit).sort()).toEqual([a.id, b.id, own.id].sort());
    expect(r.events.some((e) => e.t === 'veteran')).toBe(false);
    // das Ereignis kommt vor den Abschuessen (Strahl, dann Tod) / the event comes before the kills (beam, then death)
    expect(r.events.findIndex((e) => e.t === 'orbitalStrike')).toBeLessThan(r.events.findIndex((e) => e.t === 'killed'));
  });

  it('Frieden: sichtbare Einheiten eines Friedenspartners sperren den Schuss, verdeckte werden verschont / peace: visible units of a peace partner block the shot, hidden ones are spared', () => {
    const { s } = armed({ factions: ['velkar', 'korvat', 'dravon'] });
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    const friend = addUnit(s, 'infantry', 1, 5, 5);
    fails(s, { type: 'orbitalStrike', x: 5, y: 5 }, 'peace');
    expect(orbitalCheck(s, 0, 5, 5)).toBe('peace');
    expect(orbitalPreview(s, 0, 5, 5).check).toBe('peace');
    // angekuendigter Bruch zaehlt noch als Frieden / an announced break still counts as peace
    s.factions[0].relations[1] = 'breaking'; s.factions[1].relations[0] = 'breaking';
    fails(s, { type: 'orbitalStrike', x: 5, y: 5 }, 'peace');
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    // ein Spion des Friedenspartners (unsichtbar) verraet sich nicht und bleibt heil / a peace partner's spy (invisible) does not give itself away and stays unhurt
    s.units = s.units.filter((u) => u.id !== friend.id);
    const spy = addUnit(s, 'spy', 1, 8, 8);
    const foe = addUnit(s, 'infantry', 2, 9, 8);
    fire(s, 8, 8);
    expect(spy.hp).toBe(UNITS.spy.hp);
    expect(foe.hp).toBe(UNITS.infantry.hp - ORBITAL.damage);
    expect(s.factions[0].relations[1]).toBe('peace');
  });

  it('ungueltige Befehle aendern nichts / invalid commands change nothing', () => {
    const { s } = armed();
    fails(s, { type: 'orbitalStrike', x: -1, y: 3 }, 'invalidTile');
    s.current = 1;
    fails(s, { type: 'orbitalStrike', x: 5, y: 5 }, 'wrongFaction');
  });
});

describe('Determinismus und Spielstaende / determinism and saves', () => {
  it('Wiederholung ergibt denselben Zustand / replay yields the same state', () => {
    const { s, hq } = armed();
    addUnit(s, 'infantry', 1, 5, 5);
    const start = cloneState(s);
    const cmds: Command[] = [{ type: 'orbitalStrike', x: 5, y: 5 }, { type: 'endTurn' }, { type: 'endTurn' }];
    const a = cloneState(start), b = cloneState(start);
    for (const c of cmds) { applyCommand(a, c); applyCommand(b, c); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(hq.upgrades).toContain('satRelay');
    // replay() aus der Konfiguration bleibt ebenfalls gleich / replay() from the config stays equal as well
    expect(JSON.stringify(replay(s.config, [{ type: 'endTurn' }]))).toBe(JSON.stringify(replay(s.config, [{ type: 'endTurn' }])));
  });

  it('Speichern und Laden: Abklingzeit und Relay bleiben / save and load: cooldown and relay persist', () => {
    const { s } = armed();
    addUnit(s, 'infantry', 1, 5, 5);
    fire(s, 5, 5);
    const loaded = migrateState(JSON.parse(JSON.stringify(s)) as GameState);
    expect(orbitalWait(loaded, 0)).toBe(ORBITAL.cooldown);
    expect(relayCity(loaded, 0)?.id).toBe(relayCity(s, 0)?.id);
    endTurn(loaded); endTurn(s);
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(s));
  });

  it('alter Spielstand ohne Feld laedt; Relay ohne Zeitstempel gilt als bereit / old save without the field loads; a relay without a timestamp counts as ready', () => {
    const { s, hq } = setup();
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    for (const f of old.factions) delete f.orbitalReady;
    const m = migrateState(old);
    expect(orbitalWait(m, 0)).toBeNull();
    ok(m, { type: 'cityUpgrade', city: hq.id, upgrade: 'satRelay' });
    expect(orbitalWait(m, 0)).toBe(ORBITAL.cooldown);
    delete m.factions[0].orbitalReady;
    expect(orbitalWait(m, 0)).toBe(0);
  });
});
