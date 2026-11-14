/**
 * Anfuehrer-Bueste je Fraktion (Kopf und Schultern) mit modellierten Gesichtern / faction leader busts with sculpted faces.
 * Blick +z, Ursprung unten mittig, ca. 1.0 hoch und 0.9 breit. Frei erfundene Figuren.
 * Facing +z, origin bottom centre, about 1.0 tall and 0.9 wide. Invented characters.
 * Die Koepfe sind hochaufgeloeste, verformte Kugeln mit glatten Normalen (siehe sculpt.ts).
 * Heads are high-resolution deformed spheres with smooth normals (see sculpt.ts).
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, col, geo, mix, rng, shade, type ColorLike, type V3 } from './kit';
import { look, mat, type Look } from './look';
import { Sculpt, blob, browStrands, ear, eye, faceInk, gauss, hairLock, ink, lips, mulberry, neck, paint, smoothstep, strand } from './sculpt';

const HALF_PI = Math.PI / 2;

// ---------- Kleidung / clothing ----------

/**
 * Glatter Oberkoerper: elliptischer Querschnitt, abfallende Schultern, flacher Boden.
 * Smooth torso: elliptical cross-section, sloping shoulders, flat bottom.
 */
function torso(b: Builder, c: ColorLike | ((p: THREE.Vector3) => THREE.Color), o: { w?: number; d?: number; h?: number; slope?: number; neckR?: number; square?: number } = {}) {
  const W = o.w ?? 0.44, D = o.d ?? 0.21, Ht = o.h ?? 0.4, slope = o.slope ?? 0.07, nr = o.neckR ?? 0.1, sq = o.square ?? 0.25;
  const g = new THREE.CylinderGeometry(1, 1, 1, 72, 20, false);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
    const rr = Math.hypot(x0, z0), a = Math.atan2(z0, x0);
    // eckigere Ellipse / squarer ellipse
    const ca = Math.cos(a), sa = Math.sin(a);
    const k = 1 / Math.pow(Math.pow(Math.abs(ca), 2 + sq * 4) + Math.pow(Math.abs(sa), 2 + sq * 4), 1 / (2 + sq * 4));
    let x: number, y: number, z: number;
    if (y0 < 0.499) {
      const h = y0 + 0.5;
      const wh = W * (0.86 + 0.14 * smoothstep(0, 0.75, h)) * (1 - 0.1 * smoothstep(0.85, 1, h));
      const dh = D * (0.92 + 0.08 * smoothstep(0, 0.6, h)) * (1 - 0.12 * smoothstep(0.85, 1, h));
      x = ca * k * wh; z = sa * k * dh; y = h * Ht;
      y -= slope * (x / W) ** 2 * smoothstep(0.6, 1, h) * 1.4;
    } else {
      // Deckel: Schultern zum Hals / lid: shoulders up to the neck
      const r2 = Math.max(rr, 0);
      const wh = W * 0.9, dh = D * 0.88;
      const rad = nr / W + (1 - nr / W) * r2;
      x = ca * k * wh * rad; z = sa * k * dh * rad;
      y = Ht - slope * (x / W) ** 2 * 1.4 + 0.03 * (1 - r2);
    }
    pos.setXYZ(i, x, y, z - 0.01);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  b.addSmooth(paint(g, typeof c === 'function' ? (p) => c(p) : c));
}

/** Falte als flache Straehne / fold as a flat strand */
function fold(b: Builder, pts: V3[], r: number, c: ColorLike) {
  strand(b, pts, r, r * 0.3, c, c, { seg: 6, flat: 0.45 });
}

/** Steppnaht aus kurzen Strichen / stitching made of short dashes */
function stitch(b: Builder, a: V3, c: V3, n: number, col0: ColorLike, w = 0.012) {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
  const ang = Math.atan2(dy, dx);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    b.box(w, 0.0035, 0.004, col0, [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t], [0, 0, ang]);
  }
}

/** Knopf mit Rand und Loechern / button with rim and holes */
function button(b: Builder, p: V3, c: ColorLike, r = 0.013, emblem?: FactionId) {
  b.add(geo.cyl(r, r * 1.05, r * 0.6, 20), c, { p, r: [HALF_PI, 0, 0] });
  b.add(geo.torus(r * 0.82, r * 0.16, 4, 18), shade(c, 0.78), { p: [p[0], p[1], p[2] + r * 0.3] });
  if (emblem) addEmblem(b, emblem, r * 0.55, r * 0.3, shade(c, 0.7), { p: [p[0], p[1], p[2] + r * 0.32] });
  else for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(r * 0.2, r * 0.2, r * 0.2, shade(c, 0.6), [p[0] + dx * r * 0.25, p[1] + dy * r * 0.25, p[2] + r * 0.3]);
}

/** Epaulette mit Fransen / epaulette with fringe */
function epaulette(b: Builder, s: number, base: ColorLike, fringe: ColorLike, y = 0.37, x = 0.3, stars = 0, star: ColorLike = mat.white) {
  b.group({ p: [s * x, y, -0.005], r: [0, 0, s * -0.24] }, () => {
    b.add(geo.rbox(0.17, 0.03, 0.16, 0.012), base, {});
    b.add(geo.cyl(0.08, 0.08, 0.036, 28), shade(fringe, 1.05), { p: [s * 0.04, 0, 0] });
    b.add(geo.torus(0.08, 0.008, 6, 28), shade(fringe, 0.8), { p: [s * 0.04, 0.018, 0], r: [HALF_PI, 0, 0] });
    for (let i = 0; i < 13; i++) {
      const z = -0.07 + (i / 12) * 0.14;
      strand(b, [[s * 0.11, -0.005, z], [s * 0.125, -0.035, z], [s * 0.13, -0.065, z]], 0.007, 0.005, fringe, shade(fringe, 0.8), { seg: 5, samples: 5 });
    }
    for (let i = 0; i < stars; i++) b.add(geo.cyl(0.016, 0.016, 0.006, 5), star, { p: [s * (0.0 - i * 0.04), 0.018, 0], r: [0, 0.3, 0] });
  });
}

/** Ordensspange und Orden / ribbon bars and medals */
function medals(b: Builder, x0: number, y0: number, z: number, rows: number, cols: number, palette: ColorLike[], seed: number) {
  const R = rng(seed);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + (c - (cols - 1) / 2) * 0.034, y = y0 - r * 0.019;
    const a = palette[Math.floor(R() * palette.length)], bb = palette[Math.floor(R() * palette.length)];
    b.add(geo.rbox(0.032, 0.015, 0.008, 0.002), a, { p: [x, y, z] });
    b.box(0.007, 0.016, 0.0095, bb, [x, y, z]);
    b.box(0.003, 0.016, 0.01, shade(bb, 0.7), [x - 0.009, y, z]);
  }
}
function medal(b: Builder, x: number, y: number, z: number, ribbon: ColorLike, disc: ColorLike, star = false) {
  b.add(geo.taper(0.03, 0.006, 0.024, 0.006, 0.04), ribbon, { p: [x, y, z] });
  b.box(0.006, 0.04, 0.0065, shade(ribbon, 0.6), [x, y, z]);
  if (star) {
    b.add(geo.cyl(0.026, 0.026, 0.008, 5), disc, { p: [x, y - 0.042, z + 0.002], r: [HALF_PI, 0, 0] });
    b.add(geo.cyl(0.012, 0.014, 0.008, 5), shade(disc, 1.2), { p: [x, y - 0.042, z + 0.006], r: [HALF_PI, 0, 0] });
  } else {
    b.add(geo.cyl(0.021, 0.021, 0.008, 24), disc, { p: [x, y - 0.04, z + 0.002], r: [HALF_PI, 0, 0] });
    b.add(geo.torus(0.017, 0.003, 4, 20), shade(disc, 0.75), { p: [x, y - 0.04, z + 0.007] });
  }
}

/** Gemeinsame Hautfarbe je Figur / skin tone per character */
const skinOf = (k: number, warm = 0) => mix(shade(mat.skin, k), mat.orange, warm);

// ---------- Korvat: Grossmarschall Ilja Brodnik ----------

