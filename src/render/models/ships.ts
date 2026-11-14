/**
 * Schiffe: Landungsboot, U-Boot, Zerstoerer, Kriegsschiff. Wasserlinie bei y=0, Bug in +z.
 * Ships: landing boat, submarine, destroyer, battleship. Waterline at y=0, bow towards +z.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, shade } from './kit';
import { look, mat, styleOf, type Look } from './look';
import { soldier, standPose } from './soldiers';

const HALF_PI = Math.PI / 2;

/** Rumpfumriss mit gerundetem Bug / hull outline with rounded bow */
function outline(len: number, beam: number, bow: number, s: number): [number, number][] {
  const h = (len / 2) * s;
  const w = (beam / 2) * s;
  const pts: [number, number][] = [[-w * 0.8, -h], [w * 0.8, -h], [w * 0.97, -h + 0.025], [w, -h + 0.06], [w, h - bow]];
  // Bugkurve / bow curve
  for (const t of [0.4, 0.75]) pts.push([w * Math.cos(t * HALF_PI) ** 0.8, h - bow + bow * Math.sin(t * HALF_PI)]);
  pts.push([0, h]);
  const right = pts.slice(1, pts.length - 1).reverse().map(([x, z]) => [-x, z] as [number, number]);
  return [...pts, ...right];
}

/** Rumpf mit Wasserpass, Deck, Bullaugen, Reling, Ankern und Bugwelle / hull with boot-topping, deck, portholes, rail, anchors, bow wave */
export function hull(b: Builder, L: Look, len: number, beam: number, top: number, bow: number, deck: THREE.Color, portholes = 10) {
  b.add(geo.prismXZ(outline(len, beam, bow, 0.94), 0.03), L.hullDark, { p: [0, -0.03, 0] });
  b.add(geo.prismXZ(outline(len, beam, bow, 0.97), 0.016), mat.ink, { p: [0, 0.0, 0] });
  b.add(geo.prismXZ(outline(len, beam, bow, 1), top - 0.016), L.hull, { p: [0, 0.016, 0] });
  b.add(geo.prismXZ(outline(len, beam, bow, 1.012), 0.008), L.trim, { p: [0, top - 0.012, 0] });
  b.add(geo.prismXZ(outline(len, beam, bow, 0.9), 0.008), deck, { p: [0, top, 0] });
  const h = len / 2, w = beam / 2;
  // Bullaugen / portholes
  const z0 = -h + 0.07, z1 = h - bow - 0.01;
  for (let i = 0; i < portholes; i++) {
    const z = z0 + ((i + 0.5) / portholes) * (z1 - z0);
    for (const s of [-1, 1]) b.box(0.004, 0.011, 0.011, mat.window, [s * (w + 0.002), top * 0.48, z]);
  }
  // Reling / rail
  for (const s of [-1, 1]) {
    b.box(0.004, 0.004, z1 - z0 + 0.04, mat.white, [s * (w * 0.93), top + 0.02, (z0 + z1) / 2]);
    for (let i = 0; i <= 12; i++) b.box(0.004, 0.02, 0.004, mat.white, [s * (w * 0.93), top + 0.01, z0 + (i / 12) * (z1 - z0)]);
    // zweite Portlochreihe + Scheuerleiste / second porthole row + rubbing strake
    for (let i = 0; i < portholes; i++) b.box(0.004, 0.008, 0.008, mat.window, [s * (w + 0.002), top * 0.75, z0 + ((i + 0.5) / portholes) * (z1 - z0)]);
    b.box(0.006, 0.006, z1 - z0, shade(L.hull, 0.8), [s * (w + 0.002), top * 0.25, (z0 + z1) / 2]);
    b.box(0.004, 0.004, z1 - z0 + 0.04, mat.white, [s * (w * 0.93), top + 0.011, (z0 + z1) / 2]);
    // Ankerkette / anchor chain
    b.box(0.006, 0.004, 0.08, mat.dark, [s * 0.02, top + 0.009, h - bow * 0.6], [0, s * 0.3, 0]);
    // Anker / anchor
    b.box(0.006, 0.022, 0.016, mat.dark, [s * (w * 0.62 + 0.004), top * 0.6, h - bow * 0.45], [0, s * 0.6, 0]);
  }
  // Luken + Luefter auf dem Vordeck / hatches + vents on the foredeck
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.026, 0.008, 0.03, 0.006), shade(deck, 0.8), { p: [s * w * 0.4, top + 0.012, h - bow - 0.03] });
    b.cyl(0.007, 0.007, 0.022, 6, mat.white, [s * w * 0.55, top + 0.018, -h + 0.08]);
    b.add(geo.hemi(0.009, 6, 2), mat.white, { p: [s * w * 0.55, top + 0.029, -h + 0.08] });
    // Poller / bollards
    for (const z of [h - bow - 0.06, -h + 0.04]) b.cyl(0.006, 0.007, 0.012, 6, mat.dark, [s * w * 0.75, top + 0.014, z]);
  }
  // Bugwelle / bow wave
  b.add(geo.prismXZ([[-w * 0.9, h - bow * 0.9], [0, h + 0.008], [w * 0.9, h - bow * 0.9], [w * 0.5, h - bow * 0.5], [-w * 0.5, h - bow * 0.5]], 0.006), mat.white, { p: [0, 0.0, 0] });
}

