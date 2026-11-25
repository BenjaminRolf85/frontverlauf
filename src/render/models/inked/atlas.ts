/**
 * Gezeichnete Einheiten: Texturen werden beim Laden im Code gezeichnet (Canvas 2D), nichts wird heruntergeladen.
 * Inked units: textures are drawn in code at load time (canvas 2D), nothing is downloaded.
 *
 * Ein Atlas besteht aus Zellen (Cell): Name, Entwurfsgroesse und Maler. defineAtlas() packt die Zellen selbst (niemand
 * vergibt Koordinaten von Hand), atlasTextures() liefert die beiden Texturen sofort und zeichnet die Zellen danach
 * ueber mehrere Bilder verteilt (oder sofort mit flushAtlases()). Ohne DOM (Tests in Node) bleiben die Texturen neutral.
 * An atlas is made of cells (Cell): name, design size and painter. defineAtlas() packs the cells itself (nobody assigns
 * coordinates by hand), atlasTextures() returns both textures at once and then paints the cells spread over several
 * frames (or at once with flushAtlases()). Without a DOM (tests in Node) the textures stay neutral.
 *
 * Stilregel: KEINE Schraffur. Schatten sind flache Flaechen mit harter oder weicher Kante (shade, gradient, dab), nie
 * Strichlagen, Kreuzschraffur, Gewebemuster oder Punktraster. Linien beschreiben Form und Material (Naht, Falte, Fuge,
 * Niete, Kratzer, Schablone), nicht Helligkeit.
 * Style rule: NO hatching. Shadows are flat areas with a hard or soft edge (shade, gradient, dab), never stroke layers,
 * cross hatching, weave patterns or dot screens. Lines describe form and material (seam, fold, joint, rivet, scratch,
 * stencil), not brightness.
 *
 * Drei Ebenen je Atlas / three layers per atlas:
 * - mul: Multiplikation auf die Vertexfarbe (128 = neutral, dunkler = Schatten, Schmutz; heller = Abrieb).
 *        Fraktionsneutral: dieselbe Zeichnung faerbt sich ueber die Vertexfarbe fuer jede Fraktion.
 *        / multiplies the vertex colour (128 = neutral, darker = shade, grime; lighter = wear). Faction neutral:
 *        the same drawing takes any faction's colour from the vertex colour.
 * - abs: deckende Farbe mit Alpha (Augen, Metall, Leder, Schlamm, Abzeichen) / opaque colour with alpha (eyes, metal,
 *        leather, mud, insignia).
 * - ink: Tuschelinien. Sie werden als Abstandsfeld gespeichert (eigene 8-Bit-Textur), der Shader zieht daraus eine
 *        scharfe Kante in jeder Vergroesserung und laesst die Strichstaerke leicht schwanken.
 *        / ink lines. Stored as a distance field (own 8 bit texture); the shader draws a sharp edge from it at any
 *        magnification and lets the line weight waver slightly.
 * mul und abs werden zu EINER RGBA-Textur verrechnet (rgb = Mischung, a = Deckkraft der Farbe).
 * mul and abs are combined into ONE RGBA texture (rgb = blend, a = opacity of the colour).
 */
import * as THREE from 'three';
import { rng, type ColorLike } from '../kit';
import { semantic } from '../../../design/tokens';
import { AtlasLayout, REF, type Region } from './uvkit';

export type Pt = [number, number];

/** Reichweite des Abstandsfelds in Bezugspixeln / reach of the distance field in reference pixels */
export const SDF_RANGE = 5;

export interface AtlasTextures {
  paint: THREE.DataTexture;
  ink: THREE.DataTexture;
  size: number;
  /** GPU-Speicher beider Texturen samt Mip-Stufen / GPU memory of both textures including mip levels */
  bytes: number;
  /** Zeit fuer Zeichnen und Abstandsfeld, Summe ueber alle Zellen / time for drawing and the distance field, sum over all cells */
  ms: number;
  /** laengster einzelner Schritt / longest single step */
  maxStepMs: number;
  /** fertig gezeichnet? / painting finished? */
  ready: boolean;
}

/** Farbe als CSS (sRGB) / colour as CSS (sRGB) */
export function css(c: ColorLike): string {
  return typeof c === 'string' ? c : `#${c.getHexString()}`;
}

