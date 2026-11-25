/**
 * Vorschlag C, Vergleichsseite (preview/proto-c.html): links das bisherige prozedurale Modell, rechts das in Blender
 * modellierte glTF-Asset. Gleiches Licht, gleiche Kamera (eine Kamera, zwei Bildhaelften), ziehen dreht, Rad/Zwei-Finger zoomt.
 * Proposal C, comparison page (preview/proto-c.html): the current procedural model on the left, the glTF asset modelled
 * in Blender on the right. Same lighting, same camera (one camera, two halves), drag orbits, wheel/pinch zooms.
 *
 * URL-Parameter (fuer Bildschirmfotos) / URL params (for screenshots):
 * ?unit=soldier|tank &view=close|face|board &clip=<name> &t=<Sekunden, haelt an / seconds, pauses> &f=<Fraktion / faction>
 * &q=high|low &line=fine|game &ui=0 &stress=<Anzahl / count> &mode=skinned|baked &turret=<Grad / degrees> &az=<Grad> &el=<Grad>
 */
import '@fontsource/comic-neue';
import '@fontsource/black-ops-one';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FACTION_IDS, type FactionId, type UnitTypeId } from '../../../../data/balance';
import { factionTokens, hex, semantic } from '../../../../design/tokens';
import { CAMERA, OUTLINE, SUN } from '../../../config';
import { coloredBox, outlined, outlinedInstanced, toonMaterial, unitMaterial } from '../../../toon';
import { setUnitQuality, splitTurrets, unitGeometry } from '../../index';
import { shade } from '../../kit';
import { bakePose, instantiate, loadUnitAsset, type UnitAsset, type UnitInstance } from './assets';
import { PALETTE_SIZE } from './palette';

type UnitKey = 'soldier' | 'tank';
type ViewKey = 'close' | 'face' | 'board';
type Quality = 'high' | 'low';

/** Einheit des Vorschlags: Datei, Spieltyp, Angleichung der Groesse / proposal unit: file, game type, size matching */
const UNITS: Record<UnitKey, { type: UnitTypeId; de: string; en: string; turretBones: string[]; idle: string }> = {
  soldier: { type: 'infantry', de: 'Soldat', en: 'soldier', turretBones: [], idle: 'idle' },
  tank: { type: 'tank', de: 'Panzer', en: 'tank', turretBones: ['turret', 'gun'], idle: 'idle' },
};
/** Linienbreite in Feldbreiten: 'game' = Brett (OUTLINE.unit), 'fine' = Modellbogen (wie preview.ts) / line width in tile widths: 'game' = board, 'fine' = model sheet (as preview.ts) */
const LINE = { game: OUTLINE.unit, fine: 0.0075 };
/** Kopfmitte des bisherigen Schuetzen als Anteil der Hoehe / head centre of the current rifleman as a share of the height */
const FACE_Y = 0.74;
const ASSET_DIR = new URL('../proto/c/', location.href).href;

const params = new URLSearchParams(location.search);
const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  const v = params.get(key) as T | null;
  return v && allowed.includes(v) ? v : fallback;
};
const state = {
  unit: pick<UnitKey>('unit', ['soldier', 'tank'], 'soldier'),
  view: pick<ViewKey>('view', ['close', 'face', 'board'], 'close'),
  faction: pick<FactionId>('f', FACTION_IDS, 'korvat'),
  quality: pick<Quality>('q', ['high', 'low'], 'high'),
  line: pick<'fine' | 'game'>('line', ['fine', 'game'], params.get('view') === 'board' ? 'game' : 'fine'),
  clip: params.get('clip') ?? '',
  stress: Number(params.get('stress') ?? 0),
  mode: pick<'skinned' | 'baked'>('mode', ['skinned', 'baked'], 'skinned'),
  turret: Number(params.get('turret') ?? 0),
};
const frozen = params.has('t') ? Number(params.get('t')) : null;
if (params.get('ui') === '0') document.body.classList.add('bare');

