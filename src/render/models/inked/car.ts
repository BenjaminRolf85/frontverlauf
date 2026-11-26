/**
 * Gezeichnete Einheiten: Gelaendewagen (Spaehwagen) aller Fraktionen / inked units: the field car (scout car) of every faction.
 *
 * Erkennungsmerkmale bleiben: offener Wagen mit vier grossen Raedern, Fahrer am Lenkrad, Schuetze am Maschinengewehr,
 * Ersatzrad am Heck. Die Karosserie besteht aus wenigen weichen Koerpern (Haube, Bodenwanne, Bordwaende); Tueren,
 * Kiemen, Grill, Kennzeichen, Werkzeug und Schlamm sind gezeichnet (carPaint.ts). Je Fraktion eine eigene Form:
 * Korvat kantig, Dravon Keilbug mit uebergrosser Waffe, Alvenia rund mit Goldleiste, Meridon leicht mit Rohrrahmen und
 * Kiste, Hightech (Zyrr, NEXUS) gepanzert mit Schuerzen und Leuchtband.
 * Besatzung: zwei Figuren im einheitlichen Massstab CREW. Der Schuetze steht in einem Drehkranz, damit eine Figur dieser
 * Groesse ab der Huefte sichtbar ist; der Wagen wurde dafuer gebaut, nicht die Figur veraendert.
 * The marks of identity stay: open car with four large wheels, driver at the wheel, gunner at the machine gun, spare
 * wheel at the rear. The body is a few soft shapes (bonnet, floor pan, side walls); doors, gills, grille, number plate,
 * tools and mud are drawn (carPaint.ts). One shape per faction: Korvat boxy, Dravon wedge bow with an oversized weapon,
 * Alvenia round with a gold strip, Meridon light with a tube frame and a crate, hi-tech (Zyrr, NEXUS) armoured with
 * skirts and a light band.
 * Crew: two figures at the uniform scale CREW. The gunner stands in a ring mount so that a figure of this size shows
 * from the hip up; the car was built for that, the figure was not changed.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { fine, geo, shade, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat, styleOf, type HumanStyle, type Look } from '../look';
import { arch, boxed, crew, CREW_DIM, gripPose, hullZ, machineGun, pipe, TIP, tub, tube, type Section } from './body';
import { CREW } from './figure';
import { CAR } from './carPaint';
import { emblemDecal, wheel } from './trim';
import { AtlasLayout, loft, UvBuilder, type BoxFaces } from './uvkit';

const HALF_PI = Math.PI / 2;

/** Grenzen der Projektion: alle Karosserieteile teilen sich die vier Ansichten / projection bounds: all body parts share the four views */
export const CAR_BOX = new THREE.Box3(new THREE.Vector3(-CAR.x, CAR.y0, CAR.z0), new THREE.Vector3(CAR.x, CAR.y1, CAR.z1));
export function carFaces(A: AtlasLayout): BoxFaces {
  return { px: A.get('carSide'), nx: A.get('carSide'), mirrorNx: true, py: A.get('carTop'), pz: A.get('carFront'), nz: A.get('carRear'), ny: A.get('blank'), bounds: CAR_BOX };
}

interface CarStyle {
  /** Kantigkeit der Querschnitte / boxiness of the cross-sections */
  e: number;
  /** Haubenhoehe an der Nase, halbe Breite der Nase / bonnet height at the nose, half width of the nose */
  nose: number; noseW: number;
  wheelR: number;
  /** Massstab der Bordwaffe / scale of the mounted gun */
  gun: number;
}
const STYLE: Record<HumanStyle, CarStyle> = {
  korvat: { e: 6, nose: 0.158, noseW: 0.094, wheelR: 0.057, gun: 1 },
  dravon: { e: 9, nose: 0.124, noseW: 0.082, wheelR: 0.057, gun: 1.42 },
  alvenia: { e: 2.9, nose: 0.146, noseW: 0.086, wheelR: 0.057, gun: 1 },
  meridon: { e: 5, nose: 0.15, noseW: 0.09, wheelR: 0.062, gun: 1 },
  velkar: { e: 7, nose: 0.132, noseW: 0.098, wheelR: 0.053, gun: 1 },
};

