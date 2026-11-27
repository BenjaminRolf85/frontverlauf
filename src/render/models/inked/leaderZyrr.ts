/**
 * Gezeichnete Anfuehrerin der Zyrr: die Schwarmherrin.
 * Inked leader of the Zyrr: the swarm sovereign.
 *
 * Vorlage ist das Portraet des Spiels (public/leaders/img/zyrr_neutral.webp): fliederfarbenes Fremdwesen mit schmalem
 * Kinn und spitzen Ohren, ein Kranz aus schwarz-goldenen Stacheln als Krone, ein magentafarbener Stein auf der Stirn,
 * leuchtende Adern; das rechte Auge glueht magenta, das linke ist durch ein Implantat aus Stahlplatten mit roter
 * Linse ersetzt. Dunkelviolette Ruestung mit leuchtenden Kanten, hohe Kragenklingen, weit ausladende spitze
 * Schulterplatten, auf der Brust der Reaktor mit gluehendem Kern. Emblem: das dreifache Ringsiegel.
 * The model is the game's portrait (public/leaders/img/zyrr_neutral.webp): a lilac alien with a narrow chin and pointed
 * ears, a wreath of black and gold spikes as a crown, a magenta gem on the forehead, glowing veins; the right eye
 * glows magenta, the left is replaced by an implant of steel plates with a red lens. Dark violet armour with glowing
 * edges, tall collar blades, wide pointed shoulder plates, on the chest the reactor with a glowing core. Emblem: the
 * triple-ring sigil.
 */
import * as THREE from 'three';
import { primitives, semantic } from '../../../design/tokens';
import { col, fine, mix, shade, type V3 } from '../kit';
import { look, mat } from '../look';
import { Sculpt } from '../sculpt';
import { arc, spline, type Cell, type Pen, type Pt } from './atlas';
import { paintEmblem } from './emblem';
import { chestAt, chestMap, earGeometry, faceMap, faceSheet, gemDome, headGeometry, onFace, scalpMap, sheet, stud, torsoGeometry, torsoPoint, torsoShell, tube, type TorsoSpec } from './leaderKit';
import type { LeaderDef } from './leaders';
import { bodyCells, drawEye, drawMouth, lineScale, shadow, wrinkle, type MoodArt } from './leaderPaint';
import { loft, type AtlasLayout, type UvBuilder } from './uvkit';

const L = look('zyrr');
const P_ = primitives.color;
const SKIN = shade(mix(P_.alienMoon300, P_.rock400, 0.28), 0.93);
const SKIN_DARK = mix(P_.xeno600, P_.alienMoon300, 0.35);
/** Leuchtfarben: Magenta der Adern und des Kerns, Rot der Linse / glow colours: magenta of veins and core, red of the lens */
const MAG = col(semantic.caveGlowMagenta);
const RED = shade(mat.red, 0.62);
const ARMOUR = mix(L.primary, mat.dark, 0.62);
const ARMOUR_LIGHT = mix(L.primary, mat.darkMid, 0.3);
const ARMOUR_DARK = mix(L.primary, mat.ink, 0.82);
const STEEL = mix(mat.metalLight, P_.alienMoon300, 0.25);
const GOLD = mat.gold;
const LIPS = mix(L.primary, mat.dark, 0.3);

const T: TorsoSpec = { w: 0.43, d: 0.2, h: 0.325, slope: 0.105, neckR: 0.092, rise: 0.06, square: 0.24, z: -0.01, chest: 0.022 };
const HEAD_C: V3 = [0, 0.652, 0.03], HEAD_R: V3 = [0.16, 0.198, 0.166];
const MOUTH = { y: -0.58, w: 0.19 };
const EYE = { x: 0.37, y: 0.1 };

function sculpt(m: MoodArt): Sculpt {
  return new Sculpt(HEAD_C, HEAD_R, {
    jaw: 0.42, chin: 0.2, chinDown: 0.1 + m.open * 0.05, lowY: 0.06 + m.open * 0.06, back: 0.16, crown: 0.14, socket: 0.085, brow: 0.07, cheek: 0.13, hollow: 0.07, temple: 0.05,
    noseBridge: 0.06, noseLen: 0.15, noseW: 0.72, noseY: -0.25, lipU: 0.045, lipL: 0.055, mouthDepth: 0.012 + 0.04 * m.open, mouthW: MOUTH.w * 2, mouthY: MOUTH.y,
    smile: 0.015 + m.smile, asym: m.asym, fold: 0.004, eyeY: EYE.y, eyeX: EYE.x, flat: 0.1, frownGeo: m.frown * 0.8,
  });
}

// ---------- Aufbau / build ----------

const REACTOR: [number, number] = [0, 0.085];

