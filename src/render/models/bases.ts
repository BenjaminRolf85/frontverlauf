/**
 * Stuetzpunkte: je Art (City.base, BASE_KINDS) ein eigenes Modell auf dem Stadtplatz, mit einem Wahrzeichen, das man bei
 * Kartenzoom erkennt (Kuehltuerme, Windraeder, Rollbahn, Geschuetzrohr ...), und Kleinteilen fuer die Nahsicht.
 * Bases: one model per kind (City.base, BASE_KINDS) on the city plaza, with a landmark that reads at map zoom (cooling
 * towers, wind turbines, runway, gun barrel ...) and small parts for the close view.
 *
 * Gemeinsam mit den Staedten (city.ts): Massstab CITY_SCALE, Platz 0.8 im Modell, Bordstein in der Fraktionsfarbe bzw.
 * Mauerring, die vordere Ecke (+x, +z) bleibt niedrig fuer die Besatzung. Neutral = verlassen: ausgeblichene Farben,
 * dunkle Fenster, kein Rauch, kahler Mast, Gestruepp. Besetzt: Bordstein, Flagge, Dachbaender und Tore in der
 * Fraktionsfarbe, Fenster und Lampen leuchten nachts. Je Stufe wachsen Wahrzeichen und Anbauten.
 * Shared with the cities (city.ts): scale CITY_SCALE, plaza 0.8 in the model, kerb in the faction colour or the wall
 * ring, the front corner (+x, +z) stays low for the garrison. Neutral = abandoned: faded colours, dark windows, no
 * smoke, a bare mast, scrub. Owned: kerb, flag, roof bands and gates in the faction colour, windows and lamps glow at
 * night. Landmark and annexes grow per level.
 *
 * Alles ist deterministisch (kein Zufall) und wird je Schluessel einmal gebaut. Nur die Rotoren besetzter Windraeder
 * drehen sich: das Brett zeichnet sie getrennt (spin, rotorGeometry), ein Zeichenaufruf fuer alle Windraeder der Karte.
 * Everything is deterministic (no randomness) and built once per key. Only the rotors of owned wind turbines turn: the
 * board draws them separately (spin, rotorGeometry), one draw call for all wind turbines of the map.
 */
import * as THREE from 'three';
import type { BaseKind, FactionId } from '../../data/balance';
import { primitives, semantic } from '../../design/tokens';
import { HALF_PI, barrel, container, crate, dish, flagPole, sandbag } from './architecture';
import { CITY_SCALE, bunkerRing, factory as cityWorks, govQuarter, kerb } from './city';
import { addEmblem } from './emblems';
import { Builder, col, geo, memo, mix, shade, type ColorLike, type LathePoint } from './kit';
import { look, mat, type Look } from './look';

const p = primitives.color;

/** Ausbauten der Stadt, die auch ein Stuetzpunkt tragen kann / city extensions a base can carry too */
export interface BaseFlags { factory: boolean; bunkerRing: boolean; govQuarter: boolean }

/**
 * Angaben zum fertigen Modell in Feldbreiten, relativ zur Feldmitte: hit = Trefferkoerper [x, z, Breite, Hoehe],
 * smoke = Rauchquellen [x, y, z] (nur besetzt), height = hoechster Punkt des Wahrzeichens.
 * Facts about the finished model in tile widths, relative to the tile centre: hit = hit bodies [x, z, width, height],
 * smoke = smoke sources [x, y, z] (owned only), height = highest point of the landmark.
 */
export interface BaseMeta {
  hit: [number, number, number, number][]; smoke: [number, number, number][]; height: number;
  /**
   * Drehende Rotoren (nur mit spin, siehe base): Nabe [x, y, z], Drehung um die Hochachse, Anfangswinkel, Massstab
   * gegenueber rotorGeometry. Das Brett zeichnet sie als eine instanzierte Geometrie fuer alle Windraeder der Karte.
   * Spinning rotors (only with spin, see base): hub [x, y, z], yaw, start angle, scale relative to rotorGeometry. The
   * board draws them as one instanced geometry for all wind turbines of the map.
   */
  rotors: [number, number, number, number, number, number][];
}

/** Kennfarben der Arten (vor dem Verwittern) / signature colours of the kinds (before weathering) */
const K = {
  olive: col(p.olive500), oliveDark: col(p.olive600), oliveDeep: col(p.olive700), khaki: col(p.khaki500),
  asphalt: col(p.asphalt700), asphaltLight: col(p.asphalt500),
  brick: mix(p.red700, p.rock400, 0.34), brickDark: mix(p.red700, p.rock600, 0.55),
  steel: mix(p.asphalt500, p.rock400, 0.5), steelDark: mix(p.asphalt700, p.rock600, 0.3),
  panel: mix(p.blue600, p.sky800, 0.35), panelLine: mix(p.blue400, p.white, 0.5),
  canvas: mix(p.paper50, p.white, 0.45),
  sign: col(p.orange500), crane: col(p.yellow500),
  dust: mix(p.dust300, p.rock400, 0.5), dirt: mix(p.track500, p.sand300, 0.5), lawn: col(p.grass500),
  // Sanitaetszeichen: weisses Kreuz auf Gruen (kein rotes Kreuz auf Weiss: geschuetztes Zeichen)
  // medical sign: white cross on green (no red cross on white: protected emblem)
  medic: col(p.green500),
  warn: col(semantic.verdanEye),
};

interface Ctx {
  b: Builder; f: FactionId | null; L: Look; lv: number; neutral: boolean; flags: BaseFlags;
  /** Akzent: Fraktionsfarbe, neutral ausgeblichen / accent: faction colour, faded when neutral */
  A: THREE.Color; A2: THREE.Color;
  /** Fenster (leuchten nachts), Lampe (immer an), Warnlicht (leuchtet selbst); neutral alle aus / windows (lit at night), lamp (always on), warning light (self-lit); all off when neutral */
  win: THREE.Color; lamp: THREE.Color; warn: THREE.Color;
  /** verwittern: neutral zum Staubton mischen / weather: mix towards the dust tone when neutral */
  W: (c: ColorLike, k?: number) => THREE.Color;
  /** Rauchquelle (Modellmass) / smoke source (model units) */
  smoke: (x: number, y: number, z: number) => void;
  /** Wahrzeichen fuer den Trefferkoerper (Modellmass) / landmark for the hit body (model units) */
  mark: (x: number, z: number, w: number, h: number) => void;
  /** Rotoren nicht einbauen, sondern melden (Modellmass) / do not build the rotors in but report them (model units) */
  spin: boolean;
  rotor: (x: number, y: number, z: number, yaw: number, phase: number, k: number) => void;
}

// ---------- Bauteile / parts ----------

/** Flache Flaeche auf dem Platz / flat surface on the plaza */
const pad = (b: Builder, x: number, z: number, w: number, d: number, c: ColorLike, ry = 0) => b.block(x, 0.01, z, w, 0.004, d, c, ry);
/** Aufgemalte Markierung / painted marking */
const paintLine = (b: Builder, x: number, z: number, w: number, d: number, c: ColorLike, ry = 0) => b.block(x, 0.0135, z, w, 0.003, d, c, ry);

/** Satteldach, First entlang x / gable roof, ridge along x */
function ridgeRoof(b: Builder, x: number, y: number, z: number, len: number, span: number, h: number, c: ColorLike) {
  b.add(geo.profileZY([[-span / 2, 0], [span / 2, 0], [0, h]], len), c, { p: [x, y, z] });
}

/** Fahnenmast; neutral: kahler, schiefer Mast / flag mast; neutral: a bare, leaning pole */
function mast(c: Ctx, x: number, z: number, h: number, size = 1, y = 0) {
  if (c.neutral) {
    c.b.tube([x, y, z], [x + 0.025 * size, y + h * 0.85, z - 0.012], 0.008 * size, 5, c.W(mat.metalLight));
    return;
  }
  flagPole(c.b, c.f, x, y, z, h, size);
}

/** Gestruepp auf dem verlassenen Platz / scrub on the abandoned plaza */
function scrub(c: Ctx, spots: [number, number][]) {
  if (!c.neutral) return;
  spots.forEach(([x, z], i) => {
    const s = 0.75 + (i % 3) * 0.2;
    c.b.add(geo.dodeca(0.034 * s), i % 2 ? mat.leaf : mat.leafDark, { p: [x, 0.036 * s, z], r: [0, i * 1.3, 0] });
    for (const [dx, dz] of [[0.045, 0.01], [-0.02, 0.04]] as [number, number][]) c.b.add(geo.cone(0.008, 0.035, 4), mat.grass, { p: [x + dx * s, 0.026, z + dz * s] });
  });
}

/** Ecklichter der drei besonderen Fraktionen / corner lights of the three special factions */
function cornerMarks(c: Ctx, open: number) {
  const { b, f } = c;
  if (f !== 'zyrr' && f !== 'nexus' && f !== 'vesper') return;
  const R = 0.385;
  const corners: [number, number, number[]][] = [[-1, -1, [2, 3]], [1, -1, [1, 2]], [-1, 1, [0, 3]], [1, 1, [0, 1]]];
  for (const [sx, sz, sides] of corners) {
    if (sides.includes(open)) continue;
    const x = sx * R, z = sz * R;
    if (f === 'zyrr') {
      // Leuchtkapsel / glowing pod
      b.add(geo.sphere(0.03, 7, 5), c.L.wallDark, { p: [x, 0.03, z], s: [1, 0.8, 1] });
      b.add(geo.sphere(0.017, 6, 4), sx * sz > 0 ? mat.xenoGlow : mat.acid, { p: [x, 0.058, z] });
    } else if (f === 'nexus') {
      // Lichtpfosten / light post
      b.block(x, 0, z, 0.03, 0.07, 0.03, mat.gunmetal);
      b.block(x, 0.07, z, 0.022, 0.012, 0.022, mat.cyanGlow);
    } else {
      // Feuerschale / brazier
      b.cyl(0.024, 0.014, 0.05, 6, mat.rustDark, [x, 0.025, z]);
      b.add(geo.ico(0.016, 0), mat.ember, { p: [x, 0.058, z] });
    }
  }
}

/** Kleiner Lkw, Fahrerhaus nach +z / small lorry, cab towards +z */
function lorry(b: Builder, x: number, z: number, ry: number, cab: ColorLike, load: ColorLike) {
  b.group({ p: [x, 0.01, z], r: [0, ry, 0] }, () => {
    b.block(0, 0.012, 0.062, 0.062, 0.05, 0.05, cab);
    b.block(0, 0.04, 0.086, 0.054, 0.018, 0.006, mat.glassDark);
    b.block(0, 0.012, -0.03, 0.066, 0.062, 0.125, load);
    for (const wz of [-0.06, 0.055]) b.block(0, 0, wz, 0.074, 0.024, 0.03, mat.dark);
  });
}

/** Kleinwagen, Front nach +z / small car, front towards +z */
function car(b: Builder, x: number, z: number, ry: number, body: ColorLike) {
  b.group({ p: [x, 0.012, z], r: [0, ry, 0] }, () => {
    b.block(0, 0.008, 0, 0.05, 0.022, 0.1, body);
    b.block(0, 0.03, -0.006, 0.044, 0.018, 0.05, mat.glassDark);
    for (const wz of [-0.03, 0.03]) b.block(0, 0, wz, 0.056, 0.016, 0.024, mat.dark);
  });
}

/** Panzer, Bug nach +z; turret = false: nur die Wanne (im Bau) / tank, bow towards +z; turret = false: hull only (under construction) */
function tankModel(b: Builder, hull: ColorLike, turret: boolean) {
  // Ketten: unten kuerzer als oben, mit Laufrollen / tracks: shorter at the bottom than at the top, with road wheels
  for (const s of [-1, 1]) {
    b.add(geo.taper(0.036, 0.16, 0.036, 0.215, 0.044), mat.dark, { p: [s * 0.052, 0.022, 0] });
    for (const z of [-0.06, 0, 0.06]) b.cyl(0.014, 0.014, 0.006, 6, mat.darkMid, [s * 0.071, 0.02, z], [0, 0, HALF_PI]);
  }
  b.add(geo.taper(0.075, 0.2, 0.068, 0.13, 0.034, -0.012), hull, { p: [0, 0.058, 0] });
  if (turret) tankTurret(b, hull, 0, 0.075, -0.015);
  else b.cyl(0.03, 0.03, 0.006, 8, mat.dark, [0, 0.078, -0.015]);
}
function tankTurret(b: Builder, hull: ColorLike, x: number, y: number, z: number) {
  b.cyl(0.034, 0.042, 0.032, 8, shade(hull, 1.15), [x, y + 0.016, z]);
  b.tube([x, y + 0.018, z + 0.03], [x, y + 0.022, z + 0.165], 0.01, 6, mat.dark);
  b.block(x - 0.012, y + 0.032, z - 0.008, 0.016, 0.008, 0.016, mat.dark);
}

