/**
 * Sichtbarer Kampf: Muendungsfeuer, Leuchtspur, Granaten, Raketen, Strahlen, Einschlaege, Rueckstoss und Ausrichtung.
 * Alle Effekte sind kurzlebige Objekte aus Pools (keine neuen Geometrien pro Schuss) und enden nach spaetestens ~900 ms.
 * Visible combat: muzzle flashes, tracers, shells, rockets, beams, impacts, recoil and facing.
 * All effects are short-lived pooled objects (no new geometry per shot) and end after at most ~900 ms.
 *
 * Waffenarten kommen aus derselben Tabelle wie die Waffengeraeusche (audio.ts).
 * Weapon kinds come from the same table as the weapon sounds (audio.ts).
 */
import * as THREE from 'three';
import type { FactionId, UnitTypeId } from '../data/balance';
import { FLESH, WEAPON, type Weapon } from '../audio/audio';
import { factionTokens, hex, semantic } from '../design/tokens';

export type { Weapon };

/** Waffenart einer Einheit / weapon kind of a unit */
export const weaponOf = (type: UnitTypeId): Weapon => WEAPON[type] ?? 'none';

/** Zeichenreihenfolge der Effekte (nach den Einheiten) / render order of effects (after units) */
const FX_ORDER = 70;

/** Explosive Waffen: Feuerball, Truemmer, Rauch / explosive weapons: fireball, debris, smoke */
const EXPLOSIVE = new Set<Weapon>(['cannon', 'artillery', 'rocket', 'heliRockets', 'naval', 'bigNaval', 'torpedo', 'plasma']);
/** Nahkampf: Ausfall statt Geschoss / melee: lunge instead of a projectile */
const MELEE = new Set<Weapon>(['buzz', 'none']);

/**
 * Kamerawackeln je Einschlag (0 = keines) / camera shake per impact (0 = none).
 * Grosse Explosionen stark, schwere Treffer leicht / big explosions strong, heavy hits light.
 */
export function impactShake(w: Weapon): number {
  switch (w) {
    case 'artillery': case 'bigNaval': return 0.75;
    case 'cannon': case 'rocket': return 0.55;
    case 'naval': case 'heliRockets': case 'plasma': case 'torpedo': case 'railgun': case 'deathRay': return 0.28;
    default: return 0;
  }
}
/** Weitere Wackelstaerken / further shake strengths */
export const SHAKE = { wreck: 0.8, eruption: 1.5, eruptionMs: 700, barrier: 0.3 } as const;

// ---------- Winkel / angles ----------

/** Kuerzeste Drehung von a nach b / shortest turn from a to b */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const lerpAngle = (a: number, b: number, t: number) => a + angleDelta(a, b) * t;
const smooth = (t: number) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
/** Blickwinkel (Modelle blicken nach +z) / heading angle (models face +z) */
export const headingOf = (dx: number, dz: number) => Math.atan2(dx, dz);

/**
 * Ausrichtung entlang eines Pfades: am Anfang jedes Abschnitts sanft in die neue Richtung drehen.
 * Facing along a path: turn smoothly into the new direction at the start of each segment.
 * Rueckgabe: Funktion f (0..Abschnitte) -> Winkel / returns: function f (0..segments) -> angle
 */
export function pathFacing(pts: THREE.Vector3[], start: number): (f: number) => number {
  const seg: number[] = [];
  let last = start;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dz = pts[i].z - pts[i - 1].z;
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) last = headingOf(dx, dz);
    seg.push(last);
  }
  return (f: number) => {
    if (!seg.length) return start;
    const i = Math.max(0, Math.min(seg.length - 1, Math.floor(f)));
    const local = Math.min(1, f - i);
    const prev = i === 0 ? start : seg[i - 1];
    return lerpAngle(prev, seg[i], smooth(local / 0.35));
  };
}

// ---------- Texturen (einmalig, Canvas) / textures (once, canvas) ----------

type SpriteKind = 'star' | 'puff' | 'spark' | 'glow';
type MeshKind = 'beam' | 'shell' | 'rocket' | 'chunk' | 'ring';
type Kind = SpriteKind | MeshKind;

