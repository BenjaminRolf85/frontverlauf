/**
 * Gezeichnete Anfuehrerin der Vesper: die Hohepriesterin der Glut.
 * Inked leader of the Vesper: the high priestess of the ember.
 *
 * Vorlage ist das Portraet des Spiels (public/leaders/img/vesper_neutral.webp): spitze rote Kapuze mit Goldsaum, die
 * das Gesicht rahmt; blasses Gesicht wie gesprungenes Porzellan, gluehende goldene Augen ohne Pupille, dunkle Brauen
 * und Lippen. Hoher Kragen mit goldener Spange, Schultermantel mit einer Reihe goldener Perlen, auf der Brust ein
 * gluehender Reliquienkasten. Das Emblem der Fraktion sitzt auf der Spange und auf dem Kasten.
 * The model is the game's portrait (public/leaders/img/vesper_neutral.webp): a pointed red hood with a gold hem that
 * frames the face; a pale face like cracked porcelain, glowing golden eyes without pupils, dark brows and lips. A high
 * collar with a golden clasp, a shoulder mantle with a row of golden beads, on the chest a glowing reliquary. The
 * faction's emblem sits on the clasp and on the reliquary.
 */
import * as THREE from 'three';
import { fine, mix, shade, type V3 } from '../kit';
import { look, mat } from '../look';
import { Sculpt } from '../sculpt';
import { arc, spline, type Cell, type Pen, type Pt } from './atlas';
import { paintEmblem } from './emblem';
import { aimZ } from './figkit';
import { chestAt, chestMap, faceMap, faceSheet, gemDome, headGeometry, polyPlate, revolve, sheet, stud, torsoGeometry, torsoPoint, torsoShell, type TorsoSpec } from './leaderKit';
import type { LeaderDef } from './leaders';
import { bodyCells, drawBrow, drawEye, drawMouth, drawNose, fold, GOLD, GOLD_DARK, GOLD_LIGHT, goldDisc, lineScale, shadow, wrinkle, type MoodArt } from './leaderPaint';
import { type AtlasLayout, type UvBuilder } from './uvkit';

const L = look('vesper');
const SKIN = mix(mat.bone, mat.paper, 0.35);
const RED = L.primary;
const RED_DEEP = mix(L.primary, mat.ink, 0.62);
/** Glut der Augen und des Kastens / ember of the eyes and the reliquary */
const EMBER = mix(mat.gold, L.secondary, 0.3);
/** Dunkel im Inneren der Kapuze / the dark inside the hood */
const HOOD_DARK = mix(mat.dark, RED_DEEP, 0.4);
const LIPS = mix(L.primary, mat.ink, 0.55);
const BROW = mix(mat.dark, L.primary, 0.2);

const T: TorsoSpec = { w: 0.43, d: 0.21, h: 0.33, slope: 0.1, neckR: 0.1, rise: 0.055, square: 0.24, z: -0.01, chest: 0.018 };
const HEAD_C: V3 = [0, 0.645, 0.035], HEAD_R: V3 = [0.162, 0.192, 0.166];
const MOUTH = { y: -0.56, w: 0.19 };
const EYE = { x: 0.36, y: 0.1, w: 0.17, h: 0.07 };
const LANTERN: [number, number] = [0, 0.16];

function sculpt(m: MoodArt): Sculpt {
  return new Sculpt(HEAD_C, HEAD_R, {
    jaw: 0.3, chin: 0.15, chinDown: 0.05 + m.open * 0.05, lowY: 0.04 + m.open * 0.06, socket: 0.08, brow: 0.05, cheek: 0.12, hollow: 0.04, temple: 0.05,
    noseBridge: 0.08, noseLen: 0.2, noseW: 0.8, noseY: -0.24, lipU: 0.045, lipL: 0.06, mouthDepth: 0.012 + 0.04 * m.open, mouthW: MOUTH.w * 2, mouthY: MOUTH.y,
    smile: -0.005 + m.smile, asym: m.asym, fold: 0.006, eyeY: EYE.y, eyeX: EYE.x, flat: 0.1, frownGeo: 0.2 + m.frown * 0.6,
  });
}

