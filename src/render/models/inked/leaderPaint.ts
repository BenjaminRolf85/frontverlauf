/**
 * Gezeichnete Anfuehrer: gemeinsame Zeichenhilfen (Augen, Brauen, Mund, Borten, Orden, Knoepfe, Lorbeer).
 * Inked leaders: shared drawing helpers (eyes, brows, mouth, braid, medals, buttons, laurel).
 *
 * Dieselbe Hand wie bei den Einheiten (atlas.ts Pen), nur groesser: ein Gesicht fuellt hier eine Zelle von 512 Pixeln.
 * Regeln wie dort: Linien beschreiben Form und Material, Schatten sind flache Flaechen mit harter oder weicher Kante,
 * KEINE Schraffur, keine Punktraster. Farben nur aus look.ts / tokens.
 * Strichstaerken werden in "Bildpixeln einer 800 Pixel hohen Bueste" angegeben und je Zelle umgerechnet (lw), damit
 * Gesicht (hohe Dichte) und Brust (halbe Dichte) gleich kraeftig gezeichnet sind.
 * The same hand as for the units (atlas.ts Pen), only larger: a face fills a cell of 512 pixels here. Rules as there:
 * lines describe form and material, shadows are flat areas with a hard or soft edge, NO hatching, no dot screens.
 * Colours only from look.ts / tokens.
 * Line weights are given in "screen pixels of a bust 800 pixels tall" and converted per cell (lw) so the face (high
 * density) and the chest (half the density) are drawn equally bold.
 */
import { mix, rng, shade, type ColorLike } from '../kit';
import { mat } from '../look';
import type { LeaderMood } from '../leaders';
import { arc, Pen, spline, type Cell, type Pt } from './atlas';
import type { FaceMap } from './leaderKit';

/** Gold der Abzeichen: Grundton, Schatten, Licht / gold of the insignia: base, shadow, light */
export const GOLD = mat.gold;
export const GOLD_DARK = shade(mat.gold, 0.6);
export const GOLD_LIGHT = mix(mat.gold, mat.white, 0.6);

/** Strichstaerke einer Zelle: n Bildpixel bei 800 Pixel Buestenhoehe, density = Zellpixel je Modelleinheit / line weight of a cell: n screen pixels at a bust height of 800 pixels, density = cell pixels per model unit */
export const lineScale = (density: number) => (n: number): number => (n * density) / 800;

// ---------- Mimik / expression ----------

/**
 * Mimik als Zahlen fuer Form (Sculpt) und Zeichnung. side = Seite der hochgezogenen Braue beim Grinsen.
 * Expression as numbers for shape (Sculpt) and drawing. side = side of the raised brow when smug.
 */
export interface MoodArt {
  id: LeaderMood;
  side: 1 | -1;
  /** Braue innen / aussen heben (Kopfkoordinaten), je Seite / raise the brow inside / outside (head coordinates), per side */
  browIn: (s: number) => number;
  browOut: (s: number) => number;
  /** Oberlid / Unterlid schliessen (0..1 dazu) / close the upper / lower lid (0..1 added) */
  upper: (s: number) => number;
  lower: (s: number) => number;
  /** Massstab der Iris / scale of the iris */
  iris: number;
  /** Mund: Oeffnung 0..1, Laecheln, Schiefe / mouth: opening 0..1, smile, skew */
  open: number; smile: number; asym: number;
  /** Zornesfalten, Stirnfalten 0..1 / frown lines, forehead lines 0..1 */
  frown: number; forehead: number;
}
export function moodArt(id: LeaderMood, side: 1 | -1 = 1): MoodArt {
  const zero = () => 0;
  switch (id) {
    case 'angry': return { id, side, browIn: () => -0.075, browOut: () => 0.035, upper: () => 0.2, lower: () => 0.22, iris: 0.95, open: 0.45, smile: -0.07, asym: 0, frown: 1, forehead: 0.2 };
    case 'smug': return { id, side, browIn: (s) => (s === side ? 0.05 : -0.035), browOut: (s) => (s === side ? 0.075 : -0.01), upper: (s) => (s === side ? 0.16 : 0.34), lower: (s) => (s === side ? 0.1 : 0.2), iris: 1, open: 0, smile: 0.035, asym: side * 0.075, frown: 0, forehead: 0.3 };
    case 'shocked': return { id, side, browIn: () => 0.085, browOut: () => 0.06, upper: () => -0.3, lower: () => -0.22, iris: 0.72, open: 1, smile: 0, asym: 0, frown: 0, forehead: 1 };
    default: return { id, side, browIn: zero, browOut: zero, upper: zero, lower: zero, iris: 1, open: 0, smile: 0, asym: 0, frown: 0.25, forehead: 0.35 };
  }
}

// ---------- Auge / eye ----------

