/**
 * Gezeichnete Figur: Zeichnung der Ruestung und des Zubehoers der Fraktionen (Formen in armour.ts).
 * Inked figure: drawing of the faction armour and accessories (shapes in armour.ts).
 */
import { FAITH } from '../alveniaFaith';
import { rng } from '../kit';
import { look, mat } from '../look';
import { TECH } from '../velkarTech';
import { arc, rrect, spline, type Cell, type Pen } from './atlas';
import { CAPE } from './armour';
import { paintEmblem } from './emblem';
import { star } from './headPaint';

/** Brustplatte der Alvenia (Entwurf 192 x 128): Goldborten oben und unten, Stern, Mittelborte / Alvenia chest plate (design 192 x 128) */
export function paintFaithPlate(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const t0 = H * 0.1, t1 = H * 0.9;
  p.gradient(0, t0, W, t1 - t0, [0, t0], [0, t1], 1.06, 0.86);
  for (const y of [t0, t1]) p.line([[-3, y], [W + 3, y]], 1.6, { taper: 0, wobble: 0.2 });
  // Mittelborte in Gold und Stern darueber / gold centre band with the star above it
  const my = H * 0.6;
  p.fill([[14, my - 3.5], [W - 14, my - 3.5], [W - 14, my + 3.5], [14, my + 3.5]], FAITH.gold);
  for (const d of [-3.5, 3.5]) p.line([[12, my + d], [W - 12, my + d]], 1.2, { taper: 0.05, wobble: 0.15 });
  p.dab(cx, H * 0.36, 26, 0.86, 0.55);
  star(p, cx, H * 0.36, 19, FAITH.gold, 1.7);
  // Brustwoelbung und Nieten / chest swell and rivets
  for (const s of [-1, 1]) {
    p.line(spline([[cx + s * 30, t0 + 8], [cx + s * 46, H * 0.36], [cx + s * 34, my - 8]], 5), 1.4, { taper: 0.4 });
    p.rivet(cx + s * 74, t0 + 9, 2.6);
    p.rivet(cx + s * 74, t1 - 9, 2.6);
    p.fill([[cx + s * 52, t0 + 12], [cx + s * 58, t0 + 10], [cx + s * 56, H * 0.34], [cx + s * 51, H * 0.34]], mat.white, 0.45);
  }
  p.scratches(10, t0 + 6, W - 20, t1 - t0 - 12, 4, 601, 16);
}

/** Brustplatte der Velkar (Entwurf 192 x 112): Platten, Fugen, Lueftung / Velkar chest plate (design 192 x 112) */
export function paintTechPlate(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.05, 0.86);
  p.panel([[cx, H * 0.34], [cx, H - 6]], 1.5);
  for (const s of [-1, 1]) {
    const r = rrect(cx + s * 48 - 22, H * 0.46, 44, 30, 5);
    p.shade(r, 0.84, 0.9);
    p.panel(r.concat([[cx + s * 48 + 17, H * 0.46]]), 1.5);
    for (const dy of [9, 16, 23]) p.line([[cx + s * 48 - 12, H * 0.46 + dy], [cx + s * 48 + 12, H * 0.46 + dy]], 1.6, { taper: 0.1, wobble: 0 });
    p.rivet(cx + s * 80, 10, 2.3);
    p.rivet(cx + s * 80, H - 10, 2.3);
  }
  p.panel(spline([[18, H * 0.34], [cx, H * 0.38], [W - 18, H * 0.34]], 5), 1.5);
  p.fill([[cx - 60, 10], [cx - 52, 8], [cx - 56, H * 0.28], [cx - 62, H * 0.28]], mat.white, 0.4);
}

/** Brustplatte der Dravon (Entwurf 128 x 80): Goldrand, dunkles Feld mit Nieten / Dravon chest plate (design 128 x 80) */
export function paintDravonPlate(p: Pen): void {
  const W = p.w, H = p.h;
  const r = rrect(13, 10, W - 26, H - 20, 6);
  p.shade(r, 0.3, 0.95);
  p.line(r, 1.8, { closed: true, wobble: 0.2 });
  p.crease(rrect(17, 14, W - 34, H - 28, 4).concat([[W - 21, 14]]), 1.3, 2.2, 0.6, { taper: 0, wobble: 0.1 });
  for (const x of [7, W - 7]) for (const y of [7, H - 7]) p.rivet(x, y, 2.4);
  paintEmblem(p, 'dravon', W / 2, H / 2, 15, look('dravon').secondary, 1.5);
}

