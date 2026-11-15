/**
 * Bildschirme und Dialoge: Hauptmenue, Partie einrichten, Forschungsbaum (radial), Diplomatie,
 * Grossprojekte, Belohnungen, Einstellungen, Mitwirkende, Uebergabe, Spielende.
 * Screens and dialogs.
 */
import {
  CITY_UPGRADES, CITY_UPGRADE_IDS, ECON, INCOME, ROSTERS, FACTION_IDS, GRAND_PROJECT_IDS, MAP_SIZES, MAP_TYPES, MODES, PLAYER_LIMITS, SANDBOX, START, TECHS, TECH_IDS, UNITS, VICTORY_TECH, VERDAN,
  type HazardLevel, type Difficulty, type FactionId, type GameMode, type MapSize, type MapType, type TechId,
} from '../data/balance';
import {
  cityById, embassyCost, grandProjectConditionMet, hqOf, inContact, isExplored, researchCost, rewardOptions, score, techState,
  techUnlocks, unitAt, cityAt, canSeeUnit, defaultConfig, hashSeed, canResearch, techVisible, unitCost, factionVictoryOn, supplyLines, isDesert, isAlienWorld, turretAt, type GameConfig, type GameState,
} from '../core';
import type { Controller } from '../game/controller';
import { getLanguage, locale, num, setLanguage, t } from '../i18n/i18n';
import type { Settings } from '../save/save';
import { button, dialogTitle, esc, factionBadge, factionChip, iconButton, openDialog, price, rerender, segmented } from './components';
import { emplacementDesc, emplacementName, emplacementStats } from './emplacement';
import { FACTION_EMBLEM, icon, iconAt } from './icons';
import { buildingDescText, cityName, unitDisplayName, unitName } from './hud';
import { mountStats, statsDialog, statsPanel } from './stats';
import { campaignScreen } from './campaign';
import { leaderPortrait } from './leaders';
import { openLore, openPrologue } from './lore';
import { detailsLink, factionDetails, traitChips } from './factionInfo';
import { gameOverDispatchHtml } from './dispatch';
import { victoryParams, victoryReasonHtml, victoryTrackerDialog } from './victory';
import { rulesDialog } from './rules';
import { factionIdOf, techIcon, techT } from './terms';
import { orbitalVars } from './orbital';
import { TUTORIAL_FACTION } from './tutorial';

export interface ScreenHost {
  root: HTMLElement;
  game: Controller;
  settings: Settings;
  applySettings(): void;
  startGame(cfg: GameConfig): void;
  continueGame(): void;
  loadFromFile(): void;
  exportGame(): void;
  saveNow(): void;
  hasSave(): boolean;
  /** Spielstand-Verwaltung / save slot manager */
  openSlots(mode: 'save' | 'load'): void;
  continueEndless(): void;
  startTutorial(): void;
  xr: { vr: boolean; ar: boolean; enter(mode: 'vr' | 'ar'): void };
  showMenu(): void;
  /** 3D-Szene anhalten, solange ein Vollbild-Dialog sie verdeckt / pause the 3D scene while a full-screen dialog covers it */
  pauseScene?(on: boolean): void;
}

function bind(node: HTMLElement, handlers: Record<string, (el: HTMLElement) => void>) {
  node.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (b && handlers[b.dataset.action!]) handlers[b.dataset.action!](b);
  });
}

/**
 * Intro "Die Menschheit im Sternfall" (src/intro, per dynamischem Import, damit es den Hauptteil nicht vergroessert).
 * Intro "Humanity in the Starfall" (src/intro, via dynamic import so it does not grow the main chunk).
 */
export function openIntro(host: ScreenHost, onClose?: () => void) {
  void import('../intro/player').then((m) => m.playIntro(host.root, {
    music: host.settings.music, effects: host.settings.effects, animations: host.settings.animations, pause: host.pauseScene, onClose,
  })).catch(() => onClose?.());
}

// ---------- Hauptmenue / main menu ----------
export function mainMenu(host: ScreenHost): HTMLElement {
  const n = document.createElement('div');
  n.className = 'screen';
  const render = () => {
    n.innerHTML = `
      <h1 class="logo">${esc(t('app.title'))}</h1>
      <div class="logo-sub">${esc(t('app.subtitle'))}</div>
      <div class="row">${FACTION_IDS.map((f) => factionBadge(f)).join('')}</div>
      <nav class="menu-list">
        ${host.hasSave() ? button(t('menu.continue'), { icon: 'play', action: 'continue', block: true }) : ''}
        ${button(t('menu.newGame'), { icon: 'plus', action: 'new', block: true, variant: host.hasSave() ? 'secondary' : 'primary' })}
        ${button(t('campaign.menu'), { icon: 'map', action: 'campaign', block: true, variant: 'secondary' })}
        ${button(t('saves.title'), { icon: 'folder', action: 'slots', block: true, variant: 'secondary' })}
        <div class="row">${button(t('menu.tutorial'), { icon: 'tutorial', action: 'tutorial', variant: 'secondary', cls: 'grow' })}${button(t('rules.menu'), { icon: 'help', action: 'rules', variant: 'secondary', cls: 'grow', title: t('menu.help') })}</div>
        <div class="row">${button(t('lore.menu'), { icon: 'book', action: 'story', variant: 'secondary', cls: 'grow' })}${button(t('intro.menu'), { icon: 'play', action: 'intro', variant: 'secondary', cls: 'grow' })}</div>
        ${button(t('menu.importFile'), { icon: 'upload', action: 'import', block: true, variant: 'secondary' })}
        <div class="row">${button(t('menu.settings'), { icon: 'settings', action: 'settings', variant: 'secondary', cls: 'grow' })}${button(t('menu.credits'), { icon: 'info', action: 'credits', variant: 'secondary', cls: 'grow' })}</div>
        ${segmented('lang', [{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }], getLanguage())}
      </nav>`;
  };
  render();
  bind(n, {
    continue: () => host.continueGame(),
    slots: () => host.openSlots('load'),
    // erster neuer Einsatz: Tutorial anbieten / first new game: offer the tutorial
    new: () => {
      if (host.settings.tutorialDone) { n.replaceWith(setupScreen(host)); return; }
      tutorialPrompt(host, () => n.replaceWith(setupScreen(host)));
    },
    rules: () => rulesDialog(host.root),
    // vor dem ersten Kampagnenstart einmal das Intro / the intro once before the first campaign start
    campaign: () => {
      const toCampaign = () => { if (n.isConnected) n.replaceWith(campaignScreen(host)); };
      if (host.settings.introSeen) { toCampaign(); return; }
      host.settings.introSeen = true;
      host.applySettings();
      openIntro(host, toCampaign);
    },
    tutorial: () => host.startTutorial(),
    import: () => host.loadFromFile(),
    settings: () => settingsDialog(host, render),
    credits: () => creditsDialog(host),
    story: () => openPrologue(host.root),
    intro: () => openIntro(host),
  });
  // Prolog einmal beim ersten Start zeigen / show the prologue once on first start
  if (!host.settings.prologueSeen) {
    host.settings.prologueSeen = true;
    host.applySettings();
    // an die UI-Wurzel haengen: das Menue wird nach der VR-Erkennung neu aufgebaut / attach to the UI root: the menu is rebuilt after XR detection
    setTimeout(() => openPrologue(host.root), 300);
  }
  n.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-seg="lang"]');
    if (b) { host.settings.lang = b.dataset.value as 'de' | 'en'; setLanguage(host.settings.lang); host.applySettings(); render(); }
  });
  return n;
}

