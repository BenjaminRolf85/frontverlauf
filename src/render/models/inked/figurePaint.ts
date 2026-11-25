/**
 * Gezeichnete Einheiten: Zeichnung der Figur / inked units: drawing of the figure.
 *
 * Jede Funktion bemalt einen Atlasbereich in dessen Entwurfsgroesse (Pixel des 1024er Figurenatlas). Alle Farben
 * kommen aus look.ts / den Tokens. Fraktionsfarben stehen NICHT in der Zeichnung (die Vertexfarbe liefert sie), mit
 * einer Ausnahme: der Helm ist ohnehin die Kopfbedeckung einer Fraktion, sein Abzeichen darf deren Farbe tragen.
 * Every function paints one atlas region at its design size (pixels of the 1024 figure atlas). All colours come from
 * look.ts / the tokens. Faction colours are NOT in the drawing (the vertex colour supplies them), with one exception:
 * the helmet is one faction's headgear anyway, so its badge may carry that faction's colour.
 */
import { mix, rng, shade } from '../kit';
import { look, mat, type Look } from '../look';
import { MUD as MUD_BASE } from '../detailVehicles';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { emblemCells, paintEmblem } from './emblem';
import { COAT, FACE, helmetRings, HEAD, RIFLE } from './figure';
import { ringT } from './uvkit';

// neutrale Stoffe / neutral materials
const LEATHER = mat.wood;
const LEATHER_DARK = shade(mat.wood, 0.55);
const BRASS = mix(mat.gold, mat.wood, 0.3);
const STEEL = mat.metalLight;
const HAIR = mix(mat.wood, mat.dark, 0.6);
const LACE = mix(mat.wood, mat.paper, 0.45);
/** Schlamm: nass dunkel, angetrocknet heller / mud: wet dark, dried lighter */
const MUD = shade(MUD_BASE, 0.75);
const MUD_LIGHT = shade(MUD_BASE, 0.5);

/** Messingknopf mit Tuscherand und Glanzpunkt / brass button with ink rim and highlight */
function button(p: Pen, x: number, y: number, r: number): void {
  p.spot(x, y, r, BRASS);
  p.line(arc(x, y, r, r, 0, Math.PI * 2, 12), Math.max(1, r * 0.42), { closed: true, wobble: 0, press: 0.2 });
  p.spot(x - r * 0.3, y - r * 0.32, r * 0.3, mat.white, 0.9);
}
/** Schnalle / buckle */
function buckle(p: Pen, x: number, y: number, w: number, h: number): void {
  p.fill(rrect(x - w / 2, y - h / 2, w, h, 2), STEEL);
  p.line(rrect(x - w / 2, y - h / 2, w, h, 2), 1.5, { closed: true, wobble: 0.1 });
  p.line(rrect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 1), 1.1, { closed: true, wobble: 0.1 });
  p.line([[x - w / 2 + 3, y], [x + w / 2 - 1, y]], 1.3, { taper: 0, wobble: 0 });
}

// ---------- Kopf / head ----------

/** Gesicht, Haar, Kinnriemen (Entwurf 640 x 288) / face, hair, chinstrap (design 640 x 288) */
export function paintHead(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const top = HEAD[0].y, bot = HEAD[HEAD.length - 1].y;
  const Y = (y: number) => ((top - y) / (top - bot)) * H;
  const ey = Y(FACE.eye), by = Y(FACE.brow), my = Y(FACE.mouth), ny = Y(FACE.nose);
  const ex = 43;
  // Schatten der Helmkrempe auf der Stirn / shadow of the helmet rim on the forehead
  p.gradient(0, 0, W, by + 4, [0, Y(FACE.rim) - 18], [0, by + 2], 0.62, 1);
  // Wangenroete, Schatten an Nase, Unterlippe und Kiefer / blush, shade at nose, lower lip and jaw
  for (const s of [-1, 1]) p.dab(cx + s * 64, ny - 2, 25, [1.02, 0.84, 0.8], 0.5);
  p.dab(cx, ny + 9, 15, 0.82, 0.55);
  p.dab(cx, my + 17, 13, 0.84, 0.6);
  p.gradient(0, Y(0.014), W, H - Y(0.014) + 3, [0, Y(0.014)], [0, H], 1, 0.66);
  // Bartschatten: flache Toenung, keine Stoppelpunkte / five o'clock shadow: a flat tint, no stubble dots
  const jaw: Pt[] = spline([[cx - 118, ey + 26], [cx - 104, my - 6], [cx - 74, my + 36], [cx - 30, H - 8], [cx, H - 4], [cx + 30, H - 8], [cx + 74, my + 36], [cx + 104, my - 6], [cx + 118, ey + 26],
    [cx + 84, my - 14], [cx + 44, my - 20], [cx + 26, ny + 14], [cx, ny + 16], [cx - 26, ny + 14], [cx - 44, my - 20], [cx - 84, my - 14]], 6, true);
  p.shade(jaw, [0.78, 0.8, 0.86], 0.5);
  // Haar: Koteletten und Nacken / hair: sideburns and nape
  for (const s of [-1, 1]) {
    const x0 = cx + s * 146;
    p.fill([[x0 - s * 4, 0], [x0 + s * 22, 0], [x0 + s * 24, ey + 4], [x0 + s * 17, ey + 34], [x0 + s * 9, ey + 44], [x0 + s * 2, ey + 12]], HAIR);
    p.line([[x0 + s * 6, ey - 20], [x0 + s * 8, ey + 38]], 1.3, { taper: 0.4 });
    p.line([[x0 + s * 15, ey - 26], [x0 + s * 15, ey + 30]], 1.2, { taper: 0.4 });
    // Nacken: gezackter Haaransatz / nape: jagged hairline
    const nape: Pt[] = [[cx + s * 186, 0]];
    const n = 9;
    for (let i = 0; i <= n; i++) nape.push([cx + s * (186 + (i / n) * 136), my - 8 + (i % 2 ? 14 : 0) + i * 1.5]);
    nape.push([cx + s * 322, 0]);
    p.fill(nape, HAIR);
    for (let i = 0; i < 7; i++) p.line([[cx + s * (196 + i * 19), ey - 30], [cx + s * (199 + i * 19), my + 2]], 1.2, { taper: 0.45, wobble: 0.8 });
  }
  // Augen / eyes
  for (const s of [-1, 1]) {
    const X = (u: number) => cx + s * (ex + u);
    const white = spline([[X(-18), ey + 2], [X(-9), ey - 7.5], [X(2), ey - 10], [X(13), ey - 7.5], [X(19), ey - 1], [X(11), ey + 8], [X(0), ey + 10], [X(-10), ey + 8]], 6, true);
    p.dab(X(0), ey - 1, 27, 0.86, 0.5);
    p.fill(white, mat.paper);
    // Schatten des Oberlids auf dem Augapfel / shadow of the upper lid on the eyeball
    p.fill(spline([[X(-18), ey + 2], [X(-9), ey - 7.5], [X(2), ey - 10], [X(13), ey - 7.5], [X(19), ey - 1], [X(12), ey - 3], [X(2), ey - 5.5], [X(-9), ey - 3]], 6, true), shade(mat.paper, 0.72), 0.9);
    // Iris als Tusche mit Glanzpunkt, Blick leicht zur Seite / iris as ink with a highlight, glance slightly sideways
    const ix = X(0) + 3.5, iy = ey - 0.5;
    p.dot(ix, iy, 8.4);
    p.erase(ix + 3, iy - 3.4, 2.7);
    p.spot(ix + 3, iy - 3.4, 3.4, mat.white);
    // Oberlid kraeftig mit Schwung, Unterlid und Lidfalte duenn / upper lid bold with a flick, lower lid and crease thin
    p.line(spline([[X(-19), ey + 3], [X(-10), ey - 8], [X(2), ey - 11], [X(13), ey - 8.5], [X(23), ey - 2]], 6), 4.8, { taper: 0.2, wobble: 0.2, press: 0.2 });
    p.line(spline([[X(17), ey + 3], [X(9), ey + 9.5], [X(-2), ey + 11]], 6), 1.5, { taper: 0.35, wobble: 0.2 });
    p.line(spline([[X(-13), ey - 14], [X(2), ey - 17.5], [X(16), ey - 13.5]], 6), 1.4, { taper: 0.4, wobble: 0.2 });
    // Braue: innen tief, entschlossen / brow: low on the inside, determined
    p.line(spline([[X(-24), by + 17], [X(-8), by + 7], [X(8), by + 4], [X(25), by + 8]], 6), 7.5, { taper: 0.28, wobble: 0.3, press: 0.25 });
    // Nasenfluegel und Falte zur Wange / wing of the nose and fold towards the cheek
    p.line(arc(cx + s * 16, ny + 4, 7, 8, s > 0 ? -1.2 : Math.PI + 1.2, s > 0 ? 1.4 : Math.PI - 1.4, 8), 1.7, { taper: 0.35 });
    p.line(spline([[cx + s * 25, ny + 6], [cx + s * 31, ny + 20], [cx + s * 33, my - 6]], 5), 1.3, { taper: 0.45 });
    // Kieferlinie / jaw line
    p.line(spline([[cx + s * 112, ey + 44], [cx + s * 96, my + 16], [cx + s * 62, H - 22]], 6), 1.5, { taper: 0.4 });
  }
  // Mund: feste Linie, Mundwinkel, Unterlippe, Kinn / mouth: firm line, corners, lower lip, chin
  p.shade(spline([[cx - 22, my + 1], [cx, my + 4], [cx + 22, my + 1], [cx + 12, my + 10], [cx - 12, my + 10]], 5, true), [1, 0.8, 0.76], 0.7);
  p.line(spline([[cx - 27, my - 2], [cx - 12, my + 2.5], [cx, my + 1.5], [cx + 13, my + 3], [cx + 28, my - 3]], 6), 3.2, { taper: 0.3, wobble: 0.25 });
  for (const s of [-1, 1]) p.line([[cx + s * 29, my - 5], [cx + s * 32, my + 3]], 1.7, { taper: 0.4 });
  p.line(spline([[cx - 11, my + 13], [cx, my + 15], [cx + 11, my + 13]], 5), 1.5, { taper: 0.4 });
  p.line(spline([[cx - 14, H - 26], [cx, H - 21], [cx + 14, H - 26]], 5), 1.4, { taper: 0.4 });
  // Kinnriemen von der Schlaefe unter das Kinn / chinstrap from the temple under the chin
  for (const s of [-1, 1]) {
    p.band(spline([[cx + s * 124, Y(FACE.rim) - 10], [cx + s * 113, ey + 30], [cx + s * 78, my + 32], [cx + s * 36, H - 9], [cx, H - 4]], 6), 9, LEATHER_DARK);
    buckle(p, cx + s * 116, ey + 12, 13, 12);
  }
}

