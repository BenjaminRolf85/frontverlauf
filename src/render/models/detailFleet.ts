/**
 * Kleinteile fuer die Flotten-Modelle (Schiffe, Schattenflotte, Zyrr, Schwarmmutter, Alvenia-Bauarten), nur fuer die
 * hohe Qualitaet gedacht: Aufrufer pruefen fine() bzw. lite selbst. Alle Teile sind klein und billig (duenne Quader
 * ohne Fase, Rohre mit wenigen Segmenten), damit die Tuschelinie nicht aufblaeht und das Dreiecksbudget fuer die
 * sichtbaren Formen bleibt. Farben kommen immer vom Aufrufer (Tokens ueber look.ts).
 * Small parts for the fleet models (ships, shadow fleet, Zyrr, Swarm Mother, Alvenia designs), meant for high quality
 * only: callers check fine() or lite themselves. All parts are small and cheap (thin boxes without a bevel, tubes with
 * few segments) so the ink line does not bloat and the triangle budget stays with the visible shapes. Colours always
 * come from the caller (tokens via look.ts).
 */
import * as THREE from 'three';
import { geo, type Builder, type ColorLike, type V3 } from './kit';

const HALF_PI = Math.PI / 2;

/** Punkt zwischen a und b / point between a and b */
export const lerpV = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Nietenreihe von a nach b (n kleine Wuerfel) / rivet row from a to b (n small cubes) */
export function rivetRow(b: Builder, a: V3, e: V3, n: number, size: number, c: ColorLike) {
  for (let i = 0; i < n; i++) b.box(size, size, size, c, lerpV(a, e, n === 1 ? 0.5 : i / (n - 1)));
}

/**
 * Duenner Stab von a nach b als Quader (12 Dreiecke, keine Fase) / thin bar from a to b as a box (12 triangles, no bevel).
 */
export function bar(b: Builder, a: V3, e: V3, w: number, c: ColorLike, h = w) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...e);
  b.segment(va, vb, (len) => geo.box(w, len, h), c);
}

/**
 * Reling entlang eines Pfades: Handlauf und Mittellauf als duenne Staebe, Pfosten in festen Abstaenden.
 * Rail along a path: handrail and middle rail as thin bars, posts at fixed spacing.
 */
export function railing(b: Builder, pts: V3[], h: number, spacing: number, c: ColorLike, w = 0.003, mid = true) {
  const up = (p: V3, k: number): V3 => [p[0], p[1] + h * k, p[2]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], e = pts[i + 1];
    bar(b, up(a, 1), up(e, 1), w, c);
    if (mid) bar(b, up(a, 0.5), up(e, 0.5), w * 0.8, c);
    const len = Math.hypot(e[0] - a[0], e[1] - a[1], e[2] - a[2]);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const p = lerpV(a, e, k / n);
      b.box(w, h, w, c, [p[0], p[1] + h / 2, p[2]]);
    }
  }
}

/** Doppelpoller auf einer Fussplatte / double bitts on a base plate */
export function bitts(b: Builder, p: V3, ry: number, r: number, c: ColorLike, base: ColorLike) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.box(r * 5.2, r * 0.6, r * 2.4, base, [0, r * 0.3, 0]);
    for (const s of [-1, 1]) {
      b.cyl(r, r * 1.05, r * 2.4, 8, c, [s * r * 1.4, r * 1.5, 0]);
      b.cyl(r * 1.35, r * 1.35, r * 0.45, 8, c, [s * r * 1.4, r * 2.85, 0]);
    }
  });
}

/** Bullauge mit Rahmen; ry dreht die Blickrichtung (+z) / porthole with a frame; ry turns the facing (+z) */
export function porthole(b: Builder, p: V3, ry: number, r: number, rim: ColorLike, glass: ColorLike) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.cyl(r, r, 0.004, 6, rim, [0, 0, 0], [HALF_PI, 0, 0]);
    b.cyl(r * 0.68, r * 0.68, 0.005, 6, glass, [0, 0, 0.0005], [HALF_PI, 0, 0]);
  });
}

