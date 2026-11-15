/**
 * Abgestuerztes Mutterschiff der Zyrr (Kampagne m2): ein Wahrzeichen ueber 2x2 Feldern.
 * Crashed Zyrr mothership (campaign m2): a landmark over 2x2 tiles.
 *
 * Aufbau / layout:
 * - Krater mit Brandboden, aufgeworfenem Erdwall und einem Erdhaufen vor dem Bug / crater with scorched ground, a thrown-up
 *   earth rim and a mound in front of the bow
 * - violetter Rumpf, in der Mitte durchgebrochen: Bug mit Kommandokuppel taucht in den Boden, Heck mit Triebwerken ist
 *   verdreht; im Bruch leuchtet der Kern / violet hull broken in the middle: the bow with the command dome digs into the
 *   ground, the stern with the engines is twisted; the core glows in the break
 * - Chitin-Dornen auf dem Ruecken (wie Portal und Graue), Leuchtfugen, Funken, Bullaugen in Saeure und Xeno-Violett
 *   / chitin spines on the back (like portal and greys), glowing seams, sparks, portholes in acid and xeno violet
 * - Truemmer: Rumpfplatten, eine abgebrochene Finne, Kabel und Kristallsplitter / debris: hull plates, a snapped fin,
 *   cables and crystal shards
 * - mothershipSmoke: zwei Rauchfahnen (eigene Geometrie, schwankt im Wind) / two smoke plumes (own geometry, sways)
 *
 * Massstab: Brettfelder, Ursprung = Mitte der 2x2 Felder auf der Kacheloberseite, Laengsachse x; das Brett dreht das
 * Modell um 45 Grad, so dass die Breitseite (+z) zur Standardkamera schaut. Grundflaeche: |x| + |z| <= 1.4 (innerhalb
 * der vier Felder), Hoehe ohne Rauch etwa 0.8 Felder, damit Einheiten dahinter sichtbar bleiben.
 * Scale: board tiles, origin = centre of the 2x2 tiles on the tile top, long axis x; the board turns the model by 45
 * degrees so the broadside (+z) faces the default camera. Footprint: |x| + |z| <= 1.4 (inside the four tiles), height
 * without smoke about 0.8 tiles so units behind it stay visible.
 *
 * lite (Qualitaet niedrig): weniger Segmente, Truemmer und Rauchballen / lite (quality low): fewer segments, debris and puffs.
 */
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

/** Ellipsoid-Rumpf: Hoehe der Oberflaeche ueber der Mitte / ellipsoid hull: surface height above the centre */
const surf = (rx: number, ry: number, rz: number, x: number, z: number) => ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (z / rz) ** 2));

interface Section { c: V3; r: V3; rot: V3 }

/** Rumpfteil mit Panzerplatten, Fugen, Bullaugen und Dornen / hull section with armour plates, seams, portholes and spines */
function hullSection(b: Builder, sec: Section, lite: boolean, R: () => number, bow: boolean) {
  const L = look('zyrr');
  const [rx, ry, rz] = sec.r;
  const ws = lite ? 14 : 24, hs = lite ? 7 : 12;
  b.group({ p: sec.c, r: sec.rot }, () => {
    // Oberschale violett, Unterschale dunkles Fremdmetall / upper shell violet, lower shell dark alien metal
    b.add(geo.hemi(1, ws, Math.ceil(hs / 2)), L.primary, { s: [rx, ry, rz] });
    b.add(geo.hemi(1, ws, Math.ceil(hs / 3)), mat.alienMetal, { r: [Math.PI, 0, 0], s: [rx * 0.97, ry * 0.45, rz * 0.97] });
    // Wulst am Aequator mit Bullaugen / equator bulge with portholes
    b.add(geo.torus(1, 0.04, lite ? 3 : 4, ws), L.primaryDark, { r: [HALF_PI, 0, 0], s: [rx, rz, 1] });
    const ports = lite ? 8 : 14;
    for (let i = 0; i < ports; i++) {
      const a = (i / ports) * Math.PI * 2;
      const x = Math.cos(a) * rx * 1.01, z = Math.sin(a) * rz * 1.01;
      // nur die heile Seite leuchtet, am Bruch ist alles dunkel / only the intact side glows, everything is dark at the break
      const atBreak = bow ? x < -rx * 0.6 : x > rx * 0.6;
      b.add(geo.sphere(0.022, 6, 4), atBreak ? mat.dark : i % 3 ? mat.xenoGlow : mat.acid, { p: [x, 0.012, z] });
    }
    // zweite, kleinere Schale (Deck) / second, smaller shell (deck)
    b.add(geo.hemi(1, ws, Math.ceil(hs / 2)), L.primaryLight, { p: [0, ry * 0.55, 0], s: [rx * 0.62, ry * 0.55, rz * 0.62] });
    // Plattenfugen (dunkel) und Leuchtfugen (Xeno-Violett, gluehen im Dunkeln) / plate seams (dark) and glowing seams (xeno violet)
    const seams = lite ? 5 : 9;
    for (let i = 0; i < seams; i++) {
      const t = (i + 0.5) / seams;
      const x = (t * 2 - 1) * rx * 0.82;
      const z = rz * 0.55;
      const y = surf(rx, ry, rz, x, z);
      const lit = i % 3 === 1;
      b.box(0.012, 0.012, lit ? 0.16 : 0.12, lit ? mat.xenoGlow : L.primaryDark, [x, y + 0.004, z * 0.62], [-0.55, 0, 0]);
      b.box(0.012, 0.012, 0.1, L.primaryDark, [x, y + 0.004, -z * 0.62], [0.55, 0, 0]);
    }
    // Chitin-Dornen entlang des Rueckens / chitin spines along the back
    const spines = lite ? 3 : 5;
    for (let i = 0; i < spines; i++) {
      const x = ((i + 0.5) / spines * 2 - 1) * rx * 0.62;
      const y = surf(rx, ry, rz, x, 0) + ry * 0.12;
      const h = 0.1 + (i % 2) * 0.05 + R() * 0.03;
      b.add(geo.cone(0.028, h, lite ? 5 : 6), mat.alienSkinDark, { p: [x, y + h / 2 - 0.01, 0], r: [0, 0, (bow ? 0.35 : -0.35)] });
    }
  });
}

