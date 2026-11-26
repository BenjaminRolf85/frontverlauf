/**
 * Gezeichnete Einheiten: Panzer der Dravon, Alvenia, Meridon und der Hightech-Bauart (Velkar, Zyrr, NEXUS).
 * Inked units: the tanks of Dravon, Alvenia, Meridon and the hi-tech design (Velkar, Zyrr, NEXUS).
 *
 * Alle teilen den Wannenbau des Korvat-Panzers (tankHull: Deck, Bug, Heck, schraege Flanken, Schuerze, echtes Laufwerk)
 * und seine Wannenzellen; jede Fraktion hat eigene Masse, einen eigenen Turm mit eigener Zelle und ihre Kennzeichen:
 * - Dravon: hoher kantiger Turm (Achteck), EIN uebergrosses Rohr mit grosser Muendungsbremse, goldene Leisten.
 * - Alvenia: runde Gusskuppel mit Goldband, Kugelblende, runde Kotfluegel, grosses Sonnenemblem.
 * - Meridon: leichter Panzer, kleiner Turm mit orangefarbener Staukiste, Behaelter am Heck, Wimpel.
 * - Hightech: flache Wanne, flacher Scheibenturm mit Leuchtband, langes Rohr, Sensormast statt Kommandant.
 * All of them share the Korvat tank's hull construction (tankHull: deck, glacis, rear, sloped flanks, skirt, real
 * running gear) and its hull cells; each faction has its own dimensions, its own turret with its own cell and its marks:
 * - Dravon: tall faceted turret (octagon), ONE oversized barrel with a large muzzle brake, gold strips.
 * - Alvenia: round cast dome with a gold band, ball mantlet, round mudguards, large sun emblem.
 * - Meridon: light tank, small turret with an orange stowage box, containers at the rear, pennant.
 * - Hi-tech: flat hull, flat disc turret with a light band, long barrel, sensor mast instead of a commander.
 */
