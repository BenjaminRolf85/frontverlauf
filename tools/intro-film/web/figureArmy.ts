/**
 * Nur Filmexport (Anime-Schnitt): das Heer der Korvat aus dem Figurenbaukasten. Ein Soldat (Reiter oder Infanterist,
 * derselbe Mensch wie die Anfuehrer, schlanker, mit einfachem Kopf und Spitzhelm), ein Filmpferd mit eigenem Skelett
 * (runder Rumpf, Hals, Beine mit Gelenken, Maehne und Schweif als Tuch, Sattel und Zaumzeug) und das Banner mit dem
 * Zahnrad. Alle teilen sich einen Atlas ('fig-korvat-army'), damit ein Heer wenige Materialien braucht.
 * Film export only (anime cut): the Korvat army from the figure kit. A soldier (rider or infantryman, the same human
 * as the leaders, slimmer, with a simple head and a spiked helmet), a film horse with a skeleton of its own (round
 * barrel, neck, legs with joints, mane and tail as cloth, saddle and bridle) and the banner with the cog. They all
 * share one atlas ('fig-korvat-army') so an army needs few materials.
 */
import * as THREE from 'three';
import { mix, rng, shade } from '../../../src/render/models/kit';
import { look, mat } from '../../../src/render/models/look';
import { Sculpt } from '../../../src/render/models/sculpt';
import { atlasDef, defineAtlas, hasAtlas, spline, type Cell, type Pen, type Pt } from '../../../src/render/models/inked/atlas';
import { paintEmblem } from '../../../src/render/models/inked/emblem';
import { earGeometry, faceMap, headGeometry, revolve, scalpMap, sheet } from '../../../src/render/models/inked/leaderKit';
import { drawBrow, drawEye, drawMouth, drawNose, fold, GOLD, GOLD_DARK, lineScale, shadow } from '../../../src/render/models/inked/leaderPaint';
import { UvBuilder, type AtlasLayout } from '../../../src/render/models/inked/uvkit';
import { bump, curve, ell, limb, lod, Rig, Skinner, smooth, type SkinFn } from './figureKit';
import { arms, belt, boots, floorY, hands, HERO, humanRig, legs, trunk, type Human, type HumanProp, type TrunkRow } from './figureHuman';
import { finish } from './figureKorvat';

const L = look('korvat');
export const ARMY_ATLAS = 'fig-korvat-army';
const SKIN = shade(mix(mat.skin, mat.orange, 0.12), 0.98);
const COAT = L.primary, PANTS = L.pants, HELMET = L.helmet, LEATHER = shade(mat.wood, 0.75), BOOT = mat.dark;
const BAY = mix(mat.wood, mat.orange, 0.22), BAY_DARK = shade(mat.wood, 0.5), MANE = mix(mat.dark, mat.wood, 0.22), HOOF = mat.dark;
const gauss = (x: number, w: number) => Math.exp(-((x / w) ** 2));

// ---------- Zeichnung / drawing ----------