/** Scheinwerfer nach +z / headlight facing +z */
export function headlight(b: UvBuilder, A: AtlasLayout, p: V3, r: number, c: ColorLike, tilt = 0): void {
  const seg = fine() ? 12 : 7;
  b.add(loft([{ y: 0.012, rx: r, hard: true }, { y: 0.012, rx: r * 1.2, hard: true }, { y: -0.008, rx: r }, { y: -0.013, rx: TIP }], { seg, region: A.get('blank'), color: c }), null, { xf: { p, r: [HALF_PI - tilt, 0, 0] } });
  b.add(loft([{ y: 0.0125, rx: r }, { y: 0.016, rx: TIP }], { seg, region: A.get('blank'), color: mat.lamp }), null, { xf: { p, r: [HALF_PI - tilt, 0, 0] }, gloss: 1, crease: 0 });
}

/** Rad eines Radfahrzeugs samt Gegenseite (Aussenseite gezeichnet) / a wheeled vehicle's wheel and its opposite (outer face drawn) */
export function wheelPair(b: UvBuilder, A: AtlasLayout, x: number, z: number, r: number, w: number, c: ColorLike): void {
  b.mirrorX(() => wheel(b, A, x, r, z, r, w, 'wheel', c, fine() ? 18 : 10));
}

