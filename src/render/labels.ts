/** Comic-Plaketten fuer LP und Staedtenamen (Canvas-Sprites) / comic badges for HP and city names (canvas sprites) */
import * as THREE from 'three';
import { primitives, semantic } from '../design/tokens';

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

export interface BadgeInfo { hp: number; maxHp: number; color: string; ink: string; veteran: boolean; done: boolean; fuel: number | null; maxFuel: number }

/** LP-Plakette / HP badge */
export function hpBadge(b: BadgeInfo): THREE.Sprite {
  const key = `hp-${b.hp}-${b.maxHp}-${b.color}-${b.veteran}-${b.done}-${b.fuel}`;
  const W = 128, H = b.fuel !== null ? 84 : 64;
  const m = material(key, W, H, (ctx) => {
    const ink = semantic.ink;
    ctx.globalAlpha = b.done ? 0.62 : 1;
    ctx.fillStyle = ink;
    roundRect(ctx, 6, 6, W - 10, 52, 16); ctx.fill();
    ctx.fillStyle = b.color;
    roundRect(ctx, 2, 2, W - 10, 52, 16); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();
    ctx.fillStyle = b.ink;
    ctx.font = `44px ${primitives.font.display}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txt = `${Math.max(0, Math.ceil(b.hp))}`;
    ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.strokeText(txt, (W - 10) / 2 + 2 + (b.veteran ? 10 : 0), 31);
    ctx.fillText(txt, (W - 10) / 2 + 2 + (b.veteran ? 10 : 0), 31);
    if (b.veteran) {
      ctx.fillStyle = semantic.accent; ctx.strokeStyle = ink; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 7 : 16;
        ctx.lineTo(26 + Math.cos(a) * r, 29 + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
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
export function cityLabel(name: string, level: number, color: string, ink: string, capital: boolean): THREE.Sprite {
  const key = `city-${name}-${level}-${color}-${capital}`;
  const W = 320, H = 80;
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
  });
  const s = new THREE.Sprite(m);
  s.scale.set(0.95, 0.95 * (H / W), 1);
  s.renderOrder = 9;
  return s;
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
