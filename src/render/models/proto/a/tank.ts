/**
 * Vorschlag A: der Korvat-Panzer (Einheitentyp tank) aus geformten Panzerplatten statt gestapelter Quader.
 * - Wanne als ein Koerper aus Querschnitten: geneigte Seiten, lange Bugplatte, schraeges Heck, alle Kanten gerundet.
 * - Gegossener Turm als ein Schlauch mit ausladendem Heck, Gussnaht, Blende; zwei Rohre mit Verjuengung, Rauchabsauger,
 *   Muendungsbremse und Bohrung. Der Turm liegt im Drehturm-Bereich (userData.turrets) und dreht wie bisher.
 * - Laufwerk: Kette aus einzelnen Gliedern, die wirklich um Treibrad, Laufrollen und Leitrad laeuft und oben durchhaengt;
 *   Scheibenraeder mit Gummibandage, Zahnkranz, gebogene Kotfluegel.
 * Proposal A: the Korvat tank (unit type tank) from shaped armour plates instead of stacked boxes.
 * - Hull as one body from cross-sections: sloped sides, long glacis, slanted rear, every edge rounded.
 * - Cast turret as one tube with a bustle, casting seam, mantlet; two barrels with taper, fume extractor, muzzle brake
 *   and bore. The turret sits in the turret range (userData.turrets) and turns as before.
 * - Running gear: a track of individual links that really runs around sprocket, road wheels and idler and sags on top;
 *   dished wheels with rubber tyres, toothed ring, curved mudguards.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../../data/balance';
import { addEmblem } from '../../emblems';
import { col, mix, shade } from '../../kit';
import { look, mat, type Look } from '../../look';
import { Assembly, finishProto } from './assemble';
import { Body, HAND_K, HEAD_K, HEAD_Y, NECK_Y, RELAXED, SHOULDER_X, SHOULDER_Y, figureColours, hand, head, helmet, neck, sleeve, torso, torsoTube, xfOf, type FigurePose } from './figure';
import { PMesh, TAU, Tube, basis, bell, cage, dens, density, lathe, lerp, mat4, outward, prism, rich, rod, roundPoly, softCage, sstep, withDensity, type P3, type Station } from './mesh';

const R_X = mat4([0, 0, 0], [0, 0, -Math.PI / 2]);
const R_Z = mat4([0, 0, 0], [Math.PI / 2, 0, 0]);

// ---------- Laufwerk / running gear ----------

interface Circle { z: number; y: number; r: number }
const TRACK_X = 0.142, TRACK_W = 0.078;
const WHEEL_R = 0.031, WHEEL_Y = 0.0385;
const WHEELS_Z = [-0.128, -0.064, 0, 0.064, 0.128];
const SPROCKET: Circle = { z: 0.177, y: 0.064, r: 0.0235 };
const IDLER: Circle = { z: -0.178, y: 0.0625, r: 0.0245 };
/** Staerke der Kettenplatte und Hoehe des Stegs / thickness of the track plate and height of the grouser */
const LINK_T = 0.0052, LINK_G = 0.0028;

/**
 * Kettenlauf (Innenseite) um die Raeder, gegen den Uhrzeigersinn in (z, y): unten nach vorn, um das Treibrad, oben mit
 * Durchhang zurueck, um das Leitrad. Rueckgabe: dichte Punktfolge.
 * Track run (inner side) around the wheels, counter-clockwise in (z, y): forward along the bottom, around the sprocket,
 * back along the top with sag, around the idler. Returns a dense point sequence.
 */
function trackPath(): [number, number][] {
  const cs: (Circle & { sag?: number })[] = [
    { z: WHEELS_Z[0], y: WHEEL_Y, r: WHEEL_R }, { z: WHEELS_Z[4], y: WHEEL_Y, r: WHEEL_R }, { ...SPROCKET, sag: 0.0185 }, IDLER,
  ];
  const n = cs.length;
  // Beruehrrichtung der aeusseren Tangente von Kreis i zum naechsten / contact direction of the outer tangent from circle i to the next
  const dirs = cs.map((a, i) => {
    const b = cs[(i + 1) % n];
    const dz = b.z - a.z, dy = b.y - a.y, d = Math.hypot(dz, dy);
    const uz = dz / d, uy = dy / d, s = (a.r - b.r) / d, c = Math.sqrt(1 - s * s);
    // rechte Normale von u ist (uy, -uz) / the right normal of u is (uy, -uz)
    return [s * uz + c * uy, s * uy - c * uz] as [number, number];
  });
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const c = cs[i], inD = dirs[(i + n - 1) % n], outD = dirs[i];
    let a0 = Math.atan2(inD[1], inD[0]), a1 = Math.atan2(outD[1], outD[0]);
    while (a1 < a0) a1 += TAU;
    const steps = Math.max(2, Math.round((a1 - a0) * 10));
    for (let k = 0; k <= steps; k++) { const a = lerp(a0, a1, k / steps); out.push([c.z + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r]); }
    // Gerade zum naechsten Rad, oben mit Durchhang auf die Laufrollen / straight to the next wheel, on top sagging onto the road wheels
    const b = cs[(i + 1) % n];
    const p0: [number, number] = [c.z + outD[0] * c.r, c.y + outD[1] * c.r], p1: [number, number] = [b.z + outD[0] * b.r, b.y + outD[1] * b.r];
    const seg = 28;
    for (let k = 1; k < seg; k++) {
      const t = k / seg;
      out.push([lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t) - (c.sag ?? 0) * sstep(0, 0.2, t) * sstep(1, 0.8, t)]);
    }
  }
  return out;
}

