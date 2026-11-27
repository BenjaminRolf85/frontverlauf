/**
 * Gezeichneter Anfuehrer der Dravon: Kommandant Sarek Voss.
 * Inked leader of the Dravon: Commander Sarek Voss.
 *
 * Vorlage ist das Portraet des Spiels (public/leaders/img/dravon_neutral.webp): schwarzer Panzerhelm mit Mittelgrat und
 * goldenem Stirnschild, Kopfhoererschalen mit Goldbuegel, nur der Augenstreifen ist frei (helle Augen, schwarze Brauen,
 * Narbe ueber dem linken Auge), darunter eine schwarze Atemmaske mit goldgefasstem Filter; olivgruene Uniform mit
 * Stehkragen, Goldpaspeln, Brusttaschen und Schulterstuecken aus Stahlschuppen. Emblem: die Blockfaust.
 * The model is the game's portrait (public/leaders/img/dravon_neutral.webp): black armoured helmet with a centre ridge
 * and a golden brow plate, earphone cups with a gold bracket, only the eye strip is open (light eyes, black brows, a
 * scar across the left eye), below it a black breathing mask with a gold-rimmed filter; olive uniform with a standing
 * collar, gold piping, chest pockets and shoulder pieces of steel scales. Emblem: the block fist.
 */
import * as THREE from 'three';
import { fine, mix, shade, type V3 } from '../kit';
import { look, mat } from '../look';
import { Sculpt, smoothstep } from '../sculpt';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { paintEmblem } from './emblem';
import { aimZ } from './figkit';
import { chestAt, chestMap, faceMap, faceSheet, gemDome, headGeometry, polyPlate, revolve, sheet, stud, TORSO_WALL, torsoGeometry, torsoShell, type TorsoSpec } from './leaderKit';
import type { LeaderDef } from './leaders';
import { bodyCells, drawBrow, drawEye, fold, GOLD, GOLD_DARK, GOLD_LIGHT, goldDisc, lineScale, shadow, wrinkle, type MoodArt } from './leaderPaint';
import { loft, type AtlasLayout, type UvBuilder } from './uvkit';

const L = look('dravon');
const SKIN = shade(mix(mat.skin, mat.orange, 0.12), 0.96);
/** Helm und Maske: fast schwarz, aber heller als die Tusche, damit Kanten lesbar bleiben / helmet and mask: nearly black, yet lighter than the ink so edges stay readable */
const BLACK = mix(L.helmet, mat.darkMid, 0.45);
const MASK = mix(L.helmet, mat.darkMid, 0.7);
const EDGE = mix(mat.darkMid, mat.metal, 0.55);
const CLOTH = shade(L.primary, 0.8);
const STEEL = mix(mat.metal, mat.darkMid, 0.6);
const SCAR = mix(mat.red, mat.dark, 0.12);

const T: TorsoSpec = { w: 0.45, d: 0.22, h: 0.355, slope: 0.075, neckR: 0.115, rise: 0.05, square: 0.32, z: -0.01, chest: 0.015 };
const HEAD_C: V3 = [0, 0.66, 0.03], HEAD_R: V3 = [0.168, 0.185, 0.168];

function sculpt(m: MoodArt): Sculpt {
  const angry = m.id === 'angry';
  return new Sculpt(HEAD_C, HEAD_R, {
    jaw: 0.16, chin: 0.16, socket: 0.09, brow: 0.11 + (angry ? 0.03 : 0), cheek: 0.07, noseBridge: 0.11, noseLen: 0.26, noseW: 1.1, noseY: -0.24,
    mouthY: -0.56, eyeY: 0.12, flat: 0.1, frownGeo: 0.4 + m.frown,
  });
}

// ---------- Helm / helmet ----------

const HELM = { R: 0.236, Ry: 0.262, yc: 0.742, zc: 0.016, yMin: 0.49 };
const HELM_TOP = HELM.yc + HELM.Ry;
/** Unterkante des Helms je Umlaufwinkel (0 = vorn): ueber den Augen hoch, an Wange und Nacken tief / lower edge of the helmet per angle around (0 = front): high above the eyes, low at cheek and nape */
const helmRim = (a: number) => { const k = Math.abs(a); return 0.762 - 0.222 * smoothstep(0.68, 0.98, k) - 0.03 * smoothstep(1.7, 2.7, k); };
const helmRadius = (y: number) => (y >= HELM.yc ? HELM.R * Math.pow(Math.max(0, 1 - ((y - HELM.yc) / HELM.Ry) ** 2), 0.5) : HELM.R * (1 - 0.1 * ((HELM.yc - y) / 0.22) ** 2));
const helmPoint = (a: number, y: number, grow = 0) => { const r = helmRadius(y) + grow; return new THREE.Vector3(Math.sin(a) * r, y, HELM.zc + Math.cos(a) * r * (Math.cos(a) > 0 ? 1.03 : 1.06)); };
/** Zell-t einer Hoehe am Helm / cell t of a height on the helmet */
const helmT = (y: number) => (HELM_TOP - y) / (HELM_TOP - HELM.yMin);