/** Nase (Entwurf 56 x 44): s rundum, t vom Nasenruecken zur Spitze / nose (design 56 x 44): s around, t from bridge to tip */
export function paintNose(p: Pen): void {
  const W = p.w, H = p.h;
  p.gradient(0, H * 0.72, W, H * 0.3, [0, H * 0.72], [0, H], 1, 0.7);
  p.dab(W * 0.5, H * 0.66, 5, 1.3, 0.7);
  for (const s of [-1, 1]) p.line(arc(W / 2 + s * 13, H * 0.84, 4.5, 3.4, s > 0 ? -0.6 : Math.PI + 0.6, s > 0 ? 2 : Math.PI - 2, 6), 1.6, { taper: 0.3 });
  p.line([[W * 0.73, H * 0.28], [W * 0.75, H * 0.74]], 1.3, { taper: 0.45 });
}

/** Ohr (Entwurf 48 x 44) / ear (design 48 x 44) */
export function paintEar(p: Pen): void {
  const W = p.w, H = p.h;
  p.dab(W / 2, H * 0.5, 6, 0.74, 0.8);
  p.line(arc(W / 2 + 1, H * 0.5, 6.5, 13, -2.5, 2.5, 10), 1.6, { taper: 0.3 });
  p.line(arc(W / 2 - 1, H * 0.55, 3, 6, -1.6, 1.8, 6), 1.2, { taper: 0.4 });
}

/** Helm der Korvat (Entwurf 448 x 128) / Korvat helmet (design 448 x 128) */
export function paintHelmet(p: Pen, L: Look): void {
  const W = p.w, H = p.h;
  const T = ringT(helmetRings(L), true).map((t) => t * H);
  const bandTop = T[6], bandBot = T[8], edge = T[10];
  // Kuppel: Verlauf, Kratzer, abgeplatzter Lack, Nieten / dome: gradient, scratches, chipped paint, rivets
  p.gradient(0, 0, W, bandTop, [0, 0], [0, bandTop], 1.12, 0.92);
  p.scratches(0, 8, W, bandTop - 14, 18, 5, 24);
  p.chips(0, 10, W, bandTop - 18, 9, mat.metal, 9, 3.6);
  for (const s of [0.13, 0.37, 0.63, 0.87]) p.rivet(s * W, bandTop - 7, 3.2);
  // gezeichneter Glanz auf der Kuppel (statt eines berechneten, der ueber das Band wandert)
  // drawn shine on the dome (instead of a computed one that wanders across the band)
  p.fill(spline([[W * 0.33, bandTop - 14], [W * 0.345, bandTop - 30], [W * 0.38, bandTop - 40], [W * 0.372, bandTop - 26], [W * 0.352, bandTop - 13]], 5, true), mat.white, 0.5);
  p.fill(spline([[W * 0.395, bandTop - 43], [W * 0.412, bandTop - 46], [W * 0.408, bandTop - 40]], 4, true), mat.white, 0.5);
  // Band: Raender, Naht hinten / band: edges, seam at the back
  p.shade([[0, bandBot - 5], [W, bandBot - 5], [W, bandBot], [0, bandBot]], 0.78, 0.8);
  p.line([[-3, bandTop + 0.5], [W + 3, bandTop + 0.5]], 1.8, { taper: 0, wobble: 0.25 });
  p.line([[-3, bandBot - 0.5], [W + 3, bandBot - 0.5]], 1.8, { taper: 0, wobble: 0.25 });
  p.stitch([[0, bandTop + 5], [W, bandTop + 5]], 4, 3, 1, 1.35);
  // Zahnrad der Korvat vorn auf dem Band, in der Emblemfarbe der Fraktion / the Korvat cog at the front on the band, in the faction's emblem colour
  const cx = W / 2, cy = (bandTop + bandBot) / 2 - 4;
  p.dab(cx, cy, 21, 0.72, 0.7);
  paintEmblem(p, 'korvat', cx, cy, 17, L.emblem, 1.9);
  // Krempe: Rand abgestossen / rim: worn edge
  p.shade([[0, edge - 4], [W, edge - 4], [W, edge], [0, edge]], 1.3, 0.7);
  p.chips(0, edge - 5, W, 4, 22, mat.metal, 17, 2.6);
  p.scratches(0, bandBot + 2, W, edge - bandBot - 6, 10, 23, 14);
}