const HEAD_C: [number, number, number] = [0, 0.665, 0.03], HEAD_R: [number, number, number] = [0.162, 0.186, 0.165];
function paintFace(p: Pen): void {
  const M = faceMap(p.w, p.h), P = M.P, lw = lineScale(M.u(1) / HEAD_R[0]);
  // Schatten des Helmrands, Wangen, Kiefer / shade of the helmet rim, cheeks, jaw
  p.shade(spline([P(-0.95, 0.36), P(-0.5, 0.43), P(0, 0.45), P(0.5, 0.43), P(0.95, 0.36)], 6).concat([P(0.95, 0.95), P(-0.95, 0.95)]), 0.72, 0.95);
  shadow(p, M, [[0.52, 0.0], [0.6, -0.3], [0.46, -0.66], [0.3, -0.9], [0.62, -0.84], [0.88, -0.4], [0.88, 0.1]], 0.82, 0.9, false);
  p.gradient(0, P(0, -0.84)[1], p.w, p.h - P(0, -0.84)[1], P(0, -0.84), P(0, -1), 1, 0.68);
  for (const s of [-1, 1] as const) {
    drawEye(p, M, s, { x: 0.36, y: 0.1, w: 0.15, h: 0.085, tilt: 0.02, upper: 0.22, lower: 0.1, iris: shade(mat.wood, 0.8), irisR: 0.072, look: [0, 0.03], crease: 0.04, lid: 4 }, lw);
    drawBrow(p, M, s, { x0: 0.1, y0: 0.235, x1: 0.66, y1: 0.285, arch: 0.025, thick: 0.075, colour: shade(mat.wood, 0.55), strands: 3, wild: 0.2, seed: 5 + s }, lw);
  }
  drawNose(p, M, { y: -0.2, w: 1.0, top: 0.15, shade: 0.84 }, lw);
  drawMouth(p, M, { y: -0.57, w: 0.17, smile: -0.01, lipU: 0.016, lipL: 0.04, tint: [1, 0.82, 0.78], open: 0, line: 2.2 }, lw);
}
function paintScalp(p: Pen): void {
  const B = scalpMap(p.w, p.h);
  // kurzes dunkles Haar im Nacken / short dark hair at the nape
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) { const a = -2.2 + (i / 24) * 4.4, y = -0.36 + (i % 2 ? 0.04 : 0), c = Math.sqrt(1 - y * y); pts.push(B(Math.sin(a) * c, y, -Math.cos(a) * c)); }
  p.fill([...pts, [p.w, 0], [0, 0]], shade(mat.wood, 0.5));
}
function paintHelmet(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.7);
  // gespiegelte Abwicklung: vorn Mitte am linken Rand; rotes Band, vorn der Stern / mirrored unwrap: front centre at the left edge; red band, the star at the front
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.05, 0.9);
  p.band([[-4, H * 0.16], [W + 4, H * 0.16]], H * 0.14, L.primary, lw(1.2));
  const star: Pt[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? H * 0.1 : H * 0.22; star.push([Math.cos(a) * r, H * 0.5 + Math.sin(a) * r]); }
  p.fill(star, GOLD);
  p.line(star, lw(1), { closed: true });
  p.fill([[W * 0.3, H * 0.52], [W * 0.75, H * 0.5], [W * 0.75, H * 0.58], [W * 0.3, H * 0.6]], mat.white, 0.22);
}
/** Rock des Soldaten: s rundum (0.5 = vorn), t von der Schulter zum Saum / the soldier's coat: s around (0.5 = front), t shoulder to hem */
function paintCoat(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 2.3);
  const ty = (y: number) => ((S_TOP - y) / (S_TOP - S_HEM)) * H;
  p.gradient(0, ty(-0.3), W, H - ty(-0.3), [0, ty(-0.3)], [0, H], 1, 0.88);
  // Knopfleiste mit fuenf Goldknoepfen, Kragenspiegel, Brusttaschen / button front with five gold buttons, collar patches, breast pockets
  p.line(spline([[W * 0.5 + 5, ty(0.3)], [W * 0.5 + 5, ty(-0.2)], [W * 0.5 + 4, H - 4]], 4), lw(1.4), { taper: 0.05, wobble: 0.3 });
  p.shade([[W * 0.5 + 5, ty(0.3)], [W * 0.5 + 11, ty(0.3)], [W * 0.5 + 10, H], [W * 0.5 + 4, H]], 0.8, 0.9);
  for (const y of [0.22, 0.12, 0.02, -0.08, -0.16]) { p.spot(W * 0.5, ty(y), 5, GOLD); p.line(spline([[W * 0.5 - 5, ty(y)], [W * 0.5, ty(y) - 5], [W * 0.5 + 5, ty(y)], [W * 0.5, ty(y) + 5]], 3, true), lw(1), { closed: true }); }
  for (const s of [-1, 1]) {
    const cx = W * (0.5 + s * 0.085), y0 = ty(0.16), w = W * 0.036, h = H * 0.07;
    const flap: Pt[] = [[cx - w, y0], [cx + w, y0], [cx + w, y0 + h], [cx, y0 + h * 1.3], [cx - w, y0 + h]];
    p.shade(flap.map((q): Pt => [q[0] + 2, q[1] + 3]), 0.72, 0.9);
    p.line(flap, lw(1.3), { closed: true, wobble: 0.2 });
    p.spot(cx, y0 + h * 0.8, 3, GOLD);
    // Schulterriemen des Brotbeutels / the haversack's shoulder strap
  }
  // Schulterriemen schraeg ueber die Brust / shoulder strap diagonally across the chest
  p.band(spline([[W * 0.62, ty(0.3)], [W * 0.5, ty(0.04)], [W * 0.36, ty(-0.2)]], 5), W * 0.022, LEATHER, lw(1.2));
  p.band(spline([[W * 0.12, ty(0.3)], [W * 0.0, ty(0.04)]], 4), W * 0.022, LEATHER, lw(1.2));
  p.band(spline([[W, ty(0.04)], [W * 0.86, ty(-0.2)]], 4), W * 0.022, LEATHER, lw(1.2));
  // Seitennaehte, Falten ueber dem Koppel, Rockschoss / side seams, folds above the belt, skirt
  for (const x of [0.25, 0.75]) p.line(spline([[W * x, ty(0.2)], [W * x + 2, H * 0.6], [W * x, H - 4]], 4), lw(1.3), { taper: 0.2, wobble: 0.4 });
  const R = rng(7);
  for (let i = 0; i < 10; i++) {
    const x = W * (0.05 + 0.9 * (i / 9)) + (R() - 0.5) * 8;
    if (Math.abs(x - W * 0.5) < 26) continue;
    fold(p, spline([[x, ty(-0.08)], [x + (R() - 0.5) * 5, ty(-0.14)], [x, ty(-0.19)]], 4), lw(1.1), 4, 0.8, i % 2 ? 1 : -1);
    fold(p, spline([[x, ty(-0.27)], [x + (R() - 0.5) * 8, ty(-0.42)], [x + (R() - 0.5) * 10, H - 5]], 4), lw(1.2), 6, 0.78, i % 2 ? 1 : -1);
  }
  p.shade([[0, ty(-0.255)], [W, ty(-0.255)], [W, ty(-0.285)], [0, ty(-0.285)]], 0.72, 0.9);
  // Kragen und Schulterklappen oben / collar and shoulder straps at the top
  p.fill([[0, 0], [W, 0], [W, ty(0.325)], [0, ty(0.325)]], shade(L.primary, 0.78));
  p.line([[0, ty(0.325)], [W, ty(0.325)]], lw(1.2), { taper: 0 });
  p.shade([[0, H - 6], [W, H - 6], [W, H], [0, H]], 0.72, 0.9);
}
function paintSleeveS(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.0), EL = 0.585;
  p.shade(spline([[0, H * 0.1], [W * 0.5, H * 0.12], [W, H * 0.1]], 4).concat([[W, 0], [0, 0]]), 0.8, 0.95);
  p.shade(spline([[0, H * 0.9], [W * 0.5, H * 0.88], [W, H * 0.9]], 4).concat([[W, H], [0, H]]), 0.8, 0.95);
  p.line(spline([[W * 0.085, 0], [W * 0.1, H * 0.5], [W * 0.085, H]], 5), lw(1.4), { taper: 0, wobble: 0.3 });
  for (let i = 0; i < 4; i++) { const k = (i - 1.5) / 1.5, x = W * (EL + k * 0.045); fold(p, spline([[x - k * 5, H * 0.62], [x, H * 0.76], [x + k * 8, H * 0.92]], 4), lw(1.2), 4, 0.78, k < 0 ? -1 : 1); }
  fold(p, spline([[W * 0.2, H * 0.4], [W * 0.32, H * 0.36], [W * 0.42, H * 0.4]], 4), lw(1), 4, 0.82, -1);
  fold(p, spline([[W * 0.68, H * 0.66], [W * 0.78, H * 0.6], [W * 0.9, H * 0.64]], 4), lw(1), 4, 0.8);
  // Aermelaufschlag in der Hosenfarbe / cuff in the trouser colour
  p.fill([[W * 0.9, 0], [W, 0], [W, H], [W * 0.9, H]], shade(L.primary, 0.75));
  p.line([[W * 0.9, 0], [W * 0.9, H]], lw(1.2), { taper: 0 });
}
function paintTrouser(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.07);
  p.shade(spline([[0, H * 0.1], [W * 0.5, H * 0.12], [W, H * 0.1]], 4).concat([[W, 0], [0, 0]]), 0.8, 0.95);
  p.shade(spline([[0, H * 0.9], [W * 0.5, H * 0.88], [W, H * 0.9]], 4).concat([[W, H], [0, H]]), 0.8, 0.95);
  p.band([[-4, H * 0.5], [W + 4, H * 0.5]], H * 0.045, L.primary, lw(0.9));
  for (let i = 0; i < 4; i++) { const y = H * (0.6 + 0.08 * i), x0 = W * (0.12 + 0.03 * i); fold(p, spline([[x0, y], [x0 + W * 0.12, y + 2], [x0 + W * 0.24, y - 3]], 4), lw(1.1), 4, 0.8); }
  for (let i = 0; i < 3; i++) { const k = i - 1, x = W * (0.775 + k * 0.04); fold(p, spline([[x - k * 4, H * 0.6], [x, H * 0.75], [x + k * 6, H * 0.9]], 4), lw(1.1), 4, 0.8, k < 0 ? -1 : 1); }
}
function paintBootS(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.6);
  p.fill(spline([[W * 0.1, H * 0.6], [W * 0.45, H * 0.585], [W * 0.78, H * 0.6], [W * 0.78, H * 0.66], [W * 0.1, H * 0.66]], 4, true), mat.white, 0.42);
  p.fill([[0, 0], [W * 0.08, 0], [W * 0.08, H], [0, H]], shade(BOOT, 1.35));
  p.line([[W * 0.08, 0], [W * 0.08, H]], lw(1.3), { taper: 0 });
  for (let i = 0; i < 3; i++) { const x = W * (0.82 + i * 0.05); p.line(spline([[x, H * 0.52], [x - 4, H * 0.68], [x + 1, H * 0.84]], 4), lw(1), { taper: 0.4, wobble: 0.4 }); }
}
function paintFootS(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.4);
  p.fill(spline([[W * 0.74, H * 0.44], [W * 0.88, H * 0.44], [W * 0.92, H * 0.5], [W * 0.88, H * 0.56], [W * 0.74, H * 0.56]], 4, true), mat.white, 0.42);
  p.line(spline([[W * 0.69, H * 0.14], [W * 0.66, H * 0.5], [W * 0.69, H * 0.86]], 4), lw(1.1), { taper: 0.1, wobble: 0.3 });
}
function paintHandS(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.22);
  p.shade([[0, 0], [W, 0], [W, H * 0.2], [0, H * 0.2]], 0.84, 0.95);
  p.shade([[0, H * 0.8], [W, H * 0.8], [W, H], [0, H]], 0.84, 0.95);
  for (const y of [0.42, 0.58]) p.line(spline([[W * 0.6, H * y], [W * 0.9, H * (y + (y - 0.5) * 0.4)]], 3), lw(0.9), { taper: 0.4 });
}
function paintBeltS(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 2.3);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.1, 0.82);
  // Schloss vorn (s = 0.5), Patronentaschen / buckle at the front (s = 0.5), ammunition pouches
  p.fill([[W * 0.48, 0], [W * 0.52, 0], [W * 0.52, H], [W * 0.48, H]], GOLD);
  p.line([[W * 0.48, 0], [W * 0.52, 0], [W * 0.52, H], [W * 0.48, H]], lw(1.1), { closed: true });
  for (const x of [0.36, 0.41, 0.59, 0.64]) p.line([[W * x, 1], [W * x, H - 1]], lw(1));
}