export interface EyeArt {
  /** Mitte (x > 0, wird je Seite gespiegelt), halbe Breite und Hoehe der Lidspalte in Kopfkoordinaten / centre (x > 0, mirrored per side), half width and height of the opening in head coordinates */
  x: number; y: number; w: number; h: number;
  /** aeusserer Winkel hoeher (+) / outer corner higher (+) */
  tilt?: number;
  /** Lider schliessen 0..1 (negativ = aufgerissen) / close the lids 0..1 (negative = wide open) */
  upper?: number; lower?: number;
  iris: ColorLike;
  /** Irisradius in Kopfkoordinaten (Standard 0.92 h) / iris radius in head coordinates (default 0.92 h) */
  irisR?: number;
  /** Blick: Verschiebung der Iris in Anteilen der halben Spalte / gaze: shift of the iris in shares of the half opening */
  look?: [number, number];
  white?: ColorLike;
  /** Glutauge: die ganze Spalte leuchtet in dieser Farbe, keine Pupille / ember eye: the whole opening glows in this colour, no pupil */
  glow?: ColorLike;
  /** Lidstrich nach aussen verlaengert (Kopfkoordinaten) / lid line extended outward (head coordinates) */
  wing?: number;
  /** Wimpern: Anzahl kurzer Striche am aeusseren Oberlid / lashes: number of short strokes at the outer upper lid */
  lashes?: number;
  /** Lidfalte: Abstand ueber dem Lid (0 = keine) / lid crease: distance above the lid (0 = none) */
  crease?: number;
  /** Traenensack 0..1 / eye bag 0..1 */
  bag?: number;
  /** Lidschatten als Farbe (Schminke) / eye shadow as colour (make-up) */
  shadow?: ColorLike;
  /** Staerke des Oberlids in Bildpixeln / weight of the upper lid in screen pixels */
  lid?: number;
}

/** Lidspalte als geschlossene Kurve, oberer und unterer Bogen / the opening as a closed curve, upper and lower arc */
function eyeCurves(M: FaceMap, s: number, e: EyeArt): { top: Pt[]; bot: Pt[]; L: (a: number, b: number) => Pt } {
  const tilt = e.tilt ?? 0, ct = Math.cos(tilt), sn = Math.sin(tilt);
  const L = (a: number, b: number): Pt => { const lx = a * e.w, ly = b * e.h; return M.P(s * (e.x + lx * ct - ly * sn), e.y + lx * sn + ly * ct); };
  const up = Math.max(0.12, 1 - (e.upper ?? 0)), lo = Math.max(0.12, 1 - (e.lower ?? 0));
  const top = spline([L(-1, -0.1), L(-0.62, 0.58 * up), L(-0.08, up), L(0.5, 0.8 * up), L(1, 0.12)], 8);
  const bot = spline([L(1, 0.12), L(0.52, -0.7 * lo), L(-0.08, -lo), L(-0.62, -0.62 * lo), L(-1, -0.1)], 8);
  return { top, bot, L };
}

