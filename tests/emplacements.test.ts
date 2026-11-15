/**
 * Festungsbau der Dravon: Geschuetzstellungen bauen, feuern, zerstoeren, Besitzwechsel, Ausscheiden, Speichern.
 * Dravon fortification: building, firing, destroying gun emplacements, ownership change, elimination, saving.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cloneState, createGame, emplacementCheck, emplacementLimit, emplacementTargets, emplacementsOf, gunStats,
  hitDamage, missionConfig, reachable, score, supportedUnits, turretList, turretPreview, turretShotDamage, turretTargets, type GameEvent,
  type GameState,
} from '../src/core';
import { EMPLACEMENT, HIT_KINDS, UNITS, VERDAN } from '../src/data/balance';
import { isValidState, loadGame, saveGame } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile } from './helpers';

/** Dravon (0) mit Hauptstadt bei (3,5), Korvat (1) und Alvenia (2) / Dravon (0) with its capital at (3,5), Korvat (1) and Alvenia (2) */
function setup(o: { stars?: number; hitChance?: boolean } = {}) {
  const s = blankGame({ factions: ['dravon', 'korvat', 'alvenia'], stars: o.stars ?? 100, hitChance: o.hitChance });
  const hq = addCity(s, 3, 5, 0, { hq: true });
  addCity(s, 9, 1, 1, { hq: true });
  addCity(s, 9, 9, 2, { hq: true });
  for (const f of s.factions) revealAll(s, f.index);
  const pio = addUnit(s, 'pioneer', 0, 4, 5);
  return { s, hq, pio };
}
const build = (s: GameState, unit: number, x: number, y: number) => ok(s, { type: 'emplacement', unit, x, y });
/** bis zum naechsten Rundenwechsel / until the next round wrap */
function wrapRound(s: GameState): GameEvent[] {
  const ev: GameEvent[] = [];
  const r = s.round;
  while (s.round === r && !s.over) ev.push(...endTurn(s).events);
  return ev;
}
const peace = (s: GameState, a: number, b: number) => { s.factions[a].relations[b] = 'peace'; s.factions[b].relations[a] = 'peace'; };