/** mul-Ton fuer einen Helligkeitsfaktor f (1 = neutral, bis 2 heller), optional je Kanal / mul tone for a brightness factor f */
export function tone(f: number | [number, number, number]): string {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(127.5 * Math.pow(Math.max(0, v), 1 / 2.2))));
  const [r, g, b] = typeof f === 'number' ? [f, f, f] : f;
  return `rgb(${ch(r)},${ch(g)},${ch(b)})`;
}

// ---------- Kurven / curves ----------

/** Glatte Kurve durch Punkte (Catmull-Rom) / smooth curve through points (Catmull-Rom) */
export function spline(pts: Pt[], per = 8, closed = false): Pt[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out: Pt[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Ellipsenbogen als Punkte / elliptic arc as points */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}

/** Rechteck mit runden Ecken als Punkte / rounded rectangle as points */
export function rrect(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const k = Math.min(r, w / 2, h / 2);
  return [
    ...arc(x + w - k, y + k, k, k, -Math.PI / 2, 0, 4), ...arc(x + w - k, y + h - k, k, k, 0, Math.PI / 2, 4),
    ...arc(x + k, y + h - k, k, k, Math.PI / 2, Math.PI, 4), ...arc(x + k, y + k, k, k, Math.PI, Math.PI * 1.5, 4),
  ];
}

// ---------- Stift / pen ----------

export interface LineOpts {
  /** Anteil der Laenge, ueber den der Strich an jedem Ende ausduennt (0 = stumpf) / share of the length over which the stroke thins at each end (0 = blunt) */
  taper?: number;
  /** seitliches Zittern in Bezugspixeln / sideways wobble in reference pixels */
  wobble?: number;
  /** Schwankung der Strichstaerke 0..1 / variation of the line weight 0..1 */
  press?: number;
  seed?: number;
  closed?: boolean;
}

/**
 * Zeichenwerkzeug fuer einen Atlasbereich. Koordinaten in Bezugspixeln ab der linken oberen Ecke des Bereichs.
 * Drawing tool for one atlas region. Coordinates in reference pixels from the region's top left corner.
 */
export class Pen {
  readonly w: number;
  readonly h: number;
  private seed = 1;
  constructor(readonly region: Region, readonly mul: CanvasRenderingContext2D, readonly abs: CanvasRenderingContext2D, readonly ink: CanvasRenderingContext2D) {
    this.w = region.w;
    this.h = region.h;
  }

  /** Pfad aus Punkten / path from points */
  static path(ctx: CanvasRenderingContext2D, pts: Pt[], closed = true): void {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (closed) ctx.closePath();
  }

  /** Flaeche abdunkeln oder aufhellen (mul) / darken or lighten an area (mul) */
  shade(pts: Pt[], f: number | [number, number, number], alpha = 1): this {
    this.mul.save();
    this.mul.globalAlpha = alpha;
    this.mul.fillStyle = tone(f);
    Pen.path(this.mul, pts);
    this.mul.fill();
    this.mul.restore();
    return this;
  }
  /** Flaeche in deckender Farbe (abs) / area in opaque colour (abs) */
  fill(pts: Pt[], c: ColorLike, alpha = 1): this {
    this.abs.save();
    this.abs.globalAlpha = alpha;
    this.abs.fillStyle = css(c);
    Pen.path(this.abs, pts);
    this.abs.fill();
    this.abs.restore();
    return this;
  }
  /** Flaeche in Tusche / area in ink */
  blot(pts: Pt[]): this {
    Pen.path(this.ink, pts);
    this.ink.fill();
    return this;
  }
  /** Weicher Verlauf auf mul: von f0 (bei p0) nach f1 (bei p1) ueber das Rechteck / soft gradient on mul */
  gradient(x: number, y: number, w: number, h: number, p0: Pt, p1: Pt, f0: number, f1: number, alpha = 1): this {
    const g = this.mul.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
    const steps = 6;
    for (let i = 0; i <= steps; i++) g.addColorStop(i / steps, tone(f0 + ((f1 - f0) * i) / steps));
    this.mul.save();
    this.mul.globalAlpha = alpha;
    this.mul.fillStyle = g;
    this.mul.fillRect(x, y, w, h);
    this.mul.restore();
    return this;
  }

  /**
   * Tuschestrich mit wechselnder Staerke wie von einer Feder: an den Enden duenn, dazwischen leicht schwankend.
   * Ink stroke of varying weight like a nib: thin at the ends, wavering slightly in between.
   */
  line(pts: Pt[], width: number, o: LineOpts = {}): this {
    this.strokeOn(this.ink, pts, width, o);
    return this;
  }
  /** Derselbe Strich als Farbe (abs), z. B. helle Kratzer / the same stroke as colour (abs), e.g. light scratches */
  mark(pts: Pt[], width: number, c: ColorLike, alpha = 1, o: LineOpts = {}): this {
    this.abs.save();
    this.abs.globalAlpha = alpha;
    this.abs.fillStyle = css(c);
    this.strokeOn(this.abs, pts, width, o);
    this.abs.restore();
    return this;
  }
  /** Derselbe Strich als Toenung (mul) / the same stroke as a tone (mul) */
  crease(pts: Pt[], width: number, f: number | [number, number, number], alpha = 1, o: LineOpts = {}): this {
    this.mul.save();
    this.mul.globalAlpha = alpha;
    this.mul.fillStyle = tone(f);
    this.strokeOn(this.mul, pts, width, o);
    this.mul.restore();
    return this;
  }

  private strokeOn(ctx: CanvasRenderingContext2D, src: Pt[], width: number, o: LineOpts): void {
    const pts = o.closed ? [...src, src[0]] : src;
    if (pts.length < 2) return;
    const R = rng(o.seed ?? this.seed++ * 7919);
    // gleichmaessig abtasten / resample evenly
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = acc[acc.length - 1];
    if (total < 1e-6) return;
    const n = Math.max(2, Math.ceil(total / 2.5));
    const taper = o.closed ? 0 : (o.taper ?? 0.22), press = o.press ?? 0.3, wob = o.wobble ?? 0.35;
    // niederfrequentes Rauschen entlang des Strichs / low frequency noise along the stroke
    const knots = Math.max(2, Math.ceil(total / 14) + 1);
    const na = Array.from({ length: knots + 1 }, () => R() - 0.5), nb = Array.from({ length: knots + 1 }, () => R() - 0.5);
    const noise = (arr: number[], u: number) => {
      const x = u * (knots - 1), i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
      return arr[i] * (1 - s) + arr[Math.min(knots, i + 1)] * s;
    };
    const left: Pt[] = [], right: Pt[] = [];
    let seg = 0;
    for (let k = 0; k <= n; k++) {
      const u = k / n, d = u * total;
      while (seg < pts.length - 2 && acc[seg + 1] < d) seg++;
      const a = pts[seg], b = pts[seg + 1], sl = acc[seg + 1] - acc[seg] || 1, f = (d - acc[seg]) / sl;
      let tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const prof = taper > 0 ? Math.min(1, u / taper, (1 - u) / taper) : 1;
      const hw = (width / 2) * (0.22 + 0.78 * Math.pow(prof, 0.75)) * (1 + press * 2 * noise(na, u));
      const off = wob * 2 * noise(nb, u) * (taper > 0 ? Math.min(1, prof * 2) : 1);
      const x = a[0] + (b[0] - a[0]) * f - ty * off, y = a[1] + (b[1] - a[1]) * f + tx * off;
      left.push([x - ty * hw, y + tx * hw]);
      right.push([x + ty * hw, y - tx * hw]);
    }
    Pen.path(ctx, [...left, ...right.reverse()]);
    ctx.fill();
    if (taper <= 0 && !o.closed) for (const e of [0, n]) {
      const c: Pt = [(left[e][0] + right[n - e][0]) / 2, (left[e][1] + right[n - e][1]) / 2];
      ctx.beginPath(); ctx.arc(c[0], c[1], width / 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Tusche wieder wegnehmen (Glanzpunkt in der Pupille) / take ink away again (highlight in the pupil) */
  erase(x: number, y: number, r: number): this {
    this.ink.save();
    this.ink.globalCompositeOperation = 'destination-out';
    this.ink.beginPath(); this.ink.arc(x, y, r, 0, Math.PI * 2); this.ink.fill();
    this.ink.restore();
    return this;
  }
  /** Band in deckender Farbe mit Tuscheraendern (Riemen) / band in opaque colour with ink edges (strap) */
  band(pts: Pt[], width: number, c: ColorLike, edge = 1.3): this {
    this.mark(pts, width, c, 1, { taper: 0, wobble: 0, press: 0 });
    for (const sgn of [-1, 1]) {
      const off = pts.map((q, i): Pt => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [q[0] - ((b[1] - a[1]) / l) * sgn * width / 2, q[1] + ((b[0] - a[0]) / l) * sgn * width / 2];
      });
      this.line(off, edge, { taper: 0.04, wobble: 0.2, press: 0.2 });
    }
    return this;
  }
  /** Tuschepunkt / ink dot */
  dot(x: number, y: number, r: number): this {
    this.ink.beginPath(); this.ink.arc(x, y, r, 0, Math.PI * 2); this.ink.fill();
    return this;
  }
  /** Farbpunkt (abs) / colour dot (abs) */
  spot(x: number, y: number, r: number, c: ColorLike, alpha = 1): this {
    this.abs.save();
    this.abs.globalAlpha = alpha; this.abs.fillStyle = css(c);
    this.abs.beginPath(); this.abs.arc(x, y, r, 0, Math.PI * 2); this.abs.fill();
    this.abs.restore();
    return this;
  }
  /** Tonpunkt (mul) / tone dot (mul) */
  dab(x: number, y: number, r: number, f: number | [number, number, number], alpha = 1): this {
    this.mul.save();
    this.mul.globalAlpha = alpha;
    if (r > 7) {
      // grosse Tupfer laufen weich aus / large dabs fade out softly
      const g = this.mul.createRadialGradient(x, y, r * 0.25, x, y, r);
      const c = tone(f);
      g.addColorStop(0, c);
      g.addColorStop(1, c.replace('rgb(', 'rgba(').replace(')', ',0)'));
      this.mul.fillStyle = g;
    } else this.mul.fillStyle = tone(f);
    this.mul.beginPath(); this.mul.arc(x, y, r, 0, Math.PI * 2); this.mul.fill();
    this.mul.restore();
    return this;
  }
  /**
   * Schlamm: unten eine geschlossene Kruste mit ausgefranstem Rand, darueber Spritzer, am Rand heller angetrocknet.
   * Mud: a closed crust at the bottom with a ragged edge, splashes above it, dried lighter at the edge.
   */
  mud(x: number, y: number, w: number, h: number, dark: ColorLike, light: ColorLike, seed: number, crust = 0.45): this {
    const R = rng(seed);
    const top: Pt[] = [];
    const n = Math.max(6, Math.round(w / 16));
    for (let i = 0; i <= n; i++) top.push([x + (i / n) * w, y + h - h * crust * (0.7 + R() * 0.6)]);
    const edge = (lift: number): Pt[] => [[x - 2, y + h + 3], ...spline(top.map((q): Pt => [q[0], q[1] - lift]), 4), [x + w + 2, y + h + 3]];
    this.fill(edge(2.2), light, 0.9);
    this.fill(edge(0), dark, 0.96);
    this.splatter(x, y, w, h, Math.round(w / 14), dark, seed + 1, { size: 3, rise: 2.2, alpha: 0.9 });
    this.splatter(x, y + h * 0.55, w, h * 0.45, Math.round(w / 12), light, seed + 2, { size: 2.4, rise: 1, alpha: 0.6 });
    return this;
  }

  /** Stichnaht: kurze Striche entlang einer Linie / stitching: short dashes along a line */
  stitch(pts: Pt[], len = 4, gap = 3.2, width = 1.1, f = 0.55): this {
    let carry = 0, on = true;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let d = 0;
      while (d < l) {
        const want = (on ? len : gap) - carry, step = Math.min(want, l - d);
        if (on) {
          const p0: Pt = [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l];
          const p1: Pt = [a[0] + ((b[0] - a[0]) * (d + step)) / l, a[1] + ((b[1] - a[1]) * (d + step)) / l];
          this.crease([p0, p1], width, f, 1, { taper: 0, wobble: 0, press: 0 });
        }
        d += step; carry += step;
        if (carry >= (on ? len : gap) - 1e-6) { carry = 0; on = !on; }
      }
    }
    return this;
  }

  /** Niete: Tuschebogen unten rechts, Glanzpunkt oben links / rivet: ink arc lower right, highlight upper left */
  rivet(x: number, y: number, r: number): this {
    this.dab(x, y, r, 0.78);
    this.line(arc(x, y, r, r, -0.5, 2.6, 8), Math.max(1, r * 0.55), { taper: 0.3, wobble: 0, press: 0.1 });
    this.dab(x - r * 0.3, y - r * 0.35, r * 0.42, 1.55);
    return this;
  }
  /** Nietenreihe / rivet row */
  rivets(a: Pt, b: Pt, n: number, r: number): this {
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.rivet(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r); }
    return this;
  }
  /** Plattenfuge: Tuschelinie mit heller Kante daneben / panel line: ink line with a light edge beside it */
  panel(pts: Pt[], width = 1.6, seed?: number): this {
    const lit = pts.map((p): Pt => [p[0] + 1.3, p[1] + 1.3]);
    this.crease(lit, width * 1.1, 1.45, 0.8, { taper: 0.05, wobble: 0.2, press: 0.1, seed });
    this.line(pts, width, { taper: 0.06, wobble: 0.3, press: 0.3, seed });
    return this;
  }
  /** Schweissnaht: Raupe aus kurzen Boegen / weld seam: bead of short arcs */
  weld(a: Pt, b: Pt, width = 5): this {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(l / (width * 0.62)));
    const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    this.crease([a, b], width * 1.3, 0.8, 0.9, { taper: 0.02, wobble: 0.4 });
    this.crease([[a[0] - ty * width * 0.35, a[1] + tx * width * 0.35], [b[0] - ty * width * 0.35, b[1] + tx * width * 0.35]], width * 0.4, 1.4, 0.7, { taper: 0.02, wobble: 0.4 });
    for (let i = 0; i <= n; i++) {
      const cx = a[0] + tx * l * (i / n), cy = a[1] + ty * l * (i / n);
      const ang = Math.atan2(ty, tx);
      this.line(arc(cx, cy, width * 0.5, width * 0.5, ang - 1.2, ang + 1.2, 5), 1.1, { taper: 0.35, wobble: 0.15 });
    }
    return this;
  }
  /** Flecken und Spritzer (abs), unten dichter / stains and splatter (abs), denser at the bottom */
  splatter(x: number, y: number, w: number, h: number, n: number, c: ColorLike, seed: number, o: { rise?: number; size?: number; alpha?: number } = {}): this {
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const t = Math.pow(R(), o.rise ?? 2.2);
      const px = x + R() * w, py = y + h - t * h;
      const r = (o.size ?? 5) * (0.35 + R() * (1 - t) * 1.2);
      const blob: Pt[] = [];
      const k = 7;
      for (let j = 0; j < k; j++) { const a = (j / k) * Math.PI * 2, rr = r * (0.6 + R() * 0.7); blob.push([px + Math.cos(a) * rr * 1.25, py + Math.sin(a) * rr]); }
      this.fill(spline(blob, 4, true), c, (o.alpha ?? 0.9) * (0.55 + R() * 0.45));
    }
    return this;
  }
  /** Kratzer: helle Linie mit duennem Tuscheschatten / scratch: a light line with a thin ink shadow */
  scratches(x: number, y: number, w: number, h: number, n: number, seed: number, len = 26): this {
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const px = x + R() * w, py = y + R() * h, a = (R() - 0.5) * 1.2 + (R() < 0.3 ? 1.4 : 0), l = len * (0.3 + R());
      const q: Pt = [px + Math.cos(a) * l, py + Math.sin(a) * l];
      this.crease([[px, py], q], 1.5, 1.6, 0.85, { taper: 0.4, wobble: 0.6 });
      if (R() < 0.5) this.line([[px + 0.8, py + 1.2], [q[0] + 0.8, q[1] + 1.2]], 0.9, { taper: 0.45, wobble: 0.6 });
    }
    return this;
  }
  /** Abgeplatzter Lack: blankes Metall mit heller Kante und Tuscherand / chipped paint: bare metal with a light edge and an ink rim */
  chips(x: number, y: number, w: number, h: number, n: number, metal: ColorLike, seed: number, size = 5): this {
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const px = x + R() * w, py = y + R() * h, r = size * (0.4 + R());
      const blob: Pt[] = [];
      const k = 6;
      for (let j = 0; j < k; j++) { const a = (j / k) * Math.PI * 2 + R(), rr = r * (0.45 + R() * 0.8); blob.push([px + Math.cos(a) * rr * 1.5, py + Math.sin(a) * rr]); }
      this.dab(px - 0.8, py - 0.8, r * 1.15, 1.35, 0.6);
      this.fill(blob, metal, 0.95);
      if (r > size * 0.8) this.line([...blob.slice(1, 4)], 0.9, { taper: 0.4, wobble: 0.2 });
    }
    return this;
  }
}

