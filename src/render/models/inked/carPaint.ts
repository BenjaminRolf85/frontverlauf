/**
 * Gezeichnete Einheiten: Zeichnung der Radfahrzeuge (Gelaendewagen, Lastwagen) / inked units: drawing of the wheeled vehicles (field car, lorry).
 *
 * Vier Ansichten einer Karosserie: Flanke, Draufsicht, Bug, Heck. Die Geometrie (car.ts) legt ihre Teile per
 * Wuerfelprojektion mit gemeinsamen Grenzen (CAR) in diese Zellen: Haube, Bordwand und Unterwagen teilen sich so EINE
 * Zeichnung je Ansicht, und jede Bauart der Fraktionen benutzt dieselben Zellen mit ihrer eigenen Form.
 * Four views of one car body: flank, top view, bow, stern. The geometry (car.ts) puts its parts into these cells by box
 * projection with shared bounds (CAR): bonnet, side wall and underbody thus share ONE drawing per view, and each
 * faction's design uses the same cells with its own shape.
 */
import { mat } from '../look';
import { arc, rrect, spline, type Cell, type Pen } from './atlas';
import { BARE, MUD_DRY, MUD_WET, SOOT, stencil, streaks, WOOD } from './trim';

/** Grenzen der Karosserie (Projektion) und Lage der Achsen / bounds of the car body (projection) and axle positions */
export const CAR = {
  x: 0.108, y0: 0.056, y1: 0.17, z0: -0.2, z1: 0.214,
  /** Spritzwand, Trennung Fahrerraum / Pritsche / firewall, split cabin / bed */
  cowl: 0.07, bed: -0.035,
  /** Boden des Innenraums / interior floor */
  floor: 0.104,
  axleF: 0.136, axleR: -0.124,
};

