/**
 * Gezeichnete Einheiten: Zeichnung der Alvenia-Sonderbauarten (Atlas 'faith').
 * Inked units: drawing of Alvenia's special designs (atlas 'faith').
 *
 * Alle Zellen mit Gold oder Koenigsblau gehoeren nur Alvenia (Name mit ':alvenia'): dort duerfen die Farben der
 * Formensprache (FAITH) deckend stehen. Buntglas, Sonnenkranz und Lichtkristall leuchten ueber die Vertexfarbe; ihre
 * Zellen tragen deshalb nur Bleiruten und Toenung, keine deckende Farbe.
 * All cells with gold or royal blue belong to Alvenia only (name with ':alvenia'): the colours of the design language
 * (FAITH) may stand opaque there. Stained glass, halo and light crystal glow through the vertex colour; their cells
 * therefore carry only lead cames and tinting, no opaque colour.
 */
import { FAITH } from '../alveniaFaith';
import { rng, type ColorLike } from '../kit';
import { mat } from '../look';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { SPARK } from './alveniaSpecial';
import { paintEmblem } from './emblem';
import { edgeChips, hatchDoor, rect, ring, slots } from './navalPaint';
import { BARE, MUD_DRY, MUD_WET, SOOT, streaks } from './trim';

/** Vierzackiger Stern / four-pointed star */
function star(p: Pen, x: number, y: number, r: number, c: ColorLike = FAITH.gold, rim = 1.2): void {
  const pts: Pt[] = [];
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.3 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  p.fill(pts, c);
  if (rim > 0) p.line(pts, rim, { closed: true, wobble: 0.08, press: 0.1 });
}
/** Goldborte: Band mit Tuscheraendern / gold trim: band with ink edges */
function trim(p: Pen, pts: Pt[], w: number, c: ColorLike = FAITH.gold): void {
  p.band(pts, w, c, 1.1);
}

/** Wannenwand (448 x 72): s rundum, t Deckkante -> Unterkante; oben Platte, Goldborte, darunter schattige Platte / hull wall: s around, t deck edge -> lower edge; plate on top, gold trim, shaded plate below */
function paintFaithHull(p: Pen): void {
  const W = p.w, H = p.h;
  const g0 = H * 0.146, g1 = H * 0.293;
  for (const y of [g0, g1]) p.line([[-3, y], [W + 3, y]], 1.3, { taper: 0, wobble: 0.15 });
  p.shade(rect(0, g1, W, 4), 0.82, 0.8);
  p.rivets([10, (g0 + g1) / 2], [W - 10, (g0 + g1) / 2], 22, 1.4);
  // Wartungsklappen mit Bogen, Fugen, Schaekel vorn / access panels with an arch, joints, shackles at the front
  for (const x of [70, 154, 294, 378]) {
    const a: Pt[] = [[x - 14, H - 12], [x - 14, g1 + 16], ...arc(x, g1 + 16, 14, 9, Math.PI, Math.PI * 2, 6), [x + 14, H - 12]];
    p.shade(a, 0.9, 0.8);
    p.line(a, 1.3, { closed: true, wobble: 0.15 });
  }
  for (const x of [56, 168, 280, 392]) p.line([[x, g1 + 3], [x + 0.5, H - 4]], 1.1, { taper: 0.1, wobble: 0.2 });
  for (const x of [192, 256]) { p.line(arc(x, H - 22, 5.5, 5.5, 0, Math.PI, 6), 2.2, { taper: 0.1 }); p.dab(x, H - 25, 3, 0.7, 0.8); }
  slots(p, 14, g1 + 10, 22, 3, 6);
  slots(p, W - 36, g1 + 10, 22, 3, 6);
  // Emblem des Ordens vorn und an beiden Seiten, gemalt (die Zelle gehoert nur Alvenia) / the order's emblem at the front and on both sides, painted (the cell belongs to Alvenia only)
  for (const x of [W * 0.25, W * 0.5, W * 0.75]) paintEmblem(p, 'alvenia', x, g1 + 19, 11, FAITH.gold, 1.1);
  streaks(p, 0, g1 + 2, W, H - g1 - 12, 8, 1001);
  p.mud(0, H * 0.7, W, H * 0.3, MUD_WET, MUD_DRY, 1003, 0.4);
}

