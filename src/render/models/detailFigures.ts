/**
 * Feindetails fuer Figuren (nur hohe Qualitaet, Detailrunde 4): modellierte Comic-Gesichter mit Augen, Lidern, Brauen,
 * Nase, Mund, Ohren und gemaltem Haar; Haende mit Fingern; Stiefel mit Absatz, Schnuerung und Riemen; Koppelschloss,
 * Taschenknoepfe, Koppeltragegestell, Gewehrdetails (Visier, Kammerstaengel, Abzugsbuegel, Riemen, Laufringe).
 * Niedrige Qualitaet ruft nichts hiervon auf und bleibt unveraendert.
 * Fine details for figures (high quality only, detail round 4): sculpted comic faces with eyes, lids, brows, nose,
 * mouth, ears and painted hair; hands with fingers; boots with heel, lacing and strap; belt buckle, pocket buttons,
 * webbing harness, rifle details (sights, bolt handle, trigger guard, sling, barrel bands). Low quality calls none of
 * this and stays unchanged.
 * Kopfrahmen wie in headgear.ts: Boden bei y=0, Gesicht nach +z / head frame as in headgear.ts: base at y=0, face towards +z.
 */
import * as THREE from 'three';
import { ball, Builder, capsule, col, keepNormals, mix, rng, shade, softBox, type ColorLike, type V3 } from './kit';
import { mat } from './look';
import { smoothNormals } from './sculpt';

const HALF_PI = Math.PI / 2;
export type Detail = 0 | 1 | 2;
const sstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- Ausrichtung / orientation ----------

/** Euler-Drehung, die +z auf n legt (kleinste Drehung) / Euler rotation taking +z onto n (minimal rotation) */
export function eulerZ(n: THREE.Vector3): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

/**
 * Euler-Drehung eines Rahmens mit lokaler y-Achse entlang dir und lokaler x-Achse so nah wie moeglich an side
 * (fuer Teile an Gliedern, deren Seite feststehen muss, z. B. Beintaschen aussen).
 * Euler rotation of a frame with local y along dir and local x as close as possible to side
 * (for parts on limbs whose side must be fixed, e.g. thigh pockets on the outside).
 */
export function eulerYX(dir: THREE.Vector3, side: THREE.Vector3): V3 {
  const y = dir.clone().normalize();
  const x = side.clone().addScaledVector(y, -side.dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  const e = new THREE.Euler().setFromRotationMatrix(m, 'XYZ');
  return [e.x, e.y, e.z];
}

/** Bogen eines Rings (Torus) mit glatten Normalen, Bogenmitte bei +y / arc of a ring (torus) with smooth normals, arc centred at +y */
export function arcRing(r: number, tube: number, arc: number, ts = 8, rs = 3): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, tube, rs, ts, arc);
  g.rotateZ(HALF_PI - arc / 2);
  return keepNormals(g);
}

/** Stab (Kapsel) entlang x / rod (capsule) along x */
function rodX(r: number, len: number, seg = 5): THREE.BufferGeometry {
  return capsule(r, r, len, seg, 1).rotateZ(HALF_PI);
}

// ---------- Kopf / head ----------

/** Halbachsen und Mitte des modellierten Kopfes (wie der alte Kopfquader) / half axes and centre of the sculpted head (like the old head box) */
const HEAD = { y: 0.049, A: 0.053, B: 0.05, C: 0.051 };
/** Superellipsoid-Exponent: etwas kantiger als eine Kugel, der Comic-Block bleibt / superellipsoid exponent: a bit boxier than a sphere, the comic block stays */
const HEAD_EXP = 2.5;

/** Richtung aus Gesichtskoordinaten (fx, fy) / direction from face coordinates (fx, fy) */
function dirOf(fx: number, fy: number): THREE.Vector3 {
  return new THREE.Vector3(fx, fy, Math.sqrt(Math.max(0.04, 1 - fx * fx - fy * fy))).normalize();
}

/** Punkt der Kopfform fuer eine Einheitsrichtung / point of the head shape for a unit direction */
function headShape(n: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  const p = HEAD_EXP;
  const r = Math.pow(Math.abs(n.x) ** p + Math.abs(n.y) ** p + Math.abs(n.z) ** p, -1 / p);
  let x = n.x * r;
  const y = n.y * r;
  let z = n.z * r;
  const front = sstep(0.15, 0.8, n.z);
  // Kiefer schmaler, Hinterkopf runder / narrower jaw, rounder back of the head
  if (y < 0) {
    const t = sstep(0, 1, -y);
    x *= 1 - 0.2 * t * t;
    if (z < 0) z *= 1 - 0.22 * t * t;
  }
  if (z < 0) z *= 1.05;
  // Brauenbogen, Augenhoehlen, Wangenknochen, Kinn / brow ridge, eye sockets, cheekbones, chin
  z += 0.05 * front * Math.exp(-(((y - 0.32) / 0.13) ** 2)) * Math.exp(-((x / 0.7) ** 4));
  for (const s of [-1, 1]) {
    z -= 0.04 * front * Math.exp(-(((x - s * 0.38) / 0.2) ** 2 + ((y - 0.06) / 0.14) ** 2));
    const g = Math.exp(-(((x - s * 0.56) / 0.2) ** 2 + ((y + 0.2) / 0.18) ** 2));
    z += 0.03 * front * g;
    x += s * 0.02 * g;
  }
  z += 0.05 * front * Math.exp(-((x / 0.3) ** 2 + ((y + 0.82) / 0.2) ** 2));
  return out.set(x * HEAD.A, y * HEAD.B + HEAD.y, z * HEAD.C);
}