/** Aufbau-Block im Fraktionsstil mit Bruecke / superstructure block in faction style with bridge windows */
export function superBlock(b: Builder, f: FactionId, L: Look, x: number, y: number, z: number, w: number, h: number, d: number) {
  const base = styleOf(f) === 'alvenia' || styleOf(f) === 'korvat' ? mat.concreteLight : styleOf(f) === 'meridon' ? mat.paper : styleOf(f) === 'dravon' ? shade(L.primary, 1.35) : shade(L.primary, 1.15);
  switch (styleOf(f)) {
    case 'korvat':
      b.add(geo.cbox(w, h, d, 0.008), base, { p: [x, y + h / 2, z] });
      b.block(x, y + h * 0.62, z, w + 0.006, h * 0.16, d + 0.006, mat.window);
      mullions(b, x, y + h * 0.7, z, w, d);
      b.block(x, y + h, z, w + 0.01, 0.006, d + 0.01, L.primary);
      break;
    case 'dravon':
      b.add(geo.taper(w, d, w * 0.7, d * 0.6, h, -d * 0.12), base, { p: [x, y + h / 2, z] });
      b.add(geo.taper(w * 0.88, d * 0.8, w * 0.84, d * 0.74, h * 0.14, -d * 0.1), L.secondary, { p: [x, y + h * 0.7, z] });
      break;
    case 'alvenia':
      b.add(geo.cyl(0.5, 0.5, h, 8), base, { p: [x, y + h / 2, z], s: [w, 1, d] });
      b.add(geo.cyl(0.5, 0.5, h * 0.16, 8, true), mat.window, { p: [x, y + h * 0.7, z], s: [w + 0.006, 1, d + 0.006] });
      b.add(geo.cyl(0.5, 0.5, 0.006, 8), L.primary, { p: [x, y + h + 0.003, z], s: [w + 0.004, 1, d + 0.004] });
      break;
    case 'meridon':
      b.add(geo.cbox(w, h, d, 0.006), base, { p: [x, y + h / 2, z] });
      b.block(x, y + h * 0.62, z, w + 0.006, h * 0.16, d + 0.006, mat.window);
      mullions(b, x, y + h * 0.7, z, w, d);
      b.block(x, y + h, z, w + 0.02, 0.006, d + 0.02, L.secondary);
      break;
    case 'velkar':
      b.add(geo.taper(w, d, w * 0.72, d * 0.72, h), base, { p: [x, y + h / 2, z] });
      b.add(geo.taper(w * 0.86, d * 0.86, w * 0.82, d * 0.82, h * 0.13), L.secondary, { p: [x, y + h * 0.65, z] });
      break;
  }
}

/** Fensterstreben vorn und seitlich an der Bruecke / window mullions on the bridge front and sides */
function mullions(b: Builder, x: number, y: number, z: number, w: number, d: number) {
  const n = Math.max(3, Math.round(w / 0.022));
  for (let i = 1; i < n; i++) b.box(0.004, 0.016, 0.006, mat.ink, [x - w / 2 + (i / n) * w, y, z + d / 2 + 0.004]);
  for (const s of [-1, 1]) for (let i = 1; i < 3; i++) b.box(0.006, 0.016, 0.004, mat.ink, [x + s * (w / 2 + 0.004), y, z - d / 2 + (i / 3) * d]);
}

