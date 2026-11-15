/**
 * Artefakt der Vorlaeufer: das Ziel des Kampagnenfinales auf dem Mittelfeld der Karte.
 * Ein Ding aelter als Menschen, Zyrr, Maschinen und Kult; es kann die Zeit zurueckdrehen.
 * Precursor artifact: the objective of the campaign finale on the centre tile of the map.
 * Older than humans, Zyrr, machines and cult alike; it can turn back time.
 *
 * Aufbau / layout:
 * - 'static': geborstener Boden mit leuchtenden Fugen, gespaltener Neuneck-Sockel aus Obsidian mit Runen,
 *   drei schwebende Monolithen und ein Lichtstrahl nach oben.
 *   / cracked floor with glowing seams, split nine-sided obsidian plinth with runes, three hovering monoliths
 *   and a light beam going up.
 * - 'orbit': schwebender, drehbarer Teil: Kern, verdrehter Tesserakt-Kaefig, Gyroringe, Zeit-Zifferblatt
 *   und kreisende Splitter. Ursprung = Drehzentrum, liegt im Gesamtmodell bei y = ARTIFACT_ORBIT_Y.
 *   / floating rotating part: core, twisted tesseract cage, gyro rings, time dial and orbiting shards.
 *   Origin = rotation centre, at y = ARTIFACT_ORBIT_Y in the full model.
 *
 * Massstab: Brettfelder (1 Feld = 1.0), Ursprung unten mittig, Blick +z. Auf dem Brett mit Skalierung 1 setzen
 * (nicht mit der Einheiten-Skalierung 1.25). Hoehe ca. 2.05 Felder.
 * Scale: board tiles (1 tile = 1.0), origin bottom centre, facing +z. Place on the board at scale 1
 * (not the unit scale 1.25). Height about 2.05 tiles.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { semantic } from '../../design/tokens';
import { Builder, col, geo, memo, mix, rng, withDetail, xfMatrix, type V3 } from './kit';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

/** Hoehe des Drehzentrums ueber der Kacheloberseite / height of the rotation centre above the tile top */
export const ARTIFACT_ORBIT_Y = 1.1;

const C = {
  bone: col(semantic.artifactStone),
  boneDark: col(semantic.artifactStoneDark),
  boneMid: mix(semantic.artifactStone, semantic.artifactStoneDark, 0.5),
  obsidian: col(semantic.artifactObsidian),
  obsidianEdge: col(semantic.artifactObsidianEdge),
  obsidianMid: mix(semantic.artifactObsidian, semantic.artifactObsidianEdge, 0.5),
  deep: col(semantic.artifactGlowDeep),
  glow: col(semantic.artifactGlow),
  gold: col(semantic.artifactGold),
  core: col(semantic.artifactCore),
};

/**
 * Selbstleuchtende Vertexfarben des Artefakts (fuer die Leuchtmaske des Bretts, siehe withGlow).
 * Self-lit vertex colours of the artifact (for the board's glow mask, see withGlow).
 */
export const ARTIFACT_GLOW_COLORS: readonly THREE.Color[] = [C.glow, C.gold, C.core];

/** Keil eines Rings (Hülle aus 8 Punkten) / ring wedge (hull of 8 points) */
function wedge(r0: number, r1b: number, r1t: number, a0: number, a1: number, y0: number, y1: number): THREE.BufferGeometry {
  const pts: V3[] = [];
  for (const [y, r1] of [[y0, r1b], [y1, r1t]] as const) {
    for (const a of [a0, a1]) {
      pts.push([Math.cos(a) * r0, y, Math.sin(a) * r0]);
      pts.push([Math.cos(a) * r1, y, Math.sin(a) * r1]);
    }
  }
  return geo.hull(pts);
}