/** Auge einer Seite (s = +1 linke Hand der Figur, im Bild rechts) / eye of one side (s = +1 the figure's left hand, right in the picture) */
export function drawEye(p: Pen, M: FaceMap, s: 1 | -1, e: EyeArt, lw: (n: number) => number): void {
  const { top, bot, L } = eyeCurves(M, s, e);
  const outline: Pt[] = [...top, ...bot.slice(1, -1)];
  const white = e.white ?? mat.paper;
  const hpx = M.u(e.h);
  // Lidschatten (Schminke) ueber dem Auge / eye shadow (make-up) above the eye
  if (e.shadow) {
    const lift = (q: Pt, k: number): Pt => [q[0], q[1] - hpx * k];
    p.fill([...top, ...top.map((q, i) => lift(q, 0.75 * Math.sin((i / (top.length - 1)) * Math.PI) + 0.2)).reverse()], e.shadow, 0.85);
  }
  p.fill(outline, e.glow ?? white);
  for (const ctx of [p.abs, p.ink]) { ctx.save(); Pen.path(ctx, outline); ctx.clip(); }
  const up = Math.max(0.12, 1 - (e.upper ?? 0));
  if (e.glow) {
    // Glut: heller Kern, kein Stern / ember: bright core, no pupil
    const c = L(0, 0);
    p.fill(arc(c[0], c[1], M.u(e.w) * 0.62, hpx * 0.6 * up, 0, Math.PI * 2, 20), mix(e.glow, mat.white, 0.6));
    p.fill(arc(c[0], c[1], M.u(e.w) * 0.3, hpx * 0.3 * up, 0, Math.PI * 2, 14), mat.white, 0.9);
  } else {
    // Schatten des Oberlids auf dem Augapfel / shadow of the upper lid on the eyeball
    p.fill([...top, ...top.map((q): Pt => [q[0], q[1] + hpx * 0.34]).reverse()], shade(white, 0.72));
    const look = e.look ?? [0, 0];
    const [ix, iy] = L(look[0] * 0.5, look[1] * 0.5 + 0.02);
    const r = M.u(e.irisR ?? e.h * 0.92);
    p.spot(ix, iy, r, e.iris);
    // obere Haelfte der Iris dunkler, unten ein heller Bogen / upper half of the iris darker, a light arc below
    p.fill(arc(ix, iy, r, r, Math.PI, Math.PI * 2, 14), shade(e.iris, 0.62));
    p.fill(arc(ix, iy + r * 0.28, r * 0.62, r * 0.5, 0, Math.PI, 12), mix(e.iris, mat.white, 0.42), 0.9);
    p.line(arc(ix, iy, r, r, 0, Math.PI * 2, 24), lw(1.5), { closed: true, wobble: 0.1, press: 0.15 });
    p.dot(ix, iy, r * 0.46);
    // Glanzpunkt links oben (das Licht kommt von dort), kleiner Gegenglanz / highlight upper left (the light comes from there), small counter glint
    p.erase(ix - r * 0.36, iy - r * 0.4, r * 0.3);
    p.spot(ix - r * 0.36, iy - r * 0.4, r * 0.34, mat.white);
    p.erase(ix + r * 0.34, iy + r * 0.36, r * 0.13);
    p.spot(ix + r * 0.34, iy + r * 0.36, r * 0.15, mat.white, 0.9);
  }
  for (const ctx of [p.abs, p.ink]) ctx.restore();
  // Oberlid kraeftig mit Schwung nach aussen, Unterlid duenn / upper lid bold with a flick outward, lower lid thin
  const wing = e.wing ?? 0.02;
  const end = top[top.length - 1], pre = top[top.length - 4];
  const dx = end[0] - pre[0], dy = end[1] - pre[1], dl = Math.hypot(dx, dy) || 1;
  const flick: Pt = [end[0] + (dx / dl) * M.u(wing), end[1] + (dy / dl) * M.u(wing) - M.u(wing) * 0.35];
  p.line([...top, flick], lw(e.lid ?? 3.4), { taper: 0.16, wobble: 0.25, press: 0.2 });
  p.line(bot.slice(2, Math.round(bot.length * 0.74)), lw(1.4), { taper: 0.35, wobble: 0.2 });
  // innerer Augenwinkel / inner corner
  p.line([top[0], [top[0][0] - s * M.u(0.012), top[0][1] + M.u(0.012)]], lw(1.3), { taper: 0.4 });
  for (let i = 0; i < (e.lashes ?? 0); i++) {
    const k = top.length - 1 - Math.round((i + 0.5) * 3.2);
    const q = top[Math.max(0, k)];
    p.line([q, [q[0] + s * M.u(0.022 + i * 0.004), q[1] - M.u(0.03 - i * 0.004)]], lw(1.5), { taper: 0.4, wobble: 0.1 });
  }
  if (e.crease) {
    const c = M.u(e.crease);
    p.line(top.slice(3, -3).map((q, i, arr): Pt => [q[0], q[1] - c * (0.75 + 0.25 * Math.sin((i / (arr.length - 1)) * Math.PI))]), lw(1.3), { taper: 0.4, wobble: 0.25 });
  }
  if (e.bag) {
    const d = M.u(0.045 + 0.02 * e.bag);
    p.line(bot.slice(3, -5).map((q, i, arr): Pt => [q[0], q[1] + d * (0.7 + 0.3 * Math.sin((i / (arr.length - 1)) * Math.PI))]), lw(1.1 + 0.5 * e.bag), { taper: 0.45, wobble: 0.3 });
  }
}

// ---------- Braue / brow ----------