/** Oberflaechenpunkt und Normale vorn bei (fx, fy), um lift nach aussen versetzt / front surface point and normal at (fx, fy), lifted by lift */
export function headAt(fx: number, fy: number, lift = 0): { p: V3; n: THREE.Vector3 } {
  const P = headShape(dirOf(fx, fy));
  const e = 1e-3;
  const t1 = headShape(dirOf(fx + e, fy)).sub(P);
  const t2 = headShape(dirOf(fx, fy + e)).sub(P);
  const N = t1.cross(t2).normalize();
  if (N.z < 0) N.negate();
  P.addScaledVector(N, lift);
  return { p: [P.x, P.y, P.z], n: N };
}

/** Haar- und Gesichtsfarben einer Figur, aus dem Samen / hair and face colours of a figure, from the seed */
export interface Persona {
  hair: THREE.Color;
  /** Brauenwinkel (positiv = grimmig, innen tief) / brow angle (positive = grim, inner end low) */
  brow: number;
  /** Lid ueber dem Auge 0..1 / lid over the eye 0..1 */
  lid: number;
  /** Mundwinkel (-1 herab, +1 hoch) / mouth corners (-1 down, +1 up) */
  mouth: number;
  nose: number;
  stubble: boolean;
  tache: boolean;
}

export function persona(seed: number): Persona {
  const R = rng(seed * 7 + 3);
  const hairs = [mat.dark, shade(mat.wood, 0.72), mix(mat.sand, mat.wood, 0.3), mix(mat.rust, mat.orange, 0.35), mat.darkMid];
  return {
    hair: col(hairs[Math.floor(R() * hairs.length) % hairs.length]),
    brow: 0.05 + R() * 0.3,
    lid: 0.18 + R() * 0.2,
    mouth: R() * 1.6 - 1,
    nose: 0.85 + R() * 0.35,
    stubble: R() < 0.4,
    tache: R() < 0.22,
  };
}

/**
 * Modellierter Kopf (glatte Normalen, gemalte Vertexfarben: Haaransatz, Koteletten, Bartschatten, Wangen).
 * Sculpted head (smooth normals, painted vertex colours: hairline, sideburns, stubble shadow, cheeks).
 */
function headMesh(ws: number, hs: number, skin: ColorLike, P: Persona, hair: boolean): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const pos = g.getAttribute('position');
  const cols = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3(), q = new THREE.Vector3();
  const sk = col(skin), cheek = mix(skin, mat.red, 0.16), stub = mix(skin, P.hair, 0.3);
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    let c = sk;
    const ax = Math.abs(n.x);
    // Wangen leicht geroetet / cheeks slightly flushed
    if (n.z > 0.5 && ax > 0.32 && ax < 0.75 && n.y < -0.05 && n.y > -0.45) c = cheek;
    if (P.stubble && n.y < -0.42 && n.z > -0.15) c = stub;
    if (hair) {
      const top = n.y > 0.58 - 0.25 * Math.max(0, -n.z);
      const back = n.z < -0.2 && n.y > -0.5;
      const side = ax > 0.7 && n.y > 0.15 && n.z < 0.2;
      const burn = ax > 0.8 && n.z > -0.25 && n.z < 0.3 && n.y > -0.25;
      if (top || back || side || burn) c = P.hair;
    }
    cols.set([c.r, c.g, c.b], i * 3);
    headShape(n, q);
    pos.setXYZ(i, q.x, q.y, q.z);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  smoothNormals(g, 1);
  return g;
}

// ---------- Schalen ohne Tuschelinie / shells without an ink line ----------
// Die Tuschelinie ist eine nach aussen versetzte Rueckseiten-Huelle: geschlossene Kleinteile im Gesicht bekamen dicke
// Ringe. Gesichtsteile sind darum vorn offene Halbschalen (alle Normalen nach vorn), Iris, Lid und Wimpernlinie liegen
// als Ausschnitte auf groesseren, konzentrischen Schalen ueber dem Augapfel: nichts durchdringt sich, keine Ringe.
// The ink line is a back-face hull pushed outward: closed small parts on the face got thick rings. Face parts are
// therefore half shells open at the back (all normals facing forward); iris, lid and lash line lie as sections of larger
// concentric shells over the eyeball: nothing intersects, no rings.

