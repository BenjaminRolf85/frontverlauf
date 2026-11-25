/**
 * Vorschlag B: Panzer der Korvat als wenige grosse Flaechen mit Texturkoordinaten.
 * Proposal B: Korvat tank as a few large surfaces with texture coordinates.
 *
 * Erkennungsmerkmale bleiben: rote Wanne, grosser gegossener Turm mit ZWEI Rohren, Faesser am Heck, Kommandant im Luk.
 * Die Wanne ist kein Quaderstapel mehr, sondern ein Koerper mit schraegen Flanken, Bug- und Heckplatte; das Laufwerk
 * ist eine echte Kettenschleife mit Raedern darin. Nieten, Schweissnaehte, Luken, Gitter, Werkzeug, Schlamm und
 * Kennzeichen sind gezeichnet (tankPaint.ts), nicht modelliert.
 * The marks of identity stay: red hull, large cast turret with TWO barrels, drums at the rear, commander in the hatch.
 * The hull is no longer a stack of boxes but one body with sloped flanks, glacis and rear plate; the running gear is a
 * real track loop with wheels inside. Rivets, weld seams, hatches, grilles, tools, mud and markings are drawn
 * (tankPaint.ts), not modelled.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../../data/balance';
import { geo, mix, shade, softBox, type ColorLike, type V3 } from '../../kit';
import { look, mat, type Look } from '../../look';
import { figure } from './figure';
import { AtlasLayout, loft, projectBox, quad, REF, UvBuilder, type Region, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;
const TIP = 1e-7;

/** Masse der Wanne / hull dimensions */
export const HULL = {
  /** Unterkante, Guertellinie, Deck / lower edge, belt line, deck */
  y0: 0.097, y1: 0.113, y2: 0.16,
  /** halbe Breiten an Guertel und Deck / half widths at belt and deck */
  xb: 0.238, xd: 0.184,
  /** Bug und Heck an der Guertellinie und am Deck / bow and stern at the belt line and at the deck */
  zf: 0.222, zr: -0.216, zdf: 0.158, zdr: -0.168,
};
/** Kette: Mitte x, Breite, Laenge, Hoehe, Glieder / track: centre x, width, length, height, links */
export const TRACK = { x: 0.168, w: 0.104, len: 0.425, h: 0.096, links: 44, thick: 0.012 };
/** Turm: Drehpunkt und Ringe (oben nach unten) / turret: pivot and rings (top to bottom) */
export const TURRET = { y: HULL.y2, z: -0.03 };
export function turretRings(L: Look): Ring[] {
  const y = TURRET.y;
  return [
    { y: y + 0.094, rx: 0.092, rz: 0.066, rzB: 0.082, e: 2.5, hard: true, c: L.hull },
    { y: y + 0.086, rx: 0.108, rz: 0.086, rzB: 0.096, e: 2.6 },
    { y: y + 0.062, rx: 0.131, rz: 0.112, rzB: 0.12, e: 2.7 },
    { y: y + 0.032, rx: 0.14, rz: 0.121, rzB: 0.13, e: 2.8 },
    { y: y + 0.014, rx: 0.137, rz: 0.117, rzB: 0.126, e: 2.8, hard: true },
    { y: y + 0.013, rx: 0.128, rz: 0.11, rzB: 0.116, e: 2.6, hard: true, c: L.trim },
    { y: y - 0.001, rx: 0.128, rz: 0.11, rzB: 0.116, e: 2.6 },
  ];
}