/** Gelaendewagen; A = Atlas der Radfahrzeuge / field car; A = atlas of the wheeled vehicles */
export function fieldCar(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), st = styleOf(f), S = STYLE[st];
  const hi = fine();
  const F = carFaces(A);
  const seg = hi ? 20 : 10;
  const { y0, y1, z0, z1, cowl, floor } = CAR;
  const xw = CAR.x - 0.002;

  // ---- Raeder, Achsen / wheels, axles ----
  for (const z of [CAR.axleF, CAR.axleR]) {
    wheelPair(b, A, 0.134, z, S.wheelR, 0.05, L.trim);
    if (hi) tube(b, A, [-0.11, S.wheelR, z], [0.11, S.wheelR, z], 0.008, 0.008, mat.dark, 6);
  }

  // ---- Karosserie / body ----
  body(b, A, L, st, S, F, seg);
  // Bordwaende und Ladeklappe: nur die Aussenseite traegt die Zeichnung / side walls and tailgate: only the outside carries the drawing
  const wallH = y1 - floor, wallY = floor + wallH / 2, wz0 = z0 + 0.004, wlen = cowl - wz0;
  b.add(boxed(softBox(0.014, wallH, wlen, 0.004), { p: [xw - 0.007, wallY, wz0 + wlen / 2] }, { px: F.px, all: A.get('blank'), bounds: CAR_BOX }), L.hull);
  b.add(boxed(softBox(0.014, wallH, wlen, 0.004), { p: [-xw + 0.007, wallY, wz0 + wlen / 2] }, { nx: F.nx, mirrorNx: true, all: A.get('blank'), bounds: CAR_BOX }), L.hull);
  b.add(boxed(softBox(2 * xw - 0.02, wallH, 0.012, 0.004), { p: [0, wallY, wz0 + 0.006] }, { nz: F.nz, all: A.get('blank'), bounds: CAR_BOX }), L.hull);
  // Spritzwand mit Armaturenbrett / firewall with dashboard
  b.add(softBox(2 * xw - 0.024, wallH + 0.004, 0.014, 0.004), L.hullDark, { xf: { p: [0, wallY, cowl - 0.006] } });
  if (hi) for (const x of [-0.07, -0.045, -0.02]) b.add(loft([{ y: 0.002, rx: 0.0065 }, { y: 0, rx: 0.0075 }], { seg: 8, region: A.get('blank'), capFirst: A.get('glass'), color: mat.glassDark }), null, { xf: { p: [x, wallY + 0.014, cowl - 0.0135], r: [-HALF_PI, 0, 0] }, gloss: 0.8, crease: 0 });

  // ---- Kotfluegel / mudguards ----
  mudguards(b, L, st, S);

  // ---- Stossstangen, Scheinwerfer / bumpers, headlights ----
  b.add(softBox(st === 'dravon' ? 0.2 : 0.236, 0.022, 0.022, 0.006), mat.dark, { xf: { p: [0, y0 + 0.012, z1 + 0.008] }, gloss: 0.3 });
  b.add(softBox(0.226, 0.02, 0.02, 0.006), mat.dark, { xf: { p: [0, y0 + 0.012, z0 - 0.006] }, gloss: 0.3 });
  const ly = Math.min(0.132, S.nose - 0.026);
  for (const s of [-1, 1]) headlight(b, A, [s * (S.noseW - 0.026), ly, z1 + 0.002], 0.0125, L.hullDark);

  // ---- Windschutzscheibe: Rahmen und Glas / windscreen: frame and glass ----
  if (st === 'velkar') {
    // Panzerglas in einem geschlossenen Rahmen / armoured glass in a closed frame
    b.add(softBox(0.2, 0.062, 0.014, 0.005), L.hullDark, { xf: { p: [0, y1 + 0.028, cowl - 0.012], r: [-0.42, 0, 0] } });
    b.add(boxed(softBox(0.16, 0.026, 0.004, 0.001), { p: [0, y1 + 0.031, cowl - 0.0035], r: [-0.42, 0, 0] }, { pz: A.get('glass'), all: A.get('blank') }), mat.glassDark, { gloss: 1, crease: 0 });
  } else {
    b.group({ p: [0, y1 + 0.036, cowl - 0.014], r: [-0.26, 0, 0] }, () => {
      b.add(boxed(softBox(0.186, 0.058, 0.004, 0.001), {}, { pz: A.get('glass'), nz: A.get('glass'), all: A.get('blank') }), mat.glass, { gloss: 1, crease: 0 });
      for (const s of [-1, 1]) b.add(softBox(0.012, 0.076, 0.012, 0.004), L.hullDark, { xf: { p: [s * 0.098, 0, 0] } });
      b.add(softBox(0.2, 0.011, 0.012, 0.004), L.hullDark, { xf: { p: [0, 0.033, 0] } });
      b.add(softBox(0.2, 0.011, 0.012, 0.004), L.hullDark, { xf: { p: [0, -0.033, 0] } });
    });
  }

  // ---- Sitze, Lenkrad / seats, steering wheel ----
  const seatZ = -0.006, seatTop = floor + 0.03;
  for (const x of [-0.05, 0.05]) {
    b.add(softBox(0.074, 0.03, 0.066, 0.008), mat.darkMid, { xf: { p: [x, floor + 0.015, seatZ] } });
    b.add(softBox(0.074, 0.07, 0.014, 0.006), mat.darkMid, { xf: { p: [x, floor + 0.062, seatZ - 0.036], r: [-0.16, 0, 0] } });
  }
  const sw: V3 = [-0.05, 0.204, 0.03];
  b.legacy((k) => k.add(geo.torus(0.021, 0.0036, 4, hi ? 12 : 8), mat.ink, { p: sw, r: [1.05, 0, 0] }), { crease: 0 });
  tube(b, A, [sw[0], floor + 0.055, cowl - 0.012], sw, 0.004, 0.004, mat.dark, 5);

  // ---- Fahrer: sitzt, Haende am Lenkrad / driver: seated, hands on the wheel ----
  const dp: V3 = [-0.05, seatTop + 0.022 - CREW_DIM.pelvis, seatZ];
  const hand = (dx: number): V3 => [(sw[0] + dx - dp[0]) / CREW, (sw[1] + 0.004 - dp[1]) / CREW, (sw[2] - 0.004 - dp[2]) / CREW];
  crew(b, A, f, { p: dp, pose: gripPose(hand(-0.02), hand(0.02), [0.04, 0.05, 0]), seed: 3 });

  // ---- Heck: Ueberrollbuegel, Drehkranz mit Schuetze und MG / rear: roll bar, ring mount with gunner and MG ----
  const rz = -0.047, top = y1 + 0.112;
  if (st === 'meridon') {
    // Rohrrahmen statt Buegel / tube frame instead of the bar
    for (const s of [-1, 1]) {
      pipe(b, A, [[s * 0.098, y1, cowl - 0.02], [s * 0.098, top, 0.02], [s * 0.098, top, rz], [s * 0.098, y1, rz - 0.01]], 0.0068, mat.metal, hi ? 6 : 4, { gloss: 0.6 });
    }
    tube(b, A, [-0.098, top, 0.02], [0.098, top, 0.02], 0.0068, 0.0068, mat.metal, hi ? 6 : 4, { gloss: 0.6 });
    tube(b, A, [-0.098, top, rz], [0.098, top, rz], 0.0068, 0.0068, mat.metal, hi ? 6 : 4, { gloss: 0.6 });
  } else {
    pipe(b, A, [[-0.098, y1 - 0.01, rz], [-0.098, top, rz], [0.098, top, rz], [0.098, y1 - 0.01, rz]], 0.0095, mat.dark, hi ? 8 : 5);
    for (const s of [-1, 1]) {
      tube(b, A, [s * 0.098, top - 0.02, rz], [s * 0.098, y1, rz - 0.07], 0.006, 0.006, mat.dark, 5);
      if (st !== 'velkar') headlight(b, A, [s * 0.062, top + 0.02, rz + 0.004], 0.011, L.hullDark);
    }
  }
  // Drehkranz: der Schuetze steht darin, sichtbar ab der Huefte / ring mount: the gunner stands inside, visible from the hip up
  const gx = 0.034, gz = -0.124, ringY = 0.146, ringH = 0.094;
  if (st === 'meridon') {
    // Kiste in der Zweitfarbe statt des runden Kranzes / a crate in the secondary colour instead of the round ring
    for (const [w, d, x, z] of [[0.132, 0.012, 0, 0.06], [0.132, 0.012, 0, -0.06], [0.012, 0.132, 0.06, 0], [0.012, 0.132, -0.06, 0]] as const) {
      b.add(boxed(softBox(w, ringH, d, 0.003), { p: [gx + x, ringY + ringH / 2, gz + z] }, { px: A.get('crate'), nx: A.get('crate'), pz: A.get('crate'), nz: A.get('crate'), all: A.get('blank') }), L.trim);
    }
  } else tub(b, A, [gx, ringY, gz], 0.064, ringH, 0.009, hi ? 18 : 9, L.trim, 'crate', shade(L.trim, 0.7));
  const gp: V3 = [gx, ringY + ringH + 0.004 - CREW_DIM.pelvis, gz];
  const gunP: V3 = [gx, ringY + ringH + 0.062, gz + 0.066];
  tube(b, A, [gx, ringY + ringH - 0.004, gz + 0.06], [gunP[0], gunP[1] - 0.014, gunP[2]], 0.007, 0.0055, mat.dark, 6);
  machineGun(b, A, gunP, { k: S.gun, shield: st === 'velkar' ? L.hullDark : L.trim, box: L.gear, len: 0.125 });
  const grip = (dx: number): V3 => [dx / CREW, (gunP[1] - 0.004 - gp[1]) / CREW, (gunP[2] - 0.052 - gp[2]) / CREW];
  crew(b, A, f, { p: gp, pose: gripPose(grip(-0.016), grip(0.016), [0.06, -0.08, 0]), seed: 4 });

  // ---- Ersatzrad, Kanister, Antenne / spare wheel, jerrycan, antenna ----
  b.group({ p: [-0.044, y0 + 0.07, z0 - 0.018], r: [0, HALF_PI, 0] }, () => wheel(b, A, 0, 0, 0, 0.046, 0.03, 'wheel', L.trim, hi ? 16 : 9));
  b.add(softBox(0.034, 0.05, 0.022, 0.006), L.primaryDark, { xf: { p: [0.062, y0 + 0.072, z0 - 0.012] } });
  if (hi) b.add(softBox(0.012, 0.008, 0.012, 0.003), mat.dark, { xf: { p: [0.07, y0 + 0.1, z0 - 0.012] } });
  const ant: V3 = [-0.094, y1, z0 + 0.022];
  b.add(loft([{ y: 0.012, rx: 0.005, hard: true }, { y: 0, rx: 0.007 }], { seg: hi ? 8 : 5, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: ant } });
  tube(b, A, [ant[0], ant[1] + 0.01, ant[2]], [ant[0] - 0.004, 0.45, ant[2] - 0.03], 0.0024, 0.0014, mat.dark, hi ? 5 : 3);
  if (st === 'velkar') b.add(loft([{ y: 0.01, rx: TIP }, { y: 0, rx: 0.009 }, { y: -0.01, rx: TIP }], { seg: 6, region: A.get('blank'), color: L.secondary }), null, { xf: { p: [ant[0] - 0.004, 0.455, ant[2] - 0.03] }, crease: 0 });

  // ---- Embleme: Haube und Tueren / emblems: bonnet and doors ----
  const ez = z1 - (z1 - cowl) * 0.56, ex = 0.046;
  const slope = Math.atan2(bonnetY(S, ez - 0.02, ex) - bonnetY(S, ez + 0.02, ex), 0.04);
  emblemDecal(b, A, f, [ex, bonnetY(S, ez, ex) - 0.001, ez], [0, Math.cos(slope), Math.sin(slope)], 0.044, L.hull, [0, Math.sin(slope), -Math.cos(slope)]);
  for (const s of [-1, 1]) emblemDecal(b, A, f, [s * (xw + 0.0005), 0.128, 0.012], [s, 0, 0], 0.036, L.hull);
  return b;
}

