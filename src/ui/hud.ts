/**
 * Spieloberflaeche: schmale Statusleiste oben, Kartensteuerung, Aktionsleiste im Daumenbereich.
 * Game HUD: slim status bar on top, map controls, action bar in the thumb zone.
 */
import {
  CULT_UNITS, XENO, BARRIER, CITY_UPGRADES, CITY_UPGRADE_IDS, WEATHER, BUILDINGS, type CityUpgradeId, GRAND_PROJECT_IDS, INFANTRY_TYPES, SHIP_UPGRADES, UNITS, type BuildingId,
} from '../data/balance';
import {
  neighbors, canResearch, computeStats, isCultFaction, isRobotFaction, recruitCheck, recruitSpot, rosterUnits,
  barrierCheck, barrierTargets, isAlienFaction, terraformCheck, terraformTargets, weather, weatherFor, cityUpgradeCheck, hasCityUpgrade, radioTargets, cityUpgrades, buildCheck, canActStill, canHeal, captureKind, cityAt, cityIncome, cityById, combatPreview, grandProjectCheck,
  has, healAmount, income, isExplored, levelUpCost, outpostCheck, score, supportedUnits, trainCheck, unitAt, unitById,
  unitCost, unitLimit, upgradeCheck, canSeeUnit, territoryOwner, MAX_FUEL,
  type GameState, type Unit,
} from '../core';
import type { Controller } from '../game/controller';
import { t, tList } from '../i18n/i18n';
import {
  actionButton, esc, factionBadge, factionChip, iconButton, price, progress, resource, type ActionItem,
} from './components';
import { icon } from './icons';

const CITY_UPGRADE_ICON: Record<CityUpgradeId, string> = { radioTower: 'range', bunker: 'shield', barracks: 'helmet', hospital: 'heal', flak: 'attack', depot: 'star' };
const WEATHER_ICON: Record<string, string> = { clear: 'sun', rain: 'rain', snow: 'snow', wind: 'wind' };
const UNIT_ICON: Record<string, string> = {
  infantry: 'helmet', sniper: 'range', jeep: 'move', pioneer: 'outpost', mg: 'attack', medic: 'heal', artillery: 'lightning',
  spy: 'eye', heli: 'fuel', tank: 'shield', landingBoat: 'boot', submarine: 'eye', destroyer: 'sword', battleship: 'crown',
  grey: 'lightning', terraformer: 'build', skimmer: 'move', mech: 'shield', tripod: 'range',
  zealot: 'boot', torchbearer: 'lightning', prophet: 'heal', doomBuggy: 'move', rocketCart: 'range', doomCrawler: 'shield',
  android: 'boot', spider: 'sword', quadDrone: 'move', railgun: 'range', titan: 'crown',
};
const BUILD_ICON: Partial<Record<BuildingId, string>> = { road: 'move', bridge: 'move', researchCenter: 'research', navalBase: 'boot', logisticsCenter: 'star', dataCenter: 'research', powerPlant: 'lightning', shrine: 'crown' };

