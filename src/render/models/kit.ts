/**
 * Baukasten fuer prozedurale Low-Poly-Modelle / toolkit for procedural low-poly models.
 * Jedes Teil wird nicht-indiziert, transformiert, flach schattiert und mit Vertexfarbe versehen;
 * am Ende wird alles zu einer BufferGeometry verschmolzen.
 * Every part is made non-indexed, transformed, flat-shaded and vertex-coloured;
 * finally everything is merged into one BufferGeometry.
 * Feinbereich (Einheiten, siehe withDetail): runde Teile und die weichen Formen (softBox, softPrism, lathe, capsule)
 * behalten glatte Normalen; alles andere bleibt flach schattiert.
 * Fine scope (units, see withDetail): round parts and the soft shapes (softBox, softPrism, lathe, capsule) keep
 * smooth normals; everything else stays flat-shaded.
 */
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { semantic } from '../../design/tokens';

export type ColorLike = string | THREE.Color;
export type V3 = readonly [number, number, number];
/** Transformation: Position, Euler-Rotation (rad, XYZ), Skalierung / position, rotation, scale */
export interface Xf { p?: V3; r?: V3; s?: V3 | number }

// ---------- Farben / colours ----------

/** Token-Farbe als THREE.Color (Kopie) / token colour as THREE.Color (copy) */
export function col(c: ColorLike): THREE.Color {
  return typeof c === 'string' ? new THREE.Color(c) : c.clone();
}
/** f < 1 dunkler, f > 1 heller (Richtung Weiss) / f < 1 darker, f > 1 lighter (towards white) */
export function shade(c: ColorLike, f: number): THREE.Color {
  const out = col(c);
  if (f <= 1) return out.multiplyScalar(f);
  return out.lerp(new THREE.Color(semantic.white), Math.min(1, f - 1));
}
export function mix(a: ColorLike, b: ColorLike, t: number): THREE.Color {
  return col(a).lerp(col(b), t);
}

// ---------- Zufall / random ----------

/** Deterministischer Zufall (mulberry32) / deterministic random */
export function rng(seed: number): () => number {
  let a = (seed | 0) ^ 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ---------- Cache ----------

const cache = new Map<string, THREE.BufferGeometry>();
/** Ergebnis je Schluessel einmal erzeugen / build once per key */
export function memo(key: string, fn: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = fn();
    g.name = key;
    cache.set(key, g);
  }
  return g;
}

// ---------- Transformationen / transforms ----------

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
export function xfMatrix(xf?: Xf): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  if (!xf) return m;
  const p = xf.p ?? [0, 0, 0];
  const r = xf.r ?? [0, 0, 0];
  const s = typeof xf.s === 'number' ? [xf.s, xf.s, xf.s] : (xf.s ?? [1, 1, 1]);
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  return m.compose(_v.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
}

/** Dreiecke umdrehen (bei Spiegelung) / flip triangle winding (for mirroring) */
function flipWinding(g: THREE.BufferGeometry) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name] as THREE.BufferAttribute;
    const n = a.itemSize;
    const arr = a.array as Float32Array;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k;
        const i2 = (t + 2) * n + k;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
}

