/**
 * Gezeichnete Anfuehrerin der Alvenia: Hochmeisterin des Ordens, die Paladinin.
 * Inked leader of the Alvenia: Grand Master of the Order, the paladin.
 *
 * Vorlage ist das Portraet des Spiels (public/leaders/img/alvenia_neutral.webp): Frau im weiss-goldenen Helm mit
 * blauem Stirnschild und vierzackigem Stern, Lorbeer auf der Kuppel, goldgefasste Wangenklappen, leuchtende
 * Ohrstuecke, Kinnschutz, schwarzer Pagenkopf, gruene Augen, Schoenheitsfleck; dahinter der schwebende Sonnenkranz.
 * Weisser Schulterumhang mit Goldborte und Lorbeer, goldene Schulterscheiben mit blauem Stein, blauer Wappenrock mit
 * Sternen, auf der Brust das Medaillon mit leuchtendem Kreuz im Lorbeerkranz.
 * The model is the game's portrait (public/leaders/img/alvenia_neutral.webp): a woman in a white and gold helmet with a
 * blue brow shield and a four-pointed star, laurel on the dome, gold-rimmed cheek guards, glowing ear pieces, a chin
 * guard, a black bob, green eyes, a beauty mark; behind her the floating sun halo. White shoulder cape with gold trim
 * and laurel, golden shoulder discs with a blue gem, blue tabard with stars, on the chest the medallion with a glowing
 * cross in a laurel wreath.
 */
import * as THREE from 'three';
import { fine, mix, shade, type V3 } from '../kit';
import { FAITH } from '../alveniaFaith';
import { mat } from '../look';
import { Sculpt, smoothstep } from '../sculpt';
import { arc, spline, type Cell, type Pen, type Pt } from './atlas';
import { paintEmblem } from './emblem';
import { aimZ } from './figkit';
import { chestAt, chestMap, faceMap, gemDome, headGeometry, polyPlate, revolve, sheet, starPlate, stud, torsoGeometry, torsoPoint, torsoShell, tube, type TorsoSpec } from './leaderKit';
import type { LeaderDef } from './leaders';
import { bodyCells, drawBrow, drawEye, drawMouth, drawNose, fold, goldDisc, leafBraid, lineScale, patch, shadow, starPts, wrinkle, type MoodArt } from './leaderPaint';
import { loft, type AtlasLayout, type UvBuilder } from './uvkit';

const SKIN = shade(mix(mat.skin, mat.orange, 0.24), 0.9);
const HAIR = mix(mat.dark, mat.window, 0.35);
const HAIR_LIGHT = mix(mat.darkMid, mat.blue, 0.3);
const LIPS = mix(mat.red, mat.wood, 0.5);
const EYE = mix(mat.green, mat.teal, 0.45);
const WHITE = FAITH.plate, GOLDF = FAITH.gold, GOLD_D = FAITH.goldDark, GOLD_L = FAITH.goldLight, BLUE = FAITH.cloth, BLUE_D = FAITH.clothDeep;

const T: TorsoSpec = { w: 0.44, d: 0.21, h: 0.34, slope: 0.09, neckR: 0.105, rise: 0.055, square: 0.26, z: -0.01, chest: 0.022 };
const HEAD_C: V3 = [0, 0.655, 0.03], HEAD_R: V3 = [0.17, 0.186, 0.168];
const MOUTH = { y: -0.56, w: 0.2 };

function sculpt(m: MoodArt): Sculpt {
  return new Sculpt(HEAD_C, HEAD_R, {
    jaw: 0.27, chin: 0.13, chinDown: 0.04 + m.open * 0.05, lowY: 0.02 + m.open * 0.06, socket: 0.07, brow: 0.035, cheek: 0.09, temple: 0.04,
    noseBridge: 0.07, noseLen: 0.2, noseW: 0.85, noseY: -0.24, lipU: 0.05, lipL: 0.065, mouthDepth: 0.012 + 0.04 * m.open, mouthW: MOUTH.w * 2, mouthY: MOUTH.y,
    smile: 0.01 + m.smile, asym: m.asym, fold: 0.006, eyeY: 0.1, eyeX: 0.36, flat: 0.1, frownGeo: m.frown * 0.6,
  });
}

// ---------- Helm / helmet ----------