let textures: Record<SpriteKind, THREE.Texture> | null = null;
function tex(kind: SpriteKind): THREE.Texture {
  if (!textures) {
    const make = (draw: (ctx: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const ctx = cv.getContext('2d')!;
      ctx.lineJoin = 'round';
      draw(ctx);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const ink = semantic.ink, white = semantic.white;
    textures = {
      // Comic-Stern mit Tuschelinie (weiss, wird eingefaerbt) / comic star with ink line (white, gets tinted)
      star: make((ctx) => {
        ctx.beginPath();
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const r = i % 2 ? 12 : i % 4 ? 22 : 28;
          ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = white; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
      }),
      // Wolkenbausch aus drei Kreisen mit gemeinsamer Kontur / cloud puff of three circles with a shared outline
      puff: make((ctx) => {
        const blobs: [number, number, number][] = [[26, 36, 16], [40, 34, 15], [32, 24, 15]];
        ctx.strokeStyle = ink; ctx.lineWidth = 6;
        for (const [x, y, r] of blobs) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = white;
        for (const [x, y, r] of blobs) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      }),
      // schmaler Vierstrahl-Funke / slim four-point spark
      spark: make((ctx) => {
        const p = [[32, 2], [37, 27], [62, 32], [37, 37], [32, 62], [27, 37], [2, 32], [27, 27]];
        ctx.beginPath();
        for (const [x, y] of p) ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fillStyle = white; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();
      }),
      // weiches Leuchten ohne Kontur / soft glow without outline
      glow: make((ctx) => {
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
        const c = new THREE.Color(hex(white));
        const rgba = (a: number) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
        g.addColorStop(0, rgba(1)); g.addColorStop(0.35, rgba(0.85)); g.addColorStop(1, rgba(0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      }),
    };
  }
  return textures[kind];
}

let geos: Record<MeshKind, THREE.BufferGeometry> | null = null;
function geo(kind: MeshKind): THREE.BufferGeometry {
  geos ??= {
    // Einheitsquader von z=0 bis z=1 (Strahlen, Leuchtspur) / unit box from z=0 to z=1 (beams, tracers)
    beam: new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5),
    shell: new THREE.SphereGeometry(1, 8, 6),
    rocket: new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateX(Math.PI / 2),
    chunk: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.RingGeometry(0.72, 1, 24).rotateX(-Math.PI / 2),
  };
  return geos[kind];
}

// ---------- Partikel / particles ----------

type FxMaterial = THREE.SpriteMaterial | THREE.MeshBasicMaterial;
interface Particle {
  obj: THREE.Object3D;
  mat: FxMaterial;
  kind: Kind;
  t0: number;
  dur: number;
  step: (k: number, p: Particle) => void;
}

const SPRITES = new Set<Kind>(['star', 'puff', 'spark', 'glow']);
const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

/** Effekt-Verwaltung mit Objekt-Pools / effect manager with object pools */
export class CombatFx {
  readonly group = new THREE.Group();
  private free = new Map<Kind, Particle[]>();
  private live: Particle[] = [];

  constructor() {
    this.group.name = 'combatFx';
  }

  private make(kind: Kind): Particle {
    let obj: THREE.Object3D, mat: FxMaterial;
    if (SPRITES.has(kind)) {
      mat = new THREE.SpriteMaterial({ map: tex(kind as SpriteKind), transparent: true, depthWrite: false, depthTest: false });
      obj = new THREE.Sprite(mat);
    } else {
      mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: kind === 'ring' ? THREE.DoubleSide : THREE.FrontSide });
      obj = new THREE.Mesh(geo(kind as MeshKind), mat);
    }
    obj.renderOrder = FX_ORDER;
    obj.frustumCulled = false;
    obj.raycast = () => {};
    obj.visible = false;
    this.group.add(obj);
    return { obj, mat, kind, t0: 0, dur: 1, step: () => {} };
  }

  /** Effektteil anlegen (Verzoegerung und Dauer in ms) / spawn an effect part (delay and duration in ms) */
  emit(kind: Kind, delay: number, dur: number, color: string, step: (k: number, p: Particle) => void): Particle {
    const p = this.free.get(kind)?.pop() ?? this.make(kind);
    p.t0 = performance.now() + Math.max(0, delay);
    p.dur = Math.max(1, dur);
    p.step = step;
    p.mat.color.set(hex(color));
    p.mat.opacity = 1;
    if (p.mat instanceof THREE.SpriteMaterial) p.mat.rotation = Math.random() * Math.PI * 2;
    p.obj.rotation.set(0, 0, 0);
    p.obj.scale.setScalar(1);
    p.obj.renderOrder = FX_ORDER;
    p.obj.visible = false;
    this.live.push(p);
    return p;
  }

  private release(i: number) {
    const p = this.live[i];
    this.live[i] = this.live[this.live.length - 1];
    this.live.pop();
    p.obj.visible = false;
    let list = this.free.get(p.kind);
    if (!list) { list = []; this.free.set(p.kind, list); }
    list.push(p);
  }

  /** Fortschreiben; true solange Effekte laufen (oder gerade endeten) / advance; true while effects run (or just ended) */
  update(): boolean {
    if (!this.live.length) return false;
    const now = performance.now();
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      const e = now - p.t0;
      if (e < 0) { p.obj.visible = false; continue; }
      const k = e / p.dur;
      if (k >= 1) { this.release(i); continue; }
      p.obj.visible = true;
      try { p.step(k, p); } catch (err) { console.error(err); this.release(i); }
    }
    return true;
  }

  get active() { return this.live.length > 0; }

  /** Alles sofort beenden / end everything at once */
  clear() {
    while (this.live.length) this.release(this.live.length - 1);
  }
}

// ---------- Effekt-Bausteine / effect building blocks ----------

const fade = (k: number, from = 0.55) => (k < from ? 1 : Math.max(0, 1 - (k - from) / (1 - from)));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Comic-Muendungsblitz: Stern + heller Kern / comic muzzle flash: star + bright core */
function flash(fx: CombatFx, at: THREE.Vector3, size: number, color: string, delay = 0, dur = 110) {
  const p = at.clone();
  fx.emit('star', delay, dur, color, (k, q) => {
    q.obj.position.copy(p);
    const s = size * (k < 0.25 ? 0.55 + (k / 0.25) * 0.45 : 1 - (k - 0.25) * 0.5);
    q.obj.scale.set(s, s, 1);
    q.mat.opacity = fade(k, 0.5);
  });
  fx.emit('glow', delay, dur * 0.8, semantic.fxFlashHot, (k, q) => {
    q.obj.position.copy(p);
    const s = size * 0.75 * (1 - k * 0.4);
    q.obj.scale.set(s, s, 1);
    q.mat.opacity = fade(k, 0.3);
  });
}

