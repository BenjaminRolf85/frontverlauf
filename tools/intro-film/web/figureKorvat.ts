/**
 * Nur Filmexport (Anime-Schnitt): Grossmarschall Ilja Brodnik als ganze Filmfigur.
 * Film export only (anime cut): Grand Marshal Ilja Brodnik as a full film figure.
 *
 * Kopf und Koerper aus einem Guss: Kopf, Muetze, Schnurrbart, Brust mit Orden, Kragen und Schulterstuecke sind die
 * Heldenbueste des Spiels (leaderKorvat.ts, unveraendert aufgerufen und nach Zellen getrennt). Der Kopf wird ein
 * eigenes Teil mit eigenem Heldenatlas (das Gesicht 1,4-fach dichter: Nahaufnahmen), der Koerper bekommt darunter
 * Taille, Koppel, Rockschoss, Reithose mit Biese, Reitstiefel mit Sporen, Arme mit Aufschlaegen, Handschuhe mit
 * Fingern und den Saebel. Der Umhang ist ein drittes Teil (Tuch im Wind). Alle drei haengen am selben Skelett
 * (figureHuman.humanRig); Posen stehen in fv/poses.py.
 * Head and body from one mould: head, cap, moustache, chest with medals, collar and epaulettes are the game's hero
 * bust (leaderKorvat.ts, called unchanged and split by cells). The head becomes a piece of its own with its own hero
 * atlas (the face 1.4 times denser: close-ups), the body gets waist, belt, skirt, breeches with a stripe, riding boots
 * with spurs, arms with cuffs, gloves with fingers and the sabre below it. The cape is a third piece (cloth in the
 * wind). All three hang on the same skeleton (figureHuman.humanRig); poses are in fv/poses.py.
 *
 * Mimik: dieselbe Kopfgeometrie, verschiedene Gesichtszeichnungen (eigene Atlanten 'fig-korvat-head-<name>'):
 * Blender blendet zwischen ihnen (Blinzeln, verengte Augen).
 * Expression: the same head geometry, different face drawings (atlases 'fig-korvat-head-<name>' of their own): Blender
 * blends between them (blink, narrowed eyes).
 */
import * as THREE from 'three';
import { mix, rng, shade } from '../../../src/render/models/kit';
import { look, mat } from '../../../src/render/models/look';
import { bakeAO } from '../../../src/render/models/inked/ao';
import { atlasDef, defineAtlas, hasAtlas, spline, type Cell, type Pen, type Pt } from '../../../src/render/models/inked/atlas';
import { korvat } from '../../../src/render/models/inked/leaderKorvat';
import { sheet, stud, torsoPoint, type TorsoSpec } from '../../../src/render/models/inked/leaderKit';
import { fold, GOLD, GOLD_DARK, lineScale, moodArt, type MoodArt } from '../../../src/render/models/inked/leaderPaint';
import { REF, UvBuilder, type AtlasLayout } from '../../../src/render/models/inked/uvkit';
import { limb, pickTriangles, Skinner, smooth, type Rig } from './figureKit';
import { arms, belt, boots, floorY, hands, HERO, humanRig, legs, trunk, trunkAt, type Human, type TrunkRow } from './figureHuman';

const L = look('korvat');
/** Oberkoerper der Bueste (Abschrift von T in leaderKorvat.ts) / the bust's torso (copy of T in leaderKorvat.ts) */
const T: TorsoSpec = { w: 0.45, d: 0.22, h: 0.35, slope: 0.085, neckR: 0.11, rise: 0.055, square: 0.3, z: -0.01, chest: 0.012 };
const COAT = L.primary;
const PANTS = L.pants;
const BOOT = mat.dark;
const GLOVE = mix(mat.paper, mat.white, 0.4);
const BELT = shade(mat.wood, 0.7);
const CAPE_C = L.helmet;
const LINING = mix(shade(L.primary, 0.56), mat.dark, 0.12);
const P = HERO;
export const FLOOR = floorY(P);

/** Rumpf unter dem Brustkorb: kraeftiger aelterer Mann, Taille am Koppel, Rockschoss bis zum halben Schenkel / trunk below the rib cage */
const HEM = -0.645;
const ROWS: TrunkRow[] = [
  [0, T.w * 0.86, T.d * 0.92, -0.01, 3.2], [-0.08, 0.379, 0.204, -0.01, 3.1], [-0.16, 0.362, 0.205, -0.01, 3], [-0.22, 0.35, 0.204, -0.01, 2.9], [-0.29, 0.364, 0.21, -0.01, 2.8],
  [-0.4, 0.4, 0.23, -0.01, 2.7], [-0.52, 0.43, 0.25, -0.01, 2.6], [HEM, 0.452, 0.264, -0.01, 2.6],
];
const BELT_Y: [number, number] = [-0.255, -0.185];

/** Zellen der Bueste, die zum Kopf gehoeren / cells of the bust that belong to the head */
const HEAD_CELLS = new Set(['face', 'scalp', 'ear', 'moustache', 'capBand', 'capCrown', 'capTop', 'peak', 'badge']);
/** Zellen der Bueste, die nur der Koerper braucht / cells of the bust only the body needs */
const TORSO_CELLS = new Set(['chest', 'back', 'side', 'top', 'neck', 'collar', 'epaulette', 'bullion', 'rack', 'medalA', 'medalB', 'star', 'star2']);

// ---------- Zeichnung / drawing ----------

