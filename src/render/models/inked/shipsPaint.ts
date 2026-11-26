/**
 * Gezeichnete Einheiten: Zeichnung der Kriegsschiffe (Atlas 'ship') / inked units: drawing of the warships (atlas 'ship').
 *
 * Bordwand mit Plattenstoessen, Bullaugen, Anker und Wasserpass; Stahldeck des Zerstoerers mit Hubschrauberdeck und
 * Ankerketten; Plankendeck des Schlachtschiffs; Waende der Aufbauten mit Fensterband, Schotttueren und Leitern;
 * Schornstein, Turm, Rohr. Alles in neutralen Farben: die Farbe der Fraktion kommt aus der Vertexfarbe.
 * Ship side with plate butts, portholes, anchor and boot topping; the destroyer's steel deck with helideck and anchor
 * chains; the battleship's plank deck; superstructure walls with a window band, watertight doors and ladders; funnel,
 * turret, barrel. All in neutral colours: the faction colour comes from the vertex colour.
 */
import { rng } from '../kit';
import { mat } from '../look';
import { rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { anchor, edgeChips, hatchDoor, ladder, lifeRing, planks, plating, porthole, rect, ring, rustRuns, slots, windowBand } from './navalPaint';
import { BATTLESHIP, DESTROYER, SIDE_T, SUB, type ShipDims } from './ships';
import { BARE, SOOT, stencil, streaks } from './trim';

/** Bordwand (512 x 72): s Bug -> Heck, t Dollbord -> Kiel / ship side: s bow -> stern, t gunwale -> keel */
export function paintHullSide(p: Pen, seed = 501): void {
  const W = p.w, H = p.h, R = rng(seed);
  const y0 = H * SIDE_T.trim, wl = H * SIDE_T.water;
  // Zierstreifen: Unterkante, darunter Schlagschatten / trim stripe: lower edge, cast shadow below
  p.shade(rect(0, y0, W, 4), 0.84, 0.8);
  p.line([[-3, y0], [W + 3, y0]], 1.4, { taper: 0, wobble: 0.2 });
  plating(p, 0, y0 + 2, W, wl - y0 - 4, (wl - y0) * 0.5, seed + 1, 86);
  p.rivets([10, y0 + 5.5], [W - 10, y0 + 5.5], 22, 1.5);
  // Bullaugen in Gruppen; Platz fuer Emblem und Kennnummer bleibt frei / portholes in groups; room for emblem and number stays clear
  const ports: Pt[] = [];
  for (let x = 236; x < W - 26; x += 25 + R() * 4) { if (R() < 0.24) continue; ports.push([x, y0 + 13.5]); }
  for (const [x, y] of ports) porthole(p, x, y, 3.3);
  anchor(p, 44, y0 + 17, 8.5);
  // Wasserpass: Tuschelinie, heller Rand, Bewuchs / boot topping: ink line, light edge, growth
  p.line([[-3, wl], [W + 3, wl]], 1.5, { taper: 0, wobble: 0.3, press: 0.3 });
  p.crease([[0, wl + 3.2], [W, wl + 3.2]], 1.6, 1.5, 0.7, { taper: 0, wobble: 0.5 });
  p.splatter(0, wl - 6, W, 7, 26, mat.rustDark, seed + 3, { size: 2.2, rise: 1.4, alpha: 0.45 });
  rustRuns(p, ports.filter((_, i) => i % 3 === 0).map(([x, y]): Pt => [x, y + 4]), 16, seed + 5);
  rustRuns(p, [[40, y0 + 26], [48, y0 + 26]], 14, seed + 6);
  streaks(p, 0, y0 + 3, W, (wl - y0) * 0.6, 12, seed + 7);
  edgeChips(p, 0, y0 + 2, 26, wl - y0 - 4, 7, seed + 9);
  edgeChips(p, 0, wl - 5, W, 4, 16, seed + 11);
  p.scratches(60, y0 + 6, W - 80, wl - y0 - 14, 9, seed + 13, 22);
}

/** Deckskoordinaten: z -> x, quer -> y / deck coordinates: z -> x, across -> y */
export function deckMap(p: Pen, D: { z0: number; z1: number; beam: number; inset: number }) {
  const W = p.w, H = p.h;
  return { X: (z: number) => ((z - D.z0) / (D.z1 - D.z0)) * W, Y: (x: number) => H * (0.5 - x / (D.beam * D.inset)), k: W / (D.z1 - D.z0) };
}

/** Ankerketten vom Spill zu den Klusen / anchor chains from the windlass to the hawse pipes */
function chains(p: Pen, X: (z: number) => number, Y: (x: number) => number, z: number, bow: number, k: number): void {
  p.fill(ring(X(z), Y(0), 0.016 * k, 12), SOOT, 0.85);
  p.line(ring(X(z), Y(0), 0.016 * k, 12), 1.5, { closed: true, wobble: 0.1 });
  for (const s of [-1, 1]) {
    const pts: Pt[] = [[X(z + 0.008), Y(s * 0.008)], [X(z + bow * 0.5), Y(s * 0.022)], [X(z + bow), Y(s * 0.03)]];
    p.line(spline(pts, 5), 2.1, { taper: 0.05, wobble: 0.25, press: 0.5 });
    p.fill(ring(pts[2][0], pts[2][1], 3.2, 8), SOOT);
    p.line(ring(pts[2][0], pts[2][1], 3.2, 8), 1.2, { closed: true, wobble: 0 });
  }
}

/** Doppelpoller am Decksrand / twin bitts at the deck edge */
export function bitts(p: Pen, x: number, y: number): void {
  p.shade(rrect(x - 7, y - 3.5, 14, 7, 2), 0.8, 0.9);
  p.line(rrect(x - 7, y - 3.5, 14, 7, 2), 1.1, { closed: true, wobble: 0.1 });
  for (const dx of [-3.4, 3.4]) { p.fill(ring(x + dx, y, 2.1, 8), SOOT); p.dab(x + dx - 0.6, y - 0.6, 0.8, 2.2, 0.8); }
}

/** Decksluke / deck hatch */
export function deckHatch(p: Pen, x: number, y: number, w: number, h: number): void {
  p.shade(rrect(x - w / 2 + 1.5, y - h / 2 + 2, w, h, 2), 0.78, 0.7);
  p.shade(rrect(x - w / 2, y - h / 2, w, h, 2), 0.9, 0.9);
  p.line(rrect(x - w / 2, y - h / 2, w, h, 2), 1.4, { closed: true, wobble: 0.12 });
  p.line([[x - w * 0.2, y], [x + w * 0.2, y]], 1.5, { taper: 0.1 });
}

/** Stahldeck des Zerstoerers (496 x 112) / the destroyer's steel deck */
function paintDeckDestroyer(p: Pen): void {
  const D: ShipDims = DESTROYER;
  const { X, Y, k } = deckMap(p, D);
  const W = p.w, H = p.h;
  // Laengsnaehte und wenige Quernaehte der Decksplatten / long seams and a few butt seams of the deck plates
  for (const x of [-0.045, 0.045]) p.line([[X(D.z0 + 0.02), Y(x)], [X(D.z1 - D.bow - 0.02), Y(x)]], 1, { taper: 0.05, wobble: 0.4, press: 0.4 });
  for (const z of [-0.31, -0.15, 0.17, 0.29]) p.line([[X(z), Y(-0.1)], [X(z) + 1, Y(0.1)]], 1, { taper: 0.15, wobble: 0.3 });
  // Wasserbombenschienen am Heck mit Tonnen / depth charge rails at the stern with drums
  for (const s of [-1, 1]) {
    const y = Y(s * 0.052);
    for (const dy of [-4.5, 4.5]) p.line([[X(-0.392), y + dy], [X(-0.335), y + dy]], 1.3, { taper: 0.05, wobble: 0.15 });
    for (let i = 0; i < 3; i++) { const x = X(-0.385 + i * 0.016); p.fill(ring(x, y, 3.6, 10), SOOT, 0.9); p.line(ring(x, y, 3.6, 10), 1.2, { closed: true, wobble: 0.1 }); p.dab(x - 1, y - 1, 1.2, 2, 0.8); }
  }
  // Startbehaelter: vier Luken vor dem Aufbau / launcher: four hatches in front of the superstructure
  for (const dz of [-0.012, 0.012]) for (const dx of [-0.014, 0.014]) deckHatch(p, X(0.167 + dz), Y(dx), 0.02 * k, 0.022 * k);
  // Wellenbrecher, Ankerspill und Ketten / breakwater, windlass and chains
  p.panel([[X(0.292), Y(0.085)], [X(0.305), Y(0)], [X(0.292), Y(-0.085)]], 1.8, 521);
  chains(p, X, Y, 0.318, 0.045, k);
  bitts(p, X(0.2), Y(0.085)); bitts(p, X(0.2), Y(-0.085));
  bitts(p, X(-0.32), Y(0.09)); bitts(p, X(-0.32), Y(-0.09));
  deckHatch(p, X(-0.245), Y(0.07), 12, 10);
  deckHatch(p, X(-0.16), Y(-0.07), 12, 10);
  // Wasserlauf an der Decksseite, Abrieb / waterway at the deck side, wear
  for (const s of [-1, 1]) p.crease([[X(D.z0 + 0.03), Y(s * 0.098)], [X(D.z1 - D.bow), Y(s * 0.098)]], 2.4, 0.84, 0.7, { taper: 0.05, wobble: 0.3 });
  p.scratches(20, 10, W - 120, H - 20, 9, 523, 24);
  p.splatter(0, 0, W, H, 8, mat.rustDark, 525, { size: 2.4, rise: 1, alpha: 0.35 });
}

/** Plankendeck des Schlachtschiffs (440 x 220) / the battleship's plank deck */
function paintDeckBattleship(p: Pen): void {
  const D: ShipDims = BATTLESHIP;
  const { X, Y, k } = deckMap(p, D);
  const W = p.w, H = p.h;
  planks(p, 0, H * 0.04, W, H * 0.92, 12, 531, 130);
  // Stahlflaeche unter Aufbau und Schornstein, Leibholz am Rand / steel area below superstructure and funnel, margin plank at the edge
  const steel = rrect(X(-0.19), Y(0.15), X(0.1) - X(-0.19), Y(-0.15) - Y(0.15), 10);
  p.fill(steel, mat.metalLight, 0.96);
  p.line(steel, 1.6, { closed: true, wobble: 0.2 });
  p.rivets([X(-0.18), Y(0.14) + 5], [X(0.09), Y(0.14) + 5], 9, 1.6);
  p.rivets([X(-0.18), Y(-0.14) - 5], [X(0.09), Y(-0.14) - 5], 9, 1.6);
  for (const s of [-1, 1]) p.line([[X(D.z0 + 0.04), Y(s * 0.196)], [X(D.z1 - D.bow), Y(s * 0.196)]], 1.3, { taper: 0.04, wobble: 0.3 });
  // Barbetten: dunkler Ring um jeden Turm / barbettes: a dark ring around each turret
  for (const z of [0.25, -0.25]) { p.shade(ring(X(z), Y(0), 0.066 * k, 22, 0.094 * k), 0.82, 0.8); p.line(ring(X(z), Y(0), 0.066 * k, 22, 0.094 * k), 1.5, { closed: true, wobble: 0.2 }); }
  chains(p, X, Y, 0.34, 0.06, k);
  p.panel([[X(0.318), Y(0.14)], [X(0.33), Y(0)], [X(0.318), Y(-0.14)]], 1.8, 533);
  for (const s of [-1, 1]) { bitts(p, X(0.3), Y(s * 0.15)); bitts(p, X(-0.4), Y(s * 0.14)); deckHatch(p, X(0.2), Y(s * 0.16), 12, 11); deckHatch(p, X(-0.31), Y(s * 0.12), 13, 12); }
  // Luefterpilze / mushroom vents
  for (const [z, x] of [[-0.21, 0.17], [-0.21, -0.17], [0.13, 0.18], [0.13, -0.18]]) { p.shade(ring(X(z) + 1.5, Y(x) + 2, 4.2, 10), 0.75, 0.7); p.fill(ring(X(z), Y(x), 4, 10), mat.paper); p.line(ring(X(z), Y(x), 4, 10), 1.2, { closed: true, wobble: 0.1 }); }
  p.splatter(0, 0, W, H, 7, SOOT, 535, { size: 2.6, rise: 1, alpha: 0.25 });
}

/** Oberdeck des U-Boots (496 x 36): Holzroste, Luken, Klampen / the submarine's casing deck: wooden gratings, hatches, cleats */
function paintDeckSub(p: Pen): void {
  const W = p.w, H = p.h;
  const X = (z: number) => ((z - SUB.z0) / (SUB.z1 - SUB.z0)) * W;
  planks(p, X(-0.36), 6, X(0.36) - X(-0.36), H - 12, 3, 541, 90);
  for (const z of [-0.26, -0.13, 0.23, 0.31]) {
    p.shade(ring(X(z), H / 2, 6.5, 14), 0.84, 0.9);
    p.line(ring(X(z), H / 2, 6.5, 14), 1.5, { closed: true, wobble: 0.1 });
    p.line([[X(z) - 3, H / 2], [X(z) + 3, H / 2]], 1.6, { taper: 0.1 });
  }
  for (const z of [-0.33, 0.37]) for (const dy of [-5, 5]) p.line([[X(z) - 3, H / 2 + dy], [X(z) + 3, H / 2 + dy]], 2, { taper: 0, wobble: 0 });
}

/** Seite des U-Boots (512 x 80): s Bug -> Heck, t Oberdeck -> Kiel / the submarine's side: s bow -> stern, t casing -> keel */
function paintSubSide(p: Pen): void {
  const W = p.w, H = p.h, R = rng(551);
  const wl = H * 0.8;
  // Flutschlitze unter dem Oberdeck, in Gruppen / flood holes below the casing, in groups
  const holes: Pt[] = [];
  for (let x = 46; x < W - 46; x += 19 + R() * 5) { if (R() < 0.22) continue; holes.push([x, 11]); }
  for (const [x, y] of holes) { p.fill(rrect(x, y, 10, 3.4, 1.4), SOOT); p.crease([[x, y + 5], [x + 10, y + 5]], 1, 1.5, 0.7, { taper: 0.1, wobble: 0 }); }
  p.panel([[20, 22], [W - 20, 22]], 1.3, 553);
  for (let x = 70 + R() * 30; x < W - 40; x += 70 + R() * 50) p.line([[x, 23], [x + (R() - 0.5) * 2, wl - 2]], 1.1, { taper: 0.15, wobble: 0.25 });
  // Sonarfeld und Torpedoklappe am Bug, Tiefgangsmarken / sonar panel and torpedo door at the bow, draught marks
  p.shade(rrect(74, 34, 46, 16, 5), 0.86, 0.9);
  p.line(rrect(74, 34, 46, 16, 5), 1.4, { closed: true, wobble: 0.15 });
  p.line(ring(42, 44, 9, 14, 6), 1.4, { closed: true, wobble: 0.15 });
  for (const x of [24, W - 22]) for (let i = 0; i < 3; i++) p.fill(rect(x, wl - 8 - i * 7, 6, 2), mat.paper, 0.9);
  p.line([[-3, wl], [W + 3, wl]], 1.5, { taper: 0, wobble: 0.3, press: 0.3 });
  p.crease([[0, wl + 3.4], [W, wl + 3.4]], 1.6, 1.5, 0.7, { taper: 0, wobble: 0.5 });
  rustRuns(p, holes.filter((_, i) => i % 4 === 1).map(([x, y]): Pt => [x + 5, y + 4]), 22, 555);
  streaks(p, 0, 24, W, wl - 30, 10, 557);
  edgeChips(p, 0, wl - 5, W, 4, 14, 559);
}

/** Turmwand des U-Boots (320 x 112): s rundum (vorn in der Mitte), t Oberkante -> Deck / sail wall: s around (front in the middle), t top -> deck */
function paintSail(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel([[0, 27], [W, 27]], 1.3, 561);
  // Brueckenfenster vorn, Bullaugen an den vorderen Vierteln / bridge windows at the front, portholes on the front quarters
  windowBand(p, W / 2 - 24, 33, 48, 10, 3, mat.glassDark);
  for (const x of [112, W - 112]) porthole(p, x, 66, 4);
  // Steigeisen und Tuer hinten / step irons and door at the back
  ladder(p, 6, 30, H - 6, 8, 8);
  hatchDoor(p, W - 30, 56, 18, 46);
  p.rivets([36, H - 9], [W - 44, H - 9], 16, 1.7);
  rustRuns(p, [[112, 71], [W - 112, 71], [W / 2 - 20, 44], [W / 2 + 22, 44]], 26, 563);
  streaks(p, 30, 28, W - 60, H - 40, 8, 565);
  edgeChips(p, 0, H - 6, W, 5, 12, 567);
}

/** Turmdach des U-Boots (96 x 96): Brueckenwanne mit Suell / sail top: bridge well with a coaming */
function paintSailTop(p: Pen): void {
  const c = p.w / 2;
  p.shade(ring(c, c, 30, 20, 42), 0.72, 0.9);
  p.line(ring(c, c, 30, 20, 42), 1.8, { closed: true, wobble: 0.15 });
  p.line(ring(c, c, 35, 22, 46), 1.1, { closed: true, wobble: 0.15 });
}

/** Wand eines Aufbaus (448 x 96): s rundum, t Dachkante -> Deck; obere Haelfte ruhig (dort liegt das Farbband der verjuengten Bauformen) / superstructure wall: s around, t eave -> deck; upper half calm (the colour band of the tapered styles lies there) */
export function paintHouse(p: Pen): void {
  const W = p.w, H = p.h;
  p.shade(rect(0, 8, W, 5), 0.82, 0.8);
  p.line([[-3, 8], [W + 3, 8]], 1.4, { taper: 0, wobble: 0.2 });
  for (const x of [40, 150, 190, 258, 298, 408]) porthole(p, x, 56, 4.2);
  for (const x of [112, 336]) hatchDoor(p, x - 9, 48, 18, 42);
  ladder(p, W - 16, 14, H - 4, 8, 7.5);
  // Feuerloeschkasten, Kabelkanal / fire hose box, cable duct
  p.fill(rrect(68, 62, 11, 13, 2), mat.red);
  p.line(rrect(68, 62, 11, 13, 2), 1.2, { closed: true, wobble: 0.1 });
  p.panel([[214, 44], [240, 44], [240, 84], [260, 84]], 1.2, 571);
  p.line([[-3, H - 3], [W + 3, H - 3]], 1.3, { taper: 0, wobble: 0.3 });
  rustRuns(p, [[40, 61], [190, 61], [298, 61], [408, 61], [121, 90]], 22, 573);
  edgeChips(p, 0, H - 8, W, 6, 14, 575);
}

/** Brueckenwand (448 x 96): Fensterband vorn und an den Seiten, Rettungsringe / bridge wall: window band front and sides, life rings */
export function paintBridge(p: Pen): void {
  const W = p.w, H = p.h;
  p.shade(rect(0, 8, W, 5), 0.82, 0.8);
  p.line([[-3, 8], [W + 3, 8]], 1.4, { taper: 0, wobble: 0.2 });
  windowBand(p, 136, 24, 176, 24, 7);
  windowBand(p, 34, 24, 90, 24, 4);
  windowBand(p, W - 124, 24, 90, 24, 4);
  p.panel([[0, 58], [W, 58]], 1.2, 581);
  hatchDoor(p, 6, 46, 18, 44);
  lifeRing(p, 78, 76, 8.5);
  lifeRing(p, W - 78, 76, 8.5);
  p.rivets([150, 64], [298, 64], 8, 1.6);
  rustRuns(p, [[140, 50], [224, 50], [308, 50]], 16, 583);
  edgeChips(p, 0, H - 8, W, 6, 10, 585);
}

/** Dach eines Aufbaus (96 x 96): Luke, Luefter, Fuge / superstructure roof: hatch, vent, joint */
export function paintRoof(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(8, 8, W - 16, H - 16, 8), 1.2, { closed: true, wobble: 0.25 });
  deckHatch(p, 32, 62, 18, 16);
  p.shade(ring(66, 36, 9, 12), 0.8, 0.9);
  p.line(ring(66, 36, 9, 12), 1.5, { closed: true, wobble: 0.1 });
  slots(p, 59, 31, 14, 3, 4);
}

