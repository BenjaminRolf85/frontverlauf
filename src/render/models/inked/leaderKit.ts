/**
 * Gezeichnete Anfuehrer: Baukasten fuer die Heldenbuesten (Formen mit Texturkoordinaten).
 * Inked leaders: toolkit for the hero busts (shapes with texture coordinates).
 *
 * Die Buesten folgen dem Vertrag der gezeichneten Einheiten (uv, fx, Farbe, Normalen, userData.inked / inkSrc), sind
 * aber Heldenmodelle: sie fuellen ein Filmbild. Deshalb eigene Formen, die der Baukasten der Einheiten nicht hat:
 * - headGeometry(): hochaufgeloester, verformter Kopf (Sculpt aus sculpt.ts) mit zwei Zellen. Das Gesicht liegt als
 *   senkrechte Draufsicht in der Zelle 'face' (Malerkoordinaten = Kopfkoordinaten, linear), der Rest des Schaedels
 *   als Scheibe um den Hinterkopf in der Zelle 'scalp'. Das Gitter ist vorn und um die Augenhoehe dichter.
 * - sheet(): duenne Platte ueber einer freien Flaeche (Muetzenschirm, Kragen, Schulterstueck, Umhang, Kapuze, Feder).
 * - tube(): Schlauch entlang eines Pfads (Schnurrbart, Zopf, Fransen, Kabel, Stacheln).
 * - torsoGeometry(): glatter Oberkoerper mit abfallenden Schultern; Brust, Ruecken und Seiten je eine Zelle.
 * - mirrorS(): spiegelt die Abwicklung eines Lofts (vorn Mitte = linker Zellenrand): doppelte Dichte fuer
 *   symmetrische Teile (Muetzenband, Kragen, Helm).
 * The busts follow the contract of the inked units (uv, fx, colour, normals, userData.inked / inkSrc) but are hero
 * models: they fill a film frame. Hence shapes of their own that the unit kit lacks:
 * - headGeometry(): high-resolution deformed head (Sculpt from sculpt.ts) with two cells. The face lies in the cell
 *   'face' as an orthographic front view (painter coordinates = head coordinates, linear), the rest of the skull as a
 *   disc around the back of the head in the cell 'scalp'. The grid is denser at the front and around eye level.
 * - sheet(): thin plate over a free surface (cap peak, collar, shoulder board, cape, hood, feather).
 * - tube(): tube along a path (moustache, braid, fringe, cable, spikes).
 * - torsoGeometry(): smooth torso with sloping shoulders; chest, back and sides one cell each.
 * - mirrorS(): mirrors the unwrap of a loft (front centre = left cell edge): double density for symmetric parts
 *   (cap band, collar, helmet).
 */
import * as THREE from 'three';
import { col, fine, type ColorLike, type V3 } from '../kit';
import { Sculpt, smoothNormals, smoothstep } from '../sculpt';
import { loft, projectBox, REF, type AtlasLayout, type Region, type UvBuilder } from './uvkit';
import type { Pt } from './atlas';

const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
/** Hoehenparameter der Schulterkante des Oberkoerpers (torsoPoint) / height parameter of the torso shoulder edge (torsoPoint) */
const WALL = 0.62;

// ---------- Dreiecke sammeln / collecting triangles ----------

interface Vtx { p: THREE.Vector3; n: THREE.Vector3; r: Region; s: number; t: number; c?: THREE.Color }

/** Sammelt Dreiecke mit Ort, Normale, UV und optional Farbe; richtet die Wicklung nach den Normalen / collects triangles with position, normal, uv and optional colour; orients the winding by the normals */
class Mesh {
  private pos: number[] = []; private nor: number[] = []; private uv: number[] = []; private colr: number[] = [];
  private e1 = new THREE.Vector3(); private e2 = new THREE.Vector3(); private fn = new THREE.Vector3();
  tri(a: Vtx, b: Vtx, c: Vtx): void {
    this.fn.crossVectors(this.e1.copy(b.p).sub(a.p), this.e2.copy(c.p).sub(a.p));
    if (this.fn.lengthSq() < 1e-22) return;
    const flip = this.fn.dot(this.e1.copy(a.n).add(b.n).add(c.n)) < 0;
    for (const v of flip ? [a, c, b] : [a, b, c]) {
      this.pos.push(v.p.x, v.p.y, v.p.z);
      this.nor.push(v.n.x, v.n.y, v.n.z);
      this.uv.push((v.r.x + v.s * v.r.w) / REF, (v.r.y + v.t * v.r.h) / REF);
      if (v.c) this.colr.push(v.c.r, v.c.g, v.c.b);
    }
  }
  quad(a: Vtx, b: Vtx, c: Vtx, d: Vtx): void { this.tri(a, b, c); this.tri(a, c, d); }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.colr.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.colr, 3));
    g.userData.smooth = true;
    return g;
  }
}

// ---------- Kopf / head ----------

/** Massstab der Gesichtszelle: Kopfkoordinate 1 (Kugelradius) = FACE_K der Zellenbreite / scale of the face cell: head coordinate 1 (sphere radius) = FACE_K of the cell width */
export const FACE_K = 0.5 / 0.9;
/** Grenze Gesicht / Schaedel: Richtungen mit z darueber liegen in der Gesichtszelle / border face / skull: directions with z above it lie in the face cell */
export const FRONT_Z = 0.5;
/** Rand der Schaedelzelle: Winkel vom Hinterkopf / edge of the scalp cell: angle from the back of the head */
const SCALP_MAX = (125 * Math.PI) / 180;
/** Verdichtung des Gitters vorn (Laenge) und um die Mitte (Breite) / densification of the grid at the front (longitude) and around the middle (latitude) */
const WARP_A = 0.45, WARP_T = 0.35;

