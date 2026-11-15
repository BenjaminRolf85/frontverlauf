/**
 * Heimatwelt der Zyrr (Kartenthema 'alien', nur Darstellung): schwebende Felsen ueber den Kartenraendern und ueber
 * einigen Kristalltuermen, dazu Fremdtiere statt Fischen und Rindern (Quallen, sechsbeinige Grasfresser, Leuchtinsekten).
 * Alles instanziert, feste Obergrenzen, keine Allokationen pro Bild; ohne Animationen steht alles still.
 * Zyrr homeworld (map theme 'alien', render only): floating rocks above the map edges and above some crystal spires,
 * plus alien critters instead of fish and cattle (jellies, six-legged grazers, glowing insects).
 * Everything instanced, fixed caps, no per-frame allocations; without animations everything stands still.
 */
import * as THREE from 'three';
import { hex, semantic } from '../design/tokens';
import type { GameState, Tile } from '../core';
import { ATMO, patchAtmosphere, withGlow } from './atmosphere';
import { OUTLINE } from './config';
import { glowColor } from './post';
import { outlinedInstanced, toonMaterial } from './toon';
import { memo } from './models/kit';
import { alienGrazer, alienInsect, alienJelly, alienPlant, crystalSpire, floatingRock } from './models/alienFlora';

/** Obergrenzen / caps */
export const ALIEN_CAPS = { rocks: 34, peakRocks: 8, grazers: 12, jellies: 9, insects: 42 };

// ---------- Geometrien (gecacht) / geometries (cached) ----------

export const alienPlantGeometry = (v: number) => memo(`alienPlant|${((v % 4) + 4) % 4}`, () => alienPlant(v).build());
export const crystalSpireGeometry = (v: number) => memo(`crystalSpire|${((v % 3) + 3) % 3}`, () => crystalSpire(v).build());
const rockGeometry = (v: number) => memo(`floatingRock|${((v % 3) + 3) % 3}`, () => floatingRock(v).build());
const jellyGeometry = () => memo('alienJelly', () => alienJelly().build());
const grazerGeometry = () => memo('alienGrazer', () => alienGrazer().build());
const insectGeometry = () => memo('alienInsect', () => alienInsect().build());

/**
 * Kopie einer Geometrie, Vertexfarben zu einer Token-Farbe hin gemischt (gecacht unter key).
 * Copy of a geometry with its vertex colours mixed towards a token colour (cached under key).
 */
export function alienTint(src: THREE.BufferGeometry, key: string, color: string, amount: number): THREE.BufferGeometry {
  return memo(`alienTint|${key}|${color}|${amount}`, () => {
    const g = src.clone();
    const c = g.getAttribute('color');
    const tint = new THREE.Color(hex(color));
    const tmp = new THREE.Color();
    for (let i = 0; i < c.count; i++) { tmp.setRGB(c.getX(i), c.getY(i), c.getZ(i)).lerp(tint, amount); c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
    // die Leuchtmaske wird fuer die neuen Farben neu berechnet / the glow mask is recomputed for the new colours
    g.deleteAttribute('glow');
    delete g.userData.glowTag;
    return g;
  });
}
/** Wolken des Kriegsnebels in Fliederrosa / fog-of-war clouds in lilac pink */
export const alienCloud = (src: THREE.BufferGeometry, v: number) => alienTint(src, `cloud${v}`, semantic.alienMoonShade, 0.38);

// ---------- Schweben (Shader) / floating (shader) ----------

/** Langsames Heben, Senken und Drehen je Instanz / slow rise, fall and turn per instance */
const FLOAT_GLSL = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 floatBase = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
    vec3 floatBase = vec3(0.0);
  #endif
  float floatPh = floatBase.x * 1.7 + floatBase.z * 0.9;
  float floatA = sin(uTime * 0.17 + floatPh) * 0.35;
  float floatC = cos(floatA), floatS = sin(floatA);
  transformed.xz = vec2(floatC * transformed.x - floatS * transformed.z, floatS * transformed.x + floatC * transformed.z);
  transformed.y += sin(uTime * 0.55 + floatPh * 1.3) * 0.07;
`;

let floatMat: THREE.MeshToonMaterial | null = null;
function floatMaterial(): THREE.MeshToonMaterial {
  if (floatMat) return floatMat;
  const m = toonMaterial().clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = ATMO.uTime;
    patchAtmosphere(shader, FLOAT_GLSL, 'uniform float uTime;\n');
  };
  m.customProgramCacheKey = () => 'atmo-float';
  floatMat = m;
  return m;
}
let floatLine: THREE.ShaderMaterial | null = null;
function floatOutline(width: number): THREE.ShaderMaterial {
  if (floatLine) return floatLine;
  floatLine = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: width }, uColor: { value: new THREE.Color(hex(semantic.ink)) }, uTime: ATMO.uTime },
    vertexShader: /* glsl */ `
      uniform float uWidth; uniform float uTime;
      void main() {
        vec3 transformed = position + normal * uWidth;
        ${FLOAT_GLSL}
        vec4 p = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }',
    side: THREE.BackSide,
  });
  return floatLine;
}