/** Splitter: unregelmaessiges Doppel-Oktaeder entlang y / shard: irregular double octahedron along y */
function shardGeo(R: () => number, h: number, w: number): THREE.BufferGeometry {
  const pts: V3[] = [[0, h * (0.55 + R() * 0.1), 0], [0, -h * (0.4 + R() * 0.1), 0]];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.5;
    const r = w * (0.6 + R() * 0.5);
    pts.push([Math.cos(a) * r, (R() - 0.4) * h * 0.25, Math.sin(a) * r * 0.7]);
  }
  return geo.hull(pts);
}

// ---------- statischer Teil / static part ----------

function ground(b: Builder) {
  const R = rng(4242);
  // leuchtender Grund unter den Platten: zeigt sich in den Fugen / glowing bed under the plates: shows in the seams
  b.add(geo.cyl(0.42, 0.425, 0.012, 27), C.glow, { p: [0, 0.006, 0] });
  // zwei Ringe gesprungener Bodenplatten / two rings of cracked floor plates
  const rings: [number, number, number][] = [[0.33, 0.405, 11], [0.405, 0.48, 15]];
  rings.forEach(([ri, ro, n], k) => {
    const off = k * 0.21;
    for (let i = 0; i < n; i++) {
      if (k === 1 && (i === 5 || i === 12)) continue; // fehlende Platten / missing plates
      const gap = 0.012 / ((ri + ro) / 2);
      const a0 = off + (i / n) * TAU + gap + R() * 0.05, a1 = off + ((i + 1) / n) * TAU - gap - R() * 0.05;
      const outer = ro - (k === 1 ? R() * 0.05 : 0);
      const h = 0.024 + R() * 0.014;
      const c = R() < 0.25 ? C.boneDark : R() < 0.5 ? C.boneMid : C.bone;
      b.group({ p: [0, 0.004, 0], r: [(R() - 0.5) * 0.03, 0, (R() - 0.5) * 0.03] }, () => {
        b.add(wedge(ri + 0.006, outer, outer - 0.008, a0, a1, 0, h), c);
      });
      // Glyphe auf jeder dritten Platte / glyph on every third plate
      if (i % 3 === k) {
        const am = (a0 + a1) / 2, rm = (ri + outer) / 2;
        b.box(0.05, 0.004, 0.008, C.glow, [Math.cos(am) * rm, h + 0.007, Math.sin(am) * rm], [0, -am + HALF_PI, 0]);
        b.box(0.008, 0.004, 0.03, C.glow, [Math.cos(am) * (rm - 0.012), h + 0.007, Math.sin(am) * (rm - 0.012)], [0, -am + HALF_PI, 0]);
      }
    }
  });
  // Truemmerbrocken in den Luecken / rubble in the gaps
  for (const a of [(5.5 / 15) * TAU + 0.21, (12.5 / 15) * TAU + 0.21]) {
    for (let i = 0; i < 3; i++) {
      const r = 0.43 + R() * 0.03, aa = a + (R() - 0.5) * 0.25;
      b.add(geo.dodeca(0.016 + R() * 0.014), i ? C.boneDark : C.obsidianEdge, { p: [Math.cos(aa) * r, 0.03, Math.sin(aa) * r], r: [R() * 3, R() * 3, R() * 3] });
    }
  }
}