/** Flanke (352 x 96): Bug links, Oberkante oben / flank: bow at the left, top edge up */
function paintCarSide(p: Pen): void {
  const W = p.w, H = p.h;
  const X = (z: number) => ((CAR.z1 - z) / (CAR.z1 - CAR.z0)) * W, Y = (y: number) => ((CAR.y1 - y) / (CAR.y1 - CAR.y0)) * H;
  // Sicke unter der Oberkante, Schweller / pressed line below the top edge, sill
  p.panel([[X(0.2), Y(0.158)], [X(-0.19), Y(0.158)]], 1.5);
  p.shade([[0, Y(0.076)], [W, Y(0.076)], [W, H], [0, H]], 0.84, 0.9);
  p.line([[2, Y(0.076)], [W - 2, Y(0.076)]], 1.3, { taper: 0.03, wobble: 0.25 });
  // Haubenfuge, drei Kiemen, Haubenhalter / bonnet joint, three gills, bonnet catch
  p.panel([[X(CAR.cowl), Y(0.166)], [X(CAR.cowl), Y(0.08)]], 1.7);
  for (let i = 0; i < 3; i++) {
    const x = X(0.165 - i * 0.022);
    p.fill(rrect(x - 3, Y(0.142), 6, 24, 2.5), SOOT, 0.92);
    p.line(rrect(x - 3, Y(0.142), 6, 24, 2.5), 1.2, { closed: true, wobble: 0.1 });
    p.crease([[x + 4.5, Y(0.142) + 2], [x + 4.5, Y(0.142) + 22]], 1.3, 1.5, 0.8, { taper: 0.1 });
  }
  p.fill(rrect(X(0.095) - 5, Y(0.15) - 4, 10, 8, 2), BARE);
  p.line(rrect(X(0.095) - 5, Y(0.15) - 4, 10, 8, 2), 1.2, { closed: true, wobble: 0.1 });
  // Tuer: Ausschnitt, Scharniere, Griff / door: outline, hinges, handle
  const d0 = X(0.052), d1 = X(-0.03);
  const door = [[d0, Y(0.166)], [d0, Y(0.098)], ...arc(d0 + 9, Y(0.098), 9, 9, Math.PI, Math.PI / 2, 4), ...arc(d1 - 9, Y(0.098), 9, 9, Math.PI / 2, 0, 4), [d1, Y(0.166)]] as [number, number][];
  p.shade(door, 0.92, 0.8);
  p.panel(door, 1.8);
  for (const y of [Y(0.146), Y(0.108)]) { p.fill(rrect(d0 - 5, y - 3, 9, 6, 1.5), BARE); p.line(rrect(d0 - 5, y - 3, 9, 6, 1.5), 1.1, { closed: true, wobble: 0.1 }); }
  p.line(spline([[d1 - 20, Y(0.14)], [d1 - 13, Y(0.14) - 3], [d1 - 6, Y(0.14)]], 4), 2.2, { taper: 0.15 });
  // Pritsche: Rungentaschen, Spaten in Halterungen / bed: stake pockets, shovel in brackets
  for (const z of [-0.07, -0.16]) p.panel([[X(z), Y(0.156)], [X(z), Y(0.082)]], 1.4);
  const sy = Y(0.118), s0 = X(-0.06), s1 = X(-0.15);
  p.band([[s0, sy], [s1 - 6, sy]], 4.4, WOOD, 1.1);
  const blade = spline([[s1 - 6, sy - 8], [s1 + 12, sy - 9], [s1 + 22, sy], [s1 + 12, sy + 9], [s1 - 6, sy + 8]], 5, true);
  p.fill(blade, BARE);
  p.line(blade, 1.5, { closed: true, wobble: 0.2 });
  p.spot(s1 + 6, sy - 3, 2, mat.white, 0.6);
  for (const x of [s0 + 14, s1 - 16]) { p.fill(rrect(x - 3, sy - 5.5, 6, 11, 1.5), BARE); p.line(rrect(x - 3, sy - 5.5, 6, 11, 1.5), 1.1, { closed: true, wobble: 0.1 }); }
  // Tankstutzen / filler cap
  p.dab(X(-0.178), Y(0.14), 6, 0.82, 0.9);
  p.line(arc(X(-0.178), Y(0.14), 6, 6, 0, Math.PI * 2, 12), 1.5, { closed: true, wobble: 0.15 });
  p.rivets([X(0.19), Y(0.164)], [X(-0.19), Y(0.164)], 9, 2.1);
  streaks(p, 0, Y(0.156), W, H * 0.4, 7, 503);
  p.scratches(8, Y(0.15), W - 16, H * 0.5, 9, 509, 20);
  p.chips(0, 0, W, 7, 14, BARE, 521, 2.6);
  // Schlamm: Kruste am Schweller, Spritzer hinter den Raedern / mud: crust on the sill, splashes behind the wheels
  p.mud(0, H * 0.52, W, H * 0.48, MUD_WET, MUD_DRY, 523, 0.36);
  for (const z of [CAR.axleF - 0.07, CAR.axleR - 0.07]) p.splatter(X(z) - 16, H * 0.3, 34, H * 0.5, 9, MUD_WET, 541, { size: 3.4, alpha: 0.7, rise: 1.2 });
}

