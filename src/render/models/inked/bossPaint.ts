/**
 * Gezeichnete Einheiten: Zeichnung der Schwarmmutter (Atlas 'alien') / inked units: drawing of the Swarm Mother (atlas 'alien').
 *
 * Die Schwarmmutter ist rund dreimal so hoch wie eine Einheit. Ihre Zellen liegen deshalb bei etwa 300 bis 580 Punkten
 * je Modelleinheit (wie die Besatzungen, halb so dicht wie eine Fahrzeugflaeche): die Striche sind damit auf dem Brett
 * so kraeftig wie ihre Groesse verlangt und bleiben in der Nahansicht duenner als der Umriss. Kreise sind als Ellipsen
 * gezeichnet, weil die Zellen rundum weniger dicht sind als in der Hoehe (kx / ky je Zelle).
 * Organisch: Rippenplatten, Wachstumsfugen, Pigmentflecken, Adern, Leuchtporen; Glas mit Brut. Leuchtfarben (mat.acid,
 * mat.xenoGlow) sind Grundstoffe der Zyrr und stehen als deckende Farbe in den Zellen; die Fraktionsfarbe kommt allein
 * aus den Vertexfarben.
 * The Swarm Mother is about three times as tall as a unit. Her cells therefore sit at about 300 to 580 pixels per model
 * unit (like the crews, half as dense as a vehicle surface): the strokes are thus as bold on the board as her size
 * demands and stay thinner than the silhouette in a close view. Circles are drawn as ellipses because the cells are
 * less dense around than in height (kx / ky per cell).
 * Organic: rib plates, growth seams, pigment spots, veins, glow pores; glass with brood. The glow colours (mat.acid,
 * mat.xenoGlow) are Zyrr base materials and stand as opaque colour in the cells; the faction colour comes from the
 * vertex colours alone.
 */
import { mix, rng } from '../kit';
import { mat } from '../look';
import { blotch, node } from './aliensPaint';
import { spline, type Cell, type Pen, type Pt } from './atlas';
import { rect } from './navalPaint';
import { SOOT } from './trim';

/** Ellipse als Punkte / ellipse as points */
const oval = (x: number, y: number, rx: number, ry: number, n = 16, rot = 0): Pt[] => {
  const out: Pt[] = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, u = Math.cos(a) * rx, v = Math.sin(a) * ry; out.push([x + u * c - v * s, y + u * s + v * c]); }
  return out;
};
/** Mandelform: Ellipse mit spitzen Enden / almond: an ellipse with pointed ends */
const almond = (x: number, y: number, rx: number, ry: number, rot: number, n = 20): Pt[] => {
  const out: Pt[] = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, u = Math.cos(a) * rx, v = Math.sin(a) * ry * (1 - 0.45 * Math.pow(Math.abs(Math.cos(a)), 3));
    out.push([x + u * c - v * s, y + u * s + v * c]);
  }
  return out;
};
/** Pigmentflecken mit eigenem Seitenverhaeltnis / pigment spots with their own aspect ratio */
function spots(p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number, size: number, sx = 1.3, sy = 0.9): void {
  const R = rng(seed);
  for (let i = 0; i < n; i++) p.shade(blotch(R, x + R() * w, y + R() * h, size * (0.5 + R() * 0.8), sx, sy), i % 3 === 0 ? 1.2 : 0.8, 0.8);
}
/** Ader: duenner Strich mit einer Gabelung / vein: a thin stroke with one fork */
function vein(p: Pen, pts: Pt[], w: number, fork?: Pt): void {
  const c = spline(pts, 5);
  p.line(c, w, { taper: 0.4, wobble: 0.3, press: 0.3 });
  if (fork) p.line(spline([c[Math.floor(c.length * 0.55)], [(c[Math.floor(c.length * 0.55)][0] + fork[0]) / 2 + 2, (c[Math.floor(c.length * 0.55)][1] + fork[1]) / 2], fork], 4), w * 0.8, { taper: 0.45, wobble: 0.2 });
}

