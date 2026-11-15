/**
 * Renderer des Intros: renderAt(ctx, t, ...) zeichnet das Bild zur Zeit t, als reine Funktion von t, Groesse, Bildern
 * und Texten (Zufall nur ueber rng mit fester Saat). Comic-Stil: dicke Tuschekonturen, Rasterpunkte, Gelb-Schwarz-Warnstreifen,
 * Ken-Burns-Fahrten ueber die Comic-Seiten, Speedlines, Wischblenden. Hochformat hat ein eigenes Layout (kein Letterbox).
 * Intro renderer: renderAt(ctx, t, ...) draws the frame at time t as a pure function of t, size, images and texts
 * (randomness only via rng with a fixed seed). Comic style: thick ink outlines, halftone dots, yellow/black hazard stripes,
 * Ken Burns moves over the comic pages, speed lines, wipes. Portrait has its own layout (no letterbox).
 */
import { components, factionTokens, primitives } from '../design/tokens';
import type { IntroAssets, LorePage, Pic } from './assets';
import type { IntroTexts } from './texts';
import {
  DURATION, HUMANS, SCENES, SUBTITLES, clamp, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, easeOutExpo, frameState, lerp, rng, seg,
  type HumanFaction,
} from './timeline';

const C = components.intro;
const FONT = primitives.font;
type FontKind = 'display' | 'comic' | 'body';

interface R {
  ctx: CanvasRenderingContext2D;
  W: number; H: number;
  /** Einheit: 1 bei 1080 Pixeln kurzer Seite / unit: 1 at 1080 pixels short side */
  u: number;
  portrait: boolean;
  A: IntroAssets;
  T: IntroTexts;
  t: number;
}

export interface RenderOptions { subtitles?: boolean }

