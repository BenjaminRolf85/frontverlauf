/**
 * Zeitleiste des Intros "Die Menschheit im Sternfall": reine Daten und reine Funktionen der Zeit, ohne DOM und ohne
 * Math.random. Ein Bild zur Zeit t ist damit immer gleich, das macht den Videoexport moeglich.
 * Timeline of the intro "Humanity in the Starfall": pure data and pure functions of time, no DOM and no Math.random.
 * A frame at time t is therefore always identical, which makes the video export possible.
 *
 * Takt: 120 BPM, ein Schlag = 0,5 s, ein Takt = 2 s. Alle Schnitte liegen auf Schlaegen, die meisten auf Taktanfaengen.
 * Tempo: 120 BPM, one beat = 0.5 s, one bar = 2 s. Every cut sits on a beat, most of them on a bar start.
 */
import type { FactionId } from '../data/balance';

export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
/** Gesamtdauer in Sekunden / total duration in seconds */
export const DURATION = 58;

/** Die fuenf Menschenfraktionen in der Reihenfolge des Intros / the five human factions in intro order */
export const HUMANS = ['korvat', 'alvenia', 'dravon', 'velkar', 'meridon'] as const satisfies readonly FactionId[];
export type HumanFaction = (typeof HUMANS)[number];

export type SceneId = 'standstill' | 'starfall' | 'impact' | 'fracture' | HumanFaction | 'banners' | 'logo';

export interface Scene {
  id: SceneId;
  start: number;
  end: number;
  /** Zeitpunkt fuer die Diashow ohne Animation (alles eingeblendet) / time for the slideshow without animation (everything shown) */
  key: number;
}

/** Laenge eines Fraktionsauftritts / length of one faction beat */
export const FACTION_BEAT = 6;
const FACTION_START = 18;

export const SCENES: readonly Scene[] = [
  { id: 'standstill', start: 0, end: 6, key: 4.6 },
  { id: 'starfall', start: 6, end: 11, key: 9.2 },
  { id: 'impact', start: 11, end: 14, key: 12.8 },
  { id: 'fracture', start: 14, end: 18, key: 17.4 },
  ...HUMANS.map((id, i): Scene => {
    const start = FACTION_START + i * FACTION_BEAT;
    // Diashow: nach dem zweiten Feld, bei Velkar noch mit Laser / slideshow: after the second panel, for Velkar still with the laser
    return { id, start, end: start + FACTION_BEAT, key: start + (id === 'velkar' ? 4.2 : 4.5) };
  }),
  { id: 'banners', start: 48, end: 52, key: 51 },
  { id: 'logo', start: 52, end: DURATION, key: 56 },
];

/** Untertitel: Schluessel in intro.sub.* und Zeitfenster / subtitles: key in intro.sub.* and time window */
export interface Subtitle { key: string; start: number; end: number }
export const SUBTITLES: readonly Subtitle[] = [
  { key: 'standstill', start: 0.5, end: 5.6 },
  { key: 'skyBurned', start: 6.2, end: 9.6 },
  { key: 'crash', start: 10, end: 13.8 },
  { key: 'fracture', start: 14.2, end: 17.8 },
  ...HUMANS.map((f, i): Subtitle => ({ key: f, start: FACTION_START + i * FACTION_BEAT + 0.4, end: FACTION_START + i * FACTION_BEAT + 5.7 })),
  { key: 'banners', start: 48.3, end: 51.8 },
];

/** Harte Treffer (Bildwackeln, Blitz) / hard hits (screen shake, flash) */
export interface Hit { at: number; shake: number; flash: number }
export const HITS: readonly Hit[] = [
  { at: 11, shake: 1, flash: 1 },
  { at: 16, shake: 0.55, flash: 0.35 },
  ...HUMANS.flatMap((_, i): Hit[] => {
    const s = FACTION_START + i * FACTION_BEAT;
    return [{ at: s + 1, shake: 0.35, flash: 0 }, { at: s + 2, shake: 0.45, flash: 0 }, { at: s + 4, shake: 0.3, flash: 0 }];
  }),
  // Orbitallaser von Velkar / Velkar's orbital laser
  { at: 39.5, shake: 0.7, flash: 0.7 },
  { at: 52, shake: 0.9, flash: 0.8 },
  { at: 53.5, shake: 0.3, flash: 0 },
];

// ---------- Hilfen / helpers ----------
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Fortschritt von a nach b (0..1) / progress from a to b (0..1) */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInCubic = (p: number) => p * p * p;
export const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOutBack = (p: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
export const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

/** Saatgesteuerter Zufall (mulberry32) / seeded random (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Szene zur Zeit t (am Ende die letzte) / scene at time t (the last one at the end) */
export function sceneIndexAt(t: number): number {
  for (let i = 0; i < SCENES.length; i++) if (t < SCENES[i].end) return i;
  return SCENES.length - 1;
}

export function subtitleAt(t: number): Subtitle | null {
  return SUBTITLES.find((s) => t >= s.start && t < s.end) ?? null;
}

/** Bildwackeln als Versatz in Einheiten (ca. Pixel bei 1080p) / screen shake as offset in units (about pixels at 1080p) */
export function shakeAt(t: number): { x: number; y: number } {
  let x = 0, y = 0;
  for (const h of HITS) {
    const d = t - h.at;
    if (d < 0 || d > 0.6) continue;
    const a = h.shake * 26 * Math.exp(-d * 7);
    x += Math.sin(d * 71 + h.at) * a;
    y += Math.cos(d * 53 + h.at * 1.7) * a;
  }
  return { x, y };
}

/** Weisser Blitz 0..1 / white flash 0..1 */
export function flashAt(t: number): number {
  let f = 0;
  for (const h of HITS) {
    const d = t - h.at;
    if (d >= 0 && d < 0.5) f = Math.max(f, h.flash * Math.exp(-d * 9));
  }
  return f;
}

/** Zustand zur Zeit t (fuer Tests und den Renderer) / state at time t (for tests and the renderer) */
export interface FrameState {
  t: number;
  scene: SceneId;
  index: number;
  /** Zeit innerhalb der Szene / time inside the scene */
  local: number;
  /** Fortschritt der Szene 0..1 / scene progress 0..1 */
  progress: number;
  subtitle: string | null;
  shake: { x: number; y: number };
  flash: number;
  /** Ausblendung zum Schluss (0 = sichtbar, 1 = schwarz) / fade at the end (0 = visible, 1 = black) */
  fade: number;
}

export function frameState(time: number): FrameState {
  const t = clamp(time, 0, DURATION);
  const index = sceneIndexAt(t);
  const s = SCENES[index];
  const local = t - s.start;
  return {
    t, scene: s.id, index, local, progress: clamp(local / (s.end - s.start)),
    subtitle: subtitleAt(t)?.key ?? null,
    shake: shakeAt(t), flash: flashAt(t),
    fade: Math.max(1 - seg(t, 0, 0.8), seg(t, DURATION - 0.9, DURATION)),
  };
}