function helmet(b: UvBuilder, A: AtlasLayout): void {
  const nu = fine() ? 64 : 32, nv = fine() ? 20 : 10;
  b.add(sheet((u, v) => {
    const a = u * Math.PI * 2 - Math.PI, y0 = helmRim(a);
    // zum Scheitel hin dichter abtasten / sample denser towards the crown
    const y = y0 + (HELM_TOP - y0) * Math.sin((v * Math.PI) / 2);
    return helmPoint(a, y);
  }, {
    nu, nv, region: A.get('helmet'), back: A.get('blank'), thick: 0.016, closedU: true, color: BLACK, backColor: shade(BLACK, 0.5),
    st: (u, v) => { const a = u * Math.PI * 2 - Math.PI, y0 = helmRim(a); return [Math.abs(2 * u - 1), helmT(y0 + (HELM_TOP - y0) * Math.sin((v * Math.PI) / 2))]; },
  }), null, { gloss: 0.32, crease: 1 });
  // Mittelgrat von der Stirn ueber den Scheitel in den Nacken / centre ridge from the brow over the crown to the nape
  const ph0 = -1.25, ph1 = 1.17;
  const ridgeAt = (u: number, v: number, grow: number) => {
    const ph = ph0 + (ph1 - ph0) * v, x = (u - 0.5) * 0.17 * (1 - 0.45 * Math.abs(2 * v - 1) ** 2.5);
    // der Grat folgt der Kuppel: bei x neben der Mitte liegt die Flaeche tiefer / the ridge follows the dome: beside the centre the surface lies lower
    const k = Math.sqrt(Math.max(0.2, 1 - (x / HELM.R) ** 2));
    return new THREE.Vector3(x, HELM.yc + (HELM.Ry * k + grow) * Math.cos(ph), HELM.zc + (HELM.R * k + grow) * Math.sin(ph) * (ph > 0 ? 1.03 : 1.06));
  };
  b.add(sheet((u, v) => ridgeAt(u, v, 0.01), { nu: 6, nv: fine() ? 22 : 10, region: A.get('ridge'), back: A.get('blank'), thick: 0.012, flip: true, color: BLACK }), null, { gloss: 0.32, crease: 1 });
  // goldenes Stirnschild mit der Blockfaust / golden brow plate with the block fist
  const p0 = ridgeAt(0.5, 0.84, 0.012), p1 = ridgeAt(0.5, 0.88, 0.012);
  const up = p0.clone().sub(p1).normalize(), n = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), up).normalize();
  b.group({ p: [p0.x, p0.y, p0.z], r: aimZ([n.x, n.y, n.z]) }, () => b.add(polyPlate([[-0.042, -0.026], [0.042, -0.026], [0.042, 0.026], [-0.042, 0.026]], 0.008, A.get('badge'), GOLD, GOLD_DARK), null, { gloss: 0.6, crease: 1 }));
  // Kopfhoererschalen mit Goldbuegel / earphone cups with a gold bracket
  b.mirrorX(() => {
    const at = helmPoint(1.3, 0.635), nx = new THREE.Vector3(1, 0, 0.42).normalize();
    stud(b, A, at.clone().addScaledVector(nx, -0.012), nx, 0.082, 0.034, 'earcup', BLACK, 0.5, 20);
    // Buegel: Goldband vom Scheitelrand zur Schale / bracket: gold band from the crown's edge to the cup
    b.add(sheet((u, v) => {
      const y = 0.6 + 0.2 * v, q = helmPoint(1.3 + (u - 0.5) * 0.15, y, 0.004 + 0.046 * Math.pow(Math.max(0, 1 - v), 1.5) + 0.002);
      return q;
    }, { nu: 2, nv: fine() ? 8 : 4, region: A.get('blank'), thick: 0.008, color: GOLD }), null, { gloss: 0.6, crease: 1 });
  });
}

// ---------- Aufbau / build ----------

const POCKET_X = 0.215, POCKET_Y: [number, number] = [0.085, 0.225];