/** Gespaltener Neuneck-Sockel / split nine-sided plinth */
const PLINTH_TOP = 0.27;
function plinth(b: Builder) {
  const R = rng(909);
  const N = 9;
  // leuchtender Kern hinter den Keilen: die Spalten gluehen / glowing core behind the wedges: the splits glow
  b.add(geo.cyl(0.27, 0.3, 0.12, 18), C.glow, { p: [0, 0.07, 0] });
  b.add(geo.cyl(0.19, 0.13, PLINTH_TOP - 0.14, 18), C.glow, { p: [0, (PLINTH_TOP + 0.12) / 2, 0] });
  // leuchtender Teich auf der mittleren Stufe / glowing pool on the middle tier
  b.add(geo.cyl(0.255, 0.255, 0.008, 27), C.glow, { p: [0, 0.133, 0] });
  // Stufen: [Innenradius, Aussen unten, Aussen oben, y0, y1, Drehung] / tiers
  const tiers: [number, number, number, number, number, number][] = [
    [0.24, 0.37, 0.35, 0.0, 0.065, 0],
    [0.18, 0.3, 0.28, 0.065, 0.13, Math.PI / N],
    [0.1, 0.15, 0.22, 0.13, PLINTH_TOP, 0],
  ];
  tiers.forEach(([ri, rb, rt, y0, y1, rot], ti) => {
    for (let i = 0; i < N; i++) {
      const gap = 0.018 / rb;
      const a0 = rot + (i / N) * TAU + gap, a1 = rot + ((i + 1) / N) * TAU - gap;
      // ein Keil der mittleren Stufe ist herausgebrochen und liegt schraeg / one middle-tier wedge broke out and leans
      const broken = ti === 1 && i === 2;
      const tilt: V3 = broken ? [0, 0, 0] : [(R() - 0.5) * 0.03, 0, (R() - 0.5) * 0.03];
      const am = (a0 + a1) / 2;
      // Drehpunkt an der Aussenkante unten / pivot at the outer bottom edge
      const pv: V3 = [Math.cos(am) * rb, y0, Math.sin(am) * rb];
      const push = broken ? 0.045 : 0;
      b.group({ p: [pv[0] + Math.cos(am) * push, pv[1] - (broken ? 0.03 : 0), pv[2] + Math.sin(am) * push], r: broken ? [Math.sin(am) * 0.45, 0, -Math.cos(am) * 0.45] : tilt }, () => b.group({ p: [-pv[0], -pv[1], -pv[2]] }, () => {
        b.add(wedge(ri, rb, rt, a0, a1, y0, y1), ti === 1 ? C.obsidianMid : C.obsidian);
        // Rune auf der Aussenseite / rune on the outside
        if (ti !== 2 || i % 2 === 0) {
          const rr = (rb + rt) / 2 + 0.003, ym = (y0 + y1) / 2;
          const g = (i * 7 + ti * 3) % 4;
          b.group({ p: [Math.cos(am) * rr, ym, Math.sin(am) * rr], r: [0, -am + HALF_PI, 0] }, () => {
            const cr = ti === 1 ? C.gold : C.glow;
            if (g !== 1) b.box(0.006, (y1 - y0) * 0.55, 0.006, cr, [0, 0, 0]);
            if (g !== 2) b.box(0.03, 0.006, 0.006, cr, [0, (g - 1.5) * 0.012, 0]);
            if (g === 0 || g === 3) b.add(geo.torus(0.012, 0.0035, 3, 8), cr, { p: [0, (y1 - y0) * 0.2, 0] });
          });
        }
      }));
    }
    // Obsidian-Lippe an der Stufenkante / obsidian lip at the tier edge
    if (ti < 2) b.add(geo.torus(rt - 0.004, 0.008, 3, 27), C.obsidianEdge, { p: [0, y1, 0], r: [HALF_PI, 0, 0] });
  });
  // Deckplatte mit Zeitkreisen / top plate with time circles
  b.add(geo.cyl(0.215, 0.215, 0.02, 27), C.obsidianEdge, { p: [0, PLINTH_TOP + 0.01, 0] });
  b.add(geo.cyl(0.19, 0.19, 0.012, 27), C.obsidian, { p: [0, PLINTH_TOP + 0.022, 0] });
  for (const [r, c] of [[0.17, C.gold], [0.12, C.glow], [0.075, C.gold]] as const) {
    b.add(geo.torus(r, 0.006, 3, 30), c, { p: [0, PLINTH_TOP + 0.028, 0], r: [HALF_PI, 0, 0], s: [1, 1, 0.5] });
  }
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * TAU;
    b.box(0.028, 0.006, 0.007, i % 4 ? C.glow : C.core, [Math.cos(a) * 0.145, PLINTH_TOP + 0.03, Math.sin(a) * 0.145], [0, -a, 0]);
  }
  // Fokuslinse in der Mitte / focus lens in the centre
  b.add(geo.cyl(0.055, 0.065, 0.025, 13), C.gold, { p: [0, PLINTH_TOP + 0.04, 0] });
  b.add(geo.ico(0.045, 0), C.core, { p: [0, PLINTH_TOP + 0.06, 0], s: [1, 0.5, 1] });
}

