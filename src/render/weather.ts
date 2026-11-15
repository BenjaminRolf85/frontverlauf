/**
 * Wettereffekte auf dem Diorama: Regenstriche, Schneeflocken, Windboeen, Saeureregen (gruengelb), Sandsturm (ockerne
 * Staubfahnen), Meteorschauer (gluehende Schweifstriche) und Erdbeben (Staub und Splitter aus dem Gewoelbe, kurz
 * gluehende Bodenrisse). Instanziert, guenstig, bei niedriger Qualitaet weniger.
 * In der Hoehle statt Regen und Schnee: fallende Tropfen und schwebende, leicht leuchtende Staubflocken.
 * Weather effects on the diorama: rain streaks, snow flakes, wind gusts, acid rain (green-yellow), dust storm (ochre dust
 * plumes), meteor shower (glowing trail streaks) and earthquake (dust and splinters from the vault, briefly glowing floor
 * cracks). Instanced, cheap, fewer on low quality.
 * In the cavern instead of rain and snow: falling drips and floating, faintly glowing dust motes.
 */
import * as THREE from 'three';
import type { WeatherId } from '../data/balance';
import { hex, semantic } from '../design/tokens';
import { dripGeometry } from './models/cavern';
import { glowColor } from './post';

const TOP = 2.4;
/** Dauer eines Einschlags (Meteor, Saeure) und der gluehenden Bebenrisse in s / duration of an impact and the glowing quake cracks in s */
const IMPACT_S = 0.9, CRACK_S = 2.4;

export class WeatherFx {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  kind: WeatherId = 'clear';
  private size = 0;
  private parts: { p: THREE.Vector3; v: THREE.Vector3; phase: number }[] = [];
  private tmp = new THREE.Object3D();
  animate = true;
  /** Hoehlenpartikel: Tropfen und Staub / cavern particles: drips and dust */
  private cave: { mesh: THREE.InstancedMesh; drip: boolean; parts: { p: THREE.Vector3; v: THREE.Vector3; phase: number }[] }[] = [];
  private caveKey = '';
  /** Einschlaege: Blitz und Rauchwoelkchen / impacts: flash and smoke puffs */
  private impacts: { mesh: THREE.Mesh; age: number; acid: boolean }[] = [];
  /** Bebenrisse / quake cracks */
  private cracks: THREE.InstancedMesh | null = null;
  private crackAge = 0;

  get active() { return this.kind !== 'clear' || this.cave.length > 0 || this.impacts.length > 0 || !!this.cracks; }

