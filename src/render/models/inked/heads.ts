/**
 * Gezeichnete Figur: Kopfbedeckungen und Koepfe aller Fraktionen als eigene Lofts mit Zeichnung (headPaint.ts).
 * Inked figure: headgear and heads of all factions as lofts of their own with drawing (headPaint.ts).
 *
 * Bisher kamen Paladinhelm, Barett, Visierhelm, die Huete des Spions und die Koepfe von Zyrr, Kult und NEXUS ueber die
 * Bruecke aus headgear.ts (alte Geometrie, auf den neuen Kopf verzerrt, ohne Zeichnung). Jetzt hat jede Fraktion
 * ihre eigene Form in Kopfkoordinaten (Kinn bei y = 0, Blick +z).
 * Until now the paladin helmet, beret, visor helmet, the spy's hats and the heads of Zyrr, cult and NEXUS came through
 * the bridge from headgear.ts (old geometry warped onto the new head, no drawing). Now every faction has its own shape
 * in head coordinates (chin at y = 0, facing +z).
 *
 * Groessenregel (Vorgabe: "das muss einheitlich sein"): alle Helme teilen eine Groessenklasse. Massgeblich ist der
 * Helm der Korvat (Kuppelradius 0.0525, Krempe 0.0665 bei einem Kopf von 0.043 Halbbreite); keine Kuppel ist groesser
 * als HELM.R, kein Rand weiter als HELM.rim, Hutkrempen bleiben unter HAT_BRIM. Die Figur skaliert den Kopf als Ganzes
 * (HEAD_SCALE), nie die Kopfbedeckung allein; Besatzungen nutzen dieselben Formen im Massstab CREW.
 * Size rule (owner: it has to be uniform): all helmets share one size class. The Korvat helmet sets it (dome radius
 * 0.0525, rim 0.0665 on a head of 0.043 half width); no dome is larger than HELM.R, no rim wider than HELM.rim, hat
 * brims stay below HAT_BRIM. The figure scales the head as a whole (HEAD_SCALE), never the headgear alone; crews use
 * the same shapes at the scale CREW.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { FAITH, haloRing } from '../alveniaFaith';
import { fine, geo, mix, shade, softBox, type ColorLike, type V3 } from '../kit';
import { mat, type Look } from '../look';
import { TECH } from '../velkarTech';
import { bareHead, FACE, HEAD, type Detail } from './figure';
import { bead, cell, dome, frontLoft, hasCell, plain, rod, TIP } from './figkit';
import { AtlasLayout, loft, loftAt, ribbon, UvBuilder, type Ring } from './uvkit';

/** Groessenklasse der Helme (Kopfkoordinaten) / size class of the helmets (head coordinates) */
export const HELM = { C: 0.081, R: 0.053, rim: 0.0665 };
/** groesste Hutkrempe / widest hat brim */
export const HAT_BRIM = 0.082;
/** Anteil der Helmzelle fuer die Kuppel; der Rest gehoert dem Nacken- und Wangenschutz / share of the helmet cell for the dome; the rest belongs to the neck and cheek guard */
export const DOME_T = 0.66, SKIRT_T = 0.7;
/** Sitz der Helme wie beim Korvat-Helm: leicht in den Nacken / seat of the helmets like the Korvat helmet: pushed back slightly */
const SEAT = { p: [0, 0.004, -0.004] as V3, r: [-0.1, 0, 0] as V3 };
const oval = (rings: Ring[], front = 1.07, back = 1.1): Ring[] => rings.map((r) => ({ ...r, rz: r.rx * front, rzB: r.rx * back }));

// ---------- Sonnenbrille / sunglasses ----------

/** Sonnenbrille als Auflage auf dem Gesicht (Zelle 'shades'); ohne die Zelle ein dunkles Band / sunglasses as a decal on the face (cell 'shades'); without the cell a dark band */
export function shades(b: UvBuilder, A: AtlasLayout, rings: Ring[] = HEAD, y = FACE.eye - 0.001, half = 0.118): void {
  const n = fine() ? 8 : 4;
  const path = [];
  for (let i = 0; i <= n; i++) path.push(loftAt(rings, 0.5 - half + (i / n) * 2 * half, y));
  const drawn = hasCell(A, 'shades');
  b.add(ribbon(path, 0.0105, cell(A, 'shades'), 0.0058), drawn ? mat.skin : mat.ink, { crease: 0, gloss: drawn ? 0 : 0.8 });
}

