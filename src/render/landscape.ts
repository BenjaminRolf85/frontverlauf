/**
 * Weiche Landschaft: gezackte Uebergangsstreifen zwischen verschiedenen Landschaften, Sandstrand an der Kueste
 * und Felsabbrueche an Hoehenstufen zwischen Nachbarfeldern.
 * Soft landscape: jagged transition strips between different biomes, sandy beach at the coast
 * and rock cliffs on height steps between neighbouring tiles.
 */
import * as THREE from 'three';
import type { Tile } from '../core';
import { hex, semantic } from '../design/tokens';
import { withGlow } from './atmosphere';

/** Ab diesem Hoehenunterschied gibt es Felsen statt Streifen / from this height step on, rocks instead of strips */
const CLIFF_STEP = 0.05;
/** Halbe Feldbreite / half tile width */
const EDGE = 0.49;
const SEGMENTS = 7;
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const hash = (a: number, b: number, c: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

export interface LandInput {
  size: number;
  tiles: Tile[];
  explored: (x: number, y: number) => boolean;
  /** Oberflaechenfarbe (null fuer Wasser) / top colour (null for water) */
  topColor: (t: Tile) => string | null;
  top: (t: Tile) => number;
}

export interface Cliff { m: THREE.Matrix4; color: THREE.Color }

/**
 * Uebergangsstreifen als ein Mesh mit Vertexfarben plus Felsen-Matrizen.
 * Transition strips as one mesh with vertex colours plus rock matrices.
 */
export function buildLandscape(inp: LandInput): { strips: THREE.BufferGeometry | null; cliffs: Cliff[] } {
  const { size, tiles, explored } = inp;
  const off = (size - 1) / 2;
  const pos: number[] = [], col: number[] = [];
  const cliffs: Cliff[] = [];
  const cA = new THREE.Color(), cB = new THREE.Color();
  const beach = new THREE.Color(hex(semantic.beach));
  const rock = new THREE.Color(hex(semantic.cliff));

  /** gezackter Streifen entlang einer Kante / jagged strip along an edge */
  const strip = (x: number, y: number, dx: number, dy: number, yTop: number, inner: number, outer: number, color: THREE.Color, layer: number) => {
    const cx = x - off, cz = y - off;
    const tx = -dy, tz = dx; // Tangente / tangent
    const pts: [number, number, number, number][] = [];
    for (let k = 0; k <= SEGMENTS; k++) {
      const s = -EDGE + (2 * EDGE * k) / SEGMENTS;
      // Zacken, an den Ecken schmaler / teeth, narrower at the corners
      const corner = 1 - Math.pow(Math.abs(s) / EDGE, 3) * 0.6;
      const w = (inner + (k % 2 ? 0.35 : -0.15) * inner + (hash(x * 4 + dx, y * 4 + dy, k) - 0.5) * inner * 0.5) * corner;
      const ox = cx + dx * (EDGE - outer) + tx * s, oz = cz + dy * (EDGE - outer) + tz * s;
      pts.push([ox, oz, ox - dx * w, oz - dy * w]);
    }
    const yy = yTop + 0.002 + layer * 0.0006;
    for (let k = 0; k < SEGMENTS; k++) {
      const [ax, az, aix, aiz] = pts[k], [bx, bz, bix, biz] = pts[k + 1];
      // zwei Dreiecke, nach oben gerichtet / two triangles, facing up
      const quad = [[ax, az], [aix, aiz], [bx, bz], [bx, bz], [aix, aiz], [bix, biz]];
      // Umlaufsinn so waehlen, dass die Normale nach oben zeigt / choose winding so the normal points up
      const cross = (aix - ax) * (bz - az) - (aiz - az) * (bx - ax);
      const order = cross < 0 ? quad : [quad[0], quad[2], quad[1], quad[3], quad[5], quad[4]];
      for (const [px, pz] of order) { pos.push(px, yy, pz); col.push(color.r, color.g, color.b); }
    }
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!explored(x, y)) continue;
      const t = tiles[y * size + x];
      const own = inp.topColor(t);
      if (own === null) continue;
      const top = inp.top(t);
      cA.set(hex(own));
      DIRS.forEach(([dx, dy], dir) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || !explored(nx, ny)) return;
        const n = tiles[ny * size + nx];
        const other = inp.topColor(n);
        const ntop = inp.top(n);
        const step = top - ntop;
        if (other === null) {
          // Kueste: Sandstrand auf flachem Land, Felsen an Bergen und Huegeln / coast: beach on flat land, rocks on mountains and hills
          if (t.terrain === 'mountain' || step > 0.14) addCliff(x, y, dx, dy, top, ntop + 0.06);
          else if (t.terrain !== 'forest' || t.biome !== 'jungle') {
            strip(x, y, dx, dy, top, 0.07, 0, cB.copy(cA).lerp(beach, 0.8), dir + 5);
            strip(x, y, dx, dy, top, 0.13, 0, cB.copy(cA).lerp(beach, 0.4), dir);
          }
          return;
        }
        if (step >= CLIFF_STEP) { addCliff(x, y, dx, dy, top, ntop); return; }
        if (Math.abs(step) >= CLIFF_STEP || other === own) return;
        // weicher Uebergang in zwei Stufen / soft transition in two steps
        cB.set(hex(other));
        strip(x, y, dx, dy, top, 0.06, 0, cB.clone().lerp(cA, 0.5), dir + 5);
        strip(x, y, dx, dy, top, 0.14, 0, cB.clone().lerp(cA, 0.75), dir);
      });
    }
  }

  function addCliff(x: number, y: number, dx: number, dy: number, top: number, low: number) {
    const h = top - low;
    if (h < CLIFF_STEP * 0.8) return;
    const cx = x - off, cz = y - off;
    const tx = -dy, tz = dx;
    const t = tiles[y * size + x];
    // Felsfarbe leicht nach Landschaft getoent / rock colour slightly tinted by biome
    const tint = inp.topColor(t);
    const color = rock.clone();
    if (tint && t.terrain !== 'mountain') color.lerp(new THREE.Color(hex(tint)), 0.25);
    const n = 3;
    for (let k = 0; k < n; k++) {
      const r = hash(x * 3 + dx * 7, y * 3 + dy * 5, k);
      const s = -0.32 + (0.64 * k) / (n - 1) + (r - 0.5) * 0.1;
      const w = 0.24 + r * 0.12;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(cx + dx * (EDGE + 0.005) + tx * s, low + h * 0.48, cz + dy * (EDGE + 0.005) + tz * s),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dy) + (r - 0.5) * 0.4),
        new THREE.Vector3(w, h * (0.95 + r * 0.2), 0.1 + r * 0.05),
      );
      cliffs.push({ m, color: color.clone().multiplyScalar(0.92 + r * 0.16) });
    }
  }

  if (!pos.length) return { strips: null, cliffs };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  withGlow(g, 'none');
  return { strips: g, cliffs };
}

let rockGeo: THREE.BufferGeometry | null = null;
/** Kantiger Felsbrocken (Einheitsgroesse, Vertexfarben hell oben, dunkel unten) / angular rock (unit size, light top, dark bottom) */
export function cliffRock(): THREE.BufferGeometry {
  if (rockGeo) return rockGeo;
  const g = new THREE.DodecahedronGeometry(0.62, 0).toNonIndexed();
  g.scale(1, 0.85, 1);
  g.computeVertexNormals();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const light = new THREE.Color(hex(semantic.white)), dark = new THREE.Color(hex(semantic.cliffDark)).lerp(light, 0.35);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = nor.getY(i) > 0.3 ? light : dark;
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  rockGeo = withGlow(g, 'none');
  return rockGeo;
}
