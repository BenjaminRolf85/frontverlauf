/**
 * Schiffe: Landungsboot, U-Boot, Zerstoerer, Kriegsschiff. Wasserlinie bei y=0, Bug in +z.
 * Ships: landing boat, submarine, destroyer, battleship. Waterline at y=0, bow towards +z.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, capsule, fine, geo, mix, shade, type V3 } from './kit';
import { bar, bitts, boltRing, crate, grille, ladder, porthole, railing, raftCanister, roundHatch, ropeCoil, searchlight, whip } from './detailFleet';
import { look, mat, styleOf, type Look } from './look';
import { soldier, standPose } from './soldiers';
import { TECH, techDot } from './velkarTech';

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

/**
 * Rumpf mit Wasserpass, Deck, Bullaugen, Reling, Ankern und Bugwelle / hull with boot-topping, deck, portholes, rail, anchors, bow wave.
 * rich (nur hohe Qualitaet, Zerstoerer und Schlachtschiff): Plattenfugen, Kennnummer, Reling um den Bug, Doppelpoller,
 * Ankerspill mit Kette, echte Anker, Gosch- und Flaggenstock, Rettungsinseln, Kielwasser.
 * rich (high quality only, destroyer and battleship): plate seams, hull number, rail around the bow, double bitts,
 * windlass with chain, proper anchors, jack and ensign staffs, life raft canisters, wake.
 */
export function hull(b: Builder, L: Look, len: number, beam: number, top: number, bow: number, deck: THREE.Color, portholes = 10, rich = false) {
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
    if (!rich) {
      b.box(0.004, 0.004, z1 - z0 + 0.04, mat.white, [s * (w * 0.93), top + 0.02, (z0 + z1) / 2]);
      for (let i = 0; i <= 12; i++) b.box(0.004, 0.02, 0.004, mat.white, [s * (w * 0.93), top + 0.01, z0 + (i / 12) * (z1 - z0)]);
      b.box(0.004, 0.004, z1 - z0 + 0.04, mat.white, [s * (w * 0.93), top + 0.011, (z0 + z1) / 2]);
    }
    // zweite Portlochreihe + Scheuerleiste / second porthole row + rubbing strake
    for (let i = 0; i < portholes; i++) b.box(0.004, 0.008, 0.008, mat.window, [s * (w + 0.002), top * 0.75, z0 + ((i + 0.5) / portholes) * (z1 - z0)]);
    b.box(0.006, 0.006, z1 - z0, shade(L.hull, 0.8), [s * (w + 0.002), top * 0.25, (z0 + z1) / 2]);
    // Ankerkette / anchor chain
    if (!rich) b.box(0.006, 0.004, 0.08, mat.dark, [s * 0.02, top + 0.009, h - bow * 0.6], [0, s * 0.3, 0]);
    // Anker / anchor
    if (!rich) b.box(0.006, 0.022, 0.016, mat.dark, [s * (w * 0.62 + 0.004), top * 0.6, h - bow * 0.45], [0, s * 0.6, 0]);
  }
  // Luken + Luefter auf dem Vordeck / hatches + vents on the foredeck
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.026, 0.008, 0.03, 0.006), shade(deck, 0.8), { p: [s * w * 0.4, top + 0.012, h - bow - 0.03] });
    b.cyl(0.007, 0.007, 0.022, 6, mat.white, [s * w * 0.55, top + 0.018, -h + 0.08]);
    b.add(geo.hemi(0.009, 6, 2), mat.white, { p: [s * w * 0.55, top + 0.029, -h + 0.08] });
    // Poller / bollards
    for (const z of [h - bow - 0.06, -h + 0.04]) {
      if (rich) bitts(b, [s * w * 0.72, top + 0.008, z], 0, 0.004, mat.dark, shade(deck, 0.7));
      else b.cyl(0.006, 0.007, 0.012, 6, mat.dark, [s * w * 0.75, top + 0.014, z]);
    }
  }
  // Bugwelle / bow wave
  b.add(geo.prismXZ([[-w * 0.9, h - bow * 0.9], [0, h + 0.008], [w * 0.9, h - bow * 0.9], [w * 0.5, h - bow * 0.5], [-w * 0.5, h - bow * 0.5]], 0.006), mat.white, { p: [0, 0.0, 0] });
  if (rich) hullRich(b, L, len, beam, top, bow, deck);
}

/** Zusatzteile des Rumpfs bei hoher Qualitaet (siehe hull) / extra hull parts on high quality (see hull) */
function hullRich(b: Builder, L: Look, len: number, beam: number, top: number, bow: number, deck: THREE.Color) {
  const h = len / 2, w = beam / 2;
  const z0 = -h + 0.07, z1 = h - bow - 0.01;
  const seam = shade(L.hull, 0.78);
  for (const s of [-1, 1]) {
    // Plattenfugen: Laengsnaht unter den Bullaugen, Quernaehte / plate seams: a long seam below the portholes, butt seams
    b.box(0.003, 0.003, z1 - z0 + 0.04, seam, [s * (w + 0.0012), top * 0.36, (z0 + z1) / 2 + 0.01]);
    const n = Math.round((z1 - z0) / 0.075);
    for (let i = 0; i <= n; i++) b.box(0.003, top * 0.55, 0.003, seam, [s * (w + 0.0012), top * 0.56, z0 - 0.01 + (i / n) * (z1 - z0 + 0.03)]);
    // Kennnummer am Bug: weisse Ziffernfelder mit Fugen / hull number at the bow: white digit panels with gaps
    for (const dz of [0, 0.022]) {
      const z = h - bow - 0.05 - dz;
      b.box(0.003, 0.026, 0.016, mat.white, [s * (w + 0.0015), top * 0.55, z]);
      b.box(0.004, 0.012, 0.006, L.hull, [s * (w + 0.0018), top * 0.55 + (dz ? 0.004 : -0.004), z + (dz ? -0.002 : 0.003)]);
    }
    // Anker in der Klusse: Schaft, Arme, Ring / anchor in the hawse: shank, arms, ring
    const ax = s * (w * 0.66 + 0.006), az = h - bow * 0.5;
    b.group({ p: [ax, top * 0.62, az], r: [0, s * 0.55, 0] }, () => {
      b.cyl(0.011, 0.011, 0.005, 8, shade(L.hull, 0.65), [0, 0.012, 0], [0, 0, HALF_PI]);
      b.box(0.004, 0.026, 0.005, mat.dark, [s * 0.002, -0.002, 0]);
      b.box(0.004, 0.005, 0.022, mat.dark, [s * 0.002, -0.014, 0]);
      for (const k of [-1, 1]) b.box(0.004, 0.01, 0.006, mat.dark, [s * 0.002, -0.01, k * 0.011], [k * 0.5, 0, 0]);
    });
    // Ankerkette vom Spill zur Klusse (Glieder) / anchor chain from the windlass to the hawse (links)
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      b.box(0.004, 0.003, 0.007, mat.dark, [s * (0.014 + t * (w * 0.6 - 0.014)), top + 0.01, h - bow - 0.035 + t * (bow * 0.5 + 0.035)], [i % 2 ? HALF_PI : 0, -s * 0.5, 0]);
    }
    // Rettungsinseln in Behaeltern / life raft canisters
    for (const z of [z0 + 0.02, z0 + 0.06]) raftCanister(b, [s * (w * 0.74), top + 0.016, z], 0.0075, 0.032, mat.white, L.trim, HALF_PI);
  }
  // Ankerspill / windlass
  b.cyl(0.014, 0.016, 0.01, 10, mat.darkMid, [0, top + 0.013, h - bow - 0.035]);
  b.cyl(0.008, 0.008, 0.05, 8, mat.dark, [0, top + 0.022, h - bow - 0.035], [0, 0, HALF_PI]);
  for (const s of [-1, 1]) b.cyl(0.011, 0.011, 0.006, 10, mat.darkMid, [s * 0.02, top + 0.022, h - bow - 0.035], [0, 0, HALF_PI]);
  // Reling rund um den Bug, offen am Heck / rail around the bow, open at the stern
  const rp = outline(len, beam, bow, 0.92).filter(([, z]) => z > -h * 0.92 + 0.03);
  // Umriss liegt im Uhrzeigersinn ab Heck rechts vor; Reihenfolge fuer einen durchgehenden Pfad / outline order, made into one continuous path
  const path: V3[] = rp.map(([x, z]) => [x, top + 0.008, z] as V3);
  railing(b, path, 0.022, 0.05, mat.white, 0.003);
  // Goschstock am Bug und Flaggenstock am Heck mit Fraktionsflagge / jack staff at the bow and ensign staff at the stern with the faction flag
  b.tube([0, top + 0.008, h - 0.012], [0, top + 0.07, h - 0.008], 0.0018, 3, mat.dark);
  b.add(geo.box(0.002, 0.016, 0.022), L.secondary, { p: [0, top + 0.06, h - 0.022] });
  // Flagge weht quer (bleibt innerhalb der Kachel) / the flag flies sideways (stays inside the tile)
  b.tube([0, top + 0.008, -h + 0.016], [0, top + 0.09, -h + 0.012], 0.002, 3, mat.dark);
  b.add(geo.box(0.036, 0.024, 0.002), L.primary, { p: [0.019, top + 0.075, -h + 0.013], r: [0, 0, -0.15] });
  b.add(geo.box(0.036, 0.008, 0.0024), L.secondary, { p: [0.019, top + 0.072, -h + 0.013], r: [0, 0, -0.15] });
  // Luefterpilze und Bereitschaftskisten an Deck / mushroom vents and ready-use lockers on deck
  for (const s of [-1, 1]) {
    for (const z of [h - bow - 0.08]) {
      b.cyl(0.004, 0.004, 0.014, 6, mat.white, [s * w * 0.3, top + 0.015, z]);
      b.cyl(0.008, 0.008, 0.004, 8, mat.white, [s * w * 0.3, top + 0.023, z]);
    }
    b.add(geo.cbox(0.018, 0.014, 0.03, 0.003), shade(deck, 0.75), { p: [s * w * 0.62, top + 0.015, z1 - 0.07] });
  }
}

