/**
 * Anfuehrer-Bueste je Fraktion (Kopf und Schultern) / faction leader bust (head and shoulders).
 * Blick +z, Ursprung unten mittig, ca. 1.0 hoch und 0.9 breit. Frei erfundene Figuren.
 * Facing +z, origin bottom centre, about 1.0 tall and 0.9 wide. Invented characters.
 */
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng, shade, type ColorLike, type V3 } from './kit';
import { look, mat, type Look } from './look';

const HALF_PI = Math.PI / 2;
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v));

/** Kopf als Ellipsoid mit Hilfen fuer Gesichtsteile / head ellipsoid with helpers for facial parts */
class Head {
  constructor(readonly b: Builder, readonly c: V3, readonly r: V3) {}
  /** Oberflaechenpunkt vorn bei (x, y) relativ zur Kopfmitte / front surface point at (x, y) relative to the head centre */
  at(x: number, y: number, dz = 0): V3 {
    const k = 1 - (x / this.r[0]) ** 2 - (y / this.r[1]) ** 2;
    return [this.c[0] + x, this.c[1] + y, this.c[2] + this.r[2] * Math.sqrt(Math.max(0, k)) + dz];
  }
  /** Drehung, damit flache Teile der Oberflaeche folgen / rotation so flat parts follow the surface */
  rot(x: number, y: number, rz = 0): V3 {
    return [-Math.asin(clamp(y / this.r[1])) * 0.85, Math.asin(clamp(x / this.r[0])) * 0.85, rz];
  }
  skull(c: ColorLike, ws = 40, hs = 30) {
    this.b.add(geo.sphere(1, ws, hs), c, { p: this.c, s: this.r });
  }
}

interface EyeOpts {
  /** Hoehe der Augenoeffnung / eye opening height */
  h?: number;
  /** Lidschluss 0..1 / lid closure */
  lid?: number;
  /** Lidneigung (positiv = finster) / lid tilt (positive = scowl) */
  tilt?: number;
  iris?: ColorLike;
  lidCol?: ColorLike;
  look?: [number, number];
  size?: number;
  lashes?: boolean;
  white?: ColorLike;
}

/** Auge mit Iris, Pupille, Glanzlicht, Oberlid und Lidstrich / eye with iris, pupil, highlight, upper lid and lash line */
function eye(H: Head, x: number, y: number, o: EyeOpts = {}) {
  const b = H.b, s = o.size ?? 1, h = o.h ?? 0.8, side = Math.sign(x) || 1;
  const [lx, ly] = o.look ?? [0, 0];
  b.group({ p: H.at(x, y, -0.012 * s), r: H.rot(x, y), s }, () => {
    b.add(geo.sphere(0.036, 24, 16), o.white ?? mat.white, { s: [1, h, 0.5] });
    b.add(geo.sphere(0.021, 20, 14), o.iris ?? mat.wood, { p: [lx * 0.01, ly * 0.01, 0.011], s: [1, 1, 0.45] });
    b.add(geo.sphere(0.0115, 14, 10), mat.ink, { p: [lx * 0.011, ly * 0.011, 0.017], s: [1, 1, 0.4] });
    b.add(geo.sphere(0.0055, 8, 6), mat.white, { p: [lx * 0.011 - 0.007, ly * 0.011 + 0.007, 0.021] });
    const lid = o.lid ?? 0.15, tilt = (o.tilt ?? 0) * side;
    const edge = 0.036 * h * (1 - 2 * lid);
    b.group({ p: [0, edge, 0.0], r: [0, 0, tilt] }, () => {
      b.add(geo.rbox(0.084, 0.05, 0.036, 0.01), o.lidCol ?? mat.skin, { p: [0, 0.025, 0.004] });
      b.add(geo.rbox(0.086, 0.007, 0.03, 0.003), mat.ink, { p: [0, 0.0, 0.008] });
      if (o.lashes) for (const k of [0.8, 1.15]) b.box(0.006, 0.016, 0.004, mat.ink, [side * 0.034 * k, 0.006, 0.02], [0, 0, -side * 0.6 * k]);
    });
    // Unterlid / lower lid
    b.add(geo.rbox(0.07, 0.012, 0.026, 0.004), o.lidCol ? shade(o.lidCol, 0.95) : shade(mat.skin, 0.93), { p: [0, -0.036 * h - 0.002, 0.004] });
  });
}

/** Augenbraue; Winkel positiv = aussen hoch (streng) / eyebrow; positive angle = outer end up (stern) */
function brow(H: Head, x: number, y: number, ang: number, c: ColorLike, w = 0.075, t = 0.018, bushy = false) {
  const side = Math.sign(x) || 1, rz = side * ang;
  if (!bushy) {
    const r = H.rot(x, y);
    H.b.add(geo.rbox(w, t, 0.02, t * 0.4), c, { p: H.at(x, y, 0.004), r: [r[0], r[1], rz] });
    return;
  }
  // buschig: Buendel kleiner Ikosaeder / bushy: bundle of small icosahedra
  for (let i = 0; i < 5; i++) {
    const u = (i / 4 - 0.5) * w;
    const px = x + u * Math.cos(rz), py = y + u * Math.sin(rz) + (i % 2) * 0.004;
    H.b.add(geo.ico(t * 0.9, 1), c, { p: H.at(px, py, 0.006), s: [1.3, 0.8, 0.7], r: [0, 0, rz] });
  }
}

/** Nase als konvexe Huelle / nose as convex hull */
function nose(H: Head, y: number, len = 0.05, wide = 0.026, c: ColorLike = shade(mat.skin, 0.95)) {
  const [x0, y0, z0] = H.at(0, y);
  H.b.add(geo.hull([
    [x0, y0 + 0.035, z0 - 0.01], [x0 - 0.012, y0 + 0.03, z0 - 0.012], [x0 + 0.012, y0 + 0.03, z0 - 0.012],
    [x0, y0 - 0.025, z0 + len * 0.8], [x0 - 0.01, y0 - 0.03, z0 + len * 0.7], [x0 + 0.01, y0 - 0.03, z0 + len * 0.7],
    [x0 - wide, y0 - 0.035, z0 + 0.008], [x0 + wide, y0 - 0.035, z0 + 0.008], [x0, y0 - 0.042, z0 + len * 0.45],
    [x0 - wide * 0.8, y0 - 0.02, z0 - 0.006], [x0 + wide * 0.8, y0 - 0.02, z0 - 0.006],
  ]), c);
  for (const s of [-1, 1]) H.b.add(geo.sphere(0.006, 8, 6), shade(mat.skin, 0.6), { p: [x0 + s * 0.012, y0 - 0.038, z0 + len * 0.42], s: [1.3, 0.6, 1] });
}

