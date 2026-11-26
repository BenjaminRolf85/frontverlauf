/**
 * Gezeichnete Einheiten der Gruppe Figuren: Zeichnung des Beiwerks (Formen in props.ts).
 * Inked units of group figures: drawing of the props (shapes in props.ts).
 *
 * Wenige allgemeine Zellen fuer viele Teile: Rohr, Platte, Schild, Holz, Tuch, Tank, Koffer, Klinge, Sandsack. Die
 * Farbe kommt aus der Vertexfarbe, die Zeichnung ist neutral (Fugen, Nieten, Naehte, Kratzer, Rost, Schlamm).
 * A few generic cells for many parts: tube, plate, shield, wood, cloth, tank, case, blade, sandbag. The colour comes
 * from the vertex colour, the drawing is neutral (joints, rivets, seams, scratches, rust, mud).
 */
import { MUD as MUD_BASE } from '../detailVehicles';
import { mix, rng, shade } from '../kit';
import { mat } from '../look';
import { arc, rrect, spline, type Cell, type Pen } from './atlas';

const STEEL = mat.metalLight;
const BARE = mix(mat.metal, mat.dark, 0.25);
const MUD = shade(MUD_BASE, 0.6);
const LEATHER = mat.wood;

/** Raketenrohr (Entwurf 96 x 256): s rundum (oben in der Mitte), t vom Trichter zur Spitze / rocket tube (design 96 x 256): s around (top at the centre), t from the flare to the tip */
export function paintTube(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  // Schweissnaht oben, Schablone, Griffmulden / weld seam on top, stencil mark, grip recesses
  p.line([[cx, H * 0.14], [cx, H * 0.78]], 1.3, { taper: 0.05, wobble: 0.3 });
  p.crease([[cx + 2.5, H * 0.14], [cx + 2.5, H * 0.78]], 2, 1.5, 0.7, { taper: 0.05, wobble: 0.3 });
  for (const y of [H * 0.3, H * 0.34]) p.mark([[W * 0.64, y], [W * 0.86, y]], 2.6, mat.paper, 0.9, { taper: 0, wobble: 0.1 });
  p.mark([[W * 0.64, H * 0.38], [W * 0.76, H * 0.38]], 2.6, mat.paper, 0.9, { taper: 0, wobble: 0.1 });
  // Pfeil zur Muendung / arrow towards the muzzle
  p.fill([[W * 0.16, H * 0.5], [W * 0.26, H * 0.5], [W * 0.21, H * 0.56]], mat.paper, 0.9);
  for (const s of [0.12, 0.88]) p.rivets([s * W, H * 0.2], [s * W, H * 0.7], 4, 2.2);
  p.scratches(0, H * 0.12, W, H * 0.6, 9, 811, 18);
  p.chips(0, H * 0.1, W, 8, 6, BARE, 813, 2.6);
  p.chips(0, H * 0.74, W, 8, 6, BARE, 815, 2.6);
  // Russ am Trichter und an der Spitze / soot at the flare and at the tip
  p.gradient(0, 0, W, H * 0.1, [0, 0], [0, H * 0.1], 0.5, 1);
  p.gradient(0, H * 0.92, W, H * 0.08 + 2, [0, H * 0.92], [0, H], 1, 0.7);
}

/** Allgemeine Platte (Entwurf 160 x 160): Rand, Nieten in den Ecken, Kratzer, Abplatzer / generic plate (design 160 x 160): border, corner rivets, scratches, chips */
export function paintPlate(p: Pen): void {
  const W = p.w, H = p.h;
  p.panel(rrect(6, 6, W - 12, H - 12, 7).concat([[W - 13, 6]]), 1.7);
  for (const x of [15, W - 15]) for (const y of [15, H - 15]) p.rivet(x, y, 2.8);
  for (const x of [W / 2]) for (const y of [15, H - 15]) p.rivet(x, y, 2.4);
  p.scratches(10, 12, W - 20, H - 24, 9, 821, 22);
  p.chips(0, 0, W, 9, 7, BARE, 823, 2.8);
  p.chips(0, H - 9, W, 9, 7, BARE, 825, 2.8);
  p.fill([[20, 24], [34, 22], [26, 60], [16, 60]], mat.white, 0.3);
}

