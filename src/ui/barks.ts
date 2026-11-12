/**
 * Sprueche der Soldaten in kleinen Comic-Sprechblasen (nur Oberflaeche, kein Einfluss auf die Regeln).
 * Soldier remarks in small comic speech bubbles (UI only, no effect on the rules).
 */
import * as THREE from 'three';
import type { FactionId } from '../data/balance';
import { canSeeUnit, dist, isExplored, weather, type GameEvent, type GameState, type Unit } from '../core';
import { tList } from '../i18n/i18n';
import type { View } from '../render/view';
import { esc } from './components';

export type BarkContext = 'select' | 'move' | 'attack' | 'kill' | 'hurt' | 'corpse' | 'wreck' | 'forest' | 'idle' | 'rain' | 'snow';

/** Wahrscheinlichkeit je Anlass / probability per occasion */
const CHANCE: Record<BarkContext, number> = {
  select: 0.3, move: 0.12, attack: 0.35, kill: 0.7, hurt: 0.45, corpse: 0.9, wreck: 0.8, forest: 0.6, idle: 0.35, rain: 0.5, snow: 0.5,
};
/** Vorrang, wenn mehrere Anlaesse zugleich passen / priority when several occasions match */
const PRIORITY: BarkContext[] = ['kill', 'hurt', 'corpse', 'wreck', 'forest', 'attack', 'rain', 'snow', 'select', 'move', 'idle'];
const SHOW_MS = 2600;
const COOLDOWN_MS = 1400;

interface Bubble { node: HTMLElement; unitId: number; x: number; y: number; until: number }

export class Barks {
  private layer: HTMLElement;
  private bubbles: Bubble[] = [];
  private lastAt = 0;
  private raf = 0;
  enabled = true;
  private lastLine = new Map<string, number>();

  constructor(root: HTMLElement, private view: View) {
    this.layer = document.createElement('div');
    this.layer.className = 'bark-layer';
    this.layer.setAttribute('aria-live', 'polite');
    root.appendChild(this.layer);
  }