// ---------- Kapuze / hood ----------

/** Oeffnung der Kapuze um das Gesicht, th = 0 oben an der Spitze, +-TH_MAX unten neben dem Hals / opening of the hood around the face, th = 0 at the peak on top, +-TH_MAX below beside the neck */
const TH_MAX = 0.92 * Math.PI;
const AXIS_Y = 0.65;
function rim(th: number): THREE.Vector3 {
  const c = Math.cos(th);
  return new THREE.Vector3(0.182 * Math.sin(th) * (1 + 0.06 * Math.sin(th) ** 2), AXIS_Y + 0.205 * c + 0.035 * Math.max(0, c) ** 8, 0.16 + 0.03 * c);
}
function hoodBack(th: number): THREE.Vector3 { return new THREE.Vector3(0.03 * Math.sin(th), AXIS_Y - 0.02 + 0.25 * Math.cos(th), -0.2); }
/** Kapuzenpunkt: u quer ueber die Oeffnung (0.5 = Spitze), v vom Saum nach hinten / hood point: u across the opening (0.5 = peak), v from the hem to the back */
function hoodAt(u: number, v: number, grow = 0): THREE.Vector3 {
  const th = (2 * u - 1) * TH_MAX;
  const a = rim(th), bk = hoodBack(th), k = v * v;
  const p = a.clone().multiplyScalar(1 - k).addScaledVector(bk, k);
  const rad = new THREE.Vector3(a.x, a.y - AXIS_Y, 0).normalize();
  // aufgeblaeht: der Stoff steht vom Kopf ab, oben zur Spitze gezogen / ballooned: the cloth stands off the head, drawn up to a peak on top
  const c = Math.max(0, Math.cos(th));
  return p.addScaledVector(rad, (0.1 + 0.05 * c ** 4) * Math.sin(Math.PI * v) ** 0.7 + grow);
}

function hood(b: UvBuilder, A: AtlasLayout): void {
  b.add(sheet((u, v) => hoodAt(u, v), {
    nu: fine() ? 48 : 24, nv: fine() ? 16 : 8, region: A.get('hood'), back: A.get('hoodIn'), thick: 0.012, color: RED, backColor: RED_DEEP,
    st: (u, v) => [Math.abs(2 * u - 1), v],
  }), null, { crease: 0.8 });
  // Goldsaum als Wulst entlang der Oeffnung / gold hem as a roll along the opening
  const pts: V3[] = [];
  for (let i = 0; i <= 28; i++) { const q = hoodAt(i / 28, 0.012, 0.004); pts.push([q.x, q.y, q.z]); }
  b.add(tubeAlong(pts, 0.0075, A), null, { gloss: 0.6, crease: 0.4 });
}
function tubeAlong(pts: V3[], r: number, A: AtlasLayout): THREE.BufferGeometry {
  return sheet((u, v) => {
    const n = pts.length - 1, f = u * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
    const a = new THREE.Vector3(...pts[i]), c = new THREE.Vector3(...pts[i + 1]);
    const p = a.clone().lerp(c, t), tan = c.clone().sub(a).normalize();
    const out = new THREE.Vector3(p.x, p.y - AXIS_Y, 0).normalize(), side = new THREE.Vector3().crossVectors(tan, out).normalize();
    const ang = v * Math.PI * 2;
    return p.addScaledVector(out, Math.cos(ang) * r).addScaledVector(side, Math.sin(ang) * r);
  }, { nu: fine() ? 84 : 40, nv: fine() ? 8 : 5, region: A.get('blank'), color: GOLD });
}

// ---------- Aufbau / build ----------

