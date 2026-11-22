/**
 * Heiliges Alvenia "Orden im Feld": gemeinsame Formensprache der Alvenia-Einheiten (Hightech-Paladine, nicht mittelalterlich).
 * Weisse Panzerplatten mit Goldborten, koenigsblaue Wappenroecke und Umhaenge, duenner goldener Sonnenkranz ueber dem Helm,
 * tuerkise Leuchten an Helm und Schulterstuecken, Weihrauchfaesser, Buntglas an Fahrzeugen. Leuchtfarben (Sonnenkranz,
 * Tuerkis, Buntglas, Strahl) leuchten ueber KEYS in atmosphere.ts. Emblem: vierzackiger Stern im Sonnenkranz (emblems.ts).
 * Dazu die eigenen Bauarten (Lichtschuetzen, Reliquiar, Sonnenlanze, Goettlicher Funke), die Ordenswacht und die Gebaeude (Lichtdom, Klosterweingut).
 * Holy Alvenia "Order in the field": shared design language of the Alvenia units (high-tech paladins, not medieval).
 * White armour plates with gold trim, royal blue tabards and capes, a thin golden sun halo above the helmet, teal lights on
 * helmets and pauldrons, incense censers, stained glass on vehicles. Glow colours (halo, teal, stained glass, beam) glow via
 * KEYS in atmosphere.ts. Emblem: four-pointed star in the sun halo (emblems.ts).
 * Plus the own designs (Light Wardens, Reliquary, Sun Lance, Divine Spark), the Order Guard and the buildings (Cathedral of Light,
 * monastery vineyard).
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { semantic } from '../../design/tokens';
import { addEmblem } from './emblems';
import { Builder, col, geo, mix, shade, type V3 } from './kit';
import { mat } from './look';
import { kneelPose, soldier, standPose, type Detail } from './soldiers';
import { tracks } from './tanks';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/** Farben der Formensprache / colours of the design language */
export const FAITH = {
  plate: col(semantic.faithPlate),
  plateShade: shade(semantic.faithPlate, 0.8),
  gold: col(semantic.faithGold),
  goldLight: col(semantic.faithGoldLight),
  goldDark: shade(semantic.faithGold, 0.62),
  cloth: col(semantic.faithCloth),
  clothDeep: col(semantic.faithClothDeep),
  /** leuchten (KEYS) / glow (KEYS) */
  halo: col(semantic.faithHalo),
  tech: col(semantic.faithTech),
  glassBlue: col(semantic.faithGlassBlue),
  glassGold: col(semantic.faithGlassGold),
  beam: col(semantic.faithBeam),
};

/** Nur Alvenia selbst bekommt die Formensprache / only Alvenia itself gets the design language */
export const isFaith = (f: FactionId | 'neutral') => f === 'alvenia';

/** Duenner, leuchtender goldener Sonnenkranz (waagerecht) / thin glowing golden sun halo (horizontal) */
export function haloRing(b: Builder, p: V3, r: number, tube = 0.0045, seg = 16, tilt = 0) {
  b.add(geo.torus(r, tube, 3, seg), FAITH.halo, { p, r: [HALF_PI + tilt, 0, 0] });
}