import type { FactionId } from '../../../data/balance';
import { fine, geo, mix, shade, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat, styleOf, type Look } from '../look';
import { arch, boxed, cupola, facet, machineGun, TIP, tube, type Poly } from './body';
import { barrel, digitDecal, emblemDecal, runningGear, type TrackSpec } from './trim';
import { AtlasLayout, loft, loftAt, projectBox, quad, UvBuilder, type Region, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;
type Q = [V3, V3, V3, V3];

/** Masse einer Wanne (wie HULL in tank.ts) / hull dimensions (as HULL in tank.ts) */
export interface HullSpec { y0: number; y1: number; y2: number; xb: number; xd: number; zf: number; zr: number; zdf: number; zdr: number }

/** Anteil der Decklaenge vom Bug bis zum Turmkranz: dort zeichnet die Deckzelle den Bolzenkranz / share of the deck length from the bow to the turret ring: the deck cell draws the bolt circle there */
export const RING_AT = 0.577;
export const ringZ = (H: HullSpec): number => H.zdf - RING_AT * (H.zdf - H.zdr);

/**
 * Wanne mit den Wannenzellen (deck, glacis, rear, hullSide, hullNose): Deck, Bug, Heck, schraege Flanken, Schuerze,
 * Kotfluegel, Unterwanne. Emblem hinten auf den Flanken.
 * Hull with the hull cells: deck, glacis, rear, sloped flanks, skirt, mudguards, lower hull. Emblem at the rear of the
 * flanks.
 */
export function tankHull(b: UvBuilder, A: AtlasLayout, L: Look, f: FactionId, H: HullSpec, T: TrackSpec, o: { color?: ColorLike; guards?: boolean; emblemZ?: number; emblem?: number } = {}): void {
  const { y0, y1, y2, xb, xd, zf, zr, zdf, zdr } = H;
  const hull = o.color ?? L.hull;
  const add = (pts: Q, r: Region, st: [number, number][], c: ColorLike = hull) => b.add(quad(pts, r, st), c);
  const sx = (x: number) => (xb - x) / (2 * xb);
  add([[-xd, y2, zdf], [xd, y2, zdf], [xd, y2, zdr], [-xd, y2, zdr]], A.get('deck'), [[1, 0], [0, 0], [0, 1], [1, 1]]);
  add([[-xb, y1, zf], [xb, y1, zf], [xd, y2, zdf], [-xd, y2, zdf]], A.get('glacis'), [[1 - sx(-xb), 1], [1 - sx(xb), 1], [1 - sx(xd), 0], [1 - sx(-xd), 0]]);
  add([[xb, y1, zr], [-xb, y1, zr], [-xd, y2, zdr], [xd, y2, zdr]], A.get('rear'), [[sx(xb), 1], [sx(-xb), 1], [sx(-xd), 0], [sx(xd), 0]]);
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
    if (o.emblem !== 0) {
      const nx = y2 - y1, ny = xb - xd;
      emblemDecal(b, A, f, [(s * (xb + xd)) / 2, (y1 + y2) / 2, o.emblemZ ?? zr + 0.062], [s * nx, ny, 0], o.emblem ?? 0.036, hull, [-s * ny, nx, 0]);
    }
  }
  if (o.guards !== false) b.mirrorX(() => {
    const g0 = T.x - T.w / 2 + 0.004, g1 = xb;
    for (const [za, zb, zc, s] of [[zf, zf + 0.022, zf + 0.034, 1], [zr, zr - 0.02, zr - 0.03, -1]] as const) {
      const pts: [number, number][] = [[za, y1], [zb, y1 - 0.008], [zc, y1 - 0.034]];
      for (let i = 0; i < 2; i++) {
        const q: Q = [[g0, pts[i][1], pts[i][0]], [g1, pts[i][1], pts[i][0]], [g1, pts[i + 1][1], pts[i + 1][0]], [g0, pts[i + 1][1], pts[i + 1][0]]];
        b.add(quad(s < 0 ? q : [q[1], q[0], q[3], q[2]], A.get('hullNose'), [[0, i * 0.5], [1, i * 0.5], [1, i * 0.5 + 0.5], [0, i * 0.5 + 0.5]]), hull);
      }
    }
  });
  add([[-xb, y0, zf], [xb, y0, zf], [xb, y1, zf], [-xb, y1, zf]], A.get('hullNose'), [[0, 1], [1, 1], [1, 0.6], [0, 0.6]]);
  add([[xb, y0, zr], [-xb, y0, zr], [-xb, y1, zr], [xb, y1, zr]], A.get('hullNose'), [[0, 1], [1, 1], [1, 0.6], [0, 0.6]]);
  add([[-xb, y0, zr], [xb, y0, zr], [xb, y0, zf], [-xb, y0, zf]], A.get('blank'), [[0, 0], [1, 0], [1, 1], [0, 1]], shade(hull, 0.4));
  b.add(projectBox(geo.profileZY([[zr + 0.016, 0.04], [zf - 0.057, 0.04], [zf - 0.008, y0 + 0.001], [zr + 0.004, y0 + 0.001]], 2 * (T.x - T.w / 2) - 0.004), { pz: A.get('hullNose'), all: A.get('blank') }), shade(hull, 0.72));
}

/** Laufwerk beider Seiten / running gear of both sides */
export function tankGear(b: UvBuilder, A: AtlasLayout, T: TrackSpec, wheels: number, wheelC: ColorLike, sprocketC: ColorLike, bay: ColorLike): void {
  b.mirrorX(() => runningGear(b, A, T, { wheels, wheelR: T.h * 0.39, wheelColor: wheelC, sprocketColor: sprocketC, idlerColor: wheelC, bayColor: bay }));
}

