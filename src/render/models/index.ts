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
 * - Drehtuerme: Turmteile im Modell in b.turret([x, y, z], () => { ... }) bauen (Drehpunkt = Mitte des Turmkranzes,
 *   Rohr nach +z); das Brett dreht den Turm dann zum Ziel. Beispiel (tanks.ts):
 *     const ty = 0.155, tz = -0.03;
 *     b.turret([0, ty, tz], () => { b.add(geo.rtaper(...), L.hull, { p: [0, ty + 0.045, tz] }); gun(b, 0, ty + 0.048, tz + 0.14, ...); });
 *   Wanne, Ketten und Embleme an der Wanne bleiben ausserhalb. Mehrere Tuerme moeglich, { arc } begrenzt den Schwenk.
 *   / turrets: build turret parts inside b.turret([x, y, z], () => { ... }) (pivot = centre of the turret ring, barrel
 *   along +z); the board then turns the turret towards the target. Hull, tracks and hull emblems stay outside.
 *   Several turrets are possible, { arc } limits the traverse.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wonderGeometry, type WonderType } from './wonders';
import { WONDER_UNITS, type BuildingId, type FactionId, type GrandProjectId, type ResourceId, type TerrainId, type UnitTypeId } from '../../data/balance';
import { building, feature } from './buildings';
import { tank } from './vehicles';
import { city } from './city';
import { memo, scaleWithTurrets, withDetail } from './kit';
export { splitTurrets, turretsOf, type TurretRange, type TurretSplit } from './kit';
import { semantic } from '../../design/tokens';
import { leader, type LeaderMood } from './leaders';
export { LEADER_MOODS, type LeaderMood } from './leaders';

/** Detailfaktor fuer Einheiten (Rundungssegmente) / detail factor for units (radial segments) */
const UNIT_DETAIL: Partial<Record<UnitTypeId, number>> = {
  // Wesen mit vielen Kugeln/Rohren etwas weniger / creatures with many spheres/tubes slightly less
  jeep: 1.45, terraformer: 1.25, spider: 1.25, tripod: 1.5, mech: 1.5, grey: 1.4, skimmer: 1.5, quadDrone: 1.5, railgun: 1.4,
  // Endgegner: gross genug fuer volle Rundung, aber viele Teile / boss: large enough for full roundness, but many parts
  swarmMother: 1.2,
  // Velkar: Tesla-Panzer mit vielen Ringen / Velkar: Tesla tank with many rings
  teslaTank: 1.25,
  // Korvat-Koloss und NEXUS-Baureihen mit vielen Teilen / Korvat colossus and NEXUS series with many parts
  steppeColossus: 1.3, cyborg: 1.4, flameTank: 1.4, kamikazeDrone: 1.5,
};
import { cloud, decoration, forestFringe } from './nature';
import { battleship, destroyer, landingBoat, submarine } from './ships';
import { infantry, medic, mgTeam, pioneer, sniper, spy } from './soldiers';
import { artillery, heli, jeep } from './vehicles';
import { grey, mech, skimmer, terraformer, tripod } from './aliens';
import { xenoFlora } from './xeno';
import { crashSite, jungle, labRuin, lava, volcano, volcanoSmoke } from './terrain';
import { berserker, doomBuggy, doomCrawler, memorial, prophet, rocketCart, torchbearer, zealot } from './cult';
import { android, quadDrone, railgun, spider, titan } from './robots';
import { antiAir, antiTank, faustZealot, flakDrone, mineLayer, mineModel } from './counters';
import { peacekeeper, privateer, protoWalker, steppeRider, stormbreaker } from './unique';
import { swarmMother } from './boss';
import { mothership, mothershipSmoke } from './mothership';
import { scientist } from './scientist';
import { coilLauncher, octocopter, railSniper, sensorCarrier, teslaTank } from './velkarTech';
import { SPARK_MUZZLE, divineSpark, lightWarden, reliquary, sunLance } from './alveniaFaith';
import { steppeColossus } from './korvatHeavy';
import { cyborg, flameTank, kamikazeDrone } from './nexusSeries';
import { fogCutter, guidedMissile, marine, radarTruck, shadowCommando } from './shadowFleet';
import { withGlow } from '../atmosphere';
export { techParts, type TechPart } from './velkarTech';

