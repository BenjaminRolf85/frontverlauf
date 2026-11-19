/**
 * Raketenstart des Raketensilos (nur Darstellung): Rakete in Fraktionsfarbe fliegt auf einem Bogen vom Silo zur
 * Flaeche, zieht eine Rauchspur, schlaegt mit Blitz, Feuerball und Druckring ein. Den Brand danach zeichnet das Brett
 * (Tile.fire, gleiche Flammen wie die Lava). Ohne Animationen: nur ein kurzer stiller Einschlag.
 * Rocket silo launch (render only): a rocket in the faction colour flies on an arc from the silo to the area, leaves a
 * smoke trail, impacts with a flash, a fireball and a pressure ring. The fire afterwards is drawn by the board (Tile.fire,
 * the same flames as lava). Without animations: only a brief still impact.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { factionTokens, hex, semantic } from '../../design/tokens';
import { ADD_RGB } from '../lights';
import { glowColor } from '../post';

/** Dauer in ms, Anteil bis zum Einschlag, Bogenhoehe je Feld Entfernung (mindestens, hoechstens) / duration in ms, share until impact, arc height per tile of distance (min, max) */
export const ROCKET_FX = { ms: 1700, impact: 0.62, arcPerTile: 0.38, arcMin: 1.6, arcMax: 4.2, shake: 1.2, shakeMs: 560, trail: 18 };

const basic = (color: THREE.ColorRepresentation, opacity: number, additive = false) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, ...(additive ? ADD_RGB : {}),
  ...(additive ? { blendSrc: THREE.SrcAlphaFactor } : {}),
});
const noPick = <T extends THREE.Object3D>(o: T): T => { o.raycast = () => {}; return o; };

