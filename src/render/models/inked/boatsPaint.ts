/**
 * Gezeichnete Einheiten: Zeichnung der Boote und des Lenkflugkoerpers (Atlas 'boat').
 * Inked units: drawing of the boats and the guided missile (atlas 'boat').
 *
 * Landungsboot: Bordwand mit Spanten, Fendern und Tauwulst, Laderaumboden mit Querleisten, Rampe. Kaperschiff:
 * Plankenwand mit Stueckpforten, Plankendeck, Segeltuch mit Naehten und Reffbaendern, Beutetruhe. Nebelkutter: graue
 * Bordwand mit Reifenfendern, Deck mit Gleitschutzfeldern, Tarnnetz als Flecken (kein Gewebe). Lenkflugkoerper: Rumpf
 * mit Goldband, Warnstreifen und Suchkopf, Startwagen mit Warnschraffen.
 * Landing boat: side with ribs, fenders and a rope fender, well floor with cross battens, ramp. Privateer: plank side
 * with gun ports, plank deck, canvas with seams and reef bands, loot chest. Fog cutter: grey side with tyre fenders,
 * deck with non-slip panels, camo net as blotches (no weave). Guided missile: body with a gold band, warning stripe
 * and seeker, launch trailer with hazard chevrons.
 */
import { mix, rng } from '../kit';
import { mat } from '../look';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { BOAT, CUTTER, PRIVATEER } from './boats';
import { anchor, edgeChips, hatchDoor, planks, rect, ring, rustRuns, slots, windowBand, windowPane } from './navalPaint';
import { bitts, deckHatch, paintBridge, paintFoam, paintHouse, paintRoof } from './shipsPaint';
import { SIDE_T } from './ships';
import { BARE, MUD_DRY, MUD_WET, SOOT, stencil, streaks, WOOD } from './trim';

/** Reifenfender am Tau / tyre fender on a rope */
function tyre(p: Pen, x: number, y: number, r: number, top: number): void {
  p.line([[x, top], [x, y - r * 0.6]], 1.3, { taper: 0, wobble: 0.3 });
  p.shade(ring(x + 1.5, y + 2, r, 14), 0.74, 0.8);
  p.fill(ring(x, y, r, 16), SOOT);
  p.line(ring(x, y, r, 16), 1.5, { closed: true, wobble: 0.1 });
  p.fill(ring(x, y, r * 0.42, 10), mix(SOOT, mat.metal, 0.35));
  p.line(ring(x, y, r * 0.42, 10), 1.1, { closed: true, wobble: 0.1 });
  p.mark(arc(x, y, r * 0.74, r * 0.74, Math.PI * 1.05, Math.PI * 1.6, 5), 1.3, mat.metalLight, 0.5, { taper: 0.3 });
}

/** Wasserlinie: Tuschelinie und heller Rand darunter / waterline: ink line and a light edge below */
function waterline(p: Pen, seed: number): void {
  const wl = p.h * SIDE_T.water;
  p.line([[-3, wl], [p.w + 3, wl]], 1.5, { taper: 0, wobble: 0.3, press: 0.3, seed });
  p.crease([[0, wl + 3.2], [p.w, wl + 3.2]], 1.5, 1.5, 0.7, { taper: 0, wobble: 0.5 });
}

