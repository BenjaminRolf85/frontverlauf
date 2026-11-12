/**
 * Kleine Modelle fuer Stadt-Ausbauten an den Stadtraendern: Funkmast, Bunker, Kaserne.
 * Small models for city upgrades at the city edges: radio mast, bunker, barracks.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CityUpgradeId, FactionId } from '../data/balance';
import { factionTokens, semantic } from '../design/tokens';
import { paint } from './toon';

const cache = new Map<string, THREE.BufferGeometry>();
const M = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function part(g: THREE.BufferGeometry, color: string, m: THREE.Matrix4) {
  const p = g.index ? g.toNonIndexed() : g;
  p.applyMatrix4(m);
  if (p.getAttribute('uv')) p.deleteAttribute('uv');
  return paint(p, color);
}

/** Ecke je Ausbau, damit sie die Stadtmitte frei lassen / corner per upgrade so the centre stays free */
/** Platz je Slot (Ecken ausserhalb des Bodenrings) / position per slot (corners outside the ground ring) */
export const SLOT_SPOT: [number, number][] = [[-0.43, -0.43], [-0.43, 0.43], [0.43, -0.43]];
export const PERK_SCALE = 1.45;

export function perkGeometry(up: CityUpgradeId, faction: FactionId | null): THREE.BufferGeometry {
  const key = `${up}-${faction}`;
  let g = cache.get(key);
  if (g) return g;
  const accent = faction ? factionTokens[faction].primary : semantic.neutral;
  const parts: THREE.BufferGeometry[] = [];
  if (up === 'radioTower') {
    // Gittermast mit Antennenschuessel und Warnlicht / lattice mast with dish and warning light
    for (const [x, z] of [[-0.04, -0.04], [0.04, -0.04], [-0.04, 0.04], [0.04, 0.04]]) {
      parts.push(part(new THREE.CylinderGeometry(0.006, 0.01, 0.46, 4), semantic.metal, M(x * 0.6, 0.23, z * 0.6, z * 0.12, 0, -x * 0.12)));
    }
    for (const y of [0.1, 0.2, 0.3, 0.4]) parts.push(part(new THREE.BoxGeometry(0.07 - y * 0.08, 0.008, 0.07 - y * 0.08), semantic.metal, M(0, y, 0)));
    parts.push(part(new THREE.SphereGeometry(0.05, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2.2), semantic.white, M(0.03, 0.34, 0.03, 1.1, 0.8, 0)));
    parts.push(part(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 4), semantic.metal, M(0, 0.51, 0)));
    parts.push(part(new THREE.IcosahedronGeometry(0.014, 0), semantic.dangerBright, M(0, 0.565, 0)));
    parts.push(part(new THREE.BoxGeometry(0.1, 0.03, 0.1), accent, M(0, 0.015, 0)));
  } else if (up === 'bunker') {
    // Betonbunker mit Sehschlitz und Sandsaecken / concrete bunker with slit and sandbags
    parts.push(part(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 8), semantic.terrainMountain, M(0, 0.04, 0)));
    parts.push(part(new THREE.CylinderGeometry(0.09, 0.11, 0.025, 8), semantic.terrainMountainDark, M(0, 0.092, 0)));
    parts.push(part(new THREE.BoxGeometry(0.1, 0.018, 0.02), semantic.ink, M(0, 0.06, 0.115)));
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.25 + (i / 6) * Math.PI * 1.5;
      parts.push(part(new THREE.CapsuleGeometry(0.018, 0.035, 2, 6).rotateZ(Math.PI / 2), semantic.terrainPlainSide, M(Math.sin(a) * 0.15, 0.018, Math.cos(a) * 0.15, 0, a, 0)));
    }
    parts.push(part(new THREE.BoxGeometry(0.05, 0.01, 0.03), accent, M(0, 0.106, 0)));
  } else if (up === 'hospital') {
    // Lazarett: weisses Zelt mit Fahne in Fraktionsfarbe (kein rotes Kreuz) / hospital: white tent with faction flag (no red cross)
    const tent = new THREE.ConeGeometry(0.13, 0.13, 4, 1).rotateY(Math.PI / 4);
    parts.push(part(tent, semantic.white, M(0, 0.065, 0, 0, 0, 0, 1.3, 1, 0.9)));
    parts.push(part(new THREE.BoxGeometry(0.05, 0.06, 0.004), semantic.ink, M(0, 0.03, 0.1)));
    parts.push(part(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), semantic.metal, M(0.13, 0.1, 0.05)));
    parts.push(part(new THREE.BoxGeometry(0.05, 0.035, 0.004), accent, M(0.155, 0.18, 0.05)));
    parts.push(part(new THREE.BoxGeometry(0.03, 0.03, 0.03), semantic.white, M(-0.14, 0.015, 0.06)));
  } else if (up === 'flak') {
    // Flugabwehr: Sandsackring mit Zwillingsgeschuetz / flak: sandbag ring with twin gun
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(part(new THREE.CapsuleGeometry(0.016, 0.03, 2, 6).rotateZ(Math.PI / 2), semantic.terrainPlainSide, M(Math.sin(a) * 0.12, 0.016, Math.cos(a) * 0.12, 0, a, 0)));
    }
    parts.push(part(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 8), semantic.metal, M(0, 0.04, 0)));
    for (const x of [-0.018, 0.018]) parts.push(part(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), semantic.ink, M(x, 0.12, 0.05, -0.9, 0, 0)));
    parts.push(part(new THREE.BoxGeometry(0.06, 0.012, 0.04), accent, M(0, 0.07, -0.02)));
  } else if (up === 'depot') {
    // Depot: Lagerhalle mit Kisten und Faessern / depot: storage shed with crates and barrels
    parts.push(part(new THREE.BoxGeometry(0.16, 0.08, 0.12), semantic.neutral, M(-0.02, 0.04, -0.02)));
    parts.push(part(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), semantic.terrainMountainDark, M(-0.02, 0.08, -0.02)));
    parts.push(part(new THREE.BoxGeometry(0.06, 0.05, 0.004), semantic.ink, M(-0.02, 0.025, 0.041)));
    for (const [x, z] of [[0.1, 0.08], [0.06, 0.12], [0.12, 0.13]]) parts.push(part(new THREE.BoxGeometry(0.04, 0.04, 0.04), semantic.accentStrong, M(x, 0.02, z)));
    for (const [x, z] of [[-0.12, 0.1], [-0.08, 0.13]]) parts.push(part(new THREE.CylinderGeometry(0.018, 0.018, 0.045, 8), accent, M(x, 0.022, z)));
  } else {
    // Kaserne: Langhaus mit Satteldach, Fahnenmast / barracks: long house with gable roof and flagpole
    parts.push(part(new THREE.BoxGeometry(0.2, 0.08, 0.12), semantic.neutral, M(0, 0.04, 0)));
    const roof = new THREE.CylinderGeometry(0.075, 0.075, 0.22, 3, 1).rotateZ(Math.PI / 2);
    parts.push(part(roof, semantic.terrainMountainDark, M(0, 0.1, 0, 0, 0, 0, 1, 0.55, 1)));
    for (const x of [-0.06, 0, 0.06]) parts.push(part(new THREE.BoxGeometry(0.03, 0.025, 0.004), semantic.ink, M(x, 0.05, 0.062)));
    parts.push(part(new THREE.BoxGeometry(0.03, 0.05, 0.004), semantic.metal, M(0.085, 0.025, 0.062)));
    parts.push(part(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), semantic.metal, M(-0.13, 0.11, 0.06)));
    parts.push(part(new THREE.BoxGeometry(0.06, 0.04, 0.004), accent, M(-0.1, 0.2, 0.06)));
  }
  g = mergeGeometries(parts)!;
  cache.set(key, g);
  return g;
}