function korvat(b: Builder, L: Look) {
  const coat = L.primary, gold = mat.gold, grey = mat.concrete, greyL = mat.concreteLight;
  const skin = skinOf(0.97, 0.08);
  torso(b, coat, { w: 0.45, d: 0.22, slope: 0.05, neckR: 0.11, square: 0.3 });
  // Mantelfalten / coat folds
  for (const s of [-1, 1]) {
    fold(b, [[s * 0.33, 0.05, 0.19], [s * 0.3, 0.16, 0.205], [s * 0.26, 0.26, 0.2]], 0.014, shade(coat, 0.8));
    fold(b, [[s * 0.38, 0.28, 0.12], [s * 0.34, 0.33, 0.15], [s * 0.28, 0.36, 0.14]], 0.012, shade(coat, 0.82));
  }
  // schwerer Mantelkragen mit Steppnaht / heavy greatcoat collar with stitching
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.2, 0.05, 0.13, 0.045, 0.25, 0.015), shade(coat, 0.84), { p: [s * 0.12, 0.3, 0.19], r: [0.12, s * 0.35, s * 0.42] });
    stitch(b, [s * 0.04, 0.4, 0.225], [s * 0.19, 0.2, 0.235], 9, shade(coat, 0.6));
    b.add(geo.rtaper(0.17, 0.06, 0.15, 0.06, 0.14, 0.02), shade(coat, 0.76), { p: [s * 0.105, 0.46, 0.05], r: [-0.2, s * -0.5, s * -0.2] });
    b.add(geo.rbox(0.055, 0.032, 0.012, 0.004), gold, { p: [s * 0.1, 0.45, 0.14], r: [0, s * -0.5, 0] });
    addEmblem(b, 'korvat', 0.012, 0.004, coat, { p: [s * 0.1, 0.45, 0.148], r: [0, s * -0.5, 0] });
  }
  b.add(geo.rbox(0.14, 0.27, 0.02, 0.008), shade(coat, 0.92), { p: [0, 0.16, 0.215] });
  for (const y of [0.07, 0.14, 0.21, 0.28]) for (const x of [-0.05, 0.05]) button(b, [x, y, 0.228], gold, 0.015, 'korvat');
  for (const s of [-1, 1]) epaulette(b, s, gold, shade(gold, 0.9), 0.375, 0.31, 3, L.primary);
  // Orden auf der Brust / chest full of medals
  medals(b, -0.2, 0.32, 0.21, 4, 4, [L.secondary, gold, mat.white, L.primaryDark, mat.blue, mat.dark], 3);
  for (const [x, star] of [[-0.26, true], [-0.205, false], [-0.15, true]] as [number, boolean][]) medal(b, x, 0.23, 0.212, L.secondary, gold, star);
  medal(b, 0.2, 0.31, 0.21, mat.white, mat.metalLight, true);
  medal(b, 0.25, 0.31, 0.205, L.secondary, gold, false);
  addEmblem(b, 'korvat', 0.042, 0.01, gold, { p: [0.2, 0.16, 0.215] });
  neck(b, skin, { r: 0.088, y0: 0.36, h: 0.2, adam: 0.25 });

  // ---- Kopf: breit, schwerer Kiefer, streng-vaeterlich / head: broad, heavy jaw, stern but fatherly ----
  const S = new Sculpt([0, 0.665, 0.03], [0.175, 0.19, 0.172], {
    jaw: -0.06, chin: 0.26, chinDown: 0.08, lowY: 0.14, socket: 0.13, brow: 0.12, cheek: 0.1, temple: 0.03,
    noseBridge: 0.12, noseLen: 0.4, noseW: 1.45, noseY: -0.22, lipU: 0.015, lipL: 0.02, mouthDepth: 0, mouthW: 0.4, mouthY: -0.58,
    smile: -0.015, fold: 0.035, age: 1.1, frown: 1.2, eyeY: 0.12, flat: 0.12,
    bumps: [
      // Hamsterbacken und breites Kinn / jowls and broad chin
      { c: [0.5, -0.55, 0.7], s: [0.18, 0.18, 0.4], a: 0.07 }, { c: [-0.5, -0.55, 0.7], s: [0.18, 0.18, 0.4], a: 0.07 },
      { c: [0, -0.85, 0.6], s: [0.35, 0.15, 0.4], a: 0.06 },
    ],
  });
  b.addSmooth(S.mesh(skin, { hair: { c: grey, at: (p) => (p.z < 0.15 && p.y > -0.3 ? 1 : 0) } }));
  faceInk(b, S, { nose: 1, fold: 1.1, age: 1, frown: 1.1, bags: 0.9, chin: 0.8 });
  lips(b, S, { c: shade(skin, 0.82), hU: 0.035, hL: 0.05, thick: 0.04 });
  ear(b, S, -1, skin, { size: 1.1 });
  ear(b, S, 1, skin, { size: 1.1 });
  for (const s of [-1, 1] as const) eye(b, S, s, { iris: mat.blue, lid: 77, lower: 66, tilt: 0.14, lidCol: skin, look: [0, -0.15] });
  for (const s of [-1, 1] as const) browStrands(b, S, s, { c: greyL, c1: grey, n: 24, thick: 0.05, ang: 0.14, arch: 0.02, w: 0.38, wild: 0.05, y: 0.3 });
  // grosser Schnurrbart mit gezwirbelten Enden / big moustache with curled ends
  const R = mulberry(5);
  for (const s of [-1, 1]) for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const x0 = s * (0.02 + t * 0.2), y0 = -0.38 - t * 0.04 + (R() - 0.5) * 0.03;
    const reach = 0.25 + (1 - t) * 0.1 + R() * 0.06;
    const xe = s * (0.2 + reach), ye = -0.6 - R() * 0.04;
    const curl = i % 3 === 0;
    const pts: V3[] = [S.surf(x0, y0, 0.02), S.surf((x0 + xe) / 2, (y0 + ye) / 2 - 0.04, 0.08 + (1 - t) * 0.03), S.surf(xe, ye, 0.06)];
    if (curl) pts.push(S.surf(xe + s * 0.07, ye + 0.08, 0.06), S.surf(xe + s * 0.03, ye + 0.15, 0.06));
    strand(b, pts, S.len(0.045 - t * 0.012), S.len(0.012), grey, greyL, { seg: 7 });
  }
  // kurzes graues Haar und Koteletten unter der Muetze / short grey hair and sideburns below the cap
  for (const s of [-1, 1]) for (let i = 0; i < 12; i++) {
    const z = -0.15 - i * 0.07;
    hairLock(b, S, [[s * 0.95, 0.38, z], [s * 0.99, 0.12, z - 0.03], [s * 0.94, -0.12, z - 0.06]], 0.03, 0.075, 0.03, grey, greyL);
  }
  // Koteletten vor dem Ohr / sideburns in front of the ear
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) hairLock(b, S, [[s * 0.93, 0.35, 0.05 + i * 0.03], [s * 0.96, 0.1, 0.08 + i * 0.03], [s * 0.93, -0.18, 0.12 + i * 0.025]], 0.025, 0.05, 0.025, grey, greyL);
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + i * 0.3;
    hairLock(b, S, [[Math.sin(a) * 0.6, 0.4, -0.85], [Math.sin(a) * 0.65, 0.05, -0.95], [Math.sin(a) * 0.6, -0.25, -0.85]], 0.04, 0.07, 0.02, grey, greyL);
  }
  // Schirmmuetze mit Emblem / peaked cap with emblem
  const capC = L.helmet;
  b.add(geo.cyl(0.215, 0.185, 0.1, 64), capC, { p: [0, 0.895, 0.0], s: [1, 1, 1.02] });
  b.add(geo.sphere(0.225, 64, 16), capC, { p: [0, 0.940, -0.005], s: [1, 0.26, 1.04] });
  b.add(geo.torus(0.214, 0.01, 6, 64), shade(capC, 0.8), { p: [0, 0.942, 0], r: [HALF_PI, 0, 0], s: [1, 1.03, 1] });
  b.add(geo.cyl(0.188, 0.188, 0.052, 64), L.primary, { p: [0, 0.855, 0.0] });
  b.add(geo.cyl(0.19, 0.19, 0.01, 64), gold, { p: [0, 0.880, 0.0] });
  b.add(geo.cyl(0.215, 0.215, 0.012, 64), mat.dark, { p: [0, 0.830, 0.115], s: [0.95, 1, 0.85], r: [0.34, 0, 0] });
  b.add(geo.torus(0.1, 0.008, 6, 32), gold, { p: [0, 0.845, 0.165], s: [1, 0.25, 1], r: [0.5, 0, 0] });
  for (const s of [-1, 1]) button(b, [s * 0.1, 0.850, 0.17], gold, 0.01);
  b.add(geo.cyl(0.055, 0.055, 0.014, 32), gold, { p: [0, 0.915, 0.205], r: [HALF_PI - 0.25, 0, 0] });
  addEmblem(b, 'korvat', 0.045, 0.01, L.primary, { p: [0, 0.915, 0.213], r: [-0.25, 0, 0] });
  for (const s of [-1, 1]) b.add(geo.cone(0.022, 0.07, 8), gold, { p: [s * 0.075, 0.915, 0.2], r: [0, 0, s * 1.3] });
}

// ---------- Dravon: Kommandant Sarek Voss ----------

