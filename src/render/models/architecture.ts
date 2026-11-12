/**
 * Gemeinsame Bauteile fuer Gebaeude und Staedte / shared parts for buildings and cities.
 * Jede Fraktion hat ihren Baustil / every faction has its own building style:
 * Korvat Plattenbau mit Flachdach, Dravon dunkler Stein mit spitzen Dachpyramiden und Gold,
 * Alvenia weisse Waende mit blauen Satteldaechern, Meridon helle Flachdachhaeuser mit Markisen und Containern,
 * Velkar sechseckige Hightech-Bauten mit Schneehauben, neutral: Dorfhaeuser mit Holzdaechern.
 */
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng, shade, type ColorLike } from './kit';
import { look, mat, type Look } from './look';

export const HALF_PI = Math.PI / 2;

/** Satteldach, First entlang z / gable roof, ridge along z */
export function gableRoof(b: Builder, x: number, y: number, z: number, w: number, d: number, h: number, c: ColorLike, ry = 0) {
  b.group({ p: [x, y, z], r: [0, ry, 0] }, () => {
    b.add(geo.profileXY([[-w / 2, 0], [w / 2, 0], [0, h]], d), c);
  });
}

/** Fensterband rund um einen Quader / window band around a block */
export function band(b: Builder, x: number, y: number, z: number, w: number, d: number, h: number, c: ColorLike, ry = 0) {
  b.block(x, y, z, w + 0.008, h, d + 0.008, c, ry);
}

/** Fenstersprossen auf Vorder- und rechter Seite / window mullions on front and right side */
export function mullions(b: Builder, w: number, d: number, y: number, h: number, c: ColorLike) {
  const n = Math.max(2, Math.round(w / 0.045));
  for (let i = 1; i < n; i++) b.box(0.006, h + 0.004, 0.006, c, [-w / 2 + (i / n) * w, y + h / 2, d / 2 + 0.005]);
  const m = Math.max(2, Math.round(d / 0.045));
  for (let i = 1; i < m; i++) b.box(0.006, h + 0.004, 0.006, c, [w / 2 + 0.005, y + h / 2, -d / 2 + (i / m) * d]);
}

/** Tuer mit Rahmen und Vordach / door with frame and canopy */
export function door(b: Builder, z: number, c: ColorLike, frame: ColorLike, w = 0.032, h = 0.05) {
  b.box(w + 0.01, h + 0.006, 0.004, frame, [0, h / 2, z + 0.001]);
  b.box(w, h, 0.006, c, [0, h / 2, z + 0.003]);
  b.box(w + 0.02, 0.006, 0.016, frame, [0, h + 0.006, z + 0.008]);
}

/** Fahnenmast mit Fraktionsflagge und Emblem / flag pole with faction flag and emblem */
export function flagPole(b: Builder, f: FactionId | null, x: number, y: number, z: number, h: number, size = 1) {
  const L = look(f);
  b.cyl(0.008 * size, 0.011 * size, h, 5, mat.metalLight, [x, y + h / 2, z]);
  b.add(geo.ico(0.014 * size, 0), mat.gold, { p: [x, y + h + 0.01 * size, z] });
  const fw = 0.16 * size, fh = 0.1 * size;
  b.block(x + fw / 2 + 0.008, y + h - fh - 0.005, z, fw, fh, 0.008, f ? L.primary : mat.white);
  if (f) {
    // ein durchgehendes Emblem, beidseitig sichtbar / one emblem through the flag, visible on both sides
    addEmblem(b, f, fh * 0.36, 0.014, L.emblem, { p: [x + fw / 2 + 0.008, y + h - fh / 2 - 0.005, z] });
  }
}

export function crate(b: Builder, x: number, y: number, z: number, s: number, c: ColorLike = mat.woodLight, ry = 0) {
  b.block(x, y, z, s, s, s, c, ry);
  b.block(x, y + s * 0.4, z, s + 0.006, s * 0.2, s + 0.006, shade(c, 0.7), ry);
}

