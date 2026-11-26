/**
 * Gezeichnete Figur: Zeichnung der Kopfbedeckungen und Koepfe (Formen in heads.ts).
 * Inked figure: drawing of the headgear and heads (shapes in heads.ts).
 *
 * Zellen mit Doppelpunkt gehoeren einer Fraktion und duerfen deren Farben tragen (Stern, Abzeichen, Glutaugen). Alles
 * andere bleibt neutral: die Vertexfarbe faerbt es. Keine Schraffur: Schatten sind flache Flaechen.
 * Cells with a colon belong to one faction and may carry its colours (star, badge, ember eyes). Everything else stays
 * neutral: the vertex colour tints it. No hatching: shadows are flat areas.
 */
import { FAITH } from '../alveniaFaith';
import { mix, rng, shade, type ColorLike } from '../kit';
import { look, mat, type Look } from '../look';
import { TECH } from '../velkarTech';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { paintEmblem } from './emblem';
import { beretRings, DOME_T, GREY_FACE, GREY_HEAD, HAT_BAND, hoodRings, maskRings, paladinRings, robotRings, SKIRT_T, techHelmRings } from './heads';
import { ringT } from './uvkit';

/** Vierzackiger Stern der Alvenia / the Alvenia four-pointed star */
export function star(p: Pen, x: number, y: number, r: number, c: ColorLike, rim = 1.5): void {
  const pts: Pt[] = [];
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI * 2, rr = i % 2 === 0 ? r : r * 0.3; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  p.fill(pts, c);
  p.line(pts, rim, { closed: true, wobble: 0.1, press: 0.1 });
}
/** gezeichneter Glanz auf einer Kuppel / drawn shine on a dome */
function shine(p: Pen, x: number, y: number, k = 1): void {
  p.fill(spline([[x, y], [x + 4 * k, y - 16 * k], [x + 16 * k, y - 26 * k], [x + 13 * k, y - 13 * k], [x + 7 * k, y + 1 * k]], 5, true), mat.white, 0.5);
  p.fill(spline([[x + 21 * k, y - 29 * k], [x + 27 * k, y - 32 * k], [x + 26 * k, y - 26 * k]], 4, true), mat.white, 0.5);
}

/** Paladinhelm der Alvenia (Entwurf 384 x 160): Kuppel mit Stirnstern und Goldreif, darunter Wangen- und Nackenschutz / Alvenia paladin helmet (design 384 x 160) */
export function paintPaladin(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, Hd = H * DOME_T;
  const T = ringT(paladinRings(), true).map((t) => t * Hd);
  const band = T[7], bandBot = T[8];
  p.gradient(0, 0, W, band, [0, 0], [0, band], 1.05, 0.88);
  star(p, cx, band - 25, 15, FAITH.gold, 1.6);
  // Plattenfugen an den Schlaefen, Nieten ueber dem Reif / plate joints at the temples, rivets above the band
  for (const s of [0.27, 0.73]) p.panel(spline([[s * W, 22], [s * W + (s < 0.5 ? -4 : 4), band * 0.55], [s * W, band - 3]], 5), 1.5);
  for (const s of [0.08, 0.2, 0.38, 0.62, 0.8, 0.92]) p.rivet(s * W, band - 6.5, 2.6);
  shine(p, W * 0.36, band - 14);
  p.scratches(0, 12, W, band - 26, 5, 503, 16);
  // Goldreif: Raender und gravierte Linie / gold band: edges and an engraved line
  p.line([[-3, band + 0.6], [W + 3, band + 0.6]], 1.7, { taper: 0, wobble: 0.2 });
  p.line([[-3, bandBot - 0.6], [W + 3, bandBot - 0.6]], 1.7, { taper: 0, wobble: 0.2 });
  p.crease([[0, (band + bandBot) / 2], [W, (band + bandBot) / 2]], 1.6, 0.66, 0.8, { taper: 0, wobble: 0.2 });
  // Wangen- und Nackenschutz / cheek and neck guard
  const y0 = H * SKIRT_T, hs = H - y0;
  p.gradient(0, y0, W, hs * 0.3, [0, y0], [0, y0 + hs * 0.3], 0.72, 1);
  for (const s of [0.27, 0.73]) {
    const x = s * W, d = s < 0.5 ? 1 : -1;
    p.panel(spline([[x + d * 26, y0 + 4], [x + d * 20, y0 + hs * 0.5], [x + d * 30, y0 + hs * 0.7]], 5), 1.5);
    p.rivet(x, y0 + hs * 0.25, 2.6);
    p.rivet(x + d * 6, y0 + hs * 0.55, 2.4);
  }
  for (const [a, c] of [[0, 0.16], [0.84, 1]] as [number, number][]) p.panel([[a * W, y0 + hs * 0.36], [c * W, y0 + hs * 0.36]], 1.4);
  p.line([[-3, y0 + hs * 0.74], [W + 3, y0 + hs * 0.74]], 1.6, { taper: 0, wobble: 0.2 });
}

