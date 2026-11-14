/**
 * Funksprueche der Anfuehrer: kurze Comic-Meldungen mit Portraet und Sprechblase zu wichtigen Momenten.
 * Eine Meldung zur Zeit, Warteschlange mit hoechstens drei Eintraegen, Antippen schliesst, das Brett bleibt bedienbar.
 * Leader dispatches: short comic messages with portrait and speech bubble at key moments.
 * One message at a time, queue of at most three, tap closes, the board stays usable.
 */
import './dispatch.css';
import type { FactionId } from '../data/balance';
import type { GameEvent, GameState } from '../core';
import { components, ms, primitives } from '../design/tokens';
import { t, tList } from '../i18n/i18n';
import { esc } from './components';
import { cityName } from './hud';
import { icon } from './icons';
import { leaderPortrait, type LeaderMood } from './leaders';
import {
  DISPATCH_PRIORITY, dispatchMood, gameOverSpeaker, pickLine, planDispatches, type DispatchOccasion, type DispatchPlan,
} from './dispatchPlan';

export { gameOverSpeaker } from './dispatchPlan';

const SHOW_MS = ms(components.dispatch.showMs);
const GAP_MS = ms(components.dispatch.gapMs);
const OUT_MS = ms(primitives.duration.slow);
/** Wartende Meldungen (ohne die sichtbare) / waiting messages (without the visible one) */
const MAX_QUEUE = 3;

interface Item {
  occasion: DispatchOccasion;
  faction: FactionId;
  target: number;
  mood: LeaderMood;
  text: string;
  priority: number;
}

/** Fraktionen, die nur in Grossbuchstaben funken / factions that only transmit in capitals */
const SHOUTS: ReadonlySet<FactionId> = new Set<FactionId>(['nexus']);

/** Zuletzt gewaehlte Zeile je Fraktion und Anlass / last chosen line per faction and occasion */
const lastLine = new Map<string, number>();

/**
 * Zeile fuer einen Funkspruch mit ersetzten Platzhaltern ({leader}, {faction}, {city}, {project}).
 * Line for a dispatch with placeholders replaced.
 */
export function dispatchText(s: GameState, p: DispatchPlan): string {
  const fid = s.factions[p.speaker].id;
  const lines = tList(`dispatch.${fid}.${p.occasion}`);
  const key = `${fid}.${p.occasion}`;
  const i = pickLine(lines.length, s.round, p.speaker, lastLine.get(key));
  if (i < 0) return '';
  lastLine.set(key, i);
  const tf = s.factions[p.target]?.id ?? fid;
  const vars: Record<string, string> = {
    leader: t(`factions.${tf}.leader`),
    faction: t(`factions.${tf}.short`),
    city: p.city !== undefined ? cityName(s, p.city) : '',
    project: p.project ? t(`grand.${p.project}`) : '',
  };
  // KERN-0 spricht in Grossbuchstaben, auch die Namen / KERN-0 speaks in capitals, names included
  const caps = SHOUTS.has(fid);
  return lines[i].replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? (caps ? vars[k].toUpperCase() : vars[k]) : m));
}

/** Portraet, Name und Sprechblase (auch fuer den Endbildschirm) / portrait, name and speech bubble (also for the game-over screen) */
export function dispatchHtml(f: FactionId, mood: LeaderMood, text: string, cls = ''): string {
  return `<div class="dispatch mood-${mood} ${cls}" style="--dispatch-faction:var(--faction-${f}-primary);--dispatch-faction-alt:var(--faction-${f}-secondary)">
    ${leaderPortrait(f, 'dispatch-face', mood)}
    <div class="dispatch-body">
      <div class="dispatch-head">
        <span class="dispatch-kicker">${icon('range', 'icon-sm')}<span>${esc(t('dispatchUi.kicker'))}</span></span>
        <strong class="dispatch-name">${esc(t(`factions.${f}.leader`))}</strong>
        <span class="dispatch-title">${esc(t(`factions.${f}.leaderTitle`))}</span>
      </div>
      <p class="dispatch-bubble">${esc(text)}</p>
    </div>
  </div>`;
}

/** Endbildschirm: eigener Anfuehrer siegreich oder fassungslos / game-over screen: own leader triumphant or shocked */
export function gameOverDispatchHtml(s: GameState, viewer: number): string {
  const who = gameOverSpeaker(s, viewer);
  if (!who) return '';
  const text = dispatchText(s, { occasion: who.occasion, speaker: who.faction, target: who.faction });
  if (!text) return '';
  const f = s.factions[who.faction].id;
  return dispatchHtml(f, dispatchMood(who.occasion, f), text, 'static');
}

export class Dispatches {
  enabled = true;
  animations = true;
  /** unterdrueckt (Tutorial, XR) / suppressed (tutorial, XR) */
  blocked: () => boolean = () => false;
  private layer: HTMLElement;
  private queue: Item[] = [];
  /** Hotseat: Meldungen fuer Menschen, die gerade nicht am Bildschirm sind / hotseat: messages for humans not at the screen */
  private held = new Map<number, Item[]>();
  private current: { node: HTMLElement; item: Item } | null = null;
  private timer = 0;
  private gapTimer = 0;
  /** Runde:Anlass:Sprecher, damit nichts doppelt kommt / round:occasion:speaker, so nothing repeats */
  private said = new Set<string>();
  private briefed = new Set<number>();
  private fresh = false;