/**
 * Frage vor dem ersten Einsatz: Tutorial oder direkt zur Einsatzplanung. Die Wahl wird gemerkt.
 * Question before the first game: tutorial or straight to setup. The choice is remembered.
 */
export function tutorialPrompt(host: ScreenHost, toSetup: () => void) {
  const d = openDialog(host.root, `${dialogTitle(t('onboarding.title'))}
    <p>${esc(techT('onboarding.text', TUTORIAL_FACTION))}</p>
    <div class="choice-grid">
      <button type="button" class="choice" data-choice="tutorial"><strong class="row">${icon('tutorial')}${esc(t('onboarding.play'))}</strong><span>${esc(t('onboarding.playDesc'))}</span></button>
      <button type="button" class="choice" data-choice="skip"><strong class="row">${icon('next')}${esc(t('onboarding.skip'))}</strong><span>${esc(t('onboarding.skipDesc'))}</span></button>
    </div>
    <p class="muted">${esc(t('onboarding.later'))}</p>`);
  d.node.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="close"]')) { d.close(); return; }
    const c = target.closest<HTMLElement>('[data-choice]');
    if (!c) return;
    host.settings.tutorialDone = true;
    host.applySettings();
    d.close();
    if (c.dataset.choice === 'tutorial') host.startTutorial(); else toSetup();
  });
}