/**
 * Aufbau-Block im Fraktionsstil mit Bruecke / superstructure block in faction style with bridge windows.
 * rich (nur hohe Qualitaet): Bullaugen und Schotttueren an den Seiten, Niedergang, Dachreling und Luefter.
 * rich (high quality only): portholes and watertight doors on the sides, a ladder, roof rail and a vent.
 */
export function superBlock(b: Builder, f: FactionId, L: Look, x: number, y: number, z: number, w: number, h: number, d: number, rich = false) {
  if (rich) superRich(b, f, L, x, y, z, w, h, d);
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
      // Velkar selbst: tuerkises Leuchtband / Velkar itself: teal light band
      b.add(geo.taper(w * 0.86, d * 0.86, w * 0.82, d * 0.82, h * 0.13), f === 'velkar' ? TECH.glow : L.secondary, { p: [x, y + h * 0.65, z] });
      break;
  }
}

/** Zusatzteile eines Aufbau-Blocks (siehe superBlock) / extra parts of a superstructure block (see superBlock) */
function superRich(b: Builder, f: FactionId, L: Look, x: number, y: number, z: number, w: number, h: number, d: number) {
  const st = styleOf(f);
  // Verjuengung je Stil: Breite auf Hoehe t (0 unten, 1 oben) / taper per style: width at height t (0 bottom, 1 top)
  const kw = st === 'dravon' ? 0.7 : st === 'velkar' ? 0.72 : 1;
  const kd = st === 'dravon' ? 0.6 : st === 'velkar' ? 0.72 : 1;
  const wAt = (t: number) => w * (1 - (1 - kw) * t);
  const dAt = (t: number) => d * (1 - (1 - kd) * t);
  const frame = shade(L.hullDark, 0.9);
  for (const s of [-1, 1]) {
    // Schotttuer mit Rahmen und Vorreibern / watertight door with a frame and dogs
    const t = 0.3, xs = s * (wAt(t) / 2 + 0.0015);
    const zd = st === 'alvenia' ? z : z - dAt(t) * 0.18;
    b.box(0.003, h * 0.5, Math.min(0.022, d * 0.22), frame, [xs, y + h * 0.27, zd]);
    b.box(0.004, h * 0.42, Math.min(0.016, d * 0.16), shade(L.hull, 0.7), [xs + s * 0.0008, y + h * 0.26, zd]);
    b.box(0.005, 0.003, 0.004, mat.metalLight, [xs + s * 0.0015, y + h * 0.27, zd + Math.min(0.006, d * 0.06)]);
    // Bullaugen neben der Tuer / portholes next to the door
    if (st !== 'alvenia') porthole(b, [s * (wAt(0.35) / 2 + 0.0015), y + h * 0.35, z + dAt(0.35) * 0.22], s * HALF_PI, 0.0055, frame, mat.window);
  }
  // Niedergang an der Rueckwand / ladder on the rear wall
  ladder(b, [x + w * 0.25, y, z - dAt(0.5) / 2 - 0.003], h, 0.012, 0, mat.white);
  // Dachreling (nur gerade Dachkanten) und Luefter / roof rail (straight roof edges only) and a vent
  const tw = wAt(1) / 2 - 0.004, td = dAt(1) / 2 - 0.004, dz = st === 'dravon' ? -d * 0.12 : 0;
  if (st === 'korvat' || st === 'meridon') {
    const ry = y + h + 0.004;
    railing(b, [[-tw + x, ry, -td + z], [-tw + x, ry, td + z], [tw + x, ry, td + z], [tw + x, ry, -td + z]], 0.014, 0.03, mat.white, 0.0025, false);
  }
  b.add(geo.cbox(Math.min(0.026, tw), 0.01, Math.min(0.018, td), 0.003), shade(L.hullDark, 1.1), { p: [x - tw * 0.4, y + h + 0.006, z + dz - td * 0.4] });
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
  if (!fine()) return;
  // Scheinwerfer, Signallampen und Nockenreling / searchlights, signal lamps and wing rail
  for (const s of [-1, 1]) {
    searchlight(b, [s * (w / 2 - 0.006), y + 0.034, z + 0.004], s * 0.5, 0.0055, mat.dark, mat.lamp);
    b.cyl(0.003, 0.003, 0.006, 6, s < 0 ? mat.red : mat.green, [s * (w / 2 - 0.002), y + 0.026, z + 0.012]);
    bar(b, [s * (w / 2 - 0.013), y + 0.022 + 0.012, z + 0.015], [s * (w / 2 - 0.013), y + 0.022 + 0.012, z - 0.015], 0.0025, mat.white);
  }
}

