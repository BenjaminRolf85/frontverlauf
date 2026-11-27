/**
 * Gezeichneter Anfuehrer der Velkar: der Chefwissenschaftler.
 * Inked leader of the Velkar: the chief scientist.
 *
 * Vorlage ist das Portraet des Spiels (public/leaders/img/velkar_neutral.webp): hagerer alter Forscher mit wild
 * abstehenden weissen Haarzacken, Messing-Schutzbrille mit gruenen Glaesern auf der Stirn, Messing-Kopfhoerern mit
 * gruenem Leuchtring, gruenen Augen, schiefem Laecheln und langem spitzem Kinnbart; weisser Laborkittel mit gruener
 * Kante, dunkelgruener Rollkragen mit Messingknoepfen, auf der Brust die Platte mit dem leuchtenden Sechseck (Emblem der
 * Fraktion), dazu Ausweis und Stifte in der Brusttasche.
 * The model is the game's portrait (public/leaders/img/velkar_neutral.webp): a gaunt old researcher with wild white
 * spikes of hair, brass goggles with green lenses on the forehead, brass headphones with a green light ring, green
 * eyes, a crooked smile and a long pointed goatee; a white lab coat with a green edge, a dark green turtleneck with
 * brass buttons, on the chest the plate with the glowing hexagon (the faction's emblem), plus an ID card and pens in
 * the breast pocket.
 */
import * as THREE from 'three';
import { fine, mix, rng, shade, type V3 } from '../kit';
import { look, mat } from '../look';
import { Sculpt } from '../sculpt';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { aimZ } from './figkit';
import { chestAt, chestMap, faceMap, gemDome, headGeometry, ngon, onFace, polyPlate, revolve, scalpMap, stud, torsoGeometry, torsoShell, tube, type TorsoSpec } from './leaderKit';
import type { LeaderDef } from './leaders';
import { bodyCells, drawBrow, drawEye, drawMouth, drawNose, fold, goldDisc, lineScale, shadow, wrinkle, type MoodArt } from './leaderPaint';
import { loft, type AtlasLayout, type UvBuilder } from './uvkit';

const L = look('velkar');
const SKIN = shade(mix(mat.skin, mat.orange, 0.18), 0.98);
const HAIR = mix(mat.snow, mat.concrete, 0.34);
const HAIR_DARK = mix(mat.snow, mat.concrete, 0.85);
const COAT = mix(mat.white, L.primary, 0.14);
const VEST = shade(mix(L.secondary, mat.leafDark, 0.6), 0.34);
/** Leuchtgruen der Glaeser und des Sechsecks / glowing green of the lenses and the hexagon */
const GLOW = L.secondary;
const TRIM = shade(L.secondary, 0.74);
const BRASS = mix(mat.gold, mat.wood, 0.3);
const BRASS_DARK = shade(BRASS, 0.6);
const BRASS_LIGHT = mix(BRASS, mat.white, 0.55);

const T: TorsoSpec = { w: 0.43, d: 0.21, h: 0.335, slope: 0.1, neckR: 0.1, rise: 0.055, square: 0.26, z: -0.01, chest: 0.012 };
const HEAD_C: V3 = [0, 0.66, 0.03], HEAD_R: V3 = [0.162, 0.196, 0.168];
const MOUTH = { y: -0.56, w: 0.22 };

function sculpt(m: MoodArt): Sculpt {
  return new Sculpt(HEAD_C, HEAD_R, {
    jaw: 0.3, chin: 0.22, chinDown: 0.1 + m.open * 0.05, lowY: 0.1 + m.open * 0.07, crown: 0.14, socket: 0.09, brow: 0.1, cheek: 0.06, hollow: 0.05, temple: 0.07,
    noseBridge: 0.13, noseLen: 0.38, noseW: 0.95, noseY: -0.25, lipU: 0.02, lipL: 0.03, mouthDepth: 0.014 + 0.035 * m.open, mouthW: MOUTH.w * 2, mouthY: MOUTH.y,
    smile: 0.035 + m.smile, asym: 0.03 + m.asym, fold: 0.03, eyeY: 0.1, eyeX: 0.36, flat: 0.1, ageGeo: 0.6, frownGeo: 0.3 + m.frown,
  });
}

// ---------- Aufbau / build ----------

const HEX: [number, number] = [0, 0.135];

