/**
 * Regeln / Hilfe: kurze, aufklappbare Abschnitte. Alle Zahlen kommen aus balance.ts, damit die Seite stimmt.
 * Rules / help: short collapsible sections. All numbers come from balance.ts so the page stays correct.
 */
import {
  BARRIER, BASES, BASE_KINDS, CITY, CITY_UPGRADES, COMBAT, CULT, DEFENSE_BONUS, ECON, FACTION_IDS, HIT, HIT_KINDS, HOME_DEFENSE, INCOME, MARTYR, MODES, MOVE_FIRE, RANGED_COVER, REPAIR, RETREAT, ROCKETS, SCORE, SIN, START, UPKEEP,
  TOWER, VICTORY_TECH, WONDERS, SILO, RADAR, SABOTAGE, WITHDRAW, FIREPOWER, SEA_POWER,
} from '../data/balance';
import { BUILDINGS, PRODUCTION, SHIPYARD, UNITS, type FactionId, type UnitTypeId } from '../data/balance';
import { DOCTRINE_TECHS } from '../core';
import { doctrineText, needsText } from './production';
import { baseRulesLines } from './bases';
import { has, num, t } from '../i18n/i18n';
import { dialogTitle, esc, factionChip, openDialog } from './components';
import { icon } from './icons';
import { techT } from './terms';
import { victoryShortText } from './victory';
import { emplacementRuleParams } from './emplacement';
import { combatBonusTexts, featureParams, memorialText } from './factionInfo';

const pct = (f: number) => Math.round(f * 100);
/** Faktor als Text mit Komma im Deutschen / factor as text, comma in German */
const fac = num;

interface Section { id: string; icon: string; params?: Record<string, string | number>; extra?: () => string }

