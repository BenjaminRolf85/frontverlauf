/**
 * Vorschlag A: Vergleichsseite (preview/proto-a.html). Links das heutige Modell, rechts der Vorschlag - gleiche Lichter,
 * gleiche Kamera, gleiches Einheitenmaterial und dieselbe Tuschelinie wie im Spiel. Ziehen dreht, Rad oder Zwei-Finger-
 * Geste zoomt. URL: ?unit=soldier|tank &view=close|face|board &q=full|phone &ui=0 (ohne Leisten) &ink=<Breite>.
 * Proposal A: comparison page (preview/proto-a.html). Today's model on the left, the proposal on the right - the same
 * lights, the same camera, the same unit material and the same ink line as in the game. Drag orbits, wheel or pinch
 * zooms. URL: ?unit=soldier|tank &view=close|face|board &q=full|phone &ui=0 (no bars) &ink=<width>.
 */
import '@fontsource/bangers';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { factionTokens, hex, semantic } from '../../../../design/tokens';
import { CAMERA, OUTLINE, SUN } from '../../../config';
import { outlineMaterial, outlined, unitMaterial } from '../../../toon';
import { splitTurrets, unitGeometry } from '../../index';
import { inkHull } from './assemble';
import { withDensity } from './mesh';
import { protoInfantry } from './soldier';
import { protoTank } from './tank';

type Unit = 'soldier' | 'tank';
type View = 'close' | 'face' | 'board';
type Quality = 'full' | 'phone';
const FACTION = 'korvat' as const;
/** Massstab der Einheiten auf dem Brett (board.ts) / unit scale on the board (board.ts) */
const UNIT_SCALE = 1.25;
/** Tuschelinie in den Nahansichten (Brett: OUTLINE.unit wie im Spiel) / ink line in the close views (board: OUTLINE.unit as in the game) */
const CLOSE_INK = 0.006;
/** Netzdichte der Handy-Stufe / mesh density of the phone level */
const PHONE_DENSITY = 0.5;

const params = new URLSearchParams(location.search);
const state = {
  unit: (params.get('unit') ?? 'soldier') as Unit,
  view: (params.get('view') ?? 'close') as View,
  q: (params.get('q') ?? 'full') as Quality,
};
if (params.get('ui') === '0') document.body.classList.add('bare');
if (params.get('solo')) document.getElementById('split')!.style.display = 'none';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Number(params.get('dpr') ?? window.devicePixelRatio));
renderer.autoClear = false;
renderer.setClearColor(hex(semantic.worldBackground), 1);

/** Lichter wie am Tag im Spiel (sky.ts, Voreinstellung day) / lights as by day in the game (sky.ts, preset day) */
function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(hex(semantic.skyDay), hex(semantic.terrainPlainSide), 0.95));
  const sun = new THREE.DirectionalLight(hex(semantic.sunDay), 2.85);
  sun.position.set(SUN.x, SUN.y, SUN.z);
  scene.add(sun);
}

interface Built { geometry: THREE.BufferGeometry; ms: number }
const timed = (fn: () => THREE.BufferGeometry): Built => {
  const t0 = performance.now();
  const geometry = fn();
  return { geometry, ms: performance.now() - t0 };
};

/** Heutiges Modell, gezeichnet wie auf dem Brett (unitModel in board.ts) / today's model, drawn as on the board (unitModel in board.ts) */
function currentModel(g: THREE.BufferGeometry, ink: number): THREE.Group {
  const split = splitTurrets(g);
  if (!split) return outlined(g, ink, unitMaterial());
  const model = outlined(split.hull, ink, unitMaterial());
  for (const t of split.turrets) {
    const tur = outlined(t.geometry, ink, unitMaterial());
    tur.position.copy(t.pivot);
    tur.rotation.y = t.yaw;
    tur.name = 'turret';
    model.add(tur);
  }
  return model;
}
/** Vorschlag: gleiches Material; die Huelle der Tuschelinie beruecksichtigt die Tuschestaerke / proposal: same material; the ink hull honours the ink weight */
function protoModel(g: THREE.BufferGeometry, ink: number): THREE.Group {
  const part = (pg: THREE.BufferGeometry) => {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(pg, unitMaterial()), new THREE.Mesh(inkHull(pg), outlineMaterial(ink)));
    return grp;
  };
  const split = splitTurrets(g);
  if (!split) return part(g);
  const model = part(split.hull);
  for (const t of split.turrets) {
    const tur = part(t.geometry);
    tur.position.copy(t.pivot);
    tur.rotation.y = t.yaw;
    tur.name = 'turret';
    model.add(tur);
  }
  return model;
}