/** Entartete Dreiecke entfernen / drop degenerate triangles */
function dropDegenerate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const keep: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    const area = b.sub(a).cross(c.sub(a)).lengthSq();
    if (area > 1e-14) keep.push(t);
  }
  if (keep.length * 3 === pos.count) return g;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const src = g.attributes[name] as THREE.BufferAttribute;
    const n = src.itemSize;
    const arr = new Float32Array(keep.length * 3 * n);
    keep.forEach((t, i) => {
      for (let k = 0; k < 3 * n; k++) arr[i * 3 * n + k] = (src.array as Float32Array)[t * n + k];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  return out;
}

// ---------- Detailstufe / detail scope ----------

/**
 * Detailbereich: skaliert Rundungssegmente und fast Quader (fuer Einheiten).
 * Detail scope: scales radial segments and bevels boxes (used for units).
 */
export interface DetailOpts {
  /**
   * Feinmodellierung (Einheiten): runde Teile behalten glatte Normalen, Quader bekommen weiche Fasen.
   * Fine modelling (units): round parts keep smooth normals, boxes get soft bevels.
   */
  smooth?: boolean;
  /** hohe Qualitaet: Zusatzdetails und rundere Formen / high quality: extra detail and rounder shapes */
  fine?: boolean;
}
let DETAIL = { seg: 1, bevel: false, smooth: false, fine: false };
export function withDetail<T>(seg: number, bevel: boolean, fn: () => T, opts: DetailOpts = {}): T {
  const prev = DETAIL;
  DETAIL = { seg, bevel, smooth: !!opts.smooth, fine: !!opts.fine };
  try {
    return fn();
  } finally {
    DETAIL = prev;
  }
}
/** Hohe Qualitaet im aktuellen Detailbereich? / high quality inside the current detail scope? */
export function fine(): boolean {
  return DETAIL.fine;
}
/**
 * Einheit in niedriger Qualitaet (Feinbereich ohne fine)? Gebaeude und Wunder liegen nicht im Feinbereich und bleiben
 * davon unberuehrt. / unit on low quality (fine scope without fine)? Buildings and wonders are outside the fine scope
 * and stay unaffected.
 */
export function unitLow(): boolean {
  return DETAIL.smooth && !DETAIL.fine;
}
/**
 * Segmentanzahl im aktuellen Detailbereich. Im Feinbereich bekommen Kleinstteile (Radius `size` unter TINY bzw. SMALL)
 * keine oder weniger zusaetzliche Segmente: dort sieht sie niemand, die Dreiecke gehen an die grossen Rundungen.
 * Segment count in the current detail scope. In the fine scope tiny parts (radius `size` below TINY or SMALL) get no
 * or fewer extra segments: nobody sees them there, the triangles go to the large curves instead.
 */
function S(n: number, min = 3, size = Infinity): number {
  let k = DETAIL.seg;
  if (DETAIL.smooth && k > 1) {
    if (size < TINY) k = 1;
    else if (size < SMALL) k = Math.min(k, 1.25);
  }
  return Math.max(min, Math.round(filmSeg(n * k)));
}
/**
 * Nur fuer den Modellexport des Introfilms (tools/intro-film/web/export-models.ts): Faktor auf die Segmentzahl runder
 * Teile (Lofts, Schlaeuche, Kugeln, Drehkoerper), damit Raeder, Rohre, Helme und Koepfe in der Nahaufnahme rund statt
 * facettiert sind. Das Spiel ruft setFilmSegments nie auf; bei 1 bauen 'high' und 'low' genau wie bisher.
 * Export of the intro film only (tools/intro-film/web/export-models.ts): factor on the segment count of round parts
 * (lofts, tubes, balls, turned parts) so wheels, barrels, helmets and heads are round instead of faceted in close-ups.
 * The game never calls setFilmSegments; at 1 'high' and 'low' build exactly as before.
 */
let FILM_SEG = 1;
export function setFilmSegments(k: number): void {
  FILM_SEG = k;
}
/** Faktor des Filmexports (1 im Spiel) / factor of the film export (1 in the game) */
export function filmSegments(): number {
  return FILM_SEG;
}
/** Segmentzahl n mit dem Faktor des Filmexports / segment count n with the film export factor */
export function filmSeg(n: number): number {
  return FILM_SEG === 1 ? n : n * FILM_SEG;
}
/** Radien, unter denen Rundungen keine bzw. weniger Zusatzsegmente bekommen / radii below which curves get no or fewer extra segments */
const TINY = 0.0075;
const SMALL = 0.0125;
/** Ab so vielen Segmenten gilt ein Drehkoerper als rund / from this many segments a turned part counts as round */
const ROUND_MIN = 8;
/** Glatte Normalen behalten (Builder.add wertet das aus) / keep smooth normals (read by Builder.add) */
export function keepNormals<G extends THREE.BufferGeometry>(g: G, on = true): G {
  if (on) g.userData.smooth = true;
  return g;
}
/** Kugel mit fester Segmentzahl und glatten Normalen (unabhaengig vom Detailbereich) / sphere with a fixed segment count and smooth normals (independent of the detail scope) */
export function ball(r: number, ws: number, hs: number): THREE.BufferGeometry {
  return keepNormals(new THREE.SphereGeometry(r, ws, hs));
}
/** Zylinder mit fester Segmentzahl und glattem Mantel / cylinder with a fixed segment count and a smooth side */
export function drum(rt: number, rb: number, h: number, seg: number, open = false): THREE.BufferGeometry {
  return keepNormals(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
}
/** Drehkoerper im Feinbereich glatt, sonst wie bisher flach / turned part smooth in the fine scope, flat as before otherwise */
function turned<G extends THREE.BufferGeometry>(g: G, seg: number): G {
  return keepNormals(g, DETAIL.smooth && seg >= ROUND_MIN);
}
/**
 * Quader im Detailbereich: mit Fasen; im Feinbereich weiche Fase (gleiche Dreieckszahl, glatte Kante), sehr duenne
 * Teile bleiben schlichte Quader (die Fase waere unsichtbar).
 * Box inside the detail scope: bevelled; in the fine scope a soft bevel (same triangle count, smooth edge), very thin
 * parts stay plain boxes (the bevel would be invisible).
 */
function detailBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const m = Math.min(w, h, d);
  if (DETAIL.smooth) {
    if (m < SOFT_MIN) return new THREE.BoxGeometry(w, h, d);
    return softBox(w, h, d, m * (m >= 0.025 ? 0.22 : 0.26), DETAIL.fine && m >= SOFT_ROUND ? 1 : 0);
  }
  if (!DETAIL.bevel || m < 0.008) return new THREE.BoxGeometry(w, h, d);
  if (m >= 0.025) return geo.rbox(w, h, d, m * 0.2);
  return geo.cbox(w, h, d, Math.min(w, d) * 0.2);
}
/** Duennere Quader bleiben ohne Fase / thinner boxes stay unbevelled */
const SOFT_MIN = 0.011;
/** Ab dieser kleinsten Kante bekommen Quader bei hoher Qualitaet eine zweistufige Rundung / from this smallest edge boxes get a two-step rounding on high quality */
const SOFT_ROUND = 0.045;
/** Ab diesem Rundungsradius ebenso (ausdruecklich gefaste Teile) / likewise from this rounding radius (explicitly chamfered parts) */
const SOFT_STEP = 0.011;

/** Ab dieser Dicke bekommen Profilkoerper bei hoher Qualitaet eine Fase / from this thickness extruded profiles get a chamfer on high quality */
const EXTRUDE_MIN = 0.035;
/**
 * Profil extrudieren (z von 0 bis depth); bei hoher Qualitaet mit schmaler Fase an beiden Deckflaechen, damit die
 * Kanten Licht fangen. Die Gesamtmasse bleiben gleich.
 * Extrude a profile (z from 0 to depth); on high quality with a narrow chamfer at both caps so the edges catch light.
 * The overall dimensions stay the same.
 */
function extrude(shape: THREE.Shape, depth: number, curveSegments: number): THREE.ExtrudeGeometry {
  const c = DETAIL.fine && depth >= EXTRUDE_MIN ? Math.min(0.006, depth * 0.12) : 0;
  if (c <= 0) return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelOffset: -c, bevelSegments: 1, curveSegments });
  g.translate(0, 0, c);
  return g;
}