/** Rettungsringe an der Reling / life rings on the rail */
export function lifeRings(b: Builder, x: number, y: number, zs: number[]) {
  for (const s of [-1, 1]) for (const z of zs) {
    b.add(geo.torus(0.014, 0.0045, 4, 12), mat.white, { p: [s * x, y, z], r: [0, HALF_PI, 0] });
    for (const a of [0, HALF_PI]) b.box(0.003, 0.01, 0.006, mat.red, [s * (x + 0.001), y + Math.cos(a) * 0.014, z + Math.sin(a) * 0.014]);
  }
}

/** Bruecke mit Nocken / bridge with wings */
function bridgeWings(b: Builder, L: Look, y: number, z: number, w: number) {
  b.block(0, y, z, w, 0.008, 0.03, L.hullDark);
  for (const s of [-1, 1]) b.block(s * (w / 2 - 0.006), y + 0.008, z, 0.012, 0.014, 0.03, mat.white);
}

/** Rettungsboote an beiden Seiten / lifeboats on both sides */
function lifeboats(b: Builder, L: Look, x: number, y: number, z: number) {
  for (const s of [-1, 1]) {
    b.add(geo.ctaper(0.02, 0.07, 0.03, 0.09, 0.02, 0.012), mat.white, { p: [s * x, y + 0.01, z] });
    b.add(geo.ctaper(0.024, 0.07, 0.016, 0.06, 0.012, 0.01), L.primary, { p: [s * x, y + 0.026, z] });
    for (const dz of [-0.03, 0.03]) b.add(geo.cyl(0.003, 0.003, 0.04, 4), mat.dark, { p: [s * (x + 0.01), y + 0.03, z + dz], r: [0, 0, s * 0.4] });
  }
}

/** Geschuetzturm / gun turret; dir 1 = nach vorn, -1 = nach hinten */
function turret(b: Builder, f: FactionId, L: Look, z: number, y: number, size: number, barrels: number, dir: 1 | -1) {
  const big = styleOf(f) === 'dravon' ? 1.45 : 1;
  b.group({ p: [0, y, z], r: [0, dir === 1 ? 0 : Math.PI, 0] }, () => {
    if (styleOf(f) === 'alvenia') {
      b.cyl(size * 0.5, size * 0.55, size * 0.34, 8, L.hull, [0, size * 0.25, 0]);
      b.add(geo.hemi(size * 0.5, 8, 2), L.hull, { p: [0, size * 0.42, 0], s: [1, 0.3, 1] });
    } else if (styleOf(f) === 'dravon') {
      b.add(geo.prismXZ([[-size * 0.55, -size * 0.45], [size * 0.55, -size * 0.45], [size * 0.5, size * 0.25], [0, size * 0.55], [-size * 0.5, size * 0.25]], size * 0.38), L.hull, { p: [0, size * 0.06, 0] });
      b.add(geo.prismXZ([[-size * 0.56, -size * 0.46], [size * 0.56, -size * 0.46], [size * 0.51, size * 0.26], [-size * 0.51, size * 0.26]], size * 0.08), L.trim, { p: [0, size * 0.24, 0] });
    } else if (styleOf(f) === 'velkar') {
      b.add(geo.taper(size * 1.0, size * 0.95, size * 0.7, size * 0.6, size * 0.34, -size * 0.06), L.hull, { p: [0, size * 0.23, 0] });
    } else {
      b.add(geo.ctaper(size * 0.95, size * 0.9, size * 0.85, size * 0.75, size * 0.36, size * 0.12), L.hull, { p: [0, size * 0.24, 0] });
      if (styleOf(f) === 'meridon') b.block(0, size * 0.42, -size * 0.2, size * 0.5, size * 0.1, size * 0.3, L.trim);
    }
    b.cyl(size * 0.44, size * 0.48, size * 0.08, 12, L.hullDark, [0, size * 0.04, 0]);
    // Entfernungsmesser + Luke / rangefinder + hatch
    b.box(size * 1.15, size * 0.08, size * 0.1, L.hullDark, [0, size * 0.36, -size * 0.25]);
    b.box(size * 0.25, size * 0.04, size * 0.2, L.trim, [size * 0.18, size * 0.44, -size * 0.1]);
    const len = size * 1.1 * big;
    for (let i = 0; i < barrels; i++) {
      const x = barrels === 1 ? 0 : (i - (barrels - 1) / 2) * size * 0.32;
      b.cyl(size * 0.1, size * 0.11, size * 0.12, 8, mat.darkMid, [x, size * 0.26, size * 0.42], [HALF_PI - 0.06, 0, 0]);
      b.cyl(size * 0.07 * big, size * 0.08 * big, len, 8, mat.dark, [x, size * 0.26, size * 0.4 + len / 2], [HALF_PI - 0.06, 0, 0]);
      b.cyl(size * 0.09 * big, size * 0.09 * big, size * 0.07, 8, mat.ink, [x, size * 0.26 + len * 0.06, size * 0.4 + len], [HALF_PI - 0.06, 0, 0]);
    }
  });
}

