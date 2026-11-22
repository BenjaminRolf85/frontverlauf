/**
 * Controller: jede Eingabe (Maus, Touch, XR) wird hier zu einem Kommando an den Spielkern.
 * Controller: every input (mouse, touch, XR) becomes a command to the game core here.
 */
import {
  score, isHostile, dist, weather, applyCommand, attackTargets, rocketTargets, captureKind, combatPreview, convertTargets, createGame, heliSafe, heliWillCrash,
  ownUnits, reachable, unitAt, workSpots, isSampler, unitById, cityAt, canSeeUnit, isExplored, barrierTargets, mineTargets, emplacementTargets, radioTargets, terraformTargets, turretTargets,
  orbitalPreview, orbitalWait, sabotageTargets, detonateTargets, strikeKind, siloPreview, siloWait, academyMoves, academyTargets, cityById, hackReachTiles, hijackCheck, hijackTargets, towerLink, towerWait,
  landingTargets, terraformPlan, rayCheck, rayReach, rayReadyCheck, rayTargets, type Command, type Pos, type CommandResult, type GameConfig, type GameEvent, type GameState, type Unit,
} from '../core';
import { plansHints } from '../core/temple';
import { planNextCommand, takeOpNews, type OpNews } from '../ai/ai';
import { ORBITAL, SILO, TWIN_STRIKE, UNITS, type HitKind } from '../data/balance';
import { t } from '../i18n/i18n';
import { cityNameOf } from '../i18n/cityNames';
import { audio, type Sfx } from '../audio/audio';
import { coreHeading, NEUTRON_FX, type HighlightKind } from '../render/board';
import type { View } from '../render/view';
import { SHAKE, impactShake, weaponOf } from '../render/combat';
import { RIFT_OPEN_MS } from '../render/rift';
import { ORBITAL_FX } from '../render/fx/orbital';
import { ROCKET_FX } from '../render/fx/rocket';
import { saveGame } from '../save/save';
import type { FxKind } from '../ui/fx';

export type Tab = 'unit' | 'city' | 'tile';

export interface UiHooks {
  update(): void;
  toast(text: string, icon?: string): void;
  errorCode(code: string): void;
  event(e: GameEvent, s: GameState): void;
  fx(kind: FxKind, x: number, y: number, text?: string): void;
  handover(faction: number): Promise<void>;
  confirm(text: string, ok: string): Promise<boolean>;
  gameOver(): void;
  rewards(): void;
  afterCommand?(events: GameEvent[]): void;
  unitSelected?(u: Unit): void;
  turnStarted?(): void;
  /** KI beginnt eine grosse Operation (Sturm, Ablenkung, Einkreisen) / the AI launches a big operation (storm, diversion, encirclement) */
  aiOperation?(n: OpNews, s: GameState): void;
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
  /** Zielauswahl des Raketensilos: Silo und angepeilte Ecke / rocket silo targeting: silo and the aimed corner */
  siloFrom: { x: number; y: number } | null = null;
  siloAim: { x: number; y: number } | null = null;
  /** Zielauswahl fuer die Sabotage des Schattenkommandos / target selection for the Shadow Commando's sabotage */
  sabotageMode = false;
  /** Berserker: Sprengziel waehlen / berserker: pick a detonation target */
  detonateMode = false;
  /** Zielauswahl fuer das Ziehen der schwebenden Akademie: Stadt-ID / target selection for moving the floating academy: city id */
  academyMoveCity: number | null = null;
  /** angewaehlte feindliche Akademie (zweites Antippen greift an) / selected hostile academy (a second tap attacks) */
  pendingAcademy: number | null = null;
  /** Zielauswahl des Neutronenstrahls: Akademie und angepeiltes Feld / neutron beam targeting: academy and the aimed tile */
  beamCity: number | null = null;
  beamAim: Pos | null = null;
  /** Zielauswahl des Hackturms: Turm und angepeilte Einheit / hack tower targeting: tower and the aimed unit */
  hackFrom: { x: number; y: number } | null = null;
  hackAim: number | null = null;
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

  /** Berserker: Sprengziele auf der Karte zeigen / berserker: show the detonation targets on the map */
  startDetonate() {
    this.detonateMode = true;
    this.sabotageMode = false;
    this.barrierMode = false;
    this.mineMode = false;
    this.emplacementMode = false;
    this.updateHighlights();
    this.ui.update();
  }

  /** Sabotage: Ziele auf der Karte zeigen / sabotage: show the targets on the map */
  startSabotage() {
    this.sabotageMode = true;
    this.barrierMode = false;
    this.mineMode = false;
    this.emplacementMode = false;
    this.updateHighlights();
    this.ui.update();
  }

  /** Raketensilo: Zielauswahl beginnen (nur eigenes, bereites Silo am Zug) / rocket silo: start targeting (own ready silo, on turn) */
  startSilo(x: number, y: number) {
    const s = this.state;
    if (!s || !this.isHumanTurn) return;
    const wait = siloWait(s, x, y);
    if (wait === null || s.tiles[y * s.size + x].turret?.owner !== s.current) return;
    if (wait > 0) { this.play('error'); this.ui.errorCode('siloCooldown'); return; }
    this.clearSelection();
    this.siloFrom = { x, y };
    this.play('select');
    this.updateHighlights();
    this.ui.update();
  }