function build(b: UvBuilder, A: AtlasLayout, m: MoodArt): void {
  const S = sculpt(m);
  b.add(torsoGeometry(T, { chest: A.get('chest'), back: A.get('back'), side: A.get('side'), top: A.get('top'), blank: A.get('blank') }, CLOTH), null, { crease: 0.6 });
  // Hals in der Sturmhaube / neck inside the balaclava
  b.add(loft([{ y: 0.6, rx: 0.092, cz: 0.0, c: MASK }, { y: 0.48, rx: 0.096, cz: -0.004 }, { y: 0.33, rx: 0.106, cz: -0.01 }], { seg: fine() ? 28 : 14, region: A.get('neck') }), null, { crease: 0 });
  const collar: [number, number][] = [[0.15, 0.338], [0.142, 0.4], [0.134, 0.462], [0.123, 0.465], [0.113, 0.41]];
  const CO = { centre: [0, -0.006] as [number, number], front: 0.98, tilt: () => 0.1, pivot: [0.4, 0] as [number, number] };
  b.add(revolve(collar.slice(0, 3), { ...CO, seg: fine() ? 44 : 22, sub: 2, region: A.get('collar'), mirror: true, color: CLOTH }), null, { crease: 0.8 });
  b.add(revolve(collar.slice(2), { ...CO, seg: fine() ? 44 : 22, region: A.get('blank'), color: shade(CLOTH, 0.5) }), null, { crease: 0.8 });

  // Kopf: Haut nur im Augenstreifen, sonst Sturmhaube; alles unter Helm und Maske entfaellt
  // head: skin only in the eye strip, balaclava elsewhere; everything below helmet and mask is dropped
  b.add(headGeometry(S, { skin: SKIN, face: A.get('face'), scalp: A.get('blank'), colour: (p) => (p.z < 0.5 ? MASK : null), cut: (p) => p.y > 0.6 || (p.z < 0.35 && p.y > -0.45) }), null, { crease: 0 });

  // Maske: Schale ueber Nase, Mund und Kinn mit vorgewoelbter Schnauze / mask: shell over nose, mouth and chin with a bulging muzzle
  b.add(faceSheet(S, (u, v) => {
    const y = -0.005 - 0.99 * v - 0.04 * Math.pow(Math.abs(2 * u - 1), 2.5) * (1 - v), half = 0.8 - 0.32 * v * v;
    const x = (2 * u - 1) * half;
    return [x, y, 0.035 + 0.115 * Math.exp(-((x / 0.34) ** 2 + ((y + 0.5) / 0.4) ** 2)) + 0.02 * Math.exp(-((x / 0.24) ** 2 + ((y + 0.1) / 0.25) ** 2))];
  }, { nu: fine() ? 28 : 14, nv: fine() ? 20 : 10, region: A.get('mask'), back: A.get('blank'), thick: 0.016, flip: true, color: MASK, backColor: shade(MASK, 0.5) }), null, { gloss: 0.25, crease: 0.35 });
  // Filter: goldgefasste Dose mit Lamellen, zwei Stellknoepfe / filter: gold-rimmed canister with slats, two knobs
  {
    const at = new THREE.Vector3(...S.surf(0, -0.5, 0.135)), n = new THREE.Vector3(0, -0.16, 1).normalize();
    stud(b, A, at, n, 0.066, 0.034, 'filter', GOLD, 0.6, 22);
    for (const s of [-1, 1]) gemDome(b, A, new THREE.Vector3(...S.surf(s * 0.5, -0.5, 0.1)), new THREE.Vector3(s * 0.5, -0.1, 1).normalize(), 0.014, 0.012, GOLD, 0.7);
  }
  helmet(b, A);

  // Schulterstuecke: drei Reihen aus je drei Stahlkloetzen, die aeusserste Reihe mit Goldkappe
  // shoulder pieces: three rows of three steel blocks each, the outermost row with a gold cap
  b.mirrorX(() => {
    const rows: [number, number, number][] = [[0.9, 0.79, 0.008], [0.775, 0.665, 0.014], [0.65, 0.535, 0.02]];
    rows.forEach(([v0, v1, g], i) => {
      for (let k = 0; k < 3; k++) {
        const a0 = 0.86 - k * 0.585, a1 = a0 - 0.53;
        b.add(torsoShell(T, (u, v) => [a0 + (a1 - a0) * u, v0 + (v1 - v0) * v, g + 0.02 + 0.006 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)],
          { nu: fine() ? 4 : 2, nv: fine() ? 3 : 2, region: A.get(i === 2 ? 'plateGold' : 'plate'), back: A.get('blank'), thick: 0.024, flip: true, color: STEEL, backColor: shade(STEEL, 0.5) }), null, { gloss: 0.5, crease: 1 });
      }
    });
    void TORSO_WALL;
  });
  // Knoepfe der Brusttaschen und der Leiste / buttons of the chest pockets and the placket
  for (const s of [-1, 1]) { const q = chestAt(T, s * POCKET_X, POCKET_Y[1] - 0.045); stud(b, A, q.p, q.n, 0.017, 0.007, 'button', GOLD); }
  for (const y of [0.07, 0.17, 0.27]) for (const x of [-0.05, 0.05]) { const q = chestAt(T, x, y); stud(b, A, q.p, q.n, 0.012, 0.006, 'button', GOLD); }
}

// ---------- Zeichnung / drawing ----------

