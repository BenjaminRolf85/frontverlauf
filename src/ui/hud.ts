/**
 * Spieloberflaeche: schmale Statusleiste oben, Kartensteuerung, Aktionsleiste im Daumenbereich.
 * Game HUD: slim status bar on top, map controls, action bar in the thumb zone.
 */
import {
  type FactionId, type UnitTypeId, type CounterClass, type WonderKind, WONDERS, COUNTER, CRASH, CULT, CITY, INCOME, JUNGLE, VOLCANO, XENO, BARRIER, CITY_UPGRADES, CITY_UPGRADE_IDS, BUILDINGS, type CityUpgradeId, GRAND_PROJECT_IDS, INFANTRY_TYPES, SHIP_UPGRADES, UNIQUE, UNITS, UPKEEP, HIT_KINDS, VERDAN, EMPLACEMENT, SILO, HACK, SUPPLY_LINE, TOWER, ROCKETS, RESEARCH_CENTER_TECH, RESOURCE, type BuildingId, type TechId,
} from '../data/balance';
import {
  burning, isJungle, roundsToEruption, corruptionRule, paidUnits, unitUpkeep, upkeepFactor, upkeep, neighbors, canResearch, computeStats, isCultFaction, isRobotFaction, recruitSpot, recruitReason, recruitTypes, recruitWait, cultCap, cultSlots, cultUnits, plunderValue, cityTiles,
  barrierCost, outpostCost, canSeeMine, mineCheck, mineTargets, barrierCheck, barrierTargets, isAlienFaction, terraformCheck, terraformTargets, isDesert, isAlienWorld, weather, weatherAt, hasWeather, nextWeatherRound, cityUpgradeCheck, hasCityUpgrade, radioTargets, cityUpgrades, buildCheck, canActStill, canHeal, captureKind, cityAt, cityIncome, cityById, combatPreview, grandProjectCheck,
  has, healAmount, income, noTraining, supplySlots, baseUnits, isExplored, levelUpCost, outpostCheck, score, supportedUnits, unitAt, unitById,
  unitCost, unitLimit, upgradeUnitLimit, buyLevelCheck, buyLevelCost, unitRange, upgradeCheck, canSeeUnit, territoryOwner, MAX_FUEL, isWonder, wonderCheck, wonderKindOf, factionVictoryOn, hasTech, victoryTechOf, hitChanceOn, hitOdds, factionCrit, unitHitProfile, unitRace, isWonderStructure, attackTargets, canOrderlyRetreat, retreatCheck, retreatDamage, repairCheck, repairAmount, cultFrenzy, alienHealBlocked, rocketTargets, rocketsLeft, persuadeCheck, persuadeCost, persuadeTargets, type CombatPreview,
  supplyLines, movesFireFree, rearAttackBonus, turretAt, turretTargets, turretPreview, missionById, movedThisTurn, moveFireBonus, moveFireMult, homeDefenseAt, entrenchMiss, canAttackNow, memorialAt, memorialEffect, memorialMult,
  blessingOf, blessingRoundsLeft, judgementAt, usesSites, siteOf, shipUpgradeCost, isProductionSite, builtInSite, scarTier,
  trueOwner, emplacementBlock, emplacementLimit, emplacementTargets, emplacementsOf, isEmplacementBuilder, buildsSilos, silosOf,
  type City, type GameState, type Unit,
} from '../core';
import { emplacementCount, emplacementDesc, emplacementName, emplacementStats } from './emplacement';
import type { Controller } from '../game/controller';
import { has as hasText, num, t } from '../i18n/i18n';
import { cityNameOf } from '../i18n/cityNames';
import { Portrait } from './portrait';
import { leaderPortrait } from './leaders';
import { factionDialog } from './screens';
import {
  actionButton, esc, factionBadge, factionChip, iconButton, price, progress, resource, type ActionItem,
} from './components';
import { icon } from './icons';
import { techIcon, techT } from './terms';
import { victoryGoalText, wonderPanel } from './victory';
import { sinTag } from './sin';
import { orbitalButton, orbitalSheet, orbitalVars } from './orbital';
import { academyActions, academySheet, beamSheet, postActions, unitAcademyActions } from './academy';
import { shadowTags, shadowUnitActions, siloSheet, siloTile } from './shadowFleet';
import { berserkerActions, berserkerStats, strikeTags, strikeVars } from './berserker';
import { cityHackHtml, hackCityAction, hackPlaceAction, hackTowerBuildAction, hackTowerTile, hijackSheet, hijackTag } from './hacking';
import { shipSheet, workAction } from './mothership';
import { droppedPlansTag, plansAction, plansUnitTag, templeSheet } from './temple';
import { SITE_ICON, buildLockReason, citySitesHtml, siteDescVars } from './production';
import { BASE_ICON, baseLineHtml, baseName, supplyNoteHtml } from './bases';
import { siloCards, troopCards, troopsHtml, type TroopCard } from './troops';
import { UNIT_ROLE, unitRoleIcon } from './unitRoles';

/** Langes Druecken auf eine Aktion zeigt ihre Erklaerung (ms) / long-press on an action shows its explanation (ms) */
const HINT_PRESS_MS = 450;

const CITY_UPGRADE_ICON: Record<CityUpgradeId, string> = { radioTower: 'range', bunker: 'shield', barracks: 'helmet', hospital: 'heal', flak: 'attack', depot: 'star', satRelay: 'satellite' };
const WEATHER_ICON: Record<string, string> = { clear: 'sun', rain: 'rain', snow: 'snow', wind: 'wind', dust: 'storm', meteor: 'lightning', acid: 'rain', quake: 'warning', calm: 'sun' };
/**
 * Symbol je Einheitentyp: das Rollensymbol (unitRoles.ts), dasselbe wie auf der LP-Plakette ueber der Einheit.
 * Icon per unit type: the role icon (unitRoles.ts), the same as on the HP badge above the unit.
 */
export const UNIT_ICON: Record<string, string> = Object.fromEntries((Object.keys(UNIT_ROLE) as UnitTypeId[]).map((k) => [k, unitRoleIcon(k)]));

/**
 * Rollensymbol im Einheitenfeld (neben dem Typnamen): wie die Kappe der LP-Plakette, Rollenname als Tooltip.
 * Role icon in the unit panel (next to the type name): like the cap of the HP badge, role name as tooltip.
 */
function roleChip(type: UnitTypeId): string {
  const name = t(`unitRoles.${UNIT_ROLE[type]}`);
  return `<span class="role-cap" title="${esc(name)}">${icon(unitRoleIcon(type), 'icon-sm')}<span class="sr-only">${esc(name)}</span></span>`;
}
const COUNTER_KEY: Record<CounterClass, string> = { vehicle: 'counter.vsVehicle', air: 'counter.vsAir', foot: 'counter.vsFoot' };

/** Konter-Boni als Text, z. B. "+150 % gegen Fahrzeuge" / counter bonuses as text */
export function counterTags(type: UnitTypeId): { text: string; good: boolean }[] {
  const bonus = UNITS[type].bonusVs ?? {};
  const sign = (pct: number) => (pct > 0 ? `+${pct}` : `${pct}`);
  const out = (Object.entries(bonus) as [CounterClass, number][]).map(([cls, f]) => {
    const pct = Math.round((f - 1) * 100);
    return { text: t(COUNTER_KEY[cls], { pct: sign(pct) }), good: pct > 0 };
  });
  // feste Schlagkraft (Berserker): stark gegen Fusstruppen, schwach gegen Panzerung / fixed striking power (berserker): strong vs foot troops, weak vs armour
  out.push(...strikeTags(type));
  // Rassen-Bonus (Kamikaze-Drohne): menschliche Fusstruppen, Zyrr / race bonus (kamikaze drone): human foot troops, Zyrr
  for (const r of UNITS[type].bonusRace ?? []) {
    const pct = Math.round((r.factor - 1) * 100);
    out.push({ text: t(r.races.includes('alien') ? 'counter.alien' : 'counter.humanFoot', { pct: sign(pct) }), good: pct > 0 });
  }
  return out;
}
export const BUILD_ICON: Partial<Record<BuildingId, string>> = {
  road: 'move', bridge: 'move', researchCenter: 'research', logisticsCenter: 'star', dataCenter: 'research', powerPlant: 'lightning', shrine: 'crown',
  kolkhoz: 'wheat', mercenaryBarracks: 'tent', embassyPalace: 'columns', tradingPost: 'scale', testLab: 'tesla',
  // Ressourcengebaeude der Fraktionen / faction resource buildings
  tractorStation: 'tractor', deepMine: 'headframe', hillVineyard: 'grapes', tradeHarbour: 'crane',
  polarStation: 'polar', wreckSmelter: 'furnace', pilgrimSite: 'bell', depotNode: 'drone',
  // Produktionsstaetten der Menschen / human production sites
  ...SITE_ICON,
};

/**
 * Gebaeudebeschreibung mit Zahlen aus balance.ts (Platzhalter in buildingDesc).
 * Building description with numbers from balance.ts (placeholders in buildingDesc).
 */
export function buildingDescText(b: BuildingId, f?: FactionId | null): string {
  const st = BUILDINGS[b];
  return t(`buildingDesc.${b}`, {
    // Produktionsstaetten: Einheiten und Voraussetzung / production sites: units and prerequisite
    ...siteDescVars(b, f),
    pop: st.pop, stars: st.stars ?? 0, adj: st.adjacency?.pop ?? 0, compute: st.compute ?? 0, slots: CULT.shrineSlots,
    pct: Math.round(RESOURCE.polarDiscount * 100), max: RESOURCE.polarMax,
    heal: RESOURCE.vineyardHeal, naval: RESOURCE.harbourNavalBonus,
    perSinner: UNIQUE.cathedralPerSinner, maxSinners: UNIQUE.cathedralMaxSinners,
  });
}

/**
 * Beute-Hinweis fuer einen Kult-Betrachter: was die Stadt beim Einnehmen bringt (oder dass sie noch leer ist).
 * Loot hint for a cult viewer: what the city brings when taken (or that it is still empty).
 */
function lootTag(s: GameState, viewer: number, c: { id: number; owner: number | null; plundered?: number }): string {
  if (viewer < 0 || !isCultFaction(s, viewer) || c.owner === viewer) return '';
  const city = cityById(s, c.id)!;
  const n = plunderValue(s, viewer, city);
  const text = n > 0 ? t('cult.loot', { n }) : t('cult.lootEmpty', { n: (c.plundered ?? 0) + CULT.replunderRounds });
  return `<div class="row"><span class="tag ${n > 0 ? '' : 'warn'}">${icon('star', 'icon-sm')}${esc(text)}</span></div>`;
}

/** Allgemeiner Typname (fuer Vergleiche) / generic type name (for comparison) */
export function unitName(u: Unit): string {
  return u.carried ? `${t(`units.${u.type}`)} (${t('stats.carrying', { unit: t(`units.${u.carried}`) })})` : t(`units.${u.type}`);
}
/** Spitzname eines Einheitentyps in einer Fraktion / nickname of a unit type within a faction */
export function unitNickname(f: FactionId, type: UnitTypeId): string {
  const key = `unitNicknames.${f}.${type}`;
  return hasText(key) ? t(key) : t(`units.${type}`);
}
/** Anzeigename einer Einheit: Spitzname ihrer Fraktion / display name of a unit: its faction's nickname */
export function unitDisplayName(s: GameState, u: Unit): string {
  // uebernommene Einheit (HACK.tower): Name nach dem eigentlichen Besitzer / taken-over unit (HACK.tower): name after the actual owner
  const f = s.factions[trueOwner(u)]?.id;
  if (!f) return unitName(u);
  return u.carried ? `${unitNickname(f, u.type)} (${t('stats.carrying', { unit: unitNickname(f, u.carried) })})` : unitNickname(f, u.type);
}
/** Stadtname, fuer alle Stellen gleich (regionale Listen) / city name, the same everywhere (regional lists) */
export function cityName(s: GameState, cityId: number): string {
  return cityById(s, cityId) ? cityNameOf(s, cityId) : '';
}

/**
 * Angriffsvorschau mit Trefferglueck: kurz (zweite Zeile im Knopf) und voll (Hinweiszeile).
 * Attack preview with hit luck: short (second line in the button) and full (hint line).
 */
function attackPreview(s: GameState, p: CombatPreview, u: Unit, target: Unit): { short: string; full: string } {
  // nach Bewegung oder gegen ein Bollwerk: Zahlen sind schon verringert, die Hinweiszeile sagt warum
  // after moving or against a bulwark: numbers are already reduced, the hint line says why
  const notes = combatNotes(s, p, u, target);
  const moved = notes ? `. ${notes}` : '';
  if (!hitChanceOn(s)) {
    const txt = p.kills ? t('actions.previewKill') : t('actions.preview', { dmg: p.toDefender, ret: p.toAttacker });
    return { short: txt, full: `${txt}${moved}` };
  }
  const pct = Math.round(p.killChance * 100);
  const ret = Math.round(p.expectedRet / Math.max(0.01, 1 - p.killChance));
  if (pct >= 100) return { short: t('actions.previewKill'), full: `${t('actions.previewKill')}${moved}` };
  const dmg = t('hit.previewDmg', { exp: Math.round(p.expected), min: p.min, max: p.max });
  const kill = pct > 0 ? ` · ${t('hit.killChance', { pct })}` : '';
  return { short: `${dmg}${kill}`, full: `${dmg}${kill}${p.retFull > 0 ? ` · ${t('hit.previewRet', { ret })}` : ''}${moved}. ${t('hit.hintLuck')}` };
}

/**
 * Kurzhinweis zum Feuern nach Bewegung, mit Fraktionsbonus (z. B. "Nach Bewegung: 75 % (Steppensturm)").
 * Short note on firing after moving, with the faction bonus (e.g. "After moving: 75 % (Steppe Storm)").
 */
