// Grossmarschall Ilja Brodnik (korvat): vaeterlicher Starker Mann im Propagandaplakat-Stil.
// Paternal strongman / propaganda poster: low camera angle, heroic jaw, chest out, poster rays, heavy black shadows.
import { INK, cr, taper, Doc, P, T, L, tone, ellD, star, gear, background, vignette, eye, brow, mouth, frown, sweat, epaulette } from './common.js';

export default function render(level, mood = 'neutral') {
  const D = new Doc(level, mood);
  const B = D.B;
  const { ht, hatch, xh, b } = tone(D);
  const C = {
    skin: '#efc49b', skinSh: '#c98a66', skinSh2: '#9a5d48', spot: '#3a1716', skinHi: '#ffe2c4', flush: '#e07a66',
    grey: '#bcbac3', greySh: '#87859a', greySh2: '#5a5868', greyHi: '#f2f1f6',
    red: '#c8372d', redSh: '#8f2219', redSh2: '#5a120f', redHi: '#ea6550',
    olive: '#6b7a3a', oliveSh: '#4f5a29', oliveSh2: '#363e1b', oliveHi: '#9aaa5e', visorUnder: '#3a4223',
    black: '#211f2b', blackHi: '#5d5c74',
    gold: '#f2b51d', goldSh: '#c4841a', goldSh2: '#8a560f', goldHi: '#ffe68a',
    lip: '#c98471', lipSh: '#a3604f', lipHi: '#e7a894',
    iris: '#3d82d6', irisDk: '#1b3f7a', irisHi: '#94c6f5', rim: '#d8e39a',
  };
  const sh = (d, c, x = '') => P(d, c, x);

  // propaganda rays: olive and dark-red rays fanning from behind the head on a red field
  background(D, {
    primary: '#7d1912', secondary: '#c8372d', glow: '#e4573f', cx: 256, cy: 250, r: 420,
    stops: [[0, '#e4573f'], [0.35, '#c8372d'], [1, '#7d1912']],
    rays: { n: 18, cx: 256, cy: 250, w: 0.5, color: '#6b7a3a', op: B ? 0.5 : 0.55, color2: '#5e140f', op2: 0.35, rot: -0.08 }, htOp: 0.16,
  });

  // ---------- jacket: chest out, low angle ----------
  const jacket = cr([[22, 520, 1], [26, 470], [48, 432], [92, 404], [158, 386], [214, 370], [256, 362], [306, 364], [356, 356], [410, 370], [462, 390], [500, 420], [516, 456], [516, 520, 1]]);
  D.region(jacket, C.red, {
    sw: 5.5, rim: C.rim, rimOff: [-8, 4],
    inner:
      sh(cr([[392, 380], [452, 398], [500, 428], [518, 480], [518, 520], [430, 520], [446, 470], [424, 430]]), C.redSh) +
      sh(cr([[214, 368], [362, 358], [354, 398], [300, 414], [240, 406]]), C.redSh) +
      sh(cr([[24, 482], [40, 452], [70, 456], [76, 520], [20, 520]]), C.redSh) +
      sh(cr([[262, 392], [272, 440], [278, 520], [260, 520], [258, 440]]), C.redSh) +
      // heavy poster black in the deepest folds
      sh(cr([[470, 440], [504, 462], [518, 520], [488, 520], [488, 476]]), C.redSh2) +
      b(ht(cr([[404, 392], [474, 414], [516, 466], [516, 520], [436, 520], [450, 470]]), 0.3) + hatch(cr([[22, 488], [40, 458], [60, 462], [64, 520], [20, 520]]), 0.35) +
        T([[104, 424], [116, 450], [118, 486]], 2, INK, { op: 0.55 }) + T([[426, 424], [420, 456], [424, 492]], 2, INK, { op: 0.55 }) + T([[200, 450], [210, 480], [214, 512]], 1.6, C.redSh2) + T([[330, 440], [340, 470], [344, 506]], 1.6, C.redSh2)) +
      // chest highlight (chest out)
      sh(cr([[150, 408], [204, 394], [236, 400], [222, 430], [176, 440], [146, 428]]), C.redHi) +
      sh(cr([[60, 428], [104, 406], [160, 392], [120, 410]]), C.redHi) +
      L([[86, 446], [78, 486], [76, 520]], 3, INK) + L([[452, 440], [464, 480], [468, 520]], 3, INK) +
      T([[262, 384], [264, 450], [266, 520]], 3.4, INK, { a: 0.1, b: 0.05 }),
  });
  for (const [x, y] of [[230, 418], [232, 458], [234, 498], [296, 414], [299, 454], [302, 494]]) {
    D.region(ellD(x, y, 7, 7), C.gold, { sw: 2.5, inner: sh(ellD(x + 2.5, y + 2.5, 5.5, 5.5), C.goldSh) + sh(ellD(x - 2, y - 2, 2.2, 2.2), C.goldHi) });
  }
  // ribbon rack + hanging medals (viewer's left)
  {
    const rib = [['#c8372d', '#f2b51d'], ['#2f6fc4', '#f4f6fb'], ['#6b7a3a', '#f2b51d'], ['#f2b51d', '#c8372d'], ['#f4f6fb', '#c8372d'], ['#6b7a3a', '#c8372d'], ['#2f6fc4', '#f2b51d'], ['#c8372d', '#24222e'], ['#f2b51d', '#6b7a3a'], ['#c8372d', '#f4f6fb'], ['#24222e', '#f2b51d']];
    let k = 0, s = '';
    for (const [x0, y0, n] of [[130, 414, 4], [132, 426, 4], [140, 438, 3]]) {
      for (let i = 0; i < n; i++) {
        const c = rib[k++ % rib.length], x = x0 + i * 19, y = y0 - i * 2.4;
        s += `<g transform="translate(${x} ${y}) rotate(-7)"><rect width="19" height="11" fill="${c[0]}"/><rect x="7" width="5" height="11" fill="${c[1]}"/>${B ? '<rect width="19" height="3" fill="#fff" opacity="0.35"/>' : ''}<rect width="19" height="11" fill="none" stroke="${INK}" stroke-width="2"/></g>`;
      }
    }
    D.add(s);
    const med = (x, y, kind, ribbon) => {
      D.region(cr([[x - 7, y - 30, 1], [x + 7, y - 31, 1], [x + 7, y - 12, 1], [x, y - 6, 1], [x - 7, y - 11, 1]]), ribbon, { sw: 2.2, inner: `<rect x="${x - 2}" y="${y - 34}" width="4" height="30" fill="${C.gold}"/>` });
      if (kind === 'star') D.region(star(x, y + 4, 13, 6), C.gold, { sw: 2.5, inner: sh(`M${x} ${y + 4}L${x + 16} ${y - 8}L${x + 16} ${y + 20}L${x - 4} ${y + 20}Z`, C.goldSh) });
      else D.region(ellD(x, y + 5, 10, 10), kind === 'silver' ? '#dfe3ea' : C.gold, { sw: 2.5, inner: sh(ellD(x + 3, y + 8, 9, 9), kind === 'silver' ? '#9aa3b2' : C.goldSh) + `<path d="${star(x, y + 5, 5.5, 2.4)}" fill="${C.red}" stroke="${INK}" stroke-width="1"/>` });
      if (B) D.add(`<circle cx="${x - 4}" cy="${y}" r="1.6" fill="#fff"/>`);
    };
    med(146, 488, 'star', C.red);
    med(173, 484, 'disc', '#2f6fc4');
    med(199, 478, 'silver', C.olive);
  }
  // order of the gear (viewer's right)
  {
    const gx = 388, gy = 452;
    D.region(gear(gx, gy, 25, 19.5, 10), C.gold, { sw: 3, inner: sh(cr([[gx + 6, gy - 26], [gx + 28, gy], [gx + 12, gy + 26], [gx - 6, gy + 26], [gx + 14, gy + 4]]), C.goldSh) });
    D.region(ellD(gx, gy, 12, 12), C.red, { sw: 2.5, inner: sh(ellD(gx + 3, gy + 3, 11, 11), C.redSh) });
    D.region(star(gx, gy, 9, 3.8), C.goldHi, { sw: 1.5 });
    D.add(`<g transform="translate(362 402) rotate(6)"><rect width="22" height="10" fill="${C.red}"/><rect x="8" width="6" height="10" fill="${C.gold}"/><rect x="22" width="22" height="10" fill="${C.olive}"/><rect x="30" width="6" height="10" fill="${C.red}"/><rect width="44" height="10" fill="none" stroke="${INK}" stroke-width="2"/></g>`);
  }
  const emb = (side) => (x, y) => D.add(`<path d="${star(x + side * 6, y, 7, 3)}" fill="${C.red}" stroke="${INK}" stroke-width="1.5"/>`);
  epaulette(D, C, 104, 400, 40, 12, -20, -1, { rim: '#fff3c0', emblem: emb(-1) });
  epaulette(D, C, 454, 396, 60, 18, 12, 1, { rim: '#fff3c0', emblem: emb(1) });

  // ---------- neck: seen from below, heavy black under the jaw ----------
  D.region(cr([[222, 306], [220, 344], [218, 372, 1], [362, 372, 1], [358, 330], [354, 290], [300, 304]]), C.skin, {
    sw: 4, inner: sh(cr([[210, 300], [250, 346], [310, 340], [350, 306], [366, 290], [366, 380], [210, 380]]), C.skinSh) +
      sh(cr([[214, 318], [252, 350], [316, 344], [356, 312], [362, 330], [330, 360], [262, 368], [214, 352]]), C.spot) +
      b(xh(cr([[230, 340], [300, 356], [356, 330], [356, 372], [230, 372]]), 0.25)),
  });
  // high collar with gold tabs
  D.region(cr([[216, 334], [262, 350], [306, 350], [362, 326], [370, 376], [306, 396], [262, 398], [210, 386]]), C.red, {
    sw: 4.5, rim: C.rim,
    inner: sh(cr([[306, 352], [366, 324], [372, 380], [308, 398]]), C.redSh) + sh(cr([[336, 344], [370, 330], [372, 380], [340, 390]]), C.redSh2) +
      sh(cr([[218, 342], [258, 356], [254, 364], [216, 352]]), C.redHi) + L([[264, 356], [266, 398]], 3, INK),
  });
  for (const [x, y, w, h, r] of [[238, 372, 26, 15, -8], [318, 370, 32, 17, 10]]) {
    D.add(`<g transform="translate(${x} ${y}) rotate(${r})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="2" fill="${C.gold}" stroke="${INK}" stroke-width="2.5"/><rect x="${-w / 2 + 2}" y="${h / 2 - 5}" width="${w - 4}" height="3" fill="${C.goldSh}"/><path d="${gear(0, 0, h * 0.36, h * 0.27, 8)}" fill="${C.red}" stroke="${INK}" stroke-width="1"/></g>`);
  }

  // grey hair behind the ear
  D.region(cr([[330, 160], [362, 156], [380, 180], [384, 226], [372, 262], [356, 274], [348, 232], [340, 186]]), C.grey, {
    sw: 4, rim: C.rim, inner: sh(cr([[354, 180], [384, 190], [380, 262], [360, 274], [364, 232]]), C.greySh) + T([[354, 170], [364, 200], [366, 240]], 1.8, C.greySh2),
  });

  // ---------- face: heroic broad jaw, low angle ----------
  D.region(cr([[198, 150], [182, 174], [173, 196], [178, 212], [171, 232], [173, 260], [179, 292], [193, 320], [216, 340], [246, 350], [278, 347], [310, 334], [336, 312], [351, 280], [357, 240], [356, 196], [350, 162], [300, 146], [240, 146]]), C.skin, {
    sw: 5, rim: C.rim, rimOff: [-6, 2],
    inner:
      // hard poster shadow on the side plane
      sh(cr([[300, 176], [318, 214], [318, 256], [304, 296], [276, 330], [250, 346], [310, 346], [348, 310], [362, 250], [360, 170]]), C.skinSh) +
      sh(cr([[316, 220], [324, 262], [312, 300], [290, 330], [330, 324], [356, 280], [360, 214]]), C.skinSh2) +
      sh(cr([[228, 214], [238, 238], [252, 254], [236, 262], [228, 246]]), C.skinSh) +
      // visor shadow band
      sh(cr([[166, 150], [360, 146], [360, 184], [300, 180], [240, 188], [170, 190]]), C.skinSh) +
      sh(cr([[166, 150], [360, 146], [360, 166], [300, 166], [240, 172], [170, 174]]), C.skinSh2) +
      // chin underside
      sh(cr([[204, 324], [236, 342], [276, 342], [306, 330], [290, 348], [244, 354], [212, 342]]), C.skinSh) +
      b(ht(cr([[300, 180], [322, 226], [318, 270], [298, 310], [270, 336], [340, 320], [360, 250], [360, 176]]), 0.25) + hatch(cr([[170, 152], [356, 148], [356, 164], [170, 170]]), 0.3)) +
      sh(cr([[190, 222], [202, 230], [196, 252], [184, 242]]), C.skinHi) +
      sh(cr([[220, 322], [246, 318], [264, 324], [244, 332]]), C.skinHi) +
      sh(ellD(292, 250, 14, 9, -10), C.flush, `opacity="${mood === 'angry' ? 0.55 : 0.32}"`) +
      sh(ellD(190, 256, 7, 7), C.flush, 'opacity="0.28"'),
  });
  // ear, sitting low because of the low camera
  D.region(cr([[346, 226], [358, 214], [374, 218], [381, 240], [376, 266], [364, 282], [350, 282], [348, 262]]), C.skin, {
    sw: 4.5, rim: C.rim, inner: sh(cr([[356, 232], [370, 228], [372, 254], [362, 272], [354, 268], [362, 252]]), C.skinSh) + sh(cr([[370, 220], [378, 232], [374, 234]]), C.skinHi),
  });
  D.ink([[358, 226], [370, 228], [372, 248], [364, 264], [356, 272]], 2.2, { a: 0.2, b: 0.4 });

  // eyes: stern but warm (slightly raised lower lid, crow's feet)
  const warm = mood === 'neutral' ? { m: { tk: 0.44, bk: 0.36 } } : {};
  eye(D, C, { cx: 206, cy: 214, w: 27, h: 11.5, inner: 1, fx: 0.82, lidW: 4.6, lowW: 2, look: [1, 0], lidSh: 2 }, mood, warm);
  eye(D, C, { cx: 264, cy: 214, w: 35, h: 13.5, inner: -1, lidW: 5.4, lowW: 2.2, look: [-1, 0], lidSh: 2 }, mood, warm);
  if (mood !== 'shocked') {
    for (const [a, c] of [[[288, 209], [296, 206]], [[289, 215], [298, 215]], [[287, 221], [295, 225]]]) D.ink([a, c], 1.6, { op: 0.7 });
    D.ink([[250, 229], [264, 232], [280, 227]], 1.5, { op: 0.5 });
  }
  // bushy brows with fur strokes
  const fur = (n, col) => (q) => q.slice(0, -1).map((p, i) => L([[p[0], p[1] + 3], [p[0] + (q[i + 1][0] - p[0]) * 0.5, p[1] - 3]], 1.4, col, { op: 0.8 })).join('');
  brow(D, [[226, 200], [214, 194], [200, 191], [184, 195]], 11, { inner: 1, fill: C.grey, sw: 3, a: 0.05, b: 0.45, innerFn: fur(4, C.greySh2) });
  brow(D, [[238, 201], [254, 193], [272, 189], [294, 194]], 12.5, { inner: -1, fill: C.grey, sw: 3, a: 0.05, b: 0.45, up: true, innerFn: fur(4, C.greySh2) });
  frown(D, 231, 196);
  if (mood === 'neutral') { D.ink([[229, 188], [231, 197]], 1.8, { op: 0.6 }); }

  // nose: seen from below, nostrils visible
  D.ink([[231, 208], [228, 224], [221, 240]], 2.6, { a: 0.6, b: 0.1, min: 0.05 });
  D.ink([[221, 240], [211, 248], [210, 257], [219, 263], [232, 263]], 3, { a: 0.1, b: 0.3 });
  D.ink([[240, 264], [252, 260], [255, 250], [248, 244]], 2.6, { a: 0.3, b: 0.4 });
  D.add(`<path d="${ellD(226, 259, 4.5, 2.6, -8)}" fill="${C.spot}"/><path d="${ellD(242, 260, 3.5, 2.2, 8)}" fill="${C.spot}"/>`);
  D.add(`<path d="${cr([[214, 246], [221, 241], [219, 250]])}" fill="${C.skinHi}"/>`);
  if (B) D.add(`<circle cx="219" cy="247" r="2" fill="#fff"/>`);
  D.ink([[270, 240], [284, 256], [294, 272]], 1.8, { op: 0.55 });

  // mouth below the moustache (closed in neutral)
  if (mood === 'neutral') {
    D.region(cr([[218, 298, 1], [236, 296], [256, 297, 1], [250, 304], [236, 306], [224, 303]]), C.lip, { sw: 2.2, inner: sh(cr([[238, 301], [256, 297], [250, 307], [232, 308]]), C.lipSh) + sh(cr([[226, 299], [238, 298], [234, 301]]), C.lipHi) });
    D.ink([[214, 297.5], [236, 296], [258, 297]], 2.4, { a: 0.2, b: 0.2 });
  } else mouth(D, { cx: 236, cy: mood === 'shocked' ? 290 : 296, w: 52, lf: 0.45, lips: C, full: 0.4 }, mood, { smugLift: 5 });
  D.ink([[230, 318], [242, 320], [252, 318]], 1.8, { op: 0.5 });
  D.ink([[246, 330], [247, 340]], 2.2, { op: 0.6 }); // chin cleft

  // moustache: mood bends the handlebars
  const mo = { neutral: [0, 0, 0], angry: [6, 8, 0], smug: [0, -6, 0], shocked: [-6, -8, 0] }[mood];
  const farD = mood === 'smug' ? 2 : mo[0], nearD = mo[1];
  const spine = [[176, 241 + farD * 1.6], [167, 251 + farD], [172, 265 + farD * 0.6], [190, 275], [214, 273], [234, 263], [258, 273], [290, 277 + nearD * 0.3], [313, 267 + nearD * 0.6], [322, 251 + nearD], [314, 239 + nearD * 1.6]];
  D.region(taper(spine, 31, { a: 0.42, b: 0.42, min: 0.1, per: 10 }), C.grey, {
    sw: 4, rim: C.rim, rimOff: [-5, 3],
    inner: sh(cr([[160, 262], [196, 284], [234, 278], [262, 286], [300, 288], [330, 266], [334, 296], [234, 304], [154, 296]]), C.greySh) +
      sh(cr([[180, 262], [210, 262], [232, 254], [250, 260], [290, 264], [314, 252], [300, 262], [258, 266], [234, 260], [212, 266], [190, 266]]), C.greyHi) +
      T([[180, 263], [198, 271], [222, 269], [234, 267]], 1.8, C.greySh2, { a: 0.3, b: 0.2 }) + T([[236, 267], [262, 275], [290, 275], [308, 265]], 1.8, C.greySh2, { a: 0.2, b: 0.3 }) +
      b(sh(cr([[190, 284], [234, 282], [270, 290], [304, 282], [300, 296], [236, 298], [196, 294]]), C.greySh2) +
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => L([[240 + i * 9, 262], [246 + i * 9.5, 272], [252 + i * 9, 283 - i]], 0.9, i % 2 ? C.greySh2 : C.greyHi, { op: 0.85 })).join('') +
        [0, 1, 2, 3, 4].map((i) => L([[230 - i * 10, 260 + i], [224 - i * 10, 271], [218 - i * 9, 282 - i]], 0.9, i % 2 ? C.greySh2 : C.greyHi, { op: 0.85 })).join('')),
  });
  D.ink([[234, 258], [235, 266], [233, 274]], 2.2, { op: 0.8 });

  // ---------- cap seen from below: short crown, visor underside visible ----------
  D.region(cr([[156, 128], [146, 100], [170, 78], [220, 64], [284, 60], [348, 64], [392, 80], [400, 102], [384, 124], [340, 132], [260, 134], [190, 134]]), C.olive, {
    sw: 5, rim: C.rim, rimOff: [-8, 4],
    inner: sh(cr([[300, 96], [360, 90], [402, 98], [392, 128], [340, 134], [300, 126]]), C.oliveSh) + sh(cr([[150, 112], [220, 120], [300, 122], [400, 108], [400, 136], [150, 138]]), C.oliveSh) +
      b(sh(cr([[340, 112], [402, 104], [398, 134], [340, 136]]), C.oliveSh2) + ht(cr([[300, 104], [404, 96], [400, 134], [300, 134]]), 0.3)) +
      sh(cr([[182, 84], [226, 72], [284, 68], [252, 76], [204, 88]]), C.oliveHi),
  });
  D.region(cr([[172, 120], [236, 128], [300, 128], [358, 118], [360, 152], [300, 158], [236, 160], [176, 154]]), C.red, {
    sw: 4.5, rim: C.rim, inner: sh(cr([[300, 128], [362, 116], [362, 156], [300, 160]]), C.redSh) + sh(cr([[176, 124], [236, 132], [300, 132], [236, 136]]), C.redHi),
  });
  // visor: black edge, olive underside facing the low camera
  D.region(cr([[160, 152], [232, 160], [300, 158], [352, 148], [344, 166], [304, 182], [244, 190], [192, 184], [154, 168]]), C.black, {
    sw: 4.5, inner: sh(cr([[170, 160], [232, 166], [300, 164], [346, 154], [304, 176], [244, 182], [196, 178]]), C.visorUnder) + b(sh(cr([[180, 172], [240, 180], [300, 172], [244, 186]]), C.blackHi, 'opacity="0.6"')),
  });
  D.ink([[184, 148], [236, 154], [300, 153], [348, 144]], 4.5, { a: 0.05, b: 0.05 });
  D.ink([[184, 148], [236, 154], [300, 153], [348, 144]], 2.4, { a: 0.05, b: 0.05, fill: C.gold });
  for (const [x, y] of [[188, 148], [342, 145]]) D.region(ellD(x, y, 6, 6), C.gold, { sw: 2.2, inner: sh(ellD(x + 2, y + 2, 4, 4), C.goldSh) });
  {
    const bx = 240, by = 112;
    D.region(cr([[bx - 18, by - 4, 1], [bx - 54, by - 14, 1], [bx - 48, by - 4], [bx - 40, by + 4, 1], [bx - 18, by + 8, 1]]), C.gold, { sw: 3, inner: sh(cr([[bx - 52, by - 6], [bx - 18, by + 2], [bx - 18, by + 10], [bx - 40, by + 6]]), C.goldSh) });
    D.region(cr([[bx + 18, by - 6, 1], [bx + 50, by - 18, 1], [bx + 46, by - 8], [bx + 40, by + 2, 1], [bx + 18, by + 6, 1]]), C.gold, { sw: 3, inner: sh(cr([[bx + 48, by - 10], [bx + 18, by], [bx + 18, by + 8], [bx + 40, by + 4]]), C.goldSh) });
    D.region(gear(bx, by, 20, 15.5, 10), C.gold, { sw: 3, inner: sh(cr([[bx + 6, by - 22], [bx + 24, by], [bx + 10, by + 22], [bx + 4, by + 2]]), C.goldSh) });
    D.region(ellD(bx, by, 10, 10), C.red, { sw: 2.2, inner: sh(ellD(bx + 3, by + 3, 9, 9), C.redSh) });
    D.region(star(bx, by, 7, 3), C.goldHi, { sw: 1.3 });
    if (B) D.add(`<circle cx="${bx - 9}" cy="${by - 12}" r="2" fill="#fff"/>`);
  }
  sweat(D, 320, 196);
  vignette(D, '#3a0907', B ? 0.45 : 0.35, 0.6);
  D.grain();
  return D.toString();
}
