/**
 * Staedte, die mit jeder Stufe sichtbar wachsen / cities that grow visibly with every level.
 * 3x3-Raster aus Zellen; Fabrikhalle, Regierungsviertel und HQ-Mast belegen feste Zellen,
 * der Bunkerring umschliesst die Stadt.
 * 3x3 grid of cells; factory hall, government quarter and HQ mast take fixed cells,
 * the bunker ring encloses the city.
 *
 * Die Stadt ist das wichtigste Objekt der Karte: Sie fuellt ihr Feld (CITY_SCALE), steht auf einem Sockel mit Bordstein in
 * der Fraktionsfarbe und waechst je Stufe deutlich in die Hoehe; ab Stufe 3 ueberragt das Wahrzeichen jede Einheit.
 * The city is the most important object on the map: it fills its tile (CITY_SCALE), stands on a plinth with a kerb in the
 * faction colour and grows clearly taller per level; from level 3 the landmark towers above every unit.
 */
import type { FactionId } from '../../data/balance';
import { HALF_PI, band, chimney, flagPole, house } from './architecture';
import { sawtoothHall } from './buildings';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng } from './kit';
import { look, mat } from './look';

export interface CityFlags { hq: boolean; factory: boolean; bunkerRing: boolean; govQuarter: boolean }

/**
 * Massstab des ganzen Modells: der Platz (0.8 im Modell) deckt damit 0.96 Feldbreiten.
 * Scale of the whole model: the plaza (0.8 in the model) then covers 0.96 tile widths.
 */
export const CITY_SCALE = 1.2;
/** Wandhoehe des Wahrzeichens je Stufe (Modellmass) / wall height of the landmark per level (model units) */
const LANDMARK_H = [0, 0.24, 0.34, 0.46, 0.57, 0.67, 0.76, 0.84, 0.91];
/** HQ-Mast: Position im Modell und Hoehe je Stufe / HQ mast: position in the model and height per level */
const MAST = { x: -0.335, z: 0.325, flag: 1.75 };
const mastHeight = (lv: number) => Math.min(1.08, Math.max(0.7 + lv * 0.03, LANDMARK_H[lv] + 0.26));

/**
 * Spitze des HQ-Masts relativ zur Feldmitte (fuer das Leuchtfeuer) / top of the HQ mast relative to the tile centre (for the beacon).
 */
export function hqMastTop(level: number): [number, number, number] {
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  return [MAST.x * CITY_SCALE, (mastHeight(lv) + 0.05) * CITY_SCALE, MAST.z * CITY_SCALE];
}

/**
 * Hoechster Punkt der Haeuser (ohne Mast und Schlot) in Feldbreiten: fuer die Trefferflaeche beim Antippen.
 * Highest point of the houses (without mast and chimney) in tile widths: for the hit area when tapping.
 */
export function cityHeight(level: number, neutral: boolean): number {
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  return (neutral ? 0.2 + lv * 0.02 : LANDMARK_H[lv]) * CITY_SCALE;
}

const C = 0.255; // Zellabstand / cell pitch
type Cell = { id: string; x: number; z: number };
/**
 * Reihenfolge der Bebauung: Mitte, dann quer und nach hinten; die vordere Ecke (+x, +z, zur Standardkamera) bleibt am
 * laengsten frei, dort steht die Besatzung der Stadt.
 * Order of construction: centre, then across and to the back; the front corner (+x, +z, towards the default camera)
 * stays free the longest, that is where the city's garrison stands.
 */
const ORDER: Cell[] = [
  { id: 'c', x: 0, z: 0 },
  { id: 'l', x: -C, z: 0 },
  { id: 'b', x: 0, z: -C },
  { id: 'r', x: C, z: 0 },
  { id: 'f', x: 0, z: C },
  { id: 'bl', x: -C, z: -C },
  { id: 'br', x: C, z: -C },
  { id: 'fl', x: -C, z: C },
  { id: 'fr', x: C, z: C },
];

function houseCount(level: number, neutral: boolean): number {
  const n = [0, 3, 4, 5, 7, 8, 9, 10, 11][Math.min(8, Math.max(1, level))];
  return neutral ? Math.min(n, 6) : n;
}