/** Schild (Entwurf 144 x 224): Nietrand, Sehschlitz, Beulen, Kratzer / shield (design 144 x 224): rivet border, vision slit, dents, scratches */
export function paintShield(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.panel(rrect(7, 7, W - 14, H - 14, 8).concat([[W - 15, 7]]), 1.8);
  p.rivets([16, 17], [W - 16, 17], 6, 2.6);
  p.rivets([16, H - 17], [W - 16, H - 17], 6, 2.6);
  for (const x of [16, W - 16]) p.rivets([x, 46], [x, H - 46], 5, 2.4);
  // Sehschlitz: dunkles Glas im Rahmen / vision slit: dark glass in a frame
  const slit = rrect(cx - 36, 38, 72, 13, 3);
  p.fill(slit, mat.ink);
  p.line(slit, 1.8, { closed: true, wobble: 0.15 });
  p.fill([[cx - 30, 40], [cx - 12, 40], [cx - 16, 47], [cx - 32, 47]], mat.white, 0.35);
  p.line(rrect(cx - 42, 32, 84, 25, 4), 1.3, { closed: true, wobble: 0.2 });
  // Beulen und Einschlaege / dents and hits
  for (const [x, y, r] of [[cx - 30, H * 0.66, 9], [cx + 34, H * 0.4, 7], [cx + 12, H * 0.8, 6]] as [number, number, number][]) {
    p.dab(x, y, r, 0.76, 0.8);
    p.line(arc(x, y, r * 0.8, r * 0.7, 0.4, 2.8, 6), 1.3, { taper: 0.35 });
    p.dab(x - r * 0.3, y - r * 0.3, r * 0.4, 1.4, 0.7);
  }
  p.scratches(14, 64, W - 28, H - 90, 12, 831, 26);
  p.chips(0, H - 12, W, 10, 8, BARE, 833, 3);
  p.splatter(0, H * 0.72, W, H * 0.28, 12, MUD, 835, { size: 4, alpha: 0.7 });
}

/** Holz (Entwurf 160 x 96): drei Bretter, Naegel, wenig Maserung, ein Ast / wood (design 160 x 96): three boards, nails, a little grain, one knot */
export function paintWood(p: Pen): void {
  const W = p.w, H = p.h;
  const R = rng(841);
  for (const y of [H / 3, (2 * H) / 3]) {
    p.line([[-2, y], [W + 2, y]], 1.6, { taper: 0, wobble: 0.5 });
    p.crease([[0, y + 2.4], [W, y + 2.4]], 2.4, 0.74, 0.7, { taper: 0, wobble: 0.5 });
  }
  for (const y of [H / 6, H / 2, (5 * H) / 6]) {
    for (const x of [9, W - 9]) { p.dot(x, y, 1.9); p.spot(x - 0.7, y - 0.7, 0.8, mat.white, 0.7); }
    const a = 20 + R() * 40, b = a + 30 + R() * 50;
    p.line(spline([[a, y - 4 + R() * 8], [(a + b) / 2, y + (R() - 0.5) * 8], [b, y - 4 + R() * 8]], 5), 1, { taper: 0.45, wobble: 0.5 });
  }
  p.line(arc(W * 0.66, H * 0.2, 5, 3.4, 0, Math.PI * 2, 10), 1.2, { closed: true, wobble: 0.3 });
  p.dab(W * 0.66, H * 0.2, 3, 0.6, 0.8);
  p.line(rrect(2, 2, W - 4, H - 4, 3), 1.5, { closed: true, wobble: 0.4 });
  p.splatter(0, H * 0.6, W, H * 0.4, 8, MUD, 843, { size: 3.4, alpha: 0.6 });
}

