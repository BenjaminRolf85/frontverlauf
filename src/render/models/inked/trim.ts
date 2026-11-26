/**
 * Gezeichnete Einheiten: Fahrzeug-Baukasten (Geometrie mit UV und die zugehoerigen Atlaszellen).
 * Inked units: vehicle kit (geometry with UVs and the matching atlas cells).
 *
 * Was jedes Fahrzeug braucht, liegt hier einmal: Kettenlauf mit Raedern, Rad, Rohr, Fass, Auflagen (Emblem, Ziffern)
 * und Zellen fuer Platten, Nieten, Gitter, Luken, Glas, Leuchtstreifen, Schlamm. Ein Fahrzeug nimmt diese Zellen und
 * bekommt eigene Zellen nur fuer seine zwei, drei grossen Flaechen (z. B. Turm und Bugplatte).
 * Everything each vehicle needs lives here once: track run with wheels, wheel, barrel, drum, decals (emblem, digits)
 * and cells for plates, rivets, grilles, hatches, glass, glow strips, mud. A vehicle uses these cells and gets cells
 * of its own only for its two or three large surfaces (e.g. turret and glacis).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { primitives } from '../../../design/tokens';
import { MUD } from '../detailVehicles';
import { fine, mix, rng, shade, softBox, type ColorLike, type V3 } from '../kit';
import { mat } from '../look';
import { arc, css, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { AtlasLayout, loft, quad, REF, UvBuilder } from './uvkit';

const HALF_PI = Math.PI / 2;
type Q = [V3, V3, V3, V3];

export const STEEL = mat.metalLight;
/** blankes Metall unter abgeplatztem Lack / bare metal under chipped paint */
export const BARE = mix(mat.metal, mat.dark, 0.25);
export const SOOT = mat.ink;
export const WOOD = mat.wood;
/** nasser Schlamm (dunkel) und angetrockneter Rand / wet mud (dark) and its dried edge */
export const MUD_WET = mix(shade(MUD, 0.4), mat.wood, 0.4);
export const MUD_DRY = mix(shade(MUD, 0.75), mat.wood, 0.3);

// ---------- Kette und Raeder / track and wheels ----------

/** Kettenlauf: Mitte x, Breite, Laenge, Hoehe, Glieder, Dicke / track run: centre x, width, length, height, links, thickness */
export interface TrackSpec { x: number; w: number; len: number; h: number; links: number; thick: number }

/** Punkt auf dem Kettenlauf, u = 0..1 ab der Mitte oben nach vorn / point on the track run, u = 0..1 from the top centre forward */
export function trackAt(T: TrackSpec, u: number, inset = 0): { z: number; y: number } {
  const r = T.h / 2, half = T.len / 2 - r;
  const total = 4 * half + 2 * Math.PI * r;
  let d = (((u % 1) + 1) % 1) * total;
  const rr = r - inset;
  if (d < half) return { z: d, y: r + rr };
  d -= half;
  if (d < Math.PI * r) { const a = d / r; return { z: half + Math.sin(a) * rr, y: r + Math.cos(a) * rr }; }
  d -= Math.PI * r;
  if (d < 2 * half) return { z: half - d, y: r - rr };
  d -= 2 * half;
  if (d < Math.PI * r) { const a = d / r; return { z: -half - Math.sin(a) * rr, y: r - Math.cos(a) * rr }; }
  d -= Math.PI * r;
  return { z: -half + d, y: r + rr };
}

/** Rad als Loft entlang x: dunkler Reifen, Radscheibe in der Farbe c mit gezeichneter Aussenseite (Zelle face) / wheel as a loft along x: dark tyre, disc in colour c with a drawn outer face (cell face) */
export function wheel(b: UvBuilder, A: AtlasLayout, x: number, y: number, z: number, r: number, w: number, face: string, c: ColorLike, seg: number): void {
  b.add(loft([
    { y: w / 2, rx: r * 0.84, hard: true }, { y: w / 2 - 0.004, rx: r, hard: true }, { y: -w / 2, rx: r, hard: true },
  ], { seg, region: A.get('tyre'), capFirst: true, color: mat.dark }), null, { xf: { p: [x, y, z], r: [0, 0, -HALF_PI] } });
  b.add(loft([
    { y: w / 2 + 0.0035, rx: r * 0.66, hard: true }, { y: w / 2 - 0.001, rx: r * 0.8, hard: true },
  ], { seg, region: A.get('tyre'), capFirst: A.get(face), color: c }), null, { xf: { p: [x, y, z], r: [0, 0, -HALF_PI] }, gloss: 0.3 });
}