// Pferd / horse
/** Rumpf: s von der Kruppe zur Brust, t rundum (0.5 = Ruecken, 0 / 1 = Bauch) / barrel: s croup to chest, t around (0.5 = back, 0 / 1 = belly) */
function paintBarrel(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 2.1);
  // Bauch dunkler mit harter Kante; Schattenflaechen hinter Schulter und vor der Hinterhand
  // belly darker with a hard edge; shade shapes behind the shoulder and in front of the haunch
  for (const [y0, y1] of [[0, 0.14], [1, 0.86]]) p.shade(spline([[0, H * y1], [W * 0.3, H * (y1 + (y0 ? -0.03 : 0.03))], [W * 0.7, H * (y1 + (y0 ? -0.02 : 0.02))], [W, H * y1]], 5).concat([[W, H * y0], [0, H * y0]]), 0.78, 0.95);
  for (const side of [0.3, 0.7]) {
    const d = side < 0.5 ? -1 : 1;
    // Schulterblatt, Hinterbacke, Flanke: gezeichnete Muskellinien / shoulder blade, haunch, flank: drawn muscle lines
    p.line(spline([[W * 0.8, H * (side - d * 0.1)], [W * 0.74, H * side], [W * 0.76, H * (side + d * 0.12)], [W * 0.84, H * (side + d * 0.17)]], 5), lw(1.5), { taper: 0.4, wobble: 0.3 });
    p.shade(spline([[W * 0.74, H * side], [W * 0.7, H * (side + d * 0.08)], [W * 0.76, H * (side + d * 0.14)]], 4).concat([[W * 0.79, H * (side + d * 0.06)]]), 0.84, 0.9);
    p.line(spline([[W * 0.3, H * (side - d * 0.14)], [W * 0.36, H * (side - d * 0.02)], [W * 0.33, H * (side + d * 0.12)], [W * 0.26, H * (side + d * 0.18)]], 5), lw(1.5), { taper: 0.4, wobble: 0.3 });
    p.shade(spline([[W * 0.36, H * (side - d * 0.02)], [W * 0.41, H * (side + d * 0.06)], [W * 0.35, H * (side + d * 0.14)]], 4).concat([[W * 0.33, H * (side + d * 0.05)]]), 0.84, 0.9);
    p.line(spline([[W * 0.44, H * (side + d * 0.16)], [W * 0.52, H * (side + d * 0.13)], [W * 0.6, H * (side + d * 0.16)]], 4), lw(1.1), { taper: 0.45 });
    // Glanz auf Kruppe und Schulter / shine on croup and shoulder
    p.fill(spline([[W * 0.14, H * (side - d * 0.12)], [W * 0.26, H * (side - d * 0.14)], [W * 0.27, H * (side - d * 0.1)], [W * 0.14, H * (side - d * 0.09)]], 4, true), mat.white, 0.22);
  }
}
/** Hals: s vom Widerrist zum Genick, t rundum (0.5 = Kamm) / neck: s withers to poll, t around (0.5 = crest) */
function paintNeckH(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.3);
  for (const [y0, y1] of [[0, 0.16], [1, 0.84]]) p.shade([[0, H * y1], [W, H * y1], [W, H * y0], [0, H * y0]], 0.78, 0.95);
  for (const side of [0.3, 0.7]) { const d = side < 0.5 ? -1 : 1; p.line(spline([[W * 0.1, H * (side + d * 0.12)], [W * 0.45, H * (side + d * 0.1)], [W * 0.85, H * (side + d * 0.03)]], 5), lw(1.3), { taper: 0.45, wobble: 0.3 }); }
}
/** Kopf: s vom Genick zum Maul, t rundum (0.5 = Stirn / Nasenruecken, 0.25 und 0.75 = Seiten) / head: s poll to muzzle, t around (0.5 = forehead / nose) */
function paintHeadH(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.85);
  for (const [y0, y1] of [[0, 0.13], [1, 0.87]]) p.shade([[0, H * y1], [W, H * y1], [W, H * y0], [0, H * y0]], 0.78, 0.95);
  // Blesse / blaze
  p.fill(spline([[W * 0.22, H * 0.5], [W * 0.45, H * 0.47], [W * 0.86, H * 0.48], [W * 0.86, H * 0.52], [W * 0.45, H * 0.53]], 5, true), mix(mat.paper, mat.white, 0.3));
  for (const side of [0.27, 0.73]) {
    const d = side < 0.5 ? -1 : 1;
    // Auge: dunkle Mandel mit Glanzpunkt, Lidstrich / eye: a dark almond with a highlight, lid line
    const ex = W * 0.3, ey = H * side, eye = spline([[ex - W * 0.045, ey], [ex, ey - H * 0.035], [ex + W * 0.05, ey], [ex, ey + H * 0.03]], 5, true);
    p.fill(eye, mat.dark);
    p.line(eye, lw(1.2), { closed: true });
    p.spot(ex + W * 0.012, ey - d * H * 0.012, W * 0.01, mat.white);
    p.line(spline([[ex - W * 0.07, ey - d * H * 0.045], [ex, ey - d * H * 0.06], [ex + W * 0.07, ey - d * H * 0.04]], 4), lw(1.1), { taper: 0.4 });
    // Backenlinie, Nuester, Maulspalte / cheek line, nostril, mouth
    p.line(spline([[W * 0.12, ey + d * H * 0.02], [W * 0.3, ey + d * H * 0.13], [W * 0.5, ey + d * H * 0.11]], 5), lw(1.3), { taper: 0.4, wobble: 0.3 });
    const nx = W * 0.88, ny = H * (side - d * 0.07);
    p.fill(spline([[nx - W * 0.03, ny], [nx, ny - H * 0.03], [nx + W * 0.03, ny], [nx, ny + H * 0.025]], 4, true), mat.dark);
    p.line(spline([[W * 0.78, ey + d * H * 0.13], [W * 0.9, ey + d * H * 0.12], [W * 0.985, ey + d * H * 0.06]], 4), lw(1.4), { taper: 0.3 });
  }
  // dunkles Maul / dark muzzle
  p.gradient(W * 0.8, 0, W * 0.2, H, [W * 0.8, 0], [W, 0], 1, 0.72);
}
function paintLegH(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.5);
  p.shade([[0, H * 0.84], [W, H * 0.84], [W, H], [0, H]], 0.8, 0.95);
  p.shade([[0, 0], [W, 0], [W, H * 0.16], [0, H * 0.16]], 0.8, 0.95);
  // Sehnenlinie am Roehrbein, Gelenkfalten / tendon line on the cannon, joint creases
  p.line(spline([[W * 0.52, H * 0.3], [W * 0.72, H * 0.28], [W * 0.88, H * 0.3]], 4), lw(1), { taper: 0.4 });
  p.line(spline([[W * 0.44, H * 0.38], [W * 0.46, H * 0.5], [W * 0.44, H * 0.62]], 4), lw(1.1), { taper: 0.4 });
}
function paintHair(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.0);
  const R = rng(13);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.08, 0.84);
  for (let i = 0; i < 12; i++) { const x = W * (0.04 + 0.92 * (i / 11)) + (R() - 0.5) * 6; p.line(spline([[x, H * 0.08], [x + (R() - 0.5) * 8, H * 0.5], [x + (R() - 0.5) * 12, H * 0.96]], 4), lw(1.1), { taper: 0.45, wobble: 0.5 }); }
}
function paintBlanket(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.1);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.02, 0.9);
  const b = 9;
  p.band([[b, b], [W - b, b], [W - b, H - b], [b, H - b], [b, b]], 5, GOLD, lw(1.1));
  // Zahnrad in den hinteren Ecken (beide Seiten) / the cog in the rear corners (both sides)
  paintEmblem(p, 'korvat', W * 0.2, H * 0.2, H * 0.11, GOLD);
  paintEmblem(p, 'korvat', W * 0.2, H * 0.8, H * 0.11, GOLD);
}
function paintSaddle(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.8);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.12, 0.84);
  p.stitch([[4, H * 0.3], [W - 4, H * 0.3]], 3, 2.6, 1, 0.6);
  p.stitch([[4, H * 0.7], [W - 4, H * 0.7]], 3, 2.6, 1, 0.6);
  p.fill([[W * 0.2, H * 0.44], [W * 0.8, H * 0.44], [W * 0.8, H * 0.52], [W * 0.2, H * 0.52]], mat.white, 0.18);
  p.line([[2, 2], [W - 2, 2], [W - 2, H - 2], [2, H - 2]], lw(1.1), { closed: true, wobble: 0.3 });
}
/** Banner: rotes Tuch, goldenes Zahnrad, Goldrand und Fransen / banner: red cloth, gold cog, gold border and fringe */
function paintBanner(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.9);
  p.gradient(0, 0, W, H, [0, 0], [W, 0], 1.04, 0.94);
  const b = 12;
  p.band([[b, b], [W - b, b], [W - b, H - b * 1.9], [b, H - b * 1.9], [b, b]], 6, GOLD, lw(1.2));
  paintEmblem(p, 'korvat', W * 0.5, H * 0.46, H * 0.27, GOLD, 2.2);
  // Strahlen um das Zahnrad (wie der Strahlenkranz des Portraets) / rays around the cog (as the halo of the portrait)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r0 = H * 0.33, r1 = H * (i % 2 ? 0.385 : 0.42);
    p.mark([[W * 0.5 + Math.cos(a) * r0, H * 0.46 + Math.sin(a) * r0], [W * 0.5 + Math.cos(a) * r1, H * 0.46 + Math.sin(a) * r1]], 4.5, GOLD, 1, { taper: 0.5 });
  }
  // Fransen unten / fringe at the bottom
  p.fill([[0, H - b * 1.2], [W, H - b * 1.2], [W, H], [0, H]], GOLD_DARK);
  for (let i = 0; i < 40; i++) { const x = (W * (i + 0.5)) / 40; p.line([[x, H - b * 1.2], [x, H - 1]], lw(0.9), { taper: 0.1 }); }
  p.line([[0, H - b * 1.2], [W, H - b * 1.2]], lw(1.2), { taper: 0 });
  // Faltenschatten vom Mast weg / fold shades away from the pole
  for (const x of [0.2, 0.47, 0.76]) p.shade(spline([[W * x, 0], [W * (x + 0.03), H * 0.5], [W * x, H]], 4).concat(spline([[W * (x + 0.07), H], [W * (x + 0.09), H * 0.5], [W * (x + 0.06), 0]], 4)), 0.84, 0.85);
}

