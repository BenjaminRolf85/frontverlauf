/**
 * Bildschirme und Dialoge: Hauptmenue, Partie einrichten, Forschungsbaum (radial), Diplomatie,
 * Grossprojekte, Belohnungen, Einstellungen, Mitwirkende, Uebergabe, Spielende.
 * Screens and dialogs.
 */
import {
  ROSTERS, FACTION_IDS, GRAND_PROJECT_IDS, MAP_SIZES, MAP_TYPES, MODES, PLAYER_LIMITS, SANDBOX, START, TECHS, TECH_IDS, UNITS,
  type Difficulty, type FactionId, type GameMode, type MapSize, type MapType, type TechId,
} from '../data/balance';
import {
  cityById, embassyCost, grandProjectConditionMet, hqOf, isExplored, researchCost, rewardOptions, score, techState,
  techUnlocks, unitAt, cityAt, canSeeUnit, defaultConfig, hashSeed, type GameConfig,
} from '../core';
import type { Controller } from '../game/controller';
import { getLanguage, setLanguage, t } from '../i18n/i18n';
import type { Settings } from '../save/save';
import { button, dialogTitle, esc, factionBadge, factionChip, iconButton, openDialog, price, segmented } from './components';
import { FACTION_EMBLEM, icon, iconAt } from './icons';
import { cityName, unitName } from './hud';

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
}