function dravon(b: Builder, L: Look) {
  const black = col(L.helmet), green = L.jacket, gold = L.secondary;
  const skin = skinOf(0.9, 0.02);
  const camo = (p: THREE.Vector3) => {
    const n = Math.sin(p.x * 23 + Math.sin(p.y * 17) * 2) + Math.sin(p.y * 19 + p.z * 13 + Math.cos(p.x * 11) * 2);
    return n > 1.0 ? shade(green, 0.55) : n > 0.3 ? shade(green, 0.8) : n < -1.2 ? mix(green, black, 0.45) : col(green);
  };
  torso(b, camo, { w: 0.43, d: 0.21, slope: 0.02, square: 0.45 });
  // kantige Schulterpanzer mit Goldkante / angular shoulder armour with gold edge
  for (const s of [-1, 1]) {
    b.add(geo.profileXY([[0, 0], [0.21, -0.03], [0.235, 0.04], [0.11, 0.11], [0.0, 0.1]], 0.26), shade(green, 0.62), { p: [s * 0.2, 0.34, -0.13], s: [s, 1, 1] });
    strand(b, [[s * 0.43, 0.32, 0.13], [s * 0.445, 0.335, 0.0], [s * 0.43, 0.32, -0.13]], 0.009, 0.009, gold, gold, { seg: 6 });
    strand(b, [[s * 0.435, 0.38, 0.13], [s * 0.33, 0.44, 0.13], [s * 0.2, 0.44, 0.13]], 0.007, 0.007, gold, gold, { seg: 6 });
    for (let i = 0; i < 3; i++) b.add(geo.cyl(0.008, 0.008, 0.006, 6), gold, { p: [s * (0.24 + i * 0.05), 0.395 - i * 0.012, 0.13], r: [HALF_PI, 0, 0] });
    b.add(geo.rbox(0.05, 0.016, 0.06, 0.005), gold, { p: [s * 0.33, 0.44, 0.02], r: [0, 0, s * -0.55] });
    // Brusttaschen mit Klappe / chest pockets with flap
    b.add(geo.rbox(0.11, 0.09, 0.02, 0.008), shade(green, 0.85), { p: [s * 0.17, 0.2, 0.205] });
    b.add(geo.rtaper(0.12, 0.024, 0.115, 0.02, 0.035, 0.006), shade(green, 0.7), { p: [s * 0.17, 0.25, 0.212] });
    button(b, [s * 0.17, 0.24, 0.226], gold, 0.008);
    stitch(b, [s * 0.12, 0.16, 0.217], [s * 0.22, 0.16, 0.217], 7, shade(green, 0.55), 0.01);
  }
  for (const s of [-1, 1]) b.add(geo.rtaper(0.14, 0.05, 0.12, 0.04, 0.16, 0.01), shade(green, 0.6), { p: [s * 0.085, 0.45, 0.05], r: [-0.1, s * -0.6, s * -0.12] });
  b.add(geo.rbox(0.03, 0.32, 0.02, 0.006), gold, { p: [0.0, 0.17, 0.222] });
  addEmblem(b, 'dravon', 0.05, 0.012, gold, { p: [-0.17, 0.33, 0.2] });
  // Kehlkopfmikrofon / throat mic
  neck(b, black, { r: 0.088, y0: 0.36, h: 0.2, shadow: shade(black, 1.4) });
  b.add(geo.rbox(0.06, 0.04, 0.035, 0.01), mat.darkMid, { p: [0.0, 0.47, 0.085] });
  for (const s of [-1, 1]) b.add(geo.cyl(0.012, 0.012, 0.01, 12), mat.dark, { p: [s * 0.02, 0.47, 0.105], r: [HALF_PI, 0, 0] });
  strand(b, [[0.03, 0.47, 0.09], [0.1, 0.43, 0.13], [0.14, 0.38, 0.17]], 0.005, 0.005, mat.dark, mat.dark);
  // ---- Kopf mit Sturmhaube: nur der Augenschlitz zeigt Haut / head in a balaclava: only the eye slit shows skin ----
  const S = new Sculpt([0, 0.665, 0.03], [0.162, 0.19, 0.168], {
    jaw: 0.2, chin: 0.1, socket: 0.12, brow: 0.08, cheek: 0.06, noseBridge: 0.07, noseLen: 0.14, noseW: 1.1, noseY: -0.24,
    lipU: 0.012, lipL: 0.015, mouthDepth: 0.015, frown: 1.2, eyeY: 0.08,
    bumps: [
      // Wulst am Schlitzrand / rolled rim at the slit
      { c: [0, 0.3, 0.9], s: [0.55, 0.035, 0.5], a: 0.035 },
      { c: [0, -0.07, 0.95], s: [0.55, 0.03, 0.5], a: 0.03 },
    ],
  });
  const slitTop = (x: number) => 0.13 + 0.25 * Math.abs(x);
  const scar = mix(skin, mat.white, 0.45);
  b.addSmooth(S.mesh(skin, {
    paint: (p) => {
      const inSlit = p.z > 0.45 && p.y < slitTop(p.x) && p.y > -0.05 && Math.abs(p.x) < 0.62;
      if (inSlit) {
        return col(skin);
      }
      // Strickmuster: feine Rippen / knit pattern: fine ribs
      const rib = Math.sin(p.x * 90) > 0.7 && p.y < -0.05 ? 1.25 : 1;
      return shade(black, rib * (1 + 0.25 * smoothstep(0.3, 1, p.y)));
    },
  }));
  ear(b, S, -1, black, { size: 0.9 });
  ear(b, S, 1, black, { size: 0.9 });
  const pale = mix(mat.white, mat.glass, 0.6);
  eye(b, S, -1, { iris: pale, lid: 80, lower: 72, tilt: 0.3, lidCol: skin, look: [0.25, 0], irisSize: 0.9 });
  eye(b, S, 1, { iris: pale, lid: 82, lower: 72, tilt: 0.3, lidCol: skin, look: [0.25, 0], irisSize: 0.9 });
  // helle Narbe quer ueber Lid und Schlitz, mit Stichen / light scar across lid and slit, with stitch marks
  const ex = S.f.eyeX, ey = S.f.eyeY, lidR = 0.2 * 1.08;
  const scarLift = (x: number, y: number) => {
    const d = Math.hypot(x - ex, y - ey);
    return Math.max(0.014, Math.sqrt(Math.max(0, lidR * lidR - d * d)) - 0.11 + 0.016);
  };
  const scarPts: V3[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, x = 0.25 + t * 0.22, y = 0.25 - t * 0.33;
    scarPts.push(S.surf(x, y, scarLift(x, y)));
  }
  strand(b, scarPts, S.len(0.022), S.len(0.02), scar, scar, { seg: 6, flat: 0.35, brush: true, samples: 40, up: new THREE.Vector3(0.4, 0.1, 1).normalize() });
  for (const t of [0.2, 0.45, 0.75]) {
    const x = 0.25 + t * 0.22, y = 0.25 - t * 0.33;
    strand(b, [S.surf(x - 0.035, y - 0.025, scarLift(x - 0.035, y - 0.025) + 0.004), S.surf(x + 0.035, y + 0.025, scarLift(x + 0.035, y + 0.025) + 0.004)], S.len(0.008), S.len(0.008), shade(scar, 0.85), shade(scar, 0.85), { seg: 4, samples: 6 });
  }
  // Gasmaskenfilter vor dem Mund / gas mask filter over the mouth
  const m = S.surf(0, -0.5, 0.02);
  b.add(geo.rtaper(0.16, 0.1, 0.1, 0.06, 0.1, 0.022), mat.darkMid, { p: [m[0], m[1], m[2]], r: [HALF_PI - 0.3, 0, 0] });
  b.cyl(0.046, 0.05, 0.06, 40, mat.dark, [m[0], m[1] - 0.012, m[2] + 0.06], [HALF_PI - 0.25, 0, 0]);
  for (let i = 0; i < 7; i++) b.add(geo.rbox(0.07, 0.005, 0.01, 0.002), mat.ink, { p: [m[0], m[1] - 0.04 + i * 0.011, m[2] + 0.092], r: [-0.25, 0, 0] });
  b.add(geo.torus(0.048, 0.007, 8, 40), gold, { p: [m[0], m[1] - 0.012, m[2] + 0.088], r: [-0.25, 0, 0] });
  for (const s of [-1, 1]) {
    b.cyl(0.03, 0.03, 0.055, 32, mat.dark, [s * 0.1, m[1] - 0.025, m[2] - 0.01], [0, 0, s * 1.2]);
    b.add(geo.torus(0.03, 0.005, 6, 28), gold, { p: [s * 0.123, m[1] - 0.035, m[2] - 0.01], r: [0, s * HALF_PI, s * 1.2 - HALF_PI] });
    for (let i = 0; i < 4; i++) b.add(geo.torus(0.026, 0.003, 4, 20), mat.ink, { p: [s * (0.09 + i * 0.008), m[1] - 0.022 + i * 0.002, m[2] - 0.01], r: [0, s * HALF_PI, s * 1.2 - HALF_PI] });
  }
  // Goldmarke auf der Stirn / gold tag on the forehead
  b.add(geo.rbox(0.05, 0.022, 0.012, 0.004), gold, { p: S.surf(0, 0.5, 0.03), r: [-0.5, 0, 0] });
  addEmblem(b, 'dravon', 0.009, 0.004, black, { p: S.surf(0, 0.5, 0.075), r: [-0.5, 0, 0] });
}

// ---------- Alvenia: Praesidentin Liora Valen ----------