/** Funkenbuendel / spark cluster */
function sparks(b: Builder, at: V3, n: number, R: () => number, spread = 0.07) {
  for (let i = 0; i < n; i++) {
    const c = i % 3 === 0 ? mat.white : i % 3 === 1 ? mat.acid : mat.xenoGlow;
    b.add(geo.ico(0.008 + R() * 0.008, 0), c, { p: [at[0] + (R() - 0.5) * spread, at[1] + R() * spread, at[2] + (R() - 0.5) * spread] });
  }
  // Funkenstrahl: duenne Striche nach aussen / spark spray: thin streaks outward
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const a = R() * Math.PI * 2;
    b.box(0.004, 0.004, 0.05 + R() * 0.04, i % 2 ? mat.acid : mat.white, [at[0] + Math.cos(a) * spread * 0.6, at[1] + 0.03 + R() * 0.04, at[2] + Math.sin(a) * spread * 0.6], [R() - 0.5, -a, 0.3]);
  }
}

export function mothership(lite = false): Builder {
  const b = new Builder();
  const R = rng(2202);
  const L = look('zyrr');

  // ---- Krater / crater ----
  const ring = lite ? 14 : 22;
  b.add(geo.cyl(0.98, 0.98, 0.008, ring), C.scorch, { p: [0, 0.004, 0], s: [1, 1, 1] });
  b.add(geo.cyl(0.72, 0.72, 0.006, ring), C.ash, { p: [0, 0.01, 0] });
  // leuchtende Pfuetzen aus dem Kern / glowing pools from the core
  b.add(geo.cyl(0.16, 0.16, 0.006, 12), mat.acid, { p: [0.05, 0.014, 0.42], s: [1.4, 1, 0.8] });
  b.add(geo.cyl(0.1, 0.1, 0.006, 10), mat.xenoGlow, { p: [-0.35, 0.014, 0.38], s: [1.2, 1, 0.9] });
  // Erdwall rund um den Krater (innerhalb der Raute |x| + |z| <= 1.4) / earth rim around the crater (inside the diamond)
  const lumps = lite ? 16 : 30;
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + R() * 0.15;
    const ex = Math.cos(a), ez = Math.sin(a);
    const r = 0.88 + R() * 0.07;
    const s = 0.06 + R() * 0.05;
    b.add(geo.dodeca(s), i % 3 ? C.dirt : C.dirtDark, { p: [ex * r, s * 0.35, ez * r], r: [R() * 3, R() * 3, R() * 3], s: [1.3, 0.55, 1] });
  }
  // Erdhaufen vor dem Bug (+x), vom Aufprall zusammengeschoben / mound in front of the bow (+x), pushed together by the impact
  for (let i = 0; i < (lite ? 4 : 7); i++) {
    const s = 0.08 + R() * 0.07;
    b.add(geo.dodeca(s), i % 2 ? C.dirt : C.dirtDark, { p: [1.0 + R() * 0.12, s * 0.4, (R() - 0.5) * 0.35], r: [R() * 3, R() * 3, R() * 3], s: [1, 0.7, 1.2] });
  }

  // ---- Rumpf, in zwei Teile gebrochen / hull, broken in two ----
  const bow: Section = { c: [0.5, 0.1, 0.02], r: [0.62, 0.36, 0.5], rot: [0.06, 0.08, -0.16] };
  const stern: Section = { c: [-0.6, 0.15, -0.03], r: [0.56, 0.38, 0.52], rot: [-0.08, -0.14, 0.12] };
  hullSection(b, bow, lite, R, true);
  hullSection(b, stern, lite, R, false);

  // Kommandokuppel am Bug, gesprungenes Glas / command dome at the bow, cracked glass
  b.group({ p: bow.c, r: bow.rot }, () => {
    b.add(geo.hemi(0.17, lite ? 10 : 16, lite ? 4 : 6), mix(mat.glassDark, mat.xenoGlow, 0.35), { p: [0.18, surf(0.62, 0.36, 0.5, 0.18, 0) * 0.98 + 0.02, 0] });
    b.add(geo.torus(0.17, 0.016, 3, lite ? 10 : 16), mat.alienMetalLight, { p: [0.18, surf(0.62, 0.36, 0.5, 0.18, 0) * 0.98 + 0.02, 0], r: [HALF_PI, 0, 0] });
    if (!lite) for (let i = 0; i < 4; i++) b.box(0.004, 0.004, 0.08, mat.ink, [0.18 + (R() - 0.5) * 0.1, 0.52 + R() * 0.03, (R() - 0.5) * 0.1], [0.3, R() * 3, 0]);
    // Sensormast mit Saeurespitze / sensor mast with an acid tip
    b.tube([0.42, 0.22, 0.0], [0.62, 0.42, -0.04], 0.012, 5, mat.alienMetalLight, 0.008);
    b.add(geo.ico(0.022, 0), mat.acid, { p: [0.62, 0.43, -0.04] });
  });

  // Bruchstelle: leuchtender Kern, gezackte Raender, Streben / the break: glowing core, jagged edges, struts
  const gapX = -0.06;
  b.add(geo.sphere(0.24, lite ? 10 : 16, lite ? 6 : 10), mat.xenoGlow, { p: [gapX, 0.18, 0], s: [0.55, 1, 1.45] });
  b.add(geo.sphere(0.14, lite ? 8 : 12, lite ? 5 : 8), mat.white, { p: [gapX + 0.02, 0.2, 0.06], s: [0.5, 1, 1.2] });
  const teeth = lite ? 6 : 11;
  for (let i = 0; i < teeth; i++) {
    const t = i / (teeth - 1);
    const z = (t * 2 - 1) * 0.4;
    const y = 0.08 + Math.sqrt(Math.max(0, 1 - (z / 0.48) ** 2)) * 0.3;
    for (const side of [-1, 1]) {
      const h = 0.05 + R() * 0.07;
      b.add(geo.cone(0.03, h, 4), side > 0 ? L.primaryDark : L.primary, { p: [gapX + side * 0.11, y, z], r: [R() - 0.5, R() * 3, side * (HALF_PI + (R() - 0.5) * 0.6)] });
    }
  }
  // gerissene Streben ueber dem Spalt / torn struts across the gap
  for (const [z, y] of [[-0.22, 0.32], [0.1, 0.4], [0.3, 0.26]] as [number, number][]) {
    b.tube([gapX - 0.16, y, z], [gapX + 0.02, y + 0.06, z + 0.03], 0.012, 5, mat.alienMetalLight, 0.008);
    b.tube([gapX + 0.15, y - 0.02, z - 0.02], [gapX + 0.05, y + 0.07, z], 0.01, 5, mat.alienMetal, 0.006);
  }
  // Funken an Bruch und Fugen / sparks at the break and the seams
  sparks(b, [gapX, 0.42, 0.18], lite ? 4 : 8, R);
  sparks(b, [gapX + 0.05, 0.3, -0.3], lite ? 3 : 6, R);
  if (!lite) sparks(b, [0.62, 0.32, 0.32], 5, R, 0.05);

  // Triebwerke am Heck (-x), schraeg verdreht / engines at the stern (-x), twisted askew
  b.group({ p: stern.c, r: stern.rot }, () => {
    for (const [z, y, r] of [[-0.2, 0.06, 0.09], [0.0, 0.14, 0.11], [0.2, 0.06, 0.09]] as [number, number, number][]) {
      b.cyl(r, r * 1.2, 0.18, lite ? 8 : 12, mat.alienMetal, [-0.55, y, z], [0, 0, HALF_PI]);
      b.add(geo.torus(r * 1.1, 0.018, 3, lite ? 8 : 12), mat.acid, { p: [-0.65, y, z], r: [0, HALF_PI, 0] });
      b.cyl(r * 0.7, r * 0.7, 0.01, lite ? 8 : 12, z === 0 ? mat.xenoGlow : mat.dark, [-0.655, y, z], [0, 0, HALF_PI]);
    }
    // aufragende, geknickte Heckfinne / upright, kinked tail fin
    b.add(geo.taper(0.2, 0.03, 0.08, 0.02, 0.3), L.primaryDark, { p: [-0.25, 0.48, 0.0], r: [0.25, 0, 0.35] });
    b.box(0.13, 0.012, 0.034, mat.xenoGlow, [-0.25, 0.42, 0.012], [0.25, 0, 0.35]);
  });

  // ---- Truemmer / debris ----
  const plates = lite ? 7 : 14;
  for (let i = 0; i < plates; i++) {
    const a = R() * Math.PI * 2;
    const r = 0.55 + R() * 0.38;
    const x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r * 0.6;
    if (Math.abs(x) + Math.abs(z) > 1.32) continue;
    const up = i % 4 === 0;
    b.add(geo.cbox(0.08 + R() * 0.08, 0.014, 0.05 + R() * 0.05, 0.012), i % 3 ? L.primary : mat.alienMetal, {
      p: [x, up ? 0.05 : 0.02, z], r: up ? [0.9 + R() * 0.4, R() * 3, 0.2] : [(R() - 0.5) * 0.6, R() * 3, (R() - 0.5) * 0.6],
    });
  }
  // abgebrochene Finne im Boden, vorn rechts / snapped fin stuck in the ground, front right
  b.add(geo.taper(0.18, 0.03, 0.06, 0.02, 0.22), L.primaryDark, { p: [0.45, 0.09, 0.62], r: [0.5, 0.6, -0.4] });
  b.box(0.1, 0.01, 0.034, mat.xenoGlow, [0.45, 0.09, 0.64], [0.5, 0.6, -0.4]);
  // Kabel mit Saeuretropfen / cables with acid drops
  const cables = lite ? 2 : 4;
  for (let i = 0; i < cables; i++) {
    const z = 0.3 + R() * 0.15, x0 = -0.2 + R() * 0.3;
    b.tube([x0, 0.16, z], [x0 + 0.12, 0.08, z + 0.12], 0.008, 4, mat.dark, 0.006);
    b.tube([x0 + 0.12, 0.08, z + 0.12], [x0 + 0.2, 0.01, z + 0.2], 0.006, 4, mat.dark, 0.005);
    b.add(geo.ico(0.012, 0), mat.acid, { p: [x0 + 0.2, 0.012, z + 0.2] });
  }
  // Kristallsplitter aus dem Kern / crystal shards from the core
  for (let i = 0; i < (lite ? 3 : 6); i++) {
    const a = R() * Math.PI - HALF_PI * 0.2;
    const x = gapX + Math.cos(a) * (0.35 + R() * 0.25), z = 0.45 + Math.sin(a) * 0.12;
    b.add(geo.cone(0.025, 0.09 + R() * 0.05, 4), i % 2 ? mat.acid : mat.xenoGlow, { p: [x, 0.04, z], r: [(R() - 0.5) * 0.8, R() * 3, (R() - 0.5) * 0.8] });
  }
  return b;
}

/** Zwei Rauchfahnen: aus dem Bruch und aus dem mittleren Triebwerk / two smoke plumes: from the break and the middle engine */
export function mothershipSmoke(lite = false): Builder {
  const b = new Builder();
  const R = rng(2203);
  const plume = (x: number, y: number, z: number, n: number, r0: number, drift: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const r = r0 * (0.8 + t * 0.9);
      const c = i === 0 ? C.smokeDark : i % 2 ? C.smoke : C.smokeLight;
      b.add(geo.ico(r, lite ? 0 : 1), c, { p: [x - t * drift + (R() - 0.5) * 0.03, y + t * 0.55, z + (R() - 0.5) * 0.04], s: [1, 0.85, 1] });
    }
  };
  plume(-0.06, 0.48, 0.02, lite ? 3 : 5, 0.07, 0.18);
  plume(-1.0, 0.36, -0.04, lite ? 2 : 4, 0.05, 0.12);
  return b;
}
