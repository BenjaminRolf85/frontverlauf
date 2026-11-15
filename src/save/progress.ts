/**
 * Kampagnenfortschritt: reine Funktionen (testbar) plus localStorage-Zugriff in try/catch.
 * Jede Menschen-Fraktion hat ihren eigenen Feldzug (Run). Der alte Fortschritt (v1, ohne Fraktion) wird einmalig
 * als Korvat-Feldzug uebernommen (die alte Kampagne begann mit Korvat) und mit einem Hinweis gemeldet.
 * Campaign progress: pure functions (testable) plus localStorage access wrapped in try/catch.
 * Every human faction has its own run. The old progress (v1, without a faction) is carried over once
 * as the Korvat run (the old campaign started with Korvat) and announced with a notice.
 */
import { CAMPAIGN_FACTIONS, isCampaignFaction } from '../core/campaign';
import type { FactionId } from '../data/balance';

const PROGRESS_KEY_V1 = 'frontverlauf.campaign.v1';
const PROGRESS_KEY = 'frontverlauf.campaign.v2';
/** Fraktion, die den alten Fortschritt erbt / faction that inherits the old progress */
export const MIGRATION_FACTION: FactionId = 'korvat';

export interface MissionRecord {
  /** beste Wertung 1-3 / best rating 1-3 */
  stars: number;
  /** schnellster Sieg (Runde) / fastest win (round) */
  bestRound: number;
  wins: number;
}

/** Fortschritt eines Feldzugs (einer Fraktion) / progress of one run (one faction) */
export interface CampaignProgress {
  missions: Record<string, MissionRecord>;
}

/** Gesamter gespeicherter Stand / whole stored state */
export interface CampaignStore {
  v: 2;
  /** gewaehlte Fraktion (null = noch keine Wahl) / chosen faction (null = not chosen yet) */
  faction: FactionId | null;
  runs: Partial<Record<FactionId, CampaignProgress>>;
  /** einmaliger Hinweis nach der Uebernahme / one-time notice after the migration */
  notice?: 'migrated';
}

export const emptyProgress = (): CampaignProgress => ({ missions: {} });
export const emptyStore = (): CampaignStore => ({ v: 2, faction: null, runs: {} });

/** Mission abgeschlossen (mindestens ein Sieg)? / mission completed (at least one win)? */
export const isCompleted = (p: CampaignProgress, id: string) => (p.missions[id]?.wins ?? 0) > 0;

/** Freigeschaltet: erste Mission immer, sonst wenn die vorige gewonnen ist / unlocked: first always, else when the previous one is won */
export function isUnlocked(p: CampaignProgress, order: readonly string[], id: string): boolean {
  const i = order.indexOf(id);
  if (i < 0) return false;
  return i === 0 || isCompleted(p, order[i - 1]);
}

/** Naechste Mission in der Reihenfolge / next mission in order */
export function nextMissionId(order: readonly string[], id: string): string | null {
  const i = order.indexOf(id);
  return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
}

/** Erste noch nicht gewonnene, freigeschaltete Mission / first unlocked mission not yet won */
export function currentMissionId(p: CampaignProgress, order: readonly string[]): string | null {
  return order.find((id) => isUnlocked(p, order, id) && !isCompleted(p, id)) ?? null;
}

export const totalStars = (p: CampaignProgress) => Object.values(p.missions).reduce((a, m) => a + m.stars, 0);

/**
 * Ergebnis eintragen (gibt einen neuen Stand zurueck, der alte bleibt unveraendert). Niederlagen aendern nichts.
 * Record a result (returns a new state, the old one stays unchanged). Defeats change nothing.
 */
export function recordResult(p: CampaignProgress, id: string, won: boolean, stars: number, round: number): CampaignProgress {
  if (!won) return p;
  const prev = p.missions[id];
  const rec: MissionRecord = {
    stars: Math.max(prev?.stars ?? 0, Math.max(1, Math.min(3, Math.round(stars)))),
    bestRound: prev ? Math.min(prev.bestRound, round) : round,
    wins: (prev?.wins ?? 0) + 1,
  };
  return { missions: { ...p.missions, [id]: rec } };
}

// ---------- Feldzuege je Fraktion / runs per faction ----------

/** Feldzug einer Fraktion (leer, wenn noch nicht begonnen) / run of a faction (empty if not started) */
export const runOf = (st: CampaignStore, f: FactionId): CampaignProgress => st.runs[f] ?? emptyProgress();