export interface GearOpts {
  /** Laufrollen: Anzahl und Radius / road wheels: count and radius */
  wheels: number; wheelR: number;
  wheelColor: ColorLike; sprocketColor: ColorLike; idlerColor: ColorLike; bayColor: ColorLike;
  rollers?: number;
}

/**
 * Laufwerk einer Seite bei +x (mit b.mirrorX fuer beide Seiten): Kettenglieder als Vierecke mit der Zelle 'link',
 * dunkle Rueckwand ('bay'), Laufrollen, Treibrad vorn, Leitrad hinten, Stuetzrollen.
 * Running gear of one side at +x (use b.mirrorX for both): track links as quads with the cell 'link', dark back wall
 * ('bay'), road wheels, sprocket front, idler rear, return rollers.
 */
export function runningGear(b: UvBuilder, A: AtlasLayout, T: TrackSpec, o: GearOpts): void {
  const hi = fine();
  const links = hi ? T.links : Math.round(T.links * 0.6);
  const { x, w, thick, h } = T;
  const x0 = x - w / 2, x1 = x + w / 2;
  for (let i = 0; i < links; i++) {
    const p = trackAt(T, i / links), q = trackAt(T, (i + 1) / links);
    const pi = trackAt(T, i / links, thick), qi = trackAt(T, (i + 1) / links, thick);
    // Laufflaeche, Aussenkante, Innenseite / tread, outer edge, inner face
    b.add(quad([[x0, p.y, p.z], [x0, q.y, q.z], [x1, q.y, q.z], [x1, p.y, p.z]], A.get('link'), [[0, 0], [0, 1], [1, 1], [1, 0]]), mat.dark, { crease: 0 });
    b.add(quad([[x1, p.y, p.z], [x1, q.y, q.z], [x1, qi.y, qi.z], [x1, pi.y, pi.z]], A.get('linkSide'), [[0, 0], [1, 0], [1, 1], [0, 1]]), mat.dark, { crease: hi ? 0.6 : 0 });
    if (hi) b.add(quad([[x0, pi.y, pi.z], [x1, pi.y, pi.z], [x1, qi.y, qi.z], [x0, qi.y, qi.z]], A.get('blank'), [[0, 0], [1, 0], [1, 1], [0, 1]]), mat.ink, { crease: 0 });
  }
  // Rueckwand: dunkle Wanne mit gezeichneter Federung / back wall: dark hull with drawn suspension
  const bay: number[] = [], bayUv: number[] = [];
  const n = hi ? 28 : 16, half = T.len / 2, r = A.get('bay');
  for (let i = 0; i < n; i++) {
    const p = trackAt(T, i / n, thick * 0.5), q = trackAt(T, (i + 1) / n, thick * 0.5);
    for (const v of [{ z: 0, y: h / 2 }, p, q]) {
      bay.push(x0 + 0.012, v.y, v.z);
      bayUv.push((r.x + ((half - v.z) / (2 * half)) * r.w) / REF, (r.y + (1 - v.y / h) * r.h) / REF);
    }
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bay, 3));
  bg.setAttribute('uv', new THREE.Float32BufferAttribute(bayUv, 2));
  b.add(bg, o.bayColor, { crease: 0 });
  const seg = hi ? 20 : 10, span = T.len - 0.118, wx = x + 0.004, ww = w * 0.62;
  for (let i = 0; i < o.wheels; i++) wheel(b, A, wx, o.wheelR + thick - 0.002, -span / 2 + (i / (o.wheels - 1)) * span, o.wheelR, ww, 'wheel', o.wheelColor, seg);
  wheel(b, A, wx, h * 0.6, half - 0.034, h * 0.31, ww * 0.8, 'sprocket', o.sprocketColor, seg);
  wheel(b, A, wx, h * 0.58, -half + 0.036, h * 0.29, ww * 0.8, 'sprocket', o.idlerColor, seg);
  const rollers = hi ? (o.rollers ?? 3) : 0;
  for (let i = 0; i < rollers; i++) wheel(b, A, wx, h - thick - 0.0125, -0.1 + (i / Math.max(1, rollers - 1)) * 0.2, 0.0115, ww * 0.7, 'blank', mat.metal, 10);
}