function build(b: UvBuilder, A: AtlasLayout, m: MoodArt): void {
  const S = sculpt(m);
  b.add(torsoGeometry(T, { chest: A.get('chest'), back: A.get('back'), side: A.get('side'), top: A.get('top'), blank: A.get('blank') }, RED_DEEP), null, { crease: 0.6 });
  // Hals und hoher Kragen mit Goldkante / neck and high collar with a gold edge
  b.add(revolve([[0.075, 0.6], [0.08, 0.5], [0.095, 0.34]], { seg: fine() ? 28 : 14, region: A.get('neck'), color: SKIN }), null, { crease: 0 });
  const CO = { centre: [0, -0.004] as [number, number], front: 1.0, tilt: () => 0.1, pivot: [0.4, 0] as [number, number] };
  const collar: [number, number][] = [[0.15, 0.33], [0.128, 0.42], [0.118, 0.5], [0.108, 0.505], [0.1, 0.46]];
  b.add(revolve(collar.slice(0, 3), { ...CO, seg: fine() ? 48 : 24, sub: 2, region: A.get('collar'), mirror: true, color: RED_DEEP }), null, { crease: 0.8, gloss: 0.2 });
  b.add(revolve(collar.slice(2), { ...CO, seg: fine() ? 48 : 24, region: A.get('blank'), color: GOLD }), null, { crease: 0.8, gloss: 0.5 });

  b.add(headGeometry(S, { skin: SKIN, face: A.get('face'), scalp: A.get('scalp') }), null, { crease: 0 });
  // gluehende Augen: flache Linse in der gezeichneten Lidspalte / glowing eyes: flat lens inside the drawn opening
  for (const s of [-1, 1] as const) {
    b.add(faceSheet(S, (u, v) => {
      const a = 2 * u - 1, c2 = 2 * v - 1, k = Math.sqrt(Math.max(0, 1 - a * a));
      const up = Math.max(0.16, 1 - (0.3 + m.upper(s))), lo = Math.max(0.16, 1 - (0.12 + m.lower(s)));
      return [s * (EYE.x + a * EYE.w * 0.84 - 0.005), EYE.y + 0.14 * EYE.w * 0.84 * a + c2 * EYE.h * 0.78 * k * (c2 > 0 ? up : lo), 0.004 + 0.006 * k];
    }, { nu: fine() ? 10 : 6, nv: 4, region: A.get('blank'), color: EMBER }), null, { crease: 0 });
  }
  hood(b, A);

  // Schultermantel: rote Schale, vorn im V offen / shoulder mantle: red shell, open in a V at the front
  const capeAngle = (u: number, v: number) => { const g = 0.05 + 0.34 * Math.pow(v, 1.2); return Math.PI / 2 + g + (2 * Math.PI - 2 * g) * u; };
  b.add(torsoShell(T, (u, v) => {
    const a = capeAngle(u, v), side = Math.abs(Math.cos(a));
    const low = 0.34 - 0.06 * side * side + 0.04 * Math.pow(Math.max(0, Math.sin(a)), 6);
    return [a, low + (0.97 - low) * v, 0.016 + 0.02 * side * side * Math.sin(Math.PI * Math.min(1, v * 1.2))];
  }, {
    nu: fine() ? 72 : 36, nv: fine() ? 12 : 6, region: A.get('mantle'), back: A.get('blank'), thick: 0.012, flip: true, color: RED, backColor: RED_DEEP,
    st: (u, v) => [Math.abs(2 * u - 1), 1 - v],
  }), null, { crease: 0.8 });
  // Perlenreihe ueber jede Schulter / a row of beads over each shoulder
  b.mirrorX(() => {
    for (let i = 0; i < 9; i++) {
      const a = 1.12 - (i / 8) * 1.08, vv = 0.74 - 0.12 * Math.pow(i / 8, 1.4);
      const p0 = torsoPoint(T, a, vv), side = Math.abs(Math.cos(a));
      const n = p0.clone().sub(new THREE.Vector3(0, 0.12, T.z ?? 0)).normalize();
      gemDome(b, A, p0.clone().addScaledVector(n, 0.022 + 0.02 * side * side), n, 0.019, 0.02, GOLD, 0.8);
    }
  });
  // Spange am Kragen: Goldsteg, drei Knoepfe / clasp at the collar: gold bar, three studs
  {
    const q = chestAt(T, 0, 0.318), n = q.n.clone().add(new THREE.Vector3(0, 0.25, 0)).normalize();
    b.group({ p: [q.p.x, q.p.y, q.p.z + 0.028], r: aimZ([n.x, n.y, n.z]) }, () => {
      b.add(polyPlate([[-0.1, 0.022], [0.1, 0.022], [0.1, -0.022], [-0.1, -0.022]], 0.014, A.get('clasp'), GOLD, GOLD_DARK), null, { gloss: 0.6, crease: 1 });
    });
    for (const x of [-0.068, 0, 0.068]) { const at = new THREE.Vector3(x, q.p.y, q.p.z + 0.044); stud(b, A, at, n, x === 0 ? 0.02 : 0.014, 0.008, 'stud', GOLD, 0.6, 14); }
  }
  // Reliquienkasten: Goldrahmen, gluehende Scheibe mit Gitter, Kappe oben / reliquary: gold frame, glowing pane with a lattice, cap on top
  {
    const q = chestAt(T, LANTERN[0], LANTERN[1]);
    b.group({ p: [q.p.x, q.p.y, q.p.z], r: aimZ([q.n.x, q.n.y, q.n.z]) }, () => {
      b.add(polyPlate([[-0.056, 0.07], [0.056, 0.07], [0.064, 0.05], [0.064, -0.05], [0.056, -0.07], [-0.056, -0.07], [-0.064, -0.05], [-0.064, 0.05]], 0.032, A.get('lantern'), GOLD, GOLD_DARK), null, { gloss: 0.6, crease: 1 });
      b.add(polyPlate([[-0.038, 0.05], [0.038, 0.05], [0.038, -0.05], [-0.038, -0.05]], 0.038, A.get('pane'), EMBER, shade(EMBER, 0.6)), null, { gloss: 0.2, crease: 1 });
      b.add(polyPlate([[-0.04, 0.09], [0.04, 0.09], [0.06, 0.07], [-0.06, 0.07]], 0.026, A.get('blank'), GOLD_DARK), null, { gloss: 0.5, crease: 1 });
    });
    for (const s of [-1, 1]) { const c = chestAt(T, s * 0.075, LANTERN[1] + 0.07); gemDome(b, A, c.p.clone().addScaledVector(c.n, 0.012), c.n, 0.014, 0.014, GOLD, 0.8); }
    for (const s of [-1, 1]) { const c = chestAt(T, s * 0.075, LANTERN[1] - 0.07); gemDome(b, A, c.p.clone().addScaledVector(c.n, 0.012), c.n, 0.014, 0.014, GOLD, 0.8); }
  }
}