/**
 * PLATZHALTER fuer die Wunder der Siegbedingungen, bis wonders.ts mit wonderGeometry(type, faction, stage) da ist.
 * Hier austauschen: `return wonderGeometry(type, faction, stage);`
 * PLACEHOLDER for the victory wonders until wonders.ts with wonderGeometry(type, faction, stage) exists.
 * Swap here: `return wonderGeometry(type, faction, stage);`
 * stage: Bauphase (0 = im Bau) / build phase (0 = under construction).
 */

/**
 * Detailstufe der Einheitenmodelle: 'high' = Feinmodellierung mit Zusatzdetails und runderen Formen, 'low' = dieselben
 * Modelle ohne die Zusaetze (schwache Geraete). Gilt fuer alle danach angeforderten Einheiten; beide Stufen liegen
 * getrennt im Zwischenspeicher. Das Brett setzt die Stufe aus der Qualitaetseinstellung.
 * Detail level of the unit models: 'high' = fine modelling with extra detail and rounder shapes, 'low' = the same
 * models without the extras (weak devices). Applies to all units requested afterwards; both levels are cached
 * separately. The board sets the level from the quality setting.
 */
export type UnitQuality = 'low' | 'high';
/**
 * Dreiecks-Obergrenze je Einheitenmodell (jede Fraktion, beide Detailstufen); der Endgegner ist doppelt so gross.
 * Die Tuschelinie zeichnet jedes Modell ein zweites Mal. Genaue Grenzen je Typ: tests/unit-model-budget.test.ts.
 * Triangle ceiling per unit model (any faction, both detail levels); the boss is twice the size. The ink line draws
 * every model a second time. Exact limits per type: tests/unit-model-budget.test.ts.
 */
export const UNIT_TRI_LIMIT = 9500;
export const UNIT_TRI_LIMIT_BOSS = 16500;
let unitQuality: UnitQuality = 'high';
export function setUnitQuality(q: UnitQuality): void {
  unitQuality = q;
}
export function getUnitQuality(): UnitQuality {
  return unitQuality;
}

