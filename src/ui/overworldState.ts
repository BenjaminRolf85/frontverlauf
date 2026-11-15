/**
 * Zustand der Oberwelt als reine Funktionen (testbar, ohne DOM und ohne Three.js): Markerzustand je Einsatz,
 * Sichtbarkeit der Welten, Fortschritt je Welt, die Welt, auf die die Kamera beim Oeffnen schaut, und welche Welten
 * zum ersten Mal erscheinen (Enthuellung).
 * Overworld state as pure functions (testable, no DOM, no Three.js): marker state per mission, visibility of the
 * worlds, progress per world, the world the camera looks at on open, and which worlds appear for the first time
 * (reveal).
 *
 * Reihenfolge der Marker und ihre Nummern kommen aus WORLDS (Spielreihenfolge der Oberwelt). Ob ein Einsatz
 * offen ist, entscheidet dagegen dieselbe Regel wie in der Liste (isUnlocked mit der Reihenfolge der Missionsdaten),
 * damit ein Marker nie etwas anbietet, was die Besprechung ablehnen wuerde. IDs, die (noch) nicht in den
 * Missionsdaten stehen, werden als "kommt bald" gezeigt.
 * Marker order and numbers come from WORLDS (overworld play order). Whether a mission is open is decided by the same
 * rule as in the list (isUnlocked with the order of the mission data), so a marker never offers what the briefing would
 * refuse. Ids not (yet) in the mission data are shown as "coming".
 *
 * Sichtbarkeit: Die erste Welt ist immer da. Jede weitere erscheint erst, wenn der letzte Einsatz der Welt davor
 * gewonnen ist (Erde: m3 "Das Portal", Alienwelt: m11 "Die Schwarmmutter"). Bis dahin ist sie ganz verborgen. Hat ein
 * (uebernommener) Stand schon einen Sieg in einer Welt, wird sie trotzdem gezeigt, ebenso alle Welten davor.
 * Visibility: the first world is always there. Each further world appears only once the last mission of the world
 * before it is won (Earth: m3 "The Portal", alien world: m11 "The Swarm Mother"). Until then it is fully hidden. If a
 * (migrated) state already has a win in a world, it is shown anyway, as are all worlds before it.
 */
import { WORLDS, type WorldId } from '../core/worlds';
import { currentMissionId, isCompleted, isUnlocked, type CampaignProgress } from '../save/progress';

/** Zustand eines Markers / state of a marker */
export type MarkerState = 'won' | 'available' | 'locked' | 'coming';

export interface MarkerInfo {
  id: string;
  world: WorldId;
  /** Nummer in der Spielreihenfolge der Oberwelt (1-basiert) / number in the overworld play order (1-based) */
  no: number;
  state: MarkerState;
  /** beste Wertung 0-3 / best rating 0-3 */
  stars: number;
  /** naechster offener Einsatz / next open mission */
  current: boolean;
  /** letzter Einsatz der letzten Welt (Hoehle) / last mission of the last world (cave) */
  finale: boolean;
}

export interface WorldInfo {
  id: WorldId;
  /** Welt erscheint in der Oberwelt / world appears in the overworld */
  visible: boolean;
  markers: MarkerInfo[];
  won: number;
  total: number;
}

/** Eingabe: Fortschritt plus die Reihenfolge der vorhandenen Missionsdaten / input: progress plus the order of the existing mission data */
export interface OverworldInput {
  progress: CampaignProgress;
  /** IDs der vorhandenen Einsaetze in Freischalt-Reihenfolge (MISSION_IDS) / ids of existing missions in unlock order */
  order: readonly string[];
  worlds?: typeof WORLDS;
}

/** Alle Einsaetze der Oberwelt in Spielreihenfolge / all overworld missions in play order */
export const playOrder = (worlds: typeof WORLDS = WORLDS): string[] => worlds.flatMap((w) => [...w.missions]);

/** Zustand eines einzelnen Einsatzes / state of a single mission */
export function markerState(p: CampaignProgress, order: readonly string[], id: string): MarkerState {
  if (!order.includes(id)) return 'coming';
  if (isCompleted(p, id)) return 'won';
  return isUnlocked(p, order, id) ? 'available' : 'locked';
}