/** Masse des Kopfes fuer Zeichnung und Geometrie / head dimensions shared by drawing and geometry */
export const HEAD = { top: 1.075, bottom: 0.738, eyeY: 0.907, eyeX: 0.057, lensX: 0.07, mouthY: 0.812, bandY: 1.028 };

/**
 * Kopf (512 x 256): s rundum (Gesicht in der Mitte, Naht am Hinterkopf), t Scheitel -> Kinn (linear in der Hoehe).
 * Vom Betrachter aus links das schraege Magenta-Auge mit Brauenwulst, rechts die Cyborg-Platte (die Linse ist
 * modelliert), Mund mit Nadelzaehnen, Stirnzeichen, Adern am Schaedel, Fugen am langen Hinterkopf.
 * Head: s around (face in the middle, seam at the back of the head), t crown -> chin (linear in height). Seen from the
 * viewer the slanted magenta eye with a brow ridge on the left, the cyborg plate on the right (the lens is modelled),
 * a mouth with needle teeth, the forehead mark, veins on the skull, seams on the long back of the head.
 */
function paintHead(p: Pen): void {
  const W = p.w, H = p.h, R = rng(1201);
  const cx = W / 2;
  // Hoehe -> Zeile; Punkte je Entwurfseinheit rundum (vorn) und in der Hoehe / height -> row; pixels per design unit around (front) and in height
  const Y = (y: number) => ((HEAD.top - y) / (HEAD.top - HEAD.bottom)) * H;
  const kx = W / (2 * Math.PI) / 0.14, ky = H / (HEAD.top - HEAD.bottom);
  const X = (x: number, rx = 0.136) => cx + Math.asin(Math.max(-1, Math.min(1, x / rx))) * (W / (2 * Math.PI));
  // Schatten unter dem Kronreif, an Schlaefen und Kinn / shadow below the crown band, at the temples and chin
  // der Scheitel liegt im Schatten der Krone / the crown of the head lies in the shadow of the crown
  p.shade(rect(0, 0, W, Y(HEAD.bandY)), 0.62, 1);
  const bandLow = HEAD.bandY - 0.012;
  p.shade(spline([[0, Y(bandLow - 0.014)], [W * 0.25, Y(bandLow - 0.02)], [cx, Y(bandLow - 0.026)], [W * 0.75, Y(bandLow - 0.02)], [W, Y(bandLow - 0.014)], [W, Y(bandLow + 0.004)], [0, Y(bandLow + 0.004)]], 4), 0.76, 0.9);
  p.gradient(0, Y(0.8), W, H - Y(0.8), [0, Y(0.8)], [0, H], 1, 0.74);
  for (const s of [-1, 1]) p.shade(spline([[cx + s * 92, Y(0.93)], [cx + s * 118, Y(0.88)], [cx + s * 110, Y(0.8)], [cx + s * 84, Y(0.77)], [cx + s * 78, Y(0.84)]], 5, true), 0.84, 0.85);
  // Pigmentflecken auf Schaedel und Hinterkopf / pigment spots on the skull and the back of the head
  spots(p, 150, Y(1.0), W - 300, Y(0.94) - Y(1.0), 5, 1203, 7, 1.5, 0.8);
  spots(p, 8, Y(0.98), 120, 110, 7, 1205, 8);
  spots(p, W - 128, Y(0.98), 120, 110, 7, 1207, 8);
  // Fugen des langen Hinterkopfs: drei Boegen je Seite, vom Scheitel nach hinten unten / seams of the long back of the head: three arcs per side from the crown down to the back
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x0 = cx + s * (150 + i * 26), y0 = Y(1.006) + i * 5;
    const c = spline([[x0, y0], [x0 + s * (26 + i * 4), y0 + 42], [x0 + s * (20 + i * 6), y0 + 96 - i * 10]], 6);
    p.crease(c.map((q): Pt => [q[0] + 2, q[1] + 1]), 2.4, 1.4, 0.7, { taper: 0.3 });
    p.line(c, 1.7, { taper: 0.3, wobble: 0.3, press: 0.4 });
  }
  // Adern an den Schlaefen unter dem Reif / veins at the temples below the band
  for (const s of [-1, 1]) {
    vein(p, [[cx + s * 84, Y(1.004)], [cx + s * 100, Y(0.975)], [cx + s * 96, Y(0.94)]], 1.5, [cx + s * 116, Y(0.955)]);
    vein(p, [[cx + s * 122, Y(1.004)], [cx + s * 134, Y(0.97)], [cx + s * 128, Y(0.9)]], 1.4, [cx + s * 146, Y(0.93)]);
  }
  // Stirnzeichen: Leuchtraute / forehead mark: glowing diamond
  const fy = Y(0.958);
  const diamond: Pt[] = [[cx, fy - 15], [cx + 7, fy], [cx, fy + 17], [cx - 7, fy]];
  p.fill(diamond, mat.acid);
  p.line(diamond, 1.5, { closed: true, wobble: 0.1 });
  // ---- linkes Auge (vom Betrachter): schraeg, magenta, mit Lichtpunkt / left eye (as seen): slanted, magenta, with a highlight ----
  const ex = X(-HEAD.eyeX), ey = Y(HEAD.eyeY);
  const rx = 0.056 * kx, ry = 0.03 * ky, rot = 0.42;
  const eye = almond(ex, ey, rx, ry, rot);
  p.shade(oval(ex + 1, ey + 3, rx * 1.2, ry * 1.5, 16, rot), 0.74, 0.85);
  p.fill(eye, mix(mat.xenoGlow, mat.red, 0.25));
  p.fill(oval(ex + 3, ey + 4, rx * 0.72, ry * 0.5, 12, rot), mix(mat.red, SOOT, 0.35), 0.5);
  p.spot(ex - rx * 0.38, ey + ry * 0.1, 3.4, mat.white, 0.95);
  p.spot(ex + rx * 0.2, ey - ry * 0.45, 1.8, mat.white, 0.8);
  p.line(eye, 2.6, { closed: true, wobble: 0.12, press: 0.25 });
  // Lid und Brauenwulst: kraeftige Striche / lid and brow ridge: heavy strokes
  p.line(spline([[ex - rx * 1.12, ey - ry * 0.25 - rx * 0.42], [ex - rx * 0.3, ey - ry * 1.05], [ex + rx * 0.7, ey + ry * 0.1], [ex + rx * 1.1, ey + ry * 0.9 + rx * 0.4]], 6), 5.4, { taper: 0.4, wobble: 0.2, press: 0.2 });
  const brow = spline([[ex - rx * 1.25, ey - ry * 1.3 - 12], [ex - rx * 0.2, ey - ry * 2.0], [ex + rx * 0.95, ey - ry * 1.0], [ex + rx * 1.25, ey + 2]], 6);
  p.shade([...brow, [ex + rx * 1.0, ey - ry * 0.2], [ex - rx * 0.2, ey - ry * 1.3], [ex - rx * 1.2, ey - ry * 0.9 - 10]], 0.72, 0.9);
  p.line(brow, 3.2, { taper: 0.3, wobble: 0.25, press: 0.3 });
  // ---- Cyborg-Platte rechts: Metall, Fugen, Schrauben, Fassung der Linse, Kabel zum Hals ----
  // ---- cyborg plate on the right: metal, seams, screws, the lens socket, cables to the neck ----
  const lx = X(HEAD.lensX), ly = ey;
  const plate = spline([[lx - 40, ly - 56], [lx + 18, ly - 62], [lx + 60, ly - 44], [lx + 70, ly + 6], [lx + 58, ly + 52], [lx + 8, ly + 60], [lx - 34, ly + 40], [lx - 44, ly - 8]], 4, true);
  p.shade(plate.map((q): Pt => [q[0] + 3, q[1] + 4]), 0.72, 0.9);
  p.fill(plate, mat.metalLight);
  p.fill([[lx + 34, ly - 54], [lx + 60, ly - 44], [lx + 70, ly + 6], [lx + 58, ly + 52], [lx + 30, ly + 58], [lx + 42, ly]], mat.metal, 0.75);
  p.line(plate, 2.2, { closed: true, wobble: 0.2, press: 0.2 });
  p.line([[lx - 38, ly - 30], [lx - 6, ly - 34], [lx + 30, ly - 52]], 1.3, { taper: 0.1, wobble: 0.2 });
  p.line([[lx + 30, ly + 30], [lx + 62, ly + 22]], 1.3, { taper: 0.1, wobble: 0.2 });
  p.fill(oval(lx, ly, 0.037 * kx, 0.037 * ky, 16), SOOT);
  p.line(oval(lx, ly, 0.037 * kx, 0.037 * ky, 16), 2, { closed: true, wobble: 0.08 });
  p.line(oval(lx, ly, 0.045 * kx, 0.045 * ky, 16), 1.2, { closed: true, wobble: 0.1 });
  for (const [dx, dy] of [[-30, -44], [50, -36], [58, 38], [-22, 34], [12, 52]] as Pt[]) p.rivet(lx + dx, ly + dy, 2.6);
  for (let i = 0; i < 3; i++) p.line([[lx + 40, ly - 22 + i * 9], [lx + 58, ly - 20 + i * 9]], 2.2, { taper: 0.15, wobble: 0.1 });
  // Kabel: eins dunkel, eins leuchtend / cables: one dark, one glowing
  const cable = spline([[lx + 30, ly + 54], [lx + 36, Y(0.8)], [lx + 14, H + 2]], 5);
  p.mark(cable, 3.4, mat.dark, 1, { taper: 0, wobble: 0.2, press: 0.1 });
  p.mark(cable.map((q): Pt => [q[0] + 8, q[1]]), 2.8, mat.acid, 1, { taper: 0, wobble: 0.2, press: 0.1 });
  for (const dx of [-2, 10]) p.line(cable.map((q): Pt => [q[0] + dx, q[1]]), 1, { taper: 0.05, wobble: 0.2 });
  // ---- Nase, Mund mit Nadelzaehnen, Wangenwuelste / nose, mouth with needle teeth, cheek ridges ----
  for (const s of [-1, 1]) p.line(spline([[cx + s * 4, Y(0.86)], [cx + s * 7, Y(0.848)], [cx + s * 5, Y(0.838)]], 3), 2, { taper: 0.4, wobble: 0.1 });
  const my = Y(HEAD.mouthY), mw = 27;
  const lipU = spline([[cx - mw, my + 3], [cx - mw * 0.4, my - 3], [cx, my - 1], [cx + mw * 0.4, my - 3], [cx + mw, my + 3]], 5);
  const lipL = spline([[cx + mw, my + 3], [cx + mw * 0.4, my + 8], [cx, my + 9], [cx - mw * 0.4, my + 8], [cx - mw, my + 3]], 5);
  p.fill([...lipU, ...lipL], SOOT);
  for (let i = 0; i < 7; i++) {
    const x = cx - mw * 0.74 + i * (mw * 1.48 / 6);
    p.fill([[x - 2.6, my - 2 + Math.abs(i - 3) * 0.5], [x + 2.6, my - 2 + Math.abs(i - 3) * 0.5], [x, my + 6.5]], mat.bone);
  }
  p.line(lipU, 2.4, { taper: 0.3, wobble: 0.15 });
  p.line(lipL, 1.6, { taper: 0.3, wobble: 0.15 });
  p.shade(spline([[cx - 16, my + 13], [cx, my + 17], [cx + 16, my + 13], [cx, my + 21]], 4, true), 0.78, 0.8);
  for (const s of [-1, 1]) {
    const c = spline([[cx + s * 58, Y(0.875)], [cx + s * 50, Y(0.83)], [cx + s * 30, Y(0.79)]], 5);
    p.crease(c.map((q): Pt => [q[0] - s * 3, q[1]]), 3, 0.72, 0.8, { taper: 0.35 });
    p.line(c, 1.6, { taper: 0.4, wobble: 0.25 });
  }
  // einzelne Leuchtporen an der Schlaefe / single glow pores at the temple
  for (let i = 0; i < 4; i++) node(p, X(-0.118) - 16 + R() * 22, Y(0.95) + i * 9 + R() * 4, 2 + R(), i % 2 ? mat.acid : mat.xenoGlow);
}

