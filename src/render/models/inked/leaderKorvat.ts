/**
 * Gezeichneter Anfuehrer der Korvat: Grossmarschall Ilja Brodnik.
 * Inked leader of the Korvat: Grand Marshal Ilja Brodnik.
 *
 * Vorlage ist das Portraet des Spiels (public/leaders/img/korvat_neutral.webp): alter Marschall mit Schirmmuetze
 * (olive Krone, goldenes Fluegelabzeichen mit rotem Stein, rotes Band mit Eichenlaub, schwarzer Schirm mit Lorbeer),
 * grossem weissem Schnurrbart, buschigen Brauen, roter Uniform mit Stehkragen, goldenen Schulterstuecken mit Fransen,
 * Ordensspange, Ordensstern und Goldknoepfen. Das Emblem der Fraktion ist das Zahnrad (Knoepfe, Orden, Kragen).
 * The model is the game's portrait (public/leaders/img/korvat_neutral.webp): an old marshal with a peaked cap (olive
 * crown, golden winged badge with a red gem, red band with oak leaves, black peak with laurel), a big white moustache,
 * bushy brows, a red uniform with a standing collar, gold epaulettes with fringe, a ribbon rack, an order star and
 * gold buttons. The faction's emblem is the cog (buttons, medals, collar).
 */
import * as THREE from 'three';
import { fine, mix, rng, shade, xfMatrix, type V3 } from '../kit';
import { look, mat } from '../look';
import { Sculpt } from '../sculpt';
import { arc, spline, type Cell, type Pen, type Pt } from './atlas';
import { paintEmblem } from './emblem';
import { aimZ } from './figkit';
import { chestAt, chestMap, earGeometry, faceMap, gemDome, headGeometry, onFace, revolve, revolveAt, scalpMap, sheet, starPlate, stud as kitStud, torsoGeometry, tube, type TorsoSpec } from './leaderKit';
import type { LeaderDef } from './leaders';
import { bodyCells, drawBrow, drawEye, drawMouth, drawNose, fold, GOLD, GOLD_DARK, GOLD_LIGHT, goldDisc, leaf, leafBraid, lineScale, patch, ribbonBar, shadow, starPts, strands, wrinkle, type MoodArt } from './leaderPaint';
import { loft, type AtlasLayout, type UvBuilder } from './uvkit';

const L = look('korvat');
const SKIN = shade(mix(mat.skin, mat.orange, 0.2), 0.97);
const HAIR = mix(mat.snow, mat.concrete, 0.28);
const BROW = mix(mat.snow, mat.concrete, 0.62);
const COAT = L.primary;
const CAP = L.helmet;
const GEM = mat.red;

const T: TorsoSpec = { w: 0.45, d: 0.22, h: 0.35, slope: 0.085, neckR: 0.11, rise: 0.055, square: 0.3, z: -0.01, chest: 0.012 };
const HEAD_C: V3 = [0, 0.665, 0.03], HEAD_R: V3 = [0.175, 0.19, 0.172];
/** Zellpixel je Modelleinheit im Gesicht / cell pixels per model unit in the face */
const FACE_PX = 512;
const MOUTH = { y: -0.62, w: 0.19 };

function sculpt(m: MoodArt): Sculpt {
  const shocked = m.id === 'shocked', angry = m.id === 'angry';
  return new Sculpt(HEAD_C, HEAD_R, {
    jaw: -0.06, chin: 0.26, chinDown: 0.08 + m.open * 0.05, lowY: 0.14 + m.open * 0.07, socket: 0.085, brow: 0.13, cheek: 0.1, temple: 0.03,
    noseBridge: 0.12, noseLen: 0.42, noseW: 1.45, noseY: -0.22, lipU: 0.012, lipL: 0.03, mouthDepth: 0.012 + 0.035 * m.open, mouthW: MOUTH.w * 2, mouthY: MOUTH.y,
    smile: -0.015 + m.smile, asym: m.asym, fold: 0.03, eyeY: 0.12, flat: 0.12, ageGeo: 0.5, frownGeo: 0.5 + m.frown,
    bumps: [
      // Hamsterbacken und breites Kinn / jowls and broad chin
      { c: [0.5, -0.55, 0.7], s: [0.18, 0.18, 0.4], a: 0.07 }, { c: [-0.5, -0.55, 0.7], s: [0.18, 0.18, 0.4], a: 0.07 },
      { c: [0, -0.85, 0.6], s: [0.35, 0.15, 0.4], a: 0.06 },
      // Haar an den Schlaefen und am Hinterkopf traegt auf / the hair at the temples and the back of the head has volume
      { c: [0.86, 0.36, 0.3], s: [0.22, 0.3, 0.45], a: 0.07 }, { c: [-0.86, 0.36, 0.3], s: [0.22, 0.3, 0.45], a: 0.07 },
      { c: [0, 0.2, -0.9], s: [0.8, 0.45, 0.5], a: 0.05 },
      // Zorn: zusammengezogene Brauen; Schreck: gehobene Stirn / anger: knitted brows; shock: raised forehead
      ...(angry ? [{ c: [0.14, 0.24, 0.95] as V3, s: [0.1, 0.06, 0.3] as V3, a: 0.04 }, { c: [-0.14, 0.24, 0.95] as V3, s: [0.1, 0.06, 0.3] as V3, a: 0.04 }] : []),
      ...(shocked ? [{ c: [0, 0.42, 0.9] as V3, s: [0.4, 0.07, 0.3] as V3, a: 0.02 }] : []),
    ],
  });
}

// ---------- Muetze / cap ----------

const CAP_C: [number, number] = [0, 0.018];
/** Profil [Radius, Hoehe]: Schweissband innen, Band, Krone bis zum Rand, Deckel / profile [radius, height]: sweatband inside, band, crown up to the rim, top */
const CAP_Y = 0.796;
const CAP_PROFILE: [number, number][] = ([
  [0.15, 0.005], [0.186, 0], [0.19, 0.066],
  [0.197, 0.07], [0.226, 0.102], [0.253, 0.132], [0.272, 0.158], [0.278, 0.172],
  [0.27, 0.184], [0.215, 0.194], [0.12, 0.2], [1e-4, 0.202],
] as [number, number][]).map(([r, y]) => [r, CAP_Y + y]);
const CAP_BAND = [1, 2], CAP_CROWN = [3, 7], CAP_TOP = [7, 11];
/** Die Krone steigt nach vorn an / the crown rises towards the front */
const capTilt = (k: number) => -0.27 * Math.max(0, Math.min(1, (k - 2.6) / 3.4));
const CAP_O = { centre: CAP_C, front: 1.05, tilt: capTilt, pivot: [CAP_Y + 0.07, 0.018] as [number, number] };