/** Rettungsboote an beiden Seiten / lifeboats on both sides */
function lifeboats(b: Builder, L: Look, x: number, y: number, z: number) {
  for (const s of [-1, 1]) {
    b.add(geo.ctaper(0.02, 0.07, 0.03, 0.09, 0.02, 0.012), mat.white, { p: [s * x, y + 0.01, z] });
    b.add(geo.ctaper(0.024, 0.07, 0.016, 0.06, 0.012, 0.01), L.primary, { p: [s * x, y + 0.026, z] });
    for (const dz of [-0.03, 0.03]) b.add(geo.cyl(0.003, 0.003, 0.04, 4), mat.dark, { p: [s * (x + 0.01), y + 0.03, z + dz], r: [0, 0, s * 0.4] });
    if (!fine()) continue;
    // Davits als Bogen mit Laeufer, Persenning mit Spanten, Ruder / davits as an arc with falls, canvas cover with ribs, rudder
    for (const dz of [-0.03, 0.03]) {
      b.tube([s * (x + 0.018), y + 0.045, z + dz], [s * (x - 0.002), y + 0.056, z + dz], 0.0022, 3, mat.dark);
      b.tube([s * (x - 0.002), y + 0.056, z + dz], [s * (x - 0.002), y + 0.03, z + dz], 0.0009, 3, mat.sand);
    }
    for (let i = -2; i <= 2; i++) b.box(0.019, 0.003, 0.003, shade(L.primary, 0.75), [s * x, y + 0.0325, z + i * 0.012]);
    b.box(0.003, 0.012, 0.008, mat.dark, [s * x, y + 0.008, z - 0.046]);
  }
}

/** Schwenkgrenze der Schiffstuerme / traverse limit of ship turrets */
const SHIP_TURRET_ARC = (Math.PI * 3) / 4;

/**
 * Geschuetzturm / gun turret; dir 1 = nach vorn, -1 = nach hinten / dir 1 = forward, -1 = aft.
 * Drehbar (Builder.turret): schwenkt hoechstens 135 Grad aus der Ruhestellung, damit kein Rohr durch die Aufbauten zeigt.
 * Rotating (Builder.turret): traverses at most 135 degrees from rest so no barrel points through the superstructure.
 */
function turret(b: Builder, f: FactionId, L: Look, z: number, y: number, size: number, barrels: number, dir: 1 | -1) {
  const big = styleOf(f) === 'dravon' ? 1.45 : 1;
  b.group({ p: [0, y, z], r: [0, dir === 1 ? 0 : Math.PI, 0] }, () => b.turret([0, 0, 0], () => {
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
      if (fine()) {
        // Segeltuch-Manschette, Rohrbaender, dunkle Muendung / canvas blast bag, barrel bands, dark bore
        const at = (t: number): V3 => [x, size * 0.26 + (t - len / 2) * 0.06, size * 0.4 + t];
        b.cyl(size * 0.085 * big, size * 0.13, size * 0.09, 10, mix(mat.sand, L.hullDark, 0.45), at(size * 0.06), [HALF_PI - 0.06, 0, 0]);
        for (const k of [0.38, 0.7]) b.cyl(size * 0.085 * big, size * 0.085 * big, size * 0.03, 8, mat.darkMid, at(len * k), [HALF_PI - 0.06, 0, 0]);
        b.cyl(size * 0.05 * big, size * 0.05 * big, 0.003, 8, mat.ink, [x, size * 0.26 + len * 0.06 + 0.002, size * 0.4 + len + size * 0.036], [HALF_PI - 0.06, 0, 0]);
      }
    }
    if (fine()) {
      // Bolzenring am Drehkranz, Dachluke, Winkelspiegel, Entfernungsmesser-Hauben, Steigbuegel hinten
      // bolt ring on the turret ring, roof hatch, periscope hoods, rangefinder hoods, step irons at the rear
      boltRing(b, [0, size * 0.085, 0], size * 0.465, 12, 0.004, mat.dark);
      // Kuppel (Alvenia): Dach hoeher und gewoelbt / dome (Alvenia): roof higher and curved
      const dome = styleOf(f) === 'alvenia';
      const roof = dome ? size * 0.55 : styleOf(f) === 'dravon' ? size * 0.44 : size * 0.42;
      roundHatch(b, [-size * 0.2, roof, -size * 0.05], size * 0.11, shade(L.hull, 0.85), mat.dark);
      for (const s of [-1, 1]) {
        const ry = dome ? size * 0.51 : roof;
        b.add(geo.cbox(size * 0.12, size * 0.07, size * 0.1, 0.003), L.hullDark, { p: [s * size * 0.28, ry + size * 0.03, size * 0.18] });
        b.box(size * 0.1, size * 0.025, 0.003, mat.glassDark, [s * size * 0.28, ry + size * 0.04, size * 0.232]);
        b.cyl(size * 0.065, size * 0.065, size * 0.06, 8, mat.dark, [s * size * 0.6, size * 0.36, -size * 0.25], [0, 0, HALF_PI]);
      }
      for (let i = 0; i < 3; i++) b.box(size * 0.16, 0.003, 0.004, mat.dark, [size * 0.25, size * (0.12 + i * 0.09), -size * 0.47]);
    }
  }, { arc: SHIP_TURRET_ARC }));
}

/**
 * Dreibeinmast mit Radar / tripod mast with radar.
 * rich (nur hohe Qualitaet): Ausguck-Plattform mit Reling, Rahnocken mit Signallampen, Flaggleinen mit Signalflaggen,
 * zweite Radarantenne, Peitschenantennen und Steigeisen.
 * rich (high quality only): lookout platform with a rail, yardarm lamps, halyards with signal flags, a second radar
 * antenna, whip antennas and step irons.
 */
export function mast(b: Builder, L: Look, f: FactionId, z: number, y: number, h: number, rich = false) {
  if (rich) mastRich(b, L, z, y, h);
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
  if (styleOf(f) === 'velkar') b.add(geo.ico(0.01, 0), f === 'velkar' ? TECH.glow : L.secondary, { p: [0, y + h + 0.01, z] });
  // Velkar: Sensorringe am Mast / Velkar: sensor rings on the mast
  if (f === 'velkar') for (const k of [0.45, 0.62]) b.add(geo.torus(0.014, 0.003, 3, 10), TECH.glow, { p: [0, y + h * k, z], r: [HALF_PI, 0, 0] });
  // Wimpel in Fraktionsfarbe / pennant in faction colour
  b.add(geo.profileZY([[0, 0], [-0.07, -0.015], [0, -0.03]], 0.004), L.trim, { p: [0, y + h, z - 0.004] });
}

/** Zusatzteile des Masts (siehe mast) / extra parts of the mast (see mast) */
function mastRich(b: Builder, L: Look, z: number, y: number, h: number) {
  const py = y + h * 0.7;
  // Ausguck-Plattform mit Reling / lookout platform with a rail
  const ring: V3[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ring.push([Math.sin(a) * 0.028, py + 0.004, z + Math.cos(a) * 0.028]);
  }
  railing(b, ring, 0.012, 0.03, mat.white, 0.0022, false);
  // Rahnocken mit Signallampen und Flaggleinen bis an Deck / yardarm ends with signal lamps and halyards down to the deck
  const yy = y + h * 0.85;
  const flags = [L.primary, mat.white, L.secondary, mat.red];
  for (const s of [-1, 1]) {
    b.add(geo.sphere(0.004, 6, 3), mat.lamp, { p: [s * 0.06, yy + 0.004, z] });
    const top: V3 = [s * 0.058, yy, z], foot: V3 = [s * 0.05, y + 0.012, z - 0.07];
    b.tube(top, foot, 0.0008, 3, mat.dark);
    // Signalflaggen an der Leine / signal flags on the halyard
    for (let i = 0; i < 3; i++) {
      const t = 0.15 + i * 0.16;
      const p: V3 = [top[0] + (foot[0] - top[0]) * t, top[1] + (foot[1] - top[1]) * t - 0.004, top[2] + (foot[2] - top[2]) * t];
      b.add(geo.box(0.0015, 0.01, 0.012), flags[(i + (s > 0 ? 1 : 0)) % flags.length], { p, r: [0.5, 0, 0] });
    }
  }
  // zweite Radarantenne (Navigation) und Peitschenantennen / second (navigation) radar antenna and whip antennas
  b.group({ p: [0, y + h * 0.55, z + 0.03], r: [0, -0.4, 0] }, () => {
    b.cyl(0.003, 0.003, 0.012, 4, mat.dark, [0, 0.006, 0]);
    b.box(0.05, 0.006, 0.006, mat.dark, [0, 0.015, 0]);
  });
  for (const s of [-1, 1]) whip(b, [s * 0.05, y + h * 0.85, z], [s * 0.062, y + h * 0.99, z - 0.01], mat.dark);
  // Steigeisen am Mittelmast / step irons on the centre pole
  for (let i = 0; i < 4; i++) b.box(0.008, 0.002, 0.002, mat.metalLight, [0, y + h * (0.75 + i * 0.05), z + 0.007]);
}

