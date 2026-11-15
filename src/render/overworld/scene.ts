/**
 * Eigener, leichter Renderer der Oberwelt auf einem eigenen Canvas im Kampagnenbildschirm (das Brett rendert dort
 * nicht). Drei schwebende Scheibenwelten in einem flachen Bogen vor dem Sternenhimmel, Riss und Portalweg dazwischen.
 * Own lightweight overworld renderer on its own canvas inside the campaign screen (the board does not render there).
 * Three floating disc worlds in a gentle arc in front of the starry sky, rift and portal path in between.
 *
 * Bedienung / controls:
 * - Maus: Ziehen dreht die gewaehlte Welt um ihre Achse, Mausrad zoomt (bis zur Uebersicht aller Welten).
 *   Mouse: drag turns the selected world around its axis, the wheel zooms (up to the overview of all worlds).
 * - Touch: waagrecht wischen wechselt die Welt mit Einrasten; senkrecht scrollt die Seite weiter (touch-action: pan-y).
 *   Touch: horizontal swipe switches worlds with snapping; vertical scrolling still scrolls the page (touch-action: pan-y).
 * - Tippen/Klicken auf einen Marker meldet onPick, auf eine andere Welt holt diese in den Fokus.
 *   Tap/click on a marker reports onPick, on another world brings it into focus.
 *
 * Ohne Animationen wird nur bei Bedarf gezeichnet (keine Leerlauf-Schleife, Kamera springt). Pixelverhaeltnis begrenzt,
 * Bloom nur bei hoher Qualitaet und nicht auf Touch-Geraeten. dispose() gibt alles frei.
 * Without animations frames are drawn on demand only (no idle loop, the camera jumps). Pixel ratio capped, bloom only on
 * high quality and not on touch devices. dispose() releases everything.
 */
import * as THREE from 'three';
import { hex, semantic } from '../../design/tokens';
import type { WorldId } from '../../core/worlds';
import type { WorldInfo } from '../../ui/overworldState';
import { Bloom } from '../post';
import { buildAlien } from './alien';
import { buildEarth } from './earth';
import { buildForgotten } from './forgotten';
import { dotArc, halo } from './fx';
import { Look, disposeTree, type Clock } from './kit';
import { worldPositions } from './layout';
import { buildMarkers, type MarkerSet } from './markers';
import { nebulae, rift, spaceBackground, starField } from './space';
import type { WorldBuild, WorldCtx } from './types';

/** Radius einer Scheibe / disc radius */
export const DISC_R = 1.6;
/** Dauer einer Enthuellung (ms) / duration of a reveal (ms) */
const REVEAL_MS = 3200;
const BUILDERS: Record<WorldId, (c: WorldCtx) => WorldBuild> = { earth: buildEarth, alien: buildAlien, forgotten: buildForgotten };
const FOV = 34;
const ZOOM_MIN = -0.45;

export interface LabelPos { id: WorldId; x: number; y: number; visible: boolean }

export interface OverworldSceneOptions {
  canvas: HTMLCanvasElement;
  quality: 'low' | 'high';
  animations: boolean;
  /** grober Zeiger (Handy, Tablet) / coarse pointer (phone, tablet) */
  touch: boolean;
  /** nur die sichtbaren Welten, in Reihenfolge / only the visible worlds, in order */
  worlds: readonly WorldInfo[];
  focus: WorldId;
  /** Welten, die zum ersten Mal erscheinen (Animation) / worlds appearing for the first time (animation) */
  reveal?: readonly WorldId[];
  onPick(id: string): void;
  onFocus(id: WorldId): void;
  onHover?(id: string | null, x: number, y: number): void;
  onLabels?(labels: LabelPos[]): void;
}

interface WorldNode { id: WorldId; info: WorldInfo; build: WorldBuild; root: THREE.Group; markers: MarkerSet | null }

/**
 * triangles/calls: letztes Bild (mit Bloom-Durchgaengen); total/perWorld: alle Dreiecke der Szene (Instanzen mitgezaehlt).
 * triangles/calls: last frame (incl. bloom passes); total/perWorld: all triangles of the scene (instances counted).
 */