/** Zellkoordinate (s, t) einer Blickrichtung im Gesicht / cell coordinate (s, t) of a direction in the face */
export function faceST(x: number, y: number): [number, number] { return [0.5 + x * FACE_K, 0.5 - y * FACE_K]; }
/** Zellkoordinate (s, t) einer Richtung am Schaedel (von hinten gesehen) / cell coordinate (s, t) of a direction on the skull (seen from behind) */
export function scalpST(x: number, y: number, z: number): [number, number] {
  const l = Math.hypot(x, y, z) || 1;
  const r = Math.hypot(x, y) / l;
  if (r < 1e-6) return [0.5, 0.5];
  const k = (Math.acos(Math.max(-1, Math.min(1, -z / l))) / SCALP_MAX) * 0.5;
  return [0.5 - (x / l / r) * k, 0.5 - (y / l / r) * k];
}

/**
 * Malerkoordinaten des Gesichts: (x, y) in Kopfkoordinaten (Kugelradius 1, x zur linken Hand der Figur = im Bild
 * rechts, y nach oben) -> Pixel der Zelle w x h. u() rechnet eine Laenge um.
 * Painter coordinates of the face: (x, y) in head coordinates (sphere radius 1, x towards the figure's left hand = right
 * in the picture, y up) -> pixels of the cell w x h. u() converts a length.
 */
export interface FaceMap { P: (x: number, y: number) => Pt; u: (n: number) => number; w: number; h: number }
export function faceMap(w: number, h: number): FaceMap {
  return { P: (x, y) => [w * (0.5 + x * FACE_K), h * (0.5 - y * FACE_K)], u: (n) => n * w * FACE_K, w, h };
}
/** Malerkoordinaten des Schaedels: Richtung -> Pixel / painter coordinates of the skull: direction -> pixels */
export function scalpMap(w: number, h: number): (x: number, y: number, z: number) => Pt {
  return (x, y, z) => { const [s, t] = scalpST(x, y, z); return [s * w, t * h]; };
}

export interface HeadOpts {
  skin: ColorLike;
  face: Region;
  scalp: Region;
  /** Spalten und Zeilen des Gitters (Standard nach Qualitaet) / columns and rows of the grid (default by quality) */
  ws?: number; hs?: number;
  /** Glaettung der Normalen (Durchgaenge) / smoothing of the normals (passes) */
  soften?: number;
  /** eigene Farbe je Richtung (sonst skin) / own colour per direction (otherwise skin) */
  colour?: (p: THREE.Vector3) => ColorLike | null;
  /** Dreiecke weglassen, deren Ecken alle hier liegen (unter Helm, Kapuze) / drop triangles whose corners all lie here (below helmet, hood) */
  cut?: (p: THREE.Vector3) => boolean;
}

/**
 * Kopf: Kugelgitter, per Sculpt verformt, glatte Normalen, UV in die Zellen 'face' und 'scalp'.
 * Head: sphere grid deformed by Sculpt, smooth normals, uv into the cells 'face' and 'scalp'.
 */
export function headGeometry(S: Sculpt, o: HeadOpts): THREE.BufferGeometry {
  const hi = fine();
  const ws = o.ws ?? (hi ? 112 : 52), hs = o.hs ?? (hi ? 84 : 38);
  const cols = ws + 1, n = cols * (hs + 1);
  const ref: THREE.Vector3[] = [];
  const pos = new Float32Array(n * 3);
  const base = col(o.skin);
  const colr: THREE.Color[] = [];
  for (let j = 0; j <= hs; j++) {
    const v = j / hs;
    const th = Math.PI * (v + (WARP_T * Math.sin(2 * Math.PI * v)) / (2 * Math.PI));
    for (let i = 0; i <= ws; i++) {
      const w = (i / ws) * 2 - 1;
      const al = i === 0 ? -Math.PI : i === ws ? Math.PI : Math.PI * (w - (WARP_A * Math.sin(Math.PI * w)) / Math.PI);
      const st = j === 0 || j === hs ? 0 : Math.sin(th);
      const p = new THREE.Vector3(st * Math.sin(al), j === 0 ? 1 : j === hs ? -1 : Math.cos(th), st * Math.cos(al));
      // Naht hinten exakt schliessen / close the seam at the back exactly
      if (i === 0 || i === ws) p.x = 0;
      p.normalize();
      ref.push(p);
      const q = S.deform(p);
      pos.set([S.centre[0] + q.x * S.radii[0], S.centre[1] + q.y * S.radii[1], S.centre[2] + q.z * S.radii[2]], (j * cols + i) * 3);
      const c = o.colour?.(p);
      colr.push(c ? col(c) : base);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  smoothNormals(g, o.soften ?? (hi ? 6 : 2));
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const m = new Mesh();
  const vtx = (i: number, front: boolean): Vtx => {
    const p = ref[i];
    const [s, t] = front ? faceST(p.x, p.y) : scalpST(p.x, p.y, p.z);
    return { p: new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), n: new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i)), r: front ? o.face : o.scalp, s, t, c: colr[i] };
  };
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (o.cut && o.cut(ref[a]) && o.cut(ref[b]) && o.cut(ref[c])) continue;
    const front = (ref[a].z + ref[b].z + ref[c].z) / 3 > FRONT_Z;
    m.tri(vtx(a, front), vtx(b, front), vtx(c, front));
  }
  g.dispose();
  return m.build();
}

// ---------- Platte / sheet ----------

