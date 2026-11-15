/**
 * Oberwelt im Kampagnenbildschirm: Kopf mit Weltname, Beschreibung und Fortschritt, die 3D-Buehne (eigener Renderer),
 * Weltenwahl (Punkte auf dem Handy) und eine kompakte Liste der Einsaetze der gewaehlten Welt als echte Knoepfe
 * (Tastatur, Bildschirmleser). Umschalter "Oberwelt / Liste"; ohne WebGL bleibt die bisherige Liste.
 * Overworld in the campaign screen: header with world name, description and progress, the 3D stage (own renderer),
 * world picker (dots on phones) and a compact list of the selected world's missions as real buttons (keyboard,
 * screen readers). Toggle "overworld / list"; without WebGL the existing list stays.
 *
 * Einbindung: attachOverworld(host, screen) einmal nach dem ersten Zeichnen des Kampagnenbildschirms. Die Oberwelt
 * haengt sich selbst vor die Einsatzliste (.mission-list), auch nachdem der Bildschirm neu gezeichnet wurde, und raeumt
 * sich auf, sobald der Bildschirm entfernt wird. Marker-Knoepfe tragen data-mission: Klicks laufen durch denselben
 * Pfad wie die Karten der Liste (Sperrhinweis oder Besprechung), es gibt keine zweite Besprechungslogik.
 * Integration: attachOverworld(host, screen) once after the campaign screen's first render. The overworld inserts itself
 * before the mission list (.mission-list), also after the screen re-rendered, and cleans up once the screen is removed.
 * Marker buttons carry data-mission: clicks run through the same path as the list cards (lock hint or briefing), there
 * is no second briefing logic.
 */
import './overworld.css';
import { MISSION_IDS, missionById } from '../core';
import { WORLDS, type WorldId } from '../core/worlds';
import { has, t } from '../i18n/i18n';
import { loadStore, runOf } from '../save/progress';
import type { OverworldScene } from '../render/overworld/scene';
import { esc, iconButton, segmented } from './components';
import { icon } from './icons';
import { focusWorld, newlyRevealed, overworldInfo, parseSeen, visibleWorlds, type MarkerInfo, type WorldInfo } from './overworldState';
import type { ScreenHost } from './screens';

type View = 'map' | 'list';
const VIEW_KEY = 'frontverlauf.overworld.view';

function loadView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'map'; } catch { return 'map'; }
}
function saveView(v: View) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* egal / ignore */ }
}

const SEEN_KEY = 'frontverlauf.overworld.seen.v1';
/** Gemerkte Zahl gezeigter Welten je Fraktion / remembered number of shown worlds per faction */
function loadSeen(): Record<string, number> {
  try { return parseSeen(localStorage.getItem(SEEN_KEY)); } catch { return {}; }
}
function saveSeen(f: string, n: number) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...loadSeen(), [f]: n })); } catch { /* egal / ignore */ }
}

const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** WebGL vorhanden? / WebGL available? */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

const missionTitle = (id: string) => (has(`campaign.missions.${id}.title`) ? t(`campaign.missions.${id}.title`) : t('overworld.coming'));

/** Anzahl lebender 3D-Szenen (Lecktest) / number of live 3D scenes (leak check) */
let liveScenes = 0;

class Overworld {
  readonly node: HTMLElement;
  private scene: OverworldScene | null = null;
  /** nur sichtbare Welten (verborgene haben weder Tab noch Marker) / visible worlds only (hidden ones have no tab or marker) */
  private info: WorldInfo[] = [];
  private faction = '';
  private focus: WorldId = 'earth';
  private key = '';
  private view: View = loadView();
  private gl = webglAvailable();
  private loading = false;

  constructor(private host: ScreenHost, private screen: HTMLElement) {
    this.node = document.createElement('section');
    this.node.className = 'overworld';
    this.node.setAttribute('aria-labelledby', 'ow-title');
    this.node.addEventListener('click', (e) => this.click(e));
    this.node.addEventListener('keydown', (e) => this.key_(e));
  }