// ---------- Zellen und Atlanten / cells and atlases ----------

/**
 * Zelle eines Atlas. w / h = Groesse im Atlas (Bezugspixel), design = Groesse, fuer die der Maler geschrieben ist
 * (fehlt = w / h): derselbe Maler fuellt so auch eine kleinere Zelle (Besatzung im Fahrzeugatlas).
 * Cell of an atlas. w / h = size inside the atlas (reference pixels), design = the size the painter was written for
 * (absent = w / h): the same painter thus fills a smaller cell too (crew in the vehicle atlas).
 */
export interface Cell { name: string; w: number; h: number; paint: (p: Pen) => void; design?: [number, number] }

export interface AtlasDef { id: string; cells: Cell[]; layout: AtlasLayout }

/** Hoechstzahl an Atlanten: begrenzt den Texturspeicher (siehe atlasBudget) / maximum number of atlases: bounds the texture memory (see atlasBudget) */
export const MAX_ATLASES = 12;
/** Kantenlaenge der Texturen je Qualitaet / texture edge length per quality */
export const ATLAS_SIZE = { high: 1024, low: 512 } as const;

const defs = new Map<string, AtlasDef>();
/**
 * Atlas anlegen: Zellen werden nach Hoehe sortiert in Regale gepackt (deterministisch). Wirft, wenn der Atlas voll ist:
 * dann Zellen verkleinern oder einen weiteren Atlas anlegen. Die Zelle 'blank' (neutral) kommt immer dazu.
 * Define an atlas: cells are sorted by height and packed into shelves (deterministic). Throws when the atlas is full:
 * shrink cells or define another atlas then. The cell 'blank' (neutral) is always added.
 */
