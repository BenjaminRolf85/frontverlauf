/**
 * Schattenflotte der Meridon (Modelle): Schattenkommando (geduckter Kaempfer mit Kapuze, Karabiner und Sprengsatz),
 * Nebelkutter (flaches Boot mit Tarnnetz und Nebelwerfern), Lenkflugkoerper (Rakete auf Startschlitten), Radarwagen
 * (leichter Wagen mit drehbarer Radarschuessel im Turm) und Raketensilo (Silodeckel mit Rakete, Betonring, Antenne).
 * Palette: Fraktionsfarben der Liga (Marine, Gold), dazu dunkles Tarngrau fuer alles Verdeckte.
 * Meridon shadow fleet (models): Shadow Commando (crouched fighter with a hood, carbine and charge), Fog Cutter (flat boat
 * with a camo net and smoke throwers), Guided Missile (rocket on a launch sled), Radar Truck (light truck with a rotating
 * radar dish in its turret) and rocket silo (silo hatch with a rocket, concrete ring, antenna). Palette: the League's
 * faction colours (navy, gold), plus a dark camo grey for everything covert.
 * Ursprung unten mittig, Kachel 1x1, Blick +z / origin bottom centre, tile 1x1, facing +z.
 */
import type * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, memo, mix, shade, type V3 } from './kit';
import { look, mat } from './look';
import { rifle, soldier, standPose } from './soldiers';
import { wheel } from './vehicles';

const HALF_PI = Math.PI / 2;
/** Tarngrau der Schattenflotte aus Fraktionsfarbe und Tinte / camo grey of the shadow fleet from the faction colour and ink */
const shadowGrey = (f: FactionId) => mix(look(f).primaryDark, mat.ink, 0.45);

/** Schattenkommando: geduckt, Kapuze, Karabiner, Sprengsatz am Guertel / Shadow Commando: crouched, hood, carbine, charge on the belt */
export function shadowCommando(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d = lite ? 1 : 2;
  const G: V3 = [0.04, 0.17, 0.07];
  const D: V3 = [-0.2, 0.05, 1];
  const grey = shadowGrey(f);
  soldier(b, f, {
    ...standPose([[G[0] - 0.08, G[1] - 0.01, G[2] + 0.06], G]),
    pelvis: [0, 0.135, -0.01],
    footL: [-0.06, 0.034, 0.06],
    footR: [0.055, 0.034, -0.05],
    twist: [0.25, 0.3, 0],
    head: [0.15, -0.25, 0],
  }, { detail: d, coat: true, coatColor: grey, seed: 83, pack: 'none' });
  rifle(b, G, D, { len: 0.22, detail: d });
  // Kapuze ueber dem Helm und Halstuch in Fraktionsfarbe / hood over the helmet and neckerchief in faction colour
  b.add(geo.hemi(0.068, lite ? 8 : 12, 4), grey, { p: [0.012, 0.27, -0.008], s: [1, 1.05, 1.12], r: [0.25, 0.3, 0] });
  b.add(geo.rbox(0.1, 0.02, 0.08, 0.008), L.primary, { p: [0, 0.248, 0.01], r: [0.2, 0.3, 0] });
  // Augenschlitz-Brille / eye-slit goggles
  b.box(0.07, 0.01, 0.01, mat.gold, [0.02, 0.29, 0.06], [0, 0.3, 0]);
  if (!lite) {
    // Sprengsatz mit Zuender am Guertel, Schneidzange / charge with a detonator on the belt, wire cutters
    b.add(geo.rbox(0.05, 0.035, 0.03, 0.006), mat.darkMid, { p: [-0.07, 0.14, 0.05] });
    b.box(0.052, 0.008, 0.032, mat.red, [-0.07, 0.16, 0.05]);
    b.tube([-0.05, 0.15, 0.06], [-0.02, 0.12, 0.07], 0.003, 4, mat.yellow);
    b.add(geo.cbox(0.012, 0.05, 0.012, 0.003), mat.metal, { p: [0.07, 0.13, -0.05], r: [0.3, 0, 0.2] });
    addEmblem(b, f, 0.018, 0.003, L.emblem, { p: [-0.075, 0.22, 0.03], r: [0, -0.5, 0] });
  }
  return b;
}