/** Luftgitter: Rahmen mit Lamellen, Blick +z / vent grille: frame with slats, facing +z */
export function grille(b: Builder, p: V3, w: number, h: number, n: number, frame: ColorLike, slat: ColorLike, r: V3 = [0, 0, 0]) {
  b.group({ p, r }, () => {
    b.box(w, h, 0.004, frame, [0, 0, 0]);
    for (let i = 0; i < n; i++) b.box(w * 0.86, Math.min(0.004, (h / n) * 0.45), 0.004, slat, [0, -h / 2 + ((i + 0.5) / n) * h, 0.002], [-0.5, 0, 0]);
  });
}

/** Peitschenantenne mit Fuss und Spitze / whip antenna with a base and a tip */
export function whip(b: Builder, base: V3, top: V3, c: ColorLike, tip?: ColorLike) {
  b.cyl(0.005, 0.006, 0.01, 6, c, [base[0], base[1] + 0.005, base[2]]);
  b.tube([base[0], base[1] + 0.01, base[2]], top, 0.0016, 3, c, 0.0024);
  if (tip) b.add(geo.sphere(0.004, 5, 3), tip, { p: top });
}

/** Rettungsinsel-Behaelter (Kapsel mit zwei Baendern) liegend entlang x / life raft canister (capsule with two bands) lying along x */
export function raftCanister(b: Builder, p: V3, r: number, len: number, c: ColorLike, band: ColorLike, ry = 0) {
  b.group({ p, r: [0, ry, HALF_PI] }, () => {
    b.cyl(r, r, len - r, 8, c, [0, 0, 0]);
    for (const s of [-1, 1]) b.add(geo.sphere(r, 8, 3), c, { p: [0, s * (len - r) / 2, 0], s: [1, 0.6, 1] });
    for (const s of [-1, 1]) b.cyl(r * 1.06, r * 1.06, r * 0.35, 8, band, [0, s * len * 0.22, 0]);
  });
  // Halterung / cradle
  b.box(len * 0.7, r * 0.5, r * 1.6, band, [p[0], p[1] - r * 0.9, p[2]], [0, ry, 0]);
}

/** Scheinwerfer auf Sockel: Gehaeuse, Linse, Kuehlrippen; Blick +z nach ry / searchlight on a post: housing, lens, fins; faces +z after ry */
export function searchlight(b: Builder, p: V3, ry: number, r: number, body: ColorLike, lens: ColorLike, rx = 0.15) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.cyl(r * 0.35, r * 0.45, r * 1.2, 6, body, [0, -r * 1.1, 0]);
    b.group({ r: [rx, 0, 0] }, () => {
      b.cyl(r, r * 0.85, r * 1.6, 10, body, [0, 0, 0], [HALF_PI, 0, 0]);
      b.cyl(r * 0.82, r * 0.82, 0.003, 10, lens, [0, 0, r * 0.81], [HALF_PI, 0, 0]);
      for (const k of [-0.4, 0.4]) b.box(r * 2.1, 0.003, r * 0.25, body, [0, r * k, -r * 0.4]);
    });
  });
}

/** Senkrechte Leiter (Holme und Sprossen), Blick +z nach ry / vertical ladder (rails and rungs), faces +z after ry */
export function ladder(b: Builder, p: V3, h: number, w: number, ry: number, c: ColorLike, step = 0.018) {
  b.group({ p, r: [0, ry, 0] }, () => {
    for (const s of [-1, 1]) b.box(0.003, h, 0.003, c, [s * w / 2, h / 2, 0]);
    const n = Math.max(2, Math.floor(h / step));
    for (let i = 1; i < n; i++) b.box(w, 0.0025, 0.0025, c, [0, (i / n) * h, 0]);
  });
}