/**
 * Brustpanzer (512 x 168): s rundum (vorn in der Mitte), t Halsansatz -> Taille. Vorn je vier Rippenplatten beiderseits
 * der Herzscheibe (die ist modelliert), leuchtende Adern zu den Schultern, hinten Wirbelplatten.
 * Chest carapace: s around (front in the middle), t neck base -> waist. At the front four rib plates on either side of
 * the heart disc (which is modelled), glowing veins to the shoulders, vertebra plates at the back.
 */
function paintChest(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.shade(rect(0, 0, W, 12), 0.76, 0.9);
  p.gradient(0, H * 0.78, W, H * 0.22 + 2, [0, H * 0.78], [0, H], 1, 0.74);
  // Fassung der Herzscheibe: Schattenhof / socket of the heart disc: a shadow halo
  p.shade(oval(cx, H * 0.54, 31, 60, 20), 0.72, 0.9);
  // Rippenplatten: drei helle Platten je Seite mit Unterschatten, nach aussen ansteigend und kuerzer werdend
  // rib plates: three light plates per side with an under-shadow, rising outwards and getting shorter
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const y = 66 + i * 34, x0 = cx + s * (40 - i * 4), x1 = cx + s * (112 - i * 14), h = 20 - i * 2, up = 22 - i * 3;
    const rib = spline([[x0, y + 4], [(x0 + x1) / 2, y - up * 0.42], [x1, y - up], [x1 + s * 6, y - up + h * 0.5], [x1 - s * 2, y - up + h], [(x0 + x1) / 2, y + h - up * 0.36], [x0, y + h + 2], [x0 - s * 7, y + h / 2 + 3]], 4, true);
    p.shade(rib.map((q): Pt => [q[0] + 1, q[1] + 6]), 0.68, 0.85);
    p.shade(rib, 1.34, 0.9);
    p.line(rib, 2, { closed: true, wobble: 0.25, press: 0.3 });
    p.crease(spline([[x0 + s * 6, y + 8], [(x0 + x1) / 2, y - up * 0.42 + 5], [x1 - s * 6, y - up + 5]], 4), 2, 1.5, 0.6, { taper: 0.3 });
  }
  // Schluesselbeinplatte unter dem Halskragen / collar plate below the gorget
  for (const s of [-1, 1]) p.line(spline([[cx + s * 6, 30], [cx + s * 60, 22], [cx + s * 118, 30]], 5), 1.6, { taper: 0.3, wobble: 0.3, press: 0.3 });
  // leuchtende Adern von der Herzscheibe zu den Schultern und zur Taille / glowing veins from the heart disc to the shoulders and the waist
  for (const s of [-1, 1]) {
    const up = spline([[cx + s * 30, H * 0.3], [cx + s * 70, 18], [cx + s * 150, 12]], 6);
    const down = spline([[cx + s * 22, H * 0.86], [cx + s * 44, H * 0.93], [cx + s * 96, H - 4]], 5);
    for (const v of [up, down]) {
      p.mark(v, 3.4, mat.acid, 1, { taper: 0.35, wobble: 0.3, press: 0.2 });
      p.line(v.map((q): Pt => [q[0], q[1] + 2.4]), 1.1, { taper: 0.4, wobble: 0.3 });
    }
    for (let i = 0; i < 3; i++) node(p, cx + s * (150 + i * 16), 14 + i * 3, 2.6 - i * 0.4, i % 2 ? mat.xenoGlow : mat.acid);
  }
  // Brustbein unter der Herzscheibe / sternum below the heart disc
  p.line([[cx, H * 0.92], [cx, H - 2]], 1.6, { taper: 0.2, wobble: 0.15 });
  // Flanken: Atemschlitze, Pigment / flanks: breathing slits, pigment
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = cx + s * (166 + i * 11);
    p.line(spline([[x, 64], [x + s * 4, 86], [x + s * 2, 108]], 4), 2.8, { taper: 0.4, wobble: 0.2 });
    p.crease(spline([[x + s * 3, 66], [x + s * 7, 86], [x + s * 5, 106]], 4), 1.6, 1.5, 0.7, { taper: 0.4 });
  }
  spots(p, 24, 16, 80, H - 40, 6, 1211, 9, 1.6, 0.8);
  spots(p, W - 104, 16, 80, H - 40, 6, 1213, 9, 1.6, 0.8);
  // Ruecken (beiderseits der Naht): Wirbelplatten als Boegen, spiegelgleich, damit sie ueber die Naht laufen
  // back (either side of the seam): vertebra plates as arcs, mirrored so they run across the seam
  for (let i = 0; i < 5; i++) {
    const y = 22 + i * 30;
    for (const s of [-1, 1]) {
      const x = s > 0 ? 0 : W;
      const c = spline([[x - s * 3, y], [x + s * 20, y + 3], [x + s * 38, y + 16], [x + s * 30, y + 24], [x - s * 3, y + 20]], 5);
      p.shade([...c], 1.2, 0.7);
      p.line(c, 1.7, { taper: 0.05, wobble: 0.2, press: 0.3 });
    }
  }
}