/** Propellerflugzeug, Nase nach +z / propeller plane, nose towards +z */
function plane(b: Builder, body: ColorLike, accent: ColorLike) {
  b.tube([0, 0.036, -0.1], [0, 0.036, 0.08], 0.009, 6, body, 0.02);
  b.add(geo.cone(0.02, 0.03, 6), accent, { p: [0, 0.036, 0.095], r: [HALF_PI, 0, 0] });
  b.box(0.23, 0.006, 0.05, body, [0, 0.034, 0.015]);
  for (const s of [-1, 1]) b.box(0.03, 0.007, 0.052, accent, [s * 0.1, 0.035, 0.015]);
  b.box(0.085, 0.005, 0.028, body, [0, 0.04, -0.088]);
  b.box(0.006, 0.04, 0.034, accent, [0, 0.058, -0.088]);
  b.box(0.022, 0.012, 0.036, mat.glassDark, [0, 0.054, 0.03]);
  b.box(0.05, 0.006, 0.004, mat.dark, [0, 0.036, 0.112], [0, 0, 0.6]);
  for (const s of [-1, 1]) b.block(s * 0.03, 0, 0.02, 0.008, 0.024, 0.014, mat.dark);
}

/** Langes Zelt mit First entlang x / long tent with its ridge along x */
function ridgeTent(b: Builder, x: number, z: number, len: number, dep: number, wall: number, rise: number, c: ColorLike, ry = 0) {
  b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    b.block(0, 0, 0, len, wall, dep, shade(c, 0.9));
    ridgeRoof(b, 0, wall, 0, len + 0.012, dep + 0.03, rise, c);
    // Eingang und Abspannpflock / entrance and guy peg
    b.add(geo.profileXY([[-0.024, 0], [0.024, 0], [0, wall * 0.95]], 0.006), mat.darkMid, { p: [0, 0, dep / 2 + 0.002] });
    for (const s of [-1, 1]) b.tube([s * (len / 2 - 0.01), wall, dep / 2 + 0.015], [s * (len / 2 + 0.02), 0.005, dep / 2 + 0.05], 0.003, 3, mat.wood);
  });
}

/** Gittermast aus zwei gekreuzten Scheiben, guenstig und lesbar / lattice mast from two crossed slabs, cheap and readable */
function pylon(c: Ctx, x: number, z: number, h: number) {
  const { b } = c;
  const steel = c.W(mat.metal);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.tube([x + sx * 0.035, 0, z + sz * 0.035], [x + sx * 0.008, h, z + sz * 0.008], 0.005, 4, steel);
  for (let i = 1; i <= 2; i++) b.block(x, h * (0.3 * i), z, 0.07 - i * 0.018, 0.006, 0.07 - i * 0.018, steel);
  for (const y of [h * 0.78, h * 0.95]) {
    b.box(0.15, 0.007, 0.008, steel, [x, y, z]);
    for (const s of [-1, 1]) b.cyl(0.006, 0.006, 0.02, 5, mat.white, [x + s * 0.065, y - 0.014, z]);
  }
}

/**
 * Rotor eines Windrads: Nabe im Ursprung, Achse +z, drei Fluegel der Laenge ROTOR.blade in der xy-Ebene (Modellmass).
 * yaw dreht die Rotorflaeche zur Standardkamera; hub = Lage der Nabe in der Gondel.
 * Rotor of a wind turbine: hub at the origin, axis +z, three blades of length ROTOR.blade in the xy plane (model
 * units). yaw turns the rotor disc towards the default camera; hub = position of the hub inside the nacelle.
 */
export const ROTOR = { blade: 0.2, yaw: Math.PI / 4, hubY: 0.008, hubZ: 0.052 };
function rotorParts(b: Builder, white: ColorLike, tip: ColorLike) {
  const blade = ROTOR.blade;
  b.add(geo.cone(0.02, 0.04, 8), white, { p: [0, 0, 0.006], r: [HALF_PI, 0, 0] });
  for (let i = 0; i < 3; i++) {
    b.group({ r: [0, 0, (i * Math.PI * 2) / 3] }, () => {
      b.add(geo.taper(0.03, 0.01, 0.012, 0.005, blade, 0, 0.004), white, { p: [0, blade / 2 + 0.008, 0], r: [0, 0.25, 0] });
      b.box(0.016, blade * 0.16, 0.007, tip, [0.003, blade * 0.92 + 0.008, 0], [0, 0.25, 0]);
    });
  }
}
/** Rotor als eigene Geometrie fuer die drehenden Windraeder besetzter Stuetzpunkte / rotor as its own geometry for the spinning turbines of owned bases */
export function rotorGeometry(): THREE.BufferGeometry {
  return memo('city|base|rotor', () => {
    const b = new Builder();
    rotorParts(b, mat.white, mat.red);
    return b.build();
  });
}

// ---------- Arten / kinds ----------

function barracks(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const wall = W(mix(p.khaki500, p.paper100, 0.5)), roof = W(K.olive), plinth = W(mat.concreteDark);
  const storeys = lv >= 6 ? 2 : 1;
  // Mannschaftsbaracke; die Fensterseite zeigt nach ry gedreht / troop hut; the window side faces as turned by ry
  const hut = (x: number, z: number, len: number, dep: number, ry: number, st: number) => {
    b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
      const h = 0.082 * st + 0.014;
      b.block(0, 0, 0, len, h, dep, wall);
      b.block(0, 0, 0, len + 0.008, 0.018, dep + 0.008, plinth);
      const n = Math.max(3, Math.round(len / 0.075));
      for (let s = 0; s < st; s++) for (let i = 0; i < n; i++) {
        const wx = -len / 2 + (i + 0.5) * (len / n);
        if (s === 0 && Math.abs(wx) < 0.03) continue;
        b.block(wx, 0.04 + s * 0.082, dep / 2 + 0.001, 0.032, 0.03, 0.006, c.win);
      }
      b.block(0, 0.018, dep / 2 + 0.002, 0.036, 0.05, 0.006, W(mat.wood));
      ridgeRoof(b, 0, h, 0, len + 0.03, dep + 0.036, 0.062, roof);
      // First in der Fraktionsfarbe / ridge in the faction colour
      b.box(len + 0.036, 0.012, 0.02, c.A, [0, h + 0.06, 0]);
    });
  };
  hut(0.07, -0.275, 0.56, 0.16, 0, storeys);
  hut(-0.29, 0.03, 0.34, 0.16, HALF_PI, storeys);
  if (lv >= 3 && !gov) hut(0.29, -0.02, 0.26, 0.15, HALF_PI, 1);
  if (gov) govQuarter(b, c.f, 0.28, -0.03);
  // Exerzierplatz mit Linien / drill yard with lines
  const sand = W(mix(p.sand300, p.dust300, 0.4));
  pad(b, 0.01, 0.115, 0.38, 0.5, sand);
  for (const s of [-1, 1]) paintLine(b, 0.01 + s * 0.175, 0.115, 0.012, 0.47, mat.white);
  for (const z of [-0.12, 0.35]) paintLine(b, 0.01, z, 0.36, 0.012, mat.white);
  // Fahnenmast auf Sockel: das Wahrzeichen / flag mast on a podium: the landmark
  const mh = Math.min(0.72, 0.42 + lv * 0.038);
  b.block(-0.035, 0.01, -0.07, 0.07, 0.022, 0.07, W(mat.concreteLight));
  mast(c, -0.035, -0.07, mh, 1.35, 0.03);
  c.mark(-0.035, -0.07, 0.22, mh);
  // Antreten: zwei Reihen / parade: two rows
  if (!c.neutral) {
    const rows = lv >= 5 ? 3 : 2;
    for (let r = 0; r < rows; r++) for (let i = 0; i < 3; i++) {
      const x = 0.035 + i * 0.045, z = 0.02 + r * 0.05;
      b.block(x, 0.014, z, 0.02, 0.03, 0.014, c.A);
      b.block(x, 0.044, z, 0.016, 0.014, 0.014, W(K.oliveDeep));
    }
  }
  // Wachhaeuschen und Schlagbaum am Tor / sentry box and boom gate at the entrance
  b.block(-0.215, 0.01, 0.335, 0.05, 0.085, 0.05, c.neutral ? W(mat.white) : mat.white);
  for (const y of [0.03, 0.062]) b.block(-0.215, y, 0.335, 0.053, 0.014, 0.053, c.A);
  b.add(geo.cone(0.048, 0.035, 4).rotateY(Math.PI / 4), roof, { p: [-0.215, 0.112, 0.335] });
  b.block(-0.215, 0.022, 0.361, 0.022, 0.05, 0.004, mat.darkMid);
  b.block(-0.165, 0.01, 0.345, 0.014, 0.05, 0.014, W(mat.concreteDark));
  for (let i = 0; i < 5; i++) b.box(0.058, 0.012, 0.012, i % 2 ? mat.white : W(mat.red), [-0.13 + i * 0.058, 0.058, 0.345]);
  // Wachturm in der hinteren Ecke / watchtower in the far corner
  if (works) { cityWorks(b, c.f, -0.29, -0.28, lv); c.smoke(-0.37, 0.37 + lv * 0.025, -0.36); }
  else if (lv >= 4) {
    const tx = -0.3, tz = -0.3, th = 0.2 + lv * 0.012;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([tx + sx * 0.05, 0, tz + sz * 0.05], [tx + sx * 0.04, th, tz + sz * 0.04], 0.007, 4, W(mat.wood));
    b.block(tx, th, tz, 0.11, 0.012, 0.11, W(mat.woodLight));
    b.block(tx, th + 0.012, tz, 0.105, 0.036, 0.105, c.A);
    b.block(tx, th + 0.048, tz, 0.09, 0.03, 0.09, mat.darkMid);
    b.add(geo.cone(0.09, 0.05, 4).rotateY(Math.PI / 4), roof, { p: [tx, th + 0.103, tz] });
  }
  if (lv >= 7) lorry(b, 0.12, -0.14, HALF_PI, W(K.olive), W(K.khaki));
  // Sandsackposten am Tor ab Stufe 2 / sandbag post at the gate from level 2
  if (lv >= 2) for (let i = 0; i < 3; i++) sandbag(b, 0.25 + (i % 2) * 0.01, i === 2 ? 0.042 : 0, 0.3 + (i === 2 ? 0.03 : i * 0.06), HALF_PI, 0.9);
  scrub(c, [[0.3, 0.2], [0.3, -0.05], [-0.1, 0.3], [0.12, 0.2]]);
}

function bunker(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const conc = W(mat.concrete), concL = W(mat.concreteLight), concD = W(mat.concreteDark);
  // nach hinten gerueckt und hoch genug, dass die Kuppel hinter einer Besatzung sichtbar bleibt
  // moved to the back and tall enough that the dome stays visible behind a garrison
  const cx = -0.1, cz = -0.1, s = 1 + (lv - 1) * 0.028;
  const r = 0.2 * s, wallH = 0.1 + lv * 0.008;
  b.group({ p: [cx, 0, cz] }, () => {
    // Sockelring, Kuppel, Scharten / base ring, dome, firing slits
    b.cyl(r, r * 1.08, wallH, 12, conc, [0, wallH / 2, 0]);
    b.cyl(r + 0.006, r + 0.006, 0.016, 12, c.A, [0, wallH, 0]);
    b.add(geo.hemi(r * 0.97, 12, 4), concL, { p: [0, wallH + 0.008, 0], s: [1, 0.62, 1] });
    for (const a of [0, Math.PI / 4, HALF_PI, -Math.PI / 4, Math.PI * 0.75]) {
      b.group({ r: [0, a, 0] }, () => {
        b.block(0, wallH * 0.52, r * 1.01, 0.1 * s, 0.026 * s, 0.03, mat.ink);
        b.block(0, wallH * 0.52 + 0.026 * s, r * 1.03, 0.12 * s, 0.012, 0.03, concD);
      });
    }
    // Panzerkuppel, ab Stufe 3 mit Zwillingsrohr / armoured cupola, with a twin gun from level 3
    const top = wallH + 0.008 + r * 0.97 * 0.62;
    b.cyl(0.055 * s, 0.065 * s, 0.035 * s, 8, concD, [0, top + 0.008, 0]);
    b.add(geo.hemi(0.055 * s, 8, 3), W(mat.metal), { p: [0, top + 0.025 * s, 0], s: [1, 0.7, 1] });
    if (lv >= 3) for (const o of [-0.016, 0.016]) {
      b.group({ p: [0, top + 0.03 * s, 0], r: [0, Math.PI / 4, 0] }, () => b.tube([o, 0, 0.02], [o, 0.05 + lv * 0.004, 0.13 + lv * 0.008], 0.008, 5, mat.dark));
    }
    b.block(0.02, top + 0.02 * s, -0.03, 0.012, 0.012, 0.012, c.lamp);
    c.mark(cx, cz, 0.3, top + 0.06);
  });
  // Eingang mit Stahltuer nach +x / entrance with a steel door towards +x
  b.block(cx + r * 1.02, 0, cz - 0.09 * s, 0.07, wallH * 0.9, 0.1, concD);
  b.block(cx + r * 1.02 + 0.036, 0.008, cz - 0.09 * s, 0.004, wallH * 0.62, 0.05, W(mat.metal));
  // Sandsackwaelle vor den Scharten / sandbag walls in front of the slits
  const layers = lv >= 2 ? 2 : 1;
  const arc = (ax: number, az: number, a0: number, n: number) => {
    for (let l = 0; l < layers; l++) for (let i = 0; i < n - l; i++) {
      const a = a0 + (i + l * 0.5 - (n - 1) / 2) * 0.42;
      sandbag(b, ax + Math.sin(a) * 0.12, l * 0.042, az + Math.cos(a) * 0.12, a, 0.95);
    }
  };
  if (!works) arc(cx - 0.02, cz + r + 0.05, 0, 4);
  if (!gov) arc(cx + r + 0.05, cz - 0.02, HALF_PI, 4);
  // Hoeckerlinie an den vorderen Kanten / dragon's teeth along the front edges
  const tooth = (x: number, z: number) => b.add(geo.taper(0.05, 0.05, 0.022, 0.022, 0.05), concL, { p: [x, 0.035, z] });
  for (let i = 0; i < 4; i++) {
    if (!works) tooth(-0.33 + i * 0.085, 0.33);
    if (!gov) tooth(0.33, -0.33 + i * 0.085);
  }
  // Splitterschutzwaende ab Stufe 6 / blast walls from level 6
  if (lv >= 6) {
    if (!works) for (let i = 0; i < 3; i++) b.block(-0.3 + i * 0.1, 0, 0.27 - (i % 2) * 0.025, 0.085, 0.07, 0.022, concD, (i % 2 ? 0.35 : -0.35));
    if (!gov) for (let i = 0; i < 3; i++) b.block(0.27 - (i % 2) * 0.025, 0, -0.3 + i * 0.1, 0.022, 0.07, 0.085, concD, (i % 2 ? 0.35 : -0.35));
  }
  // Nebenbunker / secondary pillboxes
  const pill = (x: number, z: number) => {
    b.cyl(0.075, 0.085, 0.06, 6, conc, [x, 0.03, z]);
    b.cyl(0.06, 0.075, 0.03, 6, concL, [x, 0.075, z]);
    b.box(0.07, 0.016, 0.02, mat.ink, [x + 0.045, 0.04, z + 0.045], [0, Math.PI / 4, 0]);
  };
  if (gov) govQuarter(b, c.f, 0.28, -0.29);
  else if (lv >= 5) pill(0.29, -0.3);
  if (works) { cityWorks(b, c.f, -0.27, 0.25, lv); c.smoke(-0.35, 0.37 + lv * 0.025, 0.17); }
  else if (lv >= 7) pill(-0.3, 0.26);
  // Funkmast ab Stufe 4 / radio mast from level 4
  if (lv >= 4) {
    b.tube([0.22, 0, -0.34], [0.22, 0.4 + lv * 0.02, -0.34], 0.006, 4, W(mat.metal));
    b.add(geo.ico(0.013, 0), c.warn, { p: [0.22, 0.41 + lv * 0.02, -0.34] });
  }
  mast(c, -0.34, -0.34, 0.42 + lv * 0.02, 1.1);
  scrub(c, [[0.3, 0.02], [-0.32, 0.2], [0.1, 0.3], [0.3, -0.3]]);
}