/** Auspuffrohre am Heck, Scheinwerfer am Bug / exhaust pipes at the rear, headlights at the bow */
function hullFittings(b: UvBuilder, A: AtlasLayout, L: Look, H: HullSpec, lamp: ColorLike = mat.lamp): void {
  const hi = fine();
  for (const s of [-1, 1]) {
    b.add(loft([{ y: 0.05, rx: 0.011, hard: true }, { y: 0.05, rx: 0.0135, hard: true }, { y: 0, rx: 0.015 }], { seg: hi ? 10 : 6, region: A.get('exhaust'), capFirst: A.get('blank'), color: mat.darkMid }), null, { xf: { p: [s * (H.xd - 0.026), H.y2 - 0.004, H.zdr + 0.018], r: [-0.25, 0, 0] } });
    const lp: V3 = [s * (H.xd + 0.001), H.y1 + 0.03, H.zf - 0.022];
    b.add(loft([{ y: 0.012, rx: 0.011, hard: true }, { y: 0.012, rx: 0.0135, hard: true }, { y: -0.01, rx: 0.011 }, { y: -0.014, rx: TIP }], { seg: hi ? 12 : 8, region: A.get('blank'), color: L.hullDark }), null, { xf: { p: lp, r: [HALF_PI - 0.15, 0, 0] } });
    b.add(loft([{ y: 0.0125, rx: 0.011 }, { y: 0.016, rx: TIP }], { seg: hi ? 12 : 8, region: A.get('blank'), color: lamp }), null, { xf: { p: lp, r: [HALF_PI - 0.15, 0, 0] }, gloss: 1, crease: 0 });
  }
}

/** Antenne mit Fuss und Spitze / antenna with base and tip */
function antenna(b: UvBuilder, A: AtlasLayout, p: V3, h: number, tip: ColorLike, lean = -0.12): void {
  const hi = fine();
  b.add(loft([{ y: 0.012, rx: 0.005, hard: true }, { y: 0, rx: 0.007 }], { seg: hi ? 8 : 5, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p } });
  b.add(loft([{ y: h, rx: 0.0014 }, { y: 0, rx: 0.0026 }], { seg: hi ? 5 : 3, region: A.get('blank'), color: mat.dark }), null, { xf: { p: [p[0], p[1] + 0.01, p[2]], r: [lean, 0, 0] }, crease: 0 });
  b.add(loft([{ y: 0.008, rx: TIP }, { y: 0, rx: 0.0065 }, { y: -0.008, rx: TIP }], { seg: hi ? 6 : 4, region: A.get('blank'), color: tip }), null, { xf: { p: [p[0], p[1] + 0.01 + Math.cos(lean) * h, p[2] + Math.sin(lean) * h] }, crease: 0 });
}

/** Emblem und Kennziffern auf beiden Turmflanken (auf der Loftflaeche) / emblem and digits on both turret flanks (on the loft surface) */
function turretMarks(b: UvBuilder, A: AtlasLayout, f: FactionId, rings: Ring[], y: number, surface: ColorLike, digits: number[], size = 0.044): void {
  for (const s of [-1, 1]) {
    // s = 0.75 ist +x; etwas nach hinten fuer das Emblem, davor die Ziffern / s = 0.75 is +x; a little aft for the emblem, the digits in front of it
    const at = (d: number) => loftAt(rings, 0.5 + s * (0.25 + d), y);
    const e = at(0.07);
    emblemDecal(b, A, f, [e.p.x, e.p.y, e.p.z], [e.n.x, e.n.y, e.n.z], size, surface);
    if (fine()) digits.forEach((n, i) => { const q = at(-0.035 - i * 0.03); digitDecal(b, A, n, [q.p.x, q.p.y, q.p.z], [q.n.x, q.n.y, q.n.z], 0.028, surface); });
  }
}

/** Dachausstattung an den Stellen, die die Dachzelle 'turretTop' zeichnet: Kuppel links, MG rechts / roof fittings at the places the roof cell 'turretTop' draws: cupola left, MG right */
function roofPlaces(hw: number, hd: number, cz = 0): { cup: [number, number]; mg: [number, number] } {
  return { cup: [-0.587 * hw, cz - 0.13 * hd], mg: [0.652 * hw, cz] };
}

// ---------- Dravon ----------