function cap(b: UvBuilder, A: AtlasLayout): void {
  const seg = fine() ? 56 : 28;
  const part = (i0: number, i1: number, cellName: string, sub: number, c: THREE.Color, mirror = true, crease = 1, gloss = 0) => {
    b.add(revolve(CAP_PROFILE.slice(i0, i1 + 1), { ...CAP_O, tilt: (k) => capTilt(k + i0), seg, sub: fine() ? sub : Math.max(1, sub - 1), region: A.get(cellName), mirror, color: c }), null, { crease, gloss });
  };
  part(0, 1, 'blank', 1, shade(L.primary, 0.4));
  part(CAP_BAND[0], CAP_BAND[1], 'capBand', 2, L.primary);
  part(2, 3, 'blank', 1, GOLD, true, 1, 0.5);
  part(CAP_CROWN[0], CAP_CROWN[1], 'capCrown', 2, CAP);
  part(CAP_TOP[0], CAP_TOP[1], 'capTop', 2, CAP);
  // Schirm: schwarzer Lack, nach vorn abfallend / peak: black lacquer, sloping down to the front
  const SPAN = 1.22;
  b.add(sheet((u, v) => {
    const a = (u - 0.5) * 2 * SPAN, e = Math.pow(Math.max(0, Math.cos((a / SPAN) * Math.PI * 0.5)), 0.7);
    const depth = 0.012 + 0.112 * e, r = 0.18 + depth * v;
    return new THREE.Vector3(Math.sin(a) * r, CAP_Y + 0.014 - 0.3 * depth * v * (0.55 + 0.45 * v) - 0.03 * (1 - Math.cos(a)) * v, CAP_C[1] + Math.cos(a) * r * 1.05);
  }, { nu: fine() ? 30 : 14, nv: fine() ? 6 : 3, region: A.get('peak'), back: A.get('blank'), thick: 0.011, flip: true, color: mat.dark, backColor: shade(mat.dark, 0.7) }), null, { gloss: 0.75 });
  // Sturmriemen-Knoepfe an den Schirmenden / chin cord buttons at the ends of the peak
  for (const s of [-1, 1]) {
    const a = s * 1.16, r = 0.187;
    const at = new THREE.Vector3(Math.sin(a) * r, CAP_Y + 0.026, CAP_C[1] + Math.cos(a) * r * 1.05), n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    stud(b, A, at, n, 0.017, 0.008, 'button');
  }
  // Abzeichen: goldene Scheibe mit rotem Stein vorn auf der Krone (die Fluegel sind gezeichnet) / badge: gold disc with a red gem at the crown's front (the wings are drawn)
  const k = 4.55, p0 = revolveAt(CAP_PROFILE, CAP_O, 0.5, k), p1 = revolveAt(CAP_PROFILE, CAP_O, 0.5, k + 0.2), side = new THREE.Vector3(1, 0, 0);
  const n = new THREE.Vector3().crossVectors(side, p1.clone().sub(p0)).normalize();
  stud(b, A, p0, n, 0.036, 0.008, 'badge');
  dome(b, A, p0.clone().addScaledVector(n, 0.007), n, 0.021, 0.016, GEM);
}

const stud = (b: UvBuilder, A: AtlasLayout, at: THREE.Vector3, n: THREE.Vector3, r: number, h: number, cellName: string) => kitStud(b, A, at, n, r, h, cellName, GOLD);
const dome = gemDome;

// ---------- Aufbau / build ----------