function tankFactory(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const wall = W(K.steel), wallD = W(K.steelDark), roof = W(K.asphaltLight);
  const hull = c.neutral ? W(K.olive) : c.L.hull;
  // Halle mit Saegezahndach / hall with a sawtooth roof
  const w = 0.46, d = 0.42, hx = -0.14, hz = -0.16, h = 0.15 + lv * 0.008;
  b.block(hx, 0, hz, w, h, d, wall);
  b.block(hx, 0, hz, w + 0.01, 0.03, d + 0.01, wallD);
  b.block(hx, h * 0.5, hz, w + 0.008, 0.026, d + 0.008, c.win);
  b.block(hx, h - 0.022, hz, w + 0.012, 0.022, d + 0.012, c.A);
  const teeth = lv >= 4 ? 4 : 3, tw = d / teeth;
  for (let i = 0; i < teeth; i++) {
    const z0 = hz - d / 2 + i * tw;
    b.add(geo.profileZY([[0, 0], [tw, 0], [tw, 0.07], [tw - 0.014, 0.07]], w), roof, { p: [hx, h, z0] });
    b.add(geo.profileZY([[tw - 0.014, 0], [tw, 0], [tw, 0.062], [tw - 0.014, 0.062]], w * 0.9), c.neutral ? W(mat.glass) : mat.glass, { p: [hx, h + 0.003, z0 + 0.003] });
  }
  c.mark(hx, hz, 0.36, h + 0.07);
  // grosses Tor nach +x, halb offen / big gate towards +x, half open
  const gx = hx + w / 2;
  b.block(gx + 0.003, 0, hz, 0.006, 0.125, 0.21, c.A);
  b.block(gx + 0.006, 0, hz, 0.006, 0.11, 0.18, mat.ink);
  for (let i = 0; i < 3; i++) b.block(gx + 0.009, 0.066 + i * 0.016, hz, 0.006, 0.012, 0.18, W(mat.metalLight));
  if (!c.neutral && c.f) addEmblem(b, c.f, 0.04, 0.008, c.L.emblem, { p: [hx + 0.02, h * 0.5 + 0.05, hz + d / 2 + 0.005] });
  // Rampe mit Wanne, ab Stufe 3 haengt der Turm am Portalkran / ramp with a hull, from level 3 the turret hangs from the gantry
  const rx = 0.25, rz = -0.16;
  pad(b, 0.22, rz, 0.3, 0.19, W(mat.concrete));
  b.add(geo.profileXY([[-0.11, 0], [0.11, 0], [0.11, 0.06]], 0.15), W(mat.concreteDark), { p: [rx, 0.012, rz] });
  b.group({ p: [rx, 0.047, rz], r: [0, HALF_PI, 0] }, () => b.group({ r: [-0.266, 0, 0] }, () => tankModel(b, hull, false)));
  if (lv >= 3) {
    const gh = 0.25 + lv * 0.006, steel = W(K.crane);
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) b.block(rx + sx * 0.1, 0, rz + sz * 0.105, 0.016, gh, 0.016, steel);
      b.block(rx, gh, rz + sz * 0.105, 0.24, 0.018, 0.02, steel);
    }
    b.block(rx + 0.01, gh - 0.006, rz, 0.04, 0.03, 0.23, wallD);
    b.tube([rx + 0.01, gh, rz], [rx + 0.01, 0.2, rz], 0.003, 3, mat.dark);
    b.group({ p: [rx + 0.01, 0.15, rz], r: [0, HALF_PI, 0] }, () => tankTurret(b, hull, 0, 0, 0));
  } else {
    b.group({ p: [0.2, 0.012, 0.0], r: [0, 0.5, 0] }, () => tankTurret(b, hull, 0, 0, 0));
  }
  // fertige Panzer auf dem Hof / finished tanks in the yard
  const slots: [number, number][] = [[-0.25, 0.24], [-0.04, 0.25]];
  if (gov) govQuarter(b, c.f, slots[0][0] - 0.01, slots[0][1] + 0.02);
  else if (lv >= 2) b.group({ p: [slots[0][0], 0.01, slots[0][1]], r: [0, 0.25, 0] }, () => tankModel(b, hull, true));
  if (works) { cityWorks(b, c.f, slots[1][0] + (gov ? 0.03 : 0), slots[1][1], lv); c.smoke(slots[1][0] + (gov ? 0.03 : 0) - 0.08, 0.37 + lv * 0.025, slots[1][1] - 0.08); }
  else if (lv >= 5) b.group({ p: [slots[1][0], 0.01, slots[1][1]], r: [0, -0.2, 0] }, () => tankModel(b, hull, true));
  // Kettenrollen / track rolls
  for (let i = 0; i < Math.min(3, 1 + Math.floor(lv / 3)); i++) b.cyl(0.03, 0.03, 0.03, 8, mat.dark, [0.14 + i * 0.065, 0.03, 0.02 - (i % 2) * 0.01], [HALF_PI, 0, 0]);
  // Schlot / stack
  const ch = 0.36 + lv * 0.022;
  b.cyl(0.024, 0.032, ch, 8, W(mat.concreteLight), [-0.31, ch / 2, -0.32]);
  b.cyl(0.027, 0.027, 0.024, 8, c.A, [-0.31, ch - 0.035, -0.32]);
  if (!c.neutral) c.smoke(-0.31, ch, -0.32);
  // Treibstofftanks ab Stufe 7 / fuel tanks from level 7
  if (lv >= 7) for (const z of [0.0, 0.085]) b.cyl(0.04, 0.04, 0.1, 8, W(mat.white), [0.33, 0.05, z]);
  mast(c, -0.35, 0.13, 0.4 + lv * 0.015, 1.05);
  scrub(c, [[0.3, 0.05], [-0.1, 0.3], [0.1, 0.22], [-0.33, 0.3]]);
}

function airbase(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const body = c.neutral ? W(mat.concreteLight) : mat.white;
  // Rollbahn entlang x an der Vorderkante, mit Mittellinie, Schwelle und Randfeuern / runway along x at the front edge, with centre line, threshold and edge lights
  pad(b, 0, 0.245, 0.78, 0.2, K.asphalt);
  for (let i = 0; i < 5; i++) paintLine(b, -0.2 + i * 0.13, 0.245, 0.07, 0.016, mat.white);
  for (let i = 0; i < 4; i++) paintLine(b, -0.345, 0.185 + i * 0.04, 0.05, 0.018, mat.white);
  for (const z of [0.152, 0.338]) paintLine(b, 0.03, z, 0.68, 0.008, mat.white);
  for (let i = 0; i < 6; i++) b.block(-0.36 + i * 0.145, 0.014, 0.135, 0.014, 0.01, 0.014, c.lamp);
  // Vorfeld / apron
  pad(b, 0.12, 0.015, 0.54, 0.22, K.asphaltLight);
  paintLine(b, 0.12, 0.1, 0.5, 0.008, W(mat.yellow));
  // Hangar: Tonnendach, offen zur Rollbahn / hangar: barrel roof, open towards the runway
  const hangar = (x: number, z: number, r: number, len: number) => {
    const arch = (rr: number): [number, number][] => Array.from({ length: 9 }, (_, i) => [-rr * Math.cos((i / 8) * Math.PI), rr * 0.86 * Math.sin((i / 8) * Math.PI)] as [number, number]);
    b.add(geo.profileXY(arch(r), len), W(mat.metalLight), { p: [x, 0, z] });
    for (const dz of [-len / 2 + 0.02, 0, len / 2 - 0.02]) b.add(geo.profileXY(arch(r + 0.007), 0.024), c.A, { p: [x, 0, z + dz] });
    b.add(geo.profileXY(arch(r * 0.8), 0.006), mat.ink, { p: [x, 0, z + len / 2 + 0.002] });
    b.block(x, 0, z + len / 2 + 0.004, r * 0.5, r * 0.5, 0.006, W(mat.metal));
  };
  const hr = 0.14 + lv * 0.003;
  hangar(-0.23, -0.21, hr, 0.3);
  if (gov) govQuarter(b, c.f, 0.05, -0.27);
  else if (lv >= 5) hangar(0.05, -0.24, 0.115, 0.24);
  // Kontrollturm: das Wahrzeichen / control tower: the landmark
  const tx = 0.31, tz = -0.3, th = 0.25 + lv * 0.03;
  b.block(tx, 0, tz, 0.085, th, 0.085, W(mat.concreteLight));
  for (let i = 1; i <= 2; i++) b.block(tx, th * (i / 3), tz, 0.09, 0.012, 0.09, c.A);
  b.add(geo.taper(0.1, 0.1, 0.14, 0.14, 0.03), W(mat.concrete), { p: [tx, th + 0.015, tz] });
  b.block(tx, th + 0.03, tz, 0.132, 0.045, 0.132, c.win);
  b.block(tx, th + 0.075, tz, 0.15, 0.014, 0.15, c.A);
  b.tube([tx, th + 0.089, tz], [tx, th + 0.2, tz], 0.004, 4, W(mat.metal));
  b.add(geo.ico(0.012, 0), c.warn, { p: [tx, th + 0.206, tz] });
  if (lv >= 6) dish(b, tx - 0.03, th + 0.089, tz + 0.02, 0.04, 0.5, mat.white, Math.PI / 4);
  c.mark(tx, tz, 0.2, th + 0.1);
  // Windsack / windsock
  const wx = -0.345, wz = 0.07;
  b.tube([wx, 0, wz], [wx, 0.2, wz], 0.005, 4, W(mat.metal));
  const sock = c.neutral ? [W(K.sign), W(mat.white)] : [K.sign, mat.white];
  for (let i = 0; i < 4; i++) b.tube([wx + 0.006 + i * 0.03, 0.19 - i * 0.004, wz], [wx + 0.036 + i * 0.03, 0.186 - i * 0.004, wz], 0.02 - i * 0.004, 6, sock[i % 2], 0.016 - i * 0.004);
  // Flugzeuge auf dem Vorfeld / planes on the apron
  b.group({ p: [0.08, 0.012, 0.03], r: [0, HALF_PI + 0.25, 0] }, () => plane(b, body, c.A));
  if (works) { cityWorks(b, c.f, 0.29, -0.04, lv); c.smoke(0.21, 0.37 + lv * 0.025, -0.12); }
  else if (lv >= 3) b.group({ p: [0.29, 0.012, -0.03], r: [0, 0.4, 0] }, () => plane(b, body, c.A2));
  if (lv >= 4) lorry(b, -0.04, -0.02, -0.4, W(mat.yellow), W(mat.metalLight));
  if (lv >= 7) {
    // Radarschirm / radar screen
    b.tube([-0.05, 0, -0.36], [-0.05, 0.2, -0.36], 0.008, 5, W(mat.metal));
    b.add(geo.profileXY([[-0.07, 0], [0.07, 0], [0.058, 0.05], [-0.058, 0.05]], 0.01), mat.white, { p: [-0.05, 0.2, -0.36], r: [-0.3, 0.6, 0] });
  }
  // Flagge auf dem Hangardach / flag on the hangar roof
  mast(c, -0.23, -0.3, 0.2 + lv * 0.01, 0.95, hr * 0.84);
  scrub(c, [[-0.05, 0.03], [0.3, 0.05], [-0.36, -0.02], [0.2, 0.2]]);
}

