/**
 * Kampagnenfortschritt: reine Funktionen (testbar) plus localStorage-Zugriff in try/catch.
 * Jede Menschen-Fraktion hat ihren eigenen Feldzug (Run). Der alte Fortschritt (v1, ohne Fraktion) wird einmalig
 * als Korvat-Feldzug uebernommen (die alte Kampagne begann mit Korvat) und mit einem Hinweis gemeldet.
 * Campaign progress: pure functions (testable) plus localStorage access wrapped in try/catch.
 * Every human faction has its own run. The old progress (v1, without a faction) is carried over once
 * as the Korvat run (the old campaign started with Korvat) and announced with a notice.
 *
 * Missionsreihe (layout): 1 = neun Einsaetze, 2 = elf Einsaetze (Akt I mit Portal, Alienwelt und Schwarmmutter),
 * 3 = vierzehn Einsaetze auf drei Welten in neuer Reihenfolge (WORLDS). Beim Einlesen eines Stands der Reihe 1 werden
 * die IDs nach LAYOUT_MIGRATION umgeschrieben; ab Reihe 2 bleiben alle IDs, nur die Reihenfolge aendert sich.
 * Gewonnene Einsaetze bleiben offen, der aktuelle Einsatz ist der erste ungewonnene in der neuen Reihenfolge.
 * Mission layout: 1 = nine missions, 2 = eleven missions (act I with portal, alien world and Swarm Mother),
 * 3 = fourteen missions on three worlds in a new order (WORLDS). When a layout-1 state is read, ids are rewritten
 * according to LAYOUT_MIGRATION; from layout 2 on all ids stay, only the order changes.
 * Won missions stay open, the current mission is the first unwon one in the new order.
 */
import { CAMPAIGN_FACTIONS, isCampaignFaction, MISSION_IDS } from '../core/campaign';
import { WORLDS, type WorldId } from '../core/worlds';
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
  /** Missionsreihe (fehlt = 1, neun Einsaetze) / mission layout (missing = 1, nine missions) */
  layout?: number;
  /** gewaehlte Fraktion (null = noch keine Wahl) / chosen faction (null = not chosen yet) */
  faction: FactionId | null;
  runs: Partial<Record<FactionId, CampaignProgress>>;
  /**
   * einmaliger Hinweis nach der Uebernahme, nach neuen Einsaetzen oder nach der neuen Reihenfolge der drei Welten
   * one-time notice after the migration, after new missions or after the new order of the three worlds
   */
  notice?: 'migrated' | 'expanded' | 'reordered';
}