/** Schornstein (224 x 128): s rundum, t Muendung -> Deck / funnel: s around, t mouth -> deck */
function paintFunnel(p: Pen): void {
  const W = p.w, H = p.h;
  p.gradient(0, 0, W, 46, [0, 0], [0, 46], 0.5, 1);
  p.line([[-3, 19], [W + 3, 19]], 1.5, { taper: 0, wobble: 0.2 });
  p.rivets([8, 25], [W - 8, 25], 12, 1.7);
  p.panel([[0, 76], [W, 76]], 1.3, 591);
  // Dampfrohre und Steigleiter hinten / steam pipes and ladder at the back
  for (const x of [16, 28]) { p.crease([[x + 1.5, 6], [x + 1.5, H]], 2.4, 1.5, 0.7, { taper: 0, wobble: 0 }); p.line([[x, 6], [x, H]], 1.6, { taper: 0, wobble: 0.15 }); }
  ladder(p, W - 30, 24, H - 4, 9, 8);
  streaks(p, 40, 22, W - 80, H - 30, 7, 593);
  p.splatter(0, 0, W, 30, 14, SOOT, 595, { size: 4, rise: 1, alpha: 0.5 });
  edgeChips(p, 0, H - 7, W, 5, 8, 597);
}

/** Turmwand (352 x 64): s rundum (Rohre in der Mitte), t Dachkante -> Drehkranz / turret wall: s around (barrels in the middle), t roof edge -> ring */
function paintNavTurret(p: Pen): void {
  const W = p.w, H = p.h;
  p.line([[-3, 5], [W + 3, 5]], 1.2, { taper: 0, wobble: 0.3 });
  // Rohrscharte mit Segeltuchmanschette / gun port with a canvas blast bag
  p.shade(rrect(W / 2 - 40, 16, 80, 30, 9), 0.74, 0.9);
  p.line(rrect(W / 2 - 40, 16, 80, 30, 9), 1.6, { closed: true, wobble: 0.2 });
  for (const x of [W / 2 - 74, W / 2 + 60]) { p.fill(rrect(x, 12, 14, 7, 2), SOOT); p.line(rrect(x, 12, 14, 7, 2), 1.2, { closed: true, wobble: 0.1 }); }
  hatchDoor(p, 10, 16, 18, 38);
  for (let i = 0; i < 3; i++) p.line([[W - 46, 20 + i * 11], [W - 34, 20 + i * 11]], 1.7, { taper: 0.05, wobble: 0 });
  p.rivets([40, H - 7], [W - 56, H - 7], 16, 1.8);
  p.panel([[96, 8], [96, H - 12]], 1.2, 601);
  p.panel([[W - 96, 8], [W - 96, H - 12]], 1.2, 603);
  streaks(p, 40, 8, W - 80, H - 20, 6, 605);
  edgeChips(p, 0, H - 6, W, 5, 12, 607);
}

