/**
 * Regeln / Hilfe: kurze, aufklappbare Abschnitte. Alle Zahlen kommen aus balance.ts, damit die Seite stimmt.
 * Rules / help: short collapsible sections. All numbers come from balance.ts so the page stays correct.
 */
import {
  BARRIER, CITY_UPGRADES, CULT, DEFENSE_BONUS, ECON, FACTION_IDS, HIT, HIT_KINDS, INCOME, MODES, MOVE_FIRE, RANGED_COVER, REPAIR, RETREAT, ROCKETS, SCORE, START, UPKEEP,
  VICTORY_TECH,
} from '../data/balance';
import { UNITS, type FactionId, type UnitTypeId } from '../data/balance';
import { num, t } from '../i18n/i18n';
import { dialogTitle, esc, factionChip, openDialog } from './components';
import { icon } from './icons';
import { techT } from './terms';
import { victoryShortText } from './victory';
import { emplacementRuleParams } from './emplacement';
import { combatBonusTexts } from './factionInfo';

const pct = (f: number) => Math.round(f * 100);
/** Faktor als Text mit Komma im Deutschen / factor as text, comma in German */
const fac = num;

interface Section { id: string; icon: string; params?: Record<string, string | number>; extra?: () => string }

/** Abschnitte in Lesereihenfolge / sections in reading order */
function sections(): Section[] {
  return [
    { id: 'goal', icon: 'medal', params: { rounds: MODES.pointsRounds, tile: SCORE.revealedTile, territory: SCORE.territoryTile, level: SCORE.cityLevel, tech: SCORE.techPerTier } },
    { id: 'turn', icon: 'star', params: { start: START.stars, city: INCOME.perCityLevel, hq: INCOME.hq } },
    { id: 'upkeep', icon: 'helmet', params: { free: UPKEEP.freeUnits, pct: pct(UPKEEP.share), tank: UPKEEP.flat.tank ?? 0 } },
    { id: 'combat', icon: 'dice', params: { miss: pct(HIT.mult.miss), graze: pct(HIT.mult.graze), partial: pct(HIT.mult.partial), full: pct(HIT.mult.full), crit: pct(HIT.mult.crit), move: pct(MOVE_FIRE.damage) }, extra: () => combatBonusLines() + unitHitLines() },
    { id: 'cover', icon: 'shield', params: { ring: t('rewards.bunkerRing'), city: fac(DEFENSE_BONUS.city), bunker: fac(DEFENSE_BONUS.cityWithBunker), outpost: fac(DEFENSE_BONUS.outpost), terrain: fac(DEFENSE_BONUS.terrainWithTech), ranged: fac(RANGED_COVER.factor) } },
    { id: 'abilities', icon: 'move', params: { retreat: pct(RETREAT.damage), cooldown: RETREAT.cooldown, repair: pct(REPAIR.factor), range: ROCKETS.range, max: ROCKETS.max, depot: t('cityUpgrades.depot'), move: pct(MOVE_FIRE.damage) } },
    { id: 'cities', icon: 'city', params: { t1: ECON.researchCost(1, 1), t1c3: ECON.researchCost(1, 3), t3c3: ECON.researchCost(3, 3), slots: CITY_UPGRADES.slots } },
    { id: 'outposts', icon: 'outpost', params: { cost: ECON.outpostCost, def: fac(DEFENSE_BONUS.outpost), tech: t('techs.fortification'), barrier: BARRIER.cost } },
    // Festungsbau der Dravon / Dravon fortress building
    { id: 'emplacements', icon: 'range', params: emplacementRuleParams() },
    { id: 'diplomacy', icon: 'diplomacy', params: { cost: ECON.embassyBaseCost, step: ECON.embassyStep, income: INCOME.embassy, tech: t('techs.intelligence') } },
    // Kult: Pluendern statt Wirtschaft, Rekrutieren im Feld / cult: plunder instead of economy, recruiting in the field
    { id: 'cult', icon: 'people', params: { base: CULT.plunderBase, level: CULT.plunderPerLevel, hq: CULT.plunderHq, again: CULT.replunderRounds, cap: CULT.baseCap, hqSlots: CULT.hqSlots, shrine: CULT.shrineSlots, cooldown: CULT.recruitCooldown, tithe: fac(CULT.tithePerUnit), titheMax: CULT.titheMax, score: CULT.plunderScore } },
    { id: 'factions', icon: 'trophy', extra: factionLines },
  ];
}