/** Bausch, der sich bewegt, waechst und verblasst / puff that moves, grows and fades */
function puff(fx: CombatFx, at: THREE.Vector3, vel: THREE.Vector3, s0: number, s1: number, color: string, delay: number, dur: number,
  opts: { to?: string; gravity?: number; kind?: SpriteKind; fadeFrom?: number; floor?: number } = {}) {
  const p0 = at.clone(), v = vel.clone();
  const c0 = new THREE.Color(hex(color)), c1 = opts.to ? new THREE.Color(hex(opts.to)) : null;
  const g = opts.gravity ?? 0, sec = dur / 1000;
  fx.emit(opts.kind ?? 'puff', delay, dur, color, (k, q) => {
    const t = k * sec;
    q.obj.position.set(p0.x + v.x * t, p0.y + v.y * t - 0.5 * g * t * t, p0.z + v.z * t);
    if (opts.floor !== undefined && q.obj.position.y < opts.floor) q.obj.position.y = opts.floor;
    const s = s0 + (s1 - s0) * Math.sqrt(k);
    q.obj.scale.set(s, s, 1);
    if (c1) q.mat.color.copy(c0).lerp(c1, k);
    q.mat.opacity = fade(k, opts.fadeFrom ?? 0.5);
  });
}

/** Funkenregen / spray of sparks */
function sparks(fx: CombatFx, at: THREE.Vector3, n: number, color: string, delay: number, speed = 1.4, size = 0.09) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), up = rnd(0.6, 1.6);
    puff(fx, at, new THREE.Vector3(Math.cos(a) * speed * rnd(0.5, 1), up * speed, Math.sin(a) * speed * rnd(0.5, 1)), size, size * 0.5, color,
      delay + rnd(0, 30), rnd(160, 240), { kind: 'spark', gravity: 6, fadeFrom: 0.4 });
  }
}

/** Fliegender Truemmerbrocken / flying debris chunk */
function chunk(fx: CombatFx, at: THREE.Vector3, vel: THREE.Vector3, size: number, color: string, delay: number, dur: number, floor: number) {
  const p0 = at.clone(), v = vel.clone(), sec = dur / 1000;
  const spin = new THREE.Vector3(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14));
  fx.emit('chunk', delay, dur, color, (k, q) => {
    const t = k * sec;
    q.obj.position.set(p0.x + v.x * t, Math.max(floor, p0.y + v.y * t - 0.5 * 7 * t * t), p0.z + v.z * t);
    q.obj.rotation.set(spin.x * t, spin.y * t, spin.z * t);
    q.obj.scale.set(size, size * 0.7, size * 1.2);
    q.mat.opacity = fade(k, 0.75);
  });
}

/** Strahl von a nach b mit zeitabhaengiger Breite / beam from a to b with time-dependent width */
function beam(fx: CombatFx, from: THREE.Vector3, to: THREE.Vector3, color: string, delay: number, dur: number,
  shape: (k: number) => { w: number; o: number; reach?: number }): Particle {
  const a = from.clone(), dir = to.clone().sub(from);
  const len = dir.length();
  const q0 = new THREE.Quaternion().setFromUnitVectors(Z, dir.normalize());
  return fx.emit('beam', delay, dur, color, (k, q) => {
    const sh = shape(k);
    q.obj.position.copy(a);
    q.obj.quaternion.copy(q0);
    q.obj.scale.set(Math.max(0.001, sh.w), Math.max(0.001, sh.w), Math.max(0.001, len * (sh.reach ?? 1)));
    q.mat.opacity = sh.o;
  });
}

/** Leuchtspur: kurzer Balken, der von a nach b fliegt / tracer: short bar flying from a to b */
function bolt(fx: CombatFx, from: THREE.Vector3, to: THREE.Vector3, len: number, width: number, color: string, delay: number, flight: number, inked = true, order = FX_ORDER + 1) {
  const a = from.clone(), dir = to.clone().sub(from);
  const dist = dir.length();
  dir.normalize();
  const q0 = new THREE.Quaternion().setFromUnitVectors(Z, dir);
  // Tuschekontur hinter dem Kern fuer Kontrast auf hellem Boden / ink outline behind the core for contrast on bright ground
  for (const ink of inked ? [true, false] : [false]) {
    const w = ink ? width + 0.018 : width, extra = ink ? 0.012 : 0;
    const p = fx.emit('beam', delay, flight, ink ? semantic.ink : color, (k, q) => {
      const head = k * dist + extra, tail = Math.max(0, k * dist - len - extra);
      q.obj.position.copy(a).addScaledVector(dir, tail);
      q.obj.quaternion.copy(q0);
      q.obj.scale.set(w, w, Math.max(0.001, head - tail));
    });
    if (!ink) p.obj.renderOrder = order;
  }
}

/** Flugbahn mit Bogen / trajectory with an arc */
function arcPath(from: THREE.Vector3, to: THREE.Vector3, height: number) {
  return (k: number, out: THREE.Vector3) => out.lerpVectors(from, to, k).setY(from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * height);
}

/** Geschoss entlang einer Bahn (Kugel oder Rakete) / projectile along a path (ball or rocket) */
function projectile(fx: CombatFx, kind: 'shell' | 'rocket', path: (k: number, out: THREE.Vector3) => THREE.Vector3, size: [number, number, number],
  color: string, delay: number, flight: number) {
  const next = new THREE.Vector3();
  fx.emit(kind, delay, flight, color, (k, q) => {
    path(k, q.obj.position);
    path(Math.min(1, k + 0.03), next);
    next.sub(q.obj.position);
    if (next.lengthSq() > 1e-8) q.obj.quaternion.setFromUnitVectors(Z, next.normalize());
    q.obj.scale.set(size[0], size[1], size[2]);
  });
}

