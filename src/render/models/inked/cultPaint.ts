/**
 * Gezeichnete Einheiten: eigene Zeichnung der Kult-Fusstruppen (Ornat des Propheten).
 * Inked units: own drawing of the cult foot troops (the prophet's vestment).
 */
import { rng } from '../kit';
import { look, mat } from '../look';
import { spline, type Cell, type Pen } from './atlas';
import { VESTMENT } from './cult';
import { paintEmblem } from './emblem';

/** Ornat (Entwurf 320 x 192): Knochenstola vorn, Sonnenzeichen, Borte, lange Falten / vestment (design 320 x 192): bone stole in front, sun marks, trim, long folds */
export function paintVestment(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const Y = (y: number) => ((VESTMENT.top - y) / (VESTMENT.top - VESTMENT.bottom)) * H;
  const hemTop = Y(0.084), hemBot = Y(0.056);
  const R = rng(911);
  p.gradient(0, 0, W, Y(0.33), [0, 0], [0, Y(0.33)], 0.72, 1);
  // Stola aus Knochenplatten: Band mit Querfugen / stole of bone plates: a band with cross joints
  const x0 = cx - 13, x1 = cx + 13;
  p.fill([[x0, 8], [x1, 8], [x1 + 3, hemTop - 8], [x0 - 3, hemTop - 8]], mat.bone);
  p.line([[x0, 8], [x0 - 3, hemTop - 8]], 1.6, { taper: 0.05, wobble: 0.3 });
  p.line([[x1, 8], [x1 + 3, hemTop - 8]], 1.6, { taper: 0.05, wobble: 0.3 });
  for (let y = 30; y < hemTop - 14; y += 24) p.line([[x0 - 1, y], [x1 + 1, y + 2]], 1.3, { taper: 0.1, wobble: 0.3 });
  p.line([[x0 - 3, hemTop - 8], [x1 + 3, hemTop - 8]], 1.6, { taper: 0, wobble: 0.2 });
  // Sonnenzeichen des Kults links und rechts / the cult's sun mark left and right
  for (const s of [-1, 1]) paintEmblem(p, 'vesper', cx + s * 62, Y(0.15), 15, look('vesper').emblem, 1.5);
  // Borte ueber dem Glutsaum / trim above the ember hem
  p.crease([[0, hemTop - 16], [W, hemTop - 16]], 3, 0.62, 0.85, { taper: 0, wobble: 0.3 });
  p.line([[-3, hemTop], [W + 3, hemTop]], 1.7, { taper: 0, wobble: 0.2 });
  p.line([[-3, hemBot], [W + 3, hemBot]], 1.7, { taper: 0, wobble: 0.2 });
  // lange Falten / long folds
  for (const s of [0.07, 0.2, 0.31, 0.69, 0.8, 0.93]) {
    const x = s * W + (R() - 0.5) * 8;
    p.line(spline([[x, 20 + R() * 20], [x + 6, H * 0.5], [x - 2, hemTop - 20]], 6), 1.4, { taper: 0.4, wobble: 0.5 });
    p.crease(spline([[x + 7, 34], [x + 13, H * 0.5], [x + 5, hemTop - 18]], 6), 8, 0.78, 0.5, { taper: 0.3 });
  }
  p.splatter(0, hemBot, W, H - hemBot, 14, mat.rustDark, 913, { size: 4, alpha: 0.5 });
}

/** Zellen der Kult-Fusstruppen, um k skaliert / cells of the cult foot troops, scaled by k */
export function cultCells(k = 1): Cell[] {
  return [{ name: 'vestment:vesper', w: Math.round(320 * k), h: Math.round(192 * k), design: [320, 192], paint: paintVestment }];
}