/** Punktfolge in gleichen Abstaenden neu abtasten (geschlossen) / resample a closed point sequence at equal spacing */
function resample(path: [number, number][], count: number): { p: [number, number]; t: [number, number] }[] {
  const n = path.length, acc = [0];
  for (let i = 0; i < n; i++) { const a = path[i], b = path[(i + 1) % n]; acc.push(acc[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = acc[n], out: { p: [number, number]; t: [number, number] }[] = [];
  let k = 0;
  const at = (s: number): [number, number] => {
    s = ((s % total) + total) % total;
    while (k < n - 1 && acc[k + 1] < s) k++;
    while (k > 0 && acc[k] > s) k--;
    const a = path[k], b = path[(k + 1) % n], f = (s - acc[k]) / Math.max(1e-9, acc[k + 1] - acc[k]);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  };
  for (let i = 0; i < count; i++) {
    const s = (i / count) * total, h = total / count / 2;
    const p = at(s), q0 = at(s - h), q1 = at(s + h);
    const l = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) || 1;
    out.push({ p, t: [(q1[0] - q0[0]) / l, (q1[1] - q0[1]) / l] });
  }
  return out;
}

/** Scheibenrad mit Doppelbandage; Achse +y, Aussenseite oben / dished wheel with a double tyre; axis +y, outer face up */
function roadWheel(r: number, L: Look, idler = false): PMesh {
  const tyre = col(mat.darkMid), dish = col(L.hullDark), rim = shade(L.hullDark, 0.8), cap = idler ? col(mat.metal) : col(L.trim);
  const k = r / WHEEL_R;
  const prof: [number, number, THREE.Color][] = [
    [0.0001, -0.019, rim], [r - 0.003, -0.019, rim], [r, -0.0165, tyre], [r, -0.0045, tyre], [r - 0.0048, -0.0035, tyre], [r - 0.0048, 0.0035, rim], [r, 0.0045, tyre],
    [r, 0.0165, tyre], [r - 0.0028, 0.019, tyre], [r - 0.0062, 0.019, rim], [r - 0.008, 0.0152, dish], [0.0135 * k, 0.012, dish], [0.0108 * k, 0.0168, dish], [0.0078 * k, 0.0205, cap], [0.0001, 0.0218, cap],
  ];
  const m = lathe(prof.map(([pr, py]) => [pr, py] as const), 22, (i) => prof[i + 1][2]);
  const bits = new PMesh();
  // Erleichterungsloecher und Radbolzen / lightening holes and wheel bolts
  const holes = idler ? 6 : 5;
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * TAU, rr = lerp(0.0135 * k, r - 0.008, 0.52);
    const y = lerp(0.012, 0.0152, 0.52) + 0.0004;
    bits.add(lathe([[0.0038 * k, 0], [0.0001, 0.0001]], 8, mat.ink, { fixed: true }), mat4([Math.sin(a) * rr, y, Math.cos(a) * rr], [0, 0, 0]));
  }
  if (rich()) for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * TAU, rr = 0.0093 * k;
    bits.add(lathe([[0.0015, 0], [0.0015, 0.0012], [0.0001, 0.0016]], 5, cap, { fixed: true }), mat4([Math.sin(a) * rr, 0.0182, Math.cos(a) * rr]));
  }
  bits.setInk(0);
  return m.add(bits);
}

/** Treibrad: zwei Zahnkraenze auf einer Nabe / sprocket: two toothed rings on a hub */
function sprocket(L: Look): PMesh {
  const m = new PMesh();
  const teeth = 13, r0 = SPROCKET.r - 0.003, r1 = SPROCKET.r + 0.0032;
  const outline: [number, number][] = [];
  for (let i = 0; i < teeth; i++) for (const [da, rr] of [[-0.3, r0], [-0.12, r1], [0.12, r1], [0.3, r0]] as [number, number][]) {
    const a = ((i + da) / teeth) * TAU;
    outline.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  for (const y of [-0.0215, 0.0165]) m.add(prism(outline, y, y + 0.005, (px, py, w) => [px, w, -py], mat.metal));
  m.add(lathe([[0.0001, -0.022], [0.0125, -0.022], [0.0125, 0.0215], [0.0165, 0.0215], [0.0165, 0.0235], [0.0105, 0.026], [0.0105, 0.0285], [0.0001, 0.0295]], 14, (i) => (i < 2 ? L.hullDark : L.trim)));
  if (rich()) {
    const bits = new PMesh();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; bits.add(lathe([[0.0014, 0], [0.0014, 0.0012], [0.0001, 0.0016]], 5, mat.dark, { fixed: true }), mat4([Math.sin(a) * 0.0136, 0.0238, Math.cos(a) * 0.0136])); }
    m.add(bits.setInk(0));
  }
  return m;
}