/** Bordwand des Landungsboots (320 x 64): s Bug -> Heck / the landing boat's side: s bow -> stern */
function paintBoatSide(p: Pen): void {
  const W = p.w, H = p.h;
  const y0 = H * SIDE_T.trim, wl = H * SIDE_T.water;
  p.shade(rect(0, y0, W, 3.5), 0.84, 0.8);
  p.line([[-3, y0], [W + 3, y0]], 1.4, { taper: 0, wobble: 0.2 });
  // Tauwulst unter dem Dollbord / rope fender below the gunwale
  p.band([[-2, y0 + 6], [W + 2, y0 + 6]], 4.2, mat.sand, 1.1);
  for (let x = 14; x < W; x += 23) p.line([[x - 1.5, y0 + 4.4], [x + 1.5, y0 + 7.6]], 0.9, { taper: 0, wobble: 0 });
  // Spanten / ribs
  for (const x of [58, 136, 232, 296]) { p.shade(rect(x + 1, y0 + 9, 4, wl - y0 - 10), 0.84, 0.8); p.panel([[x, y0 + 9], [x, wl - 2]], 1.5, 701 + x); }
  tyre(p, 100, y0 + 24, 9.5, y0 + 8);
  tyre(p, 190, y0 + 24, 9.5, y0 + 8);
  // Speigatten, Kennzeichnung am Bug / scuppers, marking at the bow
  for (const x of [34, 152, 262]) { p.fill(rrect(x, wl - 9, 11, 3.6, 1.4), SOOT); }
  for (const x of [14, 26]) p.fill(rect(x, y0 + 13, 7, 17), mat.paper, 0.95);
  waterline(p, 703);
  rustRuns(p, [[39, wl - 6], [157, wl - 6], [267, wl - 6]], 9, 705);
  edgeChips(p, 0, wl - 5, W, 4, 10, 707);
  p.scratches(40, y0 + 12, W - 60, wl - y0 - 20, 6, 709, 18);
}

/** Laderaumboden (256 x 200): Planken laengs, Querleisten, Zurrringe / well floor: planks along, cross battens, lashing rings */
function paintBoatFloor(p: Pen): void {
  const W = p.w, H = p.h, B = BOAT;
  const X = (z: number) => ((z - B.z0) / (B.z1 - B.z0)) * W;
  planks(p, 0, 0, W, H, 9, 711, 90);
  for (const z of [-0.12, -0.02, 0.08, 0.17]) p.band([[X(z), 6], [X(z), H - 6]], 5.5, WOOD, 1.2);
  // Schatten unter dem Dollbord und vor dem Heckaufbau / shadow under the gunwale and in front of the stern block
  for (const y of [0, H - 9]) p.shade(rect(0, y, W, 9), 0.78, 0.85);
  p.shade(rect(0, 0, X(B.z0 + 0.1), H), 0.8, 0.85);
  for (const [z, y] of [[-0.07, 20], [-0.07, H - 20], [0.13, 20], [0.13, H - 20]]) { p.line(ring(X(z), y, 4.2, 10), 1.6, { closed: true, wobble: 0.1 }); p.dab(X(z), y, 2.2, 0.7, 0.8); }
  p.mud(X(0.14), 0, W - X(0.14), H, MUD_WET, MUD_DRY, 713, 0.2);
  p.splatter(0, 0, W, H, 8, MUD_DRY, 715, { size: 4, rise: 1, alpha: 0.5 });
}

/** Rampe (192 x 64): Rippen, Scharnier, Markierung / ramp: ribs, hinge, marking */
function paintRamp(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(4, 4, W - 8, H - 8, 3).concat([[W - 8, 4]]), 1.6, 721);
  for (const y of [20, 34, 48]) { p.shade(rect(8, y + 1, W - 16, 4.5), 0.82, 0.8); p.panel([[8, y], [W - 8, y]], 1.5, 721 + y); }
  p.fill(rect(W / 2 - 22, 7, 44, 9), mat.paper, 0.95);
  p.line(rect(W / 2 - 22, 7, 44, 9), 1.2, { closed: true, wobble: 0.1 });
  for (const x of [26, W / 2, W - 26]) { p.fill(rrect(x - 7, H - 9, 14, 7, 2), SOOT); p.line(rrect(x - 7, H - 9, 14, 7, 2), 1.2, { closed: true, wobble: 0.1 }); }
  edgeChips(p, 4, 3, W - 8, 6, 9, 723);
  p.splatter(0, H * 0.5, W, H * 0.5, 9, MUD_WET, 725, { size: 3, alpha: 0.5 });
}