// ---------- Buehne / stage ----------
const canvas = document.getElementById('view') as HTMLCanvasElement;
const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Number(params.get('dpr') ?? window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setScissorTest(true);
renderer.info.autoReset = false;

function makeScene(): THREE.Scene {
  const s = new THREE.Scene();
  s.background = new THREE.Color(hex(semantic.surfaceSunken));
  // Licht wie im Spiel (view.ts) / lighting as in the game (view.ts)
  s.add(new THREE.HemisphereLight(hex(semantic.white), hex(semantic.terrainPlainSide), 1.6));
  const sun = new THREE.DirectionalLight(hex(semantic.white), 2.2);
  sun.position.set(SUN.x, SUN.y, SUN.z);
  s.add(sun, sun.target);
  return s;
}
const scenes = [makeScene(), makeScene()];
const holders = scenes.map((s) => { const g = new THREE.Group(); s.add(g); return g; });
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
controls.enablePan = true;
controls.zoomToCursor = false;
controls.minZoom = 0.3;
controls.maxZoom = 12;

/** Brettfeld in der Gelaendefarbe der Fraktion / board tile in the faction's terrain colour */
function tile(x: number, z: number, f: FactionId): THREE.Object3D {
  const top = factionTokens[f].terrain;
  const t = outlined(coloredBox(0.98, 0.12, 0.98, top, `#${shade(top, 0.72).getHexString()}`), OUTLINE.tile, toonMaterial());
  t.position.set(x, -0.06, z);
  return t;
}

// ---------- Modelle / models ----------
interface Built {
  /** Hoehe und groesste Ausdehnung des bisherigen Modells / height and largest extent of the current model */
  box: THREE.Box3;
  trisCurrent: number;
  callsCurrent: number;
  buildMsCurrent: number;
  asset: UnitAsset;
  scale: number;
}
const buildMs = new Map<string, number>();
function currentGeometry(u: UnitKey, f: FactionId): THREE.BufferGeometry {
  setUnitQuality(state.quality);
  const key = `${u}|${f}|${state.quality}`;
  const t0 = performance.now();
  const g = unitGeometry(UNITS[u].type, f, null);
  if (!buildMs.has(key)) buildMs.set(key, performance.now() - t0);
  return g;
}
/** Bisheriges Modell wie auf dem Brett: Wanne + Drehtuerme / current model as on the board: hull + turrets */
function currentModel(u: UnitKey, f: FactionId, width: number, yaw = 0): THREE.Group {
  const g = currentGeometry(u, f);
  return splitModel(g, width, yaw);
}
function splitModel(g: THREE.BufferGeometry, width: number, yaw = 0): THREE.Group {
  const split = splitTurrets(g);
  if (!split) return outlined(g, width, unitMaterial());
  const model = outlined(split.hull, width, unitMaterial());
  for (const t of split.turrets) {
    const tur = outlined(t.geometry, width, unitMaterial());
    tur.position.copy(t.pivot);
    tur.rotation.y = t.yaw + yaw;
    tur.userData.turretRest = t.yaw;
    model.add(tur);
  }
  return model;
}

interface Manifest { units: Record<string, Record<Quality, { file: string; fitHeight?: number; headCenter?: number; fitWidth?: number; bytes: number; rawBytes: number; triangles: number }>> }
let manifest: Manifest;
const live: UnitInstance[] = [];
let built: Built | null = null;
let stressInfo = '';

async function assetFor(u: UnitKey): Promise<{ asset: UnitAsset; scale: number; box: THREE.Box3 }> {
  const meta = manifest.units[u][state.quality];
  const asset = await loadUnitAsset(ASSET_DIR + meta.file);
  const g = currentGeometry(u, state.faction);
  g.computeBoundingBox();
  const box = g.boundingBox!.clone();
  // Groesse angleichen: Figur ueber die Hoehe bis zur Helmspitze, Fahrzeug ueber die Wannenbreite
  // match the size: figure by the height to the helmet top, vehicle by the hull width
  const scale = meta.fitHeight ? figureTop(g) / meta.fitHeight : (2 * Math.max(-box.min.x, box.max.x)) / (meta.fitWidth ?? 1);
  return { asset, scale, box };
}
/** Hoechster Punkt nahe der Mittelachse (Helm), ohne Gewehr / highest point near the centre axis (helmet), without the rifle */
function figureTop(g: THREE.BufferGeometry): number {
  const p = g.getAttribute('position');
  let top = 0;
  for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i), p.getZ(i) + 0.05) < 0.07) top = Math.max(top, p.getY(i));
  return top;
}

