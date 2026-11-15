/**
 * Abgestuerztes Mutterschiff der Zyrr (Kampagne m2): ein Wahrzeichen ueber 2x2 Feldern.
 * Crashed Zyrr mothership (campaign m2): a landmark over 2x2 tiles.
 *
 * Aufbau / layout:
 * - Krater mit Brandboden, aufgeworfenem Erdwall und leuchtenden Pfuetzen / crater with scorched ground, a thrown-up earth
 *   rim and glowing puddles
 * - eine riesige violette Untertasse, quer durchgebrochen: die vordere Haelfte (+z, zur Kamera) steckt flach im Boden,
 *   die hintere ist hochgeknickt und zeigt ihr offenes Inneres mit leuchtenden Decks; im Bruch glueht der Kern
 *   / a huge violet saucer broken across: the front half (+z, towards the camera) lies flat in the ground, the rear half
 *   is kinked up and shows its open inside with glowing decks; the core glows in the break
 * - Kommandoturm mit Kuppel auf der hinteren Haelfte, Chitin-Dornen am Rand und Bullaugen in Saeure und Xeno-Violett
 *   (wie Dreibeiner, Gleiter und Portal) / command tower with a dome on the rear half, chitin spines on the rim and
 *   portholes in acid and xeno violet (like tripod, skimmer and portal)
 * - Funken, Rumpfplatten, eine abgebrochene Finne, Kabel und Kristallsplitter / sparks, hull plates, a snapped fin,
 *   cables and crystal shards
 * - mothershipSmoke: zwei Rauchfahnen (eigene Geometrie, schwankt im Wind) / two smoke plumes (own geometry, sways)
 *
 * Massstab: Brettfelder, Ursprung = Mitte der 2x2 Felder auf der Kacheloberseite. Das Brett dreht das Modell um 45 Grad,
 * so dass +z zur Standardkamera schaut. Grundflaeche innerhalb der vier Felder (Radius ~1), Hoehe ohne Rauch etwa 0.9:
 * vorn flach, damit Einheiten davor frei stehen. lite (Qualitaet niedrig): weniger Segmente, Truemmer und Rauchballen.
 * Scale: board tiles, origin = centre of the 2x2 tiles on the tile top. The board turns the model by 45 degrees so +z
 * faces the default camera. Footprint inside the four tiles (radius ~1), height without smoke about 0.9: flat at the
 * front so units in front of it stay clear. lite (quality low): fewer segments, debris and puffs.
 */
import * as THREE from 'three';
import { primitives, semantic } from '../../design/tokens';
import { Builder, col, geo, mix, rng, type V3 } from './kit';
import { look, mat } from './look';

const HALF_PI = Math.PI / 2;
const p = primitives.color;

const C = {
  scorch: mix(p.ink800, p.rock600, 0.25),
  ash: mix(p.ink700, p.rock600, 0.5),
  dirt: mix(p.paper300, p.rock600, 0.6),
  dirtDark: mix(p.rock600, p.ink700, 0.45),
  smoke: col(semantic.smoke),
  smokeDark: mix(semantic.smoke, p.ink700, 0.45),
  smokeLight: mix(semantic.smoke, p.cloud300, 0.4),
};

/** Untertassen-Masse: Halbachsen und Hoehe der Oberschale / saucer dimensions: semi-axes and height of the upper shell */
const RX = 0.98, RZ = 0.86, RY = 0.22;

