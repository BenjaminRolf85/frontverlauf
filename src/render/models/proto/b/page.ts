/**
 * Vorschauseite fuer Vorschlag B (preview/proto-b.html): bisheriges Modell links, Vorschlag rechts, gleiche Kamera und
 * gleiches Licht. Ziehen dreht, Rad oder Zwei-Finger-Geste zoomt.
 * Preview page for proposal B (preview/proto-b.html): current model left, proposal right, same camera and same light.
 * Drag orbits, wheel or pinch zooms.
 * URL: ?unit=soldier|tank &shot=close|face|board &size=512|1024|2048 &f=<faction> &az= &el= &zoom= &bare=1 &layers=<Bitmaske / bit mask>
 */
import '@fontsource/bangers';
import '@fontsource/black-ops-one';
import '@fontsource/comic-neue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FactionId } from '../../../../data/balance';
import { hex, primitives, semantic } from '../../../../design/tokens';
import { CAMERA, OUTLINE, SUN } from '../../../config';
import { flatToon, outlined, unitMaterial } from '../../../toon';
import { splitTurrets, unitGeometry } from '../../index';
import { Painter } from './atlas';
import { paintFigure } from './figurePaint';
import { INK, inkMaterial } from './ink';
import { protoUnit, type ProtoType, type ProtoUnit } from './index';
import { LAYERS } from './material';
import { paintTank } from './tankPaint';

type Shot = 'close' | 'face' | 'board';
const params = new URLSearchParams(location.search);
const faction = (params.get('f') ?? 'korvat') as FactionId;
let unit: ProtoType = params.get('unit') === 'tank' ? 'tank' : 'infantry';
let shot: Shot = (['close', 'face', 'board'].includes(params.get('shot') ?? '') ? params.get('shot') : 'close') as Shot;
let texSize = Number(params.get('size') ?? 1024);
if (params.get('bare')) document.body.classList.add('bare');

/** Einheitenmassstab auf dem Brett (board.ts UNIT_SCALE) / unit scale on the board (board.ts UNIT_SCALE) */
const BOARD_SCALE = 1.25;
/** Konturbreite der Nahansicht wie die Modellvorschau (preview.ts) / outline width of the close view like the model preview (preview.ts) */
const CLOSE_OUTLINE = 0.0075;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage'), canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(hex(semantic.surfaceRaised), 1);

const scene = new THREE.Scene();
// Licht wie im Spiel (view.ts) / light as in the game (view.ts)
scene.add(new THREE.HemisphereLight(hex(semantic.white), hex(semantic.terrainPlainSide), 1.6));
const sun = new THREE.DirectionalLight(hex(semantic.white), 2.2);
sun.position.set(SUN.x, SUN.y, SUN.z);
scene.add(sun);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
controls.enablePan = true;
controls.minZoom = 0.4;
controls.maxZoom = 12;
controls.zoomToCursor = false;

const current = new THREE.Group(), proposal = new THREE.Group(), ground = new THREE.Group();
scene.add(current, proposal, ground);

const protos = new Map<string, ProtoUnit>();
function proto(type: ProtoType): ProtoUnit {
  const key = `${type}|${texSize}`;
  let p = protos.get(key);
  if (!p) { p = protoUnit(type, faction, { size: texSize }); protos.set(key, p); }
  return p;
}

let turretYaw = 0;
const turretNodes: THREE.Object3D[] = [];

/** Bisheriges Modell wie auf dem Brett (board.ts unitModel) / current model as on the board (board.ts unitModel) */
function currentModel(type: ProtoType, width: number): THREE.Group {
  const g = unitGeometry(type, faction, null);
  const split = splitTurrets(g);
  if (!split) return outlined(g, width, unitMaterial());
  const model = outlined(split.hull, width, unitMaterial());
  for (const t of split.turrets) {
    const tur = outlined(t.geometry, width, unitMaterial());
    tur.position.copy(t.pivot);
    turretNodes.push(tur);
    model.add(tur);
  }
  return model;
}