/** Turmdach (96 x 96), Rohre zeigen nach oben im Bild / turret roof, the barrels point up in the image */
function paintNavTurretTop(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(9, 9, W - 18, H - 18, 12), 1.2, { closed: true, wobble: 0.25 });
  p.shade(ring(34, 60, 11, 14), 0.84, 0.9);
  p.line(ring(34, 60, 11, 14), 1.6, { closed: true, wobble: 0.1 });
  p.line(spline([[29, 62], [34, 57], [39, 62]], 4), 1.8, { taper: 0.15 });
  for (const x of [26, 62]) { p.fill(rrect(x, 18, 12, 6, 1.5), SOOT); p.line(rrect(x, 18, 12, 6, 1.5), 1.1, { closed: true, wobble: 0.1 }); }
  slots(p, 58, 54, 16, 3, 4.6);
  p.chips(8, 8, W - 16, H - 16, 5, BARE, 611, 2.4);
}

/** Rohr (48 x 128): s rundum, t Manschette -> Muendung / barrel: s around, t blast bag -> muzzle */
function paintNavGun(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [8, 20, 34]) p.line(spline([[x, 2], [x + 3, 9], [x - 1, 16]], 4), 1.2, { taper: 0.35, wobble: 0.3 });
  for (const y of [58, 92]) { p.line([[-2, y], [W + 2, y]], 1.3, { taper: 0, wobble: 0.15 }); p.crease([[0, y + 3], [W, y + 3]], 1.6, 1.6, 0.7, { taper: 0, wobble: 0.15 }); }
  p.gradient(0, H * 0.84, W, H * 0.16 + 2, [0, H * 0.84], [0, H], 1, 0.5);
}