/** Dreibeinmast mit Radar / tripod mast with radar */
export function mast(b: Builder, L: Look, f: FactionId, z: number, y: number, h: number) {
  for (const [x, dz] of [[-0.03, -0.025], [0.03, -0.025], [0, 0.03]] as [number, number][]) b.tube([x, y, z + dz], [0, y + h * 0.7, z], 0.005, 4, mat.dark);
  b.cyl(0.006, 0.008, h * 0.35, 6, mat.dark, [0, y + h * 0.82, z]);
  b.cyl(0.03, 0.03, 0.008, 10, L.hullDark, [0, y + h * 0.7, z]);
  b.box(0.12, 0.006, 0.006, mat.dark, [0, y + h * 0.85, z]);
  // Radarbalken / radar bar
  b.group({ p: [0, y + h * 0.72, z], r: [0, 0.6, 0] }, () => {
    b.cyl(0.004, 0.004, 0.02, 4, mat.dark, [0, 0.01, 0]);
    b.box(0.09, 0.016, 0.008, mat.white, [0, 0.026, 0]);
  });
  if (styleOf(f) === 'velkar' || styleOf(f) === 'alvenia') b.add(geo.sphere(0.026, 8, 4), mat.white, { p: [0, y + h * 0.58, z + 0.035] });
  if (styleOf(f) === 'velkar') b.add(geo.ico(0.01, 0), L.secondary, { p: [0, y + h + 0.01, z] });
  // Wimpel in Fraktionsfarbe / pennant in faction colour
  b.add(geo.profileZY([[0, 0], [-0.07, -0.015], [0, -0.03]], 0.004), L.trim, { p: [0, y + h, z - 0.004] });
}

function funnel(b: Builder, f: FactionId, L: Look, z: number, y: number, h: number, r: number) {
  if (styleOf(f) === 'alvenia') b.cyl(r, r * 1.1, h, 10, L.hull, [0, y + h / 2, z], [-0.15, 0, 0]);
  else if (styleOf(f) === 'velkar') b.add(geo.taper(r * 2, r * 2.4, r * 1.4, r * 1.6, h), L.hull, { p: [0, y + h / 2, z] });
  else if (styleOf(f) === 'dravon') b.add(geo.taper(r * 2, r * 2.6, r * 1.6, r * 1.6, h, -r * 0.6), L.hull, { p: [0, y + h / 2, z] });
  else b.add(geo.cbox(r * 2, h, r * 2.4, r * 0.5), L.hull, { p: [0, y + h / 2, z] });
  const dz = styleOf(f) === 'dravon' ? -r * 0.6 : 0;
  b.block(0, y + h - 0.02, z + dz, r * 2.1, 0.02, r * 2.5, L.trim);
  b.block(0, y + h, z + dz, r * 1.5, 0.004, r * 1.8, mat.ink);
  b.add(geo.ico(r * 0.9, 0), mat.cloudShade, { p: [0, y + h + r, z + dz - r * 0.6] });
}

/** Container-Stapel (Meridon) / container stack */
function containers(b: Builder, L: Look, z: number, y: number) {
  const tones = [L.trim, L.primary, shade(L.trim, 0.8)];
  [[-0.045, 0], [0.045, 0], [0, 1]].forEach(([x, lvl], i) => {
    b.block(x, y + lvl * 0.04, z, 0.085, 0.04, 0.1, tones[i % 3]);
    for (const dz of [-0.03, 0, 0.03]) b.block(x, y + lvl * 0.04 + 0.002, z + dz, 0.089, 0.036, 0.006, shade(tones[i % 3], 0.75));
  });
}

