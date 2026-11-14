/**
 * Prozedurale 3D-Modelle (eigene Schoepfung, per Skript modelliert) / procedural 3D models (own creation, scripted).
 *
 * Konventionen / conventions:
 * - eine verschmolzene, nicht-indizierte BufferGeometry je Aufruf mit position, normal, color
 *   / one merged non-indexed BufferGeometry per call with position, normal, color
 * - Kachel 1x1, Ursprung unten mittig, y=0 = Kacheloberseite, Einheiten blicken nach +z
 *   / tile 1x1, origin bottom centre, y=0 = tile top, units face +z
 * - Ergebnisse werden zwischengespeichert und duerfen nicht veraendert werden
 *   / results are cached and must not be mutated
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildingId, FactionId, GrandProjectId, ResourceId, TerrainId, UnitTypeId } from '../../data/balance';
import { building, feature } from './buildings';
import { city } from './city';
import { memo, withDetail } from './kit';

/** Detailfaktor fuer Einheiten (Rundungssegmente) / detail factor for units (radial segments) */
const UNIT_DETAIL: Partial<Record<UnitTypeId, number>> = {
  // Wesen mit vielen Kugeln/Rohren etwas weniger / creatures with many spheres/tubes slightly less
  jeep: 1.45, terraformer: 1.25, spider: 1.25, tripod: 1.5, mech: 1.5, grey: 1.4, skimmer: 1.5, quadDrone: 1.5, railgun: 1.4,
};
import { cloud, decoration } from './nature';
import { battleship, destroyer, landingBoat, submarine } from './ships';
import { infantry, medic, mgTeam, pioneer, sniper, spy } from './soldiers';
import { artillery, heli, jeep, tank } from './vehicles';
import { grey, mech, skimmer, terraformer, tripod } from './aliens';
import { xenoFlora } from './xeno';
import { crashSite, jungle, labRuin, lava, volcano, volcanoSmoke } from './terrain';
import { doomBuggy, doomCrawler, prophet, rocketCart, torchbearer, zealot } from './cult';
import { android, quadDrone, railgun, spider, titan } from './robots';
import { antiAir, antiTank, faustZealot, flakDrone, mineLayer, mineModel } from './counters';

export function unitGeometry(type: UnitTypeId, faction: FactionId, carried: UnitTypeId | null): THREE.BufferGeometry {
  const c = type === 'landingBoat' && carried && carried !== 'landingBoat' ? carried : null;
  return memo(`unit|${type}|${faction}|${c ?? ''}`, () => finishUnit(type, withDetail(UNIT_DETAIL[type] ?? 1.6, true, () => {
    switch (type) {
      case 'infantry': return infantry(faction).build();
      case 'sniper': return sniper(faction).build();
      case 'jeep': return jeep(faction).build();
      case 'pioneer': return pioneer(faction).build();
      case 'mg': return mgTeam(faction).build();
      case 'medic': return medic(faction).build();
      case 'artillery': return artillery(faction).build();
      case 'spy': return spy(faction).build();
      case 'heli': return heli(faction).build();
      case 'tank': return tank(faction).build();
      case 'landingBoat': return landingBoat(faction, c ? carriedGeometry(c, faction) : null).build();
      case 'submarine': return submarine(faction).build();
      case 'destroyer': return destroyer(faction).build();
      case 'battleship': return battleship(faction).build();
      case 'grey': return grey(faction).build();
      case 'terraformer': return terraformer(faction).build();
      case 'skimmer': return skimmer(faction).build();
      case 'mech': return mech(faction).build();
      case 'tripod': return tripod(faction).build();
      case 'zealot': return zealot(faction).build();
      case 'torchbearer': return torchbearer(faction).build();
      case 'prophet': return prophet(faction).build();
      case 'doomBuggy': return doomBuggy(faction).build();
      case 'rocketCart': return rocketCart(faction).build();
      case 'doomCrawler': return doomCrawler(faction).build();
      case 'android': return android(faction).build();
      case 'spider': return spider(faction).build();
      case 'quadDrone': return quadDrone(faction).build();
      case 'railgun': return railgun(faction).build();
      case 'titan': return titan(faction).build();
      // Konter-Einheiten / counter units
      case 'antiTank': return antiTank(faction).build();
      case 'antiAir': return antiAir(faction).build();
      case 'mineLayer': return mineLayer(faction).build();
      case 'faustZealot': return faustZealot(faction).build();
      case 'flakDrone': return flakDrone(faction).build();
    }
  })));
}

