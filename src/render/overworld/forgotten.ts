/**
 * Welt der Vergessenen als Diorama: rot-orange Wueste mit geriffelten Duenen, Tafelbergen und Kegelfelsen mit
 * Gesteinsbaendern, eine Schlucht mit dem Hoehleneingang in ihrer Stirnwand (tuerkis-goldenes Leuchten des Artefakts
 * tief darunter), Felsbogen, eine rissige Salzpfanne, ein Ruinenfeld der Verdan (zerbrochene Saeulengaenge, eine
 * eingestuerzte Kuppel, halb versunkene Statuen mit dem rot-weissen Fluegelwappen), riesige gebleichte Skelette,
 * Staubteufel und treibender Staub. Ein leuchtender Spalt zieht sich durch die Unterseite.
 * World of the Forgotten as a diorama: red-orange desert with rippled dunes, mesas and buttes with rock bands, a canyon
 * with the cave mouth in its end wall (teal and gold glow of the artifact deep below), rock arches, a cracked salt flat,
 * a field of Verdan ruins (broken colonnades, a collapsed dome, half-buried statues with the red and white winged
 * emblem), giant bleached skeletons, dust devils and drifting dust. A glowing crack runs through the underside.
 */
import * as THREE from 'three';
import { semantic } from '../../design/tokens';
import { Builder, geo } from '../models/kit';
import { giantSkull, verdanRuinGeometry } from '../models/cavern';
import { buildDisc, distToPath } from './disc';
import { halo } from './fx';
import { place, rand, softDot, wave } from './kit';
import type { Zone } from './layout';
import { column, ribcage, statue } from './props';
import { freeOf, jitterGrid, markerSpots, type WorldBuild, type WorldCtx } from './types';

const V2 = (x: number, z: number) => new THREE.Vector2(x, z);

/** Wappen der Verdan: rote Scheibe mit weissen Fluegeln, Blick +z / Verdan emblem: red disc with white wings, facing +z */
function verdanEmblem(b: Builder, s: number) {
  b.add(geo.cyl(0.05 * s, 0.05 * s, 0.016 * s, 12), semantic.verdanRed, { r: [Math.PI / 2, 0, 0] });
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      b.add(geo.box(0.075 * s - k * 0.012 * s, 0.016 * s, 0.012 * s), semantic.verdanWhite, {
        p: [side * (0.075 + k * 0.006) * s, (0.02 - k * 0.019) * s, 0.003 * s], r: [0, 0, side * (0.35 + k * 0.25)],
      });
    }
  }
  b.add(geo.cyl(0.02 * s, 0.02 * s, 0.02 * s, 8), semantic.verdanWhite, { p: [0, 0, 0.004 * s], r: [Math.PI / 2, 0, 0] });
}