/** Tuch (Entwurf 128 x 160): Saumnaht, Falten, ausgefranste Unterkante / cloth (design 128 x 160): hem stitching, folds, frayed lower edge */
export function paintCloth(p: Pen): void {
  const W = p.w, H = p.h;
  const R = rng(851);
  p.line(rrect(2, 2, W - 4, H - 4, 2), 1.5, { closed: true, wobble: 0.4 });
  p.stitch([[7, 6], [7, H - 12]], 3.2, 2.8, 0.9, 0.6);
  p.stitch([[W - 7, 6], [W - 7, H - 12]], 3.2, 2.8, 0.9, 0.6);
  p.gradient(0, 0, W, 14, [0, 0], [0, 14], 0.74, 1);
  for (const s of [0.24, 0.52, 0.8]) {
    const x = s * W;
    p.line(spline([[x, 10], [x + 6, H * 0.5], [x - 3, H - 14]], 5), 1.4, { taper: 0.4, wobble: 0.5 });
    p.crease(spline([[x + 7, 16], [x + 13, H * 0.5], [x + 4, H - 12]], 5), 7, 0.8, 0.55, { taper: 0.3 });
  }
  for (let x = 6; x < W - 4; x += 13 + R() * 9) p.fill([[x, H + 1], [x + 3.5, H - 8 - R() * 8], [x + 7, H + 1]], mat.ink);
}

/** Drucktank (Entwurf 128 x 160): s rundum, t von der Kuppel zum Boden; Spannbaender, Schweissnaht, Rost / pressure tank (design 128 x 160): s around, t from the dome to the base; bands, weld seam, rust */
export function paintTank(p: Pen): void {
  const W = p.w, H = p.h;
  p.gradient(0, 0, W, H * 0.16, [0, 0], [0, H * 0.16], 1.16, 1);
  for (const y of [H * 0.3, H * 0.74]) p.band([[-2, y], [W + 2, y]], 8, BARE, 1.3);
  p.weld([W * 0.5, H * 0.18], [W * 0.5, H * 0.94], 4.5);
  p.mark([[W * 0.62, H * 0.46], [W * 0.84, H * 0.46]], 3, mat.paper, 0.85, { taper: 0, wobble: 0.1 });
  p.mark([[W * 0.62, H * 0.52], [W * 0.76, H * 0.52]], 3, mat.paper, 0.85, { taper: 0, wobble: 0.1 });
  p.chips(0, H * 0.2, W, H * 0.7, 10, mat.rustDark, 861, 3.4);
  p.scratches(0, H * 0.2, W, H * 0.7, 7, 863, 16);
  p.splatter(0, H * 0.7, W, H * 0.3, 12, mat.rustDark, 865, { size: 4, alpha: 0.6 });
}

/** Koffer oder Kiste aus Blech (Entwurf 128 x 96): Kantenschutz, Verschluesse, Anzeige / case or metal box (design 128 x 96): corner guards, latches, dial */
export function paintCase(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(3, 3, W - 6, H - 6, 6), 1.7, { closed: true, wobble: 0.2 });
  p.panel([[4, H * 0.3], [W - 4, H * 0.3]], 1.5);
  for (const x of [9, W - 9]) for (const y of [9, H - 9]) {
    p.fill(arc(x, y, 6, 6, 0, Math.PI * 2, 10), STEEL);
    p.line(arc(x, y, 6, 6, 0, Math.PI * 2, 10), 1.2, { closed: true, wobble: 0.1 });
  }
  for (const x of [W * 0.3, W * 0.7]) {
    p.fill(rrect(x - 7, H * 0.3 - 7, 14, 14, 2), STEEL);
    p.line(rrect(x - 7, H * 0.3 - 7, 14, 14, 2), 1.3, { closed: true, wobble: 0.1 });
    p.line([[x - 4, H * 0.3], [x + 4, H * 0.3]], 1.2, { taper: 0, wobble: 0 });
  }
  // Anzeige: weisse Scheibe mit Zeiger / dial: white disc with a needle
  const dx = W * 0.5, dy = H * 0.66;
  p.fill(arc(dx, dy, 13, 13, 0, Math.PI * 2, 18), mat.paper);
  p.line(arc(dx, dy, 13, 13, 0, Math.PI * 2, 18), 1.7, { closed: true, wobble: 0.1 });
  p.mark([[dx, dy], [dx + 7, dy - 8]], 1.8, mat.red, 1, { taper: 0.2, wobble: 0 });
  for (const a of [-2.4, -1.9, -1.4, -0.9]) p.line([[dx + Math.cos(a) * 9, dy + Math.sin(a) * 9], [dx + Math.cos(a) * 11.5, dy + Math.sin(a) * 11.5]], 1, { taper: 0, wobble: 0 });
  p.scratches(8, 10, W - 16, H - 20, 5, 871, 14);
}