/** Draufsicht (176 x 336): Bug oben, +x links; Haube, Fahrerraum, Pritsche / top view: bow up, +x left; bonnet, cabin, bed */
function paintCarTop(p: Pen): void {
  const W = p.w, H = p.h;
  const X = (x: number) => ((CAR.x - x) / (2 * CAR.x)) * W, Z = (z: number) => ((CAR.z1 - z) / (CAR.z1 - CAR.z0)) * H;
  // Haube: Mittelscharnier, Kiemen, Verschluesse / bonnet: centre hinge, gills, catches
  p.gradient(0, 0, W, Z(CAR.cowl), [0, 0], [0, Z(CAR.cowl)], 1.12, 1, 0.8);
  p.panel([[W / 2, Z(0.206)], [W / 2, Z(CAR.cowl + 0.006)]], 1.6);
  for (let i = 0; i < 5; i++) p.rivet(W / 2 + 4, Z(0.195 - i * 0.027), 1.8);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = Z(0.115 - i * 0.014);
      p.fill(rrect(X(s * 0.062) - 13, y - 2.6, 26, 5.2, 2.4), SOOT, 0.92);
      p.line(rrect(X(s * 0.062) - 13, y - 2.6, 26, 5.2, 2.4), 1.1, { closed: true, wobble: 0.1 });
    }
    p.fill(rrect(X(s * 0.09) - 4, Z(0.17) - 6, 8, 12, 2), BARE);
    p.line(rrect(X(s * 0.09) - 4, Z(0.17) - 6, 8, 12, 2), 1.1, { closed: true, wobble: 0.1 });
  }
  p.panel([[X(0.1), Z(CAR.cowl)], [X(-0.1), Z(CAR.cowl)]], 1.8);
  p.scratches(8, 6, W - 16, Z(CAR.cowl) - 12, 7, 547, 18);
  p.chips(0, 0, W, 8, 8, BARE, 557, 2.6);
  // Fahrerraum: dunkle Gummimatte mit Pedalen / cabin: dark rubber mat with pedals
  const c0 = Z(CAR.cowl - 0.006), c1 = Z(CAR.bed);
  p.shade(rrect(X(0.092), c0, X(-0.092) - X(0.092), c1 - c0, 5), 0.5, 0.95);
  for (const dx of [-0.066, -0.044]) { p.fill(rrect(X(dx) - 4, c0 + 6, 8, 11, 2), BARE); p.line(rrect(X(dx) - 4, c0 + 6, 8, 11, 2), 1, { closed: true, wobble: 0.1 }); }
  p.crease([[X(0), c0 + 4], [X(0), c1 - 4]], 4, 1.5, 0.6, { taper: 0.1 });
  // Pritsche: Bohlen mit Fugen, Zurroesen, Dreck / bed: planks with joints, lashing eyes, dirt
  const b0 = c1 + 4, b1 = Z(-0.192);
  p.shade(rrect(X(0.092), b0, X(-0.092) - X(0.092), b1 - b0, 3), 0.74, 0.9);
  for (const x of [-0.046, 0, 0.046]) p.line([[X(x), b0 + 3], [X(x), b1 - 3]], 1.2, { taper: 0.05, wobble: 0.4 });
  for (const sx of [-1, 1]) for (const z of [b0 + 12, b1 - 12]) { p.line(arc(X(sx * 0.078), z, 4.4, 4.4, 0, Math.PI * 2, 10), 1.7, { closed: true, wobble: 0.1 }); }
  p.splatter(X(0.09), b0, X(-0.09) - X(0.09), b1 - b0, 9, MUD_DRY, 563, { size: 4, alpha: 0.5, rise: 1 });
  p.scratches(X(0.08), b0 + 4, X(-0.08) - X(0.08), b1 - b0 - 8, 6, 569, 16);
}

/** Bug (176 x 96): Kuehlergrill, Scheinwerferringe, Kennzeichen / bow: radiator grille, headlight rings, number plate */
function paintCarFront(p: Pen): void {
  const W = p.w, H = p.h, c = W / 2;
  const g = rrect(c - 36, 12, 72, 46, 7);
  p.shade(g, 0.86, 0.9);
  for (let i = 0; i < 7; i++) {
    const x = c - 27 + i * 9;
    p.fill(rrect(x - 2.6, 17, 5.2, 36, 2.4), SOOT, 0.95);
    p.line(rrect(x - 2.6, 17, 5.2, 36, 2.4), 1, { closed: true, wobble: 0.08 });
  }
  p.panel(g.concat([[c + 29, 12]]), 1.7);
  for (const s of [-1, 1]) {
    p.dab(c + s * 58, 32, 17, 0.82, 0.8);
    // Standlicht und Abschleppoese / side light and tow eye
    p.spot(c + s * 62, 60, 3.4, mat.lamp);
    p.line(arc(c + s * 62, 60, 3.8, 3.8, 0, Math.PI * 2, 10), 1.2, { closed: true, wobble: 0.1 });
    p.line(arc(c + s * 44, H - 14, 5, 6, 0, Math.PI * 2, 10), 2.6, { closed: true, wobble: 0.1 });
  }
  p.fill(rrect(c - 21, H - 30, 42, 15, 2), mat.paper);
  p.line(rrect(c - 21, H - 30, 42, 15, 2), 1.3, { closed: true, wobble: 0.15 });
  stencil(p, mat.ink, 'F 41', c, H - 22, 12, 571);
  p.chips(0, 0, W, 8, 10, BARE, 577, 2.6);
  p.mud(0, H * 0.6, W, H * 0.4, MUD_WET, MUD_DRY, 587, 0.34);
}

