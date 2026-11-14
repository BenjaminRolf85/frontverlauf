/**
 * Regeln / Hilfe: kurze, aufklappbare Abschnitte. Alle Zahlen kommen aus balance.ts, damit die Seite stimmt.
 * Rules / help: short collapsible sections. All numbers come from balance.ts so the page stays correct.
 */
import {
  BARRIER, CITY_UPGRADES, DEFENSE_BONUS, ECON, FACTION_IDS, HIT, INCOME, MODES, RANGED_COVER, REPAIR, RETREAT, ROCKETS, SCORE, START, UPKEEP,
  VICTORY_TECH,
} from '../data/balance';
import { t } from '../i18n/i18n';
import { dialogTitle, esc, factionChip, openDialog } from './components';
import { icon } from './icons';
import { victoryShortText } from './victory';

const pct = (f: number) => Math.round(f * 100);
/** Faktor als Text mit Komma im Deutschen / factor as text, comma in German */
const fac = (f: number) => (t('rules.decimal') === ',' ? String(f).replace('.', ',') : String(f));

interface Section { id: string; icon: string; params?: Record<string, string | number>; extra?: () => string }

/** Abschnitte in Lesereihenfolge / sections in reading order */
function sections(): Section[] {
  return [
    { id: 'goal', icon: 'medal', params: { rounds: MODES.pointsRounds, tile: SCORE.revealedTile, territory: SCORE.territoryTile, level: SCORE.cityLevel, tech: SCORE.techPerTier } },
    { id: 'turn', icon: 'star', params: { start: START.stars, city: INCOME.perCityLevel, hq: INCOME.hq } },
    { id: 'upkeep', icon: 'helmet', params: { free: UPKEEP.freeUnits, pct: pct(UPKEEP.share), tank: UPKEEP.flat.tank ?? 0 } },
    { id: 'combat', icon: 'dice', params: { miss: pct(HIT.mult.miss), graze: pct(HIT.mult.graze), partial: pct(HIT.mult.partial), full: pct(HIT.mult.full), crit: pct(HIT.mult.crit) } },
    { id: 'cover', icon: 'shield', params: { ring: t('rewards.bunkerRing'), city: fac(DEFENSE_BONUS.city), bunker: fac(DEFENSE_BONUS.cityWithBunker), outpost: fac(DEFENSE_BONUS.outpost), terrain: fac(DEFENSE_BONUS.terrainWithTech), ranged: fac(RANGED_COVER.factor) } },
    { id: 'abilities', icon: 'move', params: { retreat: pct(RETREAT.damage), cooldown: RETREAT.cooldown, repair: pct(REPAIR.factor), range: ROCKETS.range, max: ROCKETS.max, depot: t('cityUpgrades.depot') } },
    { id: 'cities', icon: 'city', params: { t1: ECON.researchCost(1, 1), t1c3: ECON.researchCost(1, 3), t3c3: ECON.researchCost(3, 3), slots: CITY_UPGRADES.slots } },
    { id: 'outposts', icon: 'outpost', params: { cost: ECON.outpostCost, def: fac(DEFENSE_BONUS.outpost), tech: t('techs.fortification'), barrier: BARRIER.cost } },
    { id: 'diplomacy', icon: 'diplomacy', params: { cost: ECON.embassyBaseCost, step: ECON.embassyStep, income: INCOME.embassy, tech: t('techs.intelligence') } },
    { id: 'factions', icon: 'trophy', extra: factionLines },
  ];
}

/** Eine Zeile je Fraktion: Siegbedingung und Siegtechnologie / one line per faction: victory condition and victory tech */
function factionLines(): string {
  return `<ul class="rules-factions">${FACTION_IDS.map((f) => `<li>${factionChip(f, t(`factions.${f}.short`))}
    <span><strong>${esc(t(`factions.${f}.short`))}:</strong> ${esc(victoryShortText(f))} <span class="muted">(${esc(t(`techs.${VICTORY_TECH[f]}`))})</span></span></li>`).join('')}</ul>`;
}

/** Regeln als HTML (auch fuer Tests) / rules as HTML (also for tests) */
export function rulesHtml(open: string | null = null): string {
  return sections().map((sec) => `<details class="rules-section" data-rule="${sec.id}" ${open === sec.id ? 'open' : ''}>
    <summary>${icon(sec.icon, 'icon-sm')}<span class="grow">${esc(t(`rules.${sec.id}.title`))}</span>${icon('chevronDown', 'icon-sm rules-chevron')}</summary>
    <div class="rules-body"><p>${esc(t(`rules.${sec.id}.text`, sec.params ?? {}))}</p>${sec.extra ? sec.extra() : ''}</div>
  </details>`).join('');
}

/** Regeln-Dialog (Hauptmenue und Pausenmenue) / rules dialog (main menu and pause menu) */
export function rulesDialog(root: HTMLElement, open: string | null = 'goal') {
  const d = openDialog(root, `${dialogTitle(t('rules.title'))}<p class="muted">${esc(t('rules.intro'))}</p><div class="rules">${rulesHtml(open)}</div>`, { wide: true });
  d.node.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-action="close"]')) d.close(); });
  return d;
}