// ---------- Weiche Formen / soft shapes (Position + glatte Normalen / position + smooth normals) ----------

/** Nicht-indizierte Geometrie aus Ecken, Normalen und Dreiecken / non-indexed geometry from vertices, normals and triangles */
function softGeometry(P: number[][], N: number[][], tris: number[][]): THREE.BufferGeometry {
  const pos = new Float32Array(tris.length * 9), nor = new Float32Array(tris.length * 9);
  let o = 0;
  for (const t of tris) for (const i of t) {
    pos[o] = P[i][0]; pos[o + 1] = P[i][1]; pos[o + 2] = P[i][2];
    nor[o] = N[i][0]; nor[o + 1] = N[i][1]; nor[o + 2] = N[i][2];
    o += 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return keepNormals(g);
}

/**
 * Quader mit weich gerundeten Kanten, zentriert. n = 0: eine Fasenflaeche je Kante (44 Dreiecke), die Normalen der
 * Fasen laufen von Flaeche zu Flaeche, so wirkt die Kante rund. n >= 1: Kanten in 2n Schritten gerundet (auch der
 * Umriss wird rund; 6 * (2n+1)^2 * 2 Dreiecke).
 * Box with softly rounded edges, centred. n = 0: one bevel face per edge (44 triangles), the bevel normals run from
 * face to face so the edge reads as round. n >= 1: edges rounded in 2n steps (the silhouette gets round too).
 */
export function softBox(w: number, h: number, d: number, r: number, n = 0): THREE.BufferGeometry {
  const H = [w / 2, h / 2, d / 2];
  const k = Math.max(1e-5, Math.min(r, Math.min(w, h, d) * 0.48));
  const P: number[][] = [], N: number[][] = [], tris: number[][] = [];
  // Wicklung nach aussen: die Dreiecksnormale muss den Eckennormalen folgen / winding outward: the face normal must follow the vertex normals
  const tri = (a: number, b: number, c: number) => {
    const ux = P[b][0] - P[a][0], uy = P[b][1] - P[a][1], uz = P[b][2] - P[a][2];
    const vx = P[c][0] - P[a][0], vy = P[c][1] - P[a][1], vz = P[c][2] - P[a][2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = N[a][0] + N[b][0] + N[c][0], my = N[a][1] + N[b][1] + N[c][1], mz = N[a][2] + N[b][2] + N[c][2];
    tris.push(nx * mx + ny * my + nz * mz >= 0 ? [a, b, c] : [a, c, b]);
  };
  const quad = (a: number, b: number, c: number, e: number) => { tri(a, b, c); tri(a, c, e); };
  const sg = [-1, 1];
  if (n <= 0) {
    // Ecke (sx, sy, sz): je ein Punkt auf der x-, y- und z-Flaeche / corner: one point on the x, y and z face each
    const id = (v: number[], axis: number) => (((v[0] > 0 ? 1 : 0) * 2 + (v[1] > 0 ? 1 : 0)) * 2 + (v[2] > 0 ? 1 : 0)) * 3 + axis;
    for (const sx of sg) for (const sy of sg) for (const sz of sg) {
      const s = [sx, sy, sz];
      for (let a = 0; a < 3; a++) {
        P.push([0, 1, 2].map((i) => s[i] * (i === a ? H[i] : H[i] - k)));
        N.push([0, 1, 2].map((i) => (i === a ? s[i] : 0)));
      }
    }
    // Flaechen / faces
    for (let a = 0; a < 3; a++) for (const s of sg) {
      const c = (p: number, q: number) => { const v = [0, 0, 0]; v[a] = s; v[(a + 1) % 3] = p; v[(a + 2) % 3] = q; return id(v, a); };
      quad(c(-1, -1), c(1, -1), c(1, 1), c(-1, 1));
    }
    // Kanten entlang Achse a, zwischen den Flaechen b und c / edges along axis a, between the faces b and c
    for (let a = 0; a < 3; a++) {
      const bA = (a + 1) % 3, cA = (a + 2) % 3;
      for (const sb of sg) for (const sc of sg) {
        const c = (sa: number, axis: number) => { const v = [0, 0, 0]; v[a] = sa; v[bA] = sb; v[cA] = sc; return id(v, axis); };
        quad(c(-1, bA), c(1, bA), c(1, cA), c(-1, cA));
      }
    }
    // Ecken / corners
    for (const sx of sg) for (const sy of sg) for (const sz of sg) tri(id([sx, sy, sz], 0), id([sx, sy, sz], 1), id([sx, sy, sz], 2));
    return softGeometry(P, N, tris);
  }
  // Wuerfelkugel: je Flaeche ein Raster, Mitte flach, Rand als Achtelkugel-Streifen / cube sphere: one grid per face, centre flat, rim as octant strips
  const m = 2 * n + 2;
  const st = (i: number): [number, number] => (i <= n ? [-1, Math.tan((1 - i / n) * Math.PI / 4)] : [1, Math.tan(((i - n - 1) / n) * Math.PI / 4)]);
  for (let a = 0; a < 3; a++) for (const s of sg) {
    const u = (a + 1) % 3, v = (a + 2) % 3, base = P.length;
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const [su, tu] = st(i), [sv, tv] = st(j);
      const dir = [0, 0, 0];
      dir[a] = s; dir[u] = su * tu; dir[v] = sv * tv;
      const l = Math.hypot(dir[0], dir[1], dir[2]);
      const nn = dir.map((x) => x / l);
      const c = [0, 0, 0];
      c[a] = s * (H[a] - k); c[u] = su * (H[u] - k); c[v] = sv * (H[v] - k);
      P.push([c[0] + nn[0] * k, c[1] + nn[1] * k, c[2] + nn[2] * k]);
      N.push(nn);
    }
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) {
      const q = base + j * m + i;
      quad(q, q + 1, q + m + 1, q + m);
    }
  }
  return softGeometry(P, N, tris);
}