/** Kugelausschnitt mit glatten Normalen (Pol +y) / sphere section with smooth normals (pole +y) */
function sph(r: number, ws: number, hs: number, phi0: number, phiL: number, th0: number, thL: number): THREE.BufferGeometry {
  return keepNormals(new THREE.SphereGeometry(r, ws, hs, phi0, phiL, th0, thL));
}
/** Vordere Halbschale einer Kugel (z >= 0) / front half shell of a sphere (z >= 0) */
export function lens(ws = 8, hs = 5): THREE.BufferGeometry {
  return sph(1, ws, hs, 0, Math.PI, 0, Math.PI);
}
/** Kappe um +z mit Winkelradius th auf Radius r, um gx (um y) und gy (um x) gedreht / cap around +z with angular radius th on radius r, turned by gx (about y) and gy (about x) */
function capZ(r: number, th: number, ws: number, gx = 0, gy = 0): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, ws, 2, 0, Math.PI * 2, 0, th);
  g.rotateX(HALF_PI);
  if (gy) g.rotateX(-gy);
  if (gx) g.rotateY(gx);
  return keepNormals(g);
}

/**
 * Comic-Auge im lokalen Rahmen (+z nach aussen): Augapfel als Halbschale, darueber Iris mit Lichtpunkt, Hautlid und
 * Wimpernlinie auf konzentrischen Schalen.
 * Comic eye in a local frame (+z outward): eyeball as a half shell, over it iris with glint, skin lid and lash line on
 * concentric shells.
 */
export function comicEye(b: Builder, d: Detail, side: number, skin: ColorLike, o: { w?: number; h?: number; lid?: number; tilt?: number; iris?: ColorLike } = {}) {
  const w = o.w ?? 0.0115, h = o.h ?? 0.0135, dz = 0.0055;
  const ws = d === 2 ? 12 : d === 1 ? 9 : 7, hs = d === 2 ? 8 : d === 1 ? 6 : 4;
  const white = mix(mat.white, mat.paper, 0.35);
  b.group({ r: [0, 0, (o.tilt ?? 0.1) * -side], s: [w, h, dz] }, () => {
    b.add(sph(1, ws, hs, 0, Math.PI, 0, Math.PI), white, { p: [0, 0, -0.15] });
    // Iris, Blick leicht zur Mitte und nach unten / iris, gaze slightly towards the centre and down
    b.add(capZ(1.04, 0.58, d >= 1 ? 10 : 7, -side * 0.12, -0.1), o.iris ?? mat.ink, { p: [0, 0, -0.15] });
    if (d === 2) b.add(capZ(1.08, 0.16, 6, -side * 0.12 + 0.28, 0.22), mat.white, { p: [0, 0, -0.15] });
    if (d === 0) return;
    // Lid und Wimpernlinie / lid and lash line
    const lid = o.lid ?? 0.25;
    const th = Math.acos(Math.max(-0.9, Math.min(0.9, 1 - 2 * lid)));
    if (d === 2) b.add(sph(1.1, ws, 3, 0, Math.PI, 0, th), shade(skin, 0.95), { p: [0, 0, -0.15] });
    b.add(sph(1.15, ws, 1, 0, Math.PI, th - 0.2, 0.3), mat.ink, { p: [0, 0, -0.15] });
  });
}

/**
 * Feines Gesicht (hohe Qualitaet). eyes=false bei Sonnenbrille oder Visier (Augen verdeckt), hair=false wenn eine eigene
 * Frisur folgt. Detailstufe 0 (Besatzung) bekommt nur Augen, Brauen, Nase, Mund und Ohren in wenigen Segmenten.
 * Fine face (high quality). eyes=false for sunglasses or a visor (eyes hidden), hair=false when an own hairdo follows.
 * Detail level 0 (crew) only gets eyes, brows, nose, mouth and ears in few segments.
 */