/** Schott vor dem Motorraum (224 x 48) / bulkhead in front of the engine room */
function paintBulkhead(p: Pen): void {
  const W = p.w, H = p.h;
  hatchDoor(p, W / 2 - 10, 6, 20, 38);
  slots(p, 26, 14, 30, 4, 6);
  p.line(rrect(22, 10, 38, 30, 3), 1.4, { closed: true, wobble: 0.15 });
  p.fill(rrect(W - 52, 16, 10, 20, 3), mat.red);
  p.line(rrect(W - 52, 16, 10, 20, 3), 1.2, { closed: true, wobble: 0.1 });
  p.panel([[150, 8], [150, H - 6]], 1.2, 731);
  p.rivets([8, 5], [W - 8, 5], 12, 1.6);
  edgeChips(p, 0, H - 7, W, 5, 8, 733);
}

/** Kiste (96 x 64): Bretter, Eckbeschlaege, Schablone / crate: boards, corner brackets, stencil */
function paintCargo(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(4, 4, W - 8, H - 8, 2).concat([[W - 8, 4]]), 1.6, 741);
  for (const y of [22, 42]) p.line([[6, y], [W - 6, y]], 1.1, { taper: 0.05, wobble: 0.3 });
  for (const [x, y] of [[4, 4], [W - 16, 4], [4, H - 16], [W - 16, H - 16]]) { p.fill(rect(x, y, 12, 12), BARE, 0.9); p.line(rect(x, y, 12, 12), 1.1, { closed: true, wobble: 0.1 }); p.dot(x + 6, y + 6, 1.3); }
  stencil(p, mat.paper, 'K 7', W / 2, 33, 14, 743);
}

/** Plankenwand des Kaperschiffs (512 x 64): s Bug -> Heck / the privateer's plank side: s bow -> stern */
function paintPlankSide(p: Pen): void {
  const W = p.w, H = p.h;
  const y0 = H * SIDE_T.trim, wl = H * SIDE_T.water;
  p.shade(rect(0, y0, W, 3.5), 0.84, 0.8);
  p.line([[-3, y0], [W + 3, y0]], 1.4, { taper: 0, wobble: 0.2 });
  planks(p, 0, y0 + 1, W, wl - y0 - 2, 4, 751, 120);
  // Stueckpforten mit Scharnieren, Anker, Ruesteisen der Wanten / gun ports with hinges, anchor, chain plates of the shrouds
  for (const x of [226, 322]) {
    p.shade(rrect(x, y0 + 8, 20, 16, 2), 0.82, 0.9);
    p.line(rrect(x, y0 + 8, 20, 16, 2), 1.6, { closed: true, wobble: 0.15 });
    for (const dx of [5, 15]) p.line([[x + dx, y0 + 5], [x + dx, y0 + 11]], 1.8, { taper: 0, wobble: 0 });
    p.line(ring(x + 10, y0 + 17, 2.2, 8), 1.1, { closed: true, wobble: 0 });
  }
  anchor(p, 52, y0 + 17, 8);
  for (const x of [262, 276, 290]) p.line([[x, y0 + 2], [x - 2, y0 + 15]], 1.6, { taper: 0.1, wobble: 0.1 });
  waterline(p, 753);
  // Teerlaeufer statt Rost / tar runs instead of rust
  streaks(p, 0, y0 + 3, W, wl - y0 - 8, 9, 755);
  edgeChips(p, 0, wl - 5, W, 4, 8, 757);
}