  /** Mit dem Bildschirm abgleichen (nach jedem Neuzeichnen) / sync with the screen (after every re-render) */
  sync() {
    if (!this.screen.isConnected) return;
    const list = this.screen.querySelector<HTMLElement>('.mission-list');
    const st = loadStore();
    const f = st.faction;
    if (!list || !f) {
      // Fraktionswahl: keine Oberwelt / faction picker: no overworld
      this.stop();
      this.node.remove();
      this.screen.classList.remove('ow-map');
      return;
    }
    if (this.node.parentElement !== this.screen || this.node.nextElementSibling !== list) list.before(this.node);
    const p = runOf(st, f);
    const key = `${f}|${JSON.stringify(p.missions)}`;
    if (key !== this.key) {
      this.key = key;
      this.faction = f;
      const all = overworldInfo({ progress: p, order: MISSION_IDS });
      this.info = visibleWorlds(all);
      this.focus = focusWorld(all);
      this.stop();
      this.render();
    }
    this.applyView();
  }

  private world(id = this.focus) { return this.info.find((w) => w.id === id) ?? this.info[0]; }

  // ---------- DOM ----------

  private render() {
    const touch = coarse();
    this.node.innerHTML = `
      <div class="ow-head">
        <div class="ow-title grow"><h3 class="display" id="ow-title"></h3><p class="ow-desc"></p></div>
        <span class="tag ow-progress"></span>
        ${this.gl ? `<div class="ow-view" role="group" aria-label="${esc(t('overworld.view'))}">${segmented('ow-view', [{ value: 'map', label: t('overworld.viewMap') }, { value: 'list', label: t('overworld.viewList') }], this.view)}</div>` : ''}
      </div>
      ${this.gl ? `<div class="ow-stage" tabindex="0" role="group" aria-roledescription="${esc(t('overworld.title'))}" aria-label="${esc(t('overworld.stage'))}">
        <div class="ow-canvas-slot"></div>
        <div class="ow-labels" aria-hidden="true">${this.info.map((w) => `<span class="ow-label" data-world="${w.id}" hidden><strong>${esc(t(`worlds.${w.id}.name`))}</strong><span>${esc(t('overworld.progress', { n: w.won, max: w.total }))}</span></span>`).join('')}</div>
        <div class="ow-tip" hidden></div>
        <div class="ow-nav">${iconButton('next', t('overworld.prev'), 'ow-prev')}${iconButton('next', t('overworld.next'), 'ow-next')}</div>
        ${touch ? '' : `<div class="ow-zoom">${iconButton('zoomIn', t('overworld.zoomIn'), 'ow-zoom-in')}${iconButton('zoomOut', t('overworld.zoomOut'), 'ow-zoom-out')}${iconButton('map', t('overworld.overview'), 'ow-overview')}</div>`}
        <p class="ow-hint">${esc(t(touch ? 'overworld.hintSwipe' : 'overworld.hintDrag'))}</p>
      </div>` : `<p class="ow-nogl">${icon('info', 'icon-sm')}<span>${esc(t('overworld.noWebgl'))}</span></p>`}
      ${this.info.length > 1 ? `<div class="ow-tabs" role="group" aria-label="${esc(t('overworld.worlds'))}">${this.info.map((w) => `
        <button type="button" class="ow-tab" data-ow-world="${w.id}" aria-pressed="false"
          aria-label="${esc(`${t(`worlds.${w.id}.name`)}: ${t('overworld.progress', { n: w.won, max: w.total })}`)}">
          <span class="ow-dot" aria-hidden="true"></span>
          <span class="ow-tab-name" aria-hidden="true">${esc(t(`worlds.${w.id}.name`))}</span>
        </button>`).join('')}</div>` : ''}
      <div class="ow-next"></div>
      <div class="ow-missions"></div>
      <p class="ow-status sr-only" role="status" aria-live="polite"></p>`;
    this.renderWorld();
  }