function dravonTank(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const H: HullSpec = { y0: 0.1, y1: 0.118, y2: 0.168, xb: 0.226, xd: 0.188, zf: 0.232, zr: -0.222, zdf: 0.128, zdr: -0.182 };
  const T: TrackSpec = { x: 0.158, w: 0.1, len: 0.432, h: 0.1, links: 44, thick: 0.012 };
  tankHull(b, A, L, f, H, T);
  tankGear(b, A, T, 5, L.hullDark, L.trim, shade(L.hullDark, 0.5));
  hullFittings(b, A, L, H);
  // goldene Leisten an den Schuerzen, Bugkeil / gold strips on the skirts, bow wedge
  for (const s of [-1, 1]) b.add(softBox(0.006, 0.011, H.zf - H.zr - 0.05, 0.002), L.trim, { xf: { p: [s * (H.xb + 0.002), H.y1 - 0.003, (H.zf + H.zr) / 2] }, gloss: 0.5 });
  b.add(softBox(0.2, 0.012, 0.008, 0.003), L.trim, { xf: { p: [0, H.y1 + 0.012, H.zf - 0.02], r: [-0.45, 0, 0] }, gloss: 0.5 });
  const ty = H.y2, tz = ringZ(H);
  b.turret([0, ty, tz], () => {
    b.group({ p: [0, 0, tz] }, () => {
      // Achteck: Dach, Wand nach aussen, Kragen in der Zweitfarbe / octagon: roof, wall flaring out, collar in the secondary colour
      const oct = (y: number, w: number, d: number, k: number, cz: number, c?: ColorLike): Poly => ({ y, c, pts: [[-w + k, -d + cz], [-w, -d + k + cz], [-w, d - k + cz], [-w + k, d + cz], [w - k, d + cz], [w, d - k + cz], [w, -d + k + cz], [w - k, -d + cz]] });
      const roofW = 0.092, roofD = 0.084, roofZ = -0.014, top = ty + 0.108;
      facet(b, [oct(top, roofW, roofD, 0.034, roofZ), oct(ty + 0.058, 0.124, 0.114, 0.046, -0.004), oct(ty + 0.014, 0.132, 0.124, 0.05, 0)], { region: A.get('turret:dravon'), top: A.get('turretTop'), color: L.hull, t0: 0, t1: 0.86 });
      facet(b, [oct(ty + 0.014, 0.112, 0.106, 0.042, 0, L.trim), oct(ty - 0.001, 0.112, 0.106, 0.042, 0)], { region: A.get('turret:dravon'), color: L.trim, t0: 0.88, t1: 1 });
      for (const s of [-1, 1]) {
        emblemDecal(b, A, f, [s * 0.1295, ty + 0.038, -0.022], [s, 0.18, 0], 0.046, L.hull);
        if (hi) [1, 0, 4].forEach((n, i) => digitDecal(b, A, n, [s * 0.1285, ty + 0.038, s * (0.05 - i * 0.02) + 0.008], [s, 0.18, 0], 0.03, L.hull));
      }
      // kantige Blende, EIN uebergrosses Rohr / angular mantlet, ONE oversized barrel
      b.add(projectBox(softBox(0.128, 0.076, 0.06, 0.008), { pz: A.get('mantlet'), all: A.get('blank') }), L.hullDark, { xf: { p: [0, ty + 0.05, 0.128] } });
      barrel(b, A, { x: 0, y: ty + 0.05, z0: 0.15, len: 0.448 - tz - 0.15 - 0.016, r: 0.0265, color: L.hullDark });
      if (hi) for (const s of [-1, 1]) b.add(softBox(0.008, 0.008, 0.1, 0.002), L.trim, { xf: { p: [s * 0.034, ty + 0.05, 0.22] }, gloss: 0.5 });
      // Staukasten am Turmheck / stowage bin at the turret rear
      b.add(projectBox(softBox(0.17, 0.04, 0.04, 0.006), { nz: A.get('crate'), all: A.get('blank') }), L.hullDark, { xf: { p: [0, ty + 0.04, -0.142] } });
      const R = roofPlaces(roofW, roofD, roofZ);
      cupola(b, A, f, [R.cup[0], top, R.cup[1]], L.hullDark, L.hull, { seed: 7 });
      // Dach-MG mit goldenem Schild / roof MG with a gold shield
      tube(b, A, [R.mg[0], top, R.mg[1]], [R.mg[0], top + 0.03, R.mg[1]], 0.01, 0.007, mat.dark, 6);
      machineGun(b, A, [R.mg[0], top + 0.042, R.mg[1] + 0.006], { k: 1.25, shield: L.trim, box: hi ? L.gear : undefined, len: 0.085 });
      antenna(b, A, [0.07, top - 0.004, -0.07], 0.18, L.trim);
      antenna(b, A, [-0.012, top - 0.004, -0.082], 0.13, L.trim);
    });
  });
  return b;
}