/** Mund als Bogen aus Segmenten; curve > 0 = Laecheln, asym = schiefes Grinsen / mouth arc; curve > 0 smile, asym = lopsided grin */
function mouth(H: Head, y: number, w: number, curve: number, o: { asym?: number; lip?: ColorLike; thick?: number; open?: number } = {}) {
  const n = 11, thick = o.thick ?? 0.009, lip = o.lip ?? shade(mat.skin, 0.62);
  const f = (u: number) => y + curve * u * u + (o.asym ?? 0) * u;
  for (let i = 0; i < n; i++) {
    const u0 = (i / n) * 2 - 1, u1 = ((i + 1) / n) * 2 - 1;
    const xa = (u0 * w) / 2, xb = (u1 * w) / 2, ya = f(u0), yb = f(u1);
    const xm = (xa + xb) / 2, ym = (ya + yb) / 2;
    const len = Math.hypot(xb - xa, yb - ya) + 0.002;
    const p = H.at(xm, ym, 0.002);
    H.b.add(geo.rbox(len, thick * (1 - Math.abs((u0 + u1) / 2) * 0.4), 0.014, 0.002), lip, { p, r: [H.rot(xm, ym)[0], H.rot(xm, ym)[1], Math.atan2(yb - ya, xb - xa)] });
  }
  if (o.open) {
    const p = H.at(0, f(0) - o.open * 0.5, -0.002);
    H.b.add(geo.sphere(1, 16, 8), mat.ink, { p, s: [w * 0.4, o.open * 0.5, 0.01] });
    H.b.add(geo.rbox(w * 0.55, o.open * 0.35, 0.01, 0.002), mat.white, { p: [p[0], p[1] + o.open * 0.2, p[2] + 0.004] });
  }
  // Mundwinkel-Grubchen / mouth corner dimples
  for (const s of [-1, 1]) H.b.add(geo.sphere(0.005, 8, 6), shade(mat.skin, 0.75), { p: H.at(s * (w / 2 + 0.006), f(s) + 0.002, 0.001) });
}

function ears(H: Head, c: ColorLike = mat.skin, s = 1, y = -0.005) {
  for (const sd of [-1, 1]) {
    const p: V3 = [H.c[0] + sd * H.r[0] * 0.96, H.c[1] + y, H.c[2] - 0.01];
    H.b.add(geo.sphere(0.04 * s, 18, 12), c, { p, s: [0.4, 1, 0.75], r: [0, sd * 0.35, 0] });
    H.b.add(geo.sphere(0.024 * s, 12, 8), shade(c, 0.78), { p: [p[0] + sd * 0.01, p[1], p[2] + 0.006], s: [0.3, 1, 0.7], r: [0, sd * 0.35, 0] });
  }
}

/** Kinn/Kiefer und Wangen / chin, jaw and cheeks */
function jaw(H: Head, c: ColorLike, w: number, h: number, chin = 0.02) {
  const [x, y, z] = H.c;
  H.b.add(geo.rtaper(w, H.r[2] * 1.5, w * 0.62, H.r[2] * 1.2, h, 0.03, chin), c, { p: [x, y - H.r[1] * 0.55, z + 0.01], r: [Math.PI, 0, 0] });
  for (const s of [-1, 1]) H.b.add(geo.sphere(0.045, 16, 12), c, { p: H.at(s * 0.075, -0.045, -0.03), s: [1, 0.8, 0.8] });
}

function neck(b: Builder, c: ColorLike, r = 0.075, y0 = 0.34, h = 0.2) {
  b.cyl(r, r * 1.1, h, 24, c, [0, y0 + h / 2, -0.01]);
}

/** Oberkoerper mit Schultern / torso with shoulders */
function torso(b: Builder, c: ColorLike, o: { w?: number; sh?: number; angular?: boolean } = {}) {
  const w = o.w ?? 0.8;
  b.add(geo.rtaper(w, 0.42, w * 0.82, 0.36, 0.3, 0.06), c, { p: [0, 0.15, -0.01] });
  b.add(geo.rtaper(w * 0.8, 0.36, 0.3, 0.24, 0.1, 0.04), c, { p: [0, 0.35, -0.01] });
  for (const s of [-1, 1]) {
    if (o.angular) b.add(geo.rtaper(0.22, 0.34, 0.12, 0.26, 0.12, 0.012), c, { p: [s * 0.32, 0.31, -0.01], r: [0, 0, s * -0.32] });
    else b.add(geo.sphere(0.13, 24, 16), c, { p: [s * 0.31, 0.29, -0.01], s: [1.2, o.sh ?? 0.75, 1.3] });
  }
}

/** Knopfreihe / button row */
function buttons(b: Builder, x: number, ys: number[], z: number, c: ColorLike, r = 0.012) {
  for (const y of ys) b.add(geo.sphere(r, 10, 8), c, { p: [x, y, z], s: [1, 1, 0.6] });
}

/** Epaulette mit Fransen / epaulette with fringe */
function epaulette(b: Builder, s: number, base: ColorLike, fringe: ColorLike, y = 0.37, x = 0.3) {
  b.group({ p: [s * x, y, 0.0], r: [0, 0, s * -0.22] }, () => {
    b.add(geo.rbox(0.17, 0.03, 0.17, 0.012), base, {});
    b.add(geo.cyl(0.085, 0.085, 0.034, 20), fringe, { p: [s * 0.03, 0, 0], s: [1, 1, 1] });
    for (let i = 0; i < 9; i++) {
      const z = -0.07 + (i / 8) * 0.14;
      b.cyl(0.007, 0.007, 0.05, 6, fringe, [s * 0.1, -0.028, z]);
    }
  });
}

/** Ordensspange und Orden / ribbon bars and medals */
function medals(b: Builder, x0: number, y0: number, z: number, rows: number, cols: number, palette: ColorLike[], seed: number) {
  const R = rng(seed);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + (c - (cols - 1) / 2) * 0.034, y = y0 - r * 0.018;
    const a = palette[Math.floor(R() * palette.length)], bb = palette[Math.floor(R() * palette.length)];
    b.box(0.032, 0.014, 0.008, a, [x, y, z]);
    b.box(0.008, 0.015, 0.009, bb, [x, y, z]);
  }
}
function medal(b: Builder, x: number, y: number, z: number, ribbon: ColorLike, disc: ColorLike, star = false) {
  b.add(geo.taper(0.03, 0.006, 0.024, 0.006, 0.04), ribbon, { p: [x, y, z] });
  if (star) b.add(geo.cyl(0.024, 0.024, 0.008, 5), disc, { p: [x, y - 0.04, z + 0.002], r: [HALF_PI, 0, 0] });
  else b.add(geo.cyl(0.02, 0.02, 0.008, 18), disc, { p: [x, y - 0.038, z + 0.002], r: [HALF_PI, 0, 0] });
  b.add(geo.cyl(0.012, 0.012, 0.004, 12), shade(disc, 0.8), { p: [x, y - 0.038, z + 0.007], r: [HALF_PI, 0, 0] });
}

// ---------- Korvat: Grossmarschall Ilja Brodnik ----------

