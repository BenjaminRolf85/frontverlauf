/**
 * Heimatwelt der Zyrr als Diorama: wogender Xeno-Boden mit leuchtenden Adern, Waelder aus riesigen Knollen- und
 * Spiralpflanzen mit Leuchtkapseln und Sporen, Kristallturm-Gruppen, das Nest der Schwarmmutter, das Portal mit
 * wirbelnder Flaeche, violette Seen, kreisende Schwebefelsen mit Bewuchs, Fremdtiere und eine Unterseite mit Ranken
 * und Kristallen.
 * Zyrr homeworld as a diorama: undulating xeno ground with glowing veins, forests of giant bulbous and spiral plants
 * with glowing pods and spores, crystal spire clusters, the Swarm Mother's nest, the portal with a swirling surface,
 * violet lakes, orbiting floating rocks with growth, alien critters and an underside with tendrils and crystals.
 */
import * as THREE from 'three';
import { semantic } from '../../design/tokens';
import { alienGrazer, alienJelly, alienPlant, crystalSpire } from '../models/alienFlora';
import { xenoHive } from '../models/xeno';
import { unitGeometry } from '../models';
import { Builder, geo } from '../models/kit';
import { buildDisc, distToPath } from './disc';
import { cloudRing, halo, swirlMaterial } from './fx';
import { commitInstances, place, rand, setInstance, softDot, wave } from './kit';
import type { Zone } from './layout';
import { bulbPlant, floatingIsle, spiralFrond } from './props';
import { freeOf, jitterGrid, markerSpots, type WorldBuild, type WorldCtx } from './types';