/** Halbe Untertasse (front: z >= 0, sonst z <= 0) im lokalen Rahmen / half saucer (front: z >= 0, else z <= 0) in the local frame */
function halfSaucer(b: Builder, front: boolean, lite: boolean, R: () => number) {
  const L = look('zyrr');
  const ws = lite ? 12 : 22, hs = lite ? 4 : 7;
  const phi = front ? 0 : Math.PI;
  // Oberschale (violett) und Unterschale (Fremdmetall) / upper shell (violet) and lower shell (alien metal)
  b.add(new THREE.SphereGeometry(1, ws, hs, phi, Math.PI, 0, HALF_PI), L.primary, { s: [RX, RY, RZ] });
  b.add(new THREE.SphereGeometry(1, ws, Math.max(2, hs - 3), phi, Math.PI, HALF_PI, HALF_PI), mat.alienMetal, { s: [RX * 0.98, RY * 0.4, RZ * 0.98] });
  // Deck: zweite, hellere Stufe / deck: second, lighter tier
  b.add(new THREE.SphereGeometry(1, ws, hs, phi, Math.PI, 0, HALF_PI), L.primaryLight, { p: [0, RY * 0.62, 0], s: [RX * 0.58, RY * 0.6, RZ * 0.58] });
  // Wulst am Rand / rim bulge
  b.add(new THREE.TorusGeometry(1, 0.045, lite ? 3 : 4, ws, Math.PI), L.primaryDark, { r: [front ? HALF_PI : -HALF_PI, 0, 0], s: [RX, front ? RZ : RZ, 1] });
  // Bullaugen am Rand / portholes on the rim
  const ports = lite ? 6 : 11;
  for (let i = 0; i < ports; i++) {
    const a = phi + ((i + 0.5) / ports) * Math.PI;
    const x = -Math.cos(a) * RX * 1.03, z = Math.sin(a) * RZ * 1.03;
    b.add(geo.sphere(0.026, 6, 4), i % 3 === 1 ? mat.acid : mat.xenoGlow, { p: [x, 0.01, z] });
  }
  // Chitin-Dornen nach aussen und Plattenfugen / chitin spines pointing out and plate seams
  const spines = lite ? 3 : 5;
  for (let i = 0; i < spines; i++) {
    const a = phi + ((i + 0.5) / spines) * Math.PI;
    const x = -Math.cos(a) * RX * 0.84, z = Math.sin(a) * RZ * 0.84;
    const y = RY * Math.sqrt(Math.max(0, 1 - 0.84 * 0.84)) + 0.01;
    const h = 0.12 + (i % 2) * 0.06 + R() * 0.03;
    // nach aussen geneigt / tilted outwards
    b.add(geo.cone(0.03, h, lite ? 5 : 6), mat.alienSkinDark, { p: [x, y + h * 0.4, z], r: [Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7] });
  }
  const seams = lite ? 4 : 8;
  for (let i = 0; i < seams; i++) {
    const a = phi + ((i + 0.5) / seams) * Math.PI;
    const r = 0.72;
    const y = RY * Math.sqrt(Math.max(0, 1 - r * r)) + 0.006;
    b.box(0.2, 0.012, 0.014, i % 3 === 1 ? mat.xenoGlow : L.primaryDark, [-Math.cos(a) * RX * r, y, Math.sin(a) * RZ * r], [0, a, 0.25 * (front ? 1 : -1)]);
  }
}

/** Funkenbuendel / spark cluster */
function sparks(b: Builder, at: V3, n: number, R: () => number, spread = 0.08) {
  for (let i = 0; i < n; i++) {
    const c = i % 3 === 0 ? mat.white : i % 3 === 1 ? mat.acid : mat.xenoGlow;
    b.add(geo.ico(0.01 + R() * 0.01, 0), c, { p: [at[0] + (R() - 0.5) * spread, at[1] + R() * spread, at[2] + (R() - 0.5) * spread] });
  }
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const a = R() * Math.PI * 2;
    b.box(0.005, 0.005, 0.06 + R() * 0.05, i % 2 ? mat.acid : mat.white, [at[0] + Math.cos(a) * spread * 0.6, at[1] + 0.04 + R() * 0.05, at[2] + Math.sin(a) * spread * 0.6], [R() - 0.5, -a, 0.4]);
  }
}

