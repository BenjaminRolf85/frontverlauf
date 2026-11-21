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
import { Builder, fine, geo, memo, mix, shade, type ColorLike, type LathePoint, type V3 } from './kit';
import { look, mat, type Look } from './look';
import { face } from './headgear';
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
  // Lesbarkeit: tief geduckt (Becken auf Kniehoehe, deutlich niedriger als der Schuetze) mit grossem Sprengrucksack als Buckel
  // readability: deep crouch (pelvis at knee height, clearly lower than the rifleman) with a big demolition pack as a hump
  const dy = -0.06;
  const G: V3 = [0.04, 0.17 + dy, 0.07];
  const D: V3 = [-0.2, 0.05, 1];
  const grey = shadowGrey(f);
  soldier(b, f, {
    ...standPose([[G[0] - 0.08, G[1] - 0.01, G[2] + 0.06], G]),
    pelvis: [0, 0.135 + dy, -0.01],
    footL: [-0.075, 0.034, 0.08],
    footR: [0.07, 0.034, -0.07],
    kneePoleL: [-0.3, 0.2, 1],
    kneePoleR: [0.3, 0.2, 1],
    twist: [0.25, 0.3, 0],
    head: [0.15, -0.25, 0],
  }, { detail: d, coat: true, coatColor: grey, seed: 83, pack: 'none' });
  rifle(b, G, D, { len: 0.22, detail: d });
  // Kapuze ueber dem Helm und Halstuch in Fraktionsfarbe / hood over the helmet and neckerchief in faction colour
  // Kapuze und Brille passen zum kleineren Kopf der Fusstruppen (HEAD_FOOT) / hood and goggles fit the smaller foot-troop head (HEAD_FOOT)
  b.add(geo.hemi(0.054, lite ? 8 : 12, 4), grey, { p: [0.01, 0.27 + dy, -0.006], s: [1, 1.1, 1.12], r: [0.25, 0.3, 0] });
  b.add(geo.rbox(0.085, 0.02, 0.07, 0.008), L.primary, { p: [0, 0.255 + dy, 0.01], r: [0.2, 0.3, 0] });
  // Augenschlitz-Brille / eye-slit goggles
  b.box(0.058, 0.01, 0.01, mat.gold, [0.018, 0.282 + dy, 0.05], [0, 0.3, 0]);
  // Sprengrucksack mit Zuendkabelrolle / demolition pack with a detonator cable reel
  b.group({ p: [-0.01, 0.2 + dy, -0.1], r: [0.45, 0.3, 0] }, () => {
    b.add(geo.rbox(0.19, 0.14, 0.1, 0.022), mat.darkMid, {});
    b.add(geo.rbox(0.195, 0.03, 0.105, 0.01), L.primary, { p: [0, 0.035, 0] });
    if (!lite && fine()) {
      b.cyl(0.032, 0.032, 0.05, 12, mat.wood, [0, 0.085, -0.005], [0, 0, HALF_PI]);
      b.cyl(0.036, 0.036, 0.008, 12, mat.dark, [-0.028, 0.085, -0.005], [0, 0, HALF_PI]);
      b.cyl(0.036, 0.036, 0.008, 12, mat.dark, [0.028, 0.085, -0.005], [0, 0, HALF_PI]);
      for (const sx of [-1, 1]) b.box(0.016, 0.145, 0.01, grey, [sx * 0.055, 0, 0.053]);
    }
  });
  if (!lite) {
    // Sprengsatz mit Zuender am Guertel, Schneidzange / charge with a detonator on the belt, wire cutters
    b.add(geo.rbox(0.05, 0.035, 0.03, 0.006), mat.darkMid, { p: [-0.07, 0.14 + dy, 0.05] });
    b.box(0.052, 0.008, 0.032, mat.red, [-0.07, 0.16 + dy, 0.05]);
    b.tube([-0.05, 0.15 + dy, 0.06], [-0.02, 0.12 + dy, 0.07], 0.003, 4, mat.yellow);
    b.add(geo.cbox(0.012, 0.05, 0.012, 0.003), mat.metal, { p: [0.07, 0.13 + dy, -0.05], r: [0.3, 0, 0.2] });
    addEmblem(b, f, 0.018, 0.003, L.emblem, { p: [-0.075, 0.22 + dy, 0.03], r: [0, -0.5, 0] });
  }
  return b;
}