/** Laufwerk der linken Seite (+x); die rechte entsteht durch Spiegeln / running gear of the left side (+x); the right one is mirrored */
function runningGear(L: Look): PMesh {
  const m = new PMesh();
  const place = (w: PMesh, c: { z: number; y: number }) => m.add(w, mat4([TRACK_X, c.y, c.z]).multiply(R_X));
  for (const z of WHEELS_Z) place(roadWheel(WHEEL_R, L), { z, y: WHEEL_Y });
  place(sprocket(L), SPROCKET);
  place(roadWheel(IDLER.r, L, true), IDLER);
  // Schwingarme der Laufrollen / swing arms of the road wheels
  for (const z of WHEELS_Z) m.add(rod([[TRACK_X - 0.03, WHEEL_Y, z], [TRACK_X - 0.034, WHEEL_Y + 0.02, z - 0.03]], 0.006, L.hullDark, { seg: 6, smooth: false }));

  // Kette: ein Glied als Vorlage, entlang des Laufs gesetzt / track: one link as a template, placed along the run
  const path = trackPath();
  let len = 0;
  for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const count = dens(Math.round(len / 0.0118), 28), pitch = len / count;
  const plate = col(mat.dark), worn = shade(mat.darkMid, 1.25), horn = col(mat.metal);
  const hp = pitch * 0.45;
  // Profil (entlang, nach aussen): Platte mit Steg / profile (along, outward): plate with grouser
  const prof: [number, number][] = [[-hp, 0], [hp, 0], [hp, LINK_T], [pitch * 0.2, LINK_T], [pitch * 0.13, LINK_T + LINK_G], [-pitch * 0.13, LINK_T + LINK_G], [-pitch * 0.2, LINK_T], [-hp, LINK_T]];
  const link = prism(prof, -TRACK_W / 2, TRACK_W / 2, (s, h, w) => [w, h, s], plate);
  const cy = new THREE.Vector3(), q = new THREE.Vector3();
  link.faces.forEach((f, k) => {
    cy.set(0, 0, 0);
    for (const i of f) cy.add(link.get(i, q));
    if (cy.y / f.length > LINK_T + LINK_G * 0.8) link.cols[k] = worn;
  });
  // Fuehrungszahn innen, Bolzenkoepfe aussen / guide horn inside, pin heads outside
  link.add(cage(0.007, 0.0085, pitch * 0.5, horn, { top: [0.0035, pitch * 0.22] }).apply(mat4([0, -0.0042, 0], [Math.PI, 0, 0])));
  for (const s of [-1, 1]) link.add(cage(0.004, 0.0034, pitch * 0.3, horn).move(s * (TRACK_W / 2 + 0.0012), LINK_T * 0.5, 0));
  for (const it of resample(path, count)) {
    const t = new THREE.Vector3(0, it.t[1], it.t[0]), nrm = new THREE.Vector3(0, -it.t[0], it.t[1]);
    m.add(link, basis(new THREE.Vector3(TRACK_X, it.p[1], it.p[0]), new THREE.Vector3(1, 0, 0), nrm, t));
  }
  // durchgehendes Band hinter den Gliedern (schliesst die Fugen) / continuous band behind the links (closes the gaps)
  const band = new PMesh();
  const rs = resample(path, dens(120, 48)).map((it) => {
    const nz = it.t[1], ny = -it.t[0];
    return [[-1, 0.0004], [1, 0.0004], [1, LINK_T * 0.8], [-1, LINK_T * 0.8]].map(([sx, h]) => [TRACK_X + sx * TRACK_W * 0.46, it.p[1] + ny * h, it.p[0] + nz * h] as P3);
  });
  band.loft(rs, { loop: true, c: col(mat.ink) });
  m.add(outward(band));
  return m;
}

// ---------- Wanne / hull ----------

const DECK_Y = 0.158, SHELF_Y = 0.1;
/** Deckhoehe ueber die Laenge: schraeges Heck, Deck, Bugplatte - Ecken gerundet / deck height along the length: slanted rear, deck, glacis - corners rounded */
function deckY(z: number): number {
  const lin = (q: number) => {
    const k: [number, number][] = [[-0.3, 0.02], [-0.206, 0.112], [-0.176, DECK_Y], [0.088, DECK_Y], [0.206, 0.109], [0.3, 0.07]];
    for (let i = 0; i < k.length - 1; i++) if (q <= k[i + 1][0]) return lerp(k[i][1], k[i + 1][1], (q - k[i][0]) / (k[i + 1][0] - k[i][0]));
    return k[k.length - 1][1];
  };
  let s = 0;
  for (let i = -3; i <= 3; i++) s += lin(z + i * 0.0022);
  return s / 7;
}
/** Bugplatte: Punkt bei x und Anteil t von der Oberkante (0) zum Bug (1), um lift abgehoben; Matrix: y = Plattennormale */
/** glacis: point at x and share t from the top edge (0) to the nose (1), lifted by lift; matrix: y = plate normal */
function glacis(x: number, t: number, lift = 0): THREE.Matrix4 {
  const a = new THREE.Vector3(0, DECK_Y, 0.088), b = new THREE.Vector3(0, 0.109, 0.206);
  const down = b.clone().sub(a).normalize();
  const n2 = new THREE.Vector3(0, down.z, -down.y);
  return basis(a.lerp(b, t).setX(x).addScaledVector(n2, lift), new THREE.Vector3(1, 0, 0), n2, down);
}