function korvat(b: Builder, L: Look) {
  const coat = L.primary, gold = mat.gold, grey = mat.concrete, greyL = mat.concreteLight;
  torso(b, coat, { w: 0.86, sh: 0.85 });
  neck(b, mat.skin, 0.09);
  // schwerer Mantelkragen / heavy greatcoat collar
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.2, 0.06, 0.13, 0.05, 0.24, 0.015), shade(coat, 0.82), { p: [s * 0.12, 0.3, 0.17], r: [0.15, s * 0.35, s * 0.42] });
    b.add(geo.rtaper(0.16, 0.06, 0.15, 0.06, 0.12, 0.02), shade(coat, 0.75), { p: [s * 0.1, 0.45, 0.04], r: [-0.2, s * -0.5, s * -0.2] });
    b.add(geo.rbox(0.05, 0.03, 0.012, 0.004), gold, { p: [s * 0.09, 0.44, 0.13], r: [0, s * -0.5, 0] });
  }
  b.add(geo.rbox(0.13, 0.26, 0.02, 0.008), shade(coat, 0.9), { p: [0, 0.17, 0.205] });
  buttons(b, -0.05, [0.08, 0.15, 0.22, 0.29], 0.218, gold, 0.014);
  buttons(b, 0.05, [0.08, 0.15, 0.22, 0.29], 0.218, gold, 0.014);
  for (const s of [-1, 1]) epaulette(b, s, gold, shade(gold, 0.85), 0.37, 0.31);
  // Orden auf der Brust / chest full of medals
  medals(b, -0.2, 0.31, 0.2, 4, 4, [L.secondary, gold, mat.white, L.primaryDark, mat.blue, mat.dark], 3);
  for (const [x, star] of [[-0.25, true], [-0.2, false], [-0.15, true]] as [number, boolean][]) medal(b, x, 0.22, 0.2, L.secondary, gold, star);
  medal(b, 0.2, 0.3, 0.2, mat.white, mat.metalLight, true);
  medal(b, 0.25, 0.3, 0.195, L.secondary, gold, false);
  addEmblem(b, 'korvat', 0.04, 0.008, gold, { p: [0.2, 0.16, 0.205] });
  // Kopf: breit, schwerer Kiefer / head: broad, heavy jaw
  const H = new Head(b, [0, 0.66, 0.02], [0.175, 0.185, 0.17]);
  H.skull(mat.skin);
  jaw(H, mat.skin, 0.3, 0.14, 0.02);
  ears(H, mat.skin, 1.1);
  eye(H, -0.062, 0.02, { h: 0.7, lid: 0.32, tilt: 0.12, iris: mat.blue, look: [0, -0.2] });
  eye(H, 0.062, 0.02, { h: 0.7, lid: 0.32, tilt: 0.12, iris: mat.blue, look: [0, -0.2] });
  for (const s of [-1, 1]) brow(H, s * 0.066, 0.075, 0.22, greyL, 0.09, 0.022, true);
  nose(H, -0.02, 0.06, 0.032, shade(mat.skin, 0.94));
  // Falten / wrinkles
  for (const s of [-1, 1]) {
    b.add(geo.rbox(0.006, 0.05, 0.01, 0.002), shade(mat.skin, 0.75), { p: H.at(s * 0.06, -0.06, 0.0), r: [0, 0, s * 0.3] });
    b.add(geo.rbox(0.03, 0.004, 0.008, 0.001), shade(mat.skin, 0.75), { p: H.at(s * 0.12, 0.02, 0.0), r: [0, s * 0.8, s * 0.2] });
  }
  b.add(geo.rbox(0.07, 0.004, 0.01, 0.001), shade(mat.skin, 0.8), { p: H.at(0, 0.12, 0) });
  // grosser grauer Schnurrbart / big grey moustache
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      const x = s * (0.012 + u * 0.085), y = -0.068 - u * u * 0.045;
      b.add(geo.sphere(0.034 - u * 0.012, 16, 12), i % 2 ? greyL : grey, { p: H.at(x, y, 0.012 - u * 0.008), s: [1.25, 0.8, 0.8], r: [0, 0, s * (-0.3 - u * 0.4)] });
    }
  }
  mouth(H, -0.115, 0.07, 0.008, { lip: shade(mat.skin, 0.6) });
  b.add(geo.sphere(0.03, 16, 12), shade(mat.skin, 0.96), { p: H.at(0, -0.155, 0.0), s: [1.3, 0.8, 0.7] });
  // Koteletten / sideburns
  for (const s of [-1, 1]) b.add(geo.rbox(0.03, 0.09, 0.05, 0.012), grey, { p: [s * 0.165, 0.64, 0.05] });
  // Schirmmuetze mit Emblem / peaked cap with emblem
  const capC = L.helmet;
  b.add(geo.cyl(0.215, 0.18, 0.1, 40), capC, { p: [0, 0.86, 0.0], s: [1, 1, 1.02] });
  b.add(geo.sphere(0.22, 40, 10), capC, { p: [0, 0.905, -0.005], s: [1, 0.26, 1.04] });
  b.add(geo.cyl(0.183, 0.183, 0.05, 40), L.primary, { p: [0, 0.82, 0.0] });
  b.add(geo.cyl(0.186, 0.186, 0.01, 40), gold, { p: [0, 0.844, 0.0] });
  b.add(geo.cyl(0.21, 0.21, 0.012, 40, false), mat.dark, { p: [0, 0.795, 0.11], s: [0.95, 1, 0.85], r: [0.32, 0, 0] });
  // Kordel + Emblem / cord + emblem
  b.add(geo.torus(0.1, 0.008, 6, 24, ), gold, { p: [0, 0.81, 0.16], s: [1, 0.25, 1], r: [0.5, 0, 0] });
  b.add(geo.cyl(0.05, 0.05, 0.012, 24), gold, { p: [0, 0.88, 0.2], r: [HALF_PI - 0.25, 0, 0] });
  addEmblem(b, 'korvat', 0.04, 0.008, L.primary, { p: [0, 0.88, 0.208], r: [-0.25, 0, 0] });
}

// ---------- Dravon: Kommandant Sarek Voss ----------

