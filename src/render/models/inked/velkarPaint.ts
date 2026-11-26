/**
 * Gezeichnete Einheiten: Zeichnung der Velkar-Bauarten ("Labor im Feld") / inked units: drawing of the Velkar designs ("lab in the field").
 *
 * Glatte helle Schalen mit wenigen, sauberen Fugen: Wartungsklappe mit Schrauben, Lueftungsschlitze, Kennung, etwas
 * Frost und Abrieb an den Kanten. Was leuchtet, ist Geometrie in der Leuchtfarbe (Zelle 'glowStrip'), nie gemalt.
 * Smooth light shells with few clean joints: service flap with screws, vent slots, a marking, some frost and wear at
 * the edges. Whatever glows is geometry in the glow colour (cell 'glowStrip'), never painted.
 */
import { mat } from '../look';
import { arc, rrect, type Cell, type Pen } from './atlas';
import { BARE, SOOT, stencil, streaks } from './trim';

/** Schale (256 x 128): eine Ansicht, Oberkante oben / shell: one view, top edge up */
function paintTechPanel(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(7, 7, W - 14, H - 14, 12).concat([[W - 19, 7]]), 1.6);
  p.panel([[W * 0.62, 9], [W * 0.62, H - 9]], 1.4);
  // Wartungsklappe mit vier Schrauben / service flap with four screws
  const fx = 26, fy = 30, fw = 62, fh = 44;
  p.shade(rrect(fx, fy, fw, fh, 7), 0.9, 0.9);
  p.panel(rrect(fx, fy, fw, fh, 7).concat([[fx + fw - 7, fy]]), 1.6);
  for (const x of [fx + 8, fx + fw - 8]) for (const y of [fy + 8, fy + fh - 8]) p.rivet(x, y, 2.2);
  p.line([[fx + 22, fy + fh / 2], [fx + fw - 22, fy + fh / 2]], 2.2, { taper: 0.15 });
  // Lueftungsschlitze, Kennung / vent slots, marking
  for (let i = 0; i < 3; i++) {
    const y = 34 + i * 12;
    p.fill(rrect(110, y, 36, 6, 3), SOOT, 0.9);
    p.line(rrect(110, y, 36, 6, 3), 1.1, { closed: true, wobble: 0.1 });
  }
  stencil(p, mat.darkMid, 'V-07', W * 0.81, H * 0.36, 20, 701);
  p.line([[W * 0.67, H * 0.62], [W * 0.95, H * 0.62]], 1.2, { taper: 0.1, wobble: 0.3 });
  p.spot(W * 0.69, H * 0.74, 3.2, BARE);
  p.line(arc(W * 0.69, H * 0.74, 3.6, 3.6, 0, Math.PI * 2, 10), 1.1, { closed: true, wobble: 0.1 });
  // Schatten zur Unterkante, Frostschlieren, Abrieb / shade towards the lower edge, frost streaks, wear
  p.gradient(0, H * 0.66, W, H * 0.34, [0, H * 0.66], [0, H], 1, 0.84, 0.9);
  streaks(p, 0, 8, W, H * 0.5, 6, 703);
  p.scratches(10, 12, W - 20, H - 30, 6, 709, 18);
  p.chips(0, H - 9, W, 8, 12, BARE, 719, 2.6);
  p.chips(0, 0, W, 7, 8, BARE, 727, 2.4);
}

/**
 * Radarschirm in Polarkoordinaten (256 x 64): s = Winkel rundum, t = Mitte -> Rand. Speichen und zwei Ringe als Fugen.
 * Radar dish in polar coordinates: s = angle around, t = centre -> rim. Spokes and two rings as joints.
 */
function paintDish(p: Pen): void {
  const W = p.w, H = p.h;
  for (let i = 0; i < 6; i++) {
    const x = ((i + 0.5) / 6) * W;
    p.panel([[x, H * 0.2], [x, H - 5]], 1.5);
    p.rivet(x + 5, H * 0.82, 1.9);
  }
  for (const y of [H * 0.2, H * 0.62]) p.line([[-2, y], [W + 2, y]], 1.3, { taper: 0, wobble: 0.25 });
  p.gradient(0, 0, W, H * 0.2, [0, 0], [0, H * 0.2], 0.8, 1);
  p.gradient(0, H * 0.78, W, H * 0.22, [0, H * 0.78], [0, H], 1, 0.86);
  p.chips(0, H - 8, W, 7, 10, BARE, 733, 2.4);
}

/** Spule (128 x 96): s rundum, t entlang; Wicklungslagen als wenige Fugen, Klemmen / coil: s around, t along; winding layers as a few joints, clamps */
function paintCoil(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [H * 0.18, H * 0.5, H * 0.82]) {
    p.crease([[0, y - 2.5], [W, y - 2.5]], 2.4, 1.4, 0.7, { taper: 0, wobble: 0.2 });
    p.line([[-2, y], [W + 2, y]], 1.4, { taper: 0, wobble: 0.25 });
  }
  for (const x of [W * 0.25, W * 0.75]) { p.fill(rrect(x - 5, H * 0.5 - 7, 10, 14, 2), BARE); p.line(rrect(x - 5, H * 0.5 - 7, 10, 14, 2), 1.2, { closed: true, wobble: 0.1 }); }
  p.gradient(0, 0, W, H, [0, 0], [W, 0], 1.08, 0.9, 0.5);
}

/** Zellen der Velkar-Bauarten / cells of the Velkar designs */
export function velkarCells(): Cell[] {
  return [
    { name: 'panel:velkar', w: 256, h: 128, paint: paintTechPanel },
    { name: 'dish', w: 256, h: 64, paint: paintDish },
    { name: 'coil', w: 128, h: 96, paint: paintCoil },
  ];
}