/** Atlas des Panzers (Bezug 1024) / tank atlas (reference 1024) */
export function tankLayout(): AtlasLayout {
  const a = new AtlasLayout();
  a.place('turret', 8, 8, 720, 104);
  a.place('turretTop', 736, 8, 176, 176);
  a.place('wheel', 920, 8, 96, 96);
  a.place('sprocket', 920, 112, 96, 96);
  a.place('hullSide', 8, 120, 448, 96);
  a.place('stencil', 464, 120, 264, 96);
  a.place('deck', 8, 224, 312, 336);
  a.place('glacis', 328, 224, 400, 88);
  a.place('rear', 328, 320, 400, 88);
  a.place('bay', 328, 416, 448, 104);
  a.place('drum', 736, 192, 176, 112);
  a.place('drumEnd', 920, 216, 64, 64);
  a.place('link', 920, 288, 96, 24);
  a.place('linkSide', 920, 320, 24, 16);
  a.place('blank', 952, 320, 16, 16);
  a.place('tyre', 920, 344, 96, 16);
  a.place('gun', 920, 368, 96, 216);
  a.place('mantlet', 784, 312, 128, 64);
  a.place('hatch', 784, 384, 72, 72);
  a.place('exhaust', 864, 384, 48, 72);
  a.place('nose', 328, 528, 192, 32);
  a.place('bin', 528, 528, 176, 40);
  a.place('tarp', 712, 528, 144, 56);
  // Kommandant: dieselben Bereiche wie die Figur, kleiner / commander: the same regions as the figure, smaller
  a.place('head', 8, 568, 320, 144);
  a.place('helmet', 336, 576, 224, 64);
  a.place('torso', 568, 592, 224, 104);
  a.place('upperArm', 800, 592, 88, 52);
  a.place('foreArm', 896, 592, 80, 50);
  a.place('hand', 336, 648, 56, 36);
  a.place('fNose', 400, 648, 28, 22);
  a.place('ear', 436, 648, 24, 22);
  a.place('strap', 800, 652, 128, 12);
  a.place('pouch', 936, 652, 32, 32);
  return a;
}

type Q = [V3, V3, V3, V3];