export function mothership(lite = false): Builder {
  const b = new Builder();
  const R = rng(2202);
  const L = look('zyrr');

  // ---- Krater / crater ----
  const ring = lite ? 14 : 24;
  b.add(geo.cyl(0.99, 0.99, 0.008, ring), C.scorch, { p: [0, 0.004, 0] });
  b.add(geo.cyl(0.74, 0.74, 0.006, ring), C.ash, { p: [0, 0.01, 0] });
  // leuchtende Pfuetzen aus dem Kern, vorn sichtbar / glowing puddles from the core, visible at the front
  b.add(geo.cyl(0.12, 0.12, 0.006, 12), mat.acid, { p: [0.42, 0.014, 0.74], s: [1.5, 1, 0.7] });
  b.add(geo.cyl(0.09, 0.09, 0.006, 10), mat.xenoGlow, { p: [-0.5, 0.014, 0.66], s: [1.3, 1, 0.8] });
  const lumps = lite ? 16 : 30;
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + R() * 0.15;
    const r = 0.9 + R() * 0.07;
    const s = 0.05 + R() * 0.05;
    b.add(geo.dodeca(s), i % 3 ? C.dirt : C.dirtDark, { p: [Math.cos(a) * r, s * 0.35, Math.sin(a) * r], r: [R() * 3, R() * 3, R() * 3], s: [1.3, 0.55, 1] });
  }

  // ---- Untertasse, quer gebrochen / saucer, broken across ----
  // vorn: flach im Boden, leicht nach vorn gesunken / front: flat in the ground, sunk slightly forwards
  b.group({ p: [0, 0.05, 0.17], r: [0.16, 0, 0.07] }, () => halfSaucer(b, true, lite, R));
  // hinten: hochgeknickt, offenes Inneres zur Kamera / rear: kinked up, open inside towards the camera
  const rear = { p: [0, 0.2, -0.17] as V3, r: [-0.4, 0.07, -0.06] as V3 };
  b.group(rear, () => {
    halfSaucer(b, false, lite, R);
    // offene Bruchflaeche: dunkles Inneres mit leuchtenden Decks / open break face: dark inside with glowing decks
    b.add(new THREE.CircleGeometry(1, lite ? 10 : 18, 0, Math.PI), mat.dark, { p: [0, -0.005, 0.002], s: [RX * 0.97, RY * 0.95, 1] });
    for (const [y, w] of [[0.05, 0.8], [0.12, 0.6]] as [number, number][]) b.box(w * RX * 1.6, 0.014, 0.012, mat.xenoGlow, [0, y, 0.01]);
    for (const x of [-0.5, -0.15, 0.2, 0.55]) b.box(0.012, 0.16, 0.012, mat.alienMetalLight, [x, 0.06, 0.012]);
    // Kommandoturm mit Kuppel und Fensterband / command tower with a dome and a window band
    b.cyl(0.2, 0.26, 0.24, lite ? 10 : 16, L.primaryDark, [0.12, RY + 0.1, -0.34]);
    b.cyl(0.205, 0.205, 0.04, lite ? 10 : 16, mat.xenoGlow, [0.12, RY + 0.16, -0.34]);
    b.add(geo.hemi(0.19, lite ? 10 : 16, lite ? 4 : 6), mix(mat.glassDark, mat.xenoGlow, 0.35), { p: [0.12, RY + 0.22, -0.34] });
    b.add(geo.torus(0.19, 0.016, 3, lite ? 10 : 16), mat.alienMetalLight, { p: [0.12, RY + 0.22, -0.34], r: [HALF_PI, 0, 0] });
    // Sensormast mit Saeurespitze, geknickt / kinked sensor mast with an acid tip
    b.tube([0.12, RY + 0.4, -0.34], [0.2, RY + 0.58, -0.4], 0.014, 5, mat.alienMetalLight, 0.01);
    b.tube([0.2, RY + 0.58, -0.4], [0.36, RY + 0.62, -0.36], 0.01, 5, mat.alienMetalLight, 0.008);
    b.add(geo.ico(0.026, 0), mat.acid, { p: [0.36, RY + 0.62, -0.36] });
    // Triebwerke am hinteren Rand / engines on the rear rim
    for (const x of [-0.45, 0, 0.45]) {
      b.cyl(0.08, 0.1, 0.12, lite ? 8 : 12, mat.alienMetal, [x, 0.0, -RZ * 0.92], [HALF_PI, 0, 0]);
      b.add(geo.torus(0.09, 0.016, 3, lite ? 8 : 12), mat.acid, { p: [x, 0.0, -RZ * 0.98] });
    }
  });

  // Bruch: leuchtender Kern, gezackte Raender, Streben / the break: glowing core, jagged edges, struts
  b.add(geo.sphere(0.2, lite ? 10 : 16, lite ? 6 : 10), mat.xenoGlow, { p: [0.0, 0.14, 0.0], s: [4.4, 0.9, 0.8] });
  b.add(geo.sphere(0.12, lite ? 8 : 12, lite ? 5 : 8), mat.white, { p: [0.08, 0.2, 0.04], s: [3.6, 0.8, 0.6] });
  // Leuchtsplitter, die aus dem Bruch ragen / glowing shards sticking out of the break
  const shards = lite ? 5 : 9;
  for (let i = 0; i < shards; i++) {
    const x = ((i + 0.5) / shards * 2 - 1) * RX * 0.8;
    const h = 0.14 + R() * 0.16;
    b.add(geo.cone(0.035 + R() * 0.02, h, 4), i % 3 === 0 ? mat.acid : mat.xenoGlow, { p: [x, 0.16 + h * 0.4, (R() - 0.5) * 0.08], r: [(R() - 0.5) * 0.7, R() * 3, (R() - 0.5) * 0.7] });
  }
  // gezackte Bruchkante der vorderen Haelfte / jagged break edge of the front half
  const teeth = lite ? 7 : 13;
  for (let i = 0; i < teeth; i++) {
    const x = ((i + 0.5) / teeth * 2 - 1) * RX * 0.9;
    const y = 0.06 + Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)) * RY * 0.85;
    const h = 0.06 + R() * 0.08;
    b.add(geo.cone(0.035, h, 4), i % 2 ? L.primaryDark : L.primary, { p: [x, y, 0.15], r: [-HALF_PI * 0.7 + (R() - 0.5) * 0.5, R() * 3, (R() - 0.5) * 0.5] });
  }
  for (const [x, y] of [[-0.45, 0.2], [0.05, 0.26], [0.48, 0.2]] as [number, number][]) {
    b.tube([x, y, 0.16], [x + 0.06, y + 0.12, -0.12], 0.014, 5, mat.alienMetalLight, 0.01);
  }
  sparks(b, [-0.2, 0.32, 0.04], lite ? 4 : 9, R);
  sparks(b, [0.42, 0.28, 0.02], lite ? 3 : 7, R);
  if (!lite) sparks(b, [0.12, 0.62, -0.28], 5, R, 0.06);

  // ---- Truemmer / debris ----
  const plates = lite ? 7 : 14;
  for (let i = 0; i < plates; i++) {
    const a = R() * Math.PI * 2;
    const r = 0.7 + R() * 0.26;
    const up = i % 4 === 0;
    b.add(geo.cbox(0.08 + R() * 0.08, 0.014, 0.05 + R() * 0.05, 0.012), i % 3 ? L.primary : mat.alienMetal, {
      p: [Math.cos(a) * r, up ? 0.05 : 0.02, Math.sin(a) * r], r: up ? [0.9 + R() * 0.4, R() * 3, 0.2] : [(R() - 0.5) * 0.6, R() * 3, (R() - 0.5) * 0.6],
    });
  }
  // abgebrochene Finne im Boden, vorn rechts / snapped fin stuck in the ground, front right
  b.add(geo.taper(0.2, 0.03, 0.07, 0.02, 0.24), L.primaryDark, { p: [0.72, 0.1, 0.5], r: [0.5, 0.6, -0.4] });
  b.box(0.11, 0.01, 0.034, mat.xenoGlow, [0.72, 0.1, 0.52], [0.5, 0.6, -0.4]);
  // Kabel mit Saeuretropfen / cables with acid drops
  for (let i = 0; i < (lite ? 2 : 4); i++) {
    const x0 = -0.5 + i * 0.32 + R() * 0.1;
    b.tube([x0, 0.12, 0.62], [x0 + 0.06, 0.06, 0.76], 0.008, 4, mat.dark, 0.006);
    b.add(geo.ico(0.013, 0), mat.acid, { p: [x0 + 0.06, 0.06, 0.77] });
  }
  // Kristallsplitter aus dem Kern / crystal shards from the core
  for (let i = 0; i < (lite ? 3 : 6); i++) {
    const x = -0.7 + R() * 1.4, z = 0.72 + R() * 0.12;
    b.add(geo.cone(0.025, 0.09 + R() * 0.05, 4), i % 2 ? mat.acid : mat.xenoGlow, { p: [x, 0.04, z], r: [(R() - 0.5) * 0.8, R() * 3, (R() - 0.5) * 0.8] });
  }
  return b;
}

/** Zwei Rauchfahnen: aus dem Bruch und vom hinteren Triebwerk / two smoke plumes: from the break and the rear engine */
export function mothershipSmoke(lite = false): Builder {
  const b = new Builder();
  const R = rng(2203);
  const plume = (x: number, y: number, z: number, n: number, r0: number, drift: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const r = r0 * (0.8 + t * 1.3);
      const c = i === 0 ? C.smokeDark : i % 3 === 1 ? C.smoke : C.smokeLight;
      b.add(geo.ico(r, 1), c, { p: [x - t * drift + (R() - 0.5) * 0.03, y + t * 0.75, z - t * 0.12 + (R() - 0.5) * 0.04], s: [1, 0.8, 1] });
    }
  };
  // dichte Saeulen aus ueberlappenden Ballen / dense columns of overlapping puffs
  plume(-0.35, 0.3, 0.0, lite ? 4 : 7, 0.09, 0.2);
  plume(0.6, 0.3, -0.05, lite ? 3 : 5, 0.07, 0.14);
  return b;
}
