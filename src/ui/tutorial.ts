/** Kurzes spielbares Tutorial fuer die erste Partie / short playable tutorial for the first game */
import { defaultConfig, ownCities, ownUnits, type GameConfig, type GameState } from '../core';
import { FACTIONS } from '../data/balance';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { button, esc } from './components';
import { icon } from './icons';

export const TUTORIAL_CONFIG: GameConfig = defaultConfig({
  seed: 4242, size: 11, mapType: 'continent', mode: 'conquest',
  factions: [{ id: 'korvat', human: true, difficulty: 'easy' }, { id: 'dravon', human: false, difficulty: 'easy' }],
});

interface Step { key: string; manual?: boolean; done?: (s: GameState, g: Controller, ctx: Ctx) => boolean; hint?: (s: GameState) => { x: number; y: number } | null }
interface Ctx { round: number; techs: number; buildings: number; units: number }

const countBuildings = (s: GameState) => s.tiles.filter((t) => t.building || t.road).length;

export class Tutorial {
  private i = 0;
  private node: HTMLElement;
  private ctx: Ctx = { round: 1, techs: 1, buildings: 0, units: 1 };
  active = true;
  private steps: Step[];

  constructor(root: HTMLElement, private game: Controller, private onFinish: () => void) {
    this.node = document.createElement('div');
    this.node.className = 'bubble';
    this.node.setAttribute('role', 'status');
    root.appendChild(this.node);
    const village = (s: GameState) => {
      const hq = s.cities.find((c) => c.isHQ && c.hqOf === 0)!;
      const vs = s.cities.filter((c) => c.owner === null).sort((a, b) => Math.max(Math.abs(a.x - hq.x), Math.abs(a.y - hq.y)) - Math.max(Math.abs(b.x - hq.x), Math.abs(b.y - hq.y)));
      return vs[0] ?? null;
    };
    this.steps = [
      { key: 's1', manual: true, hint: (s) => { const hq = s.cities.find((c) => c.isHQ && c.hqOf === 0); return hq ? { x: hq.x, y: hq.y } : null; } },
      { key: 's2', done: (_s, g) => g.selectedUnit !== null, hint: (s) => { const u = ownUnits(s, 0)[0]; return u ? { x: u.x, y: u.y } : null; } },
      { key: 's3', done: (s) => { const v = this.target ?? village(s); return !!v && ownUnits(s, 0).some((u) => u.x === v.x && u.y === v.y); }, hint: (s) => { const v = this.target ?? village(s); if (v) this.target = { x: v.x, y: v.y }; return this.target; } },
      { key: 's4', done: (s, _g, c) => s.round > c.round && s.current === 0 },
      { key: 's5', done: (s) => ownCities(s, 0).length >= 2 },
      { key: 's6', done: (s, _g, c) => s.factions[0].techs.length > c.techs },
      { key: 's7', done: (s, _g, c) => countBuildings(s) > c.buildings },
      { key: 's8', done: (s, _g, c) => ownUnits(s, 0).length > c.units },
      { key: 's9', manual: true },
    ];
    this.node.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!b) return;
      if (b.dataset.action === 'skip') this.finish();
      if (b.dataset.action === 'next') this.advance();
    });
    this.capture();
    this.render();
  }
  private target: { x: number; y: number } | null = null;

  private capture() {
    const s = this.game.state!;
    this.ctx = { round: s.round, techs: s.factions[0].techs.length, buildings: countBuildings(s), units: ownUnits(s, 0).length };
  }

  private advance() {
    this.i++;
    if (this.i >= this.steps.length) { this.finish(); return; }
    this.capture();
    this.render();
  }

  finish() {
    this.active = false;
    this.node.remove();
    this.game.hintTile = null;
    this.game.updateHighlights();
    this.onFinish();
  }

  /** Nach jeder Zustandsaenderung aufrufen / call after every state change */
  check() {
    if (!this.active || !this.game.state) return;
    const s = this.game.state;
    const st = this.steps[this.i];
    if (st.done && st.done(s, this.game, this.ctx)) { this.advance(); return; }
    this.render();
  }

  private render() {
    const s = this.game.state!;
    const st = this.steps[this.i];
    const hint = st.hint?.(s) ?? null;
    if (JSON.stringify(hint) !== JSON.stringify(this.game.hintTile)) {
      this.game.hintTile = hint;
      this.game.updateHighlights();
      // Ziel und eigene Einheit ins Bild holen / bring target and own unit into view
      if (hint) {
        const u = s.units.find((x) => x.owner === 0);
        const a = this.game.view.board.tileCenter(s, hint.x, hint.y);
        if (u && st.key === 's3') a.add(this.game.view.board.tileCenter(s, u.x, u.y)).multiplyScalar(0.5);
        this.game.view.centerOn(a);
      }
    }
    const last = this.i === this.steps.length - 1;
    this.node.innerHTML = `<div class="row">${icon('tutorial')}<strong class="display grow">${esc(t('tutorial.title'))} ${this.i + 1}/${this.steps.length}</strong>
      ${button(t('tutorial.skip'), { action: 'skip', variant: 'secondary' })}</div>
      <p>${esc(t(`tutorial.${st.key}`))}</p>
      ${st.manual ? button(last ? t('tutorial.done') : t('tutorial.next'), { action: 'next', icon: 'next' }) : ''}`;
  }
}

export { FACTIONS };
