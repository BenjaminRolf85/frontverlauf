/**
 * Gezeichnete Einheiten der Gruppe Figuren: eigene Flaechen der Sonderfiguren (Pferd, Laeufer, Grauer, Roboter).
 * Inked units of group figures: own surfaces of the special figures (horse, walker, grey, robots).
 */
import { rng, shade } from '../kit';
import { mat } from '../look';
import { arc, rrect, spline, type Cell, type Pen } from './atlas';
import { stencil } from './trim';

// ---------- Pferd / horse ----------

/** Pferderumpf (Entwurf 256 x 160): s rundum (Ruecken in der Mitte), t von der Kruppe zur Brust / horse barrel (design 256 x 160): s around (back at the centre), t from croup to chest */
export function paintHorseBody(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  // Bauch heller, Ruecken mit Aalstrich / lighter belly, dorsal stripe on the back
  p.gradient(0, 0, W * 0.2, H, [0, 0], [W * 0.2, 0], 1.28, 1);
  p.gradient(W * 0.8, 0, W * 0.2, H, [W * 0.8, 0], [W, 0], 1, 1.28);
  p.crease([[cx, 6], [cx, H - 10]], 7, 0.72, 0.7, { taper: 0.2, wobble: 0.5 });
  for (const s of [-1, 1]) {
    // Hinterhand: Muskelbogen, Schulter vorn / haunch: muscle arc, shoulder in front
    p.line(spline([[cx + s * 26, 12], [cx + s * 62, 34], [cx + s * 80, 66]], 6), 1.8, { taper: 0.4 });
    p.shade(spline([[cx + s * 30, 10], [cx + s * 64, 32], [cx + s * 82, 64], [cx + s * 96, 30], [cx + s * 60, 8]], 6, true), 0.86, 0.5);
    p.line(spline([[cx + s * 40, H - 14], [cx + s * 66, H - 34], [cx + s * 78, H - 62]], 6), 1.7, { taper: 0.4 });
    p.line(spline([[cx + s * 88, H * 0.42], [cx + s * 104, H * 0.5], [cx + s * 96, H * 0.62]], 5), 1.3, { taper: 0.45 });
    // Rippen angedeutet: zwei kurze Boegen / ribs hinted: two short arcs
    for (const y of [H * 0.52, H * 0.6]) p.line(spline([[cx + s * 58, y - 6], [cx + s * 70, y], [cx + s * 76, y + 9]], 4), 1.1, { taper: 0.45 });
  }
  // Sattelgurt / girth
  p.band([[-2, H * 0.68], [W + 2, H * 0.68]], 9, shade(mat.wood, 0.6), 1.3);
  p.fill(rrect(W * 0.78 - 7, H * 0.68 - 6, 14, 12, 2), mat.metalLight);
  p.line(rrect(W * 0.78 - 7, H * 0.68 - 6, 14, 12, 2), 1.3, { closed: true, wobble: 0.1 });
}

/** Pferdekopf (Entwurf 128 x 112): s rundum (Nasenruecken in der Mitte), t vom Genick zum Maul; Auge, Nuester, Zaumzeug / horse head (design 128 x 112): s around (nose bridge at the centre), t from poll to muzzle; eye, nostril, bridle */
export function paintHorseHead(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  // Blesse / blaze
  p.fill(spline([[cx - 5, 18], [cx + 6, 20], [cx + 8, 60], [cx + 2, 84], [cx - 6, 62]], 5, true), mat.paper, 0.9);
  for (const s of [-1, 1]) {
    const ex = cx + s * 34, ey = 32;
    p.dab(ex, ey, 11, 0.74, 0.7);
    p.blot(spline([[ex - 8, ey + 1], [ex, ey - 6], [ex + 8, ey - 1], [ex + 2, ey + 6]], 5, true));
    p.erase(ex + s * 2, ey - 2, 1.6);
    p.spot(ex + s * 2, ey - 2, 2, mat.white);
    p.line(spline([[ex - 10, ey - 8], [ex, ey - 12], [ex + 10, ey - 8]], 4), 1.5, { taper: 0.4 });
    // Ganasche, Nuester, Maulspalte / cheek, nostril, mouth line
    p.line(spline([[cx + s * 44, 44], [cx + s * 50, 60], [cx + s * 40, 72]], 5), 1.3, { taper: 0.45 });
    p.blot(arc(cx + s * 16, H - 13, 4, 5.5, 0, Math.PI * 2, 10));
    p.line(spline([[cx + s * 30, H - 6], [cx + s * 46, H - 10], [cx + s * 58, H - 18]], 4), 1.6, { taper: 0.35 });
  }
  // Zaumzeug: Stirnriemen, Nasenriemen / bridle: brow band, noseband
  p.band([[-2, 16], [W + 2, 16]], 6, shade(mat.wood, 0.5), 1.2);
  p.band([[-2, 70], [W + 2, 70]], 6, shade(mat.wood, 0.5), 1.2);
  for (const s of [0.25, 0.75]) {
    p.band([[s * W, 16], [s * W, 70]], 5, shade(mat.wood, 0.5), 1.1);
    p.fill(arc(s * W, 72, 5.5, 5.5, 0, Math.PI * 2, 10), mat.metalLight);
    p.line(arc(s * W, 72, 5.5, 5.5, 0, Math.PI * 2, 10), 1.2, { closed: true, wobble: 0 });
  }
}