function build(b: UvBuilder, A: AtlasLayout, m: MoodArt): void {
  const S = sculpt(m);
  b.add(torsoGeometry(T, { chest: A.get('chest'), back: A.get('back'), side: A.get('side'), top: A.get('top'), blank: A.get('blank') }, VEST), null, { crease: 0.6 });
  b.add(loft([{ y: 0.6, rx: 0.07, cz: 0.0, c: SKIN }, { y: 0.48, rx: 0.074, cz: -0.004 }, { y: 0.33, rx: 0.088, cz: -0.01 }], { seg: fine() ? 28 : 14, region: A.get('neck') }), null, { crease: 0 });
  // Rollkragen / turtleneck
  const collar: [number, number][] = [[0.128, 0.335], [0.118, 0.39], [0.108, 0.445], [0.098, 0.452], [0.088, 0.44], [0.084, 0.4]];
  const CO = { centre: [0, -0.006] as [number, number], front: 0.98, tilt: () => 0.1, pivot: [0.4, 0] as [number, number] };
  b.add(revolve(collar, { ...CO, seg: fine() ? 44 : 22, sub: 2, region: A.get('collar'), mirror: true, color: VEST }), null, { crease: 0.5 });

  // Laborkittel: Schale um den Oberkoerper, vorn offen / lab coat: shell around the torso, open at the front
  b.add(torsoShell(T, (u, v) => {
    const g = 0.5 + 0.36 * Math.pow(v, 2.2) - 0.06 * Math.sin(Math.PI * v);
    const a = Math.PI / 2 + g + (2 * Math.PI - 2 * g) * u;
    return [a, 0.985 * v, 0.016 + 0.01 * Math.sin(Math.PI * Math.min(1, v * 1.4))];
  }, {
    nu: fine() ? 72 : 36, nv: fine() ? 18 : 9, region: A.get('coat'), back: A.get('blank'), thick: 0.014, flip: true, color: COAT, backColor: shade(COAT, 0.6),
    st: (u, v) => [Math.abs(2 * u - 1), 1 - v],
  }), null, { crease: 0.8 });

  // Brustplatte mit dem leuchtenden Sechseck, darueber die Halteplatte, zwei Messingknoepfe
  // chest plate with the glowing hexagon, the mounting plate above it, two brass buttons
  {
    const q = chestAt(T, HEX[0], HEX[1]);
    b.group({ p: [q.p.x, q.p.y, q.p.z], r: aimZ([q.n.x, q.n.y, q.n.z]) }, () => {
      b.add(polyPlate(ngon(6, 0.082), 0.012, A.get('hex'), BRASS, BRASS_DARK), null, { gloss: 0.5, crease: 1 });
      b.add(polyPlate(ngon(6, 0.047), 0.02, A.get('blank'), GLOW), null, { crease: 0.7 });
      b.add(polyPlate([[-0.07, 0.092], [0.07, 0.092], [0.085, 0.155], [-0.085, 0.155]], 0.009, A.get('mount'), BRASS, BRASS_DARK), null, { gloss: 0.5, crease: 1 });
    });
    for (const s of [-1, 1]) { const c = chestAt(T, s * 0.052, HEX[1] + 0.125); stud(b, A, c.p.clone().addScaledVector(c.n, 0.009), c.n, 0.012, 0.006, 'button', BRASS); }
    for (const s of [-1, 1]) { const c = chestAt(T, s * 0.04, 0.305); stud(b, A, c.p, c.n, 0.014, 0.006, 'button', BRASS); }
  }
  // Ausweis an der rechten Brust (im Bild links), Stifte in der linken Brusttasche / ID card on the right chest (left in the picture), pens in the left breast pocket
  {
    const q = chestAt(T, -0.275, 0.1), n = q.n;
    b.group({ p: [q.p.x + n.x * 0.036, q.p.y, q.p.z + n.z * 0.036], r: aimZ([n.x, n.y, n.z]) }, () => {
      b.add(polyPlate([[-0.045, -0.058], [0.045, -0.058], [0.045, 0.05], [-0.045, 0.05]], 0.006, A.get('badge'), mat.paper, shade(mat.paper, 0.6)), null, { crease: 1 });
      b.add(polyPlate([[-0.014, 0.046], [0.014, 0.046], [0.014, 0.078], [-0.014, 0.078]], 0.01, A.get('blank'), BRASS, BRASS_DARK), null, { gloss: 0.5, crease: 1 });
    });
    const pens: [number, THREE.Color][] = [[0.262, mat.teal], [0.292, mat.orange], [0.322, TRIM]];
    for (const [x, c] of pens) {
      const pq = chestAt(T, x, 0.1), o = pq.n.clone().multiplyScalar(0.036);
      const a: V3 = [pq.p.x + o.x, 0.1, pq.p.z + o.z], top: V3 = [pq.p.x + o.x, 0.2 - (x - 0.262) * 0.3, pq.p.z + o.z + 0.004];
      b.add(tube([a, top], (t) => (t > 0.88 ? 0.0085 * (1 - (t - 0.88) / 0.14) : 0.0085), { seg: 6, samples: 5, region: A.get('blank'), color: (t) => (t > 0.55 ? c : shade(c, 0.6)) }), null, { gloss: 0.5, crease: 0.5 });
    }
  }

  b.add(headGeometry(S, { skin: SKIN, face: A.get('face'), scalp: A.get('scalp') }), null, { crease: 0 });
  // Haarzacken: zwei Faecher, der hintere groesser / spikes of hair: two fans, the rear one larger
  {
    const R = rng(907);
    const c = new THREE.Vector3(...HEAD_C);
    const spike = (ang: number, z: number, len: number, w: number) => {
      const dir = new THREE.Vector3(Math.sin(ang), Math.cos(ang) * 0.92 + 0.12, z).normalize();
      const base = new THREE.Vector3(...S.dir([dir.x, dir.y, dir.z], -0.06));
      const bendV = new THREE.Vector3(Math.cos(ang), -Math.sin(ang), 0).multiplyScalar((R() - 0.5) * 0.05);
      const mid = base.clone().addScaledVector(dir, len * 0.5).add(bendV), tip = base.clone().addScaledVector(dir, len).addScaledVector(bendV, 0.4);
      const side = new THREE.Vector3(0, 0, 1);
      b.add(tube([[base.x, base.y, base.z], [mid.x, mid.y, mid.z], [tip.x, tip.y, tip.z]], (t) => [0.002 + 0.028 * (1 - t) ** 0.8, 0.002 + w * (1 - t) ** 0.9 * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 2.5)))],
        { seg: fine() ? 8 : 6, samples: fine() ? 8 : 4, region: A.get('spike'), out: [side.x, side.y, side.z + (z < 0 ? -0.2 : 0)], front: true, color: (t) => mix(HAIR_DARK, HAIR, Math.min(1, t * 2.2)) }), null, { crease: 0.7 });
      void c;
    };
    const rear = 11, front = 8;
    for (let i = 0; i < rear; i++) { const a = -2.02 + (i / (rear - 1)) * 4.04; spike(a + (R() - 0.5) * 0.08, -0.42, 0.25 + R() * 0.07 - 0.05 * Math.abs(a) / 2, 0.062); }
    for (let i = 0; i < front; i++) { const a = -1.75 + (i / (front - 1)) * 3.5; if (Math.abs(a) < 0.5) continue; spike(a + (R() - 0.5) * 0.1, -0.05, 0.17 + R() * 0.05, 0.05); }
    for (const a of [-0.34, 0.02, 0.38]) spike(a, -0.2, 0.2 + R() * 0.04, 0.055);
  }
  // Kinnbart: lang und spitz / goatee: long and pointed
  {
    const p0 = onFace(S, 0, -0.84, 0.0), p1 = onFace(S, 0, -1.02, 0.03);
    b.add(tube([[p0.x, p0.y + 0.01, p0.z - 0.01], [p1.x, p1.y, p1.z + 0.01], [0.004, 0.345, 0.168], [0.008, 0.25, 0.19]], (t) => { const k = Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.62)) * (1 - Math.pow(t, 2.2)); return [0.002 + 0.03 * k, 0.002 + 0.044 * k]; },
      { seg: fine() ? 10 : 6, samples: fine() ? 16 : 8, region: A.get('beard'), out: [0, 0.15, 1], front: true, color: HAIR }), null, { crease: 0.5 });
  }
  // Schutzbrille auf der Stirn: Lederband, zwei Messingtoepfe mit gruenem Glas, Steg / goggles on the forehead: leather band, two brass cups with green glass, bridge
  {
    const band: V3[] = [];
    for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI * 2, y = 0.73 + 0.07 * Math.cos(a); const c2 = Math.sqrt(1 - y * y); band.push(S.dir([Math.sin(a) * c2, y, Math.cos(a) * c2], 0.03)); }
    b.add(tube(band, () => [0.008, 0.024], { seg: 6, samples: fine() ? 40 : 20, region: A.get('blank'), out: (t) => { const a = t * Math.PI * 2; return new THREE.Vector3(Math.sin(a), 0.4, Math.cos(a)); }, color: shade(mat.wood, 0.7) }), null, { crease: 0.6 });
    const n0 = new THREE.Vector3(0, 0.62, 1).normalize();
    for (const s of [-1, 1]) {
      const p0 = new THREE.Vector3(...S.dir([s * 0.36, 0.8, 0.5], 0.03)), n = n0.clone().add(new THREE.Vector3(s * 0.22, 0, 0)).normalize();
      b.add(loft([{ y: 0, rx: 0.064, c: BRASS }, { y: 0.046, rx: 0.06, hard: true }, { y: 0.05, rx: 0.05, hard: true }, { y: 0.04, rx: 0.048 }], { seg: fine() ? 20 : 12, region: A.get('blank'), arc: true }), null, { gloss: 0.6, crease: 0.9, xf: { p: [p0.x - n.x * 0.012, p0.y - n.y * 0.012, p0.z - n.z * 0.012], r: aimY(n) } });
      stud(b, A, p0.clone().addScaledVector(n, 0.03), n, 0.049, 0.004, 'lens', GLOW, 0.15, 18);
    }
    const mid = new THREE.Vector3(...S.dir([0, 0.82, 0.57], 0.05));
    b.add(polyPlate([[-0.022, -0.02], [0.022, -0.02], [0.022, 0.02], [-0.022, 0.02]], 0.03, A.get('blank'), BRASS, BRASS_DARK), null, { gloss: 0.6, crease: 1, xf: { p: [mid.x, mid.y, mid.z - 0.006], r: aimZ([n0.x, n0.y, n0.z]) } });
  }
  // Kopfhoerer: Messingschalen mit gruenem Leuchtring, Buegel ueber den Scheitel / headphones: brass cups with a green light ring, band over the crown
  b.mirrorX(() => {
    const at = new THREE.Vector3(...S.dir([1, -0.04, -0.02], 0.0)), nx = new THREE.Vector3(1, 0, 0.16).normalize();
    stud(b, A, at.clone().addScaledVector(nx, -0.006), nx, 0.078, 0.034, 'earcup', BRASS, 0.6, 20);
    gemDome(b, A, at.clone().addScaledVector(nx, 0.034), nx, 0.03, 0.012, GLOW, 1);
  });
  {
    const arcPts: V3[] = [];
    for (let i = 0; i <= 12; i++) { const a = -1.5 + (i / 12) * 3; arcPts.push(S.dir([Math.sin(a), Math.cos(a), -0.06], 0.035)); }
    b.add(tube(arcPts, () => [0.009, 0.02], { seg: 6, samples: fine() ? 28 : 14, region: A.get('blank'), out: (t) => { const a = -1.5 + t * 3; return new THREE.Vector3(Math.sin(a), Math.cos(a), 0); }, color: BRASS }), null, { gloss: 0.5, crease: 0.6 });
  }
}
/** Rotations-Euler, der +y auf n dreht / Euler rotation turning +y onto n */
function aimY(n: THREE.Vector3): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

