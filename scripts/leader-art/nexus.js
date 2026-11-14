// KERN-0 (nexus): kalte Maschine.
// Cold machine: precise geometric shapes, perfect symmetry, cyan screen glow, grid and scanline background.
import { INK, cr, poly, Doc, P, T, L, tone, ellD, hexD, background, vignette } from './common.js';

export default function render(level, mood = 'neutral') {
  const D = new Doc(level, mood);
  const B = D.B;
  const { ht, hatch, xh, b } = tone(D);
  const C = {
    white: '#eef4f8', whiteSh: '#bccbd6', whiteSh2: '#8d9eac', dark: '#2a2836', darkSh: '#1a1922', darkHi: '#4c4a60',
    screen: '#0c1118', cyan: '#38f0ff', cyanDk: '#1f8fb3', red: '#ff4d5e', ice: '#dff6ff',
  };
  const sh = (d, c, x = '') => P(d, c, x);
  const glyph = mood === 'angry' ? C.red : C.cyan;

  background(D, { primary: '#1f8fb3', secondary: '#dff6ff', glow: '#ffffff', cx: 256, cy: 210, r: 400, stops: [[0, '#ffffff'], [0.25, '#dff6ff'], [0.7, '#58b3d2'], [1, '#1f8fb3']], grid: { size: 32, color: '#1f8fb3', op: 0.25, w: 1.2 }, scan: { color: '#0b4d63', op: 0.12 }, halftone: false });
  // symmetric data ticks on the grid
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) D.add(`<rect x="${256 + s * (176 + i * 32) - 4}" y="${112 + i * 32 - 4}" width="8" height="8" fill="${C.cyan}" opacity="0.55"/>`);

  // ---------- torso ----------
  D.region(poly([[20, 520], [28, 446], [60, 410], [150, 392], [206, 380], [306, 380], [362, 392], [452, 410], [484, 446], [492, 520]]), C.dark, {
    sw: 5, inner: sh(poly([[20, 480], [492, 480], [492, 520], [20, 520]]), C.darkSh) + b(hatch(poly([[20, 470], [492, 470], [492, 520], [20, 520]]), 0.3)),
  });
  // shoulder armour
  for (const s of [-1, 1]) {
    const x = 256 + s * 160;
    D.region(poly([[x - s * 40, 392], [x + s * 70, 404], [x + s * 92, 440], [x + s * 86, 466], [x + s * 50, 448], [x - s * 30, 430]]), C.white, {
      sw: 4.5, rim: C.cyan, rimOff: [0, 5], inner: sh(poly([[x + s * 50, 448], [x + s * 86, 466], [x + s * 92, 440], [x + s * 70, 430]]), C.whiteSh) + b(sh(poly([[x + s * 70, 450], [x + s * 86, 466], [x + s * 90, 452]]), C.whiteSh2)),
    });
  }
  // chest plates with vents
  for (const s of [-1, 1]) {
    const x0 = 256 + s * 14, x1 = 256 + s * 128;
    D.region(poly([[x0, 420], [x1, 414], [x1 - s * 6, 520], [x0, 520]]), C.white, {
      sw: 4.5, rim: C.cyan, rimOff: [0, 5],
      inner: sh(poly([[x0, 498], [x1, 498], [x1, 520], [x0, 520]]), C.whiteSh) + [0, 1, 2, 3].map((i) => `<rect x="${256 + s * (92 + i * 7) - 2}" y="440" width="4" height="40" fill="${C.cyanDk}"/>`).join('') +
        `<circle cx="${256 + s * 36}" cy="432" r="4" fill="${C.whiteSh2}" stroke="${INK}" stroke-width="1.5"/><circle cx="${256 + s * 112}" cy="430" r="4" fill="${C.whiteSh2}" stroke="${INK}" stroke-width="1.5"/>` + b(L([[x0 + s * 10, 470], [x1 - s * 20, 466]], 1, C.whiteSh2)),
    });
  }
  // hex emblem
  D.region(hexD(256, 456, 26, 0), C.dark, { sw: 4, inner: '' });
  D.add(`<path d="${hexD(256, 456, 20, 0)}" fill="none" stroke="${C.cyan}" stroke-width="3"/><circle cx="256" cy="456" r="8" fill="${C.cyan}" stroke="${INK}" stroke-width="2"/><circle cx="254" cy="454" r="2.4" fill="#fff"/>`);
  // neck
  D.region(poly([[220, 330], [292, 330], [300, 392], [212, 392]]), C.dark, { sw: 4.5, inner: sh(poly([[256, 330], [300, 330], [300, 392], [256, 392]]), C.darkSh) + `<rect x="210" y="352" width="92" height="9" fill="${C.whiteSh}" stroke="${INK}" stroke-width="2"/>` + `<rect x="210" y="372" width="92" height="4" fill="${C.cyan}"/>` });

  // ---------- antennae ----------
  for (const s of [-1, 1]) {
    D.add(`<path d="M${256 + s * 80} 86L${256 + s * 104} 28" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${256 + s * 80} 86L${256 + s * 104} 28" stroke="${C.darkHi}" stroke-width="3.6" stroke-linecap="round"/>`);
    D.add(`<circle cx="${256 + s * 104}" cy="26" r="16" fill="${C.cyan}" opacity="0.3"/><circle cx="${256 + s * 104}" cy="26" r="8" fill="${C.cyan}" stroke="${INK}" stroke-width="3"/><circle cx="${256 + s * 104 - 2}" cy="24" r="2.4" fill="#fff"/>`);
  }
  // ---------- head ----------
  for (const s of [-1, 1]) {
    const x = 256 + s * 112;
    D.region(poly([[x - 14, 158], [x + 14, 158], [x + 14, 262], [x - 14, 262]]), C.dark, { sw: 4, inner: `<rect x="${x + s * 4 - 3}" y="172" width="6" height="76" fill="${C.cyan}"/>` + sh(poly([[x - 14, 240], [x + 14, 240], [x + 14, 262], [x - 14, 262]]), C.darkSh) });
  }
  const head = poly([[176, 70], [336, 70], [356, 90], [356, 310], [336, 332], [176, 332], [156, 310], [156, 90]]);
  D.region(head, C.white, {
    sw: 5, rim: C.cyan, rimOff: [-5, 4],
    inner: sh(poly([[156, 90], [176, 70], [336, 70], [356, 90], [356, 98], [156, 98]]), '#ffffff') + sh(poly([[320, 98], [356, 98], [356, 310], [336, 332], [320, 332]]), C.whiteSh) +
      sh(poly([[156, 300], [356, 300], [356, 310], [336, 332], [176, 332], [156, 310]]), C.whiteSh) + b(sh(poly([[340, 98], [356, 98], [356, 310], [340, 326]]), C.whiteSh2) + ht(poly([[320, 120], [356, 120], [356, 300], [320, 300]]), 0.25)) +
      // panel seams & bolts
      L([[156, 132], [356, 132]], 2, INK, { op: 0.6 }) + L([[220, 70], [220, 98]], 1.6, INK, { op: 0.5 }) + L([[292, 70], [292, 98]], 1.6, INK, { op: 0.5 }) +
      [[170, 84], [342, 84], [170, 318], [342, 318]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${C.whiteSh2}" stroke="${INK}" stroke-width="1.6"/>`).join(''),
  });
  // hexagon lights
  D.add(`<rect x="252" y="76" width="8" height="26" fill="${C.cyan}" stroke="${INK}" stroke-width="2"/>`);
  for (const [x, r] of [[204, 15], [256, 17], [308, 15]]) {
    D.add(`<path d="${hexD(x, 114, r + 6, 0)}" fill="${C.cyan}" opacity="0.25"/>`);
    D.region(hexD(x, 114, r, 0), C.cyan, { sw: 3.5, inner: sh(hexD(x + 3, 117, r, 0), C.cyanDk, 'opacity="0.45"') + sh(hexD(x - 4, 110, r * 0.35, 0), '#fff', 'opacity="0.8"') });
  }
  // screen with bezel
  D.region(poly([[170, 140], [342, 140], [342, 288], [330, 298], [182, 298], [170, 288]]), C.dark, { sw: 4.5 });
  const scr = D.region(poly([[180, 148], [332, 148], [332, 284], [322, 290], [190, 290], [180, 284]]), C.screen, {
    sw: 2.5,
    inner: (mood === 'angry' ? sh(poly([[180, 148], [332, 148], [332, 290], [180, 290]]), C.red, 'opacity="0.12"') : sh(poly([[180, 148], [332, 148], [332, 290], [180, 290]]), C.cyan, 'opacity="0.06"')) +
      [0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="180" y="${158 + i * 19}" width="152" height="1.4" fill="${glyph}" opacity="0.28"/>`).join('') +
      b(`<rect x="180" y="148" width="152" height="142" fill="url(#scan)" opacity="0.5"/>`) + sh(poly([[180, 148], [240, 148], [196, 290], [180, 290]]), '#fff', 'opacity="0.05"'),
  });
  // glyph face: drawn twice (soft glow + crisp)
  const G = [];
  const bar = (x1, y1, x2, y2, w) => G.push(['l', `M${x1} ${y1}L${x2} ${y2}`, w]);
  const shape = (d) => G.push(['f', d]);
  const ring = (cx, cy, r, w) => G.push(['l', `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`, w]);
  if (mood === 'neutral') {
    bar(200, 172, 228, 168, 6); bar(284, 168, 312, 172, 6);
    shape(poly([[200, 184], [230, 184], [230, 208], [200, 208]])); shape(poly([[282, 184], [312, 184], [312, 208], [282, 208]]));
    G.push(['l', 'M218 246Q256 274 294 246', 6]);
    shape(ellD(198, 246, 5, 5)); shape(ellD(314, 246, 5, 5));
  } else if (mood === 'angry') {
    bar(198, 168, 232, 184, 8); bar(314, 168, 280, 184, 8);
    shape(poly([[198, 190], [232, 198], [232, 212], [198, 208]])); shape(poly([[314, 190], [280, 198], [280, 212], [314, 208]]));
    G.push(['l', 'M214 258L226 248L238 258L250 248L262 258L274 248L286 258L298 248', 5]);
  } else if (mood === 'smug') {
    bar(200, 172, 228, 172, 6); bar(282, 160, 312, 152, 6);
    G.push(['l', 'M200 198Q215 190 230 198', 6]); shape(poly([[282, 180], [312, 180], [312, 204], [282, 204]]));
    G.push(['l', 'M224 252Q262 262 296 238', 6]); shape(ellD(314, 240, 5, 5));
  } else {
    bar(200, 160, 228, 154, 6); bar(284, 154, 312, 160, 6);
    ring(215, 192, 15, 5); ring(297, 192, 15, 5); shape(ellD(215, 192, 4, 4)); shape(ellD(297, 192, 4, 4));
    ring(256, 252, 13, 5);
  }
  const draw = (col, extra, wk) => G.map(([k, d, w]) => (k === 'l' ? `<path d="${d}" stroke="${col}" stroke-width="${w * wk}" fill="none" stroke-linecap="square" stroke-linejoin="miter"${extra}/>` : `<path d="${d}" fill="${col}"${extra} ${wk > 1 ? `stroke="${col}" stroke-width="${6 * (wk - 1)}"` : ''}/>`)).join('');
  const cid = D.id('sg');
  D.def(`<clipPath id="${cid}"><use href="#${scr}"/></clipPath>`);
  D.add(`<g clip-path="url(#${cid})">${draw(glyph, ' opacity="0.3"', 2.2)}${draw(glyph, '', 1)}${mood === 'neutral' || mood === 'smug' ? `<rect x="${mood === 'smug' ? 286 : 203}" y="187" width="9" height="7" fill="#fff"/>${mood === 'neutral' ? '<rect x="285" y="187" width="9" height="7" fill="#fff"/>' : ''}` : ''}</g>`);
  if (mood === 'shocked') D.add(`<path d="M150 70l-14 -12M362 70l14 -12M256 50v-16" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
  // screen glow spilling onto the chin plate and chest
  D.add(`<path d="M182 300H330L336 332H176Z" fill="${glyph}" opacity="0.18"/>`);
  vignette(D, '#0b3d52', B ? 0.4 : 0.3, 0.6);
  D.grain(0.22);
  return D.toString();
}