// ---------- Alvenia ----------

function alveniaRings(L: Look, ty: number): Ring[] {
  return [
    { y: ty + 0.1, rx: 0.07, rz: 0.062, rzB: 0.066, e: 2.2, hard: true, c: L.hull },
    { y: ty + 0.09, rx: 0.098, rz: 0.088, rzB: 0.092, e: 2.2 },
    { y: ty + 0.062, rx: 0.124, rz: 0.114, rzB: 0.118, e: 2.25 },
    { y: ty + 0.03, rx: 0.132, rz: 0.122, rzB: 0.126, e: 2.3 },
    { y: ty + 0.015, rx: 0.129, rz: 0.119, rzB: 0.123, e: 2.3, hard: true },
    { y: ty + 0.014, rx: 0.136, rz: 0.126, rzB: 0.13, e: 2.3, hard: true, c: L.trim },
    { y: ty + 0.004, rx: 0.136, rz: 0.126, rzB: 0.13, e: 2.3, hard: true },
    { y: ty - 0.001, rx: 0.124, rz: 0.114, rzB: 0.118, e: 2.3 },
  ];
}

function alveniaTank(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const H: HullSpec = { y0: 0.097, y1: 0.115, y2: 0.158, xb: 0.222, xd: 0.186, zf: 0.214, zr: -0.21, zdf: 0.15, zdr: -0.166 };
  const T: TrackSpec = { x: 0.158, w: 0.098, len: 0.412, h: 0.094, links: 44, thick: 0.012 };
  tankHull(b, A, L, f, H, T, { guards: false, emblem: 0 });
  tankGear(b, A, T, 5, L.hull, L.trim, shade(L.hullDark, 0.45));
  hullFittings(b, A, L, H);
  // runde Kotfluegel ueber den Kettenenden, goldene Deckleisten / round mudguards over the track ends, gold deck strips
  const r = T.h / 2;
  b.mirrorX(() => {
    for (const s of [-1, 1]) b.add(arch([T.x, r, s * (T.len / 2 - r)], r + 0.006, r + 0.014, T.w + 0.008, s > 0 ? -0.1 : -1.5, s > 0 ? 1.5 : 0.1, hi ? 8 : 4), L.hull);
    b.add(softBox(0.007, 0.007, H.zdf - H.zdr, 0.002), L.trim, { xf: { p: [H.xd, H.y2 + 0.001, (H.zdf + H.zdr) / 2] }, gloss: 0.6 });
  });
  const ty = H.y2, tz = ringZ(H);
  b.turret([0, ty, tz], () => {
    b.group({ p: [0, 0, tz] }, () => {
      const rings = alveniaRings(L, ty);
      b.add(loft(rings, { seg: hi ? 32 : 16, region: A.get('turret:alvenia'), capFirst: A.get('turretTop') }), null);
      turretMarks(b, A, f, rings, ty + 0.05, L.hull, [], 0.058);
      // Kugelblende mit Goldring, ein Rohr / ball mantlet with a gold ring, one barrel
      b.add(loft([{ y: 0.052, rx: TIP }, { y: 0.046, rx: 0.03 }, { y: 0.028, rx: 0.046 }, { y: 0.004, rx: 0.052 }, { y: -0.02, rx: 0.046 }], { seg: hi ? 16 : 9, region: A.get('blank'), color: L.hull }), null, { xf: { p: [0, ty + 0.048, 0.104], r: [HALF_PI, 0, 0] } });
      b.add(loft([{ y: 0.012, rx: 0.03, hard: true }, { y: 0.012, rx: 0.036, hard: true }, { y: 0, rx: 0.036, hard: true }], { seg: hi ? 16 : 9, region: A.get('blank'), color: L.trim }), null, { xf: { p: [0, ty + 0.048, 0.142], r: [HALF_PI, 0, 0] }, gloss: 0.6 });
      barrel(b, A, { x: 0, y: ty + 0.048, z0: 0.15, len: 0.448 - tz - 0.15 - 0.014, r: 0.021, color: L.hull });
      const top = ty + 0.1;
      const R = roofPlaces(0.07, 0.064, 0);
      cupola(b, A, f, [R.cup[0], top, R.cup[1]], L.trim, L.hull, { seed: 7 });
      tube(b, A, [R.mg[0], top - 0.004, R.mg[1]], [R.mg[0], top + 0.028, R.mg[1]], 0.01, 0.007, mat.dark, 6);
      machineGun(b, A, [R.mg[0], top + 0.04, R.mg[1] + 0.006], { shield: L.trim, len: 0.09 });
      // Staukasten mit Goldleiste am Turmheck / stowage bin with a gold strip at the turret rear
      b.add(projectBox(softBox(0.15, 0.036, 0.036, 0.008), { nz: A.get('crate'), all: A.get('blank') }), L.hull, { xf: { p: [0, ty + 0.04, -0.14] } });
      antenna(b, A, [0.05, ty + 0.088, -0.07], 0.2, L.trim);
    });
  });
  return b;
}