/** Comic-Vergroesserung je Typ (begrenzt durch Kachel und Lebensbalken) / comic enlargement per type (limited by tile and HP badge) */
const UNIT_SIZE: Partial<Record<UnitTypeId, number>> = {
  infantry: 1.2, sniper: 1.2, pioneer: 1.2, mg: 1.15, medic: 1.25, spy: 1.25, artillery: 1.1, jeep: 1.2,
  zealot: 1.2, torchbearer: 1.2, prophet: 1.2, grey: 1.2, android: 1.2, doomBuggy: 1.2, rocketCart: 1.2, mech: 1.15,
  heli: 1.08, terraformer: 1.1, skimmer: 1.2, quadDrone: 1.25, spider: 1.15, titan: 1.1, doomCrawler: 1.15, tank: 1.05,
};
/** Breiter gebaut (x) / built wider (x) */
const UNIT_WIDE: Partial<Record<UnitTypeId, number>> = {
  tank: 1.18, doomCrawler: 1.1, titan: 1.08, jeep: 1.08, destroyer: 1.45, battleship: 1.4, submarine: 1.4, landingBoat: 1.15,
};
/** Hoechste Modellhoehe unter dem Lebensbalken / highest model point below the HP badge */
const MAX_H = 0.62;

/**
 * Lesbarkeit: Comic-Vergroesserung und Helligkeitsverlauf aus den vorhandenen Farben (unten dunkler, Oberseiten heller).
 * Readability: comic enlargement and a value ramp from the existing colours (darker low down, lighter top faces).
 */
function finishUnit(type: UnitTypeId, g: THREE.BufferGeometry): THREE.BufferGeometry {
  const wide = UNIT_WIDE[type];
  if (wide) {
    g.computeBoundingBox();
    const bx = g.boundingBox!;
    g.scale(Math.max(1, Math.min(wide, 0.45 / Math.max(-bx.min.x, bx.max.x))), 1, 1);
  }
  g.computeBoundingBox();
  let bb = g.boundingBox!;
  const ext = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
  const want = UNIT_SIZE[type] ?? 1;
  const s = Math.max(1, Math.min(want, 0.45 / ext, MAX_H / bb.max.y));
  if (s > 1.001) { g.scale(s, s, s); g.computeBoundingBox(); bb = g.boundingBox!; }
  const H = Math.max(0.15, bb.max.y);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), colr = g.getAttribute('color');
  const ship = type === 'landingBoat' || type === 'submarine' || type === 'destroyer' || type === 'battleship';
  const floor = ship ? 0.82 : 0.66;
  for (let i = 0; i < pos.count; i++) {
    const h = Math.min(1, Math.max(0, pos.getY(i) / (H * 0.42)));
    let k = floor + (1 - floor) * h * h * (3 - 2 * h);
    const ny = nor.getY(i);
    if (ny < -0.35) k *= 0.78;
    else if (ny > 0.55) k *= 1 + 0.2 * Math.min(1, Math.max(0, (pos.getY(i) / H - 0.25) / 0.6));
    colr.setXYZ(i, Math.min(1, colr.getX(i) * k), Math.min(1, colr.getY(i) * k), Math.min(1, colr.getZ(i) * k));
  }
  colr.needsUpdate = true;
  return g;
}

/** Vereinfachte Ladung fuer das Landungsboot (ohne Besatzung/Embleme) / simplified cargo for the landing boat */
function carriedGeometry(type: UnitTypeId, faction: FactionId): THREE.BufferGeometry {
  return memo(`unitLite|${type}|${faction}`, () => {
    switch (type) {
      case 'jeep': return jeep(faction, true).build();
      case 'tank': return tank(faction, true).build();
      case 'artillery': return artillery(faction, true).build();
      case 'heli': return heli(faction, true).build();
      case 'mg': return mgTeam(faction, true).build();
      case 'infantry': return infantry(faction, true).build();
      case 'sniper': return sniper(faction, true).build();
      case 'pioneer': return pioneer(faction, true).build();
      case 'medic': return medic(faction, true).build();
      case 'spy': return spy(faction, true).build();
      case 'grey': return grey(faction, true).build();
      case 'terraformer': return terraformer(faction, true).build();
      case 'skimmer': return skimmer(faction, true).build();
      case 'mech': return mech(faction, true).build();
      case 'tripod': return tripod(faction, true).build();
      case 'zealot': return zealot(faction, true).build();
      case 'torchbearer': return torchbearer(faction, true).build();
      case 'prophet': return prophet(faction, true).build();
      case 'doomBuggy': return doomBuggy(faction, true).build();
      case 'rocketCart': return rocketCart(faction, true).build();
      case 'doomCrawler': return doomCrawler(faction, true).build();
      case 'android': return android(faction, true).build();
      case 'spider': return spider(faction, true).build();
      case 'quadDrone': return quadDrone(faction, true).build();
      case 'railgun': return railgun(faction, true).build();
      case 'titan': return titan(faction, true).build();
      case 'antiTank': return antiTank(faction, true).build();
      case 'antiAir': return antiAir(faction, true).build();
      case 'mineLayer': return mineLayer(faction, true).build();
      case 'faustZealot': return faustZealot(faction, true).build();
      case 'flakDrone': return flakDrone(faction, true).build();
      default: return unitGeometry(type, faction, null).clone();
    }
  });
}

