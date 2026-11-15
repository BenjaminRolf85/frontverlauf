/**
 * Kampagne m2 (Das Mutterschiff): das abgestuerzte Zyrr-Mutterschiff als 2x2-Wahrzeichen und der Wissenschaftler, der
 * daneben arbeitet. Reine Abfragen, die Platzierung und das Kommando 'workShip'; campaign.ts wertet die Ziele aus.
 * Die vier Schiffsfelder tragen feature 'mothership': unpassierbar (Bewegung, Aufstellen, Wegefelder der KI), nicht
 * bebaubar, nicht einnehmbar und nicht angreifbar. Deterministisch, ohne Zufall.
 * Campaign m2 (The Mothership): the crashed Zyrr mothership as a 2x2 landmark and the scientist working next to it.
 * Pure queries, the placement and the 'workShip' command; campaign.ts evaluates the objectives.
 * The four ship tiles carry feature 'mothership': impassable (movement, placing units, AI path fields), not buildable,
 * not capturable and not attackable. Deterministic, without randomness.
 */
import { M2 } from '../data/balance';
import { isLand, neighbors, tileAt } from './grid';
import { unitAt } from './queries';
import { revealArea } from './spawn';
import type { ErrorCode, GameEvent, GameState, Pos, Tile, Unit } from './types';

/** Kantenlaenge des Schiffs in Feldern / edge length of the ship in tiles */
export const SHIP_SIZE = 2;

/** Feld des Mutterschiffs? / tile of the mothership? */
export const isShipTile = (t: Tile | undefined | null): boolean => t?.feature === 'mothership';

/** Die vier Felder des Schiffs (linke obere Ecke p) / the four tiles of the ship (top-left corner p) */
export function shipTiles(p: Pos): Pos[] {
  const out: Pos[] = [];
  for (let dy = 0; dy < SHIP_SIZE; dy++) for (let dx = 0; dx < SHIP_SIZE; dx++) out.push({ x: p.x + dx, y: p.y + dy });
  return out;
}

/**
 * Schachbrett-Abstand eines Feldes zum Schiff: 0 = auf dem Schiff, 1 = daneben (auch diagonal).
 * Chebyshev distance of a tile to the ship: 0 = on the ship, 1 = next to it (diagonals too).
 */
export function shipDist(ship: Pos, q: Pos): number {
  const gap = (v: number, lo: number) => (v < lo ? lo - v : v > lo + SHIP_SIZE - 1 ? v - (lo + SHIP_SIZE - 1) : 0);
  return Math.max(gap(q.x, ship.x), gap(q.y, ship.y));
}

/** Steht q direkt neben dem Mutterschiff dieser Partie? / is q right next to this game's mothership? */
export function nextToShip(s: GameState, q: Pos): boolean {
  const ship = s.campaign?.ship;
  return !!ship && shipDist(ship, q) === 1;
}

/** Felder rund um das Schiff (Arbeitsplaetze), in Leserichtung / tiles around the ship (work spots), in reading order */
export function workSpots(s: GameState): Pos[] {
  const ship = s.campaign?.ship;
  if (!ship) return [];
  const out: Pos[] = [];
  for (let y = ship.y - 1; y <= ship.y + SHIP_SIZE; y++) for (let x = ship.x - 1; x <= ship.x + SHIP_SIZE; x++) {
    if (x < 0 || y < 0 || x >= s.size || y >= s.size || shipDist(ship, { x, y }) !== 1) continue;
    out.push({ x, y });
  }
  return out;
}

/** Wissenschaftler dieser Partie (lebend) / this game's scientist (alive) */
export function scientistOf(s: GameState): Unit | undefined {
  const id = s.campaign?.scientist;
  return id === undefined ? undefined : s.units.find((u) => u.id === id);
}

/** Geleistete und noetige Arbeitsrunden / work rounds done and needed */
export const shipWork = (s: GameState) => ({ have: s.campaign?.work ?? 0, need: M2.workRounds });

