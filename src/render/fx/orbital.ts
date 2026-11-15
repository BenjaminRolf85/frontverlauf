/**
 * Orbitallaser (nur Darstellung): Zielvorschau der 2x2-Flaeche mit Rahmen, Fuellung, Zielsaeule und Schadenszahlen,
 * der Strahl aus dem Himmel (Saeule in Fraktionsfarbe mit weissgluehendem Kern, Brandring) und das pulsierende
 * Uplink-Licht auf dem Satelliten-Relay. Ohne Animationen: Einschlag ohne Strahl, Licht ohne Pulsieren.
 * Orbital laser (render only): target preview of the 2x2 area with frame, fill, aim column and damage numbers, the
 * beam from the sky (column in the faction colour with a white-hot core, scorch ring) and the pulsing uplink light on
 * the satellite relay. Without animations: impact without the beam, light without pulsing.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { factionTokens, hex, primitives, semantic } from '../../design/tokens';
import { ADD_RGB, radialTexture } from '../lights';
import { glowColor } from '../post';

/** Phasen des Strahls (Anteile der Dauer) und Dauer in ms / beam phases (shares of the duration) and duration in ms */
export const ORBITAL_FX = { ms: 1500, impact: 0.42, beamEnd: 0.72, height: 9, shake: 1.1, shakeMs: 520 };

/** Vorschau eines Treffers: Position (Brett), Text, eigene Einheit? / preview of a hit: position (board), text, own unit? */
export interface OrbitalTag { pos: THREE.Vector3; text: string; own: boolean }

const tagCache = new Map<string, THREE.SpriteMaterial>();
/** Leinwand der Schadensplakette in px / canvas of the damage tag in px */
const TAG_W = 256, TAG_H = 88;
/** Schadensplakette "-2" (rot, eigene orange mit Warnrand) / damage tag "-2" (red, own ones orange with a warning rim) */
function tagMaterial(text: string, own: boolean): THREE.SpriteMaterial {
  const key = `${text}|${own}`;
  let m = tagCache.get(key);
  if (m) return m;
  const W = TAG_W, H = TAG_H;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.font = `60px ${primitives.font.comic}`;
  const tw = Math.min(W - 16, ctx.measureText(text).width + 36);
  const x = (W - tw) / 2;
  ctx.beginPath();
  ctx.roundRect(x, 8, tw, H - 16, 18);
  ctx.fillStyle = own ? semantic.orbitalOwn : semantic.orbitalAim;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = semantic.ink;
  ctx.stroke();
  ctx.fillStyle = own ? semantic.ink : semantic.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + 3);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  tagCache.set(key, m);
  return m;
}

const basic = (color: THREE.ColorRepresentation, opacity: number, additive = false) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, ...(additive ? ADD_RGB : {}),
  ...(additive ? { blendSrc: THREE.SrcAlphaFactor } : {}),
});
const noPick = <T extends THREE.Object3D>(o: T): T => { o.raycast = () => {}; return o; };

