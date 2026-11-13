/**
 * VR- und AR-Modus fuer Meta Quest 3 (WebXR). Dieselbe Partie als Tischdiorama.
 * VR and AR mode for Meta Quest 3 (WebXR). The same game as a table diorama.
 * - VR: Diorama (1,2 m) auf einem Tisch in einem schlichten Lageraum, keine kuenstliche Fortbewegung.
 * - AR: Passthrough, Platzierung per Hit-Test auf echter Flaeche, sonst 1 m vor dem Spieler auf Hueft-Hoehe.
 * - Controller-Strahl + Ausloeser, Handtracking (Pinch), Greifen: eine Hand verschiebt/dreht, zwei skalieren.
 */
import * as THREE from 'three';
import { TECHS, TECH_IDS, type TechId } from '../data/balance';
import {
  cityById, income, researchCost, rewardOptions, score, techState, type GameState,
} from '../core';
import { components, factionTokens, hex, semantic } from '../design/tokens';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { CLOUD_Y, OUTLINE, XR } from '../render/config';
import { coloredBox, outlined, paint } from '../render/toon';
import type { View } from '../render/view';
import { Panel } from './panel';
import { cityName } from '../ui/hud';

type Mode = 'vr' | 'ar';
interface Hand { ctrl: THREE.XRTargetRaySpace; grip: THREE.XRGripSpace; source: XRInputSource | null; line: THREE.Line; grabbing: boolean; selectAt: number; selectPos: THREE.Vector3 | null; pinchGrab: boolean }

export class XrSession {
  supported = { vr: false, ar: false };
  active = false;
  private mode: Mode = 'vr';
  private session: XRSession | null = null;
  private root = new THREE.Group(); // Tisch-Anker / table anchor
  private room = new THREE.Group();
  private hands: Hand[] = [];
  private hover = new THREE.Mesh();
  private hitSource: XRHitTestSource | null = null;
  private placed = false;
  private reticle: THREE.Mesh;
  private status = new Panel(0.62, 0.16);
  private actions = new Panel(0.5, 0.42);
  private wrist = new Panel(0.16, 0.2);
  private research = new Panel(1.0, 0.8);
  private rewards = new Panel(0.6, 0.3);
  private showResearch = false;
  private selectedTech: TechId | null = null;
  private rewardDone: (() => void) | null = null;
  private saved: { parent: THREE.Object3D | null; pos: THREE.Vector3; scale: number; quat: THREE.Quaternion } | null = null;
  private grabStart: { root: THREE.Matrix4; a: THREE.Vector3; b?: THREE.Vector3; dist?: number; scale: number; yaw: number; ctrlYaw: number } | null = null;
  actionsProvider: (() => { id: string; label: string; cost?: number; enabled: boolean; run: () => void }[]) | null = null;

