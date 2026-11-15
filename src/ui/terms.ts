/**
 * Wortwahl fuer Forschung je Rasse: Die fuenf Menschen-Fraktionen schalten Produktionsfaehigkeiten frei
 * ("Produktion", "Produktionskapazitaeten"), Zyrr, NEXUS und Kult forschen. Regeln, Kosten und Baum sind fuer alle
 * gleich, nur die Texte unterscheiden sich. Die Menschen-Fassung steht unter production.<schluessel> in de.json/en.json;
 * fehlt sie, gilt der normale Schluessel.
 * Wording for research by race: the five human factions unlock production capabilities ("Production",
 * "production capacities"), the Zyrr, NEXUS and the cult research. Rules, costs and tree are the same for everyone,
 * only the texts differ. The human variant lives under production.<key> in de.json/en.json; without one the normal
 * key applies.
 */
import { factionRace, type GameState } from '../core';
import type { FactionId } from '../data/balance';
import { has, t } from '../i18n/i18n';

/** Spricht die Fraktion von Produktion statt Forschung? (Menschen) / does the faction say production instead of research? (humans) */
export const usesProduction = (f: FactionId | null | undefined): boolean => !!f && factionRace(f) === 'human';

/**
 * Text in der Wortwahl der Fraktion f: fuer Menschen production.<key>, sonst key. Ohne Fraktion der normale Text.
 * Text in faction f's wording: production.<key> for humans, else key. Without a faction the normal text.
 */
export function techT(key: string, f: FactionId | null | undefined, vars: Record<string, string | number> = {}): string {
  return usesProduction(f) && has(`production.${key}`) ? t(`production.${key}`, vars) : t(key, vars);
}

/** Fraktions-ID zu einem Index im Spielstand (ungueltig = keine) / faction id for an index in the state (invalid = none) */
export const factionIdOf = (s: GameState | null | undefined, i: number): FactionId | null => s?.factions[i]?.id ?? null;