/** Visierhelm der Velkar (Entwurf 384 x 160) / Velkar visor helmet (design 384 x 160) */
export function paintTechHelm(p: Pen, L: Look): void {
  const W = p.w, H = p.h, cx = W / 2, Hd = H * DOME_T;
  const T = ringT(techHelmRings(), true).map((t) => t * Hd);
  const band = T[7], bandBot = T[8];
  p.gradient(0, 0, W, band, [0, 0], [0, band], 1.04, 0.88);
  // Sechseck-Abzeichen vorn / hexagon badge at the front
  p.dab(cx, band - 25, 20, 0.84, 0.6);
  paintEmblem(p, 'velkar', cx, band - 25, 13, L.secondary, 1.7);
  // Seitenschienen und Lueftungsschlitze / side rails and vent slits
  for (const s of [0.25, 0.75]) {
    const r = rrect(s * W - 24, band - 34, 48, 22, 5);
    p.shade(r, 0.86, 0.9);
    p.panel(r.concat([[s * W + 19, band - 34]]), 1.6);
    for (const dx of [-12, 0, 12]) p.line([[s * W + dx, band - 28], [s * W + dx, band - 18]], 1.8, { taper: 0.1, wobble: 0 });
  }
  for (const s of [0.04, 0.96]) for (const dy of [0, 8, 16]) p.line([[s * W - 12, band - 30 + dy], [s * W + 12, band - 30 + dy]], 1.7, { taper: 0.15, wobble: 0.1 });
  shine(p, W * 0.37, band - 12, 0.9);
  p.line([[-3, band + 0.6], [W + 3, band + 0.6]], 1.7, { taper: 0, wobble: 0.2 });
  p.line([[-3, bandBot - 0.6], [W + 3, bandBot - 0.6]], 1.7, { taper: 0, wobble: 0.2 });
  for (const s of [0.14, 0.5, 0.86]) p.rivet(s * W, (band + bandBot) / 2, 2.2);
  // Ohrschalen: runde Kappe mit Leuchtpunkt, Nackenfuge / ear cups: round cap with a light dot, neck joint
  const y0 = H * SKIRT_T, hs = H - y0;
  p.gradient(0, y0, W, hs * 0.3, [0, y0], [0, y0 + hs * 0.3], 0.72, 1);
  for (const s of [0.25, 0.75]) {
    const x = s * W, y = y0 + hs * 0.38;
    p.dab(x, y, 15, 0.8, 0.7);
    p.line(arc(x, y, 13, 11, 0, Math.PI * 2, 18), 1.8, { closed: true, wobble: 0.15 });
    p.line(arc(x, y, 6.5, 5.5, 0, Math.PI * 2, 12), 1.3, { closed: true, wobble: 0.1 });
    p.spot(x, y, 3, TECH.glow);
  }
  for (const [a, c] of [[0, 0.13], [0.87, 1]] as [number, number][]) p.panel([[a * W, y0 + hs * 0.36], [c * W, y0 + hs * 0.36]], 1.4);
  p.line([[-3, y0 + hs * 0.74], [W + 3, y0 + hs * 0.74]], 1.6, { taper: 0, wobble: 0.2 });
}

