/**
 * Sendetuerme: neutrale Orte wie Nachschublinien (einnehmbar, bilden aus, wachsen nicht, festes Einkommen). Gemeinsam fuer
 * Kampagne (campaign.ts, mit Missionsausnahmen) und freie Partien (rules.ts, createGame). Zahlen: TOWER.
 * Transmitter towers: neutral places like supply lines (capturable, they train, do not grow, fixed income). Shared by the
 * campaign (campaign.ts, with mission exclusions) and free games (rules.ts, createGame). Numbers: TOWER.
 */
import { CITY, TOWER } from '../data/balance';
import { dist, tileAt } from './grid';
import { openLand } from './spawn';
import type { City, GameState, Pos } from './types';

/**
 * Anzahl Sendetuerme fuer eine Kartengroesse: Felder / TOWER.perTiles, begrenzt auf TOWER.min..TOWER.max
 * (14x14: 3, 16x16: 4, 11x11: 2).
 * Number of transmitter towers for a map size: tiles / TOWER.perTiles, clamped to TOWER.min..TOWER.max
 * (14x14: 3, 16x16: 4, 11x11: 2).
 */
export function towerCountFor(size: number): number {
  return Math.max(TOWER.min, Math.min(TOWER.max, Math.round((size * size) / TOWER.perTiles)));
}

/**
 * Sendetuerme verteilen: freies, flaches Land fern von Hauptquartieren, Staedten und einander; jeweils das Feld mit dem
 * groessten Mindestabstand zu Hauptquartieren und schon gesetzten Tuermen (bei Gleichstand der kleinste Index).
 * Rein deterministisch aus dem Spielstand (kein Zufall). blocked: zusaetzlich gesperrte Felder (Kampagne). hqDistances:
 * Mindestabstaende zu Hauptquartieren der Reihe nach; der naechste gilt erst, wenn mit dem vorigen kein Feld mehr frei ist
 * (Kampagne nur TOWER.hqDistance, freie Partien danach TOWER.freeHqDistance).
 * Place transmitter towers: free flat land far from HQs, cities and each other; each time the tile with the largest
 * minimum distance to HQs and already placed towers (ties: lowest index). Purely deterministic from the state (no
 * randomness). blocked: additionally blocked tiles (campaign). hqDistances: minimum distances to HQs in order; the next
 * one applies only once no tile is left with the previous one (campaign only TOWER.hqDistance, free games then
 * TOWER.freeHqDistance).
 */
export function placeTowers(s: GameState, count: number, blocked?: (q: Pos) => boolean, hqDistances: number[] = [TOWER.hqDistance]): City[] {
  const hqs = s.cities.filter((x) => x.isHQ);
  const placed: Pos[] = [];
  const out: City[] = [];
  let pass = 0;
  while (placed.length < count && pass < hqDistances.length) {
    const hqDistance = hqDistances[pass];
    let best: Pos | null = null, bestD = -1;
    for (let y = 1; y < s.size - 1; y++) for (let x = 1; x < s.size - 1; x++) {
      const q = { x, y };
      const t = tileAt(s, x, y)!;
      if (!openLand(s, q) || t.terrain !== 'plain' || t.turret) continue;
      if (hqs.some((h) => dist(h, q) < hqDistance) || s.cities.some((c) => dist(c, q) < TOWER.cityDistance)) continue;
      if (placed.some((p) => dist(p, q) < TOWER.spacing)) continue;
      if (blocked?.(q)) continue;
      const d = Math.min(...hqs.map((h) => dist(h, q)), ...placed.map((p) => dist(p, q) * 1.5));
      if (d > bestD) { bestD = d; best = q; }
    }
    if (!best) { pass++; continue; }
    placed.push(best);
    const c: City = {
      id: s.nextId++, x: best.x, y: best.y, owner: null, level: 1, pop: 0, radius: CITY.baseRadius, isHQ: false, hqOf: null, factory: false,
      bunkerRing: false, govQuarter: false, connected: false, noIncomeNext: false, nameIndex: s.cities.length, tower: true,
    };
    s.cities.push(c);
    out.push(c);
    Object.assign(tileAt(s, best.x, best.y)!, { cityId: c.id, resource: null, feature: null, road: false, building: null });
  }
  return out;
}