function clear(): void {
  for (const h of holders) h.clear();
  live.length = 0;
}

async function rebuild(): Promise<void> {
  clear();
  const f = state.faction;
  const width = LINE[state.line];
  if (state.stress > 0) return rebuildStress();
  const list: UnitKey[] = state.view === 'board' ? ['soldier', 'tank'] : [state.unit];
  const spots: [number, number][] = state.view === 'board' ? [[0, 1], [1, 0]] : [[0, 0]];
  for (let i = 0; i < list.length; i++) {
    const u = list[i], [x, z] = spots[i];
    if (!manifest.units[u]) continue;
    const { asset, scale, box } = await assetFor(u);
    const cur = currentModel(u, f, width, THREE.MathUtils.degToRad(state.turret));
    cur.position.set(x, 0, z);
    holders[0].add(cur);
    const inst = instantiate(asset, f, scale, width);
    inst.root.position.set(x, 0, z);
    // Gesichtsansicht: Kopfmitten beider Modelle auf gleiche Hoehe / face view: head centres of both models at the same height
    const meta = manifest.units[u][state.quality];
    if (state.view === 'face' && meta.headCenter) inst.root.position.y = box.max.y * FACE_Y - meta.headCenter * scale;
    holders[1].add(inst.root);
    live.push(inst);
    const clip = asset.clips.some((c) => c.name === state.clip) ? state.clip : UNITS[u].idle;
    inst.play(clip, 0);
    if (u === state.unit || list.length === 1) {
      const g = currentGeometry(u, f);
      built = { box, trisCurrent: g.getAttribute('position').count / 3, callsCurrent: (splitTurrets(g)?.turrets.length ?? 0) * 2 + 2, buildMsCurrent: buildMs.get(`${u}|${f}|${state.quality}`) ?? 0, asset, scale };
    }
    for (const h of holders) {
      if (state.view === 'board') for (let a = -1; a <= 2; a++) for (let b = -1; b <= 2; b++) { if (i === 0) h.add(tile(a, b, f)); } else h.add(tile(x, z, f));
    }
  }
  applyTurret();
  if (frozen !== null) for (const inst of live) inst.mixer.setTime(frozen);
  frame();
  buildClipButtons();
  readout();
}

/** Lasttest: viele Einheiten, links bisher, rechts Vorschlag (animiert mit Skelett oder eingebrannte Pose, instanziert) / load test: many units */
async function rebuildStress(): Promise<void> {
  const f = state.faction, n = state.stress, side = Math.ceil(Math.sqrt(n));
  const u = state.unit;
  const { asset, scale, box } = await assetFor(u);
  const g = currentGeometry(u, f);
  const at = (i: number): [number, number] => [(i % side) - (side - 1) / 2, Math.floor(i / side) - (side - 1) / 2];
  for (let i = 0; i < n; i++) {
    const [x, z] = at(i);
    const cur = splitModel(g, OUTLINE.unit);
    cur.position.set(x, 0, z);
    holders[0].add(cur);
  }
  if (state.mode === 'skinned') {
    for (let i = 0; i < n; i++) {
      const [x, z] = at(i);
      const inst = instantiate(asset, f, scale, OUTLINE.unit);
      inst.root.position.set(x, 0, z);
      holders[1].add(inst.root);
      live.push(inst);
      const names = [...inst.actions.keys()];
      inst.play(names[i % names.length], 0);
      inst.mixer.setTime((i * 0.137) % 1);
    }
  } else {
    // eingebrannte Ruhepose, EINE instanzierte Geometrie / baked rest pose, ONE instanced geometry
    const probe = instantiate(asset, f, scale, OUTLINE.unit);
    probe.play(UNITS[u].idle, 0);
    probe.mixer.setTime(0);
    const baked = bakePose(probe, f);
    const { mesh, line } = outlinedInstanced(baked, n, OUTLINE.unit, unitMaterial());
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const [x, z] = at(i); m.makeTranslation(x, 0, z); mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); }
    holders[1].add(mesh, line);
  }
  for (const h of holders) {
    const ground = new THREE.Mesh(new THREE.BoxGeometry(side + 0.4, 0.1, side + 0.4), new THREE.MeshToonMaterial({ color: hex(factionTokens[f].terrain) }));
    ground.position.y = -0.05;
    h.add(ground);
  }
  built = { box, trisCurrent: g.getAttribute('position').count / 3, callsCurrent: (splitTurrets(g)?.turrets.length ?? 0) * 2 + 2, buildMsCurrent: buildMs.get(`${u}|${f}|${state.quality}`) ?? 0, asset, scale };
  frame();
  buildClipButtons();
  readout();
}