export function barrel(b: Builder, x: number, y: number, z: number, c: ColorLike) {
  b.cyl(0.028, 0.028, 0.07, 8, c, [x, y + 0.035, z]);
  b.cyl(0.03, 0.03, 0.01, 8, shade(c, 0.7), [x, y + 0.05, z]);
}

/** Schiffscontainer / shipping container */
export function container(b: Builder, x: number, y: number, z: number, c: ColorLike, ry = 0, len = 0.16) {
  b.group({ p: [x, y, z], r: [0, ry, 0] }, () => {
    b.block(0, 0, 0, len, 0.06, 0.065, c);
    const n = Math.max(3, Math.round(len / 0.035));
    for (let i = 0; i < n; i++) b.block(-len / 2 + (i + 0.5) * (len / n), 0.003, 0, 0.007, 0.056, 0.069, shade(c, 0.75));
  });
}

/** Schlot mit Rauchwolken / chimney with smoke puffs */
export function chimney(b: Builder, x: number, y: number, z: number, h: number, r: number, c: ColorLike, smoke = true) {
  b.cyl(r * 0.8, r, h, 8, c, [x, y + h / 2, z]);
  b.cyl(r * 0.9, r * 0.9, 0.025, 8, mat.red, [x, y + h - 0.03, z]);
  if (smoke) {
    b.add(geo.ico(r * 1.2, 0), mat.cloudShade, { p: [x, y + h + r * 1.1, z] });
    b.add(geo.ico(r * 0.9, 0), mat.cloud, { p: [x + r * 1.2, y + h + r * 2.6, z - r * 0.6] });
  }
}

export function sandbag(b: Builder, x: number, y: number, z: number, ry: number, s = 1) {
  b.add(geo.taper(0.115 * s, 0.07 * s, 0.095 * s, 0.05 * s, 0.045 * s), mat.sandbag, { p: [x, y + 0.0225 * s, z], r: [0, ry, 0] });
}

/** Satellitenschuessel / satellite dish */
export function dish(b: Builder, x: number, y: number, z: number, r: number, tilt: number, c: ColorLike = mat.white, ry = 0) {
  b.cyl(r * 0.12, r * 0.18, r * 0.7, 6, mat.metal, [x, y + r * 0.35, z]);
  b.group({ p: [x, y + r * 0.8, z], r: [0, ry, 0] }, () => {
    b.group({ r: [tilt, 0, 0] }, () => {
      b.add(geo.cyl(r, r * 0.3, r * 0.45, 10), c, { p: [0, r * 0.225, 0] });
      b.add(geo.cyl(r * 0.82, r * 0.82, 0.006, 10), mat.metalLight, { p: [0, r * 0.45 + 0.003, 0] });
      b.tube([0, r * 0.3, 0], [0, r * 0.95, 0], r * 0.05, 4, mat.dark);
      b.add(geo.ico(r * 0.1, 0), mat.dark, { p: [0, r * 0.95, 0] });
    });
  });
}

export interface HouseOpts {
  ry?: number;
  seed?: number;
  /** Wahrzeichen (hoeher, Spitze) / landmark (taller, spire) */
  landmark?: boolean;
}

/**
 * Haus im Fraktionsstil, Grundflaeche w x d, Wandhoehe h, Boden bei y=0.
 * House in faction style, footprint w x d, wall height h, base at y=0.
 */