// ---------- Zeichnung / drawing ----------

function paintFace(p: Pen, m: MoodArt): void {
  const M = faceMap(p.w, p.h), P = M.P, lw = lineScale(M.u(1) / HEAD_R[0]);
  // Schatten der Brille auf der Stirn, hohle Wangen, Schlaefen / shade of the goggles on the forehead, hollow cheeks, temples
  p.shade(spline([P(-0.8, 0.5), P(-0.4, 0.6), P(0, 0.62), P(0.4, 0.6), P(0.8, 0.5)], 6).concat([P(0.95, 0.95), P(-0.95, 0.95)]), 0.74, 0.95);
  shadow(p, M, [[0.36, -0.12], [0.52, -0.04], [0.6, -0.26], [0.5, -0.52], [0.34, -0.8], [0.28, -0.55], [0.3, -0.3]], 0.8, 0.9, false);
  shadow(p, M, [[-0.42, -0.16], [-0.54, -0.08], [-0.6, -0.3], [-0.5, -0.54], [-0.38, -0.72], [-0.36, -0.4]], 0.87, 0.9, false);
  shadow(p, M, [[0.09, 0.195], [0.3, 0.235], [0.56, 0.21], [0.62, 0.12], [0.5, 0.17], [0.3, 0.185], [0.13, 0.14]], 0.76, 0.9);
  shadow(p, M, [[0.62, 0.4], [0.72, 0.2], [0.7, -0.05], [0.9, -0.05], [0.9, 0.4]], 0.82, 0.9);
  for (const s of [-1, 1]) { const c = P(s * 0.42, -0.14); p.dab(c[0], c[1], M.u(0.13), [1.07, 0.85, 0.8], 0.45); }
  { const c = P(0, -0.22); p.dab(c[0], c[1], M.u(0.09), [1.07, 0.85, 0.8], 0.45); }
  shadow(p, M, [[-0.14, -0.69], [0, -0.705], [0.14, -0.69], [0.1, -0.75], [0, -0.765], [-0.1, -0.75]], 0.8, 0.9, false);
  // graue Koteletten und Schlaefen / grey sideburns and temples
  for (const s of [-1, 1]) {
    const inner: Pt[] = [P(s * 0.6, 0.7), P(s * 0.68, 0.45), P(s * 0.74, 0.2), P(s * 0.79, 0.0), P(s * 0.8, -0.24), P(s * 0.84, -0.3)];
    p.fill([...spline(inner, 5), P(s * 0.95, -0.3), P(s * 0.95, 0.7)], HAIR_DARK);
    p.line(spline(inner, 5), lw(1.6), { taper: 0.2, wobble: 0.6, press: 0.3 });
  }
  // Stirnfalten, Zornesfalten, Kraehenfuesse, Lachfalten / forehead lines, frown lines, crow's feet, smile lines
  const fw = lw(1.3 + 0.7 * m.forehead);
  for (const [y, w] of [[0.36, 0.3], [0.43, 0.4], [0.5, 0.36]] as [number, number][]) wrinkle(p, M, [[-w, y + 0.014], [-w * 0.4, y - 0.01], [0, y + 0.004], [w * 0.4, y - 0.01], [w, y + 0.014]], fw, false);
  wrinkle(p, M, [[0.05, 0.19 + m.browIn(1) * 0.5], [0.066, 0.25], [0.055, 0.31]], lw(1.4 + 1.2 * m.frown));
  for (const s of [-1, 1] as const) {
    drawEye(p, M, s, {
      x: 0.36, y: 0.1, w: 0.15, h: 0.076, tilt: 0.04, upper: 0.28 + m.upper(s), lower: 0.18 + m.lower(s), iris: mat.green, irisR: 0.068 * m.iris,
      look: [0, 0.03], crease: 0.036, bag: 0.8, lid: 3.6,
    }, lw);
    drawBrow(p, M, s, { x0: 0.08, y0: 0.2 + m.browIn(s), x1: 0.64, y1: 0.335 + m.browOut(s) + (s > 0 ? 0.03 : 0), arch: 0.018, thick: 0.075, colour: HAIR_DARK, strands: 4, wild: 0.6, seed: 71 + s }, lw);
  }
  for (const [x1, y1] of [[0.64, 0.15], [0.65, 0.06]] as [number, number][]) wrinkle(p, M, [[0.55, 0.1], [(0.55 + x1) / 2, (0.1 + y1) / 2 + 0.006], [x1, y1]], lw(1.2));
  wrinkle(p, M, [[0.24, -0.05], [0.37, -0.08], [0.5, -0.05]], lw(1.1));
  wrinkle(p, M, [[0.18, -0.2], [0.3, -0.3], [0.38, -0.45], [0.36, -0.58]], lw(1.9));
  wrinkle(p, M, [[0.5, -0.1], [0.56, -0.25], [0.5, -0.45]], lw(1.3));
  drawNose(p, M, { y: -0.25, w: 0.95, top: 0.16, shade: 0.8 }, lw);
  drawMouth(p, M, { y: MOUTH.y, w: MOUTH.w, smile: 0.035 + m.smile, asym: 0.03 + m.asym, lipU: 0.022, lipL: 0.04, tint: [1, 0.82, 0.78], open: m.open * 0.8, line: 2.8 }, lw);
  // Gruebchen am gehobenen Mundwinkel / dimple at the raised corner of the mouth
  wrinkle(p, M, [[MOUTH.w + 0.04, MOUTH.y + 0.1], [MOUTH.w + 0.07, MOUTH.y + 0.04], [MOUTH.w + 0.05, MOUTH.y - 0.04]], lw(1.5), false);
}