function build(b: UvBuilder, A: AtlasLayout, m: MoodArt): void {
  const S = sculpt(m);
  // Oberkoerper, Hals, Stehkragen / torso, neck, standing collar
  b.add(torsoGeometry(T, { chest: A.get('chest'), back: A.get('back'), side: A.get('side'), top: A.get('top'), blank: A.get('blank') }, COAT), null, { crease: 0.6 });
  b.add(loft([{ y: 0.6, rx: 0.084, cz: 0.0, c: SKIN }, { y: 0.48, rx: 0.088, cz: -0.004 }, { y: 0.33, rx: 0.1, cz: -0.01 }], { seg: fine() ? 28 : 14, region: A.get('neck') }), null, { crease: 0 });
  const collar: [number, number][] = [[0.143, 0.335], [0.134, 0.395], [0.125, 0.458], [0.115, 0.461], [0.106, 0.41]];
  const CO = { centre: [0, -0.006] as [number, number], front: 0.98, tilt: () => 0.11, pivot: [0.4, 0] as [number, number] };
  b.add(revolve(collar.slice(0, 3), { ...CO, seg: fine() ? 44 : 22, sub: 2, region: A.get('collar'), mirror: true, color: COAT }), null, { crease: 0.8 });
  b.add(revolve(collar.slice(2), { ...CO, seg: fine() ? 44 : 22, region: A.get('blank'), color: shade(COAT, 0.55) }), null, { crease: 0.8 });

  // Kopf: alles unter der Muetze entfaellt / head: everything below the cap is dropped
  b.add(headGeometry(S, { skin: SKIN, face: A.get('face'), scalp: A.get('scalp'), cut: (p) => p.y > 0.74 }), null, { crease: 0 });
  b.mirrorX(() => {
    b.group({ p: S.dir([1, -0.06, -0.06], -0.03), r: [0, -0.62, 0.08] }, () => b.add(earGeometry(A.get('ear'), 0.07, SKIN), null, { crease: 0.5 }));
  });

  // Schnurrbart: zwei Fluegel, an den Enden hochgezwirbelt / moustache: two wings, twirled up at the ends
  for (const s of [-1, 1] as const) {
    const lift = m.id === 'shocked' ? 0.07 : m.id === 'angry' ? 0.03 : m.id === 'smug' && s === m.side ? 0.06 : 0;
    const bristle = m.id === 'angry' ? 1.12 : 1;
    const pts: [number, number, number][] = [
      [0.0, -0.385, 0.05], [0.16, -0.42, 0.11], [0.36, -0.5 + lift * 0.3, 0.115], [0.56, -0.58 + lift * 0.6, 0.1],
      [0.75 * bristle, -0.59 + lift, 0.1], [0.89 * bristle, -0.5 + lift, 0.11], [0.94 * bristle, -0.38 + lift, 0.11], [0.9 * bristle, -0.29 + lift, 0.1],
    ];
    const c = new THREE.Vector3(...HEAD_C);
    const path = pts.map(([x, y, l]) => onFace(S, x, y, l));
    b.group({ s: [s, 1, 1] }, () => {
      b.add(tube(path.map((q): V3 => [q.x, q.y, q.z]),
        (t) => { const k = Math.sin(Math.PI * Math.min(1, 0.22 + t * 0.6)) * (1 - Math.pow(t, 2.4)); return [0.0015 + 0.034 * k, 0.0015 + 0.045 * k]; },
        { seg: fine() ? 12 : 8, samples: fine() ? 26 : 12, region: A.get('moustache'), front: true, color: HAIR,
          out: (t) => { const q = path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))]; return q.clone().sub(c).setY(0).normalize(); } }), null, { crease: 0.4 });
    });
  }
  cap(b, A);

  // Schulterstuecke mit Raupe und Fransen / epaulettes with crescent and fringe
  b.mirrorX(() => {
    const xf = { p: [0.3, 0.352, -0.012] as V3, r: [0, 0, -0.3] as V3 };
    const mtx = xfMatrix(xf);
    const HX = 0.145, HZ = 0.098;
    b.group(xf, () => {
      b.add(sheet((u, v) => {
        const a = 2 * u - 1, c = 2 * v - 1;
        const x = a * Math.sqrt(1 - (c * c) / 2), z = c * Math.sqrt(1 - (a * a) / 2);
        return new THREE.Vector3(x * HX + 0.012, 0.04 * Math.sqrt(1 - Math.min(1, x * x + z * z)), -z * HZ * (1 + 0.14 * x));
      }, { nu: fine() ? 16 : 8, nv: fine() ? 12 : 6, region: A.get('epaulette'), back: A.get('blank'), thick: 0.009, color: GOLD, backColor: GOLD_DARK }), null, { gloss: 0.55, crease: 0.9 });
      stud(b, A, new THREE.Vector3(-0.07, 0.036, 0), new THREE.Vector3(0, 1, 0), 0.02, 0.008, 'button');
    });
    // Raupe um das aeussere Ende, daran die Fransen (senkrecht, in Weltkoordinaten) / crescent around the outer end, the fringe on it (vertical, in world coordinates)
    const rim = (th: number, lift = 0.014) => new THREE.Vector3(Math.cos(th) * HX * 0.97, lift, -Math.sin(th) * HZ * (1 + 0.14 * Math.cos(th)) * 0.97).applyMatrix4(mtx);
    const cres: V3[] = [];
    for (let i = 0; i <= 10; i++) { const q = rim(-1.4 + (i / 10) * 2.8, 0.016 * Math.sin((i / 10) * Math.PI) - 0.004); cres.push([q.x, q.y, q.z]); }
    b.add(tube(cres, (t) => 0.006 + 0.021 * Math.pow(Math.sin(Math.PI * t), 0.45), { seg: fine() ? 10 : 6, samples: fine() ? 22 : 10, region: A.get('blank'), out: [0, 1, 0], color: GOLD }), null, { gloss: 0.7, crease: 0.5 });
    const nf = 8;
    for (let i = 0; i < nf; i++) {
      const th = -1.3 + (i / (nf - 1)) * 2.6, q = rim(th, -0.004), o = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
      const len = 0.128 - 0.014 * Math.abs(Math.sin(th * 1.3));
      b.add(tube([[q.x, q.y, q.z], [q.x + o.x * 0.008, q.y - len * 0.5, q.z + o.z * 0.008], [q.x + o.x * 0.011, q.y - len, q.z + o.z * 0.011]],
        (t) => 0.0235 * (t > 0.8 ? Math.sqrt(Math.max(0.04, 1 - ((t - 0.8) / 0.2) ** 2)) : 1),
        { seg: fine() ? 10 : 6, samples: fine() ? 8 : 4, region: A.get('bullion'), out: [o.x, 0, o.z], front: true, color: GOLD }), null, { gloss: 0.5, crease: 0.5 });
    }
  });

  // Ordensspange: leicht erhabene Platte auf der Brust / ribbon rack: slightly raised plate on the chest
  const RX0 = -0.335, RX1 = -0.085, RY0 = RACK_Y[0], RY1 = RACK_Y[1];
  b.add(sheet((u, v) => { const q = chestAt(T, RX0 + u * (RX1 - RX0), RY1 - v * (RY1 - RY0)); return q.p.addScaledVector(q.n, 0.009); },
    { nu: fine() ? 10 : 5, nv: fine() ? 4 : 2, region: A.get('rack'), back: A.get('blank'), thick: 0.009, flip: true, color: COAT }), null, { crease: 1 });
  // drei Orden an Baendern (Baender gezeichnet) / three medals on ribbons (ribbons drawn)
  for (const [i, x] of MEDAL_X.entries()) { const q = chestAt(T, x, MEDAL_Y); stud(b, A, q.p, q.n, 0.026, 0.007, i === 1 ? 'medalB' : 'medalA'); }
  // Ordensstern: zwei Platten und der rote Stein / order star: two plates and the red gem
  {
    const q = chestAt(T, STAR[0], STAR[1]);
    b.group({ p: [q.p.x, q.p.y, q.p.z], r: aimZ([q.n.x, q.n.y, q.n.z]) }, () => {
      b.add(starPlate(8, 0.074, 0.04, 0.007, A.get('star'), GOLD), null, { gloss: 0.5, crease: 0.9 });
      b.add(starPlate(8, 0.05, 0.033, 0.012, A.get('star2'), GOLD_LIGHT, Math.PI / 2 + Math.PI / 8), null, { gloss: 0.5, crease: 0.9 });
    });
    dome(b, A, q.p.clone().addScaledVector(q.n, 0.011), q.n, 0.023, 0.016, GEM);
  }
  // Knoepfe: zwei Reihen / buttons: two rows
  for (const y of BUTTON_Y) for (const x of [-0.062, 0.062]) { const q = chestAt(T, x, y); stud(b, A, q.p, q.n, 0.019, 0.008, 'button'); }
}
const MEDAL_X = [-0.292, -0.21, -0.128];
const STAR: [number, number] = [0.205, 0.175];
const BUTTON_Y = [0.05, 0.122, 0.194, 0.266];
const RACK_Y: [number, number] = [0.214, 0.308];
const MEDAL_Y = 0.136;