/**
 * Chitinring des Hinterleibs (384 x 64): s rundum, t Oberkante -> Unterkante; gilt fuer alle Ringe. Wenige ungleiche
 * Wachstumsrippen, Pigment, Leuchtporen im unteren Drittel.
 * Chitin ring of the abdomen: s around, t upper edge -> lower edge; shared by all rings. A few uneven growth ridges,
 * pigment, glow pores in the lower third.
 */
function paintSegment(p: Pen): void {
  const W = p.w, H = p.h, R = rng(1221);
  p.shade(rect(0, 0, W, 9), 0.72, 0.9);
  p.crease([[0, 12], [W, 12]], 2.2, 1.4, 0.6, { taper: 0, wobble: 0.4 });
  p.gradient(0, H * 0.7, W, H * 0.3 + 2, [0, H * 0.7], [0, H], 1, 0.78);
  for (let x = 14 + R() * 20; x < W - 10; x += 34 + R() * 30) {
    const c = spline([[x, 11], [x + (R() - 0.5) * 6, H * 0.4], [x + (R() - 0.5) * 8, H * (0.55 + R() * 0.3)]], 4);
    p.line(c, 1.6, { taper: 0.4, wobble: 0.3, press: 0.4 });
    p.crease(c.map((q): Pt => [q[0] + 2.4, q[1]]), 1.8, 1.4, 0.6, { taper: 0.4 });
  }
  spots(p, 0, 16, W, H - 30, 9, 1223, 7, 1.7, 0.7);
  for (let i = 0; i < 9; i++) node(p, 16 + i * (W - 32) / 8 + (R() - 0.5) * 16, H * 0.7 + (R() - 0.5) * 8, 2.6 + R(), i % 3 ? mat.acid : mat.xenoGlow);
}