function paintScalp(p: Pen): void {
  const B = scalpMap(p.w, p.h), lw = lineScale((p.w / 4.36) / HEAD_R[0]);
  p.fill([[-6, -6], [p.w + 6, -6], [p.w + 6, p.h + 6], [-6, p.h + 6]], HAIR_DARK);
  for (let i = 0; i < 9; i++) {
    const a = -1.8 + (i / 8) * 3.6;
    const pts: Pt[] = [];
    for (const y of [0.5, 0.2, -0.1, -0.4]) { const c = Math.sqrt(1 - y * y); pts.push(B(Math.sin(a + y * 0.1) * c, y, -Math.cos(a + y * 0.1) * c)); }
    p.line(spline(pts, 4), lw(1.2), { taper: 0.42, wobble: 0.5 });
  }
}

/** Haarzacke (s vom Ansatz zur Spitze, t quer): Mittelgrat, Schattenseite, zwei Straehnen / spike of hair (s from the root to the tip, t across): centre ridge, shadow side, two strands */
function paintSpike(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.25);
  p.shade([[0, H * 0.56], [W, H * 0.5], [W, H + 2], [0, H + 2]], 0.8, 0.95);
  p.line(spline([[W * 0.04, H * 0.52], [W * 0.5, H * 0.47], [W * 0.92, H * 0.5]], 4), lw(1.3), { taper: 0.4, wobble: 0.3 });
  p.line(spline([[W * 0.02, H * 0.24], [W * 0.3, H * 0.3], [W * 0.52, H * 0.4]], 4), lw(1.1), { taper: 0.44, wobble: 0.3 });
  p.line(spline([[W * 0.06, H * 0.8], [W * 0.26, H * 0.72], [W * 0.42, H * 0.62]], 4), lw(1.1), { taper: 0.44, wobble: 0.3 });
}
function paintBeard(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.28);
  p.shade([[0, H * 0.64], [W, H * 0.56], [W, H + 2], [0, H + 2]], 0.78, 0.95);
  for (const [x0, y0, x1, y1, w] of [[0.04, 0.22, 0.7, 0.38, 1.4], [0.1, 0.5, 0.92, 0.5, 1.7], [0.06, 0.78, 0.66, 0.62, 1.3], [0.4, 0.3, 0.86, 0.44, 1.1]]) p.line(spline([[W * x0, H * y0], [W * (x0 + x1) / 2, H * ((y0 + y1) / 2 + 0.03)], [W * x1, H * y1]], 5), lw(w), { taper: 0.44, wobble: 0.5, press: 0.35 });
}

