/**
 * Vorschlag A: der Schuetze (Einheitentyp infantry) als geformte Figur mit Gewehr.
 * Standbein rechts, Spielbein vorgestellt, Schultern gegen das Becken gedreht, Gewehr schraeg vor dem Koerper
 * ("Gewehr im Anschlag aus der Huefte"), beide Haende greifen mit einzelnen Fingern.
 * Proposal A: the rifleman (unit type infantry) as a sculpted figure with a rifle.
 * Weight on the right leg, free leg set forward, shoulders turned against the pelvis, rifle held diagonally in front
 * of the body (low ready), both hands grip with separate fingers.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../../data/balance';
import { shade } from '../../kit';
import { look, mat } from '../../look';
import { Assembly, finishProto, mirrorX } from './assemble';
import {
  Body, GRIP, GRIP_TRIGGER, HEAD_K, HEAD_Y, HIP_X, HIP_Y, NECK_Y, SHOULDER_X, SHOULDER_Y, beltKit, coatRoll, figureColours, gripFrame, hand, head, helmet, leg, neck, sleeve, torso,
  torsoTube, type FigureColours, type FigurePose,
} from './figure';
import { PMesh, Tube, V, basis, lathe, mat4, rod, softCage, type P3, type Station } from './mesh';

/**
 * Gewehr im eigenen Raum: Ursprung am Kolbenhals (Griff der Abzugshand), +z zur Muendung, +y oben.
 * Schaft als ein durchgehender Holzkoerper vom Kolben bis zum Vorderschaft, Lauf mit Bohrung, Schloss mit Kammerstengel,
 * Magazinkasten, Abzugsbuegel, Visier und Korn, Laufringe, Riemen und Bajonett.
 * Rifle in its own space: origin at the stock wrist (grip of the trigger hand), +z to the muzzle, +y up. Stock as one
 * continuous wooden body from butt to fore-end, barrel with bore, receiver with bolt handle, magazine box, trigger
 * guard, rear and front sight, barrel bands, sling and bayonet.
 */