// ---------- Zeichnung / drawing ----------

function paintFace(p: Pen, m: MoodArt): void {
  const M = faceMap(p.w, p.h), P = M.P, lw = lineScale(M.u(1) / HEAD_R[0]);
  const angry = m.id === 'angry';
  // Schatten der Kapuze: an Stirn und Schlaefen harte dunkle Flaechen / shadow of the hood: hard dark areas at forehead and temples
  p.shade(spline([P(-0.95, 0.42), P(-0.5, 0.56), P(0, 0.62), P(0.5, 0.56), P(0.95, 0.42)], 6).concat([P(0.95, 0.95), P(-0.95, 0.95)]), 0.62, 0.95);
  for (const s of [-1, 1]) p.shade(spline([P(s * 0.98, 0.5), P(s * 0.78, 0.3), P(s * 0.7, -0.05), P(s * 0.62, -0.4), P(s * 0.5, -0.75), P(s * 0.98, -0.8)], 6, true), s > 0 ? 0.66 : 0.74, 0.95);
  // ausserhalb des Gesichtsovals das Dunkel der Kapuze (verdeckt auch die Naht zur Schaedelzelle)
  // outside the face oval the dark of the hood (also hides the seam to the scalp cell)
  {
    const ring: Pt[] = [];
    for (let i = 0; i <= 40; i++) { const a = Math.PI / 2 + (i / 40) * Math.PI * 2; ring.push(P(0.84 * Math.cos(a), -0.1 + 0.8 * Math.sin(a))); }
    const W = p.w, H = p.h, top = ring[0];
    p.fill([[-4, -4], [W + 4, -4], [W + 4, H + 4], [-4, H + 4], [-4, -4], [top[0], -4], ...ring, [top[0], -4]], HOOD_DARK);
    p.line(ring.slice(4, 37), lw(1.6), { taper: 0.2, wobble: 0.3 });
  }
  // Wangenknochen und Augenhoehlen / cheekbones and sockets
  shadow(p, M, [[0.34, -0.24], [0.5, -0.12], [0.58, -0.3], [0.46, -0.54], [0.3, -0.74], [0.27, -0.5]], 0.84, 0.9, false);
  shadow(p, M, [[-0.38, -0.28], [-0.5, -0.16], [-0.56, -0.34], [-0.44, -0.56], [-0.32, -0.7]], 0.9, 0.9, false);
  shadow(p, M, [[0.1, 0.2], [0.3, 0.25], [0.56, 0.22], [0.6, 0.13], [0.3, 0.18], [0.13, 0.14]], 0.8, 0.9);
  shadow(p, M, [[-0.13, -0.68], [0, -0.695], [0.13, -0.68], [0.09, -0.735], [0, -0.75], [-0.09, -0.735]], 0.84, 0.9, false);
  p.gradient(0, P(0, -0.82)[1], p.w, p.h - P(0, -0.82)[1], P(0, -0.82), P(0, -1), 1, 0.66);
  // Spruenge im Porzellan: verzweigte Tuschelinien von der Stirn und den Wangen / cracks in the porcelain: branching ink lines from the forehead and cheeks
  const crack = (pts: [number, number][], w: number) => p.line(pts.map(([x, y]) => P(x, y)), lw(w), { taper: 0.3, wobble: 0.15, press: 0.2 });
  crack([[-0.14, 0.62], [-0.12, 0.5], [-0.17, 0.42], [-0.13, 0.31]], 1.5);
  crack([[-0.17, 0.42], [-0.26, 0.38]], 1.1);
  crack([[0.2, 0.62], [0.22, 0.52], [0.17, 0.44], [0.2, 0.36]], 1.4);
  crack([[0.22, 0.52], [0.31, 0.48], [0.35, 0.52]], 1.1);
  crack([[0.62, 0.0], [0.5, -0.06], [0.46, -0.18], [0.5, -0.3]], 1.4);
  crack([[0.46, -0.18], [0.36, -0.22]], 1.05);
  crack([[-0.6, -0.08], [-0.52, -0.16], [-0.54, -0.28]], 1.2);
  crack([[0.1, -0.92], [0.13, -0.82], [0.1, -0.74]], 1.1);
  // Lidschatten: dunkle Flaeche um die Augen / eye shadow: a dark area around the eyes
  for (const s of [-1, 1]) {
    const c = P(s * (EYE.x + 0.01), EYE.y + 0.02);
    p.fill(arc(c[0], c[1], M.u(0.22), M.u(0.12), 0, Math.PI * 2, 22), mix(SKIN, RED_DEEP, 0.4), 0.8);
  }
  if (m.frown > 0.5) wrinkle(p, M, [[0.045, 0.19 + m.browIn(1) * 0.4], [0.06, 0.25], [0.05, 0.3]], lw(1.6));
  if (angry) wrinkle(p, M, [[0.12, 0.3], [0.16, 0.35], [0.2, 0.33]], lw(1.4));
  for (const s of [-1, 1] as const) {
    drawEye(p, M, s, {
      x: EYE.x, y: EYE.y, w: EYE.w, h: EYE.h, tilt: 0.14, upper: 0.3 + m.upper(s), lower: 0.12 + m.lower(s), iris: EMBER, glow: EMBER,
      lid: 4.6, wing: 0.05, crease: 0.035,
    }, lw);
    drawBrow(p, M, s, { x0: 0.08, y0: 0.2 + m.browIn(s), x1: 0.62, y1: 0.29 + m.browOut(s), arch: 0.025, thick: 0.065, colour: BROW, strands: 2, seed: 81 + s }, lw);
  }
  drawNose(p, M, { y: -0.24, w: 0.85, top: 0.15, shade: 0.84 }, lw);
  drawMouth(p, M, { y: MOUTH.y, w: MOUTH.w, smile: -0.005 + m.smile, asym: m.asym, lipU: 0.042, lipL: 0.058, colour: LIPS, shine: 0.4, open: m.open * 0.75, line: 2.8 }, lw);
  wrinkle(p, M, [[-0.07, -0.85], [0, -0.865], [0.07, -0.85]], lw(1.2), false);
}