export function unitName(u: Unit): string {
  return u.carried ? `${t(`units.${u.type}`)} (${t('stats.carrying', { unit: t(`units.${u.carried}`) })})` : t(`units.${u.type}`);
}
export function cityName(s: GameState, cityId: number): string {
  const c = cityById(s, cityId);
  const names = tList('cityNames');
  return c && names.length ? names[c.nameIndex % names.length] : '';
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
  /** offenes Rekrutier-Menue fuer diese Einheit / open recruit menu for this unit */
  private recruitFor: number | null = null;

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
  }

  /** Aktuelle Aktionen (auch fuer XR-Panels) / current actions (also for XR panels) */
  currentActions(): ActionItem[] { return this.actions; }

  show(on: boolean) {
    for (const n of [this.top, this.controls, this.banner, this.bottom]) n.hidden = !on;
  }

  private onClick(e: Event) {
    const target = e.target as HTMLElement;
    const act = target.closest<HTMLElement>('[data-act]');
    if (act && this.bottom.contains(act)) {
      const a = this.actions.find((x) => x.id === act.dataset.act);
      if (a) {
        if (!a.enabled) { this.game.play('error'); if (a.reason) this.game.ui.toast(a.reason, 'warning'); }
        else { this.game.play('click'); a.run(); }
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
        if (st && !canResearch(st, rf)) { this.game.ui.toast(t(isAlienFaction(st, rf) ? 'xeno.noResearch' : 'nexus.noResearch'), 'research'); break; }
        this.cb.openResearch(); break;
      }
      case 'diplomacy': this.cb.openDiplomacy(); break;
      case 'menu': this.cb.openMenu(); break;
      case 'grand': this.cb.openGrand(); break;
      case 'details': this.cb.openDetails(); break;
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

  render() {
    const g = this.game, s = g.state;
    if (!s) return;
    const viewerIdx = g.viewer >= 0 ? g.viewer : s.current;
    const f = s.factions[viewerIdx];
    const inc = income(s, viewerIdx);
    const limit = s.config.roundLimit;
    this.top.innerHTML = `
      ${factionChip(f.id, t(`factions.${f.id}.short`))}
      ${resource('medal', score(s, viewerIdx), '', t('hud.points'))}
      ${resource('star', f.stars, t('hud.perRound', { n: inc }), t('hud.stars'))}
      ${resource('hourglass', limit ? `${Math.min(s.round, limit)}/${limit}` : s.round, '', t('hud.round'))}
      ${this.weatherChip(s)}
      <span class="grow"></span>
      ${iconButton('menu', t('hud.menu'), 'menu')}`;
    this.controls.innerHTML = `
      ${iconButton('rotateLeft', t('hud.rotateLeft'), 'rotL')}
      ${iconButton('rotateRight', t('hud.rotateRight'), 'rotR')}
      ${iconButton('zoomIn', t('hud.zoomIn'), 'zoomIn')}
      ${iconButton('zoomOut', t('hud.zoomOut'), 'zoomOut')}
      ${iconButton('grand', t('hud.grandProjects'), 'grand')}`;
    const cur = s.factions[s.current];
    if (g.aiRunning && !s.over) {
      this.banner.hidden = false;
      this.banner.innerHTML = `${icon('hourglass')}<span>${esc(t('hud.aiThinking', { name: t(`factions.${cur.id}.short`) }))}</span>${iconButton('lightning', t('hud.speedUp'), 'speedUp')}`;
    } else this.banner.hidden = true;

    this.actions = [];
    let sheet = '';
    if (g.selected && !g.aiRunning) sheet = this.sheet(s, g.selected.x, g.selected.y);
    const humanTurn = g.isHumanTurn;
    this.bottom.innerHTML = `
      ${sheet ? `<section class="panel sheet" aria-label="${esc(t('actions.tileActions'))}">${sheet}</section>` : ''}
      <nav class="nav-bar">
        <button type="button" class="btn secondary" data-action="research">${icon('research')}<span>${esc(t('hud.research'))}</span></button>
        <button type="button" class="btn secondary" data-action="diplomacy">${icon('diplomacy')}<span>${esc(t('hud.diplomacy'))}</span></button>
        ${iconButton('next', t('hud.nextUnit'), 'nextUnit', { lg: true })}
        <button type="button" class="btn end" data-action="endTurn" ${humanTurn ? '' : 'disabled'}>${icon('endTurn')}<span>${esc(t('hud.endTurn'))}</span></button>
      </nav>`;
  }

  private weatherChip(s: GameState): string {
    const w = weather(s);
    if (s.config.weather === false) return '';
    const nextRound = (Math.floor((s.round - 1) / WEATHER.cycleRounds) + 1) * WEATHER.cycleRounds + 1;
    const next = weatherFor(s.config.seed, nextRound);
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
    let head = '', body = '';
    const myTurn = g.isHumanTurn;
    if (!explored) {
      head = `<h3 class="display">${esc(t('hud.unexplored'))}</h3>`;
    } else if (tab === 'unit' && vUnit) {
      const fid = s.factions[vUnit.owner].id;
      const st = UNITS[vUnit.type];
      head = `${factionBadge(fid, UNIT_ICON[vUnit.type])}<div class="grow"><h3 class="display">${esc(unitName(vUnit))}</h3>
        <div class="muted">${esc(t(`factions.${fid}.short`))}${vUnit.veteran ? ` · ${esc(t('stats.veteran'))}` : ''}</div></div>`;
      body += `<div class="row">${icon('hp', 'icon-sm')}<span>${vUnit.hp} / ${vUnit.maxHp}</span><div class="grow">${progress(vUnit.hp, vUnit.maxHp, `hp ${vUnit.hp / vUnit.maxHp < 0.35 ? 'low' : ''}`, t('stats.hp'))}</div></div>
        <div class="stats">
          <span class="stat">${icon('sword', 'icon-sm')}${esc(t('stats.attack'))} ${st.attack}</span>
          <span class="stat">${icon('shield', 'icon-sm')}${esc(t('stats.defense'))} ${st.defense}</span>
          <span class="stat">${icon('boot', 'icon-sm')}${esc(t('stats.move'))} ${st.move}</span>
          <span class="stat">${icon('range', 'icon-sm')}${esc(t('stats.range'))} ${st.range || esc(t('stats.noRange'))}</span>
          ${vUnit.fuel !== null ? `<span class="stat ${vUnit.fuel <= 1 ? 'tag warn' : ''}">${icon('fuel', 'icon-sm')}${esc(t('hud.fuelLeft', { n: vUnit.fuel }))} / ${MAX_FUEL}</span>` : ''}
          ${vUnit.slowed || vUnit.slowedNext ? `<span class="stat tag warn">${icon('warning', 'icon-sm')}${esc(t('hud.slowed'))}</span>` : ''}
          ${vUnit.kills ? `<span class="stat">${icon('medal', 'icon-sm')}${esc(t('stats.kills'))} ${vUnit.kills}</span>` : ''}
        </div>
        <div class="row">${st.abilities.filter((a) => a !== 'carry').map((a) => `<span class="tag" title="${esc(t(`abilities.${a}Desc`))}">${esc(t(`abilities.${a}`))}</span>`).join('')}</div>`;
      if (myTurn && vUnit.owner === s.current) this.unitActions(s, vUnit);
    } else if ((tab === 'city' || (tab === 'unit' && !vUnit)) && city) {
      const name = cityName(s, city.id);
      if (city.owner === null) {
        head = `<span class="unit-badge">${icon('capture')}</span><div class="grow"><h3 class="display">${esc(name)}</h3><div class="muted">${esc(t('features.village'))}</div></div>`;
      } else {
        const fid = s.factions[city.owner].id;
        const need = levelUpCost(s, city);
        head = `${factionBadge(fid, 'city')}<div class="grow"><h3 class="display">${esc(name)} · ${esc(t('hud.level', { n: city.level }))}</h3>
          <div class="muted">${esc(t(`factions.${fid}.short`))}${city.isHQ && city.hqOf === city.owner ? ` · ${esc(t('hud.hq'))}` : ''}</div></div>`;
        body += `<div class="row">${icon('people', 'icon-sm')}<span>${esc(t('hud.population', { pop: city.pop, need }))}</span><div class="grow">${progress(city.pop, need, '', t('hud.population', { pop: city.pop, need }))}</div></div>
          <div class="stats"><span class="stat">${icon('helmet', 'icon-sm')}${esc(t('hud.units', { n: supportedUnits(s, city), max: unitLimit(s, city) }))}</span>
          <span class="stat">${icon('star', 'icon-sm')}${esc(t('hud.income'))} +${cityIncome(s, city)}</span>
          ${city.factory ? `<span class="tag">${esc(t('rewards.factory'))}</span>` : ''}${city.bunkerRing ? `<span class="tag">${esc(t('rewards.bunkerRing'))}</span>` : ''}
          ${city.govQuarter ? `<span class="tag">${esc(t('rewards.govQuarter'))}</span>` : ''}</div>
          <div class="slots" aria-label="${esc(t('cityUpgrades.title'))}"><span class="muted">${esc(t('cityUpgrades.title'))}</span>
          ${Array.from({ length: CITY_UPGRADES.slots }, (_, i) => { const up = cityUpgrades(city)[i]; return up
            ? `<span class="slot filled" title="${esc(t(`cityUpgrades.${up}Desc`))}">${icon(CITY_UPGRADE_ICON[up], 'icon-sm')}${esc(t(`cityUpgrades.${up}`))}</span>`
            : `<span class="slot empty">${esc(t('cityUpgrades.empty'))}</span>`; }).join('')}${city.noIncomeNext ? `<span class="tag warn">${esc(t('hud.noIncomeNext'))}</span>` : ''}</div>`;
        // Kult und NEXUS: Hinweise / cult and NEXUS: hints
        if (isCultFaction(s, city.owner)) body += `<p class="muted">${esc(t('cult.cityHint'))}</p>`;
        if (isRobotFaction(s, city.owner)) {
          const cs = computeStats(s, city.owner);
          body += `<p class="muted">${icon('lightning', 'icon-sm')} ${esc(t('nexus.computeState', { have: cs.compute, dc: cs.dataCenters, pp: cs.powerPlants }))}</p>`;
        }
        if (myTurn && city.owner === s.current) this.cityActions(s, city.id);
      }
    } else {
      const owner = territoryOwner(s, tile);
      head = `<span class="unit-badge">${icon(tile.terrain === 'shallow' || tile.terrain === 'ocean' ? 'boot' : 'move')}</span><div class="grow"><h3 class="display">${esc(t(`terrain.${tile.terrain}`))}${tile.biome && tile.biome !== 'grassland' ? ` · ${esc(t(`biomes.${tile.biome}`))}` : ''}</h3>
        <div class="muted">${owner !== null ? esc(owner === viewer ? t('hud.ownTerritory') : t('hud.territoryOf', { name: t(`factions.${s.factions[owner].id}.short`) })) : esc(t('hud.neutral'))}</div></div>`;
      const tags: string[] = [];
      if (tile.resource) tags.push(t(`resources.${tile.resource}`));
      if (tile.building) tags.push(t(`buildings.${tile.building}`));
      if (tile.road) tags.push(t('features.road'));
      if (tile.river) tags.push(t('biomes.river'));
      if (tile.feature) tags.push(t(`features.${tile.feature}`));
      if (tile.outpost) tags.push(`${t('features.outpost')} (${t(`factions.${s.factions[tile.outpost.owner].id}.short`)})`);
      if (tile.grandProject) tags.push(t(`grand.${tile.grandProject}`));
      if (tile.barrier) tags.push(`${t('features.barrier')} (${t(`factions.${s.factions[tile.barrier.owner].id}.short`)})`);
      if (tile.remains?.kind === 'wreck') tags.push(`${t('features.wreck')} (${t(`units.${tile.remains.unit}`)}): ${t('features.wreckCover')}`);
      const bones = tile.remains ? tile.remains.skeletons ?? (tile.remains.kind === 'skeleton' ? 1 : 0) : 0;
      if (bones) tags.push(t('features.skeleton', { n: bones }));
      body += `<div class="row">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>`;
      if (tile.xeno) tags.push(`${t('xeno.ground')}: ${t('xeno.groundDesc')}`);
      if (myTurn && owner === s.current) this.buildActions(s, x, y);
    }
    const tabsAvail = [vUnit && explored ? 'unit' : '', city && explored ? 'city' : '', 'tile'].filter(Boolean);
    const switcher = tabsAvail.length > 1 ? `<div class="seg tabs" role="tablist">${tabsAvail.map((k) => `<button type="button" role="tab" data-action="tab-${k}" aria-pressed="${k === tab || (k === 'city' && tab === 'unit' && !vUnit)}">${esc(t(`actions.${k}Actions`))}</button>`).join('')}</div>` : '';
    const actionsHtml = this.actions.length ? `<div class="action-bar" role="toolbar">${this.actions.map(actionButton).join('')}</div>` : '';
    return `<div class="sheet-head">${head}${iconButton('info', t('actions.details'), 'details')}${iconButton('close', t('actions.close'), 'deselect')}</div>${body}${switcher}${actionsHtml}`;
  }

  private unitActions(s: GameState, u: Unit) {
    const g = this.game;
    const errText = (code: string) => t(`errors.${code}`);
    if (g.pendingTarget !== null) {
      const target = unitById(s, g.pendingTarget);
      if (target) {
        const p = combatPreview(s, u, target);
        this.actions.push({
          id: 'attack', icon: 'attack', variant: 'danger', enabled: true,
          label: `${t('actions.attack')}: ${p.kills ? t('actions.previewKill') : t('actions.preview', { dmg: p.toDefender, ret: p.toAttacker })}`,
          run: () => void g.exec({ type: 'attack', unit: u.id, target: target.id }),
        });
      }
    }
    const cap = captureKind(s, u);
    if (cap) this.actions.push({ id: 'capture', icon: 'capture', label: t('actions.capture'), variant: 'primary', enabled: true, run: () => void g.exec({ type: 'capture', unit: u.id }) });
    if (u.hp < u.maxHp) {
      const ok = canHeal(u);
      this.actions.push({ id: 'heal', icon: 'heal', label: `${t('actions.heal')} +${Math.min(healAmount(s, u), u.maxHp - u.hp)}`, enabled: ok, reason: ok ? undefined : errText('unitExhausted'), run: () => void g.exec({ type: 'heal', unit: u.id }) });
    }
    if (has(u, 'heal')) {
      const ok = canActStill(u);
      this.actions.push({ id: 'medicHeal', icon: 'heal', label: t('actions.medicHeal'), enabled: ok, reason: ok ? undefined : errText('unitExhausted'), run: () => void g.exec({ type: 'medicHeal', unit: u.id }) });
    }
    if (has(u, 'preach') && isCultFaction(s, u.owner)) {
      // Rekrutieren: Menue mit allen verfuegbaren Kult-Einheiten / recruit: menu of all available cult units
      if (this.recruitFor === u.id) {
        this.actions.push({ id: 'recruit-cancel', icon: 'close', label: t('actions.cancel'), enabled: true, run: () => { this.recruitFor = null; this.render(); } });
        for (const type of CULT_UNITS) {
          const st = UNITS[type];
          if (st.tech && !s.factions[u.owner].techs.includes(st.tech)) continue;
          const spot = recruitSpot(s, u, type);
          const chk = spot ? 'ok' : neighbors(s.size, u.x, u.y).map((q) => recruitCheck(s, u.owner, u.id, type, q.x, q.y)).find((r) => r !== 'occupied' && r !== 'invalidTile' && r !== 'outOfRange') ?? 'noSpace';
          this.actions.push({ id: `recruit-${type}`, icon: UNIT_ICON[type], label: t(`units.${type}`), cost: unitCost(s, u.owner, type)!, enabled: !!spot,
            reason: spot ? t('cult.recruitHint') : chk === 'noSpace' ? t('cult.noSpace') : t(`errors.${chk}`),
            run: () => { this.recruitFor = null; if (spot) void g.exec({ type: 'recruit', unit: u.id, unitType: type, x: spot.x, y: spot.y }); } });
        }
      } else {
        const can = !u.fresh && !u.exhausted && !u.attacked;
        this.actions.push({ id: 'recruit', icon: 'people', label: t('cult.recruit'), variant: 'primary', enabled: can,
          reason: can ? t('abilities.preachDesc') : t('errors.unitExhausted'), run: () => { this.recruitFor = u.id; this.render(); } });
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
      const reason = ok ? t('actions.barrierHint') : t(`errors.${base === 'cannotCapture' ? 'unitExhausted' : base === 'ok' || base === 'occupied' || base === 'outOfRange' ? 'invalidTile' : base}`);
      this.actions.push({ id: 'barrier', icon: 'shield', label: g.barrierMode ? t('actions.cancel') : t('actions.barrier'), cost: g.barrierMode ? undefined : BARRIER.cost, enabled: ok || g.barrierMode, reason,
        run: () => { if (g.barrierMode) { g.barrierMode = false; g.updateHighlights(); this.render(); } else { g.startBarrier(); g.ui.toast(t('actions.barrierHint'), 'shield'); } } });
    }
    if (INFANTRY_TYPES.includes(u.type) && s.factions[u.owner].techs.includes('fortification')) {
      const chk = outpostCheck(s, u);
      this.actions.push({ id: 'outpost', icon: 'outpost', label: t('actions.outpost'), cost: 25, enabled: chk === 'ok', reason: chk === 'ok' ? undefined : errText(chk === 'cannotCapture' ? 'unitExhausted' : chk), run: () => void g.exec({ type: 'outpost', unit: u.id }) });
    }
    if (UNITS[u.type].ship) {
      for (const to of SHIP_UPGRADES) {
        if (to === u.type) continue;
        const tech = UNITS[to].tech;
        if (tech && !s.factions[u.owner].techs.includes(tech)) continue;
        const chk = upgradeCheck(s, u, to);
        this.actions.push({ id: `up-${to}`, icon: 'upgrade', label: t('actions.upgrade', { unit: t(`units.${to}`) }), cost: UNITS[to].cost ?? 0, enabled: chk === 'ok', reason: chk === 'ok' ? undefined : errText(chk), run: () => void g.exec({ type: 'upgrade', unit: u.id, to }) });
      }
    }
  }

  private cityActions(s: GameState, cityId: number) {
    const g = this.game;
    const c = cityById(s, cityId)!;
    // Ausbau-Slots / upgrade slots
    for (const up of CITY_UPGRADE_IDS) {
      if (hasCityUpgrade(c, up)) continue;
      const chk = cityUpgradeCheck(s, c.owner!, c, up);
      const radioActive = up === 'radioTower' && g.radioCity === c.id;
      const noTargets = up === 'radioTower' && radioTargets(s, c.owner!, c).length === 0;
      this.actions.push({
        id: `up-${up}`, icon: CITY_UPGRADE_ICON[up], label: radioActive ? t('actions.cancel') : t(`cityUpgrades.${up}`),
        cost: radioActive ? undefined : CITY_UPGRADES.cost[up], variant: 'primary',
        enabled: radioActive || (chk === 'ok' && !noTargets),
        reason: noTargets ? t('cityUpgrades.noTargets') : chk === 'ok' ? t(`cityUpgrades.${up}Desc`) : chk === 'noSlot' ? t('cityUpgrades.full') : t(`errors.${chk}`),
        run: () => {
          if (up !== 'radioTower') { void g.exec({ type: 'cityUpgrade', city: c.id, upgrade: up }); return; }
          if (radioActive) { g.radioCity = null; g.updateHighlights(); this.render(); return; }
          g.startRadio(c.id);
          g.ui.toast(t('cityUpgrades.radioHint'), 'range');
        },
      });
    }
    // Zyrr: erst das Stadtfeld terraformen / Zyrr: terraform the city tile first
    if (isAlienFaction(s, c.owner!) && !s.tiles[c.y * s.size + c.x].xeno) {
      const chk = terraformCheck(s, c.owner!, c.x, c.y);
      this.actions.push({ id: 'terraform-city', icon: 'build', label: t('xeno.terraform'), cost: XENO.terraformCost, variant: 'primary', enabled: chk === 'ok',
        reason: chk === 'ok' ? t('xeno.cityNeedsTerraform') : t(`errors.${chk}`), run: () => void g.exec({ type: 'terraform', x: c.x, y: c.y }) });
    }
    if (isCultFaction(s, c.owner!)) return;
    for (const type of rosterUnits(s, c.owner!)) {
      const st = UNITS[type];
      if (st.cost === null) continue;
      if (st.tech && !s.factions[c.owner!].techs.includes(st.tech)) continue;
      const chk = trainCheck(s, c, type);
      this.actions.push({
        id: `train-${type}`, icon: UNIT_ICON[type], label: t(`units.${type}`), cost: unitCost(s, c.owner!, type)!,
        enabled: chk === 'ok', reason: chk === 'ok' ? undefined : chk === 'computeMissing' ? t('nexus.computeNeed', { n: st.compute ?? 0 }) : t(`errors.${chk}`),
        run: () => void g.exec({ type: 'train', city: c.id, unitType: type }),
      });
    }
  }

  private buildActions(s: GameState, x: number, y: number) {
    const g = this.game;
    const f = s.current;
    if (isAlienFaction(s, f) && !s.tiles[y * s.size + x].xeno) {
      const chk = terraformCheck(s, f, x, y);
      if (chk === 'ok' || chk === 'notEnoughStars') this.actions.push({ id: 'terraform-tile', icon: 'build', label: t('xeno.terraform'), cost: XENO.terraformCost, variant: 'primary',
        enabled: chk === 'ok', reason: chk === 'ok' ? t('xeno.groundDesc') : t(`errors.${chk}`), run: () => void g.exec({ type: 'terraform', x, y }) });
    }
    for (const b of Object.keys(BUILDINGS) as BuildingId[]) {
      const chk = buildCheck(s, f, b, x, y);
      if (!chk.ok && chk.error !== 'notEnoughStars' && chk.error !== 'onePerCity') continue;
      this.actions.push({
        id: `build-${b}`, icon: BUILD_ICON[b] ?? 'build', label: t(`buildings.${b}`), cost: chk.cost, enabled: chk.ok,
        reason: chk.ok ? t(`buildingDesc.${b}`) : t(`errors.${chk.error}`),
        run: () => void g.exec({ type: 'build', building: b, x, y }),
      });
    }
    for (const id of GRAND_PROJECT_IDS) {
      if (!grandProjectCheck(s, f, id, x, y)) continue;
      this.actions.push({ id: `grand-${id}`, icon: 'grand', label: t(`grand.${id}`), cost: 0, enabled: true, variant: 'primary', run: () => void g.exec({ type: 'grandProject', id, x, y }) });
    }
  }
}

export { price };