/** Visier (Entwurf 128 x 48, nur die Vorderseite): Spiegelung auf dem Glas, Rahmen / visor (design 128 x 48, front half only): reflection on the glass, frame */
export function paintVisor(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill([[W * 0.2, 4], [W * 0.36, 4], [W * 0.27, H * 0.34], [W * 0.14, H * 0.34]], mat.white, 0.3);
  p.fill([[W * 0.4, 4], [W * 0.46, 4], [W * 0.38, H * 0.34], [W * 0.33, H * 0.34]], mat.white, 0.22);
  p.line([[4, H - 3], [W - 4, H - 3]], 1.6, { taper: 0.1, wobble: 0.2 });
  for (const s of [0.07, 0.93]) p.rivet(s * W, H * 0.82, 2.2);
}

/** Barett der Meridon (Entwurf 256 x 80): Falten, Abzeichen mit Kompassrose, Schweissband / Meridon beret (design 256 x 80) */
export function paintBeret(p: Pen, L: Look): void {
  const W = p.w, H = p.h;
  const T = ringT(beretRings(L), true).map((t) => t * H);
  const edge = T[6], bandBot = T[8];
  p.gradient(0, 0, W, edge, [0, 0], [0, edge], 1.1, 0.86);
  // Falten vom Stiel nach aussen / folds from the stalk outward
  const R = rng(521);
  for (const s of [0.08, 0.3, 0.52, 0.7, 0.9]) {
    const x = s * W + (R() - 0.5) * 10;
    p.line(spline([[x, 8], [x + 5, edge * 0.45], [x - 3, edge * 0.82]], 5), 1.5, { taper: 0.45, wobble: 0.4 });
    p.crease(spline([[x + 5, 10], [x + 10, edge * 0.45], [x + 2, edge * 0.8]], 5), 4, 0.8, 0.6, { taper: 0.4 });
  }
  // Abzeichen links vorn: Scheibe in der Erstfarbe, Kompassrose / badge front left: disc in the primary colour, compass rose
  const bx = W * 0.4, by = edge - 17;
  p.fill(arc(bx, by, 13, 11.5, 0, Math.PI * 2, 20), L.primary);
  p.line(arc(bx, by, 13, 11.5, 0, Math.PI * 2, 20), 1.8, { closed: true, wobble: 0.15 });
  paintEmblem(p, 'meridon', bx, by, 9.5, mat.paper, 0);
  // Schweissband: Kanten und Naht / headband: edges and stitching
  p.line([[-3, edge + 0.5], [W + 3, edge + 0.5]], 1.7, { taper: 0, wobble: 0.25 });
  p.stitch([[0, (edge + bandBot) / 2], [W, (edge + bandBot) / 2]], 3.4, 2.8, 1, 1.6);
  p.line([[-3, bandBot - 0.5], [W + 3, bandBot - 0.5]], 1.5, { taper: 0, wobble: 0.2 });
}

/** Sonnenbrille (Entwurf 128 x 40): zwei dunkle Glaeser mit Steg und Glanz / sunglasses (design 128 x 40) */
export function paintShades(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  for (const s of [-1, 1]) {
    const x = cx + s * 27;
    const lens = spline([[x - 20, 10], [x, 7], [x + 20, 10], [x + 18, 26], [x, 33], [x - 18, 26]], 5, true);
    p.fill(lens, mat.ink);
    p.line(lens, 2, { closed: true, wobble: 0.15 });
    p.fill([[x - 12, 13], [x - 4, 12], [x - 10, 24], [x - 15, 23]], mat.white, 0.4);
    // Buegel zur Schlaefe / temple arm
    p.line([[x + s * 20, 14], [cx + s * (W / 2 + 2), 15]], 2.6, { taper: 0, wobble: 0.1 });
  }
  p.line(spline([[cx - 8, 13], [cx, 10], [cx + 8, 13]], 4), 2.6, { taper: 0.05, wobble: 0 });
  void H;
}

