/**
 * Goettlicher Funke (nur Darstellung): ein leuchtender Funke (goldener Kern, vierzackiger Lichtstern, Funkenspur) steigt von
 * der Muendung des Geschuetzes auf einem hohen Bogen auf und faellt auf die 2x2-Flaeche; dort steht kurz eine Lichtsaeule,
 * die Flaeche blitzt als Quadrat auf, ein Lichtring laeuft aus und ein Sternkranz strahlt nach aussen. Farben aus den
 * Alvenia-Tokens (Sonnenkranz, Strahl, Gold). Ohne Animationen: nur ein kurzer stiller Einschlag.
 * Divine Spark (render only): a glowing spark (golden core, four-pointed star of light, trail of sparks) rises from the
 * gun's muzzle on a high arc and falls onto the 2x2 area; there a column of light stands briefly, the area flashes as a
 * square, a ring of light runs out and a star burst radiates outwards. Colours from the Alvenia tokens (halo, beam,
 * gold). Without animations: only a brief still impact.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { hex, semantic } from '../../design/tokens';
import { ADD_RGB } from '../lights';
import { glowColor } from '../post';

/** Dauer in ms, Anteil bis zum Einschlag, Bogenhoehe (je Feld, Grenzen), Beben / duration in ms, share until impact, arc height (per tile, limits), shake */
export const SPARK_FX = { ms: 1800, impact: 0.6, arcPerTile: 0.6, arcMin: 2.4, arcMax: 5.2, shake: 1.3, shakeMs: 620, trail: 22, rays: 8, column: 3.2 };

const basic = (color: THREE.ColorRepresentation, opacity: number, additive = false) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, ...(additive ? ADD_RGB : {}),
  ...(additive ? { blendSrc: THREE.SrcAlphaFactor } : {}),
});
const noPick = <T extends THREE.Object3D>(o: T): T => { o.raycast = () => {}; return o; };

/** Vierzackiger Stern in der Ebene (fuer Funke und Sternkranz) / four-pointed star in the plane (for the spark and the star burst) */
function starGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 + (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.22;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}

export class SparkFx {
  readonly group = new THREE.Group();
  private ballGeo = new THREE.IcosahedronGeometry(1, 1);
  private starGeo = starGeometry();
  private squareGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private ringGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
  private columnGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
  private rayGeo = new THREE.PlaneGeometry(1, 0.08).translate(0.5, 0, 0).rotateX(-Math.PI / 2);
  private flight: {
    from: THREE.Vector3; to: THREE.Vector3; arc: number; core: THREE.Mesh; glow: THREE.Mesh; star: THREE.Mesh; trail: THREE.Mesh[];
    square: THREE.Mesh; ring: THREE.Mesh; column: THREE.Mesh; rays: THREE.Mesh[]; scorch: THREE.Mesh; size: number;
  } | null = null;
  private timer = 0;

  /**
   * Flug vorbereiten: from = Muendung des Geschuetzes, to = Mitte der Flaeche (Brett-Koordinaten), size = Kantenlaenge der Flaeche.
   * Prepare the flight: from = the gun's muzzle, to = centre of the area (board coordinates), size = edge length of the area.
   */
  begin(from: THREE.Vector3, to: THREE.Vector3, size: number, faction: FactionId | null) {
    void faction;
    this.end();
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const arc = Math.max(SPARK_FX.arcMin, Math.min(SPARK_FX.arcMax, d * SPARK_FX.arcPerTile));
    const mk = (geo: THREE.BufferGeometry, color: THREE.Color, opacity: number, order: number, additive = true) => {
      const m = noPick(new THREE.Mesh(geo, basic(color, opacity, additive)));
      m.renderOrder = order; m.frustumCulled = false; m.visible = false;
      this.group.add(m);
      return m;
    };
    const core = mk(this.ballGeo, glowColor(hex(semantic.orbitalCore), 2.8), 1, 76);
    const glow = mk(this.ballGeo, glowColor(hex(semantic.faithHalo), 2.2), 0.55, 75);
    const star = mk(this.starGeo, glowColor(hex(semantic.faithGoldLight), 2.6), 0.95, 77);
    const trail: THREE.Mesh[] = [];
    for (let i = 0; i < SPARK_FX.trail; i++) trail.push(mk(this.ballGeo, glowColor(hex(i % 2 ? semantic.faithHalo : semantic.faithBeam), 2), 0, 74));
    const square = mk(this.squareGeo, glowColor(hex(semantic.faithBeam), 1.5), 0.6, 71);
    const ring = mk(this.ringGeo, glowColor(hex(semantic.faithHalo), 2.2), 0.9, 71);
    const column = mk(this.columnGeo, glowColor(hex(semantic.faithHalo), 1.4), 0.45, 72);
    const rays: THREE.Mesh[] = [];
    for (let i = 0; i < SPARK_FX.rays; i++) rays.push(mk(this.rayGeo, glowColor(hex(semantic.faithGoldLight), 2.4), 0.9, 73));
    const scorch = mk(this.squareGeo, new THREE.Color(hex(semantic.orbitalScorch)), 0.55, 70, false);
    for (const m of [square, ring, column, scorch, ...rays]) m.position.copy(to);
    for (const m of [square, ring, scorch, ...rays]) m.position.y += 0.05;
    this.flight = { from: from.clone(), to: to.clone(), arc, core, glow, star, trail, square, ring, column, rays, scorch, size };
    this.frame(0);
  }