/** Rauchspur entlang einer Bahn / smoke trail along a path */
function trail(fx: CombatFx, path: (k: number, out: THREE.Vector3) => THREE.Vector3, delay: number, flight: number, every: number, color: string, size: number) {
  const n = Math.max(1, Math.floor(flight / every));
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const p = path(k, new THREE.Vector3());
    puff(fx, p, new THREE.Vector3(rnd(-0.05, 0.05), 0.12, rnd(-0.05, 0.05)), size * 0.5, size * 1.4, color, delay + k * flight, 320, { fadeFrom: 0.2, to: semantic.fxSmoke });
  }
}

/** Ring auf der Wasser- oder Bodenflaeche / ring on the water or ground surface */
function ring(fx: CombatFx, at: THREE.Vector3, r0: number, r1: number, color: string, delay: number, dur: number, normal?: THREE.Vector3) {
  const p = at.clone();
  const q0 = normal ? new THREE.Quaternion().setFromUnitVectors(Y, normal.clone().normalize()) : null;
  fx.emit('ring', delay, dur, color, (k, q) => {
    q.obj.position.copy(p);
    if (q0) q.obj.quaternion.copy(q0); else q.obj.quaternion.identity();
    const r = r0 + (r1 - r0) * Math.sqrt(k);
    q.obj.scale.set(r, 1, r);
    q.mat.opacity = fade(k, 0.3);
  });
}

// ---------- Schuss und Einschlag / shot and impact ----------

export type Surface = 'flesh' | 'metal' | 'water';

/** Energiefarbe je Fraktion (Laser, Plasma, Strahlen) / energy colour per faction (laser, plasma, beams) */
const energy = (f: FactionId) => factionTokens[f]?.marker ?? semantic.fxFlash;

/**
 * Schuss abfeuern: Muendungsblitz + Geschoss. Rueckgabe: Flugzeit bis zum Einschlag in ms.
 * Fire a shot: muzzle flash + projectile. Returns: flight time until impact in ms.
 */