const HELM = { R: 0.232, Ry: 0.222, yc: 0.728, zc: 0.014, yMin: 0.5 };
const HELM_TOP = HELM.yc + HELM.Ry;
/** Unterkante der Kuppel: ueber den Brauen, hinter der Schlaefe tiefer / lower edge of the dome: above the brows, lower behind the temple */
const helmRim = (a: number) => { const k = Math.abs(a); return 0.748 - 0.14 * smoothstep(0.8, 1.12, k) - 0.09 * smoothstep(1.5, 2.6, k); };
const helmRadius = (y: number) => (y >= HELM.yc ? HELM.R * Math.sqrt(Math.max(0, 1 - ((y - HELM.yc) / HELM.Ry) ** 2)) : HELM.R * (1 - 0.12 * ((HELM.yc - y) / 0.22) ** 2));
const helmPoint = (a: number, y: number, grow = 0) => { const r = helmRadius(y) + grow; return new THREE.Vector3(Math.sin(a) * r, y, HELM.zc + Math.cos(a) * r * (Math.cos(a) > 0 ? 1.03 : 1.05)); };
const helmT = (y: number) => (HELM_TOP - y) / (HELM_TOP - HELM.yMin);
const helmY = (a: number, v: number) => { const y0 = helmRim(a); return y0 + (HELM_TOP - y0) * Math.sin((v * Math.PI) / 2); };

/** Umriss des Stirnschilds (Mitte = Ursprung) / outline of the brow shield (centre = origin) */
const CREST: [number, number][] = [[0, 0.142], [-0.03, 0.1], [-0.078, 0.07], [-0.078, -0.026], [0, -0.124], [0.078, -0.026], [0.078, 0.07], [0.03, 0.1]];

function helmet(b: UvBuilder, A: AtlasLayout): void {
  const nu = fine() ? 64 : 32, nv = fine() ? 18 : 9;
  b.add(sheet((u, v) => { const a = u * Math.PI * 2 - Math.PI; return helmPoint(a, helmY(a, v)); }, {
    nu, nv, region: A.get('helmet'), back: A.get('blank'), thick: 0.014, closedU: true, color: WHITE, backColor: shade(WHITE, 0.45),
    st: (u, v) => { const a = u * Math.PI * 2 - Math.PI; return [Math.abs(2 * u - 1), helmT(helmY(a, v))]; },
  }), null, { gloss: 0.5, crease: 1 });
  // Stirnschild: Goldrahmen, blaues Feld, Stern; ragt ueber die Kuppel hinaus / brow shield: gold frame, blue field, star; rises above the dome
  {
    const c = helmPoint(0, 0.852, 0.022), up = helmPoint(0, 0.9).sub(helmPoint(0, 0.8)).normalize();
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), up).normalize();
    b.group({ p: [c.x, c.y - 0.004, c.z + 0.004], r: aimZ([n.x, n.y, n.z]) }, () => {
      b.add(polyPlate(CREST, 0.012, A.get('crest'), GOLDF, GOLD_D), null, { gloss: 0.55, crease: 1 });
    });
  }
  // Wangenklappen: weisse Platten mit Goldkante, vom Helmrand zur Kinnspitze / cheek guards: white plates with a gold edge, from the helmet rim to the tip at the chin
  b.mirrorX(() => {
    b.add(sheet((u, v) => {
      const xi = 0.128 - 0.012 * v - 0.03 * v * v, xo = 0.226 - 0.03 * v - 0.115 * v * v * v;
      const zi = 0.172 - 0.012 * v, zo = 0.075 + 0.05 * v;
      return new THREE.Vector3(xi + (xo - xi) * u, 0.762 - 0.285 * v, zi + (zo - zi) * u + 0.014 * Math.sin(Math.PI * u) * (1 - v * 0.6));
    }, { nu: fine() ? 6 : 3, nv: fine() ? 14 : 7, region: A.get('cheek'), back: A.get('blank'), thick: 0.012, flip: true, color: WHITE, backColor: shade(WHITE, 0.45) }), null, { gloss: 0.5, crease: 1 });
    // Ohrstueck mit tuerkiser Leuchte / ear piece with a teal lamp
    const at = helmPoint(1.36, 0.676), nx = new THREE.Vector3(1, 0, 0.3).normalize();
    stud(b, A, at.clone().addScaledVector(nx, -0.008), nx, 0.058, 0.03, 'earpiece', WHITE, 0.5, 14);
    gemDome(b, A, at.clone().addScaledVector(nx, 0.028), nx, 0.04, 0.016, FAITH.tech, 1, [0.4, 1]);
  });
  // Sonnenkranz: vier leuchtende Boegen hinter dem Kopf / sun halo: four glowing arcs behind the head
  const HC = new THREE.Vector3(0, 0.75, -0.1), HR = 0.285;
  for (const [a0, a1] of [[-104, -63], [-57, -5], [5, 57], [63, 104]]) {
    const pts: V3[] = [];
    for (let i = 0; i <= 8; i++) { const a = ((a0 + ((a1 - a0) * i) / 8) * Math.PI) / 180; pts.push([HC.x + Math.sin(a) * HR, HC.y + Math.cos(a) * HR, HC.z - 0.02 * Math.cos(a)]); }
    b.add(tube(pts, () => 0.0105, { seg: fine() ? 8 : 5, samples: fine() ? 16 : 8, region: A.get('blank'), color: FAITH.halo }), null, { crease: 0 });
  }
  b.add(loft([{ y: HC.y + HR + 0.03, rx: 0.006, c: FAITH.halo }, { y: HC.y + HR - 0.026, rx: 0.006 }], { seg: 6, region: A.get('blank'), capFirst: true, capLast: true }), null, { crease: 0, xf: { p: [0, 0, HC.z - 0.02] } });
}