/** Plankendeck des Kaperschiffs (448 x 136) / the privateer's plank deck */
function paintDeckPrivateer(p: Pen): void {
  const W = p.w, H = p.h, P = PRIVATEER;
  const X = (z: number) => ((z - P.z0) / (P.z1 - P.z0)) * W, Y = (x: number) => H * (0.5 - x / (P.beam * P.inset));
  planks(p, 0, 4, W, H - 8, 9, 761, 120);
  for (const s of [-1, 1]) p.line([[X(P.z0 + 0.04), Y(s * 0.105)], [X(P.z1 - P.bow), Y(s * 0.105)]], 1.3, { taper: 0.04, wobble: 0.3 });
  // Mastkragen, Ladeluke mit Schalkleisten, Taurolle / mast collar, cargo hatch with battens, rope coil
  p.shade(ring(X(0.045), Y(0), 9, 14), 0.8, 0.9);
  p.line(ring(X(0.045), Y(0), 9, 14), 1.6, { closed: true, wobble: 0.1 });
  const hx = X(-0.06), hw = 42, hh = 34;
  p.shade(rrect(hx - hw / 2 + 2, Y(0) - hh / 2 + 3, hw, hh, 2), 0.76, 0.7);
  p.fill(rrect(hx - hw / 2, Y(0) - hh / 2, hw, hh, 2), WOOD, 0.9);
  p.line(rrect(hx - hw / 2, Y(0) - hh / 2, hw, hh, 2), 1.6, { closed: true, wobble: 0.15 });
  for (const dx of [-8, 8]) p.line([[hx + dx, Y(0) - hh / 2 + 2], [hx + dx, Y(0) + hh / 2 - 2]], 1.2, { taper: 0.05, wobble: 0.2 });
  const cx = X(-0.27), cy = Y(0.05);
  for (const r of [9, 5.5]) p.mark(ring(cx, cy, r, 14).concat([[cx + r, cy]]), 3, mat.sand, 1, { taper: 0, wobble: 0.2, press: 0.1 });
  for (const r of [10.6, 7.3, 3.8]) p.line(ring(cx, cy, r, 14), 1, { closed: true, wobble: 0.2 });
  for (const s of [-1, 1]) { bitts(p, X(0.2), Y(s * 0.085)); bitts(p, X(-0.3), Y(s * 0.085)); }
  deckHatch(p, X(0.27), Y(0), 14, 13);
}

/** Segeltuch (192 x 192): Bahnen, Reffband, Flicken; ruhig zwischen den Naehten / canvas: cloths, reef band, patch; calm between the seams */
function paintSail(p: Pen): void {
  const W = p.w, H = p.h, R = rng(771);
  for (const x of [38, 78, 116, 154]) p.line(spline([[x + R() * 3, 3], [x + 2, H / 2], [x + R() * 3, H - 3]], 5), 1.1, { taper: 0.05, wobble: 0.5, press: 0.3 });
  // Reffband mit Reffbaendseln / reef band with reef points
  p.shade(rect(0, 44, W, 9), 0.9, 0.9);
  for (const y of [44, 53]) p.line([[2, y], [W - 2, y]], 0.9, { taper: 0.05, wobble: 0.3 });
  for (const x of [20, 58, 97, 135, 172]) p.line([[x, 49], [x + 1.5, 62]], 1.5, { taper: 0.4, wobble: 0.3 });
  // Flicken mit Stichen / stitched patch
  p.shade(rrect(122, 116, 24, 20, 2), 0.88, 0.9);
  p.stitch([[122, 116], [146, 116], [146, 136], [122, 136], [122, 116]], 3.4, 2.8, 1, 0.5);
  // Liektau am Rand, Schatten in der unteren Bucht / bolt rope at the edge, shade in the lower belly
  p.line(rrect(3, 3, W - 6, H - 6, 2), 1.5, { closed: true, wobble: 0.3 });
  p.gradient(0, H * 0.62, W, H * 0.38, [0, H * 0.62], [0, H], 1, 0.84);
  p.splatter(0, H * 0.7, W, H * 0.3, 7, mat.sandbag, 773, { size: 5, alpha: 0.35 });
}

/** Beutetruhe (96 x 64): Holz mit Goldbaendern und Schloss / loot chest: wood with gold bands and a lock */
function paintChest(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [16, W - 24]) { p.fill(rect(x, 0, 8, H), mat.gold); for (const dx of [0, 8]) p.line([[x + dx, -2], [x + dx, H + 2]], 1.2, { taper: 0, wobble: 0.1 }); }
  p.line([[0, 20], [W, 20]], 1.5, { taper: 0, wobble: 0.3 });
  p.fill(rrect(W / 2 - 6, 15, 12, 13, 2), mat.gold);
  p.line(rrect(W / 2 - 6, 15, 12, 13, 2), 1.2, { closed: true, wobble: 0.1 });
  p.dot(W / 2, 23, 1.6);
  p.line([[4, 42], [W - 4, 42]], 1, { taper: 0.1, wobble: 0.4 });
}