/**
 * Brutsack (384 x 128): s rundum, t Kragen -> Spitze. Glas: Eier mit dunklem Keim, verzweigte Adern, Lichtreflexe.
 * Brood sac: s around, t collar -> tip. Glass: eggs with a dark germ, branching veins, reflections.
 */
function paintBrood(p: Pen): void {
  const W = p.w, H = p.h, R = rng(1231);
  p.shade(rect(0, 0, W, 10), 0.7, 0.9);
  p.gradient(0, H * 0.62, W, H * 0.38 + 2, [0, H * 0.62], [0, H], 1, 0.66);
  // Adern vom Kragen nach unten / veins from the collar downwards
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * (W - 40) / 8 + (R() - 0.5) * 14;
    vein(p, [[x, 6], [x + (R() - 0.5) * 16, H * 0.3], [x + (R() - 0.5) * 22, H * (0.5 + R() * 0.2)]], 1.5, [x + (R() < 0.5 ? -16 : 16), H * (0.42 + R() * 0.2)]);
  }
  // Eier in zwei versetzten Reihen, ungleich gross, jedes mit einem gekruemmten Keim / eggs in two staggered rows, of uneven size, each with a curled germ
  const egg = mix(mat.acid, mat.white, 0.45), germ = mix(mat.alienSkinDark, SOOT, 0.3);
  for (let i = 0; i < 12; i++) {
    const row = i % 2, x = 18 + (i + 0.5) * (W - 36) / 12 + (R() - 0.5) * 8, y = H * (row ? 0.63 : 0.36) + (R() - 0.5) * 10;
    const rx = 9.5 + R() * 4, ry = rx * 1.35, rot = (R() - 0.5) * 0.9;
    p.shade(oval(x + 1.5, y + 3, rx * 1.1, ry * 1.1, 14, rot), 0.7, 0.8);
    p.fill(oval(x, y, rx, ry, 14, rot), egg, 0.95);
    const dir = R() < 0.5 ? 1 : -1;
    p.mark(spline([[x - dir * rx * 0.3, y - ry * 0.35], [x + dir * rx * 0.34, y - ry * 0.05], [x + dir * rx * 0.1, y + ry * 0.45], [x - dir * rx * 0.25, y + ry * 0.3]], 4), rx * 0.42, germ, 0.85, { taper: 0.45, wobble: 0 });
    p.spot(x - rx * 0.4, y - ry * 0.5, rx * 0.2, mat.white, 0.9);
    p.line(oval(x, y, rx, ry, 14, rot), 1.4, { closed: true, wobble: 0.12 });
  }
  // Lichtreflexe auf dem Glas / reflections on the glass
  for (const x of [W * 0.3, W * 0.56, W * 0.83]) {
    p.fill([[x, H * 0.12], [x + 12, H * 0.12], [x + 2, H * 0.5], [x - 8, H * 0.5]], mat.white, 0.32);
    p.fill([[x + 18, H * 0.16], [x + 22, H * 0.16], [x + 14, H * 0.4], [x + 10, H * 0.4]], mat.white, 0.24);
  }
}