function funnel(b: Builder, f: FactionId, L: Look, z: number, y: number, h: number, r: number) {
  if (styleOf(f) === 'alvenia') b.cyl(r, r * 1.1, h, 10, L.hull, [0, y + h / 2, z], [-0.15, 0, 0]);
  else if (styleOf(f) === 'velkar') b.add(geo.taper(r * 2, r * 2.4, r * 1.4, r * 1.6, h), L.hull, { p: [0, y + h / 2, z] });
  else if (styleOf(f) === 'dravon') b.add(geo.taper(r * 2, r * 2.6, r * 1.6, r * 1.6, h, -r * 0.6), L.hull, { p: [0, y + h / 2, z] });
  else b.add(geo.cbox(r * 2, h, r * 2.4, r * 0.5), L.hull, { p: [0, y + h / 2, z] });
  const dz = styleOf(f) === 'dravon' ? -r * 0.6 : 0;
  b.block(0, y + h - 0.02, z + dz, r * 2.1, 0.02, r * 2.5, L.trim);
  b.block(0, y + h, z + dz, r * 1.5, 0.004, r * 1.8, mat.ink);
  if (fine()) {
    // Abdeckgitter, Dampfrohre, Typhon, Steigleiter, Kappenring / cap grating, steam pipes, siren, ladder, cap ring
    for (let i = -2; i <= 2; i++) b.box(r * 1.4, 0.003, 0.003, mat.dark, [0, y + h + 0.002, z + dz + i * r * 0.32]);
    for (const s of [-1, 1]) b.tube([s * r * 0.55, y, z + dz - r * 1.25], [s * r * 0.55, y + h + 0.01, z + dz - r * 1.2], 0.0028, 4, mat.metal);
    b.cyl(0.004, 0.005, 0.012, 6, mat.metalLight, [r * 0.3, y + h + 0.012, z + dz + r * 0.6]);
    ladder(b, [r * 0.6, y, z + dz - r * 1.25], h - 0.022, 0.01, 0, mat.white);
    b.block(0, y + h - 0.03, z + dz, r * 2.12, 0.004, r * 2.52, mat.ink);
  }
  // Rauchwolke: bei hoher Qualitaet rund / smoke puff: round on high quality
  b.add(fine() ? geo.sphere(r * 0.9, 7, 4) : geo.ico(r * 0.9, 0), mat.cloudShade, { p: [0, y + h + r, z + dz - r * 0.6] });
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
  // Proportion: kurz und breit (0.46 x 0.34 statt 0.62 x 0.3), das kleinste Schiff; Zerstoerer schlank, Schlachtschiff lang
  // proportion: short and wide (0.46 x 0.34 instead of 0.62 x 0.3), the smallest ship; destroyer slim, battleship long
  const len = 0.46, w = 0.34, top = 0.07, k = len / 0.62;
  // flacher Kasten-Rumpf mit gefasten Kanten / flat box hull with chamfered edges
  b.add(geo.cbox(w - 0.02, 0.03, len - 0.02, 0.03), L.hullDark, { p: [0, -0.015, 0] });
  b.add(geo.cbox(w, 0.014, len, 0.03), mat.ink, { p: [0, 0.007, 0] });
  b.block(0, 0.014, -0.02, w - 0.02, 0.012, len - 0.06, mat.woodLight);
  for (let i = 0; i < 4; i++) b.block(0, 0.026, (-0.22 + i * 0.13) * k, w - 0.06, 0.003, 0.008, mat.wood);
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.03, top - 0.014, len - 0.02, 0.008), L.hull, { p: [s * (w / 2 - 0.015), 0.014 + (top - 0.014) / 2, -0.01] });
    b.block(s * (w / 2 - 0.015), top, -0.01, 0.034, 0.006, len - 0.02, L.trim);
    // Poller, Fender, Seitenrippen / bollards, fenders, side ribs
    for (const z of [-0.2, 0.15]) b.cyl(0.008, 0.009, 0.016, 6, mat.dark, [s * (w / 2 - 0.015), top + 0.011, z * k]);
    for (const z of [-0.05, 0.15]) b.cyl(0.011, 0.011, 0.03, 8, mat.dark, [s * (w / 2 + 0.008), 0.035, z * k]);
    for (let i = 0; i < 3; i++) b.box(0.004, top - 0.02, 0.008, L.hullDark, [s * (w / 2 + 0.001), top / 2 + 0.005, (-0.2 + i * 0.15) * k]);
  }
  // Rettungsring + Bootsfuehrer / life ring + helmsman
  b.add(geo.torus(0.022, 0.007, 4, 10), mat.white, { p: [w / 2 + 0.004, 0.05, -0.16], r: [0, HALF_PI, 0] });
  b.add(geo.torus(0.022, 0.0072, 4, 4), L.primary, { p: [w / 2 + 0.0045, 0.05, -0.16], r: [0, HALF_PI, Math.PI / 4] });
  b.group({ p: [0.08, top - 0.02, -0.17], s: 0.6 }, () => soldier(b, f, standPose([[-0.06, 0.24, -0.08], [0.06, 0.24, -0.08]]), { detail: 0, seed: 9, noLegs: true }));
  b.block(0, 0.014, -len / 2 + 0.03, w, top - 0.014 + 0.015, 0.06, L.hull);
  // Bugrampe mit Rippen / bow ramp with ribs
  b.group({ p: [0, 0.06, len / 2 - 0.03], r: [-0.2, 0, 0] }, () => {
    b.add(geo.cbox(w - 0.02, 0.1, 0.018, 0.006), L.hullDark, {});
    for (const y of [-0.03, 0.0, 0.03]) b.box(w - 0.04, 0.008, 0.008, L.trim, [0, y, 0.011]);
  });
  for (const s of [-1, 1]) b.tube([s * (w / 2 - 0.02), top + 0.004, len / 2 - 0.06], [s * (w / 2 - 0.02), 0.1, len / 2 - 0.03], 0.003, 4, mat.metal);
  // Steuerstand mit Motorabdeckung / helm station with engine cover
  b.add(geo.cbox(0.1, 0.08, 0.07, 0.012), L.hull, { p: [0.08, top + 0.04, -len / 2 + 0.05] });
  b.block(0.08, top + 0.045, -len / 2 + 0.05, 0.104, 0.02, 0.074, mat.window);
  b.block(0.08, top + 0.08, -len / 2 + 0.05, 0.11, 0.01, 0.08, L.trim);
  b.add(geo.cbox(0.09, 0.03, 0.05, 0.01), L.hullDark, { p: [-0.07, top + 0.015, -len / 2 + 0.045] });
  b.cyl(0.008, 0.01, 0.05, 6, mat.darkMid, [-0.1, top + 0.05, -len / 2 + 0.04]);
  b.cyl(0.004, 0.004, 0.12, 4, mat.dark, [0.11, top + 0.14, -len / 2 + 0.04]);
  b.add(geo.profileZY([[0, 0], [-0.06, -0.012], [0, -0.024]], 0.004), L.trim, { p: [0.11, top + 0.2, -len / 2 + 0.036] });
  b.box(0.01, 0.01, 0.01, mat.red, [-(w / 2 - 0.015), top + 0.02, 0.2 * k]);
  b.box(0.01, 0.01, 0.01, mat.green, [w / 2 - 0.015, top + 0.02, 0.2 * k]);
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [w / 2 + 0.003, 0.045, -0.06], r: [0, HALF_PI, 0] });
  // Velkar: Leuchtleisten auf den Bordwaenden / Velkar: light strips on the side walls
  if (f === 'velkar') for (const sx of [-1, 1]) b.box(0.036, 0.004, len * 0.6, TECH.glow, [sx * (w / 2 - 0.015), top + 0.004, 0.0]);
  // Ladung: kleine getragene Einheit / cargo: tiny carried unit marker
  if (carried) b.addColored(carried, { p: [-0.02, 0.029, 0.03], s: 0.5 });
  else b.add(geo.cbox(0.08, 0.05, 0.08, 0.012), L.gear, { p: [0, 0.054, 0.03] });
  if (fine()) landingBoatRich(b, f, L, len, w, top, k);
  return b;
}

