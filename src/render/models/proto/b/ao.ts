/**
 * Vorschlag B: Umgebungsverdeckung je Ecke, beim Laden berechnet / proposal B: ambient occlusion per vertex, computed at load time.
 *
 * Das Modell wird in ein Voxelgitter eingetragen (dazu der Boden); von jeder Ecke laufen einige Strahlen in die
 * Halbkugel ueber der Flaeche durch das Gitter. Treffer in der Naehe verdunkeln: Fugen, die Unterseite der Helmkrempe,
 * der Raum zwischen den Laufrollen. Das Ergebnis liegt als eigenes Attribut `ao` vor (in der Einfuehrung wuerde es in
 * die Vertexfarbe multipliziert und kostet dann nichts zur Laufzeit).
 * The model is entered into a voxel grid (plus the ground); from every vertex a few rays run through the grid into the
 * hemisphere above the surface. Nearby hits darken: joints, the underside of the helmet rim, the space between the road
 * wheels. The result is its own attribute `ao` (in a rollout it would be multiplied into the vertex colour and then
 * costs nothing at run time).
 */
import * as THREE from 'three';

export interface AoOpts {
  /** Kantenlaenge eines Voxels / voxel edge length */
  voxel?: number;
  /** Reichweite der Strahlen / reach of the rays */
  reach?: number;
  rays?: number;
  /** Boden bei y = 0 verdeckt mit / the ground at y = 0 occludes too */
  ground?: boolean;
}

/** Feste Richtungen in der Halbkugel um +y, kosinusgewichtet / fixed directions in the hemisphere around +y, cosine weighted */
function hemisphere(n: number): number[][] {
  const out: number[][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const r = Math.sqrt(u), a = i * golden;
    out.push([Math.cos(a) * r, Math.sqrt(1 - u), Math.sin(a) * r]);
  }
  return out;
}

/** Verdeckung je Ecke als Attribut `ao` (1 = frei) / occlusion per vertex as attribute `ao` (1 = open) */
export function bakeAO(g: THREE.BufferGeometry, o: AoOpts = {}): THREE.BufferGeometry {
  const voxel = o.voxel ?? 0.006, reach = o.reach ?? 0.085, rays = o.rays ?? 24;
  const pos = g.getAttribute('position') as THREE.BufferAttribute, nor = g.getAttribute('normal') as THREE.BufferAttribute;
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const pad = 3;
  const ox = bb.min.x - pad * voxel, oy = Math.min(bb.min.y, 0) - pad * voxel, oz = bb.min.z - pad * voxel;
  const nx = Math.ceil((bb.max.x - bb.min.x) / voxel) + 2 * pad, ny = Math.ceil((bb.max.y - Math.min(bb.min.y, 0)) / voxel) + 2 * pad, nz = Math.ceil((bb.max.z - bb.min.z) / voxel) + 2 * pad;
  const grid = new Uint8Array(nx * ny * nz);
  const mark = (x: number, y: number, z: number) => {
    const i = Math.floor((x - ox) / voxel), j = Math.floor((y - oy) / voxel), k = Math.floor((z - oz) / voxel);
    if (i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz) grid[(j * nz + k) * nx + i] = 1;
  };
  // Dreiecke eintragen: Punkte im Abstand eines halben Voxels / enter triangles: points half a voxel apart
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
    const n = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / (voxel * 0.5)));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const u = i / n, v = j / n, w = 1 - u - v;
      mark(a.x * w + b.x * u + c.x * v, a.y * w + b.y * u + c.y * v, a.z * w + b.z * u + c.z * v);
    }
  }
  if (o.ground !== false) {
    const j0 = Math.floor((0 - oy) / voxel) - 1;
    for (let j = 0; j <= Math.max(0, j0); j++) grid.fill(1, j * nz * nx, (j + 1) * nz * nx);
  }
  const hit = (x: number, y: number, z: number): boolean => {
    const i = Math.floor((x - ox) / voxel), j = Math.floor((y - oy) / voxel), k = Math.floor((z - oz) / voxel);
    return i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && grid[(j * nz + k) * nx + i] === 1;
  };
  const dirs = hemisphere(rays);
  const steps = Math.max(2, Math.round(reach / voxel));
  const start = voxel * 1.75;
  const out = new Float32Array(pos.count);
  const cache = new Map<string, number>();
  const n = new THREE.Vector3(), tx = new THREE.Vector3(), tz = new THREE.Vector3(), d = new THREE.Vector3();
  for (let v = 0; v < pos.count; v++) {
    const px = pos.getX(v), py = pos.getY(v), pz = pos.getZ(v);
    n.fromBufferAttribute(nor, v);
    const key = `${Math.round(px * 4000)},${Math.round(py * 4000)},${Math.round(pz * 4000)},${Math.round(n.x * 8)},${Math.round(n.y * 8)},${Math.round(n.z * 8)}`;
    const known = cache.get(key);
    if (known !== undefined) { out[v] = known; continue; }
    // Tangentenrahmen / tangent frame
    tx.set(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize();
    tz.crossVectors(n, tx);
    let occ = 0;
    for (const [dx, dy, dz] of dirs) {
      d.set(0, 0, 0).addScaledVector(tx, dx).addScaledVector(n, dy).addScaledVector(tz, dz);
      for (let s = 0; s < steps; s++) {
        const l = start + s * voxel;
        if (hit(px + n.x * start * 0.6 + d.x * l, py + n.y * start * 0.6 + d.y * l, pz + n.z * start * 0.6 + d.z * l)) {
          occ += 1 - s / steps;
          break;
        }
      }
    }
    const ao = 1 - occ / rays;
    cache.set(key, ao);
    out[v] = ao;
  }
  g.setAttribute('ao', new THREE.BufferAttribute(out, 1));
  return g;
}