// ---------- Fremdtiere / critters ----------

/** Deterministischer Wert 0..1 aus zwei Zahlen / deterministic value 0..1 from two numbers */
const hash = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

interface Spot { x: number; y: number; z: number; ph: number }

export interface AlienInput {
  s: GameState;
  explored: (x: number, y: number) => boolean;
  top: (t: Tile) => number;
  /** belegte Felder (Einheiten) / occupied tiles (units) */
  occupied: Set<number>;
}

export class AlienWorldFx {
  readonly group = new THREE.Group();
  private grazers: Spot[] = [];
  private jellies: Spot[] = [];
  private insects: Spot[] = [];
  private meshes: { grazer?: THREE.InstancedMesh[]; jelly?: THREE.InstancedMesh[]; insect?: THREE.InstancedMesh } = {};
  private tmp = new THREE.Object3D();
  /** einmal gebautes Insekten-Material / insect material built once */
  private insectMat: THREE.MeshBasicMaterial | null = null;
  active = false;

  clear() {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
    }
    this.grazers = []; this.jellies = []; this.insects = [];
    this.meshes = {};
    this.active = false;
  }

  /** Neu aufbauen (bei jedem Neuaufbau der statischen Ebene) / rebuild (with every static rebuild) */
  build(inp: AlienInput) {
    this.clear();
    this.active = true;
    const { s, explored, top, occupied } = inp;
    const size = s.size, off = (size - 1) / 2;
    // --- schwebende Felsen am Rand und ueber Kristalltuermen / floating rocks at the edge and above crystal spires ---
    const rocks: THREE.Matrix4[][] = [[], [], []];
    const n = Math.min(ALIEN_CAPS.rocks, Math.round(size * 1.9));
    for (let i = 0; i < n; i++) {
      const side = i % 4, k = Math.floor(i / 4), per = Math.ceil(n / 4);
      const along = -off - 1 + ((k + 0.5 + (hash(i, 3) - 0.5) * 0.6) / per) * (size + 2);
      const out = off + 1.4 + hash(i, 7) * 2.2;
      const [x, z] = side === 0 ? [along, -out] : side === 1 ? [out, along] : side === 2 ? [-along, out] : [-out, -along];
      const sc = 0.65 + hash(i, 11) * 0.9;
      rocks[i % 3].push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.7 + hash(i, 5) * 1.5, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 13) * 6.28), new THREE.Vector3(sc, sc, sc)));
    }
    let peaks = 0;
    for (let y = 0; y < size && peaks < ALIEN_CAPS.peakRocks; y++) for (let x = 0; x < size && peaks < ALIEN_CAPS.peakRocks; x++) {
      const t = s.tiles[y * size + x];
      if (t.terrain !== 'mountain' || !explored(x, y) || hash(x, y) > 0.4) continue;
      peaks++;
      const sc = 0.38 + hash(y, x) * 0.2;
      rocks[(x + y) % 3].push(new THREE.Matrix4().compose(new THREE.Vector3(x - off + 0.1, top(t) + 1.05 + hash(x + 3, y) * 0.35, y - off - 0.1),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(x, y + 9) * 6.28), new THREE.Vector3(sc, sc, sc)));
    }
    rocks.forEach((list, v) => {
      if (!list.length) return;
      const { mesh, line } = outlinedInstanced(withGlow(rockGeometry(v), 'nature'), list.length, OUTLINE.building, floatMaterial(), floatOutline(OUTLINE.building));
      list.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false; line.frustumCulled = false;
      mesh.raycast = () => {}; line.raycast = () => {};
      mesh.castShadow = true;
      this.group.add(mesh, line);
    });
    // --- Fremdtiere: feste Plaetze aus dem Kartenbild / critters: fixed spots from the map ---
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const k = y * size + x;
      const t = s.tiles[k];
      if (!explored(x, y)) continue;
      const h = hash(x + 17, y + 31);
      const p = { x: x - off, y: top(t), z: y - off, ph: h * 40 };
      const land = t.terrain !== 'shallow' && t.terrain !== 'ocean';
      const free = !occupied.has(k) && t.cityId === null && !t.building;
      if (land && free && t.terrain === 'plain' && (t.resource === 'livestock' || h < 0.12) && this.grazers.length < ALIEN_CAPS.grazers) this.grazers.push(p);
      // Quallen wie Grasfresser nur ueber freien Feldern (nicht auf Einheiten oder Staedten) / jellies like grazers only above free tiles (not on units or cities)
      if (free && h > 0.9 && this.jellies.length < ALIEN_CAPS.jellies) this.jellies.push(p);
      if (land && t.terrain === 'forest' && this.insects.length < ALIEN_CAPS.insects) for (let i = 0; i < 2; i++) this.insects.push({ ...p, ph: p.ph + i * 3.1 });
    }
    const add = (geo: THREE.BufferGeometry, count: number): THREE.InstancedMesh[] => {
      if (!count) return [];
      const { mesh, line } = outlinedInstanced(geo, count, OUTLINE.unit * 0.7, toonMaterial());
      for (const m of [mesh, line]) { m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 4; this.group.add(m); }
      return [mesh, line];
    };
    this.meshes.grazer = add(grazerGeometry(), this.grazers.length);
    this.meshes.jelly = add(jellyGeometry(), this.jellies.length);
    if (this.insects.length) {
      // Insekten leuchten im Bloom / insects glow in the bloom
      const mat = this.insectMat ??= new THREE.MeshBasicMaterial({ vertexColors: true, color: glowColor(hex(semantic.white), 1.8) });
      const m = new THREE.InstancedMesh(insectGeometry(), mat, this.insects.length);
      m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 4;
      this.meshes.insect = m;
      this.group.add(m);
    }
    this.update(0);
  }

  /** Zeit in Sekunden / time in seconds */
  update(time: number) {
    if (!this.active) return;
    const o = this.tmp;
    // Grasfresser: alle paar Sekunden ein Hopser im Kreis um ihren Platz / grazers: every few seconds a hop around their spot
    const g = this.meshes.grazer;
    if (g?.length) {
      this.grazers.forEach((p, i) => {
        const period = 2.2 + (i % 3) * 0.4;
        const t = (time + p.ph) / period;
        const hop = Math.floor(t), f = t - hop;
        const a0 = hop * 1.3 + p.ph, a1 = (hop + 1) * 1.3 + p.ph;
        const k = Math.min(1, f / 0.3);
        const a = a0 + (a1 - a0) * k;
        o.position.set(p.x + Math.cos(a) * 0.2, p.y + Math.sin(k * Math.PI) * 0.08, p.z + Math.sin(a) * 0.2);
        o.rotation.set(0, -a + (k < 1 ? 0 : 0), 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        for (const m of g) m.setMatrixAt(i, o.matrix);
      });
      for (const m of g) m.instanceMatrix.needsUpdate = true;
    }
    // Quallen: schweben im Kreis, pulsieren / jellies: float in a circle, pulse
    const j = this.meshes.jelly;
    if (j?.length) {
      this.jellies.forEach((p, i) => {
        const a = time * 0.25 + p.ph;
        const pulse = 1 + Math.sin(time * 2.4 + p.ph) * 0.08;
        o.position.set(p.x + Math.cos(a) * 0.3, p.y + 0.5 + Math.sin(time * 0.8 + p.ph) * 0.08, p.z + Math.sin(a) * 0.3);
        o.rotation.set(0, a, 0);
        o.scale.set(pulse, 2 - pulse, pulse);
        o.updateMatrix();
        for (const m of j) m.setMatrixAt(i, o.matrix);
      });
      for (const m of j) m.instanceMatrix.needsUpdate = true;
    }
    // Leuchtinsekten: Achterbahnen um die Pflanzen / glowing insects: figure eights around the plants
    const ins = this.meshes.insect;
    if (ins) {
      this.insects.forEach((p, i) => {
        const t = time * (1.1 + (i % 4) * 0.15) + p.ph;
        o.position.set(p.x + Math.sin(t) * 0.28, p.y + 0.38 + Math.sin(t * 2.3) * 0.12, p.z + Math.sin(t * 2) * 0.16);
        o.rotation.set(0, t, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        ins.setMatrixAt(i, o.matrix);
      });
      ins.instanceMatrix.needsUpdate = true;
    }
  }
}