// ---------- Alvenia: Paladinhelm / paladin helmet ----------

/** Kuppel mit Goldreif (oben nach unten) / dome with the gold band (top to bottom) */
export function paladinRings(rows = 6): Ring[] {
  const { C, R } = HELM;
  return oval([
    ...dome(C, R, 90, rows, FAITH.plate),
    { y: C - 0.0005, rx: R + 0.002, hard: true, c: FAITH.gold },
    { y: C - 0.0095, rx: R + 0.0025, hard: true },
    { y: C - 0.01, rx: R - 0.004, hard: true, c: shade(FAITH.plate, 0.5) },
    { y: C - 0.004, rx: R - 0.009 },
  ]);
}
/** Wangen- und Nackenschutz: die Vorderseite bleibt im Kopf, so ist das Gesicht frei / cheek and neck guard: its front stays inside the head, so the face is open */
export function paladinSkirt(): Ring[] {
  const s = { cz: -0.011, e: 2.7 };
  return [
    { y: 0.078, rx: 0.049, rz: 0.035, rzB: 0.05, c: FAITH.plate, ...s },
    { y: 0.055, rx: 0.0505, rz: 0.0375, rzB: 0.0515, ...s },
    { y: 0.034, rx: 0.049, rz: 0.037, rzB: 0.049, hard: true, ...s },
    { y: 0.0335, rx: 0.05, rz: 0.038, rzB: 0.05, hard: true, c: FAITH.gold, ...s },
    { y: 0.026, rx: 0.0495, rz: 0.0375, rzB: 0.049, hard: true, ...s },
    { y: 0.026, rx: 0.043, rz: 0.03, rzB: 0.043, c: shade(FAITH.plate, 0.5), ...s },
  ];
}
function paladinHelmet(b: UvBuilder, A: AtlasLayout, d: Detail, seg: number): void {
  const region = cell(A, 'helmet:alvenia');
  b.group(SEAT, () => {
    b.add(loft(paladinRings(fine() ? 6 : 4), { seg, region, arc: true, t1: DOME_T }), null);
    b.add(loft(paladinSkirt(), { seg, region, t0: SKIRT_T }), null, { xf: { r: [0.14, 0, 0], p: [0, 0.002, 0.006] } });
    // Goldkamm von der Stirn in den Nacken: bricht den Umriss, also modelliert / gold crest from brow to nape: it breaks the silhouette, so it is modelled
    const { C, R } = HELM, n = fine() ? 9 : 4;
    const outer: [number, number][] = [], inner: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = -1.25 + (i / n) * 2.2, lift = 0.004 + 0.012 * Math.sin((i / n) * Math.PI);
      outer.push([Math.sin(a) * (R + lift) * 1.08, C + Math.cos(a) * (R + lift)]);
      inner.push([Math.sin(a) * (R - 0.004) * 1.08, C + Math.cos(a) * (R - 0.004)]);
    }
    b.add(plain(geo.profileZY([...outer, ...inner.reverse()], 0.011)), FAITH.gold, { gloss: 0.6 });
    // tuerkise Leuchten an den Schlaefen (Leuchtmaske aus der Vertexfarbe) / teal lights at the temples (glow mask from the vertex colour)
    if (d >= 1) for (const s of [-1, 1]) bead(b, A, [s * 0.0535, 0.072, 0.002], 0.0062, FAITH.tech, 6, { gloss: 1 });
  });
  // schwebender Sonnenkranz: duenner Ring ueber dem Kamm (Kleinteil, ueber die Bruecke) / floating sun halo: thin ring above the crest (small part, through the bridge)
  b.legacy((k) => haloRing(k, [0, 0.1655, -0.014], 0.04, 0.0032, d === 2 ? 18 : 10, -0.12));
}

// ---------- Velkar: Visierhelm / visor helmet ----------

