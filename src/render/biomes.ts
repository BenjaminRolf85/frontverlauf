/**
 * Landschaften: Farben, Hoehen und Deko fuer Wiese, Huegel, Wueste, Steppe, Tundra, Sumpf sowie Fluesse.
 * Biomes: colours, heights and decorations for grassland, hills, desert, steppe, tundra, swamp, plus rivers.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BiomeId, TerrainId } from '../data/balance';
import { semantic } from '../design/tokens';
import { paint } from './toon';

/** Zusaetzliche Hoehe der Feldoberkante je Landschaft / extra tile top height per biome */
export const BIOME_LIFT: Record<BiomeId, number> = { grassland: 0, hills: 0.07, desert: 0.01, steppe: 0, tundra: 0.02, swamp: -0.03 };

/** Oberflaechenfarbe nach Gelaende und Landschaft / top colour by terrain and biome */
export function biomeTop(terrain: TerrainId, biome: BiomeId | undefined): { top: string; side?: string } | null {
  if (!biome || terrain === 'shallow' || terrain === 'ocean') return null;
  const m: Record<BiomeId, { top: string; side?: string }> = {
    grassland: { top: terrain === 'forest' ? semantic.terrainForest : semantic.terrainPlain },
    hills: { top: semantic.biomeHills },
    desert: { top: semantic.biomeDesert, side: semantic.biomeDesertDark },
    steppe: { top: semantic.biomeSteppe, side: semantic.biomeSteppeDark },
    tundra: { top: semantic.biomeTundra, side: semantic.biomeTundraDark },
    swamp: { top: semantic.biomeSwamp, side: semantic.biomeSwampDark },
  };
  if (terrain === 'mountain') {
    if (biome === 'tundra') return { top: semantic.biomeTundraDark, side: semantic.terrainMountainDark };
    if (biome === 'desert') return { top: semantic.biomeDesertDark, side: semantic.terrainMountainDark };
    return null;
  }
  return m[biome];
}

const cache = new Map<string, THREE.BufferGeometry | null>();
const M = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function part(g: THREE.BufferGeometry, color: string, m: THREE.Matrix4) {
  const p = g.index ? g.toNonIndexed() : g;
  p.applyMatrix4(m);
  p.deleteAttribute('uv');
  return paint(p, color);
}
function rnd(seed: number) {
  let x = seed * 7919 + 17;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}

function grass(parts: THREE.BufferGeometry[], r: () => number, n: number) {
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 0.8, z = (r() - 0.5) * 0.8;
    for (let k = 0; k < 3; k++) {
      parts.push(part(new THREE.ConeGeometry(0.012, 0.07 + r() * 0.04, 3), semantic.grassTuft, M(x + (k - 1) * 0.018, 0.04, z, (k - 1) * 0.35, 0, (k - 1) * 0.35)));
    }
  }
}
function flowers(parts: THREE.BufferGeometry[], r: () => number, n: number) {
  const colors = [semantic.flowerA, semantic.flowerB, semantic.flowerC, semantic.flowerD];
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 0.8, z = (r() - 0.5) * 0.8;
    parts.push(part(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 3), semantic.grassTuft, M(x, 0.025, z)));
    parts.push(part(new THREE.IcosahedronGeometry(0.02, 0), colors[Math.floor(r() * colors.length)], M(x, 0.055, z)));
  }
}