// ---------- Rohr, Fass, Auflagen / barrel, drum, decals ----------

export interface BarrelOpts { x: number; y: number; z0: number; len: number; r: number; color: ColorLike; cell?: string; brake?: boolean }
/** Kanonenrohr entlang +z mit Huelse, Stufen und Muendungsbremse; die Naht der Zelle liegt unten / gun barrel along +z with sleeve, steps and muzzle brake; the cell's seam is underneath */
export function barrel(b: UvBuilder, A: AtlasLayout, o: BarrelOpts): void {
  const { x, y, z0, len, r } = o;
  const seg = fine() ? 18 : 10;
  b.add(loft([
    { y: 0, rx: r * 1.5, hard: true }, { y: -len * 0.16, rx: r * 1.45, hard: true }, { y: -len * 0.16, rx: r * 1.12, hard: true }, { y: -len * 0.5, rx: r * 1.04, hard: true },
    { y: -len * 0.5, rx: r * 1.24, hard: true }, { y: -len * 0.58, rx: r * 1.24, hard: true }, { y: -len * 0.58, rx: r, hard: true }, { y: -len + 0.03, rx: r * 0.94 },
  ], { seg, region: A.get(o.cell ?? 'gun'), color: o.color }), null, { xf: { p: [x, y, z0], r: [-HALF_PI, 0, 0] }, gloss: 0.6 });
  if (o.brake === false) return;
  // Muendungsbremse als Kasten, Muendung dunkel / muzzle brake as a box, dark bore
  b.add(softBox(r * 2.7, r * 2.3, 0.044, r * 0.5), mat.dark, { xf: { p: [x, y, z0 + len - 0.014] }, gloss: 0.4 });
  if (fine()) for (const s of [-1, 1]) for (const dz of [-0.022, -0.006]) b.add(softBox(0.003, r * 1.5, 0.01, 0.001), mat.ink, { xf: { p: [x + s * r * 1.36, y, z0 + len + dz] }, crease: 0 });
  b.add(loft([{ y: 0, rx: r * 0.7 }, { y: 0.002, rx: r * 0.7 }], { seg: 10, region: A.get('blank'), capLast: true, color: mat.ink }), null, { xf: { p: [x, y, z0 + len + 0.0065], r: [HALF_PI, 0, 0] }, crease: 0 });
}

/** Fass entlang x (Zellen 'drum' und 'drumEnd') / drum along x (cells 'drum' and 'drumEnd') */
export function fuelDrum(b: UvBuilder, A: AtlasLayout, p: V3, r: number, len: number, c: ColorLike, spin = 0.5): void {
  const h = len / 2;
  b.add(loft([{ y: h, rx: r * 0.88, hard: true }, { y: h - 0.003, rx: r, hard: true }, { y: -h + 0.003, rx: r, hard: true }, { y: -h, rx: r * 0.88, hard: true }], { seg: fine() ? 18 : 10, region: A.get('drum'), capFirst: A.get('drumEnd'), capLast: A.get('drumEnd'), color: c }), null, { xf: { p, r: [spin, 0, HALF_PI] }, gloss: 0.3 });
}

/**
 * Auflage: ebenes Viereck knapp ueber einer Flaeche, Mitte c, Flaechennormale n, Bildoberkante nach up; traegt die
 * Vertexfarbe der Flaeche darunter (die Zelle ist ausserhalb der Zeichnung neutral).
 * Decal: flat quad just above a surface, centre c, surface normal n, image top towards up; carries the vertex colour of
 * the surface below (outside its drawing the cell is neutral).
 */