const S_TOP = 0.365, S_HEM = -0.6;
function cells(): Cell[] {
  return [
    { name: 'sFace', w: 168, h: 168, design: [512, 512], paint: paintFace },
    { name: 'sScalp', w: 64, h: 64, paint: paintScalp },
    { name: 'sEar', w: 24, h: 36, paint: () => {} },
    { name: 'sHelmet', w: 160, h: 64, paint: paintHelmet },
    { name: 'sCoat', w: 320, h: 208, paint: paintCoat },
    { name: 'sSleeve', w: 176, h: 96, paint: paintSleeveS },
    { name: 'sTrouser', w: 176, h: 104, paint: paintTrouser },
    { name: 'sBoot', w: 120, h: 88, paint: paintBootS },
    { name: 'sFoot', w: 80, h: 64, paint: paintFootS },
    { name: 'sHand', w: 48, h: 56, paint: paintHandS },
    { name: 'sBelt', w: 224, h: 16, paint: paintBeltS },
    { name: 'hBarrel', w: 400, h: 272, paint: paintBarrel },
    { name: 'hNeck', w: 176, h: 160, paint: paintNeckH },
    { name: 'hHead', w: 208, h: 160, paint: paintHeadH },
    { name: 'hLeg', w: 176, h: 64, paint: paintLegH },
    { name: 'hHair', w: 144, h: 112, paint: paintHair },
    { name: 'hBlanket', w: 192, h: 144, paint: paintBlanket },
    { name: 'hSaddle', w: 96, h: 64, paint: paintSaddle },
    { name: 'banner', w: 368, h: 256, paint: paintBanner },
  ];
}
function layout(): AtlasLayout {
  if (!hasAtlas(ARMY_ATLAS)) defineAtlas(ARMY_ATLAS, cells(), { hero: true });
  return atlasDef(ARMY_ATLAS).layout;
}

// ---------- Soldat / soldier ----------

/** Soldat: etwas kleiner und schlanker als der Marschall, gleiche Gelenke / soldier: a little smaller and slimmer than the marshal, the same joints */
const SP: HumanProp = { ...HERO, thigh: 0.74, shin: 0.67, shoulder: [0.3, 0.235, -0.012], clav: [0.09, 0.33, -0.012], hand: 0.95 };
export const SOLDIER_FLOOR = floorY(SP);
const S_ROWS: TrunkRow[] = [
  [S_TOP, 0.105, 0.1, -0.012, 2], [0.335, 0.2, 0.125, -0.012, 2.2], [0.3, 0.3, 0.15, -0.012, 2.5], [0.24, 0.335, 0.175, -0.01, 2.7], [0.1, 0.33, 0.19, -0.006, 2.7],
  [-0.08, 0.305, 0.185, -0.004, 2.6], [-0.22, 0.285, 0.18, -0.002, 2.5], [-0.3, 0.3, 0.185, -0.004, 2.5], [-0.45, 0.335, 0.2, -0.008, 2.5], [S_HEM, 0.355, 0.21, -0.01, 2.5],
];
const S_BELT: [number, number] = [-0.255, -0.195];
let SRIG: Rig | null = null;
export function soldierRig(): Rig { return (SRIG ??= humanRig(SP)); }

/**
 * Ausruestung: rider = Saebel an der Huefte, Karabiner auf dem Ruecken; lancer = dazu eine Lanze mit Wimpel in der
 * rechten Hand; officer = gezogener Saebel in der rechten Hand; foot = Gewehr mit Bajonett auf dem Ruecken, Brotbeutel.
 * Kit: rider = sabre at the hip, carbine on the back; lancer = plus a lance with a pennant in the right hand; officer =
 * a drawn sabre in the right hand; foot = rifle with bayonet on the back, haversack.
 */