/** Schulterklappe (Entwurf 64 x 64): Rand, Naht, Stern / shoulder board (design 64 x 64) */
export function paintEpaulette(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(4, 4, W - 8, H - 8, 5), 1.6, { closed: true, wobble: 0.2 });
  p.stitch(rrect(8, 8, W - 16, H - 16, 3).concat([[W - 11, 8]]), 3.2, 2.6, 0.9, 0.6);
  for (const y of [H * 0.36, H * 0.52, H * 0.68]) p.crease([[14, y], [W - 14, y]], 2.2, 0.7, 0.8, { taper: 0.1 });
}

/** Weste der Meridon (Entwurf 384 x 112): Reissverschluss, Brusttaschen, Schnallen, Rueckennaht / Meridon vest (design 384 x 112) */
export function paintVest(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.gradient(0, 0, W, 16, [0, 0], [0, 16], 0.74, 1);
  // Reissverschluss: Doppellinie mit Zipper / zip: double line with the pull
  for (const d of [-2.4, 2.4]) p.line([[cx + d, 4], [cx + d, H - 3]], 1.3, { taper: 0.05, wobble: 0.2 });
  p.fill(rrect(cx - 3.5, 16, 7, 11, 2), mat.metalLight);
  p.line(rrect(cx - 3.5, 16, 7, 11, 2), 1.2, { closed: true, wobble: 0 });
  for (const s of [-1, 1]) {
    // Brusttasche mit Klappe / chest pocket with flap
    const pc = cx + s * 44, x0 = pc - 20, x1 = pc + 20;
    p.shade([[x0, 34], [x1, 34], [x1, 66], [x0, 66]], 0.9, 0.8);
    p.shade([[x0 - 1, 24], [x1 + 1, 24], [x1 + 1, 36], [pc, 41], [x0 - 1, 36]], 0.8, 0.9);
    p.line([[x0, 36], [x0, 63], [x0 + 3, 66.5], [x1 - 3, 66.5], [x1, 63], [x1, 36]], 1.6, { taper: 0.05, wobble: 0.3 });
    p.line([[x0 - 1, 24], [x1 + 1, 24], [x1 + 1, 36], [pc, 41], [x0 - 1, 36]], 1.8, { closed: true, wobble: 0.3 });
    p.spot(pc, 35, 2.4, mat.metalLight);
    // Schultergurt und seitliche Schnalle / shoulder strap and side buckle
    p.band([[cx + s * 78, 0], [cx + s * 80, 46], [cx + s * 78, H]], 8, mat.darkMid);
    p.fill(rrect(cx + s * 80 - 6, 76, 12, 9, 2), mat.metalLight);
    p.line(rrect(cx + s * 80 - 6, 76, 12, 9, 2), 1.3, { closed: true, wobble: 0.1 });
    // Seitennaht mit Schnuerung: drei Riegel / side seam with three bar tacks
    const sx = cx + s * 118;
    p.line([[sx, 14], [sx, H - 4]], 1.2, { taper: 0.1, wobble: 0.3 });
    for (const y of [34, 58, 82]) p.band([[sx - 8, y], [sx + 8, y]], 5, mat.darkMid, 1);
    // Rueckenpasse / back yoke
    p.line(spline([[cx + s * 192, 30], [cx + s * 160, 28], [cx + s * 132, 36]], 5), 1.3, { taper: 0.3 });
  }
  // Saum mit Naht / hem with stitching
  p.stitch([[0, H - 7], [W, H - 7]], 3.4, 2.8, 1, 0.6);
  p.line([[-3, H - 2], [W + 3, H - 2]], 1.4, { taper: 0, wobble: 0.2 });
  for (const x of [1.5, W - 1.5]) p.line([[x, 10], [x, H - 4]], 1.2, { taper: 0.1, wobble: 0.3 });
}

/** Umhang der Alvenia (Entwurf 256 x 256): lange Falten, grosser Stern auf dem Ruecken / Alvenia cape (design 256 x 256) */
export function paintCape(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const Y = (y: number) => ((CAPE.top - y) / (CAPE.top - CAPE.hem)) * H;
  const top = Y(0.1485), hem = Y(-0.128);
  p.line([[-3, top], [W + 3, top]], 1.6, { taper: 0, wobble: 0.2 });
  p.gradient(0, top, W, 26, [0, top], [0, top + 26], 0.72, 1);
  // Falten: wenige lange Linien mit breitem Schatten / folds: a few long lines with a wide shadow
  const R = rng(613);
  for (const s of [0.3, 0.42, 0.58, 0.7]) {
    const x = s * W + (R() - 0.5) * 6;
    p.crease(spline([[x - 4, top + 14], [x + 3, (top + hem) / 2], [x - 2, hem - 4]], 6), 8, 0.78, 0.6, { taper: 0.25 });
    p.line(spline([[x, top + 10], [x + 6, (top + hem) / 2], [x + 1, hem - 2]], 6), 1.5, { taper: 0.35, wobble: 0.5 });
  }
  // Stern der Alvenia in Gold / the Alvenia star in gold
  star(p, cx, top + (hem - top) * 0.36, 22, FAITH.gold, 1.8);
  // Innenseite: dunkler / inner side: darker
  for (const [a, c] of [[0, 0.22], [0.78, 1]] as [number, number][]) p.shade([[a * W, top], [c * W, top], [c * W, hem], [a * W, hem]], 0.72, 0.9);
  p.line([[-3, hem], [W + 3, hem]], 1.6, { taper: 0, wobble: 0.2 });
  p.stitch([[0, hem - 5], [W, hem - 5]], 3.4, 2.8, 1, 0.6);
}