/** Deko je Landschaft (nur auf freien Feldern ohne Wald) / decoration per biome (only on free non-forest tiles) */
export function biomeDecoration(terrain: TerrainId, biome: BiomeId | undefined, variant: number): THREE.BufferGeometry | null {
  if (!biome || terrain !== 'plain') return null;
  const key = `${biome}-${variant}`;
  if (cache.has(key)) return cache.get(key)!;
  const r = rnd(variant + biome.length * 13);
  const parts: THREE.BufferGeometry[] = [];
  const spot = () => [(r() - 0.5) * 0.7, (r() - 0.5) * 0.7];
  switch (biome) {
    case 'desert': {
      for (let i = 0; i < 2; i++) {
        const [x, z] = spot();
        parts.push(part(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6), semantic.cactus, M(x, 0.1, z)));
        parts.push(part(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 6), semantic.cactus, M(x + 0.05, 0.12, z, 0, 0, -0.9)));
        parts.push(part(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 6), semantic.cactus, M(x - 0.045, 0.09, z, 0, 0, 0.9)));
      }
      const [dx, dz] = spot();
      parts.push(part(new THREE.SphereGeometry(0.16, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), semantic.biomeDesertDark, M(dx, 0, dz, 0, 0, 0, 1, 0.35, 0.7)));
      break;
    }
    case 'steppe': {
      for (let i = 0; i < 5; i++) {
        const [x, z] = spot();
        parts.push(part(new THREE.ConeGeometry(0.035, 0.1, 4), semantic.biomeSteppeDark, M(x, 0.05, z, (r() - 0.5) * 0.4, r() * 3, 0)));
      }
      break;
    }
    case 'tundra': {
      for (let i = 0; i < 2; i++) {
        const [x, z] = spot();
        parts.push(part(new THREE.SphereGeometry(0.1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), semantic.snow, M(x, 0, z, 0, 0, 0, 1, 0.3, 0.8)));
      }
      const [px, pz] = spot();
      parts.push(part(new THREE.ConeGeometry(0.07, 0.22, 6), semantic.treeDark, M(px, 0.13, pz)));
      parts.push(part(new THREE.ConeGeometry(0.045, 0.08, 6), semantic.snow, M(px, 0.22, pz)));
      break;
    }
    case 'swamp': {
      for (let i = 0; i < 2; i++) {
        const [x, z] = spot();
        parts.push(part(new THREE.CircleGeometry(0.13, 9), semantic.biomeSwampDark, M(x, 0.008, z, -Math.PI / 2, 0, 0, 1, 0.75, 1)));
      }
      for (let i = 0; i < 6; i++) {
        const [x, z] = spot();
        parts.push(part(new THREE.CylinderGeometry(0.008, 0.012, 0.14 + r() * 0.08, 4), semantic.reed, M(x, 0.08, z, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3)));
      }
      break;
    }
    case 'hills': {
      for (let i = 0; i < 2; i++) {
        const [x, z] = spot();
        parts.push(part(new THREE.SphereGeometry(0.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), semantic.biomeHills, M(x * 0.6, 0, z * 0.6, 0, 0, 0, 1, 0.45, 0.9)));
      }
      break;
    }
    default: {
      // Wiese: viele Felder bleiben ganz gruen, sonst Gras, wenige Blumen, selten ein Baeumchen
      // meadow: many tiles stay plain green, otherwise grass, a few flowers, rarely a small tree
      const v = variant % 8;
      if (v <= 2) break;
      grass(parts, r, v <= 4 ? 2 : 3);
      if (v === 5 || v === 6) flowers(parts, r, 1 + Math.floor(r() * 3));
      if (v === 7) {
        const [x, z] = spot();
        parts.push(part(new THREE.CylinderGeometry(0.015, 0.02, 0.08, 5), semantic.terrainPlainSide, M(x, 0.04, z)));
        parts.push(part(new THREE.IcosahedronGeometry(0.075, 0), semantic.tree, M(x, 0.13, z)));
      }
    }
  }
  if (biome === 'hills' && variant % 3 === 0) { grass(parts, r, 2); if (variant % 2) flowers(parts, r, 1); }
  if (biome === 'steppe' && variant % 2 === 0) grass(parts, r, 2);
  const g = parts.length ? mergeGeometries(parts)! : null;
  cache.set(key, g);
  return g;
}

/** Flussabschnitt (flacher Streifen) / river segment (flat strip) */
let riverSeg: THREE.BufferGeometry | null = null;
export function riverSegment(): THREE.BufferGeometry {
  if (!riverSeg) riverSeg = paint(new THREE.BoxGeometry(0.2, 0.02, 1).toNonIndexed(), semantic.river);
  return riverSeg;
}

/** Berghoehe: Hebung der Feldoberkante und Skalierung der Felsen / mountain height: tile lift and rock scale */
export const PEAK_LIFT = [0, -0.05, 0, 0.09];
export const PEAK_SCALE = [1, 0.6, 1, 1.55];

/** Kettenspuren: zwei gestrichelte Streifen entlang z / track marks: two dashed strips along z */
const trackCache = new Map<string, THREE.BufferGeometry>();
export function trackGeometry(color: string): THREE.BufferGeometry {
  let g = trackCache.get(color);
  if (g) return g;
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-0.1, 0.1]) {
    for (let i = 0; i < 6; i++) {
      parts.push(part(new THREE.PlaneGeometry(0.06, 0.1), color, M(side, 0.007, -0.42 + i * 0.168, -Math.PI / 2, 0, 0)));
    }
  }
  g = mergeGeometries(parts)!;
  trackCache.set(color, g);
  return g;
}

/** Strassenabschnitt entlang z: Asphalt, weisse Randlinien, gelbe Mittelstriche / road segment along z: asphalt, white edge lines, yellow centre dashes */
let roadSeg: THREE.BufferGeometry | null = null;
export function roadSegment(): THREE.BufferGeometry {
  if (roadSeg) return roadSeg;
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(new THREE.BoxGeometry(0.3, 0.022, 1), semantic.asphalt, M(0, 0.011, 0)));
  parts.push(part(new THREE.BoxGeometry(0.34, 0.012, 1), semantic.asphaltEdge, M(0, 0.006, 0)));
  for (const x of [-0.125, 0.125]) parts.push(part(new THREE.BoxGeometry(0.018, 0.004, 1), semantic.roadLine, M(x, 0.024, 0)));
  for (const z of [-0.33, 0, 0.33]) parts.push(part(new THREE.BoxGeometry(0.022, 0.004, 0.16), semantic.roadCenter, M(0, 0.024, z)));
  roadSeg = mergeGeometries(parts)!;
  return roadSeg;
}
/** Kreuzungsplatte in der Feldmitte / junction plate in the tile centre */
let roadNode: THREE.BufferGeometry | null = null;
export function roadJunction(): THREE.BufferGeometry {
  if (roadNode) return roadNode;
  const parts = [
    part(new THREE.CylinderGeometry(0.17, 0.17, 0.022, 16), semantic.asphalt, M(0, 0.011, 0)),
    part(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 16), semantic.asphaltEdge, M(0, 0.006, 0)),
  ];
  roadNode = mergeGeometries(parts)!;
  return roadNode;
}
