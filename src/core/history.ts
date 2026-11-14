/**
 * Spielverlauf: Werte je Runde und Fraktion, Verluste, Eroberungen und die besten Einheiten (auch gefallene).
 * Deterministisch, billig und Teil des Spielstands; alte Spielstaende ohne Verlauf laden weiterhin.
 * Game history: values per round and faction, losses, captures and the best units (fallen ones included).
 * Deterministic, cheap and part of the save game; old saves without history still load.
 */
import type { UnitTypeId } from '../data/balance';
import { income, ownCities, score, upkeep } from './queries';
import type { GameState, Unit } from './types';

/** Werte einer Runde, je Fraktionsindex / values of one round, per faction index */
export interface RoundStats {
  round: number;
  score: number[];
  stars: number[];
  /** Netto-Einkommen (Einkommen minus Sold) / net income (income minus upkeep) */
  income: number[];
  units: number[];
  cities: number[];
  kills: number[];
  losses: number[];
  techs: number[];
}

/** Eintrag der Heldenliste / hero list entry */
export interface HeroRecord {
  id: number;
  type: UnitTypeId;
  faction: number;
  kills: number;
  veteran: boolean;
  alive: boolean;
  /** Runde des Todes / round of death */
  round?: number;
}

export interface GameHistory {
  rounds: RoundStats[];
  /** verlorene Einheiten je Fraktion (gesamt) / units lost per faction (total) */
  losses: number[];
  /** eroberte Staedte und Siedlungen je Fraktion / cities and villages captured per faction */
  captures: number[];
  /** gefallene Einheiten mit Abschuessen, bestenliste / fallen units with kills, leaderboard */
  fallen: HeroRecord[];
}

export const HISTORY = {
  /** so viele gefallene Helden bleiben gespeichert / this many fallen heroes are kept */
  maxFallen: 12,
  /** ab dieser Laenge wird die aeltere Haelfte ausgeduennt / beyond this length the older half is thinned */
  maxRounds: 240,
} as const;

export type StatMetric = 'score' | 'stars' | 'income' | 'units' | 'cities' | 'kills' | 'losses' | 'techs';

const zeros = (n: number) => new Array<number>(n).fill(0);
const isNumList = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');

/**
 * Verlauf anlegen oder reparieren (alte oder beschaedigte Spielstaende).
 * Create or repair the history (old or damaged save games).
 */
export function ensureHistory(s: GameState): GameHistory {
  const n = s.factions.length;
  let h = s.history as GameHistory | undefined;
  if (!h || typeof h !== 'object') h = { rounds: [], losses: zeros(n), captures: zeros(n), fallen: [] };
  if (!Array.isArray(h.rounds)) h.rounds = [];
  if (!isNumList(h.losses)) h.losses = zeros(n);
  if (!isNumList(h.captures)) h.captures = zeros(n);
  if (!Array.isArray(h.fallen)) h.fallen = [];
  while (h.losses.length < n) h.losses.push(0);
  while (h.captures.length < n) h.captures.push(0);
  h.rounds = h.rounds.filter((r) => r && typeof r.round === 'number' && isNumList(r.score));
  s.history = h;
  return h;
}

/** Momentaufnahme aller Fraktionen / snapshot of all factions */
export function snapshot(s: GameState, round = s.round): RoundStats {
  const h = s.history;
  const r: RoundStats = { round, score: [], stars: [], income: [], units: [], cities: [], kills: [], losses: [], techs: [] };
  const unitCount = zeros(s.factions.length);
  for (const u of s.units) if (u.owner >= 0 && u.owner < unitCount.length) unitCount[u.owner]++;
  for (const f of s.factions) {
    const i = f.index;
    r.score.push(score(s, i));
    r.stars.push(f.stars);
    r.income.push(f.alive ? income(s, i) - upkeep(s, i) : 0);
    r.units.push(unitCount[i]);
    r.cities.push(ownCities(s, i).length);
    r.kills.push(f.kills);
    r.losses.push(h?.losses[i] ?? 0);
    r.techs.push(f.techs.length);
  }
  return r;
}