/** Vierzackiger Goldstern (Emblem ohne Ring) / four-pointed gold star (emblem without the ring) */
export function faithStar(b: Builder, p: V3, size: number, r: V3 = [0, 0, 0], c = FAITH.gold) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 8; i++) {
    const a = HALF_PI + (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? 1 : 0.28;
    pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  b.group({ p, r }, () => b.add(geo.shapes([new THREE.Shape(pts)], 0.3), c, { s: [size, size, size] }));
}

/**
 * Weisse Brustplatte mit Goldborte, Goldstern und tuerkiser Leuchte (lokal im Oberkoerper).
 * White chest plate with gold trim, gold star and teal light (torso local).
 */
export function faithArmour(b: Builder, d: Detail) {
  b.add(d >= 1 ? geo.rtaper(0.15, 0.022, 0.165, 0.024, 0.09, 0.008) : geo.box(0.16, 0.09, 0.022), FAITH.plate, { p: [0, 0.052, 0.05] });
  b.box(0.168, 0.01, 0.026, FAITH.gold, [0, 0.098, 0.05]);
  if (d >= 1) {
    b.box(0.15, 0.008, 0.024, FAITH.gold, [0, 0.052, 0.052]);
    faithStar(b, [0, 0.074, 0.063], 0.022);
  }
  if (d === 2) b.box(0.03, 0.008, 0.006, FAITH.tech, [0, 0.03, 0.064]);
}

/**
 * Koenigsblauer Wappenrock vorn und hinten bis zum Knie mit Goldsaum (lokal im Becken).
 * Royal blue tabard front and back down to the knee with a gold hem (pelvis local).
 */
export function faithTabard(b: Builder, d: Detail) {
  for (const z of [0.052, -0.052]) {
    b.add(geo.taper(0.1, 0.008, 0.085, 0.008, 0.12), FAITH.cloth, { p: [0, -0.11, z] });
    if (d >= 1) b.box(0.1, 0.012, 0.01, FAITH.gold, [0, -0.11, z]);
  }
  if (d === 2) faithStar(b, [0, -0.06, 0.058], 0.016, [0, 0, 0], FAITH.goldLight);
}

/** Koenigsblauer Umhang mit Goldkante auf dem Ruecken (lokal im Oberkoerper) / royal blue cape with a gold edge on the back (torso local) */
export function faithCape(b: Builder, d: Detail) {
  b.add(geo.taper(0.19, 0.012, 0.15, 0.012, 0.25), FAITH.cloth, { p: [0, -0.115, -0.066], r: [0.12, 0, 0] });
  if (d >= 1) {
    b.box(0.19, 0.012, 0.016, FAITH.gold, [0, -0.118, -0.081], [0.12, 0, 0]);
    // weisser Kragen / white collar
    b.add(geo.cbox(0.17, 0.02, 0.05, 0.008), FAITH.plate, { p: [0, 0.114, -0.03] });
  }
}

/** Weisses Schulterstueck mit Goldrand und tuerkiser Leuchte (lokal im Oberarm) / white pauldron with gold rim and teal light (upper arm local) */
export function faithPauldron(b: Builder, side: number, d: Detail) {
  b.add(geo.rtaper(0.074, 0.074, 0.064, 0.064, 0.034, 0.01), FAITH.plate, { p: [0, 0.01, 0] });
  b.add(geo.rtaper(0.078, 0.078, 0.078, 0.078, 0.008, 0.004), FAITH.gold, { p: [0, -0.008, 0] });
  if (d === 2) b.add(geo.ico(0.008, 0), FAITH.tech, { p: [side * 0.036, 0.012, 0.018] });
}

/**
 * Weihrauchfass an Kette mit Rauchwoelkchen; p = Aufhaengepunkt / incense censer on a chain with smoke puffs; p = hanging point.
 */
export function censer(b: Builder, p: V3, lite = false, len = 0.07) {
  const [x, y, z] = p;
  b.tube([x, y, z], [x, y - len, z], 0.0025, 3, FAITH.goldDark);
  const cy = y - len - 0.016;
  b.add(geo.sphere(0.018, lite ? 6 : 8, lite ? 4 : 6), FAITH.gold, { p: [x, cy, z] });
  b.add(geo.cone(0.012, 0.016, 6), FAITH.goldLight, { p: [x, cy + 0.02, z] });
  if (!lite) {
    b.add(geo.torus(0.019, 0.003, 3, 10), FAITH.goldDark, { p: [x, cy, z], r: [HALF_PI, 0, 0] });
    // Glut und Weihrauch / embers and incense
    b.add(geo.ico(0.006, 0), FAITH.halo, { p: [x, cy + 0.004, z + 0.016] });
    for (let i = 0; i < 3; i++) b.add(geo.ico(0.012 + i * 0.004, 0), mix(mat.paper, mat.white, 0.4), { p: [x + 0.008 * i, cy + 0.04 + i * 0.026, z - 0.004 * i] });
  }
}

/**
 * Langes Ordensgewehr: weisser Schaft mit Goldbeschlag, langer Lauf, Lichtvisier mit leuchtender Goldlinse, Muendungsring.
 * Long Order rifle: white stock with gold fittings, long barrel, radiant scope with a glowing gold lens, muzzle ring.
 */
export function holyRifle(b: Builder, grip: V3, dir: V3, len = 0.4, lite = false) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  b.group({ p: grip, r: [e.x, e.y, e.z] }, () => {
    b.add(geo.profileZY([[-0.1, -0.026], [-0.1, 0.014], [-0.03, 0.016], [0.01, 0.012], [0.01, -0.012], [-0.045, -0.014]], 0.024), FAITH.plate);
    b.box(0.026, 0.044, 0.008, FAITH.gold, [0, -0.006, -0.1]);
    b.add(geo.taper(0.018, 0.022, 0.018, 0.018, 0.04), mat.dark, { p: [0, -0.024, 0.012], r: [-0.35, 0, 0] });
    b.add(geo.cbox(0.032, 0.036, 0.14, 0.007), FAITH.plate, { p: [0, 0, 0.07] });
    b.box(0.034, 0.008, 0.12, FAITH.gold, [0, -0.012, 0.075]);
    const bl = len - 0.14;
    b.cyl(0.0075, 0.0075, bl, lite ? 6 : 8, mat.metal, [0, 0.004, 0.14 + bl / 2], [HALF_PI, 0, 0]);
    // Laufringe und Muendung / barrel rings and muzzle
    for (const t of lite ? [0.5] : [0.3, 0.6]) b.cyl(0.011, 0.011, 0.01, 8, FAITH.gold, [0, 0.004, 0.14 + bl * t], [HALF_PI, 0, 0]);
    b.cyl(0.013, 0.01, 0.026, 8, FAITH.gold, [0, 0.004, len - 0.01], [HALF_PI, 0, 0]);
    if (!lite) b.cyl(0.006, 0.006, 0.004, 6, FAITH.halo, [0, 0.004, len + 0.004], [HALF_PI, 0, 0]);
    // Lichtvisier / radiant scope
    b.cyl(0.013, 0.013, 0.11, 10, FAITH.plate, [0, 0.036, 0.07], [HALF_PI, 0, 0]);
    b.cyl(0.017, 0.015, 0.024, 8, FAITH.gold, [0, 0.036, 0.13], [HALF_PI, 0, 0]);
    b.cyl(0.015, 0.015, 0.005, 8, FAITH.halo, [0, 0.036, 0.143], [HALF_PI, 0, 0]);
    b.box(0.008, 0.02, 0.01, mat.dark, [0, 0.02, 0.04]);
    b.box(0.008, 0.02, 0.01, mat.dark, [0, 0.02, 0.1]);
  });
}

// ---------- Lichtschuetzen / Light Wardens ----------

/**
 * Kniender Lichtschuetze mit langem Ordensgewehr, dahinter ein Spaeher mit Weihrauchfass und Sonnenkranz-Standarte.
 * Kneeling Light Warden with a long Order rifle, behind him a spotter with an incense censer and a sun-halo standard.
 */