export function fineFace(b: Builder, d: Detail, seed: number, o: { eyes?: boolean; brows?: boolean; hair?: boolean | ColorLike; skin?: ColorLike; shout?: boolean } = {}) {
  const P = persona(seed);
  // eigene Haarfarbe (Wissenschaftler, Berserker) / own hair colour (scientist, berserker)
  if (o.hair !== undefined && typeof o.hair !== 'boolean') P.hair = col(o.hair);
  const skin = o.skin ?? mat.skin;
  const eyes = o.eyes ?? true;
  const [ws, hs] = d === 2 ? [18, 13] : d === 1 ? [14, 10] : [12, 8];
  b.addSmooth(headMesh(ws, hs, skin, P, o.hair !== false));
  /** Teil auf der Gesichtsflaeche bei (fx, fy) / part on the face surface at (fx, fy) */
  const on = (fx: number, fy: number, lift: number, fn: () => void) => {
    const A = headAt(fx, fy, lift);
    b.group({ p: A.p, r: eulerZ(A.n) }, fn);
  };
  // Augen / eyes
  if (eyes) for (const s of [-1, 1]) on(s * 0.38, 0.04, -0.0005, () => comicEye(b, d, s, skin, { lid: P.lid, tilt: P.brow * 0.6 }));
  // Brauen als flache Halbschalen / brows as flat half shells
  if (o.brows ?? true) for (const s of [-1, 1]) on(s * 0.38, 0.34, -0.0006, () => {
    b.add(lens(d === 2 ? 8 : 6, 3), P.hair, { r: [0, 0, -s * P.brow], s: [0.0155, 0.0042, 0.0032] });
  });
  // Nase: eine Kugel mit Tusche nur am Umriss, Loecher als Schalen / nose: one ball, inked only at its outline, nostrils as shells
  const k = P.nose;
  on(0, -0.2, 0.0035 * k, () => {
    b.add(ball(1, d === 2 ? 10 : 7, d === 2 ? 7 : 5), shade(skin, 0.97), { p: [0, -0.001, 0], s: [0.0105 * k, 0.0125 * k, 0.0095 * k] });
    if (d === 2) for (const s of [-1, 1]) b.add(lens(5, 3), shade(skin, 0.45), { p: [s * 0.0045 * k, -0.0105 * k, 0.003], r: [1.1, 0, 0], s: [0.0026, 0.0016, 0.0012] });
  });
  // Schnurrbart / moustache
  if (P.tache && d >= 1) on(0, -0.42, -0.0004, () => {
    for (const s of [-1, 1]) b.add(lens(6, 3), P.hair, { p: [s * 0.0085, 0, 0], r: [0, 0, s * 0.28], s: [0.011, 0.0042, 0.0045] });
  });
  // Mund / mouth
  const lip = shade(mix(skin, mat.red, 0.3), 0.5);
  if (o.shout) {
    on(0, -0.6, -0.0004, () => {
      b.add(lens(10, 5), mat.ink, { s: [0.0125, 0.0095, 0.003] });
      b.add(capZ(1.06, 0.5, 8, 0, -0.45), mat.red, { s: [0.0125, 0.0095, 0.003] });
      b.add(capZ(1.06, 0.3, 8, 0, 0.6), mat.white, { s: [0.0125, 0.0095, 0.003], })
    });
  } else on(0, -0.58, -0.0004, () => {
    b.add(lens(d === 2 ? 8 : 6, 3), lip, { s: [0.0115, 0.0019, 0.0022] });
    if (d >= 1) for (const s of [-1, 1]) b.add(lens(5, 3), lip, { p: [s * 0.0115, P.mouth * 0.0016, 0], r: [0, 0, s * P.mouth * 0.6], s: [0.0045, 0.0016, 0.002] });
    if (d === 2) b.add(lens(8, 4), shade(mix(skin, mat.red, 0.14), 0.98), { p: [0, -0.0055, -0.0005], s: [0.0095, 0.0036, 0.0028] });
  });
  // Ohren mit Ohrmuschel / ears with concha
  for (const s of [-1, 1]) {
    const Pe = headShape(new THREE.Vector3(s, 0.02, -0.12).normalize());
    const out = new THREE.Vector3(s, 0, 0.22).normalize();
    b.group({ p: [Pe.x, Pe.y - 0.002, Pe.z], r: eulerZ(out) }, () => {
      b.add(ball(1, d === 2 ? 8 : 6, d === 2 ? 6 : 4), shade(skin, 0.97), { p: [0, 0, 0.0005], s: [0.0115, 0.0175, 0.0048] });
      if (d >= 1) b.add(lens(6, 4), shade(skin, 0.76), { p: [s * 0.0012, -0.001, 0.004], s: [0.0062, 0.0105, 0.0018] });
    });
  }
}

/** Augen auf einer flachen Front (Sturmhaube) / eyes on a flat front (balaclava) */
export function flatEyes(b: Builder, d: Detail, y: number, z: number, x: number, seed: number) {
  const P = persona(seed);
  for (const s of [-1, 1]) b.group({ p: [s * x, y, z] }, () => comicEye(b, d, s, mat.skin, { lid: P.lid, tilt: P.brow * 0.6, w: 0.0105, h: 0.0112 }));
}

/**
 * Sonnenbrille als gewoelbte Glaeser mit Lichtkante, Steg und Buegeln (hohe Qualitaet).
 * Sunglasses as curved lenses with a glint, bridge and temples (high quality).
 */
export function fineSunglasses(b: Builder, c: ColorLike = mat.ink) {
  for (const s of [-1, 1]) {
    const E = headAt(s * 0.38, 0.05, 0.0005);
    b.group({ p: E.p, r: eulerZ(E.n), s: [0.0175, 0.0125, 0.0055] }, () => {
      b.add(lens(12, 6), c, {});
      b.add(capZ(1.05, 0.22, 6, s * 0.35, 0.35), mix(mat.white, mat.glass, 0.4), {});
    });
    b.tube([s * 0.044, 0.058, 0.04], [s * 0.056, 0.056, -0.004], 0.0016, 4, c);
  }
  const Bc = headAt(0, 0.12, 0.0015);
  b.group({ p: Bc.p, r: eulerZ(Bc.n) }, () => b.add(lens(6, 3), c, { s: [0.009, 0.0025, 0.002] }));
}

// ---------- Haende / hands ----------

/**
 * Faust mit vier Fingern und Daumen im Unterarmrahmen (y entlang des Arms, Hand bei y=len); ersetzt den Faeustling.
 * Fist with four fingers and a thumb in the forearm frame (y along the arm, hand at y=len); replaces the mitt.
 */
