/**
 * Gezeichnete Einheiten, Gruppe See und Fremde: gemeinsame Zeichenhilfen (Bullauge, Fenster, Schott, Leiter, Planken,
 * Plattenstoesse, Anker, Rettungsring) und die Zellen, die mehrere Atlanten der Gruppe teilen.
 * Inked units, group sea and aliens: shared drawing helpers (porthole, window, watertight door, ladder, planks, plate
 * butts, anchor, life ring) and the cells several atlases of the group share.
 *
 * Stilregel: nur flache Toene. Planken und Plattenstoesse sind wenige, unregelmaessige Fugen, nie ein Raster.
 * Style rule: flat tones only. Planks and plate butts are a few irregular joints, never a screen pattern.
 */
import { rng, type ColorLike } from '../kit';
import { mat } from '../look';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { emblemCells } from './emblem';
import { figureCells } from './figurePaint';
import { BARE, SOOT, trimCells } from './trim';

/** Rost in zwei Toenen / rust in two tones */
export const RUST = mat.rustDark;
export const RUST_LIGHT = mat.rust;

/** Rechteck als Punkte / rectangle as points */
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** Kreis als Punkte / circle as points */
export const ring = (x: number, y: number, r: number, n = 14, ry = r): Pt[] => arc(x, y, r, ry, 0, Math.PI * 2, n).slice(0, n);

/** Bullauge: dunkles Glas, Tuschering, Lichtkante / porthole: dark glass, ink ring, light edge */
export function porthole(p: Pen, x: number, y: number, r: number, glass: ColorLike = mat.window): void {
  p.fill(ring(x, y, r), glass);
  p.line(ring(x, y, r), Math.max(1.1, r * 0.34), { closed: true, wobble: 0.08, press: 0.1 });
  p.fill(arc(x - r * 0.1, y - r * 0.1, r * 0.55, r * 0.55, Math.PI * 1.05, Math.PI * 1.6, 5).concat([[x - r * 0.2, y - r * 0.15]]), mat.white, 0.5);
  p.crease(arc(x, y, r + 1.6, r + 1.6, 0.3, 1.9, 6), 1.2, 1.5, 0.7, { taper: 0.3 });
}

/** Fenster mit Rahmen und Glanz / window with a frame and a glint */
export function windowPane(p: Pen, x: number, y: number, w: number, h: number, glass: ColorLike = mat.window, r = 2): void {
  p.fill(rrect(x, y, w, h, r), glass);
  p.fill([[x + w * 0.12, y + h * 0.85], [x + w * 0.42, y + h * 0.12], [x + w * 0.6, y + h * 0.12], [x + w * 0.3, y + h * 0.85]], mat.white, 0.32);
  p.line(rrect(x, y, w, h, r), 1.5, { closed: true, wobble: 0.12, press: 0.15 });
}
/** Fensterband: n Scheiben mit Streben / window band: n panes with mullions */
export function windowBand(p: Pen, x: number, y: number, w: number, h: number, n: number, glass: ColorLike = mat.window): void {
  const gap = 3, pw = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) windowPane(p, x + i * (pw + gap), y, pw, h, glass);
}

/** Schotttuer mit Vorreibern und Suell / watertight door with dogs and a sill */
export function hatchDoor(p: Pen, x: number, y: number, w: number, h: number): void {
  p.shade(rrect(x, y, w, h, w * 0.3), 0.88, 0.9);
  p.line(rrect(x, y, w, h, w * 0.3), 1.6, { closed: true, wobble: 0.15 });
  p.crease(rrect(x + 1.6, y + 1.6, w, h, w * 0.3).slice(2, 9), 1.2, 1.5, 0.7, { taper: 0.2 });
  for (const [dx, dy] of [[-1, 0.25], [-1, 0.75], [w + 1, 0.5]] as Pt[]) p.line([[x + dx - 2, y + h * dy], [x + dx + 2, y + h * dy]], 1.7, { taper: 0, wobble: 0 });
  porthole(p, x + w / 2, y + h * 0.3, Math.min(3.2, w * 0.22));
}

/** Leiter: zwei Holme, Sprossen / ladder: two rails, rungs */
export function ladder(p: Pen, x: number, y0: number, y1: number, w = 7, step = 6.5): void {
  for (const dx of [0, w]) p.line([[x + dx, y0], [x + dx, y1]], 1.3, { taper: 0.03, wobble: 0.15 });
  for (let y = y0 + step * 0.6; y < y1 - 1; y += step) p.line([[x, y], [x + w, y]], 1.1, { taper: 0, wobble: 0 });
}

/**
 * Plankengang: wenige lange Fugen entlang x mit versetzten Stoessen; jede Fuge leicht anders, einzelne Planken getoent.
 * Planking: a few long seams along x with staggered butts; each seam slightly different, single planks tinted.
 */
export function planks(p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number, butt = 110): void {
  const R = rng(seed);
  const pitch = h / n;
  for (let i = 0; i < n; i++) {
    const yy = y + i * pitch;
    if (R() < 0.35) p.shade(rect(x, yy, w, pitch), R() < 0.5 ? 0.9 : 1.1, 0.5);
    if (i > 0) p.line([[x, yy + (R() - 0.5)], [x + w * 0.5, yy + (R() - 0.5)], [x + w, yy + (R() - 0.5)]], 0.9 + R() * 0.4, { taper: 0.02, wobble: 0.35, press: 0.4 });
    for (let bx = x + R() * butt; bx < x + w - 6; bx += butt * (0.7 + R() * 0.7)) p.line([[bx, yy + 1], [bx, yy + pitch - 1]], 0.9, { taper: 0.1, wobble: 0.1 });
  }
}