export function unitGeometry(type: UnitTypeId, faction: FactionId, carried: UnitTypeId | null, stage = 0): THREE.BufferGeometry {
  const c = (type === 'landingBoat' || type === 'fogCutter') && carried && carried !== type ? carried : null;
  const wonder = (WONDER_UNITS as UnitTypeId[]).includes(type);
  // Siegbauwerke: eigene Modelle in Bauwerksgroesse, ohne Groessen- und Tonwert-Anpassung der Einheiten
  // victory wonders: own models at structure size, without the unit size and value adjustments
  if (wonder) return wonderGeometry(type as WonderType, faction, stage);
  const hi = unitQuality === 'high';
  return memo(`unit|${type}|${faction}|${c ?? ''}${hi ? '' : '|low'}`, () => finishUnit(type, techGlow(faction, withDetail(UNIT_DETAIL[type] ?? 1.6, true, () => {
    switch (type) {
      case 'infantry': return infantry(faction).build();
      case 'sniper': return sniper(faction).build();
      // Velkar "Labor im Feld": Sensortraeger statt Jeep, Spulenwerfer statt Geschuetz / sensor carrier instead of the jeep, coil launcher instead of the gun
      case 'jeep': return (faction === 'velkar' ? sensorCarrier(faction) : jeep(faction)).build();
      case 'pioneer': return pioneer(faction).build();
      case 'mg': return mgTeam(faction).build();
      case 'medic': return medic(faction).build();
      case 'artillery': return (faction === 'velkar' ? coilLauncher(faction) : artillery(faction)).build();
      case 'spy': return spy(faction).build();
      case 'heli': return heli(faction).build();
      case 'tank': return tank(faction).build();
      // Velkar-Bauarten / Velkar designs
      case 'teslaTank': return teslaTank(faction).build();
      case 'octocopter': return octocopter(faction).build();
      case 'railSniper': return railSniper(faction).build();
      // Alvenia-Bauarten / Alvenia designs
      case 'lightWarden': return lightWarden(faction).build();
      case 'reliquary': return reliquary(faction).build();
      case 'sunLance': return sunLance(faction).build();
      // Goettlicher Funke: Landkreuzer-Geschuetz (Groessenklasse riesig, wie gebaut); Muendung fuer den Funken merken
      // Divine Spark: land cruiser gun (giant size class, as built); remember the muzzle for the spark
      case 'divineSpark': { const g = divineSpark(faction).build(); g.userData.muzzle = SPARK_MUZZLE; return g; }
      // Korvat: Steppenkoloss / Korvat: Steppe Colossus
      case 'steppeColossus': return steppeColossus(faction).build();
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
      case 'berserker': return berserker(faction).build();
      case 'doomBuggy': return doomBuggy(faction).build();
      case 'rocketCart': return rocketCart(faction).build();
      case 'doomCrawler': return doomCrawler(faction).build();
      case 'android': return android(faction).build();
      case 'spider': return spider(faction).build();
      case 'quadDrone': return quadDrone(faction).build();
      case 'railgun': return railgun(faction).build();
      case 'titan': return titan(faction).build();
      // NEXUS: neue Baureihen / NEXUS: new series
      case 'cyborg': return cyborg(faction).build();
      case 'flameTank': return flameTank(faction).build();
      case 'kamikazeDrone': return kamikazeDrone(faction).build();
      // Meridon-Schattenflotte / Meridon shadow fleet
      case 'shadowCommando': return shadowCommando(faction).build();
      case 'fogCutter': return fogCutter(faction, c ? carriedGeometry(c, faction) : null).build();
      case 'guidedMissile': return guidedMissile(faction).build();
      case 'radarTruck': return radarTruck(faction).build();
      case 'marine': return marine(faction).build();
      // Konter-Einheiten / counter units
      case 'antiTank': return antiTank(faction).build();
      case 'antiAir': return antiAir(faction).build();
      case 'mineLayer': return mineLayer(faction).build();
      case 'faustZealot': return faustZealot(faction).build();
      case 'flakDrone': return flakDrone(faction).build();
      // Einzigartige Einheiten / unique units
      case 'steppeRider': return steppeRider(faction).build();
      case 'stormbreaker': return stormbreaker(faction).build();
      case 'peacekeeper': return peacekeeper(faction).build();
      case 'privateer': return privateer(faction).build();
      case 'protoWalker': return protoWalker(faction).build();
      // Endgegner (doppelte Einheitengroesse) / boss (twice unit size)
      case 'swarmMother': return swarmMother(faction).build();
      // Kampagne m2 / campaign m2
      case 'scientist': return scientist(faction).build();
      // Wunder der Siegbedingungen / victory wonders
      default: return wonderGeometry(type as WonderType, faction, stage);
    }
  }, { smooth: true, fine: hi }))));
}

/**
 * Velkar: Leuchtmaske fuer die tuerkisen Lichter, vor dem Helligkeitsverlauf (der die Vertexfarben veraendert); das Brett
 * zeichnet solche Einheiten mit dem leuchtenden Einheitenmaterial. Andere Fraktionen bleiben unveraendert.
 * Velkar: glow mask for the teal lights, before the value ramp (which changes the vertex colours); the board draws such
 * units with the glowing unit material. Other factions stay unchanged.
 */
function techGlow(faction: FactionId, g: THREE.BufferGeometry): THREE.BufferGeometry {
  // Heiliges Alvenia: Sonnenkranz, tuerkise Leuchten, Buntglas / Holy Alvenia: sun halo, teal lights, stained glass
  if (faction !== 'velkar' && faction !== 'alvenia') return g;
  withGlow(g, 'nature');
  g.userData.unitGlow = true;
  return g;
}