export type SoldierKit = 'rider' | 'lancer' | 'officer' | 'foot';
export function buildSoldier(kit: SoldierKit): THREE.BufferGeometry {
  const A = layout(), rig = soldierRig();
  const b = new UvBuilder(A.get('blank')), sk = new Skinner(b, rig);
  const H: Human = { b, sk, rig, P: SP };
  trunk(H, { region: A.get('sCoat'), color: COAT, rows: S_ROWS, beltY: S_BELT[0], follow: 0.7, cols: lod() < 1 ? 28 : 44 });
  belt(H, S_ROWS, S_BELT[0], S_BELT[1], A.get('sBelt'), LEATHER, 0.01);
  legs(H, { trouser: A.get('sTrouser'), color: PANTS, flare: 0.7, bulk: 0.92 });
  boots(H, { shaft: A.get('sBoot'), foot: A.get('sFoot'), color: BOOT, soleColor: shade(BOOT, 0.55), gloss: 0.45 });
  arms(H, { sleeve: A.get('sSleeve'), cuff: A.get('blank'), color: COAT, cuffColor: shade(L.primary, 0.75), bulk: 0.86, cuffLen: 0.09, cuffGrow: 0.008 });
  hands(H, { back: A.get('sHand'), finger: A.get('blank'), color: SKIN });
  // Hals und Stehkragen / neck and standing collar
  sk.part(sk.chain(['chest', 'neck', 'head'], [0.05, 0.045, 0.05]), () => {
    b.add(limb([new THREE.Vector3(0, 0.32, -0.012), new THREE.Vector3(0, 0.46, -0.004), new THREE.Vector3(0, 0.6, 0.012)], (_d, a) => ell(0.074, 0.08, a), { seg: 18, step: 0.03, region: A.get('blank'), out: new THREE.Vector3(0, 0, 1), color: SKIN }), null, { crease: 0 });
  });
  sk.part('chest', () => {
    b.add(limb([new THREE.Vector3(0, 0.345, -0.012), new THREE.Vector3(0, 0.425, -0.008)], (_d, a) => ell(0.092, 0.1, a) + 0.004, { seg: 20, step: 0.02, region: A.get('blank'), out: new THREE.Vector3(0, 0, 1), color: shade(L.primary, 0.78), cap1: 0.008 }), null, { crease: 1 });
    // Schulterklappen / shoulder straps
    for (const s of [-1, 1]) b.add(sheet((u, v) => new THREE.Vector3(s * (0.13 + 0.17 * u), 0.335 - 0.05 * u * u + 0.004, -0.012 + (v - 0.5) * 0.085), { nu: 4, nv: 2, region: A.get('blank'), thick: 0.012, color: GOLD, backColor: GOLD_DARK, flip: s > 0 }), null, { crease: 1, gloss: 0.4 });
    // Waffe auf dem Ruecken, schraeg / weapon across the back, slanted
    const len = kit === 'foot' ? 1.5 : 1.15;
    const a0 = new THREE.Vector3(-0.3, -0.42, -0.2), dir = new THREE.Vector3(0.42, 0.9, -0.02).normalize(), a1 = a0.clone().addScaledVector(dir, len);
    b.add(limb([a0, a0.clone().lerp(a1, 0.34)], (d, a) => (0.034 - 0.008 * smooth(0, 0.3, d)) * (0.55 + 0.45 * Math.abs(Math.cos(a))), { seg: 10, step: 0.05, region: A.get('blank'), out: new THREE.Vector3(0, 0, -1), color: shade(mat.wood, 0.85), cap0: 0.02 }), null, { crease: 0.8 });
    b.add(limb([a0.clone().lerp(a1, 0.3), a1], () => 0.014, { seg: 8, step: 0.08, region: A.get('blank'), out: new THREE.Vector3(0, 0, -1), color: mat.gunmetal, cap1: 0.01 }), null, { crease: 0.8, gloss: 0.4 });
    if (kit === 'foot') b.add(limb([a1, a1.clone().addScaledVector(dir, 0.3)], (d) => 0.008 * (1 - d / 0.32), { seg: 6, step: 0.1, region: A.get('blank'), out: new THREE.Vector3(0, 0, -1), color: mat.metalLight }), null, { crease: 0.6, gloss: 0.8 });
  });
  if (kit === 'lancer' || kit === 'officer') {
    // In der rechten Faust (Griffachse = z der Hand: zeigt nach oben, wenn der Unterarm waagerecht nach vorn liegt)
    // in the right fist (grip axis = the hand's z: points up when the forearm lies level and forward)
    const gx = 0.045 * SP.hand, gy = -0.105 * SP.hand;
    const at = (z: number, y = 0, x = 0) => rig.point('handR', [gx + x, gy + y, 0.01 + z]);
    const inv = rig.matrix('handR').clone().invert();
    if (kit === 'lancer') {
      sk.part('handR', () => {
        b.add(limb([at(-1.45), at(3.0)], () => 0.02, { seg: 8, step: 0.5, region: A.get('blank'), out: rig.dir('handR', [1, 0, 0]), color: shade(mat.wood, 0.9), cap0: 0.02 }), null, { crease: 0.6 });
        b.add(limb([at(2.98), at(3.4)], (d, a) => 0.06 * Math.sin(Math.PI * Math.min(1, 0.12 + (d / 0.42) * 0.9)) * (0.4 + 0.6 * Math.abs(Math.cos(a))) + 0.004, { seg: 10, step: 0.03, region: A.get('blank'), out: rig.dir('handR', [1, 0, 0]), color: mat.metalLight }), null, { crease: 0.6, gloss: 0.8 });
      });
      // Wimpel: rot ueber gold, Schwalbenschwanz; weht zum Ellbogen hin (nach hinten) / pennant: red over gold, swallowtail; flies towards the elbow (backward)
      sk.part((p) => [rig.id('handR'), 1, smooth(0.02, 0.8, p.clone().applyMatrix4(inv).y - gy)], () => {
        for (const [z0, z1, c] of [[2.93, 2.75, L.primary], [2.75, 2.57, GOLD]] as [number, number, THREE.Color][]) {
          b.add(sheet((u, v) => { const zm = (z0 + z1) / 2, z = z0 + (z1 - z0) * v; return at(z + (zm - z) * 0.55 * u * u + (2.75 - z) * 0.5 * u, 0.025 + 0.8 * u, 0.03 * Math.sin(u * 6) * u); },
            { nu: 12, nv: 3, region: A.get('blank'), thick: 0.01, color: c, backColor: c }), null, { crease: 0.7 });
        }
      });
    } else {
      sk.part('handR', () => {
        // Klinge leicht gebogen, Parierstange, Knauf / blade slightly curved, guard, pommel
        b.add(limb([at(0.07), at(0.6, -0.03), at(1.25, -0.11)], (d, a) => (0.034 - 0.02 * (d / 1.2)) * (0.22 + 0.78 * Math.abs(Math.sin(a))), { seg: 8, step: 0.1, region: A.get('blank'), out: rig.dir('handR', [1, 0, 0]), color: mat.metalLight, cap1: 0.1 }), null, { crease: 0.8, gloss: 0.9 });
        b.add(limb([at(0.045, 0.07), at(0.06), at(0.045, -0.07)], () => 0.013, { seg: 8, step: 0.03, region: A.get('blank'), out: rig.dir('handR', [1, 0, 0]), color: GOLD }), null, { crease: 0.7, gloss: 0.7 });
        b.add(limb([at(-0.07), at(-0.11)], () => 0.022, { seg: 8, step: 0.02, region: A.get('blank'), out: rig.dir('handR', [1, 0, 0]), color: GOLD, cap1: 0.02 }), null, { crease: 0.7, gloss: 0.7 });
      });
    }
  }
  if (kit !== 'foot') {
    // Saebel an der linken Huefte / sabre at the left hip
    sk.part('root', () => {
      const top = new THREE.Vector3(0.36, -0.32, 0.02), tip = new THREE.Vector3(0.45, -1.2, -0.36);
      b.add(limb([top, top.clone().lerp(tip, 0.5).add(new THREE.Vector3(0.01, 0, 0.03)), tip], (d, a) => (0.026 - 0.007 * (d / 0.96)) * (0.62 + 0.38 * Math.abs(Math.sin(a))), { seg: 10, step: 0.06, region: A.get('blank'), out: new THREE.Vector3(1, 0, 0), color: mat.gunmetal, cap1: 0.02 }), null, { crease: 0.7, gloss: 0.4 });
      b.add(limb([top.clone().add(new THREE.Vector3(0, 0.01, 0)), top.clone().add(new THREE.Vector3(-0.01, 0.17, 0.05))], () => 0.018, { seg: 8, step: 0.05, region: A.get('blank'), out: new THREE.Vector3(1, 0, 0), color: GOLD, cap1: 0.012 }), null, { crease: 0.7, gloss: 0.6 });
    });
  } else {
    // Brotbeutel an der rechten Huefte / haversack at the right hip
    sk.part('root', () => {
      b.add(limb([new THREE.Vector3(-0.36, -0.3, -0.04), new THREE.Vector3(-0.38, -0.52, -0.05)], (d, a) => ell(0.05, 0.1, a) * (0.8 + 0.2 * smooth(0, 0.1, d)), { seg: 12, step: 0.04, region: A.get('blank'), out: new THREE.Vector3(-1, 0, 0), color: mix(mat.sand, PANTS, 0.35), cap0: 0.03, cap1: 0.04 }), null, { crease: 0.8 });
    });
  }
  // Kopf: einfacher junger Kopf, Ohren, Spitzhelm mit rotem Band und Stern / head: a simple young head, ears, spiked helmet with a red band and a star
  sk.part('head', () => {
    const S = new Sculpt(HEAD_C, HEAD_R, { jaw: 0.12, chin: 0.16, cheek: 0.07, noseLen: 0.26, noseW: 1.0, noseY: -0.2, mouthW: 0.34, mouthY: -0.57, eyeY: 0.1, flat: 0.1 });
    b.add(headGeometry(S, { skin: SKIN, face: A.get('sFace'), scalp: A.get('sScalp'), ws: lod() < 1 ? 36 : 56, hs: lod() < 1 ? 28 : 42, cut: (p) => p.y > 0.6 }), null, { crease: 0 });
    b.mirrorX(() => { b.group({ p: S.dir([1, -0.06, -0.06], -0.03), r: [0, -0.62, 0.08] }, () => b.add(earGeometry(A.get('sEar'), 0.062, SKIN), null, { crease: 0.5 })); });
    const prof: [number, number][] = [[0.17, 0.762], [0.205, 0.756], [0.21, 0.772], [0.19, 0.782], [0.186, 0.84], [0.165, 0.905], [0.115, 0.952], [0.05, 0.975], [0.028, 0.985], [0.02, 1.03], [0.006, 1.085], [1e-4, 1.09]];
    b.add(revolve(prof, { seg: 24, sub: 1, region: A.get('sHelmet'), centre: [0, 0.02], front: 1.06, mirror: true, color: HELMET }), null, { crease: 0.9, gloss: 0.3 });
    // Kinnriemen / chin strap
    for (const s of [-1, 1]) b.add(limb([new THREE.Vector3(s * 0.168, 0.765, 0.03), new THREE.Vector3(s * 0.158, 0.62, 0.07), new THREE.Vector3(s * 0.1, 0.5, 0.1), new THREE.Vector3(0, 0.468, 0.115)], () => 0.009, { seg: 6, step: 0.04, region: A.get('blank'), out: new THREE.Vector3(s, 0, 0.3).normalize(), color: LEATHER }), null, { crease: 0.6 });
  });
  return finish(b, sk, ARMY_ATLAS, 'root', { faction: 'korvat', part: 'soldier', kit, floor: SOLDIER_FLOOR }, { voxel: 0.014, reach: 0.16 });
}

