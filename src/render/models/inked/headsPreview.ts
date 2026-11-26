/**
 * Vorschau der Kopfbedeckungen (preview/heads.html): die Koepfe aller acht Fraktionen im selben Massstab, von vorn und
 * von der Seite, mit dem Aussenmass des Korvat-Helms als Bezugslinien. Prueft die Vorgabe "das muss einheitlich sein".
 * Headgear preview (preview/heads.html): the heads of all eight factions at the same scale, front and side, with the
 * outer size of the Korvat helmet as reference lines. Checks the owner's rule that sizes have to be uniform.
 * URL: ?hat=1 zeigt die Huete des Spions / shows the spy's hats; ?q=low niedrige Qualitaet / low quality.
 */
import '@fontsource/bangers';
import * as THREE from 'three';
import { FACTION_IDS, type FactionId } from '../../../data/balance';
import { primitives, semantic } from '../../../design/tokens';
import { unitOutlined } from '../../unitDraw';
import { withDetail } from '../kit';
import { look } from '../look';
import { bakeAO } from './ao';
import { atlasDef, flushAtlases } from './atlas';
import { factionHead, HEAD_SCALE, headSegments } from './figure';
import { headgearSize } from './heads';
import { defineAtlases } from './index';
import { subdivide, UvBuilder } from './uvkit';

const params = new URLSearchParams(location.search);
const hi = params.get('q') !== 'low';
const hat = params.get('hat') === '1';

/** Kopf einer Fraktion als gezeichnete Geometrie, Kinn bei y = 0 / one faction's head as an inked geometry, chin at y = 0 */
function headGeometry(f: FactionId): THREE.BufferGeometry {
  defineAtlases();
  const A = atlasDef('figure').layout;
  return withDetail(1.6, true, () => {
    const b = new UvBuilder(A.get('blank'));
    b.group({ s: HEAD_SCALE }, () => factionHead(b, A, f, look(f), 2, headSegments(2), hat, 1));
    const raw = b.build();
    const fill = hi ? subdivide(raw, 0.05) : raw.clone();
    // Verdeckung ohne Boden: der Kopf schwebt in der Vorschau / occlusion without the ground: the head floats in the preview
    fill.translate(0, 1, 0);
    bakeAO(fill, { voxel: 0.004, rays: 24, reach: 0.06 });
    fill.translate(0, -1, 0);
    const src = fill.getAttribute('fx') as THREE.BufferAttribute, ao = fill.getAttribute('ao') as THREE.BufferAttribute;
    const fx = new Float32Array(src.count * 2);
    for (let i = 0; i < src.count; i++) { fx[i * 2] = src.getX(i); fx[i * 2 + 1] = ao.getX(i); }
    fill.setAttribute('fx', new THREE.BufferAttribute(fx, 2));
    fill.deleteAttribute('ao');
    fill.userData = { inked: { atlas: 'figure', creases: hi }, inkSrc: raw, finishScale: 1 };
    fill.computeBoundingBox();
    fill.computeBoundingSphere();
    return fill;
  }, { smooth: true, fine: hi });
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Number(params.get('dpr') ?? window.devicePixelRatio));
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(semantic.worldBackground);
scene.add(new THREE.HemisphereLight(primitives.color.white, primitives.color.sky700, 1.6));
const sun = new THREE.DirectionalLight(primitives.color.white, 2.2);
sun.position.set(-3, 6, 4);
scene.add(sun);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
const content = new THREE.Group();
scene.add(content);

function label(text: string, size: number): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const font = `44px ${primitives.font.display}`;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(text).width) + 24;
  c.height = 60;
  ctx.font = font;
  ctx.fillStyle = primitives.color.paper50;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set((size * c.width) / 60, size, 1);
  return s;
}

const PITCH_X = 0.23, PITCH_Y = 0.33;
function build(): void {
  content.clear();
  const cols = window.innerWidth < window.innerHeight ? 4 : 8;
  const rows = Math.ceil(FACTION_IDS.length / cols);
  const ref = headgearSize('korvat', look('korvat'));
  const line = new THREE.LineBasicMaterial({ color: primitives.color.paper50, transparent: true, opacity: 0.55 });
  const pts: number[] = [];
  FACTION_IDS.forEach((f, i) => {
    const size = headgearSize(f, look(f));
    const g = headGeometry(f);
    for (const side of [0, 1]) {
      const x = (i % cols) * PITCH_X, y = -(Math.floor(i / cols) + side * rows) * PITCH_Y;
      const m = unitOutlined(g, 0.0075);
      m.position.set(x, y, 0);
      // Seitenansicht: der Kopf blickt nach links / side view: the head looks to the left
      if (side) m.rotation.y = -Math.PI / 2;
      content.add(m);
      // Bezug: Scheitelhoehe und Breite der Korvat-Kuppel / reference: crown height and width of the Korvat dome
      const top = y + ref.h * HEAD_SCALE, hw = (ref.w * HEAD_SCALE) / 2;
      pts.push(x - 0.1, top, 0.2, x + 0.1, top, 0.2, x - 0.1, y, 0.2, x + 0.1, y, 0.2);
      if (!side) for (const s of [-1, 1]) pts.push(x + s * hw, y - 0.012, 0.2, x + s * hw, top + 0.012, 0.2);
      if (!side) {
        const l = label(`${f}  ${Math.round((size.w / ref.w) * 100)} x ${Math.round((size.h / ref.h) * 100)} %`, 0.02);
        l.position.set(x, y - 0.035, 0.3);
        content.add(l);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  content.add(new THREE.LineSegments(geo, line));
}

function fit(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  const box = new THREE.Box3().setFromObject(content);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const aspect = window.innerWidth / window.innerHeight;
  let w = s.x * 1.08, h = s.y * 1.22;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2;
  camera.position.set(c.x, c.y + s.y * 0.05, 10);
  camera.lookAt(c.x, c.y + s.y * 0.05, 0);
  camera.updateProjectionMatrix();
}
const render = () => renderer.render(scene, camera);

document.fonts.load(`44px ${primitives.font.display}`).catch(() => undefined).then(() => {
  build();
  fit();
  render();
  flushAtlases();
  render();
  (window as unknown as { __ready: boolean }).__ready = true;
});
window.addEventListener('resize', () => { build(); fit(); render(); });