/**
 * Plattenstoesse einer Bordwand: eine Laengsnaht, darueber und darunter versetzte Quernaehte in ungleichem Abstand.
 * Plate butts of a ship side: one long seam, staggered butt seams above and below at uneven spacing.
 */
export function plating(p: Pen, x: number, y: number, w: number, h: number, seam: number, seed: number, pitch = 78): void {
  const R = rng(seed);
  p.panel([[x, y + seam], [x + w, y + seam]], 1.3, seed);
  for (const [ya, yb] of [[y + 1, y + seam - 1], [y + seam + 1, y + h - 1]]) {
    for (let bx = x + pitch * (0.3 + R() * 0.6); bx < x + w - 8; bx += pitch * (0.75 + R() * 0.6)) p.line([[bx, ya], [bx + (R() - 0.5) * 1.5, yb]], 1.1, { taper: 0.12, wobble: 0.2 });
  }
}

/** Anker in der Klusse / anchor in the hawse */
export function anchor(p: Pen, x: number, y: number, s: number): void {
  p.fill(ring(x, y - s * 0.9, s * 0.42), SOOT, 0.95);
  p.line(ring(x, y - s * 0.9, s * 0.42), 1.4, { closed: true, wobble: 0.1 });
  p.line([[x, y - s * 0.8], [x, y + s * 0.7]], Math.max(1.8, s * 0.26), { taper: 0.05, wobble: 0 });
  p.line(spline([[x - s * 0.7, y + s * 0.15], [x - s * 0.45, y + s * 0.65], [x, y + s * 0.8], [x + s * 0.45, y + s * 0.65], [x + s * 0.7, y + s * 0.15]], 4), Math.max(1.8, s * 0.26), { taper: 0.2, wobble: 0 });
  p.line([[x - s * 0.4, y - s * 0.35], [x + s * 0.4, y - s * 0.35]], Math.max(1.4, s * 0.2), { taper: 0, wobble: 0 });
}

/** Rettungsring: weiss mit vier roten Baendern / life ring: white with four red bands */
export function lifeRing(p: Pen, x: number, y: number, r: number): void {
  p.shade(ring(x + 1.5, y + 2, r, 16), 0.78, 0.8);
  p.fill(ring(x, y, r, 18), mat.white);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78; p.fill(arc(x, y, r, r, a - 0.24, a + 0.24, 4).concat(arc(x, y, r * 0.5, r * 0.5, a + 0.24, a - 0.24, 4)), mat.red); }
  p.line(ring(x, y, r, 18), 1.5, { closed: true, wobble: 0.1 });
  p.erase(x, y, r * 0.5);
  p.abs.save();
  p.abs.globalCompositeOperation = 'destination-out';
  p.abs.beginPath(); p.abs.arc(x, y, r * 0.5, 0, Math.PI * 2); p.abs.fill();
  p.abs.restore();
  p.line(ring(x, y, r * 0.5, 12), 1.3, { closed: true, wobble: 0.1 });
}

/** Rostfahnen von einzelnen Punkten nach unten / rust runs down from single points */
export function rustRuns(p: Pen, pts: Pt[], len: number, seed: number): void {
  const R = rng(seed);
  for (const [x, y] of pts) {
    const l = len * (0.5 + R() * 0.7);
    p.mark([[x, y], [x + (R() - 0.5) * 2, y + l]], 2.2 + R() * 1.6, RUST, 0.55, { taper: 0.5, wobble: 0.4 });
    p.mark([[x + 0.6, y], [x + 0.6, y + l * 0.5]], 1.2, RUST_LIGHT, 0.5, { taper: 0.5, wobble: 0.3 });
  }
}

/** Lueftungsschlitze: wenige dunkle Schlitze mit Lichtkante / vent slots: a few dark slots with a light edge */
export function slots(p: Pen, x: number, y: number, w: number, n: number, pitch: number, color: ColorLike = SOOT): void {
  for (let i = 0; i < n; i++) {
    p.fill(rrect(x, y + i * pitch, w, pitch * 0.42, 1.2), color, 0.95);
    p.crease([[x, y + i * pitch + pitch * 0.62], [x + w, y + i * pitch + pitch * 0.62]], 1.1, 1.5, 0.7, { taper: 0.1, wobble: 0 });
  }
}

/** Abgeplatzter Lack an einer Kante / chipped paint along an edge */
export const edgeChips = (p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number): Pen => p.chips(x, y, w, h, n, BARE, seed, 2.6);

/** Zellen der Besatzung mit Beinen (stehende Bedienung neben einem Geschuetz), um k verkleinert / crew cells including legs (standing crew beside a gun), shrunk by k */
export function crewCellsLegs(k = 0.5): Cell[] {
  const keep = new Set(['head', 'head:dravon', 'nose', 'ear', 'helmet:korvat', 'torso', 'upperArm', 'foreArm', 'hand', 'strap', 'pouch', 'thigh', 'shin', 'boot']);
  return figureCells().filter((c) => keep.has(c.name)).map((c): Cell => ({ ...c, design: c.design ?? [c.w, c.h], w: Math.max(16, Math.round(c.w * k)), h: Math.max(12, Math.round(c.h * k)) }));
}
/** Auswahl aus dem Fahrzeug-Baukasten / a selection from the vehicle kit */
export function trimSome(names: string[]): Cell[] {
  const keep = new Set(names);
  return trimCells().filter((c) => keep.has(c.name));
}
export { emblemCells };
