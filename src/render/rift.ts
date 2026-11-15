/**
 * Der Riss zwischen den Welten (Ende von m11, nur Darstellung): ein senkrechter, wirbelnder Riss im Raum ueber der
 * Schwarmmutter, violett und schwarz mit giftig gruengoldenem Rand, der Funken und Truemmer spiralfoermig einsaugt.
 * open() spielt das Aufreissen ab (ohne Animationen sofort fertig und still), danach bleibt er stehen.
 * The rift between the worlds (end of m11, render only): an upright, swirling tear in space above the Swarm Mother,
 * violet and black with a sickly green-gold edge, sucking sparks and debris in on a spiral. open() plays the tearing
 * (without animations finished at once and still), afterwards it stays.
 */
import * as THREE from 'three';
import { hex, semantic } from '../design/tokens';
import { ATMO } from './atmosphere';
import { glowColor } from './post';

/** Dauer des Aufreissens in ms / duration of the tearing in ms */
export const RIFT_OPEN_MS = 2600;
const PARTS = 110, DEBRIS = 22;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
/** Wirbel: dunkler Kern, violette Spiralarme, gruengoldener Rand, nach aussen ausfransend / swirl: dark core, violet arms, green-gold rim, frayed outwards */
const FRAG = /* glsl */ `
  uniform float uTime; uniform float uOpen;
  uniform vec3 uVoid; uniform vec3 uViolet; uniform vec3 uBright; uniform vec3 uSick; uniform vec3 uGold;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= 1.8;
    float r = length(p);
    float a = atan(p.y, p.x);
    float swirl = sin(a * 3.0 + r * 9.0 - uTime * 2.6) * 0.5 + 0.5;
    float fray = sin(a * 11.0 + uTime * 1.7) * 0.06 + sin(a * 23.0 - uTime * 3.1) * 0.03;
    float edge = 0.92 * uOpen + fray * uOpen;
    if (r > edge + 0.08) discard;
    // Spiralarme in Violett bis Hellviolett, schwarzer Kern / spiral arms violet to bright violet, black core
    float arms = smoothstep(0.35, 0.75, swirl) * smoothstep(0.05, 0.45, r);
    vec3 c = mix(uVoid, uViolet, arms);
    c = mix(c, uBright, arms * smoothstep(0.3, 0.8, r) * 0.85);
    float rim = smoothstep(edge - 0.09, edge - 0.01, r);
    c = mix(c, mix(uSick, uGold, swirl), rim);
    float alpha = 1.0 - smoothstep(edge, edge + 0.08, r);
    gl_FragColor = vec4(c * (1.0 + arms * 0.6 + rim * 1.2), alpha);
  }`;

export class RiftFx {
  readonly group = new THREE.Group();
  private disc: THREE.Mesh | null = null;
  private parts: THREE.InstancedMesh | null = null;
  private debris: THREE.InstancedMesh | null = null;
  private seeds: { a: number; r: number; y: number; sp: number }[] = [];
  private start = 0;
  private at = new THREE.Vector3();
  private uniforms = {
    uTime: ATMO.uTime, uOpen: { value: 0 },
    uVoid: { value: new THREE.Color(hex(semantic.riftVoid)) }, uViolet: { value: new THREE.Color(hex(semantic.riftViolet)) },
    uBright: { value: new THREE.Color(hex(semantic.riftVioletBright)) }, uSick: { value: new THREE.Color(hex(semantic.riftSick)) },
    uGold: { value: new THREE.Color(hex(semantic.riftGold)) },
  };
  private tmp = new THREE.Object3D();
  /** Schluessel der gezeigten Stelle / key of the shown spot */
  key = '';

  get active() { return !!this.disc; }

  clear() {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
    }
    this.disc = this.parts = this.debris = null;
    this.key = '';
  }

  /**
   * Riss an p (Brett-Koordinaten, Bodenhoehe) zeigen; animate = aufreissen, sonst sofort offen und still.
   * Show the rift at p (board coordinates, ground height); animate = tear open, otherwise open at once and still.
   */
  show(p: THREE.Vector3, animate: boolean, now = performance.now()) {
    this.clear();
    this.key = `${p.x},${p.z}`;
    this.at.copy(p);
    this.start = animate ? now : now - RIFT_OPEN_MS;
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), mat);
    disc.position.set(p.x, p.y + 1.6, p.z);
    disc.renderOrder = 70;
    disc.raycast = () => {};
    disc.frustumCulled = false;
    this.disc = disc;
    this.group.add(disc);
    // Funken in Rissfarben fuer den Bloom / sparks in rift colours for the bloom
    const pm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.03, 0), new THREE.MeshBasicMaterial({ color: hex(semantic.white), transparent: true, depthWrite: false }), PARTS);
    // jeder dritte Funke gruengold / every third spark green-gold
    const sick = glowColor(hex(semantic.riftSick), 1.6), violet = glowColor(hex(semantic.riftVioletBright), 1.8);
    for (let i = 0; i < PARTS; i++) pm.setColorAt(i, i % 3 ? violet : sick);
    const dm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: hex(semantic.riftViolet) }), DEBRIS);
    for (const m of [pm, dm]) { m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 71; this.group.add(m); }
    this.parts = pm; this.debris = dm;
    let seed = 4242;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    this.seeds = Array.from({ length: PARTS + DEBRIS }, () => ({ a: rnd() * Math.PI * 2, r: 0.6 + rnd() * 3.2, y: rnd() * 2.6, sp: 0.4 + rnd() * 0.8 }));
    this.update(now);
  }

  /** Billboard und Partikel fortschreiben; true solange sichtbar / advance billboard and particles; true while visible */
  update(now: number, camera?: THREE.Camera): boolean {
    if (!this.disc) return false;
    const k = Math.min(1, (now - this.start) / RIFT_OPEN_MS);
    const e = 1 - Math.pow(1 - k, 3);
    this.uniforms.uOpen.value = e;
    if (camera) { this.disc.quaternion.copy(camera.quaternion); }
    const t = now / 1000;
    const o = this.tmp;
    const pull = (i: number, m: THREE.InstancedMesh, j: number, s: number) => {
      const q = this.seeds[i];
      // Lauf von aussen nach innen, endlos / run from outside in, endless
      const f = ((t * q.sp * 0.35 + q.a) % 1 + 1) % 1;
      const r = q.r * (1 - f) * (0.3 + 0.7 * e);
      const a = q.a + f * 7;
      o.position.set(this.at.x + Math.cos(a) * r, this.at.y + 1.6 + (q.y - 1.3) * (1 - f) * 0.8, this.at.z + Math.sin(a) * r);
      o.rotation.set(a, a * 0.7, 0);
      o.scale.setScalar(s * (0.4 + (1 - f)) * e);
      o.updateMatrix();
      m.setMatrixAt(j, o.matrix);
    };
    for (let i = 0; i < PARTS; i++) pull(i, this.parts!, i, 1);
    for (let i = 0; i < DEBRIS; i++) pull(PARTS + i, this.debris!, i, 1);
    this.parts!.instanceMatrix.needsUpdate = true;
    this.debris!.instanceMatrix.needsUpdate = true;
    return true;
  }

  /** Nur zur Kamera drehen (ohne Animationen) / only turn towards the camera (without animations) */
  face(camera: THREE.Camera) { this.disc?.quaternion.copy(camera.quaternion); }

  /** Laeuft das Aufreissen noch? / is the tearing still running? */
  opening(now: number) { return !!this.disc && now - this.start < RIFT_OPEN_MS; }
}