export function lightWarden(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const d: Detail = lite ? 1 : 2;
  const grip: V3 = [0.035, 0.2, 0.04];
  b.group({ p: [0.02, 0, -0.06] }, () => {
    soldier(b, f, { ...kneelPose([[-0.03, 0.215, 0.17], grip]), head: [0.1, 0, 0], twist: [0, 0.05, 0] }, { detail: d, seed: 31 });
    holyRifle(b, grip, [0, 0.03, 1], 0.42, lite);
  });
  if (!lite) {
    // Spaeher mit Fernglas-Geste und Weihrauchfass / spotter with a field-glass gesture and an incense censer
    b.group({ p: [-0.17, 0, -0.17], r: [0, 0.35, 0], s: 0.86 }, () => {
      soldier(b, f, { ...standPose([[-0.04, 0.3, 0.07], [0.11, 0.16, 0.05]]), head: [0.08, 0, 0] }, { detail: 1, seed: 37 });
      censer(b, [0.11, 0.16, 0.05], false, 0.06);
    });
    // Sonnenkranz-Standarte / sun-halo standard
    b.cyl(0.005, 0.005, 0.5, 5, FAITH.goldDark, [-0.24, 0.25, -0.26]);
    b.add(geo.box(0.09, 0.12, 0.006), FAITH.cloth, { p: [-0.19, 0.42, -0.26] });
    b.box(0.09, 0.012, 0.008, FAITH.gold, [-0.19, 0.355, -0.26]);
    addEmblem(b, f, 0.03, 0.006, FAITH.plate, { p: [-0.19, 0.43, -0.255] });
    haloRing(b, [-0.24, 0.52, -0.26], 0.04, 0.004, 14, -0.4);
  }
  return b;
}

// ---------- Reliquiar / Reliquary ----------

/**
 * Reliquiar: schwer gepanzerter Schrein auf Ketten. Weisse Wanne mit Goldborten, blaue Schuerzen ueber den Ketten,
 * Schreinaufbau mit Spitzdach und Buntglasfenstern, langes Lichtgeschuetz mit Goldringen, schwebender Sonnenkranz,
 * Weihrauchfass am Heck.
 * Reliquary: heavily armoured shrine on tracks. White hull with gold trim, blue skirts over the tracks, shrine
 * superstructure with a pointed roof and stained-glass windows, long light gun with gold rings, floating sun halo,
 * incense censer at the rear.
 */
export function reliquary(f: FactionId, lite = false): Builder {
  const b = new Builder();
  tracks(b, { x: 0.13, w: 0.07, len: 0.4, h: 0.075, wheels: 5, wr: 0.026, sprocket: FAITH.goldDark, hub: FAITH.gold, lite, links: 8 });
  const by = 0.08;
  // Wanne / hull
  b.add(geo.cbox(0.26, 0.06, 0.42, 0.02), FAITH.plate, { p: [0, by + 0.015, 0] });
  b.add(geo.profileZY([[-0.2, 0], [0.18, 0], [0.22, 0.03], [0.2, 0.05], [-0.2, 0.05]], 0.27), FAITH.plateShade, { p: [0, by + 0.04, 0] });
  b.box(0.275, 0.012, 0.43, FAITH.gold, [0, by + 0.045, 0]);
  // blaue Schuerzen mit Goldsaum ueber den Ketten / blue skirts with a gold hem over the tracks
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.012, 0.06, 0.36, 0.004), FAITH.cloth, { p: [s * 0.172, by - 0.005, 0] });
    b.box(0.014, 0.01, 0.36, FAITH.gold, [s * 0.172, by - 0.035, 0]);
    if (!lite) for (const z of [-0.12, 0, 0.12]) faithStar(b, [s * 0.18, by - 0.004, z], 0.014, [0, s * HALF_PI, 0], FAITH.goldLight);
  }
  // Schrein mit Spitzdach / shrine with a pointed roof
  const sy = by + 0.07, sz = -0.06;
  // Schrein mit Lichtgeschuetz dreht sich zum Ziel (siehe Builder.turret) / shrine with light gun turns towards the target (see Builder.turret)
  b.turret([0, sy, sz], () => {
    b.add(geo.cbox(0.2, 0.12, 0.22, 0.012), FAITH.plate, { p: [0, sy + 0.06, sz] });
    b.add(geo.profileXY([[-0.115, 0], [0.115, 0], [0, 0.1]], 0.24), FAITH.cloth, { p: [0, sy + 0.12, sz - 0.12] });
    b.add(geo.profileXY([[-0.12, -0.004], [0.12, -0.004], [0, 0.104]], 0.012), FAITH.gold, { p: [0, sy + 0.12, sz + 0.115] });
    b.add(geo.profileXY([[-0.12, -0.004], [0.12, -0.004], [0, 0.104]], 0.012), FAITH.gold, { p: [0, sy + 0.12, sz - 0.127] });
    b.box(0.012, 0.012, 0.25, FAITH.gold, [0, sy + 0.222, sz]);
    faithStar(b, [0, sy + 0.165, sz + 0.124], 0.03);
    // Buntglasfenster: Spitzbogenfelder in Blau und Gold mit Goldsprossen / stained-glass windows: pointed panes in blue and gold with gold mullions
    for (const s of [-1, 1]) {
      for (let i = 0; i < (lite ? 2 : 3); i++) {
        const z = sz - 0.07 + i * (lite ? 0.14 : 0.07);
        b.add(geo.profileXY([[-0.02, 0], [0.02, 0], [0.02, 0.05], [0, 0.07], [-0.02, 0.05]], 0.006), i % 2 ? FAITH.glassGold : FAITH.glassBlue, { p: [s * 0.102, sy + 0.025, z], r: [0, s * HALF_PI, 0] });
        b.box(0.008, 0.075, 0.006, FAITH.goldDark, [s * 0.104, sy + 0.06, z]);
      }
    }
    if (!lite) {
      // Rosette vorn / rose window at the front
      b.add(geo.cyl(0.032, 0.032, 0.008, 12), FAITH.glassBlue, { p: [0, sy + 0.07, sz + 0.112], r: [HALF_PI, 0, 0] });
      b.add(geo.torus(0.034, 0.005, 3, 14), FAITH.gold, { p: [0, sy + 0.07, sz + 0.116] });
      for (let i = 0; i < 4; i++) b.box(0.004, 0.064, 0.004, FAITH.goldDark, [0, sy + 0.07, sz + 0.118], [0, 0, (i * Math.PI) / 4]);
    }
    // Lichtgeschuetz vorn, lang mit Goldringen und Leuchtkristall / light gun at the front, long with gold rings and a glowing crystal
    b.group({ p: [0, sy + 0.05, sz + 0.12] }, () => {
      b.add(geo.cbox(0.09, 0.07, 0.08, 0.014), FAITH.plate, { p: [0, 0, 0.02] });
      b.box(0.095, 0.01, 0.085, FAITH.gold, [0, 0.03, 0.02]);
      const len = 0.36;
      b.cyl(0.018, 0.022, len, lite ? 8 : 12, FAITH.plateShade, [0, 0, 0.06 + len / 2], [HALF_PI, 0, 0]);
      for (const t of lite ? [0.5, 1] : [0.25, 0.5, 0.75, 1]) b.cyl(0.026, 0.026, 0.016, lite ? 8 : 12, FAITH.gold, [0, 0, 0.06 + len * t - 0.008], [HALF_PI, 0, 0]);
      b.add(geo.ico(0.018, lite ? 0 : 1), FAITH.halo, { p: [0, 0, 0.07 + len] });
    });
    // schwebender Sonnenkranz ueber dem Dach / floating sun halo above the roof
    haloRing(b, [0, sy + 0.27, sz], 0.075, 0.006, lite ? 12 : 20);
  });
  // Weihrauchfass am Heck / incense censer at the rear
  if (!lite) {
    b.tube([-0.08, by + 0.05, -0.2], [-0.08, by + 0.2, -0.24], 0.004, 4, FAITH.goldDark);
    censer(b, [-0.08, by + 0.2, -0.24], false, 0.05);
    addEmblem(b, f, 0.03, 0.005, FAITH.gold, { p: [0, by + 0.04, 0.218] });
  }
  return b;
}