const bytesOf = (g: THREE.BufferGeometry) => Object.values(g.attributes).reduce((n, a) => n + (a.array as Float32Array).byteLength, 0);
const trisOf = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;

interface Entry { old: Built; neu: Built; phone: Built }
const cache = new Map<Unit, Entry>();
function entry(u: Unit): Entry {
  let e = cache.get(u);
  if (!e) {
    const old = timed(() => unitGeometry(u === 'soldier' ? 'infantry' : 'tank', FACTION, null));
    const make = u === 'soldier' ? protoInfantry : protoTank;
    e = { old, neu: timed(() => make(FACTION)), phone: timed(() => withDensity(PHONE_DENSITY, () => make(FACTION))) };
    cache.set(u, e);
  }
  return e;
}

const scenes = [new THREE.Scene(), new THREE.Scene()];
scenes.forEach(lights);
const roots = scenes.map((s) => { const g = new THREE.Group(); s.add(g); return g; });
const persp = new THREE.PerspectiveCamera(20, 1, 0.05, 100);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
let camera: THREE.Camera = persp;
let controls = new OrbitControls(camera, canvas);

/** Blickpunkt je Modell als Anteil der Hoehe (Kopf sitzt unterschiedlich hoch) / focus per model as a share of its height (the head sits at different heights) */
const FOCUS: Record<Unit, Record<'close' | 'face', [number, number]>> = {
  soldier: { close: [0.5, 0.5], face: [0.8, 0.865] },
  tank: { close: [0.5, 0.5], face: [0.72, 0.72] },
};

function ground(tile: boolean): THREE.Mesh {
  const mat = new THREE.MeshToonMaterial({ color: hex(tile ? factionTokens[FACTION].terrain : semantic.terrainPlain) });
  const g = tile ? new THREE.BoxGeometry(0.98, 0.06, 0.98) : new THREE.CylinderGeometry(0.62, 0.62, 0.04, 48);
  const m = new THREE.Mesh(g, mat);
  m.position.y = tile ? -0.03 : -0.02;
  return m;
}

const drawCalls = [0, 0];
const inkWidth = () => Number(params.get('ink') ?? (state.view === 'board' ? OUTLINE.unit : CLOSE_INK));
function rebuild(): void {
  const ink = inkWidth();
  roots.forEach((r) => r.clear());
  const units: Unit[] = state.view === 'board' ? ['soldier', 'tank'] : [state.unit];
  units.forEach((u, k) => {
    const e = entry(u);
    const neu = state.q === 'phone' ? e.phone : e.neu;
    [currentModel(e.old.geometry, ink), protoModel(neu.geometry, ink)].forEach((model, side) => {
      const slot = new THREE.Group();
      const g = side === 0 ? e.old.geometry : neu.geometry;
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      if (state.view === 'board') {
        model.scale.setScalar(UNIT_SCALE);
        slot.position.set(k === 0 ? -0.52 : 0.52, 0, k === 0 ? 0.52 : -0.52);
        slot.add(ground(true));
      } else {
        // beide Modelle im gleichen Massstab; der Blickpunkt liegt im Ursprung / both models at the same scale; the focus sits at the origin
        const fy = FOCUS[u][state.view][side] * bb.max.y;
        // Nahansicht: Mitte des Modells in die Bildmitte (das Gewehr ragt unterschiedlich weit) / close view: model centre to the picture centre (the rifle reaches out differently)
        const mid = state.view === 'close';
        slot.position.set(mid ? -(bb.min.x + bb.max.x) / 2 : 0, -fy, mid ? -(bb.min.z + bb.max.z) / 2 : 0);
        if (state.view === 'close') slot.add(ground(false));
      }
      slot.add(model);
      roots[side].add(slot);
    });
  });
  frame();
  ui();
  render();
}

