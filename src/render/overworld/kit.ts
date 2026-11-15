/**
 * Werkzeuge des Oberwelt-Renderers: eigene Toon- und Konturmaterialien (nicht die geteilten Caches des Bretts,
 * damit beim Schliessen alles freigegeben werden kann), Leuchtfarben fuer den Bloom und eine Zeit-Uniform.
 * Toolkit of the overworld renderer: own toon and outline materials (not the board's shared caches, so everything can
 * be released on close), glow colours for the bloom and a time uniform.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hex, semantic } from '../../design/tokens';

/** Gemeinsame Zeit fuer alle Shader der Oberwelt (Sekunden) / shared time for all overworld shaders (seconds) */
export interface Clock { uTime: { value: number } }

/** Deterministischer Zufall (mulberry32) / deterministic random */
export function rand(seed: number): () => number {
  let a = (seed | 0) ^ 0x2f6b9e31;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weiches Rauschen 0..1 in der Ebene (Summe von Sinuswellen, billig und glatt) / smooth 0..1 noise in the plane */
export function wave(x: number, z: number, seed: number): number {
  const s = seed * 0.37;
  const v = Math.sin(x * 1.7 + s) * Math.cos(z * 1.3 - s * 1.7) + Math.sin((x + z) * 2.9 + s * 2.3) * 0.5 + Math.cos((x - z) * 4.1 - s) * 0.25;
  return v / 3.5 + 0.5;
}

export class Look {
  readonly toon: THREE.MeshToonMaterial;
  readonly gradient: THREE.DataTexture;
  private lines = new Map<string, THREE.ShaderMaterial>();
  private glows = new Map<string, THREE.MeshBasicMaterial>();
  private flats = new Map<string, THREE.MeshToonMaterial>();

  constructor(readonly clock: Clock) {
    // drei harte Stufen wie auf dem Brett / three hard steps like on the board
    const steps = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    this.gradient = new THREE.DataTexture(steps, 3, 1, THREE.RGBAFormat);
    this.gradient.minFilter = THREE.NearestFilter;
    this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.generateMipmaps = false;
    this.gradient.needsUpdate = true;
    this.toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.gradient });
  }

  /** Alle eigenen Materialien und die Stufentextur freigeben / release all own materials and the step texture */
  dispose() {
    for (const m of [this.toon, ...this.lines.values(), ...this.glows.values(), ...this.flats.values()]) m.dispose();
    this.gradient.dispose();
    this.lines.clear(); this.glows.clear(); this.flats.clear();
  }

  /** Toon-Material mit fester Farbe (fuer Schleier und Sondermaterialien) / toon material with a fixed colour */
  flat(color: string, opts: { transparent?: boolean; opacity?: number; vertex?: boolean } = {}): THREE.MeshToonMaterial {
    const key = `${color}-${opts.transparent ? 1 : 0}-${opts.opacity ?? 1}-${opts.vertex ? 1 : 0}`;
    let m = this.flats.get(key);
    if (!m) {
      m = new THREE.MeshToonMaterial({
        color: hex(color), gradientMap: this.gradient, vertexColors: !!opts.vertex,
        transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: !opts.transparent,
      });
      this.flats.set(key, m);
    }
    return m;
  }

  /** Tuschekontur (Inverted Hull), Breite in Objektkoordinaten / ink outline (inverted hull), width in object space */
  outline(width: number, color: string = semantic.ink): THREE.ShaderMaterial {
    const key = `${width}-${color}`;
    let m = this.lines.get(key);
    if (m) return m;
    m = new THREE.ShaderMaterial({
      uniforms: { uWidth: { value: width }, uColor: { value: new THREE.Color(hex(color)) } },
      vertexShader: /* glsl */ `
        uniform float uWidth;
        void main() {
          vec4 p = vec4(position + normal * uWidth, 1.0);
          #ifdef USE_INSTANCING
            p = instanceMatrix * p;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * p;
        }`,
      fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }',
      side: THREE.BackSide,
    });
    this.lines.set(key, m);
    return m;
  }

  /** Unbeleuchtete Leuchtfarbe, ueber 1 skaliert fuer den Bloom / unlit glow colour scaled above 1 for the bloom */
  glow(color: string, strength = 2, opts: { transparent?: boolean; opacity?: number; additive?: boolean } = {}): THREE.MeshBasicMaterial {
    const key = `${color}-${strength}-${opts.transparent ? 1 : 0}-${opts.opacity ?? 1}-${opts.additive ? 1 : 0}`;
    let m = this.glows.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex(color)).multiplyScalar(strength), transparent: !!opts.transparent || !!opts.additive,
        opacity: opts.opacity ?? 1, depthWrite: !(opts.transparent || opts.additive), toneMapped: false,
        blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.glows.set(key, m);
    }
    return m;
  }

  /** Geometrie mit geglaetteten Normalen fuer die Kontur / geometry with smoothed normals for the outline */
  hull(g: THREE.BufferGeometry): THREE.BufferGeometry {
    const base = new THREE.BufferGeometry();
    base.setAttribute('position', g.getAttribute('position'));
    if (g.index) base.setIndex(g.index);
    const h = mergeVertices(base, 1e-4);
    h.computeVertexNormals();
    return h;
  }

  /** Mesh mit Kontur / mesh with outline */
  inked(g: THREE.BufferGeometry, width: number, material: THREE.Material = this.toon): THREE.Group {
    const grp = new THREE.Group();
    const mesh = new THREE.Mesh(g, material);
    grp.add(mesh);
    if (width > 0) {
      const line = new THREE.Mesh(this.hull(g), this.outline(width));
      line.raycast = () => {};
      grp.add(line);
    }
    mesh.raycast = () => {};
    return grp;
  }

  /** Instanziert mit Kontur; Matrizen in Weltkoordinaten der Gruppe / instanced with outline */
  instanced(g: THREE.BufferGeometry, mats: readonly THREE.Matrix4[], width: number, material: THREE.Material = this.toon): THREE.Group {
    const grp = new THREE.Group();
    if (!mats.length) { g.dispose(); return grp; }
    const mesh = new THREE.InstancedMesh(g, material, mats.length);
    const line = width > 0 ? new THREE.InstancedMesh(this.hull(g), this.outline(width), mats.length) : null;
    mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line?.setMatrixAt(i, m); });
    for (const m of line ? [mesh, line] : [mesh]) { m.raycast = () => {}; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); grp.add(m); }
    grp.userData.meshes = line ? [mesh, line] : [mesh];
    return grp;
  }
}