/**
 * Prisma mit weich gerundeten senkrechten Kanten (Achtkant, 28 Dreiecke), Deckel flach; zentriert.
 * Prism with softly rounded vertical edges (octagon, 28 triangles), flat caps; centred.
 */
export function softPrism(w: number, h: number, d: number, c: number): THREE.BufferGeometry {
  const k = Math.max(1e-5, Math.min(c, w / 2.2, d / 2.2));
  const P: number[][] = [], N: number[][] = [], tris: number[][] = [];
  // Umriss von oben (x, z) mit der Normale der anliegenden Flaeche / outline from above (x, z) with the normal of the adjoining face
  const ring: [number, number, number, number][] = [
    [w / 2, -(d / 2 - k), 1, 0], [w / 2, d / 2 - k, 1, 0], [w / 2 - k, d / 2, 0, 1], [-(w / 2 - k), d / 2, 0, 1],
    [-w / 2, d / 2 - k, -1, 0], [-w / 2, -(d / 2 - k), -1, 0], [-(w / 2 - k), -d / 2, 0, -1], [w / 2 - k, -d / 2, 0, -1],
  ];
  for (const y of [-h / 2, h / 2]) for (const [x, z, nx, nz] of ring) { P.push([x, y, z]); N.push([nx, 0, nz]); }
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    tris.push([i, 8 + i, 8 + j], [i, 8 + j, j]);
  }
  // Deckel mit eigenen Ecken (flach) / caps with their own vertices (flat)
  for (const top of [false, true]) {
    const base = P.length;
    for (const [x, z] of ring) { P.push([x, top ? h / 2 : -h / 2, z]); N.push([0, top ? 1 : -1, 0]); }
    for (let i = 1; i < 7; i++) tris.push(top ? [base, base + i + 1, base + i] : [base, base + i, base + i + 1]);
  }
  return softGeometry(P, N, tris);
}

/**
 * Verjuengung einer zentrierten weichen Form: unten Faktor 1, oben kx / kz, Oberseite um dx / dz verschoben; die
 * Normalen werden mitgefuehrt.
 * Taper of a centred soft shape: factor 1 at the bottom, kx / kz at the top, top shifted by dx / dz; normals follow.
 */
export function taperSoft(g: THREE.BufferGeometry, h: number, kx: number, kz: number, dz = 0, dx = 0): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute, nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y / h + 0.5;
    const sx = 1 + (kx - 1) * t, sz = 1 + (kz - 1) * t;
    p.setXYZ(i, x * sx + dx * t, y, z * sz + dz * t);
    // Normale mit der inversen Transponierten der Abbildung / normal by the inverse transpose of the map
    const mx = nrm.getX(i) / sx, mz = nrm.getZ(i) / sz;
    const my = nrm.getY(i) - ((x * (kx - 1) + dx) / h) * mx - ((z * (kz - 1) + dz) / h) * mz;
    const l = Math.hypot(mx, my, mz) || 1;
    nrm.setXYZ(i, mx / l, my / l, mz / l);
  }
  return g;
}

/** Profilpunkt eines Drehkoerpers: [Radius, y, harte Kante?] / profile point of a turned part: [radius, y, hard edge?] */
export type LathePoint = readonly [number, number] | readonly [number, number, boolean];

/**
 * Drehkoerper um die y-Achse aus einem Profil; glatte Normalen, an "harten" Punkten bleibt die Kante scharf.
 * Radius 0 schliesst die Form. Die Laufrichtung des Profils ist egal. `range` = [erster Abschnitt, Ende) baut nur
 * einen Teil des Profils, mit den Normalen des ganzen: so laesst sich ein Koerper in mehreren Farben fugenlos bauen.
 * Turned part about the y axis from a profile; smooth normals, the edge stays sharp at "hard" points.
 * Radius 0 closes the shape. The direction of the profile does not matter. `range` = [first section, end) builds only
 * part of the profile, with the normals of the whole: this builds one body in several colours without a seam.
 */