/** Rock unter dem Brustkorb: s rundum (0.5 = vorn), t von y = 0 bis zum Saum / coat below the rib cage: s around (0.5 = front), t from y = 0 to the hem */
function paintTunic(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 2.6);
  const ty = (y: number) => (y / HEM) * H;
  p.gradient(0, ty(-0.3), W, H - ty(-0.3), [0, ty(-0.3)], [0, H], 1, 0.9);
  // Seitennaehte; die uebergeschlagene Vorderkante mit Goldpaspel laeuft von der Brust der Bueste bis zum Saum
  // side seams; the overlapping front edge with gold piping runs on from the bust's chest down to the hem
  for (const x of [0.25, 0.75]) p.line(spline([[W * x, 2], [W * x + 2, H * 0.5], [W * x, H - 4]], 4), lw(1.4), { taper: 0.2, wobble: 0.4 });
  const u1 = W / 2.66;
  p.band(spline([[W * 0.5, -2], [W * 0.5, ty(-0.3)], [W * 0.5 + 3, H - 8]], 4), u1 * 0.013, GOLD, lw(1.3));
  p.crease(spline([[W * 0.5 + u1 * 0.012, 0], [W * 0.5 + u1 * 0.012, ty(-0.3)], [W * 0.5 + u1 * 0.012 + 3, H - 8]], 4), u1 * 0.01, 0.72, 0.9, { taper: 0.05 });
  for (const y of [-0.022, -0.094]) for (const x of [-0.062, 0.062]) p.dab(W * 0.5 + (x + 0.006) * u1, ty(y - 0.008), u1 * 0.026, 0.66, 0.9);
  // Formschatten: Bauch unter der Brust, harte Kante / form shade: belly below the chest, hard edge
  for (const s of [-1, 1]) p.shade(spline([[W * (0.5 + s * 0.118), 0], [W * (0.5 + s * 0.128), ty(-0.1)], [W * (0.5 + s * 0.12), ty(-0.19)]], 4).concat([[W * (0.5 + s * 0.2), ty(-0.19)], [W * (0.5 + s * 0.2), 0]]), 0.84, 0.9);
  // Falten ueber dem Koppel (der Rock wird in der Taille gerafft) / folds above the belt (the coat is gathered at the waist)
  const R = rng(31);
  for (let i = 0; i < 12; i++) {
    const x = W * (0.04 + 0.92 * (i / 11)) + (R() - 0.5) * 10;
    if (Math.abs(x - W * 0.5) < 40) continue;
    fold(p, spline([[x, ty(-0.07)], [x + (R() - 0.5) * 5, ty(-0.13)], [x + (R() - 0.5) * 4, ty(-0.185)]], 4), lw(1.1), 4, 0.8, i % 2 ? 1 : -1);
  }
  // Rockschoss: tiefe Falten vom Koppel zum Saum, hinten der Schlitz / skirt: deep folds from the belt to the hem, the vent at the back
  for (let i = 0; i < 11; i++) {
    const x = W * (0.045 + 0.91 * (i / 10)) + (R() - 0.5) * 12;
    if (Math.abs(x - W * 0.5) < 26) continue;
    fold(p, spline([[x, ty(-0.27)], [x + (R() - 0.5) * 8, ty(-0.45)], [x + (R() - 0.5) * 12, H - 5]], 4), lw(1.3), 7, 0.78, i % 2 ? 1 : -1);
  }
  for (const x of [0.004, 0.996]) p.line([[W * x, ty(-0.3)], [W * x, H]], lw(2.2), { taper: 0.1 });
  // Taschenklappen mit Goldknopf / pocket flaps with a gold button
  for (const x of [0.33, 0.67]) {
    const cx = W * x, y0 = ty(-0.36), w = W * 0.052, h = H * 0.1;
    const flap: Pt[] = [[cx - w, y0], [cx + w, y0], [cx + w * 0.92, y0 + h], [cx, y0 + h * 1.4], [cx - w * 0.92, y0 + h]];
    p.shade(flap.map((q): Pt => [q[0] + 2, q[1] + 3.5]), 0.7, 0.9);
    p.line(flap, lw(1.5), { closed: true, wobble: 0.2 });
    p.spot(cx, y0 + h * 0.9, 4.2, GOLD);
    p.line(spline([[cx - 4.2, y0 + h * 0.9], [cx, y0 + h * 0.9 - 4.2], [cx + 4.2, y0 + h * 0.9], [cx, y0 + h * 0.9 + 4.2]], 3, true), lw(1), { closed: true });
  }
  // Schatten unter dem Koppel, dunkler Saum mit Goldpaspel / shade below the belt, dark hem with gold piping
  p.shade([[0, ty(-0.255)], [W, ty(-0.255)], [W, ty(-0.29)], [0, ty(-0.285)]], 0.72, 0.9);
  p.band([[-4, H - 9], [W + 4, H - 9]], 4.5, GOLD, lw(1.1));
  p.shade([[0, H - 6], [W, H - 6], [W, H], [0, H]], 0.7, 0.9);
}

function paintBelt(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 2.6);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.12, 0.82);
  p.stitch([[0, H * 0.24], [W, H * 0.24]], 3, 2.4, 0.9, 0.6);
  p.stitch([[0, H * 0.76], [W, H * 0.76]], 3, 2.4, 0.9, 0.6);
  p.fill([[0, H * 0.4], [W, H * 0.4], [W, H * 0.5], [0, H * 0.5]], mat.white, 0.16);
  p.scratches(0, 0, W, H, 8, 77, 14);
  // Schlaufen / keepers
  for (const x of [0.42, 0.58, 0.3, 0.7]) { p.line([[W * x, 1], [W * x, H - 1]], lw(1.2)); p.shade([[W * x, 0], [W * x + 5, 0], [W * x + 5, H], [W * x, H]], 0.75, 0.9); }
}

function paintBuckle(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.12);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.15, 0.8);
  p.line([[3, 3], [W - 3, 3], [W - 3, H - 3], [3, H - 3]], lw(1.4), { closed: true, wobble: 0.1 });
  const cx = W / 2, cy = H / 2, r = H * 0.33, pts: Pt[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  p.fill(pts, L.primary);
  p.line(pts, lw(1.1), { closed: true, wobble: 0.05 });
}