function bind(node: HTMLElement, handlers: Record<string, (el: HTMLElement) => void>) {
  node.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (b && handlers[b.dataset.action!]) handlers[b.dataset.action!](b);
  });
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
        ${button(t('saves.title'), { icon: 'folder', action: 'slots', block: true, variant: 'secondary' })}
        ${button(t('menu.tutorial'), { icon: 'tutorial', action: 'tutorial', block: true, variant: 'secondary' })}
        ${button(t('menu.importFile'), { icon: 'upload', action: 'import', block: true, variant: 'secondary' })}
        <div class="row">${button(t('menu.settings'), { icon: 'settings', action: 'settings', variant: 'secondary', cls: 'grow' })}${button(t('menu.credits'), { icon: 'info', action: 'credits', variant: 'secondary', cls: 'grow' })}</div>
        ${segmented('lang', [{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }], getLanguage())}
      </nav>`;
  };
  render();
  bind(n, {
    continue: () => host.continueGame(),
    slots: () => host.openSlots('load'),
    new: () => { n.replaceWith(setupScreen(host)); },
    tutorial: () => host.startTutorial(),
    import: () => host.loadFromFile(),
    settings: () => settingsDialog(host, render),
    credits: () => creditsDialog(host),
  });
  n.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-seg="lang"]');
    if (b) { host.settings.lang = b.dataset.value as 'de' | 'en'; setLanguage(host.settings.lang); host.applySettings(); render(); }
  });
  return n;
}

// ---------- Partie einrichten / game setup ----------
export function setupScreen(host: ScreenHost): HTMLElement {
  const n = document.createElement('div');
  n.className = 'screen';
  const cfg = {
    weather: true,
    mode: 'points' as GameMode, size: 14 as MapSize, mapType: 'continents' as MapType, startStars: START.stars,
    seed: String(Math.floor(Math.random() * 1e6)),
    players: [
      { id: 'korvat' as FactionId, human: true, difficulty: 'normal' as Difficulty },
      { id: 'dravon' as FactionId, human: false, difficulty: 'normal' as Difficulty },
      { id: 'alvenia' as FactionId, human: false, difficulty: 'normal' as Difficulty },
      { id: 'meridon' as FactionId, human: false, difficulty: 'normal' as Difficulty },
    ],
  };
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
        <div class="field"><span class="label">${esc(t('weather.title'))}</span>
          ${segmented('weather', [{ value: 'on', label: t('settings.on') }, { value: 'off', label: t('settings.off') }], cfg.weather ? 'on' : 'off')}
          <span class="muted">${esc(t('weather.setupHint'))}</span></div>
        ${sandbox ? `<div class="field"><span class="label">${esc(t('setup.startStars'))}</span>
          ${segmented('stars', SANDBOX.startStarsOptions.map((v) => ({ value: String(v), label: String(v) })), String(cfg.startStars))}</div>` : ''}
        <div class="field"><span class="label">${esc(t('setup.players'))} (${cfg.players.length})</span>
          <span class="muted">${esc(t('setup.hotseatHint'))}</span>
          ${cfg.players.map((p, i) => `
            <div class="player-row slot">
              <div class="slot-head"><span class="slot-no display">${esc(t('setup.slot', { n: i + 1 }))}</span>
                ${cfg.players.length > PLAYER_LIMITS.min ? iconButton('minus', t('setup.removePlayer'), `remove-${i}`) : ''}</div>
              <button type="button" class="slot-pick" data-action="pick-${i}" aria-label="${esc(t('setup.chooseFaction'))}: ${esc(t(`factions.${p.id}.name`))}">
                ${factionBadge(p.id)}
                <span class="col grow"><strong>${esc(t(`factions.${p.id}.name`))}</strong>
                  <span class="muted">${esc(t(`factions.${p.id}.perk`))}${ROSTERS[p.id] ? ` · ${esc(t('setup.special'))}` : ''}</span></span>
                <span class="slot-cta">${icon('next', 'icon-sm')}<span class="label">${esc(t('setup.chooseFaction'))}</span></span>
              </button>
              ${segmented(`human-${i}`, [{ value: 'human', label: t('setup.human') }, { value: 'ai', label: t('setup.ai') }], p.human ? 'human' : 'ai')}
              ${!p.human ? segmented(`diff-${i}`, (['easy', 'normal', 'hard', 'extreme'] as Difficulty[]).map((d) => ({ value: d, label: t(`difficulty.${d}`) })), p.difficulty) : ''}
            </div>`).join('')}
          ${cfg.players.length < PLAYER_LIMITS.max ? button(t('setup.addPlayer'), { icon: 'plus', action: 'add', variant: 'secondary' }) : ''}
        </div>
        <div class="field"><label for="seed">${esc(t('setup.seed'))}</label>
          <div class="row"><input id="seed" type="text" value="${esc(cfg.seed)}" class="grow" inputmode="numeric">${button(t('setup.randomSeed'), { action: 'seed', variant: 'secondary' })}</div></div>
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
        return `<button type="button" class="faction-card" data-pick="${f}" aria-pressed="${current}">
          ${factionBadge(f)}
          <span class="col grow"><strong>${esc(t(`factions.${f}.name`))}</strong>
            <span class="muted">${esc(t(`factions.${f}.perk`))}: ${esc(t(`factions.${f}.perkDesc`))}</span>
            <span class="row">${ROSTERS[f] ? `<span class="tag">${esc(t('setup.special'))}</span>` : ''}
              ${current ? `<span class="tag">${esc(t('setup.current'))}</span>` : other >= 0 ? `<span class="tag warn">${esc(t('setup.takenBy', { n: other + 1 }))}</span>` : ''}</span></span>
        </button>`;
      }).join('')}</div>`;
    const d = openDialog(n, html, { wide: true });
    d.node.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-action="close"]')) { d.close(); return; }
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
    const seg = target.closest<HTMLElement>('[data-seg]');
    if (seg) {
      const key = seg.dataset.seg!, v = seg.dataset.value!;
      if (key === 'mode') cfg.mode = v as GameMode;
      else if (key === 'size') cfg.size = Number(v) as MapSize;
      else if (key === 'mapType') cfg.mapType = v as MapType;
      else if (key === 'stars') cfg.startStars = Number(v);
      else if (key === 'weather') cfg.weather = v === 'on';
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
      <div class="field"><span class="label">${esc(t('settings.animations'))}</span>${onOff('animations', s.animations)}</div>
      <div class="field"><span class="label">${esc(t('settings.barks'))}</span>${onOff('barks', s.barks)}</div>
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
    else if (k === 'music' || k === 'effects' || k === 'animations' || k === 'barks') s[k] = v === 'on';
    else if (k === 'aiSpeed') s.aiSpeed = v as Settings['aiSpeed'];
    else if (k === 'quality') s.quality = v as Settings['quality'];
    host.applySettings();
    d.node.innerHTML = html();
  });
}