export function lathe(profile: LathePoint[], seg: number, range?: readonly [number, number]): THREE.BufferGeometry {
  const n = Math.max(3, Math.round(seg));
  const m = profile.length;
  // Normale je Abschnitt in der Profilebene (r, y) / normal per section in the profile plane (r, y)
  const sn: [number, number][] = [];
  let area = 0;
  for (let i = 0; i < m - 1; i++) {
    const dr = profile[i + 1][0] - profile[i][0], dy = profile[i + 1][1] - profile[i][1];
    const l = Math.hypot(dr, dy) || 1;
    sn.push([dy / l, -dr / l]);
    area += (profile[i][0] + profile[i + 1][0]) * dy;
  }
  // Profil von oben nach unten: Normale und Wicklung umdrehen / profile running downwards: flip normal and winding
  const flip = area < 0 ? -1 : 1;
  const at = (i: number, section: number): [number, number] => {
    let a = sn[section];
    if (profile[i][2] !== true) {
      const other = section === i ? i - 1 : i + 1;
      if (other >= 0 && other < m - 1) a = [a[0] + sn[other][0], a[1] + sn[other][1]];
    }
    const l = Math.hypot(a[0], a[1]) || 1;
    return [(a[0] / l) * flip, (a[1] / l) * flip];
  };
  const pos: number[] = [], nor: number[] = [];
  const put = (i: number, section: number, ang: number) => {
    const [nr, ny] = at(i, section);
    const c = Math.cos(ang), s = Math.sin(ang);
    pos.push(profile[i][0] * s, profile[i][1], profile[i][0] * c);
    nor.push(nr * s, ny, nr * c);
  };
  for (let i = range ? Math.max(0, range[0]) : 0; i < (range ? Math.min(m - 1, range[1]) : m - 1); i++) {
    const r0 = profile[i][0], r1 = profile[i + 1][0];
    if (r0 <= 1e-7 && r1 <= 1e-7) continue;
    for (let j = 0; j < n; j++) {
      const a0 = (j / n) * Math.PI * 2, a1 = ((j + 1) / n) * Math.PI * 2;
      // zwei Dreiecke je Feld, an der Achse nur eines / two triangles per cell, only one at the axis
      const cell: [number, number][][] = [];
      if (r0 > 1e-7) cell.push([[i, a0], [i, a1], [i + 1, a1]]);
      if (r1 > 1e-7) cell.push([[i, a0], [i + 1, a1], [i + 1, a0]]);
      for (const t of cell) for (const [pi, ang] of flip > 0 ? t : [t[0], t[2], t[1]]) put(pi, i, ang);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return keepNormals(g);
}

/**
 * Kapsel entlang y (Glied, Tank): Radius unten r0, oben r1, Gesamtlaenge len einschliesslich der runden Enden; zentriert.
 * flat < 1 macht die Enden flacher.
 * Capsule along y (limb, tank): radius r0 at the bottom, r1 at the top, total length len including the round ends;
 * centred. flat < 1 flattens the ends.
 */
export function capsule(r0: number, r1: number, len: number, seg: number, rings = 2, flat = 1): THREE.BufferGeometry {
  const c0 = Math.min(r0 * flat, len * 0.45), c1 = Math.min(r1 * flat, len * 0.45);
  const pts: [number, number][] = [];
  for (let i = 0; i <= rings; i++) { const a = ((i / rings) * Math.PI) / 2; pts.push([r0 * Math.sin(a), -len / 2 + c0 * (1 - Math.cos(a))]); }
  for (let i = rings; i >= 0; i--) { const a = ((i / rings) * Math.PI) / 2; pts.push([r1 * Math.sin(a), len / 2 - c1 * (1 - Math.cos(a))]); }
  return lathe(pts, seg);
}

// ---------- Grundkoerper / primitives (zentriert / centred) ----------

export const geo = {
  box: (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt: number, rb: number, h: number, seg = 8, open = false) => {
    const n = S(seg, 3, Math.max(rt, rb));
    return turned(new THREE.CylinderGeometry(rt, rb, h, n, 1, open), n);
  },
  cone: (r: number, h: number, seg = 8) => turned(new THREE.ConeGeometry(r, h, S(seg, 3, r), 1), S(seg, 3, r)),
  sphere: (r: number, ws = 8, hs = 6) => turned(new THREE.SphereGeometry(r, S(ws, 3, r), S(hs, 2, r)), S(ws, 3, r)),
  ico: (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail),
  dodeca: (r: number) => new THREE.DodecahedronGeometry(r, 0),
  /** Halbkugel, Boden bei y=0 / hemisphere, base at y=0 */
  hemi: (r: number, ws = 8, hs = 3) => turned(new THREE.SphereGeometry(r, S(ws, 3, r), S(hs, 2, r), 0, Math.PI * 2, 0, Math.PI / 2), S(ws, 3, r)),
  torus: (r: number, tube: number, rs = 4, ts = 12) => turned(new THREE.TorusGeometry(r, tube, S(rs, 3, tube * 2), S(ts, 3, r)), S(ts, 3, r)),
  /** Weich gerundeter Quader, oben verjuengt (unten wb x db, oben wt x dt) / softly rounded box, tapered towards the top */
  softTaper: (wb: number, db: number, wt: number, dt: number, h: number, r: number, dz = 0, n = 0) =>
    taperSoft(softBox(wb, h, db, Math.min(r, Math.min(wt, dt) * 0.45), n), h, wt / wb, dt / db, dz),
  /** Drehkoerper aus einem Profil, siehe lathe; Segmentzahl folgt dem Detailbereich / turned part from a profile, see lathe; the segment count follows the detail scope */
  lathe: (profile: LathePoint[], seg = 10, range?: readonly [number, number]) => lathe(profile, S(seg), range),
  /**
   * Quader mit verjuengter Oberseite / box with a tapered top.
   * Unten wb x db, oben wt x dt, Hoehe h, Oberseite um dz in z verschoben. Zentriert.
   */
  taper: (wb: number, db: number, wt: number, dt: number, h: number, dz = 0, dx = 0) => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const top = p.getY(i) > 0;
      p.setXYZ(i, p.getX(i) * (top ? wt : wb) + (top ? dx : 0), p.getY(i) * h, p.getZ(i) * (top ? dt : db) + (top ? dz : 0));
    }
    return g;
  },
  /**
   * Quader mit gefasten Kanten (Fase c), optional verjuengt; zentriert.
   * Box with chamfered edges (chamfer c), optionally tapered; centred.
   */
  rtaper: (wb: number, db: number, wt: number, dt: number, h: number, c: number, dz = 0) => {
    const pts: THREE.Vector3[] = [];
    const k = Math.min(c, h / 2.2, Math.min(wb, db, wt, dt) / 2.2);
    // Feinbereich: weiche Rundung statt abgeschnittener Ecken / fine scope: soft rounding instead of cut corners
    if (DETAIL.smooth && k > 0.0015) return taperSoft(softBox(wb, h, db, k, DETAIL.fine && k >= SOFT_STEP ? 1 : 0), h, wt / wb, dt / db, dz);
    for (const top of [false, true]) {
      const y = top ? h / 2 : -h / 2;
      const w = top ? wt : wb, d = top ? dt : db, oz = top ? dz : 0;
      // Punkt auf der Seitenkante etwas innerhalb / point on the side edge slightly inside
      const t = k / h;
      const wi = top ? wt + (wb - wt) * t : wb + (wt - wb) * t;
      const di = top ? dt + (db - dt) * t : db + (dt - db) * t;
      const ozi = top ? dz * (1 - t) : dz * t;
      const yi = top ? y - k : y + k;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * (w / 2 - k), y, sz * d / 2 + oz));
        pts.push(new THREE.Vector3(sx * w / 2, y, sz * (d / 2 - k) + oz));
        pts.push(new THREE.Vector3(sx * wi / 2, yi, sz * di / 2 + ozi));
      }
    }
    return new ConvexGeometry(pts);
  },
  rbox: (w: number, h: number, d: number, c: number) => geo.rtaper(w, d, w, d, h, c),
  /**
   * Nur die senkrechten Kanten gefast (Achtkant-Prisma, 28 Dreiecke), optional verjuengt; zentriert.
   * Only the vertical edges chamfered (octagonal prism, 28 triangles), optionally tapered; centred.
   */
  ctaper: (wb: number, db: number, wt: number, dt: number, h: number, c: number, dz = 0) => {
    if (DETAIL.smooth && c > 0.0015) return taperSoft(softPrism(wb, h, db, c), h, wt / wb, dt / db, dz);
    const pts: THREE.Vector3[] = [];
    for (const top of [false, true]) {
      const w = top ? wt : wb, d = top ? dt : db, oz = top ? dz : 0;
      const k = Math.min(c, w / 2.2, d / 2.2);
      const y = top ? h / 2 : -h / 2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * (w / 2 - k), y, sz * d / 2 + oz));
        pts.push(new THREE.Vector3(sx * w / 2, y, sz * (d / 2 - k) + oz));
      }
    }
    return new ConvexGeometry(pts);
  },
  cbox: (w: number, h: number, d: number, c: number) => geo.ctaper(w, d, w, d, h, c),
  /** Konvexe Huelle beliebiger Punkte / convex hull of arbitrary points */
  hull: (pts: V3[]) => new ConvexGeometry(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2]))),
  /** Prisma aus Grundriss (x,z), Boden y=0, Dach y=h / prism from a top-view outline */
  prismXZ: (pts: [number, number][], h: number) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = extrude(s, h, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  },
  /** Seitenprofil (z,y), entlang x mit Breite w extrudiert, zentriert / side profile extruded along x */
  profileZY: (pts: [number, number][], w: number) => {
    const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = extrude(s, w, 1);
    g.rotateY(-Math.PI / 2);
    g.translate(w / 2, 0, 0);
    return g;
  },
  /** Frontprofil (x,y), entlang z mit Tiefe d extrudiert, zentriert / front profile extruded along z */
  profileXY: (pts: [number, number][], d: number) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = extrude(s, d, 1);
    g.translate(0, 0, -d / 2);
    return g;
  },
  /** Flache Form(en) in XY, entlang z extrudiert / flat shape(s) in XY extruded along z */
  shapes: (shapes: THREE.Shape[], d: number) => {
    const g = new THREE.ExtrudeGeometry(shapes, { depth: d, bevelEnabled: false, curveSegments: 3 });
    g.translate(0, 0, -d / 2);
    return g;
  },
};

