/**
 * Erdscheibe als Diorama: Huegelland mit einer Bergkette (Felswaende, Schneekappen), ein gewundener Fluss in einen See
 * mit Strand, dichte Mischwaelder, Felderflicken, kleine Staedte mit Strassen dazwischen, Bunker und Schuetzengraeben,
 * die Absturzstelle aus dem Sternfall mit Rauch, ein Industriegebiet (NEXUS) und ein Glockenturm (Akt II), mehrere
 * Wasserfaelle ueber den Rand in die Gischt, Wolken und Voegel.
 * Earth disc as a diorama: rolling hills with a mountain range (rock faces, snow caps), a winding river into a lake with
 * a beach, dense mixed forests, patches of fields, small towns with roads in between, bunkers and trenches, the
 * Starfall crash site with smoke, an industrial area (NEXUS) and a bell tower (act II), several waterfalls over the rim
 * into mist, clouds and birds.
 */
import * as THREE from 'three';
import { primitives, semantic } from '../../design/tokens';
import type { FactionId } from '../../data/balance';
import { city } from '../models/city';
import { feature } from '../models/buildings';
import { crashSite } from '../models/terrain';
import { dataCenter, powerPlant } from '../models/specials';
import { Builder, geo } from '../models/kit';
import { buildDisc, distToPath } from './disc';
import { cloudRing, flock, mist, smoke, waterfall } from './fx';
import { place, rand, wave } from './kit';
import type { P2, Zone } from './layout';
import { bellTower, conifer, field, house, leafy, sandbags, smokestack } from './props';
import { freeOf, jitterGrid, markerSpots, type WorldBuild, type WorldCtx } from './types';

const c = primitives.color;
const TOWN_FACTIONS: FactionId[] = ['korvat', 'alvenia', 'meridon', 'dravon', 'velkar'];
const V2 = (x: number, z: number) => new THREE.Vector2(x, z);
const curve = (pts: THREE.Vector2[], n = 40) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.y))).getPoints(n).map((p) => V2(p.x, p.z));