/** Aermel: s von der Schulter zum Handgelenk, t rundum (0.5 = aussen, 0.75 = vorn, 0 / 1 = Innennaht) / sleeve: s shoulder to wrist, t around */
function paintSleeve(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.0);
  const EL = 0.585;
  // Formschatten an der Innenseite, harte Kante / form shade on the inner side, hard edge
  p.shade(spline([[0, H * 0.1], [W * 0.3, H * 0.13], [W * EL, H * 0.09], [W, H * 0.12]], 5).concat([[W, 0], [0, 0]]), 0.8, 0.95);
  p.shade(spline([[0, H * 0.9], [W * 0.3, H * 0.88], [W * EL, H * 0.92], [W, H * 0.89]], 5).concat([[W, H], [0, H]]), 0.8, 0.95);
  // Armkugelnaht oben, Innennaht / armhole seam at the top, inner seam
  p.line(spline([[W * 0.085, 0], [W * 0.1, H * 0.5], [W * 0.085, H]], 5), lw(1.5), { taper: 0, wobble: 0.3 });
  p.stitch([[W * 0.11, 0], [W * 0.125, H * 0.5], [W * 0.11, H]], 3, 2.6, 0.9, 0.6);
  // Ellbogen: Faltenfaecher in der Beuge (vorn), zwei Zugfalten hinten / elbow: a fan of folds in the bend (front), two tension folds at the back
  for (let i = 0; i < 5; i++) {
    const k = (i - 2) / 2, x = W * (EL + k * 0.045);
    fold(p, spline([[x - k * 6, H * 0.62], [x, H * 0.76], [x + k * 9, H * 0.93]], 4), lw(1.25), 5, 0.78, k < 0 ? -1 : 1);
  }
  fold(p, spline([[W * (EL - 0.05), H * 0.36], [W * EL, H * 0.27], [W * (EL + 0.07), H * 0.3]], 4), lw(1.1), 4, 0.8);
  fold(p, spline([[W * (EL - 0.02), H * 0.18], [W * (EL + 0.03), H * 0.22], [W * (EL + 0.09), H * 0.19]], 4), lw(1), 3.5, 0.8);
  // lange Falten an Oberarm und Unterarm / long folds on upper arm and forearm
  fold(p, spline([[W * 0.16, H * 0.72], [W * 0.3, H * 0.68], [W * 0.44, H * 0.74]], 4), lw(1.1), 5, 0.8);
  fold(p, spline([[W * 0.2, H * 0.4], [W * 0.32, H * 0.36], [W * 0.42, H * 0.4]], 4), lw(1), 4, 0.82, -1);
  fold(p, spline([[W * 0.68, H * 0.66], [W * 0.78, H * 0.6], [W * 0.9, H * 0.64]], 4), lw(1), 4, 0.8);
  fold(p, spline([[W * 0.7, H * 0.34], [W * 0.82, H * 0.4], [W * 0.92, H * 0.37]], 4), lw(1), 3.5, 0.82, -1);
}

/** Aufschlag: goldene Borte, Eichenlaub, drei Knoepfe an der Aussenseite / cuff: gold braid, oak leaves, three buttons on the outside */
function paintCuff(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.13);
  p.gradient(0, 0, W, H, [0, 0], [W, 0], 1.0, 0.86);
  // s = entlang (0 = oben am Unterarm), t = rundum / s = along (0 = top at the forearm), t = around
  p.band([[W * 0.16, -4], [W * 0.16, H + 4]], W * 0.14, GOLD, lw(1.2));
  p.band([[W * 0.42, -4], [W * 0.42, H + 4]], W * 0.07, GOLD, lw(1));
  for (let i = 0; i < 10; i++) {
    const y = (H * (i + 0.5)) / 10;
    p.line(spline([[W * 0.11, y - 5], [W * 0.16, y], [W * 0.21, y - 5]], 3), lw(0.9), { taper: 0.4, wobble: 0.2 });
  }
  for (const y of [0.42, 0.5, 0.58]) { p.spot(W * 0.72, H * y, W * 0.07, GOLD); p.line(spline([[W * 0.65, H * y], [W * 0.72, H * y - W * 0.07], [W * 0.79, H * y], [W * 0.72, H * y + W * 0.07]], 3, true), lw(0.9), { closed: true }); }
  p.line([[W - 2, 0], [W - 2, H]], lw(1.5), { taper: 0 });
}

/** Handschuh, Handruecken: drei Ziernaehte, Saum am Handgelenk / glove, back of the hand: three decorative seams, hem at the wrist */
function paintGlove(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.22);
  // Handflaeche (t nahe 0 / 1) etwas dunkler / palm (t near 0 / 1) a little darker
  p.shade([[0, 0], [W, 0], [W, H * 0.2], [0, H * 0.2]], 0.86, 0.95);
  p.shade([[0, H * 0.8], [W, H * 0.8], [W, H], [0, H]], 0.86, 0.95);
  for (const y of [0.4, 0.5, 0.6]) p.line(spline([[W * 0.46, H * y], [W * 0.7, H * (y + (y - 0.5) * 0.25)], [W * 0.9, H * (y + (y - 0.5) * 0.5)]], 4), lw(1.1), { taper: 0.35, wobble: 0.2 });
  p.line(spline([[W * 0.26, 0], [W * 0.27, H * 0.5], [W * 0.26, H]], 4), lw(1.2), { taper: 0, wobble: 0.2 });
  p.stitch([[W * 0.31, 0], [W * 0.32, H * 0.5], [W * 0.31, H]], 3, 2.6, 0.9, 0.6);
  // Knoechelschatten / knuckle shade
  p.shade(spline([[W * 0.93, H * 0.28], [W * 0.97, H * 0.5], [W * 0.93, H * 0.72]], 4).concat([[W, H * 0.72], [W, H * 0.28]]), 0.84, 0.9);
}
/** Finger: Gelenkfalten auf dem Ruecken, dunklere Innenseite / finger: joint creases on the back, darker inner side */
function paintFinger(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.16);
  p.shade([[0, 0], [W, 0], [W, H * 0.22], [0, H * 0.22]], 0.86, 0.95);
  p.shade([[0, H * 0.78], [W, H * 0.78], [W, H], [0, H]], 0.86, 0.95);
  for (const x of [0.5, 0.75]) p.line(spline([[W * x, H * 0.32], [W * (x + 0.012), H * 0.5], [W * x, H * 0.68]], 3), lw(1), { taper: 0.35 });
}

