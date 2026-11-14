/** Einstiegspunkt / entry point */
import './ui/styles.css';
import './ui/overview.css';
import type { GameConfig, GameState } from './core';
import { audio } from './audio/audio';
import { Controller } from './game/controller';
import { detectLanguage, onLanguageChange, setLanguage, t } from './i18n/i18n';
import { attachPointer } from './input/pointer';
import { clearLabelCache } from './render/labels';
import { View } from './render/view';
import { clearSave, deleteSlot, exportFile, hasSave, importFile, listSlots, loadFromSlot, loadGame, loadSettings, saveGame, saveSettings, saveToSlot, type Settings } from './save/save';
import { continueEndless } from './core';
import { cityName as cityNameOf } from './ui/hud';
import { toast } from './ui/components';
import { Fx } from './ui/fx';
import { Barks } from './ui/barks';
import { Hud, cityName, unitName } from './ui/hud';
import {
  slotsDialog, confirmDialog, detailsDialog, diplomacyDialog, gameOverScreen, grandDialog, handoverScreen, mainMenu, pauseMenu,
  researchDialog, rewardDialog, type ScreenHost,
} from './ui/screens';
import { TUTORIAL_CONFIG, Tutorial } from './ui/tutorial';
import { Minimap } from './ui/minimap';
import { XrSession } from './xr/xr';
import { ObjectivePanel, campaignResult, objectiveToast } from './ui/campaign';
import { showRandomEvent } from './ui/events';