export function creditsDialog(host: ScreenHost) {
  const d = openDialog(host.root, `${dialogTitle(t('credits.title'))}
    <div class="col">
      ${['game', 'models', 'sound', 'fontBlackOps', 'fontBangers', 'fontComicNeue', 'three', 'vite'].map((k) => `<p>${esc(t(`credits.${k}`))}</p>`).join('')}
      <p class="muted">${esc(t('credits.disclaimer'))}</p>
    </div>`);
  bind(d.node, { close: () => d.close() });
}

// ---------- Pausenmenue / pause menu ----------
export function pauseMenu(host: ScreenHost) {
  const d = openDialog(host.root, `${dialogTitle(t('menu.pause'))}
    <nav class="menu-list">
      ${button(t('menu.resume'), { icon: 'play', action: 'close', block: true })}
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
    save: () => { host.saveNow(); d.close(); },
    slots: () => { d.close(); host.openSlots('save'); },
    export: () => host.exportGame(),
    import: () => { d.close(); host.loadFromFile(); },
    vr: () => { d.close(); host.xr.enter('vr'); },
    ar: () => { d.close(); host.xr.enter('ar'); },
    settings: () => settingsDialog(host),
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
  const html = () => {
    const s = g.state!;
    const f = g.viewer >= 0 ? g.viewer : s.current;
    let links = '', nodes = '';
    for (const id of TECH_IDS) {
      const p = layout.get(id)!;
      const parent = TECHS[id].parent;
      const from = parent ? layout.get(parent)! : { x: C, y: C };
      const done = s.factions[f].techs.includes(id);
      links += `<line class="tech-link ${done ? 'done' : ''}" x1="${from.x}" y1="${from.y}" x2="${p.x}" y2="${p.y}"/>`;
    }
    for (const id of TECH_IDS) {
      const p = layout.get(id)!;
      const st = techState(s, f, id);
      const cost = researchCost(s, f, id);
      const name = t(`techs.${id}`);
      const words = name.split(/[\s-]/);
      const lines = words.length > 1 && name.length > 12 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [name];
      nodes += `<g class="tech-node ${st} ${selected === id ? 'selected' : ''}" data-tech="${id}" role="button" tabindex="0" aria-label="${esc(name)}: ${esc(t(`tech.${st}`))}, ${cost}">
        <circle class="disc" cx="${p.x}" cy="${p.y}" r="30"/>
        ${st === 'researched' ? iconAt('check', p.x - 14, p.y - 14, 28) : st === 'locked' ? iconAt('lock', p.x - 12, p.y - 12, 24) : `<text x="${p.x}" y="${p.y + 6}" text-anchor="middle" class="cost">${cost}</text>`}
        ${lines.map((l, i) => `<text class="name" x="${p.x}" y="${p.y + 46 + i * 13}" text-anchor="middle">${esc(l)}</text>`).join('')}
      </g>`;
    }
    const legend = (['researched', 'available', 'expensive', 'locked'] as const).map((k) => `<span><i style="background:var(--c-tech-node-${k})"></i>${esc(t(`tech.${k}`))}</span>`).join('');
    return `${dialogTitle(t('tech.title'))}
      <div class="row"><span class="res"><span class="star">${icon('star')}</span><span class="val">${s.factions[f].stars}</span></span><span class="muted">${esc(t('tech.costFormula'))}</span></div>
      <div class="legend">${legend}</div>
      <div class="tech-wrap"><svg class="tech-svg" viewBox="0 0 800 800" role="group" aria-label="${esc(t('tech.title'))}">
        ${links}<circle cx="${C}" cy="${C}" r="44" class="tech-center"/>
        ${iconAt('research', C - 18, C - 18, 36)}${nodes}</svg></div>`;
  };
  const d = openDialog(host.root, html(), { wide: true });
  d.node.addEventListener('click', async (e) => {
    const target = e.target as Element;
    if (target.closest('[data-action="close"]')) { d.close(); return; }
    const node = target.closest<SVGGElement>('[data-tech]');
    if (node) {
      selected = node.dataset.tech as TechId;
      g.play('select');
      d.node.innerHTML = html();
      techInfoBox(host, selected, () => { selected = null; d.node.innerHTML = html(); });
    }
  });
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
  const unitRows = un.units.map((u) => {
    const us = UNITS[u];
    return `<li class="unlock">${icon('helmet', 'icon-sm')}<strong>${esc(t(`units.${u}`))}</strong>
      <span class="muted">${esc(t('stats.attack'))} ${us.attack} · ${esc(t('stats.defense'))} ${us.defense} · ${esc(t('stats.move'))} ${us.move} · ${esc(t('stats.range'))} ${us.range || esc(t('stats.noRange'))}${us.cost !== null ? ` · ${us.cost} ${esc(t('hud.stars'))}` : ''}</span></li>`;
  });
  const buildingRows = [...new Set(un.buildings)].map((b) => `<li class="unlock">${icon('build', 'icon-sm')}<strong>${esc(t(`buildings.${b}`))}</strong><span class="muted">${esc(t(`buildingDesc.${b}`))}</span></li>`);
  const extra = t(`techExtra.${tech}`);
  const extraRows = extra.startsWith('techExtra.') ? [] : [`<li class="unlock">${icon('lightning', 'icon-sm')}<strong>${esc(extra)}</strong></li>`];
  let reason = '';
  if (st === 'researched') reason = t('tech.done');
  else if (st === 'locked' && parent) reason = t('tech.needParent', { tech: t(`techs.${parent}`) });
  else if (st === 'expensive') reason = t('tech.missingStars', { n: cost - fa.stars });
  else if (!canAct) reason = t('tech.notYourTurn');
  const canResearch = st === 'available' && canAct;
  const box = openDialog(host.root, `<div class="panel-title"><h2 class="display">${esc(t(`techs.${tech}`))}</h2>${iconButton('close', t('actions.close'), 'cancel')}</div>
    <div class="row"><span class="tag">${esc(t('tech.tier', { n: TECHS[tech].tier }))}</span><span class="tag ${st === 'researched' ? 'ok' : st === 'available' ? '' : 'warn'}">${esc(t(`tech.${st}`))}</span></div>
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
      ${st !== 'researched' ? button(t('tech.confirm'), { action: 'confirm', icon: 'research', disabled: !canResearch, extra: price(cost) }) : ''}
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
      const contact = me.contacts.includes(o.index);
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
            btns.push(button(t('diplomacy.embassy', { cost }), { action: `embassy-${o.index}`, variant: 'secondary', icon: 'city', disabled: me.stars < cost }));
          }
        }
        actions = `<div class="row">${tags.join('')}</div><div class="row">${btns.join('')}</div>`;
      }
      return `<div class="player-row">${factionBadge(o.id)}<div class="col"><strong>${esc(name)}</strong><span class="muted">${esc(t(`factions.${o.id}.alignment`))} · ${esc(t('diplomacy.score', { n: score(s, o.index) }))}</span></div><div class="col span-all">${actions}</div></div>`;
    }).join('');
    return `${dialogTitle(t('diplomacy.title'))}<div class="col">${rows}</div><p class="muted">${esc(t('diplomacy.breakHint'))} ${esc(t('diplomacy.embassyHint'))}</p>`;
  };
  const d = openDialog(host.root, html());
  d.node.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    const a = b.dataset.action!;
    if (a === 'close') { d.close(); return; }
    const [kind, idx] = a.split('-');
    const map: Record<string, 'proposePeace' | 'acceptPeace' | 'declinePeace' | 'announceBreak' | 'embassy'> = {
      peace: 'proposePeace', accept: 'acceptPeace', decline: 'declinePeace', break: 'announceBreak', embassy: 'embassy',
    };
    if (map[kind]) { await g.exec({ type: 'diplomacy', action: map[kind], target: Number(idx) }); d.node.innerHTML = html(); }
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
    return `<div class="score-row">${icon(built ? 'check' : unlocked ? 'grand' : 'lock')}<div class="grow"><strong>${esc(t(`grand.${id}`))}</strong><div class="muted">${esc(t(`grand.${id}Cond`))}</div></div><span class="tag ${built ? 'ok' : unlocked ? 'warn' : ''}">${esc(t(`grand.${st}`))}</span></div>`;
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
    html += `<h3 class="display">${esc(unitName(u))}</h3>
      <div class="kv"><span>${esc(t('stats.hp'))}</span><span>${u.hp} / ${u.maxHp}</span>
      <span>${esc(t('stats.attack'))}</span><span>${st.attack}</span><span>${esc(t('stats.defense'))}</span><span>${st.defense}</span>
      <span>${esc(t('stats.move'))}</span><span>${st.move}</span><span>${esc(t('stats.range'))}</span><span>${st.range || esc(t('stats.noRange'))}</span>
      <span>${esc(t('stats.cost'))}</span><span>${st.cost ?? '-'}</span><span>${esc(t('stats.kills'))}</span><span>${u.kills}</span></div>
      <ul>${st.abilities.filter((a) => a !== 'carry').map((a) => `<li><strong>${esc(t(`abilities.${a}`))}:</strong> ${esc(t(`abilities.${a}Desc`))}</li>`).join('')}</ul>`;
  }
  if (c) {
    html += `<h3 class="display">${esc(cityName(s, c.id))}</h3><p>${c.owner === null ? esc(t('features.village')) : `${factionChip(s.factions[c.owner].id, t(`factions.${s.factions[c.owner].id}.short`))} ${esc(t('hud.level', { n: c.level }))}`}</p>`;
  }
  html += `<h3 class="display">${esc(t(`terrain.${tile.terrain}`))}${tile.biome ? ` · ${esc(t(`biomes.${tile.biome}`))}` : ''}${tile.river ? ` · ${esc(t('biomes.river'))}` : ''}</h3><p>${[tile.resource ? t(`resources.${tile.resource}`) : '', tile.building ? `${t(`buildings.${tile.building}`)}: ${t(`buildingDesc.${tile.building}`)}` : '', tile.feature ? t(`features.${tile.feature}`) : ''].filter(Boolean).map(esc).join(' · ')}</p>`;
  const d = openDialog(host.root, html);
  bind(d.node, { close: () => d.close() });
}