/**
 * Marines (statt Infanterie, Elitetruppe): breiter gebaut als der Schuetze (Figur in Breite und Tiefe verstaerkt), dunkle
 * Marine-Kampfuniform aus der Fraktionsfarbe, Gefechtshelm mit Brille, Schwimmweste in Signalfarbe mit Koppelzeug,
 * kurzer Karabiner im Anschlag, kleiner Sturmrucksack. Getrennt vom Schattenkommando (geduckt, Kapuze, Grau) und vom
 * Schuetzen (Barett, Tornister, langes Gewehr). Tuschelinie: Brille und Riemen liegen buendig im Helm, keine aufgesetzten
 * Ringe oder Scheiben am Kopf (ANNAHMEN.md, Feinere Einheitenmodelle).
 * Marines (instead of infantry, elite troops): built broader than the rifleman (figure widened and deepened), dark naval
 * combat uniform from the faction colour, combat helmet with goggles, life vest in a signal colour with webbing, short
 * carbine at the ready, small assault pack. Set apart from the Shadow Commando (crouched, hood, grey) and the rifleman
 * (beret, pack, long rifle). Ink line: goggles and strap sit flush in the helmet, no rings or discs set on the head
 * (ANNAHMEN.md, finer unit models).
 */
export function marine(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d = lite ? 1 : 2;
  // Marine-Blau aus der Fraktionsfarbe (Meridon: tiefes Petrol), Weste in der Signalfarbe der Fraktion (Meridon: Orange)
  // naval blue from the faction colour (Meridon: deep petrol), vest in the faction's signal colour (Meridon: orange)
  const navy = mix(mix(L.primaryDark, mat.blue, 0.4), mat.ink, 0.48);
  const navyDark = shade(navy, 0.72);
  const vest = L.secondary;
  const web = mat.darkMid;
  // Anschlag: Karabiner an der Schulter, breiter Stand, leicht vorgebeugt / at the ready: carbine at the shoulder, wide stance, leaning slightly forward
  const G: V3 = [0.035, 0.225, 0.07];
  const D: V3 = [-0.14, 0.02, 1];
  const n = Math.hypot(D[0], D[1], D[2]);
  const fore: V3 = [G[0] + (D[0] / n) * 0.1, G[1] + (D[1] / n) * 0.1, G[2] + (D[2] / n) * 0.1];
  const pelvis: V3 = [0, 0.15, -0.01];
  const twist: V3 = [0.14, 0.18, 0];
  // breiter und tiefer gebaut als der Schuetze (Elite, schwere Ausruestung) / built broader and deeper than the rifleman (elite, heavy gear)
  b.group({ p: [0, 0, -0.035], s: [1.13, 1, 1.1] }, () => {
    soldier(b, f, {
      ...standPose([fore, G]),
      pelvis,
      footL: [-0.068, 0.034, 0.06],
      footR: [0.066, 0.034, -0.055],
      bootR: [0, 0.32, 0],
      kneePoleL: [-0.15, 0, 1],
      twist,
      head: [0.1, -0.16, 0],
      elbowPoleL: [-0.9, -0.5, 0.1],
    }, { detail: d, pack: 'none', seed: 57, plain: true, colors: { jacket: navy, pants: navyDark, gear: web }, head: (bb, _L, dd) => marineHelmet(bb, L, dd, navy) });
    rifle(b, G, D, { len: 0.235, back: 0.07, detail: d, heavy: 1.2 });
    // Schwimmweste mit Koppelzeug, folgt dem Oberkoerper / life vest with webbing, follows the torso
    b.group({ p: [pelvis[0], pelvis[1] + 0.02, pelvis[2]], r: twist }, () => {
      b.add(d === 2 ? geo.ctaper(0.172, 0.114, 0.194, 0.128, 0.092, 0.022) : geo.taper(0.172, 0.114, 0.194, 0.128, 0.092), vest, { p: [0, 0.063, 0] });
      // Kragenwulst hinter dem Nacken (Auftriebskissen) / collar roll behind the neck (buoyancy pad)
      b.add(geo.rbox(0.13, 0.038, 0.05, 0.016), shade(vest, 0.9), { p: [0, 0.118, -0.03] });
      // Reissverschluss, Koppeltraeger, Magazintaschen / zip, harness straps, magazine pouches
      b.box(0.01, 0.09, 0.008, shade(vest, 0.6), [0, 0.063, 0.066]);
      for (const sx of [-1, 1]) b.box(0.016, 0.1, 0.01, web, [sx * 0.045, 0.066, 0.066]);
      b.box(0.2, 0.018, 0.134, web, [0, 0.016, 0]);
      if (d === 2) {
        for (const x of [-0.05, 0, 0.05]) b.add(geo.rbox(0.03, 0.036, 0.02, 0.006), navyDark, { p: [x, 0.035, 0.07] });
        // Signalleuchte und Pfeife an der Weste / strobe light and whistle on the vest
        b.box(0.018, 0.024, 0.012, mat.yellow, [-0.045, 0.108, 0.064]);
        b.box(0.014, 0.01, 0.012, mat.metalLight, [0.045, 0.108, 0.064]);
      }
      // kleiner Sturmrucksack mit Seil / small assault pack with a rope
      b.add(d === 2 ? geo.rbox(0.13, 0.11, 0.05, 0.016) : geo.box(0.13, 0.11, 0.05), navyDark, { p: [0, 0.06, -0.09] });
      if (d === 2) b.add(geo.torus(0.028, 0.009, 4, 10), mat.sand, { p: [0, 0.045, -0.118], r: [0, 0, 0] });
      if (d === 2) addEmblem(b, f, 0.016, 0.003, L.emblem, { p: [0.05, 0.095, 0.067] });
    });
  });
  return b;
}