function frame(): void {
  controls.dispose();
  const e = entry(state.unit);
  if (state.view === 'board') {
    camera = ortho;
    const d = new THREE.Vector3(1, Math.tan(CAMERA.elevation) * Math.SQRT2, 1).normalize();
    ortho.position.copy(d.multiplyScalar(CAMERA.distance));
    ortho.lookAt(0, 0.2, 0);
    controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0.2, 0);
  } else {
    camera = persp;
    e.neu.geometry.computeBoundingBox();
    const bb = e.neu.geometry.boundingBox!;
    const H = bb.max.y, W = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    // Bildhoehe: Figur fuellt rund 80 % / frame height: the figure fills about 80 %
    const span = state.view === 'face' ? (state.unit === 'soldier' ? 0.25 : 0.42) : state.unit === 'soldier' ? H / 0.8 : Math.max(H / 0.5, W / 1.12);
    const dist = span / 2 / Math.tan((persp.fov * Math.PI) / 360);
    const dir = state.unit === 'soldier'
      ? new THREE.Vector3(state.view === 'face' ? 0.42 : 0.62, state.view === 'face' ? 0.1 : 0.22, 1)
      : new THREE.Vector3(0.85, 0.42, 1);
    // ?dir=x,y,z: eigene Blickrichtung (zum Pruefen) / own view direction (for checking)
    if (params.get('dir')) dir.set(...(params.get('dir')!.split(',').map(Number) as [number, number, number]));
    if (params.get('span')) persp.zoom = span / Number(params.get('span'));
    persp.position.copy(dir.normalize().multiplyScalar(dist));
    persp.lookAt(0, 0, 0);
    controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0, 0);
  }
  controls.enableDamping = false;
  controls.addEventListener('change', render);
  controls.update();
  (window as unknown as { __controls: OrbitControls }).__controls = controls;
}

/** Zwei Bildhaelften: nebeneinander, im Hochformat uebereinander / two halves: side by side, stacked in portrait */
function halves(): { x: number; y: number; w: number; h: number }[] {
  const w = window.innerWidth, h = window.innerHeight;
  // ?solo=1: nur der Vorschlag, ganzes Bild (zum Pruefen) / proposal only, whole picture (for checking)
  if (params.get('solo')) return [{ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w, h }];
  return w >= h ? [{ x: 0, y: 0, w: w / 2, h }, { x: w / 2, y: 0, w: w / 2, h }] : [{ x: 0, y: h / 2, w, h: h / 2 }, { x: 0, y: 0, w, h: h / 2 }];
}

function render(): void {
  const hv = halves();
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  hv.forEach((v, i) => {
    if (v.w === 0) return;
    const aspect = v.w / v.h;
    if (camera === persp) { persp.aspect = aspect; persp.updateProjectionMatrix(); } else {
      // Brettansicht: Schuetze rund 90 px hoch (?px=) / board view: rifleman about 90 px tall (?px=)
      const px = Number(params.get('px') ?? 90);
      const worldH = (v.h / px) * soldierHeight() * UNIT_SCALE * Math.cos(CAMERA.elevation);
      ortho.top = worldH / 2; ortho.bottom = -worldH / 2; ortho.right = (worldH * aspect) / 2; ortho.left = (-worldH * aspect) / 2;
      ortho.updateProjectionMatrix();
    }
    renderer.setViewport(v.x, v.y, v.w, v.h);
    renderer.setScissor(v.x, v.y, v.w, v.h);
    renderer.info.reset();
    renderer.render(scenes[i], camera);
    drawCalls[i] = renderer.info.render.calls;
  });
}
renderer.info.autoReset = false;
/** Hoehe des Schuetzen im Vorschlag (fuer die 90-px-Ansicht) / height of the proposed rifleman (for the 90 px view) */
function soldierHeight(): number {
  const g = entry('soldier').neu.geometry;
  g.computeBoundingBox();
  return g.boundingBox!.max.y;
}