export function techHelmRings(rows = 6): Ring[] {
  const { C, R } = HELM;
  return oval([
    ...dome(C, R, 90, rows, TECH.shell),
    { y: C - 0.0005, rx: R + 0.002, hard: true, c: TECH.gear },
    { y: C - 0.0105, rx: R + 0.003, hard: true },
    { y: C - 0.011, rx: R - 0.004, hard: true, c: shade(TECH.gear, 0.5) },
    { y: C - 0.004, rx: R - 0.009 },
  ]);
}
/** Ohrschalen und Nackenschale / ear cups and neck shell */
export function techHelmSkirt(): Ring[] {
  const s = { cz: -0.013, e: 2.6 };
  return [
    { y: 0.078, rx: 0.049, rz: 0.03, rzB: 0.049, c: TECH.shell, ...s },
    { y: 0.058, rx: 0.051, rz: 0.032, rzB: 0.05, ...s },
    { y: 0.04, rx: 0.0495, rz: 0.031, rzB: 0.048, hard: true, ...s },
    { y: 0.0395, rx: 0.0505, rz: 0.032, rzB: 0.049, hard: true, c: TECH.gear, ...s },
    { y: 0.032, rx: 0.05, rz: 0.0315, rzB: 0.048, hard: true, ...s },
    { y: 0.032, rx: 0.043, rz: 0.026, rzB: 0.042, c: shade(TECH.gear, 0.5), ...s },
  ];
}
/** Visier vor den Augen mit Leuchtlinse: Schale, deren Rueckseite im Kopf liegt / visor in front of the eyes with a glowing lens: a shell whose back lies inside the head */
function techVisor(): Ring[] {
  const s = { cz: 0.013, rzB: 0.018, e: 2.4 };
  return [
    { y: 0.079, rx: 0.044, rz: 0.038, c: mat.glassDark, ...s },
    { y: 0.074, rx: 0.0475, rz: 0.0425, ...s },
    { y: 0.066, rx: 0.0482, rz: 0.0432, hard: true, ...s },
    { y: 0.0655, rx: 0.049, rz: 0.044, hard: true, c: TECH.glow, ...s },
    { y: 0.0575, rx: 0.049, rz: 0.044, hard: true, ...s },
    { y: 0.057, rx: 0.0482, rz: 0.0432, hard: true, c: mat.glassDark, ...s },
    { y: 0.047, rx: 0.0465, rz: 0.0415, hard: true, ...s },
    { y: 0.047, rx: 0.04, rz: 0.035, ...s },
  ];
}
function techHelmet(b: UvBuilder, A: AtlasLayout, L: Look, d: Detail, seg: number): void {
  const region = cell(A, 'helmet:velkar');
  b.group(SEAT, () => {
    b.add(loft(techHelmRings(fine() ? 6 : 4), { seg, region, arc: true, t1: DOME_T }), null);
    b.add(loft(techHelmSkirt(), { seg, region, t0: SKIRT_T }), null, { xf: { r: [0.1, 0, 0], p: [0, 0.001, 0.004] } });
    // niedriger Kamm / low crest
    const { C, R } = HELM, n = fine() ? 7 : 3;
    const outer: [number, number][] = [], inner: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = -1.1 + (i / n) * 1.7, lift = 0.003 + 0.007 * Math.sin((i / n) * Math.PI);
      outer.push([Math.sin(a) * (R + lift) * 1.08, C + Math.cos(a) * (R + lift)]);
      inner.push([Math.sin(a) * (R - 0.004) * 1.08, C + Math.cos(a) * (R - 0.004)]);
    }
    b.add(plain(geo.profileZY([...outer, ...inner.reverse()], 0.016)), TECH.gear, {});
    // Antenne links mit Leuchtspitze, Sensorleuchte rechts / antenna left with a glowing tip, sensor lamp right
    rod(b, A, [-0.05, 0.088, -0.026], [-0.056, 0.158, -0.04], 0.0034, 0.002, 5, mat.dark);
    bead(b, A, [-0.0563, 0.162, -0.0408], 0.0068, TECH.glow, 6, { gloss: 1 });
    if (d >= 1) {
      rod(b, A, [0.052, 0.086, 0.0], [0.052, 0.086, 0.03], 0.009, 0.0078, fine() ? 8 : 6, mat.dark, { gloss: 0.4, crease: 0.6 });
      bead(b, A, [0.052, 0.086, 0.0305], 0.0062, TECH.glow, 6, { gloss: 1 }, [1, 1, 0.5]);
    }
  });
  b.add(frontLoft(techVisor(), { seg, region: cell(A, 'visor') }), null, { gloss: 0.9, xf: { r: [-0.04, 0, 0] } });
  void L;
}