/** Drei schwebende Monolithen, einer hinten und zwei seitlich zur Standardkamera / three hovering monoliths, one at the back and two to the sides of the default camera */
function monoliths(b: Builder) {
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 4 + Math.PI + (i - 1) * (TAU / 3);
    const r = 0.405;
    const y = 0.13 + (i % 2) * 0.04;
    b.group({ p: [Math.cos(a) * r, y, Math.sin(a) * r], r: [0, -a + HALF_PI, 0] }, () => {
      // leicht nach aussen geneigt / leaning slightly outward
      b.group({ r: [-0.07, 0, 0] }, () => {
        const h = 0.74 + (i % 2) * 0.08;
        b.add(geo.hull([
          [-0.05, 0, -0.022], [0.05, 0, -0.022], [-0.05, 0, 0.022], [0.05, 0, 0.022],
          [-0.07, h * 0.62, -0.026], [0.07, h * 0.62, -0.026], [-0.07, h * 0.62, 0.026], [0.07, h * 0.62, 0.026],
          [-0.012, h, 0], [0.04, h * 0.93, 0],
        ]), i === 1 ? C.boneMid : C.bone);
        // Obsidianband / obsidian band
        b.add(geo.hull([
          [-0.074, h * 0.5, -0.03], [0.074, h * 0.5, -0.03], [-0.074, h * 0.5, 0.03], [0.074, h * 0.5, 0.03],
          [-0.072, h * 0.58, -0.03], [0.072, h * 0.58, -0.03], [-0.072, h * 0.58, 0.03], [0.072, h * 0.58, 0.03],
        ]), C.obsidian);
        // Leuchtnaht an der Innenseite / glowing seam on the inner face
        b.box(0.012, h * 0.7, 0.008, C.glow, [0, h * 0.42, -0.026]);
        for (let k = 0; k < 4; k++) b.box(0.05 - k * 0.008, 0.008, 0.008, k % 2 ? C.glow : C.gold, [0, 0.12 + k * 0.1, -0.027]);
        // Augen-Rune aussen / eye rune outside
        b.add(geo.torus(0.024, 0.006, 3, 10), C.gold, { p: [0, h * 0.7, 0.026] });
        b.add(geo.ico(0.011, 0), C.core, { p: [0, h * 0.7, 0.029] });
        for (let k = 0; k < 3; k++) b.box(0.008, 0.03, 0.006, C.glow, [(k - 1) * 0.022, h * 0.42, 0.026]);
      });
    });
    // Schwebeschimmer darunter / hover shimmer below
    b.add(geo.cyl(0.05, 0.03, 0.01, 9), C.glow, { p: [Math.cos(a) * r, y - 0.05, Math.sin(a) * r] });
    // Blitzbogen von der Spitze zur Achse unter dem Kern / lightning arc from the tip to the axis below the core
    const h = 0.74 + (i % 2) * 0.08;
    const tip = new THREE.Vector3(0.01, h * 0.97, 0)
      .applyMatrix4(xfMatrix({ r: [-0.07, 0, 0] }))
      .applyMatrix4(xfMatrix({ p: [Math.cos(a) * r, y, Math.sin(a) * r], r: [0, -a + HALF_PI, 0] }));
    arc(b, tip, new THREE.Vector3(0, ARTIFACT_ORBIT_Y - 0.26, 0), 6, 1300 + i);
  }
}