function moveFireHint(s: GameState, u: Unit, key: 'hint' | 'tag' = 'hint'): string {
  const b = moveFireBonus(s, u);
  return b ? t(`moveFire.${key}Bonus`, { pct: Math.round(moveFireMult(s, u) * 100), name: t(`moveFire.bonus.${b}`) }) : t(`moveFire.${key}`);
}

/**
 * Hinweis zum Verteidigungsbonus des Ziels auf eigenem Gebiet (z. B. "Ziel verteidigt +25 % (Friedensbollwerk)").
 * Note on the target's defence bonus on own territory (e.g. "Target defends +25 % (Peace Bulwark)").
 */
function homeDefenseHint(s: GameState, target: Unit, key: 'hint' | 'tag' = 'hint'): string {
  const b = homeDefenseAt(s, target);
  return b > 0 ? t(`homeDefense.${key}`, { pct: Math.round(b * 100), name: t(`homeDefense.bonus.${s.factions[target.owner].id}`) }) : '';
}

/**
 * Eigene Trefferchancen des Einheitentyps (HIT.unit), z. B. "Tesla: hoher Schaden, 38 % Fehlschuss"; leer ohne Trefferglueck.
 * Own hit odds of the unit type (HIT.unit), e.g. "Tesla: high damage, 38% miss"; empty without hit luck.
 */
function hitProfileHint(s: GameState, u: Unit): string {
  if (!hitChanceOn(s) || !unitHitProfile(u.type)) return '';
  return t(`hit.unit.${u.type}`, { miss: Math.round(hitOdds(s, u).miss * 100) });
}

/** Feuert nur aus dem Stand (kein Sturm): nach einer Bewegung kein Angriff / fires only from a standstill (no dash): no attack after moving */
export function stationaryOnly(type: UnitTypeId): boolean {
  const st = UNITS[type];
  return !st.ship && st.move > 0 && st.attack > 0 && st.range > 0 && !st.abilities.includes('dash') && !st.abilities.includes('wonder');
}

/**
 * Hinweis zum Mahnmal des Kults unter u: "Mahnmal: +25 % Schaden" (Kult) oder "Furcht (Mahnmal): -25 % Schaden" (Menschen).
 * Note on the cult memorial under u: "Memorial: +25 % damage" (cult) or "Fear (memorial): -25 % damage" (humans).
 */
function memorialHint(s: GameState, u: Unit, key: 'Hint' | 'Tag' = 'Hint'): string {
  const e = memorialEffect(s, u);
  if (!e) return '';
  return t(`memorial.${e}${key}`, { pct: Math.round((e === 'zeal' ? CULT.memorialAttack : CULT.memorialFear) * 100) });
}

/** Kampfhinweise einer Vorschau, durch " · " getrennt / combat notes of a preview, separated by " · " */
function combatNotes(s: GameState, p: { moveFire: boolean; homeDefense?: number; judgement?: number; blessing?: number; memorial?: number; entrenched?: number; rear?: number }, u: Unit, target: Unit | null): string {
  // Angriff von hinten zuerst: der wichtigste Grund fuer hoehere Zahlen / attack from behind first: the main reason for higher numbers
  return [p.rear ? t('rear.hint', { pct: Math.round(p.rear * 100) }) : '', hitProfileHint(s, u), stationaryOnly(u.type) ? t('stationary.tag') : '', p.moveFire ? moveFireHint(s, u) : '',
    // Kamikaze: die Drohne ist danach zerstoert / kamikaze: the drone is destroyed afterwards
    has(u, 'kamikaze') ? t('kamikaze.note') : '',
    // Strafgericht gegen Suender, Segen des Ziels / judgement against sinners, blessing of the target
    p.judgement ? t('sin.judgement', { pct: Math.round(p.judgement * 100) }) : '',
    target && p.homeDefense ? homeDefenseHint(s, target) : '',
    p.blessing ? t('blessing.hint', { pct: Math.round(p.blessing * 100) }) : '',
    // verschanztes Ziel (Korvat) / entrenched target (Korvat)
    p.entrenched ? t('entrench.hint', { pct: Math.round(p.entrenched * 100) }) : '',
    p.memorial && p.memorial !== 1 ? memorialHint(s, u) : ''].filter(Boolean).join(' · ');
}

/** Marke: verschanzt (ENTRENCH, Korvat) / tag: entrenched (ENTRENCH, Korvat) */
function entrenchTag(s: GameState, u: Unit): string {
  const m = entrenchMiss(s, u);
  if (m <= 0) return '';
  const tip = t('entrench.tagDesc', { pct: Math.round(m * 100) });
  return `<span class="stat tag" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('shield', 'icon-sm')}${esc(t('entrench.tag'))}</span>`;
}

/** Marke: Maertyrer-Segen aktiv / tag: Martyr's Blessing active */
function blessingTag(s: GameState, u: Unit): string {
  const b = blessingOf(s, u);
  if (b <= 0) return '';
  const tip = t('blessing.tagDesc', { pct: Math.round(b * 100), n: blessingRoundsLeft(s, u) });
  return `<span class="stat tag bless" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('bless', 'icon-sm')}${esc(t('blessing.tag', { pct: Math.round(b * 100) }))}</span>`;
}

/**
 * Marke im Einheitenfeld: steht auf einem Mahnmal des Kults (Bonus fuer den Kult, Furcht fuer Menschen).
 * Tag in the unit panel: stands on a cult memorial (bonus for the cult, fear for humans).
 */
function memorialTag(s: GameState, u: Unit): string {
  const e = memorialEffect(s, u);
  if (!e) return '';
  const m = memorialAt(s, u.x, u.y)!;
  const tip = t(`memorial.${e}Desc`, { pct: Math.round((e === 'zeal' ? CULT.memorialAttack : CULT.memorialFear) * 100), n: m.until - s.round + 1 });
  return `<span class="stat tag ${e === 'fear' ? 'warn' : ''}" title="${esc(tip)}" aria-label="${esc(tip)}">${icon(e === 'fear' ? 'warning' : 'emblemDoom', 'icon-sm')}${esc(memorialHint(s, u, 'Tag'))}</span>`;
}

/**
 * Marke im Einheitenfeld: feuert nur aus dem Stand; nach einer Bewegung in diesem Zug als Warnung.
 * Tag in the unit panel: fires only from a standstill; as a warning after moving this turn.
 */
function stationaryTag(s: GameState, u: Unit): string {
  if (!stationaryOnly(u.type)) return '';
  const moved = u.owner === s.current && movedThisTurn(u) && !u.attacked;
  const tip = t('stationary.tagDesc');
  return `<span class="stat tag ${moved ? 'warn' : ''}" title="${esc(tip)}" aria-label="${esc(tip)}">${icon(moved ? 'warning' : 'range', 'icon-sm')}${esc(t(moved ? 'stationary.moved' : 'stationary.tag'))}</span>`;
}

/**
 * Marke im Einheitenfeld: Verteidigungsbonus auf eigenem Gebiet aktiv / tag in the unit panel: defence bonus on own territory active
 */
function homeDefenseTag(s: GameState, u: Unit): string {
  const b = homeDefenseAt(s, u);
  if (b <= 0) return '';
  const tip = t('homeDefense.tagDesc', { pct: Math.round(b * 100) });
  return `<span class="stat tag" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('shield', 'icon-sm')}${esc(homeDefenseHint(s, u, 'tag'))}</span>`;
}

/**
 * Hinweis im Einheitenfeld: in diesem Zug gezogen, ein Angriff jetzt zaehlt als Feuern nach Bewegung (MOVE_FIRE).
 * Note in the unit panel: moved this turn, an attack now counts as firing after moving (MOVE_FIRE).
 */
function moveFireTag(s: GameState, u: Unit): string {
  if (u.owner !== s.current || !movedThisTurn(u) || !canAttackNow(u) || movesFireFree(u)) return '';
  const tip = t('moveFire.tagDesc', { pct: Math.round(moveFireMult(s, u) * 100) });
  return `<span class="stat tag warn" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('warning', 'icon-sm')}${esc(moveFireHint(s, u, 'tag'))}</span>`;
}

/** Kampfmarken im Einheitenfeld (immer sichtbar, auch auf dem Handy) / combat tags in the unit panel (always visible, also on phones) */
function combatTags(s: GameState, u: Unit): string {
  const tags = moveFireTag(s, u) + stationaryTag(s, u) + entrenchTag(s, u) + homeDefenseTag(s, u) + blessingTag(s, u) + memorialTag(s, u) + sinTag(s, u.owner);
  return tags ? `<div class="row">${tags}</div>` : '';
}

/** Kurzwerte eines Einheitentyps fuer die Hinweiszeile / short stats of a unit type for the hint line */
function unitStatsLine(type: UnitTypeId, faction?: FactionId): string {
  const st = UNITS[type];
  const abil = st.abilities.filter((a) => a !== 'carry').map((a) => t(`abilities.${a}`));
  // Reichweite mit Fraktionsbonus (Korvat-Artillerie) / range with the faction bonus (Korvat artillery)
  const range = unitRange(type, faction);
  // Berserker: feste Schlagkraft statt Angriff / berserker: fixed striking power instead of attack
  const sv = strikeVars(type);
  return [sv ? t('berserker.strikeStat', sv) : `${t('stats.attack')} ${num(st.attack)}`, `${t('stats.defense')} ${num(st.defense)}`, `${t('stats.move')} ${num(st.move)}`, `${t('stats.range')} ${range ? num(range) : t('stats.noRange')}`, ...abil].join(' · ');
}

/**
 * Einheitenlimit einer gewoehnlichen Stadt mit Herkunft (Stufe + 1, Ausbauten) als Tooltip und Zusatz.
 * Unit limit of an ordinary city with its sources (level + 1, upgrades) as a tooltip and suffix.
 */
function unitLimitStat(s: GameState, c: City): string {
  const up = upgradeUnitLimit(s, c);
  // freie Plaetze der Versorger (Wohnbloecke, Supermarkt) tragen weitere Einheiten dieser Stadt / free slots of the suppliers (residential blocks, supermarket) support further units of this city
  const supply = c.owner !== null && !noTraining(c) ? supplySlots(s, c.owner) : 0;
  const tip = `${t('hud.unitLimitRule', { lv: c.level + CITY.unitLimitExtra, up, per: CITY.unitLimitPerUpgrade })}${baseUnits(c) ? ` ${t('bases.unitTip', { n: baseUnits(c) })}` : ''}${supply ? ` ${t('bases.supplyTip', { n: supply })}` : ''}`;
  return `<span class="stat" title="${esc(tip)}">${icon('helmet', 'icon-sm')}${esc(t('hud.units', { n: supportedUnits(s, c), max: unitLimit(s, c) }))}${up ? ` <span class="muted">${esc(t('hud.unitLimitUpgrades', { n: up }))}</span>` : ''}${supply ? ` <span class="muted">${esc(t('bases.supplyFree', { n: supply }))}</span>` : ''}</span>`;
}

/** Treffsicherheit einer Einheit als Kurztext und Tooltip / accuracy of a unit as short text and tooltip */
function accuracyStat(s: GameState, u: Unit): string {
  if (!hitChanceOn(s)) return '';
  const o = hitOdds(s, u);
  const tip = HIT_KINDS.map((k) => `${t(`hit.${k}`)} ${Math.round(o[k] * 100)} %`).join(' · ');
  // eigene Trefferchancen (Tesla-Panzer, Railgun-Schuetze) statt der Rasse / own hit odds (Tesla tank, railgun marksman) instead of the race
  const own = unitHitProfile(u.type);
  if (own) {
    const desc = t(`hit.unitDesc.${u.type}`, { miss: Math.round(own.miss * 100), crit: Math.round(own.crit * 100), atk: num(UNITS[u.type].attack), base: num(UNITS.tank.attack) });
    return `<span class="stat tag" title="${esc(`${desc} ${tip}`)}">${icon('dice', 'icon-sm')}${esc(hitProfileHint(s, u))}</span>`;
  }
  const race = unitRace(s, u);
  const crit = factionCrit(s, u) > 0 ? ` · ${t(`hit.factionCrit.${s.factions[u.owner].id}`)}` : '';
  const note = race === 'cult' && cultFrenzy(u, race) ? ` · ${t('hit.frenzy')}` : race === 'robot' && u.hp < u.maxHp ? ` · ${t('hit.worn')}` : '';
  const ready = canOrderlyRetreat(u) && (u.retreatReady ?? 0) > s.round ? ` · ${t('retreat.cooldown', { n: (u.retreatReady ?? 0) - s.round })}` : '';
  return `<span class="stat ${note ? 'tag warn' : ''}" title="${esc(tip)}">${icon('dice', 'icon-sm')}${esc(t(`hit.race.${race}`) + crit + note + ready)}</span>`;
}

export interface HudCallbacks {
  openResearch(): void;
  openDiplomacy(): void;
  openMenu(): void;
  openGrand(): void;
  openDetails(): void;
}