/** Reithose: s von der Huefte abwaerts, t rundum (0.5 = aussen mit der Biese, 0.75 = vorn) / breeches: s from the hip down, t around (0.5 = outside with the stripe, 0.75 = front) */
function paintBreeches(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.07);
  const KN = 0.775;
  p.shade(spline([[0, H * 0.1], [W * 0.5, H * 0.12], [W, H * 0.1]], 4).concat([[W, 0], [0, 0]]), 0.8, 0.95);
  p.shade(spline([[0, H * 0.9], [W * 0.5, H * 0.88], [W, H * 0.9]], 4).concat([[W, H], [0, H]]), 0.8, 0.95);
  // doppelte rote Biese der Generale an der Aussennaht / the generals' double red stripe at the outer seam
  for (const y of [0.455, 0.545]) p.band([[-4, H * y], [W + 4, H * y]], H * 0.05, L.primary, lw(0.9));
  p.line([[0, H * 0.5], [W, H * 0.5]], lw(0.9), { taper: 0 });
  // Falten der weiten Hose: Bogen von der Huefte zur Ausbuchtung, Knie / folds of the wide breeches: arcs from the hip to the flare, knee
  const R = rng(19);
  for (let i = 0; i < 5; i++) {
    const y = H * (0.6 + 0.07 * i), x0 = W * (0.1 + 0.03 * i);
    fold(p, spline([[x0, y], [x0 + W * 0.12, y + H * 0.03 * (R() - 0.3)], [x0 + W * 0.26, y - H * 0.02]], 4), lw(1.2), 5, 0.8);
  }
  for (let i = 0; i < 3; i++) fold(p, spline([[W * (0.12 + 0.05 * i), H * (0.36 - 0.07 * i)], [W * (0.26 + 0.05 * i), H * (0.33 - 0.07 * i)], [W * (0.4 + 0.04 * i), H * (0.36 - 0.07 * i)]], 4), lw(1.1), 4, 0.82, -1);
  for (let i = 0; i < 4; i++) {
    const k = (i - 1.5) / 1.5, x = W * (KN + k * 0.04);
    fold(p, spline([[x - k * 4, H * 0.6], [x, H * 0.75], [x + k * 7, H * 0.9]], 4), lw(1.1), 4, 0.8, k < 0 ? -1 : 1);
  }
}

/** Stiefelschaft: schwarzer Lack, harter Glanzstreifen, Stulpe, Knautschfalten am Knoechel / boot shaft: black lacquer, a hard shine stripe, cuff, creases at the ankle */
function paintBootShaft(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.6);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.92, 1.0);
  // Glanz: langer Streifen vorn aussen, kurzer zweiter / shine: a long stripe at the outer front, a short second one
  p.fill(spline([[W * 0.1, H * 0.6], [W * 0.45, H * 0.585], [W * 0.78, H * 0.6], [W * 0.78, H * 0.66], [W * 0.45, H * 0.655], [W * 0.1, H * 0.66]], 4, true), mat.white, 0.5);
  p.fill(spline([[W * 0.14, H * 0.7], [W * 0.4, H * 0.695], [W * 0.56, H * 0.7], [W * 0.56, H * 0.72], [W * 0.14, H * 0.72]], 4, true), mat.white, 0.3);
  p.fill(spline([[W * 0.12, H * 0.3], [W * 0.5, H * 0.29], [W * 0.7, H * 0.3], [W * 0.7, H * 0.33], [W * 0.12, H * 0.33]], 4, true), mat.white, 0.16);
  // Stulpe oben / cuff at the top
  p.fill([[0, 0], [W * 0.075, 0], [W * 0.075, H], [0, H]], shade(BOOT, 1.35));
  p.line([[W * 0.075, 0], [W * 0.075, H]], lw(1.4), { taper: 0 });
  // hintere Naht, Knoechelfalten / back seam, ankle creases
  p.line([[W * 0.08, H * 0.25], [W, H * 0.25]], lw(0.9), { taper: 0.1 });
  for (let i = 0; i < 4; i++) {
    const x = W * (0.8 + i * 0.045);
    p.line(spline([[x, H * 0.52], [x - 5, H * 0.68], [x + 1, H * 0.84]], 4), lw(1.1), { taper: 0.4, wobble: 0.4 });
  }
}
/** Stiefelfuss: s von der Ferse zur Spitze, t rundum (0.5 = oben) / boot foot: s heel to toe, t around (0.5 = top) */
function paintBootFoot(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.4);
  p.gradient(0, 0, W, H, [0, 0], [W, 0], 0.94, 1.0);
  // Glanz auf Kappe und Spann, Kappennaht, Falten am Ballen / shine on toe cap and instep, toe cap seam, creases at the ball
  p.fill(spline([[W * 0.74, H * 0.44], [W * 0.86, H * 0.42], [W * 0.93, H * 0.5], [W * 0.86, H * 0.58], [W * 0.74, H * 0.56]], 4, true), mat.white, 0.5);
  p.fill(spline([[W * 0.3, H * 0.47], [W * 0.5, H * 0.46], [W * 0.5, H * 0.52], [W * 0.3, H * 0.53]], 4, true), mat.white, 0.3);
  p.line(spline([[W * 0.69, H * 0.14], [W * 0.66, H * 0.5], [W * 0.69, H * 0.86]], 4), lw(1.2), { taper: 0.1, wobble: 0.3 });
  for (let i = 0; i < 3; i++) { const x = W * (0.52 + i * 0.05); p.line(spline([[x, H * 0.3], [x + 4, H * 0.5], [x, H * 0.7]], 4), lw(1), { taper: 0.4, wobble: 0.3 }); }
  // Fersenkappe / heel counter
  p.line(spline([[W * 0.2, H * 0.1], [W * 0.24, H * 0.5], [W * 0.2, H * 0.9]], 4), lw(1), { taper: 0.2, wobble: 0.3 });
}

function paintScabbard(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.95);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.0, 0.85);
  for (const x of [0.04, 0.3, 0.96]) { p.fill([[W * x - 6, 0], [W * x + 6, 0], [W * x + 6, H], [W * x - 6, H]], GOLD); p.line([[W * x - 6, 0], [W * x - 6, H]], lw(1)); p.line([[W * x + 6, 0], [W * x + 6, H]], lw(1)); }
  p.fill([[W * 0.08, H * 0.44], [W * 0.9, H * 0.44], [W * 0.9, H * 0.5], [W * 0.08, H * 0.5]], mat.white, 0.4);
}