/** Fass (96 x 48): Dauben und zwei Reifen / keg: staves and two hoops */
function paintKeg(p: Pen): void {
  const W = p.w, H = p.h;
  for (let x = 8; x < W; x += 16) p.line([[x, 2], [x + 0.5, H - 2]], 1, { taper: 0.1, wobble: 0.3 });
  for (const y of [11, H - 11]) p.band([[-2, y], [W + 2, y]], 5, BARE, 1.1);
}

/** Bordwand des Nebelkutters (384 x 56): s Bug -> Heck; t: Gummiwulst, grau, Farbstreifen, Unterwasser / the fog cutter's side: collar, grey, colour stripe, underwater */
function paintCutterSide(p: Pen): void {
  const W = p.w, H = p.h;
  const y0 = H * SIDE_T.trim, ys = H * 0.62, wl = H * SIDE_T.water;
  // Gummiwulst: heller Glanzstrich, Naehte / rubber collar: a light sheen stroke, seams
  p.crease([[4, y0 * 0.4], [W - 4, y0 * 0.4]], 1.3, 2.2, 0.8, { taper: 0.05, wobble: 0.3 });
  for (const x of [96, 208, 310]) p.crease([[x, 1], [x, y0 - 1]], 1.2, 2, 0.8, { taper: 0, wobble: 0 });
  p.line([[-3, y0], [W + 3, y0]], 1.4, { taper: 0, wobble: 0.2 });
  p.shade(rect(0, y0, W, 3), 0.82, 0.8);
  for (const x of [64, 176, 290]) p.line([[x, y0 + 3], [x + 0.6, ys - 1]], 1.1, { taper: 0.12, wobble: 0.2 });
  p.line([[-3, ys], [W + 3, ys]], 1.2, { taper: 0, wobble: 0.2 });
  for (const x of [128, 232, 330]) tyre(p, x, y0 + 12, 7.5, y0 + 1);
  // Auspuffstutzen am Heck / exhaust port at the stern
  p.fill(ring(W - 18, ys - 6, 3.4, 10), SOOT);
  p.line(ring(W - 18, ys - 6, 3.4, 10), 1.2, { closed: true, wobble: 0 });
  p.gradient(W - 28, ys - 4, 20, 14, [0, ys - 4], [0, ys + 10], 0.6, 1, 0.7);
  waterline(p, 781);
  streaks(p, 0, y0 + 2, W, ys - y0, 6, 783);
  edgeChips(p, 0, wl - 5, 40, 4, 5, 785);
}

/** Deck des Nebelkutters (320 x 192): Gleitschutzfelder, Klampen, Ankerkasten / the fog cutter's deck: non-slip panels, cleats, anchor well */
function paintDeckCutter(p: Pen): void {
  const W = p.w, H = p.h, C = CUTTER;
  const X = (z: number) => ((z - C.z0) / (C.z1 - C.z0)) * W, Y = (x: number) => H * (0.5 - x / (C.beam * C.inset));
  for (const [za, zb] of [[-0.045, 0.045], [0.06, 0.13]]) {
    const r = rrect(X(za), Y(0.1), X(zb) - X(za), Y(-0.1) - Y(0.1), 7);
    p.shade(r, 0.84, 0.9);
    p.line(r, 1.4, { closed: true, wobble: 0.2 });
  }
  // Ankerkasten im Bug, Luke, Leine / anchor well in the bow, hatch, rope
  const tri: Pt[] = [[X(0.16), Y(0.07)], [X(0.225), Y(0)], [X(0.16), Y(-0.07)]];
  p.shade(tri, 0.8, 0.9);
  p.line(tri, 1.5, { closed: true, wobble: 0.2 });
  anchor(p, X(0.18), Y(0), 7);
  for (const s of [-1, 1]) { bitts(p, X(0.14), Y(s * 0.125)); bitts(p, X(-0.16), Y(s * 0.14)); }
  deckHatch(p, X(-0.03), Y(-0.125), 15, 13);
  const cx = X(0.03), cy = Y(0.128);
  for (const r of [8, 4.5]) p.mark(ring(cx, cy, r, 14).concat([[cx + r, cy]]), 2.8, mat.sand, 1, { taper: 0, wobble: 0.2, press: 0.1 });
  for (const r of [9.5, 6.2]) p.line(ring(cx, cy, r, 14), 1, { closed: true, wobble: 0.2 });
  p.scratches(X(-0.04), Y(0.09), 110, 110, 7, 791, 22);
  p.splatter(0, 0, W, H, 9, SOOT, 793, { size: 2.6, rise: 1, alpha: 0.25 });
}

