/**
 * Kleine Werkzeuge fuer Zufallsereignisse und Kampagnen-Einrichtung (ohne Abhaengigkeit von rules.ts).
 * Small helpers for random events and campaign setup (without depending on rules.ts).
 */
import { CITY, FUEL, UNITS, type UnitTypeId } from '../data/balance';
import { area, dist, idx, isLand, isWater, tileAt } from './grid';
import { unitAt } from './queries';
import type { City, GameState, Pos, Unit } from './types';

/**
 * Einheit anlegen. ready = sofort einsatzbereit (sonst erst im naechsten eigenen Zug).
 * Add a unit. ready = can act at once (otherwise from its next own turn).
 */
export function placeUnit(s: GameState, type: UnitTypeId, owner: number, x: number, y: number, ready: boolean, carried: UnitTypeId | null = null): Unit {
  const st = UNITS[type];
  const hp = carried ? UNITS[carried].hp : st.hp;
  const u: Unit = {
    id: s.nextId++, type, carried, owner, x, y, hp, maxHp: hp, homeCity: null, kills: 0, veteran: false,
    moved: false, attacked: false, moveDone: false, exhausted: !ready, fresh: !ready,
    fuel: st.abilities.includes('fuel') ? FUEL.tank : null, revealed: false, startX: x, startY: y,
  };
  s.units.push(u);
  return u;
}

/** Feld fuer eine Einheit dieses Typs geeignet und frei? / tile suitable and free for a unit of this type? */
export function freeFor(s: GameState, type: UnitTypeId, p: Pos): boolean {
  const t = tileAt(s, p.x, p.y);
  if (!t || unitAt(s, p.x, p.y)) return false;
  if (UNITS[type].ship) return isWater(t) && t.cityId === null;
  if (!isLand(t)) return false;
  if (t.terrain === 'mountain' || t.volcano) return false;
  return true;
}

/**
 * Naechstes Feld (Schachbrett-Ringe, dann Index), das die Bedingung erfuellt. Deterministisch.
 * Nearest tile (Chebyshev rings, then index) that fulfils the predicate. Deterministic.
 */
export function nearestTile(s: GameState, from: Pos, pred: (p: Pos) => boolean, maxR = s.size): Pos | null {
  for (let r = 0; r <= maxR; r++) {
    for (const p of area(s.size, from.x, from.y, r)) {
      if (dist(p, from) !== r) continue;
      if (pred(p)) return p;
    }
  }
  return null;
}

/** Aufdecken ohne Radar-Felder (die findet rules.ts selbst) / reveal without radar tiles (rules.ts finds those) */
export function revealArea(s: GameState, f: number, x: number, y: number, r: number) {
  const fa = s.factions[f];
  for (const p of area(s.size, x, y, r)) {
    const k = idx(s.size, p.x, p.y);
    if (s.tiles[k].feature === 'radar') continue;
    fa.explored[k] = 1;
  }
}

/** Neutrale Siedlung einer Fraktion geben (mit Stadtgebiet) / give a neutral settlement to a faction (with territory) */
export function grantCity(s: GameState, c: City, owner: number) {
  c.owner = owner;
  c.level = Math.max(1, c.level);
  c.radius = CITY.baseRadius;
  for (const p of area(s.size, c.x, c.y, c.radius)) {
    const t = tileAt(s, p.x, p.y)!;
    if (t.territory === null && (t.cityId === null || t.cityId === c.id)) t.territory = c.id;
  }
  tileAt(s, c.x, c.y)!.territory = c.id;
  revealArea(s, owner, c.x, c.y, c.radius + 1);
}