export function fineHand(b: Builder, side: number, len: number, skin: ColorLike, glove?: ColorLike) {
  const c = glove ?? skin;
  // Handruecken / back of the hand
  b.add(ball(1, 10, 6), c, { p: [0, len + 0.002, -0.002], s: [0.0205, 0.0225, 0.0185] });
  // Finger: vier gekruemmte Glieder ueber der Griffseite / fingers: four curled segments over the grip side
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.0098;
    b.add(capsule(0.0058, 0.0052, 0.024 - Math.abs(i - 1.5) * 0.002, 6, 1), c, { p: [x, len + 0.02, 0.009], r: [1.25, 0, 0] });
    // Knoechel / knuckle
    b.add(ball(1, 5, 3), shade(c, 0.94), { p: [x, len + 0.021, -0.004], s: [0.0052, 0.004, 0.0045] });
  }
  // Daumen / thumb
  b.add(capsule(0.0065, 0.0055, 0.026, 6, 1), c, { p: [-side * 0.019, len + 0.008, 0.012], r: [0.9, 0, side * 0.5] });
  // Handschuhbund / glove cuff
  if (glove) b.add(capsule(0.0235, 0.0235, 0.014, 10, 1, 0.3), shade(glove, 0.82), { p: [0, len - 0.014, 0] });
}

// ---------- Stiefel / boots ----------

/**
 * Stiefel-Details im Knoechelrahmen (Stiefel um [0, -0.016, 0.014], 0.064 x 0.04 x 0.094): Absatz, Rahmennaht,
 * Zehenkappe, Lasche, Kreuzschnuerung, Schaftriemen mit Schnalle.
 * Boot details in the ankle frame (boot around [0, -0.016, 0.014], 0.064 x 0.04 x 0.094): heel, welt, toe cap,
 * tongue, criss-cross lacing, shaft strap with buckle.
 */
export function fineBoot(b: Builder, boot: ColorLike) {
  // Absatz und Rahmennaht / heel and welt
  b.add(capsule(0.006, 0.006, 0.068, 6, 1).rotateZ(HALF_PI).scale(1, 1, 3.2), mat.ink, { p: [0, -0.037, -0.019] });
  b.add(rodX(0.0028, 0.07, 4), shade(boot, 1.45), { p: [0, -0.027, 0.06] });
  // Zehenkappe / toe cap
  b.add(ball(1, 10, 6), shade(boot, 1.22), { p: [0, -0.019, 0.044], s: [0.031, 0.019, 0.022] });
  // Lasche und Kreuzschnuerung / tongue and criss-cross lacing
  b.add(capsule(0.0105, 0.0105, 0.03, 6, 1, 0.5).scale(1, 1, 0.35), shade(boot, 1.3), { p: [0, 0.012, 0.031], r: [-0.35, 0, 0] });
  const lace = mix(mat.paper, mat.sand, 0.4);
  for (let i = 0; i < 3; i++) {
    const z = 0.022 + i * 0.011, y = 0.0055 - i * 0.003;
    for (const s of [-1, 1]) b.add(rodX(0.0016, 0.022, 4), lace, { p: [0, y, z], r: [0, s * 0.55, -0.3] });
  }
  // Schaftriemen mit Schnalle / shaft strap with buckle
  b.add(capsule(0.0335, 0.0335, 0.012, 12, 1, 0.25), shade(boot, 1.35), { p: [0, 0.012, 0.004], s: [1, 1, 1.02] });
  b.add(ball(1, 5, 3), mat.metalLight, { p: [0.034, 0.012, 0.004], s: [0.003, 0.006, 0.0065] });
}

// ---------- Ausruestung / equipment ----------

/** Druckknopf / snap button */
export function snap(b: Builder, p: V3, r = 0.0034, c: ColorLike = mat.dark) {
  b.add(ball(1, 5, 3), c, { p, s: [r, r, r * 0.6] });
}

/**
 * Feinheiten am Koppel (Beckenrahmen, vorn +z): Koppelschloss mit Dorn, Druckknoepfe an den Taschen, Handgranaten mit
 * Bugel und Ring, Pistolengriff im Holster, Messergriff mit Parierstange, Feldflaschendeckel mit Kettchen.
 * Belt fine details (pelvis frame, front +z): buckle with prong, snaps on the pouches, grenades with spoon and ring,
 * pistol grip in the holster, knife grip with guard, canteen cap with chain.
 */