function gunWorks(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const wall = W(mix(p.olive700, p.asphalt500, 0.6)), roof = W(K.asphalt), steel = W(mat.metal);
  // Giesshalle mit Satteldach und gluehendem Ofentor / foundry hall with a gable roof and a glowing furnace gate
  const w = 0.42, d = 0.28, hx = -0.17, hz = -0.22, h = 0.14 + lv * 0.006;
  b.block(hx, 0, hz, w, h, d, wall);
  b.block(hx, 0, hz, w + 0.01, 0.03, d + 0.01, W(mat.concreteDark));
  b.block(hx, h * 0.55, hz, w + 0.008, 0.024, d + 0.008, c.win);
  ridgeRoof(b, hx, h, hz, w + 0.03, d + 0.03, 0.075, roof);
  b.box(w + 0.036, 0.012, 0.022, c.A, [hx, h + 0.073, hz]);
  for (const dx of [-0.12, 0.02, 0.14]) b.block(hx + dx, h + 0.04, hz, 0.05, 0.04, 0.07, W(K.steelDark));
  b.block(hx + 0.08, 0, hz + d / 2 + 0.003, 0.12, 0.1, 0.006, c.A);
  b.block(hx + 0.08, 0, hz + d / 2 + 0.006, 0.1, 0.086, 0.006, c.neutral ? mat.ink : mat.orange);
  if (!c.neutral && c.f) addEmblem(b, c.f, 0.035, 0.008, c.L.emblem, { p: [hx - 0.1, h * 0.55 + 0.05, hz + d / 2 + 0.005] });
  // Schlot / stack
  const stack = (x: number, z: number, ch: number) => {
    b.cyl(0.026, 0.036, ch, 8, W(K.brick), [x, ch / 2, z]);
    b.cyl(0.03, 0.03, 0.024, 8, c.A, [x, ch - 0.04, z]);
    b.cyl(0.03, 0.03, 0.016, 8, W(mat.white), [x, ch - 0.075, z]);
    if (!c.neutral) c.smoke(x, ch, z);
  };
  stack(-0.33, -0.33, 0.44 + lv * 0.024);
  if (lv >= 5) stack(-0.21, -0.36, 0.36 + lv * 0.02);
  // Geschuetzrohr auf der Wiege, hoch gerichtet: das Wahrzeichen / gun barrel on its cradle, elevated: the landmark
  const px = 0.07, pz = 0.1, len = 0.4 + lv * 0.022, el = 0.62;
  pad(b, px, pz, 0.26, 0.2, W(mat.concrete));
  b.group({ p: [px, 0.012, pz], r: [0, HALF_PI * 1.5, 0] }, () => {
    // Wiege: zwei Wangen und Sockel / cradle: two cheeks and a plinth
    b.block(0, 0, 0, 0.13, 0.03, 0.17, W(mat.concreteDark));
    for (const s of [-1, 1]) b.add(geo.profileZY([[-0.07, 0], [0.07, 0], [0.025, 0.1], [-0.025, 0.1]], 0.02), c.A, { p: [s * 0.048, 0.03, 0] });
    b.cyl(0.016, 0.016, 0.13, 8, mat.dark, [0, 0.11, 0], [0, 0, HALF_PI]);
    b.group({ p: [0, 0.11, 0], r: [-el, 0, 0] }, () => {
      b.cyl(0.042, 0.046, 0.13, 10, steel, [0, 0, -0.02], [HALF_PI, 0, 0]);
      b.tube([0, 0, 0.04], [0, 0, len], 0.036, 10, steel, 0.024);
      b.cyl(0.031, 0.031, 0.03, 10, mat.dark, [0, 0, len], [HALF_PI, 0, 0]);
      b.cyl(0.04, 0.04, 0.016, 10, c.A, [0, 0, len * 0.45], [HALF_PI, 0, 0]);
    });
  });
  c.mark(px + 0.12, pz - 0.12, 0.22, 0.11 + Math.sin(el) * len);
  // Saeulenkran neben der Wiege / pillar crane next to the cradle
  if (lv >= 3) {
    const crane = W(K.crane), gh = 0.24 + lv * 0.006, kx = -0.08, kz = 0.07;
    b.block(kx, 0.012, kz, 0.05, 0.02, 0.05, W(mat.concreteDark));
    b.block(kx, 0.03, kz, 0.02, gh, 0.02, crane);
    b.box(0.2, 0.018, 0.018, crane, [kx + 0.06, gh + 0.03, kz + 0.03], [0, -0.46, 0]);
    b.tube([kx - 0.02, gh + 0.03, kz - 0.01], [kx, gh * 0.6, kz], 0.004, 3, crane);
    b.tube([kx + 0.13, gh + 0.022, kz + 0.066], [kx + 0.13, gh - 0.07, kz + 0.066], 0.003, 3, mat.dark);
    b.block(kx + 0.13, gh - 0.1, kz + 0.066, 0.022, 0.03, 0.022, W(K.steelDark));
  }
  // fertige Rohre auf Boecken / finished barrels on trestles
  const lying = (x: number, z: number, y: number, l: number) => {
    b.tube([x - l / 2, y, z], [x + l / 2, y, z], 0.022, 8, steel, 0.015);
    b.cyl(0.019, 0.019, 0.012, 8, mat.dark, [x + l / 2, y, z], [0, 0, HALF_PI]);
  };
  if (gov) govQuarter(b, c.f, 0.28, -0.28);
  if (works) { cityWorks(b, c.f, -0.26, 0.24, lv); c.smoke(-0.34, 0.37 + lv * 0.025, 0.16); }
  else {
    for (const z of [0.2, 0.3]) for (const x of [-0.33, -0.16]) b.block(x, 0, z + 0.03, 0.02, 0.03, 0.1, W(mat.wood));
    if (lv >= 2) lying(-0.245, 0.215, 0.05, 0.26);
    if (lv >= 4) lying(-0.245, 0.27, 0.05, 0.26);
    if (lv >= 6) lying(-0.245, 0.243, 0.088, 0.26);
  }
  // Granatenreihe / row of shells
  for (let i = 0; i < Math.min(6, 2 + lv); i++) {
    const x = 0.2 + (i % 3) * 0.04, z = -0.2 - Math.floor(i / 3) * 0.045;
    if (gov) continue;
    b.cyl(0.013, 0.013, 0.045, 6, W(mat.gold), [x, 0.033, z]);
    b.add(geo.cone(0.013, 0.025, 6), W(K.oliveDeep), { p: [x, 0.068, z] });
  }
  mast(c, 0.1, -0.37, 0.36 + lv * 0.014, 1.0);
  scrub(c, [[0.3, 0.0], [-0.33, 0.1], [0.12, 0.3], [0.05, -0.05]]);
}

function navalStation(c: Ctx, sea: number) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const front = sea < 2;
  const E = 0.5 / CITY_SCALE;
  const concL = W(mat.concreteLight), conc = W(mat.concrete);
  const grey = W(mix(p.rock400, p.water700, 0.25)), wall = W(mix(p.paper100, p.rock400, 0.25));
  // Hafenrahmen: Becken an der Seeseite, davor die Mole mit Einfahrt; alles im "Seerahmen" (See = +z)
  // harbour frame: the basin on the sea side, the mole with its mouth in front; everything in the "sea frame" (sea = +z)
  const xf = [{}, { r: [0, HALF_PI, 0] as const, s: [-1, 1, 1] as const }, { r: [0, Math.PI, 0] as const }, { r: [0, -HALF_PI, 0] as const, s: [-1, 1, 1] as const }][sea];
  const bx1 = front ? 0.1 : E;
  b.group(xf, () => {
    const cxB = (-E + bx1) / 2, wB = bx1 + E;
    b.block(cxB, 0, (0.1 + E) / 2, wB, 0.016, E - 0.1, mat.water);
    // Wellenlinien / ripples
    for (const [x, z, l] of [[-0.3, 0.2, 0.07], [-0.08, 0.33, 0.06], [-0.2, 0.36, 0.05], [0.2, 0.3, 0.07], [0.3, 0.19, 0.05]] as [number, number, number][]) {
      if (x < bx1 - 0.05) b.block(x, 0.016, z, l, 0.002, 0.008, mat.white);
    }
    // Kaikante mit gelbem Rand und Pollern / quay edge with a yellow rim and bollards
    b.block(cxB, 0.01, 0.088, wB, 0.03, 0.03, concL);
    b.block(cxB, 0.04, 0.094, wB, 0.004, 0.012, W(mat.yellow));
    if (front) b.block(bx1 + 0.012, 0.01, (0.1 + E) / 2, 0.03, 0.03, E - 0.1, concL);
    for (let i = 0; i < (front ? 4 : 6); i++) b.cyl(0.011, 0.013, 0.022, 6, mat.dark, [-0.34 + i * 0.13, 0.05, 0.08]);
    // Mole mit Einfahrt und Leuchtfeuer / mole with its mouth and the harbour light
    const mole = (x0: number, x1: number) => b.block((x0 + x1) / 2, 0, E - 0.02, x1 - x0, 0.04, 0.036, conc);
    mole(-E, -0.14);
    if (!front) mole(0.1, E);
    const lh = 0.16 + lv * 0.012;
    b.cyl(0.018, 0.026, lh, 8, c.neutral ? W(mat.white) : mat.white, [-0.165, 0.04 + lh / 2, E - 0.02]);
    b.cyl(0.024, 0.027, lh * 0.25, 8, W(mat.red), [-0.165, 0.04 + lh * 0.45, E - 0.02]);
    b.cyl(0.02, 0.02, 0.022, 8, c.lamp, [-0.165, 0.051 + lh, E - 0.02]);
    b.add(geo.cone(0.027, 0.03, 8), W(mat.red), { p: [-0.165, 0.077 + lh, E - 0.02] });
    // Steg und Schiffe / pier and ships
    b.block(-0.13, 0.016, 0.22, 0.055, 0.016, 0.24, W(mat.woodLight));
    for (const z of [0.16, 0.3]) for (const s of [-1, 1]) b.cyl(0.008, 0.008, 0.045, 5, W(mat.wood), [-0.13 + s * 0.022, 0.022, z]);
    const boat = (x: number, z: number, l: number, big: boolean) => {
      b.group({ p: [x, 0.012, z] }, () => {
        const wd = big ? 0.05 : 0.04;
        b.add(geo.prismXZ([[-wd, -l / 2], [wd, -l / 2], [wd * 1.1, l * 0.2], [0, l / 2], [-wd * 1.1, l * 0.2]], 0.04), grey, {});
        b.add(geo.prismXZ([[-wd * 0.85, -l / 2 + 0.01], [wd * 0.85, -l / 2 + 0.01], [wd * 0.9, l * 0.18], [0, l / 2 - 0.02], [-wd * 0.9, l * 0.18]], 0.004), c.A, { p: [0, 0.04, 0] });
        b.block(0, 0.044, -l * 0.12, wd * 1.2, 0.035, l * 0.3, W(mat.concreteLight));
        b.block(0, 0.062, -l * 0.06, wd * 1.25, 0.012, l * 0.14, c.win);
        b.tube([0, 0.05, l * 0.14], [0, 0.058, l * 0.32], 0.006, 5, mat.dark);
        if (big) {
          b.cyl(0.014, 0.018, 0.05, 6, grey, [0, 0.1, -l * 0.2]);
          b.tube([0, 0.079, -l * 0.02], [0, 0.16, -l * 0.02], 0.003, 3, mat.dark);
          b.tube([0, 0.05, -l * 0.32], [0, 0.056, -l * 0.46], 0.006, 5, mat.dark);
        }
      });
    };
    boat(-0.25, 0.25, 0.2, false);
    if (lv >= 6) boat(front ? -0.015 : 0.02, 0.255, 0.3, true);
    else if (lv >= 3) boat(-0.02, 0.24, 0.2, false);
    if (!front && lv >= 4) boat(0.25, 0.24, 0.2, false);
    // Hafenkran: Portal, Haus, Ausleger ueber dem Becken / harbour crane: portal, cab, jib above the basin
    const kx = front ? -0.01 : -0.04, kz = 0.0, kh = 0.2 + lv * 0.014, crane = W(K.crane);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(kx + sx * 0.045, 0, kz + sz * 0.04, 0.016, kh, 0.016, crane);
    b.block(kx, kh * 0.45, kz, 0.11, 0.012, 0.1, crane);
    b.block(kx, kh, kz, 0.12, 0.016, 0.11, crane);
    b.block(kx, kh + 0.016, kz - 0.01, 0.075, 0.06, 0.085, c.A);
    b.block(kx, kh + 0.04, kz + 0.034, 0.06, 0.022, 0.006, c.win);
    const jx = kx - 0.02, jy = kh + 0.06, tip: [number, number, number] = [kx - 0.14, kh + 0.2, 0.26];
    b.tube([jx, jy, kz + 0.02], tip, 0.011, 5, crane, 0.007);
    b.tube([kx, kh + 0.076, kz - 0.03], [kx + 0.01, kh + 0.15, kz - 0.05], 0.007, 4, crane);
    b.tube([kx + 0.01, kh + 0.15, kz - 0.05], tip, 0.003, 3, mat.dark);
    b.tube(tip, [tip[0], 0.14, tip[2]], 0.003, 3, mat.dark);
    b.block(tip[0], 0.1, tip[2], 0.03, 0.04, 0.03, W(K.steelDark));
    b.add(geo.ico(0.01, 0), c.warn, { p: [tip[0], tip[1] + 0.012, tip[2]] });
    // Lagerhaus mit Tonnendach / warehouse with a barrel roof
    const shed = (x: number, z: number, len: number, dep: number, ry: number) => {
      b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
        const h = 0.1 + lv * 0.004;
        b.block(0, 0, 0, len, h, dep, wall);
        const arc: [number, number][] = Array.from({ length: 7 }, (_, i) => [-(dep / 2 + 0.014) * Math.cos((i / 6) * Math.PI), 0.055 * Math.sin((i / 6) * Math.PI)] as [number, number]);
        b.add(geo.profileZY(arc, len + 0.02), W(K.steel), { p: [0, h, 0] });
        for (const s of [-1, 0, 1]) b.add(geo.profileZY(arc.map(([z2, y2]) => [z2 * 1.03, y2 * 1.08] as [number, number]), 0.022), c.A, { p: [s * (len / 2 - 0.03), h, 0] });
        const n = Math.max(2, Math.round(len / 0.13));
        for (let i = 0; i < n; i++) b.block(-len / 2 + (i + 0.5) * (len / n), 0, dep / 2 + 0.002, 0.07, h * 0.72, 0.006, i % 2 ? c.win : W(mat.metal));
      });
    };
    if (front) shed(-0.1, -0.27, 0.5, 0.19, 0);
    else shed(0.27, -0.16, 0.36, 0.19, -HALF_PI);
    // Containerstapel / container stacks
    const tones = c.neutral ? [W(K.brick), W(K.steel), W(K.olive)] : [c.A, c.A2, K.steel];
    const cxs = front ? 0.28 : -0.3, czs = front ? -0.1 : -0.02;
    const nC = Math.min(5, 1 + Math.floor(lv / 2));
    for (let i = 0; i < nC; i++) container(b, cxs, Math.floor(i / 2) * 0.06, czs + (i % 2) * 0.075 - (i === 4 ? -0.035 : 0), tones[i % 3], HALF_PI, 0.15);
    // Treibstofftank / fuel tank
    const fx = front ? 0.28 : 0.02, fz = front ? -0.29 : -0.31;
    if (gov) govQuarter(b, c.f, fx, fz + 0.01);
    else if (lv >= 5) {
      b.cyl(0.06, 0.06, 0.1, 10, c.neutral ? W(mat.white) : mat.white, [fx, 0.05, fz]);
      b.cyl(0.062, 0.062, 0.018, 10, c.A, [fx, 0.07, fz]);
      b.add(geo.hemi(0.06, 10, 2), W(mat.metalLight), { p: [fx, 0.1, fz], s: [1, 0.35, 1] });
    }
    if (works) {
      const wx2 = front ? 0.27 : -0.26, wz2 = front ? -0.08 : -0.3;
      cityWorks(b, c.f, wx2, wz2, lv);
    }
    scrub(c, front ? [[0.2, 0.2], [0.3, -0.3], [-0.3, -0.05]] : [[-0.2, -0.3], [-0.33, -0.2], [0.1, -0.05]]);
  });
  // Kennwerte im Weltrahmen / facts in the world frame
  const toWorld = (x: number, z: number): [number, number] => (sea === 0 ? [x, z] : sea === 1 ? [z, x] : sea === 2 ? [-x, -z] : [-z, -x]);
  const [mx, mz] = toWorld(front ? -0.01 : -0.04, 0.0);
  c.mark(mx, mz, 0.24, 0.3 + lv * 0.014);
  if (works && !c.neutral) { const [sx, sz] = toWorld((front ? 0.27 : -0.26) - 0.08, (front ? -0.08 : -0.3) - 0.08); c.smoke(sx, 0.37 + lv * 0.025, sz); }
  // Flagge ungespiegelt in der hinteren Ecke / flag unmirrored in the far corner
  const [fx2, fz2] = sea === 2 ? [-0.34, 0.1] : sea === 3 ? [0.1, -0.34] : [-0.35, -0.35];
  mast(c, fx2, fz2, 0.38 + lv * 0.016, 1.05);
}