// ---------- Rumpf / torso ----------

/** Feldbluse mit Koppel und Rockschoss (Entwurf 448 x 208) / tunic with belt and skirt (design 448 x 208) */
export function paintTorso(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const Y = (y: number) => ((0.176 - y) / 0.232) * H;
  const beltTop = Y(0.0285), beltBot = Y(0.005), hem = Y(-0.024);
  // Knopfleiste und Knoepfe / button placket and buttons
  p.crease([[cx - 5, 12], [cx - 5, beltTop]], 2, 0.8, 0.8, { taper: 0.05 });
  p.line([[cx + 6, 10], [cx + 5, beltTop - 1]], 1.8, { taper: 0.08, wobble: 0.5 });
  p.line([[cx + 5, beltBot + 1], [cx + 7, hem - 1]], 1.6, { taper: 0.1, wobble: 0.4 });
  for (const y of [34, 59, 84, 109]) button(p, cx, y, 4.2);
  for (const s of [-1, 1]) {
    // Brusttasche: Klappe, Beutel, Falte, Naht / chest pocket: flap, bag, pleat, stitching
    const pc = cx + s * 38, x0 = pc - 17, x1 = pc + 17;
    const flap: Pt[] = [[x0 - 1, 41], [x1 + 1, 41], [x1 + 1, 51], [pc, 57], [x0 - 1, 51]];
    p.shade([[x0, 51], [x1, 51], [x1, 76], [x0, 76]], 0.93, 0.8);
    p.shade(flap, 0.84, 0.9);
    p.line([[x0, 51], [x0, 73], [x0 + 3, 76.5], [x1 - 3, 76.5], [x1, 73], [x1, 51]], 1.7, { taper: 0.05, wobble: 0.3 });
    p.line(flap, 1.9, { closed: true, wobble: 0.3 });
    p.crease([[pc, 58], [pc, 76]], 2, 0.76, 0.8, { taper: 0.1 });
    p.stitch([[x0 + 3, 59], [x0 + 3, 72], [x1 - 3, 72], [x1 - 3, 59]], 3.4, 2.6, 1, 0.62);
    button(p, pc, 51.5, 2.7);
    // Schulterklappe / shoulder strap
    const ep: Pt[] = [[cx + s * 24, 9], [cx + s * 72, 19], [cx + s * 72, 29], [cx + s * 24, 20]];
    p.shade(ep, 0.86, 0.9);
    p.line(ep, 1.6, { closed: true, wobble: 0.3 });
    button(p, cx + s * 31, 15.5, 2.5);
    // Tragriemen des Tornisters: Leder mit Naht und Ring / pack strap: leather with stitching and a ring
    const strap: Pt[] = [[cx + s * 58, 14], [cx + s * 60, 70], [cx + s * 56, beltTop]];
    p.band(strap, 8.5, LEATHER);
    p.stitch(strap.map((q): Pt => [q[0] + 2.2, q[1]]), 3, 2.6, 0.9, 0.6);
    buckle(p, cx + s * 59, 96, 12, 10);
    // Falten: von der Achsel zur Mitte, ueber dem Koppel / folds: from the armpit towards the centre, above the belt
    p.crease(spline([[cx + s * 92, 56], [cx + s * 80, 66], [cx + s * 66, 70]], 5), 3.5, 0.78, 0.7, { taper: 0.4 });
    p.line(spline([[cx + s * 94, 60], [cx + s * 82, 70], [cx + s * 70, 73]], 5), 1.6, { taper: 0.45 });
    p.line(spline([[cx + s * 98, 82], [cx + s * 84, 92], [cx + s * 72, 94]], 5), 1.4, { taper: 0.45 });
    p.line(spline([[cx + s * 22, 112], [cx + s * 25, 122], [cx + s * 23, beltTop - 1]], 4), 1.5, { taper: 0.45 });
    p.line(spline([[cx + s * 42, 108], [cx + s * 46, 120], [cx + s * 44, beltTop - 1]], 4), 1.3, { taper: 0.45 });
    p.crease([[cx + s * 33, 104], [cx + s * 35, beltTop]], 4, 0.82, 0.6, { taper: 0.4 });
    // Seitennaht / side seam
    p.line([[cx + s * 112, 62], [cx + s * 112, beltTop]], 1.1, { taper: 0.2, wobble: 0.4 });
    // Schosstasche / skirt pocket
    const sp = cx + s * 44;
    const sflap: Pt[] = [[sp - 16, beltBot + 5], [sp + 16, beltBot + 5], [sp + 16, beltBot + 13], [sp, beltBot + 16], [sp - 16, beltBot + 13]];
    p.shade(sflap, 0.85, 0.9);
    p.line(sflap, 1.6, { closed: true, wobble: 0.3 });
    button(p, sp, beltBot + 11.5, 2.2);
    // Koppelschlaufe / belt loop
    p.line(rrect(cx + s * 86 - 3.5, beltTop + 1.5, 7, beltBot - beltTop - 3, 1.5), 1.2, { closed: true, wobble: 0.1 });
  }
  // Ruecken: Mittelnaht und Passe / back: centre seam and yoke
  for (const x of [1.5, W - 1.5]) p.line([[x, 16], [x, beltTop]], 1.3, { taper: 0.1, wobble: 0.3 });
  for (const s of [-1, 1]) p.line(spline([[cx + s * 224, 44], [cx + s * 180, 42], [cx + s * 140, 50]], 5), 1.2, { taper: 0.3 });
  // Koppel: Naehte, Schloss, Loecher / belt: stitching, buckle, holes
  p.stitch([[0, beltTop + 3.4], [W, beltTop + 3.4]], 3.4, 2.8, 1, 1.5);
  p.stitch([[0, beltBot - 3.4], [W, beltBot - 3.4]], 3.4, 2.8, 1, 1.5);
  const bm = (beltTop + beltBot) / 2;
  p.fill(rrect(cx - 12, beltTop + 0.5, 24, beltBot - beltTop - 1, 2.5), BRASS);
  p.line(rrect(cx - 12, beltTop + 0.5, 24, beltBot - beltTop - 1, 2.5), 1.8, { closed: true, wobble: 0.15 });
  p.line(arc(cx, bm, 6, 6, 0, Math.PI * 2, 12), 1.3, { closed: true, wobble: 0 });
  p.spot(cx - 6, beltTop + 4, 2, mat.white, 0.85);
  for (const dx of [24, 33, 42]) p.dot(cx + dx, bm, 1.5);
  // Saum, Hosenschlitz, Schmutz / hem, fly, dirt
  p.crease([[0, hem - 3], [W, hem - 3]], 2.2, 0.78, 0.9, { taper: 0, wobble: 0.3 });
  p.stitch([[0, hem - 6.5], [W, hem - 6.5]], 3.2, 2.8, 0.9, 0.62);
  p.line([[cx + 2, hem + 3], [cx + 3, H - 12]], 1.4, { taper: 0.3 });
  p.splatter(0, hem - 22, W, H - hem + 20, 16, MUD_LIGHT, 71, { size: 3.6, alpha: 0.6 });
}