function paintLens(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.098);
  p.fill(arc(c, c, W * 0.5, W * 0.5, 0.2, Math.PI - 0.5, 14), shade(GLOW, 0.6));
  p.fill(spline([[W * 0.2, W * 0.38], [W * 0.3, W * 0.2], [W * 0.5, W * 0.14], [W * 0.46, W * 0.26], [W * 0.32, W * 0.36], [W * 0.27, W * 0.5]], 5, true), mat.white, 0.9);
  p.spot(W * 0.68, W * 0.7, W * 0.05, mat.white, 0.9);
  p.line(arc(c, c, W * 0.47, W * 0.47, 0, Math.PI * 2, 26), lw(1.5), { closed: true, wobble: 0.1 });
}
function paintEarcup(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.156);
  goldDisc(p, c, c, W * 0.48, lw(1.5), BRASS);
  p.mark(arc(c, c, W * 0.33, W * 0.33, 0, Math.PI * 2, 30), lw(4.4), GLOW, 1, { closed: true, wobble: 0.1, press: 0.1 });
  p.line(arc(c, c, W * 0.33 + lw(2.3), W * 0.33 + lw(2.3), 0, Math.PI * 2, 30), lw(1.1), { closed: true, wobble: 0.1 });
  p.line(arc(c, c, W * 0.33 - lw(2.3), W * 0.33 - lw(2.3), 0, Math.PI * 2, 30), lw(1.1), { closed: true, wobble: 0.1 });
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * Math.PI * 2; p.dot(c + Math.cos(a) * W * 0.42, c + Math.sin(a) * W * 0.42, lw(1.2)); }
}

