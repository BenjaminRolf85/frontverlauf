/**
 * Kampagne m2 (Das Mutterschiff, alle gegen alle): das abgestuerzte Zyrr-Mutterschiff als 2x2-Wahrzeichen in der
 * Kartenmitte und die Wissenschaftler aller Fraktionen, die daneben um die Wette arbeiten. Reine Abfragen, die
 * Platzierung, das Kommando 'workShip' und das Ende der Waffenruhe; campaign.ts wertet die Ziele aus.
 * Die vier Schiffsfelder tragen feature 'mothership': unpassierbar (Bewegung, Aufstellen, Wegefelder der KI), nicht
 * bebaubar, nicht einnehmbar und nicht angreifbar. Deterministisch, ohne Zufall.
 * Campaign m2 (The Mothership, free-for-all): the crashed Zyrr mothership as a 2x2 landmark in the map centre and the
 * scientists of every faction racing to work next to it. Pure queries, the placement, the 'workShip' command and the end
 * of the truce; campaign.ts evaluates the objectives.
 * The four ship tiles carry feature 'mothership': impassable (movement, placing units, AI path fields), not buildable,
 * not capturable and not attackable. Deterministic, without randomness.
 */
import { M2 } from '../data/balance';
import { isLand, neighbors, tileAt } from './grid';
import { revealArea } from './spawn';
import type { ErrorCode, GameEvent, GameState, Pos, RaceState, Tile, Unit } from './types';

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

/** Wissenschaftler des Spielers (lebend) / the player's scientist (alive) */
export function scientistOf(s: GameState): Unit | undefined {
  const id = s.campaign?.scientist;
  return id === undefined ? undefined : s.units.find((u) => u.id === id);
}

/** Wettlauf dieser Partie (m2, alle gegen alle) / race of this game (m2, free-for-all) */
export const raceOf = (s: GameState): RaceState | undefined => s.campaign?.race;
/** Eintrag eines KI-Forschers im Wettlauf / entry of an AI researcher in the race */
export const rivalOf = (s: GameState, f: number) => s.campaign?.race?.rivals.find((r) => r.faction === f);

/** Wissenschaftler (Forscher) der Fraktion f, lebend / scientist (researcher) of faction f, alive */
export function samplerOf(s: GameState, f: number): Unit | undefined {
  if (f === 0) return scientistOf(s);
  const id = rivalOf(s, f)?.unit;
  return id === null || id === undefined ? undefined : s.units.find((u) => u.id === id);
}

/** Ist u der Wissenschaftler seiner Fraktion? / is u the scientist of its faction? */
export const isSampler = (s: GameState, u: Unit) => u.type === 'scientist' && samplerOf(s, u.owner)?.id === u.id;

/** Geleistete Arbeitsrunden der Fraktion f / work rounds done by faction f */
export const workOf = (s: GameState, f: number) => (f === 0 ? s.campaign?.work ?? 0 : rivalOf(s, f)?.work ?? 0);

/** Geleistete und noetige Arbeitsrunden (Standard: Spieler) / work rounds done and needed (default: player) */
export const shipWork = (s: GameState, f = 0) => ({ have: workOf(s, f), need: M2.workRounds });

/** Eintrag im Stand des Wettlaufs / entry in the race standings */
export interface RaceEntry { faction: number; work: number; alive: boolean; pending: boolean }

/**
 * Stand des Wettlaufs: jede Fraktion mit Wissenschaftler (der Spieler zuerst), Arbeit, ob er lebt oder noch kommt.
 * Ohne Wettlauf nur der Spieler.
 * Race standings: every faction with a scientist (the player first), work, whether it lives or is still to come.
 * Without a race only the player.
 */
export function raceStandings(s: GameState): RaceEntry[] {
  const out: RaceEntry[] = [{ faction: 0, work: s.campaign?.work ?? 0, alive: !!scientistOf(s), pending: false }];
  for (const r of s.campaign?.race?.rivals ?? []) {
    out.push({ faction: r.faction, work: r.work, alive: !!samplerOf(s, r.faction), pending: r.unit === null && !r.fallen });
  }
  return out;
}

/** Runde der letzten Arbeit der Fraktion f / round of faction f's last work */
const lastWork = (s: GameState, f: number) => (f === 0 ? s.campaign?.workRound : rivalOf(s, f)?.round ?? undefined);

/**
 * Darf u jetzt am Schiff arbeiten? Nur der Wissenschaftler seiner Fraktion, nicht frisch, nicht erschoepft, einmal je
 * Runde und nur direkt neben dem Schiff (eine Bewegung davor ist erlaubt).
 * May u work on the ship now? Only its faction's scientist, not fresh, not exhausted, once per round and only right next
 * to the ship (a move before it is allowed).
 */
export function workCheck(s: GameState, u: Unit): 'ok' | ErrorCode {
  const c = s.campaign;
  if (!c?.ship || c.result || !isSampler(s, u)) return 'invalid';
  if (u.fresh) return 'fresh';
  if (u.exhausted || lastWork(s, u.owner) === s.round) return 'unitExhausted';
  if (shipDist(c.ship, u) !== 1) return 'outOfRange';
  return 'ok';
}

/**
 * Waffenruhe beenden: faction hat als Erste am Schiff gearbeitet; ab jetzt herrscht Krieg zwischen allen Fraktionen,
 * offene Friedensangebote und angekuendigte Brueche verfallen.
 * End the truce: faction worked at the ship first; from now on all factions are at war, open peace offers and announced
 * breaks lapse.
 */