/** Abschnitte in Lesereihenfolge / sections in reading order */
function sections(): Section[] {
  return [
    { id: 'goal', icon: 'medal', params: { rounds: MODES.pointsRounds, tile: SCORE.revealedTile, territory: SCORE.territoryTile, level: SCORE.cityLevel, tech: SCORE.techPerTier } },
    // Einkommen; Nachteile wie die Korruption der Meridon / income; drawbacks such as Meridon's corruption
    { id: 'turn', icon: 'star', params: { start: START.stars, city: INCOME.perCityLevel, hq: INCOME.hq }, extra: drawbackLines },
    { id: 'upkeep', icon: 'helmet', params: { free: UPKEEP.freeUnits, pct: pct(UPKEEP.share), tank: UPKEEP.flat.tank ?? 0, korvat: Math.round((1 - (UPKEEP.faction.korvat ?? 1)) * 100) } },
    { id: 'combat', icon: 'dice', params: { miss: pct(HIT.mult.miss), graze: pct(HIT.mult.graze), partial: pct(HIT.mult.partial), full: pct(HIT.mult.full), crit: pct(HIT.mult.crit), move: pct(MOVE_FIRE.damage) }, extra: () => rearLine() + combatBonusLines() + unitHitLines() },
    { id: 'cover', icon: 'shield', params: { ring: t('rewards.bunkerRing'), city: fac(DEFENSE_BONUS.city), bunker: fac(DEFENSE_BONUS.cityWithBunker), outpost: fac(DEFENSE_BONUS.outpost), terrain: fac(DEFENSE_BONUS.terrainWithTech), ranged: fac(RANGED_COVER.factor) } },
    { id: 'abilities', icon: 'move', params: { retreat: pct(RETREAT.damage), cooldown: RETREAT.cooldown, repair: pct(REPAIR.factor), range: ROCKETS.range, max: ROCKETS.max, depot: t('cityUpgrades.depot'), move: pct(MOVE_FIRE.damage) } },
    { id: 'cities', icon: 'city', params: { t1: ECON.researchCost(1, 1), t1c3: ECON.researchCost(1, 3), t3c3: ECON.researchCost(3, 3), slots: CITY_UPGRADES.slots,
      cap: CITY.unitLimitPerUpgrade, buy: CITY.buyLevelBase, ex2: CITY.buyLevelCost(1), ex3: CITY.buyLevelCost(2), ex4: CITY.buyLevelCost(3),
      grow: CITY.growTiles, max: 2 * CITY.growMaxRadius + 1, towerInc: TOWER.income } },
    // Produktionsstaetten und Doktrinen der Menschen / human production sites and doctrines
    { id: 'sites', icon: 'build', extra: siteLines },
    // Stuetzpunkte: Arten, Wirkung je Fraktionsgruppe, Verteilung / bases: kinds, effect per faction group, distribution
    { id: 'bases', icon: 'baseBunker', params: { kinds: BASE_KINDS.length, pct: pct(BASES.discount), gap: BASES.gapStars, tribute: pct(BASES.cultTribute) }, extra: baseRulesLines },
    // Werft der Kuestenstaedte: Schiffe kaufen, Transportboot, Einsteigen / shipyard of coastal cities: buying ships, transport boat, boarding
    { id: 'ships', icon: 'sail', params: { boat: SHIPYARD.transportCost, hull: SHIPYARD.hullHp.landingBoat ?? 0, base: t('buildings.navalBase'), dock: t('buildings.dryDock'), tech: t('techs.coastalEconomy') } },
    { id: 'doctrines', icon: 'lightning', extra: doctrineLines },
    { id: 'outposts', icon: 'outpost', params: { cost: ECON.outpostCost, outpostSpacing: ECON.outpostSpacing, def: fac(DEFENSE_BONUS.outpost), tech: t('techs.fortification'), barrier: BARRIER.cost } },
    // Festungsbau der Dravon / Dravon fortress building
    { id: 'emplacements', icon: 'range', params: emplacementRuleParams() },
    // Schattenflotte der Meridon: Tarnung, Absetzen, Raketensilo, Lenkflugkoerper, Radar, Sabotage / Meridon shadow fleet
    { id: 'shadowFleet', icon: 'silo', params: { withdraw: WITHDRAW.tiles, cost: SILO.cost, per: SILO.perCity, max: SILO.max, spacing: SILO.minSpacing, range: SILO.launchRange,
      dmg: SILO.damage, fire: SILO.fireRounds, burn: SILO.fireDamage, cd: SILO.cooldown, rr: RADAR.rounds, radius: RADAR.radius, rcd: RADAR.cooldown, scd: SABOTAGE.cooldown,
      weak: pct(1 - (FIREPOWER.land.meridon ?? 1)), sea: pct(SEA_POWER.discount.meridon ?? 0) } },
    { id: 'diplomacy', icon: 'diplomacy', params: { cost: ECON.embassyBaseCost, step: ECON.embassyStep, income: INCOME.embassy, tech: t('techs.intelligence') } },
    // Kult: Pluendern statt Wirtschaft, Rekrutieren im Feld / cult: plunder instead of economy, recruiting in the field
    { id: 'cult', icon: 'people', params: { base: CULT.plunderBase, level: CULT.plunderPerLevel, hq: CULT.plunderHq, again: CULT.replunderRounds, cap: CULT.baseCap, hqSlots: CULT.hqSlots, shrine: CULT.shrineSlots, cooldown: CULT.recruitCooldown, tithe: fac(CULT.tithePerUnit), titheMax: CULT.titheMax, titheRival: CULT.titheRival, score: CULT.plunderScore, scoreDuel: CULT.plunderScoreByRivals[1], half: Math.round(CULT.plunderDecay[1] * 100), quarter: Math.round(CULT.plunderDecay[2] * 100) },
      // Mahnmal: zur Schau gestellte Gefallene / memorial: the fallen put on display
      extra: () => `<p><strong>${esc(t('memorial.name'))}:</strong> ${esc(memorialText())}</p>` },
    // Heiliges Alvenia: Suende, Strafgericht, Segen / Holy Alvenia: sin, judgement, blessing
    { id: 'judgement', icon: 'emblemHalo', params: { rounds: SIN.rounds, pct: pct(SIN.judgement), heal: MARTYR.heal, bless: MARTYR.rounds, def: pct(MARTYR.defense), home: pct(HOME_DEFENSE.bonus.alvenia ?? 0), n: WONDERS.judgementKills[14] } },
    // Eigene Bauarten und Ausbildungsregeln (Korvat, Meridon, Velkar, Alvenia, NEXUS) / own designs and training rules
    { id: 'factionUnits', icon: 'heavyTank', extra: featureLines },
    { id: 'factions', icon: 'trophy', extra: factionLines },
  ];
}