  /** Punkt auf dem Bogen bei k (0..1) / point on the arc at k (0..1) */
  private at(k: number): THREE.Vector3 {
    const f = this.flight!;
    const p = f.from.clone().lerp(f.to, k);
    p.y += 4 * f.arc * k * (1 - k);
    return p;
  }

  /** Bild bei t (0..1): Aufstieg, Fall mit Funkenspur, dann Einschlag / frame at t (0..1): rise, fall with a trail of sparks, then the impact */
  frame(t: number) {
    const f = this.flight;
    if (!f) return;
    const { impact } = SPARK_FX;
    const show = (m: THREE.Mesh, on: boolean, opacity: number) => { m.visible = on && opacity > 0.01; (m.material as THREE.MeshBasicMaterial).opacity = opacity; };
    if (t < impact) {
      // Aufladen an der Muendung (erstes Fuenftel), dann Flug / charging at the muzzle (first fifth), then the flight
      const charge = Math.min(1, t / (impact * 0.2));
      const k = Math.max(0, (t - impact * 0.2) / (impact * 0.8));
      const p = this.at(k);
      const pulse = 1 + 0.25 * Math.sin(t * 60);
      f.core.position.copy(p); f.core.scale.setScalar(0.07 * (0.5 + 0.5 * charge) * pulse);
      f.glow.position.copy(p); f.glow.scale.setScalar(0.16 * (0.4 + 0.6 * charge) * pulse);
      f.star.position.copy(p); f.star.scale.setScalar(0.28 * (0.3 + 0.7 * charge));
      f.star.rotation.set(0, 0, t * 9);
      show(f.core, true, 1); show(f.glow, true, 0.55); show(f.star, true, 0.95);
      f.trail.forEach((m, i) => {
        const kk = k - (i + 1) * 0.03;
        if (kk <= 0 || k <= 0) { m.visible = false; return; }
        m.position.copy(this.at(kk));
        const age = (i + 1) / f.trail.length;
        m.scale.setScalar(0.05 * (1 - age) + 0.012);
        show(m, true, 0.85 * (1 - age));
      });
      for (const m of [f.square, f.ring, f.column, f.scorch, ...f.rays]) show(m, false, 0);
    } else {
      const k = (t - impact) / (1 - impact);
      for (const m of [f.core, f.glow, f.star, ...f.trail]) show(m, false, 0);
      // Quadratischer Blitz ueber der 2x2-Flaeche, Lichtring, Saeule, Sternkranz / square flash over the 2x2 area, ring of light, column, star burst
      f.square.scale.set(f.size * (1 + 0.08 * k), 1, f.size * (1 + 0.08 * k));
      show(f.square, true, 0.6 * (1 - k));
      f.ring.scale.setScalar(f.size * (0.55 + 1.1 * k));
      show(f.ring, true, 0.9 * (1 - k));
      const cw = f.size * 0.16 * (1 - 0.6 * k);
      f.column.scale.set(cw, SPARK_FX.column * (1 - 0.3 * k), cw);
      show(f.column, true, 0.5 * (1 - k) * (1 - k));
      f.rays.forEach((m, i) => {
        m.rotation.y = (i / f.rays.length) * Math.PI * 2 + 0.3;
        m.scale.set(f.size * (0.4 + 0.9 * k), 1, 1);
        show(m, true, 0.9 * (1 - k));
      });
      f.scorch.scale.set(f.size * 0.96, 1, f.size * 0.96);
      show(f.scorch, true, 0.55 * (1 - 0.5 * k));
    }
  }

  /** Stiller Einschlag (Animationen aus) / still impact (animations off) */
  still(at: THREE.Vector3, size: number, faction: FactionId | null) {
    this.begin(at, at, size, faction);
    this.frame(SPARK_FX.impact + (1 - SPARK_FX.impact) * 0.25);
  }

  end() {
    window.clearTimeout(this.timer);
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      ((c as THREE.Mesh).material as THREE.Material | undefined)?.dispose();
    }
    this.flight = null;
  }

  endLater(ms: number, done: () => void) {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.end(); done(); }, ms);
  }
}