/** Wannendeck (192 x 192), von oben, Bug oben / hull deck from above, bow up */
function paintFaithDeck(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(18, 14, W - 36, H - 28, 10), 1.2, { closed: true, wobble: 0.2 });
  trim(p, rrect(26, 22, W - 52, H - 44, 8).concat([[W - 34, 22]]), 2.6);
  // Motorgitter am Heck, Fahrerluken vorn / engine grille at the rear, driver hatches at the front
  p.fill(rrect(W / 2 - 34, H - 54, 68, 26, 3), SOOT, 0.9);
  for (let i = 0; i < 4; i++) p.crease([[W / 2 - 30, H - 49 + i * 6], [W / 2 + 30, H - 49 + i * 6]], 1.6, 1.9, 0.9, { taper: 0, wobble: 0 });
  p.line(rrect(W / 2 - 34, H - 54, 68, 26, 3), 1.5, { closed: true, wobble: 0.15 });
  for (const x of [W * 0.3, W * 0.7]) { p.shade(ring(x, 40, 11, 14), 0.86, 0.9); p.line(ring(x, 40, 11, 14), 1.5, { closed: true, wobble: 0.1 }); p.line(spline([[x - 5, 42], [x, 37], [x + 5, 42]], 4), 1.7, { taper: 0.15 }); }
  p.scratches(30, 30, W - 60, H - 90, 6, 1011, 20);
}

/** Schreinwand (448 x 104): s rundum, t Dachkante -> Sockel; Gesims, Quaderfugen, Sockellinie / shrine wall: s around, t eave -> plinth; cornice, ashlar joints, plinth line */
function paintShrine(p: Pen): void {
  const W = p.w, H = p.h, R = rng(1021);
  p.shade(rect(0, 0, W, 9), 0.78, 0.9);
  p.line([[-3, 9], [W + 3, 9]], 1.4, { taper: 0, wobble: 0.2 });
  trim(p, [[-2, 13.5], [W + 2, 13.5]], 3);
  for (const y of [40, 66]) {
    p.line([[-3, y], [W + 3, y]], 1, { taper: 0, wobble: 0.3, press: 0.4 });
    for (let x = 20 + R() * 40; x < W - 10; x += 70 + R() * 50) p.line([[x, y - 24], [x, y]], 0.9, { taper: 0.15, wobble: 0.2 });
  }
  // Eckpfeiler, Sockel / corner piers, plinth
  for (const x of [56, 168, 280, 392]) for (const dx of [-7, 7]) p.line([[x + dx, 16], [x + dx, H * 0.87]], 1.2, { taper: 0.05, wobble: 0.15 });
  p.line([[-3, H * 0.872], [W + 3, H * 0.872]], 1.4, { taper: 0, wobble: 0.15 });
  hatchDoor(p, 12, 44, 18, 44);
  streaks(p, 0, 18, W, 50, 7, 1023);
  edgeChips(p, 0, H * 0.8, W, 6, 8, 1025);
}

/** Dachflaeche (192 x 96): s entlang des Firsts, t First -> Traufe; Goldfirst, wenige Ziegelreihen / roof slope: s along the ridge, t ridge -> eave; gold ridge, a few tile courses */
function paintRoof(p: Pen): void {
  const W = p.w, H = p.h, R = rng(1031);
  p.fill(rect(0, 0, W, 6), FAITH.gold);
  p.line([[-3, 6], [W + 3, 6]], 1.3, { taper: 0, wobble: 0.15 });
  for (let i = 1; i <= 3; i++) {
    const y = 6 + i * 22;
    p.shade(rect(0, y, W, 4), 0.8, 0.8);
    p.line(spline([[0, y + R()], [W * 0.5, y + R() * 2], [W, y + R()]], 5), 1.2, { taper: 0, wobble: 0.3 });
    for (let x = 12 + R() * 30; x < W - 6; x += 38 + R() * 30) p.line([[x, y - 20], [x, y]], 0.9, { taper: 0.2, wobble: 0.2 });
  }
  trim(p, [[-2, H - 4], [W + 2, H - 4]], 3.4);
}

/** Giebel (96 x 80): Goldborte an den Schraegen, Dreipass / gable: gold trim along the rakes, trefoil */
function paintGable(p: Pen): void {
  const W = p.w, H = p.h;
  trim(p, [[3, H - 2], [W / 2, 4], [W - 3, H - 2]], 4.4);
  for (const [dx, dy] of [[0, -8], [-7, 4], [7, 4]]) { p.shade(ring(W / 2 + dx, H * 0.62 + dy, 6, 10), 0.78, 0.9); p.line(ring(W / 2 + dx, H * 0.62 + dy, 6, 10), 1.3, { closed: true, wobble: 0.1 }); }
}

