/**
 * Zustand der Oberwelt als reine Funktionen (testbar, ohne DOM und ohne Three.js): Markerzustand je Einsatz,
 * Freischaltung der Welten, Fortschritt je Welt und die Welt, auf die die Kamera beim Oeffnen schaut.
 * Overworld state as pure functions (testable, no DOM, no Three.js): marker state per mission, world unlock,
 * progress per world and the world the camera looks at on open.
 *
 * Reihenfolge der Marker und ihre Nummern kommen aus WORLDS (Spielreihenfolge der Oberwelt). Ob ein Einsatz
 * offen ist, entscheidet dagegen dieselbe Regel wie in der Liste (isUnlocked mit der Reihenfolge der Missionsdaten),
 * damit ein Marker nie etwas anbietet, was die Besprechung ablehnen wuerde. IDs, die (noch) nicht in den
 * Missionsdaten stehen, werden als "kommt bald" gezeigt.
 * Marker order and numbers come from WORLDS (overworld play order). Whether a mission is open is decided by the same
 * rule as in the list (isUnlocked with the order of the mission data), so a marker never offers what the briefing would
 * refuse. Ids not (yet) in the mission data are shown as "coming".
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
  /** Inhalt sichtbar (erster Einsatz der Welt erreichbar) / content visible (first mission of the world reachable) */
  unlocked: boolean;
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

/** Marker aller Welten / markers of all worlds */
export function overworldInfo(inp: OverworldInput): WorldInfo[] {
  const worlds = inp.worlds ?? WORLDS;
  const { progress: p, order } = inp;
  const cur = currentMissionId(p, order);
  const all = playOrder(worlds);
  const finale = all[all.length - 1];
  return worlds.map((w, wi) => {
    const markers = w.missions.map((id): MarkerInfo => {
      const state = markerState(p, order, id);
      return {
        id, world: w.id, no: all.indexOf(id) + 1, state,
        stars: state === 'won' ? Math.max(1, Math.min(3, p.missions[id]?.stars ?? 1)) : 0,
        current: id === cur, finale: id === finale,
      };
    });
    // erste Welt immer; sonst sobald ein vorhandener Einsatz der Welt erreichbar ist
    // first world always; otherwise once an existing mission of the world is reachable
    const unlocked = wi === 0 || markers.some((m) => m.state === 'won' || m.state === 'available');
    return { id: w.id, unlocked, markers, won: markers.filter((m) => m.state === 'won').length, total: markers.length };
  });
}

/**
 * Welt, auf die beim Oeffnen geschaut wird: die des naechsten offenen Einsatzes, sonst die letzte freie Welt.
 * World focused on open: the one of the next open mission, else the last unlocked world.
 */
export function focusWorld(info: readonly WorldInfo[]): WorldId {
  const cur = info.find((w) => w.markers.some((m) => m.current));
  if (cur) return cur.id;
  const open = info.filter((w) => w.unlocked);
  return (open[open.length - 1] ?? info[0]).id;
}

/** Riss zur Welt der Vergessenen: verborgen, sichtbar (Alienwelt frei) oder offen (Schwarmmutter besiegt) / rift state */
export type RiftState = 'hidden' | 'visible' | 'open';
export function riftState(info: readonly WorldInfo[], p: CampaignProgress, gate = 'm11'): RiftState {
  if (isCompleted(p, gate)) return 'open';
  return info.find((w) => w.id === 'alien')?.unlocked ? 'visible' : 'hidden';
}

/** Weg durch das Portal zur Alienwelt: immer schwach sichtbar, offen nach dem Portal-Einsatz / path through the portal: always faint, open after the portal mission */
export const portalPathState = (p: CampaignProgress, gate = 'm3'): RiftState => (isCompleted(p, gate) ? 'open' : 'visible');