/** Querschnitte der Haube: Nase -> Spritzwand / cross-sections of the bonnet: nose -> firewall */
function bonnet(S: CarStyle): Section[] {
  const { y0, y1, z1, cowl } = CAR;
  const top = y1 - 0.004, cy = 0.11, xw = CAR.x - 0.002, e = S.e;
  return [
    { z: z1, w: S.noseW - 0.006, up: S.nose - 0.006 - cy, down: cy - y0 - 0.012, cy, e, hard: true },
    { z: z1 - 0.012, w: S.noseW, up: S.nose - cy, down: cy - y0 - 0.006, cy, e },
    { z: cowl + 0.03, w: xw - 0.004, up: top - cy - (top - S.nose) * 0.12, down: cy - y0, cy, e },
    { z: cowl, w: xw, up: top - cy, down: cy - y0, cy, e, hard: true },
  ];
}
/** Hoehe der Haubenoberflaeche an der Stelle (z, x) / height of the bonnet surface at (z, x) */
function bonnetY(S: CarStyle, z: number, x: number): number {
  const B = bonnet(S);
  let i = 1;
  while (i < B.length - 1 && z < B[i].z) i++;
  const a = B[i - 1], c = B[i], t = Math.min(1, Math.max(0, (a.z - z) / (a.z - c.z)));
  const w = a.w + (c.w - a.w) * t, up = a.up + (c.up - a.up) * t, e = S.e;
  return a.cy + up * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / w, e)), 1 / e);
}