/** Kuppel eines Nebengeschuetzes (128 x 48) / dome of a secondary gun */
function paintDome(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill(rrect(W / 2 - 6, 14, 12, 22, 4), SOOT);
  p.line(rrect(W / 2 - 6, 14, 12, 22, 4), 1.4, { closed: true, wobble: 0.1 });
  p.line([[-2, 10], [W + 2, 10]], 1.1, { taper: 0, wobble: 0.3 });
  p.rivets([8, H - 6], [W - 8, H - 6], 9, 1.6);
}

/** Rettungsboot (96 x 96): s rundum (Persenning oben in der Mitte), t Heck -> Bug / lifeboat: s around (canvas cover on top, centre), t stern -> bow */
function paintLifeboat(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill(rect(18, 0, W - 36, H), mat.sandbag);
  for (const x of [18, W - 18]) p.line([[x, -2], [x, H + 2]], 1.6, { taper: 0, wobble: 0.3 });
  // Falten der Persenning ueber den Duchten / folds of the cover over the thwarts
  for (const y of [22, 47, 73]) p.crease(spline([[20, y + 2], [W / 2, y - 2], [W - 20, y + 2]], 5), 2.6, 0.8, 0.8, { taper: 0.25, wobble: 0.4 });
  p.line([[8, 4], [8, H - 4]], 1, { taper: 0.1, wobble: 0.3 });
  p.line([[W - 8, 4], [W - 8, H - 4]], 1, { taper: 0.1, wobble: 0.3 });
}