export interface BrowArt {
  /** inneres und aeusseres Ende (x > 0, gespiegelt) / inner and outer end (x > 0, mirrored) */
  x0: number; y0: number; x1: number; y1: number;
  /** Bogenhoehe / height of the arch */
  arch?: number;
  /** groesste Dicke (Kopfkoordinaten) / largest thickness (head coordinates) */
  thick: number;
  /** Haarfarbe; ohne: Tusche / hair colour; without: ink */
  colour?: ColorLike;
  /** Haarstriche / hair strokes */
  strands?: number;
  /** struppig: Spitzen ueber den Rand 0..1 / bushy: tips beyond the edge 0..1 */
  wild?: number;
  seed?: number;
}
export function drawBrow(p: Pen, M: FaceMap, s: 1 | -1, b: BrowArt, lw: (n: number) => number): void {
  const n = 14, arch = b.arch ?? 0.02;
  const spine = (t: number): [number, number] => [b.x0 + (b.x1 - b.x0) * t, b.y0 + (b.y1 - b.y0) * t + arch * 4 * t * (1 - t)];
  // dick am inneren Drittel, zum aeusseren Ende spitz / thick at the inner third, pointed at the outer end
  const th = (t: number) => b.thick * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, 0.18 + t * 1.25))) * (1 - 0.82 * t * t);
  const up: Pt[] = [], dn: Pt[] = [];
  const R = rng(b.seed ?? 77);
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = spine(t), [xb, yb] = spine(Math.min(1, t + 0.02)), [xa, ya] = spine(Math.max(0, t - 0.02));
    const l = Math.hypot(xb - xa, yb - ya) || 1, nx = -(yb - ya) / l, ny = (xb - xa) / l;
    const jag = (b.wild ?? 0) * b.thick * 0.35 * (i % 2 ? R() : -R() * 0.3);
    up.push(M.P(s * (x + nx * (th(t) * 0.5 + jag)), y + ny * (th(t) * 0.5 + jag)));
    dn.push(M.P(s * (x - nx * th(t) * 0.5), y - ny * th(t) * 0.5));
  }
  const poly: Pt[] = [...up, ...dn.reverse()];
  if (b.colour) {
    p.fill(poly, b.colour);
    // Schatten an der Unterkante / shade along the lower edge
    p.fill([...dn, ...dn.map((q, i): Pt => [q[0] + (up[up.length - 1 - i][0] - q[0]) * 0.34, q[1] + (up[up.length - 1 - i][1] - q[1]) * 0.34]).reverse()], shade(b.colour, 0.74));
    p.line(poly, lw(1.6), { closed: true, wobble: 0.3, press: 0.25 });
  } else p.blot(poly);
  for (let i = 0; i < (b.strands ?? 0); i++) {
    const t = (i + 0.5) / (b.strands ?? 1) * 0.86, [x, y] = spine(t), [x2, y2] = spine(t + 0.13);
    const off = (R() - 0.5) * th(t) * 0.5;
    const a = M.P(s * x, y + off - th(t) * 0.18), c = M.P(s * x2, y2 + off + th(t) * 0.3);
    if (b.colour) p.line([a, c], lw(1.1), { taper: 0.45, wobble: 0.2 });
    else p.mark([a, c], lw(1), mat.metal, 0.5, { taper: 0.45, wobble: 0.2 });
  }
}

// ---------- Mund / mouth ----------

export interface MouthArt {
  y: number;
  /** halbe Breite / half width */
  w: number;
  smile?: number; asym?: number;
  /** Lippenhoehen (Kopfkoordinaten) / lip heights (head coordinates) */
  lipU: number; lipL: number;
  /** Lippenfarbe deckend (Schminke) oder nur Toenung / lip colour opaque (make-up) or a tint only */
  colour?: ColorLike;
  tint?: [number, number, number];
  /** Oeffnung 0..1 / opening 0..1 */
  open?: number;
  teeth?: boolean;
  /** Staerke der Mundlinie in Bildpixeln / weight of the mouth line in screen pixels */
  line?: number;
  /** Glanz auf der Unterlippe 0..1 (Standard 1) / shine on the lower lip 0..1 (default 1) */
  shine?: number;
}
/** Mundlinie y(x) wie Sculpt.mouthLine (w = halbe Breite) / mouth line y(x) as Sculpt.mouthLine (w = half width) */
export const mouthY = (m: MouthArt, x: number): number => { const u = x / m.w; return m.y + (m.smile ?? 0) * u * u + (m.asym ?? 0) * u; };