/**
 * Schulterplatte (192 x 112): s rundum, t Scheitel -> Rand (nach Bogenlaenge). Plattenfugen vom Scheitel zum Rand,
 * ein Wachstumsbogen, Pigment, Kerben am Rand.
 * Shoulder plate: s around, t apex -> rim (by arc length). Plate seams from the apex to the rim, one growth arc,
 * pigment, nicks at the rim.
 */
function paintPauldron(p: Pen): void {
  const W = p.w, H = p.h, R = rng(1241);
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (W / 6);
    const c = spline([[x + (R() - 0.5) * 4, H * 0.3], [x + 3, H * 0.6], [x + (R() - 0.5) * 5, H - 6]], 5);
    p.crease(c.map((q): Pt => [q[0] + 2.4, q[1]]), 2.2, 1.45, 0.7, { taper: 0.3 });
    p.line(c, 1.8, { taper: 0.35, wobble: 0.3, press: 0.4 });
  }
  p.line(spline([[-3, H * 0.52], [W * 0.25, H * 0.5], [W * 0.5, H * 0.53], [W * 0.75, H * 0.5], [W + 3, H * 0.52]], 5), 1.3, { taper: 0, wobble: 0.4, press: 0.4 });
  spots(p, 0, H * 0.2, W, H * 0.6, 8, 1243, 7, 1.5, 0.8);
  p.gradient(0, H * 0.8, W, H * 0.2 + 2, [0, H * 0.8], [0, H], 1, 0.76);
  p.chips(0, H - 10, W, 8, 8, mix(mat.alienSkin, mat.white, 0.3), 1245, 2.6);
}