/** Pferdebein (Entwurf 96 x 160): oben Oberschenkel, unten Roehre mit Fessel / horse leg (design 96 x 160): upper leg above, cannon with fetlock below */
export function paintHorseLeg(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, m = H / 2;
  p.line(spline([[cx - 20, 12], [cx - 8, 40], [cx - 14, m - 10]], 5), 1.5, { taper: 0.4 });
  p.line(spline([[cx + 22, 20], [cx + 14, 46], [cx + 18, m - 8]], 5), 1.3, { taper: 0.45 });
  p.gradient(0, m - 16, W, 16, [0, m - 16], [0, m], 1, 0.82);
  // Sehne, Fesselbehang hell / tendon, light feathering at the fetlock
  p.line([[cx + 12, m + 12], [cx + 10, H - 36]], 1.2, { taper: 0.3, wobble: 0.3 });
  p.shade([[0, H - 30], [W, H - 30], [W, H], [0, H]], 1.5, 0.8);
  const R = rng(931);
  for (let x = 6; x < W; x += 12) p.line([[x, H - 30 + R() * 4], [x + 2, H - 12 - R() * 8]], 1.1, { taper: 0.4, wobble: 0.3 });
}

// ---------- Prototyp-Laeufer / prototype walker ----------

/** Kanzel des Laeufers (Entwurf 320 x 160): s rundum (Bug in der Mitte), t von oben nach unten / walker cockpit (design 320 x 160): s around (bow at the centre), t top to bottom */
export function paintWalkerHull(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.gradient(0, 0, W, H * 0.2, [0, 0], [0, H * 0.2], 1.16, 1);
  p.rivets([10, H * 0.14], [W - 10, H * 0.14], 16, 2.4);
  // Sichtschlitz: dunkles Glas im Rahmen mit Spiegelung / vision slit: dark glass in a frame with a reflection
  const slit = rrect(cx - 50, H * 0.26, 100, 24, 5);
  p.fill(slit, mat.glassDark);
  p.line(slit, 2, { closed: true, wobble: 0.15 });
  p.fill([[cx - 40, H * 0.26 + 3], [cx - 14, H * 0.26 + 3], [cx - 22, H * 0.26 + 18], [cx - 44, H * 0.26 + 18]], mat.white, 0.35);
  p.panel(rrect(cx - 58, H * 0.26 - 7, 116, 38, 6).concat([[cx + 52, H * 0.26 - 7]]), 1.5);
  // Warnstreifen am Bug / hazard stripes at the bow
  const y0 = H * 0.72, y1 = H * 0.86;
  p.fill([[cx - 74, y0], [cx + 74, y0], [cx + 74, y1], [cx - 74, y1]], mat.yellow);
  for (let x = cx - 80; x < cx + 70; x += 24) p.fill([[Math.max(cx - 74, x), y1], [Math.min(cx + 74, x + 11), y1], [Math.min(cx + 74, x + 22), y0], [Math.max(cx - 74, x + 11), y0]], mat.ink);
  p.line(rrect(cx - 74, y0, 148, y1 - y0, 1), 1.4, { closed: true, wobble: 0.15 });
  // Flanken: Lueftungsschlitze, Plattenfuge, Kennnummer rechts / flanks: vents, plate joint, number on the right
  for (const s of [0.25, 0.75]) {
    const x = s * W;
    p.panel([[x - 34, H * 0.2], [x - 34, H * 0.92]], 1.5);
    for (let i = 0; i < 4; i++) p.line([[x - 18, H * 0.36 + i * 9], [x + 18, H * 0.36 + i * 9]], 2, { taper: 0.1, wobble: 0 });
  }
  p.fill(rrect(W * 0.75 - 24, H * 0.7, 48, 22, 2), mat.paper);
  p.line(rrect(W * 0.75 - 24, H * 0.7, 48, 22, 2), 1.4, { closed: true, wobble: 0.1 });
  stencil(p, mat.ink, 'P-07', W * 0.75, H * 0.7 + 12, 15, 941);
  // Heck: Leitersprossen / rear: ladder rungs
  for (const x0 of [0, W - 26]) for (let i = 0; i < 4; i++) p.band([[x0 + 2, H * 0.3 + i * 22], [x0 + 24, H * 0.3 + i * 22]], 5, mat.metalLight, 1.1);
  p.rivets([10, H * 0.94], [W - 10, H * 0.94], 16, 2.4);
  p.scratches(0, H * 0.2, W, H * 0.5, 9, 943, 20);
  p.chips(0, H - 9, W, 8, 12, mat.metal, 945, 2.8);
}

