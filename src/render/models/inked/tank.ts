/**
 * Gezeichnete Einheiten: Panzer der Korvat (auch vom Kult gefahren) als wenige grosse Flaechen mit Texturkoordinaten.
 * Inked units: the Korvat tank (also driven by the cult) as a few large surfaces with texture coordinates.
 *
 * Erkennungsmerkmale bleiben: rote Wanne, grosser gegossener Turm mit ZWEI Rohren, Faesser am Heck, Kommandant im Luk.
 * Die Wanne ist ein Koerper mit schraegen Flanken, Bug- und Heckplatte; das Laufwerk ist eine echte Kettenschleife
 * mit Raedern darin (trim.ts). Nieten, Schweissnaehte, Luken, Gitter, Werkzeug, Schlamm sind gezeichnet (tankPaint.ts),
 * Emblem und Kennziffern liegen als Auflagen in der Farbe der Fraktion darueber.
 * The marks of identity stay: red hull, large cast turret with TWO barrels, drums at the rear, commander in the hatch.
 * The hull is one body with sloped flanks, glacis and rear plate; the running gear is a real track loop with wheels
 * inside (trim.ts). Rivets, weld seams, hatches, grilles, tools, mud are drawn (tankPaint.ts), emblem and digits lie
 * on top as decals in the faction's colour.
 */
import type { FactionId } from '../../../data/balance';
import { fine, geo, mix, shade, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat, type Look } from '../look';
import { CREW, figure } from './figure';
import { barrel, decal, digitDecal, emblemDecal, fuelDrum, runningGear, type TrackSpec } from './trim';
import { AtlasLayout, loft, projectBox, quad, UvBuilder, type Region, type Ring } from './uvkit';

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
export const TRACK: TrackSpec = { x: 0.168, w: 0.104, len: 0.425, h: 0.096, links: 44, thick: 0.012 };
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

type Q = [V3, V3, V3, V3];

/** Wanne: Deck, Bug, Heck, schraege Flanken, Schuerze / hull: deck, glacis, rear, sloped flanks, skirt */
function hull(b: UvBuilder, A: AtlasLayout, L: Look, f: FactionId): void {
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
    // Emblem der Fraktion hinten auf der schraegen Flanke / the faction's emblem at the rear of the sloped flank
    const nx = (y2 - y1), ny = (xb - xd);
    emblemDecal(b, A, f, [s * (xb + xd) / 2, (y1 + y2) / 2, -0.155], [s * nx, ny, 0], 0.036, L.hull, [-s * ny, nx, 0]);
    // Kennung vor dem Emblem / marking in front of the emblem
    decal(b, A, 'mark:korvat', [s * (xd + 0.4 * (xb - xd)), y2 - 0.4 * (y2 - y1), -0.098], [s * nx, ny, 0], [-s * ny, nx, 0], 0.074, 0.025, L.hull);
  }
  // Staukaesten auf den schraegen Flanken (Oliv auf Rot: Kennzeichen der Korvat) und Kotfluegel vorn und hinten
  // stowage bins on the sloped flanks (olive on red: a Korvat mark) and mudguards front and rear
  b.mirrorX(() => {
    b.add(projectBox(softBox(0.05, 0.03, 0.15, 0.006), { py: A.get('crate'), all: A.get('blank') }), L.trim, { xf: { p: [(xb + xd) / 2 + 0.0098, (y1 + y2) / 2 + 0.0113, -0.02], r: [0, 0, -0.716] } });
    const g0 = 0.12, g1 = xb;
    for (const [za, zb, zc, s] of [[zf, zf + 0.022, zf + 0.034, 1], [zr, zr - 0.02, zr - 0.03, -1]] as const) {
      const pts: [number, number][] = [[za, y1], [zb, y1 - 0.008], [zc, y1 - 0.034]];
      for (let i = 0; i < 2; i++) {
        const q: Q = [[g0, pts[i][1], pts[i][0]], [g1, pts[i][1], pts[i][0]], [g1, pts[i + 1][1], pts[i + 1][0]], [g0, pts[i + 1][1], pts[i + 1][0]]];
        b.add(quad(s < 0 ? q : [q[1], q[0], q[3], q[2]], A.get('hullNose'), [[0, i * 0.5], [1, i * 0.5], [1, i * 0.5 + 0.5], [0, i * 0.5 + 0.5]]), L.hull);
      }
    }
  });
  // Schuerze vorn und hinten, Unterseite / skirt front and rear, underside
  add([[-xb, y0, zf], [xb, y0, zf], [xb, y1, zf], [-xb, y1, zf]], A.get('hullNose'), [[0, 1], [1, 1], [1, 0.6], [0, 0.6]]);
  add([[xb, y0, zr], [-xb, y0, zr], [-xb, y1, zr], [xb, y1, zr]], A.get('hullNose'), [[0, 1], [1, 1], [1, 0.6], [0, 0.6]]);
  add([[-xb, y0, zr], [xb, y0, zr], [xb, y0, zf], [-xb, y0, zf]], A.get('blank'), [[0, 0], [1, 0], [1, 1], [0, 1]], shade(L.hull, 0.4));
  // Wannenunterteil zwischen den Ketten / lower hull between the tracks
  b.add(projectBox(geo.profileZY([[-0.2, 0.04], [0.165, 0.04], [0.214, y0 + 0.001], [-0.212, y0 + 0.001]], 0.228), { pz: A.get('hullNose'), all: A.get('blank') }), shade(L.hull, 0.72));
}