export function fineBelt(b: Builder, gear: ColorLike, sec: ColorLike, full: boolean) {
  // Koppelschloss / buckle
  b.add(capsule(0.0022, 0.0022, 0.026, 5, 1).rotateZ(HALF_PI), mat.metalLight, { p: [0, 0.029, 0.057] });
  b.add(capsule(0.0022, 0.0022, 0.026, 5, 1).rotateZ(HALF_PI), mat.metalLight, { p: [0, 0.011, 0.057] });
  for (const s of [-1, 1]) b.add(capsule(0.0022, 0.0022, 0.02, 5, 1), mat.metalLight, { p: [s * 0.013, 0.02, 0.057] });
  b.add(rodX(0.0016, 0.012, 4), mat.metal, { p: [0.002, 0.02, 0.058] });
  // Koppelschlaufen / belt keepers
  for (const x of [-0.072, 0.072]) b.box(0.008, 0.026, 0.008, shade(gear, 0.8), [x, 0.02, 0.026]);
  if (!full) return;
  // Druckknoepfe an den Koppeltaschen / snaps on the belt pouches
  for (const x of [-0.05, 0.05]) snap(b, [x, 0.02, 0.0575], 0.0034, sec);
  // Handgranaten: Bugel und Abzugsring / grenades: spoon and pull ring
  for (const x of [-0.02, 0.02]) {
    b.box(0.004, 0.018, 0.004, mat.metal, [x + 0.008, 0.014, 0.062]);
    b.add(keepNormals(new THREE.TorusGeometry(0.0045, 0.0012, 3, 8)), mat.metalLight, { p: [x - 0.006, 0.024, 0.062], r: [0, 0.6, 0] });
  }
  // Pistolengriff im Holster, Holsterklappe / pistol grip in the holster, holster flap
  b.box(0.014, 0.026, 0.016, mat.darkMid, [0.084, 0.028, 0.004], [0.25, 0, 0]);
  b.box(0.021, 0.012, 0.037, shade(mat.dark, 1.4), [0.084, 0.012, 0.006]);
  snap(b, [0.095, 0.012, 0.006], 0.003, mat.metalLight);
  // Messer: Knauf und Parierstange / knife: pommel and guard
  b.add(ball(1, 6, 4), mat.metal, { p: [-0.082, 0.012, -0.02], s: 0.0065 });
  b.box(0.02, 0.004, 0.008, mat.metal, [-0.082, -0.03, -0.02]);
  // Feldflaschendeckel mit Kettchen / canteen cap with chain
  b.tube([-0.058, 0.03, -0.05], [-0.046, 0.022, -0.068], 0.0012, 3, mat.metal);
}

/**
 * Koppeltragegestell auf dem Oberkoerper (Rumpfrahmen): Traeger ueber die Schultern bis auf den Ruecken, D-Ringe,
 * Schulterklappen mit Knopf, Knoepfe auf den Brusttaschenklappen, Kragenspitzen.
 * Webbing harness on the torso (torso frame): straps over the shoulders onto the back, D-rings, shoulder straps with
 * button, buttons on the chest pocket flaps, collar points.
 */
export function fineHarness(b: Builder, gear: ColorLike, jacket: ColorLike, back: boolean) {
  for (const s of [-1, 1]) {
    // ueber die Schulter / over the shoulder
    b.box(0.014, 0.008, 0.1, gear, [s * 0.04, 0.113, 0.0], [0, 0, s * -0.05]);
    if (back) b.box(0.014, 0.1, 0.008, gear, [s * 0.036, 0.062, -0.052], [0, 0, s * 0.18]);
    // D-Ring / D-ring
    b.add(keepNormals(new THREE.TorusGeometry(0.0068, 0.0015, 3, 10)), mat.metalLight, { p: [s * 0.04, 0.086, 0.056] });
    // Schulterklappe mit Knopf / shoulder strap with button
    b.box(0.018, 0.006, 0.05, shade(jacket, 0.88), [s * 0.072, 0.114, 0.0], [0, 0, s * -0.32]);
    snap(b, [s * 0.075, 0.115, 0.022], 0.0032, mat.metalLight);
    // Knopf auf der Brusttaschenklappe / button on the chest pocket flap
    snap(b, [s * 0.045, 0.083, 0.0585], 0.003, mat.dark);
    // Kragenspitzen / collar points
    b.add(capsule(0.006, 0.0012, 0.026, 4, 1).scale(1, 1, 0.4), shade(jacket, 0.8), { p: [s * 0.018, 0.106, 0.044], r: [0.5, 0, s * 0.9] });
  }
}

/**
 * Gewehrdetails im Waffenrahmen von rifle() (Griff im Ursprung, Lauf nach +z): Kimme und Korn mit Schutz,
 * Kammerstaengel, Abzugsbuegel und Abzug, Laufringe, Muendung, Kolbenkappe, Riemen mit Bugeln, Maserung.
 * Rifle details in rifle()'s frame (grip at the origin, barrel along +z): rear and front sight with hood, bolt handle,
 * trigger guard and trigger, barrel bands, muzzle, butt plate, sling with swivels, wood grain.
 */