/**
 * Darf u jetzt am Schiff arbeiten? Nur der Wissenschaftler, nicht frisch, nicht erschoepft, einmal je Runde und nur direkt
 * neben dem Schiff (eine Bewegung davor ist erlaubt).
 * May u work on the ship now? Only the scientist, not fresh, not exhausted, once per round and only right next to the
 * ship (a move before it is allowed).
 */
export function workCheck(s: GameState, u: Unit): 'ok' | ErrorCode {
  const c = s.campaign;
  if (!c?.ship || c.result || u.type !== 'scientist' || c.scientist !== u.id) return 'invalid';
  if (u.fresh) return 'fresh';
  if (u.exhausted || c.workRound === s.round) return 'unitExhausted';
  if (shipDist(c.ship, u) !== 1) return 'outOfRange';
  return 'ok';
}

/** Eine Arbeitsrunde: zaehlt mit, beendet den Zug des Wissenschaftlers / one work round: counts up, ends the scientist's turn */
export function doWork(s: GameState, u: Unit, ev: GameEvent[]) {
  const c = s.campaign!;
  c.work = (c.work ?? 0) + 1;
  c.workRound = s.round;
  u.exhausted = true;
  u.moveDone = true;
  ev.push({ t: 'shipWork', unit: u.id, have: c.work, need: M2.workRounds, x: u.x, y: u.y });
}

/** Freies, flaches Land ohne Stadt, Merkmal, Geschuetz und Einheit / free flat land without city, feature, gun and unit */
function open(s: GameState, q: Pos): boolean {
  const t = tileAt(s, q.x, q.y);
  return !!t && isLand(t) && t.cityId === null && t.terrain !== 'mountain' && !t.volcano && !t.feature && !t.turret && !t.wonderOf && !unitAt(s, q.x, q.y);
}

/** Ringfeld: Land ohne Stadt, Vulkan, Geschuetz und Einheit; Berge werden eingeebnet / ring tile: land without city, volcano, gun and unit; mountains get levelled */
function ringOk(s: GameState, q: Pos): boolean {
  const t = tileAt(s, q.x, q.y);
  return !!t && isLand(t) && t.cityId === null && !t.volcano && !t.feature && !t.turret && !t.wonderOf && !unitAt(s, q.x, q.y);
}

/** Begehbares Land fuer die Erreichbarkeit (ohne Berge und Wasser) / walkable land for reachability (no mountains, no water) */
function walk(s: GameState, q: Pos, ship: Pos | null): boolean {
  const t = tileAt(s, q.x, q.y);
  return !!t && isLand(t) && t.terrain !== 'mountain' && !t.volcano && !t.turret && !(ship && shipDist(ship, q) === 0);
}

/** Landweg-Abstaende ab from (Schritte, -1 = unerreichbar) / land path distances from from (steps, -1 = unreachable) */
function landSteps(s: GameState, from: Pos, ship: Pos | null): Int16Array {
  const d = new Int16Array(s.size * s.size).fill(-1);
  const q: Pos[] = [from];
  d[from.y * s.size + from.x] = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    for (const n of neighbors(s.size, p.x, p.y)) {
      const k = n.y * s.size + n.x;
      if (d[k] >= 0 || !walk(s, n, ship)) continue;
      d[k] = d[p.y * s.size + p.x] + 1;
      q.push(n);
    }
  }
  return d;
}

/**
 * Bauplatz fuer das Mutterschiff: vier freie Landfelder (2x2) shipMin..shipMax Felder vom eigenen Hauptquartier,
 * mindestens zyrrDistance vom Hauptquartier der Zyrr, keine Stadt neben dem Schiff, genug freies Land rundherum und
 * ueber Land erreichbar. Bevorzugt die Richtung zu den Zyrr und den Abstand (shipMin + shipMax) / 2; bei Gleichstand
 * der kleinste Index. Reicht der Platz nicht, werden die Bedingungen schrittweise gelockert.
 * Building spot for the mothership: four free land tiles (2x2) shipMin..shipMax tiles from the own HQ, at least
 * zyrrDistance from the Zyrr HQ, no city next to the ship, enough free land around it and reachable over land. Prefers
 * the direction of the Zyrr and the distance (shipMin + shipMax) / 2; ties: the lowest index. If there is no room, the
 * conditions are relaxed step by step.
 */