/** Buntglasfenster (48 x 80): Bleiruten und getoente Felder; die Farbe leuchtet aus der Vertexfarbe / stained-glass window: lead cames and tinted panes; the colour glows from the vertex colour */
function paintGlass(p: Pen): void {
  const W = p.w, H = p.h;
  const frame: Pt[] = [[3, H - 3], [W - 3, H - 3], [W - 3, H * 0.36], [W * 0.76, H * 0.14], [W / 2, 3], [W * 0.24, H * 0.14], [3, H * 0.36]];
  p.shade(rect(0, H * 0.36, W / 2, H * 0.26), 1.3, 0.7);
  p.shade(rect(W / 2, H * 0.62, W / 2, H * 0.36), 1.3, 0.7);
  p.shade([[3, H * 0.36], [W / 2, 3], [W / 2, H * 0.36]], 0.8, 0.7);
  p.line(frame, 2.6, { closed: true, wobble: 0.1 });
  p.line([[W / 2, 4], [W / 2, H - 3]], 1.6, { taper: 0, wobble: 0.1 });
  for (const y of [H * 0.36, H * 0.62]) p.line([[3, y], [W - 3, y]], 1.4, { taper: 0, wobble: 0.1 });
  p.fill([[8, H * 0.58], [14, H * 0.42], [18, H * 0.42], [12, H * 0.58]], mat.white, 0.4);
}

/** Rosette (80 x 80) / rose window */
function paintRose(p: Pen): void {
  const c = p.w / 2;
  for (let i = 0; i < 8; i += 2) { const a = (i / 8) * Math.PI * 2; p.shade([[c, c], ...arc(c, c, 34, 34, a, a + Math.PI / 4, 4)], 1.3, 0.7); }
  p.line(ring(c, c, 35, 22), 3, { closed: true, wobble: 0.1 });
  p.line(ring(c, c, 13, 12), 1.6, { closed: true, wobble: 0.1 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.line([[c + Math.cos(a) * 13, c + Math.sin(a) * 13], [c + Math.cos(a) * 35, c + Math.sin(a) * 35]], 1.5, { taper: 0, wobble: 0.1 }); }
  p.fill([[c - 18, c - 6], [c - 10, c - 22], [c - 6, c - 20], [c - 13, c - 5]], mat.white, 0.4);
}

/** Fensterband (128 x 16) / window band */
function paintPane(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [1.5, H - 1.5]) p.line([[-2, y], [W + 2, y]], 1.5, { taper: 0, wobble: 0.1 });
  for (let x = 18; x < W; x += 22) { p.line([[x, 1], [x, H - 1]], 1.5, { taper: 0, wobble: 0 }); p.fill([[x - 15, H - 4], [x - 10, 4], [x - 7, 4], [x - 12, H - 4]], mat.white, 0.45); }
}

/** Schuerze (256 x 44): blaues Tuch mit Goldsaum und drei Sternen / skirt: blue cloth with a gold hem and three stars */
function paintSkirt(p: Pen): void {
  const W = p.w, H = p.h;
  trim(p, [[-2, H - 5], [W + 2, H - 5]], 6);
  p.line([[-3, 2], [W + 3, 2]], 1.2, { taper: 0, wobble: 0.2 });
  for (const x of [48, 128, 208]) star(p, x, 18, 9, FAITH.goldLight);
  for (const x of [88, 168]) p.crease(spline([[x, 4], [x + 3, H / 2], [x - 1, H - 10]], 4), 2.2, 0.78, 0.7, { taper: 0.3, wobble: 0.3 });
  p.splatter(0, H * 0.5, W, H * 0.5, 9, MUD_DRY, 1041, { size: 3, alpha: 0.5 });
}

/** Lichtrohr (96 x 224): s rundum (oben in der Mitte), t Verschluss -> Spitze; Gravurlinien, wenige Nieten / light barrel: s around (top in the middle), t breech -> tip; engraved lines, a few rivets */
function paintLightGun(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [W * 0.27, W * 0.73]) {
    p.line([[x, 8], [x, H * 0.4]], 1.1, { taper: 0.1, wobble: 0.15 });
    p.line([[x, H * 0.56], [x, H - 10]], 1.1, { taper: 0.1, wobble: 0.15 });
    p.crease([[x + 2, 8], [x + 2, H - 10]], 1.4, 1.4, 0.6, { taper: 0.1 });
  }
  for (const y of [H * 0.44, H * 0.52]) p.line(ring(W / 2, y, 2.2, 6), 1, { closed: true, wobble: 0 });
  p.scratches(8, 20, W - 16, H - 40, 5, 1051, 16);
}