export function buildForgotten(ctx: WorldCtx): WorldBuild {
  const { look, low, R } = ctx;
  const seed = 37;
  const Rn = rand(seed);
  // --- Wahrzeichen / landmarks ---
  const caveEnd = V2(0.5, 0.18);
  const canyon = new THREE.CatmullRomCurve3([V2(0.5, 0.18), V2(0.42, 0.55), V2(0.58, 0.95), V2(0.5, 1.6)].map((p) => new THREE.Vector3(p.x, 0, p.y))).getPoints(30).map((p) => V2(p.x, p.z));
  const mesas = [{ x: -0.72, z: -0.72, r: 0.22, h: 0.36 }, { x: 0.02, z: -1.1, r: 0.17, h: 0.44 }, { x: 0.98, z: -0.6, r: 0.2, h: 0.3 }, { x: -1.22, z: 0.12, r: 0.13, h: 0.5 }, { x: 1.2, z: 0.25, r: 0.11, h: 0.42 }, { x: -0.15, z: 1.15, r: 0.12, h: 0.26 }, { x: 1.05, z: 0.85, r: 0.09, h: 0.34 }];
  const salt = { x: -0.62, z: 0.62, r: 0.32 };
  const ruins = { x: -0.12, z: -0.42, r: 0.36 };
  const bones = [{ x: 0.66, z: -0.18 }, { x: -1.0, z: -0.3 }];
  const arches = [{ x: -0.42, z: 0.12 }, { x: 0.98, z: 0.72 }];
  const zones: Zone[] = [
    ...mesas.map((m) => ({ x: m.x, z: m.z, r: m.r + 0.06 })), { ...salt, r: salt.r * 0.6 }, { ...ruins }, ...bones.map((p) => ({ ...p, r: 0.2 })),
    ...arches.map((p) => ({ ...p, r: 0.13 })), { x: caveEnd.x, z: caveEnd.y - 0.12, r: 0.2 },
  ];
  const path = markerSpots(ctx, { cave: { x: caveEnd.x - 0.02, z: caveEnd.y + 0.2 } }, zones, 2.1);
  const canyonD = (x: number, z: number) => distToPath(x, z, canyon);
  const height = (x: number, z: number) => {
    const ripple = Math.sin(x * 9 + wave(x, z, seed) * 5) * 0.012;
    const dune = Math.max(0, Math.sin(x * 2.4 + z * 1.1 + wave(x * 0.8, z * 0.8, seed + 2) * 3)) * 0.07;
    let h = (dune + ripple + 0.012) * (0.4 + 0.6 * Math.min(1, Math.max(0, (distToPath(x, z, path) - 0.08) / 0.2)));
    // Hochebene um die Schlucht, Schlucht eingeschnitten / plateau around the canyon, canyon cut in
    const dc = canyonD(x, z);
    const plateau = Math.max(0, 1 - Math.max(0, dc - 0.12) / 0.25) * 0.15;
    h += plateau;
    if (dc < 0.1) h = -0.13 + (dc / 0.1) * (0.13 + h) * (dc / 0.1);
    if (Math.hypot(x - salt.x, z - salt.z) < salt.r) h = 0.004;
    return h;
  };
  const disc = buildDisc({
    radius: R, seed, low, height, depth: 1.25, roots: 0,
    top: (x, z, h, r, steep) => {
      if (Math.hypot(x - salt.x, z - salt.z) < salt.r - 0.02) return semantic.marsSalt;
      if (steep > 0.4 || canyonD(x, z) < 0.11) return Math.floor((h + 0.3) * 30) % 2 ? semantic.marsRock : semantic.marsRockDark;
      if (r > 0.95) return semantic.marsGround;
      if (h > 0.12) return semantic.marsGround;
      return Math.sin(x * 9 + wave(x, z, seed) * 5) > 0.55 ? semantic.marsSandLight : wave(x * 2, z * 2, seed + 5) > 0.7 ? semantic.marsGround : semantic.marsSand;
    },
    soil: semantic.marsGround, strata: [semantic.marsRock, semantic.marsRockDark, semantic.marsGround, semantic.marsDeep, semantic.marsRockDark, semantic.marsRock],
    rock: semantic.marsRockDark,
  }, look);
  const H = disc.heightAt;
  const spin = new THREE.Group();
  spin.add(disc.group);
  const content = new THREE.Group();
  spin.add(content);
  const anim: ((t: number) => void)[] = [];
  const free = freeOf(zones, path, 0.12);

  // --- Tafelberge und Kegelfelsen / mesas and buttes ---
  const mb = new Builder();
  mesas.forEach((m, i) => {
    const y0 = H(m.x, m.z) - 0.03;
    const bands = [semantic.marsRockDark, semantic.marsRock, semantic.marsGround, semantic.marsRock, semantic.marsSandLight];
    let y = y0;
    bands.forEach((c, k) => {
      const bh = k === 4 ? 0.025 : m.h / 4;
      const rr = m.r * (1 - k * 0.07);
      mb.add(geo.cyl(rr * (k === 4 ? 1.03 : 0.95), rr, bh, 9), c, { p: [m.x, y + bh / 2, m.z], r: [0, i + k * 0.4, 0] });
      y += bh;
    });
    for (let k = 0; k < (low ? 2 : 5); k++) {
      const a = Rn() * Math.PI * 2;
      mb.add(geo.dodeca(0.025 + Rn() * 0.03), semantic.marsRockDark, { p: [m.x + Math.cos(a) * m.r * 1.15, y0 + 0.04, m.z + Math.sin(a) * m.r * 1.15], r: [Rn(), Rn(), Rn()] });
    }
  });
  // Felsbogen / rock arches
  arches.forEach((a, i) => {
    const y0 = H(a.x, a.z) - 0.01;
    mb.group({ p: [a.x, y0, a.z], r: [0, i * 1.2 + 0.3, 0] }, () => {
      for (const s of [-1, 1]) mb.add(geo.taper(0.06, 0.05, 0.045, 0.04, 0.16, 0), semantic.marsRock, { p: [s * 0.09, 0.08, 0] });
      let prev: [number, number, number] = [-0.09, 0.15, 0];
      for (let k = 1; k <= 6; k++) {
        const t = (k / 6) * Math.PI;
        const p: [number, number, number] = [-Math.cos(t) * 0.09, 0.15 + Math.sin(t) * 0.07, 0];
        mb.tube(prev, p, 0.026, 6, k % 2 ? semantic.marsRock : semantic.marsRockDark);
        prev = p;
      }
    });
  });
  content.add(look.inked(mb.build(), 0.008));

  // --- Salzpfanne mit Rissen / salt flat with cracks ---
  const sb = new Builder();
  for (let i = 0; i < (low ? 14 : 30); i++) {
    const a = Rn() * Math.PI * 2, r = Math.sqrt(Rn()) * salt.r * 0.85;
    const x = salt.x + Math.cos(a) * r, z = salt.z + Math.sin(a) * r;
    sb.add(geo.box(0.06 + Rn() * 0.06, 0.003, 0.006), semantic.marsSaltCrack, { p: [x, 0.008, z], r: [0, Rn() * Math.PI, 0] });
  }
  content.add(look.inked(sb.build(), 0));

  // --- Ruinenfeld der Verdan / field of Verdan ruins ---
  const whole: THREE.Matrix4[] = [], broken: THREE.Matrix4[] = [];
  const rb = new Builder();
  // Saeulengaenge / colonnades
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 5; k++) {
      const x = ruins.x - 0.24 + k * 0.12, z = ruins.z - 0.12 + row * 0.13;
      ((k + row) % 3 === 1 ? broken : whole).push(place(x, H(x, z) - 0.01, z, 0, 1));
    }
    const y = H(ruins.x, ruins.z) + 0.225;
    rb.add(geo.box(0.28, 0.025, 0.05), semantic.verdanStone, { p: [ruins.x - 0.18, y, ruins.z - 0.12 + row * 0.13] });
  }
  // eingestuerzte Kuppel / collapsed dome
  const dome = V2(ruins.x + 0.24, ruins.z + 0.12);
  rb.group({ p: [dome.x, H(dome.x, dome.y) - 0.01, dome.y] }, () => {
    rb.add(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 1.3, 0, Math.PI / 2), semantic.verdanStone, { r: [0, 0.6, 0] });
    rb.add(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 1.3, 0, Math.PI / 2), semantic.verdanStoneDark, { r: [0, 0.6, 0], s: [-1, 1, 1] });
    rb.add(geo.cyl(0.14, 0.15, 0.03, 12), semantic.verdanStoneDark, { p: [0, 0.0, 0] });
    for (let k = 0; k < 6; k++) rb.add(geo.dodeca(0.02 + Rn() * 0.02), semantic.verdanStone, { p: [(Rn() - 0.3) * 0.25, 0.02, (Rn() - 0.3) * 0.25], r: [Rn(), Rn(), Rn()] });
  });
  // Denkmal mit grossem Fluegelwappen / monument with a large winged emblem
  const mon = V2(ruins.x - 0.05, ruins.z - 0.3);
  rb.group({ p: [mon.x, H(mon.x, mon.y) - 0.01, mon.y] }, () => {
    rb.add(geo.box(0.3, 0.04, 0.16), semantic.verdanStoneDark, { p: [0, 0.02, 0] });
    rb.add(geo.taper(0.14, 0.07, 0.1, 0.05, 0.4, 0), semantic.verdanStone, { p: [0, 0.24, 0] });
    rb.group({ p: [0, 0.33, 0.04] }, () => verdanEmblem(rb, 1.6));
  });
  content.add(look.inked(rb.build(), 0.006));
  content.add(look.instanced(column(false), whole, 0.004));
  content.add(look.instanced(column(true), broken, 0.004));
  // halb versunkene Statuen / half-buried statues
  const statueSpots = [V2(ruins.x - 0.3, ruins.z + 0.22), V2(ruins.x + 0.05, ruins.z + 0.3), V2(-1.05, 0.55)].filter((p) => distToPath(p.x, p.y, path) > 0.1);
  content.add(look.instanced(statue(), statueSpots.map((p, i) => place(p.x, H(p.x, p.y) - 0.02, p.y, (i - 1) * 0.5, 1.3)), 0.005));
  const rubble = jitterGrid(R, 0.25, 31, 0.8).filter((p) => free(p.x, p.y, 0.05)).slice(0, low ? 2 : 4);
  content.add(look.instanced(verdanRuinGeometry().clone(), rubble.map((p, i) => place(p.x, H(p.x, p.y) - 0.01, p.y, i * 2, 0.38)), 0.03));

  // --- Geroell, umgestuerzte Saeulen und kleine Felsnadeln im Vordergrund / scree, fallen columns and small spires in front ---
  const scree: THREE.Matrix4[] = [], fallen: THREE.Matrix4[] = [], spires: THREE.Matrix4[] = [];
  for (const p of jitterGrid(R, low ? 0.16 : 0.1, 41, 0.9)) {
    if (!free(p.x, p.y, 0.02) || canyonD(p.x, p.y) < 0.12 || Math.hypot(p.x - salt.x, p.y - salt.z) < salt.r) continue;
    const n = wave(p.x * 3, p.y * 3, seed + 8), r = Rn();
    if (n > 0.62 && r > 0.5) spires.push(place(p.x, H(p.x, p.y) - 0.02, p.y, r * 6, 0.6 + Rn() * 0.8));
    else if (n < 0.3 && r > 0.75) fallen.push(place(p.x, H(p.x, p.y) + 0.012, p.y, r * 6, 1));
    else if (r > 0.55) scree.push(place(p.x, H(p.x, p.y), p.y, r * 6, 0.6 + Rn() * 0.9));
  }
  const sp = new Builder();
  sp.add(geo.cone(0.035, 0.16, 6), semantic.marsRock, { p: [0, 0.08, 0] });
  sp.add(geo.cone(0.025, 0.08, 6), semantic.marsRockDark, { p: [0.03, 0.04, 0.01] });
  sp.add(geo.box(0.05, 0.012, 0.05), semantic.marsSandLight, { p: [0, 0.14, 0], r: [0.2, 0.4, 0] });
  content.add(look.instanced(sp.build(), spires, 0.004));
  const fb = new Builder();
  fb.add(geo.cyl(0.017, 0.017, 0.12, 7), semantic.verdanStone, { r: [0, 0, Math.PI / 2] });
  fb.add(geo.cyl(0.017, 0.017, 0.05, 7), semantic.verdanStoneDark, { p: [0.1, 0, 0.02], r: [0, 0.4, Math.PI / 2] });
  content.add(look.instanced(fb.build(), fallen, 0.003));
  const rk = new Builder();
  rk.add(geo.dodeca(0.022), semantic.marsRockDark, { s: [1, 0.7, 1] });
  rk.add(geo.dodeca(0.013), semantic.marsRock, { p: [0.025, -0.004, 0.01] });
  content.add(look.instanced(rk.build(), scree, 0.003));

  // --- gebleichte Skelette / bleached skeletons ---
  bones.forEach((p, i) => {
    const y = H(p.x, p.z) - 0.02;
    const rib = look.inked(ribcage(), 0.005);
    rib.position.set(p.x, y, p.z);
    rib.rotation.y = i ? 0.6 : -0.4;
    content.add(rib);
    const skull = look.inked(giantSkull(i).clone(), 0.02);
    skull.position.set(p.x + (i ? -0.3 : 0.3) * Math.cos(rib.rotation.y), y, p.z - (i ? -0.3 : 0.3) * Math.sin(rib.rotation.y));
    skull.scale.setScalar(0.35);
    skull.rotation.y = rib.rotation.y + (i ? Math.PI : 0);
    content.add(skull);
  });

  // --- Hoehleneingang in der Schluchtwand / cave mouth in the canyon wall ---
  const cb = new Builder();
  const floorY = H(caveEnd.x, caveEnd.y + 0.12);
  cb.group({ p: [caveEnd.x, floorY, caveEnd.y - 0.02] }, () => {
    const lumps: [number, number, number, number][] = [[-0.16, 0.08, -0.04, 0.12], [0.16, 0.08, -0.04, 0.12], [-0.11, 0.2, -0.06, 0.1], [0.11, 0.2, -0.06, 0.1], [0, 0.26, -0.08, 0.11], [0, 0.12, -0.18, 0.18], [-0.25, 0.14, -0.12, 0.12], [0.26, 0.14, -0.1, 0.11]];
    lumps.forEach(([x, y, z, s], i) => cb.add(geo.dodeca(s), i % 2 ? semantic.marsRockDark : semantic.marsRock, { p: [x, y, z], r: [i * 0.7, i * 1.3, i * 0.4], s: [1, 0.9, 1] }));
    // Stuetzbalken der Verdan am Eingang / Verdan support beams at the entrance
    for (const s of [-1, 1]) cb.add(geo.box(0.022, 0.2, 0.022), semantic.verdanStoneDark, { p: [s * 0.1, 0.1, 0.03] });
    cb.add(geo.box(0.24, 0.025, 0.03), semantic.verdanStoneDark, { p: [0, 0.205, 0.03] });
    cb.group({ p: [0, 0.25, 0.05] }, () => verdanEmblem(cb, 0.55));
  });
  content.add(look.inked(cb.build(), 0.008));
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14, 0, Math.PI), look.flat(semantic.riftCore));
  mouth.position.set(caveEnd.x, floorY, caveEnd.y + 0.02);
  mouth.scale.set(1, 1.7, 1);
  mouth.raycast = () => {};
  content.add(mouth);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12, 0, Math.PI), look.glow(semantic.artifactGlow, 1.7, { additive: true, opacity: 0.6 }));
  inner.position.set(caveEnd.x, floorY, caveEnd.y + 0.025);
  inner.scale.set(1, 1.5, 1);
  inner.raycast = () => {};
  content.add(inner);
  const caveGlow = halo(semantic.artifactGlow, 0.8, 0.45);
  caveGlow.position.set(caveEnd.x, floorY + 0.08, caveEnd.y + 0.08);
  const goldGlow = halo(semantic.artifactGold, 0.45, 0.4);
  goldGlow.position.set(caveEnd.x, floorY + 0.03, caveEnd.y + 0.1);
  content.add(caveGlow, goldGlow);
  anim.push((t) => {
    const k = 0.8 + Math.sin(t * 1.3) * 0.2;
    (caveGlow.material as THREE.SpriteMaterial).opacity = 0.45 * k;
    (goldGlow.material as THREE.SpriteMaterial).opacity = 0.4 * (1.6 - k);
  });

  // --- leuchtender Spalt in der Unterseite / glowing crack in the underside ---
  const kb = new Builder();
  const ang = Math.atan2(1.0, 0.5);
  let prev: [number, number, number] | null = null;
  for (let k = 0; k <= 7; k++) {
    const f = k / 7;
    const y = -0.16 - f * 1.0;
    const r = R * (1 - 0.82 * Math.pow(f, 1.2)) + 0.015;
    const a = ang + Math.sin(k * 2.1) * 0.08;
    const p: [number, number, number] = [Math.cos(a) * r, y, Math.sin(a) * r];
    if (prev) kb.tube(prev, p, 0.016 * (1 - f * 0.5), 4, semantic.white);
    prev = p;
  }
  const crack = new THREE.Mesh(kb.build(), look.glow(semantic.artifactGlow, 1.8));
  crack.raycast = () => {};
  content.add(crack);

  // --- Staubteufel / dust devils ---
  const devils: THREE.Group[] = [];
  const devilMat = look.flat(semantic.marsDust, { transparent: true, opacity: 0.5 });
  for (let i = 0; i < (low ? 1 : 3); i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025 + k * 0.016, 0.008 + k * 0.002, 4, 10), devilMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02 + k * 0.05;
      ring.raycast = () => {};
      g.add(ring);
    }
    g.userData.base = jitterGrid(R, 0.4, 50 + i, 0.75).filter((p) => free(p.x, p.y))[i] ?? V2(0, 0);
    devils.push(g);
    content.add(g);
  }
  anim.push((t) => devils.forEach((g, i) => {
    const b = g.userData.base as THREE.Vector2;
    const x = b.x + Math.sin(t * 0.3 + i * 2) * 0.12, z = b.y + Math.cos(t * 0.23 + i) * 0.1;
    g.position.set(x, H(x, z), z);
    g.children.forEach((r, k) => { r.rotation.z = t * (3 + k); r.position.x = Math.sin(t * 2 + k) * 0.01 * k; });
  }));
  anim[anim.length - 1](0);

  // --- Staubdunst (dreht nicht mit) / dust haze (does not turn) ---
  const fixed = new THREE.Group();
  const dustTex = softDot(semantic.marsDust);
  const dust: THREE.Sprite[] = [];
  const nDust = low ? 6 : 14;
  for (let i = 0; i < nDust; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, opacity: 0.14 + Rn() * 0.1, depthWrite: false }));
    const a = (i / nDust) * Math.PI * 2;
    s.position.set(Math.cos(a) * R * 1.02, 0.05 + Rn() * 0.3, Math.sin(a) * R * 1.02);
    s.scale.set(1.1 + Rn() * 0.8, 0.45 + Rn() * 0.3, 1);
    s.raycast = () => {};
    s.userData.a = a;
    dust.push(s);
    fixed.add(s);
  }
  const back = halo(semantic.marsGround, R * 3.8, 0.16);
  back.position.set(0, -0.2, -0.8);
  back.renderOrder = -1;
  fixed.add(back);
  anim.push((t) => dust.forEach((s, i) => {
    const a = s.userData.a + t * 0.04;
    s.position.x = Math.cos(a) * R * (1.02 + Math.sin(t * 0.3 + i) * 0.05);
    s.position.z = Math.sin(a) * R * 1.02;
  }));
  return { spin, fixed, disc, spots: path, update: (t) => anim.forEach((f) => f(t)) };
}
