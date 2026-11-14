/**
 * Lebendige Einheiten: Leerlauf (Atmen, Gewicht verlagern, Motorbrummen, Schweben, Wiegen),
 * Gangarten beim Ziehen (Schritte, Stampfen, Federn, Schaukeln) samt Staub und Kielwasser,
 * dazu Rauch und Flammen an beschaedigten Einheiten.
 * Living units: idle (breathing, weight shifts, engine rumble, hovering, swaying),
 * gaits while moving (steps, stomps, bouncing, rocking) with dust and wake,
 * plus smoke and flames on damaged units.
 *
 * Veraendert nur Position, Skalierung sowie rotation.x/z des inneren 'model'-Objekts (nie rotation.y).
 * Only changes position, scale and rotation.x/z of the inner 'model' object (never rotation.y).
 *
 * Leistung / performance: keine Allokationen pro Bild, Partikel in zwei InstancedMeshes mit fester
 * Obergrenze, Matrizen werden direkt in die Puffer geschrieben.
 * no per-frame allocations, particles live in two capped InstancedMeshes, matrices are written straight
 * into the buffers.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { UNITS, type UnitTypeId } from '../data/balance';
import type { GameState, Unit } from '../core';
import { hex, semantic } from '../design/tokens';
import { hullGeometry, outlineMaterial, paint, toonMaterial } from './toon';

// ---------- Einordnung / classification ----------

export type LifeKind = 'foot' | 'vehicle' | 'walker' | 'flyer' | 'ship';

/** Fusstruppen / foot troops */
const FOOT = new Set<UnitTypeId>(['infantry', 'sniper', 'pioneer', 'mg', 'medic', 'spy', 'zealot', 'torchbearer', 'prophet', 'grey', 'terraformer', 'android', 'antiTank', 'faustZealot']);
/** Laeufer: schwer und langsam / walkers: heavy and slow */
const WALKERS = new Set<UnitTypeId>(['mech', 'tripod', 'titan', 'spider', 'flakDrone']);

/** Bewegungsart einer Einheit / movement class of a unit */
export function lifeKind(type: UnitTypeId): LifeKind {
  const st = UNITS[type];
  if (st.ship) return 'ship';
  if (st.abilities.includes('fly')) return 'flyer';
  if (WALKERS.has(type)) return 'walker';
  if (FOOT.has(type)) return 'foot';
  return 'vehicle';
}

/** 0 = heil, 1 = unter 50 %, 2 = unter 25 % / 0 = fine, 1 = below 50 %, 2 = below 25 % */
export function damageLevel(hp: number, maxHp: number): 0 | 1 | 2 {
  if (maxHp <= 0 || hp <= 0) return 0;
  const r = hp / maxHp;
  return r < 0.25 ? 2 : r < 0.5 ? 1 : 0;
}

// ---------- Grenzen / limits ----------

/** Hoechstzahl gleichzeitiger Rauch-, Staub- und Kielwasser-Ballen / max simultaneous smoke, dust and wake puffs */
export const PUFF_CAP = 160;
/** Hoechstzahl gleichzeitiger Flammen / max simultaneous flames */
export const FLAME_CAP = 32;
/** Zeichenreihenfolge: nach dem Tiefenpuffer-Leeren der Einheiten / render order: after the unit depth clear */
const LIFE_ORDER = 61;

// ---------- Geometrie / geometry ----------

let puffGeo: THREE.BufferGeometry | null = null;
/** Comic-Wolkenballen (weiss, Farbe je Instanz) / comic cloud ball (white, colour per instance) */
function puffGeometry(): THREE.BufferGeometry {
  if (puffGeo) return puffGeo;
  const g = new THREE.IcosahedronGeometry(0.065, 1);
  g.deleteAttribute('uv');
  puffGeo = paint(g, semantic.white);
  return puffGeo;
}

