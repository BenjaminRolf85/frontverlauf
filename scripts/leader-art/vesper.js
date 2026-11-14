// Malachar (vesper): Prophet der Letzten Stunde.
// Ominous prophet: deep hood shadow, ember under-light, ash particles, heavy vignette; ominous but comic, no gore.
import { INK, cr, taper, Doc, P, T, L, tone, ellD, background, vignette, glowRect, mouth, rng } from './common.js';

export default function render(level, mood = 'neutral') {
  const D = new Doc(level, mood);
  const B = D.B;
  const { ht, hatch, xh, b } = tone(D);
  const C = {
    hood: '#8a1c1c', hoodSh: '#5e1010', hoodSh2: '#3a0909', hoodHi: '#b8352a', lining: '#1c1016',
    bone: '#eee4cb', boneSh: '#c7b892', boneSh2: '#9a8a68', boneLit: '#ffd9a8',
    skin: '#d9cabb', skinSh: '#a8948a', skinLit: '#f7c9a0',
    robe: '#2b2531', robeSh: '#1a161f', robeHi: '#4a4256',
    ember: '#ff7a1a', emberHi: '#ffd36a', chain: '#8d8a99', chainHi: '#c9c6d4',
    brass: '#b0782c', brassHi: '#e7b45a',
    lip: '#a8706c', lipSh: '#7c4a49', lipHi: '#cc9a92',
  };
  const sh = (d, c, x = '') => P(d, c, x);

  // ember glow from below, dark top, ash in the air
  background(D, { primary: '#2a0606', secondary: '#8a1c1c', glow: '#ff7a1a', cx: 256, cy: 520, r: 560, stops: [[0, '#ffb05a'], [0.18, '#ff7a1a'], [0.45, '#8a1c1c'], [1, '#1e0404']], rays: { n: 26, cx: 256, cy: 560, op: 0.06, w: 0.3, color: '#ffb05a' }, htOp: 0.25 });
  const R = rng(5);
  for (let i = 0; i < (B ? 40 : 18); i++) {
    const x = R() * 512, y = R() * 400, r = 1 + R() * 2.4, ember = R() < 0.4;
    if (x > 120 && x < 392 && y > 40 && y < 380) continue;
    D.add(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${ember ? C.emberHi : '#b9aeb0'}" opacity="${ember ? 0.9 : 0.5}"/>`);
  }

  // ---------- robe with chains ----------
  D.region(cr([[18, 520, 1], [24, 470], [56, 430], [120, 404], [190, 388], [256, 382], [322, 388], [392, 404], [456, 430], [488, 470], [494, 520, 1]]), C.robe, {
    sw: 5, rim: C.ember, rimOff: [0, -6],
    inner: sh(cr([[360, 400], [440, 424], [488, 470], [494, 520], [390, 520]]), C.robeSh) + sh(cr([[18, 520], [24, 470], [60, 436], [100, 440], [90, 520]]), C.robeSh) +
      sh(cr([[120, 520], [200, 470], [256, 460], [312, 470], [392, 520]]), C.ember, 'opacity="0.25"') +
      b(hatch(cr([[380, 420], [470, 450], [494, 520], [400, 520]]), 0.35) + T([[150, 420], [160, 470], [156, 520]], 2, INK, { op: 0.5 }) + T([[362, 420], [352, 470], [356, 520]], 2, INK, { op: 0.5 })),
  });
  // chains draped across the chest
  const chain = (pts) => {
    const segs = 9;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = (1 - t) * (1 - t) * pts[0][0] + 2 * (1 - t) * t * pts[1][0] + t * t * pts[2][0];
      const y = (1 - t) * (1 - t) * pts[0][1] + 2 * (1 - t) * t * pts[1][1] + t * t * pts[2][1];
      D.add(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${i % 2 ? 4 : 7}" ry="${i % 2 ? 7 : 4}" fill="none" stroke="${INK}" stroke-width="5"/><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${i % 2 ? 4 : 7}" ry="${i % 2 ? 7 : 4}" fill="none" stroke="${C.chain}" stroke-width="2.4"/>`);
    }
  };
  chain([[70, 440], [150, 500], [226, 470]]);
  chain([[442, 440], [362, 500], [286, 470]]);
  // red stoles hanging from the hood
  for (const s of [-1, 1]) {
    const x = 256 + s * 46;
    D.region(cr([[x - 20, 370, 1], [x + 20, 370, 1], [x + 24 + s * 6, 520, 1], [x - 18 + s * 6, 520, 1]]), C.hood, { sw: 4.5, inner: sh(cr([[x + s * 6, 370], [x + 20 * s, 370], [x + 24 * s + s * 6, 520], [x + s * 10, 520]]), C.hoodSh) + sh(cr([[x - 20, 470], [x + 26, 470], [x + 26, 520], [x - 20, 520]]), C.ember, 'opacity="0.25"') });
  }
  // lantern
  {
    const x = 256, y = 456;
    D.add(`<path d="M${x} 420V436" stroke="${INK}" stroke-width="4"/><circle cx="${x}" cy="416" r="6" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="${x}" cy="416" r="6" fill="none" stroke="${C.brass}" stroke-width="2.4"/>`);
    D.add(`<circle cx="${x}" cy="${y + 10}" r="44" fill="${C.ember}" opacity="0.28"/>`);
    D.region(cr([[x - 16, y - 18, 1], [x + 16, y - 18, 1], [x + 20, y + 26, 1], [x - 20, y + 26, 1]]), C.emberHi, { sw: 3.5, inner: sh(ellD(x, y + 6, 9, 14), '#fff4c4') + sh(cr([[x + 6, y - 18], [x + 20, y - 18], [x + 20, y + 26], [x + 8, y + 26]]), C.ember) });
    D.region(cr([[x - 22, y - 18, 1], [x, y - 32], [x + 22, y - 18, 1]]), C.brass, { sw: 3.5, inner: sh(cr([[x, y - 32], [x + 22, y - 18], [x, y - 18]]), '#7d5320') });
    D.region(cr([[x - 24, y + 24, 1], [x + 24, y + 24, 1], [x + 20, y + 34, 1], [x - 20, y + 34, 1]]), C.brass, { sw: 3.5 });
    D.add(`<path d="M${x} ${y - 18}V${y + 24}M${x - 18} ${y + 4}H${x + 18}" stroke="${INK}" stroke-width="2.4"/>`);
    // small bells
    for (const s of [-1, 1]) {
      const bx = x + s * 46, by = y + 12;
      D.region(cr([[bx - 11, by + 10, 1], [bx - 8, by - 6], [bx, by - 12], [bx + 8, by - 6], [bx + 11, by + 10, 1]]), C.brassHi, { sw: 3, inner: sh(cr([[bx + 2, by - 12], [bx + 11, by + 10], [bx + 2, by + 10]]), C.brass) });
      D.add(`<circle cx="${bx}" cy="${by + 13}" r="3.4" fill="${C.brass}" stroke="${INK}" stroke-width="2"/>`);
    }
  }

  // ---------- hood ----------
  const hood = cr([[256, 30, 1], [296, 64], [346, 112], [382, 196], [394, 290], [390, 362], [336, 386], [176, 386], [122, 362], [118, 290], [130, 196], [166, 112], [216, 64]]);
  D.region(hood, C.hood, {
    sw: 5.5, rim: C.ember, rimOff: [0, -8],
    inner: sh(cr([[256, 30], [300, 70], [350, 120], [384, 200], [396, 300], [390, 370], [340, 386], [356, 300], [344, 200], [300, 110]]), C.hoodSh) +
      sh(cr([[180, 80], [226, 50], [256, 34], [226, 70], [196, 110]]), C.hoodHi) +
      T([[160, 160], [146, 240], [150, 330]], 2.6, INK, { op: 0.6 }) + T([[356, 170], [372, 250], [370, 340]], 2.6, INK, { op: 0.6 }) +
      b(sh(cr([[360, 200], [394, 290], [390, 370], [362, 380]]), C.hoodSh2) + hatch(cr([[350, 160], [396, 290], [390, 372], [356, 370], [360, 260]]), 0.35) + T([[180, 120], [168, 200]], 1.4, C.hoodSh2) + T([[330, 120], [346, 190]], 1.4, C.hoodSh2)) +
      // ember underglow on the hood's lower rim
      sh(cr([[118, 330], [176, 380], [336, 380], [394, 330], [394, 390], [118, 390]]), C.ember, 'opacity="0.35"'),
  });
  // hood opening: deep shadow
  const open = cr([[256, 96], [314, 112], [346, 170], [352, 254], [334, 330], [256, 368], [178, 330], [160, 254], [166, 170], [198, 112]]);
  D.region(open, C.lining, { sw: 4.5, inner: sh(cr([[180, 300], [256, 340], [332, 300], [334, 370], [178, 370]]), '#4a1810') + b(P(cr([[166, 110], [346, 110], [346, 200], [166, 200]]), 'url(#dots)', 'opacity="0.35"')) });
  // stitched seam on the hood rim
  D.add(`<path d="${cr([[178, 118], [214, 98], [256, 90], [298, 98], [334, 118]], false)}" fill="none" stroke="${C.ember}" stroke-width="3" stroke-dasharray="7 6"/>`);

  // ---------- pale chin and grim lips ----------
  D.region(cr([[206, 250], [306, 250], [312, 290], [296, 326], [256, 346], [216, 326], [200, 290]]), C.skin, {
    sw: 4, inner: sh(cr([[200, 250], [312, 250], [312, 274], [200, 274]]), C.skinSh) + sh(cr([[220, 318], [256, 336], [292, 318], [282, 344], [230, 344]]), C.skinLit) + sh(cr([[290, 270], [312, 280], [300, 320], [284, 326]]), C.skinSh),
  });
  mouth(D, { cx: 256, cy: 300, w: 46, lf: 0.5, lips: C, full: 0.3, smile: -2, farSmile: -2 }, mood, { smugLift: 8 });
  D.ink([[250, 326], [262, 326]], 1.6, { op: 0.5 });

  // ---------- cracked bone mask over the upper face ----------
  const mask = cr([[256, 124], [298, 134], [322, 168], [326, 214], [318, 252], [306, 270, 1], [290, 262], [272, 272, 1], [256, 262], [240, 272, 1], [222, 262], [206, 270, 1], [194, 252], [186, 214], [190, 168], [214, 134]]);
  D.region(mask, C.bone, {
    sw: 4.5,
    inner: sh(cr([[180, 120], [332, 120], [332, 170], [256, 150], [180, 170]]), C.boneSh) + sh(cr([[290, 140], [326, 180], [326, 250], [306, 270], [300, 220]]), C.boneSh) +
      sh(cr([[196, 240], [256, 252], [316, 240], [306, 272], [256, 266], [206, 272]]), C.boneLit) +
      // nose ridge and brow ridges
      sh(cr([[250, 196], [262, 196], [268, 240], [256, 248], [244, 240]]), C.boneSh) +
      b(sh(cr([[180, 120], [332, 120], [332, 146], [180, 146]]), C.boneSh2) + ht(cr([[292, 150], [326, 190], [322, 250], [300, 230]]), 0.3)) +
      sh(cr([[180, 118], [332, 118], [332, 176], [300, 160], [256, 154], [212, 160], [180, 176]]), C.lining, 'opacity="0.45"') +
      // cracks
      L([[236, 126], [232, 146], [240, 158], [236, 176]], 2, INK) + L([[232, 146], [222, 150]], 1.6, INK) + L([[304, 242], [296, 256], [300, 266]], 1.8, INK) + b(L([[276, 130], [280, 142]], 1.2, INK)),
  });
  // brow ridge strokes (mood shapes them)
  const browY = { neutral: [0, 0], angry: [8, -2], smug: [0, -8], shocked: [-8, -8] }[mood];
  D.ink([[244, 186 + browY[0]], [226, 180], [204, 184 + browY[1] * (mood === 'smug' ? 0 : 1)]], 4, { a: 0.1, b: 0.5 });
  D.ink([[268, 186 + browY[0]], [288, 180 + (mood === 'smug' ? -6 : 0)], [308, 184 + browY[1]]], 4, { a: 0.1, b: 0.5 });
  // ember eye slits
  const slits = {
    neutral: [cr([[204, 204, 1], [222, 196], [244, 206, 1], [224, 212]]), cr([[308, 204, 1], [290, 196], [268, 206, 1], [288, 212]])],
    angry: [cr([[202, 196, 1], [224, 200], [246, 214, 1], [222, 214]]), cr([[310, 196, 1], [288, 200], [266, 214, 1], [290, 214]])],
    smug: [cr([[204, 206, 1], [224, 198], [244, 206, 1], [224, 210]]), cr([[308, 206, 1], [288, 204], [268, 206, 1], [288, 200]])],
    shocked: [ellD(224, 205, 15, 14), ellD(288, 205, 15, 14)],
  }[mood];
  slits.forEach((d, i) => {
    const cx = i ? 288 : 224;
    D.add(`<circle cx="${cx}" cy="205" r="${mood === 'angry' ? 30 : 22}" fill="${C.ember}" opacity="${mood === 'angry' ? 0.4 : 0.28}"/>`);
    D.region(d, '#2a0c08', { sw: 3.5, inner: sh(ellD(cx, 207, mood === 'shocked' ? 6 : 14, mood === 'shocked' ? 6 : 6), C.ember) + sh(ellD(cx, 207, mood === 'shocked' ? 3 : 8, 3), C.emberHi) });
  });
  if (mood === 'shocked') D.region(cr([[330, 150, 1], [336, 164], [330, 170], [324, 164]]), '#bfe6ff', { sw: 2.5 });

  // ember light from below, darkness from above
  D.add(glowRect(D, 0, 512, 0, 0, [[0, '#ff7a1a', 0.22], [0.4, '#ff7a1a', 0], [0.7, '#000', 0], [1, '#000', 0.4]]));
  vignette(D, '#080102', B ? 0.8 : 0.7, 0.45);
  D.grain(0.35);
  return D.toString();
}