function paintFace(p: Pen, m: MoodArt): void {
  const M = faceMap(p.w, p.h), P = M.P, lw = lineScale(M.u(1) / HEAD_R[0]);
  // Schlagschatten des Helms auf Stirn und Schlaefen / cast shadow of the helmet on forehead and temples
  p.shade(spline([P(-0.95, 0.26), P(-0.55, 0.35), P(0, 0.375), P(0.55, 0.35), P(0.95, 0.26)], 6).concat([P(0.95, 0.95), P(-0.95, 0.95)]), 0.62, 0.95);
  shadow(p, M, [[0.6, 0.3], [0.72, 0.1], [0.72, -0.1], [0.95, -0.1], [0.95, 0.3]], 0.74, 0.9);
  // Augenhoehlen, Nasenwurzel / sockets, root of the nose
  shadow(p, M, [[0.09, 0.2], [0.3, 0.25], [0.56, 0.23], [0.62, 0.13], [0.5, 0.19], [0.3, 0.2], [0.13, 0.15]], 0.76, 0.9);
  shadow(p, M, [[0.02, 0.2], [0.07, 0.2], [0.1, 0.0], [0.03, 0.0]], 0.82, 0.9, false);
  // Sturmhaube: schwarzer Rahmen um den Augenstreifen / balaclava: black frame around the eye strip
  const open = spline([P(-0.8, 0.14), P(-0.66, 0.37), P(0, 0.43), P(0.66, 0.37), P(0.8, 0.14), P(0.72, -0.08), P(0, -0.12), P(-0.72, -0.08)], 8, true);
  p.abs.save();
  p.abs.fillStyle = `#${MASK.getHexString()}`;
  p.abs.beginPath();
  p.abs.rect(-4, -4, p.w + 8, p.h + 8);
  open.forEach((q, i) => (i ? p.abs.lineTo(q[0], q[1]) : p.abs.moveTo(q[0], q[1])));
  p.abs.closePath();
  p.abs.fill('evenodd');
  p.abs.restore();
  p.line(open, lw(2.2), { closed: true, wobble: 0.4, press: 0.25 });
  // Saum der Haube / hem of the balaclava
  p.mark(spline([P(-0.84, 0.14), P(-0.7, 0.4), P(0, 0.46), P(0.7, 0.4), P(0.84, 0.14)], 8), lw(1.2), EDGE, 0.7, { taper: 0.1 });

  wrinkle(p, M, [[0.05, 0.19 + m.browIn(1) * 0.4], [0.066, 0.25], [0.055, 0.31]], lw(1.5 + 1.2 * m.frown));
  for (const s of [-1, 1] as const) {
    drawEye(p, M, s, {
      x: 0.37, y: 0.115, w: 0.165, h: 0.086, tilt: 0.06, upper: 0.3 + m.upper(s), lower: 0.14 + m.lower(s), iris: mix(mat.blue, mat.white, 0.25), irisR: 0.074 * m.iris,
      look: [0, 0.05], crease: 0.034, bag: 0.4, lid: 4.4, wing: 0.03,
    }, lw);
    drawBrow(p, M, s, { x0: 0.07, y0: 0.2 + m.browIn(s), x1: 0.66, y1: 0.31 + m.browOut(s), arch: 0.026, thick: 0.1, strands: 3, wild: 0.5, seed: 21 + s }, lw);
  }
  wrinkle(p, M, [[0.24, -0.02], [0.38, -0.045], [0.52, -0.02]], lw(1.1));
  // Nasenruecken zwischen den Augen / bridge of the nose between the eyes
  p.line(spline([P(0.04, 0.16), P(0.045, 0.06), P(0.06, -0.04)], 5), lw(1.5), { taper: 0.4, wobble: 0.25 });
  // Narbe ueber dem linken Auge (im Bild rechts): von der Stirn durch die Braue auf die Wange
  // scar across the left eye (right in the picture): from the forehead through the brow onto the cheek
  const scar = spline([P(0.3, 0.385), P(0.33, 0.3), P(0.345, 0.2), P(0.4, 0.02), P(0.42, -0.04)], 8);
  p.mark(scar, lw(4.6), SCAR, 1, { taper: 0.25, wobble: 0.5, press: 0.5 });
  p.line(scar.map((q): Pt => [q[0] + lw(1.3), q[1]]), lw(0.9), { taper: 0.45, wobble: 0.5 });
  for (const [x, y] of [[0.325, 0.27], [0.37, 0.1]] as [number, number][]) p.mark([P(x - 0.03, y + 0.008), P(x + 0.035, y - 0.008)], lw(1.6), SCAR, 1, { taper: 0.3 });
}