export function defineAtlas(id: string, cells: Cell[]): AtlasDef {
  if (defs.has(id)) throw new Error(`atlas ${id} defined twice`);
  if (defs.size >= MAX_ATLASES) throw new Error(`more than ${MAX_ATLASES} atlases`);
  const all: Cell[] = [{ name: 'blank', w: 16, h: 16, paint: () => {} }, ...cells];
  const layout = new AtlasLayout();
  const pad = layout.pad;
  const order = all.map((c, i) => ({ c, i })).sort((a, b) => b.c.h - a.c.h || b.c.w - a.c.w || a.i - b.i);
  // Regale: jede Zelle kommt ins erste Regal, in dem noch Platz ist / shelves: every cell goes into the first shelf with room left
  const shelves: { y: number; h: number; x: number }[] = [];
  for (const { c } of order) {
    let shelf = shelves.find((s) => s.x + c.w + pad <= REF && c.h <= s.h);
    if (!shelf) {
      const last = shelves[shelves.length - 1];
      shelf = { y: last ? last.y + last.h + pad : pad, h: c.h, x: pad };
      if (shelf.y + c.h + pad > REF) throw new Error(`atlas ${id}: full at ${c.name}`);
      shelves.push(shelf);
    }
    layout.place(c.name, shelf.x, shelf.y, c.w, c.h);
    shelf.x += c.w + pad;
  }
  const def: AtlasDef = { id, cells: all, layout };
  defs.set(id, def);
  return def;
}
export function atlasDef(id: string): AtlasDef {
  const d = defs.get(id);
  if (!d) throw new Error(`no atlas ${id}`);
  return d;
}
export function atlasIds(): string[] { return [...defs.keys()]; }
/** Obergrenze des Texturspeichers aller Atlanten in Bytes / ceiling of the texture memory of all atlases in bytes */
export function atlasBudget(quality: keyof typeof ATLAS_SIZE): number {
  const n = ATLAS_SIZE[quality];
  return Math.round((MAX_ATLASES * n * n * 5 * 4) / 3);
}