/** Zickzack-Blitz / zigzag lightning */
function arc(b: Builder, from: THREE.Vector3, to: THREE.Vector3, n: number, seed: number) {
  const R = rng(seed);
  const dir = to.clone().sub(from);
  const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  let prev: V3 = [from.x, from.y, from.z];
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const p = from.clone().addScaledVector(dir, t);
    if (k < n) p.addScaledVector(side, (k % 2 ? 1 : -1) * (0.04 + R() * 0.03)).y += (k % 2 ? 1 : -1) * (0.03 + R() * 0.03);
    const cur: V3 = [p.x, p.y, p.z];
    b.tube(prev, cur, 0.012, 4, C.glow);
    if (k < n) b.add(geo.ico(0.013, 0), C.core, { p: cur });
    prev = cur;
  }
}

/** Aufsteigende Truemmer und Ringe zwischen Linse und Kern: das Artefakt hebt die Schwerkraft auf / rising rubble and rings between lens and core: the artifact suspends gravity */
function rising(b: Builder) {
  const R = rng(31);
  for (const [y, r] of [[0.36, 0.08], [0.5, 0.06]] as const) b.add(geo.torus(r, 0.007, 3, 16), C.gold, { p: [0, y, 0], r: [HALF_PI, 0, 0] });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + R() * 0.4, r = 0.09 + R() * 0.12, y = 0.34 + i * 0.06;
    const c = i % 3 === 0 ? C.obsidianEdge : i % 3 === 1 ? C.bone : C.boneDark;
    b.add(geo.rtaper(0.035, 0.03, 0.028, 0.024, 0.026, 0.006), c, { p: [Math.cos(a) * r, y, Math.sin(a) * r], r: [R() * 3, R() * 3, R() * 3], s: 0.7 + R() * 0.6 });
  }
}

function staticPart(): Builder {
  const b = new Builder();
  ground(b);
  plinth(b);
  monoliths(b);
  rising(b);
  return b;
}

// ---------- schwebender Teil / floating part ----------

/** Punkte eines Fuenfecks, zum Mittelpunkt geschrumpft und entlang n verschoben / pentagon points shrunk to the centre and shifted along n */
function ring(pts: THREE.Vector3[], ctr: THREE.Vector3, n: THREE.Vector3, k: number, off: number): V3[] {
  return pts.map((q) => {
    const v = q.clone().sub(ctr).multiplyScalar(k).add(ctr).addScaledVector(n, off);
    return [v.x, v.y, v.z] as V3;
  });
}

/**
 * Gesprengtes Dodekaeder: zwoelf Obsidianplatten schweben vom Kern weg, jede mit leuchtendem Saum; durch die Spalten scheint der Kern.
 * Exploded dodecahedron: twelve obsidian plates float away from the core, each with a glowing rim; the core shines through the gaps.
 */
function shell(b: Builder, r: number, explode: number, thick: number) {
  // Polyeder sind schon nicht indiziert / polyhedra are already non-indexed
  const src = new THREE.DodecahedronGeometry(r, 0);
  const pos = src.getAttribute('position');
  const faces = new Map<string, { n: THREE.Vector3; pts: THREE.Vector3[] }>();
  const a = new THREE.Vector3(), bb = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t); bb.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
    const n = bb.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const key = `${Math.round(n.x * 100)}|${Math.round(n.y * 100)}|${Math.round(n.z * 100)}`;
    let f = faces.get(key);
    if (!f) { f = { n, pts: [] }; faces.set(key, f); }
    for (const v of [a, bb, c]) if (!f.pts.some((q) => q.distanceToSquared(v) < 1e-8)) f.pts.push(v.clone());
  }
  src.dispose();
  let i = 0;
  for (const { n, pts } of faces.values()) {
    const ctr = pts.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    // Platte / plate
    b.add(geo.hull([...ring(pts, ctr, n, 0.7, explode), ...ring(pts, ctr, n, 0.58, explode - thick)]), i % 4 === 1 ? C.obsidianMid : C.obsidian);
    // leuchtender Saum dahinter / glowing rim behind
    b.add(geo.hull([...ring(pts, ctr, n, 0.84, explode - thick * 0.55), ...ring(pts, ctr, n, 0.8, explode - thick * 0.85)]), i % 3 ? C.glow : C.gold);
    // Glyphe aussen / glyph outside
    const p = ctr.clone().addScaledVector(n, explode + 0.001);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const e = new THREE.Euler().setFromQuaternion(q);
    b.group({ p: [p.x, p.y, p.z], r: [e.x, e.y, e.z] }, () => {
      if (i % 2 === 0) b.add(geo.torus(r * 0.13, 0.0055, 3, 10), C.gold, { r: [HALF_PI, 0, 0] });
      else b.box(0.008, 0.005, r * 0.42, i % 4 === 1 ? C.glow : C.gold, [0, 0, 0], [0, (i * 0.7) % 3, 0]);
    });
    i++;
  }
}