function build(b: UvBuilder, A: AtlasLayout, m: MoodArt): void {
  const S = sculpt(m);
  b.add(torsoGeometry(T, { chest: A.get('chest'), back: A.get('back'), side: A.get('side'), top: A.get('top'), blank: A.get('blank') }, ARMOUR), null, { gloss: 0.3, crease: 0.6 });
  // Hals: gegliederte dunkle Ruestung / neck: segmented dark armour
  b.add(loft([{ y: 0.6, rx: 0.068, cz: 0.0, c: ARMOUR_DARK }, { y: 0.5, rx: 0.074, cz: -0.004 }, { y: 0.47, rx: 0.088, cz: -0.004, hard: true }, { y: 0.415, rx: 0.096, cz: -0.006, hard: true }, { y: 0.405, rx: 0.112, cz: -0.006, hard: true }, { y: 0.32, rx: 0.13, cz: -0.01 }], { seg: fine() ? 32 : 16, region: A.get('neck') }), null, { gloss: 0.3, crease: 0.8 });

  b.add(headGeometry(S, { skin: SKIN, face: A.get('face'), scalp: A.get('scalp') }), null, { crease: 0 });
  b.mirrorX(() => {
    b.group({ p: S.dir([1, 0.02, -0.08], -0.03), r: [0.2, -0.5, 0.25] }, () => b.add(earGeometry(A.get('ear'), 0.062, SKIN, 1.6), null, { crease: 0.5 }));
  });
  // Stirnstein: Raute, leuchtet / forehead gem: a lozenge, glowing
  {
    const c = onFace(S, 0, 0.5, 0.012);
    b.add(loft([{ y: 0.046, rx: 1e-7, c: MAG }, { y: 0, rx: 0.02, hard: true }, { y: -0.046, rx: 1e-7 }], { seg: 4, region: A.get('blank') }), null, { gloss: 1, crease: 1, xf: { p: [c.x, c.y, c.z], r: [-0.35, Math.PI / 4, 0], s: [1, 1, 0.5] } });
  }
  // gluehendes rechtes Auge (im Bild links): flache Linse ueber der gezeichneten Lidspalte / glowing right eye (left in the picture): flat lens over the drawn opening
  b.add(faceSheet(S, (u, v) => {
    const a = 2 * u - 1, c2 = 2 * v - 1, k = Math.sqrt(Math.max(0, 1 - a * a));
    const up = Math.max(0.2, 1 - (0.34 + m.upper(-1))), lo = Math.max(0.2, 1 - (0.1 + m.lower(-1)));
    return [-(EYE.x + a * 0.14 - 0.01), EYE.y + 0.02 * a + c2 * 0.06 * k * (c2 > 0 ? up : lo), 0.004 + 0.006 * k];
  }, { nu: fine() ? 10 : 6, nv: 4, region: A.get('blank'), color: MAG }), null, { crease: 0 });

  // Implantat ueber dem linken Auge (im Bild rechts): drei Stahlplatten, Linsenfassung, rote Linse
  // implant over the left eye (right in the picture): three steel plates, lens mount, red lens
  const quad = (c: [number, number][], lift: number, cellName: string) => b.add(faceSheet(S, (u, v) => {
    const x = (c[0][0] * (1 - u) + c[1][0] * u) * (1 - v) + (c[3][0] * (1 - u) + c[2][0] * u) * v;
    const y = (c[0][1] * (1 - u) + c[1][1] * u) * (1 - v) + (c[3][1] * (1 - u) + c[2][1] * u) * v;
    return [x, y, lift + 0.012 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)];
  }, { nu: fine() ? 8 : 4, nv: fine() ? 8 : 4, region: A.get(cellName), back: A.get('blank'), thick: 0.012, flip: true, color: STEEL, backColor: shade(STEEL, 0.5) }), null, { gloss: 0.6, crease: 1 });
  quad([[0.13, 0.42], [0.6, 0.5], [0.7, 0.2], [0.17, 0.22]], 0.03, 'implantA');
  quad([[0.56, 0.24], [0.8, 0.26], [0.74, -0.2], [0.5, -0.05]], 0.034, 'implantB');
  quad([[0.2, 0.0], [0.5, -0.04], [0.56, -0.3], [0.33, -0.3]], 0.028, 'implantC');
  {
    const c = onFace(S, EYE.x + 0.01, EYE.y, 0.03), n = new THREE.Vector3(0.3, 0.02, 1).normalize();
    stud(b, A, c, n, 0.058, 0.014, 'lensMount', mix(mat.darkMid, STEEL, 0.3), 0.5, 16);
    gemDome(b, A, c.clone().addScaledVector(n, 0.012), n, 0.034, 0.02, RED, 1);
  }

  // Stachelkrone: Kranz von Ohr zu Ohr, die mittleren Stacheln am laengsten / crown of spikes: a wreath from ear to ear, the middle spikes longest
  {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = -1.4 + (i / (n - 1)) * 2.8, k = 1 - Math.abs(a) / 1.4;
      const dir = new THREE.Vector3(Math.sin(a), Math.cos(a) * 0.9 + 0.16, 0.04 + 0.1 * k).normalize();
      const base = new THREE.Vector3(...S.dir([Math.sin(a) * 0.86, Math.cos(a) * 0.62 + 0.36, 0.3 + 0.12 * k], -0.04));
      const len = (0.2 + 0.1 * k) * (i % 2 ? 0.8 : 1), w = 0.04 + 0.014 * k;
      const tip = base.clone().addScaledVector(dir, len);
      b.add(tube([[base.x, base.y, base.z], [(base.x + tip.x) / 2, (base.y + tip.y) / 2, (base.z + tip.z) / 2 + 0.006], [tip.x, tip.y, tip.z]], (t) => [0.0015 + 0.02 * (1 - t) ** 0.9, 0.0015 + w * (1 - t) ** 1.05],
        { seg: fine() ? 8 : 6, samples: fine() ? 8 : 4, region: A.get('crownSpike'), out: [0, 0.1, 1], front: true, color: GOLD }), null, { gloss: 0.5, crease: 0.9 });
      // dahinter je ein kurzer schwarzer Stachel in der Luecke / behind, a short black spike in each gap
      if (i < n - 1) {
        const a2 = a + 1.4 / (n - 1), k2 = 1 - Math.abs(a2) / 1.4;
        const d2 = new THREE.Vector3(Math.sin(a2), Math.cos(a2) * 0.9 + 0.2, -0.06).normalize();
        const b2 = new THREE.Vector3(...S.dir([Math.sin(a2) * 0.86, Math.cos(a2) * 0.62 + 0.36, 0.12 + 0.1 * k2], -0.05));
        const t2 = b2.clone().addScaledVector(d2, (0.15 + 0.07 * k2));
        b.add(tube([[b2.x, b2.y, b2.z], [(b2.x + t2.x) / 2, (b2.y + t2.y) / 2, (b2.z + t2.z) / 2], [t2.x, t2.y, t2.z]], (t) => [0.0015 + 0.016 * (1 - t), 0.0015 + 0.034 * (1 - t)],
          { seg: fine() ? 6 : 4, samples: fine() ? 6 : 3, region: A.get('blank'), out: [0, 0.1, 1], color: ARMOUR_DARK }), null, { gloss: 0.7, crease: 0.9 });
      }
      if (i === (n - 1) / 2) {
        const g = base.clone().addScaledVector(dir, len * 0.36).add(new THREE.Vector3(0, 0, 0.022));
        b.add(loft([{ y: 0.04, rx: 1e-7, c: mat.orange }, { y: 0, rx: 0.016, hard: true }, { y: -0.04, rx: 1e-7 }], { seg: 4, region: A.get('blank') }), null, { gloss: 1, crease: 1, xf: { p: [g.x, g.y, g.z], r: [-0.2, Math.PI / 4, 0], s: [1, 1, 0.5] } });
      }
    }
    // dunkles Stirnband unter den Stacheln / dark brow band below the spikes
    const band: V3[] = [];
    for (let i = 0; i <= 14; i++) { const a = -1.5 + (i / 14) * 3; band.push(S.dir([Math.sin(a) * 0.86, Math.cos(a) * 0.6 + 0.34, 0.34], 0.012)); }
    b.add(tube(band, () => [0.012, 0.024], { seg: 6, samples: fine() ? 30 : 14, region: A.get('blank'), out: [0, 0.2, 1], color: ARMOUR_DARK }), null, { gloss: 0.4, crease: 0.6 });
  }

  // Kragenklingen: zwei hohe Klingen hinter den Schultern, zur Seite gewoelbt, Flaeche nach vorn
  // collar blades: two tall blades behind the shoulders, curving outward, face to the front
  b.mirrorX(() => {
    b.add(sheet((u, v) => {
      const w = 0.056 * (1 - v) ** 0.75 + 0.003, off = (u - 0.5) * 2 * w;
      const x = 0.165 + 0.07 * v + 0.07 * v * v, y = 0.31 + 0.36 * v, z = -0.05 - 0.05 * v;
      return new THREE.Vector3(x + off * 0.94, y - off * 0.34, z + 0.016 * Math.sin(Math.PI * u) - off * 0.2);
    }, { nu: 4, nv: fine() ? 12 : 6, region: A.get('blade'), thick: 0.013, color: ARMOUR, backColor: ARMOUR_DARK, st: (u, v) => [u, 1 - v] }), null, { gloss: 0.5, crease: 1 });
  });
  // Schulterplatten: drei gewoelbte Schuppen ueber der Schulter, jede mit einer nach aussen oben geschwungenen Spitze
  // shoulder plates: three arched scales over the shoulder, each with a point sweeping up and outward
  b.mirrorX(() => {
    // Abstand entlang einer glatten Richtung aus der Schultermitte: die Kante zwischen Wand und Schulter des
    // Oberkoerpers knickt die Schuppen so nicht / offset along a smooth direction from the shoulder's middle: the
    // crease between the torso's wall and shoulder thus does not kink the scales
    const core = new THREE.Vector3(0.24, 0.2, T.z ?? 0);
    const shell = (a: number, vv: number, grow: number): THREE.Vector3 => {
      const q = torsoPoint(T, a, vv);
      return q.addScaledVector(q.clone().sub(core).normalize(), grow);
    };
    const scale = (vTop: number, vBot: number, span: number, grow: number) => b.add(sheet((u, v) => {
      const a = (u - 0.5) * span, vv = vTop - (vTop - vBot) * v;
      // Unterkante in der Mitte spitz ausgezogen / lower edge drawn out to a point at its middle
      const k = Math.pow(v, 2) * Math.pow(Math.cos((u - 0.5) * Math.PI), 4);
      return shell(a, vv - 0.035 * k, grow + 0.014 * Math.sin(Math.PI * u) * (0.4 + 0.6 * v));
    }, { nu: fine() ? 14 : 7, nv: fine() ? 10 : 5, region: A.get('pauldron'), back: A.get('blank'), thick: 0.012, color: ARMOUR_LIGHT, backColor: ARMOUR_DARK, st: (u, v) => [v, u] }), null, { gloss: 0.6, crease: 1 });
    scale(0.97, 0.62, 1.4, 0.014);
    scale(0.84, 0.48, 1.55, 0.036);
    scale(0.7, 0.36, 1.7, 0.058);
    // nach aussen oben geschwungene Spitze am Schulterende / point at the shoulder's end sweeping up and outward
    b.add(sheet((u, v) => {
      const w = 0.05 * (1 - v) ** 0.8 + 0.003, off = (u - 0.5) * 2 * w;
      const x = 0.33 + 0.16 * v + 0.07 * v * v, y = 0.27 + 0.15 * v + 0.04 * v * v, z = -0.02 - 0.03 * v;
      return new THREE.Vector3(x - off * 0.55, y + off * 0.8, z + 0.014 * Math.sin(Math.PI * u));
    }, { nu: 4, nv: fine() ? 10 : 5, region: A.get('blade'), thick: 0.013, color: ARMOUR_LIGHT, backColor: ARMOUR_DARK, st: (u, v) => [u, 1 - v] }), null, { gloss: 0.5, crease: 1 });
    // Brustplatte je Seite, leicht erhaben, ihre Kanten leuchten / chest plate per side, slightly raised, its edges glow
    b.add(torsoShell(T, (u, v) => [Math.PI / 2 - 0.07 - 0.6 * u, 0.57 - (0.3 - 0.13 * u) * v, 0.011 + 0.004 * Math.sin(Math.PI * u)], { nu: fine() ? 12 : 6, nv: fine() ? 8 : 4, region: A.get('chestPlate'), back: A.get('blank'), thick: 0.01, flip: true, color: ARMOUR_LIGHT, backColor: ARMOUR_DARK }), null, { gloss: 0.5, crease: 1 });
  });
  // Reaktor: gegliederter Ring, gluehender Kern / reactor: segmented ring, glowing core
  {
    const q = chestAt(T, REACTOR[0], REACTOR[1]);
    stud(b, A, q.p.clone().addScaledVector(q.n, 0.004), q.n, 0.092, 0.02, 'reactor', mix(mat.darkMid, STEEL, 0.25), 0.5, 22);
    gemDome(b, A, q.p.clone().addScaledVector(q.n, 0.024), q.n, 0.042, 0.022, MAG, 1);
  }
}

