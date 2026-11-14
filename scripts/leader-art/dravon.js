// Kommandant Sarek Voss (dravon): kalter Militarist.
// Cold militarist: hard angular shapes, harsh top-down light, high-contrast blacks, rigid symmetric posture, narrow slit.
import { INK, cr, poly, Doc, P, T, L, tone, ellD, background, vignette, glowRect, eye, brow, sweat } from './common.js';

export default function render(level, mood = 'neutral') {
  const D = new Doc(level, mood);
  const B = D.B;
  const { ht, hatch, xh, b } = tone(D);
  const C = {
    bal: '#1f1e26', balHi: '#3f3e4c', balHi2: '#5e5d70',
    skin: '#e6c4a2', skinSh: '#b88f74', skinSh2: '#7e5f50', scar: '#efb3a8', scarDk: '#b8574f',
    camo: '#5f6b48', camo1: '#4d5c2e', camo2: '#7b8562', camo3: '#36401f', camoSh: '#2e351c',
    gold: '#d4a72c', goldSh: '#9c7618', goldHi: '#f6dc7a',
    mask: '#2e2b3a', maskSh: '#1c1a24', maskHi: '#4f4b62',
    iris: '#a9c9dc', irisDk: '#47657a', irisHi: '#e2f2fb', rim: '#f2d777',
  };
  const sh = (d, c, x = '') => P(d, c, x);

  // harsh top light, angular rays from above, heavy vignette
  background(D, { primary: '#2c3519', secondary: '#4d5c2e', glow: '#d4a72c', cx: 256, cy: 40, r: 520, stops: [[0, '#e0b843'], [0.22, '#a08a2c'], [0.45, '#4d5c2e'], [1, '#232a14']], rays: { n: 12, cx: 256, cy: -40, w: 0.25, op: 0.12, color: '#f2d777', rot: 0.13 }, htOp: 0.25 });

  // ---------- body: square, rigid, symmetric ----------
  const camoPatch = (seed) => {
    let s = '';
    const blobs = [[60, 440, 0], [140, 470, 1], [210, 420, 2], [330, 430, 0], [400, 470, 1], [460, 430, 2], [90, 500, 2], [300, 500, 1], [180, 510, 0], [420, 520, 0], [250, 470, 2], [30, 480, 1], [490, 490, 1], [120, 410, 1], [380, 405, 2]];
    const col = [C.camo1, C.camo2, C.camo3];
    for (const [x, y, c] of blobs) s += P(poly([[x - 22, y - 8], [x - 8, y - 18], [x + 18, y - 12], [x + 26, y + 4], [x + 6, y + 14], [x - 16, y + 10]]), col[c]);
    return s;
  };
  D.region(poly([[-4, 520], [-4, 446], [24, 412], [150, 388], [206, 372], [306, 372], [362, 388], [488, 412], [516, 446], [516, 520]]), C.camo, {
    sw: 5, rim: C.rim, rimOff: [0, 6],
    inner: camoPatch() +
      // top-down light: lit shoulder tops, dark lower body
      sh(poly([[-4, 470], [516, 470], [516, 520], [-4, 520]]), C.camoSh, 'opacity="0.55"') +
      sh(poly([[24, 412], [150, 388], [206, 372], [306, 372], [362, 388], [488, 412], [488, 420], [362, 398], [306, 384], [206, 384], [150, 398], [24, 420]]), C.goldHi, 'opacity="0.35"') +
      b(P(poly([[-4, 460], [516, 460], [516, 520], [-4, 520]]), 'url(#hatch)', 'opacity="0.3"') + T([[76, 430], [84, 470], [84, 510]], 2, INK, { op: 0.6 }) + T([[436, 430], [428, 470], [428, 510]], 2, INK, { op: 0.6 })) +
      // gold placket
      `<rect x="249" y="380" width="14" height="140" fill="${C.gold}" stroke="${INK}" stroke-width="3"/>` + sh(poly([[256, 380], [263, 380], [263, 520], [256, 520]]), C.goldSh) +
      L([[60, 436], [52, 520]], 3, INK) + L([[452, 436], [460, 520]], 3, INK),
  });
  // chest pockets with flaps
  for (const x of [150, 362]) {
    D.region(poly([[x - 34, 440], [x + 34, 440], [x + 34, 500], [x - 34, 500]]), C.camo2, { sw: 3.5, inner: camoPatch() + sh(poly([[x - 34, 488], [x + 34, 488], [x + 34, 500], [x - 34, 500]]), C.camoSh, 'opacity="0.5"') + b(L([[x - 28, 494], [x + 28, 494]], 1, INK, { op: 0.4 })) });
    D.region(poly([[x - 38, 428], [x + 38, 428], [x + 36, 450], [x, 456], [x - 36, 450]]), C.camo, { sw: 3.5, inner: sh(poly([[x - 38, 444], [x + 38, 444], [x + 36, 450], [x, 456], [x - 36, 450]]), C.camoSh) });
    D.region(ellD(x, 446, 5, 5), C.gold, { sw: 2, inner: sh(ellD(x + 2, x ? 448 : 448, 4, 4), C.goldSh) });
  }
  // gold fist emblem above the left pocket
  {
    const fx = 150, fy = 474;
    D.region(cr([[fx - 12, fy - 6, 1], [fx - 12, fy - 12], [fx - 6, fy - 15], [fx, fy - 13], [fx + 6, fy - 15], [fx + 12, fy - 12], [fx + 13, fy - 4], [fx + 12, fy + 6, 1], [fx + 8, fy + 16, 1], [fx - 8, fy + 16, 1], [fx - 12, fy + 6, 1]]), C.gold, {
      sw: 2.8, inner: sh(poly([[fx + 2, fy - 16], [fx + 14, fy - 16], [fx + 14, fy + 18], [fx + 2, fy + 18]]), C.goldSh) + L([[fx - 6, fy - 14], [fx - 6, fy - 4]], 1.4) + L([[fx, fy - 13], [fx, fy - 4]], 1.4) + L([[fx + 6, fy - 14], [fx + 6, fy - 4]], 1.4) + L([[fx - 12, fy - 2], [fx - 2, fy + 2], [fx + 6, fy - 2]], 1.6),
    });
  }
  // angular shoulder boards with gold piping
  for (const s of [-1, 1]) {
    const x0 = 256 + s * 120, x1 = 256 + s * 230;
    D.region(poly([[x0, 386], [x1, 404], [x1 + s * 8, 420], [x0 - s * 6, 404]]), C.camo, { sw: 4, inner: camoPatch() + sh(poly([[x0, 386], [x1, 404], [x1, 408], [x0, 392]]), C.goldHi, 'opacity="0.5"') });
    D.add(`<path d="M${x0 - s * 6} 404L${x1 + s * 8} 420" stroke="${INK}" stroke-width="7"/><path d="M${x0 - s * 6} 404L${x1 + s * 8} 420" stroke="${C.gold}" stroke-width="3.5"/>`);
    for (let i = 0; i < 3; i++) D.add(`<path d="M${x0 + s * (60 + i * 14)} ${396 + i * 2.5}l${s * 8} 2" stroke="${C.gold}" stroke-width="4" stroke-linecap="square"/>`);
  }
  // stand collar with gold piping
  D.region(poly([[196, 350], [316, 350], [328, 390], [270, 398], [242, 398], [184, 390]]), C.camo, { sw: 4.5, inner: camoPatch() + sh(poly([[184, 378], [328, 378], [328, 398], [184, 398]]), C.camoSh, 'opacity="0.6"') });
  D.add(`<path d="M186 388L242 396L270 396L326 388" stroke="${C.gold}" stroke-width="3" fill="none"/>`);

  // ---------- head: balaclava (rigid, centred, faceted) ----------
  D.region(poly([[206, 300], [306, 300], [318, 360], [194, 360]]), C.bal, { sw: 4.5, inner: sh(poly([[194, 330], [318, 330], [318, 360], [194, 360]]), INK, 'opacity="0.5"') });
  const head = cr([[256, 66], [306, 74], [340, 100], [356, 140, 1], [360, 200], [354, 262], [338, 304, 1], [300, 330], [256, 338], [212, 330], [174, 304, 1], [158, 262], [152, 200], [156, 140, 1], [172, 100], [206, 74]]);
  D.region(head, C.bal, {
    sw: 5, rim: C.rim, rimOff: [0, 6],
    inner: sh(cr([[200, 82], [256, 70], [312, 82], [300, 96], [256, 88], [212, 96]]), C.balHi) + sh(cr([[222, 78], [256, 74], [290, 78], [256, 82]]), C.balHi2) +
      sh(poly([[150, 280], [362, 280], [362, 340], [150, 340]]), INK, 'opacity="0.45"') +
      b(L([[172, 140], [168, 200], [176, 260]], 1.2, C.balHi, { op: 0.8 }) + L([[340, 140], [344, 200], [336, 260]], 1.2, C.balHi, { op: 0.8 }) + P(poly([[150, 250], [362, 250], [362, 340], [150, 340]]), 'url(#hatch)', 'opacity="0.25"')),
  });
  // forehead plate
  D.region(poly([[238, 130], [274, 130], [276, 152], [236, 152]]), C.gold, { sw: 3, inner: sh(poly([[256, 130], [276, 130], [276, 152], [256, 152]]), C.goldSh) + `<rect x="246" y="136" width="20" height="10" fill="none" stroke="${INK}" stroke-width="1.6"/>` });
  // eye slit: narrow, angular
  const slit = poly([[184, 188], [328, 184], [330, 230], [182, 234]]);
  const slitId = D.region(slit, C.skin, {
    sw: 0,
    inner: sh(poly([[180, 180], [334, 180], [334, 200], [180, 204]]), C.skinSh) + sh(poly([[180, 180], [334, 180], [334, 191], [180, 194]]), C.skinSh2) + b(P(poly([[180, 180], [334, 180], [334, 200], [180, 204]]), 'url(#dots)', 'opacity="0.3"')),
  });
  const cid = D.id('sl');
  D.def(`<clipPath id="${cid}"><use href="#${slitId}"/></clipPath>`);
  D.open(`clip-path="url(#${cid})"`);
  const narrow = mood === 'neutral' ? { m: { tk: 0.36, bk: 0.36 } } : {};
  eye(D, C, { cx: 222, cy: 214, w: 32, h: 13, inner: 1, lidW: 4.6, lidSh: 2, crease: false }, mood, { ...narrow, aScale: 1.1 });
  eye(D, C, { cx: 290, cy: 214, w: 32, h: 13, inner: -1, lidW: 4.6, lidSh: 2, crease: false }, mood, { ...narrow, aScale: 1.1 });
  brow(D, [[244, 202], [230, 198], [214, 198], [202, 201]], 6, { inner: 1, a: 0.05, b: 0.3 });
  brow(D, [[268, 202], [282, 198], [298, 198], [310, 201]], 6, { inner: -1, a: 0.05, b: 0.3, up: true });
  // scar with stitches across the left eyelid (viewer's right)
  const scarC = mood === 'angry' ? C.scarDk : C.scar;
  D.add(`<path d="M282 190L302 236" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/><path d="M282 190L302 236" stroke="${scarC}" stroke-width="3" stroke-linecap="round"/>`);
  for (const t of [0.22, 0.48, 0.74]) { const x = 282 + 20 * t, y = 190 + 46 * t; D.add(`<path d="M${x - 5} ${y + 1}L${x + 5} ${y - 3}" stroke="${INK}" stroke-width="1.6"/>`); }
  if (mood === 'angry') { D.ink([[254, 196], [256, 208]], 2.2, { op: 0.8 }); D.ink([[258, 196], [257, 206]], 1.4, { op: 0.6 }); }
  sweat(D, 196, 222, 0.8);
  D.close();
  D.add(`<use href="#${slitId}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="miter"/>`);

  // gas mask on the lower face
  D.region(cr([[204, 246, 1], [256, 238], [308, 246, 1], [318, 284], [300, 322, 1], [256, 334], [212, 322, 1], [194, 284]]), C.mask, {
    sw: 4.5, inner: sh(cr([[196, 290], [316, 290], [304, 324], [256, 336], [208, 324]]), C.maskSh) + sh(cr([[212, 250], [256, 243], [300, 250], [256, 252]]), C.maskHi) + b(L([[214, 262], [206, 290]], 1.2, C.maskHi) + L([[298, 262], [306, 290]], 1.2, C.maskHi)),
  });
  for (const s of [-1, 1]) D.region(poly([[256 + s * 58, 266], [256 + s * 76, 262], [256 + s * 80, 302], [256 + s * 60, 306]]), C.mask, { sw: 3.5, inner: sh(poly([[256 + s * 74, 262], [256 + s * 80, 262], [256 + s * 80, 306], [256 + s * 74, 306]]), C.gold) });
  D.region(ellD(256, 290, 34, 34), C.gold, { sw: 4.5, rim: '#fff3c0', rimOff: [0, 4], inner: sh(ellD(256, 296, 34, 30), C.goldSh) + sh(ellD(256, 270, 20, 6), C.goldHi) });
  D.region(ellD(256, 292, 24, 24), C.maskSh, {
    sw: 3, inner: [0, 1, 2, 3, 4, 5].map((i) => `<rect x="232" y="${274 + i * 7}" width="48" height="3.4" fill="${C.maskHi}"/>`).join('') + (mood === 'angry' ? `<circle cx="256" cy="292" r="24" fill="#ff5a3a" opacity="0.15"/>` : ''),
  });
  // throat mic + cable
  D.region(poly([[238, 340], [274, 340], [276, 358], [236, 358]]), C.maskSh, { sw: 3, inner: `<rect x="250" y="344" width="12" height="4" fill="${C.gold}"/>` });
  D.add(`<path d="M276 352C300 356 320 368 334 392" stroke="${INK}" stroke-width="6" fill="none"/><path d="M276 352C300 356 320 368 334 392" stroke="${C.maskHi}" stroke-width="2.5" fill="none"/>`);

  // harsh top light falloff over the whole figure
  D.add(glowRect(D, 0, 0, 0, 512, [[0, '#000', 0], [0.6, '#000', 0], [1, '#000', 0.35]]));
  vignette(D, '#0c0e06', B ? 0.6 : 0.5, 0.5);
  D.grain(0.35);
  return D.toString();
}