/** Container-Seitenwand (128 x 64): Rahmen, Tuerriegel, Kennung / container side: frame, lock rods, marking */
function paintContainer(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(3, 3, W - 6, H - 6, 3).concat([[W - 6, 3]]), 1.6, 621);
  for (const x of [40, 84]) p.line([[x, 5], [x, H - 5]], 1.1, { taper: 0.1, wobble: 0.3 });
  for (const x of [W - 16, W - 9]) { p.line([[x, 7], [x, H - 7]], 1.5, { taper: 0, wobble: 0.1 }); p.fill(rect(x - 2, H / 2 - 2, 4, 5), BARE); }
  stencil(p, mat.paper, 'M 47', 24, 20, 13, 623);
  p.chips(4, H - 12, W - 8, 8, 8, BARE, 625, 2.6);
  streaks(p, 6, 5, W - 30, H - 14, 4, 627);
}

/** Katapultschiene (32 x 128) / catapult rail */
function paintCatapult(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill(rect(W / 2 - 3, 2, 6, H - 4), SOOT, 0.85);
  for (const x of [7, W - 7]) p.line([[x, 2], [x, H - 2]], 1.4, { taper: 0, wobble: 0.15 });
  for (const y of [18, 44, 67, 96, 116]) p.line([[6, y], [W - 6, y]], 1.2, { taper: 0, wobble: 0.1 });
}