/** Nebelkutter: flaches, getarntes Boot mit Tarnnetz, Nebelwerfern und niedriger Bruecke / Fog Cutter: flat camouflaged boat with a camo net, smoke throwers and a low bridge */
export function fogCutter(f: FactionId, carried: THREE.BufferGeometry | null): Builder {
  const b = new Builder();
  const L = look(f);
  const grey = shadowGrey(f);
  const len = 0.64, w = 0.26, top = 0.055;
  // spitzer, flacher Rumpf (Keilbug) / pointed, flat hull (wedge bow)
  const outline: [number, number][] = [[-w / 2, -len / 2], [w / 2, -len / 2], [w / 2, len / 4], [0, len / 2], [-w / 2, len / 4]];
  b.add(geo.prismXZ(outline, 0.04), mat.ink, { p: [0, -0.02, 0] });
  b.add(geo.prismXZ(outline.map(([x, z]) => [x * 0.93, z * 0.95]), top), grey, { p: [0, -0.005, 0] });
  b.add(geo.prismXZ(outline.map(([x, z]) => [x * 0.82, z * 0.86]), 0.006), shade(grey, 1.25), { p: [0, top - 0.004, 0] });
  // Wasserlinie in Fraktionsfarbe / waterline in faction colour
  b.add(geo.prismXZ(outline.map(([x, z]) => [x * 0.96, z * 0.97]), 0.008), L.primary, { p: [0, 0.012, 0] });
  // flache Bruecke mit dunklen Scheiben / low bridge with dark windows
  b.add(geo.cbox(0.13, 0.05, 0.1, 0.012), shade(grey, 0.9), { p: [0, top + 0.025, -0.12] });
  b.block(0, top + 0.03, -0.12, 0.134, 0.016, 0.104, mat.glassDark);
  b.block(0, top + 0.05, -0.12, 0.14, 0.008, 0.11, L.trim);
  // Tarnnetz ueber dem Heck (Flicken) / camo net over the stern (patches)
  for (const [x, z, r] of [[-0.06, -0.24, 0.05], [0.06, -0.22, 0.045], [0, -0.27, 0.04]] as [number, number, number][]) {
    b.add(geo.cyl(r, r * 1.1, 0.012, 7), mix(grey, mat.leafDark, 0.35), { p: [x, top + 0.008, z], s: [1, 1, 0.8] });
  }
  // Nebelwerfer: zwei Rohre am Heck / smoke throwers: two tubes at the stern
  for (const s of [-1, 1]) {
    b.cyl(0.012, 0.014, 0.05, 8, mat.darkMid, [s * 0.09, top + 0.03, -0.27], [-0.6, 0, s * 0.3]);
    b.add(geo.sphere(0.02, 6, 4), mat.cloud, { p: [s * 0.1, top + 0.07, -0.3] });
  }
  // Mast mit Antenne und Gold-Wimpel / mast with antenna and gold pennant
  b.cyl(0.004, 0.005, 0.14, 4, mat.dark, [0, top + 0.12, -0.12]);
  b.add(geo.profileZY([[0, 0], [-0.05, -0.01], [0, -0.02]], 0.003), mat.gold, { p: [0, top + 0.18, -0.12] });
  addEmblem(b, f, 0.03, 0.005, L.emblem, { p: [w / 2 - 0.01, 0.035, 0.0], r: [0, HALF_PI, 0] });
  // Ladung / cargo
  if (carried) b.addColored(carried, { p: [0, top, 0.08], s: 0.5 });
  else b.add(geo.cbox(0.07, 0.04, 0.07, 0.01), L.gear, { p: [0, top + 0.02, 0.08] });
  return b;
}