export function breakTruce(s: GameState, faction: number, ev: GameEvent[]) {
  const r = s.campaign?.race;
  if (!r?.truce) return;
  r.truce = false;
  r.opener = faction;
  r.round = s.round;
  for (const a of s.factions) {
    a.peaceOffers = [];
    a.relations = a.relations.map((rel, b) => (b === a.index ? rel : 'war'));
    a.breakRound = a.breakRound.map(() => null);
  }
  ev.push({ t: 'truceBroken', faction, round: s.round });
}

/**
 * Eine Arbeitsrunde: zaehlt fuer die Fraktion mit, beendet den Zug des Wissenschaftlers; die erste Arbeit bricht die
 * Waffenruhe; wer zuerst M2.workRounds erreicht, hat die Probe (race.winner).
 * One work round: counts for the faction, ends the scientist's turn; the first work breaks the truce; whoever first
 * reaches M2.workRounds has the sample (race.winner).
 */
export function doWork(s: GameState, u: Unit, ev: GameEvent[]) {
  const c = s.campaign!;
  let have: number;
  if (u.owner === 0) {
    c.work = (c.work ?? 0) + 1;
    c.workRound = s.round;
    have = c.work;
  } else {
    const r = rivalOf(s, u.owner)!;
    r.work++;
    r.round = s.round;
    have = r.work;
  }
  u.exhausted = true;
  u.moveDone = true;
  ev.push({ t: 'shipWork', unit: u.id, have, need: M2.workRounds, x: u.x, y: u.y, faction: u.owner });
  if (c.race) {
    breakTruce(s, u.owner, ev);
    if (have >= M2.workRounds && c.race.winner === null) c.race.winner = u.owner;
  }
}

/**
 * Gefallene Forscher austragen (nach jedem Kommando): unit wird null, fallen true.
 * Strike off fallen researchers (after every command): unit becomes null, fallen true.
 */
export function updateRace(s: GameState) {
  for (const r of s.campaign?.race?.rivals ?? []) {
    if (r.unit !== null && !s.units.some((u) => u.id === r.unit)) { r.unit = null; r.fallen = true; }
  }
}

/** Linke obere Ecke des Schiffs genau in der Kartenmitte / top-left corner of the ship exactly in the map centre */
export const centreShip = (size: number): Pos => ({ x: Math.floor((size - SHIP_SIZE) / 2), y: Math.floor((size - SHIP_SIZE) / 2) });

/**
 * Erreicht man von from aus einen Arbeitsplatz ueber Land (ohne Berge, Wasser und Vulkane)?
 * Can a work spot be reached from from over land (without mountains, water and volcanoes)?
 */
export function shipReachable(s: GameState, from: Pos): boolean {
  const ship = s.campaign?.ship;
  if (!ship) return false;
  const steps = landSteps(s, from, ship);
  return workSpots(s).some((p) => steps[p.y * s.size + p.x] >= 0);
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
 * Mutterschiff auf p setzen: vier geraeumte Ebenen mit feature 'mothership' und gleicher Landschaftszone (gleiche
 * Hoehe fuer das Modell); Berge bis crater Felder um das Schiff werden eingeebnet; alle Fraktionen kennen das Schiff
 * und seine Umgebung.
 * Put the mothership onto p: four cleared plains with feature 'mothership' and the same biome (same height for the
 * model); mountains up to crater tiles around the ship get levelled; every faction knows the ship and its surroundings.
 */
export function placeShip(s: GameState, p: Pos, crater = 1) {
  const biome = tileAt(s, p.x, p.y)!.biome === 'jungle' ? 'grassland' : tileAt(s, p.x, p.y)!.biome;
  for (const q of shipTiles(p)) {
    Object.assign(tileAt(s, q.x, q.y)!, {
      terrain: 'plain', biome, feature: 'mothership', resource: null, building: null, road: false, river: false, mine: null, barrier: null,
      remains: null, outpost: null, grandProject: null, looted: false, xeno: false, marks: [], tracks: [],
    });
  }
  // der Aufprall hat die Berge im Krater (crater Felder um das Schiff) eingeebnet: Arbeitsplaetze und Anmarsch sind begehbar
  // the impact levelled the mountains in the crater (crater tiles around the ship): work spots and approaches are walkable
  for (let y = p.y - crater; y < p.y + SHIP_SIZE + crater; y++) for (let x = p.x - crater; x < p.x + SHIP_SIZE + crater; x++) {
    const t = tileAt(s, x, y);
    const d = shipDist(p, { x, y });
    if (!t || d < 1 || d > crater || t.terrain !== 'mountain' || t.cityId !== null || t.turret) continue;
    Object.assign(t, { terrain: 'plain', volcano: false, peak: undefined, building: null, mine: null });
    if (t.resource === 'ore') t.resource = null;
  }
  for (const f of s.factions) for (const q of shipTiles(p)) revealArea(s, f.index, q.x, q.y, 1);
}

/** Wissenschaftler (Standard: des Spielers) neben dem Schiff? / scientist (default: the player's) next to the ship? */
export const scientistAtShip = (s: GameState, f = 0) => { const u = samplerOf(s, f); return !!u && nextToShip(s, u); };