export interface SheetOpts {
  nu: number; nv: number;
  /** Zelle der Oberseite: s = u, t = v / cell of the top side: s = u, t = v */
  region: Region;
  /** Zelle der Unterseite (sonst die der Oberseite) / cell of the underside (otherwise the top's) */
  back?: Region;
  /** Dicke; 0 = einseitige offene Flaeche / thickness; 0 = one-sided open surface */
  thick?: number;
  /** in u geschlossen (Ring) / closed in u (ring) */
  closedU?: boolean;
  /** Normale umdrehen (die Oberseite zeigt sonst nach dPu x dPv) / flip the normal (the top side otherwise faces dPu x dPv) */
  flip?: boolean;
  color?: ColorLike;
  backColor?: ColorLike;
  /** Farbe je Viereck (an dessen Mitte ausgewertet): harte Farbgrenzen ohne Verlauf / colour per quad (evaluated at its centre): hard colour borders without a gradient */
  colorAt?: (u: number, v: number) => ColorLike;
  /** eigene Zellkoordinaten / own cell coordinates */
  st?: (u: number, v: number) => [number, number];
}

/**
 * Duenne Platte ueber der Flaeche f(u, v), u und v in 0..1: Oberseite, Unterseite und Rand. Die Kanten des Rands
 * bekommen von der Tusche eine Linie.
 * Thin plate over the surface f(u, v), u and v in 0..1: top side, underside and rim. The rim's edges get an ink line.
 */
export function sheet(f: (u: number, v: number) => THREE.Vector3, o: SheetOpts): THREE.BufferGeometry {
  const { nu, nv } = o, th = o.thick ?? 0;
  const P: THREE.Vector3[][] = [], N: THREE.Vector3[][] = [];
  for (let i = 0; i <= nu; i++) { P.push([]); for (let j = 0; j <= nv; j++) P[i].push(f(i / nu, j / nv)); }
  // Ring exakt schliessen / close the ring exactly
  if (o.closedU) for (let j = 0; j <= nv; j++) P[nu][j].copy(P[0][j]);
  const at = (i: number, j: number) => P[o.closedU ? (i + nu) % nu : Math.max(0, Math.min(nu, i))][Math.max(0, Math.min(nv, j))];
  const du = new THREE.Vector3(), dv = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) {
    N.push([]);
    for (let j = 0; j <= nv; j++) {
      du.copy(at(i + 1, j)).sub(at(i - 1, j));
      dv.copy(at(i, j + 1)).sub(at(i, j - 1));
      const nn = new THREE.Vector3().crossVectors(du, dv);
      if (nn.lengthSq() < 1e-20) nn.set(0, 1, 0);
      nn.normalize();
      if (o.flip) nn.negate();
      N[i].push(nn);
    }
  }
  if (o.closedU) for (let j = 0; j <= nv; j++) N[nu][j].copy(N[0][j]);
  const m = new Mesh();
  const cT = o.color !== undefined ? col(o.color) : o.colorAt ? col(o.colorAt(0.5, 0.5)) : undefined, cB = o.backColor !== undefined ? col(o.backColor) : cT;
  const st = o.st ?? ((u: number, v: number): [number, number] => [u, v]);
  const top = (i: number, j: number): Vtx => { const [s, t] = st(i / nu, j / nv); return { p: P[i][j], n: N[i][j], r: o.region, s, t, c: cT }; };
  const B: THREE.Vector3[][] = P.map((row, i) => row.map((p, j) => p.clone().addScaledVector(N[i][j], -th)));
  const bot = (i: number, j: number): Vtx => { const [s, t] = st(i / nu, j / nv); return { p: B[i][j], n: N[i][j].clone().negate(), r: o.back ?? o.region, s, t, c: cB }; };
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const c = o.colorAt ? col(o.colorAt((i + 0.5) / nu, (j + 0.5) / nv)) : undefined;
    const tc = (v: Vtx): Vtx => (c ? { ...v, c } : v);
    m.quad(tc(top(i, j)), tc(top(i + 1, j)), tc(top(i + 1, j + 1)), tc(top(i, j + 1)));
    if (th > 0) m.quad(bot(i, j), bot(i, j + 1), bot(i + 1, j + 1), bot(i + 1, j));
  }
  if (th > 0) {
    // Rand: flache Streifen zwischen Ober- und Unterkante / rim: flat strips between top and bottom edge
    const strip = (a: [number, number], b: [number, number]) => {
      const pa = P[a[0]][a[1]], pb = P[b[0]][b[1]], qa = B[a[0]][a[1]], qb = B[b[0]][b[1]];
      const nn = new THREE.Vector3().crossVectors(pb.clone().sub(pa), qa.clone().sub(pa));
      if (nn.lengthSq() < 1e-22) return;
      nn.normalize();
      // nach aussen: weg von der Plattenmitte / outward: away from the plate's middle
      const mid = P[Math.round(nu / 2)][Math.round(nv / 2)];
      if (nn.dot(pa.clone().add(pb).multiplyScalar(0.5).sub(mid)) < 0) nn.negate();
      const [sa, ta] = st(a[0] / nu, a[1] / nv), [sb, tb] = st(b[0] / nu, b[1] / nv);
      const mk = (p: THREE.Vector3, s: number, t: number): Vtx => ({ p, n: nn, r: o.region, s, t, c: cT });
      m.quad(mk(pa, sa, ta), mk(pb, sb, tb), mk(qb, sb, tb), mk(qa, sa, ta));
    };
    for (let i = 0; i < nu; i++) { strip([i, 0], [i + 1, 0]); strip([i, nv], [i + 1, nv]); }
    if (!o.closedU) for (let j = 0; j < nv; j++) { strip([0, j], [0, j + 1]); strip([nu, j], [nu, j + 1]); }
  }
  return m.build();
}