// ---------- Drehtuerme / turrets ----------

/**
 * Drehturm in einer verschmolzenen Geometrie: Ecken [start, start + count) gehoeren zum Turm, pivot = Drehpunkt
 * (Mitte des Turmkranzes) in Modellkoordinaten. Builder.build() legt alle Turmteile ans Ende der Geometrie
 * und speichert die Bereiche in geometry.userData.turrets. So bleibt jede Modellfunktion bei EINER Geometrie
 * (Zwischenspeicher, Vergroesserung, Helligkeitsverlauf, Leuchtmaske wirken auf alles), und erst das Brett
 * teilt sie mit splitTurrets() in Wanne und Turm(e) auf.
 * Turret inside a merged geometry: vertices [start, start + count) belong to the turret, pivot = rotation centre
 * (centre of the turret ring) in model coordinates. Builder.build() puts all turret parts at the end of the geometry
 * and stores the ranges in geometry.userData.turrets. Every model function thus stays at ONE geometry (cache,
 * enlargement, value ramp, glow mask act on everything), and only the board splits it into hull and turret(s)
 * with splitTurrets().
 */
export interface TurretRange {
  start: number;
  count: number;
  pivot: [number, number, number];
  /** Ruherichtung des Rohrs (rad um y, 0 = +z) / rest heading of the barrel (rad about y, 0 = +z) */
  yaw: number;
  /** groesste Drehung aus der Ruhestellung (rad), fehlt = rundum / largest turn away from rest (rad), absent = all round */
  arc?: number;
}

/** Drehtuerme einer Geometrie (leer = keiner) / turrets of a geometry (empty = none) */
export function turretsOf(g: THREE.BufferGeometry): TurretRange[] {
  return (g.userData.turrets as TurretRange[] | undefined) ?? [];
}

/**
 * Geometrie skalieren und die Drehpunkte der Tuerme mitnehmen / scale a geometry and carry the turret pivots along.
 */