/** Wanne: Deck, Bug, Heck, schraege Flanken, Schuerze / hull: deck, glacis, rear, sloped flanks, skirt */
function hull(b: UvBuilder, A: AtlasLayout, L: Look): void {
  const { y0, y1, y2, xb, xd, zf, zr, zdf, zdr } = HULL;
  const add = (pts: Q, r: Region, st: [number, number][], c: ColorLike = L.hull) => b.add(quad(pts, r, st), c);
  const sx = (x: number) => (xb - x) / (2 * xb);
  // Deck (Bug oben im Bild) / deck (bow at the top of the image)
  add([[-xd, y2, zdf], [xd, y2, zdf], [xd, y2, zdr], [-xd, y2, zdr]], A.get('deck'), [[1, 0], [0, 0], [0, 1], [1, 1]]);
  // Bugplatte, von vorn gesehen / glacis as seen from the front
  add([[-xb, y1, zf], [xb, y1, zf], [xd, y2, zdf], [-xd, y2, zdf]], A.get('glacis'), [[1 - sx(-xb), 1], [1 - sx(xb), 1], [1 - sx(xd), 0], [1 - sx(-xd), 0]]);
  // Heckplatte, von hinten gesehen / rear plate as seen from behind
  add([[xb, y1, zr], [-xb, y1, zr], [-xd, y2, zdr], [xd, y2, zdr]], A.get('rear'), [[sx(xb), 1], [sx(-xb), 1], [sx(-xd), 0], [sx(xd), 0]]);
  // Flanken: oben 78 % schraege Platte, unten Schuerze; beide Seiten lesen von aussen richtig / flanks: top 78 % sloped plate, skirt below; both sides read correctly from outside
  const sz = (z: number) => (zf - z) / (zf - zr);
  const K = 0.78;
  for (const s of [1, -1]) {
    const u = (z: number) => (s > 0 ? sz(z) : 1 - sz(z));
    const slope: Q = [[s * xb, y1, zf], [s * xb, y1, zr], [s * xd, y2, zdr], [s * xd, y2, zdf]];
    const skirt: Q = [[s * xb, y0, zf], [s * xb, y0, zr], [s * xb, y1, zr], [s * xb, y1, zf]];
    const flip = (q: Q): Q => (s > 0 ? q : [q[1], q[0], q[3], q[2]]);
    const st1: [number, number][] = [[u(zf), K], [u(zr), K], [u(zdr), 0], [u(zdf), 0]];
    const st2: [number, number][] = [[u(zf), 1], [u(zr), 1], [u(zr), K], [u(zf), K]];
    const fl = (t: [number, number][]) => (s > 0 ? t : [t[1], t[0], t[3], t[2]]);
    add(flip(slope), A.get('hullSide'), fl(st1));
    add(flip(skirt), A.get('hullSide'), fl(st2));
  }
  // Staukaesten auf den schraegen Flanken (Oliv auf Rot: Kennzeichen der Korvat) und Kotfluegel vorn und hinten
  // stowage bins on the sloped flanks (olive on red: a Korvat mark) and mudguards front and rear
  b.mirrorX(() => {
    b.add(projectBox(softBox(0.05, 0.03, 0.15, 0.006), { py: A.get('bin'), all: A.get('blank') }), L.trim, { xf: { p: [(xb + xd) / 2 + 0.0098, (y1 + y2) / 2 + 0.0113, -0.03], r: [0, 0, -0.716] } });
    const g0 = 0.12, g1 = xb;
    for (const [za, zb, zc, s] of [[zf, zf + 0.022, zf + 0.034, 1], [zr, zr - 0.02, zr - 0.03, -1]] as const) {
      const pts: [number, number][] = [[za, y1], [zb, y1 - 0.008], [zc, y1 - 0.034]];
      for (let i = 0; i < 2; i++) {
        const q: Q = [[g0, pts[i][1], pts[i][0]], [g1, pts[i][1], pts[i][0]], [g1, pts[i + 1][1], pts[i + 1][0]], [g0, pts[i + 1][1], pts[i + 1][0]]];
        b.add(quad(s < 0 ? q : [q[1], q[0], q[3], q[2]], A.get('nose'), [[0, i * 0.5], [1, i * 0.5], [1, i * 0.5 + 0.5], [0, i * 0.5 + 0.5]]), L.hull);
      }
    }
  });
  // Schuerze vorn und hinten, Unterseite / skirt front and rear, underside
  add([[-xb, y0, zf], [xb, y0, zf], [xb, y1, zf], [-xb, y1, zf]], A.get('nose'), [[0, 1], [1, 1], [1, 0.6], [0, 0.6]]);
  add([[xb, y0, zr], [-xb, y0, zr], [-xb, y1, zr], [xb, y1, zr]], A.get('nose'), [[0, 1], [1, 1], [1, 0.6], [0, 0.6]]);
  add([[-xb, y0, zr], [xb, y0, zr], [xb, y0, zf], [-xb, y0, zf]], A.get('blank'), [[0, 0], [1, 0], [1, 1], [0, 1]], shade(L.hull, 0.4));
  // Wannenunterteil zwischen den Ketten / lower hull between the tracks
  b.add(projectBox(geo.profileZY([[-0.2, 0.04], [0.165, 0.04], [0.214, y0 + 0.001], [-0.212, y0 + 0.001]], 0.228), { pz: A.get('nose'), all: A.get('blank') }), shade(L.hull, 0.72));
}

/** Punkt und Normale auf dem Kettenlauf, u = 0..1 ab der Mitte oben nach vorn / point and normal on the track run, u = 0..1 from the top centre forward */
function trackAt(u: number, inset = 0): { z: number; y: number; nz: number; ny: number } {
  const r = TRACK.h / 2, half = TRACK.len / 2 - r;
  const total = 4 * half + 2 * Math.PI * r;
  let d = (((u % 1) + 1) % 1) * total;
  const rr = r - inset;
  if (d < half) return { z: d, y: r + rr, nz: 0, ny: 1 };
  d -= half;
  if (d < Math.PI * r) { const a = d / r; return { z: half + Math.sin(a) * rr, y: r + Math.cos(a) * rr, nz: Math.sin(a), ny: Math.cos(a) }; }
  d -= Math.PI * r;
  if (d < 2 * half) return { z: half - d, y: r - rr, nz: 0, ny: -1 };
  d -= 2 * half;
  if (d < Math.PI * r) { const a = d / r; return { z: -half - Math.sin(a) * rr, y: r - Math.cos(a) * rr, nz: -Math.sin(a), ny: -Math.cos(a) }; }
  d -= Math.PI * r;
  return { z: -half + d, y: r + rr, nz: 0, ny: 1 };
}