/** Kasten (96 x 64): Platte mit Goldrahmen und Stern / box: plate with a gold frame and a star */
function paintFaithBox(p: Pen): void {
  const W = p.w, H = p.h;
  trim(p, rrect(6, 6, W - 12, H - 12, 4).concat([[W - 10, 6]]), 3);
  star(p, W / 2, H / 2, 11);
  for (const [x, y] of [[13, 13], [W - 13, 13], [13, H - 13], [W - 13, H - 13]]) p.rivet(x, y, 1.6);
}

/** Radscheibe der Sonnenlanze (96 x 96): Goldspeichen und Goldnabe / the Sun Lance's wheel disc: gold spokes and a gold hub */
function paintSunWheel(p: Pen): void {
  const c = p.w / 2;
  p.line(ring(c, c, 43, 28), 2.2, { closed: true, wobble: 0.15 });
  p.dab(c, c, 38, 0.9, 0.5);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; trim(p, [[c + Math.cos(a) * 12, c + Math.sin(a) * 12], [c + Math.cos(a) * 40, c + Math.sin(a) * 40]], 5.5, FAITH.goldDark); }
  p.fill(ring(c, c, 14, 16), FAITH.gold);
  p.line(ring(c, c, 14, 16), 1.8, { closed: true, wobble: 0.1 });
  star(p, c, c, 8, FAITH.goldLight, 1);
  p.splatter(0, 0, p.w, p.h, 12, MUD_DRY, 1061, { size: 4, rise: 0.8, alpha: 0.7 });
}

/** Spiegelschale von vorn (128 x 128): Goldsegmente, Lichtkeil / mirror dish from the front: gold segments, a wedge of light */
function paintDish(p: Pen): void {
  const c = p.w / 2;
  p.gradient(0, 0, p.w, p.h, [0, 0], [p.w, p.h], 1.25, 0.82);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; p.line([[c + Math.cos(a) * 30, c + Math.sin(a) * 30], [c + Math.cos(a) * 61, c + Math.sin(a) * 61]], 1.3, { taper: 0.05, wobble: 0.15 }); }
  for (const r of [31, 47, 61]) p.line(ring(c, c, r, 28), r > 60 ? 2.4 : 1.3, { closed: true, wobble: 0.15 });
  p.fill([[c - 20, c - 34], [c - 40, c - 16], [c - 50, c - 30], [c - 28, c - 50]], mat.white, 0.4);
}

/** Richtpult (64 x 40): Leuchtfeld und Goldknoepfe / aiming console: glowing panel and gold knobs */
function paintConsole(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill(rrect(6, 5, W - 26, H - 10, 3), FAITH.tech);
  p.line(rrect(6, 5, W - 26, H - 10, 3), 1.3, { closed: true, wobble: 0.1 });
  p.fill([[10, H - 9], [20, 9], [25, 9], [15, H - 9]], mat.white, 0.4);
  for (const y of [10, 20, 30]) { p.spot(W - 10, y, 3, FAITH.goldLight); p.line(ring(W - 10, y, 3, 8), 1, { closed: true, wobble: 0 }); }
}

/** Seitenwand des Goettlichen Funkens (448 x 72): s Bug -> Heck, t Deck -> Unterkante; blaues Panzerband, Goldkante, Nieten / the Divine Spark's side: s bow -> stern, t deck -> lower edge; blue armour band, gold edge, rivets */
function paintSparkSide(p: Pen): void {
  const W = p.w, H = p.h, S = SPARK;
  const X = (z: number) => ((S.z.c - z) / (S.z.c - S.z.a)) * W;
  trim(p, [[-2, 3], [W + 2, 3]], 5);
  p.rivets([X(0.26), 12], [X(-0.36), 12], 11, 1.7);
  p.fill(rect(X(0.27), H * 0.5, X(-0.4) - X(0.27), H * 0.24), FAITH.cloth);
  for (const y of [H * 0.5, H * 0.74]) p.line([[X(0.27), y], [X(-0.4), y]], 1.3, { taper: 0.02, wobble: 0.15 });
  for (const z of [0.2, 0.0, -0.3]) p.panel([[X(z), 16], [X(z), H * 0.5 - 2]], 1.2, 1071 + Math.round(z * 100));
  for (const z of [0.1, -0.02, -0.36]) star(p, X(z), H * 0.62, 5.5, FAITH.goldLight, 0.9);
  paintEmblem(p, 'alvenia', X(-0.19), H * 0.3, 11.5, FAITH.gold, 1.1);
  streaks(p, X(0.2), 16, X(-0.4) - X(0.2), H * 0.3, 6, 1073);
  edgeChips(p, X(0.3), 8, 40, H * 0.4, 5, 1075);
}