/** Umgedrehte Dreieckspyramide ueber dem Kern / inverted triangular pyramid above the core */
function capstone(b: Builder, y0: number, y1: number, rr: number) {
  const top: V3[] = [0, 1, 2].map((k) => [Math.cos(k * TAU / 3 + 0.3) * rr, y1, Math.sin(k * TAU / 3 + 0.3) * rr]);
  b.add(geo.hull([...top, [0, y0, 0]]), C.obsidian);
  // Leuchtkanten / glowing edges
  for (const t of top) b.tube([t[0] * 0.96, y1 - 0.004, t[2] * 0.96], [0, y0 + 0.01, 0], 0.009, 5, C.glow);
  // Glyphe auf der Oberseite: Ringe und Punkte / glyph on the top: rings and dots
  b.add(geo.cyl(rr * 0.38, rr * 0.38, 0.012, 18), C.obsidianEdge, { p: [0, y1 + 0.004, 0] });
  b.add(geo.torus(rr * 0.3, 0.008, 3, 18), C.gold, { p: [0, y1 + 0.011, 0], r: [HALF_PI, 0, 0] });
  b.add(geo.torus(rr * 0.15, 0.007, 3, 14), C.glow, { p: [0, y1 + 0.011, 0], r: [HALF_PI, 0, 0] });
  for (const t of top) b.add(geo.ico(0.016, 0), C.core, { p: [t[0] * 0.62, y1 + 0.006, t[2] * 0.62] });
  // eingelegte Dreiecke auf den Seiten / inlaid triangles on the sides
  for (let k = 0; k < 3; k++) {
    const t0 = new THREE.Vector3(...top[k]), t1 = new THREE.Vector3(...top[(k + 1) % 3]), ap = new THREE.Vector3(0, y0, 0);
    const ctr = t0.clone().add(t1).add(ap).multiplyScalar(1 / 3);
    const n = t1.clone().sub(t0).cross(ap.clone().sub(t0)).normalize();
    if (n.dot(ctr) < 0) n.negate();
    const tri = (k2: number, off: number): V3[] => [t0, t1, ap].map((v) => {
      const q = v.clone().sub(ctr).multiplyScalar(k2).add(ctr).addScaledVector(n, off);
      return [q.x, q.y, q.z] as V3;
    });
    b.add(geo.hull([...tri(0.68, 0.0), ...tri(0.62, 0.008)]), C.glow);
    b.add(geo.hull([...tri(0.36, 0.008), ...tri(0.3, 0.014)]), C.obsidian);
    const e = ctr.clone().addScaledVector(n, 0.016);
    b.add(geo.ico(0.022, 0), C.gold, { p: [e.x, e.y + 0.01, e.z] });
  }
}