/** Schaum (96 x 96): helle Flaeche mit wenigen blauen Schatten / foam: light area with a few blue shadows */
export function paintFoam(p: Pen): void {
  const R = rng(631);
  for (let i = 0; i < 9; i++) p.dab(10 + R() * 76, 10 + R() * 76, 4 + R() * 5, [0.7, 0.86, 0.98], 0.8);
  for (let i = 0; i < 4; i++) { const x = 14 + R() * 60, y = 14 + R() * 60; p.crease(spline([[x, y], [x + 9, y - 4], [x + 18, y + 1]], 4), 1.6, [0.62, 0.8, 0.96], 0.8, { taper: 0.3, wobble: 0.4 }); }
}

/** Eigene Zellen der Kriegsschiffe / the warships' own cells */
export function shipCells(): Cell[] {
  return [
    { name: 'hullSide', w: 512, h: 72, paint: (p) => paintHullSide(p) },
    { name: 'deck:destroyer', w: 496, h: 112, paint: paintDeckDestroyer },
    { name: 'deck:battleship', w: 440, h: 220, paint: paintDeckBattleship },
    { name: 'deck:sub', w: 496, h: 36, paint: paintDeckSub },
    { name: 'subSide', w: 512, h: 80, paint: paintSubSide },
    { name: 'sail', w: 320, h: 112, paint: paintSail },
    { name: 'sailTop', w: 96, h: 96, paint: paintSailTop },
    { name: 'house', w: 448, h: 96, paint: paintHouse },
    { name: 'bridge', w: 448, h: 96, paint: paintBridge },
    { name: 'roof', w: 96, h: 96, paint: paintRoof },
    { name: 'bridgeSlit', w: 128, h: 24, paint: (p) => windowBand(p, 6, 6, p.w - 12, 12, 6, mat.glassDark) },
    { name: 'funnel', w: 224, h: 128, paint: paintFunnel },
    { name: 'navTurret', w: 352, h: 64, paint: paintNavTurret },
    { name: 'navTurretTop', w: 96, h: 96, paint: paintNavTurretTop },
    { name: 'navGun', w: 48, h: 128, paint: paintNavGun },
    { name: 'dome', w: 128, h: 48, paint: paintDome },
    { name: 'lifeboat', w: 96, h: 96, paint: paintLifeboat },
    { name: 'container', w: 128, h: 64, paint: paintContainer },
    { name: 'catapult', w: 32, h: 128, paint: paintCatapult },
    { name: 'foam', w: 96, h: 96, paint: paintFoam },
  ];
}