/**
 * Landungsboot bei hoher Qualitaet: zwei Bord-MGs auf Pivots mit Schild und Munitionskasten, Tauwerk als Scheuerleiste,
 * Rampenscharniere, Gleitschutzleisten und Ketten, Auspuffrohre, Steuerrad und Kompass, Speigatten, Kanister, Leine,
 * Heckanker, Kennzeichnung am Bug.
 * Landing boat on high quality: two pintle MGs with a shield and an ammo box, rope fendering along the gunwale, ramp
 * hinges, anti-slip cleats and chains, exhaust pipes, steering wheel and compass, scuppers, jerrycans, a rope coil, a kedge
 * anchor, bow marking.
 */
function landingBoatRich(b: Builder, f: FactionId, L: Look, len: number, w: number, top: number, k: number) {
  for (const s of [-1, 1]) {
    // Tauwerk entlang des Dollbords / rope fendering along the gunwale
    b.tube([s * (w / 2 + 0.004), top - 0.012, -len / 2 + 0.02], [s * (w / 2 + 0.004), top - 0.012, len / 2 - 0.05], 0.004, 5, mat.sand);
    // Speigatten unten in der Bordwand / scuppers low in the side wall
    for (let i = 0; i < 5; i++) b.box(0.004, 0.006, 0.014, mat.ink, [s * (w / 2 + 0.001), 0.02, (-0.17 + i * 0.075) * k]);
    // Bord-MG auf Pivot mit Schild und Munitionskasten / pintle MG with a shield and an ammo box
    b.group({ p: [s * (w / 2 - 0.015), top + 0.006, -0.06 * k] }, () => {
      b.cyl(0.004, 0.005, 0.035, 6, mat.dark, [0, 0.0175, 0]);
      b.add(geo.cbox(0.014, 0.014, 0.05, 0.003), mat.dark, { p: [0, 0.04, 0.008] });
      b.cyl(0.0035, 0.0035, 0.045, 6, mat.darkMid, [0, 0.042, 0.055], [HALF_PI, 0, 0]);
      b.cyl(0.005, 0.005, 0.012, 6, mat.dark, [0, 0.042, 0.078], [HALF_PI, 0, 0]);
      b.add(geo.cbox(0.044, 0.03, 0.004, 0.002), L.hullDark, { p: [0, 0.046, 0.03] });
      b.box(0.012, 0.012, 0.016, L.gear, [-s * 0.012, 0.034, 0.006]);
      b.box(0.004, 0.01, 0.004, mat.dark, [0, 0.03, -0.018], [0.4, 0, 0]);
    });
  }
  // Rampe: Scharnier, Gleitschutzleisten innen, Ketten zu den Haltepfosten / ramp: hinge, anti-slip cleats inside, chains to the posts
  b.cyl(0.009, 0.009, w - 0.03, 8, mat.dark, [0, 0.012, len / 2 - 0.03], [0, 0, HALF_PI]);
  b.group({ p: [0, 0.06, len / 2 - 0.03], r: [-0.2, 0, 0] }, () => {
    for (let i = 0; i < 6; i++) b.box(w - 0.06, 0.004, 0.004, shade(L.hullDark, 0.75), [0, -0.04 + i * 0.016, -0.011]);
    b.add(geo.box(0.05, 0.03, 0.002), L.secondary, { p: [0, 0.015, 0.0095] });
    b.add(geo.box(0.032, 0.012, 0.0024), mat.white, { p: [0, 0.015, 0.0098] });
  });
  // Auspuffrohre am Motorkasten / exhaust pipes on the engine cover
  for (const dx of [-0.02, 0.02]) {
    b.tube([-0.07 + dx, top + 0.03, -len / 2 + 0.03], [-0.07 + dx, top + 0.07, -len / 2 + 0.02], 0.005, 6, mat.darkMid);
    b.cyl(0.007, 0.006, 0.008, 6, mat.ink, [-0.07 + dx, top + 0.074, -len / 2 + 0.02]);
  }
  grille(b, [-0.07, top + 0.016, -len / 2 + 0.071], 0.06, 0.018, 4, L.hullDark, mat.dark);
  // Steuerstand: Fensterstreben, Steuerrad, Kompass, Funkantenne / helm: window mullions, steering wheel, compass, radio whip
  for (const dx of [-0.03, 0, 0.03]) b.box(0.004, 0.022, 0.003, mat.ink, [0.08 + dx, top + 0.045, -len / 2 + 0.088]);
  b.add(geo.torus(0.008, 0.0015, 3, 8), mat.wood, { p: [0.08, top + 0.09, -len / 2 + 0.097], r: [0.4, 0, 0] });
  b.cyl(0.005, 0.006, 0.006, 8, mat.metalLight, [0.05, top + 0.088, -len / 2 + 0.07]);
  whip(b, [0.05, top + 0.085, -len / 2 + 0.03], [0.04, top + 0.16, -len / 2 + 0.025], mat.dark);
  // Kanister, Leine und Heckanker / jerrycans, rope coil and kedge anchor
  for (const dx of [0, 0.022]) {
    b.add(geo.cbox(0.018, 0.026, 0.008, 0.002), L.primaryDark, { p: [-w / 2 + 0.05 + dx, 0.038, -0.14 * k] });
    b.box(0.006, 0.004, 0.004, mat.dark, [-w / 2 + 0.046 + dx, 0.053, -0.14 * k]);
  }
  ropeCoil(b, [-w / 2 + 0.05, 0.03, 0.06 * k], 0.012, 0.0028, mat.sand);
  b.group({ p: [0.0, top + 0.012, -len / 2 + 0.005] }, () => {
    b.box(0.004, 0.024, 0.004, mat.dark, [0, 0, 0]);
    b.box(0.024, 0.004, 0.004, mat.dark, [0, -0.01, 0]);
    for (const s of [-1, 1]) b.box(0.004, 0.008, 0.004, mat.dark, [s * 0.012, -0.006, 0], [0, 0, s * 0.5]);
  });
  // MG-Schuetze links (Besatzung, ohne Beine) / MG gunner on the left (crew, no legs)
  b.group({ p: [-(w / 2 - 0.045), top - 0.035, -0.06 * k - 0.05], r: [0, 0.25, 0], s: 0.55 }, () =>
    soldier(b, f, standPose([[0.02, 0.27, 0.12], [0.07, 0.24, 0.1]]), { detail: 0, seed: 12, noLegs: true }));
  // Kennzeichnung an den Bordwaenden vorn / marking on the side walls at the front
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) b.box(0.003, 0.02, 0.008, mat.white, [s * (w / 2 + 0.0015), 0.045, 0.15 * k + i * 0.014]);
  if (f === 'velkar') for (const s of [-1, 1]) b.box(0.004, 0.006, 0.06, TECH.glow, [s * (w / 2 + 0.002), 0.03, -0.1 * k]);
}