// ---------- Partie einrichten / game setup ----------
export function setupScreen(host: ScreenHost): HTMLElement {
  const n = document.createElement('div');
  n.className = 'screen';
  const cfg = {
    weather: true,
    events: true,
    hitChance: true,
    factionVictory: true,
    // Erweitert: auf dem Handy eingeklappt / advanced: collapsed on phones
    advanced: typeof window === 'undefined' || !window.matchMedia?.('(max-width: 560px)').matches,
    hazards: 'normal' as HazardLevel,
    mode: 'points' as GameMode, size: 14 as MapSize, mapType: 'continents' as MapType, startStars: START.stars,
    seed: String(Math.floor(Math.random() * 1e6)),
    players: [
      { id: 'korvat' as FactionId, human: true, difficulty: 'normal' as Difficulty },
      { id: 'dravon' as FactionId, human: false, difficulty: 'normal' as Difficulty },
      { id: 'alvenia' as FactionId, human: false, difficulty: 'normal' as Difficulty },
      { id: 'meridon' as FactionId, human: false, difficulty: 'normal' as Difficulty },
    ],
  };
  // Kurzfassung der erweiterten Optionen (eingeklappt) / summary of the advanced options (collapsed)
  const onOff = (v: boolean) => t(v ? 'settings.on' : 'settings.off');
  const advancedSummary = () => [
    `${t('weather.title')}: ${onOff(cfg.weather)}`, `${t('hazards.title')}: ${t(`hazards.${cfg.hazards}`)}`, `${t('randomEvents.title')}: ${onOff(cfg.events)}`,
    `${t('hit.title')}: ${onOff(cfg.hitChance)}`, `${t('victory.setupTitle')}: ${onOff(cfg.factionVictory)}`,
    ...(cfg.mode === 'sandbox' ? [`${t('setup.startStars')}: ${cfg.startStars}`] : []), `${t('setup.seed')}: ${cfg.seed}`,
  ].join(' · ');
  const render = () => {
    const sandbox = cfg.mode === 'sandbox';
    n.innerHTML = `
      <div class="panel form">
        <div class="panel-title"><h2 class="display">${esc(t('setup.title'))}</h2>${iconButton('close', t('menu.back'), 'back')}</div>
        <div class="field"><span class="label">${esc(t('setup.mode'))}</span>
          ${segmented('mode', (['points', 'conquest', 'endless', 'sandbox'] as GameMode[]).map((m) => ({ value: m, label: t(`modes.${m}`) })), cfg.mode)}
          <span class="muted">${esc(t(`modes.${cfg.mode}Desc`, { rounds: MODES.pointsRounds }))}</span></div>
        <div class="field"><span class="label">${esc(t('setup.size'))}</span>
          ${segmented('size', MAP_SIZES.map((sz) => ({ value: String(sz), label: t('setup.tiles', { n: sz }) })), String(cfg.size))}</div>
        <div class="field"><span class="label">${esc(t('setup.mapType'))}</span>
          ${segmented('mapType', (Object.keys(MAP_TYPES) as MapType[]).map((m) => ({ value: m, label: t(`mapTypes.${m}`) })), cfg.mapType)}</div>
        <div class="field"><span class="label">${esc(t('setup.players'))} (${cfg.players.length})</span>
          <span class="muted">${esc(t('setup.hotseatHint'))}</span>
          ${cfg.players.map((p, i) => `
            <div class="player-row slot">
              <div class="slot-head"><span class="slot-no display">${esc(t('setup.slot', { n: i + 1 }))}</span>
                <span class="row">${detailsLink(p.id)}${cfg.players.length > PLAYER_LIMITS.min ? iconButton('minus', t('setup.removePlayer'), `remove-${i}`) : ''}</span></div>
              <button type="button" class="slot-pick" data-action="pick-${i}" aria-label="${esc(t('setup.chooseFaction'))}: ${esc(t(`factions.${p.id}.name`))}">
                ${leaderPortrait(p.id, 'md')}
                <span class="col grow"><strong class="slot-faction">${esc(t(`factions.${p.id}.name`))}</strong>
                  <span class="slot-leader">${esc(t(`factions.${p.id}.leaderTitle`))} <strong>${esc(t(`factions.${p.id}.leader`))}</strong>${ROSTERS[p.id] ? ` <span class="tag">${esc(t('setup.special'))}</span>` : ''}</span></span>
                <span class="slot-traits">${traitChips(p.id, { compact: true })}</span>
                <span class="slot-cta">${icon('next', 'icon-sm')}<span class="label">${esc(t('setup.chooseFaction'))}</span></span>
              </button>
              ${segmented(`human-${i}`, [{ value: 'human', label: t('setup.human') }, { value: 'ai', label: t('setup.ai') }], p.human ? 'human' : 'ai')}
              ${!p.human ? segmented(`diff-${i}`, (['easy', 'normal', 'hard', 'extreme'] as Difficulty[]).map((d) => ({ value: d, label: t(`difficulty.${d}`) })), p.difficulty) : ''}
            </div>`).join('')}
          ${cfg.players.length < PLAYER_LIMITS.max ? button(t('setup.addPlayer'), { icon: 'plus', action: 'add', variant: 'secondary' }) : ''}
        </div>
        <div class="field advanced ${cfg.advanced ? 'open' : ''}">
          <button type="button" class="adv-toggle" data-action="advanced" aria-expanded="${cfg.advanced}" aria-controls="setup-advanced">
            <span class="label">${esc(t('setup.advanced'))}</span>${icon(cfg.advanced ? 'chevronUp' : 'chevronDown', 'icon-sm')}</button>
          ${cfg.advanced ? '' : `<span class="muted adv-summary">${esc(advancedSummary())}</span>`}
          <div class="adv-body" id="setup-advanced" ${cfg.advanced ? '' : 'hidden'}>
            <div class="field"><span class="label">${esc(t('weather.title'))}</span>
              ${segmented('weather', [{ value: 'on', label: t('settings.on') }, { value: 'off', label: t('settings.off') }], cfg.weather ? 'on' : 'off')}
              <span class="muted">${esc(t('weather.setupHint'))}</span></div>
            <div class="field"><span class="label">${esc(t('hazards.title'))}</span>
              ${segmented('hazards', (['none', 'normal', 'many'] as HazardLevel[]).map((h) => ({ value: h, label: t(`hazards.${h}`) })), cfg.hazards)}
              <span class="muted">${esc(t('hazards.setupHint'))}</span></div>
            <div class="field"><span class="label">${esc(t('randomEvents.title'))}</span>
              ${segmented('events', [{ value: 'on', label: t('settings.on') }, { value: 'off', label: t('settings.off') }], cfg.events ? 'on' : 'off')}
              <span class="muted">${esc(t('randomEvents.setupHint'))}</span></div>
            <div class="field"><span class="label">${esc(t('hit.title'))}</span>
              ${segmented('hitChance', [{ value: 'on', label: t('settings.on') }, { value: 'off', label: t('settings.off') }], cfg.hitChance ? 'on' : 'off')}
              <span class="muted">${esc(t('hit.setupHint'))}</span></div>
            <div class="field"><span class="label">${esc(t('victory.setupTitle'))}</span>
              ${segmented('factionVictory', [{ value: 'on', label: t('settings.on') }, { value: 'off', label: t('settings.off') }], cfg.factionVictory ? 'on' : 'off')}
              <span class="muted">${esc(techT('victory.setupHint', cfg.players.find((x) => x.human)?.id))}</span></div>
            ${sandbox ? `<div class="field"><span class="label">${esc(t('setup.startStars'))}</span>
              ${segmented('stars', SANDBOX.startStarsOptions.map((v) => ({ value: String(v), label: String(v) })), String(cfg.startStars))}</div>` : ''}
            <div class="field"><label for="seed">${esc(t('setup.seed'))}</label>
              <div class="row"><input id="seed" type="text" value="${esc(cfg.seed)}" class="grow" inputmode="numeric">${button(t('setup.randomSeed'), { action: 'seed', variant: 'secondary' })}</div></div>
          </div>
        </div>
        ${button(t('setup.start'), { icon: 'play', action: 'start', block: true })}
      </div>`;
  };
  // Fraktionsauswahl fuer einen Slot / faction picker for a slot
  const pickFaction = (slot: number) => {
    const html = `${dialogTitle(t('setup.chooseTitle', { n: slot + 1 }))}
      <p class="muted">${esc(t('setup.swapHint'))}</p>
      <div class="faction-grid">${FACTION_IDS.map((f) => {
        const other = cfg.players.findIndex((p, j) => p.id === f && j !== slot);
        const current = cfg.players[slot].id === f;
        return `<div class="faction-card" ${current ? 'aria-current="true"' : ''}>
          <button type="button" class="faction-pick" data-pick="${f}" aria-pressed="${current}">
            ${leaderPortrait(f, 'md')}
            <span class="col grow"><strong>${esc(t(`factions.${f}.name`))}</strong>
              <span>${esc(t(`factions.${f}.leaderTitle`))} <strong>${esc(t(`factions.${f}.leader`))}</strong></span>
              <q class="leader-quote">${esc(t(`factions.${f}.quote`))}</q>
              ${traitChips(f)}
              <span class="row">${ROSTERS[f] ? `<span class="tag">${esc(t('setup.special'))}</span>` : ''}
                ${current ? `<span class="tag">${esc(t('setup.current'))}</span>` : other >= 0 ? `<span class="tag warn">${esc(t('setup.takenBy', { n: other + 1 }))}</span>` : ''}</span></span>
          </button>
          ${detailsLink(f)}
        </div>`;
      }).join('')}</div>`;
    const d = openDialog(n, html, { wide: true });
    d.node.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-action="close"]')) { d.close(); return; }
      // Details oeffnet der Klick-Handler des Einrichtungsbildschirms (der Dialog liegt darin) / details are opened by the setup screen's handler (the dialog lives inside it)
      if ((e.target as HTMLElement).closest('[data-details]')) return;
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (!card) return;
      const f = card.dataset.pick as FactionId;
      const other = cfg.players.findIndex((p, j) => p.id === f && j !== slot);
      // belegte Fraktion tauschen / swap a taken faction
      if (other >= 0) cfg.players[other].id = cfg.players[slot].id;
      cfg.players[slot].id = f;
      d.close();
      render();
    });
  };
  render();
  n.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const det = target.closest<HTMLElement>('[data-details]');
    if (det) { factionDialog(n, det.dataset.details as FactionId); return; }
    const seg = target.closest<HTMLElement>('[data-seg]');
    if (seg) {
      const key = seg.dataset.seg!, v = seg.dataset.value!;
      if (key === 'mode') cfg.mode = v as GameMode;
      else if (key === 'size') cfg.size = Number(v) as MapSize;
      else if (key === 'mapType') cfg.mapType = v as MapType;
      else if (key === 'stars') cfg.startStars = Number(v);
      else if (key === 'weather') cfg.weather = v === 'on';
      else if (key === 'hazards') cfg.hazards = v as HazardLevel;
      else if (key === 'events') cfg.events = v === 'on';
      else if (key === 'hitChance') cfg.hitChance = v === 'on';
      else if (key === 'factionVictory') cfg.factionVictory = v === 'on';
      else if (key.startsWith('human-')) cfg.players[Number(key.slice(6))].human = v === 'human';
      else if (key.startsWith('diff-')) cfg.players[Number(key.slice(5))].difficulty = v as Difficulty;
      cfg.seed = (n.querySelector<HTMLInputElement>('#seed')?.value ?? cfg.seed);
      render();
      return;
    }
    const b = target.closest<HTMLElement>('[data-action]');
    if (!b) return;
    const a = b.dataset.action!;
    cfg.seed = (n.querySelector<HTMLInputElement>('#seed')?.value ?? cfg.seed);
    if (a === 'back') { n.remove(); host.showMenu(); }
    else if (a === 'advanced') { cfg.advanced = !cfg.advanced; render(); n.querySelector<HTMLElement>('[data-action="advanced"]')?.focus(); }
    else if (a === 'seed') { cfg.seed = String(Math.floor(Math.random() * 1e6)); render(); }
    else if (a === 'add') {
      const free = FACTION_IDS.find((f) => !cfg.players.some((p) => p.id === f));
      if (free) cfg.players.push({ id: free, human: false, difficulty: 'normal' });
      render();
    } else if (a.startsWith('pick-')) {
      pickFaction(Number(a.slice(5)));
    } else if (a.startsWith('remove-')) { cfg.players.splice(Number(a.slice(7)), 1); render(); }
    else if (a === 'start') {
      const seedNum = /^-?\d+$/.test(cfg.seed.trim()) ? Number(cfg.seed.trim()) | 0 : hashSeed(cfg.seed);
      const config = defaultConfig({
        seed: seedNum, size: cfg.size, mapType: cfg.mapType, mode: cfg.mode,
        factions: cfg.players.map((p) => ({ id: p.id, human: p.human, difficulty: p.difficulty })),
        startStars: cfg.mode === 'sandbox' ? cfg.startStars : START.stars,
        roundLimit: cfg.mode === 'points' ? MODES.pointsRounds : null,
        weather: cfg.weather,
        hazards: cfg.hazards,
        events: cfg.events,
        hitChance: cfg.hitChance,
        factionVictory: cfg.factionVictory,
      });
      n.remove();
      host.startGame(config);
    }
  });
  return n;
}