/** Bein des Laeufers (Entwurf 128 x 128): oben Oberschenkelplatte, unten Unterschenkel; Fugen, Bolzen, Kolbenschatten / walker leg (design 128 x 128): thigh plate above, shin below; joints, bolts, piston shade */
export function paintWalkerLeg(p: Pen): void {
  const W = p.w, H = p.h, m = H / 2;
  for (const y0 of [0, m]) {
    p.panel(rrect(8, y0 + 7, W - 16, m - 14, 5).concat([[W - 13, y0 + 7]]), 1.5);
    for (const x of [16, W - 16]) for (const y of [y0 + 15, y0 + m - 15]) p.rivet(x, y, 2.4);
    p.crease([[W * 0.5, y0 + 12], [W * 0.5, y0 + m - 12]], 5, 0.74, 0.6, { taper: 0.15 });
    p.scratches(10, y0 + 10, W - 20, m - 20, 4, 951 + y0, 16);
  }
  p.chips(0, H - 14, W, 12, 8, mat.metal, 953, 2.8);
}

// ---------- Grauer / grey ----------

/** Anzug des Grauen (Entwurf 224 x 128): s rundum, t von der Schulter zum Becken; Nahtlinien, Leuchtnaehte, Guertel / the grey's suit (design 224 x 128): s around, t shoulder to pelvis; seams, glowing seams, belt */
export function paintGreySuit(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.gradient(0, 0, W, 14, [0, 0], [0, 14], 0.72, 1);
  for (const s of [-1, 1]) {
    p.line(spline([[cx + s * 16, 10], [cx + s * 20, H * 0.4], [cx + s * 14, H * 0.66]], 5), 1.4, { taper: 0.3, wobble: 0.3 });
    p.mark(spline([[cx + s * 34, 16], [cx + s * 38, H * 0.36], [cx + s * 30, H * 0.64]], 5), 2.4, mat.acid, 0.95, { taper: 0.15, wobble: 0.1 });
    p.line(spline([[cx + s * 62, 30], [cx + s * 52, H * 0.44], [cx + s * 56, H * 0.6]], 5), 1.2, { taper: 0.45 });
    // Rueckengeraet: Anschlussplatte / back unit: mounting plate
    p.panel(rrect(cx + s * 112 - (s > 0 ? 26 : 0), 22, 26, 44, 4).concat([[cx + s * 112, 22]]), 1.3);
  }
  // Guertel mit Leuchtschnalle und Taschen / belt with a glowing buckle and pouches
  const by = H * 0.74;
  p.line([[-2, by - 7], [W + 2, by - 7]], 1.5, { taper: 0, wobble: 0.2 });
  p.line([[-2, by + 7], [W + 2, by + 7]], 1.5, { taper: 0, wobble: 0.2 });
  p.fill(rrect(cx - 8, by - 5, 16, 10, 2), mat.acid);
  p.line(rrect(cx - 8, by - 5, 16, 10, 2), 1.4, { closed: true, wobble: 0.1 });
  for (const s of [-1, 1]) p.line(rrect(cx + s * 34 - 9, by - 6, 18, 14, 3), 1.3, { closed: true, wobble: 0.2 });
  p.line([[cx, by + 9], [cx, H - 3]], 1.2, { taper: 0.3 });
}