// ---------- Aufbau / build ----------

const MEDAL: [number, number] = [0, 0.2];

function build(b: UvBuilder, A: AtlasLayout, m: MoodArt): void {
  const S = sculpt(m);
  b.add(torsoGeometry(T, { chest: A.get('chest'), back: A.get('back'), side: A.get('side'), top: A.get('top'), blank: A.get('blank') }, BLUE), null, { crease: 0.6 });
  b.add(loft([{ y: 0.6, rx: 0.074, cz: 0.0, c: SKIN }, { y: 0.48, rx: 0.078, cz: -0.004 }, { y: 0.33, rx: 0.09, cz: -0.01 }], { seg: fine() ? 28 : 14, region: A.get('neck') }), null, { crease: 0 });
  // Halsberge: weisse Platte mit Goldrand / gorget: white plate with a gold rim
  const collar: [number, number][] = [[0.146, 0.33], [0.134, 0.39], [0.122, 0.452], [0.111, 0.455], [0.102, 0.4]];
  const CO = { centre: [0, -0.006] as [number, number], front: 0.98, tilt: () => 0.12, pivot: [0.39, 0] as [number, number] };
  b.add(revolve(collar.slice(0, 3), { ...CO, seg: fine() ? 44 : 22, sub: 2, region: A.get('collar'), mirror: true, color: WHITE }), null, { gloss: 0.4, crease: 0.8 });
  b.add(revolve(collar.slice(2), { ...CO, seg: fine() ? 44 : 22, region: A.get('blank'), color: GOLD_D }), null, { crease: 0.8 });
  // Kinnschutz: Platte mit Mittelgrat vor dem Hals / chin guard: plate with a centre ridge in front of the neck
  b.add(sheet((u, v) => {
    const a = (u - 0.5) * 1.3, r = 0.107 - 0.012 * v + 0.012 * Math.exp(-((a / 0.16) ** 2));
    return new THREE.Vector3(Math.sin(a) * r, 0.405 + (0.115 - 0.05 * Math.abs(2 * u - 1) ** 1.5) * v, 0.012 + Math.cos(a) * r);
  }, { nu: fine() ? 12 : 6, nv: fine() ? 4 : 2, region: A.get('bevor'), back: A.get('blank'), thick: 0.01, color: WHITE, backColor: shade(WHITE, 0.45) }), null, { gloss: 0.5, crease: 1 });

  b.add(headGeometry(S, { skin: SKIN, face: A.get('face'), scalp: A.get('blank'), colour: (p) => (p.z < 0.5 ? HAIR : null), cut: (p) => p.y > 0.62 || (p.z < 0.2 && p.y > -0.2) }), null, { crease: 0 });
  // schwarzer Pagenkopf: zwei Straehnen neben den Wangen / black bob: two locks beside the cheeks
  for (const s of [-1, 1]) {
    b.group({ s: [s, 1, 1] }, () => {
      const pts: V3[] = [S.dir([0.74, 0.55, 0.38], 0.01), S.dir([0.86, 0.2, 0.42], 0.03), S.dir([0.88, -0.25, 0.42], 0.045), S.dir([0.8, -0.62, 0.42], 0.05), S.dir([0.66, -0.84, 0.44], 0.035)];
      b.add(tube(pts, (t) => { const k = Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.72)) * (1 - Math.pow(t, 4)); return [0.004 + 0.022 * k, 0.006 + 0.07 * k]; },
        { seg: fine() ? 10 : 6, samples: fine() ? 16 : 8, region: A.get('hair'), out: [0.85, 0, 0.5], front: true, color: HAIR }), null, { crease: 0.4 });
    });
  }
  helmet(b, A);

  // Schulterumhang: weisse Schale ueber den Schultern, vorn in einem V offen / shoulder cape: white shell over the shoulders, open in a V at the front
  const capeAngle = (u: number, v: number) => { const g = 0.03 + 0.4 * Math.pow(v, 1.3); return Math.PI / 2 + g + (2 * Math.PI - 2 * g) * u; };
  b.add(torsoShell(T, (u, v) => {
    const a = capeAngle(u, v), side = Math.abs(Math.cos(a));
    const low = 0.36 - 0.08 * side * side + 0.05 * Math.pow(Math.max(0, Math.sin(a)), 6);
    return [a, low + (0.985 - low) * v, 0.014 + 0.026 * side * side * Math.sin(Math.PI * Math.min(1, v * 1.2))];
  }, {
    nu: fine() ? 72 : 36, nv: fine() ? 12 : 6, region: A.get('cape'), back: A.get('blank'), thick: 0.012, flip: true, color: WHITE, backColor: shade(WHITE, 0.5),
    st: (u, v) => [Math.abs(2 * u - 1), 1 - v],
  }), null, { crease: 0.8 });
  // Schulterscheiben: Gold mit tuerkisem Stein / shoulder discs: gold with a teal gem
  b.mirrorX(() => {
    const p0 = torsoPoint(T, 0.42, 0.63), n = new THREE.Vector3(0.62, 0.62, 0.48).normalize();
    const at = p0.addScaledVector(n, 0.045);
    stud(b, A, at, n, 0.066, 0.014, 'disc', GOLDF, 0.6, 20);
    gemDome(b, A, at.clone().addScaledVector(n, 0.014), n, 0.036, 0.016, FAITH.tech, 1);
  });
  // Medaillon: vierzackiger Goldstern, Scheibe mit Lorbeerkranz, leuchtendes Kreuz / medallion: four-pointed gold star, disc with a laurel wreath, glowing cross
  {
    const q = chestAt(T, MEDAL[0], MEDAL[1]);
    b.group({ p: [q.p.x, q.p.y, q.p.z + 0.012], r: aimZ([q.n.x, q.n.y, q.n.z]) }, () => {
      b.add(starPlate(4, 0.118, 0.045, 0.008, A.get('star4'), GOLDF), null, { gloss: 0.55, crease: 1 });
      const k = 0.0115, l = 0.034;
      b.add(polyPlate([[-k, l], [-k, k], [-l, k], [-l, -k], [-k, -k], [-k, -l], [k, -l], [k, -k], [l, -k], [l, k], [k, k], [k, l]], 0.03, A.get('blank'), FAITH.tech), null, { crease: 0.6 });
    });
    stud(b, A, q.p.clone().addScaledVector(q.n, 0.02), q.n, 0.078, 0.012, 'medallion', GOLDF, 0.55, 22);
  }
}