// ---------- Zeichnung / drawing ----------

function paintFace(p: Pen, m: MoodArt): void {
  const M = faceMap(p.w, p.h), P = M.P, lw = lineScale(M.u(1) / HEAD_R[0]);
  const angry = m.id === 'angry', shocked = m.id === 'shocked';
  // Schlagschatten des Schirms auf der Stirn, harte Kante / cast shadow of the peak on the forehead, hard edge
  p.shade(spline([P(-0.95, 0.3), P(-0.5, 0.385), P(0, 0.41), P(0.5, 0.385), P(0.95, 0.3)], 6).concat([P(0.95, 0.95), P(-0.95, 0.95)]), 0.7, 0.95);
  // Wangenflaechen: die lichtabgewandte Seite (im Bild rechts) kraeftiger / cheek planes: the side away from the light (right in the picture) stronger
  shadow(p, M, [[0.5, 0.02], [0.62, -0.1], [0.6, -0.3], [0.5, -0.5], [0.42, -0.72], [0.3, -0.92], [0.62, -0.88], [0.86, -0.5], [0.9, 0], [0.8, 0.2], [0.66, 0.14]], 0.8, 0.9, false);
  shadow(p, M, [[-0.68, 0.02], [-0.72, -0.3], [-0.62, -0.56], [-0.47, -0.8], [-0.72, -0.72], [-0.88, -0.3], [-0.88, 0.1]], 0.86, 0.9, false);
  // Augenhoehle unter dem Brauenwulst / socket below the brow ridge
  shadow(p, M, [[0.1, 0.21], [0.3, 0.26], [0.58, 0.24], [0.64, 0.13], [0.52, 0.19], [0.3, 0.205], [0.13, 0.15]], 0.76, 0.9);
  // gesunde Farbe an Wangen und Nase / ruddy cheeks and nose
  for (const s of [-1, 1]) { const c = P(s * 0.44, -0.2); p.dab(c[0], c[1], M.u(0.17), [1.08, 0.84, 0.8], 0.55); }
  { const c = P(0, -0.2); p.dab(c[0], c[1], M.u(0.1), [1.08, 0.84, 0.8], 0.5); }
  // Schatten unter Schnurrbart und Unterlippe, Kieferunterseite / shade below moustache and lower lip, underside of the jaw
  shadow(p, M, [[-0.34, -0.5], [0, -0.47], [0.34, -0.5], [0.3, -0.64], [0, -0.66], [-0.3, -0.64]], 0.76, 0.9, false);
  shadow(p, M, [[-0.15, -0.73], [0, -0.75], [0.15, -0.73], [0.1, -0.79], [0, -0.805], [-0.1, -0.79]], 0.8, 0.9, false);
  p.gradient(0, P(0, -0.84)[1], p.w, p.h - P(0, -0.84)[1], P(0, -0.84), P(0, -1), 1, 0.66);

  // graues Haar an den Schlaefen bis zu den Koteletten / grey hair at the temples down to the sideburns
  for (const s of [-1, 1]) {
    const inner: Pt[] = [P(s * 0.74, 0.7), P(s * 0.715, 0.42), P(s * 0.73, 0.22), P(s * 0.78, 0.05), P(s * 0.82, -0.1), P(s * 0.86, -0.14)];
    const outer: Pt[] = [P(s * 0.95, 0.7), P(s * 0.95, 0.42), P(s * 0.95, 0.22), P(s * 0.95, 0.05), P(s * 0.93, -0.06), P(s * 0.9, -0.1)];
    p.fill([...spline(inner, 5), ...outer.reverse()], HAIR);
    p.line(spline(inner, 5), lw(1.7), { taper: 0.2, wobble: 0.5, press: 0.3 });
    strands(p, spline(inner, 5), spline(outer.reverse(), 5).map((q, i, a): Pt => { const c = spline(inner, 5)[Math.min(i, a.length - 1)]; return [c[0] + (q[0] - c[0]) * 0.55, q[1]]; }), 3, lw(1.1), 31 + s);
  }

  // Stirnfalten (im Schatten des Schirms), Zornesfalten / forehead lines (in the peak's shadow), frown lines
  const fw = lw(1.2 + 0.8 * m.forehead);
  for (const [y, w] of [[0.46, 0.34], [0.54, 0.4], [0.62, 0.3]] as [number, number][]) wrinkle(p, M, [[-w, y + 0.012], [-w * 0.4, y - 0.008], [0, y + 0.004], [w * 0.4, y - 0.008], [w, y + 0.012]], fw, false);
  wrinkle(p, M, [[0.05, 0.2 + m.browIn(1) * 0.5], [0.068, 0.27], [0.055, 0.35]], lw(1.5 + 1.2 * m.frown));
  if (angry) wrinkle(p, M, [[0.13, 0.33], [0.17, 0.38], [0.2, 0.36]], lw(1.6));

  for (const s of [-1, 1] as const) {
    drawEye(p, M, s, {
      x: 0.36, y: 0.115, w: 0.152, h: 0.08, tilt: -0.07, upper: 0.36 + m.upper(s), lower: 0.12 + m.lower(s), iris: mat.blue, irisR: 0.07 * m.iris,
      look: [0, shocked ? 0 : 0.04], crease: 0.04, bag: 1, lid: 3.8,
    }, lw);
    drawBrow(p, M, s, { x0: 0.075, y0: 0.215 + m.browIn(s), x1: 0.66, y1: 0.33 + m.browOut(s), arch: 0.032, thick: 0.12, colour: BROW, strands: 6, wild: 1, seed: 11 + s }, lw);
  }
  // Kraehenfuesse, zweite Linie unter dem Auge, Wangenfalte, Nasolabialfalte, Hamsterbacke / crow's feet, second line below the eye, cheek crease, nasolabial fold, jowl
  for (const [x1, y1] of [[0.645, 0.165], [0.65, 0.07]] as [number, number][]) wrinkle(p, M, [[0.56, 0.11], [(0.56 + x1) / 2, (0.11 + y1) / 2 + 0.006], [x1, y1]], lw(1.2));
  wrinkle(p, M, [[0.24, -0.045], [0.37, -0.075], [0.5, -0.045]], lw(1.2));
  wrinkle(p, M, [[0.52, -0.06], [0.6, -0.17], [0.585, -0.31]], lw(1.4));
  wrinkle(p, M, [[0.2, -0.19], [0.31, -0.29], [0.4, -0.43], [0.43, -0.55]], lw(2));
  wrinkle(p, M, [[0.56, -0.6], [0.47, -0.77], [0.32, -0.9]], lw(1.5));
  wrinkle(p, M, [[0.7, 0.0], [0.72, -0.25], [0.64, -0.5]], lw(1.3));
  drawNose(p, M, { y: -0.22, w: 1.45, top: 0.17, shade: 0.8 }, lw);
  drawMouth(p, M, { y: MOUTH.y, w: MOUTH.w, smile: -0.015 + m.smile, asym: m.asym, lipU: 0.02, lipL: 0.05, tint: [1, 0.8, 0.76], open: m.open * 0.8, line: 2.4 }, lw);
  // Kinnfalte / chin crease
  wrinkle(p, M, [[-0.1, -0.86], [0, -0.885], [0.1, -0.86]], lw(1.4), false);
}

