// Gemeinsame Werkzeuge fuer die Comic-Portraits der Anfuehrer.
// Shared helpers for the hand-authored comic leader portraits (pure SVG, no dependencies).
//
// Level A: clean comic (small sizes), Level B: rich comic (large views).
// Moods: neutral, angry, smug, shocked.

export const INK = '#15131f';
export const MOODS = ['neutral', 'angry', 'smug', 'shocked'];
const r1 = (v) => Math.round(v * 10) / 10;

// ---------- geometry ----------

// Catmull-Rom spline through points -> cubic bezier segments.
// A point may be [x, y, 1] to mark a sharp corner.
function crSegs(pts, closed) {
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    let c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    let c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    if (p1[2]) c1 = [p1[0], p1[1]];
    if (p2[2]) c2 = [p2[0], p2[1]];
    segs.push([p1, c1, c2, p2]);
  }
  return segs;
}
export function cr(pts, closed = true) {
  const segs = crSegs(pts, closed);
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (const [, c1, c2, p2] of segs) d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  return d + (closed ? 'Z' : '');
}
export const poly = (pts) => 'M' + pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L') + 'Z';
function bez(s, t) {
  const [a, b, c, d] = s, u = 1 - t;
  return [0, 1].map((k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
}
function sample(pts, per = 10) {
  const out = [];
  const segs = crSegs(pts, false);
  segs.forEach((s, i) => {
    for (let j = 0; j < per; j++) out.push(bez(s, j / per));
    if (i === segs.length - 1) out.push(bez(s, 1));
  });
  return out;
}
// Tapered brush stroke along a spline -> closed filled path.
export function taper(pts, w, o = {}) {
  const a = o.a ?? 0.35, b = o.b ?? 0.35, mn = o.min ?? 0.12;
  const sp = sample(pts, o.per ?? 6);
  const n = sp.length;
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]));
  const tot = L[n - 1] || 1;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const t = L[i] / tot;
    let f = 1;
    if (a > 0 && t < a) f = Math.min(f, mn + (1 - mn) * Math.sin((t / a) * Math.PI / 2));
    if (b > 0 && t > 1 - b) f = Math.min(f, mn + (1 - mn) * Math.sin(((1 - t) / b) * Math.PI / 2));
    const hw = (w * f) / 2;
    const p = sp[Math.min(n - 1, i + 1)], q = sp[Math.max(0, i - 1)];
    let dx = p[0] - q[0], dy = p[1] - q[1];
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    left.push([sp[i][0] - dy * hw, sp[i][1] + dx * hw]);
    right.push([sp[i][0] + dy * hw, sp[i][1] - dx * hw]);
  }
  return poly(left.concat(right.reverse()));
}
export function ellD(cx, cy, rx, ry, rot = 0) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = (rot * Math.PI) / 180;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return cr(pts);
}
export function star(cx, cy, R, r, rot = -90, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180, rr = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly(pts);
}
export function gear(cx, cy, R, r, teeth = 10) {
  const pts = [];
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 4 < 2 ? R : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly(pts);
}
export function hexD(cx, cy, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = ((rot + 30 + i * 60) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}
// transform helpers for point lists
export const mv = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy, p[2]]);
export const sc = (pts, cx, cy, k) => pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k, p[2]]);

// deterministic random
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- document ----------

