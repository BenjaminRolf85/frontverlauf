/**
 * Teilnehmerliste der Einsatzplanung als reine Funktionen (ohne DOM, testbar): Platz 0 ist immer die eigene,
 * menschliche Fraktion; Gegner kommen ueber Fraktionskarten dazu (als KI auf Normal), lassen sich entfernen,
 * tauschen und auf Mensch (Hotseat) umschalten. Alle Funktionen geben eine neue Liste zurueck.
 * Participant list of the game setup as pure functions (no DOM, testable): slot 0 is always the player's own human
 * faction; opponents are added via faction cards (as AI on normal), can be removed, swapped and switched to human
 * (hotseat). Every function returns a new list.
 */
import { FACTION_IDS, PLAYER_LIMITS, type Difficulty, type FactionId } from '../data/balance';

export interface SetupPlayer { id: FactionId; human: boolean; difficulty: Difficulty }

/** Voreinstellung der eigenen Fraktion ohne gemerkte Wahl / default own faction without a remembered choice */
export const DEFAULT_OWN_FACTION: FactionId = 'korvat';
/** Schwierigkeit neu hinzugefuegter Gegner / difficulty of newly added opponents */
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';
/** Hoechstzahl der Gegner (alle Teilnehmer ohne die eigene Fraktion) / maximum number of opponents (all participants except the own faction) */
export const MAX_OPPONENTS = Math.min(PLAYER_LIMITS.max, FACTION_IDS.length) - 1;

const isFaction = (f: unknown): f is FactionId => typeof f === 'string' && (FACTION_IDS as string[]).includes(f);

/**
 * Startliste: nur die eigene Fraktion als Mensch (gemerkte Wahl, sonst Korvat).
 * Initial list: only the own faction as human (remembered choice, otherwise Korvat).
 */
export function initialPlayers(remembered?: unknown): SetupPlayer[] {
  return [{ id: isFaction(remembered) ? remembered : DEFAULT_OWN_FACTION, human: true, difficulty: DEFAULT_DIFFICULTY }];
}

/** Fraktionen, die noch nicht im Spiel sind (Reihenfolge wie FACTION_IDS) / factions not yet in the game (FACTION_IDS order) */
export function availableFactions(players: readonly SetupPlayer[]): FactionId[] {
  return FACTION_IDS.filter((f) => !players.some((p) => p.id === f));
}

/** Anzahl der Gegner / number of opponents */
export const opponentCount = (players: readonly SetupPlayer[]) => Math.max(0, players.length - 1);

/** Kann noch ein Gegner dazukommen? / can another opponent be added? */
export function canAddOpponent(players: readonly SetupPlayer[]): boolean {
  return players.length < PLAYER_LIMITS.max && availableFactions(players).length > 0;
}

/**
 * Gegner als KI (Normal) hinzufuegen; belegte Fraktion oder volle Liste: unveraendert.
 * Add an opponent as AI (normal); a taken faction or a full list: unchanged.
 */
export function addOpponent(players: readonly SetupPlayer[], id: FactionId): SetupPlayer[] {
  if (!canAddOpponent(players) || !availableFactions(players).includes(id)) return [...players];
  return [...players, { id, human: false, difficulty: DEFAULT_DIFFICULTY }];
}

/**
 * Zufaelligen freien Gegner hinzufuegen (rng liefert [0, 1)).
 * Add a random free opponent (rng returns [0, 1)).
 */
export function addRandomOpponent(players: readonly SetupPlayer[], rng: () => number = Math.random): SetupPlayer[] {
  const free = availableFactions(players);
  if (!canAddOpponent(players) || !free.length) return [...players];
  const i = Math.min(free.length - 1, Math.max(0, Math.floor(rng() * free.length)));
  return addOpponent(players, free[i]);
}

/** Gegner entfernen; die eigene Fraktion (Platz 0) bleibt immer / remove an opponent; the own faction (slot 0) always stays */
export function removeOpponent(players: readonly SetupPlayer[], index: number): SetupPlayer[] {
  if (index <= 0 || index >= players.length) return [...players];
  return players.filter((_, i) => i !== index);
}

/**
 * Fraktion eines Platzes wechseln; ist sie schon im Spiel, tauschen beide Plaetze ihre Fraktionen
 * (Mensch/KI und Schwierigkeit bleiben am Platz).
 * Change a slot's faction; if it is already in the game, both slots swap their factions (human/AI and difficulty stay with the slot).
 */
export function setFaction(players: readonly SetupPlayer[], index: number, id: FactionId): SetupPlayer[] {
  const next = players.map((p) => ({ ...p }));
  if (!next[index] || !isFaction(id)) return next;
  const other = next.findIndex((p, j) => p.id === id && j !== index);
  if (other >= 0) next[other].id = next[index].id;
  next[index].id = id;
  return next;
}

/** Mensch/KI eines Gegners umschalten (Platz 0 bleibt Mensch) / switch an opponent between human and AI (slot 0 stays human) */
export function setHuman(players: readonly SetupPlayer[], index: number, human: boolean): SetupPlayer[] {
  return players.map((p, i) => (i === index && i > 0 ? { ...p, human } : { ...p }));
}

/** Schwierigkeit eines Gegners setzen / set an opponent's difficulty */
export function setDifficulty(players: readonly SetupPlayer[], index: number, difficulty: Difficulty): SetupPlayer[] {
  return players.map((p, i) => (i === index ? { ...p, difficulty } : { ...p }));
}

/** Wie viele Gegner fehlen noch bis zum Start? / how many opponents are still missing before the start? */
export const missingOpponents = (players: readonly SetupPlayer[]) => Math.max(0, PLAYER_LIMITS.min - players.length);

/** Startbereit: genug Teilnehmer, nicht zu viele, keine Fraktion doppelt / ready: enough participants, not too many, no duplicate faction */
export function canStart(players: readonly SetupPlayer[]): boolean {
  return players.length >= PLAYER_LIMITS.min && players.length <= PLAYER_LIMITS.max && new Set(players.map((p) => p.id)).size === players.length;
}