// ---------- Farben / colours ----------
const rgbCache = new Map<string, [number, number, number]>();
/** Token-Farbe mit Deckkraft / token colour with opacity */
export function withAlpha(color: string, a: number): string {
  let rgb = rgbCache.get(color);
  if (!rgb) {
    const h = color.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(color, rgb);
  }
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(a)})`;
}

// ---------- Bausteine / building blocks ----------
const font = (kind: FontKind, size: number, weight = kind === 'body' ? '700' : '400') => `${weight} ${Math.max(1, size)}px ${FONT[kind]}`;

/** Ausschnitt einer Seite (normiert) mit Fokus / crop of a page (normalised) with focus */
interface Crop { page: LorePage; x: number; y: number; w: number; h: number }
const CROPS = {
  wrecks: { page: 'prolog', x: 0.22, y: 0.282, w: 0.78, h: 0.195 },
  map: { page: 'prolog', x: 0.24, y: 0.495, w: 0.56, h: 0.19 },
  crash: { page: 'prolog', x: 0.235, y: 0.705, w: 0.765, h: 0.29 },
  korvatA: { page: 'korvat', x: 0.3, y: 0.535, w: 0.69, h: 0.2 },
  korvatB: { page: 'korvat', x: 0.27, y: 0.79, w: 0.72, h: 0.155 },
  alveniaA: { page: 'alvenia', x: 0.38, y: 0.01, w: 0.62, h: 0.2 },
  alveniaB: { page: 'alvenia', x: 0.6, y: 0.455, w: 0.4, h: 0.225 },
  dravonA: { page: 'dravon', x: 0.41, y: 0.515, w: 0.59, h: 0.23 },
  dravonB: { page: 'dravon', x: 0.42, y: 0.765, w: 0.58, h: 0.23 },
  velkarA: { page: 'velkar', x: 0.37, y: 0.005, w: 0.63, h: 0.205 },
  velkarB: { page: 'velkar', x: 0.36, y: 0.725, w: 0.64, h: 0.27 },
  meridonA: { page: 'meridon', x: 0.385, y: 0.005, w: 0.615, h: 0.21 },
  meridonB: { page: 'meridon', x: 0.55, y: 0.228, w: 0.45, h: 0.21 },
} satisfies Record<string, Crop>;

/**
 * Ausschnitt fuellend zeichnen (Ken Burns: zoom >= 1, pan -1..1 innerhalb des Spielraums).
 * Draw a crop to fill a rect (Ken Burns: zoom >= 1, pan -1..1 within the slack).
 */
function cover(r: R, crop: Crop, x: number, y: number, w: number, h: number, zoom = 1, px = 0, py = 0) {
  const pic = r.A.lore[crop.page];
  if (!pic) { r.ctx.fillStyle = C.inkSoft; r.ctx.fillRect(x, y, w, h); return; }
  const cx = crop.x * pic.w, cy = crop.y * pic.h, cw = crop.w * pic.w, ch = crop.h * pic.h;
  const A = w / h;
  let sw: number, sh: number;
  if (cw / ch > A) { sh = ch; sw = sh * A; } else { sw = cw; sh = sw / A; }
  if (sh > pic.h) { sh = pic.h; sw = sh * A; }
  if (sw > pic.w) { sw = pic.w; sh = sw / A; }
  sw /= zoom; sh /= zoom;
  let sx = cx + (cw - sw) / 2 + (px * Math.abs(cw - sw)) / 2;
  let sy = cy + (ch - sh) / 2 + (py * Math.abs(ch - sh)) / 2;
  sx = clamp(sx, 0, pic.w - sw); sy = clamp(sy, 0, pic.h - sh);
  r.ctx.drawImage(pic.img, sx, sy, sw, sh, x, y, w, h);
}

/** Seitenverhaeltnis eines Ausschnitts / aspect ratio of a crop */
function aspectOf(r: R, c: Crop) {
  const pic = r.A.lore[c.page];
  return pic ? (c.w * pic.w) / (c.h * pic.h) : 3;
}

/** Comic-Feld: Rechteck mit Papierrand, Tuschekontur und Schlagschatten / comic panel: rect with paper gutter, ink outline and drop shadow */
interface Panel { x: number; y: number; w: number; h: number; rot: number }
function panel(r: R, crop: Crop, p: Panel, o: { zoom?: number; px?: number; py?: number; dx?: number; dy?: number; scale?: number; alpha?: number; inner?: (box: Panel) => void } = {}) {
  const ctx = r.ctx, u = r.u, g = 10 * u;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(p.x + p.w / 2 + (o.dx ?? 0), p.y + p.h / 2 + (o.dy ?? 0));
  ctx.rotate(p.rot);
  const sc = o.scale ?? 1;
  ctx.scale(sc, sc);
  const x = -p.w / 2, y = -p.h / 2;
  ctx.fillStyle = C.ink; ctx.fillRect(x - g + 14 * u, y - g + 14 * u, p.w + g * 2, p.h + g * 2);
  ctx.fillStyle = C.paper; ctx.fillRect(x - g, y - g, p.w + g * 2, p.h + g * 2);
  ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.strokeRect(x - g, y - g, p.w + g * 2, p.h + g * 2);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, p.w, p.h); ctx.clip();
  cover(r, crop, x, y, p.w, p.h, o.zoom ?? 1, o.px ?? 0, o.py ?? 0);
  halftone(r, C.ink, 0.1, 7, x, y, p.w, p.h);
  o.inner?.({ x, y, w: p.w, h: p.h, rot: 0 });
  ctx.restore();
  ctx.lineWidth = 6 * u; ctx.strokeRect(x, y, p.w, p.h);
  ctx.restore();
}

const patterns = new Map<string, CanvasPattern | null>();
/** Rasterpunkte / halftone dots */
function halftone(r: R, color: string, alpha: number, size = 9, x = 0, y = 0, w = r.W, h = r.H) {
  const px = Math.max(3, Math.round(size * r.u * 2) / 2);
  const key = `${color}:${px}`;
  let pat = patterns.get(key);
  if (pat === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px * 2);
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    for (const [dx, dy] of [[0.5, 0.5], [1.5, 1.5]]) { g.beginPath(); g.arc(dx * px, dy * px, px * 0.24, 0, Math.PI * 2); g.fill(); }
    pat = r.ctx.createPattern(c, 'repeat');
    patterns.set(key, pat);
  }
  if (!pat) return;
  const ctx = r.ctx;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = pat; ctx.fillRect(x, y, w, h); ctx.restore();
}

/** Strahlenkranz / sunburst */
function sunburst(r: R, cx: number, cy: number, n: number, rot: number, color: string, alpha: number) {
  const ctx = r.ctx, R0 = Math.hypot(r.W, r.H) * 1.2;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, b = a + Math.PI / n;
    ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); ctx.lineTo(cx + Math.cos(b) * R0, cy + Math.sin(b) * R0); ctx.closePath();
  }
  ctx.fill(); ctx.restore();
}

/** Speedlines um einen Mittelpunkt / speed lines around a centre */
function speedLines(r: R, cx: number, cy: number, inner: number, n: number, seed: number, color: string, alpha: number) {
  if (alpha <= 0) return;
  const ctx = r.ctx, R0 = Math.hypot(r.W, r.H);
  const rand = rng(seed + Math.floor(r.t * 15));
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, wa = 0.003 + rand() * 0.012, r1 = inner * (0.8 + rand() * 0.6);
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a - wa) * R0, cy + Math.sin(a - wa) * R0);
    ctx.lineTo(cx + Math.cos(a + wa) * R0, cy + Math.sin(a + wa) * R0);
    ctx.closePath();
  }
  ctx.fill(); ctx.restore();
}

/** Zackiger Explosionsstern / jagged burst star */
function burstPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number, n: number, seed: number) {
  const rand = rng(seed);
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? ro * (0.82 + rand() * 0.3) : ri * (0.9 + rand() * 0.2);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
function burst(r: R, cx: number, cy: number, ro: number, fill: string, seed: number, n = 12, line = 6) {
  const ctx = r.ctx;
  burstPath(ctx, cx, cy, ro, ro * 0.58, n, seed);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = line * r.u; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
}

/** Text mit Tuschekontur und Versatzschatten / text with ink outline and offset shadow */
function inkText(r: R, text: string, x: number, y: number, size: number, kind: FontKind, fill: string,
  o: { stroke?: number; shadow?: number; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; strokeColor?: string } = {}) {
  const ctx = r.ctx;
  ctx.font = font(kind, size);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  const sw = (o.stroke ?? 0) * r.u, sh = (o.shadow ?? 0) * r.u;
  ctx.strokeStyle = o.strokeColor ?? C.ink;
  if (sh) {
    ctx.fillStyle = o.strokeColor ?? C.ink;
    if (sw) { ctx.lineWidth = sw * 2; ctx.strokeText(text, x + sh, y + sh); }
    ctx.fillText(text, x + sh, y + sh);
  }
  if (sw) { ctx.lineWidth = sw * 2; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Schriftgroesse, die in die Breite passt / font size that fits the width */
function fitSize(r: R, text: string, kind: FontKind, max: number, maxW: number) {
  r.ctx.font = font(kind, max);
  const w = r.ctx.measureText(text).width;
  return w > maxW ? (max * maxW) / w : max;
}

function wrap(r: R, text: string, kind: FontKind, size: number, maxW: number): string[] {
  r.ctx.font = font(kind, size);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && r.ctx.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Polygon als Pfad / polygon as a path */
function poly(ctx: CanvasRenderingContext2D, pts: number[][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
}

/** Warnstreifen in einem Rechteck / hazard stripes in a rect */
function hazard(r: R, x: number, y: number, w: number, h: number, offset = 0, stripe = 36) {
  const ctx = r.ctx, s = stripe * r.u;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = C.hazard; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.ink; ctx.beginPath();
  const o = ((offset * r.u) % (s * 2) + s * 2) % (s * 2);
  for (let k = x - h - s * 2 + o; k < x + w + h; k += s * 2) { ctx.moveTo(k, y + h); ctx.lineTo(k + s, y + h); ctx.lineTo(k + s + h, y); ctx.lineTo(k + h, y); ctx.closePath(); }
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4 * r.u; ctx.strokeStyle = C.ink; ctx.strokeRect(x, y, w, h);
}

/** Bild im Kreis mit Tuscherand / image in a circle with an ink rim */
function circlePic(r: R, pic: Pic | undefined, cx: number, cy: number, rad: number, rim: string, fallback: string) {
  const ctx = r.ctx;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx + 10 * r.u, cy + 10 * r.u, rad, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fillStyle = fallback; ctx.fill();
  ctx.save(); ctx.clip();
  if (pic) ctx.drawImage(pic.img, cx - rad, cy - rad, rad * 2, rad * 2);
  ctx.restore();
  ctx.lineWidth = Math.max(2, 9 * r.u); ctx.strokeStyle = rim; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, rad + 4.5 * r.u, 0, Math.PI * 2); ctx.lineWidth = Math.max(2, 6 * r.u); ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
}

/** Fraktionsabzeichen (Kreis mit Emblem) / faction badge (circle with emblem) */
function badge(r: R, f: HumanFaction, cx: number, cy: number, rad: number) {
  const ctx = r.ctx, ft = factionTokens[f];
  ctx.beginPath(); ctx.arc(cx + 5 * r.u, cy + 5 * r.u, rad, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fillStyle = ft.primary; ctx.fill();
  ctx.lineWidth = Math.max(2, 5 * r.u); ctx.strokeStyle = C.ink; ctx.stroke();
  const em = r.A.emblems[f];
  if (em) ctx.drawImage(em.img, cx - rad * 0.62, cy - rad * 0.62, rad * 1.24, rad * 1.24);
}

// ---------- Szenen / scenes ----------

/** Kinobalken in der Vorgeschichte / cinema bars in the prologue */
function cinemaBars(r: R, amount: number) {
  if (amount <= 0) return;
  const h = (r.portrait ? 0.035 : 0.06) * r.H * amount;
  r.ctx.fillStyle = C.ink;
  r.ctx.fillRect(0, 0, r.W, h); r.ctx.fillRect(0, r.H - h, r.W, h);
}

function drawStandstill(r: R, l: number) {
  const ctx = r.ctx, { W, H, u } = r;
  ctx.fillStyle = C.inkSoft; ctx.fillRect(0, 0, W, H);
  sunburst(r, W * 0.5, H * 0.45, 22, l * 0.03, C.bg, 0.5);
  halftone(r, C.paper, 0.05, 10);
  const w = W * (r.portrait ? 0.92 : 0.9);
  const h1 = r.portrait ? H * 0.3 : clamp(w / aspectOf(r, CROPS.wrecks), H * 0.34, H * 0.42);
  const h2 = r.portrait ? H * 0.3 : clamp(w / aspectOf(r, CROPS.map), H * 0.36, H * 0.46);
  const p1: Panel = { x: (W - w) / 2, y: r.portrait ? H * 0.12 : H * 0.17, w, h: h1, rot: -0.015 };
  const p2: Panel = { x: (W - w) / 2 + w * 0.02, y: r.portrait ? H * 0.45 : H * 0.42, w: w * 0.96, h: h2, rot: 0.018 };
  const a1 = easeOutCubic(seg(l, 0, 0.7));
  const dim = seg(l, 3, 3.4);
  panel(r, CROPS.wrecks, p1, { zoom: lerp(1.15, 1.02, seg(l, 0, 6)), px: lerp(0.5, -0.5, seg(l, 0, 6)), dx: (1 - a1) * W * 0.6, alpha: a1 });
  if (dim > 0) { ctx.fillStyle = withAlpha(C.ink, dim * 0.45); ctx.fillRect(0, 0, W, H); }
  const a2 = seg(l, 2.7, 3);
  if (a2 > 0) {
    const kp = seg(l, 3, 6);
    panel(r, CROPS.map, p2, {
      zoom: lerp(1.05, 1.18, kp), px: lerp(-0.4, 0.4, kp), scale: lerp(1.3, 1, easeInCubic(a2)), alpha: Math.min(1, a2 * 2),
      inner: (b) => chalkBorders(r, seg(l, 3.3, 5.4), b.x, b.y, b.w, b.h),
    });
  }
  // Stempel "Prolog: Der Sternfall" / stamp "Prologue: The Starfall"
  const sp = seg(l, 0.9, 1.15);
  if (sp > 0) {
    const size = (r.portrait ? 44 : 46) * u;
    ctx.save();
    ctx.translate(p1.x + 30 * u, p1.y - 34 * u);
    ctx.rotate(-0.04);
    const s = lerp(1.8, 1, easeInCubic(sp));
    ctx.scale(s, s);
    ctx.globalAlpha = sp;
    const label = r.T.prologue.toUpperCase();
    ctx.font = font('display', size);
    const tw = Math.min(ctx.measureText(label).width, W * 0.8);
    const pad = 16 * u;
    ctx.fillStyle = C.ink; ctx.fillRect(-pad + 7 * u, -size - pad * 0.6 + 7 * u, tw + pad * 2, size + pad * 1.6);
    ctx.fillStyle = C.paper; ctx.fillRect(-pad, -size - pad * 0.6, tw + pad * 2, size + pad * 1.6);
    ctx.lineWidth = 5 * u; ctx.strokeStyle = C.stamp; ctx.strokeRect(-pad + 4 * u, -size - pad * 0.6 + 4 * u, tw + pad * 2 - 8 * u, size + pad * 1.6 - 8 * u);
    ctx.fillStyle = C.stamp; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillText(label, 0, -2 * u, W * 0.8);
    ctx.restore();
  }
}

/** Kreidegrenzen auf der alten Karte / chalk borders on the old map */
function chalkBorders(r: R, p: number, bx: number, by: number, bw: number, bh: number) {
  if (p <= 0) return;
  const ctx = r.ctx, rand = rng(77);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < 4; k++) {
    const pts: number[][] = [];
    const vertical = k % 2 === 0;
    const base = vertical ? bx + (0.22 + k * 0.19) * bw : by + (0.3 + (k - 1) * 0.2) * bh;
    for (let i = 0; i <= 14; i++) {
      const s = i / 14;
      const j = (rand() - 0.5) * 60 * r.u;
      pts.push(vertical ? [base + j, by + s * bh] : [bx + s * bw, base + j]);
    }
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const q = clamp(p * 1.6 - k * 0.2);
    ctx.setLineDash([len * q, len]);
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineWidth = 13 * r.u; ctx.strokeStyle = withAlpha(C.ink, 0.6); ctx.stroke();
    ctx.lineWidth = 6 * r.u; ctx.strokeStyle = C.chalk; ctx.stroke();
  }
  ctx.restore();
}

/** Duenen und Glockenturm am Horizont / dunes and bell tower on the horizon */
function horizon(r: R, glow: number) {
  const ctx = r.ctx, y0 = r.H * (r.portrait ? 0.8 : 0.78);
  if (glow > 0) {
    const g = ctx.createLinearGradient(0, y0 - r.H * 0.25, 0, y0);
    g.addColorStop(0, withAlpha(C.fire, 0)); g.addColorStop(1, withAlpha(C.fire, 0.75 * glow));
    ctx.fillStyle = g; ctx.fillRect(0, y0 - r.H * 0.25, r.W, r.H * 0.25);
    ctx.fillStyle = withAlpha(C.fire, 0.75 * glow); ctx.fillRect(0, y0, r.W, r.H - y0);
  }
  const rand = rng(5);
  const pts: number[][] = [[0, r.H]];
  for (let i = 0; i <= 12; i++) pts.push([(i / 12) * r.W, y0 + (rand() - 0.5) * 60 * r.u + Math.sin(i * 1.3) * 26 * r.u]);
  pts.push([r.W, r.H]);
  poly(ctx, pts);
  ctx.fillStyle = C.dune; ctx.fill();
  ctx.lineWidth = 6 * r.u; ctx.strokeStyle = C.ink; ctx.stroke();
  // Glockenturm / bell tower
  const bx = r.W * 0.86, bw = 54 * r.u, bh = 190 * r.u, by = y0 + 6 * r.u;
  poly(ctx, [[bx, by], [bx, by - bh], [bx + bw / 2, by - bh - 46 * r.u], [bx + bw, by - bh], [bx + bw, by]]);
  ctx.fillStyle = C.ink; ctx.fill();
  ctx.beginPath(); ctx.arc(bx + bw / 2, by - bh + 40 * r.u, 14 * r.u, Math.PI, 0); ctx.lineTo(bx + bw / 2 + 14 * r.u, by - bh + 58 * r.u); ctx.lineTo(bx + bw / 2 - 14 * r.u, by - bh + 58 * r.u); ctx.closePath();
  ctx.fillStyle = C.fire; ctx.globalAlpha = 0.5 + glow * 0.5; ctx.fill(); ctx.globalAlpha = 1;
}

/** Brennender Truemmerbrocken mit Schweif / burning debris chunk with a tail */
function debris(r: R, x: number, y: number, dx: number, dy: number, size: number, tail: number, seed: number) {
  const ctx = r.ctx, rand = rng(seed + Math.floor(r.t * 20));
  const n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n, nx = -uy, ny = ux;
  const tx = x - ux * tail, ty = y - uy * tail;
  const jitter = (k: number) => (rand() - 0.5) * size * k;
  // Flammenschweif / flame tail
  poly(ctx, [[x + nx * size, y + ny * size], [tx + jitter(1.4), ty + jitter(1.4)], [x - nx * size, y - ny * size]]);
  ctx.fillStyle = C.fire; ctx.fill(); ctx.lineWidth = 3.5 * r.u; ctx.strokeStyle = C.ink; ctx.stroke();
  poly(ctx, [[x + nx * size * 0.5, y + ny * size * 0.5], [x - ux * tail * 0.55 + jitter(0.6), y - uy * tail * 0.55 + jitter(0.6)], [x - nx * size * 0.5, y - ny * size * 0.5]]);
  ctx.fillStyle = C.fireHot; ctx.fill();
  // Brocken / chunk
  const k = rng(seed);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, rr = size * (0.8 + k() * 0.5); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fillStyle = C.alienDark; ctx.fill(); ctx.lineWidth = 4 * r.u; ctx.stroke();
}

/** Mutterschiff der Zyrr / Zyrr mothership */
/** Mutterschiff der Zyrr mit Feuerfahne und Rauch (dx, dy: Flugrichtung) / Zyrr mothership with flame plume and smoke (dx, dy: direction of flight) */
function mothership(r: R, x: number, y: number, s: number, tilt: number, burn: number, dx: number, dy: number) {
  const ctx = r.ctx, u = r.u, rand = rng(900 + Math.floor(r.t * 18));
  const n = Math.hypot(dx, dy), bx = -dx / n, by = -dy / n, px = -by, py = bx;
  // Rauchspur / smoke trail
  for (let k = 9; k >= 0; k--) {
    const d = s * (0.9 + k * 0.32), wob = Math.sin(k * 1.7 + r.t * 2) * s * 0.08;
    const rad = s * (0.12 + k * 0.035);
    ctx.beginPath(); ctx.arc(x + bx * d + px * wob, y + by * d + py * wob, rad, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(k % 2 ? C.smoke : C.smokeLight, 0.92 - k * 0.06); ctx.fill();
    ctx.lineWidth = 4 * u; ctx.strokeStyle = withAlpha(C.ink, 0.8 - k * 0.06); ctx.stroke();
  }
  // Feuerfahne in drei Lagen / flame plume in three layers
  for (const [col, len, wid] of [[C.fire, 0.95, 0.4], [C.fireHot, 0.7, 0.27], [C.flash, 0.4, 0.14]] as [string, number, number][]) {
    const L = s * len * (0.7 + burn * 0.4), Wd = s * wid;
    const left: number[][] = [], right: number[][] = [];
    for (let i = 0; i <= 12; i++) {
      const q = i / 12, w = Wd * Math.pow(1 - q, 0.8) * (i % 2 ? 0.55 + rand() * 0.3 : 1 + rand() * 0.25), dd = L * q * (i % 2 ? 0.9 : 1.05) + (rand() - 0.5) * s * 0.06;
      left.push([x + bx * dd + px * w, y + by * dd + py * w]);
      right.push([x + bx * dd - px * w * (0.9 + rand() * 0.3), y + by * dd - py * w * (0.9 + rand() * 0.3)]);
    }
    poly(ctx, [...left, ...right.reverse()]);
    ctx.fillStyle = col; ctx.fill();
    if (col === C.fire) { ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  ctx.lineWidth = 7 * u; ctx.strokeStyle = C.ink;
  // Unterseite mit Raster / underside with halftone
  ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.52, s * 0.14, 0, 0, Math.PI * 2); ctx.fillStyle = C.alienDark; ctx.fill();
  ctx.save(); ctx.clip(); halftone(r, C.ink, 0.45, 6, -s * 0.6, 0, s * 1.2, s * 0.3); ctx.restore(); ctx.stroke();
  // Oberseite mit Plattenfugen / top with panel seams
  ctx.beginPath(); ctx.ellipse(0, -s * 0.02, s * 0.47, s * 0.11, 0, 0, Math.PI * 2); ctx.fillStyle = C.alien; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.lineWidth = 2.5 * u; ctx.strokeStyle = withAlpha(C.ink, 0.6);
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * s * 0.12, -s * 0.15); ctx.quadraticCurveTo(k * s * 0.16, 0, k * s * 0.13, s * 0.1); ctx.stroke(); }
  halftone(r, C.ink, 0.25, 6, -s * 0.5, -s * 0.02, s, s * 0.2);
  ctx.restore();
  ctx.lineWidth = 7 * u; ctx.strokeStyle = C.ink; ctx.stroke();
  // Kuppel / dome
  ctx.beginPath(); ctx.ellipse(-s * 0.04, -s * 0.08, s * 0.16, s * 0.09, 0, Math.PI, 0); ctx.closePath();
  ctx.fillStyle = C.alienDark; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = withAlpha(C.alienGlow, 0.55); ctx.fillRect(-s * 0.2, -s * 0.18, s * 0.14, s * 0.12); ctx.restore();
  ctx.stroke();
  // Lichter am Rand / rim lights
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + (i / 8) * 0.76);
    const lx = Math.cos(a) * s * 0.43, ly = s * 0.07 + Math.sin(a) * s * 0.06;
    ctx.beginPath(); ctx.arc(lx, ly, s * 0.016, 0, Math.PI * 2);
    ctx.fillStyle = (i + Math.floor(r.t * 8)) % 3 === 0 ? C.flash : C.alienGlow; ctx.fill();
    ctx.lineWidth = 2 * u; ctx.stroke();
  }
  // Risse und Brandherde vorn / cracks and fires at the front
  ctx.lineWidth = 3 * u; ctx.strokeStyle = C.ink;
  ctx.beginPath(); ctx.moveTo(s * 0.18, -s * 0.07); ctx.lineTo(s * 0.24, -s * 0.02); ctx.lineTo(s * 0.21, s * 0.03); ctx.lineTo(s * 0.28, s * 0.08); ctx.stroke();
  for (let i = 0; i < 3; i++) burst(r, s * (0.26 + i * 0.07), -s * 0.04 + i * s * 0.04, s * (0.05 + rand() * 0.03) * (0.5 + burn), i % 2 ? C.fire : C.fireHot, 40 + i + Math.floor(r.t * 12), 7, 3);
  ctx.restore();
}

function drawStarfall(r: R, l: number) {
  const ctx = r.ctx, { W, H, u } = r;
  // Himmel / sky
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.skyTop); g.addColorStop(0.6, C.skyHigh); g.addColorStop(1, C.skyMid);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const burn = easeInCubic(seg(l, 0.3, 4.8));
  g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, withAlpha(C.skyTop, burn)); g.addColorStop(0.45, withAlpha(C.skyBurn, burn)); g.addColorStop(1, withAlpha(C.fire, burn));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Sterne / stars
  const sr = rng(11);
  ctx.fillStyle = C.paper;
  for (let i = 0; i < 90; i++) { const sx = sr() * W, sy = sr() * H * 0.7, ss = (1 + sr() * 2.5) * u; ctx.globalAlpha = (1 - burn) * (0.4 + sr() * 0.6); ctx.fillRect(sx, sy, ss, ss); }
  ctx.globalAlpha = 1;
  halftone(r, C.ink, 0.22, 8);
  // Truemmer / debris
  const dr = rng(23);
  const dirX = 0.62, dirY = 1;
  for (let i = 0; i < 24; i++) {
    const t0 = dr() * 4.4, dur = 0.9 + dr() * 0.9, sx = -0.15 * W + dr() * 1.0 * W, size = (7 + dr() * 15) * u, tail = (0.12 + dr() * 0.16) * Math.max(W, H);
    const q = (l - t0) / dur;
    if (q < 0 || q > 1) continue;
    const travel = H * 1.35;
    const x = sx + dirX * q * travel * 0.6, y = -0.08 * H + dirY * q * travel;
    debris(r, x, y, dirX, dirY, size, tail * Math.min(1, q * 3), 100 + i);
  }
  // Mutterschiff / mothership
  const mq = seg(l, 1.2, 5);
  if (mq > 0) {
    const e = Math.pow(mq, 1.7);
    const s = lerp(0.36, 0.95, e) * Math.min(W, H) * (r.portrait ? 0.95 : 1);
    const x = lerp(-0.12 * W, (r.portrait ? 0.56 : 0.62) * W, e), y = lerp(0.02 * H, 0.8 * H, e);
    if (mq > 0.55) speedLines(r, x, y, s * 0.7, 46, 31, C.paper, 0.35 * seg(mq, 0.55, 0.9));
    const dx = ((r.portrait ? 0.56 : 0.62) + 0.12) * W, dy = 0.78 * H;
    mothership(r, x, y, s, 0.26 - e * 0.1, e, dx, dy);
  }
  horizon(r, burn);
}

function drawImpact(r: R, l: number) {
  const ctx = r.ctx, { W, H, u } = r;
  // brennender Himmel hinter dem Feld / burning sky behind the panel
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.skyTop); g.addColorStop(0.5, C.skyBurn); g.addColorStop(1, C.fire);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  sunburst(r, W / 2, H * 0.45, 20, l * 0.08, C.fireHot, 0.12);
  halftone(r, C.ink, 0.3, 9);
  const w = W * 0.94;
  const h = r.portrait ? H * 0.42 : clamp(w / aspectOf(r, CROPS.crash), H * 0.5, H * 0.62);
  const p: Panel = { x: (W - w) / 2, y: H * (r.portrait ? 0.24 : 0.47) - h / 2 + (r.portrait ? h / 2 : 0), w, h, rot: -0.018 };
  const cx = p.x + w * 0.45, cy = p.y + h * 0.45;
  panel(r, CROPS.crash, p, {
    zoom: lerp(1.35, 1.04, easeOutExpo(seg(l, 0, 3))), px: r.portrait ? -0.2 : 0, py: 0.1,
    inner: (b) => {
      const gl = 0.6 * (1 - seg(l, 0.2, 3)) + 0.12;
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(b.w, b.h) * 0.7);
      rg.addColorStop(0, withAlpha(C.fireHot, gl)); rg.addColorStop(0.5, withAlpha(C.fire, gl * 0.5)); rg.addColorStop(1, withAlpha(C.skyBurn, 0));
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rg; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore();
    },
  });
  // Druckwelle / shockwave
  const sq = seg(l, 0, 0.9);
  if (sq > 0 && sq < 1) {
    const rad = easeOutCubic(sq) * Math.max(W, H) * 1.1;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.lineWidth = 50 * u * (1 - sq); ctx.strokeStyle = withAlpha(C.flash, 1 - sq); ctx.stroke();
    ctx.lineWidth = 8 * u * (1 - sq); ctx.strokeStyle = withAlpha(C.ink, 1 - sq);
    ctx.beginPath(); ctx.arc(cx, cy, rad + 30 * u, 0, Math.PI * 2); ctx.stroke();
  }
  // Glut steigt / rising embers
  const er = rng(57);
  for (let i = 0; i < 46; i++) {
    const x0 = er() * W, sp = (0.12 + er() * 0.25) * H, ph = er() * 3, size = (4 + er() * 8) * u;
    const y = H - ((l * sp + ph * H) % (H * 1.1));
    const x = x0 + Math.sin(l * 2 + i) * 30 * u;
    ctx.fillStyle = i % 3 ? C.fire : C.fireHot;
    ctx.fillRect(x, y, size, size);
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = C.ink; ctx.strokeRect(x, y, size, size);
  }
  // KAWUMM / KABOOM: bricht aus dem Feld / breaks out of the panel
  const bp = seg(l, 0.02, 0.24), out = seg(l, 1.8, 2.3);
  if (bp > 0 && out < 1) {
    const size = Math.min(W, H) * (r.portrait ? 0.4 : 0.32);
    ctx.save();
    ctx.translate(r.portrait ? W * 0.3 : W * 0.17, r.portrait ? p.y + 20 * u : p.y + h * 0.12);
    ctx.rotate(-0.12);
    const s = easeOutBack(bp) * (1 + l * 0.04) * (1 - out * 0.3);
    ctx.scale(s, s);
    ctx.globalAlpha = 1 - out;
    burst(r, 0, 0, size, C.accent, 3, 14, 9);
    burstPath(ctx, 0, 0, size * 0.72, size * 0.45, 12, 4);
    ctx.fillStyle = C.flash; ctx.fill();
    const fs = fitSize(r, r.T.boom, 'comic', size * 0.5, size * 1.5);
    inkText(r, r.T.boom, 0, fs * 0.35, fs, 'comic', C.ember, { stroke: 7, shadow: 8, align: 'center' });
    ctx.restore();
  }
}

/** Die Front als Warnstreifen-Band zerbricht in fuenf Teile / the front as a hazard band breaks into five pieces */
function drawFracture(r: R, l: number) {
  const ctx = r.ctx, { W, H, u } = r;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  sunburst(r, W / 2, H / 2, 18, l * 0.15, C.inkSoft, 1);
  halftone(r, C.paper, 0.05, 10);
  // Glockenschlaege als Ringe / bell strikes as rings
  for (const bt of [0, 1]) {
    const q = seg(l, bt, bt + 1.6);
    if (q <= 0 || q >= 1) continue;
    for (let k = 0; k < 3; k++) {
      const qq = clamp(q - k * 0.12);
      ctx.beginPath(); ctx.arc(W / 2, H * 0.12, easeOutCubic(qq) * Math.max(W, H) * 0.9, 0, Math.PI * 2);
      ctx.lineWidth = 6 * u; ctx.strokeStyle = withAlpha(C.paper, (1 - qq) * 0.5); ctx.stroke();
    }
  }
  const band = 120 * u, y0 = H / 2;
  const cuts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((k, i) => (i === 0 || i === 5 ? k * W : k * W + (rng(i)() - 0.5) * 60 * u));
  const reveal = easeOutCubic(seg(l, 0, 0.8));
  const split = easeInOutCubic(seg(l, 2, 3.4));
  const recolor = seg(l, 2.05, 2.5);
  const crack = seg(l, 1.4, 2);
  for (let i = 0; i < 5; i++) {
    const f = HUMANS[i];
    const x0 = cuts[i], x1 = cuts[i + 1], pw = x1 - x0, pcx = (x0 + x1) / 2;
    // Ziel: quer verteilt (Querformat) bzw. untereinander (Hochformat) / target: spread across (landscape) or stacked (portrait)
    const tx = r.portrait ? W / 2 + (i % 2 ? 1 : -1) * W * 0.08 : W * (0.12 + i * 0.19);
    const ty = r.portrait ? H * (0.13 + i * 0.145) : y0 + (i % 2 ? -1 : 1) * 110 * u - 40 * u;
    const ts = r.portrait ? Math.min(2.6, (W * 0.74) / pw) : 0.84;
    const cx = lerp(pcx, tx, split), cy = lerp(y0, ty, split), sc = lerp(1, ts, split);
    const rot = lerp(0, (i - 2) * 0.07 + (i % 2 ? 0.05 : -0.05), split);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
    const hw = pw / 2, hh = band / 2;
    const vis = Math.max(0, Math.min(pw, reveal * W - x0));
    if (split > 0) { ctx.fillStyle = C.ink; ctx.fillRect(-hw + 10 * u * split, -hh + 10 * u * split, pw, band); }
    ctx.save();
    ctx.beginPath(); ctx.rect(-hw, -hh, vis, band); ctx.clip();
    hazard(r, -hw, -hh, pw, band, l * 60);
    if (recolor > 0) { ctx.globalAlpha = recolor; ctx.fillStyle = factionTokens[f].primary; ctx.fillRect(-hw, -hh, pw, band); ctx.globalAlpha = 1; halftone(r, C.ink, 0.15 * recolor, 7, -hw, -hh, pw, band); }
    ctx.restore();
    if (vis > 0) { ctx.lineWidth = 7 * u / sc; ctx.strokeStyle = C.ink; ctx.strokeRect(-hw, -hh, vis, band); }
    const ep = easeOutBack(seg(l, 2.3 + i * 0.08, 2.7 + i * 0.08));
    if (ep > 0) badge(r, f, r.portrait ? -hw * 0.5 : 0, 0, (band * 0.62) * ep / Math.max(1, sc * 0.6));
    const np = seg(l, 2.6 + i * 0.08, 2.9 + i * 0.08);
    if (np > 0) {
      ctx.save(); ctx.globalAlpha = np;
      const name = r.T.factions[f].short.toUpperCase();
      if (r.portrait) { const ink = factionTokens[f].ink; inkText(r, name, hw * 0.02, band * 0.17, Math.min(fitSize(r, name, 'comic', band * 0.42, hw * 0.9), band * 0.42), 'comic', ink, { stroke: 2, align: 'left', strokeColor: ink === C.white ? C.ink : C.paper }); }
      else inkText(r, name, 0, hh + 54 * u, 46 * u, 'comic', C.paper, { stroke: 4, shadow: 4, align: 'center' });
      ctx.restore();
    }
    ctx.restore();
  }
  // Risse / cracks
  if (crack > 0 && split < 0.2) {
    ctx.save(); ctx.globalAlpha = 1 - split * 5;
    for (let i = 1; i < 5; i++) {
      const cr = rng(60 + i);
      ctx.beginPath(); ctx.moveTo(cuts[i], y0 - band * 0.6);
      const n = 6;
      for (let k = 1; k <= n; k++) ctx.lineTo(cuts[i] + (cr() - 0.5) * 40 * u, y0 - band * 0.6 + (band * 1.2 * k * crack) / n);
      ctx.lineWidth = 12 * u; ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.lineWidth = 5 * u; ctx.strokeStyle = C.flash; ctx.stroke();
    }
    ctx.restore();
  }
  speedLines(r, W / 2, y0, Math.min(W, H) * 0.3, 60, 70, C.paper, 0.4 * (seg(l, 2, 2.15) - seg(l, 2.3, 3)));
}

// ---------- Fraktionsauftritt / faction beat ----------

/** Buehne der Motive und die beiden Comic-Felder / stage of the motifs and the two comic panels */
interface Stage { x: number; y: number; w: number; h: number; p1: Panel; p2: Panel }
function factionStage(r: R, f: HumanFaction): Stage {
  const { W, H } = r;
  const A = CROPS[`${f}A` as keyof typeof CROPS], B = CROPS[`${f}B` as keyof typeof CROPS];
  if (r.portrait) {
    const w = W * 0.92, x = W * 0.04;
    const h1 = clamp(w / aspectOf(r, A), H * 0.2, H * 0.24), h2 = clamp(w / aspectOf(r, B), H * 0.2, H * 0.24);
    const top = H * 0.035, gap = H * 0.024;
    if (FLIP.includes(f)) return { x: 0, y: 0, w: W, h: top + h1 + h2 + gap, p1: { x, y: top + h2 + gap, w, h: h1, rot: -0.012 }, p2: { x, y: top, w, h: h2, rot: 0.012 } };
    return { x: 0, y: 0, w: W, h: top + h1 + gap + h2, p1: { x, y: top, w, h: h1, rot: -0.012 }, p2: { x, y: top + h1 + gap, w, h: h2, rot: 0.012 } };
  }
  const w = W * 0.56, x = W * 0.03;
  const h1 = clamp(w / aspectOf(r, A), H * 0.3, H * 0.37), h2 = clamp(w / aspectOf(r, B), H * 0.3, H * 0.37);
  const top = H * 0.05, gap = H * 0.04;
  // Velkar und Alvenia: Feld 1 unten, darueber Platz fuer Satellit bzw. Schild / panel 1 below, room above for satellite or shield
  if (FLIP.includes(f)) return { x: 0, y: 0, w: W * 0.61, h: top + h1 + h2 + gap, p1: { x, y: top + h2 + gap, w, h: h1, rot: -0.014 }, p2: { x: x + W * 0.015, y: top, w, h: h2, rot: 0.012 } };
  return { x: 0, y: 0, w: W * 0.61, h: top + h1 + gap + h2, p1: { x, y: top, w, h: h1, rot: -0.014 }, p2: { x: x + W * 0.015, y: top + h1 + gap, w, h: h2, rot: 0.012 } };
}
const FLIP: HumanFaction[] = ['velkar', 'alvenia'];

function drawFaction(r: R, f: HumanFaction, l: number) {
  const ctx = r.ctx, { W, H, u } = r, ft = factionTokens[f], tx = r.T.factions[f];
  const st = factionStage(r, f);
  const { p1, p2 } = st;
  // Portraet-Position / portrait position
  const pr = r.portrait ? W * 0.15 : Math.min(140 * u, W * 0.085);
  const colX = r.portrait ? 50 * u : W * 0.615;
  const pcx = colX + pr;
  const low = Math.max(p1.y + p1.h, p2.y + p2.h);
  const pcy = r.portrait ? low + pr * 0.3 : 64 * u + pr;
  // Farbfeld mit Strahlen / colour field with rays
  ctx.fillStyle = ft.primary; ctx.fillRect(0, 0, W, H);
  sunburst(r, pcx, pcy, 16, l * 0.12, ft.secondary, 0.22);
  halftone(r, C.ink, 0.16, 9);
  motifBack(r, f, l, st);

  // Comic-Felder: Feld 1 gleitet herein, Feld 2 schlaegt auf Takt 4 ein / comic panels: panel 1 slides in, panel 2 slams in on beat 4
  const a1 = easeOutCubic(seg(l, 0, 0.45));
  panel(r, CROPS[`${f}A` as keyof typeof CROPS], p1, { zoom: lerp(1.02, 1.14, seg(l, 0, 6)), px: lerp(-0.5, 0.5, seg(l, 0, 6)), dx: (a1 - 1) * W * 0.8 });
  const a2 = seg(l, 3.65, 4);
  if (a2 > 0) panel(r, CROPS[`${f}B` as keyof typeof CROPS], p2, { zoom: lerp(1.12, 1.02, seg(l, 4, 6)), px: lerp(0.4, -0.4, seg(l, 4, 6)), scale: lerp(1.35, 1, easeInCubic(a2)), alpha: Math.min(1, a2 * 2.5) });
  motif(r, f, l, st);

  // Portraet / portrait
  const pp = seg(l, 0.15, 0.6);
  if (pp > 0) {
    ctx.save();
    ctx.translate(pcx, pcy);
    const s = easeOutBack(pp);
    ctx.rotate((1 - pp) * -0.3);
    ctx.scale(s, s);
    circlePic(r, r.A.leaders[f], 0, 0, pr, ft.secondary, ft.primary);
    ctx.restore();
  }

  // Name und Anfuehrer / name and leader
  const nx = pcx + pr + 30 * u;
  const nw = W - 50 * u - nx;
  const np = easeOutCubic(seg(l, 0.9, 1.3)), lp = easeOutCubic(seg(l, 1.05, 1.45));
  const maxName = (r.portrait ? 64 : 58) * u;
  let nameLines = [tx.name];
  let nameSize = Math.min(fitSize(r, tx.name, 'display', maxName, nw), maxName);
  if (nameSize < maxName * 0.8) {
    nameLines = wrap(r, tx.name, 'display', maxName, nw);
    // hoechstens zwei Zeilen, ausgewogen geteilt / at most two lines, split evenly
    if (nameLines.length > 2) {
      const words = tx.name.split(' ');
      let best = 1, diff = Infinity;
      for (let k = 1; k < words.length; k++) { const d = Math.abs(words.slice(0, k).join(' ').length - words.slice(k).join(' ').length); if (d < diff) { diff = d; best = k; } }
      nameLines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    nameSize = Math.min(maxName, ...nameLines.map((ln) => fitSize(r, ln, 'display', maxName, nw)));
  }
  const titleSize = Math.max(Math.min(fitSize(r, tx.leaderTitle, 'body', (r.portrait ? 34 : 30) * u, nw), (r.portrait ? 34 : 30) * u), 11);
  const leaderSize = Math.min(fitSize(r, tx.leader, 'comic', (r.portrait ? 64 : 58) * u, nw), (r.portrait ? 64 : 58) * u);
  const blockH = nameSize * (1 + (nameLines.length - 1) * 1.05) + titleSize * 1.5 + leaderSize * 1.1;
  const nameY = r.portrait ? Math.max(low + 34 * u + nameSize * 0.8, pcy - blockH / 2 + nameSize * 0.8) : pcy - blockH / 2 + nameSize * 0.8;
  const titleY = nameY + (nameLines.length - 1) * nameSize * 1.05 + titleSize * 1.55;
  if (np > 0) {
    ctx.save(); ctx.globalAlpha = np; ctx.translate((1 - np) * 80 * u, 0);
    nameLines.forEach((ln, i) => inkText(r, ln, nx, nameY + i * nameSize * 1.05, nameSize, 'display', C.paper, { stroke: 4, shadow: 5 }));
    ctx.restore();
  }
  if (lp > 0) {
    ctx.save(); ctx.globalAlpha = lp; ctx.translate((1 - lp) * 80 * u, 0);
    inkText(r, tx.leaderTitle, nx, titleY, titleSize, 'body', ft.ink);
    inkText(r, tx.leader, nx, titleY + leaderSize * 1.08, leaderSize, 'comic', C.accent, { stroke: 4, shadow: 4 });
    ctx.restore();
  }

  // Kampfansage / kicker
  const kx = colX - (r.portrait ? 0 : 20 * u);
  const kw = W - 50 * u - kx;
  const kicker = tx.kicker.toUpperCase();
  const kSize = fitSize(r, kicker, 'display', (r.portrait ? 132 : 112) * u, kw);
  const ky = Math.max(pcy + pr, titleY + leaderSize * 1.1) + 36 * u + kSize * 0.8;
  const kp2 = seg(l, 0.6, 1);
  if (kp2 > 0) {
    ctx.save();
    ctx.translate(kx + kw / 2, ky - kSize * 0.35);
    ctx.rotate(-0.035);
    const s = lerp(2.2, 1, easeInCubic(kp2));
    ctx.scale(s, s); ctx.globalAlpha = Math.min(1, kp2 * 2);
    inkText(r, kicker, 0, kSize * 0.35, kSize, 'display', C.accent, { stroke: 7, shadow: 9, align: 'center' });
    ctx.restore();
  }

  // Leitspruch als Sprechblase / motto as a speech bubble
  const qSize = (r.portrait ? 46 : 38) * u;
  const qPad = 24 * u;
  const lines = wrap(r, tx.quote, 'body', qSize, kw - qPad * 2);
  const qh = lines.length * qSize * 1.22 + qPad * 1.6;
  const qy = ky + 40 * u;
  const qp = easeOutBack(seg(l, 1.25, 1.6));
  if (qp > 0) {
    ctx.save();
    ctx.translate(kx, qy);
    ctx.scale(qp, qp);
    // Sprechblase mit Zipfel zum Portraet / bubble with a tail towards the portrait
    const tailX = Math.min(kw * 0.3, pcx - kx + pr * 0.2);
    ctx.fillStyle = C.ink; roundRect(ctx, 8 * u, 8 * u, kw, qh, 18 * u); ctx.fill();
    roundRect(ctx, 0, 0, kw, qh, 18 * u); ctx.fillStyle = C.paper; ctx.fill();
    ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.stroke();
    poly(ctx, [[tailX - 26 * u, 3 * u], [tailX - 4 * u, -34 * u], [tailX + 18 * u, 3 * u]]);
    ctx.fillStyle = C.paper; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tailX - 26 * u, 0); ctx.lineTo(tailX - 4 * u, -34 * u); ctx.lineTo(tailX + 18 * u, 0); ctx.stroke();
    // Zeilen mit Tuschestrich enthuellen / reveal lines with an ink stroke
    const rp = seg(l, 1.35, 2.35) * lines.length;
    ctx.font = font('body', qSize); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = C.ink;
    lines.forEach((line, i) => {
      const q = clamp(rp - i);
      if (q <= 0) return;
      const ly = qPad + qSize * 0.95 + i * qSize * 1.22;
      ctx.save();
      ctx.beginPath(); ctx.rect(qPad - 4 * u, ly - qSize, (kw - qPad * 2 + 8 * u) * q, qSize * 1.3); ctx.clip();
      ctx.fillText(line, qPad, ly);
      ctx.restore();
    });
    ctx.restore();
  }

  // Stempel mit dem Kampfstil / stamp with the combat style
  const sp = seg(l, 1.8, 2);
  if (sp > 0) {
    const tag = tx.tag.toUpperCase();
    const maxS = (r.portrait ? 60 : 50) * u;
    const ss = Math.min(fitSize(r, tag, 'display', maxS, kw * 0.8), maxS);
    ctx.font = font('display', ss);
    const tw = ctx.measureText(tag).width;
    const bw = tw + 52 * u, bh = ss + 40 * u;
    const sx = kx + kw - bw / 2 - 10 * u;
    const sy = qy + qh + 44 * u + bh / 2;
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(-0.07);
    const s = lerp(2.4, 1, easeInCubic(sp));
    ctx.scale(s, s); ctx.globalAlpha = Math.min(1, sp * 2);
    ctx.fillStyle = C.ink; ctx.fillRect(-bw / 2 + 7 * u, -bh / 2 + 7 * u, bw, bh);
    ctx.fillStyle = C.paper; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.lineWidth = 6 * u; ctx.strokeStyle = C.stamp; ctx.strokeRect(-bw / 2 + 5 * u, -bh / 2 + 5 * u, bw - 10 * u, bh - 10 * u);
    ctx.lineWidth = 2.5 * u; ctx.strokeRect(-bw / 2 + 14 * u, -bh / 2 + 14 * u, bw - 28 * u, bh - 28 * u);
    ctx.fillStyle = C.stamp; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tag, 0, 2 * u);
    ctx.restore();
  }
}

// ---------- Motive je Fraktion / motifs per faction ----------
/** Motive hinter den Feldern (Speedlines) / motifs behind the panels (speed lines) */
function motifBack(r: R, f: HumanFaction, l: number, a: Stage) {
  const ctx = r.ctx, u = r.u;
  if (f === 'korvat' && l > 1.6) {
    const sr = rng(300 + Math.floor(l * 14));
    ctx.fillStyle = withAlpha(factionTokens.korvat.secondary, 0.7);
    for (let i = 0; i < 30; i++) { const y = a.y + sr() * a.h, len = (0.2 + sr() * 0.5) * a.w, x = sr() * a.w - len * 0.3; ctx.fillRect(x, y, len, (2 + sr() * 5) * u); }
  }
}

function motif(r: R, f: HumanFaction, l: number, a: Stage) {
  switch (f) {
    case 'korvat': return motifKorvat(r, l, a);
    case 'alvenia': return motifAlvenia(r, l, a);
    case 'dravon': return motifDravon(r, l, a);
    case 'velkar': return motifVelkar(r, l, a);
    case 'meridon': return motifMeridon(r, l, a);
  }
}

/** Reiter-Silhouette (Box 100 x 70) / rider silhouette (box 100 x 70) */
function rider(r: R, x: number, y: number, s: number, phase: number, pennant: string) {
  const ctx = r.ctx;
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Beine im Galopp / legs at a gallop
  ctx.lineWidth = 5;
  const leg = (hx: number, hy: number, a: number) => { ctx.beginPath(); ctx.moveTo(hx, hy); const kx = hx + Math.sin(a) * 11, ky = hy + Math.cos(a) * 11; ctx.lineTo(kx, ky); ctx.lineTo(kx + Math.sin(a * 1.6 - 0.4) * 11, ky + Math.cos(a * 1.6 - 0.4) * 11); ctx.stroke(); };
  leg(70, 42, 0.9 * Math.sin(phase));
  leg(65, 43, 0.9 * Math.sin(phase + 0.7));
  leg(33, 42, -0.9 * Math.sin(phase + 1.9));
  leg(28, 41, -0.9 * Math.sin(phase + 2.6));
  // Koerper, Hals, Kopf mit Maul, Ohren, Schweif / body, neck, head with muzzle, ears, tail
  ctx.beginPath(); ctx.ellipse(50, 36, 27, 11.5, -0.05, 0, Math.PI * 2); ctx.fill();
  poly(ctx, [[64, 30], [76, 15], [84, 12], [80, 26], [76, 38]]); ctx.fill();
  poly(ctx, [[76, 12], [84, 8], [97, 18], [97, 23], [91, 24], [82, 20]]); ctx.fill();
  poly(ctx, [[80, 10], [79, 3], [84, 8]]); ctx.fill();
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(24, 31); ctx.quadraticCurveTo(14, 30 + Math.sin(phase) * 3, 7, 41); ctx.stroke();
  // Reiter mit Lanze und Wimpel / rider with lance and pennant
  poly(ctx, [[45, 28], [50, 9], [59, 9], [58, 29]]); ctx.fill();
  ctx.beginPath(); ctx.arc(55, 3, 5.5, 0, Math.PI * 2); ctx.fill();
  poly(ctx, [[48, 0], [62, -1], [56, -6]]); ctx.fill();
  ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(36, 30); ctx.lineTo(108, -14); ctx.stroke();
  poly(ctx, [[99, -9], [80, -8 + Math.sin(phase * 2) * 3], [94, 0]]);
  ctx.fillStyle = pennant; ctx.fill(); ctx.lineWidth = 1.8; ctx.stroke();
  ctx.restore();
}

function motifKorvat(r: R, l: number, a: Stage) {
  const ctx = r.ctx, { u } = r;
  if (l < 1.6) return;
  // Reiterwelle quer ueber beide Felder / wave of riders across both panels
  const rr = rng(311);
  const ground = a.p2.y + a.p2.h * 0.96;
  for (let i = 0; i < 6; i++) {
    const depth = 1 - i / 6 * 0.6 - rr() * 0.1;
    const size = (r.portrait ? 0.34 : 0.27) * a.w * depth;
    const speed = (0.4 + depth * 0.25) * a.w;
    const x = -size * 1.1 - i * a.w * 0.12 + (l - 1.6) * speed;
    const y = ground - size * 0.62 - (1 - depth) * a.p2.h * 0.5 + Math.sin(l * 14 + i) * 4 * u;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(x + size * (0.15 - k * 0.2), y + size * (0.62 - k * 0.03), size * (0.14 + k * 0.06), size * (0.05 + k * 0.02), 0, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(C.dust, 0.85 - k * 0.25); ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = withAlpha(C.ink, 0.7 - k * 0.2); ctx.stroke();
    }
    rider(r, x, y, size, l * 15 + i, factionTokens.korvat.primary);
  }
}

function motifAlvenia(r: R, l: number, a: Stage) {
  const ctx = r.ctx, { u } = r;
  const q = easeOutBack(seg(l, 1.9, 2.5));
  if (q <= 0) return;
  const p = a.p1;
  const cx = p.x + p.w * 0.5, cy = p.y + p.h;
  const rx = p.w * 0.47, ry = Math.min(p.h * 1.7, p.y + p.h - 24 * u) * q;
  const hits = [2.6, 3.2, 4.4, 5];
  let flare = 0;
  for (const h of hits) { const d = l - h; if (d >= 0 && d < 0.4) flare = Math.max(flare, 1 - d / 0.4); }
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.closePath();
  ctx.fillStyle = withAlpha(C.shield, 0.25 + flare * 0.25); ctx.fill();
  ctx.save(); ctx.clip();
  const hs = 46 * u;
  ctx.lineWidth = 2.5 * u; ctx.strokeStyle = withAlpha(C.shieldCore, 0.5 + flare * 0.4);
  ctx.beginPath();
  for (let yy = cy - ry; yy < cy; yy += hs * 0.87) {
    const row = Math.round((yy - cy) / (hs * 0.87));
    for (let xx = cx - rx - hs; xx < cx + rx + hs; xx += hs * 1.5) {
      const ox = xx + (row % 2 ? hs * 0.75 : 0);
      for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2, an2 = ((k + 1) / 6) * Math.PI * 2; ctx.moveTo(ox + Math.cos(an) * hs * 0.5, yy + Math.sin(an) * hs * 0.5); ctx.lineTo(ox + Math.cos(an2) * hs * 0.5, yy + Math.sin(an2) * hs * 0.5); }
    }
  }
  ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
  ctx.lineWidth = 16 * u; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.lineWidth = 8 * u; ctx.strokeStyle = C.shield; ctx.stroke();
  ctx.lineWidth = 3 * u; ctx.strokeStyle = C.shieldCore; ctx.stroke();
  ctx.restore();
  // Granaten prallen ab / shells bounce off
  hits.forEach((h, i) => {
    const ang = Math.PI * (1.3 + i * 0.12);
    const hx = cx + Math.cos(ang) * rx, hy = cy + Math.sin(ang) * ry;
    const inc = seg(l, h - 0.25, h);
    if (inc > 0 && inc < 1) {
      const sx = hx + p.w * 0.4 * (1 - inc), sy = hy - ry * 0.5 * (1 - inc);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + p.w * 0.06, sy - p.h * 0.09);
      ctx.lineWidth = 10 * u; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.lineWidth = 5 * u; ctx.strokeStyle = C.tracer; ctx.stroke();
    }
    const sp = seg(l, h, h + 0.35);
    if (sp > 0 && sp < 1) { ctx.save(); ctx.globalAlpha = 1 - sp; burst(r, hx, hy, (44 + sp * 50) * u, C.accent, 500 + i, 9, 4); ctx.restore(); }
  });
}

function motifDravon(r: R, l: number, a: Stage) {
  const ctx = r.ctx, { u } = r;
  const hp = easeOutCubic(seg(l, 1.8, 2.1));
  if (hp <= 0) return;
  const p = a.p1, q = a.p2;
  // Warnband ueber Feld 1 / hazard tape across panel 1
  const hb = 34 * u;
  ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h); ctx.rotate(-0.03);
  hazard(r, -p.w / 2 - 30 * u - (1 - hp) * r.W, -hb / 2, p.w + 60 * u, hb, l * 80);
  ctx.restore();
  if (l < 4) {
    // Geschuetzstellung und Fadenkreuz / gun emplacement and crosshair
    const gx = p.x + p.w * (r.portrait ? 0.78 : 0.14), gy = q.y + q.h * 0.62;
    const gs = 1.6;
    const targets = [[0.62, 0.45], [0.42, 0.55], [0.75, 0.35]];
    const k = l < 2.8 ? 0 : l < 3.4 ? 1 : 2;
    const prev = targets[Math.max(0, k - 1)], cur = targets[k];
    const t0 = k === 0 ? 1.9 : k === 1 ? 2.8 : 3.4;
    const m = easeInOutCubic(seg(l, t0, t0 + 0.3));
    const rx = p.x + p.w * lerp(prev[0], cur[0], m), ry = p.y + p.h * lerp(prev[1], cur[1], m);
    const ang = Math.atan2(ry - gy, rx - gx);
    const mx = gx + Math.cos(ang) * 150 * u * gs, my = gy - 20 * u * gs + Math.sin(ang) * 150 * u * gs;
    for (const ft of [2.5, 3.1]) {
      for (let i = 0; i < 4; i++) {
        const qq = seg(l, ft + i * 0.075, ft + i * 0.075 + 0.16);
        if (qq <= 0 || qq >= 1) continue;
        const x1 = lerp(mx, rx, qq), y1 = lerp(my, ry, qq), x0 = lerp(mx, rx, Math.max(0, qq - 0.25)), y0 = lerp(my, ry, Math.max(0, qq - 0.25));
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.lineCap = 'round'; ctx.lineWidth = 11 * u; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.lineWidth = 5 * u; ctx.strokeStyle = C.tracer; ctx.stroke();
      }
      const fl = seg(l, ft, ft + 0.35);
      if (fl > 0 && fl < 1) { burst(r, mx, my, 50 * u * (1 - fl * 0.5), C.fireHot, 700 + Math.floor(l * 20), 8, 4); burst(r, rx, ry, 56 * u * fl, C.fire, 720, 9, 4); }
    }
    // Rohr und Sandsaecke / barrel and sandbags
    ctx.save(); ctx.translate(gx, gy - 20 * u * gs); ctx.rotate(ang); ctx.scale(gs, gs);
    ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.inkMuted; ctx.fillRect(0, -11 * u, 150 * u, 22 * u); ctx.strokeRect(0, -11 * u, 150 * u, 22 * u);
    ctx.fillStyle = C.ink; ctx.fillRect(132 * u, -15 * u, 22 * u, 30 * u);
    ctx.restore();
    // Schutzschild und Sandsaecke / gun shield and sandbags
    ctx.save(); ctx.translate(gx, gy); ctx.scale(gs, gs);
    poly(ctx, [[-50 * u, -10 * u], [-40 * u, -62 * u], [40 * u, -62 * u], [50 * u, -10 * u]]);
    ctx.fillStyle = factionTokens.dravon.primary; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.stroke();
    halftone(r, C.ink, 0.3, 6, -50 * u, -62 * u, 100 * u, 52 * u);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 6 - row; i++) {
      ctx.beginPath(); ctx.ellipse(-112 * u + i * 45 * u + row * 22 * u, 10 * u - row * 26 * u, 30 * u, 17 * u, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.dust; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.stroke();
    }
    ctx.restore();
    // Fadenkreuz / crosshair
    ctx.save(); ctx.translate(rx, ry);
    ctx.lineWidth = 11 * u; ctx.strokeStyle = C.ink;
    ctx.beginPath(); ctx.arc(0, 0, 60 * u, 0, Math.PI * 2); ctx.moveTo(-95 * u, 0); ctx.lineTo(-30 * u, 0); ctx.moveTo(95 * u, 0); ctx.lineTo(30 * u, 0); ctx.moveTo(0, -95 * u); ctx.lineTo(0, -30 * u); ctx.moveTo(0, 95 * u); ctx.lineTo(0, 30 * u); ctx.stroke();
    ctx.lineWidth = 4.5 * u; ctx.strokeStyle = C.mine; ctx.stroke();
    ctx.restore();
  } else {
    // Minenfeld vor Feld 2 / minefield in front of panel 2
    const mr = rng(808);
    for (let i = 0; i < 7; i++) {
      const mx = q.x + q.w * (0.1 + (i / 6) * 0.8 + (mr() - 0.5) * 0.05), my = q.y + q.h * (0.72 + (i % 2) * 0.16);
      const pop = easeOutBack(seg(l, 4.05 + i * 0.06, 4.3 + i * 0.06));
      if (pop <= 0) continue;
      const boom = i === 3 ? seg(l, 5, 5.5) : 0;
      if (boom > 0) {
        ctx.save(); ctx.globalAlpha = 1 - boom * 0.6;
        burst(r, mx, my - 40 * u * boom, (60 + boom * 130) * u, C.fire, 810, 12, 6);
        burst(r, mx, my - 40 * u * boom, (30 + boom * 65) * u, C.fireHot, 811, 10, 3);
        ctx.restore();
        continue;
      }
      const ms = 32 * u * pop;
      ctx.beginPath(); ctx.ellipse(mx, my, ms * 1.4, ms * 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx, my - ms * 0.2, ms * 1.2, ms * 0.7, 0, Math.PI, 0); ctx.fillStyle = C.inkMuted; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.stroke();
      const on = Math.floor(l * 4 + i) % 2 === 0;
      ctx.beginPath(); ctx.arc(mx, my - ms * 0.75, ms * 0.28, 0, Math.PI * 2); ctx.fillStyle = on ? C.mine : C.ink; ctx.fill();
      if (on) { ctx.beginPath(); ctx.arc(mx, my - ms * 0.75, ms * 0.7, 0, Math.PI * 2); ctx.fillStyle = withAlpha(C.mine, 0.35); ctx.fill(); }
    }
  }
}

function satellite(r: R, x: number, y: number, s: number) {
  const ctx = r.ctx, u = r.u;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08);
  ctx.lineWidth = 6 * u; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round';
  ctx.fillStyle = C.ink; ctx.fillRect(-s * 1.25 + 9 * u, -s * 0.22 + 9 * u, s * 2.5, s * 0.44);
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * s * 0.3, 0); ctx.lineTo(side * s * 0.45, 0); ctx.stroke();
    const px = side < 0 ? -s * 1.25 : s * 0.45;
    ctx.fillStyle = C.ice; ctx.fillRect(px, -s * 0.22, s * 0.8, s * 0.44); ctx.strokeRect(px, -s * 0.22, s * 0.8, s * 0.44);
    ctx.lineWidth = 3 * u; ctx.beginPath();
    for (let k = 1; k < 4; k++) { ctx.moveTo(px + (k * s * 0.8) / 4, -s * 0.22); ctx.lineTo(px + (k * s * 0.8) / 4, s * 0.22); }
    ctx.moveTo(px, 0); ctx.lineTo(px + s * 0.8, 0); ctx.stroke(); ctx.lineWidth = 6 * u;
  }
  ctx.fillStyle = C.inkMuted; ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6); ctx.strokeRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6);
  ctx.fillStyle = factionTokens.velkar.secondary; ctx.fillRect(-s * 0.18, -s * 0.18, s * 0.36, s * 0.36); ctx.strokeRect(-s * 0.18, -s * 0.18, s * 0.36, s * 0.36);
  ctx.beginPath(); ctx.ellipse(0, s * 0.42, s * 0.24, s * 0.11, 0, 0, Math.PI * 2); ctx.fillStyle = C.ice; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, s * 0.42, s * 0.06, 0, Math.PI * 2); ctx.fillStyle = Math.floor(r.t * 6) % 2 ? C.laser : C.laserCore; ctx.fill();
  ctx.restore();
}

function motifVelkar(r: R, l: number, a: Stage) {
  const ctx = r.ctx, { u } = r;
  const enter = easeOutCubic(seg(l, 1.8, 3));
  if (enter <= 0) return;
  const p = a.p1, q = a.p2;
  const s = (r.portrait ? 0.12 : 0.1) * a.w;
  const leave = easeInCubic(seg(l, 4.3, 5));
  const sx = lerp(p.x + p.w * 1.2, p.x + p.w * 0.68, enter) + leave * a.w, sy = lerp(-s * 2, Math.max(s * 0.7, p.y - s * 1.1), enter) - leave * s * 3 + Math.sin(l * 2) * 6 * u;
  const tx = p.x + p.w * 0.36, ty = p.y + p.h * 0.82;
  const ch = seg(l, 2.5, 3.5);
  if (ch > 0 && ch < 1) for (let k = 0; k < 3; k++) {
    const qq = (ch * 2 + k / 3) % 1;
    ctx.beginPath(); ctx.arc(sx, sy + s * 0.42, s * 1.4 * (1 - qq), 0, Math.PI * 2);
    ctx.lineWidth = 7 * u; ctx.strokeStyle = withAlpha(C.laser, qq); ctx.stroke();
  }
  const bp = seg(l, 3.5, 4.5);
  if (bp > 0 && bp < 1) {
    const grow = easeOutExpo(seg(l, 3.5, 3.6));
    const wob = 1 + Math.sin(l * 90) * 0.12;
    const bw = 36 * u * wob * (1 - seg(bp, 0.7, 1));
    const ex = lerp(sx, tx, grow), ey = lerp(sy, ty, grow);
    for (const [w, col] of [[bw + 18 * u, C.ink], [bw, C.laser], [bw * 0.4, C.laserCore]] as [number, string][]) {
      ctx.beginPath(); ctx.moveTo(sx, sy + s * 0.45); ctx.lineTo(ex, ey); ctx.lineCap = 'round'; ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
    }
    if (grow >= 1) {
      burst(r, tx, ty, (100 + Math.sin(l * 40) * 12) * u * (1 - bp * 0.4), C.laser, 900 + Math.floor(l * 15), 12, 6);
      burst(r, tx, ty, 54 * u, C.laserCore, 901, 10, 3);
    }
  }
  const sw = seg(l, 3.6, 4.6);
  if (sw > 0 && sw < 1) {
    ctx.beginPath(); ctx.ellipse(tx, ty, sw * p.w * 0.6, sw * p.w * 0.12, 0, 0, Math.PI * 2);
    ctx.lineWidth = 24 * u * (1 - sw); ctx.strokeStyle = withAlpha(C.laser, 1 - sw); ctx.stroke();
  }
  // Energieringe ueber dem Reaktor / energy rings over the reactor
  if (l >= 4) for (let k = 0; k < 3; k++) {
    const qq = ((l - 4) * 0.8 + k / 3) % 1;
    ctx.beginPath(); ctx.ellipse(q.x + q.w * 0.5, q.y + q.h * 0.55, qq * q.w * 0.45, qq * q.h * 0.3, 0, 0, Math.PI * 2);
    ctx.lineWidth = 9 * u; ctx.strokeStyle = withAlpha(C.laser, (1 - qq) * 0.85); ctx.stroke();
  }
  satellite(r, sx, sy, s);
}

function ship(r: R, x: number, y: number, s: number, roll: number) {
  const ctx = r.ctx, u = r.u;
  ctx.save(); ctx.translate(x, y); ctx.rotate(roll);
  ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round';
  // Masten / masts
  ctx.fillStyle = C.ink;
  ctx.fillRect(-s * 0.2, -s * 0.95, s * 0.035, s * 0.95); ctx.fillRect(s * 0.15, -s * 0.8, s * 0.03, s * 0.8);
  // Segel / sails
  const sail = (mx: number, top: number, h: number, w: number) => {
    ctx.beginPath(); ctx.moveTo(mx, top); ctx.quadraticCurveTo(mx + w * 1.25, top + h * 0.5, mx, top + h); ctx.closePath();
    ctx.fillStyle = C.sail; ctx.fill(); ctx.stroke();
  };
  sail(-s * 0.18, -s * 0.9, s * 0.4, s * 0.32); sail(-s * 0.18, -s * 0.46, s * 0.36, s * 0.38);
  sail(s * 0.165, -s * 0.74, s * 0.32, s * 0.28); sail(s * 0.165, -s * 0.38, s * 0.3, s * 0.32);
  // Wimpel / pennant
  poly(ctx, [[-s * 0.18, -s * 0.95], [-s * 0.42, -s * 0.9 + Math.sin(r.t * 9) * s * 0.02], [-s * 0.18, -s * 0.86]]);
  ctx.fillStyle = factionTokens.meridon.secondary; ctx.fill(); ctx.stroke();
  // Rumpf / hull
  poly(ctx, [[-s * 0.6, -s * 0.06], [s * 0.62, -s * 0.12], [s * 0.42, s * 0.18], [-s * 0.45, s * 0.18]]);
  ctx.fillStyle = C.wood; ctx.fill(); ctx.stroke();
  ctx.fillStyle = factionTokens.meridon.primary; ctx.fillRect(-s * 0.5, -s * 0.02, s * 1.0, s * 0.06);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-s * 0.3 + i * s * 0.2, s * 0.08, s * 0.03, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill(); }
  ctx.restore();
}

function waves(r: R, x0: number, w: number, bottom: number, l: number, top: number, part: 1 | 2) {
  const ctx = r.ctx, u = r.u;
  const all: [string, number, number][] = [[C.seaDeep, 0, 0.9], [C.sea, 0.35, 1.3], [C.seaLight, 0.7, 1.8]];
  const layers = part === 1 ? all.slice(0, 1) : all.slice(1);
  layers.forEach(([col, off, sp], k) => {
    const y0 = top + k * 28 * u;
    ctx.beginPath(); ctx.moveTo(x0, bottom);
    for (let x = 0; x <= w + 20 * u; x += 20 * u) ctx.lineTo(x0 + x, y0 + Math.sin(x / (70 * u) + l * sp * 2 + off * 6) * 13 * u);
    ctx.lineTo(x0 + w, bottom); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = C.ink; ctx.stroke();
  });
}

function motifMeridon(r: R, l: number, a: Stage) {
  const ctx = r.ctx, { u } = r;
  const q = a.p2;
  if (l < 4) {
    const e = easeOutCubic(seg(l, 1.8, 3.6));
    if (e <= 0) return;
    const top = q.y + q.h * 0.62;
    const s = (r.portrait ? 0.36 : 0.32) * a.w;
    const x = lerp(-s, q.x + q.w * 0.45, e), y = top - s * 0.05 + Math.sin(l * 3) * 8 * u;
    waves(r, 0, a.w, q.y + q.h + 20 * u, l, top - 20 * u, 1);
    ship(r, x, y, s, Math.sin(l * 3 + 0.5) * 0.05);
    const cp = seg(l, 3, 3.5);
    if (cp > 0 && cp < 1) {
      burst(r, x + s * 0.55, y + s * 0.05, 44 * u * (1 - cp * 0.3), C.fireHot, 1000, 8, 3);
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + s * (0.62 + cp * 0.3 + k * 0.12), y - k * 10 * u, (22 + cp * 40) * u * (1 - k * 0.2), 0, Math.PI * 2); ctx.fillStyle = withAlpha(C.smokeLight, 1 - cp); ctx.fill(); }
    }
    waves(r, 0, a.w, q.y + q.h + 20 * u, l, top + s * 0.12, 2);
  } else {
    // Goldregen vor Feld 2 / shower of gold in front of panel 2
    const cr = rng(1200);
    const ox = q.x + q.w * 0.5, oy = q.y + q.h * 0.95;
    for (let i = 0; i < 24; i++) {
      const t0 = 4 + cr() * 0.7, vx = (cr() - 0.5) * q.w * 1.2, vy = -(0.9 + cr() * 0.6) * q.h * 2.4, sz = (24 + cr() * 18) * u, spin = 4 + cr() * 8;
      const d = l - t0;
      if (d < 0) continue;
      const x = ox + vx * d, y = oy + vy * d + 0.5 * q.h * 5.5 * d * d;
      const sx = Math.abs(Math.cos(d * spin)) + 0.08;
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
      ctx.beginPath(); ctx.arc(0, 0, sz, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill();
      ctx.lineWidth = 5 * u / sx; ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, sz * 0.62, 0, Math.PI * 2); ctx.lineWidth = 3 * u / sx; ctx.strokeStyle = C.goldDark; ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------- Banner und Logo / banners and logo ----------

function drawBanners(r: R, l: number) {
  const ctx = r.ctx, { W, H, u } = r;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  sunburst(r, W / 2, H * 0.45, 20, l * 0.1, C.inkSoft, 1);
  halftone(r, C.paper, 0.05, 10);
  const n = HUMANS.length;
  const gap = (r.portrait ? 16 : 30) * u;
  const bw = r.portrait ? (W - 70 * u - gap * (n - 1)) / n : Math.min(W * 0.14, 270 * u);
  const bh = r.portrait ? H * 0.56 : H * 0.66;
  const total = n * bw + (n - 1) * gap;
  const x0 = (W - total) / 2, poleY = r.portrait ? H * 0.16 : H * 0.13;
  // Stange / pole
  const pq = easeOutCubic(seg(l, 0, 0.3));
  ctx.fillStyle = C.ink; ctx.fillRect(W / 2 - (total / 2 + 40 * u) * pq, poleY - 14 * u, (total + 80 * u) * pq, 22 * u);
  ctx.fillStyle = C.goldDark; ctx.fillRect(W / 2 - (total / 2 + 40 * u) * pq, poleY - 10 * u, (total + 80 * u) * pq, 8 * u);
  HUMANS.forEach((f, i) => {
    const ft = factionTokens[f];
    const q = easeOutBack(seg(l, 0.15 + i * 0.12, 0.75 + i * 0.12));
    if (q <= 0) return;
    const bx = x0 + i * (bw + gap), h = bh * q;
    const wave = (y: number) => Math.sin(y / (bh * 0.25) - l * 4 - i) * 7 * u * (y / bh);
    const notch = bw * 0.28;
    const pts: number[][] = [];
    for (let k = 0; k <= 10; k++) { const y = (k / 10) * (h - notch); pts.push([bx + wave(y), poleY + y]); }
    pts.push([bx + bw / 2 + wave(h), poleY + h - notch * 0.2 - notch]);
    for (let k = 10; k >= 0; k--) { const y = (k / 10) * (h - notch); pts.push([bx + bw + wave(y), poleY + y + (k === 10 ? notch : 0)]); }
    pts[10][1] += notch;
    // Schatten / shadow
    ctx.save(); ctx.translate(9 * u, 9 * u); poly(ctx, pts); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
    poly(ctx, pts); ctx.fillStyle = ft.primary; ctx.fill();
    ctx.save(); ctx.clip();
    halftone(r, C.ink, 0.12, 7, bx - 20 * u, poleY, bw + 40 * u, bh);
    ctx.lineWidth = 22 * u; ctx.strokeStyle = ft.secondary; poly(ctx, pts); ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 6 * u; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; poly(ctx, pts); ctx.stroke();
    // Inhalt / content
    const cx = bx + bw / 2;
    const ep = seg(l, 0.6 + i * 0.12, 0.9 + i * 0.12);
    if (ep > 0) {
      ctx.save(); ctx.globalAlpha = ep;
      const em = r.A.emblems[f], es = bw * 0.5;
      if (em) ctx.drawImage(em.img, cx - es / 2 + wave(bh * 0.18), poleY + bh * 0.08, es, es);
      circlePic(r, r.A.leaders[f], cx + wave(bh * 0.5), poleY + bh * 0.47, bw * 0.33, ft.secondary, ft.primary);
      const name = r.T.factions[f].short.toUpperCase();
      const ns = fitSize(r, name, 'comic', 46 * u, bw * 0.8);
      inkText(r, name, cx + wave(bh * 0.75), poleY + bh * 0.76, ns, 'comic', ft.ink, { align: 'center', stroke: ft.ink === C.white ? 3 : 0 });
      ctx.restore();
    }
  });
  speedLines(r, W / 2, H * 0.45, Math.min(W, H) * 0.45, 50, 90, C.paper, 0.3 * (seg(l, 0, 0.1) - seg(l, 0.2, 0.8)));
}

function drawLogo(r: R, l: number) {
  const ctx = r.ctx, { W, H, u } = r;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  sunburst(r, W / 2, H * 0.45, 24, -l * 0.06, C.accent, 0.1);
  halftone(r, C.paper, 0.05, 10);
  const hb = (r.portrait ? 60 : 70) * u, hq = easeOutCubic(seg(l, 0, 0.35));
  hazard(r, -W + W * hq, 0, W, hb, l * 40, 42);
  hazard(r, W - W * hq, H - hb, W, hb, -l * 40, 42);
  const cy = H * (r.portrait ? 0.44 : 0.46);
  const title = r.T.logo.toUpperCase();
  const size = fitSize(r, title, 'display', (r.portrait ? 170 : 240) * u, W * 0.86);
  // Tuscheklecks / ink splash
  const sp = easeOutBack(seg(l, 0.12, 0.4));
  if (sp > 0) burst(r, W / 2, cy - size * 0.3, Math.min(W * 0.46, H * 0.36) * sp, C.stamp, 1300, 16, 8);
  const lp = seg(l, 0, 0.22);
  if (lp > 0) {
    ctx.save();
    ctx.translate(W / 2, cy); ctx.rotate(-0.05);
    const s = lerp(3, 1, easeInCubic(lp)) * (1 + seg(l, 0.3, 6) * 0.04);
    ctx.scale(s, s); ctx.globalAlpha = Math.min(1, lp * 3);
    inkText(r, title, 0, 0, size, 'display', C.accent, { stroke: 10, shadow: 14, align: 'center' });
    ctx.restore();
  }
  // Leitsatz als Stempel / tagline as a stamp
  const tp = seg(l, 1.3, 1.5);
  if (tp > 0) {
    const tag = r.T.tagline.toUpperCase();
    const ts = fitSize(r, tag, 'display', (r.portrait ? 72 : 76) * u, W * 0.7);
    ctx.font = font('display', ts);
    const tw = ctx.measureText(tag).width, bw = tw + 70 * u, bh = ts + 52 * u;
    ctx.save();
    ctx.translate(W / 2, cy + size * 0.32 + 60 * u + bh / 2); ctx.rotate(-0.035);
    const s = lerp(2.4, 1, easeInCubic(tp));
    ctx.scale(s, s); ctx.globalAlpha = Math.min(1, tp * 2);
    ctx.fillStyle = C.ink; ctx.fillRect(-bw / 2 + 8 * u, -bh / 2 + 8 * u, bw, bh);
    ctx.fillStyle = C.paper; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.lineWidth = 7 * u; ctx.strokeStyle = C.stamp; ctx.strokeRect(-bw / 2 + 6 * u, -bh / 2 + 6 * u, bw - 12 * u, bh - 12 * u);
    ctx.lineWidth = 3 * u; ctx.strokeRect(-bw / 2 + 17 * u, -bh / 2 + 17 * u, bw - 34 * u, bh - 34 * u);
    ctx.fillStyle = C.stamp; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tag, 0, 3 * u);
    ctx.restore();
  }
  // Abzeichen der fuenf Fraktionen / badges of the five factions
  const br = (r.portrait ? 70 : 54) * u, gap = br * (r.portrait ? 2.45 : 2.7);
  const by = r.portrait ? H * 0.66 : H * 0.8;
  HUMANS.forEach((f, i) => {
    const q = easeOutBack(seg(l, 2 + i * 0.1, 2.35 + i * 0.1));
    if (q <= 0) return;
    ctx.save(); ctx.translate(W / 2 + (i - 2) * gap, by); ctx.scale(q, q);
    badge(r, f, 0, 0, br);
    ctx.restore();
  });
}

// ---------- Untertitel / subtitles ----------
function drawSubtitle(r: R, t: number) {
  const s = SUBTITLES.find((x) => t >= x.start && t < x.end);
  if (!s) return;
  const text = r.T.subs[s.key];
  if (!text) return;
  const ctx = r.ctx, u = r.u;
  const a = Math.min(seg(t, s.start, s.start + 0.2), 1 - seg(t, s.end - 0.2, s.end));
  const size = Math.max(46 * u, 15);
  const maxW = r.portrait ? r.W - 110 * u : Math.min(r.W * 0.78, 1500 * u);
  const lines = wrap(r, text, 'body', size, maxW);
  const lh = size * 1.28, padX = 30 * u, padY = 18 * u;
  ctx.font = font('body', size);
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const bw = tw + padX * 2, bh = lines.length * lh + padY * 2;
  const bx = (r.W - bw) / 2, by = r.H - (r.portrait ? 110 : 56) * u - bh + (1 - a) * 12 * u;
  ctx.save();
  ctx.globalAlpha = a;
  roundRect(ctx, bx, by, bw, bh, 14 * u); ctx.fillStyle = withAlpha(C.subtitleBg, 0.86); ctx.fill();
  ctx.lineWidth = 3 * u; ctx.strokeStyle = withAlpha(C.hazard, 0.9); ctx.stroke();
  ctx.fillStyle = C.subtitleInk; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, r.W / 2, by + padY + size * 0.98 + i * lh));
  ctx.restore();
}

// ---------- Szene zeichnen / draw a scene ----------
function drawScene(r: R, index: number, t: number) {
  const s = SCENES[index];
  const l = t - s.start;
  switch (s.id) {
    case 'standstill': return drawStandstill(r, l);
    case 'starfall': return drawStarfall(r, l);
    case 'impact': return drawImpact(r, l);
    case 'fracture': return drawFracture(r, l);
    case 'banners': return drawBanners(r, l);
    case 'logo': return drawLogo(r, l);
    default: return drawFaction(r, s.id, l);
  }
}

const WIPE = 0.42;
/** Wischblende: Szene mit Wischblende aus der vorherigen / wipe: scene that wipes in from the previous one */
const wipes = (index: number) => {
  const id = SCENES[index].id;
  return (HUMANS as readonly string[]).includes(id) || id === 'banners';
};

/**
 * Bild zur Zeit t zeichnen. W und H sind die Zeichenflaeche in Canvas-Einheiten (der Aufrufer setzt die Pixeldichte).
 * Draw the frame at time t. W and H are the drawing area in canvas units (the caller sets the pixel density).
 */
export function renderAt(ctx: CanvasRenderingContext2D, time: number, W: number, H: number, A: IntroAssets, T: IntroTexts, opts: RenderOptions = {}) {
  const st = frameState(time);
  const t = st.t;
  const r: R = { ctx, W, H, u: Math.min(W, H) / 1080, portrait: W / H < 0.85, A, T, t };
  ctx.save();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // Wackeln (Treffer und Grollen vor dem Einschlag) / shake (hits and rumble before the impact)
  const rumble = seg(t, 8.5, 11) * 9 * (1 - seg(t, 11, 11.01));
  const sx = (st.shake.x + Math.sin(t * 63) * rumble) * r.u, sy = (st.shake.y + Math.cos(t * 51) * rumble) * r.u;
  ctx.translate(sx, sy);
  const s = SCENES[st.index];
  const l = t - s.start;
  if (wipes(st.index) && l < WIPE && st.index > 0) {
    // vorherige Szene, dann die neue hinter einer schraegen Kante / previous scene, then the new one behind a slanted edge
    drawScene(r, st.index - 1, t);
    const p = easeInOutCubic(l / WIPE);
    const slant = H * 0.35;
    const ex = lerp(-slant - 80 * r.u, W + 80 * r.u, p);
    ctx.save();
    poly(ctx, [[-10, -10], [ex + slant, -10], [ex, H + 10], [-10, H + 10]]); ctx.clip();
    drawScene(r, st.index, t);
    ctx.restore();
    const col = s.id === 'banners' ? C.hazard : factionTokens[s.id as HumanFaction].primary;
    const bw = 90 * r.u;
    poly(ctx, [[ex + slant, -10], [ex + slant + bw, -10], [ex + bw, H + 10], [ex, H + 10]]);
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 10 * r.u; ctx.strokeStyle = C.ink; ctx.stroke();
  } else drawScene(r, st.index, t);
  ctx.restore();

  cinemaBars(r, 1 - easeInOutCubic(seg(t, 14, 14.4)));
  if (st.flash > 0) { ctx.fillStyle = withAlpha(C.flash, st.flash); ctx.fillRect(0, 0, W, H); }
  // Vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  vg.addColorStop(0, withAlpha(C.ink, 0)); vg.addColorStop(1, withAlpha(C.ink, 0.42));
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (opts.subtitles !== false) drawSubtitle(r, t);
  if (st.fade > 0) { ctx.fillStyle = withAlpha(C.bg, st.fade); ctx.fillRect(0, 0, W, H); }
}

/** Diashow ohne Animation: ein Standbild je Szene / slideshow without animation: one still per scene */
export const SLIDES: readonly number[] = SCENES.map((s) => s.key);
export { DURATION };