export function landingBoat(f: FactionId, carried: THREE.BufferGeometry | null): Builder {
  const b = new Builder();
  const L = look(f);
  const len = 0.62, w = 0.3, top = 0.07;
  // flacher Kasten-Rumpf mit gefasten Kanten / flat box hull with chamfered edges
  b.add(geo.cbox(w - 0.02, 0.03, len - 0.02, 0.03), L.hullDark, { p: [0, -0.015, 0] });
  b.add(geo.cbox(w, 0.014, len, 0.03), mat.ink, { p: [0, 0.007, 0] });
  b.block(0, 0.014, -0.02, w - 0.02, 0.012, len - 0.06, mat.woodLight);
  for (let i = 0; i < 4; i++) b.block(0, 0.026, -0.22 + i * 0.13, w - 0.06, 0.003, 0.008, mat.wood);
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.03, top - 0.014, len - 0.02, 0.008), L.hull, { p: [s * (w / 2 - 0.015), 0.014 + (top - 0.014) / 2, -0.01] });
    b.block(s * (w / 2 - 0.015), top, -0.01, 0.034, 0.006, len - 0.02, L.trim);
    // Poller, Fender, Seitenrippen / bollards, fenders, side ribs
    for (const z of [-0.2, 0.15]) b.cyl(0.008, 0.009, 0.016, 6, mat.dark, [s * (w / 2 - 0.015), top + 0.011, z]);
    for (const z of [-0.05, 0.15]) b.cyl(0.011, 0.011, 0.03, 8, mat.dark, [s * (w / 2 + 0.008), 0.035, z]);
    for (let i = 0; i < 3; i++) b.box(0.004, top - 0.02, 0.008, L.hullDark, [s * (w / 2 + 0.001), top / 2 + 0.005, -0.2 + i * 0.15]);
  }
  // Rettungsring + Bootsfuehrer / life ring + helmsman
  b.add(geo.torus(0.022, 0.007, 4, 10), mat.white, { p: [w / 2 + 0.004, 0.05, -0.2], r: [0, HALF_PI, 0] });
  b.add(geo.torus(0.022, 0.0072, 4, 4), L.primary, { p: [w / 2 + 0.0045, 0.05, -0.2], r: [0, HALF_PI, Math.PI / 4] });
  b.group({ p: [0.08, top - 0.02, -0.22], s: 0.6 }, () => soldier(b, f, standPose([[-0.06, 0.24, -0.08], [0.06, 0.24, -0.08]]), { detail: 0, seed: 9, noLegs: true }));
  b.block(0, 0.014, -len / 2 + 0.03, w, top - 0.014 + 0.015, 0.06, L.hull);
  // Bugrampe mit Rippen / bow ramp with ribs
  b.group({ p: [0, 0.06, len / 2 - 0.03], r: [-0.2, 0, 0] }, () => {
    b.add(geo.cbox(w - 0.02, 0.1, 0.018, 0.006), L.hullDark, {});
    for (const y of [-0.03, 0.0, 0.03]) b.box(w - 0.04, 0.008, 0.008, L.trim, [0, y, 0.011]);
  });
  for (const s of [-1, 1]) b.tube([s * 0.13, top + 0.004, len / 2 - 0.06], [s * 0.13, 0.1, len / 2 - 0.03], 0.003, 4, mat.metal);
  // Steuerstand mit Motorabdeckung / helm station with engine cover
  b.add(geo.cbox(0.1, 0.08, 0.07, 0.012), L.hull, { p: [0.08, top + 0.04, -len / 2 + 0.05] });
  b.block(0.08, top + 0.045, -len / 2 + 0.05, 0.104, 0.02, 0.074, mat.window);
  b.block(0.08, top + 0.08, -len / 2 + 0.05, 0.11, 0.01, 0.08, L.trim);
  b.add(geo.cbox(0.09, 0.03, 0.05, 0.01), L.hullDark, { p: [-0.07, top + 0.015, -len / 2 + 0.045] });
  b.cyl(0.008, 0.01, 0.05, 6, mat.darkMid, [-0.1, top + 0.05, -len / 2 + 0.04]);
  b.cyl(0.004, 0.004, 0.12, 4, mat.dark, [0.11, top + 0.14, -len / 2 + 0.04]);
  b.add(geo.profileZY([[0, 0], [-0.06, -0.012], [0, -0.024]], 0.004), L.trim, { p: [0.11, top + 0.2, -len / 2 + 0.036] });
  b.box(0.01, 0.01, 0.01, mat.red, [-0.135, top + 0.02, 0.2]);
  b.box(0.01, 0.01, 0.01, mat.green, [0.135, top + 0.02, 0.2]);
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [w / 2 + 0.003, 0.045, -0.08], r: [0, HALF_PI, 0] });
  // Ladung: kleine getragene Einheit / cargo: tiny carried unit marker
  if (carried) b.addColored(carried, { p: [-0.02, 0.029, 0.04], s: 0.5 });
  else b.add(geo.cbox(0.08, 0.05, 0.08, 0.012), L.gear, { p: [0, 0.054, 0.04] });
  return b;
}