// ---------- Pferd / horse ----------

/**
 * Skelett des Pferds (Masse in denselben Einheiten wie der Soldat: Widerrist 2.46 = 1,55 m). Boden bei y = 0, Blick +z.
 * Alle Gelenke 'free' [Nicken, Drehen, Rollen]: Nicken > 0 neigt nach vorn unten bzw. schwingt ein Bein nach hinten.
 * The horse's skeleton (sizes in the same units as the soldier: withers 2.46 = 1.55 m). Ground at y = 0, facing +z.
 * All joints 'free' [pitch, yaw, roll]: pitch > 0 tips forward-down resp. swings a leg backward.
 */
export const HORSE_H = 2.46;
let HRIG: Rig | null = null;
export function horseRig(): Rig {
  if (HRIG) return HRIG;
  const r = new Rig();
  r.add({ name: 'body', parent: null, offset: [0, 1.98, 0], kind: 'free' });
  r.add({ name: 'chest', parent: 'body', offset: [0, 0.02, 0.45], kind: 'free' });
  r.add({ name: 'hind', parent: 'body', offset: [0, 0.04, -0.45], kind: 'free' });
  r.add({ name: 'neck1', parent: 'chest', offset: [0, 0.26, 0.42], kind: 'free' });
  r.add({ name: 'neck2', parent: 'neck1', offset: [0, 0.46, 0.36], kind: 'free' });
  r.add({ name: 'head', parent: 'neck2', offset: [0, 0.44, 0.3], kind: 'free' });
  r.add({ name: 'tail', parent: 'hind', offset: [0, 0.2, -0.62], kind: 'free' });
  for (const [S, s] of [['L', 1], ['R', -1]] as [string, number][]) {
    // vorn: Unterarm (Ellbogen -> Vorderfusswurzel), Roehre, Fessel / front: forearm (elbow -> knee), cannon, pastern
    r.add({ name: `fa${S}`, parent: 'chest', offset: [s * 0.25, -0.4, 0.22], kind: 'free' });
    r.add({ name: `fb${S}`, parent: `fa${S}`, offset: [0, -0.62, 0.0], kind: 'free' });
    r.add({ name: `fc${S}`, parent: `fb${S}`, offset: [0, -0.58, 0.0], kind: 'free' });
    // hinten: Schenkel (Huefte -> Knie), Unterschenkel (-> Sprunggelenk), Roehre, Fessel / hind: thigh (hip -> stifle), gaskin (-> hock), cannon, pastern
    r.add({ name: `ha${S}`, parent: 'hind', offset: [s * 0.26, -0.04, -0.3], kind: 'free' });
    r.add({ name: `hb${S}`, parent: `ha${S}`, offset: [0, -0.46, 0.2], kind: 'free' });
    r.add({ name: `hc${S}`, parent: `hb${S}`, offset: [0, -0.5, -0.36], kind: 'free' });
    r.add({ name: `hd${S}`, parent: `hc${S}`, offset: [0, -0.62, 0.02], kind: 'free' });
    r.mark(`hoofF${S}`, `fc${S}`, [0, -0.38, 0.1]);
    r.mark(`hoofH${S}`, `hd${S}`, [0, -0.4, 0.1]);
  }
  r.mark('saddle', 'body', [0, 0.47, -0.06]);
  r.mark('pommel', 'body', [0, 0.6, 0.26]);
  r.mark('muzzle', 'head', [0, -0.55, 0.5]);
  return (HRIG = r);
}