export class OrbitalFx {
  readonly group = new THREE.Group();
  private preview = new THREE.Group();
  private strike = new THREE.Group();
  private lamps: THREE.Sprite[] = [];
  private lampMat = new THREE.SpriteMaterial({ map: radialTexture(), color: hex(semantic.orbitalUplink), ...ADD_RGB, blendSrc: THREE.SrcAlphaFactor, depthWrite: false, transparent: false });
  // Geometrien einmal bauen / geometries built once
  private tileGeo = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
  private edgeGeo = new THREE.BoxGeometry(1, 0.035, 0.07);
  private columnGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
  private ringGeo = new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2);
  private discGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
  private fillMat = basic(hex(semantic.orbitalAim), 0.3);
  private edgeMat = new THREE.MeshBasicMaterial({ color: hex(semantic.orbitalAim) });
  private guideMat = basic(hex(semantic.orbitalAim), 0.16);
  private guideBlockedMat = basic(hex(semantic.neutralDark), 0.2);
  private beam: { outer: THREE.Mesh; core: THREE.Mesh; ring: THREE.Mesh; flash: THREE.Mesh; scorch: THREE.Mesh; at: THREE.Vector3; r: number } | null = null;
  private impactTimer = 0;

  constructor() {
    this.group.add(this.preview, this.strike);
  }

  // ---------- Relay-Licht / relay light ----------

  /** Uplink-Lichter an diese Punkte (Brett-Koordinaten) setzen / place uplink lights at these points (board coordinates) */
  setRelays(points: THREE.Vector3[]) {
    for (const l of this.lamps) { this.group.remove(l); l.material.dispose(); }
    this.lamps = points.map((p, i) => {
      const s = new THREE.Sprite(this.lampMat.clone());
      s.position.copy(p);
      s.scale.setScalar(0.34);
      s.renderOrder = 6;
      s.userData.phase = i * 0.7 + p.x * 0.31;
      noPick(s);
      this.group.add(s);
      return s;
    });
    this.update(0);
  }

  /** Pulsieren (Zeit in s; steht ohne Animationen) / pulsing (time in s; frozen without animations) */
  update(time: number) {
    for (const l of this.lamps) {
      const k = 0.5 + 0.5 * Math.sin((time + l.userData.phase) * 3.4);
      l.material.opacity = 0.45 + 0.55 * k;
      l.scale.setScalar(0.24 + 0.16 * k);
    }
  }

  // ---------- Zielvorschau / target preview ----------

  clearPreview() {
    for (const c of [...this.preview.children]) this.preview.remove(c);
  }

  /**
   * Flaeche zeigen: tiles = Mittelpunkte der Felder (mit Hoehe), cols/rows = Breite/Hoehe in Feldern, Rahmen nur aussen.
   * Show the area: tiles = tile centres (with height), cols/rows = width/height in tiles, frame on the outside only.
   */
  showPreview(tiles: THREE.Vector3[], cols: number, tags: OrbitalTag[], blocked: boolean) {
    this.clearPreview();
    if (!tiles.length) return;
    const lift = 0.035;
    tiles.forEach((p, i) => {
      const fill = noPick(new THREE.Mesh(this.tileGeo, blocked ? this.guideBlockedMat : this.fillMat));
      fill.position.set(p.x, p.y + lift, p.z);
      fill.renderOrder = 5;
      this.preview.add(fill);
      // Aussenkanten dieser Zelle / outer edges of this cell
      const cx = i % cols, cy = Math.floor(i / cols), rows = Math.ceil(tiles.length / cols);
      const edges: [number, number, boolean][] = [];
      if (cy === 0) edges.push([0, -0.5, false]);
      if (cy === rows - 1) edges.push([0, 0.5, false]);
      if (cx === 0) edges.push([-0.5, 0, true]);
      if (cx === cols - 1) edges.push([0.5, 0, true]);
      for (const [dx, dz, vertical] of edges) {
        const e = noPick(new THREE.Mesh(this.edgeGeo, this.edgeMat));
        e.position.set(p.x + dx, p.y + lift + 0.02, p.z + dz);
        if (vertical) e.rotation.y = Math.PI / 2;
        e.scale.x = 1.07;
        e.renderOrder = 6;
        this.preview.add(e);
      }
    });
    // Zielsaeule ueber der Mitte der Flaeche / aim column above the centre of the area
    const c = tiles.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / tiles.length);
    const top = Math.max(...tiles.map((p) => p.y));
    const col = noPick(new THREE.Mesh(this.columnGeo, blocked ? this.guideBlockedMat : this.guideMat));
    col.position.set(c.x, top + lift, c.z);
    col.scale.set(0.5 * cols, 1.9, 0.5 * cols);
    col.renderOrder = 7;
    this.preview.add(col);
    for (const g of tags) {
      const s = noPick(new THREE.Sprite(tagMaterial(g.text, g.own)));
      s.position.set(g.pos.x, g.pos.y + 0.95, g.pos.z);
      s.scale.set(0.8, 0.8 * (TAG_H / TAG_W), 1);
      s.renderOrder = 12;
      this.preview.add(s);
    }
  }

  // ---------- Strahl / beam ----------

  /** Strahl ueber der Flaeche aufbauen (unsichtbar bis zum ersten Bild) / build the beam above the area (invisible until the first frame) */
  begin(at: THREE.Vector3, radius: number, faction: FactionId | null) {
    this.end();
    const tint = faction ? factionTokens[faction].marker : semantic.orbitalUplink;
    const mk = (geo: THREE.BufferGeometry, color: THREE.Color, opacity: number, order: number, additive = true) => {
      const m = noPick(new THREE.Mesh(geo, basic(color, opacity, additive)));
      m.renderOrder = order;
      m.frustumCulled = false;
      m.position.copy(at);
      this.strike.add(m);
      return m;
    };
    // Saeule in Fraktionsfarbe (deckend, sonst wird sie ohne Bloom weiss), weissgluehender Kern additiv / column in the faction colour (opaque, otherwise it turns white without bloom), white-hot core additive
    const outer = mk(this.columnGeo, glowColor(hex(tint), 1.25), 0.78, 72, false);
    const core = mk(this.columnGeo, glowColor(hex(semantic.orbitalCore), 3.2), 1, 73);
    const ring = mk(this.ringGeo, glowColor(hex(tint), 2.2), 0.9, 71);
    const flash = mk(this.discGeo, glowColor(hex(semantic.orbitalCore), 2.6), 0.9, 71);
    const scorch = mk(this.discGeo, new THREE.Color(hex(semantic.orbitalScorch)), 0.7, 70, false);
    for (const m of [ring, flash, scorch]) m.position.y += 0.05;
    this.beam = { outer, core, ring, flash, scorch, at: at.clone(), r: radius };
    this.frame(0);
  }

  /**
   * Bild des Strahls bei t (0..1): Aufladen (Zielstrahl flackert, Ring zieht sich zusammen), Einschlag (Saeule, Blitz),
   * Ausklingen (Saeule wird duenn, Brandring bleibt kurz).
   * Beam frame at t (0..1): charge (aim ray flickers, ring contracts), impact (column, flash), fade (column thins, scorch ring lingers).
   */
  frame(t: number) {
    const b = this.beam;
    if (!b) return;
    const { impact, beamEnd, height } = ORBITAL_FX;
    const r = b.r;
    const show = (m: THREE.Mesh, on: boolean, opacity: number) => { m.visible = on && opacity > 0.01; (m.material as THREE.MeshBasicMaterial).opacity = opacity; };
    if (t < impact) {
      const k = t / impact;
      // Aufladen / charge
      const flicker = 0.35 + 0.35 * Math.abs(Math.sin(t * 90));
      b.core.scale.set(0.04 + 0.05 * k, height, 0.04 + 0.05 * k);
      show(b.core, true, flicker);
      show(b.outer, false, 0);
      b.ring.scale.setScalar(r * (1.8 - 1.1 * k));
      show(b.ring, true, 0.4 + 0.5 * k);
      show(b.flash, false, 0);
      show(b.scorch, false, 0);
    } else if (t < beamEnd) {
      const k = (t - impact) / (beamEnd - impact);
      const w = k < 0.15 ? k / 0.15 : 1;
      b.outer.scale.set(r * w, height, r * w);
      show(b.outer, true, 0.8);
      b.core.scale.set(r * 0.42 * w, height, r * 0.42 * w);
      show(b.core, true, 1);
      b.ring.scale.setScalar(r * (0.7 + 1.4 * k));
      show(b.ring, true, 0.9 * (1 - k));
      b.flash.scale.setScalar(r * (1.1 + 0.3 * k));
      show(b.flash, true, 0.9 * (1 - k * 0.6));
      b.scorch.scale.setScalar(r * 1.05);
      show(b.scorch, true, 0.75);
    } else {
      const k = (t - beamEnd) / (1 - beamEnd);
      const w = 1 - k;
      b.outer.scale.set(r * w * 0.8, height, r * w * 0.8);
      show(b.outer, true, 0.8 * w);
      b.core.scale.set(r * 0.3 * w, height, r * 0.3 * w);
      show(b.core, true, w);
      show(b.ring, false, 0);
      show(b.flash, true, 0.35 * w);
      b.scorch.scale.setScalar(r * (1.05 + 0.15 * k));
      show(b.scorch, true, 0.75 * w);
    }
  }

  /**
   * Einschlag ohne Strahl (Animationen aus): Blitzscheibe und Brandring, still.
   * Impact without the beam (animations off): flash disc and scorch ring, still.
   */
  still(at: THREE.Vector3, radius: number, faction: FactionId | null) {
    this.begin(at, radius, faction);
    const b = this.beam!;
    for (const m of [b.outer, b.core]) m.visible = false;
    // ohne Bloom und Bewegung: deckende Farben statt Leuchten, damit der Einschlag auf hellem Boden sichtbar bleibt
    // without bloom and motion: opaque colours instead of glow so the impact stays visible on bright ground
    const tint = faction ? factionTokens[faction].marker : semantic.orbitalUplink;
    (b.ring.material as THREE.Material).dispose();
    b.ring.material = basic(hex(tint), 0.95);
    (b.flash.material as THREE.Material).dispose();
    b.flash.material = basic(hex(semantic.orbitalCore), 0.55);
    b.ring.scale.setScalar(radius * 1.2);
    b.ring.visible = true;
    b.flash.scale.setScalar(radius * 1.1);
    (b.flash.material as THREE.MeshBasicMaterial).opacity = 0.55;
    b.flash.visible = true;
    b.scorch.scale.setScalar(radius * 1.05);
    b.scorch.visible = true;
  }

  /** Strahl entfernen / remove the beam */
  end() {
    window.clearTimeout(this.impactTimer);
    for (const c of [...this.strike.children]) {
      this.strike.remove(c);
      ((c as THREE.Mesh).material as THREE.Material).dispose();
    }
    this.beam = null;
  }

  /** Stillen Einschlag nach ms wieder entfernen / remove the still impact after ms */
  endLater(ms: number, done: () => void) {
    window.clearTimeout(this.impactTimer);
    this.impactTimer = window.setTimeout(() => { this.end(); done(); }, ms);
  }
}