// ---------- Zeichnen, verteilt ueber mehrere Bilder / painting, spread over several frames ----------

interface Job {
  def: AtlasDef; size: number; tex: AtlasTextures; next: number;
  paint: Uint8Array; sdf: Uint8Array;
  canvases: HTMLCanvasElement[]; ctx: CanvasRenderingContext2D[];
}
const textures = new Map<string, AtlasTextures>();
const jobs: Job[] = [];
let scheduled = false;
const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

/**
 * Texturen eines Atlas in der Kantenlaenge size. Kommt sofort zurueck; gezeichnet wird danach in kleinen Schritten.
 * Textures of an atlas at edge length size. Returns at once; painting follows in small steps.
 */
export function atlasTextures(id: string, size: number): AtlasTextures {
  const key = `${id}|${size}`;
  let t = textures.get(key);
  if (t) return t;
  const def = atlasDef(id), N = size * size;
  const paint = new Uint8Array(N * 4), sdf = new Uint8Array(N);
  // neutral: mul = 1, keine Farbe, keine Tusche / neutral: mul = 1, no colour, no ink
  for (let i = 0; i < N; i++) { paint[i * 4] = 128; paint[i * 4 + 1] = 128; paint[i * 4 + 2] = 128; }
  const mk = (data: Uint8Array, format: THREE.PixelFormat) => {
    const x = new THREE.DataTexture(data, size, size, format, THREE.UnsignedByteType);
    x.colorSpace = THREE.NoColorSpace;
    x.minFilter = THREE.LinearMipmapLinearFilter;
    x.magFilter = THREE.LinearFilter;
    x.generateMipmaps = true;
    x.anisotropy = 4;
    x.needsUpdate = true;
    return x;
  };
  t = { paint: mk(paint, THREE.RGBAFormat), ink: mk(sdf, THREE.RedFormat), size, bytes: Math.round((N * 5 * 4) / 3), ms: 0, maxStepMs: 0, ready: false };
  textures.set(key, t);
  if (hasDom()) {
    const canvases: HTMLCanvasElement[] = [], ctx: CanvasRenderingContext2D[] = [];
    for (let i = 0; i < 3; i++) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      canvases.push(c);
      ctx.push(c.getContext('2d', { willReadFrequently: true })!);
    }
    ctx[0].fillStyle = tone(1);
    ctx[0].fillRect(0, 0, size, size);
    jobs.push({ def, size, tex: t, next: 0, paint, sdf, canvases, ctx });
    schedule();
  }
  return t;
}