function shoot(fx: CombatFx, w: Weapon, from: THREE.Vector3, to: THREE.Vector3, f: FactionId, delay: number, water: boolean): number {
  const d = from.distanceTo(to);
  const byDist = (speed: number, min: number, max: number) => Math.max(min, Math.min(max, (d / speed) * 1000));
  const col = energy(f);
  switch (w) {
    case 'rifle': {
      const t = byDist(14, 70, 140);
      for (let i = 0; i < 2; i++) {
        flash(fx, from, 0.2, semantic.fxFlash, delay + i * 70, 80);
        bolt(fx, from, jitter(to, 0.05), 0.32, 0.028, semantic.fxFlash, delay + i * 70, t);
      }
      return t;
    }
    case 'mg': {
      const t = byDist(16, 60, 120);
      for (let i = 0; i < 5; i++) {
        flash(fx, from, 0.18 + (i % 2) * 0.06, semantic.fxFlash, delay + i * 42, 60);
        bolt(fx, from, jitter(to, 0.09), 0.3, 0.026, semantic.fxFlash, delay + i * 42, t);
      }
      return t;
    }
    case 'sniper': {
      flash(fx, from, 0.3, semantic.fxFlash, delay, 100);
      // langer Streifen mit Tuschekontur / long streak with an ink outline
      beam(fx, from, to, semantic.ink, delay, 220, (k) => ({ w: 0.034 * (1 - k * 0.5), o: fade(k, 0.3) * 0.8, reach: Math.min(1, k / 0.2) }));
      beam(fx, from, to, semantic.fxFlash, delay, 220, (k) => ({ w: 0.02 * (1 - k * 0.5), o: fade(k, 0.3), reach: Math.min(1, k / 0.2) })).obj.renderOrder = FX_ORDER + 1;
      return 45;
    }
    case 'cannon': case 'naval': {
      const t = byDist(9, 110, 230);
      const path = arcPath(from, to, 0.04 + d * (w === 'naval' ? 0.12 : 0.03));
      flash(fx, from, 0.42, semantic.fxFlash, delay, 120);
      muzzleSmoke(fx, from, to, delay, 2);
      projectile(fx, 'shell', path, [0.045, 0.045, 0.07], semantic.fxShell, delay, t);
      bolt(fx, from, to, 0.18, 0.022, semantic.fxTracer, delay, t, false);
      return t;
    }
    case 'bigNaval': {
      const t = byDist(7, 180, 280);
      for (let i = 0; i < 3; i++) {
        const tgt = jitter(to, 0.14);
        const path = arcPath(from, tgt, 0.12 + d * 0.14);
        flash(fx, from, 0.55, semantic.fxFlash, delay + i * 55, 130);
        projectile(fx, 'shell', path, [0.045, 0.045, 0.07], semantic.fxShell, delay + i * 55, t);
      }
      muzzleSmoke(fx, from, to, delay, 3);
      return t;
    }
    case 'artillery': {
      const t = 360;
      const path = arcPath(from, to, 0.45 + d * 0.22);
      flash(fx, from, 0.55, semantic.fxFlash, delay, 130);
      muzzleSmoke(fx, from, to, delay, 3);
      projectile(fx, 'shell', path, [0.055, 0.055, 0.09], semantic.fxShell, delay, t);
      trail(fx, path, delay, t, 45, semantic.fxSmokeDark, 0.12);
      return t;
    }
    case 'rocket': case 'heliRockets': {
      const n = w === 'rocket' ? 3 : 2;
      const t = w === 'rocket' ? byDist(6, 220, 300) : byDist(8, 160, 240);
      for (let i = 0; i < n; i++) {
        const tgt = jitter(to, 0.1);
        const path = arcPath(from, tgt, w === 'rocket' ? 0.2 + d * 0.1 : 0.03);
        const dl = delay + i * 65;
        flash(fx, from, 0.26, semantic.fxFire, dl, 90);
        projectile(fx, 'rocket', path, [0.05, 0.05, 0.17], semantic.fxRocket, dl, t);
        // Triebwerksflamme folgt der Rakete / exhaust flame follows the rocket
        const pos = new THREE.Vector3();
        fx.emit('glow', dl, t, semantic.fxFire, (k, q) => { q.obj.position.copy(path(Math.max(0, k - 0.04), pos)); q.obj.scale.set(0.18, 0.18, 1); });
        trail(fx, path, dl, t, 28, semantic.fxSmoke, 0.11);
      }
      return t + (n - 1) * 65;
    }
    case 'torpedo': {
      const t = byDist(4, 260, 420);
      const y = Math.min(from.y, to.y) - 0.06;
      const a = from.clone().setY(y), b = to.clone().setY(y);
      const path = arcPath(a, b, 0);
      if (water) ring(fx, a, 0.05, 0.2, semantic.fxFoam, delay, 260);
      projectile(fx, 'rocket', path, [0.04, 0.04, 0.16], semantic.fxShell, delay, t);
      // Blasenspur auf dem Wasser / bubble wake on the water
      const n = 8;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        ring(fx, path(k, new THREE.Vector3()).setY(y + 0.07), 0.04, 0.2, semantic.fxFoam, delay + k * t, 340);
      }
      return t;
    }
    case 'laser': {
      const t = byDist(16, 60, 110);
      flash(fx, from, 0.22, col, delay, 90);
      for (let i = 0; i < 2; i++) {
        bolt(fx, from, to, 0.3, 0.045, col, delay + i * 60, t);
        bolt(fx, from, to, 0.3, 0.016, semantic.white, delay + i * 60, t, false, FX_ORDER + 2);
      }
      return t + 60;
    }
    case 'plasma': {
      const t = byDist(6, 180, 260);
      flash(fx, from, 0.32, col, delay, 120);
      const path = arcPath(from, to, 0.05);
      const pos = new THREE.Vector3();
      fx.emit('puff', delay, t, col, (k, q) => {
        q.obj.position.copy(path(k, pos));
        const s = 0.2 + Math.sin(k * 40) * 0.025;
        q.obj.scale.set(s, s, 1);
      });
      fx.emit('glow', delay, t, semantic.white, (k, q) => { q.obj.position.copy(path(k, pos)); q.obj.scale.set(0.16, 0.16, 1); });
      trail(fx, path, delay, t, 30, col, 0.06);
      return t;
    }
    case 'deathRay': {
      const dur = 360;
      flash(fx, from, 0.3, col, delay, 140);
      // pulsierender dicker Strahl: Huelle in Fraktionsfarbe, weisser Kern / pulsing thick beam: faction-coloured sheath, white core
      beam(fx, from, to, col, delay, dur, (k) => ({ w: 0.075 + Math.sin(k * 42) * 0.025, o: fade(k, 0.7) * 0.85, reach: Math.min(1, k / 0.12) }));
      beam(fx, from, to, semantic.white, delay, dur, (k) => ({ w: 0.028 + Math.sin(k * 42 + 1) * 0.01, o: fade(k, 0.7), reach: Math.min(1, k / 0.12) })).obj.renderOrder = FX_ORDER + 1;
      fx.emit('glow', delay, dur, col, (k, q) => { q.obj.position.copy(from); const s = 0.22 + Math.sin(k * 42) * 0.05; q.obj.scale.set(s, s, 1); q.mat.opacity = fade(k, 0.7); });
      for (let i = 0; i < 5; i++) sparks(fx, to, 2, col, delay + 50 + i * 55, 1.1, 0.08);
      return 50;
    }
    case 'railgun': {
      flash(fx, from, 0.4, col, delay, 120);
      // sofortiger Strahl mit Nachgluehen / instant beam with afterglow
      beam(fx, from, to, col, delay, 420, (k) => ({ w: 0.06 * (1 - k * 0.7), o: fade(k, 0.1) * 0.8 }));
      beam(fx, from, to, semantic.white, delay, 200, (k) => ({ w: 0.022, o: fade(k, 0.3) })).obj.renderOrder = FX_ORDER + 1;
      const dir = to.clone().sub(from);
      for (let i = 1; i <= 5; i++) ring(fx, from.clone().lerp(to, i / 6), 0.03, 0.11, col, delay + i * 12, 340, dir);
      return 15;
    }
    case 'energy': {
      flash(fx, from, 0.2, col, delay, 90);
      for (let z = 0; z < 2; z++) zap(fx, from, to, col, delay + z * 70);
      return 40;
    }
    case 'flame': {
      // Flammenkegel aus Baeuschen / cone of flame puffs
      const t = 190;
      const dir = to.clone().sub(from);
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      for (let i = 0; i < 12; i++) {
        const spread = rnd(-0.5, 0.5) * d * 0.28;
        const end = to.clone().addScaledVector(side, spread).add(new THREE.Vector3(0, rnd(-0.03, 0.08), 0));
        const vel = end.sub(from).multiplyScalar(1000 / t);
        puff(fx, from, vel, 0.06, 0.3, semantic.fxFireHot, delay + i * 18, t, { to: semantic.fxEmber, fadeFrom: 0.75 });
      }
      return t;
    }
    case 'buzz': case 'none': default:
      return 130;
  }
}