function paintScalp(p: Pen): void {
  // im Dunkel der Kapuze: dunkles Haar / in the dark of the hood: dark hair
  p.fill([[-6, -6], [p.w + 6, -6], [p.w + 6, p.h + 6], [-6, p.h + 6]], HOOD_DARK);
}

/** Kapuze aussen (gespiegelt: s = 0 Spitze, s = 1 unten; t vom Saum nach hinten) / hood outside (mirrored: s = 0 peak, s = 1 bottom; t from the hem to the back) */
function paintHood(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.7);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.06, 0.8);
  // Goldsaum, darunter eine feine Naht / gold hem, a fine seam behind it
  p.band([[-4, 7], [W + 4, 7]], 12, GOLD, lw(1.3));
  p.line([[-4, 20], [W + 4, 20]], lw(1.1), { taper: 0.02, wobble: 0.3 });
  // Mittelnaht ueber den Scheitel / centre seam over the crown
  p.line([[1, 0], [1, H]], lw(2), { taper: 0.1, wobble: 0.2 });
  // Falten vom Saum nach hinten, Licht oben, Schatten zur Seite / folds from the hem backward, light on top, shade towards the side
  for (const [x, d] of [[0.18, 1], [0.36, -1], [0.55, 1], [0.72, -1], [0.88, 1]] as [number, number][]) fold(p, spline([[W * x, H * 0.16], [W * (x + 0.03 * d), H * 0.5], [W * x, H * 0.9]], 5), lw(1.3), 9 * d, 0.82);
  p.fill(spline([[W * 0.02, H * 0.3], [W * 0.14, H * 0.24], [W * 0.26, H * 0.34], [W * 0.14, H * 0.62], [W * 0.02, H * 0.7]], 5, true), mat.white, 0.14);
  p.shade([[W * 0.62, 0], [W, 0], [W, H], [W * 0.62, H]], 0.86, 0.9);
}
/** Kapuze innen: im Dunkel, nur der Saum glaenzt / hood inside: in the dark, only the hem shines */
function paintHoodIn(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.7);
  p.gradient(0, 0, W, H, [0, 0], [0, H * 0.5], 1.15, 0.7);
  p.band([[-4, 6], [W + 4, 6]], 10, GOLD_DARK, lw(1.2));
  for (const x of [0.3, 0.6, 0.85]) p.line(spline([[W * x, H * 0.14], [W * (x + 0.02), H * 0.5], [W * x, H * 0.86]], 4), lw(1.2), { taper: 0.4, wobble: 0.3 });
}