// ---------- Einstellungen / settings ----------
export function settingsDialog(host: ScreenHost, onChange?: () => void) {
  const s = host.settings;
  const onOff = (k: string, v: boolean) => segmented(k, [{ value: 'on', label: t('settings.on') }, { value: 'off', label: t('settings.off') }], v ? 'on' : 'off');
  const html = () => `${dialogTitle(t('settings.title'))}
    <div class="form">
      <div class="field"><span class="label">${esc(t('settings.language'))}</span>${segmented('lang', [{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }], getLanguage())}</div>
      <div class="field"><span class="label">${esc(t('settings.music'))}</span>${onOff('music', s.music)}</div>
      <div class="field"><span class="label">${esc(t('settings.effects'))}</span>${onOff('effects', s.effects)}</div>
      <div class="field"><span class="label">${esc(t('settings.ambience'))}</span>${onOff('ambience', s.ambience)}</div>
      <div class="field"><span class="label">${esc(t('settings.animations'))}</span>${onOff('animations', s.animations)}</div>
      <div class="field"><span class="label">${esc(t('settings.barks'))}</span>${onOff('barks', s.barks)}</div>
      <div class="field"><span class="label">${esc(t('settings.dispatches'))}</span>${onOff('dispatches', s.dispatches)}</div>
      <div class="field"><span class="label">${esc(t('settings.aiSpeed'))}</span>${segmented('aiSpeed', ['slow', 'normal', 'fast', 'instant'].map((v) => ({ value: v, label: t(`settings.${v}`) })), s.aiSpeed)}</div>
      <div class="field"><span class="label">${esc(t('settings.quality'))}</span>${segmented('quality', ['low', 'high'].map((v) => ({ value: v, label: t(`settings.${v}`) })), s.quality)}</div>
    </div>`;
  const d = openDialog(host.root, html(), { onClose: onChange });
  d.node.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="close"]')) { d.close(); return; }
    const seg = target.closest<HTMLElement>('[data-seg]');
    if (!seg) return;
    const k = seg.dataset.seg!, v = seg.dataset.value!;
    if (k === 'lang') { s.lang = v as 'de' | 'en'; setLanguage(s.lang); }
    else if (k === 'music' || k === 'effects' || k === 'animations' || k === 'barks' || k === 'dispatches' || k === 'ambience') s[k] = v === 'on';
    else if (k === 'aiSpeed') s.aiSpeed = v as Settings['aiSpeed'];
    else if (k === 'quality') s.quality = v as Settings['quality'];
    host.applySettings();
    rerender(d.node, html());
  });
}

export function creditsDialog(host: ScreenHost) {
  const d = openDialog(host.root, `${dialogTitle(t('credits.title'))}
    <div class="col">
      ${['game', 'models', 'sound', 'music', 'fontBlackOps', 'fontBangers', 'fontComicNeue', 'three', 'vite'].map((k) => `<p>${esc(t(`credits.${k}`))}</p>`).join('')}
      <p class="muted">${esc(t('credits.disclaimer'))}</p>
    </div>`);
  bind(d.node, { close: () => d.close() });
}

// ---------- Pausenmenue / pause menu ----------
export function pauseMenu(host: ScreenHost) {
  const d = openDialog(host.root, `${dialogTitle(t('menu.pause'))}
    <nav class="menu-list">
      ${button(t('menu.resume'), { icon: 'play', action: 'close', block: true })}
      ${button(t('history.open'), { icon: 'chart', action: 'stats', block: true, variant: 'secondary' })}
      ${button(t('victory.open'), { icon: 'trophy', action: 'victory', block: true, variant: 'secondary' })}
      ${button(t('rules.menu'), { icon: 'help', action: 'rules', block: true, variant: 'secondary', title: t('menu.help') })}
      ${button(t('menu.save'), { icon: 'save', action: 'save', block: true, variant: 'secondary' })}
      ${button(t('saves.title'), { icon: 'folder', action: 'slots', block: true, variant: 'secondary' })}
      ${button(t('menu.exportFile'), { icon: 'download', action: 'export', block: true, variant: 'secondary' })}
      ${button(t('menu.importFile'), { icon: 'upload', action: 'import', block: true, variant: 'secondary' })}
      ${host.xr.vr ? button(t('menu.startVR'), { icon: 'vr', action: 'vr', block: true, variant: 'secondary' }) : ''}
      ${host.xr.ar ? button(t('menu.startAR'), { icon: 'ar', action: 'ar', block: true, variant: 'secondary' }) : ''}
      ${button(t('menu.settings'), { icon: 'settings', action: 'settings', block: true, variant: 'secondary' })}
      ${button(t('menu.credits'), { icon: 'info', action: 'credits', block: true, variant: 'secondary' })}
      ${button(t('menu.quit'), { icon: 'close', action: 'quit', block: true, variant: 'danger' })}
    </nav>`);
  bind(d.node, {
    close: () => d.close(),
    stats: () => { d.close(); statsDialog(host.root, host.game.state!, host.game.viewer); },
    victory: () => { d.close(); victoryTrackerDialog(host.root, host.game.state!, host.game.viewer); },
    rules: () => { d.close(); rulesDialog(host.root, 'goal', factionIdOf(host.game.state, host.game.viewer >= 0 ? host.game.viewer : host.game.state?.current ?? -1)); },
    save: () => { host.saveNow(); d.close(); },
    slots: () => { d.close(); host.openSlots('save'); },
    export: () => host.exportGame(),
    import: () => { d.close(); host.loadFromFile(); },
    vr: () => { d.close(); host.xr.enter('vr'); },
    ar: () => { d.close(); host.xr.enter('ar'); },
    // nach einem Sprachwechsel das Pausenmenue in der neuen Sprache neu oeffnen / reopen the pause menu in the new language after a language change
    settings: () => { const lang = getLanguage(); settingsDialog(host, () => { if (getLanguage() !== lang && d.node.isConnected) { d.close(); pauseMenu(host); } }); },
    credits: () => creditsDialog(host),
    quit: () => { d.close(); host.saveNow(); host.showMenu(); },
  });
}