/** Rad als Loft entlang x mit gezeichneter Aussenseite / wheel as a loft along x with a drawn outer face */
function wheel(b: UvBuilder, A: AtlasLayout, x: number, y: number, z: number, r: number, w: number, face: Region, c: ColorLike, seg: number): void {
  // Reifen dunkel, Radscheibe in der Farbe c mit gezeichneter Nabe / tyre dark, wheel disc in colour c with a drawn hub
  b.add(loft([
    { y: w / 2, rx: r * 0.84, hard: true }, { y: w / 2 - 0.004, rx: r, hard: true }, { y: -w / 2, rx: r, hard: true },
  ], { seg, region: A.get('tyre'), capFirst: true, color: mat.dark }), null, { xf: { p: [x, y, z], r: [0, 0, -HALF_PI] } });
  b.add(loft([
    { y: w / 2 + 0.0035, rx: r * 0.66, hard: true }, { y: w / 2 - 0.001, rx: r * 0.8, hard: true },
  ], { seg, region: A.get('tyre'), capFirst: face, color: c }), null, { xf: { p: [x, y, z], r: [0, 0, -HALF_PI] }, gloss: 0.3 });
}

/** Laufwerk einer Seite (bei +x gebaut, gespiegelt fuer -x) / running gear of one side (built at +x, mirrored for -x) */
function runningGear(b: UvBuilder, A: AtlasLayout, L: Look, low: boolean): void {
  const { x, w, links, thick, h } = TRACK;
  const x0 = x - w / 2, x1 = x + w / 2;
  for (let i = 0; i < links; i++) {
    const p = trackAt(i / links), q = trackAt((i + 1) / links);
    const pi = trackAt(i / links, thick), qi = trackAt((i + 1) / links, thick);
    // Lauffläche, Aussenkante, Innenseite / tread, outer edge, inner face
    b.add(quad([[x0, p.y, p.z], [x0, q.y, q.z], [x1, q.y, q.z], [x1, p.y, p.z]], A.get('link'), [[0, 0], [0, 1], [1, 1], [1, 0]]), mat.dark, { crease: 0 });
    b.add(quad([[x1, p.y, p.z], [x1, q.y, q.z], [x1, qi.y, qi.z], [x1, pi.y, pi.z]], A.get('linkSide'), [[0, 0], [1, 0], [1, 1], [0, 1]]), mat.dark, { crease: 0.6 });
    b.add(quad([[x0, pi.y, pi.z], [x1, pi.y, pi.z], [x1, qi.y, qi.z], [x0, qi.y, qi.z]], A.get('blank'), [[0, 0], [1, 0], [1, 1], [0, 1]]), mat.ink, { crease: 0 });
  }
  // Rueckwand des Laufwerks: dunkle Wanne mit gezeichneter Federung / back wall of the running gear: dark hull with drawn suspension
  const bay: number[] = [], bayUv: [number, number][] = [];
  const n = 28, half = TRACK.len / 2;
  for (let i = 0; i < n; i++) {
    const p = trackAt(i / n, thick * 0.5), q = trackAt((i + 1) / n, thick * 0.5);
    for (const v of [{ z: 0, y: h / 2 }, p, q]) { bay.push(x0 + 0.012, v.y, v.z); bayUv.push([(half - v.z) / (2 * half), 1 - v.y / h]); }
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bay, 3));
  const r = A.get('bay');
  bg.setAttribute('uv', new THREE.Float32BufferAttribute(bayUv.flatMap(([s, t]) => [(r.x + s * r.w) / REF, (r.y + t * r.h) / REF]), 2));
  b.add(bg, shade(L.hullDark, 0.5), { crease: 0 });
  // Laufrollen, Treibrad vorn, Leitrad hinten, Stuetzrollen / road wheels, sprocket front, idler rear, return rollers
  const seg = low ? 12 : 20, wr = 0.0375, span = TRACK.len - 0.118;
  const wx = x + 0.004, ww = 0.064;
  for (let i = 0; i < 5; i++) wheel(b, A, wx, wr + thick - 0.002, -span / 2 + (i / 4) * span, wr, ww, A.get('wheel'), L.hullDark, seg);
  wheel(b, A, wx, h * 0.6, half - 0.034, 0.0295, ww * 0.8, A.get('sprocket'), L.trim, seg);
  wheel(b, A, wx, h * 0.58, -half + 0.036, 0.0275, ww * 0.8, A.get('sprocket'), L.hullDark, seg);
  for (let i = 0; i < 3; i++) wheel(b, A, wx, h - thick - 0.0125, -0.1 + i * 0.1, 0.0115, ww * 0.7, A.get('blank'), mat.metal, low ? 8 : 10);
}