function hull(asm: Assembly, L: Look): void {
  const red = col(L.hull), dark = col(L.hullDark), olive = col(L.trim);
  const m = new PMesh();
  // Oberwanne: Trapezquerschnitt mit gerundeten Kanten entlang z / upper hull: trapezoid section with rounded edges along z
  const zs: number[] = [];
  for (const [a, b, n] of [[-0.209, -0.2, 2], [-0.2, -0.16, 6], [-0.16, 0.07, 2], [0.07, 0.106, 6], [0.106, 0.196, 2], [0.196, 0.2085, 3]] as [number, number, number][]) for (let i = 0; i < n; i++) zs.push(lerp(a, b, i / n));
  zs.push(0.2085);
  const wb = 0.153, wt = 0.117;
  const rings = zs.map((z, i) => {
    const end = i === 0 || i === zs.length - 1;
    const yt = Math.max(SHELF_Y + 0.006, deckY(z) - (end ? 0.002 : 0)), k = end ? 0.985 : 1;
    // an Bug und Heck laufen die Seiten zusammen / the sides converge at nose and rear
    const taper = 1 - 0.1 * sstep(0.12, 0.21, z) - 0.04 * sstep(-0.17, -0.21, z);
    const top = Math.min(wt * taper, wb * taper - (yt - SHELF_Y) * 0.55);
    return roundPoly([[-wb * taper * k, SHELF_Y], [wb * taper * k, SHELF_Y], [top * k, yt], [-top * k, yt]], [0.003, 0.003, 0.0075, 0.0075], 3).map(([x, y]) => [x, y, z] as P3);
  });
  m.loft(rings, { c: red, capA: 'poly', capB: 'poly' });
  outward(m);
  // Unterwanne zwischen den Ketten / lower hull between the tracks
  const tub = roundPoly([[-0.204, 0.1], [-0.204, 0.064], [-0.172, 0.036], [0.158, 0.036], [0.2, 0.066], [0.2085, 0.101]], 0.006, 2);
  m.add(prism(tub, -0.101, 0.101, (z, y, w) => [w, y, z], dark, { bevel: 0.004, steps: 2 }));
  // Kettenabdeckung: Blech ueber die volle Breite mit gebogenen Kotfluegeln / track guard: sheet over the full width with curved mudguards
  const shelf = roundPoly([[-0.189, -0.198], [0.189, -0.198], [0.189, 0.196], [-0.189, 0.196]], 0.008, 3);
  m.add(prism(shelf, SHELF_Y - 0.0045, SHELF_Y + 0.0015, (x, z, w) => [x, w, z], dark, { bevel: 0.0012, steps: 1 }));
  for (const s of [-1, 1]) {
    const guard = (c: Circle, a0: number, a1: number, r: number) => {
      const n = dens(8, 4), o: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([c.z + Math.cos(a) * (r + 0.0032), c.y + Math.sin(a) * (r + 0.0032)]); }
      for (let i = n; i >= 0; i--) { const a = lerp(a0, a1, i / n); o.push([c.z + Math.cos(a) * r, c.y + Math.sin(a) * r]); }
      // Umlaufsinn gegen den Uhrzeigersinn (fuer die Fase) / counter-clockwise winding (for the bevel)
      if (a1 < a0) o.reverse();
      m.add(prism(o, s * 0.104, s * 0.189, (z, y, w) => [w, y, z], dark, { bevel: 0.001, steps: 1 }));
    };
    guard(SPROCKET, Math.PI / 2, 0.26, SHELF_Y - SPROCKET.y);
    guard(IDLER, Math.PI / 2, Math.PI - 0.55, SHELF_Y - IDLER.y);
  }
  asm.add(m, 38);

  const d = new PMesh();
  // Fahrerluke in der Bugplatte, Winkelspiegel, Kugelblende / driver's hatch in the glacis, periscopes, ball mount
  d.add(softCage(0.062, 0.007, 0.052, red, { tight: 2, round: 1 }), glacis(-0.048, 0.36, 0.003));
  d.add(softCage(0.05, 0.004, 0.012, dark, { tight: 1, round: 1 }), glacis(-0.048, 0.2, 0.0085));
  for (const x of [-0.062, -0.034]) d.add(softCage(0.012, 0.003, 0.004, mat.glassDark, { tight: 1, round: 0 }).setInk(0), glacis(x, 0.235, 0.0095));
  for (const x of [-0.075, -0.021]) d.add(softCage(0.007, 0.005, 0.014, dark, { tight: 1, round: 1 }), glacis(x, 0.13, 0.002));
  d.add(lathe([[0.02, 0], [0.02, 0.003], [0.0165, 0.006], [0.0001, 0.006]], 14, dark), glacis(0.058, 0.42, 0.0005));
  d.add(lathe([[0.0125, -0.006], [0.0128, 0.004], [0.009, 0.0105], [0.0001, 0.0125]], 12, red, { sz: 1 }), glacis(0.058, 0.42, 0.004));
  d.add(rod([[0, 0.008, 0], [0, 0.016, 0.03]], 0.0024, mat.dark, { seg: 6, smooth: false }), glacis(0.058, 0.42, 0.004));
  // Ersatzkettenglieder quer am Bug / spare track links across the nose
  for (let i = 0; i < 5; i++) {
    const x = -0.052 + i * 0.026;
    d.add(softCage(0.023, 0.0055, 0.03, mat.dark, { tight: 1, round: 1 }), glacis(x, 0.82, 0.003));
    d.add(softCage(0.006, 0.0085, 0.012, mat.metal, { tight: 1, round: 0 }), glacis(x, 0.82, 0.006));
  }
  d.add(rod([[-0.068, 0.0005, 0], [0.068, 0.0005, 0]], 0.0018, mat.metal, { seg: 5, smooth: false }), glacis(0, 0.705, 0.004));
  // Spritzleiste und Bolzen auf der Bugplatte / splash strip and bolts on the glacis
  d.add(softCage(0.2, 0.0042, 0.005, dark, { tight: 1, round: 1 }), glacis(0, 0.6, 0.002));
  if (rich()) {
    const bolts = new PMesh();
    for (let i = 0; i < 9; i++) bolts.add(lathe([[0.0022, 0], [0.0022, 0.0014], [0.0001, 0.002]], 6, shade(L.hull, 0.7), { fixed: true }), glacis(-0.092 + i * 0.023, 0.045, 0));
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) bolts.add(lathe([[0.0022, 0], [0.0022, 0.0014], [0.0001, 0.002]], 6, shade(L.hull, 0.7), { fixed: true }), glacis(s * 0.098, 0.2 + i * 0.2, 0));
    d.add(bolts.setInk(0));
  }
  // Schaufel an der Bugplatte / shovel on the glacis
  d.add(rod([[0, 0.003, -0.022], [0, 0.003, 0.02]], 0.0022, mat.wood, { seg: 6, smooth: false }).setInk(0.35), glacis(0.095, 0.33, 0.001));
  d.add(softCage(0.014, 0.003, 0.02, mat.metal, { tight: 1, round: 1, top: [0.014, 0.012] }).setInk(0.35), glacis(0.095, 0.56, 0.003));
  // Scheinwerfer mit Buegel / headlight with bracket
  for (const s of [-1, 1]) {
    const hl = mat4([s * 0.128, 0.128, 0.166], [Math.PI / 2 - 0.05, 0, 0]);
    d.add(lathe([[0.0001, -0.011], [0.0075, -0.009], [0.0115, -0.001], [0.0125, 0.006], [0.0125, 0.0085], [0.0108, 0.0085], [0.0104, 0.0068], [0.0001, 0.0078]], 14, (i) => (i >= 5 ? mat.lamp : dark)), hl);
    d.add(rod([[s * 0.128, 0.104, 0.162], [s * 0.128, 0.118, 0.162]], 0.003, dark, { seg: 6, smooth: false }));
    // Abschlepphaken am Bug / tow hooks at the nose
    d.add(rod([[s * 0.07, 0.082, 0.203], [s * 0.07, 0.085, 0.216], [s * 0.07, 0.096, 0.218], [s * 0.07, 0.1, 0.21]], 0.0034, dark, { seg: 6, ring: 0.004 }));
  }
  // Motordeck: Luftgitter mit Lamellen, runde Wartungsluke / engine deck: louvred grilles, round service hatch
  d.add(softCage(0.15, 0.007, 0.05, dark, { tight: 2, round: 1 }).move(0, DECK_Y + 0.0025, -0.142));
  for (let i = 0; i < 5; i++) d.add(softCage(0.138, 0.0028, 0.0054, mat.ink, { tight: 1, round: 0 }).setInk(0).apply(mat4([0, DECK_Y + 0.0068, -0.16 + i * 0.0092], [0.5, 0, 0])));
  for (const s of [-1, 1]) {
    d.add(softCage(0.03, 0.006, 0.07, dark, { tight: 2, round: 1 }).move(s * 0.093, DECK_Y + 0.001, -0.07));
    for (let i = 0; i < 6; i++) d.add(softCage(0.024, 0.0022, 0.005, mat.ink, { tight: 1, round: 0 }).setInk(0).move(s * 0.093, DECK_Y + 0.0045, -0.098 + i * 0.011));
    // Haltestangen und Schweissnaht an der Wannenseite / grab rails and weld seam on the hull side
    for (const z of [-0.095, 0.02]) d.add(rod([[s * 0.139, 0.128, z - 0.03], [s * 0.146, 0.133, z - 0.026], [s * 0.146, 0.133, z + 0.026], [s * 0.139, 0.128, z + 0.03]], 0.0019, mat.dark, { seg: 5, ring: 0.006 }).setInk(0.35));
    d.add(rod([[s * 0.1505, 0.106, -0.19], [s * 0.1505, 0.106, 0.11]], 0.0014, shade(L.hull, 0.72), { seg: 4, smooth: false }).setInk(0));
  }
  // Auspuffrohre mit Panzerkragen am Heck / exhaust pipes with armoured collars at the rear
  for (const s of [-1, 1]) {
    const ex = mat4([s * 0.094, 0.128, -0.197], [-Math.PI / 2 - 0.7, 0, 0]);
    d.add(lathe([[0.0125, -0.004], [0.0125, 0.006], [0.0098, 0.008], [0.0098, 0.03], [0.0072, 0.03], [0.0072, 0.012]], 12, (i) => (i >= 4 ? mat.ink : i >= 2 ? mat.darkMid : dark)), ex);
  }
  // Staukaesten auf den Kettenabdeckungen / stowage boxes on the track guards
  for (const [x, z, w, l] of [[0.171, 0.03, 0.03, 0.105], [-0.171, -0.07, 0.03, 0.09]] as number[][]) {
    d.add(softCage(w, 0.024, l, olive, { tight: 2, round: 1 }).move(x, SHELF_Y + 0.0135, z));
    d.add(softCage(w + 0.002, 0.0045, l + 0.002, shade(olive, 0.8), { tight: 1, round: 1 }).move(x, SHELF_Y + 0.0265, z));
    for (const dz of [-l * 0.28, l * 0.28]) d.add(softCage(0.004, 0.009, 0.006, mat.dark, { tight: 1, round: 0 }).setInk(0.3).move(x + Math.sign(x) * (w / 2 + 0.001), SHELF_Y + 0.02, z + dz));
  }
  asm.add(d, 38);

  // Balken zum Freischleppen: Holz mit Rinde, mit Baendern verzurrt / unditching log: wood with bark, lashed with bands
  const lg = new PMesh();
  const log = new Tube([{ p: [-0.171, SHELF_Y + 0.0145, 0.004], rx: 0.0128, rf: 0.0128 }, { p: [-0.171, SHELF_Y + 0.0145, 0.07], rx: 0.0135, rf: 0.013 }, { p: [-0.171, SHELF_Y + 0.0145, 0.14], rx: 0.012, rf: 0.012 }], { seg: 12, ring: 0.008, front: [0, 1, 0] });
  log.displace((u, a) => 0.0011 * Math.sin(a * 5 + Math.sin(u * 4) * 2) + 0.0007 * Math.sin(u * 9 + a));
  const bark = shade(mat.wood, 0.85), cut = col(mat.woodLight);
  log.mesh(lg, (u) => (u < 0.02 || u > 1.98 ? cut : bark), { capA: true, capB: true });
  for (const u of [0.35, 1.65]) log.band(lg, u - 0.06, u + 0.06, 0.0012, mat.dark, { nu: 1, thick: 0.0016 });
  asm.add(lg, 50);
  // Abschleppseil auf der linken Abdeckung / tow cable on the left guard
  const cable: P3[] = [[0.176, SHELF_Y + 0.004, -0.185], [0.178, SHELF_Y + 0.0045, -0.15], [0.181, SHELF_Y + 0.0045, -0.1], [0.18, SHELF_Y + 0.0045, -0.05], [0.166, SHELF_Y + 0.0045, -0.036], [0.158, SHELF_Y + 0.0045, -0.07], [0.16, SHELF_Y + 0.0045, -0.13], [0.164, SHELF_Y + 0.004, -0.18]];
  const cb = rod(cable, 0.0026, mat.metal, { seg: 6, ring: 0.007 });
  for (const e of [cable[0], cable[cable.length - 1]]) cb.add(lathe([[0.0062, -0.0018], [0.0062, 0.0018], [0.003, 0.0018], [0.003, -0.0018], [0.0062, -0.0018]], 10, mat.metal, { fixed: true }).move(e[0], e[1], e[2] - 0.006));
  asm.add(cb.setInk(0.4), 50);

  // Treibstoffaesser am Heck: Kennzeichen des Korvat-Panzers / fuel drums at the rear: the Korvat tank's hallmark
  const drums = new PMesh();
  for (const s of [-1, 1]) {
    const prof: [number, number][] = [[0.0001, -0.05], [0.0255, -0.05], [0.028, -0.0485], [0.028, -0.045], [0.0262, -0.0435]];
    for (const y of [-0.017, 0.017]) prof.push([0.0262, y - 0.004], [0.0282, y - 0.0025], [0.0282, y + 0.0025], [0.0262, y + 0.004]);
    prof.push([0.0262, 0.0435], [0.028, 0.045], [0.028, 0.0485], [0.0255, 0.05], [0.0001, 0.05]);
    const dm = mat4([s * 0.056, 0.137, -0.226]).multiply(R_X);
    drums.add(lathe(prof, 18, olive), dm);
    drums.add(lathe([[0.0048, 0], [0.0048, 0.003], [0.0001, 0.0036]], 8, mat.metal, { fixed: true }).setInk(0.3), dm.clone().multiply(mat4([0.014, 0.05, 0])));
    // Halter und Spannbaender / brackets and straps
    for (const dx of [-0.03, 0.03]) drums.add(lathe([[0.0288, -0.003], [0.0288, 0.003]], 18, mat.dark, { from: -1.9, to: 1.9 }).setInk(0.3), mat4([s * 0.056 + dx, 0.137, -0.226], [0, 0, 0]).multiply(R_X).multiply(mat4([0, 0, 0], [0, Math.PI, 0])));
    for (const dx of [-0.03, 0.03]) drums.add(softCage(0.006, 0.01, 0.03, dark, { tight: 1, round: 0 }).move(s * 0.056 + dx, 0.118, -0.21));
  }
  asm.add(drums, 38);
}

