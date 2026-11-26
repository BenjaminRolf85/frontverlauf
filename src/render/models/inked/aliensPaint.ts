/**
 * Gezeichnete Einheiten: Zeichnung der Zyrr-Maschinen (Atlas 'alien') / inked units: drawing of the Zyrr machines (atlas 'alien').
 *
 * Organisch statt genietet: geschwungene Naehte, Rippen, Pigmentflecken, Kiemenschlitze, Saugnaepfe, Leuchtknoten.
 * Glas traegt Lichtreflexe und den Umriss des Piloten. Leuchtfarben (mat.acid, mat.xenoGlow) sind Grundstoffe der
 * Zyrr, keine Fraktionsfarben, und duerfen deshalb als deckende Farbe in neutralen Zellen stehen.
 * Organic instead of riveted: curved seams, ribs, pigment spots, gill slits, suckers, glow nodes. Glass carries
 * reflections and the pilot's outline. The glow colours (mat.acid, mat.xenoGlow) are Zyrr base materials, not faction
 * colours, so they may stand as opaque colour in neutral cells.
 */
import { mix, rng } from '../kit';
import { mat } from '../look';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { rect, ring } from './navalPaint';
import { SOOT } from './trim';

/** Leuchtknoten: heller Kern mit Tuschering / glow node: bright core with an ink ring */
export function node(p: Pen, x: number, y: number, r: number, c = mat.acid): void {
  p.fill(ring(x, y, r, 10), c);
  p.spot(x - r * 0.25, y - r * 0.25, r * 0.4, mat.white, 0.7);
  p.line(ring(x, y, r, 10), Math.max(1, r * 0.3), { closed: true, wobble: 0.08 });
}
/** Unregelmaessiger Fleck als Punkte / irregular blotch as points */
export function blotch(R: () => number, x: number, y: number, r: number, sx = 1.3, sy = 0.9): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, rr = r * (0.6 + R() * 0.6); pts.push([x + Math.cos(a) * rr * sx, y + Math.sin(a) * rr * sy]); }
  return spline(pts, 4, true);
}
/** Pigmentflecken: wenige flache Flecken, dunkel und hell / pigment spots: a few flat blotches, dark and light */
export function pigment(p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number, size = 9): void {
  const R = rng(seed);
  for (let i = 0; i < n; i++) p.shade(blotch(R, x + R() * w, y + R() * h, size * (0.5 + R() * 0.8)), i % 3 === 0 ? 1.18 : 0.82, 0.8);
}

/** Oberseite der Scheibe (240 x 240), von oben, Bug oben: Speichennaehte, Ringfugen, Luken, Schlitze, Knoten / top of the disc from above, bow up: spoke seams, ring joints, hatches, slots, nodes */
function paintSaucerTop(p: Pen): void {
  const c = p.w / 2, R = c / 1.02;
  // zwei Ringfugen, zwoelf Speichen zwischen ihnen und dem Rand, versetzt / two ring joints, twelve spokes between them and the rim, staggered
  for (const k of [0.5, 0.82]) p.line(ring(c, c, R * k, 40), 1.5, { closed: true, wobble: 0.25, press: 0.2 });
  p.crease(arc(c + 1.2, c + 1.2, R * 0.5, R * 0.5, 0.2, 1.9, 12), 1.4, 1.5, 0.7, { taper: 0.2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const [r0, r1] = i % 2 ? [0.5, 0.82] : [0.82, 0.985];
    p.line([[c + Math.cos(a) * R * r0, c + Math.sin(a) * R * r0], [c + Math.cos(a) * R * r1, c + Math.sin(a) * R * r1]], 1.2, { taper: 0.06, wobble: 0.2 });
  }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.4; p.line([[c + Math.cos(a) * R * 0.36, c + Math.sin(a) * R * 0.36], [c + Math.cos(a) * R * 0.5, c + Math.sin(a) * R * 0.5]], 1.1, { taper: 0.1, wobble: 0.2 }); }
  // Luftschlitze beiderseits, Wartungsluke, Leuchtknoten / air slots on both sides, access hatch, glow nodes
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const a = (s > 0 ? 0 : Math.PI) + (i - 1) * 0.16, r0 = R * 0.6, r1 = R * 0.74;
    p.line([[c + Math.cos(a) * r0, c + Math.sin(a) * r0], [c + Math.cos(a) * r1, c + Math.sin(a) * r1]], 3.2, { taper: 0.1, wobble: 0 });
  }
  const hatch = arc(c, c, R * 0.66, R * 0.66, Math.PI * 0.36, Math.PI * 0.64, 8).concat(arc(c, c, R * 0.78, R * 0.78, Math.PI * 0.64, Math.PI * 0.36, 8));
  p.shade(hatch, 0.86, 0.9);
  p.line(hatch, 1.3, { closed: true, wobble: 0.15 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.92; node(p, c + Math.cos(a) * R * 0.905, c + Math.sin(a) * R * 0.905, 3.4, i % 2 ? mat.acid : mat.xenoGlow); }
  pigment(p, c - R * 0.8, c - R * 0.8, R * 1.6, R * 1.6, 9, 901, 10);
  p.scratches(c - R * 0.7, c - R * 0.7, R * 1.4, R * 1.4, 6, 903, 20);
}

