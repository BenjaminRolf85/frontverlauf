/**
 * Gezeichnete Einheiten: Zeichnung der Schrottfahrzeuge des Kults / inked units: drawing of the cult's scrap vehicles.
 *
 * Aus Schrott gebaut: ungleiche Platten mit Schweissraupen, aufgenietete Flickbleche, Rost, Russ, grobe Bemalung in
 * Knochenweiss. Alles in flachen Toenen: Schatten sind Flaechen, Schweissraupen und Kratzer beschreiben Material,
 * keine Schraffur. Die Fahrzeugfarbe kommt aus der Vertexfarbe (look.ts), die Zellen sind fraktionsneutral.
 * Built from scrap: mismatched plates with weld beads, riveted patch plates, rust, soot, crude paint in bone white.
 * All in flat tones: shadows are areas, weld beads and scratches describe material, no hatching. The vehicle colour
 * comes from the vertex colour (look.ts), the cells are faction neutral.
 */
import { rng } from '../kit';
import { mat } from '../look';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { emblemCells } from './emblem';
import { crewCells } from './figurePaint';
import { BARE, MUD_DRY, MUD_WET, SOOT, STEEL, streaks, trimCells } from './trim';

const BONE = mat.bone;
const RUST = mat.rustDark;
const TAU = Math.PI * 2;

// ---------- Zeichenhilfen / drawing helpers ----------

/** Flickblech: abgesetzte Platte mit Nieten in den Ecken / patch plate: set-off plate with rivets in the corners */
function patch(p: Pen, x: number, y: number, w: number, h: number, tone = 0.84): void {
  const r = rrect(x, y, w, h, 3);
  p.shade(r, tone, 0.9);
  p.line(r, 1.7, { closed: true, wobble: 0.4, press: 0.3 });
  p.crease([[x + 3, y + h + 1.5], [x + w, y + h + 1.5]], 1.3, 1.5, 0.7, { taper: 0.1 });
  for (const [dx, dy] of [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5]] as Pt[]) p.rivet(x + dx, y + dy, 2.3);
}
/** Grober Pinselstrich in Knochenweiss / crude brush stroke in bone white */
function daub(p: Pen, pts: Pt[], w: number, seed: number): void {
  p.mark(pts, w, BONE, 0.92, { taper: 0.3, wobble: 1.2, press: 0.5, seed });
}
/** Rostflecken an einer Kante / rust stains along an edge */
function rust(p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number): void {
  p.splatter(x, y, w, h, n, RUST, seed, { size: 4.4, alpha: 0.6, rise: 1.4 });
}
/** Sehschlitz: dunkle Oeffnung mit Glut dahinter und Panzerlamellen davor / vision slit: dark opening with ember glow behind and armour louvres in front */
function slit(p: Pen, x: number, y: number, w: number, h: number, bars: number): void {
  p.fill(rrect(x, y, w, h, 2), SOOT);
  p.mark([[x + 4, y + h / 2], [x + w - 4, y + h / 2]], h * 0.36, mat.ember, 0.95, { taper: 0.15, wobble: 0.3, press: 0.2 });
  for (let i = 1; i <= bars; i++) {
    const bx = x + (i / (bars + 1)) * w;
    p.mark([[bx, y - 1], [bx, y + h + 1]], 3.4, mat.rust, 1, { taper: 0, wobble: 0.2, press: 0 });
  }
  p.line(rrect(x, y, w, h, 2), 1.8, { closed: true, wobble: 0.3 });
}

// ---------- Zellen / cells ----------

