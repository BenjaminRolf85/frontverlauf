/**
 * Farbwelt der Modelle, abgeleitet aus den Design-Tokens / model palette derived from the design tokens.
 * Keine Farbliterale: alles kommt aus semantic, primitives.color oder factionTokens.
 * No colour literals: everything comes from semantic, primitives.color or factionTokens.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { factionTokens, primitives, semantic } from '../../design/tokens';
import { col, mix, shade } from './kit';

const p = primitives.color;

/** Gemeinsame Materialfarben / shared material colours */
export const mat = {
  ink: col(semantic.ink),
  dark: col(p.ink800),
  darkMid: col(p.ink700),
  metal: col(semantic.metal),
  metalLight: shade(semantic.metal, 1.35),
  white: col(semantic.white),
  paper: col(p.paper50),
  skin: mix(p.paper200, p.orange500, 0.14),
  wood: shade(p.paper300, 0.55),
  woodLight: shade(p.paper300, 0.78),
  sand: col(p.sand300),
  sandbag: shade(p.sand300, 0.88),
  concrete: col(p.rock400),
  concreteLight: shade(p.rock400, 1.25),
  concreteDark: col(p.rock600),
  glass: mix(p.water300, p.white, 0.35),
  glassDark: mix(p.sky700, p.water500, 0.35),
  window: col(p.sky800),
  windowLit: col(p.yellow400),
  gold: col(p.yellow500),
  yellow: col(p.yellow400),
  red: col(p.red500),
  green: col(p.green500),
  leaf: col(semantic.tree),
  leafDark: col(semantic.treeDark),
  grass: col(p.grass500),
  rock: col(semantic.terrainMountain),
  rockDark: col(semantic.terrainMountainDark),
  snow: col(semantic.snow),
  water: col(semantic.terrainShallow),
  waterDeep: col(semantic.terrainOcean),
  asphalt: col(p.ink700),
  cloud: col(semantic.cloud),
  cloudShade: col(semantic.cloudShade),
  neutral: col(semantic.neutral),
  neutralDark: col(semantic.neutralDark),
  orange: col(p.orange500),
  teal: col(p.teal500),
  blue: col(p.blue400),
  // Fremdwesen-Grundstoffe / alien base materials
  alienSkin: mix(p.rock400, p.xeno400, 0.35),
  alienSkinDark: mix(p.rock600, p.xeno600, 0.45),
  alienMetal: mix(p.ink700, p.xeno600, 0.55),
  alienMetalLight: mix(p.ink500, p.xeno400, 0.5),
  xenoGlow: col(semantic.xenoGlow),
  acid: col(semantic.xenoAcid),
  xenoGround: col(semantic.xenoGround),
  xenoGroundDark: col(semantic.xenoGroundDark),
  // Kult + Roboter / cult + robots
  bone: mix(p.paper50, p.paper300, 0.3),
  robe: mix(p.ink800, p.ink700, 0.4),
  rust: mix(p.orange500, p.ink700, 0.55),
  rustDark: mix(p.orange500, p.ink800, 0.72),
  ember: col(factionTokens.vesper.secondary),
  gunmetal: col(p.ink700),
  plate: mix(p.white, factionTokens.nexus.secondary, 0.5),
  cyanGlow: col(factionTokens.nexus.marker),
};

/** Bauform-Stil: Zyrr nutzt bei erbeuteter Menschentechnik die Hightech-Formen / shape style: Zyrr uses the hi-tech shapes for captured human equipment */
export type HumanStyle = 'korvat' | 'dravon' | 'alvenia' | 'meridon' | 'velkar';
export function styleOf(f: FactionId): HumanStyle {
  switch (f) {
    case 'zyrr': case 'nexus': return 'velkar';
    case 'vesper': return 'korvat';
    default: return f;
  }
}

/** Fraktionsoptik / faction look */
export interface Look {
  id: FactionId | 'neutral';
  primary: THREE.Color;
  primaryDark: THREE.Color;
  primaryLight: THREE.Color;
  secondary: THREE.Color;
  secondaryDark: THREE.Color;
  /** Helm / helmet */
  helmet: THREE.Color;
  /** Jacke / jacket */
  jacket: THREE.Color;
  /** Hose / trousers */
  pants: THREE.Color;
  /** Ausruestung (Gurt, Tasche) / gear */
  gear: THREE.Color;
  /** Fahrzeugrumpf / vehicle hull */
  hull: THREE.Color;
  hullDark: THREE.Color;
  /** Fahrzeug-Akzent / vehicle accent */
  trim: THREE.Color;
  /** Stadt: Wand, Dach, Zierde / city: wall, roof, trim */
  wall: THREE.Color;
  wallDark: THREE.Color;
  roof: THREE.Color;
  roofDark: THREE.Color;
  /** Emblemfarbe auf Primaerflaeche / emblem colour on primary surfaces */
  emblem: THREE.Color;
}

/** Gebaeudeflaechen gedaempft, Fraktionsfarbe nur als Akzent / building surfaces muted, faction colour only as accent */
function build(id: FactionId): Look {
  const raw = buildRaw(id);
  if (id === 'zyrr' || id === 'vesper' || id === 'nexus') return raw;
  const stone = col(p.paper100), stoneDark = col(p.paper300), roofN = shade(p.paper300, 0.62), roofNDark = shade(p.paper300, 0.45);
  return {
    ...raw,
    wall: mix(raw.wall, stone, 0.6), wallDark: mix(raw.wallDark, stoneDark, 0.6),
    roof: mix(raw.roof, roofN, 0.55), roofDark: mix(raw.roofDark, roofNDark, 0.55),
  };
}