export function rifle(C: FigureColours, bayonet = true): PMesh {
  const m = new PMesh();
  const S = (z: number, y: number, rx: number, up: number, down: number, n = 2.6): Station => ({ p: [0, y, z], rx, rf: up, rb: down, n });
  const stock = new Tube([
    S(-0.088, -0.0125, 0.0036, 0.0105, 0.0105, 3), S(-0.085, -0.012, 0.0047, 0.0122, 0.0122, 3.2), S(-0.062, -0.0092, 0.0053, 0.0106, 0.0108, 3), S(-0.034, -0.0046, 0.0051, 0.0072, 0.0084),
    S(-0.01, -0.0004, 0.0046, 0.0052, 0.006, 2.3), S(0.01, 0.0008, 0.005, 0.0048, 0.0072), S(0.03, 0.0012, 0.0053, 0.004, 0.0088, 3), S(0.058, 0.0018, 0.0051, 0.0034, 0.0068),
    S(0.1, 0.0022, 0.0047, 0.003, 0.006), S(0.15, 0.0026, 0.0043, 0.003, 0.0052), S(0.156, 0.0028, 0.0034, 0.0022, 0.004),
  ], { seg: 14, ring: 0.007, front: [0, 1, 0] });
  stock.mesh(m, (u) => (u < 1 ? C.steel : u > 9 ? C.steel : C.wood), { capA: true, capB: true });
  // Laufringe aus Stahl / steel barrel bands
  for (const u of [7.95, 8.9]) stock.band(m, u - 0.06, u + 0.06, 0.0009, C.steel, { nu: 1, thick: 0.0012 });
  const R90 = mat4([0, 0, 0], [Math.PI / 2, 0, 0]);
  const zc = (p: (readonly [number, number])[], seg: number, c: THREE.Color | ((i: number) => THREE.Color), y: number, x = 0) => lathe(p, seg, c, { fixed: true }).apply(R90).move(x, y, 0);
  const dark = shade(C.steel, 0.55), bright = shade(mat.metal, 1.2);
  // Lauf mit Bohrung / barrel with bore
  m.add(zc([[0.0001, 0.02], [0.0037, 0.02], [0.0033, 0.06], [0.0029, 0.15], [0.0027, 0.2], [0.0027, 0.2005], [0.0015, 0.2005], [0.0015, 0.19]], 10, (i) => (i >= 6 ? dark : C.steel), 0.0062));
  // Schloss, Kammer mit Stengel und Kugel / receiver, bolt with handle and knob
  m.add(softCage(0.0082, 0.0072, 0.046, C.steel, { tight: 2, round: 1 }).move(0, 0.0064, 0.018));
  m.add(zc([[0.0001, -0.014], [0.003, -0.014], [0.003, 0.014], [0.0001, 0.014]], 8, bright, 0.0092));
  m.add(rod([[-0.003, 0.0092, 0.006], [-0.0085, 0.0088, 0.006], [-0.0105, 0.0052, 0.004]], 0.0011, bright, { seg: 5, ring: 0.002 }));
  m.add(softCage(0.0046, 0.0046, 0.0046, bright, { tight: 0, round: 2 }).move(-0.011, 0.0044, 0.0036));
  // Magazinkasten und Abzugsbuegel / magazine box and trigger guard
  m.add(softCage(0.0064, 0.011, 0.02, C.steel, { tight: 1, round: 1, top: [0.0064, 0.024] }).move(0, -0.0125, 0.032));
  m.add(rod([[0, -0.006, -0.004], [0, -0.0118, 0.002], [0, -0.0122, 0.012], [0, -0.0085, 0.021]], 0.0009, C.steel, { seg: 5, ring: 0.003 }));
  m.add(rod([[0, -0.006, 0.008], [0, -0.0095, 0.0066]], 0.0008, dark, { seg: 4, smooth: false }));
  // Kimme und Korn mit Kornschutz / rear sight and front sight with hood
  m.add(softCage(0.0052, 0.0028, 0.012, dark, { tight: 1, round: 1, top: [0.0052, 0.008] }).move(0, 0.0102, 0.052));
  m.add(softCage(0.0014, 0.0046, 0.003, dark, { tight: 1, round: 0 }).move(0, 0.0105, 0.19));
  m.add(lathe([[0.0032, -0.0022], [0.0032, 0.0022], [0.0025, 0.0022], [0.0025, -0.0022], [0.0032, -0.0022]], 8, dark, { fixed: true }).apply(R90).move(0, 0.0106, 0.19));
  // Putzstock unter dem Lauf / cleaning rod under the barrel
  m.add(rod([[0, 0.0014, 0.154], [0, 0.0022, 0.196]], 0.0009, bright, { seg: 5, smooth: false }));
  // Riemen: haengt vom vorderen Ring zum Kolben durch / sling: sags from the front band to the butt
  m.add(rod([[0.0045, -0.0028, 0.1], [0.0062, -0.012, 0.074], [0.0068, -0.021, 0.03], [0.006, -0.0235, -0.02], [0.0046, -0.0185, -0.058], [0.0042, -0.0125, -0.066]], 0.0031, C.leather, { seg: 6, flat: 0.3, n: 4, ring: 0.006, front: [1, 0, 0] }));
  if (bayonet) {
    // Tuellenbajonett: Huelse, Arm, vierkantige Klinge / socket bayonet: sleeve, arm, four-sided blade
    m.add(zc([[0.0036, 0.176], [0.0036, 0.19]], 8, bright, 0.0062));
    m.add(rod([[0, 0.0062, 0.186], [0.0052, 0.0062, 0.19], [0.0054, 0.0062, 0.2]], 0.0013, bright, { seg: 5, ring: 0.003 }));
    m.add(rod([[0.0054, 0.0062, 0.198], [0.0054, 0.0062, 0.228], [0.0054, 0.0062, 0.262]], (t) => 0.0019 * (1 - t * 0.86), bright, { seg: 4, smooth: false }));
  }
  // Comic-Zugabe: Querschnitt etwas kraeftiger, Laenge bleibt / comic allowance: cross-section a little stronger, length stays
  m.apply(new THREE.Matrix4().makeScale(RIFLE_K, RIFLE_K, 1));
  m.setInk(0.36);
  return m;
}

const RIFLE_K = 1.22;

/** Haltung des Schuetzen / the rifleman's stance */
const POSE: FigurePose = {
  pelvis: [-0.007, -0.004, 0],
  pelvisRoll: -0.075, pelvisYaw: -0.1, pelvisPitch: 0.02,
  chestRoll: 0.055, chestYaw: -0.2, chestPitch: 0.05,
  head: [0.32, 0.03, -0.03],
  ankle: [[-0.038, 0.032, -0.014], [0.05, 0.033, 0.052]],
  footYaw: [-0.32, 0.4],
  kneePole: [[-0.1, 0, 1], [0.25, 0, 1]],
  elbowPole: [[-0.75, -0.25, -0.6], [0.55, -0.8, -0.15]],
};