export function scaleWithTurrets(g: THREE.BufferGeometry, sx: number, sy: number, sz: number): THREE.BufferGeometry {
  g.scale(sx, sy, sz);
  const t = g.userData.turrets as TurretRange[] | undefined;
  if (t) g.userData.turrets = t.map((r) => ({ ...r, pivot: [r.pivot[0] * sx, r.pivot[1] * sy, r.pivot[2] * sz] }));
  // Muendung (falls gemerkt, z. B. Goettlicher Funke) mitnehmen / carry the muzzle along (if remembered, e.g. Divine Spark)
  const m = g.userData.muzzle as [number, number, number] | undefined;
  if (m) g.userData.muzzle = [m[0] * sx, m[1] * sy, m[2] * sz];
  return g;
}

/** Wanne und Tuerme als eigene Geometrien / hull and turrets as separate geometries */
export interface TurretSplit {
  hull: THREE.BufferGeometry;
  /**
   * Turmgeometrie mit dem Drehpunkt im Ursprung und dem Rohr nach +z; yaw = Ruhestellung, arc = Schwenkgrenze.
   * Turret geometry with its pivot at the origin and the barrel along +z; yaw = rest heading, arc = traverse limit.
   */
  turrets: { geometry: THREE.BufferGeometry; pivot: THREE.Vector3; yaw: number; arc?: number }[];
}

/** Ecken [start, start + count) aller Attribute kopieren / copy vertices [start, start + count) of all attributes */
function sliceGeometry(g: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    const n = a.itemSize;
    const Arr = a.array.constructor as new (src: ArrayLike<number>) => THREE.TypedArray;
    out.setAttribute(name, new THREE.BufferAttribute(new Arr(a.array.subarray(start * n, (start + count) * n)), n, a.normalized));
  }
  return out;
}

const splitCache = new WeakMap<THREE.BufferGeometry, TurretSplit | null>();
/**
 * Geometrie mit Drehtuermen in Wanne + Tuerme teilen (zwischengespeichert, Ergebnis nicht veraendern); null = keine Tuerme.
 * Split a geometry with turrets into hull + turrets (cached, do not mutate the result); null = no turrets.
 */
export function splitTurrets(g: THREE.BufferGeometry): TurretSplit | null {
  if (splitCache.has(g)) return splitCache.get(g) ?? null;
  const ranges = turretsOf(g).filter((r) => r.count > 0);
  let res: TurretSplit | null = null;
  if (ranges.length) {
    const hullCount = Math.min(...ranges.map((r) => r.start));
    const hull = sliceGeometry(g, 0, hullCount);
    hull.name = `${g.name}|hull`;
    hull.userData = { ...g.userData, turrets: undefined };
    hull.computeBoundingBox(); hull.computeBoundingSphere();
    const turrets = ranges.map((r, i) => {
      const geometry = sliceGeometry(g, r.start, r.count);
      // Drehpunkt in den Ursprung, Rohr nach +z / pivot to the origin, barrel along +z
      geometry.translate(-r.pivot[0], -r.pivot[1], -r.pivot[2]);
      if (r.yaw) geometry.rotateY(-r.yaw);
      geometry.name = `${g.name}|turret${i}`;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      return { geometry, pivot: new THREE.Vector3(...r.pivot), yaw: r.yaw, ...(r.arc !== undefined ? { arc: r.arc } : {}) };
    });
    res = { hull, turrets };
  }
  splitCache.set(g, res);
  return res;
}

// ---------- Builder ----------

export class Builder {
  private parts: THREE.BufferGeometry[] = [];
  /** Ziel neuer Teile: Wanne oder gerade gebauter Turm / target of new parts: hull or the turret being built */
  private sink: THREE.BufferGeometry[] = this.parts;
  private turretList: { pivot: THREE.Vector3; yaw: number; arc?: number; parts: THREE.BufferGeometry[] }[] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  private get top(): THREE.Matrix4 {
    return this.stack[this.stack.length - 1];
  }

  /** Teile in einer lokalen Transformation bauen / build parts inside a local transform */
  group(xf: Xf, fn: () => void): this {
    this.stack.push(this.top.clone().multiply(xfMatrix(xf)));
    try {
      fn();
    } finally {
      this.stack.pop();
    }
    return this;
  }

  /**
   * Drehturm: alle in fn gebauten Teile drehen spaeter gemeinsam um die senkrechte Achse durch pivot
   * (Mitte des Turmkranzes, in der aktuellen lokalen Transformation). Rohr nach +z bauen wie bisher.
   * Beispiel: b.turret([0, ty, tz], () => { b.add(geo.cyl(...), L.hull, { p: [0, ty + 0.04, tz] }); gun(b, 0, ty + 0.05, tz + 0.1, ...); });
   * Turret: all parts built in fn later rotate together about the vertical axis through pivot
   * (centre of the turret ring, in the current local transform). Build the barrel along +z as before.
   * Example: see above. Several calls make several turrets (e.g. ship guns); calls do not nest.
   * Die Ruherichtung folgt der aktuellen Transformation (z. B. Heckturm mit r: [0, PI, 0]); arc begrenzt den Schwenk.
   * The rest heading follows the current transform (e.g. an aft turret with r: [0, PI, 0]); arc limits the traverse.
   */
  turret(pivot: V3, fn: () => void, opts: { arc?: number } = {}): this {
    if (this.sink !== this.parts) throw new Error('Builder.turret: turrets do not nest');
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(this.top);
    const t = {
      pivot: new THREE.Vector3(pivot[0], pivot[1], pivot[2]).applyMatrix4(this.top),
      yaw: Math.abs(fwd.x) + Math.abs(fwd.z) > 1e-6 ? Math.atan2(fwd.x, fwd.z) : 0,
      arc: opts.arc,
      parts: [] as THREE.BufferGeometry[],
    };
    this.turretList.push(t);
    this.sink = t.parts;
    try {
      fn();
    } finally {
      this.sink = this.parts;
    }
    return this;
  }