/** coat = Fellfarbe; die Variante faerbt Blender je Tier um / coat colour; Blender tints the variant per animal */
export function buildHorse(): THREE.BufferGeometry {
  const A = layout(), rig = horseRig();
  const b = new UvBuilder(A.get('blank')), sk = new Skinner(b, rig);
  const up = new THREE.Vector3(0, 1, 0);
  const idc = rig.id('chest'), idh = rig.id('hind'), idb = rig.id('body');
  // Rumpf: Kruppe, Flanke, Bauch, Gurttiefe, Brust / barrel: croup, flank, belly, girth, chest
  const bodyPath: THREE.Vector3[] = [], zs = [-1.1, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.85, 1.0], ys = [1.9, 1.98, 2.0, 1.97, 1.93, 1.9, 1.92, 1.98, 2.02];
  zs.forEach((z, i) => bodyPath.push(new THREE.Vector3(0, ys[i], z)));
  const BR = curve([[0, 0.22, 0.18], [0.2, 0.44, 0.38], [0.5, 0.51, 0.47], [0.85, 0.5, 0.48], [1.15, 0.52, 0.5], [1.45, 0.56, 0.48], [1.75, 0.52, 0.42], [1.98, 0.43, 0.33], [2.12, 0.25, 0.19]]);
  const barrelSkin: SkinFn = (p) => (p.z > 0.3 ? [idc, smooth(0.3, 0.6, p.z), 0] : p.z < -0.3 ? [idh, smooth(-0.3, -0.6, p.z), 0] : [idb, 1, 0]);
  sk.part(barrelSkin, () => {
    b.add(limb(bodyPath, (d, a) => {
      const [rv, rh] = BR(d);
      // Widerrist und Kruppe oben, Brustbein unten vorn / withers and croup on top, sternum low in front
      return ell(rv, rh, a) + 0.05 * gauss(d - 1.72, 0.2) * bump(a, 0, 0.7) + 0.03 * gauss(d - 0.35, 0.3) * bump(a, 0, 0.9) - 0.04 * gauss(d - 1.0, 0.4) * bump(a, 0, 0.6);
    }, { seg: 36, step: 0.05, region: A.get('hBarrel'), out: up, color: BAY, cap0: 0.22, cap1: 0.2 }), null, { crease: 0.3 });
  });
  // Hals und Kopf / neck and head
  const n0 = new THREE.Vector3(0, 2.02, 0.7), n1 = rig.head('neck1'), n2 = rig.head('neck2'), poll = rig.head('head');
  sk.part(sk.chain(['chest', 'neck1', 'neck2', 'head'], [0.1, 0.14, 0.14, 0.1]), () => {
    const NR = curve([[0, 0.4, 0.3], [0.3, 0.37, 0.27], [0.75, 0.27, 0.19], [1.2, 0.2, 0.15], [1.5, 0.17, 0.14]]);
    b.add(limb([n0, n1.clone().add(new THREE.Vector3(0, -0.02, 0)), n2.clone().add(new THREE.Vector3(0, -0.03, -0.02)), poll.clone().add(new THREE.Vector3(0, 0.0, -0.02))], (d, a) => { const [rv, rh] = NR(d); return ell(rv, rh, a); },
      { seg: 28, step: 0.05, region: A.get('hNeck'), out: new THREE.Vector3(0, 0.6, -0.8).normalize(), color: BAY, cap0: 0.2, cap1: 0.1 }), null, { crease: 0.3 });
  });
  const muz = rig.point('head', [0, -0.56, 0.5]);
  sk.part('head', () => {
    const HR = curve([[0, 0.13, 0.13], [0.12, 0.2, 0.165], [0.3, 0.2, 0.155], [0.5, 0.14, 0.11], [0.68, 0.115, 0.1], [0.8, 0.12, 0.105]]);
    const face = new THREE.Vector3(0, 0.66, 0.75).normalize();
    b.add(limb([poll.clone().add(new THREE.Vector3(0, 0.06, -0.06)), poll.clone().lerp(muz, 0.5).add(new THREE.Vector3(0, 0.03, 0.03)), muz], (d, a) => {
      const [rv, rh] = HR(d);
      // Ganasche (Backe) unten, flacher Nasenruecken / jowl below, flat nose bridge
      return ell(rv, rh, a) + 0.05 * gauss(d - 0.2, 0.14) * bump(a, Math.PI, 0.9);
    }, { seg: 24, step: 0.03, region: A.get('hHead'), out: face, color: (d) => (d > 0.62 ? shade(BAY_DARK, 0.9) : BAY), cap0: 0.07, cap1: 0.09 }), null, { crease: 0.4 });
    // Ohren / ears
    for (const s of [-1, 1]) {
      const e0 = poll.clone().add(new THREE.Vector3(s * 0.09, 0.05, -0.02));
      b.add(limb([e0, e0.clone().add(new THREE.Vector3(s * 0.03, 0.22, 0.03))], (d, a) => 0.05 * Math.sin(Math.PI * Math.min(1, 0.3 + (d / 0.22) * 0.72)) * (0.6 + 0.4 * Math.abs(Math.sin(a))), { seg: 8, step: 0.04, region: A.get('blank'), out: new THREE.Vector3(0, 0, 1), color: BAY }), null, { crease: 0.6 });
    }
    // Zaumzeug: Nasenriemen, Stirnriemen, Backenstuecke, Gebissring / bridle: noseband, browband, cheek pieces, bit ring
    const ring = (t: number, rv: number, rh: number) => {
      const c = poll.clone().lerp(muz, t), ax = muz.clone().sub(poll).normalize(), sx = new THREE.Vector3(1, 0, 0), uy = new THREE.Vector3().crossVectors(ax, sx).normalize();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push(c.clone().addScaledVector(sx, Math.cos(a) * rh).addScaledVector(uy, Math.sin(a) * rv)); }
      b.add(limb(pts, () => 0.012, { seg: 6, step: 0.03, region: A.get('blank'), out: ax, color: LEATHER }), null, { crease: 0.6 });
    };
    ring(0.7, 0.135, 0.118);
    ring(0.2, 0.25, 0.185);
    for (const s of [-1, 1]) {
      b.add(limb([poll.clone().lerp(muz, 0.2).add(new THREE.Vector3(s * 0.18, 0, 0)), poll.clone().lerp(muz, 0.72).add(new THREE.Vector3(s * 0.12, -0.02, 0))], () => 0.011, { seg: 6, step: 0.06, region: A.get('blank'), out: new THREE.Vector3(s, 0, 0), color: LEATHER }), null, { crease: 0.6 });
      b.add(limb([poll.clone().lerp(muz, 0.78).add(new THREE.Vector3(s * 0.115, -0.08, 0)), poll.clone().lerp(muz, 0.78).add(new THREE.Vector3(s * 0.125, -0.085, 0))], () => 0.034, { seg: 10, step: 0.01, region: A.get('blank'), out: new THREE.Vector3(0, 1, 0), color: GOLD, cap0: 0.004, cap1: 0.004 }), null, { crease: 0.6, gloss: 0.6 });
    }
  });
  // Zuegel: vom Gebissring am Hals entlang zum Sattelknauf (folgen dem Hals) / reins: from the bit ring along the neck to the pommel (they follow the neck)
  for (const s of [-1, 1]) {
    const bit = poll.clone().lerp(muz, 0.78).add(new THREE.Vector3(s * 0.125, -0.085, 0)), pom = rig.point('body', [s * 0.07, 0.56, 0.3]);
    const mid1 = n2.clone().add(new THREE.Vector3(s * 0.19, -0.2, 0.1)), mid2 = n1.clone().add(new THREE.Vector3(s * 0.26, 0.05, -0.05));
    const chain = sk.chain(['chest', 'neck1', 'neck2', 'head'], [0.1, 0.14, 0.14, 0.1]);
    sk.part((p) => (p.z < 0.62 ? [idc, 1, 0] : chain(p)), () => {
      b.add(limb([bit, mid1, mid2, pom], () => 0.011, { seg: 6, step: 0.06, region: A.get('blank'), out: new THREE.Vector3(s, 0.3, 0).normalize(), color: LEATHER }), null, { crease: 0.6 });
    });
  }
  // Beine / legs
  const leg = (bones: string[], top: THREE.Vector3, knots: number[][], hoofLen: number) => {
    const pts = [top, ...bones.slice(1).map((n) => rig.head(n))];
    const last = bones[bones.length - 1];
    const hoofTop = rig.point(last, [0, -hoofLen + 0.16, 0.07]);
    pts.push(hoofTop);
    const R = curve(knots.map((k) => [k[0], k[1] * 1.14, k[2] * 1.16]));
    sk.part(sk.chain(bones, 0.08), () => {
      b.add(limb(pts, (d, a) => { const [rf, rs] = R(d); return ell(rf, rs, a); }, { seg: 16, step: 0.04, region: A.get('hLeg'), out: new THREE.Vector3(0, 0, 1), color: (d) => (d > knots[knots.length - 3][0] ? BAY_DARK : BAY), cap0: 0.14, cap1: 0.03 }), null, { crease: 0.4 });
    });
    // Huf: Kegelstumpf, unten flach / hoof: a truncated cone, flat below
    sk.part(last, () => {
      const h0 = hoofTop.clone().add(new THREE.Vector3(0, 0.02, -0.01)), h1 = rig.point(last, [0, -hoofLen, 0.1]);
      b.add(limb([h0, h1], (d, a) => (0.075 + 0.04 * (d / 0.17)) * (1 + 0.14 * Math.cos(a)), { seg: 14, step: 0.04, region: A.get('blank'), out: new THREE.Vector3(0, 0, 1), color: HOOF, cap0: 0.02 }), null, { crease: 0.8, gloss: 0.3 });
    });
  };
  for (const [S, s] of [['L', 1], ['R', -1]] as [string, number][]) {
    leg([`fa${S}`, `fb${S}`, `fc${S}`], rig.head(`fa${S}`).add(new THREE.Vector3(-s * 0.02, 0.3, 0.02)),
      [[0, 0.2, 0.15], [0.3, 0.17, 0.13], [0.55, 0.12, 0.1], [0.86, 0.082, 0.078], [0.92, 0.092, 0.086], [1.05, 0.062, 0.058], [1.4, 0.06, 0.056], [1.5, 0.078, 0.07], [1.62, 0.062, 0.06], [1.8, 0.07, 0.068]], 0.38);
    leg([`ha${S}`, `hb${S}`, `hc${S}`, `hd${S}`], rig.head(`ha${S}`).add(new THREE.Vector3(-s * 0.03, 0.2, -0.05)),
      [[0, 0.3, 0.2], [0.3, 0.3, 0.2], [0.7, 0.2, 0.15], [1.0, 0.13, 0.11], [1.28, 0.09, 0.082], [1.34, 0.1, 0.09], [1.5, 0.068, 0.062], [1.9, 0.064, 0.06], [1.98, 0.082, 0.074], [2.1, 0.064, 0.062], [2.3, 0.072, 0.07]], 0.4);
  }
  // Schweif und Maehne: Tuch / tail and mane: cloth
  const dock = rig.head('tail');
  sk.part((p) => [rig.id('tail'), 1, smooth(dock.y - 0.1, 0.75, p.y)], () => {
    b.add(limb([dock.clone().add(new THREE.Vector3(0, 0.02, 0.06)), dock.clone().add(new THREE.Vector3(0, -0.1, -0.2)), dock.clone().add(new THREE.Vector3(0, -0.7, -0.36)), dock.clone().add(new THREE.Vector3(0, -1.45, -0.34))],
      (d, a) => (0.04 + 0.07 * Math.sin(Math.PI * Math.min(1, (d / 1.6) * 0.95)) ** 0.8) * (1 + 0.14 * Math.cos(3 * a)), { seg: 14, step: 0.06, region: A.get('hHair'), out: new THREE.Vector3(0, 0, -1), color: MANE, cap0: 0.04, cap1: 0.3 }), null, { crease: 0.5 });
  });
  const neckChain = sk.chain(['chest', 'neck1', 'neck2', 'head'], [0.1, 0.14, 0.14, 0.1]);
  const crest = (t: number): THREE.Vector3 => {
    // Kammlinie vom Genick (t = 0) zum Widerrist (t = 1) / crest line from the poll (t = 0) to the withers (t = 1)
    const pts = [poll.clone().add(new THREE.Vector3(0, 0.12, -0.08)), n2.clone().add(new THREE.Vector3(0, 0.1, -0.22)), n1.clone().add(new THREE.Vector3(0, 0.2, -0.32)), new THREE.Vector3(0, 2.5, 0.42)];
    const k = t * 3, i = Math.min(2, Math.floor(k));
    return pts[i].clone().lerp(pts[i + 1], k - i);
  };
  sk.part((p) => { const s = neckChain(p); return [s[0], s[1], smooth(0.05, 0.19, p.x)]; }, () => {
    b.add(sheet((u, v) => {
      const c = crest(u), len = 0.34 * (0.75 + 0.25 * Math.sin(u * 9)) * Math.sin(Math.PI * Math.min(1, 0.25 + u * 0.9));
      // faellt auf die linke Seite des Halses / falls onto the left side of the neck
      return new THREE.Vector3(c.x + 0.02 + 0.16 * Math.sin(v * 1.4) + 0.012 * Math.sin(u * 40) * v, c.y - len * v * (0.5 + 0.5 * v), c.z - 0.03 * v);
    }, { nu: 26, nv: 6, region: A.get('hHair'), thick: 0.02, color: MANE }), null, { crease: 0.5 });
  });
  sk.part('head', () => {
    // Stirnschopf / forelock
    b.add(limb([poll.clone().add(new THREE.Vector3(0, 0.1, 0.0)), poll.clone().add(new THREE.Vector3(0.02, 0.04, 0.12)), poll.clone().add(new THREE.Vector3(0.03, -0.12, 0.2))], (d) => 0.05 * Math.sin(Math.PI * Math.min(1, 0.2 + (d / 0.3) * 0.8)), { seg: 8, step: 0.04, region: A.get('hHair'), out: new THREE.Vector3(0, 0.5, 1).normalize(), color: MANE }), null, { crease: 0.5 });
  });
  // Satteldecke, Sattel, Gurt, Steigbuegel / saddle blanket, saddle, girth, stirrups
  const onBack = (z: number, a: number, lift: number): THREE.Vector3 => {
    // Punkt auf dem Rumpf: z entlang, a = Winkel vom Ruecken (+ = linke Seite) / point on the barrel: z along, a = angle from the back (+ = left side)
    const d = z + 1.1, [rv, rh] = BR(d), r = ell(rv, rh, a) + lift;
    const i = Math.max(0, Math.min(zs.length - 2, zs.findIndex((q) => q > z) - 1)), k = (z - zs[i]) / (zs[i + 1] - zs[i]);
    const cy = ys[i] + (ys[i + 1] - ys[i]) * k;
    return new THREE.Vector3(Math.sin(a) * r, cy + Math.cos(a) * r, z);
  };
  sk.part('body', () => {
    b.add(sheet((u, v) => onBack(-0.52 + 0.84 * u, (v - 0.5) * 2.5, 0.016), { nu: 14, nv: 22, region: A.get('hBlanket'), thick: 0.018, color: L.primary, backColor: shade(L.primary, 0.7), flip: true }), null, { crease: 0.9 });
    b.add(sheet((u, v) => {
      const a = (v - 0.5) * 1.5, p = onBack(-0.36 + 0.56 * u, a, 0.04);
      // Sitz mit Vorder- und Hinterzwiesel / seat with pommel and cantle
      p.y += (0.09 * Math.exp(-(((u - 0.97) / 0.12) ** 2)) + 0.1 * Math.exp(-(((u - 0.02) / 0.14) ** 2))) * Math.cos(a) ** 2;
      return p;
    }, { nu: 14, nv: 12, region: A.get('hSaddle'), thick: 0.035, color: LEATHER, backColor: shade(LEATHER, 0.7), flip: true }), null, { crease: 0.8, gloss: 0.3 });
    const girth: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) girth.push(onBack(0.02, (i / 24) * Math.PI * 2 - Math.PI, 0.012));
    b.add(limb(girth, (_d, a) => 0.012 + 0.03 * Math.abs(Math.sin(a)), { seg: 8, step: 0.06, region: A.get('blank'), out: new THREE.Vector3(0, 0, 1), color: LEATHER }), null, { crease: 0.7 });
    for (const s of [-1, 1]) {
      const t0 = onBack(-0.02, s * 0.85, 0.03), t1 = t0.clone().add(new THREE.Vector3(s * 0.1, -0.78, 0.04));
      b.add(limb([t0, t1], () => 0.011, { seg: 6, step: 0.1, region: A.get('blank'), out: new THREE.Vector3(s, 0, 0), color: LEATHER }), null, { crease: 0.6 });
      const loop: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; loop.push(t1.clone().add(new THREE.Vector3(0, -0.09 + Math.cos(a) * 0.09, Math.sin(a) * 0.075))); }
      b.add(limb(loop, () => 0.012, { seg: 6, step: 0.02, region: A.get('blank'), out: new THREE.Vector3(s, 0, 0), color: mat.metalLight }), null, { crease: 0.6, gloss: 0.6 });
    }
  });
  const g = finish(b, sk, ARMY_ATLAS, 'body', { faction: 'korvat', part: 'horse', floor: 0, height: HORSE_H }, { voxel: 0.02, reach: 0.22 });
  return g;
}