/** Lange Seitenwand (448 x 80): drei ungleiche Platten, Flickblech, Krallenspuren / long side wall: three mismatched plates, patch plate, claw marks */
function paintSide(p: Pen): void {
  const W = p.w, H = p.h;
  p.shade([[0, 0], [132, 0], [140, H], [0, H]], 0.9, 0.8);
  p.shade([[300, 0], [W, 0], [W, H], [306, H]], 1.1, 0.7);
  p.weld([132, 3], [140, H - 6], 4.6);
  p.weld([300, 3], [306, H - 6], 4.6);
  patch(p, 176, 26, 76, 34);
  // drei Krallenspuren in Knochenweiss / three claw marks in bone white
  for (let i = 0; i < 3; i++) daub(p, [[36 + i * 22, 14], [28 + i * 22, 40], [34 + i * 22, 62]], 8, 601 + i);
  p.rivets([150, 9], [292, 9], 7, 2.4);
  p.rivets([316, 9], [W - 10, 9], 5, 2.4);
  // Russ am Heck, Rost von oben, Schlamm unten / soot at the stern, rust from the top, mud below
  p.gradient(W - 70, 0, 70, H, [W - 70, 0], [W, 0], 1, 0.62, 0.8);
  p.splatter(W - 60, 0, 60, H, 12, SOOT, 607, { size: 5, alpha: 0.5, rise: 0.8 });
  streaks(p, 150, 4, 150, H - 20, 5, 609);
  rust(p, 0, 0, W, 16, 12, 611);
  p.scratches(320, 20, 100, 40, 5, 613, 22);
  p.chips(0, H - 12, W, 8, 12, BARE, 615, 3);
  p.mud(0, H * 0.55, W, H * 0.45, MUD_WET, MUD_DRY, 617, 0.4);
}

/** Motorhaube von oben (176 x 160): Mittelnaht, Kiemen, Flickblech / hood from above: centre weld, gills, patch plate */
function paintHood(p: Pen): void {
  const W = p.w, H = p.h;
  p.weld([W / 2, 6], [W / 2 + 2, H - 8], 4.4);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = W / 2 + s * 46 - 17, y = 28 + i * 16;
    p.fill(rrect(x, y, 34, 7, 2), SOOT, 0.95);
    p.line(rrect(x, y, 34, 7, 2), 1.4, { closed: true, wobble: 0.25 });
    p.crease([[x + 2, y + 9], [x + 32, y + 9]], 1.2, 1.5, 0.7, { taper: 0.1 });
  }
  patch(p, 18, 98, 52, 38);
  daub(p, [[112, 96], [128, 118], [150, 104]], 7, 621);
  p.rivets([10, H - 10], [W - 10, H - 10], 8, 2.4);
  p.gradient(0, H - 34, W, 34, [0, H - 34], [0, H], 1, 0.7, 0.8);
  p.splatter(0, H - 40, W, 40, 10, SOOT, 623, { size: 4.6, alpha: 0.45, rise: 0.8 });
  rust(p, 0, 0, W, 18, 8, 625);
  p.chips(0, 0, W, 8, 10, BARE, 627, 3);
  p.scratches(80, 20, 80, 60, 4, 629, 20);
}

/** Bug- und Heckblech (192 x 72): Kuehlerschlitze, Bolzen, Schlamm / front and rear plate: radiator slots, bolts, mud */
function paintNose(p: Pen): void {
  const W = p.w, H = p.h;
  p.weld([8, 5], [W - 8, 6], 4.2);
  for (let i = 0; i < 5; i++) {
    const x = W / 2 - 44 + i * 18;
    p.fill(rrect(x, 16, 9, 30, 2), SOOT, 0.95);
    p.line(rrect(x, 16, 9, 30, 2), 1.4, { closed: true, wobble: 0.25 });
  }
  for (const s of [-1, 1]) { p.rivet(W / 2 + s * 70, 18, 2.6); p.rivet(W / 2 + s * 70, 40, 2.6); }
  rust(p, 0, 6, W, 20, 8, 631);
  p.chips(0, H - 14, W, 8, 8, BARE, 633, 3);
  p.mud(0, H * 0.45, W, H * 0.55, MUD_WET, MUD_DRY, 635, 0.42);
}

/** Kleines Schrottblech (128 x 72) fuer Ladewaende, Daecher, Kotfluegel / small scrap plate for bed walls, roofs, fenders */
function paintPatch(p: Pen): void {
  const W = p.w, H = p.h;
  p.weld([4, 5], [W - 4, 6], 4);
  patch(p, 70, 22, 44, 30);
  daub(p, [[16, 20], [30, 44], [22, 60]], 6.5, 641);
  p.rivets([10, H - 9], [60, H - 9], 4, 2.3);
  streaks(p, 0, 8, 64, H - 20, 2, 643);
  rust(p, 0, 0, W, 14, 6, 645);
  p.chips(0, H - 10, W, 7, 6, BARE, 647, 2.8);
}