  /** Hackturm: Zielauswahl beginnen (nur eigener, freier und bereiter Turm am Zug) / hack tower: start targeting (own free ready tower, on turn) */
  startHijack(x: number, y: number) {
    const s = this.state;
    if (!s || !this.isHumanTurn) return;
    const wait = towerWait(s, x, y);
    if (wait === null || s.tiles[y * s.size + x].turret?.owner !== s.current) return;
    if (towerLink(s, x, y)) { this.play('error'); this.ui.errorCode('towerBusy'); return; }
    if (wait > 0) { this.play('error'); this.ui.errorCode('towerCooldown'); return; }
    this.clearSelection();
    this.hackFrom = { x, y };
    this.play('select');
    this.updateHighlights();
    this.ui.update();
  }

  /** Zielauswahl des Hackturms abbrechen / cancel the hack tower targeting */
  cancelHijack() {
    if (!this.hackFrom) return;
    const from = this.hackFrom;
    this.hackFrom = null;
    this.hackAim = null;
    this.selected = from; this.tab = 'tile';
    this.updateHighlights();
    this.ui.update();
  }

  /** Angepeilte Einheit uebernehmen / take over the aimed unit */
  async fireHijack() {
    const s = this.state, from = this.hackFrom, aim = this.hackAim;
    if (!s || !from || aim === null || this.busy) return;
    this.hackFrom = null;
    this.hackAim = null;
    const res = await this.exec({ type: 'hijack', x: from.x, y: from.y, target: aim });
    // die uebernommene Einheit gleich anwaehlen, sie kann sofort handeln / select the taken-over unit, it can act at once
    const u = res.ok ? unitById(s, aim) : undefined;
    if (u) { this.selected = { x: u.x, y: u.y }; this.selectedUnit = u.id; this.tab = 'unit'; this.updateHighlights(); this.ui.update(); }
  }

  /** Neutronenstrahl: Zielauswahl beginnen (eigene Akademie, Strahl bereit, am Zug) / neutron beam: start targeting (own academy, beam ready, on turn) */
  startBeam(cityId: number) {
    const s = this.state;
    if (!s || !this.isHumanTurn) return;
    const c = cityById(s, cityId);
    if (!c || c.owner !== s.current) return;
    const chk = rayReadyCheck(s, s.current, c);
    if (chk !== 'ok') { this.play('error'); this.ui.errorCode(chk); return; }
    this.clearSelection();
    this.beamCity = cityId;
    this.beamAim = null;
    this.play('select');
    this.updateHighlights();
    this.ui.update();
  }

  /** Zielauswahl des Strahls abbrechen (zurueck zur Akademie) / cancel the beam targeting (back to the academy) */
  cancelBeam() {
    const s = this.state;
    if (this.beamCity === null) return;
    const c = s ? cityById(s, this.beamCity) : undefined;
    this.beamCity = null;
    this.beamAim = null;
    if (c) { this.selected = { x: c.x, y: c.y }; this.tab = 'city'; }
    this.updateHighlights();
    this.ui.update();
  }

  /** Auf das angepeilte Ziel feuern / fire at the aimed target */
  async fireBeam() {
    const s = this.state, id = this.beamCity, aim = this.beamAim;
    if (!s || id === null || !aim || this.busy) return;
    this.beamCity = null;
    this.beamAim = null;
    const c = cityById(s, id);
    await this.exec({ type: 'academyBeam', city: id, x: aim.x, y: aim.y });
    // weitere Schuesse in diesem Zug: Zielauswahl bleibt an; sonst zurueck zur Akademie / more shots this turn: targeting stays on; otherwise back to the academy
    const left = cityById(s, id);
    if (left && left.owner === s.current && rayTargets(s, left).length) this.beamCity = id;
    else if (c) { this.selected = { x: left?.x ?? c.x, y: left?.y ?? c.y }; this.tab = 'city'; }
    this.updateHighlights();
    this.ui.update();
  }

  /** Zielauswahl des Silos abbrechen / cancel the silo targeting */
  cancelSilo() {
    if (!this.siloFrom) return;
    const from = this.siloFrom;
    this.siloFrom = null;
    this.siloAim = null;
    // zurueck zum Silo-Feld / back to the silo tile
    this.selected = from; this.tab = 'tile';
    this.updateHighlights();
    this.ui.update();
  }

  /** Ecke anpeilen (Maus folgt, Antippen setzt) / aim a corner (mouse follows, a tap sets it) */
  aimSilo(x: number, y: number) {
    if (!this.siloFrom || (this.siloAim && this.siloAim.x === x && this.siloAim.y === y)) return;
    this.siloAim = { x, y };
    this.updateHighlights();
    this.ui.update();
  }