/** Deck des Goettlichen Funkens (288 x 304), von oben, Bug oben / the Divine Spark's deck from above, bow up */
function paintSparkDeck(p: Pen): void {
  const W = p.w, H = p.h, S = SPARK;
  const X = (x: number) => ((S.xw - x) / (2 * S.xw)) * W, Y = (z: number) => ((S.z.d - z) / (S.z.d - S.z.e)) * H;
  const k = W / (2 * S.xw);
  trim(p, rrect(5, 5, W - 10, H - 10, 4).concat([[W - 9, 5]]), 3.4);
  p.rivets([14, 13], [W - 14, 13], 12, 1.6);
  p.rivets([14, H - 13], [W - 14, H - 13], 12, 1.6);
  // Schatten und Fuge um den Drehkranz, Sockel der Nebentuerme / shade and joint around the turret ring, bases of the secondary turrets
  p.shade(ring(X(0), Y(S.tz), 0.19 * k, 28), 0.82, 0.9);
  p.line(ring(X(0), Y(S.tz), 0.19 * k, 28), 1.6, { closed: true, wobble: 0.2 });
  for (const s of [-1, 1]) { p.shade(ring(X(s * 0.2), Y(0.17), 0.06 * k, 16), 0.84, 0.9); p.line(ring(X(s * 0.2), Y(0.17), 0.06 * k, 16), 1.4, { closed: true, wobble: 0.15 }); }
  // Luftgitter am Heck, Fahrerluken vorn / vents at the rear, driver hatches at the front
  p.fill(rrect(X(0.07), Y(-0.262), 0.14 * k, Y(-0.365) - Y(-0.262), 3), SOOT, 0.92);
  for (let i = 0; i < 5; i++) p.crease([[X(0.062), Y(-0.275 - i * 0.02)], [X(-0.062), Y(-0.275 - i * 0.02)]], 1.8, 1.9, 0.9, { taper: 0, wobble: 0 });
  p.line(rrect(X(0.07), Y(-0.262), 0.14 * k, Y(-0.365) - Y(-0.262), 3), 1.5, { closed: true, wobble: 0.15 });
  for (const s of [-1, 1]) { const x = X(s * 0.09), y = Y(0.225); p.shade(rrect(x - 13, y - 9, 26, 18, 5), 0.86, 0.9); p.line(rrect(x - 13, y - 9, 26, 18, 5), 1.4, { closed: true, wobble: 0.15 }); p.line([[x - 5, y], [x + 5, y]], 1.6, { taper: 0.1 }); }
  for (const x of [0.105, -0.105]) p.line([[X(x), Y(0.26)], [X(x), Y(0.1)]], 1, { taper: 0.1, wobble: 0.3 });
  p.scratches(20, 20, W - 40, H - 40, 8, 1081, 22);
}