function alvenia(b: Builder, L: Look) {
  const blue = L.primary, white = L.secondary, gold = mat.gold, hair = mat.dark, hairL = mat.darkMid;
  const skin = skinOf(1.0, 0.05);
  torso(b, blue, { w: 0.41, d: 0.2, slope: 0.08, neckR: 0.09 });
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.13, 0.03, 0.07, 0.03, 0.26, 0.008), white, { p: [s * 0.07, 0.3, 0.2], r: [0.1, s * 0.15, s * 0.3] });
    stitch(b, [s * 0.02, 0.42, 0.22], [s * 0.12, 0.2, 0.225], 8, shade(white, 0.75));
    fold(b, [[s * 0.3, 0.04, 0.17], [s * 0.27, 0.13, 0.19], [s * 0.24, 0.2, 0.19]], 0.012, shade(blue, 0.8));
  }
  b.add(geo.rbox(0.08, 0.6, 0.02, 0.008), white, { p: [0.02, 0.2, 0.215], r: [0.05, 0, 0.75] });
  b.add(geo.rbox(0.03, 0.62, 0.022, 0.004), blue, { p: [0.02, 0.2, 0.216], r: [0.05, 0, 0.75] });
  b.add(geo.cyl(0.042, 0.042, 0.016, 32), gold, { p: [0.2, 0.06, 0.212], r: [HALF_PI, 0, 0] });
  addEmblem(b, 'alvenia', 0.032, 0.008, white, { p: [0.2, 0.06, 0.222] });
  for (const y of [0.06, 0.13, 0.2]) button(b, [-0.05, y, 0.222], gold, 0.012, 'alvenia');
  for (const s of [-1, 1]) epaulette(b, s, white, gold, 0.36, 0.29, 1, gold);
  // Olivenzweig-Anstecknadel mit Taube / olive branch pin with dove
  b.group({ p: [-0.19, 0.3, 0.212], r: [0, 0, 0.4] }, () => {
    strand(b, [[-0.04, -0.005, 0], [0, 0.004, 0.003], [0.045, 0, 0]], 0.0035, 0.002, mat.wood, mat.wood, { seg: 5 });
    for (let i = 0; i < 6; i++) blob(b, mat.green, { p: [-0.032 + i * 0.013, (i % 2 ? 1 : -1) * 0.009, 0.004], s: [0.012, 0.005, 0.004], r: [0, 0, (i % 2 ? 1 : -1) * 0.5] }, 12, 8);
    blob(b, mat.white, { p: [0.05, 0.012, 0.004], s: [0.016, 0.009, 0.006] }, 14, 10);
    blob(b, mat.white, { p: [0.06, 0.022, 0.004], s: [0.007, 0.007, 0.005] }, 10, 8);
    blob(b, mat.white, { p: [0.045, 0.022, 0.006], s: [0.012, 0.004, 0.004], r: [0, 0, 0.8] }, 10, 8);
  });
  b.add(geo.cyl(0.1, 0.11, 0.05, 48, true), white, { p: [0, 0.43, 0.0] });
  neck(b, skin, { r: 0.066, y0: 0.36, h: 0.2 });
  // ---- Kopf: ruhig, selbstsicheres Halblaecheln / head: calm, confident half-smile ----
  const S = new Sculpt([0, 0.665, 0.03], [0.152, 0.178, 0.158], {
    jaw: 0.44, chin: 0.12, chinDown: 0.0, lowY: -0.06, socket: 0.09, brow: 0.03, cheek: 0.11, temple: 0.02,
    noseBridge: 0.1, noseLen: 0.25, noseW: 0.82, noseY: -0.19, lipU: 0.012, lipL: 0.016, mouthDepth: 0, mouthW: 0.44, mouthY: -0.46,
    smile: 0.06, asym: 0.03, fold: 0.0, eyeY: 0.1,
  });
  b.addSmooth(S.mesh(skin, { hair: { c: hair, at: (p) => (p.y + 0.35 * (1 - p.z) > 0.5 ? 1 : 0) } }));
  faceInk(b, S, { nose: 0.85, smile: 1, chin: 0.9, cheek: 0.55 });
  lips(b, S, { c: mix(skin, mat.red, 0.6), cl: mix(skin, mat.red, 0.5), hU: 0.04, hL: 0.055, thick: 0.05, bow: 0.012 });
  ear(b, S, -1, skin, { size: 0.85 });
  ear(b, S, 1, skin, { size: 0.85 });
  const iris = mix(mat.wood, mat.green, 0.45);
  for (const s of [-1, 1] as const) eye(b, S, s, { iris, lid: 69, lower: 60, tilt: -0.06, lidCol: skin, lashes: true, look: [0.2, 0], r: 0.16, irisSize: 1.05 });
  for (const s of [-1, 1] as const) browStrands(b, S, s, { c: hair, n: 14, thick: 0.022, ang: -0.02, arch: 0.06, w: 0.33, wild: 0.01, y: 0.29 });
  // kurzer Bob mit Pony / short bob with fringe
  blob(b, hair, { p: [0, 0.69, -0.03], s: [0.168, 0.19, 0.16] }, 44, 32);
  for (let i = 0; i < 34; i++) {
    const a = -2.6 + (i / 33) * 5.2;
    if (Math.abs(a) < 0.75) continue;
    const sx = Math.sin(a), cz = Math.cos(a);
    const endY = -0.45 + Math.abs(Math.sin(a)) * 0.05;
    hairLock(b, S, [[sx * 0.2, 1, cz * 0.2], [sx * 0.85, 0.45, cz * 0.85], [sx, -0.1, cz], [sx * 0.95, endY, cz * 0.95], [sx * 0.78, endY - 0.08, cz * 0.78]], 0.07, 0.07, 0.025, hair, hairL);
  }
  // Pony seitlich gekaemmt / fringe swept to one side
  for (let i = 0; i < 11; i++) {
    const x = -0.55 + i * 0.1;
    hairLock(b, S, [[x * 0.3 - 0.1, 1, 0.15], [x * 0.7 - 0.05, 0.75, 0.6], [x + 0.06, 0.48, 0.86], [x + 0.13, 0.4, 0.88]], 0.05, 0.06, 0.02, hair, hairL);
  }
  // blaues Barett, schraeg / blue beret, tilted
  b.group({ p: [0.03, 0.845, -0.005], r: [0.1, 0, -0.25] }, () => {
    blob(b, blue, { s: [0.205, 0.068, 0.205] }, 48, 18);
    blob(b, shade(blue, 1.08), { p: [-0.03, 0.03, 0.02], s: [0.15, 0.05, 0.15] }, 48, 18);
    b.add(geo.torus(0.168, 0.018, 10, 64), shade(blue, 0.75), { p: [0, -0.03, 0], r: [HALF_PI, 0, 0] });
    stitch(b, [-0.15, -0.012, 0.09], [0.15, -0.012, 0.09], 12, shade(blue, 0.6));
    blob(b, shade(blue, 0.8), { p: [0, 0.07, 0], s: 0.02 }, 12, 8);
    b.add(geo.cyl(0.045, 0.045, 0.014, 32), gold, { p: [-0.085, 0.0, 0.15], r: [HALF_PI - 0.4, 0, 0.25] });
    addEmblem(b, 'alvenia', 0.038, 0.008, white, { p: [-0.085, 0.004, 0.158], r: [-0.4, 0, 0.25] });
  });
}

// ---------- Meridon: Admiralin Coralie Nerezza ----------

