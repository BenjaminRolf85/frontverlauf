// Praesidentin Liora Valen (alvenia): freundliche Diplomatin.
// Friendly diplomat: soft rounded shapes, warm light, slight head tilt, genuine smile, light shadows.
import { INK, cr, taper, Doc, P, T, L, tone, ellD, star, background, vignette, eye, brow, mouth, frown, sweat } from './common.js';

export default function render(level, mood = 'neutral') {
  const D = new Doc(level, mood);
  const B = D.B;
  const { ht, hatch, xh, b } = tone(D);
  const C = {
    skin: '#f3cfab', skinSh: '#e2ab8a', skinSh2: '#c98b6e', skinHi: '#fff0dc', blush: '#f08c7e',
    hair: '#2a2633', hairSh: '#17151f', hairHi: '#55597e', hairHi2: '#8a93c2',
    blue: '#2f6fc4', blueSh: '#2659a6', blueSh2: '#1b4482', blueHi: '#6aa2e8',
    white: '#f4f6fb', whiteSh: '#cfd8e8', whiteSh2: '#a9b6cd',
    gold: '#f2b51d', goldSh: '#c98a1c', goldSh2: '#8a560f', goldHi: '#ffe68a',
    lip: '#da7a6e', lipSh: '#b85d57', lipHi: '#f6b0a2',
    iris: '#3f9a4e', irisDk: '#1f5b2c', irisHi: '#9bdc84',
    olive: '#5f8f3a', oliveHi: '#9cc76a', rim: '#fff4dd',
  };
  const sh = (d, c, x = '') => P(d, c, x);

  // gentle background: warm white glow, soft wide rays, a few soft bokeh discs
  background(D, { primary: C.blue, secondary: '#f2f5fa', glow: '#fffaf0', cx: 250, cy: 200, r: 400, rays: { n: 14, op: 0.07, w: 0.5 }, htOp: 0.1 });
  for (const [x, y, r] of [[70, 110, 26], [430, 90, 18], [455, 250, 30], [52, 300, 16], [400, 170, 10]]) D.add(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.16"/>`);

  // ---------- jacket (body turned 3/4: far shoulder narrower) ----------
  const jacketD = cr([[38, 520, 1], [44, 476], [62, 442], [98, 418], [154, 400], [206, 386], [242, 372], [284, 378], [330, 368], [380, 380], [436, 396], [478, 420], [502, 456], [514, 520, 1]]);
  const jacket = D.region(jacketD, C.blue, {
    sw: 5, rim: C.rim, rimOff: [-8, 4],
    inner:
      sh(cr([[400, 396], [450, 410], [488, 436], [512, 486], [514, 520], [446, 520], [456, 478], [438, 438]]), C.blueSh) +
      sh(cr([[214, 376], [342, 366], [334, 398], [292, 412], [240, 404]]), C.blueSh) +
      sh(cr([[40, 486], [56, 456], [80, 458], [86, 520], [36, 520]]), C.blueSh) +
      sh(cr([[252, 404], [264, 444], [272, 520], [250, 520], [246, 444]]), C.blueSh) +
      b(sh(cr([[462, 440], [496, 458], [514, 520], [478, 520], [480, 476]]), C.blueSh2) + ht(cr([[404, 404], [474, 424], [512, 474], [514, 520], [440, 520], [454, 474]]), 0.25) + hatch(cr([[40, 490], [56, 462], [72, 466], [76, 520], [36, 520]]), 0.3) +
        T([[104, 436], [114, 458], [116, 488]], 2, INK, { op: 0.5 }) + T([[424, 432], [418, 460], [422, 494]], 2, INK, { op: 0.5 }) +
        T([[170, 452], [188, 472], [198, 504]], 1.6, C.blueSh2) + T([[300, 446], [318, 472], [322, 504]], 1.6, C.blueSh2)) +
      sh(cr([[72, 438], [112, 414], [176, 398], [214, 392], [156, 408], [110, 424]]), C.blueHi) +
      L([[88, 460], [82, 492], [80, 520]], 3, INK) + L([[452, 446], [462, 482], [466, 520]], 3, INK) +
      T([[248, 398], [250, 450], [252, 520]], 3.6, INK, { a: 0.1, b: 0.05 }),
  });
  for (const [x, y] of [[240, 418], [238, 502]]) D.region(ellD(x, y, 6.5, 6.5), C.gold, { sw: 2.5, inner: sh(ellD(x + 2, y + 2, 5, 5), C.goldSh) + sh(ellD(x - 2, y - 2, 2, 2), C.goldHi) });
  // olive-branch pin (her left chest)
  D.line([[318, 440], [336, 428], [358, 420]], 3.5);
  D.line([[318, 440], [336, 428], [358, 420]], 1.8, { stroke: C.gold });
  for (const [x, y, r] of [[326, 432, -40], [334, 424, -110], [340, 428, 30], [348, 420, -100], [352, 424, 10], [360, 418, -40]]) D.region(ellD(x, y, 6.5, 3, r), C.olive, { sw: 1.8, inner: sh(ellD(x - 1, y - 1, 3.5, 1.3, r), C.oliveHi) });

  // ---------- sash: clipped to the jacket so it wraps over the far shoulder ----------
  {
    const cid = D.id('sc');
    D.def(`<clipPath id="${cid}"><use href="#${jacket}"/></clipPath>`);
    const a = [64, 378], e = [420, 528];
    const ln = (dx, dy, c, w, x = '') => `<path d="M${a[0] + dx} ${a[1] + dy}L${e[0] + dx} ${e[1] + dy}" stroke="${c}" stroke-width="${w}" ${x}/>`;
    D.add(`<g clip-path="url(#${cid})">` + ln(0, 0, INK, 48) + ln(0, 0, C.white, 40) + ln(0, 0, C.blue, 12) + ln(4, 11, C.whiteSh, 8) + ln(-3, -14, '#fff', 4) +
      b(ln(5, 14, 'url(#dots)', 7, 'opacity="0.3"') + ln(1, -6, C.blueSh2, 1, 'opacity="0.7"') + ln(-1, 6, C.blueSh2, 1, 'opacity="0.7"')) +
      // fold where the sash bends over the shoulder
      `<path d="${taper([[96, 380], [112, 398], [120, 418]], 3)}" fill="${INK}" opacity="0.6"/></g>`);
    D.add(`<use href="#${jacket}" fill="none" stroke="${INK}" stroke-width="5"/>`);
    const mx = 344, my = 488;
    D.region(ellD(mx, my, 25, 25), C.gold, { sw: 4, inner: sh(cr([[mx + 4, my - 26], [mx + 28, my - 4], [mx + 20, my + 22], [mx - 6, my + 28], [mx + 14, my + 6]]), C.goldSh) + ht(cr([[mx + 8, my - 22], [mx + 28, my], [mx + 16, my + 24], [mx + 4, my + 10]]), 0.3) + sh(cr([[mx - 18, my - 12], [mx - 8, my - 20], [mx - 12, my - 10]]), C.goldHi) });
    D.add(`<circle cx="${mx}" cy="${my}" r="17" fill="none" stroke="${INK}" stroke-width="2"/>`);
    D.region(star(mx, my, 13, 5.5), C.goldHi, { sw: 2, inner: sh(`M${mx} ${my}L${mx + 20} ${my - 10}L${mx + 20} ${my + 20}L${mx - 10} ${my + 20}Z`, C.gold) });
    if (B) D.add(`<circle cx="${mx + 9}" cy="${my - 9}" r="1.8" fill="#fff"/>`);
  }
  // ---------- epaulettes in perspective ----------
  epa(108, 410, 36, 11, -22, -1);
  epa(446, 406, 54, 17, 12, 1);
  function epa(cx, cy, rx, ry, rot, side) {
    const fx = side < 0 ? cx - rx * 0.95 : cx + rx * 0.5, fw = rx * 0.42;
    D.region(cr([[fx, cy + 2, 1], [fx + fw, cy + 4, 1], [fx + fw, cy + 28, 1], [fx, cy + 26, 1]]), C.gold, { sw: 3, inner: Array.from({ length: 5 }, (_, i) => `<path d="M${(fx + ((i + 1) * fw) / 6).toFixed(1)} ${cy}v34" stroke="${C.goldSh}" stroke-width="1.6"/>`).join('') + sh(`M${fx} ${cy + 22}h${fw}v10h-${fw}Z`, C.goldSh) });
    D.region(ellD(cx, cy, rx, ry, rot), C.gold, { sw: 4, rim: C.rim, rimOff: [-5, 3], inner: sh(ellD(cx + 4, cy + 6, rx, ry * 0.8, rot), C.goldSh) + b(sh(ellD(cx + 6, cy + 10, rx, ry * 0.6, rot), C.goldSh2)) + sh(ellD(cx - 6, cy - 4, rx * 0.6, ry * 0.3, rot), C.goldHi) });
    D.add(`<path d="${ellD(cx, cy - 1, rx * 0.72, ry * 0.55, rot)}" fill="none" stroke="${INK}" stroke-width="1.8" opacity="0.7"/>`);
  }

  // ======== head group: friendly tilt ========
  D.open('transform="rotate(4 284 372)"');
  // back hair
  D.region(cr([[204, 104], [172, 124], [156, 160], [150, 206], [153, 250], [162, 284], [176, 304], [192, 316, 1], [200, 306], [214, 314], [262, 322], [318, 324], [350, 318], [370, 296], [380, 252], [380, 196], [368, 148], [344, 116], [300, 96], [250, 92]]), C.hair, {
    sw: 4.5, rim: C.rim, rimOff: [-6, 2],
    inner: sh(cr([[300, 140], [356, 150], [378, 240], [366, 304], [330, 322], [300, 320], [334, 280], [344, 210]]), C.hairSh) +
      T([[176, 250], [184, 290], [200, 310]], 2.4, INK, { a: 0.3, b: 0.4 }) +
      b(L([[176, 160], [168, 220], [174, 280], [196, 308]], 1.4, C.hairHi, { op: 0.8 }) + L([[188, 150], [180, 210], [186, 270]], 1.1, C.hairHi, { op: 0.6 }) + hatch(cr([[300, 290], [340, 300], [330, 322], [290, 322]]), 0.3)),
  });
  // neck
  D.region(cr([[250, 296], [249, 330], [246, 380, 1], [324, 380, 1], [320, 330], [318, 262], [290, 270]]), C.skin, {
    sw: 4, inner: sh(cr([[236, 296], [262, 314], [296, 300], [324, 264], [340, 280], [340, 388], [300, 388], [306, 340], [264, 336], [236, 320]]), C.skinSh) +
      b(sh(cr([[248, 304], [272, 320], [302, 306], [326, 278], [330, 300], [300, 326], [262, 330]]), C.skinSh2) + xh(cr([[252, 306], [276, 318], [306, 300], [326, 276], [326, 296], [300, 316], [266, 326]]), 0.12)),
  });
  // collar: soft open shirt collar, rounded tips, a little uneven
  D.region(cr([[240, 346], [282, 356], [326, 342], [332, 372], [286, 388], [238, 380]]), C.white, { sw: 4, inner: sh(cr([[290, 354], [332, 340], [334, 378], [300, 386]]), C.whiteSh) });
  D.region(cr([[238, 352], [256, 374], [260, 398], [246, 404], [222, 412], [214, 404], [222, 380]]), C.white, { sw: 4, inner: sh(cr([[244, 386], [258, 376], [258, 400], [238, 406]]), C.whiteSh) + b(L([[228, 372], [232, 396]], 1, C.whiteSh2)) });
  D.region(cr([[330, 346], [314, 374], [266, 398], [276, 410], [300, 418], [308, 412], [338, 388]]), C.white, {
    sw: 4, rim: C.rim, inner: sh(cr([[268, 402], [300, 388], [328, 382], [304, 420]]), C.whiteSh) + b(sh(cr([[280, 408], [312, 398], [302, 418]]), C.whiteSh2)),
  });
  // face: rounder near cheek, softer jaw
  D.region(cr([[204, 120], [186, 150], [178, 184], [183, 201], [179, 220], [184, 246], [196, 272], [212, 295], [229, 309], [246, 314], [270, 310], [298, 294], [320, 268], [334, 238], [340, 206], [338, 162], [314, 120], [256, 104]]), C.skin, {
    sw: 4.5, rim: C.rim, rimOff: [-6, 2],
    inner:
      // soft side plane following the cheekbone
      sh(cr([[306, 150], [324, 196], [326, 232], [314, 262], [290, 292], [270, 308], [300, 314], [334, 280], [348, 220], [344, 150]]), C.skinSh) +
      sh(cr([[226, 214], [234, 236], [244, 248], [236, 254], [226, 252], [222, 232]]), C.skinSh) +
      sh(cr([[228, 291], [240, 288], [250, 290], [240, 294]]), C.skinSh) +
      sh(cr([[176, 168], [330, 160], [330, 182], [250, 190], [176, 184]]), C.skinSh) +
      b(sh(cr([[326, 210], [330, 246], [312, 280], [292, 302], [324, 296], [344, 250], [344, 196]]), C.skinSh2) + ht(cr([[310, 160], [328, 210], [324, 252], [300, 290], [282, 308], [330, 300], [346, 220], [344, 150]]), 0.18)) +
      sh(cr([[196, 210], [206, 220], [200, 240], [190, 232]]), C.skinHi) +
      sh(cr([[219, 222], [222, 238], [218, 241]]), C.skinHi) +
      sh(ellD(286, 240, 15, 8, -10), C.blush, `opacity="${mood === 'angry' ? 0.5 : 0.35}"`) +
      sh(ellD(194, 242, 6, 5), C.blush, 'opacity="0.28"') +
      sh(cr([[234, 300], [244, 301], [240, 306]]), C.skinHi),
  });
  // eyes (smiling: lower lids raised in neutral)
  const smileEye = mood === 'neutral' ? { m: { bk: 0.36, tk: 0.6 } } : {};
  eye(D, C, { cx: 204, cy: 208, w: 28, h: 13.5, inner: 1, fx: 0.8, lidW: 4.2, flick: true, look: [1, 0], lashes: [[[189, 207], [185, 209]]] }, mood, smileEye);
  eye(D, C, { cx: 263, cy: 208, w: 38, h: 16.5, inner: -1, lidW: 5, flick: true, look: [-1, 0], lashes: [[[282, 207], [288, 208]], [[280, 203], [286, 199]]] }, mood, smileEye);
  brow(D, [[216, 187], [204, 183], [192, 185], [184, 191]], 4.6, { inner: 1, fill: C.hair });
  brow(D, [[241, 187], [254, 181], [270, 181], [285, 188]], 5.2, { inner: -1, fill: C.hair, up: true });
  frown(D, 229, 192);
  // nose
  D.ink([[226, 206], [224, 222], [218, 238], [214, 246]], 2.4, { a: 0.6, b: 0.1, min: 0.05 });
  D.ink([[214, 246], [217, 252], [226, 253]], 2.8, { a: 0.1, b: 0.3 });
  D.ink([[233, 253], [241, 250], [242, 244]], 2.4, { a: 0.3, b: 0.4 });
  D.ink([[224, 250.5], [228, 249.5], [231, 251]], 2.6, { a: 0.4, b: 0.4, op: 0.8 });
  if (B) D.add(`<circle cx="217" cy="243" r="1.6" fill="#fff" opacity="0.9"/>`);
  // mouth: genuine smile
  if (mood === 'neutral') {
    // open, warm smile with upper teeth
    D.region(cr([[213, 271, 1], [236, 274], [261, 266, 1], [254, 281], [237, 288], [222, 283]]), '#5a2a2e', {
      sw: 2.6, inner: P(cr([[208, 266], [264, 260], [258, 275], [237, 280], [216, 276]]), '#fbf6ea') + P(ellD(238, 289, 11, 5), '#c95b62') + `<path d="M226 271v6M236 272v7M247 270v7" stroke="#d9cfbf" stroke-width="1"/>`,
    });
    D.region(cr([[212, 271, 1], [224, 266], [233, 267], [239, 265], [262, 265, 1], [248, 269], [236, 272], [222, 272]]), C.lip, { sw: 2 });
    D.region(cr([[222, 285, 1], [237, 289], [251, 282, 1], [248, 292], [237, 296], [226, 292]]), C.lip, { sw: 2, inner: P(ellD(234, 291, 6, 1.8), C.lipHi) });
    D.ink([[208, 266], [212, 271], [211, 277]], 1.6, { op: 0.6 });
    D.ink([[264, 259], [263, 266], [267, 272]], 1.6, { op: 0.6 });
    D.ink([[272, 248], [274, 258], [270, 266]], 1.4, { op: 0.45 });
  } else mouth(D, { cx: 236, cy: 274, w: 46, lf: 0.42, lips: C, full: 0.6, smile: 5.5, farSmile: 4 }, mood);
  if (B) D.ink([[230, 256], [231, 263]], 1.1, { op: 0.35 });
  // near-side lock & fringe
  D.region(cr([[318, 140], [330, 180], [330, 226], [328, 262], [332, 290], [342, 306], [352, 314, 1], [354, 304], [366, 314, 1], [376, 290], [382, 240], [378, 182], [364, 140], [340, 120]]), C.hair, {
    sw: 4.5, rim: C.rim, rimOff: [-6, 2],
    inner: sh(cr([[344, 160], [372, 190], [376, 280], [364, 310], [350, 292], [358, 220]]), C.hairSh) +
      sh(cr([[332, 168], [338, 220], [334, 270], [328, 240], [330, 200]]), C.hairHi) +
      T([[346, 140], [352, 200], [350, 260], [356, 300]], 2.4, INK, { a: 0.3, b: 0.4 }) +
      b([0, 1, 2, 3].map((i) => L([[332 + i * 9, 140 + i * 4], [336 + i * 9, 200], [334 + i * 7, 262 + i * 8]], 0.8, C.hairHi2, { op: 0.5 })).join('')),
  });
  D.region(cr([[204, 122], [186, 144], [174, 176], [170, 210], [172, 236], [180, 230], [184, 196], [196, 160], [214, 140]]), C.hair, { sw: 4, inner: sh(cr([[178, 170], [184, 168], [182, 220], [174, 230]]), C.hairHi) });
  // fringe: irregular clumps, one swept strand
  D.region(cr([[190, 128], [176, 156], [175, 174], [180, 186, 1], [190, 175], [198, 166, 1], [208, 178], [214, 186, 1], [220, 174], [228, 168, 1], [240, 180], [250, 190, 1], [256, 177], [262, 170, 1], [272, 178], [278, 183, 1], [286, 174], [296, 166, 1], [303, 176], [309, 181, 1], [314, 172], [320, 164, 1], [327, 171], [332, 178, 1], [334, 130], [300, 116], [250, 112]]), C.hair, {
    sw: 4.5, rim: C.rim, rimOff: [-6, 3],
    inner: sh(cr([[290, 120], [336, 130], [332, 176], [312, 170], [306, 140]]), C.hairSh) +
      sh(cr([[186, 152], [214, 142], [248, 139], [290, 141], [318, 146], [316, 152], [288, 148], [248, 147], [214, 150], [190, 160]]), C.hairHi) +
      [[198, 166], [228, 168], [262, 170], [296, 166], [320, 164]].map(([x, y]) => T([[x + 6, 136], [x + 3, 154], [x, y + 1]], 2.6, INK, { a: 0.5, b: 0.05 })).join('') +
      b([186, 196, 216, 224, 246, 254, 280, 290, 312].map((x, i) => L([[x + 3, 132], [x + 1, 152], [x - 2, 170 + (i % 3) * 4]], 0.9, i % 3 ? C.hairHi : C.hairHi2, { op: 0.8 })).join('')),
  });
  // a single swept strand crossing the fringe
  D.region(taper([[256, 140], [246, 160], [240, 182], [244, 194]], 8, { a: 0.2, b: 0.8 }), C.hair, { sw: 2.5 });
  // beret
  D.region(cr([[170, 140], [164, 112], [184, 84], [224, 64], [282, 56], [338, 64], [380, 84], [398, 108], [390, 130], [356, 138], [300, 138], [240, 142], [196, 148]]), C.blue, {
    sw: 5, rim: C.rim, rimOff: [-8, 4],
    inner: sh(cr([[290, 110], [340, 100], [392, 104], [396, 128], [360, 140], [300, 140], [270, 130]]), C.blueSh) +
      sh(cr([[170, 128], [230, 122], [300, 124], [380, 120], [392, 134], [300, 142], [200, 150]]), C.blueSh) +
      b(sh(cr([[340, 118], [392, 112], [394, 132], [350, 138]]), C.blueSh2) + ht(cr([[300, 112], [394, 104], [396, 134], [300, 140]]), 0.25) + L([[240, 100], [300, 92], [350, 96]], 1.2, C.blueSh2, { op: 0.8 })) +
      sh(cr([[196, 92], [232, 72], [290, 64], [264, 76], [222, 90]]), C.blueHi),
  });
  D.ink([[172, 140], [210, 140], [260, 136], [320, 134], [388, 128]], 3, { a: 0.1, b: 0.3 });
  D.region(cr([[276, 60], [278, 50], [290, 49], [292, 60]]), C.blueSh, { sw: 3 });
  {
    const bx = 202, by = 112;
    D.region(cr([[bx, by - 18, 1], [bx + 13, by - 10], [bx + 12, by + 6], [bx, by + 16, 1], [bx - 12, by + 6], [bx - 13, by - 10]]), C.gold, { sw: 3.5, inner: sh(cr([[bx + 2, by - 18], [bx + 14, by - 8], [bx + 12, by + 8], [bx + 2, by + 16]]), C.goldSh) + sh(cr([[bx - 9, by - 8], [bx - 3, by - 13], [bx - 6, by - 4]]), C.goldHi) });
    D.region(star(bx, by - 1, 7.5, 3.2), C.goldHi, { sw: 1.6 });
  }
  sweat(D, 318, 176);
  D.close();

  vignette(D, '#163a72', B ? 0.25 : 0.18, 0.6);
  D.grain(0.3);
  return D.toString();
}