// ---------- Meridon: Barett / beret ----------

export function beretRings(L: Look): Ring[] {
  return oval([
    { y: 0.03, rx: TIP, c: L.helmet },
    { y: 0.0288, rx: 0.02 }, { y: 0.0245, rx: 0.042 }, { y: 0.0155, rx: 0.058 }, { y: 0.0065, rx: 0.0625 }, { y: -0.0015, rx: 0.058 },
    { y: -0.007, rx: 0.0492, hard: true },
    { y: -0.0075, rx: 0.0478, hard: true, c: shade(L.primary, 0.7) },
    { y: -0.0195, rx: 0.0462, hard: true },
    { y: -0.0195, rx: 0.039, c: shade(L.primary, 0.4) },
  ], 1.08, 1.1);
}
function beret(b: UvBuilder, A: AtlasLayout, L: Look, d: Detail, seg: number): void {
  b.add(loft(beretRings(L), { seg, region: cell(A, 'beret:meridon'), arc: true }), null, { xf: { p: [0.007, 0.0955, -0.004], r: [0.05, 0, -0.24] }, crease: 0.7 });
  // Stiel / stalk
  if (d >= 1) rod(b, A, [0.0145, 0.123, -0.004], [0.017, 0.131, -0.004], 0.004, 0.003, 5, shade(L.helmet, 0.7));
  // Kopfhoerer rechts mit Mikrofonarm / headset on the right with a mic boom
  rod(b, A, [0.039, 0.046, -0.004], [0.0525, 0.046, -0.004], 0.0165, 0.0155, fine() ? 10 : 6, mat.dark, { crease: 0.7 });
  bead(b, A, [0.0535, 0.046, -0.004], 0.009, L.secondary, 6, {}, [0.4, 1, 1]);
  if (d >= 1) {
    rod(b, A, [0.05, 0.036, 0.006], [0.031, 0.02, 0.05], 0.0024, 0.0024, 4, mat.dark);
    bead(b, A, [0.03, 0.0195, 0.0515], 0.0052, mat.ink, 5);
  }
}

// ---------- Huete des Spions / the spy's hats ----------