/** Schultermantel (gespiegelt: x = 0 hinten Mitte, x = W Vorderkante; t vom Hals zum Saum) / shoulder mantle (mirrored: x = 0 back centre, x = W front edge; t from the neck to the hem) */
function paintMantle(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.25);
  p.gradient(0, 0, W, H * 0.3, [0, 0], [0, H * 0.3], 0.74, 1);
  // Goldborte an Saum und Vorderkante, dahinter eine dunkle Bahn / gold trim at hem and front edge, a dark lane behind it
  p.band([[-4, H - 7], [W + 4, H - 7]], 10, GOLD, lw(1.3));
  p.band([[W - 6, -4], [W - 6, H + 4]], 10, GOLD, lw(1.3));
  p.fill([[-4, H - 26], [W - 16, H - 26], [W - 16, H - 14], [-4, H - 14]], RED_DEEP, 0.9);
  p.line([[-4, H - 26], [W - 16, H - 26]], lw(1.1), { taper: 0.02, wobble: 0.3 });
  // Rippen: der Mantel ist in Bahnen gesteppt, jede Bahn mit Licht und Schatten / ribs: the mantle is quilted in lanes, each lane with light and shade
  for (let i = 1; i < 12; i++) {
    const x = (i / 12) * (W - 24);
    p.line(spline([[x, 4], [x + 2, H * 0.5], [x + 4, H - 28]], 4), lw(1.3), { taper: 0.25, wobble: 0.3 });
    p.shade([[x, 4], [x + 9, 4], [x + 13, H - 28], [x + 4, H - 28]], 0.82, 0.85);
  }
}