/** Wappenrock der Alvenia (Entwurf 96 x 128): Goldsaum, Stern, Randnaht / Alvenia tabard (design 96 x 128) */
export function paintTabard(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.gradient(0, 0, W, 22, [0, 0], [0, 22], 0.7, 1);
  for (const x of [5, W - 5]) p.stitch([[x, 4], [x, H - 16]], 3.2, 2.6, 0.9, 0.6);
  p.line(spline([[cx - 16, 20], [cx - 12, H * 0.5], [cx - 15, H - 18]], 5), 1.4, { taper: 0.4, wobble: 0.4 });
  p.crease(spline([[cx + 18, 22], [cx + 14, H * 0.5], [cx + 17, H - 18]], 5), 6, 0.8, 0.6, { taper: 0.3 });
  star(p, cx, H * 0.46, 13, FAITH.goldLight, 1.5);
  p.fill([[0, H - 14], [W, H - 14], [W, H - 3], [0, H - 3]], FAITH.gold);
  for (const y of [H - 14, H - 3]) p.line([[-2, y], [W + 2, y]], 1.4, { taper: 0, wobble: 0.15 });
}

/** Generator der Velkar, Rueckseite (Entwurf 128 x 128): Fenster des Kerns, Kuehlschlitze, Schrauben / Velkar generator, back face (design 128 x 128) */
export function paintTechPack(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, cy = H * 0.46;
  p.line(rrect(5, 5, W - 10, H - 10, 10), 1.6, { closed: true, wobble: 0.2 });
  p.dab(cx, cy, 44, 0.8, 0.7);
  p.line(arc(cx, cy, 36, 36, 0, Math.PI * 2, 28), 2.2, { closed: true, wobble: 0.15 });
  p.line(arc(cx, cy, 30, 30, 0, Math.PI * 2, 24), 1.3, { closed: true, wobble: 0.1 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.52; p.rivet(cx + Math.cos(a) * 43, cy + Math.sin(a) * 43, 2.2); }
  for (const dx of [-30, -15, 0, 15, 30]) p.line([[cx + dx, H - 22], [cx + dx, H - 11]], 1.9, { taper: 0.1, wobble: 0 });
  p.fill([[14, 12], [26, 10], [20, 30], [12, 30]], mat.white, 0.4);
  void TECH;
}
/** Generator, Seite (Entwurf 64 x 128): Kuehlrippen als drei Fugen / generator, side (design 64 x 128): cooling fins as three joints */
export function paintTechSide(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [W * 0.3, W * 0.5, W * 0.7]) {
    p.crease([[x + 2.5, 16], [x + 2.5, H - 16]], 3.5, 0.66, 0.8, { taper: 0.05, wobble: 0 });
    p.line([[x, 14], [x, H - 14]], 1.6, { taper: 0.05, wobble: 0.1 });
  }
  for (const y of [8, H - 8]) p.rivet(W / 2, y, 2.2);
}

/** Zellen der Ruestung, um k skaliert / armour cells, scaled by k */
export function armourCells(k = 1): Cell[] {
  const c = (name: string, w: number, h: number, paint: (p: Pen) => void): Cell => ({ name, w: Math.max(16, Math.round(w * k)), h: Math.max(12, Math.round(h * k)), design: [w, h], paint });
  return [
    c('plate:alvenia', 192, 128, paintFaithPlate),
    c('plate:velkar', 192, 112, paintTechPlate),
    c('plate:dravon', 128, 80, paintDravonPlate),
    c('epaulette', 64, 64, paintEpaulette),
    c('vest:meridon', 384, 112, paintVest),
    c('cape:alvenia', 256, 256, paintCape),
    c('tabard:alvenia', 96, 128, paintTabard),
    c('techPack', 128, 128, paintTechPack),
    c('techSide', 64, 128, paintTechSide),
  ];
}