// ---------- Zeichnung / drawing ----------

function paintFace(p: Pen, m: MoodArt): void {
  const M = faceMap(p.w, p.h), P = M.P, lw = lineScale(M.u(1) / HEAD_R[0]);
  // Schlagschatten des Helms auf der Stirn, der Wangenklappen an den Seiten / cast shadow of the helmet on the forehead, of the cheek guards at the sides
  p.shade(spline([P(-0.95, 0.3), P(-0.5, 0.39), P(0, 0.33), P(0.5, 0.39), P(0.95, 0.3)], 6).concat([P(0.95, 0.95), P(-0.95, 0.95)]), 0.68, 0.95);
  shadow(p, M, [[0.5, 0.3], [0.56, 0.0], [0.5, -0.35], [0.36, -0.7], [0.5, -0.8], [0.9, -0.3], [0.9, 0.3]], 0.76, 0.9);
  // Wangenknochen und Kiefer: flache Schatten, im Bild rechts kraeftiger / cheekbone and jaw: flat shadows, stronger on the right of the picture
  shadow(p, M, [[0.3, -0.26], [0.44, -0.16], [0.5, -0.34], [0.4, -0.56], [0.26, -0.74], [0.24, -0.52]], 0.84, 0.9, false);
  shadow(p, M, [[-0.36, -0.3], [-0.46, -0.2], [-0.5, -0.36], [-0.4, -0.58], [-0.3, -0.7]], 0.9, 0.9, false);
  shadow(p, M, [[0.09, 0.19], [0.3, 0.225], [0.54, 0.2], [0.58, 0.12], [0.3, 0.17], [0.12, 0.13]], 0.8, 0.9);
  for (const s of [-1, 1]) { const c = P(s * 0.4, -0.2); p.dab(c[0], c[1], M.u(0.15), [1.07, 0.84, 0.8], 0.5); }
  shadow(p, M, [[-0.13, -0.69], [0, -0.705], [0.13, -0.69], [0.09, -0.745], [0, -0.76], [-0.09, -0.745]], 0.8, 0.9, false);
  p.gradient(0, P(0, -0.82)[1], p.w, p.h - P(0, -0.82)[1], P(0, -0.82), P(0, -1), 1, 0.66);
  // schwarzes Haar an den Schlaefen unter dem Helmrand / black hair at the temples below the helmet rim
  for (const s of [-1, 1]) {
    const edge = spline([P(s * 0.46, 0.5), P(s * 0.56, 0.36), P(s * 0.62, 0.2), P(s * 0.66, -0.05), P(s * 0.62, -0.4), P(s * 0.56, -0.7)], 6);
    p.fill([...edge, P(s * 0.95, -0.7), P(s * 0.95, 0.5)], HAIR);
    p.mark(edge.slice(4, -2).map((q): Pt => [q[0] + s * lw(2.4), q[1]]), lw(1.4), HAIR_LIGHT, 0.9, { taper: 0.4, wobble: 0.4 });
  }
  if (m.frown > 0.5) wrinkle(p, M, [[0.045, 0.19 + m.browIn(1) * 0.4], [0.06, 0.25], [0.05, 0.3]], lw(1.6));
  for (const s of [-1, 1] as const) {
    drawEye(p, M, s, {
      x: 0.36, y: 0.1, w: 0.17, h: 0.088, tilt: 0.13, upper: 0.26 + m.upper(s), lower: 0.1 + m.lower(s), iris: EYE, irisR: 0.078 * m.iris,
      look: [0, 0.04], crease: 0.03, lid: 4.6, wing: 0.05, lashes: 2, shadow: mix(SKIN, mat.wood, 0.5),
    }, lw);
    drawBrow(p, M, s, { x0: 0.085, y0: 0.215 + m.browIn(s), x1: 0.62, y1: 0.3 + m.browOut(s), arch: 0.03, thick: 0.058, strands: 0, seed: 41 + s }, lw);
  }
  // Schoenheitsfleck unter dem linken Auge (im Bild rechts) / beauty mark below the left eye (right in the picture)
  { const c = P(0.46, -0.035); p.dot(c[0], c[1], lw(1.9)); }
  drawNose(p, M, { y: -0.24, w: 0.85, top: 0.15, shade: 0.84 }, lw);
  drawMouth(p, M, { y: MOUTH.y, w: MOUTH.w, smile: 0.01 + m.smile, asym: m.asym, lipU: 0.046, lipL: 0.062, colour: LIPS, shine: 0, open: m.open * 0.75, line: 2.8 }, lw);
  wrinkle(p, M, [[-0.07, -0.86], [0, -0.875], [0.07, -0.86]], lw(1.2), false);
}