describe('Geschuetzstellung bauen / building a gun emplacement', () => {
  it('Pionier baut auf ein freies Nachbarfeld im eigenen Gebiet; kein Einheit / pioneer builds on a free adjacent own tile; not a unit', () => {
    const { s, hq, pio } = setup();
    const units = s.units.length, sup = supportedUnits(s, hq), pts = score(s, 0);
    expect(emplacementTargets(s, pio).length).toBeGreaterThan(0);
    const r = build(s, pio.id, 4, 4);
    expect(r.events.some((e) => e.t === 'emplacement' && e.faction === 0 && e.x === 4 && e.y === 4)).toBe(true);
    expect(tile(s, 4, 4).turret).toEqual({ hp: EMPLACEMENT.hp, active: true, owner: 0 });
    expect(s.factions[0].stars).toBe(100 - EMPLACEMENT.cost);
    expect(pio.exhausted).toBe(true);
    // Bauwerk, keine Einheit: kein Limit, keine Punkte / structure, not a unit: no limit, no score
    expect(s.units.length).toBe(units);
    expect(supportedUnits(s, hq)).toBe(sup);
    expect(score(s, 0)).toBe(pts);
    expect(gunStats(tile(s, 4, 4).turret!)).toBe(EMPLACEMENT);
    // unpassierbar, auch fuer Dravon / impassable, also for Dravon
    const inf = addUnit(s, 'infantry', 0, 4, 3);
    expect(reachable(s, inf).some((p) => p.x === 4 && p.y === 4)).toBe(false);
  });

  it('auch der Minenleger baut; andere Einheiten und Fraktionen nicht / the mine layer builds too; other units and factions do not', () => {
    const { s } = setup();
    const ml = addUnit(s, 'mineLayer', 0, 2, 5);
    build(s, ml.id, 2, 6);
    const mg = addUnit(s, 'mg', 0, 3, 4);
    fails(s, { type: 'emplacement', unit: mg.id, x: 2, y: 4 }, 'cannotBuild');
    // Korvat-Pionier im eigenen Gebiet / Korvat pioneer in its own territory
    s.current = 1;
    const kp = addUnit(s, 'pioneer', 1, 9, 2);
    fails(s, { type: 'emplacement', unit: kp.id, x: 8, y: 2 }, 'wrongFaction');
  });

  it('Feldregeln: Gebiet, Gelaende, Stadt, Ressource, Gebaeude, Besonderheit, Einheit / tile rules', () => {
    const { s, pio } = setup();
    // ausserhalb des Gebiets / outside the territory
    pio.x = 5; pio.y = 5; pio.startX = 5; pio.startY = 5;
    fails(s, { type: 'emplacement', unit: pio.id, x: 6, y: 5 }, 'notInTerritory');
    pio.x = 4; pio.startX = 4;
    fails(s, { type: 'emplacement', unit: pio.id, x: 3, y: 5 }, 'invalidTile'); // Stadt / city
    setTerrain(s, 4, 6, 'shallow');
    fails(s, { type: 'emplacement', unit: pio.id, x: 4, y: 6 }, 'invalidTile'); // Wasser / water
    tile(s, 4, 4).resource = 'ore';
    fails(s, { type: 'emplacement', unit: pio.id, x: 4, y: 4 }, 'invalidTile');
    tile(s, 4, 4).resource = null; tile(s, 4, 4).building = 'farm';
    fails(s, { type: 'emplacement', unit: pio.id, x: 4, y: 4 }, 'invalidTile');
    tile(s, 4, 4).building = null; tile(s, 4, 4).feature = 'bunker';
    fails(s, { type: 'emplacement', unit: pio.id, x: 4, y: 4 }, 'invalidTile');
    tile(s, 4, 4).feature = null; tile(s, 4, 4).barrier = { owner: 0 };
    fails(s, { type: 'emplacement', unit: pio.id, x: 4, y: 4 }, 'invalidTile');
    tile(s, 4, 4).barrier = null;
    addUnit(s, 'infantry', 0, 4, 4);
    fails(s, { type: 'emplacement', unit: pio.id, x: 4, y: 4 }, 'occupied');
    // nicht weiter als ein Feld / not further than one tile
    fails(s, { type: 'emplacement', unit: pio.id, x: 2, y: 5 }, 'outOfRange');
    // Berg und Wald gehen / mountain and forest work
    setTerrain(s, 3, 4, 'mountain');
    expect(emplacementCheck(s, pio, 3, 4)).toBe('ok');
    setTerrain(s, 3, 6, 'forest');
    expect(emplacementCheck(s, pio, 3, 6)).toBe('ok');
    // ein Wrack raeumen die Pioniere weg / the pioneers clear a wreck
    tile(s, 3, 6).remains = { kind: 'wreck', unit: 'tank', faction: 1, round: 1 };
    build(s, pio.id, 3, 6);
    expect(tile(s, 3, 6).remains).toBeNull();
  });

  it('Preis, frische Einheit, Limit je Stadt und Mindestabstand / price, fresh unit, limit per city and spacing', () => {
    const { s, pio } = setup({ stars: EMPLACEMENT.cost - 1 });
    fails(s, { type: 'emplacement', unit: pio.id, x: 4, y: 4 }, 'notEnoughStars');
    s.factions[0].stars = 200;
    const fresh = addUnit(s, 'pioneer', 0, 2, 5, { fresh: true });
    fails(s, { type: 'emplacement', unit: fresh.id, x: 2, y: 4 }, 'unitExhausted');
    expect(emplacementLimit(s, 0)).toBe(EMPLACEMENT.perCity);
    build(s, pio.id, 4, 4);
    const p2 = addUnit(s, 'pioneer', 0, 2, 5);
    // eine Stadt, eine Stellung / one city, one emplacement
    fails(s, { type: 'emplacement', unit: p2.id, x: 2, y: 6 }, 'emplacementLimit');
    // zweite Stadt erlaubt eine zweite, aber nicht zu nah / a second city allows a second one, but not too close
    addCity(s, 5, 8, 0);
    expect(emplacementLimit(s, 0)).toBe(2 * EMPLACEMENT.perCity);
    fails(s, { type: 'emplacement', unit: p2.id, x: 2, y: 4 }, 'emplacementSpacing');
    Object.assign(p2, { x: 4, y: 8, startX: 4, startY: 8 });
    build(s, p2.id, 4, 7);
    expect(emplacementsOf(s, 0).length).toBe(2);
    const p3 = addUnit(s, 'pioneer', 0, 6, 8);
    fails(s, { type: 'emplacement', unit: p3.id, x: 6, y: 9 }, 'emplacementLimit');
  });
});