// ---------- Sonnenlanze / Sun Lance ----------

/**
 * Sonnenlanze: Lafette auf zwei grossen Raedern mit Goldnaben, Spiegelschale aus Goldsegmenten mit leuchtendem Kern,
 * lange Lanze mit drei Fokusringen und Lichtkristall, Klerikerin mit Sonnenkranz als Bedienung.
 * Sun Lance: carriage on two big wheels with gold hubs, a mirror dish of gold segments with a glowing core, a long lance
 * with three focusing rings and a light crystal, a cleric with a sun halo as crew.
 */
export function sunLance(f: FactionId, lite = false): Builder {
  const b = new Builder();
  // Lafette und Raeder / carriage and wheels
  b.add(geo.cbox(0.2, 0.05, 0.28, 0.014), FAITH.plate, { p: [0, 0.07, -0.02] });
  b.box(0.21, 0.01, 0.29, FAITH.gold, [0, 0.1, -0.02]);
  for (const s of [-1, 1]) {
    b.cyl(0.07, 0.07, 0.024, lite ? 10 : 16, mat.dark, [s * 0.125, 0.07, -0.03], [0, 0, HALF_PI]);
    b.cyl(0.05, 0.05, 0.028, lite ? 8 : 14, FAITH.plate, [s * 0.125, 0.07, -0.03], [0, 0, HALF_PI]);
    b.cyl(0.02, 0.02, 0.034, 8, FAITH.gold, [s * 0.125, 0.07, -0.03], [0, 0, HALF_PI]);
    if (!lite) for (let i = 0; i < 4; i++) b.box(0.03, 0.09, 0.008, FAITH.goldDark, [s * 0.125, 0.07, -0.03], [(i * Math.PI) / 4, 0, 0]);
  }
  // Holm nach hinten / trail to the rear
  b.add(geo.taper(0.05, 0.03, 0.03, 0.02, 0.2), FAITH.plateShade, { p: [0, 0.05, -0.2], r: [HALF_PI + 0.25, 0, 0] });
  // Drehlafette, Lanze angehoben / turntable, lance raised
  b.cyl(0.06, 0.07, 0.03, 12, FAITH.goldDark, [0, 0.11, 0.0]);
  b.group({ p: [0, 0.15, 0.0], r: [-0.42, 0, 0] }, () => {
    // Spiegelschale hinten / mirror dish at the back
    b.add(geo.cyl(0.11, 0.05, 0.04, lite ? 10 : 16, true), FAITH.gold, { p: [0, 0, -0.04], r: [HALF_PI, 0, 0] });
    if (!lite) for (let i = 0; i < 8; i++) b.box(0.006, 0.11, 0.004, FAITH.goldDark, [0, 0, -0.042], [0, 0, (i * Math.PI) / 8]);
    b.add(geo.cyl(0.05, 0.05, 0.01, 12), FAITH.glassGold, { p: [0, 0, -0.03], r: [HALF_PI, 0, 0] });
    b.add(geo.cyl(0.024, 0.024, 0.014, 10), FAITH.halo, { p: [0, 0, -0.022], r: [HALF_PI, 0, 0] });
    // lange Lanze / long lance
    const len = 0.5;
    b.add(geo.cyl(0.012, 0.026, len, lite ? 8 : 12), FAITH.plate, { p: [0, 0, len / 2], r: [HALF_PI, 0, 0] });
    for (let i = 0; i < 3; i++) {
      const z = 0.12 + i * 0.13;
      b.add(geo.torus(0.032 - i * 0.004, 0.006, 3, lite ? 10 : 14), FAITH.gold, { p: [0, 0, z] });
      if (!lite) b.add(geo.torus(0.024 - i * 0.004, 0.003, 3, 12), FAITH.halo, { p: [0, 0, z + 0.008] });
    }
    // Lichtkristall an der Spitze / light crystal at the tip
    b.add(geo.cone(0.016, 0.05, 6), FAITH.halo, { p: [0, 0, len + 0.02], r: [HALF_PI, 0, 0] });
  });
  // Bedienung: Klerikerin im Wappenrock mit Sonnenkranz / crew: cleric in a tabard with a sun halo
  if (!lite) {
    b.group({ p: [0.21, 0, -0.16], r: [0, -0.55, 0] }, () => {
      soldier(b, f, standPose([[-0.035, 0.17, 0.1], [0.035, 0.17, 0.1]]), { detail: 1, seed: 17 });
      b.add(geo.cbox(0.07, 0.008, 0.05, 0.003), FAITH.goldDark, { p: [0, 0.17, 0.12], r: [0.6, 0, 0] });
      b.box(0.05, 0.004, 0.03, FAITH.tech, [0, 0.176, 0.12], [0.6, 0, 0]);
    });
    censer(b, [-0.1, 0.1, -0.14], false, 0.05);
  }
  addEmblem(b, f, 0.03, 0.005, FAITH.gold, { p: [0.101, 0.07, 0.06], r: [0, HALF_PI, 0] });
  addEmblem(b, f, 0.03, 0.005, FAITH.gold, { p: [-0.101, 0.07, 0.06], r: [0, -HALF_PI, 0] });
  return b;
}

