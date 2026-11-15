/** Spielstand als JSON im localStorage (immer in try/catch) und als Datei / save game as JSON in localStorage and as a file */
import type { GameState } from '../core';
import { outdatedCampaign, staleTempleSave } from '../core/campaign';
import type { Lang } from '../i18n/i18n';

const SAVE_KEY = 'frontverlauf.save.v1';
const SETTINGS_KEY = 'frontverlauf.settings.v1';

export interface Settings {
  lang: Lang | null;
  music: boolean;
  effects: boolean;
  animations: boolean;
  aiSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  quality: 'low' | 'high';
  tutorialDone: boolean;
  /** Prolog schon gesehen / prologue already seen */
  prologueSeen?: boolean;
  /** Intro vor dem ersten Kampagnenstart schon gezeigt / intro already shown before the first campaign start */
  introSeen?: boolean;
  barks: boolean;
  /** Funksprueche der Anfuehrer / leader dispatches */
  dispatches: boolean;
  /** Atmosphaere: Wetter, Voegel, ferner Gefechtslaerm / ambience: weather, birds, distant battle */
  ambience: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: null, music: true, effects: true, animations: true, aiSpeed: 'normal', quality: 'high', tutorialDone: false, barks: true, dispatches: true, ambience: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): boolean {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function isValidState(s: unknown): s is GameState {
  if (!s || typeof s !== 'object') return false;
  const g = s as GameState;
  return g.version === 1 && Array.isArray(g.tiles) && Array.isArray(g.factions) && Array.isArray(g.units) &&
    Array.isArray(g.cities) && typeof g.size === 'number' && g.tiles.length === g.size * g.size && !!g.config;
}

/**
 * Alte Spielstaende angleichen: Trefferglueck und Fraktionssiege gab es damals nicht, fehlende Felder bedeuten also AUS
 * (neue Spiele setzen beide ausdruecklich, siehe createGame/defaultConfig).
 * Bring old saves up to date: hit luck and faction victories did not exist back then, so missing fields mean OFF
 * (new games set both explicitly, see createGame/defaultConfig). Old campaign saves (before the human campaign) become free games.
 */
export function migrateState(s: GameState): GameState {
  if (s.config.hitChance === undefined) s.config.hitChance = false;
  if (s.config.factionVictory === undefined) s.config.factionVictory = false;
  // Feuern nach Bewegung liest u.moved: fehlt das Feld, gilt die Einheit als in diesem Zug nicht gezogen
  // firing after moving reads u.moved: if the field is missing, the unit counts as not moved this turn
  for (const u of s.units) if (typeof u.moved !== 'boolean') u.moved = false;
  // Heiliges Alvenia: Voelkerbund-Charta wird zum Grossen Strafgericht, der Voelkerbund-Zaehler entfaellt;
  // Suendenzeichen (sin), Strafgericht-Zaehler (judged) und Segen (blessed) fehlen in alten Spielstaenden und gelten als nie gesetzt
  // Holy Alvenia: the League Charter becomes the Great Judgement, the League counter is dropped;
  // sinner marks (sin), the judgement counter (judged) and blessings (blessed) are missing in old saves and count as never set
  for (const fa of s.factions as (GameState['factions'][number] & { league?: number })[]) {
    fa.techs = fa.techs.map((t) => ((t as string) === 'leagueCharter' ? 'greatJudgement' : t));
    delete fa.league;
  }
  // Kampagnen-Spielstaende der alten Missionsfassung laufen als freie Eroberungspartie weiter (die Missionen gibt es so nicht mehr)
  // campaign saves of the old mission data continue as a free conquest game (those missions no longer exist)
  // dazu laufende m2-Partien der alten Bergung (vor dem Mutterschiff) und m4 vor den Kriegsplaenen (ohne Tempel)
  // plus running m2 games of the old salvage (before the mothership) and m4 before the war plans (no temple)
  if (s.campaign && (outdatedCampaign(s.campaign) || staleTempleSave(s))) {
    delete s.campaign;
    delete s.config.campaign;
    s.config.factionVictory = false;
  }
  return s;
}

/** Gueltigen Spielstand pruefen und angleichen, sonst null / validate and migrate a save, otherwise null */
const loaded = (s: unknown): GameState | null => (isValidState(s) ? migrateState(s) : null);

export function saveGame(s: GameState): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return loaded(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nichts / nothing */ }
}

export function exportFile(s: GameState) {
  const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frontverlauf-round${s.round}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importFile(): Promise<GameState | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(loaded(JSON.parse(await file.text())));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

// ---------- Mehrere Speicherstaende / multiple save slots ----------

const SLOT_KEY = (i: number) => `frontverlauf.slot.v1.${i}`;
export const SAVE_SLOTS = 6;

export interface SlotInfo { slot: number; savedAt: number; round: number; faction: string; mode: string; size: number; name: string }

export function slotInfo(i: number): SlotInfo | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw) return null;
    const d = JSON.parse(raw) as { info: SlotInfo };
    return d.info ?? null;
  } catch {
    return null;
  }
}

export function listSlots(): (SlotInfo | null)[] {
  return Array.from({ length: SAVE_SLOTS }, (_, i) => slotInfo(i));
}

export function saveToSlot(i: number, s: GameState, name: string): boolean {
  const human = s.factions.find((f) => f.human) ?? s.factions[0];
  const info: SlotInfo = { slot: i, savedAt: Date.now(), round: s.round, faction: human.id, mode: s.config.mode, size: s.size, name };
  try { localStorage.setItem(SLOT_KEY(i), JSON.stringify({ info, state: s })); return true; } catch { return false; }
}

export function loadFromSlot(i: number): GameState | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw) return null;
    const d = JSON.parse(raw) as { state: unknown };
    return loaded(d.state);
  } catch {
    return null;
  }
}

export function deleteSlot(i: number) {
  try { localStorage.removeItem(SLOT_KEY(i)); } catch { /* nichts / nothing */ }
}