function applyTurret(): void {
  for (const inst of live) {
    const b = inst.bone('turret');
    if (b) b.rotation.y = THREE.MathUtils.degToRad(state.turret);
  }
}

// ---------- Kamera / camera ----------
function panel(i: number): { x: number; y: number; w: number; h: number } {
  const w = stage.clientWidth, h = stage.clientHeight;
  // schmal: uebereinander, sonst nebeneinander / narrow: stacked, otherwise side by side
  return w <= 720 ? { x: 0, y: i === 0 ? h / 2 : 0, w, h: h / 2 } : { x: i === 0 ? 0 : w / 2, y: 0, w: w / 2, h };
}

/** Kamera auf die Ansicht stellen / put the camera on the view */
function frame(): void {
  if (!built) return;
  const p = panel(0);
  const H = built.box.max.y;
  let az = -22, el = 10, target = new THREE.Vector3(0.02, H / 2, 0.06), viewH = H / 0.8;
  if (state.stress > 0) {
    const side = Math.ceil(Math.sqrt(state.stress));
    az = 45; el = THREE.MathUtils.radToDeg(CAMERA.elevation); target.set(0, 0, 0); viewH = Math.max(side * 1.25, (side * 1.6 * p.h) / p.w);
  } else if (state.view === 'face') {
    az = -20; el = 6; target.set(0, H * FACE_Y, -0.02); viewH = H * 0.62;
  } else if (state.view === 'board') {
    // Brettkamera des Spiels; der Soldat ist etwa 90 px hoch / the game's board camera; the soldier is about 90 px tall
    az = 45; el = THREE.MathUtils.radToDeg(CAMERA.elevation); target.set(0.5, 0.2, 0.5);
    viewH = (p.h * (soldierTop * Math.cos(CAMERA.elevation))) / 90;
  } else if (state.unit === 'tank') {
    const b = built.box;
    const r = Math.hypot(Math.max(-b.min.x, b.max.x), Math.max(-b.min.z, b.max.z));
    az = 38; el = 16; target.set(0, H * 0.45, 0.02); viewH = Math.max(H * 1.5, (2.05 * r * p.h) / p.w);
  }
  if (params.has('az')) az = Number(params.get('az'));
  if (params.has('el')) el = Number(params.get('el'));
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(40));
  camera.zoom = 1;
  camera.userData.viewH = viewH;
  controls.target.copy(target);
  controls.update();
  resize();
}
let soldierTop = 0.5;