/** Hutkrone (Entwurf 128 x 48): Kniff, Falten, Band mit Naht und Schleife / hat crown (design 128 x 48): pinch, folds, band with stitching and bow */
export function paintHatCrown(p: Pen): void {
  const W = p.w, H = p.h;
  const band = H * (1 - HAT_BAND);
  p.gradient(0, 0, W, band, [0, 0], [0, band], 1.08, 0.86);
  p.line(spline([[W * 0.3, 7], [W * 0.5, 12], [W * 0.7, 7]], 5), 1.6, { taper: 0.4 });
  for (const s of [0.12, 0.38, 0.62, 0.88]) p.line(spline([[s * W, 10], [s * W + 3, band * 0.55], [s * W - 1, band - 3]], 4), 1.3, { taper: 0.45, wobble: 0.4 });
  p.crease(spline([[W * 0.5 - 3, 9], [W * 0.5, band * 0.5], [W * 0.5 - 2, band - 2]], 4), 5, 0.78, 0.6, { taper: 0.4 });
  p.line([[-3, band], [W + 3, band]], 1.7, { taper: 0, wobble: 0.2 });
  p.stitch([[0, band + 3.5], [W, band + 3.5]], 3.2, 2.6, 0.9, 0.62);
  // Schleife an der Seite / bow at the side
  const bx = W * 0.25, by = (band + H) / 2 + 1;
  p.shade(rrect(bx - 7, by - 4.5, 14, 9, 2), 0.72, 0.9);
  p.line(rrect(bx - 7, by - 4.5, 14, 9, 2), 1.3, { closed: true, wobble: 0.1 });
  p.line([[bx, by - 4.5], [bx, by + 4.5]], 1.2, { taper: 0, wobble: 0 });
}
/** Hutkrempe (Entwurf 160 x 32): t von der Krone zur Kante und zur Unterseite / hat brim (design 160 x 32): t from the crown to the edge and the underside */
export function paintHatBrim(p: Pen): void {
  const W = p.w, H = p.h;
  p.gradient(0, 0, W, H * 0.25, [0, 0], [0, H * 0.25], 0.72, 1);
  p.stitch([[0, H * 0.4], [W, H * 0.4]], 3.2, 2.6, 0.9, 0.62);
  p.line([[-3, H * 0.52], [W + 3, H * 0.52]], 1.4, { taper: 0, wobble: 0.25 });
}

/** Kopf des Grauen (Entwurf 320 x 144): Mandelaugen, Nasenschlitze, schmaler Mund, Zeichnung an den Schlaefen / the grey's head (design 320 x 144) */
export function paintGreyHead(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const top = GREY_HEAD[0].y;
  const Y = (y: number) => ((top - y) / top) * H;
  const ey = Y(GREY_FACE.eye), ex = GREY_FACE.eyeS * W;
  // Schaedel: hell oben, Schatten unter den Wangen / skull: light on top, shade below the cheeks
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.1, 0.8);
  p.dab(cx, Y(0.104), 34, 1.16, 0.5);
  for (const s of [-1, 1]) p.dab(cx + s * 30, Y(0.03), 20, 0.76, 0.6);
  // Schaedelnaht und Adern / skull seam and veins
  p.line(spline([[cx, 10], [cx + 2, Y(0.11)], [cx - 1, Y(0.092)]], 4), 1.1, { taper: 0.45, wobble: 0.5 });
  for (const s of [-1, 1]) p.line(spline([[cx + s * 36, 22], [cx + s * 46, Y(0.108)], [cx + s * 40, Y(0.094)]], 4), 1, { taper: 0.45, wobble: 0.5 });
  for (const s of [-1, 1]) {
    const X = (u: number) => cx + s * (ex + u);
    // Augenhoehle, dann das grosse schwarze Mandelauge, aussen hochgezogen / socket, then the big black almond eye, lifted at the outside
    p.dab(X(2), ey + 1, 30, 0.74, 0.7);
    const eye = spline([[X(-21), ey + 9], [X(-14), ey - 3], [X(0), ey - 11], [X(16), ey - 14], [X(25), ey - 9], [X(21), ey + 2], [X(8), ey + 10], [X(-8), ey + 13]], 6, true);
    p.blot(eye);
    p.erase(X(9), ey - 5.5, 3.6);
    p.spot(X(9), ey - 5.5, 4.2, mat.white);
    p.erase(X(-6), ey + 3, 1.6);
    p.spot(X(-6), ey + 3, 2, mat.white, 0.8);
    // Brauenwulst / brow ridge
    p.line(spline([[X(-22), ey - 9], [X(-2), ey - 18], [X(24), ey - 19]], 5), 1.6, { taper: 0.4, wobble: 0.2 });
    // Zeichnung an der Schlaefe: zwei dunkle Bogen / marking at the temple: two dark arcs
    for (const k of [0, 1]) p.crease(spline([[cx + s * (W * 0.25 + k * 11) - 6, Y(0.1)], [cx + s * (W * 0.25 + k * 11), Y(0.08)], [cx + s * (W * 0.25 + k * 11) - 5, Y(0.058)]], 5), 5 - k, 0.62, 0.85, { taper: 0.35 });
    // Nasenschlitz / nostril slit
    p.line([[cx + s * 4, Y(GREY_FACE.nose) - 4], [cx + s * 5.5, Y(GREY_FACE.nose) + 4]], 2, { taper: 0.3, wobble: 0.1 });
  }
  // schmaler Mund, Kinnfalte / narrow mouth, chin fold
  const my = Y(GREY_FACE.mouth);
  p.line(spline([[cx - 12, my - 1], [cx, my + 1.5], [cx + 12, my - 1]], 5), 2.2, { taper: 0.3, wobble: 0.15 });
  p.line(spline([[cx - 6, my + 9], [cx, my + 11], [cx + 6, my + 9]], 4), 1.2, { taper: 0.4 });
  // Nackenfalten / folds at the nape
  for (const x of [14, W - 14]) for (const dy of [0, 9]) p.line(spline([[x - 12, Y(0.03) + dy], [x, Y(0.03) + 4 + dy], [x + 12, Y(0.03) + dy]], 4), 1.2, { taper: 0.4 });
}