export function decal(b: UvBuilder, A: AtlasLayout, cell: string, c: V3, n: V3, up: V3, w: number, h: number, surface: ColorLike, st: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]): void {
  const N = new THREE.Vector3(...n).normalize(), U = new THREE.Vector3(...up);
  U.addScaledVector(N, -U.dot(N)).normalize();
  const R = new THREE.Vector3().crossVectors(U, N);
  const C = new THREE.Vector3(...c).addScaledVector(N, 0.003);
  const at = (sx: number, sy: number): V3 => { const v = C.clone().addScaledVector(R, (sx * w) / 2).addScaledVector(U, (sy * h) / 2); return [v.x, v.y, v.z]; };
  const pts: Q = [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)];
  // nach aussen gewickelt / wound outward
  const g = quad([pts[0], pts[3], pts[2], pts[1]], A.get(cell), [st[0], st[3], st[2], st[1]]);
  b.add(g, surface, { crease: 0 });
}
/** Emblem der Fraktion als Auflage (Zelle 'emblem:<fraktion>') / the faction's emblem as a decal (cell 'emblem:<faction>') */
export function emblemDecal(b: UvBuilder, A: AtlasLayout, f: FactionId, c: V3, n: V3, size: number, surface: ColorLike, up: V3 = [0, 1, 0]): void {
  decal(b, A, `emblem:${f}`, c, n, up, size, size, surface);
}
/** Ziffer 0..9 als Auflage aus der Zelle 'digits' / digit 0..9 as a decal from the cell 'digits' */
export function digitDecal(b: UvBuilder, A: AtlasLayout, digit: number, c: V3, n: V3, h: number, surface: ColorLike, up: V3 = [0, 1, 0]): void {
  const s0 = digit / 10, s1 = (digit + 1) / 10;
  decal(b, A, 'digits', c, n, up, h * 0.62, h, surface, [[s0, 0], [s1, 0], [s1, 1], [s0, 1]]);
}

// ---------- Malhilfen / painting helpers ----------