/**
 * Groessenklasse je Typ: Zielmassstab der Comic-Vergroesserung, begrenzt durch Kachel (0.45) und Lebensbalken (MAX_H).
 * Unter 1 = bewusst kleiner gezeichnet (leichte Typen), sonst nur so weit vergroessert, wie Kachel und Hoehe erlauben.
 * Die Klassen trennen die Typen nach Masse: klein und niedrig (Spaeher, Spion, Scharfschuetze, leichte Wagen), mittel
 * (Schuetze, Kuttentraeger), breit (MG-Nest, Panzerabwehr, Pionier), hoch (Sanitaeter), gross (Helden, schwere Sonderbauarten).
 * Size class per type: target scale of the comic enlargement, limited by the tile (0.45) and the HP badge (MAX_H).
 * Below 1 = deliberately drawn smaller (light types), otherwise enlarged only as far as tile and height allow.
 * The classes separate the types by mass: small and low (scouts, spy, sniper, light cars), medium (rifleman, robed units),
 * wide (MG nest, anti-tank, pioneer), tall (medic), large (heroes, heavy faction designs).
 */
const UNIT_SIZE: Partial<Record<UnitTypeId, number>> = {
  // Fusstruppen / foot troops
  infantry: 1.2, sniper: 1.2, pioneer: 1.2, mg: 1.25, medic: 1.25, spy: 0.92, antiTank: 1.2, scientist: 1.25,
  zealot: 1.2, torchbearer: 1.2, prophet: 1.25, faustZealot: 1.15, grey: 1.2, android: 1.2, cyborg: 1.2, berserker: 1.2,
  shadowCommando: 0.95, railSniper: 1.2, lightWarden: 1.2,
  // Helden und schwere Fusstruppen (Marines: Elite, groesser als der Schuetze) / heroes and heavy foot troops (marines: elite, larger than the rifleman)
  steppeRider: 1.1, stormbreaker: 1.4, marine: 1.3, peacekeeper: 1.15, protoWalker: 1.1,
  // Fahrzeuge: leichte Wagen kleiner, schwere Sonderbauarten groesser / vehicles: light cars smaller, heavy faction designs larger
  jeep: 1.0, radarTruck: 1.1, doomBuggy: 1.05, artillery: 1.1, rocketCart: 1.2, mech: 1.15,
  heli: 1.08, terraformer: 1.1, skimmer: 1.2, quadDrone: 1.25, spider: 1.15, titan: 1.15, doomCrawler: 1.2, tank: 1.1,
  teslaTank: 1.25, octocopter: 1.1, reliquary: 1.05, sunLance: 1.1,
  steppeColossus: 1.1, flameTank: 1.15, kamikazeDrone: 1.3, guidedMissile: 1.25,
};
/**
 * Form je Typ vor der Groessenklasse: [Breite x, Hoehe y, Laenge z]. Breiter und laenger nur bis zum Kachelrand.
 * Schiffe: Landungsboot kurz und breit, Zerstoerer schlank und mittellang, Schlachtschiff lang, breit und hoch.
 * Shape per type before the size class: [width x, height y, length z]. Wider and longer only up to the tile edge.
 * Ships: landing boat short and wide, destroyer slim and of medium length, battleship long, wide and tall.
 */
const UNIT_SHAPE: Partial<Record<UnitTypeId, [number, number, number]>> = {
  tank: [1.18, 1, 1], doomCrawler: [1.1, 1, 1], titan: [1.08, 1, 1], jeep: [1.08, 1, 1], steppeColossus: [1.04, 1, 1], reliquary: [1.35, 1.1, 1], mineLayer: [1, 0.82, 1],
  landingBoat: [1.15, 1, 1], submarine: [1.3, 0.9, 1], destroyer: [1.15, 1.25, 0.94], battleship: [1.6, 1.1, 1],
  privateer: [1.45, 1.05, 1], fogCutter: [1.35, 0.9, 0.84],
};
/** Hoechste Modellhoehe unter dem Lebensbalken / highest model point below the HP badge */
const MAX_H = 0.62;

/**
 * Lesbarkeit: Comic-Vergroesserung und Helligkeitsverlauf aus den vorhandenen Farben (unten dunkler, Oberseiten heller).
 * Readability: comic enlargement and a value ramp from the existing colours (darker low down, lighter top faces).
 */