  constructor(private root: HTMLElement, private viewer: () => number) {
    this.layer = document.createElement('div');
    this.layer.className = 'dispatch-layer';
    this.layer.setAttribute('role', 'status');
    this.layer.setAttribute('aria-live', 'polite');
    root.appendChild(this.layer);
  }

  /** Neue oder geladene Partie: alles vergessen; Lagebesprechung nur in neuen Partien / new or loaded game: forget all; briefing only in new games */
  reset(fresh: boolean) {
    this.clear();
    this.said.clear();
    this.briefed.clear();
    this.held.clear();
    this.fresh = fresh;
  }

  /** Alles ausblenden / hide everything */
  clear() {
    this.queue = [];
    window.clearTimeout(this.timer);
    window.clearTimeout(this.gapTimer);
    this.current?.node.remove();
    this.current = null;
    this.setOffset(0);
  }

  /** Antippen oder Escape: aktuelle Meldung schliessen / tap or Escape: close the current message */
  dismiss(): boolean {
    if (!this.current) return false;
    this.hide();
    return true;
  }

  /** Beginn eines menschlichen Zuges: Lagebesprechung und zurueckgehaltene Meldungen / start of a human turn: briefing and held messages */
  turnStart(s: GameState, viewer: number) {
    if (viewer < 0 || !s.factions[viewer]?.human) return;
    if (this.fresh && s.round <= 1 && !this.briefed.has(viewer)) {
      this.briefed.add(viewer);
      this.add(s, { occasion: 'briefing', speaker: viewer, target: viewer });
    }
    const held = this.held.get(viewer);
    if (held) { this.held.delete(viewer); for (const it of held) this.push(it); }
  }

  /** Spielereignis pruefen / check a game event */
  onEvent(e: GameEvent, s: GameState) {
    if (e.t === 'gameOver') { this.clear(); this.held.clear(); return; }
    for (const p of planDispatches(e, s)) this.add(s, p);
  }

  private add(s: GameState, p: DispatchPlan) {
    if (!this.enabled || this.blocked()) return;
    // hoechstens ein Funkspruch je Anlass, Runde und Sprecher / at most one dispatch per occasion, round and speaker
    const key = `${s.round}:${p.occasion}:${p.speaker}`;
    if (this.said.has(key)) return;
    const text = dispatchText(s, p);
    if (!text) return;
    this.said.add(key);
    const f = s.factions[p.speaker].id;
    const item: Item = { occasion: p.occasion, faction: f, target: p.target, mood: dispatchMood(p.occasion, f), text, priority: DISPATCH_PRIORITY[p.occasion] };
    const hotseat = s.factions.filter((x) => x.human).length > 1;
    const v = this.viewer();
    if (hotseat && v >= 0 && p.target !== v) {
      const list = this.held.get(p.target) ?? [];
      list.push(item);
      this.held.set(p.target, trim(list));
      return;
    }
    this.push(item);
  }

  private push(item: Item) {
    this.queue = trim([...this.queue, item]);
    if (!this.current && !this.gapTimer) this.next();
  }

  private next() {
    this.gapTimer = 0;
    const item = this.queue.shift();
    if (!item || !this.enabled) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = dispatchHtml(item.faction, item.mood, item.text);
    const node = wrap.firstElementChild as HTMLElement;
    node.title = t('dispatchUi.dismiss');
    node.addEventListener('click', () => this.hide());
    // mit der Maus darueber: Zeit anhalten, damit man in Ruhe lesen kann / mouse over: pause so it can be read calmly
    node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') window.clearTimeout(this.timer); });
    node.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && this.current?.node === node) this.arm(); });
    this.layer.appendChild(node);
    this.current = { node, item };
    this.setOffset(node.offsetHeight);
    this.arm();
  }

  private arm() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), SHOW_MS);
  }

  private hide() {
    const cur = this.current;
    if (!cur) return;
    window.clearTimeout(this.timer);
    this.current = null;
    this.setOffset(0);
    const wait = this.animations ? OUT_MS : 0;
    if (wait) { cur.node.classList.add('out'); window.setTimeout(() => cur.node.remove(), wait); } else cur.node.remove();
    if (this.queue.length) this.gapTimer = window.setTimeout(() => this.next(), wait + GAP_MS);
  }

  /** Andere Elemente oben in der Mitte ruecken nach unten / other top-centre elements move down */
  private setOffset(h: number) {
    if (h > 0) this.root.style.setProperty('--dispatch-offset', `${Math.ceil(h)}px`);
    else this.root.style.removeProperty('--dispatch-offset');
    this.root.classList.toggle('has-dispatch', h > 0);
  }
}

/** Warteschlange kuerzen: die aelteste Meldung mit dem niedrigsten Vorrang faellt weg / trim the queue: the oldest lowest-priority entry is dropped */
function trim(list: Item[]): Item[] {
  const out = [...list];
  while (out.length > MAX_QUEUE) {
    const min = Math.min(...out.map((x) => x.priority));
    out.splice(out.findIndex((x) => x.priority === min), 1);
  }
  return out;
}