/** Eine Zelle zeichnen und in die Texturdaten uebernehmen / paint one cell and copy it into the texture data */
function step(job: Job): void {
  const t0 = performance.now();
  const cell = job.def.cells[job.next++];
  const r = job.def.layout.get(cell.name);
  const k = job.size / REF;
  const dw = cell.design ? cell.design[0] : r.w, dh = cell.design ? cell.design[1] : r.h;
  const bleed = 3;
  for (const x of job.ctx) {
    x.save();
    x.setTransform((k * r.w) / dw, 0, 0, (k * r.h) / dh, r.x * k, r.y * k);
    x.beginPath();
    x.rect(-bleed, -bleed, dw + 2 * bleed, dh + 2 * bleed);
    x.clip();
  }
  job.ctx[2].fillStyle = semantic.white;
  try {
    cell.paint(new Pen({ ...r, w: dw, h: dh }, job.ctx[0], job.ctx[1], job.ctx[2]));
  } finally {
    for (const x of job.ctx) x.restore();
  }
  // Ausschnitt samt Rand lesen / read the rectangle including its margin
  const m = Math.ceil(SDF_RANGE * k) + 2;
  const x0 = Math.max(0, Math.floor(r.x * k) - m), y0 = Math.max(0, Math.floor(r.y * k) - m);
  const x1 = Math.min(job.size, Math.ceil((r.x + r.w) * k) + m), y1 = Math.min(job.size, Math.ceil((r.y + r.h) * k) + m);
  const w = x1 - x0, h = y1 - y0;
  const mul = job.ctx[0].getImageData(x0, y0, w, h).data, abs = job.ctx[1].getImageData(x0, y0, w, h).data, ink = job.ctx[2].getImageData(x0, y0, w, h).data;
  const field = distanceField(ink, w, h, SDF_RANGE * k);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = (y0 + y) * job.size + x0 + x;
    const a = abs[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) job.paint[o * 4 + c] = Math.round(mul[i * 4 + c] * (1 - a) + abs[i * 4 + c] * a);
    job.paint[o * 4 + 3] = abs[i * 4 + 3];
    job.sdf[o] = field[i];
  }
  const ms = performance.now() - t0;
  job.tex.ms += ms;
  job.tex.maxStepMs = Math.max(job.tex.maxStepMs, ms);
  if (job.next >= job.def.cells.length) {
    job.tex.paint.needsUpdate = true;
    job.tex.ink.needsUpdate = true;
    job.tex.ready = true;
    for (const c of job.canvases) { c.width = 1; c.height = 1; }
    jobs.splice(jobs.indexOf(job), 1);
    for (const fn of listeners) fn();
  }
}