export function house(b: Builder, f: FactionId | null, x: number, z: number, w: number, d: number, h: number, o: HouseOpts = {}) {
  const L = look(f);
  const R = rng(o.seed ?? 1);
  const ry = o.ry ?? 0;
  // hoechstens 4 Fensterbaender (Dreiecksbudget) / at most 4 window bands (triangle budget)
  const floors = Math.min(4, Math.max(1, Math.round(h / 0.085)));
  b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    switch (f) {
      case 'korvat': {
        // Plattenbau, Flachdach / prefab block, flat roof
        b.block(0, 0, 0, w, h, d, L.wall);
        for (let i = 0; i < floors; i++) {
          band(b, 0, (i + 0.45) * (h / floors), 0, w, d, 0.018, mat.window);
          if (i < 3) mullions(b, w, d, (i + 0.45) * (h / floors), 0.018, L.wall);
        }
        door(b, d / 2, L.roof, L.wallDark);
        b.block(0, h, 0, w + 0.016, 0.018, d + 0.016, L.roofDark);
        b.block(0, h - 0.03, d / 2 + 0.002, w * 0.3, 0.03, 0.006, L.roof);
        if (o.landmark) {
          b.block(0, h + 0.018, 0, w * 0.5, 0.05, d * 0.5, L.wallDark);
          b.block(0, h + 0.068, 0, w * 0.52, 0.02, d * 0.52, L.roof);
        } else if (R() < 0.5) b.block(w * 0.2, h + 0.018, -d * 0.2, 0.04, 0.03, 0.04, L.wallDark);
        break;
      }
      case 'dravon': {
        // dunkler Stein, spitze Pyramidendaecher, Goldkanten / dark stone, sharp pyramid roofs, gold trim
        b.block(0, 0, 0, w, h, d, L.wall);
        b.block(0, 0, 0, w + 0.012, Math.min(0.04, h * 0.25), d + 0.012, L.wallDark);
        for (let i = 0; i < floors; i++) {
          band(b, 0, (i + 0.5) * (h / floors), 0, w, d, 0.014, L.secondary);
          if (i < 3) mullions(b, w, d, (i + 0.5) * (h / floors) - 0.022, 0.02, L.wallDark);
        }
        door(b, d / 2, mat.dark, L.secondary, 0.034, 0.045);
        const rh = Math.max(w, d) * (o.landmark ? 1.05 : 0.8);
        b.add(geo.cone(Math.SQRT1_2 * 1.02, 1, 4).rotateY(Math.PI / 4), L.roof, { p: [0, h + rh / 2, 0], s: [w, rh, d] });
        if (o.landmark || R() < 0.35) b.add(geo.cone(0.012, 0.08, 4), L.secondary, { p: [0, h + rh + 0.03, 0] });
        break;
      }
      case 'alvenia': {
        // weisse Waende, blaue Satteldaecher, runde Ecktuerme / white walls, blue gable roofs, round towers
        if (o.landmark) {
          const r = Math.min(w, d) * 0.5;
          b.cyl(r, r, h, 10, L.wall, [0, h / 2, 0]);
          for (let i = 0; i < floors; i++) b.add(geo.cyl(r + 0.004, r + 0.004, 0.016, 10, true), L.wallDark, { p: [0, (i + 0.5) * (h / floors), 0] });
          b.add(geo.cone(r * 1.15, r * 2, 10), L.roof, { p: [0, h + r, 0] });
        } else {
          b.block(0, 0, 0, w, h, d, L.wall);
          for (let i = 0; i < floors; i++) {
            band(b, 0, (i + 0.45) * (h / floors), 0, w, d, 0.016, L.wallDark);
            if (i < 3) mullions(b, w, d, (i + 0.45) * (h / floors), 0.016, L.wall);
          }
          b.block(w * 0.28, h, -d * 0.1, 0.022, Math.min(0.12, w * 0.55) * 0.8, 0.022, mat.concreteDark);
          b.block(0, 0, d / 2 + 0.002, 0.03, 0.05, 0.006, L.roofDark);
          gableRoof(b, 0, h, 0, w + 0.03, d + 0.03, Math.min(0.12, w * 0.55), L.roof);
        }
        break;
      }
      case 'meridon': {
        // helle Flachdachhaeuser mit Markise oder Containerstapel / light flat-roof houses with awning or container stack
        if (!o.landmark && R() < 0.35 && h < 0.2) {
          const tones = [L.primary, L.secondary, mix(L.primary, mat.white, 0.4)];
          const n = Math.max(1, Math.round(h / 0.06));
          for (let i = 0; i < n; i++) container(b, 0, i * 0.06, 0, tones[(i + Math.floor(R() * 3)) % 3], 0, Math.max(w, 0.12));
        } else {
          b.block(0, 0, 0, w, h, d, L.wall);
          for (let i = 0; i < floors; i++) {
            band(b, 0, (i + 0.45) * (h / floors), 0, w, d, 0.016, L.roof);
            if (i < 3) mullions(b, w, d, (i + 0.45) * (h / floors), 0.016, L.wall);
          }
          door(b, d / 2, L.secondary, L.wallDark);
          b.block(0, h, 0, w + 0.01, 0.014, d + 0.01, L.wallDark);
          b.box(w * 0.8, 0.008, 0.05, L.secondary, [0, h * 0.35, d / 2 + 0.022], [0.35, 0, 0]);
          if (o.landmark) {
            b.add(geo.hemi(Math.min(w, d) * 0.36, 10, 3), L.primary, { p: [0, h + 0.014, 0] });
            b.cyl(0.006, 0.006, 0.08, 4, mat.metal, [0, h + Math.min(w, d) * 0.36 + 0.05, 0]);
          } else {
            b.block(-w * 0.2, h + 0.014, -d * 0.2, w * 0.35, 0.03, d * 0.35, L.secondary);
          }
        }
        break;
      }
      case 'velkar': {
        // Sechseck-Bauten, Lichtbaender, Schneehaube / hexagonal buildings, light bands, snow cap
        const r = Math.min(w, d) * 0.56;
        b.cyl(r, r, h, 6, L.wall, [0, h / 2, 0]);
        for (let i = 0; i < floors; i++) b.add(geo.cyl(r + 0.004, r + 0.004, 0.012, 6, true), i % 2 ? L.secondary : mat.window, { p: [0, (i + 0.5) * (h / floors), 0] });
        b.cyl(r * 0.75, r * 1.04, 0.04, 6, L.roof, [0, h + 0.02, 0]);
        b.cyl(r * 0.55, r * 0.74, 0.016, 6, mat.snow, [0, h + 0.048, 0]);
        // Lichtleisten an den Kanten + Eingang / light strips on the edges + entrance
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          b.box(0.006, h * 0.9, 0.006, i % 2 ? L.secondary : L.wallDark, [Math.sin(a) * (r + 0.002), h * 0.45, Math.cos(a) * (r + 0.002)]);
        }
        b.add(geo.cbox(0.04, 0.05, 0.03, 0.008), L.wallDark, { p: [0, 0.025, r * 0.87] });
        b.box(0.026, 0.04, 0.004, mat.glassDark, [0, 0.022, r * 0.87 + 0.016]);
        if (o.landmark) {
          b.cyl(0.005, 0.008, 0.16, 4, mat.metal, [0, h + 0.13, 0]);
          b.add(geo.ico(0.014, 0), L.secondary, { p: [0, h + 0.215, 0] });
        }
        break;
      }
      default: {
        // neutrales Dorfhaus / neutral village house
        b.block(0, 0, 0, w, h, d, L.wall);
        door(b, d / 2, mat.wood, mat.woodLight, 0.03, 0.05);
        for (const x of [-w * 0.28, w * 0.28]) {
          b.block(x, h * 0.42, d / 2 + 0.002, 0.03, 0.03, 0.006, mat.window);
          for (const s of [-1, 1]) b.block(x + s * 0.021, h * 0.42, d / 2 + 0.003, 0.012, 0.032, 0.006, L.roofDark);
        }
        b.block(w / 2 + 0.002, h * 0.42, 0, 0.006, 0.03, 0.03, mat.window);
        gableRoof(b, 0, h, 0, w + 0.03, d + 0.03, Math.min(0.11, w * 0.55), L.roof);
        b.block(-w * 0.25, h, -d * 0.15, 0.025, 0.07, 0.025, mat.concreteDark);
        break;
      }
    }
  });
}

/** Dachfarbe/Akzent fuer Wirtschaftsgebaeude / roof colour for economy buildings */
export function roofOf(f: FactionId | null): Look['roof'] {
  return look(f).roof;
}