function finishUnit(type: UnitTypeId, g: THREE.BufferGeometry): THREE.BufferGeometry {
  const shape = UNIT_SHAPE[type];
  if (shape) {
    g.computeBoundingBox();
    const bx = g.boundingBox!;
    // breiter/laenger hoechstens bis zum Kachelrand / wider/longer at most up to the tile edge
    const fit = (k: number, ext: number) => (k > 1 ? Math.max(1, Math.min(k, 0.45 / ext)) : k);
    const sy = Math.min(shape[1], Math.max(1, MAX_H / bx.max.y));
    scaleWithTurrets(g, fit(shape[0], Math.max(-bx.min.x, bx.max.x)), sy, fit(shape[2], Math.max(-bx.min.z, bx.max.z)));
  }
  g.computeBoundingBox();
  let bb = g.boundingBox!;
  const ext = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
  const want = UNIT_SIZE[type] ?? 1;
  const room = Math.min(0.45 / ext, MAX_H / bb.max.y);
  // kleiner als 1 nur auf Wunsch (leichte Typen); Modelle ueber der Grenze bleiben wie gebaut / below 1 only on request (light types); models over the limit stay as built
  const s = want < 1 ? Math.min(want, room) : Math.max(1, Math.min(want, room));
  if (Math.abs(s - 1) > 0.001) { scaleWithTurrets(g, s, s, s); g.computeBoundingBox(); bb = g.boundingBox!; }
  // Vergroesserung merken: bewegliche Teile (techParts) sitzen in denselben Koordinaten / remember the enlargement: moving parts (techParts) use the same coordinates
  g.userData.finishScale = s;
  const H = Math.max(0.15, bb.max.y);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), colr = g.getAttribute('color');
  const ship = type === 'landingBoat' || type === 'submarine' || type === 'destroyer' || type === 'battleship' || type === 'privateer' || type === 'fogCutter';
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

/**
 * Anfuehrer-Bueste der Fraktion (Kopf und Schultern, Blick +z, Ursprung unten mittig, ca. 1.0 hoch, 0.9 breit).
 * Faction leader bust (head and shoulders, facing +z, origin bottom centre, about 1.0 tall and 0.9 wide).
 */
export function leaderGeometry(faction: FactionId, mood: LeaderMood = 'neutral'): THREE.BufferGeometry {
  return memo(`leader|${faction}|${mood}`, () => withDetail(1, true, () => leader(faction, mood).build()));
}