function paintScalp(p: Pen): void {
  const B = scalpMap(p.w, p.h), lw = lineScale((p.w / 4.36) / HEAD_R[0]);
  // Haar am Hinterkopf bis zum Nacken (gezackter Ansatz) / hair at the back of the head down to the nape (jagged hairline)
  const n = 26, nape: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -2.1 + (i / n) * 4.2, y = -0.3 + 0.16 * Math.abs(Math.sin(a * 0.5)) ** 2 + (i % 2 ? 0.05 : 0), c = Math.sqrt(1 - y * y);
    nape.push(B(Math.sin(a) * c, y, -Math.cos(a) * c));
  }
  p.fill([...nape, [nape[n][0], -6], [nape[0][0], -6]], HAIR);
  p.fill([[-6, -6], [p.w + 6, -6], [p.w + 6, p.h * 0.5], [nape[0][0], nape[0][1]], [nape[0][0], -6]], HAIR);
  p.fill([[-6, -6], [nape[n][0], -6], [nape[n][0], nape[n][1]], [-6, p.h * 0.5]], HAIR);
  p.line(nape, lw(1.6), { taper: 0.1, wobble: 0.4 });
  const R = rng(57);
  for (let i = 0; i < 13; i++) {
    const a = -1.9 + (i / 12) * 3.8 + (R() - 0.5) * 0.1;
    const pts: Pt[] = [];
    for (const y of [0.55, 0.3, 0.05, -0.16]) { const c = Math.sqrt(1 - y * y); pts.push(B(Math.sin(a + y * 0.08) * c, y, -Math.cos(a + y * 0.08) * c)); }
    p.line(spline(pts, 4), lw(1.1), { taper: 0.42, wobble: 0.5 });
  }
  // Schatten unter dem Muetzenrand / shade below the cap's edge
  const band: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = -2.2 + (i / n) * 4.4, y = 0.44, c = Math.sqrt(1 - y * y); band.push(B(Math.sin(a) * c, y, -Math.cos(a) * c)); }
  p.shade([...band, [band[n][0], -6], [band[0][0], -6]], 0.72, 0.9);
}

function paintChest(p: Pen): void {
  const C = chestMap(T, p.w, p.h), P = C.P, u = C.u, lw = lineScale(u(1));
  const top = T.h + T.rise;
  // Schatten von Kinn und Kragen, der Schulterstuecke, zum Saum dunkler / shade of chin and collar, of the epaulettes, darker towards the hem
  p.shade(spline([P(-0.21, top), P(-0.16, 0.33), P(0, 0.3), P(0.16, 0.33), P(0.21, top)], 6), 0.74, 0.9);
  for (const s of [-1, 1]) p.shade(spline([P(s * 0.17, top), P(s * 0.22, 0.31), P(s * 0.34, 0.262), P(s * 0.46, 0.27), P(s * 0.47, top)], 6), 0.74, 0.9);
  p.gradient(0, P(0, 0.12)[1], p.w, p.h - P(0, 0.12)[1], P(0, 0.12), P(0, 0), 1, 0.8);
  // lichtabgewandte Seite der Brust / side of the chest away from the light
  p.shade(spline([P(0.31, 0.27), P(0.35, 0.16), P(0.36, 0)], 5).concat([P(0.46, 0), P(0.46, 0.27)]), 0.84, 0.9);
  // Knopfleiste: uebergeschlagene Kante mit Goldpaspel / front: overlapping edge with gold piping
  p.band(spline([P(0.004, 0.31), P(0, 0.18), P(0, -0.01)], 6), u(0.013), GOLD, lw(1.3));
  p.crease(spline([P(0.016, 0.3), P(0.012, 0.18), P(0.012, -0.01)], 6), u(0.01), 0.72, 0.9, { taper: 0.05 });
  for (const y of BUTTON_Y) for (const x of [-0.062, 0.062]) { const c = P(x + 0.006, y - 0.008); p.dab(c[0], c[1], u(0.026), 0.66, 0.9); }
  // Naehte: Aermelansatz, Brustnaht / seams: armhole, breast seam
  for (const s of [-1, 1]) {
    p.line(spline([P(s * 0.345, 0.3), P(s * 0.372, 0.2), P(s * 0.392, 0.08), P(s * 0.395, -0.01)], 6), lw(1.6), { taper: 0.12, wobble: 0.4 });
    p.stitch(spline([P(s * 0.33, 0.27), P(s * 0.356, 0.18), P(s * 0.374, 0.07), P(s * 0.377, -0.01)], 6), 4, 3.4, 1.1, 0.62);
    p.line(spline([P(s * 0.15, 0.3), P(s * 0.165, 0.18), P(s * 0.16, -0.01)], 6), lw(1.2), { taper: 0.3, wobble: 0.4 });
    // Falten vom Arm zur Brust / folds from the arm towards the chest
    fold(p, spline([P(s * 0.385, 0.18), P(s * 0.33, 0.155), P(s * 0.27, 0.15)], 5), lw(1.4), u(0.014) * s, 0.8);
    fold(p, spline([P(s * 0.39, 0.09), P(s * 0.32, 0.06), P(s * 0.24, 0.055)], 5), lw(1.4), u(0.016) * s, 0.8);
    fold(p, spline([P(s * 0.41, 0.25), P(s * 0.38, 0.27), P(s * 0.36, 0.3)], 5), lw(1.2), u(0.01) * s, 0.8);
  }
  // Schlagschatten der Spange, Baender der drei Orden / cast shadow of the rack, ribbons of the three medals
  p.shade([P(-0.33, RACK_Y[0]), P(-0.078, RACK_Y[0]), P(-0.078, RACK_Y[1] - 0.012), P(-0.07, RACK_Y[1] - 0.012), P(-0.07, RACK_Y[0] - 0.01), P(-0.33, RACK_Y[0] - 0.01)], 0.62, 0.9);
  const ribbons: THREE.Color[][] = [[L.secondary, GOLD, L.secondary], [mat.paper, mat.blue, mat.paper], [GOLD, mat.dark, GOLD]];
  MEDAL_X.forEach((x, i) => {
    const w = 0.021, y0 = RACK_Y[0] - 0.002, y1 = MEDAL_Y + 0.028;
    const shape: Pt[] = [P(x - w, y0), P(x + w, y0), P(x + w, y1), P(x, y1 - 0.016), P(x - w, y1)];
    p.shade(shape.map((q): Pt => [q[0] + u(0.006), q[1] + u(0.005)]), 0.62, 0.9);
    p.fill(shape, ribbons[i][0]);
    p.fill([P(x - w * 0.36, y0), P(x + w * 0.36, y0), P(x + w * 0.36, y1 - 0.011), P(x, y1 - 0.016), P(x - w * 0.36, y1 - 0.011)], ribbons[i][1]);
    p.line(shape, lw(1.5), { closed: true, wobble: 0.15 });
    const c = P(x + 0.006, MEDAL_Y - 0.006); p.dab(c[0], c[1], u(0.034), 0.62, 0.9);
  });
  // Schatten des Ordenssterns / shadow of the order star
  { const c = P(STAR[0] + 0.008, STAR[1] - 0.01); p.fill(starPts(c[0], c[1], 8, u(0.078), u(0.044)), mat.ink, 0.32); }
  // Abrieb am Saum / wear at the hem
  p.scratches(0, P(0, 0.05)[1], p.w, p.h - P(0, 0.05)[1] - 4, 5, 913, 20);
}