/** Helm (gespiegelt: x = 0 vorn Mitte; t nach Hoehe): Plattenfugen, Goldrand, Lorbeer / helmet (mirrored: x = 0 front centre; t by height): plate joints, gold rim, laurel */
function paintHelmet(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / (Math.PI * HELM.R));
  const X = (a: number) => (Math.abs(a) / Math.PI) * W, Y = (y: number) => helmT(y) * H;
  p.gradient(0, 0, W, Y(0.74), [0, 0], [0, Y(0.74)], 1.04, 0.86);
  // Goldrand entlang der Unterkante / gold rim along the lower edge
  const rim: Pt[] = [], rimTop: Pt[] = [];
  for (let i = 0; i <= 44; i++) { const a = (i / 44) * Math.PI; rim.push([X(a), Y(helmRim(a) + 0.011)]); rimTop.push([X(a), Y(helmRim(a) + 0.024)]); }
  p.mark(rim.map((q): Pt => [q[0], q[1] - lw(2.2)]), lw(10), GOLDF, 1, { taper: 0, wobble: 0.15, press: 0.1 });
  p.line(rimTop.map((q): Pt => [q[0], q[1] - lw(4.4)]), lw(1.4), { taper: 0, wobble: 0.3 });
  p.mark(rim.map((q): Pt => [q[0], q[1] + lw(1.2)]), lw(1.3), GOLD_D, 0.9, { taper: 0.02, wobble: 0.2 });
  // Goldgrat ueber den Scheitel, Goldband um das Ohrstueck / gold ridge over the crown, gold band around the ear piece
  p.band([[3, Y(HELM_TOP) - 4], [3, Y(0.56)]], lw(7), GOLDF, lw(1.2));
  p.mark(arc(X(1.36), Y(0.676), lw(46), lw(46), 0, Math.PI * 2, 30), lw(4), GOLDF, 1, { closed: true, wobble: 0.1 });
  // Plattenfugen der Kuppel / plate joints of the dome
  p.panel(spline([[X(0.42), Y(0.94)], [X(0.5), Y(0.86)], [X(0.56), Y(0.775)]], 5), lw(1.4));
  p.panel(spline([[X(1.25), Y(0.95)], [X(1.3), Y(0.82)], [X(1.27), Y(0.66)]], 5), lw(1.4));
  p.panel(spline([[X(0.56), Y(0.86)], [X(0.9), Y(0.875)], [X(1.27), Y(0.85)]], 5), lw(1.3));
  p.panel(spline([[X(2.1), Y(0.95)], [X(2.2), Y(0.75)], [X(2.15), Y(0.58)]], 5), lw(1.4));
  p.panel(spline([[X(1.27), Y(0.72)], [X(1.8), Y(0.7)], [X(3.14), Y(0.7)]], 5), lw(1.3));
  for (const [a, y] of [[0.64, 0.8], [1.2, 0.79], [1.36, 0.9], [2.2, 0.66]] as [number, number][]) p.rivet(X(a), Y(y), lw(2.1));
  // Lorbeerzweig neben dem Stirnschild / laurel sprig beside the brow shield
  leafBraid(p, spline([[X(0.6), Y(0.8)], [X(0.72), Y(0.86)], [X(0.8), Y(0.925)]], 6), 6, lw(11), lw(5.6), GOLDF, lw(1.1), { spread: 0.62 });
  // Glanz / shine
  p.fill(spline([[X(0.95), Y(0.955)], [X(1.12), Y(0.965)], [X(1.2), Y(0.93)], [X(1.02), Y(0.915)]], 5, true), mat.white, 0.6);
}