function dravon(b: Builder, L: Look) {
  const black = L.helmet, green = L.jacket, gold = L.secondary;
  torso(b, green, { w: 0.84, angular: true });
  // Tarnflecken / camo patches
  const R = rng(9);
  for (let i = 0; i < 26; i++) {
    const x = (R() - 0.5) * 0.7, y = 0.03 + R() * 0.33;
    const c = i % 3 === 0 ? shade(green, 0.55) : i % 3 === 1 ? mix(green, black, 0.4) : shade(green, 0.8);
    b.add(geo.rbox(0.05 + R() * 0.07, 0.03 + R() * 0.04, 0.012, 0.006), c, { p: [x, y, 0.2 - Math.abs(x) * 0.12], r: [0, x * 0.4, R() * 1.5] });
  }
  // kantige Schulterpanzer mit Goldkante / angular shoulder armour with gold edge
  for (const s of [-1, 1]) {
    b.add(geo.profileXY([[0, 0], [0.24, -0.04], [0.26, 0.04], [0.12, 0.12], [0.0, 0.1]], 0.3), shade(green, 0.7), { p: [s * 0.2, 0.33, -0.15], s: [s, 1, 1] });
    b.add(geo.profileXY([[0.24, -0.04], [0.27, -0.035], [0.285, 0.05], [0.26, 0.04]], 0.31), gold, { p: [s * 0.2, 0.33, -0.155], s: [s, 1, 1] });
    b.add(geo.rbox(0.05, 0.016, 0.06, 0.005), gold, { p: [s * 0.33, 0.43, 0.02], r: [0, 0, s * -0.55] });
  }
  // hoher kantiger Kragen / high angular collar
  for (const s of [-1, 1]) b.add(geo.rtaper(0.14, 0.05, 0.12, 0.04, 0.16, 0.01), shade(green, 0.6), { p: [s * 0.085, 0.45, 0.04], r: [-0.1, s * -0.6, s * -0.12] });
  b.add(geo.rbox(0.03, 0.3, 0.02, 0.006), gold, { p: [0.02, 0.17, 0.215], r: [0, 0, 0.05] });
  addEmblem(b, 'dravon', 0.05, 0.01, gold, { p: [-0.2, 0.25, 0.2] });
  buttons(b, 0.07, [0.1, 0.18, 0.26], 0.212, gold);
  neck(b, black, 0.085);
  // Kehlkopfmikrofon / throat mic
  b.add(geo.rbox(0.05, 0.035, 0.03, 0.008), mat.darkMid, { p: [0.0, 0.46, 0.08] });
  b.tube([0.025, 0.46, 0.08], [0.12, 0.4, 0.12], 0.005, 6, mat.dark);
  // Sturmhaube / balaclava
  const H = new Head(b, [0, 0.66, 0.02], [0.16, 0.19, 0.165]);
  H.skull(black);
  jaw(H, black, 0.26, 0.12, 0.01);
  ears(H, black, 0.9);
  // Augenschlitz mit Haut / eye slot showing skin
  b.add(geo.sphere(1, 32, 12), mat.skin, { p: [0, 0.68, 0.035], s: [0.155, 0.04, 0.16] });
  const pale = mix(mat.white, mat.glass, 0.55);
  eye(H, -0.058, 0.02, { h: 0.55, lid: 0.25, tilt: 0.28, iris: pale, look: [0.1, 0], lidCol: black, size: 0.95 });
  eye(H, 0.058, 0.02, { h: 0.55, lid: 0.25, tilt: 0.28, iris: pale, look: [0.1, 0], lidCol: black, size: 0.95 });
  // Rippen der Haube / balaclava ribbing
  for (let i = 0; i < 5; i++) b.add(geo.torus(0.16 - i * 0.004, 0.003, 4, 40), shade(black, 1.6), { p: [0, 0.6 - i * 0.03, 0.02], r: [HALF_PI, 0, 0], s: [1, 1.05, 1] });
  // Gasmaskenfilter vor dem Mund / gas mask filter over the mouth
  const m = H.at(0, -0.075, -0.02);
  b.add(geo.rtaper(0.15, 0.09, 0.1, 0.06, 0.1, 0.02), mat.darkMid, { p: [m[0], m[1], m[2] - 0.01], r: [HALF_PI - 0.3, 0, 0] });
  b.cyl(0.045, 0.05, 0.05, 28, mat.dark, [m[0], m[1] - 0.01, m[2] + 0.05], [HALF_PI - 0.25, 0, 0]);
  for (let i = 0; i < 6; i++) b.box(0.07, 0.006, 0.01, mat.ink, [m[0], m[1] - 0.035 + i * 0.012, m[2] + 0.077], [-0.25, 0, 0]);
  b.add(geo.torus(0.047, 0.006, 6, 28), gold, { p: [m[0], m[1] - 0.01, m[2] + 0.075], r: [-0.25, 0, 0] });
  for (const s of [-1, 1]) {
    b.cyl(0.028, 0.028, 0.05, 20, mat.dark, [s * 0.1, m[1] - 0.02, m[2] - 0.02], [0, 0, s * 1.2]);
    b.add(geo.torus(0.028, 0.004, 4, 20), gold, { p: [s * 0.12, m[1] - 0.03, m[2] - 0.02], r: [0, s * HALF_PI, s * 1.2 - HALF_PI] });
  }
  // Stirnband mit Goldstreifen / headband with gold stripe
  b.add(geo.torus(0.163, 0.01, 6, 48), mix(black, green, 0.2), { p: [0, 0.75, 0.02], r: [HALF_PI + 0.1, 0, 0], s: [1, 1.02, 1] });
  b.add(geo.rbox(0.05, 0.02, 0.01, 0.004), gold, { p: H.at(0, 0.09, 0.012), r: H.rot(0, 0.09) });
}

// ---------- Alvenia: Praesidentin Liora Valen ----------

function alvenia(b: Builder, L: Look) {
  const blue = L.primary, white = L.secondary, gold = mat.gold, hair = mat.dark;
  torso(b, blue, { w: 0.78 });
  // weisse Revers und Schaerpe / white lapels and sash
  for (const s of [-1, 1]) b.add(geo.rtaper(0.13, 0.03, 0.07, 0.03, 0.26, 0.008), white, { p: [s * 0.07, 0.3, 0.19], r: [0.1, s * 0.15, s * 0.3] });
  b.add(geo.rbox(0.08, 0.6, 0.02, 0.008), white, { p: [0.02, 0.2, 0.205], r: [0.05, 0, 0.75] });
  b.add(geo.rbox(0.03, 0.62, 0.022, 0.004), blue, { p: [0.02, 0.2, 0.206], r: [0.05, 0, 0.75] });
  b.add(geo.sphere(0.04, 20, 14), gold, { p: [0.2, 0.06, 0.2], s: [1, 1, 0.4] });
  addEmblem(b, 'alvenia', 0.03, 0.006, white, { p: [0.2, 0.06, 0.218] });
  buttons(b, -0.05, [0.06, 0.13, 0.2], 0.214, gold);
  for (const s of [-1, 1]) epaulette(b, s, white, gold, 0.36, 0.29);
  // Olivenzweig-Anstecknadel / olive branch pin
  b.group({ p: [-0.19, 0.3, 0.205], r: [0, 0, 0.4] }, () => {
    b.box(0.07, 0.006, 0.006, mat.wood, [0, 0, 0]);
    for (let i = 0; i < 5; i++) b.add(geo.sphere(0.011, 10, 8), mat.green, { p: [-0.03 + i * 0.015, (i % 2 ? 1 : -1) * 0.008, 0.004], s: [1.5, 0.6, 0.4], r: [0, 0, (i % 2 ? 1 : -1) * 0.5] });
    b.add(geo.sphere(0.008, 10, 8), mat.green, { p: [0.04, 0, 0.004] });
  });
  // Stehkragen / stand collar
  b.add(geo.cyl(0.1, 0.11, 0.05, 32, true), white, { p: [0, 0.43, 0.0] });
  neck(b, mat.skin, 0.068);
  const H = new Head(b, [0, 0.66, 0.02], [0.152, 0.18, 0.158]);
  H.skull(mat.skin);
  jaw(H, mat.skin, 0.22, 0.12, 0.03);
  ears(H, mat.skin, 0.85);
  const iris = mix(mat.wood, mat.green, 0.3);
  eye(H, -0.058, 0.015, { h: 0.85, lid: 0.18, tilt: -0.05, iris, lashes: true, look: [0.1, 0] });
  eye(H, 0.058, 0.015, { h: 0.85, lid: 0.18, tilt: -0.05, iris, lashes: true, look: [0.1, 0] });
  for (const s of [-1, 1]) brow(H, s * 0.06, 0.07, -0.12, hair, 0.07, 0.012);
  nose(H, -0.025, 0.04, 0.02);
  mouth(H, -0.098, 0.075, 0.016, { lip: mix(mat.skin, mat.red, 0.35), thick: 0.011 });
  for (const s of [-1, 1]) b.add(geo.sphere(0.022, 12, 8), mix(mat.skin, mat.red, 0.15), { p: H.at(s * 0.085, -0.04, -0.004), s: [1, 0.7, 0.4] });
  // kurzes dunkles Haar (Bob) / short dark hair (bob)
  b.add(geo.sphere(1, 40, 24, ), hair, { p: [0, 0.69, -0.005], s: [0.168, 0.18, 0.168] });
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.05, 0.1, 0.06, 0.13, 0.16, 0.02), hair, { p: [s * 0.15, 0.6, 0.03], r: [0, 0, s * 0.08] });
    b.add(geo.sphere(0.04, 16, 12), hair, { p: [s * 0.14, 0.52, 0.07], s: [0.8, 0.6, 1] });
  }
  // Pony / fringe
  for (let i = 0; i < 6; i++) {
    const x = -0.11 + i * 0.044;
    b.add(geo.sphere(0.045, 16, 12), hair, { p: H.at(x, 0.115 - Math.abs(x) * 0.2, -0.018), s: [1, 0.7, 0.5], r: [0, 0, -0.5 - x] });
  }
  // blaues Barett, schraeg / blue beret, tilted
  b.group({ p: [0.03, 0.83, 0.0], r: [0.1, 0, -0.25] }, () => {
    b.add(geo.sphere(0.2, 40, 16), blue, { s: [1, 0.32, 1] });
    b.add(geo.torus(0.165, 0.018, 8, 40), shade(blue, 0.75), { p: [0, -0.03, 0], r: [HALF_PI, 0, 0] });
    b.add(geo.sphere(0.02, 10, 8), shade(blue, 0.8), { p: [0, 0.065, 0] });
    b.add(geo.cyl(0.042, 0.042, 0.012, 24), gold, { p: [-0.085, 0.0, 0.14], r: [HALF_PI - 0.4, 0, 0.25] });
    addEmblem(b, 'alvenia', 0.036, 0.006, white, { p: [-0.085, 0.003, 0.148], r: [-0.4, 0, 0.25] });
  });
}