let flameGeo: THREE.BufferGeometry | null = null;
/** Comic-Flamme: gelber Kern, orange und rote Zungen / comic flame: yellow core, orange and red tongues */
function flameGeometry(): THREE.BufferGeometry {
  if (flameGeo) return flameGeo;
  const cone = (r: number, h: number, color: string, tilt: number, turn: number, lift = 0) => {
    const g = new THREE.ConeGeometry(r, h, 5).toNonIndexed();
    g.deleteAttribute('uv');
    g.translate(0, h / 2, 0);
    g.rotateZ(tilt);
    g.rotateY(turn);
    g.translate(0, lift, 0);
    return paint(g, color);
  };
  flameGeo = mergeGeometries([
    cone(0.045, 0.1, semantic.flameCore, 0, 0),
    cone(0.032, 0.17, semantic.flame, 0.12, 0.4, 0.004),
    cone(0.026, 0.13, semantic.flame, -0.38, 2.2),
    cone(0.022, 0.11, semantic.flameTip, 0.42, 4.3),
  ])!;
  return flameGeo;
}

/** Instanzen mit Kontur, die Kontur teilt sich die Matrizen / instances with outline sharing the matrices */
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, outline: number, colors: boolean) {
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  const line = new THREE.InstancedMesh(hullGeometry(geo), outlineMaterial(outline), cap);
  line.instanceMatrix = mesh.instanceMatrix;
  if (colors) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
  for (const m of [mesh, line]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    m.raycast = () => {};
    m.renderOrder = LIFE_ORDER;
  }
  return { mesh, line };
}

/** Matrix ohne Drehung direkt schreiben / write a matrix without rotation directly */
function writeMatrix(a: Float32Array | number[], i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const o = i * 16;
  a[o] = sx; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = sz; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}

// ---------- Partikel-Pool / particle pool ----------

/** Ballen: Rauch, Staub, Kielwasser; Lebensdauer 0 = statisch / puffs: smoke, dust, wake; lifetime 0 = static */
class Puffs {
  readonly mesh: THREE.InstancedMesh;
  readonly line: THREE.InstancedMesh;
  n = 0;
  private px = new Float32Array(PUFF_CAP); private py = new Float32Array(PUFF_CAP); private pz = new Float32Array(PUFF_CAP);
  private vx = new Float32Array(PUFF_CAP); private vy = new Float32Array(PUFF_CAP); private vz = new Float32Array(PUFF_CAP);
  private age = new Float32Array(PUFF_CAP); private life = new Float32Array(PUFF_CAP);
  private size = new Float32Array(PUFF_CAP); private grow = new Float32Array(PUFF_CAP); private flat = new Float32Array(PUFF_CAP);
  private col: Float32Array;
  /** alle Spalten fuer das Tauschen beim Entfernen / all columns for swapping on removal */
  private cols: Float32Array[];

  constructor() {
    const { mesh, line } = instanced(puffGeometry(), toonMaterial(), PUFF_CAP, 0.009, true);
    this.mesh = mesh; this.line = line;
    this.col = mesh.instanceColor!.array as Float32Array;
    this.cols = [this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.age, this.life, this.size, this.grow, this.flat];
  }

  /** neuer Ballen; false, wenn der Pool voll ist / new puff; false when the pool is full */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, grow: number, flat: number, c: THREE.Color): boolean {
    if (this.n >= PUFF_CAP) return false;
    const i = this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size; this.grow[i] = grow; this.flat[i] = flat;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    return true;
  }

  get free() { return PUFF_CAP - this.n; }

  clear() { this.n = 0; this.mesh.count = this.line.count = 0; }

  private remove(i: number) {
    const j = --this.n;
    if (i === j) return;
    for (let k = 0; k < this.cols.length; k++) this.cols[k][i] = this.cols[k][j];
    this.col[i * 3] = this.col[j * 3]; this.col[i * 3 + 1] = this.col[j * 3 + 1]; this.col[i * 3 + 2] = this.col[j * 3 + 2];
  }

  /** altern, bewegen, schreiben / age, move, write */
  step(dt: number) {
    const drag = Math.max(0, 1 - dt * 2.2);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.remove(i); i--; continue; }
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      this.vx[i] *= drag; this.vz[i] *= drag;
    }
    this.write();
  }

  write() {
    const a = this.mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      let s = this.size[i];
      if (this.life[i] > 0) {
        // schnell aufquellen, langsam zusammenschrumpfen / swell quickly, shrink slowly
        const k = this.age[i] / this.life[i];
        const env = k < 0.18 ? k / 0.18 : 1 - Math.pow((k - 0.18) / 0.82, 2);
        s *= Math.max(0.001, env) * (1 + this.grow[i] * k);
      }
      writeMatrix(a, i, this.px[i], this.py[i], this.pz[i], s, s * this.flat[i], s);
    }
    this.mesh.count = this.line.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
}