export interface OverworldStats { triangles: number; calls: number; geometries: number; textures: number; programs: number; objects: number; total: number; perWorld: Record<string, number>; buildMs: number }

/** Dreiecke unter einem Knoten (Instanzen mitgezaehlt) / triangles below a node (instances counted) */
function sceneTriangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry;
    const tris = (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) / 3;
    n += tris * ((o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1);
  });
  return Math.round(n);
}

export class OverworldScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 140);
  private clock: Clock = { uTime: { value: 0 } };
  private look: Look;
  private nodes: WorldNode[] = [];
  private bloom: Bloom | null = null;
  private riftNode: THREE.Group | null = null;
  private extraTextures: THREE.Texture[] = [];
  private animations: boolean;
  private focusIdx = 0;
  private offset = 0;
  private offsetGoal = 0;
  private zoom = 0;
  private zoomGoal = 0;
  private spinVel = 0;
  private raf = 0;
  private last = 0;
  private visible = true;
  private disposed = false;
  private narrow = false;
  private off: (() => void)[] = [];
  private drag: { id: number; type: string; x: number; y: number; lastX: number; t: number; mode: 'none' | 'swipe' | 'spin' | 'scroll'; moved: number } | null = null;
  private hoverId: string | null = null;
  private ray = new THREE.Raycaster();
  private tmp = new THREE.Vector3();
  /** Lage der sichtbaren Welten (1, 2 oder 3) / position of the visible worlds (1, 2 or 3) */
  private layout: Record<string, THREE.Vector3> = {};
  /** laufende Enthuellung / running reveal */
  private revealing: { node: WorldNode; from: THREE.Vector3; start: number; delay: number; arcs: THREE.InstancedMesh[]; gate: THREE.Object3D | null; flash: THREE.Sprite }[] = [];
  private arcs = new Map<WorldId, THREE.InstancedMesh[]>();
  private gates = new Map<WorldId, THREE.Object3D>();

  private held: number | null = null;
  private buildMs = 0;

  constructor(private opts: OverworldSceneOptions) {
    const built = performance.now();
    const { canvas, quality, touch } = opts;
    this.animations = opts.animations;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? (touch ? 1.5 : 2) : 1));
    this.look = new Look(this.clock);
    const low = quality === 'low' || touch;
    // --- Hintergrund, Licht / background, light ---
    const bg = spaceBackground();
    this.extraTextures.push(bg);
    this.scene.background = bg;
    this.scene.add(starField(low ? 700 : 1600, 5), nebulae(9, low ? 3 : 6));
    const hemi = new THREE.HemisphereLight(hex(semantic.white), hex(semantic.overworldSpaceGlow), 1.35);
    const sun = new THREE.DirectionalLight(hex(semantic.white), 1.9);
    sun.position.set(-4, 7, 6);
    this.scene.add(hemi, sun);
    // --- Welten (nur sichtbare) / worlds (visible only) ---
    const pos = worldPositions(opts.worlds.map((w) => w.id));
    opts.worlds.forEach((info) => {
      this.layout[info.id] = new THREE.Vector3(pos[info.id].x, pos[info.id].y, pos[info.id].z);
      const build = BUILDERS[info.id]({ look: this.look, clock: this.clock, low, R: DISC_R, ids: info.markers.map((m) => m.id) });
      const root = new THREE.Group();
      root.position.copy(this.layout[info.id]);
      root.add(build.spin);
      if (build.fixed) root.add(build.fixed);
      const markers = buildMarkers(this.look, info.markers, build.spots, build.disc.heightAt, { scale: touch ? 1.3 : 1, world: info.id });
      build.spin.add(markers.group);
      // leicht schraeg wie auf einer Umlaufbahn / slightly tilted as if on an orbit
      root.rotation.z = opts.worlds.length > 1 ? (info.id === 'earth' ? 0.04 : info.id === 'forgotten' ? -0.04 : 0) : 0;
      this.scene.add(root);
      this.nodes.push({ id: info.id, info, build, root, markers });
    });
    this.links();
    // --- Kamera / camera ---
    const fi = Math.max(0, this.nodes.findIndex((n) => n.id === opts.focus));
    this.focusIdx = fi; this.offset = fi; this.offsetGoal = fi;
    this.renderer.info.autoReset = false;
    if (quality === 'high' && !touch) {
      try { this.bloom = new Bloom(this.renderer, this.scene, this.camera); this.bloom.strength = 0.4; } catch { this.bloom = null; }
    }
    this.buildMs = Math.round(performance.now() - built);
    this.bind();
    this.resize();
    if (opts.reveal?.length && this.animations) {
      // Uebersicht waehrend der Enthuellung (auf dem Handy die neue Welt) / overview during the reveal (on phones the new world)
      if (this.narrow) { const i = this.nodes.findIndex((n) => n.id === opts.reveal![0]); if (i >= 0) { this.focusIdx = i; this.offset = this.offsetGoal = i; } }
      else this.zoomGoal = this.zoom = 1;
      this.startReveal(opts.reveal);
    }
    // Schrift der Abzeichen nachladen / reload the badge font
    void document.fonts?.ready.then(() => { if (this.disposed) return; this.nodes.forEach((n) => n.markers?.redraw()); this.invalidate(); });
  }

  // ---------- Aufbau / building ----------

  /**
   * Portalweg Erde -> Alienwelt (mit Welt 2) und der Riss zur Welt der Vergessenen (mit Welt 3).
   * Portal path Earth -> alien world (with world 2) and the rift to the world of the Forgotten (with world 3).
   */
  private links() {
    const e = this.layout.earth, a = this.layout.alien, f = this.layout.forgotten;
    if (e && a) {
      const arc = dotArc(this.look, new THREE.Vector3(e.x + DISC_R * 0.95, e.y + 0.05, e.z), new THREE.Vector3(a.x - DISC_R * 0.95, a.y + 0.05, a.z), { lift: 1.1, material: this.look.glow(semantic.overworldPath, 1.3), size: 0.034 });
      this.scene.add(arc);
      this.arcs.set('alien', [arc]);
    }
    if (a && f) {
      const r = rift(this.clock, 1);
      r.position.set((a.x + f.x) / 2, 0.55, (a.z + f.z) / 2 - 0.25);
      this.scene.add(r);
      this.riftNode = r;
      this.gates.set('forgotten', r);
      const m = this.look.glow(semantic.riftGold, 1.9);
      const arcs = [
        dotArc(this.look, new THREE.Vector3(a.x + DISC_R * 0.95, a.y + 0.05, a.z), r.position.clone(), { lift: 0.5, material: m, size: 0.035 }),
        dotArc(this.look, r.position.clone(), new THREE.Vector3(f.x - DISC_R * 0.95, f.y + 0.05, f.z), { lift: 0.3, material: m, size: 0.035 }),
      ];
      this.scene.add(...arcs);
      this.arcs.set('forgotten', arcs);
    }
  }

  /**
   * Erstes Erscheinen einer Welt: Sie kommt klein aus dem Portal (Welt 2) bzw. aus dem Riss (Welt 3), waechst und
   * dreht sich an ihren Platz; der Punktbogen zeichnet sich mit. Nur mit Animationen.
   * First appearance of a world: it comes out small from the portal (world 2) or the rift (world 3), grows and spins
   * into place; the dotted arc draws along. Animations only.
   */
  private startReveal(ids: readonly WorldId[]) {
    if (!this.animations) return;
    // Zeitachse beginnt mit dem ersten gezeichneten Bild (Shader-Aufbau kann dauern) / timeline starts with the first drawn frame (shader setup can take a while)
    let delay = 300;
    for (const id of ids) {
      const node = this.nodes.find((n) => n.id === id);
      if (!node) continue;
      const i = this.nodes.indexOf(node);
      const prev = this.nodes[i - 1];
      const gate = this.gates.get(id) ?? null;
      const from = gate ? gate.position.clone() : prev ? prev.root.position.clone().add(new THREE.Vector3(DISC_R * 0.95, 0.3, 0)) : node.root.position.clone();
      const flash = halo(id === 'forgotten' ? semantic.riftGold : semantic.overworldPath, 1.6, 0);
      flash.position.copy(from);
      this.scene.add(flash);
      this.revealing.push({ node, from, start: NaN, delay, arcs: this.arcs.get(id) ?? [], gate, flash });
      delay += REVEAL_MS;
    }
    this.applyReveal(0);
  }

  /** Enthuellung fortschreiben; true solange sie laeuft / advance the reveal; true while running */
  private applyReveal(now: number): boolean {
    if (!this.revealing.length) return false;
    for (const r of this.revealing) {
      if (Number.isNaN(r.start) && now > 0) r.start = now + r.delay;
      const p = this.held !== null && this.revealing.length ? this.held : Number.isNaN(r.start) ? 0 : Math.max(0, Math.min(1, (now - r.start) / REVEAL_MS));
      const gateIn = Math.min(1, p / 0.3);
      if (r.gate) r.gate.scale.setScalar(Math.max(0.001, gateIn));
      const w = Math.max(0, Math.min(1, (p - 0.2) / 0.8));
      const e = 1 - Math.pow(1 - w, 3);
      const target = this.layout[r.node.id];
      r.node.root.position.lerpVectors(r.from, target, e);
      r.node.root.scale.setScalar(Math.max(0.001, e * (1 + Math.sin(w * Math.PI) * 0.08)));
      r.node.build.spin.rotation.y = (1 - e) * 5;
      r.node.root.visible = p > 0.15;
      for (const a of r.arcs) a.count = Math.round(a.instanceMatrix.count * Math.min(1, p / 0.45));
      (r.flash.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.sin(Math.min(1, p / 0.5) * Math.PI)) * 0.9;
      r.flash.scale.setScalar(0.8 + p * 2.5);
    }
    const done = this.held !== null ? [] : this.revealing.filter((r) => !Number.isNaN(r.start) && now - r.start >= REVEAL_MS);
    for (const r of done) {
      r.flash.removeFromParent();
      disposeTree(r.flash);
      r.node.root.position.copy(this.layout[r.node.id]);
      r.node.root.scale.setScalar(1);
      r.node.root.visible = true;
      // danach die neue Welt in den Fokus / then focus the new world
      this.focus(r.node.id);
    }
    this.revealing = this.revealing.filter((r) => !done.includes(r));
    return true;
  }

  // ---------- Kamera / camera ----------

  private size() {
    const c = this.opts.canvas;
    return { w: Math.max(1, c.clientWidth), h: Math.max(1, c.clientHeight) };
  }

  /** Abstaende fuer Fokus und Uebersicht aus dem Seitenverhaeltnis / distances for focus and overview from the aspect */
  private distances() {
    const { w, h } = this.size();
    const aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    // schmal: eine Welt je Bildschirm; breit: Nachbarn schauen am Rand herein / narrow: one world per screen; wide: neighbours peek in
    const halfW = this.narrow ? DISC_R * 1.22 : DISC_R * 1.85;
    const focus = Math.max(halfW / (tan * aspect), 1.75 / tan);
    const span = Math.max(0, ...Object.values(this.layout).map((p) => Math.abs(p.x))) + DISC_R * 1.3;
    const over = Math.max(focus * 1.2, Math.max(span / (tan * aspect), 2.3 / tan) * 1.14);
    return { focus, over };
  }

  private updateCamera() {
    const { focus, over } = this.distances();
    const z = this.zoom;
    const dist = z < 0 ? focus * (1 + z * 0.75) : focus + (over - focus) * z;
    // stueckweise zwischen den Welten, an den Enden etwas darueber hinaus / piecewise between worlds, a bit beyond at the ends
    const n = this.nodes.length;
    const i0 = Math.max(0, Math.min(n - 2, Math.floor(this.offset)));
    const a = this.layout[this.nodes[i0].id], b = this.layout[this.nodes[Math.min(n - 1, i0 + 1)].id];
    const target = this.tmp.copy(a);
    if (n > 1) target.lerp(b, this.offset - i0);
    const centre = new THREE.Vector3(0, 0.05, 0.2);
    const ov = Math.max(0, z);
    target.lerp(centre, ov);
    target.y -= 0.42 * (1 - ov) + 0.2 * ov;
    const el = THREE.MathUtils.degToRad(27 - ov * 8);
    this.camera.position.set(target.x, target.y + Math.sin(el) * dist, target.z + Math.cos(el) * dist);
    this.camera.lookAt(target);
  }

  /** Welt in den Fokus holen / bring a world into focus */
  focus(id: WorldId | number, opts: { report?: boolean } = {}) {
    const i = typeof id === 'number' ? id : this.nodes.findIndex((n) => n.id === id);
    if (i < 0 || i >= this.nodes.length) return;
    const changed = i !== this.focusIdx;
    this.focusIdx = i;
    this.offsetGoal = i;
    if (this.zoomGoal > 0.35) this.zoomGoal = 0;
    if (!this.animations) { this.offset = i; this.zoom = this.zoomGoal; }
    if (changed && opts.report !== false) this.opts.onFocus(this.nodes[i].id);
    this.invalidate();
  }

  step(dir: 1 | -1) { this.focus(Math.max(0, Math.min(this.nodes.length - 1, this.focusIdx + dir))); }

  get focused(): WorldId { return this.nodes[this.focusIdx].id; }

  /** Zoom: positiv weiter weg (1 = Uebersicht), negativ naeher / zoom: positive further away (1 = overview), negative closer */
  zoomBy(d: number): boolean {
    const max = this.narrow ? 0 : 1;
    const next = Math.max(ZOOM_MIN, Math.min(max, this.zoomGoal + d));
    if (next === this.zoomGoal) return false;
    this.zoomGoal = next;
    if (!this.animations) this.zoom = next;
    this.invalidate();
    return true;
  }

  overview() { this.zoomBy(1 - this.zoomGoal); }

  // ---------- Eingabe / input ----------

  private listen<K extends keyof HTMLElementEventMap>(el: HTMLElement | Window | Document, type: K | string, fn: (e: never) => void, o?: AddEventListenerOptions) {
    el.addEventListener(type, fn as EventListener, o);
    this.off.push(() => el.removeEventListener(type, fn as EventListener, o));
  }

  private bind() {
    const c = this.opts.canvas;
    this.listen(c, 'pointerdown', (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.drag = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, lastX: e.clientX, t: performance.now(), mode: 'none', moved: 0 };
      this.spinVel = 0;
    });
    this.listen(c, 'pointermove', (e: PointerEvent) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) { if (e.pointerType === 'mouse') this.hover(e); return; }
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.moved = Math.max(d.moved, Math.hypot(dx, dy));
      if (d.mode === 'none' && d.moved > 7) {
        if (d.type === 'mouse') d.mode = 'spin';
        else d.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll';
        if (d.mode !== 'scroll') try { c.setPointerCapture(e.pointerId); } catch { /* egal / ignore */ }
      }
      if (d.mode === 'spin') {
        const step = (e.clientX - d.lastX) * 0.008;
        this.nodes[this.focusIdx].build.spin.rotation.y += step;
        this.spinVel = step;
        this.invalidate();
      } else if (d.mode === 'swipe') {
        const { w } = this.size();
        this.offset = this.offsetGoal = Math.max(-0.35, Math.min(this.nodes.length - 0.65, this.focusIdx - dx / w));
        this.invalidate();
      }
      d.lastX = e.clientX;
    });
    const end = (e: PointerEvent, cancel: boolean) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (d.mode === 'swipe') {
        const { w } = this.size();
        const dx = e.clientX - d.x;
        const v = dx / Math.max(1, performance.now() - d.t);
        const dir = cancel ? 0 : dx < -w * 0.18 || v < -0.5 ? 1 : dx > w * 0.18 || v > 0.5 ? -1 : 0;
        const next = Math.max(0, Math.min(this.nodes.length - 1, this.focusIdx + dir));
        this.focus(next);
        this.offsetGoal = next;
        if (!this.animations) this.offset = next;
        this.invalidate();
        return;
      }
      if (!cancel && d.mode === 'none') this.tap(e);
      if (d.mode === 'spin' && this.animations) this.invalidate();
    };
    this.listen(c, 'pointerup', (e: PointerEvent) => end(e, false));
    this.listen(c, 'pointercancel', (e: PointerEvent) => end(e, true));
    this.listen(c, 'pointerleave', () => { if (this.hoverId) { this.hoverId = null; c.style.cursor = ''; this.opts.onHover?.(null, 0, 0); } });
    this.listen(c, 'wheel', (e: WheelEvent) => {
      if (this.narrow) return;
      // an der Grenze darf die Seite weiter scrollen / at the bound the page may keep scrolling
      if (this.zoomBy(Math.sign(e.deltaY) * Math.min(0.25, Math.abs(e.deltaY) * 0.0016))) e.preventDefault();
    }, { passive: false });
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(c);
    this.off.push(() => ro.disconnect());
    const io = new IntersectionObserver((list) => { this.visible = list.some((x) => x.isIntersecting); if (this.visible) this.invalidate(); });
    io.observe(c);
    this.off.push(() => io.disconnect());
    this.listen(document, 'visibilitychange', () => { if (!document.hidden) this.invalidate(); });
    this.listen(c, 'webglcontextlost', (e: Event) => e.preventDefault());
  }

  private pickAt(clientX: number, clientY: number): { marker?: string; world?: number } {
    const r = this.opts.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hits = this.nodes.flatMap((n) => n.markers?.hits ?? []);
    const hit = this.ray.intersectObjects(hits, false)[0];
    if (hit) return { marker: hit.object.userData.missionId as string };
    // sonst die naechste getroffene Welt (Kugel um die Scheibe) / otherwise the nearest world hit (sphere around the disc)
    let best = -1, bestD = Infinity;
    this.nodes.forEach((n, i) => {
      const s = new THREE.Sphere(n.root.position.clone().add(new THREE.Vector3(0, -0.3, 0)), DISC_R * 1.15);
      const p = this.ray.ray.intersectSphere(s, new THREE.Vector3());
      if (p) { const d = p.distanceTo(this.camera.position); if (d < bestD) { bestD = d; best = i; } }
    });
    return best >= 0 ? { world: best } : {};
  }

  private nodeOfMarker(id: string) { return this.nodes.findIndex((n) => n.info.markers.some((m) => m.id === id)); }

  private tap(e: PointerEvent) {
    const p = this.pickAt(e.clientX, e.clientY);
    if (p.marker) {
      const i = this.nodeOfMarker(p.marker);
      // Marker einer anderen Welt: erst dorthin / marker of another world: go there first
      if (i !== this.focusIdx || this.zoomGoal > 0.35) { this.focus(i); this.zoomGoal = 0; if (!this.animations) this.zoom = 0; this.invalidate(); return; }
      this.opts.onPick(p.marker);
      return;
    }
    if (p.world !== undefined && (p.world !== this.focusIdx || this.zoomGoal > 0.35)) {
      this.focus(p.world);
      this.zoomGoal = 0;
      if (!this.animations) this.zoom = 0;
      this.invalidate();
    }
  }

  private hover(e: PointerEvent) {
    const p = this.pickAt(e.clientX, e.clientY);
    const id = p.marker ?? null;
    this.opts.canvas.style.cursor = id || (p.world !== undefined && p.world !== this.focusIdx) ? 'pointer' : 'grab';
    if (id === this.hoverId) return;
    this.hoverId = id;
    const r = this.opts.canvas.getBoundingClientRect();
    this.opts.onHover?.(id, e.clientX - r.left, e.clientY - r.top);
  }

  // ---------- Zeichnen / drawing ----------

  resize() {
    if (this.disposed) return;
    const { w, h } = this.size();
    this.narrow = w / h < 1.15;
    if (this.narrow) this.zoomGoal = this.zoom = Math.min(0, this.zoom);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.bloom?.resize();
    this.invalidate();
  }

  invalidate() {
    if (this.disposed || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    let busy = this.applyReveal(now);
    this.renderer.info.reset();
    if (this.animations) {
      const k = 1 - Math.exp(-dt * 6);
      this.offset += (this.offsetGoal - this.offset) * k;
      this.zoom += (this.zoomGoal - this.zoom) * k;
      if (Math.abs(this.offsetGoal - this.offset) < 1e-3) this.offset = this.offsetGoal;
      if (Math.abs(this.zoomGoal - this.zoom) < 1e-3) this.zoom = this.zoomGoal;
      // Schwung nach dem Drehen / momentum after turning
      if (!this.drag && Math.abs(this.spinVel) > 1e-4) { this.nodes[this.focusIdx].build.spin.rotation.y += this.spinVel; this.spinVel *= 0.93; }
      const t = now / 1000;
      this.clock.uTime.value = t;
      for (const n of this.nodes) {
        n.build.update(t);
        n.markers?.update(t);
        // sanftes Schweben / gentle floating
        if (!this.revealing.some((r) => r.node === n)) n.root.position.y = this.layout[n.id].y + Math.sin(t * 0.5 + n.root.position.x) * 0.05;
      }
      busy = true;
    } else {
      this.offset = this.offsetGoal;
      this.zoom = this.zoomGoal;
    }
    this.updateCamera();
    this.riftNode?.lookAt(this.camera.position);
    if (this.bloom) this.bloom.render(this.camera);
    else this.renderer.render(this.scene, this.camera);
    this.labels();
    if (busy && this.visible && !document.hidden) this.invalidate();
  };

  /** Bildschirmlage der Weltnamen (unter jeder Scheibe) / screen position of the world names (below each disc) */
  private labels() {
    if (!this.opts.onLabels) return;
    const { w, h } = this.size();
    this.opts.onLabels(this.nodes.map((n) => {
      const p = n.root.position.clone().add(new THREE.Vector3(0, -1.9, 0.4)).project(this.camera);
      return { id: n.id, x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, visible: p.z < 1 && p.x > -1.1 && p.x < 1.1 };
    }));
  }

  /** Bildschirmlage eines Markers (fuer Hinweise) / screen position of a marker */
  markerScreen(id: string): { x: number; y: number } | null {
    const n = this.nodes.find((x) => x.info.markers.some((m) => m.id === id));
    const a = n?.markers?.anchor(id);
    if (!a) return null;
    const p = a.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const { w, h } = this.size();
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
  }

  /** Zaehler fuer Leistung und Speicher (nach dem letzten Bild) / counters for performance and memory (after the last frame) */
  stats(): OverworldStats {
    let objects = 0;
    this.scene.traverse(() => { objects++; });
    const i = this.renderer.info;
    const perWorld: Record<string, number> = {};
    for (const n of this.nodes) perWorld[n.id] = sceneTriangles(n.root);
    return { triangles: i.render.triangles, calls: i.render.calls, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0, objects, total: sceneTriangles(this.scene), perWorld, buildMs: this.buildMs };
  }

  /** Nur fuer Tests und Standbilder: Enthuellung bei festem Fortschritt 0..1 anhalten / tests and stills only: hold the reveal at a fixed progress */
  holdReveal(p: number | null) {
    this.held = p;
    this.invalidate();
  }

  /** Alles freigeben / release everything */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const f of this.off) f();
    this.off = [];
    disposeTree(this.scene, { textures: this.extraTextures });
    this.scene.clear();
    this.scene.background = null;
    this.look.dispose();
    this.bloom?.dispose();
    this.bloom = null;
    this.nodes = [];
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
