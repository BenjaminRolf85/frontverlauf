// Xyl'Tharra (zyrr): fremdartig und charismatisch.
// Alien and otherworldly: smooth organic curves, iridescent rim light, eerie calm; charismatic, not scary.
import { INK, cr, taper, Doc, P, T, L, tone, ellD, background, vignette, sweat } from './common.js';

export default function render(level, mood = 'neutral') {
  const D = new Doc(level, mood);
  const B = D.B;
  const { ht, hatch, xh, b } = tone(D);
  const C = {
    skin: '#a99bbd', skinSh: '#86779f', skinSh2: '#65577f', skinHi: '#d8cfe6',
    eye: '#140f20', eyeRef: '#8f5ce0', eyeRef2: '#c79bff',
    violet: '#7b3fc4', violetSh: '#5a2a96', violetSh2: '#3f1c6c', violetHi: '#a77ae6', petal: '#9c6fe0', petalHi: '#c6a6f2',
    acid: '#9cff3a', acidSh: '#5fbf1a',
  };
  const sh = (d, c, x = '') => P(d, c, x);
  D.def(`<linearGradient id="irid" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c79bff"/><stop offset="0.45" stop-color="#9cff3a"/><stop offset="0.75" stop-color="#5ef0ff"/><stop offset="1" stop-color="#ff8af0"/></linearGradient>`);
  const RIM = 'url(#irid)';

  // otherworldly field: acid glow, violet edges, slow concentric ripples
  background(D, { primary: '#7b3fc4', secondary: '#9cff3a', glow: '#e4ffc0', cx: 256, cy: 200, r: 420, stops: [[0, '#d9ffa8'], [0.22, '#9cff3a'], [0.5, '#8a52cf'], [1, '#3f1c6c']], htColor: '#2a0f4a', htOp: 0.2 });
  for (let i = 1; i <= 6; i++) D.add(`<circle cx="256" cy="200" r="${i * 62}" fill="none" stroke="#fff" stroke-width="${7 - i * 0.6}" opacity="${0.11 - i * 0.01}"/>`);

  // ---------- petal collar and robe ----------
  D.region(cr([[40, 520, 1], [56, 470], [100, 440], [170, 424], [256, 418], [342, 424], [412, 440], [456, 470], [472, 520, 1]]), C.violet, {
    sw: 5, rim: RIM, rimOff: [-7, 5],
    inner: sh(cr([[340, 430], [420, 446], [460, 480], [472, 520], [380, 520]]), C.violetSh) + b(sh(cr([[400, 460], [460, 486], [472, 520], [430, 520]]), C.violetSh2) + hatch(cr([[400, 460], [470, 490], [472, 520], [410, 520]]), 0.3)) +
      [140, 200, 312, 372].map((x) => T([[x, 450], [x + (x - 256) * 0.05, 490], [x + (x - 256) * 0.08, 520]], 3, INK, { a: 0.2, b: 0.1 })).join(''),
  });
  // neck with rings
  D.region(cr([[230, 300], [232, 360], [226, 420, 1], [288, 420, 1], [282, 360], [284, 300]]), C.skin, {
    sw: 4, inner: sh(cr([[262, 300], [290, 300], [290, 420], [266, 420]]), C.skinSh) + [330, 348, 366, 384].map((y) => L([[232, y], [256, y + 5], [282, y]], 2, INK, { op: 0.55 })).join(''),
  });
  // back petals (tall, light) then front petals
  const petal = (cx, by, w, h, lean, col, colSh) => {
    const d = cr([[cx - w / 2, by], [cx - w / 2 + lean * 0.3, by - h * 0.6], [cx + lean - w * 0.18, by - h, 1], [cx + lean + w * 0.18, by - h, 1], [cx + w / 2 + lean * 0.3, by - h * 0.6], [cx + w / 2, by]]);
    D.region(d, col, { sw: 3.5, rim: RIM, rimOff: [-4, 3], inner: sh(cr([[cx + 2, by], [cx + w / 2, by], [cx + w / 2 + lean * 0.3, by - h * 0.6], [cx + lean + w * 0.12, by - h + 4]]), colSh) + L([[cx, by - 6], [cx + lean * 0.6, by - h * 0.7]], 1.4, INK, { op: 0.4 }) });
  };
  [[128, 450, 52, 70, -14], [176, 436, 52, 84, -10], [222, 430, 50, 92, -4], [290, 430, 50, 92, 4], [336, 436, 52, 84, 10], [384, 450, 52, 70, 14]].forEach(([x, y, w, h, l]) => petal(x, y, w, h, l, C.petal, C.violetHi));
  [[100, 480, 60, 64, -16], [154, 466, 60, 72, -10], [206, 462, 58, 76, -4], [306, 462, 58, 76, 4], [358, 466, 60, 72, 10], [412, 480, 60, 64, 16], [256, 462, 58, 78, 0]].forEach(([x, y, w, h, l]) => petal(x, y + 4, w, h, l, C.violet, C.violetSh));
  // green dots along the collar rim
  for (const [x, y] of [[100, 486], [154, 474], [206, 470], [306, 470], [358, 474], [412, 486]]) D.add(`<circle cx="${x}" cy="${y}" r="5" fill="${C.acid}" stroke="${INK}" stroke-width="2"/>`);
  // emblem
  D.region(ellD(256, 488, 26, 26), C.violetSh2, { sw: 4, rim: RIM, inner: sh(ellD(256, 486, 22, 22), C.violetSh) });
  for (const [x, y] of [[256, 478], [247, 494], [265, 494]]) D.add(`<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="${INK}" stroke-width="6"/><circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="${C.acid}" stroke-width="3"/>`);

  D.open('transform="translate(16 30) scale(0.94)"');
  // ---------- antennae (pose shows mood) ----------
  const ant = {
    neutral: [[[226, 92], [206, 54], [176, 28]], [[290, 92], [312, 54], [342, 30]]],
    angry: [[[226, 92], [214, 66], [228, 40]], [[290, 92], [300, 66], [286, 40]]],
    smug: [[[226, 92], [222, 50], [226, 14]], [[290, 92], [328, 70], [370, 72]]],
    shocked: [[[226, 92], [218, 46], [212, 6]], [[290, 92], [298, 46], [304, 6]]],
  }[mood];
  for (const a of ant) {
    D.ink(a, 7, { a: 0.02, b: 0.3, min: 0.5 });
    D.ink(a, 3.4, { a: 0.02, b: 0.3, min: 0.5, fill: C.skinSh });
    const [x, y] = a[2];
    D.add(`<circle cx="${x}" cy="${y}" r="18" fill="${C.acid}" opacity="0.25"/><circle cx="${x}" cy="${y}" r="9" fill="${C.acid}" stroke="${INK}" stroke-width="3"/><circle cx="${x - 3}" cy="${y - 3}" r="3" fill="#fff"/>`);
    if (mood === 'shocked') D.add(`<path d="M${x - 16} ${y - 4}l-8 -4M${x + 16} ${y - 4}l8 -4M${x} ${y - 16}v-8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);
  }
  // ---------- crest: spiky violet-green fan ----------
  {
    const spikes = [[206, 104, 168, 46], [220, 92, 196, 20], [236, 86, 226, 4], [252, 84, 256, 0], [268, 86, 288, 6], [282, 92, 318, 22], [296, 104, 344, 48]];
    spikes.forEach(([x, y, tx, ty], i) => {
      const col = i % 2 ? C.acid : C.petal, colSh = i % 2 ? C.acidSh : C.violetSh;
      D.region(cr([[x - 12, y + 12], [tx, ty, 1], [x + 12, y + 12]]), col, { sw: 3.5, rim: RIM, rimOff: [-3, 3], inner: sh(cr([[x, y + 14], [tx, ty], [x + 14, y + 12]]), colSh) });
    });
  }
  // ---------- cranium ----------
  D.region(cr([[258, 70], [318, 80], [358, 116], [374, 170], [366, 226], [340, 276], [302, 316], [264, 336], [236, 332], [204, 304], [170, 260], [150, 206], [150, 150], [178, 102], [218, 78]]), C.skin, {
    sw: 5, rim: RIM, rimOff: [-8, 4],
    inner: sh(cr([[320, 100], [364, 150], [366, 226], [334, 280], [292, 320], [262, 336], [300, 334], [354, 288], [386, 200], [370, 110]]), C.skinSh) +
      sh(cr([[204, 292], [236, 320], [266, 322], [300, 306], [280, 330], [240, 338], [210, 318]]), C.skinSh) +
      b(sh(cr([[344, 170], [360, 220], [336, 274], [300, 314], [340, 300], [376, 220], [370, 150]]), C.skinSh2) + ht(cr([[330, 120], [366, 170], [360, 230], [330, 280], [290, 320], [350, 300], [384, 200], [370, 110]]), 0.25)) +
      sh(cr([[186, 120], [226, 92], [262, 86], [228, 100], [196, 128]]), C.skinHi) + sh(ellD(214, 108, 10, 5, -30), '#fff', 'opacity="0.5"') +
      // forehead stripe & cheek markings
      T([[262, 98], [260, 130], [258, 160]], 5, C.acid, { a: 0.2, b: 0.2 }) +
      [[186, 248], [196, 256], [206, 262]].map(([x, y]) => T([[x, y], [x + 6, y + 4]], 4, C.acid, { a: 0.3, b: 0.3 })).join('') +
      [[306, 262], [318, 256], [330, 248]].map(([x, y]) => T([[x, y], [x + 6, y - 4]], 4, C.acid, { a: 0.3, b: 0.3 })).join(''),
  });
  // ---------- eyes: large glossy almonds ----------
  const E = {
    neutral: { l: [[176, 186], [206, 170], [240, 208], [208, 222]], r: [[346, 184], [314, 168], [278, 208], [312, 222]], lid: [0.18, 0.18] },
    angry: { l: [[176, 180], [204, 178], [242, 214], [206, 222]], r: [[346, 178], [316, 176], [276, 214], [312, 222]], lid: [0, 0] },
    smug: { l: [[176, 186], [206, 170], [240, 208], [208, 222]], r: [[346, 186], [314, 176], [278, 208], [312, 220]], lid: [0.15, 0.55] },
    shocked: { l: [[180, 196], [206, 162], [238, 198], [210, 230]], r: [[344, 194], [314, 160], [280, 198], [310, 230]], lid: [0, 0] },
  }[mood];
  [['l', 0], ['r', 1]].forEach(([k, i]) => {
    const [o, t, inn, bt] = E[k];
    const d = mood === 'shocked' ? cr([o, t, inn, bt]) : cr([o.concat(1), t, inn.concat(1), bt]);
    const cx = (o[0] + inn[0]) / 2, cy = (t[1] + bt[1]) / 2, w = Math.abs(inn[0] - o[0]);
    const lid = E.lid[i];
    D.region(d, C.eye, {
      sw: 4,
      inner: sh(ellD(cx, cy + 10, w * 0.42, 9, i ? 18 : -18), C.eyeRef, 'opacity="0.75"') + b(sh(ellD(cx, cy + 13, w * 0.3, 5, i ? 18 : -18), C.eyeRef2, 'opacity="0.7"')) +
        `<circle cx="${cx - w * 0.14}" cy="${cy - 5}" r="${mood === 'shocked' ? 4 : 6.5}" fill="#fff"/><circle cx="${cx + w * 0.16}" cy="${cy + 6}" r="${mood === 'shocked' ? 2 : 3}" fill="#fff"/>` +
        (lid ? sh(cr([[o[0] - 10, o[1] - 30], [inn[0] + (i ? -10 : 10), inn[1] - 30], [inn[0], inn[1] - 30 + 30 * lid + 8], [cx, t[1] + (bt[1] - t[1]) * lid], [o[0], o[1] + 2]]), C.skin) +
          L([[o[0], o[1] + 1], [cx, t[1] + (bt[1] - t[1]) * lid], [inn[0], inn[1] - 30 + 30 * lid + 8]], 3, INK) : ''),
    });
    // lid line above (gentle), or angry ridge
    if (mood === 'angry') D.ink(i ? [[350, 172], [314, 168], [272, 202]] : [[172, 174], [206, 170], [246, 204]], 5, { a: 0.1, b: 0.2 });
    else D.ink(i ? [[350, 178], [314, 160 - (mood === 'shocked' ? 6 : 0)], [282, 194]] : [[172, 180], [204, 162 - (mood === 'shocked' ? 6 : 0)], [236, 194]], 2.4, { a: 0.3, b: 0.3, op: 0.75 });
  });
  // nose slits
  D.ink([[250, 246], [248, 254]], 2.6);
  D.ink([[266, 246], [268, 254]], 2.6);
  // small mouth
  if (mood === 'shocked') D.region(ellD(258, 286, 7, 9), '#3b1830', { sw: 3 });
  else if (mood === 'angry') { D.region(cr([[242, 288, 1], [258, 282], [274, 288, 1], [258, 294]]), '#3b1830', { sw: 3, inner: `<rect x="240" y="282" width="36" height="5" fill="#f2eefa"/>` }); }
  else if (mood === 'smug') D.ink([[244, 286], [258, 288], [274, 280]], 3.2, { a: 0.2, b: 0.2 });
  else D.ink([[246, 284], [258, 287], [270, 284]], 3, { a: 0.25, b: 0.25 });
  D.ink([[252, 298], [264, 298]], 1.8, { op: 0.4 });
  sweat(D, 160, 170);
  D.close();
  vignette(D, '#200a3a', B ? 0.45 : 0.35, 0.55);
  D.grain(0.28);
  return D.toString();
}