export interface HatSpec {
  /** Hoehe der Krempe in Kopfkoordinaten / height of the brim in head coordinates */
  y: number;
  crownR: number; topR: number; h: number; brimR: number;
  /** Krempe haengt um diesen Betrag / the brim droops by this much */
  droop?: number;
  crown: ColorLike; band: ColorLike; brim?: ColorLike;
  /** runde Kuppe statt Kniff (Pelzhut) / round crown instead of a pinch (fur hat) */
  round?: boolean;
  tilt?: V3;
  /** Bommel in dieser Farbe / bobble in this colour */
  bobble?: ColorLike;
}
/** Anteil des Hutbandes an der Kronenhoehe (fest, damit die Zeichnung passt) / share of the band in the crown height (fixed so the drawing fits) */
export const HAT_BAND = 0.27;
export function hatCrown(o: HatSpec): Ring[] {
  const { y, h, crownR: r, topR } = o;
  const top: Ring[] = o.round
    ? [{ y: y + h, rx: TIP, c: o.crown }, { y: y + h * 0.94, rx: topR * 0.55 }, { y: y + h * 0.74, rx: topR }, { y: y + h * 0.5, rx: r * 1.02 }]
    : [{ y: y + h, rx: topR * 0.5, c: o.crown }, { y: y + h, rx: topR * 0.86, hard: true }, { y: y + h * 0.9, rx: topR, hard: true }, { y: y + h * 0.55, rx: (topR + r) / 2 }];
  return oval([
    ...top,
    { y: y + h * HAT_BAND, rx: r, hard: true },
    { y: y + h * HAT_BAND - 0.0004, rx: r + 0.0012, hard: true, c: o.band },
    { y: y + 0.001, rx: r + 0.0012, hard: true },
  ], 1.06, 1.08);
}
export function hatBrim(o: HatSpec): Ring[] {
  const { y, crownR: r, brimR } = o, drop = o.droop ?? 0.004, c = o.brim ?? o.crown;
  if (brimR > HAT_BRIM + 1e-9) throw new Error('hat brim above the size class');
  return oval([
    { y: y + 0.0015, rx: r, c },
    { y: y, rx: r + (brimR - r) * 0.5 },
    { y: y - drop, rx: brimR, hard: true },
    { y: y - drop - 0.0035, rx: brimR - 0.001, hard: true, c: shade(c, 0.55) },
    { y: y - 0.004, rx: r - 0.002 },
  ], 1.06, 1.08);
}
export function brimHat(b: UvBuilder, A: AtlasLayout, o: HatSpec, seg: number): void {
  b.group({ r: o.tilt ?? [0, 0, 0] }, () => {
    b.add(loft(hatCrown(o), { seg, region: cell(A, 'hatCrown'), capFirst: !o.round }), null, { crease: 0.8 });
    b.add(loft(hatBrim(o), { seg, region: cell(A, 'hatBrim'), arc: true }), null, { crease: 0.8 });
    if (o.bobble) bead(b, A, [0, o.y + o.h + 0.006, 0], 0.0115, o.bobble, fine() ? 8 : 6);
  });
}
/** Hut des Spions je Fraktion / the spy's hat per faction */
export function spyHat(f: FactionId, L: Look): HatSpec {
  const base = { y: 0.083, crownR: 0.046, topR: 0.037, h: 0.044, brimR: 0.076 };
  switch (f) {
    case 'korvat': return { ...base, brimR: 0.079, droop: 0.007, crown: L.secondary, band: L.primary, tilt: [0.07, 0, 0] };
    case 'dravon': return { ...base, crown: shade(L.helmet, 1.5), band: L.secondary, tilt: [0.05, 0, 0.04] };
    case 'alvenia': return { ...base, brimR: HAT_BRIM, topR: 0.041, h: 0.04, droop: 0.002, crown: shade(L.primary, 0.85), band: L.secondary };
    case 'meridon': return { ...base, brimR: HAT_BRIM, topR: 0.045, h: 0.026, droop: 0.001, crown: mix(L.secondary, mat.sand, 0.45), band: L.primary };
    case 'velkar': return { ...base, y: 0.08, crownR: 0.05, topR: 0.046, h: 0.046, brimR: 0.072, droop: 0.006, crown: L.primary, band: L.secondary, brim: shade(L.primary, 0.6), round: true, bobble: mat.snow };
    case 'zyrr': return { ...base, y: 0.112, crownR: 0.04, topR: 0.032, h: 0.036, brimR: 0.074, crown: L.primary, band: L.secondary };
    case 'vesper': return { ...base, y: 0.116, crownR: 0.04, topR: 0.034, h: 0.034, brimR: 0.076, droop: 0.006, crown: L.helmet, band: L.primary };
    case 'nexus': return { ...base, y: 0.112, crownR: 0.04, topR: 0.036, h: 0.032, brimR: 0.07, droop: 0.001, crown: mat.gunmetal, band: mat.cyanGlow };
  }
}

// ---------- Zyrr: Kopf des Grauen / the grey's head ----------

export const GREY_HEAD: Ring[] = [
  { y: 0.128, rx: TIP },
  { y: 0.1245, rx: 0.02, rzB: 0.022 },
  { y: 0.113, rx: 0.04, rz: 0.039, rzB: 0.044 },
  { y: 0.095, rx: 0.053, rz: 0.05, rzB: 0.057 },
  { y: 0.075, rx: 0.0575, rz: 0.053, rzB: 0.059 },
  { y: 0.056, rx: 0.053, rz: 0.0505, rzB: 0.052 },
  { y: 0.039, rx: 0.042, rz: 0.046, rzB: 0.04, e: 2.2 },
  { y: 0.024, rx: 0.03, rz: 0.04, rzB: 0.03, e: 2.3 },
  { y: 0.011, rx: 0.021, rz: 0.032, rzB: 0.022, e: 2.3, cz: 0.001 },
  { y: 0.003, rx: 0.014, rz: 0.022, rzB: 0.014, cz: 0.002 },
  { y: 0, rx: TIP, cz: 0.005 },
];
/** Hoehe und Lage der Mandelaugen / height and position of the almond eyes */
export const GREY_FACE = { eye: 0.064, eyeS: 0.078, nose: 0.033, mouth: 0.017 };
export function greyHead(b: UvBuilder, A: AtlasLayout, L: Look, d: Detail, seg: number, antenna = true): void {
  const drawn = hasCell(A, 'head:zyrr');
  b.add(loft(GREY_HEAD, { seg, region: cell(A, 'head:zyrr'), color: mat.alienSkin }), null, { crease: 0 });
  if (!drawn) {
    // ohne Zeichnung (fremder Atlas): Augen als dunkle Linsen / without drawing (foreign atlas): eyes as dark lenses
    for (const s of [-1, 1]) {
      const q = loftAt(GREY_HEAD, 0.5 + s * GREY_FACE.eyeS, GREY_FACE.eye);
      bead(b, A, [q.p.x, q.p.y, q.p.z - 0.004], 0.014, mat.ink, 6, { gloss: 1 }, [1.2, 0.62, 0.5]);
    }
  }
  if (antenna && d >= 1) {
    rod(b, A, [0.016, 0.122, -0.012], [0.03, 0.158, -0.02], 0.003, 0.002, 4, mat.alienSkinDark);
    bead(b, A, [0.0308, 0.1615, -0.0205], 0.0066, mat.acid, 5, { gloss: 1 });
  }
  void L;
}