function paintChest(p: Pen): void {
  const C = chestMap(T, p.w, p.h), P = C.P, u = C.u, lw = lineScale(u(1));
  const top = T.h + T.rise;
  p.shade(spline([P(-0.2, top), P(-0.15, 0.31), P(0, 0.29), P(0.15, 0.31), P(0.2, top)], 6), 0.7, 0.9);
  p.gradient(0, P(0, 0.12)[1], p.w, p.h - P(0, 0.12)[1], P(0, 0.12), P(0, 0), 1, 0.78);
  // Unterkleid: zwei Goldborten neben dem Kasten, Naehte, Falten / underrobe: two gold bands beside the reliquary, seams, folds
  for (const s of [-1, 1]) {
    p.band(spline([P(s * 0.1, 0.33), P(s * 0.105, 0.16), P(s * 0.11, -0.01)], 6), u(0.016), GOLD, lw(1.2));
    p.stitch(spline([P(s * 0.13, 0.32), P(s * 0.135, 0.16), P(s * 0.14, -0.01)], 6), 4, 3.2, 1.1, 0.6);
    fold(p, spline([P(s * 0.2, 0.22), P(s * 0.22, 0.12), P(s * 0.21, 0.0)], 5), lw(1.3), u(0.014) * s, 0.8);
  }
  // Schatten des Kastens / shadow of the reliquary
  p.shade([P(-0.07, LANTERN[1] + 0.07), P(0.08, LANTERN[1] + 0.06), P(0.08, LANTERN[1] - 0.085), P(-0.06, LANTERN[1] - 0.085)], 0.6, 0.9);
}

