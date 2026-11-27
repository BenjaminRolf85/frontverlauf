/**
 * Gezeichneter Anfuehrer des Nexus: der Kernrechner.
 * Inked leader of the Nexus: the core intelligence.
 *
 * Vorlage ist das Portraet des Spiels (public/leaders/img/nexus_neutral.webp): kastenfoermiger weisser Roboterkopf mit
 * abgerundeten Kanten, vorn ein dunkler Bildschirm mit zwei leuchtenden quadratischen Augen und einem Strich als Mund,
 * darueber drei sechseckige Leuchten, zwei Antennen mit leuchtenden Kugeln, seitlich Hoerkapseln mit Leuchtschlitz.
 * Hals aus Kanonenmetall mit Leuchtring, weisse Panzerplatten an Schultern und Brust, in der Brust ein sechseckiger
 * Kern. Die Stimmung zeigt der Bildschirm: Augen und Mund sind eigene leuchtende Platten, je Stimmung anders geformt.
 * The model is the game's portrait (public/leaders/img/nexus_neutral.webp): a boxy white robot head with rounded edges,
 * in front a dark screen with two glowing square eyes and a stroke for a mouth, above it three hexagonal lamps, two
 * antennae with glowing balls, ear pods with a light slot at the sides. A gunmetal neck with a light ring, white armour
 * plates on shoulders and chest, a hexagonal core in the chest. The screen shows the mood: eyes and mouth are glowing
 * plates of their own, shaped differently per mood.
 */
import * as THREE from 'three';
import { fine, mix, shade, type V3 } from '../kit';
import { mat } from '../look';
import { arc, spline, type Cell, type Pen, type Pt } from './atlas';
import { paintEmblem } from './emblem';
import { aimZ } from './figkit';
import { chestAt, chestMap, gemDome, mirrorS, ngon, polyPlate, revolve, stud, torsoGeometry, torsoShell, tube, type TorsoSpec } from './leaderKit';
import type { LeaderDef } from './leaders';
import { bodyCells, lineScale, type MoodArt } from './leaderPaint';
import { loft, type AtlasLayout, type UvBuilder } from './uvkit';

const PLATE = mix(mat.plate, mat.white, 0.35);
const PLATE_DARK = shade(PLATE, 0.72);
const GUN = mat.gunmetal;
const GUN_DARK = mix(mat.gunmetal, mat.ink, 0.45);
const SCREEN = mix(mat.ink, mat.window, 0.3);
/** Leuchtfarbe (Augen, Lampen, Schlitze, Kern) / glow colour (eyes, lamps, slots, core) */
const CYAN = mat.cyanGlow;

const T: TorsoSpec = { w: 0.44, d: 0.2, h: 0.33, slope: 0.07, neckR: 0.11, rise: 0.04, square: 0.42, z: -0.01, chest: 0.01 };
/** Kopf: Kasten mit runden Kanten / head: box with rounded edges */
const HEAD = { y0: 0.5, y1: 0.852, rx: 0.22, rz: 0.162, cz: 0.0 };
const HEAD_RINGS = [
  { y: HEAD.y0, rx: 0.17, rz: 0.12, e: 6 }, { y: HEAD.y0 + 0.015, rx: 0.205, rz: 0.15, e: 7 }, { y: HEAD.y0 + 0.045, rx: HEAD.rx, rz: HEAD.rz, e: 7 },
  { y: HEAD.y1 - 0.052, rx: HEAD.rx, rz: HEAD.rz, e: 7 }, { y: HEAD.y1 - 0.017, rx: 0.205, rz: 0.15, e: 7 }, { y: HEAD.y1, rx: 0.17, rz: 0.12, e: 6 },
];
/** Bildschirm: Mitte, halbe Breite, halbe Hoehe; Vorderkante z / screen: centre, half width, half height; front edge z */
const SCR = { y: 0.672, hw: 0.168, hh: 0.098, z: HEAD.cz + HEAD.rz + 0.004 };
const CORE: [number, number] = [0, 0.19];