/** Klinge oder Hammerkopf von der Seite (Entwurf 96 x 96): helle Schneide links, Scharten, Rost / blade or hammer head from the side (design 96 x 96): bright edge on the left, nicks, rust */
export function paintBlade(p: Pen): void {
  const W = p.w, H = p.h;
  p.gradient(0, 0, W * 0.34, H, [0, 0], [W * 0.34, 0], 1.7, 1);
  p.line([[W * 0.28, 3], [W * 0.26, H - 3]], 1.2, { taper: 0.1, wobble: 0.4 });
  for (const y of [H * 0.24, H * 0.58, H * 0.8]) p.fill([[-1, y - 3], [6, y], [-1, y + 3]], mat.ink);
  p.splatter(W * 0.4, 0, W * 0.6, H, 10, mat.rustDark, 881, { size: 4.2, rise: 0.9, alpha: 0.7 });
  p.scratches(W * 0.3, 6, W * 0.66, H - 12, 6, 883, 16);
  for (const y of [H * 0.38, H * 0.62]) p.rivet(W * 0.86, y, 2.6);
}

/** Sandsack (Entwurf 128 x 80): s rundum, t von einem Zipfel zum anderen; Naht, Falten, Schmutz / sandbag (design 128 x 80): s around, t from one tied end to the other; seam, folds, dirt */
export function paintSandbag(p: Pen): void {
  const W = p.w, H = p.h;
  p.line([[-2, H * 0.5], [W + 2, H * 0.5]], 1.1, { taper: 0, wobble: 0.5 });
  for (const y of [7, H - 7]) {
    p.line([[-2, y], [W + 2, y]], 1.5, { taper: 0, wobble: 0.4 });
    p.stitch([[0, y + (y < H / 2 ? 4 : -4)], [W, y + (y < H / 2 ? 4 : -4)]], 3.4, 3, 1, 0.6);
  }
  for (const [x, y] of [[W * 0.2, H * 0.3], [W * 0.56, H * 0.36], [W * 0.82, H * 0.66], [W * 0.36, H * 0.7]] as [number, number][]) {
    p.line(spline([[x - 9, y - 6], [x, y], [x + 8, y - 4]], 4), 1.3, { taper: 0.45, wobble: 0.4 });
  }
  p.gradient(0, 0, W * 0.2, H, [0, 0], [W * 0.2, 0], 0.76, 1);
  p.gradient(W * 0.8, 0, W * 0.2, H, [W * 0.8, 0], [W, 0], 1, 0.76);
  p.splatter(0, 0, W, H, 9, MUD, 891, { size: 3.6, rise: 0.8, alpha: 0.6 });
}

/** Warnstreifen (Entwurf 128 x 24): gelbe Schablone mit schraegen schwarzen Balken / hazard stripes (design 128 x 24): yellow stencil with slanted black bars */
export function paintHazard(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill([[0, 2], [W, 2], [W, H - 2], [0, H - 2]], mat.yellow);
  for (let x = -6; x < W; x += 21) p.fill([[x, H - 2], [x + 9, H - 2], [x + 19, 2], [x + 10, 2]], mat.ink);
  for (const y of [2, H - 2]) p.line([[-2, y], [W + 2, y]], 1.3, { taper: 0, wobble: 0.15 });
  p.chips(0, 3, W, H - 6, 6, BARE, 899, 2.2);
}

