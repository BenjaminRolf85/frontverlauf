/**
 * Ueberreste und Sterbeeffekte im Comic-Stil: Blut- und Oelflecken, Skelette, verkohlte Wracks, Tropfen und Feuerbaelle.
 * Remains and death effects in comic style: blood and oil splats, skeletons, charred wrecks, droplets and fireballs.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FactionId, UnitTypeId } from '../data/balance';
import { factionTokens, hex, semantic } from '../design/tokens';
import { unitGeometry } from './models';
import { paint } from './toon';

const cache = new Map<string, THREE.BufferGeometry>();
const memo = (key: string, make: () => THREE.BufferGeometry) => {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
};

/** Pseudozufall aus Zahl / pseudo random from number */
function rnd(seed: number) {
  let x = seed * 9301 + 49297;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}

/** Flacher Comic-Fleck (Stern mit Tropfen) / flat comic splat (star with droplets) */
export function splatGeometry(color: string, variant: number): THREE.BufferGeometry {
  return memo(`splat-${color}-${variant}`, () => {
    const r = rnd(variant + 3);
    const shape = new THREE.Shape();
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad = i % 2 === 0 ? 0.2 + r() * 0.13 : 0.1 + r() * 0.05;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    const parts: THREE.BufferGeometry[] = [new THREE.ShapeGeometry(shape)];
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2, d = 0.3 + r() * 0.1;
      parts.push(new THREE.CircleGeometry(0.025 + r() * 0.03, 8).translate(Math.cos(a) * d, Math.sin(a) * d, 0));
    }
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.006, 0);
    return paint(g, color);
  });
}

function part(g: THREE.BufferGeometry, color: string, m: THREE.Matrix4): THREE.BufferGeometry {
  const p = g.toNonIndexed();
  p.applyMatrix4(m);
  p.deleteAttribute('uv');
  return paint(p, color);
}
const M = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

/** Comic-Skelett mit Helm in Fraktionsfarbe / comic skeleton with helmet in faction colour */
export function skeletonGeometry(faction: FactionId, variant: number): THREE.BufferGeometry {
  return memo(`skel-${faction}-${variant}`, () => {
    const bone = semantic.bone, dark = semantic.ink;
    const parts: THREE.BufferGeometry[] = [];
    // Schaedel / skull
    parts.push(part(new THREE.IcosahedronGeometry(0.075, 0), bone, M(0, 0.06, 0.14, 0, 0, 0)));
    parts.push(part(new THREE.BoxGeometry(0.07, 0.03, 0.05), bone, M(0, 0.03, 0.2)));
    parts.push(part(new THREE.BoxGeometry(0.022, 0.022, 0.01), dark, M(-0.026, 0.075, 0.206)));
    parts.push(part(new THREE.BoxGeometry(0.022, 0.022, 0.01), dark, M(0.026, 0.075, 0.206)));
    // Wirbelsaeule und Rippen / spine and ribs
    parts.push(part(new THREE.BoxGeometry(0.025, 0.02, 0.24), bone, M(0, 0.015, -0.03)));
    for (let i = 0; i < 3; i++) parts.push(part(new THREE.BoxGeometry(0.17 - i * 0.02, 0.018, 0.022), bone, M(0, 0.02, 0.04 - i * 0.05)));
    // Arme und Beine / arms and legs
    const limb = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5);
    parts.push(part(limb, bone, M(-0.11, 0.014, 0.0, Math.PI / 2, 0, 0.5)));
    parts.push(part(limb, bone, M(0.12, 0.014, 0.02, Math.PI / 2, 0, -0.8)));
    parts.push(part(limb, bone, M(-0.05, 0.014, -0.23, Math.PI / 2, 0, 0.25)));
    parts.push(part(limb, bone, M(0.06, 0.014, -0.24, Math.PI / 2, 0, -0.35)));
    // Helm daneben / helmet next to it
    const helmet = new THREE.SphereGeometry(0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    parts.push(part(helmet, factionTokens[faction].primary, M(0.17, 0.0, 0.17, 0.4, 0, 0.3)));
    const g = mergeGeometries(parts)!;
    g.rotateY(variant * 1.3);
    g.computeVertexNormals();
    return g;
  });
}

/** Verkohltes Wrack aus dem Einheitenmodell / charred wreck from the unit model */
export function wreckGeometry(type: UnitTypeId, faction: FactionId, variant: number): THREE.BufferGeometry {
  return memo(`wreck-${type}-${faction}-${variant}`, () => {
    const src = unitGeometry(type, faction, null).clone();
    const col = src.getAttribute('color') as THREE.BufferAttribute;
    const charC = new THREE.Color(hex(semantic.char));
    const tmp = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      tmp.setRGB(col.getX(i), col.getY(i), col.getZ(i)).lerp(charC, 0.68);
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
    const tilt = type === 'heli' ? 0.55 : 0.18;
    src.applyMatrix4(M(0, type === 'heli' ? -0.02 : -0.02, 0, tilt * 0.6, variant * 1.1, tilt, type === 'heli' ? 0.85 : 1));
    // Truemmer und Glut / debris and embers
    const r = rnd(variant + 11);
    const parts: THREE.BufferGeometry[] = [src];
    for (let i = 0; i < 4; i++) {
      parts.push(part(new THREE.BoxGeometry(0.06, 0.03, 0.04), semantic.char, M((r() - 0.5) * 0.7, 0.015, (r() - 0.5) * 0.7, 0, r() * 3, 0)));
    }
    parts.push(part(new THREE.TetrahedronGeometry(0.04, 0), semantic.fire, M(0.05, 0.1, 0.02, 0.3, 0.4, 0)));
    const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => { p.deleteAttribute('uv'); return p; }))!;
    return g;
  });
}

/** Comic-Tropfen fuer Blutspritzer / comic droplet for blood spurts */
export function dropletGeometry(color: string): THREE.BufferGeometry {
  return memo(`drop-${color}`, () => paint(new THREE.IcosahedronGeometry(0.035, 0).toNonIndexed(), color));
}

/** Comic-Feuerball / comic fireball */
export function fireballGeometry(): THREE.BufferGeometry {
  return memo('fireball', () => {
    const parts = [
      part(new THREE.IcosahedronGeometry(0.16, 0), semantic.fire, M(0, 0, 0)),
      part(new THREE.IcosahedronGeometry(0.1, 0), semantic.accent, M(0.06, 0.08, 0.05)),
      part(new THREE.IcosahedronGeometry(0.09, 0), semantic.char, M(-0.1, 0.1, -0.04)),
    ];
    return mergeGeometries(parts)!;
  });
}

/** Panzersperre: drei gekreuzte Stahltraeger (Stahligel) / tank barrier: three crossed steel beams */
export function barrierGeometry(color: string): THREE.BufferGeometry {
  return memo(`barrier-${color}`, () => {
    const beam = new THREE.BoxGeometry(0.05, 0.05, 0.34);
    const parts: THREE.BufferGeometry[] = [];
    const spots = [[-0.17, -0.15], [0.16, 0.12], [0.12, -0.2], [-0.12, 0.18]];
    spots.forEach(([x, z], i) => {
      const s = i < 2 ? 1 : 0.75;
      parts.push(part(beam, semantic.metal, M(x, 0.11 * s, z, 0.62, 0.3 + i, 0, s)));
      parts.push(part(beam, semantic.metal, M(x, 0.11 * s, z, -0.62, 0.3 + i, 0, s)));
      parts.push(part(beam, color, M(x, 0.11 * s, z, Math.PI / 2, 0.3 + i, 0.62, s)));
    });
    return mergeGeometries(parts)!;
  });
}