export function drawMouth(p: Pen, M: FaceMap, m: MouthArt, lw: (n: number) => number): void {
  const n = 12, open = m.open ?? 0;
  const xs = Array.from({ length: n + 1 }, (_, i) => -m.w + (2 * m.w * i) / n);
  const bow = (x: number) => { const u = x / m.w; return (1 - u * u) * (1 - 0.3 * Math.exp(-((u / 0.16) ** 2))); };
  const gapU = (x: number) => open * m.lipU * 1.1 * (1 - (x / m.w) ** 2), gapL = (x: number) => open * (m.lipL * 2.4 + 0.05) * (1 - (x / m.w) ** 2);
  const line = xs.map((x) => M.P(x, mouthY(m, x) + gapU(x)));
  const lineL = xs.map((x) => M.P(x, mouthY(m, x) - gapL(x)));
  const upper = xs.map((x) => M.P(x, mouthY(m, x) + gapU(x) + m.lipU * bow(x)));
  const lower = xs.map((x) => M.P(x, mouthY(m, x) - gapL(x) - m.lipL * (1 - (x / m.w) ** 2) ** 0.8));
  const lipU: Pt[] = [...upper, ...line.slice().reverse()], lipL: Pt[] = [...lineL, ...lower.slice().reverse()];
  if (m.colour) {
    p.fill(lipU, shade(m.colour, 0.88));
    p.fill(lipL, m.colour);
    // Glanz auf der Unterlippe / shine on the lower lip
    const c = M.P(-m.w * 0.18, mouthY(m, 0) - gapL(0) - m.lipL * 0.42);
    if ((m.shine ?? 1) > 0) p.fill(arc(c[0], c[1], M.u(m.w * 0.26), M.u(m.lipL * 0.16), 0, Math.PI * 2, 12), mix(m.colour, mat.white, 0.32), 0.9 * (m.shine ?? 1));
    p.line(upper, lw(1.3), { taper: 0.3, wobble: 0.2 });
  } else {
    const t = m.tint ?? [1, 0.82, 0.78];
    p.shade(lipU, [t[0] * 0.9, t[1] * 0.9, t[2] * 0.9], 0.75);
    p.shade(lipL, t, 0.75);
  }
  if (open > 0.05) {
    // Mundhoehle, Zaehne oben / mouth cavity, teeth on top
    const hole: Pt[] = [...line, ...lineL.slice().reverse()];
    p.fill(hole, mix(mat.ink, mat.red, 0.22));
    if (m.teeth !== false) {
      for (const ctx of [p.abs, p.ink]) { ctx.save(); Pen.path(ctx, hole); ctx.clip(); }
      const th = Math.min(m.lipL * 1.3, (gapU(0) + gapL(0)) * 0.42);
      p.fill([...line, ...xs.map((x) => M.P(x, mouthY(m, x) + gapU(x) - th)).reverse()], mat.paper);
      if (open < 0.7) p.fill([...lineL, ...xs.map((x) => M.P(x, mouthY(m, x) - gapL(x) + th * 0.8)).reverse()], shade(mat.paper, 0.88));
      for (const x of [-0.5, -0.17, 0.17, 0.5]) p.line([M.P(x * m.w, mouthY(m, 0) + gapU(0)), M.P(x * m.w, mouthY(m, 0) + gapU(0) - th)], lw(0.9), { taper: 0.2, wobble: 0.1 });
      for (const ctx of [p.abs, p.ink]) ctx.restore();
    }
    p.line(hole, lw(2), { closed: true, wobble: 0.25, press: 0.2 });
  } else p.line(line, lw(m.line ?? 2.6), { taper: 0.26, wobble: 0.3, press: 0.25 });
  // Mundwinkel, Linie unter der Unterlippe / mouth corners, line below the lower lip
  for (const s of [-1, 1]) {
    const c = M.P(s * m.w, mouthY(m, s * m.w));
    p.line([[c[0] + s * M.u(0.006), c[1] - M.u(0.018)], [c[0] + s * M.u(0.016), c[1] + M.u(0.02)]], lw(1.5), { taper: 0.4, wobble: 0.15 });
  }
  p.line(xs.slice(3, -3).map((x) => M.P(x, mouthY(m, x) - gapL(x) - m.lipL * 1.18 - 0.012 * (1 - (x / m.w) ** 2))), lw(1.4), { taper: 0.4, wobble: 0.25 });
}

// ---------- Nase / nose ----------

export interface NoseArt {
  /** Hoehe der Nasenspitze, Breitenfaktor wie FaceShape.noseW / height of the tip, width factor as FaceShape.noseW */
  y: number; w: number;
  /** Hoehe der Nasenwurzel / height of the root */
  top: number;
  /** Schattenton der Seite (1 = keiner) / shadow tone of the side (1 = none) */
  shade?: number;
  /** nur Nasenloecher (flaches Gesicht) / nostrils only (flat face) */
  slits?: boolean;
}
/** Nase: Schattenseite als Flaeche, Nasenfluegel, Nasenloecher, Glanz auf der Spitze / nose: shadow side as an area, wings, nostrils, shine on the tip */
export function drawNose(p: Pen, M: FaceMap, o: NoseArt, lw: (n: number) => number): void {
  const w = 0.085 * o.w;
  if (o.slits) {
    for (const s of [-1, 1]) p.line([M.P(s * 0.035, o.y + 0.03), M.P(s * 0.05, o.y - 0.035)], lw(2.2), { taper: 0.3, wobble: 0.1 });
    return;
  }
  // Schattenseite (rechts im Bild: das Licht kommt von links oben) / shadow side (right in the picture: the light comes from the upper left)
  const sh = o.shade ?? 0.8;
  if (sh < 1) {
    p.shade(spline([M.P(0.012, o.top), M.P(0.02, (o.top + o.y) / 2), M.P(w * 0.25, o.y + 0.03), M.P(w * 1.5, o.y - 0.03), M.P(w * 1.15, o.y + 0.05), M.P(w * 0.8, (o.top + o.y) / 2), M.P(0.06, o.top)], 6, true), sh, 0.9);
    // Schatten unter der Nase / shadow below the nose
    p.shade(spline([M.P(-w * 1.25, o.y - 0.075), M.P(0, o.y - 0.06), M.P(w * 1.3, o.y - 0.075), M.P(w * 0.9, o.y - 0.135), M.P(0, o.y - 0.15), M.P(-w * 0.8, o.y - 0.13)], 6, true), sh * 0.96, 0.85);
  }
  // Nasenruecken: eine Linie an der Schattenseite / bridge: one line on the shadow side
  p.line(spline([M.P(0.035, o.top - 0.02), M.P(0.03, (o.top + o.y) / 2), M.P(w * 0.62, o.y + 0.045)], 6), lw(1.6), { taper: 0.4, wobble: 0.25 });
  for (const s of [-1, 1]) {
    // Nasenfluegel und Nasenloch / wing and nostril
    const c = M.P(s * w * 1.28, o.y - 0.025);
    p.line(arc(c[0], c[1], M.u(w * 0.55), M.u(0.055), s > 0 ? -1.25 : Math.PI + 1.25, s > 0 ? 1.5 : Math.PI - 1.5, 10), lw(1.9), { taper: 0.3, wobble: 0.2 });
    const q = M.P(s * w * 0.76, o.y - 0.083);
    p.blot(spline([[q[0] - M.u(0.032), q[1] + M.u(0.004)], [q[0], q[1] - M.u(0.017)], [q[0] + M.u(0.032), q[1] + M.u(0.002)], [q[0], q[1] + M.u(0.014)]], 5, true));
  }
  // Unterkante der Spitze, Glanz / lower edge of the tip, shine
  p.line(spline([M.P(-w * 0.5, o.y - 0.092), M.P(0, o.y - 0.108), M.P(w * 0.5, o.y - 0.092)], 5), lw(1.5), { taper: 0.4, wobble: 0.2 });
  const t = M.P(-w * 0.2, o.y + 0.012);
  p.dab(t[0], t[1], M.u(0.05), 1.22, 0.75);
}