export class Hud {
  private top: HTMLElement;
  private controls: HTMLElement;
  private banner: HTMLElement;
  private bottom: HTMLElement;
  private actions: ActionItem[] = [];
  /** Truppenkarten der gewaehlten Stadt (eigene Leiste statt Aktionsleiste) / troop cards of the selected city (own strip instead of the action bar) */
  private cards: TroopCard[] = [];
  /** Ueberschrift der Kartenleiste (Stadt oder Stuetzpunkt) und ob nur Schiffe / heading of the card strip (city or base) and whether ships only */
  private troopsTitle = '';
  /** Kampfhinweis zur angebotenen Angriffsaktion (Hinweiszeile) / combat note on the offered attack action (hint line) */
  private combatNote = '';
  /** Infofeld auf dem Handy aufgeklappt? / info panel expanded on phones? */
  private expanded = false;
  /** Hinweis auf gesperrte Stadt-Ausbauten / note about locked city upgrades */
  private cityNote = '';
  /** 3D-Portraet der gewaehlten Einheit / 3D portrait of the selected unit */
  private portrait = new Portrait();
  private portraitFor: { type: UnitTypeId; faction: FactionId; carried: UnitTypeId | null } | null = null;
  /** offenes Rekrutier-Menue fuer diese Einheit / open recruit menu for this unit */
  private recruitFor: number | null = null;
  /** Hinweiszeile: zuletzt angetippte Aktion, Auswahl-Schluessel, aufgeklappt / hint line: last tapped action, selection key, expanded */
  private hintId: string | null = null;
  private hintKey = '';
  private hintOpen = false;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressClick = false;

  constructor(root: HTMLElement, private game: Controller, private cb: HudCallbacks) {
    this.top = document.createElement('header');
    this.top.className = 'top-bar';
    this.controls = document.createElement('div');
    this.controls.className = 'map-controls';
    this.banner = document.createElement('div');
    this.banner.className = 'turn-banner';
    this.banner.setAttribute('aria-live', 'polite');
    this.bottom = document.createElement('div');
    this.bottom.className = 'bottom';
    root.append(this.top, this.controls, this.banner, this.bottom);
    root.addEventListener('click', (e) => this.onClick(e));
    // Hinweiszeile: Fokus, Mauszeiger und langes Druecken zeigen die Erklaerung / hint line: focus, hover and long-press show the explanation
    const actOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('.action[data-act], .troop-card[data-act]');
    this.bottom.addEventListener('focusin', (e) => { const a = actOf(e); if (a) this.setHint(a.dataset.act!); });
    this.bottom.addEventListener('pointerover', (e) => { const a = actOf(e); if (a && e.pointerType === 'mouse') this.setHint(a.dataset.act!); });
    this.bottom.addEventListener('pointerdown', (e) => {
      const a = actOf(e);
      if (!a) return;
      this.clearPress();
      this.pressTimer = setTimeout(() => { this.pressTimer = null; this.suppressClick = true; this.setHint(a.dataset.act!, true); }, HINT_PRESS_MS);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.bottom.addEventListener(ev, () => this.clearPress());
    this.bottom.addEventListener('contextmenu', (e) => { if (actOf(e)) e.preventDefault(); });
    // Kartenleiste: Pfeiltasten wandern zwischen den Karten / card strip: arrow keys move between the cards
    this.bottom.addEventListener('keydown', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.troop-card');
      if (!card || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')) return;
      const all = [...this.bottom.querySelectorAll<HTMLElement>('.troop-card')];
      const i = all.indexOf(card);
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : i + (e.key === 'ArrowRight' ? 1 : -1);
      if (j < 0 || j >= all.length) return;
      e.preventDefault();
      all[j].focus();
      all[j].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: this.game.view.board.animations ? 'smooth' : 'auto' });
    });
  }

  /** Aktion oder Truppenkarte nach Kennung / action or troop card by id */
  private findAct(id: string | null | undefined): ActionItem | undefined {
    if (!id) return undefined;
    return this.actions.find((x) => x.id === id) ?? this.cards.find((x) => x.id === id);
  }

  private clearPress() {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  /** Text der Hinweiszeile / text of the hint line */
  private hintHtml(): string {
    const a = this.findAct(this.hintId);
    // nach Bewegung: halber Schaden gleich sichtbar / after moving: half damage visible right away
    if (!a && this.combatNote) return `${icon('warning', 'icon-sm')}<span class="hint-text"><strong>${esc(this.combatNote)}</strong></span>`;
    if (!a) return `${icon('info', 'icon-sm')}<span class="hint-text muted">${esc(t('hud.hintPrompt'))}</span>`;
    const text = (a.enabled ? a.desc ?? a.reason : a.reason) ?? (a.sub && a.sub !== a.label ? a.sub : '');
    const name = a.sub && a.sub !== a.label && a.id !== 'attack' && a.id !== 'rocket' ? `${a.label} (${a.sub})` : a.label;
    return `${icon(a.enabled ? 'info' : 'lock', 'icon-sm')}<span class="hint-text"><strong>${esc(name)}</strong>${text ? `: ${esc(text)}` : ''}</span>`;
  }

  /** Hinweiszeile ohne neues Rendern aktualisieren / update the hint line without a full re-render */
  private setHint(id: string, flash = false) {
    this.hintId = id;
    const n = this.bottom.querySelector<HTMLElement>('.action-hint');
    if (!n) return;
    const a = this.findAct(id);
    n.innerHTML = this.hintHtml();
    n.classList.toggle('blocked', !!a && !a.enabled);
    if (flash) { n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); }
  }

  /** Aktuelle Aktionen (auch fuer XR-Panels) / current actions (also for XR panels) */
  currentActions(): ActionItem[] {
    // XR zeigt keine Zweitzeile: Vorschau wieder in den Namen / XR shows no second line: put the preview back into the label
    // XR: Truppenkarten wie Aktionen hinten anhaengen / XR: append the troop cards like actions
    return [...this.actions, ...this.cards].map((a) => (a.id === 'attack' || a.id === 'rocket') && a.sub ? { ...a, label: `${a.label}: ${a.sub}` } : a);
  }

  show(on: boolean) {
    for (const n of [this.top, this.controls, this.banner, this.bottom]) n.hidden = !on;
  }