/** Bugplatte (320 x 72): Sonnenemblem aus Goldscheibe, Strahlen und blauem Stern / glacis: sun emblem of a gold disc, rays and a blue star */
function paintSparkGlacis(p: Pen): void {
  const W = p.w, H = p.h;
  const cx = W / 2, cy = H / 2 + 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, len = i % 2 ? 9 : 14, r = 19;
    const tip: Pt = [cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len)];
    const ray: Pt[] = [[cx + Math.cos(a - 0.2) * r, cy + Math.sin(a - 0.2) * r], tip, [cx + Math.cos(a + 0.2) * r, cy + Math.sin(a + 0.2) * r]];
    p.fill(ray, i % 2 ? FAITH.goldLight : FAITH.gold);
    p.line(ray, 1, { taper: 0.05, wobble: 0.08 });
  }
  p.fill(ring(cx, cy, 19, 22), FAITH.gold);
  p.line(ring(cx, cy, 19, 22), 1.8, { closed: true, wobble: 0.1 });
  star(p, cx, cy, 13, FAITH.cloth, 1);
  trim(p, [[-2, 3], [W + 2, 3]], 4);
  p.rivets([12, H - 8], [W - 12, H - 8], 14, 1.7);
  for (const x of [34, W - 34]) { p.fill(ring(x, cy, 9, 14), mat.lamp); p.line(ring(x, cy, 9, 14), 1.8, { closed: true, wobble: 0.1 }); p.line(ring(x, cy, 5, 10), 1, { closed: true, wobble: 0.1 }); }
  for (const x of [96, W - 96]) p.panel([[x, 9], [x, H - 13]], 1.2, 1091 + x);
  p.mud(0, H * 0.6, W, H * 0.4, MUD_WET, MUD_DRY, 1093, 0.3);
}

/** Heckschraege (320 x 40): Lamellen und Abgasfahnen / rear slope: louvres and exhaust stains */
function paintSparkRear(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [70, W - 130]) { p.fill(rrect(x, 8, 60, H - 16, 3), SOOT, 0.9); for (let i = 0; i < 3; i++) p.crease([[x + 3, 13 + i * 7], [x + 57, 13 + i * 7]], 1.8, 1.9, 0.9, { taper: 0, wobble: 0 }); p.line(rrect(x, 8, 60, H - 16, 3), 1.4, { closed: true, wobble: 0.15 }); }
  p.rivets([10, 5], [W - 10, 5], 12, 1.6);
  for (const x of [W / 2 - 32, W / 2 + 32]) p.gradient(x - 12, 0, 24, H, [0, 0], [0, H], 0.6, 1, 0.7);
}

/** Aussenseite der Kette (448 x 52): Laufrollen mit Goldnaben, Treibrad und Leitrad sind gezeichnet / outer side of the track: road wheels with gold hubs, sprocket and idler are drawn */
function paintSparkBay(p: Pen): void {
  const W = p.w, H = p.h, S = SPARK;
  const X = (z: number) => (0.5 - z / S.tl) * W, k = W / S.tl;
  const wy = H * (1 - 0.043 / S.th), wr = 0.039 * k;
  // heller Kettenlauf rundum / light track run all round
  p.crease(rrect(5, 4, W - 10, H - 8, (H - 8) / 2).concat([[W - H / 2, 4]]), 3, 2.1, 0.8, { taper: 0, wobble: 0 });
  const span = S.tl - 0.2;
  for (let i = 0; i < 6; i++) {
    const x = X(-span / 2 + (i / 5) * span);
    p.fill(ring(x, wy, wr, 18), mat.metal);
    p.line(ring(x, wy, wr, 18), 1.6, { closed: true, wobble: 0.1 });
    p.fill(ring(x, wy, wr * 0.6, 14), mat.darkMid);
    p.fill(ring(x, wy, wr * 0.3, 10), FAITH.gold);
    p.line(ring(x, wy, wr * 0.3, 10), 1, { closed: true, wobble: 0 });
  }
  for (const [z, c] of [[S.tl / 2 - 0.05, FAITH.goldDark], [-S.tl / 2 + 0.05, mat.metal]] as [number, ColorLike][]) {
    p.fill(ring(X(z), H * 0.42, 0.03 * k, 14), c);
    p.line(ring(X(z), H * 0.42, 0.03 * k, 14), 1.4, { closed: true, wobble: 0.1 });
    p.dot(X(z), H * 0.42, 2);
  }
  p.mud(0, H * 0.55, W, H * 0.45, MUD_WET, MUD_DRY, 1101, 0.35);
}

/** Laufflaeche der Kette (48 x 256): s quer, t einmal rundum; Kettenglieder als helle Stege / tread: s across, t once around; track links as light bars */
function paintSparkTrack(p: Pen): void {
  const W = p.w, H = p.h;
  for (let y = 6; y < H; y += 12) {
    p.shade(rrect(4, y - 3.5, W - 8, 7, 1.5), 1.9, 0.9);
    p.shade(rrect(7, y - 1.5, W - 14, 3, 1), 1.3, 0.9);
  }
  p.splatter(0, 0, W, H, 16, MUD_DRY, 1111, { size: 3, rise: 1, alpha: 0.7 });
}