/** Schablonenschrift in der Farbe c, leicht abgewetzt / stencil lettering in colour c, slightly worn */
export function stencil(p: Pen, color: ColorLike, text: string, x: number, y: number, size: number, seed: number): void {
  const c = p.abs;
  c.save();
  c.font = `${size}px ${primitives.font.display}`;
  c.textBaseline = 'middle';
  c.textAlign = 'center';
  c.fillStyle = css(color);
  c.globalAlpha = 0.95;
  c.fillText(text, x, y);
  // Abrieb: Stellen wieder freilegen / wear: uncover spots again
  c.globalCompositeOperation = 'destination-out';
  const R = rng(seed);
  const w = c.measureText(text).width;
  for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(x - w / 2 + R() * w, y - size / 2 + R() * size, 1 + R() * 3.2, 0.6 + R() * 1.4, R() * 3, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
/** Regenstreifen und Rost von oben nach unten / rain streaks and rust running down */
export function streaks(p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number): void {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const px = x + R() * w, len = h * (0.35 + R() * 0.65);
    p.crease([[px, y], [px + (R() - 0.5) * 3, y + len]], 1.6 + R() * 2.4, 0.74, 0.55, { taper: 0.5, wobble: 0.5 });
  }
}
/** Luke: runde Ecken, Scharniere, Griff / hatch: rounded corners, hinges, handle */
export function hatch(p: Pen, x: number, y: number, w: number, h: number, r: number): void {
  p.shade(rrect(x, y, w, h, r), 0.9, 0.8);
  p.panel(rrect(x, y, w, h, r).concat([[x + w - r, y]]), 1.9);
  for (const hx of [x + w * 0.25, x + w * 0.75]) {
    p.fill(rrect(hx - 5, y - 4, 10, 8, 2), BARE);
    p.line(rrect(hx - 5, y - 4, 10, 8, 2), 1.2, { closed: true, wobble: 0.1 });
  }
  p.line(spline([[x + w * 0.35, y + h * 0.62], [x + w * 0.5, y + h * 0.5], [x + w * 0.65, y + h * 0.62]], 5), 2.4, { taper: 0.15 });
  p.crease(spline([[x + w * 0.35, y + h * 0.62 + 2.5], [x + w * 0.5, y + h * 0.5 + 2.5], [x + w * 0.65, y + h * 0.62 + 2.5]], 5), 1.6, 1.5, 0.8, { taper: 0.15 });
}

// ---------- Zellen / cells ----------

/** Bezugsmasse der Rueckwandzelle (Kettenlauf des Korvat-Panzers) / reference size of the bay cell (the Korvat tank's track run) */
const BAY = { len: 0.425, h: 0.096 };

/** Kanonenrohr (96 x 216): s rundum (Naht unten), t Verschluss -> Muendung / gun barrel: s around (seam below), t breech -> muzzle */
function paintGun(p: Pen): void {
  const W = p.w, H = p.h;
  // Abschussringe in der Emblemfarbe, Russ zur Muendung / kill rings in the emblem colour, soot towards the muzzle
  for (const y of [H * 0.66, H * 0.7, H * 0.74]) {
    p.fill([[0, y], [W, y], [W, y + 4], [0, y + 4]], mat.paper, 0.95);
    for (const d of [0, 4]) p.line([[-2, y + d], [W + 2, y + d]], 1, { taper: 0, wobble: 0.15 });
  }
  p.gradient(0, H * 0.8, W, H * 0.2 + 3, [0, H * 0.8], [0, H], 1, 0.45);
  p.splatter(0, H * 0.84, W, H * 0.16, 18, SOOT, 141, { size: 4, alpha: 0.6, rise: 1 });
  p.scratches(0, 8, W, H * 0.6, 10, 143, 16);
  streaks(p, 0, 4, W, H * 0.2, 6, 149);
}

/** Lukendeckel (72 x 72) / hatch lid (72 x 72) */
function paintHatchLid(p: Pen): void {
  const c = p.w / 2;
  p.line(arc(c, c, 29, 29, 0, Math.PI * 2, 24), 1.8, { closed: true, wobble: 0.2 });
  p.dab(c, c, 22, 0.86, 0.8);
  p.line(arc(c, c, 22, 22, 0, Math.PI * 2, 20), 1.4, { closed: true, wobble: 0.2 });
  p.line(spline([[c - 9, c + 3], [c, c - 4], [c + 9, c + 3]], 5), 2.6, { taper: 0.15 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.rivet(c + Math.cos(a) * 25.5, c + Math.sin(a) * 25.5, 1.8); }
}

/** Rueckwand (448 x 104): Schwingarme und Federn hell auf dunklem Grund / back wall: swing arms and springs light on dark ground */
function paintBay(p: Pen): void {
  const W = p.w, H = p.h;
  const half = BAY.len / 2, span = BAY.len - 0.118;
  const X = (z: number) => ((half - z) / (2 * half)) * W;
  const cy = (1 - 0.0475 / BAY.h) * H;
  for (let i = 0; i < 5; i++) {
    const x = X(-span / 2 + (i / 4) * span);
    p.crease([[x, cy], [x + 30, cy - 26]], 9, 2.4, 0.9, { taper: 0, wobble: 0 });
    p.crease([[x, cy], [x + 30, cy - 26]], 4, 3.4, 0.7, { taper: 0, wobble: 0 });
    const zig: Pt[] = [];
    for (let k = 0; k <= 8; k++) zig.push([x + 34 + (k % 2 ? 5 : -5), cy - 30 + k * 4.2]);
    p.crease(zig, 2.2, 3, 0.9, { taper: 0, wobble: 0 });
    p.dab(x + 30, cy - 26, 5.5, 3, 0.9);
  }
  p.crease([[0, 14], [W, 14]], 5, 2, 0.6, { taper: 0, wobble: 0 });
  for (let x = 12; x < W; x += 28) p.dab(x, 14, 2.4, 3.2, 0.9);
  p.mud(0, H * 0.45, W, H * 0.55, MUD_WET, MUD_DRY, 277, 0.5);
}

/** Radscheibe (96 x 96) / wheel disc (96 x 96) */
function paintWheel(p: Pen, teeth: boolean): void {
  const c = p.w / 2;
  // Felgenrand, Nabe, Bolzen, Erleichterungsloecher / rim, hub, bolts, lightening holes
  p.line(arc(c, c, 43, 43, 0, Math.PI * 2, 32), 2.4, { closed: true, wobble: 0.2 });
  p.dab(c, c, 38, 0.9, 0.5);
  if (teeth) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, b = a + 0.14;
      p.blot([[c + Math.cos(a - 0.14) * 43, c + Math.sin(a - 0.14) * 43], [c + Math.cos(a) * 33, c + Math.sin(a) * 33], [c + Math.cos(b) * 43, c + Math.sin(b) * 43]]);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      p.fill(arc(c + Math.cos(a) * 28, c + Math.sin(a) * 28, 7, 7, 0, Math.PI * 2, 12), SOOT, 0.95);
      p.line(arc(c + Math.cos(a) * 28, c + Math.sin(a) * 28, 7, 7, 0, Math.PI * 2, 12), 1.6, { closed: true, wobble: 0.1 });
      p.crease(arc(c + Math.cos(a) * 28 + 1, c + Math.sin(a) * 28 + 1, 7, 7, 0.2, 1.6, 5), 1.3, 1.7, 0.8, { taper: 0.2 });
    }
  }
  p.dab(c, c, 15, 0.78, 0.9);
  p.line(arc(c, c, 15, 15, 0, Math.PI * 2, 18), 2, { closed: true, wobble: 0.15 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.rivet(c + Math.cos(a) * 10, c + Math.sin(a) * 10, 2.1); }
  p.fill(arc(c, c, 4.5, 4.5, 0, Math.PI * 2, 10), BARE);
  p.line(arc(c, c, 4.5, 4.5, 0, Math.PI * 2, 10), 1.3, { closed: true, wobble: 0 });
  p.crease(arc(c, c, 38, 38, Math.PI * 1.05, Math.PI * 1.55, 8), 3, 1.6, 0.7, { taper: 0.3 });
  p.splatter(0, 0, p.w, p.h, 22, MUD_DRY, teeth ? 281 : 283, { size: 4.4, rise: 0.8, alpha: 0.85 });
}

/** Kettenglied (96 x 24): s quer zur Kette, t in Laufrichtung / track link: s across the track, t along the run */
function paintLink(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [5, 52]) {
    p.shade(rrect(x, 3, 39, H - 9, 2.5), 2, 0.9);
    p.shade(rrect(x + 3, 6, 33, H - 15, 1.5), 1.35, 0.9);
  }
  p.fill([[0, H - 4], [W, H - 4], [W, H], [0, H]], SOOT, 0.95);
  p.crease([[0, 1.2], [W, 1.2]], 1.6, 2.4, 0.9, { taper: 0, wobble: 0 });
  for (const x of [2.5, W - 2.5]) p.spot(x, H / 2 - 2, 2, STEEL);
  p.splatter(0, 0, W, H, 9, MUD, 293, { size: 3.4, rise: 1, alpha: 0.9 });
}