// ---------- Drehkoerper mit Neigung / revolved body with tilt ----------

export interface RevolveOpts {
  seg: number;
  region: Region;
  /** Unterteilung je Profilabschnitt (Standard 1) / subdivision per profile segment (default 1) */
  sub?: number;
  /** Mitte (x, z), Streckung nach vorn / hinten, Eckigkeit des Querschnitts / centre (x, z), stretch to the front / back, squareness of the cross-section */
  centre?: [number, number]; front?: number; back?: number; e?: number;
  /** Neigung um die x-Achse je Profilpunkt (Bogenmass, negativ hebt die Vorderseite), Drehpunkt (y, z) / tilt about the x axis per profile point (radians, negative lifts the front), pivot (y, z) */
  tilt?: (k: number) => number; pivot?: [number, number];
  /** gespiegelte Abwicklung: vorn Mitte am linken Zellenrand / mirrored unwrap: front centre at the left cell edge */
  mirror?: boolean;
  /** Farbe je Profilabschnitt k (0 = erster) / colour per profile segment k (0 = first) */
  colorAt?: (k: number) => ColorLike;
  color?: ColorLike;
  /** Zellausschnitt entlang des Profils / cell range along the profile */
  t0?: number; t1?: number;
  /** Profil laeuft aussen abwaerts statt aufwaerts / the profile runs down the outside instead of up */
  flip?: boolean;
}
/**
 * Drehkoerper aus einem Profil [Radius, Hoehe] (aussen aufwaerts, oben nach innen): wie loft, aber mit Neigung je
 * Profilpunkt (Muetze mit hoher Stirn, schraeger Kragen) und Farbe je Abschnitt. s rundum (Naht hinten), t entlang
 * des Profils nach Bogenlaenge.
 * Revolved body from a profile [radius, height] (up the outside, inward on top): like loft, but with a tilt per profile
 * point (cap with a high front, slanted collar) and a colour per segment. s around (seam at the back), t along the
 * profile by arc length.
 */
/** Flaechenpunkt des Drehkoerpers: u rundum (0.5 = vorn), k = Profilparameter (0 .. Punkte - 1) / surface point of the revolved body: u around (0.5 = front), k = profile parameter (0 .. points - 1) */
export function revolveAt(profile: [number, number][], o: Pick<RevolveOpts, 'centre' | 'front' | 'back' | 'e' | 'tilt' | 'pivot'>, u: number, k: number): THREE.Vector3 {
  const m = profile.length - 1;
  const e = 2 / (o.e ?? 2), cx = o.centre?.[0] ?? 0, cz = o.centre?.[1] ?? 0;
  const pw = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const kk = Math.max(0, Math.min(m, k)), i = Math.min(m - 1, Math.floor(kk + 1e-9)), fr = kk - i;
  const r = profile[i][0] + (profile[i + 1][0] - profile[i][0]) * fr, y = profile[i][1] + (profile[i + 1][1] - profile[i][1]) * fr;
  const a = u * Math.PI * 2 - Math.PI, sn = Math.sin(a), cs = Math.cos(a);
  const p = new THREE.Vector3(cx + r * pw(sn), y, cz + r * pw(cs) * (cs >= 0 ? o.front ?? 1 : o.back ?? 1));
  const tl = o.tilt?.(kk) ?? 0;
  if (tl) {
    const py = o.pivot?.[0] ?? 0, pz = o.pivot?.[1] ?? 0, c = Math.cos(tl), s = Math.sin(tl);
    const dy = p.y - py, dz = p.z - pz;
    p.y = py + dy * c - dz * s; p.z = pz + dy * s + dz * c;
  }
  return p;
}
export function revolve(profile: [number, number][], o: RevolveOpts): THREE.BufferGeometry {
  const sub = o.sub ?? 1, m = profile.length - 1;
  const acc = [0];
  for (let i = 1; i <= m; i++) acc.push(acc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  const total = acc[m] || 1;
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? 1;
  const tAt = (v: number) => { const k = Math.min(m, v * m), i = Math.min(m - 1, Math.floor(k + 1e-9)); return t0 + ((t1 - t0) * (acc[i] + (acc[i + 1] - acc[i]) * (k - i))) / total; };
  return sheet((u, v) => revolveAt(profile, o, u, v * m), {
    nu: o.seg, nv: m * sub, region: o.region, closedU: true, flip: o.flip, color: o.color,
    colorAt: o.colorAt ? (_u, v) => o.colorAt!(Math.min(m - 1, Math.floor(v * m))) : undefined,
    st: (u, v) => [o.mirror ? Math.abs(2 * u - 1) : u, tAt(v)],
  });
}

// ---------- Kleinteile / small parts ----------

/** Ohr in lokalen Koordinaten: Ebene y-z, Aussenseite +x, Hoehe 2 x size / ear in local coordinates: plane y-z, outer side +x, height 2 x size */
export function earGeometry(region: Region, size: number, color: ColorLike, pointy = 0): THREE.BufferGeometry {
  const n = fine() ? 12 : 6;
  return sheet((u, v) => {
    const a = 2 * u - 1, b = 2 * v - 1;
    const x = a * Math.sqrt(1 - (b * b) / 2), y = -b * Math.sqrt(1 - (a * a) / 2);
    const rr = Math.min(1, x * x + y * y);
    // Muschel: Rand gewoelbt, Mitte eingedrueckt / shell: rim raised, middle dented
    const out = 0.3 * Math.sqrt(1 - rr) - 0.2 * Math.exp(-(((x + 0.15) / 0.45) ** 2 + ((y - 0.05) / 0.5) ** 2)) + 0.1;
    return new THREE.Vector3(out * size, y * size * (1 + pointy * Math.max(0, y) ** 2) * (y < 0 ? 0.88 : 1), -x * size * 0.58 * (1 + 0.22 * y));
  }, { nu: n, nv: n, region, thick: size * 0.2, color, flip: true });
}

/**
 * Flache Platte mit freiem Umriss in der x-y-Ebene (Vorderseite +z, sternfoermig um den Schwerpunkt der Ecken); UV:
 * Draufsicht um den Ursprung, Rahmen = groesste Koordinate.
 * Flat plate with a free outline in the x-y plane (front +z, star-shaped about the centroid of its corners); uv: plan
 * view about the origin, frame = largest coordinate.
 */
export function polyPlate(outline: [number, number][], thick: number, region: Region, color: ColorLike, backColor: ColorLike = color): THREE.BufferGeometry {
  const m = new Mesh();
  const c = col(color), cb = col(backColor), zf = new THREE.Vector3(0, 0, 1);
  // im Uhrzeigersinn angegebene Umrisse umdrehen / reverse outlines given clockwise
  let area = 0;
  outline.forEach(([x, y], i) => { const [x2, y2] = outline[(i + 1) % outline.length]; area += x * y2 - x2 * y; });
  const pts = (area < 0 ? outline.slice().reverse() : outline).map(([x, y]) => new THREE.Vector3(x, y, 0));
  const ro = Math.max(...pts.map((q) => Math.max(Math.abs(q.x), Math.abs(q.y)))) || 1;
  const st = (p: THREE.Vector3): [number, number] => [0.5 + p.x / (2 * ro), 0.5 - p.y / (2 * ro)];
  const front = (p: THREE.Vector3): Vtx => { const [s, t] = st(p); return { p: p.clone().setZ(thick), n: zf, r: region, s, t, c }; };
  const mid = new THREE.Vector3();
  for (const q of pts) mid.addScaledVector(q, 1 / pts.length);
  const centre = front(mid);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    m.tri(centre, front(a), front(b));
    const nn = new THREE.Vector3(b.y - a.y, -(b.x - a.x), 0).normalize();
    const side = (p: THREE.Vector3, z: number): Vtx => { const [s, t] = st(p); return { p: p.clone().setZ(z), n: nn, r: region, s, t, c: cb }; };
    m.quad(side(a, thick), side(b, thick), side(b, 0), side(a, 0));
  }
  return m.build();
}
/** Sternplatte mit n Zacken / star plate with n points */
export function starPlate(n: number, ro: number, ri: number, thick: number, region: Region, color: ColorLike, rot = Math.PI / 2): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * Math.PI * 2, r = i % 2 === 0 ? ro : ri; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return polyPlate(pts, thick, region, color);
}
/** Regelmaessiges Vieleck als Umriss / regular polygon as an outline */
export function ngon(n: number, r: number, rot = Math.PI / 2, sx = 1, sy = 1): [number, number][] {
  return Array.from({ length: n }, (_, i): [number, number] => { const a = rot + (i / n) * Math.PI * 2; return [Math.cos(a) * r * sx, Math.sin(a) * r * sy]; });
}