function orbitPart(): Builder {
  const b = new Builder();
  const R = rng(777);
  // Kern: Weissgold-Kugel im Sternkoerper / core: white-gold orb inside a star body
  b.add(geo.ico(0.15, 1), C.core);
  b.group({ r: [0.3, 0.2, 0.5] }, () => {
    for (const s of [1, -1]) b.add(new THREE.TetrahedronGeometry(0.23, 0), s > 0 ? C.gold : C.glow, { r: s > 0 ? [0, 0, 0] : [0, HALF_PI, 0], s: [1, s, 1] });
  });
  // gekippte, gesprengte Huelle / tilted exploded shell
  b.group({ r: [0.55, 0.2, 0.4] }, () => shell(b, 0.23, 0.12, 0.04));
  // umgedrehte Pyramide und Krone / inverted pyramid and crown
  capstone(b, 0.4, 0.76, 0.3);
  b.add(new THREE.OctahedronGeometry(0.06, 0), C.gold, { p: [0, 0.92, 0], s: [1, 1.5, 1] });
  b.add(geo.torus(0.11, 0.009, 3, 20), C.glow, { p: [0, 0.92, 0], r: [HALF_PI + 0.2, 0, 0.1] });
  // Zeit-Zifferblatt unter dem Kern: 13 Teilstriche / time dial below the core: 13 ticks
  const dy = -0.5;
  b.add(geo.torus(0.3, 0.011, 3, 39), C.gold, { p: [0, dy, 0], r: [HALF_PI, 0, 0] });
  b.add(geo.torus(0.23, 0.007, 3, 39), C.glow, { p: [0, dy, 0], r: [HALF_PI, 0, 0] });
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * TAU;
    const long = i === 0;
    b.box(long ? 0.1 : 0.06, 0.014, 0.016, long ? C.core : C.obsidianEdge, [Math.cos(a) * (long ? 0.28 : 0.265), dy, Math.sin(a) * (long ? 0.28 : 0.265)], [0, -a, 0]);
  }
  // kreisende Splitter auf einer gekippten Bahn / orbiting shards on a tilted path
  b.group({ r: [0.32, 0, -0.18] }, () => {
    b.add(geo.torus(0.45, 0.009, 3, 48), C.gold, { r: [HALF_PI, 0, 0] });
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R() * 0.2;
      const r = 0.45;
      const h = 0.15 + R() * 0.1;
      b.group({ p: [Math.cos(a) * r, (R() - 0.5) * 0.04, Math.sin(a) * r], r: [(R() - 0.5) * 0.5, -a, (R() - 0.5) * 0.5 + 0.3] }, () => {
        b.add(shardGeo(R, h, 0.038), i % 3 === 2 ? C.bone : C.obsidian);
        b.add(geo.cone(0.014, h * 0.4, 4), i % 3 === 2 ? C.gold : C.glow, { p: [0, h * 0.42, 0] });
      });
    }
  });
  // Funken / motes
  for (let i = 0; i < 10; i++) {
    const a = R() * TAU, r = 0.2 + R() * 0.25;
    b.add(geo.ico(0.009 + R() * 0.008, 0), i % 2 ? C.gold : C.core, { p: [Math.cos(a) * r, (R() - 0.5) * 0.5, Math.sin(a) * r] });
  }
  return b;
}

// ---------- API ----------

/**
 * Geometrie des Artefakts (zwischengespeichert, nicht veraendern).
 * 'static': Boden, Sockel, Monolithen, aufsteigende Energie (Ursprung unten mittig).
 * 'orbit': schwebender Teil um sein Drehzentrum; auf dem Brett bei y = ARTIFACT_ORBIT_Y setzen und um y drehen.
 * Artifact geometry (memoised, do not mutate).
 * 'static': floor, plinth, monoliths, rising energy (origin bottom centre).
 * 'orbit': floating part around its rotation centre; place it at y = ARTIFACT_ORBIT_Y on the board and spin it around y.
 */
export function artifactGeometry(part: 'static' | 'orbit' = 'static'): THREE.BufferGeometry {
  return memo(`artifact|${part}`, () => withDetail(1.2, false, () => (part === 'orbit' ? orbitPart() : staticPart()).build()));
}

/** Beide Teile zusammen fuer Standbilder / both parts merged for still previews */
export function artifactGeometryAll(): THREE.BufferGeometry {
  return memo('artifact|all', () => {
    const o = artifactGeometry('orbit').clone();
    o.translate(0, ARTIFACT_ORBIT_Y, 0);
    const g = mergeGeometries([artifactGeometry('static').clone(), o], false);
    if (!g) throw new Error('artifact merge failed');
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  });
}
