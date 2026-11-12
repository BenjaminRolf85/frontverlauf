/**
 * Controller: jede Eingabe (Maus, Touch, XR) wird hier zu einem Kommando an den Spielkern.
 * Controller: every input (mouse, touch, XR) becomes a command to the game core here.
 */
import {
  applyCommand, attackTargets, captureKind, combatPreview, convertTargets, createGame, heliSafe, heliWillCrash,
  ownUnits, reachable, unitAt, unitById, cityAt, canSeeUnit, isExplored, barrierTargets, radioTargets, terraformTargets,
  type Command, type CommandResult, type GameConfig, type GameEvent, type GameState, type Unit,
} from '../core';
import { planNextCommand } from '../ai/ai';
import { audio, type Sfx } from '../audio/audio';
import type { HighlightKind } from '../render/board';
import type { View } from '../render/view';
import { saveGame } from '../save/save';

export type Tab = 'unit' | 'city' | 'tile';

export interface UiHooks {
  update(): void;
  toast(text: string, icon?: string): void;
  errorCode(code: string): void;
  event(e: GameEvent, s: GameState): void;
  fx(kind: 'hit' | 'kill' | 'capture' | 'levelUp' | 'heal' | 'num' | 'splat' | 'boom', x: number, y: number, text?: string): void;
  handover(faction: number): Promise<void>;
  confirm(text: string, ok: string): Promise<boolean>;
  gameOver(): void;
  rewards(): void;
  afterCommand?(events: GameEvent[]): void;
  unitSelected?(u: Unit): void;
  turnStarted?(): void;
}

const AI_DELAY: Record<string, number> = { slow: 420, normal: 220, fast: 60, instant: 0 };

export class Controller {
  state: GameState | null = null;
  viewer = 0;
  selected: { x: number; y: number } | null = null;
  tab: Tab = 'tile';
  selectedUnit: number | null = null;
  pendingTarget: number | null = null;
  busy = false;
  aiRunning = false;
  aiSpeed: keyof typeof AI_DELAY = 'normal';
  speedUp = false;
  hintTile: { x: number; y: number } | null = null;
  /** Zielauswahl fuer die Panzersperre / target selection for the tank barrier */
  barrierMode = false;
  /** Zielauswahl fuer den Funkturm: Stadt-ID / target selection for the radio tower: city id */
  radioCity: number | null = null;
  /** Zielauswahl fuer den Terraformer / target selection for the terraformer */
  terraformUnit: number | null = null;
  onCommand: ((cmd: Command, res: CommandResult) => void) | null = null;
  ui!: UiHooks;

  constructor(readonly view: View) {}

  get current() { return this.state ? this.state.factions[this.state.current] : null; }
  get isHumanTurn() { return !!this.current && this.current.human && !this.aiRunning && !this.state!.over; }
  humans() { return this.state ? this.state.factions.filter((f) => f.human && f.alive) : []; }

  newGame(config: GameConfig) {
    this.load(createGame(config));
  }

  load(s: GameState) {
    this.state = s;
    this.view.board.finishAnimations();
    const humans = s.factions.filter((f) => f.human);
    this.viewer = s.factions[s.current].human ? s.current : humans.length ? humans[0].index : -1;
    this.clearSelection();
    this.view.fit(s.size);
    this.refresh();
    const hq = s.cities.find((c) => c.isHQ && c.hqOf === this.viewer);
    if (hq) this.view.centerOn(this.view.board.tileCenter(s, hq.x, hq.y));
    audio.setTheme(this.viewer >= 0 ? s.factions[this.viewer].id : s.factions[0].id);
    this.ui.update();
    if (!s.factions[s.current].human) void this.runAi();
    else this.ui.rewards();
  }

  refresh() {
    if (!this.state) return;
    this.view.board.rebuild(this.state, this.viewer);
    this.view.board.syncUnits(this.state, this.viewer);
    this.updateHighlights();
  }

  startBarrier() {
    this.barrierMode = true;
    this.updateHighlights();
    this.ui.update();
  }

  startTerraform(unitId: number) {
    this.terraformUnit = unitId;
    this.updateHighlights();
    this.ui.update();
  }

  startRadio(cityId: number) {
    this.radioCity = cityId;
    this.updateHighlights();
    this.ui.update();
  }

  clearSelection() {
    this.barrierMode = false;
    this.radioCity = null;
    this.terraformUnit = null;
    this.selected = null; this.selectedUnit = null; this.pendingTarget = null;
    this.updateHighlights();
  }

  selectedUnitObj(): Unit | undefined {
    return this.state && this.selectedUnit !== null ? unitById(this.state, this.selectedUnit) : undefined;
  }