/** Umhang aussen: Wolle, grosse Faltenlinien, dunkler zum Saum / cape outside: wool, large fold lines, darker towards the hem */
function paintCape(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.4);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.04, 0.86);
  // Faltentaeler (6 Falten wie die Geometrie) mit hartem Schatten an einer Seite / fold valleys (6 folds as the geometry) with a hard shade on one side
  for (let j = 0; j < CAPE_FOLDS; j++) {
    const x = W * ((j + 0.75) / CAPE_FOLDS);
    const valley = spline([[x, H * 0.1], [x - 4, H * 0.5], [x + 5, H - 8]], 5);
    const lit = spline([[x + W * 0.03, H * 0.16], [x + W * 0.045, H * 0.55], [x + W * 0.07, H - 8]], 5);
    p.shade([...valley, ...lit.reverse()], 0.76, 0.92);
    p.line(valley, lw(1.5), { taper: 0.45, wobble: 0.6, press: 0.4 });
  }
  p.line(spline([[W * 0.5, 4], [W * 0.5 + 2, H * 0.5], [W * 0.5 - 2, H - 4]], 4), lw(1), { taper: 0.3, wobble: 0.4 });
  // Saum mit roter Paspel und Goldborte / hem with red piping and gold braid
  p.band([[-4, H - 14], [W + 4, H - 14]], 5, GOLD, lw(1.1));
  p.band([[-4, H - 5], [W + 4, H - 5]], 6, L.primary, lw(1.2));
  p.shade([[0, 0], [W, 0], [W, H * 0.05], [0, H * 0.08]], 0.72, 0.9);
}
/** Umhang innen: rotes Futter / cape inside: red lining */
function paintCapeIn(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.4);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.82, 1.04);
  for (let j = 0; j < CAPE_FOLDS; j++) {
    const x = W * ((j + 0.25) / CAPE_FOLDS);
    const valley = spline([[x, H * 0.15], [x + 3, H * 0.6], [x - 3, H - 6]], 5);
    const lit = spline([[x - W * 0.03, H * 0.2], [x - W * 0.04, H * 0.6], [x - W * 0.06, H - 6]], 5);
    p.shade([...valley, ...lit.reverse()], 0.74, 0.9);
    p.line(valley, lw(1.2), { taper: 0.5, wobble: 0.5 });
  }
  p.band([[-4, H - 5], [W + 4, H - 5]], 6, shade(L.primary, 0.6), lw(1.2));
}
function paintCapeCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.0);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.82, 1.08);
  const R = rng(5);
  for (let i = 0; i < 7; i++) { const x = W * (0.08 + 0.13 * i) + (R() - 0.5) * 6; p.line(spline([[x, H * 0.2], [x + 4, H * 0.8]], 3), lw(1), { taper: 0.4, wobble: 0.4 }); }
}

const tiny = (c: Cell): Cell => ({ ...c, w: 8, h: 8, design: [c.w, c.h] });
/**
 * Die Bueste dunkelt Brust, Ruecken und Seiten zum unteren Rand ab (dort endet sie im Spiel). Die Figur geht weiter:
 * derselbe Verlauf umgekehrt hebt das wieder auf (nur die Tonschicht, Orden und Paspeln bleiben).
 * The bust darkens chest, back and sides towards its bottom edge (where it ends in the game). The figure goes on: the
 * same gradient reversed cancels that (the tone layer only, medals and piping stay).
 */
const UNFADE: Record<string, [number, number]> = { chest: [1 - 0.12 / (T.h + T.rise), 1 / 0.8], back: [0.6, 1 / 0.82], side: [0.55, 1 / 0.82] };
const unfade = (c: Cell): Cell => {
  const f = UNFADE[c.name];
  return f ? { ...c, paint: (p) => { c.paint(p); p.gradient(0, p.h * f[0], p.w, p.h * (1 - f[0]), [0, p.h * f[0]], [0, p.h], 1, f[1]); } } : c;
};

/** Zellen des Koerpers: die der Bueste (Kopfzellen winzig) und das Kostuem / cells of the body: the bust's (head cells tiny) and the costume */
function bodyCells(m: MoodArt): Cell[] {
  return [
    ...korvat.cells(m).map((c) => (HEAD_CELLS.has(c.name) ? tiny(c) : unfade(c))),
    { name: 'tunic', w: 472, h: 176, paint: paintTunic },
    { name: 'belt', w: 352, h: 24, paint: paintBelt },
    { name: 'buckle', w: 48, h: 36, paint: paintBuckle },
    { name: 'sleeve', w: 304, h: 144, paint: paintSleeve },
    { name: 'cuff', w: 48, h: 144, paint: paintCuff },
    { name: 'glove', w: 96, h: 112, paint: paintGlove },
    { name: 'finger', w: 64, h: 32, paint: paintFinger },
    { name: 'breeches', w: 296, h: 160, paint: paintBreeches },
    { name: 'bootShaft', w: 208, h: 144, paint: paintBootShaft },
    { name: 'bootFoot', w: 144, h: 112, paint: paintBootFoot },
    { name: 'scabbard', w: 192, h: 24, paint: paintScabbard },
  ];
}
/** Zellen des Kopfes: das Gesicht so gross, wie es der Atlas hergibt / cells of the head: the face as large as the atlas allows */
function headCells(m: MoodArt, k: number): Cell[] {
  return korvat.cells(m).map((c) => (TORSO_CELLS.has(c.name) ? tiny(c) : c.name === 'face' ? { ...c, w: Math.round(c.w * k), h: Math.round(c.h * k), design: [c.w, c.h] as [number, number] } : c));
}
function capeCells(): Cell[] {
  return [
    { name: 'cape', w: 768, h: 480, paint: paintCape },
    { name: 'capeIn', w: 640, h: 400, paint: paintCapeIn },
    { name: 'capeCollar', w: 512, h: 96, paint: paintCapeCollar },
  ];
}

// ---------- Mimik / expressions ----------

/** Gesichtszeichnungen: Name -> Mimik (die Kopfgeometrie bleibt die neutrale) / face drawings: name -> expression (the head geometry stays the neutral one) */
const NEUTRAL = moodArt('neutral', korvat.side ?? 1);
export const FACES: Record<string, MoodArt> = {
  neutral: NEUTRAL,
  // verengte Augen: Lider halb zu, Brauen innen tief, Zornesfalte / narrowed eyes: lids half closed, brows low inside, frown line
  narrow: { ...NEUTRAL, browIn: () => -0.062, browOut: () => 0.022, upper: () => 0.26, lower: () => 0.3, iris: 0.96, frown: 0.9, forehead: 0.5 },
  // Blinzeln: Lider zu / blink: lids closed
  blink: { ...NEUTRAL, upper: () => 0.64, lower: () => 0.3, browIn: () => -0.012, browOut: () => -0.008 },
};
export const headAtlas = (face: string): string => (face === 'neutral' ? 'fig-korvat-head' : `fig-korvat-head-${face}`);
const BODY_ATLAS = 'fig-korvat-body', CAPE_ATLAS = 'fig-korvat-cape';