export function submarine(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  // Rumpf als gestreckter Koerper (hohe Qualitaet: runder) / hull as stretched body (high quality: rounder)
  const hs = fine() ? 1.3 : 1;
  b.add(geo.sphere(0.1, Math.round(20 * hs), Math.round(10 * hs)), L.hullDark, { p: [0, 0.0, 0], s: [0.85, 0.6, 4.1] });
  b.add(geo.sphere(0.1, Math.round(20 * hs), Math.round(8 * hs)), L.hull, { p: [0, 0.012, 0], s: [0.75, 0.42, 3.8] });
  b.add(geo.cbox(0.05, 0.012, 0.56, 0.012), L.hull, { p: [0, 0.052, -0.01] });
  b.box(0.02, 0.008, 0.5, L.trim, [0, 0.06, 0]);
  // Flutschlitze + Reling / flood holes + rail
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 8; i++) b.box(0.006, 0.006, 0.02, mat.ink, [sx * 0.07, 0.028, -0.26 + i * 0.07]);
    b.box(0.003, 0.003, 0.2, mat.white, [sx * 0.022, 0.078, -0.2]);
    for (let i = 0; i < 4; i++) b.box(0.003, 0.018, 0.003, mat.white, [sx * 0.022, 0.068, -0.29 + i * 0.06]);
  }
  // Luken / hatches
  const rich = fine();
  for (const z of [-0.2, 0.2, 0.28]) {
    if (rich) roundHatch(b, [0, 0.058, z], 0.012, L.hullDark, mat.dark);
    else b.cyl(0.012, 0.013, 0.008, 8, L.hullDark, [0, 0.062, z]);
  }
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
      b.box(0.042, 0.012, 0.06, f === 'velkar' ? TECH.glow : L.secondary, [0, 0.12, sz - 0.01]);
      // Velkar: Sensormast und Leuchtlinie am Rumpf / Velkar: sensor mast and light line on the hull
      if (f === 'velkar') {
        b.tube([0, 0.15, sz - 0.03], [0, 0.27, sz - 0.04], 0.004, 4, TECH.gear);
        techDot(b, [0, 0.275, sz - 0.04], 0.011);
        for (const sx of [-1, 1]) b.box(0.004, 0.006, 0.4, TECH.glow, [sx * 0.064, 0.04, 0]);
      }
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
  if (rich) submarineRich(b, f, L, sz, st);
  return b;
}

/**
 * U-Boot bei hoher Qualitaet: Spantringe am Druckkoerper, Gitterrost auf dem Oberdeck, Bugtiefenruder, Deckgeschuetz
 * oder Startluken, Bruecken-Reling, Bullaugen und Steigbuegel am Turm, Flagge, Tiefgangsmarken, Schraubennabe, Blasen.
 * Submarine on high quality: frame rings on the pressure hull, grating on the upper deck, bow planes, a deck gun or launch
 * hatches, bridge rail, portholes and step irons on the sail, a flag, draught marks, propeller boss, bubbles.
 */
function submarineRich(b: Builder, f: FactionId, L: Look, sz: number, st: number) {
  const st0 = styleOf(f);
  // Spantringe (halbe Ringe ueber Wasser), dem Rumpfellipsoid folgend / frame rings (half rings above water) following the hull ellipsoid
  for (const z of [-0.3, -0.22, -0.14, 0.14, 0.22, 0.3]) {
    const k = Math.sqrt(1 - (z / 0.41) ** 2);
    b.add(new THREE.TorusGeometry(1, 0.03, 3, 12, Math.PI), shade(L.hullDark, 0.8), { p: [0, 0, z], s: [0.086 * k, 0.061 * k, 0.07] });
  }
  // Gitterrost auf dem Oberdeck / grating on the upper deck
  for (let i = 0; i < 16; i++) {
    const z = -0.27 + i * 0.036;
    if (Math.abs(z - sz) < 0.08) continue;
    b.box(0.046, 0.0015, 0.003, shade(L.hull, 0.7), [0, 0.0585, z]);
  }
  // Bugtiefenruder (ausgeklappt) / bow planes (folded out)
  for (const sx of [-1, 1]) {
    b.add(geo.cbox(0.04, 0.005, 0.022, 0.004), L.hullDark, { p: [sx * 0.078, 0.034, 0.3], r: [0, sx * 0.15, sx * -0.1] });
    // Tiefgangsmarken am Bug und Heck / draught marks at the bow and stern
    for (const z of [0.36, -0.36]) for (let i = 0; i < 3; i++) {
      const k = Math.sqrt(1 - (z / 0.41) ** 2);
      b.box(0.002, 0.003, 0.008, mat.white, [sx * (0.085 * k + 0.0005), 0.008 + i * 0.01, z]);
    }
  }
  // Deckgeschuetz vor dem Turm oder Startluken hinter dem Turm / deck gun in front of the sail or launch hatches behind it
  if (st0 === 'velkar' || st0 === 'alvenia') {
    for (const x of [-0.012, 0.012]) for (let i = 0; i < 3; i++) {
      b.add(geo.cbox(0.018, 0.003, 0.018, 0.003), shade(L.hull, 0.85), { p: [x, 0.0595, sz - 0.1 - i * 0.024] });
      b.box(0.014, 0.0015, 0.002, mat.dark, [x, 0.0612, sz - 0.1 - i * 0.024 - 0.006]);
    }
  } else {
    b.group({ p: [0, 0.058, sz + 0.125] }, () => {
      b.cyl(0.008, 0.012, 0.016, 8, L.hullDark, [0, 0.008, 0]);
      b.add(geo.cbox(0.02, 0.014, 0.024, 0.004), L.hull, { p: [0, 0.022, 0] });
      b.cyl(0.0035, 0.004, 0.05, 6, mat.dark, [0, 0.025, 0.035], [HALF_PI - 0.12, 0, 0]);
      b.box(0.03, 0.016, 0.003, L.hull, [0, 0.026, 0.013], [-0.2, 0, 0]);
      for (const sx of [-1, 1]) b.cyl(0.006, 0.006, 0.004, 6, mat.darkMid, [sx * 0.012, 0.022, -0.004], [0, 0, HALF_PI]);
    });
  }
  // Bruecken-Reling auf dem Turm (Ellipse) / bridge rail on the sail (ellipse)
  const zc = st0 === 'dravon' ? sz - 0.015 : sz, hz = st0 === 'dravon' ? 0.045 : 0.055;
  const rail: V3[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rail.push([Math.sin(a) * 0.028, st, zc + Math.cos(a) * hz]);
  }
  railing(b, rail, 0.016, 0.03, mat.white, 0.0022, false);
  // Bullaugen und Steigbuegel an den Turmseiten / portholes and step irons on the sail sides
  const xs = st0 === 'velkar' ? 0.031 : 0.0355;
  for (const sx of [-1, 1]) {
    for (const dz of [-0.025, 0.012]) porthole(b, [sx * xs, st - 0.045, sz + dz], sx * HALF_PI, 0.006, shade(L.hull, 0.7), mat.window);
    for (let i = 0; i < 4; i++) b.box(0.003, 0.002, 0.01, mat.metalLight, [sx * (xs + 0.001), 0.07 + i * 0.016, sz - 0.05]);
  }
  // Flagge am Turm in Fraktionsfarben / flag on the sail in faction colours
  b.tube([0, st, zc - hz], [0, st + 0.05, zc - hz - 0.004], 0.0015, 3, mat.dark);
  b.add(geo.box(0.002, 0.016, 0.026), L.primary, { p: [0, st + 0.04, zc - hz - 0.018] });
  b.add(geo.box(0.0024, 0.006, 0.026), L.secondary, { p: [0, st + 0.038, zc - hz - 0.018] });
  // zweite Reihe Flutschlitze, Klampen am Oberdeck, Seitensonar-Felder am Bug / second row of flood holes, cleats on the upper deck, flank sonar panels at the bow
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = -0.24 + i * 0.06, kz = Math.sqrt(1 - (z / 0.41) ** 2);
      b.box(0.004, 0.005, 0.014, mat.ink, [sx * (0.057 * kz + 0.0005), 0.045, z]);
    }
    for (const z of [-0.25, -0.12, 0.17, 0.3]) for (const dz of [-0.006, 0.006]) b.box(0.003, 0.004, 0.003, mat.dark, [sx * 0.022, 0.0605, z + dz]);
    b.box(0.003, 0.016, 0.05, mat.darkMid, [sx * 0.068, 0.018, 0.26], [0, sx * 0.18, 0]);
  }
  // Turm: Radarmast mit Antenne, Schnorchelkopf, Peitschenantennen / sail: radar mast with an antenna, snorkel head, whip antennas
  b.tube([0.0, st, sz + 0.0], [0.0, st + 0.06, sz + 0.0], 0.003, 4, mat.dark);
  b.add(geo.cbox(0.03, 0.008, 0.008, 0.002), mat.dark, { p: [0, st + 0.064, sz], r: [0, 0.6, 0] });
  b.cyl(0.011, 0.009, 0.012, 8, mat.dark, [-0.014, st + 0.051, sz - 0.04]);
  for (const sx of [-1, 1]) whip(b, [sx * 0.02, st, sz - 0.045], [sx * 0.03, st + 0.07, sz - 0.06], mat.dark);
  // Heck: Schraubennabe, Ruder-Endplatten, Luftblasen / stern: propeller boss, rudder end plates, bubbles
  b.cyl(0.008, 0.012, 0.012, 8, mat.metalLight, [0, 0, -0.41], [HALF_PI, 0, 0]);
  for (const sx of [-1, 1]) b.box(0.004, 0.018, 0.04, L.hullDark, [sx * 0.066, 0, -0.4]);
  for (const [x, z, r] of [[0.03, -0.4, 0.008], [-0.03, -0.405, 0.006], [0.035, -0.415, 0.005], [-0.036, -0.39, 0.005]] as [number, number, number][]) {
    b.add(geo.sphere(r, 6, 3), mat.white, { p: [x, 0.004, z], s: [1, 0.5, 1] });
  }
}