  /** cave = Hoehle (kein Regen und Schnee), low = niedrige Qualitaet / cave = cavern (no rain or snow), low = low quality */
  set(kind: WeatherId, size: number, cave = false, low = false) {
    const ck = cave ? `${size}-${low}` : '';
    if (kind === this.kind && size === this.size && ck === this.caveKey) return;
    if (ck !== this.caveKey) this.buildCave(cave, size, low);
    this.caveKey = ck;
    // unter Tage nur Wind (Luftzug) und Erdbeben / underground only wind (draught) and earthquakes
    if (cave && kind !== 'wind' && kind !== 'quake') kind = 'clear';
    if (kind === this.kind && size === this.size) return;
    this.kind = kind; this.size = size;
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.dispose(); this.mesh = null; }
    this.clearCracks();
    this.parts = [];
    if (kind === 'clear') return;
    const k = low ? 0.5 : 1;
    let geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, opacity: number, count: number;
    if (kind === 'rain') { geo = new THREE.BoxGeometry(0.012, 0.22, 0.012); color = hex(semantic.river); opacity = 0.75; count = Math.min(520, size * size * 1.4); }
    else if (kind === 'acid') { geo = new THREE.BoxGeometry(0.014, 0.2, 0.014); color = glowColor(hex(semantic.acidRain), 1.3); opacity = 0.8; count = Math.min(480, size * size * 1.3); }
    else if (kind === 'snow') { geo = new THREE.IcosahedronGeometry(0.045, 0); color = hex(semantic.white); opacity = 1; count = Math.min(560, size * size * 1.5); }
    else if (kind === 'dust') { geo = new THREE.BoxGeometry(0.7, 0.05, 0.12); color = hex(semantic.desertDust); opacity = 0.55; count = Math.min(380, size * size * 1.1); }
    else if (kind === 'meteor') { geo = new THREE.BoxGeometry(0.03, 0.5, 0.03); color = glowColor(hex(semantic.riftGold), 2.2); opacity = 0.95; count = Math.min(40, size * 2); }
    else if (kind === 'quake') { geo = new THREE.DodecahedronGeometry(0.03, 0); color = hex(semantic.caveDust); opacity = 0.9; count = Math.min(260, size * size * 0.6); }
    else { geo = new THREE.BoxGeometry(0.9, 0.02, 0.045); color = hex(semantic.white); opacity = 0.9; count = Math.min(160, size * size * 0.45); }
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, Math.floor(count * k)));
    this.mesh.raycast = () => {};
    this.mesh.renderOrder = 8;
    this.mesh.frustumCulled = false;
    const half = size / 2 + 0.3;
    let seed = 12345 + size;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < this.mesh.count; i++) {
      const p = new THREE.Vector3((rnd() * 2 - 1) * half, rnd() * TOP, (rnd() * 2 - 1) * half);
      const v = kind === 'rain' || kind === 'acid' ? new THREE.Vector3(0.6, -7.5 - rnd() * 2, 0.3)
        : kind === 'snow' ? new THREE.Vector3(0.15, -0.55 - rnd() * 0.35, 0.05)
          : kind === 'dust' ? new THREE.Vector3(2.6 + rnd() * 1.8, (rnd() - 0.5) * 0.2, 0.9 + rnd() * 0.6)
            : kind === 'meteor' ? new THREE.Vector3(2.2, -6 - rnd() * 3, 1.2)
              : kind === 'quake' ? new THREE.Vector3((rnd() - 0.5) * 0.2, -1.4 - rnd() * 1.6, (rnd() - 0.5) * 0.2)
                : new THREE.Vector3(3.5 + rnd() * 2, 0, 0.8);
      if (kind === 'wind') p.y = 0.15 + rnd() * 0.9;
      if (kind === 'dust') p.y = 0.05 + rnd() * 0.8;
      this.parts.push({ p, v, phase: rnd() * Math.PI * 2 });
    }
    this.group.add(this.mesh);
    if (kind === 'quake') this.buildCracks(size, rnd, low);
    this.update(0);
  }

  /** Gluehende Risse im Hoehlenboden, klingen nach CRACK_S ab / glowing cracks in the cavern floor, fade after CRACK_S */
  private buildCracks(size: number, rnd: () => number, low: boolean) {
    const n = Math.floor(Math.min(low ? 20 : 48, size * 2));
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.012, 0.03), new THREE.MeshBasicMaterial({ color: glowColor(hex(semantic.caveLantern), 2), transparent: true, opacity: 0.9, depthWrite: false }), n);
    const half = size / 2 - 0.5;
    for (let i = 0; i < n; i++) {
      this.tmp.position.set((rnd() * 2 - 1) * half, 0.07, (rnd() * 2 - 1) * half);
      this.tmp.rotation.set(0, rnd() * Math.PI, 0);
      this.tmp.scale.set(0.6 + rnd(), 1, 1);
      this.tmp.updateMatrix();
      m.setMatrixAt(i, this.tmp.matrix);
    }
    m.raycast = () => {}; m.renderOrder = 9; m.frustumCulled = false;
    this.cracks = m;
    this.crackAge = 0;
    this.group.add(m);
  }

  private clearCracks() {
    if (!this.cracks) return;
    this.group.remove(this.cracks);
    this.cracks.dispose();
    this.cracks = null;
  }

  /**
   * Einschlag auf einem Feld: Meteor = gluehender Blitz, Saeure = gruenes Zischen mit Rauch (nur mit Animationen aufgerufen).
   * Impact on a tile: meteor = glowing flash, acid = green hiss with smoke (only called with animations).
   */
  impact(at: THREE.Vector3, kind: 'meteor' | 'acid') {
    const acid = kind === 'acid';
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(acid ? 0.12 : 0.22, 1),
      new THREE.MeshBasicMaterial({ color: acid ? hex(semantic.acidRain) : glowColor(hex(semantic.riftGold), 2.4), transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(at).add(new THREE.Vector3(0, acid ? 0.3 : 0.12, 0));
    m.raycast = () => {}; m.renderOrder = 9;
    this.impacts.push({ mesh: m, age: 0, acid });
    this.group.add(m);
  }

  private buildCave(on: boolean, size: number, low: boolean) {
    for (const c of this.cave) { this.group.remove(c.mesh); c.mesh.dispose(); }
    this.cave = [];
    if (!on) return;
    let seed = 777 + size;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const half = size / 2 + 0.3;
    const make = (drip: boolean, count: number) => {
      const geo = drip ? dripGeometry() : new THREE.IcosahedronGeometry(0.018, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: drip ? hex(semantic.cavePoolShore) : glowColor(hex(semantic.caveCrystal), 1.4), transparent: true, opacity: drip ? 0.85 : 0.75, depthWrite: false,
        vertexColors: false,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.raycast = () => {}; mesh.renderOrder = 8; mesh.frustumCulled = false;
      const parts = Array.from({ length: count }, () => ({
        p: new THREE.Vector3((rnd() * 2 - 1) * half, rnd() * TOP, (rnd() * 2 - 1) * half),
        v: drip ? new THREE.Vector3(0, -3.2 - rnd() * 1.5, 0) : new THREE.Vector3((rnd() - 0.5) * 0.08, 0.03 + rnd() * 0.05, (rnd() - 0.5) * 0.08),
        phase: rnd() * Math.PI * 2,
      }));
      this.group.add(mesh);
      this.cave.push({ mesh, drip, parts });
    };
    make(true, Math.floor(Math.min(low ? 50 : 120, size * size * 0.2)));
    make(false, Math.floor(Math.min(low ? 120 : 320, size * size * 0.5)));
    this.updateCave(0);
  }

  private updateCave(dt: number) {
    const half = this.size / 2 + 0.3;
    const step = this.animate ? Math.min(dt, 0.05) : 0;
    for (const c of this.cave) {
      c.parts.forEach((q, i) => {
        q.p.addScaledVector(q.v, step);
        if (c.drip) {
          // Tropfen faellt bis zum Boden und beginnt oben neu / drip falls to the floor and restarts at the top
          if (q.p.y < 0) q.p.y += TOP;
          this.tmp.scale.setScalar(1);
        } else {
          q.p.x += Math.sin(q.phase + q.p.y * 2) * step * 0.05;
          if (q.p.y > TOP * 0.6) q.p.y = 0.05;
          this.tmp.scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(q.phase + q.p.y * 3)));
        }
        if (Math.abs(q.p.x) > half) q.p.x = -Math.sign(q.p.x) * half;
        this.tmp.position.copy(q.p);
        this.tmp.rotation.set(0, 0, 0);
        this.tmp.updateMatrix();
        c.mesh.setMatrixAt(i, this.tmp.matrix);
      });
      c.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** dt in Sekunden / dt in seconds */
  update(dt: number) {
    if (this.cave.length) this.updateCave(dt);
    const step = this.animate ? Math.min(dt, 0.05) : 0;
    // Einschlaege und Risse klingen ab / impacts and cracks fade
    for (const im of [...this.impacts]) {
      im.age += this.animate ? Math.min(dt, 0.05) : IMPACT_S;
      const k = im.age / IMPACT_S;
      (im.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
      im.mesh.scale.setScalar(im.acid ? 1 + k * 1.5 : 0.6 + k * 2.2);
      if (im.acid) im.mesh.position.y += step * 0.4;
      if (k >= 1) { this.group.remove(im.mesh); im.mesh.geometry.dispose(); (im.mesh.material as THREE.Material).dispose(); this.impacts.splice(this.impacts.indexOf(im), 1); }
    }
    if (this.cracks) {
      this.crackAge += this.animate ? Math.min(dt, 0.05) : CRACK_S;
      const k = Math.min(1, this.crackAge / CRACK_S);
      (this.cracks.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k) * (0.7 + 0.3 * Math.sin(this.crackAge * 18));
      if (k >= 1) this.clearCracks();
    }
    if (!this.mesh) return;
    const half = this.size / 2 + 0.3;
    this.parts.forEach((q, i) => {
      q.p.addScaledVector(q.v, step);
      if (this.kind === 'snow') q.p.x += Math.sin(q.p.y * 3 + q.phase) * step * 0.25;
      if (this.kind === 'wind' || this.kind === 'dust') {
        if (this.kind === 'dust') q.p.y += Math.sin(q.phase + q.p.x * 1.3) * step * 0.3;
        if (q.p.x > half) { q.p.x = -half; q.p.z = (Math.sin(q.phase * 7 + q.p.y * 13) * 0.5 + 0.5) * 2 * half - half; }
        if (q.p.z > half) q.p.z -= 2 * half;
      } else if (q.p.y < 0) {
        q.p.y += TOP;
        if (q.p.x > half) q.p.x -= 2 * half;
        if (q.p.z > half) q.p.z -= 2 * half;
      }
      this.tmp.position.copy(q.p);
      this.tmp.scale.setScalar(1);
      if (this.kind === 'rain' || this.kind === 'acid') this.tmp.rotation.set(0.08, 0, -0.08);
      else if (this.kind === 'meteor') this.tmp.rotation.set(0.2, 0, -0.35);
      else if (this.kind === 'quake') { this.tmp.rotation.set(q.phase, q.p.y * 3, 0); this.tmp.scale.setScalar(0.5 + (i % 5) * 0.35); }
      else if (this.kind === 'dust') { this.tmp.rotation.set(0, 0.35, 0); this.tmp.scale.set(0.7 + 0.6 * Math.abs(Math.sin(q.phase + q.p.x)), 1, 1); }
      else if (this.kind === 'wind') { this.tmp.rotation.set(0, 0.2, 0); this.tmp.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(q.phase + q.p.x))); }
      this.tmp.updateMatrix();
      this.mesh!.setMatrixAt(i, this.tmp.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