// ---------- Meridon: Admiralin Coralie Nerezza ----------

function meridon(b: Builder, L: Look) {
  const teal = L.primary, gold = mat.gold, hair = shade(mat.wood, 0.75), orange = L.secondary;
  torso(b, teal, { w: 0.8 });
  // grosse Revers mit Goldkante / big lapels with gold trim
  for (const s of [-1, 1]) {
    b.add(geo.profileXY([[0, 0.42], [0.2, 0.36], [0.24, 0.24], [0.12, 0.0], [0.03, 0.05]], 0.03), shade(teal, 0.72), { p: [s * 0.02, 0.0, 0.18], s: [s, 1, 1], r: [0.08, 0, 0] });
    b.add(geo.profileXY([[0.2, 0.36], [0.215, 0.37], [0.255, 0.24], [0.24, 0.24]], 0.034), gold, { p: [s * 0.02, 0.0, 0.18], s: [s, 1, 1], r: [0.08, 0, 0] });
    buttons(b, s * 0.17, [0.05, 0.12, 0.19], 0.205, gold, 0.013);
    epaulette(b, s, gold, gold, 0.37, 0.3);
  }
  // Halstuch in Orange / orange neckerchief
  b.add(geo.rtaper(0.14, 0.06, 0.06, 0.04, 0.14, 0.015), orange, { p: [0, 0.38, 0.13], r: [0.2, 0, 0] });
  b.add(geo.sphere(0.03, 14, 10), orange, { p: [0, 0.43, 0.12] });
  addEmblem(b, 'meridon', 0.045, 0.008, gold, { p: [-0.18, 0.3, 0.2] });
  neck(b, mat.skin, 0.066);
  const H = new Head(b, [0, 0.66, 0.02], [0.15, 0.178, 0.156]);
  H.skull(mat.skin);
  jaw(H, mat.skin, 0.21, 0.12, 0.03);
  ears(H, mat.skin, 0.85);
  // Ohrring / earring
  b.add(geo.torus(0.022, 0.005, 6, 20), gold, { p: [0.148, 0.6, 0.01], r: [0, HALF_PI, 0] });
  const iris = mix(teal, mat.wood, 0.4);
  // linkes Auge mit Monokel, rechtes zusammengekniffen / left eye with monocle, right squinting
  eye(H, -0.058, 0.015, { h: 0.85, lid: 0.12, iris, lashes: true, look: [0.25, 0] });
  eye(H, 0.058, 0.015, { h: 0.8, lid: 0.42, tilt: 0.15, iris, lashes: true, look: [0.25, 0] });
  brow(H, -0.06, 0.085, -0.25, hair, 0.07, 0.012);
  brow(H, 0.06, 0.065, 0.15, hair, 0.07, 0.012);
  const mp = H.at(-0.058, 0.015, 0.012);
  b.add(geo.torus(0.04, 0.006, 6, 28), gold, { p: mp, r: H.rot(-0.058, 0.015) });
  b.add(geo.cyl(0.036, 0.036, 0.003, 28), mix(mat.glass, mat.white, 0.4), { p: mp, r: [HALF_PI + H.rot(-0.058, 0.015)[0], 0, -H.rot(-0.058, 0.015)[1]] });
  // Monokelkette bis zur Brust / monocle chain down to the chest
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    b.add(geo.torus(0.007, 0.002, 4, 8), gold, { p: [mp[0] - 0.04 - t * 0.12, mp[1] - 0.03 - t * 0.38 + Math.sin(t * Math.PI) * 0.03, mp[2] - 0.03 + t * 0.05], r: [0, i % 2 ? HALF_PI : 0, 0] });
  }
  nose(H, -0.025, 0.045, 0.02);
  // schiefes Grinsen / sly lopsided grin
  mouth(H, -0.098, 0.08, 0.012, { asym: 0.014, lip: mix(mat.skin, mat.red, 0.4), thick: 0.011 });
  b.add(geo.sphere(0.006, 8, 6), mat.dark, { p: H.at(0.06, -0.05, 0.001) });
  // langes Haar mit Zopf ueber der Schulter / long hair with a braid over the shoulder
  b.add(geo.sphere(1, 40, 24), hair, { p: [0, 0.685, -0.015], s: [0.165, 0.18, 0.165] });
  b.add(geo.rtaper(0.3, 0.14, 0.26, 0.1, 0.24, 0.05), hair, { p: [0, 0.56, -0.08] });
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const p: V3 = [0.14 + t * 0.08, 0.56 - t * 0.38, 0.06 + t * 0.12 - t * t * 0.05];
    b.add(geo.sphere(0.04 - t * 0.012, 16, 12), i % 2 ? hair : shade(hair, 0.82), { p, s: [1, 0.85, 1], r: [0, 0, i % 2 ? 0.5 : -0.5] });
  }
  b.add(geo.cyl(0.02, 0.016, 0.03, 16), orange, { p: [0.225, 0.16, 0.18] });
  b.add(geo.cone(0.03, 0.07, 12), hair, { p: [0.226, 0.115, 0.18], r: [Math.PI, 0, 0] });
  // Dreispitz mit Goldkante / tricorn with gold trim
  b.group({ p: [0, 0.82, 0.0], r: [0.05, 0, 0.08] }, () => {
    b.add(geo.sphere(0.155, 36, 16), teal, { p: [0, 0.03, 0], s: [1, 0.75, 1] });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI;
      b.group({ r: [0, a, 0] }, () => {
        b.add(geo.profileXY([[-0.2, 0], [0.2, 0], [0.16, 0.1], [0, 0.08], [-0.16, 0.1]], 0.018), shade(teal, 0.85), { p: [0, -0.02, -0.15], r: [0.25, 0, 0] });
        b.add(geo.profileXY([[-0.16, 0.1], [0, 0.08], [0.16, 0.1], [0.165, 0.115], [0, 0.095], [-0.165, 0.115]], 0.022), gold, { p: [0, -0.02, -0.15], r: [0.25, 0, 0] });
      });
    }
    b.add(geo.sphere(0.035, 16, 12), orange, { p: [0.12, 0.06, 0.1], s: [1, 1, 0.6] });
    addEmblem(b, 'meridon', 0.03, 0.006, gold, { p: [0.12, 0.06, 0.122] });
  });
}