/** Kanonenrohr entlang +z mit Huelse, Stufen und Muendungsbremse / gun barrel along +z with sleeve, steps and muzzle brake */
function gun(b: UvBuilder, A: AtlasLayout, L: Look, x: number, y: number, z0: number, len: number, seg: number): void {
  const r = 0.0185;
  b.add(loft([
    { y: 0, rx: r * 1.5, hard: true }, { y: -len * 0.16, rx: r * 1.45, hard: true }, { y: -len * 0.16, rx: r * 1.12, hard: true }, { y: -len * 0.5, rx: r * 1.04, hard: true },
    { y: -len * 0.5, rx: r * 1.24, hard: true }, { y: -len * 0.58, rx: r * 1.24, hard: true }, { y: -len * 0.58, rx: r, hard: true }, { y: -len + 0.03, rx: r * 0.94 },
  ], { seg, region: A.get('gun'), color: L.hullDark }), null, { xf: { p: [x, y, z0], r: [-HALF_PI, 0, 0] }, gloss: 0.6 });
  // Muendungsbremse als Kasten, Muendung dunkel / muzzle brake as a box, dark bore
  b.add(softBox(r * 2.7, r * 2.3, 0.044, r * 0.5), mat.dark, { xf: { p: [x, y, z0 + len - 0.014] }, gloss: 0.4 });
  for (const s of [-1, 1]) b.add(softBox(0.003, r * 1.5, 0.01, 0.001), mat.ink, { xf: { p: [x + s * r * 1.36, y, z0 + len - 0.022] }, crease: 0 });
  for (const s of [-1, 1]) b.add(softBox(0.003, r * 1.5, 0.01, 0.001), mat.ink, { xf: { p: [x + s * r * 1.36, y, z0 + len - 0.006] }, crease: 0 });
  b.add(loft([{ y: 0, rx: r * 0.7 }, { y: 0.002, rx: r * 0.7 }], { seg: 10, region: A.get('blank'), capLast: true, color: mat.ink }), null, { xf: { p: [x, y, z0 + len + 0.0065], r: [HALF_PI, 0, 0] }, crease: 0 });
}