// ---------- Turm / turret ----------

const TURRET: [number, number, number] = [0, DECK_Y, 0.002];

/** Rohr entlang +z ab z=0: Blendenhuelse, Verjuengung, Rauchabsauger, Muendungsbremse mit Schlitzen, Bohrung */
/** barrel along +z from z=0: mantlet sleeve, taper, fume extractor, slotted muzzle brake, bore */
function gun(L: Look): PMesh {
  const body = col(L.hullDark), sleeve = col(L.hull), steel = col(mat.gunmetal), bore = col(mat.ink);
  const prof: [number, number, THREE.Color][] = [
    [0.0001, 0, sleeve], [0.0212, 0, sleeve], [0.0212, 0.03, sleeve], [0.0172, 0.034, sleeve], [0.0172, 0.058, body], [0.0138, 0.062, body], [0.013, 0.098, body],
    [0.0158, 0.104, body], [0.0158, 0.132, steel], [0.0128, 0.138, steel], [0.0118, 0.19, body], [0.0176, 0.194, body], [0.0176, 0.2055, steel], [0.0124, 0.2075, steel], [0.0124, 0.2135, bore],
    [0.0176, 0.2155, steel], [0.0176, 0.2275, steel], [0.0152, 0.231, steel], [0.0092, 0.231, steel], [0.0092, 0.2, bore],
  ];
  return lathe(prof.map(([r, z]) => [r, z] as const), 18, (i) => prof[i + 1][2]).apply(R_Z);
}