// ---------- Meridon ----------

function meridonRings(L: Look, ty: number): Ring[] {
  return [
    { y: ty + 0.082, rx: 0.074, rz: 0.066, rzB: 0.07, e: 3.6, hard: true, c: L.hull },
    { y: ty + 0.074, rx: 0.088, rz: 0.082, rzB: 0.084, e: 3.6 },
    { y: ty + 0.04, rx: 0.102, rz: 0.098, rzB: 0.098, e: 3.8 },
    { y: ty + 0.014, rx: 0.106, rz: 0.102, rzB: 0.1, e: 3.8, hard: true },
    { y: ty + 0.013, rx: 0.098, rz: 0.094, rzB: 0.094, e: 3.6, hard: true, c: L.trim },
    { y: ty - 0.001, rx: 0.098, rz: 0.094, rzB: 0.094, e: 3.6 },
  ];
}

function meridonTank(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const H: HullSpec = { y0: 0.092, y1: 0.108, y2: 0.15, xb: 0.2, xd: 0.162, zf: 0.2, zr: -0.196, zdf: 0.142, zdr: -0.152 };
  const T: TrackSpec = { x: 0.142, w: 0.092, len: 0.386, h: 0.09, links: 40, thick: 0.011 };
  tankHull(b, A, L, f, H, T);
  tankGear(b, A, T, 5, L.hullDark, L.trim, shade(L.hullDark, 0.5));
  hullFittings(b, A, L, H);
  // Behaelter am Heck und Kisten auf den Flanken in der Zweitfarbe / containers at the rear and boxes on the flanks in the secondary colour
  const crate = { px: A.get('crate'), nx: A.get('crate'), pz: A.get('crate'), nz: A.get('crate'), py: A.get('blank'), ny: A.get('blank') };
  b.add(boxed(softBox(0.2, 0.046, 0.07, 0.006), { p: [0, H.y2 + 0.022, H.zdr + 0.02] }, crate), L.trim);
  b.mirrorX(() => b.add(boxed(softBox(0.042, 0.03, 0.13, 0.005), { p: [(H.xb + H.xd) / 2 + 0.008, (H.y1 + H.y2) / 2 + 0.012, 0.02], r: [0, 0, -0.83] }, { py: A.get('crate'), all: A.get('blank') }), L.trim));
  const ty = H.y2, tz = ringZ(H);
  b.turret([0, ty, tz], () => {
    b.group({ p: [0, 0, tz] }, () => {
      const rings = meridonRings(L, ty);
      b.add(loft(rings, { seg: hi ? 28 : 14, region: A.get('turret:meridon'), capFirst: A.get('turretTop') }), null);
      turretMarks(b, A, f, rings, ty + 0.04, L.hull, [5, 8], 0.04);
      b.add(projectBox(softBox(0.1, 0.05, 0.04, 0.012, hi ? 1 : 0), { pz: A.get('mantlet'), all: A.get('blank') }), L.hullDark, { xf: { p: [0, ty + 0.042, 0.098] } });
      barrel(b, A, { x: 0, y: ty + 0.043, z0: 0.112, len: 0.386 - tz - 0.112 - 0.012, r: 0.0165, color: L.hullDark });
      // orangefarbene Staukiste am Turmheck / orange stowage box at the turret rear
      b.add(boxed(softBox(0.14, 0.044, 0.05, 0.006), { p: [0, ty + 0.04, -0.118] }, crate), L.trim);
      const top = ty + 0.082;
      const R = roofPlaces(0.074, 0.068, 0);
      cupola(b, A, f, [R.cup[0] + 0.004, top, R.cup[1]], L.hullDark, L.trim, { seed: 7 });
      tube(b, A, [R.mg[0] - 0.004, top - 0.002, R.mg[1]], [R.mg[0] - 0.004, top + 0.026, R.mg[1]], 0.009, 0.007, mat.dark, 6);
      machineGun(b, A, [R.mg[0] - 0.004, top + 0.038, R.mg[1] + 0.006], { k: 0.92, len: 0.085 });
      // Antenne mit Wimpel / antenna with a pennant
      antenna(b, A, [0.05, ty + 0.07, -0.066], 0.2, mat.dark);
      const pen: Q = [[0.05, ty + 0.262, -0.092], [0.05, ty + 0.236, -0.089], [0.05, ty + 0.247, -0.14], [0.05, ty + 0.251, -0.14]];
      b.add(quad(pen, A.get('blank')), L.trim, { crease: 0 });
      b.add(quad([pen[3], pen[2], pen[1], pen[0]], A.get('blank')), L.trim, { crease: 0 });
    });
  });
  return b;
}