function meridon(b: Builder, L: Look) {
  const teal = L.primary, gold = mat.gold, hair = shade(mat.wood, 0.7), hairL = shade(mat.wood, 0.95), orange = L.secondary;
  const skin = skinOf(0.95, 0.12);
  torso(b, teal, { w: 0.42, d: 0.2, slope: 0.07 });
  for (const s of [-1, 1]) {
    b.add(geo.profileXY([[0, 0.42], [0.2, 0.36], [0.24, 0.24], [0.12, 0.0], [0.03, 0.05]], 0.03), shade(teal, 0.72), { p: [s * 0.02, 0.0, 0.19], s: [s, 1, 1], r: [0.08, 0, 0] });
    b.add(geo.profileXY([[0.2, 0.36], [0.215, 0.37], [0.255, 0.24], [0.24, 0.24]], 0.034), gold, { p: [s * 0.02, 0.0, 0.19], s: [s, 1, 1], r: [0.08, 0, 0] });
    stitch(b, [s * 0.06, 0.04, 0.225], [s * 0.2, 0.33, 0.21], 12, gold, 0.01);
    for (const y of [0.05, 0.12, 0.19]) button(b, [s * 0.17, y, 0.215], gold, 0.013, 'meridon');
    epaulette(b, s, gold, gold, 0.37, 0.3, 2, orange);
    // goldene Aermelstreifen am Schulterrand / gold braid at the shoulder edge
    for (let i = 0; i < 3; i++) fold(b, [[s * 0.4, 0.15 + i * 0.03, 0.12], [s * 0.43, 0.17 + i * 0.03, 0.0], [s * 0.4, 0.15 + i * 0.03, -0.12]], 0.006, gold);
  }
  b.add(geo.rtaper(0.14, 0.06, 0.06, 0.04, 0.14, 0.015), orange, { p: [0, 0.38, 0.14], r: [0.2, 0, 0] });
  blob(b, orange, { p: [0, 0.43, 0.13], s: 0.032 });
  for (const s of [-1, 1]) fold(b, [[0, 0.43, 0.14], [s * 0.04, 0.38, 0.17], [s * 0.05, 0.3, 0.19]], 0.012, shade(orange, 0.85));
  addEmblem(b, 'meridon', 0.045, 0.01, gold, { p: [-0.18, 0.3, 0.21] });
  neck(b, skin, { r: 0.064, y0: 0.36, h: 0.2 });
  // ---- Kopf: schiefes Grinsen, zugekniffenes Auge / head: sly lopsided grin, squinting eye ----
  const S = new Sculpt([0, 0.665, 0.03], [0.15, 0.178, 0.156], {
    jaw: 0.42, chin: 0.15, chinDown: 0.05, socket: 0.1, brow: 0.04, cheek: 0.12, temple: 0.03,
    noseBridge: 0.11, noseLen: 0.27, noseW: 0.78, noseY: -0.2, lipU: 0.012, lipL: 0.016, mouthDepth: 0, mouthW: 0.46, mouthY: -0.47, lowY: -0.05,
    smile: 0.03, asym: 0.07, fold: 0.0, eyeY: 0.1,
    bumps: [{ c: [0.45, -0.25, 0.8], s: [0.12, 0.1, 0.3], a: 0.04 }],
  });
  b.addSmooth(S.mesh(skin, { hair: { c: hair, at: (p) => (p.y + 0.35 * (1 - p.z) > 0.48 ? 1 : 0) } }));
  faceInk(b, S, { nose: 0.85, smile: 1.2, chin: 0.9, cheek: 0.65 });
  lips(b, S, { c: mix(skin, mat.red, 0.65), cl: mix(skin, mat.red, 0.55), hU: 0.038, hL: 0.05, thick: 0.05, bow: 0.012 });
  ear(b, S, -1, skin, { size: 0.85 });
  ear(b, S, 1, skin, { size: 0.85 });
  b.add(geo.torus(0.024, 0.005, 8, 28), gold, { p: [0.15, 0.6, 0.02], r: [0, HALF_PI, 0] });
  blob(b, gold, { p: [0.153, 0.572, 0.02], s: 0.008 }, 12, 8);
  const iris = mix(teal, mat.wood, 0.35);
  // rechtes Auge weit offen mit hochgezogener Braue, linkes zusammengekniffen hinter dem Monokel
  // right eye wide open with raised brow, left squinting behind the monocle
  const lc = eye(b, S, -1, { iris, lid: 84, lower: 76, tilt: 0.15, lidCol: skin, lashes: true, look: [0.4, 0] });
  eye(b, S, 1, { iris, lid: 62, lower: 60, tilt: -0.05, lidCol: skin, lashes: true, look: [0.4, 0] });
  browStrands(b, S, -1, { c: hair, n: 13, thick: 0.022, ang: 0.12, arch: 0.02, w: 0.32, y: 0.26 });
  browStrands(b, S, 1, { c: hair, n: 13, thick: 0.022, ang: -0.04, arch: 0.08, w: 0.32, y: 0.34 });
  // Monokel mit Kette / monocle with chain
  const mp: V3 = [lc[0], lc[1], lc[2] + S.len(0.2)];
  b.add(geo.torus(0.042, 0.0065, 10, 48), gold, { p: mp });
  // Glanz auf dem Glas als Bogen / glint on the glass as an arc
  for (let k = 0; k < 5; k++) {
    const a = 2.0 + k * 0.18;
    blob(b, mat.white, { p: [mp[0] + Math.cos(a) * 0.03, mp[1] + Math.sin(a) * 0.03, mp[2] + 0.002], s: [0.004, 0.004, 0.002] }, 8, 6);
  }
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    b.add(geo.torus(0.0065, 0.0018, 4, 10), gold, { p: [mp[0] - 0.04 - t * 0.11, mp[1] - 0.025 - t * 0.38 + Math.sin(t * Math.PI) * 0.035, mp[2] - 0.03 + t * 0.06], r: [0, i % 2 ? HALF_PI : 0, 0] });
  }
  // Schoenheitsfleck / beauty mark
  blob(b, mat.dark, { p: S.surf(0.3, -0.35, 0.005), s: 0.005 }, 8, 6);
  // langes Haar, Mittelscheitel, Zopf ueber der Schulter / long hair, centre parting, braid over the shoulder
  blob(b, hair, { p: [0, 0.69, -0.045], s: [0.165, 0.188, 0.155] }, 44, 32);
  for (let i = 0; i < 24; i++) {
    const a = -2.7 + (i / 23) * 5.4;
    if (Math.abs(a) < 0.85) continue;
    const sx = Math.sin(a), cz = Math.cos(a);
    hairLock(b, S, [[0.02 * Math.sign(sx), 1, 0.1], [sx * 0.75, 0.6, cz * 0.75], [sx, 0.0, cz], [sx * 0.9, -0.55, cz * 0.9 - 0.15]], 0.07, 0.075, 0.03, hair, hairL);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    hairLock(b, S, [[s * 0.03, 1, 0.12], [s * (0.35 + i * 0.12), 0.75, 0.55], [s * (0.6 + i * 0.08), 0.42, 0.7]], 0.05, 0.06, 0.02, hair, hairL);
  }
  // Zopf aus ineinandergreifenden Gliedern / braid of interlocking lobes
  const braid = new THREE.CatmullRomCurve3([new THREE.Vector3(0.14, 0.58, -0.02), new THREE.Vector3(0.19, 0.46, 0.06), new THREE.Vector3(0.22, 0.32, 0.14), new THREE.Vector3(0.24, 0.17, 0.19)]);
  const nL = 14;
  for (let i = 0; i < nL; i++) {
    const t = i / (nL - 1);
    const p = braid.getPointAt(t), tan = braid.getTangentAt(t);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    const e = new THREE.Euler().setFromQuaternion(q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), i % 2 ? 0.55 : -0.55)));
    const r = 0.034 - t * 0.01;
    blob(b, i % 2 ? hair : shade(hair, 0.85), { p: [p.x + (i % 2 ? 0.008 : -0.008), p.y, p.z], r: [e.x, e.y, e.z], s: [r * 0.75, r * 1.25, r * 0.7] }, 18, 12);
  }
  b.add(geo.cyl(0.02, 0.016, 0.03, 24), orange, { p: [0.24, 0.155, 0.19] });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    strand(b, [[0.24, 0.14, 0.19], [0.24 + Math.cos(a) * 0.012, 0.11, 0.19 + Math.sin(a) * 0.012], [0.24 + Math.cos(a) * 0.022, 0.07, 0.19 + Math.sin(a) * 0.02]], 0.007, 0.002, hair, hairL, { seg: 5 });
  }
  // Dreispitz mit Goldkante / tricorn with gold trim
  b.group({ p: [0, 0.81, -0.005], r: [0.06, 0, 0.08] }, () => {
    blob(b, teal, { p: [0, 0.03, 0], s: [0.158, 0.12, 0.158] }, 36, 24);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI;
      b.group({ r: [0, a, 0] }, () => {
        b.add(geo.profileXY([[-0.2, 0], [0.2, 0], [0.16, 0.1], [0, 0.08], [-0.16, 0.1]], 0.018), shade(teal, 0.85), { p: [0, -0.02, -0.15], r: [0.25, 0, 0] });
        b.add(geo.profileXY([[-0.16, 0.1], [0, 0.08], [0.16, 0.1], [0.165, 0.115], [0, 0.095], [-0.165, 0.115]], 0.022), gold, { p: [0, -0.02, -0.15], r: [0.25, 0, 0] });
      });
    }
    blob(b, orange, { p: [0.12, 0.06, 0.1], s: [0.036, 0.036, 0.022] });
    addEmblem(b, 'meridon', 0.03, 0.006, gold, { p: [0.12, 0.06, 0.122] });
    for (let i = 0; i < 4; i++) strand(b, [[-0.08, 0.06, -0.05], [-0.12 - i * 0.012, 0.13 + i * 0.01, -0.1], [-0.2 - i * 0.012, 0.16 + i * 0.012, -0.16]], 0.006, 0.002, mat.white, shade(mat.white, 0.85), { seg: 5 });
  });
}

// ---------- Velkar: Direktor Aurel Kesh ----------