/** Fuehrerhaus von vorn (192 x 80): Sehschlitz mit Glut, Nietenreihe / cab from the front: vision slit with ember glow, rivet row */
function paintCab(p: Pen): void {
  const W = p.w, H = p.h;
  p.rivets([12, 10], [W - 12, 10], 9, 2.5);
  slit(p, 22, 24, W - 44, 20, 5);
  p.weld([10, 56], [W - 10, 57], 4.2);
  p.shade([[0, 58], [W, 58], [W, H], [0, H]], 0.9, 0.7);
  daub(p, [[30, 62], [44, 74]], 6, 651);
  rust(p, 0, 44, W, 14, 8, 653);
  p.chips(0, H - 10, W, 7, 8, BARE, 655, 2.8);
}

/** Tuer von der Seite (96 x 88): Fuge, Sehschlitz, Griff / door from the side: joint, vision slit, handle */
function paintDoor(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(8, 8, W - 16, H - 14, 5).concat([[W - 14, 8]]), 1.8);
  p.fill(rrect(20, 18, W - 40, 13, 2), SOOT);
  p.line(rrect(20, 18, W - 40, 13, 2), 1.7, { closed: true, wobble: 0.3 });
  p.line(spline([[W - 34, 52], [W - 26, 48], [W - 18, 52]], 4), 2.6, { taper: 0.15 });
  for (const y of [24, 62]) { p.fill(rrect(4, y, 8, 11, 2), BARE); p.line(rrect(4, y, 8, 11, 2), 1.3, { closed: true, wobble: 0.1 }); }
  streaks(p, 20, 32, W - 40, H - 46, 2, 661);
  rust(p, 0, 0, W, 12, 5, 663);
  p.mud(0, H * 0.7, W, H * 0.3, MUD_WET, MUD_DRY, 665, 0.4);
}

/**
 * Stachelschaufel von vorn (448 x 160): drei verschweisste Platten, grobe Strahlen um das Emblem, viele Schrammen
 * unten, Schlammkruste. Die Mitte bleibt fuer das Emblem frei.
 * Spiked blade from the front: three welded plates, crude rays around the emblem, many scrapes low down, mud crust.
 * The centre stays free for the emblem.
 */
function paintBlade(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, cy = 66;
  p.shade([[0, 0], [146, 0], [152, H], [0, H]], 0.9, 0.8);
  p.shade([[298, 0], [W, 0], [W, H], [292, H]], 0.92, 0.8);
  p.weld([146, 4], [152, H - 10], 5);
  p.weld([298, 4], [292, H - 10], 5);
  p.rivets([12, 10], [W - 12, 10], 14, 2.8);
  // grobe Strahlen um die Mitte / crude rays around the centre
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    daub(p, [[cx + Math.cos(a) * 46, cy + Math.sin(a) * 40], [cx + Math.cos(a) * 68, cy + Math.sin(a) * 58]], 9, 671 + i);
  }
  patch(p, 40, 34, 64, 42);
  patch(p, 352, 70, 56, 36, 0.88);
  // Schrammen vom Raeumen, Rost, abgeplatzte Kante, Schlamm / scrapes from clearing, rust, chipped edge, mud
  const R = rng(681);
  for (let i = 0; i < 12; i++) {
    const x = 12 + R() * (W - 60), y = 96 + R() * 36, l = 18 + R() * 30;
    p.crease([[x, y], [x + l, y + (R() - 0.5) * 6]], 1.6, 1.6, 0.85, { taper: 0.4, wobble: 0.6 });
  }
  streaks(p, 0, 12, W, 70, 9, 683);
  rust(p, 0, 0, W, 22, 16, 685);
  p.chips(0, H - 18, W, 10, 22, BARE, 687, 3.4);
  p.mud(0, H * 0.62, W, H * 0.38, MUD_WET, MUD_DRY, 689, 0.36);
}

/** Deck der Raupe von oben (192 x 304): Platten, Naehte, Russ an den Schloten (Heck unten) / crawler deck from above: plates, seams, soot at the stacks (stern at the bottom) */
function paintDeck(p: Pen): void {
  const W = p.w, H = p.h;
  p.weld([6, 96], [W - 6, 98], 4.4);
  p.weld([W / 2, 100], [W / 2 + 2, H - 8], 4.4);
  p.shade([[0, 98], [W / 2, 98], [W / 2, H], [0, H]], 0.9, 0.7);
  patch(p, 20, 116, 50, 40);
  p.rivets([12, 10], [W - 12, 10], 8, 2.5);
  p.rivets([12, H - 10], [W - 12, H - 10], 8, 2.5);
  for (const x of [34, W - 34]) {
    p.gradient(x - 30, H - 86, 60, 86, [x, H - 86], [x, H - 30], 1, 0.55, 0.8);
    p.splatter(x - 32, H - 96, 64, 80, 14, SOOT, 691 + x, { size: 6, alpha: 0.55, rise: 0.7 });
  }
  daub(p, [[120, 150], [138, 176], [160, 158]], 7, 693);
  rust(p, 0, 100, W, 30, 8, 695);
  p.scratches(100, 190, 80, 60, 4, 697, 22);
  p.chips(0, 0, W, 8, 8, BARE, 699, 3);
}