// ---------- Goettlicher Funke / Divine Spark ----------

/**
 * Goettlicher Funke: Riesengeschuetz auf breitem Kettenfahrgestell (weisse Wanne, blaue Schuerzen mit Goldsternen), Drehkranz
 * mit hohem vergoldetem Lauf, Sonnenscheibe mit Strahlenkranz am Verschluss, drei schwebende Sonnenkraenze um den Lauf,
 * grosse leuchtende Fokuslinse an der Muendung, Reliquienschrein mit Sonnenkranz am Heck, Klerikerin als Bedienung. Deutlich
 * groesser als die Artillerie (gross-Klasse, ueber die Kachel hinaus, siehe tests/unit-proportions.test.ts).
 * Divine Spark: giant gun on a wide tracked chassis (white hull, blue skirts with gold stars), turntable with a tall gilded
 * barrel, a sun disc with a ray crown at the breech, three floating sun halos around the barrel, a big glowing focusing lens
 * at the muzzle, a reliquary shrine with a sun halo at the rear, a cleric as crew. Clearly larger than the artillery (large
 * class, beyond the tile, see tests/unit-proportions.test.ts).
 */
export function divineSpark(f: FactionId, lite = false): Builder {
  const b = new Builder();
  // Ketten in der einfachen Bauart (die Schuerzen verdecken die Seiten), oben eigene Kettenglieder / tracks in the simple build (the skirts cover the sides), own track plates on top
  tracks(b, { x: 0.31, w: 0.12, len: 0.84, h: 0.1, wheels: 5, wr: 0.034, sprocket: FAITH.goldDark, hub: FAITH.gold, lite: true });
  if (!lite) for (const s of [-1, 1]) for (let i = 0; i < 8; i++) b.box(0.124, 0.007, 0.014, mat.ink, [s * 0.31, 0.102, -0.36 + i * 0.103]);
  const by = 0.1;
  // Wanne mit Goldborte und schraeger Bugplatte / hull with gold trim and sloped glacis
  b.add(geo.cbox(0.52, 0.07, 0.84, 0.02), FAITH.plate, { p: [0, by + 0.02, 0] });
  b.add(geo.profileZY([[-0.42, 0], [0.38, 0], [0.43, 0.035], [0.4, 0.055], [-0.42, 0.055]], 0.5), FAITH.plateShade, { p: [0, by + 0.045, 0] });
  b.box(0.53, 0.012, 0.85, FAITH.gold, [0, by + 0.055, 0]);
  // blaue Schuerzen ueber den Ketten mit Goldsaum und Sternen / blue skirts over the tracks with a gold hem and stars
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.014, 0.07, 0.76, 0.004), FAITH.cloth, { p: [s * 0.385, by - 0.002, 0] });
    b.box(0.016, 0.012, 0.76, FAITH.gold, [s * 0.385, by - 0.036, 0]);
    if (!lite) for (const z of [-0.24, 0.24]) faithStar(b, [s * 0.394, by - 0.002, z], 0.02, [0, s * HALF_PI, 0], FAITH.goldLight);
    addEmblem(b, f, 0.045, 0.006, FAITH.gold, { p: [s * 0.394, by - 0.002, 0], r: [0, s * HALF_PI, 0] });
  }
  // Reliquienschrein am Heck mit Spitzdach und Sonnenkranz / reliquary shrine at the rear with a pointed roof and a sun halo
  const sy = by + 0.06;
  b.add(geo.cbox(0.16, 0.1, 0.12, 0.01), FAITH.plate, { p: [0.12, sy + 0.05, -0.33] });
  b.add(geo.profileXY([[-0.09, 0], [0.09, 0], [0, 0.07]], 0.13), FAITH.cloth, { p: [0.12, sy + 0.1, -0.395] });
  b.add(geo.profileXY([[-0.02, 0], [0.02, 0], [0.02, 0.04], [0, 0.055], [-0.02, 0.04]], 0.006), FAITH.glassGold, { p: [0.12, sy + 0.025, -0.268] });
  haloRing(b, [0.12, sy + 0.22, -0.33], 0.05, 0.005, 12);
  // Drehkranz mit Lafette und dem Riesenlauf (dreht sich zum Ziel) / turntable with the cradle and the giant barrel (turns towards the target)
  const ty = by + 0.06, tz = 0.02;
  b.turret([0, ty, tz], () => {
    b.cyl(0.17, 0.18, 0.04, 14, FAITH.goldDark, [0, ty + 0.02, tz]);
    b.cyl(0.15, 0.15, 0.012, 14, FAITH.gold, [0, ty + 0.045, tz]);
    // Lafettenwangen mit Schildzapfen / cradle cheeks with trunnions
    for (const s of [-1, 1]) {
      b.add(geo.profileZY([[-0.13, 0], [0.08, 0], [0.04, 0.14], [-0.08, 0.14]], 0.03), FAITH.plate, { p: [s * 0.11, ty + 0.04, tz] });
      b.box(0.034, 0.012, 0.2, FAITH.gold, [s * 0.11, ty + 0.05, tz - 0.02]);
      b.cyl(0.035, 0.035, 0.05, 8, FAITH.gold, [s * 0.11, ty + 0.16, tz], [0, 0, HALF_PI]);
    }
    // Lauf angehoben / barrel raised
    b.group({ p: [0, ty + 0.16, tz], r: [-0.4, 0, 0] }, () => {
      // Sonnenscheibe am Verschluss mit Strahlenkranz und leuchtendem Kern / sun disc at the breech with a ray crown and a glowing core
      b.add(geo.cyl(0.13, 0.1, 0.05, 14), FAITH.gold, { p: [0, 0, -0.1], r: [HALF_PI, 0, 0] });
      b.add(geo.cyl(0.07, 0.07, 0.012, 14), FAITH.glassGold, { p: [0, 0, -0.128], r: [HALF_PI, 0, 0] });
      b.add(geo.cyl(0.035, 0.035, 0.016, 12), FAITH.halo, { p: [0, 0, -0.134], r: [HALF_PI, 0, 0] });
      const rays = lite ? 6 : 8;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        const len = lite || i % 2 === 0 ? 0.075 : 0.05;
        b.add(geo.cone(0.018, len, 3), i % 2 ? FAITH.goldLight : FAITH.gold, { p: [Math.sin(a) * (0.13 + len / 2), Math.cos(a) * (0.13 + len / 2), -0.1], r: [0, 0, -a] });
      }
      // vergoldeter Riesenlauf: Verschluss, schlanker Hals, Glocke an der Muendung / gilded giant barrel: breech, slim neck, bell at the muzzle
      const len = 0.5;
      b.add(geo.lathe([[0, -0.08], [0.085, -0.08, true], [0.085, 0.06], [0.06, 0.14], [0.052, 0.34], [0.07, len - 0.02], [0.084, len, true], [0, len]], lite ? 10 : 14), FAITH.gold,
        { p: [0, 0, 0], r: [HALF_PI, 0, 0] });
      // weisse Laufbaender und Fokusringe / white barrel bands and focusing rings
      for (const [z, r] of (lite ? [[0.08, 0.08]] : [[0.08, 0.08], [0.22, 0.058]]) as [number, number][]) b.add(geo.torus(r, 0.008, 3, 12), FAITH.plate, { p: [0, 0, z] });
      // drei schwebende Sonnenkraenze um den Lauf / three floating sun halos around the barrel
      for (const [z, r] of (lite ? [[0.16, 0.1], [0.36, 0.088]] : [[0.12, 0.11], [0.26, 0.098], [0.4, 0.09]]) as [number, number][]) {
        b.add(geo.torus(r, 0.0055, 3, lite ? 12 : 16), FAITH.halo, { p: [0, 0, z] });
      }
      // Fokuslinse an der Muendung: Goldrand, Buntglas, leuchtender Kern, Lichtkristall / focusing lens at the muzzle: gold rim, stained glass, glowing core, light crystal
      b.add(geo.torus(0.082, 0.012, 3, lite ? 12 : 16), FAITH.goldDark, { p: [0, 0, len + 0.004] });
      b.add(geo.cyl(0.072, 0.072, 0.01, lite ? 10 : 14), FAITH.glassGold, { p: [0, 0, len], r: [HALF_PI, 0, 0] });
      b.add(geo.cyl(0.042, 0.042, 0.014, 10), FAITH.halo, { p: [0, 0, len + 0.004], r: [HALF_PI, 0, 0] });
      if (!lite) {
        b.add(geo.cone(0.018, 0.05, 6), FAITH.halo, { p: [0, 0, len + 0.03], r: [HALF_PI, 0, 0] });
        for (let i = 0; i < 4; i++) b.box(0.006, 0.15, 0.004, FAITH.goldDark, [0, 0, len + 0.008], [0, 0, (i * Math.PI) / 4]);
      }
    });
  });
  // Bedienung: Klerikerin mit Sonnenkranz am Heck, Weihrauchfass / crew: a cleric with a sun halo at the rear, incense censer
  if (!lite) {
    b.group({ p: [-0.16, by + 0.06, -0.3], r: [0, 0.4, 0], s: 0.9 }, () => {
      soldier(b, f, standPose([[-0.04, 0.2, 0.08], [0.1, 0.17, 0.05]]), { detail: 1, seed: 23 });
      censer(b, [0.1, 0.17, 0.05], false, 0.05);
    });
    b.tube([0.0, by + 0.06, -0.4], [0.0, by + 0.32, -0.44], 0.004, 4, FAITH.goldDark);
    b.add(geo.box(0.1, 0.12, 0.006), FAITH.cloth, { p: [0.055, by + 0.27, -0.44] });
    addEmblem(b, f, 0.03, 0.006, FAITH.plate, { p: [0.055, by + 0.28, -0.436] });
  }
  return b;
}