/** Abgerundetes Rechteck als Umriss / rounded rectangle as an outline */
function roundRect(hw: number, hh: number, r: number, n = 4): [number, number][] {
  const out: [number, number][] = [];
  for (const [cx, cy, a0] of [[hw - r, hh - r, 0], [-hw + r, hh - r, Math.PI / 2], [-hw + r, -hh + r, Math.PI], [hw - r, -hh + r, Math.PI * 1.5]] as [number, number, number][]) {
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  }
  return out;
}
const rect = (x: number, y: number, hw: number, hh: number, rot = 0): [number, number][] =>
  [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([a, b]): [number, number] => [x + a * Math.cos(rot) - b * Math.sin(rot), y + a * Math.sin(rot) + b * Math.cos(rot)]);

/**
 * Gesicht auf dem Bildschirm je Stimmung: Umrisse in Bildschirmkoordinaten (Mitte des Bildschirms = 0, Modelleinheiten).
 * Face on the screen per mood: outlines in screen coordinates (centre of the screen = 0, model units).
 */
function screenFace(m: MoodArt): [number, number][][] {
  const out: [number, number][][] = [];
  const ex = 0.074, ey = 0.014;
  for (const s of [-1, 1] as const) {
    const h = m.id === 'shocked' ? 0.036 : 0.029;
    if (m.id === 'angry') {
      // innere obere Ecke tiefer: zornig / inner upper corner lower: angry
      out.push([[s * (ex - h), ey - h], [s * (ex + h), ey - h], [s * (ex + h), ey + h], [s * (ex - h), ey + h - 0.024]]);
    } else if (m.id === 'smug' && s !== m.side) {
      // halb geschlossenes Auge / half-closed eye
      out.push(rect(s * ex, ey - h * 0.5, h, h * 0.5));
    } else out.push(rect(s * ex, ey + (m.id === 'smug' ? 0.004 : 0), h, h));
  }
  if (m.id === 'shocked') {
    // offener Mund: Rechteck aus vier Stegen / open mouth: rectangle of four bars
    const mx = 0.034, my = -0.052, hy = 0.024, t = 0.006;
    out.push(rect(0, my + hy, mx, t), rect(0, my - hy, mx, t), rect(-mx + t, my, t, hy), rect(mx - t, my, t, hy));
  } else if (m.id === 'angry') {
    out.push(rect(-0.032, -0.056, 0.036, 0.0065, 0.2), rect(0.032, -0.056, 0.036, 0.0065, -0.2));
  } else if (m.id === 'smug') {
    out.push(rect(0.008 * m.side, -0.054, 0.06, 0.0065, 0.14 * m.side));
  } else out.push(rect(0, -0.056, 0.064, 0.0065));
  return out;
}

// ---------- Aufbau / build ----------