// ---------- Banner / banner ----------

let BRIG: Rig | null = null;
/** Banner: Stange (Fuss im Ursprung), Tuch am oberen Ende, weht nach -x / banner: pole (foot at the origin), cloth at the top, flies towards -x */
export function buildBanner(): THREE.BufferGeometry {
  const A = layout();
  const rig = (BRIG ??= new Rig().add({ name: 'pole', parent: null, offset: [0, 0, 0], kind: 'free' }).mark('top', 'pole', [0, 5.2, 0]).mark('grip', 'pole', [0, 1.9, 0]));
  const b = new UvBuilder(A.get('blank')), sk = new Skinner(b, rig);
  const top = 5.2, fw = 2.1, fh = 1.42;
  sk.part('pole', () => {
    b.add(limb([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, top, 0)], () => 0.03, { seg: 8, step: 0.4, region: A.get('blank'), out: new THREE.Vector3(0, 0, 1), color: shade(mat.wood, 0.9) }), null, { crease: 0.6 });
    // Spitze: goldene Lanzenspitze ueber einer Kugel / finial: a gold spear head above a ball
    b.add(limb([new THREE.Vector3(0, top - 0.02, 0), new THREE.Vector3(0, top + 0.42, 0)], (d, a) => (d < 0.14 ? 0.07 * Math.sin((d / 0.14) * Math.PI) ** 0.6 + 0.02 : 0.075 * Math.sin(Math.PI * Math.min(1, (d - 0.12) / 0.3)) * (0.45 + 0.55 * Math.abs(Math.cos(a))) + 0.004),
      { seg: 12, step: 0.02, region: A.get('blank'), out: new THREE.Vector3(1, 0, 0), color: GOLD }), null, { crease: 0.6, gloss: 0.7 });
  });
  sk.part((p) => [0, 1, Math.pow(smooth(0.0, fw, -p.x), 0.8)], () => {
    b.add(sheet((u, v) => new THREE.Vector3(-0.03 - fw * u, top - 0.08 - fh * v - 0.12 * u * u, 0.05 * Math.sin(u * 7) * u), { nu: 30, nv: 20, region: A.get('banner'), thick: 0.012, color: L.primary, backColor: L.primary }), null, { crease: 0.6 });
  });
  return finish(b, sk, ARMY_ATLAS, 'pole', { faction: 'korvat', part: 'banner', floor: 0, height: 5.2 }, { voxel: 0.03, reach: 0.1 });
}