/** Aktuelle Missionsreihe / current mission layout */
export const LAYOUT = 3;
/** Reihenfolge der Reihe 2 (vor den drei Welten) / order of layout 2 (before the three worlds) */
export const LAYOUT2_ORDER = ['m1', 'm2', 'm3', 'm10', 'm11', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'];
/**
 * Alte IDs (Reihe 1, neun Einsaetze) auf neue: die alte m3 (Die Linie haelt) ist in m2 aufgegangen, m3 ist jetzt das Portal.
 * m1, m2 und m4 bis m9 behalten ihre ID; m10 und m11 sind neu.
 * Old ids (layout 1, nine missions) to new ones: the old m3 (Hold the Line) merged into m2, m3 is now the portal.
 * m1, m2 and m4 to m9 keep their id; m10 and m11 are new.
 */
export const LAYOUT_MIGRATION: Record<string, string> = { m3: 'm2' };
/** IDs der Reihe 1 ab der geaenderten Stelle: wer so weit war, bekommt einen Hinweis / layout-1 ids from the changed part on */
const LAYOUT1_LATER = ['m3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'];

export const emptyProgress = (): CampaignProgress => ({ missions: {} });
export const emptyStore = (): CampaignStore => ({ v: 2, layout: LAYOUT, faction: null, runs: {} });

/** Mission abgeschlossen (mindestens ein Sieg)? / mission completed (at least one win)? */
export const isCompleted = (p: CampaignProgress, id: string) => (p.missions[id]?.wins ?? 0) > 0;

/**
 * Freigeschaltet: erste Mission immer, sonst wenn die vorige gewonnen ist; schon gewonnene bleiben offen (auch wenn davor
 * neue Einsaetze eingefuegt wurden).
 * Unlocked: first always, else when the previous one is won; missions already won stay open (even when new missions were
 * inserted before them).
 */
export function isUnlocked(p: CampaignProgress, order: readonly string[], id: string): boolean {
  const i = order.indexOf(id);
  if (i < 0) return false;
  return i === 0 || isCompleted(p, order[i - 1]) || isCompleted(p, id);
}

// ---------- Welten / worlds ----------

/** Welten wie in WORLDS (fuer Tests austauschbar) / worlds as in WORLDS (replaceable for tests) */
export type WorldList = readonly { id: WorldId | string; missions: readonly string[] }[];

/** Spielreihenfolge aller Einsaetze aus den Welten / play order of all missions from the worlds */
export const worldOrder = (worlds: WorldList = WORLDS): string[] => worlds.flatMap((w) => [...w.missions]);

/**
 * Welt abgeschlossen: ihr letzter Einsatz in WORLDS ist gewonnen. Die einzige Stelle, die das festlegt.
 * World complete: its last mission in WORLDS is won. The one place that defines it.
 */
export function worldComplete(p: CampaignProgress, world: WorldId | string, worlds: WorldList = WORLDS): boolean {
  const w = worlds.find((x) => x.id === world);
  const last = w?.missions[w.missions.length - 1];
  return !!last && isCompleted(p, last);
}

/** Welt betretbar: die erste immer, sonst wenn die vorige abgeschlossen ist / world open: the first always, else when the previous one is complete */
export function worldUnlocked(p: CampaignProgress, world: WorldId | string, worlds: WorldList = WORLDS): boolean {
  const i = worlds.findIndex((x) => x.id === world);
  return i === 0 || (i > 0 && worldComplete(p, worlds[i - 1].id, worlds));
}

/**
 * Einsatz freigeschaltet entlang WORLDS: gewonnene bleiben immer offen; der erste einer Welt, wenn die Welt betretbar ist;
 * sonst, wenn der vorige Einsatz derselben Welt gewonnen ist. Haengt nur an den IDs, nie an einer festen Anzahl, daher
 * wird ein spaeter eingefuegter Einsatz hinter gewonnenen Einsaetzen sofort spielbar.
 * Mission unlocked along WORLDS: won ones always stay open; the first of a world when the world is open; otherwise when
 * the previous mission of the same world is won. Depends only on ids, never on a fixed count, so a mission inserted
 * later behind won missions becomes playable at once.
 */
export function missionUnlocked(p: CampaignProgress, id: string, worlds: WorldList = WORLDS): boolean {
  if (isCompleted(p, id)) return true;
  const w = worlds.find((x) => x.missions.includes(id));
  if (!w) return false;
  const i = w.missions.indexOf(id);
  return i === 0 ? worldUnlocked(p, w.id, worlds) : isCompleted(p, w.missions[i - 1]);
}

/** Aktueller Einsatz: der erste ungewonnene in WORLDS-Reihenfolge / current mission: the first unwon one in WORLDS order */
export function currentMission(p: CampaignProgress, worlds: WorldList = WORLDS): string | null {
  return worldOrder(worlds).find((id) => missionUnlocked(p, id, worlds) && !isCompleted(p, id)) ?? null;
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
    // ein gespeicherter Wert 0 (unbekannt) wird ersetzt / a stored 0 (unknown) is replaced
    bestRound: prev && prev.bestRound > 0 ? Math.min(prev.bestRound, round) : round,
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

/** Zwei Eintraege derselben Mission vereinen (beste Wertung, schnellste Runde, Siege addiert) / merge two records of one mission */
function mergeRecord(a: MissionRecord | undefined, b: MissionRecord): MissionRecord {
  if (!a) return { ...b };
  const rounds = [a.bestRound, b.bestRound].filter((r) => r > 0);
  return { stars: Math.max(a.stars, b.stars), bestRound: rounds.length ? Math.min(...rounds) : 0, wins: a.wins + b.wins };
}

/** Feldzug der Reihe 1 auf die aktuelle Reihe umschreiben / rewrite a layout-1 run to the current layout */
export function migrateRun(p: CampaignProgress): CampaignProgress {
  const out = emptyProgress();
  for (const [id, rec] of Object.entries(p.missions)) {
    const to = LAYOUT_MIGRATION[id] ?? id;
    out.missions[to] = mergeRecord(out.missions[to], rec);
  }
  return out;
}

/** War der Feldzug schon hinter der geaenderten Stelle? / was the run already past the changed part? */
const pastChange = (p: CampaignProgress) => LAYOUT1_LATER.some((id) => isCompleted(p, id));
/**
 * Aendert die neue Reihenfolge etwas fuer diesen Feldzug? Ja, sobald mehr als der erste Einsatz gewonnen ist (ab dort
 * weicht die Reihenfolge ab) oder der aktuelle Einsatz ein anderer wird.
 * Does the new order change anything for this run? Yes once more than the first mission is won (the order differs from
 * there on) or the current mission becomes a different one.
 */
const reordered = (p: CampaignProgress) => Object.keys(p.missions).some((id) => isCompleted(p, id) && id !== LAYOUT2_ORDER[0]) ||
  (Object.keys(p.missions).length > 0 && currentMissionId(p, LAYOUT2_ORDER) !== currentMissionId(p, MISSION_IDS));

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
        // Reihe 1 (ohne Angabe): IDs umschreiben; Reihe 1 und 2: neue Reihenfolge melden / layout 1 (missing): rewrite ids; layouts 1 and 2: announce the new order
        const layout = typeof d.layout === 'number' ? d.layout : 1;
        let changed = false;
        for (const [f, r] of Object.entries(d.runs)) {
          const raw = isCampaignFaction(f) ? parseRun(r) : null;
          if (!raw) continue;
          const run = layout < 2 ? migrateRun(raw) : raw;
          if (layout < LAYOUT) changed ||= (layout < 2 && pastChange(raw)) || reordered(run);
          out.runs[f as FactionId] = run;
        }
        if (d.notice === 'migrated' || d.notice === 'expanded' || d.notice === 'reordered') out.notice = d.notice;
        // drei Welten in neuer Reihenfolge: einmal Bescheid geben / three worlds in a new order: tell once
        else if (changed) out.notice = 'reordered';
        return out;
      }
    } catch { /* weiter mit v1 / fall back to v1 */ }
  }
  const old = parseProgress(rawV1);
  if (!Object.keys(old.missions).length) return emptyStore();
  return { v: 2, layout: LAYOUT, faction: MIGRATION_FACTION, runs: { [MIGRATION_FACTION]: migrateRun(old) }, notice: 'migrated' };
}

export function loadStore(): CampaignStore {
  try { return parseStore(localStorage.getItem(PROGRESS_KEY), localStorage.getItem(PROGRESS_KEY_V1)); } catch { return emptyStore(); }
}

export function saveStore(st: CampaignStore): boolean {
  // v1 bleibt unangetastet liegen (Rueckweg fuer aeltere Fassungen) / v1 stays untouched (way back for older versions)
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...st, layout: LAYOUT })); return true; } catch { return false; }
}