/**
 * Gefechtshelm der Marines: flache Kuppel in Marine-Blau, Brille auf der Stirn buendig im Helm, Riemen an den Seiten in
 * der Westenfarbe, Gesicht darunter. / Marine combat helmet: flat dome in naval blue, goggles on the brow flush in the
 * helmet, side straps in the vest colour, face below.
 */
function marineHelmet(b: Builder, L: Look, d: 0 | 1 | 2, navy: ColorLike) {
  face(b, d, 'none', 57);
  const helm = shade(navy, 0.92);
  const ws = d === 2 ? 14 : 10, hs = d === 2 ? 5 : 3;
  b.add(geo.hemi(0.068, ws, hs), helm, { p: [0, 0.068, -0.004], s: [1.05, 0.9, 1.1] });
  // Nackenschutz hinten, buendig unter der Kuppel / neck guard at the back, flush below the dome
  b.add(geo.rbox(0.11, 0.022, 0.03, 0.008), shade(helm, 0.85), { p: [0, 0.066, -0.054] });
  // Brille: Rahmen halb in der Kuppel, zwei Glaeser, Band an den Seiten / goggles: frame half inside the dome, two lenses, strap at the sides
  b.add(geo.rbox(0.086, 0.026, 0.03, 0.009), mat.dark, { p: [0, 0.092, 0.052], r: [-0.3, 0, 0] });
  for (const sx of [-1, 1]) {
    b.box(0.03, 0.016, 0.012, mat.glassDark, [sx * 0.021, 0.094, 0.066], [-0.3, 0, 0]);
    b.box(0.012, 0.016, 0.05, L.secondary, [sx * 0.069, 0.084, 0.004]);
  }
  // Kinnriemen / chin strap
  if (d === 2) for (const sx of [-1, 1]) b.box(0.006, 0.05, 0.012, mat.dark, [sx * 0.052, 0.045, 0.012]);
}

/**
 * Nebelkutter: flaches, getarntes Boot mit Tarnnetz, Nebelwerfern und niedriger Bruecke. Feinschliff (vorher rund 700
 * Dreiecke, eine flache Platte): gestufter Rumpf mit Scheuerleiste und Fendern, Cockpit mit schraeger Scheibe, Bord-MG,
 * zwei Aussenborder mit Schraube, Reling, Tarnnetz mit Leinen, Mast mit Radarbalken.
 * Fog Cutter: flat camouflaged boat with a camo net, smoke throwers and a low bridge. Polish (before about 700 triangles,
 * one flat slab): stepped hull with a rubbing strake and fenders, cockpit with a sloped screen, deck MG, two outboard
 * motors with propellers, rail, camo net with lines, mast with a radar bar.
 */