// ---------- Falten und Schatten / wrinkles and shadows ----------

/** Faltenlinie durch Kopfkoordinaten, je Seite gespiegelt wenn sides / wrinkle line through head coordinates, mirrored per side if sides */
export function wrinkle(p: Pen, M: FaceMap, pts: [number, number][], w: number, sides = true, o: { taper?: number; wobble?: number } = {}): void {
  for (const s of sides ? [-1, 1] : [1]) p.line(spline(pts.map(([x, y]) => M.P(s * x, y)), 6), w, { taper: o.taper ?? 0.42, wobble: o.wobble ?? 0.35, press: 0.3 });
}
/** Flache Schattenflaeche in Kopfkoordinaten (geschlossene Kurve), je Seite gespiegelt wenn sides / flat shadow area in head coordinates (closed curve), mirrored per side if sides */
export function shadow(p: Pen, M: FaceMap, pts: [number, number][], f: number | [number, number, number], alpha = 0.9, sides = true, smooth = true): void {
  for (const s of sides ? [-1, 1] : [1]) {
    const q = pts.map(([x, y]) => M.P(s * x, y));
    p.shade(smooth ? spline(q, 6, true) : q, f, alpha);
  }
}

// ---------- Abzeichen / insignia ----------

/** Stern mit n Zacken / star with n points */
export function starPts(x: number, y: number, n: number, ro: number, ri: number, rot = -Math.PI / 2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * Math.PI * 2, r = i % 2 === 0 ? ro : ri; out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  return out;
}
/** Farbflaeche mit Tuscherand / colour area with an ink rim */
export function patch(p: Pen, pts: Pt[], c: ColorLike, w: number): void {
  p.fill(pts, c);
  p.line(pts, w, { closed: true, wobble: 0.15, press: 0.15 });
}
/** Goldknopf: Scheibe, Schattensichel, Glanz, Rand / gold button: disc, shadow crescent, shine, rim */
export function goldDisc(p: Pen, x: number, y: number, r: number, w: number, c: ColorLike = GOLD): void {
  p.spot(x, y, r, c);
  p.fill(arc(x + r * 0.12, y + r * 0.14, r * 0.92, r * 0.92, -0.3, Math.PI * 0.95, 14), shade(c, 0.66));
  p.spot(x - r * 0.08, y - r * 0.1, r * 0.7, c);
  p.spot(x - r * 0.32, y - r * 0.36, r * 0.24, mix(c, mat.white, 0.75));
  p.line(arc(x, y, r, r, 0, Math.PI * 2, 20), w, { closed: true, wobble: 0.1, press: 0.15 });
}
/** Geschliffener Stein: Farbe, dunkler Rand, harter Glanz / cut gem: colour, dark rim, hard shine */
export function gem(p: Pen, x: number, y: number, r: number, c: ColorLike, w: number): void {
  p.spot(x, y, r, shade(c, 0.62));
  p.spot(x - r * 0.1, y - r * 0.12, r * 0.74, c);
  p.fill(arc(x - r * 0.3, y - r * 0.34, r * 0.34, r * 0.22, 0, Math.PI * 2, 10), mix(c, mat.white, 0.8));
  p.spot(x + r * 0.36, y + r * 0.4, r * 0.12, mix(c, mat.white, 0.6), 0.9);
  p.line(arc(x, y, r, r, 0, Math.PI * 2, 20), w, { closed: true, wobble: 0.1, press: 0.15 });
}
/** Blatt von a nach c (Lorbeer, Eichenlaub): Farbe, Mittelrippe, Rand / leaf from a to c (laurel, oak): colour, midrib, rim */
export function leaf(p: Pen, a: Pt, c: Pt, width: number, col0: ColorLike, w: number, rib = true): void {
  const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const at = (t: number, k: number): Pt => [a[0] + dx * t + nx * width * k, a[1] + dy * t + ny * width * k];
  const pts = spline([a, at(0.3, 0.5), at(0.62, 0.42), c, at(0.62, -0.42), at(0.3, -0.5)], 4, true);
  p.fill(pts, col0);
  p.fill(spline([a, at(0.3, -0.5), at(0.62, -0.42), c, at(0.5, -0.12)], 4, true), shade(col0, 0.68));
  p.line(pts, w, { closed: true, wobble: 0.12, press: 0.15 });
  if (rib) p.line([at(0.12, 0), at(0.8, 0)], w * 0.75, { taper: 0.4, wobble: 0.1 });
}
/**
 * Laubborte entlang eines Pfads: Blattpaare links und rechts der Mittellinie (Eichenlaub der Marschaelle, Lorbeer).
 * Leaf braid along a path: pairs of leaves left and right of the centre line (the marshals' oak leaves, laurel).
 */