/** Sechseckplatte: Fase, Schrauben in den Ecken (die Mitte leuchtet als eigenes Teil) / hexagon plate: bevel, screws in the corners (the centre glows as a part of its own) */
function paintHex(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.164);
  const hex = (r: number): Pt[] => Array.from({ length: 6 }, (_, i): Pt => { const a = -Math.PI / 2 + (i / 6) * Math.PI * 2; return [c + Math.cos(a) * r, c + Math.sin(a) * r]; });
  p.fill([hex(W * 0.5)[1], hex(W * 0.5)[2], hex(W * 0.5)[3], hex(W * 0.36)[3], hex(W * 0.36)[2], hex(W * 0.36)[1]], BRASS_DARK, 0.8);
  p.fill([hex(W * 0.5)[4], hex(W * 0.5)[5], hex(W * 0.5)[0], hex(W * 0.36)[0], hex(W * 0.36)[5], hex(W * 0.36)[4]], BRASS_LIGHT, 0.7);
  p.line(hex(W * 0.36), lw(1.4), { closed: true, wobble: 0.1 });
  p.fill(hex(W * 0.33), shade(VEST, 0.6));
  hex(W * 0.43).forEach((q) => p.rivet(q[0], q[1], lw(1.8)));
}
function paintMount(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.31);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.2, 0.8);
  p.line(rrect(W * 0.3, H * 0.24, W * 0.4, H * 0.5, 4), lw(1.2), { closed: true, wobble: 0.1 });
}
function paintButton(p: Pen): void {
  const c = p.w / 2, lw = lineScale(p.w / 0.03);
  goldDisc(p, c, c, p.w * 0.47, lw(1.3), BRASS);
  p.line([[c - p.w * 0.2, c], [c + p.w * 0.2, c]], lw(1.2), { taper: 0, wobble: 0 });
}
/** Ausweis: Bildfeld, Namenszeile, Zeilen, Strichfeld / ID card: picture field, name line, lines, bar field */
function paintBadge(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.09);
  p.fill([[0, 0], [W, 0], [W, H * 0.16], [0, H * 0.16]], TRIM);
  p.fill(rrect(W * 0.1, H * 0.24, W * 0.36, H * 0.4, 3), mix(VEST, mat.paper, 0.2));
  p.line(rrect(W * 0.1, H * 0.24, W * 0.36, H * 0.4, 3), lw(1.1), { closed: true, wobble: 0.1 });
  // Umriss eines Kopfes im Bildfeld / outline of a head in the picture field
  p.spot(W * 0.28, H * 0.39, W * 0.075, mat.paper);
  p.fill(arc(W * 0.28, H * 0.62, W * 0.13, H * 0.14, Math.PI, Math.PI * 2, 10), mat.paper);
  for (const [y, w] of [[0.28, 0.34], [0.38, 0.26], [0.48, 0.3], [0.58, 0.2]] as [number, number][]) p.line([[W * 0.56, H * y], [W * (0.56 + w), H * y]], lw(1.4), { taper: 0.05, wobble: 0.1 });
  p.fill(rrect(W * 0.1, H * 0.74, W * 0.8, H * 0.14, 2), mix(GLOW, mat.paper, 0.3));
  p.line([[1, 1], [W - 1, 1], [W - 1, H - 1], [1, H - 1]], lw(1.4), { closed: true, wobble: 0.15 });
}