/** Aufgeschossene Leine (zwei flache Ringe) / coiled rope (two flat rings) */
export function ropeCoil(b: Builder, p: V3, r: number, tube: number, c: ColorLike) {
  b.add(geo.torus(r, tube, 3, 10), c, { p, r: [HALF_PI, 0, 0] });
  b.add(geo.torus(r * 0.7, tube, 3, 8), c, { p: [p[0], p[1] + tube * 1.4, p[2]], r: [HALF_PI, 0, 0] });
}

/** Runde Luke mit Handrad / round hatch with a handwheel */
export function roundHatch(b: Builder, p: V3, r: number, c: ColorLike, wheel: ColorLike) {
  b.cyl(r, r * 1.08, 0.006, 10, c, [p[0], p[1] + 0.003, p[2]]);
  b.add(geo.torus(r * 0.45, 0.0016, 3, 8), wheel, { p: [p[0], p[1] + 0.008, p[2]], r: [HALF_PI, 0, 0] });
  b.box(r * 0.9, 0.0025, 0.0025, wheel, [p[0], p[1] + 0.008, p[2]]);
  b.box(0.0025, 0.0025, r * 0.9, wheel, [p[0], p[1] + 0.008, p[2]]);
  // Scharnier / hinge
  b.box(r * 0.6, 0.006, 0.006, wheel, [p[0], p[1] + 0.004, p[2] - r]);
}

/** Kiste mit Latten und Deckelkante / crate with slats and a lid edge */
export function crate(b: Builder, p: V3, w: number, h: number, d: number, c: ColorLike, slat: ColorLike, ry = 0) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.box(w, h, d, c, [0, h / 2, 0]);
    b.box(w + 0.003, 0.004, d + 0.003, slat, [0, h - 0.002, 0]);
    for (const s of [-1, 1]) b.box(0.004, h * 0.9, d + 0.003, slat, [s * (w / 2 - 0.004), h / 2, 0]);
    b.box(w * 0.9, 0.004, 0.003, slat, [0, h / 2, d / 2 + 0.001], [0, 0, Math.atan2(h * 0.8, w * 0.9)]);
  });
}

/** Rohr ueber mehrere Punkte (Kabel, Leitung, Ader) / tube through several points (cable, pipe, vein) */
export function cable(b: Builder, pts: V3[], r: number, c: ColorLike, seg = 4, r1 = r) {
  for (let i = 0; i < pts.length - 1; i++) {
    const ra = r + (r1 - r) * (i / (pts.length - 1));
    const rb = r + (r1 - r) * ((i + 1) / (pts.length - 1));
    b.tube(pts[i], pts[i + 1], ra, seg, c, rb);
  }
}

/** Quadratische Bezierkurve / quadratic Bezier curve */
export function bez(a: V3, c: V3, e: V3, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(lerpV(lerpV(a, c, t), lerpV(c, e, t), t));
  }
  return out;
}

/** Ring aus n kleinen Teilen um die y-Achse (Bolzen, Leuchtpunkte) / ring of n small parts around the y axis (bolts, light dots) */
export function boltRing(b: Builder, p: V3, r: number, n: number, size: number, c: ColorLike, a0 = 0) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    b.box(size, size, size, c, [p[0] + Math.sin(a) * r, p[1], p[2] + Math.cos(a) * r], [0, a, 0]);
  }
}

/** Kleiner Rauchwerfer-Satz (Rohrbuendel) in Blickrichtung +z nach ry / small smoke discharger set (tube cluster) facing +z after ry */
export function dischargers(b: Builder, p: V3, ry: number, n: number, r: number, body: ColorLike, bore: ColorLike) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.box(r * 2.4 * n, r * 1.2, r * 2.4, body, [0, -r * 0.9, 0]);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * r * 2.3;
      b.cyl(r, r, r * 3, 6, body, [x, 0, r * 0.6], [HALF_PI - 0.6, 0, 0]);
      b.cyl(r * 0.6, r * 0.6, 0.003, 6, bore, [x, Math.sin(0.6) * r * 1.5, r * 0.6 + Math.cos(0.6) * r * 1.5], [HALF_PI - 0.6, 0, 0]);
    }
  });
}