// ---------- Ordenswacht / Order Guard ----------

/**
 * Ordenswacht: zwei schwer gepanzerte Waechter mit hohen Turmschilden (Weiss, Gold, Blau, Stern), dahinter ein
 * Wegschrein mit Weihrauchfass (Selbstheilung).
 * Order Guard: two heavily armoured wardens with tall tower shields (white, gold, blue, star), behind them a wayside
 * shrine with an incense censer (self-repair).
 */
export function orderGuard(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const d: Detail = lite ? 1 : 2;
  const shield = (x: number, z: number, ry: number) => b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    b.add(geo.profileXY([[-0.075, 0], [0.075, 0], [0.075, 0.2], [0, 0.25], [-0.075, 0.2]], 0.018), FAITH.plate, { p: [0, 0.02, 0.07] });
    b.add(geo.profileXY([[-0.055, 0], [0.055, 0], [0.055, 0.17], [0, 0.21], [-0.055, 0.17]], 0.006), FAITH.cloth, { p: [0, 0.04, 0.088] });
    b.box(0.154, 0.012, 0.022, FAITH.gold, [0, 0.024, 0.079]);
    addEmblem(b, f, 0.04, 0.006, FAITH.plate, { p: [0, 0.14, 0.093] });
    if (d === 2) b.add(geo.ico(0.008, 0), FAITH.tech, { p: [0, 0.235, 0.09] });
  });
  // vorderer Waechter mit Schild und Kurzgewehr / front warden with shield and carbine
  b.group({ p: [0.08, 0, 0.04] }, () => {
    soldier(b, f, { ...standPose([[-0.06, 0.18, 0.08], [0.1, 0.16, 0.04]]), twist: [0, -0.15, 0] }, { detail: d, seed: 91 });
    shield(-0.02, 0.0, 0);
    holyRifle(b, [0.1, 0.16, 0.04], [0.15, 0.6, 0.6], 0.3, true);
  });
  if (!lite) {
    // zweiter Waechter, Schild schraeg / second warden, shield at an angle
    b.group({ p: [-0.16, 0, -0.06], r: [0, 0.45, 0], s: 0.92 }, () => {
      soldier(b, f, standPose([[-0.06, 0.18, 0.08], [0.06, 0.18, 0.08]]), { detail: 1, seed: 93 });
      shield(0, 0, 0);
    });
    // Wegschrein mit Sonnenkranz und Weihrauchfass / wayside shrine with sun halo and censer
    b.group({ p: [0.2, 0, -0.22] }, () => {
      b.add(geo.cbox(0.06, 0.14, 0.05, 0.008), FAITH.plate, { p: [0, 0.07, 0] });
      b.add(geo.profileXY([[-0.04, 0], [0.04, 0], [0, 0.04]], 0.06), FAITH.cloth, { p: [0, 0.14, -0.03] });
      b.add(geo.profileXY([[-0.02, 0], [0.02, 0], [0.02, 0.04], [0, 0.055], [-0.02, 0.04]], 0.006), FAITH.glassGold, { p: [0, 0.06, 0.026] });
      haloRing(b, [0, 0.21, 0], 0.03, 0.004, 12);
      censer(b, [0.045, 0.12, 0.03], false, 0.04);
    });
  }
  return b;
}