/** Heck (176 x 96): Ladeklappe mit Riegeln, Schlusslichter, Kennzeichen / stern: tailgate with latches, tail lights, number plate */
function paintCarRear(p: Pen): void {
  const W = p.w, H = p.h, c = W / 2;
  const gate = rrect(14, 8, W - 28, 50, 5);
  p.shade(gate, 0.92, 0.8);
  p.panel(gate.concat([[W - 20, 8]]), 1.8);
  p.crease([[24, 33], [W - 24, 33]], 2.4, 1.4, 0.7, { taper: 0.05 });
  p.line([[24, 35.5], [W - 24, 35.5]], 1.2, { taper: 0.05, wobble: 0.3 });
  for (const s of [-1, 1]) {
    p.fill(rrect(c + s * 66 - 5, 10, 10, 13, 2), BARE);
    p.line(rrect(c + s * 66 - 5, 10, 10, 13, 2), 1.2, { closed: true, wobble: 0.1 });
    p.spot(c + s * 70, 70, 5, mat.red);
    p.line(arc(c + s * 70, 70, 5.4, 5.4, 0, Math.PI * 2, 12), 1.4, { closed: true, wobble: 0.1 });
    p.line(arc(c + s * 44, H - 13, 5, 6, 0, Math.PI * 2, 10), 2.6, { closed: true, wobble: 0.1 });
  }
  p.fill(rrect(c - 21, 64, 42, 15, 2), mat.paper);
  p.line(rrect(c - 21, 64, 42, 15, 2), 1.3, { closed: true, wobble: 0.15 });
  stencil(p, mat.ink, 'F 41', c, 72, 12, 593);
  p.scratches(18, 12, W - 36, 40, 6, 599, 16);
  p.mud(0, H * 0.6, W, H * 0.4, MUD_WET, MUD_DRY, 601, 0.36);
}

/** Kastenaufbau / Plane (192 x 112): Spriegel als Falten, Riemen, Oesen; fuer Lastwagen und Behaelter / box body / tarp: bows as folds, straps, eyelets; for lorries and containers */
function paintCanvas(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [W * 0.25, W * 0.5, W * 0.75]) {
    p.crease([[x - 3, 4], [x - 3, H - 10]], 5, 1.25, 0.6, { taper: 0.1, wobble: 0.6 });
    p.line(spline([[x, 5], [x + 2, H * 0.5], [x, H - 12]], 5), 1.3, { taper: 0.25, wobble: 0.7 });
  }
  p.band([[-2, H - 9], [W + 2, H - 9]], 5, WOOD, 1.1);
  for (let x = 14; x < W; x += 30) { p.spot(x, H - 9, 2, BARE); }
  p.line(spline([[W * 0.08, 14], [W * 0.13, 30], [W * 0.1, 48]], 4), 1.1, { taper: 0.4, wobble: 0.6 });
  p.line(spline([[W * 0.62, 20], [W * 0.66, 38], [W * 0.63, 58]], 4), 1.1, { taper: 0.4, wobble: 0.6 });
  p.gradient(0, H * 0.55, W, H * 0.45, [0, H * 0.55], [0, H], 1, 0.82, 0.8);
  p.splatter(0, H * 0.6, W, H * 0.4, 8, MUD_DRY, 607, { size: 3, alpha: 0.5 });
}

/** Zellen der Radfahrzeuge / cells of the wheeled vehicles */
export function carCells(): Cell[] {
  return [
    { name: 'carSide', w: 352, h: 96, paint: paintCarSide },
    { name: 'carTop', w: 176, h: 336, paint: paintCarTop },
    { name: 'carFront', w: 176, h: 96, paint: paintCarFront },
    { name: 'carRear', w: 176, h: 96, paint: paintCarRear },
    { name: 'canvas', w: 192, h: 112, paint: paintCanvas },
  ];
}