// ---------- Forschungsbaum (radial) / research tree (radial) ----------
export function researchDialog(host: ScreenHost) {
  const g = host.game;
  let selected: TechId | null = null;
  const C = 400;
  const layout = new Map<TechId, { x: number; y: number }>();
  const roots = TECH_IDS.filter((id) => TECHS[id].parent === null);
  roots.forEach((root, b) => {
    const base = -Math.PI / 2 + (b * 2 * Math.PI) / roots.length;
    layout.set(root, { x: C + Math.cos(base) * 120, y: C + Math.sin(base) * 120 });
    const kids = TECH_IDS.filter((id) => TECHS[id].parent === root);
    kids.forEach((kid, k) => {
      const a = base + (k === 0 ? -0.26 : 0.26);
      layout.set(kid, { x: C + Math.cos(a) * 225, y: C + Math.sin(a) * 225 });
      const grand = TECH_IDS.find((id) => TECHS[id].parent === kid);
      if (grand) {
        const a3 = base + (k === 0 ? -0.3 : 0.3);
        layout.set(grand, { x: C + Math.cos(a3) * 330, y: C + Math.sin(a3) * 330 });
      }
    });
  });
  // Siegtechnologie der Fraktion: neben ihrem Vorgaenger (ohne Vorgaenger: oben) / the faction's victory tech: next to its parent (no parent: on top)
  {
    const s0 = g.state!;
    const f0 = g.viewer >= 0 ? g.viewer : s0.current;
    const vt = VICTORY_TECH[s0.factions[f0].id];
    const parent = TECHS[vt].parent;
    if (parent) {
      const root = TECHS[parent].parent!;
      const b = roots.indexOf(root);
      const k = TECH_IDS.filter((id) => TECHS[id].parent === root).indexOf(parent);
      const a = -Math.PI / 2 + (b * 2 * Math.PI) / roots.length + (k === 0 ? -0.62 : 0.62);
      layout.set(vt, { x: C + Math.cos(a) * 330, y: C + Math.sin(a) * 330 });
    } else layout.set(vt, { x: C, y: C - 225 });
  }
  const html = () => {
    const s = g.state!;
    const f = g.viewer >= 0 ? g.viewer : s.current;
    // sichtbar: allgemeine Technologien (wenn die Fraktion forscht) und die eigene Siegtechnologie / visible: common techs (if the faction researches) and the own victory tech
    const ids = [...TECH_IDS, VICTORY_TECH[s.factions[f].id]].filter((id) => techVisible(s, f, id));
    // Menschen: Produktion statt Forschung / humans: production instead of research
    const fid = s.factions[f].id;
    const tt = (key: string, vars?: Record<string, string | number>) => techT(key, fid, vars);
    let links = '', nodes = '';
    for (const id of ids) {
      const p = layout.get(id)!;
      const parent = TECHS[id].parent;
      const from = parent ? layout.get(parent)! : { x: C, y: C };
      const done = s.factions[f].techs.includes(id);
      links += `<line class="tech-link ${done ? 'done' : ''}" x1="${from.x}" y1="${from.y}" x2="${p.x}" y2="${p.y}"/>`;
    }
    for (const id of ids) {
      const p = layout.get(id)!;
      const st = techState(s, f, id);
      const cost = researchCost(s, f, id);
      const name = t(`techs.${id}`);
      const words = name.split(/[\s-]/);
      const lines = words.length > 1 && name.length > 12 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [name];
      nodes += `<g class="tech-node ${st} ${selected === id ? 'selected' : ''} ${TECHS[id].faction ? 'victory' : ''}" data-tech="${id}" role="button" tabindex="0" aria-label="${esc(name)}: ${esc(tt(`tech.${st}`))}, ${cost}">
        <circle class="disc" cx="${p.x}" cy="${p.y}" r="30"/>
        ${st === 'researched' ? iconAt('check', p.x - 14, p.y - 14, 28) : st === 'locked' ? iconAt('lock', p.x - 12, p.y - 12, 24) : `<text x="${p.x}" y="${p.y + 6}" text-anchor="middle" class="cost">${cost}</text>`}
        ${lines.map((l, i) => `<text class="name" x="${p.x}" y="${p.y + 46 + i * 13}" text-anchor="middle">${esc(l)}</text>`).join('')}
      </g>`;
    }
    const legend = (['researched', 'available', 'expensive', 'locked'] as const).map((k) => `<span><i style="background:var(--c-tech-node-${k})"></i>${esc(tt(`tech.${k}`))}</span>`).join('')
      // gestrichelter Rand = Siegtechnologie / dashed rim = victory tech
      + (factionVictoryOn(s) ? `<span><i class="legend-victory"></i>${esc(tt('tech.legendVictory'))}</span>` : '');
    return `${dialogTitle(tt('tech.title'))}
      <div class="row"><span class="res"><span class="star">${icon('star')}</span><span class="val">${s.factions[f].stars}</span></span><span class="muted">${esc(tt('tech.costFormula'))}</span></div>
      <div class="legend">${legend}</div>
      ${!canResearch(s, f) ? `<p class="muted">${esc(t('victory.researchOnly'))}</p>` : ''}
      ${techListHtml(s, f, ids, g.isHumanTurn && f === s.current)}
      <div class="tech-wrap"><svg class="tech-svg" viewBox="${canResearch(s, f) ? '0 0 800 800' : `${C - 160} ${C - 300} 320 360`}" role="group" aria-label="${esc(tt('tech.title'))}">
        ${links}<circle cx="${C}" cy="${C}" r="44" class="tech-center"/>
        ${iconAt(techIcon(fid), C - 18, C - 18, 36)}${nodes}</svg></div>`;
  };
  const d = openDialog(host.root, html(), { wide: true });
  d.node.addEventListener('click', async (e) => {
    const target = e.target as Element;
    if (target.closest('[data-action="close"]')) { d.close(); return; }
    // Listenansicht: direkt erforschen / list view: research directly
    const rb = target.closest<HTMLElement>('[data-research]');
    if (rb) {
      if (rb.hasAttribute('disabled')) return;
      const res = await g.exec({ type: 'research', tech: rb.dataset.research as TechId });
      if (res.ok) d.node.innerHTML = html();
      return;
    }
    const node = target.closest<SVGGElement>('[data-tech]');
    if (node) {
      selected = node.dataset.tech as TechId;
      g.play('select');
      d.node.innerHTML = html();
      techInfoBox(host, selected, () => { selected = null; d.node.innerHTML = html(); });
    }
  });
}

/**
 * Listenansicht des Forschungsbaums fuer schmale Bildschirme: nach Zweig gruppiert, mit Status, Kosten und Knopf.
 * List view of the research tree for narrow screens: grouped by branch, with status, cost and button.
 */
function techListHtml(s: GameState, f: number, ids: TechId[], canAct: boolean): string {
  const visible = new Set(ids);
  const groups: { title: string; techs: TechId[] }[] = [];
  for (const root of TECH_IDS.filter((id) => TECHS[id].parent === null)) {
    const techs: TechId[] = [root];
    for (const kid of TECH_IDS.filter((id) => TECHS[id].parent === root)) {
      techs.push(kid, ...TECH_IDS.filter((id) => TECHS[id].parent === kid));
    }
    const shown = techs.filter((id) => visible.has(id));
    if (shown.length) groups.push({ title: t(`techs.${root}`), techs: shown });
  }
  const vt = VICTORY_TECH[s.factions[f].id];
  const tt = (key: string, vars?: Record<string, string | number>) => techT(key, s.factions[f].id, vars);
  if (visible.has(vt)) groups.push({ title: tt('tech.victoryGroup'), techs: [vt] });
  const row = (id: TechId) => {
    const st = techState(s, f, id);
    const cost = researchCost(s, f, id);
    const parent = TECHS[id].parent;
    const note = st === 'locked' && parent ? tt('tech.needParent', { tech: t(`techs.${parent}`) }) : tt(`tech.${st}`);
    const btn = st === 'researched' ? `<span class="tag ok">${icon('check', 'icon-sm')}</span>`
      : `<button type="button" class="btn tech-buy ${st === 'available' && canAct ? '' : 'secondary'}" data-research="${id}" ${st === 'available' && canAct ? '' : 'disabled aria-disabled="true"'} aria-label="${esc(tt('tech.confirm'))}: ${esc(t(`techs.${id}`))}">${icon(techIcon(s.factions[f].id), 'icon-sm')}${price(cost)}</button>`;
    return `<li class="tech-row ${st} ${TECHS[id].faction ? 'victory' : ''}">
      <button type="button" class="tech-row-main" data-tech="${id}"><i class="tech-dot" aria-hidden="true"></i>
        <span class="col"><strong>${esc(t(`techs.${id}`))}</strong><span class="muted">${esc(t('tech.tier', { n: TECHS[id].tier }))} · ${esc(note)}</span></span></button>
      ${btn}</li>`;
  };
  return `<div class="tech-list">${groups.map((gr) => `<section class="tech-branch"><h3 class="display">${esc(gr.title)}</h3><ul>${gr.techs.map(row).join('')}</ul></section>`).join('')}</div>`;
}