function build(b: UvBuilder, A: AtlasLayout, m: MoodArt): void {
  b.add(torsoGeometry(T, { chest: A.get('chest'), back: A.get('back'), side: A.get('side'), top: A.get('top'), blank: A.get('blank') }, PLATE), null, { gloss: 0.35, crease: 0.6 });
  // Hals aus Kanonenmetall, Leuchtring, Kragenring / gunmetal neck, light ring, collar ring
  b.add(loft([{ y: HEAD.y0 + 0.02, rx: 0.075, c: GUN }, { y: 0.46, rx: 0.08, hard: true }, { y: 0.44, rx: 0.088, hard: true }, { y: 0.38, rx: 0.09 }, { y: 0.32, rx: 0.1 }], { seg: fine() ? 32 : 16, region: A.get('neck') }), null, { gloss: 0.4, crease: 0.8 });
  {
    const ring: V3[] = [];
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; ring.push([Math.sin(a) * 0.086, 0.45, Math.cos(a) * 0.086]); }
    b.add(tube(ring, () => 0.008, { seg: 6, samples: fine() ? 48 : 24, region: A.get('blank'), color: CYAN }), null, { crease: 0.2 });
  }
  const CO = { centre: [0, -0.004] as [number, number], front: 1.0 };
  b.add(revolve([[0.155, 0.33], [0.14, 0.37], [0.125, 0.4], [0.112, 0.4]], { ...CO, seg: fine() ? 48 : 24, sub: 2, region: A.get('collar'), mirror: true, color: GUN }), null, { gloss: 0.4, crease: 0.9 });

  // Kopf: Kasten mit runden Kanten, Deckel oben / head: box with rounded edges, lid on top
  const seg = fine() ? 64 : 32;
  b.add(mirrorS(loft(HEAD_RINGS.map((r) => ({ ...r, cz: HEAD.cz, c: PLATE })), { seg, region: A.get('head'), capFirst: true, capLast: A.get('headTop') }), A.get('head')), null, { gloss: 0.45, crease: 0.9 });
  // Bildschirm und Gesicht / screen and face
  b.group({ p: [0, SCR.y, SCR.z - 0.022] }, () => {
    b.add(polyPlate(roundRect(SCR.hw, SCR.hh, 0.03), 0.022, A.get('screen'), SCREEN, GUN_DARK), null, { gloss: 0.9, crease: 1 });
    for (const o of screenFace(m)) b.add(polyPlate(o, 0.026, A.get('pixel'), CYAN), null, { gloss: 0.2, crease: 1 });
  });
  // drei sechseckige Leuchten ueber dem Bildschirm / three hexagonal lamps above the screen
  for (const x of [-0.078, 0, 0.078]) {
    b.group({ p: [x, 0.81, HEAD.cz + HEAD.rz - 0.012] }, () => {
      b.add(polyPlate(ngon(6, 0.027, Math.PI / 2), 0.016, A.get('hex'), mix(PLATE, GUN, 0.35)), null, { gloss: 0.5, crease: 1 });
      b.add(polyPlate(ngon(6, 0.018, Math.PI / 2), 0.022, A.get('pixel'), CYAN), null, { gloss: 0.6, crease: 1 });
    });
  }
  // Hoerkapseln mit Leuchtschlitz / ear pods with a light slot
  b.mirrorX(() => {
    const at = new THREE.Vector3(HEAD.rx - 0.012, 0.675, HEAD.cz - 0.005), n = new THREE.Vector3(1, 0, 0);
    stud(b, A, at, n, 0.072, 0.03, 'earpod', mix(PLATE, GUN, 0.2), 0.5, 22);
    b.group({ p: [at.x + 0.044, at.y, at.z], r: aimZ([1, 0, 0]) }, () => b.add(polyPlate(rect(0, 0, 0.011, 0.04), 0.006, A.get('pixel'), CYAN), null, { crease: 1 }));
    // Antenne: Sockel, Stab, leuchtende Kugel / antenna: socket, rod, glowing ball
    const base = new THREE.Vector3(0.13, HEAD.y1 - 0.006, HEAD.cz - 0.02), tip = new THREE.Vector3(0.205, 1.0, HEAD.cz - 0.035);
    stud(b, A, base, new THREE.Vector3(0.25, 1, 0).normalize(), 0.026, 0.022, 'hexSmall', GUN, 0.5, 14);
    b.add(tube([[base.x, base.y, base.z], [(base.x + tip.x) / 2 + 0.004, (base.y + tip.y) / 2, (base.z + tip.z) / 2], [tip.x, tip.y, tip.z]], (t) => 0.009 - 0.003 * t, { seg: 8, samples: fine() ? 8 : 4, region: A.get('blank'), color: GUN }), null, { gloss: 0.6, crease: 0.5 });
    b.add(loft([{ y: -0.024, rx: 1e-7, c: CYAN }, { y: -0.017, rx: 0.017 }, { y: 0, rx: 0.024 }, { y: 0.017, rx: 0.017 }, { y: 0.024, rx: 1e-7 }], { seg: fine() ? 14 : 8, region: A.get('blank') }), null, { gloss: 1, crease: 0.2, xf: { p: [tip.x, tip.y + 0.018, tip.z] } });
  });

  // Schulterpanzer: gewoelbte Platte, darunter ein dunkler Spalt / shoulder armour: arched plate, a dark gap beneath
  b.mirrorX(() => {
    b.add(torsoShell(T, (u, v) => [(u - 0.5) * 1.9, 0.95 - 0.6 * v, 0.034 + 0.018 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.3))], {
      nu: fine() ? 18 : 9, nv: fine() ? 12 : 6, region: A.get('pauldron'), back: A.get('blank'), thick: 0.016, color: PLATE, backColor: GUN_DARK, st: (u, v) => [u, v],
    }), null, { gloss: 0.45, crease: 1 });
    // Leuchtschlitze an der Vorderkante des Arms / light slots at the front edge of the arm
    for (const y of [0.2, 0.12]) {
      const q = chestAt(T, 0.36, y);
      b.group({ p: [q.p.x, q.p.y, q.p.z], r: aimZ([q.n.x, q.n.y, q.n.z]) }, () => b.add(polyPlate(rect(0, 0, 0.012, 0.03), 0.007, A.get('pixel'), CYAN), null, { crease: 1 }));
    }
  });
  // Brustkern: Sechseckrahmen, leuchtendes Sechseck, heller Mittelpunkt / chest core: hexagon frame, glowing hexagon, bright centre
  {
    const q = chestAt(T, CORE[0], CORE[1]);
    b.group({ p: [q.p.x, q.p.y, q.p.z], r: aimZ([q.n.x, q.n.y, q.n.z]) }, () => {
      b.add(polyPlate(ngon(6, 0.084, Math.PI / 2), 0.018, A.get('core'), mix(PLATE, GUN, 0.4), GUN_DARK), null, { gloss: 0.5, crease: 1 });
      b.add(polyPlate(ngon(6, 0.052, Math.PI / 2), 0.026, A.get('pixel'), CYAN), null, { gloss: 0.5, crease: 1 });
    });
    gemDome(b, A, q.p.clone().addScaledVector(q.n, 0.026), q.n, 0.02, 0.012, mix(CYAN, mat.white, 0.5), 1);
    // Kehlplatte mit zwei Schrauben / throat plate with two screws
    for (const s of [-1, 1]) { const c = chestAt(T, s * 0.13, 0.27); stud(b, A, c.p, c.n, 0.012, 0.006, 'screw', PLATE_DARK, 0.5, 10); }
  }
}

