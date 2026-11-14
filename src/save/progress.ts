/**
 * Kampagnenfortschritt: reine Funktionen (testbar) plus localStorage-Zugriff in try/catch.
 * Campaign progress: pure functions (testable) plus localStorage access wrapped in try/catch.
 */

const PROGRESS_KEY = 'frontverlauf.campaign.v1';

export interface MissionRecord {
  /** beste Wertung 1-3 / best rating 1-3 */
  stars: number;
  /** schnellster Sieg (Runde) / fastest win (round) */
  bestRound: number;
  wins: number;
}

export interface CampaignProgress {
  v: 1;
  missions: Record<string, MissionRecord>;
}

export const emptyProgress = (): CampaignProgress => ({ v: 1, missions: {} });

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
  return { v: 1, missions: { ...p.missions, [id]: rec } };
}

/** Gespeicherten Text pruefen und lesen / validate and parse stored text */
export function parseProgress(raw: string | null): CampaignProgress {
  if (!raw) return emptyProgress();
  try {
    const d = JSON.parse(raw) as Partial<CampaignProgress>;
    if (!d || d.v !== 1 || typeof d.missions !== 'object' || d.missions === null) return emptyProgress();
    const out = emptyProgress();
    for (const [id, m] of Object.entries(d.missions)) {
      if (!m || typeof m.stars !== 'number' || typeof m.wins !== 'number') continue;
      out.missions[id] = { stars: Math.max(0, Math.min(3, m.stars)), bestRound: Number(m.bestRound) || 0, wins: Math.max(0, m.wins) };
    }
    return out;
  } catch {
    return emptyProgress();
  }
}

export function loadProgress(): CampaignProgress {
  try { return parseProgress(localStorage.getItem(PROGRESS_KEY)); } catch { return emptyProgress(); }
}

export function saveProgress(p: CampaignProgress): boolean {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
