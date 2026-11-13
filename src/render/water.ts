/**
 * Wasser im Comic-Stil: eine durchgehende Oberflaeche ueber allen sichtbaren Wasserfeldern mit sanften Wellen,
 * gestuften Farbbaendern (Kueste tuerkis, Tiefe dunkelblau), Glitzern und Schaumkronen an der Kueste.
 * Comic-style water: one continuous surface over all visible water tiles with gentle waves,
 * stepped colour bands (turquoise coast, dark blue depth), glints and foam crests at the coast.
 */
import * as THREE from 'three';
import type { GameState } from '../core';
import { hex, semantic } from '../design/tokens';
import { TILE_BOTTOM, TILE_TOP } from './config';
import { ATMO, HAZE_GLSL } from './atmosphere';

/** Wasserkaesten liegen so tief unter der Oberflaeche / water boxes sit this far below the surface */
export const WATER_BOX_TOP = TILE_TOP.ocean - 0.035;
/** Oberflaeche liegt knapp unter der Feldoberkante (Fischschatten, Ringe bleiben sichtbar) / surface just below tile top */
const SURFACE_DROP = 0.008;
/** Hoehe am Ufer / height at the shore */
const SHORE_H = TILE_TOP.shallow;

const isWater = (terrain: string) => terrain === 'shallow' || terrain === 'ocean';