/** Zufaelliger Versatz am Ziel / random offset at the target */
function jitter(p: THREE.Vector3, r: number) {
  return p.clone().add(new THREE.Vector3(rnd(-r, r), rnd(-r, r) * 0.6, rnd(-r, r)));
}

/** Pulverdampf an der Muendung / powder smoke at the muzzle */
function muzzleSmoke(fx: CombatFx, from: THREE.Vector3, to: THREE.Vector3, delay: number, n: number) {
  const dir = to.clone().sub(from).setY(0).normalize();
  for (let i = 0; i < n; i++) {
    puff(fx, from, dir.clone().multiplyScalar(rnd(0.3, 0.7)).add(new THREE.Vector3(rnd(-0.15, 0.15), rnd(0.15, 0.35), rnd(-0.15, 0.15))),
      0.1, 0.26, semantic.fxSmoke, delay + 30 + i * 25, 420, { fadeFrom: 0.3 });
  }
}

/** Zickzack-Blitz / zigzag zap */
function zap(fx: CombatFx, from: THREE.Vector3, to: THREE.Vector3, color: string, delay: number) {
  const dir = to.clone().sub(from);
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const pts = [from.clone()];
  const n = 4;
  for (let i = 1; i < n; i++) pts.push(from.clone().lerp(to, i / n).addScaledVector(side, rnd(-0.09, 0.09)).add(new THREE.Vector3(0, rnd(-0.06, 0.06), 0)));
  pts.push(to.clone());
  for (let i = 0; i < n; i++) {
    beam(fx, pts[i], pts[i + 1], color, delay, 120, (k) => ({ w: 0.035, o: k < 0.5 ? 1 : (Math.sin(k * 60) > 0 ? 1 : 0.2) * fade(k, 0.5) }));
    beam(fx, pts[i], pts[i + 1], semantic.white, delay, 120, (k) => ({ w: 0.013, o: fade(k, 0.5) })).obj.renderOrder = FX_ORDER + 1;
  }
}

/**
 * Einschlag am Ziel: Funken (Metall), Erdfontaene (Boden), Wasserfontaene (Wasser), Explosion mit Truemmern (Sprengwaffen).
 * Impact at the target: sparks (metal), dirt fountain (ground), splash (water), explosion with debris (explosives).
 */
function impact(fx: CombatFx, w: Weapon, at: THREE.Vector3, floor: number, surface: Surface, f: FactionId, delay: number, scale = 1) {
  const col = energy(f);
  const ground = at.clone().setY(floor + 0.02);
  if (EXPLOSIVE.has(w)) {
    const big = (w === 'artillery' || w === 'bigNaval' ? 1.25 : w === 'cannon' || w === 'rocket' ? 1.05 : 0.85) * scale;
    flash(fx, at, 0.8 * big, w === 'plasma' ? col : semantic.fxFlash, delay, 170);
    // Feuerball aus Baeuschen: heiss -> Glut -> Rauch / fireball from puffs: hot -> ember -> smoke
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rnd(0, 0.5);
      puff(fx, at, new THREE.Vector3(Math.cos(a) * 0.5 * big, rnd(0.3, 0.9) * big, Math.sin(a) * 0.5 * big), 0.12 * big, 0.3 * big,
        w === 'plasma' ? col : semantic.fxFireHot, delay + rnd(0, 40), rnd(300, 420), { to: w === 'plasma' ? semantic.fxSmoke : semantic.fxSmokeDark, fadeFrom: 0.45 });
    }
    for (let i = 0; i < 3; i++) {
      puff(fx, at.clone().add(new THREE.Vector3(rnd(-0.1, 0.1), 0.05, rnd(-0.1, 0.1))), new THREE.Vector3(rnd(-0.1, 0.1), rnd(0.4, 0.7), rnd(-0.1, 0.1)),
        0.14 * big, 0.36 * big, semantic.fxSmokeDark, delay + 90 + i * 40, 480, { to: semantic.fxSmoke, fadeFrom: 0.35 });
    }
    if (surface === 'water') splash(fx, ground, delay, 1.2 * big);
    else {
      // Truemmer und Erdbrocken / debris and dirt clods
      for (let i = 0; i < 6; i++) {
        const a = rnd(0, Math.PI * 2), sp = rnd(0.6, 1.3) * big;
        chunk(fx, at, new THREE.Vector3(Math.cos(a) * sp, rnd(1.3, 2.2) * big, Math.sin(a) * sp), rnd(0.035, 0.06) * big,
          i % 2 ? semantic.fxDebris : semantic.fxDirtDark, delay, rnd(380, 520), floor + 0.02);
      }
      dirt(fx, ground, 4, delay + 20, big);
    }
    if (surface === 'metal') sparks(fx, at, 4, semantic.fxSpark, delay, 1.6);
    ring(fx, ground, 0.1, 0.55 * big, semantic.fxSmoke, delay, 300);
    return;
  }
  switch (w) {
    case 'flame':
      for (let i = 0; i < 5; i++) {
        puff(fx, at.clone().add(new THREE.Vector3(rnd(-0.12, 0.12), rnd(-0.06, 0.06), rnd(-0.12, 0.12))), new THREE.Vector3(0, rnd(0.3, 0.6), 0),
          0.12, 0.28, semantic.fxFire, delay + i * 35, 360, { to: semantic.fxSmokeDark, fadeFrom: 0.5 });
      }
      break;
    case 'laser': case 'energy': case 'deathRay': case 'railgun':
      flash(fx, at, w === 'railgun' ? 0.5 : 0.3, col, delay, 130);
      sparks(fx, at, w === 'railgun' ? 7 : 5, col, delay, 1.3);
      if (surface !== 'water') puff(fx, ground, new THREE.Vector3(0, 0.35, 0), 0.1, 0.24, semantic.fxSmokeDark, delay + 40, 380, { to: semantic.fxSmoke });
      break;
    default:
      // Handfeuerwaffen und Nahkampf / small arms and melee
      flash(fx, at, 0.24, semantic.fxSpark, delay, 90);
      if (surface === 'metal') sparks(fx, at, 6, semantic.fxSpark, delay, 1.3);
      else if (surface === 'flesh') dirt(fx, ground, 4, delay, 1);
      break;
  }
  if (surface === 'water') splash(fx, ground, delay, 0.6);
}