/** Vorschlag: je Teil eine Flaeche und eine Tuschegeometrie / proposal: one fill and one ink geometry per part */
function proposalModel(type: ProtoType): THREE.Group {
  const p = proto(type);
  const model = new THREE.Group();
  for (const part of p.parts) {
    const node = new THREE.Group();
    node.add(new THREE.Mesh(part.fill, p.material), new THREE.Mesh(part.ink, inkMaterial()));
    if (part.pivot) { node.position.copy(part.pivot); turretNodes.push(node); }
    model.add(node);
  }
  return model;
}

function tile(x: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.98), flatToon(semantic.terrainPlain));
  m.position.set(x, -0.04, 0);
  return m;
}

/** Mitte des obersten Teils eines Modells (Kopf, Turmdach) / centre of the topmost part of a model (head, turret roof) */
function headCentre(root: THREE.Object3D, depth: number): THREE.Vector3 {
  const bb = new THREE.Box3().setFromObject(root);
  const sum = new THREE.Vector3(), v = new THREE.Vector3();
  let n = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry.getAttribute('color')) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y > bb.max.y - depth) { sum.add(v); n++; }
    }
  });
  return n ? sum.multiplyScalar(1 / n) : bb.getCenter(new THREE.Vector3());
}

let focus = new THREE.Box3();
function rebuild(): void {
  for (const g of [current, proposal, ground]) { g.clear(); g.position.set(0, 0, 0); }
  turretNodes.length = 0;
  const width = shot === 'board' ? OUTLINE.unit : CLOSE_OUTLINE;
  INK.uWidth.value = width;
  if (shot === 'board') {
    // beide Einheiten in Brettgroesse auf zwei Feldern / both units at board size on two tiles
    const order: ProtoType[] = ['infantry', 'tank'];
    order.forEach((t, i) => {
      const x = (i - 0.5) * 1.0;
      for (const [root, model] of [[current, currentModel(t, width)], [proposal, proposalModel(t)]] as const) {
        model.scale.setScalar(BOARD_SCALE);
        model.position.x = x;
        root.add(model);
      }
      ground.add(tile(x));
    });
  } else {
    current.add(currentModel(unit, width));
    proposal.add(proposalModel(unit));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(unit === 'tank' ? 0.5 : 0.3, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hex(semantic.ink), transparent: true, opacity: 0.1 }));
    shadow.position.y = -0.002;
    if (shot !== 'face') ground.add(shadow);
    // jedes Modell fuer sich in die Bildmitte / every model centred on its own
    for (const root of [current, proposal]) {
      const c = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
      root.position.set(-c.x, 0, -c.z);
    }
  }
  for (const n of turretNodes) n.rotation.y = turretYaw;
  if (shot === 'face') {
    // Detail: beide Modelle so verschieben, dass derselbe Ausschnitt (Kopf bzw. Turm) in der Bildmitte liegt
    // detail: shift both models so the same part (head or turret) sits in the centre of the image
    for (const root of [current, proposal]) {
      const bb = new THREE.Box3().setFromObject(root);
      const head = root === proposal ? headCentre(root, 0.15) : headCentre(root, unit === 'tank' ? 0.15 : 0.22);
      root.position.set(-head.x, -bb.max.y, -head.z);
    }
  }
  focus = new THREE.Box3().setFromObject(proposal).union(new THREE.Box3().setFromObject(current));
  readout();
}

/** Bildausschnitt eines Feldes (CSS-Pixel) / viewport of one panel (CSS pixels) */
function panels(): { stacked: boolean; w: number; h: number } {
  const W = stage.clientWidth, H = stage.clientHeight;
  const stacked = W < H;
  document.body.classList.toggle('stacked', stacked);
  return stacked ? { stacked, w: W, h: H / 2 } : { stacked, w: W / 2, h: H };
}