// ---------- Vesper: Kapuze mit Knochenmaske / hood with bone mask ----------

export function hoodRings(L: Look): Ring[] {
  const robe = L.helmet;
  return [
    { y: 0.134, rx: TIP, cz: -0.038, c: robe },
    { y: 0.129, rx: 0.015, cz: -0.031 },
    { y: 0.116, rx: 0.036, rzB: 0.04, cz: -0.017 },
    { y: 0.099, rx: 0.051, rz: 0.05, rzB: 0.056, cz: -0.006, hard: true },
    { y: 0.0985, rx: 0.0527, rz: 0.0517, rzB: 0.0577, cz: -0.006, hard: true, c: L.primary },
    { y: 0.085, rx: 0.0562, rz: 0.0547, rzB: 0.0607, cz: -0.004, hard: true },
    { y: 0.0845, rx: 0.0545, rz: 0.053, rzB: 0.059, cz: -0.004, hard: true, c: robe },
    { y: 0.062, rx: 0.057, rz: 0.055, rzB: 0.06, cz: -0.002 },
    { y: 0.038, rx: 0.0555, rz: 0.053, rzB: 0.056 },
    { y: 0.014, rx: 0.051, rz: 0.048, rzB: 0.05 },
    { y: -0.004, rx: 0.048, rz: 0.044, rzB: 0.047, hard: true },
    { y: -0.004, rx: 0.036, rz: 0.034, rzB: 0.036, c: shade(robe, 0.5) },
  ];
}
export function maskRings(): Ring[] {
  const s = { cz: 0.021, rzB: 0.012, e: 2.5 };
  return [
    { y: 0.094, rx: TIP, cz: 0.03, c: mat.bone },
    { y: 0.09, rx: 0.026, rz: 0.035, ...s },
    { y: 0.072, rx: 0.034, rz: 0.0405, ...s },
    { y: 0.05, rx: 0.033, rz: 0.041, ...s },
    { y: 0.03, rx: 0.027, rz: 0.039, ...s },
    { y: 0.014, rx: 0.018, rz: 0.034, ...s },
    { y: 0.007, rx: TIP, cz: 0.036 },
  ];
}
export function cultHead(b: UvBuilder, A: AtlasLayout, L: Look, d: Detail, seg: number): void {
  b.add(loft(hoodRings(L), { seg, region: cell(A, 'hood:vesper') }), null, { crease: 0.6 });
  const drawn = hasCell(A, 'mask:vesper');
  b.add(frontLoft(maskRings(), { seg: Math.max(8, seg - 4), region: cell(A, 'mask:vesper') }), null, { crease: 0 });
  if (!drawn) for (const s of [-1, 1]) bead(b, A, [s * 0.015, 0.064, 0.0595], 0.007, mat.ember, 5, {}, [1.5, 0.5, 0.4]);
  void d;
}

// ---------- NEXUS: Roboterkopf / robot head ----------