/** Zeit je Bild fuer das Zeichnen / time per frame spent painting */
const FRAME_BUDGET_MS = 5;
function schedule(): void {
  if (scheduled || !jobs.length || typeof requestAnimationFrame !== 'function') return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const t0 = performance.now();
    while (jobs.length && performance.now() - t0 < FRAME_BUDGET_MS) step(jobs[0]);
    schedule();
  });
}
const listeners = new Set<() => void>();
/** Rueckruf, sobald ein Atlas fertig gezeichnet ist (das Brett zeichnet dann neu) / callback once an atlas has finished painting (the board redraws then) */
export function onAtlasReady(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** Alles Ausstehende sofort fertig zeichnen (Vorschau, Bildschirmfotos) / finish all pending painting at once (preview, screenshots) */
export function flushAtlases(): void {
  while (jobs.length) step(jobs[0]);
}
/**
 * Grafikspeicher der Texturen anderer Kantenlaengen freigeben (Qualitaet umgeschaltet). Die Daten bleiben erhalten:
 * wird eine solche Textur doch noch gezeichnet, laedt three.js sie wieder hoch.
 * Free the GPU memory of textures of other edge lengths (quality switched). The data stays: if such a texture is
 * drawn after all, three.js uploads it again.
 */
export function releaseAtlases(keepSize: number): void {
  for (const t of textures.values()) if (t.size !== keepSize) { t.paint.dispose(); t.ink.dispose(); }
}
/** Steht noch Zeichnen aus? / is painting still pending? */
export function atlasesPending(): boolean { return jobs.length > 0; }
/** Angelegte Texturen (fuer Messwerte) / created textures (for measurements) */
export function atlasStats(): { key: string; bytes: number; ms: number; maxStepMs: number; ready: boolean }[] {
  return [...textures.entries()].map(([key, t]) => ({ key, bytes: t.bytes, ms: Math.round(t.ms), maxStepMs: Math.round(t.maxStepMs), ready: t.ready }));
}

// ---------- Abstandsfeld / distance field ----------

const INF = 1e20;
/** 1D-Abstandstransformation (Felzenszwalb) / 1D distance transform (Felzenszwalb) */
function edt1d(grid: Float64Array, offset: number, stride: number, length: number, f: Float64Array, v: Uint16Array, z: Float64Array): void {
  v[0] = 0; z[0] = -INF; z[1] = INF; f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k], qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}