// ---------- Glieder / limbs ----------

/** Oberarm (Entwurf 176 x 104): s = 0.5 aussen, t Schulter -> Ellbogen / upper arm: s = 0.5 outside, t shoulder -> elbow */
export function paintUpperArm(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  // Aermelnaht an der Schulter / sleeve seam at the shoulder
  p.line(spline([[0, 20], [cx - 40, 15], [cx, 13], [cx + 40, 15], [W, 20]], 6), 1.5, { taper: 0.05, wobble: 0.3 });
  p.stitch([[6, 24], [cx, 18.5], [W - 6, 24]], 3.2, 2.6, 0.9, 0.62);
  // Winkel am Oberarm / chevrons on the upper arm
  for (const y of [40, 52]) {
    const v: Pt[] = [[cx - 15, y], [cx, y + 10], [cx + 15, y], [cx + 15, y + 6], [cx, y + 16], [cx - 15, y + 6]];
    p.fill(v, mat.paper);
    p.line(v, 1.5, { closed: true, wobble: 0.15 });
  }
  // Falten am Ellbogen / folds at the elbow
  p.line(spline([[cx - 46, 84], [cx - 20, 79], [cx + 8, 83]], 5), 1.7, { taper: 0.4 });
  p.line(spline([[cx - 10, 92], [cx + 18, 88], [cx + 42, 93]], 5), 1.4, { taper: 0.4 });
  p.crease(spline([[cx - 50, 88], [cx - 20, 84], [cx + 10, 88]], 5), 4, 0.8, 0.7, { taper: 0.4 });
  p.line([[1.5, 22], [1.5, H]], 1.1, { taper: 0.2, wobble: 0.3 });
}

/** Unterarm (Entwurf 160 x 100): t Ellbogen -> Aermelbund / forearm: t elbow -> cuff */
export function paintForeArm(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.dab(cx, 16, 20, 0.84, 0.6);
  p.line(spline([[cx - 40, 14], [cx - 14, 20], [cx + 14, 16]], 5), 1.7, { taper: 0.4 });
  p.line(spline([[cx - 8, 28], [cx + 20, 33], [cx + 44, 28]], 5), 1.4, { taper: 0.4 });
  p.line(spline([[cx - 52, 34], [cx - 30, 41], [cx - 8, 38]], 5), 1.3, { taper: 0.4 });
  // Aermelbund: Naht und Knopf / cuff: stitching and button
  p.stitch([[0, 86], [W, 86]], 3.2, 2.6, 0.9, 0.62);
  button(p, cx + 6, 92, 2.6);
  p.line([[cx - 4, 82], [cx - 4, H]], 1.2, { taper: 0.1 });
  p.splatter(0, 60, W, 40, 6, MUD_LIGHT, 13, { size: 3, alpha: 0.5 });
}

/** Faust (Entwurf 112 x 70): s = 0.5 Handruecken, t Handgelenk -> Finger / fist: s = 0.5 back of the hand, t wrist -> fingers */
export function paintHand(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.line(spline([[cx - 30, 13], [cx, 11], [cx + 30, 13]], 4), 1.2, { taper: 0.35 });
  // Knoechel und Fingerfugen / knuckles and finger gaps
  for (const dx of [-21, -7, 7, 21]) {
    p.line(arc(cx + dx, 44, 6, 4, Math.PI * 1.1, Math.PI * 1.9, 6), 1.3, { taper: 0.3 });
    p.dab(cx + dx, 43, 5, 1.12, 0.6);
  }
  for (const dx of [-14, 0, 14]) {
    p.crease([[cx + dx, 46], [cx + dx, H]], 3, 0.78, 0.7, { taper: 0.2 });
    p.line([[cx + dx, 47], [cx + dx + 0.5, H + 2]], 1.6, { taper: 0.25, wobble: 0.2 });
  }
  // Fingerkuppen an der Innenseite / finger tips on the palm side
  for (const x of [8, 20, W - 20, W - 8]) p.line([[x, 40], [x, H]], 1.3, { taper: 0.3 });
}

/** Oberschenkel (Entwurf 240 x 150): s = 0.5 vorn, 0.75 aussen / thigh: s = 0.5 front, 0.75 outside */
export function paintThigh(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, ox = W * 0.75;
  // Buegelfalte, Aussennaht / front crease, outer seam
  p.crease([[cx, 22], [cx + 1, H]], 2.4, 0.82, 0.7, { taper: 0.1, wobble: 0.4 });
  p.line([[ox + 30, 16], [ox + 31, H]], 1.3, { taper: 0.1, wobble: 0.4 });
  p.stitch([[ox + 34.5, 20], [ox + 35.5, H]], 3.2, 2.6, 0.9, 0.62);
  // Beintasche aussen / cargo pocket on the outside
  const x0 = ox - 26, x1 = ox + 22;
  const flap: Pt[] = [[x0 - 2, 55], [x1 + 2, 55], [x1 + 2, 68], [ox - 2, 72], [x0 - 2, 68]];
  p.shade([[x0, 68], [x1, 68], [x1, 110], [x0, 110]], 0.92, 0.8);
  p.shade(flap, 0.83, 0.9);
  p.line([[x0, 68], [x0, 106], [x0 + 4, 110.5], [x1 - 4, 110.5], [x1, 106], [x1, 68]], 1.8, { taper: 0.05, wobble: 0.3 });
  p.line(flap, 2, { closed: true, wobble: 0.3 });
  p.crease([[ox - 2, 73], [ox - 2, 110]], 2.2, 0.76, 0.8, { taper: 0.1 });
  p.stitch([[x0 + 3.5, 74], [x0 + 3.5, 106], [x1 - 3.5, 106], [x1 - 3.5, 74]], 3.4, 2.6, 1, 0.62);
  button(p, ox - 2, 66, 2.8);
  // Falten in der Leiste und ueber dem Knie / folds at the groin and above the knee
  p.line(spline([[cx - 50, 18], [cx - 26, 27], [cx - 4, 26]], 5), 1.7, { taper: 0.4 });
  p.line(spline([[cx - 54, 32], [cx - 32, 42], [cx - 12, 40]], 5), 1.4, { taper: 0.4 });
  p.crease(spline([[cx - 56, 24], [cx - 28, 33], [cx - 2, 31]], 5), 4, 0.8, 0.7, { taper: 0.4 });
  p.line(spline([[cx - 34, 128], [cx - 6, 122], [cx + 22, 127]], 5), 1.5, { taper: 0.4 });
  p.line(spline([[cx - 12, 139], [cx + 12, 134], [cx + 34, 138]], 5), 1.3, { taper: 0.4 });
  for (const x of [14, W - 14]) p.line(spline([[x - 10, 124], [x, 131], [x + 10, 125]], 4), 1.3, { taper: 0.4 });
  p.dab(cx, 142, 18, 1.14, 0.5);
  p.splatter(0, 70, W, 80, 8, MUD_LIGHT, 19, { size: 3.2, alpha: 0.5 });
}