// ---------- Hightech: Velkar, Zyrr, NEXUS / hi-tech ----------

function techRings(L: Look, ty: number): Ring[] {
  return [
    { y: ty + 0.058, rx: 0.086, rz: 0.08, rzB: 0.086, e: 3, hard: true, c: L.hull },
    { y: ty + 0.05, rx: 0.112, rz: 0.108, rzB: 0.108, e: 3 },
    { y: ty + 0.03, rx: 0.136, rz: 0.134, rzB: 0.126, e: 3.1 },
    { y: ty + 0.016, rx: 0.14, rz: 0.138, rzB: 0.128, e: 3.1, hard: true },
    { y: ty + 0.015, rx: 0.132, rz: 0.13, rzB: 0.122, e: 3, hard: true, c: L.secondary },
    { y: ty + 0.005, rx: 0.132, rz: 0.13, rzB: 0.122, e: 3, hard: true },
    { y: ty + 0.004, rx: 0.124, rz: 0.122, rzB: 0.116, e: 3, hard: true, c: L.hullDark },
    { y: ty - 0.001, rx: 0.124, rz: 0.122, rzB: 0.116, e: 3 },
  ];
}

function techTank(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const H: HullSpec = { y0: 0.09, y1: 0.104, y2: 0.144, xb: 0.236, xd: 0.202, zf: 0.2, zr: -0.198, zdf: 0.096, zdr: -0.166 };
  const T: TrackSpec = { x: 0.168, w: 0.1, len: 0.4, h: 0.088, links: 42, thick: 0.011 };
  tankHull(b, A, L, f, H, T);
  tankGear(b, A, T, 5, L.hullDark, L.hullDark, shade(L.hullDark, 0.45));
  hullFittings(b, A, L, H, L.secondary);
  // Leuchtleisten entlang der Flanken und quer ueber den Bug / light strips along the flanks and across the bow
  const strip = (p: V3, w: number, h: number, d: number, face: 'px' | 'nx' | 'pz' | 'py', r: V3 = [0, 0, 0]) => b.add(boxed(softBox(w, h, d, 0.002), { p, r }, { [face]: A.get('glowStrip'), all: A.get('blank') }), L.secondary, { crease: 0 });
  strip([H.xb + 0.002, H.y1 + 0.001, 0], 0.006, 0.009, 0.34, 'px');
  strip([-H.xb - 0.002, H.y1 + 0.001, 0], 0.006, 0.009, 0.34, 'nx');
  strip([0, (H.y1 + H.y2) / 2 + 0.004, (H.zf + H.zdf) / 2 + 0.002], 0.26, 0.006, 0.01, 'py', [Math.atan2(H.y2 - H.y1, H.zf - H.zdf), 0, 0]);
  const ty = H.y2, tz = ringZ(H);
  b.turret([0, ty, tz], () => {
    b.group({ p: [0, 0, tz] }, () => {
      const rings = techRings(L, ty);
      b.add(loft(rings, { seg: hi ? 32 : 16, region: A.get('turret:velkar'), capFirst: A.get('turretTop') }), null);
      turretMarks(b, A, f, rings, ty + 0.034, L.hull, [1, 2], 0.03);
      b.add(projectBox(softBox(0.09, 0.04, 0.05, 0.01), { pz: A.get('mantlet'), all: A.get('blank') }), L.hullDark, { xf: { p: [0, ty + 0.034, 0.128] } });
      barrel(b, A, { x: 0, y: ty + 0.034, z0: 0.146, len: 0.448 - tz - 0.146 - 0.012, r: 0.017, color: L.hullDark });
      if (hi) b.add(boxed(softBox(0.008, 0.006, 0.12, 0.002), { p: [0, ty + 0.054, 0.23] }, { py: A.get('glowStrip'), all: A.get('blank') }), L.secondary, { crease: 0 });
      const top = ty + 0.058;
      const R = roofPlaces(0.086, 0.083, -0.003);
      // geschlossenes Luk, Sensormast mit kleinem Schirm statt eines Kommandanten / closed hatch, sensor mast with a small dish instead of a commander
      b.add(loft([{ y: 0.012, rx: 0.03, hard: true }, { y: 0.004, rx: 0.038, hard: true }, { y: 0, rx: 0.04 }], { seg: hi ? 16 : 9, region: A.get('blank'), capFirst: A.get('hatch'), color: L.hullDark }), null, { xf: { p: [R.cup[0], top - 0.002, R.cup[1]] } });
      const mp: V3 = [R.mg[0] - 0.012, top, R.mg[1] - 0.02];
      tube(b, A, mp, [mp[0], mp[1] + 0.085, mp[2]], 0.008, 0.005, mat.dark, 6);
      b.add(loft([{ y: 0.014, rx: 0.012, hard: true }, { y: 0.008, rx: 0.034 }, { y: 0, rx: 0.046, hard: true }, { y: -0.008, rx: 0.02 }], { seg: hi ? 14 : 8, region: A.get('blank'), color: mix(L.hull, mat.white, 0.5) }), null, { xf: { p: [mp[0], mp[1] + 0.09, mp[2]] } });
      b.add(loft([{ y: 0.008, rx: TIP }, { y: 0, rx: 0.008 }, { y: -0.006, rx: TIP }], { seg: 6, region: A.get('blank'), color: L.secondary }), null, { xf: { p: [mp[0], mp[1] + 0.112, mp[2]] }, crease: 0 });
      antenna(b, A, [0.02, top - 0.006, -0.07], 0.16, L.secondary);
    });
  });
  return b;
}

/** Panzer der Fraktionen ausser Korvat / Kult (deren Bauart steht in tank.ts) / the tanks of the factions other than Korvat / the cult (whose design is in tank.ts) */
export function factionTank(f: FactionId, A: AtlasLayout): UvBuilder {
  switch (styleOf(f)) {
    case 'dravon': return dravonTank(f, A);
    case 'alvenia': return alveniaTank(f, A);
    case 'meridon': return meridonTank(f, A);
    default: return techTank(f, A);
  }
}