/** Lenkflugkoerper: Rakete mit Leitwerk auf kurzem Startschlitten / Guided Missile: rocket with fins on a short launch sled */
export function guidedMissile(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const y = 0.16;
  // Startschlitten mit zwei Kufen / launch sled with two skids
  for (const s of [-1, 1]) b.add(geo.cbox(0.02, 0.02, 0.3, 0.005), mat.darkMid, { p: [s * 0.06, 0.012, 0] });
  for (const z of [-0.1, 0.08]) b.box(0.14, 0.014, 0.02, mat.dark, [0, 0.03, z]);
  b.tube([0, 0.035, -0.1], [0, y - 0.03, -0.06], 0.008, 5, mat.metal);
  b.tube([0, 0.035, 0.08], [0, y - 0.03, 0.06], 0.008, 5, mat.metal);
  // Rumpf liegend in +z, weiss mit Goldband, Spitze in Fraktionsfarbe / body lying along +z, white with a gold band, nose in faction colour
  b.cyl(0.04, 0.045, 0.3, lite ? 8 : 14, mat.white, [0, y, -0.02], [HALF_PI, 0, 0]);
  b.cyl(0.046, 0.046, 0.04, lite ? 8 : 14, mat.gold, [0, y, 0.06], [HALF_PI, 0, 0]);
  b.add(geo.cone(0.04, 0.11, lite ? 8 : 14), L.primary, { p: [0, y, 0.185], r: [HALF_PI, 0, 0] });
  // Leitwerk am Heck, Duese / tail fins, nozzle
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.box(0.006, 0.07, 0.06, L.primaryDark, [Math.sin(a) * 0.05, y + Math.cos(a) * 0.05, -0.14], [0, 0, -a]);
  }
  b.cyl(0.032, 0.026, 0.03, 8, mat.dark, [0, y, -0.185], [HALF_PI, 0, 0]);
  if (!lite) {
    // Suchkopf-Fenster und Warnstreifen / seeker window and warning stripe
    b.add(geo.sphere(0.012, 6, 4), mat.glassDark, { p: [0, y + 0.02, 0.2] });
    b.box(0.006, 0.08, 0.02, mat.red, [0.042, y, 0.0]);
    addEmblem(b, f, 0.022, 0.003, L.emblem, { p: [-0.046, y, -0.05], r: [0, -HALF_PI, 0] });
  }
  return b;
}

/** Radarwagen: leichter Wagen mit Kabine und drehbarer Radarschuessel (Turm) / Radar Truck: light truck with a cab and a rotating radar dish (turret) */
export function radarTruck(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const wr = 0.052;
  for (const x of [-0.115, 0.115]) for (const z of [-0.14, 0.02, 0.15]) wheel(b, x, wr, z, wr, 0.04, { rim: L.trim, lite });
  // Fahrgestell, Kabine vorn, Kofferaufbau hinten / chassis, cab at the front, box body at the back
  b.box(0.2, 0.035, 0.4, L.hullDark, [0, wr + 0.012, 0]);
  const by = wr + 0.03;
  b.add(geo.cbox(0.2, 0.09, 0.11, 0.015), L.hull, { p: [0, by + 0.045, 0.14] });
  b.block(0, by + 0.05, 0.196, 0.18, 0.04, 0.006, mat.glassDark);
  b.add(geo.cbox(0.21, 0.1, 0.24, 0.012), shadowGrey(f), { p: [0, by + 0.05, -0.06] });
  b.block(0, by + 0.1, -0.06, 0.215, 0.008, 0.245, L.trim);
  for (const z of [-0.14, -0.06, 0.02]) b.box(0.214, 0.06, 0.006, shade(shadowGrey(f), 0.8), [0, by + 0.05, z]);
  addEmblem(b, f, 0.03, 0.005, L.emblem, { p: [0.107, by + 0.05, -0.06], r: [0, HALF_PI, 0] });
  // Schuessel auf Drehkranz (Turm: zeigt zum Ziel) / dish on a turntable (turret: points at the target)
  const ty = by + 0.105;
  b.turret([0, ty, -0.06], () => {
    b.cyl(0.035, 0.04, 0.025, lite ? 8 : 12, mat.darkMid, [0, ty + 0.012, -0.06]);
    b.tube([0, ty + 0.02, -0.06], [0, ty + 0.1, -0.05], 0.009, 5, mat.metal);
    // Schuessel nach +z geneigt / dish tilted towards +z
    b.add(geo.hemi(0.09, lite ? 10 : 16, 4), mat.white, { p: [0, ty + 0.13, -0.04], r: [-HALF_PI + 0.5, 0, 0], s: [1, 0.35, 1] });
    b.tube([0, ty + 0.13, -0.035], [0, ty + 0.15, 0.03], 0.004, 4, mat.dark);
    b.add(geo.sphere(0.012, 6, 4), L.primary, { p: [0, ty + 0.152, 0.035] });
  });
  // Antennen und Generator / antennas and generator
  if (!lite) {
    b.tube([-0.09, by + 0.1, -0.16], [-0.09, by + 0.26, -0.17], 0.003, 4, mat.dark);
    b.tube([0.09, by + 0.1, -0.16], [0.09, by + 0.22, -0.17], 0.003, 4, mat.dark);
    b.add(geo.cbox(0.05, 0.04, 0.05, 0.008), mat.darkMid, { p: [0.06, by + 0.12, 0.08] });
  }
  return b;
}