/** Flacher Knopf mit gezeichneter Oberseite (Zelle cellName); +y der Zeichnung zeigt im Raum nach oben / flat stud with a drawn top (cell cellName); the drawing's +y points up in space */
export function stud(b: UvBuilder, A: AtlasLayout, at: THREE.Vector3, n: THREE.Vector3, r: number, h: number, cellName: string, color: ColorLike, gloss = 0.6, seg = 16): void {
  const front = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  b.bone(at.clone().addScaledVector(n, -h * 0.4), at.clone().addScaledVector(n, h), front, () => {
    b.add(loft([{ y: 0, rx: r, c: color }, { y: h * 1.25, rx: r, hard: true }, { y: h * 1.4, rx: r * 0.9 }], { seg: fine() ? seg : Math.max(6, Math.round(seg * 0.6)), region: A.get('blank'), capLast: A.get(cellName) }), null, { gloss, crease: 0.8 });
  });
}
/** Gewoelbter Stein oder Leuchte / domed gem or lamp */
export function gemDome(b: UvBuilder, A: AtlasLayout, at: THREE.Vector3, n: THREE.Vector3, r: number, h: number, color: ColorLike, gloss = 1, squash: [number, number] = [1, 1]): void {
  const front = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  b.bone(at, at.clone().addScaledVector(n, h), front, () => {
    b.add(loft([{ y: 0, rx: r * squash[0], rz: r * squash[1], c: color }, { y: h * 0.45, rx: r * 0.9 * squash[0], rz: r * 0.9 * squash[1] }, { y: h * 0.8, rx: r * 0.6 * squash[0], rz: r * 0.6 * squash[1] }, { y: h * 0.96, rx: r * 0.28 * squash[0], rz: r * 0.28 * squash[1] }, { y: h, rx: 1e-7 }], { seg: fine() ? 14 : 8, region: A.get('blank') }), null, { gloss, crease: 0 });
  });
}

/**
 * Schale ueber dem Oberkoerper (Umhang, Mantel, Schulterplatte): map(u, v) liefert Umlaufwinkel, Hoehenparameter (wie
 * torsoPoint) und Abstand zur Flaeche; sonst wie sheet().
 * Shell over the torso (cape, coat, shoulder plate): map(u, v) returns the angle around, the height parameter (as
 * torsoPoint) and the distance from the surface; otherwise as sheet().
 */