/** Helm (gespiegelt: x = 0 vorn Mitte; t nach Hoehe vom Scheitel): Plattenfugen, Rand, Glanz / helmet (mirrored: x = 0 front centre; t by height from the crown): panel joints, rim, shine */
function paintHelmet(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / (Math.PI * HELM.R));
  const X = (a: number) => (Math.abs(a) / Math.PI) * W, Y = (y: number) => helmT(y) * H;
  // Rand entlang der Unterkante: heller Wulst und Fuge / rim along the lower edge: light roll and joint
  const rim: Pt[] = [], rim2: Pt[] = [];
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI; rim.push([X(a), Y(helmRim(a) + 0.012)]); rim2.push([X(a), Y(helmRim(a) + 0.034)]); }
  p.mark(rim, lw(3.2), EDGE, 0.85, { taper: 0, wobble: 0.2 });
  p.mark(rim2, lw(1.1), EDGE, 0.6, { taper: 0.02, wobble: 0.3 });
  p.line(rim.map((q): Pt => [q[0], q[1] - lw(2.6)]), lw(1.2), { taper: 0, wobble: 0.3 });
  // Plattenfugen: neben dem Grat, ueber der Stirn, an der Schlaefe (helle Linie, daneben Tusche)
  // panel joints: beside the ridge, above the brow, at the temple (a light line with ink beside it)
  const joint = (pts: Pt[]) => { p.mark(pts, lw(1.3), EDGE, 0.75, { taper: 0.08, wobble: 0.3 }); p.line(pts.map((q): Pt => [q[0] + lw(1.1), q[1] + lw(1.1)]), lw(1), { taper: 0.1, wobble: 0.3 }); };
  joint(spline([[X(0.33), Y(0.985)], [X(0.36), Y(0.9)], [X(0.4), Y(0.8)], [X(0.42), Y(0.762)]], 6));
  joint(spline([[X(0.36), Y(0.84)], [X(0.7), Y(0.85)], [X(1.0), Y(0.83)], [X(1.25), Y(0.78)]], 6));
  joint(spline([[X(1.25), Y(0.93)], [X(1.27), Y(0.8)], [X(1.24), Y(0.7)]], 5));
  joint(spline([[X(2.2), Y(0.95)], [X(2.25), Y(0.75)], [X(2.2), Y(0.55)]], 5));
  joint(spline([[X(1.9), Y(0.62)], [X(2.4), Y(0.6)], [X(3.14), Y(0.6)]], 5));
  for (const [a, y] of [[0.5, 0.815], [0.85, 0.822], [1.14, 0.79], [2.3, 0.63], [2.9, 0.625]] as [number, number][]) { p.spot(X(a), Y(y), lw(2.1), EDGE, 0.9); p.dot(X(a) + lw(0.9), Y(y) + lw(0.9), lw(1)); }
  // Glanz auf der Kuppel: Flaechen mit harter Kante (das Licht kommt von links oben; die Zelle ist gespiegelt, also dezent)
  // shine on the dome: areas with a hard edge (the light comes from the upper left; the cell is mirrored, so keep it subtle)
  p.fill(spline([[X(0.55), Y(0.96)], [X(0.8), Y(0.985)], [X(1.0), Y(0.95)], [X(0.95), Y(0.9)], [X(0.7), Y(0.905)]], 5, true), mat.white, 0.16);
  p.fill(spline([[X(1.05), Y(0.93)], [X(1.12), Y(0.94)], [X(1.1), Y(0.89)]], 4, true), mat.white, 0.14);
}

/** Mittelgrat (s quer, t vom Nacken zur Stirn): Kanten, Schrauben / centre ridge (s across, t from nape to brow): edges, screws */
function paintRidge(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.1);
  for (const x of [0.16, 0.84]) p.mark([[W * x, 4], [W * x, H - 4]], lw(1.2), EDGE, 0.7, { taper: 0.05, wobble: 0.2 });
  for (const y of [0.12, 0.34, 0.56, 0.7]) { p.spot(W / 2, H * y, lw(2), EDGE, 0.9); p.dot(W / 2 + lw(0.8), H * y + lw(0.8), lw(0.9)); }
  p.fill([[W * 0.28, H * 0.4], [W * 0.5, H * 0.38], [W * 0.5, H * 0.52], [W * 0.28, H * 0.54]], mat.white, 0.14);
}

function paintBadge(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.084);
  p.fill([[0, H * 0.62], [W, H * 0.62], [W, H], [0, H]], GOLD_DARK, 0.6);
  p.line(rrect(3, 3, W - 6, H - 6, 5), lw(1.3), { closed: true, wobble: 0.1 });
  p.fill(arc(W / 2, H / 2, W * 0.3, H * 0.3, 0, Math.PI * 2, 20), GOLD_LIGHT, 0.8);
  p.line(arc(W / 2, H / 2, W * 0.3, H * 0.3, 0, Math.PI * 2, 20), lw(1.1), { closed: true, wobble: 0.1 });
  paintEmblem(p, 'dravon', W / 2, H / 2, H * 0.2, BLACK, 0);
  for (const s of [0.1, 0.9]) p.dot(W * s, H / 2, lw(1.2));
}