/** Glas oder Linse (Entwurf 48 x 48) / glass or lens (design 48 x 48) */
export function paintLens(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(2.5, 2.5, W - 5, H - 5, 5), 1.9, { closed: true, wobble: 0.15 });
  p.fill([[8, H - 10], [W * 0.42, 8], [W * 0.6, 8], [18, H - 10]], mat.white, 0.4);
}

/** Leder- oder Stoffgurt mit Taschen (Entwurf 192 x 32): s entlang / leather or webbing belt with pouches (design 192 x 32): s along */
export function paintWebbing(p: Pen): void {
  const W = p.w, H = p.h;
  p.stitch([[0, 4], [W, 4]], 3.4, 2.8, 1, 0.62);
  p.stitch([[0, H - 4], [W, H - 4]], 3.4, 2.8, 1, 0.62);
  for (const x of [W * 0.14, W * 0.38, W * 0.62, W * 0.86]) {
    p.shade(rrect(x - 13, 5, 26, H - 10, 3), 0.76, 0.9);
    p.line(rrect(x - 13, 5, 26, H - 10, 3), 1.4, { closed: true, wobble: 0.2 });
    p.spot(x, H * 0.42, 2, STEEL);
  }
  void LEATHER;
}

/** Sanitaetskraxe von hinten (Entwurf 160 x 224): weisses Segeltuch, gruenes Feld mit weissem Kreuz (kein Schutzzeichen), Riemen / medical frame pack from behind (design 160 x 224): white canvas, green panel with a white cross (no protected emblem), straps */
export function paintMedPack(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2;
  p.line(rrect(4, 4, W - 8, H - 8, 9), 1.6, { closed: true, wobble: 0.3 });
  p.stitch(rrect(9, 9, W - 18, H - 18, 6).concat([[W - 15, 9]]), 3.4, 2.8, 1, 0.6);
  // Deckel mit Schattenkante / flap with a shaded edge
  const edge = spline([[5, 34], [cx, 42], [W - 5, 34]], 6);
  p.shade([...edge, [W - 5, 50], [5, 50]], 0.82, 0.55);
  p.line(edge, 2, { taper: 0.05, wobble: 0.3 });
  // gruenes Feld mit weissem Kreuz / green panel with a white cross
  const cy = 96, r = 36;
  p.fill(rrect(cx - r, cy - r, 2 * r, 2 * r, 4), mat.green);
  p.line(rrect(cx - r, cy - r, 2 * r, 2 * r, 4), 1.9, { closed: true, wobble: 0.2 });
  const cross: [number, number][] = [[cx - 8, cy - 24], [cx + 8, cy - 24], [cx + 8, cy - 8], [cx + 24, cy - 8], [cx + 24, cy + 8], [cx + 8, cy + 8], [cx + 8, cy + 24], [cx - 8, cy + 24], [cx - 8, cy + 8], [cx - 24, cy + 8], [cx - 24, cy - 8], [cx - 8, cy - 8]];
  p.fill(cross, mat.white);
  p.line(cross, 1.5, { closed: true, wobble: 0.1 });
  // zwei Riemen mit Schnallen, Aussentasche / two straps with buckles, outer pocket
  for (const x of [32, W - 32]) {
    p.band([[x, 146], [x, H - 12]], 10, LEATHER);
    p.fill(rrect(x - 8, 160, 16, 12, 2), STEEL);
    p.line(rrect(x - 8, 160, 16, 12, 2), 1.4, { closed: true, wobble: 0.1 });
  }
  p.line(rrect(cx - 26, 152, 52, 46, 5), 1.5, { closed: true, wobble: 0.3 });
  p.shade(rrect(cx - 26, 152, 52, 16, 4), 0.86, 0.8);
  p.spot(cx, 168, 2.6, STEEL);
  p.splatter(0, H - 50, W, 50, 14, MUD, 921, { size: 4, alpha: 0.6 });
}