// ---------- Zeichnung / drawing ----------

/** Kopf (gespiegelt: x = 0 vorn Mitte, x = W hinten Mitte; t von unten nach oben): Kantenfugen, Schrauben, Lueftung / head (mirrored: x = 0 front centre, x = W back centre; t from bottom to top): edge joints, screws, vents */
function paintHead(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.62);
  // oben heller, unten im Schatten des Kinns / lighter on top, in the shade of the chin below
  p.gradient(0, 0, W, H, [0, H], [0, 0], 0.8, 1.06);
  // Fugen an den runden Kanten oben und unten, senkrechte Fuge an der Ecke / joints at the rounded edges top and bottom, vertical joint at the corner
  p.panel([[-3, H * 0.13], [W + 3, H * 0.13]], lw(1.4));
  p.panel([[-3, H * 0.86], [W + 3, H * 0.86]], lw(1.4));
  p.panel([[W * 0.3, H * 0.13], [W * 0.3, H * 0.86]], lw(1.3));
  p.panel([[W * 0.7, H * 0.13], [W * 0.7, H * 0.86]], lw(1.3));
  for (const [x, y] of [[0.26, 0.2], [0.26, 0.8], [0.34, 0.2], [0.34, 0.8], [0.66, 0.2], [0.74, 0.8]]) p.rivet(W * x, H * y, lw(2));
  // Lueftung am Hinterkopf: wenige dunkle Schlitze / vents at the back of the head: a few dark slots
  for (let i = 0; i < 4; i++) { const y = H * (0.36 + i * 0.09); p.fill([[W * 0.8, y], [W * 0.98, y], [W * 0.98, y + H * 0.04], [W * 0.8, y + H * 0.04]], GUN_DARK); }
  // Glanz an der oberen Kante vorn / shine on the upper edge at the front
  p.fill(spline([[W * 0.02, H * 0.9], [W * 0.18, H * 0.92], [W * 0.26, H * 0.95], [W * 0.1, H * 0.97], [W * 0.02, H * 0.96]], 4, true), mat.white, 0.5);
}
function paintHeadTop(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.44);
  p.dab(W / 2, H / 2, W * 0.45, 1.06, 0.7);
  p.panel([[W * 0.5, H * 0.08], [W * 0.5, H * 0.92]], lw(1.3));
  for (const [x, y] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) p.rivet(W * x, H * y, lw(2));
}
/** Bildschirm (Draufsicht): dunkles Glas, Innenrand, harter Glanzstreifen / screen (plan view): dark glass, inner rim, a hard streak of shine */
function paintScreen(p: Pen): void {
  // Draufsicht von polyPlate: Rahmen = halbe Breite, die Zelle ist quadratisch / plan view of polyPlate: frame = half width, the cell is square
  const W = p.w, H = p.h, ro = SCR.hw, lw = lineScale(W / (2 * ro));
  const X = (x: number): number => W * (0.5 + x / (2 * ro)), Y = (y: number): number => H * (0.5 - y / (2 * ro));
  p.gradient(0, Y(SCR.hh), W, Y(-SCR.hh) - Y(SCR.hh), [0, Y(SCR.hh)], [0, Y(-SCR.hh)], 1.3, 0.85);
  p.line(roundRect(SCR.hw - 0.012, SCR.hh - 0.012, 0.02).map(([x, y]): Pt => [X(x), Y(y)]), lw(1.3), { closed: true, wobble: 0.1 });
  // harte Glanzstreifen links oben / hard streaks of shine upper left
  p.fill([[X(-0.15), Y(0.085)], [X(-0.1), Y(0.085)], [X(-0.15), Y(0.0)], [X(-0.157), Y(0.0)]], mat.white, 0.12);
  p.fill([[X(-0.088), Y(0.085)], [X(-0.074), Y(0.085)], [X(-0.124), Y(0.0)], [X(-0.138), Y(0.0)]], mat.white, 0.09);
}
/** Leuchtflaeche: heller Kern, dunkler Rand wie ein Bildpunkt / light area: bright core, a darker rim like a pixel */
function paintPixel(p: Pen): void {
  const W = p.w, H = p.h;
  p.fill([[0, 0], [W, 0], [W, H], [0, H]], mix(CYAN, mat.white, 0.2));
  p.fill([[W * 0.22, H * 0.22], [W * 0.78, H * 0.22], [W * 0.78, H * 0.78], [W * 0.22, H * 0.78]], mix(CYAN, mat.white, 0.6));
}
function paintHex(p: Pen, small: boolean): void {
  const W = p.w, c = W / 2, lw = lineScale(W / (small ? 0.052 : 0.054));
  p.fill(ngon(6, W * 0.48, Math.PI / 2).map(([x, y]): Pt => [c + x, c - y]), mix(PLATE, GUN, small ? 0.8 : 0.35));
  p.shade(ngon(6, W * 0.48, Math.PI / 2).map(([x, y]): Pt => [c + x, c - y]).slice(1, 5).concat([[c, c]]), 0.78, 0.9);
  p.line(ngon(6, W * 0.46, Math.PI / 2).map(([x, y]): Pt => [c + x, c - y]), lw(1.4), { closed: true, wobble: 0.1 });
}
/** Hoerkapsel (Draufsicht): Ringe, Schrauben / ear pod (plan view): rings, screws */
function paintEarpod(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.144);
  p.spot(c, c, W * 0.48, mix(PLATE, GUN, 0.2));
  p.fill(arc(c, c, W * 0.48, W * 0.48, 0.1, Math.PI - 0.3, 16), shade(PLATE, 0.7));
  p.line(arc(c, c, W * 0.46, W * 0.46, 0, Math.PI * 2, 28), lw(1.4), { closed: true, wobble: 0.1 });
  p.spot(c, c, W * 0.32, GUN);
  p.line(arc(c, c, W * 0.32, W * 0.32, 0, Math.PI * 2, 24), lw(1.3), { closed: true, wobble: 0.1 });
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * Math.PI * 2; p.rivet(c + Math.cos(a) * W * 0.39, c + Math.sin(a) * W * 0.39, lw(2)); }
}
function paintScrew(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.024);
  p.spot(c, c, W * 0.46, PLATE_DARK);
  p.line([[c - W * 0.28, c], [c + W * 0.28, c]], lw(1.2), { taper: 0, wobble: 0 });
  p.line(arc(c, c, W * 0.44, W * 0.44, 0, Math.PI * 2, 16), lw(1.1), { closed: true, wobble: 0.1 });
}
/** Rahmen des Brustkerns: Fugen zu den Ecken, Emblem oben / frame of the chest core: joints to the corners, emblem on top */
function paintCore(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.168);
  const hex = ngon(6, W * 0.48, Math.PI / 2).map(([x, y]): Pt => [c + x, c - y]);
  p.fill(hex, mix(PLATE, GUN, 0.4));
  p.shade(hex.slice(2, 5).concat([[c, c]]), 0.74, 0.9);
  for (const q of hex) p.line([[c + (q[0] - c) * 0.66, c + (q[1] - c) * 0.66], q], lw(1.2), { taper: 0.1, wobble: 0.1 });
  p.line(ngon(6, W * 0.32, Math.PI / 2).map(([x, y]): Pt => [c + x, c - y]), lw(1.3), { closed: true, wobble: 0.1 });
  p.line(hex, lw(1.5), { closed: true, wobble: 0.1 });
}
/** Schulterpanzer (s von hinten nach vorn, t vom Hals zum Arm): Plattenfugen, Leuchtstreifen, Schrauben / shoulder armour (s from back to front, t from the neck to the arm): plate joints, light stripe, screws */
function paintPauldron(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.8);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.08, 0.82);
  p.panel([[-3, H * 0.42], [W + 3, H * 0.4]], lw(1.4));
  p.panel([[-3, H * 0.74], [W + 3, H * 0.72]], lw(1.4));
  p.band([[-3, H * 0.9], [W + 3, H * 0.88]], lineScale(W / 0.8)(5), mix(CYAN, mat.white, 0.3), lw(1.2));
  for (const [x, y] of [[0.2, 0.3], [0.5, 0.28], [0.8, 0.3], [0.3, 0.6], [0.7, 0.6]]) p.rivet(W * x, H * y, lw(2));
  p.fill(spline([[W * 0.3, H * 0.06], [W * 0.6, H * 0.06], [W * 0.66, H * 0.16], [W * 0.32, H * 0.18]], 4, true), mat.white, 0.35);
}
function paintChest(p: Pen): void {
  const C = chestMap(T, p.w, p.h), P = C.P, u = C.u, lw = lineScale(u(1));
  const top = T.h + T.rise;
  p.shade(spline([P(-0.2, top), P(-0.15, 0.31), P(0, 0.29), P(0.15, 0.31), P(0.2, top)], 6), 0.72, 0.9);
  p.gradient(0, P(0, 0.12)[1], p.w, p.h - P(0, 0.12)[1], P(0, 0.12), P(0, 0), 1, 0.8);
  // Panzerplatten: Kehlplatte im V, zwei Brustplatten, Bauchplatte; Fugen mit Licht und Tusche
  // armour plates: throat plate in a V, two chest plates, belly plate; joints with light and ink
  for (const s of [-1, 1]) {
    p.panel(spline([P(s * 0.17, 0.3), P(s * 0.12, 0.26), P(s * 0.11, 0.0)], 5), lw(1.5));
    p.panel(spline([P(s * 0.12, 0.26), P(s * 0.25, 0.27), P(s * 0.4, 0.25)], 5), lw(1.4));
    p.panel(spline([P(s * 0.11, 0.08), P(s * 0.24, 0.07), P(s * 0.38, 0.05)], 5), lw(1.4));
    // dunkle Leuchtrinnen neben dem Kern / dark light grooves beside the core
    p.fill([P(s * 0.15, 0.22), P(s * 0.17, 0.22), P(s * 0.17, 0.1), P(s * 0.15, 0.1)], GUN_DARK);
    p.mark([P(s * 0.16, 0.215), P(s * 0.16, 0.105)], lw(2.2), CYAN, 1, { taper: 0.05, wobble: 0.05 });
    for (const [x, y] of [[0.3, 0.22], [0.3, 0.12], [0.2, 0.03]]) p.rivet(P(s * x, y)[0], P(s * x, y)[1], lw(2));
    p.fill(spline([P(s * 0.2, 0.245), P(s * 0.32, 0.24), P(s * 0.3, 0.215), P(s * 0.2, 0.22)], 4, true), mat.white, 0.3);
  }
  // Schatten des Kerns, Emblem auf der Kehlplatte / shadow of the core, emblem on the throat plate
  { const c = P(CORE[0] + 0.01, CORE[1] - 0.012); p.fill(ngon(6, u(0.09), Math.PI / 2).map(([x, y]): Pt => [c[0] + x, c[1] - y]), mat.ink, 0.28); }
  { const c = P(0, 0.31); paintEmblem(p, 'nexus', c[0], c[1], u(0.022), GUN, lw(1)); }
}
function paintCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.4);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.82, 1.1);
  p.panel([[-3, H * 0.5], [W + 3, H * 0.5]], lw(1.3));
  for (let i = 0; i < 4; i++) p.rivet(18 + i * 64, H * 0.25, lw(1.8));
}
function paintNeck(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.56);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.7, 1.05);
  for (let i = 0; i < 8; i++) p.panel([[(i / 8) * W + 4, H * 0.4], [(i / 8) * W + 4, H * 0.95]], lw(1.2));
}

