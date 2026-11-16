/**
 * Spieloberflaeche: schmale Statusleiste oben, Kartensteuerung, Aktionsleiste im Daumenbereich.
 * Game HUD: slim status bar on top, map controls, action bar in the thumb zone.
 */
import {
  type FactionId, type UnitTypeId, type CounterClass, type WonderKind, WONDERS, COUNTER, CRASH, CULT, CITY, JUNGLE, VOLCANO, XENO, BARRIER, CITY_UPGRADES, CITY_UPGRADE_IDS, BUILDINGS, type CityUpgradeId, GRAND_PROJECT_IDS, INFANTRY_TYPES, SHIP_UPGRADES, UNIQUE, UNITS, UPKEEP, HIT_KINDS, VERDAN, EMPLACEMENT, SUPPLY_LINE, TOWER, ROCKETS, RESEARCH_CENTER_TECH, RESOURCE, type BuildingId, type TechId,
} from '../data/balance';
import {
  burning, isJungle, roundsToEruption, paidUnits, unitUpkeep, upkeep, neighbors, canResearch, computeStats, isCultFaction, isRobotFaction, recruitSpot, recruitReason, recruitTypes, recruitWait, cultCap, cultSlots, cultUnits, plunderValue, cityTiles, rosterUnits,
  barrierCost, outpostCost, canSeeMine, mineCheck, mineTargets, barrierCheck, barrierTargets, isAlienFaction, terraformCheck, terraformTargets, isDesert, isAlienWorld, weather, weatherAt, hasWeather, nextWeatherRound, cityUpgradeCheck, hasCityUpgrade, radioTargets, cityUpgrades, buildCheck, canActStill, canHeal, captureKind, cityAt, cityIncome, cityById, combatPreview, grandProjectCheck,
  has, healAmount, income, isExplored, levelUpCost, outpostCheck, score, supportedUnits, trainCheck, unitAt, unitById,
  unitCost, unitLimit, upgradeCheck, canSeeUnit, territoryOwner, MAX_FUEL, isWonder, wonderCheck, wonderKindOf, factionVictoryOn, hasTech, victoryTechOf, hitChanceOn, hitOdds, unitHitProfile, unitRace, isWonderStructure, attackTargets, canOrderlyRetreat, retreatCheck, retreatDamage, repairCheck, repairAmount, cultFrenzy, alienHealBlocked, rocketTargets, rocketsLeft, persuadeCheck, persuadeCost, persuadeTargets, type CombatPreview,
  supplyLines, turretAt, turretTargets, turretPreview, missionById, movedThisTurn, moveFireBonus, moveFireMult, homeDefenseAt, canAttackNow, memorialAt, memorialEffect, memorialMult,
  blessingOf, blessingRoundsLeft, judgementAt, usesSites, siteOf, shipUpgradeCost, isProductionSite, builtInSite,
  emplacementBlock, emplacementLimit, emplacementTargets, emplacementsOf, isEmplacementBuilder,
  type GameState, type Unit,
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
import { shipSheet, workAction } from './mothership';
import { droppedPlansTag, plansAction, plansUnitTag, templeSheet } from './temple';
import { SITE_ICON, buildLockReason, citySitesHtml, siteDescVars, trainLockReason } from './production';

/** Langes Druecken auf eine Aktion zeigt ihre Erklaerung (ms) / long-press on an action shows its explanation (ms) */
const HINT_PRESS_MS = 450;

const CITY_UPGRADE_ICON: Record<CityUpgradeId, string> = { radioTower: 'range', bunker: 'shield', barracks: 'helmet', hospital: 'heal', flak: 'attack', depot: 'star', satRelay: 'satellite' };
const WEATHER_ICON: Record<string, string> = { clear: 'sun', rain: 'rain', snow: 'snow', wind: 'wind', dust: 'storm', meteor: 'lightning', acid: 'rain', quake: 'warning', calm: 'sun' };
export const UNIT_ICON: Record<string, string> = {
  infantry: 'helmet', sniper: 'range', jeep: 'move', pioneer: 'outpost', mg: 'attack', medic: 'heal', artillery: 'lightning',
  spy: 'eye', heli: 'fuel', tank: 'shield', landingBoat: 'boot', submarine: 'eye', destroyer: 'sword', battleship: 'crown',
  grey: 'lightning', terraformer: 'build', skimmer: 'move', mech: 'shield', tripod: 'range',
  zealot: 'boot', torchbearer: 'lightning', prophet: 'heal', doomBuggy: 'move', rocketCart: 'range', doomCrawler: 'shield',
  android: 'boot', spider: 'sword', quadDrone: 'move', railgun: 'range', titan: 'crown',
  antiTank: 'attack', antiAir: 'range', mineLayer: 'warning', faustZealot: 'attack', flakDrone: 'range',
  steppeRider: 'horse', stormbreaker: 'hammer', peacekeeper: 'shield', privateer: 'sail', protoWalker: 'walker',
  // Velkar-Bauarten / Velkar designs
  teslaTank: 'tesla', octocopter: 'fuel', railSniper: 'range',
  // Alvenia-Bauarten / Alvenia designs
  lightWarden: 'range', reliquary: 'emblemHalo', sunLance: 'sun',
  // Wunder der Siegbedingungen / victory wonders
  portal: 'trophy', hackRelay: 'tesla', fusionPlant: 'lightning', waal: 'crown', coreDrill: 'warning',
};
const COUNTER_KEY: Record<CounterClass, string> = { vehicle: 'counter.vsVehicle', air: 'counter.vsAir', foot: 'counter.vsFoot' };

/** Konter-Boni als Text, z. B. "+150 % gegen Fahrzeuge" / counter bonuses as text */
export function counterTags(type: UnitTypeId): { text: string; good: boolean }[] {
  const bonus = UNITS[type].bonusVs;
  if (!bonus) return [];
  return (Object.entries(bonus) as [CounterClass, number][]).map(([cls, f]) => {
    const pct = Math.round((f - 1) * 100);
    return { text: t(COUNTER_KEY[cls], { pct: pct > 0 ? `+${pct}` : `${pct}` }), good: pct > 0 };
  });
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
  const f = s.factions[u.owner]?.id;
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
function combatNotes(s: GameState, p: { moveFire: boolean; homeDefense?: number; judgement?: number; blessing?: number; memorial?: number }, u: Unit, target: Unit | null): string {
  return [hitProfileHint(s, u), stationaryOnly(u.type) ? t('stationary.tag') : '', p.moveFire ? moveFireHint(s, u) : '',
    // Strafgericht gegen Suender, Segen des Ziels / judgement against sinners, blessing of the target
    p.judgement ? t('sin.judgement', { pct: Math.round(p.judgement * 100) }) : '',
    target && p.homeDefense ? homeDefenseHint(s, target) : '',
    p.blessing ? t('blessing.hint', { pct: Math.round(p.blessing * 100) }) : '',
    p.memorial && p.memorial !== 1 ? memorialHint(s, u) : ''].filter(Boolean).join(' · ');
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
  if (u.owner !== s.current || !movedThisTurn(u) || !canAttackNow(u)) return '';
  const tip = t('moveFire.tagDesc', { pct: Math.round(moveFireMult(s, u) * 100) });
  return `<span class="stat tag warn" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('warning', 'icon-sm')}${esc(moveFireHint(s, u, 'tag'))}</span>`;
}

/** Kampfmarken im Einheitenfeld (immer sichtbar, auch auf dem Handy) / combat tags in the unit panel (always visible, also on phones) */
function combatTags(s: GameState, u: Unit): string {
  const tags = moveFireTag(s, u) + stationaryTag(s, u) + homeDefenseTag(s, u) + blessingTag(s, u) + memorialTag(s, u) + sinTag(s, u.owner);
  return tags ? `<div class="row">${tags}</div>` : '';
}

/** Kurzwerte eines Einheitentyps fuer die Hinweiszeile / short stats of a unit type for the hint line */
function unitStatsLine(type: UnitTypeId): string {
  const st = UNITS[type];
  const abil = st.abilities.filter((a) => a !== 'carry').map((a) => t(`abilities.${a}`));
  return [`${t('stats.attack')} ${num(st.attack)}`, `${t('stats.defense')} ${num(st.defense)}`, `${t('stats.move')} ${num(st.move)}`, `${t('stats.range')} ${st.range ? num(st.range) : t('stats.noRange')}`, ...abil].join(' · ');
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
  const note = race === 'cult' && cultFrenzy(u, race) ? ` · ${t('hit.frenzy')}` : race === 'robot' && u.hp < u.maxHp ? ` · ${t('hit.worn')}` : '';
  const ready = canOrderlyRetreat(u) && (u.retreatReady ?? 0) > s.round ? ` · ${t('retreat.cooldown', { n: (u.retreatReady ?? 0) - s.round })}` : '';
  return `<span class="stat ${note ? 'tag warn' : ''}" title="${esc(tip)}">${icon('dice', 'icon-sm')}${esc(t(`hit.race.${race}`) + note + ready)}</span>`;
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
    const actOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('.action[data-act]');
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
  }

  private clearPress() {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  /** Text der Hinweiszeile / text of the hint line */
  private hintHtml(): string {
    const a = this.hintId ? this.actions.find((x) => x.id === this.hintId) : undefined;
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
    const a = this.actions.find((x) => x.id === id);
    n.innerHTML = this.hintHtml();
    n.classList.toggle('blocked', !!a && !a.enabled);
    if (flash) { n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); }
  }

  /** Aktuelle Aktionen (auch fuer XR-Panels) / current actions (also for XR panels) */
  currentActions(): ActionItem[] {
    // XR zeigt keine Zweitzeile: Vorschau wieder in den Namen / XR shows no second line: put the preview back into the label
    return this.actions.map((a) => (a.id === 'attack' || a.id === 'rocket') && a.sub ? { ...a, label: `${a.label}: ${a.sub}` } : a);
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
      const a = this.actions.find((x) => x.id === act.dataset.act);
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
      case 'details': this.cb.openDetails(); break;
      case 'sheet-more': this.expanded = !this.expanded; this.render(); break;
      case 'hint': this.hintOpen = !this.hintOpen; btn.classList.toggle('open', this.hintOpen); btn.setAttribute('aria-expanded', String(this.hintOpen)); break;
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
    this.top.innerHTML = `
      <button type="button" class="faction-btn" data-action="faction" aria-label="${esc(t('leaders.title'))}: ${esc(t(`factions.${f.id}.name`))}">${leaderPortrait(f.id, 'xs')}${factionChip(f.id, t(`factions.${f.id}.short`))}</button>
      ${resource('medal', score(s, viewerIdx), t('hud.points'), t('hud.points'))}
      ${resource('star', f.stars, up > 0 ? t('hud.perRoundUpkeep', { n: inc, up, net: netTxt }) : t('hud.perRound', { n: inc }), t('hud.stars'),
        `<span class="net ${net < 0 ? 'neg' : ''}" aria-hidden="true">${esc(netTxt)}</span>`)}
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
    this.combatNote = '';
    this.portraitFor = null;
    const prevKey = this.hintKey;
    const prevScroll = this.bottom.querySelector<HTMLElement>('.action-bar')?.scrollLeft ?? 0;
    let sheet = '';
    if (g.orbitalMode && g.isHumanTurn) { const o = orbitalSheet(s, g, (c) => this.err(c)); sheet = o.html; this.actions = o.actions; }
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
      const fid = s.factions[vUnit.owner].id;
      const st = UNITS[vUnit.type];
      // 3D-Portraet statt Symbol / 3D portrait instead of an icon
      this.portraitFor = { type: vUnit.type, faction: fid, carried: vUnit.carried };
      head = `<span class="unit-badge unit-portrait" data-portrait style="--portrait-rim:var(--faction-${fid}-primary)">${icon(UNIT_ICON[vUnit.type] ?? 'helmet')}</span><div class="grow"><h3 class="display" title="${esc(unitName(vUnit))}">${esc(unitDisplayName(s, vUnit))}</h3>
        <div class="muted unit-sub"><span class="unit-type">${esc(unitName(vUnit))}</span> · ${esc(t(`factions.${fid}.short`))}${vUnit.veteran ? ` · ${esc(t('stats.veteran'))}` : ''}</div></div>`;
      body += `<div class="row">${icon('hp', 'icon-sm')}<span>${vUnit.hp} / ${vUnit.maxHp}</span><div class="grow">${progress(vUnit.hp, vUnit.maxHp, `hp ${vUnit.hp / vUnit.maxHp < 0.35 ? 'low' : ''}`, t('stats.hp'))}</div></div>${combatTags(s, vUnit)}${plansUnitTag(s, vUnit)}
        <div class="sheet-more"><div class="stats">
          <span class="stat">${icon('sword', 'icon-sm')}${esc(t('stats.attack'))} ${num(st.attack)}</span>
          <span class="stat">${icon('shield', 'icon-sm')}${esc(t('stats.defense'))} ${num(st.defense)}</span>
          <span class="stat">${icon('boot', 'icon-sm')}${esc(t('stats.move'))} ${num(st.move)}</span>
          <span class="stat">${icon('range', 'icon-sm')}${esc(t('stats.range'))} ${st.range ? num(st.range) : esc(t('stats.noRange'))}</span>
          ${vUnit.fuel !== null ? `<span class="stat ${vUnit.fuel <= 1 ? 'tag warn' : ''}">${icon('fuel', 'icon-sm')}${esc(t('hud.fuelLeft', { n: vUnit.fuel }))} / ${MAX_FUEL}</span>` : ''}
          ${vUnit.slowed || vUnit.slowedNext ? `<span class="stat tag warn">${icon('warning', 'icon-sm')}${esc(t('hud.slowed'))}</span>` : ''}
          ${(() => { const paid = paidUnits(s, vUnit.owner).some((p) => p.id === vUnit.id); return `<span class="stat ${paid ? '' : 'muted'}" title="${esc(t('hud.upkeepRule', { free: UPKEEP.freeUnits, pct: Math.round(UPKEEP.share * 100), tank: UPKEEP.flat.tank ?? 0 }))}">${icon('star', 'icon-sm')}${esc(paid ? t('hud.upkeepUnit', { n: unitUpkeep(vUnit) }) : isCultFaction(s, vUnit.owner) ? t('cult.noUpkeep') : t('hud.upkeepFree'))}</span>`; })()}
          ${vUnit.kills ? `<span class="stat">${icon('medal', 'icon-sm')}${esc(t('stats.kills'))} ${vUnit.kills}</span>` : ''}
          ${accuracyStat(s, vUnit)}
          ${ROCKETS.units.includes(vUnit.type) ? `<span class="stat ${rocketsLeft(vUnit) === 0 ? 'tag warn' : ''}" title="${esc(t('rockets.desc'))}">${icon('lightning', 'icon-sm')}${esc(t('rockets.left', { n: rocketsLeft(vUnit), max: ROCKETS.max }))}</span>` : ''}
        </div>
        <div class="row">${st.abilities.filter((a) => a !== 'carry').map((a) => `<span class="tag" title="${esc(t(`abilities.${a}Desc`))}">${esc(t(`abilities.${a}`))}</span>`).join('')}${counterTags(vUnit.type).map((c) => `<span class="tag ${c.good ? '' : 'warn'}" title="${esc(t('counter.hint'))}">${esc(c.text)}</span>`).join('')}</div></div>`;
      // Wunder: Phase, Restrunden, Unterbrechungsregel (immer sichtbar) / wonder: phase, rounds left, interruption rule (always visible)
      if (isWonder(vUnit)) body += wonderPanel(s, vUnit);
      if (myTurn && vUnit.owner === s.current) this.unitActions(s, vUnit);
    } else if ((tab === 'city' || (tab === 'unit' && !vUnit)) && city) {
      const name = cityName(s, city.id);
      if (city.owner === null) {
        head = `<span class="unit-badge">${icon('capture')}</span><div class="grow"><h3 class="display">${esc(name)}</h3><div class="muted">${esc(t(city.tower ? 'tower.neutral' : supplyLines(s) ? 'cavern.neutralLine' : isDesert(s) ? 'desert.neutralOutpost' : isAlienWorld(s) ? 'burrow.neutral' : 'features.village'))}</div></div>`;
        if (city.tower) body += `<p class="muted sheet-more">${esc(t('tower.desc', { n: TOWER.income, max: TOWER.unitLimit }))}</p>`;
        body += lootTag(s, viewer, city);
      } else if (isCultFaction(s, city.owner)) {
        // Kult-Stadt: keine Wirtschaft, nur Plaetze fuer die Horde / cult city: no economy, only slots for the horde
        const fid = s.factions[city.owner].id;
        const shrine = cityTiles(s, city).some((p) => s.tiles[p.y * s.size + p.x].building === 'shrine');
        const own = city.isHQ && city.hqOf === city.owner;
        head = `${factionBadge(fid, 'city')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>
          <div class="muted unit-sub">${esc(t('cult.city'))} · ${esc(t('hud.level', { n: city.level }))} · ${esc(t(`factions.${fid}.short`))}${own ? ` · ${esc(t('hud.hq'))}` : ''}</div></div>`;
        body += `<div class="row"><span class="stat">${icon('helmet', 'icon-sm')}${esc(t('cult.slots', { n: cultSlots(s, city) }))}</span>
          <span class="stat">${icon('people', 'icon-sm')}${esc(t('cult.horde', { n: cultUnits(s, city.owner).length, max: cultCap(s, city.owner) }))}</span>
          ${own ? `<span class="tag">${esc(t('hud.hq'))} +${CULT.hqSlots}</span>` : ''}${shrine ? `<span class="tag">${esc(t('buildings.shrine'))} +${CULT.shrineSlots}</span>` : ''}</div>
          <p class="muted sheet-more">${esc(t('cult.cityDesc', { n: city.level + CITY.unitLimitExtra, hq: CULT.hqSlots, shrine: CULT.shrineSlots }))}</p>`;
        body += lootTag(s, viewer, city);
        this.cityNote = '';
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
          <div class="muted unit-sub">${isDesert(s) ? `${esc(t('desert.outpost'))} · ` : isAlienWorld(s) ? `${esc(t(fid === 'zyrr' ? 'burrow.zyrr' : 'burrow.own'))} · ` : ''}${esc(t('hud.level', { n: city.level }))} · ${esc(t(`factions.${fid}.short`))}${city.isHQ && city.hqOf === city.owner ? ` · ${esc(t('hud.hq'))}` : ''}</div></div>`;
        body += `<div class="row">${icon('people', 'icon-sm')}<span>${esc(t('hud.population', { pop: city.pop, need }))}</span><div class="grow">${progress(city.pop, need, '', t('hud.population', { pop: city.pop, need }))}</div></div>
          <div class="sheet-more"><div class="stats"><span class="stat">${icon('helmet', 'icon-sm')}${esc(t('hud.units', { n: supportedUnits(s, city), max: unitLimit(s, city) }))}</span>
          <span class="stat">${icon('star', 'icon-sm')}${esc(t('hud.income'))} +${cityIncome(s, city)}</span>
          ${city.factory ? `<span class="tag">${esc(t('rewards.factory'))}</span>` : ''}${city.bunkerRing ? `<span class="tag">${esc(t('rewards.bunkerRing'))}</span>` : ''}
          ${city.govQuarter ? `<span class="tag">${esc(t('rewards.govQuarter'))}</span>` : ''}</div>
          <div class="slots" aria-label="${esc(t('cityUpgrades.title'))}"><span class="muted">${esc(t('cityUpgrades.title'))}</span>
          ${Array.from({ length: CITY_UPGRADES.slots }, (_, i) => { const up = cityUpgrades(city)[i]; return up
            ? `<span class="slot filled" title="${esc(t(`cityUpgrades.${up}Desc`, orbitalVars()))}">${icon(CITY_UPGRADE_ICON[up], 'icon-sm')}${esc(t(`cityUpgrades.${up}`))}</span>`
            : `<span class="slot empty">${esc(t('cityUpgrades.empty'))}</span>`; }).join('')}${city.noIncomeNext ? `<span class="tag warn">${esc(t('hud.noIncomeNext'))}</span>` : ''}</div></div>`;
        // Produktionsstaetten der Stadt (Menschen), immer sichtbar / the city's production sites (humans), always visible
        body += citySitesHtml(s, city);
        // Kult: Beute dieser Stadt; NEXUS: Rechenleistung / cult: loot of this city; NEXUS: compute
        body += lootTag(s, viewer, city);
        if (isRobotFaction(s, city.owner)) {
          const cs = computeStats(s, city.owner);
          body += `<p class="muted">${icon('lightning', 'icon-sm')} ${esc(t(cs.depotNodes ? 'nexus.computeStateDepot' : 'nexus.computeState', { have: cs.compute, dc: cs.dataCenters, pp: cs.powerPlants, dn: cs.depotNodes }))}</p>`;
        }
        this.cityNote = '';
        if (myTurn && city.owner === s.current) this.cityActions(s, city.id);
        if (this.cityNote) body += `<p class="muted">${icon('research', 'icon-sm')} ${esc(this.cityNote)}</p>`;
      }
    } else if (explored && tile.feature === 'mothership') {
      // Kampagne m2: Mutterschiff mit Arbeitsfortschritt / campaign m2: mothership with the work progress
      ({ head, body } = shipSheet(s, viewer));
    } else if (explored && templeSheet(s, x, y)) {
      // Fanatiker-Tempel (m4) / Fanatic temple (m4)
      const ts = templeSheet(s, x, y)!;
      head = ts.head;
      body += ts.body;
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
    }
    const tabsAvail = [vUnit && explored ? 'unit' : '', city && explored ? 'city' : '', 'tile'].filter(Boolean);
    const switcher = tabsAvail.length > 1 ? `<div class="seg tabs" role="tablist">${tabsAvail.map((k) => `<button type="button" role="tab" data-action="tab-${k}" aria-pressed="${k === tab || (k === 'city' && tab === 'unit' && !vUnit)}">${esc(t(k === 'city' && supplyLines(s) ? 'actions.shaftActions' : `actions.${k}Actions`))}</button>`).join('')}</div>` : '';
    // Aktionsleiste mit Scroll-Hinweis und einzeiliger Erklaerung darunter / action bar with scroll cue and a one-line explanation below
    const blocked = this.hintId ? this.actions.find((a) => a.id === this.hintId)?.enabled === false : false;
    const actionsHtml = this.actions.length ? `<div class="action-wrap"><div class="action-bar" role="toolbar">${this.actions.map(actionButton).join('')}</div>
      <button type="button" class="action-more" data-action="actionsMore" aria-label="${esc(t('hud.moreActions'))}" title="${esc(t('hud.moreActions'))}" hidden>${icon('next', 'icon-sm')}</button></div>
      <button type="button" class="action-hint ${this.hintOpen ? 'open' : ''} ${blocked ? 'blocked' : ''}" data-action="hint" aria-expanded="${this.hintOpen}" aria-live="polite" title="${esc(t('hud.hintExpand'))}">${this.hintHtml()}</button>` : '';
    // Handy: Zusatzwerte eingeklappt, Knopf klappt sie auf / phone: extra values collapsed, a button expands them
    const more = body.includes('sheet-more')
      ? `<button type="button" class="icon-btn sheet-toggle" data-action="sheet-more" aria-expanded="${this.expanded}" aria-label="${esc(t(this.expanded ? 'hud.lessInfo' : 'hud.moreInfo'))}" title="${esc(t(this.expanded ? 'hud.lessInfo' : 'hud.moreInfo'))}">${icon(this.expanded ? 'chevronDown' : 'chevronUp')}</button>` : '';
    return `<div class="sheet-head">${head}${more}${iconButton('info', t('actions.details'), 'details')}${iconButton('close', t('actions.close'), 'deselect')}</div>${body}${switcher}${actionsHtml}`;
  }

  private unitActions(s: GameState, u: Unit) {
    const g = this.game;
    const gunAt = g.pendingTurret;
    if (gunAt && turretTargets(s, u).some((p) => p.x === gunAt.x && p.y === gunAt.y)) {
      const gun = turretAt(s, gunAt.x, gunAt.y)!;
      const pre = turretPreview(s, u, gunAt);
      const kill = pre.toTurret >= gun.hp;
      // Geschuetzstellung: eigener Name und Text / gun emplacement: own name and text
      const owned = gun.owner !== undefined;
      const sub = kill ? t(owned ? 'emplacement.previewKill' : 'verdan.previewKill') : t('verdan.preview', { dmg: pre.toTurret, ret: pre.ret(gun.hp - pre.toTurret) });
      const about = owned ? `${emplacementName(s, gun.owner!)}: ${emplacementStats(gun.hp)}` : t('verdan.desc', { wake: VERDAN.wakeRange, range: VERDAN.range });
      if (pre.moveFire) this.combatNote = moveFireHint(s, u);
      this.actions.push({
        id: 'attackTurret', icon: 'attack', variant: 'danger', enabled: true, label: t(owned ? 'emplacement.attack' : 'verdan.attack'), sub, desc: `${sub}${pre.moveFire ? `. ${moveFireHint(s, u)}` : ''}. ${about}`,
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
            const retreatNotes = combatNotes(s, { moveFire: movedThisTurn(u), homeDefense: homeDefenseAt(s, target), judgement: judgementAt(s, u, target), blessing: blessingOf(s, target), memorial: memorialMult(s, u) }, u, target);
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
            desc: wonder ? victoryGoalText(s.factions[u.owner].id, s) : unitStatsLine(type), enabled: !!spot,
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
      const ok = emplacementTargets(s, u).length > 0;
      const block = emplacementBlock(s, u);
      const count = emplacementCount(s, u.owner);
      const reason = ok ? `${t('emplacement.hint')} ${count}.`
        : block === 'emplacementLimit' ? t('emplacement.limitReason', { n: emplacementsOf(s, u.owner).length, max: emplacementLimit(s, u.owner) })
        : block === 'emplacementSpacing' ? t('emplacement.spacingReason', { n: EMPLACEMENT.minSpacing })
        : block === 'notInTerritory' ? t('emplacement.territoryReason') : this.err(block === 'occupied' ? 'invalidTile' : block);
      this.actions.push({ id: 'emplacement', icon: 'range', label: g.emplacementMode ? t('actions.cancel') : t('emplacement.build'), sub: g.emplacementMode ? undefined : count,
        cost: g.emplacementMode ? undefined : EMPLACEMENT.cost, variant: 'primary', enabled: ok || g.emplacementMode, reason, desc: `${reason} ${emplacementDesc(s, u.owner)}`,
        run: () => { if (g.emplacementMode) { g.emplacementMode = false; g.updateHighlights(); this.render(); } else { g.startEmplacement(); g.ui.toast(t('emplacement.hint'), 'range'); } } });
    }
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
        reason: noTargets ? t('cityUpgrades.noTargets') : chk === 'ok' ? t(`cityUpgrades.${up}Desc`, orbitalVars()) : chk === 'noSlot' ? t('cityUpgrades.full') : this.err(chk),
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
    // Kult bildet nicht aus, auch den Erdkernbohrer nicht (der Prophet ruft ihn) / the cult does not train, not even the earth-core drill (the prophet calls it up)
    if (isCultFaction(s, c.owner!)) return;
    // Menschen: gesperrte Einheiten (Produktionsstaette fehlt) mit Grund hinter den verfuegbaren / humans: locked units (site missing) with a reason after the available ones
    const locked: ActionItem[] = [];
    for (const type of rosterUnits(s, c.owner!)) {
      const st = UNITS[type];
      if (st.cost === null) continue;
      if (st.tech && !s.factions[c.owner!].techs.includes(st.tech)) continue;
      const chk = trainCheck(s, c, type);
      const item: ActionItem = {
        id: `train-${type}`, icon: UNIT_ICON[type], label: t(`units.${type}`), sub: unitNickname(s.factions[c.owner!].id, type), cost: unitCost(s, c.owner!, type)!,
        desc: unitStatsLine(type),
        enabled: chk === 'ok', reason: chk === 'ok' ? undefined : chk === 'computeMissing' ? t('nexus.computeNeed', { n: st.compute ?? 0 }) : chk === 'buildingMissing' ? trainLockReason(s, c, type) : this.err(chk),
        run: () => void g.exec({ type: 'train', city: c.id, unitType: type }),
      };
      (chk === 'buildingMissing' ? locked : this.actions).push(item);
    }
    this.actions.push(...locked);
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