/** Hauptrohr (128 x 288): s rundum (oben in der Mitte), t Verschluss -> Muendung; Gravurlinien in Gold, Stern am Verschluss / main barrel: s around (top in the middle), t breech -> muzzle; engraved gold lines, a star at the breech */
function paintSparkBarrel(p: Pen): void {
  const W = p.w, H = p.h;
  p.line([[-3, 9], [W + 3, 9]], 1.4, { taper: 0, wobble: 0.15 });
  star(p, W / 2, 34, 11, FAITH.gold);
  for (const x of [W * 0.2, W * 0.8]) {
    p.mark([[x, 20], [x, H * 0.44]], 2.2, FAITH.gold, 1, { taper: 0.08, wobble: 0.1 });
    p.mark([[x, H * 0.56], [x, H * 0.82]], 2.2, FAITH.gold, 1, { taper: 0.08, wobble: 0.1 });
  }
  p.crease([[W / 2 + 10, 60], [W / 2 + 10, H - 12]], 3, 1.5, 0.6, { taper: 0.1, wobble: 0.1 });
  p.scratches(10, 60, W - 20, H - 90, 6, 1121, 18);
}

/** Platte (128 x 96): Nietenreihen und Mittelfuge / plate: rivet rows and a centre joint */
function paintFaithPlate(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [9, H - 9]) p.rivets([8, y], [W - 8, y], 9, 1.7);
  p.panel([[W / 2, 14], [W / 2, H - 14]], 1.2, 1131);
  p.scratches(8, 16, W - 16, H - 32, 4, 1133, 16);
}

/** Lafettenwange (128 x 72): Nietenreihe, Goldstern / cradle cheek: rivet row, gold star */
function paintCheek(p: Pen): void {
  const W = p.w, H = p.h;
  p.rivets([24, H - 9], [W - 8, H - 9], 8, 1.7);
  star(p, W * 0.52, H * 0.55, 12);
  p.line(ring(W * 0.52, H * 0.55, 16, 16), 1.2, { closed: true, wobble: 0.15 });
  p.chips(4, 4, W - 8, 10, 5, BARE, 1141, 2.4);
}

/** Muendungsbremse von der Seite (64 x 48): zwei Schlitze / muzzle brake from the side: two slots */
function paintBrake(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [W * 0.3, W * 0.62]) { p.fill(rrect(x - 4, 8, 8, H - 16, 3), SOOT); p.line(rrect(x - 4, 8, 8, H - 16, 3), 1.3, { closed: true, wobble: 0.1 }); }
  p.gradient(W * 0.75, 0, W * 0.25, H, [W * 0.75, 0], [W, 0], 1, 0.6);
}

/** Banner (64 x 96): Goldborte, Stern im Ring, Fransen / banner: gold trim, star in a ring, fringe */
function paintBanner(p: Pen): void {
  const W = p.w, H = p.h;
  trim(p, rrect(5, 5, W - 10, H - 16, 2).concat([[W - 7, 5]]), 2.6);
  star(p, W / 2, H * 0.42, 13, FAITH.goldLight);
  p.line(ring(W / 2, H * 0.42, 17, 16), 1.2, { closed: true, wobble: 0.15 });
  for (let x = 8; x < W - 4; x += 8) p.mark([[x, H - 10], [x + 0.5, H - 2]], 2, FAITH.gold, 1, { taper: 0.3, wobble: 0.2 });
  p.crease(spline([[W * 0.3, 8], [W * 0.36, H / 2], [W * 0.28, H - 12]], 4), 2.4, 0.78, 0.6, { taper: 0.3, wobble: 0.3 });
}

/** Kasemattenwand (384 x 64): s rundum (Rohr vorn in der Mitte), t Oberkante -> Drehkranz / casemate wall: s around (barrel at the front, centre), t top edge -> ring */
function paintCasemate(p: Pen): void {
  const W = p.w, H = p.h;
  p.line([[-3, H * 0.14], [W + 3, H * 0.14]], 1.3, { taper: 0, wobble: 0.15 });
  p.rivets([10, H * 0.26], [W - 10, H * 0.26], 20, 1.6);
  for (const x of [W / 2 - 46, W / 2 + 46]) { p.fill(rrect(x - 13, H * 0.44, 26, 6, 2), SOOT); p.line(rrect(x - 17, H * 0.44 - 4, 34, 14, 3), 1.3, { closed: true, wobble: 0.1 }); }
  for (const x of [W * 0.25, W * 0.75]) star(p, x, H * 0.62, 9.5);
  for (const x of [W * 0.12, W * 0.38, W * 0.62, W * 0.88]) p.panel([[x, H * 0.3], [x, H - 5]], 1.2, 1151 + Math.round(x));
  edgeChips(p, 0, H - 7, W, 5, 10, 1153);
}