function defineHead(face: string): AtlasLayout {
  const id = headAtlas(face);
  if (!hasAtlas(id)) {
    // groesstes Gesicht, das noch in den Atlas passt / the largest face that still fits the atlas
    let ok = false;
    for (const k of [1.5, 1.45, 1.4, 1.35, 1.3, 1.2, 1.1, 1]) {
      try { defineAtlas(id, headCells(FACES[face], k), { hero: true }); ok = true; break; } catch { /* kleiner versuchen / try smaller */ }
    }
    if (!ok) throw new Error(`atlas ${id}: full`);
  }
  return atlasDef(id).layout;
}

// ---------- Bueste zerlegen / splitting the bust ----------

/** Zelle, in der eine Texturkoordinate liegt / the cell a texture coordinate lies in */
function cellAt(A: AtlasLayout, u: number, v: number): string {
  for (const r of A.regions.values()) if (u * REF >= r.x - 0.5 && u * REF <= r.x + r.w + 0.5 && v * REF >= r.y - 0.5 && v * REF <= r.y + r.h + 0.5) return r.name;
  return 'blank';
}
type Group = 'head' | 'neck' | 'collar' | 'epL' | 'epR' | 'chest';
/** Zu welchem Teil der Figur gehoert ein Dreieck der Bueste? / which part of the figure does a triangle of the bust belong to? */
function groupOf(A: AtlasLayout, c: THREE.Vector3, u: number, v: number): Group {
  const cell = cellAt(A, u, v);
  if (HEAD_CELLS.has(cell)) return 'head';
  if ((cell === 'blank' || cell === 'button') && c.y > 0.62) return 'head';
  if (cell === 'neck') return 'neck';
  if (cell === 'collar' || (cell === 'blank' && c.y > 0.32 && c.y < 0.48 && Math.hypot(c.x, c.z) < 0.17)) return 'collar';
  const loose = cell === 'epaulette' || cell === 'bullion' || cell === 'blank' || cell === 'button';
  if (loose && !(c.z > 0.12 && c.y < 0.32) && (Math.abs(c.x) > 0.36 || (Math.abs(c.x) > 0.15 && c.y > 0.315))) return c.x > 0 ? 'epL' : 'epR';
  return 'chest';
}
/** Teile der Bueste mit ihren Glanz- und Knickwerten einfuegen (UvBuilder.add setzt fx neu) / add parts of the bust with their gloss and crease values (UvBuilder.add resets fx) */
function addKeepingFx(b: UvBuilder, g: THREE.BufferGeometry): void {
  const fx = g.getAttribute('fx') as THREE.BufferAttribute;
  const kinds = new Map<string, [number, number]>();
  for (let t = 0; t < fx.count; t += 3) kinds.set(`${fx.getX(t)}|${fx.getY(t)}`, [fx.getX(t), fx.getY(t)]);
  for (const [key, [gloss, crease]] of kinds) {
    const part = new THREE.BufferGeometry(), idx: number[] = [];
    for (let t = 0; t < fx.count; t += 3) if (`${fx.getX(t)}|${fx.getY(t)}` === key) idx.push(t, t + 1, t + 2);
    for (const name of ['position', 'normal', 'uv', 'color']) {
      const a = g.getAttribute(name) as THREE.BufferAttribute, n = a.itemSize, arr = new Float32Array(idx.length * n);
      idx.forEach((v, i) => { for (let k = 0; k < n; k++) arr[i * n + k] = a.getComponent(v, k); });
      part.setAttribute(name, new THREE.BufferAttribute(arr, n));
    }
    part.userData.smooth = true;
    b.add(part, null, { gloss, crease });
  }
}
function bustPart(A: AtlasLayout, groups: Group[]): THREE.BufferGeometry {
  const tb = new UvBuilder(A.get('blank'));
  korvat.build(tb, A, NEUTRAL);
  return pickTriangles(tb.build(), (c, u, v) => groups.includes(groupOf(A, c, u, v)));
}

// ---------- Aufbau / build ----------

function body(H: Human, A: AtlasLayout): void {
  const { b, sk } = H;
  // Brust, Orden, Knoepfe der Bueste: an der Wirbelkette; Kragen starr an der Brust; Hals weich zum Kopf;
  // Schulterstuecke an den Schluesselbeinen (sie heben sich mit dem Arm)
  // chest, medals, buttons of the bust: on the spine chain; collar rigid on the chest; neck soft towards the head;
  // epaulettes on the clavicles (they rise with the arm)
  sk.part(sk.chain(['root', 'spine', 'chest'], 0.07), () => addKeepingFx(b, bustPart(A, ['chest'])));
  sk.part('chest', () => addKeepingFx(b, bustPart(A, ['collar'])));
  sk.part(sk.chain(['chest', 'neck', 'head'], [0.05, 0.045, 0.05]), () => addKeepingFx(b, bustPart(A, ['neck'])));
  sk.part('clavL', () => addKeepingFx(b, bustPart(A, ['epL'])));
  sk.part('clavR', () => addKeepingFx(b, bustPart(A, ['epR'])));

  trunk(H, { region: A.get('tunic'), color: COAT, rows: ROWS, beltY: BELT_Y[0], follow: 0.7 });
  belt(H, ROWS, BELT_Y[0], BELT_Y[1], A.get('belt'), BELT);
  const spine = sk.chain(['root', 'spine', 'chest'], 0.07);
  sk.part(spine, () => {
    // Koppelschloss, zwei weitere Knopfreihen unter der Brust / belt buckle, two more button rows below the chest
    const q = trunkAt(ROWS, 0, (BELT_Y[0] + BELT_Y[1]) / 2);
    b.add(sheet((u, v) => new THREE.Vector3((u - 0.5) * 0.12, BELT_Y[0] - 0.006 + v * (BELT_Y[1] - BELT_Y[0] + 0.012), q.p.z + 0.02 + 0.006 * Math.sin(Math.PI * u)),
      { nu: 6, nv: 3, region: A.get('buckle'), back: A.get('blank'), thick: 0.01, color: GOLD, backColor: GOLD_DARK, flip: true }), null, { gloss: 0.7, crease: 1 });
    for (const y of [-0.022, -0.094]) for (const x of [-0.062, 0.062]) { const s = trunkAt(ROWS, x, y); stud(b, A, s.p, s.n, 0.019, 0.008, 'button', GOLD); }
  });

  legs(H, { trouser: A.get('breeches'), color: PANTS, flare: 1 });
  boots(H, { shaft: A.get('bootShaft'), foot: A.get('bootFoot'), color: BOOT, soleColor: shade(BOOT, 0.55), gloss: 0.55, spur: GOLD });
  arms(H, { sleeve: A.get('sleeve'), cuff: A.get('cuff'), color: COAT, cuffColor: COAT });
  hands(H, { back: A.get('glove'), finger: A.get('finger'), color: GLOVE });
  sabre(H, A);
  // Kette des Umhangs: von Schulter zu Schulter unter dem Kragen / the cape's chain: shoulder to shoulder below the collar
  sk.part('chest', () => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, a = Math.PI * (0.16 + 0.68 * u), q = torsoPoint(T, a, 0.585);
      pts.push(new THREE.Vector3(q.x * 0.93, q.y - 0.035 * Math.sin(Math.PI * u) + 0.012, q.z + 0.012 + 0.012 * Math.sin(Math.PI * u)));
    }
    b.add(limb(pts, (d) => 0.0085 + 0.0025 * Math.sin(d * 150), { seg: 8, step: 0.006, region: A.get('blank'), out: new THREE.Vector3(0, 0, 1), color: GOLD, cap0: 0.006, cap1: 0.006 }), null, { gloss: 0.7, crease: 0.6 });
    for (const s of [-1, 1]) { const e = pts[s < 0 ? 12 : 0]; stud(b, A, e.clone().add(new THREE.Vector3(0, 0.004, -0.004)), new THREE.Vector3(s * 0.3, 0.2, 1).normalize(), 0.024, 0.008, 'button', GOLD); }
  });
}