/** Feldzug ersetzen (neuer Stand) / replace a run (new state) */
export const withRun = (st: CampaignStore, f: FactionId, p: CampaignProgress): CampaignStore => ({ ...st, runs: { ...st.runs, [f]: p } });

/** Fraktion waehlen (nur Menschen) / choose a faction (humans only) */
export const chooseFaction = (st: CampaignStore, f: FactionId): CampaignStore => (isCampaignFaction(f) ? { ...st, faction: f } : st);

/** Hinweis gelesen / notice read */
export function clearNotice(st: CampaignStore): CampaignStore {
  const { notice: _n, ...rest } = st;
  return rest;
}

/**
 * Ergebnis im Feldzug der Fraktion eintragen / record a result in the faction's run.
 */
export function recordRunResult(st: CampaignStore, f: FactionId, id: string, won: boolean, stars: number, round: number): CampaignStore {
  if (!won || !isCampaignFaction(f)) return st;
  return withRun(st, f, recordResult(runOf(st, f), id, won, stars, round));
}

/** Zeitschleife durchlaufen: Finale gewonnen / time loop completed: finale won */
export const loopDone = (st: CampaignStore, f: FactionId, finaleId: string) => isCompleted(runOf(st, f), finaleId);

/** Fraktionen, die die Zeitschleife durchlaufen haben / factions that completed the time loop */
export const loopsDone = (st: CampaignStore, finaleId: string): FactionId[] => CAMPAIGN_FACTIONS.filter((f) => loopDone(st, f, finaleId));

// ---------- Einlesen / parsing ----------

function parseRun(d: unknown): CampaignProgress | null {
  if (!d || typeof d !== 'object') return null;
  const ms = (d as { missions?: unknown }).missions;
  if (typeof ms !== 'object' || ms === null) return null;
  const out = emptyProgress();
  for (const [id, m] of Object.entries(ms as Record<string, Partial<MissionRecord>>)) {
    if (!m || typeof m.stars !== 'number' || typeof m.wins !== 'number') continue;
    out.missions[id] = { stars: Math.max(0, Math.min(3, m.stars)), bestRound: Number(m.bestRound) || 0, wins: Math.max(0, m.wins) };
  }
  return out;
}

/** Alten Fortschritt (v1) lesen / parse old progress (v1) */
export function parseProgress(raw: string | null): CampaignProgress {
  if (!raw) return emptyProgress();
  try {
    const d = JSON.parse(raw) as { v?: unknown };
    if (!d || d.v !== 1) return emptyProgress();
    return parseRun(d) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

/**
 * Gespeicherten Stand lesen; fehlt v2, wird v1 (falls vorhanden und nicht leer) als Korvat-Feldzug uebernommen.
 * Parse the stored state; without v2, v1 (if present and not empty) is carried over as the Korvat run.
 */
export function parseStore(raw: string | null, rawV1: string | null = null): CampaignStore {
  if (raw) {
    try {
      const d = JSON.parse(raw) as Partial<CampaignStore>;
      if (d && d.v === 2 && typeof d.runs === 'object' && d.runs !== null) {
        const out = emptyStore();
        if (isCampaignFaction(d.faction)) out.faction = d.faction;
        for (const [f, r] of Object.entries(d.runs)) {
          const run = isCampaignFaction(f) ? parseRun(r) : null;
          if (run) out.runs[f as FactionId] = run;
        }
        if (d.notice === 'migrated') out.notice = 'migrated';
        return out;
      }
    } catch { /* weiter mit v1 / fall back to v1 */ }
  }
  const old = parseProgress(rawV1);
  if (!Object.keys(old.missions).length) return emptyStore();
  return { v: 2, faction: MIGRATION_FACTION, runs: { [MIGRATION_FACTION]: old }, notice: 'migrated' };
}

export function loadStore(): CampaignStore {
  try { return parseStore(localStorage.getItem(PROGRESS_KEY), localStorage.getItem(PROGRESS_KEY_V1)); } catch { return emptyStore(); }
}

export function saveStore(st: CampaignStore): boolean {
  // v1 bleibt unangetastet liegen (Rueckweg fuer aeltere Fassungen) / v1 stays untouched (way back for older versions)
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(st)); return true; } catch { return false; }
}