const $ = (id: string) => document.getElementById(id)!;
function ui(): void {
  document.querySelectorAll<HTMLButtonElement>('button[data-unit]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit)));
  document.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  document.querySelectorAll<HTMLButtonElement>('button[data-q]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === state.q)));
  const hv = halves(), wide = window.innerWidth >= window.innerHeight;
  const top = (v: { y: number; h: number }) => window.innerHeight - v.y - v.h;
  const bar = document.body.classList.contains('bare') ? 8 : (document.querySelector('.bar') as HTMLElement).offsetHeight + 4;
  const place = (el: HTMLElement, v: { x: number; y: number; w: number; h: number }, first: boolean) => {
    el.style.left = `${v.x + 8}px`;
    el.style.top = `${top(v) + (wide || first ? bar : 8)}px`;
  };
  place($('tagOld'), hv[0], true);
  place($('tagNew'), hv[1], false);
  const sp = $('split').style;
  if (wide) { sp.left = `${window.innerWidth / 2 - 1}px`; sp.top = '0'; sp.width = '2px'; sp.height = '100%'; } else { sp.left = '0'; sp.top = `${window.innerHeight / 2 - 1}px`; sp.width = '100%'; sp.height = '2px'; }
  const fmt = (n: number) => Math.round(n).toLocaleString('de-DE');
  const kb = (n: number) => `${fmt(n / 1024)} kB`;
  const board = state.view === 'board';
  const us: Unit[] = board ? ['soldier', 'tank'] : [state.unit];
  const name = (u: Unit) => (u === 'soldier' ? 'Soldat / soldier' : 'Panzer / tank');
  const neuOf = (u: Unit) => (state.q === 'phone' ? entry(u).phone : entry(u).neu);
  $('triOld').textContent = us.map((u) => `${fmt(trisOf(entry(u).old.geometry))} Dreiecke / triangles`).join(' + ');
  $('triNew').textContent = us.map((u) => `${fmt(trisOf(neuOf(u).geometry))} Dreiecke / triangles`).join(' + ') + (state.q === 'phone' ? ' (Handy / phone)' : '');
  const rows = us.flatMap((u) => {
    const e = entry(u);
    return [
      `<tr><td>${name(u)}: heute / today</td><td>${fmt(trisOf(e.old.geometry))}</td><td>${kb(bytesOf(e.old.geometry))}</td><td>${fmt(e.old.ms)} ms</td></tr>`,
      `<tr><td>${name(u)}: Vorschlag voll / proposal full</td><td>${fmt(trisOf(e.neu.geometry))}</td><td>${kb(bytesOf(e.neu.geometry))}</td><td>${fmt(e.neu.ms)} ms</td></tr>`,
      `<tr><td>${name(u)}: Vorschlag Handy / proposal phone</td><td>${fmt(trisOf(e.phone.geometry))}</td><td>${kb(bytesOf(e.phone.geometry))}</td><td>${fmt(e.phone.ms)} ms</td></tr>`,
    ];
  });
  $('statsBody').innerHTML = `<table><tr><th>Modell / model</th><th>Dreiecke / triangles</th><th>Geometrie / geometry</th><th>Bauzeit / build time</th></tr>${rows.join('')}</table>`
    + `<p>Zeichenaufrufe je Bildhaelfte mit Boden / draw calls per half incl. ground: ${drawCalls[0]} | ${drawCalls[1]}. Texturen und Dateien / textures and files: 0 Byte / 0 bytes. Tuschelinie / ink line: ${inkWidth()} (Brett / board ${OUTLINE.unit}). Ziehen dreht, Rad oder zwei Finger zoomen / drag orbits, wheel or pinch zooms.</p>`;
}

document.querySelectorAll<HTMLButtonElement>('button[data-unit]').forEach((b) => b.addEventListener('click', () => { state.unit = b.dataset.unit as Unit; rebuild(); }));
document.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view as View; rebuild(); }));
document.querySelectorAll<HTMLButtonElement>('button[data-q]').forEach((b) => b.addEventListener('click', () => { state.q = b.dataset.q as Quality; rebuild(); }));
function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  ui();
  render();
}
window.addEventListener('resize', resize);

renderer.setSize(window.innerWidth, window.innerHeight, false);
// ?stats=1 klappt die Zahlen auf / opens the numbers
if (params.get('stats')) document.getElementById('stats')!.setAttribute('open', '');
rebuild();
ui();
const w = window as unknown as { __ready: boolean; __stats: unknown };
w.__stats = Object.fromEntries((['soldier', 'tank'] as Unit[]).map((u) => {
  const e = entry(u);
  const s = (b: Built) => ({ tris: trisOf(b.geometry), bytes: bytesOf(b.geometry), ms: Math.round(b.ms) });
  return [u, { old: s(e.old), neu: s(e.neu), phone: s(e.phone), draws: drawCalls }];
}));
// Messhaken fuer Skripte: Modell in einer Netzdichte neu bauen / measuring hook for scripts: rebuild a model at a mesh density
(w as unknown as { __build: unknown }).__build = (u: Unit, d: number) => withDensity(d, () => (u === 'soldier' ? protoInfantry : protoTank)(FACTION));
(w as unknown as { __hull: unknown }).__hull = inkHull;
w.__ready = true;