// ---------- Einheiten / units ----------

interface Rec {
  id: number;
  group: THREE.Object3D;
  model: THREE.Object3D;
  kind: LifeKind;
  /** Phase aus der Kennung, damit nicht alle im Gleichtakt atmen / phase from the id so not all breathe in sync */
  phase: number;
  restY: number;
  restS: number;
  /** Oberkante und halbe Breite des Modells / model top and half width */
  top: number;
  half: number;
  dmg: 0 | 1 | 2;
  /** keine Effekte (getauchtes U-Boot) / no effects (submerged submarine) */
  quiet: boolean;
  moving: boolean;
  /** Fortschritt 0..1 und zurueckgelegte Felder / progress 0..1 and tiles travelled */
  mt: number;
  mf: number;
  /** je Pfadpunkt: 1 = Wasser, 2 = Strasse / per path point: 1 = water, 2 = road */
  ground: number[];
  lastStep: number;
  smokeAcc: number;
  trailAcc: number;
  seen: boolean;
}

const tmpColor = new THREE.Color();
const COLORS = {
  smoke: new THREE.Color(hex(semantic.smoke)),
  heavy: new THREE.Color(hex(semantic.smokeHeavy)),
  dust: new THREE.Color(hex(semantic.dust)),
  wake: new THREE.Color(hex(semantic.wake)),
};
const rnd = Math.random;
const TAU = Math.PI * 2;

export class UnitLife {
  readonly group = new THREE.Group();
  /** sparsamer Modus (XR): keine Staub- und Kielwasserspur / lite mode (XR): no dust and wake trails */
  lite = false;
  /** Einheit gerade in einer fremden Animation (z. B. Angriff) / unit busy in another animation (e.g. attack) */
  busy: (id: number) => boolean = () => false;
  private recs = new Map<number, Rec>();
  private list: Rec[] = [];
  private puffs = new Puffs();
  private flames: { mesh: THREE.InstancedMesh; line: THREE.InstancedMesh };
  private last = 0;
  /** letzter Modus: animiert oder statisch / last mode: animated or static */
  private animated: boolean | null = null;
  private staticDirty = true;