/** Kamera auf die Ansicht stellen / set the camera for the view */
function frame(): void {
  const { w, h } = panels();
  const centre = focus.getCenter(new THREE.Vector3());
  const size = focus.getSize(new THREE.Vector3());
  let az = 0.6, el = 0.26, span: number;
  if (shot === 'board') {
    az = Math.PI / 4; el = CAMERA.elevation;
    centre.set(0, 0.28, 0);
    // Schuetze rund 90 CSS-Pixel hoch / rifleman about 90 CSS pixels tall
    const figure = new THREE.Box3().setFromObject(proposal.children[0]).getSize(new THREE.Vector3()).y;
    span = (h / 2) * ((figure * Math.cos(el)) / 90);
  } else if (shot === 'face') {
    if (unit === 'infantry') { centre.set(0, -0.115, 0); span = 0.15; az = 0.42; el = 0.1; }
    else { centre.set(0, -0.14, 0.03); span = 0.2; az = 0.62; el = 0.3; }
  } else {
    // Figur fuellt rund 80 % der Feldhoehe / the figure fills about 80 % of the panel height
    const hh = size.y * Math.cos(el) + (unit === 'tank' ? Math.hypot(size.x, size.z) * Math.sin(el) : 0.05);
    const ww = Math.abs(size.x * Math.cos(az)) + Math.abs(size.z * Math.sin(az));
    span = Math.max(hh / 0.8 / 2, (ww / 0.94 / 2) * (h / w));
  }
  if (params.get('az')) az = Number(params.get('az'));
  if (params.get('el')) el = Number(params.get('el'));
  camera.zoom = Number(params.get('zoom') ?? 1);
  const aspect = w / h;
  camera.top = span; camera.bottom = -span; camera.left = -span * aspect; camera.right = span * aspect;
  camera.position.copy(centre).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(40));
  camera.lookAt(centre);
  camera.updateProjectionMatrix();
  controls.target.copy(centre);
  controls.update();
}

function resize(): void {
  const dpr = Math.min(Number(params.get('dpr') ?? window.devicePixelRatio), 3);
  renderer.setPixelRatio(dpr);
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  const { w, h } = panels();
  const span = camera.top, aspect = w / h;
  camera.left = -span * aspect; camera.right = span * aspect;
  camera.updateProjectionMatrix();
  INK.uDpr.value = dpr;
}

let queued = false;
function render(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    draw();
  });
}
function draw(): void {
  const { stacked, w, h } = panels();
  const dpr = renderer.getPixelRatio();
  renderer.setScissorTest(true);
  [current, proposal].forEach((root, i) => {
    const x = stacked ? 0 : i * w, y = stacked ? (1 - i) * h : 0;
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    current.visible = i === 0;
    proposal.visible = i === 1;
    INK.uView.value.set(w * dpr, h * dpr);
    renderer.info.reset();
    renderer.render(scene, camera);
    if (root === proposal) calls.proposal = renderer.info.render.calls - ground.children.length;
    else calls.current = renderer.info.render.calls - ground.children.length;
  });
  $('readoutBody').querySelectorAll<HTMLElement>('[data-calls]').forEach((e) => { e.textContent = String(calls[e.dataset.calls as 'current' | 'proposal']); });
}
const calls = { current: 0, proposal: 0 };
renderer.info.autoReset = false;

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE');
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
function readout(): void {
  const types: ProtoType[] = shot === 'board' ? ['infantry', 'tank'] : [unit];
  const cur = types.reduce((s, t) => s + unitGeometry(t, faction, null).getAttribute('position').count / 3, 0);
  const ps = types.map((t) => proto(t));
  const tri = ps.reduce((s, p) => s + p.triangles, 0), ink = ps.reduce((s, p) => s + p.inkTriangles, 0);
  const bytes = ps.reduce((s, p) => s + p.textures.bytes, 0);
  const ms = ps.reduce((s, p) => s + p.ms.geometry + p.ms.ink + p.ms.ao + p.textures.ms, 0);
  const curHull = cur;
  $('readoutBody').innerHTML = `<table>
    <thead><tr><th></th><th>Bisher / Current</th><th>Vorschlag B / Proposal B</th></tr></thead>
    <tbody>
    <tr><td>Dreiecke Flaechen / fill triangles</td><td>${fmt(cur)}</td><td>${fmt(tri)}</td></tr>
    <tr><td>Dreiecke Tusche / ink triangles</td><td>${fmt(curHull)}</td><td>${fmt(ink)}</td></tr>
    <tr><td>Zeichenaufrufe / draw calls</td><td data-calls="current">-</td><td data-calls="proposal">-</td></tr>
    <tr><td>Textur / texture</td><td>0</td><td>${ps[0].textures.size} px, ${mb(bytes)} GPU, 0 Download</td></tr>
    <tr><td>Aufbau im Browser / build in browser</td><td>-</td><td>${fmt(ms)} ms</td></tr>
    </tbody></table>`;
  (window as unknown as { __stats: unknown }).__stats = {
    current: { triangles: cur }, proposal: ps.map((p) => ({ triangles: p.triangles, inkTriangles: p.inkTriangles, creases: p.creases, textureBytes: p.textures.bytes, textureSize: p.textures.size, ms: { ...p.ms, texture: p.textures.ms } })),
    calls,
  };
}