/** Instanz einer Gruppe aus Look.instanced neu setzen / reset an instance of a group from Look.instanced */
export function setInstance(grp: THREE.Group, i: number, m: THREE.Matrix4) {
  for (const x of (grp.userData.meshes ?? []) as THREE.InstancedMesh[]) x.setMatrixAt(i, m);
}
/** Geaenderte Instanzen hochladen (bewegte Instanzen: ohne Sichtbarkeitstest) / upload changed instances (moving: no culling) */
export function commitInstances(grp: THREE.Group) {
  for (const x of (grp.userData.meshes ?? []) as THREE.InstancedMesh[]) { x.instanceMatrix.needsUpdate = true; x.frustumCulled = false; }
}

/** Matrix aus Position, Drehung um y und Skalierung / matrix from position, rotation about y and scale */
export function place(x: number, y: number, z: number, ry = 0, s: number | THREE.Vector3 = 1): THREE.Matrix4 {
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : s;
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), sc);
}

/** Canvas-Textur (sRGB) / canvas texture (sRGB) */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Weicher runder Fleck (fuer Sterne, Dunst, Nebel) / soft round blob (for stars, haze, nebulae) */
export function softDot(color: string = semantic.white): THREE.CanvasTexture {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/**
 * Alles unter einem Knoten freigeben: Geometrien, Materialien und deren Texturen (auch in Uniforms).
 * Release everything below a node: geometries, materials and their textures (uniforms too).
 */
export function disposeTree(root: THREE.Object3D, extra: { textures?: THREE.Texture[]; materials?: THREE.Material[] } = {}) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>(extra.materials ?? []);
  const texs = new Set<THREE.Texture>(extra.textures ?? []);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) geos.add(m.geometry);
    const mm = m.material as THREE.Material | THREE.Material[] | undefined;
    if (mm) for (const x of Array.isArray(mm) ? mm : [mm]) mats.add(x);
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
  });
  for (const m of mats) {
    for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) texs.add(v as THREE.Texture);
    const u = (m as THREE.ShaderMaterial).uniforms;
    if (u) for (const x of Object.values(u)) if (x?.value && (x.value as THREE.Texture).isTexture) texs.add(x.value as THREE.Texture);
    m.dispose();
  }
  for (const g of geos) g.dispose();
  for (const t of texs) t.dispose();
}