/** Infobox zu einer Technologie mit Bestaetigung / info box for a technology with confirmation */
function techInfoBox(host: ScreenHost, tech: TechId, onClose: () => void) {
  const g = host.game;
  const s = g.state!;
  const f = g.viewer >= 0 ? g.viewer : s.current;
  const fa = s.factions[f];
  const st = techState(s, f, tech);
  const cost = researchCost(s, f, tech);
  const canAct = g.isHumanTurn && f === s.current;
  const parent = TECHS[tech].parent;
  const un = techUnlocks(tech, fa.id);
  const tt = (key: string, vars?: Record<string, string | number>) => techT(key, fa.id, vars);
  const unitRows = un.units.map((u) => {
    const us = UNITS[u];
    // Preis mit Fraktionsrabatt / price including the faction discount
    const price = unitCost(s, f, u);
    return `<li class="unlock">${icon('helmet', 'icon-sm')}<strong>${esc(t(`units.${u}`))}</strong>
      <span class="muted">${esc(t('stats.attack'))} ${num(us.attack)} · ${esc(t('stats.defense'))} ${num(us.defense)} · ${esc(t('stats.move'))} ${num(us.move)} · ${esc(t('stats.range'))} ${us.range ? num(us.range) : esc(t('stats.noRange'))}${price !== null ? ` · ${price} ${esc(t('hud.stars'))}` : ''}</span></li>`;
  });
  const buildingRows = [...new Set(un.buildings)].map((b) => `<li class="unlock">${icon('build', 'icon-sm')}<strong>${esc(t(`buildings.${b}`))}</strong><span class="muted">${esc(buildingDescText(b))}</span></li>`);
  const vf = TECHS[tech].faction;
  const extra = tt(`techExtra.${tech}`, vf ? victoryParams(vf, s) : {});
  const extraRows = extra.startsWith('techExtra.') ? [] : [`<li class="unlock">${icon(vf ? 'crown' : 'lightning', 'icon-sm')}${vf ? `<strong>${esc(t('traits.victory'))}</strong><span class="muted">${esc(extra)}</span>` : `<strong>${esc(extra)}</strong>`}</li>`];
  // Stadt-Ausbauten, die diese Forschung freischaltet / city upgrades unlocked by this research
  for (const up of CITY_UPGRADE_IDS) {
    if (CITY_UPGRADES.tech[up] !== tech) continue;
    // Fraktionsausbau (Satelliten-Relay) nur fuer die eigene Fraktion / faction upgrade (satellite relay) only for its own faction
    const only = CITY_UPGRADES.faction[up];
    if (only && only !== fa.id) continue;
    extraRows.push(`<li class="unlock">${icon('city', 'icon-sm')}<strong>${esc(t('cityUpgrades.unlock', { name: t(`cityUpgrades.${up}`) }))}</strong><span class="muted">${esc(t(`cityUpgrades.${up}Desc`, orbitalVars()))}</span></li>`);
  }
  let reason = '';
  if (st === 'researched') reason = tt('tech.done');
  else if (st === 'locked' && parent) reason = tt('tech.needParent', { tech: t(`techs.${parent}`) });
  else if (st === 'expensive') reason = t('tech.missingStars', { n: cost - fa.stars });
  else if (!canAct) reason = tt('tech.notYourTurn');
  const canResearch = st === 'available' && canAct;
  const box = openDialog(host.root, `<div class="panel-title"><h2 class="display">${esc(t(`techs.${tech}`))}</h2>${iconButton('close', t('actions.close'), 'cancel')}</div>
    <div class="row"><span class="tag">${esc(t('tech.tier', { n: TECHS[tech].tier }))}</span><span class="tag ${st === 'researched' ? 'ok' : st === 'available' ? '' : 'warn'}">${esc(tt(`tech.${st}`))}</span></div>
    <div class="kv">
      <span>${esc(t('stats.cost'))}</span><span>${price(cost)}</span>
      <span>${esc(t('hud.stars'))}</span><span>${price(fa.stars)}</span>
      ${parent ? `<span>${esc(t('tech.requires'))}</span><span>${esc(t(`techs.${parent}`))} ${fa.techs.includes(parent) ? icon('check', 'icon-sm') : icon('lock', 'icon-sm')}</span>` : ''}
    </div>
    <h3 class="display">${esc(t('tech.unlocks'))}</h3>
    <ul class="unlock-list">${[...unitRows, ...buildingRows, ...extraRows].join('')}</ul>
    ${reason ? `<p class="tag warn">${esc(reason)}</p>` : ''}
    <div class="dialog-actions">
      ${button(t('actions.cancel'), { action: 'cancel', variant: 'secondary' })}
      ${st !== 'researched' ? button(tt('tech.confirm'), { action: 'confirm', icon: techIcon(fa.id), disabled: !canResearch, extra: price(cost) }) : ''}
    </div>`, { onClose });
  box.node.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="cancel"]')) { box.close(); return; }
    if (target.closest('[data-action="confirm"]') && canResearch) {
      const res = await g.exec({ type: 'research', tech });
      if (res.ok) box.close();
    }
  });
}

// ---------- Diplomatie / diplomacy ----------
export function diplomacyDialog(host: ScreenHost) {
  const g = host.game;
  const html = () => {
    const s = g.state!;
    const f = g.viewer >= 0 ? g.viewer : s.current;
    const me = s.factions[f];
    const canAct = g.isHumanTurn && f === s.current;
    const rows = s.factions.filter((o) => o.index !== f).map((o) => {
      const name = t(`factions.${o.id}.name`);
      const contact = inContact(s, f, o.index);
      const rel = me.relations[o.index];
      let actions = '';
      if (!o.alive) actions = `<span class="tag">${esc(t('diplomacy.eliminated'))}</span>`;
      else if (!contact) actions = `<span class="muted">${esc(t('diplomacy.noContact'))}</span>`;
      else {
        const tags = [`<span class="tag ${rel === 'peace' ? 'ok' : rel === 'breaking' ? 'warn' : ''}">${esc(t(`diplomacy.${rel}`))}</span>`];
        if (me.embassies.includes(o.index)) tags.push(`<span class="tag ok">${esc(t('diplomacy.embassyOpen'))}</span>`);
        if (o.peaceOffers.includes(f)) tags.push(`<span class="tag">${esc(t('diplomacy.offerPending'))}</span>`);
        const btns: string[] = [];
        if (canAct) {
          if (me.peaceOffers.includes(o.index)) {
            btns.push(`<span class="muted">${esc(t('diplomacy.offerReceived'))}</span>`);
            btns.push(button(t('diplomacy.accept'), { action: `accept-${o.index}`, icon: 'check' }));
            btns.push(button(t('diplomacy.decline'), { action: `decline-${o.index}`, variant: 'secondary', icon: 'close' }));
          } else if (rel === 'war' && !o.peaceOffers.includes(f)) btns.push(button(t('diplomacy.proposePeace'), { action: `peace-${o.index}`, variant: 'secondary', icon: 'diplomacy' }));
          if (rel === 'peace') btns.push(button(t('diplomacy.announceBreak'), { action: `break-${o.index}`, variant: 'danger', icon: 'warning' }));
          const hq = hqOf(s, o.index);
          if (me.techs.includes('intelligence') && !me.embassies.includes(o.index) && hq && isExplored(s, f, hq.x, hq.y)) {
            const cost = embassyCost(s, f);
            btns.push(button(t('diplomacy.embassy'), { action: `embassy-${o.index}`, variant: 'secondary', icon: 'city', disabled: me.stars < cost, extra: price(cost) }));
          }
        }
        actions = `<div class="row">${tags.join('')}</div><div class="row">${btns.join('')}</div>`;
      }
      return `<div class="player-row">${leaderPortrait(o.id, 'sm')}<div class="col"><strong>${esc(name)}</strong><span>${esc(t(`factions.${o.id}.leaderTitle`))} ${esc(t(`factions.${o.id}.leader`))}</span><span class="muted">${esc(t(`factions.${o.id}.alignment`))}${contact ? ` · ${esc(t('diplomacy.score', { n: score(s, o.index) }))}` : ''}</span></div><div class="col span-all">${actions}</div></div>`;
    }).join('');
    return `${dialogTitle(t('diplomacy.title'))}<div class="col">${rows}</div><p class="muted">${esc(t('diplomacy.breakHint'))} ${esc(t('diplomacy.embassyHint', { inc: INCOME.embassy, base: ECON.embassyBaseCost, step: ECON.embassyStep }))}</p>
      ${button(t('victory.open'), { icon: 'trophy', action: 'victory', variant: 'secondary', block: true })}`;
  };
  const d = openDialog(host.root, html());
  d.node.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    const a = b.dataset.action!;
    if (a === 'close') { d.close(); return; }
    if (a === 'victory') { victoryTrackerDialog(host.root, g.state!, g.viewer); return; }
    const [kind, idx] = a.split('-');
    const map: Record<string, 'proposePeace' | 'acceptPeace' | 'declinePeace' | 'announceBreak' | 'embassy'> = {
      peace: 'proposePeace', accept: 'acceptPeace', decline: 'declinePeace', break: 'announceBreak', embassy: 'embassy',
    };
    if (!map[kind]) return;
    if (kind === 'break') {
      const name = t(`factions.${g.state!.factions[Number(idx)].id}.name`);
      if (!(await confirmDialog(host, t('diplomacy.breakConfirm', { name }), t('diplomacy.announceBreak'), t('diplomacy.announceBreak')))) return;
      if (!d.node.isConnected) return;
    }
    await g.exec({ type: 'diplomacy', action: map[kind], target: Number(idx) });
    rerender(d.node, html());
  });
}