// ---------- Gebaeude / buildings ----------

/**
 * Lichtdom (ID embassyPalace): weisser Dom mit Goldkuppel, Rosette, Buntglasfenstern, zwei Glockentuermen mit Sonnenkranz,
 * Freitreppe und Banner.
 * Cathedral of Light (ID embassyPalace): white cathedral with a gold dome, rose window, stained-glass windows, two bell
 * towers with sun halos, grand stairs and banners.
 */
export function cathedral(b: Builder, f: FactionId | null) {
  b.block(0, 0, -0.04, 0.64, 0.03, 0.46, mat.concreteLight);
  for (let i = 0; i < 3; i++) b.block(0, i * 0.012, 0.2 - i * 0.02, 0.22, 0.012, 0.04, mat.paper);
  // Langhaus / nave
  b.block(0, 0.03, -0.08, 0.26, 0.2, 0.3, FAITH.plate);
  b.add(geo.profileXY([[-0.14, 0], [0.14, 0], [0, 0.12]], 0.32), FAITH.cloth, { p: [0, 0.23, -0.24] });
  b.box(0.27, 0.012, 0.31, FAITH.gold, [0, 0.235, -0.08]);
  // Fassade: Portal, Rosette, Stern / facade: portal, rose window, star
  b.add(geo.profileXY([[-0.04, 0], [0.04, 0], [0.04, 0.08], [0, 0.11], [-0.04, 0.08]], 0.008), mat.wood, { p: [0, 0.03, 0.07] });
  b.add(geo.cyl(0.05, 0.05, 0.008, 14), FAITH.glassBlue, { p: [0, 0.18, 0.072], r: [HALF_PI, 0, 0] });
  b.add(geo.torus(0.052, 0.006, 3, 16), FAITH.gold, { p: [0, 0.18, 0.076] });
  faithStar(b, [0, 0.18, 0.08], 0.03, [0, 0, 0], FAITH.goldLight);
  // Buntglas an den Seiten / stained glass on the sides
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    b.add(geo.profileXY([[-0.022, 0], [0.022, 0], [0.022, 0.07], [0, 0.095], [-0.022, 0.07]], 0.006), i % 2 ? FAITH.glassGold : FAITH.glassBlue,
      { p: [s * 0.132, 0.08, -0.17 + i * 0.08], r: [0, s * HALF_PI, 0] });
  }
  // Goldkuppel ueber der Vierung / gold dome over the crossing
  b.cyl(0.08, 0.08, 0.05, 14, FAITH.plate, [0, 0.27, -0.16]);
  b.add(geo.hemi(0.08, 14, 4), FAITH.gold, { p: [0, 0.295, -0.16] });
  haloRing(b, [0, 0.44, -0.16], 0.05, 0.006, 16);
  faithStar(b, [0, 0.4, -0.16], 0.03, [0, 0, 0], FAITH.goldLight);
  // Glockentuerme / bell towers
  for (const s of [-1, 1]) {
    b.block(s * 0.2, 0.03, 0.0, 0.1, 0.32, 0.1, FAITH.plate);
    b.box(0.104, 0.012, 0.104, FAITH.gold, [s * 0.2, 0.25, 0.0]);
    b.box(0.05, 0.06, 0.006, mat.window, [s * 0.2, 0.29, 0.052]);
    b.add(geo.cone(0.075, 0.14, 4), FAITH.cloth, { p: [s * 0.2, 0.42, 0.0], r: [0, Math.PI / 4, 0] });
    haloRing(b, [s * 0.2, 0.53, 0.0], 0.03, 0.004, 12);
    // Banner / banner
    b.add(geo.box(0.05, 0.12, 0.004), FAITH.cloth, { p: [s * 0.2, 0.15, 0.053] });
    if (f) addEmblem(b, f, 0.018, 0.004, FAITH.plate, { p: [s * 0.2, 0.17, 0.056] });
  }
}