export function destroyer(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  const top = 0.06;
  const rich = fine();
  hull(b, L, 0.84, 0.2, top, 0.22, mat.metalLight, 14, rich);
  const d = top + 0.008;
  superBlock(b, f, L, 0, d, 0.06, 0.13, 0.07, 0.16, rich);
  superBlock(b, f, L, 0, d + 0.07, 0.08, 0.1, 0.055, 0.08, rich);
  bridgeWings(b, L, d + 0.11, 0.1, 0.15);
  mast(b, L, f, 0.06, d + 0.125, 0.16, rich);
  // Lesbarkeit: zwei hohe Schornsteine, die Kennform des Zerstoerers gegen das U-Boot mit nur einem Turm / readability: two tall funnels, the destroyer's signature against the submarine with its single sail
  funnel(b, f, L, -0.025, d, 0.17, 0.03);
  funnel(b, f, L, -0.088, d, 0.15, 0.026);
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
  b.tube([0, d, -0.21], [0, d + 0.12, -0.21], 0.005, 6, mat.dark);
  b.add(geo.sphere(0.02, 10, 5), mat.white, { p: [0, d + 0.13, -0.21] });
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [0.101, 0.035, 0.18], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [-0.101, 0.035, 0.18], r: [0, -HALF_PI, 0] });
  if (f === 'velkar') techHullLine(b, 0.1, 0.05, 0.5);
  if (rich) destroyerRich(b, f, L, d);
  return b;
}

/**
 * Zerstoerer bei hoher Qualitaet: Wasserbombengestelle am Heck, Torpedosatz mit Drehkranz und Muendungsdeckeln,
 * Hubschrauberdeck mit H und Randlichtern, Mehrlingsrohre der Nahbereichsabwehr, Antennen am Heckmast, Leinen und Kisten.
 * Destroyer on high quality: depth charge racks at the stern, torpedo mount with a training ring and muzzle caps,
 * helideck with an H and edge lights, the close-in gun's barrel cluster, antennas on the aft mast, ropes and crates.
 */
function destroyerRich(b: Builder, f: FactionId, L: Look, d: number) {
  // Wasserbombengestelle: schraege Schienen mit Tonnen / depth charge racks: sloped rails with drums
  for (const s of [-1, 1]) {
    for (const dx of [-0.008, 0.008]) b.box(0.003, 0.003, 0.06, mat.dark, [s * 0.062 + dx, d + 0.012, -0.385], [-0.12, 0, 0]);
    for (let i = 0; i < 3; i++) b.cyl(0.008, 0.008, 0.016, 8, mat.darkMid, [s * 0.062, d + 0.016 + i * 0.0025, -0.36 - i * 0.017], [0, 0, HALF_PI]);
  }
  // Hubschrauberdeck: H und Randlichter / helideck: H and edge lights
  b.box(0.004, 0.0015, 0.03, mat.white, [-0.011, d + 0.0055, -0.33]);
  b.box(0.004, 0.0015, 0.03, mat.white, [0.011, d + 0.0055, -0.33]);
  b.box(0.022, 0.0015, 0.004, mat.white, [0, d + 0.0055, -0.33]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.box(0.004, 0.004, 0.004, mat.lamp, [Math.sin(a) * 0.05, d + 0.005, -0.33 + Math.cos(a) * 0.05]);
  }
  // Torpedosatz: Drehkranz und dunkle Muendungen / torpedo mount: training ring and dark muzzles
  if (styleOf(f) !== 'meridon') {
    b.cyl(0.032, 0.034, 0.006, 12, mat.darkMid, [0, d + 0.032, -0.15]);
    for (const x of [-0.015, 0.015]) {
      b.cyl(0.0105, 0.0105, 0.008, 8, L.hullDark, [x, d + 0.04, -0.1], [HALF_PI, 0, 0]);
      b.cyl(0.006, 0.006, 0.003, 8, mat.ink, [x, d + 0.04, -0.0955], [HALF_PI, 0, 0]);
      b.cyl(0.0105, 0.0105, 0.006, 8, L.hullDark, [x, d + 0.04, -0.17], [HALF_PI, 0, 0]);
    }
  }
  // Nahbereichsabwehr: sechs Rohre und Sensorkasten / close-in gun: six barrels and a sensor box
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.cyl(0.0012, 0.0012, 0.03, 3, mat.dark, [Math.sin(a) * 0.0035, d + 0.14 + Math.cos(a) * 0.0035, 0.06], [HALF_PI, 0, 0]);
  }
  b.add(geo.cbox(0.012, 0.012, 0.014, 0.003), mat.white, { p: [0.016, d + 0.15, 0.022] });
  // Heckmast: Plattform und Antennen / aft mast: platform and antennas
  b.cyl(0.016, 0.016, 0.003, 10, mat.dark, [0, d + 0.09, -0.21]);
  for (const s of [-1, 1]) whip(b, [s * 0.014, d + 0.092, -0.21], [s * 0.03, d + 0.17, -0.22], mat.dark);
  // Leinen, Kisten, Feuerloescher-Kasten / ropes, crates, fire hose box
  for (const s of [-1, 1]) ropeCoil(b, [s * 0.055, d + 0.003, 0.24 - 0.06], 0.008, 0.002, mat.sand);
  crate(b, [0.05, d, -0.24], 0.018, 0.014, 0.022, mat.wood, shade(mat.wood, 0.7), 0.2);
  b.add(geo.cbox(0.01, 0.016, 0.006, 0.002), mat.red, { p: [-0.066, d + 0.03, 0.03] });
}