// ---------- Zeichnung / drawing ----------

function paintFace(p: Pen, m: MoodArt): void {
  const M = faceMap(p.w, p.h), P = M.P, lw = lineScale(M.u(1) / HEAD_R[0]);
  const V: [number, number, number] = [0.84, 0.78, 0.92];
  // hohle Wangen und Schlaefen: flache violette Schatten / hollow cheeks and temples: flat violet shadows
  shadow(p, M, [[0.3, -0.16], [0.5, -0.06], [0.6, -0.28], [0.46, -0.56], [0.26, -0.84], [0.22, -0.6], [0.26, -0.36]], [0.78, 0.72, 0.88], 0.9, false);
  shadow(p, M, [[-0.36, -0.2], [-0.52, -0.1], [-0.6, -0.3], [-0.48, -0.56], [-0.32, -0.76], [-0.3, -0.45]], V, 0.9, false);
  shadow(p, M, [[0.56, 0.5], [0.7, 0.2], [0.68, -0.05], [0.9, -0.05], [0.9, 0.5]], V, 0.9);
  shadow(p, M, [[0.1, 0.2], [0.3, 0.25], [0.56, 0.22], [0.6, 0.13], [0.3, 0.19], [0.13, 0.14]], [0.74, 0.68, 0.86], 0.9);
  shadow(p, M, [[-0.12, -0.72], [0, -0.735], [0.12, -0.72], [0.08, -0.78], [0, -0.795], [-0.08, -0.78]], V, 0.9, false);
  p.gradient(0, P(0, -0.84)[1], p.w, p.h - P(0, -0.84)[1], P(0, -0.84), P(0, -1), 1, 0.66);
  // dunkler Scheitel unter der Krone / dark crown of the skull below the spikes
  p.fill(spline([P(-0.95, 0.42), P(-0.5, 0.6), P(0, 0.66), P(0.5, 0.6), P(0.95, 0.42)], 6).concat([P(0.95, 0.95), P(-0.95, 0.95)]), SKIN_DARK, 0.85);
  // leuchtende Adern auf der Stirn, vom Stein aus / glowing veins on the forehead, from the gem
  for (const s of [-1, 1]) {
    p.mark(spline([P(s * 0.03, 0.42), P(s * 0.16, 0.38), P(s * 0.24, 0.3), P(s * 0.3, 0.33)], 5), lw(1.8), MAG, 1, { taper: 0.35, wobble: 0.4 });
    p.mark(spline([P(s * 0.14, 0.39), P(s * 0.2, 0.46), P(s * 0.3, 0.5)], 5), lw(1.4), MAG, 1, { taper: 0.4, wobble: 0.4 });
  }
  p.mark(spline([P(0, 0.42), P(0.005, 0.34), P(0, 0.26)], 4), lw(1.6), MAG, 1, { taper: 0.4, wobble: 0.3 });
  // Brauenwulst: kraeftige Linie, keine Haare / brow ridge: a bold line, no hair
  for (const s of [-1, 1]) wrinkle(p, M, [[0.08, 0.2 + m.browIn(s)], [0.3, 0.27 + (m.browIn(s) + m.browOut(s)) / 2], [0.58, 0.25 + m.browOut(s)]], lw(3.4), false);
  p.line(spline([P(-0.08, 0.2 + m.browIn(-1)), P(-0.3, 0.27 + (m.browIn(-1) + m.browOut(-1)) / 2), P(-0.58, 0.25 + m.browOut(-1))], 6), lw(3.4), { taper: 0.3, wobble: 0.3, press: 0.3 });
  if (m.frown > 0.5) wrinkle(p, M, [[0.04, 0.17], [0.055, 0.24], [0.045, 0.3]], lw(1.6));
  // rechtes Auge (im Bild links): dunkler Lidschatten, die Glut selbst ist ein leuchtendes Teil
  // right eye (left in the picture): dark eye shadow, the ember itself is a glowing part
  drawEye(p, M, -1, { x: EYE.x, y: EYE.y, w: 0.16, h: 0.075, tilt: 0.16, upper: 0.34 + m.upper(-1), lower: 0.1 + m.lower(-1), iris: MAG, glow: MAG, lid: 5, wing: 0.06, shadow: SKIN_DARK }, lw);
  // Narbenlinien unter dem Auge / scar lines below the eye
  p.mark(spline([P(-0.33, -0.0), P(-0.36, -0.12), P(-0.33, -0.24)], 4), lw(1.5), MAG, 1, { taper: 0.4, wobble: 0.4 });
  p.mark(spline([P(-0.4, 0.0), P(-0.44, -0.08)], 3), lw(1.3), MAG, 1, { taper: 0.4, wobble: 0.3 });
  // linke Augenhoehle unter dem Implantat / left socket below the implant
  { const c = P(EYE.x, EYE.y); p.fill(arc(c[0], c[1], M.u(0.2), M.u(0.16), 0, Math.PI * 2, 20), SKIN_DARK, 0.9); }
  // Nase: schmaler Ruecken, zwei Schlitze; Lippen dunkelviolett / nose: narrow bridge, two slits; lips dark violet
  p.shade(spline([P(0.01, 0.14), P(0.02, -0.1), P(0.07, -0.28), P(0.1, -0.2), P(0.05, 0.14)], 5, true), [0.8, 0.74, 0.9], 0.9);
  p.line(spline([P(0.03, 0.1), P(0.028, -0.1), P(0.06, -0.24)], 5), lw(1.5), { taper: 0.4, wobble: 0.25 });
  for (const s of [-1, 1]) p.blot(spline([P(s * 0.035, -0.3), P(s * 0.06, -0.325), P(s * 0.075, -0.3), P(s * 0.055, -0.29)], 4, true));
  p.line(spline([P(-0.07, -0.335), P(0, -0.35), P(0.07, -0.335)], 4), lw(1.4), { taper: 0.4, wobble: 0.2 });
  drawMouth(p, M, { y: MOUTH.y, w: MOUTH.w, smile: 0.015 + m.smile, asym: m.asym, lipU: 0.045, lipL: 0.058, colour: LIPS, shine: 0.6, open: m.open * 0.7, line: 2.6 }, lw);
  wrinkle(p, M, [[-0.06, -0.9], [0, -0.915], [0.06, -0.9]], lw(1.2), false);
  // Wangenlinie: Kante des Wangenknochens / cheek line: edge of the cheekbone
  wrinkle(p, M, [[0.5, -0.02], [0.44, -0.22], [0.3, -0.42]], lw(1.5));
}