  /** Rakete auf die angepeilte Flaeche starten / launch the rocket at the aimed area */
  async fireSilo() {
    const s = this.state, aim = this.siloAim, from = this.siloFrom;
    if (!s || !aim || !from || this.busy) return;
    this.siloFrom = null;
    this.siloAim = null;
    await this.exec({ type: 'siloLaunch', x: from.x, y: from.y, tx: aim.x, ty: aim.y });
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
    this.beamCity = null;
    this.beamAim = null;
    this.orbitalMode = false;
    this.orbitalAim = null;
    this.siloFrom = null;
    this.siloAim = null;
    this.beamCity = null;
    this.beamAim = null;
    this.hackFrom = null;
    this.hackAim = null;
    this.sabotageMode = false;
    this.detonateMode = false;
    this.barrierMode = false;
    this.mineMode = false;
    this.emplacementMode = false;
    this.radioCity = null;
    this.terraformUnit = null;
    this.selected = null; this.selectedUnit = null; this.pendingTarget = null; this.pendingTurret = null;
    this.academyMoveCity = null; this.pendingAcademy = null;
    this.updateHighlights();
  }

  /** Ziehen der schwebenden Akademie ein- oder ausschalten / toggle moving the floating academy */
  toggleAcademyMove(cityId: number) {
    this.academyMoveCity = this.academyMoveCity === cityId ? null : cityId;
    if (this.academyMoveCity !== null) this.ui.toast(`${t('academy.moveHint')} ${t('academy.landTargetsHint')}`, 'move');
    this.updateHighlights();
    this.ui.update();
  }

  /**
   * Terraformen und landen (ACADEMY.terraform); at = benachbarter neutraler Ort. Wird ein Ort eingeebnet, fragt die
   * Oberflaeche vorher nach ("Neutraler Ort wird eingeebnet").
   * Terraform and land (ACADEMY.terraform); at = adjacent neutral place. If a place is levelled, the UI asks first
   * ("neutral place will be levelled").
   */
  async landAcademy(cityId: number, at?: Pos) {
    const s = this.state;
    const c = s ? cityById(s, cityId) : undefined;
    if (!s || !c) return;
    const plan = terraformPlan(s, c, at ?? c);
    if (plan.razed && !(await this.ui.confirm(t('academy.razeConfirm', { city: cityNameOf(s, plan.razed.id) }), t('academy.razeOk')))) return;
    await this.exec({ type: 'landAcademy', city: cityId, ...(at ? { at } : {}) });
  }

  selectedUnitObj(): Unit | undefined {
    return this.state && this.selectedUnit !== null ? unitById(this.state, this.selectedUnit) : undefined;
  }