  /** Spiegelt die Teile von fn an der x=0-Ebene zusaetzlich / adds a mirrored copy (x -> -x) */
  mirrorX(fn: () => void): this {
    fn();
    this.group({ s: [-1, 1, 1] }, fn);
    return this;
  }

  /** Geometrie in einer Farbe hinzufuegen / add a geometry in one colour */
  add(g0: THREE.BufferGeometry, c: ColorLike, xf?: Xf): this {
    // Feinmodellierung: glatte Normalen des Teils behalten (siehe keepNormals) / fine modelling: keep the part's smooth normals
    const smooth = g0.userData.smooth === true && !!g0.getAttribute('normal');
    let g = g0.index ? g0.toNonIndexed() : g0.clone();
    g0.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && !(smooth && name === 'normal')) g.deleteAttribute(name);
    g.morphAttributes = {};
    g.clearGroups();
    const m = this.top.clone().multiply(xfMatrix(xf));
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    g = dropDegenerate(g);
    if (!smooth) g.computeVertexNormals();
    const cc = col(c);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = cc.r;
      arr[i * 3 + 1] = cc.g;
      arr[i * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.sink.push(g);
    return this;
  }

  /** Fertige, gefaerbte Geometrie uebernehmen / add an already coloured geometry */
  addColored(src: THREE.BufferGeometry, xf?: Xf): this {
    let g = src.index ? src.toNonIndexed() : src.clone();
    const m = this.top.clone().multiply(xfMatrix(xf));
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    g = dropDegenerate(g);
    g.computeVertexNormals();
    this.sink.push(g);
    return this;
  }

  /**
   * Glatt schattierte, bereits gefaerbte Geometrie: Normalen bleiben erhalten (fuer modellierte Gesichter).
   * Smooth-shaded, already coloured geometry: normals are kept (for sculpted faces).
   */
  addSmooth(src: THREE.BufferGeometry, xf?: Xf): this {
    let g = src.index ? src.toNonIndexed() : src.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    g.morphAttributes = {};
    g.clearGroups();
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const m = this.top.clone().multiply(xfMatrix(xf));
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    g = dropDegenerate(g);
    this.sink.push(g);
    return this;
  }

  // Kurzformen; p = Mittelpunkt / shorthands; p = centre
  box(w: number, h: number, d: number, c: ColorLike, p: V3, r?: V3): this {
    return this.add(detailBox(w, h, d), c, { p, r });
  }
  /** Quader mit Unterkante bei y / box with its bottom at y */
  block(x: number, y: number, z: number, w: number, h: number, d: number, c: ColorLike, ry = 0): this {
    return this.add(detailBox(w, h, d), c, { p: [x, y + h / 2, z], r: [0, ry, 0] });
  }
  cyl(rt: number, rb: number, h: number, seg: number, c: ColorLike, p: V3, r?: V3): this {
    return this.add(geo.cyl(rt, rb, h, seg), c, { p, r });
  }
  /** Rohr von a nach b / tube from a to b */
  tube(a: V3, b: V3, r: number, seg: number, c: ColorLike, r2 = r): this {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const g = geo.cyl(r2, r, len, seg);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return this.add(g, c);
  }

  /**
   * Teil entlang der Strecke a->c (lokale y-Achse = Richtung); make(len) liefert eine um y zentrierte Geometrie.
   * Part along segment a->c (local y = direction); make(len) returns geometry centred on y.
   */
  segment(a: THREE.Vector3, c: THREE.Vector3, make: (len: number) => THREE.BufferGeometry, col: ColorLike, inner?: (len: number) => void): this {
    const dir = c.clone().sub(a);
    const len = Math.max(1e-4, dir.length());
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
    this.group({ p: [a.x, a.y, a.z], r: [e.x, e.y, e.z] }, () => {
      this.add(make(len), col, { p: [0, len / 2, 0] });
      inner?.(len);
    });
    return this;
  }

  triangles(): number {
    const all = [...this.parts, ...this.turretList.flatMap((t) => t.parts)];
    return all.reduce((s, g) => s + g.attributes.position.count / 3, 0);
  }

  /**
   * Alles zu einer Geometrie verschmelzen; Turmteile liegen am Ende (Bereiche in userData.turrets, siehe TurretRange).
   * Merge everything into one geometry; turret parts come last (ranges in userData.turrets, see TurretRange).
   */
  build(): THREE.BufferGeometry {
    const turrets = this.turretList.filter((t) => t.parts.length);
    const all = [...this.parts, ...turrets.flatMap((t) => t.parts)];
    const g = all.length ? mergeGeometries(all, false) : new THREE.BufferGeometry();
    if (!g) throw new Error('mergeGeometries failed');
    if (turrets.length) {
      const verts = (list: THREE.BufferGeometry[]) => list.reduce((n, p) => n + p.attributes.position.count, 0);
      let start = verts(this.parts);
      g.userData.turrets = turrets.map((t): TurretRange => {
        const count = verts(t.parts);
        const r: TurretRange = { start, count, pivot: [t.pivot.x, t.pivot.y, t.pivot.z], yaw: t.yaw, ...(t.arc !== undefined ? { arc: t.arc } : {}) };
        start += count;
        return r;
      });
    }
    for (const p of all) p.dispose();
    this.parts = [];
    this.sink = this.parts;
    this.turretList = [];
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}