/** Unterschenkel mit Stiefelschaft (Entwurf 208 x 130) / shin with boot shaft (design 208 x 130) */
export function paintShin(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const bootTop = 82;
  // Knieflicken: Rand, Steppnaht / knee patch: edge, quilting
  const patch = rrect(cx - 27, 10, 54, 36, 9);
  p.shade(patch, 0.86, 0.9);
  p.line(patch, 1.9, { closed: true, wobble: 0.3 });
  p.stitch(rrect(cx - 23, 14, 46, 28, 6).concat([[cx + 17, 14]]), 3.2, 2.6, 1, 0.6);
  for (const y of [22, 33]) p.crease([[cx - 20, y], [cx + 20, y]], 1.4, 0.76, 0.8, { taper: 0.15 });
  p.line(spline([[cx - 46, 50], [cx - 24, 55], [cx - 2, 51]], 5), 1.4, { taper: 0.4 });
  // Hose in den Stiefel gestopft: kurze Falten ueber dem Schaft / trousers tucked into the boot: short folds above the shaft
  const R = rng(5);
  for (let x = 6; x < W; x += 13) {
    const j = (R() - 0.5) * 5, top = 58 + R() * 8;
    p.line(spline([[x + j - 2, top], [x + j + 1, top + 10], [x + j, bootTop - 2]], 4), 1.2 + R() * 0.8, { taper: 0.45, wobble: 0.3 });
    p.crease([[x + j + 4, top + 4], [x + j + 4, bootTop - 1]], 3, 0.8, 0.6, { taper: 0.4 });
  }
  p.gradient(0, bootTop - 12, W, 12, [0, bootTop - 12], [0, bootTop], 1, 0.74);
  // Stiefelschaft: heller Rand, Riemen mit Schnalle, Schnuerung, Glanz / boot shaft: light edge, strap with buckle, lacing, shine
  p.crease([[0, bootTop + 2.5], [W, bootTop + 2.5]], 2.2, 2, 0.9, { taper: 0, wobble: 0.2 });
  p.shade([[0, 90], [W, 90], [W, 97], [0, 97]], 1.7, 0.85);
  buckle(p, W * 0.75, 93.5, 13, 10);
  for (let y = 100; y < H - 4; y += 7) {
    p.mark([[cx - 9, y], [cx + 9, y + 6]], 1.6, LACE, 0.95, { taper: 0, wobble: 0 });
    p.mark([[cx + 9, y], [cx - 9, y + 6]], 1.6, LACE, 0.95, { taper: 0, wobble: 0 });
    for (const s of [-1, 1]) p.spot(cx + s * 10, y, 1.6, STEEL);
  }
  p.crease([[W * 0.62, bootTop + 6], [W * 0.63, H]], 6, 1.9, 0.5, { taper: 0.2 });
  // Schlamm, nach unten dichter / mud, denser towards the bottom
  p.splatter(0, 56, W, H - 52, 34, MUD, 29, { size: 5, rise: 1.7, alpha: 0.9 });
  p.splatter(0, 96, W, H - 92, 16, MUD_LIGHT, 31, { size: 4, rise: 1.4, alpha: 0.8 });
}

/** Stiefel (Entwurf 144 x 130): s = 0.5 oben, t Ferse -> Spitze / boot: s = 0.5 top, t heel -> toe */
export function paintBoot(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  // Kappennaht, Rahmennaht, Fersennaht (hell auf dunklem Leder) / toe cap seam, welt, heel seam (light on dark leather)
  p.crease(spline([[26, 90], [cx, 96], [W - 26, 90]], 6), 2, 2.1, 0.85, { taper: 0.1 });
  for (const x of [15, W - 15]) p.crease([[x, 6], [x, H - 8]], 1.8, 1.9, 0.8, { taper: 0.1, wobble: 0.3 });
  p.crease(spline([[30, 22], [cx, 16], [W - 30, 22]], 5), 1.6, 1.8, 0.7, { taper: 0.2 });
  // Schnuerung auf dem Rist / lacing on the instep
  for (let y = 30; y < 86; y += 8) {
    p.mark([[cx - 10, y], [cx + 10, y + 7]], 1.7, LACE, 0.95, { taper: 0, wobble: 0 });
    p.mark([[cx + 10, y], [cx - 10, y + 7]], 1.7, LACE, 0.95, { taper: 0, wobble: 0 });
    for (const s of [-1, 1]) p.spot(cx + s * 11, y, 1.7, STEEL);
  }
  // Glanz auf der Kappe / shine on the toe cap
  p.fill(spline([[cx - 20, 104], [cx - 8, 100], [cx + 6, 103], [cx - 6, 108]], 5, true), mat.white, 0.34);
  p.splatter(0, 0, 30, H, 14, MUD, 37, { size: 5, alpha: 0.9, rise: 1 });
  p.splatter(W - 30, 0, 30, H, 14, MUD, 43, { size: 5, alpha: 0.9, rise: 1 });
  p.splatter(20, 96, W - 40, 30, 8, MUD_LIGHT, 47, { size: 4, alpha: 0.8, rise: 1 });
}

// ---------- Ausruestung / equipment ----------

