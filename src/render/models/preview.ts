/**
 * Modell-Vorschau / model preview (preview/models.html).
 * Zeigt alle Modelle fuer alle Fraktionen im Raster mit Toon-Material und Inverted-Hull-Kontur.
 * Shows all models for all factions in a grid with toon material and inverted-hull outline.
 * URL-Parameter / URL params: ?cat=units|ships|buildings|grand|cities|nature|all &view=iso|top|front &f=<faction>
 */
import '@fontsource/bangers';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  FACTION_IDS, GRAND_PROJECT_IDS, type BuildingId, type FactionId, type ResourceId, type TerrainId, type UnitTypeId,
} from '../../data/balance';
import { factionTokens, primitives, semantic } from '../../design/tokens';
import {
  buildingGeometry, cityGeometry, cloudGeometry, decorationGeometry, featureGeometry, outlineGeometry, unitGeometry,
} from './index';

type Cell = { geo: THREE.BufferGeometry | null; ground: string | null; label?: string };
type Row = { label: string; cells: Cell[] };
type Sheet = { cols: string[]; rows: Row[] };

const params = new URLSearchParams(location.search);
const cat = params.get('cat') ?? 'units';
const view = params.get('view') ?? 'iso';
const onlyFaction = params.get('f') as FactionId | null;
const factions: FactionId[] = onlyFaction ? [onlyFaction] : FACTION_IDS;
const withNeutral: (FactionId | null)[] = onlyFaction ? [onlyFaction] : [...FACTION_IDS, null];

const LAND: UnitTypeId[] = ['infantry', 'sniper', 'jeep', 'pioneer', 'mg', 'medic', 'artillery', 'spy', 'heli', 'tank'];
const SHIPS: UnitTypeId[] = ['landingBoat', 'submarine', 'destroyer', 'battleship'];
const BUILDINGS: (BuildingId | 'outpost')[] = [
  'storehouse', 'ranch', 'fishery', 'lumberCamp', 'farm', 'mine', 'materialsPlant', 'foodFactory', 'steelMill',
  'logisticsCenter', 'navalBase', 'road', 'bridge', 'researchCenter', 'outpost',
];
const WATER_BUILDINGS = new Set(['fishery', 'navalBase', 'bridge']);

const plainGround = semantic.terrainPlain;
const waterGround = semantic.terrainShallow;

function sheet(): Sheet {
  const fname = (f: FactionId | null) => f ?? 'neutral';
  switch (cat) {
    case 'ships':
      return {
        cols: factions.map(fname),
        rows: [
          ...SHIPS.map((t) => ({ label: t, cells: factions.map((f) => ({ geo: unitGeometry(t, f, t === 'landingBoat' ? 'infantry' : null), ground: waterGround })) })),
          { label: 'boat+tank', cells: factions.map((f) => ({ geo: unitGeometry('landingBoat', f, 'tank'), ground: waterGround })) },
        ],
      };
    case 'buildings':
      return {
        cols: withNeutral.map(fname),
        rows: BUILDINGS.map((k) => ({
          label: k,
          cells: withNeutral.map((f) => ({ geo: buildingGeometry(k, f), ground: WATER_BUILDINGS.has(k) ? waterGround : k === 'mine' ? semantic.terrainMountain : plainGround })),
        })),
      };
    case 'grand':
      return {
        cols: withNeutral.map(fname),
        rows: GRAND_PROJECT_IDS.map((k) => ({ label: k, cells: withNeutral.map((f) => ({ geo: buildingGeometry(k, f), ground: plainGround })) })),
      };
    case 'cities': {
      const variants: { label: string; level: number; flags: { hq: boolean; factory: boolean; bunkerRing: boolean; govQuarter: boolean } }[] = [
        { label: 'L1', level: 1, flags: { hq: false, factory: false, bunkerRing: false, govQuarter: false } },
        { label: 'L2 HQ', level: 2, flags: { hq: true, factory: false, bunkerRing: false, govQuarter: false } },
        { label: 'L3 factory', level: 3, flags: { hq: false, factory: true, bunkerRing: false, govQuarter: false } },
        { label: 'L4 bunker', level: 4, flags: { hq: false, factory: true, bunkerRing: true, govQuarter: false } },
        { label: 'L5 all', level: 5, flags: { hq: true, factory: true, bunkerRing: true, govQuarter: true } },
        { label: 'L8 all', level: 8, flags: { hq: true, factory: true, bunkerRing: true, govQuarter: true } },
      ];
      return {
        cols: variants.map((v) => v.label),
        rows: withNeutral.map((f) => ({
          label: fname(f),
          cells: variants.map((v) => ({ geo: cityGeometry(f, v.level, v.flags), ground: f ? factionTokens[f].terrain : plainGround })),
        })),
      };
    }
    case 'nature': {
      const deco = (t: TerrainId, r: ResourceId | null, g: string): Row => ({
        label: `${t}${r ? '+' + r : ''}`,
        cells: [0, 1, 2, 3].map((v) => ({ geo: decorationGeometry(t, r, v), ground: g })),
      });
      return {
        cols: ['v0', 'v1', 'v2', 'v3'],
        rows: [
          deco('forest', null, semantic.terrainForest),
          deco('mountain', null, semantic.terrainMountain),
          deco('mountain', 'ore', semantic.terrainMountain),
          deco('plain', 'farmland', plainGround),
          deco('plain', 'livestock', plainGround),
          deco('plain', 'supplies', plainGround),
          deco('forest', 'supplies', semantic.terrainForest),
          deco('shallow', 'fish', waterGround),
          { label: 'features', cells: [{ geo: featureGeometry('bunker'), ground: plainGround }, { geo: featureGeometry('radar'), ground: plainGround }, { geo: null, ground: null }, { geo: null, ground: null }] },
          { label: 'clouds', cells: [0, 1, 2, 3].map((v) => ({ geo: cloudGeometry(v), ground: plainGround })) },
        ],
      };
    }
    default:
      return {
        cols: factions.map(fname),
        rows: LAND.map((t) => ({ label: t, cells: factions.map((f) => ({ geo: unitGeometry(t, f, null), ground: plainGround })) })),
      };
  }
}