function paintScalp(p: Pen): void {
  const B = scalpMap(p.w, p.h), lw = lineScale((p.w / 4.36) / HEAD_R[0]);
  p.fill([[-6, -6], [p.w + 6, -6], [p.w + 6, p.h * 0.56], [-6, p.h * 0.56]], SKIN_DARK, 0.85);
  // Knochenkamm und leuchtende Adern am Hinterkopf / bone ridge and glowing veins at the back of the head
  for (const a of [-0.8, 0, 0.8]) {
    const pts: Pt[] = [];
    for (const y of [0.7, 0.3, -0.1, -0.45]) { const c = Math.sqrt(1 - y * y); pts.push(B(Math.sin(a) * c, y, -Math.cos(a) * c)); }
    if (a === 0) p.line(spline(pts, 4), lw(1.6), { taper: 0.4, wobble: 0.4 });
    else p.mark(spline(pts, 4), lw(1.6), MAG, 1, { taper: 0.4, wobble: 0.5 });
  }
}

/** Stachel (s vom Ansatz zur Spitze, t quer): dunkle Kanten, Mittelgrat, Glanz / spike (s from the root to the tip, t across): dark edges, centre ridge, shine */
function paintCrownSpike(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.26);
  // dunkler Fuss mit harter Kante / dark foot with a hard edge
  p.fill([[-2, -2], [W * 0.2, -2], [W * 0.2, H + 2], [-2, H + 2]], ARMOUR_DARK);
  p.fill([[W * 0.2, 0], [W, H * 0.3], [W, 0]], ARMOUR_DARK);
  p.fill([[W * 0.2, H], [W, H * 0.7], [W, H]], ARMOUR_DARK);
  p.fill([[W * 0.2, 0], [W * 0.56, 0], [W * 0.5, H * 0.14], [W * 0.2, H * 0.12]], ARMOUR_DARK);
  p.fill([[W * 0.2, H], [W * 0.56, H], [W * 0.5, H * 0.86], [W * 0.2, H * 0.88]], ARMOUR_DARK);
  p.shade([[W * 0.2, H * 0.5], [W, H * 0.5], [W, H], [W * 0.2, H]], 0.74, 0.95);
  p.line([[W * 0.22, H * 0.5], [W * 0.94, H * 0.5]], lw(1.4), { taper: 0.3, wobble: 0.2 });
  p.fill(spline([[W * 0.26, H * 0.3], [W * 0.5, H * 0.28], [W * 0.66, H * 0.36], [W * 0.5, H * 0.4], [W * 0.28, H * 0.4]], 4, true), mix(GOLD, mat.white, 0.6), 0.85);
  p.line([[W * 0.2, -2], [W * 0.2, H + 2]], lw(1.5), { taper: 0, wobble: 0.2 });
}