export function govQuarter(b: Builder, f: FactionId | null, x: number, z: number) {
  const L = look(f);
  b.group({ p: [x, 0, z] }, () => {
    b.block(0, 0, 0, 0.23, 0.02, 0.23, mat.concreteLight);
    b.block(0, 0.02, -0.01, 0.2, 0.12, 0.16, mat.paper);
    band(b, 0, 0.08, -0.01, 0.2, 0.16, 0.016, mat.window);
    for (let i = 0; i < 4; i++) b.cyl(0.011, 0.013, 0.11, 6, mat.white, [-0.075 + i * 0.05, 0.075, 0.085]);
    b.block(0, 0.13, 0.0, 0.22, 0.02, 0.2, mat.concreteLight);
    b.cyl(0.07, 0.075, 0.05, 12, mat.paper, [0, 0.175, 0]);
    b.add(geo.hemi(0.072, 12, 4), f ? L.primary : mat.gold, { p: [0, 0.2, 0] });
    b.cyl(0.008, 0.012, 0.07, 6, mat.gold, [0, 0.3, 0]);
    b.add(geo.ico(0.014, 0), mat.gold, { p: [0, 0.34, 0] });
  });
}

export function factory(b: Builder, f: FactionId | null, x: number, z: number, level: number) {
  sawtoothHall(b, f, x + 0.02, z + 0.02, 0.2, 0.2, 0.1, 3);
  chimney(b, x - 0.08, 0, z - 0.08, 0.36 + level * 0.025, 0.028, mat.concreteLight);
}

function hq(b: Builder, f: FactionId | null, x: number, z: number, level: number) {
  const L = look(f);
  // Kommandogebaeude + Mast mit Fraktionsflagge / command building + mast with faction flag
  b.group({ p: [x + 0.03, 0, z - 0.02] }, () => {
    b.block(0, 0, 0, 0.16, 0.12, 0.13, f ? L.wallDark : mat.concrete);
    band(b, 0, 0.065, 0, 0.16, 0.13, 0.02, f ? L.primary : mat.neutral);
    b.block(0, 0.12, 0, 0.17, 0.015, 0.14, f ? L.roofDark : mat.concreteDark);
    b.block(0, 0.135, 0, 0.1, 0.012, 0.08, mat.gold);
    if (f) addEmblem(b, f, 0.034, 0.006, L.emblem, { p: [0, 0.035, 0.068] });
  });
  // hoher Mast mit grosser Flagge: das Hauptquartier erkennt man von weitem / tall mast with a big flag: the HQ is recognisable from afar
  b.cyl(0.03, 0.036, 0.03, 8, mat.gold, [MAST.x, 0.015, MAST.z]);
  flagPole(b, f, MAST.x, 0, MAST.z, mastHeight(level), MAST.flag);
}

/** open: Seite ohne Mauer (0 = +z, 1 = +x, 2 = -z, 3 = -x; Hafenbecken der Stuetzpunkte) / open: side without a wall (harbour basin of the bases) */
export function bunkerRing(b: Builder, f: FactionId | null, gold: boolean, open = -1) {
  const L = look(f);
  const R = 0.385;
  const t = 0.035;
  const h = 0.075;
  const trim = f ? L.primary : mat.concreteDark;
  for (let side = 0; side < 4; side++) {
    if (side === open) continue;
    b.group({ r: [0, side * HALF_PI, 0] }, () => {
      // zwei Mauerstuecke mit Tor in der Mitte / two wall pieces with a gate in the middle
      for (const s of [-1, 1]) {
        const len = R - 0.07;
        b.block(s * (0.07 + len / 2), 0, R, len, h, t, mat.concrete);
        b.block(s * (0.07 + len / 2), h, R, len, 0.012, t + 0.006, trim);
        for (let k = 0; k < 3; k++) b.block(s * (0.1 + k * 0.1), h + 0.012, R, 0.04, 0.025, t, mat.concreteLight);
      }
      // Torpfosten / gate posts
      for (const s of [-1, 1]) b.block(s * 0.07, 0, R, 0.04, h + 0.03, t + 0.012, mat.concreteDark);
    });
  }
  // Ecktuerme / corner towers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cyl(0.042, 0.048, 0.11, 6, mat.concreteLight, [sx * R, 0.055, sz * R]);
    b.cyl(0.05, 0.05, 0.016, 6, gold ? mat.gold : trim, [sx * R, 0.118, sz * R]);
    b.box(0.03, 0.012, 0.012, mat.ink, [sx * R, 0.08, sz * R + sz * 0.04], [0, 0, 0]);
  }
}

/**
 * Bordstein rund um den Platz in der Fraktionsfarbe (Dorf: Holz); das Hauptquartier traegt goldene Eckpfosten.
 * open: Seite ohne Bordstein (wie bunkerRing).
 * Kerb around the plaza in the faction colour (village: wood); the HQ carries golden corner posts.
 * open: side without a kerb (like bunkerRing).
 */