export function fineRifle(b: Builder, len: number, back: number, k: number, wood: ColorLike) {
  // Korn mit Schutzbuegel / front sight with hood
  b.add(arcRing(0.0075, 0.0014, Math.PI, 8), mat.dark, { p: [0, 0.014, len - 0.03], s: [1, 1.1, 1.4] });
  // Kimme / rear sight
  for (const s of [-1, 1]) b.box(0.004, 0.012, 0.006, mat.dark, [s * 0.005, 0.024, 0.115]);
  // Kammerstaengel mit Kugelgriff / bolt handle with ball knob
  b.tube([0.012 * k, 0.008, 0.035], [0.03 * k, -0.002, 0.03], 0.0028, 5, mat.metal);
  b.add(ball(1, 6, 4), mat.metal, { p: [0.031 * k, -0.003, 0.03], s: 0.0055 });
  // Abzugsbuegel und Abzug / trigger guard and trigger
  b.add(arcRing(0.012, 0.0018, Math.PI * 1.1, 8), mat.dark, { p: [0, -0.02, 0.022], r: [0, HALF_PI, Math.PI] });
  b.box(0.003, 0.012, 0.004, mat.metal, [0, -0.02, 0.024], [0.3, 0, 0]);
  // Laufringe und Muendung / barrel bands and muzzle
  for (const z of [0.12, 0.185]) b.add(capsule(0.019 * k, 0.019 * k, 0.008, 10, 1, 0.3), mat.metal, { p: [0, -0.002, z], r: [HALF_PI, 0, 0], s: [0.9, 1, 1.05] });
  b.add(keepNormals(new THREE.TorusGeometry(0.0085 * k, 0.0018, 3, 10)), mat.metalLight, { p: [0, 0.004, len + 0.0005] });
  // Kolbenkappe / butt plate
  b.box(0.027 * k, 0.046 * k, 0.004, mat.metal, [0, -0.007, -back - 0.006]);
  // Maserung am Kolben / wood grain on the stock
  for (const s of [-1, 1]) for (const [y, z] of [[0.004, -0.06], [-0.012, -0.075]] as [number, number][]) b.box(0.002, 0.003, 0.05, shade(wood, 0.78), [s * 0.0125 * k, y * k, z]);
  // Riemen mit Bugeln unten / sling with swivels underneath
  b.add(keepNormals(new THREE.TorusGeometry(0.005, 0.0013, 3, 8)), mat.metal, { p: [0, -0.02, 0.17], r: [0, HALF_PI, 0] });
  b.add(keepNormals(new THREE.TorusGeometry(0.005, 0.0013, 3, 8)), mat.metal, { p: [0, -0.033 * k, -back + 0.03], r: [0, HALF_PI, 0] });
  const sl = shade(mat.wood, 0.55);
  b.tube([0, -0.025, 0.17], [0, -0.058, 0.06], 0.0026, 4, sl);
  b.tube([0, -0.058, 0.06], [0, -0.04 * k, -back + 0.03], 0.0026, 4, sl);
}

/**
 * Tornister-Details (Rumpfrahmen, Tornister um [0, py, pz] mit Breite w, Hoehe h, Tiefe t): Deckelriemen mit Schnallen,
 * Seitentaschen, Kochgeschirr.
 * Pack details (torso frame, pack around [0, py, pz] with width w, height h, depth t): lid straps with buckles,
 * side pockets, mess tin.
 */
export function finePack(b: Builder, gear: ColorLike, py: number, pz: number, w: number, h: number, t: number) {
  const zb = pz - t / 2 - 0.003;
  for (const s of [-1, 1]) {
    b.box(0.01, h * 0.72, 0.005, shade(gear, 0.72), [s * w * 0.24, py - h * 0.08, zb]);
    b.box(0.014, 0.011, 0.007, mat.metalLight, [s * w * 0.24, py - h * 0.3, zb - 0.002]);
    // Seitentasche mit Klappe / side pocket with flap
    b.box(0.014, h * 0.5, t * 0.6, shade(gear, 0.88), [s * (w / 2 + 0.006), py - h * 0.15, pz]);
    b.box(0.017, 0.008, t * 0.64, shade(gear, 0.72), [s * (w / 2 + 0.007), py + h * 0.1, pz]);
  }
  // Kochgeschirr / mess tin
  b.add(capsule(0.016, 0.016, 0.03, 10, 1, 0.3), mat.metal, { p: [0, py + h * 0.18, zb - 0.012], r: [HALF_PI, 0, 0], s: [1.25, 1, 1] });
}

// ---------- Mechanik / mechanics ----------

/** Niete als flache Halbschale (keine Tuschelinie), Normale n / rivet as a flat half shell (no ink line), normal n */
const V3v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
export function rivet(b: Builder, p: V3, n: V3, r: number, c: ColorLike) {
  b.group({ p, r: eulerZ(V3v(n)) }, () => b.add(lens(6, 3), c, { s: [r, r, r * 0.55] }));
}

/** Nietreihe von a nach c / rivet row from a to c */
export function rivetRow(b: Builder, a: V3, c: V3, count: number, n: V3, r: number, col0: ColorLike) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    rivet(b, [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t], n, r, col0);
  }
}

/** Schweissnaht oder Kabel als duennes Rohr / weld seam or cable as a thin tube */
export function seam(b: Builder, pts: V3[], r: number, c: ColorLike) {
  for (let i = 0; i < pts.length - 1; i++) b.tube(pts[i], pts[i + 1], r, 4, c);
}

/**
 * Scheinwerfer mit Gehaeuse, Glas und Schutzgitter, Blick entlang n / headlight with housing, glass and guard, facing n.
 */
export function headlight(b: Builder, p: V3, n: V3, r: number, housing: ColorLike, guard = true) {
  b.group({ p, r: eulerZ(V3v(n)) }, () => {
    b.add(capsule(r, r * 0.8, r * 1.6, 10, 1, 0.5).rotateX(HALF_PI), housing, { p: [0, 0, -r * 0.3] });
    b.add(capZ(1, 0.9, 10), mat.lamp, { p: [0, 0, r * 0.15], s: [r * 0.86, r * 0.86, r * 0.6] });
    if (guard) for (const x of [-0.4, 0, 0.4]) b.tube([x * r, -r * 1.05, r * 0.3], [x * r, r * 1.05, r * 0.3], r * 0.09, 3, mat.dark);
  });
}

// ---------- Fraktionsausruestung / faction kit ----------

