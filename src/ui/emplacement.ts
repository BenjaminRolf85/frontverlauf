/**
 * Texte zur Geschuetzstellung (Festungsbau, Dravon) fuer Feldpanel, Detailansicht, Aktionen und Regeln.
 * Texts for the gun emplacement (fortification, Dravon) for the tile panel, details view, actions and rules.
 */
import { EMPLACEMENT } from '../data/balance';
import { emplacementLimit, emplacementsOf, type GameState } from '../core';
import { num, t } from '../i18n/i18n';

/** Kurzname der Fraktion / short name of the faction */
const short = (s: GameState, f: number) => t(`factions.${s.factions[f].id}.short`);

/** "Dravon-Geschuetzstellung" / "Dravon gun emplacement" */
export const emplacementName = (s: GameState, f: number) => t('emplacement.nameOf', { name: short(s, f) });

/** Beschreibung mit Zahlen aus balance.ts / description with numbers from balance.ts */
export const emplacementDesc = (s: GameState, f: number) => t('emplacement.desc', { name: short(s, f), range: EMPLACEMENT.range });

/** Werte als Zeile: LP, Reichweite, Angriff, Verteidigung / stats as a line: HP, range, attack, defence */
export const emplacementStats = (hp: number) => t('emplacement.stats', {
  hp, max: EMPLACEMENT.hp, range: EMPLACEMENT.range, atk: num(EMPLACEMENT.attack), def: num(EMPLACEMENT.defense),
});

/** "2/3 Stellungen" / "2/3 emplacements" */
export const emplacementCount = (s: GameState, f: number) => t('emplacement.count', { n: emplacementsOf(s, f).length, max: emplacementLimit(s, f) });

/** Regeltext-Parameter / rules text parameters */
export const emplacementRuleParams = () => ({
  cost: EMPLACEMENT.cost, hp: EMPLACEMENT.hp, atk: num(EMPLACEMENT.attack), def: num(EMPLACEMENT.defense), range: EMPLACEMENT.range,
  per: EMPLACEMENT.perCity, spacing: EMPLACEMENT.minSpacing, tech: t('techs.fortification'), pioneer: t('units.pioneer'), layer: t('units.mineLayer'),
});
