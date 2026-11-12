/**
 * Comic-Look: Toon-Shading mit harten Stufen und schwarze Tuschekonturen (Inverted Hull).
 * Comic look: stepped toon shading and black ink outlines (inverted hull).
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hex, semantic } from '../design/tokens';

let gradient: THREE.DataTexture | null = null;
function gradientMap(): THREE.DataTexture {
  if (gradient) return gradient;
  const steps = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(steps, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
export function toonMaterial(opts: { transparent?: boolean; opacity?: number } = {}): THREE.MeshToonMaterial {
  const key = `${opts.transparent ? 1 : 0}-${opts.opacity ?? 1}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(), transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
    toonCache.set(key, m);
  }
  return m;
}

export function flatToon(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: hex(color), gradientMap: gradientMap() });
}

const outlineMats = new Map<number, THREE.ShaderMaterial>();
/** Konturmaterial, Breite in Objektkoordinaten / outline material, width in object space */
export function outlineMaterial(width = 0.018): THREE.ShaderMaterial {
  let m = outlineMats.get(width);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: width }, uColor: { value: new THREE.Color(hex(semantic.ink)) } },
    vertexShader: /* glsl */ `
      uniform float uWidth;
      void main() {
        vec4 p = vec4(position + normal * uWidth, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
  outlineMats.set(width, m);
  return m;
}

const hullCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
/** Geometrie mit geglaetteten Normalen fuer die Kontur / geometry with smoothed normals for the outline */
export function hullGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let h = hullCache.get(g);
  if (h) return h;
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', g.getAttribute('position'));
  if (g.index) base.setIndex(g.index);
  h = mergeVertices(base, 1e-4);
  h.computeVertexNormals();
  hullCache.set(g, h);
  return h;
}

/** Mesh mit Kontur / mesh with outline */
export function outlined(g: THREE.BufferGeometry, width = 0.018, material: THREE.Material = toonMaterial()): THREE.Group {
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(g, material);
  const line = new THREE.Mesh(hullGeometry(g), outlineMaterial(width));
  line.raycast = () => {};
  grp.add(mesh, line);
  grp.userData.mesh = mesh;
  return grp;
}

/** Instanzierte Meshes mit Kontur / instanced meshes with outline */
export function outlinedInstanced(g: THREE.BufferGeometry, count: number, width = 0.018, material: THREE.Material = toonMaterial(), lineMaterial?: THREE.Material) {
  const mesh = new THREE.InstancedMesh(g, material, Math.max(1, count));
  const line = new THREE.InstancedMesh(hullGeometry(g), lineMaterial ?? outlineMaterial(width), Math.max(1, count));
  line.raycast = () => {};
  mesh.count = count; line.count = count;
  return { mesh, line };
}

/** Box mit Vertexfarben oben/seitlich / box with top and side vertex colours */
export function coloredBox(w: number, h: number, d: number, top: string, side: string): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const ct = new THREE.Color(hex(top)), cs = new THREE.Color(hex(side));
  for (let i = 0; i < pos.count; i++) {
    const c = nor.getY(i) > 0.5 ? ct : cs;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export function paint(g: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const c = new THREE.Color(hex(color));
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