/** Schuetze ohne Groessenklasse und Helligkeitsverlauf / rifleman without size class and value ramp */
export function infantryRaw(f: FactionId): THREE.BufferGeometry {
  const L = look(f), C = figureColours(L);
  const asm = new Assembly();
  const body = new Body(POSE);
  const t = torsoTube(body);
  torso(asm, t, C, L);
  ([[0, -1], [1, 1]] as const).forEach(([i, side]) => leg(asm, body.point([side * HIP_X, HIP_Y, 0]), V(POSE.ankle[i]), POSE.footYaw[i], V(POSE.kneePole[i]), side, C));

  // Kopf / head
  const headM = body.rigid(NECK_Y).multiply(mat4([0, HEAD_Y + 0.008, 0.0035], [POSE.head[1], POSE.head[0], POSE.head[2]], HEAD_K));
  neck(asm, body.point([0, NECK_Y - 0.004, -0.002]), new THREE.Vector3(0, -0.026, -0.004).applyMatrix4(headM), C);
  const S = head(asm, headM, C, { seed: 11 });
  helmet(asm, headM, S, C, L, f);

  // Gewehr und Haende / rifle and hands
  const O = new THREE.Vector3(-0.047, 0.262, 0.068);
  const Z = new THREE.Vector3(0.42, 0.4, 0.8).normalize();
  const Y = new THREE.Vector3(0, 1, 0).addScaledVector(Z, -Z.y).normalize();
  const X = Y.clone().cross(Z);
  const RM = basis(O, X, Y, Z);
  asm.add(rifle(C).apply(RM), 40);
  const dir = (x: number, y: number, z: number) => new THREE.Vector3().addScaledVector(X, x).addScaledVector(Y, y).addScaledVector(Z, z);
  // Abzugshand (rechts): Handflaeche rechts am Kolbenhals, Finger unten herum / trigger hand (right): palm on the right of the wrist, fingers around underneath
  const gr = gripFrame(new THREE.Vector3(0, -0.0006, -0.004).applyMatrix4(RM), dir(-0.8, -0.25, 0), dir(0, -0.82, 0.42), 0.0052 * RIFLE_K);
  asm.add(hand(GRIP_TRIGGER, C.skin, false).apply(gr.M), 60);
  // Stuetzhand (links): von unten um den Vorderschaft / support hand (left): from below around the fore-end
  const gl = gripFrame(new THREE.Vector3(0, 0.0006, 0.082).applyMatrix4(RM), dir(0.3, -0.9, 0), dir(-1, 0, 0.12), 0.0052 * RIFLE_K);
  asm.add(hand(GRIP, C.skin, true).apply(gl.M), 60);
  const sh = (side: number) => body.point([side * SHOULDER_X, SHOULDER_Y, -0.002]);
  sleeve(asm, sh(-1), gr.wrist, V(POSE.elbowPole[0]), -1, C);
  sleeve(asm, sh(1), gl.wrist, V(POSE.elbowPole[1]), 1, C);

  // Mantelrolle, Koppelzeug / coat roll, belt kit
  coatRoll(asm, t, C, 1);
  beltKit(asm, t, C);
  const g = asm.build();
  // wie das heutige Modell: Figur etwas nach hinten, damit das Gewehr die Vergroesserung nicht begrenzt
  // as today's model: figure moved back a little so the rifle does not limit the enlargement
  g.translate(0.004, 0, -0.06);
  // Die Figur ist als Rechtsschuetze gebaut; gespiegelt zeigt das Gewehr wie beim heutigen Modell nach vorn rechts und
  // liegt aus der Brettkamera quer im Bild. / The figure is built as a right-handed shooter; mirrored, the rifle points
  // front-right like today's model and lies across the picture from the board camera.
  return mirrorX(g);
}

/** Schuetze wie auf dem Brett (Groessenklasse 1.2 wie infantry) / rifleman as on the board (size class 1.2 as infantry) */
export function protoInfantry(f: FactionId): THREE.BufferGeometry {
  return finishProto(infantryRaw(f), 1.2);
}
export type { P3 };
