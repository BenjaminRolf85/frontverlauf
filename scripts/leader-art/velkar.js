// Direktor Aurel Kesh (velkar): exzentrisches Genie.
// Eccentric genius: off-kilter tilt, wild hair, slightly manic eyes, green lab glow from below, sparks.
import { INK, cr, taper, Doc, P, T, L, tone, ellD, hexD, background, vignette, glowRect, eye, brow, mouth, frown, sweat, rng } from './common.js';

export default function render(level, mood = 'neutral') {
  const D = new Doc(level, mood);
  const B = D.B;
  const { ht, hatch, xh, b } = tone(D);
  const C = {
    skin: '#ecc9a6', skinSh: '#b99a86', skinSh2: '#8e7468', skinHi: '#f6e9c8', skinLit: '#e3e6b2',
    hair: '#f4f2ea', hairSh: '#c4c7b4', hairSh2: '#93988a', hairHi: '#ffffff',
    coat: '#f1f2ee', coatSh: '#c0c8cc', coatSh2: '#8f9aa3', coatLit: '#e6f3d6',
    vest: '#7b8591', vestSh: '#5a636e', vestSh2: '#424a54', vestHi: '#a3adb8',
    green: '#8fd16a', greenSh: '#5d9e3e', greenHi: '#d2f7b4',
    brass: '#d1a440', brassSh: '#946c22', brassSh2: '#664712', brassHi: '#f7dd85',
    lens: '#9fe6cc', lensSh: '#5fae96', strap: '#3b302c', strapHi: '#6e5a50',
    dark: '#2b2935', darkHi: '#5c5a70',
    lip: '#c4877a', lipSh: '#9c6459', lipHi: '#e2ad9e',
    iris: '#4aa35a', irisDk: '#1f5a2c', irisHi: '#b4ec92', rim: '#b6f08c',
  };
  const sh = (d, c, x = '') => P(d, c, x);

  // lab glow rising from below
  background(D, { primary: '#aab8c2', secondary: '#8fd16a', glow: '#d8f7b8', cx: 256, cy: 470, r: 520, stops: [[0, '#d8f7b8'], [0.3, '#8fd16a'], [1, '#aab8c2']], rays: { n: 16, cx: 256, cy: 470, op: 0.12, w: 0.35 }, htOp: 0.16 });
  // sparks
  const R = rng(11);
  const bolt = (x, y, s, rot) => {
    const pts = [[0, 0], [8, 10], [3, 12], [14, 26], [5, 16], [10, 14]].map(([a, c]) => [x + (a * Math.cos(rot) - c * Math.sin(rot)) * s, y + (a * Math.sin(rot) + c * Math.cos(rot)) * s]);
    D.add(`<path d="M${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L')}Z" fill="#f6ff9e" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`);
  };
  bolt(70, 120, 1.6, -0.3); bolt(430, 70, 1.3, 0.4); bolt(452, 270, 1.1, 0.9); bolt(46, 330, 1, -0.8);
  for (let i = 0; i < (B ? 14 : 6); i++) {
    const x = 30 + R() * 452, y = 40 + R() * 300;
    if (x > 140 && x < 400 && y > 60) continue;
    D.add(`<path d="M${x.toFixed(1)} ${(y - 6).toFixed(1)}L${(x + 1.6).toFixed(1)} ${(y - 1.6).toFixed(1)}L${(x + 6).toFixed(1)} ${y.toFixed(1)}L${(x + 1.6).toFixed(1)} ${(y + 1.6).toFixed(1)}L${x.toFixed(1)} ${(y + 6).toFixed(1)}L${(x - 1.6).toFixed(1)} ${(y + 1.6).toFixed(1)}L${(x - 6).toFixed(1)} ${y.toFixed(1)}L${(x - 1.6).toFixed(1)} ${(y - 1.6).toFixed(1)}Z" fill="#f6ff9e" opacity="0.9"/>`);
  }

  // ---------- lab coat (3/4 body) ----------
  D.region(cr([[30, 520, 1], [34, 474], [56, 440], [98, 418], [160, 400], [210, 386], [244, 374], [300, 372], [330, 366], [388, 382], [442, 398], [484, 424], [508, 460], [516, 520, 1]]), C.coat, {
    sw: 5, rim: C.rim, rimOff: [-8, 4],
    inner: sh(cr([[404, 394], [454, 410], [494, 436], [516, 480], [516, 520], [440, 520], [452, 470], [436, 430]]), C.coatSh) +
      sh(cr([[30, 484], [48, 456], [76, 460], [82, 520], [28, 520]]), C.coatSh) +
      // green under-light on the lower coat
      sh(cr([[40, 520], [80, 488], [160, 470], [200, 520]]), C.coatLit) + sh(cr([[380, 520], [420, 470], [470, 480], [500, 520]]), C.coatLit) +
      b(sh(cr([[462, 436], [500, 456], [516, 520], [476, 520], [478, 470]]), C.coatSh2) + ht(cr([[404, 400], [474, 420], [516, 470], [516, 520], [440, 520], [452, 470]]), 0.25) + hatch(cr([[30, 488], [48, 462], [64, 466], [68, 520], [28, 520]]), 0.3) +
        T([[100, 432], [112, 456], [114, 490]], 2, INK, { op: 0.5 }) + T([[428, 426], [422, 456], [426, 492]], 2, INK, { op: 0.5 })) +
      L([[86, 460], [80, 492], [78, 520]], 3, INK) + L([[456, 446], [468, 484], [472, 520]], 3, INK),
  });
  D.region(cr([[226, 380], [326, 376], [334, 520, 1], [212, 520, 1]]), C.vest, {
    sw: 4,
    inner: sh(cr([[290, 380], [330, 376], [336, 520], [300, 520]]), C.vestSh) + b(sh(cr([[312, 380], [334, 378], [336, 520], [318, 520]]), C.vestSh2)) +
      `<rect x="218" y="482" width="112" height="7" fill="${C.vestHi}" stroke="${INK}" stroke-width="2"/><rect x="218" y="404" width="112" height="6" fill="${C.vestHi}" stroke="${INK}" stroke-width="2"/>` +
      [[232, 420], [318, 420], [232, 500], [318, 500]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${C.vestHi}" stroke="${INK}" stroke-width="1.5"/>`).join(''),
  });
  D.region(hexD(272, 448, 22), C.green, { sw: 4, inner: sh(hexD(277, 452, 20), C.greenSh) + sh(cr([[256, 438], [266, 430], [262, 440]]), C.greenHi) });
  D.region(hexD(272, 448, 11), C.vest, { sw: 3, inner: sh(hexD(275, 451, 10), C.vestSh) });
  // lapels
  D.region(cr([[236, 368, 1], [226, 400], [214, 440], [204, 490], [200, 520, 1], [168, 520, 1], [176, 470], [186, 430], [196, 404], [210, 380]]), C.coat, { sw: 4.5, inner: sh(cr([[220, 380], [236, 368], [222, 420], [210, 480], [206, 520], [196, 520], [204, 460]]), C.coatSh) });
  D.region(cr([[318, 364, 1], [330, 396], [334, 440], [338, 490], [340, 520, 1], [380, 520, 1], [372, 470], [360, 424], [346, 392], [334, 372]]), C.coat, { sw: 4.5, rim: C.rim, inner: sh(cr([[338, 380], [360, 420], [376, 480], [380, 520], [356, 520], [352, 460], [344, 410]]), C.coatSh) });
  // pocket with pens
  for (const [x, c] of [[402, C.green], [412, '#3f7bd0'], [421, C.dark]]) {
    D.region(cr([[x - 3, 470, 1], [x - 3, 438, 1], [x, 432], [x + 3, 438, 1], [x + 3, 470, 1]]), c, { sw: 2.2 });
    D.add(`<rect x="${x - 0.8}" y="438" width="1.8" height="14" fill="#d8dde3" stroke="${INK}" stroke-width="1"/>`);
  }
  D.region(cr([[388, 452, 1], [438, 448, 1], [442, 500, 1], [394, 504, 1]]), C.coat, { sw: 3.5, inner: sh(cr([[388, 452], [438, 448], [438, 458], [390, 462]]), C.coatSh) });
  // tidy lanyard and ID badge clipped to the far lapel
  D.add(`<path d="M244 380L222 410L178 436" stroke="${INK}" stroke-width="6" fill="none" stroke-linejoin="round"/><path d="M244 380L222 410L178 436" stroke="${C.green}" stroke-width="3" fill="none" stroke-linejoin="round"/>`);
  D.add(`<g transform="translate(156 436) rotate(-4)"><rect x="12" y="-6" width="10" height="10" rx="2" fill="${C.vestHi}" stroke="${INK}" stroke-width="2"/><rect width="34" height="44" y="2" rx="3" fill="#fff" stroke="${INK}" stroke-width="3"/><rect x="4" y="7" width="26" height="6" fill="${C.green}"/><rect x="5" y="18" width="12" height="14" fill="${C.vest}"/><path d="M20 20h10M20 25h8M5 37h24" stroke="${INK}" stroke-width="1.5"/></g>`);

  // ======== head group: off-kilter tilt ========
  D.open('transform="rotate(-7 280 380)"');
  // wild tufts
  const wild = mood === 'shocked' ? 1.18 : 1;
  const tuft = (pts) => pts.map((p, i) => (p[2] ? [p[0] + (p[0] - 256) * (wild - 1), p[1] + (p[1] - 180) * (wild - 1), 1] : p));
  D.region(cr(tuft([[196, 136], [160, 106, 1], [180, 132], [126, 118, 1], [164, 150], [112, 158, 1], [160, 170], [116, 198, 1], [162, 188], [132, 232, 1], [174, 204], [160, 250, 1], [190, 214]])), C.hair, {
    sw: 4, inner: sh(cr([[190, 170], [146, 176], [124, 196], [162, 194], [140, 228], [176, 206], [162, 244], [192, 214]]), C.hairSh) +
      T([[186, 150], [156, 146], [130, 140]], 1.6, C.hairSh2, { a: 0.1, b: 0.6 }) + T([[186, 180], [154, 186], [126, 196]], 1.6, C.hairSh2, { a: 0.1, b: 0.6 }) +
      b([0, 1, 2, 3, 4].map((i) => L([[190, 140 + i * 14], [164, 142 + i * 15], [142 - (i % 2) * 6, 140 + i * 18]], 0.8, C.hairSh2, { op: 0.8 })).join('')),
  });
  D.region(cr(tuft([[316, 126], [350, 92, 1], [342, 124], [396, 104, 1], [358, 140], [414, 142, 1], [364, 162], [412, 190, 1], [362, 186], [400, 226, 1], [354, 208], [378, 254, 1], [340, 230], [326, 200]])), C.hair, {
    sw: 4, rim: C.rim, rimOff: [-6, 2],
    inner: sh(cr([[330, 160], [376, 168], [408, 190], [364, 192], [396, 226], [352, 212], [376, 252], [338, 228]]), C.hairSh) +
      T([[336, 140], [368, 130], [392, 112]], 1.6, C.hairSh2, { a: 0.1, b: 0.6 }) + T([[340, 170], [374, 172], [404, 182]], 1.6, C.hairSh2, { a: 0.1, b: 0.6 }) + T([[340, 200], [366, 214], [390, 220]], 1.6, C.hairSh2, { a: 0.1, b: 0.6 }) +
      b([0, 1, 2, 3, 4, 5].map((i) => L([[330, 128 + i * 18], [358, 130 + i * 19], [384 + (i % 2) * 8, 124 + i * 21]], 0.8, C.hairSh2, { op: 0.8 })).join('')),
  });
  // scrawny neck
  D.region(cr([[244, 312], [242, 330], [236, 346], [240, 360], [238, 384, 1], [322, 384, 1], [318, 330], [314, 280], [290, 296]]), C.skin, {
    sw: 4, inner: sh(cr([[290, 300], [316, 284], [330, 290], [330, 390], [296, 390], [300, 340]]), C.skinSh) + sh(cr([[240, 320], [270, 334], [300, 318], [306, 340], [262, 352], [238, 344]]), C.skinLit) +
      b(xh(cr([[300, 320], [320, 300], [324, 380], [302, 380]]), 0.25)) + T([[282, 344], [290, 360], [292, 380]], 1.8, INK, { op: 0.5 }),
  });
  D.region(cr([[238, 358], [278, 364], [318, 352], [324, 382], [280, 390], [234, 386]]), C.vest, { sw: 4, inner: sh(cr([[284, 366], [322, 352], [326, 386], [290, 392]]), C.vestSh) + L([[238, 370], [278, 377], [320, 366]], 1.6, C.vestSh2) });

  // face: under-lit (dark top, lit undersides)
  D.region(cr([[196, 108], [186, 140], [182, 170], [178, 184], [186, 200], [182, 218], [192, 248], [200, 284], [216, 316], [234, 332], [256, 334], [282, 320], [304, 296], [318, 266], [326, 232], [330, 186], [328, 134], [304, 92], [256, 76], [218, 86]]), C.skin, {
    sw: 4.5, rim: C.rim, rimOff: [-6, 2],
    inner:
      // dome & forehead fall into shadow (light comes from below)
      sh(cr([[180, 70], [330, 70], [336, 130], [300, 112], [250, 106], [200, 116], [180, 128]]), C.skinSh) +
      sh(cr([[300, 150], [316, 196], [312, 240], [298, 280], [270, 316], [300, 320], [330, 270], [340, 200], [336, 120], [312, 96]]), C.skinSh) +
      // brow ridge casts shadow upwards
      sh(cr([[184, 186], [214, 178], [244, 186], [286, 184], [296, 176], [250, 168], [214, 166], [186, 172]]), C.skinSh) +
      // soft cheekbone plane + hollow beneath
      sh(cr([[298, 236], [300, 256], [288, 274], [270, 290], [262, 298], [280, 296], [300, 278], [310, 254]]), C.skinSh) +
      sh(cr([[186, 232], [196, 238], [204, 262], [198, 284], [190, 258]]), C.skinSh) +
      sh(cr([[228, 206], [236, 226], [240, 254], [230, 262], [222, 240]]), C.skinSh) +
      // green under-light on undersides: nose tip, cheeks, chin, jaw
      sh(cr([[200, 262], [214, 270], [230, 272], [214, 276]]), C.skinLit) +
      sh(cr([[262, 238], [284, 236], [296, 244], [282, 248], [266, 246]]), C.skinLit, 'opacity="0.8"') +
      sh(cr([[214, 312], [234, 326], [258, 328], [282, 316], [262, 334], [234, 334]]), C.skinLit) +
      
      b(sh(cr([[316, 200], [320, 250], [302, 292], [286, 316], [318, 306], [336, 250], [338, 180]]), C.skinSh2) + ht(cr([[300, 150], [318, 200], [314, 250], [298, 290], [280, 316], [330, 296], [342, 210], [336, 120]]), 0.24) +
        ht(cr([[180, 70], [330, 70], [336, 120], [250, 100], [180, 120]]), 0.2) + `<ellipse cx="236" cy="92" rx="8" ry="3.5" fill="#fff" opacity="0.6" transform="rotate(-14 236 92)"/>`),
  });
  // ear + headset with headband
  D.region(cr([[318, 208], [330, 196], [346, 202], [350, 222], [344, 244], [332, 256], [320, 252]]), C.skin, { sw: 4.2, inner: sh(cr([[326, 214], [340, 210], [342, 232], [334, 248], [326, 244], [332, 230]]), C.skinSh) });
  D.ink([[198, 116], [236, 84], [290, 80], [330, 110], [342, 160], [340, 206]], 7, { a: 0.03, b: 0.03 });
  D.ink([[198, 116], [236, 84], [290, 80], [330, 110], [342, 160], [340, 206]], 3.4, { a: 0.03, b: 0.03, fill: C.darkHi });
  D.region(ellD(338, 226, 15, 20, 8), C.dark, { sw: 4, inner: sh(ellD(334, 220, 9, 13, 8), C.darkHi) });
  D.add(`<circle cx="344" cy="232" r="3.6" fill="${C.green}" stroke="${INK}" stroke-width="1.5"/>`);
  D.ink([[348, 210], [360, 160], [370, 112]], 4.4, { a: 0.05, b: 0.05 });
  D.add(`<circle cx="371" cy="108" r="6.5" fill="${C.green}" stroke="${INK}" stroke-width="2.5"/><circle cx="369" cy="106" r="2" fill="#fff"/>`);

  // eyes: slightly manic (wide, small pupils), far brow cocked high
  const manic = mood === 'neutral' ? { m: { tk: 0.66, bk: 0.5, pup: 0.3 } } : {};
  eye(D, C, { cx: 205, cy: 207, w: 28, h: 13.5, inner: 1, fx: 0.82, lidW: 4, look: [1.5, 0] }, mood, manic);
  eye(D, C, { cx: 263, cy: 209, w: 35, h: 14.5, inner: -1, lidW: 5, look: [0, 0] }, mood, manic);
  D.ink([[248, 225], [264, 228], [280, 222]], 1.5, { op: 0.6 });
  D.ink([[194, 222], [206, 224], [214, 221]], 1.2, { op: 0.5 });
  for (const [a, c] of [[[288, 204], [296, 200]], [[289, 210], [298, 210]], [[287, 216], [295, 220]]]) D.ink([a, c], 1.5, { op: 0.6 });
  brow(D, [[216, 178], [204, 170], [192, 172], [184, 182]], 8, { inner: 1, fill: C.hair, sw: 2.6, neutralUp: 4, up: true, innerFn: (q) => sh(taper(q.map((p) => [p[0], p[1] + 2]), 4), C.hairSh) });
  brow(D, [[242, 196], [256, 192], [272, 190], [290, 194]], 8.5, { inner: -1, fill: C.hair, sw: 2.6, innerFn: (q) => sh(taper(q.map((p) => [p[0], p[1] + 2]), 4), C.hairSh) });
  frown(D, 229, 192);
  if (mood !== 'angry') { D.ink([[188, 158], [200, 151], [214, 154]], 1.6, { op: 0.6 }); D.ink([[196, 146], [208, 142], [222, 145]], 1.3, { op: 0.45 }); }
  // hooked nose
  D.ink([[229, 198], [222, 214], [214, 228], [208, 244], [204, 256], [208, 264]], 3, { a: 0.5, b: 0.1, min: 0.05 });
  D.ink([[208, 264], [216, 268], [226, 263]], 2.8, { a: 0.1, b: 0.3 });
  D.ink([[232, 263], [242, 260], [244, 252], [238, 246]], 2.4, { a: 0.3, b: 0.4 });
  D.ink([[226, 262], [231, 260], [234, 263]], 2.4, { op: 0.8 });
  if (B) D.add(`<circle cx="210" cy="260" r="1.8" fill="#f4ffd8"/>`);
  D.ink([[250, 248], [262, 262], [268, 282]], 2, { op: 0.65 });
  // mouth: manic toothy grin in neutral
  if (mood === 'neutral') {
    D.region(cr([[212, 283, 1], [236, 284], [262, 274, 1], [252, 290], [234, 296], [220, 292]]), '#3b1820', {
      sw: 2.6, inner: P(cr([[210, 280], [262, 272], [258, 282], [236, 289], [214, 287]]), '#fbf6ea') + [222, 232, 242, 252].map((x) => `<path d="M${x} 280V290" stroke="#b9ae9b" stroke-width="1"/>`).join(''),
    });
    D.ink([[262, 272], [266, 268]], 1.8, { op: 0.7 });
  } else mouth(D, { cx: 236, cy: 284, w: 44, lf: 0.45, lips: C, full: 0.2, smile: 3 }, mood);
  // tufted goatee: several pointed tufts
  const gy = mood === 'shocked' ? 12 : 0;
  D.region(cr([[214, 300 + gy], [226, 297 + gy], [236, 300 + gy], [246, 297 + gy], [256, 302 + gy], [256, 318], [250, 336], [246, 350], [252, 364, 1], [240, 358], [236, 374], [230, 390, 1], [228, 372], [222, 360], [212, 368, 1], [217, 348], [214, 330], [212, 314]]), C.hair, {
    sw: 4, rim: C.rim,
    inner: sh(cr([[240, 306], [258, 312], [252, 338], [244, 356], [234, 384], [238, 344]]), C.hairSh) +
      T([[228, 306], [226, 334], [230, 362], [231, 384]], 1.6, C.hairSh2, { a: 0.3, b: 0.4 }) + T([[242, 310], [244, 336], [244, 356]], 1.4, C.hairSh2, { a: 0.3, b: 0.4 }) + T([[218, 316], [218, 340], [216, 360]], 1.3, C.hairSh2, { a: 0.3, b: 0.4 }) +
      sh(cr([[220, 304], [228, 302], [224, 330], [219, 326]]), C.hairHi) +
      b([0, 1, 2, 3].map((i) => L([[218 + i * 9, 302], [220 + i * 7, 330], [226 + i * 4, 360]], 0.8, i % 2 ? C.hairSh2 : C.hairSh, { op: 0.8 })).join('') + hatch(cr([[244, 312], [254, 316], [248, 350], [240, 352]]), 0.35)),
  });
  // boom mic
  D.ink([[330, 244], [316, 276], [292, 296], [272, 304]], 6, { a: 0.05, b: 0.05 });
  D.ink([[330, 244], [316, 276], [292, 296], [272, 304]], 2.6, { a: 0.05, b: 0.05, fill: C.darkHi });
  D.region(ellD(266, 304, 9, 7, -15), C.dark, { sw: 3, inner: sh(ellD(263, 301, 4, 3, -15), C.darkHi) + hatch(ellD(268, 306, 8, 6, -15), 0.4) });
  // brass goggles on the forehead
  D.region(cr([[186, 140], [228, 137], [280, 133], [330, 131], [331, 145], [282, 147], [228, 151], [184, 152]]), C.strap, { sw: 4, inner: sh(cr([[186, 142], [280, 134], [330, 132], [282, 140], [228, 143]]), C.strapHi) });
  const cup = (cx, cy, rx, ry) => {
    D.region(ellD(cx, cy, rx, ry, -6), C.brass, { sw: 4.5, rim: '#fff3c0', rimOff: [-4, 3], inner: sh(ellD(cx + 4, cy - 5, rx, ry * 0.9, -6), C.brassSh) + b(sh(ellD(cx + 6, cy - 8, rx * 0.95, ry * 0.75, -6), C.brassSh2)) + sh(ellD(cx - 4, cy + 9, rx * 0.5, ry * 0.25, 10), C.brassHi) });
    D.region(ellD(cx - 1, cy - 1, rx * 0.7, ry * 0.68, -6), C.lens, {
      sw: 3.5, inner: sh(ellD(cx + 3, cy - 3, rx * 0.7, ry * 0.68, -6), C.lensSh) + `<path d="M${cx - rx * 0.5} ${cy + ry * 0.2}L${cx - rx * 0.1} ${cy - ry * 0.7}L${cx + rx * 0.15} ${cy - ry * 0.7}L${cx - rx * 0.25} ${cy + ry * 0.3}Z" fill="#fff" opacity="0.75"/>`,
    });
    for (const a of [0.6, 2.2, 3.8, 5.3]) D.add(`<circle cx="${(cx + Math.cos(a) * rx * 0.86).toFixed(1)}" cy="${(cy + Math.sin(a) * ry * 0.86).toFixed(1)}" r="1.8" fill="${C.brassHi}" stroke="${INK}" stroke-width="1"/>`);
  };
  cup(212, 124, 25, 22);
  cup(270, 120, 30, 24);
  D.region(cr([[234, 120, 1], [242, 116], [242, 128], [235, 130, 1]]), C.brass, { sw: 2.5 });
  sweat(D, 182, 158);
  D.close();

  // green under-light wash over the whole figure
  D.add(glowRect(D, 0, 512, 0, 200, [[0, '#9cff6a', 0.32], [1, '#9cff6a', 0]], 'normal', B ? 0.8 : 0.6));
  vignette(D, '#3b4a52', B ? 0.3 : 0.2, 0.6);
  D.grain(0.3);
  return D.toString();
}