// ---------- Grossprojekte / grand projects ----------
export function grandDialog(host: ScreenHost) {
  const g = host.game, s = g.state!;
  const f = g.viewer >= 0 ? g.viewer : s.current;
  const fa = s.factions[f];
  const rows = GRAND_PROJECT_IDS.map((id) => {
    const built = fa.grandProjectsBuilt.includes(id);
    const unlocked = fa.grandProjectsUnlocked.includes(id) || grandProjectConditionMet(s, f, id);
    const st = built ? 'built' : unlocked ? 'unlocked' : 'locked';
    return `<div class="score-row">${icon(built ? 'check' : unlocked ? 'grand' : 'lock')}<div class="grow"><strong>${esc(t(`grand.${id}`))}</strong><div class="muted">${esc(techT(`grand.${id}Cond`, fa.id))}</div></div><span class="tag ${built ? 'ok' : unlocked ? 'warn' : ''}">${esc(t(`grand.${st}`))}</span></div>`;
  }).join('');
  const d = openDialog(host.root, `${dialogTitle(t('grand.title'))}<p class="muted">${esc(t('grand.desc'))}</p><div class="score-list">${rows}</div>`);
  bind(d.node, { close: () => d.close() });
}

// ---------- Stadtbelohnung / city reward ----------
export function rewardDialog(host: ScreenHost, onDone: () => void) {
  const g = host.game, s = g.state!;
  const p = s.pendingRewards.find((r) => cityById(s, r.cityId)?.owner === s.current);
  if (!p) { onDone(); return; }
  const c = cityById(s, p.cityId)!;
  const [a, b] = rewardOptions(c, p.level);
  const d = openDialog(host.root, `<div class="panel-title"><h2 class="display">${esc(t('rewards.title', { city: cityName(s, c.id), level: p.level }))}</h2></div>
    <p>${esc(t('rewards.choose'))}</p>
    <div class="choice-grid">
      <button type="button" class="choice" data-choice="a"><strong>${esc(t(`rewards.${a}`))}</strong><span>${esc(t(`rewards.${a}Desc`))}</span></button>
      <button type="button" class="choice" data-choice="b"><strong>${esc(t(`rewards.${b}`))}</strong><span>${esc(t(`rewards.${b}Desc`))}</span></button>
    </div>`, { dismissable: false });
  d.node.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-choice]');
    if (!btn) return;
    d.close();
    await g.exec({ type: 'reward', city: c.id, choice: btn.dataset.choice as 'a' | 'b' });
    onDone();
  });
}

// ---------- Details (langes Druecken) / details (long press) ----------
export function detailsDialog(host: ScreenHost, x: number, y: number) {
  const g = host.game, s = g.state!;
  const viewer = g.viewer;
  if (viewer >= 0 && !isExplored(s, viewer, x, y)) return;
  const tile = s.tiles[y * s.size + x];
  const u = unitAt(s, x, y);
  const c = cityAt(s, x, y);
  let html = dialogTitle(t('actions.details'));
  if (u && (viewer < 0 || canSeeUnit(s, viewer, u))) {
    const st = UNITS[u.type];
    html += `<h3 class="display">${esc(unitDisplayName(s, u))}</h3><p class="muted">${esc(unitName(u))} · ${esc(t(`factions.${s.factions[u.owner].id}.short`))}</p>
      <div class="kv"><span>${esc(t('stats.hp'))}</span><span>${u.hp} / ${u.maxHp}</span>
      <span>${esc(t('stats.attack'))}</span><span>${num(st.attack)}</span><span>${esc(t('stats.defense'))}</span><span>${num(st.defense)}</span>
      <span>${esc(t('stats.move'))}</span><span>${num(st.move)}</span><span>${esc(t('stats.range'))}</span><span>${st.range ? num(st.range) : esc(t('stats.noRange'))}</span>
      <span>${esc(t('stats.cost'))}</span><span>${unitCost(s, viewer >= 0 ? viewer : u.owner, u.type) ?? '-'}</span><span>${esc(t('stats.kills'))}</span><span>${u.kills}</span></div>
      <ul>${st.abilities.filter((a) => a !== 'carry').map((a) => `<li><strong>${esc(t(`abilities.${a}`))}:</strong> ${esc(t(`abilities.${a}Desc`))}</li>`).join('')}</ul>`;
  }
  if (c) {
    html += `<h3 class="display">${esc(cityName(s, c.id))}</h3><p>${c.owner === null ? esc(t(c.tower ? 'tower.neutral' : supplyLines(s) ? 'cavern.neutralLine' : isDesert(s) ? 'desert.neutralOutpost' : isAlienWorld(s) ? 'burrow.neutral' : 'features.village')) : `${factionChip(s.factions[c.owner].id, t(`factions.${s.factions[c.owner].id}.short`))} ${esc(c.tower ? t('tower.name') : supplyLines(s) ? t(c.isHQ && c.hqOf === c.owner ? 'cavern.mainShaft' : 'cavern.supplyLine') : `${isDesert(s) ? `${t('desert.outpost')} · ` : isAlienWorld(s) ? `${t(s.factions[c.owner].id === 'zyrr' ? 'burrow.zyrr' : 'burrow.own')} · ` : ''}${t('hud.level', { n: c.level })}`)}`}</p>`;
  }
  const gun = turretAt(s, x, y);
  if (gun && gun.owner !== undefined && (viewer < 0 || isExplored(s, viewer, x, y))) {
    // Geschuetzstellung / gun emplacement
    html += `<h3 class="display">${esc(emplacementName(s, gun.owner))}</h3><p class="muted">${factionChip(s.factions[gun.owner].id, t(`factions.${s.factions[gun.owner].id}.short`))} ${esc(t('emplacement.every'))} · ${esc(emplacementStats(gun.hp))}</p><p>${esc(emplacementDesc(s, gun.owner))}</p>`;
  } else if (gun && (viewer < 0 || isExplored(s, viewer, x, y))) {
    html += `<h3 class="display">${esc(t('verdan.name'))}</h3><p class="muted">${esc(t(gun.active ? 'verdan.active' : 'verdan.dormant'))} · ${esc(t('verdan.hp', { hp: gun.hp, max: VERDAN.hp }))}</p><p>${esc(t('verdan.desc', { wake: VERDAN.wakeRange, range: VERDAN.range }))}</p>`;
  }
  html += `<h3 class="display">${esc(t(`terrain.${tile.terrain}`))}${tile.biome ? ` · ${esc(t(`biomes.${tile.biome}`))}` : ''}${tile.river ? ` · ${esc(t('biomes.river'))}` : ''}</h3><p>${[tile.resource ? t(`resources.${tile.resource}`) : '', tile.building ? `${t(`buildings.${tile.building}`)}: ${buildingDescText(tile.building)}` : '', tile.feature ? t(`features.${tile.feature}`) : ''].filter(Boolean).map(esc).join(' · ')}</p>`;
  const d = openDialog(host.root, html);
  bind(d.node, { close: () => d.close() });
}