  updateHighlights() {
    const s = this.state;
    if (!s) return;
    const list: { x: number; y: number; kind: HighlightKind; facing?: number }[] = [];
    // Ausrichtung der gewaehlten Einheit und des Ziels als Pfeil am Ring (Angriff von hinten) / facing of the selected unit and the target as an arrow on the ring (attack from behind)
    const facingOf = (o: Unit | undefined) => (o && coreHeading(o) !== undefined ? o.facing : undefined);
    const sel = this.selected ? unitAt(s, this.selected.x, this.selected.y) : undefined;
    if (this.selected) list.push({ ...this.selected, kind: 'select', facing: sel && (this.viewer < 0 || canSeeUnit(s, this.viewer, sel)) ? facingOf(sel) : undefined });
    if (this.terraformUnit !== null && this.isHumanTurn) {
      const tu = unitById(s, this.terraformUnit);
      if (tu) for (const p of terraformTargets(s, tu)) list.push({ ...p, kind: 'build' });
    }
    // schwebende Akademie: erreichbare Felder / floating academy: reachable tiles
    if (this.academyMoveCity !== null && this.isHumanTurn) {
      const c = cityById(s, this.academyMoveCity);
      // Landeziele (Terraformen moeglich) gruen, neutrale Orte zum Einebnen rot, sonst nur Ziehen / landing targets (terraforming possible) green, neutral places to level red, otherwise move only
      if (c) {
        const land = landingTargets(s, c);
        const at = (x: number, y: number) => land.find((p) => p.x === x && p.y === y);
        for (const p of academyMoves(s, c)) list.push({ ...p, kind: at(p.x, p.y) ? 'build' : 'move' });
        for (const p of land) if (p.razed) list.push({ x: p.x, y: p.y, kind: 'attack' });
        if (at(c.x, c.y)) list.push({ x: c.x, y: c.y, kind: 'build' });
      }
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
    } else if (u && this.sabotageMode && u.owner === s.current && this.isHumanTurn) {
      for (const p of sabotageTargets(s, u)) list.push({ ...p, kind: 'attack' });
    } else if (u && this.detonateMode && u.owner === s.current && this.isHumanTurn) {
      // Berserker: Panzerung (voller Sprengschaden) als Ziel markiert, andere Bodeneinheiten als Angriff
      // berserker: armour (full blast damage) marked as target, other ground units as attack
      for (const o of detonateTargets(s, u)) list.push({ x: o.x, y: o.y, kind: strikeKind(o.type) === 'armour' ? 'target' : 'attack' });
    } else if (u && u.owner === s.current && this.isHumanTurn) {
      for (const r of reachable(s, u)) {
        const kind: HighlightKind = u.fuel !== null ? (heliSafe(s, u, r.x, r.y) ? 'safe' : 'unsafe') : 'move';
        list.push({ x: r.x, y: r.y, kind });
      }
      for (const t of attackTargets(s, u)) list.push({ x: t.x, y: t.y, kind: t.id === this.pendingTarget ? 'target' : 'attack', ...(t.id === this.pendingTarget ? { facing: facingOf(t) } : {}) });
      for (const t of rocketTargets(s, u)) list.push({ x: t.x, y: t.y, kind: t.id === this.pendingTarget ? 'target' : 'attack', ...(t.id === this.pendingTarget ? { facing: facingOf(t) } : {}) });
      for (const t of convertTargets(s, u)) list.push({ x: t.x, y: t.y, kind: 'attack' });
      // Kampagne m2: Arbeitsplaetze am Mutterschiff fuer den Wissenschaftler / campaign m2: work spots at the mothership for the scientist
      if (isSampler(s, u)) for (const p of workSpots(s)) if (!unitAt(s, p.x, p.y)) list.push({ ...p, kind: 'build' });
      // Verdan-Geschuetze in Reichweite / Verdan guns in range
      for (const p of turretTargets(s, u)) list.push({ ...p, kind: this.pendingTurret && this.pendingTurret.x === p.x && this.pendingTurret.y === p.y ? 'target' : 'attack' });
      // feindliche Akademien (Schild, schwebend) / hostile academies (shield, floating)
      for (const c of academyTargets(s, u)) list.push({ x: c.x, y: c.y, kind: this.pendingAcademy === c.id ? 'target' : 'attack' });
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
      // Kriegsplaene (m4): Tempel, fallen gelassene Plaene oder Hauptquartier / war plans (m4): temple, dropped plans or HQ
      for (const p of plansHints(s)) list.push({ ...p, kind: 'hint' });
    }
    if (this.hintTile) list.push({ ...this.hintTile, kind: 'hint' });
    // Raketensilo: das Silo selbst markieren / rocket silo: mark the silo itself
    if (this.siloFrom && this.isHumanTurn) list.push({ ...this.siloFrom, kind: 'select' });
    // Neutronenstrahl: Reichweite, Ziele und angepeiltes Ziel / neutron beam: range, targets and the aimed target
    if (this.beamCity !== null && this.isHumanTurn) {
      const c = cityById(s, this.beamCity);
      if (c) {
        const targets = rayTargets(s, c);
        const at = new Set(targets.map((p) => p.y * s.size + p.x));
        for (const p of rayReach(s, c)) if (!at.has(p.y * s.size + p.x)) list.push({ ...p, kind: 'reach' });
        for (const p of targets) list.push({ ...p, kind: this.beamAim && this.beamAim.x === p.x && this.beamAim.y === p.y ? 'target' : 'attack' });
        list.push({ x: c.x, y: c.y, kind: 'select' });
      }
    }
    // Hackturm: Reichweite, Ziele und angepeiltes Ziel / hack tower: reach, targets and the aimed target
    if (this.hackFrom && this.isHumanTurn) {
      const from = this.hackFrom;
      const targets = hijackTargets(s, s.current, from.x, from.y);
      const at = new Set(targets.map((u) => u.y * s.size + u.x));
      for (const p of hackReachTiles(s, from.x, from.y)) if (!at.has(p.y * s.size + p.x)) list.push({ ...p, kind: 'reach' });
      for (const u of targets) list.push({ x: u.x, y: u.y, kind: u.id === this.hackAim ? 'target' : 'attack', ...(u.id === this.hackAim ? { facing: facingOf(u) } : {}) });
      list.push({ ...from, kind: 'select' });
    }
    this.view.board.setHighlights(s, list);
    this.updateOrbitalPreview();
  }

