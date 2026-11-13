/**
 * 3D-Portraet der gewaehlten Einheit im Infofeld: ein kleiner eigener Renderer mit drehendem Modell.
 * Die Leinwand wird wiederverwendet und nach jedem HUD-Neuaufbau in den Platzhalter gehaengt.
 * 3D portrait of the selected unit in the info panel: a small dedicated renderer with a turning model.
 * The canvas is reused and re-attached to the placeholder after every HUD rebuild.
 */
import * as THREE from 'three';
import type { FactionId, UnitTypeId } from '../data/balance';
import { factionTokens, hex, semantic } from '../design/tokens';
import { unitGeometry } from '../render/models';
import { outlined, unitMaterial } from '../render/toon';

/** Drehgeschwindigkeit in Radiant pro Sekunde / turn speed in radians per second */
const TURN_SPEED = 0.6;
/** Pixelgroesse des Portraets (CSS) / portrait size in CSS pixels */
const SIZE = 72;

export class Portrait {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  private holder = new THREE.Group();
  private key = '';
  private raf = 0;
  private last = 0;
  private angle = -0.6;
  readonly canvas = document.createElement('canvas');
  /** Drehung an/aus (folgt der Einstellung Animationen) / rotation on/off (follows the animations setting) */
  animate = true;

  constructor() {
    this.canvas.className = 'portrait-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.scene.add(new THREE.HemisphereLight(hex(semantic.white), hex(semantic.terrainPlainSide), 1.8));
    const sun = new THREE.DirectionalLight(hex(semantic.white), 2.2);
    sun.position.set(2, 4, 3);
    this.scene.add(sun, this.holder);
    this.camera.position.set(0, 0.5, 1.35);
    this.camera.lookAt(0, 0.27, 0);
  }

  private ensure(): THREE.WebGLRenderer | null {
    if (this.renderer) return this.renderer;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.setSize(SIZE, SIZE, false);
    } catch {
      this.renderer = null;
    }
    return this.renderer;
  }

  /**
   * Portraet in den Platzhalter haengen; ohne Platzhalter wird angehalten.
   * Attach the portrait to the placeholder; without a placeholder it stops.
   */
  attach(slot: HTMLElement | null, type?: UnitTypeId, faction?: FactionId, carried: UnitTypeId | null = null) {
    if (!slot || !type || !faction) { this.stop(); return; }
    if (!this.ensure()) return;
    slot.appendChild(this.canvas);
    const key = `${type}-${faction}-${carried}`;
    if (key !== this.key) {
      this.key = key;
      this.holder.clear();
      try {
        const g = unitGeometry(type, faction, carried);
        const model = outlined(g, 0.012, unitMaterial());
        // Modell mittig und passend skaliert / centre and scale the model
        g.computeBoundingBox();
        const box = g.boundingBox!;
        const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) || 1;
        const sc = 0.62 / size;
        model.scale.setScalar(sc);
        model.position.set(-(box.min.x + box.max.x) / 2 * sc, -box.min.y * sc, -(box.min.z + box.max.z) / 2 * sc);
        // Sockel in Fraktionsfarbe / base in faction colour
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.05, 24), new THREE.MeshToonMaterial({ color: hex(factionTokens[faction].primary) }));
        base.position.y = -0.03;
        this.holder.add(base, model);
      } catch {
        // Modell fehlt: Portraet bleibt leer / model missing: portrait stays empty
      }
    }
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((n) => this.frame(n)); }
  }

  private frame(now: number) {
    this.raf = 0;
    if (!this.canvas.isConnected || !this.renderer) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.animate) this.angle += dt * TURN_SPEED;
    this.holder.rotation.y = this.angle;
    this.renderer.render(this.scene, this.camera);
    if (this.animate) this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas.remove();
  }
}
