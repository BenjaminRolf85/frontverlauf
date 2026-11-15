/**
 * Regressionstests fuer die Fehlersuche: jeder Test hielt vorher einen echten Regelfehler fest.
 * Regression tests for the bug hunt: each test used to document a real rules bug.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, barrierCheck, continueEndless, income, mineCheck, triggerRandomEvent, upkeep, type GameEvent, type GameState,
} from '../src/core';
import { randInt } from '../src/core/rng';
import { BUNKER_REWARDS, UNITS, VICTORY_TECH, type FactionId } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, tile } from './helpers';

function game(a: FactionId, b: FactionId = 'korvat', stars = 500): GameState {
  const s = blankGame({ factions: [a, b], stars });
  addCity(s, 2, 2, 0, { hq: true, radius: 2 });
  addCity(s, 8, 8, 1, { hq: true, radius: 2 });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Endlos nach Sieg / endless after victory (B1)', () => {
  it('nach einem Fraktionssieg startet der Zug nicht doppelt / no second turn start after a faction victory', () => {
    const s = game('meridon', 'korvat');
    s.factions[0].techs.push(VICTORY_TECH.meridon);
    s.factions[0].stars = 2000;
    endTurn(s); // f1
    const net = income(s, 0) - upkeep(s, 0);
    endTurn(s); // f0: Einkommen, dann Meridon-Sieg / income, then the Meridon victory
    expect(s.victory?.kind).toBe('faction');
    const after = s.factions[0].stars;
    expect(after).toBe(2000 + net);
    const ev = continueEndless(s);
    expect(s.over).toBe(false);
    expect(ev.filter((e) => e.t === 'turn')).toHaveLength(0);
    expect(s.factions[0].stars).toBe(after);
    expect(s.current).toBe(0);
  });

  it('nach dem Rundenlimit startet der naechste Zug / after the round limit the next turn starts', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 10, roundLimit: 2 });
    addCity(s, 2, 2, 0, { hq: true }); addCity(s, 8, 8, 1, { hq: true });
    endTurn(s); endTurn(s); // Runde 3 > Limit / round 3 > limit
    expect(s.victory?.kind).toBe('points');
    const ev = continueEndless(s);
    expect(ev.filter((e) => e.t === 'turn')).toHaveLength(1);
    expect(s.config.roundLimit).toBeNull();
  });
});

describe('Abschuesse / kills (B2, B8)', () => {
  it('ein vom Gegenschlag getoeteter Flaechenschuetze bleibt tot / a splash shooter killed by return fire stays dead', () => {
    const s = game('velkar', 'korvat');
    const pw = addUnit(s, 'protoWalker', 0, 5, 5, { hp: 1 });
    pw.kills = 2; // ein Abschuss mehr = Veteran / one more kill = veteran
    const target = addUnit(s, 'infantry', 1, 6, 5);
    const victim = addUnit(s, 'infantry', 1, 7, 5, { hp: 1 });
    const r = ok(s, { type: 'attack', unit: pw.id, target: target.id });
    const atk = r.events.find((e) => e.t === 'attack') as { ret: number };
    expect(atk.ret).toBeGreaterThanOrEqual(1);
    expect(s.units.some((u) => u.id === victim.id)).toBe(false);
    expect(s.units.some((u) => u.id === pw.id)).toBe(false);
    expect(r.events.some((e) => e.t === 'veteran')).toBe(false);
  });

  it('Schrei-Abschuesse befoerdern und heilen die Schwarmmutter nicht / scream kills neither promote nor heal the swarm mother', () => {
    const s = game('zyrr', 'korvat');
    const boss = addUnit(s, 'swarmMother', 0, 5, 5, { hp: 20 });
    boss.kills = 2;
    boss.boss = { scream: 0, brood: 99 };
    const foe = addUnit(s, 'infantry', 1, 6, 5, { hp: 2 });
    endTurn(s); endTurn(s); // Zug der Mutter: der Schrei toetet / mother's turn: the scream kills
    expect(s.units.some((u) => u.id === foe.id)).toBe(false);
    const b = s.units.find((u) => u.id === boss.id)!;
    expect(b.veteran).toBe(false);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(b.kills).toBe(3);
  });

  it('Endgegner laufen nie ueber / bosses never defect', () => {
    const s = blankGame({ factions: ['zyrr', 'korvat'] });
    addCity(s, 1, 1, 0, { hq: true, level: 4 }); addCity(s, 3, 1, 0);
    addCity(s, 9, 9, 1, { hq: true });
    const boss = addUnit(s, 'swarmMother', 0, 8, 8);
    const ev: GameEvent[] = [];
    triggerRandomEvent(s, 'defector', ev);
    expect(boss.owner).toBe(0);
  });
});

describe('Aufstellungsfelder / spawn tiles (B3)', () => {
  it('kein Rekrut auf einem Vulkangipfel oder auf Lava / no recruit on a volcano peak or on lava', () => {
    const s = game('vesper', 'korvat');
    s.factions[0].techs.push('mountainTraining');
    const prophet = addUnit(s, 'prophet', 0, 3, 4);
    const vt = tile(s, 3, 5); vt.terrain = 'mountain'; vt.volcano = true;
    fails(s, { type: 'recruit', unit: prophet.id, unitType: 'zealot', x: 3, y: 5 }, 'invalidTile');
    tile(s, 4, 5).lava = s.round;
    fails(s, { type: 'recruit', unit: prophet.id, unitType: 'zealot', x: 4, y: 5 }, 'invalidTile');
    // Berg ohne Vulkan bleibt mit Bergausbildung erlaubt / a plain mountain stays allowed with mountain training
    tile(s, 2, 5).terrain = 'mountain';
    ok(s, { type: 'recruit', unit: prophet.id, unitType: 'zealot', x: 2, y: 5 });
  });

  it('kein Rekrut auf dem Artefakt / no recruit on the artifact', () => {
    const s = game('vesper', 'korvat');
    const prophet = addUnit(s, 'prophet', 0, 3, 4);
    s.campaign = { artifact: { x: 3, y: 5 } } as unknown as GameState['campaign'];
    fails(s, { type: 'recruit', unit: prophet.id, unitType: 'zealot', x: 3, y: 5 }, 'invalidTile');
  });

  it('der Spionage-Aufstand stellt keine Einheit auf einen Vulkan / the spy uprising places no unit on a volcano', () => {
    const s = game('korvat', 'dravon');
    s.factions[0].techs.push('mountainTraining');
    const spy = addUnit(s, 'spy', 0, 7, 7);
    for (const [x, y] of [[7, 8], [7, 9], [8, 7], [8, 9], [9, 7], [9, 8], [9, 9]]) tile(s, x, y).terrain = 'ocean';
    const v = tile(s, 7, 7); v.terrain = 'mountain'; v.volcano = true;
    const r = ok(s, { type: 'move', unit: spy.id, to: { x: 8, y: 8 } });
    expect(r.events.find((e) => e.t === 'uprising')).toMatchObject({ spawned: 0 });
    expect(s.units.some((u) => u.owner === 0 && u.x === 7 && u.y === 7)).toBe(false);
  });
});

describe('Ausscheiden / elimination (B4)', () => {
  it('Minen, Sperren und Aussenposten einer ausgeschiedenen Fraktion verschwinden / mines, barriers and outposts of an eliminated faction vanish', () => {
    const s = blankGame({ factions: ['korvat', 'dravon', 'velkar'], stars: 100 });
    addCity(s, 2, 2, 0, { hq: true });
    addCity(s, 8, 8, 1, { hq: true });
    addCity(s, 2, 8, 2, { hq: true });
    revealAll(s, 0);
    tile(s, 5, 5).mine = { owner: 1 };
    tile(s, 5, 6).barrier = { owner: 1 };
    tile(s, 6, 4).outpost = { owner: 1 };
    tile(s, 4, 6).mine = { owner: 2 };
    const cap = addUnit(s, 'infantry', 0, 8, 8);
    endTurn(s); endTurn(s); endTurn(s);
    ok(s, { type: 'capture', unit: cap.id });
    expect(s.factions[1].alive).toBe(false);
    expect(tile(s, 5, 5).mine).toBeNull();
    expect(tile(s, 5, 6).barrier).toBeNull();
    expect(tile(s, 6, 4).outpost).toBeNull();
    expect(tile(s, 4, 6).mine).toEqual({ owner: 2 });
    const walker = addUnit(s, 'infantry', 0, 4, 5);
    const r = ok(s, { type: 'move', unit: walker.id, to: { x: 5, y: 5 } });
    expect(r.events.some((e) => e.t === 'mineHit')).toBe(false);
  });
});

describe('Diplomatie / diplomacy (B5)', () => {
  it('ein Friedensangebot bei einseitigem Kontakt laesst sich annehmen und ablehnen / a peace offer with one-sided contact can be accepted and declined', () => {
    const mk = () => {
      const s = blankGame({ factions: ['korvat', 'dravon'], stars: 50, contacts: false });
      addCity(s, 2, 2, 0, { hq: true });
      addCity(s, 8, 8, 1, { hq: true });
      s.factions[0].contacts = [1]; // nur 0 kennt 1 / only 0 knows 1
      ok(s, { type: 'diplomacy', action: 'proposePeace', target: 1 });
      endTurn(s);
      expect(s.factions[1].peaceOffers).toContain(0);
      return s;
    };
    const a = mk();
    ok(a, { type: 'diplomacy', action: 'acceptPeace', target: 0 });
    expect(a.factions[1].relations[0]).toBe('peace');
    const d = mk();
    ok(d, { type: 'diplomacy', action: 'declinePeace', target: 0 });
    expect(d.factions[1].peaceOffers).not.toContain(0);
  });

  it('ganz ohne Kontakt bleibt Diplomatie gesperrt / without any contact diplomacy stays locked', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 50, contacts: false });
    addCity(s, 2, 2, 0, { hq: true }); addCity(s, 8, 8, 1, { hq: true });
    fails(s, { type: 'diplomacy', action: 'proposePeace', target: 1 }, 'noContact');
  });
});

describe('Stadt- und Bunkerbelohnungen / city and bunker rewards (B6, B7)', () => {
  it('der Belohnungspanzer einer vollen Stadt zaehlt nicht zum Limit / the reward tank of a full city does not count towards the limit', () => {
    const s = game('dravon', 'korvat', 500);
    const c = s.cities[0];
    c.level = 4; c.pop = 4;
    s.factions[0].techs.push('agritech');
    tile(s, 3, 2).resource = 'farmland';
    ok(s, { type: 'build', building: 'farm', x: 3, y: 2 });
    expect(c.level).toBe(5);
    const spots = [[1, 1], [1, 2], [1, 3], [2, 1], [3, 1], [3, 3], [4, 4], [0, 0]];
    for (;;) {
      const r = applyCommand(s, { type: 'train', city: c.id, unitType: 'infantry' });
      if (!r.ok) { expect(r.error).toBe('unitLimit'); break; }
      const u = s.units[s.units.length - 1];
      const [x, y] = spots.shift()!; u.x = x; u.y = y;
    }
    const supported = () => s.units.filter((u) => u.homeCity === c.id).length;
    const limit = supported();
    ok(s, { type: 'reward', city: c.id, choice: 'b' });
    const tank = s.units[s.units.length - 1];
    expect(UNITS[tank.type].hp).toBeGreaterThan(UNITS.infantry.hp);
    expect(tank.homeCity).toBeNull();
    expect(supported()).toBe(limit);
  });

  it('Nachschublinien: Bunker-Bevoelkerung wird zu Sternen / supply lines: bunker population becomes stars', () => {
    const s = game('korvat', 'dravon');
    s.config.theme = 'cavern';
    const inf = addUnit(s, 'infantry', 0, 5, 5);
    tile(s, 6, 5).feature = 'bunker';
    const want = BUNKER_REWARDS.indexOf('population');
    for (let seed = 1; ; seed++) { if (randInt({ rng: seed }, BUNKER_REWARDS.length) === want) { s.rng = seed; break; } }
    const hq = s.cities[0];
    const before = { stars: s.factions[0].stars, pop: hq.pop };
    const r = ok(s, { type: 'move', unit: inf.id, to: { x: 6, y: 5 } });
    expect(r.events.find((e) => e.t === 'bunker')).toMatchObject({ reward: 'stars' });
    expect(s.factions[0].stars).toBeGreaterThan(before.stars);
    expect(hq.pop).toBe(before.pop);
  });
});

describe('Bau-Fehlermeldungen / build errors', () => {
  it('Sperre und Mine: falsche Einheit und erschoepfte Einheit sind verschiedene Fehler / barrier and mine: wrong unit and exhausted unit are different errors', () => {
    const s = game('korvat', 'dravon');
    s.factions[0].techs.push('fortification');
    const inf = addUnit(s, 'infantry', 0, 5, 5);
    expect(barrierCheck(s, inf, 5, 6)).toBe('cannotBuild');
    expect(mineCheck(s, inf, 5, 6)).toBe('cannotBuild');
    fails(s, { type: 'barrier', unit: inf.id, x: 5, y: 6 }, 'cannotBuild');
    fails(s, { type: 'mine', unit: inf.id, x: 5, y: 6 }, 'cannotBuild');
    const p = addUnit(s, 'pioneer', 0, 6, 6, { fresh: true });
    expect(barrierCheck(s, p, 6, 7)).toBe('unitExhausted');
  });
});