export function fogCutter(f: FactionId, carried: THREE.BufferGeometry | null): Builder {
  const b = new Builder();
  const L = look(f);
  const grey = shadowGrey(f);
  const len = 0.64, w = 0.26, top = 0.055;
  // spitzer, flacher Rumpf (Keilbug), gestuft: Kiel, Rumpf, Scheuerleiste, Deck / pointed, flat hull (wedge bow), stepped: keel, hull, strake, deck
  const outline: [number, number][] = [[-w / 2, -len / 2], [w / 2, -len / 2], [w / 2, len / 4], [w * 0.36, len * 0.4], [0, len / 2], [-w * 0.36, len * 0.4], [-w / 2, len / 4]];
  const at = (k: number, kz = k) => outline.map(([x, z]) => [x * k, z * kz] as [number, number]);
  b.add(geo.prismXZ(at(0.86, 0.94), 0.04), mat.ink, { p: [0, -0.02, 0] });
  b.add(geo.prismXZ(at(0.93, 0.95), top - 0.012), grey, { p: [0, -0.005, 0] });
  b.add(geo.prismXZ(at(0.95, 0.965), 0.012), shade(grey, 0.75), { p: [0, top - 0.017, 0] });
  b.add(geo.prismXZ(at(0.86, 0.9), 0.006), shade(grey, 1.25), { p: [0, top - 0.004, 0] });
  // Wasserlinie in Fraktionsfarbe / waterline in faction colour
  b.add(geo.prismXZ(at(0.96, 0.97), 0.008), L.primary, { p: [0, 0.012, 0] });
  // rutschfeste Deckfelder / non-slip deck panels
  for (const z of [0.02, 0.12]) b.add(geo.cbox(0.17, 0.004, 0.07, 0.008), shade(grey, 1.05), { p: [0, top + 0.002, z] });
  // Fender (Reifen) an den Flanken / fenders (tyres) on the flanks
  const lo = !fine();
  for (const s of [-1, 1]) for (const z of [-0.2, -0.06, 0.08]) b.cyl(0.016, 0.016, 0.014, lo ? 6 : 10, mat.dark, [s * (w / 2 - 0.002), 0.03, z], [0, 0, HALF_PI]);
  // Reling aus Pfosten und Handlauf / rail of posts and a handrail
  for (const s of [-1, 1]) {
    b.box(0.004, 0.004, 0.36, mat.metal, [s * w * 0.43, top + 0.028, -0.04]);
    if (!lo) for (let k = 0; k <= 5; k++) b.box(0.004, 0.028, 0.004, mat.metal, [s * w * 0.43, top + 0.014, -0.22 + k * 0.072]);
  }
  // flache Bruecke mit schraeger Scheibe und Dachluke / low bridge with a sloped screen and a roof hatch
  b.add(geo.cbox(0.13, 0.05, 0.1, 0.012), shade(grey, 0.9), { p: [0, top + 0.025, -0.12] });
  b.add(geo.taper(0.136, 0.03, 0.12, 0.012, 0.03, -0.01), mat.glassDark, { p: [0, top + 0.035, -0.06] });
  b.block(0, top + 0.05, -0.12, 0.14, 0.008, 0.11, L.trim);
  b.add(geo.cyl(0.022, 0.024, 0.008, 10), shade(grey, 0.75), { p: [0.03, top + 0.06, -0.14] });
  // Bord-MG auf Drehring vor der Bruecke / deck MG on a ring mount in front of the bridge
  b.cyl(0.018, 0.02, 0.012, 10, mat.darkMid, [-0.035, top + 0.066, -0.1]);
  b.add(geo.cbox(0.018, 0.022, 0.06, 0.004), mat.dark, { p: [-0.035, top + 0.082, -0.085] });
  b.cyl(0.0045, 0.0045, 0.06, 6, mat.dark, [-0.035, top + 0.084, -0.03], [HALF_PI, 0, 0]);
  // zwei Aussenborder mit Haube, Schaft und Schraube / two outboard motors with cowl, shaft and propeller
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.045, 0.05, 0.05, 0.012), mat.darkMid, { p: [s * 0.06, top + 0.02, -len / 2 - 0.01] });
    b.box(0.047, 0.008, 0.052, L.primary, [s * 0.06, top + 0.03, -len / 2 - 0.01]);
    b.box(0.014, 0.05, 0.02, mat.dark, [s * 0.06, top - 0.03, -len / 2 - 0.02]);
    b.cyl(0.012, 0.012, 0.012, 8, mat.dark, [s * 0.06, 0.0, -len / 2 - 0.03], [HALF_PI, 0, 0]);
    if (!lo) for (const a of [0, Math.PI / 1.5, Math.PI / 0.75]) b.box(0.006, 0.026, 0.004, mat.metal, [s * 0.06 + Math.sin(a) * 0.01, Math.cos(a) * 0.01, -len / 2 - 0.038], [0, 0, a]);
  }
  // Tarnnetz ueber dem Heck mit Leinen / camo net over the stern with lines
  const net = mix(grey, mat.leafDark, 0.35);
  for (const [x, z, r] of [[-0.06, -0.24, 0.05], [0.06, -0.22, 0.045], [0, -0.27, 0.04], [-0.02, -0.19, 0.035]] as [number, number, number][]) {
    b.add(geo.cyl(r, r * 1.1, 0.012, 9), net, { p: [x, top + 0.008, z], s: [1, 1, 0.8] });
  }
  for (const s of [-1, 1]) b.tube([s * 0.09, top + 0.012, -0.26], [s * 0.11, top + 0.002, -0.3], 0.002, 3, mat.sand);
  // Nebelwerfer: zwei Rohre am Heck / smoke throwers: two tubes at the stern
  for (const s of [-1, 1]) {
    b.cyl(0.012, 0.014, 0.05, 8, mat.darkMid, [s * 0.09, top + 0.03, -0.27], [-0.6, 0, s * 0.3]);
    b.add(geo.sphere(0.02, 8, 4), mat.cloud, { p: [s * 0.1, top + 0.07, -0.3] });
  }
  // Mast mit Radarbalken, Antenne und Gold-Wimpel / mast with a radar bar, antenna and gold pennant
  b.cyl(0.004, 0.005, 0.14, 4, mat.dark, [0, top + 0.12, -0.12]);
  b.box(0.07, 0.008, 0.008, mat.white, [0, top + 0.13, -0.12], [0, 0.5, 0]);
  b.add(geo.profileZY([[0, 0], [-0.05, -0.01], [0, -0.02]], 0.003), mat.gold, { p: [0, top + 0.18, -0.12] });
  // Bugmarke: Kennnummer in Gold / bow mark: hull number in gold
  for (const s of [-1, 1]) b.box(0.004, 0.014, 0.04, mat.gold, [s * (w * 0.37), 0.035, len * 0.33], [0, s * 0.5, 0]);
  addEmblem(b, f, 0.03, 0.005, L.emblem, { p: [w / 2 - 0.01, 0.035, 0.0], r: [0, HALF_PI, 0] });
  // Ladung / cargo
  if (carried) b.addColored(carried, { p: [0, top, 0.08], s: 0.5 });
  else b.add(geo.cbox(0.07, 0.04, 0.07, 0.01), L.gear, { p: [0, top + 0.02, 0.08] });
  return b;
}