/** Tornister hinten (Entwurf 160 x 136) / pack back face (design 160 x 136) */
export function paintPackBack(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(5, 5, W - 10, H - 10, 9), 1.4, { closed: true, wobble: 0.3 });
  // Deckel mit geschwungener Kante und Schatten darunter / flap with a curved edge and shade below
  const edge = spline([[4, 55], [40, 65], [80, 68], [120, 65], [W - 4, 55]], 6);
  p.shade([...edge, [W - 4, 78], [4, 78]], 0.82, 0.55);
  p.shade([[4, 4], [W - 4, 4], ...edge.slice().reverse()], 1.08, 0.6);
  p.line(edge, 2.2, { taper: 0.05, wobble: 0.3 });
  p.stitch(edge.map((q): Pt => [q[0], q[1] - 5]), 3.6, 2.8, 1, 0.6);
  // Namensschild / name tag
  p.shade(rrect(62, 20, 36, 13, 2), 1.35, 0.9);
  p.line(rrect(62, 20, 36, 13, 2), 1.1, { closed: true, wobble: 0.2 });
  for (const y of [25, 29]) p.crease([[67, y], [93, y]], 1, 0.6, 0.8, { taper: 0.1 });
  // zwei Riemen mit Schnallen / two straps with buckles
  for (const x of [46, 114]) {
    p.band([[x, 0], [x, 86], [x, 100]], 12, LEATHER);
    p.stitch([[x - 3.5, 2], [x - 3.5, 96]], 3, 2.6, 0.9, 0.6);
    p.fill([[x - 6, 98], [x + 6, 98], [x, 108]], LEATHER);
    p.line([[x - 6, 98], [x, 108], [x + 6, 98]], 1.3, { taper: 0.05, wobble: 0.1 });
    buckle(p, x, 80, 18, 13);
    for (const y of [90, 95]) p.dot(x, y, 1.1);
  }
  p.line(spline([[18, 100], [26, 112], [22, 124]], 4), 1.4, { taper: 0.4 });
  p.line(spline([[W - 20, 96], [W - 28, 110], [W - 22, 122]], 4), 1.4, { taper: 0.4 });
  p.splatter(0, 70, W, H - 70, 18, MUD_LIGHT, 53, { size: 4.5, alpha: 0.7 });
}

/** Tornister Seite (Entwurf 72 x 136) / pack side (design 72 x 136) */
export function paintPackSide(p: Pen): void {
  const W = p.w, H = p.h;
  p.band([[0, 30], [W, 30]], 8, LEATHER);
  const flap: Pt[] = [[9, 48], [W - 9, 48], [W - 9, 62], [W / 2, 67], [9, 62]];
  p.shade([[11, 62], [W - 11, 62], [W - 11, 118], [11, 118]], 0.9, 0.8);
  p.shade(flap, 0.8, 0.9);
  p.line([[11, 62], [11, 114], [15, 118.5], [W - 15, 118.5], [W - 11, 114], [W - 11, 62]], 1.7, { taper: 0.05, wobble: 0.3 });
  p.line(flap, 1.9, { closed: true, wobble: 0.3 });
  button(p, W / 2, 61, 2.8);
  p.splatter(0, 80, W, H - 80, 7, MUD_LIGHT, 59, { size: 4, alpha: 0.7 });
}

/** Tornister oben (Entwurf 160 x 72) / pack top (design 160 x 72) */
export function paintPackTop(p: Pen): void {
  const W = p.w, H = p.h;
  p.line([[4, H / 2], [W - 4, H / 2]], 1.2, { taper: 0.1, wobble: 0.4 });
  for (const x of [46, 114]) p.band([[x, -2], [x, H + 2]], 12, LEATHER);
}

/** Deckenrolle (Entwurf 160 x 96): s rundum, t entlang der Rolle / bedroll: s around, t along the roll */
export function paintBedroll(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [9, H - 9]) p.shade([[0, y - 3.5], [W, y - 3.5], [W, y + 3.5], [0, y + 3.5]], 0.7, 0.8);
  const R = rng(61);
  for (let x = 10; x < W; x += 21) p.line(spline([[x + R() * 4, 16], [x + 3, H / 2], [x + R() * 4, H - 16]], 4), 1.2, { taper: 0.4, wobble: 0.8 });
  for (const y of [25, H - 25]) {
    p.band([[-2, y], [W + 2, y]], 9.5, LEATHER);
    buckle(p, W * 0.25, y, 15, 12);
  }
}

/** Stirnseite der Rolle: Spirale (Entwurf 48 x 48) / end of the roll: spiral (design 48 x 48) */
export function paintRollEnd(p: Pen): void {
  const c = p.w / 2;
  p.dab(c, c, 9, 0.7, 0.8);
  const sp: Pt[] = [];
  for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 5.5, r = 2 + (i / 60) * 18; sp.push([c + Math.cos(a) * r, c + Math.sin(a) * r]); }
  p.line(sp, 1.7, { taper: 0.1, wobble: 0.3 });
}

/** Feldflasche (Entwurf 64 x 80) / canteen (design 64 x 80) */
export function paintCanteen(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill([[0, 0], [W, 0], [W, 13], [0, 13]], STEEL);
  p.line([[-2, 14], [W + 2, 14]], 1.4, { taper: 0, wobble: 0.1 });
  p.line([[W / 2, 18], [W / 2 + 1, H - 6]], 1.3, { taper: 0.15, wobble: 0.3 });
  p.stitch([[W / 2 + 3.5, 20], [W / 2 + 4, H - 8]], 3, 2.6, 0.9, 0.6);
  p.band([[-2, 42], [W + 2, 42]], 7.5, LEATHER);
}

/** Koppeltasche (Entwurf 64 x 64) / belt pouch (design 64 x 64) */
export function paintPouch(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(3, 3, W - 6, H - 6, 7), 1.7, { closed: true, wobble: 0.3 });
  const edge = spline([[3, 30], [W / 2, 40], [W - 3, 30]], 6);
  p.shade([[3, 3], [W - 3, 3], ...edge.slice().reverse()], 1.15, 0.7);
  p.shade([...edge, [W - 3, 46], [3, 46]], 0.8, 0.5);
  p.line(edge, 2.1, { taper: 0.05, wobble: 0.3 });
  p.stitch(edge.map((q): Pt => [q[0], q[1] - 4.5]), 3.2, 2.6, 0.9, 0.6);
  button(p, W / 2, 32, 3.8);
}

/** Schaerpe / Riemen (Entwurf 256 x 24): s entlang, t quer / sash / strap: s along, t across */
export function paintStrap(p: Pen): void {
  const W = p.w, H = p.h;
  p.stitch([[0, 4], [W, 4]], 3.4, 2.8, 1, 0.62);
  p.stitch([[0, H - 4], [W, H - 4]], 3.4, 2.8, 1, 0.62);
  p.fill(rrect(96, 2, 20, H - 4, 2), BRASS);
  p.line(rrect(96, 2, 20, H - 4, 2), 1.6, { closed: true, wobble: 0.1 });
  p.line([[106, 3], [106, H - 3]], 1.4, { taper: 0, wobble: 0 });
}