function velkar(b: Builder, L: Look) {
  const coat = mix(mat.paper, L.primary, 0.35), armour = L.gear, green = L.secondary, hair = mat.paper, hairD = shade(mat.paper, 0.82);
  const skin = skinOf(0.98, 0.04);
  torso(b, coat, { w: 0.39, d: 0.19, slope: 0.1, neckR: 0.08 });
  b.add(geo.rtaper(0.3, 0.06, 0.24, 0.05, 0.36, 0.02), armour, { p: [0, 0.2, 0.18] });
  for (let i = 0; i < 3; i++) b.add(geo.rbox(0.26 - i * 0.03, 0.012, 0.05, 0.004), shade(armour, 1.4), { p: [0, 0.08 + i * 0.09, 0.21] });
  for (const [x, y] of [[-0.12, 0.05], [0.12, 0.05], [-0.1, 0.34], [0.1, 0.34]]) b.add(geo.cyl(0.008, 0.008, 0.008, 6), shade(armour, 1.6), { p: [x, y, 0.214], r: [HALF_PI, 0, 0] });
  addEmblem(b, 'velkar', 0.06, 0.014, green, { p: [0, 0.26, 0.218] });
  for (const s of [-1, 1]) {
    b.add(geo.profileXY([[0, 0.4], [0.07, 0.42], [0.2, 0.2], [0.17, 0.0], [0.13, 0.0], [0.15, 0.18]], 0.03), shade(coat, 0.88), { p: [s * 0.03, 0.0, 0.18], s: [s, 1, 1] });
    stitch(b, [s * 0.11, 0.41, 0.212], [s * 0.21, 0.21, 0.212], 9, shade(coat, 0.7));
    fold(b, [[s * 0.33, 0.05, 0.15], [s * 0.3, 0.15, 0.17], [s * 0.31, 0.25, 0.15]], 0.012, shade(coat, 0.85));
  }
  b.add(geo.rbox(0.08, 0.07, 0.02, 0.006), shade(coat, 0.92), { p: [0.25, 0.2, 0.18] });
  for (const [x, c] of [[0.23, mat.dark], [0.25, green], [0.27, mat.blue]] as [number, ColorLike][]) {
    b.cyl(0.006, 0.006, 0.06, 10, c, [x, 0.25, 0.185]);
    b.cyl(0.003, 0.003, 0.025, 6, mat.metalLight, [x + 0.006, 0.255, 0.19]);
  }
  b.add(geo.rbox(0.05, 0.07, 0.01, 0.004), mat.white, { p: [-0.24, 0.25, 0.19] });
  b.box(0.04, 0.006, 0.006, green, [-0.24, 0.27, 0.196]);
  for (let i = 0; i < 3; i++) b.box(0.032, 0.003, 0.004, mat.dark, [-0.24, 0.25 - i * 0.01, 0.196]);
  b.add(geo.cyl(0.075, 0.08, 0.04, 48), armour, { p: [0, 0.42, -0.01] });
  neck(b, skin, { r: 0.056, y0: 0.38, h: 0.2, adam: 0.45 });
  // ---- schmaler alter Kopf, analytischer Blick / narrow old head, analytical look ----
  const S = new Sculpt([0, 0.665, 0.03], [0.128, 0.2, 0.15], {
    jaw: 0.36, chin: 0.26, chinDown: 0.1, lowY: 0.12, socket: 0.13, brow: 0.08, cheek: 0.12, hollow: 0.1, temple: 0.06, flat: 0.1,
    noseBridge: 0.16, noseLen: 0.42, noseW: 0.78, noseY: -0.27, lipU: 0.01, lipL: 0.012, mouthDepth: 0, mouthW: 0.34, mouthY: -0.6,
    smile: -0.015, asym: 0.03, fold: 0.035, age: 1.4, frown: 0.6, eyeY: 0.1,
    bumps: [
      // Hakennase: Hoecker und nach unten gezogene Spitze / hooked nose: hump and drooping tip
      { c: [0, -0.06, 1], s: [0.05, 0.06, 0.3], a: 0.07 },
      { c: [0, -0.33, 1], s: [0.05, 0.04, 0.3], a: 0.09 },
    ],
  });
  b.addSmooth(S.mesh(skin));
  faceInk(b, S, { nose: 1.15, fold: 1, age: 1.2, bags: 1, frown: 0.8, cheek: 1.1, chin: 0.7 });
  lips(b, S, { c: shade(skin, 0.8), hU: 0.022, hL: 0.03, thick: 0.035, bow: 0.006 });
  ear(b, S, -1, skin, { size: 1.05 });
  ear(b, S, 1, skin, { size: 1.05 });
  const iris = mix(green, mat.dark, 0.35);
  eye(b, S, -1, { iris, lid: 63, lower: 64, tilt: -0.08, lidCol: skin, look: [-0.35, 0.05], r: 0.185 });
  eye(b, S, 1, { iris, lid: 78, lower: 66, tilt: 0.1, lidCol: skin, look: [-0.35, 0.05], r: 0.185 });
  // linke Braue weit hochgezogen / left brow raised high
  browStrands(b, S, -1, { c: mat.concreteLight, c1: hair, n: 18, thick: 0.048, ang: -0.12, arch: 0.15, w: 0.34, wild: 0.06, y: 0.44 });
  browStrands(b, S, 1, { c: mat.concreteLight, c1: hair, n: 18, thick: 0.048, ang: 0.16, arch: 0.01, w: 0.34, wild: 0.06, y: 0.27 });
  // Spitzbart / goatee
  const R = mulberry(8);
  for (let i = 0; i < 18; i++) {
    const x = (R() - 0.5) * 0.2, y = -0.72 - R() * 0.06;
    strand(b, [S.surf(x, y, 0.01), S.surf(x * 0.6, y - 0.12, 0.08), [S.surf(0, -0.95, 0.12)[0] + x * 0.05, S.surf(0, -0.95, 0.12)[1] - 0.025, S.surf(0, -0.95, 0.12)[2] + 0.01]], S.len(0.035), S.len(0.006), hairD, hair, { seg: 5 });
  }
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) strand(b, [S.surf(s * (0.08 + i * 0.02), -0.47, 0.01), S.surf(s * (0.16 + i * 0.02), -0.52, 0.03), S.surf(s * (0.22 + i * 0.02), -0.6, 0.02)], S.len(0.025), S.len(0.006), hair, hairD, { seg: 5 });
  // Halbglatze mit wilden weissen Seitenbueschen / balding with wild white side tufts
  for (const s of [-1, 1]) for (let i = 0; i < 26; i++) {
    const yy = 0.45 - (i % 9) * 0.07, zz = 0.1 - Math.floor(i / 9) * 0.35 - (i % 9) * 0.02;
    const root = S.dir([s * 0.95, yy, zz], 0.01);
    const out = new THREE.Vector3(s * (0.7 + R() * 0.5), 0.2 + (R() - 0.3) * 0.9, (R() - 0.6) * 0.6).normalize();
    const L1 = 0.05 + R() * 0.06;
    const mid: V3 = [root[0] + out.x * L1 * 0.5, root[1] + out.y * L1 * 0.5 + 0.01, root[2] + out.z * L1 * 0.5];
    const tip: V3 = [root[0] + out.x * L1, root[1] + out.y * L1 + (R() - 0.5) * 0.03, root[2] + out.z * L1];
    strand(b, [root, mid, tip], 0.012, 0.002, hairD, hair, { seg: 5 });
  }
  for (let i = 0; i < 12; i++) {
    const a = -1.2 + i * 0.22;
    hairLock(b, S, [[Math.sin(a), 0.35, Math.cos(a) * -1], [Math.sin(a) * 1.02, 0.0, -Math.cos(a)], [Math.sin(a) * 0.95, -0.3, -Math.cos(a) * 0.9]], 0.05, 0.06, 0.015, hair, hairD);
  }
  // Rundbrille auf der Stirn mit Band / round goggles on the forehead with strap
  b.add(geo.torus(0.146, 0.012, 8, 64), mat.dark, { p: [0, 0.79, 0.025], r: [HALF_PI + 0.15, 0, 0], s: [1, 1.08, 1] });
  for (const s of [-1, 1]) {
    const p = S.surf(s * 0.3, 0.62, 0.17);
    b.group({ p, r: [-0.8, s * 0.3, 0] }, () => {
      b.cyl(0.042, 0.046, 0.036, 40, L.primary, [0, 0, 0], [HALF_PI, 0, 0]);
      b.add(geo.torus(0.042, 0.009, 8, 40), mat.dark, { p: [0, 0, 0.018] });
      for (let k = 0; k < 6; k++) b.add(geo.cyl(0.004, 0.004, 0.006, 6), mat.metalLight, { p: [Math.cos(k) * 0.042, Math.sin(k) * 0.042, 0.024], r: [HALF_PI, 0, 0] });
      b.cyl(0.035, 0.035, 0.004, 40, mix(green, mat.glass, 0.5), [0, 0, 0.021], [HALF_PI, 0, 0]);
      blob(b, mat.white, { p: [-0.013, 0.013, 0.024], s: [0.008, 0.008, 0.002] }, 10, 8);
    });
  }
  b.add(geo.rbox(0.03, 0.018, 0.02, 0.005), mat.dark, { p: S.surf(0, 0.62, 0.12) });
  // Headset mit Mikrofon und Antenne / headset with mic and antenna
  b.cyl(0.042, 0.042, 0.036, 32, mat.darkMid, [0.148, 0.655, 0.01], [0, 0, HALF_PI]);
  b.cyl(0.027, 0.027, 0.006, 24, green, [0.168, 0.655, 0.01], [0, 0, HALF_PI]);
  strand(b, [[0.15, 0.635, 0.04], [0.13, 0.57, 0.12], [0.08, 0.55, 0.17]], 0.005, 0.005, mat.dark, mat.dark);
  blob(b, mat.dark, { p: [0.075, 0.548, 0.172], s: [0.016, 0.012, 0.012] });
  strand(b, [[0.15, 0.69, 0.0], [0.16, 0.82, -0.02], [0.17, 0.95, -0.04]], 0.004, 0.003, mat.dark, mat.dark);
  b.add(geo.ico(0.016, 2), green, { p: [0.17, 0.955, -0.04] });
}

// ---------- Zyrr: Schwarmmutter Xyl'Tharra ----------