export function leafBraid(p: Pen, path: Pt[], n: number, len: number, width: number, c: ColorLike, w: number, o: { both?: boolean; stem?: boolean; spread?: number } = {}): void {
  const acc = [0];
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = acc[acc.length - 1];
  const at = (d: number): { q: Pt; t: Pt } => {
    let i = 0;
    while (i < path.length - 2 && acc[i + 1] < d) i++;
    const a = path[i], b = path[i + 1], l = acc[i + 1] - acc[i] || 1, f = (d - acc[i]) / l;
    return { q: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], t: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
  };
  if (o.stem !== false) p.mark(path, w * 1.4, shade(c, 0.6), 1, { taper: 0.1, wobble: 0.1 });
  const spread = o.spread ?? 0.75;
  for (let i = 0; i < n; i++) {
    const { q, t } = at(((i + 0.3) / n) * total);
    for (const sd of o.both === false ? [1] : [-1, 1]) {
      const nx = -t[1] * sd, ny = t[0] * sd;
      const tip: Pt = [q[0] + (t[0] * (1 - spread * 0.5) + nx * spread) * len, q[1] + (t[1] * (1 - spread * 0.5) + ny * spread) * len];
      leaf(p, q, tip, width, c, w, len > 9);
    }
  }
}
/** Ordensband: senkrechte Streifen in einem Rechteck, Tuscherand / medal ribbon: vertical stripes in a rectangle, ink rim */
export function ribbonBar(p: Pen, x: number, y: number, w: number, h: number, stripes: [ColorLike, number][], lw: number): void {
  const total = stripes.reduce((s, [, k]) => s + k, 0);
  let cx = x;
  for (const [c, k] of stripes) {
    const sw = (k / total) * w;
    p.fill([[cx, y], [cx + sw + 0.4, y], [cx + sw + 0.4, y + h], [cx, y + h]], c);
    cx += sw;
  }
  // Schatten unten: das Band woelbt sich / shade at the bottom: the ribbon bulges
  p.fill([[x, y + h * 0.7], [x + w, y + h * 0.7], [x + w, y + h], [x, y + h]], mat.ink, 0.22);
  p.line([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], lw, { closed: true, wobble: 0.12, press: 0.1 });
}
/** Faltenlinie im Stoff: Tuschestrich mit flachem Schatten an einer Seite / fold line in cloth: ink stroke with a flat shade on one side */
export function fold(p: Pen, pts: Pt[], w: number, shadeW: number, tone = 0.8, side = 1): void {
  const off = pts.map((q, i): Pt => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = shadeW * Math.sin((i / (pts.length - 1)) * Math.PI) * side;
    return [q[0] - ((b[1] - a[1]) / l) * k, q[1] + ((b[0] - a[0]) / l) * k];
  });
  p.shade([...pts, ...off.reverse()], tone, 0.85);
  p.line(pts, w, { taper: 0.4, wobble: 0.3, press: 0.3 });
}
/** Haarstraehnen: n Linien zwischen zwei Randkurven (gleich viele Punkte) / hair strands: n lines between two edge curves (same point count) */
export function strands(p: Pen, a: Pt[], c: Pt[], n: number, w: number, seed: number, o: { from?: number; to?: number; tone?: number } = {}): void {
  const R = rng(seed);
  const m = Math.min(a.length, c.length);
  for (let i = 0; i < n; i++) {
    const k = (i + 0.2 + R() * 0.6) / n;
    const pts: Pt[] = [];
    const f0 = o.from ?? 0.05 + R() * 0.2, f1 = o.to ?? 0.75 + R() * 0.25;
    for (let j = 0; j < m; j++) {
      const t = j / (m - 1);
      if (t < f0 || t > f1) continue;
      pts.push([a[j][0] + (c[j][0] - a[j][0]) * k, a[j][1] + (c[j][1] - a[j][1]) * k]);
    }
    if (pts.length < 2) continue;
    if (o.tone !== undefined) p.crease(pts, w, o.tone, 0.85, { taper: 0.4, wobble: 0.3 });
    else p.line(pts, w, { taper: 0.42, wobble: 0.3, press: 0.3 });
  }
}