export function confirmDialog(host: ScreenHost, text: string, ok: string, title = t('actions.confirmTitle')): Promise<boolean> {
  return new Promise((resolve) => {
    const d = openDialog(host.root, `<div class="panel-title"><h2 class="display confirm-title">${icon('warning')}<span>${esc(title)}</span></h2></div><p>${esc(text)}</p>
      <div class="dialog-actions">${button(t('actions.cancel'), { action: 'no', variant: 'secondary' })}${button(ok, { action: 'yes', variant: 'danger' })}</div>`, { onClose: () => resolve(false) });
    bind(d.node, { no: () => d.close(), yes: () => { resolve(true); d.close(); } });
  });
}

// ---------- Uebergabe / handover ----------
export function handoverScreen(host: ScreenHost, faction: number): Promise<void> {
  return new Promise((resolve) => {
    const s = host.game.state!;
    const f = s.factions[faction];
    const n = document.createElement('div');
    n.className = 'screen handover';
    n.innerHTML = `<div class="panel form center">
      <h2 class="display">${esc(t('handover.title'))} · ${esc(t('handover.round', { n: s.round }))}</h2>
      <div class="row center">${factionBadge(f.id)}</div>
      <p class="display">${esc(t('handover.text', { name: t(`factions.${f.id}.name`) }))}</p>
      ${button(t('handover.ready'), { icon: 'play', action: 'ready', block: true })}</div>`;
    host.root.appendChild(n);
    bind(n, { ready: () => { n.remove(); resolve(); } });
  });
}

// ---------- Spielende / game over ----------
export function gameOverScreen(host: ScreenHost) {
  const s = host.game.state!;
  const ranking = s.factions.map((f) => ({ f, sc: score(s, f.index) })).sort((a, b) => (b.f.index === s.winner ? 1 : 0) - (a.f.index === s.winner ? 1 : 0) || b.sc - a.sc);
  const humanWon = s.winner !== null && s.factions[s.winner].human;
  const anyHuman = s.factions.some((f) => f.human);
  const d = openDialog(host.root, `<div class="panel-title"><h2 class="display">${esc(t('gameover.title'))}</h2></div>
    <h1 class="logo">${esc(!anyHuman || humanWon ? t('gameover.victory') : t('gameover.defeat'))}</h1>
    ${s.winner !== null ? `<p class="display">${esc(t('gameover.winner', { name: t(`factions.${s.factions[s.winner].id}.name`) }))}</p>` : ''}
    ${victoryReasonHtml(s.victory)}
    ${gameOverDispatchHtml(s, host.game.viewer)}
    <h3 class="display">${esc(t('gameover.scores'))}</h3>
    <div class="score-list">${ranking.map((r, i) => `<div class="score-row"><span class="display">${i + 1}.</span>${factionChip(r.f.id, t(`factions.${r.f.id}.short`))}<span class="grow">${esc(t(`factions.${r.f.id}.short`))}</span><span>${esc(t('diplomacy.score', { n: r.sc }))}</span></div>`).join('')}</div>
    ${statsPanel(s, host.game.viewer)}
    <div class="dialog-actions">${button(t('gameover.toMenu'), { action: 'menu', variant: 'secondary' })}${s.factions.filter((f) => f.alive).length > 1 ? button(t('gameover.continue'), { action: 'endless', icon: 'hourglass', variant: 'secondary' }) : ''}${button(t('gameover.newGame'), { action: 'new', icon: 'play' })}</div>`, { dismissable: false, wide: true, focus: '[data-action="new"]' });
  mountStats(d.node, s, host.game.viewer);
  bind(d.node, {
    endless: () => { d.close(); host.continueEndless(); },
    menu: () => { d.close(); host.showMenu(); },
    new: () => { d.close(); host.showMenu(); const m = host.root.querySelector('.screen'); if (m) m.replaceWith(setupScreen(host)); },
  });
}

export { FACTION_EMBLEM };

// ---------- Speicherstaende / save slots ----------
export function slotsDialog(host: ScreenHost, slots: ({ slot: number; savedAt: number; round: number; faction: string; mode: string; size: number; name: string } | null)[],
  mode: 'save' | 'load', act: { save(i: number): void; load(i: number): void; remove(i: number): void }) {
  const canSave = mode === 'save' && !!host.game.state;
  const fmt = (ms: number) => { try { return new Date(ms).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; } };
  const html = () => `${dialogTitle(t('saves.title'))}
    <div class="score-list">${slots.map((info, i) => `
      <div class="score-row slot-row">
        <span class="display">${i + 1}</span>
        ${info ? `${factionBadge(info.faction as FactionId)}<div class="grow col"><strong>${esc(info.name)}</strong>
          <span class="muted">${esc(t(`modes.${info.mode}`))} · ${esc(t('setup.tiles', { n: info.size }))} · ${esc(t('hud.round'))} ${info.round} · ${esc(fmt(info.savedAt))}</span></div>`
          : `<div class="grow muted">${esc(t('saves.empty'))}</div>`}
        <div class="row">
          ${canSave ? button(t('saves.saveHere'), { action: `save-${i}`, icon: 'save', variant: info ? 'secondary' : 'primary' }) : ''}
          ${info ? button(t('saves.load'), { action: `load-${i}`, icon: 'play', variant: canSave ? 'secondary' : 'primary' }) : ''}
          ${info ? iconButton('trash', t('saves.delete'), `del-${i}`) : ''}
        </div>
      </div>`).join('')}</div>`;
  const d = openDialog(host.root, html());
  d.node.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    const a = b.dataset.action!;
    if (a === 'close') { d.close(); return; }
    const [kind, idx] = a.split('-');
    const i = Number(idx);
    if (kind === 'save') { act.save(i); d.close(); }
    else if (kind === 'load') { d.close(); act.load(i); }
    else if (kind === 'del') {
      if (!(await confirmDialog(host, t('saves.deleteConfirm', { n: i + 1 }), t('saves.delete'), t('saves.delete')))) return;
      act.remove(i); slots[i] = null; rerender(d.node, html());
    }
  });
}

/** Fraktionsfenster mit Anfuehrer und Hintergrund / faction window with leader and background */
export function factionDialog(root: HTMLElement, f: FactionId) {
  const d = openDialog(root, `${dialogTitle(t(`factions.${f}.name`))}${factionDetails(f)}`, { wide: true });
  d.node.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-action="close"]')) { d.close(); return; }
    const lore = el.closest<HTMLElement>('[data-lore]');
    if (lore) openLore(root, lore.dataset.lore as FactionId);
  });
}