function paintRack(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.25);
  const cols = 7, rows = 3, gx = 3, gy = 4;
  const bw = (W - gx * (cols + 1)) / cols, bh = (H - gy * (rows + 1)) / rows;
  const pal: THREE.Color[] = [mat.red, GOLD, mat.paper, L.secondary, mat.blue, mat.dark, mat.green, mat.orange, mat.teal];
  const R = rng(4711);
  p.fill([[0, 0], [W, 0], [W, H], [0, H]], shade(mat.dark, 0.9));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = pal[Math.floor(R() * pal.length)];
    let b2 = pal[Math.floor(R() * pal.length)], c2 = pal[Math.floor(R() * pal.length)];
    if (b2 === a) b2 = pal[(pal.indexOf(a) + 2) % pal.length];
    if (c2 === a || c2 === b2) c2 = pal[(pal.indexOf(b2) + 3) % pal.length];
    const kind = Math.floor(R() * 4);
    const stripes: [THREE.Color, number][] = kind === 0 ? [[a, 2], [b2, 1], [a, 2]] : kind === 1 ? [[a, 1], [b2, 1], [c2, 1.4], [b2, 1], [a, 1]] : kind === 2 ? [[a, 1.5], [b2, 0.5], [a, 0.8], [b2, 0.5], [a, 1.5]] : [[b2, 0.6], [a, 1.3], [c2, 0.6], [a, 1.3], [b2, 0.6]];
    ribbonBar(p, gx + c * (bw + gx), gy + r * (bh + gy), bw, bh, stripes, lw(1.3));
  }
  p.line([[1, 1], [W - 1, 1], [W - 1, H - 1], [1, H - 1]], lw(1.6), { closed: true, wobble: 0.15 });
}

/** Stehkragen (gespiegelt: x = 0 ist vorn Mitte) / standing collar (mirrored: x = 0 is the front centre) */
function paintCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.4);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.86, 1.04);
  // Goldpaspel an Ober- und Vorderkante, Naht unten / gold piping at the top and front edge, seam at the bottom
  p.band([[9, H - 5], [W + 4, H - 5]], 7, GOLD, lw(1.3));
  p.band([[5, 3], [5, H - 3]], 7, GOLD, lw(1.3));
  p.line([[1, -2], [1, H + 2]], lw(2.4), { taper: 0, wobble: 0.1 });
  p.line([[10, 6], [W + 3, 6]], lw(1.2), { taper: 0.02, wobble: 0.3 });
  // Kragenspiegel: Eichenlaub in Gold und ein Zahnrad / collar patch: oak leaves in gold and a cog
  const pth = spline([[22, H * 0.56], [60, H * 0.44], [104, H * 0.5]], 6);
  leafBraid(p, pth, 4, 17, 9, GOLD, lw(1.2));
  paintEmblem(p, 'korvat', 128, H * 0.5, 11, GOLD, lw(1.2));
}

/** Muetzenband (gespiegelt): rotes Band, Goldpaspel, Eichenlaub-Kordel / cap band (mirrored): red band, gold piping, oak-leaf cord */
function paintCapBand(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.6);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.82, 1.05);
  p.band([[-4, H - 4.5], [W + 4, H - 4.5]], 6, GOLD, lw(1.2));
  p.band([[-4, 4.5], [W + 4, 4.5]], 6, GOLD, lw(1.2));
  // Kordel aus Laub von der Mitte bis zum Knopf, dahinter glattes Band mit Naht / cord of leaves from the centre to the button, behind it a plain band with a seam
  const end = W * 0.385;
  leafBraid(p, [[-6, H * 0.52], [end * 0.5, H * 0.5], [end, H * 0.52]], 9, 13, 8.5, GOLD, lw(1.2), { spread: 0.62 });
  p.stitch([[end + 22, H * 0.5], [W, H * 0.5]], 4, 3.2, 1.1, 0.62);
  p.line([[W - 1, 8], [W - 1, H - 8]], lw(1.3), { taper: 0.2 });
}