  constructor(private view: View, private game: Controller) {
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.11, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hex(semantic.accent) }));
    this.reticle.visible = false;
    this.hover = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.48, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hex(semantic.highlightSelect), transparent: true, opacity: 0.9, depthWrite: false }));
    this.hover.visible = false;
    this.hover.renderOrder = 6;
  }

  async detect() {
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr) return;
    try { this.supported.vr = await xr.isSessionSupported('immersive-vr'); } catch { this.supported.vr = false; }
    try { this.supported.ar = await xr.isSessionSupported('immersive-ar'); } catch { this.supported.ar = false; }
  }

  async start(mode: Mode) {
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr || !this.game.state) { this.game.ui.toast(t('xr.notSupported'), 'warning'); return; }
    try {
      const session = await xr.requestSession(mode === 'vr' ? 'immersive-vr' : 'immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'hit-test', 'bounded-floor'],
      });
      this.mode = mode;
      this.session = session;
      const r = this.view.renderer;
      r.xr.setReferenceSpaceType('local-floor');
      await r.xr.setSession(session);
      this.enter();
      session.addEventListener('end', () => this.exit());
    } catch {
      this.game.ui.toast(t('xr.failed'), 'warning');
    }
  }

  private enter() {
    const v = this.view, s = this.game.state!;
    v.applyShadows(true);
    this.active = true;
    const board = v.board.group;
    this.saved = { parent: board.parent, pos: board.position.clone(), scale: board.scale.x, quat: board.quaternion.clone() };
    v.scene.add(this.root);
    this.root.add(board);
    const scale = XR.mapEdge / (s.size + 0.1);
    board.scale.setScalar(scale);
    board.position.set(0, -(-0.42 - 0.55) * scale, 0); // Unterkante der Scholle auf Tischhoehe / slab bottom at table height
    board.quaternion.identity();
    v.board.showLabels = true;
    v.board.life.lite = true;
    this.root.add(this.hover);
    v.scene.add(this.reticle);
    if (this.mode === 'vr') {
      this.buildRoom();
      v.scene.add(this.room);
      this.root.position.set(0, XR.tableHeight, -0.85);
      this.placed = true;
    } else {
      this.placed = false;
      this.root.position.set(0, XR.arHipHeight, -XR.arDistance);
      this.root.visible = false;
      this.session!.requestReferenceSpace('viewer').then((space) =>
        this.session!.requestHitTestSource?.({ space })?.then((src) => { this.hitSource = src ?? null; }),
      ).catch(() => { this.hitSource = null; });
      // ohne Flaechenerkennung: 1 m vor dem Spieler auf Hueft-Hoehe / without plane detection: 1 m ahead at hip height
      setTimeout(() => { if (!this.placed && !this.hitSource) this.placeFallback(); }, 1500);
    }
    // Panels / panels
    this.status.mesh.position.set(0, 0.06, XR.mapEdge / 2 + 0.12);
    this.status.mesh.rotation.x = -0.9;
    this.root.add(this.status.mesh);
    this.actions.mesh.visible = false;
    this.root.add(this.actions.mesh);
    this.research.mesh.position.set(0, 0.75, -0.2);
    this.research.mesh.visible = false;
    this.root.add(this.research.mesh);
    this.rewards.mesh.position.set(0, 0.45, 0.25);
    this.rewards.mesh.visible = false;
    this.root.add(this.rewards.mesh);
    this.setupInputs();
    this.view.onFrame = (now, frame) => this.frame(now, frame);
    this.refreshPanels();
  }

  private placeFallback() {
    const cam = this.view.renderer.xr.getCamera();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    dir.y = 0; dir.normalize();
    this.root.position.set(cam.position.x + dir.x * XR.arDistance, XR.arHipHeight, cam.position.z + dir.z * XR.arDistance);
    this.root.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    this.root.visible = true;
    this.placed = true;
  }

  private exit() {
    const v = this.view;
    this.active = false;
    this.session = null;
    this.hitSource?.cancel?.();
    this.hitSource = null;
    const board = v.board.group;
    if (this.saved) {
      (this.saved.parent ?? v.scene).add(board);
      board.position.copy(this.saved.pos);
      board.scale.setScalar(this.saved.scale);
      board.quaternion.copy(this.saved.quat);
    }
    v.scene.remove(this.root, this.room, this.reticle);
    for (const h of this.hands) { v.scene.remove(h.ctrl, h.grip); }
    this.hands = [];
    this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.root.scale.setScalar(1);
    this.root.visible = true;
    v.onFrame = null;
    v.resize();
    v.board.life.lite = false;
    v.applyShadows(false);
    v.invalidate();
    if (this.rewardDone) { const d = this.rewardDone; this.rewardDone = null; d(); }
  }

  /** Schlichter Lageraum (Comic-Stil) / simple storage room (comic style) */
  private buildRoom() {
    if (this.room.children.length) return;
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number) => {
      const o = outlined(g, OUTLINE.building);
      o.position.set(x, y, z);
      this.room.add(o);
    };
    add(coloredBox(8, 0.1, 8, semantic.surfaceSunken, semantic.neutralDark), 0, -0.05, 0);
    add(paint(new THREE.BoxGeometry(8, 3, 0.1).toNonIndexed(), semantic.surface), 0, 1.5, -4);
    add(paint(new THREE.BoxGeometry(0.1, 3, 8).toNonIndexed(), semantic.surface), -4, 1.5, 0);
    add(paint(new THREE.BoxGeometry(0.1, 3, 8).toNonIndexed(), semantic.surface), 4, 1.5, 0);
    // Tisch / table
    add(coloredBox(XR.tableSize, 0.06, XR.tableSize * 0.8, semantic.neutral, semantic.neutralDark), 0, XR.tableHeight - 0.03, -0.85);
    for (const [x, z] of [[-0.7, -0.5], [0.7, -0.5], [-0.7, -1.2], [0.7, -1.2]]) add(paint(new THREE.BoxGeometry(0.06, XR.tableHeight - 0.06, 0.06).toNonIndexed(), semantic.neutralDark), x, (XR.tableHeight - 0.06) / 2, z);
    // Kisten und Regal / crates and shelf
    for (const [x, z, s] of [[-3, -3.2, 0.6], [-2.3, -3.3, 0.5], [-3.1, -2.4, 0.5], [3, -3, 0.7]]) add(coloredBox(s, s, s, semantic.accentStrong, semantic.warning), x, s / 2, z);
    add(coloredBox(2.4, 0.08, 0.5, semantic.neutral, semantic.neutralDark), 1.2, 1.3, -3.7);
    add(coloredBox(2.4, 0.08, 0.5, semantic.neutral, semantic.neutralDark), 1.2, 0.7, -3.7);
    const lamp = new THREE.PointLight(hex(semantic.white), 6, 8);
    lamp.position.set(0, 2.6, -0.8);
    this.room.add(lamp);
  }

  private setupInputs() {
    const r = this.view.renderer;
    for (let i = 0; i < 2; i++) {
      const ctrl = r.xr.getController(i);
      const grip = r.xr.getControllerGrip(i);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: hex(semantic.accent) }));
      line.scale.z = 2;
      ctrl.add(line);
      const h: Hand = { ctrl, grip, source: null, line, grabbing: false, selectAt: 0, selectPos: null, pinchGrab: false };
      ctrl.addEventListener('connected', (e) => {
        h.source = (e as unknown as { data: XRInputSource }).data;
        if (h.source.handedness === 'left') { this.wrist.mesh.position.set(0, 0.06, 0.02); this.wrist.mesh.rotation.x = -1.2; grip.add(this.wrist.mesh); }
      });
      ctrl.addEventListener('disconnected', () => { h.source = null; });
      ctrl.addEventListener('selectstart', () => { h.selectAt = performance.now(); h.selectPos = ctrl.position.clone(); });
      ctrl.addEventListener('selectend', () => {
        const wasGrab = h.pinchGrab;
        if (h.pinchGrab) { h.pinchGrab = false; h.grabbing = false; this.beginGrab(); }
        h.selectPos = null;
        if (!wasGrab) this.select(h);
      });
      ctrl.addEventListener('squeezestart', () => { h.grabbing = true; this.beginGrab(); });
      ctrl.addEventListener('squeezeend', () => { h.grabbing = false; this.beginGrab(); });
      this.view.scene.add(ctrl, grip);
      this.hands.push(h);
    }
  }

  private pulse(h: Hand) {
    const act = h.source?.gamepad?.hapticActuators?.[0] as (GamepadHapticActuator & { pulse?: (v: number, d: number) => void }) | undefined;
    try { act?.pulse?.(0.5, 40); } catch { /* ignorieren / ignore */ }
  }

  private ray(h: Hand): THREE.Raycaster {
    const m = h.ctrl.matrixWorld;
    const ray = new THREE.Raycaster();
    ray.ray.origin.setFromMatrixPosition(m);
    ray.ray.direction.set(0, 0, -1).transformDirection(m);
    return ray;
  }

  private panelsList(): Panel[] { return [this.status, this.actions, this.wrist, this.research, this.rewards].filter((p) => p.mesh.visible && p.mesh.parent); }

  private select(h: Hand) {
    // AR-Platzierung / AR placement
    if (this.mode === 'ar' && !this.placed) {
      if (this.reticle.visible) {
        this.root.position.setFromMatrixPosition(this.reticle.matrix);
        const cam = this.view.renderer.xr.getCamera();
        this.root.rotation.set(0, Math.atan2(cam.position.x - this.root.position.x, cam.position.z - this.root.position.z), 0);
        this.root.visible = true; this.placed = true; this.reticle.visible = false;
      } else this.placeFallback();
      this.pulse(h);
      return;
    }
    const ray = this.ray(h);
    const hits = ray.intersectObjects(this.panelsList().map((p) => p.mesh), false);
    if (hits.length && hits[0].uv) {
      const panel = hits[0].object.userData.panel as Panel;
      const b = panel.hit(hits[0].uv);
      if (b && b.enabled) { this.pulse(h); this.press(b.id); }
      return;
    }
    const tile = this.view.board.pick(ray);
    if (tile) { this.pulse(h); void this.game.tapTile(tile.x, tile.y).then(() => this.refreshPanels()); }
  }

  private press(id: string) {
    const g = this.game;
    if (id === 'end') void g.endTurn();
    else if (id === 'research') { this.showResearch = !this.showResearch; this.refreshPanels(); }
    else if (id === 'exit') void this.session?.end();
    else if (id === 'replace') { this.placed = false; if (this.mode === 'vr') this.placed = true; }
    else if (id === 'music') { g.play('click'); }
    else if (id.startsWith('tech-')) { this.selectedTech = id.slice(5) as TechId; this.refreshPanels(); }
    else if (id === 'doResearch' && this.selectedTech) void g.exec({ type: 'research', tech: this.selectedTech }).then(() => this.refreshPanels());
    else if (id === 'closeResearch') { this.showResearch = false; this.refreshPanels(); }
    else if (id.startsWith('act-')) {
      const a = this.actionsProvider?.().find((x) => x.id === id.slice(4));
      if (a && a.enabled) a.run();
    } else if (id === 'rewardA' || id === 'rewardB') {
      const s = g.state!;
      const p = s.pendingRewards.find((r) => cityById(s, r.cityId)?.owner === s.current);
      if (p) void g.exec({ type: 'reward', city: p.cityId, choice: id === 'rewardA' ? 'a' : 'b' }).then(() => {
        this.rewards.mesh.visible = false;
        const d = this.rewardDone; this.rewardDone = null; d?.();
      });
    }
  }

  showRewards(done: () => void) {
    this.rewardDone = done;
    const s = this.game.state!;
    const p = s.pendingRewards.find((r) => cityById(s, r.cityId)?.owner === s.current);
    if (!p) { this.rewardDone = null; done(); return; }
    const c = cityById(s, p.cityId)!;
    const [a, b] = rewardOptions(c, p.level);
    const P = this.rewards;
    P.begin(t('rewards.title', { city: cityName(s, c.id), level: p.level }));
    P.button('rewardA', t(`rewards.${a}`), 40, 140, P.W / 2 - 60, P.H - 190, { sub: t(`rewards.${a}Desc`) });
    P.button('rewardB', t(`rewards.${b}`), P.W / 2 + 20, 140, P.W / 2 - 60, P.H - 190, { sub: t(`rewards.${b}Desc`), variant: 'secondary' });
    P.end();
    P.mesh.visible = true;
  }

  private beginGrab() {
    const active = this.hands.filter((h) => h.grabbing);
    if (!active.length) { this.grabStart = null; return; }
    const a = active[0].ctrl.position.clone();
    const yaw = new THREE.Euler().setFromQuaternion(active[0].ctrl.quaternion, 'YXZ').y;
    this.grabStart = {
      root: this.root.matrix.clone(), a, scale: this.root.scale.x, yaw: this.root.rotation.y, ctrlYaw: yaw,
      b: active[1]?.ctrl.position.clone(), dist: active[1] ? a.distanceTo(active[1].ctrl.position) : undefined,
    };
    this.grabOrigin = this.root.position.clone();
  }
  private grabOrigin = new THREE.Vector3();

  private updateGrab() {
    const active = this.hands.filter((h) => h.grabbing);
    // Pinch halten und bewegen = greifen (Handtracking) / pinch-hold and move = grab (hand tracking)
    for (const h of this.hands) {
      if (h.selectPos && !h.pinchGrab && !h.grabbing && h.ctrl.position.distanceTo(h.selectPos) > 0.04 && performance.now() - h.selectAt > 150) {
        const ray = this.ray(h);
        if (!ray.intersectObjects(this.panelsList().map((p) => p.mesh), false).length) { h.pinchGrab = true; h.grabbing = true; this.beginGrab(); }
      }
    }
    if (!this.grabStart || !active.length) return;
    const gs = this.grabStart;
    if (active.length >= 2 && gs.dist && gs.b) {
      const d = active[0].ctrl.position.distanceTo(active[1].ctrl.position);
      const s = Math.max(0.3, Math.min(3, gs.scale * (d / gs.dist)));
      this.root.scale.setScalar(s);
    } else {
      const p = active[0].ctrl.position;
      this.root.position.copy(this.grabOrigin).add(p.clone().sub(gs.a));
      const yaw = new THREE.Euler().setFromQuaternion(active[0].ctrl.quaternion, 'YXZ').y;
      this.root.rotation.set(0, gs.yaw + (yaw - gs.ctrlYaw), 0);
    }
  }

  private frame(_now: number, frame?: XRFrame) {
    if (!this.active) return;
    // AR-Hit-Test
    if (this.mode === 'ar' && !this.placed && frame && this.hitSource) {
      const ref = this.view.renderer.xr.getReferenceSpace();
      const results = frame.getHitTestResults(this.hitSource);
      if (results.length && ref) {
        const pose = results[0].getPose(ref);
        if (pose) { this.reticle.visible = true; this.reticle.matrixAutoUpdate = false; this.reticle.matrix.fromArray(pose.transform.matrix); }
      } else this.reticle.visible = false;
    }
    this.updateGrab();
    // Hervorhebung unter dem Zeigestrahl / highlight under the pointer ray
    let hovered = false;
    for (const h of this.hands) {
      if (!h.source) { h.line.visible = false; continue; }
      h.line.visible = true;
      const ray = this.ray(h);
      const ph = ray.intersectObjects(this.panelsList().map((p) => p.mesh), false);
      if (ph.length && ph[0].uv) {
        const panel = ph[0].object.userData.panel as Panel;
        const b = panel.hit(ph[0].uv);
        h.line.scale.z = ph[0].distance;
        if ((b?.id ?? null) !== panel.hover) { panel.hover = b?.id ?? null; this.refreshPanels(); }
        continue;
      }
      h.line.scale.z = 2;
      if (hovered || !this.root.visible) continue;
      const tile = this.view.board.pick(ray);
      if (tile && this.game.state) {
        const p = this.view.board.tileCenter(this.game.state, tile.x, tile.y);
        p.y = Math.max(p.y, -0.09) + 0.03;
        this.hover.position.copy(p).multiplyScalar(this.view.board.group.scale.x).add(this.view.board.group.position);
        this.hover.scale.setScalar(this.view.board.group.scale.x);
        this.hover.visible = true;
        hovered = true;
      }
    }
    if (!hovered) this.hover.visible = false;
    // Aktionsmenue dreht sich zum Spieler / action menu turns to the player
    if (this.actions.mesh.visible) {
      const cam = this.view.renderer.xr.getCamera();
      const wp = this.actions.mesh.getWorldPosition(new THREE.Vector3());
      const yaw = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z) - this.root.rotation.y;
      this.actions.mesh.rotation.set(0, yaw, 0);
    }
    void CLOUD_Y;
  }

  /** Panels neu zeichnen / redraw panels */
  refreshPanels() {
    if (!this.active || !this.game.state) return;
    const s = this.game.state;
    this.drawStatus(s);
    this.drawWrist();
    this.drawActions(s);
    this.drawResearch(s);
  }

  private drawStatus(s: GameState) {
    const P = this.status, f = this.game.viewer >= 0 ? this.game.viewer : s.current;
    const fa = s.factions[f];
    P.begin();
    P.circle(80, P.H / 2, 46, factionTokens[fa.id].primary);
    P.text(t(`factions.${fa.id}.short`), 150, P.H / 2 - 50, 52, semantic.text, 'display');
    P.text(`${t('hud.points')} ${score(s, f)}`, 150, P.H / 2 + 30, 46);
    P.text(`${t('hud.stars')} ${fa.stars} (${t('hud.perRound', { n: income(s, f) })})`, 560, P.H / 2 - 30, 46);
    const limit = s.config.roundLimit;
    P.text(limit ? t('hud.roundOf', { n: s.round, max: limit }) : `${t('hud.round')} ${s.round}`, 560, P.H / 2 + 40, 46);
    const cur = s.factions[s.current];
    if (this.game.aiRunning) P.text(t('hud.aiThinking', { name: t(`factions.${cur.id}.short`) }), P.W - 40, P.H / 2, 40, semantic.textMuted, 'body', 'right');
    P.end();
  }

  private drawWrist() {
    const P = this.wrist;
    P.begin();
    const w = P.W - 70, x = 30;
    P.button('end', t('hud.endTurn'), x, 30, w, 80, { enabled: this.game.isHumanTurn });
    P.button('research', t('hud.research'), x, 125, w, 80, { variant: 'secondary' });
    if (this.mode === 'ar') P.button('replace', t('xr.replace'), x, 220, w, 70, { variant: 'secondary' });
    P.button('exit', t('menu.exitXR'), x, P.H - 110, w, 80, { variant: 'danger' });
    P.end();
  }

  private drawActions(s: GameState) {
    const P = this.actions;
    const sel = this.game.selected;
    const list = this.actionsProvider?.() ?? [];
    if (!sel || !list.length) { P.mesh.visible = false; return; }
    const pos = this.view.board.tileCenter(s, sel.x, sel.y).multiplyScalar(this.view.board.group.scale.x).add(this.view.board.group.position);
    P.mesh.position.copy(pos).add(new THREE.Vector3(0.12, 0.26, 0));
    P.mesh.visible = true;
    P.begin(t('actions.unitActions'));
    const cols = 2, bw = (P.W - 90) / cols, bh = 120;
    list.slice(0, 10).forEach((a, i) => {
      const cx = 30 + (i % cols) * (bw + 20), cy = 120 + Math.floor(i / cols) * (bh + 18);
      P.button(`act-${a.id}`, a.label, cx, cy, bw, bh, { enabled: a.enabled, sub: a.cost !== undefined ? `${a.cost} ${t('hud.stars')}` : undefined, variant: i === 0 ? 'primary' : 'secondary' });
    });
    P.end();
  }

  private drawResearch(s: GameState) {
    const P = this.research;
    P.mesh.visible = this.showResearch;
    if (!this.showResearch) return;
    const f = this.game.viewer >= 0 ? this.game.viewer : s.current;
    P.begin(t('tech.title'));
    const C = { x: P.W / 2, y: P.H / 2 + 30 };
    const R = Math.min(P.W, P.H) / 2 - 140;
    const roots = TECH_IDS.filter((id) => TECHS[id].parent === null);
    const pos = new Map<TechId, { x: number; y: number }>();
    roots.forEach((root, b) => {
      const base = -Math.PI / 2 + (b * 2 * Math.PI) / roots.length;
      pos.set(root, { x: C.x + Math.cos(base) * R * 0.36, y: C.y + Math.sin(base) * R * 0.36 });
      TECH_IDS.filter((id) => TECHS[id].parent === root).forEach((kid, k) => {
        const a = base + (k ? 0.27 : -0.27);
        pos.set(kid, { x: C.x + Math.cos(a) * R * 0.68, y: C.y + Math.sin(a) * R * 0.68 });
        const g = TECH_IDS.find((id) => TECHS[id].parent === kid);
        if (g) pos.set(g, { x: C.x + Math.cos(a) * R, y: C.y + Math.sin(a) * R });
      });
    });
    const col: Record<string, string> = { researched: components.techNode.researched, available: components.techNode.available, locked: components.techNode.locked, expensive: components.techNode.expensive };
    for (const id of TECH_IDS) {
      const p = pos.get(id)!, par = TECHS[id].parent ? pos.get(TECHS[id].parent!)! : C;
      P.line(par.x, par.y, p.x, p.y, semantic.ink, 6);
    }
    for (const id of TECH_IDS) {
      const p = pos.get(id)!;
      const st = techState(s, f, id);
      P.circle(p.x, p.y, 44, col[st]);
      P.text(String(researchCost(s, f, id)), p.x, p.y + 2, 34, semantic.text, 'display', 'center');
      P.text(t(`techs.${id}`), p.x, p.y + 66, 26, semantic.text, 'body', 'center', 220);
      P.buttons.push({ id: `tech-${id}`, x: p.x - 50, y: p.y - 50, w: 100, h: 100, enabled: true });
    }
    if (this.selectedTech) {
      const st = techState(s, f, this.selectedTech);
      P.text(`${t(`techs.${this.selectedTech}`)}: ${t(`tech.${st}`)}`, 40, P.H - 70, 40);
      P.button('doResearch', t('tech.research', { cost: researchCost(s, f, this.selectedTech) }), P.W - 560, P.H - 130, 330, 100, { enabled: st === 'available' && this.game.isHumanTurn });
    }
    P.button('closeResearch', t('actions.close'), P.W - 210, 30, 170, 90, { variant: 'secondary' });
    P.end();
  }
}