export function buildAlien(ctx: WorldCtx): WorldBuild {
  const { look, low, R, clock } = ctx;
  const seed = 23;
  const Rn = rand(seed);
  const portalAt = { x: -1.0, z: -0.3 };
  const hiveAt = { x: 0.62, z: -0.72 };
  const lakes = [{ x: 0.2, z: 0.82, r: 0.22 }, { x: -0.55, z: 0.62, r: 0.17 }];
  const clusters = [{ x: -0.35, z: -0.85 }, { x: 1.05, z: 0.35 }, { x: -1.05, z: 0.3 }, { x: 0.05, z: -0.3 }];
  const zones: Zone[] = [
    { ...portalAt, r: 0.22 }, { ...hiveAt, r: 0.4 }, ...lakes.map((l) => ({ ...l, r: l.r + 0.06 })), ...clusters.map((p) => ({ ...p, r: 0.16 })),
  ];
  const path = markerSpots(ctx, { hive: { x: hiveAt.x + 0.05, z: hiveAt.z + 0.42 } }, zones, 1.4);
  const lakeD = (x: number, z: number) => Math.min(...lakes.map((l) => Math.hypot(x - l.x, z - l.z) - l.r));
  const height = (x: number, z: number) => {
    let h = wave(x * 1.5, z * 1.5, seed) * 0.16 + wave(x * 3.4, z * 3.4, seed + 4) * 0.04;
    h *= 0.35 + 0.65 * Math.min(1, Math.max(0, (distToPath(x, z, path) - 0.08) / 0.2));
    const dl = lakeD(x, z);
    if (dl < 0.08) h = dl < 0 ? -0.05 : h * (dl / 0.08);
    h *= 1 - 0.8 * Math.max(0, 1 - Math.hypot(x - hiveAt.x, z - hiveAt.z) / 0.4);
    return h;
  };
  const disc = buildDisc({
    radius: R, seed, low, height, depth: 1.25, roots: 26,
    top: (x, z, h, r, steep) => {
      if (lakeD(x, z) < 0.03) return semantic.alienWaterShore;
      const n = wave(x * 2.8, z * 2.8, seed + 4);
      if (steep > 0.45) return semantic.alienRock;
      if (h > 0.13) return semantic.alienMoss;
      if (r > 0.95) return semantic.alienGroundDark;
      return n > 0.64 ? semantic.alienGroundDark : n < 0.3 ? semantic.xenoGround : semantic.alienGround;
    },
    soil: semantic.alienRock, strata: [semantic.alienRockDark, semantic.alienRock, semantic.xenoGroundDark, semantic.alienRockDark, semantic.alienCrystalDark, semantic.alienRock],
    rock: semantic.alienRock, root: semantic.alienMoss,
    under: (b, surf, r) => {
      // haengende Kristalle / hanging crystals
      for (let i = 0; i < (low ? 5 : 12); i++) {
        const p = surf(r() * Math.PI * 2, 0.3 + r() * 0.6);
        const h = 0.12 + r() * 0.22;
        b.add(geo.cone(0.035 + r() * 0.03, h, 5), i % 2 ? semantic.alienCrystal : semantic.alienCrystalDark, { p: [p.x * 0.97, p.y - h / 2, p.z * 0.97], r: [Math.PI + (r() - 0.5) * 0.4, r(), (r() - 0.5) * 0.4] });
      }
    },
  }, look);
  const H = disc.heightAt;
  const spin = new THREE.Group();
  spin.add(disc.group);
  const content = new THREE.Group();
  spin.add(content);
  const anim: ((t: number) => void)[] = [];
  const fixed = new THREE.Group();
  const glow = halo(semantic.alienSkyMid, R * 4.6, 0.3);
  glow.position.set(0, -0.3, -0.8);
  glow.renderOrder = -1;
  fixed.add(glow);
  const free = freeOf(zones, path, 0.12);

  // --- Seen / lakes ---
  for (const l of lakes) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(l.r + 0.01, 18), look.glow(semantic.alienWaterShallow, 1.0));
    m.rotation.x = -Math.PI / 2;
    m.position.set(l.x, -0.02, l.z);
    m.raycast = () => {};
    content.add(m);
    const deep = new THREE.Mesh(new THREE.CircleGeometry(l.r * 0.62, 14), look.flat(semantic.alienWaterOcean));
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(l.x, -0.016, l.z);
    deep.raycast = () => {};
    content.add(deep);
  }

  // --- leuchtende Adern / glowing veins ---
  const vb = new Builder();
  for (let i = 0; i < (low ? 6 : 14); i++) {
    let x = (Rn() - 0.5) * 2.2, z = (Rn() - 0.5) * 2.2;
    let a = Rn() * Math.PI * 2;
    for (let k = 0; k < 9; k++) {
      const nx = x + Math.cos(a) * 0.09, nz = z + Math.sin(a) * 0.09;
      if (Math.hypot(nx, nz) > R * 0.9 || lakeD(nx, nz) < 0.02) break;
      vb.tube([x, H(x, z) + 0.004, z], [nx, H(nx, nz) + 0.004, nz], 0.006 * (1 - k / 12), 3, semantic.white);
      x = nx; z = nz; a += (Rn() - 0.5) * 1.1;
    }
  }
  const veins = new THREE.Mesh(vb.build(), look.glow(semantic.xenoAcid, 1.25));
  veins.raycast = () => {};
  content.add(veins);

  // --- Portal ---
  const portal = look.inked(unitGeometry('portal', 'zyrr', null, 2).clone(), low ? 0 : 0.02);
  portal.position.set(portalAt.x, H(portalAt.x, portalAt.z), portalAt.z);
  portal.scale.setScalar(0.45);
  portal.rotation.y = 0.7;
  const swirl = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.18), swirlMaterial(clock, {
    core: semantic.riftCore, inner: semantic.riftInner, swirl: semantic.xenoGlow, rim: semantic.xenoAcid, rim2: semantic.alienCrystal,
  }, { tear: 0, intensity: 0.85, seed: 3 }));
  swirl.position.set(0, 0.88, 0);
  swirl.raycast = () => {};
  portal.add(swirl);
  content.add(portal);

  // --- Nest der Schwarmmutter / Swarm Mother's nest ---
  const hb = new Builder();
  hb.group({ p: [hiveAt.x, H(hiveAt.x, hiveAt.z) - 0.01, hiveAt.z], s: 1.45 }, () => xenoHive(hb, 'zyrr'));
  // Brutkapseln ringsum / brood pods around
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3, r = 0.45 + (i % 2) * 0.05;
    const x = hiveAt.x + Math.cos(a) * r * 0.8, z = hiveAt.z + Math.sin(a) * r * 0.7;
    if (Math.hypot(x, z) > R * 0.92) continue;
    hb.add(geo.sphere(0.035 + (i % 3) * 0.01, 7, 5), semantic.xenoGround, { p: [x, H(x, z) + 0.02, z], s: [1, 1.3, 1] });
  }
  content.add(look.inked(hb.build(), 0.007));
  const nestGlow = halo(semantic.xenoAcid, 0.7, 0.35);
  nestGlow.position.set(hiveAt.x, H(hiveAt.x, hiveAt.z) + 0.4, hiveAt.z);
  content.add(nestGlow);

  // --- Kristallgruppen / crystal clusters ---
  const sm: THREE.Matrix4[][] = [[], [], []];
  clusters.forEach((cp, ci) => {
    for (let k = 0; k < (low ? 2 : 5); k++) {
      const x = cp.x + (Rn() - 0.5) * 0.22, z = cp.z + (Rn() - 0.5) * 0.22;
      if (Math.hypot(x, z) > R * 0.9 || distToPath(x, z, path) < 0.1) continue;
      sm[(ci + k) % 3].push(place(x, H(x, z) - 0.02, z, Rn() * 6, 0.25 + Rn() * 0.35));
    }
  });
  sm.forEach((list, v) => content.add(look.instanced(crystalSpire(v).build(), list, 0.025)));

  // --- Riesenpflanzen-Waelder / giant plant forests ---
  const big: THREE.Matrix4[][] = [[], [], [], []];
  const bulbs: THREE.Matrix4[][] = [[], [], []];
  const fronds: THREE.Matrix4[] = [];
  const pods: THREE.Matrix4[] = [];
  let giants = 0;
  for (const p of jitterGrid(R, low ? 0.13 : 0.092, 5, 0.9)) {
    const n = wave(p.x * 2.3, p.y * 2.3, seed + 17);
    if (n < 0.46 || !free(p.x, p.y, 0.02) || lakeD(p.x, p.y) < 0.04) continue;
    const h = H(p.x, p.y);
    if (n > 0.62 && giants < (low ? 4 : 7) && Rn() > 0.55) {
      big[giants % 4].push(place(p.x, h - 0.01, p.y, Rn() * 6, 0.45 + Rn() * 0.25));
      giants++;
    } else if (Rn() > 0.35 && bulbs.reduce((a, l) => a + l.length, 0) < (low ? 40 : 110)) {
      const v = Math.floor(Rn() * 3);
      const s = 0.8 + Rn() * 0.6;
      bulbs[v].push(place(p.x, h - 0.005, p.y, Rn() * 6, s));
      if (Rn() > 0.4) pods.push(place(p.x + 0.02 * s, h + (0.16 + v * 0.04) * s, p.y + 0.022 * s, 0, s));
    } else if (fronds.length < (low ? 20 : 60)) fronds.push(place(p.x, h - 0.005, p.y, Rn() * 6, 0.8 + Rn() * 0.5));
  }
  big.forEach((list, v) => content.add(look.instanced(alienPlant(v).build(), list, 0.02)));
  bulbs.forEach((list, v) => content.add(look.instanced(bulbPlant(v), list, 0.004)));
  content.add(look.instanced(spiralFrond(), fronds, 0.004));
  content.add(look.instanced(new THREE.IcosahedronGeometry(0.012, 0), pods, 0, look.glow(semantic.alienCrystal, 1.7)));

  // --- Sporen / spores ---
  const nSpores = low ? 60 : 180;
  const sporePos = new Float32Array(nSpores * 3);
  const sporeBase = Array.from({ length: nSpores }, () => ({ x: (Rn() - 0.5) * 2.4, z: (Rn() - 0.5) * 2.4, ph: Rn() }));
  const spores = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sporePos, 3)),
    new THREE.PointsMaterial({ size: 0.035, map: softDot(semantic.xenoAcid), transparent: true, depthWrite: false, color: new THREE.Color(semantic.xenoAcid).multiplyScalar(1.6) }));
  spores.frustumCulled = false;
  spores.raycast = () => {};
  content.add(spores);
  const sporeUpdate = (t: number) => {
    sporeBase.forEach((s, i) => {
      const f = (t * 0.05 + s.ph) % 1;
      sporePos[i * 3] = s.x + Math.sin(t * 0.6 + i) * 0.04;
      sporePos[i * 3 + 1] = Math.max(0, H(s.x, s.z)) + f * 0.9;
      sporePos[i * 3 + 2] = s.z + Math.cos(t * 0.5 + i) * 0.04;
    });
    spores.geometry.getAttribute('position').needsUpdate = true;
  };
  sporeUpdate(0);
  anim.push(sporeUpdate);

  // --- Fremdtiere / critters ---
  const critterSpots = jitterGrid(R, 0.2, 9, 0.82).filter((p) => free(p.x, p.y, 0.04) && lakeD(p.x, p.y) > 0.05).slice(0, low ? 3 : 8);
  const grazers = look.instanced(alienGrazer().build(), critterSpots.map(() => new THREE.Matrix4()), 0);
  content.add(grazers);
  const jellies = look.instanced(alienJelly().build(), lakes.concat(lakes).map(() => new THREE.Matrix4()), 0);
  content.add(jellies);
  const m4 = new THREE.Matrix4();
  const critterUpdate = (t: number) => {
    critterSpots.forEach((p, i) => {
      const hop = Math.abs(Math.sin(t * 2.4 + i * 1.3)) * 0.025;
      m4.copy(place(p.x + Math.sin(t * 0.3 + i) * 0.03, H(p.x, p.y) + hop, p.y, t * 0.3 + i, 0.32));
      setInstance(grazers, i, m4);
    });
    commitInstances(grazers);
    lakes.concat(lakes).forEach((l, i) => {
      const a = t * 0.3 + i * 2.1;
      m4.copy(place(l.x + Math.cos(a) * l.r * 0.5, 0.12 + Math.sin(t + i) * 0.04, l.z + Math.sin(a) * l.r * 0.5, a, 0.3));
      setInstance(jellies, i, m4);
    });
    commitInstances(jellies);
  };
  critterUpdate(0);
  anim.push(critterUpdate);

  // --- kreisende Schwebefelsen mit Bewuchs / orbiting floating rocks with growth ---
  const orbit = new THREE.Group();
  const nIsles = low ? 6 : 16;
  const isles = Array.from({ length: nIsles }, (_, i) => {
    const a = (i / nIsles) * Math.PI * 2 + Rn() * 0.3;
    const r = R * (1.2 + Rn() * 0.35);
    return { a, r, y: -0.5 + Rn() * 1.3, s: 0.8 + Rn() * 1.4, ph: Rn() * 6 };
  });
  const isleGroup = look.instanced(floatingIsle(), isles.map(() => new THREE.Matrix4()), 0.006);
  orbit.add(isleGroup);
  const isleUpdate = (t: number) => {
    isles.forEach((s, i) => {
      const a = s.a + t * 0.04;
      m4.copy(place(Math.cos(a) * s.r, s.y + Math.sin(t * 0.6 + s.ph) * 0.06, Math.sin(a) * s.r * 0.85, s.ph + t * 0.1, s.s));
      setInstance(isleGroup, i, m4);
    });
    commitInstances(isleGroup);
  };
  isleUpdate(0);
  anim.push(isleUpdate);
  fixed.add(orbit);

  const clouds = cloudRing(look, R * 1.5, low ? 1 : 3, seed, { y: 0.6, scale: 0.4, tint: { color: semantic.alienMoonShade, amount: 0.5 } });
  spin.add(clouds.group);
  anim.push((t) => clouds.update(-t));
  return { spin, fixed, disc, spots: path, update: (t) => anim.forEach((f) => f(t)) };
}