/** Fass (176 x 112): s rundum, t entlang der Achse / drum: s around, t along the axis */
function paintDrum(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [5, H - 5]) p.line([[-2, y], [W + 2, y]], 1.5, { taper: 0, wobble: 0.2 });
  // Sicken, Spanngurte / pressed ribs, tie-down straps
  for (const y of [38, 74]) {
    p.crease([[0, y - 2.5], [W, y - 2.5]], 2.2, 1.5, 0.8, { taper: 0, wobble: 0.2 });
    p.line([[-2, y], [W + 2, y]], 1.6, { taper: 0, wobble: 0.25 });
    p.crease([[0, y + 3], [W, y + 3]], 3, 0.76, 0.7, { taper: 0, wobble: 0.2 });
  }
  for (const y of [20, 92]) p.band([[-2, y], [W + 2, y]], 7, BARE, 1.2);
  // Schablone: Inhalt / stencil: contents
  p.abs.save();
  p.abs.translate(70, 56);
  p.abs.rotate(Math.PI / 2);
  p.abs.translate(-70, -56);
  stencil(p, mat.paper, '200 L', 70, 56, 15, 307);
  p.abs.restore();
  p.dab(120, 54, 9, 0.8, 0.7);
  p.line(spline([[112, 50], [121, 46], [129, 52]], 4), 1.2, { taper: 0.4 });
  p.chips(0, 6, W, H - 12, 7, mat.rustDark, 311, 2.6);
  p.scratches(0, 8, W, H - 16, 10, 313, 18);
  streaks(p, 0, 8, W, H - 16, 6, 317);
}

/** Fassdeckel (64 x 64) / drum end (64 x 64) */
function paintDrumEnd(p: Pen): void {
  const c = p.w / 2;
  p.line(arc(c, c, 27, 27, 0, Math.PI * 2, 22), 1.8, { closed: true, wobble: 0.2 });
  p.dab(c, c, 23, 0.9, 0.6);
  p.line(arc(c, c, 16, 16, 0, Math.PI * 2, 16), 1.2, { closed: true, wobble: 0.2 });
  p.fill(arc(c + 9, c - 8, 4.6, 4.6, 0, Math.PI * 2, 10), BARE);
  p.line(arc(c + 9, c - 8, 4.6, 4.6, 0, Math.PI * 2, 10), 1.4, { closed: true, wobble: 0 });
  p.chips(4, 4, p.w - 8, p.h - 8, 4, mat.rustDark, 331, 2.4);
}