export function kerb(b: Builder, f: FactionId | null, gold: boolean, open = -1) {
  const L = look(f);
  const c = f ? L.primary : mat.wood;
  const R = 0.385, t = 0.03, h = 0.026;
  for (let side = 0; side < 4; side++) if (side !== open) b.group({ r: [0, side * HALF_PI, 0] }, () => { b.block(0, 0, R, 2 * R + t, h, t, c); });
  if (gold) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cyl(0.03, 0.034, 0.07, 6, mat.gold, [sx * R, 0.035, sz * R]);
    b.add(geo.ico(0.022, 0), mat.gold, { p: [sx * R, 0.085, sz * R] });
  }
}

export function city(f: FactionId | null, level: number, flags: CityFlags): Builder {
  const b = new Builder();
  const L = look(f);
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  const R = rng(lv * 131 + (f ? f.length * 17 + f.charCodeAt(0) : 3));
  const neutral = f === null;
  b.group({ s: [CITY_SCALE, CITY_SCALE, CITY_SCALE] }, () => {
    // Platz / plaza
    const plaza = f ? mix(mat.concreteLight, L.wall, 0.35) : mix(mat.sand, mat.concreteLight, 0.3);
    b.block(0, 0, 0, 0.8, 0.01, 0.8, plaza);
    b.block(0, 0.01, 0, 0.06, 0.003, 0.8, f ? mat.concrete : mat.sand);
    b.block(0, 0.01, 0, 0.8, 0.003, 0.06, f ? mat.concrete : mat.sand);
    const reserved = new Set<string>();
    if (flags.factory) reserved.add('bl');
    if (flags.govQuarter) reserved.add('br');
    if (flags.hq) reserved.add('fl');
    const cells = ORDER.filter((c) => !reserved.has(c.id));
    const n = houseCount(lv, neutral);
    type Slot = { x: number; z: number; w: number; d: number; centre: boolean; id: string };
    const slots: Slot[] = [];
    const free = cells.length;
    let split = Math.max(0, n - free);
    for (const c of cells) {
      if (slots.length >= n) break;
      const centre = c.id === 'c';
      if (!centre && split > 0) {
        split--;
        slots.push({ x: c.x - 0.058, z: c.z, w: 0.095, d: 0.16, centre: false, id: c.id });
        slots.push({ x: c.x + 0.062, z: c.z, w: 0.095, d: 0.16, centre: false, id: c.id });
      } else {
        slots.push({ x: c.x, z: c.z, w: centre ? 0.2 : 0.165, d: centre ? 0.2 : 0.15, centre, id: c.id });
      }
    }
    const top = neutral ? 0.2 + lv * 0.02 : LANDMARK_H[lv];
    slots.forEach((s, i) => {
      let h: number;
      if (s.centre) h = top;
      else h = Math.min(0.5, 0.1 + lv * 0.035 + R() * (0.03 + lv * 0.018));
      // Grossstadt: zweites und drittes Hochhaus hinten / big city: second and third high-rise at the back
      if (!neutral && !s.centre && s.w > 0.1 && ((lv >= 5 && s.id === 'b') || (lv >= 7 && s.id === 'l'))) h = top * (s.id === 'b' ? 0.74 : 0.6);
      if (neutral) h = Math.min(h, 0.24);
      const jitter = s.centre ? 0 : (R() - 0.5) * 0.02;
      house(b, f, s.x + jitter, s.z + jitter, s.w, s.d, h, {
        seed: i * 7 + lv, landmark: s.centre && lv >= 3, ry: s.w < 0.1 ? 0 : (R() < 0.3 ? HALF_PI : 0),
      });
    });
    if (flags.factory) factory(b, f, -C, -C, lv);
    if (flags.govQuarter) govQuarter(b, f, C, -C);
    if (flags.hq) hq(b, f, -C, C, lv);
    if (flags.bunkerRing) bunkerRing(b, f, flags.hq);
    else kerb(b, f, flags.hq);
    // Kleine Baeume im neutralen Dorf / small trees in the neutral village
    if (neutral && !flags.bunkerRing) {
      for (const [x, z] of [[-0.33, 0.33], [0.33, -0.33]] as [number, number][]) {
        b.cyl(0.01, 0.012, 0.05, 5, mat.wood, [x, 0.025, z]);
        b.add(geo.dodeca(0.045), mat.leaf, { p: [x, 0.08, z] });
      }
    }
  });
  return b;
}