/** Krone (gespiegelt, t = 0 am Rand oben? nein: t laeuft vom Band zum Rand): Fluegelabzeichen, Naehte / crown (mirrored, t runs from the band to the rim): winged badge, seams */
function paintCapCrown(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.78);
  // Zelle: oben = Band, unten = Rand der Krone / cell: top = band, bottom = the crown's rim
  p.gradient(0, 0, W, H * 0.4, [0, 0], [0, H * 0.4], 0.74, 1);
  p.gradient(0, H * 0.78, W, H * 0.24, [0, H * 0.78], [0, H], 1, 1.16);
  // Paspel am Rand, Naht an der Seite / piping at the rim, seam at the side
  p.band([[-4, H - 4], [W + 4, H - 4]], 5, shade(CAP, 0.62), lw(1.2));
  p.line(spline([[W * 0.5, 2], [W * 0.5 + 3, H * 0.5], [W * 0.5, H - 6]], 5), lw(1.3), { taper: 0.3, wobble: 0.4 });
  p.line(spline([[W * 0.98, 2], [W * 0.98, H - 6]], 3), lw(1.2), { taper: 0.3 });
  // Stofffalten / cloth folds
  fold(p, spline([[W * 0.3, 6], [W * 0.33, H * 0.4], [W * 0.31, H * 0.72]], 5), lw(1.2), 5, 0.84);
  fold(p, spline([[W * 0.72, 8], [W * 0.74, H * 0.45], [W * 0.72, H * 0.76]], 5), lw(1.2), 5, 0.84);
  // Fluegel: Schwingen aus Federn von der Scheibe nach aussen, dazu der Stern ueber der Scheibe (unten = oben im Raum)
  // wings: feathers from the disc outward, plus the star above the disc (bottom = up in space)
  const cy = H * 0.47;
  const feathers: [number, number, number][] = [[92, cy + 24, 13], [100, cy + 9, 13], [90, cy - 6, 12], [70, cy - 17, 11]];
  for (const [x, y, w] of feathers) leaf(p, [16, cy + (y - cy) * 0.3], [x, y], w, GOLD, lw(1.3));
  leaf(p, [14, cy + 6], [58, cy + 31], 11, GOLD, lw(1.3));
  // Stern ueber der Scheibe (halb, die andere Haelfte spiegelt sich) / star above the disc (half, the other half mirrors)
  patch(p, starPts(0, cy + 33, 5, 11, 4.8, Math.PI / 2), GOLD, lw(1.3));
  // Unterlage der Scheibe / base of the disc
  p.spot(0, cy, 27, GOLD_DARK);
  p.line(arc(0, cy, 27, 27, 0, Math.PI * 2, 24), lw(1.5), { closed: true, wobble: 0.1 });
}

function paintCapTop(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, cy = H / 2, lw = lineScale(W / 0.56);
  p.dab(cx, cy, W * 0.48, 1.08, 0.6);
  for (let i = 0; i < 4; i++) {
    const a = 0.4 + (i / 4) * Math.PI * 2;
    p.line([[cx + Math.cos(a) * 9, cy + Math.sin(a) * 9], [cx + Math.cos(a) * W * 0.44, cy + Math.sin(a) * H * 0.44]], lw(1.2), { taper: 0.3, wobble: 0.4 });
  }
  goldDisc(p, cx, cy, 6, lw(1.2), shade(CAP, 0.8));
}

/** Schirm (s quer, t vom Band zur Vorderkante): Lack, Goldrand, zwei Lorbeerzweige / peak (s across, t from the band to the front edge): lacquer, gold rim, two laurel sprays */
function paintPeak(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.5);
  // Goldrand entlang der Vorderkante / gold rim along the front edge
  p.band([[-4, H - 6], [W + 4, H - 6]], 9, GOLD, lw(1.3));
  // Glanz: helle Flaeche mit harter Kante / shine: light area with a hard edge
  p.fill(spline([[W * 0.16, H * 0.2], [W * 0.34, H * 0.12], [W * 0.46, H * 0.16], [W * 0.4, H * 0.3], [W * 0.22, H * 0.36]], 5, true), mat.white, 0.2);
  for (const s of [-1, 1]) {
    const pth = spline([[W / 2 + s * 10, H * 0.62], [W / 2 + s * 52, H * 0.5], [W / 2 + s * 98, H * 0.56]], 6);
    leafBraid(p, pth, 6, 17, 9.5, GOLD, lw(1.2), { spread: 0.6 });
  }
  goldDisc(p, W / 2, H * 0.63, 6, lw(1.2));
  // Schatten des Bandes / shade of the band
  p.fill([[0, 0], [W, 0], [W, H * 0.1], [0, H * 0.1]], mat.ink, 0.5);
}

/** Schnurrbart (s vom Ansatz zur Spitze, t rundum: oben = Oberkante) / moustache (s from the root to the tip, t around: top = upper edge) */
function paintMoustache(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.24);
  // Unterseite im Schatten (flache Flaeche, gezackte Kante wie Haarspitzen), oben ein Lichtband
  // underside in shade (flat area, jagged edge like hair tips), a band of light on top
  const edge: Pt[] = [];
  for (let i = 0; i <= 12; i++) edge.push([W * (i / 12), H * (0.62 + (i % 2 ? -0.07 : 0.03) - 0.06 * (i / 12))]);
  p.shade([...edge, [W, H + 4], [0, H + 4]], 0.76, 0.95);
  p.shade(spline([[W * 0.06, H * 0.22], [W * 0.3, H * 0.13], [W * 0.62, H * 0.2], [W * 0.6, H * 0.3], [W * 0.3, H * 0.25], [W * 0.08, H * 0.31]], 5, true), 1.25, 0.8);
  // wenige lange Straehnen, unregelmaessig: Form des Haars, kein Muster / a few long strands, irregular: the form of the hair, no pattern
  const lines: [number, number, number, number, number][] = [[0.03, 0.17, 0.72, 0.36, 1.7], [0.16, 0.4, 0.94, 0.47, 1.3], [0.04, 0.52, 0.6, 0.6, 1.8], [0.3, 0.76, 0.9, 0.62, 1.3], [0.08, 0.84, 0.48, 0.82, 1.5]];
  for (const [x0, y0, x1, y1, w] of lines) p.line(spline([[W * x0, H * y0], [W * (x0 + x1) / 2, H * ((y0 + y1) / 2 + 0.035)], [W * x1, H * y1]], 6), lw(w), { taper: 0.44, wobble: 0.5, press: 0.35 });
  p.line(spline([[W * 0.66, H * 0.28], [W * 0.8, H * 0.36], [W * 0.95, H * 0.45]], 5), lw(1.2), { taper: 0.45, wobble: 0.4 });
}