/** Auspuff (48 x 72): Rost und Russ / exhaust (48 x 72): rust and soot */
function paintExhaust(p: Pen): void {
  const W = p.w, H = p.h;
  p.splatter(0, 0, W, H, 22, mat.rustDark, 337, { size: 5, rise: 1, alpha: 0.7 });
  p.gradient(0, 0, W, H * 0.45, [0, 0], [0, H * 0.45], 0.3, 1);
  for (const y of [H * 0.5, H * 0.72]) p.crease([[0, y], [W, y]], 1.6, 2, 0.7, { taper: 0, wobble: 0.3 });
}

/** Staukasten (176 x 40) / stowage bin (176 x 40) */
function paintBin(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel([[3, 9], [W - 3, 9]], 1.7);
  for (const x of [W * 0.33, W * 0.67]) p.panel([[x, 10], [x, H - 3]], 1.5);
  for (const x of [W * 0.17, W * 0.5, W * 0.83]) {
    p.fill(rrect(x - 5, 5, 10, 13, 2), BARE);
    p.line(rrect(x - 5, 5, 10, 13, 2), 1.3, { closed: true, wobble: 0.1 });
    p.line([[x - 2, 13], [x + 2, 13]], 1.2, { taper: 0, wobble: 0 });
  }
  p.scratches(4, 12, W - 8, H - 16, 8, 347, 16);
  p.splatter(0, H * 0.4, W, H * 0.6, 8, MUD_WET, 349, { size: 2.6, alpha: 0.5 });
}

/** Plane (144 x 56): Falten laengs, zwei Riemen / tarp (144 x 56): folds along it, two straps */
function paintTarp(p: Pen): void {
  const W = p.w, H = p.h;
  const R = rng(353);
  for (let x = 8; x < W; x += 17) p.line(spline([[x + R() * 5, 3], [x + 4, H / 2], [x + R() * 5, H - 3]], 4), 1.3, { taper: 0.4, wobble: 0.8 });
  for (const y of [14, H - 14]) p.band([[-2, y], [W + 2, y]], 6, WOOD, 1.2);
}