/** Seitenblech des Raketengestells (256 x 112), dunkel: helle Kanten, Strichliste in Knochenweiss / rocket rack side plate, dark: light edges, tally marks in bone white */
function paintRack(p: Pen): void {
  const W = p.w, H = p.h;
  p.crease(rrect(5, 5, W - 10, H - 10, 5).concat([[W - 12, 5]]), 1.8, 1.9, 0.8, { taper: 0 });
  for (let i = 0; i < 7; i++) p.spot(22 + i * 35, 14, 2.4, STEEL);
  for (let i = 0; i < 7; i++) p.spot(22 + i * 35, H - 14, 2.4, STEEL);
  // Strichliste: vier Striche und ein Querstrich / tally: four strokes and one across
  for (let i = 0; i < 4; i++) daub(p, [[60 + i * 13, 36], [58 + i * 13, 76]], 5, 701 + i);
  daub(p, [[50, 66], [108, 44]], 5, 707);
  p.splatter(0, 0, W, H, 16, RUST, 709, { size: 5, alpha: 0.6, rise: 1 });
  p.splatter(W - 80, 0, 80, H, 10, SOOT, 711, { size: 6, alpha: 0.6, rise: 1 });
}

/** Rakete (96 x 160): s rundum (oben Mitte), t Heck -> Spitze; Schweissnaht, grobe Ringe, Russ am Heck / rocket: s around (top centre), t tail -> tip; weld seam, crude rings, soot at the tail */
function paintRocket(p: Pen): void {
  const W = p.w, H = p.h;
  p.weld([W / 2, 22], [W / 2 + 1, 96], 3.6);
  for (const y of [58, 70]) p.mark([[-2, y], [W + 2, y]], 5, BONE, 0.9, { taper: 0, wobble: 0.8, press: 0.4, seed: 713 + y });
  p.line([[-2, 101], [W + 2, 101]], 1.6, { taper: 0, wobble: 0.3 });
  p.gradient(0, 0, W, 26, [0, 0], [0, 26], 0.5, 1);
  p.splatter(0, 0, W, 40, 8, SOOT, 717, { size: 4, alpha: 0.5, rise: 0.6 });
  rust(p, 0, 30, W, 60, 7, 719);
  p.chips(0, H - 40, W, 30, 4, BARE, 721, 2.4);
}

/** Dach des Glockenturms (192 x 64): vier Blechbahnen, Flicken, ausgefranste Traufe / bell tower roof: four sheet strips, patches, ragged eaves */
function paintRoof(p: Pen): void {
  const W = p.w, H = p.h;
  for (let i = 0; i < 4; i++) {
    const x = i * 48;
    p.panel([[x + 1, 6], [x + 1, H - 2]], 1.6);
    p.line(spline([[x + 5, 34], [x + 24, 30 + (i % 2) * 6], [x + 44, 35]], 4), 1.5, { taper: 0.1, wobble: 0.5 });
  }
  patch(p, 58, 38, 28, 18, 0.8);
  p.gradient(0, 0, W, 20, [0, 0], [0, 20], 0.6, 1);
  rust(p, 0, H - 22, W, 22, 10, 723);
  p.chips(0, H - 9, W, 7, 12, BARE, 725, 3);
}

/** Glocke (128 x 64): Zierbaender, Delle, Russ am Rand / bell: bands, dent, soot at the lip */
function paintBell(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [22, 46]) { p.line([[-2, y], [W + 2, y]], 1.6, { taper: 0, wobble: 0.3 }); p.crease([[0, y + 2.4], [W, y + 2.4]], 1.4, 1.6, 0.8, { taper: 0, wobble: 0.3 }); }
  p.dab(W * 0.62, 34, 9, 0.8, 0.8);
  p.line(spline([[W * 0.3, 26], [W * 0.33, 36], [W * 0.31, 44]], 4), 1.3, { taper: 0.4, wobble: 0.4 });
  p.gradient(0, H - 12, W, 15, [0, H - 12], [0, H], 1, 0.6);
  p.splatter(0, H - 16, W, 16, 6, SOOT, 727, { size: 3.4, alpha: 0.5, rise: 0.8 });
}