export function submarine(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  // Rumpf als gestreckter Koerper / hull as stretched body
  b.add(geo.sphere(0.1, 20, 10), L.hullDark, { p: [0, 0.0, 0], s: [0.85, 0.6, 4.1] });
  b.add(geo.sphere(0.1, 20, 8), L.hull, { p: [0, 0.012, 0], s: [0.75, 0.42, 3.8] });
  b.add(geo.cbox(0.05, 0.012, 0.56, 0.012), L.hull, { p: [0, 0.052, -0.01] });
  b.box(0.02, 0.008, 0.5, L.trim, [0, 0.06, 0]);
  // Flutschlitze + Reling / flood holes + rail
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 8; i++) b.box(0.006, 0.006, 0.02, mat.ink, [sx * 0.07, 0.028, -0.26 + i * 0.07]);
    b.box(0.003, 0.003, 0.2, mat.white, [sx * 0.022, 0.078, -0.2]);
    for (let i = 0; i < 4; i++) b.box(0.003, 0.018, 0.003, mat.white, [sx * 0.022, 0.068, -0.29 + i * 0.06]);
  }
  // Luken / hatches
  for (const z of [-0.2, 0.2, 0.28]) b.cyl(0.012, 0.013, 0.008, 8, L.hullDark, [0, 0.062, z]);
  // Bugwelle + Kielwasser / bow wave + wake
  b.add(geo.prismXZ([[-0.07, 0.3], [0, 0.44], [0.07, 0.3], [0.04, 0.34], [-0.04, 0.34]], 0.006), mat.white, { p: [0, 0.0, 0] });
  b.add(geo.prismXZ([[-0.06, -0.37], [0.06, -0.37], [0.03, -0.425], [-0.03, -0.425]], 0.006), mat.white, { p: [0, 0.0, 0] });
  // Turm / sail
  const sz = 0.06;
  let st = 0.15;
  switch (styleOf(f)) {
    case 'korvat':
      b.add(geo.cbox(0.07, 0.12, 0.14, 0.014), L.hull, { p: [0, 0.09, sz] });
      b.block(0, 0.12, sz, 0.074, 0.016, 0.144, L.trim);
      for (const z of [-0.04, 0, 0.04]) b.box(0.074, 0.006, 0.006, L.hullDark, [0, 0.07, sz + z]);
      break;
    case 'dravon':
      b.add(geo.profileZY([[-0.08, 0], [0.09, 0], [0.04, 0.15], [-0.07, 0.15]], 0.07), L.hull, { p: [0, 0.03, sz] });
      b.add(geo.profileZY([[-0.075, 0.1], [0.06, 0.1], [0.05, 0.12], [-0.073, 0.12]], 0.074), L.trim, { p: [0, 0.03, sz] });
      st = 0.18;
      break;
    case 'alvenia':
      b.add(geo.cyl(0.5, 0.5, 0.12, 16), L.hull, { p: [0, 0.09, sz], s: [0.07, 1, 0.15] });
      b.add(geo.cyl(0.5, 0.5, 0.016, 16, true), L.trim, { p: [0, 0.13, sz], s: [0.075, 1, 0.155] });
      break;
    case 'meridon':
      b.add(geo.cbox(0.065, 0.11, 0.13, 0.012), L.hull, { p: [0, 0.085, sz] });
      b.block(0, 0.05, -0.12, 0.09, 0.035, 0.12, L.trim);
      for (const z of [-0.16, -0.12, -0.08]) b.block(0, 0.051, z, 0.094, 0.036, 0.008, shade(L.trim, 0.78));
      break;
    case 'velkar':
      b.add(geo.rtaper(0.08, 0.16, 0.04, 0.1, 0.12, 0.01, -0.01), L.hull, { p: [0, 0.09, sz] });
      b.box(0.042, 0.012, 0.06, L.secondary, [0, 0.12, sz - 0.01]);
      break;
  }
  // Bruecke, Tiefenruder, Periskope, Schnorchel, Antenne / bridge, planes, periscopes, snorkel, antenna
  b.box(0.06, 0.014, 0.02, mat.window, [0, st - 0.025, sz + 0.06]);
  b.add(geo.cbox(0.16, 0.008, 0.035, 0.012), L.hullDark, { p: [0, 0.11, sz + 0.03] });
  b.cyl(0.006, 0.006, 0.09, 6, mat.dark, [0, st + 0.04, sz + 0.02]);
  b.add(geo.cbox(0.01, 0.014, 0.024, 0.003), mat.dark, { p: [0, st + 0.085, sz + 0.028] });
  b.box(0.006, 0.006, 0.004, mat.glass, [0, st + 0.085, sz + 0.041]);
  b.cyl(0.005, 0.005, 0.07, 6, mat.dark, [0.014, st + 0.03, sz - 0.02]);
  b.cyl(0.008, 0.008, 0.05, 6, mat.darkMid, [-0.014, st + 0.02, sz - 0.04]);
  b.cyl(0.002, 0.002, 0.08, 3, mat.dark, [0.0, st + 0.04, sz - 0.05]);
  // Heckruder + Schraube / stern rudders + propeller
  b.add(geo.cbox(0.008, 0.11, 0.05, 0.004), L.hullDark, { p: [0, 0.0, -0.4] });
  b.add(geo.cbox(0.13, 0.008, 0.05, 0.012), L.hullDark, { p: [0, 0.0, -0.4] });
  b.add(geo.cone(0.016, 0.026, 8), mat.metal, { p: [0, 0, -0.425], r: [-HALF_PI, 0, 0] });
  for (let i = 0; i < 3; i++) b.box(0.012, 0.04, 0.004, mat.metal, [0, 0, -0.418], [0, 0, (i / 3) * Math.PI]);
  addEmblem(b, f, 0.03, 0.006, L.emblem, { p: [0.04, 0.09, sz], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.03, 0.006, L.emblem, { p: [-0.04, 0.09, sz], r: [0, -HALF_PI, 0] });
  // Kommandant im Turm (Fraktions-Kopfbedeckung) / commander in the sail (faction headgear)
  b.group({ p: [0, st - 0.115, sz - 0.03], s: 0.55 }, () => soldier(b, f, standPose([[-0.09, 0.27, 0.06], [0.09, 0.27, 0.06]]), { detail: 0, seed: 8, noLegs: true }));
  return b;
}