/** Stehkragen (gespiegelt: x = 0 vorn Mitte) / standing collar (mirrored: x = 0 front centre) */
function paintCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.4);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.86, 1.06);
  p.band([[-4, 8], [W + 4, 8]], 7, GOLD, lw(1.2));
  for (let i = 0; i < 6; i++) { const x = 20 + i * 38; p.line([[x, 18], [x + 3, H - 6]], lw(1.2), { taper: 0.3, wobble: 0.3 }); }
}
function paintClasp(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.2);
  p.fill([[0, 0], [W, 0], [W, H * 0.3], [0, H * 0.3]], GOLD_LIGHT, 0.7);
  p.shade([[0, H * 0.68], [W, H * 0.68], [W, H], [0, H]], 0.72, 0.9);
  p.line([[6, H * 0.5], [W - 6, H * 0.5]], lw(1.1), { taper: 0.1, wobble: 0.1 });
  p.line([[3, 3], [W - 3, 3], [W - 3, H - 3], [3, H - 3]], lw(1.5), { closed: true, wobble: 0.1 });
}
function paintStud(p: Pen): void {
  const c = p.w / 2, lw = lineScale(p.w / 0.04);
  goldDisc(p, c, c, p.w * 0.47, lw(1.4));
  paintEmblem(p, 'vesper', c, c, p.w * 0.26, GOLD_DARK, lw(0.9));
}
/** Rahmen des Kastens (Draufsicht, Mitte = Zellenmitte): Gravur, Ecknieten / frame of the reliquary (plan view, centre = cell centre): engraving, corner rivets */
function paintLantern(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, lw = lineScale(W / 0.128);
  p.fill([[0, 0], [W, 0], [W, H * 0.2], [0, H * 0.2]], GOLD_LIGHT, 0.6);
  p.shade([[W * 0.62, 0], [W, 0], [W, H], [W * 0.62, H]], 0.78, 0.9);
  p.line([[W * 0.16, H * 0.14], [W * 0.84, H * 0.14], [W * 0.84, H * 0.86], [W * 0.16, H * 0.86]], lw(1.3), { closed: true, wobble: 0.1 });
  for (const [x, y] of [[0.12, 0.08], [0.88, 0.08], [0.12, 0.92], [0.88, 0.92]]) p.rivet(W * x, H * y, lw(2.2));
  paintEmblem(p, 'vesper', cx, H * 0.05 + 2, W * 0.06, GOLD_DARK, lw(0.9));
}
/** Gluehende Scheibe: Goldgitter, heller Kern / glowing pane: gold lattice, bright core */
function paintPane(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, cy = H / 2, lw = lineScale(W / 0.076);
  p.fill(arc(cx, cy, W * 0.36, H * 0.3, 0, Math.PI * 2, 20), mix(EMBER, mat.white, 0.5), 0.9);
  p.fill(arc(cx, cy, W * 0.18, H * 0.14, 0, Math.PI * 2, 16), mat.white, 0.85);
  for (const x of [W * 0.5]) p.band([[x, -3], [x, H + 3]], lw(4), GOLD, lw(1.1));
  for (const y of [H * 0.34, H * 0.66]) p.band([[-3, y], [W + 3, y]], lw(4), GOLD, lw(1.1));
  // Strahlen: kurze Rauten um den Kern / rays: short lozenges around the core
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * Math.PI * 2; p.fill([[cx + Math.cos(a) * W * 0.1, cy + Math.sin(a) * H * 0.08], [cx + Math.cos(a + 0.2) * W * 0.3, cy + Math.sin(a + 0.2) * H * 0.26], [cx + Math.cos(a) * W * 0.38, cy + Math.sin(a) * H * 0.33], [cx + Math.cos(a - 0.2) * W * 0.3, cy + Math.sin(a - 0.2) * H * 0.26]], mix(EMBER, mat.white, 0.7), 0.8); }
  p.line([[2, 2], [W - 2, 2], [W - 2, H - 2], [2, H - 2]], lw(1.6), { closed: true, wobble: 0.1 });
}
function paintNeck(p: Pen): void {
  const W = p.w, H = p.h;
  p.shade(spline([[W * 0.15, 0], [W * 0.3, H * 0.6], [W * 0.5, H * 0.72], [W * 0.7, H * 0.6], [W * 0.85, 0]], 6), 0.6, 0.95);
  p.gradient(0, H * 0.5, W, H * 0.5, [0, H * 0.5], [0, H], 1, 0.6);
}

function cells(m: MoodArt): Cell[] {
  return [
    { name: 'face', w: 512, h: 512, paint: (p) => paintFace(p, m) },
    { name: 'scalp', w: 64, h: 64, paint: paintScalp },
    { name: 'chest', w: 576, h: 256, paint: paintChest },
    ...bodyCells({ plain: true }).filter((c) => c.name !== 'neck' && c.name !== 'ear'),
    { name: 'neck', w: 128, h: 96, paint: paintNeck },
    { name: 'hood', w: 448, h: 208, paint: paintHood },
    { name: 'hoodIn', w: 256, h: 144, paint: paintHoodIn },
    { name: 'mantle', w: 464, h: 176, paint: paintMantle },
    { name: 'collar', w: 256, h: 80, paint: paintCollar },
    { name: 'clasp', w: 160, h: 40, paint: paintClasp },
    { name: 'stud', w: 48, h: 48, paint: paintStud },
    { name: 'lantern', w: 128, h: 144, paint: paintLantern },
    { name: 'pane', w: 80, h: 104, paint: paintPane },
  ];
}

export const vesper: LeaderDef = { cells, build, glow: [EMBER], side: 1 };