/**
 * Anzahl der sichtbaren Welten (von vorn gezaehlt) / number of visible worlds (counted from the front).
 */
export function visibleCount(p: CampaignProgress, worlds: typeof WORLDS = WORLDS): number {
  let n = Math.min(1, worlds.length);
  for (let i = 1; i < worlds.length; i++) {
    const prev = worlds[i - 1].missions;
    const gate = prev[prev.length - 1];
    if (gate !== undefined && isCompleted(p, gate)) n = i + 1;
  }
  // Sieg in einer spaeteren Welt (uebernommener Stand): diese und alle davor zeigen / a win in a later world: show it and all before
  worlds.forEach((w, i) => { if (w.missions.some((id) => isCompleted(p, id))) n = Math.max(n, i + 1); });
  return n;
}

/** Marker aller Welten (auch verborgener; siehe visible) / markers of all worlds (hidden ones too; see visible) */
export function overworldInfo(inp: OverworldInput): WorldInfo[] {
  const worlds = inp.worlds ?? WORLDS;
  const { progress: p, order } = inp;
  const cur = currentMissionId(p, order);
  const all = playOrder(worlds);
  const finale = all[all.length - 1];
  const shown = visibleCount(p, worlds);
  return worlds.map((w, wi) => {
    const markers = w.missions.map((id): MarkerInfo => {
      const state = markerState(p, order, id);
      return {
        id, world: w.id, no: all.indexOf(id) + 1, state,
        stars: state === 'won' ? Math.max(1, Math.min(3, p.missions[id]?.stars ?? 1)) : 0,
        current: id === cur, finale: id === finale,
      };
    });
    return { id: w.id, visible: wi < shown, markers, won: markers.filter((m) => m.state === 'won').length, total: markers.length };
  });
}

/** Nur die sichtbaren Welten / only the visible worlds */
export const visibleWorlds = (info: readonly WorldInfo[]): WorldInfo[] => info.filter((w) => w.visible);

/**
 * Welt, auf die beim Oeffnen geschaut wird: die sichtbare Welt des naechsten offenen Einsatzes, sonst die letzte
 * sichtbare Welt.
 * World focused on open: the visible world of the next open mission, else the last visible world.
 */
export function focusWorld(info: readonly WorldInfo[]): WorldId {
  const shown = visibleWorlds(info);
  const cur = shown.find((w) => w.markers.some((m) => m.current));
  if (cur) return cur.id;
  return (shown[shown.length - 1] ?? info[0]).id;
}

/** Verbindungen zwischen den Welten: Portalweg mit Welt 2, Riss mit Welt 3 / links: portal path with world 2, rift with world 3 */
export function links(info: readonly WorldInfo[]): { portal: boolean; rift: boolean } {
  const n = visibleWorlds(info).length;
  return { portal: n >= 2, rift: n >= 3 };
}

/**
 * Welten, die zum ersten Mal erscheinen: Indizes ab der Zahl der schon gezeigten Welten (mindestens 1, die Erde ist
 * nie neu). seen = gemerkte Zahl gezeigter Welten (undefined = noch nie geoeffnet).
 * Worlds appearing for the first time: indices from the number of worlds already shown (at least 1, Earth is never new).
 * seen = remembered number of shown worlds (undefined = never opened).
 */
export function newlyRevealed(shown: number, seen: number | undefined): number[] {
  const from = Math.max(1, seen ?? 1);
  const out: number[] = [];
  for (let i = from; i < shown; i++) out.push(i);
  return out;
}

/** Gemerkte Zahl gezeigter Welten je Fraktion lesen (robust) / read the remembered shown count per faction (robust) */
export function parseSeen(raw: string | null): Record<string, number> {
  try {
    const d = JSON.parse(raw ?? '{}') as unknown;
    if (!d || typeof d !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(d as Record<string, unknown>)) if (typeof v === 'number' && v >= 0 && v <= 16) out[k] = Math.floor(v);
    return out;
  } catch { return {}; }
}
