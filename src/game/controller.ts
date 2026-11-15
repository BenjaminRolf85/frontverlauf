/**
 * Controller: jede Eingabe (Maus, Touch, XR) wird hier zu einem Kommando an den Spielkern.
 * Controller: every input (mouse, touch, XR) becomes a command to the game core here.
 */
import {
  score, isHostile, dist, weather, applyCommand, attackTargets, rocketTargets, captureKind, combatPreview, convertTargets, createGame, heliSafe, heliWillCrash,
  ownUnits, reachable, unitAt, workSpots, unitById, cityAt, canSeeUnit, isExplored, barrierTargets, mineTargets, emplacementTargets, radioTargets, terraformTargets, turretTargets,
  orbitalPreview, orbitalWait,
  type Command, type CommandResult, type GameConfig, type GameEvent, type GameState, type Unit,
} from '../core';
import { planNextCommand } from '../ai/ai';
import { ORBITAL, UNITS, type HitKind } from '../data/balance';
import { t } from '../i18n/i18n';
import { audio, type Sfx } from '../audio/audio';
import type { HighlightKind } from '../render/board';
import type { View } from '../render/view';
import { SHAKE, impactShake, weaponOf } from '../render/combat';
import { RIFT_OPEN_MS } from '../render/rift';
import { ORBITAL_FX } from '../render/fx/orbital';
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
  /** angewaehltes Verdan-Geschuetz (zweites Antippen greift an) / selected Verdan gun (a second tap attacks) */
  pendingTurret: { x: number; y: number } | null = null;
  busy = false;
  aiRunning = false;
  aiSpeed: keyof typeof AI_DELAY = 'normal';
  speedUp = false;
  hintTile: { x: number; y: number } | null = null;
  /** Zielauswahl fuer die Panzersperre / target selection for the tank barrier */
  barrierMode = false;
  /** Zielauswahl fuer eine Mine / target selection for a mine */
  mineMode = false;
  /** Zielauswahl fuer eine Geschuetzstellung (Festungsbau) / target selection for a gun emplacement (fortification) */
  emplacementMode = false;
  /** Zielauswahl fuer den Funkturm: Stadt-ID / target selection for the radio tower: city id */
  radioCity: number | null = null;
  /** Zielauswahl fuer den Terraformer / target selection for the terraformer */
  terraformUnit: number | null = null;
  /** Zielauswahl des Orbitallasers und angepeilte Ecke / orbital laser targeting and the aimed corner */
  orbitalMode = false;
  orbitalAim: { x: number; y: number } | null = null;
  onCommand: ((cmd: Command, res: CommandResult) => void) | null = null;
  ui!: UiHooks;

  /** Spielende schon gemeldet (einmal je Partie, auch wenn es im KI-Zug faellt) / game end already reported (once per game, even during an AI turn) */
  private gameOverShown = false;

  constructor(readonly view: View) {}

  get current() { return this.state ? this.state.factions[this.state.current] : null; }
  get isHumanTurn() { return !!this.current && this.current.human && !this.aiRunning && !this.state!.over; }
  humans() { return this.state ? this.state.factions.filter((f) => f.human && f.alive) : []; }

  newGame(config: GameConfig) {
    this.load(createGame(config));
  }

  load(s: GameState) {
    this.state = s;
    this.gameOverShown = false;
    this.view.board.finishAnimations();
    const humans = s.factions.filter((f) => f.human);
    this.viewer = s.factions[s.current].human ? s.current : humans.length ? humans[0].index : -1;
    this.clearSelection();
    this.view.fit(s.size);
    this.refresh();
    const hq = s.cities.find((c) => c.isHQ && c.hqOf === this.viewer && c.owner === this.viewer);
    if (hq) this.view.centerOn(this.view.board.tileCenter(s, hq.x, hq.y));
    else {
      // ohne Hauptquartier (Landetrupp der Kampagne): zwischen die eigenen Einheiten und das erste Ziel
      // without an HQ (campaign landing party): between the own units and the first objective
      const own = s.units.find((u) => u.owner === this.viewer);
      const goal = s.campaign?.targets[0] ?? own;
      if (own && goal) this.view.centerOn(this.view.board.tileCenter(s, Math.round((own.x + goal.x) / 2), Math.round((own.y + goal.y) / 2)));
    }
    audio.setTheme(this.viewer >= 0 ? s.factions[this.viewer].id : s.factions[0].id);
    this.updateMood();
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

  startMine() {
    this.mineMode = true;
    this.barrierMode = false;
    this.emplacementMode = false;
    this.updateHighlights();
    this.ui.update();
  }

  startEmplacement() {
    this.emplacementMode = true;
    this.barrierMode = false;
    this.mineMode = false;
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

  /** Orbitallaser: Zielauswahl beginnen (nur bereit und am Zug) / orbital laser: start targeting (only when ready and on turn) */
  startOrbital() {
    const s = this.state;
    if (!s || !this.isHumanTurn) return;
    const wait = orbitalWait(s, s.current);
    if (wait === null) return;
    if (wait > 0) { this.play('error'); this.ui.errorCode('orbitalCooldown'); return; }
    this.clearSelection();
    this.orbitalMode = true;
    this.play('select');
    this.updateHighlights();
    this.ui.update();
  }

  /** Zielauswahl abbrechen / cancel targeting */
  cancelOrbital() {
    if (!this.orbitalMode) return;
    this.orbitalMode = false;
    this.orbitalAim = null;
    this.updateHighlights();
    this.ui.update();
  }

  /** Ecke anpeilen (Maus folgt, Antippen setzt) / aim a corner (mouse follows, a tap sets it) */
  aimOrbital(x: number, y: number) {
    if (!this.orbitalMode || (this.orbitalAim && this.orbitalAim.x === x && this.orbitalAim.y === y)) return;
    this.orbitalAim = { x, y };
    this.updateHighlights();
    this.ui.update();
  }

  /** Auf die angepeilte Flaeche feuern / fire at the aimed area */
  async fireOrbital() {
    const s = this.state, aim = this.orbitalAim;
    if (!s || !aim || !this.orbitalMode || this.busy) return;
    this.orbitalMode = false;
    this.orbitalAim = null;
    await this.exec({ type: 'orbitalStrike', x: aim.x, y: aim.y });
  }

  clearSelection() {
    this.orbitalMode = false;
    this.orbitalAim = null;
    this.barrierMode = false;
    this.mineMode = false;
    this.emplacementMode = false;
    this.radioCity = null;
    this.terraformUnit = null;
    this.selected = null; this.selectedUnit = null; this.pendingTarget = null; this.pendingTurret = null;
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
    } else if (u && this.mineMode && u.owner === s.current && this.isHumanTurn) {
      for (const p of mineTargets(s, u)) list.push({ ...p, kind: 'build' });
    } else if (u && this.emplacementMode && u.owner === s.current && this.isHumanTurn) {
      for (const p of emplacementTargets(s, u)) list.push({ ...p, kind: 'build' });
    } else if (u && u.owner === s.current && this.isHumanTurn) {
      for (const r of reachable(s, u)) {
        const kind: HighlightKind = u.fuel !== null ? (heliSafe(s, u, r.x, r.y) ? 'safe' : 'unsafe') : 'move';
        list.push({ x: r.x, y: r.y, kind });
      }
      for (const t of attackTargets(s, u)) list.push({ x: t.x, y: t.y, kind: t.id === this.pendingTarget ? 'target' : 'attack' });
      for (const t of rocketTargets(s, u)) list.push({ x: t.x, y: t.y, kind: t.id === this.pendingTarget ? 'target' : 'attack' });
      for (const t of convertTargets(s, u)) list.push({ x: t.x, y: t.y, kind: 'attack' });
      // Kampagne m2: Arbeitsplaetze am Mutterschiff fuer den Wissenschaftler / campaign m2: work spots at the mothership for the scientist
      if (u.type === 'scientist' && u.id === s.campaign?.scientist) for (const p of workSpots(s)) if (!unitAt(s, p.x, p.y)) list.push({ ...p, kind: 'build' });
      // Verdan-Geschuetze in Reichweite / Verdan guns in range
      for (const p of turretTargets(s, u)) list.push({ ...p, kind: this.pendingTurret && this.pendingTurret.x === p.x && this.pendingTurret.y === p.y ? 'target' : 'attack' });
      if (u.fuel !== null) {
        for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) {
          const tl = s.tiles[y * s.size + x];
          const own = (tl.cityId !== null && s.cities.find((c) => c.id === tl.cityId)?.owner === u.owner) || tl.outpost?.owner === u.owner;
          if (own) list.push({ x, y, kind: 'build' });
        }
      }
    }
    // Kampagnenziele markieren / mark campaign targets
    if (s.campaign && !s.campaign.result) {
      for (const p of s.campaign.targets) list.push({ ...p, kind: 'hint' });
      // Zieleinheiten (folgen der Einheit) und das Artefakt / target units (follow the unit) and the artifact
      for (const id of s.campaign.units ?? []) { const u = s.units.find((x) => x.id === id); if (u) list.push({ x: u.x, y: u.y, kind: 'hint' }); }
      if (s.campaign.artifact) list.push({ ...s.campaign.artifact, kind: 'hint' });
    }
    if (this.hintTile) list.push({ ...this.hintTile, kind: 'hint' });
    this.view.board.setHighlights(s, list);
    this.updateOrbitalPreview();
  }

  /** Vorschau der Flaeche mit Schadenszahlen (eigene in Warnfarbe) / area preview with damage numbers (own ones in the warning colour) */
  private updateOrbitalPreview() {
    const s = this.state;
    if (!s) return;
    if (!this.orbitalMode || !this.orbitalAim || !this.isHumanTurn) { this.view.board.showOrbitalPreview(s, [], ORBITAL.area.w, [], false); return; }
    const pre = orbitalPreview(s, s.current, this.orbitalAim.x, this.orbitalAim.y);
    const tags = pre.hits.map((h) => ({ x: h.x, y: h.y, own: h.own, text: t(h.killed ? 'orbital.tagKill' : 'orbital.tag', { dmg: h.dmg }) }));
    this.view.board.showOrbitalPreview(s, pre.tiles, ORBITAL.area.w, tags, pre.check !== 'ok');
  }

  /** Antippen eines Feldes / tapping a tile */
  async tapTile(x: number, y: number) {
    const s = this.state;
    if (!s || this.busy) return;
    audio.unlock();
    // Orbitallaser: erstes Antippen peilt an, zweites auf dieselbe Ecke feuert / orbital laser: first tap aims, a second on the same corner fires
    if (this.orbitalMode) {
      if (this.orbitalAim && this.orbitalAim.x === x && this.orbitalAim.y === y && orbitalPreview(s, s.current, x, y).check === 'ok') { await this.fireOrbital(); return; }
      this.aimOrbital(x, y);
      this.play('select');
      return;
    }
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
    if (u && this.mineMode) {
      this.mineMode = false;
      if (mineTargets(s, u).some((p) => p.x === x && p.y === y)) {
        await this.exec({ type: 'mine', unit: u.id, x, y });
        return;
      }
      this.updateHighlights(); this.ui.update();
      return;
    }
    if (u && this.emplacementMode) {
      this.emplacementMode = false;
      if (emplacementTargets(s, u).some((p) => p.x === x && p.y === y)) {
        await this.exec({ type: 'emplacement', unit: u.id, x, y });
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
        // Mech-Raketen aufs uebernaechste Feld / mech rockets two tiles away
        if (rocketTargets(s, u).some((t) => t.id === target.id)) {
          if (this.pendingTarget === target.id) { await this.exec({ type: 'rocket', unit: u.id, target: target.id }); return; }
          this.pendingTarget = target.id; this.tab = 'unit';
          this.play('select'); this.updateHighlights(); this.ui.update();
          return;
        }
        if (convertTargets(s, u).some((t) => t.id === target.id)) {
          await this.exec({ type: 'convert', unit: u.id, target: target.id });
          return;
        }
      }
      // Verdan-Geschuetz: erst anwaehlen, zweites Antippen greift an / Verdan gun: select first, a second tap attacks
      if (turretTargets(s, u).some((p) => p.x === x && p.y === y)) {
        if (this.pendingTurret && this.pendingTurret.x === x && this.pendingTurret.y === y) {
          this.pendingTurret = null;
          await this.exec({ type: 'attackTurret', unit: u.id, x, y });
          return;
        }
        this.pendingTurret = { x, y }; this.pendingTarget = null; this.tab = 'unit';
        this.play('select'); this.updateHighlights(); this.ui.update();
        return;
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
    this.pendingTurret = null;
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

  /**
   * Stimmung: Spannungsstufe der Musik und Wetter-Atmosphaere aus Sicht des Betrachters.
   * Mood: music tension level and weather ambience from the viewer's point of view.
   */
  updateMood() {
    const s = this.state;
    if (!s) return;
    const v = this.viewer >= 0 ? this.viewer : s.current;
    const cities = s.cities.filter((c) => c.owner === v);
    const own = s.units.filter((u) => u.owner === v);
    let level: 0 | 1 | 2 = 0;
    for (const e of s.units) {
      if (e.owner === v || !isHostile(s, v, e.owner) || !canSeeUnit(s, v, e) || UNITS[e.type].attack <= 0) continue;
      const nearCity = cities.reduce((m, c) => Math.min(m, dist(c, e)), 99);
      if (nearCity <= 1) { level = 2; break; }
      if (nearCity <= 3 || own.some((u) => dist(u, e) <= 2)) level = 1;
    }
    audio.setIntensity(level);
    // kurz vor dem Sieg: deutlich vorn in der zweiten Spielhaelfte / close to victory: clearly ahead in the second half
    const scores = s.factions.filter((f) => f.alive).map((f) => ({ i: f.index, p: score(s, f.index) })).sort((a, b) => b.p - a.p);
    const limit = s.config.roundLimit;
    const late = limit ? s.round >= limit * 0.6 : s.round >= 30;
    audio.setLeading(late && scores.length > 1 && scores[0].i === v && scores[0].p >= scores[1].p * 1.25);
    // Sandsturm klingt wie heulender Wind / a dust storm sounds like howling wind
    const w = weather(s);
    audio.setAmbience(w === 'dust' ? 'wind' : w === 'acid' ? 'rain' : w === 'meteor' || w === 'quake' ? 'clear' : w);
  }

  setTab(tab: Tab) {
    const s = this.state;
    if (!s || !this.selected) return;
    this.tab = tab;
    const u = unitAt(s, this.selected.x, this.selected.y);
    this.selectedUnit = tab === 'unit' && u && (this.viewer < 0 || canSeeUnit(s, this.viewer, u)) ? u.id : null;
    this.pendingTarget = null;
    this.pendingTurret = null;
    this.play('click');
    this.updateHighlights();
    this.ui.update();
  }

  /** Kommando ausfuehren und animieren / execute and animate a command */
  async exec(cmd: Command, opts: { ai?: boolean } = {}): Promise<CommandResult> {
    const s = this.state!;
    const before = new Map(s.units.map((u) => [u.id, { x: u.x, y: u.y, type: u.type, owner: u.owner }]));
    const res = applyCommand(s, cmd);
    this.onCommand?.(cmd, res);
    if (!res.ok) {
      if (!opts.ai) { this.play('error'); this.ui.errorCode(res.error ?? 'invalid'); }
      return res;
    }
    const board = this.view.board;
    const killedIds = new Set(res.events.flatMap((e) => (e.t === 'killed' ? [e.unit] : [])));
    const fid = (owner: number) => s.factions[owner]?.id;
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
            const ab = before.get(e.unit), tb = before.get(e.target);
            const seen = (pos && visible(pos.x, pos.y)) || (ab && visible(ab.x, ab.y));
            const shown = !!pos && visible(pos.x, pos.y);
            // Klang und Anzeigen, mit animiertem Schuss und Einschlag synchron / sound and markers, in sync with the animated shot and impact
            const fire = () => {
              if (!seen || !ab) return;
              audio.weapon(ab.type);
              // eigener Angriff: gelegentlich ein Kampfschrei / own attack: an occasional battle cry
              if (ab.owner === this.viewer && Math.random() < 0.35) audio.battleCry(fid(ab.owner));
            };
            const hit = () => {
              if (seen && tb && !killedIds.has(e.target)) audio.impact(tb.type, false, fid(tb.owner));
              if (!shown || !pos) return;
              this.ui.fx('hit', pos.x, pos.y);
              this.ui.fx('num', pos.x, pos.y, e.retreat ? `${t('retreat.fx')} -${e.dmg}` : e.rocket && (!e.hit || e.hit === 'full') ? `${t('rockets.fx')} -${e.dmg}` : hitText(e.hit, e.dmg));
              for (const sp of e.splash ?? []) { const p = before.get(sp.unit); if (p) this.ui.fx('num', p.x, p.y, `-${sp.dmg}`); }
            };
            // Gegenschlag / retaliation
            const returnFire = () => { if (seen && tb) audio.weapon(tb.type); };
            const returnHit = () => {
              const att = unitById(s, e.unit) ?? null;
              const ap = att ? { x: att.x, y: att.y } : before.get(e.unit);
              if (shown && ap && (e.ret || e.retHit === 'miss')) this.ui.fx('num', ap.x, ap.y, hitText(e.retHit, e.ret));
            };
            if (animate && ab && tb && board.unitObject(e.unit) && board.unitObject(e.target)) {
              const water = (p: { x: number; y: number }) => { const tt = s.tiles[p.y * s.size + p.x].terrain; return tt === 'shallow' || tt === 'ocean'; };
              const shake = seen ? impactShake(weaponOf(ab.type)) : 0;
              const retShake = seen ? impactShake(weaponOf(tb.type)) * 0.8 : 0;
              await board.animateAttack(e.unit, e.target, {
                attacker: ab.type, target: tb.type, attackerFaction: fid(ab.owner), targetFaction: fid(tb.owner),
                attackerWater: water(ab), targetWater: water(tb), retaliate: e.ret > 0, splash: (e.splash ?? []).map((sp) => sp.unit),
                onFire: fire,
                onImpact: () => { hit(); this.view.shake(shake); },
                onReturnFire: returnFire,
                onReturnImpact: () => { returnHit(); this.view.shake(retShake); },
              });
            } else {
              fire(); hit(); returnHit();
              if (e.ret > 0) window.setTimeout(returnFire, 280);
            }
            break;
          }
          case 'killed': {
            const p = before.get(e.unit);
            if (p && visible(p.x, p.y)) { audio.impact(p.type, true, fid(p.owner)); this.ui.fx(e.remains === 'skeleton' ? 'splat' : e.remains === 'wreck' ? 'boom' : 'kill', p.x, p.y); }
            // Fahrzeug- oder Schiffsverlust: grosse Explosion / vehicle or ship lost: big explosion
            if (animate && p && visible(p.x, p.y) && (e.remains === 'wreck' || UNITS[p.type].ship)) this.view.shake(SHAKE.wreck, 420);
            if (animate) await board.animateDeath(e.unit, e.remains ?? null);
            break;
          }
          case 'capture': {
            const c = s.cities.find((cc) => cc.id === e.city)!;
            if (e.faction === this.viewer) audio.sting('cityWon', fid(e.faction));
            else if (e.from !== null && e.from === this.viewer) audio.sting('cityLost');
            else if (visible(c.x, c.y)) this.play('capture');
            if (visible(c.x, c.y)) this.ui.fx('capture', c.x, c.y);
            // Kult: erbeutete Sterne ueber der Stadt / cult: plundered stars above the city
            if (e.plunder && visible(c.x, c.y)) this.ui.fx('num', c.x, c.y, `+${e.plunder}`);
            break;
          }
          // Kult: Rekrut im Feld / cult: recruit in the field
          case 'recruit': {
            const nu = unitById(s, e.unit);
            if (nu && visible(nu.x, nu.y)) { this.play('build'); this.ui.fx('levelUp', nu.x, nu.y); }
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
          // Minen: nur der Besitzer hoert das Legen / mines: only the owner hears the laying
          case 'mine': if (e.faction === this.viewer) this.play('build'); break;
          case 'emplacement': if (e.faction === this.viewer) this.play('build'); break;
          case 'mineHit': if (visible(e.x, e.y)) { this.play('hit'); this.ui.fx('boom', e.x, e.y); this.ui.fx('num', e.x, e.y, `-${e.dmg}`); if (animate) this.view.shake(SHAKE.barrier * 2); } break;
          case 'aaFire': { const tu = before.get(e.target); if (tu && visible(tu.x, tu.y)) { this.play('hit'); this.ui.fx('num', tu.x, tu.y, `-${e.dmg}`); } break; }
          case 'terraform': if (e.faction === this.viewer) this.play('research'); break;
          case 'cityUpgrade': if (e.faction === this.viewer) this.play(e.upgrade === 'radioTower' ? 'research' : 'build'); break;
          case 'barrierHit': if (visible(e.x, e.y)) { this.play('hit'); this.ui.fx('boom', e.x, e.y); if (animate) this.view.shake(SHAKE.barrier); } break;
          case 'research': if (e.faction === this.viewer) this.play('research'); break;
          case 'eruption': {
            if (visible(e.x, e.y)) {
              audio.eruption();
              if (animate) this.view.shake(SHAKE.eruption, SHAKE.eruptionMs);
              this.ui.fx('boom', e.x, e.y);
              for (const p of e.tiles) if (visible(p.x, p.y)) this.ui.fx('boom', p.x, p.y);
              const { t } = await import('../i18n/i18n');
              this.ui.toast(t('hazards.eruption'), 'warning');
            }
            break;
          }
          case 'salvage': {
            if (e.faction === this.viewer) {
              this.play(e.tech ? 'research' : 'levelUp');
              const { t } = await import('../i18n/i18n');
              const { techT } = await import('../ui/terms');
              this.ui.toast(e.tech ? techT('hazards.salvagedTech', this.state?.factions[e.faction]?.id, { tech: t(`techs.${e.tech}`) }) : t('hazards.salvaged', { n: e.stars ?? 0 }), e.tech ? 'research' : 'star');
            }
            break;
          }
          // Verdan-Geschuetz feuert auf eine Einheit / Verdan gun fires at a unit
          case 'turretFire': {
            const tb = before.get(e.target);
            const seen = visible(e.x, e.y) || (tb && visible(tb.x, tb.y));
            if (!seen || !tb) break;
            const impact = () => { audio.impact(tb.type, killedIds.has(e.target), fid(tb.owner)); this.ui.fx('hit', tb.x, tb.y); this.ui.fx('num', tb.x, tb.y, hitText(e.hit, e.dmg)); };
            audio.weapon('tank');
            if (animate && board.unitObject(e.target)) {
              await board.animateTurret(s, { x: e.x, y: e.y }, e.target, true, {
                unitType: tb.type, unitFaction: fid(tb.owner), retaliate: false, ...(e.owner !== undefined ? { gunFaction: fid(e.owner) } : {}),
                onImpact: () => { impact(); this.view.shake(impactShake(weaponOf('tank')) * 0.8); },
              });
            } else impact();
            break;
          }
          // Einheit beschiesst ein Geschuetz / unit attacks a gun
          case 'turretHit': {
            const ab = before.get(e.unit);
            if (!ab || !(visible(e.x, e.y) || visible(ab.x, ab.y))) break;
            const hit = () => {
              this.ui.fx('hit', e.x, e.y);
              this.ui.fx(e.destroyed ? 'boom' : 'num', e.x, e.y, e.destroyed ? undefined : hitText(e.hit, e.dmg));
              if (e.destroyed) { this.play('kill'); this.ui.toast(e.owner !== undefined ? t('emplacement.destroyed', { name: t(`factions.${fid(e.owner)}.short`) }) : t('verdan.destroyed'), 'trophy'); }
            };
            const back = () => { if (e.ret || e.retHit === 'miss') this.ui.fx('num', ab.x, ab.y, hitText(e.retHit, e.ret)); };
            audio.weapon(ab.type);
            if (animate && board.unitObject(e.unit)) {
              await board.animateTurret(s, { x: e.x, y: e.y }, e.unit, false, {
                unitType: ab.type, unitFaction: fid(ab.owner), retaliate: e.ret > 0, ...(e.owner !== undefined ? { gunFaction: fid(e.owner) } : {}),
                onImpact: () => { hit(); this.view.shake(e.destroyed ? SHAKE.wreck : impactShake(weaponOf(ab.type))); },
                onReturnFire: () => audio.weapon('tank'),
                onReturnImpact: back,
              });
            } else { hit(); back(); }
            break;
          }
          // Endgegner: Auftauchen, psychischer Schrei, Brut / boss: emergence, psychic scream, brood
          case 'boss': {
            if (!visible(e.x, e.y)) break;
            if (e.what === 'emerge') { this.play('capture'); this.ui.fx('boom', e.x, e.y); if (animate) this.view.shake(SHAKE.eruption, SHAKE.eruptionMs); }
            else if (e.what === 'scream') {
              this.play('hit');
              if (animate) this.view.shake(SHAKE.wreck, 420);
              for (const h of e.hits ?? []) { const p = before.get(h.unit) ?? unitById(s, h.unit); if (p && visible(p.x, p.y)) { this.ui.fx('hit', p.x, p.y); this.ui.fx('num', p.x, p.y, `-${h.dmg}`); } }
            } else if (e.what === 'brood') { this.play('levelUp'); this.ui.fx('levelUp', e.x, e.y); }
            break;
          }
          // Riss (Ende m11): reisst sichtbar auf, mit langem Beben; erst danach kommt das Ergebnis
          // rift (end of m11): tears open visibly with a long quake; only then the result follows
          case 'rift': {
            const c = board.tileCenter(s, e.x, e.y);
            board.rift.show(c, animate);
            this.play('capture');
            if (animate) {
              this.view.shake(SHAKE.eruption * 1.6, RIFT_OPEN_MS);
              await new Promise((r) => setTimeout(r, RIFT_OPEN_MS));
            }
            this.view.invalidate();
            break;
          }
          // Orbitallaser: Strahl aus dem Himmel, Einschlag mit Beben und Schadenszahlen / orbital laser: beam from the sky, impact with shake and damage numbers
          case 'orbitalStrike': {
            if (!(e.faction === this.viewer || e.tiles.some((p) => visible(p.x, p.y)))) break;
            const impact = () => {
              for (const h of e.hits) if (visible(h.x, h.y)) { this.ui.fx('hit', h.x, h.y); this.ui.fx('num', h.x, h.y, `-${h.dmg}`); }
              if (animate) this.view.shake(ORBITAL_FX.shake, ORBITAL_FX.shakeMs);
            };
            audio.orbital(animate && board.animations ? (ORBITAL_FX.ms * ORBITAL_FX.impact) / 1000 : 0);
            await board.animateOrbital(s, e.tiles, ORBITAL.area.w, fid(e.faction) ?? null, animate, impact);
            break;
          }
          // Meteorschauer und Saeureregen: Einschlag oder Zischen auf jeder getroffenen, sichtbaren Einheit
          // meteor shower and acid rain: impact or hiss on every hit, visible unit
          case 'weatherHit': {
            let shown = 0;
            for (const h of e.hits) {
              if (!visible(h.x, h.y)) continue;
              this.ui.fx(e.kind === 'meteor' ? 'boom' : 'hit', h.x, h.y);
              this.ui.fx('num', h.x, h.y, `-${h.dmg}`);
              if (animate && shown++ < 12) board.weatherFx.impact(board.tileCenter(s, h.x, h.y), e.kind);
            }
            if (shown) { this.play('hit'); if (animate && e.kind === 'meteor') this.view.shake(SHAKE.barrier * 1.5); }
            break;
          }
          // Erdbeben zu Rundenbeginn: die Hoehle bebt (nur mit Animationen) / earthquake at the start of the round: the cavern shakes (animations only)
          case 'turn':
            if (e.weather === 'quake' && e.faction === 0 && animate) this.view.shake(SHAKE.eruption, SHAKE.eruptionMs * 2);
            break;
          default: break;
        }
        this.ui.event(e, s);
      }
    } finally {
      this.busy = false;
    }
    this.refresh();
    this.updateMood();
    this.ui.afterCommand?.(res.events);
    if (this.selectedUnit !== null && !unitById(s, this.selectedUnit)) { this.selectedUnit = null; this.pendingTarget = null; }
    if (this.pendingTarget !== null && !unitById(s, this.pendingTarget)) this.pendingTarget = null;
    if (this.pendingTurret && !s.tiles[this.pendingTurret.y * s.size + this.pendingTurret.x].turret) this.pendingTurret = null;
    this.updateHighlights();
    this.ui.update();
    if (s.over) this.finishGame();
    else if (!opts.ai) this.ui.rewards();
    // Kult im eigenen Zug ausgeschieden (letzte Einheit gefallen): Zug weitergeben / cult eliminated during its own turn (last unit fell): pass the turn
    if (!s.over && !opts.ai && !s.factions[s.current].alive) void this.endTurn();
    return res;
  }

  /**
   * Spielende genau einmal melden: Speichern, Klang, Ergebnisdialog (zaehlt das Kampagnenergebnis).
   * Report the game end exactly once: save, sound, result dialog (records the campaign result).
   */
  private finishGame() {
    const s = this.state;
    if (!s?.over || this.gameOverShown) return;
    this.gameOverShown = true;
    this.autosave();
    const me = this.viewer >= 0 ? this.viewer : s.winner ?? 0;
    audio.gameOver(s.winner === me, s.factions[me]?.id);
    this.ui.gameOver();
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
    this.updateMood();
    audio.sting('turnStart');
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
    if (s.over) { this.finishGame(); return; }
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

/** Schadenszahl mit Trefferart (voller Treffer ohne Zusatz) / damage number with hit kind (full hit without label) */
function hitText(hit: HitKind | undefined, dmg: number): string {
  if (hit === 'miss') return t('hit.miss');
  if (!hit || hit === 'full') return `-${dmg}`;
  return `${t(`hit.${hit}`)} -${dmg}`;
}