function resize(): void {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  const p = panel(0);
  const viewH = (camera.userData.viewH as number | undefined) ?? 1;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.right = (viewH / 2) * (p.w / p.h);
  camera.left = -camera.right;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
// die Buehne aendert ihre Groesse auch, wenn die Leisten umbrechen / the stage also changes size when the bars wrap
new ResizeObserver(resize).observe(stage);

// ---------- Schleife / loop ----------
const clock = new THREE.Clock();
const perf = { anim: 0, bones: 0, draw: [0, 0], calls: [0, 0], tris: [0, 0], n: 0 };
function tick(): void {
  const dt = Math.min(0.1, clock.getDelta());
  const t0 = performance.now();
  if (frozen === null) for (const inst of live) inst.mixer.update(dt);
  applyTurret();
  const t1 = performance.now();
  // Lasttest: Knochenmatrizen getrennt messen (der Renderer rechnet sie sonst beim Zeichnen) / load test: time the bone matrices separately (otherwise the renderer computes them while drawing)
  if (state.stress > 0) {
    holders[1].updateMatrixWorld();
    for (const inst of live) inst.mesh.skeleton.update();
  }
  const t2 = performance.now();
  controls.update();
  const draw = [0, 0];
  for (let i = 0; i < 2; i++) {
    const p = panel(i);
    renderer.setViewport(p.x, p.y, p.w, p.h);
    renderer.setScissor(p.x, p.y, p.w, p.h);
    renderer.info.reset();
    const s = performance.now();
    renderer.render(scenes[i], camera);
    draw[i] = performance.now() - s;
    perf.calls[i] = renderer.info.render.calls;
    perf.tris[i] = renderer.info.render.triangles;
  }
  // gleitende Mittel / running means
  const k = perf.n < 20 ? 1 / (perf.n + 1) : 0.05;
  perf.anim += (t1 - t0 - perf.anim) * k;
  perf.bones += (t2 - t1 - perf.bones) * k;
  perf.draw[0] += (draw[0] - perf.draw[0]) * k;
  perf.draw[1] += (draw[1] - perf.draw[1]) * k;
  perf.n++;
  if (state.stress > 0 && perf.n % 5 === 0) readout();
  document.body.dataset.frames = String(perf.n);
  requestAnimationFrame(tick);
}

// ---------- Bedienung / controls ----------
function buttons<T extends string>(host: string, items: { key: T; label: string }[], get: () => T, set: (k: T) => void): void {
  const el = document.getElementById(host)!;
  for (const b of [...el.querySelectorAll('button')]) b.remove();
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = it.label;
    b.setAttribute('aria-pressed', String(get() === it.key));
    b.addEventListener('click', () => {
      set(it.key);
      for (const o of el.querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b));
    });
    el.appendChild(b);
  }
}
const CLIP_LABEL: Record<string, string> = {
  idle: 'Ruhe / idle', walk: 'Gehen / walk', aimFire: 'Zielen + Feuern / aim + fire', drive: 'Fahren / drive', fire: 'Feuern / fire',
};
function buildClipButtons(): void {
  const inst = live[state.view === 'board' && state.unit === 'tank' ? 1 : 0];
  const names = inst ? [...inst.actions.keys()] : [];
  if (!names.includes(state.clip)) state.clip = UNITS[state.unit].idle;
  buttons('gClip', names.map((n) => ({ key: n, label: CLIP_LABEL[n] ?? n })), () => state.clip, (k) => {
    state.clip = k;
    for (const i of live) i.play(k);
  });
  document.getElementById('gTurret')!.style.display = state.unit === 'tank' || state.view === 'board' ? '' : 'none';
}
function setupUi(): void {
  buttons('gUnit', (Object.keys(UNITS) as UnitKey[]).map((k) => ({ key: k, label: `${UNITS[k].de} / ${UNITS[k].en}` })), () => state.unit, (k) => { state.unit = k; state.clip = ''; void rebuild(); });
  buttons<ViewKey>('gView', [{ key: 'close', label: 'Nah / close' }, { key: 'face', label: 'Gesicht / face' }, { key: 'board', label: 'Brett / board' }], () => state.view, (k) => {
    state.view = k;
    state.line = k === 'board' ? 'game' : 'fine';
    setupUi();
    void rebuild();
  });
  buttons<Quality>('gQuality', [{ key: 'high', label: 'Detail hoch / high' }, { key: 'low', label: 'niedrig / low' }], () => state.quality, (k) => { state.quality = k; void rebuild(); });
  buttons<'fine' | 'game'>('gLine', [{ key: 'fine', label: 'Linie fein / fine line' }, { key: 'game', label: 'Brettlinie / board line' }], () => state.line, (k) => { state.line = k; void rebuild(); });
  buttons<string>('gStress', [{ key: '0', label: '1' }, { key: '100s', label: '100 animiert / animated' }, { key: '100b', label: '100 eingebrannt / baked' }], () => (state.stress ? (state.mode === 'baked' ? '100b' : '100s') : '0'), (k) => {
    state.stress = k === '0' ? 0 : 100;
    state.mode = k === '100b' ? 'baked' : 'skinned';
    perf.n = 0;
    void rebuild();
  });
  const sel = document.getElementById('faction') as HTMLSelectElement;
  if (!sel.options.length) {
    for (const f of FACTION_IDS) sel.add(new Option(f, f, false, f === state.faction));
    sel.addEventListener('change', () => { state.faction = sel.value as FactionId; void rebuild(); });
    const tur = document.getElementById('turret') as HTMLInputElement;
    tur.value = String(state.turret);
    tur.addEventListener('input', () => { state.turret = Number(tur.value); void rebuildCurrentTurret(); });
  }
}
/** Turm des bisherigen Modells mitdrehen / turn the current model's turret along */
function rebuildCurrentTurret(): void {
  holders[0].traverse((o) => {
    if (o.userData.turretRest !== undefined) o.rotation.y = o.userData.turretRest + THREE.MathUtils.degToRad(state.turret);
  });
  applyTurret();
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} kB`;
function readout(): void {
  if (!built) return;
  const a = built.asset;
  const el = document.getElementById('readout')!;
  const rows: [string, string, string][] = [
    ['Dreiecke / triangles', String(built.trisCurrent), String(a.triangles)],
    ['Zeichenaufrufe je Einheit / draw calls per unit', String(built.callsCurrent), '2'],
    ['Download', '0 (im Code / in code)', `${kb(a.bytes)} glb + ${PALETTE_SIZE * 4} B Palette / palette`],
    ['Aufbau im Browser / build in the browser', `${built.buildMsCurrent.toFixed(0)} ms`, `${a.parseMs.toFixed(0)} ms (+ Netz / network ${Math.max(0, a.loadMs - a.parseMs).toFixed(0)} ms)`],
    ['Knochen, Clips / bones, clips', '0', `${a.bones}, ${a.clips.map((c) => c.name).join(' ')}`],
  ];
  if (state.stress > 0) {
    rows.push([`${state.stress} Einheiten: Zeichenaufrufe / units: draw calls`, String(perf.calls[0]), String(perf.calls[1])]);
    rows.push(['Zeichnen je Bild / draw per frame (CPU)', `${perf.draw[0].toFixed(1)} ms`, `${perf.draw[1].toFixed(1)} ms + Animation ${perf.anim.toFixed(1)} ms + Knochen / bones ${perf.bones.toFixed(1)} ms`]);
    stressInfo = JSON.stringify({ calls: perf.calls, tris: perf.tris, draw: perf.draw.map((v) => +v.toFixed(2)), anim: +perf.anim.toFixed(2), bones: +perf.bones.toFixed(2) });
  }
  el.replaceChildren(...rows.map(([k, c, p]) => {
    const d = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    d.append(b, `bisher / current ${c} | Vorschlag / proposal ${p}`);
    return d;
  }));
  document.body.dataset.stats = JSON.stringify({ unit: state.unit, quality: state.quality, trisCurrent: built.trisCurrent, trisProposal: a.triangles, bytes: a.bytes, parseMs: +a.parseMs.toFixed(1), loadMs: +a.loadMs.toFixed(1), buildMsCurrent: +built.buildMsCurrent.toFixed(1), bones: a.bones, scale: +built.scale.toFixed(4), box: [...built.box.min.toArray(), ...built.box.max.toArray()].map((v) => +v.toFixed(3)), stress: stressInfo });
}

async function main(): Promise<void> {
  manifest = await (await fetch(`${ASSET_DIR}manifest.json`)).json() as Manifest;
  await Promise.all([document.fonts.load('14px "Comic Neue"'), document.fonts.load('16px "Black Ops One"')]).catch(() => undefined);
  // breite Fenster zeigen alle Regler, schmale klappen sie ein / wide windows show all controls, narrow ones fold them
  (document.getElementById('more') as HTMLDetailsElement).open = window.innerWidth > 720;
  setUnitQuality(state.quality);
  soldierTop = figureTop(currentGeometry('soldier', 'korvat'));
  setupUi();
  await rebuild();
  tick();
  document.body.dataset.ready = '1';
}
void main();