/** Kultkapuze (Entwurf 320 x 144): dunkle Gesichtsoeffnung, Falten, Flicken, Stirnband / cult hood (design 320 x 144) */
export function paintHood(p: Pen, L: Look): void {
  const W = p.w, H = p.h, cx = W / 2;
  const rings = hoodRings(L);
  const top = rings[0].y, bot = rings[rings.length - 1].y;
  const Y = (y: number) => ((top - y) / (top - bot)) * H;
  const bandTop = Y(0.0985), bandBot = Y(0.085);
  p.gradient(0, 0, W, bandTop, [0, 0], [0, bandTop], 1.12, 0.9);
  // Gesichtsoeffnung: Dunkel hinter der Maske / face opening: darkness behind the mask
  const open = spline([[cx - 44, Y(0.08)], [cx, Y(0.086)], [cx + 44, Y(0.08)], [cx + 50, Y(0.05)], [cx + 36, Y(0.014)], [cx, Y(0.004)], [cx - 36, Y(0.014)], [cx - 50, Y(0.05)]], 6, true);
  p.fill(open, mat.ink);
  p.line(open, 2.2, { closed: true, wobble: 0.4 });
  // Saum der Oeffnung: heller Wulst / rim of the opening: a lighter roll
  p.crease(spline([[cx - 56, Y(0.07)], [cx - 60, Y(0.045)], [cx - 44, Y(0.008)]], 5), 4, 1.3, 0.7, { taper: 0.3 });
  p.crease(spline([[cx + 56, Y(0.07)], [cx + 60, Y(0.045)], [cx + 44, Y(0.008)]], 5), 4, 1.3, 0.7, { taper: 0.3 });
  // Falten von der Spitze / folds from the tip
  const R = rng(541);
  for (const s of [0.06, 0.2, 0.36, 0.64, 0.8, 0.94]) {
    const x = s * W + (R() - 0.5) * 8;
    p.line(spline([[x, 12], [x + 4, bandTop * 0.55], [x - 2, bandTop - 3]], 4), 1.4, { taper: 0.45, wobble: 0.5 });
  }
  for (const s of [0.1, 0.9, 0.24, 0.76]) p.line(spline([[s * W, bandBot + 8], [s * W + (s < 0.5 ? 6 : -6), Y(0.04)], [s * W, Y(0.004)]], 5), 1.5, { taper: 0.4, wobble: 0.5 });
  p.crease(spline([[W * 0.15, bandBot + 10], [W * 0.17, Y(0.04)], [W * 0.14, Y(0.006)]], 5), 6, 0.78, 0.6, { taper: 0.3 });
  p.crease(spline([[W * 0.85, bandBot + 10], [W * 0.83, Y(0.04)], [W * 0.86, Y(0.006)]], 5), 6, 0.78, 0.6, { taper: 0.3 });
  // Flicken mit groben Stichen / patch with coarse stitches
  const px = W * 0.76, py = Y(0.05);
  p.shade(rrect(px - 15, py - 12, 30, 24, 3), 1.35, 0.85);
  p.line(rrect(px - 15, py - 12, 30, 24, 3), 1.3, { closed: true, wobble: 0.5 });
  for (let i = 0; i < 4; i++) p.mark([[px - 11 + i * 7, py - 15], [px - 9 + i * 7, py - 9]], 1.5, mat.bone, 0.9, { taper: 0, wobble: 0 });
  // Stirnband: Kanten, Knoten im Nacken / headband: edges, knot at the nape
  p.line([[-3, bandTop + 0.5], [W + 3, bandTop + 0.5]], 1.7, { taper: 0, wobble: 0.3 });
  p.line([[-3, bandBot - 0.5], [W + 3, bandBot - 0.5]], 1.7, { taper: 0, wobble: 0.3 });
  for (const x of [6, W - 6]) p.line(arc(x, (bandTop + bandBot) / 2, 5, 5, 0, Math.PI * 2, 10), 1.4, { closed: true, wobble: 0.2 });
  // ausgefranster Saum / ragged hem
  for (let x = 6; x < W; x += 11) p.line([[x + R() * 4, H - 9 - R() * 5], [x + R() * 4, H]], 1.2, { taper: 0.3, wobble: 0.3 });
}