/**
 * Lenkflugkoerper: Rakete mit Leitwerk auf einem kurzen Startwagen mit schraeger Startschiene. Feinschliff (vorher das
 * groebste Einheitenmodell mit rund 650 Dreiecken): gedrehter Rumpf mit spitzer Nase, Leitwerk aus Profilen, Duese mit
 * dunkler Bohrung, zweiachsiger Wagen mit Stuetzen, Hubzylinder und Kabeltrommel.
 * Guided Missile: rocket with fins on a short launch trailer with a sloped launch rail. Polish (before the coarsest unit
 * model at about 650 triangles): turned body with a pointed nose, fins from profiles, nozzle with a dark bore, two-axle
 * trailer with outriggers, lifting ram and cable drum.
 */
export function guidedMissile(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const grey = shadowGrey(f);
  // niedrige Qualitaet: weniger Segmente und ohne Kleinteile / low quality: fewer segments and without small parts
  const lo = lite || !fine();
  const seg = lo ? 8 : 16;
  // Startwagen: Rahmen, zwei Achsen, Stuetzen mit Tellern / launch trailer: frame, two axles, outriggers with pads
  const wr = 0.036;
  for (const x of [-0.085, 0.085]) for (const z of [-0.1, 0.07]) wheel(b, x, wr, z, wr, 0.03, { rim: L.trim, lite: lo });
  b.add(geo.cbox(0.15, 0.028, 0.34, 0.008), grey, { p: [0, wr + 0.02, -0.02] });
  b.add(geo.cbox(0.12, 0.016, 0.3, 0.005), shade(grey, 0.8), { p: [0, wr + 0.041, -0.02] });
  for (const z of [-0.1, 0.07]) b.cyl(0.008, 0.008, 0.2, 6, mat.dark, [0, wr, z], [0, 0, HALF_PI]);
  for (const sx of [-1, 1]) for (const z of [-0.17, 0.13]) {
    b.tube([sx * 0.07, wr + 0.02, z], [sx * 0.11, 0.012, z], 0.007, lo ? 4 : 5, mat.darkMid);
    b.cyl(0.016, 0.018, 0.008, lo ? 6 : 8, mat.dark, [sx * 0.11, 0.004, z]);
  }
  // Warnstreifen an Bug und Heck des Wagens / hazard stripes at both ends of the trailer
  for (const z of [-0.19, 0.15]) {
    b.box(0.13, 0.02, 0.006, mat.ink, [0, wr + 0.02, z]);
    if (!lo) for (let k = 0; k < 4; k++) b.box(0.016, 0.022, 0.008, mat.yellow, [-0.045 + k * 0.03, wr + 0.02, z], [0, 0, 0.6]);
  }
  // Startschiene, schraeg nach vorn oben, mit Hubzylinder / launch rail sloping up to the front, with a lifting ram
  const rp: V3 = [0, wr + 0.06, -0.16], ang = 0.3;
  b.tube([0, wr + 0.05, 0.08], [0, wr + 0.1, 0.06], 0.012, 8, mat.metal);
  b.tube([0, wr + 0.05, 0.08], [0, wr + 0.07, 0.07], 0.016, 8, mat.darkMid);
  b.group({ p: rp, r: [-ang, 0, 0] }, () => {
    b.add(geo.cbox(0.05, 0.022, 0.36, 0.006), mat.darkMid, { p: [0, 0, 0.17] });
    for (const sx of [-1, 1]) b.box(0.008, 0.02, 0.34, mat.dark, [sx * 0.022, 0.018, 0.17]);
    for (const z of [0.07, 0.26]) b.add(geo.cbox(0.04, 0.022, 0.03, 0.005), mat.dark, { p: [0, 0.026, z] });
    // Rumpf als Drehkoerper (y-Achse auf +z gedreht): Duese hinten, Nase vorn / body as a turned part (y axis turned to +z): nozzle at the rear, nose at the front
    const my = 0.072;
    b.group({ p: [0, my, 0.02], r: [HALF_PI, 0, 0] }, () => {
      const body: LathePoint[] = [
        [0.0, 0.0], [0.026, 0.0, true], [0.03, 0.03, true], [0.04, 0.035, true], [0.042, 0.07], [0.042, 0.24], [0.04, 0.27],
        [0.034, 0.3], [0.022, 0.33], [0.009, 0.352], [0.0, 0.36],
      ];
      b.add(geo.lathe(body, seg, [0, 4]), mat.dark, {});
      b.add(geo.lathe(body, seg, [4, 5]), mat.white, {});
      b.add(geo.lathe(body, seg, [5, 10]), L.primary, {});
      // Goldband und Fugen / gold band and seams
      b.add(drumBand(0.0425, 0.03, seg), mat.gold, { p: [0, 0.17, 0] });
      if (!lo) for (const y of [0.1, 0.22]) b.add(drumBand(0.0425, 0.004, seg), mat.ink, { p: [0, y, 0] });
      // Duese mit dunkler Bohrung / nozzle with a dark bore
      b.add(geo.cyl(0.02, 0.02, 0.006, seg), mat.ink, { p: [0, 0.002, 0] });
    });
    // Leitwerk: vier gepfeilte Flossen hinten, vier kleine Ruder vorn / tail: four swept fins at the rear, four small canards at the front
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      b.group({ p: [0, my, 0.02], r: [0, 0, -a] }, () => {
        b.add(geo.profileZY([[0.06, 0.04], [0.135, 0.04], [0.12, 0.1], [0.075, 0.1]], 0.006), L.primaryDark, {});
        if (!lo) b.add(geo.profileZY([[0.26, 0.04], [0.29, 0.04], [0.285, 0.065], [0.27, 0.065]], 0.005), L.primaryDark, {});
      });
    }
    if (!lo) {
      // Suchkopf-Fenster, Warnstreifen, Emblem / seeker window, warning stripe, emblem
      b.add(geo.sphere(0.011, 8, 4), mat.glassDark, { p: [0, my + 0.024, 0.34] });
      b.box(0.006, 0.05, 0.02, mat.red, [0.042, my, 0.13]);
      addEmblem(b, f, 0.022, 0.003, L.emblem, { p: [-0.043, my, 0.12], r: [0, -HALF_PI, 0] });
    }
  });
  // Steuerkasten mit Kabeltrommel / control box with a cable drum
  b.add(geo.cbox(0.05, 0.04, 0.05, 0.008), L.trim, { p: [0.05, wr + 0.07, 0.11] });
  if (!lo) {
    b.box(0.03, 0.012, 0.004, mat.glassDark, [0.05, wr + 0.075, 0.137]);
    b.cyl(0.024, 0.024, 0.03, 12, mat.dark, [-0.05, wr + 0.07, 0.11], [0, 0, HALF_PI]);
    b.cyl(0.018, 0.018, 0.032, 12, mat.yellow, [-0.05, wr + 0.07, 0.11], [0, 0, HALF_PI]);
    b.tube([-0.05, wr + 0.07, 0.09], [0, wr + 0.09, -0.02], 0.003, 4, mat.ink);
  }
  return b;
}