/** Stirnschild (Draufsicht): blaues Feld im Goldrahmen, Emblem der Alvenia / brow shield (plan view): blue field in a gold frame, the Alvenia emblem */
function paintCrest(p: Pen): void {
  const W = p.w, c = W / 2, k = W / 0.25, lw = lineScale(k);
  const map = ([x, y]: [number, number], s = 1): Pt => [c + x * s * k, c - (y - 0.008) * s * k - 0.008 * k];
  const inner = CREST.map((q) => map(q, 0.76));
  p.fill(CREST.map((q) => map(q)), GOLDF);
  p.fill(spline([map([0.066, 0.064]), map([0.066, -0.022]), map([0, -0.108]), map([0.02, -0.05]), map([0.05, -0.01])], 4, true), GOLD_D, 0.7);
  p.fill(inner, BLUE);
  p.fill([inner[4], inner[5], inner[6], [c, c]], BLUE_D, 0.7);
  p.line(inner, lw(1.5), { closed: true, wobble: 0.15 });
  p.line(CREST.map((q) => map(q, 0.96)), lw(1.4), { closed: true, wobble: 0.15 });
  paintEmblem(p, 'alvenia', c, c - 0.004 * k, 0.04 * k, FAITH.plate, lw(1.1));
}

/** Wangenklappe (s von der Innen- zur Aussenkante, t vom Helmrand zur Spitze) / cheek guard (s from the inner to the outer edge, t from the helmet rim to the tip) */
function paintCheek(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(H / 0.2);
  p.band([[8, -3], [8, H * 0.94]], 16, GOLDF, lw(1.2));
  p.band([[W - 5, -3], [W - 5, H * 0.6]], 6, GOLDF, lw(1.1));
  p.panel(spline([[W * 0.3, H * 0.2], [W * 0.62, H * 0.27], [W * 0.9, H * 0.24]], 5), lw(1.3));
  p.panel(spline([[W * 0.28, H * 0.5], [W * 0.56, H * 0.56], [W * 0.82, H * 0.52]], 5), lw(1.3));
  for (const [x, y] of [[0.58, 0.14], [0.52, 0.41], [0.42, 0.7]] as [number, number][]) p.rivet(W * x, H * y, lw(2));
  p.shade([[0, H * 0.74], [W, H * 0.66], [W, H], [0, H]], 0.84, 0.9);
}

function paintEarpiece(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.1);
  p.mark(arc(c, c, W * 0.4, W * 0.4, 0, Math.PI * 2, 24), lw(2.4), GOLDF, 1, { closed: true, wobble: 0.1 });
  p.line(arc(c, c, W * 0.4 + lw(1.3), W * 0.4 + lw(1.3), 0, Math.PI * 2, 24), lw(1), { closed: true, wobble: 0.1 });
  p.line(arc(c, c, W * 0.4 - lw(1.3), W * 0.4 - lw(1.3), 0, Math.PI * 2, 24), lw(1), { closed: true, wobble: 0.1 });
  p.dab(c, c, W * 0.3, 0.8, 0.8);
}

/** Haarstraehne (s vom Scheitel zur Spitze, t rundum): Glanz als Flaeche, wenige helle Straehnen / lock of hair (s from the parting to the tip, t around): shine as an area, a few light strands */
function paintHair(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.26);
  p.fill(spline([[W * 0.2, H * 0.3], [W * 0.45, H * 0.24], [W * 0.62, H * 0.3], [W * 0.5, H * 0.4], [W * 0.26, H * 0.42]], 5, true), HAIR_LIGHT, 0.85);
  for (const [x0, y0, x1, y1] of [[0.06, 0.2, 0.86, 0.34], [0.1, 0.56, 0.92, 0.5], [0.2, 0.78, 0.8, 0.66]]) p.mark(spline([[W * x0, H * y0], [W * (x0 + x1) / 2, H * ((y0 + y1) / 2 + 0.04)], [W * x1, H * y1]], 5), lw(1.2), HAIR_LIGHT, 0.9, { taper: 0.42, wobble: 0.4 });
}