// ---------- Velkar: Direktor Aurel Kesh ----------

function velkar(b: Builder, L: Look) {
  const coat = mix(mat.paper, L.primary, 0.35), armour = L.gear, green = L.secondary, hair = mat.paper;
  torso(b, coat, { w: 0.74, sh: 0.65 });
  // Panzerplatte unter dem offenen Kittel / armour plate under the open lab coat
  b.add(geo.rtaper(0.3, 0.06, 0.24, 0.05, 0.36, 0.02), armour, { p: [0, 0.2, 0.18] });
  for (let i = 0; i < 3; i++) b.add(geo.rbox(0.26 - i * 0.03, 0.012, 0.05, 0.004), shade(armour, 1.4), { p: [0, 0.08 + i * 0.09, 0.21] });
  addEmblem(b, 'velkar', 0.06, 0.012, green, { p: [0, 0.26, 0.215] });
  for (const s of [-1, 1]) {
    b.add(geo.profileXY([[0, 0.4], [0.07, 0.42], [0.2, 0.2], [0.17, 0.0], [0.13, 0.0], [0.15, 0.18]], 0.03), shade(coat, 0.88), { p: [s * 0.03, 0.0, 0.18], s: [s, 1, 1] });
    // Stifte in der Brusttasche / pens in the breast pocket
    if (s > 0) {
      b.add(geo.rbox(0.08, 0.07, 0.02, 0.006), shade(coat, 0.92), { p: [0.24, 0.2, 0.19] });
      for (const [x, c] of [[0.22, mat.dark], [0.24, green], [0.26, mat.blue]] as [number, ColorLike][]) b.cyl(0.006, 0.006, 0.06, 8, c, [x, 0.25, 0.19]);
    }
  }
  b.add(geo.rbox(0.05, 0.07, 0.01, 0.004), mat.white, { p: [-0.23, 0.25, 0.2] });
  b.box(0.04, 0.006, 0.006, green, [-0.23, 0.27, 0.206]);
  neck(b, mat.skin, 0.058);
  b.add(geo.cyl(0.075, 0.08, 0.04, 28), armour, { p: [0, 0.42, -0.01] });
  // schmaler, alter Kopf / narrow, older head
  const H = new Head(b, [0, 0.665, 0.02], [0.138, 0.19, 0.152]);
  H.skull(mat.skin);
  jaw(H, mat.skin, 0.18, 0.13, 0.03);
  ears(H, mat.skin, 0.95);
  eye(H, -0.052, 0.02, { h: 0.7, lid: 0.22, iris: mix(L.secondary, mat.dark, 0.3), look: [-0.2, 0.1], size: 0.9 });
  eye(H, 0.052, 0.02, { h: 0.6, lid: 0.35, tilt: 0.1, iris: mix(L.secondary, mat.dark, 0.3), look: [-0.2, 0.1], size: 0.9 });
  brow(H, -0.055, 0.08, -0.3, hair, 0.065, 0.014, true);
  brow(H, 0.055, 0.065, 0.12, hair, 0.065, 0.014, true);
  nose(H, -0.025, 0.055, 0.02, shade(mat.skin, 0.93));
  mouth(H, -0.11, 0.055, -0.004, { thick: 0.008 });
  // Falten und Wangen / wrinkles and hollow cheeks
  for (const s of [-1, 1]) {
    b.add(geo.rbox(0.005, 0.06, 0.008, 0.002), shade(mat.skin, 0.75), { p: H.at(s * 0.05, -0.07, 0), r: [0, 0, s * 0.25] });
    for (const dy of [0, 0.012]) b.add(geo.rbox(0.025, 0.003, 0.006, 0.001), shade(mat.skin, 0.78), { p: H.at(s * 0.108, 0.01 - dy, -0.002), r: [0, s * 0.9, s * 0.35] });
  }
  // kurzer weisser Spitzbart / short white goatee
  b.add(geo.cone(0.03, 0.06, 16), hair, { p: H.at(0, -0.165, -0.01), r: [Math.PI + 0.3, 0, 0] });
  // weisses Haar: Halbglatze mit wilden Seitenbuescheln / white hair: balding top with wild side tufts
  b.add(geo.sphere(1, 36, 20, ), hair, { p: [0, 0.665, -0.035], s: [0.145, 0.17, 0.14] });
  const R = rng(4);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
    const a = -0.6 + i * 0.25;
    b.add(geo.cone(0.03, 0.09 + R() * 0.04, 8), hair, { p: [s * 0.14, 0.7 + Math.sin(a) * 0.08, -0.02 + Math.cos(a) * 0.06 - 0.06], r: [R() * 0.4, 0, s * (-1.2 - R() * 0.5)] });
  }
  // Rundbrille auf der Stirn mit Band / round goggles on the forehead with strap
  b.add(geo.torus(0.142, 0.012, 6, 48), mat.dark, { p: [0, 0.78, 0.02], r: [HALF_PI + 0.15, 0, 0], s: [1, 1.08, 1] });
  for (const s of [-1, 1]) {
    const p = H.at(s * 0.052, 0.125, 0.025);
    b.group({ p, r: [-0.7, s * 0.3, 0] }, () => {
      b.cyl(0.04, 0.044, 0.035, 28, L.primary, [0, 0, 0], [HALF_PI, 0, 0]);
      b.add(geo.torus(0.04, 0.008, 6, 28), mat.dark, { p: [0, 0, 0.018] });
      b.cyl(0.033, 0.033, 0.004, 28, mix(green, mat.glass, 0.5), [0, 0, 0.02], [HALF_PI, 0, 0]);
      b.add(geo.sphere(0.008, 8, 6), mat.white, { p: [-0.012, 0.012, 0.024], s: [1, 1, 0.4] });
    });
  }
  // Headset mit Mikrofon und Antenne / headset with mic and antenna
  b.cyl(0.04, 0.04, 0.035, 24, mat.darkMid, [0.145, 0.66, 0.01], [0, 0, HALF_PI]);
  b.cyl(0.025, 0.025, 0.006, 20, green, [0.164, 0.66, 0.01], [0, 0, HALF_PI]);
  b.tube([0.15, 0.64, 0.04], [0.09, 0.56, 0.15], 0.005, 8, mat.dark);
  b.add(geo.sphere(0.012, 10, 8), mat.dark, { p: [0.085, 0.555, 0.155] });
  b.tube([0.15, 0.69, 0.0], [0.17, 0.95, -0.04], 0.004, 6, mat.dark);
  b.add(geo.ico(0.016, 1), green, { p: [0.17, 0.955, -0.04] });
}

// ---------- Zyrr: Schwarmmutter Xyl'Tharra ----------