/**
 * Abstandsfeld aus der Deckung der Tuscheebene (RGBA, w x h): 0.5 = Kante, darueber innen. range = Reichweite in Pixeln.
 * Distance field from the coverage of the ink layer (RGBA, w x h): 0.5 = edge, above it inside. range = reach in pixels.
 */
export function distanceField(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, range: number): Uint8Array {
  const N = w * h;
  const out = new Uint8Array(N);
  let any = false;
  for (let i = 0; i < N && !any; i++) any = rgba[i * 4 + 3] > 0;
  if (!any) return out;
  const outer = new Float64Array(N), inner = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = rgba[i * 4 + 3] / 255;
    outer[i] = a >= 1 ? 0 : a <= 0 ? INF : Math.max(0, 0.5 - a) ** 2;
    inner[i] = a >= 1 ? INF : a <= 0 ? 0 : Math.max(0, a - 0.5) ** 2;
  }
  const n = Math.max(w, h);
  const f = new Float64Array(n), z = new Float64Array(n + 1), v = new Uint16Array(n);
  for (const grid of [outer, inner]) {
    for (let x = 0; x < w; x++) edt1d(grid, x, w, h, f, v, z);
    for (let y = 0; y < h; y++) edt1d(grid, y * w, 1, w, f, v, z);
  }
  for (let i = 0; i < N; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    out[i] = Math.max(0, Math.min(255, Math.round(255 * (0.5 - d / (2 * range)))));
  }
  return out;
}