export class Doc {
  constructor(level, mood = 'neutral') {
    this.B = level === 'B';
    this.A = !this.B;
    this.mood = mood;
    this.defs = [];
    this.body = [];
    this.n = 0;
    if (this.B) {
      this.def(`<pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><circle cx="2.5" cy="2.5" r="1.05" fill="${INK}"/></pattern>`);
      this.def(`<pattern id="hatch" width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><rect width="4.5" height="0.9" fill="${INK}"/></pattern>`);
      this.def(`<pattern id="xhatch" width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="4.5" height="0.9" fill="${INK}"/><rect width="0.9" height="4.5" fill="${INK}"/></pattern>`);
      this.def(`<filter id="grain" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.08  0 0 0 0 0.07  0 0 0 0 0.12  0 0 0 0.55 -0.12"/></filter>`);
    }
  }
  id(p) { return `${p}${++this.n}`; }
  def(s) { this.defs.push(s); }
  add(s) { this.body.push(s); }
  // Filled, clipped and outlined region; inner content is clipped to the shape.
  region(d, fill, o = {}) {
    const id = this.id('p');
    let inner = typeof o.inner === 'function' ? o.inner(id) : o.inner || '';
    if (this.B && o.rim) {
      const mid = this.id('m');
      const [dx, dy] = o.rimOff || [-7, 3];
      this.def(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><use href="#${id}" fill="#fff"/><use href="#${id}" fill="#000" transform="translate(${dx} ${dy})"/></mask>`);
      inner += `<rect width="512" height="512" fill="${o.rim}" mask="url(#${mid})" opacity="${o.rimOp ?? 0.9}"/>`;
    }
    const needDef = inner || o.sw !== 0;
    let s;
    if (!needDef) s = `<path d="${d}" fill="${fill}"/>`;
    else {
      this.def(`<path id="${id}" d="${d}"/>`);
      s = `<use href="#${id}" fill="${fill}"/>`;
      if (inner) {
        const cid = this.id('c');
        this.def(`<clipPath id="${cid}"><use href="#${id}"/></clipPath>`);
        s += `<g clip-path="url(#${cid})">${inner}</g>`;
      }
      if (o.sw !== 0) s += `<use href="#${id}" fill="none" stroke="${o.stroke || INK}" stroke-width="${o.sw ?? 4.5}" stroke-linejoin="round"/>`;
    }
    this.add(o.group ? `<g ${o.group}>${s}</g>` : s);
    return id;
  }
  ink(pts, w, o = {}) { this.add(`<path d="${taper(pts, w, o)}" fill="${o.fill || INK}"${o.op ? ` opacity="${o.op}"` : ''}/>`); }
  line(pts, w, o = {}) {
    this.add(`<path d="${cr(pts, false)}" fill="none" stroke="${o.stroke || INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o.op ? ` opacity="${o.op}"` : ''}/>`);
  }
  open(attrs) { this.add(`<g ${attrs}>`); }
  close() { this.add('</g>'); }
  grain(op = 0.35) {
    if (this.B) this.add(`<rect width="512" height="512" filter="url(#grain)" opacity="${op}" style="mix-blend-mode:multiply"/>`);
  }
  toString() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>${this.defs.join('')}</defs>${this.body.join('')}</svg>\n`;
  }
}
// string builders for region inners
export const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
export const T = (pts, w, fill = INK, o = {}) => `<path d="${taper(pts, w, o)}" fill="${fill}"${o.op ? ` opacity="${o.op}"` : ''}/>`;
export const L = (pts, w, stroke = INK, o = {}) =>
  `<path d="${cr(pts, false)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${o.op ? ` opacity="${o.op}"` : ''}/>`;
// Level-B-only overlays
export const tone = (D) => ({
  ht: (d, op = 0.28) => (D.B ? P(d, 'url(#dots)', `opacity="${op}"`) : ''),
  hatch: (d, op = 0.3) => (D.B ? P(d, 'url(#hatch)', `opacity="${op}"`) : ''),
  xh: (d, op = 0.3) => (D.B ? P(d, 'url(#xhatch)', `opacity="${op}"`) : ''),
  b: (s) => (D.B ? s : ''),
  a: (s) => (D.A ? s : ''),
});

// ---------- backgrounds ----------
// o: { primary, secondary, glow, cx, cy, r, rays: { n, op, color, w, color2, op2 }, vignette, grid, scan, particles }
export function background(D, o) {
  const cx = o.cx ?? 256, cy = o.cy ?? 210;
  const g = D.id('bg');
  const stops = o.stops || [[0, o.glow || o.secondary], [0.28, o.secondary], [1, o.primary]];
  D.def(`<radialGradient id="${g}" cx="${cx}" cy="${cy}" r="${o.r ?? 380}" gradientUnits="userSpaceOnUse">${stops.map(([k, c]) => `<stop offset="${k}" stop-color="${c}"/>`).join('')}</radialGradient>`);
  D.add(`<rect width="512" height="512" fill="url(#${g})"/>`);
  if (o.rays) {
    const R = o.rays;
    const N = R.n ?? 22, rcx = R.cx ?? cx, rcy = R.cy ?? cy;
    let d1 = '', d2 = '';
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2 + (R.rot ?? 0.05), a1 = a0 + ((Math.PI * 2) / N) * (R.w ?? 0.45);
      const seg = `M${rcx} ${rcy}L${r1(rcx + Math.cos(a0) * 560)} ${r1(rcy + Math.sin(a0) * 560)}L${r1(rcx + Math.cos(a1) * 560)} ${r1(rcy + Math.sin(a1) * 560)}Z`;
      if (R.color2 && i % 2) d2 += seg; else d1 += seg;
    }
    D.add(`<path d="${d1}" fill="${R.color || '#fff'}" opacity="${R.op ?? 0.1}"/>`);
    if (d2) D.add(`<path d="${d2}" fill="${R.color2}" opacity="${R.op2 ?? R.op ?? 0.1}"/>`);
  }
  if (o.grid) {
    const G = o.grid;
    let d = '';
    for (let x = G.size / 2; x < 512; x += G.size) d += `M${x} 0V512`;
    for (let y = G.size / 2; y < 512; y += G.size) d += `M0 ${y}H512`;
    D.add(`<path d="${d}" stroke="${G.color}" stroke-width="${G.w ?? 1}" opacity="${G.op}" fill="none"/>`);
  }
  if (o.scan && D.B) {
    D.def(`<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.3" fill="${o.scan.color}"/></pattern>`);
    D.add(`<rect width="512" height="512" fill="url(#scan)" opacity="${o.scan.op}"/>`);
  }
  if (D.B && o.halftone !== false) {
    const pt = D.id('ht'), mk = D.id('hm'), rg = D.id('hg');
    D.def(`<pattern id="${pt}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="4.5" cy="4.5" r="2" fill="${o.htColor || INK}"/></pattern>`);
    D.def(`<radialGradient id="${rg}" cx="${cx}" cy="${cy}" r="360" gradientUnits="userSpaceOnUse"><stop offset="0.45" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>`);
    D.def(`<mask id="${mk}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="url(#${rg})"/></mask>`);
    D.add(`<rect width="512" height="512" fill="url(#${pt})" mask="url(#${mk})" opacity="${o.htOp ?? 0.2}"/>`);
  }
}
// Edge vignette (drawn on top of everything, below the grain).
export function vignette(D, color, op, inner = 0.55, cx = 256, cy = 230) {
  const g = D.id('vg');
  D.def(`<radialGradient id="${g}" cx="${cx}" cy="${cy}" r="370" gradientUnits="userSpaceOnUse"><stop offset="${inner}" stop-color="${color}" stop-opacity="0"/><stop offset="1" stop-color="${color}" stop-opacity="${op}"/></radialGradient>`);
  D.add(`<rect width="512" height="512" fill="url(#${g})"/>`);
}
// Light wash over a region of the picture (e.g. under-light glow).
export function glowRect(D, x1, y1, x2, y2, stops, blend = 'normal', op = 1) {
  const g = D.id('gl');
  D.def(`<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops.map(([k, c, a]) => `<stop offset="${k}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`);
  return `<rect width="512" height="512" fill="url(#${g})" opacity="${op}"${blend !== 'normal' ? ` style="mix-blend-mode:${blend}"` : ''}/>`;
}

// ---------- faces & moods ----------

// Eye geometry from a compact spec, adjusted per mood.
// spec: { cx, cy, w, h, inner: +1 (left eye, nose to its right) | -1, fx (iris squash), look: [dx, dy] }
const EYE_MOOD = {
  neutral: { tk: 0.55, bk: 0.45, pup: 0.46, ir: 1, topX: -0.05, icY: 0 },
  angry: { tk: 0.3, bk: 0.34, pup: 0.44, ir: 0.95, topX: -0.3, icY: 0.18 },
  smug: { tk: 0.18, bk: 0.36, pup: 0.44, ir: 1, topX: -0.25, icY: 0.05 },
  shocked: { tk: 0.82, bk: 0.66, pup: 0.2, ir: 0.68, topX: 0, icY: 0 },
};
export function eye(D, C, s, mood = 'neutral', o = {}) {
  const m = { ...EYE_MOOD[mood], ...(o.m || {}) };
  const k = (s.k ?? 1) * (D.A ? (o.aScale ?? 1.15) : 1);
  const w = s.w * k, h = s.h * k, cx = s.cx, cy = s.cy, inn = s.inner;
  const cant = (s.cant ?? 0.12) * h;
  const ic = [cx + (inn * w) / 2, cy + cant / 2 + m.icY * h];
  const oc = [cx - (inn * w) / 2, cy - cant / 2];
  const top = [cx + inn * w * m.topX, cy - h * m.tk];
  const bot = [cx + inn * w * 0.05, cy + h * m.bk];
  const r = h * 0.62 * m.ir;
  const look = s.look || [0, 0];
  const icx = cx + look[0] * k, icy = cy + look[1] * k + (mood === 'shocked' ? 0 : h * 0.02);
  const irx = r * (s.fx ?? 1), iry = r;
  const white = cr([oc.concat(1), top, ic.concat(1), bot]);
  const B = D.B;
  D.region(white, s.white || '#fbfbf6', {
    sw: 0,
    inner: `<ellipse cx="${r1(icx)}" cy="${r1(icy)}" rx="${r1(irx)}" ry="${r1(iry)}" fill="${C.iris}"/>` +
      (B ? `<ellipse cx="${r1(icx)}" cy="${r1(icy + iry * 0.35)}" rx="${r1(irx * 0.7)}" ry="${r1(iry * 0.5)}" fill="${C.irisHi}" opacity="0.7"/>` : '') +
      `<ellipse cx="${r1(icx)}" cy="${r1(icy)}" rx="${r1(irx)}" ry="${r1(iry)}" fill="none" stroke="${C.irisDk}" stroke-width="${B ? 1.5 : 1.8}"/>` +
      `<ellipse cx="${r1(icx)}" cy="${r1(icy)}" rx="${r1(irx * m.pup)}" ry="${r1(iry * m.pup)}" fill="${INK}"/>` +
      P(cr([[oc[0] - inn * 4, oc[1] - 6], [top[0], top[1] - 6], [ic[0] + inn * 4, ic[1] - 6], [ic[0], ic[1] + 1], [top[0], top[1] + (s.lidSh ?? 3.5)], [oc[0], oc[1] + 1]]), '#6d5a64', 'opacity="0.38"') +
      `<circle cx="${r1(icx - inn * irx * 0.32)}" cy="${r1(icy - iry * 0.36)}" r="${r1(Math.max(1.3, irx * 0.3))}" fill="#fff"/>` +
      (B ? `<circle cx="${r1(icx + inn * irx * 0.38)}" cy="${r1(icy + iry * 0.4)}" r="${r1(irx * 0.13)}" fill="#fff" opacity="0.9"/>` : ''),
  });
  const lidW = (s.lidW ?? 4.4) * (D.A ? 1.15 : 1) * (mood === 'angry' ? 1.15 : 1);
  D.ink([oc, [(oc[0] + top[0]) / 2, (oc[1] + top[1]) / 2 - 1], top, ic], lidW, { a: 0.15, b: 0.55, min: 0.25 });
  if (s.flick) D.ink([oc, [oc[0] - inn * 5 * k, oc[1] - 2 * k], [oc[0] - inn * 8 * k, oc[1] - 6 * k]], lidW * 0.8, { a: 0.05, b: 0.9 });
  D.ink([[oc[0] + inn * w * 0.12, oc[1] + 2], bot, [ic[0] - inn * w * 0.1, ic[1] + 1]], (s.lowW ?? 1.6) * (D.A ? 1.2 : 1), { op: 0.75 });
  if (s.crease !== false && mood !== 'angry') {
    const lift = mood === 'shocked' ? 3 : mood === 'smug' ? -1 : 0;
    D.ink([[oc[0] + inn * w * 0.15, top[1] + h * 0.15 - lift], [top[0], top[1] - h * 0.32 - lift], [ic[0] - inn * w * 0.12, top[1] + h * 0.05 - lift]], 1.6, { op: 0.65 });
  }
  if (B && s.lashes) for (const l of s.lashes) D.ink(l, 1.4, { a: 0.05, b: 0.9 });
  return { oc, ic, top, bot };
}

// Brow as tapered shape; pts from inner end to outer end. side: +1 left brow (inner is right).
export function brow(D, pts, w, o = {}) {
  const mood = D.mood;
  const inn = o.inner ?? 1;
  const n = pts.length;
  const cxm = pts.reduce((a, p) => a + p[0], 0) / n, cym = pts.reduce((a, p) => a + p[1], 0) / n;
  let q = pts.map((p) => [p[0], p[1]]);
  const up = o.up; // this is the brow that goes up in 'smug'
  if (mood === 'angry') q = q.map((p, i) => { const t = i / (n - 1); return [p[0] + inn * 3 * (1 - t), p[1] + 8 * (1 - t) - 3 * t + (t > 0.2 && t < 0.8 ? 1 : 0)]; });
  if (mood === 'shocked') q = q.map((p, i) => { const t = i / (n - 1); return [p[0], p[1] - 10 - 5 * Math.sin(t * Math.PI) + 2 * (1 - t)]; });
  if (mood === 'smug') q = up ? q.map((p, i) => { const t = i / (n - 1); return [p[0], p[1] - 6 - 7 * Math.sin(t * Math.PI * 0.8)]; }) : q.map((p, i) => { const t = i / (n - 1); return [p[0], p[1] + 3 * (1 - t)]; });
  if (o.neutralUp && mood === 'neutral') q = q.map((p, i) => { const t = i / (n - 1); return [p[0], p[1] - o.neutralUp * Math.sin(t * Math.PI * 0.8)]; });
  if (D.A) q = sc(q, cxm, cym, 1.15);
  const ww = w * (D.A ? 1.15 : 1) * (mood === 'angry' ? 1.12 : 1);
  const d = taper(q, ww, { a: o.a ?? 0.12, b: o.b ?? 0.6, min: 0.3 });
  D.region(d, o.fill || INK, { sw: o.sw ?? 1.2, inner: o.innerFn ? o.innerFn(q) : '' });
  return q;
}

// Generic mouth. s: { cx, cy, w, lf (far share), lips: {lip, lipSh, lipHi}, full (0..1), smile (neutral corner lift) }
export function mouth(D, s, mood = 'neutral', o = {}) {
  const lf = s.lf ?? 0.42;
  const xl = s.cx - s.w * lf, xr = s.cx + s.w * (1 - lf), cx = s.cx, cy = s.cy;
  const C = s.lips;
  const full = s.full ?? 0.5;
  const dk = '#3b1820', teeth = '#fbf6ea', tongue = '#c95b62';
  const lineW = (s.lineW ?? 2.8) * (D.A ? 1.15 : 1);
  if (mood === 'shocked') {
    const rx = s.w * 0.2, ry = s.w * 0.27, ox = cx + 1, oy = cy + ry * 0.55;
    D.region(ellD(ox, oy, rx, ry, 0), dk, {
      sw: 3,
      inner: P(ellD(ox + 1, oy + ry * 0.85, rx * 0.75, ry * 0.45), tongue) + P(cr([[ox - rx, oy - ry * 0.9], [ox + rx, oy - ry * 0.9], [ox + rx * 0.7, oy - ry * 0.55], [ox - rx * 0.7, oy - ry * 0.55]]), teeth),
    });
    if (C) D.ink([[ox - rx * 0.6, oy + ry + 3], [ox, oy + ry + 5], [ox + rx * 0.6, oy + ry + 3]], 2.2, { fill: C.lipSh, op: 0.9 });
    return;
  }
  if (mood === 'angry') {
    const yl = cy + 6, yr = cy + 6, top = cy - 4, botY = cy + 12;
    const outline = cr([[xl, yl, 1], [cx - s.w * 0.15, top], [cx + s.w * 0.15, top - 1], [xr, yr, 1], [cx + s.w * 0.2, botY], [cx - s.w * 0.2, botY]]);
    D.region(outline, dk, {
      sw: 3,
      inner: P(cr([[xl - 4, top - 6], [xr + 4, top - 6], [xr, cy + 3], [cx, cy + 2.5], [xl, cy + 3]]), teeth) +
        P(cr([[xl, botY + 4], [xr, botY + 4], [xr, cy + 9], [cx, cy + 8], [xl, cy + 9]]), teeth) +
        [-0.3, -0.1, 0.1, 0.3].map((t) => `<path d="M${r1(cx + s.w * t)} ${r1(top - 2)}V${r1(cy + 3)}M${r1(cx + s.w * t + 3)} ${r1(cy + 8)}V${r1(botY + 3)}" stroke="#b9ae9b" stroke-width="1.2"/>`).join(''),
    });
    D.ink([[xl - 4, yl + 5], [xl, yl], [cx, top - 2], [xr, yr], [xr + 5, yr + 6]], lineW * 0.8, { a: 0.2, b: 0.2 });
    return;
  }
  // neutral & smug: closed mouth
  const lift = mood === 'smug' ? (o.smugLift ?? 8) : (s.smile ?? 2);
  const farLift = mood === 'smug' ? -1 : (s.farSmile ?? lift * 0.4);
  const L0 = [xl, cy - farLift], R0 = [xr, cy - lift], M = [cx + s.w * 0.05, cy + (mood === 'smug' ? 1 : lift * 0.12)];
  if (C) {
    const uy = 4 + full * 3, ly = 6 + full * 5;
    D.region(cr([[L0[0], L0[1], 1], [cx - s.w * 0.12, cy - uy], [cx - 1, cy - uy + 2], [cx + 4, cy - uy], [cx + s.w * 0.28, cy - uy + 1 - lift * 0.4], [R0[0], R0[1], 1], [M[0] + s.w * 0.25, M[1] - lift * 0.3], M, [cx - s.w * 0.2, M[1] - 0.5]]), C.lip, {
      sw: 2, inner: P(cr([[L0[0], L0[1] + 1], [cx, cy - uy + 3], [R0[0], R0[1]], [cx, M[1] + 2]]), C.lipSh),
    });
    D.region(cr([[L0[0] + 3, L0[1] + 1, 1], [cx - s.w * 0.1, M[1] + 0.5], M, [R0[0] - 3, R0[1] + 1.5, 1], [cx + s.w * 0.25, M[1] + ly * 0.8 - lift * 0.3], [cx, M[1] + ly], [cx - s.w * 0.22, M[1] + ly * 0.8]]), C.lip, {
      sw: 2, inner: P(cr([[cx + 2, M[1] + 2], [R0[0] - 2, R0[1] + 2], [cx + s.w * 0.2, M[1] + ly + 1], [cx, M[1] + ly + 2]]), C.lipSh) + P(ellD(cx - s.w * 0.08, M[1] + ly * 0.4, s.w * 0.12, ly * 0.18), C.lipHi),
    });
  }
  D.ink([[L0[0] - 2, L0[1] + 0.5], [cx - s.w * 0.15, M[1]], M, [cx + s.w * 0.3, M[1] - lift * 0.4], [R0[0] + 2, R0[1] - 1]], lineW, { a: 0.2, b: 0.25 });
  if (lift > 3) D.ink([[R0[0] + 1, R0[1] - 4], [R0[0] + 4, R0[1]], [R0[0] + 3, R0[1] + 5]], 1.6, { op: 0.6, a: 0.3, b: 0.5 });
}
// mood extras
export function frown(D, x, y, k = 1) {
  if (D.mood !== 'angry') return;
  D.ink([[x - 3 * k, y - 8 * k], [x - 1 * k, y], [x - 2 * k, y + 6 * k]], 2.2, { op: 0.8 });
  D.ink([[x + 4 * k, y - 6 * k], [x + 5 * k, y + 4 * k]], 1.6, { op: 0.6 });
}
export function sweat(D, x, y, s = 1) {
  if (D.mood !== 'shocked') return;
  D.region(cr([[x, y - 14 * s, 1], [x + 7 * s, y], [x, y + 6 * s], [x - 7 * s, y]]), '#bfe6ff', { sw: 2.5, inner: P(ellD(x - 2 * s, y - 1 * s, 2 * s, 3.5 * s), '#fff') });
}
export function shockLines(D, x, y, side = 1) {
  if (D.mood !== 'shocked') return;
  for (let i = 0; i < 3; i++) D.ink([[x + side * i * 2, y + i * 12], [x + side * (12 + i * 3), y - 6 + i * 13]], 3, { a: 0.1, b: 0.6 });
}

// Golden epaulette in perspective. k: 0..1 foreshortening (1 = full face-on width)
export function epaulette(D, C, cx, cy, rx, ry, rot, side, o = {}) {
  const fx = side < 0 ? cx - rx * 0.92 : cx + rx * 0.5;
  const fw = rx * 0.42;
  D.region(cr([[fx, cy + 2, 1], [fx + fw, cy + 4, 1], [fx + fw, cy + 30, 1], [fx, cy + 28, 1]]), C.gold, {
    sw: 3, inner: Array.from({ length: 6 }, (_, i) => `<path d="M${r1(fx + ((i + 1) * fw) / 7)} ${cy}v36" stroke="${C.goldSh}" stroke-width="1.6"/>`).join('') + P(`M${fx} ${cy + 24}h${fw}v10h-${fw}Z`, C.goldSh),
  });
  D.region(ellD(cx, cy, rx, ry, rot), C.gold, {
    sw: 4, rim: o.rim || '#fff3c0', rimOff: [-5, 3],
    inner: P(ellD(cx + 4, cy + 6, rx, ry * 0.8, rot), C.goldSh) + (D.B ? P(ellD(cx + 6, cy + 9, rx, ry * 0.7, rot), 'url(#dots)', 'opacity="0.3"') + P(ellD(cx + 6, cy + 11, rx, ry * 0.6, rot), C.goldSh2) : '') + P(ellD(cx - 6, cy - 5, rx * 0.6, ry * 0.3, rot), C.goldHi),
  });
  D.add(`<path d="${ellD(cx, cy - 1, rx * 0.72, ry * 0.55, rot)}" fill="none" stroke="${INK}" stroke-width="1.8" opacity="0.7"/>`);
  if (o.emblem) o.emblem(cx, cy - 1);
  if (D.B) D.add(`<circle cx="${r1(cx - rx * 0.4)}" cy="${r1(cy - ry * 0.4)}" r="2" fill="#fff"/>`);
}
