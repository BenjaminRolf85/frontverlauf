/**
 * Gezeichnete Einheiten: Zeichnung der Roboter (NEXUS) / inked units: drawing of the robots (NEXUS).
 *
 * Maschinen ohne Stoff und Gesicht: Plattenfugen, Lueftungsschlitze, Kabel, Sensorglas, Warnschablonen,
 * Leuchtstreifen, Sechseckpaneele. Strichstaerken und Ruheflaechen wie beim Korvat-Panzer (tankPaint.ts); die weissen
 * Platten bleiben zwischen den Zeichen flach. Keine Schraffur, kein Raster: Lamellen und Warnbalken sind Form und
 * Kennzeichnung, nie Schattierung.
 * Machines without cloth and faces: panel joints, vents, cable runs, sensor glass, warning stencils, glow strips,
 * hexagon panels. Line weights and calm areas as on the Korvat tank (tankPaint.ts); the white plates stay flat
 * between the marks. No hatching, no screen: louvres and hazard bars are form and marking, never shading.
 */
import { rng, type ColorLike } from '../kit';
import { mat } from '../look';
import { primitives } from '../../../design/tokens';
import { arc, css, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { emblemCells } from './emblem';
import { BARE, MUD_DRY, SOOT, STEEL, trimCells } from './trim';

/** Leuchtfarbe der Maschinen (Material, nicht Fraktionsfarbe) / the machines' glow colour (a material, not a faction colour) */
const GLOW = mat.cyanGlow;
const GLASS = mat.glassDark;
const DARK = mat.gunmetal;
const HAZ = mat.yellow;
const TAU = Math.PI * 2;

// ---------- Zeichenhilfen / drawing helpers ----------

/** Leuchtlinie: Farbband mit hellem Kern und Tuscheraendern / glow line: colour band with a bright core and ink edges */
export function glowLine(p: Pen, pts: Pt[], w = 4.6): void {
  p.band(pts, w, GLOW, 1.1);
  p.mark(pts, w * 0.3, mat.white, 0.75, { taper: 0.1, wobble: 0, press: 0 });
}
/** Ecken eines Sechsecks / corners of a hexagon */
export function hexPts(cx: number, cy: number, r: number, rot = 0): Pt[] {
  return Array.from({ length: 6 }, (_, i): Pt => [cx + Math.cos(rot + (i / 6) * TAU) * r, cy + Math.sin(rot + (i / 6) * TAU) * r]);
}
/** Sechseckpaneel: leicht abgesetzte Flaeche mit Fuge / hexagon panel: slightly set-off area with a joint */
export function hexPanel(p: Pen, cx: number, cy: number, r: number, rot = 0, tone = 0.93): void {
  const h = hexPts(cx, cy, r, rot);
  p.shade(h, tone, 0.9);
  p.panel([...h, h[0]], 1.5);
}
/** Lueftungsschlitz: dunkle Oeffnung mit wenigen Lamellen / vent: dark opening with a few louvres */
export function vent(p: Pen, x: number, y: number, w: number, h: number, n = 3): void {
  p.fill(rrect(x, y, w, h, 2.5), SOOT, 0.95);
  for (let i = 1; i <= n; i++) {
    const yy = y + (i / (n + 1)) * h;
    p.mark([[x + 3, yy], [x + w - 3, yy]], 1.5, STEEL, 0.85, { taper: 0, wobble: 0, press: 0 });
  }
  p.line(rrect(x, y, w, h, 2.5), 1.5, { closed: true, wobble: 0.15 });
  p.crease([[x + 3, y + h + 1.6], [x + w - 1, y + h + 1.6]], 1.3, 1.5, 0.7, { taper: 0.1 });
}
/** Sensorlinse: dunkles Glas, leuchtender Kern, Glanzpunkt / sensor lens: dark glass, glowing core, highlight */
export function lens(p: Pen, cx: number, cy: number, r: number): void {
  p.fill(arc(cx, cy, r, r, 0, TAU, 16), GLASS);
  p.fill(arc(cx, cy, r * 0.58, r * 0.58, 0, TAU, 12), GLOW);
  p.line(arc(cx, cy, r, r, 0, TAU, 16), Math.max(1.2, r * 0.2), { closed: true, wobble: 0.1 });
  p.spot(cx - r * 0.28, cy - r * 0.3, Math.max(0.9, r * 0.2), mat.white, 0.9);
}
/** Warnbalken: Gelb mit schraegen schwarzen Feldern / hazard bar: yellow with slanted black blocks */
export function hazard(p: Pen, x: number, y: number, w: number, h: number, blocks = Math.max(2, Math.round(w / (h * 2.2))), fillIt = true): void {
  if (fillIt) p.fill([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], HAZ, 0.97);
  const step = w / blocks;
  for (let i = 0; i < blocks; i++) {
    const x0 = x + i * step + step * 0.12;
    p.blot([[x0, y + h], [x0 + h * 0.6, y], [x0 + h * 0.6 + step * 0.46, y], [x0 + step * 0.46, y + h]]);
  }
  for (const yy of [y, y + h]) p.line([[x - 1, yy], [x + w + 1, yy]], 1.2, { taper: 0, wobble: 0.15 });
}
/**
 * Kennung der Maschinen: saubere Schablonenschrift mit wenig Abrieb (die Schablone aus trim.ts ist fuer verwitterte
 * Fahrzeuge gedacht und frisst kleine Schrift auf).
 * Machine marking: clean stencil lettering with little wear (the stencil of trim.ts is meant for weathered vehicles
 * and eats small lettering).
 */
function tag(p: Pen, text: string, x: number, y: number, size: number, seed: number, c: ColorLike = DARK): void {
  const ctx = p.abs;
  ctx.save();
  ctx.font = `${size}px ${primitives.font.display}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = css(c);
  ctx.globalAlpha = 0.92;
  ctx.fillText(text, x, y);
  ctx.globalCompositeOperation = 'destination-out';
  const R = rng(seed), w = ctx.measureText(text).width;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x - w / 2 + R() * w, y - size / 2 + R() * size, 0.6 + R() * size * 0.05, 0.5 + R() * size * 0.03, R() * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
/** Staub am unteren Rand: wenige helle Flecken / dust at the lower edge: a few light stains */
function dust(p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number): void {
  p.splatter(x, y, w, h, n, MUD_DRY, seed, { size: 2.6, alpha: 0.4, rise: 1.6 });
}

// ---------- Kettenfahrzeuge / tracked machines ----------

/** Wannendeck (256 x 288): Bug oben, +x links; die Mitte bleibt ruhig (dort sitzt der Aufbau) / hull deck: bow up, +x left; the centre stays calm (the superstructure sits there) */
function paintDeck(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(32, 30, W - 64, H - 60, 10).concat([[W - 42, 30]]), 1.7);
  for (const x of [43, W - 43]) glowLine(p, [[x, 66], [x, H - 62]], 4.4);
  for (const dx of [-52, 0, 52]) hexPanel(p, W / 2 + dx, 60, 17, Math.PI / 6);
  // Wartungsklappe und Hecklueftung / service hatch and rear vents
  const hx = 150, hy = 92;
  p.shade(rrect(hx, hy, 48, 34, 5), 0.92, 0.8);
  p.panel(rrect(hx, hy, 48, 34, 5).concat([[hx + 43, hy]]), 1.6);
  p.line(spline([[hx + 16, hy + 21], [hx + 24, hy + 15], [hx + 32, hy + 21]], 4), 2.2, { taper: 0.15 });
  for (const x of [62, 138]) vent(p, x, H - 68, 56, 22, 3);
  p.panel([[40, H - 82], [W - 40, H - 82]], 1.5);
  for (const [x, y] of [[40, 38], [W - 40, 38], [40, H - 38], [W - 40, H - 38]] as Pt[]) p.rivet(x, y, 2.3);
  tag(p, 'NX', 84, 112, 26, 501);
  p.scratches(40, 120, W - 80, 80, 6, 503, 22);
  p.chips(34, 30, W - 68, 6, 6, BARE, 505, 2.4);
}

/** Wannenflanke (448 x 80): von aussen, Fuge und Leuchtlinie oben / hull flank: from outside, joint and glow line at the top */
function paintSide(p: Pen): void {
  const W = p.w, H = p.h;
  glowLine(p, [[30, 13], [W - 30, 13]], 4.4);
  for (const x of [150, 300]) { p.panel([[x, 22], [x, H - 5]], 1.7); p.rivet(x + 7, 30, 2.2); p.rivet(x + 7, H - 12, 2.2); }
  for (const dx of [-35, 0, 35]) hexPanel(p, 225 + dx, 50, 15, Math.PI / 6);
  vent(p, 330, 36, 64, 22, 3);
  tag(p, 'NX-04', 80, 48, 27, 511);
  hazard(p, 396, 64, 40, 9, 4);
  p.panel([[8, H - 4], [W - 8, H - 4]], 1.4);
  p.scratches(20, 30, 120, 36, 4, 513, 20);
  p.chips(0, H - 9, W, 6, 9, BARE, 515, 2.4);
  dust(p, 0, H * 0.5, W, H * 0.5, 14, 517);
}

/** Bug- und Heckplatte (256 x 56) / front and rear plate (256 x 56) */
function paintNose(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(8, 6, W - 16, H - 12, 6).concat([[W - 14, 6]]), 1.6);
  lens(p, W / 2, 26, 7.5);
  for (const dx of [-17, 17]) lens(p, W / 2 + dx, 28, 4.6);
  for (const s of [-1, 1]) {
    const tx = W / 2 + s * 92;
    p.line(arc(tx, H - 20, 7, 8, 0, TAU, 12), 3.2, { closed: true, wobble: 0.15 });
    p.rivet(W / 2 + s * 58, 16, 2.2);
  }
  dust(p, 0, H * 0.4, W, H * 0.6, 8, 521);
}

/** Aufbau rundum (448 x 64): s rundum, vorn in der Mitte; Sichtband mit Leuchtlinie / superstructure wall: s around, front in the middle; vision band with a glow line */
function paintTurret(p: Pen): void {
  const W = p.w, H = p.h;
  p.gradient(0, H - 14, W, 17, [0, H - 14], [0, H], 1, 0.84);
  p.panel([[0, 5], [W, 5]], 1.4, 31);
  const vx = W / 2;
  p.fill(rrect(vx - 52, 18, 104, 20, 5), GLASS);
  glowLine(p, [[vx - 42, 28], [vx + 42, 28]], 5);
  p.line(rrect(vx - 52, 18, 104, 20, 5), 1.8, { closed: true, wobble: 0.2 });
  for (const s of [-1, 1]) {
    p.panel([[vx + s * 56, 9], [vx + s * 56, H - 6]], 1.6);
    vent(p, vx + s * 112 - 20, 22, 40, 20, 3);
    p.rivet(vx + s * 82, 14, 2.2);
    p.rivet(vx + s * 142, 14, 2.2);
    p.panel([[vx + s * 168, 9], [vx + s * 168, H - 6]], 1.6);
  }
  tag(p, '07', 414, 30, 26, 523);
  hazard(p, 16, 42, 36, 9, 3);
  p.chips(0, 2, W, 5, 8, BARE, 525, 2.2);
}

/** Dach des Aufbaus (128 x 128): von oben, Bug oben / superstructure roof: from above, bow up */
function paintTop(p: Pen): void {
  const W = p.w;
  p.panel(rrect(12, 12, W - 24, W - 24, 12).concat([[W - 26, 12]]), 1.6);
  hexPanel(p, W / 2, W / 2 + 4, 27, 0);
  vent(p, 26, 22, 30, 13, 2);
  p.dab(92, 30, 10, 0.9, 0.8);
  p.line(arc(92, 30, 10, 10, 0, TAU, 14), 1.6, { closed: true, wobble: 0.15 });
  p.line([[87, 30], [97, 30]], 1.6, { taper: 0.1 });
  for (const [x, y] of [[20, 20], [W - 20, 20], [20, W - 20], [W - 20, W - 20]] as Pt[]) p.rivet(x, y, 2.2);
}

/** Geraetekasten (96 x 48): Lamellen und Ladeanzeige / equipment box: louvres and charge indicators */
function paintCap(p: Pen): void {
  const W = p.w, H = p.h;
  p.crease(rrect(3, 3, W - 6, H - 6, 4).concat([[W - 8, 3]]), 1.4, 1.9, 0.8, { taper: 0 });
  p.fill(rrect(8, 12, 38, 24, 2.5), SOOT, 0.95);
  for (const y of [18, 24, 30]) p.mark([[11, y], [43, y]], 1.5, STEEL, 0.85, { taper: 0, wobble: 0, press: 0 });
  for (const x of [58, 69, 80]) { p.mark([[x, 14], [x, 34]], 5, GLOW, 1, { taper: 0, wobble: 0, press: 0 }); p.mark([[x, 17], [x, 31]], 1.6, mat.white, 0.75, { taper: 0.1, wobble: 0, press: 0 }); }
  for (const [x, y] of [[6, 6], [W - 6, 6], [6, H - 6], [W - 6, H - 6]] as Pt[]) p.spot(x, y, 1.7, STEEL);
}

/** Schiene der Railgun (256 x 24), dunkles Metall: helle Kanten statt Tusche / railgun rail, dark metal: light edges instead of ink */
function paintRail(p: Pen): void {
  const W = p.w, H = p.h;
  p.crease([[0, 3], [W, 3]], 2, 2.1, 0.9, { taper: 0, wobble: 0 });
  p.mark([[4, H / 2], [W - 4, H / 2]], 2.4, GLOW, 0.95, { taper: 0.02, wobble: 0, press: 0 });
  for (let x = 30; x < W; x += 49) { p.crease([[x, 5], [x, H - 3]], 1.6, 1.9, 0.8, { taper: 0, wobble: 0 }); p.spot(x + 7, H - 6, 1.8, STEEL); }
}

// ---------- Glieder und Koerper / limbs and bodies ----------

/** Weisses Glied (160 x 160): s rundum (vorn Mitte), t entlang; Gelenkfugen, Leuchtfuge vorn / white limb: s around (front centre), t along; joint lines, glow seam in front */
function paintLimb(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [17, H - 17]) p.panel([[0, y], [W, y]], 1.5, 41 + y);
  glowLine(p, [[W / 2, 42], [W / 2, H - 42]], 4.2);
  for (const x of [40, 120]) {
    vent(p, x - 9, 54, 18, 24, 3);
    p.rivet(x, 104, 2.2);
    p.rivet(x, 28, 2);
  }
  p.panel([[2, 34], [2, H - 34]], 1.4);
  p.chips(0, H - 14, W, 8, 5, BARE, 531, 2.2);
}

/** Dunkles Glied (96 x 96): Kolbenstange und Ringe hell / dark limb: piston rod and rings in light lines */
function paintLimbDark(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [13, H - 13]) p.crease([[0, y], [W, y]], 1.8, 2, 0.85, { taper: 0, wobble: 0 });
  p.mark([[W / 2, 22], [W / 2, H - 26]], 2.2, STEEL, 0.85, { taper: 0.05, wobble: 0, press: 0 });
  p.spot(W / 2, H - 19, 3, GLOW);
  for (const x of [24, 72]) p.spot(x, 24, 1.8, STEEL);
}

/** Sechseck-Plattform von oben (192 x 192) / hexagonal platform from above (192 x 192) */
function paintHex(p: Pen): void {
  const W = p.w, c = W / 2;
  const ring = hexPts(c, c, 56, Math.PI / 2);
  p.panel([...ring, ring[0]], 1.6);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i / 6) * TAU;
    p.panel([[c + Math.cos(a) * 58, c + Math.sin(a) * 58], [c + Math.cos(a) * 88, c + Math.sin(a) * 88]], 1.5);
    const m = a + TAU / 12;
    p.rivet(c + Math.cos(m) * 74, c + Math.sin(m) * 74, 2.3);
  }
  for (const s of [-1, 1]) vent(p, c + s * 70 - 9, c - 13, 18, 26, 3);
  tag(p, 'N6', c, c + 70, 15, 541);
  p.scratches(c - 60, c - 76, 120, 30, 3, 543, 18);
}

/** Hinterleib der Spinne (256 x 128), dunkel: t Heckpol -> Rumpf, s = 0.5 oben / spider abdomen, dark: t rear pole -> body, s = 0.5 on top */
function paintAbdomen(p: Pen): void {
  const W = p.w;
  p.band([[-2, 13], [W + 2, 13]], 5, GLOW, 1);
  for (const y of [44, 86]) p.crease([[0, y], [W, y]], 1.8, 1.9, 0.85, { taper: 0, wobble: 0.2 });
  for (const s of [-1, 1]) for (const y of [54, 64, 74]) p.mark([[W / 2 + s * 40, y], [W / 2 + s * 60, y]], 3.6, GLOW, 1, { taper: 0.1, wobble: 0, press: 0 });
  p.fill(rrect(W / 2 - 22, 92, 44, 26, 3), SOOT, 0.95);
  for (const y of [98, 105, 112]) p.mark([[W / 2 - 18, y], [W / 2 + 18, y]], 1.5, STEEL, 0.85, { taper: 0, wobble: 0, press: 0 });
  p.crease(rrect(W / 2 - 24, 90, 48, 30, 4).concat([[W / 2 + 20, 90]]), 1.4, 1.9, 0.8, { taper: 0 });
  for (const x of [20, 70, 186, 236]) p.spot(x, 30, 2, STEEL);
}

/** Kopf der Spinne von vorn (96 x 48): vier Augen / spider head from the front: four eyes */
function paintFace(p: Pen): void {
  const W = p.w;
  p.panel([[4, 5], [W - 4, 5]], 1.4);
  lens(p, W / 2 - 18, 19, 7);
  lens(p, W / 2 + 18, 19, 7);
  lens(p, W / 2 - 31, 34, 4.6);
  lens(p, W / 2 + 31, 34, 4.6);
  vent(p, W / 2 - 10, 30, 20, 12, 2);
}

/** Sensorkopf (64 x 40): eine Linse / sensor head: one lens */
function paintEye(p: Pen): void {
  const W = p.w, H = p.h;
  p.crease(rrect(2.5, 2.5, W - 5, H - 5, 4).concat([[W - 7, 2.5]]), 1.3, 1.9, 0.8, { taper: 0 });
  lens(p, W / 2, H / 2, 11);
  for (const x of [9, W - 9]) p.spot(x, H - 9, 1.8, STEEL);
}

/**
 * Sprengladung der Kamikaze-Drohne (384 x 176): s rundum (vorn Mitte), t Pol -> Pol nach Bogenlaenge. Das gelbe Band
 * am Aequator ist Geometrie; hier kommen die schwarzen Warnfelder, Zuendkapseln mit Draehten, Fugen und die Zeitanzeige.
 * Charge of the kamikaze drone: s around (front centre), t pole to pole by arc length. The yellow band at the equator
 * is geometry; this adds the black hazard blocks, detonator caps with wires, joints and the timer display.
 */
function paintCharge(p: Pen): void {
  const W = p.w;
  hazard(p, 0, 79, W, 18, 12, false);
  p.panel([[0, 42], [W, 42]], 1.5, 61);
  for (let i = 0; i < 4; i++) p.panel([[48 + i * 96, 46], [48 + i * 96, 74]], 1.5);
  const R = rng(547);
  for (let i = 0; i < 6; i++) {
    const x = 30 + i * 64, y = 60;
    // Draht zum Zuender oben, abwechselnd rot und gelb / wire up to the fuse, alternating red and yellow
    const wire = spline([[x, y - 5], [x + (R() - 0.5) * 22, 38], [x + (R() - 0.5) * 16, 20], [x + 6, 4]], 5);
    p.mark(wire, 1.9, i % 2 ? mat.red : HAZ, 1, { taper: 0, wobble: 0.3, press: 0 });
    p.fill(arc(x, y, 6, 6, 0, TAU, 12), DARK);
    p.line(arc(x, y, 6, 6, 0, TAU, 12), 1.4, { closed: true, wobble: 0.1 });
    p.spot(x, y, 2.4, mat.red);
  }
  // Zeitanzeige vorn / timer display in front
  const dx = W / 2 - 20, dy = 44;
  p.fill(rrect(dx, dy, 40, 16, 3), GLASS);
  for (const k of [0, 1, 2]) p.mark([[dx + 9 + k * 11, dy + 4], [dx + 9 + k * 11, dy + 12]], 4.2, GLOW, 1, { taper: 0, wobble: 0, press: 0 });
  p.line(rrect(dx, dy, 40, 16, 3), 1.5, { closed: true, wobble: 0.15 });
  // untere Halbkugel: Fuge und Kuehlschlitze / lower half: joint and cooling slots
  p.panel([[0, 116], [W, 116]], 1.5, 67);
  for (let i = 0; i < 4; i++) glowLine(p, [[36 + i * 96, 128], [60 + i * 96, 128]], 4);
  dust(p, 0, 136, W, 40, 10, 549);
  p.scratches(10, 100, W - 20, 12, 3, 551, 16);
}

// ---------- Titan ----------

/** Rumpf des Titan (448 x 160): s rundum (vorn Mitte), t Schulterkante -> Taille / Titan torso: s around (front centre), t shoulder edge -> waist */
function paintChest(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, cy = 80;
  p.gradient(0, H * 0.62, W, H * 0.38 + 3, [0, H * 0.62], [0, H], 1, 0.86);
  // sechs Leuchtmarken um die Fassung des Kerns, Brustfuge / six glow ticks around the core's bezel, chest joint
  p.panel([[cx - 52, 30], [cx + 52, 30]], 1.6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + TAU / 12;
    glowLine(p, [[cx + Math.cos(a) * 31, cy + Math.sin(a) * 31], [cx + Math.cos(a) * 40, cy + Math.sin(a) * 40]], 3.6);
  }
  for (const s of [-1, 1]) {
    // Brustplatten, Bolzen, Leuchtkante / chest plates, bolts, glow edge
    p.rivet(cx + s * 30, 20, 2.3);
    p.rivet(cx + s * 46, 20, 2.3);
    p.panel([[cx + s * 56, 8], [cx + s * 56, H - 8]], 1.6);
    glowLine(p, [[cx + s * 50, 100], [cx + s * 50, 136]], 3.8);
    // Flanke: Sechseckpaneel und Schlitz / flank: hexagon panel and slot
    hexPanel(p, cx + s * 112, 66, 18, Math.PI / 6);
    vent(p, cx + s * 112 - 16, 104, 32, 16, 2);
    p.panel([[cx + s * 168, 8], [cx + s * 168, H - 8]], 1.6);
  }
  vent(p, cx - 22, 132, 44, 18, 3);
  // Ruecken (Naht): Warnbalken und Kennung / back (seam): hazard bars and marking
  hazard(p, 0, 124, 44, 10, 3);
  hazard(p, W - 44, 124, 44, 10, 3);
  tag(p, 'T-1', W - 28, 60, 18, 553);
  p.rivets([10, 9], [W - 10, 9], 10, 2.2);
  p.chips(0, H - 9, W, 6, 8, BARE, 555, 2.4);
}

/** Kopf des Titan (192 x 64): Visierband vorn / Titan head: visor band in front */
function paintHead(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.fill(rrect(cx - 44, 20, 88, 18, 4), GLASS);
  glowLine(p, [[cx - 36, 29], [cx + 36, 29]], 5.4);
  p.line(rrect(cx - 44, 20, 88, 18, 4), 1.8, { closed: true, wobble: 0.2 });
  for (const s of [-1, 1]) {
    p.panel([[cx + s * 48, 8], [cx + s * 48, H - 6]], 1.5);
    p.dab(cx + s * 72, 30, 7, 0.86, 0.9);
    p.line(arc(cx + s * 72, 30, 7, 7, 0, TAU, 12), 1.5, { closed: true, wobble: 0.1 });
    p.spot(cx + s * 72, 30, 2.2, GLOW);
  }
  vent(p, cx - 12, 46, 24, 11, 2);
}

/** Schulterpanzer (128 x 96), Fraktionsfarbe aus der Vertexfarbe / pauldron, faction colour from the vertex colour */
function paintPauldron(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(6, 6, W - 12, H - 12, 8).concat([[W - 16, 6]]), 1.7);
  glowLine(p, [[18, H - 15], [W - 18, H - 15]], 4.2);
  const h = hexPts(W / 2, H / 2 - 6, 22, Math.PI / 6);
  p.panel([...h, h[0]], 1.4);
  for (const [x, y] of [[13, 13], [W - 13, 13]] as Pt[]) p.rivet(x, y, 2.4);
  p.chips(0, 0, W, 8, 5, BARE, 557, 2.6);
}

/** Fuss von oben (96 x 112), dunkel: Zehenspalten, Knoechelring / foot from above, dark: toe gaps, ankle ring */
function paintFoot(p: Pen): void {
  const W = p.w, H = p.h;
  for (const x of [34, 62]) p.crease([[x, 4], [x, 40]], 2, 2, 0.85, { taper: 0.1, wobble: 0.2 });
  p.crease([[4, 44], [W - 4, 44]], 1.8, 2, 0.85, { taper: 0.05, wobble: 0.2 });
  p.crease(arc(W / 2, 80, 22, 20, 0, TAU, 20), 1.8, 2, 0.85, { closed: true });
  for (const x of [14, W - 14]) p.spot(x, 54, 2.2, STEEL);
  p.mark([[20, 8], [W - 20, 8]], 2, STEEL, 0.6, { taper: 0.2, wobble: 0.3 });
  p.splatter(0, 0, W, H * 0.4, 8, MUD_DRY, 559, { size: 2.6, alpha: 0.45, rise: 1 });
}

/** Armklinge von der Seite (256 x 48): Spitze links, Leuchtschneide unten / arm blade from the side: tip left, glowing edge below */
function paintSword(p: Pen): void {
  const W = p.w, H = p.h;
  glowLine(p, [[14, H - 10], [W - 60, H - 10]], 5);
  p.panel([[30, 15], [W - 40, 15]], 1.5);
  p.panel([[W - 44, 6], [W - 44, H - 6]], 1.6);
  for (const x of [W - 30, W - 14]) p.rivet(x, H / 2, 2.4);
  p.scratches(20, 18, W - 90, 14, 4, 561, 22);
  p.chips(0, 4, 40, H - 8, 4, BARE, 563, 2.4);
}

/** Rohr der Armkanone (96 x 160), dunkel: Leuchtspulen als Baender / arm cannon barrel, dark: glowing coils as bands */
function paintBarrel(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [42, 72, 102]) {
    p.mark([[-2, y], [W + 2, y]], 7, GLOW, 1, { taper: 0, wobble: 0, press: 0 });
    p.mark([[-2, y], [W + 2, y]], 2, mat.white, 0.7, { taper: 0, wobble: 0, press: 0 });
  }
  for (const y of [18, 128]) p.crease([[0, y], [W, y]], 1.8, 2, 0.85, { taper: 0, wobble: 0 });
  p.mark([[W / 2, 8], [W / 2, 34]], 2.2, STEEL, 0.7, { taper: 0.1, wobble: 0, press: 0 });
  p.gradient(0, H - 26, W, 29, [0, H - 26], [0, H], 1, 0.5);
}

// ---------- Flammenpanzer, Drohne / flame tank, drone ----------

/** Brennstofftank (256 x 192): s rundum, t Kuppel -> Boden; Spannbaender, Warnband, Flammenzeichen / fuel tank: s around, t dome -> base; straps, hazard band, flame sign */
function paintTank(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [42, H - 26]) p.band([[-2, y], [W + 2, y]], 8, BARE, 1.3);
  hazard(p, 0, 96, W, 16, 9);
  for (const cx of [64, 192]) {
    // Flammenzeichen in der Raute / flame sign in a diamond
    const d: Pt[] = [[cx, 52], [cx + 17, 70], [cx, 88], [cx - 17, 70]];
    p.fill(d, mat.paper, 0.95);
    p.line(d, 1.5, { closed: true, wobble: 0.15 });
    p.fill(spline([[cx, 60], [cx + 6, 70], [cx + 4, 78], [cx, 81], [cx - 5, 78], [cx - 5, 71], [cx - 1, 67]], 4, true), mat.orange, 0.95);
  }
  // Schweissnaht hinten / weld seam at the back
  p.weld([6, 50], [6, 92], 4);
  p.weld([6, 118], [6, H - 34], 4);
  tag(p, 'F-2', W / 2, 140, 28, 565, mat.paper);
  p.gradient(0, 0, W, 30, [0, 0], [0, 30], 1.22, 1);
  p.chips(0, 34, W, 5, 6, BARE, 567, 2.2);
  p.scratches(0, 120, W, 34, 5, 569, 18);
}

/** Rumpf der Quad-Drohne (256 x 128): s rundum (oben Mitte), t Heck -> Bug / quad drone body: s around (top centre), t tail -> nose */
function paintPod(p: Pen): void {
  const W = p.w, cx = W / 2;
  hexPanel(p, cx, 32, 21, Math.PI / 6);
  for (const y of [62, 98]) p.panel([[cx - 62, y], [cx + 62, y]], 1.5);
  for (const s of [-1, 1]) {
    glowLine(p, [[cx + s * 68, 30], [cx + s * 68, 96]], 4.4);
    vent(p, cx + s * 20 - 11, 104, 22, 12, 2);
    p.rivet(cx + s * 50, 70, 2.2);
  }
  tag(p, 'Q4', cx + 30, 80, 15, 571);
  p.scratches(cx - 50, 66, 60, 26, 3, 573, 16);
}

/** Schutzring des Rotors (256 x 24): u rund um den Ring, v rund um das Rohr / rotor guard ring: u around the ring, v around the tube */
function paintRing(p: Pen): void {
  const W = p.w, H = p.h;
  for (let x = 32; x < W; x += 64) { p.line([[x, -2], [x, H + 2]], 1.6, { taper: 0, wobble: 0.15 }); p.rivet(x + 8, 6, 2); }
  hazard(p, 76, 3, 40, 7, 4);
}

/** Rotorblatt von oben (128 x 16), dunkel / rotor blade from above, dark */
function paintBlade(p: Pen): void {
  const W = p.w, H = p.h;
  p.crease([[10, 3.5], [W - 10, 3.5]], 1.8, 2.1, 0.85, { taper: 0.1, wobble: 0 });
  for (const x of [0, W - 11]) p.fill([[x, 0], [x + 11, 0], [x + 11, H], [x, H]], mat.paper, 0.9);
  p.spot(W / 2, H / 2, 4, STEEL);
}

/** Zellen des Roboter-Atlas: Auswahl aus dem Fahrzeug-Baukasten (Laufwerk), Embleme, eigene Flaechen / cells of the robot atlas: a selection of the vehicle kit (running gear), emblems, own surfaces */
export function robotCells(): Cell[] {
  const kit = new Set(['link', 'linkSide', 'tyre', 'bay', 'wheel', 'sprocket', 'glowStrip']);
  return [
    ...trimCells().filter((c) => kit.has(c.name)),
    ...emblemCells(48),
    { name: 'rDeck', w: 256, h: 288, paint: paintDeck },
    { name: 'rSide', w: 448, h: 80, paint: paintSide },
    { name: 'rNose', w: 256, h: 56, paint: paintNose },
    { name: 'rTurret', w: 448, h: 64, paint: paintTurret },
    { name: 'rTop', w: 128, h: 128, paint: paintTop },
    { name: 'rCap', w: 96, h: 48, paint: paintCap },
    { name: 'rRail', w: 256, h: 24, paint: paintRail },
    { name: 'rLimb', w: 160, h: 160, paint: paintLimb },
    { name: 'rLimbDark', w: 96, h: 96, paint: paintLimbDark },
    { name: 'rHex', w: 192, h: 192, paint: paintHex },
    { name: 'rAbdomen', w: 256, h: 128, paint: paintAbdomen },
    { name: 'rFace', w: 96, h: 48, paint: paintFace },
    { name: 'rEye', w: 64, h: 40, paint: paintEye },
    { name: 'kCharge', w: 384, h: 176, paint: paintCharge },
    { name: 'rChest', w: 448, h: 160, paint: paintChest },
    { name: 'rHead', w: 192, h: 64, paint: paintHead },
    { name: 'rPauldron', w: 128, h: 96, paint: paintPauldron },
    { name: 'rFoot', w: 96, h: 112, paint: paintFoot },
    { name: 'rSword', w: 256, h: 48, paint: paintSword },
    { name: 'rBarrel', w: 96, h: 160, paint: paintBarrel },
    { name: 'rTank', w: 256, h: 192, paint: paintTank },
    { name: 'rPod', w: 256, h: 128, paint: paintPod },
    { name: 'rRing', w: 256, h: 24, paint: paintRing },
    { name: 'rBlade', w: 128, h: 16, paint: paintBlade },
  ];
}