  /** Vorschau der Flaeche mit Schadenszahlen (eigene in Warnfarbe) / area preview with damage numbers (own ones in the warning colour) */
  private updateOrbitalPreview() {
    const s = this.state;
    if (!s) return;
    // Raketensilo: dieselbe Flaechenvorschau mit Schaden, Abschuss und Brand / rocket silo: the same area preview with damage, kill and fire
    if (this.siloFrom && this.siloAim && this.isHumanTurn) {
      const pre = siloPreview(s, s.current, this.siloFrom.x, this.siloFrom.y, this.siloAim.x, this.siloAim.y);
      const tags = pre.hits.map((h) => ({ x: h.x, y: h.y, own: h.own, text: t(h.killed ? 'shadow.silo.tagKill' : 'shadow.silo.tag', { dmg: h.dmg }) }));
      this.view.board.showOrbitalPreview(s, pre.tiles, SILO.area.w, tags, pre.check !== 'ok');
      return;
    }
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
    // Neutronenstrahl: erstes Antippen peilt ein Ziel an, zweites feuert / neutron beam: first tap aims at a target, a second fires
    if (this.beamCity !== null) {
      const c = cityById(s, this.beamCity);
      const okTile = !!c && rayCheck(s, s.current, c, x, y) === 'ok';
      if (okTile && this.beamAim && this.beamAim.x === x && this.beamAim.y === y) { await this.fireBeam(); return; }
      this.beamAim = okTile ? { x, y } : null;
      this.play(okTile ? 'select' : 'error');
      this.updateHighlights();
      this.ui.update();
      return;
    }
    // Hackturm: erstes Antippen peilt eine Einheit an, zweites uebernimmt sie / hack tower: first tap aims at a unit, a second takes it over
    if (this.hackFrom) {
      const from = this.hackFrom;
      const tu = unitAt(s, x, y);
      const ok = !!tu && hijackCheck(s, s.current, from.x, from.y, tu) === 'ok';
      if (ok && this.hackAim === tu!.id) { await this.fireHijack(); return; }
      this.hackAim = ok ? tu!.id : null;
      this.play(ok ? 'select' : 'error');
      this.updateHighlights();
      this.ui.update();
      return;
    }
    // Raketensilo: erstes Antippen peilt an, zweites auf dieselbe Ecke startet / rocket silo: first tap aims, a second on the same corner launches
    if (this.siloFrom) {
      const from = this.siloFrom;
      if (this.siloAim && this.siloAim.x === x && this.siloAim.y === y && siloPreview(s, s.current, from.x, from.y, x, y).check === 'ok') { await this.fireSilo(); return; }
      this.aimSilo(x, y);
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
    if (this.academyMoveCity !== null) {
      const cityId = this.academyMoveCity;
      this.academyMoveCity = null;
      const c = cityById(s, cityId);
      // benachbarter neutraler Ort: einebnen und landen (mit Rueckfrage) / adjacent neutral place: level and land (with a confirmation)
      if (c && landingTargets(s, c).some((p) => p.razed && p.x === x && p.y === y)) {
        await this.landAcademy(cityId, { x, y });
        this.updateHighlights(); this.ui.update();
        return;
      }
      if (c && academyMoves(s, c).some((p) => p.x === x && p.y === y)) {
        await this.exec({ type: 'moveAcademy', city: cityId, to: { x, y } });
        this.selected = { x, y }; this.tab = 'city';
        const left = cityById(s, cityId);
        // weitere Felder in diesem Zug: Zielauswahl bleibt an / more tiles this turn: targeting stays on
        if (left && academyMoves(s, left).length) this.academyMoveCity = cityId;
        this.updateHighlights(); this.ui.update();
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
    if (u && this.detonateMode) {
      this.detonateMode = false;
      const o = unitAt(s, x, y);
      if (o && detonateTargets(s, u).some((d) => d.id === o.id)) {
        await this.exec({ type: 'detonate', unit: u.id, target: o.id });
        return;
      }
      this.updateHighlights(); this.ui.update();
      return;
    }
    if (u && this.sabotageMode) {
      this.sabotageMode = false;
      if (sabotageTargets(s, u).some((p) => p.x === x && p.y === y)) {
        await this.exec({ type: 'sabotage', unit: u.id, x, y });
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
      // feindliche Akademie: erst anwaehlen, zweites Antippen greift an / hostile academy: select first, a second tap attacks
      const hostileAcademy = academyTargets(s, u).find((c) => c.x === x && c.y === y);
      if (hostileAcademy) {
        if (this.pendingAcademy === hostileAcademy.id) {
          this.pendingAcademy = null;
          await this.exec({ type: 'attackAcademy', unit: u.id, city: hostileAcademy.id });
          return;
        }
        this.pendingAcademy = hostileAcademy.id; this.pendingTarget = null; this.pendingTurret = null; this.tab = 'unit';
        this.play('select'); this.updateHighlights(); this.ui.update();
        return;
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
    this.pendingTarget = null; this.detonateMode = false;
    this.pendingTurret = null;
    this.pendingAcademy = null;
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
    this.pendingTarget = null; this.detonateMode = false;
    this.pendingTurret = null;
    this.play('click');
    this.updateHighlights();
    this.ui.update();
  }

  /**
   * Schnelle KI ohne Animation: Ausrichtung von Einheiten und Drehtuermen trotzdem nachfuehren (Fahrtrichtung, Ziel,
   * Gegenschlag), sonst zeigen Rohre nach der Runde in beliebige Richtungen.
   * Fast AI without animation: still update the facing of units and turrets (driving direction, target, return fire),
   * otherwise barrels point anywhere after the turn.
   */
  private faceEvents(s: GameState, events: GameEvent[], before: Map<number, { x: number; y: number }>) {
    const board = this.view.board;
    for (const e of events) {
      if (e.t === 'move') { const from = before.get(e.unit); if (from) board.faceMove(s, e.unit, from, e.path); }
      else if (e.t === 'attack') {
        const ab = before.get(e.unit), tb = before.get(e.target);
        if (tb) board.faceTarget(s, e.unit, tb);
        if (ab && (e.ret > 0 || e.retHit === 'miss')) board.faceTarget(s, e.target, ab);
      } else if (e.t === 'turretHit') board.faceTarget(s, e.unit, { x: e.x, y: e.y });
    }
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
            } else if (from) board.faceMove(s, e.unit, from, e.path);
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
            // Selbstsprengung des Berserkers: Sprengladung statt Axt, grosse Explosion / the berserker's self-detonation: blast charge instead of the axe, big explosion
            const weapon = e.detonate ? 'blast' as const : weaponOf(ab?.type ?? 'infantry');
            const fire = () => {
              if (!seen || !ab) return;
              audio.weapon(ab.type, weapon);
              // eigener Angriff: gelegentlich ein Kampfschrei / own attack: an occasional battle cry
              if (ab.owner === this.viewer && Math.random() < 0.35) audio.battleCry(fid(ab.owner));
            };
            const hit = () => {
              if (seen && tb && !killedIds.has(e.target)) audio.impact(tb.type, false, fid(tb.owner));
              if (!shown || !pos) return;
              this.ui.fx('hit', pos.x, pos.y);
              this.ui.fx('num', pos.x, pos.y, e.retreat ? `${t('retreat.fx')} -${e.dmg}` : e.detonate ? `${t('berserker.fxDetonate')} -${e.dmg}` : e.rocket && (!e.hit || e.hit === 'full') ? `${t('rockets.fx')} -${e.dmg}` : hitText(e.hit, e.dmg));
              // Berserker: erster Hieb, der zweite folgt / berserker: first blow, the second follows
              if (e.strike === 1 && ab) { const ap = unitById(s, e.unit); if (ap) this.ui.fx('num', ap.x, ap.y, t('berserker.fxStrike', { n: e.strike, max: TWIN_STRIKE.strikes })); }
              for (const sp of e.splash ?? []) { const p = before.get(sp.unit); if (p) this.ui.fx('num', p.x, p.y, `-${sp.dmg}`); }
            };
            // Gegenschlag / retaliation
            const returnFire = () => { if (seen && tb) audio.weapon(tb.type); };
            // Gegenschlag auch dann zeigen, wenn er daneben geht / show the return fire even when it misses
            const retaliates = e.ret > 0 || e.retHit === 'miss';
            const returnHit = () => {
              const att = unitById(s, e.unit) ?? null;
              const ap = att ? { x: att.x, y: att.y } : before.get(e.unit);
              if (shown && ap && (e.ret || e.retHit === 'miss')) this.ui.fx('num', ap.x, ap.y, hitText(e.retHit, e.ret));
            };
            if (animate && ab && tb && board.unitObject(e.unit) && board.unitObject(e.target)) {
              const water = (p: { x: number; y: number }) => { const tt = s.tiles[p.y * s.size + p.x].terrain; return tt === 'shallow' || tt === 'ocean'; };
              const shake = seen ? impactShake(weapon) * (e.detonate ? 1.5 : 1) : 0;
              const retShake = seen ? impactShake(weaponOf(tb.type)) * 0.8 : 0;
              await board.animateAttack(e.unit, e.target, {
                attacker: ab.type, target: tb.type, attackerFaction: fid(ab.owner), targetFaction: fid(tb.owner),
                attackerWater: water(ab), targetWater: water(tb), retaliate: retaliates, splash: (e.splash ?? []).map((sp) => sp.unit),
                ...(e.detonate ? { weapon, blast: 1.7 } : {}),
                // Wanne nach der Ausrichtung im Spielstand / hull from the facing in the game state
                attackerHull: coreHeading(unitById(s, e.unit)), targetHull: retaliates ? coreHeading(unitById(s, e.target)) : undefined,
                onFire: fire,
                onImpact: () => { hit(); this.view.shake(shake); },
                onReturnFire: returnFire,
                onReturnImpact: () => { returnHit(); this.view.shake(retShake); },
              });
            } else {
              fire(); hit(); returnHit();
              if (retaliates) window.setTimeout(returnFire, 280);
              // ohne Animation: Ausrichtung (Turm oder Einheit) sofort setzen / without animation: set the facing (turret or unit) at once
              if (tb) board.faceTarget(s, e.unit, tb);
              if (retaliates && ab) board.faceTarget(s, e.target, ab);
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
            // Fernuebernahme (NEXUS): Datenblitz am Ort / remote takeover (NEXUS): data flash at the place
            if (e.hack && visible(c.x, c.y)) { this.ui.fx('hack', c.x, c.y); if (animate) await board.animateHack(s, c, fid(e.faction) ?? null); }
            if (e.faction === this.viewer) audio.sting('cityWon', fid(e.faction));
            else if (e.from !== null && e.from === this.viewer) audio.sting('cityLost');
            else if (visible(c.x, c.y)) this.play('capture');
            if (visible(c.x, c.y)) this.ui.fx('capture', c.x, c.y);
            // Kult: erbeutete Sterne ueber der Stadt / cult: plundered stars above the city
            if (e.plunder && visible(c.x, c.y)) this.ui.fx('num', c.x, c.y, `+${e.plunder}`);
            break;
          }
          // Raketensilo baut eine Einheit: sie erscheint sichtbar neben dem Silo / rocket silo builds a unit: it appears visibly next to the silo
          case 'siloBuy': {
            const nu = unitById(s, e.unit);
            if (nu && visible(nu.x, nu.y)) { this.play('build'); this.ui.fx('levelUp', nu.x, nu.y); }
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
          // Maertyrer-Segen: Lichtkranz am Ort des Gefallenen, Heilung bei den Nachbarn / Martyr's Blessing: halo where the unit fell, healing at the neighbours
          case 'blessing': {
            if (!visible(e.x, e.y)) break;
            this.play('levelUp');
            this.ui.fx('bless', e.x, e.y);
            for (const b of e.units) {
              const u = unitById(s, b.unit);
              if (u && visible(u.x, u.y)) this.ui.fx('bless', u.x, u.y, b.heal > 0 ? `+${b.heal}` : t('blessing.fx'));
            }
            break;
          }
          case 'build': if (e.faction === this.viewer) this.play('build'); break;
          case 'barrier': if (e.faction === this.viewer) this.play('build'); break;
          // Minen: nur der Besitzer hoert das Legen / mines: only the owner hears the laying
          case 'mine': if (e.faction === this.viewer) this.play('build'); break;
          case 'emplacement': if (e.faction === this.viewer) this.play('build'); if (e.kind === 'hack') this.refresh(); break;
          // Hackturm uebernimmt eine Einheit / gibt sie zurueck: Signal am Turm und an der Einheit / hack tower takes over a unit / gives it back: signal at the tower and at the unit
          case 'hijack': {
            const u = unitById(s, e.unit);
            if (u && visible(u.x, u.y)) { this.play('research'); this.ui.fx('hack', u.x, u.y); if (animate) await board.animateHijack(s, { x: e.x, y: e.y }, u, fid(e.faction) ?? null); }
            this.refresh();
            break;
          }
          // Ende der Uebernahme: zurueck, dauerhaft uebernommen oder abgeschaltet (danach folgt 'killed' mit Wrack)
          // end of the takeover: returned, permanently taken over or shut down (then 'killed' with a wreck follows)
          // Stadt-Hack: Datensaeule ueber der Stadt fuer Hacker und Opfer / city hack: data column above the city for hacker and victim
          case 'cityHack': {
            if (e.faction === this.viewer || e.victim === this.viewer || visible(e.x, e.y)) {
              this.play('research');
              this.ui.fx('hack', e.x, e.y, t('hack.city.fx'));
              if (animate) await board.animateHack(s, { x: e.x, y: e.y }, fid(e.faction) ?? null);
            }
            this.refresh();
            break;
          }
          case 'hijackEnd': {
            const at = e.x !== undefined && e.y !== undefined ? { x: e.x, y: e.y } : unitById(s, e.unit);
            if (at && visible(at.x, at.y)) {
              if (e.outcome === 'kept') { this.play('capture'); this.ui.fx('hack', at.x, at.y, t('hack.hijack.fxKept')); if (animate) await board.animateHack(s, at, fid(e.by) ?? null); }
              else if (e.outcome === 'shutdown') { this.play('error'); this.ui.fx('hackEnd', at.x, at.y, t('hack.hijack.fxShutdown')); }
              else this.ui.fx('hackEnd', at.x, at.y);
            }
            this.refresh();
            break;
          }
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
                unitType: ab.type, unitFaction: fid(ab.owner), retaliate: e.ret > 0 || e.retHit === 'miss', ...(e.owner !== undefined ? { gunFaction: fid(e.owner) } : {}),
                unitHull: coreHeading(unitById(s, e.unit)),
                onImpact: () => { hit(); this.view.shake(e.destroyed ? SHAKE.wreck : impactShake(weaponOf(ab.type))); },
                onReturnFire: () => audio.weapon('tank'),
                onReturnImpact: back,
              });
            } else { hit(); back(); board.faceTarget(s, e.unit, { x: e.x, y: e.y }); }
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
          // Schwebende Akademie: Abheben, Ziehen, Landen und Notlandung als Uebergang / floating academy: lift-off, move, landing and emergency landing as a transition
          case 'academy': {
            const c = cityById(s, e.city);
            if (!c || !(visible(e.x, e.y) || (e.from && visible(e.from.x, e.from.y)))) break;
            if (e.what === 'lift' || e.what === 'land' || e.what === 'forced' || e.what === 'terraform') this.play('build');
            // eingeebneter neutraler Ort: kurze Staubwolke und Beben / levelled neutral place: a short dust cloud and quake
            if (e.what === 'land' && e.razed) { this.ui.fx('boom', e.x, e.y); if (animate) this.view.shake(SHAKE.wreck * 0.6, 300); }
            if (e.what === 'forced') { this.ui.fx('boom', e.x, e.y); if (animate) this.view.shake(SHAKE.wreck, 420); }
            await board.animateAcademy(s, c, e.what, e.from ?? null, animate);
            break;
          }
          // Schild: Treffer als Zahl ueber der Akademie / shield: hits as a number above the academy
          case 'shield': {
            const c = cityById(s, e.city);
            if (c && visible(c.x, c.y) && e.what === 'hit') this.ui.fx('num', c.x, c.y, e.dmg ? `${t('academy.shield')} -${e.dmg}` : hitText(e.hit, 0));
            if (c && visible(c.x, c.y) && e.what === 'down') this.ui.fx('boom', c.x, c.y);
            break;
          }
          // Neutronenstrahl: Strahl von der Spulenspitze, Einschlag mit Zahl und Beben / neutron beam: beam from the spire tip, impact with number and shake
          case 'neutron': {
            const c = cityById(s, e.city);
            if (!c || !(e.faction === this.viewer || visible(e.x, e.y) || visible(e.from.x, e.from.y))) break;
            const tb = e.unit !== undefined ? before.get(e.unit) : undefined;
            const impact = () => {
              if (tb) audio.impact(tb.type, e.killed, fid(tb.owner));
              if (!visible(e.x, e.y)) return;
              this.ui.fx('hit', e.x, e.y);
              this.ui.fx(e.turret && e.killed ? 'boom' : 'num', e.x, e.y, e.turret && e.killed ? undefined : `${t('academy.beamFx')} ${hitText(e.hit, e.dmg)}`);
              if (e.turret && e.killed && e.victim !== undefined) this.ui.toast(t('emplacement.destroyed', { name: t(`factions.${fid(e.victim)}.short`) }), 'trophy');
              if (animate) this.view.shake(SHAKE.barrier * 1.5);
            };
            audio.orbital(animate && board.animations ? (NEUTRON_FX.ms * NEUTRON_FX.impact) / 1000 : 0);
            await board.animateNeutron(s, c, { x: e.x, y: e.y }, animate, impact);
            break;
          }
          // Abwehrraketen fangen ab: Blitz am Ziel und Hinweis / defence missiles intercept: flash at the target and a note
          case 'intercept': {
            if (!(e.faction === this.viewer || visible(e.x, e.y))) break;
            this.play('hit');
            this.ui.fx('hit', e.x, e.y);
            this.ui.fx('num', e.x, e.y, t('academy.mod.missiles.fx'));
            break;
          }
          // Rumpf: Treffer als Zahl / hull: hits as a number
          case 'hull': {
            const c = cityById(s, e.city);
            if (c && visible(c.x, c.y) && e.what === 'hit') this.ui.fx('num', c.x, c.y, e.dmg ? `${t('academy.mod.armour.short')} -${e.dmg}` : hitText(e.hit, 0));
            break;
          }
          // Ausbau gekauft: Modell neu (Module sichtbar) / upgrade bought: rebuild the model (modules visible)
          case 'module': {
            if (e.faction === this.viewer) this.play('build');
            this.refresh();
            break;
          }
          // Beamer: Lichtsaeule an Abflug und Ankunft / beamer: column of light at departure and arrival
          case 'beam': {
            if (visible(e.x, e.y) && e.what !== 'built') { this.play('build'); this.ui.fx('levelUp', e.x, e.y); }
            if (e.what === 'depart') this.refresh();
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
          // Raketensilo: Bogenflug, Einschlag mit Beben und Schadenszahlen, danach brennt die Flaeche / rocket silo: arc flight, impact with shake and damage numbers, then the area burns
          case 'siloLaunch': {
            if (!(e.faction === this.viewer || e.tiles.some((p) => visible(p.x, p.y)) || visible(e.from.x, e.from.y))) break;
            const impact = () => {
              audio.impact('guidedMissile', true, fid(e.faction));
              for (const h of e.hits) if (visible(h.x, h.y)) { this.ui.fx('hit', h.x, h.y); this.ui.fx('num', h.x, h.y, `-${h.dmg}`); }
              // abgefangen (Abwehrraketen der Akademie): kein Einschlag / intercepted (academy defence missiles): no impact
              if (!e.intercepted) for (const p of e.tiles) if (visible(p.x, p.y)) this.ui.fx('boom', p.x, p.y);
              if (animate) this.view.shake(ROCKET_FX.shake, ROCKET_FX.shakeMs);
            };
            audio.weapon('guidedMissile');
            await board.animateSilo(s, e.from, e.tiles, fid(e.faction) ?? null, animate, impact);
            this.refresh();
            break;
          }
          // Raketenbrand zu Rundenbeginn / rocket fire at the start of the round
          case 'fireHit': {
            let shown = 0;
            for (const h of e.hits) { if (!visible(h.x, h.y)) continue; this.ui.fx('hit', h.x, h.y); this.ui.fx('num', h.x, h.y, `-${h.dmg}`); shown++; }
            if (shown) this.play('hit');
            break;
          }
          // Sabotage: Knall am Ziel / sabotage: a bang at the target
          case 'sabotage': if (visible(e.x, e.y)) { this.play('hit'); this.ui.fx('boom', e.x, e.y); } this.refresh(); break;
          // Radarimpuls: Einheiten unter den Wolken tauchen auf / radar sweep: units under the clouds appear
          case 'radarSweep': if (e.faction === this.viewer) { this.play('research'); this.refresh(); } break;
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
          // Meldungen der operativen Ebene (die Oberflaeche zeigt nur Sichtbares) / notices of the operational layer (the UI only shows what is visible)
          for (const n of takeOpNews(s)) this.ui.aiOperation?.(n, s);
          const fast = this.aiSpeed === 'instant' || this.speedUp || !this.view.board.animations;
          let res: CommandResult;
          if (fast) {
            const before = new Map(s.units.map((u) => [u.id, { x: u.x, y: u.y }]));
            res = applyCommand(s, cmd);
            this.onCommand?.(cmd, res);
            if (res.ok) { for (const e of res.events) this.ui.event(e, s); this.ui.afterCommand?.(res.events); this.faceEvents(s, res.events, before); }
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