/** Panzer der Korvat; A = Fahrzeugatlas / Korvat tank; A = vehicle atlas */
export function korvatTank(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const seg = hi ? 28 : 14;
  hull(b, A, L, f);
  b.mirrorX(() => runningGear(b, A, TRACK, { wheels: 5, wheelR: 0.0375, wheelColor: L.hullDark, sprocketColor: L.trim, idlerColor: L.hullDark, bayColor: shade(L.hullDark, 0.5) }));
  // Faesser am Heck / drums at the rear
  for (const s of [-1, 1]) fuelDrum(b, A, [s * 0.072, HULL.y2 + 0.012, -0.204], 0.033, 0.112, L.trim);
  b.add(softBox(0.31, 0.01, 0.014, 0.003), mat.dark, { xf: { p: [0, HULL.y2 - 0.012, -0.212] } });
  // Auspuffrohre, Scheinwerfer, Bug-MG / exhaust pipes, headlights, bow MG
  for (const s of [-1, 1]) {
    b.add(loft([{ y: 0.05, rx: 0.011, hard: true }, { y: 0.05, rx: 0.0135, hard: true }, { y: 0, rx: 0.015 }], { seg: hi ? 10 : 6, region: A.get('exhaust'), capFirst: A.get('blank'), color: mat.darkMid }), null, { xf: { p: [s * 0.158, HULL.y2 - 0.004, -0.15], r: [-0.25, 0, 0] } });
    b.add(loft([{ y: 0.012, rx: 0.011, hard: true }, { y: 0.012, rx: 0.0135, hard: true }, { y: -0.01, rx: 0.011 }, { y: -0.014, rx: TIP }], { seg: hi ? 12 : 8, region: A.get('blank'), color: L.hullDark }), null, { xf: { p: [s * 0.185, HULL.y1 + 0.03, 0.2], r: [HALF_PI - 0.15, 0, 0] } });
    b.add(loft([{ y: 0.0125, rx: 0.011 }, { y: 0.016, rx: TIP }], { seg: hi ? 12 : 8, region: A.get('blank'), color: mat.lamp }), null, { xf: { p: [s * 0.185, HULL.y1 + 0.03, 0.2], r: [HALF_PI - 0.15, 0, 0] }, gloss: 1, crease: 0 });
  }
  if (hi) {
    b.add(loft([{ y: 0.014, rx: TIP }, { y: 0.01, rx: 0.011 }, { y: 0, rx: 0.016 }], { seg: 12, region: A.get('blank'), color: L.hullDark }), null, { xf: { p: [0.1, 0.14, 0.186], r: [0.9, 0, 0] } });
    b.add(loft([{ y: 0.05, rx: 0.0038 }, { y: 0, rx: 0.0042 }], { seg: 6, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [0.1, 0.146, 0.194], r: [0.9, 0, 0] }, crease: 0 });
  }

  // ---- Drehturm / turret ----
  const ty = TURRET.y, tz = TURRET.z;
  b.turret([0, ty, tz], () => {
    b.group({ p: [0, 0, tz] }, () => {
      b.add(loft(turretRings(L), { seg: seg + 4, region: A.get('turret'), capFirst: A.get('turretTop') }), null);
      // Emblem und Kennziffern als Auflagen an beiden Flanken / emblem and digits as decals on both flanks
      for (const s of [-1, 1]) {
        emblemDecal(b, A, f, [s * 0.1285, ty + 0.047, -0.058], [s, 0.42, -0.2], 0.044, L.hull);
        if (hi) [2, 1, 7].forEach((n, i) => digitDecal(b, A, n, [s * 0.1335, ty + 0.045, s * (0.036 - i * 0.019) - 0.001], [s, 0.4, 0.04], 0.028, L.hull));
      }
      // Blende und zwei Rohre / mantlet and two barrels
      b.add(projectBox(softBox(0.176, 0.064, 0.052, 0.017, hi ? 1 : 0), { pz: A.get('mantlet'), all: A.get('blank') }), L.hullDark, { xf: { p: [0, ty + 0.047, 0.118] } });
      for (const x of [-0.04, 0.04]) barrel(b, A, { x, y: ty + 0.049, z0: 0.138, len: 0.43 - tz - 0.138 - 0.012, r: 0.0185, color: L.hullDark });
      // Staukasten und Plane am Turmheck / stowage bin and tarp at the turret rear
      b.add(projectBox(softBox(0.19, 0.04, 0.042, 0.007), { nz: A.get('crate'), all: A.get('blank') }), L.trim, { xf: { p: [0, ty + 0.036, -0.142] } });
      if (hi) b.add(loft([{ y: 0.075, rx: TIP }, { y: 0.07, rx: 0.014 }, { y: 0.04, rx: 0.0175 }, { y: -0.04, rx: 0.0165 }, { y: -0.07, rx: 0.014 }, { y: -0.075, rx: TIP }], { seg: 12, region: A.get('tarp'), color: L.gear }), null, { xf: { p: [0, ty + 0.071, -0.142], r: [0, 0, HALF_PI] }, crease: 0 });
      // Kuppel mit offenem Deckel, Kommandant / cupola with open lid, commander
      const cx = -0.054, cz = -0.012, top = ty + 0.094;
      b.add(loft([{ y: 0.026, rx: 0.031, hard: true }, { y: 0.026, rx: 0.039, hard: true }, { y: 0.004, rx: 0.042, hard: true }, { y: 0, rx: 0.045 }], { seg: hi ? 18 : 10, region: A.get('blank'), color: L.hullDark }), null, { xf: { p: [cx, top - 0.002, cz] } });
      b.add(loft([{ y: 0.007, rx: 0.036, hard: true }, { y: 0, rx: 0.038, hard: true }], { seg: hi ? 18 : 10, region: A.get('blank'), capFirst: A.get('hatch'), capLast: A.get('hatch'), color: L.hull }), null, { xf: { p: [cx, top + 0.058, cz - 0.05], r: [-1.2, 0, 0] } });
      b.group({ p: [cx, top + 0.045 - 0.443 * CREW, cz], s: CREW }, () => {
        figure(b, A, f, { pelvis: [0, 0.302, 0], head: [0.05, 0.25, 0], handL: [-0.092, 0.385, 0.062], handR: [0.094, 0.385, 0.058], footL: [0, 0, 0], footR: [0, 0, 0], elbowPoleL: [-1, -0.2, -0.3], elbowPoleR: [1, -0.2, -0.3] }, { detail: 0, noLegs: true, seed: 7 });
      });
      // Dach-MG mit Schild / roof MG with shield
      const mx = 0.06, mz = 0.0;
      b.add(loft([{ y: 0.03, rx: 0.007 }, { y: 0, rx: 0.011 }], { seg: 8, region: A.get('blank'), color: mat.dark }), null, { xf: { p: [mx, top, mz] } });
      b.add(softBox(0.02, 0.026, 0.07, 0.005), mat.dark, { xf: { p: [mx, top + 0.04, mz + 0.012] }, gloss: 0.4 });
      b.add(loft([{ y: 0.1, rx: 0.0052 }, { y: 0, rx: 0.006 }], { seg: hi ? 8 : 5, region: A.get('blank'), capFirst: true, color: mat.darkMid }), null, { xf: { p: [mx, top + 0.043, mz + 0.04], r: [HALF_PI, 0, 0] }, gloss: 0.6, crease: 0 });
      b.add(softBox(0.074, 0.046, 0.005, 0.002), L.trim, { xf: { p: [mx, top + 0.044, mz + 0.052], r: [-0.1, 0, 0] } });
      if (hi) b.add(softBox(0.022, 0.022, 0.03, 0.004), L.gear, { xf: { p: [mx + 0.024, top + 0.03, mz + 0.004] } });
      // Antenne / antenna
      b.add(loft([{ y: 0.012, rx: 0.005, hard: true }, { y: 0, rx: 0.007 }], { seg: hi ? 8 : 5, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [0.078, ty + 0.086, -0.085] } });
      b.add(loft([{ y: 0.2, rx: 0.0014 }, { y: 0, rx: 0.0026 }], { seg: hi ? 5 : 3, region: A.get('blank'), color: mat.dark }), null, { xf: { p: [0.078, ty + 0.096, -0.085], r: [-0.12, 0, 0] }, crease: 0 });
      b.add(loft([{ y: 0.008, rx: TIP }, { y: 0, rx: 0.0065 }, { y: -0.008, rx: TIP }], { seg: hi ? 6 : 4, region: A.get('blank'), color: mix(L.trim, mat.white, 0.2) }), null, { xf: { p: [0.078, ty + 0.296, -0.109] }, crease: 0 });
    });
  });
  return b;
}