export function destroyer(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  const top = 0.06;
  hull(b, L, 0.84, 0.2, top, 0.22, mat.metalLight, 14);
  const d = top + 0.008;
  superBlock(b, f, L, 0, d, 0.06, 0.13, 0.07, 0.16);
  superBlock(b, f, L, 0, d + 0.07, 0.08, 0.1, 0.055, 0.08);
  bridgeWings(b, L, d + 0.11, 0.1, 0.15);
  mast(b, L, f, 0.06, d + 0.125, 0.16);
  funnel(b, f, L, -0.06, d, 0.13, 0.03);
  lifeboats(b, L, 0.07, d + 0.04, -0.04);
  lifeRings(b, 0.072, d + 0.025, [0.13, -0.2]);
  turret(b, f, L, 0.24, d, 0.09, 1, 1);
  turret(b, f, L, -0.25, d, 0.075, 1, -1);
  if (styleOf(f) === 'meridon') containers(b, L, -0.14, d);
  else {
    // Torpedorohre / torpedo tubes
    b.add(geo.cbox(0.06, 0.03, 0.08, 0.01), L.hullDark, { p: [0, d + 0.015, -0.15] });
    for (const x of [-0.015, 0.015]) b.cyl(0.009, 0.009, 0.1, 6, mat.dark, [x, d + 0.04, -0.15], [HALF_PI, 0, 0]);
  }
  // Hubschrauberdeck-Ring am Heck / helideck ring at the stern
  b.add(geo.cyl(0.05, 0.05, 0.004, 14), mat.white, { p: [0, d + 0.001, -0.33] });
  b.add(geo.cyl(0.042, 0.042, 0.004, 14), shade(mat.metalLight, 0.85), { p: [0, d + 0.003, -0.33] });
  // Nahbereichsabwehr, Startbehaelter, Radarkuppel, Heckmast / close-in gun, launcher, radar dome, aft mast
  b.cyl(0.018, 0.02, 0.025, 10, mat.white, [0, d + 0.137, 0.025]);
  b.add(geo.hemi(0.018, 10, 3), mat.white, { p: [0, d + 0.15, 0.025] });
  b.cyl(0.004, 0.004, 0.04, 6, mat.dark, [0, d + 0.14, 0.05], [HALF_PI, 0, 0]);
  b.add(geo.cbox(0.06, 0.03, 0.05, 0.008), L.hullDark, { p: [0, d + 0.015, 0.155] });
  for (const x of [-0.015, 0.015]) for (const z of [0.14, 0.17]) b.box(0.02, 0.003, 0.02, mat.ink, [x, d + 0.031, z]);
  b.tube([0, d, -0.1], [0, d + 0.12, -0.1], 0.005, 6, mat.dark);
  b.add(geo.sphere(0.02, 10, 5), mat.white, { p: [0, d + 0.13, -0.1] });
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [0.101, 0.035, 0.18], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [-0.101, 0.035, 0.18], r: [0, -HALF_PI, 0] });
  return b;
}