/** Bruecke des Nebelkutters (288 x 64): s rundum, Scheibe vorn / the fog cutter's bridge: s around, screen at the front */
function paintCutterBridge(p: Pen): void {
  const W = p.w, H = p.h;
  p.line([[-3, 9], [W + 3, 9]], 1.4, { taper: 0, wobble: 0.2 });
  p.shade(rect(0, 9, W, 4), 0.8, 0.8);
  windowBand(p, W / 2 - 46, 16, 92, 20, 3, mat.glassDark);
  windowPane(p, 46, 18, 34, 17, mat.glassDark);
  windowPane(p, W - 80, 18, 34, 17, mat.glassDark);
  hatchDoor(p, 6, 16, 16, 44);
  p.panel([[W / 2 - 60, 44], [W / 2 + 60, 44]], 1.2, 801);
  slots(p, W - 36, 40, 18, 3, 5);
  edgeChips(p, 0, H - 7, W, 5, 8, 803);
}

/** Tarnnetz (192 x 96): Flecken in Laubtoenen, Buesche, Leinen; kein Gewebe / camo net: blotches in leaf tones, tufts, lines; no weave */
function paintCamo(p: Pen): void {
  const W = p.w, H = p.h, R = rng(811);
  const tones = [mat.leafDark, mix(mat.leafDark, mat.ink, 0.45), mix(mat.leaf, mat.sand, 0.5)];
  for (let i = 0; i < 13; i++) {
    const x = R() * W, y = 6 + R() * (H - 12), r = 9 + R() * 11;
    const blob: Pt[] = [];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, rr = r * (0.6 + R() * 0.6); blob.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * 0.8]); }
    p.fill(spline(blob, 4, true), tones[i % 3], 0.85);
    if (i % 3 === 0) p.line(spline(blob, 4, true), 1.1, { closed: true, wobble: 0.3 });
  }
  // Laubbuesche: kurze Blattstriche in kleinen Gruppen / leaf tufts: short leaf strokes in small groups
  for (let i = 0; i < 6; i++) {
    const x = 12 + R() * (W - 24), y = 14 + R() * (H - 30);
    for (let k = 0; k < 3; k++) p.line(spline([[x, y], [x + (k - 1) * 5, y - 6], [x + (k - 1) * 8, y - 11]], 3), 1.5, { taper: 0.45, wobble: 0.2 });
  }
  for (const x of [34, 100, 160]) p.line(spline([[x, 4], [x + 6, H / 2], [x - 4, H - 3]], 4), 1, { taper: 0.1, wobble: 0.6 });
  p.gradient(0, H * 0.7, W, H * 0.3, [0, H * 0.7], [0, H], 1, 0.7);
}

