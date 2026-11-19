/** Comic-Plaketten fuer LP und Staedtenamen (Canvas-Sprites) / comic badges for HP and city names (canvas sprites) */
import * as THREE from 'three';
import { primitives, semantic } from '../design/tokens';
import { BADGE } from './config';

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

/** sin = Fraktion als Suender gezeichnet, blessed = Maertyrer-Segen (Heiliges Alvenia) / sin = faction marked as a sinner, blessed = Martyr's Blessing (Holy Alvenia) */
export interface BadgeInfo { hp: number; maxHp: number; color: string; ink: string; veteran: boolean; done: boolean; fuel: number | null; maxFuel: number; sin?: boolean; blessed?: boolean }

/** LP-Plakette / HP badge */
export function hpBadge(b: BadgeInfo): THREE.Sprite {
  const key = `hp-${b.hp}-${b.maxHp}-${b.color}-${b.veteran}-${b.done}-${b.fuel}-${!!b.sin}-${!!b.blessed}`;
  const W = 128, H = b.fuel !== null ? 84 : 64;
  const m = material(key, W, H, (ctx) => {
    const ink = semantic.ink;
    ctx.globalAlpha = b.done ? 0.62 : 1;
    // Schild nur so breit wie die Zahl (volle Breite mit Stern oder Suendenzeichen): verdeckt weniger von der Einheit dahinter
    // pill only as wide as the number (full width with a star or sinner mark): hides less of the unit behind it
    const txt = `${Math.max(0, Math.ceil(b.hp))}`;
    ctx.font = `44px ${primitives.font.display}`;
    const full = W - 10;
    const pw = b.veteran || b.sin ? full : Math.min(full, Math.max(BADGE.minPill, Math.ceil(ctx.measureText(txt).width) + BADGE.pad * 2));
    const px = (full - pw) / 2;
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
    ctx.fillStyle = b.ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.strokeText(txt, full / 2 + 2 + (b.veteran ? 10 : 0), 31);
    ctx.fillText(txt, full / 2 + 2 + (b.veteran ? 10 : 0), 31);
    if (b.veteran) {
      ctx.fillStyle = semantic.accent; ctx.strokeStyle = ink; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 7 : 16;
        ctx.lineTo(26 + Math.cos(a) * r, 29 + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Suendenzeichen: roter Kreis mit gesprungenem Sonnenkranz rechts / sinner mark: red disc with a cracked sun halo on the right
    if (b.sin) {
      const cx = W - 26, cy = 29;
      ctx.fillStyle = semantic.sinMark; ctx.strokeStyle = ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = semantic.textInverse; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 8, -Math.PI * 0.35, Math.PI * 1.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 13); ctx.lineTo(cx - 3, cy - 4); ctx.lineTo(cx + 2, cy); ctx.lineTo(cx - 1, cy + 5); ctx.stroke();
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
  s.scale.set(0.42, 0.42 * (H / W), 1);
  s.renderOrder = 10;
  return s;
}

/** Stadtschild / city sign */
/** level als Text: '' = leerer Kreis (Nachschublinie) / level as text: '' = empty circle (supply line) */
export function cityLabel(name: string, level: number | string, color: string, ink: string, capital: boolean, pop = 0, need = 0): THREE.Sprite {
  const key = `city-${name}-${level}-${color}-${capital}-${pop}-${need}`;
  const W = 320, H = need > 0 ? 112 : 80;
  const m = material(key, W, H, (ctx) => {
    ctx.font = `40px ${primitives.font.display}`;
    const text = name.toUpperCase();
    const tw = Math.min(W - 80, ctx.measureText(text).width + 30);
    const x = (W - tw - 46) / 2;
    ctx.fillStyle = semantic.ink;
    roundRect(ctx, x + 5, 7, tw + 46, 60, 14); ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x, 2, tw + 46, 60, 14); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = semantic.ink; ctx.stroke();
    // Stufe / level
    ctx.fillStyle = capital ? semantic.accent : semantic.surfaceRaised;
    ctx.beginPath(); ctx.arc(x + 26, 32, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = semantic.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `30px ${primitives.font.display}`;
    ctx.fillText(String(level), x + 26, 34);
    ctx.font = `40px ${primitives.font.display}`;
    ctx.fillStyle = ink; ctx.lineWidth = 5; ctx.strokeStyle = semantic.ink;
    ctx.strokeText(text, x + 46 + tw / 2, 34, tw - 10);
    ctx.fillText(text, x + 46 + tw / 2, 34, tw - 10);
    // Ausbaufortschritt: Punkte bis zur naechsten Stufe / growth progress: pips to the next level
    if (need > 0) {
      const n = Math.min(need, 10);
      const filled = Math.round((Math.min(pop, need) / need) * n);
      const pw = 20, gap = 5, total = n * pw + (n - 1) * gap;
      const px = (W - total) / 2, py = 76;
      ctx.lineWidth = 3; ctx.strokeStyle = semantic.ink;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i < filled ? semantic.accent : semantic.surfaceRaised;
        roundRect(ctx, px + i * (pw + gap), py, pw, 18, 5); ctx.fill(); ctx.stroke();
      }
    }
  });
  const s = new THREE.Sprite(m);
  s.scale.set(0.95, 0.95 * (H / W), 1);
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