export function battleship(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  const top = 0.07;
  hull(b, L, 0.88, 0.28, top, 0.24, mat.woodLight, 14);
  // Deckplanken / deck planks
  for (let i = 0; i < 9; i++) b.box(0.003, 0.002, 0.7, shade(mat.woodLight, 0.8), [-0.12 + i * 0.03, top + 0.009, -0.02]);
  const d = top + 0.008;
  // Mehrere Tuerme: zwei vorn (ueberhoehend), einer hinten / multiple turrets: two fore (superfiring), one aft
  turret(b, f, L, 0.222, d, 0.11, 2, 1);
  b.add(geo.cbox(0.1, 0.035, 0.1, 0.02), L.hullDark, { p: [0, d + 0.0175, 0.12] });
  turret(b, f, L, 0.12, d + 0.035, 0.11, 2, 1);
  turret(b, f, L, -0.22, d, 0.11, 2, -1);
  // Aufbau mit Turmmast / superstructure with tower mast
  superBlock(b, f, L, 0, d, 0.0, 0.17, 0.07, 0.2);
  superBlock(b, f, L, 0, d + 0.07, 0.02, 0.12, 0.06, 0.11);
  superBlock(b, f, L, 0, d + 0.13, 0.03, 0.08, 0.05, 0.06);
  bridgeWings(b, L, d + 0.16, 0.05, 0.12);
  mast(b, L, f, 0.03, d + 0.18, 0.15);
  funnel(b, f, L, -0.1, d, 0.15, 0.035);
  if (styleOf(f) === 'meridon') containers(b, L, -0.18, d);
  // Nebengeschuetze / secondary guns
  for (const s of [-1, 1]) for (const z of [-0.04, 0.06]) {
    b.add(geo.cyl(0.02, 0.022, 0.025, 8), L.hull, { p: [s * 0.1, d + 0.0125, z] });
    b.cyl(0.005, 0.005, 0.05, 6, mat.dark, [s * 0.1, d + 0.018, z + 0.035], [HALF_PI, 0, 0]);
  }
  // Flak-Geschuetze + Rettungsboote / anti-aircraft guns + lifeboats
  for (const s of [-1, 1]) for (const z of [-0.12, 0.17]) {
    b.cyl(0.012, 0.014, 0.012, 10, mat.darkMid, [s * 0.11, d + 0.006, z]);
    for (const dx of [-0.004, 0.004]) b.cyl(0.0025, 0.0025, 0.035, 6, mat.dark, [s * 0.11 + dx, d + 0.02, z + 0.015], [0.8, 0, 0]);
    b.box(0.02, 0.012, 0.004, mat.dark, [s * 0.11, d + 0.015, z + 0.012]);
  }
  lifeboats(b, L, 0.115, d + 0.045, -0.1);
  lifeRings(b, 0.093, d + 0.03, [0.03, -0.17]);
  // Heckkran + Katapult / stern crane + catapult
  b.cyl(0.008, 0.01, 0.06, 8, mat.dark, [0.06, d + 0.03, -0.33]);
  b.box(0.008, 0.008, 0.09, mat.dark, [0.06, d + 0.06, -0.3], [0.5, 0, 0]);
  b.box(0.02, 0.008, 0.12, mat.metal, [-0.05, d + 0.004, -0.33]);
  addEmblem(b, f, 0.04, 0.006, L.emblem, { p: [0.141, 0.04, 0.2], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.04, 0.006, L.emblem, { p: [-0.141, 0.04, 0.2], r: [0, -HALF_PI, 0] });
  return b;
}
