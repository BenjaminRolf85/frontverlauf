// Admiralin Coralie Nerezza (meridon): verschlagene Spielerin.
// Sly gambler: asymmetric, cocked brow, dramatic side light, monocle glint, flipped gold coin, leaning in.
import { INK, cr, taper, Doc, P, T, L, tone, ellD, star, background, vignette, eye, brow, mouth, frown, sweat, epaulette } from './common.js';

export default function render(level, mood = 'neutral') {
  const D = new Doc(level, mood);
  const B = D.B;
  const { ht, hatch, xh, b } = tone(D);
  const C = {
    skin: '#f0c9a2', skinSh: '#c58c6e', skinSh2: '#94604f', skinHi: '#fff0d8', blush: '#ee8a72',
    hair: '#d9b46e', hairSh: '#a8823f', hairSh2: '#7c5c27', hairHi: '#f6e1a8',
    teal: '#1fa6a0', tealSh: '#157a76', tealSh2: '#0d5552', tealHi: '#5fd2c9',
    orange: '#f08a24', orangeSh: '#c0631a', orangeHi: '#ffc070',
    gold: '#f2b51d', goldSh: '#c4841a', goldSh2: '#8a560f', goldHi: '#ffe68a',
    feather: '#fbfaf4', featherSh: '#c9cfd6',
    lip: '#d06a5e', lipSh: '#a44c46', lipHi: '#f3a495',
    iris: '#2f9d9a', irisDk: '#145553', irisHi: '#8de0d8', rim: '#ffb35c',
  };
  const sh = (d, c, x = '') => P(d, c, x);

  // dramatic side light from the right
  background(D, { primary: '#1fa6a0', secondary: '#f08a24', glow: '#ffd08a', cx: 470, cy: 170, r: 520, stops: [[0, '#ffd08a'], [0.25, '#f08a24'], [0.6, '#1fa6a0'], [1, '#0f5f5c']], rays: { n: 20, cx: 470, cy: 170, op: 0.12, w: 0.4 }, htOp: 0.22 });
  // flipped gold coin with motion arc (in her line of sight)
  {
    const x = 92, y = 118;
    D.add(`<path d="M${x + 30} 300C${x - 20} 250 ${x - 30} 180 ${x - 4} ${y + 30}" stroke="#fff" stroke-width="3" fill="none" stroke-dasharray="2 9" stroke-linecap="round" opacity="0.8"/>`);
    D.region(ellD(x, y, 24, 16, -24), C.goldSh, { sw: 4 });
    D.region(ellD(x - 2, y - 3, 23, 15, -24), C.gold, { sw: 3.5, inner: sh(ellD(x + 4, y + 3, 22, 14, -24), C.goldSh) + sh(ellD(x - 8, y - 7, 9, 3, -24), C.goldHi) });
    D.add(`<path d="${star(x - 2, y - 3, 8, 3.4, -100)}" fill="${C.goldSh}" stroke="${INK}" stroke-width="1.4" transform="rotate(-24 ${x} ${y}) scale(1 1) "/>`);
    D.add(`<path d="M${x + 18} ${y - 22}l4 -10l4 10l10 4l-10 4l-4 10l-4 -10l-10 -4z" fill="#fff"/>`);
  }

  // ---------- coat: leaning in, near shoulder raised and forward ----------
  D.region(cr([[22, 520, 1], [30, 486], [56, 456], [104, 434], [166, 414], [218, 396], [254, 380], [300, 374], [352, 358], [412, 362], [464, 380], [500, 408], [518, 448], [518, 520, 1]]), C.teal, {
    sw: 5, rim: C.rim, rimOff: [-8, 2],
    inner: sh(cr([[22, 520], [30, 486], [60, 454], [110, 432], [166, 414], [200, 410], [190, 460], [170, 520]]), C.tealSh) +
      sh(cr([[220, 398], [300, 378], [300, 410], [250, 420]]), C.tealSh) +
      b(sh(cr([[22, 520], [34, 490], [64, 462], [100, 450], [100, 520]]), C.tealSh2) + hatch(cr([[24, 520], [40, 480], [80, 460], [96, 520]]), 0.35) + T([[440, 420], [446, 460], [444, 500]], 2, INK, { op: 0.5 })) +
      sh(cr([[350, 362], [412, 366], [462, 384], [496, 410], [470, 404], [420, 386], [370, 378]]), C.tealHi) +
      L([[110, 460], [100, 500], [98, 520]], 3, INK) + L([[468, 440], [478, 480], [480, 520]], 3, INK),
  });
  // lapels with gold edge
  D.region(cr([[256, 386, 1], [236, 430], [222, 480], [214, 520, 1], [186, 520, 1], [196, 470], [214, 424], [236, 396]]), C.tealSh, { sw: 4, inner: sh(cr([[256, 386], [236, 430], [222, 480], [214, 520], [208, 520], [220, 470], [232, 426], [250, 392]]), C.gold) });
  D.region(cr([[300, 380, 1], [322, 420], [336, 470], [342, 520, 1], [380, 520, 1], [368, 466], [346, 414], [322, 386]]), C.teal, { sw: 4, inner: sh(cr([[300, 380], [322, 420], [336, 470], [342, 520], [348, 520], [342, 466], [328, 418], [306, 382]]), C.gold) + sh(cr([[322, 386], [346, 414], [368, 466], [380, 520], [366, 520], [354, 466], [336, 418]]), C.tealHi) });
  for (const [x, y] of [[248, 452], [244, 496], [322, 448], [326, 494]]) D.region(ellD(x, y, 7, 7), C.gold, { sw: 2.5, inner: sh(ellD(x - 2.5, y + 2.5, 5.5, 5.5), C.goldSh) + sh(ellD(x + 2, y - 2, 2, 2), C.goldHi) });
  epaulette(D, C, 112, 432, 38, 12, -24, -1, { rim: '#fff3c0' });
  epaulette(D, C, 450, 380, 58, 18, 14, 1, { rim: '#fff3c0' });

  // ======== head group: leaning in, tilted ========
  D.open('transform="translate(-6 18) rotate(-8 280 360) scale(1.06)"');
  // back hair
  D.region(cr([[190, 110], [160, 140], [150, 190], [154, 250], [168, 300], [196, 330], [240, 340], [300, 336], [338, 318], [360, 280], [366, 220], [358, 160], [330, 116], [270, 100]]), C.hair, {
    sw: 4.5, rim: C.rim, rimOff: [-6, 0],
    inner: sh(cr([[150, 160], [190, 150], [196, 240], [200, 320], [168, 300]]), C.hairSh) + b(sh(cr([[152, 200], [176, 200], [180, 290], [168, 300]]), C.hairSh2)) +
      T([[172, 180], [170, 240], [186, 300]], 2.2, INK, { a: 0.3, b: 0.4 }) + b([0, 1, 2].map((i) => L([[180 + i * 6, 160], [176 + i * 6, 230], [190 + i * 6, 300]], 0.9, C.hairSh2, { op: 0.7 })).join('')),
  });
  // neck
  D.region(cr([[248, 300], [246, 340], [242, 384, 1], [324, 384, 1], [320, 330], [318, 270], [290, 280]]), C.skin, {
    sw: 4, inner: sh(cr([[236, 300], [266, 322], [300, 304], [320, 276], [320, 340], [270, 344], [236, 330]]), C.skinSh) + sh(cr([[236, 296], [252, 300], [254, 390], [236, 390]]), C.skinSh2) + b(xh(cr([[246, 310], [276, 328], [306, 306], [316, 320], [280, 344], [246, 336]]), 0.25)),
  });
  // orange cravat
  D.region(cr([[244, 352], [272, 364], [306, 350], [314, 372], [300, 390], [312, 408], [292, 420], [278, 404], [262, 420], [244, 408], [254, 390], [238, 372]]), C.orange, {
    sw: 4, rim: C.rim, inner: sh(cr([[240, 370], [262, 380], [256, 410], [244, 410]]), C.orangeSh) + sh(cr([[282, 368], [306, 360], [300, 380], [286, 380]]), C.orangeHi) + L([[262, 372], [272, 396]], 2, INK, { op: 0.6 }) + L([[290, 372], [284, 398]], 2, INK, { op: 0.6 }) + b(ht(cr([[240, 372], [262, 382], [258, 412], [244, 410]]), 0.3)),
  });
  // face (light from the right: far half in deep shadow)
  D.region(cr([[204, 120], [186, 150], [178, 184], [184, 201], [180, 220], [186, 246], [198, 272], [214, 296], [234, 314], [252, 320], [274, 313], [302, 294], [322, 266], [334, 234], [340, 200], [336, 150], [310, 116], [256, 104]]), C.skin, {
    sw: 4.5, rim: C.rim, rimOff: [-7, 0],
    inner: sh(cr([[170, 130], [214, 128], [222, 170], [218, 200], [224, 232], [214, 248], [222, 262], [232, 280], [244, 300], [252, 322], [200, 320], [170, 260]]), C.skinSh) +
      b(sh(cr([[170, 150], [196, 150], [198, 210], [196, 260], [216, 300], [236, 322], [190, 320], [170, 260]]), C.skinSh2) + ht(cr([[170, 140], [214, 140], [220, 200], [218, 250], [240, 300], [250, 322], [196, 322], [170, 260]]), 0.25)) +
      sh(cr([[180, 168], [330, 158], [330, 178], [250, 186], [180, 186]]), C.skinSh, 'opacity="0.6"') +
      sh(cr([[290, 214], [312, 220], [318, 246], [300, 260], [288, 238]]), C.skinHi) + sh(cr([[234, 214], [240, 236], [238, 248], [232, 238]]), C.skinHi) +
      sh(ellD(288, 246, 13, 7, -10), C.blush, 'opacity="0.35"'),
  });
  // ear (near side, hair tucked behind) + gold hoop earring
  D.region(cr([[324, 206], [336, 196], [350, 204], [352, 226], [344, 248], [332, 256], [324, 248]]), C.skin, { sw: 4, rim: C.rim, inner: sh(cr([[332, 212], [344, 210], [344, 232], [336, 246], [330, 240], [336, 228]]), C.skinSh) });
  D.ink([[332, 206], [344, 210], [346, 228], [338, 244]], 2, { a: 0.2, b: 0.4 });
  D.add(`<circle cx="338" cy="266" r="10" fill="none" stroke="${INK}" stroke-width="6"/><circle cx="338" cy="266" r="10" fill="none" stroke="${C.gold}" stroke-width="3"/>`);
  if (B) D.add(`<circle cx="345" cy="260" r="1.6" fill="#fff"/>`);
  // eyes: monocle eye squints, near brow cocked
  const sly = mood === 'neutral';
  eye(D, C, { cx: 204, cy: 209, w: 28, h: 13, inner: 1, fx: 0.8, lidW: 4.4, flick: true, look: [1.5, 0] }, mood, sly ? { m: { tk: 0.26, bk: 0.3, topX: -0.2 } } : {});
  eye(D, C, { cx: 264, cy: 206, w: 38, h: 16.5, inner: -1, lidW: 5, flick: true, look: [-2, 0], lashes: [[[283, 205], [289, 205]], [[281, 201], [287, 196]]] }, mood, sly ? { m: { tk: 0.62 } } : {});
  brow(D, [[218, 185], [206, 181], [194, 182], [185, 187]], 4.8, { inner: 1, fill: C.hairSh2 });
  brow(D, [[242, 185], [254, 176], [270, 174], [287, 182]], 5.2, { inner: -1, fill: C.hairSh2, up: true, neutralUp: 7 });
  frown(D, 229, 192);
  // monocle (drops on its chain when shocked)
  const mdy = mood === 'shocked' ? 70 : 0, mdx = mood === 'shocked' ? -6 : 0;
  {
    const mx = 205 + mdx, my = 211 + mdy;
    D.add(`<path d="M${mx - 14} ${my + 16}C${mx - 22} 300 ${mx - 6} 340 ${226} 420" stroke="${INK}" stroke-width="3.6" fill="none" stroke-dasharray="4 3"/><path d="M${mx - 14} ${my + 16}C${mx - 22} 300 ${mx - 6} 340 226 420" stroke="${C.gold}" stroke-width="2" fill="none" stroke-dasharray="4 3"/>`);
    D.add(`<circle cx="${mx}" cy="${my}" r="19" fill="#dff6f2" opacity="0.18"/><circle cx="${mx}" cy="${my}" r="19" fill="none" stroke="${INK}" stroke-width="8"/><circle cx="${mx}" cy="${my}" r="19" fill="none" stroke="${C.gold}" stroke-width="4"/><path d="M${mx + 6} ${my - 20}A21 21 0 0 1 ${mx + 21} ${my - 4}" stroke="${C.goldHi}" stroke-width="2" fill="none"/>`);
    // glint
    D.add(`<path d="M${mx + 16} ${my - 24}l3 -9l3 9l9 3l-9 3l-3 9l-3 -9l-9 -3z" fill="#fff" stroke="${INK}" stroke-width="1"/>`);
    if (B) D.add(`<path d="M${mx - 12} ${my + 4}L${mx - 2} ${my - 12}" stroke="#fff" stroke-width="2.5" opacity="0.7" stroke-linecap="round"/>`);
  }
  // nose (slightly pointed)
  D.ink([[228, 206], [226, 222], [218, 238], [212, 247]], 2.4, { a: 0.6, b: 0.1, min: 0.05 });
  D.ink([[212, 247], [216, 253], [226, 254]], 2.8, { a: 0.1, b: 0.3 });
  D.ink([[233, 254], [241, 251], [242, 245]], 2.4, { a: 0.3, b: 0.4 });
  D.ink([[223, 251.5], [227, 250.5], [230, 252]], 2.4, { op: 0.8 });
  // lopsided grin
  mouth(D, { cx: 236, cy: 276, w: 48, lf: 0.4, lips: C, full: 0.55, smile: 9, farSmile: -1 }, mood, { smugLift: 12 });
  if (mood === 'neutral' || mood === 'smug') D.region(cr([[244, 275], [266, 266], [262, 271], [246, 278]]), '#fbf6ea', { sw: 1.4 });
  D.add(`<circle cx="276" cy="262" r="2.6" fill="${INK}"/>`); // beauty mark
  // front hair: centre parting, curtain locks
  D.region(cr([[252, 112], [228, 118], [206, 134], [190, 162], [182, 200], [184, 230], [190, 226], [196, 196], [208, 166], [226, 142], [250, 128]]), C.hair, { sw: 4, inner: sh(cr([[188, 170], [196, 168], [192, 220], [186, 226]]), C.hairSh) + T([[230, 124], [210, 150], [198, 184]], 1.8, C.hairSh2) });
  D.region(cr([[254, 112], [282, 118], [310, 134], [328, 160], [334, 196], [330, 210], [322, 190], [310, 162], [286, 140], [258, 128]]), C.hair, { sw: 4, rim: C.rim, rimOff: [-6, 0], inner: sh(cr([[290, 130], [324, 160], [330, 196], [320, 170]]), C.hairHi) + T([[276, 124], [300, 146], [318, 176]], 1.8, C.hairSh2) });
  // braid over the near shoulder
  {
    const pts = [[346, 236], [356, 270], [364, 302], [370, 334], [372, 366], [374, 398], [376, 430]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [x2, y2] = pts[i + 1], s = i % 2 ? 1 : -1;
      D.region(cr([[x - 13, y], [x, y - 4], [x + 13, y + 2], [x2 + 12 * s, (y + y2) / 2 + 6], [x2, y2 + 2], [x2 - 12, y2 - 2]]), C.hair, { sw: 3.5, inner: sh(cr([[x + 2, y], [x + 13, y + 2], [x2 + 10, y2], [x2, y2]]), C.hairSh) + sh(ellD(x - 4, y + 8, 4, 8, -20), C.hairHi) });
    }
    D.region(cr([[368, 430], [384, 430], [388, 446], [372, 448]]), C.orange, { sw: 3 });
    D.region(cr([[370, 446], [386, 446], [392, 480, 1], [376, 474], [364, 480, 1]]), C.hair, { sw: 3, inner: L([[378, 452], [378, 474]], 1.2, C.hairSh2) });
  }
  // tricorn hat with gold trim and a white feather
  D.region(taper([[300, 92], [342, 54], [392, 26], [440, 16]], 26, { a: 0.1, b: 0.6, min: 0.15 }), C.feather, {
    sw: 3.5, inner: L([[300, 92], [342, 54], [392, 26], [440, 16]], 1.6, C.featherSh) + [0, 1, 2, 3, 4, 5].map((i) => L([[318 + i * 18, 72 - i * 9], [326 + i * 18, 86 - i * 10]], 1.2, C.featherSh)).join('') + sh(cr([[310, 96], [350, 66], [400, 40], [350, 76]]), C.featherSh),
  });
  D.region(cr([[192, 122], [196, 84], [232, 62], [290, 58], [334, 76], [348, 112]]), C.teal, {
    sw: 5, rim: C.rim, rimOff: [-7, 0], inner: sh(cr([[190, 80], [236, 62], [240, 120], [190, 124]]), C.tealSh) + sh(cr([[280, 64], [330, 76], [344, 110], [312, 100]]), C.tealHi) + b(ht(cr([[192, 84], [234, 64], [236, 118], [192, 122]]), 0.3)),
  });
  const brim = cr([[146, 106, 1], [186, 122], [206, 150, 1], [240, 132], [300, 124], [396, 106, 1], [368, 92], [300, 98], [240, 96], [182, 98]]);
  D.region(brim, C.teal, {
    sw: 5, rim: C.rim, rimOff: [-7, 0],
    inner: sh(cr([[140, 100], [188, 104], [210, 150], [186, 122]]), C.tealSh2) + sh(cr([[206, 150], [240, 128], [240, 140], [214, 156]]), C.tealSh) + sh(cr([[300, 100], [368, 94], [396, 106], [300, 116]]), C.tealHi) +
      `<path d="${cr([[150, 106], [188, 120], [206, 146], [240, 128], [300, 120], [390, 106]], false)}" fill="none" stroke="${C.gold}" stroke-width="6"/>` + b(L([[154, 104], [190, 116], [206, 140]], 1, C.goldSh)),
  });
  // gold cockade
  D.region(ellD(232, 112, 10, 10), C.gold, { sw: 3, inner: sh(ellD(235, 115, 8, 8), C.goldSh) });
  D.region(star(232, 112, 6, 2.6), C.goldHi, { sw: 1.2 });
  sweat(D, 318, 168);
  D.close();

  vignette(D, '#0a3a38', B ? 0.4 : 0.3, 0.55, 300, 220);
  D.grain(0.3);
  return D.toString();
}
