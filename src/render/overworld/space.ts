/**
 * Tiefer Weltraum hinter den Scheiben: Farbverlauf, Sternfeld (zwei Groessen, warm und kalt), weiche Nebel und der Riss
 * zwischen Alienwelt und der Welt der Vergessenen.
 * Deep space behind the discs: gradient, star field (two sizes, warm and cool), soft nebulae and the rift between the
 * alien world and the world of the Forgotten.
 */
import * as THREE from 'three';
import { hex, semantic } from '../../design/tokens';
import { canvasTexture, rand, softDot, type Clock } from './kit';
import { swirlMaterial } from './fx';

/** Hintergrundverlauf (Bildschirmraum) / background gradient (screen space) */
export function spaceBackground(): THREE.CanvasTexture {
  return canvasTexture(4, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, semantic.overworldSpace);
    g.addColorStop(0.55, semantic.overworldSpaceHigh);
    g.addColorStop(1, semantic.overworldSpaceGlow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  });
}

/** Sternfeld auf einer Kugelschale / star field on a spherical shell */
export function starField(count: number, seed: number): THREE.Group {
  const R = rand(seed);
  const grp = new THREE.Group();
  const tex = softDot(semantic.white);
  const palette = [semantic.overworldStar, semantic.overworldStarWarm, semantic.overworldStarCool].map((c) => new THREE.Color(hex(c)));
  for (const [n, size] of [[count, 0.5], [Math.round(count / 7), 1.15]] as const) {
    const pos = new Float32Array(n * 3), colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // vor allem hinter den Welten (Kamera blickt nach -z) / mostly behind the worlds (camera looks towards -z)
      const u = R() * 2 - 1, a = R() * Math.PI * 2;
      const r = 45 + R() * 20;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * s * r, u * r * 0.7, -Math.abs(Math.sin(a) * s * r) - 8], i * 3);
      const c = palette[Math.floor(R() * palette.length)].clone().multiplyScalar(0.55 + R() * 0.65);
      colours.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    const m = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, toneMapped: false });
    const p = new THREE.Points(g, m);
    p.raycast = () => {};
    grp.add(p);
  }
  return grp;
}

/** Weiche Nebel weit hinten / soft nebulae far behind */
export function nebulae(seed: number, count: number): THREE.Group {
  const R = rand(seed);
  const grp = new THREE.Group();
  const colours = [semantic.overworldNebula, semantic.overworldNebulaCool, semantic.overworldNebulaWarm];
  for (let i = 0; i < count; i++) {
    const m = new THREE.SpriteMaterial({ map: softDot(colours[i % colours.length]), transparent: true, opacity: 0.32 + R() * 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    s.position.set((R() - 0.5) * 50, (R() - 0.3) * 18, -30 - R() * 10);
    const k = 18 + R() * 22;
    s.scale.set(k * (1.2 + R()), k, 1);
    s.raycast = () => {};
    grp.add(s);
  }
  return grp;
}

/**
 * Der Riss: wirbelnde Ebene, die sich zur Kamera dreht, mit weichem Lichthof. intensity: 0.4 schwach sichtbar, 1 offen.
 * The rift: swirling plane that turns to face the camera, with a soft halo. intensity: 0.4 faintly visible, 1 open.
 */
export function rift(clock: Clock, intensity: number): THREE.Group {
  const grp = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.1), swirlMaterial(clock, {
    core: semantic.riftCore, inner: semantic.riftInner, swirl: semantic.riftSwirl, rim: semantic.riftRim, rim2: semantic.riftGold,
  }, { intensity, tear: 1 }));
  plane.raycast = () => {};
  plane.renderOrder = 3;
  grp.add(plane);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(semantic.riftSwirl), transparent: true, opacity: 0.25 + intensity * 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(3.4, 3.8, 1);
  glow.raycast = () => {};
  grp.add(glow);
  grp.userData.plane = plane;
  return grp;
}
