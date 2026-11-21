/** Comic-Plaketten fuer LP und Staedtenamen (Canvas-Sprites) / comic badges for HP and city names (canvas sprites) */
import * as THREE from 'three';
import { primitives, semantic } from '../design/tokens';
import { BADGE } from './config';
import { icon } from '../ui/icons';

const cache = new Map<string, THREE.SpriteMaterial>();

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function material(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.SpriteMaterial {
  let m = cache.get(key);
  if (m) return m;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  cache.set(key, m);
  return m;
}

export function clearLabelCache() {
  for (const m of cache.values()) { m.map?.dispose(); m.dispose(); }
  cache.clear();
}

/**
 * sin = Fraktion als Suender gezeichnet, blessed = Maertyrer-Segen (Heiliges Alvenia); icon = Rollensymbol der Einheit
 * (unitRoles.ts), ohne icon die Plakette ohne Symbolkappe.
 * sin = faction marked as a sinner, blessed = Martyr's Blessing (Holy Alvenia); icon = role icon of the unit
 * (unitRoles.ts), without icon the badge has no icon cap.
 */
export interface BadgeInfo { hp: number; maxHp: number; color: string; ink: string; veteran: boolean; done: boolean; fuel: number | null; maxFuel: number; sin?: boolean; blessed?: boolean; icon?: string;
  /**
   * Vom Hackturm uebernommen (HACK.tower): verbleibende Zuege und Farbe der hackenden Fraktion (Kreis mit Zahl rechts).
   * Taken over by a hack tower (HACK.tower): remaining turns and colour of the hacking faction (disc with a number on the right).
   */
  hijack?: { n: number; color: string } }

/** Lage der Teile auf der Plakette in Canvas-Pixeln, ab der linken Kante des Schilds / layout of the badge parts in canvas pixels, from the left edge of the pill */
export interface BadgeLayout { width: number; pill: number; cap: boolean; textX: number; starX: number; sinX: number; hackX: number }

/**
 * Plakette von links nach rechts: Symbolkappe (Tuschekreis mit hellem Rollensymbol, fuellt das linke Ende des Schilds),
 * Zahl, Veteranenstern, Suendenzeichen. Das Schild ist nur so breit wie sein Inhalt; ohne Kappe wie bisher mindestens
 * BADGE.minPill. textWidth = gemessene Breite der Zahl.
 * Badge from left to right: icon cap (ink disc with a light role icon, filling the left end of the pill), number, veteran
 * star, sinner mark. The pill is only as wide as its content; without a cap at least BADGE.minPill as before.
 * textWidth = measured width of the number.
 */
export function badgeLayout(textWidth: number, cap: boolean, veteran: boolean, sin: boolean, hack = false): BadgeLayout {
  const tw = Math.ceil(textWidth);
  let x = cap ? BADGE.cap + BADGE.gap : BADGE.pad;
  const textX = x + tw / 2;
  x += tw;
  const starX = veteran ? x + BADGE.gap + BADGE.star / 2 : 0;
  if (veteran) x += BADGE.gap + BADGE.star;
  const sinX = sin ? x + BADGE.gap + BADGE.sin / 2 : 0;
  if (sin) x += BADGE.gap + BADGE.sin;
  // Uebernahme-Zaehler (HACK.tower) ganz rechts / takeover counter (HACK.tower) on the far right
  const hackX = hack ? x + BADGE.gap + BADGE.sin / 2 : 0;
  if (hack) x += BADGE.gap + BADGE.sin;
  const pill = cap ? x + BADGE.padEnd : Math.max(BADGE.minPill, x + BADGE.pad);
  // links 2 Pixel Rand, rechts der Schatten (4) und 2 Pixel / 2 pixels margin on the left, the shadow (4) and 2 pixels on the right
  return { width: pill + 8, pill, cap, textX, starX, sinX, hackX };
}

/**
 * Zwischenspeicher der LP-Plaketten begrenzen: Sind es mehr als BADGE.cacheMax, werden alle freigegeben, die keine
 * Einheit gerade zeigt (shown). Mit dem Rollensymbol gibt es je Typ eigene Plaketten; ohne Grenze wuechse der Speicher
 * ueber eine lange Partie mit jeder neuen LP-Zahl.
 * Bound the cache of the HP badges: with more than BADGE.cacheMax, every badge no unit shows right now (shown) is
 * released. With the role icon there are badges per type; without a bound the memory would grow over a long game with
 * every new HP value.
 */
export function pruneBadgeCache(shown: Set<THREE.Material>) {
  let n = 0;
  for (const k of cache.keys()) if (k.startsWith('hp-')) n++;
  if (n <= BADGE.cacheMax) return;
  for (const [k, m] of cache) {
    if (!k.startsWith('hp-') || shown.has(m)) continue;
    m.map?.dispose(); m.dispose(); cache.delete(k);
  }
}

let measureCtx: CanvasRenderingContext2D | null = null;
const badgeFont = () => `44px ${primitives.font.display}`;

/** LP-Plakette / HP badge */
export function hpBadge(b: BadgeInfo): THREE.Sprite {
  const key = `hp-${b.hp}-${b.maxHp}-${b.color}-${b.veteran}-${b.done}-${b.fuel}-${!!b.sin}-${!!b.blessed}-${b.icon ?? ''}-${b.hijack ? `${b.hijack.n}${b.hijack.color}` : ''}`;
  const txt = `${Math.max(0, Math.ceil(b.hp))}`;
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = badgeFont();
  const L = badgeLayout(measureCtx.measureText(txt).width, !!b.icon, b.veteran, !!b.sin, !!b.hijack);
  const fuelW = b.fuel !== null ? b.maxFuel * 22 + (b.maxFuel - 1) * 6 + 8 : 0;
  // gerade Breite, damit die Mitte auf einem Pixel liegt / even width so the centre lies on a pixel
  const W = Math.ceil(Math.max(L.width, fuelW) / 2) * 2, H = b.fuel !== null ? 84 : 64;
  const m = material(key, W, H, (ctx) => {
    const ink = semantic.ink;
    ctx.globalAlpha = b.done ? 0.62 : 1;
    const px = (W - L.width) / 2, pw = L.pill;
    ctx.fillStyle = ink;
    roundRect(ctx, px + 6, 6, pw, 52, 16); ctx.fill();
    ctx.fillStyle = b.color;
    roundRect(ctx, px + 2, 2, pw, 52, 16); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();
    // Maertyrer-Segen: goldener Rand / Martyr's Blessing: golden rim
    if (b.blessed) {
      roundRect(ctx, px + 5, 5, pw - 6, 46, 14); ctx.lineWidth = 7; ctx.strokeStyle = semantic.faithHalo; ctx.stroke();
      roundRect(ctx, px + 2, 2, pw, 52, 16); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
    }
    // Symbolkappe: Tuschekreis mit hellem Symbol, auf jeder Fraktionsfarbe lesbar (wie das Stuetzpunkt-Schild)
    // icon cap: ink disc with a light icon, readable on every faction colour (like the base sign)
    if (b.icon) {
      const r = BADGE.cap / 2, cx = px + 2 + r, cy = 28;
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      drawIcon(ctx, b.icon, cx - BADGE.icon / 2, cy - BADGE.icon / 2, BADGE.icon, semantic.surfaceRaised);
    }
    ctx.fillStyle = b.ink;
    ctx.font = badgeFont();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.strokeText(txt, px + 2 + L.textX, 31);
    ctx.fillText(txt, px + 2 + L.textX, 31);
    if (b.veteran) {
      const sx = px + 2 + L.starX;
      ctx.fillStyle = semantic.accent; ctx.strokeStyle = ink; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 7 : 16;
        ctx.lineTo(sx + Math.cos(a) * r, 29 + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Suendenzeichen: roter Kreis mit gesprungenem Sonnenkranz rechts / sinner mark: red disc with a cracked sun halo on the right
    if (b.sin) {
      const cx = px + 2 + L.sinX, cy = 29;
      ctx.fillStyle = semantic.sinMark; ctx.strokeStyle = ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = semantic.textInverse; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 8, -Math.PI * 0.35, Math.PI * 1.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 13); ctx.lineTo(cx - 3, cy - 4); ctx.lineTo(cx + 2, cy); ctx.lineTo(cx - 1, cy + 5); ctx.stroke();
    }
    // Uebernahme: Kreis in der Farbe der hackenden Fraktion mit den verbleibenden Zuegen / takeover: disc in the hacker's colour with the remaining turns
    if (b.hijack) {
      const cx = px + 2 + L.hackX, cy = 29;
      ctx.fillStyle = b.hijack.color; ctx.strokeStyle = ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = semantic.white; ctx.font = `34px ${primitives.font.display}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeText(`${b.hijack.n}`, cx, cy + 1); ctx.fillText(`${b.hijack.n}`, cx, cy + 1);
    }
    if (b.fuel !== null) {
      const pw = 22, gap = 6, total = b.maxFuel * pw + (b.maxFuel - 1) * gap, x0 = (W - total) / 2;
      for (let i = 0; i < b.maxFuel; i++) {
        ctx.fillStyle = i < b.fuel ? (b.fuel <= 1 ? semantic.dangerBright : semantic.accent) : semantic.surfaceSunken;
        roundRect(ctx, x0 + i * (pw + gap), 62, pw, 16, 5); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
      }
    }
  });
  const s = new THREE.Sprite(m);
  // gleicher Massstab je Canvas-Pixel wie bisher (128 Pixel = 0.42) / same scale per canvas pixel as before (128 pixels = 0.42)
  s.scale.set(BADGE.world * W, BADGE.world * H, 1);
  s.renderOrder = 10;
  return s;
}

/**
 * Symbol aus dem SVG-Symbolsatz (icons.ts) auf einen Canvas zeichnen: Pfade und Kreise im 24er-Raster, wie im SVG
 * gestrichen bzw. gefuellt. Ohne Path2D (Testumgebung) passiert nichts.
 * Draw an icon from the SVG icon set (icons.ts) onto a canvas: paths and circles on the 24 grid, stroked or filled as in
 * the SVG. Without Path2D (test environment) nothing happens.
 */
export function drawIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, color: string) {
  if (typeof Path2D === 'undefined') return;
  const svg = icon(name);
  const body = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = color; ctx.fillStyle = color;
  for (const m of body.matchAll(/<(path|circle)\s+([^>]*?)\/?>/g)) {
    const attr = (n: string) => new RegExp(`(?:^|\\s)${n}="([^"]*)"`).exec(m[2])?.[1];
    ctx.lineWidth = Number(attr('stroke-width') ?? 2.2);
    const fill = attr('fill') === 'currentColor';
    if (m[1] === 'path') {
      const p = new Path2D(attr('d') ?? '');
      if (fill) ctx.fill(p);
      ctx.stroke(p);
    } else {
      ctx.beginPath();
      ctx.arc(Number(attr('cx')), Number(attr('cy')), Number(attr('r')), 0, Math.PI * 2);
      if (fill) ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Art eines Stuetzpunkts auf dem Schild: Symbolname (icons.ts) und Name / kind of a base on the sign: icon name (icons.ts) and name */
export interface BaseTag { icon: string; name: string }

/**
 * Masse des Stadtschilds in Canvas-Pixeln. Stuetzpunkt: breiterer Canvas (baseWidth), Symbolplakette (badge) links im
 * Schild, darunter eine Fahne (tab) mit dem Namen der Art.
 * Sizes of the city sign in canvas pixels. Base: a wider canvas (baseWidth), an icon badge on the left of the pill and a
 * tab below it with the name of the kind.
 */
export const SIGN = { width: 320, baseWidth: 384, pill: 60, badge: 50, icon: 40, tab: 30, tabFont: 25, world: 0.95 };

/** Stadtschild / city sign */
/** level als Text: '' = leerer Kreis (Nachschublinie) / level as text: '' = empty circle (supply line) */
export function cityLabel(name: string, level: number | string, color: string, ink: string, capital: boolean, pop = 0, need = 0, base?: BaseTag): THREE.Sprite {
  const key = `city-${name}-${level}-${color}-${capital}-${pop}-${need}-${base ? `${base.icon}:${base.name}` : ''}`;
  const W = base ? SIGN.baseWidth : SIGN.width;
  // Stuetzpunkt: Fahne mit der Art unter dem Schild / base: tab with the kind below the pill
  const tab = base ? SIGN.tab : 0;
  const H = (need > 0 ? 112 : 80) + tab;
  // neutraler Stuetzpunkt: das Symbol ersetzt den Stufenkreis (Stufe 0 sagt nichts) / neutral base: the icon replaces the level circle (level 0 says nothing)
  const circle = !(base && level === 0);
  const m = material(key, W, H, (ctx) => {
    ctx.font = `40px ${primitives.font.display}`;
    const text = name.toUpperCase();
    const left = (base ? SIGN.badge + 8 : 0) + (circle ? 46 : 8);
    const tw = Math.min(W - 34 - left, ctx.measureText(text).width + 30);
    const x = (W - tw - left) / 2;
    if (base) {
      // Fahne zuerst, das Schild ueberdeckt ihre Oberkante / the tab first, the pill covers its top edge
      ctx.font = `${SIGN.tabFont}px ${primitives.font.display}`;
      const kind = base.name.toUpperCase();
      const kw = Math.min(W - 16, ctx.measureText(kind).width + 26);
      const kx = (W - kw) / 2, ky = SIGN.pill - 12;
      ctx.fillStyle = semantic.ink;
      roundRect(ctx, kx, ky, kw, tab + 12, 10); ctx.fill();
      ctx.fillStyle = semantic.surfaceRaised; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(kind, W / 2, SIGN.pill + tab / 2 + 1, kw - 16);
      ctx.font = `40px ${primitives.font.display}`;
    }
    ctx.fillStyle = semantic.ink;
    roundRect(ctx, x + 5, 7, tw + left, SIGN.pill, 14); ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x, 2, tw + left, SIGN.pill, 14); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = semantic.ink; ctx.stroke();
    let cx = x + 26;
    if (base) {
      // Symbolplakette: Tusche mit hellem Symbol, auf jeder Fraktionsfarbe lesbar / icon badge: ink with a light icon, readable on every faction colour
      const by = 2 + (SIGN.pill - SIGN.badge) / 2;
      ctx.fillStyle = semantic.ink;
      roundRect(ctx, x + 6, by, SIGN.badge, SIGN.badge, 10); ctx.fill();
      drawIcon(ctx, base.icon, x + 6 + (SIGN.badge - SIGN.icon) / 2, by + (SIGN.badge - SIGN.icon) / 2, SIGN.icon, semantic.surfaceRaised);
      cx = x + SIGN.badge + 8 + 24;
    }
    // Stufe / level
    if (circle) {
      ctx.fillStyle = capital ? semantic.accent : semantic.surfaceRaised;
      ctx.beginPath();
      if (capital) {
        // Hauptquartier: goldener Stern statt Kreis, auch bei Kartenzoom zu erkennen / headquarters: golden star instead of the circle, readable at map zoom too
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 16 : 29;
          ctx.lineTo(cx + Math.cos(a) * r, 33 + Math.sin(a) * r);
        }
        ctx.closePath();
      } else ctx.arc(cx, 32, 18, 0, Math.PI * 2);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4; ctx.strokeStyle = semantic.ink;
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = semantic.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `30px ${primitives.font.display}`;
      ctx.fillText(String(level), cx, 34);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `40px ${primitives.font.display}`;
    ctx.fillStyle = ink; ctx.lineWidth = 5; ctx.strokeStyle = semantic.ink; ctx.lineJoin = 'round';
    ctx.strokeText(text, x + left + tw / 2, 34, tw - 10);
    ctx.fillText(text, x + left + tw / 2, 34, tw - 10);
    // Ausbaufortschritt: Punkte bis zur naechsten Stufe / growth progress: pips to the next level
    if (need > 0) {
      const n = Math.min(need, 10);
      const filled = Math.round((Math.min(pop, need) / need) * n);
      const pw = 20, gap = 5, total = n * pw + (n - 1) * gap;
      const px = (W - total) / 2, py = 76 + tab;
      ctx.lineWidth = 3; ctx.strokeStyle = semantic.ink;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i < filled ? semantic.accent : semantic.surfaceRaised;
        roundRect(ctx, px + i * (pw + gap), py, pw, 18, 5); ctx.fill(); ctx.stroke();
      }
    }
  });
  const s = new THREE.Sprite(m);
  const k = SIGN.world / SIGN.width;
  s.scale.set(k * W, k * H, 1);
  s.renderOrder = 9;
  return s;
}

/** Zeile der Wettlauf-Plakette (m2) / row of the race badge (m2) */
export interface RaceRow { color: string; have: number; out: boolean }

/**
 * Wettlauf-Plakette ueber dem Mutterschiff (m2): je Fraktion eine Farbmarke und need Kaestchen, gefuellt in ihrer
 * Farbe; ausgeschiedene Forscher blass mit Strich.
 * Race badge above the mothership (m2): per faction a colour mark and need boxes filled in its colour; researchers that
 * are out are pale with a stroke.
 */
export function raceBadge(rows: RaceRow[], need: number): THREE.Sprite {
  const key = `race-${need}-${rows.map((r) => `${r.color}${r.have}${r.out ? 'x' : ''}`).join('|')}`;
  const rowH = 30, pad = 10, cell = 22, gap = 5, mark = 22;
  const W = pad * 2 + mark + 10 + need * cell + (need - 1) * gap, H = pad * 2 + rows.length * rowH;
  const m = material(key, W + 6, H + 6, (ctx) => {
    const ink = semantic.ink;
    ctx.fillStyle = ink;
    roundRect(ctx, 6, 6, W, H, 14); ctx.fill();
    ctx.fillStyle = semantic.surfaceRaised;
    roundRect(ctx, 2, 2, W, H, 14); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();
    rows.forEach((r, i) => {
      const y = pad + 2 + i * rowH + (rowH - cell) / 2;
      ctx.globalAlpha = r.out ? 0.35 : 1;
      ctx.lineWidth = 3; ctx.strokeStyle = ink;
      ctx.fillStyle = r.color;
      ctx.beginPath(); ctx.arc(pad + 2 + mark / 2, y + cell / 2, mark / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let k = 0; k < need; k++) {
        const x = pad + 2 + mark + 10 + k * (cell + gap);
        ctx.fillStyle = k < r.have ? r.color : semantic.surface;
        roundRect(ctx, x, y, cell, cell, 5); ctx.fill(); ctx.stroke();
      }
      if (r.out) {
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(pad + 2, y + cell / 2); ctx.lineTo(W - pad, y + cell / 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  });
  const sp = new THREE.Sprite(m);
  sp.scale.set(1.5, 1.5 * ((H + 6) / (W + 6)), 1);
  sp.renderOrder = 9;
  return sp;
}

/**
 * Stoerbild-Marke einer gehackten Stadt (HACK.city): Hack-Symbol und Restrunden auf einem Schild in der Farbe des Hackers,
 * dahinter versetzt eine zweite Kante in der Markierungsfarbe (Bildstoerung).
 * Glitch mark of a hacked city (HACK.city): hack icon and rounds left on a sign in the hacker's colour, with a second,
 * offset edge in the marker colour behind it (glitch).
 */
export function hackBadge(n: number, color: string, glitch: string): THREE.Sprite {
  const key = `hackcity-${n}-${color}-${glitch}`;
  const W = 132, H = 64;
  const m = material(key, W, H, (ctx) => {
    const ink = semantic.ink;
    ctx.fillStyle = glitch;
    roundRect(ctx, 10, 2, W - 16, H - 12, 14); ctx.fill();
    ctx.fillStyle = ink;
    roundRect(ctx, 6, 10, W - 14, H - 14, 14); ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, 2, 6, W - 14, H - 14, 14); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();
    // Stoerstreifen / glitch stripes
    ctx.fillStyle = glitch;
    for (const [y, w] of [[16, 30], [36, 18]]) ctx.fillRect(W - 24 - w, y, w, 4);
    drawIcon(ctx, 'hack', 10, 12, 36, semantic.white);
    ctx.fillStyle = semantic.white; ctx.font = `40px ${primitives.font.display}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.strokeText(`${n}`, 74, 31); ctx.fillText(`${n}`, 74, 31);
  });
  const sp = new THREE.Sprite(m);
  sp.scale.set(0.62, 0.62 * (H / W), 1);
  sp.renderOrder = 9;
  return sp;
}

/** Fadenkreuz ueber angreifbaren Feinden / crosshair above attackable enemies */
export function attackIcon(selected: boolean): THREE.Sprite {
  const key = `attack-${selected}`;
  const S = 128;
  const m = material(key, S, S, (ctx) => {
    const c = S / 2, r = 40;
    const ring = selected ? semantic.accent : semantic.dangerBright;
    // schwarzer Rand fuer Kontrast / black edge for contrast
    ctx.lineCap = 'round';
    ctx.strokeStyle = semantic.ink; ctx.lineWidth = 20;
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
    for (const [x1, y1, x2, y2] of [[c, 6, c, 34], [c, S - 34, c, S - 6], [6, c, 34, c], [S - 34, c, S - 6, c]]) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.strokeStyle = ring; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
    for (const [x1, y1, x2, y2] of [[c, 6, c, 34], [c, S - 34, c, S - 6], [6, c, 34, c], [S - 34, c, S - 6, c]]) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.fillStyle = semantic.ink; ctx.beginPath(); ctx.arc(c, c, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(c, c, 7, 0, Math.PI * 2); ctx.fill();
  });
  const s = new THREE.Sprite(m);
  s.scale.set(0.36, 0.36, 1);
  s.renderOrder = 11;
  return s;
}