/** Saebel an der linken Huefte, an zwei Riemen vom Koppel / sabre at the left hip, on two slings from the belt */
function sabre(H: Human, A: AtlasLayout): void {
  const { b, sk } = H;
  sk.part('root', () => {
    const top = new THREE.Vector3(0.455, -0.33, 0.03), tip = new THREE.Vector3(0.56, -1.3, -0.4);
    const mid = top.clone().lerp(tip, 0.5).add(new THREE.Vector3(0.012, 0, 0.03));
    const dir = tip.clone().sub(top).normalize();
    b.add(limb([top, mid, tip], (d, a) => { const t = d / top.distanceTo(tip); return (0.03 - 0.008 * t) * (0.62 + 0.38 * Math.abs(Math.sin(a))); },
      { seg: 14, step: 0.03, region: A.get('scabbard'), out: new THREE.Vector3(1, 0, 0), color: mat.dark, cap0: 0.004, cap1: 0.03 }), null, { crease: 0.7, gloss: 0.45 });
    // Griff, Buegel, Knauf / grip, guard, pommel
    const h0 = top.clone().addScaledVector(dir, -0.012), h1 = top.clone().addScaledVector(dir, -0.2).add(new THREE.Vector3(-0.012, 0.0, 0.03));
    b.add(limb([h0, h0.clone().lerp(h1, 0.5), h1], (d) => 0.019 + 0.005 * Math.sin((d / 0.19) * Math.PI), { seg: 12, step: 0.012, region: A.get('blank'), out: new THREE.Vector3(1, 0, 0), color: shade(mat.wood, 0.8), cap1: 0.01 }), null, { crease: 0.8, gloss: 0.3 });
    b.add(limb([h0, h0.clone().add(new THREE.Vector3(0.012, 0.012, 0.085)), h0.clone().lerp(h1, 0.6).add(new THREE.Vector3(0.006, 0.01, 0.085)), h1.clone().add(new THREE.Vector3(0, 0.004, 0.012))], () => 0.0085,
      { seg: 8, step: 0.012, region: A.get('blank'), out: new THREE.Vector3(1, 0, 0), color: GOLD, cap0: 0.004, cap1: 0.004 }), null, { crease: 0.8, gloss: 0.7 });
    b.add(limb([h0.clone().addScaledVector(dir, -0.006), h0.clone().addScaledVector(dir, 0.01)], () => 0.036, { seg: 12, step: 0.006, region: A.get('blank'), out: new THREE.Vector3(1, 0, 0), color: GOLD, cap0: 0.005, cap1: 0.005 }), null, { crease: 0.8, gloss: 0.7 });
    b.add(limb([h1.clone().addScaledVector(dir, 0.01), h1.clone().addScaledVector(dir, -0.024)], () => 0.027, { seg: 12, step: 0.006, region: A.get('blank'), out: new THREE.Vector3(1, 0, 0), color: GOLD, cap0: 0.012, cap1: 0.014 }), null, { crease: 0.8, gloss: 0.7 });
    // Riemen vom Koppel zu den zwei Ringen der Scheide / slings from the belt to the scabbard's two rings
    for (const [bx, bz, k] of [[0.3, 0.14, 0.05], [0.37, -0.02, 0.3]] as [number, number, number][]) {
      const a = Math.atan2(bz, bx), from = new THREE.Vector3(Math.cos(a) * 0.385, BELT_Y[0] + 0.01, Math.sin(a) * 0.23);
      const to = top.clone().lerp(tip, k);
      b.add(limb([from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0.012, -0.012, 0)), to], (_d, an) => 0.004 + 0.008 * Math.abs(Math.cos(an)), { seg: 8, step: 0.03, region: A.get('blank'), out: new THREE.Vector3(1, 0, 0.3).normalize(), color: BELT, cap0: 0.004, cap1: 0.004 }), null, { crease: 0.8, gloss: 0.3 });
    }
  });
}

// ---------- Umhang / cape ----------

const CAPE_FOLDS = 6;
/** Winkel der Umhangkanten am Ruecken (torsoPoint: PI = rechte Schulter, 2 PI = linke) / angles of the cape's edges at the back */
const CAPE_A0 = Math.PI + 0.3, CAPE_A1 = 2 * Math.PI - 0.3;
export const CAPE_Y = { top: T.h * 0.97, hem: -1.52 };
/**
 * Umhang: haengt hinter den Schultern (unter den Schulterstuecken) bis zur Wade, weitet sich nach unten, grosse
 * Falten. Ruhige Form; den Wind gibt Blender dazu (Tuchwert steigt zum Saum).
 * Cape: hangs behind the shoulders (below the epaulettes) down to the calf, widens downward, large folds. A calm
 * shape; Blender adds the wind (the cloth value rises towards the hem).
 */
