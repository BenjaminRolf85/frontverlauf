/**
 * Leuchten (Bloom) fuer helle, selbstleuchtende Teile: Lava, Explosionen, Laser, Xeno-Glimmen, Stadtlichter.
 * Nur bei hoher Qualitaet und nie in XR. Hohe Schwelle, damit nur Ueberhelles (HDR) leuchtet.
 * Glow (bloom) for bright, self-lit parts: lava, explosions, lasers, xeno glimmer, city lights.
 * Only on high quality and never in XR. High threshold so only over-bright (HDR) pixels glow.
 *
 * Der transparente Canvas-Hintergrund bleibt erhalten: der Bloom addiert nur Farbe, nie Alpha.
 * The transparent canvas background is kept: bloom only adds colour, never alpha.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Helligkeit, ab der ein Pixel leuchtet (lineares HDR) / luminance from which a pixel glows (linear HDR) */
export const BLOOM_THRESHOLD = 1.05;

/**
 * Farbe fuer Effekte, die leuchten sollen (Explosionen, Laser, Muendungsfeuer): ueber 1 skaliert, damit der Bloom greift.
 * Ohne Bloom (niedrige Qualitaet, XR) wird sie einfach hell dargestellt. Gedacht fuer MeshBasicMaterial.color.
 * Colour for effects that should glow (explosions, lasers, muzzle flashes): scaled above 1 so bloom picks it up.
 * Without bloom (low quality, XR) it simply renders bright. Meant for MeshBasicMaterial.color.
 */
export function glowColor(color: THREE.ColorRepresentation, strength = 2.2): THREE.Color {
  return new THREE.Color(color).multiplyScalar(strength);
}

export class Bloom {
  private composer: EffectComposer;
  private pass: UnrealBloomPass;
  private renderPass: RenderPass;
  private mipScale = 2;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    // Mehrfachabtastung, damit die Tuschelinien glatt bleiben; auf Touch-Geraeten (hohe Pixeldichte) sparsamer
    // multisampling so ink lines stay smooth; leaner on touch devices (high pixel density)
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.mipScale = touch ? 3 : 2;
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: touch ? 2 : 4 });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.renderPass.clearAlpha = 0;
    this.pass = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.6, 0.55, BLOOM_THRESHOLD);
    // nur Farbe addieren, Alpha unveraendert lassen / add colour only, keep alpha unchanged
    const bm = this.pass.blendMaterial;
    bm.blending = THREE.CustomBlending;
    bm.blendEquation = THREE.AddEquation;
    bm.blendSrc = THREE.OneFactor; bm.blendDst = THREE.OneFactor;
    bm.blendSrcAlpha = THREE.ZeroFactor; bm.blendDstAlpha = THREE.OneFactor;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.pass);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  set strength(v: number) { this.pass.strength = v; }

  resize() {
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(r.getPixelRatio());
    this.composer.setSize(size.x, size.y);
    // Bloom in halber (Touch: drittel) Aufloesung, guenstiger / bloom at half (touch: third) resolution, cheaper
    const ratio = r.getPixelRatio();
    this.pass.setSize(Math.round((size.x * ratio) / this.mipScale), Math.round((size.y * ratio) / this.mipScale));
  }

  render(camera: THREE.Camera) {
    this.renderPass.camera = camera;
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    this.pass.dispose();
  }
}