export function torsoShell(o: TorsoSpec, map: (u: number, v: number) => [number, number, number], opts: SheetOpts): THREE.BufferGeometry {
  return sheet((u, v) => {
    const [a, vv, grow] = map(u, v);
    const p = torsoPoint(o, a, vv);
    const du = torsoPoint(o, a + 0.01, vv).sub(torsoPoint(o, a - 0.01, vv)), dv = torsoPoint(o, a, Math.min(1, vv + 0.01)).sub(torsoPoint(o, a, Math.max(0, vv - 0.01)));
    const n = new THREE.Vector3().crossVectors(dv, du).normalize();
    // nach aussen: weg von der Koerperachse, auf der Schulter nach oben / outward: away from the body axis, upward on the shoulder
    if (n.dot(new THREE.Vector3(p.x, vv > WALL ? 0.35 : 0, p.z - (o.z ?? 0))) < 0) n.negate();
    return p.addScaledVector(n, grow);
  }, opts);
}
/** Hoehenparameter der Schulterkante (torsoPoint) / height parameter of the shoulder edge (torsoPoint) */
export const TORSO_WALL = WALL;

/** Flaeche, die dem Gesicht folgt: map(u, v) liefert Kopfkoordinaten (x, y) und Abstand (Kopfradien) / surface following the face: map(u, v) returns head coordinates (x, y) and the lift (head radii) */
export function faceSheet(S: Sculpt, map: (u: number, v: number) => [number, number, number], opts: SheetOpts): THREE.BufferGeometry {
  return sheet((u, v) => { const [x, y, l] = map(u, v); return V(S.surf(x, y, l)); }, opts);
}

// ---------- Schlauch / tube ----------

export interface TubeOpts {
  seg: number;
  region: Region;
  /** Stuetzstellen entlang des Pfads / samples along the path */
  samples?: number;
  /** Richtung der Aussenseite (Standard +z): dorthin zeigt die Mitte der Zelle / direction of the outer side (default +z): the cell's middle faces there */
  out?: V3 | ((t: number) => THREE.Vector3);
  /** ganze Zelle auf die Aussenseite (die Innenseite bekommt den Rand) / whole cell onto the outer side (the inner side gets the edge) */
  front?: boolean;
  /** Zelle senkrecht spiegeln (zweiter Fluegel eines Paars) / mirror the cell vertically (second wing of a pair) */
  flipV?: boolean;
  /** Zellausschnitt entlang des Pfads / cell range along the path */
  s0?: number; s1?: number;
  color?: ColorLike | ((t: number) => ColorLike);
}

/**
 * Schlauch entlang eines Pfads (Catmull-Rom). radius(t) liefert [zur Aussenseite, quer]; UV: s entlang, t rundum.
 * Tube along a path (Catmull-Rom). radius(t) returns [towards the outer side, across]; uv: s along, t around.
 */
export function tube(path: V3[], radius: (t: number) => number | [number, number], o: TubeOpts): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(path.map(V), false, 'centripetal');
  const n = o.samples ?? Math.max(6, path.length * 4), seg = Math.max(3, o.seg);
  const rings: { p: THREE.Vector3; n: THREE.Vector3; t: number; a: number; c?: THREE.Color }[][] = [];
  const centres: THREE.Vector3[] = [], tans: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const C = curve.getPoint(t), T = curve.getTangent(t).normalize();
    const want = typeof o.out === 'function' ? o.out(t) : V(o.out ?? [0, 0, 1]);
    const N = want.clone().addScaledVector(T, -want.dot(T));
    if (N.lengthSq() < 1e-8) N.set(0, 1, 0).addScaledVector(T, -T.y);
    N.normalize();
    const B = new THREE.Vector3().crossVectors(T, N);
    if (o.flipV) B.negate();
    const rr = radius(t);
    const rn = Math.max(1e-6, typeof rr === 'number' ? rr : rr[0]), rb = Math.max(1e-6, typeof rr === 'number' ? rr : rr[1]);
    const c = o.color === undefined ? undefined : col(typeof o.color === 'function' ? o.color(t) : o.color);
    const ring = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2 - Math.PI;
      const ca = Math.cos(a), sa = Math.sin(a);
      ring.push({
        p: C.clone().addScaledVector(N, ca * rn).addScaledVector(B, sa * rb),
        n: new THREE.Vector3().addScaledVector(N, ca / rn).addScaledVector(B, sa / rb).normalize(),
        t, a, c,
      });
    }
    ring[seg].p.copy(ring[0].p);
    rings.push(ring);
    centres.push(C); tans.push(T);
  }
  const s0 = o.s0 ?? 0, s1 = o.s1 ?? 1;
  const m = new Mesh();
  const vt = (a: number): number => (o.front ? Math.max(0, Math.min(1, 0.5 + a / Math.PI)) : 0.5 + a / (2 * Math.PI));
  const mk = (q: { p: THREE.Vector3; n: THREE.Vector3; t: number; a: number; c?: THREE.Color }): Vtx => ({ p: q.p, n: q.n, r: o.region, s: s0 + (s1 - s0) * q.t, t: vt(q.a), c: q.c });
  for (let i = 0; i < n; i++) for (let k = 0; k < seg; k++) m.quad(mk(rings[i][k]), mk(rings[i + 1][k]), mk(rings[i + 1][k + 1]), mk(rings[i][k + 1]));
  // Enden schliessen / close the ends
  for (const [i, dir] of [[0, -1], [n, 1]] as const) {
    const nn = tans[i].clone().multiplyScalar(dir);
    const c: Vtx = { p: centres[i], n: nn, r: o.region, s: i === 0 ? s0 : s1, t: 0.5, c: rings[i][0].c };
    for (let k = 0; k < seg; k++) m.tri(c, { ...mk(rings[i][k]), n: nn }, { ...mk(rings[i][k + 1]), n: nn });
  }
  return m.build();
}