/** Gewehr in der Seitenansicht (Entwurf 512 x 96), Muendung links / rifle in side view (design 512 x 96), muzzle left */
export function paintRifle(p: Pen): void {
  const W = p.w, H = p.h;
  const X = (z: number) => ((RIFLE.z1 - z) / (RIFLE.z1 - RIFLE.z0)) * W;
  const Y = (y: number) => ((RIFLE.y1 - y) / (RIFLE.y1 - RIFLE.y0)) * H;
  const R = rng(67);
  // Holz: Maserung auf Kolben und Vorderschaft / wood: grain on stock and forend
  const grain = (x0: number, x1: number, y0: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const y = y0 + ((i + 0.5) / n) * (y1 - y0) + (R() - 0.5) * 3, a = x0 + R() * (x1 - x0) * 0.3, b = x1 - R() * (x1 - x0) * 0.3;
      p.crease(spline([[a, y], [(a + b) / 2, y + (R() - 0.5) * 5], [b, y + (R() - 0.5) * 3]], 5), 1.6, 0.68, 0.75, { taper: 0.3, wobble: 0.5 });
      if (i % 2 === 0) p.line(spline([[a + 8, y + 2], [(a + b) / 2, y + 2 + (R() - 0.5) * 4], [b - 8, y + 2]], 5), 0.95, { taper: 0.45, wobble: 0.5 });
    }
  };
  grain(X(0.004), X(-0.106), Y(0.016), Y(-0.034), 7);
  grain(X(0.2185), X(0.1135), Y(0.0125), Y(-0.0145), 4);
  p.crease([[X(0.0), Y(0.013)], [X(-0.1), Y(0.005)]], 2.4, 1.5, 0.6, { taper: 0.2 });
  // Kolbenkappe, Riemenbuegel, Schaftbaender / butt plate, sling swivel, barrel bands
  p.fill([[X(-0.1) , 0], [W, 0], [W, H], [X(-0.1), H]], mat.metal);
  p.line([[X(-0.1), Y(0.012)], [X(-0.1), Y(-0.036)]], 1.4, { taper: 0, wobble: 0.1 });
  p.line(arc(X(-0.07), Y(-0.03), 4.5, 4.5, 0, Math.PI * 2, 10), 1.3, { closed: true, wobble: 0 });
  for (const z of [0.125, 0.205]) {
    p.fill([[X(z) - 3.5, Y(0.02)], [X(z) + 3.5, Y(0.02)], [X(z) + 3.5, Y(-0.02)], [X(z) - 3.5, Y(-0.02)]], mat.metal);
    for (const d of [-3.5, 3.5]) p.line([[X(z) + d, Y(0.016)], [X(z) + d, Y(-0.016)]], 1.2, { taper: 0, wobble: 0.1 });
  }
  p.shade(spline([[X(0.2), Y(-0.004)], [X(0.165), Y(-0.008)], [X(0.13), Y(-0.004)], [X(0.165), Y(-0.001)]], 5, true), 0.7, 0.8);
  // Gehaeuse: Auswurf, Kammerstaengel, Schrauben (hell auf dunklem Stahl) / receiver: ejection port, bolt handle, screws (light on dark steel)
  p.shade(rrect(X(0.085), Y(0.014), X(0.045) - X(0.085), Y(0.002) - Y(0.014), 2), 0.5, 0.9);
  p.crease(rrect(X(0.085), Y(0.014), X(0.045) - X(0.085), Y(0.002) - Y(0.014), 2).concat([[X(0.085) + 2, Y(0.014)]]), 1.3, 2, 0.8, { taper: 0, wobble: 0.1 });
  p.spot(X(0.036), Y(0.006), 4, STEEL);
  p.spot(X(0.036) - 1.2, Y(0.006) - 1.4, 1.4, mat.white, 0.9);
  for (const z of [0.012, 0.1]) { p.dab(X(z), Y(-0.004), 2.2, 2, 0.8); p.crease([[X(z) - 1.6, Y(-0.004)], [X(z) + 1.6, Y(-0.004)]], 0.8, 0.5, 1, { taper: 0, wobble: 0 }); }
  p.crease([[X(0.112), Y(0.0165)], [X(0.002), Y(0.0165)]], 1.6, 2.2, 0.7, { taper: 0.1 });
  for (const y of [-0.03, -0.04, -0.05]) p.crease([[X(0.08), Y(y) + 3], [X(0.06), Y(y)]], 1.3, 1.9, 0.7, { taper: 0.1 });
  // Lauf: Glanzlinie, Ringe; Bajonett: Hohlkehle und helle Schneide / barrel: shine, rings; bayonet: fuller and bright edge
  p.crease([[X(0.3), Y(0.0105)], [X(0.215), Y(0.0108)]], 1.5, 1.7, 0.8, { taper: 0.1 });
  for (const z of [0.24, 0.27]) p.line([[X(z), Y(0.014)], [X(z), Y(-0.002)]], 1.1, { taper: 0, wobble: 0 });
  p.crease([[X(0.385), Y(-0.006)], [X(0.31), Y(-0.005)]], 1.8, 0.62, 0.8, { taper: 0.2 });
  p.mark([[X(0.388), Y(-0.011)], [X(0.305), Y(-0.0125)]], 1.2, mat.white, 0.8, { taper: 0.2, wobble: 0 });
  p.scratches(X(0.11), Y(0.018), X(0.0) - X(0.11), Y(-0.012) - Y(0.018), 6, 73, 12);
}

/** Mantel (Entwurf 448 x 260): Revers, zwei Knopfreihen, Guertel, Taschen, Saum / coat (design 448 x 260): lapels, two button rows, belt, pockets, hem */
export function paintCoat(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const Y = (y: number) => ((COAT.top - y) / (COAT.top - COAT.hem)) * H;
  const beltTop = Y(0.049), beltBot = Y(0.03);
  for (const s of [-1, 1]) {
    // Revers / lapel
    const lapel: Pt[] = [[cx + s * 22, 6], [cx + s * 46, 30], [cx + s * 26, 46], [cx + s * 4, beltTop - 30]];
    p.shade(lapel, 0.82, 0.9);
    p.line(lapel, 2, { closed: true, wobble: 0.3 });
    for (const y of [beltTop - 18, beltBot + 22, beltBot + 52]) { p.dot(cx + s * 17, y, 3.6); p.spot(cx + s * 17 - 1, y - 1.2, 1.2, mat.white, 0.7); }
    // Taschenklappe, Schulterklappe, Falten / pocket flap, shoulder strap, folds
    const fx0 = cx + s * 56;
    const flap: Pt[] = [[fx0 - 22, beltBot + 26], [fx0 + 22, beltBot + 24], [fx0 + 22, beltBot + 38], [fx0 - 22, beltBot + 40]];
    p.shade(flap, 0.84, 0.9);
    p.line(flap, 1.8, { closed: true, wobble: 0.3 });
    const ep: Pt[] = [[cx + s * 24, 9], [cx + s * 72, 19], [cx + s * 72, 29], [cx + s * 24, 20]];
    p.shade(ep, 0.84, 0.9);
    p.line(ep, 1.6, { closed: true, wobble: 0.3 });
    p.line(spline([[cx + s * 96, 56], [cx + s * 84, 68], [cx + s * 70, 72]], 5), 1.6, { taper: 0.45 });
    p.line(spline([[cx + s * 40, beltBot + 70], [cx + s * 44, beltBot + 100], [cx + s * 40, H - 14]], 5), 1.5, { taper: 0.4 });
    p.crease(spline([[cx + s * 78, beltBot + 50], [cx + s * 84, beltBot + 90], [cx + s * 80, H - 10]], 5), 5, 0.8, 0.6, { taper: 0.3 });
    p.line([[cx + s * 112, 62], [cx + s * 113, H - 8]], 1.1, { taper: 0.2, wobble: 0.4 });
    p.line(rrect(cx + s * 86 - 3.5, beltTop + 1.5, 7, beltBot - beltTop - 3, 1.5), 1.2, { closed: true, wobble: 0.1 });
  }
  // Uebertritt, Guertel mit Schnalle, Saum, Rueckenschlitz / overlap, belt with buckle, hem, back vent
  p.line(spline([[cx + 4, beltTop - 30], [cx + 10, beltBot + 60], [cx + 8, H - 6]], 6), 1.9, { taper: 0.08, wobble: 0.4 });
  p.stitch([[0, beltTop + 3.4], [W, beltTop + 3.4]], 3.4, 2.8, 1, 1.5);
  p.stitch([[0, beltBot - 3.4], [W, beltBot - 3.4]], 3.4, 2.8, 1, 1.5);
  buckle(p, cx, (beltTop + beltBot) / 2, 24, beltBot - beltTop - 2);
  p.crease([[0, H - 9], [W, H - 9]], 2.2, 0.78, 0.9, { taper: 0, wobble: 0.3 });
  p.stitch([[0, H - 13], [W, H - 13]], 3.2, 2.8, 0.9, 0.62);
  for (const x of [1.5, W - 1.5]) p.line([[x, 16], [x, H - 4]], 1.3, { taper: 0.1, wobble: 0.3 });
  p.splatter(0, H - 60, W, 60, 14, MUD_LIGHT, 83, { size: 3.6, alpha: 0.6 });
}