/** Rumpf des Flugkoerpers (160 x 224): s rundum (oben in der Mitte), t Duese -> Nase / missile body: s around (top in the middle), t nozzle -> nose */
function paintMissile(p: Pen): void {
  const W = p.w, H = p.h;
  const T = (t: number) => t * H;
  // Fugen der Baugruppen / joints of the sections
  for (const t of [0.19, 0.66]) { p.line([[-3, T(t)], [W + 3, T(t)]], 1.5, { taper: 0, wobble: 0.2 }); p.crease([[0, T(t) + 3], [W, T(t) + 3]], 1.4, 1.5, 0.7, { taper: 0, wobble: 0.2 }); }
  p.rivets([10, T(0.215)], [W - 10, T(0.215)], 8, 1.7);
  // Goldband, Warnstreifen, Kennung / gold band, warning stripe, marking
  p.fill(rect(0, T(0.4), W, 13), mat.gold);
  for (const dy of [0, 13]) p.line([[-3, T(0.4) + dy], [W + 3, T(0.4) + dy]], 1.2, { taper: 0, wobble: 0.15 });
  for (const x of [34, W - 44]) { p.fill(rect(x, T(0.25), 10, T(0.13)), mat.red, 0.95); p.line(rect(x, T(0.25), 10, T(0.13)), 1.1, { closed: true, wobble: 0.1 }); }
  // Messmarken statt Schrift: drei kurze Ringstuecke / calibration marks instead of lettering: three short ring pieces
  for (const t of [0.5, 0.54, 0.58]) p.line([[W / 2 - 14, T(t)], [W / 2 + 14, T(t)]], 2.2, { taper: 0, wobble: 0 });
  // Wartungsklappe und Suchkopf / access panel and seeker
  p.line(rrect(W - 52, T(0.5), 24, 28, 4), 1.3, { closed: true, wobble: 0.15 });
  for (const [dx, dy] of [[3, 3], [21, 3], [3, 25], [21, 25]]) p.dot(W - 52 + dx, T(0.5) + dy, 1.2);
  p.fill(rect(0, T(0.9), W, T(0.055)), mat.glassDark);
  for (const t of [0.9, 0.955]) p.line([[-3, T(t)], [W + 3, T(t)]], 1.3, { taper: 0, wobble: 0.15 });
  p.fill([[20, T(0.945)], [40, T(0.905)], [52, T(0.905)], [32, T(0.945)]], mat.white, 0.4);
  // Russ an der Duese, Kratzer / soot at the nozzle, scratches
  p.gradient(0, 0, W, T(0.12), [0, 0], [0, T(0.12)], 0.5, 1);
  p.scratches(8, T(0.24), W - 16, T(0.36), 7, 823, 18);
  p.chips(0, T(0.66), W, 8, 7, BARE, 825, 2.4);
}

/** Flosse (48 x 48): Vorderkante, Nietreihe an der Wurzel / fin: leading edge, rivet row at the root */
function paintFin(p: Pen): void {
  const W = p.w, H = p.h;
  p.crease([[3, 4], [W - 3, 4]], 2, 1.5, 0.8, { taper: 0.1, wobble: 0.2 });
  p.panel([[6, H * 0.55], [W - 6, H * 0.55]], 1.2, 831);
  p.rivets([7, H - 7], [W - 7, H - 7], 5, 1.6);
}

/** Rahmen des Startwagens (256 x 32) / frame of the launch trailer */
function paintTrailerSide(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(4, 4, W - 8, H - 8, 2).concat([[W - 8, 4]]), 1.5, 841);
  for (const x of [58, 128, 198]) { p.rivet(x, 10, 1.8); p.rivet(x, H - 10, 1.8); }
  p.fill(rect(W - 22, 11, 10, 9), mat.red);
  p.line(rect(W - 22, 11, 10, 9), 1.1, { closed: true, wobble: 0.1 });
  stencil(p, mat.paper, '07', 30, H / 2, 13, 843);
  p.mud(0, H * 0.35, W, H * 0.65, MUD_WET, MUD_DRY, 845, 0.35);
}

/** Warnschraffen an Bug und Heck des Wagens (96 x 24): eine Markierung, kein Schatten / hazard chevrons at both ends of the trailer: a marking, not shading */
function paintHazard(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill(rect(4, 4, W - 8, H - 8), mat.yellow);
  for (let x = 4; x < W - 8; x += 22) p.fill([[x + 6, 4], [x + 15, 4], [x + 9, H - 4], [x, H - 4]], SOOT);
  p.line(rect(4, 4, W - 8, H - 8), 1.3, { closed: true, wobble: 0.1 });
}