function buildRaw(id: FactionId): Look {
  const t = factionTokens[id];
  const pr = col(t.primary);
  const se = col(t.secondary);
  const base = {
    id,
    primary: pr,
    primaryDark: shade(pr, 0.68),
    primaryLight: shade(pr, 1.3),
    secondary: se,
    secondaryDark: shade(se, 0.7),
    emblem: se,
  };
  switch (id) {
    case 'korvat':
      // Rot/Oliv, schlichte Uniform / red/olive, plain uniform
      return {
        ...base,
        helmet: shade(se, 1.05), jacket: pr, pants: shade(se, 0.62), gear: shade(se, 0.5),
        hull: pr, hullDark: shade(pr, 0.62), trim: se,
        wall: mix(p.rock400, p.paper200, 0.45), wallDark: shade(p.rock400, 0.85), roof: pr, roofDark: shade(se, 0.8),
        emblem: col(p.paper50),
      };
    case 'dravon':
      // Tarngruen mit schwarzem Visierhelm, Goldakzente / camo green with black visor helmet, gold accents
      return {
        ...base,
        helmet: col(p.dravonBlack), jacket: shade(pr, 1.12), pants: shade(pr, 0.52), gear: shade(pr, 0.42),
        hull: shade(pr, 1.1), hullDark: shade(pr, 0.7), trim: se,
        wall: shade(pr, 1.45), wallDark: pr, roof: shade(pr, 0.8), roofDark: shade(pr, 0.6),
        emblem: se,
      };
    case 'alvenia':
      // Blau/Weiss, offene Helme / blue/white, open helmets
      return {
        ...base,
        helmet: pr, jacket: pr, pants: shade(pr, 0.58), gear: se,
        hull: pr, hullDark: shade(pr, 0.65), trim: se,
        wall: se, wallDark: mix(se, pr, 0.25), roof: pr, roofDark: shade(pr, 0.7),
        emblem: se,
      };
    case 'meridon':
      // Tuerkis/Orange, Barett, leichte Weste / teal/orange, beret, light vest
      return {
        ...base,
        helmet: se, jacket: pr, pants: shade(pr, 0.5), gear: se,
        hull: pr, hullDark: shade(pr, 0.65), trim: se,
        wall: col(p.paper100), wallDark: col(p.paper300), roof: pr, roofDark: se,
        emblem: col(p.paper50),
      };
    case 'velkar':
      // Eisgrau/Hellgruen, Visier + Antenne, Schneetarn / ice grey/light green, visor + antenna, snow camo
      return {
        ...base,
        helmet: shade(pr, 1.1), jacket: pr, pants: shade(pr, 0.55), gear: shade(pr, 0.48),
        hull: pr, hullDark: shade(pr, 0.7), trim: se,
        wall: shade(pr, 1.2), wallDark: shade(pr, 0.85), roof: shade(pr, 0.75), roofDark: shade(pr, 0.6),
        emblem: se,
      };
    case 'vesper':
      // dunkle Kutten, Knochenmasken, Blutrot + Glut / dark robes, bone masks, blood red + ember
      return {
        ...base,
        helmet: mix(p.ink800, pr, 0.15), jacket: mix(p.ink800, p.ink700, 0.4), pants: col(p.ink800), gear: mix(p.orange500, p.ink700, 0.55),
        hull: mix(p.orange500, p.ink700, 0.55), hullDark: mix(p.orange500, p.ink800, 0.72), trim: se,
        wall: shade(p.paper300, 0.72), wallDark: shade(p.paper300, 0.5), roof: shade(pr, 0.85), roofDark: shade(pr, 0.6),
        emblem: mix(p.paper50, p.paper300, 0.3),
      };
    case 'nexus':
      // weisse Panzerplatten, Kanonenmetall, Cyan-Leuchtlinien / white plates, gunmetal, cyan light lines
      return {
        ...base,
        helmet: mix(p.white, se, 0.5), jacket: mix(p.white, se, 0.5), pants: col(p.ink700), gear: col(p.ink700),
        hull: mix(p.white, se, 0.5), hullDark: col(p.ink700), trim: pr,
        wall: mix(p.paper50, p.rock400, 0.25), wallDark: col(p.rock400), roof: col(p.ink700), roofDark: col(p.ink800),
        emblem: col(factionTokens.nexus.marker),
      };
    case 'zyrr':
      // Violett/Saeuregruen, organische Hochtechnologie / violet/acid green, organic high tech
      return {
        ...base,
        helmet: mix(p.rock400, p.xeno400, 0.35), jacket: pr, pants: col(p.xeno600), gear: shade(pr, 0.6),
        hull: pr, hullDark: col(p.xeno600), trim: se,
        wall: col(p.xeno400), wallDark: col(p.xeno600), roof: pr, roofDark: shade(pr, 0.65),
        emblem: se,
      };
  }
}

const neutral: Look = {
  id: 'neutral',
  primary: col(semantic.neutral),
  primaryDark: col(semantic.neutralDark),
  primaryLight: col(p.paper100),
  secondary: col(p.paper50),
  secondaryDark: col(p.paper300),
  helmet: col(semantic.neutral),
  jacket: col(semantic.neutral),
  pants: col(semantic.neutralDark),
  gear: col(semantic.neutralDark),
  hull: col(semantic.neutral),
  hullDark: col(semantic.neutralDark),
  trim: col(p.paper50),
  wall: col(p.paper100),
  wallDark: col(p.paper300),
  roof: shade(p.paper300, 0.62),
  roofDark: shade(p.paper300, 0.45),
  emblem: col(p.paper50),
};

const looks = new Map<string, Look>();
export function look(f: FactionId | null): Look {
  const k = f ?? 'neutral';
  let l = looks.get(k);
  if (!l) {
    l = f ? build(f) : neutral;
    looks.set(k, l);
  }
  return l;
}
