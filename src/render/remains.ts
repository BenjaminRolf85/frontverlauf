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
    // Fahrzeug in Truemmer zerlegen: Dreiecke nach Raster-Zellen gruppieren, Zellen verschieben, kippen, teils weglassen
    // break the vehicle into debris: group triangles by grid cell, move and tilt cells, drop some
    const src = unitGeometry(type, faction, null);
    const pos = src.getAttribute('position') as THREE.BufferAttribute;
    const nor = src.getAttribute('normal') as THREE.BufferAttribute;
    const r = rnd(variant * 7 + type.length * 13);
    const CELL = 0.12;
    const cells = new Map<string, number[]>();
    for (let t = 0; t < pos.count; t += 3) {
      const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
      const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
      const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
      const key = `${Math.floor(cx / CELL)},${Math.floor(cy / CELL)},${Math.floor(cz / CELL)}`;
      let list = cells.get(key);
      if (!list) { list = []; cells.set(key, list); }
      list.push(t);
    }
    const charA = new THREE.Color(hex(semantic.char));
    const charB = new THREE.Color(hex(semantic.ink));
    const ember = new THREE.Color(hex(semantic.fire));
    const P: number[] = [], N: number[] = [], C: number[] = [];
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (const [key, tris] of cells) {
      if (r() < 0.22) continue; // Teile fehlen / parts missing
      const [kx, ky, kz] = key.split(',').map(Number);
      const centre = new THREE.Vector3((kx + 0.5) * CELL, (ky + 0.5) * CELL, (kz + 0.5) * CELL);
      // nach aussen geschleudert und zusammengesackt / thrown outward and collapsed
      const out = new THREE.Vector3(centre.x, 0, centre.z).normalize().multiplyScalar(0.03 + r() * 0.09);
      const drop = -centre.y * (0.45 + r() * 0.35);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(out.x + (r() - 0.5) * 0.05, drop, out.z + (r() - 0.5) * 0.05),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.9, (r() - 0.5) * 1.2, (r() - 0.5) * 0.9)),
        new THREE.Vector3(1, 1, 1));
      const pivot = new THREE.Matrix4().makeTranslation(centre.x, centre.y, centre.z);
      const unpivot = new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z);
      const full = new THREE.Matrix4().multiplyMatrices(pivot, m).multiply(unpivot);
      const nm = new THREE.Matrix3().getNormalMatrix(full);
      const glow = r() < 0.08;
      for (const t of tris) {
        for (let k = 0; k < 3; k++) {
          v.fromBufferAttribute(pos, t + k).applyMatrix4(full);
          v.y = Math.max(v.y, 0.002);
          nv.fromBufferAttribute(nor, t + k).applyMatrix3(nm).normalize();
          P.push(v.x, v.y, v.z); N.push(nv.x, nv.y, nv.z);
          const c = glow && k === 0 ? ember : (t / 3) % 3 === 0 ? charB : charA;
          C.push(c.r, c.g, c.b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    // zusaetzliche Truemmer und Glutnester / extra debris and embers
    const parts: THREE.BufferGeometry[] = [g];
    for (let i = 0; i < 7; i++) {
      parts.push(part(new THREE.BoxGeometry(0.03 + r() * 0.04, 0.012, 0.02 + r() * 0.03), semantic.char, M((r() - 0.5) * 0.8, 0.008, (r() - 0.5) * 0.8, 0, r() * 3, (r() - 0.5) * 0.4)));
    }
    for (let i = 0; i < 2; i++) parts.push(part(new THREE.TetrahedronGeometry(0.022, 0), semantic.fire, M((r() - 0.5) * 0.3, 0.02, (r() - 0.5) * 0.3, r(), r(), 0)));
    const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => { if (p.getAttribute('uv')) p.deleteAttribute('uv'); return p; }))!;
    merged.rotateY(variant * 1.1);
    return merged;
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