/** Knochenmaske (Entwurf 96 x 112, nur die Vorderseite): Glutschlitze, Nasenloch, Zahnreihe, Risse / bone mask (design 96 x 112): ember slits, nose hole, teeth, cracks */
export function paintMask(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  const rings = maskRings();
  const top = rings[0].y, bot = rings[rings.length - 1].y;
  const Y = (y: number) => ((top - y) / (top - bot)) * H;
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.05, 0.82);
  for (const s of [-1, 1]) {
    // Augenschlitz mit Glut, schraeg nach innen / eye slit with ember, slanting inward
    const x = cx + s * 12.5, y = Y(0.064);
    const slit = spline([[x - s * 8.5, y + 4], [x, y - 2.5], [x + s * 9, y - 6], [x + s * 7, y + 1], [x - s * 2, y + 5.5]], 5, true);
    p.dab(x, y, 12, 0.7, 0.7);
    p.fill(slit, mat.ember);
    p.line(slit, 1.8, { closed: true, wobble: 0.15 });
    p.spot(x + s * 2, y - 0.5, 2.2, mat.yellow);
    // Wangenknochen / cheek bone
    p.line(spline([[cx + s * 22, Y(0.05)], [cx + s * 17, Y(0.04)], [cx + s * 18, Y(0.03)]], 4), 1.2, { taper: 0.4 });
  }
  // Nasenloch, Zahnreihe / nose hole, row of teeth
  p.blot([[cx, Y(0.05)], [cx + 4.5, Y(0.04)], [cx, Y(0.038) + 1], [cx - 4.5, Y(0.04)]]);
  const ty = Y(0.027);
  p.line([[cx - 13, ty], [cx + 13, ty]], 1.4, { taper: 0.1, wobble: 0.2 });
  for (const dx of [-10.5, -6.3, -2.1, 2.1, 6.3, 10.5]) p.line([[cx + dx, ty - 4], [cx + dx, ty + 5]], 1.2, { taper: 0.2, wobble: 0.1 });
  // Risse und Stirnzeichen / cracks and a brow mark
  p.line(spline([[cx + 16, Y(0.088)], [cx + 10, Y(0.08)], [cx + 18, Y(0.074)]], 4), 1.2, { taper: 0.4, wobble: 0.4 });
  p.line(spline([[cx - 24, Y(0.035)], [cx - 18, Y(0.028)], [cx - 22, Y(0.02)]], 4), 1.1, { taper: 0.4, wobble: 0.4 });
  p.line([[cx, Y(0.088)], [cx, Y(0.076)]], 2.2, { taper: 0.3 });
}