/** Vereinfachte Ladung fuer das Landungsboot (ohne Besatzung/Embleme) / simplified cargo for the landing boat */
function carriedGeometry(type: UnitTypeId, faction: FactionId): THREE.BufferGeometry {
  return memo(`unitLite|${type}|${faction}${unitQuality === 'high' ? '' : '|low'}`, () => {
    switch (type) {
      case 'jeep': return (faction === 'velkar' ? sensorCarrier(faction, true) : jeep(faction, true)).build();
      case 'tank': return tank(faction, true).build();
      case 'artillery': return (faction === 'velkar' ? coilLauncher(faction, true) : artillery(faction, true)).build();
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
      case 'berserker': return berserker(faction, true).build();
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
      case 'steppeRider': return steppeRider(faction, true).build();
      case 'stormbreaker': return stormbreaker(faction, true).build();
      case 'peacekeeper': return peacekeeper(faction, true).build();
      case 'protoWalker': return protoWalker(faction, true).build();
      case 'teslaTank': return teslaTank(faction, true).build();
      case 'octocopter': return octocopter(faction, true).build();
      case 'railSniper': return railSniper(faction, true).build();
      case 'lightWarden': return lightWarden(faction, true).build();
      case 'reliquary': return reliquary(faction, true).build();
      case 'sunLance': return sunLance(faction, true).build();
      case 'divineSpark': return divineSpark(faction, true).build();
      case 'steppeColossus': return steppeColossus(faction, true).build();
      case 'cyborg': return cyborg(faction, true).build();
      case 'flameTank': return flameTank(faction, true).build();
      case 'kamikazeDrone': return kamikazeDrone(faction, true).build();
      case 'shadowCommando': return shadowCommando(faction, true).build();
      case 'guidedMissile': return guidedMissile(faction, true).build();
      case 'radarTruck': return radarTruck(faction, true).build();
      case 'marine': return marine(faction, true).build();
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

// Stuetzpunkte: ein Modell je Art (bases.ts) / bases: one model per kind (bases.ts)
export { baseGeometry, baseMeta, rotorGeometry, type BaseFlags, type BaseMeta } from './bases';

export function buildingGeometry(kind: BuildingId | 'outpost' | GrandProjectId, faction: FactionId | null): THREE.BufferGeometry {
  const f = kind === 'road' ? null : faction;
  return memo(`building|${kind}|${f ?? 'neutral'}`, () => building(kind, f).build());
}

/** Verdeckte Mine, nur fuer den Besitzer sichtbar / hidden mine, visible to its owner only */
export function mineGeometry(faction: FactionId | null): THREE.BufferGeometry {
  return memo(`mine|${faction ?? 'neutral'}`, () => mineModel(faction).build());
}

/** Mahnmal des Kults; fallen = Fraktion des Gefallenen / cult memorial; fallen = faction of the fallen */
export function memorialGeometry(fallen: FactionId): THREE.BufferGeometry {
  return memo(`memorial|${fallen}`, () => memorial(fallen).build());
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

/** Waldsaum auf dem Nachbarfeld eines Waldes (2 Varianten); der Name beginnt wie die Waldbaeume, also gleiche Tuschelinie / forest fringe on the tile next to a forest (2 variants); the name starts like the forest trees, so the same ink line */
export function fringeGeometry(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 2) + 2) % 2;
  return memo(`deco|forest|fringe|${v}`, () => forestFringe(v).build());
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

/**
 * Mutterschiff der Zyrr (Kampagne m2) ueber 2x2 Feldern, Ursprung Mitte; lite = niedrige Qualitaet.
 * Zyrr mothership (campaign m2) over 2x2 tiles, origin at the centre; lite = low quality.
 */
export function mothershipGeometry(lite = false): THREE.BufferGeometry {
  return memo(`mothership|${lite ? 1 : 0}`, () => mothership(lite).build());
}
/** Rauchfahnen des Mutterschiffs (schwankt) / smoke plumes of the mothership (sways) */
export function mothershipSmokeGeometry(lite = false): THREE.BufferGeometry {
  return memo(`mothershipSmoke|${lite ? 1 : 0}`, () => mothershipSmoke(lite).build());
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
 * Nebelwolke in Hoehlentoenen: die normale Wolke, hell -> caveFog, schattig -> caveFogShade.
 * Fog cloud in cave tones: the normal cloud, light -> caveFog, shaded -> caveFogShade.
 */
export function caveCloudGeometry(variant: number): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % 4) + 4) % 4;
  return memo(`caveCloud|${v}`, () => {
    const g = cloudGeometry(v).clone();
    const c = g.getAttribute('color');
    const light = new THREE.Color(semantic.caveFog), dark = new THREE.Color(semantic.caveFogShade), tmp = new THREE.Color();
    const ref = new THREE.Color(semantic.cloud);
    for (let i = 0; i < c.count; i++) {
      const lit = Math.abs(c.getX(i) - ref.r) + Math.abs(c.getY(i) - ref.g) + Math.abs(c.getZ(i) - ref.b) < 0.02;
      tmp.copy(lit ? light : dark);
      c.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    c.needsUpdate = true;
    return g;
  });
}
export {
  mushroomForest, caveFloorDeco, rockPillars, craterCracks, craterDebris, verdanRemains, alienBones, giantSkull,
  supplyLineGeometry, verdanTurretGeometry, verdanRuinGeometry,
} from './cavern';
// Raketensilo der Meridon (Schattenflotte) / Meridon rocket silo (shadow fleet)
export { siloGeometry } from './shadowFleet';
// Hackturm der NEXUS (HACK.tower) / NEXUS hack tower (HACK.tower)
export { hackTowerGeometry } from './hacking';
// Geschuetzstellung der Dravon (Festungsbau) / Dravon gun emplacement (fortification)
export { emplacementGeometry, emplacementRuinGeometry } from './emplacement';

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