function paintEarcup(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.152);
  p.spot(c, c, W * 0.47, shade(BLACK, 0.8));
  p.spot(c - W * 0.02, c - W * 0.03, W * 0.4, BLACK);
  // Goldring und Kappe / gold ring and cap
  p.mark(arc(c, c, W * 0.34, W * 0.34, 0, Math.PI * 2, 30), lw(3), GOLD, 1, { closed: true, wobble: 0.1, press: 0.1 });
  p.line(arc(c, c, W * 0.34 + lw(1.6), W * 0.34 + lw(1.6), 0, Math.PI * 2, 30), lw(1), { closed: true, wobble: 0.1 });
  p.line(arc(c, c, W * 0.34 - lw(1.6), W * 0.34 - lw(1.6), 0, Math.PI * 2, 30), lw(1), { closed: true, wobble: 0.1 });
  p.mark(arc(c, c, W * 0.2, W * 0.2, 0, Math.PI * 2, 20), lw(1.2), EDGE, 0.8, { closed: true, wobble: 0.1 });
  p.fill(arc(c - W * 0.07, c - W * 0.08, W * 0.07, W * 0.045, 0, Math.PI * 2, 10), mat.white, 0.2);
  p.line(arc(c, c, W * 0.47, W * 0.47, 0, Math.PI * 2, 30), lw(1.4), { closed: true, wobble: 0.1 });
}

/** Maske (s quer, t von der Oberkante zum Kinn): kantige Platten, Riemenlaschen, Nieten / mask (s across, t from the upper edge to the chin): angular plates, strap lugs, rivets */
function paintMask(p: Pen): void {
  const W = p.w, H = p.h, cx = W / 2, lw = lineScale(W / 0.25);
  const joint = (pts: Pt[], w = 1.3) => { p.mark(pts, lw(w), EDGE, 0.75, { taper: 0.08, wobble: 0.3 }); p.line(pts.map((q): Pt => [q[0] + lw(1), q[1] + lw(1)]), lw(1), { taper: 0.1, wobble: 0.3 }); };
  // Oberkante: verstaerkter Rand ueber Nase und Wangen / upper edge: reinforced rim over nose and cheeks
  joint(spline([[4, H * 0.1], [W * 0.26, H * 0.075], [cx, H * 0.055], [W * 0.74, H * 0.075], [W - 4, H * 0.1]], 6), 1.6);
  p.fill([[0, 0], [W, 0], [W, H * 0.045], [0, H * 0.045]], EDGE, 0.5);
  for (const s of [-1, 1]) {
    // Wangenplatte: Kante von der Nase zum Kiefer, Laschen fuer den Riemen / cheek plate: edge from the nose to the jaw, lugs for the strap
    joint([[cx + s * W * 0.07, H * 0.07], [cx + s * W * 0.15, H * 0.2], [cx + s * W * 0.3, H * 0.3], [cx + s * W * 0.33, H * 0.56], [cx + s * W * 0.2, H * 0.78], [cx + s * W * 0.08, H * 0.86]]);
    joint([[cx + s * W * 0.33, H * 0.3], [cx + s * W * 0.47, H * 0.26]]);
    joint([[cx + s * W * 0.33, H * 0.56], [cx + s * W * 0.45, H * 0.6]]);
    p.fill(rrect(cx + s * W * 0.4 - 11, H * 0.36, 22, 30, 3), shade(MASK, 0.6));
    p.mark(rrect(cx + s * W * 0.4 - 11, H * 0.36, 22, 30, 3), lw(1.1), EDGE, 0.8, { closed: true, wobble: 0.1 });
    // Goldnieten / gold rivets
    for (const [dx, y] of [[0.24, 0.2], [0.38, 0.7], [0.14, 0.9]] as [number, number][]) goldDisc(p, cx + s * W * dx, H * y, lw(2.6), lw(0.9));
    // Lueftungsschlitze unter dem Filter / vent slits below the filter
    for (const k of [0, 1, 2]) p.line([[cx + s * (W * 0.05 + k * 9), H * 0.82], [cx + s * (W * 0.04 + k * 9), H * 0.9]], lw(1.6), { taper: 0.15, wobble: 0.1 });
  }
  // Schatten unter dem Filter, Kinnkante / shade below the filter, chin edge
  p.fill(arc(cx + 4, H * 0.5 + 8, W * 0.2, H * 0.2, 0, Math.PI * 2, 24), mat.ink, 0.4);
  joint(spline([[W * 0.3, H * 0.93], [cx, H * 0.965], [W * 0.7, H * 0.93]], 5));
  // Glanz auf der Schnauze / shine on the muzzle
  p.fill(spline([[W * 0.27, H * 0.28], [W * 0.36, H * 0.22], [W * 0.4, H * 0.3], [W * 0.31, H * 0.36]], 4, true), mat.white, 0.13);
}

