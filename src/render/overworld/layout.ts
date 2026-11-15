/**
 * Lage der Welten und der Einsatzmarker als reine Rechnung (ohne Three.js, testbar). Neue Einsaetze sind nur Daten
 * (WORLDS, MISSIONS, Texte): Die Marker werden aus der Anzahl der Einsaetze einer Welt erzeugt.
 * Layout of the worlds and the mission markers as pure maths (no Three.js, testable). New missions are data only
 * (WORLDS, MISSIONS, texts): markers are generated from the number of missions of a world.
 *
 * Verfahren / method:
 * 1. Ein Schlangenweg ueber die Scheibe: eine Reihe mit Schlenkern fuer wenige Einsaetze, drei Reihen fuer viele;
 *    er beginnt links und endet rechts (dort liegen Portal und Riss).
 *    A serpentine across the disc: one meandering row for few missions, three rows for many; it starts on the left
 *    and ends on the right (where portal and rift are).
 * 2. Teile des Wegs in Wahrzeichen (Portal, Nest, Hoehle, Ruinen ...) und um verankerte Marker herum fallen weg.
 *    Parts of the path inside landmarks (portal, hive, cave, ruins ...) and around anchored markers are dropped.
 * 3. Einsaetze mit Anker (MARKER_ANCHORS) stehen an ihrem Wahrzeichen, alle anderen gleichmaessig auf dem Rest.
 *    Missions with an anchor (MARKER_ANCHORS) stand at their landmark, all others evenly along the rest.
 */
import type { WorldId } from '../../core/worlds';

export interface P2 { x: number; z: number }
/** Kreis, den der Weg meidet / circle the path avoids */
export interface Zone extends P2 { r: number }

/** Wahrzeichen, an denen ein Einsatz verankert sein kann / landmarks a mission can be anchored to */
export type Landmark = 'portalSide' | 'portal' | 'hive' | 'cave';

/**
 * Einsaetze mit festem Platz (optional, nur Daten): m3 am Rand zur Alienwelt (Portalweg), m11 am Nest der
 * Schwarmmutter, das Finale m9 am Hoehleneingang. Alle anderen folgen dem Weg.
 * Missions with a fixed spot (optional, data only): m3 at the rim towards the alien world (portal path), m11 at the
 * Swarm Mother's nest, the finale m9 at the cave mouth. All others follow the path.
 */
export const MARKER_ANCHORS: Readonly<Record<string, Landmark>> = { m3: 'portalSide', m11: 'hive', m9: 'cave' };

/** Mindestabstand zwischen Markern (Welteinheiten, Scheibenradius 1.6) / minimum distance between markers */
export const MARKER_GAP = 0.27;

const dist = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Schlangenweg als dichter Linienzug / serpentine as a dense polyline */
export function serpentine(n: number, R: number, phase = 0, rows3 = n > 6): P2[] {
  const out: P2[] = [];
  const reach = R * 0.8;
  if (!rows3) {
    // eine Reihe mit Schlenkern / one meandering row
    const amp = R * (n <= 3 ? 0.18 : 0.34);
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const x = (-0.72 + t * 1.44) * R;
      const z = Math.sin(t * Math.PI * 2 + phase) * amp;
      out.push(clampIn({ x, z }, reach));
    }
    return out;
  }
  // drei Reihen hinten -> vorn, Richtung wechselt; endet rechts / three rows back -> front, alternating; ends on the right
  const rows = [-0.5, 0, 0.5].map((k) => k * R);
  rows.forEach((z, j) => {
    const w = Math.sqrt(Math.max(0, reach * reach - z * z)) * 0.92;
    const dir = j % 2 === 0 ? 1 : -1;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const x = dir * (-w + t * 2 * w);
      out.push({ x, z: z + Math.sin(t * Math.PI * 3 + phase + j) * R * 0.05 });
    }
    if (j < rows.length - 1) {
      // Wendebogen zur naechsten Reihe / turn arc to the next row
      const z2 = rows[j + 1];
      const w2 = Math.sqrt(Math.max(0, reach * reach - z2 * z2)) * 0.92;
      const xe = dir * Math.min(w, w2);
      const cz = (z + z2) / 2, rz = (z2 - z) / 2;
      for (let i = 1; i < 16; i++) {
        const a = -Math.PI / 2 + (i / 16) * Math.PI;
        out.push(clampIn({ x: xe + dir * Math.cos(a) * rz * 0.6, z: cz + Math.sin(a) * rz }, reach));
      }
    }
  });
  return out;
}

function clampIn(p: P2, reach: number): P2 {
  const r = Math.hypot(p.x, p.z);
  return r > reach ? { x: (p.x * reach) / r, z: (p.z * reach) / r } : p;
}

/**
 * Marker einer Welt platzieren / place the markers of one world.
 * ids: Einsaetze in Spielreihenfolge; landmarks: Lage der Wahrzeichen dieser Welt; avoid: Zonen, die frei bleiben.
 * ids: missions in play order; landmarks: positions of this world's landmarks; avoid: zones to keep clear.
 */