/** Halsberge (gespiegelt): Goldrand, gravierte Linie, Mittelnaht / gorget (mirrored): gold rim, engraved line, centre seam */
function paintCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.42);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.82, 1.03);
  p.band([[-4, H - 6], [W + 4, H - 6]], 10, GOLDF, lw(1.3));
  p.band([[-4, 5], [W + 4, 5]], 8, GOLDF, lw(1.3));
  p.panel(spline([[20, 12], [34, H * 0.5], [22, H - 12]], 4), lw(1.3));
  p.panel(spline([[W * 0.5, 12], [W * 0.5 + 6, H * 0.5], [W * 0.5, H - 12]], 4), lw(1.3));
  p.fill([[0, 10], [14, 10], [22, H * 0.5], [14, H - 12], [0, H - 12]], BLUE);
  p.line([[14, 10], [22, H * 0.5], [14, H - 12]], lw(1.3), { taper: 0.05, wobble: 0.15 });
}

function paintBevor(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.14);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.86, 1.02);
  p.line([[W / 2, 2], [W / 2, H - 2]], lw(1.4), { taper: 0.1, wobble: 0.15 });
  p.shade([[W / 2, 0], [W, 0], [W, H], [W / 2, H]], 0.86, 0.9);
  p.band([[-3, H - 5], [W + 3, H - 5]], 7, GOLDF, lw(1.1));
  for (const s of [0.2, 0.8]) p.rivet(W * s, H * 0.34, lw(1.8));
}

/** Umhang (gespiegelt: x = 0 hinten Mitte, x = W Vorderkante; t vom Hals zum Saum) / cape (mirrored: x = 0 back centre, x = W front edge; t from the neck to the hem) */
function paintCape(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.25);
  p.gradient(0, 0, W, H * 0.3, [0, 0], [0, H * 0.3], 0.78, 1);
  // Goldborte an Saum und Vorderkante, innen eine feine Linie / gold trim at hem and front edge, a fine line inside
  p.band([[-4, H - 7], [W + 4, H - 7]], 11, GOLDF, lw(1.3));
  p.band([[W - 6, -4], [W - 6, H + 4]], 10, GOLDF, lw(1.3));
  p.line([[-3, H - 20], [W - 18, H - 20], [W - 18, -3]], lw(1.1), { taper: 0.02, wobble: 0.3 });
  // Lorbeerzweig vorn auf der Schulter / laurel sprig at the front of the shoulder
  leafBraid(p, spline([[W * 0.7, H * 0.68], [W * 0.79, H * 0.56], [W * 0.9, H * 0.52]], 6), 5, 15, 8, GOLDF, lw(1.2), { spread: 0.66 });
  // Falten ueber der Schulter / folds over the shoulder
  fold(p, spline([[W * 0.44, H * 0.12], [W * 0.47, H * 0.5], [W * 0.45, H * 0.84]], 5), lw(1.3), 8, 0.84);
  fold(p, spline([[W * 0.6, H * 0.2], [W * 0.62, H * 0.5], [W * 0.6, H * 0.8]], 5), lw(1.2), -7, 0.86);
  fold(p, spline([[W * 0.2, H * 0.16], [W * 0.22, H * 0.5], [W * 0.2, H * 0.82]], 5), lw(1.2), 7, 0.86);
  p.shade([[W * 0.84, 0], [W, 0], [W, H * 0.26], [W * 0.9, H * 0.2]], 0.8, 0.9);
}

function paintDisc(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.132);
  goldDisc(p, c, c, W * 0.48, lw(1.5), GOLDF);
  p.line(arc(c, c, W * 0.37, W * 0.37, 0, Math.PI * 2, 24), lw(1.2), { closed: true, wobble: 0.1 });
  p.spot(c, c, W * 0.3, GOLD_D);
}

/** Medaillon: Lorbeerkranz um ein blaues Feld (das Kreuz ist modelliert und leuchtet) / medallion: laurel wreath around a blue field (the cross is modelled and glows) */
function paintMedallion(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.14);
  goldDisc(p, c, c, W * 0.49, lw(1.5), GOLD_D);
  for (const s of [-1, 1]) {
    const pth = arc(c, c, W * 0.395, W * 0.395, Math.PI / 2 + s * 0.2, Math.PI / 2 + s * 2.75, 16);
    leafBraid(p, pth, 7, lw(7), lw(4), GOLD_L, lw(1), { spread: 0.7, stem: false });
  }
  p.spot(c, c, W * 0.3, BLUE);
  p.fill(arc(c, c, W * 0.3, W * 0.3, 0.2, Math.PI - 0.2, 14), BLUE_D, 0.8);
  p.line(arc(c, c, W * 0.3, W * 0.3, 0, Math.PI * 2, 24), lw(1.4), { closed: true, wobble: 0.1 });
}
function paintStar4(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.236);
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * Math.PI * 2, a1 = a + Math.PI / 4;
    const tip: Pt = [c + Math.cos(a) * W * 0.5, c + Math.sin(a) * W * 0.5], notch: Pt = [c + Math.cos(a1) * W * 0.19, c + Math.sin(a1) * W * 0.19];
    p.shade([[c, c], tip, notch], 0.68, 0.95);
    p.line([[c, c], tip], lw(1.2), { taper: 0.1, wobble: 0.1 });
  }
}

