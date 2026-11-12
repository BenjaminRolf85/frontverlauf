/**
 * Wettereffekte auf dem Diorama: Regenstriche, Schneeflocken, Windboeen (instanziert, guenstig).
 * Weather effects on the diorama: rain streaks, snow flakes, wind gusts (instanced, cheap).
 */
import * as THREE from 'three';
import type { WeatherId } from '../data/balance';
import { hex, semantic } from '../design/tokens';

const TOP = 2.4;

export class WeatherFx {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  kind: WeatherId = 'clear';
  private size = 0;
  private parts: { p: THREE.Vector3; v: THREE.Vector3; phase: number }[] = [];
  private tmp = new THREE.Object3D();
  animate = true;

  get active() { return this.kind !== 'clear'; }

  set(kind: WeatherId, size: number) {
    if (kind === this.kind && size === this.size) return;
    this.kind = kind; this.size = size;
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.dispose(); this.mesh = null; }
    this.parts = [];
    if (kind === 'clear') return;
    let geo: THREE.BufferGeometry, color: string, opacity: number, count: number;
    if (kind === 'rain') { geo = new THREE.BoxGeometry(0.012, 0.22, 0.012); color = semantic.river; opacity = 0.75; count = Math.min(520, size * size * 1.4); }
    else if (kind === 'snow') { geo = new THREE.IcosahedronGeometry(0.045, 0); color = semantic.white; opacity = 1; count = Math.min(560, size * size * 1.5); }
    else { geo = new THREE.BoxGeometry(0.9, 0.02, 0.045); color = semantic.white; opacity = 0.9; count = Math.min(160, size * size * 0.45); }
    const mat = new THREE.MeshBasicMaterial({ color: hex(color), transparent: true, opacity, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.floor(count));
    this.mesh.raycast = () => {};
    this.mesh.renderOrder = 8;
    this.mesh.frustumCulled = false;
    const half = size / 2 + 0.3;
    let seed = 12345 + size;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < this.mesh.count; i++) {
      const p = new THREE.Vector3((rnd() * 2 - 1) * half, rnd() * TOP, (rnd() * 2 - 1) * half);
      const v = kind === 'rain' ? new THREE.Vector3(0.6, -7.5 - rnd() * 2, 0.3)
        : kind === 'snow' ? new THREE.Vector3(0.15, -0.55 - rnd() * 0.35, 0.05)
          : new THREE.Vector3(3.5 + rnd() * 2, 0, 0.8);
      if (kind === 'wind') p.y = 0.15 + rnd() * 0.9;
      this.parts.push({ p, v, phase: rnd() * Math.PI * 2 });
    }
    this.group.add(this.mesh);
    this.update(0);
  }

  /** dt in Sekunden / dt in seconds */
  update(dt: number) {
    if (!this.mesh) return;
    const half = this.size / 2 + 0.3;
    const step = this.animate ? Math.min(dt, 0.05) : 0;
    this.parts.forEach((q, i) => {
      q.p.addScaledVector(q.v, step);
      if (this.kind === 'snow') q.p.x += Math.sin(q.p.y * 3 + q.phase) * step * 0.25;
      if (this.kind === 'wind') {
        if (q.p.x > half) { q.p.x = -half; q.p.z = (Math.sin(q.phase * 7 + q.p.y * 13) * 0.5 + 0.5) * 2 * half - half; }
      } else if (q.p.y < 0) {
        q.p.y += TOP;
        if (q.p.x > half) q.p.x -= 2 * half;
        if (q.p.z > half) q.p.z -= 2 * half;
      }
      this.tmp.position.copy(q.p);
      if (this.kind === 'rain') this.tmp.rotation.set(0.08, 0, -0.08);
      else if (this.kind === 'wind') { this.tmp.rotation.set(0, 0.2, 0); this.tmp.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(q.phase + q.p.x))); }
      this.tmp.updateMatrix();
      this.mesh!.setMatrixAt(i, this.tmp.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