function paintFilter(p: Pen): void {
  const W = p.w, c = W / 2, lw = lineScale(W / 0.132);
  p.spot(c, c, W * 0.49, GOLD);
  p.fill(arc(c + 2, c + 3, W * 0.46, W * 0.46, -0.2, Math.PI * 0.9, 16), GOLD_DARK);
  p.spot(c - 1, c - 2, W * 0.4, GOLD);
  p.fill(arc(c - W * 0.2, c - W * 0.26, W * 0.13, W * 0.06, 0, Math.PI * 2, 10), GOLD_LIGHT);
  p.line(arc(c, c, W * 0.49, W * 0.49, 0, Math.PI * 2, 30), lw(1.5), { closed: true, wobble: 0.1 });
  // dunkler Einsatz mit Lamellen / dark insert with slats
  p.spot(c, c, W * 0.33, shade(BLACK, 0.7));
  p.line(arc(c, c, W * 0.33, W * 0.33, 0, Math.PI * 2, 26), lw(1.6), { closed: true, wobble: 0.1 });
  for (let i = -2; i <= 2; i++) {
    const y = c + i * W * 0.105, half = Math.sqrt(Math.max(0, (W * 0.3) ** 2 - (y - c) ** 2));
    p.mark([[c - half, y], [c + half, y]], lw(2.6), GOLD, 1, { taper: 0.04, wobble: 0.15, press: 0.1 });
    p.mark([[c - half * 0.9, y - lw(0.9)], [c + half * 0.5, y - lw(0.9)]], lw(0.8), GOLD_LIGHT, 0.9, { taper: 0.3 });
  }
}

function paintChest(p: Pen): void {
  const C = chestMap(T, p.w, p.h), P = C.P, u = C.u, lw = lineScale(u(1));
  const top = T.h + T.rise;
  p.shade(spline([P(-0.22, top), P(-0.17, 0.33), P(0, 0.3), P(0.17, 0.33), P(0.22, top)], 6), 0.72, 0.9);
  for (const s of [-1, 1]) p.shade(spline([P(s * 0.18, top), P(s * 0.23, 0.3), P(s * 0.35, 0.25), P(s * 0.46, 0.26), P(s * 0.47, top)], 6), 0.72, 0.9);
  p.gradient(0, P(0, 0.12)[1], p.w, p.h - P(0, 0.12)[1], P(0, 0.12), P(0, 0), 1, 0.8);
  p.shade(spline([P(0.31, 0.26), P(0.35, 0.16), P(0.36, 0)], 5).concat([P(0.46, 0), P(0.46, 0.26)]), 0.84, 0.9);
  // Leiste: zwei Goldpaspeln, dazwischen die Naht / placket: two gold pipings, the seam between
  for (const s of [-1, 1]) p.band(spline([P(s * 0.014, 0.31), P(s * 0.013, 0.18), P(s * 0.013, -0.01)], 6), u(0.011), GOLD, lw(1.2));
  p.line(spline([P(0, 0.31), P(0, -0.01)], 3), lw(1.2), { taper: 0.05, wobble: 0.2 });
  for (const s of [-1, 1]) {
    // Brusttasche: Klappe mit Spitze, Tasche darunter, Goldlitze darueber / chest pocket: pointed flap, pocket below, gold bar above
    const x = s * POCKET_X, w = 0.105, [y0, y1] = POCKET_Y;
    const body: Pt[] = [P(x - w, y1 - 0.03), P(x + w, y1 - 0.03), P(x + w, y0), P(x - w, y0)];
    p.shade(body, 0.92, 0.9);
    p.line(body, lw(1.5), { closed: true, wobble: 0.3 });
    p.stitch([P(x - w + 0.01, y1 - 0.06), P(x - w + 0.01, y0 + 0.01), P(x + w - 0.01, y0 + 0.01), P(x + w - 0.01, y1 - 0.06)], 4, 3.2, 1.1, 0.62);
    const flap: Pt[] = [P(x - w - 0.006, y1), P(x + w + 0.006, y1), P(x + w + 0.006, y1 - 0.045), P(x, y1 - 0.075), P(x - w - 0.006, y1 - 0.045)];
    p.shade(flap.map((q): Pt => [q[0] + u(0.004), q[1] + u(0.007)]), 0.62, 0.9);
    p.shade(flap, 1.12, 0.9);
    p.line(flap, lw(1.7), { closed: true, wobble: 0.3 });
    p.fill([P(x - 0.06, y1 + 0.03), P(x + 0.06, y1 + 0.03), P(x + 0.06, y1 + 0.014), P(x - 0.06, y1 + 0.014)], GOLD);
    p.line([P(x - 0.06, y1 + 0.03), P(x + 0.06, y1 + 0.03), P(x + 0.06, y1 + 0.014), P(x - 0.06, y1 + 0.014)], lw(1.2), { closed: true, wobble: 0.15 });
    // Paspel von der Schulter zum Saum, Aermelnaht, Falten / piping from the shoulder to the hem, sleeve seam, folds
    p.band(spline([P(s * 0.36, 0.31), P(s * 0.385, 0.2), P(s * 0.4, 0.08), P(s * 0.402, -0.01)], 6), u(0.009), GOLD, lw(1.1));
    p.line(spline([P(s * 0.1, 0.32), P(s * 0.105, 0.18), P(s * 0.1, -0.01)], 6), lw(1.2), { taper: 0.3, wobble: 0.4 });
    fold(p, spline([P(s * 0.37, 0.07), P(s * 0.31, 0.045), P(s * 0.25, 0.04)], 5), lw(1.3), u(0.013) * s, 0.8);
    fold(p, spline([P(s * 0.37, 0.26), P(s * 0.34, 0.275), P(s * 0.32, 0.3)], 5), lw(1.2), u(0.01) * s, 0.8);
  }
  p.scratches(0, P(0, 0.05)[1], p.w, p.h - P(0, 0.05)[1] - 4, 4, 613, 18);
}