/** Haube und Bodenwanne je Bauart / bonnet and floor pan per design */
function body(b: UvBuilder, A: AtlasLayout, L: Look, st: HumanStyle, S: CarStyle, F: BoxFaces, seg: number): void {
  const { y0, y1, z0, z1, cowl, floor } = CAR;
  const top = y1 - 0.004, xw = CAR.x - 0.002;
  const e = S.e;
  // Haube: Nase -> Spritzwand / bonnet: nose -> firewall
  b.add(hullZ(bonnet(S), { ...F, seg, capFirst: true, capLast: true }), L.hull);
  // Bodenwanne: Spritzwand -> Heck, Oberseite = Boden des Innenraums / floor pan: firewall -> stern, top = interior floor
  const fy = (floor + y0) / 2, fh = (floor - y0) / 2;
  b.add(hullZ([
    { z: cowl, w: xw, up: fh, down: fh, cy: fy, e: Math.max(e, 5), hard: true },
    { z: z0 + 0.012, w: xw, up: fh, down: fh, cy: fy, e: Math.max(e, 5) },
    { z: z0, w: xw - 0.006, up: fh - 0.002, down: fh - 0.008, cy: fy, e: Math.max(e, 5), hard: true },
  ], { ...F, seg, capLast: true }), L.hull);
  if (st === 'dravon') {
    // Keilbug: Zierleisten in der Zweitfarbe / wedge bow: trim strips in the secondary colour
    for (const s of [-1, 1]) b.add(softBox(0.007, 0.012, 0.16, 0.002), L.trim, { xf: { p: [s * (xw + 0.001), y1 - 0.03, z1 - 0.1], r: [0.26, 0, 0] } });
    b.add(softBox(0.15, 0.03, 0.008, 0.003), L.trim, { xf: { p: [0, y0 + 0.026, z1 + 0.002], r: [-0.2, 0, 0] } });
  }
  if (st === 'alvenia') b.add(softBox(0.022, 0.006, z1 - cowl - 0.02, 0.002), L.trim, { xf: { p: [0, (S.nose + top) / 2 + 0.0015, (z1 + cowl) / 2], r: [Math.atan2(top - S.nose, z1 - cowl) * 0.8, 0, 0] }, gloss: 0.6 });
  if (st === 'velkar') {
    // Leuchtband quer ueber die Haube, Seitenschuerzen / light band across the bonnet, side skirts
    b.add(boxed(softBox(0.17, 0.006, 0.014, 0.002), { p: [0, top - 0.002, cowl + 0.016] }, { py: A.get('glowStrip'), all: A.get('blank') }), L.secondary, { crease: 0 });
    for (const s of [-1, 1]) b.add(boxed(softBox(0.01, 0.062, 0.36, 0.003), { p: [s * 0.164, y0 + 0.036, 0.004] }, { px: A.get('plateMud'), nx: A.get('plateMud'), all: A.get('blank') }), L.hullDark);
  }
}