function zyrr(b: Builder, L: Look) {
  const skin = mat.alienSkin, violet = L.primary, acid = mat.acid, glow = mat.xenoGlow;
  torso(b, shade(violet, 0.7), { w: 0.38, d: 0.19, slope: 0.12, neckR: 0.07 });
  for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
    const a = -1.3 + (i / 8) * 2.6, r = 0.36 - row * 0.07;
    const y = 0.27 + row * 0.07;
    b.add(geo.rtaper(0.12, 0.05, 0.05, 0.02, 0.16, 0.02, 0.02), row % 2 ? violet : shade(violet, 1.2), { p: [Math.sin(a) * r, y, Math.cos(a) * r * 0.6 - 0.04], r: [0.5, a, 0] });
    if (row === 0) blob(b, acid, { p: [Math.sin(a) * (r + 0.03), y - 0.02, Math.cos(a) * (r + 0.03) * 0.6 - 0.02], s: 0.012 }, 12, 8);
  }
  for (let i = 0; i < 5; i++) fold(b, [[-0.2 + i * 0.1, 0.02, 0.17], [-0.19 + i * 0.095, 0.12, 0.19], [-0.17 + i * 0.085, 0.2, 0.17]], 0.01, shade(violet, 0.5));
  addEmblem(b, 'zyrr', 0.05, 0.012, acid, { p: [0, 0.14, 0.215] });
  b.add(geo.torus(0.07, 0.008, 8, 32), glow, { p: [0, 0.14, 0.208] });
  neck(b, skin, { r: 0.052, y0: 0.36, h: 0.24 });
  for (let i = 0; i < 4; i++) fold(b, [[-0.05, 0.43 + i * 0.04, 0.035], [0, 0.42 + i * 0.04, 0.05], [0.05, 0.43 + i * 0.04, 0.035]], 0.006, shade(skin, 0.75));
  // ---- grosser Fremdwesenkopf / large alien head ----
  const S = new Sculpt([0, 0.7, 0.03], [0.19, 0.21, 0.17], {
    jaw: 0.58, chin: 0.1, chinDown: 0.12, back: 0.25, crown: 0.22, socket: 0.22, brow: 0.07, cheek: 0.05, temple: 0.05,
    noseBridge: 0.02, noseLen: 0.015, noseW: 0.6, noseY: -0.28, lipU: 0.008, lipL: 0.01, mouthW: 0.2, mouthY: -0.55, mouthDepth: 0.05,
    smile: -0.01, fold: 0.02, age: 0.8, frown: 0.8, ageGeo: 0.8, frownGeo: 0.8, eyeX: 0.37, eyeY: 0.0, nostrils: 0,
    grooves: [
      { a: [-0.35, 0.42], b: [0.35, 0.42], w: 0.015, d: 0.02 },
      { a: [-0.25, 0.55], b: [0.25, 0.55], w: 0.015, d: 0.018 },
      { a: [-0.6, -0.3], b: [-0.35, -0.5], w: 0.015, d: 0.02 },
      { a: [0.6, -0.3], b: [0.35, -0.5], w: 0.015, d: 0.02 },
    ],
  });
  const skinD = shade(skin, 0.7), mark = mix(acid, skin, 0.25);
  b.addSmooth(S.mesh(skin, {
    paint: (p, w) => {
      const c = col(skin).lerp(skinD, 0.5 * w.socket + 0.3 * smoothstep(0.2, -0.8, p.z));
      // Stirnzeichnung und Wangenpunkte / forehead marking and cheek dots
      if (Math.abs(p.x) < 0.035 && p.y > 0.3 && p.y < 0.8 && p.z > 0) return c.lerp(col(mark), 0.9);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) if (gauss(p, [s * (0.5 + k * 0.08), -0.25 - k * 0.06, 0.8], [0.03, 0.03, 0.3]) > 0.5) return c.lerp(col(mark), 0.8);
      return c.lerp(shade(skin, 0.5), smoothstep(0.4, 0.9, w.mouth));
    },
  }));
  // grosse glaenzende Mandelaugen / large glossy almond eyes
  for (const s of [-1, 1] as const) {
    const c = S.surf(s * 0.37, 0.0, 0.07);
    const ez = S.len(0.1);
    b.addSmooth(paint(new THREE.SphereGeometry(1, 64, 40), (p) => col(mat.ink).lerp(col(violet), smoothstep(-0.3, -0.95, p.y) * 0.3)), { p: c, s: [S.len(0.36), S.len(0.2), ez], r: [0.05, s * 0.35, s * 0.42] });
    blob(b, mat.white, { p: [c[0] - s * 0.012 - 0.008, c[1] + 0.016, c[2] + ez * 0.95], s: [0.013, 0.009, 0.004] }, 14, 10);
    blob(b, mat.white, { p: [c[0] + s * 0.016, c[1] - 0.002, c[2] + ez * 0.98], s: [0.005, 0.005, 0.003] }, 10, 8);
    blob(b, glow, { p: [c[0] + s * 0.025, c[1] - 0.014, c[2] + ez * 0.8], s: [0.014, 0.004, 0.003], r: [0, s * 0.4, s * 0.42] }, 12, 8);
    // Lidfalte ueber dem Auge / lid fold above the eye
    strand(b, [S.surf(s * 0.18, 0.12, 0.02), S.surf(s * 0.38, 0.2, 0.05), S.surf(s * 0.6, 0.16, 0.03)], S.len(0.03), S.len(0.012), shade(skin, 0.85), skin);
  }
  for (const s of [-1, 1]) blob(b, shade(skin, 0.45), { p: S.surf(s * 0.04, -0.3, 0.0), s: [0.003, 0.009, 0.003], r: [0, 0, s * 0.3] }, 8, 6);
  // Krone aus leuchtenden Stacheln / crown of glowing spines
  for (let i = 0; i < 13; i++) {
    const a = -1.5 + (i / 12) * 3.0;
    const len = 0.1 + (1 - Math.abs(a) / 1.5) * 0.12;
    const root = S.dir([Math.sin(a) * 0.5, 0.75, Math.cos(a) * 0.3 - 0.45], -0.02);
    const dirv = new THREE.Vector3(Math.sin(a) * 0.6, 1, -0.5).normalize();
    strand(b, [root, [root[0] + dirv.x * len * 0.5, root[1] + dirv.y * len * 0.5, root[2] + dirv.z * len * 0.5], [root[0] + dirv.x * len, root[1] + dirv.y * len + 0.01, root[2] + dirv.z * len - 0.02]], 0.026, 0.003, violet, i % 2 ? acid : glow, { seg: 10 });
  }
  // Fuehler / antennae
  for (const s of [-1, 1]) {
    const pts: V3[] = [S.dir([s * 0.4, 0.8, 0.3], -0.01), [s * 0.16, 0.97, 0.13], [s * 0.27, 1.02, 0.13], [s * 0.32, 0.97, 0.11]];
    strand(b, pts, 0.01, 0.005, skin, shade(skin, 1.15), { seg: 8 });
    b.add(geo.ico(0.022, 2), acid, { p: pts[3] });
  }
}

// ---------- Vesper: Prophet Malachar ----------

function vesper(b: Builder, L: Look) {
  const robe = L.jacket, red = L.primary, bone = mat.bone, ember = mat.ember;
  torso(b, robe, { w: 0.44, d: 0.21, slope: 0.05 });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) fold(b, [[s * (0.2 + i * 0.07), 0.02, 0.17 - i * 0.03], [s * (0.22 + i * 0.07), 0.2, 0.18 - i * 0.03], [s * (0.2 + i * 0.06), 0.36, 0.13 - i * 0.03]], 0.013, shade(robe, 0.6));
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.12, 0.03, 0.1, 0.03, 0.44, 0.01), red, { p: [s * 0.1, 0.22, 0.2], r: [0.08, 0, s * 0.12] });
    stitch(b, [s * 0.05, 0.03, 0.218], [s * 0.08, 0.42, 0.205], 14, ember, 0.008);
    b.add(geo.rbox(0.124, 0.014, 0.034, 0.004), ember, { p: [s * 0.1 - s * 0.025, 0.02, 0.21], r: [0, 0, s * 0.12] });
    addEmblem(b, 'vesper', 0.04, 0.01, bone, { p: [s * 0.095, 0.12, 0.222], r: [0, 0, s * 0.12] });
  }
  for (const [y0, y1] of [[0.3, 0.12], [0.24, 0.07]]) {
    const n = 22;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      b.add(geo.torus(0.013, 0.004, 6, 14), mat.metal, { p: [-0.32 + t * 0.64, y0 + (y1 - y0) * Math.sin(t * Math.PI), 0.215 - Math.abs(t - 0.5) * 0.06], r: [0, i % 2 ? HALF_PI : 0, 0] });
    }
  }
  b.group({ p: [0, 0.1, 0.23] }, () => {
    b.cyl(0.04, 0.045, 0.02, 24, mat.rustDark, [0, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      b.box(0.008, 0.08, 0.008, mat.rustDark, [Math.sin(a) * 0.035, 0.05, Math.cos(a) * 0.035]);
    }
    b.add(geo.ico(0.03, 2), ember, { p: [0, 0.05, 0] });
    b.add(geo.ico(0.018, 2), mat.yellow, { p: [0, 0.05, 0.012] });
    b.add(geo.cone(0.052, 0.04, 24), mat.rustDark, { p: [0, 0.11, 0] });
    b.add(geo.torus(0.012, 0.004, 4, 12), mat.rustDark, { p: [0, 0.14, 0] });
  });
  // tiefe Kapuze / deep hood
  const hoodC = mix(robe, red, 0.12);
  blob(b, hoodC, { p: [0, 0.665, -0.09], s: [0.25, 0.3, 0.25] }, 44, 32);
  b.add(geo.cone(0.14, 0.2, 32), hoodC, { p: [0, 0.94, -0.18], r: [-0.6, 0, 0] });
  b.add(geo.rtaper(0.5, 0.36, 0.34, 0.3, 0.14, 0.05), shade(robe, 1.1), { p: [0, 0.42, -0.02] });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) fold(b, [[s * (0.12 + i * 0.03), 0.92 - i * 0.04, 0.0], [s * (0.2 + i * 0.02), 0.72, 0.07], [s * (0.18 + i * 0.02), 0.5, 0.08]], 0.012, shade(hoodC, 0.7));
  blob(b, mat.ink, { p: [0, 0.65, -0.01], s: [0.18, 0.235, 0.18] }, 36, 24);
  b.add(geo.torus(0.188, 0.027, 10, 64), red, { p: [0, 0.655, 0.12], s: [1, 1.24, 1], r: [-0.12, 0, 0] });
  stitch(b, [-0.12, 0.88, 0.12], [0.12, 0.88, 0.12], 10, ember, 0.01);
  // ---- Gesicht: Knochenmaske oben, Kinn und Lippen sichtbar / face: bone mask on top, chin and lips visible ----
  const S = new Sculpt([0, 0.645, 0.085], [0.125, 0.155, 0.115], {
    jaw: 0.3, chin: 0.18, chinDown: 0.05, socket: 0.24, brow: 0.12, cheek: 0.1, hollow: 0.06,
    noseBridge: 0.1, noseLen: 0.12, noseW: 0.9, noseY: -0.22, lipU: 0.01, lipL: 0.012, mouthDepth: 0, mouthW: 0.36, mouthY: -0.6,
    smile: -0.035, fold: 0.0, eyeY: 0.1,
    bumps: [{ c: [0, -0.4, 0.9], s: [0.6, 0.035, 0.5], a: 0.04 }],
    grooves: [
      { a: [0.15, 0.7], b: [0.3, 0.35], w: 0.012, d: 0.02 }, { a: [0.3, 0.35], b: [0.25, 0.2], w: 0.012, d: 0.02 },
      { a: [-0.5, 0.45], b: [-0.6, 0.15], w: 0.012, d: 0.02 }, { a: [-0.05, -0.1], b: [-0.2, -0.3], w: 0.01, d: 0.015 },
    ],
  });
  const pale = mix(skinOf(0.7), mat.concreteDark, 0.45);
  const maskEdge = -0.38;
  b.addSmooth(S.mesh(pale, {
    paint: (p) => {
      if (p.y <= maskEdge || p.z <= 0.1) return null;
      for (const sx of [-1, 1]) {
        const e = Math.hypot((p.x - sx * S.f.eyeX) / 0.17, (p.y - S.f.eyeY + sx * (p.x - sx * S.f.eyeX) * 0.25) / 0.1);
        if (e < 1) return col(mat.ink);
      }
      // scharfe Maskenkante / crisp mask edge
      return p.y < maskEdge + 0.035 ? shade(bone, 0.78) : col(bone);
    },
  }));
  // Risse als Tusche / cracks as ink
  for (const pts of [[[0.15, 0.7], [0.24, 0.5], [0.3, 0.35], [0.25, 0.2]], [[0.3, 0.35], [0.42, 0.3]], [[-0.5, 0.45], [-0.56, 0.3], [-0.6, 0.15]], [[-0.05, -0.1], [-0.12, -0.2], [-0.2, -0.3]]] as [number, number][][]) {
    ink(b, S, pts, 0.016, { c: mat.dark, lift: 0.006 });
  }
  // grimmige Lippen und Kinn unter der Maske / grim lips and chin below the mask
  lips(b, S, { c: mix(pale, mat.ink, 0.35), cl: mix(pale, mat.ink, 0.2), hU: 0.03, hL: 0.04, thick: 0.04, bow: 0.006 });
  faceInk(b, S, { nose: 0, chin: 1 });
  // glimmende Augenschlitze tief in den Hoehlen / burning eye slits deep in the sockets
  for (const s of [-1, 1] as const) {
    const c = S.surf(s * S.f.eyeX, S.f.eyeY, 0.0);
    blob(b, ember, { p: c, s: [S.len(0.13), S.len(0.035), S.len(0.03)], r: [0, s * 0.3, s * -0.25] }, 24, 16);
    blob(b, mat.yellow, { p: [c[0], c[1], c[2] + S.len(0.02)], s: [S.len(0.065), S.len(0.016), S.len(0.02)], r: [0, s * 0.3, s * -0.25] }, 16, 12);
  }
  addEmblem(b, 'vesper', 0.024, 0.006, red, { p: S.surf(0, 0.55, 0.02), r: [-0.5, 0, 0] });
  for (let i = 0; i < 7; i++) b.add(geo.rbox(0.004, 0.012, 0.006, 0.001), shade(bone, 0.6), { p: S.surf(-0.3 + i * 0.1, -0.37, 0.03) });
}

