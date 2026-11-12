/** Spielstand als JSON im localStorage (immer in try/catch) und als Datei / save game as JSON in localStorage and as a file */
import type { GameState } from '../core';
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
}

export const DEFAULT_SETTINGS: Settings = {
  lang: null, music: true, effects: true, animations: true, aiSpeed: 'normal', quality: 'high', tutorialDone: false,
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

export function saveGame(s: GameState): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return isValidState(s) ? s : null;
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
        const s = JSON.parse(await file.text());
        resolve(isValidState(s) ? s : null);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