// ---------- Szene / scene ----------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(semantic.worldBackground);

const gradient = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = THREE.NearestFilter;
gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

const toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
const outlineMat = new THREE.MeshBasicMaterial({ color: semantic.ink, side: THREE.BackSide });
outlineMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\ntransformed += normalize(normal) * 0.0075;',
  );
};

scene.add(new THREE.HemisphereLight(primitives.color.white, primitives.color.sky700, 1.6));
const sun = new THREE.DirectionalLight(primitives.color.white, 2.2);
sun.position.set(-3, 6, 4);
scene.add(sun);

function label(text: string, size = 0.11): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const font = `48px ${primitives.font.display}`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w;
  c.height = 64;
  ctx.font = font;
  ctx.fillStyle = primitives.color.paper50;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set((size * w) / 64, size, 1);
  return s;
}

const tris: Record<string, number> = {};
const boxes: Record<string, number[]> = {};
const content = new THREE.Group();
scene.add(content);

async function buildScene() {
  await document.fonts.load(`48px ${primitives.font.display}`).catch(() => undefined);
  const sh = sheet();
  const only = params.get('only');
  if (only) sh.rows = sh.rows.filter((r) => only.split(',').includes(r.label));
  const pitch = 1.2;
  // Im Iso-Blick liegen Spalten waagrecht und Zeilen senkrecht auf dem Bildschirm
  // In the iso view columns run horizontally and rows vertically on screen
  const iso = view === 'iso';
  const k = iso ? pitch / Math.SQRT2 : pitch;
  const at = (ci: number, ri: number): [number, number] => (iso ? [(ci + ri) * k, (ri - ci) * k] : [ci * k, ri * k]);
  sh.rows.forEach((row, ri) => {
    const lab = label(row.label);
    const [lx, lz] = at(-0.85, ri);
    lab.position.set(lx, 0.1, lz);
    lab.center.set(1, 0.5);
    content.add(lab);
    row.cells.forEach((cell, ci) => {
      const [x, z] = at(ci, ri);
      if (cell.ground) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1), new THREE.MeshToonMaterial({ color: cell.ground, gradientMap: gradient }));
        g.position.set(x, -0.04, z);
        content.add(g);
      }
      if (!cell.geo) return;
      const m = new THREE.Mesh(cell.geo, toon);
      m.position.set(x, 0, z);
      const o = new THREE.Mesh(outlineGeometry(cell.geo), outlineMat);
      m.add(o);
      content.add(m);
      tris[`${row.label}|${sh.cols[ci]}`] = cell.geo.attributes.position.count / 3;
      const bb = cell.geo.boundingBox!;
      boxes[`${row.label}|${sh.cols[ci]}`] = [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map((v) => Math.round(v * 100) / 100);
    });
  });
  sh.cols.forEach((c, ci) => {
    const l = label(c);
    const [x, z] = at(ci, -0.75);
    l.position.set(x, 0.1, z);
    content.add(l);
  });
}

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);