export function findShipSpot(s: GameState, home: Pos, enemy: Pos): Pos | null {
  const steps = landSteps(s, home, null);
  const want = (M2.shipMin + M2.shipMax) / 2;
  const dir = { x: enemy.x - home.x, y: enemy.y - home.y };
  const len = Math.max(1, Math.hypot(dir.x, dir.y));
  for (const slack of [0, 1, 2, 3]) {
    let best: Pos | null = null, bestScore = Infinity;
    for (let y = 1; y + SHIP_SIZE < s.size; y++) for (let x = 1; x + SHIP_SIZE < s.size; x++) {
      const p = { x, y };
      if (!shipTiles(p).every((q) => open(s, q))) continue;
      const d = shipDist(p, home);
      if (d < M2.shipMin - slack || d > M2.shipMax + slack) continue;
      if (shipDist(p, enemy) < M2.zyrrDistance - Math.min(slack, 2)) continue;
      if (s.cities.some((c) => shipDist(p, c) < 2)) continue;
      // Ring: freies Land und mindestens ein Feld ueber Land erreichbar / ring: free land and at least one tile reachable over land
      let land = 0, reach = false;
      for (let yy = y - 1; yy <= y + SHIP_SIZE; yy++) for (let xx = x - 1; xx <= x + SHIP_SIZE; xx++) {
        const q = { x: xx, y: yy };
        if (shipDist(p, q) !== 1 || !ringOk(s, q)) continue;
        land++;
        if (steps[yy * s.size + xx] >= 0) reach = true;
      }
      if (!reach || land < M2.ringLand - slack * 2) continue;
      // Richtung zum Gegner: Abweichung vom Strahl Hauptquartier -> Zyrr / direction to the enemy: deviation from the ray HQ -> Zyrr
      const cx = x + 0.5 - home.x, cy = y + 0.5 - home.y;
      const along = (cx * dir.x + cy * dir.y) / len;
      const side = Math.abs(cx * dir.y - cy * dir.x) / len;
      const score = Math.abs(d - want) * 4 + side * 1.5 - Math.min(along, want) * 0.5 - land * 0.3;
      if (score < bestScore - 1e-9) { bestScore = score; best = p; }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Mutterschiff auf p setzen: vier geraeumte Ebenen mit feature 'mothership' und gleicher Landschaftszone (gleiche
 * Hoehe fuer das Modell); alle Fraktionen kennen das Schiff und seine Umgebung.
 * Put the mothership onto p: four cleared plains with feature 'mothership' and the same biome (same height for the
 * model); every faction knows the ship and its surroundings.
 */
export function placeShip(s: GameState, p: Pos) {
  const biome = tileAt(s, p.x, p.y)!.biome === 'jungle' ? 'grassland' : tileAt(s, p.x, p.y)!.biome;
  for (const q of shipTiles(p)) {
    Object.assign(tileAt(s, q.x, q.y)!, {
      terrain: 'plain', biome, feature: 'mothership', resource: null, building: null, road: false, river: false, mine: null, barrier: null,
      remains: null, outpost: null, grandProject: null, looted: false, xeno: false, marks: [], tracks: [],
    });
  }
  // der Aufprall hat die Berge rundherum eingeebnet: die Arbeitsplaetze sind begehbar / the impact levelled the mountains around: the work spots are walkable
  for (let y = p.y - 1; y <= p.y + SHIP_SIZE; y++) for (let x = p.x - 1; x <= p.x + SHIP_SIZE; x++) {
    const t = tileAt(s, x, y);
    if (!t || shipDist(p, { x, y }) !== 1 || t.terrain !== 'mountain' || t.cityId !== null || t.turret) continue;
    Object.assign(t, { terrain: 'plain', volcano: false, peak: undefined, building: null, mine: null });
    if (t.resource === 'ore') t.resource = null;
  }
  for (const f of s.factions) for (const q of shipTiles(p)) revealArea(s, f.index, q.x, q.y, 1);
}

/** Wissenschaftler neben dem Schiff? / scientist next to the ship? */
export const scientistAtShip = (s: GameState) => { const u = scientistOf(s); return !!u && nextToShip(s, u); };