  /** Spruch fuer eine Einheit / remark for a unit */
  say(s: GameState, u: Unit, ctx: BarkContext, force = false) {
    if (!this.enabled || this.view.renderer.xr.isPresenting) return;
    const now = performance.now();
    if (!force && now - this.lastAt < COOLDOWN_MS) return;
    if (!force && Math.random() > CHANCE[ctx]) return;
    const faction: FactionId = s.factions[u.owner].id;
    const lines = tList(`barks.${faction}.${ctx}`);
    if (!lines.length) return;
    // nicht zweimal hintereinander derselbe Satz / never the same line twice in a row
    const key = `${faction}.${ctx}`;
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && i === this.lastLine.get(key)) i = (i + 1) % lines.length;
    this.lastLine.set(key, i);
    this.lastAt = now;
    for (const b of this.bubbles.filter((x) => x.unitId === u.id)) this.remove(b);
    while (this.bubbles.length >= 2) this.remove(this.bubbles[0]);
    const node = document.createElement('div');
    node.className = `bark faction-${faction}`;
    node.innerHTML = `<span>${esc(lines[i])}</span>`;
    this.layer.appendChild(node);
    const b: Bubble = { node, unitId: u.id, x: u.x, y: u.y, until: now + SHOW_MS };
    this.bubbles.push(b);
    this.place(s, b);
    if (!this.raf) this.raf = requestAnimationFrame(() => this.tick(s));
  }

  private remove(b: Bubble) {
    b.node.remove();
    this.bubbles = this.bubbles.filter((x) => x !== b);
  }

  private place(s: GameState, b: Bubble) {
    const obj = this.view.board.unitObject(b.unitId);
    const p = obj ? obj.getWorldPosition(new THREE.Vector3()) : this.view.board.tileCenter(s, b.x, b.y).applyMatrix4(this.view.board.group.matrixWorld);
    p.y += 0.75;
    const scr = this.view.toScreen(p);
    b.node.style.left = `${scr.x}px`;
    b.node.style.top = `${scr.y}px`;
  }

  private tick(s: GameState) {
    const now = performance.now();
    for (const b of [...this.bubbles]) {
      if (now > b.until) this.remove(b);
      else this.place(s, b);
    }
    this.raf = this.bubbles.length ? requestAnimationFrame(() => this.tick(s)) : 0;
  }

  clear() { for (const b of [...this.bubbles]) this.remove(b); }

  /** Anlass fuer eine Einheit an ihrer Position / occasion for a unit at its position */
  situation(s: GameState, u: Unit): BarkContext | null {
    const near = (x: number, y: number) => dist(u, { x, y }) <= 1;
    let corpse = false, wreck = false;
    for (let y = Math.max(0, u.y - 1); y <= Math.min(s.size - 1, u.y + 1); y++) {
      for (let x = Math.max(0, u.x - 1); x <= Math.min(s.size - 1, u.x + 1); x++) {
        const t = s.tiles[y * s.size + x];
        if (!near(x, y) || !t.remains) continue;
        if (t.remains.kind === 'wreck') wreck = true;
        if ((t.remains.skeletons ?? (t.remains.kind === 'skeleton' ? 1 : 0)) > 0) corpse = true;
      }
    }
    if (corpse) return 'corpse';
    if (wreck) return 'wreck';
    const tile = s.tiles[u.y * s.size + u.x];
    const alone = !s.units.some((o) => o.id !== u.id && o.owner === u.owner && dist(o, u) <= 2);
    if (tile.terrain === 'forest' && alone) return 'forest';
    return null;
  }

  /** Auf Ereignisse eines Kommandos reagieren / react to the events of a command */
  onEvents(s: GameState, events: GameEvent[], viewer: number, before: Map<number, { x: number; y: number; hp: number }>) {
    if (!this.enabled) return;
    const visible = (u: Unit) => viewer < 0 || canSeeUnit(s, viewer, u);
    const candidates: { u: Unit; ctx: BarkContext }[] = [];
    for (const e of events) {
      if (e.t === 'move') {
        const u = s.units.find((x) => x.id === e.unit);
        if (!u || !visible(u) || !this.isFoot(u)) continue;
        candidates.push({ u, ctx: this.situation(s, u) ?? 'move' });
      } else if (e.t === 'attack') {
        const a = s.units.find((x) => x.id === e.unit);
        const d = s.units.find((x) => x.id === e.target);
        const killed = events.some((k) => k.t === 'killed' && k.unit === e.target);
        if (a && visible(a)) candidates.push({ u: a, ctx: killed ? 'kill' : 'attack' });
        if (d && visible(d) && !killed) candidates.push({ u: d, ctx: 'hurt' });
        void before;
      }
    }
    if (!candidates.length) return;
    candidates.sort((x, y) => PRIORITY.indexOf(x.ctx) - PRIORITY.indexOf(y.ctx));
    this.say(s, candidates[0].u, candidates[0].ctx);
  }

  /** Zu Beginn des eigenen Zuges: Wetter oder Stimmung / at the start of the own turn: weather or mood */
  onTurnStart(s: GameState, viewer: number) {
    if (!this.enabled || viewer < 0) return;
    const mine = s.units.filter((u) => u.owner === viewer && this.isFoot(u) && isExplored(s, viewer, u.x, u.y));
    if (!mine.length) return;
    const u = mine[Math.floor(Math.random() * mine.length)];
    const w = weather(s);
    const ctx: BarkContext = w === 'rain' ? 'rain' : w === 'snow' ? 'snow' : this.situation(s, u) ?? 'idle';
    this.say(s, u, ctx);
  }

  /** Fusstruppen und Fahrzeuge mit Besatzung reden / foot units and crewed vehicles talk */
  private isFoot(u: Unit) { return u.type !== 'landingBoat' && u.type !== 'submarine'; }
}
