/**
 * Schlachtfeld-Narben (nur Optik): Kampfintensitaet je Feld (Tile.scar), gewichtet nach Waffe, gedeckelt, mit langsamer
 * Erholung. Die Regeln lesen sie nie; der Renderer zeigt danach leichte Spuren, aufgewuehlte Erde oder verwuestetes Land.
 * Battlefield scars (visual only): fighting intensity per tile (Tile.scar), weighted by weapon, capped, with slow
 * recovery. The rules never read it; the renderer shows light marks, churned earth or devastated land from it.
 *
 * API fuer andere Features (z. B. Kamikaze-Explosionen) / API for other features (e.g. kamikaze blasts):
 *   addBattleScar(s, x, y, WAR_MARKS.scar.blast)
 * Deterministisch, ohne Zufall; Staedte bleiben unberuehrt, Wasser zaehlt (Oelflecken).
 * Deterministic, no randomness; cities stay untouched, water counts (oil slicks).
 */
import { WAR_MARKS } from '../data/balance';
import { tileAt } from './grid';
import type { GameState, Tile } from './types';

/** Stufe der Verwuestung: 0 unberuehrt, 1 leicht, 2 mittel, 3 schwer / devastation tier: 0 untouched, 1 light, 2 medium, 3 heavy */
export type ScarTier = 0 | 1 | 2 | 3;

/** Stufe zu einer Intensitaet / tier for an intensity */
export function scarTierOf(v: number): ScarTier {
  const S = WAR_MARKS.scar;
  return v >= S.heavy ? 3 : v >= S.medium ? 2 : v >= S.light ? 1 : 0;
}

/**
 * Stufe eines Feldes; alte Spielstaende mit Kratern, aber ohne scar zaehlen als leicht.
 * Tier of a tile; old saves with craters but without scar count as light.
 */
export function scarTier(t: Tile): ScarTier {
  const tier = scarTierOf(t.scar?.v ?? 0);
  return tier === 0 && t.marks?.length ? 1 : tier;
}

/**
 * Kampfspur auf einem Feld hinterlassen: Intensitaet um weight erhoehen (max WAR_MARKS.scar.max), Runde merken.
 * Leave battle damage on a tile: raise the intensity by weight (max WAR_MARKS.scar.max), remember the round.
 */
export function addBattleScar(s: GameState, x: number, y: number, weight: number) {
  const t = tileAt(s, x, y);
  if (!t || t.cityId !== null || !(weight > 0)) return;
  const v = Math.min(WAR_MARKS.scar.max, (t.scar?.v ?? 0) + weight);
  t.scar = { v, r: s.round };
}

/**
 * Natur holt sich das Land zurueck (einmal je Runde): nach healAfter ruhigen Runden alle healEvery Runden ein Punkt
 * weniger; Krater schwinden mit, bei 0 ist das Feld wieder unberuehrt.
 * Nature reclaims the land (once per round): after healAfter quiet rounds one point less every healEvery rounds;
 * craters fade along, at 0 the tile is untouched again.
 */
export function healScars(s: GameState) {
  const S = WAR_MARKS.scar;
  for (const t of s.tiles) {
    const sc = t.scar;
    if (!sc) continue;
    const quiet = s.round - sc.r;
    if (quiet <= S.healAfter || (quiet - S.healAfter) % S.healEvery !== 0) continue;
    sc.v -= 1;
    if (sc.v <= 0) { delete t.scar; if (t.marks) t.marks = []; continue; }
    // je zwei Punkte darf ein Krater bleiben, die aeltesten verschwinden zuerst / one crater per two points, the oldest go first
    const keep = Math.min(WAR_MARKS.maxPerTile, Math.ceil(sc.v / 2));
    if (t.marks && t.marks.length > keep) t.marks = t.marks.slice(-keep);
  }
}