// ---------- Oberkoerper / torso ----------

export interface TorsoSpec {
  /** halbe Breite, halbe Tiefe, Hoehe der Schulterkante / half width, half depth, height of the shoulder edge */
  w: number; d: number; h: number;
  /** Abfall der Schultern nach aussen / drop of the shoulders towards the outside */
  slope: number;
  /** Halsradius und Anstieg von der Schulterkante zum Hals / neck radius and rise from the shoulder edge to the neck */
  neckR: number; rise: number;
  /** Eckigkeit des Querschnitts 0..1 / squareness of the cross-section 0..1 */
  square: number;
  /** Versatz nach hinten / offset to the back */
  z?: number;
  /** Brustwoelbung nach vorn / chest bulge to the front */
  chest?: number;
}
export const TORSO: TorsoSpec = { w: 0.44, d: 0.21, h: 0.4, slope: 0.07, neckR: 0.1, rise: 0.045, square: 0.25, z: -0.01, chest: 0 };

/** Oberflaechenpunkt des Oberkoerpers: Umlaufwinkel a (0 = +x, PI/2 = vorn), v in 0..1 (0 unten, WALL = Schulterkante, 1 = Hals) / surface point of the torso: angle a around (0 = +x, PI/2 = front), v in 0..1 (0 bottom, WALL = shoulder edge, 1 = neck) */

export function torsoPoint(o: TorsoSpec, a: number, v: number): THREE.Vector3 {
  const ca = Math.cos(a), sa = Math.sin(a), e = 2 + o.square * 4;
  const k = 1 / Math.pow(Math.pow(Math.abs(ca), e) + Math.pow(Math.abs(sa), e), 1 / e);
  let x: number, y: number, z: number;
  if (v <= WALL) {
    const h = v / WALL;
    const wh = o.w * (0.86 + 0.14 * smoothstep(0, 0.75, h)) * (1 - 0.1 * smoothstep(0.8, 1, h));
    const dh = o.d * (0.92 + 0.08 * smoothstep(0, 0.6, h)) * (1 - 0.12 * smoothstep(0.8, 1, h));
    x = ca * k * wh; z = sa * k * dh; y = h * o.h;
    y -= o.slope * (x / o.w) ** 2 * smoothstep(0.6, 1, h) * 1.4;
    if (sa > 0) z += (o.chest ?? 0) * sa * Math.sin(Math.PI * Math.min(1, h * 1.05)) ** 2;
  } else {
    const r2 = 1 - (v - WALL) / (1 - WALL);
    const rad = o.neckR / o.w + (1 - o.neckR / o.w) * r2;
    const radz = o.neckR / o.d + (1 - o.neckR / o.d) * r2;
    // zum Hals hin rund: der Querschnitt geht von der eckigen Ellipse in einen Kreis ueber / round towards the neck: the cross-section turns from the squarish ellipse into a circle
    const kk = k + (1 - k) * (1 - r2);
    x = ca * kk * o.w * 0.9 * rad; z = sa * kk * o.d * 0.88 * radz;
    y = o.h - o.slope * (x / o.w) ** 2 * 1.4 + o.rise * Math.pow(1 - r2, 1.5);
  }
  return new THREE.Vector3(x, y, z + (o.z ?? 0));
}
/** Punkt und Normale vorn auf der Brust bei Modellkoordinate (x, y) / point and normal on the front of the chest at model coordinate (x, y) */
export function chestAt(o: TorsoSpec, x: number, y: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  // Winkel suchen, dessen Punkt bei der Hoehe das gewuenschte x hat / search the angle whose point has the wanted x at this height
  const v = Math.max(0, Math.min(WALL, (y / o.h) * WALL));
  let lo = 0.02, hi = Math.PI - 0.02;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (torsoPoint(o, mid, v).x > x) lo = mid; else hi = mid;
  }
  const a = (lo + hi) / 2;
  const p = torsoPoint(o, a, v);
  const du = torsoPoint(o, a + 0.01, v).sub(torsoPoint(o, a - 0.01, v)), dv = torsoPoint(o, a, Math.min(WALL, v + 0.01)).sub(torsoPoint(o, a, Math.max(0, v - 0.01)));
  const n = new THREE.Vector3().crossVectors(dv, du).normalize();
  if (n.z < 0) n.negate();
  return { p, n };
}
/** Punkt und Normale auf der Schulter: Umlaufwinkel a, r = 0 (Kante) .. 1 (Hals) / point and normal on the shoulder: angle a around, r = 0 (edge) .. 1 (neck) */
export function shoulderAt(o: TorsoSpec, a: number, r: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  const v = WALL + (1 - WALL) * r;
  const p = torsoPoint(o, a, v);
  const du = torsoPoint(o, a + 0.01, v).sub(torsoPoint(o, a - 0.01, v)), dv = torsoPoint(o, a, Math.min(1, v + 0.01)).sub(torsoPoint(o, a, v - 0.01));
  const n = new THREE.Vector3().crossVectors(dv, du).normalize();
  if (n.y < 0) n.negate();
  return { p, n };
}