/** Schulterstueck (s vom Hals nach aussen, t von vorn nach hinten) / epaulette (s from the neck outward, t from front to back) */
function paintEpaulette(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.284);
  // Wulst am aeusseren Ende: Schatten davor / roll at the outer end: shade in front of it
  p.shade(arc(W * 0.7, H / 2, W * 0.3, H * 0.5, -Math.PI / 2, Math.PI / 2, 16).concat([[W * 0.62, H], [W * 0.62, 0]]), 0.8, 0.9);
  p.line(arc(W * 0.56, H / 2, W * 0.27, H * 0.36, -1.5, 1.5, 18), lw(1.3), { taper: 0.2, wobble: 0.2 });
  // Tressen entlang des Stuecks / lace along the board
  for (const y of [0.3, 0.7]) p.line(spline([[W * 0.06, H * y], [W * 0.3, H * (y + (y < 0.5 ? -0.06 : 0.06))], [W * 0.5, H * y]], 5), lw(1.2), { taper: 0.3, wobble: 0.3 });
  // Glanz / shine
  p.fill(spline([[W * 0.12, H * 0.26], [W * 0.4, H * 0.18], [W * 0.5, H * 0.24], [W * 0.38, H * 0.3], [W * 0.14, H * 0.34]], 5, true), GOLD_LIGHT, 0.7);
}

/** Franse (s von oben nach unten, t rundum): gedrehte Kantille / fringe (s from top to bottom, t around): twisted bullion */
function paintBullion(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.128);
  p.shade([[0, H * 0.66], [W, H * 0.66], [W, H + 2], [0, H + 2]], 0.7, 0.95);
  p.fill([[W * 0.06, H * 0.2], [W * 0.84, H * 0.2], [W * 0.84, H * 0.33], [W * 0.06, H * 0.33]], GOLD_LIGHT, 0.75);
  // zwei Drehungen als Form, kein Muster / two twists as form, no pattern
  for (const x of [0.32, 0.66]) p.line(spline([[W * x - 6, H * 0.1], [W * x, H * 0.5], [W * x + 7, H * 0.92]], 4), lw(1.1), { taper: 0.35, wobble: 0.2 });
}

function paintButton(p: Pen): void {
  const c = p.w / 2, lw = lineScale(p.w / 0.04);
  goldDisc(p, c, c, p.w * 0.47, lw(1.4));
  paintEmblem(p, 'korvat', c, c, p.w * 0.26, GOLD_DARK, lw(0.9));
}
function paintBadge(p: Pen): void {
  const c = p.w / 2, lw = lineScale(p.w / 0.075);
  goldDisc(p, c, c, p.w * 0.47, lw(1.5));
  p.line(arc(c, c, p.w * 0.36, p.w * 0.36, 0, Math.PI * 2, 24), lw(1.2), { closed: true, wobble: 0.1 });
}
function paintMedal(p: Pen, kind: number): void {
  const c = p.w / 2, lw = lineScale(p.w / 0.054);
  goldDisc(p, c, c, p.w * 0.47, lw(1.5));
  p.line(arc(c, c, p.w * 0.37, p.w * 0.37, 0, Math.PI * 2, 24), lw(1.1), { closed: true, wobble: 0.1 });
  if (kind === 0) paintEmblem(p, 'korvat', c, c, p.w * 0.25, GOLD_DARK, lw(1));
  else patch(p, starPts(c, c, 5, p.w * 0.27, p.w * 0.115), L.primary, lw(1.2));
}
/** Ordensstern: geschliffene Strahlen (eine Flanke dunkel), Ring um den Stein / order star: cut rays (one flank dark), ring around the gem */
function paintStar(p: Pen, inner: boolean): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.148);
  const n = 8, rot = inner ? Math.PI / 2 + Math.PI / 8 : Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = -rot + (i / n) * Math.PI * 2, a1 = a + Math.PI / n;
    const tip: Pt = [c + Math.cos(a) * W * 0.5, c + Math.sin(a) * W * 0.5], notch: Pt = [c + Math.cos(a1) * W * 0.3, c + Math.sin(a1) * W * 0.3];
    p.shade([[c, c], tip, notch], 0.7, 0.95);
    p.line([[c, c], tip], lw(1.2), { taper: 0.1, wobble: 0.1 });
    p.line([[c, c], notch], lw(0.9), { taper: 0.3, wobble: 0.1 });
  }
  p.spot(c, c, W * (inner ? 0.29 : 0.2), inner ? GOLD : GOLD_DARK);
  p.line(arc(c, c, W * (inner ? 0.29 : 0.2), W * (inner ? 0.29 : 0.2), 0, Math.PI * 2, 24), lw(1.3), { closed: true, wobble: 0.1 });
}
function cells(m: MoodArt): Cell[] {
  return [
    { name: 'face', w: FACE_PX, h: FACE_PX, paint: (p) => paintFace(p, m) },
    { name: 'scalp', w: 224, h: 224, paint: paintScalp },
    { name: 'chest', w: 640, h: 288, paint: paintChest },
    ...bodyCells(),
    { name: 'collar', w: 256, h: 72, paint: paintCollar },
    { name: 'capBand', w: 384, h: 56, paint: paintCapBand },
    { name: 'capCrown', w: 336, h: 104, paint: paintCapCrown },
    { name: 'capTop', w: 128, h: 128, paint: paintCapTop },
    { name: 'peak', w: 288, h: 104, paint: paintPeak },
    { name: 'moustache', w: 272, h: 96, paint: paintMoustache },
    { name: 'epaulette', w: 176, h: 112, paint: paintEpaulette },
    { name: 'bullion', w: 96, h: 32, paint: paintBullion },
    { name: 'rack', w: 232, h: 88, paint: paintRack },
    { name: 'button', w: 48, h: 48, paint: paintButton },
    { name: 'badge', w: 72, h: 72, paint: paintBadge },
    { name: 'medalA', w: 64, h: 64, paint: (p) => paintMedal(p, 0) },
    { name: 'medalB', w: 64, h: 64, paint: (p) => paintMedal(p, 1) },
    { name: 'star', w: 128, h: 128, paint: (p) => paintStar(p, false) },
    { name: 'star2', w: 96, h: 96, paint: (p) => paintStar(p, true) },
  ];
}

export const korvat: LeaderDef = { cells, build, side: 1 };
