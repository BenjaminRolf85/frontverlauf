/**
 * Lebendige Karte: Pflanzen wiegen sich (Shader, bei Wind staerker), Fische schwimmen und springen.
 * Die Brandung an der Kueste zeichnet jetzt der Wasser-Shader (water.ts).
 * Living map: plants sway (shader, stronger in wind), fish swim and jump.
 * The surf at the coast is now drawn by the water shader (water.ts).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hex, semantic } from '../design/tokens';
import { toonMaterial } from './toon';
import { paint } from './toon';
import { patchAtmosphere } from './atmosphere';

/** Gemeinsame Uniforms fuer das Wiegen / shared uniforms for swaying */
export const SWAY = { uTime: { value: 0 }, uWind: { value: 0 } };

const SWAY_GLSL = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 swayBase = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
    vec3 swayBase = vec3(0.0);
  #endif
  float swayH = max(transformed.y, 0.0);
  float swayPh = swayBase.x * 1.7 + swayBase.z * 2.3;
  float swayAmp = (0.03 + uWind * 0.1) * swayH * swayH * 4.0;
  float swayW = sin(uTime * (1.2 + uWind * 1.6) + swayPh) * swayAmp
              + sin(uTime * 7.0 + swayPh * 3.0) * 0.012 * uWind * swayH;
  transformed.x += swayW;
  transformed.z += swayW * 0.45;
`;

let swayToon: THREE.MeshToonMaterial | null = null;
/** Toon-Material mit Wiegen / toon material with sway */
export function swayMaterial(): THREE.MeshToonMaterial {
  if (swayToon) return swayToon;
  const m = toonMaterial().clone();
  // Wiegen plus Leuchten und Dunst (Geometrie braucht 'glow', siehe withGlow)
  // sway plus glow and haze (geometry needs 'glow', see withGlow)
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SWAY.uTime;
    shader.uniforms.uWind = SWAY.uWind;
    patchAtmosphere(shader, SWAY_GLSL, 'uniform float uTime;\nuniform float uWind;\n');
  };
  m.customProgramCacheKey = () => 'sway-toon-atmo';
  swayToon = m;
  return m;
}

const swayLines = new Map<number, THREE.ShaderMaterial>();
/** Kontur mit demselben Wiegen / outline with the same sway */
export function swayOutline(width: number): THREE.ShaderMaterial {
  let m = swayLines.get(width);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: width }, uColor: { value: new THREE.Color(hex(semantic.ink)) }, uTime: SWAY.uTime, uWind: SWAY.uWind },
    vertexShader: /* glsl */ `
      uniform float uWidth; uniform float uTime; uniform float uWind;
      void main() {
        vec3 transformed = position;
        ${SWAY_GLSL}
        vec4 p = vec4(transformed + normal * uWidth, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }',
    side: THREE.BackSide,
  });
  swayLines.set(width, m);
  return m;
}

// ---------- Fische und Kueste / fish and coast ----------

function fishGeometry(): THREE.BufferGeometry {
  const body = new THREE.ConeGeometry(0.045, 0.16, 6).rotateX(Math.PI / 2).toNonIndexed();
  const tail = new THREE.ConeGeometry(0.04, 0.06, 3).rotateX(-Math.PI / 2).translate(0, 0, -0.1).toNonIndexed();
  body.deleteAttribute('uv'); tail.deleteAttribute('uv');
  return mergeGeometries([paint(body, semantic.warning), paint(tail, semantic.fire)])!;
}

interface Fish { x: number; z: number; y: number; phase: number; period: number; r: number }

export class AmbientFx {
  readonly group = new THREE.Group();
  private fish: Fish[] = [];
  private jumpers: THREE.InstancedMesh | null = null;
  private shadows: THREE.InstancedMesh | null = null;
  private splashes: THREE.InstancedMesh | null = null;
  private tmp = new THREE.Object3D();