/** Rollkragen (gespiegelt): wenige Rippen als Falten / turtleneck (mirrored): a few ribs as folds */
function paintCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.38);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.8, 1.1);
  for (const x of [0.12, 0.36, 0.6, 0.86]) p.crease(spline([[W * x, H * 0.06], [W * x + 3, H * 0.5], [W * x, H * 0.66]], 4), lw(1.6), 1.7, 0.8, { taper: 0.35 });
  p.crease([[-3, H * 0.7], [W + 3, H * 0.7]], lw(1.5), 0.6, 0.9, { taper: 0, wobble: 0.3 });
}

/** Kittel (gespiegelt: x = 0 hinten Mitte, x = W Vorderkante, die Seitennaht liegt bei 0.6 W; t vom Hals zum Saum): gruene Kante, Revers, Tasche / coat (mirrored: x = 0 back centre, x = W front edge, the side seam lies at 0.6 W; t from the neck to the hem): green edge, lapel, pocket */
function paintCoat(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 1.25);
  p.gradient(0, H * 0.62, W, H * 0.38, [0, H * 0.62], [0, H], 1, 0.84);
  p.shade([[0, 0], [W, 0], [W, H * 0.08], [0, H * 0.14]], 0.84, 0.9);
  // gruene Kante entlang der Vorderkante, Revers als helle Flaeche mit Kerbe / green edge along the front edge, the lapel as a light area with a notch
  p.band([[W - 5, -4], [W - 5, H + 4]], 9, TRIM, lw(1.3));
  const lapel: Pt[] = [[W - 10, H * 0.03], [W * 0.88, H * 0.12], [W * 0.86, H * 0.32], [W * 0.9, H * 0.36], [W * 0.88, H * 0.44], [W - 10, H * 0.7]];
  p.shade(lapel, 0.9, 0.9);
  p.line(lapel, lw(1.6), { taper: 0.05, wobble: 0.3 });
  p.band(lapel.slice(1), 5, TRIM, lw(1));
  // Brusttasche unter den Stiften, Seitennaht, Falte am Arm, Rueckennaht / breast pocket below the pens, side seam, fold at the arm, back seam
  const x0 = W * 0.7, x1 = W * 0.92, y0 = H * 0.72;
  p.line([[x0, y0], [x1, y0]], lw(1.5), { taper: 0.05, wobble: 0.3 });
  p.stitch([[x0 + 3, y0 + 6], [x1 - 3, y0 + 6]], 4, 3.2, 1, 0.62);
  p.line([[x0, y0], [x0 + 2, H + 3]], lw(1.2), { taper: 0.1, wobble: 0.3 });
  p.line(spline([[W * 0.6, H * 0.34], [W * 0.59, H * 0.66], [W * 0.6, H]], 4), lw(1.4), { taper: 0.1, wobble: 0.4 });
  fold(p, spline([[W * 0.64, H * 0.56], [W * 0.68, H * 0.6], [W * 0.72, H * 0.58]], 4), lw(1.2), 5, 0.86);
  p.line([[W * 0.01, H * 0.2], [W * 0.01, H]], lw(1.3), { taper: 0.1, wobble: 0.3 });
}