/** Korvat-Panzer / Korvat tank */
export function tankB(f: FactionId, A: AtlasLayout, low = false): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const seg = low ? 16 : 28;
  hull(b, A, L);
  b.mirrorX(() => runningGear(b, A, L, low));
  // Faesser am Heck / drums at the rear
  for (const s of [-1, 1]) {
    b.add(loft([{ y: 0.056, rx: 0.029, hard: true }, { y: 0.053, rx: 0.033, hard: true }, { y: -0.053, rx: 0.033, hard: true }, { y: -0.056, rx: 0.029, hard: true }], { seg: low ? 12 : 18, region: A.get('drum'), capFirst: A.get('drumEnd'), capLast: A.get('drumEnd'), color: L.trim }), null, { xf: { p: [s * 0.072, HULL.y2 + 0.012, -0.204], r: [0.5, 0, HALF_PI] }, gloss: 0.3 });
  }
  b.add(softBox(0.31, 0.01, 0.014, 0.003), mat.dark, { xf: { p: [0, HULL.y2 - 0.012, -0.212] } });
  // Auspuffrohre, Scheinwerfer, Bug-MG / exhaust pipes, headlights, bow MG
  for (const s of [-1, 1]) {
    b.add(loft([{ y: 0.05, rx: 0.011, hard: true }, { y: 0.05, rx: 0.0135, hard: true }, { y: 0, rx: 0.015 }], { seg: 10, region: A.get('exhaust'), capFirst: A.get('blank'), color: mat.darkMid }), null, { xf: { p: [s * 0.158, HULL.y2 - 0.004, -0.15], r: [-0.25, 0, 0] } });
    b.add(loft([{ y: 0.012, rx: 0.011, hard: true }, { y: 0.012, rx: 0.0135, hard: true }, { y: -0.01, rx: 0.011 }, { y: -0.014, rx: TIP }], { seg: 12, region: A.get('blank'), color: L.hullDark }), null, { xf: { p: [s * 0.185, HULL.y1 + 0.03, 0.2], r: [HALF_PI - 0.15, 0, 0] } });
    b.add(loft([{ y: 0.0125, rx: 0.011 }, { y: 0.016, rx: TIP }], { seg: 12, region: A.get('blank'), color: mat.lamp }), null, { xf: { p: [s * 0.185, HULL.y1 + 0.03, 0.2], r: [HALF_PI - 0.15, 0, 0] }, gloss: 1, crease: 0 });
  }
  b.add(loft([{ y: 0.014, rx: TIP }, { y: 0.01, rx: 0.011 }, { y: 0, rx: 0.016 }], { seg: 12, region: A.get('blank'), color: L.hullDark }), null, { xf: { p: [0.1, 0.14, 0.186], r: [0.9, 0, 0] } });
  b.add(loft([{ y: 0.05, rx: 0.0038 }, { y: 0, rx: 0.0042 }], { seg: 6, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [0.1, 0.146, 0.194], r: [0.9, 0, 0] }, crease: 0 });

  // ---- Drehturm / turret ----
  const ty = TURRET.y, tz = TURRET.z;
  b.turret([0, ty, tz], () => {
    b.group({ p: [0, 0, tz] }, () => {
      b.add(loft(turretRings(L), { seg: seg + 4, region: A.get('turret'), capFirst: A.get('turretTop') }), null);
      // Blende und zwei Rohre / mantlet and two barrels
      b.add(projectBox(softBox(0.176, 0.064, 0.052, 0.017, 1), { pz: A.get('mantlet'), all: A.get('blank') }), L.hullDark, { xf: { p: [0, ty + 0.047, 0.118] } });
      for (const x of [-0.04, 0.04]) gun(b, A, L, x, ty + 0.049, 0.138, 0.43 - tz - 0.138 - 0.012, low ? 12 : 18);
      // Staukasten und Plane am Turmheck / stowage bin and tarp at the turret rear
      b.add(projectBox(softBox(0.19, 0.04, 0.042, 0.007), { nz: A.get('bin'), all: A.get('blank') }), L.trim, { xf: { p: [0, ty + 0.036, -0.142] } });
      b.add(loft([{ y: 0.075, rx: TIP }, { y: 0.07, rx: 0.014 }, { y: 0.04, rx: 0.0175 }, { y: -0.04, rx: 0.0165 }, { y: -0.07, rx: 0.014 }, { y: -0.075, rx: TIP }], { seg: 12, region: A.get('tarp'), color: L.gear }), null, { xf: { p: [0, ty + 0.071, -0.142], r: [0, 0, HALF_PI] }, crease: 0 });
      // Kuppel mit offenem Deckel, Kommandant / cupola with open lid, commander
      const cx = -0.054, cz = -0.012, top = ty + 0.094;
      b.add(loft([{ y: 0.026, rx: 0.031, hard: true }, { y: 0.026, rx: 0.039, hard: true }, { y: 0.004, rx: 0.042, hard: true }, { y: 0, rx: 0.045 }], { seg: low ? 12 : 18, region: A.get('blank'), color: L.hullDark }), null, { xf: { p: [cx, top - 0.002, cz] } });
      b.add(loft([{ y: 0.007, rx: 0.036, hard: true }, { y: 0, rx: 0.038, hard: true }], { seg: low ? 12 : 18, region: A.get('blank'), capFirst: A.get('hatch'), capLast: A.get('hatch'), color: L.hull }), null, { xf: { p: [cx, top + 0.058, cz - 0.05], r: [-1.2, 0, 0] } });
      b.group({ p: [cx, top + 0.045 - 0.443 * 0.6, cz], s: 0.6 }, () => {
        const fr = new AtlasLayout();
        for (const nm of ['head', 'helmet', 'torso', 'upperArm', 'foreArm', 'hand', 'ear', 'strap', 'pouch', 'blank']) { const r = A.get(nm); fr.place(nm, r.x, r.y, r.w, r.h); }
        const nz = A.get('fNose');
        fr.place('nose', nz.x, nz.y, nz.w, nz.h);
        figure(b, fr, f, { pelvis: [0, 0.302, 0], head: [0.05, 0.25, 0], handL: [-0.092, 0.385, 0.062], handR: [0.094, 0.385, 0.058], elbowPoleL: [-1, -0.2, -0.3], elbowPoleR: [1, -0.2, -0.3] }, { legs: false, pack: false, seg: low ? 10 : 14 });
      });
      // Dach-MG mit Schild / roof MG with shield
      const mx = 0.06, mz = 0.0;
      b.add(loft([{ y: 0.03, rx: 0.007 }, { y: 0, rx: 0.011 }], { seg: 8, region: A.get('blank'), color: mat.dark }), null, { xf: { p: [mx, top, mz] } });
      b.add(softBox(0.02, 0.026, 0.07, 0.005), mat.dark, { xf: { p: [mx, top + 0.04, mz + 0.012] }, gloss: 0.4 });
      b.add(loft([{ y: 0.1, rx: 0.0052 }, { y: 0, rx: 0.006 }], { seg: 8, region: A.get('blank'), capFirst: true, color: mat.darkMid }), null, { xf: { p: [mx, top + 0.043, mz + 0.04], r: [HALF_PI, 0, 0] }, gloss: 0.6, crease: 0 });
      b.add(softBox(0.074, 0.046, 0.005, 0.002), L.trim, { xf: { p: [mx, top + 0.044, mz + 0.052], r: [-0.1, 0, 0] } });
      b.add(softBox(0.022, 0.022, 0.03, 0.004), L.gear, { xf: { p: [mx + 0.024, top + 0.03, mz + 0.004] } });
      // Antenne / antenna
      b.add(loft([{ y: 0.012, rx: 0.005, hard: true }, { y: 0, rx: 0.007 }], { seg: 8, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [0.078, ty + 0.086, -0.085] } });
      b.add(loft([{ y: 0.2, rx: 0.0014 }, { y: 0, rx: 0.0026 }], { seg: 5, region: A.get('blank'), color: mat.dark }), null, { xf: { p: [0.078, ty + 0.096, -0.085], r: [-0.12, 0, 0] }, crease: 0 });
      b.add(loft([{ y: 0.008, rx: TIP }, { y: 0, rx: 0.0065 }, { y: -0.008, rx: TIP }], { seg: 6, region: A.get('blank'), color: mix(L.trim, mat.white, 0.2) }), null, { xf: { p: [0.078, ty + 0.296, -0.109] }, crease: 0 });
    });
  });
  return b;
}