function press(): void {
  $('uSoldier').setAttribute('aria-pressed', String(unit === 'infantry'));
  $('uTank').setAttribute('aria-pressed', String(unit === 'tank'));
  for (const [id, s] of [['vClose', 'close'], ['vFace', 'face'], ['vBoard', 'board']] as const) $(id).setAttribute('aria-pressed', String(shot === s));
  $('turretBox').style.display = unit === 'tank' || shot === 'board' ? '' : 'none';
}
function update(reframe = true): void {
  press();
  rebuild();
  if (reframe) frame();
  render();
}

$('uSoldier').onclick = () => { unit = 'infantry'; update(); };
$('uTank').onclick = () => { unit = 'tank'; update(); };
$('vClose').onclick = () => { shot = 'close'; update(); };
$('vFace').onclick = () => { shot = 'face'; update(); };
$('vBoard').onclick = () => { shot = 'board'; update(); };
$<HTMLSelectElement>('tex').value = String(texSize);
$<HTMLSelectElement>('tex').onchange = (e) => { texSize = Number((e.target as HTMLSelectElement).value); update(false); };
$<HTMLInputElement>('turret').oninput = (e) => {
  turretYaw = (Number((e.target as HTMLInputElement).value) * Math.PI) / 180;
  for (const n of turretNodes) n.rotation.y = turretYaw;
  render();
};
// breite Fenster: Ebenen und Kosten aufgeklappt; Handy: zugeklappt, damit das Modell frei bleibt
// wide windows: layers and cost open; phone: closed so the model stays clear
const wide = window.innerWidth >= 900;
$<HTMLDetailsElement>('opts').open = wide;
$<HTMLDetailsElement>('readout').open = wide;
const layerIds = ['lTex', 'lInk', 'lHatch', 'lAo', 'lGloss'] as const;
function layers(): void {
  const on = layerIds.map((id) => ($<HTMLInputElement>(id).checked ? 1 : 0));
  LAYERS.uLayers.value.set(on[0], on[1], on[2], on[3]);
  LAYERS.uLayers2.value.set(on[4], on[4]);
  INK.uCreaseOn.value = on[1];
  INK.uIrregular.value = on[1];
  render();
}
if (params.get('layers')) { const mask = Number(params.get('layers')); layerIds.forEach((id, i) => { $<HTMLInputElement>(id).checked = !!(mask & (1 << i)); }); }
for (const id of layerIds) $<HTMLInputElement>(id).onchange = layers;

controls.addEventListener('change', render);
new ResizeObserver(() => { resize(); render(); }).observe(stage);

// Fehlersuche: Atlas-Ebenen als Bilder / debugging: atlas layers as images
(window as unknown as { __atlas: (t: ProtoType, layer: 0 | 1 | 2) => string }).__atlas = (t, layer) => {
  const p = new Painter(proto(t).layout, texSize);
  if (t === 'tank') paintTank(p, faction); else paintFigure(p, faction);
  return p.canvas(layer).toDataURL('image/png');
};

Promise.all([document.fonts.load(`40px ${primitives.font.display}`), document.fonts.load(`20px ${primitives.font.comic}`), document.fonts.ready]).catch(() => undefined).then(() => {
  resize();
  layers();
  update();
  draw();
  (window as unknown as { __ready: boolean }).__ready = true;
});