/** Banner (96 x 112): Saum, Falten, Flicken, Russ und Risse am unteren Rand / banner: hem, folds, patch, soot and tears at the lower edge */
function paintBanner(p: Pen): void {
  const W = p.w, H = p.h;
  p.shade([[0, 0], [W, 0], [W, 9], [0, 9]], 0.78, 0.9);
  p.stitch([[4, 12], [W - 4, 12]], 4, 3.2, 1.2, 0.5);
  for (const x of [22, 70]) p.line(spline([[x, 16], [x + 4, H * 0.5], [x - 2, H - 16]], 4), 1.4, { taper: 0.4, wobble: 0.6 });
  p.shade(rrect(54, 62, 26, 22, 2), 0.82, 0.9);
  p.stitch([[54, 62], [80, 62], [80, 84], [54, 84], [54, 62]], 3.4, 2.8, 1.1, 0.5);
  p.gradient(0, H - 34, W, 34, [0, H - 34], [0, H], 1, 0.66, 0.9);
  p.splatter(0, H - 40, W, 40, 9, SOOT, 729, { size: 4.4, alpha: 0.5, rise: 0.8 });
  for (const x of [14, 44, 82]) p.line([[x, H - 2], [x + 3, H - 18]], 1.4, { taper: 0.5, wobble: 0.4 });
}

/** Schaedel (96 x 64): s rundum (vorn Mitte), t Scheitel -> Kiefer / skull: s around (front centre), t crown -> jaw */
function paintSkull(p: Pen): void {
  const W = p.w, cx = W / 2;
  for (const s of [-1, 1]) {
    const eye = spline([[cx + s * 2.5, 26], [cx + s * 8, 21], [cx + s * 13, 27], [cx + s * 9, 35], [cx + s * 3.5, 33]], 4, true);
    p.blot(eye);
  }
  p.blot([[cx, 36], [cx + 3, 43], [cx - 3, 43]]);
  p.line([[cx - 9, 49], [cx + 9, 49]], 1.5, { taper: 0.1, wobble: 0.2 });
  for (const dx of [-5, 0, 5]) p.line([[cx + dx, 46], [cx + dx, 54]], 1.2, { taper: 0.2, wobble: 0.1 });
  p.line(spline([[cx - 6, 6], [cx - 3, 13], [cx - 7, 18]], 4), 1.1, { taper: 0.4, wobble: 0.3 });
  p.shade(arc(cx, 52, 16, 9, 0, Math.PI, 10), 0.84, 0.8);
}

/** Zellen des Schrott-Atlas: Fahrzeug-Baukasten (Auswahl), Besatzung, Embleme, eigene Flaechen / cells of the scrap atlas: vehicle kit (selection), crew, emblems, own surfaces */
export function scrapCells(): Cell[] {
  const kit = new Set(['grille', 'wheel', 'sprocket', 'link', 'linkSide', 'tyre', 'bay', 'exhaust', 'crate', 'tarp']);
  return [
    ...trimCells().filter((c) => kit.has(c.name)),
    ...crewCells(0.5),
    ...emblemCells(48),
    { name: 'sSide', w: 448, h: 80, paint: paintSide },
    { name: 'sHood', w: 176, h: 160, paint: paintHood },
    { name: 'sNose', w: 192, h: 72, paint: paintNose },
    { name: 'sPatch', w: 128, h: 72, paint: paintPatch },
    { name: 'sCab', w: 192, h: 80, paint: paintCab },
    { name: 'sDoor', w: 96, h: 88, paint: paintDoor },
    { name: 'sBlade', w: 448, h: 160, paint: paintBlade },
    { name: 'sDeck', w: 192, h: 304, paint: paintDeck },
    { name: 'sRack', w: 256, h: 112, paint: paintRack },
    { name: 'sRocket', w: 96, h: 160, paint: paintRocket },
    { name: 'sRoof', w: 192, h: 64, paint: paintRoof },
    { name: 'sBell', w: 128, h: 64, paint: paintBell },
    { name: 'sBanner', w: 96, h: 112, paint: paintBanner },
    { name: 'skull', w: 96, h: 64, paint: paintSkull },
  ];
}