/** Unterseite der Scheibe (160 x 160): Leuchtring und Duesenringe / underside of the disc: glow ring and thruster rings */
function paintSaucerBottom(p: Pen): void {
  const c = p.w / 2, R = c / 1.02;
  p.mark(ring(c, c, R * 0.55, 32).concat([[c + R * 0.55, c]]), 7, mat.acid, 1, { taper: 0, wobble: 0.1, press: 0.1 });
  for (const k of [0.55 - 0.055, 0.55 + 0.055, 0.86]) p.line(ring(c, c, R * k, 32), 1.3, { closed: true, wobble: 0.2 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; node(p, c + Math.cos(a) * R * 0.76, c + Math.sin(a) * R * 0.76, 4, mat.xenoGlow); }
}

/** Randwulst (256 x 20): s rundum; Lichter im Wechsel, dazwischen Fugen / rim bead: s around; alternating lights with joints between */
function paintRim(p: Pen): void {
  const W = p.w, H = p.h;
  for (let i = 0; i < 16; i++) {
    const x = (i + 0.5) * (W / 16);
    node(p, x, H / 2, 3.1, i % 2 ? mat.acid : mat.xenoGlow);
    if (i % 4 === 0) p.line([[x + W / 32, 2], [x + W / 32, H - 2]], 1.1, { taper: 0.1, wobble: 0.1 });
  }
}

/** Glaskuppel (192 x 96): s rundum (vorn in der Mitte), t Scheitel -> Rahmen; Pilot als Umriss, Reflexe / glass dome: s around (front in the middle), t apex -> frame; the pilot as an outline, reflections */
function paintCanopy(p: Pen): void {
  const W = p.w, H = p.h;
  // Pilot: grosser Kopf mit schraegen Augen / pilot: big head with slanted eyes
  const head = spline([[W / 2 - 22, H - 12], [W / 2 - 25, H - 40], [W / 2 - 14, H - 62], [W / 2, H - 67], [W / 2 + 14, H - 62], [W / 2 + 25, H - 40], [W / 2 + 22, H - 12]], 5);
  p.fill(head, mix(mat.alienSkinDark, SOOT, 0.35), 0.92);
  p.line(head, 1.5, { taper: 0.1, wobble: 0.2 });
  for (const s of [-1, 1]) {
    const eye = spline([[W / 2 + s * 4, H - 38], [W / 2 + s * 11, H - 46], [W / 2 + s * 19, H - 44], [W / 2 + s * 13, H - 34]], 4, true);
    p.fill(eye, mat.acid);
    p.line(eye, 1.2, { closed: true, wobble: 0.1 });
  }
  // Rahmenrippen und Reflexe / frame ribs and reflections
  for (const x of [W * 0.2, W * 0.8]) p.line(spline([[x, 4], [x + 3, H / 2], [x, H - 13]], 4), 1.6, { taper: 0.1, wobble: 0.2 });
  p.fill([[W * 0.56, H - 24], [W * 0.66, 20], [W * 0.72, 20], [W * 0.63, H - 24]], mat.white, 0.42);
  p.fill([[W * 0.3, H - 30], [W * 0.36, 30], [W * 0.39, 30], [W * 0.34, H - 30]], mat.white, 0.3);
  p.line([[-3, H - 11], [W + 3, H - 11]], 1.4, { taper: 0, wobble: 0.2 });
}

/** Panzerruecken (320 x 112): s rundum, t Scheitel -> Rand; Rippen laufen vom Scheitel zum Rand / carapace: s around, t apex -> rim; ribs run from the apex to the rim */
function paintCarapace(p: Pen): void {
  const W = p.w, H = p.h, R = rng(911);
  for (let i = 0; i < 10; i++) {
    const x = (i + 0.5) * (W / 10);
    const pts = spline([[x + (R() - 0.5) * 3, 12], [x + 2, H * 0.5], [x + (R() - 0.5) * 4, H - 5]], 5);
    p.crease(pts.map((q): Pt => [q[0] + 2, q[1]]), 2.2, 1.4, 0.7, { taper: 0.25, wobble: 0.3 });
    p.line(pts, 1.5, { taper: 0.3, wobble: 0.35, press: 0.4 });
  }
  pigment(p, 0, 16, W, H - 30, 12, 913, 9);
  // Schatten unter dem Rand, Kerben / shadow under the rim, nicks
  p.gradient(0, H * 0.8, W, H * 0.2, [0, H * 0.8], [0, H], 1, 0.8);
  p.chips(0, H - 9, W, 7, 10, mix(mat.alienSkin, mat.white, 0.3), 915, 2.4);
}

/** Bauch (320 x 80): s rundum (vorn in der Mitte), t Rand -> unten; drei Augen, Kiemen, Leuchtporen / belly: s around (front in the middle), t rim -> bottom; three eyes, gills, glowing pores */
function paintBelly(p: Pen): void {
  const W = p.w, R = rng(921);
  p.shade(rect(0, 0, W, 7), 0.74, 0.9);
  for (const [dx, dy, r] of [[-27, 28, 11.5], [27, 28, 11.5], [0, 15, 8.5]] as [number, number, number][]) {
    const x = W / 2 + dx, y = dy;
    p.fill(ring(x, y, r, 16, r * 0.82), SOOT);
    p.line(ring(x, y, r, 16, r * 0.82), 1.8, { closed: true, wobble: 0.12 });
    p.fill(ring(x + 1, y + 1, r * 0.42, 10), mat.acid);
    p.spot(x - r * 0.3, y - r * 0.3, r * 0.2, mat.white, 0.9);
    p.crease(arc(x, y, r + 2.5, r * 0.82 + 2.5, Math.PI * 1.1, Math.PI * 1.9, 8), 1.6, 0.72, 0.8, { taper: 0.3 });
  }
  // Kiemenschlitze an den Flanken / gill slits on the flanks
  for (const cx of [W * 0.25, W * 0.75]) for (let i = 0; i < 4; i++) {
    const x = cx - 20 + i * 12;
    p.line(spline([[x, 14], [x + 4, 27], [x + 2, 40]], 4), 2.6, { taper: 0.35, wobble: 0.2 });
    p.crease(spline([[x + 3, 15], [x + 7, 27], [x + 5, 39]], 4), 1.2, 1.5, 0.7, { taper: 0.35 });
  }
  for (let i = 0; i < 11; i++) node(p, 12 + R() * (W - 24), 46 + R() * 22, 1.8 + R() * 1.2, mat.acid);
  for (const y of [50, 64]) p.line(spline([[W * 0.34, y], [W / 2, y + 5], [W * 0.66, y]], 5), 1.1, { taper: 0.4, wobble: 0.4 });
}

/** Behaelter (128 x 96): s rundum, t oben -> unten; Glas mit Blasen, Fuellstand, Reflex / vessel: s around, t top -> bottom; glass with bubbles, fill level, reflection */
function paintTank(p: Pen): void {
  const W = p.w, H = p.h, R = rng(931);
  for (const y of [H * 0.16, H * 0.84]) p.line([[-3, y], [W + 3, y]], 1.4, { taper: 0, wobble: 0.15 });
  p.shade(rect(0, H * 0.18, W, H * 0.14), 0.8, 0.8);
  p.line(spline([[0, H * 0.32], [W * 0.3, H * 0.34], [W * 0.6, H * 0.31], [W, H * 0.32]], 5), 1.1, { taper: 0, wobble: 0.3 });
  for (let i = 0; i < 9; i++) { const x = 6 + R() * (W - 12), y = H * 0.38 + R() * H * 0.4, r = 1.6 + R() * 2.4; p.spot(x, y, r, mat.white, 0.55); p.line(ring(x, y, r, 8), 0.9, { closed: true, wobble: 0 }); }
  for (const x of [W * 0.28, W * 0.8]) p.fill([[x, H * 0.22], [x + 7, H * 0.22], [x + 5, H * 0.78], [x - 2, H * 0.78]], mat.white, 0.35);
  for (const x of [20, 64, 108]) { p.rivet(x, H * 0.08, 2); p.rivet(x, H * 0.92, 2); }
}

/** Tentakel (96 x 256): s rundum (Aussenseite in der Mitte), t Ansatz -> Spitze; Ringfalten, Saugnaepfe an der Unterseite / tentacle: s around (outer side in the middle), t root -> tip; ring folds, suckers on the underside */
function paintTentacle(p: Pen): void {
  const W = p.w, H = p.h, R = rng(941);
  for (let y = 22 + R() * 10; y < H - 16; y += 30 + R() * 16) {
    p.line(spline([[W * 0.14, y + 3], [W / 2, y - 3], [W * 0.86, y + 3]], 5), 1.5, { taper: 0.3, wobble: 0.3 });
    p.crease(spline([[W * 0.18, y + 6], [W / 2, y], [W * 0.82, y + 6]], 5), 2, 0.8, 0.7, { taper: 0.3 });
  }
  for (let y = 16; y < H - 10; y += 26) for (const x of [7, W - 7]) {
    const r = 4.4 - (y / H) * 2;
    p.fill(ring(x, y, r, 10), mix(mat.alienSkin, mat.acid, 0.35));
    p.line(ring(x, y, r, 10), 1.1, { closed: true, wobble: 0.1 });
    p.dot(x, y, r * 0.3);
  }
  pigment(p, W * 0.2, 10, W * 0.6, H - 20, 7, 943, 7);
}

/** Beinpanzer (160 x 128): s rundum (vorn in der Mitte), t Huefte -> Knie; Platte mit Leuchtschlitz / leg armour: s around (front in the middle), t hip -> knee; plate with a glow slit */
function paintLegPlate(p: Pen): void {
  const W = p.w, H = p.h;
  const plate = spline([[W * 0.22, 14], [W / 2, 8], [W * 0.78, 14], [W * 0.84, H * 0.55], [W * 0.7, H - 12], [W / 2, H - 6], [W * 0.3, H - 12], [W * 0.16, H * 0.55]], 5, true);
  p.shade(plate, 1.14, 0.8);
  p.line(plate, 1.7, { closed: true, wobble: 0.25, press: 0.3 });
  p.fill(rrect(W / 2 - 3.5, 30, 7, H - 62, 3.5), mat.acid);
  p.line(rrect(W / 2 - 3.5, 30, 7, H - 62, 3.5), 1.3, { closed: true, wobble: 0.1 });
  for (const [x, y] of [[W * 0.3, 30], [W * 0.7, 30], [W * 0.3, H - 30], [W * 0.7, H - 30]]) { p.dab(x, y, 3.4, 0.76, 0.9); p.line(ring(x, y, 3.4, 8), 1.1, { closed: true, wobble: 0.1 }); }
  p.scratches(W * 0.25, 20, W * 0.5, H - 40, 5, 951, 16);
}

/** Glied (128 x 160): s rundum, t entlang; Kolbenstange, zwei Manschetten, Leitung / limb: s around, t along; piston rod, two cuffs, a lead */
function paintLimb(p: Pen): void {
  const W = p.w, H = p.h;
  for (const y of [22, H - 26]) { p.shade(rect(0, y, W, 9), 0.8, 0.9); for (const dy of [0, 9]) p.line([[-3, y + dy], [W + 3, y + dy]], 1.3, { taper: 0, wobble: 0.15 }); }
  p.crease([[W / 2 + 4, 34], [W / 2 + 4, H - 30]], 2.6, 1.6, 0.7, { taper: 0.05, wobble: 0.1 });
  p.line([[W / 2 - 4, 33], [W / 2 - 4, H - 28]], 1.2, { taper: 0.05, wobble: 0.15 });
  p.line([[W / 2 + 9, 33], [W / 2 + 9, H - 28]], 1.2, { taper: 0.05, wobble: 0.15 });
  p.line(spline([[W * 0.2, 34], [W * 0.26, H / 2], [W * 0.18, H - 30]], 5), 1.8, { taper: 0.1, wobble: 0.3 });
  node(p, W * 0.8, H * 0.5, 3, mat.acid);
}

/** Rumpf des Mechs (384 x 112): s rundum (vorn in der Mitte), t Dach -> Unterkante / the mech's body: s around (front in the middle), t roof -> lower edge */
function paintMechBody(p: Pen): void {
  const W = p.w, H = p.h;
  // geschwungene Naehte an beiden Flanken, Leuchtschlitze, Wartungsluke / curved seams on both flanks, glow slits, access hatch
  for (const s of [-1, 1]) {
    const cx = W / 2 + s * W * 0.25;
    p.line(spline([[cx - 40, 14], [cx - 26, H * 0.4], [cx - 44, H - 10]], 6), 1.5, { taper: 0.1, wobble: 0.3 });
    p.line(spline([[cx + 44, 12], [cx + 30, H * 0.45], [cx + 46, H - 8]], 6), 1.5, { taper: 0.1, wobble: 0.3 });
    for (const dx of [-12, 2]) { p.fill(rrect(cx + dx, H * 0.64, 9, 22, 4), mat.acid); p.line(rrect(cx + dx, H * 0.64, 9, 22, 4), 1.2, { closed: true, wobble: 0.1 }); }
  }
  // vorn unter der Kuppel: Atemschlitze; hinten: Luken / front below the dome: breather slots; back: hatches
  for (let i = 0; i < 4; i++) p.line([[W / 2 - 20 + i * 2, H * 0.66 + i * 7], [W / 2 + 20 - i * 2, H * 0.66 + i * 7]], 2.4, { taper: 0.2, wobble: 0.1 });
  for (const x of [22, W - 46]) { p.shade(rrect(x, H * 0.58, 24, 30, 7), 0.84, 0.9); p.line(rrect(x, H * 0.58, 24, 30, 7), 1.3, { closed: true, wobble: 0.15 }); }
  p.line([[-3, H - 4], [W + 3, H - 4]], 1.3, { taper: 0, wobble: 0.3 });
  pigment(p, 0, 8, W, H * 0.3, 7, 961, 9);
  p.scratches(20, 14, W - 40, H - 30, 8, 963, 20);
}

/** Armkanone (128 x 160): s rundum (oben in der Mitte), t Verschluss -> Muendung; Kuehlrippen, Naht, Zufuhr / arm cannon: s around (top in the middle), t breech -> muzzle; cooling fins, seam, feed */
function paintCannon(p: Pen): void {
  const W = p.w, H = p.h;
  p.line([[W / 2, 6], [W / 2, H * 0.3]], 1.3, { taper: 0.1, wobble: 0.2 });
  for (const x of [W * 0.22, W * 0.78]) { p.shade(rrect(x - 9, 12, 18, 30, 5), 0.82, 0.9); p.line(rrect(x - 9, 12, 18, 30, 5), 1.3, { closed: true, wobble: 0.15 }); }
  for (let i = 0; i < 3; i++) p.line([[W * 0.36, H * 0.8 + i * 7], [W * 0.64, H * 0.8 + i * 7]], 2.2, { taper: 0.15, wobble: 0.1 });
  p.gradient(0, H * 0.9, W, H * 0.1 + 2, [0, H * 0.9], [0, H], 1, 0.55);
}

/** Raketenkapsel von vorn (64 x 64): vier Rohre mit Leuchtspitzen / missile pod from the front: four tubes with glowing tips */
function paintPod(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(4, 4, W - 8, H - 8, 6), 1.5, { closed: true, wobble: 0.15 });
  for (const x of [W * 0.3, W * 0.7]) for (const y of [H * 0.3, H * 0.7]) {
    p.fill(ring(x, y, 9, 12), SOOT);
    p.line(ring(x, y, 9, 12), 1.4, { closed: true, wobble: 0.1 });
    p.fill(ring(x, y, 4, 8), mat.acid);
  }
}