/**
 * Eine Zeile je Produktionsstaette: Preis, Einheiten (Fraktionseinheiten mit Kuerzel), Voraussetzung. Zahlen aus balance.ts.
 * One line per production site: price, units (faction units with their short name), prerequisite. Numbers from balance.ts.
 */
function siteLines(): string {
  return `<ul>${PRODUCTION.sites.map((site) => {
    const units = PRODUCTION.units[site].map((u) => { const f = UNITS[u].faction; return f ? `${t(`units.${u}`)} (${t(`factions.${f}.short`)})` : t(`units.${u}`); }).join(', ');
    const need = PRODUCTION.needs[site];
    const extra = site === PRODUCTION.builtIn ? ` · ${t('sites.builtIn')}: ${t('hud.hq')}` : '';
    return `<li><strong>${esc(t(`buildings.${site}`))}</strong> (${BUILDINGS[site].cost} ${esc(t('hud.stars'))}${esc(extra)}): ${esc(units)}${need ? `. ${esc(t('sites.needs', { site: t(`buildings.${site}`), needs: needsText(need) }))}` : ''}</li>`;
  }).join('')}</ul>`;
}

/** Eine Zeile je neuer Doktrin-Wirkung / one line per new doctrine effect */
function doctrineLines(): string {
  return `<ul>${DOCTRINE_TECHS.map((tech) => `<li><strong>${esc(t(`techs.${tech}`))}:</strong> ${esc(doctrineText(tech))}</li>`).join('')}</ul>`;
}

/** Angriff von hinten (Ausrichtung, Rueckenbereich) / attack from behind (facing, rear arc) */
function rearLine(): string {
  return `<p><strong>${esc(t('rear.name'))}:</strong> ${esc(t('rear.rule', { pct: pct(COMBAT.rearAttack) }))}</p>`;
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

/** Eine Zeile je Fraktionsnachteil (Meridon: Korruption, Zahlen aus balance.ts) / one line per faction drawback (Meridon: corruption, numbers from balance.ts) */
function drawbackLines(): string {
  return FACTION_IDS.filter((f) => has(`factions.${f}.drawback`)).map((f) => `<p><strong>${esc(t(`factions.${f}.drawback`))} (${esc(t(`factions.${f}.short`))}):</strong> ${esc(t(`factions.${f}.drawbackDesc`))}</p>`).join('');
}

/** Eine Zeile je Fraktionsmerkmal (eigene Bauarten, Zahlen aus balance.ts) / one line per faction feature (own designs, numbers from balance.ts) */
function featureLines(): string {
  const second = (f: FactionId) => (has(`factions.${f}.feature2`) ? `<li><strong>${esc(t(`factions.${f}.feature2`))} (${esc(t(`factions.${f}.short`))}):</strong> ${esc(t(`factions.${f}.feature2Desc`))}</li>` : '');
  return `<ul>${FACTION_IDS.filter((f) => has(`factions.${f}.feature`)).map((f) => `<li><strong>${esc(t(`factions.${f}.feature`))} (${esc(t(`factions.${f}.short`))}):</strong> ${esc(t(`factions.${f}.featureDesc`, featureParams(f)))}</li>${second(f)}`).join('')}</ul>`;
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