describe('Rundenfeuer / round fire', () => {
  it('feuert einmal je Runde in Reichweite 2 auf Feinde, nie im Frieden oder auf eigene / fires once per round in range 2 at enemies, never at peace or at own units', () => {
    const { s, pio } = setup();
    build(s, pio.id, 4, 4);
    const near = addUnit(s, 'infantry', 1, 6, 4); // Abstand 2 / distance 2
    const far = addUnit(s, 'infantry', 1, 7, 4); // Abstand 3 / distance 3
    const friend = addUnit(s, 'infantry', 2, 4, 2); // Alvenia im Frieden / Alvenia at peace
    const own = addUnit(s, 'infantry', 0, 5, 4);
    peace(s, 0, 2);
    const ev = wrapRound(s);
    const shots = ev.filter((e) => e.t === 'turretFire');
    expect(shots.length).toBe(1);
    const shot = shots[0] as Extract<GameEvent, { t: 'turretFire' }>;
    expect(shot.target).toBe(near.id);
    expect(shot.owner).toBe(0);
    expect(shot.dmg).toBe(turretShotDamage(s, EMPLACEMENT.hp, { ...near, hp: UNITS.infantry.hp }, EMPLACEMENT));
    expect(near.hp).toBe(UNITS.infantry.hp - shot.dmg);
    expect(far.hp).toBe(UNITS.infantry.hp);
    expect(friend.hp).toBe(UNITS.infantry.hp);
    expect(own.hp).toBe(UNITS.infantry.hp);
    // kein Abschuss fuer Dravon / no kill for Dravon
    expect(s.factions[0].kills).toBe(0);
  });

  it('Ziel: toedlicher Treffer zuerst, dann naeher an der Stadt / target: lethal hit first, then closer to the city', () => {
    const { s, pio } = setup();
    build(s, pio.id, 4, 4);
    const a = addUnit(s, 'infantry', 1, 5, 2);
    const b = addUnit(s, 'infantry', 1, 4, 6); // naeher an der Stadt (3,5) / closer to the city (3,5)
    const ev = wrapRound(s);
    expect(ev.find((e) => e.t === 'turretFire' && e.owner === 0)).toMatchObject({ target: b.id });
    a.hp = 2; b.hp = UNITS.infantry.hp;
    const ev2 = wrapRound(s);
    expect(ev2.find((e) => e.t === 'turretFire' && e.owner === 0)).toMatchObject({ target: a.id });
  });

  it('Trefferglueck aus dem Zufallsstrom, deterministisch / hit luck from the random stream, deterministic', () => {
    const { s, pio } = setup({ hitChance: true });
    build(s, pio.id, 4, 4);
    addUnit(s, 'mg', 1, 6, 5);
    const copy = cloneState(s);
    const e1 = wrapRound(s).filter((e) => e.t === 'turretFire');
    const e2 = wrapRound(copy).filter((e) => e.t === 'turretFire');
    expect(JSON.stringify(e1)).toBe(JSON.stringify(e2));
    const shot = e1[0] as Extract<GameEvent, { t: 'turretFire' }>;
    expect(HIT_KINDS).toContain(shot.hit);
    s.units = s.units.filter((u) => u.owner !== 1);
    // viele Runden: verschiedene Trefferarten / many rounds: different hit kinds
    const kinds = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const t = addUnit(s, 'tank', 1, 6, 3);
      for (const e of wrapRound(s)) if (e.t === 'turretFire' && e.owner === 0) { kinds.add(e.hit!); expect(e.dmg).toBe(hitDamage(turretShotDamage(s, EMPLACEMENT.hp, { ...t, hp: UNITS.tank.hp }, EMPLACEMENT), e.hit!)); }
      s.units = s.units.filter((u) => u.id !== t.id);
    }
    expect(kinds.size).toBeGreaterThan(1);
  });
});