/** Flosse (48 x 48) / fin */
function paintFin(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(spline([[6, H - 6], [W * 0.5, H * 0.5], [W - 8, 8]], 4), 1.2, { taper: 0.3, wobble: 0.3 });
  p.crease([[4, 5], [W - 4, 5]], 1.8, 1.5, 0.8, { taper: 0.1 });
}

/** Zellen der Zyrr-Maschinen / cells of the Zyrr machines */
export function alienCells(): Cell[] {
  return [
    { name: 'saucerTop', w: 240, h: 240, paint: paintSaucerTop },
    { name: 'saucerBottom', w: 160, h: 160, paint: paintSaucerBottom },
    { name: 'rim', w: 256, h: 20, paint: paintRim },
    { name: 'canopy', w: 192, h: 96, paint: paintCanopy },
    { name: 'carapace', w: 320, h: 112, paint: paintCarapace },
    { name: 'belly', w: 320, h: 80, paint: paintBelly },
    { name: 'tank', w: 128, h: 96, paint: paintTank },
    { name: 'tentacle', w: 96, h: 256, paint: paintTentacle },
    { name: 'legPlate', w: 160, h: 128, paint: paintLegPlate },
    { name: 'limb', w: 128, h: 160, paint: paintLimb },
    { name: 'mechBody', w: 384, h: 112, paint: paintMechBody },
    { name: 'cannon', w: 128, h: 160, paint: paintCannon },
    { name: 'pod', w: 64, h: 64, paint: paintPod },
    { name: 'fin', w: 48, h: 48, paint: paintFin },
  ];
}