/** Horn (64 x 128): s rundum, t Wurzel -> Spitze; Wachstumsringe, zur Spitze enger, Wurzelschatten / horn: s around, t root -> tip; growth rings, closer towards the tip, a root shadow */
function paintHorn(p: Pen): void {
  const W = p.w, H = p.h, R = rng(1251);
  p.gradient(0, 0, W, H * 0.22, [0, 0], [0, H * 0.22], 0.66, 1);
  p.crease([[W * 0.62, 10], [W * 0.6, H * 0.8]], 5, 1.4, 0.55, { taper: 0.4, wobble: 0.2 });
  let y = 16;
  for (let i = 0; i < 6; i++) {
    const x0 = R() * W * 0.3, x1 = x0 + W * (0.5 + R() * 0.3);
    p.line(spline([[x0, y + 2], [(x0 + x1) / 2, y - 2], [x1, y + 2]], 4), 1.5, { taper: 0.35, wobble: 0.2, press: 0.3 });
    y += 24 - i * 2.5;
  }
}

/**
 * Nimbus (384 x 64): dunkler Hautring hinter dem Kopf; s rundum, t Aussenrand -> Innenrand. Leuchtende Adern laufen
 * vom Lichtring nach innen und gabeln sich.
 * Nimbus: dark ring of skin behind the head; s around, t outer rim -> inner rim. Glowing veins run inward from the
 * light ring and fork.
 */