/** Schmales Band um einen Rumpf (offener Zylinder, keine Deckel) / narrow band around a body (open cylinder, no caps) */
function drumBand(r: number, h: number, seg: number): THREE.BufferGeometry {
  return geo.cyl(r, r, h, seg, true);
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
  const ty = by + 0.105, rz = -0.1;
  b.turret([0, ty, rz], () => {
    b.cyl(0.04, 0.046, 0.03, lite ? 8 : 12, mat.darkMid, [0, ty + 0.015, rz]);
    // Lesbarkeit: grosse Schuessel auf hohem Mast am Heck (Kennform des Radarwagens gegen Flak und Minenleger) / readability: big dish on a tall mast at the rear (the radar truck's signature against AA and mine layer)
    b.tube([0, ty + 0.025, rz], [0, ty + 0.2, rz + 0.005], 0.012, 6, mat.metal);
    if (!lite && fine()) for (const s of [-1, 1]) b.tube([s * 0.035, ty + 0.025, rz], [0, ty + 0.14, rz + 0.004], 0.005, 4, mat.dark);
    // Schuessel nach +z geneigt / dish tilted towards +z
    b.add(geo.hemi(0.165, lite || !fine() ? 10 : 18, lite || !fine() ? 3 : 4), mat.white, { p: [0, ty + 0.235, rz + 0.025], r: [-HALF_PI + 0.5, 0, 0], s: [1, 0.35, 1] });
    b.add(geo.cyl(0.03, 0.03, 0.02, lite ? 6 : 10), L.primary, { p: [0, ty + 0.235, rz + 0.015], r: [0.5 + HALF_PI, 0, 0] });
    b.tube([0, ty + 0.235, rz + 0.03], [0, ty + 0.275, rz + 0.15], 0.005, 4, mat.dark);
    b.add(geo.sphere(0.016, 8, 4), L.primary, { p: [0, ty + 0.278, rz + 0.155] });
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
