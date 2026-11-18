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
import { factionRace, factionVariant, type GameState } from '../core';
import { REWARD_HEAVY, type FactionId } from '../data/balance';
import { has, t } from '../i18n/i18n';

/**
 * Titel (desc false) oder Beschreibung einer Stadtbelohnung fuer die Fraktion am Zug; "Panzer" mit mehreren Lenkflugkoerpern
 * (REWARD_HEAVY, Meridon) hat eigene Texte mit der Zahl.
 * Title (desc false) or description of a city reward for the faction to move; "tank" with several Guided Missiles
 * (REWARD_HEAVY, Meridon) has its own texts with the number.
 */
export function rewardText(s: GameState, option: string, desc: boolean): string {
  const f = s.current;
  const missiles = option === 'tank' && (REWARD_HEAVY.count[s.factions[f].id] ?? 1) > 1 && factionVariant(s, f, 'tank') === 'guidedMissile';
  return t(`rewards.${missiles ? 'tankMissiles' : option}${desc ? 'Desc' : ''}`);
}

/** Spricht die Fraktion von Produktion statt Forschung? (Menschen) / does the faction say production instead of research? (humans) */
export const usesProduction = (f: FactionId | null | undefined): boolean => !!f && factionRace(f) === 'human';

/**
 * Text in der Wortwahl der Fraktion f: fuer Menschen production.<key>, sonst key. Ohne Fraktion der normale Text.
 * Text in faction f's wording: production.<key> for humans, else key. Without a faction the normal text.
 */
export function techT(key: string, f: FactionId | null | undefined, vars: Record<string, string | number> = {}): string {
  return usesProduction(f) && has(`production.${key}`) ? t(`production.${key}`, vars) : t(key, vars);
}

/** Symbol fuer Forschung bzw. Produktion / icon for research or production */
export const techIcon = (f: FactionId | null | undefined): string => (usesProduction(f) ? 'production' : 'research');

/** Fraktions-ID zu einem Index im Spielstand (ungueltig = keine) / faction id for an index in the state (invalid = none) */
export const factionIdOf = (s: GameState | null | undefined, i: number): FactionId | null => s?.factions[i]?.id ?? null;