/** Handschuhfarbe je Fraktion (null = blosse Hand) / glove colour per faction (null = bare hand) */
export function gloveOf(f: string | null): THREE.Color | null {
  if (f === 'dravon') return col(mat.dark);
  if (f === 'alvenia') return mix(mat.white, mat.paper, 0.3);
  if (f === 'velkar') return col(mat.darkMid);
  return null;
}

/**
 * Fraktionstypische Kleinteile am Koppel (Beckenrahmen, nur Einzelfigur bei hoher Qualitaet):
 * Korvat Gasmaskenbuechse und Brotbeutel, Dravon Beinholster, Alvenia Gebetbuch und Siegel, Meridon Kartentasche mit
 * Kompass, Velkar Energiezellen. Die Kennformen der Silhouette bleiben unberuehrt.
 * Faction-typical small parts on the belt (pelvis frame, hero figure on high quality only): Korvat gas mask canister and
 * bread bag, Dravon drop-leg holster, Alvenia prayer book and seal, Meridon map case with compass, Velkar energy cells.
 * The silhouette signatures stay untouched.
 */
export function factionBeltKit(b: Builder, f: string | null, gear: ColorLike, sec: ColorLike, glow: ColorLike) {
  switch (f) {
    case 'korvat':
      b.add(capsule(0.016, 0.016, 0.07, 12, 2, 0.5), shade(gear, 1.2), { p: [-0.078, -0.045, -0.035], r: [0, 0, 0.12] });
      for (const y of [-0.075, -0.015]) b.add(capsule(0.017, 0.017, 0.006, 12, 1, 0.3), shade(gear, 0.8), { p: [-0.078 - y * 0.12, y, -0.035] });
      b.add(softBox(0.05, 0.04, 0.02, 0.008, 1), shade(gear, 0.95), { p: [0.03, -0.04, -0.056] });
      b.box(0.052, 0.014, 0.022, shade(gear, 0.78), [0.03, -0.024, -0.057]);
      break;
    case 'dravon':
      b.add(softBox(0.02, 0.06, 0.034, 0.006, 1), mat.dark, { p: [0.088, -0.07, 0.01] });
      b.box(0.014, 0.02, 0.016, mat.darkMid, [0.088, -0.03, 0.018], [0.2, 0, 0]);
      break;
    case 'alvenia':
      b.add(softBox(0.03, 0.036, 0.012, 0.005, 1), shade(sec, 0.8), { p: [-0.07, -0.03, 0.04], r: [0, -0.5, 0] });
      b.box(0.004, 0.034, 0.013, mat.gold, [-0.058, -0.03, 0.047], [0, -0.5, 0]);
      b.tube([-0.06, 0.008, 0.045], [-0.07, -0.012, 0.045], 0.0015, 3, mat.gold);
      b.add(capsule(0.006, 0.006, 0.004, 10, 1, 0.4), mat.red, { p: [0.03, -0.012, 0.056], r: [HALF_PI, 0, 0] });
      b.add(lens(6, 2), mat.paper, { p: [0.03, -0.032, 0.055], s: [0.006, 0.014, 0.001] });
      break;
    case 'meridon':
      b.add(softBox(0.012, 0.06, 0.05, 0.004, 1), shade(gear, 0.9), { p: [-0.08, -0.05, 0.0] });
      b.add(capsule(0.012, 0.012, 0.006, 12, 1, 0.3), mat.metalLight, { p: [-0.087, -0.04, 0.0], r: [0, 0, HALF_PI] });
      b.add(capZ(1, 0.9, 10), mat.white, { p: [-0.091, -0.04, 0.0], r: [0, -HALF_PI, 0], s: [0.009, 0.009, 0.002] });
      b.box(0.002, 0.012, 0.002, mat.red, [-0.0925, -0.04, 0.0]);
      break;
    case 'velkar':
      for (const x of [-0.035, -0.012]) {
        b.add(capsule(0.008, 0.008, 0.03, 10, 1), shade(gear, 1.1), { p: [x, -0.02, 0.054] });
        b.add(capsule(0.0085, 0.0085, 0.008, 10, 1, 0.3), glow, { p: [x, -0.018, 0.054] });
      }
      break;
  }
}

/**
 * Kleidungsdetails am Unterschenkel (Einzelfigur, hohe Qualitaet): Hosenbund ueber dem Stiefel, Knieschonerriemen.
 * Clothing details on the shin (hero figure, high quality): trouser blousing over the boot, knee pad strap.
 */
export function blousing(b: Builder, len: number, pants: ColorLike) {
  b.add(capsule(0.035, 0.034, 0.016, 14, 2, 0.5), shade(pants, 0.92), { p: [0, len - 0.024, 0] });
  b.add(capsule(0.0335, 0.0335, 0.006, 14, 1, 0.3), mat.dark, { p: [0, 0.006, 0] });
}

/** Rangwinkel als flache Schalen (lokal, Aussenseite +z) / rank chevrons as flat shells (local, outside +z) */
export function chevrons(b: Builder, n: number, c: ColorLike) {
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) b.add(lens(6, 2), c, { p: [s * 0.0065, -i * 0.007, 0], r: [0, 0, s * 0.6], s: [0.009, 0.0022, 0.0016] });
}