/** Implantatplatte: Fugen, Nieten, rote Kratzer / implant plate: joints, rivets, red scratches */
function paintImplant(p: Pen, kind: number): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.12);
  p.gradient(0, 0, W, H, [0, 0], [W, H], 1.16, 0.8);
  p.line([[3, 3], [W - 3, 3], [W - 3, H - 3], [3, H - 3]], lw(1.2), { closed: true, wobble: 0.2 });
  if (kind === 0) { p.panel([[W * 0.46, 3], [W * 0.5, H - 3]], lw(1.3)); p.rivet(W * 0.2, H * 0.3, lw(1.9)); p.rivet(W * 0.8, H * 0.3, lw(1.9)); }
  if (kind === 1) { p.panel([[3, H * 0.44], [W - 3, H * 0.5]], lw(1.3)); p.rivet(W * 0.5, H * 0.2, lw(1.9)); p.rivet(W * 0.5, H * 0.8, lw(1.9)); }
  if (kind === 2) { p.panel([[W * 0.2, H * 0.3], [W * 0.8, H * 0.7]], lw(1.3)); p.rivet(W * 0.74, H * 0.24, lw(1.9)); }
  p.mark([[W * 0.16, H * 0.72], [W * 0.38, H * 0.6]], lw(1.5), RED, 0.9, { taper: 0.4 });
  p.mark([[W * 0.6, H * 0.78], [W * 0.72, H * 0.72]], lw(1.2), RED, 0.9, { taper: 0.4 });
  p.fill([[W * 0.12, H * 0.14], [W * 0.4, H * 0.12], [W * 0.36, H * 0.24], [W * 0.12, H * 0.28]], mat.white, 0.4);
}
function paintLensMount(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.116);
  p.spot(c, c, W * 0.48, STEEL);
  p.fill(arc(c, c, W * 0.48, W * 0.48, 0.1, Math.PI - 0.3, 14), shade(STEEL, 0.6));
  p.line(arc(c, c, W * 0.48, W * 0.48, 0, Math.PI * 2, 26), lw(1.5), { closed: true, wobble: 0.1 });
  p.spot(c, c, W * 0.34, mat.dark);
  p.line(arc(c, c, W * 0.34, W * 0.34, 0, Math.PI * 2, 22), lw(1.3), { closed: true, wobble: 0.1 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; p.line([[c + Math.cos(a) * W * 0.36, c + Math.sin(a) * W * 0.36], [c + Math.cos(a) * W * 0.46, c + Math.sin(a) * W * 0.46]], lw(1.2), { taper: 0, wobble: 0 }); }
}