  /** Kopf, Weltenwahl und Einsatzknoepfe der gewaehlten Welt / header, world picker and mission buttons of the selected world */
  private renderWorld() {
    const w = this.world();
    if (!w) return;
    const q = <T extends HTMLElement>(s: string) => this.node.querySelector<T>(s);
    q('#ow-title')!.innerHTML = `<span>${esc(t(`worlds.${w.id}.name`))}</span>`;
    q('.ow-desc')!.textContent = t(`worlds.${w.id}.desc`);
    q('.ow-progress')!.innerHTML = `${icon('map', 'icon-sm')}<span>${esc(t('overworld.progress', { n: w.won, max: w.total }))}</span>`;
    this.node.querySelectorAll<HTMLElement>('[data-ow-world]').forEach((b) => {
      const on = b.dataset.owWorld === w.id;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('on', on);
    });
    const i = this.info.indexOf(w);
    const prev = q<HTMLButtonElement>('[data-action="ow-prev"]'), next = q<HTMLButtonElement>('[data-action="ow-next"]');
    if (prev) prev.disabled = i <= 0;
    if (next) next.disabled = i >= this.info.length - 1;
    // naechster Einsatz der Welt als Karte (oeffnet die Besprechung ueber denselben Knopfweg) / next mission of the world as a card
    const cur = w.markers.find((m) => m.current) ?? w.markers.find((m) => m.state === 'available');
    const def = cur ? missionById(cur.id) : undefined;
    q('.ow-next')!.innerHTML = cur && def ? `<button type="button" class="ow-next-card" data-mission="${esc(cur.id)}" aria-label="${esc(`${t('overworld.current')}: ${t('overworld.marker', { n: cur.no, title: missionTitle(cur.id) })}`)}">
      <span class="ow-no" aria-hidden="true">${cur.no}</span><span class="col grow" aria-hidden="true"><strong>${esc(t('overworld.marker', { n: cur.no, title: missionTitle(cur.id) }))}</strong>
      <span class="muted">${esc(t('overworld.current'))} · ${esc(t(`difficulty.${def.level}`))} · ${esc(t('campaign.length', { n: def.rounds }))}</span></span>${icon('play')}<span class="tag" hidden></span></button>` : '';
    const box = q('.ow-missions')!;
    box.innerHTML = `<h4 class="sr-only" id="ow-list-title">${esc(t('overworld.markers', { world: t(`worlds.${w.id}.name`) }))}</h4>
      <ol class="ow-markers" aria-labelledby="ow-list-title">${w.markers.map((m) => `<li>${this.markerButton(m)}</li>`).join('')}</ol>`;
  }

  private markerButton(m: MarkerInfo): string {
    const title = missionTitle(m.id);
    const state = t(`overworld.state.${m.state}`);
    const label = [t('overworld.marker', { n: m.no, title }), state, m.state === 'won' ? t('overworld.stars', { n: m.stars }) : '', m.current ? t('overworld.current') : '', m.finale ? t('overworld.finale') : '']
      .filter(Boolean).join('. ');
    const no = m.state === 'locked' ? icon('lock', 'icon-sm') : m.state === 'coming' ? '?' : String(m.no);
    const stars = m.state === 'won' ? `<span class="stars" aria-hidden="true">${[0, 1, 2].map((k) => `<span class="${k < m.stars ? 'on' : ''}">${icon('star')}</span>`).join('')}</span>` : '';
    // Gesperrte tragen data-mission: der Klick zeigt den Sperrhinweis der Liste im letzten .tag
    // locked ones carry data-mission: the click shows the list's lock hint in the last .tag
    const attr = m.state === 'coming' ? `data-ow-coming="${esc(m.id)}" aria-disabled="true"` : `data-mission="${esc(m.id)}" aria-disabled="${m.state === 'locked'}"`;
    return `<button type="button" class="ow-marker ${m.state} ${m.current ? 'current' : ''} ${m.finale ? 'finale' : ''}" ${attr} aria-label="${esc(label)}">
      <span class="ow-no" aria-hidden="true">${no}</span><span class="ow-name" aria-hidden="true">${esc(title)}</span>${stars}<span class="tag" aria-hidden="true">${esc(state)}</span></button>`;
  }