/** Erdfontaene / dirt fountain */
function dirt(fx: CombatFx, at: THREE.Vector3, n: number, delay: number, big: number) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    puff(fx, at, new THREE.Vector3(Math.cos(a) * 0.35 * big, rnd(0.7, 1.3) * big, Math.sin(a) * 0.35 * big), 0.07 * big, 0.17 * big,
      i % 2 ? semantic.fxDirt : semantic.fxDirtDark, delay + i * 20, 380, { gravity: 4, floor: at.y, fadeFrom: 0.5 });
  }
}

/** Wasserfontaene mit Ring / water splash with a ring */
function splash(fx: CombatFx, at: THREE.Vector3, delay: number, big: number) {
  ring(fx, at, 0.08, 0.45 * big, semantic.fxFoam, delay, 360);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    puff(fx, at, new THREE.Vector3(Math.cos(a) * 0.25 * big, rnd(1.0, 1.7) * big, Math.sin(a) * 0.25 * big), 0.08 * big, 0.15 * big,
      i % 2 ? semantic.fxSplash : semantic.fxFoam, delay + i * 12, 420, { gravity: 5, floor: at.y, fadeFrom: 0.5 });
  }
}

// ---------- Ablauf eines Angriffs / sequence of an attack ----------

/** Muendung: Hoehe und Abstand nach vorn (Einheitenmasstab inkl.) / muzzle: height and forward offset (unit scale included) */
const MUZZLE: Partial<Record<UnitTypeId, [number, number]>> = {
  jeep: [0.3, 0.1], doomBuggy: [0.3, 0.12], tank: [0.23, 0.42], doomCrawler: [0.25, 0.4], artillery: [0.32, 0.42],
  heli: [0.3, 0.24], landingBoat: [0.2, 0.22], submarine: [0.0, 0.32], destroyer: [0.26, 0.32], battleship: [0.32, 0.36],
  skimmer: [0.22, 0.26], mech: [0.42, 0.2], tripod: [0.4, 0.14], titan: [0.55, 0.22], spider: [0.12, 0.22],
  quadDrone: [0.36, 0.12], railgun: [0.32, 0.4], rocketCart: [0.32, 0.12], android: [0.3, 0.15],
};
/** Trefferhoehe / hit height */
const HIT_H: Partial<Record<UnitTypeId, number>> = { heli: 0.36, tripod: 0.38, titan: 0.42, mech: 0.32, submarine: 0.06, quadDrone: 0.34 };

/** Angaben des Controllers zu einem Angriff / controller details for an attack */
export interface AttackInfo {
  attacker: UnitTypeId;
  target: UnitTypeId;
  attackerFaction: FactionId;
  targetFaction: FactionId;
  attackerWater: boolean;
  targetWater: boolean;
  /** Verteidiger schiesst zurueck / defender fires back */
  retaliate: boolean;
  /** weitere Einheiten im Explosionsradius / further units in the blast radius */
  splash?: number[];
  onFire?: () => void;
  onImpact?: () => void;
  onReturnFire?: () => void;
  onReturnImpact?: () => void;
}

/** Was der Effekt vom Spielbrett braucht / what the effect needs from the board */
export interface FxHost {
  unitObject(id: number): THREE.Object3D | undefined;
  anim(dur: number, update: (t: number) => void): Promise<void>;
  hold(id: number, on: boolean): void;
  facing(id: number): number;
  setFacing(id: number, angle: number): void;
}

/** Abstand Treffer -> Gegenschlag (Klang kommt per Rueckruf synchron) / gap impact -> return fire (sound comes in sync via callback) */
const RETURN_GAP = 170;
const TAIL = 90;

/**
 * Ganze Angriffssequenz: Ausrichten, Feuern mit Rueckstoss, Einschlag mit Wackeln des Ziels, optional Gegenschlag.
 * Whole attack sequence: turn, fire with recoil, impact with target shake, optional return fire.
 */
