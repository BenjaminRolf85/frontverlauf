/**
 * Meldungen zu grossen KI-Operationen (Sturm, Ablenkung, Einkreisen): reine Logik ohne DOM.
 * Nur fuer den betroffenen Menschen und nur, wenn er mindestens eine beteiligte Einheit sieht (kein Wissen aus dem Nebel).
 * Notices about big AI operations (storm, diversion, encirclement): pure logic without DOM.
 * Only for the human concerned and only when they can see at least one unit involved (no knowledge from the fog).
 */
import { canSeeUnit, cityById, unitById, type GameState } from '../core';
import type { OpNews } from '../ai/ai';

export interface OpNotice {
  /** Sprachschluessel unter aiOps / language key under aiOps */
  key: 'storm' | 'diversion' | 'encircle';
  faction: number;
  city?: number;
  unit?: number;
}

/**
 * Meldung fuer den Betrachter oder null.
 * Notice for the viewer or null.
 */
export function opNotice(n: OpNews, s: GameState, viewer: number): OpNotice | null {
  const v = s.factions[viewer];
  if (!v || !v.human || n.faction === viewer) return null;
  const seen = n.units.some((id) => { const u = unitById(s, id); return !!u && canSeeUnit(s, viewer, u); });
  if (!seen) return null;
  if ((n.kind === 'storm' || n.kind === 'diversion') && n.city !== undefined) {
    const c = cityById(s, n.city);
    if (!c || c.owner !== viewer) return null;
    return { key: n.kind, faction: n.faction, city: c.id };
  }
  if (n.kind === 'encircle' && n.target !== undefined) {
    const t = unitById(s, n.target);
    if (!t || t.owner !== viewer) return null;
    return { key: 'encircle', faction: n.faction, unit: t.id };
  }
  return null;
}
