/**
 * Stuetzpunkte in der Oberflaeche: Symbol und Name je Art, die Wirkung in den Worten der Fraktion des Betrachters (Menschen:
 * eingebaute Produktionsstaette; Zyrr, Kult, NEXUS: Rabatt, Energie, Xeno-Boden, Ersatz-Sterne), Zeilen fuer Feld- und
 * Stadtfeld und fuer die Regeln. Alle Zahlen kommen ueber die Balance-Platzhalter (balanceVars.ts) aus BASES.
 * Bases in the UI: icon and name per kind, the effect in the words of the viewer's faction (humans: built-in production
 * site; Zyrr, cult, NEXUS: discount, energy, xeno ground, substitute stars), lines for the tile and city panels and for
 * the rules. All numbers come from BASES through the balance placeholders (balanceVars.ts).
 */
import { baseGap, noTraining, supportedUnits, tributeStars, unitLimit, type City, type GameState } from '../core';
import { BASES, BASE_KINDS, CULT, NEXUS, PRODUCTION, UNITS, XENO, type BaseKind, type FactionId, type UnitTypeId } from '../data/balance';
import { has, t } from '../i18n/i18n';
import { esc } from './components';
import { icon } from './icons';

/** Symbol je Art (Liniensymbole in icons.ts) / icon per kind (line icons in icons.ts) */
export const BASE_ICON: Record<BaseKind, string> = {
  barracks: 'baseBarracks', bunker: 'baseBunker', tankFactory: 'baseTankFactory', airbase: 'baseAirbase', supplyDepot: 'baseDepot',
  navalStation: 'baseNaval', gunWorks: 'baseGunWorks', fieldHospital: 'baseHospital', housing: 'baseHousing', supermarket: 'baseSupermarket',
  factory: 'baseFactory', nuclearPlant: 'baseNuclear', solarFarm: 'baseSolar', windFarm: 'baseWind',
};

/** Name der Art / name of the kind */
export const baseName = (kind: BaseKind): string => t(`bases.name.${kind}`);

const SPECIAL: FactionId[] = [XENO.faction, CULT.faction, NEXUS.faction];
const isSpecial = (f: FactionId | null): f is FactionId => !!f && !PRODUCTION.factions.includes(f);

/**
 * Einheiten aus der Rabattliste der Art, die Fraktion f hat (Schiffe: alle ausser fuer die Zyrr); ohne Fraktion alle.
 * Units from the kind's discount list that faction f has (ships: all except for the Zyrr); without a faction all of them.
 */
export function baseDiscountUnits(kind: BaseKind, f: FactionId | null): UnitTypeId[] {
  return (BASES.discountUnits[kind] ?? []).filter((u) => {
    if (!f) return true;
    const own = UNITS[u].faction;
    return own ? own === f : UNITS[u].ship && f !== XENO.faction;
  });
}
const unitList = (list: UnitTypeId[]): string => list.map((u) => t(`units.${u}`)).join(', ');

/**
 * Wirkung der Art fuer Fraktion f in einem Satz. Ohne Fraktion (Regeln, Hauptmenue) der allgemeine Text der Menschen.
 * Effect of the kind for faction f in one sentence. Without a faction (rules, main menu) the general human text.
 */
export function baseEffectText(kind: BaseKind, f: FactionId | null): string {
  // Kult: von Sternen (auch Ersatz-Sternen) nur der Tribut-Anteil / cult: of stars (substitute stars too) only the tribute share
  if (f === CULT.faction) {
    if (baseGap(kind, f)) return t('bases.gapCult', { n: tributeStars(BASES.gapStars) });
    const stars = BASES.stars[kind];
    if (stars) return [t('bases.tribute', { n: tributeStars(stars) }), has(`bases.cult.${kind}`) ? t(`bases.cult.${kind}`) : ''].filter(Boolean).join(' ');
  }
  // ohne passende Einheit: Ersatz-Sterne (Kult am Flughafen, Zyrr am Marinestuetzpunkt, Meridon an der Panzerfabrik)
  // without a matching unit: substitute stars (cult at the airfield, Zyrr at the naval base, Meridon at the tank factory)
  if (f && baseGap(kind, f)) return t('bases.gap', { faction: t(`factions.${f}.short`) });
  if (isSpecial(f)) {
    if (BASES.discountUnits[kind]) return t('bases.discount', { units: unitList(baseDiscountUnits(kind, f)) });
    const own = f === XENO.faction ? 'zyrr' : f === CULT.faction ? 'cult' : 'nexus';
    if (has(`bases.${own}.${kind}`)) return t(`bases.${own}.${kind}`);
    if (has(`bases.other.${kind}`)) return t(`bases.other.${kind}`);
  }
  return t(`bases.effect.${kind}`);
}