export function robotRings(L: Look): Ring[] {
  const plate = L.helmet, metal = mat.gunmetal;
  return [
    { y: 0.114, rx: TIP, c: plate },
    { y: 0.113, rx: 0.03, e: 3 },
    { y: 0.106, rx: 0.0445, rzB: 0.046, e: 3.6, hard: true },
    { y: 0.086, rx: 0.0465, rzB: 0.048, e: 3.8, hard: true },
    { y: 0.0855, rx: 0.048, rzB: 0.049, e: 3.8, hard: true, c: metal },
    { y: 0.062, rx: 0.048, rzB: 0.049, e: 3.8, hard: true },
    { y: 0.0615, rx: 0.0465, rzB: 0.048, e: 3.8, hard: true, c: plate },
    { y: 0.031, rx: 0.0455, rzB: 0.047, e: 3.6, hard: true },
    { y: 0.0305, rx: 0.039, rz: 0.041, rzB: 0.036, e: 3.2, hard: true, c: metal },
    { y: 0.007, rx: 0.033, rz: 0.036, rzB: 0.03, e: 3 },
    { y: 0, rx: TIP },
  ];
}
export function robotHead(b: UvBuilder, A: AtlasLayout, L: Look, d: Detail, seg: number, antenna = true): void {
  const drawn = hasCell(A, 'head:nexus');
  b.add(loft(robotRings(L), { seg, region: cell(A, 'head:nexus') }), null, { gloss: 0.3 });
  // ohne Zeichnung: Leuchtstreifen als Teil / without drawing: light strip as a part
  if (!drawn) b.add(loft([{ y: 0.078, rx: 0.049, rz: 0.049, rzB: 0.01, e: 3.8 }, { y: 0.069, rx: 0.049, rz: 0.049, rzB: 0.01, e: 3.8 }], { seg, region: A.get('blank'), color: mat.cyanGlow }), null, { crease: 0, gloss: 1 });
  // Ohrscheiben / ear discs
  for (const s of [-1, 1]) {
    rod(b, A, [s * 0.044, 0.056, -0.002], [s * 0.054, 0.056, -0.002], 0.0155, 0.0145, fine() && d >= 1 ? 10 : 6, mat.gunmetal, { crease: 0.7, gloss: 0.4 });
    if (d >= 1) bead(b, A, [s * 0.0545, 0.056, -0.002], 0.0075, mat.cyanGlow, 6, { gloss: 1 }, [0.4, 1, 1]);
  }
  if (antenna) {
    rod(b, A, [0.026, 0.108, -0.026], [0.033, 0.158, -0.036], 0.003, 0.002, 4, mat.gunmetal);
    bead(b, A, [0.0334, 0.1612, -0.0366], 0.006, mat.cyanGlow, 5, { gloss: 1 });
  }
}

// ---------- Kapuze und Gefechtshelm fuer Sonderfiguren / hood and combat helmet for special figures ----------