export class RocketFx {
  readonly group = new THREE.Group();
  private discGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
  private ringGeo = new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2);
  private ballGeo = new THREE.IcosahedronGeometry(1, 1);
  private flight: {
    from: THREE.Vector3; to: THREE.Vector3; arc: number; rocket: THREE.Group; smoke: THREE.Mesh[]; flash: THREE.Mesh; ring: THREE.Mesh;
    ball: THREE.Mesh; scorch: THREE.Mesh; r: number;
  } | null = null;
  private timer = 0;

  /** Rakete aus Rumpf, Spitze, Leitwerk und Duese (Fraktionsfarbe) / rocket of body, nose, fins and nozzle (faction colour) */
  private rocketModel(faction: FactionId | null): THREE.Group {
    const g = new THREE.Group();
    const tint = faction ? factionTokens[faction].primary : semantic.metal;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.34, 10), new THREE.MeshBasicMaterial({ color: hex(semantic.white) }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.06, 10), new THREE.MeshBasicMaterial({ color: hex(tint) }));
    band.position.y = 0.06;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 10), new THREE.MeshBasicMaterial({ color: hex(tint) }));
    nose.position.y = 0.24;
    g.add(body, band, nose);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.07), new THREE.MeshBasicMaterial({ color: hex(semantic.ink) }));
      const a = (i / 4) * Math.PI * 2;
      fin.position.set(Math.sin(a) * 0.06, -0.13, Math.cos(a) * 0.06);
      fin.rotation.y = a;
      g.add(fin);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 8), basic(glowColor(hex(semantic.fire), 2.2), 0.95, true));
    flame.rotation.x = Math.PI;
    flame.position.y = -0.25;
    g.add(flame);
    g.traverse((o) => { noPick(o); o.renderOrder = 74; o.frustumCulled = false; });
    return g;
  }

  /**
   * Flug vorbereiten: from = Silo, to = Mitte der Flaeche (Brett-Koordinaten), r = Radius des Einschlags.
   * Prepare the flight: from = silo, to = centre of the area (board coordinates), r = impact radius.
   */
  begin(from: THREE.Vector3, to: THREE.Vector3, r: number, faction: FactionId | null) {
    this.end();
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const arc = Math.max(ROCKET_FX.arcMin, Math.min(ROCKET_FX.arcMax, d * ROCKET_FX.arcPerTile));
    const rocket = this.rocketModel(faction);
    this.group.add(rocket);
    const smoke: THREE.Mesh[] = [];
    for (let i = 0; i < ROCKET_FX.trail; i++) {
      const m = noPick(new THREE.Mesh(this.ballGeo, basic(hex(i % 3 ? semantic.smoke : semantic.smokeHeavy), 0)));
      m.renderOrder = 73; m.frustumCulled = false; m.visible = false;
      this.group.add(m);
      smoke.push(m);
    }
    const mk = (geo: THREE.BufferGeometry, color: THREE.Color, opacity: number, order: number, additive = true) => {
      const m = noPick(new THREE.Mesh(geo, basic(color, opacity, additive)));
      m.renderOrder = order; m.frustumCulled = false; m.visible = false;
      m.position.copy(to);
      this.group.add(m);
      return m;
    };
    const flash = mk(this.discGeo, glowColor(hex(semantic.orbitalCore), 2.6), 0.95, 71);
    const ring = mk(this.ringGeo, glowColor(hex(semantic.fire), 2), 0.9, 71);
    const ball = mk(this.ballGeo, glowColor(hex(semantic.lavaGlow), 2.4), 0.95, 72);
    const scorch = mk(this.discGeo, new THREE.Color(hex(semantic.orbitalScorch)), 0.7, 70, false);
    for (const m of [flash, ring, scorch]) m.position.y += 0.05;
    this.flight = { from: from.clone(), to: to.clone(), arc, rocket, smoke, flash, ring, ball, scorch, r };
    this.frame(0);
  }

  /** Punkt auf dem Bogen bei k (0..1) / point on the arc at k (0..1) */
  private at(k: number): THREE.Vector3 {
    const f = this.flight!;
    const p = f.from.clone().lerp(f.to, k);
    p.y += 0.25 + 4 * f.arc * k * (1 - k);
    return p;
  }

  /** Bild bei t (0..1): Steigen und Fallen, Rauchspur, dann Einschlag / frame at t (0..1): rise and fall, smoke trail, then impact */
  frame(t: number) {
    const f = this.flight;
    if (!f) return;
    const { impact } = ROCKET_FX;
    const show = (m: THREE.Mesh, on: boolean, opacity: number) => { m.visible = on && opacity > 0.01; (m.material as THREE.MeshBasicMaterial).opacity = opacity; };
    if (t < impact) {
      const k = t / impact;
      const p = this.at(k), q = this.at(Math.min(1, k + 0.02));
      f.rocket.visible = true;
      f.rocket.position.copy(p);
      // Spitze in Flugrichtung / nose along the flight direction
      f.rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.sub(p).normalize());
      f.smoke.forEach((m, i) => {
        const kk = k - (i + 1) * 0.035;
        if (kk <= 0) { m.visible = false; return; }
        m.position.copy(this.at(kk));
        const age = (i + 1) / f.smoke.length;
        m.scale.setScalar(0.05 + 0.12 * age);
        show(m, true, 0.6 * (1 - age));
      });
      for (const m of [f.flash, f.ring, f.ball, f.scorch]) show(m, false, 0);
    } else {
      const k = (t - impact) / (1 - impact);
      f.rocket.visible = false;
      f.smoke.forEach((m, i) => show(m, m.visible, Math.max(0, (m.material as THREE.MeshBasicMaterial).opacity - 0.05 - i * 0.002)));
      f.flash.scale.setScalar(f.r * (1 + 0.4 * k));
      show(f.flash, true, 0.95 * (1 - k));
      f.ring.scale.setScalar(f.r * (0.6 + 1.6 * k));
      show(f.ring, true, 0.9 * (1 - k));
      f.ball.position.set(f.to.x, f.to.y + 0.25 + 0.5 * k, f.to.z);
      f.ball.scale.setScalar(f.r * (0.35 + 0.45 * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2)) * (1 - 0.6 * k));
      show(f.ball, true, 0.95 * (1 - k * k));
      f.scorch.scale.setScalar(f.r * 1.05);
      show(f.scorch, true, 0.7 * (1 - 0.5 * k));
    }
  }

  /** Stiller Einschlag (Animationen aus) / still impact (animations off) */
  still(at: THREE.Vector3, r: number, faction: FactionId | null) {
    this.begin(at, at, r, faction);
    const f = this.flight!;
    f.rocket.visible = false;
    f.ring.material = basic(hex(faction ? factionTokens[faction].marker : semantic.fire), 0.95);
    f.ring.scale.setScalar(r * 1.2); f.ring.visible = true;
    f.flash.material = basic(hex(semantic.orbitalCore), 0.55);
    f.flash.scale.setScalar(r * 1.1); f.flash.visible = true;
    f.scorch.scale.setScalar(r * 1.05); f.scorch.visible = true;
  }

  end() {
    window.clearTimeout(this.timer);
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      c.traverse((o) => {
        const mesh = o as THREE.Mesh;
        (mesh.material as THREE.Material | undefined)?.dispose();
        // eigene Geometrien der Rakete freigeben, geteilte behalten / free the rocket's own geometries, keep the shared ones
        if (mesh.geometry && mesh.geometry !== this.discGeo && mesh.geometry !== this.ringGeo && mesh.geometry !== this.ballGeo) mesh.geometry.dispose();
      });
    }
    this.flight = null;
  }

  endLater(ms: number, done: () => void) {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.end(); done(); }, ms);
  }
}