function zyrr(b: Builder, L: Look) {
  const skin = mat.alienSkin, violet = L.primary, acid = mat.acid, glow = mat.xenoGlow;
  // Panzerkragen in Schichten / layered carapace collar
  torso(b, shade(violet, 0.7), { w: 0.72, sh: 0.6 });
  for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
    const a = -1.3 + (i / 8) * 2.6, r = 0.36 - row * 0.07;
    const y = 0.26 + row * 0.07;
    b.add(geo.rtaper(0.12, 0.05, 0.05, 0.02, 0.16, 0.02, 0.02), row % 2 ? violet : shade(violet, 1.2), { p: [Math.sin(a) * r, y, Math.cos(a) * r * 0.6 - 0.04], r: [0.5, a, 0] });
    if (row === 0) b.add(geo.sphere(0.012, 8, 6), acid, { p: [Math.sin(a) * (r + 0.03), y - 0.02, Math.cos(a) * (r + 0.03) * 0.6 - 0.02] });
  }
  addEmblem(b, 'zyrr', 0.05, 0.01, acid, { p: [0, 0.14, 0.215] });
  b.add(geo.torus(0.07, 0.008, 6, 24), glow, { p: [0, 0.14, 0.208] });
  // langer duenner Hals / long thin neck
  b.cyl(0.05, 0.065, 0.2, 24, skin, [0, 0.48, 0.0]);
  for (let i = 0; i < 4; i++) b.add(geo.torus(0.054, 0.006, 4, 24), shade(skin, 0.8), { p: [0, 0.42 + i * 0.035, 0.0], r: [HALF_PI, 0, 0] });
  // grosser Kopf, unten spitz / large head, pointed chin
  const H = new Head(b, [0, 0.7, 0.02], [0.19, 0.2, 0.17]);
  H.skull(skin);
  b.add(geo.cone(0.13, 0.17, 32), skin, { p: [0, 0.53, 0.05], r: [Math.PI + 0.2, 0, 0], s: [1, 1, 0.75] });
  // grosse schwarze Mandelaugen / big black almond eyes
  for (const s of [-1, 1]) {
    const p = H.at(s * 0.085, -0.01, -0.03);
    b.add(geo.sphere(0.07, 32, 20), mat.ink, { p, s: [1, 0.55, 0.45], r: [H.rot(s * 0.085, -0.01)[0], H.rot(s * 0.085, -0.01)[1], s * 0.45] });
    b.add(geo.sphere(0.012, 10, 8), mat.white, { p: [p[0] - 0.02, p[1] + 0.018, p[2] + 0.03], s: [1.4, 0.8, 0.5] });
    b.add(geo.sphere(0.008, 10, 8), glow, { p: [p[0] + 0.025, p[1] - 0.012, p[2] + 0.028], s: [1.4, 0.8, 0.5] });
    b.add(geo.rbox(0.09, 0.012, 0.03, 0.004), shade(skin, 0.8), { p: H.at(s * 0.09, 0.04, -0.004), r: [0, s * 0.45, s * 0.5] });
  }
  for (const s of [-1, 1]) b.add(geo.sphere(0.006, 8, 6), shade(skin, 0.5), { p: H.at(s * 0.012, -0.09, 0.0), s: [0.6, 1.4, 1] });
  mouth(H, -0.14, 0.04, -0.006, { lip: shade(skin, 0.55), thick: 0.006 });
  // Stirnzeichnung / forehead pattern
  for (let i = 0; i < 3; i++) b.add(geo.rbox(0.012, 0.05 - i * 0.012, 0.008, 0.003), acid, { p: H.at(0, 0.1 + i * 0.03, 0.0), r: H.rot(0, 0.1 + i * 0.03) });
  // Krone aus leuchtenden Stacheln / crown of glowing spines
  for (let i = 0; i < 11; i++) {
    const a = -1.4 + (i / 10) * 2.8;
    const len = 0.16 + (1 - Math.abs(a) / 1.4) * 0.14;
    b.group({ p: [Math.sin(a) * 0.15, 0.82, Math.cos(a) * 0.12 - 0.06], r: [-0.45, a * 0.6, -a * 0.35] }, () => {
      b.add(geo.cone(0.026, len, 12), i % 2 ? acid : glow, { p: [0, len / 2, 0] });
      b.add(geo.cyl(0.03, 0.034, 0.02, 12), violet, { p: [0, 0, 0] });
    });
  }
  // Fuehler / antennae
  for (const s of [-1, 1]) {
    const pts: V3[] = [[s * 0.1, 0.86, 0.06], [s * 0.18, 0.95, 0.12], [s * 0.26, 0.99, 0.12], [s * 0.31, 0.95, 0.1]];
    for (let i = 0; i < pts.length - 1; i++) b.tube(pts[i], pts[i + 1], 0.009 - i * 0.002, 10, skin);
    b.add(geo.ico(0.022, 1), acid, { p: pts[3] });
  }
}

// ---------- Vesper: Prophet Malachar ----------