/** Tarnueberwurf (Entwurf 256 x 160, nur die Oberseite): Blattbueschel als unregelmaessige Umrisse, helle und dunkle Flecken, wenige Netzleinen / ghillie cover (design 256 x 160, top side only): leaf tufts as irregular outlines, light and dark patches, a few net lines */
export function paintGhillie(p: Pen): void {
  const W = p.w, H = p.h;
  const R = rng(923);
  // Flecken: flach heller oder dunkler / patches: flat lighter or darker
  for (let i = 0; i < 16; i++) {
    const x = R() * W, y = R() * H, r = 14 + R() * 18;
    const blob: [number, number][] = [];
    for (let j = 0; j < 7; j++) { const a = (j / 7) * Math.PI * 2, rr = r * (0.6 + R() * 0.6); blob.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr]); }
    p.shade(spline(blob, 4, true), i % 3 === 0 ? 1.3 : i % 3 === 1 ? 0.72 : [0.9, 0.8, 0.62], 0.85);
  }
  // Blaetter: Umriss mit Mittelrippe, wenige und verschieden gross / leaves: outline with a midrib, few and of different size
  for (let i = 0; i < 20; i++) {
    const x = 10 + R() * (W - 20), y = 8 + R() * (H - 16), a = R() * Math.PI * 2, l = 9 + R() * 10, w = l * (0.34 + R() * 0.2);
    const cs = Math.cos(a), sn = Math.sin(a);
    const at = (u: number, v: number): [number, number] => [x + cs * u * l - sn * v * w, y + sn * u * l + cs * v * w];
    const leaf = spline([at(-1, 0), at(-0.3, 1), at(0.5, 0.7), at(1, 0), at(0.5, -0.7), at(-0.3, -1)], 4, true);
    if (i % 2) p.shade(leaf, i % 4 === 1 ? 1.4 : 0.66, 0.9);
    p.line(leaf, 1.4, { closed: true, wobble: 0.3 });
    p.line([at(-0.9, 0), at(0.8, 0)], 1, { taper: 0.3, wobble: 0.2 });
  }
  for (const y of [H * 0.3, H * 0.72]) p.line(spline([[0, y], [W * 0.3, y + 8], [W * 0.7, y - 6], [W, y + 4]], 6), 1.1, { taper: 0.1, wobble: 0.8 });
}

/** Zellen des Beiwerks der Grundtypen (Atlas 'figure'), um k skaliert / prop cells of the basic types (atlas 'figure'), scaled by k */
export function kitPropCells(k = 1): Cell[] {
  const c = (name: string, w: number, h: number, paint: (p: Pen) => void): Cell => ({ name, w: Math.max(16, Math.round(w * k)), h: Math.max(12, Math.round(h * k)), design: [w, h], paint });
  return [
    c('medPack', 160, 224, paintMedPack),
    c('ghillie', 256, 160, paintGhillie),
    c('shield', 144, 224, paintShield),
    c('sandbag', 128, 80, paintSandbag),
    c('case', 128, 96, paintCase),
    c('cloth', 128, 160, paintCloth),
    c('plate', 160, 160, paintPlate),
    c('tube', 96, 256, paintTube),
  ];
}

/** allgemeine Zellen des Beiwerks, um k skaliert / generic prop cells, scaled by k */
export function propCells(k = 1): Cell[] {
  const c = (name: string, w: number, h: number, paint: (p: Pen) => void): Cell => ({ name, w: Math.max(16, Math.round(w * k)), h: Math.max(12, Math.round(h * k)), design: [w, h], paint });
  return [
    c('tube', 96, 256, paintTube),
    c('plate', 160, 160, paintPlate),
    c('shield', 144, 224, paintShield),
    c('wood', 160, 96, paintWood),
    c('cloth', 128, 160, paintCloth),
    c('tank', 128, 160, paintTank),
    c('case', 128, 96, paintCase),
    c('blade', 96, 96, paintBlade),
    c('sandbag', 128, 80, paintSandbag),
    c('hazard', 128, 24, paintHazard),
    c('lens', 48, 48, paintLens),
    c('webbing', 192, 32, paintWebbing),
  ];
}
