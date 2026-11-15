/**
 * Welt der Vergessenen (Kartenthema 'desert', nur Darstellung): ferne Tafelberge hinter den Kartenraendern, treibender
 * Staub, wandernde Staubteufel, Sandhuepfer am Boden und kreisende Aasflieger. Alles instanziert, feste Obergrenzen,
 * bei niedriger Qualitaet weniger; ohne Animationen steht alles still.
 * World of the Forgotten (map theme 'desert', render only): distant mesas beyond the map edges, drifting dust, wandering
 * dust devils, sand skitterers on the ground and circling carrion fliers. Everything instanced, fixed caps, fewer on low
 * quality; without animations everything stands still.
 */
import * as THREE from 'three';
import { hex, semantic } from '../design/tokens';
import type { GameState, Tile } from '../core';
import { withGlow } from './atmosphere';
import { OUTLINE } from './config';
import { outlinedInstanced, toonMaterial } from './toon';
import { landMaterial } from './atmosphere';
import { carrionFlierGeometry, dustDevilGeometry, mesaGeometry, skittererGeometry } from './models/desert';

/** Obergrenzen (hoch / niedrig) / caps (high / low) */
export const DESERT_CAPS = { mesas: 30, dust: [260, 90], devils: [4, 2], skitterers: [14, 6], fliers: [6, 3] };

const hash = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

interface Spot { x: number; y: number; z: number; ph: number }

export interface DesertInput {
  s: GameState;
  explored: (x: number, y: number) => boolean;
  top: (t: Tile) => number;
  occupied: Set<number>;
  low: boolean;
}

export class DesertWorldFx {
  readonly group = new THREE.Group();
  active = false;
  private size = 0;
  private dust: { p: THREE.Vector3; v: THREE.Vector3; ph: number }[] = [];
  private devils: Spot[] = [];
  private skitterers: Spot[] = [];
  private fliers: Spot[] = [];
  private meshes: { dust?: THREE.InstancedMesh; devil?: THREE.InstancedMesh[]; skit?: THREE.InstancedMesh[]; flier?: THREE.InstancedMesh[] } = {};
  private tmp = new THREE.Object3D();
  private last = 0;