function supplyDepot(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const olive = W(K.olive), oliveD = W(K.oliveDark), khaki = W(K.khaki), wood = W(mat.woodLight);
  // Schotterhof / gravel yard
  pad(b, 0, 0, 0.74, 0.74, W(K.dirt));
  // Tarnnetz auf Stangen ueber dem Kistenlager: das Wahrzeichen / camouflage net on poles above the crate store: the landmark
  const nx = -0.2, nz = -0.2, nh = 0.17 + lv * 0.006, half = 0.17;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([nx + sx * half, 0, nz + sz * half], [nx + sx * (half - 0.01), nh - 0.02, nz + sz * (half - 0.01)], 0.006, 4, W(mat.wood));
  b.tube([nx, 0, nz], [nx, nh + 0.03, nz], 0.007, 4, W(mat.wood));
  b.add(geo.cone(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), olive, { p: [nx, nh + 0.004, nz], s: [half * 2 + 0.05, 0.065, half * 2 + 0.05] });
  // Tarnflecken auf dem Netz / camouflage blotches on the net
  const blot: [number, number, number, number][] = [[-0.09, -0.07, 0.06, 0], [0.08, -0.09, 0.05, 1], [0.1, 0.08, 0.065, 0], [-0.07, 0.1, 0.05, 1], [0.0, 0.0, 0.04, 1], [-0.13, 0.01, 0.035, 0], [0.02, -0.14, 0.035, 0]];
  for (const [dx, dz, r, tone] of blot) {
    const fall = 0.065 * (1 - Math.max(Math.abs(dx), Math.abs(dz)) / (half + 0.025));
    b.cyl(r, r, 0.008, 6, tone ? W(K.oliveDeep) : khaki, [nx + dx, nh - 0.028 + fall + 0.004, nz + dz], [dz * 0.9, dx * 7, -dx * 0.9]);
  }
  c.mark(nx, nz, 0.4, nh + 0.04);
  // Kisten unter dem Netz / crates under the net
  for (let i = 0; i < 6; i++) crate(b, nx - 0.09 + (i % 3) * 0.085, 0, nz - 0.04 + Math.floor(i / 3) * 0.1, 0.07, i % 2 ? wood : khaki);
  for (let i = 0; i < Math.min(3, lv); i++) crate(b, nx - 0.09 + i * 0.085, 0.07, nz + 0.06, 0.064, i % 2 ? khaki : wood);
  // Zelte / tents
  if (gov) govQuarter(b, c.f, 0.27, -0.28);
  else {
    ridgeTent(b, 0.2, -0.29, 0.22, 0.14, 0.035, 0.075, olive);
    if (lv >= 3) ridgeTent(b, 0.27, -0.1, 0.16, 0.13, 0.035, 0.07, oliveD, HALF_PI);
  }
  // Fasslager / drum store
  const drums = Math.min(9, 3 + lv);
  if (works) { cityWorks(b, c.f, -0.26, 0.25, lv); c.smoke(-0.34, 0.37 + lv * 0.025, 0.17); }
  else for (let i = 0; i < drums; i++) {
    const x = -0.33 + (i % 3) * 0.062, z = 0.12 + Math.floor(i / 3) * 0.062;
    barrel(b, x, 0.012, z, i % 4 === 0 ? c.A : i % 2 ? W(mat.red) : olive);
  }
  // Kistenpyramide und Paletten im Freien / crate pyramid and pallets in the open
  const py = lv >= 4 ? 3 : 2;
  for (let l = 0; l < py; l++) for (let i = 0; i < py - l; i++) crate(b, -0.08 + (i + l * 0.5) * 0.075, 0.012 + l * 0.068, 0.3, 0.068, (i + l) % 2 ? wood : khaki);
  if (lv >= 3) { b.block(0.13, 0.012, 0.19, 0.1, 0.012, 0.08, W(mat.wood)); crate(b, 0.11, 0.024, 0.19, 0.05, c.A); crate(b, 0.155, 0.024, 0.2, 0.04, wood); }
  // abgedeckter Stapel mit Plane und Gurten / covered stack with a tarpaulin and straps
  b.block(-0.02, 0.012, 0.13, 0.16, 0.06, 0.1, wood);
  b.add(geo.taper(0.17, 0.11, 0.14, 0.07, 0.04), oliveD, { p: [-0.02, 0.092, 0.13] });
  for (const dx of [-0.045, 0.045]) b.block(-0.02 + dx, 0.012, 0.13, 0.012, 0.064, 0.106, khaki);
  // Lkw, Container, Tank / lorry, containers, fuel tank
  if (lv >= 2) lorry(b, 0.03, -0.07, HALF_PI, olive, khaki);
  if (lv >= 4) { container(b, 0.07, 0.012, -0.34, oliveD, 0, 0.16); }
  if (lv >= 6) { container(b, 0.07, 0.072, -0.34, khaki, 0, 0.16); lorry(b, 0.14, 0.05, 0.5, olive, oliveD); }
  if (lv >= 5 && !gov) {
    b.cyl(0.045, 0.045, 0.17, 8, W(mat.metalLight), [0.3, 0.06, 0.03], [HALF_PI, 0, 0]);
    for (const z of [-0.03, 0.09]) b.block(0.3, 0.012, z, 0.07, 0.03, 0.02, W(mat.concreteDark));
    b.cyl(0.047, 0.047, 0.02, 8, c.A, [0.3, 0.06, 0.03], [HALF_PI, 0, 0]);
  }
  mast(c, -0.02, -0.36, 0.34 + lv * 0.014, 1.0);
  scrub(c, [[0.3, 0.05], [0.1, 0.2], [-0.05, -0.02], [0.33, -0.33]]);
}

function fieldHospital(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const canvas = c.neutral ? W(K.canvas, 0.22) : K.canvas, green = W(K.medic, 0.25), white = c.neutral ? W(mat.white, 0.2) : mat.white;
  // Kreuz als zwei Balken, liegend um den Mittelpunkt / cross from two bars, lying around the centre
  const crossFlat = (s: number, y: number) => { b.box(s, 0.004, s * 0.3, white, [0, y, 0]); b.box(s * 0.3, 0.004, s, white, [0, y, 0]); };
  // grosses Zelt mit Zeichen auf der Dachflaeche / large tent with the sign on the roof slope
  const tent = (x: number, z: number, len: number, dep: number, ry: number, k = 1) => {
    const wallH = 0.055 * k, rise = 0.095 * k;
    ridgeTent(b, x, z, len, dep, wallH, rise, canvas, ry);
    b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
      const half = dep / 2 + 0.015, a = Math.atan2(rise, half);
      b.group({ p: [0, wallH + rise * 0.5 + 0.004, half * 0.5], r: [a, 0, 0] }, () => {
        const s = Math.min(0.1, Math.hypot(half, rise) * 0.74);
        b.box(s * 1.25, 0.004, s * 1.25, green, [0, 0, 0]);
        crossFlat(s * 0.92, 0.003);
      });
      // Fensterlappen / window flaps
      for (const s of [-1, 1]) b.block(s * len * 0.3, wallH * 0.3, dep / 2 + 0.001, 0.04, wallH * 0.5, 0.006, c.win);
    });
  };
  const k = 1 + (lv >= 6 ? 0.18 : 0);
  tent(-0.06, -0.26, 0.46, 0.2, 0, k);
  if (gov) govQuarter(b, c.f, 0.28, -0.05);
  else if (lv >= 2) tent(0.285, -0.12, 0.3, 0.17, HALF_PI);
  if (works) { cityWorks(b, c.f, -0.28, 0.0, lv); c.smoke(-0.36, 0.37 + lv * 0.025, -0.08); }
  else if (lv >= 4) tent(-0.285, 0.0, 0.24, 0.17, HALF_PI);
  // Landemarke am Boden / landing mark on the ground
  b.cyl(0.105, 0.105, 0.004, 14, green, [-0.2, 0.012, 0.25]);
  b.add(geo.torus(0.105, 0.007, 3, 14), white, { p: [-0.2, 0.014, 0.25], r: [HALF_PI, 0, 0] });
  b.group({ p: [-0.2, 0.014, 0.25] }, () => crossFlat(0.13, 0.002));
  // Zeichenwuerfel auf dem Mast: das Wahrzeichen / sign cube on a mast: the landmark
  const sx = 0.0, sz = -0.06, sh = 0.3 + lv * 0.022, cs = 0.1;
  b.cyl(0.03, 0.036, 0.02, 8, W(mat.concrete), [sx, 0.02, sz]);
  b.tube([sx, 0.01, sz], [sx, sh, sz], 0.009, 5, W(mat.metalLight));
  b.block(sx, sh, sz, cs, cs, cs, green);
  b.block(sx, sh + cs, sz, cs + 0.012, 0.01, cs + 0.012, white);
  for (let i = 0; i < 4; i++) b.group({ p: [sx, sh + cs / 2, sz], r: [0, i * HALF_PI, 0] }, () => {
    b.box(cs * 0.72, cs * 0.22, 0.006, white, [0, 0, cs / 2 + 0.002]);
    b.box(cs * 0.22, cs * 0.72, 0.006, white, [0, 0, cs / 2 + 0.002]);
  });
  b.block(sx, sh - 0.014, sz, cs * 0.5, 0.014, cs * 0.5, c.lamp);
  c.mark(sx, sz, 0.22, sh + cs);
  // Krankenwagen, Liegen, Kisten / ambulance, stretchers, crates
  if (lv >= 3) {
    b.group({ p: [0.04, 0.01, 0.11], r: [0, HALF_PI + 0.3, 0] }, () => {
      b.block(0, 0.012, 0, 0.066, 0.058, 0.15, white);
      b.block(0, 0.03, 0, 0.069, 0.014, 0.152, green);
      b.block(0, 0.044, 0.07, 0.056, 0.02, 0.012, mat.glassDark);
      b.block(0, 0.07, 0.03, 0.02, 0.01, 0.02, c.lamp);
      for (const wz of [-0.05, 0.05]) b.block(0, 0, wz, 0.074, 0.024, 0.03, mat.dark);
    });
  }
  const beds = Math.min(4, lv);
  for (let i = 0; i < beds; i++) {
    const x = -0.04 + i * 0.058, z = 0.31;
    b.block(x, 0.012, z, 0.036, 0.016, 0.08, W(mat.metal));
    b.block(x, 0.028, z, 0.032, 0.006, 0.074, white);
    b.block(x, 0.03, z - 0.026, 0.028, 0.008, 0.02, green);
  }
  if (lv >= 5) for (let i = 0; i < 3; i++) { crate(b, 0.3 - i * 0.012, 0.012 + (i === 2 ? 0.06 : 0), 0.1 + (i === 1 ? 0.07 : 0.01), 0.06, white); }
  if (lv >= 7) {
    // Wassertank / water tank
    b.cyl(0.045, 0.045, 0.07, 8, W(mat.metalLight), [-0.35, 0.115, -0.33]);
    for (const [dx, dz] of [[-0.03, -0.03], [0.03, -0.03], [0.03, 0.03], [-0.03, 0.03]] as [number, number][]) b.block(-0.35 + dx, 0, -0.33 + dz, 0.01, 0.08, 0.01, W(mat.metal));
  }
  mast(c, 0.185, -0.375, 0.34 + lv * 0.014, 1.0);
  scrub(c, [[0.3, 0.1], [0.05, 0.2], [-0.33, 0.05], [-0.02, 0.33]]);
}