/** Turmwand (320 x 80): s rundum, t Dachkante -> Deck; obere Haelfte ruhig (dort liegen Farbbaender und Fenster) / tower wall: s around, t eave -> deck; upper half calm (colour bands and windows lie there) */
function paintTower(p: Pen): void {
  const W = p.w, H = p.h;
  p.line([[-3, 5], [W + 3, 5]], 1.2, { taper: 0, wobble: 0.15 });
  hatchDoor(p, 10, H * 0.46, 16, H * 0.5);
  for (const x of [W * 0.25, W * 0.5, W * 0.75]) {
    const a: Pt[] = [[x - 9, H - 10], [x - 9, H * 0.62], ...arc(x, H * 0.62, 9, 7, Math.PI, Math.PI * 2, 6), [x + 9, H - 10]];
    p.shade(a, 0.86, 0.9);
    p.line(a, 1.3, { closed: true, wobble: 0.12 });
  }
  p.rivets([36, H * 0.44], [W - 10, H * 0.44], 14, 1.5);
  edgeChips(p, 0, H - 7, W, 5, 8, 1161);
}

/** Zellen der Alvenia-Sonderbauarten / cells of Alvenia's special designs */
export function faithCells(): Cell[] {
  return [
    { name: 'faithHull:alvenia', w: 384, h: 62, design: [448, 72], paint: paintFaithHull },
    { name: 'faithDeck:alvenia', w: 160, h: 160, design: [192, 192], paint: paintFaithDeck },
    { name: 'shrine:alvenia', w: 384, h: 90, design: [448, 104], paint: paintShrine },
    { name: 'roof:alvenia', w: 192, h: 96, paint: paintRoof },
    { name: 'gable:alvenia', w: 96, h: 80, paint: paintGable },
    { name: 'glass:alvenia', w: 48, h: 80, paint: paintGlass },
    { name: 'rose:alvenia', w: 80, h: 80, paint: paintRose },
    { name: 'pane:alvenia', w: 128, h: 16, paint: paintPane },
    { name: 'skirt:alvenia', w: 256, h: 44, paint: paintSkirt },
    { name: 'lightGun:alvenia', w: 72, h: 168, design: [96, 224], paint: paintLightGun },
    { name: 'faithBox:alvenia', w: 96, h: 64, paint: paintFaithBox },
    { name: 'sunWheel:alvenia', w: 96, h: 96, paint: paintSunWheel },
    { name: 'dish:alvenia', w: 128, h: 128, paint: paintDish },
    { name: 'console:alvenia', w: 64, h: 40, paint: paintConsole },
    { name: 'sparkSide:alvenia', w: 384, h: 62, design: [448, 72], paint: paintSparkSide },
    { name: 'sparkDeck:alvenia', w: 216, h: 228, design: [288, 304], paint: paintSparkDeck },
    { name: 'sparkGlacis:alvenia', w: 280, h: 63, design: [320, 72], paint: paintSparkGlacis },
    { name: 'sparkRear:alvenia', w: 240, h: 30, design: [320, 40], paint: paintSparkRear },
    { name: 'sparkBay:alvenia', w: 384, h: 45, design: [448, 52], paint: paintSparkBay },
    { name: 'sparkTrack', w: 32, h: 168, design: [48, 256], paint: paintSparkTrack },
    { name: 'sparkBarrel:alvenia', w: 96, h: 216, design: [128, 288], paint: paintSparkBarrel },
    { name: 'faithPlate:alvenia', w: 128, h: 96, paint: paintFaithPlate },
    { name: 'cheek:alvenia', w: 128, h: 72, paint: paintCheek },
    { name: 'brake:alvenia', w: 64, h: 48, paint: paintBrake },
    { name: 'banner:alvenia', w: 64, h: 96, paint: paintBanner },
    { name: 'casemate:alvenia', w: 320, h: 54, design: [384, 64], paint: paintCasemate },
    { name: 'tower:alvenia', w: 256, h: 64, design: [320, 80], paint: paintTower },
  ];
}