/** Schulterplatte (s vom Ansatz zur Spitze, t quer): leuchtende Kante, Plattenfugen, Glanz / shoulder plate (s from the base to the tip, t across): glowing edge, plate joints, shine */
function paintPauldron(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.5);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.25, 0.7);
  p.mark([[0, H * 0.1], [W * 0.5, H * 0.2], [W, H * 0.48]], lw(2.4), MAG, 1, { taper: 0.1, wobble: 0.2 });
  p.mark([[0, H * 0.9], [W * 0.5, H * 0.8], [W, H * 0.52]], lw(2.4), MAG, 1, { taper: 0.1, wobble: 0.2 });
  p.panel(spline([[W * 0.3, H * 0.16], [W * 0.36, H * 0.5], [W * 0.3, H * 0.84]], 4), lw(1.4));
  p.panel(spline([[W * 0.6, H * 0.28], [W * 0.64, H * 0.5], [W * 0.6, H * 0.72]], 4), lw(1.3));
  p.fill(spline([[W * 0.06, H * 0.24], [W * 0.26, H * 0.24], [W * 0.5, H * 0.34], [W * 0.26, H * 0.36], [W * 0.06, H * 0.36]], 4, true), mat.white, 0.3);
  p.fill(spline([[W * 0.4, H * 0.3], [W * 0.56, H * 0.36], [W * 0.5, H * 0.42]], 4, true), mat.white, 0.22);
}
/** Kragenklinge (s quer, t von der Spitze zum Ansatz): Kante leuchtet, Mittelgrat / collar blade (s across, t from the tip to the base): glowing edge, centre ridge */
function paintBlade(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(H / 0.33);
  p.gradient(0, 0, W, H, [0, 0], [W, 0], 1.25, 0.72);
  p.mark([[W * 0.94, H * 0.02], [W * 0.9, H]], lw(2.2), MAG, 1, { taper: 0.1, wobble: 0.2 });
  p.line(spline([[W * 0.5, H * 0.06], [W * 0.46, H * 0.5], [W * 0.5, H]], 4), lw(1.3), { taper: 0.3, wobble: 0.3 });
  p.panel([[W * 0.1, H * 0.7], [W * 0.9, H * 0.62]], lw(1.3));
}
function paintReactor(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.184);
  p.spot(c, c, W * 0.49, STEEL);
  p.fill(arc(c, c, W * 0.49, W * 0.49, 0.1, Math.PI - 0.3, 16), shade(STEEL, 0.6));
  p.spot(c, c, W * 0.38, ARMOUR_DARK);
  p.line(arc(c, c, W * 0.49, W * 0.49, 0, Math.PI * 2, 30), lw(1.6), { closed: true, wobble: 0.1 });
  p.line(arc(c, c, W * 0.38, W * 0.38, 0, Math.PI * 2, 26), lw(1.4), { closed: true, wobble: 0.1 });
  // acht Segmente, jedes zweite mit Leuchtstrich / eight segments, every second with a light stroke
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    p.line([[c + Math.cos(a) * W * 0.385, c + Math.sin(a) * W * 0.385], [c + Math.cos(a) * W * 0.485, c + Math.sin(a) * W * 0.485]], lw(1.4), { taper: 0, wobble: 0 });
    if (i % 2 === 0) p.mark(arc(c, c, W * 0.435, W * 0.435, a + 0.16, a + Math.PI / 4 - 0.16, 6), lw(2), MAG, 1, { taper: 0.1 });
  }
  p.mark(arc(c, c, W * 0.3, W * 0.3, 0, Math.PI * 2, 24), lw(2), MAG, 1, { closed: true, wobble: 0.1 });
}