/** Schweres MG auf Lafette: Kuehlrippen, Muendung, Kasten, Griffe, Gurtkasten / heavy MG on a pintle: cooling fins, muzzle, receiver, grips, ammo box */
function roofMg(L: Look): PMesh {
  const m = new PMesh();
  const steel = col(mat.gunmetal), dark = col(mat.dark);
  const prof: [number, number][] = [[0.0001, 0], [0.0034, 0]];
  for (let i = 0; i < 7; i++) { const z = 0.004 + i * 0.0052; prof.push([0.0034, z], [0.0052, z + 0.0006], [0.0052, z + 0.0026], [0.0034, z + 0.0032]); }
  prof.push([0.0028, 0.042], [0.0028, 0.062], [0.0046, 0.063], [0.0046, 0.07], [0.002, 0.07], [0.002, 0.06]);
  m.add(lathe(prof, 10, (i) => (i >= prof.length - 3 ? mat.ink : steel), { fixed: true }).apply(R_Z).move(0, 0, 0.012));
  m.add(softCage(0.011, 0.013, 0.04, steel, { tight: 2, round: 1 }).move(0, -0.001, -0.006));
  m.add(softCage(0.006, 0.004, 0.02, dark, { tight: 1, round: 1 }).move(0, 0.0075, -0.004));
  for (const s of [-1, 1]) m.add(rod([[s * 0.0045, 0.002, -0.026], [s * 0.0052, 0.002, -0.04], [s * 0.0052, -0.006, -0.041]], 0.0015, mat.wood, { seg: 5, ring: 0.004 }));
  m.add(softCage(0.016, 0.018, 0.022, L.trim, { tight: 2, round: 1 }).move(-0.0135, -0.004, -0.002));
  m.setInk(0.4);
  return m;
}

/**
 * Kommandant in der Kuppel: dieselben Koerperteile wie der Schuetze (Rumpf ab dem Koppel, Aermel, Haende, Kopf, Helm),
 * kleiner eingesetzt und in geringerer Netzdichte. Zeigt, dass Besatzungen aus dem Figurenbaukasten fallen.
 * Commander in the cupola: the same body parts as the rifleman (torso from the belt up, sleeves, hands, head, helmet),
 * placed smaller and at a lower mesh density. Shows that crews fall out of the figure kit.
 */
function commander(asm: Assembly, L: Look, f: FactionId, at: P3, scale: number): void {
  const C = figureColours(L);
  const pose: FigurePose = {
    pelvis: [0, 0, 0], pelvisRoll: 0, pelvisYaw: 0.25, pelvisPitch: 0.04, chestRoll: -0.03, chestYaw: 0.42, chestPitch: 0.1, head: [-0.5, 0.02, 0.03],
    ankle: [[0, 0, 0], [0, 0, 0]], footYaw: [0, 0], kneePole: [[0, 0, 1], [0, 0, 1]], elbowPole: [[-0.9, -0.3, -0.3], [0.9, -0.3, -0.3]],
  };
  // Guertelhoehe der Figur auf den Lukenrand / the figure's belt height onto the hatch rim
  const M = mat4([at[0], at[1] - 0.262 * scale, at[2]], [0, 0, 0], scale);
  asm.within(M, () => withDensity(density() * 0.62, () => {
    const body = new Body(pose);
    const t = torsoTube(body, { skirt: false });
    torso(asm, t, C, L, { skirt: false });
    const headM = body.rigid(NECK_Y).multiply(mat4([0, HEAD_Y + 0.008, 0.0035], [pose.head[1], pose.head[0], pose.head[2]], HEAD_K));
    neck(asm, body.point([0, NECK_Y - 0.004, -0.002]), new THREE.Vector3(0, -0.026, -0.004).applyMatrix4(headM), C);
    const S = head(asm, headM, C, { seed: 7 });
    helmet(asm, headM, S, C, L, f);
    // Haende liegen auf dem Kuppelrand, Handflaeche nach unten / hands rest on the cupola rim, palms down
    for (const s of [-1, 1]) {
      const wrist = new THREE.Vector3(s * 0.046, 0.276, 0.03 - s * 0.008);
      const y = new THREE.Vector3(-s * 0.25, -0.05, 1).normalize(), z = new THREE.Vector3(s * 0.12, -1, 0);
      z.addScaledVector(y, -z.dot(y)).normalize();
      const HM = basis(wrist, y.clone().cross(z), y, z).scale(new THREE.Vector3(HAND_K, HAND_K, HAND_K));
      asm.add(hand(RELAXED, C.skin, s > 0).apply(HM), 60);
      sleeve(asm, body.point([s * SHOULDER_X, SHOULDER_Y, -0.002]), wrist, new THREE.Vector3(...pose.elbowPole[s < 0 ? 0 : 1]), s, C);
    }
  }));
}