export function confirmDialog(host: ScreenHost, text: string, ok: string): Promise<boolean> {
  return new Promise((resolve) => {
    const d = openDialog(host.root, `<div class="panel-title"><h2 class="display">${icon('warning')}</h2></div><p>${esc(text)}</p>
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
    <h3 class="display">${esc(t('gameover.scores'))}</h3>
    <div class="score-list">${ranking.map((r, i) => `<div class="score-row"><span class="display">${i + 1}.</span>${factionChip(r.f.id, t(`factions.${r.f.id}.short`))}<span class="grow">${esc(t(`factions.${r.f.id}.short`))}</span><span>${esc(t('diplomacy.score', { n: r.sc }))}</span></div>`).join('')}</div>
    <div class="dialog-actions">${button(t('gameover.toMenu'), { action: 'menu', variant: 'secondary' })}${s.factions.filter((f) => f.alive).length > 1 ? button(t('gameover.continue'), { action: 'endless', icon: 'hourglass', variant: 'secondary' }) : ''}${button(t('gameover.newGame'), { action: 'new', icon: 'play' })}</div>`, { dismissable: false });
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
  const fmt = (ms: number) => { try { return new Date(ms).toLocaleString(); } catch { return ''; } };
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
          ${info ? iconButton('close', t('saves.delete'), `del-${i}`) : ''}
        </div>
      </div>`).join('')}</div>`;
  const d = openDialog(host.root, html());
  d.node.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    const a = b.dataset.action!;
    if (a === 'close') { d.close(); return; }
    const [kind, idx] = a.split('-');
    const i = Number(idx);
    if (kind === 'save') { act.save(i); d.close(); }
    else if (kind === 'load') { d.close(); act.load(i); }
    else if (kind === 'del') { act.remove(i); slots[i] = null; d.node.innerHTML = html(); }
  });
}