/** Brustplatte (s vom Brustbein zur Seite, t von oben nach unten): helle Oberkante, leuchtende Unterkante, Fuge, Nieten / chest plate (s from the sternum to the side, t top to bottom): light top edge, glowing lower edge, joint, rivets */
function paintChestPlate(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.34);
  p.fill([[0, 0], [W, 0], [W, H * 0.22], [0, H * 0.3]], mix(ARMOUR, ARMOUR_LIGHT, 0.7));
  p.shade([[0, H * 0.72], [W, H * 0.6], [W, H + 2], [0, H + 2]], 0.76, 0.95);
  p.mark([[2, H * 0.9], [W * 0.5, H * 0.84], [W - 2, H * 0.68]], lw(2.4), MAG, 1, { taper: 0.1, wobble: 0.2 });
  p.mark([[W * 0.03, H * 0.06], [W * 0.03, H * 0.9]], lw(2), MAG, 1, { taper: 0.1, wobble: 0.2 });
  p.panel(spline([[W * 0.42, H * 0.08], [W * 0.46, H * 0.4], [W * 0.4, H * 0.8]], 4), lw(1.4));
  p.line([[0, H * 0.3], [W, H * 0.22]], lw(1.3), { taper: 0.2, wobble: 0.3 });
  for (const [x, y] of [[0.14, 0.16], [0.7, 0.12], [0.9, 0.42]]) p.rivet(W * x, H * y, lw(2));
  p.fill(spline([[W * 0.12, H * 0.38], [W * 0.34, H * 0.34], [W * 0.3, H * 0.44], [W * 0.12, H * 0.48]], 4, true), mat.white, 0.22);
}