/** Allgemeine Platte (256 x 256): Fugen, Nietenreihen, Kratzer, Abplatzer; fuer jede Panzerung / generic plate: joints, rivet rows, scratches, chips; for any armour */
function paintPlate(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(6, 6, W - 12, H - 12, 6).concat([[W - 12, 6]]), 1.7);
  p.rivets([16, 16], [W - 16, 16], 10, 2.4);
  p.rivets([16, H - 16], [W - 16, H - 16], 10, 2.4);
  p.panel([[W / 2, 8], [W / 2, H - 8]], 1.5);
  streaks(p, 0, 8, W, H * 0.7, 9, 401);
  p.scratches(8, 8, W - 16, H - 16, 18, 403, 26);
  p.chips(0, 0, W, 10, 14, BARE, 407, 3);
  p.chips(0, H - 10, W, 10, 14, BARE, 409, 3);
}
/** Unterer Wannenstreifen (256 x 96): Nieten und Schlammkruste / lower hull strip: rivets and mud crust */
function paintPlateMud(p: Pen): void {
  const W = p.w, H = p.h;
  p.rivets([10, 10], [W - 10, 10], 12, 2.3);
  p.scratches(0, 4, W, H * 0.5, 8, 411, 20);
  p.mud(0, H * 0.25, W, H * 0.75, MUD_WET, MUD_DRY, 413, 0.5);
}
/** Lamellengitter (128 x 96) / louvre grille */
function paintGrille(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill(rrect(6, 6, W - 12, H - 12, 3), SOOT, 0.92);
  for (let y = 11; y < H - 8; y += 6) p.crease([[9, y], [W - 9, y]], 1.8, 1.9, 0.9, { taper: 0, wobble: 0 });
  p.panel(rrect(3, 3, W - 6, H - 6, 4).concat([[W - 8, 3]]), 1.7);
  for (const x of [4, W - 4]) for (const y of [4, H - 4]) p.rivet(x, y, 2.2);
}
/** Glas (64 x 64): dunkle Scheibe mit Lichtkante und Glanz / glass: dark pane with a light edge and shine */
function paintGlass(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(2.5, 2.5, W - 5, H - 5, 5), 2, { closed: true, wobble: 0.2 });
  p.fill([[10, H - 12], [W * 0.45, 9], [W * 0.62, 9], [22, H - 12]], mat.white, 0.4);
  p.fill([[W * 0.5, H - 12], [W * 0.78, 14], [W * 0.84, 14], [W * 0.58, H - 12]], mat.white, 0.28);
}
/** Leuchtstreifen (64 x 16): heller Kern, die Farbe kommt aus der Vertexfarbe / glow strip: bright core, the colour comes from the vertex colour */
function paintGlowStrip(p: Pen): void {
  p.shade([[0, 5], [p.w, 5], [p.w, p.h - 5], [0, p.h - 5]], 1.8, 0.9);
  for (const y of [1.5, p.h - 1.5]) p.line([[-2, y], [p.w + 2, y]], 1.3, { taper: 0, wobble: 0.1 });
}
/** Nietenleiste (256 x 16) / rivet strip */
function paintRivetStrip(p: Pen): void {
  p.rivets([8, p.h / 2], [p.w - 8, p.h / 2], 16, 2.6);
}
/** Ziffern 0..9 als Schablone (320 x 48), je Ziffer ein Zehntel der Breite / digits 0..9 as stencil, one tenth of the width per digit */
function paintDigits(p: Pen): void {
  for (let i = 0; i < 10; i++) stencil(p, mat.paper, String(i), (i + 0.5) * (p.w / 10), p.h / 2 + 2, 40, 421 + i);
}
/** Viereckige Luke (96 x 96) / square hatch */
function paintHatchSquare(p: Pen): void {
  hatch(p, 10, 12, p.w - 20, p.h - 22, 8);
  for (const x of [8, p.w - 8]) for (const y of [10, p.h - 8]) p.rivet(x, y, 2.2);
}

/** Zellen des Fahrzeug-Baukastens / cells of the vehicle kit */
export function trimCells(): Cell[] {
  return [
    { name: 'plate', w: 256, h: 256, paint: paintPlate },
    { name: 'plateMud', w: 256, h: 96, paint: paintPlateMud },
    { name: 'grille', w: 128, h: 96, paint: paintGrille },
    { name: 'hatch', w: 72, h: 72, paint: paintHatchLid },
    { name: 'hatchSquare', w: 96, h: 96, paint: paintHatchSquare },
    { name: 'glass', w: 64, h: 64, paint: paintGlass },
    { name: 'glowStrip', w: 64, h: 16, paint: paintGlowStrip },
    { name: 'rivets', w: 256, h: 16, paint: paintRivetStrip },
    { name: 'digits', w: 320, h: 48, paint: paintDigits },
    { name: 'wheel', w: 96, h: 96, paint: (p) => paintWheel(p, false) },
    { name: 'sprocket', w: 96, h: 96, paint: (p) => paintWheel(p, true) },
    { name: 'link', w: 96, h: 24, paint: paintLink },
    { name: 'linkSide', w: 24, h: 16, paint: (p) => { p.crease([[0, 2], [p.w, 2]], 2, 2.2, 0.9, { taper: 0, wobble: 0 }); p.spot(p.w / 2, p.h / 2 + 1, 2.6, shade(STEEL, 0.8)); } },
    { name: 'tyre', w: 96, h: 16, paint: (p) => { for (let y = 3; y < p.h; y += 5) p.crease([[0, y], [p.w, y]], 1.4, 0.6, 0.8, { taper: 0, wobble: 0 }); } },
    { name: 'bay', w: 448, h: 104, paint: paintBay },
    { name: 'gun', w: 96, h: 216, paint: paintGun },
    { name: 'drum', w: 176, h: 112, paint: paintDrum },
    { name: 'drumEnd', w: 64, h: 64, paint: paintDrumEnd },
    { name: 'exhaust', w: 48, h: 72, paint: paintExhaust },
    { name: 'crate', w: 176, h: 40, paint: paintBin },
    { name: 'tarp', w: 144, h: 56, paint: paintTarp },
  ];
}