  private onClick(e: Event) {
    const target = e.target as HTMLElement;
    const act = target.closest<HTMLElement>('[data-act]');
    if (act && this.bottom.contains(act)) {
      // nach langem Druecken nur erklaeren, nicht ausfuehren / after a long-press only explain, do not run
      if (this.suppressClick) { this.suppressClick = false; return; }
      const a = this.findAct(act.dataset.act);
      if (a) {
        // gesperrt: Grund in der Hinweiszeile statt nur im Tooltip / disabled: reason in the hint line instead of only a tooltip
        if (!a.enabled) { this.game.play('error'); this.setHint(a.id, true); }
        else { this.game.play('click'); this.hintId = a.id; a.run(); }
      }
      return;
    }
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn || !(this.top.contains(btn) || this.controls.contains(btn) || this.bottom.contains(btn) || this.banner.contains(btn))) return;
    const v = this.game.view;
    switch (btn.dataset.action) {
      case 'rotL': v.rotate(-1); break;
      case 'rotR': v.rotate(1); break;
      case 'zoomIn': v.setZoom(v.zoom * 1.25); break;
      case 'zoomOut': v.setZoom(v.zoom / 1.25); break;
      case 'endTurn': void this.game.endTurn(); break;
      case 'research': {
        const st = this.game.state;
        const rf = st ? (this.game.viewer >= 0 ? this.game.viewer : st.current) : -1;
        // Zyrr und NEXUS: nur die Siegtechnologie / Zyrr and NEXUS: only the victory tech
        if (st && !canResearch(st, rf) && !factionVictoryOn(st)) { this.game.ui.toast(t(isAlienFaction(st, rf) ? 'xeno.noResearch' : 'nexus.noResearch'), 'research'); break; }
        this.cb.openResearch(); break;
      }
      case 'diplomacy': this.cb.openDiplomacy(); break;
      case 'menu': this.cb.openMenu(); break;
      case 'faction': {
        const st = this.game.state;
        if (st) factionDialog(this.top.parentElement ?? document.body, st.factions[this.game.viewer >= 0 ? this.game.viewer : st.current].id);
        break;
      }
      case 'grand': this.cb.openGrand(); break;
      // Orbitallaser (Velkar) / orbital laser (Velkar)
      case 'orbital': if (this.game.orbitalMode) this.game.cancelOrbital(); else this.game.startOrbital(); break;
      case 'orbitalCancel': this.game.cancelOrbital(); break;
      // Raketensilo (Meridon) / rocket silo (Meridon)
      case 'siloCancel': this.game.cancelSilo(); break;
      case 'details': this.cb.openDetails(); break;
      case 'sheet-more': this.expanded = !this.expanded; this.render(); break;
      case 'hint': this.hintOpen = !this.hintOpen; btn.classList.toggle('open', this.hintOpen); btn.setAttribute('aria-expanded', String(this.hintOpen)); break;
      case 'troopsPrev': case 'troopsNext': {
        const strip = this.bottom.querySelector<HTMLElement>('.troop-strip');
        const dir = btn.dataset.action === 'troopsNext' ? 1 : -1;
        strip?.scrollBy({ left: dir * strip.clientWidth * 0.8, behavior: this.game.view.board.animations ? 'smooth' : 'auto' });
        break;
      }
      case 'actionsMore': {
        const bar = this.bottom.querySelector<HTMLElement>('.action-bar');
        bar?.scrollBy({ left: bar.clientWidth * 0.7, behavior: this.game.view.board.animations ? 'smooth' : 'auto' });
        break;
      }
      case 'speedUp': this.game.speedUp = true; this.game.view.board.finishAnimations(); break;
      case 'nextUnit': this.nextUnit(); break;
      case 'deselect': this.game.clearSelection(); this.render(); break;
      default:
        if (btn.dataset.action?.startsWith('tab-')) this.game.setTab(btn.dataset.action.slice(4) as 'unit' | 'city' | 'tile');
    }
  }

  private nextUnit() {
    const s = this.game.state;
    if (!s) return;
    const mine = s.units.filter((u) => u.owner === s.current && !u.exhausted && !u.fresh);
    if (!mine.length) return;
    const cur = this.game.selectedUnit;
    const i = mine.findIndex((u) => u.id === cur);
    const u = mine[(i + 1) % mine.length];
    this.game.view.centerOn(this.game.view.board.tileCenter(s, u.x, u.y));
    void this.game.tapTile(u.x, u.y);
  }

  /** Betrachtende Fraktion (Hotseat: die am Zug) / viewing faction (hotseat: the one to move) */
  private viewerId(s: GameState): FactionId {
    return s.factions[this.game.viewer >= 0 ? this.game.viewer : s.current].id;
  }

  /** Fehlertext in der Wortwahl der betrachtenden Fraktion / error text in the viewing faction's wording */
  private err(code: string): string {
    const s = this.game.state;
    return techT(`errors.${code}`, s ? this.viewerId(s) : null);
  }

  render() {
    const g = this.game, s = g.state;
    if (!s) return;
    const viewerIdx = g.viewer >= 0 ? g.viewer : s.current;
    const f = s.factions[viewerIdx];
    const inc = income(s, viewerIdx);
    const up = upkeep(s, viewerIdx);
    // Kampagne: Rundenzahl des Einsatzes / campaign: the mission's round count
    const limit = s.config.roundLimit ?? (s.campaign ? missionById(s.campaign.mission)?.rounds ?? null : null);
    // Netto-Einkommen: auf dem Handy kompakt neben den Sternen / net income: compact next to the stars on phones
    const net = inc - up;
    const netTxt = `${net >= 0 ? '+' : ''}${net}`;
    // Korruption (Meridon, Zufallsereignis): Erklaerung im Tooltip der Sterne, nur mit Zufallsereignissen
    // corruption (Meridon, random event): explanation in the stars tooltip, only with random events
    const graftNote = s.config.events && corruptionRule(s, viewerIdx) ? t('hud.corruptionRisk') : '';
    this.top.innerHTML = `
      <button type="button" class="faction-btn" data-action="faction" aria-label="${esc(t('leaders.title'))}: ${esc(t(`factions.${f.id}.name`))}">${leaderPortrait(f.id, 'xs')}${factionChip(f.id, t(`factions.${f.id}.short`))}</button>
      ${resource('medal', score(s, viewerIdx), t('hud.points'), t('hud.points'))}
      ${resource('star', f.stars, up > 0 ? t('hud.perRoundUpkeep', { n: inc, up, net: netTxt }) : t('hud.perRound', { n: inc }), t('hud.stars'),
        `<span class="net ${net < 0 ? 'neg' : ''}" aria-hidden="true">${esc(netTxt)}</span>`, graftNote)}
      ${isCultFaction(s, viewerIdx) ? resource('people', `${cultUnits(s, viewerIdx).length}/${cultCap(s, viewerIdx)}`, '', t('cult.hordeTitle')) : ''}
      ${resource('hourglass', limit ? `${Math.min(s.round, limit)}/${limit}` : s.round, '', t('hud.round'))}
      ${this.weatherChip(s)}
      <span class="grow"></span>
      ${iconButton('menu', t('hud.menu'), 'menu')}`;
    this.controls.innerHTML = `
      ${iconButton('rotateLeft', t('hud.rotateLeft'), 'rotL')}
      ${iconButton('rotateRight', t('hud.rotateRight'), 'rotR')}
      ${iconButton('zoomIn', t('hud.zoomIn'), 'zoomIn')}
      ${iconButton('zoomOut', t('hud.zoomOut'), 'zoomOut')}
      ${supplyLines(s) || isCultFaction(s, viewerIdx) ? '' : iconButton('grand', t('hud.grandProjects'), 'grand')}
      ${orbitalButton(s, g)}`;
    const cur = s.factions[s.current];
    if (g.aiRunning && !s.over) {
      this.banner.hidden = false;
      this.banner.innerHTML = `${icon('hourglass')}<span>${esc(t('hud.aiThinking', { name: t(`factions.${cur.id}.short`) }))}</span>${iconButton('lightning', t('hud.speedUp'), 'speedUp')}`;
    } else this.banner.hidden = true;

    this.actions = [];
    this.cards = [];
    this.troopsTitle = '';
    this.combatNote = '';
    this.portraitFor = null;
    const prevKey = this.hintKey;
    const prevScroll = this.bottom.querySelector<HTMLElement>('.action-bar')?.scrollLeft ?? 0;
    const prevStrip = this.bottom.querySelector<HTMLElement>('.troop-strip')?.scrollLeft ?? null;
    let sheet = '';
    if (g.orbitalMode && g.isHumanTurn) { const o = orbitalSheet(s, g, (c) => this.err(c)); sheet = o.html; this.actions = o.actions; }
    else if (g.siloFrom && g.isHumanTurn) { const o = siloSheet(s, g, (c) => this.err(c)); sheet = o.html; this.actions = o.actions; }
    // Hackturm: Zielauswahl "Einheit uebernehmen" (NEXUS) / hack tower: "take over unit" targeting (NEXUS)
    else if (g.hackFrom && g.isHumanTurn) { const o = hijackSheet(s, g, (c) => this.err(c)); sheet = o.html; this.actions = o.actions; }
    // Neutronenstrahl der Akademie: Zielauswahl (Velkar) / academy neutron beam: targeting (Velkar)
    else if (g.beamCity !== null && g.isHumanTurn) { const o = beamSheet(s, g, (c) => this.err(c)); sheet = o.html; this.actions = o.actions; }
    else if (g.selected && !g.aiRunning) sheet = this.sheet(s, g.selected.x, g.selected.y);
    const humanTurn = g.isHumanTurn;
    this.bottom.innerHTML = `
      ${sheet ? `<section class="panel sheet ${this.expanded ? 'expanded' : ''}" aria-label="${esc(t('actions.tileActions'))}">${sheet}</section>` : ''}
      <nav class="nav-bar">
        <button type="button" class="btn secondary" data-action="research">${icon(techIcon(f.id))}<span>${esc(techT('hud.research', f.id))}</span></button>
        <button type="button" class="btn secondary" data-action="diplomacy">${icon('diplomacy')}<span>${esc(t('hud.diplomacy'))}</span></button>
        ${iconButton('next', t('hud.nextUnit'), 'nextUnit', { lg: true })}
        <button type="button" class="btn end" data-action="endTurn" ${humanTurn ? '' : 'disabled'}>${icon('endTurn')}<span>${esc(t('hud.endTurn'))}</span></button>
      </nav>`;
    this.mountActionBar(prevKey === this.hintKey ? prevScroll : 0);
    this.mountTroops(prevKey === this.hintKey ? prevStrip : null);
    this.fitControls();
    const pf = this.portraitFor as { type: UnitTypeId; faction: FactionId; carried: UnitTypeId | null } | null;
    this.portrait.animate = this.game.view.board.animations;
    if (pf) this.portrait.attach(this.bottom.querySelector<HTMLElement>('[data-portrait]'), pf.type, pf.faction, pf.carried);
    else this.portrait.stop();
  }

  /** Aktionsleiste: Scroll-Position halten, Scroll-Hinweis bei Ueberlauf / action bar: keep the scroll position, scroll cue on overflow */
  private mountActionBar(scroll: number) {
    const bar = this.bottom.querySelector<HTMLElement>('.action-bar');
    const wrap = bar?.parentElement;
    if (!bar || !wrap) return;
    bar.scrollLeft = scroll;
    const cue = () => {
      const more = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2;
      wrap.classList.toggle('more-right', more);
      wrap.classList.toggle('more-left', bar.scrollLeft > 2);
      const btn = wrap.querySelector<HTMLElement>('.action-more');
      if (btn) btn.hidden = !more;
    };
    bar.addEventListener('scroll', cue, { passive: true });
    cue();
  }

  /**
   * Kartenleiste: Scroll-Position halten (gleiche Auswahl), Pfeile nur bei Ueberlauf; am Stuetzpunkt zu den Schiffen.
   * Card strip: keep the scroll position (same selection), arrows only on overflow; at a naval base jump to the ships.
   */
  private mountTroops(scroll: number | null) {
    const strip = this.bottom.querySelector<HTMLElement>('.troop-strip');
    const sec = strip?.closest<HTMLElement>('.troops');
    if (!strip || !sec) return;
    if (scroll !== null) strip.scrollLeft = scroll;
    const cue = () => {
      const more = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2;
      const less = strip.scrollLeft > 2;
      sec.classList.toggle('more-right', more);
      sec.classList.toggle('more-left', less);
      const prev = sec.querySelector<HTMLButtonElement>('.troops-nav.prev'), next = sec.querySelector<HTMLButtonElement>('.troops-nav:not(.prev)');
      if (prev) prev.disabled = !less;
      if (next) next.disabled = !more;
      sec.classList.toggle('fits', !more && !less);
    };
    strip.addEventListener('scroll', cue, { passive: true });
    cue();
  }

  /**
   * Kartensteuerung: Knoepfe, die ins Infofeld ragen wuerden, ausblenden (Handy hochkant mit hohem Stadtfeld); sonst
   * laegen sie ueber dessen Kopf und Schliessen-Knopf. Zoomen geht dann per Fingergeste.
   * Map controls: hide the buttons that would reach into the info panel (phone in portrait with a tall city panel);
   * otherwise they sat on top of its header and close button. Zooming then works with the pinch gesture.
   */
  private fitControls() {
    const sheet = this.bottom.querySelector<HTMLElement>(':scope > .sheet');
    if (!sheet) return;
    const sr = sheet.getBoundingClientRect(), cr = this.controls.getBoundingClientRect();
    // angedockt (Desktop, Handy quer): keine Ueberschneidung / docked (desktop, phone in landscape): no overlap
    if (!sr.height || cr.left >= sr.right || cr.right <= sr.left) return;
    const gap = parseFloat(getComputedStyle(this.controls).rowGap) || 0;
    for (const b of this.controls.children) if (b instanceof HTMLElement && b.getBoundingClientRect().bottom > sr.top - gap) b.hidden = true;
  }

  /** Truppenkarten der Stadt c setzen (ships: nur Schiffe) / set the troop cards of city c (ships: ships only) */
  private setTroops(s: GameState, c: City, ships = false) {
    const g = this.game;
    this.cards = troopCards(s, c, (type) => void g.exec({ type: 'train', city: c.id, unitType: type }), ships);
    this.troopsTitle = ships ? t('troops.ships', { city: cityName(s, c.id) }) : t('troops.title');
  }

  private weatherChip(s: GameState): string {
    // ohne Wetter weder Chip noch Vorhersage; in der Hoehle nur 'ruhig' oder 'Erdbeben' / without weather neither chip nor forecast; in the cavern only 'calm' or 'earthquake'
    if (!hasWeather(s)) return '';
    const cave = s.config.theme === 'cavern';
    const key = (x: string) => (cave && x === 'clear' ? 'calm' : x);
    const w = key(weather(s));
    const nextRound = nextWeatherRound(s);
    const next = key(weatherAt(s, nextRound));
    const title = `${t(`weather.${w}`)}: ${t(`weather.${w}Desc`)} | ${t('weather.forecast', { round: nextRound, weather: t(`weather.${next}`) })}`;
    return `<span class="res weather" title="${esc(title)}" aria-label="${esc(title)}">${icon(WEATHER_ICON[w])}<span class="sub">${esc(t(`weather.${w}`))}</span></span>`;
  }

  private sheet(s: GameState, x: number, y: number): string {
    const g = this.game;
    const viewer = g.viewer;
    const explored = viewer < 0 || isExplored(s, viewer, x, y);
    const tile = s.tiles[y * s.size + x];
    const unit = unitAt(s, x, y);
    const vUnit = unit && (viewer < 0 || canSeeUnit(s, viewer, unit)) ? unit : undefined;
    const city = cityAt(s, x, y);
    const tab = g.tab;
    // neue Auswahl: Hinweiszeile zuruecksetzen / new selection: reset the hint line
    const key = `${x},${y},${tab},${unit?.id ?? ''}`;
    if (key !== this.hintKey) { this.hintKey = key; this.hintId = null; this.hintOpen = false; }
    let head = '', body = '';
    const myTurn = g.isHumanTurn;
    if (!explored) {
      head = `<h3 class="display">${esc(t('hud.unexplored'))}</h3>`;
    } else if (tab === 'unit' && vUnit) {
      // uebernommene Einheit: Bauart und Farben des eigentlichen Besitzers (HACK.tower) / taken-over unit: design and colours of the actual owner
      const fid = s.factions[trueOwner(vUnit)].id;
      const st = UNITS[vUnit.type];
      // 3D-Portraet statt Symbol / 3D portrait instead of an icon
      this.portraitFor = { type: vUnit.type, faction: fid, carried: vUnit.carried };
      head = `<span class="unit-badge unit-portrait" data-portrait style="--portrait-rim:var(--faction-${fid}-primary)">${icon(UNIT_ICON[vUnit.type] ?? 'helmet')}</span><div class="grow"><h3 class="display" title="${esc(unitName(vUnit))}">${esc(unitDisplayName(s, vUnit))}</h3>
        <div class="muted unit-sub">${roleChip(vUnit.type)}<span class="unit-type">${esc(unitName(vUnit))}</span> · ${esc(t(`factions.${fid}.short`))}${vUnit.veteran ? ` · ${esc(t('stats.veteran'))}` : ''}</div></div>`;
      body += `<div class="row">${icon('hp', 'icon-sm')}<span>${vUnit.hp} / ${vUnit.maxHp}</span><div class="grow">${progress(vUnit.hp, vUnit.maxHp, `hp ${vUnit.hp / vUnit.maxHp < 0.35 ? 'low' : ''}`, t('stats.hp'))}</div></div>${hijackTag(s, vUnit)}${combatTags(s, vUnit)}${shadowTags(s, vUnit, viewer)}${plansUnitTag(s, vUnit)}
        <div class="sheet-more"><div class="stats">
          ${st.strike ? berserkerStats(s, vUnit) : `<span class="stat">${icon('sword', 'icon-sm')}${esc(t('stats.attack'))} ${num(st.attack)}</span>`}
          <span class="stat">${icon('shield', 'icon-sm')}${esc(t('stats.defense'))} ${num(st.defense)}</span>
          <span class="stat">${icon('boot', 'icon-sm')}${esc(t('stats.move'))} ${num(st.move)}</span>
          ${(() => { const r = unitRange(vUnit.type, fid); return `<span class="stat">${icon('range', 'icon-sm')}${esc(t('stats.range'))} ${r ? num(r) : esc(t('stats.noRange'))}</span>`; })()}
          ${vUnit.fuel !== null ? `<span class="stat ${vUnit.fuel <= 1 ? 'tag warn' : ''}">${icon('fuel', 'icon-sm')}${esc(t('hud.fuelLeft', { n: vUnit.fuel }))} / ${MAX_FUEL}</span>` : ''}
          ${vUnit.slowed || vUnit.slowedNext ? `<span class="stat tag warn">${icon('warning', 'icon-sm')}${esc(t('hud.slowed'))}</span>` : ''}
          ${(() => {
            const paid = paidUnits(s, vUnit.owner).some((p) => p.id === vUnit.id);
            // Fraktionsfaktor (Korvat): Anteil der Einheit ist ungefaehr, gerundet wird erst die Summe; die Summe steht im Tooltip
            // faction factor (Korvat): the unit's share is approximate, only the total is rounded; the total is in the tooltip
            const k = upkeepFactor(s, vUnit.owner);
            const rule = t('hud.upkeepRule', { free: UPKEEP.freeUnits, pct: Math.round(UPKEEP.share * 100), tank: UPKEEP.flat.tank ?? 0 });
            const tip = k !== 1 ? `${rule} ${t('hud.upkeepTotal', { pct: Math.round((1 - k) * 100), n: upkeep(s, vUnit.owner) })}` : rule;
            const share = num(Math.round(unitUpkeep(vUnit) * k * 10) / 10);
            const label = paid ? t(k !== 1 ? 'hud.upkeepUnitApprox' : 'hud.upkeepUnit', { n: share }) : isCultFaction(s, vUnit.owner) ? t('cult.noUpkeep') : t('hud.upkeepFree');
            return `<span class="stat ${paid ? '' : 'muted'}" title="${esc(tip)}">${icon('star', 'icon-sm')}${esc(label)}</span>`;
          })()}
          ${vUnit.kills ? `<span class="stat">${icon('medal', 'icon-sm')}${esc(t('stats.kills'))} ${vUnit.kills}</span>` : ''}
          ${accuracyStat(s, vUnit)}
          ${ROCKETS.units.includes(vUnit.type) ? `<span class="stat ${rocketsLeft(vUnit) === 0 ? 'tag warn' : ''}" title="${esc(t('rockets.desc'))}">${icon('lightning', 'icon-sm')}${esc(t('rockets.left', { n: rocketsLeft(vUnit), max: ROCKETS.max }))}</span>` : ''}
        </div>
        <div class="row">${st.abilities.filter((a) => a !== 'carry').map((a) => `<span class="tag" title="${esc(t(`abilities.${a}Desc`))}">${esc(t(`abilities.${a}`))}</span>`).join('')}${counterTags(vUnit.type).map((c) => `<span class="tag ${c.good ? '' : 'warn'}" title="${esc(t('counter.hint'))}">${esc(c.text)}</span>`).join('')}${st.returnRange !== undefined ? `<span class="tag" title="${esc(t('stats.returnRangeDesc', { n: st.returnRange }))}">${esc(t('stats.returnRange', { n: st.returnRange }))}</span>` : ''}</div>${hasText(`unitDesc.${vUnit.type}`) ? `<p class="muted unit-desc">${esc(t(`unitDesc.${vUnit.type}`))}</p>` : ''}</div>`;
      // Wunder: Phase, Restrunden, Unterbrechungsregel (immer sichtbar) / wonder: phase, rounds left, interruption rule (always visible)
      if (isWonder(vUnit)) body += wonderPanel(s, vUnit);
      if (myTurn && vUnit.owner === s.current) this.unitActions(s, vUnit);
    } else if ((tab === 'city' || (tab === 'unit' && !vUnit)) && city) {
      const name = cityName(s, city.id);
      if (city.owner === null) {
        // Stuetzpunkt: Art im Kopf, Wirkung fuer die Fraktion des Betrachters immer sichtbar (vor dem Einnehmen)
        // base: kind in the head, the effect for the viewer's faction always visible (before capturing)
        const vf = viewer >= 0 ? s.factions[viewer].id : null;
        head = `<span class="unit-badge">${icon(city.base ? BASE_ICON[city.base] : 'capture')}</span><div class="grow"><h3 class="display">${esc(name)}</h3><div class="muted">${esc(city.base ? t('bases.neutral', { kind: baseName(city.base) }) : t(city.tower ? 'tower.neutral' : supplyLines(s) ? 'cavern.neutralLine' : isDesert(s) ? 'desert.neutralOutpost' : isAlienWorld(s) ? 'burrow.neutral' : 'features.village'))}</div></div>`;
        if (city.base) body += `${baseLineHtml(city.base, vf)}<p class="muted sheet-more">${esc(t('bases.likeCity'))}</p>`;
        if (city.tower) body += `<p class="muted sheet-more">${esc(t('tower.desc', { n: TOWER.income, max: TOWER.unitLimit }))}</p>`;
        body += lootTag(s, viewer, city);
        // NEXUS: neutralen Ort fernuebernehmen (HACK) / NEXUS: remote takeover of the neutral place (HACK)
        const hackAct = hackPlaceAction(s, city, g, (c) => this.err(c));
        if (hackAct) this.actions.push(hackAct);
      } else if (isCultFaction(s, city.owner)) {
        // Kult-Stadt: keine Wirtschaft, nur Plaetze fuer die Horde / cult city: no economy, only slots for the horde
        const fid = s.factions[city.owner].id;
        const shrine = cityTiles(s, city).some((p) => s.tiles[p.y * s.size + p.x].building === 'shrine');
        const own = city.isHQ && city.hqOf === city.owner;
        head = `${factionBadge(fid, 'city')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>
          <div class="muted unit-sub">${city.base ? `${esc(baseName(city.base))} · ` : ''}${esc(t('cult.city'))} · ${esc(t('hud.level', { n: city.level }))} · ${esc(t(`factions.${fid}.short`))}${own ? ` · ${esc(t('hud.hq'))}` : ''}</div></div>`;
        body += `<div class="row"><span class="stat">${icon('helmet', 'icon-sm')}${esc(t('cult.slots', { n: cultSlots(s, city) }))}</span>
          <span class="stat">${icon('people', 'icon-sm')}${esc(t('cult.horde', { n: cultUnits(s, city.owner).length, max: cultCap(s, city.owner) }))}</span>
          ${own ? `<span class="tag">${esc(t('hud.hq'))} +${CULT.hqSlots}</span>` : ''}${shrine ? `<span class="tag">${esc(t('buildings.shrine'))} +${CULT.shrineSlots}</span>` : ''}</div>
          <p class="muted sheet-more">${esc(t('cult.cityDesc', { n: city.level + CITY.unitLimitExtra, hq: CULT.hqSlots, shrine: CULT.shrineSlots }))}</p>`;
        // Stuetzpunkt in Kult-Hand: Wirkung fuer den Kult / base in cult hands: effect for the cult
        if (city.base) body += baseLineHtml(city.base, fid, 'muted');
        body += lootTag(s, viewer, city);
        this.cityNote = '';
        // Kult: Schiffe aus der Werft, Landtruppen gesperrt (Rekrutieren im Feld) / cult: ships from the shipyard, land troops locked (recruiting in the field)
        if (myTurn && city.owner === s.current) this.setTroops(s, city);
      } else if (city.academy || city.post) {
        // Schwebende Akademie und Forschungsposten (Velkar): eigener Kopf, Zustand, Schild, Aktionen / floating academy and research post (Velkar): own head, state, shield, actions
        const a = academySheet(s, city);
        head = a.head;
        body += a.body;
        this.cityNote = '';
        if (myTurn && city.owner === s.current) {
          this.actions.push(...(city.academy ? academyActions(s, g, city, (c) => this.err(c)) : postActions(s, g, city, (c) => this.err(c))));
          // Ausbildung, Ausbauten und Stufe nur an der Akademie / training, upgrades and level only at the academy
          if (city.academy) this.cityActions(s, city.id);
        }
        if (city.academy) body += citySitesHtml(s, city);
      } else if (city.tower) {
        // Sendeturm: bildet aus, waechst nicht, festes Einkommen / transmitter tower: trains, does not grow, fixed income
        const fid = s.factions[city.owner].id;
        head = `${factionBadge(fid, 'city')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>
          <div class="muted unit-sub">${esc(t('tower.name'))} · ${esc(t(`factions.${fid}.short`))}</div></div>`;
        body += `<div class="row"><span class="stat">${icon('helmet', 'icon-sm')}${esc(t('hud.units', { n: supportedUnits(s, city), max: unitLimit(s, city) }))}</span>
          <span class="stat">${icon('star', 'icon-sm')}${esc(t('hud.income'))} +${cityIncome(s, city)}</span>${city.noIncomeNext ? `<span class="tag warn">${esc(t('hud.noIncomeNext'))}</span>` : ''}</div>
          <p class="muted sheet-more">${esc(t('tower.desc', { n: TOWER.income, max: unitLimit(s, city) }))}</p>${citySitesHtml(s, city)}`;
        this.cityNote = '';
        if (myTurn && city.owner === s.current) this.cityActions(s, city.id);
      } else if (supplyLines(s)) {
        // Nachschublinie: kein Wachstum, keine Ausbauten, festes Einkommen / supply line: no growth, no upgrades, fixed income
        const fid = s.factions[city.owner].id;
        const shaft = city.isHQ && city.hqOf === city.owner;
        head = `${factionBadge(fid, 'city')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>
          <div class="muted unit-sub">${esc(t(shaft ? 'cavern.mainShaft' : 'cavern.supplyLine'))} · ${esc(t(`factions.${fid}.short`))}</div></div>`;
        body += `<div class="row"><span class="stat">${icon('helmet', 'icon-sm')}${esc(t('hud.units', { n: supportedUnits(s, city), max: unitLimit(s, city) }))}</span>
          <span class="stat">${icon('star', 'icon-sm')}${esc(t('hud.income'))} +${cityIncome(s, city)}</span>${city.noIncomeNext ? `<span class="tag warn">${esc(t('hud.noIncomeNext'))}</span>` : ''}</div>
          <p class="muted sheet-more">${esc(t(shaft ? 'cavern.mainShaftDesc' : 'cavern.supplyLineDesc', { n: shaft ? SUPPLY_LINE.mainShaftIncome : SUPPLY_LINE.income, max: unitLimit(s, city) }))}</p>${citySitesHtml(s, city)}`;
        this.cityNote = '';
        if (myTurn && city.owner === s.current) this.cityActions(s, city.id);
      } else {
        const fid = s.factions[city.owner].id;
        const need = levelUpCost(s, city);
        // Stufe in der Unterzeile, damit der Name nicht abgeschnitten wird / level in the subline so the name is not cut off
        head = `${factionBadge(fid, 'city')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>
          <div class="muted unit-sub">${city.base ? `${esc(baseName(city.base))} · ` : ''}${isDesert(s) ? `${esc(t('desert.outpost'))} · ` : isAlienWorld(s) ? `${esc(t(fid === 'zyrr' ? 'burrow.zyrr' : 'burrow.own'))} · ` : ''}${esc(t('hud.level', { n: city.level }))} · ${esc(t(`factions.${fid}.short`))}${city.isHQ && city.hqOf === city.owner ? ` · ${esc(t('hud.hq'))}` : ''}</div></div>`;
        // Stuetzpunkt: Wirkung fuer den Besitzer direkt unter der Bevoelkerung (Handy: unter "mehr", die Art steht im Kopf);
        // ohne Ausbildung stattdessen der Hinweis mit den Plaetzen, immer sichtbar, er ersetzt die Truppenleiste
        // base: effect for the owner right below the population (phone: under "more", the kind is in the head); without
        // training the note with the slots instead, always visible, it replaces the troop strip
        const baseLine = !city.base ? '' : noTraining(city) ? supplyNoteHtml(s, city) : baseLineHtml(city.base, fid, 'muted sheet-more');
        body += `<div class="row">${icon('people', 'icon-sm')}<span>${esc(t('hud.population', { pop: city.pop, need }))}</span><div class="grow">${progress(city.pop, need, '', t('hud.population', { pop: city.pop, need }))}</div></div>${baseLine}
          <div class="sheet-more"><div class="stats">${unitLimitStat(s, city)}
          <span class="stat">${icon('star', 'icon-sm')}${esc(t('hud.income'))} +${cityIncome(s, city)}</span>
          ${city.factory ? `<span class="tag">${esc(t('rewards.factory'))}</span>` : ''}${city.bunkerRing ? `<span class="tag">${esc(t('rewards.bunkerRing'))}</span>` : ''}
          ${city.govQuarter ? `<span class="tag">${esc(t('rewards.govQuarter'))}</span>` : ''}</div>
          <div class="slots" aria-label="${esc(t('cityUpgrades.title'))}"><span class="muted">${esc(t('cityUpgrades.title'))}</span>
          ${Array.from({ length: CITY_UPGRADES.slots }, (_, i) => { const up = cityUpgrades(city)[i]; return up
            ? `<span class="slot filled" title="${esc(`${t(`cityUpgrades.${up}Desc`, orbitalVars())} ${t('cityUpgrades.capacity', { n: CITY.unitLimitPerUpgrade })}`)}">${icon(CITY_UPGRADE_ICON[up], 'icon-sm')}${esc(t(`cityUpgrades.${up}`))}</span>`
            : `<span class="slot empty">${esc(t('cityUpgrades.empty'))}</span>`; }).join('')}${city.noIncomeNext ? `<span class="tag warn">${esc(t('hud.noIncomeNext'))}</span>` : ''}</div></div>`;
        // Produktionsstaetten der Stadt (Menschen), immer sichtbar / the city's production sites (humans), always visible
        if (!noTraining(city)) body += citySitesHtml(s, city);
        // Kult: Beute dieser Stadt; NEXUS: Rechenleistung / cult: loot of this city; NEXUS: compute
        body += lootTag(s, viewer, city);
        if (isRobotFaction(s, city.owner)) {
          const cs = computeStats(s, city.owner);
          // mit Energie aus Kraftwerk-Stuetzpunkten eigene Fassung / with energy from power bases its own variant
          const ck = `nexus.computeState${cs.depotNodes ? 'Depot' : ''}${cs.energy ? 'Energy' : ''}`;
          body += `<p class="muted icon-line">${icon('lightning', 'icon-sm')}<span>${esc(t(ck, { have: cs.compute, dc: cs.dataCenters, pp: cs.powerPlants, dn: cs.depotNodes, en: cs.energy }))}</span></p>`;
        }
        this.cityNote = '';
        if (myTurn && city.owner === s.current) this.cityActions(s, city.id);
        // Handy: Hinweis auf gesperrte Ausbauten unter "mehr" / phone: note on locked upgrades under "more"
        if (this.cityNote) body += `<p class="muted sheet-more icon-line">${icon('research', 'icon-sm')}<span>${esc(this.cityNote)}</span></p>`;
      }
    } else if (explored && tile.feature === 'mothership') {
      // Kampagne m2: Mutterschiff mit Arbeitsfortschritt / campaign m2: mothership with the work progress
      ({ head, body } = shipSheet(s, viewer));
    } else if (explored && templeSheet(s, x, y)) {
      // Fanatiker-Tempel (m4) / Fanatic temple (m4)
      const ts = templeSheet(s, x, y)!;
      head = ts.head;
      body += ts.body;
    } else if (explored && hackTowerTile(s, x, y, viewer, g, (c) => this.err(c))) {
      // Hackturm (NEXUS): Ladezustand, gesteuerte Einheit, Uebernahme / hack tower (NEXUS): charge state, controlled unit, takeover
      const ht = hackTowerTile(s, x, y, viewer, g, (c) => this.err(c))!;
      head = ht.head;
      body += ht.body;
      this.actions.push(...ht.actions);
    } else if (explored && siloTile(s, x, y, viewer, g)) {
      // Raketensilo (Meridon): Ladezustand und Start / rocket silo (Meridon): charge state and launch
      const st = siloTile(s, x, y, viewer, g)!;
      head = st.head;
      body += st.body;
      this.actions.push(...st.actions);
      // eigenes Silo am Zug: Kaufkarte (Lenkflugkoerper) ueber der Aktionsleiste, wie die Truppen der Stadt
      // own silo on turn: purchase card (Guided Missile) above the action bar, like the city's troops
      if (g.isHumanTurn && turretAt(s, x, y)?.owner === s.current) {
        this.cards = siloCards(s, x, y, (type) => void g.exec({ type: 'siloBuy', x, y, unitType: type }));
        this.troopsTitle = t('shadow.silo.buyTitle');
      }
    } else if (explored && turretAt(s, x, y)?.owner !== undefined) {
      // Geschuetzstellung: Besitzer, Panzerung, Reichweite, feuert jede Runde / gun emplacement: owner, armour, range, fires every round
      const gun = turretAt(s, x, y)!;
      const of = gun.owner!;
      head = `${factionBadge(s.factions[of].id, 'range')}<div class="grow"><h3 class="display">${esc(t('emplacement.name'))}</h3>
        <div class="muted unit-sub">${esc(t(`factions.${s.factions[of].id}.short`))} · ${esc(t('emplacement.every'))}</div></div>`;
      body += `<div class="row">${icon('shield', 'icon-sm')}<span>${esc(t('verdan.hp', { hp: gun.hp, max: EMPLACEMENT.hp }))}</span><div class="grow">${progress(gun.hp, EMPLACEMENT.hp, 'hp', t('verdan.hp', { hp: gun.hp, max: EMPLACEMENT.hp }))}</div></div>
        <div class="stats"><span class="stat">${icon('range', 'icon-sm')}${esc(t('stats.range'))} ${EMPLACEMENT.range}</span>
        <span class="stat">${icon('sword', 'icon-sm')}${esc(t('stats.attack'))} ${num(EMPLACEMENT.attack)}</span>
        <span class="stat">${icon('shield', 'icon-sm')}${esc(t('stats.defense'))} ${num(EMPLACEMENT.defense)}</span>
        ${of === viewer ? `<span class="stat">${icon('build', 'icon-sm')}${esc(emplacementCount(s, of))}</span>` : ''}</div>
        <p class="muted sheet-more">${esc(emplacementDesc(s, of))}</p>`;
    } else if (explored && turretAt(s, x, y)) {
      const gun = turretAt(s, x, y)!;
      head = `<span class="unit-badge">${icon('range')}</span><div class="grow"><h3 class="display">${esc(t('verdan.name'))}</h3>
        <div class="muted unit-sub">${esc(t(gun.active ? 'verdan.active' : 'verdan.dormant'))} · ${esc(t('hud.neutral'))}</div></div>`;
      body += `<div class="row">${icon('shield', 'icon-sm')}<span>${esc(t('verdan.hp', { hp: gun.hp, max: VERDAN.hp }))}</span><div class="grow">${progress(gun.hp, VERDAN.hp, 'hp', t('verdan.hp', { hp: gun.hp, max: VERDAN.hp }))}</div></div>
        <p class="muted sheet-more">${esc(t('verdan.desc', { wake: VERDAN.wakeRange, range: VERDAN.range }))}</p>`;
    } else {
      const owner = territoryOwner(s, tile);
      head = `<span class="unit-badge">${icon(tile.terrain === 'shallow' || tile.terrain === 'ocean' ? 'boot' : 'move')}</span><div class="grow"><h3 class="display">${esc(t(`terrain.${tile.terrain}`))}${tile.biome && tile.biome !== 'grassland' ? ` · ${esc(t(`biomes.${tile.biome}`))}` : ''}</h3>
        <div class="muted">${owner !== null ? esc(owner === viewer ? t('hud.ownTerritory') : t('hud.territoryOf', { name: t(`factions.${s.factions[owner].id}.short`) })) : esc(t('hud.neutral'))}</div></div>`;
      const tags: string[] = [];
      if (tile.resource) tags.push(t(`resources.${tile.resource}`));
      if (tile.building) tags.push(t(`buildings.${tile.building}`));
      if (tile.road) tags.push(t('features.road'));
      if (tile.terrain === 'forest' || tile.cityId !== null) tags.push(t('cover.ranged'));
      if (tile.river) tags.push(t('biomes.river'));
      if (tile.feature) tags.push(t(`features.${tile.feature}`));
      if (tile.outpost) tags.push(`${t('features.outpost')} (${t(`factions.${s.factions[tile.outpost.owner].id}.short`)})`);
      if (tile.grandProject) tags.push(t(`grand.${tile.grandProject}`));
      if (tile.wonderOf) { const w = unitById(s, tile.wonderOf); if (w) tags.push(t('victory.footprint', { name: t(`units.${w.type}`) })); }
      // fallen gelassene Kriegsplaene (m4) / dropped war plans (m4)
      const dropped = droppedPlansTag(s, x, y);
      if (dropped) tags.push(dropped);
      if (tile.turretRuin) tags.push(tile.turretRuinOwner !== undefined ? t('emplacement.ruin') : t('verdan.ruin'));
      if (tile.barrier) tags.push(`${t('features.barrier')} (${t(`factions.${s.factions[tile.barrier.owner].id}.short`)})`);
      if (tile.mine && (viewer < 0 || canSeeMine(s, viewer, x, y))) tags.push(`${t('features.mine')} (${t(`factions.${s.factions[tile.mine.owner].id}.short`)}): ${t('features.mineDesc', { foot: COUNTER.mine.damageFoot, vehicle: COUNTER.mine.damageVehicle })}`);
      if (tile.remains?.kind === 'wreck') tags.push(`${t('features.wreck')} (${t(`units.${tile.remains.unit}`)}): ${t('features.wreckCover')}`);
      const bones = tile.remains ? tile.remains.skeletons ?? (tile.remains.kind === 'skeleton' ? 1 : 0) : 0;
      if (bones) tags.push(t('features.skeleton', { n: bones }));
      // Schlachtfeld-Narben (nur Optik) / battlefield scars (visual only)
      const scar = scarTier(tile);
      if (scar >= 2) tags.push(t(scar >= 3 ? 'features.battlefieldHeavy' : 'features.battlefield'));
      // Mahnmal des Kults: Restdauer und Wirkung / cult memorial: remaining duration and effect
      const memorial = memorialAt(s, x, y);
      if (memorial) {
        tags.push(t('memorial.tile', { unit: t(`units.${memorial.unit}`), n: memorial.until - s.round + 1,
          zeal: Math.round(CULT.memorialAttack * 100), fear: Math.round(CULT.memorialFear * 100) }));
      }
      if (tile.xeno) tags.push(`${t('xeno.ground')}: ${t('xeno.groundDesc')}`);
      if (tile.volcano) {
        const n = roundsToEruption(x, y, s.round + (s.current === s.factions.length - 1 ? 1 : 0));
        tags.push(`${t('hazards.volcano')}: ${n <= 0 ? t('hazards.volcanoNow') : t('hazards.volcanoIn', { n })}. ${t('hazards.volcanoDesc', { dmg: VOLCANO.damage, r: VOLCANO.burnRounds })}`);
      }
      if (burning(s, tile)) tags.push(`${t('hazards.lava')}: ${t('hazards.lavaDesc', { n: (tile.lava ?? s.round) - s.round + 1 })}`);
      if (isJungle(tile)) tags.push(`${t('hazards.jungle')}: ${t('hazards.jungleDesc', { def: JUNGLE.footDefense })}`);
      if (tile.feature === 'crashSite') tags.push(tile.looted ? t('hazards.crashLooted') : `${t('hazards.crash')}: ${techT('hazards.crashDesc', this.viewerId(s), { n: CRASH.stars, tier: CRASH.maxTier })}`);
      if (tile.feature === 'labRuin') tags.push(tile.looted ? t('hazards.labLooted') : `${t('hazards.lab')}: ${techT('hazards.labDesc', this.viewerId(s), { n: CRASH.stars, tier: CRASH.maxTier })}`);
      // erst nach allen Gefahren- und Xeno-Texten ausgeben / render only after all hazard and xeno texts
      if (tags.length) body += `<div class="row sheet-more">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>`;
      if (myTurn && owner === s.current) this.buildActions(s, x, y);
      if (myTurn) this.wonderActions(s, x, y);
      // eigener Marinestuetzpunkt: Schiffskarten der Stadt, zu der er gehoert / own naval base: ship cards of the city it belongs to
      const base = tile.building === 'navalBase' && tile.territory !== null ? cityById(s, tile.territory) : undefined;
      if (myTurn && base && base.owner === s.current && owner === s.current) this.setTroops(s, base, true);
    }
    // Stadt-Hack (NEXUS): Marke und Daten an fremden Staedten, Aktion fuer NEXUS am Zug / city hack (NEXUS): mark and data at foreign cities, action for NEXUS on turn
    if (explored && city && city.owner !== null && (tab === 'city' || (tab === 'unit' && !vUnit))) {
      // gleich unter dem Kopf, damit die Daten ohne Scrollen sichtbar sind / right below the head so the data shows without scrolling
      body = cityHackHtml(s, city, viewer) + body;
      const ca = hackCityAction(s, city, g, (c) => this.err(c));
      if (ca) this.actions.push(ca);
    }
    const tabsAvail = [vUnit && explored ? 'unit' : '', city && explored ? 'city' : '', 'tile'].filter(Boolean);
    const switcher = tabsAvail.length > 1 ? `<div class="seg tabs" role="tablist">${tabsAvail.map((k) => `<button type="button" role="tab" data-action="tab-${k}" aria-pressed="${k === tab || (k === 'city' && tab === 'unit' && !vUnit)}">${esc(t(k === 'city' && supplyLines(s) ? 'actions.shaftActions' : `actions.${k}Actions`))}</button>`).join('')}</div>` : '';
    // Aktionsleiste mit Scroll-Hinweis und einzeiliger Erklaerung darunter / action bar with scroll cue and a one-line explanation below
    const blocked = this.findAct(this.hintId)?.enabled === false;
    // Truppenkarten ueber der Aktionsleiste, eine Hinweiszeile fuer beide / troop cards above the action bar, one hint line for both
    const troops = this.cards.length && s.current >= 0 ? troopsHtml(this.cards, s.factions[s.current].id, this.troopsTitle) : '';
    const bar = this.actions.length ? `<div class="action-wrap"><div class="action-bar" role="toolbar">${this.actions.map(actionButton).join('')}</div>
      <button type="button" class="action-more" data-action="actionsMore" aria-label="${esc(t('hud.moreActions'))}" title="${esc(t('hud.moreActions'))}" hidden>${icon('next', 'icon-sm')}</button></div>` : '';
    const actionsHtml = this.actions.length || this.cards.length ? `${troops}${bar}
      <button type="button" class="action-hint ${this.hintOpen ? 'open' : ''} ${blocked ? 'blocked' : ''}" data-action="hint" aria-expanded="${this.hintOpen}" aria-live="polite" title="${esc(t('hud.hintExpand'))}">${this.hintHtml()}</button>` : '';
    // Handy: Zusatzwerte eingeklappt, Knopf klappt sie auf / phone: extra values collapsed, a button expands them
    const more = body.includes('sheet-more')
      ? `<button type="button" class="icon-btn sheet-toggle" data-action="sheet-more" aria-expanded="${this.expanded}" aria-label="${esc(t(this.expanded ? 'hud.lessInfo' : 'hud.moreInfo'))}" title="${esc(t(this.expanded ? 'hud.lessInfo' : 'hud.moreInfo'))}">${icon(this.expanded ? 'chevronDown' : 'chevronUp')}</button>` : '';
    // Desktop: Infoteil scrollt, Truppen und Aktionen bleiben sichtbar / desktop: the info part scrolls, troops and actions stay visible
    return `<div class="sheet-head">${head}${more}${iconButton('info', t('actions.details'), 'details')}${iconButton('close', t('actions.close'), 'deselect')}</div><div class="sheet-info">${body}${switcher}</div>${actionsHtml}`;
  }

  private unitActions(s: GameState, u: Unit) {
    const g = this.game;
    // Beamer und Angriff auf eine Akademie / beamer and attack on an academy
    this.actions.push(...unitAcademyActions(s, g, u, (c) => this.err(c)));
    const gunAt = g.pendingTurret;
    if (gunAt && turretTargets(s, u).some((p) => p.x === gunAt.x && p.y === gunAt.y)) {
      const gun = turretAt(s, gunAt.x, gunAt.y)!;
      const pre = turretPreview(s, u, gunAt);
      const kill = pre.toTurret >= gun.hp;
      // Geschuetzstellung: eigener Name und Text / gun emplacement: own name and text
      const owned = gun.owner !== undefined;
      // Raketensilo: eigener Name, kein Gegenschlag / rocket silo: own name, no return fire
      const isSilo = gun.kind === 'silo';
      // Hackturm (NEXUS): eigener Name, kein Gegenschlag / hack tower (NEXUS): own name, no return fire
      const isHack = gun.kind === 'hack';
      const sub = kill ? t(isSilo ? 'shadow.silo.previewKill' : isHack ? 'hack.tower.previewKill' : owned ? 'emplacement.previewKill' : 'verdan.previewKill') : t('verdan.preview', { dmg: pre.toTurret, ret: pre.ret(gun.hp - pre.toTurret) });
      const about = isSilo ? `${t('shadow.silo.nameOf', { name: t(`factions.${s.factions[gun.owner!].id}.short`) })}: ${t('shadow.silo.stats', { hp: gun.hp, max: SILO.hp, range: SILO.launchRange, dmg: SILO.damage })}`
        : isHack ? `${t('hack.tower.nameOf', { name: t(`factions.${s.factions[gun.owner!].id}.short`) })}: ${t('hack.tower.stats', { hp: gun.hp, max: HACK.tower.hp, reach: HACK.tower.reach })}`
        : owned ? `${emplacementName(s, gun.owner!)}: ${emplacementStats(gun.hp)}` : t('verdan.desc', { wake: VERDAN.wakeRange, range: VERDAN.range });
      if (pre.moveFire) this.combatNote = moveFireHint(s, u);
      this.actions.push({
        id: 'attackTurret', icon: 'attack', variant: 'danger', enabled: true, label: t(isSilo ? 'shadow.silo.attack' : isHack ? 'hack.tower.attack' : owned ? 'emplacement.attack' : 'verdan.attack'), sub, desc: `${sub}${pre.moveFire ? `. ${moveFireHint(s, u)}` : ''}. ${about}`,
        run: () => void g.exec({ type: 'attackTurret', unit: u.id, x: gunAt.x, y: gunAt.y }),
      });
    }
    if (g.pendingTarget !== null) {
      const target = unitById(s, g.pendingTarget);
      // Mech-Raketen / mech rockets
      if (target && rocketTargets(s, u).some((o) => o.id === target.id)) {
        const pre = combatPreview(s, u, target, true);
        const p = attackPreview(s, pre, u, target);
        this.combatNote ||= combatNotes(s, pre, u, target);
        this.actions.push({
          id: 'rocket', icon: 'lightning', variant: 'danger', enabled: true,
          label: t('rockets.action', { n: rocketsLeft(u), max: ROCKETS.max }), sub: p.short, desc: `${p.full} ${t('rockets.desc')}`,
          run: () => void g.exec({ type: 'rocket', unit: u.id, target: target.id }),
        });
      }
      // nur, solange der Angriff noch moeglich ist / only while the attack is still possible
      if (target && attackTargets(s, u).some((o) => o.id === target.id)) {
        // kurzer Name, Vorschau als zweite Zeile / short label, preview as a second line
        const pre = combatPreview(s, u, target);
        const p = attackPreview(s, pre, u, target);
        this.combatNote ||= combatNotes(s, pre, u, target);
        this.actions.push({
          id: 'attack', icon: 'attack', variant: 'danger', enabled: true,
          label: t('actions.attack'), sub: p.short, desc: p.full,
          run: () => void g.exec({ type: 'attack', unit: u.id, target: target.id }),
        });
        // Menschen: geordneter Rueckzug / humans: orderly retreat
        if (canOrderlyRetreat(u)) {
          const rc = retreatCheck(s, u, target);
          if (rc !== 'cannotRetreat' && rc !== 'outOfRange') {
            const wait = (u.retreatReady ?? 0) - s.round;
            // Schuss vor dem Schritt: nach einer Bewegung ebenfalls verringert, ebenso gegen ein Bollwerk
            // shot before the step: also reduced after a move, likewise against a bulwark
            const retreatNotes = combatNotes(s, { moveFire: movedThisTurn(u), homeDefense: homeDefenseAt(s, target), judgement: judgementAt(s, u, target), blessing: blessingOf(s, target), memorial: memorialMult(s, u), entrenched: entrenchMiss(s, target), rear: rearAttackBonus(u, target) }, u, target);
            const retreatDesc = retreatNotes ? `${t('retreat.desc')} ${retreatNotes}.` : t('retreat.desc');
            this.actions.push({
              id: 'retreat', icon: 'move', enabled: rc === 'ok',
              label: t('retreat.action', { dmg: retreatDamage(s, u, target) }),
              desc: retreatDesc,
              reason: rc === 'ok' ? retreatDesc : rc === 'retreatCooldown' ? `${t('retreat.cooldown', { n: wait })}. ${t('retreat.desc')}` : this.err(rc),
              run: () => void g.exec({ type: 'retreat', unit: u.id, target: target.id }),
            });
          }
        }
      }
    }
    // Kampagne m2: Wissenschaftler am Mutterschiff / campaign m2: scientist at the mothership
    const work = workAction(s, u, g, (c) => this.err(c));
    if (work) this.actions.push(work);
    const cap = captureKind(s, u);
    // Kult: Einnehmen heisst Pluendern, mit Beute / cult: capturing means plundering, with loot
    const plunderCity = cap === 'city' || cap === 'village' ? cityAt(s, u.x, u.y) : undefined;
    const loot = plunderCity && isCultFaction(s, u.owner) ? plunderValue(s, u.owner, plunderCity) : null;
    if (cap) this.actions.push({ id: 'capture', icon: 'capture', label: loot !== null ? t('cult.plunder') : t('actions.capture'), sub: loot ? `+${loot}` : undefined,
      desc: loot !== null ? (loot ? t('cult.loot', { n: loot }) : t('cult.lootEmpty', { n: (plunderCity!.plundered ?? 0) + CULT.replunderRounds })) : undefined,
      variant: 'primary', enabled: true, run: () => void g.exec({ type: 'capture', unit: u.id }) });
    // Kampagne m4: Kriegsplaene bergen oder aufheben / campaign m4: seize or pick up the war plans
    const plans = plansAction(s, u, (c) => this.err(c), () => void g.exec({ type: 'seizePlans', unit: u.id }));
    if (plans) this.actions.push(plans);
    // Kampagne, Alvenia und Meridon: Siedlung ueberzeugen / campaign, Alvenia and Meridon: persuade a settlement
    for (const c of persuadeTargets(s, u)) {
      const pc = persuadeCheck(s, u, c);
      this.actions.push({
        id: `persuade-${c.id}`, icon: 'diplomacy', label: t('actions.persuade'), sub: cityName(s, c.id), cost: persuadeCost(c), enabled: pc === 'ok',
        desc: t('actions.persuadeDesc'), reason: pc === 'ok' ? t('actions.persuadeDesc') : this.err(pc),
        run: () => void g.exec({ type: 'persuade', unit: u.id, city: c.id }),
      });
    }
    // Wunder-Bauwerke heilen nicht / wonder structures do not heal
    if (u.hp < u.maxHp && !isWonderStructure(u)) {
      const blocked = alienHealBlocked(s, u);
      const ok = canHeal(u) && !blocked;
      this.actions.push({ id: 'heal', icon: 'heal', label: `${t('actions.heal')} +${Math.min(healAmount(s, u), u.maxHp - u.hp)}`, enabled: ok,
        reason: blocked ? this.err('noXenoGround') : ok ? undefined : this.err('unitExhausted'), run: () => void g.exec({ type: 'heal', unit: u.id }) });
    }
    // Roboter: Notreparatur aus einem Wrack / robots: emergency repair from a wreck
    if (u.hp < u.maxHp) {
      const rc = repairCheck(s, u);
      if (rc === 'ok' || rc === 'unitExhausted') {
        this.actions.push({ id: 'repair', icon: 'build', label: t('repair.action', { n: repairAmount(s, u) }), enabled: rc === 'ok', desc: t('repair.desc'),
          reason: rc === 'ok' ? t('repair.desc') : `${this.err('unitExhausted')} ${t('repair.desc')}`, run: () => void g.exec({ type: 'repair', unit: u.id }) });
      }
    }
    if (has(u, 'heal')) {
      const ok = canActStill(u);
      this.actions.push({ id: 'medicHeal', icon: 'heal', label: t('actions.medicHeal'), enabled: ok, reason: ok ? undefined : this.err('unitExhausted'), run: () => void g.exec({ type: 'medicHeal', unit: u.id }) });
    }
    // Kult: Rekrutieren im Feld, Menue mit Preis, Abklingzeit und Limit / cult: recruiting in the field, menu with price, cooldown and cap
    const rtypes = isCultFaction(s, u.owner) ? recruitTypes(u).filter((type) => !UNITS[type].abilities.includes('wonder') || factionVictoryOn(s)) : [];
    if (rtypes.length) {
      const have = cultUnits(s, u.owner).length, cap = cultCap(s, u.owner), wait = recruitWait(s, u);
      const why = (chk: string, type: UnitTypeId) => chk === 'unitLimit' ? t('cult.capFull', { n: have, max: cap }) : chk === 'recruitCooldown' ? t('cult.cooldown', { n: u.recruitReady ?? s.round })
        : chk === 'noSpace' ? t('cult.noSpace') : chk === 'techMissing' ? t('hud.needsTech', { tech: t(`techs.${UNITS[type].tech}`) }) : this.err(chk);
      if (this.recruitFor === u.id) {
        this.actions.push({ id: 'recruit-cancel', icon: 'close', label: t('actions.cancel'), enabled: true, run: () => { this.recruitFor = null; this.render(); } });
        for (const type of rtypes) {
          const st = UNITS[type];
          // Bohrer erst mit der Siegtechnologie anbieten / offer the drill only with the victory tech
          if (st.abilities.includes('wonder') && st.tech && !hasTech(s, u.owner, st.tech)) continue;
          const chk = recruitReason(s, u, type);
          const spot = chk === 'ok' ? recruitSpot(s, u, type) : null;
          const wonder = st.abilities.includes('wonder');
          this.actions.push({ id: `recruit-${type}`, icon: UNIT_ICON[type], label: t(`units.${type}`), sub: unitNickname(s.factions[u.owner].id, type), cost: unitCost(s, u.owner, type)!,
            desc: wonder ? victoryGoalText(s.factions[u.owner].id, s) : unitStatsLine(type, s.factions[u.owner].id), enabled: !!spot,
            reason: spot ? (wonder ? victoryGoalText(s.factions[u.owner].id, s) : t('cult.recruitHint', { n: CULT.recruitCooldown })) : why(chk, type),
            run: () => { this.recruitFor = null; if (spot) void g.exec({ type: 'recruit', unit: u.id, unitType: type, x: spot.x, y: spot.y }); } });
        }
      } else {
        const ready = !u.fresh && !u.exhausted && !u.attacked;
        const can = ready && wait === 0;
        this.actions.push({ id: 'recruit', icon: 'people', label: t('cult.recruit'), sub: t('cult.hordeShort', { n: have, max: cap }), variant: 'primary', enabled: can,
          desc: t('cult.recruitDesc', { n: CULT.recruitCooldown, have, max: cap }),
          reason: !ready ? this.err('unitExhausted') : wait ? t('cult.cooldown', { n: u.recruitReady ?? s.round }) : have >= cap ? t('cult.capFull', { n: have, max: cap }) : t('cult.recruitDesc', { n: CULT.recruitCooldown, have, max: cap }),
          run: () => { this.recruitFor = u.id; this.render(); } });
      }
    }
    if (has(u, 'terraform')) {
      const targets = terraformTargets(s, u);
      const active = g.terraformUnit === u.id;
      this.actions.push({ id: 'terraform', icon: 'build', label: active ? t('actions.cancel') : t('xeno.terraform'), cost: active ? undefined : 0, variant: 'primary',
        enabled: active || targets.length > 0, reason: targets.length ? t('abilities.terraformDesc') : t('errors.unitExhausted'),
        run: () => { if (active) { g.terraformUnit = null; g.updateHighlights(); this.render(); } else { g.startTerraform(u.id); g.ui.toast(t('xeno.terraformHint'), 'build'); } } });
    }
    if (BARRIER.builders.includes(u.type) && s.factions[u.owner].techs.includes('fortification')) {
      const targets = barrierTargets(s, u);
      const ok = targets.length > 0;
      const base = barrierCheck(s, u, u.x, u.y + (u.y + 1 < s.size ? 1 : -1));
      const reason = ok ? t('actions.barrierHint') : this.err(base === 'ok' || base === 'occupied' || base === 'outOfRange' ? 'invalidTile' : base);
      this.actions.push({ id: 'barrier', icon: 'shield', label: g.barrierMode ? t('actions.cancel') : t('actions.barrier'), cost: g.barrierMode ? undefined : barrierCost(s, u.owner), enabled: ok || g.barrierMode, reason,
        run: () => { if (g.barrierMode) { g.barrierMode = false; g.updateHighlights(); this.render(); } else { g.startBarrier(); g.ui.toast(t('actions.barrierHint'), 'shield'); } } });
    }
    // Minenleger: Mine auf ein Nachbarfeld / mine layer: mine on an adjacent tile
    if (has(u, 'mines')) {
      const targets = mineTargets(s, u);
      const ok = targets.length > 0;
      const base = neighbors(s.size, u.x, u.y).map((q) => mineCheck(s, u, q.x, q.y)).find((r) => r !== 'occupied' && r !== 'invalidTile' && r !== 'outOfRange') ?? 'invalidTile';
      const reason = ok ? t('actions.mineHint') : base === 'unitLimit' ? t('errors.mineLimit', { n: COUNTER.mine.maxPerFaction }) : this.err(base);
      this.actions.push({ id: 'mine', icon: 'warning', label: g.mineMode ? t('actions.cancel') : t('actions.mine'), cost: g.mineMode ? undefined : COUNTER.mine.cost, variant: 'primary', enabled: ok || g.mineMode, reason,
        run: () => { if (g.mineMode) { g.mineMode = false; g.updateHighlights(); this.render(); } else { g.startMine(); g.ui.toast(t('actions.mineHint'), 'warning'); } } });
    }
    // Festungsbau (Dravon): Geschuetzstellung auf ein Nachbarfeld, mit Limit und Grund / fortification (Dravon): gun emplacement on an adjacent tile, with limit and reason
    if (isEmplacementBuilder(s, u)) {
      // Meridon baut statt Geschuetzstellungen Raketensilos (gleicher Befehl, eigene Texte) / Meridon builds rocket silos instead of gun emplacements (same command, own texts)
      const silo = buildsSilos(s, u.owner);
      const k = silo ? 'shadow.silo' : 'emplacement';
      const ok = emplacementTargets(s, u).length > 0;
      const block = emplacementBlock(s, u);
      const count = silo ? t('shadow.silo.count', { n: silosOf(s, u.owner).length, max: emplacementLimit(s, u.owner) }) : emplacementCount(s, u.owner);
      const reason = ok ? `${t(`${k}.hint`)} ${count}.`
        : block === 'emplacementLimit' ? t(`${k}.limitReason`, { n: (silo ? silosOf(s, u.owner) : emplacementsOf(s, u.owner)).length, max: emplacementLimit(s, u.owner) })
        : block === 'emplacementSpacing' ? t(`${k}.spacingReason`, { n: silo ? SILO.minSpacing : EMPLACEMENT.minSpacing })
        : block === 'notInTerritory' ? t(`${k}.territoryReason`) : this.err(block === 'occupied' ? 'invalidTile' : block);
      const about = silo ? t('shadow.silo.desc', { name: t(`factions.${s.factions[u.owner].id}.short`) }) : emplacementDesc(s, u.owner);
      this.actions.push({ id: 'emplacement', icon: silo ? 'silo' : 'range', label: g.emplacementMode ? t('actions.cancel') : t(`${k}.build`), sub: g.emplacementMode ? undefined : count,
        cost: g.emplacementMode ? undefined : silo ? SILO.cost : EMPLACEMENT.cost, variant: 'primary', enabled: ok || g.emplacementMode, reason, desc: `${reason} ${about}`,
        run: () => { if (g.emplacementMode) { g.emplacementMode = false; g.updateHighlights(); this.render(); } else { g.startEmplacement(); g.ui.toast(t(`${k}.hint`), silo ? 'silo' : 'range'); } } });
    }
    // Schattenflotte: Sabotage und Radarimpuls / shadow fleet: sabotage and radar sweep
    for (const a of shadowUnitActions(s, u, g, (c) => this.err(c), () => this.render())) this.actions.push(a);
    // Berserker (Kult): Sprengen / berserker (cult): detonate
    for (const a of berserkerActions(s, u, g, (c) => this.err(c), () => this.render())) this.actions.push(a);
    if (INFANTRY_TYPES.includes(u.type) && s.factions[u.owner].techs.includes('fortification')) {
      const chk = outpostCheck(s, u);
      this.actions.push({ id: 'outpost', icon: 'outpost', label: t('actions.outpost'), cost: outpostCost(s, u.owner), enabled: chk === 'ok', reason: chk === 'ok' ? undefined : this.err(chk === 'cannotCapture' ? 'unitExhausted' : chk), run: () => void g.exec({ type: 'outpost', unit: u.id }) });
    }
    if (UNITS[u.type].ship) {
      for (const to of [...SHIP_UPGRADES, ...(UNIQUE.units[s.factions[u.owner].id] === 'privateer' ? ['privateer' as const] : [])]) {
        if (to === u.type) continue;
        // Menschen: Staette statt Forschung, Sperrgrund mit Staette / humans: site instead of research, lock reason with the site
        const sites = usesSites(s, u.owner);
        const tech = UNITS[to].tech;
        if (!sites && tech && !s.factions[u.owner].techs.includes(tech)) continue;
        const chk = upgradeCheck(s, u, to);
        const site = siteOf(to);
        const reason = chk === 'ok' ? undefined : chk === 'buildingMissing' && site ? t('sites.ship', { site: t(`buildings.${site}`) }) : this.err(chk);
        this.actions.push({ id: `up-${to}`, icon: 'upgrade', label: t('actions.upgrade', { unit: t(`units.${to}`) }), cost: shipUpgradeCost(s, u.owner, to), enabled: chk === 'ok', reason, run: () => void g.exec({ type: 'upgrade', unit: u.id, to }) });
      }
    }
  }

  private cityActions(s: GameState, cityId: number) {
    const g = this.game;
    const c = cityById(s, cityId)!;
    // Stufe mit Sternen kaufen (nicht fuer Sendetuerme und Nachschublinien) / buy a level with stars (not for towers and supply lines)
    const buy = buyLevelCheck(s, c.owner!, c);
    if (buy !== 'cannotBuild') {
      const desc = t('buyLevel.desc', { n: c.level + 1, income: INCOME.perCityLevel });
      this.actions.push({
        id: 'buy-level', icon: 'upgrade', label: t('buyLevel.label'), sub: t('hud.level', { n: c.level + 1 }), cost: buyLevelCost(c), variant: 'primary',
        enabled: buy === 'ok', desc,
        reason: buy === 'ok' ? desc : buy === 'alreadyBought' ? t('buyLevel.once') : this.err(buy),
        run: () => void g.exec({ type: 'buyLevel', city: c.id }),
      });
    }
    // Ausbau-Slots / upgrade slots
    let lockedUpgrades = 0;
    let relayLocked = false;
    // Nachschublinien lassen sich nicht ausbauen: keine Knoepfe / supply lines cannot be upgraded: no buttons
    for (const up of supplyLines(s) ? [] : CITY_UPGRADE_IDS) {
      if (hasCityUpgrade(c, up)) continue;
      const chk = cityUpgradeCheck(s, c.owner!, c, up);
      // Ausbau einer anderen Fraktion (Satelliten-Relay) gar nicht zeigen / another faction's upgrade (satellite relay): not shown at all
      if (chk === 'wrongFaction') continue;
      // noch nicht erforscht: nicht anzeigen, nur zaehlen / not researched yet: hide, only count
      if (chk === 'techMissing' || chk === 'cityLevel') { lockedUpgrades++; if (up === 'satRelay') relayLocked = true; continue; }
      const radioActive = up === 'radioTower' && g.radioCity === c.id;
      const noTargets = up === 'radioTower' && radioTargets(s, c.owner!, c).length === 0;
      this.actions.push({
        id: `up-${up}`, icon: CITY_UPGRADE_ICON[up], label: radioActive ? t('actions.cancel') : t(`cityUpgrades.${up}`),
        cost: radioActive ? undefined : CITY_UPGRADES.cost[up], variant: 'primary',
        enabled: radioActive || (chk === 'ok' && !noTargets),
        reason: noTargets ? t('cityUpgrades.noTargets') : chk === 'ok' ? `${t(`cityUpgrades.${up}Desc`, orbitalVars())} ${t('cityUpgrades.capacity', { n: CITY.unitLimitPerUpgrade })}` : chk === 'noSlot' ? t('cityUpgrades.full') : this.err(chk),
        run: () => {
          if (up !== 'radioTower') { void g.exec({ type: 'cityUpgrade', city: c.id, upgrade: up }); return; }
          if (radioActive) { g.radioCity = null; g.updateHighlights(); this.render(); return; }
          g.startRadio(c.id);
          g.ui.toast(t('cityUpgrades.radioHint'), 'range');
        },
      });
    }
    if (lockedUpgrades && cityUpgrades(c).length < CITY_UPGRADES.slots) {
      const noResearch = !canResearch(s, c.owner!);
      this.cityNote = techT(noResearch ? 'cityUpgrades.lockedHintLevel' : 'cityUpgrades.lockedHint', s.factions[c.owner!].id, { n: lockedUpgrades });
      // Velkar: welche Produktionsfaehigkeit das Relay freischaltet / Velkar: which production capability unlocks the relay
      if (relayLocked) this.cityNote += ` ${techT('orbital.unlockHint', s.factions[c.owner!].id, { tech: t(`techs.${CITY_UPGRADES.tech.satRelay}`) })}`;
    }
    // Zyrr: erst das Stadtfeld terraformen / Zyrr: terraform the city tile first
    if (isAlienFaction(s, c.owner!) && !s.tiles[c.y * s.size + c.x].xeno) {
      const chk = terraformCheck(s, c.owner!, c.x, c.y);
      this.actions.push({ id: 'terraform-city', icon: 'build', label: t('xeno.terraform'), cost: XENO.terraformCost, variant: 'primary', enabled: chk === 'ok',
        reason: chk === 'ok' ? t('xeno.cityNeedsTerraform') : this.err(chk), run: () => void g.exec({ type: 'terraform', x: c.x, y: c.y }) });
    }
    // Ausbildung: eigene Kartenleiste "Truppen" mit allen Gattungen statt Knoepfen in der Aktionsleiste
    // training: own card strip "Troops" with all types instead of buttons in the action bar
    this.setTroops(s, c);
  }

  /**
   * Wunder bauen: nur mit Siegtechnologie; bei falschem Feld deaktiviert mit Grund (nur auf eigenem Land/Aussenposten).
   * Build a wonder: only with the victory tech; disabled with a reason on a wrong tile (only on own land or outposts).
   */
  private wonderActions(s: GameState, x: number, y: number) {
    const g = this.game;
    const f = s.current;
    const kind = wonderKindOf(s, f);
    if (!kind || kind === 'coreDrill' || !factionVictoryOn(s) || !hasTech(s, f, victoryTechOf(s, f))) return;
    const tile = s.tiles[y * s.size + x];
    const mine = territoryOwner(s, tile) === f || tile.outpost?.owner === f;
    const chk = wonderCheck(s, f, kind as WonderKind, x, y);
    // auf fremdem Gebiet nicht anbieten / not offered on foreign ground
    if (!mine && chk === 'notInTerritory') return;
    this.actions.push({
      id: `wonder-${kind}`, icon: UNIT_ICON[kind] ?? 'trophy', label: t('victory.build', { name: t(`units.${kind}`) }), sub: unitNickname(s.factions[f].id, kind),
      cost: WONDERS.cost[kind], variant: 'primary', enabled: chk === 'ok',
      reason: chk === 'ok' ? victoryGoalText(s.factions[f].id, s) : this.err(chk),
      run: () => void g.exec({ type: 'wonder', kind: kind as WonderKind, x, y }),
    });
  }

  private buildActions(s: GameState, x: number, y: number) {
    const g = this.game;
    const f = s.current;
    if (isAlienFaction(s, f) && !s.tiles[y * s.size + x].xeno) {
      const chk = terraformCheck(s, f, x, y);
      if (chk === 'ok' || chk === 'notEnoughStars') this.actions.push({ id: 'terraform-tile', icon: 'build', label: t('xeno.terraform'), cost: XENO.terraformCost, variant: 'primary',
        enabled: chk === 'ok', reason: chk === 'ok' ? t('xeno.groundDesc') : this.err(chk), run: () => void g.exec({ type: 'terraform', x, y }) });
    }
    const locked: ActionItem[] = [];
    for (const b of Object.keys(BUILDINGS) as BuildingId[]) {
      const chk = buildCheck(s, f, b, x, y);
      // fehlende Technologie: anzeigen, wenn das Gebaeude sonst hierher passt / missing tech: show if the building would otherwise fit here
      if (!chk.ok && chk.error === 'techMissing') {
        const tech = lockedBuildingTech(s, f, b, x, y);
        if (tech) locked.push({
          id: `build-${b}`, icon: BUILD_ICON[b] ?? 'build', label: t(`buildings.${b}`), cost: chk.cost, enabled: false,
          reason: `${t('hud.needsTech', { tech: t(`techs.${tech}`) })} · ${buildingDescText(b)}`,
          run: () => {},
        });
        continue;
      }
      // Produktionsstaette ohne Voraussetzung (Panzerwerk ohne Tagebau usw.): gesperrt mit Grund / production site without its prerequisite (tank works without a mine etc.): locked with a reason
      if (!chk.ok && chk.error === 'buildingMissing') {
        locked.push({
          id: `build-${b}`, icon: BUILD_ICON[b] ?? 'build', label: t(`buildings.${b}`), cost: chk.cost, enabled: false,
          reason: `${buildLockReason(b)} · ${buildingDescText(b, s.factions[f].id)}`,
          run: () => {},
        });
        continue;
      }
      if (!chk.ok && chk.error !== 'notEnoughStars' && chk.error !== 'onePerCity') continue;
      // eingebaute Staette (Kaserne im Hauptquartier usw.) nicht noch einmal anbieten / do not offer a built-in site again (barracks in the HQ etc.)
      const terr = s.tiles[y * s.size + x].territory;
      const tc = terr !== null ? cityById(s, terr) : undefined;
      if (isProductionSite(b) && tc && builtInSite(s, tc, b)) continue;
      // Ressourcengebaeude als Ausbau eines Grundgebaeudes / resource building as upgrade of a base building
      const upgrade = !!BUILDINGS[b].upgrades && s.tiles[y * s.size + x].building === BUILDINGS[b].upgrades;
      this.actions.push({
        id: `build-${b}`, icon: BUILD_ICON[b] ?? 'build', label: t(`buildings.${b}`), sub: upgrade ? t('resource.upgrade') : undefined, cost: chk.cost, enabled: chk.ok,
        desc: buildingDescText(b, s.factions[f].id),
        reason: chk.ok ? buildingDescText(b, s.factions[f].id) : this.err(chk.error),
        run: () => void g.exec({ type: 'build', building: b, x, y }),
      });
    }
    // gesperrte Gebaeude hinter den baubaren / locked buildings after the buildable ones
    this.actions.push(...locked);
    // NEXUS: Hackturm auf diesem Feld (HACK.tower) / NEXUS: hack tower on this tile (HACK.tower)
    const ht = hackTowerBuildAction(s, x, y, g, (c) => this.err(c));
    if (ht) this.actions.unshift(ht);
    for (const id of GRAND_PROJECT_IDS) {
      if (!grandProjectCheck(s, f, id, x, y)) continue;
      this.actions.push({ id: `grand-${id}`, icon: 'grand', label: t(`grand.${id}`), cost: 0, enabled: true, variant: 'primary', run: () => void g.exec({ type: 'grandProject', id, x, y }) });
    }
  }
}