/** Stehkragen (gespiegelt): Goldpaspel, zwei Goldlitzen / standing collar (mirrored): gold piping, two gold bars */
function paintCollar(p: Pen): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.44);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 0.84, 1.04);
  p.band([[9, H - 5], [W + 4, H - 5]], 7, GOLD, lw(1.3));
  p.band([[5, 3], [5, H - 3]], 7, GOLD, lw(1.3));
  p.line([[1, -2], [1, H + 2]], lw(2.4), { taper: 0, wobble: 0.1 });
  for (const x of [34, 62]) {
    p.fill(rrect(x, H * 0.36, 20, 9, 2), GOLD);
    p.line(rrect(x, H * 0.36, 20, 9, 2), lw(1.1), { closed: true, wobble: 0.1 });
  }
  goldDisc(p, 104, H * 0.44, 5.5, lw(1));
  p.line([[10, 7], [W + 3, 7]], lw(1.1), { taper: 0.02, wobble: 0.3 });
}

/** Stahlklotz (s von vorn nach hinten, t vom Hals nach aussen): Kante, Niete, Glanz; gold = Goldkappe am aeusseren Rand / steel block (s from front to back, t from the neck outward): edge, rivet, shine; gold = gold cap at the outer edge */
function paintPlate(p: Pen, gold: boolean): void {
  const W = p.w, H = p.h, lw = lineScale(W / 0.115);
  p.gradient(0, 0, W, H, [0, 0], [0, H], 1.25, 0.8);
  if (gold) {
    p.fill([[0, H * 0.62], [W, H * 0.62], [W, H], [0, H]], GOLD);
    p.fill([[0, H * 0.84], [W, H * 0.84], [W, H], [0, H]], GOLD_DARK);
    p.line([[-2, H * 0.62], [W + 2, H * 0.62]], lw(1.2), { taper: 0, wobble: 0.1 });
  }
  p.mark(rrect(4, 4, W - 8, H - 8, 4), lw(1), EDGE, 0.8, { closed: true, wobble: 0.1 });
  p.rivet(W * 0.5, H * 0.3, lw(1.9));
  p.fill([[W * 0.14, H * 0.14], [W * 0.38, H * 0.12], [W * 0.34, H * 0.26], [W * 0.14, H * 0.3]], mat.white, 0.28);
}

function paintButton(p: Pen): void {
  const c = p.w / 2, lw = lineScale(p.w / 0.036);
  goldDisc(p, c, c, p.w * 0.47, lw(1.4));
  paintEmblem(p, 'dravon', c, c, p.w * 0.22, GOLD_DARK, lw(0.8));
}

function cells(m: MoodArt): Cell[] {
  return [
    { name: 'face', w: 512, h: 512, paint: (p) => paintFace(p, m) },
    { name: 'helmet', w: 432, h: 288, paint: paintHelmet },
    { name: 'ridge', w: 72, h: 288, paint: paintRidge },
    { name: 'mask', w: 320, h: 272, paint: paintMask },
    { name: 'chest', w: 640, h: 288, paint: paintChest },
    ...bodyCells({ neck: 0.8, plain: true }).filter((c) => c.name !== 'ear'),
    { name: 'collar', w: 256, h: 72, paint: paintCollar },
    { name: 'plate', w: 80, h: 64, paint: (p) => paintPlate(p, false) },
    { name: 'plateGold', w: 80, h: 64, paint: (p) => paintPlate(p, true) },
    { name: 'earcup', w: 112, h: 112, paint: paintEarcup },
    { name: 'filter', w: 112, h: 112, paint: paintFilter },
    { name: 'badge', w: 104, h: 64, paint: paintBadge },
    { name: 'button', w: 48, h: 48, paint: paintButton },
  ];
}

export const dravon: LeaderDef = { cells, build, side: -1 };