/** Plattform des Wagens (64 x 160) / the trailer's deck */
function paintTrailerTop(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(4, 4, W - 8, H - 8, 3), 1.2, { closed: true, wobble: 0.2 });
  for (const y of [40, 84, 124]) p.line([[6, y], [W - 6, y]], 1, { taper: 0.08, wobble: 0.3 });
  for (const [x, y] of [[9, 9], [W - 9, 9], [9, H - 9], [W - 9, H - 9]]) p.rivet(x, y, 1.8);
  p.splatter(0, 0, W, H, 6, MUD_DRY, 851, { size: 3, rise: 1, alpha: 0.4 });
}

/** Startschiene von der Seite (224 x 16) / launch rail from the side */
function paintRail(p: Pen): void {
  const H = p.h;
  for (const x of [20, 92, 164]) { p.fill(rrect(x, 5, 44, 6, 2), SOOT); p.crease([[x, 12.5], [x + 44, 12.5]], 1, 2, 0.7, { taper: 0.1, wobble: 0 }); }
  for (const x of [10, 78, 150, 216]) p.dab(x, H / 2, 1.8, 2.4, 0.8);
}

/** Bedienpult (64 x 48): Bildschirm, Schalter / console: screen, switches */
function paintConsole(p: Pen): void {
  const W = p.w;
  windowPane(p, 7, 7, W - 14, 20, mat.glassDark, 3);
  for (const [x, c] of [[14, mat.red], [26, mat.yellow], [38, mat.green]] as [number, typeof mat.red][]) { p.spot(x, 37, 3, c); p.line(ring(x, 37, 3, 8), 1, { closed: true, wobble: 0 }); }
  p.line([[46, 34], [57, 34], [57, 41], [46, 41]], 1.4, { taper: 0.05, wobble: 0.1 });
}




/** Zellen der Boote und des Lenkflugkoerpers / cells of the boats and the guided missile */
export function boatCells(): Cell[] {
  return [
    { name: 'boatSide', w: 320, h: 64, paint: paintBoatSide },
    { name: 'deck:boat', w: 256, h: 200, paint: paintBoatFloor },
    { name: 'ramp', w: 192, h: 64, paint: paintRamp },
    { name: 'bulkhead', w: 224, h: 48, paint: paintBulkhead },
    { name: 'cargo', w: 96, h: 64, paint: paintCargo },
    { name: 'plankSide', w: 512, h: 64, paint: paintPlankSide },
    { name: 'deck:privateer', w: 448, h: 136, paint: paintDeckPrivateer },
    { name: 'sail', w: 192, h: 192, paint: paintSail },
    { name: 'chest', w: 96, h: 64, paint: paintChest },
    { name: 'keg', w: 96, h: 48, paint: paintKeg },
    { name: 'cutterSide', w: 384, h: 56, paint: paintCutterSide },
    { name: 'deck:cutter', w: 320, h: 192, paint: paintDeckCutter },
    { name: 'cutterBridge', w: 288, h: 64, paint: paintCutterBridge },
    { name: 'camo', w: 192, h: 96, paint: paintCamo },
    { name: 'missile', w: 160, h: 224, paint: paintMissile },
    { name: 'fin', w: 48, h: 48, paint: paintFin },
    { name: 'trailerSide', w: 256, h: 32, paint: paintTrailerSide },
    { name: 'hazard', w: 96, h: 24, paint: paintHazard },
    { name: 'trailerTop', w: 64, h: 160, paint: paintTrailerTop },
    { name: 'rail', w: 224, h: 16, paint: paintRail },
    { name: 'console', w: 64, h: 48, paint: paintConsole },
    { name: 'foam', w: 96, h: 96, paint: paintFoam },
    // Steuerhaus des Kaperschiffs: dieselben Waende wie die Kriegsschiffe, kleiner / the privateer's wheelhouse: the same walls as the warships, smaller
    { name: 'bridge', w: 320, h: 68, design: [448, 96], paint: paintBridge },
    { name: 'house', w: 320, h: 68, design: [448, 96], paint: paintHouse },
    { name: 'roof', w: 64, h: 64, design: [96, 96], paint: paintRoof },
  ];
}