/** Velkar: tuerkise Leuchtlinie an beiden Rumpfseiten / Velkar: teal light line on both hull sides */
function techHullLine(b: Builder, x: number, y: number, len: number) {
  for (const s of [-1, 1]) b.box(0.004, 0.007, len, TECH.glow, [s * x, y, -0.02]);
}

export function battleship(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  const top = 0.07;
  const rich = fine();
  hull(b, L, 0.88, 0.28, top, 0.24, mat.woodLight, 14, rich);
  // Deckplanken / deck planks
  for (let i = 0; i < 9; i++) b.box(0.003, 0.002, 0.7, shade(mat.woodLight, 0.8), [-0.12 + i * 0.03, top + 0.009, -0.02]);
  // Stossfugen der Planken versetzt / staggered plank butt joints
  if (rich) for (let i = 0; i < 8; i++) for (let k = 0; k < 6; k++) b.box(0.028, 0.002, 0.002, shade(mat.woodLight, 0.85), [-0.105 + i * 0.03, top + 0.009, -0.33 + k * 0.12 + (i % 2) * 0.06]);
  const d = top + 0.008;
  // Mehrere Tuerme: zwei vorn (ueberhoehend), einer hinten / multiple turrets: two fore (superfiring), one aft
  turret(b, f, L, 0.222, d, 0.11, 2, 1);
  b.add(geo.cbox(0.1, 0.035, 0.1, 0.02), L.hullDark, { p: [0, d + 0.0175, 0.12] });
  turret(b, f, L, 0.12, d + 0.035, 0.11, 2, 1);
  turret(b, f, L, -0.22, d, 0.11, 2, -1);
  // Aufbau mit Turmmast / superstructure with tower mast
  superBlock(b, f, L, 0, d, 0.0, 0.17, 0.07, 0.2, rich);
  superBlock(b, f, L, 0, d + 0.07, 0.02, 0.12, 0.06, 0.11, rich);
  superBlock(b, f, L, 0, d + 0.13, 0.03, 0.08, 0.05, 0.06, rich);
  // Lesbarkeit: hoher Gefechtsturm (Pagode) mit Leitstand und hohem Mast, die Kennform des Schlachtschiffs gegen den flachen
  // Zerstoerer / readability: tall battle tower (pagoda) with a fire-control top and a tall mast, the battleship's signature
  // against the low destroyer
  superBlock(b, f, L, 0, d + 0.18, 0.03, 0.1, 0.06, 0.08);
  b.add(geo.cbox(0.13, 0.035, 0.06, 0.01), L.hullDark, { p: [0, d + 0.255, 0.03] });
  for (const s2 of [-1, 1]) b.cyl(0.014, 0.014, 0.03, 8, mat.dark, [s2 * 0.065, d + 0.255, 0.03], [0, 0, HALF_PI]);
  bridgeWings(b, L, d + 0.16, 0.05, 0.12);
  mast(b, L, f, 0.025, d + 0.272, 0.2, rich);
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
  if (f === 'velkar') techHullLine(b, 0.14, 0.055, 0.52);
  if (rich) battleshipRich(b, L, d);
  return b;
}

/**
 * Schlachtschiff bei hoher Qualitaet: Bordflugzeug auf dem Katapult, Kranhaken mit Seil, Schutzschilde an Flak und
 * Nebengeschuetzen, Leitstand mit Fenstern, Scheinwerferplattform am Schornstein, Leinen und Kisten.
 * Battleship on high quality: floatplane on the catapult, crane hook with a cable, shields on the AA and secondary guns,
 * fire-control top with windows, searchlight platform at the funnel, ropes and crates.
 */
function battleshipRich(b: Builder, L: Look, d: number) {
  // Bordflugzeug: Rumpf, Fluegel, Schwimmer, Propeller / floatplane: fuselage, wings, float, propeller
  b.group({ p: [-0.05, d + 0.022, -0.33] }, () => {
    b.add(capsule(0.009, 0.006, 0.07, 8, 2), L.primaryDark, { r: [HALF_PI, 0, 0] });
    b.add(geo.cbox(0.11, 0.003, 0.02, 0.003), L.primary, { p: [0, 0.006, 0.008] });
    b.add(geo.cbox(0.04, 0.003, 0.012, 0.002), L.primary, { p: [0, 0.004, -0.032] });
    b.box(0.003, 0.016, 0.012, L.primary, [0, 0.01, -0.032]);
    b.add(capsule(0.005, 0.004, 0.06, 6, 1), mat.white, { p: [0, -0.016, 0.004], r: [HALF_PI, 0, 0] });
    for (const z of [-0.008, 0.016]) b.box(0.002, 0.012, 0.002, mat.dark, [0, -0.008, z]);
    b.box(0.03, 0.003, 0.002, mat.dark, [0, 0, 0.038], [0, 0, 0.4]);
    b.add(geo.hemi(0.005, 6, 2), mat.glassDark, { p: [0, 0.007, 0.008], s: [1, 1, 1.8] });
  });
  // Kranhaken mit Seil / crane hook with a cable
  b.tube([0.06, d + 0.084, -0.262], [0.06, d + 0.035, -0.262], 0.0008, 3, mat.dark);
  b.box(0.004, 0.008, 0.002, mat.metalLight, [0.06, d + 0.032, -0.262]);
  // Schutzschilde an Flak und Nebengeschuetzen / shields on the AA and secondary guns
  for (const s of [-1, 1]) {
    for (const z of [-0.12, 0.17]) b.add(geo.cyl(0.016, 0.016, 0.014, 10, true), shade(L.hull, 0.9), { p: [s * 0.11, d + 0.019, z] });
    for (const z of [-0.04, 0.06]) {
      b.add(geo.cbox(0.03, 0.016, 0.026, 0.005), L.hull, { p: [s * 0.1, d + 0.032, z + 0.004] });
      b.box(0.01, 0.006, 0.004, mat.glassDark, [s * 0.1, d + 0.036, z + 0.018]);
    }
  }
  // Leitstand: Fensterband und Messeroehre / fire-control top: window band and rangefinder tubes
  b.box(0.11, 0.008, 0.004, mat.glassDark, [0, d + 0.258, 0.061]);
  // Scheinwerferplattform am Schornstein / searchlight platform at the funnel
  b.cyl(0.05, 0.05, 0.004, 14, mat.dark, [0, d + 0.11, -0.1]);
  for (const s of [-1, 1]) searchlight(b, [s * 0.04, d + 0.124, -0.1], s * 1.2, 0.007, mat.dark, mat.lamp);
  // Leinen und Kisten / ropes and crates
  for (const s of [-1, 1]) ropeCoil(b, [s * 0.075, d + 0.003, 0.3], 0.01, 0.0025, mat.sand);
  crate(b, [-0.075, d, -0.26], 0.02, 0.016, 0.026, mat.wood, shade(mat.wood, 0.7), 0.3);
  crate(b, [-0.09, d, -0.235], 0.016, 0.012, 0.02, mat.wood, shade(mat.wood, 0.7), -0.2);
}