/**
 * Rundenende festhalten (aus rules.ts beim Rundenwechsel). Dieselbe Runde wird ersetzt, nicht doppelt gespeichert.
 * Record the end of a round (from rules.ts on round change). The same round is replaced, never stored twice.
 */
export function recordRound(s: GameState) {
  const h = ensureHistory(s);
  const snap = snapshot(s);
  const last = h.rounds[h.rounds.length - 1];
  if (last && last.round === snap.round) h.rounds[h.rounds.length - 1] = snap;
  else h.rounds.push(snap);
  if (h.rounds.length > HISTORY.maxRounds) {
    // aeltere Haelfte ausduennen: jede zweite Runde behalten / thin the older half: keep every second round
    const half = Math.floor(h.rounds.length / 2);
    h.rounds = [...h.rounds.slice(0, half).filter((_, i) => i % 2 === 0), ...h.rounds.slice(half)];
  }
}

const heroOrder = (a: HeroRecord, b: HeroRecord) =>
  b.kills - a.kills || Number(b.veteran) - Number(a.veteran) || Number(b.alive) - Number(a.alive) || a.id - b.id;

/** Einheit gefallen (aus rules.ts killUnit) / unit fell (from rules.ts killUnit) */
export function noteDeath(s: GameState, u: Unit) {
  const h = ensureHistory(s);
  if (u.owner >= 0 && u.owner < h.losses.length) h.losses[u.owner]++;
  if (u.kills <= 0) return;
  h.fallen = h.fallen.filter((r) => r.id !== u.id);
  h.fallen.push({ id: u.id, type: u.type, faction: u.owner, kills: u.kills, veteran: u.veteran, alive: false, round: s.round });
  h.fallen.sort(heroOrder);
  if (h.fallen.length > HISTORY.maxFallen) h.fallen.length = HISTORY.maxFallen;
}

/** Stadt oder Siedlung erobert (aus rules.ts captureCity) / city or village captured (from rules.ts captureCity) */
export function noteCapture(s: GameState, faction: number) {
  const h = ensureHistory(s);
  if (faction >= 0 && faction < h.captures.length) h.captures[faction]++;
}

/**
 * Beste Einheiten: lebende und gefallene, nach Abschuessen. Optional nur bestimmte Fraktionen.
 * Best units: living and fallen, by kills. Optionally only certain factions.
 */
export function topUnits(s: GameState, n = 5, factions?: number[]): HeroRecord[] {
  const live: HeroRecord[] = s.units.filter((u) => u.kills > 0)
    .map((u) => ({ id: u.id, type: u.type, faction: u.owner, kills: u.kills, veteran: u.veteran, alive: true }));
  const all = [...live, ...(s.history?.fallen ?? [])].filter((r) => !factions || factions.includes(r.faction));
  return all.sort(heroOrder).slice(0, n);
}

/**
 * Verlaufsreihe fuer die Anzeige: gespeicherte Runden plus der aktuelle Stand (ersetzt dieselbe Runde).
 * Nach Ablauf des Rundenlimits ist der Stand bereits als letzte Runde gespeichert.
 * Series for display: stored rounds plus the current state (replaces the same round).
 * After the round limit has run out, the state is already stored as the last round.
 */
export function historySeries(s: GameState): RoundStats[] {
  const rounds = [...(s.history?.rounds ?? [])];
  const limit = s.config.roundLimit;
  if (limit !== null && s.round > limit && rounds.length) return rounds;
  const live = snapshot(s);
  if (rounds.length && rounds[rounds.length - 1].round === live.round) rounds[rounds.length - 1] = live;
  else if (!rounds.length || rounds[rounds.length - 1].round < live.round) rounds.push(live);
  return rounds;
}

/** Summen je Fraktion fuer die Tabelle / totals per faction for the table */
export interface FactionTotals { faction: number; kills: number; losses: number; captures: number; techs: number; score: number }
export function factionTotals(s: GameState): FactionTotals[] {
  const h = s.history;
  return s.factions.map((f) => ({
    faction: f.index, kills: f.kills, losses: h?.losses[f.index] ?? 0, captures: h?.captures[f.index] ?? 0,
    techs: f.techs.length, score: score(s, f.index),
  }));
}
