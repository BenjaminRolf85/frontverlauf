/**
 * Isometrische Ansicht: orthografische Kamera, 45 Grad gedreht, verschieben, zoomen, in 90-Grad-Schritten drehen.
 * Isometric view: orthographic camera rotated 45 degrees; pan, zoom, rotate in 90 degree steps.
 */
import * as THREE from 'three';
import { hex, semantic } from '../design/tokens';
import { Board } from './board';
import { SWAY } from './ambient';
import { ANIM, CAMERA, SUN } from './config';

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly board = new Board();
  readonly target = new THREE.Vector3();
  rotation = 0; // in 90-Grad-Schritten / in 90 degree steps
  private angle = Math.PI / 4;
  private angleFrom = this.angle;
  private angleTo = this.angle;
  private angleStart = 0;
  zoom = 1;
  private needs = true;
  private lastNow = 0;
  onFrame: ((now: number, frame?: XRFrame) => void) | null = null;
  quality: 'low' | 'high' = 'high';
  private sun: THREE.DirectionalLight;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.scene.add(this.board.group);
    const hemi = new THREE.HemisphereLight(hex(semantic.white), hex(semantic.terrainPlainSide), 1.6);
    this.sun = new THREE.DirectionalLight(hex(semantic.white), 2.2);
    this.sun.position.set(SUN.x, SUN.y, SUN.z);
    // eine guenstige Schattenquelle nur fuer Einheiten / one cheap shadow source for units only
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(hemi, this.sun, this.sun.target);
    this.resize();
    // Eine Ausnahme darf die Render-Schleife nie beenden / an exception must never end the render loop
    this.renderer.setAnimationLoop((now, frame) => {
      try { this.loop(now, frame); } catch (e) { console.error(e); this.board.finishAnimations(); }
    });
  }

  setQuality(q: 'low' | 'high') {
    this.quality = q;
    this.resize();
    this.applyShadows();
  }

  /** Schatten nur bei hoher Qualitaet und nicht in XR / shadows only on high quality and not in XR */
  applyShadows(inXr = this.renderer.xr.isPresenting) {
    // projizierte Comic-Schatten ersetzen die Schattenkarte / projected comic shadows replace the shadow map
    const on = false && this.quality === 'high' && !inXr;
    const half = this.mapSize * 0.75 + 1;
    const cam = this.sun.shadow.camera;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.near = 0.5; cam.far = 40;
    cam.updateProjectionMatrix();
    if (this.renderer.shadowMap.enabled !== on || this.sun.castShadow !== on) {
      this.renderer.shadowMap.enabled = on;
      this.sun.castShadow = on;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!m) return;
        for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
      });
    }
    this.needs = true;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.updateCamera();
  }

  /** Karte vollstaendig einpassen / fit the whole map */
  fit(size: number) {
    this.target.set(0, 0, 0);
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const portrait = h > w;
    this.zoom = portrait ? 2.6 : 2;
    this.mapSize = size;
    this.applyShadows();
    this.updateCamera();
  }
  mapSize = 14;

  private updateCamera() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    const span = this.mapSize * CAMERA.baseView / this.zoom;
    const halfH = aspect < 1 ? span / aspect * 0.9 : span;
    const halfW = halfH * aspect;
    this.camera.left = -halfW; this.camera.right = halfW; this.camera.top = halfH; this.camera.bottom = -halfH;
    const el = CAMERA.elevation, d = CAMERA.distance;
    // Wackeln verschiebt nur die Kamera, nicht das gespeicherte Ziel / shake offsets only the camera, not the stored target
    const look = this.shakeOffset.lengthSq() ? this.target.clone().add(this.shakeOffset) : this.target;
    this.camera.position.set(
      look.x + Math.cos(this.angle) * Math.cos(el) * d,
      look.y + Math.sin(el) * d,
      look.z + Math.sin(this.angle) * Math.cos(el) * d,
    );
    this.camera.lookAt(look);
    this.camera.updateProjectionMatrix();
    this.needs = true;
  }

  rotate(dir: 1 | -1, animate = true) {
    this.rotation = (this.rotation + dir + 4) % 4;
    this.angleFrom = this.angle;
    this.angleTo = this.angleTo + (dir * Math.PI) / 2;
    this.angleStart = performance.now();
    if (!animate) { this.angle = this.angleTo; this.updateCamera(); }
    this.needs = true;
  }

  setZoom(z: number) {
    this.zoom = Math.max(CAMERA.minZoom, Math.min(CAMERA.maxZoom, z));
    this.updateCamera();
  }

  /** Verschieben in Bildschirmpixeln / pan in screen pixels */
  pan(dx: number, dy: number) {
    const h = this.canvas.clientHeight || window.innerHeight;
    const worldPerPixel = (this.camera.top - this.camera.bottom) / h;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    right.y = 0; up.y = 0; right.normalize(); up.normalize();
    const factor = 1 / Math.sin(CAMERA.elevation);
    this.target.addScaledVector(right, -dx * worldPerPixel);
    this.target.addScaledVector(up, dy * worldPerPixel * factor);
    const lim = this.mapSize / 2 + 1;
    this.target.x = Math.max(-lim, Math.min(lim, this.target.x));
    this.target.z = Math.max(-lim, Math.min(lim, this.target.z));
    this.updateCamera();
  }

  centerOn(p: THREE.Vector3) {
    this.target.set(p.x, 0, p.z);
    this.updateCamera();
  }

  raycaster(clientX: number, clientY: number): THREE.Raycaster {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray;
  }

  /** Weltpunkt auf den Bildschirm / world point to screen */
  toScreen(p: THREE.Vector3): { x: number; y: number } {
    const v = p.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  invalidate() { this.needs = true; }

  private shakeAmp = 0;
  private shakeStart = 0;
  private shakeDur = 0;
  private shakeSeed = 0;
  private readonly shakeOffset = new THREE.Vector3();

  /**
   * Kamerawackeln mit abklingendem Rauschen (Staerke ~0.3 leicht, ~0.8 grosse Explosion, ~1.5 Vulkan).
   * Nicht in XR und nur mit eingeschalteten Animationen; ein staerkeres laufendes Wackeln bleibt.
   * Camera shake with decaying noise (strength ~0.3 light, ~0.8 big explosion, ~1.5 volcano).
   * Not in XR and only with animations enabled; a stronger running shake is kept.
   */
  shake(strength: number, durationMs = 340) {
    if (strength <= 0 || !this.board.animations || this.renderer.xr.isPresenting) return;
    const now = performance.now();
    const k = this.shakeDur ? Math.min(1, (now - this.shakeStart) / this.shakeDur) : 1;
    if (this.shakeAmp * (1 - k) * (1 - k) > strength) return;
    this.shakeAmp = strength;
    this.shakeStart = now;
    this.shakeDur = Math.max(60, durationMs);
    this.shakeSeed = Math.random() * 100;
    this.needs = true;
  }

  private applyShake() {
    const k = (performance.now() - this.shakeStart) / this.shakeDur;
    if (k >= 1 || !this.board.animations || this.renderer.xr.isPresenting) {
      this.shakeAmp = 0;
      this.shakeOffset.set(0, 0, 0);
      this.updateCamera();
      return;
    }
    // Ausschlag relativ zur sichtbaren Hoehe: wirkt bei jedem Zoom gleich / amplitude relative to the visible height: same at every zoom
    const amp = this.shakeAmp * (1 - k) * (1 - k) * (this.camera.top - this.camera.bottom) * 0.016;
    const t = k * this.shakeDur * 0.001 + this.shakeSeed;
    const ox = (Math.sin(t * 61) * 0.6 + Math.sin(t * 107 + 1.3) * 0.4) * amp;
    const oy = (Math.sin(t * 73 + 2.1) * 0.6 + Math.sin(t * 131 + 0.4) * 0.4) * amp;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.shakeOffset.copy(right).multiplyScalar(ox).addScaledVector(up, oy);
    this.updateCamera();
  }

  private loop(now: number, frame?: XRFrame) {
    if (this.angle !== this.angleTo) {
      const t = this.board.animations ? Math.min(1, (now - this.angleStart) / ANIM.rotate) : 1;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.angle = this.angleFrom + (this.angleTo - this.angleFrom) * e;
      if (t >= 1) this.angle = this.angleTo;
      this.updateCamera();
    }
    this.onFrame?.(now, frame);
    // Lebendige Karte / living map
    if (this.board.animations) {
      const sec = now / 1000;
      SWAY.uTime.value = sec;
      const targetWind = this.board.weatherFx.kind === 'wind' ? 1 : 0;
      SWAY.uWind.value += (targetWind - SWAY.uWind.value) * 0.03;
      this.board.ambient.update(sec);
      this.board.pulseMarkers(sec);
      this.needs = true;
    }
    const wfx = this.board.weatherFx;
    if (wfx.active) {
      wfx.animate = this.board.animations;
      wfx.update(this.lastNow ? (now - this.lastNow) / 1000 : 0);
      if (wfx.animate) this.needs = true;
    }
    this.lastNow = now;
    if (this.shakeAmp > 0) this.applyShake();
    const boardChanged = this.board.tick(now);
    if (this.renderer.xr.isPresenting) {
      this.renderer.render(this.scene, this.renderer.xr.getCamera());
      return;
    }
    if (boardChanged || this.needs) {
      this.needs = false;
      this.renderer.render(this.scene, this.camera);
    }
  }
}