  updateHighlights() {
    const s = this.state;
    if (!s) return;
    const list: { x: number; y: number; kind: HighlightKind }[] = [];
    if (this.selected) list.push({ ...this.selected, kind: 'select' });
    if (this.terraformUnit !== null && this.isHumanTurn) {
      const tu = unitById(s, this.terraformUnit);
      if (tu) for (const p of terraformTargets(s, tu)) list.push({ ...p, kind: 'build' });
    }
    if (this.radioCity !== null && this.isHumanTurn) {
      const c = s.cities.find((cc) => cc.id === this.radioCity);
      if (c) for (const p of radioTargets(s, s.current, c)) list.push({ ...p, kind: 'build' });
    }
    const u = this.selectedUnitObj();
    if (u && this.barrierMode && u.owner === s.current && this.isHumanTurn) {
      for (const p of barrierTargets(s, u)) list.push({ ...p, kind: 'build' });
    } else if (u && u.owner === s.current && this.isHumanTurn) {
      for (const r of reachable(s, u)) {
        const kind: HighlightKind = u.fuel !== null ? (heliSafe(s, u, r.x, r.y) ? 'safe' : 'unsafe') : 'move';
        list.push({ x: r.x, y: r.y, kind });
      }
      for (const t of attackTargets(s, u)) list.push({ x: t.x, y: t.y, kind: t.id === this.pendingTarget ? 'target' : 'attack' });
      for (const t of convertTargets(s, u)) list.push({ x: t.x, y: t.y, kind: 'attack' });
      if (u.fuel !== null) {
        for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) {
          const tl = s.tiles[y * s.size + x];
          const own = (tl.cityId !== null && s.cities.find((c) => c.id === tl.cityId)?.owner === u.owner) || tl.outpost?.owner === u.owner;
          if (own) list.push({ x, y, kind: 'build' });
        }
      }
    }
    if (this.hintTile) list.push({ ...this.hintTile, kind: 'hint' });
    this.view.board.setHighlights(s, list);
  }

  /** Antippen eines Feldes / tapping a tile */
  async tapTile(x: number, y: number) {
    const s = this.state;
    if (!s || this.busy) return;
    audio.unlock();
    if (this.terraformUnit !== null) {
      const uid = this.terraformUnit;
      this.terraformUnit = null;
      const tu = unitById(s, uid);
      if (tu && terraformTargets(s, tu).some((p) => p.x === x && p.y === y)) {
        await this.exec({ type: 'terraform', x, y, unit: uid });
        return;
      }
      this.updateHighlights(); this.ui.update();
      return;
    }
    if (this.radioCity !== null) {
      const cityId = this.radioCity;
      this.radioCity = null;
      const c = s.cities.find((cc) => cc.id === cityId);
      if (c && radioTargets(s, s.current, c).some((p) => p.x === x && p.y === y)) {
        await this.exec({ type: 'cityUpgrade', city: cityId, upgrade: 'radioTower', target: { x, y } });
        this.view.centerOn(this.view.board.tileCenter(s, x, y));
        return;
      }
      this.updateHighlights(); this.ui.update();
      return;
    }
    const u = this.selectedUnitObj();
    if (u && this.barrierMode) {
      this.barrierMode = false;
      if (barrierTargets(s, u).some((p) => p.x === x && p.y === y)) {
        await this.exec({ type: 'barrier', unit: u.id, x, y });
        return;
      }
      this.updateHighlights(); this.ui.update();
      return;
    }
    if (u && this.isHumanTurn && u.owner === s.current) {
      const target = unitAt(s, x, y);
      if (target && target.owner !== u.owner && canSeeUnit(s, s.current, target)) {
        if (attackTargets(s, u).some((t) => t.id === target.id)) {
          if (this.pendingTarget === target.id) { await this.exec({ type: 'attack', unit: u.id, target: target.id }); return; }
          this.pendingTarget = target.id; this.tab = 'unit';
          this.play('select'); this.updateHighlights(); this.ui.update();
          return;
        }
        if (convertTargets(s, u).some((t) => t.id === target.id)) {
          await this.exec({ type: 'convert', unit: u.id, target: target.id });
          return;
        }
      }
      if (reachable(s, u).some((r) => r.x === x && r.y === y)) {
        await this.exec({ type: 'move', unit: u.id, to: { x, y } });
        const moved = unitById(s, u.id);
        if (moved) { this.selected = { x: moved.x, y: moved.y }; this.selectedUnit = moved.id; }
        this.updateHighlights(); this.ui.update();
        return;
      }
    }
    // Auswahl / selection
    const same = this.selected && this.selected.x === x && this.selected.y === y;
    this.selected = { x, y };
    this.pendingTarget = null;
    const unit = unitAt(s, x, y);
    const visibleUnit = unit && (this.viewer < 0 || canSeeUnit(s, this.viewer, unit)) ? unit : undefined;
    const city = cityAt(s, x, y);
    const explored = this.viewer < 0 || isExplored(s, this.viewer, x, y);
    if (same) {
      const order: Tab[] = [];
      if (visibleUnit) order.push('unit');
      if (city && explored) order.push('city');
      order.push('tile');
      this.tab = order[(order.indexOf(this.tab) + 1) % order.length];
    } else {
      this.tab = visibleUnit ? 'unit' : city && explored ? 'city' : 'tile';
    }
    this.selectedUnit = visibleUnit && this.tab === 'unit' ? visibleUnit.id : null;
    if (!same && visibleUnit && visibleUnit.owner === this.viewer) this.ui.unitSelected?.(visibleUnit);
    this.play('select');
    this.updateHighlights();
    this.ui.update();
  }

  play(s: Sfx) { audio.play(s); }

  setTab(tab: Tab) {
    const s = this.state;
    if (!s || !this.selected) return;
    this.tab = tab;
    const u = unitAt(s, this.selected.x, this.selected.y);
    this.selectedUnit = tab === 'unit' && u && (this.viewer < 0 || canSeeUnit(s, this.viewer, u)) ? u.id : null;
    this.pendingTarget = null;
    this.play('click');
    this.updateHighlights();
    this.ui.update();
  }

  /** Kommando ausfuehren und animieren / execute and animate a command */
  async exec(cmd: Command, opts: { ai?: boolean } = {}): Promise<CommandResult> {
    const s = this.state!;
    const before = new Map(s.units.map((u) => [u.id, { x: u.x, y: u.y }]));
    const res = applyCommand(s, cmd);
    this.onCommand?.(cmd, res);
    if (!res.ok) {
      if (!opts.ai) { this.play('error'); this.ui.errorCode(res.error ?? 'invalid'); }
      return res;
    }
    const board = this.view.board;
    const animate = board.animations && !(opts.ai && (this.aiSpeed === 'instant' || this.speedUp));
    const visible = (x: number, y: number) => this.viewer < 0 || isExplored(s, this.viewer, x, y);
    this.busy = true;
    try {
      for (const e of res.events) {
        switch (e.t) {
          case 'move': {
            const from = before.get(e.unit);
            if (animate && from && board.unitObject(e.unit) && (visible(from.x, from.y) || e.path.some((p) => visible(p.x, p.y)))) {
              this.play('move');
              await board.animateMove(s, e.unit, from, e.path);
            }
            break;
          }
          case 'attack': {
            const target = unitById(s, e.target) ?? null;
            const at = target ?? null;
            const pos = at ? { x: at.x, y: at.y } : before.get(e.target);
            if (animate && board.unitObject(e.unit) && board.unitObject(e.target)) {
              this.play('attack');
              await board.animateAttack(e.unit, e.target);
            } else this.play('hit');
            if (pos && visible(pos.x, pos.y)) {
              this.ui.fx('hit', pos.x, pos.y);
              this.ui.fx('num', pos.x, pos.y, `-${e.dmg}`);
              const att = unitById(s, e.unit) ?? null;
              const ap = att ? { x: att.x, y: att.y } : before.get(e.unit);
              if (e.ret && ap) this.ui.fx('num', ap.x, ap.y, `-${e.ret}`);
              for (const sp of e.splash ?? []) { const p = before.get(sp.unit); if (p) this.ui.fx('num', p.x, p.y, `-${sp.dmg}`); }
            }
            break;
          }
          case 'killed': {
            const p = before.get(e.unit);
            if (p && visible(p.x, p.y)) { this.play('kill'); this.ui.fx(e.remains === 'skeleton' ? 'splat' : e.remains === 'wreck' ? 'boom' : 'kill', p.x, p.y); }
            if (animate) await board.animateDeath(e.unit, e.remains ?? null);
            break;
          }
          case 'capture': {
            const c = s.cities.find((cc) => cc.id === e.city)!;
            if (visible(c.x, c.y)) { this.play('capture'); this.ui.fx('capture', c.x, c.y); }
            break;
          }
          case 'cityLevel': {
            const c = s.cities.find((cc) => cc.id === e.city)!;
            if (c.owner === this.viewer) { this.play('levelUp'); this.ui.fx('levelUp', c.x, c.y); }
            break;
          }
          case 'heal': { const u = unitById(s, e.unit); if (u && visible(u.x, u.y)) this.ui.fx('heal', u.x, u.y, `+${e.amount}`); break; }
          case 'build': if (e.faction === this.viewer) this.play('build'); break;
          case 'barrier': if (e.faction === this.viewer) this.play('build'); break;
          case 'terraform': if (e.faction === this.viewer) this.play('research'); break;
          case 'cityUpgrade': if (e.faction === this.viewer) this.play(e.upgrade === 'radioTower' ? 'research' : 'build'); break;
          case 'barrierHit': if (visible(e.x, e.y)) { this.play('hit'); this.ui.fx('boom', e.x, e.y); } break;
          case 'research': if (e.faction === this.viewer) this.play('research'); break;
          case 'turn': break;
          default: break;
        }
        this.ui.event(e, s);
      }
    } finally {
      this.busy = false;
    }
    this.refresh();
    this.ui.afterCommand?.(res.events);
    if (this.selectedUnit !== null && !unitById(s, this.selectedUnit)) { this.selectedUnit = null; this.pendingTarget = null; }
    if (this.pendingTarget !== null && !unitById(s, this.pendingTarget)) this.pendingTarget = null;
    this.updateHighlights();
    this.ui.update();
    if (s.over) { this.autosave(); this.ui.gameOver(); }
    else if (!opts.ai) this.ui.rewards();
    return res;
  }

  autosave() {
    if (this.state && this.state.config.seed !== -1) saveGame(this.state);
  }

  heliCrashRisk(): boolean {
    const s = this.state;
    if (!s) return false;
    return ownUnits(s, s.current).some((u) => heliWillCrash(s, u));
  }

  async endTurn() {
    const s = this.state;
    if (!s || !this.isHumanTurn || this.busy) return;
    if (this.heliCrashRisk()) {
      const { t } = await import('../i18n/i18n');
      const ok = await this.ui.confirm(t('hud.crashWarning'), t('hud.crashWarningConfirm'));
      if (!ok) return;
    }
    const res = await this.exec({ type: 'endTurn' });
    if (!res.ok) return;
    this.play('endTurn');
    this.clearSelection();
    this.autosave();
    await this.afterTurnChange();
  }

  private async afterTurnChange() {
    const s = this.state!;
    if (s.over) return;
    if (!s.factions[s.current].human) { await this.runAi(); return; }
    await this.beginHumanTurn();
  }

  private async beginHumanTurn() {
    const s = this.state!;
    const humans = this.humans();
    if (humans.length > 1 && this.viewer !== s.current) {
      await this.ui.handover(s.current);
    }
    this.viewer = s.current;
    audio.setTheme(s.factions[this.viewer].id);
    this.refresh();
    this.ui.update();
    this.ui.rewards();
    this.ui.turnStarted?.();
  }

  async runAi() {
    const s = this.state;
    if (!s || this.aiRunning) return;
    this.aiRunning = true;
    this.speedUp = false;
    this.clearSelection();
    this.ui.update();
    try {
      while (!s.over && !s.factions[s.current].human) {
        const faction = s.current;
        let guard = 0;
        while (!s.over && s.current === faction && guard++ < 500) {
          const cmd = planNextCommand(s, faction);
          const fast = this.aiSpeed === 'instant' || this.speedUp || !this.view.board.animations;
          let res: CommandResult;
          if (fast) {
            res = applyCommand(s, cmd);
            this.onCommand?.(cmd, res);
            if (res.ok) { for (const e of res.events) this.ui.event(e, s); this.ui.afterCommand?.(res.events); }
          } else {
            res = await this.exec(cmd, { ai: true });
            const delay = AI_DELAY[this.aiSpeed];
            if (delay && cmd.type !== 'endTurn') await new Promise((r) => setTimeout(r, delay));
          }
          if (!res.ok && cmd.type === 'endTurn') {
            // Notausgang / emergency exit
            for (const p of [...s.pendingRewards]) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
            applyCommand(s, { type: 'endTurn' });
          }
          if (fast && guard % 25 === 0) await new Promise((r) => setTimeout(r, 0));
        }
        if (s.current === faction && !s.over) applyCommand(s, { type: 'endTurn' });
        this.refresh();
        this.ui.update();
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      this.aiRunning = false;
    }
    this.refresh();
    this.autosave();
    this.ui.update();
    if (s.over) { this.ui.gameOver(); return; }
    await this.beginHumanTurn();
  }

  /** Vorschau fuer die Angriffsschaltflaeche / preview for the attack button */
  attackPreview() {
    const s = this.state, u = this.selectedUnitObj();
    if (!s || !u || this.pendingTarget === null) return null;
    const t = unitById(s, this.pendingTarget);
    return t ? combatPreview(s, u, t) : null;
  }

  canCapture(u: Unit) { return this.state ? captureKind(this.state, u) : null; }
}