/** Sturmhaube der Dravon (Entwurf 448 x 200): Strick, Augenausschnitt mit Augen, Abzeichen an der Seite / Dravon balaclava (design 448 x 200): knit, eye opening with eyes, badge on the side */
export function paintHeadDravon(p: Pen, L: Look): void {
  const W = p.w, H = p.h, cx = W / 2;
  const top = HEAD[0].y, bot = HEAD[HEAD.length - 1].y;
  const Y = (y: number) => ((top - y) / (top - bot)) * H;
  const ey = Y(FACE.eye), ex = 30;
  for (let y = 3; y < H; y += 4.5) p.crease([[0, y], [W, y]], 1.2, 1.7, 0.5, { taper: 0, wobble: 0.3 });
  // Augenausschnitt in Hautfarbe / eye opening in skin colour
  const hole = spline([[cx - 62, ey - 2], [cx - 40, ey - 15], [cx, ey - 11], [cx + 40, ey - 15], [cx + 62, ey - 2], [cx + 42, ey + 12], [cx, ey + 9], [cx - 42, ey + 12]], 6, true);
  p.fill(hole, mat.skin);
  p.line(hole, 2.2, { closed: true, wobble: 0.3 });
  for (const s of [-1, 1]) {
    const X = (u: number) => cx + s * (ex + u);
    p.fill(spline([[X(-13), ey + 1], [X(-6), ey - 6], [X(2), ey - 7.5], [X(10), ey - 5], [X(14), ey], [X(8), ey + 6], [X(0), ey + 7], [X(-8), ey + 6]], 5, true), mat.paper);
    p.dot(X(0) + 2.5, ey, 5.8);
    p.erase(X(0) + 4.5, ey - 2.4, 1.9);
    p.spot(X(0) + 4.5, ey - 2.4, 2.3, mat.white);
    p.line(spline([[X(-14), ey + 2], [X(-6), ey - 6.5], [X(2), ey - 8.5], [X(10), ey - 6], [X(17), ey - 1]], 5), 3.4, { taper: 0.2, wobble: 0.2 });
    p.line(spline([[X(-17), ey - 8], [X(-4), ey - 13.5], [X(16), ey - 11]], 5), 4.6, { taper: 0.28, wobble: 0.2 });
  }
  // Mundoeffnung, Naht, Faustabzeichen in der Zweitfarbe / mouth opening, seam, fist badge in the secondary colour
  p.blot(spline([[cx - 15, Y(FACE.mouth)], [cx, Y(FACE.mouth) - 3], [cx + 15, Y(FACE.mouth)], [cx, Y(FACE.mouth) + 4]], 5, true));
  for (const x of [1.5, W - 1.5]) p.line([[x, 10], [x, H - 6]], 1.2, { taper: 0.1, wobble: 0.3 });
  const bx = W * 0.25, by = ey - 2;
  p.fill(arc(bx, by, 15, 15, 0, Math.PI * 2, 20), L.secondary);
  p.line(arc(bx, by, 15, 15, 0, Math.PI * 2, 20), 1.8, { closed: true, wobble: 0.15 });
  paintEmblem(p, 'dravon', bx, by, 10, L.helmet, 0);
}

/** Zellen des Figurenatlas / cells of the figure atlas */
export function figureCells(): Cell[] {
  return [
    { name: 'head', w: 640, h: 288, paint: paintHead },
    { name: 'head:dravon', w: 320, h: 144, design: [448, 200], paint: (p) => paintHeadDravon(p, look('dravon')) },
    { name: 'nose', w: 56, h: 44, paint: paintNose },
    { name: 'ear', w: 48, h: 44, paint: paintEar },
    { name: 'helmet:korvat', w: 448, h: 128, paint: (p) => paintHelmet(p, look('korvat')) },
    { name: 'torso', w: 448, h: 208, paint: paintTorso },
    { name: 'coat', w: 384, h: 224, design: [448, 260], paint: paintCoat },
    { name: 'upperArm', w: 176, h: 104, paint: paintUpperArm },
    { name: 'foreArm', w: 160, h: 100, paint: paintForeArm },
    { name: 'hand', w: 112, h: 70, paint: paintHand },
    { name: 'thigh', w: 240, h: 150, paint: paintThigh },
    { name: 'shin', w: 208, h: 130, paint: paintShin },
    { name: 'boot', w: 144, h: 130, paint: paintBoot },
    { name: 'packBack', w: 160, h: 136, paint: paintPackBack },
    { name: 'packSide', w: 72, h: 136, paint: paintPackSide },
    { name: 'packTop', w: 160, h: 72, paint: paintPackTop },
    { name: 'bedroll', w: 160, h: 96, paint: paintBedroll },
    { name: 'rollEnd', w: 48, h: 48, paint: paintRollEnd },
    { name: 'canteen', w: 64, h: 80, paint: paintCanteen },
    { name: 'pouch', w: 64, h: 64, paint: paintPouch },
    { name: 'strap', w: 256, h: 24, paint: paintStrap },
    { name: 'rifle', w: 512, h: 96, paint: paintRifle },
    ...emblemCells(48),
  ];
}

/**
 * Zellen der Figur fuer Besatzungen in einem anderen Atlas, um k verkleinert (Standard 0.5). Die Namen bleiben gleich,
 * figure() findet sie also auch im Fahrzeugatlas.
 * The figure's cells for crews inside another atlas, shrunk by k (default 0.5). The names stay the same, so figure()
 * finds them in the vehicle atlas too.
 */
export function crewCells(k = 0.5): Cell[] {
  const keep = new Set(['head', 'head:dravon', 'nose', 'ear', 'helmet:korvat', 'torso', 'upperArm', 'foreArm', 'hand', 'strap', 'pouch']);
  return figureCells().filter((c) => keep.has(c.name)).map((c): Cell => ({ ...c, design: c.design ?? [c.w, c.h], w: Math.max(16, Math.round(c.w * k)), h: Math.max(12, Math.round(c.h * k)) }));
}