/** Kampfboni der Fraktionen (Feuern nach Bewegung, eigenes Gebiet) / combat bonuses of the factions (firing after moving, own territory) */
function combatBonusLines(): string {
  return FACTION_IDS.flatMap((f) => combatBonusTexts(f).map((b) => `<p><strong>${esc(b.name)} (${esc(t(`factions.${f}.short`))}):</strong> ${esc(b.desc)}</p>`)).join('');
}

/**
 * Eigene Trefferchancen einzelner Einheiten (HIT.unit, z. B. Tesla-Panzer und Railgun-Schuetze der Velkar), Zahlen aus balance.ts.
 * Own hit odds of single units (HIT.unit, e.g. Velkar's Tesla tank and railgun marksman), numbers from balance.ts.
 */
function unitHitLines(): string {
  const rows = (Object.keys(HIT.unit) as UnitTypeId[]).map((u) => {
    const o = HIT.unit[u]!;
    const f = UNITS[u].faction;
    const odds = HIT_KINDS.map((k) => `${t(`hit.${k}`)} ${pct(o[k])} %`).join(', ');
    return `<li><strong>${esc(t(`units.${u}`))}${f ? ` (${esc(t(`factions.${f}.short`))})` : ''}:</strong> ${esc(odds)}</li>`;
  });
  return rows.length ? `<p>${esc(t('hit.unitRule'))}</p><ul>${rows.join('')}</ul>` : '';
}

/** Eine Zeile je Fraktion: Siegbedingung und Siegtechnologie / one line per faction: victory condition and victory tech */
function factionLines(): string {
  return `<ul class="rules-factions">${FACTION_IDS.map((f) => `<li>${factionChip(f, t(`factions.${f}.short`))}
    <span><strong>${esc(t(`factions.${f}.short`))}:</strong> ${esc(victoryShortText(f))} <span class="muted">(${esc(t(`techs.${VICTORY_TECH[f]}`))})</span></span></li>`).join('')}</ul>`;
}

/**
 * Regeln als HTML (auch fuer Tests). f = Fraktion des Betrachters: Menschen lesen "Produktion" statt "Forschung";
 * ohne Partie (Hauptmenue) gilt der allgemeine Text mit einem Hinweis auf die Menschen-Wortwahl.
 * Rules as HTML (also for tests). f = the viewer's faction: humans read "production" instead of "research"; without a
 * game (main menu) the general text applies with a note on the human wording.
 */
export function rulesHtml(open: string | null = null, f: FactionId | null = null): string {
  return sections().map((sec) => `<details class="rules-section" data-rule="${sec.id}" ${open === sec.id ? 'open' : ''}>
    <summary>${icon(sec.icon, 'icon-sm')}<span class="grow">${esc(techT(`rules.${sec.id}.title`, f))}</span>${icon('chevronDown', 'icon-sm rules-chevron')}</summary>
    <div class="rules-body"><p>${esc(techT(`rules.${sec.id}.text`, f, sec.params ?? {}))}</p>${sec.id === 'cities' && !f ? `<p class="muted">${esc(t('rules.productionNote'))}</p>` : ''}${sec.extra ? sec.extra() : ''}</div>
  </details>`).join('');
}

/** Regeln-Dialog (Hauptmenue und Pausenmenue); f wie bei rulesHtml / rules dialog (main menu and pause menu); f as in rulesHtml */
export function rulesDialog(root: HTMLElement, open: string | null = 'goal', f: FactionId | null = null) {
  const d = openDialog(root, `${dialogTitle(t('rules.title'))}<p class="muted">${esc(t('rules.intro'))}</p><div class="rules">${rulesHtml(open, f)}</div>`, { wide: true });
  d.node.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-action="close"]')) d.close(); });
  return d;
}