function paintChest(p: Pen): void {
  const C = chestMap(T, p.w, p.h), P = C.P, u = C.u, lw = lineScale(u(1));
  p.gradient(0, P(0, 0.11)[1], p.w, p.h - P(0, 0.11)[1], P(0, 0.11), P(0, 0), 1, 0.8);
  // Schatten des Umhangs und des Medaillons / shade of the cape and of the medallion
  for (const s of [-1, 1]) p.shade(spline([P(s * 0.02, 0.225), P(s * 0.16, 0.14), P(s * 0.3, 0.1), P(s * 0.46, 0.09)], 6).concat([P(s * 0.46, 0.2), P(s * 0.1, 0.3)]), 0.66, 0.9);
  { const c = P(0.008, MEDAL[1] - 0.014); p.fill(starPts(c[0], c[1], 4, u(0.125), u(0.05)), mat.ink, 0.36); }
  // Wappenrock: weisse Bahnen mit Goldkante, dazwischen das Blau / tabard: white panels with gold edges, the blue between
  for (const s of [-1, 1]) {
    const band: Pt[] = [P(s * 0.055, 0.2), P(s * 0.125, 0.19), P(s * 0.13, -0.01), P(s * 0.06, -0.01)];
    p.fill(band, WHITE);
    p.line(band, lw(1.5), { closed: true, wobble: 0.2 });
    p.band([P(s * 0.062, 0.185), P(s * 0.066, -0.01)], u(0.008), GOLDF, lw(1));
    p.band([P(s * 0.123, 0.18), P(s * 0.126, -0.01)], u(0.008), GOLDF, lw(1));
    const far: Pt[] = [P(s * 0.3, 0.14), P(s * 0.37, 0.12), P(s * 0.385, -0.01), P(s * 0.31, -0.01)];
    p.fill(far, WHITE);
    p.line(far, lw(1.5), { closed: true, wobble: 0.2 });
    p.band([P(s * 0.31, 0.13), P(s * 0.318, -0.01)], u(0.008), GOLDF, lw(1));
    // vierzackiger Stern auf dem Blau / four-pointed star on the blue
    const c = P(s * 0.215, 0.07);
    patch(p, starPts(c[0], c[1], 4, u(0.036), u(0.01)), FAITH.plate, lw(1.2));
    p.line(spline([P(s * 0.17, 0.15), P(s * 0.18, 0.05), P(s * 0.175, -0.01)], 4), lw(1.1), { taper: 0.3, wobble: 0.3 });
  }
  // blaues V ueber dem Medaillon mit Goldlinien / blue V above the medallion with gold lines
  for (const s of [-1, 1]) p.band(spline([P(s * 0.012, 0.3), P(s * 0.03, 0.34), P(s * 0.075, 0.39)], 5), u(0.008), GOLDF, lw(1));
  p.band([P(0, 0.12), P(0, -0.01)], u(0.014), GOLDF, lw(1.2));
}

function cells(m: MoodArt): Cell[] {
  return [
    { name: 'face', w: 512, h: 512, paint: (p) => paintFace(p, m) },
    { name: 'helmet', w: 432, h: 256, paint: paintHelmet },
    { name: 'crest', w: 208, h: 208, paint: paintCrest },
    { name: 'cheek', w: 112, h: 224, paint: paintCheek },
    { name: 'hair', w: 224, h: 96, paint: paintHair },
    { name: 'cape', w: 464, h: 176, paint: paintCape },
    { name: 'chest', w: 640, h: 272, paint: paintChest },
    ...bodyCells({ plain: true }).filter((c) => c.name !== 'ear'),
    { name: 'collar', w: 256, h: 72, paint: paintCollar },
    { name: 'bevor', w: 128, h: 80, paint: paintBevor },
    { name: 'earpiece', w: 80, h: 80, paint: paintEarpiece },
    { name: 'disc', w: 96, h: 96, paint: paintDisc },
    { name: 'medallion', w: 128, h: 128, paint: paintMedallion },
    { name: 'star4', w: 128, h: 128, paint: paintStar4 },
  ];
}

export const alvenia: LeaderDef = { cells, build, glow: [FAITH.halo, FAITH.tech], side: 1 };