export interface TorsoCells { chest: Region; back: Region; side: Region; top: Region; blank: Region }
/** Grenzen der Brustzelle in Modellkoordinaten (fuer die Malerei) / bounds of the chest cell in model coordinates (for the painting) */
export function torsoBounds(o: TorsoSpec): THREE.Box3 {
  const z = o.z ?? 0;
  return new THREE.Box3(new THREE.Vector3(-o.w, 0, -o.d + z), new THREE.Vector3(o.w, o.h + o.rise, o.d + z + (o.chest ?? 0)));
}
/** Malerkoordinaten der Brust: Modell (x, y) -> Pixel der Zelle w x h / painter coordinates of the chest: model (x, y) -> pixels of the cell w x h */
export function chestMap(o: TorsoSpec, w: number, h: number): { P: (x: number, y: number) => Pt; u: (n: number) => number } {
  const top = o.h + o.rise;
  return { P: (x, y) => [((x + o.w) / (2 * o.w)) * w, ((top - y) / top) * h], u: (n) => (n / (2 * o.w)) * w };
}

/**
 * Oberkoerper: glatte Flaeche, Brust / Ruecken / Seiten / Schultern je in eine Zelle projiziert (wie projectBox).
 * Torso: smooth surface, chest / back / sides / shoulders each projected into a cell (as projectBox).
 */
export function torsoGeometry(o: TorsoSpec, cells: TorsoCells, color: ColorLike): THREE.BufferGeometry {
  const hi = fine();
  const na = hi ? 88 : 40, nw = hi ? 20 : 9, nt = hi ? 10 : 5, rows = nw + nt;
  const n = na * (rows + 1);
  const pos = new Float32Array(n * 3);
  for (let j = 0; j <= rows; j++) {
    const v = j <= nw ? (j / nw) * WALL : WALL + ((j - nw) / nt) * (1 - WALL);
    for (let i = 0; i < na; i++) {
      const p = torsoPoint(o, (i / na) * Math.PI * 2, v);
      pos.set([p.x, p.y, p.z], (j * na + i) * 3);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < na; i++) {
    const a = j * na + i, b = j * na + ((i + 1) % na), c = a + na, d = b + na;
    index.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  const flat = g.toNonIndexed();
  g.dispose();
  // nach aussen wickeln / wind outward
  const P = flat.getAttribute('position') as THREE.BufferAttribute, Nn = flat.getAttribute('normal') as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  let flips = 0, total = 0;
  for (let t = 0; t < P.count; t += 3) {
    a.fromBufferAttribute(P, t); b.fromBufferAttribute(P, t + 1); c.fromBufferAttribute(P, t + 2);
    fn.crossVectors(b.sub(a), c.sub(a));
    a.setY(0);
    if (fn.dot(a) < 0) flips++;
    total++;
  }
  if (flips > total / 2) {
    for (const attr of [P, Nn]) for (let t = 0; t < attr.count; t += 3) {
      const x = attr.getX(t + 1), y = attr.getY(t + 1), z = attr.getZ(t + 1);
      attr.setXYZ(t + 1, attr.getX(t + 2), attr.getY(t + 2), attr.getZ(t + 2));
      attr.setXYZ(t + 2, x, y, z);
    }
    for (let i = 0; i < Nn.count; i++) Nn.setXYZ(i, -Nn.getX(i), -Nn.getY(i), -Nn.getZ(i));
  }
  flat.userData.smooth = true;
  const out = projectBox(flat, { pz: cells.chest, nz: cells.back, px: cells.side, nx: cells.side, py: cells.top, ny: cells.blank, mirrorNx: true, bounds: torsoBounds(o) });
  const cc = col(color), arr = new Float32Array(out.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = cc.r; arr[i + 1] = cc.g; arr[i + 2] = cc.b; }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  out.userData.smooth = true;
  return out;
}

// ---------- Abwicklung spiegeln / mirroring the unwrap ----------

/**
 * Loft-Abwicklung spiegeln: s' = |2 s - 1|. Die Mitte vorn (s = 0.5) liegt dann am linken Zellenrand, hinten Mitte am
 * rechten; linke und rechte Haelfte teilen sich die Zelle (doppelte Dichte fuer symmetrische Teile). Der Loft muss mit
 * derselben Zelle und gerader Segmentzahl gebaut sein.
 * Mirror the unwrap of a loft: s' = |2 s - 1|. The front centre (s = 0.5) then lies at the left cell edge, the back
 * centre at the right; left and right half share the cell (double density for symmetric parts). The loft must have
 * been built with the same cell and an even segment count.
 */
export function mirrorS<G extends THREE.BufferGeometry>(g: G, r: Region): G {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const u0 = r.x / REF, w = r.w / REF;
  for (let i = 0; i < uv.count; i++) {
    const s = (uv.getX(i) - u0) / w;
    if (s < -0.01 || s > 1.01) continue;
    uv.setX(i, u0 + Math.abs(2 * s - 1) * w);
  }
  return g;
}

/** Vertexfarbe eines Teils setzen (alle Ecken) / set the vertex colour of a part (all vertices) */
export function tint<G extends THREE.BufferGeometry>(g: G, c: ColorLike): G {
  const cc = col(c), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Kopfpunkt in Weltkoordinaten: Richtung d, um lift (Kopfradien) nach aussen / head point in world coordinates: direction d, lifted outward by lift (head radii) */
export function onHead(S: Sculpt, d: V3, lift = 0): THREE.Vector3 { return V(S.dir(d, lift)); }
/** Kopfpunkt vorn bei (x, y) / head point at the front at (x, y) */
export function onFace(S: Sculpt, x: number, y: number, lift = 0): THREE.Vector3 { return V(S.surf(x, y, lift)); }