/** Kotfluegel: flach (Korvat, Meridon), Keil (Dravon), Bogen (Alvenia); Hightech traegt Schuerzen / mudguards: flat, wedge, arch; hi-tech wears skirts */
function mudguards(b: UvBuilder, L: Look, st: HumanStyle, S: CarStyle): void {
  if (st === 'velkar') return;
  const y = S.wheelR * 2 + 0.012, c = st === 'korvat' ? L.hullDark : L.hull;
  for (const z of [CAR.axleF, CAR.axleR]) for (const s of [-1, 1]) {
    if (st === 'alvenia') b.add(arch([s * 0.134, S.wheelR, z], S.wheelR + 0.009, S.wheelR + 0.017, 0.058, -1.5, 1.5, fine() ? 8 : 4), c);
    else if (st === 'dravon') b.add(softBox(0.058, 0.012, 0.15, 0.003), c, { xf: { p: [s * 0.134, y - 0.004, z + 0.004], r: [z > 0 ? 0.2 : -0.12, 0, 0] } });
    else {
      b.add(softBox(0.058, 0.011, 0.13, 0.004), c, { xf: { p: [s * 0.134, y, z - 0.004] } });
      b.add(softBox(0.058, 0.011, 0.04, 0.004), c, { xf: { p: [s * 0.134, y - 0.011, z + 0.074], r: [0.7, 0, 0] } });
    }
  }
}