function housing(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const tones = [W(mix(p.paper50, p.sand300, 0.3)), W(mix(p.paper100, p.water300, 0.22)), W(mix(p.paper100, p.orange500, 0.14))];
  // Wohnblock: Scheibe mit Fensterbaendern, Balkonen und Dachaufbau; die Balkonseite zeigt nach ry gedreht
  // apartment block: a slab with window bands, balconies and a roof hut; the balcony side faces as turned by ry
  const block = (x: number, z: number, len: number, dep: number, h: number, ry: number, tone: number) => {
    const floors = Math.max(2, Math.min(7, Math.round(h / 0.072)));
    const fh = h / floors;
    b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
      b.block(0, 0, 0, len, h, dep, tones[tone % 3]);
      b.block(0, 0, 0, len + 0.008, 0.02, dep + 0.008, W(mat.concreteDark));
      for (let i = 0; i < floors; i++) {
        const y = i * fh + fh * 0.42;
        b.block(0, y, 0, len + 0.006, fh * 0.34, dep + 0.006, c.win);
        // Balkonbruestung vorn, in zwei Abschnitten / balcony parapet at the front, in two sections
        if (i > 0) for (const s of [-1, 1]) b.block(s * len * 0.24, y - fh * 0.2, dep / 2 + 0.014, len * 0.36, fh * 0.34, 0.026, i % 2 ? c.A : c.A2);
      }
      // Treppenhaus und Eingang / stairwell and entrance
      b.block(0, 0, dep / 2 + 0.006, 0.05, h + 0.02, 0.014, tones[(tone + 1) % 3]);
      b.block(0, 0.02, dep / 2 + 0.014, 0.03, 0.045, 0.004, mat.darkMid);
      b.block(0, h, 0, len + 0.014, 0.014, dep + 0.014, W(mat.concrete));
      b.block(-len * 0.25, h + 0.014, 0, 0.06, 0.035, dep * 0.6, W(mat.concreteLight));
      b.tube([len * 0.3, h + 0.014, 0], [len * 0.3, h + 0.1, 0], 0.003, 3, mat.dark);
    });
  };
  const h1 = 0.27 + lv * 0.04;
  block(-0.1, -0.29, 0.46, 0.13, h1, 0, 0);
  c.mark(-0.1, -0.29, 0.26, h1 + 0.05);
  if (lv >= 2) block(-0.3, 0.02, 0.36, 0.13, 0.2 + lv * 0.03, HALF_PI, 1);
  if (gov) govQuarter(b, c.f, 0.28, -0.13);
  else if (lv >= 4) block(0.3, -0.13, 0.28, 0.13, 0.15 + lv * 0.026, HALF_PI, 2);
  if (lv >= 6) block(-0.02, -0.1, 0.24, 0.12, 0.1 + lv * 0.02, 0, 1);
  // Hof: Rasen, Baeume, Schaukel, Wege / courtyard: lawn, trees, a swing, paths
  if (works) { cityWorks(b, c.f, -0.06, 0.16, lv); c.smoke(-0.14, 0.37 + lv * 0.025, 0.08); }
  else {
    pad(b, -0.04, 0.16, 0.3, 0.26, W(K.lawn, 0.45));
    const trees: [number, number][] = [[-0.15, 0.08], [0.06, 0.24], [-0.13, 0.27]];
    trees.slice(0, c.neutral ? 1 : 2 + (lv >= 3 ? 1 : 0)).forEach(([x, z], i) => {
      b.cyl(0.008, 0.01, 0.05, 5, mat.wood, [x, 0.038, z]);
      b.add(geo.ico(0.042, 0), i % 2 ? mat.leaf : mat.leafDark, { p: [x, 0.095, z], r: [0, i, 0] });
    });
    // Schaukel / swing
    for (const s of [-1, 1]) { b.tube([-0.02 + s * 0.035, 0.014, 0.13], [-0.02 + s * 0.035, 0.07, 0.15], 0.004, 3, W(mat.red)); b.tube([-0.02 + s * 0.035, 0.014, 0.17], [-0.02 + s * 0.035, 0.07, 0.15], 0.004, 3, W(mat.red)); }
    b.tube([-0.06, 0.07, 0.15], [0.02, 0.07, 0.15], 0.004, 3, W(mat.red));
    b.block(-0.02, 0.028, 0.15, 0.022, 0.005, 0.012, W(mat.yellow));
  }
  // Parkplatz vorn links / parking in the front left
  const cars = c.neutral ? 1 : Math.min(4, Math.floor((lv + 1) / 2));
  const paints = [W(mat.red), W(mat.blue), W(mat.white), W(mat.yellow)];
  pad(b, -0.12, 0.345, 0.46, 0.06, K.asphaltLight);
  for (let i = 0; i < cars; i++) car(b, -0.3 + i * 0.1, 0.345, HALF_PI, paints[i % 4]);
  // Laterne / street lamp
  b.tube([0.13, 0.01, 0.06], [0.13, 0.12, 0.06], 0.004, 4, W(mat.metal));
  b.block(0.13, 0.118, 0.06, 0.02, 0.01, 0.02, c.lamp);
  // Flagge auf dem Dach des hinteren Blocks / flag on the roof of the rear block
  mast(c, -0.02, -0.29, 0.17, 0.95, h1 + 0.014);
  scrub(c, [[0.28, -0.05], [0.12, 0.2], [-0.05, 0.05], [0.3, -0.28]]);
}

function supermarket(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const wall = c.neutral ? W(mat.white, 0.3) : mat.white, sign = W(K.sign, 0.45), glass = c.win;
  // Parkplatz mit Buchten / car park with bays
  pad(b, 0.0, 0.2, 0.76, 0.36, K.asphalt);
  pad(b, 0.28, -0.18, 0.2, 0.4, K.asphalt);
  // Markt: flacher Kasten mit Blende, Vordach und Glasfront nach +z / store: a flat box with fascia, canopy and glass front towards +z
  const w = 0.5 + Math.min(lv, 4) * 0.008, d = 0.34, hx = -0.125, hz = -0.19, h = 0.125 + lv * 0.005;
  b.block(hx, 0, hz, w, h, d, wall);
  b.block(hx, h - 0.04, hz, w + 0.012, 0.04, d + 0.012, c.neutral ? W(K.steel) : c.A);
  b.block(hx, h, hz, w - 0.02, 0.012, d - 0.02, W(mat.concreteLight));
  b.block(hx + 0.02, 0.012, hz + d / 2 + 0.002, w * 0.72, h * 0.5, 0.006, glass);
  for (let i = 1; i < 6; i++) b.block(hx + 0.02 - w * 0.36 + i * (w * 0.12), 0.012, hz + d / 2 + 0.005, 0.006, h * 0.5, 0.006, wall);
  b.block(hx + w / 2 + 0.002, 0.03, hz, 0.006, 0.04, d * 0.6, glass);
  // Vordach auf Stuetzen / canopy on posts
  b.block(hx + 0.02, h * 0.62, hz + d / 2 + 0.04, w * 0.6, 0.012, 0.085, sign);
  for (const s of [-1, 1]) b.block(hx + 0.02 + s * w * 0.28, 0.012, hz + d / 2 + 0.075, 0.01, h * 0.62, 0.01, W(mat.metalLight));
  // Dachschild mit Buchstabenkloetzen / roof sign with letter blocks
  const sw = 0.26, sy = h + 0.012;
  b.block(hx + 0.02, sy, hz + d / 2 - 0.03, sw, 0.075, 0.022, sign);
  for (let i = 0; i < 5; i++) if (!(c.neutral && (i === 1 || i === 3))) b.block(hx + 0.02 - sw * 0.38 + i * sw * 0.19, sy + 0.02, hz + d / 2 - 0.018, 0.03, 0.036, 0.006, c.neutral ? W(mat.white) : mat.lamp);
  for (const s of [-1, 1]) b.block(hx + 0.02 + s * 0.1, h, hz + d / 2 - 0.045, 0.01, 0.03, 0.01, W(mat.metal));
  // Klimageraete / air-conditioning units
  for (let i = 0; i < 3; i++) b.block(hx - 0.14 + i * 0.12, h + 0.012, hz - 0.07, 0.06, 0.03, 0.05, W(mat.metal));
  if (lv >= 5) { b.block(hx - 0.1, h + 0.012, hz - 0.03, 0.24, 0.08, 0.2, wall); b.block(hx - 0.1, h + 0.07, hz - 0.03, 0.248, 0.024, 0.208, c.neutral ? W(K.steel) : c.A); b.block(hx - 0.1, h + 0.03, hz + 0.072, 0.2, 0.03, 0.006, glass); }
  // Werbepylon an der Einfahrt: das Wahrzeichen / pylon sign at the entrance: the landmark
  const px = -0.33, pz = 0.335, ph = 0.3 + lv * 0.024;
  b.block(px, 0.012, pz, 0.022, ph, 0.022, W(mat.metalLight));
  b.block(px, ph - 0.1, pz, 0.13, 0.11, 0.03, sign);
  b.block(px, ph + 0.01, pz, 0.14, 0.012, 0.036, wall);
  for (const s of [-1, 1]) {
    // Korb-Zeichen: Kasten mit Henkel / basket glyph: a box with a handle
    b.block(px, ph - 0.075, pz + s * 0.016, 0.07, 0.035, 0.004, c.neutral ? W(mat.white) : mat.lamp);
    b.block(px, ph - 0.035, pz + s * 0.016, 0.05, 0.008, 0.004, c.neutral ? W(mat.white) : mat.lamp);
  }
  c.mark(px, pz, 0.2, ph + 0.02);
  // Buchten und Autos / bays and cars
  for (let i = 0; i < 9; i++) paintLine(b, -0.2 + i * 0.066, 0.2, 0.008, 0.11, mat.white);
  const paints = [W(mat.red), W(mat.blue), W(mat.white), W(mat.yellow), W(mat.teal), W(mat.green), W(mat.orange)];
  const cars = c.neutral ? 1 : Math.min(7, 2 + lv);
  const order = [0, 3, 1, 6, 4, 2, 5];
  for (let i = 0; i < cars; i++) {
    const s = order[i];
    if (works && s < 2) continue;
    car(b, -0.167 + s * 0.066, 0.2, (i % 3 === 0 ? Math.PI : 0), paints[i % 7]);
  }
  if (c.neutral) car(b, 0.05, 0.31, 1.1, W(mat.rust));
  // Einkaufswagen-Unterstand / trolley shelter
  const tx = 0.24, tz = 0.02;
  for (const s of [-1, 1]) b.block(tx + s * 0.04, 0.012, tz, 0.006, 0.05, 0.006, W(mat.metalLight));
  b.block(tx, 0.06, tz, 0.1, 0.006, 0.07, c.neutral ? W(K.steel) : c.A);
  for (let i = 0; i < (c.neutral ? 1 : 4); i++) b.block(tx - 0.03 + i * 0.02, 0.016, tz, 0.014, 0.022, 0.03, W(mat.metalLight));
  if (c.neutral) b.box(0.014, 0.022, 0.03, W(mat.metalLight), [0.12, 0.022, 0.33], [0, 0.6, HALF_PI]);
  // Laternen / lamp posts
  for (const [x, z] of [[-0.05, 0.36], [0.3, 0.1]] as [number, number][]) {
    b.tube([x, 0.012, z], [x, 0.15, z], 0.004, 4, W(mat.metal));
    b.block(x, 0.148, z, 0.03, 0.008, 0.016, c.lamp);
  }
  // Lieferhof / delivery yard
  if (gov) govQuarter(b, c.f, 0.28, -0.26);
  else {
    if (lv >= 3) lorry(b, 0.29, -0.2, Math.PI, wall, sign);
    if (lv >= 6) {
      // Gewaechshaus der Gartenabteilung / greenhouse of the garden centre
      b.block(0.27, 0.012, -0.01, 0.16, 0.05, 0.12, mat.glass);
      b.add(geo.profileXY([[-0.085, 0], [0.085, 0], [0, 0.04]], 0.125), mat.glass, { p: [0.27, 0.062, -0.01] });
      b.box(0.17, 0.008, 0.008, wall, [0.27, 0.102, -0.01]);
    }
  }
  if (works) { cityWorks(b, c.f, -0.27, 0.24, lv); c.smoke(-0.35, 0.37 + lv * 0.025, 0.16); }
  mast(c, -0.36, -0.37, 0.3 + lv * 0.014, 0.95);
  scrub(c, [[0.3, 0.3], [-0.3, 0.1], [0.12, 0.08], [0.33, -0.33]]);
}