// ---------- Roboter / robots ----------

/** Rumpf der Roboter (Entwurf 256 x 128): s rundum, t von der Schulter zur Taille; Kernring, Leuchtfugen, Lueftung / robot torso (design 256 x 128): s around, t shoulder to waist; core ring, glowing joints, vents */
export function paintBotTorso(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, cy = H * 0.42;
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.06, 0.86);
  // Kern: dunkle Fassung mit Ring / core: dark socket with a ring
  p.fill(arc(cx, cy, 19, 19, 0, Math.PI * 2, 22), mat.gunmetal);
  p.line(arc(cx, cy, 19, 19, 0, Math.PI * 2, 22), 2, { closed: true, wobble: 0.1 });
  p.line(arc(cx, cy, 12.5, 12.5, 0, Math.PI * 2, 16), 1.3, { closed: true, wobble: 0.1 });
  for (const s of [-1, 1]) {
    // Leuchtfuge schraeg zur Schulter, Plattenfuge, Schrauben / glowing joint slanting to the shoulder, plate joint, screws
    p.mark([[cx + s * 26, cy - 4], [cx + s * 46, 14]], 3, mat.cyanGlow, 0.95, { taper: 0.1, wobble: 0 });
    p.mark([[cx + s * 26, cy + 6], [cx + s * 40, H - 16]], 3, mat.cyanGlow, 0.95, { taper: 0.1, wobble: 0 });
    p.panel(spline([[cx + s * 58, 8], [cx + s * 54, H * 0.5], [cx + s * 60, H - 8]], 5), 1.5);
    for (const y of [16, H - 16]) p.rivet(cx + s * 70, y, 2.3);
    // Rueckenplatte: Lueftung / back plate: vents
    for (let i = 0; i < 4; i++) p.line([[cx + s * 100, 30 + i * 12], [cx + s * 122, 30 + i * 12]], 2, { taper: 0.1, wobble: 0 });
  }
  p.panel([[20, H - 12], [W - 20, H - 12]], 1.4);
  p.scratches(0, 12, W, H - 30, 6, 961, 16);
  p.fill([[cx - 44, 10], [cx - 36, 9], [cx - 40, 34], [cx - 46, 34]], mat.white, 0.4);
}

/** Glied der Roboter (Entwurf 96 x 128): Platte mit Fuge, Leuchtstreifen, Bolzen / robot limb (design 96 x 128): plate with a joint, light strip, bolts */
export function paintBotLimb(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.panel(rrect(8, 8, W - 16, H - 16, 6).concat([[W - 14, 8]]), 1.5);
  p.mark([[cx, 22], [cx, H - 30]], 3, mat.cyanGlow, 0.9, { taper: 0.1, wobble: 0 });
  for (const x of [17, W - 17]) for (const y of [17, H - 17]) p.rivet(x, y, 2.3);
  p.crease([[0, H - 4], [W, H - 4]], 5, 0.7, 0.8, { taper: 0, wobble: 0.1 });
  p.scratches(8, 10, W - 16, H - 22, 4, 971, 14);
}

/** eigene Zellen der Sonderfiguren, um k skaliert / own cells of the special figures, scaled by k */
export function uniqueCells(k = 1): Cell[] {
  const c = (name: string, w: number, h: number, paint: (p: Pen) => void): Cell => ({ name, w: Math.max(16, Math.round(w * k)), h: Math.max(12, Math.round(h * k)), design: [w, h], paint });
  return [
    c('horseBody', 256, 160, paintHorseBody),
    c('horseHead', 128, 112, paintHorseHead),
    c('horseLeg', 96, 160, paintHorseLeg),
    c('walkerHull', 320, 160, paintWalkerHull),
    c('walkerLeg', 128, 128, paintWalkerLeg),
    c('greySuit', 224, 128, paintGreySuit),
    c('botTorso', 256, 128, paintBotTorso),
    c('botLimb', 96, 128, paintBotLimb),
  ];
}