function vesper(b: Builder, L: Look) {
  const robe = L.jacket, red = L.primary, bone = mat.bone, ember = mat.ember;
  torso(b, robe, { w: 0.82, sh: 0.8 });
  // Stola mit gebrochener Sonne / stole with broken sun
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.12, 0.03, 0.1, 0.03, 0.44, 0.01), red, { p: [s * 0.1, 0.22, 0.19], r: [0.08, 0, s * 0.12] });
    b.add(geo.rbox(0.124, 0.014, 0.034, 0.004), ember, { p: [s * 0.1 - s * 0.025, 0.02, 0.2], r: [0, 0, s * 0.12] });
    addEmblem(b, 'vesper', 0.04, 0.008, bone, { p: [s * 0.095, 0.12, 0.21], r: [0, 0, s * 0.12] });
  }
  // Ketten ueber der Brust / chains across the chest
  for (const [y0, y1] of [[0.3, 0.12], [0.24, 0.07]]) {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      b.add(geo.torus(0.014, 0.004, 4, 10), mat.metal, { p: [-0.32 + t * 0.64, y0 + (y1 - y0) * Math.sin(t * Math.PI), 0.205 - Math.abs(t - 0.5) * 0.06], r: [0, i % 2 ? HALF_PI : 0, 0] });
    }
  }
  // Laterne mit Glut an der Brust / ember lantern at the chest
  b.group({ p: [0, 0.1, 0.22] }, () => {
    b.cyl(0.04, 0.045, 0.02, 16, mat.rustDark, [0, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      b.box(0.008, 0.08, 0.008, mat.rustDark, [Math.sin(a) * 0.035, 0.05, Math.cos(a) * 0.035]);
    }
    b.add(geo.ico(0.03, 2), ember, { p: [0, 0.05, 0] });
    b.add(geo.ico(0.018, 1), mat.yellow, { p: [0, 0.05, 0.012] });
    b.add(geo.cone(0.052, 0.04, 16), mat.rustDark, { p: [0, 0.11, 0] });
    b.add(geo.torus(0.012, 0.004, 4, 10), mat.rustDark, { p: [0, 0.14, 0] });
  });
  // tiefe Kapuze / deep hood
  b.add(geo.sphere(1, 40, 26), shade(robe, 1.25), { p: [0, 0.66, -0.03], s: [0.24, 0.29, 0.25] });
  b.add(geo.cone(0.14, 0.2, 24), shade(robe, 1.25), { p: [0, 0.94, -0.12], r: [-0.6, 0, 0] });
  b.add(geo.rtaper(0.5, 0.36, 0.34, 0.3, 0.14, 0.05), shade(robe, 1.15), { p: [0, 0.42, -0.02] });
  // dunkle Oeffnung / dark opening
  b.add(geo.sphere(1, 36, 24), mat.ink, { p: [0, 0.65, 0.07], s: [0.17, 0.22, 0.17] });
  b.add(geo.torus(0.18, 0.025, 8, 40), red, { p: [0, 0.655, 0.16], s: [1, 1.24, 1], r: [-0.12, 0, 0] });
  // Knochenmaske mit glimmenden Augenschlitzen / bone mask with ember eye slits
  const H = new Head(b, [0, 0.64, 0.08], [0.13, 0.16, 0.13]);
  b.add(geo.sphere(1, 36, 24, ), bone, { p: [0, 0.64, 0.09], s: [0.125, 0.155, 0.12] });
  b.add(geo.rtaper(0.16, 0.13, 0.1, 0.1, 0.1, 0.03, 0.01), bone, { p: [0, 0.53, 0.12], r: [Math.PI, 0, 0] });
  for (const s of [-1, 1]) {
    b.add(geo.rbox(0.07, 0.022, 0.03, 0.006), mat.ink, { p: H.at(s * 0.048, 0.015, 0.002), r: [0, H.rot(s * 0.048, 0.015)[1], s * -0.22] });
    b.add(geo.rbox(0.05, 0.01, 0.03, 0.004), ember, { p: H.at(s * 0.048, 0.015, 0.006), r: [0, H.rot(s * 0.048, 0.015)[1], s * -0.22] });
    b.add(geo.sphere(0.014, 10, 8), mat.yellow, { p: H.at(s * 0.048, 0.015, 0.01), s: [1.4, 0.5, 0.5] });
  }
  b.add(geo.rbox(0.03, 0.06, 0.03, 0.008), shade(bone, 0.9), { p: H.at(0, -0.02, 0.01) });
  for (let i = 0; i < 5; i++) b.add(geo.rbox(0.006, 0.04, 0.012, 0.002), mat.dark, { p: H.at(-0.04 + i * 0.02, -0.105, 0.002) });
  // Risse / cracks
  b.add(geo.rbox(0.004, 0.06, 0.01, 0.001), mat.dark, { p: H.at(0.06, 0.08, 0.001), r: [0, 0.3, 0.4] });
  b.add(geo.rbox(0.004, 0.035, 0.01, 0.001), mat.dark, { p: H.at(0.08, 0.04, 0.001), r: [0, 0.4, -0.5] });
  addEmblem(b, 'vesper', 0.026, 0.006, red, { p: H.at(0, 0.09, 0.004), r: H.rot(0, 0.09) });
}

// ---------- Nexus: KERN-0 ----------

function nexus(b: Builder, L: Look) {
  const plate = L.jacket, metal = mat.gunmetal, glow = mat.cyanGlow;
  torso(b, metal, { w: 0.82, angular: true });
  // Brustplatten / chest plates
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.3, 0.06, 0.26, 0.05, 0.3, 0.025), plate, { p: [s * 0.17, 0.2, 0.17], r: [0, s * 0.15, 0] });
    b.add(geo.rtaper(0.24, 0.32, 0.16, 0.26, 0.1, 0.02), plate, { p: [s * 0.32, 0.36, -0.01], r: [0, 0, s * -0.35] });
    for (let i = 0; i < 3; i++) b.box(0.006, 0.12, 0.006, glow, [s * (0.27 - i * 0.02), 0.18, 0.205]);
  }
  // Sechseck-Neuronalknoten / hexagonal neural node
  b.cyl(0.075, 0.075, 0.03, 6, metal, [0, 0.22, 0.2], [HALF_PI, 0, 0]);
  addEmblem(b, 'nexus', 0.065, 0.012, glow, { p: [0, 0.22, 0.215] });
  b.add(geo.ico(0.02, 2), glow, { p: [0, 0.22, 0.225] });
  // Kabel vom Hals zu den Schultern / cables from neck to shoulders
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    b.tube([s * (0.04 + k * 0.02), 0.5, -0.02 - k * 0.02], [s * (0.2 + k * 0.03), 0.4, -0.04 - k * 0.03], 0.012, 10, k === 1 ? mat.darkMid : metal);
  }
  b.cyl(0.06, 0.07, 0.18, 24, metal, [0, 0.47, -0.01]);
  for (let i = 0; i < 4; i++) b.add(geo.torus(0.066, 0.006, 4, 24), shade(metal, 1.4), { p: [0, 0.4 + i * 0.04, -0.01], r: [HALF_PI, 0, 0] });
  // Kopf aus weissen Platten / head of white plates
  b.add(geo.rtaper(0.3, 0.3, 0.26, 0.26, 0.34, 0.07), plate, { p: [0, 0.71, 0.0] });
  b.add(geo.rtaper(0.24, 0.26, 0.26, 0.28, 0.08, 0.03), metal, { p: [0, 0.53, 0.0] });
  b.add(geo.rbox(0.22, 0.04, 0.26, 0.02), shade(plate, 0.9), { p: [0, 0.89, -0.01] });
  // Gesichtsbildschirm mit stilisiertem Gesicht / face screen with a stylised face
  b.add(geo.rbox(0.24, 0.2, 0.02, 0.02), mat.ink, { p: [0, 0.7, 0.152] });
  b.add(geo.rbox(0.26, 0.22, 0.014, 0.02), metal, { p: [0, 0.7, 0.146] });
  for (const s of [-1, 1]) {
    b.add(geo.rbox(0.05, 0.03, 0.01, 0.01), glow, { p: [s * 0.055, 0.73, 0.163] });
    b.add(geo.rbox(0.045, 0.008, 0.01, 0.003), glow, { p: [s * 0.055, 0.765, 0.163], r: [0, 0, s * 0.15] });
  }
  for (let i = 0; i < 7; i++) {
    const u = i / 6 - 0.5;
    b.box(0.016, 0.008, 0.01, glow, [u * 0.11, 0.655 + u * u * 0.06, 0.163]);
  }
  for (let i = 0; i < 6; i++) b.box(0.2, 0.002, 0.004, shade(glow, 0.45), [0, 0.62 + i * 0.03, 0.163]);
  // Ohrmodule mit Leuchtringen / ear modules with glow rings
  for (const s of [-1, 1]) {
    b.cyl(0.06, 0.06, 0.04, 28, metal, [s * 0.16, 0.71, 0.0], [0, 0, HALF_PI]);
    b.add(geo.torus(0.045, 0.007, 6, 28), glow, { p: [s * 0.182, 0.71, 0.0], r: [0, HALF_PI, 0] });
    b.cyl(0.02, 0.02, 0.02, 16, plate, [s * 0.186, 0.71, 0.0], [0, 0, HALF_PI]);
    // Antennen / antennae
    b.tube([s * 0.17, 0.75, -0.03], [s * 0.22, 0.97, -0.08], 0.006, 8, metal);
    b.add(geo.ico(0.016, 1), glow, { p: [s * 0.22, 0.975, -0.08] });
  }
  // Sechseck-Fugen am Kopf / hexagon seams on the head
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