  /** tiles: Liste der Fischfelder in Brettkoordinaten / fish tiles in board coords */
  build(fishTiles: { x: number; z: number; y: number }[]) {
    for (const m of [this.jumpers, this.shadows, this.splashes]) if (m) { this.group.remove(m); m.dispose(); }
    this.fish = [];
    fishTiles.forEach((t, i) => {
      for (let k = 0; k < 2; k++) {
        this.fish.push({ x: t.x, z: t.z, y: t.y, phase: (i * 1.37 + k * 2.9) % 7, period: 4.5 + ((i * 3 + k * 5) % 4) * 0.8, r: 0.18 + k * 0.08 });
      }
    });
    const n = Math.max(1, this.fish.length);
    this.jumpers = new THREE.InstancedMesh(fishGeometry(), toonMaterial(), n);
    const shadowMat = new THREE.MeshBasicMaterial({ color: hex(semantic.terrainDeep), transparent: true, opacity: 0.55, depthWrite: false });
    this.shadows = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 8).scale(0.6, 1.6, 1).rotateX(-Math.PI / 2), shadowMat, n);
    const ringMat = new THREE.MeshBasicMaterial({ color: hex(semantic.white), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this.splashes = new THREE.InstancedMesh(new THREE.RingGeometry(0.05, 0.075, 14).rotateX(-Math.PI / 2), ringMat, n);
    for (const m of [this.jumpers, this.shadows, this.splashes]) {
      m.raycast = () => {};
      m.frustumCulled = false;
      m.renderOrder = 4;
      this.group.add(m);
    }
    this.jumpers.count = this.shadows.count = this.splashes.count = this.fish.length;
    this.update(0);
  }

  /** time in Sekunden / time in seconds */
  update(time: number) {
    if (!this.jumpers || !this.shadows || !this.splashes) return;
    const o = this.tmp;
    this.fish.forEach((f, i) => {
      const t = (time + f.phase) % f.period;
      const ang = (time * 0.6 + f.phase) * (i % 2 ? 1 : -1);
      const sx = f.x + Math.cos(ang) * f.r, sz = f.z + Math.sin(ang) * f.r;
      const jumpDur = 0.9;
      // Schatten unter Wasser / shadow under water
      o.position.set(sx, f.y + 0.004, sz);
      o.rotation.set(0, -ang + (i % 2 ? 0 : Math.PI), 0);
      o.scale.setScalar(t < jumpDur ? 0.001 : 1);
      o.updateMatrix();
      this.shadows!.setMatrixAt(i, o.matrix);
      // Sprung im Bogen / jump in an arc
      if (t < jumpDur) {
        const k = t / jumpDur;
        const dir = -ang + (i % 2 ? 0 : Math.PI);
        const dx = Math.sin(dir) * 0.32, dz = Math.cos(dir) * 0.32;
        o.position.set(sx + dx * (k - 0.5), f.y + Math.sin(k * Math.PI) * 0.3, sz + dz * (k - 0.5));
        o.rotation.set(-Math.cos(k * Math.PI) * 1.1, dir, 0, 'YXZ');
        o.scale.setScalar(1);
      } else o.scale.setScalar(0.001);
      o.updateMatrix();
      this.jumpers!.setMatrixAt(i, o.matrix);
      // Spritzring nach dem Eintauchen / splash ring after diving in
      const after = t - jumpDur;
      o.rotation.set(0, 0, 0);
      if (after >= 0 && after < 0.6) {
        const dir = -ang + (i % 2 ? 0 : Math.PI);
        o.position.set(sx + Math.sin(dir) * 0.16, f.y + 0.006, sz + Math.cos(dir) * 0.16);
        o.scale.setScalar(1 + after * 4);
      } else o.scale.setScalar(0.001);
      o.updateMatrix();
      this.splashes!.setMatrixAt(i, o.matrix);
    });
    for (const m of [this.jumpers, this.shadows, this.splashes]) m.instanceMatrix.needsUpdate = true;
  }
}
