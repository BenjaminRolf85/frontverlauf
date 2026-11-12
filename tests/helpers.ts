/**
 * Test-Hilfen: leere, kontrollierte Spielzustaende bauen.
 * Test helpers: build empty, controlled game states (the state is plain JSON data).
 */
import { expect } from 'vitest';
import {
  applyCommand, createGame, defaultConfig, idx, type City, type Command, type CommandResult, type GameState, type Tile,
  type Unit,
} from '../src/core';
import {
  CITY, FUEL, UNITS, type FactionId, type GameMode, type MapSize, type TerrainId, type UnitTypeId,
} from '../src/data/balance';

export interface BlankOptions {
  size?: MapSize;
  factions?: FactionId[];
  stars?: number;
  mode?: GameMode;
  /** alle Fraktionen kennen sich bereits (keine Erstkontakt-Sterne) / all factions already know each other */
  contacts?: boolean;
  seed?: number;
  roundLimit?: number | null;
  weather?: boolean;
}

/**
 * Leere Ebene ohne Staedte, Einheiten, Ressourcen und Nebelaufdeckung. Runde 2, Fraktion 0 am Zug.
 * Empty plain map without cities, units, resources or revealed fog. Round 2, faction 0 to move.
 */
export function blankGame(o: BlankOptions = {}): GameState {
  const factions = (o.factions ?? ['korvat', 'dravon']).map((id) => ({ id, human: true, difficulty: 'normal' as const }));
  const s = createGame(defaultConfig({
    seed: o.seed ?? 1, size: o.size ?? 11, mapType: 'continent', mode: o.mode ?? 'sandbox', factions,
    startStars: o.stars ?? 0, roundLimit: o.roundLimit, weather: o.weather ?? false,
  }));
  const n = s.size * s.size;
  for (const t of s.tiles) {
    Object.assign(t, {
      terrain: 'plain', resource: null, building: null, road: false, cityId: null, territory: null, feature: null,
      outpost: null, grandProject: null, researchBuilt: null, remains: null,
    } satisfies Partial<Tile>);
  }
  s.cities = [];
  s.units = [];
  s.pendingRewards = [];
  s.log = [];
  s.round = 2;
  s.current = 0;
  for (const f of s.factions) {
    f.stars = o.stars ?? 0;
    f.maxStars = f.stars;
    f.explored = new Array(n).fill(0);
    f.contacts = o.contacts === false ? [] : s.factions.filter((g) => g.index !== f.index).map((g) => g.index);
    f.kills = 0;
    f.lastAttackRound = s.round;
    f.grandProjectsUnlocked = [];
    f.grandProjectsBuilt = [];
    f.radarsFound = [];
    f.peaceOffers = [];
    f.embassies = [];
  }
  return s;
}

export function tile(s: GameState, x: number, y: number): Tile {
  return s.tiles[idx(s.size, x, y)];
}

export function setTerrain(s: GameState, x: number, y: number, terrain: TerrainId, extra: Partial<Tile> = {}): Tile {
  const t = tile(s, x, y);
  t.terrain = terrain;
  Object.assign(t, extra);
  return t;
}

export interface CityOptions { level?: number; hq?: boolean; radius?: number; pop?: number }

/** Stadt mit Stadtgebiet anlegen / add a city with territory */
export function addCity(s: GameState, x: number, y: number, owner: number | null, o: CityOptions = {}): City {
  const c: City = {
    id: s.nextId++, x, y, owner, level: o.level ?? 1, pop: o.pop ?? 0, radius: o.radius ?? CITY.baseRadius,
    isHQ: !!o.hq, hqOf: o.hq ? owner : null, factory: false, bunkerRing: false, govQuarter: false, connected: false,
    noIncomeNext: false, nameIndex: s.cities.length,
  };
  s.cities.push(c);
  const t = tile(s, x, y);
  t.cityId = c.id;
  t.terrain = t.terrain === 'shallow' || t.terrain === 'ocean' ? 'plain' : t.terrain;
  if (owner !== null) {
    for (let dy = -c.radius; dy <= c.radius; dy++) {
      for (let dx = -c.radius; dx <= c.radius; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= s.size || yy >= s.size) continue;
        const tt = tile(s, xx, yy);
        if (tt.territory === null) tt.territory = c.id;
      }
    }
    t.territory = c.id;
  }
  return c;
}

export interface UnitOptions { hp?: number; carried?: UnitTypeId | null; fresh?: boolean; homeCity?: number | null; fuel?: number | null }

/** Einsatzbereite Einheit anlegen / add a ready unit */
export function addUnit(s: GameState, type: UnitTypeId, owner: number, x: number, y: number, o: UnitOptions = {}): Unit {
  const st = UNITS[type];
  const carried = o.carried !== undefined ? o.carried : st.ship ? 'infantry' : null;
  const maxHp = carried ? UNITS[carried].hp : st.hp;
  const u: Unit = {
    id: s.nextId++, type, carried, owner, x, y, hp: o.hp ?? maxHp, maxHp, homeCity: o.homeCity ?? null, kills: 0,
    veteran: false, moved: false, attacked: false, moveDone: false, exhausted: !!o.fresh, fresh: !!o.fresh,
    fuel: o.fuel !== undefined ? o.fuel : st.abilities.includes('fuel') ? FUEL.tank : null, revealed: false,
    startX: x, startY: y,
  };
  s.units.push(u);
  return u;
}

/** Kommando, das gelingen muss / command that must succeed */
export function ok(s: GameState, cmd: Command): CommandResult {
  const r = applyCommand(s, cmd);
  expect(r.error, `command ${JSON.stringify(cmd)}`).toBeUndefined();
  expect(r.ok).toBe(true);
  return r;
}

/** Kommando, das mit diesem Fehler scheitern muss / command that must fail with this error */
export function fails(s: GameState, cmd: Command, error?: string): CommandResult {
  const before = JSON.stringify(s);
  const r = applyCommand(s, cmd);
  expect(r.ok).toBe(false);
  if (error) expect(r.error).toBe(error);
  expect(JSON.stringify(s)).toBe(before); // ungueltige Kommandos aendern nichts / invalid commands change nothing
  return r;
}

export function endTurn(s: GameState): CommandResult {
  return ok(s, { type: 'endTurn' });
}

/** Zuege beenden, bis Fraktion f wieder am Zug ist / end turns until faction f moves again */
export function untilTurnOf(s: GameState, f: number): void {
  endTurn(s);
  let guard = 0;
  while (s.current !== f && !s.over) {
    endTurn(s);
    if (++guard > 20) throw new Error('loop');
  }
}

export const explored = (s: GameState, f: number, x: number, y: number) => s.factions[f].explored[idx(s.size, x, y)] === 1;

export function revealAll(s: GameState, f: number): void {
  s.factions[f].explored = s.factions[f].explored.map(() => 1);
}

export function unit(s: GameState, id: number): Unit | undefined {
  return s.units.find((u) => u.id === id);
}