function turret(asm: Assembly, L: Look, f: FactionId): void {
  const red = col(L.hull), dark = col(L.hullDark), olive = col(L.trim);
  const [, ty, tz] = TURRET;
  const S = (y: number, dz: number, rx: number, rf: number, rb: number, n = 2.5): Station => ({ p: [0, ty + y, tz + dz], rx, rf, rb, n });
  // Gussturm: unten eingezogen, groesste Breite auf halber Hoehe, Heck ausladend / cast turret: tucked in below, widest at mid height, bustle at the rear
  const t = new Tube([
    S(0.002, 0, 0.087, 0.085, 0.088, 2.3), S(0.008, 0, 0.1, 0.098, 0.105), S(0.03, -0.002, 0.105, 0.101, 0.116, 2.6), S(0.056, -0.004, 0.097, 0.091, 0.109, 2.6),
    S(0.076, -0.006, 0.083, 0.073, 0.093, 2.5), S(0.0865, -0.008, 0.064, 0.053, 0.077, 2.4), S(0.089, -0.008, 0.046, 0.037, 0.062, 2.4),
  ], { seg: 44, ring: 0.007, front: [0, 0, 1] });
  // Blendenausschnitt vorn flacher, Heckstaukasten als Wulst / flatter front for the mantlet, bustle swelling at the rear
  t.displace((u, a) => {
    const d = Math.atan2(Math.sin(a), Math.cos(a));
    return -0.006 * bell(u, 2.4, 1.6) * bell(d, 0, 0.5) + 0.003 * bell(u, 2.3, 1.2) * bell(Math.abs(d), Math.PI, 0.7);
  });
  const m = new PMesh();
  t.mesh(m, red, { capA: true, capB: true });
  // Gussnaht und Turmkranz / casting seam and turret ring
  t.band(m, 2.02, 2.16, 0.0011, shade(L.hull, 0.8), { nu: 1, thick: 0.0011 });
  m.add(lathe([[0.09, -0.004], [0.094, -0.002], [0.094, 0.004], [0.087, 0.006]], 40, olive).move(0, ty, tz));
  asm.add(m, 44);

  const d = new PMesh();
  // Blende: gegossener Block quer vor der Turmfront / mantlet: cast block across the turret front
  d.add(softCage(0.152, 0.062, 0.05, dark, { tight: 0, round: 2, cuts: [3, 2, 1] }).move(0, ty + 0.045, tz + 0.094));
  d.add(softCage(0.03, 0.02, 0.03, dark, { tight: 1, round: 1 }).move(0, ty + 0.05, tz + 0.111));
  const g = gun(L);
  for (const x of [-0.035, 0.035]) d.add(g, mat4([x, ty + 0.046, tz + 0.107]));
  // Zielfernrohr-Oeffnung und MG neben den Rohren / gun sight opening and coaxial MG beside the barrels
  d.add(lathe([[0.0052, 0], [0.0052, 0.006], [0.0032, 0.006], [0.0032, 0.001]], 8, (i) => (i >= 2 ? mat.ink : dark), { fixed: true }).apply(R_Z).move(0.07, ty + 0.058, tz + 0.107));
  d.add(rod([[0, ty + 0.03, tz + 0.11], [0, ty + 0.03, tz + 0.15]], 0.003, mat.dark, { seg: 6, smooth: false }));
  // Bolzen rund um die Blende / bolts around the mantlet
  if (rich()) {
    const bolts = new PMesh();
    for (const x of [-0.064, -0.02, 0.02, 0.064]) for (const y of [0.021, 0.069]) bolts.add(lathe([[0.0024, 0], [0.0024, 0.0016], [0.0001, 0.0022]], 6, shade(L.hullDark, 0.75), { fixed: true }).apply(R_Z).move(x, ty + y, tz + 0.1175));
    d.add(bolts.setInk(0));
  }
  asm.add(d, 44);

  const r = new PMesh();
  const roofY = ty + 0.089;
  // Kommandantenkuppel mit Sehschlitzen und aufgeklapptem Lukendeckel / commander's cupola with vision slits and an open hatch lid
  const cu: P3 = [-0.03, roofY - 0.006, tz - 0.026];
  const CR = 1.2;
  r.add(lathe([[0.0325 * CR, 0], [0.0345 * CR, 0.004], [0.0345 * CR, 0.017], [0.031 * CR, 0.0215], [0.0255 * CR, 0.0225], [0.0255 * CR, 0.0165], [0.0001, 0.0165]], 24, (i) => (i >= 4 ? mat.ink : red)).move(...cu));
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * TAU;
    r.add(softCage(0.012, 0.0046, 0.004, mat.glassDark, { tight: 1, round: 0 }).setInk(0), mat4([cu[0] + Math.sin(a) * 0.034 * CR, cu[1] + 0.012, cu[2] + Math.cos(a) * 0.034 * CR], [0, a, 0]));
  }
  r.add(lathe([[0.03, 0], [0.03, 0.0035], [0.022, 0.007], [0.0001, 0.0078]], 18, (i) => (i === 0 ? shade(L.hull, 0.7) : red)), mat4([cu[0], cu[1] + 0.046, cu[2] - 0.05], [-1.5, 0, 0]));
  r.add(softCage(0.016, 0.01, 0.01, dark, { tight: 1, round: 1 }).move(cu[0], cu[1] + 0.02, cu[2] - 0.044));
  // Ladeschuetzenluke, Luefterhaube, Winkelspiegel / loader's hatch, ventilator dome, periscopes
  r.add(lathe([[0.023, 0], [0.023, 0.003], [0.0195, 0.0055], [0.0001, 0.0065]], 18, red).move(0.04, roofY - 0.004, tz - 0.034));
  r.add(rod([[0.032, roofY + 0.002, tz - 0.04], [0.032, roofY + 0.0065, tz - 0.04], [0.048, roofY + 0.0065, tz - 0.04], [0.048, roofY + 0.002, tz - 0.04]], 0.0013, mat.dark, { seg: 5, ring: 0.004 }).setInk(0.3));
  r.add(lathe([[0.011, 0], [0.011, 0.004], [0.0155, 0.006], [0.0135, 0.0095], [0.0001, 0.0115]], 14, dark).move(0.006, roofY - 0.004, tz - 0.07));
  for (const x of [-0.044, 0.044]) {
    r.add(softCage(0.02, 0.012, 0.014, dark, { tight: 1, round: 1 }).move(x, roofY - 0.001, tz + 0.03));
    r.add(softCage(0.015, 0.005, 0.002, mat.glassDark, { tight: 1, round: 0 }).setInk(0).move(x, roofY + 0.001, tz + 0.0375));
  }
  // Haltestangen an den Turmflanken (folgen der Gussform) / grab rails on the turret flanks (follow the cast shape)
  for (const s of [-1, 1]) for (const [a0, a1] of [[0.7, 1.25], [1.95, 2.55]]) {
    const pts: P3[] = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const k = i / n, lift = 0.0015 + 0.0085 * Math.min(1, Math.sin(Math.PI * k) * 3);
      const p = t.at(3.15, s * lerp(a0, a1, k), lift);
      pts.push([p.x, p.y, p.z]);
    }
    r.add(rod(pts, 0.0019, mat.dark, { seg: 5, ring: 0.006 }).setInk(0.35));
  }
  // Antenne mit Fuss / antenna with base
  const an = t.at(4.2, Math.PI - 0.75, 0);
  r.add(lathe([[0.006, 0], [0.006, 0.004], [0.0035, 0.0065], [0.0035, 0.016], [0.0018, 0.019]], 8, mat.dark).move(an.x, an.y - 0.002, an.z));
  r.add(rod([[an.x, an.y + 0.016, an.z], [an.x - 0.002, an.y + 0.09, an.z - 0.008], [an.x - 0.006, an.y + 0.17, an.z - 0.02]], (k) => 0.0013 * (1 - 0.5 * k), mat.dark, { seg: 5, ring: 0.03 }).setInk(0.35));
  r.add(softCage(0.005, 0.005, 0.005, olive, { tight: 0, round: 2 }).setInk(0.35).move(an.x - 0.006, an.y + 0.17, an.z - 0.02));
  asm.add(r, 40);
  // MG auf Drehring an der Ladeschuetzenluke / MG on a ring mount at the loader's hatch
  const mg = new PMesh();
  mg.add(rod([[0.04, roofY, tz - 0.004], [0.04, roofY + 0.02, tz - 0.004]], 0.0032, mat.dark, { seg: 6, smooth: false }));
  mg.add(roofMg(L), mat4([0.04, roofY + 0.024, tz - 0.004], [-0.16, -0.12, 0]));
  asm.add(mg, 40);

  // Plane als Rolle am Turmheck, mit Riemen / tarp roll on the turret rear, with straps
  const tp = new PMesh();
  const pts: Station[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + lerp(-0.62, 0.62, i / 8);
    const p = t.at(2.75, a, 0.0115);
    pts.push({ p: [p.x, p.y, p.z], rx: i === 0 || i === 8 ? 0.008 : 0.011, rf: i === 0 || i === 8 ? 0.008 : 0.011 });
  }
  const tarp = new Tube(pts, { seg: 12, ring: 0.007, front: [0, 1, 0] });
  tarp.displace((u, a) => 0.0011 * Math.sin(a * 3 + u * 2.4) + 0.0007 * Math.sin(u * 6.5));
  tarp.mesh(tp, mix(L.gear, mat.sand, 0.25), { capA: true, capB: true });
  for (const u of [1.6, 4, 6.4]) tarp.band(tp, u - 0.09, u + 0.09, 0.0011, mat.dark, { nu: 1, thick: 0.0015 });
  asm.add(tp, 60);

  // Fraktionszeichen an beiden Turmflanken, flach auf der Gussform / faction emblem on both turret flanks, flat on the cast shape
  for (const s of [-1, 1]) {
    const p = t.at(2.5, s * 1.58, 0.0012), n = t.normalAt(2.5, s * 1.58);
    const x = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const xf = xfOf(basis(p, x, n.clone().cross(x), n));
    asm.addBuilt((b) => addEmblem(b, f, 0.026, 0.0016, L.emblem, { p: xf.p, r: xf.r }), 0);
  }
  commander(asm, L, f, [cu[0], cu[1] + 0.021, cu[2]], 0.7);
}

/** Korvat-Panzer ohne Groessenklasse und Helligkeitsverlauf / Korvat tank without size class and value ramp */
export function tankRaw(f: FactionId): THREE.BufferGeometry {
  const L = look(f);
  const asm = new Assembly();
  asm.add(runningGear(L).mirrorX(), 36);
  hull(asm, L);
  asm.turret(TURRET, () => turret(asm, L, f));
  return asm.build();
}

/** Panzer wie auf dem Brett (Groessenklasse 1.1 und Form [1.18, 1, 1] wie tank) / tank as on the board (size class 1.1 and shape [1.18, 1, 1] as tank) */
export function protoTank(f: FactionId): THREE.BufferGeometry {
  return finishProto(tankRaw(f), 1.1, [1.18, 1, 1]);
}