function cells(m: MoodArt): Cell[] {
  void m;
  return [
    { name: 'chest', w: 576, h: 256, paint: paintChest },
    ...bodyCells({ plain: true }).filter((c) => c.name !== 'neck' && c.name !== 'ear'),
    { name: 'neck', w: 160, h: 96, paint: paintNeck },
    { name: 'head', w: 448, h: 192, paint: paintHead },
    { name: 'headTop', w: 192, h: 144, paint: paintHeadTop },
    { name: 'screen', w: 288, h: 288, paint: paintScreen },
    { name: 'pixel', w: 32, h: 32, paint: paintPixel },
    { name: 'hex', w: 64, h: 64, paint: (p) => paintHex(p, false) },
    { name: 'hexSmall', w: 48, h: 48, paint: (p) => paintHex(p, true) },
    { name: 'earpod', w: 128, h: 128, paint: paintEarpod },
    { name: 'screw', w: 24, h: 24, paint: paintScrew },
    { name: 'core', w: 176, h: 176, paint: paintCore },
    { name: 'pauldron', w: 320, h: 176, paint: paintPauldron },
    { name: 'collar', w: 256, h: 64, paint: paintCollar },
  ];
}

export const nexus: LeaderDef = { cells, build, glow: [CYAN], side: 1 };