export function buildEarth(ctx: WorldCtx): WorldBuild {
  const { look, low, R, clock } = ctx;
  const seed = 11;
  const Rn = rand(seed);
  // --- Wahrzeichen / landmarks ---
  const lake = { x: 0.62, z: 0.5, r: 0.3 };
  const peaks: { x: number; z: number; h: number; w: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const a = THREE.MathUtils.degToRad(206 + i * 11 + (Rn() - 0.5) * 6);
    const r = 0.98 + Math.sin(i * 1.7) * 0.12;
    peaks.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: 0.24 + Rn() * 0.2 + (i === 4 ? 0.12 : 0), w: 0.13 + Rn() * 0.05 });
  }
  const towns: P2[] = [{ x: -0.78, z: 0.42 }, { x: 0.02, z: 0.86 }, { x: 0.9, z: -0.42 }, { x: -0.2, z: -0.05 }];
  const industry = { x: 0.62, z: -0.98 };
  const bell = { x: -1.12, z: -0.12 };
  const crash = { x: 0.38, z: -0.12 };
  const portalSide = { x: 1.3, z: 0.05 };
  const zones: Zone[] = [
    { ...lake, r: lake.r + 0.08 }, { ...industry, r: 0.3 }, { ...bell, r: 0.14 }, { ...crash, r: 0.2 },
    ...towns.map((t) => ({ ...t, r: 0.16 })), ...peaks.map((p) => ({ x: p.x, z: p.z, r: p.w * 1.2 })),
  ];
  const path = markerSpots(ctx, { portalSide }, zones, 0.6);
  // --- Fluesse / rivers ---
  const rivers = [
    curve([V2(-0.05, -0.82), V2(0.1, -0.5), V2(-0.05, -0.28), V2(0.2, 0.05), V2(0.42, 0.28), V2(lake.x - 0.12, lake.z - 0.1)]),
    curve([V2(lake.x + 0.2, lake.z + 0.15), V2(0.98, 0.78), V2(1.2, 1.02)], 16),
    curve([V2(lake.x - 0.1, lake.z + 0.22), V2(0.5, 1.0), V2(0.42, 1.55)], 16),
    curve([V2(-0.62, -0.78), V2(-0.9, -0.55), V2(-1.2, -0.48), V2(-1.58, -0.3)], 20),
  ];
  const nearRiver = (x: number, z: number) => Math.min(...rivers.map((r) => distToPath(x, z, r)));
  const lakeD = (x: number, z: number) => Math.hypot(x - lake.x, (z - lake.z) * 1.15) - lake.r;
  const height = (x: number, z: number) => {
    let h = wave(x * 1.3, z * 1.3, seed) * 0.1 + wave(x * 3.1, z * 3.1, seed + 9) * 0.03;
    for (const p of peaks) h += Math.exp(-((x - p.x) ** 2 + (z - p.z) ** 2) / (p.w * p.w)) * p.h;
    const dPath = distToPath(x, z, path);
    const flat = Math.min(1, Math.max(0, (dPath - 0.08) / 0.2));
    h *= 0.35 + 0.65 * flat;
    const dr = nearRiver(x, z);
    if (dr < 0.12) h = h * Math.max(0, (dr - 0.03) / 0.09) - 0.02 * Math.max(0, 1 - dr / 0.05);
    const dl = lakeD(x, z);
    if (dl < 0.1) h = dl < 0 ? -0.06 : h * (dl / 0.1);
    return h;
  };
  const disc = buildDisc({
    radius: R, seed, low, height, depth: 1.3, roots: 22,
    top: (x, z, h, r, steep) => {
      const dl = lakeD(x, z);
      if (dl < 0.04) return semantic.beach;
      if (nearRiver(x, z) < 0.05) return semantic.beach;
      if (h > 0.34) return semantic.biomeTundra;
      if (steep > 0.55) return semantic.terrainMountainDark;
      if (h > 0.2 || steep > 0.42) return semantic.terrainMountain;
      if (r > 0.95) return semantic.biomeSteppe;
      const n = wave(x * 2.6, z * 2.6, seed + 3);
      return n > 0.66 ? semantic.terrainForest : n < 0.3 ? semantic.biomeHills : semantic.terrainPlain;
    },
    soil: semantic.overworldSoil, strata: [semantic.overworldSoilDark, semantic.overworldStrata, semantic.overworldStrataMid, semantic.overworldStrata, semantic.overworldStrataDark, semantic.overworldStrataMid],
    root: semantic.overworldRoot, rock: semantic.overworldStrataMid,
  }, look);
  const spin = new THREE.Group();
  spin.add(disc.group);
  const content = new THREE.Group();
  spin.add(content);
  const anim: ((t: number) => void)[] = [];
  const H = disc.heightAt;

  // --- Wasser: See, Fluesse, Wasserfaelle / water: lake, rivers, waterfalls ---
  const water = look.flat(semantic.terrainOcean);
  const lakeGeo = new THREE.CircleGeometry(lake.r + 0.01, 20);
  const lp = lakeGeo.getAttribute('position');
  for (let i = 1; i < lp.count; i++) { const k = 1 + Math.sin(i * 1.7) * 0.06; lp.setXY(i, lp.getX(i) * k, (lp.getY(i) * k) / 1.15); }
  const lakeMesh = new THREE.Mesh(lakeGeo, water);
  lakeMesh.rotation.x = -Math.PI / 2;
  lakeMesh.position.set(lake.x, -0.012, lake.z);
  lakeMesh.raycast = () => {};
  content.add(lakeMesh);
  const shallow = new THREE.Mesh(new THREE.RingGeometry(lake.r * 0.82, lake.r + 0.01, 20), look.flat(semantic.terrainShallow));
  shallow.rotation.x = -Math.PI / 2;
  shallow.scale.set(1, 1 / 1.15, 1);
  shallow.position.set(lake.x, -0.008, lake.z);
  shallow.raycast = () => {};
  content.add(shallow);
  const ribbon = (pts: THREE.Vector2[], w: number) => {
    const pos: number[] = [], idx: number[] = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const d = V2(q.x - o.x, q.y - o.y).normalize();
      const ww = w * (0.6 + (i / pts.length) * 0.7);
      for (const s of [-1, 1]) { const x = p.x - d.y * ww * s, z = p.y + d.x * ww * s; pos.push(x, Math.max(H(x, z), -0.03) + 0.01, z); }
      if (i < pts.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  rivers.forEach((pts, i) => {
    const m = new THREE.Mesh(ribbon(pts, i === 0 ? 0.04 : 0.032), water);
    m.raycast = () => {};
    content.add(m);
  });
  // Wasserfaelle: drei Flussenden plus eine Quelle aus den Bergen / waterfalls: three river ends plus a spring from the mountains
  const falls = [rivers[1][rivers[1].length - 1], rivers[2][rivers[2].length - 1], rivers[3][rivers[3].length - 1], V2(Math.cos(5.6) * R, Math.sin(5.6) * R)];
  falls.forEach((end, i) => {
    const e = end.clone().setLength(R * 0.995);
    const len = 1.35 + (i % 2) * 0.25;
    content.add(waterfall(clock, e.x, e.y, { length: len, width: i === 3 ? 0.045 : 0.07, seed: i * 1.7 }));
    const out = e.clone().normalize();
    const foot = mist(look, e.x + out.x * 0.3, -len + 0.05, e.y + out.y * 0.3, 40 + i, low ? 3 : 7);
    content.add(foot);
    anim.push((t) => foot.scale.setScalar(1 + Math.sin(t * 2.2 + i) * 0.06));
  });

  const free = freeOf(zones, path, 0.13);
  // --- Felsgipfel mit Schneekappen auf der Kette / rock peaks with snow caps on the range ---
  const pb = new Builder();
  peaks.forEach((p, i) => {
    const top = H(p.x, p.z);
    const h = 0.12 + p.h * 0.45;
    const r = p.w * 0.85;
    pb.add(geo.cone(r, h, 6), i % 2 ? semantic.terrainMountain : semantic.terrainMountainDark, { p: [p.x, top + h / 2 - 0.03, p.z], r: [0, i, 0] });
    pb.add(geo.cone(r * 0.42, h * 0.42, 6), semantic.biomeTundra, { p: [p.x, top + h - 0.03 - h * 0.21 + 0.005, p.z], r: [0, i, 0] });
    if (!low) pb.add(geo.cone(r * 0.6, h * 0.65, 5), semantic.terrainMountain, { p: [p.x + r * 0.7, top + h * 0.3 - 0.03, p.z + 0.04], r: [0, i * 2, 0.1] });
  });
  content.add(look.inked(pb.build(), 0.006));

  // --- Staedte, Haeuser, Strassen / towns, houses, roads ---
  const flags = { hq: false, factory: false, bunkerRing: false, govQuarter: false };
  towns.forEach((p, i) => {
    const town = look.inked(city(TOWN_FACTIONS[i % TOWN_FACTIONS.length], 2 + (i % 2), flags).build(), 0.03);
    town.position.set(p.x, H(p.x, p.z) - 0.005, p.z);
    town.scale.setScalar(0.32);
    town.rotation.y = i * 1.3;
    content.add(town);
  });
  const roofs = [semantic.stamp, c.korvatRed, c.alveniaBlue];
  const houseMats: THREE.Matrix4[][] = roofs.map(() => []);
  towns.forEach((tp, ti) => {
    for (let k = 0; k < (low ? 4 : 9); k++) {
      const a = Rn() * Math.PI * 2, r = 0.15 + Rn() * 0.12;
      const x = tp.x + Math.cos(a) * r, z = tp.z + Math.sin(a) * r;
      if (distToPath(x, z, path) < 0.1 || nearRiver(x, z) < 0.06 || lakeD(x, z) < 0.05 || Math.hypot(x, z) > R * 0.9) continue;
      houseMats[(ti + k) % roofs.length].push(place(x, H(x, z), z, Rn() * 6, 0.8 + Rn() * 0.4));
    }
  });
  houseMats.forEach((list, i) => content.add(look.instanced(house(roofs[i]), list, 0.004)));
  const road = (a: P2, b: P2) => {
    const mid = V2((a.x + b.x) / 2 + (Rn() - 0.5) * 0.25, (a.z + b.z) / 2 + (Rn() - 0.5) * 0.25);
    return curve([V2(a.x, a.z), mid, V2(b.x, b.z)], 24);
  };
  const roadMat = look.flat(semantic.fxDirt);
  for (const [a, b] of [[0, 3], [3, 2], [3, 1], [1, 0]] as const) {
    const m = new THREE.Mesh(ribbon(road(towns[a], towns[b]), 0.014), roadMat);
    m.position.y = 0.002;
    m.raycast = () => {};
    content.add(m);
  }

  // --- Felder / fields ---
  const fieldColours = [semantic.biomeDesert, semantic.biomeSteppe, semantic.terrainForest, semantic.fxDirt];
  const fm: THREE.Matrix4[][] = fieldColours.map(() => []);
  const fieldSpots = jitterGrid(R, 0.13, 7, 0.86).filter((p) => free(p.x, p.y, 0.04) && wave(p.x * 2.2, p.y * 2.2, seed + 21) > 0.55 && H(p.x, p.y) < 0.12 && nearRiver(p.x, p.y) > 0.08);
  fieldSpots.slice(0, low ? 14 : 40).forEach((p, i) => fm[i % fieldColours.length].push(place(p.x, H(p.x, p.y) - 0.004, p.y, Math.round(Rn() * 4) * 0.4, 0.7 + Rn() * 0.3)));
  fm.forEach((list, i) => content.add(look.instanced(field(fieldColours[i]), list, 0)));
  const fieldTaken = fieldSpots.slice(0, low ? 14 : 40);

  // --- Mischwald / mixed forest ---
  const trees: THREE.Matrix4[][] = [[], [], [], []];
  const step = low ? 0.08 : 0.058;
  for (const p of jitterGrid(R, step, 3, 0.9)) {
    const n = wave(p.x * 2.1, p.y * 2.1, seed + 13);
    if (n < 0.5) continue;
    const h = H(p.x, p.y);
    if (h > 0.3 || !free(p.x, p.y, 0.02) || nearRiver(p.x, p.y) < 0.06 || lakeD(p.x, p.y) < 0.05) continue;
    if (fieldTaken.some((f) => f.distanceTo(p) < 0.09)) continue;
    const coniferous = h > 0.1 || wave(p.x * 5, p.y * 5, seed + 2) > 0.55;
    const kind = (coniferous ? 0 : 2) + (Rn() > 0.5 ? 1 : 0);
    trees[kind].push(place(p.x, h - 0.004, p.y, Rn() * 6, 0.75 + Rn() * 0.5));
  }
  const treeGeo = [conifer(0), conifer(1), leafy(0), leafy(1)];
  trees.forEach((list, i) => { if (list.length) content.add(look.instanced(treeGeo[i], list, 0.004)); else treeGeo[i].dispose(); });

  // --- Front: Graeben und Bunker / front: trenches and bunkers ---
  const tb = new Builder();
  const trench = [V2(-0.75, -0.42), V2(-0.55, -0.55), V2(-0.4, -0.38), V2(-0.22, -0.52), V2(-0.05, -0.4)];
  const bags: THREE.Matrix4[] = [];
  for (let i = 0; i < trench.length - 1; i++) {
    const a = trench[i], b = trench[i + 1];
    const len = a.distanceTo(b), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2;
    if (distToPath(mx, mz, path) < 0.08) continue;
    tb.add(geo.box(len, 0.012, 0.03), semantic.fxDirtDark, { p: [mx, H(mx, mz) + 0.002, mz], r: [0, -ang, 0] });
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.5) / 3;
      const x = a.x + (b.x - a.x) * t, z = a.y + (b.y - a.y) * t;
      bags.push(place(x - Math.sin(ang) * 0.025, H(x, z), z + Math.cos(ang) * 0.025, -ang, 1));
    }
  }
  content.add(look.inked(tb.build(), 0));
  content.add(look.instanced(sandbags(), bags, 0.003));
  const bunkerSpots = [V2(-0.62, -0.32), V2(-0.12, -0.3), V2(0.15, 0.32)].filter((p) => free(p.x, p.y));
  content.add(look.instanced(feature('bunker').build(), bunkerSpots.map((p, i) => place(p.x, H(p.x, p.y) - 0.005, p.y, i * 2.4, 0.26)), 0.035));

  // --- Absturzstelle mit Rauch / crash site with smoke ---
  const cs = look.inked(crashSite(0).build(), 0.03);
  cs.position.set(crash.x, H(crash.x, crash.z) - 0.01, crash.z);
  cs.scale.setScalar(0.42);
  content.add(cs);

  // --- Industriegebiet (NEXUS) / industrial area ---
  const ib = new Builder();
  ib.group({ p: [industry.x - 0.1, H(industry.x - 0.1, industry.z), industry.z], s: 0.36 }, () => powerPlant(ib, 'nexus'));
  ib.group({ p: [industry.x + 0.14, H(industry.x + 0.14, industry.z + 0.06), industry.z + 0.06], s: 0.3, r: [0, -0.5, 0] }, () => dataCenter(ib, 'nexus'));
  content.add(look.inked(ib.build(), 0.025));
  const stacks = [V2(industry.x + 0.02, industry.z - 0.14), V2(industry.x + 0.1, industry.z - 0.12)];
  content.add(look.instanced(smokestack(), stacks.map((p) => place(p.x, H(p.x, p.y), p.y, 0, 1)), 0.004));

  // --- Glockenturm (Akt II) / bell tower (act II) ---
  const bt = look.inked(bellTower(), 0.005);
  bt.position.set(bell.x, H(bell.x, bell.z) - 0.005, bell.z);
  bt.scale.setScalar(0.9);
  content.add(bt);

  // --- Rauch, Wolken, Voegel / smoke, clouds, birds ---
  const sm = smoke(look, [
    { x: crash.x, y: H(crash.x, crash.z) + 0.05, z: crash.z, size: 1.3, dark: true },
    ...stacks.map((p) => ({ x: p.x, y: H(p.x, p.y) + 0.32, z: p.y, size: 0.9 })),
    ...towns.slice(0, low ? 1 : 4).map((p) => ({ x: p.x + 0.03, y: H(p.x, p.z) + 0.1, z: p.z, size: 0.5 })),
  ], low ? 4 : 7);
  content.add(sm.group);
  anim.push(sm.update);
  const clouds = cloudRing(look, R * 1.5, low ? 2 : 4, seed, { y: 0.55, scale: 0.42 });
  spin.add(clouds.group);
  anim.push(clouds.update);
  if (!low) {
    const birds = flock(look, 9, 1.05, 0.62, seed);
    content.add(birds.group);
    anim.push(birds.update);
  }
  return { spin, disc, spots: path, update: (t) => anim.forEach((f) => f(t)) };
}
