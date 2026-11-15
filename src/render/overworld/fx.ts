/**
 * Effekte der Oberwelt: Wasserfaelle ueber den Scheibenrand (Shader mit wandernden Schaumstreifen), Gischt, Comic-Wolken,
 * Wirbel fuer Riss und Portal, Punktbogen zwischen den Welten und weiche Lichthoefe.
 * Overworld effects: waterfalls over the disc rim (shader with travelling foam streaks), mist, comic clouds, swirl for
 * rift and portal, dotted arcs between the worlds and soft halos.
 */
import * as THREE from 'three';
import { hex, semantic } from '../../design/tokens';
import { cloud } from '../models/nature';
import { commitInstances, place, rand, setInstance, softDot, type Clock, type Look } from './kit';
import { bird, puff } from './props';

const col = (c: string) => new THREE.Color(hex(c));

// ---------- Wasserfall / waterfall ----------

/**
 * Wasserfall vom Randpunkt (x, z) der Scheibe nach aussen und unten; laenge in Welteinheiten.
 * Waterfall from the rim point (x, z) of the disc outward and down; length in world units.
 */
export function waterfall(clock: Clock, x: number, z: number, opts: { length?: number; width?: number; seed?: number } = {}): THREE.Mesh {
  const len = opts.length ?? 1.5, w0 = opts.width ?? 0.1;
  const out = new THREE.Vector2(x, z).normalize();
  const n = 14;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const side = new THREE.Vector3(-out.y, 0, out.x);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Wurfparabel: erst nach aussen, dann steil nach unten / projectile curve: outward first, then steeply down
    const o = 0.05 + Math.sqrt(t) * 0.22;
    const y = 0.012 - t * t * len * 0.35 - t * len * 0.65;
    const cx = x + out.x * o, cz = z + out.y * o;
    const w = w0 * (1 + t * 1.6);
    for (const s of [-1, 1]) {
      pos.push(cx + side.x * w * s, y, cz + side.z * w * s);
      uv.push(s < 0 ? 0 : 1, t);
    }
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: clock.uTime, uSeed: { value: opts.seed ?? 0 },
      uDeep: { value: col(semantic.terrainOcean) }, uLight: { value: col(semantic.terrainShallow) }, uFoam: { value: col(semantic.waterFoam) },
      uInk: { value: col(semantic.ink) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uSeed; uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uFoam; uniform vec3 uInk;
      varying vec2 vUv;
      void main() {
        float x = vUv.x, y = vUv.y;
        float lane = floor(x * 5.0);
        float streak = fract(y * 4.0 - uTime * (0.8 + 0.15 * sin(lane * 3.1 + uSeed)) + sin(lane * 1.7 + uSeed) * 0.5);
        float foam = step(0.72, streak);
        vec3 c = mix(uLight, uDeep, step(0.5, fract(x * 2.5 + 0.25)) * 0.45);
        c = mix(c, uFoam, max(foam * 0.85, smoothstep(0.55, 0.95, y)));
        // Tuschekante links und rechts / ink edge left and right
        float edge = min(x, 1.0 - x);
        c = mix(uInk, c, step(0.07, edge));
        float a = 1.0 - smoothstep(0.62, 1.0, y);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.raycast = () => {};
  mesh.renderOrder = 2;
  return mesh;
}

// ---------- Gischt, Wolken / mist, clouds ----------

/** Gischtwolke aus Comic-Bauschen am Fuss eines Wasserfalls / mist puffs at the foot of a waterfall */
export function mist(look: Look, x: number, y: number, z: number, seed: number, count = 5): THREE.Group {
  const R = rand(seed);
  const grp = new THREE.Group();
  const mats: THREE.Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const s = 0.07 + R() * 0.07;
    mats.push(place(x + (R() - 0.5) * 0.32, y + (R() - 0.5) * 0.12, z + (R() - 0.5) * 0.32, R() * 6, s));
  }
  const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  const colours = new Float32Array(g.getAttribute('position').count * 3);
  const c1 = col(semantic.overworldMist), c2 = col(semantic.overworldMistShade);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) { const c = pos.getY(i) > -0.2 ? c1 : c2; colours.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  g.computeVertexNormals();
  grp.add(look.instanced(g, mats, 0.09));
  grp.userData.base = y;
  return grp;
}

/** Comic-Wolke (Modell vom Brett), optional umgefaerbt / comic cloud (board model), optionally recoloured */
export function cloudMesh(look: Look, variant: number, tint?: { color: string; amount: number }): THREE.Group {
  const g = cloud(variant).build();
  if (tint) {
    const c = g.getAttribute('color');
    const to = col(tint.color), tmp = new THREE.Color();
    for (let i = 0; i < c.count; i++) { tmp.setRGB(c.getX(i), c.getY(i), c.getZ(i)).lerp(to, tint.amount); c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  }
  return look.inked(g, 0.03);
}

/**
 * Wolkenkranz, der langsam um die Scheibe zieht (Gruppe dreht sich in update) / cloud ring slowly drifting around the disc.
 */
export function cloudRing(look: Look, R: number, count: number, seed: number, opts: { tint?: { color: string; amount: number }; y?: number; scale?: number } = {}) {
  const Rn = rand(seed);
  const grp = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const c = cloudMesh(look, i + seed, opts.tint);
    const a = (i / count) * Math.PI * 2 + Rn() * 0.6;
    const r = R * (0.75 + Rn() * 0.55);
    const s = (opts.scale ?? 0.55) * (0.75 + Rn() * 0.5);
    c.position.set(Math.cos(a) * r, (opts.y ?? 0.75) + Rn() * 0.35, Math.sin(a) * r);
    c.scale.set(s, s * 0.8, s);
    c.rotation.y = Rn() * 6;
    grp.add(c);
  }
  return {
    group: grp,
    update(t: number) { grp.rotation.y = t * 0.02 + seed; },
  };
}

// ---------- Wirbel (Riss, Portal) / swirl (rift, portal) ----------

export interface SwirlColours { core: string; inner: string; swirl: string; rim: string; rim2: string }

/**
 * Wirbelnder Riss als Shader auf einer Ebene: dunkler Kern, Spiralarme, gezackter leuchtender Rand.
 * Swirling tear as a shader on a plane: dark core, spiral arms, jagged glowing rim.
 */
export function swirlMaterial(clock: Clock, c: SwirlColours, opts: { intensity?: number; tear?: number; seed?: number } = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: clock.uTime, uIntensity: { value: opts.intensity ?? 1 }, uTear: { value: opts.tear ?? 1 }, uSeed: { value: opts.seed ?? 0 },
      uCore: { value: col(c.core) }, uInner: { value: col(c.inner) }, uSwirl: { value: col(c.swirl) }, uRim: { value: col(c.rim) }, uRim2: { value: col(c.rim2) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uIntensity; uniform float uTear; uniform float uSeed;
      uniform vec3 uCore; uniform vec3 uInner; uniform vec3 uSwirl; uniform vec3 uRim; uniform vec3 uRim2;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        // Riss: oben und unten spitz / tear: pointed at top and bottom
        p.x *= mix(1.0, 1.0 + abs(p.y) * 1.4, uTear);
        float r = length(p);
        float a = atan(p.y, p.x);
        float t = uTime + uSeed;
        float edge = 0.8 + 0.07 * sin(a * 7.0 + t * 1.3) + 0.04 * sin(a * 13.0 - t * 2.1);
        if (r > edge + 0.12) discard;
        float arms = sin(a * 3.0 + log(r + 0.04) * 7.0 - t * 1.8);
        float band = smoothstep(0.2, 0.95, arms) * smoothstep(0.05, 0.5, r);
        vec3 c = mix(uCore, uInner, smoothstep(0.1, 0.75, r));
        c = mix(c, uSwirl, band * 0.85);
        float rim = smoothstep(edge - 0.1, edge - 0.02, r) * (1.0 - smoothstep(edge + 0.02, edge + 0.12, r));
        vec3 rc = mix(uRim, uRim2, 0.5 + 0.5 * sin(a * 4.0 + t));
        c = mix(c, rc * (1.0 + 1.6 * uIntensity), rim);
        float alpha = (1.0 - smoothstep(edge + 0.04, edge + 0.12, r)) * mix(0.55, 1.0, uIntensity);
        gl_FragColor = vec4(c * mix(0.55, 1.0, uIntensity), alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
}

// ---------- Bogen aus Punkten / arc of dots ----------

/** Punkte auf einem Bogen von a nach b (Kontrollpunkt angehoben) / dots on an arc from a to b (raised control point) */
export function dotArc(look: Look, a: THREE.Vector3, b: THREE.Vector3, opts: { lift?: number; step?: number; size?: number; material: THREE.Material }): THREE.InstancedMesh {
  const ctrl = a.clone().add(b).multiplyScalar(0.5);
  ctrl.y += opts.lift ?? 0.8;
  const curve = new THREE.QuadraticBezierCurve3(a, ctrl, b);
  const n = Math.max(2, Math.round(curve.getLength() / (opts.step ?? 0.16)));
  const g = new THREE.IcosahedronGeometry(opts.size ?? 0.03, 0);
  const mesh = new THREE.InstancedMesh(g, opts.material, n + 1);
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    mesh.setMatrixAt(i, place(p.x, p.y, p.z, 0, 1));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.raycast = () => {};
  mesh.userData.curve = curve;
  return mesh;
}

/** Weicher Lichthof hinter einer Welt (additiv) / soft halo behind a world (additive) */
export function halo(color: string, size: number, opacity: number): THREE.Sprite {
  const m = new THREE.SpriteMaterial({ map: softDot(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  s.raycast = () => {};
  return s;
}

// ---------- Rauch, Voegel / smoke, birds ----------

export interface Animated { group: THREE.Group; update(t: number): void }

/**
 * Rauchsaeulen: Comic-Bauschen steigen auf, wachsen und vergehen (eine Instanzgruppe fuer alle Quellen).
 * Smoke columns: comic puffs rise, grow and fade (one instance group for all sources).
 */
export function smoke(look: Look, sources: readonly { x: number; y: number; z: number; size?: number; dark?: boolean }[], perSource = 6): Animated {
  const group = new THREE.Group();
  const light = sources.filter((s) => !s.dark), dark = sources.filter((s) => s.dark);
  const sets = ([[light, semantic.chimneySmoke], [dark, semantic.smokeHeavy]] as const).filter(([l]) => l.length).map(([list, colour]) => {
    const g = look.instanced(puff(colour), list.flatMap(() => Array.from({ length: perSource }, () => new THREE.Matrix4())), 0.08);
    group.add(g);
    return { list, g };
  });
  const m = new THREE.Matrix4();
  const update = (t: number) => {
    for (const { list, g } of sets) {
      list.forEach((s, si) => {
        for (let k = 0; k < perSource; k++) {
          const f = (t * 0.22 + k / perSource + si * 0.37) % 1;
          const size = (s.size ?? 1) * (0.018 + f * 0.04) * (f > 0.85 ? (1 - f) / 0.15 : 1);
          m.compose(new THREE.Vector3(s.x + Math.sin(f * 4 + si) * 0.03 + f * 0.06, s.y + f * 0.32 * (s.size ?? 1), s.z), new THREE.Quaternion(), new THREE.Vector3(size, size, size));
          setInstance(g, si * perSource + k, m);
        }
      });
      commitInstances(g);
    }
  };
  update(0);
  return { group, update };
}

/** Vogelschwarm, der ueber der Scheibe kreist / flock of birds circling above the disc */
export function flock(look: Look, count: number, radius: number, y: number, seed: number): Animated {
  const R = rand(seed);
  const birds = Array.from({ length: count }, () => ({ a: R() * 0.9, r: radius * (0.8 + R() * 0.4), y: y + R() * 0.2, ph: R() * 6 }));
  const group = look.instanced(bird(), birds.map(() => new THREE.Matrix4()), 0);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const update = (t: number) => {
    birds.forEach((b, i) => {
      const a = b.a + t * 0.25;
      const flap = 1 + Math.sin(t * 9 + b.ph) * 0.3;
      e.set(0, -a, Math.sin(t * 2 + b.ph) * 0.2);
      m.compose(new THREE.Vector3(Math.cos(a) * b.r, b.y + Math.sin(t + b.ph) * 0.04, Math.sin(a) * b.r), q.setFromEuler(e), new THREE.Vector3(1, flap, 1));
      setInstance(group, i, m);
    });
    commitInstances(group);
  };
  update(0);
  return { group: Object.assign(new THREE.Group(), {}).add(group), update };
}