function boot() {
  const app = document.getElementById('app')!;
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const root = document.getElementById('ui')!;
  const settings: Settings = loadSettings();
  setLanguage(settings.lang ?? detectLanguage());

  let view: View;
  try {
    view = new View(canvas);
  } catch {
    root.innerHTML = `<div class="screen"><div class="panel form"><p>${t('errors.webgl')}</p></div></div>`;
    return;
  }
  const game = new Controller(view);
  const fx = new Fx(root, view);
  const barks = new Barks(root, view);
  let tutorial: Tutorial | null = null;
  let menuNode: HTMLElement | null = null;
  const xr = new XrSession(view, game);

  const host: ScreenHost = {
    root, game, settings,
    applySettings() {
      saveSettings(settings);
      audio.musicOn = settings.music;
      audio.effectsOn = settings.effects;
      audio.setAmbienceOn(settings.ambience);
      view.board.animations = settings.animations;
      fx.enabled = settings.animations;
      barks.enabled = settings.barks;
      app.classList.toggle('no-anim', !settings.animations);
      game.aiSpeed = settings.aiSpeed;
      view.setQuality(settings.quality);
    },
    startGame(cfg: GameConfig) {
      tutorial?.finish(); tutorial = null;
      hideMenu();
      game.newGame(cfg);
      game.autosave();
    },
    continueGame() {
      const s = loadGame();
      if (!s) { toast(root, t('menu.loadFailed'), 'warning'); return; }
      hideMenu();
      game.load(s);
    },
    async loadFromFile() {
      const s = await importFile();
      if (!s) { toast(root, t('menu.importFailed'), 'warning'); return; }
      hideMenu();
      game.load(s);
      saveGame(s);
    },
    exportGame() { if (game.state) exportFile(game.state); },
    saveNow() {
      if (!game.state) return;
      toast(root, saveGame(game.state) ? t('menu.saved') : t('menu.storageUnavailable'), saveGame(game.state) ? 'save' : 'warning');
    },
    hasSave: () => hasSave(),
    openSlots(mode) {
      slotsDialog(host, listSlots(), mode, {
        save: (i) => {
          if (!game.state) return;
          const s = game.state;
          const hq = s.cities.find((c) => c.isHQ && c.owner !== null && s.factions[c.owner].human);
          const name = `${t(`factions.${(s.factions.find((f) => f.human) ?? s.factions[0]).id}.short`)}${hq ? ` · ${cityNameOf(s, hq.id)}` : ''}`;
          toast(root, saveToSlot(i, s, name) ? t('saves.saved', { n: i + 1 }) : t('menu.storageUnavailable'), 'save');
        },
        load: (i) => {
          const s = loadFromSlot(i);
          if (!s) { toast(root, t('menu.loadFailed'), 'warning'); return; }
          hideMenu();
          game.load(s);
          saveGame(s);
        },
        remove: (i) => deleteSlot(i),
      });
    },
    continueEndless() {
      if (!game.state) return;
      continueEndless(game.state);
      game.load(game.state);
      game.autosave();
    },
    startTutorial() {
      host.startGame(TUTORIAL_CONFIG);
      tutorial = new Tutorial(root, game, () => { settings.tutorialDone = true; saveSettings(settings); tutorial = null; });
    },
    xr: {
      get vr() { return xr.supported.vr; },
      get ar() { return xr.supported.ar; },
      enter: (mode) => void xr.start(mode),
    },
    showMenu() {
      tutorial?.finish(); tutorial = null;
      barks.clear();
      hud.show(false);
      objectives.show(false);
      root.querySelectorAll('.screen, .overlay, .headline').forEach((n) => n.remove());
      menuNode = mainMenu(host);
      root.appendChild(menuNode);
      audio.menuMusic();
    },
  };

  const hud = new Hud(root, game, {
    openResearch: () => researchDialog(host),
    openDiplomacy: () => diplomacyDialog(host),
    openMenu: () => pauseMenu(host),
    openGrand: () => grandDialog(host),
    openDetails: () => { if (game.selected) detailsDialog(host, game.selected.x, game.selected.y); },
  });
  xr.actionsProvider = () => hud.currentActions();
  // Lagekarte: nur im Spiel sichtbar / overview map: visible in game only
  const minimap = new Minimap(root, game, () => !menuNode);
  // Einsatzziele (nur Kampagne) / objectives (campaign only)
  const objectives = new ObjectivePanel(root);
  const hideMenu = () => { menuNode?.remove(); menuNode = null; root.querySelectorAll('.screen').forEach((n) => n.remove()); hud.show(true); objectives.show(true); };

  let rewardOpen = false;
  let lastWeather: string | null = null;
  game.ui = {
    update() { hud.render(); objectives.render(game.state); tutorial?.check(); xr.refreshPanels(); minimap.invalidate(); },
    toast: (text, ic) => toast(root, text, ic),
    errorCode: (code) => toast(root, t(`errors.${code}`), 'warning'),
    event(e, s: GameState) {
      const viewer = game.viewer;
      const fname = (i: number) => t(`factions.${s.factions[i].id}.short`);
      switch (e.t) {
        case 'contact': if (e.a === viewer) toast(root, t('events.contact', { name: fname(e.b), stars: e.stars }), 'diplomacy'); break;
        case 'capture': if (e.faction === viewer || e.from === viewer) toast(root, t('events.capture', { name: fname(e.faction), city: cityName(s, e.city) }), 'capture'); break;
        case 'research': if (e.faction === viewer) toast(root, t('events.research', { tech: t(`techs.${e.tech}`) }), 'research'); break;
        case 'veteran': { const u = s.units.find((x) => x.id === e.unit); if (u && u.owner === viewer) toast(root, t('events.veteran', { unit: unitName(u) }), 'medal'); break; }
        case 'bunker': if (e.faction === viewer) toast(root, t(`events.bunker${e.reward[0].toUpperCase()}${e.reward.slice(1)}`), 'star'); break;
        case 'radar': if (e.faction === viewer) toast(root, t('events.radar', { n: s.factions[viewer].radarsFound.length }), 'range'); break;
        case 'crash': toast(root, t('events.crash'), 'warning'); break;
        case 'flak': toast(root, t('events.flak', { dmg: e.dmg }), 'attack'); break;
        case 'cityUpgrade': if (e.faction === viewer) toast(root, t('events.cityUpgrade', { name: t(`cityUpgrades.${e.upgrade}`), city: cityName(s, e.city) }), 'city'); break;
        case 'turn': {
          if (e.weather && e.weather !== lastWeather && s.factions[e.faction].human) {
            if (lastWeather !== null || e.weather !== 'clear') toast(root, `${t(`weather.${e.weather}`)}: ${t(`weather.${e.weather}Desc`)}`, ({ clear: 'sun', rain: 'rain', snow: 'snow', wind: 'wind' } as Record<string, string>)[e.weather]);
            lastWeather = e.weather;
          }
          break;
        }
        case 'barrierHit': { const u = s.units.find((x) => x.id === e.unit); if (u && (u.owner === viewer || s.tiles[e.y * s.size + e.x].barrier?.owner === viewer)) toast(root, t('events.barrierHit'), 'shield'); break; }
        // Konter: Minen und Flak / counters: mines and flak
        case 'mineHit': if (e.owner === viewer || s.current === viewer) toast(root, t('events.mineHit', { dmg: e.dmg }), 'warning'); break;
        case 'aaFire': toast(root, t('events.aaFire', { dmg: e.dmg }), 'attack'); break;
        case 'uprising': toast(root, t('events.uprising', { city: cityName(s, e.city) }), 'warning'); break;
        case 'peace': if (e.a === viewer || e.b === viewer) toast(root, t('events.peace', { a: fname(e.a), b: fname(e.b) }), 'diplomacy'); break;
        case 'peaceOffer': if (e.to === viewer) toast(root, t('events.peaceOffer', { name: fname(e.from) }), 'diplomacy'); break;
        case 'peaceDeclined': if (e.to === viewer) toast(root, t('events.peaceDeclined', { name: fname(e.from) }), 'diplomacy'); break;
        case 'breakAnnounced': if (e.to === viewer) toast(root, t('events.breakAnnounced', { name: fname(e.from) }), 'warning'); break;
        case 'war': if (e.a === viewer || e.b === viewer) toast(root, t('events.war', { a: fname(e.a), b: fname(e.b) }), 'warning'); break;
        case 'embassy': if (e.from === viewer || e.to === viewer) toast(root, t('events.embassy', { name: fname(e.from === viewer ? e.to : e.from) }), 'city'); break;
        case 'unlockGrand': if (e.faction === viewer) toast(root, t('events.grandUnlocked', { name: t(`grand.${e.id}`) }), 'grand'); break;
        case 'grandProject': if (e.faction === viewer) toast(root, t('events.grandBuilt', { name: t(`grand.${e.id}`) }), 'grand'); break;
        case 'connected': { const c = s.cities.find((x) => x.id === e.city); if (c && c.owner === viewer) toast(root, t('events.connected', { city: cityName(s, e.city) }), 'move'); break; }
        case 'eliminated': toast(root, t('events.eliminated', { name: fname(e.faction) }), 'warning'); break;
        case 'convert': toast(root, t('events.convert'), 'heal'); break;
        case 'randomEvent': showRandomEvent(root, e, s, viewer); break;
        case 'objective': objectiveToast(root, s, e.index, e.bonus, e.status); break;
      }
    },
    fx: (kind, x, y, text) => { if (game.state) fx.show(game.state, kind, x, y, text); },
    afterCommand(events) { if (game.state) barks.onEvents(game.state, events, game.viewer, new Map()); },
    unitSelected(u) { if (game.state) { audio.unitVoice(u.type, game.state.factions[u.owner].id); barks.say(game.state, u, barks.situation(game.state, u) ?? 'select'); } },
    turnStarted() { if (game.state) barks.onTurnStart(game.state, game.viewer); },
    handover: (f) => handoverScreen(host, f),
    confirm: (text, ok) => confirmDialog(host, text, ok),
    gameOver: () => { if (game.state?.campaign) campaignResult(host); else gameOverScreen(host); clearSave(); },
    rewards() {
      if (rewardOpen || !game.isHumanTurn) return;
      const s = game.state!;
      if (!s.pendingRewards.some((p) => s.cities.find((c) => c.id === p.cityId)?.owner === s.current)) return;
      rewardOpen = true;
      if (xr.active) { xr.showRewards(() => { rewardOpen = false; game.ui.rewards(); }); return; }
      rewardDialog(host, () => { rewardOpen = false; game.ui.rewards(); });
    },
  };

  attachPointer(view, canvas, {
    tap: (cx, cy) => {
      const p = view.board.pick(view.raycaster(cx, cy));
      if (p) void game.tapTile(p.x, p.y);
    },
    longPress: (cx, cy) => {
      const p = view.board.pick(view.raycaster(cx, cy));
      if (p && game.state) detailsDialog(host, p.x, p.y);
    },
  });
  window.addEventListener('resize', () => { view.resize(); hud.render(); });
  window.addEventListener('keydown', (e) => {
    if (!game.state || menuNode || root.querySelector('.overlay')) return;
    if (e.key === 'q' || e.key === 'Q') view.rotate(-1);
    else if (e.key === 'e' || e.key === 'E') view.rotate(1);
    else if (e.key === '+') view.setZoom(view.zoom * 1.25);
    else if (e.key === '-') view.setZoom(view.zoom / 1.25);
    else if (e.key === 'Enter') void game.endTurn();
    else if (e.key === 'Escape') { game.clearSelection(); hud.render(); }
  });
  onLanguageChange(() => { clearLabelCache(); game.refresh(); hud.render(); xr.refreshPanels(); });
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  document.fonts?.ready.then(() => { clearLabelCache(); if (game.state) game.refresh(); });
  window.addEventListener('pagehide', () => game.autosave());

  host.applySettings();
  hud.show(false);
  host.showMenu();
  void xr.detect().then(() => { if (menuNode) { const fresh = mainMenu(host); menuNode.replaceWith(fresh); menuNode = fresh; } });
  (window as unknown as { __game: Controller }).__game = game;
}

boot();