export function markerLayout(ids: readonly string[], opts: LayoutOpts): P2[] {
  // mehrere Wegformen probieren, die erste ohne Ueberlappung nehmen (sonst die luftigste)
  // try several path shapes, take the first without overlap (else the roomiest)
  const gap = opts.gap ?? MARKER_GAP;
  const ph = opts.phase ?? 0;
  const many = ids.length > 6;
  const tries: [number, boolean][] = [];
  for (const rows3 of [many, !many]) for (let k = 0; k < 8; k++) tries.push([ph + (k * Math.PI) / 4, rows3]);
  let best: P2[] = [], bestGap = -1;
  for (const [phase, rows3] of tries) {
    const ps = placeOn(ids, opts, phase, rows3);
    const g = minSpacing(ps);
    if (g >= gap) return ps;
    if (g > bestGap) { best = ps; bestGap = g; }
  }
  return best;
}

export interface LayoutOpts {
  R: number; landmarks?: Partial<Record<Landmark, P2>>; avoid?: readonly Zone[]; anchors?: Readonly<Record<string, Landmark>>; phase?: number; gap?: number;
}

function placeOn(ids: readonly string[], opts: LayoutOpts, phase: number, rows3: boolean): P2[] {
  const { R } = opts;
  const gap = opts.gap ?? MARKER_GAP;
  const anchors = opts.anchors ?? MARKER_ANCHORS;
  const fixed = new Map<number, P2>();
  ids.forEach((id, i) => { const lm = anchors[id]; const p = lm ? opts.landmarks?.[lm] : undefined; if (p) fixed.set(i, p); });
  const free = ids.map((_, i) => i).filter((i) => !fixed.has(i));
  const blocked: Zone[] = [...(opts.avoid ?? []), ...[...fixed.values()].map((p) => ({ ...p, r: gap * 1.15 }))];
  const line = serpentine(ids.length, R, phase, rows3);
  // gueltige Stuecke des Wegs mit Bogenlaenge / valid pieces of the path with arc length
  const ok = line.map((p) => !blocked.some((z) => dist(p, z) < z.r));
  const segs: { a: P2; b: P2; len: number; at: number }[] = [];
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    if (!ok[i] || !ok[i + 1]) continue;
    const len = dist(line[i], line[i + 1]);
    segs.push({ a: line[i], b: line[i + 1], len, at: total });
    total += len;
  }
  const out: P2[] = ids.map((_, i) => fixed.get(i) ?? { x: 0, z: 0 });
  if (!free.length) return out;
  // fein abgetastete gueltige Punkte mit Bogenlaenge / finely sampled valid points with arc length
  const samples: { p: P2; s: number }[] = [];
  for (const g of segs) {
    const k = Math.max(1, Math.ceil(g.len / 0.02));
    for (let i = 0; i < k; i++) samples.push({ p: { x: g.a.x + ((g.b.x - g.a.x) * i) / k, z: g.a.z + ((g.b.z - g.a.z) * i) / k }, s: g.at + (g.len * i) / k });
  }
  // gleichmaessiger Schritt; jeder Punkt haelt auch in der Luftlinie Abstand zu den vorigen (Spruenge ueber Zonen)
  // even step; every point also keeps the straight-line gap to the previous ones (jumps across zones)
  let step = total / free.length;
  let pts: P2[] = [];
  for (let attempt = 0; attempt < 30 && pts.length < free.length; attempt++, step *= 0.94) {
    pts = [];
    let next = step / 2;
    for (const q of samples) {
      if (q.s < next) continue;
      if (pts.some((p) => dist(p, q.p) < gap)) continue;
      pts.push(q.p);
      next = q.s + step;
      if (pts.length === free.length) break;
    }
  }
  free.forEach((idx, k) => { out[idx] = pts[k] ?? pts[pts.length - 1] ?? { x: 0, z: 0 }; });
  return out;
}

/** Kleinster Abstand zwischen zwei Markern (Tests) / smallest distance between two markers (tests) */
export function minSpacing(ps: readonly P2[]): number {
  let m = Infinity;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) m = Math.min(m, dist(ps[i], ps[j]));
  return m;
}

/**
 * Lage der sichtbaren Welten: eine allein in der Mitte, zwei nebeneinander, drei in einem flachen Bogen.
 * Position of the visible worlds: one alone in the centre, two side by side, three in a gentle arc.
 */
export function worldPositions(ids: readonly WorldId[]): Record<string, { x: number; y: number; z: number }> {
  const out: Record<string, { x: number; y: number; z: number }> = {};
  const n = ids.length;
  const spacing = 4.5;
  ids.forEach((id, i) => {
    const k = i - (n - 1) / 2;
    out[id] = { x: k * spacing, y: (id === 'alien' ? 0.2 : id === 'forgotten' ? -0.05 : -0.15), z: n === 3 ? (k === 0 ? -0.35 : 0.55) : 0 };
  });
  return out;
}