// ---------- Nexus: KERN-0 ----------

function nexus(b: Builder, L: Look) {
  const plate = L.jacket, metal = mat.gunmetal, glow = mat.cyanGlow, seam = mat.ink;
  torso(b, metal, { w: 0.43, d: 0.21, slope: 0.02, square: 0.5 });
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.3, 0.06, 0.26, 0.05, 0.3, 0.025), plate, { p: [s * 0.17, 0.2, 0.18], r: [0, s * 0.15, 0] });
    b.add(geo.rtaper(0.24, 0.32, 0.16, 0.26, 0.1, 0.02), plate, { p: [s * 0.32, 0.37, -0.01], r: [0, 0, s * -0.35] });
    for (let i = 0; i < 3; i++) b.box(0.006, 0.12, 0.006, glow, [s * (0.27 - i * 0.02), 0.18, 0.214]);
    for (const [x, y] of [[0.08, 0.08], [0.28, 0.08], [0.08, 0.32], [0.28, 0.32]]) {
      b.add(geo.cyl(0.009, 0.009, 0.008, 12), metal, { p: [s * x, y, 0.213], r: [HALF_PI, 0, 0] });
      b.box(0.012, 0.002, 0.003, seam, [s * x, y, 0.218], [0, 0, 0.6]);
    }
    b.box(0.004, 0.28, 0.004, seam, [s * 0.04, 0.2, 0.211]);
  }
  b.cyl(0.075, 0.075, 0.03, 6, metal, [0, 0.22, 0.205], [HALF_PI, 0, 0]);
  addEmblem(b, 'nexus', 0.065, 0.014, glow, { p: [0, 0.22, 0.22] });
  b.add(geo.ico(0.02, 2), glow, { p: [0, 0.22, 0.232] });
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    strand(b, [[s * (0.04 + k * 0.02), 0.52, -0.02 - k * 0.02], [s * (0.12 + k * 0.025), 0.47, -0.03 - k * 0.025], [s * (0.2 + k * 0.03), 0.4, -0.04 - k * 0.03]], 0.012, 0.012, k === 1 ? mat.darkMid : metal, k === 1 ? mat.darkMid : metal, { seg: 10 });
  }
  b.cyl(0.06, 0.07, 0.18, 32, metal, [0, 0.47, -0.01]);
  for (let i = 0; i < 4; i++) b.add(geo.torus(0.066, 0.006, 6, 32), shade(metal, 1.4), { p: [0, 0.4 + i * 0.04, -0.01], r: [HALF_PI, 0, 0] });
  // Kopf aus weissen Platten mit Fugen und Bolzen / head of white plates with seams and bolts
  b.add(geo.rtaper(0.3, 0.3, 0.26, 0.26, 0.34, 0.07), plate, { p: [0, 0.71, 0.0] });
  b.add(geo.rtaper(0.24, 0.26, 0.26, 0.28, 0.08, 0.03), metal, { p: [0, 0.53, 0.0] });
  b.add(geo.rbox(0.22, 0.04, 0.26, 0.02), shade(plate, 0.9), { p: [0, 0.89, -0.01] });
  for (const s of [-1, 1]) {
    b.box(0.004, 0.3, 0.004, seam, [s * 0.135, 0.72, 0.13]);
    b.box(0.004, 0.004, 0.26, seam, [s * 0.15, 0.82, 0.0]);
    for (const [y, z] of [[0.6, 0.12], [0.84, 0.12], [0.6, -0.1], [0.84, -0.1]]) b.add(geo.cyl(0.007, 0.007, 0.006, 12), metal, { p: [s * 0.152, y, z], r: [0, 0, HALF_PI] });
  }
  for (const x of [-0.09, -0.03, 0.03, 0.09]) b.add(geo.cyl(0.006, 0.006, 0.006, 12), metal, { p: [x, 0.86, 0.13], r: [HALF_PI, 0, 0] });
  // Gesichtsbildschirm mit stilisiertem Gesicht / face screen with a stylised face
  b.add(geo.rbox(0.24, 0.2, 0.02, 0.02), mat.ink, { p: [0, 0.7, 0.152] });
  b.add(geo.rbox(0.26, 0.22, 0.014, 0.02), metal, { p: [0, 0.7, 0.146] });
  for (const s of [-1, 1]) {
    b.add(geo.rbox(0.058, 0.04, 0.008, 0.016), glow, { p: [s * 0.055, 0.728, 0.164] });
    b.add(geo.rbox(0.022, 0.016, 0.004, 0.006), mat.white, { p: [s * 0.055 - 0.012, 0.736, 0.169] });
    b.add(geo.rbox(0.05, 0.009, 0.008, 0.004), glow, { p: [s * 0.058, 0.775, 0.164], r: [0, 0, s * 0.18] });
    b.add(geo.cyl(0.008, 0.008, 0.004, 16), shade(glow, 0.6), { p: [s * 0.09, 0.67, 0.164], r: [HALF_PI, 0, 0] });
  }
  for (let i = 0; i < 9; i++) {
    const u = i / 8 - 0.5;
    b.add(geo.rbox(0.016, 0.009, 0.008, 0.003), glow, { p: [u * 0.11, 0.65 + u * u * 0.08, 0.164], r: [0, 0, u * 1.2] });
  }
  for (let i = 0; i < 7; i++) b.box(0.22, 0.002, 0.004, shade(glow, 0.35), [0, 0.615 + i * 0.028, 0.163]);
  for (const s of [-1, 1]) {
    b.cyl(0.06, 0.06, 0.04, 40, metal, [s * 0.16, 0.71, 0.0], [0, 0, HALF_PI]);
    b.add(geo.torus(0.045, 0.007, 8, 40), glow, { p: [s * 0.182, 0.71, 0.0], r: [0, HALF_PI, 0] });
    b.cyl(0.02, 0.02, 0.02, 24, plate, [s * 0.186, 0.71, 0.0], [0, 0, HALF_PI]);
    strand(b, [[s * 0.17, 0.75, -0.03], [s * 0.2, 0.86, -0.06], [s * 0.22, 0.97, -0.08]], 0.006, 0.004, metal, metal);
    b.add(geo.ico(0.016, 2), glow, { p: [s * 0.22, 0.975, -0.08] });
  }
  for (const [x, y] of [[-0.09, 0.85], [0.0, 0.86], [0.09, 0.85]] as [number, number][]) b.cyl(0.022, 0.022, 0.006, 6, glow, [x, y, 0.14], [HALF_PI, 0, 0]);
  b.box(0.008, 0.06, 0.008, glow, [0, 0.89, 0.12]);
}

/** Bueste bauen / build the bust */
export function leader(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  switch (f) {
    case 'korvat': korvat(b, L); break;
    case 'dravon': dravon(b, L); break;
    case 'alvenia': alvenia(b, L); break;
    case 'meridon': meridon(b, L); break;
    case 'velkar': velkar(b, L); break;
    case 'zyrr': zyrr(b, L); break;
    case 'vesper': vesper(b, L); break;
    case 'nexus': nexus(b, L); break;
  }
  return b;
}