/**
 * Zeile mit Symbol, Name und Wirkung fuer das Feld- und Stadtfeld. cls: zusaetzliche Klassen (z. B. sheet-more).
 * Line with icon, name and effect for the tile and city panels. cls: extra classes (e.g. sheet-more).
 */
export function baseLineHtml(kind: BaseKind, f: FactionId | null, cls = ''): string {
  return `<p class="icon-line base-line ${cls}" data-base="${kind}">${icon(BASE_ICON[kind], 'icon-sm')}<span><strong>${esc(baseName(kind))}:</strong> ${esc(baseEffectText(kind, f))}</span></p>`;
}

/**
 * Hinweis statt der Truppenleiste bei Wohnbloecken und Supermarkt: Name der Art, keine Ausbildung, belegte Plaetze und der
 * Schutz der Wohnbloecke. Ersetzt dort auch die Wirkungszeile (sonst stuende alles doppelt).
 * Note instead of the troop strip for residential blocks and the supermarket: name of the kind, no training, the used
 * slots and the residential blocks' protection. It also replaces the effect line there (otherwise everything would show twice).
 */
export function supplyNoteHtml(s: GameState, c: City): string {
  if (!noTraining(c) || !c.base) return '';
  const defense = BASES.defense[c.base] ? ` ${t('bases.supplyDefense')}` : '';
  return `<p class="icon-line base-supply" data-base-supply>${icon(BASE_ICON[c.base], 'icon-sm')}<span><strong>${esc(baseName(c.base))}: ${esc(t('bases.noTraining'))}</strong> ${esc(t('bases.supply', { n: supportedUnits(s, c), max: unitLimit(s, c) }) + defense)}</span></p>`;
}

/**
 * Regeln: eine Zeile je Art mit der Wirkung fuer die Menschen, dazu die Wirkung fuer Zyrr, Kult und NEXUS, wo sie abweicht.
 * Rules: one line per kind with the effect for the humans, plus the effect for Zyrr, cult and NEXUS where it differs.
 */
export function baseRulesLines(): string {
  const short = (f: FactionId) => t(`factions.${f}.short`);
  const rows = BASE_KINDS.map((kind) => {
    const extra: string[] = [];
    if (BASES.discountUnits[kind]) {
      const with_ = SPECIAL.filter((f) => !baseGap(kind, f));
      extra.push(`${with_.map(short).join(', ')}: ${t('bases.discount', { units: unitList(baseDiscountUnits(kind, null)) })}`);
    } else {
      for (const [f, own] of [[XENO.faction, 'zyrr'], [CULT.faction, 'cult'], [NEXUS.faction, 'nexus']] as [FactionId, string][]) {
        // Kraftwerke und Fabrik nennen NEXUS und Zyrr schon im allgemeinen Text / power kinds and the factory already name NEXUS and the Zyrr in the general text
        if (has(`bases.${own}.${kind}`) && BASES.energy[kind] === undefined && kind !== 'factory') extra.push(`${short(f)}: ${t(`bases.${own}.${kind}`)}`);
      }
    }
    for (const f of BASES.gap[kind] ?? []) extra.push(f === CULT.faction ? t('bases.gapCult', { n: tributeStars(BASES.gapStars) }) : t('bases.gap', { faction: short(f) }));
    return `<li class="icon-line">${icon(BASE_ICON[kind], 'icon-sm')}<span><strong>${esc(baseName(kind))}:</strong> ${esc(t(`bases.effect.${kind}`))}${extra.map((x) => ` <span class="muted">${esc(x)}</span>`).join('')}</span></li>`;
  });
  return `<ul class="rules-bases">${rows.join('')}</ul>`;
}