describe('Angriff auf Stellungen / attacking emplacements', () => {
  it('Feinde koennen angreifen und zerstoeren, Truemmer bleiben, kein Abschuss / enemies can attack and destroy it, rubble stays, no kill', () => {
    const { s, pio } = setup();
    build(s, pio.id, 4, 4);
    s.current = 1;
    const inf = addUnit(s, 'infantry', 1, 5, 3);
    expect(turretTargets(s, inf)).toEqual([{ x: 4, y: 4 }]);
    const pre = turretPreview(s, inf, { x: 4, y: 4 });
    const r = ok(s, { type: 'attackTurret', unit: inf.id, x: 4, y: 4 });
    const hit = r.events.find((e) => e.t === 'turretHit') as Extract<GameEvent, { t: 'turretHit' }>;
    expect(hit.dmg).toBe(pre.toTurret);
    expect(hit.owner).toBe(0);
    expect(hit.ret).toBe(pre.ret(EMPLACEMENT.hp - pre.toTurret));
    expect(tile(s, 4, 4).turret!.hp).toBe(EMPLACEMENT.hp - hit.dmg);
    const art = addUnit(s, 'artillery', 1, 7, 4);
    tile(s, 4, 4).turret!.hp = 1;
    const r2 = ok(s, { type: 'attackTurret', unit: art.id, x: 4, y: 4 });
    expect(r2.events.find((e) => e.t === 'turretHit')).toMatchObject({ destroyed: true, owner: 0 });
    expect(tile(s, 4, 4).turret).toBeNull();
    expect(tile(s, 4, 4).turretRuin).toBe(true);
    expect(tile(s, 4, 4).turretRuinOwner).toBe(0);
    expect(s.factions[1].kills).toBe(0);
    // Truemmer sind begehbar / rubble is passable
    const walker = addUnit(s, 'infantry', 1, 5, 5);
    expect(reachable(s, walker).some((p) => p.x === 4 && p.y === 4)).toBe(true);
  });

  it('nicht im Frieden und nicht die eigene / not at peace and not the own', () => {
    const { s, pio } = setup();
    build(s, pio.id, 4, 4);
    const own = addUnit(s, 'infantry', 0, 5, 4);
    expect(turretTargets(s, own)).toEqual([]);
    fails(s, { type: 'attackTurret', unit: own.id, x: 4, y: 4 }, 'invalidTarget');
    s.current = 2;
    peace(s, 0, 2);
    const al = addUnit(s, 'infantry', 2, 5, 3);
    expect(turretTargets(s, al)).toEqual([]);
    fails(s, { type: 'attackTurret', unit: al.id, x: 4, y: 4 }, 'peace');
  });
});

describe('Besitzwechsel und Ausscheiden / ownership change and elimination', () => {
  it('Stadt erobert: die Stellung im verlorenen Gebiet wird geschleift / city captured: the emplacement in the lost territory is razed', () => {
    const { s, hq, pio } = setup();
    addCity(s, 1, 1, 0); // zweite Stadt, damit Dravon ueberlebt / second city so Dravon survives
    build(s, pio.id, 4, 4);
    s.current = 1;
    s.units = s.units.filter((u) => u.id !== pio.id);
    const inf = addUnit(s, 'infantry', 1, hq.x, hq.y);
    const r = ok(s, { type: 'capture', unit: inf.id });
    expect(r.events.some((e) => e.t === 'capture')).toBe(true);
    expect(r.events.find((e) => e.t === 'emplacementLost')).toMatchObject({ x: 4, y: 4, faction: 0, reason: 'territory' });
    expect(tile(s, 4, 4).turret).toBeNull();
    expect(tile(s, 4, 4).turretRuin).toBe(true);
    expect(emplacementsOf(s, 0)).toEqual([]);
  });

  it('Dravon scheidet aus: alle Stellungen verschwinden / Dravon is eliminated: all emplacements vanish', () => {
    const { s, hq, pio } = setup();
    build(s, pio.id, 4, 4);
    s.current = 1;
    s.units = s.units.filter((u) => u.owner !== 0);
    const inf = addUnit(s, 'infantry', 1, hq.x, hq.y);
    const r = ok(s, { type: 'capture', unit: inf.id });
    expect(r.events.some((e) => e.t === 'eliminated' && e.faction === 0)).toBe(true);
    expect(r.events.some((e) => e.t === 'emplacementLost' && e.reason === 'eliminated')).toBe(true);
    expect(turretList(s)).toEqual([]);
  });
});