/** Raketensilo: Betonring, Silodeckel halb offen, Rakete mit Goldspitze, Kontrollkasten, Antenne, Fahne / rocket silo: concrete ring, hatch half open, rocket with a gold tip, control box, antenna, flag */
export function siloGeometry(f: FactionId): THREE.BufferGeometry {
  return memo(`silo|${f}`, () => {
    const L = look(f);
    const b = new Builder();
    const grey = shadowGrey(f);
    // flache Erdaufschuettung und Betonring / low earth berm and concrete ring
    b.add(geo.cyl(0.44, 0.47, 0.035, 14), shade(mat.sand, 0.7), { p: [0, 0.018, 0] });
    b.add(geo.cyl(0.3, 0.33, 0.1, 16), mix(mat.concreteDark, grey, 0.3), { p: [0, 0.085, 0] });
    b.add(geo.cyl(0.25, 0.25, 0.012, 16), mat.ink, { p: [0, 0.137, 0] });
    // Warnring in Gold und Fraktionsfarbe / warning ring in gold and faction colour
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.box(0.08, 0.016, 0.03, i % 2 ? mat.gold : L.primary, [Math.sin(a) * 0.29, 0.135, Math.cos(a) * 0.29], [0, a, 0]);
    }
    // Deckel aufgeklappt (zwei Haelften) / hatch opened (two halves)
    for (const s of [-1, 1]) {
      b.group({ p: [s * 0.26, 0.14, 0], r: [0, 0, s * 1.15] }, () => {
        b.add(geo.cbox(0.25, 0.03, 0.46, 0.02), grey, { p: [-s * 0.125, 0.015, 0] });
        b.box(0.2, 0.006, 0.05, L.primary, [-s * 0.125, 0.032, 0]);
      });
    }
    // Rakete im Schacht / rocket in the shaft
    b.cyl(0.075, 0.08, 0.34, 14, mat.white, [0, 0.27, 0]);
    b.cyl(0.082, 0.082, 0.05, 14, mat.gold, [0, 0.34, 0]);
    b.add(geo.cone(0.075, 0.16, 14), L.primary, { p: [0, 0.52, 0] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      b.box(0.01, 0.08, 0.07, L.primaryDark, [Math.sin(a) * 0.085, 0.16, Math.cos(a) * 0.085], [0, a, 0]);
    }
    b.box(0.006, 0.14, 0.02, mat.red, [0.078, 0.27, 0]);
    // Kontrollkasten, Antenne, Kabel / control box, antenna, cable
    b.add(geo.cbox(0.1, 0.08, 0.07, 0.012), mat.darkMid, { p: [-0.32, 0.075, -0.22] });
    b.box(0.06, 0.02, 0.006, mat.windowLit, [-0.32, 0.095, -0.184]);
    b.tube([-0.34, 0.11, -0.24], [-0.34, 0.42, -0.25], 0.004, 4, mat.dark);
    b.tube([-0.28, 0.05, -0.2], [-0.2, 0.13, -0.14], 0.006, 4, mat.ink);
    addEmblem(b, f, 0.04, 0.006, L.emblem, { p: [0, 0.09, 0.335] });
    return b.build();
  });
}