  clear() {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
    }
    this.dust = []; this.devils = []; this.skitterers = []; this.fliers = [];
    this.meshes = {};
    this.active = false;
  }

  build(inp: DesertInput) {
    this.clear();
    this.active = true;
    const { s, explored, top, occupied, low } = inp;
    const size = (this.size = s.size), off = (size - 1) / 2;
    const q = low ? 1 : 0;
    // --- ferne Tafelberge rund um die Scheibe / distant mesas around the disc ---
    const mesas: THREE.Matrix4[][] = [[], [], [], []];
    const n = Math.min(DESERT_CAPS.mesas, Math.round(size * 1.7) >> q);
    for (let i = 0; i < n; i++) {
      const side = i % 4, k = Math.floor(i / 4), per = Math.ceil(n / 4);
      const along = -off - 1 + ((k + 0.5 + (hash(i, 3) - 0.5) * 0.5) / per) * (size + 2);
      const out = off + 1.3 + hash(i, 7) * 1.8;
      const [x, z] = side === 0 ? [along, -out] : side === 1 ? [out, along] : side === 2 ? [-along, out] : [-out, -along];
      const sc = 1.1 + hash(i, 11) * 1.3;
      mesas[i % 4].push(new THREE.Matrix4().compose(new THREE.Vector3(x, -0.25, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 13) * 6.28), new THREE.Vector3(sc, sc * (0.7 + hash(i, 17) * 0.6), sc)));
    }
    mesas.forEach((list, v) => {
      if (!list.length) return;
      const { mesh, line } = outlinedInstanced(withGlow(mesaGeometry(v), 'nature'), list.length, OUTLINE.building, landMaterial());
      list.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      for (const o of [mesh, line]) { o.frustumCulled = false; o.raycast = () => {}; }
      mesh.receiveShadow = true;
      this.group.add(mesh, line);
    });
    // --- Tiere und Staubteufel auf festen Plaetzen / critters and dust devils on fixed spots ---
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const k = y * size + x;
      const t = s.tiles[k];
      if (!explored(x, y) || t.terrain === 'shallow' || t.terrain === 'ocean') continue;
      const h = hash(x + 41, y + 7);
      const p = { x: x - off, y: top(t), z: y - off, ph: h * 50 };
      const free = !occupied.has(k) && t.cityId === null && t.terrain !== 'mountain';
      if (free && h < 0.07 && this.skitterers.length < DESERT_CAPS.skitterers[q]) this.skitterers.push(p);
      else if (h > 0.965 && this.fliers.length < DESERT_CAPS.fliers[q]) this.fliers.push(p);
      else if (free && t.terrain === 'plain' && h > 0.5 && h < 0.515 && this.devils.length < DESERT_CAPS.devils[q]) this.devils.push(p);
    }
    const add = (geo: THREE.BufferGeometry, count: number, width: number): THREE.InstancedMesh[] => {
      if (!count) return [];
      const { mesh, line } = outlinedInstanced(geo, count, width, toonMaterial());
      for (const m of [mesh, line]) { m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 4; this.group.add(m); }
      return [mesh, line];
    };
    this.meshes.skit = add(skittererGeometry(), this.skitterers.length, OUTLINE.unit * 0.6);
    this.meshes.flier = add(carrionFlierGeometry(), this.fliers.length, OUTLINE.unit * 0.6);
    if (this.devils.length) {
      // Staubteufel halbdurchsichtig, ohne Tuschelinie / dust devils semi-transparent, without ink line
      const m = new THREE.InstancedMesh(dustDevilGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }), this.devils.length);
      m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 7;
      this.meshes.devil = [m];
      this.group.add(m);
    }
    // --- treibender Staub / drifting dust ---
    let seed = 991 + size;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const half = size / 2 + 0.5;
    const count = Math.min(DESERT_CAPS.dust[q], Math.round(size * size * 0.9));
    for (let i = 0; i < count; i++) {
      this.dust.push({ p: new THREE.Vector3((rnd() * 2 - 1) * half, 0.05 + rnd() * 1.1, (rnd() * 2 - 1) * half), v: new THREE.Vector3(0.25 + rnd() * 0.3, (rnd() - 0.5) * 0.04, 0.08 + rnd() * 0.1), ph: rnd() * 6.28 });
    }
    const dm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.02, 0), new THREE.MeshBasicMaterial({ color: hex(semantic.desertDust), transparent: true, opacity: 0.7, depthWrite: false }), count);
    dm.frustumCulled = false; dm.raycast = () => {}; dm.renderOrder = 8;
    this.meshes.dust = dm;
    this.group.add(dm);
    this.update(0);
  }

  /** Zeit in Sekunden / time in seconds */
  update(time: number) {
    if (!this.active) return;
    const dt = Math.min(0.05, Math.max(0, time - this.last));
    this.last = time;
    const o = this.tmp;
    const half = this.size / 2 + 0.5;
    const dm = this.meshes.dust;
    if (dm) {
      this.dust.forEach((d, i) => {
        d.p.addScaledVector(d.v, dt);
        d.p.y += Math.sin(time * 0.9 + d.ph) * dt * 0.05;
        if (d.p.x > half) d.p.x = -half;
        if (d.p.z > half) d.p.z = -half;
        o.position.copy(d.p);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(d.ph + time * 0.3)));
        o.updateMatrix();
        dm.setMatrixAt(i, o.matrix);
      });
      dm.instanceMatrix.needsUpdate = true;
    }
    // Staubteufel: drehen sich und wandern im Kreis / dust devils: spin and wander in a circle
    const dv = this.meshes.devil;
    if (dv?.length) {
      this.devils.forEach((p, i) => {
        const a = time * 0.12 + p.ph;
        o.position.set(p.x + Math.cos(a) * 0.9, p.y, p.z + Math.sin(a * 1.3) * 0.9);
        o.rotation.set(0, time * 4 + p.ph, Math.sin(time * 1.7 + p.ph) * 0.08);
        o.scale.set(1, 0.9 + Math.sin(time * 2.1 + p.ph) * 0.1, 1);
        o.updateMatrix();
        for (const m of dv) m.setMatrixAt(i, o.matrix);
      });
      for (const m of dv) m.instanceMatrix.needsUpdate = true;
    }
    // Sandhuepfer: kurze Spruenge um ihren Platz / skitterers: short hops around their spot
    const sk = this.meshes.skit;
    if (sk?.length) {
      this.skitterers.forEach((p, i) => {
        const t = (time + p.ph) / 1.6;
        const hop = Math.floor(t), f = t - hop;
        const a = hop * 2.1 + p.ph, k = Math.min(1, f / 0.25);
        o.position.set(p.x + Math.cos(a) * 0.25 * k, p.y + Math.sin(k * Math.PI) * 0.05, p.z + Math.sin(a) * 0.25 * k);
        o.rotation.set(0, -a, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        for (const m of sk) m.setMatrixAt(i, o.matrix);
      });
      for (const m of sk) m.instanceMatrix.needsUpdate = true;
    }
    // Aasflieger: weite Kreise hoch ueber dem Feld / carrion fliers: wide circles high above the tile
    const fl = this.meshes.flier;
    if (fl?.length) {
      this.fliers.forEach((p, i) => {
        const a = time * 0.35 + p.ph;
        o.position.set(p.x + Math.cos(a) * 1.4, p.y + 1.5 + Math.sin(time * 0.5 + p.ph) * 0.1, p.z + Math.sin(a) * 1.4);
        o.rotation.set(0.3, -a - Math.PI / 2, Math.sin(time * 3 + p.ph) * 0.15);
        o.scale.setScalar(1.3);
        o.updateMatrix();
        for (const m of fl) m.setMatrixAt(i, o.matrix);
      });
      for (const m of fl) m.instanceMatrix.needsUpdate = true;
    }
  }
}