function factory(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const brick = W(K.brick), brickD = W(K.brickDark), roof = W(K.asphalt);
  // Backsteinhalle mit Doppelgiebel / brick hall with a double gable
  const w = 0.44, d = 0.36, hx = -0.14, hz = -0.14, h = 0.16 + lv * 0.007;
  b.block(hx, 0, hz, w, h, d, brick);
  b.block(hx, 0, hz, w + 0.012, 0.03, d + 0.012, brickD);
  b.block(hx, h - 0.016, hz, w + 0.012, 0.016, d + 0.012, c.A);
  for (const s of [-1, 1]) {
    ridgeRoof(b, hx, h, hz + s * d / 4, w + 0.02, d / 2 + 0.012, 0.075, roof);
    b.box(w * 0.7, 0.01, 0.03, c.neutral ? W(mat.glass) : mat.glass, [hx, h + 0.04, hz + s * d / 4 + 0.045], [0.55, 0, 0]);
  }
  // Pfeiler und hohe Fenster nach +z und +x / pilasters and tall windows towards +z and +x
  for (let i = 0; i <= 5; i++) b.block(hx - w / 2 + i * (w / 5), 0, hz + d / 2 + 0.004, 0.018, h, 0.012, brickD);
  for (let i = 0; i < 5; i++) if (i !== 2) b.block(hx - w / 2 + (i + 0.5) * (w / 5), h * 0.3, hz + d / 2 + 0.002, 0.045, h * 0.42, 0.006, c.win);
  b.block(hx, 0, hz + d / 2 + 0.003, 0.07, h * 0.62, 0.008, c.A);
  b.block(hx, 0, hz + d / 2 + 0.006, 0.056, h * 0.55, 0.008, mat.ink);
  for (let i = 0; i < 4; i++) b.block(hx + w / 2 + 0.002, h * 0.3, hz - d / 2 + (i + 0.5) * (d / 4), 0.006, h * 0.42, 0.045, c.win);
  if (!c.neutral && c.f) addEmblem(b, c.f, 0.032, 0.008, c.L.emblem, { p: [hx, h * 0.62 + 0.045, hz + d / 2 + 0.006] });
  // Schlote mit Ringen: das Wahrzeichen / stacks with bands: the landmark
  const spots: [number, number, number][] = [[-0.33, -0.34, 1], [-0.13, -0.36, 0.84], [0.06, -0.35, 0.72], [0.3, -0.33, 0.62]];
  const n = lv >= 7 ? 4 : lv >= 4 ? 3 : 2;
  const top = 0.5 + lv * 0.036;
  spots.slice(0, n).forEach(([x, z, k], i) => {
    if (gov && i === 3) return;
    const ch = top * k;
    b.cyl(0.027, 0.04, ch, 8, brick, [x, ch / 2, z]);
    b.cyl(0.044, 0.046, 0.03, 8, brickD, [x, 0.015, z]);
    b.cyl(0.031, 0.032, 0.026, 8, W(mat.white), [x, ch - 0.05, z]);
    b.cyl(0.032, 0.033, 0.022, 8, c.A, [x, ch - 0.09, z]);
    b.cyl(0.021, 0.021, 0.006, 8, mat.ink, [x, ch + 0.001, z]);
    if (!c.neutral) c.smoke(x, ch, z);
  });
  c.mark(-0.33, -0.34, 0.2, top);
  // Kesselhaus mit Rohrbruecke / boiler house with a pipe bridge
  if (gov) govQuarter(b, c.f, 0.27, -0.14);
  else {
    b.block(0.25, 0, -0.14, 0.2, 0.11, 0.24, brickD);
    b.block(0.25, 0.11, -0.14, 0.21, 0.014, 0.25, roof);
    b.block(0.352, 0.03, -0.14, 0.006, 0.05, 0.16, c.win);
    b.tube([0.15, 0.09, -0.2], [0.08, 0.09, -0.2], 0.012, 5, W(mat.metal));
    if (lv >= 3) for (const z of [-0.2, -0.08]) { b.cyl(0.04, 0.04, 0.1, 8, W(mat.metalLight), [0.25, 0.174, z]); b.cyl(0.042, 0.042, 0.016, 8, c.A, [0.25, 0.19, z]); }
  }
  // Kohlehalde, Paletten, Wasserturm / coal heap, pallets, water tower
  if (works) { cityWorks(b, c.f, -0.26, 0.25, lv); c.smoke(-0.34, 0.37 + lv * 0.025, 0.17); }
  else {
    b.add(geo.cone(0.085, 0.07, 7), mat.dark, { p: [-0.29, 0.045, 0.2] });
    if (lv >= 2) b.add(geo.cone(0.06, 0.05, 6), mat.darkMid, { p: [-0.2, 0.035, 0.29] });
    if (lv >= 6) {
      const tx = -0.33, tz = 0.32;
      for (const [dx, dz] of [[-0.03, -0.03], [0.03, -0.03], [0.03, 0.03], [-0.03, 0.03]] as [number, number][]) b.tube([tx + dx * 1.3, 0, tz + dz * 1.3], [tx + dx, 0.2, tz + dz], 0.005, 4, W(mat.metal));
      b.cyl(0.055, 0.05, 0.08, 8, W(mat.metalLight), [tx, 0.24, tz]);
      b.add(geo.cone(0.06, 0.035, 8), c.A, { p: [tx, 0.297, tz] });
    }
  }
  const pallets = Math.min(4, 1 + Math.floor(lv / 2));
  for (let i = 0; i < pallets; i++) crate(b, -0.07 + (i % 2) * 0.075, 0.012 + Math.floor(i / 2) * 0.064, 0.14, 0.064, i % 2 ? W(mat.woodLight) : c.A2);
  if (lv >= 5) lorry(b, 0.06, 0.28, HALF_PI, c.A, W(mat.woodLight));
  mast(c, -0.37, 0.075, 0.34 + lv * 0.014, 1.0);
  scrub(c, [[0.3, 0.05], [0.1, 0.2], [-0.1, 0.3], [0.33, -0.3]]);
}

function nuclearPlant(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const shell = W(mix(p.paper50, p.rock400, 0.3)), concL = W(mat.concreteLight);
  // Kuehlturm (Drehkoerper mit Taille): das Wahrzeichen / cooling tower (turned part with a waist): the landmark
  const tower = (x: number, z: number, r: number, h: number) => {
    const prof: LathePoint[] = [[r, 0, true], [r * 0.82, h * 0.3], [r * 0.66, h * 0.62], [r * 0.64, h * 0.76], [r * 0.72, h, true], [r * 0.62, h, true], [r * 0.56, h * 0.9]];
    b.add(geo.lathe(prof, 14), shell, { p: [x, 0.01, z] });
    b.cyl(r * 0.57, r * 0.57, 0.006, 14, mat.darkMid, [x, 0.01 + h * 0.9, z]);
    // Band in der Fraktionsfarbe unter dem Rand / band in the faction colour below the rim
    b.add(geo.cyl(r * 0.705, r * 0.672, h * 0.07, 14, true), c.A, { p: [x, 0.01 + h * 0.895, z] });
    b.add(geo.cyl(r * 1.02, r * 1.05, 0.03, 14, true), W(mat.concreteDark), { p: [x, 0.025, z] });
    for (const a of [0.8, 2.4, 4.0, 5.5]) b.add(geo.ico(0.009, 0), c.warn, { p: [x + Math.cos(a) * r * 0.72, 0.016 + h, z + Math.sin(a) * r * 0.72] });
    if (!c.neutral) {
      // Dampffahne / steam plume
      b.add(geo.ico(r * 0.5, 1), mat.cloud, { p: [x + 0.01, h + r * 0.34, z] });
      b.add(geo.ico(r * 0.4, 1), mat.cloudShade, { p: [x + r * 0.5, h + r * 0.7, z - r * 0.2] });
      b.add(geo.ico(r * 0.3, 0), mat.cloud, { p: [x + r * 0.95, h + r * 1.05, z - r * 0.3] });
      c.smoke(x + r * 0.9, h + r * 1.1, z - r * 0.3);
    }
  };
  const th = 0.36 + lv * 0.032;
  tower(-0.23, -0.23, 0.15, th);
  tower(0.05, -0.29, 0.12, th * 0.8);
  if (works) { cityWorks(b, c.f, -0.27, 0.25, lv); c.smoke(-0.35, 0.37 + lv * 0.025, 0.17); }
  else if (lv >= 5) tower(-0.29, 0.08, 0.105, th * 0.68);
  c.mark(-0.23, -0.23, 0.32, th);
  // Reaktorkuppel und Maschinenhaus / reactor dome and turbine hall
  const dome = (x: number, z: number, r: number) => {
    b.cyl(r, r, 0.09, 12, concL, [x, 0.045, z]);
    b.cyl(r + 0.004, r + 0.004, 0.018, 12, c.A, [x, 0.07, z]);
    b.add(geo.hemi(r, 12, 4), c.neutral ? W(mat.white) : mat.white, { p: [x, 0.09, z], s: [1, 0.85, 1] });
    b.cyl(0.012, 0.012, 0.03, 5, W(mat.metal), [x, 0.09 + r * 0.85, z]);
  };
  dome(0.02, 0.0, 0.095 + lv * 0.003);
  if (lv >= 7) dome(-0.1, 0.16, 0.075);
  if (gov) govQuarter(b, c.f, 0.28, -0.26);
  const hw = 0.19, hd = 0.24, hx = 0.265, hz = -0.03, hh = 0.1;
  if (!gov) {
    b.block(hx, 0, hz, hw, hh, hd, W(K.steel));
    b.block(hx, hh * 0.5, hz, hw + 0.008, 0.022, hd + 0.008, c.win);
    b.block(hx, hh, hz, hw + 0.012, 0.014, hd + 0.012, c.A);
    b.tube([0.11, 0.07, 0.0], [hx - hw / 2, 0.07, hz], 0.014, 5, W(mat.metal));
    for (let i = 0; i < 2; i++) b.block(hx - 0.04 + i * 0.08, hh + 0.014, hz - 0.03, 0.04, 0.03, 0.04, W(mat.metal));
  }
  // Schaltfeld mit Strommast und Warntafel / switchyard with a pylon and a warning board
  if (!works) {
    pylon(c, -0.06, 0.31, 0.26 + lv * 0.008);
    for (let i = 0; i < Math.min(3, 1 + Math.floor(lv / 2)); i++) { b.block(-0.2 - i * 0.055, 0.012, 0.3, 0.035, 0.05, 0.05, W(mat.metal)); b.cyl(0.006, 0.006, 0.03, 5, mat.white, [-0.2 - i * 0.055, 0.076, 0.3]); }
  }
  // Warntafel: gelbe Raute mit drei Punkten (kein amtliches Zeichen) / warning board: a yellow diamond with three dots (no official sign)
  b.group({ p: [0.1, 0.012, 0.19], r: [0, Math.PI / 4, 0] }, () => {
    b.block(0, 0, 0, 0.008, 0.06, 0.008, W(mat.metal));
    b.box(0.075, 0.075, 0.008, W(mat.yellow), [0, 0.09, 0], [0, 0, Math.PI / 4]);
    for (const a of [0, 2.094, 4.189]) b.box(0.016, 0.016, 0.012, mat.ink, [Math.sin(a) * 0.02, 0.09 + Math.cos(a) * 0.02, 0]);
  });
  mast(c, 0.2, -0.375, 0.34 + lv * 0.014, 1.0);
  scrub(c, [[0.3, 0.12], [0.12, 0.3], [-0.33, 0.3], [0.1, -0.12]]);
}