  private applyView() {
    const map = this.gl && this.view === 'map';
    this.screen.classList.toggle('ow-map', map);
    this.node.classList.toggle('list', !map);
    this.node.querySelectorAll<HTMLElement>('[data-seg="ow-view"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === this.view)));
    if (map) void this.start();
    else this.stop();
  }

  // ---------- 3D-Szene / 3D scene ----------

  private async start() {
    if (this.scene || this.loading || !this.gl) return;
    const slot = this.node.querySelector<HTMLElement>('.ow-canvas-slot');
    if (!slot) return;
    this.loading = true;
    const key = this.key;
    try {
      const { OverworldScene } = await import('../render/overworld/scene');
      // inzwischen geschlossen oder neu gezeichnet? / closed or re-rendered meanwhile?
      if (!this.screen.isConnected || key !== this.key || this.view !== 'map' || this.scene || !slot.isConnected) return;
      const canvas = document.createElement('canvas');
      canvas.className = 'ow-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      slot.replaceChildren(canvas);
      const s = this.host.settings;
      this.scene = new OverworldScene({
        canvas, quality: s.quality, animations: s.animations, touch: coarse(),
        worlds: this.info, focus: this.focus, reveal: this.reveal(),
        onPick: (id) => this.pick(id),
        onFocus: (id) => { this.focus = id; this.host.game.play('click'); this.renderWorld(); },
        onHover: (id, x, y) => this.tip(id, x, y),
        onLabels: (list) => this.labels(list),
      });
      liveScenes++;
      exposeDebug(this);
    } catch (e) {
      console.error(e);
      this.gl = false;
      this.scene = null;
      this.render();
      this.applyView();
    } finally {
      this.loading = false;
    }
  }

  /**
   * Welten, die diese Fraktion zum ersten Mal sieht; danach gemerkt. Ohne Animationen wird nur gemerkt.
   * Worlds this faction sees for the first time; remembered afterwards. Without animations it is only remembered.
   */
  private reveal(): WorldId[] {
    const seen = loadSeen()[this.faction];
    const ids = newlyRevealed(this.info.length, seen).map((i) => this.info[i].id);
    if (seen !== this.info.length) saveSeen(this.faction, Math.max(seen ?? 1, this.info.length));
    return this.host.settings.animations ? ids : [];
  }

  stop() {
    if (!this.scene) return;
    this.scene.dispose();
    this.scene = null;
    liveScenes--;
    this.node.querySelector('.ow-canvas-slot')?.replaceChildren();
  }

  get stats() { return this.scene?.stats() ?? null; }
  /** Bildschirmlage eines Markers relativ zum Canvas (Tests) / screen position of a marker relative to the canvas (tests) */
  markerAt(id: string) { return this.scene?.markerScreen(id) ?? null; }

  private labels(list: { id: WorldId; x: number; y: number; visible: boolean }[]) {
    for (const l of list) {
      const el = this.node.querySelector<HTMLElement>(`.ow-label[data-world="${l.id}"]`);
      if (!el) continue;
      el.hidden = !l.visible;
      el.style.transform = `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px) translate(-50%, -50%)`;
      el.classList.toggle('on', l.id === this.focus);
    }
  }

  private tip(id: string | null, x: number, y: number) {
    const el = this.node.querySelector<HTMLElement>('.ow-tip');
    if (!el) return;
    const m = id ? this.info.flatMap((w) => w.markers).find((k) => k.id === id) : undefined;
    if (!m) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<strong>${esc(t('overworld.marker', { n: m.no, title: missionTitle(m.id) }))}</strong><span>${esc(t(`overworld.state.${m.state}`))}</span>`;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /** Marker in 3D gewaehlt: ueber den Knopf der Liste, also derselbe Weg wie ein Klick / marker picked in 3D: via the list button */
  private pick(id: string) {
    const b = this.node.querySelector<HTMLElement>(`[data-mission="${CSS.escape(id)}"], [data-ow-coming="${CSS.escape(id)}"]`);
    b?.click();
  }

  // ---------- Eingabe / input ----------

  private click(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const seg = target.closest<HTMLElement>('[data-seg="ow-view"]');
    if (seg) {
      this.view = seg.dataset.value === 'list' ? 'list' : 'map';
      saveView(this.view);
      this.host.game.play('click');
      this.applyView();
      return;
    }
    const act = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (act === 'ow-prev') this.step(-1);
    else if (act === 'ow-next') this.step(1);
    else if (act === 'ow-zoom-in') this.scene?.zoomBy(-0.25);
    else if (act === 'ow-zoom-out') this.scene?.zoomBy(0.25);
    else if (act === 'ow-overview') this.scene?.overview();
    const tab = target.closest<HTMLElement>('[data-ow-world]');
    if (tab) this.select(tab.dataset.owWorld as WorldId);
    const coming = target.closest<HTMLElement>('[data-ow-coming]');
    if (coming) {
      this.host.game.play('error');
      const tag = coming.querySelector<HTMLElement>('.tag:last-child');
      if (tag) { tag.textContent = t('overworld.comingHint'); tag.setAttribute('role', 'status'); }
    }
  }

  private key_(e: KeyboardEvent) {
    if (!(e.target as HTMLElement).classList.contains('ow-stage')) return;
    if (e.key === 'ArrowLeft') { this.step(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { this.step(1); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { this.scene?.zoomBy(-0.25); e.preventDefault(); }
    else if (e.key === '-') { this.scene?.zoomBy(0.25); e.preventDefault(); }
  }

  private step(dir: 1 | -1) {
    const i = this.info.indexOf(this.world());
    const next = this.info[Math.max(0, Math.min(this.info.length - 1, i + dir))];
    if (next) this.select(next.id);
  }

  private select(id: WorldId) {
    if (id === this.focus && this.scene?.focused === id) return;
    this.focus = id;
    this.host.game.play('click');
    this.scene?.focus(id, { report: false });
    this.renderWorld();
    const status = this.node.querySelector('.ow-status');
    const w = this.world();
    if (status && w) status.textContent = `${t(`worlds.${w.id}.name`)}: ${t('overworld.progress', { n: w.won, max: w.total })}`;
  }

  destroy() {
    this.stop();
    this.node.remove();
  }
}

/** Nur im Entwicklungsmodus: Zaehler fuer Leistungs- und Lecktests / dev only: counters for performance and leak checks */
function exposeDebug(ow: Overworld) {
  if (!import.meta.env?.DEV) return;
  (window as unknown as { __overworld?: unknown }).__overworld = { stats: () => ow.stats, live: () => liveScenes, marker: (id: string) => ow.markerAt(id) };
}

/**
 * Oberwelt an den Kampagnenbildschirm haengen (einmal je Bildschirm) / attach the overworld to the campaign screen (once per screen).
 */
export function attachOverworld(host: ScreenHost, screen: HTMLElement) {
  if (!WORLDS.length) return;
  const ow = new Overworld(host, screen);
  let seen = false;
  const own = new MutationObserver(() => ow.sync());
  own.observe(screen, { childList: true });
  const outer = new MutationObserver(() => {
    if (screen.isConnected) { seen = true; ow.sync(); return; }
    if (!seen) return;
    ow.destroy();
    own.disconnect();
    outer.disconnect();
  });
  outer.observe(host.root, { childList: true });
  ow.sync();
}