/** Roboterkopf der NEXUS (Entwurf 256 x 112): Visierband mit Leuchtstreifen, Plattenfugen, Kiefer / NEXUS robot head (design 256 x 112) */
export function paintRobotHead(p: Pen, L: Look): void {
  const W = p.w, H = p.h, cx = W / 2;
  const rings = robotRings(L);
  const T = ringT(rings).map((t) => t * H);
  const top = T[3], v0 = T[4], v1 = T[5], jaw = T[8];
  // Deckplatte, Visierband, Leuchtstreifen vorn / top plate, visor band, light strip at the front
  p.line([[-3, top + 0.5], [W + 3, top + 0.5]], 1.5, { taper: 0, wobble: 0.15 });
  p.line([[-3, v0 + 0.5], [W + 3, v0 + 0.5]], 1.7, { taper: 0, wobble: 0.15 });
  p.line([[-3, v1 - 0.5], [W + 3, v1 - 0.5]], 1.7, { taper: 0, wobble: 0.15 });
  const g0 = v0 + (v1 - v0) * 0.26, g1 = v0 + (v1 - v0) * 0.72;
  const strip = rrect(W * 0.285, g0, W * 0.43, g1 - g0, 3);
  p.fill(strip, mat.cyanGlow);
  p.line(strip, 1.5, { closed: true, wobble: 0.1 });
  p.fill([[W * 0.3, g0 + 1.5], [W * 0.7, g0 + 1.5], [W * 0.7, g0 + 3.2], [W * 0.3, g0 + 3.2]], mat.white, 0.55);
  // Platten: Mittelfuge, Wangenfugen, Schrauben / plates: centre joint, cheek joints, screws
  p.panel([[cx, v1 + 2], [cx, jaw - 2]], 1.4);
  for (const s of [0.36, 0.64]) p.panel(spline([[s * W, v1 + 2], [s * W + (s < 0.5 ? -5 : 5), (v1 + jaw) / 2], [s * W, jaw - 2]], 4), 1.3);
  for (const s of [0.31, 0.69, 0.06, 0.94]) { p.rivet(s * W, v1 + 6, 2); p.rivet(s * W, jaw - 6, 2); }
  for (const s of [0.42, 0.58]) p.rivet(s * W, top - 5, 2);
  // Lueftung am Kiefer / vents on the jaw
  for (const dx of [-12, -4, 4, 12]) p.line([[cx + dx, jaw + 7], [cx + dx, jaw + 17]], 1.9, { taper: 0.1, wobble: 0 });
  // Wartungsklappe hinten / service flap at the back
  for (const x of [20, W - 20]) p.panel(rrect(x - 14, v1 + 5, 28, jaw - v1 - 10, 3).concat([[x + 11, v1 + 5]]), 1.3);
  p.scratches(0, v1 + 3, W, jaw - v1 - 6, 4, 557, 14);
}

/** Zellen der Kopfbedeckungen und Koepfe, um k skaliert / cells of the headgear and heads, scaled by k */
export function headCells(k = 1, alien = k): Cell[] {
  const c = (name: string, w: number, h: number, paint: (p: Pen) => void, kk = k): Cell => ({ name, w: Math.max(16, Math.round(w * kk)), h: Math.max(12, Math.round(h * kk)), design: [w, h], paint });
  return [
    c('helmet:alvenia', 384, 160, paintPaladin),
    c('helmet:velkar', 384, 160, (p) => paintTechHelm(p, look('velkar'))),
    c('visor', 128, 48, paintVisor),
    c('beret:meridon', 256, 80, (p) => paintBeret(p, look('meridon'))),
    c('shades', 128, 40, paintShades),
    c('hatCrown', 128, 48, paintHatCrown),
    c('hatBrim', 160, 32, paintHatBrim),
    c('head:zyrr', 320, 144, paintGreyHead, alien),
    c('hood:vesper', 320, 144, (p) => paintHood(p, look('vesper')), alien),
    c('mask:vesper', 96, 112, paintMask, alien),
    c('head:nexus', 256, 112, (p) => paintRobotHead(p, look('nexus')), alien),
  ];
}
void mix; void shade;