/**
 * Technologie, die einem Gebaeude auf diesem Feld fehlt, falls es sonst passen wuerde (sonst null).
 * Tech a building lacks on this tile if it would otherwise fit (otherwise null).
 */
function lockedBuildingTech(s: GameState, f: number, b: BuildingId, x: number, y: number): TechId | null {
  if (b === 'xenoHive' || b === 'xenoHarvester' || isAlienFaction(s, f)) return null;
  const tile = s.tiles[y * s.size + x];
  const tech = b === 'researchCenter'
    ? (tile.terrain === 'ocean' ? null : RESEARCH_CENTER_TECH[tile.terrain as keyof typeof RESEARCH_CENTER_TECH] ?? null)
    : BUILDINGS[b].tech;
  if (!tech) return null;
  // Probe mit der Technologie (flache Kopie, aendert den Zustand nicht) / probe with the tech (shallow copy, does not change the state)
  const fa = s.factions[f];
  const probe = { ...s, factions: s.factions.map((o, i) => (i === f ? { ...fa, techs: [...fa.techs, tech] } : o)) } as GameState;
  const chk = buildCheck(probe, f, b, x, y);
  return chk.ok || chk.error === 'notEnoughStars' || chk.error === 'onePerCity' ? tech : null;
}

export { price };