function cape(H: Human, A: AtlasLayout): void {
  const { b, sk, rig } = H;
  const chest = rig.id('chest');
  const at = (u: number, v: number): THREE.Vector3 => {
    const a = CAPE_A0 + (CAPE_A1 - CAPE_A0) * u;
    const top = torsoPoint(T, a, 0.6);
    const ca = Math.cos(a), sa = Math.sin(a);
    const drop = Math.pow(v, 0.92);
    const y = CAPE_Y.top + 0.01 - (CAPE_Y.top - CAPE_Y.hem) * drop + 0.05 * (1 - Math.cos(Math.PI * (u - 0.5) * 2)) * v * 0.6;
    const spread = 0.04 + 0.27 * Math.pow(v, 1.1);
    const edge = Math.sin(Math.PI * Math.min(1, u * 1.06 + 0.03));
    const ripple = Math.sin(u * CAPE_FOLDS * 2 * Math.PI) * 0.05 * Math.pow(v, 1.25) * edge;
    const r = spread + ripple;
    const p = new THREE.Vector3(top.x + ca * r * 1.05, y, top.z + sa * r * 1.15 - 0.05 * v);
    if (v < 0.08) { const k = v / 0.08; p.lerp(top.clone().add(new THREE.Vector3(ca * 0.035, 0.012, sa * 0.035)), 1 - k); }
    return p;
  };
  sk.part((p) => [chest, 1, Math.pow(smooth(CAPE_Y.top - 0.12, CAPE_Y.hem, p.y), 1.15)], () => {
    b.add(sheet(at, { nu: 72, nv: 44, region: A.get('cape'), back: A.get('capeIn'), thick: 0.013, color: CAPE_C, backColor: LINING }), null, { crease: 0.5 });
  });
  sk.part('chest', () => {
    // Kragen: gerollter Wulst entlang der Oberkante / collar: rolled bulge along the top edge
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) { const p = at(i / 16, 0.02); pts.push(new THREE.Vector3(p.x, p.y + 0.015, p.z)); }
    b.add(limb(pts, (d, a) => { const k = Math.sin(Math.PI * Math.min(1, 0.06 + (d / 0.95) * 0.88)); return (0.027 * k + 0.008) * (1 + 0.12 * Math.cos(a)); },
      { seg: 14, step: 0.02, region: A.get('capeCollar'), out: new THREE.Vector3(0, 1, -0.4).normalize(), color: shade(CAPE_C, 0.92), cap0: 0.01, cap1: 0.01 }), null, { crease: 0.6 });
  });
}

const AO = { voxel: 0.011, reach: 0.16 };

export type FigurePart = 'body' | 'head' | 'cape';
let RIG: Rig | null = null;
/** Das Skelett der Figur (fuer alle drei Teile dasselbe) / the figure's skeleton (the same for all three pieces) */
export function korvatRig(): Rig { return (RIG ??= humanRig(P)); }

/**
 * Ein Teil der Figur nach dem Vertrag der gezeichneten Einheiten (fill + inkSrc) mit userData.figure = { rig, skin }.
 * One piece of the figure following the inked units' contract (fill + inkSrc) with userData.figure = { rig, skin }.
 */
export function buildFigure(part: FigurePart): THREE.BufferGeometry {
  const id = part === 'body' ? BODY_ATLAS : part === 'cape' ? CAPE_ATLAS : headAtlas('neutral');
  let A: AtlasLayout;
  if (part === 'head') A = defineHead('neutral');
  else {
    if (!hasAtlas(id)) defineAtlas(id, part === 'body' ? bodyCells(NEUTRAL) : capeCells(), { hero: true });
    A = atlasDef(id).layout;
  }
  const rig = korvatRig();
  const b = new UvBuilder(A.get('blank'));
  const sk = new Skinner(b, rig);
  const H: Human = { b, sk, rig, P };
  if (part === 'body') body(H, A);
  else if (part === 'head') sk.part('head', () => addKeepingFx(b, bustPart(A, ['head'])));
  else cape(H, A);
  return finish(b, sk, id, part === 'cape' ? 'chest' : part === 'head' ? 'head' : 'root', { faction: 'korvat', part, floor: FLOOR, faces: Object.keys(FACES).map(headAtlas) });
}

/** Rohgeometrie abschliessen: Verdeckung backen, fx = (Glanz, Verdeckung), Gewichte anhaengen / finish the raw geometry: bake occlusion, fx = (gloss, occlusion), attach the weights */
export function finish(b: UvBuilder, sk: Skinner, atlas: string, fallback: string, meta: Record<string, unknown>, ao = AO): THREE.BufferGeometry {
  const raw = b.build();
  const fill = new THREE.BufferGeometry();
  for (const name of Object.keys(raw.attributes)) fill.setAttribute(name, raw.getAttribute(name));
  bakeAO(fill, { voxel: ao.voxel, rays: 24, reach: ao.reach, ground: false });
  const src = raw.getAttribute('fx') as THREE.BufferAttribute, occ = fill.getAttribute('ao') as THREE.BufferAttribute;
  const fx = new Float32Array(src.count * 2);
  for (let i = 0; i < src.count; i++) { fx[i * 2] = src.getX(i); fx[i * 2 + 1] = occ.getX(i); }
  fill.setAttribute('fx', new THREE.BufferAttribute(fx, 2));
  fill.deleteAttribute('ao');
  fill.userData = { inked: { atlas, creases: true }, inkSrc: raw, finishScale: 1, figure: { rig: sk.rig, skin: sk.attribute(raw, fallback), meta } };
  fill.computeBoundingBox();
  fill.computeBoundingSphere();
  return fill;
}

/** Winziges Modell, das nur einen Atlas in den Export zieht (weitere Gesichtszeichnungen) / tiny model that only pulls an atlas into the export (further face drawings) */
export function atlasOnly(face: string): THREE.BufferGeometry {
  const A = defineHead(face);
  const b = new UvBuilder(A.get('blank'));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0]), 3));
  b.add(g, mat.dark);
  const raw = b.build();
  const fill = raw.clone();
  fill.userData = { inked: { atlas: headAtlas(face), creases: false }, inkSrc: raw, finishScale: 1 };
  return fill;
}
