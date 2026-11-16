/**
 * Produktionsstaetten und Doktrinen in der Oberflaeche: Einheitenlisten je Staette, Sperrgruende im Ausbildungsmenue,
 * Staetten-Zeile im Stadtfeld, Doktrin-Texte. Zahlen und Listen kommen aus balance.ts (PRODUCTION, DOCTRINE).
 * Production sites and doctrines in the UI: unit lists per site, lock reasons in the train menu, the sites row in the
 * city panel, doctrine texts. Numbers and lists come from balance.ts (PRODUCTION, DOCTRINE).
 */
import {
  builtInSite, citySites, isProductionSite, replacedFor, siteNeed, siteOf, usesSites, type City, type GameState,
} from '../core';
import { DOCTRINE, PRODUCTION, UNITS, type BuildingId, type FactionId, type ProductionSiteId, type TechId, type UnitTypeId } from '../data/balance';
import { has, t } from '../i18n/i18n';
import { esc } from './components';
import { icon } from './icons';

/** Symbole der Staetten (wie ihre wichtigste Einheit) / icons of the sites (like their main unit) */
export const SITE_ICON: Record<ProductionSiteId, string> = {
  trainingCamp: 'helmet', armory: 'attack', motorPool: 'truck', tankWorks: 'shield', foundry: 'furnace', airfield: 'fuel', navalBase: 'boot', dryDock: 'sail',
};

/**
 * Einheiten einer Staette fuer Fraktion f (eigene Bauarten statt Grundtyp); ohne Fraktion nur die allgemeinen.
 * Units of a site for faction f (own designs instead of the base type); without a faction only the common ones.
 */
export function siteUnits(site: ProductionSiteId, f?: FactionId | null): UnitTypeId[] {
  return PRODUCTION.units[site].filter((u) => {
    const fac = UNITS[u].faction;
    if (!f) return !fac;
    return (!fac || fac === f) && !replacedFor(f, u);
  });
}

/** "Tagebau oder Tiefbauzeche" / "mine or deep mine" */
export const needsText = (need: BuildingId[]): string => need.map((b) => t(`buildings.${b}`)).join(t('sites.or'));

/** Platzhalter der Gebaeudebeschreibung einer Staette / placeholders of a site's building description */
export function siteDescVars(b: BuildingId, f?: FactionId | null): Record<string, string> {
  if (!isProductionSite(b)) return {};
  const need = PRODUCTION.needs[b];
  return { units: siteUnits(b, f).map((u) => t(`units.${u}`)).join(', '), needs: need ? needsText(need) : '' };
}

/**
 * Sperrgrund im Ausbildungsmenue: "Benoetigt Panzerwerk" plus die Voraussetzung, wenn sie in dieser Stadt fehlt.
 * Lock reason in the train menu: "Requires tank works" plus the prerequisite if this city lacks it.
 */
export function trainLockReason(s: GameState, c: City, type: UnitTypeId): string {
  const site = siteOf(type);
  if (!site) return t('errors.buildingMissing');
  const name = t(`buildings.${site}`);
  const need = siteNeed(s, c, site);
  const base = t('sites.requires', { site: name });
  return need ? `${base} · ${t('sites.needs', { site: name, needs: needsText(need) })}` : base;
}

/** Sperrgrund beim Bauen einer Staette ohne Voraussetzung / lock reason when building a site without its prerequisite */
export function buildLockReason(b: BuildingId): string {
  const need = isProductionSite(b) ? PRODUCTION.needs[b] : undefined;
  return need ? t('sites.needs', { site: t(`buildings.${b}`), needs: needsText(need) }) : t('errors.buildingMissing');
}

/**
 * Zeile im Stadtfeld: Staetten der Stadt als Marken (eingebaute gekennzeichnet); leer mit Hinweis. Nur Menschen.
 * Row in the city panel: the city's sites as tags (built-in ones marked); empty with a hint. Humans only.
 */
export function citySitesHtml(s: GameState, c: City): string {
  if (c.owner === null || !usesSites(s, c.owner)) return '';
  const sites = citySites(s, c);
  if (!sites.length) return `<div class="sites-row" aria-label="${esc(t('sites.title'))}"><span class="muted">${esc(t('sites.title'))}</span><span class="tag warn">${esc(t('sites.none'))}</span></div>`;
  const tags = sites.map((site) => {
    const built = builtInSite(s, c, site) ? ` · ${t('sites.builtIn')}` : '';
    return `<span class="tag site-tag" title="${esc(siteUnits(site, s.factions[c.owner!].id).map((u) => t(`units.${u}`)).join(', '))}">${icon(SITE_ICON[site], 'icon-sm')}${esc(t(`buildings.${site}`) + built)}</span>`;
  });
  return `<div class="sites-row" aria-label="${esc(t('sites.title'))}"><span class="muted">${esc(t('sites.title'))}</span>${tags.join('')}</div>`;
}

/** Platzhalter der Doktrin-Texte (Zahlen aus DOCTRINE) / placeholders of the doctrine texts (numbers from DOCTRINE) */
const DOCTRINE_VARS: Partial<Record<TechId, Record<string, number>>> = {
  motorization: { pct: Math.round(DOCTRINE.motorizationDiscount * 100) },
  aerodynamics: { n: DOCTRINE.aerodynamicsFlak },
  fortification: { n: DOCTRINE.fortificationMine },
  intelligence: { n: DOCTRINE.intelligenceSpyMove },
  mining: { pct: Math.round(DOCTRINE.miningDiscount * 100) },
  armsIndustry: { pct: Math.round(DOCTRINE.armsIndustryAttack * 100) },
  cybernetics: { n: DOCTRINE.cyberneticsMedic },
  navalArtillery: { pct: Math.round(DOCTRINE.navalArtilleryAttack * 100) },
  shipbuilding: { pct: Math.round(DOCTRINE.shipbuildingDiscount * 100) },
  forestry: { pct: Math.round(DOCTRINE.forestryDiscount * 100) },
  ballistics: { n: DOCTRINE.ballisticsRange },
};

/** Neue Doktrin-Wirkung einer Technologie (leer, wenn sie keine hat) / new doctrine effect of a tech (empty if it has none) */
export function doctrineText(tech: TechId): string {
  return has(`doctrine.${tech}`) ? t(`doctrine.${tech}`, DOCTRINE_VARS[tech] ?? {}) : '';
}