  constructor() {
    this.flames = instanced(flameGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), FLAME_CAP, 0.008, false);
    this.group.add(this.puffs.mesh, this.puffs.line, this.flames.mesh, this.flames.line);
  }

  /** Anzahl lebender Partikel (fuer Tests) / number of live particles (for tests) */
  get particleCount() { return this.puffs.n + this.flames.mesh.count; }

  /** Einheit beobachten oder auffrischen / track or refresh a unit */
  track(u: Unit, group: THREE.Object3D, model: THREE.Object3D, restY: number, restScale: number, quiet: boolean) {
    let r = this.recs.get(u.id);
    if (r && r.model !== model) { this.untrack(u.id); r = undefined; }
    const dmg = damageLevel(u.hp, u.maxHp);
    if (!r) {
      const geo = (model.userData.mesh as THREE.Mesh | undefined)?.geometry;
      if (geo && !geo.boundingBox) geo.computeBoundingBox();
      const bb = geo?.boundingBox;
      const top = (bb ? bb.max.y : 0.3) * restScale;
      const half = (bb ? Math.max(-bb.min.x, bb.max.x, 0.05) : 0.15) * restScale;
      // Gieren zuerst, dann Neigen und Rollen relativ zur Blickrichtung / yaw first, then pitch and roll relative to facing
      model.rotation.order = 'YXZ';
      r = {
        id: u.id, group, model, kind: lifeKind(u.type), phase: ((u.id * 2.399963) % TAU),
        restY, restS: restScale, top, half, dmg, quiet,
        moving: false, mt: 0, mf: 0, ground: [], lastStep: 0, smokeAcc: rnd(), trailAcc: 0, seen: true,
      };
      this.recs.set(u.id, r);
      this.list.push(r);
    }
    if (r.dmg !== dmg || r.quiet !== quiet || r.restY !== restY) this.staticDirty = true;
    r.dmg = dmg; r.quiet = quiet; r.restY = restY; r.seen = true;
  }

  /** nach dem Abgleich: nicht mehr sichtbare Einheiten loslassen / after a sync: release units no longer visible */
  endSync(seen: Set<number>) {
    for (const r of [...this.list]) if (!seen.has(r.id)) this.untrack(r.id);
    this.staticDirty = true;
  }

  /** Einheit loslassen (Tod, unsichtbar), Ruhehaltung herstellen / release a unit (death, invisible), restore rest pose */
  untrack(id: number) {
    const r = this.recs.get(id);
    if (!r) return;
    this.rest(r, false);
    this.recs.delete(id);
    const i = this.list.indexOf(r);
    if (i >= 0) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    this.staticDirty = true;
  }

  /** Zug beginnt / a move starts */
  startMove(s: GameState, id: number, points: { x: number; y: number }[]) {
    const r = this.recs.get(id);
    if (!r) return;
    r.moving = true; r.mt = 0; r.mf = 0; r.lastStep = 0; r.trailAcc = 0;
    r.ground = points.map((p) => {
      const t = s.tiles[p.y * s.size + p.x];
      if (!t) return 0;
      if (t.terrain === 'shallow' || t.terrain === 'ocean') return t.building === 'bridge' ? 2 : 1;
      return t.road || t.cityId !== null ? 2 : 0;
    });
  }

  /** Fortschritt eines Zuges: t 0..1, f = zurueckgelegte Felder / move progress: t 0..1, f = tiles travelled */
  moveFrame(id: number, t: number, f: number) {
    const r = this.recs.get(id);
    if (!r) return;
    r.mt = t; r.mf = f;
    if (t >= 1) { r.moving = false; this.staticDirty = true; if (!this.animated) this.rest(r, true); }
  }

  /** Ruhehaltung (optional mit Zusammensacken) / rest pose (optionally slumped) */
  private rest(r: Rec, slump: boolean) {
    const m = r.model;
    const sl = slump && r.kind === 'foot' && r.dmg === 2;
    m.position.y = r.restY;
    m.scale.set(r.restS, r.restS * (sl ? 0.95 : 1), r.restS);
    m.rotation.x = sl ? 0.14 : 0;
    m.rotation.z = 0;
  }

  /**
   * Pro Bild; true, wenn neu gezeichnet werden muss (nur im statischen Modus relevant).
   * Per frame; true when a redraw is needed (only relevant in static mode).
   */
  update(now: number, animations: boolean): boolean {
    const dt = this.last ? Math.min(0.1, Math.max(0, (now - this.last) / 1000)) : 0;
    this.last = now;
    if (animations !== this.animated) {
      this.animated = animations;
      this.puffs.clear();
      this.flames.mesh.count = this.flames.line.count = 0;
      this.staticDirty = true;
    }
    if (!animations) return this.updateStatic();
    const time = now / 1000;
    let flames = 0;
    for (let i = 0; i < this.list.length; i++) {
      const r = this.list[i];
      if (!r.group.visible) continue;
      if (r.moving || !this.busy(r.id)) this.pose(r, time);
      else this.rest(r, true);
      this.emit(r, dt);
      flames = this.placeFlames(r, time, flames);
    }
    this.puffs.step(dt);
    this.flames.mesh.count = this.flames.line.count = flames;
    if (flames) this.flames.mesh.instanceMatrix.needsUpdate = true;
    return false;
  }

  // ---------- Haltung / pose ----------

  private pose(r: Rec, t: number) {
    const p = r.phase;
    let y = 0, rx = 0, rz = 0, sy = 1, sxz = 1;
    if (r.moving) {
      const f = r.mf;
      // Ein- und Ausblenden der Neigung / ease the lean in and out
      const env = Math.min(1, r.mt * 6, (1 - r.mt) * 6);
      switch (r.kind) {
        case 'foot': {
          // zwei Schritte je Feld mit Vorlage und Watscheln / two steps per tile with lean and waddle
          const w = Math.sin(f * TAU);
          const st = Math.abs(w);
          y = 0.055 * st;
          sy = 1 + 0.05 * (st - 0.4);
          sxz = 1 - 0.02 * (st - 0.4);
          rx = 0.2 * env;
          rz = 0.07 * w;
          break;
        }
        case 'walker': {
          // ein schwerer Stampfer je Feld, Stauchen beim Aufsetzen / one heavy stomp per tile, squash on landing
          const w = Math.sin(f * Math.PI);
          const st = Math.abs(w);
          y = 0.05 * st * st;
          sy = 1 - 0.09 * Math.pow(1 - st, 6);
          sxz = 1 + 0.04 * Math.pow(1 - st, 6);
          rx = 0.07 * env;
          rz = 0.06 * w;
          break;
        }
        case 'vehicle': {
          // leichtes Federn, Nase hoch beim Anfahren, Nicken beim Bremsen / light bounce, nose up when starting, dip when braking
          y = 0.014 * Math.abs(Math.sin(f * Math.PI * 4 + p)) + 0.004 * Math.sin(t * 41 + p);
          rx = -0.07 * Math.sin(r.mt * TAU);
          rz = 0.025 * Math.sin(f * Math.PI * 3 + p);
          break;
        }
        case 'ship': {
          // Bug hebt sich, Rumpf schaukelt / bow rises, hull rocks
          rx = -0.07 * Math.sin(r.mt * Math.PI);
          rz = 0.09 * Math.sin(r.mt * TAU + p);
          y = 0.012 * Math.sin(t * 3 + p);
          break;
        }
        case 'flyer': {
          // weiter schweben, Nase nach vorn geneigt / keep hovering, nose tilted forward
          y = 0.03 * Math.sin(t * 1.7 + p);
          rx = 0.22 * env;
          rz = 0.04 * Math.sin(t * 1.1 + p);
          break;
        }
      }
    } else {
      switch (r.kind) {
        case 'foot': {
          // Atmen und gelegentliches Gewichtverlagern / breathing and occasional weight shift
          const br = Math.sin(t * 2.3 + p);
          sy = 1 + 0.022 * br;
          sxz = 1 - 0.008 * br;
          const c = t * 0.14 + p * 0.37;
          const ci = Math.floor(c), cf = c - ci;
          if (cf < 0.2) rz = 0.06 * Math.sin((cf / 0.2) * Math.PI) * ((ci & 1) ? 1 : -1);
          break;
        }
        case 'vehicle': {
          // Motorbrummen: feines, schnelles Zittern / engine rumble: fine, fast jitter
          y = 0.0035 * (Math.sin(t * 38 + p) + Math.sin(t * 53 + p * 3));
          rx = 0.004 * Math.sin(t * 29 + p);
          break;
        }
        case 'flyer': {
          // langsames Auf und Ab mit leichter Neigung / slow bob with slight tilt
          y = 0.03 * Math.sin(t * 1.7 + p);
          rz = 0.05 * Math.sin(t * 1.1 + p * 1.3);
          rx = 0.035 * Math.sin(t * 1.35 + p * 0.7);
          break;
        }
        case 'walker': {
          // langsames, schweres Wiegen / slow, heavy sway
          rz = 0.035 * Math.sin(t * 0.8 + p);
          rx = 0.02 * Math.sin(t * 0.6 + p * 1.5);
          sy = 1 + 0.01 * Math.sin(t * 1.6 + p);
          break;
        }
        case 'ship': {
          // Duenung / swell
          rz = 0.055 * Math.sin(t * 1.25 + p);
          rx = 0.03 * Math.sin(t * 0.95 + p * 1.3);
          y = 0.008 * Math.sin(t * 1.5 + p);
          break;
        }
      }
    }
    // schwer verletzte Fusstruppen sacken zusammen / badly hurt foot troops slump
    if (r.dmg === 2 && r.kind === 'foot') { rx += 0.14; sy *= 0.95; }
    const m = r.model;
    m.position.y = r.restY + y;
    m.scale.set(r.restS * sxz, r.restS * sy, r.restS * sxz);
    m.rotation.x = rx;
    m.rotation.z = rz;
  }

  // ---------- Partikel / particles ----------

  /** Rauchquelle in Brettkoordinaten / smoke source in board coordinates */
  private anchor(r: Rec, side: number, height: number, out: THREE.Vector3) {
    const yaw = r.model.rotation.y;
    const ox = side * r.half * 0.45, oz = -r.half * 0.25;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    out.set(r.group.position.x + ox * c + oz * s, r.group.position.y + r.model.position.y + height, r.group.position.z - ox * s + oz * c);
  }

  private emit(r: Rec, dt: number) {
    if (!dt || r.quiet) return;
    const pos = r.group.position;
    // Schaden: Rauchfahne / damage: smoke plume
    if (r.dmg > 0 && !(r.kind === 'foot' && r.dmg < 2)) {
      const foot = r.kind === 'foot';
      const heavy = r.dmg === 2 && !foot;
      const rate = (foot ? 2.2 : heavy ? 7 : 3) * (this.lite ? 0.5 : 1);
      r.smokeAcc += dt * rate;
      while (r.smokeAcc >= 1) {
        r.smokeAcc -= 1;
        this.anchor(r, heavy ? (rnd() < 0.5 ? -1 : 1) : 0.6, foot ? r.top * 0.35 : r.top * 0.8, v3);
        const c = foot ? tmpColor.copy(COLORS.dust).lerp(COLORS.smoke, 0.5) : heavy ? COLORS.heavy : COLORS.smoke;
        this.puffs.spawn(
          v3.x + (rnd() - 0.5) * 0.04, v3.y, v3.z + (rnd() - 0.5) * 0.04,
          0.06 + rnd() * 0.05, (foot ? 0.18 : 0.32) + rnd() * 0.12, (rnd() - 0.5) * 0.06,
          (heavy ? 1.7 : foot ? 0.9 : 1.4) + rnd() * 0.5,
          heavy ? 0.95 : foot ? 0.55 : 0.6, heavy ? 2.6 : 1.8, 1, c);
      }
    }
    if (!r.moving || this.lite) return;
    // Untergrund an der aktuellen Stelle / ground at the current spot
    const n = r.ground.length;
    const gi = Math.max(0, Math.min(n - 1, Math.round(r.mf)));
    const g = n ? r.ground[gi] : 0;
    const yaw = r.model.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    switch (r.kind) {
      case 'vehicle': {
        // Staubwolken hinter dem Fahrzeug, auf Strassen weniger / dust clouds behind the vehicle, fewer on roads
        if (g === 1) break;
        r.trailAcc += dt * (g === 2 ? 12 : 30);
        while (r.trailAcc >= 1) {
          r.trailAcc -= 1;
          const lat = (rnd() - 0.5) * 2;
          this.puffs.spawn(
            pos.x - fx * 0.3 + fz * lat * 0.14, pos.y + 0.035, pos.z - fz * 0.3 - fx * lat * 0.14,
            -fx * 0.25 + fz * lat * 0.3, 0.12 + rnd() * 0.1, -fz * 0.25 - fx * lat * 0.3,
            0.55 + rnd() * 0.3, g === 2 ? 0.55 : 0.8, 1.4, 1, COLORS.dust);
        }
        break;
      }
      case 'ship': {
        // kurzes weisses Kielwasser / short white wake
        if (g !== 1) break;
        r.trailAcc += dt * 26;
        while (r.trailAcc >= 1) {
          r.trailAcc -= 1;
          const side = rnd() < 0.5 ? -1 : 1;
          this.puffs.spawn(
            pos.x - fx * 0.32 + fz * side * 0.06, pos.y + 0.012, pos.z - fz * 0.32 - fx * side * 0.06,
            fz * side * 0.4 - fx * 0.1, 0, -fx * side * 0.4 - fz * 0.1,
            0.7 + rnd() * 0.3, 0.9, 1.6, 0.28, COLORS.wake);
        }
        break;
      }
      case 'walker':
      case 'foot': {
        // Staub beim Aufsetzen der Fuesse / dust when the feet land
        if (g === 1) break;
        const steps = Math.floor(r.mf * (r.kind === 'foot' ? 2 : 1) + 0.0001);
        if (steps <= r.lastStep) break;
        r.lastStep = steps;
        const big = r.kind === 'walker';
        const k = big ? 7 : 2;
        for (let i = 0; i < k; i++) {
          const a = (i / k) * TAU + rnd();
          const sp = big ? 0.55 : 0.25;
          this.puffs.spawn(pos.x + Math.cos(a) * 0.1, pos.y + 0.03, pos.z + Math.sin(a) * 0.1,
            Math.cos(a) * sp, 0.08, Math.sin(a) * sp, 0.45 + rnd() * 0.2, big ? 0.8 : (g === 2 ? 0.35 : 0.45), 1.2, 1, COLORS.dust);
        }
        break;
      }
    }
  }

  /** flackernde Flammen an schwer beschaedigten Fahrzeugen / flickering flames on badly damaged vehicles */
  private placeFlames(r: Rec, t: number, n: number): number {
    if (r.dmg < 2 || r.kind === 'foot' || r.quiet) return n;
    const a = this.flames.mesh.instanceMatrix.array as Float32Array;
    const count = r.kind === 'flyer' ? 1 : 2;
    for (let k = 0; k < count && n < FLAME_CAP; k++) {
      this.anchor(r, k ? -0.8 : 0.9, r.top * (k ? 0.62 : 0.72), v3);
      const ph = r.phase + k * 2.1;
      const flick = 1 + 0.28 * Math.sin(t * 17 + ph) + 0.14 * Math.sin(t * 31 + ph * 2);
      const wide = 1 - 0.12 * Math.sin(t * 23 + ph);
      const base = (k ? 1.1 : 1.4) * (r.kind === 'walker' || r.kind === 'ship' ? 1.15 : 1);
      writeMatrix(a, n, v3.x, v3.y - 0.03, v3.z, base * wide, base * flick, base * wide);
      n++;
    }
    return n;
  }

  /** Ohne Animationen: Ruhehaltung und stehende Rauchballen / without animations: rest pose and still smoke puffs */
  private updateStatic(): boolean {
    if (!this.staticDirty) return false;
    this.staticDirty = false;
    this.puffs.clear();
    const a = this.flames.mesh.instanceMatrix.array as Float32Array;
    let flames = 0;
    for (const r of this.list) {
      if (!r.moving) this.rest(r, true);
      if (r.quiet || !r.dmg || !r.group.visible) continue;
      if (r.kind === 'foot') {
        if (r.dmg < 2) continue;
        this.anchor(r, 0.6, r.top * 0.45, v3);
        this.puffs.spawn(v3.x, v3.y, v3.z, 0, 0, 0, 0, 0.7, 0, 1, tmpColor.copy(COLORS.dust).lerp(COLORS.smoke, 0.5));
        continue;
      }
      const heavy = r.dmg === 2;
      const c = heavy ? COLORS.heavy : COLORS.smoke;
      this.anchor(r, 0.6, r.top * 0.85, v3);
      const puffs = heavy ? 3 : 2;
      for (let i = 0; i < puffs; i++) {
        this.puffs.spawn(v3.x + i * 0.035, v3.y + i * 0.09, v3.z - i * 0.01, 0, 0, 0, 0, (heavy ? 0.95 : 0.7) * (1 + i * 0.35), 0, 1, c);
      }
      if (heavy) {
        for (let k = 0; k < 2 && flames < FLAME_CAP; k++) {
          this.anchor(r, k ? -0.8 : 0.9, r.top * (k ? 0.62 : 0.72), v3);
          const s = k ? 1.1 : 1.4;
          writeMatrix(a, flames++, v3.x, v3.y - 0.03, v3.z, s, s, s);
        }
      }
    }
    this.puffs.write();
    this.flames.mesh.count = this.flames.line.count = flames;
    this.flames.mesh.instanceMatrix.needsUpdate = true;
    return true;
  }
}

const v3 = new THREE.Vector3();