function fit() {
  const box = new THREE.Box3().setFromObject(content);
  const centre = box.getCenter(new THREE.Vector3());
  const dir = view === 'top' ? new THREE.Vector3(0, 1, 0.0001) : view === 'front' ? new THREE.Vector3(0, 0.35, 1) : new THREE.Vector3(1, 1.15, 1);
  camera.position.copy(centre).addScaledVector(dir.normalize(), 50);
  camera.lookAt(centre);
  camera.updateMatrixWorld();
  const inv = camera.matrixWorldInverse;
  const pts: THREE.Vector3[] = [];
  for (const child of content.children) {
    const b = new THREE.Box3().setFromObject(child);
    for (let i = 0; i < 8; i++) {
      pts.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(inv));
    }
  }
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  let w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const aspect = window.innerWidth / window.innerHeight;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  const m = 1.04;
  camera.left = (-w / 2) * m;
  camera.right = (w / 2) * m;
  camera.top = (h / 2) * m;
  camera.bottom = (-h / 2) * m;
  camera.zoom = Number(params.get('zoom') ?? 1);
  camera.updateProjectionMatrix();
  controls.target.copy(centre);
  controls.update();
}

function render() {
  renderer.render(scene, camera);
}
controls.addEventListener('change', render);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  fit();
  render();
});

/** Pruefung aller API-Kombinationen (?check=1) / check of all API combinations */
function checkAll(): string[] {
  const errors: string[] = [];
  const all: [string, THREE.BufferGeometry | null][] = [];
  const units: UnitTypeId[] = [...LAND, ...SHIPS];
  for (const f of FACTION_IDS) {
    for (const t of units) for (const c of [null, ...LAND]) all.push([`unit ${t} ${f} ${c}`, unitGeometry(t, f, c)]);
  }
  for (const f of withNeutral) {
    for (const k of [...BUILDINGS, ...GRAND_PROJECT_IDS]) all.push([`building ${k} ${f}`, buildingGeometry(k, f)]);
    for (let lv = 1; lv <= 9; lv++) for (let m = 0; m < 16; m++) {
      all.push([`city ${f} ${lv} ${m}`, cityGeometry(f, lv, { hq: !!(m & 1), factory: !!(m & 2), bunkerRing: !!(m & 4), govQuarter: !!(m & 8) })]);
    }
  }
  all.push(['bunker', featureGeometry('bunker')], ['radar', featureGeometry('radar')]);
  const terrains: TerrainId[] = ['plain', 'forest', 'mountain', 'shallow', 'ocean'];
  const res: (ResourceId | null)[] = [null, 'supplies', 'livestock', 'fish', 'farmland', 'ore'];
  for (const t of terrains) for (const r of res) for (let v = -2; v < 6; v++) all.push([`deco ${t} ${r} ${v}`, decorationGeometry(t, r, v)]);
  for (let v = 0; v < 6; v++) all.push([`cloud ${v}`, cloudGeometry(v)]);
  for (const [name, g] of all) {
    if (!g) continue;
    if (g.index) errors.push(`${name}: indexed`);
    for (const a of ['position', 'normal', 'color']) if (!g.getAttribute(a)) errors.push(`${name}: missing ${a}`);
    const n = g.getAttribute('normal').array as Float32Array;
    for (let i = 0; i < n.length; i++) if (!Number.isFinite(n[i])) { errors.push(`${name}: NaN normal`); break; }
    const tri = g.getAttribute('position').count / 3;
    const limit = name.startsWith('unit') ? 1600 : 3000;
    if (tri > limit) errors.push(`${name}: ${tri} triangles`);
  }
  errors.push(`checked ${all.length}`);
  return errors;
}

buildScene().then(() => {
  if (params.get('check')) (window as unknown as { __check: string[] }).__check = checkAll();
  fit();
  render();
  const w = window as unknown as { __tris: Record<string, number>; __boxes: Record<string, number[]>; __ready: boolean };
  w.__tris = tris;
  w.__boxes = boxes;
  w.__ready = true;
});