function solarFarm(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const panel = W(K.panel, 0.2), line = W(K.panelLine, 0.3), steel = W(mat.metal);
  pad(b, 0, 0, 0.74, 0.74, W(mix(p.sand300, p.rock400, 0.45)));
  // Modultisch: geneigte Flaeche nach +z, Raster, Stuetzen / module table: a slope towards +z, grid, posts
  // die Tische stehen je Stufe etwas hoeher / the tables stand a little higher per level
  const tilt = 0.56, dep = 0.105, ph = 0.068 + lv * 0.004;
  const row = (x: number, z: number, len: number) => {
    b.group({ p: [x, ph, z], r: [tilt, 0, 0] }, () => {
      b.box(len, 0.008, dep, panel, [0, 0, 0]);
      b.box(len + 0.006, 0.004, dep + 0.006, steel, [0, -0.005, 0]);
      b.box(len, 0.003, 0.006, line, [0, 0.005, 0]);
      const n = Math.max(2, Math.round(len / 0.085));
      for (let i = 1; i < n; i++) b.box(0.006, 0.003, dep, line, [-len / 2 + i * (len / n), 0.005, 0]);
    });
    const posts = Math.max(2, Math.round(len / 0.2) + 1);
    for (let i = 0; i < posts; i++) b.block(x - len / 2 + 0.02 + i * ((len - 0.04) / (posts - 1)), 0.012, z - 0.012, 0.01, ph, 0.01, steel);
  };
  const rows = lv >= 4 ? 5 : lv >= 2 ? 4 : 3;
  for (let i = 0; i < rows; i++) {
    const z = -0.31 + i * 0.132;
    if (works && i >= 3) continue;
    row(-0.125, z, 0.5);
  }
  c.mark(-0.125, -0.12, 0.5, ph + 0.05);
  // rechte Spalte: Trafohaus, Speichercontainer, Messmast / right column: transformer hut, battery containers, met mast
  if (gov) govQuarter(b, c.f, 0.27, -0.27);
  else {
    b.block(0.28, 0, -0.3, 0.13, 0.085, 0.12, c.neutral ? W(mat.white) : mat.white);
    b.block(0.28, 0.085, -0.3, 0.14, 0.014, 0.13, c.A);
    b.block(0.28, 0, -0.238, 0.03, 0.055, 0.006, W(mat.metal));
    b.block(0.347, 0.03, -0.3, 0.006, 0.02, 0.06, c.win);
    for (let i = 0; i < 3; i++) b.cyl(0.005, 0.005, 0.03, 5, mat.white, [0.24 + i * 0.04, 0.113, -0.3]);
  }
  const box = (z: number) => { container(b, 0.28, 0.012, z, c.neutral ? W(mat.white) : mat.white, HALF_PI, 0.14); b.block(0.28, 0.03, z, 0.07, 0.014, 0.144, c.A); };
  if (lv >= 3) box(-0.13);
  if (lv >= 6) box(-0.025);
  if (lv >= 4) {
    // nachgefuehrtes Segel auf Mast / tracking sail on a mast
    const mh = 0.16 + lv * 0.012;
    b.block(0.2, 0.012, 0.08, 0.05, 0.02, 0.05, W(mat.concrete));
    b.tube([0.2, 0.03, 0.08], [0.2, mh, 0.08], 0.008, 5, steel);
    b.group({ p: [0.2, mh, 0.08], r: [0.7, Math.PI / 4, 0] }, () => {
      b.box(0.15, 0.008, 0.12, panel, [0, 0, 0]);
      b.box(0.15, 0.003, 0.006, line, [0, 0.005, 0]);
      b.box(0.006, 0.003, 0.12, line, [0, 0.005, 0]);
    });
  }
  if (lv >= 7) {
    b.tube([0.33, 0.012, 0.06], [0.33, 0.13, 0.06], 0.006, 5, steel);
    b.group({ p: [0.33, 0.13, 0.06], r: [0.7, Math.PI / 4, 0] }, () => { b.box(0.1, 0.008, 0.08, panel, [0, 0, 0]); b.box(0.1, 0.003, 0.005, line, [0, 0.005, 0]); });
  }
  if (works) { cityWorks(b, c.f, -0.26, 0.25, lv); c.smoke(-0.34, 0.37 + lv * 0.025, 0.17); }
  // Kabeltrasse / cable duct
  b.block(0.155, 0.012, -0.1, 0.014, 0.008, 0.46, W(mat.concreteDark));
  mast(c, 0.19, -0.38, 0.3 + lv * 0.014, 0.95);
  scrub(c, [[0.3, 0.1], [0.05, 0.33], [-0.3, 0.33], [0.2, 0.26]]);
}

function windFarm(c: Ctx) {
  const { b, lv, W } = c;
  const gov = c.flags.govQuarter, works = c.flags.factory;
  const white = c.neutral ? W(mat.white, 0.28) : mat.white;
  pad(b, 0, 0, 0.74, 0.74, W(K.lawn, 0.5));
  for (const [x, z, w, d] of [[0.0, 0.12, 0.07, 0.5], [-0.02, -0.12, 0.5, 0.07]] as [number, number, number, number][]) pad(b, x, z, w, d, W(K.dirt));
  // Windrad: Turm, Gondel, drei Fluegel; die Rotorflaeche zeigt zur Standardkamera. Verlassen steht der Rotor still.
  // turbine: tower, nacelle, three blades; the rotor disc faces the default camera. Abandoned, the rotor stands still.
  const turbine = (x: number, z: number, h: number, blade: number, phase: number) => {
    const k = blade / ROTOR.blade;
    b.cyl(0.05, 0.056, 0.02, 8, W(mat.concrete), [x, 0.02, z]);
    b.tube([x, 0.02, z], [x, h, z], 0.024, 8, white, 0.012);
    b.cyl(0.0255, 0.0245, 0.03, 8, c.A, [x, 0.12, z]);
    b.group({ p: [x, h, z], r: [0, ROTOR.yaw, 0] }, () => {
      b.add(geo.cbox(0.045, 0.04, 0.1, 0.01), white, { p: [0, 0.008, -0.012] });
      b.block(0, 0.028, -0.03, 0.03, 0.006, 0.05, c.A);
      b.add(geo.ico(0.008, 0), c.warn, { p: [0, 0.04, -0.045] });
      if (!c.spin) b.group({ p: [0, ROTOR.hubY, ROTOR.hubZ], r: [0, 0, phase], s: k }, () => rotorParts(b, white, c.neutral ? W(mat.red) : mat.red));
    });
    if (c.spin) c.rotor(x + Math.sin(ROTOR.yaw) * ROTOR.hubZ, h + ROTOR.hubY, z + Math.cos(ROTOR.yaw) * ROTOR.hubZ, ROTOR.yaw, phase, k);
  };
  const th = 0.5 + lv * 0.03, bl = 0.19 + lv * 0.008;
  turbine(-0.25, -0.25, th, bl, 0.3);
  turbine(0.24, -0.2, th * 0.86, bl * 0.9, 1.25);
  if (!works && lv >= 4) turbine(-0.22, 0.24, th * 0.78, bl * 0.84, 2.0);
  if (works) { cityWorks(b, c.f, -0.26, 0.25, lv); c.smoke(-0.34, 0.37 + lv * 0.025, 0.17); }
  c.mark(-0.25, -0.25, 0.2, th + 0.04);
  // Umspannhaus mit Mast / substation with a pylon
  if (gov) govQuarter(b, c.f, 0.03, 0.0);
  else {
    b.block(0.0, 0.012, -0.02, 0.13, 0.08, 0.11, c.neutral ? W(mat.concreteLight) : mat.concreteLight);
    b.block(0.0, 0.092, -0.02, 0.14, 0.014, 0.12, c.A);
    b.block(0.0, 0.012, 0.037, 0.03, 0.055, 0.006, W(mat.metal));
    b.block(0.067, 0.04, -0.02, 0.006, 0.022, 0.05, c.win);
    b.block(0.045, 0.106, -0.02, 0.012, 0.012, 0.012, c.lamp);
  }
  if (lv >= 2) pylon(c, 0.3, 0.06, 0.2 + lv * 0.008);
  if (lv >= 3) lorry(b, 0.02, 0.2, 0.2, white, c.A);
  if (lv >= 6) { container(b, -0.32, 0.012, 0.0, white, HALF_PI, 0.14); b.block(-0.32, 0.03, 0.0, 0.07, 0.014, 0.144, c.A); }
  mast(c, 0.08, -0.37, 0.3 + lv * 0.014, 0.95);
  scrub(c, [[0.3, 0.3], [-0.05, 0.3], [-0.33, 0.05], [0.14, -0.3]]);
}

// ---------- Zusammenbau / assembly ----------

const KINDS: Record<BaseKind, (c: Ctx, sea: number) => void> = {
  barracks, bunker, tankFactory, airbase, gunWorks, navalStation, supplyDepot, fieldHospital, housing, supermarket, factory, nuclearPlant, solarFarm, windFarm,
};

/** Dreht sich bei dieser Art und diesem Besitzer etwas? / does anything spin for this kind and owner? */
const spins = (kind: BaseKind, f: FactionId | null, spin: boolean) => spin && kind === 'windFarm' && f !== null;

/**
 * Stuetzpunkt bauen. sea: Seite mit Wasser fuer den Marinestuetzpunkt (0 = +z, 1 = +x, 2 = -z, 3 = -x), sonst ohne Wirkung.
 * spin: die Rotoren besetzter Windraeder fehlen im Modell und stehen in meta.rotors (das Brett dreht sie); ohne spin
 * sind sie fest eingebaut (Vorschau, ohne Animationen).
 * Build a base. sea: side with water for the naval base (0 = +z, 1 = +x, 2 = -z, 3 = -x), no effect otherwise.
 * spin: the rotors of owned wind turbines are left out of the model and listed in meta.rotors (the board spins them);
 * without spin they are built in (preview, animations off).
 */
export function base(kind: BaseKind, f: FactionId | null, level: number, flags: BaseFlags, sea = 0, spin = false): { builder: Builder; meta: BaseMeta } {
  const b = new Builder();
  const L = look(f);
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  const neutral = f === null;
  const side = kind === 'navalStation' ? ((Math.floor(sea) % 4) + 4) % 4 : 0;
  const meta: BaseMeta = { hit: [], smoke: [], height: 0, rotors: [] };
  const W = (c: ColorLike, k = 0.34) => (neutral ? mix(c, K.dust, k) : col(c));
  const c: Ctx = {
    b, f, L, lv, neutral, flags,
    A: f ? L.primary.clone() : mix(mat.neutral, K.dust, 0.35),
    A2: f ? L.secondary.clone() : mix(mat.neutralDark, K.dust, 0.3),
    win: neutral ? mat.darkMid.clone() : mat.window.clone(),
    lamp: neutral ? mix(mat.metal, K.dust, 0.3) : f === 'zyrr' ? mat.xenoGlow.clone() : f === 'nexus' ? mat.cyanGlow.clone() : mat.lamp.clone(),
    warn: neutral ? mix(p.red700, K.dust, 0.5) : K.warn.clone(),
    W,
    smoke: (x, y, z) => { if (!neutral) meta.smoke.push([x * CITY_SCALE, y * CITY_SCALE, z * CITY_SCALE]); },
    mark: (x, z, w, h) => { meta.hit.push([x * CITY_SCALE, z * CITY_SCALE, w * CITY_SCALE, h * CITY_SCALE]); meta.height = Math.max(meta.height, h * CITY_SCALE); },
    spin: spins(kind, f, spin),
    rotor: (x, y, z, yaw, phase, k) => { meta.rotors.push([x * CITY_SCALE, y * CITY_SCALE, z * CITY_SCALE, yaw, phase, k * CITY_SCALE]); },
  };
  b.group({ s: [CITY_SCALE, CITY_SCALE, CITY_SCALE] }, () => {
    // Platz wie bei den Staedten / plaza like the cities
    const plaza = f ? mix(mat.concreteLight, L.wall, 0.35) : mix(mat.sand, mat.concreteLight, 0.3);
    b.block(0, 0, 0, 0.8, 0.01, 0.8, plaza);
    KINDS[kind](c, side);
    const open = kind === 'navalStation' ? side : -1;
    if (flags.bunkerRing) bunkerRing(b, f, false, open);
    else kerb(b, f, false, open);
    cornerMarks(c, open);
  });
  // breiter, flacher Trefferkoerper fuer den ganzen Platz / broad, flat hit body for the whole plaza
  meta.hit.unshift([0, 0, 0.78, Math.min(Math.max(meta.height, 0.14), 0.16 + lv * 0.02)]);
  return { builder: b, meta };
}

/** Kennwerte einer Stuetzpunkt-Geometrie (von baseGeometry) / facts of a base geometry (from baseGeometry) */
export function baseMeta(g: THREE.BufferGeometry): BaseMeta | undefined {
  return g.userData.base as BaseMeta | undefined;
}

/** Zwischengespeicherte Geometrie eines Stuetzpunkts; die Kennwerte stehen in userData.base / cached geometry of a base; the facts are in userData.base */
export function baseGeometry(kind: BaseKind, faction: FactionId | null, level: number, flags: BaseFlags, sea = 0, spin = false): THREE.BufferGeometry {
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  const side = kind === 'navalStation' ? ((Math.floor(sea) % 4) + 4) % 4 : 0;
  const turning = spins(kind, faction, spin);
  const key = `city|base|${kind}|${faction ?? 'neutral'}|${lv}|${+flags.factory}${+flags.bunkerRing}${+flags.govQuarter}|${side}${turning ? '|spin' : ''}`;
  return memo(key, () => {
    const { builder, meta } = base(kind, faction, lv, flags, side, turning);
    const g = builder.build();
    g.userData.base = meta;
    return g;
  });
}
