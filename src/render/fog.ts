/**
 * Kriegsnebel: aufgedeckte Felder verlieren ihre Wolke mit einer kurzen Aufloese-Animation
 * (Wolke steigt, blaeht sich auf und schrumpft weg). Das Treiben der ruhenden Wolken macht der Shader (atmosphere.ts).
 * Fog of war: revealed tiles lose their cloud with a short dissolve animation
 * (cloud rises, puffs up and shrinks away). The drift of resting clouds is done by the shader (atmosphere.ts).
 */
import * as THREE from 'three';
import { cloudMaterial, cloudOutline, withGlow } from './atmosphere';
import { OUTLINE } from './config';
import { outlinedInstanced } from './toon';

/** Dauer des Aufloesens in ms / dissolve duration in ms */
const DISSOLVE_MS = 750;
/** Hoechstzahl gleichzeitig aufloesender Wolken je Variante / max dissolving clouds per variant */
const CAP = 48;

interface Puff { x: number; y: number; z: number; rot: number; start: number; delay: number }

export class FogFx {
  readonly group = new THREE.Group();
  private puffs: Puff[][] = [[], [], []];
  private meshes: { mesh: THREE.InstancedMesh; line: THREE.InstancedMesh }[] = [];
  private tmp = new THREE.Object3D();

  constructor(private geometry: (variant: number) => THREE.BufferGeometry) {}

  private ensure() {
    if (this.meshes.length) return;
    for (let v = 0; v < 3; v++) {
      const pair = outlinedInstanced(withGlow(this.geometry(v), 'none'), CAP, OUTLINE.cloud, cloudMaterial(), cloudOutline(OUTLINE.cloud));
      for (const m of [pair.mesh, pair.line]) { m.raycast = () => {}; m.frustumCulled = false; m.count = 0; this.group.add(m); }
      this.meshes.push(pair);
    }
  }

  /** Wolken auf frisch aufgedeckten Feldern aufloesen / dissolve clouds on freshly revealed tiles */
  reveal(list: { x: number; y: number; z: number; rot: number; variant: number }[], now: number) {
    if (!list.length) return;
    this.ensure();
    list.forEach((p, i) => {
      const bucket = this.puffs[p.variant % 3];
      if (bucket.length >= CAP) bucket.shift();
      // leicht gestaffelt, damit die Wolken nacheinander aufgehen / slightly staggered so clouds open one after another
      bucket.push({ x: p.x, y: p.y, z: p.z, rot: p.rot, start: now, delay: Math.min(260, i * 18) });
    });
  }

  get active() { return this.puffs.some((b) => b.length > 0); }

  /** Fortschreiben; true, wenn neu gezeichnet werden muss / advance; true if a redraw is needed */
  update(now: number): boolean {
    if (!this.meshes.length) return false;
    let any = false;
    this.puffs.forEach((bucket, v) => {
      const { mesh, line } = this.meshes[v];
      const alive = bucket.filter((p) => now - p.start - p.delay < DISSOLVE_MS);
      this.puffs[v] = alive;
      alive.forEach((p, i) => {
        const k = Math.max(0, Math.min(1, (now - p.start - p.delay) / DISSOLVE_MS));
        const shrink = 1 - k * k * k;
        const o = this.tmp;
        o.position.set(p.x, p.y + k * 0.3, p.z);
        o.rotation.set(0, p.rot + k * 0.6, 0);
        o.scale.set((1 + k * 0.45) * shrink, (1 - k * 0.3) * shrink, (1 + k * 0.45) * shrink);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix); line.setMatrixAt(i, o.matrix);
      });
      mesh.count = line.count = alive.length;
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      // auch das letzte Bild nach dem Verschwinden zeichnen / also draw the last frame after vanishing
      if (alive.length || alive.length !== bucket.length) any = true;
    });
    return any;
  }

  /** Alles sofort beenden (z. B. ohne Animationen) / finish everything at once (e.g. without animations) */
  clear() {
    this.puffs = [[], [], []];
    for (const { mesh, line } of this.meshes) mesh.count = line.count = 0;
  }
}