function paintNimbus(p: Pen): void {
  const W = p.w, H = p.h, R = rng(1261);
  // die Haut ist dunkel: wenige kraeftige Adern leuchten, zum Lichtring hin wird sie heller
  // the skin is dark: a few bold veins glow, towards the light ring it gets lighter
  p.gradient(0, 0, W, H * 0.5, [0, 0], [0, H * 0.5], 1.6, 1);
  const n = 10;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (W / n) + (R() - 0.5) * 8, c0 = i % 3 ? mat.xenoGlow : mat.acid;
    const c = spline([[x, 2], [x + (R() - 0.5) * 6, H * 0.45], [x + (R() - 0.5) * 8, H - 6]], 5);
    p.mark(c, 3.6, c0, 1, { taper: 0.4, wobble: 0.3, press: 0.3 });
    if (i % 2) {
      const k = c[Math.floor(c.length * 0.35)], side = i % 4 === 1 ? 13 : -13;
      p.mark(spline([k, [k[0] + side * 0.6, k[1] + 14], [k[0] + side, H * 0.9]], 4), 2.6, c0, 1, { taper: 0.4, wobble: 0.2 });
    }
  }
}

/** Arm (96 x 128): s rundum, t Schulter -> Hand; zwei Sehnenlinien, Ringfalten an den Gelenken, Pigment / arm: s around, t shoulder -> hand; two sinew lines, ring folds at the joints, pigment */
function paintSinew(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [W * 0.36, W * 0.64]) {
    const c = spline([[x, 14], [x + 4, H * 0.5], [x - 2, H - 16]], 5);
    p.crease(c.map((q): Pt => [q[0] + 2.4, q[1]]), 2.2, 1.4, 0.6, { taper: 0.3 });
    p.line(c, 1.5, { taper: 0.35, wobble: 0.3, press: 0.3 });
  }
  for (const y of [9, H - 10]) p.line(spline([[W * 0.1, y + 2], [W / 2, y - 2], [W * 0.9, y + 2]], 4), 1.5, { taper: 0.25, wobble: 0.2 });
  spots(p, 6, 20, W - 12, H - 40, 5, 1271, 6);
  p.gradient(0, 0, W, 14, [0, 0], [0, 14], 0.74, 1);
}

/** Zellen der Schwarmmutter (Atlas 'alien') / cells of the Swarm Mother (atlas 'alien') */
export function bossCells(): Cell[] {
  return [
    { name: 'bossHead', w: 512, h: 256, paint: paintHead },
    { name: 'bossChest', w: 512, h: 168, paint: paintChest },
    { name: 'bossSegment', w: 384, h: 64, paint: paintSegment },
    { name: 'brood', w: 384, h: 128, paint: paintBrood },
    { name: 'bossPauldron', w: 192, h: 112, paint: paintPauldron },
    { name: 'horn', w: 64, h: 128, paint: paintHorn },
    { name: 'nimbus', w: 384, h: 64, paint: paintNimbus },
    { name: 'sinew', w: 96, h: 128, paint: paintSinew },
  ];
}