/** Offene Kapuze ueber dem Kopf in der Farbe c: oben geschlossen, vorn bleibt das Gesicht frei / open hood over the head in the colour c: closed on top, the face stays open in front */
export function hood(b: UvBuilder, A: AtlasLayout, c: ColorLike, seg: number): void {
  const s = { cz: -0.004 };
  b.add(loft([
    { y: 0.123, rx: TIP, cz: -0.012, c }, { y: 0.119, rx: 0.022, ...s }, { y: 0.107, rx: 0.043, rzB: 0.05, ...s }, { y: 0.091, rx: 0.052, rz: 0.05, rzB: 0.058, ...s },
    { y: 0.078, rx: 0.054, rz: 0.05, rzB: 0.06, hard: true, ...s }, { y: 0.07, rx: 0.054, rz: 0.028, rzB: 0.06, ...s }, { y: 0.04, rx: 0.053, rz: 0.02, rzB: 0.058, ...s },
    { y: 0.01, rx: 0.05, rz: 0.016, rzB: 0.054, ...s }, { y: -0.006, rx: 0.046, rz: 0.014, rzB: 0.05, hard: true, ...s }, { y: -0.006, rx: 0.03, rz: 0.008, rzB: 0.03, c: shade(c, 0.5), ...s },
  ], { seg, region: cell(A, 'cloth') }), null, { crease: 0.7 });
}
/** Gefechtshelm: flache Kuppel in der Farbe c mit Nackenschutz und Brille auf der Stirn / combat helmet: flat dome in the colour c with a neck guard and goggles on the brow */
export function combatHelmet(b: UvBuilder, A: AtlasLayout, c: ColorLike, strap: ColorLike, d: Detail, seg: number): void {
  const { C, R } = HELM, rim = shade(c, 0.8);
  b.group(SEAT, () => {
    b.add(loft(oval([
      ...dome(C, R, 90, 6, c),
      { y: C - 0.0005, rx: R + 0.001, hard: true, c: rim }, { y: C - 0.009, rx: R + 0.002, hard: true }, { y: C - 0.0095, rx: R - 0.004, hard: true, c: shade(c, 0.45) }, { y: C - 0.004, rx: R - 0.009 },
    ]), { seg, region: A.get('blank') }), null);
    // Nackenschutz / neck guard
    const k = { cz: -0.013, e: 2.6 };
    b.add(loft([
      { y: 0.078, rx: 0.049, rz: 0.028, rzB: 0.05, c: rim, ...k }, { y: 0.062, rx: 0.0505, rz: 0.03, rzB: 0.052, ...k },
      { y: 0.05, rx: 0.05, rz: 0.029, rzB: 0.051, hard: true, ...k }, { y: 0.05, rx: 0.043, rz: 0.024, rzB: 0.044, c: shade(c, 0.45), ...k },
    ], { seg, region: A.get('blank') }), null, { xf: { r: [0.1, 0, 0], p: [0, 0.001, 0.004] } });
    // Brille auf der Stirn: dunkles Band mit Glas / goggles on the brow: dark band with glass
    const g = { cz: 0.012, rzB: 0.016, e: 2.4 };
    b.add(frontLoft([
      { y: 0.111, rx: 0.036, rz: 0.034, c: mat.dark, ...g }, { y: 0.108, rx: 0.042, rz: 0.04, hard: true, ...g }, { y: 0.1075, rx: 0.043, rz: 0.0412, hard: true, c: mat.glassDark, ...g },
      { y: 0.094, rx: 0.047, rz: 0.0445, hard: true, ...g }, { y: 0.0935, rx: 0.0465, rz: 0.044, hard: true, c: mat.dark, ...g }, { y: 0.09, rx: 0.044, rz: 0.04, ...g },
    ], { seg, region: cell(A, 'visor') }), null, { gloss: 0.9 });
    for (const s of [-1, 1]) b.add(softBox(0.007, 0.015, 0.05, 0.002), strap, { xf: { p: [s * 0.0545, 0.088, -0.002] }, crease: 0.6 });
    // Markierung oben / marker on top
    if (d >= 1) b.add(softBox(0.014, 0.008, 0.02, 0.002), mat.yellow, { xf: { p: [0, C + R + 0.002, -0.016], r: [0.2, 0, 0] } });
  });
}

// ---------- Auswahl je Fraktion / selection per faction ----------

/**
 * Kopf samt Kopfbedeckung der Fraktion (Kopfkoordinaten). Korvat und Dravon bleiben wie bisher (figure.ts), alle
 * anderen bauen hier ihre eigene Form.
 * Head with the faction's headgear (head coordinates). Korvat and Dravon stay as before (figure.ts), all others build
 * their own shape here.
 */
export function nativeHead(b: UvBuilder, A: AtlasLayout, f: FactionId, L: Look, d: Detail, seg: number, fedora: boolean): void {
  if (fedora) {
    if (f === 'zyrr') { greyHead(b, A, L, d, seg, false); shades(b, A, GREY_HEAD, GREY_FACE.eye, 0.15); }
    else if (f === 'vesper') cultHead(b, A, L, d, seg);
    else if (f === 'nexus') robotHead(b, A, L, d, seg, false);
    else { bareHead(b, A, seg); shades(b, A); }
    brimHat(b, A, spyHat(f, L), seg);
    return;
  }
  switch (f) {
    case 'alvenia': bareHead(b, A, seg); paladinHelmet(b, A, d, seg); break;
    case 'velkar': bareHead(b, A, seg); techHelmet(b, A, L, d, seg); break;
    case 'meridon': bareHead(b, A, seg); shades(b, A); beret(b, A, L, d, seg); break;
    case 'zyrr': greyHead(b, A, L, d, seg); break;
    case 'vesper': cultHead(b, A, L, d, seg); break;
    case 'nexus': robotHead(b, A, L, d, seg); break;
    default: bareHead(b, A, seg);
  }
}

/** Hautfarbe von Hals und Haenden je Fraktion / skin colour of neck and hands per faction */
export function skinOf(f: FactionId | null): THREE.Color {
  if (f === 'zyrr') return mat.alienSkin;
  if (f === 'nexus') return mat.gunmetal;
  return mat.skin;
}