function paintChest(p: Pen): void {
  const C = chestMap(T, p.w, p.h), P = C.P, u = C.u, lw = lineScale(u(1));
  const top = T.h + T.rise;
  p.gradient(0, P(0, 0.11)[1], p.w, p.h - P(0, 0.11)[1], P(0, 0.11), P(0, 0), 1, 0.8);
  p.shade(spline([P(-0.2, top), P(-0.14, 0.33), P(0, 0.31), P(0.14, 0.33), P(0.2, top)], 6), 0.72, 0.9);
  // Schatten des Kittels an beiden Seiten der Weste / shade of the coat on both sides of the vest
  for (const s of [-1, 1]) p.shade([P(s * 0.12, top), P(s * 0.2, top), P(s * 0.2, 0), P(s * 0.15, 0), P(s * 0.13, 0.2)], 0.66, 0.9);
  // Westennaht, Schatten der Platte und des Bartes / vest seam, shade of the plate and the beard
  p.crease(spline([P(0, 0.31), P(0, 0.24)], 2), lw(1.4), 1.9, 0.8, { taper: 0.1 });
  for (const s of [-1, 1]) p.crease(spline([P(s * 0.1, 0.32), P(s * 0.11, 0.15), P(s * 0.1, -0.01)], 4), lw(1.3), 1.8, 0.7, { taper: 0.2 });
  { const c = P(HEX[0] + 0.008, HEX[1] - 0.012); p.dab(c[0], c[1], u(0.11), 0.55, 0.9); }
}

function cells(m: MoodArt): Cell[] {
  return [
    { name: 'face', w: 512, h: 512, paint: (p) => paintFace(p, m) },
    { name: 'scalp', w: 192, h: 192, paint: paintScalp },
    { name: 'chest', w: 512, h: 224, paint: paintChest },
    ...bodyCells({ plain: true }).filter((c) => c.name !== 'ear'),
    { name: 'coat', w: 480, h: 240, paint: paintCoat },
    { name: 'collar', w: 224, h: 64, paint: paintCollar },
    { name: 'spike', w: 176, h: 56, paint: paintSpike },
    { name: 'beard', w: 208, h: 72, paint: paintBeard },
    { name: 'lens', w: 96, h: 96, paint: paintLens },
    { name: 'earcup', w: 112, h: 112, paint: paintEarcup },
    { name: 'hex', w: 176, h: 176, paint: paintHex },
    { name: 'mount', w: 144, h: 64, paint: paintMount },
    { name: 'button', w: 48, h: 48, paint: paintButton },
    { name: 'badge', w: 112, h: 128, paint: paintBadge },
  ];
}

export const velkar: LeaderDef = { cells, build, glow: [GLOW], side: 1 };