/** Einfacher localStorage-Ersatz fuer Node / simple localStorage stand-in for Node */
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

describe('Speichern / saving', () => {
  const g = globalThis as unknown as { localStorage?: MemStorage };
  let prev: MemStorage | undefined;
  beforeEach(() => { prev = g.localStorage; g.localStorage = new MemStorage(); });
  afterEach(() => { g.localStorage = prev; });

  it('Stellung und Truemmer ueberstehen Speichern und Laden / emplacement and rubble survive save and load', () => {
    const { s, pio } = setup();
    build(s, pio.id, 4, 4);
    tile(s, 1, 1).turretRuin = true; tile(s, 1, 1).turretRuinOwner = 0;
    expect(saveGame(s)).toBe(true);
    const l = loadGame()!;
    expect(l).not.toBeNull();
    expect(tile(l, 4, 4).turret).toEqual({ hp: EMPLACEMENT.hp, active: true, owner: 0 });
    expect(tile(l, 1, 1).turretRuinOwner).toBe(0);
    expect(emplacementsOf(l, 0).length).toBe(1);
    // gleicher Verlauf danach / same course afterwards
    addUnit(s, 'infantry', 1, 6, 4); addUnit(l, 'infantry', 1, 6, 4);
    expect(JSON.stringify(wrapRound(l))).toBe(JSON.stringify(wrapRound(s)));
  });

  it('alte Spielstaende ohne owner: Verdan-Geschuetze bleiben neutral / old saves without owner: Verdan guns stay neutral', () => {
    const s = createGame(missionConfig('m9', 'dravon'));
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    for (const t of old.tiles) { if (t.turret) delete t.turret.owner; delete t.turretRuinOwner; }
    expect(isValidState(old)).toBe(true);
    g.localStorage!.setItem('frontverlauf.save.v1', JSON.stringify(old));
    const l = loadGame()!;
    const guns = turretList(l);
    expect(guns.length).toBe(VERDAN.count);
    expect(guns.every((p) => p.owner === undefined && gunStats(p) === VERDAN)).toBe(true);
    expect(emplacementsOf(l, 0)).toEqual([]);
  });
});

describe('Verdan unveraendert / Verdan unchanged', () => {
  it('neutrale Geschuetze haben keinen Besitzer und feuern weiter auf jede Fraktion / neutral guns have no owner and keep firing at any faction', () => {
    const s = createGame(missionConfig('m9', 'dravon'));
    expect(turretList(s).every((p) => p.owner === undefined && !p.active)).toBe(true);
    // Dravon-Einheit neben ein Geschuetz: auch die eigene Partei darf es angreifen / Dravon unit next to a gun: may attack it
    const gun = turretList(s)[0];
    const u = s.units.find((o) => o.owner === 0)!;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: gun.x + dx, y: gun.y + dy }))
      .find((p) => !s.tiles[p.y * s.size + p.x].turret && s.tiles[p.y * s.size + p.x].cityId === null)!;
    s.units = s.units.filter((o) => o === u || !(o.x === spot.x && o.y === spot.y));
    Object.assign(u, { x: spot.x, y: spot.y, fresh: false, exhausted: false, moved: false, attacked: false });
    s.factions[0].explored = s.factions[0].explored.map(() => 1);
    if (UNITS[u.type].attack > 0) expect(turretTargets(s, u).some((p) => p.x === gun.x && p.y === gun.y)).toBe(true);
  });
});