export function cityGeometry(
  faction: FactionId | null,
  level: number,
  flags: { hq: boolean; factory: boolean; bunkerRing: boolean; govQuarter: boolean },
): THREE.BufferGeometry {
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  const key = `city|${faction ?? 'neutral'}|${lv}|${+flags.hq}${+flags.factory}${+flags.bunkerRing}${+flags.govQuarter}`;
  return memo(key, () => city(faction, lv, flags).build());
}

export function buildingGeometry(kind: BuildingId | 'outpost' | GrandProjectId, faction: FactionId | null): THREE.BufferGeometry {
  const f = kind === 'road' ? null : faction;
  return memo(`building|${kind}|${f ?? 'neutral'}`, () => building(kind, f).build());
}

/** Verdeckte Mine, nur fuer den Besitzer sichtbar / hidden mine, visible to its owner only */
export function mineGeometry(faction: FactionId | null): THREE.BufferGeometry {
  return memo(`mine|${faction ?? 'neutral'}`, () => mineModel(faction).build());
}

export function featureGeometry(kind: 'bunker' | 'radar'): THREE.BufferGeometry {
  return memo(`feature|${kind}`, () => feature(kind).build());
}

const decoCache = new Map<string, THREE.BufferGeometry | null>();
export function decorationGeometry(terrain: TerrainId, resource: ResourceId | null, variant: number): THREE.BufferGeometry | null {
  const v = ((Math.floor(variant) % 4) + 4) % 4;
  const key = `deco|${terrain}|${resource ?? ''}|${v}`;
  if (decoCache.has(key)) return decoCache.get(key) ?? null;
  const b = decoration(terrain, resource, v);
  const g = b ? b.build() : null;
  if (g) g.name = key;
  decoCache.set(key, g);
  return g;
}

/** Fremdwesen-Flora fuer terraformte Felder (6 Varianten) / alien flora for terraformed tiles (6 variants) */
export function xenoDecoration(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 6) + 6) % 6;
  return memo(`xenoDeco|${v}`, () => xenoFlora(v).build());
}

/** Vulkan auf einer Bergkachel (3 Varianten) / volcano on a mountain tile (3 variants) */
export function volcanoGeometry(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 3) + 3) % 3;
  return memo(`volcano|${v}`, () => volcano(v).build());
}

/** Rauchwolken ueber dem Krater (wird animiert) / smoke puffs above the crater (animated by the renderer) */
export function volcanoSmokeGeometry(): THREE.BufferGeometry {
  return memo('volcanoSmoke', () => volcanoSmoke().build());
}

/** Lava-Ueberlagerung fuer brennende Kacheln (3 Varianten) / lava overlay for burning tiles (3 variants) */
export function lavaGeometry(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 3) + 3) % 3;
  return memo(`lava|${v}`, () => lava(v).build());
}

/** Abgestuerzte Untertasse (2 Varianten) / crashed saucer (2 variants) */
export function crashSiteGeometry(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 2) + 2) % 2;
  return memo(`crash|${v}`, () => crashSite(v).build());
}

/** Dichter Dschungel fuer Waldkacheln (4 Varianten) / dense jungle for forest tiles (4 variants) */
export function jungleDecoration(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 4) + 4) % 4;
  return memo(`jungle|${v}`, () => jungle(v).build());
}

/** Verlassene Forschungsstation (2 Varianten) / abandoned research facility (2 variants) */
export function labRuinGeometry(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 2) + 2) % 2;
  return memo(`labRuin|${v}`, () => labRuin(v).build());
}

export function cloudGeometry(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 4) + 4) % 4;
  return memo(`cloud|${v}`, () => cloud(v).build());
}

/**
 * Zusatz: Geometrie mit geglaetteten Normalen fuer eine Inverted-Hull-Kontur (nur position + normal).
 * Extra: geometry with smoothed normals for an inverted-hull outline (position + normal only).
 */
export function outlineGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  return memo(`outline|${source.name || source.uuid}`, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', source.getAttribute('position').clone());
    const merged = mergeVertices(g, 1e-4);
    merged.computeVertexNormals();
    return merged;
  });
}