function paintNeck(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.58);
  p.shade(spline([[W * 0.2, 0], [W * 0.3, H * 0.4], [W * 0.5, H * 0.5], [W * 0.7, H * 0.4], [W * 0.8, 0]], 6), 0.6, 0.95);
  // Rippen der Halsruestung, Leuchtlinie in der Mitte / ribs of the neck armour, light line in the middle
  for (const y of [0.18, 0.34]) p.crease([[-3, H * y], [W + 3, H * y]], lw(1.6), 1.9, 0.7, { taper: 0, wobble: 0.3 });
  for (const s of [-1, 1]) p.crease(spline([[W * (0.5 + s * 0.09), H * 0.5], [W * (0.5 + s * 0.11), H * 0.75], [W * (0.5 + s * 0.16), H]], 4), lw(1.6), 1.9, 0.7, { taper: 0.2 });
  p.mark([[W / 2, H * 0.52], [W / 2, H]], lw(2), MAG, 1, { taper: 0.2, wobble: 0.2 });
}

function paintChest(p: Pen): void {
  const C = chestMap(T, p.w, p.h), P = C.P, u = C.u, lw = lineScale(u(1));
  const top = T.h + T.rise;
  p.gradient(0, P(0, 0.11)[1], p.w, p.h - P(0, 0.11)[1], P(0, 0.11), P(0, 0), 1, 0.78);
  p.shade(spline([P(-0.2, top), P(-0.14, 0.31), P(0, 0.29), P(0.14, 0.31), P(0.2, top)], 6), 0.7, 0.9);
  // Brustplatten: Rippen laufen auf den Reaktor zu (helle Kante, daneben Tusche) / chest plates: ribs converge on the reactor (a light edge with ink beside it)
  const rib = (pts: Pt[]) => { p.crease(pts, lw(1.6), 2, 0.75, { taper: 0.1, wobble: 0.3 }); p.line(pts.map((q): Pt => [q[0] + lw(1.1), q[1] + lw(1.1)]), lw(1.1), { taper: 0.12, wobble: 0.3 }); };
  for (const s of [-1, 1]) {
    rib(spline([P(s * 0.05, 0.3), P(s * 0.1, 0.22), P(s * 0.08, 0.16)], 5));
    rib(spline([P(s * 0.4, 0.2), P(s * 0.24, 0.17), P(s * 0.11, 0.12)], 5));
    rib(spline([P(s * 0.4, 0.09), P(s * 0.25, 0.08), P(s * 0.12, 0.055)], 5));
    rib(spline([P(s * 0.14, 0.0), P(s * 0.13, 0.03), P(s * 0.1, 0.045)], 4));
    // Leuchtkante der Platte / glowing edge of the plate
    p.mark(spline([P(s * 0.39, 0.15), P(s * 0.24, 0.125), P(s * 0.115, 0.09)], 5), lw(1.9), MAG, 1, { taper: 0.25, wobble: 0.3 });
    p.fill(spline([P(s * 0.2, 0.26), P(s * 0.3, 0.25), P(s * 0.28, 0.21), P(s * 0.18, 0.22)], 4, true), mat.white, 0.12);
  }
  // Emblem der Zyrr auf der Kehlplatte / the Zyrr emblem on the throat plate
  { const c = P(0, 0.235); p.fill(arc(c[0], c[1], u(0.045), u(0.045), 0, Math.PI * 2, 20), ARMOUR_DARK); p.line(arc(c[0], c[1], u(0.045), u(0.045), 0, Math.PI * 2, 20), lw(1.4), { closed: true, wobble: 0.1 }); paintEmblem(p, 'zyrr', c[0], c[1], u(0.032), MAG, 0); }
  { const c = P(REACTOR[0] + 0.008, REACTOR[1] - 0.012); p.dab(c[0], c[1], u(0.12), 0.5, 0.9); }
}

function cells(m: MoodArt): Cell[] {
  return [
    { name: 'face', w: 512, h: 512, paint: (p) => paintFace(p, m) },
    { name: 'scalp', w: 192, h: 192, paint: paintScalp },
    { name: 'chest', w: 576, h: 248, paint: paintChest },
    ...bodyCells({ plain: true }).filter((c) => c.name !== 'neck'),
    { name: 'neck', w: 192, h: 112, paint: paintNeck },
    { name: 'crownSpike', w: 192, h: 56, paint: paintCrownSpike },
    { name: 'implantA', w: 128, h: 80, paint: (p) => paintImplant(p, 0) },
    { name: 'implantB', w: 80, h: 128, paint: (p) => paintImplant(p, 1) },
    { name: 'implantC', w: 96, h: 96, paint: (p) => paintImplant(p, 2) },
    { name: 'lensMount', w: 96, h: 96, paint: paintLensMount },
    { name: 'pauldron', w: 288, h: 128, paint: paintPauldron },
    { name: 'blade', w: 96, h: 208, paint: paintBlade },
    { name: 'reactor', w: 176, h: 176, paint: paintReactor },
    { name: 'chestPlate', w: 192, h: 144, paint: paintChestPlate },
  ];
}

export const zyrr: LeaderDef = { cells, build, glow: [MAG, RED], side: -1 };