let material: THREE.ShaderMaterial | null = null;
/** Gemeinsames Wassermaterial / shared water material */
export function waterMaterial(): THREE.ShaderMaterial {
  if (material) return material;
  const C = (h: string) => ({ value: new THREE.Color(hex(h)) });
  material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: ATMO.uTime, uNight: ATMO.uNight, uLight: ATMO.uLight,
      uHaze: ATMO.uHaze, uHazeColor: ATMO.uHazeColor, uHazeHalf: ATMO.uHazeHalf,
      uShore: C(semantic.waterShore), uShallow: C(semantic.terrainShallow), uOcean: C(semantic.terrainOcean),
      uDeep: C(semantic.waterAbyss), uFoam: C(semantic.waterFoam), uGlint: C(semantic.waterGlint),
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec2 water;
      varying vec3 vW;
      varying vec2 vWater;
      void main() {
        vec3 p = position;
        // sanftes Heben und Senken, am Ufer ruhig / gentle rise and fall, calm at the shore
        float calm = smoothstep(0.0, 0.25, water.y);
        p.y += sin(p.x * 2.7 + uTime * 1.1 + p.z * 1.3) * cos(p.z * 2.1 - uTime * 0.9) * 0.005 * calm;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        vWater = water;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      uniform vec3 uLight;
      uniform vec3 uShore;
      uniform vec3 uShallow;
      uniform vec3 uOcean;
      uniform vec3 uDeep;
      uniform vec3 uFoam;
      uniform vec3 uGlint;
      varying vec3 vW;
      varying vec2 vWater;
      ${HAZE_GLSL}
      void main() {
        float t = uTime;
        // zwei ueberlagerte, verzerrte Wellenfelder / two overlapping distorted wave fields
        float w1 = sin(vW.x * 3.1 + t * 0.9 + sin(vW.z * 2.3 + t * 0.6) * 1.2);
        float w2 = sin(vW.z * 3.7 - t * 0.8 + sin(vW.x * 1.9 - t * 0.5) * 1.1);
        float wave = (w1 + w2) * 0.5;
        float d = clamp(vWater.x + wave * 0.06, 0.0, 1.0);
        // harte Farbbaender statt Verlauf / hard colour bands instead of a gradient
        vec3 col = uShore;
        col = mix(col, uShallow, step(0.2, d));
        col = mix(col, uOcean, step(0.52, d));
        col = mix(col, uDeep, step(0.86, d));
        // helles Band auf den Wellenkaemmen / light band on the wave crests
        col = mix(col, col * 1.12 + 0.035, step(0.72, wave) * 0.7);
        col *= uLight;
        // Glitzern als kurze Striche / glints as short dashes
        float g = sin(vW.x * 11.0 + t * 1.7 + vW.z * 4.0) * sin(vW.z * 9.0 - t * 1.3 - vW.x * 3.0);
        float glint = step(0.965, g) * step(0.45, vWater.x);
        // Schaum: Brandungslinie am Ufer und auflaufende Baender / foam: surf line at the shore and incoming bands
        float s = vWater.y + wave * 0.015;
        float edge = 1.0 - step(0.065 + 0.025 * sin(vW.x * 7.0 + vW.z * 5.0 + t * 1.6), s);
        float band = fract(s * 4.0 + t * 0.32);
        float ring = step(0.84, band) * (1.0 - smoothstep(0.1, 0.4, s));
        float foam = max(edge, ring);
        col = mix(col, uFoam * mix(uLight, vec3(1.0), 0.35), foam * (1.0 - uNight * 0.25));
        col += uGlint * uLight * glint * 0.45 * (1.0 - foam);
        col = mix(col, uHazeColor, atmoHaze(vW));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  return material;
}

/**
 * Oberflaeche fuer alle sichtbaren Wasserfelder bauen (ein Mesh, ein Draw-Call).
 * Build the surface for all visible water tiles (one mesh, one draw call).
 * Attribut water: x = Tiefe 0..1 (weich zwischen Feldern), y = Abstand zum Ufer in Feldern.
 * Attribute water: x = depth 0..1 (smooth between tiles), y = distance to the shore in tiles.
 */
export function buildWater(s: GameState, explored: (x: number, y: number) => boolean, detail = 5): THREE.Mesh | null {
  const size = s.size, off = (size - 1) / 2;
  const T = (x: number, y: number) => s.tiles[Math.max(0, Math.min(size - 1, y)) * size + Math.max(0, Math.min(size - 1, x))];
  const height = (x: number, y: number) => { const t = T(x, y); return isWater(t.terrain) ? TILE_TOP[t.terrain] : SHORE_H; };
  const depth = (x: number, y: number) => { const t = T(x, y); return t.terrain === 'ocean' ? 1 : t.terrain === 'shallow' ? 0.42 : 0; };
  const bilinear = (f: (x: number, y: number) => number, gx: number, gy: number) => {
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    return (f(x0, y0) * (1 - fx) + f(x0 + 1, y0) * fx) * (1 - fy) + (f(x0, y0 + 1) * (1 - fx) + f(x0 + 1, y0 + 1) * fx) * fy;
  };
  const tiles: [number, number][] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (isWater(T(x, y).terrain) && explored(x, y)) tiles.push([x, y]);
  if (!tiles.length) return null;
  const n = detail, row = n + 1;
  const pos: number[] = [], data: number[] = [], index: number[] = [];
  const vert = (gx: number, gy: number, y: number, shore: number) => {
    pos.push(gx - off, y, gy - off);
    data.push(bilinear(depth, gx, gy), shore);
    return pos.length / 3 - 1;
  };
  for (const [x, y] of tiles) {
    // Landnachbarn fuer den Uferabstand / land neighbours for the shore distance
    const land: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (!isWater(s.tiles[ny * size + nx].terrain) && explored(nx, ny)) land.push([nx, ny]);
    }
    const shoreAt = (gx: number, gy: number) => {
      let d = 1;
      for (const [lx, ly] of land) d = Math.min(d, Math.hypot(Math.max(Math.abs(gx - lx) - 0.5, 0), Math.max(Math.abs(gy - ly) - 0.5, 0)));
      return d;
    };
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const gx = x - 0.5 + i / n, gy = y - 0.5 + j / n;
      vert(gx, gy, bilinear(height, gx, gy) - SURFACE_DROP, shoreAt(gx, gy));
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = base + j * row + i, b = a + 1, c = a + row, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    // Schuerze am Kartenrand / skirt at the map edge
    const edges: [boolean, number[]][] = [
      [y === 0, Array.from({ length: row }, (_, i) => base + i)],
      [y === size - 1, Array.from({ length: row }, (_, i) => base + n * row + (n - i))],
      [x === 0, Array.from({ length: row }, (_, j) => base + (n - j) * row)],
      [x === size - 1, Array.from({ length: row }, (_, j) => base + j * row + n)],
    ];
    for (const [on, ids] of edges) {
      if (!on) continue;
      const bottom = ids.map((id) => {
        const k = pos.length / 3;
        pos.push(pos[id * 3], WATER_BOX_TOP - 0.01, pos[id * 3 + 2]);
        data.push(data[id * 2], 1);
        return k;
      });
      for (let i = 0; i < n; i++) index.push(ids[i], ids[i + 1], bottom[i], ids[i + 1], bottom[i + 1], bottom[i]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('water', new THREE.Float32BufferAttribute(data, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, waterMaterial());
  mesh.raycast = () => {};
  mesh.renderOrder = 1;
  mesh.userData.dispose = true;
  return mesh;
}

/** Bodenhoehe unterhalb der Wasserflaeche (TILE_BOTTOM bleibt) / floor height below the surface */
export const WATER_BOX_HEIGHT = WATER_BOX_TOP - TILE_BOTTOM;