export function playAttack(host: FxHost, fx: CombatFx, attackerId: number, targetId: number, info?: AttackInfo): Promise<void> {
  const a = host.unitObject(attackerId), d = host.unitObject(targetId);
  if (!a || !d) {
    info?.onFire?.(); info?.onImpact?.();
    if (info?.retaliate) { info.onReturnFire?.(); info.onReturnImpact?.(); }
    return Promise.resolve();
  }
  const aStart = a.position.clone(), dStart = d.position.clone();
  const aModel = a.getObjectByName('model'), dModel = d.getObjectByName('model');
  const flat = dStart.clone().sub(aStart).setY(0);
  const dist = Math.max(0.001, flat.length());
  const dirN = flat.clone().divideScalar(dist);
  const aw = info ? weaponOf(info.attacker) : 'none';
  const a0 = aModel ? aModel.rotation.y : host.facing(attackerId);
  const a1 = headingOf(flat.x, flat.z);
  const turnA = Math.min(130, (Math.abs(angleDelta(a0, a1)) / Math.PI) * 170);

  const muzzle = (o: THREE.Vector3, type: UnitTypeId | undefined, ang: number) => {
    const [h, fwd] = (type && MUZZLE[type]) || [0.24, 0.17];
    return o.clone().add(new THREE.Vector3(Math.sin(ang) * fwd, h, Math.cos(ang) * fwd));
  };
  const hitPoint = (o: THREE.Vector3, type: UnitTypeId | undefined) => o.clone().add(new THREE.Vector3(0, (type && HIT_H[type]) ?? 0.18, 0));
  const surfaceOf = (type: UnitTypeId | undefined, water: boolean): Surface => (water ? 'water' : type && FLESH.has(type) ? 'flesh' : 'metal');

  // Hinweg / outbound
  const fireAt = turnA;
  const flight = info ? shoot(fx, aw, muzzle(aStart, info.attacker, a1), hitPoint(dStart, info.target), info.attackerFaction, fireAt, info.attackerWater) : 130;
  const impactAt = fireAt + flight;
  if (info) {
    impact(fx, aw, hitPoint(dStart, info.target), dStart.y, surfaceOf(info.target, info.targetWater), info.attackerFaction, impactAt);
    // Explosionsradius: kleinere Einschlaege bei Nachbarn / blast radius: smaller impacts at neighbours
    for (const id of info.splash ?? []) {
      const o = host.unitObject(id);
      if (o && id !== targetId) impact(fx, aw, o.position.clone().add(new THREE.Vector3(0, 0.15, 0)), o.position.y, 'metal', info.attackerFaction, impactAt + 60, 0.6);
    }
  }

  // Rueckweg (Gegenschlag) / return (retaliation)
  const ret = !!info?.retaliate;
  const dw = info ? weaponOf(info.target) : 'none';
  const d0 = dModel ? dModel.rotation.y : host.facing(targetId);
  const d1 = headingOf(-flat.x, -flat.z);
  const retFireAt = impactAt + RETURN_GAP;
  let retImpactAt = retFireAt;
  if (ret && info) {
    retImpactAt = retFireAt + shoot(fx, dw, muzzle(dStart, info.target, d1), hitPoint(aStart, info.attacker), info.targetFaction, retFireAt, info.targetWater);
    impact(fx, dw, hitPoint(aStart, info.attacker), aStart.y, surfaceOf(info.attacker, info.attackerWater), info.targetFaction, retImpactAt);
  }
  const total = (ret ? retImpactAt : impactAt) + TAIL;

  // Rueckstoss bzw. Ausfall / recoil or lunge
  const kick = (w: Weapon, e: number) => {
    if (e < 0) return 0;
    if (MELEE.has(w)) return e < 260 ? Math.sin((e / 260) * Math.PI) * 0.3 * dist : 0;
    const amt = w === 'cannon' || w === 'artillery' || w === 'bigNaval' || w === 'naval' || w === 'railgun' ? -0.08 : w === 'rocket' ? -0.04 : -0.03;
    return e < 35 ? amt * (e / 35) : amt * Math.max(0, 1 - (e - 35) / 170);
  };
  const jolt = (e: number) => (e > 0 && e < 200 ? Math.sin(e * 0.32) * 0.03 * (1 - e / 200) : 0);
  const calls: [number, (() => void) | undefined][] = [[fireAt, info?.onFire], [impactAt, info?.onImpact]];
  if (ret) calls.push([retFireAt, info?.onReturnFire], [retImpactAt, info?.onReturnImpact]);
  let fired = 0;

  host.hold(attackerId, true); host.hold(targetId, true);
  return host.anim(total, (t) => {
    const ms = t * total;
    if (aModel) aModel.rotation.y = turnA > 0 ? lerpAngle(a0, a1, smooth(ms / turnA)) : a1;
    if (ret && dModel) dModel.rotation.y = lerpAngle(d0, d1, smooth((ms - impactAt - 40) / (RETURN_GAP - 50)));
    // Angreifer: Rueckstoss, spaeter Treffer durch Gegenschlag / attacker: recoil, later hit by the return fire
    const ka = kick(aw, ms - fireAt);
    const ja = ret ? jolt(ms - retImpactAt) : 0;
    a.position.copy(aStart).addScaledVector(dirN, ka);
    a.position.x += ja; a.position.z -= ja;
    // Ziel: Treffer, dann Rueckstoss beim Gegenschlag / target: hit, then recoil on return fire
    const jd = jolt(ms - impactAt);
    const kd = ret ? kick(dw, ms - retFireAt) : 0;
    d.position.copy(dStart).addScaledVector(dirN, -kd);
    d.position.x += jd; d.position.z -= jd;
    while (fired < calls.length && (ms >= calls[fired][0] || t >= 1)) {
      const cb = calls[fired++][1];
      try { cb?.(); } catch (e) { console.error(e); }
    }
    if (t >= 1) {
      a.position.copy(aStart); d.position.copy(dStart);
      if (aModel) aModel.rotation.y = a1;
      host.setFacing(attackerId, a1);
      if (ret) { if (dModel) dModel.rotation.y = d1; host.setFacing(targetId, d1); }
      host.hold(attackerId, false); host.hold(targetId, false);
    }
  });
}