/**
 * Klosterweingut (ID hillVineyard): Rebzeilen am Hang, kleines Kloster mit Glockenturm und Sonnenkranz, Faesser.
 * Monastery vineyard (ID hillVineyard): vine rows on the slope, a small monastery with a bell tower and sun halo, barrels.
 */
export function monasteryVineyard(b: Builder) {
  b.block(0, 0, 0, 0.66, 0.012, 0.6, mix(mat.leaf, mat.sand, 0.5));
  // Rebzeilen / vine rows
  for (let r = 0; r < 4; r++) {
    const z = 0.04 + r * 0.06;
    b.box(0.5, 0.006, 0.01, mat.wood, [-0.04, 0.05, z]);
    for (let i = 0; i < 7; i++) {
      const x = -0.27 + i * 0.075;
      b.cyl(0.004, 0.004, 0.05, 4, mat.wood, [x, 0.035, z]);
      b.add(geo.ico(0.022, 0), shade(mat.leaf, 0.85 + ((i + r) % 3) * 0.08), { p: [x + 0.02, 0.055, z] });
      if ((i + r) % 2 === 0) b.add(geo.ico(0.01, 0), FAITH.clothDeep, { p: [x + 0.02, 0.038, z + 0.012] });
    }
  }
  // Kloster mit Glockenturm / monastery with a bell tower
  b.block(0.14, 0.012, -0.18, 0.24, 0.12, 0.14, FAITH.plate);
  b.add(geo.profileXY([[-0.13, 0], [0.13, 0], [0, 0.06]], 0.15), FAITH.cloth, { p: [0.14, 0.132, -0.255] });
  for (let i = 0; i < 3; i++) b.add(geo.profileXY([[-0.012, 0], [0.012, 0], [0.012, 0.03], [0, 0.04], [-0.012, 0.03]], 0.005), i === 1 ? FAITH.glassGold : FAITH.glassBlue, { p: [0.07 + i * 0.07, 0.06, -0.108] });
  b.block(-0.03, 0.012, -0.2, 0.07, 0.24, 0.07, FAITH.plate);
  b.box(0.074, 0.01, 0.074, FAITH.gold, [-0.03, 0.2, -0.2]);
  b.add(geo.cone(0.055, 0.1, 4), FAITH.cloth, { p: [-0.03, 0.3, -0.2], r: [0, Math.PI / 4, 0] });
  haloRing(b, [-0.03, 0.38, -0.2], 0.026, 0.004, 12);
  // Faesser / barrels
  for (const [x, z] of [[0.26, -0.06], [0.29, -0.01]] as [number, number][]) {
    b.cyl(0.026, 0.026, 0.05, 10, mat.wood, [x, 0.037, z], [0, 0, HALF_PI]);
    b.add(geo.torus(0.027, 0.003, 3, 10), FAITH.goldDark, { p: [x, 0.037, z], r: [0, HALF_PI, 0] });
  }
}