// ---------- gemeinsame Zellen / shared cells ----------

/** Ohr (s von vorn nach hinten, t von oben nach unten): Ohrmuschel hinten, Gehoergang vorn / ear (s from front to back, t from top to bottom): helix at the back, ear canal at the front */
export function paintEar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(H / 0.124);
  const X = (k: number) => W * (1 - k);
  p.dab(X(0.46), H * 0.48, W * 0.24, 0.72, 0.85);
  p.line(spline([[X(0.7), H * 0.2], [X(0.5), H * 0.1], [X(0.28), H * 0.2], [X(0.2), H * 0.45], [X(0.3), H * 0.72], [X(0.46), H * 0.86]], 6), lw(1.7), { taper: 0.25, wobble: 0.2 });
  p.line(spline([[X(0.62), H * 0.32], [X(0.44), H * 0.3], [X(0.4), H * 0.5], [X(0.52), H * 0.66]], 5), lw(1.3), { taper: 0.4, wobble: 0.2 });
  p.line(spline([[X(0.66), H * 0.56], [X(0.56), H * 0.6], [X(0.6), H * 0.7]], 4), lw(1.2), { taper: 0.4 });
}
/** Hals (s rundum, t von oben nach unten): Schlagschatten des Kinns, Sehnen / neck (s around, t from top to bottom): cast shadow of the chin, tendons */
export function paintNeck(p: Pen, tone = 0.66): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.58);
  p.shade(spline([[W * 0.2, 0], [W * 0.3, H * 0.52], [W * 0.5, H * 0.66], [W * 0.7, H * 0.52], [W * 0.8, 0]], 6), tone, 0.95);
  p.gradient(0, H * 0.6, W, H * 0.42, [0, H * 0.6], [0, H], 1, 0.8);
  for (const s of [-1, 1]) p.line(spline([[W * (0.5 + s * 0.1), H * 0.3], [W * (0.5 + s * 0.085), H * 0.6], [W * (0.5 + s * 0.05), H * 0.9]], 5), lw(1.3), { taper: 0.42, wobble: 0.3 });
  p.line(spline([[W * 0.44, H * 0.72], [W * 0.5, H * 0.76], [W * 0.56, H * 0.72]], 4), lw(1.2), { taper: 0.4 });
}
/** Ruecken: Mittelnaht, Aermelnaehte, zum Saum dunkler / back: centre seam, sleeve seams, darker towards the hem */
export function paintBack(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.9);
  p.gradient(0, H * 0.6, W, H * 0.4, [0, H * 0.6], [0, H], 1, 0.82);
  p.line(spline([[W / 2, H * 0.2], [W / 2 + 1, H * 0.6], [W / 2, H]], 4), lw(1.4), { taper: 0.2, wobble: 0.4 });
  for (const s of [-1, 1]) p.line(spline([[W / 2 + s * W * 0.37, H * 0.28], [W / 2 + s * W * 0.41, H * 0.6], [W / 2 + s * W * 0.43, H]], 4), lw(1.4), { taper: 0.2, wobble: 0.4 });
}
/** Seite des Oberkoerpers: Schatten unter der Schulter / side of the torso: shade below the shoulder */
export function paintSide(p: Pen): void {
  const W = p.w, H = p.h;
  p.gradient(0, H * 0.55, W, H * 0.45, [0, H * 0.55], [0, H], 1, 0.82);
  p.shade([[0, 0], [W, 0], [W, H * 0.3], [0, H * 0.3]], 0.76, 0.9);
}
/** Schultern von oben: Naht, Schatten um den Hals / shoulders from above: seam, shade around the neck */
export function paintTop(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.9);
  p.line([[4, H * 0.5], [W - 4, H * 0.5]], lw(1.3), { taper: 0.2, wobble: 0.4 });
  p.dab(W / 2, H / 2, H * 0.5, 0.76, 0.8);
}
/** Zellen des Oberkoerpers ausser der Brust, des Halses und der Ohren / cells of the torso except the chest, of the neck and the ears */
export function bodyCells(o: { neck?: number; plain?: boolean } = {}): Cell[] {
  return [
    { name: 'back', w: 256, h: 128, paint: o.plain ? (p) => { p.gradient(0, p.h * 0.6, p.w, p.h * 0.4, [0, p.h * 0.6], [0, p.h], 1, 0.82); } : paintBack },
    { name: 'side', w: 96, h: 128, paint: paintSide },
    { name: 'top', w: 160, h: 80, paint: o.plain ? (p) => { p.dab(p.w / 2, p.h / 2, p.h * 0.5, 0.76, 0.8); } : paintTop },
    { name: 'neck', w: 192, h: 96, paint: (p) => paintNeck(p, o.neck ?? 0.66) },
    { name: 'ear', w: 64, h: 96, paint: paintEar },
  ];
}
