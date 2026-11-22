/**
 * Die Spielkarte als 3D-Diorama. Liest den Zustand, veraendert ihn nie.
 * The game map as a 3D diorama. Reads the state, never changes it.
 */
import * as THREE from 'three';
import type { BaseKind, BiomeId, FactionId, TerrainId } from '../data/balance';
import type { Tile } from '../core';
import { FUEL, M2, WAR_MARKS } from '../data/balance';
import { FACING_DIRS, canFace, attackTargets, levelUpCost, burning, memorialAt, canSeeMine, canSeeUnit, submerged as isWading, cityById, isExplored, weather, isCavern, dist, blessingOf, isSinner, judgeAlive, onFire, radarEcho, camouflaged, trueOwner, hijackRoundsLeft, cityHackRoundsLeft, type GameState, type Unit } from '../core';
import { factionTokens, hex, semantic } from '../design/tokens';
import { cityNameOf } from '../i18n/cityNames';
import { ANIM, CAMERA, CITY_MASK, CITY_SIGN, CLOUD_Y, GARRISON, MARKER, OUTLINE, SETTLEMENT_SCALE, SLAB_DEPTH, TILE_BOTTOM, TILE_TOP } from './config';
import { attackIcon, cityLabel, hackBadge, hpBadge, pruneBadgeCache, raceBadge } from './labels';
import { unitRoleIcon } from '../ui/unitRoles';
import * as models from './models';
import { WeatherFx } from './weather';
import { PERK_SCALE, RELAY_LAMP, SLOT_SPOT, perkGeometry } from './cityPerks';
import { ORBITAL_FX, OrbitalFx, type OrbitalTag } from './fx/orbital';
import { ROCKET_FX, RocketFx } from './fx/rocket';
import { SPARK_FX, SparkFx } from './fx/spark';
import { AmbientFx, swayMaterial, swayOutline } from './ambient';
import { UnitLife } from './life';
import { BIOME_LIFT, PEAK_LIFT, PEAK_SCALE, biomeDecoration, biomeTop, meadowVariant, riverSegment, roadJunction, roadSegment, trackGeometry } from './biomes';
import { CombatFx, aimTurrets, angleDelta, headingOf, lerpAngle, pathFacing, playAttack, turretTurn, turretsIn, type AttackInfo, type FxHost, type TurretInfo } from './combat';
import { barrierGeometry, craterGeometry, dropletGeometry, fireballGeometry, scorchGeometry, skeletonGeometry, splatGeometry, wreckGeometry } from './remains';
import { brokenFenceGeometry, burntGrassGeometry, debrisGeometry, oilSlickGeometry, roadDamageGeometry, shellHolesGeometry, smokeWispGeometry, stumpsGeometry } from './remains';
import { SCAR_MARK_SCALE, scarColors, scarGround, scarKeyTier, scarSmokes } from './scars';
import { artifactGeometry, ARTIFACT_ORBIT_Y } from './models/artifact';
import { ATMO, cloudMaterial, cloudOutline, decalMaterial, landMaterial, unitGlowMaterial, withGlow, type GlowKind } from './atmosphere';
import { TechParts } from './techParts';
import { WATER_BOX_TOP, buildWater } from './water';
import { CLIFF_STEP, NATURAL, beachCoast, buildLandscape, cliffRock, groundTone, growthRank } from './landscape';
import { TownFx, type TownInput } from './lights';
import { FogFx } from './fog';
import { ContactShadows } from './contact';
import { CaveShell } from './cave';
import { CaveLife, type CreatureSpot } from './life';
import { setWaterTheme } from './water';
import { AlienWorldFx, alienCloud, alienPlantGeometry, alienTint, crystalSpireGeometry } from './alienWorld';
import { alienBurrowGeometry } from './models/alienFlora';
import { towerGeometry } from './models/towers';
import { cityHeight, hqMastTop } from './models/city';
import { ACADEMY_MODEL, academyBeacon, academyEmitter, academyGeometry, academyPose, academyRadarAt, academyRadarGeometry, hoverShadowColor, poseY, researchPostGeometry, shieldColor, shieldGeometry, terraformColor } from './models/academy';
import type { City } from '../core';
import { BASE_ICON, baseName } from '../ui/bases';
import { DesertWorldFx } from './desertWorld';
import { RiftFx } from './rift';
import { caveMouthGeometry, verdanOutpostGeometry, desertGroundDeco, giantSkeletonGeometry, mesaGeometry, ruinSiteGeometry, sandify, thornScrubGeometry, verdanDesertRuin } from './models/desert';
import { raceStandings, scarTier, shipTiles, turretGuard, type ScarTier } from '../core';
import { plansGeometry, templeGeometry } from './models/temple';

/**
 * Dimensionsportal der Kampagne als Landschaftsmodell (fertige Stufe, Brett-Groesse), leuchtende Runen und Wirbel.
 * Campaign dimensional portal as a landscape model (finished stage, board size), glowing runes and swirl.
 */
const portalCache: { g: THREE.BufferGeometry | null } = { g: null };
function portalGeometry(): THREE.BufferGeometry | null {
  if (portalCache.g) return portalCache.g;
  const src = safe(models.unitGeometry, null, 'portal', 'zyrr', null, 2);
  if (!src) return null;
  // eigene Kopie: die Leuchtmaske weicht von der Einheit ab / own copy: the glow mask differs from the unit
  portalCache.g = withGlow(src.clone(), 'bright');
  return portalCache.g;
}

/** Platzhalter, solange ein Modell fehlt: Grundkoerper in Fraktionsfarbe / placeholder while a model is missing */
const placeholderCache = new Map<string, THREE.BufferGeometry>();
function placeholder(color: string, h = 0.3): THREE.BufferGeometry {
  const key = `${color}-${h}`;
  let g = placeholderCache.get(key);
  if (!g) { g = paint(new THREE.CylinderGeometry(0.18, 0.22, h, 8).toNonIndexed(), color); g.translate(0, h / 2, 0); placeholderCache.set(key, g); }
  return g;
}
/**
 * Kampagnen-Finale: Marker des Artefakts der Uralten (Ursprung unten mittig, ein Feld gross). Vorerst ein schlichter
 * Obelisk; das eigentliche Modell wird hier eingesetzt.
 * Campaign finale: marker of the artifact of the ancients (origin bottom centre, one tile). For now a plain obelisk;
 * the real model gets plugged in here.
 */
// ARTIFACT_MODEL_HOOK: Sockel statisch, schwebender Teil dreht sich (siehe Board.tick) / plinth static, floating part spins (see Board.tick)
function artifactMarker(): THREE.BufferGeometry { return artifactGeometry('static'); }
function safe<T extends unknown[]>(fn: (...a: T) => THREE.BufferGeometry | null, fallback: string | null, ...args: T): THREE.BufferGeometry | null {
  try { return fn(...args); } catch { return fallback ? placeholder(fallback) : null; }
}
const unitGeometry = (type: Parameters<typeof models.unitGeometry>[0], f: Parameters<typeof models.unitGeometry>[1], c: Parameters<typeof models.unitGeometry>[2], stage = 0) =>
  safe(models.unitGeometry, factionTokens[f].primary, type, f, c, stage)!;
/**
 * Einheitenmodell aus der Geometrie: Wanne mit Kontur, Drehtuerme als Kinder 'turret' am Drehpunkt (gleiches Material,
 * gleiche Konturbreite). Ohne Tuerme genau wie bisher ein outlined()-Objekt.
 * Unit model from the geometry: hull with outline, turrets as children 'turret' at their pivot (same material, same
 * outline width). Without turrets exactly an outlined() object as before.
 */
function unitModel(g: THREE.BufferGeometry, material: THREE.Material): THREE.Group {
  const split = models.splitTurrets(g);
  if (!split) return outlined(g, OUTLINE.unit, material);
  const model = outlined(split.hull, OUTLINE.unit, material);
  if (!g.boundingBox) g.computeBoundingBox();
  model.userData.bounds = g.boundingBox;
  for (const t of split.turrets) {
    const tur = outlined(t.geometry, OUTLINE.unit, material);
    tur.name = 'turret';
    tur.position.copy(t.pivot);
    tur.rotation.y = t.yaw;
    tur.userData.turret = { rest: t.yaw, ...(t.arc !== undefined ? { arc: t.arc } : {}) } satisfies TurretInfo;
    model.add(tur);
  }
  return model;
}
/**
 * Weltwinkel der Ausrichtung im Spielstand (Unit.facing, 8 Richtungen), undefined ohne Ausrichtung oder bei Bauwerken.
 * Die Wanne zeigt immer diese Richtung, Drehtuerme zielen frei (nur Darstellung).
 * World heading of the facing in the game state (Unit.facing, 8 directions), undefined without a facing or for
 * structures. The hull always shows this direction, turrets aim freely (render only).
 */
export function coreHeading(u: Pick<Unit, 'type' | 'facing'> | undefined): number | undefined {
  if (!u || u.facing === undefined || u.facing === null || !canFace(u)) return undefined;
  const d = FACING_DIRS[u.facing];
  return d ? headingOf(d.x, d.y) : undefined;
}
/** Versatz je Bauwerk; das Fusionskraftwerk-Modell deckt seine 2x2-Flaeche selbst ab / offset per wonder; the fusion plant model covers its 2x2 footprint itself */
const WONDER_OFFSET: Partial<Record<string, { x: number; z: number }>> = {};
const cityGeometry = (f: Parameters<typeof models.cityGeometry>[0], l: number, fl: Parameters<typeof models.cityGeometry>[2]) =>
  safe(models.cityGeometry, f ? factionTokens[f].primary : semantic.neutral, f, l, fl)!;
/** Stuetzpunkt-Modell je Art (models/bases.ts) / base model per kind (models/bases.ts) */
const baseModelGeometry = (k: BaseKind, f: FactionId | null, l: number, fl: models.BaseFlags, sea: number, spin: boolean) =>
  safe(models.baseGeometry, f ? factionTokens[f].primary : semantic.neutral, k, f, l, fl, sea, spin)!;
/**
 * Seeseite eines Orts fuer den Marinestuetzpunkt: 0 = +z, 1 = +x, 2 = -z, 3 = -x. Zuerst die Kanten (vorn vor hinten),
 * dann die Ecken; ohne Wasser 0. Nur Optik, aus dem Gelaende abgeleitet.
 * Sea side of a place for the naval base: 0 = +z, 1 = +x, 2 = -z, 3 = -x. Edges first (front before back), then the
 * corners; 0 without water. Visual only, derived from the terrain.
 */
function seaSide(s: GameState, x: number, y: number): number {
  const wet = (dx: number, dy: number) => {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= s.size || yy >= s.size) return false;
    const t = s.tiles[yy * s.size + xx].terrain;
    return t === 'shallow' || t === 'ocean';
  };
  const edges: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const edge = edges.findIndex(([dx, dy]) => wet(dx, dy));
  if (edge >= 0) return edge;
  const corners: [number, number, number][] = [[1, 1, 0], [-1, 1, 0], [1, -1, 1], [-1, -1, 2]];
  return corners.find(([dx, dy]) => wet(dx, dy))?.[2] ?? 0;
}
const buildingGeometry = (k: Parameters<typeof models.buildingGeometry>[0], f: Parameters<typeof models.buildingGeometry>[1]) =>
  safe(models.buildingGeometry, f ? factionTokens[f].secondary : semantic.neutral, k, f);
const featureGeometry = (k: 'bunker' | 'radar') => safe(models.featureGeometry, semantic.neutralDark, k);
const decorationGeometry = (t: TerrainId, r: Parameters<typeof models.decorationGeometry>[1], v: number) => safe(models.decorationGeometry, null, t, r, v);
const volcanoGeometry = (v: number) => safe(models.volcanoGeometry, semantic.basalt, v);
const volcanoSmokeGeometry = () => safe(models.volcanoSmokeGeometry, null);
const lavaGeometry = (v: number) => safe(models.lavaGeometry, semantic.lava, v);
const crashSiteGeometry = (v: number) => safe(models.crashSiteGeometry, semantic.metal, v);
const labRuinGeometry = (v: number) => safe(models.labRuinGeometry, semantic.neutral, v);
const jungleDecoration = (v: number) => safe(models.jungleDecoration, semantic.biomeJungleDark, v);
const fringeGeometry = (v: number) => safe(models.fringeGeometry, null, v);
const mothershipGeometry = (lite: boolean) => safe(models.mothershipGeometry, semantic.xenoGround, lite);
const mothershipSmokeGeometry = (lite: boolean) => safe(models.mothershipSmokeGeometry, null, lite);
/** Mutterschiff (m2): Breitseite zur Standardkamera / mothership (m2): broadside towards the default camera */
const SHIP_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
const WHITE = new THREE.Color(1, 1, 1);
/** Deckkraft erschoepfter Einheiten / opacity of exhausted units */
const DONE_OPACITY = 0.5;
/** Eintauchtiefe watender Einheiten / sink depth of wading units */
const WADE_SINK = 0.14;
/** Radarkontakt unter den Wolken: so weit ueber der Wolkendecke (Radarimpuls, RADAR) / radar contact under the clouds: this far above the cloud deck (radar sweep, RADAR) */
const RADAR_ECHO_LIFT = 0.26;
const xenoDecoration = (v: number) => safe(models.xenoDecoration, null, v);
const cloudGeometry = (v: number) => safe(models.cloudGeometry, semantic.cloud, v)!;
const caveCloudGeometry = (v: number) => safe(models.caveCloudGeometry, semantic.caveFog, v)!;
// Hoehle (Kampagnenfinale) / cavern (campaign finale)
const mushroomForest = (v: number, low: boolean) => safe(models.mushroomForest, semantic.mushroomCapA, v, low);
const caveFloorDeco = (v: number) => safe(models.caveFloorDeco, null, v);
const rockPillars = (v: number, ore: boolean) => safe(models.rockPillars, semantic.caveRock, v, ore);
const supplyLineGeometry = (f: FactionId | null, hq: boolean) => safe(models.supplyLineGeometry, f ? factionTokens[f].primary : semantic.neutral, f, hq)!;
const verdanTurretGeometry = (active: boolean) => safe(models.verdanTurretGeometry, semantic.verdanStone, active);
const verdanRuinGeometry = () => safe(models.verdanRuinGeometry, semantic.verdanStoneDark);
const emplacementGeometry = (f: FactionId) => safe(models.emplacementGeometry, factionTokens[f].primary, f);
/** Raketensilo der Meridon / Meridon rocket silo */
const siloGeometry = (f: FactionId) => safe(models.siloGeometry, factionTokens[f].primary, f);
/** Hackturm der NEXUS (verbunden: aktiv) / NEXUS hack tower (linked: active) */
const hackTowerGeometry = (f: FactionId, active: boolean) => safe(models.hackTowerGeometry, factionTokens[f].primary, f, active);
const emplacementRuinGeometry = (f: FactionId | null) => safe(models.emplacementRuinGeometry, semantic.neutralDark, f);
const craterCracks = (ring: number, v: number) => safe(models.craterCracks, null, ring, v);
const craterDebris = (v: number) => safe(models.craterDebris, null, v);
/** Skelette in der Hoehle / skeletons in the cavern */
const caveBones = (kind: 0 | 1 | 2, v: number) => safe(kind === 0 ? models.verdanRemains : kind === 1 ? models.alienBones : models.giantSkull, semantic.bone, v);

/** Deterministischer Zufall je Feld und Seed (nur Optik) / deterministic random per tile and seed (visual only) */
function tileHash(x: number, y: number, seed: number, salt: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed | 0, 1103515245) ^ Math.imul(salt + 7, 1597334677);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Absenkung der Kraterfelder je Ring (Mitte, 1, 2), nur Optik / dip of crater tiles per ring (centre, 1, 2), visual only */
const CRATER_DIP = [0.26, 0.17, 0.08];
/** Kraterradius um das Artefakt / crater radius around the artifact */
const CRATER_RADIUS = 2;
const craterDip = new WeakMap<Tile, number>();
import { coloredBox, hullGeometry, outlined, outlinedInstanced, outlineMaterial, paint, toonMaterial, unitMaterial } from './toon';

/** reach = Reichweite des Hackturms (HACK.tower), in der Markierungsfarbe der NEXUS / reach of the hack tower (HACK.tower), in the NEXUS marker colour */
export type HighlightKind = 'move' | 'attack' | 'safe' | 'unsafe' | 'select' | 'target' | 'hint' | 'build' | 'reach';

interface UnitView { id: number; group: THREE.Group; key: string; badge: THREE.Sprite | null; badgeKey: string }
interface Anim { update: (t: number) => void; start: number; dur: number; resolve: () => void }

const mix = (a: string, b: string, t: number) => {
  const c = new THREE.Color(hex(a)).lerp(new THREE.Color(hex(b)), t);
  return `#${c.getHexString()}`;
};

/** Oberkante eines Feldes inkl. Landschaft / tile top including biome */
export function tileTop(t: Tile): number {
  return -(craterDip.get(t) ?? 0) + TILE_TOP[t.terrain] + (t.biome && t.terrain !== 'shallow' && t.terrain !== 'ocean' ? BIOME_LIFT[t.biome] : 0) +
    (t.terrain === 'mountain' ? PEAK_LIFT[t.peak ?? 2] : 0);
}


/** Einheiten groesser als die Umgebung, auf einem Sockel / units larger than the surroundings, on a base */
const UNIT_SCALE = 1.25;
const BASE_H = 0.035;
const baseCache = new Map<string, THREE.BufferGeometry>();
function baseGeometry(rim: string): THREE.BufferGeometry {
  let g = baseCache.get(rim);
  if (g) return g;
  g = new THREE.CylinderGeometry(0.34, 0.36, BASE_H, 28).toNonIndexed();
  g.translate(0, BASE_H / 2, 0);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const top = new THREE.Color(hex(semantic.soil)), side = new THREE.Color(hex(rim));
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const c = nor.getY(i) > 0.5 ? top : side; col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  baseCache.set(rim, g);
  return g;
}
let baseMat: THREE.MeshBasicMaterial | null = null;
const baseMaterial = () => (baseMat ??= new THREE.MeshBasicMaterial({ vertexColors: true }));

/** Zeichenreihenfolge der Einheiten (nach dem Leeren des Tiefenpuffers) / render order of units (after the depth clear) */
const UNIT_ORDER = 60;

/**
 * Tuschelinie der Dekoration: Baeume und Gipfel (decorationGeometry, Name 'deco|forest...' / 'deco|mountain...') etwas
 * kraeftiger, damit sie zum Strich der Einheiten passen; Kleinteile (Graeser, Kisten, Vieh) bleiben fein.
 * Ink line of the decoration: trees and peaks (decorationGeometry, name 'deco|forest...' / 'deco|mountain...') a little
 * bolder so they match the line of the units; small props (grass, crates, cattle) stay fine.
 */
const sceneryLine = (geo: THREE.BufferGeometry) =>
  geo.name.startsWith('deco|forest|') || geo.name.startsWith('deco|mountain|') ? OUTLINE.scenery : OUTLINE.building;

/**
 * LP-Plakette in ihrer Groesse halten, wenn die Einheit verkleinert gezeichnet wird (Besatzung, GARRISON).
 * Keep the HP badge at its size when the unit is drawn smaller (garrison, GARRISON).
 */
function fitBadge(badge: THREE.Sprite, unitScale: number) {
  const size = badge.userData.size as THREE.Vector3 | undefined;
  if (size) badge.scale.copy(size).multiplyScalar(1 / Math.max(0.001, unitScale));
}
/** Einheitswuerfel (Ursprung unten mittig) und unsichtbares Material der Trefferkoerper / unit cube (origin bottom centre) and invisible material of the hit bodies */
let proxyGeo: THREE.BufferGeometry | null = null;
const proxyGeometry = () => (proxyGeo ??= new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
let proxyMat: THREE.MeshBasicMaterial | null = null;
const proxyMaterial = () => (proxyMat ??= new THREE.MeshBasicMaterial({ visible: false }));
/** Tiefenmaske der Staedte: schreibt nur Tiefe (CITY_MASK) / depth mask of the cities: writes depth only (CITY_MASK) */
let maskMat: THREE.MeshBasicMaterial | null = null;
const maskMaterial = () => (maskMat ??= new THREE.MeshBasicMaterial({ colorWrite: false }));

export class Board {
  readonly group = new THREE.Group();
  private staticLayer = new THREE.Group();
  /** schwebender Teil des Artefakts (Kampagnenfinale) / floating part of the artifact (campaign finale) */
  private artifactOrbit: THREE.Object3D | null = null;
  /**
   * Schwebende Akademien (Velkar): Modell je Stadt, schwebende mit Auf und Ab; nur Darstellung.
   * Floating academies (Velkar): model per city, floating ones bob up and down; render state only.
   */
  /**
   * Akademien auf dem Brett: Gruppe (Feld), Modell (Hoehe), Auf und Ab, drehende Radarantenne, Terraform-Strahl und
   * Bodenflimmern; base = gebaute Lage der Gruppe (das Leuchtfeuer folgt der Verschiebung).
   * Academies on the board: group (tile), model (height), bob, rotating radar array, terraform beam and ground shimmer;
   * base = built position of the group (the beacon follows the offset).
   */
  private academyObjs = new Map<number, { group: THREE.Group; obj: THREE.Object3D; hover: boolean; baseY: number; animating: boolean; base: THREE.Vector3;
    radar: THREE.Object3D | null; beam: THREE.Mesh | null; ring: THREE.Mesh | null }>();
  private unitLayer = new THREE.Group();
  private highlightLayer = new THREE.Group();
  private labelLayer = new THREE.Group();
  readonly weatherFx = new WeatherFx();
  readonly ambient = new AmbientFx();
  /** Kampfeffekte (Muendungsfeuer, Geschosse, Einschlaege) / combat effects (muzzle flashes, projectiles, impacts) */
  readonly combat = new CombatFx();
  /** gemerkte Blickrichtung (rotation.y des Modells) je Einheit / remembered facing (model rotation.y) per unit */
  private facing = new Map<number, number>();
  /**
   * Zielrichtung der Drehtuerme relativ zur Wanne (fehlt = Ruhestellung); nur Darstellung, nicht im Spielstand.
   * Aim of the turrets relative to the hull (absent = rest); render state only, not in the game state.
   */
  private turretAim = new Map<number, number>();
  /** Partie, zu der facing/turretAim gehoeren (Kachel-Array als Kennung) / game that facing/turretAim belong to (tile array as id) */
  private facingGame: GameState['tiles'] | null = null;
  /** Leerlauf, Gangarten, Rauch und Flammen der Einheiten / unit idle, gaits, smoke and flames */
  readonly life = new UnitLife();
  /** Bewegliche Teile der Velkar-Einheiten (Rotoren, Lichtboegen, Messdrohnen) / moving parts of Velkar units (rotors, arcs, survey drones) */
  readonly techParts = new TechParts();
  /** Stadtlichter, Lava-Schein, Leuchtfeuer, Schornsteinrauch / city lights, lava glow, beacons, chimney smoke */
  readonly town = new TownFx();
  /** Bodenschatten unter Einheiten und stehender Dekoration / contact shadows under units and standing decoration */
  readonly contact = new ContactShadows();
  /** Aufloesende Nebelwolken / dissolving fog clouds */
  readonly fogFx = new FogFx((v) => (this.theme === 'cavern' ? caveCloudGeometry(v) : this.theme === 'alien' ? alienCloud(cloudGeometry(v), v) : cloudGeometry(v)));
  /** Darstellungsqualitaet (View.setQuality): 'low' = weniger Hoehlen-Deko / render quality: 'low' = less cavern decoration */
  quality: 'low' | 'high' = 'high';
  /** Felswaende, Gewoelbe und Tropfsteine der Hoehle / rock walls, vault and stalactites of the cavern */
  readonly caveShell = new CaveShell();
  /** Leuchtende Hoehlentiere / glowing cavern creatures */
  readonly caveLife = new CaveLife();
  /** Runde des zuletzt gezeigten Zustands (fuer die Tageszeit) / round of the last shown state (for the time of day) */
  round = 1;
  /** Zaehlt Neuaufbauten der statischen Ebene (Schattenkarte) / counts static rebuilds (shadow map) */
  staticVersion = 0;
  /** Kartenthema der gezeigten Partie / map theme of the shown game */
  theme: 'cavern' | 'alien' | 'desert' | null = null;
  /** Heimatwelt der Zyrr: schwebende Felsen und Fremdtiere / Zyrr homeworld: floating rocks and critters */
  readonly alienFx = new AlienWorldFx();
  /** Welt der Vergessenen: Staub, Staubteufel, Tiere, ferne Tafelberge / world of the Forgotten: dust, dust devils, critters, distant mesas */
  readonly desertFx = new DesertWorldFx();
  /** Riss zwischen den Welten (Ende m11) / rift between the worlds (end of m11) */
  readonly rift = new RiftFx();
  /** Orbitallaser: Zielvorschau, Strahl, Uplink-Licht der Relays / orbital laser: target preview, beam, relay uplink light */
  readonly orbital = new OrbitalFx();
  /** Raketenstart der Raketensilos / launch of the rocket silos */
  readonly rocket = new RocketFx();
  /** Goettlicher Funke (Alvenia): Lichtbogen und 2x2-Einschlag / Divine Spark (Alvenia): arc of light and 2x2 impact */
  readonly spark = new SparkFx();
  private prevFog: { set: Set<number>; viewer: number; size: number; seed: unknown } | null = null;
  private units = new Map<number, UnitView>();
  private pickMeshes: { mesh: THREE.InstancedMesh; tiles: number[] }[] = [];
  /**
   * Unsichtbare Trefferkoerper hoher Staedte und Sendetuerme (userData.tile = Feldindex): ein Tipp auf das Wahrzeichen
   * waehlt die Stadt, nicht das Feld dahinter.
   * Invisible hit bodies of tall cities and transmitter towers (userData.tile = tile index): a tap on the landmark picks
   * the city, not the tile behind it.
   */
  private cityProxies: THREE.Mesh[] = [];
  /** Tiefenmasken der Staedte mit ihrer Grundposition (CITY_MASK) / depth masks of the cities with their base position (CITY_MASK) */
  private cityMasks: { mesh: THREE.Mesh; base: THREE.Vector3 }[] = [];
  /** zuletzt gesetzte Markierungen (fuer Besatzungen beim Drehen) / highlights set last (for garrisons while rotating) */
  private lastHighlights: { x: number; y: number; kind: HighlightKind; facing?: number }[] = [];
  /** Stadtschilder mit ihrem Feld, fuer die Platzierung je Blickrichtung / city signs with their tile, placed per view direction */
  private citySigns: { sprite: THREE.Sprite; x: number; y: number; top: number }[] = [];
  /** Felder mit sichtbarer Einheit beim letzten Neuaufbau / tiles with a visible unit at the last rebuild */
  private occupiedTiles = new Set<number>();
  /** Zustand des letzten Abgleichs (fuer die Besatzungen beim Drehen) / state of the last sync (for the garrisons while rotating) */
  private lastState: GameState | null = null;
  /** Richtung zur Kamera am Boden (x, z), Laenge 1 / direction towards the camera on the ground (x, z), length 1 */
  private front = new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2);
  private anims: Anim[] = [];
  private tileGeoCache = new Map<string, THREE.BufferGeometry>();
  size = 0;
  animations = true;
  showLabels = true;
  dirty = true;

  constructor() {
    this.group.add(this.staticLayer, this.highlightLayer, this.unitLayer, this.labelLayer, this.weatherFx.group, this.ambient.group, this.combat.group, this.town.group, this.fogFx.group, this.alienFx.group, this.desertFx.group, this.rift.group, this.orbital.group, this.rocket.group, this.spark.group);
    // Tiefenpuffer vor den Einheiten leeren: Gebaeude, Baeume und Berge verdecken keine Einheiten mehr
    // clear the depth buffer before units: buildings, trees and mountains no longer hide units
    const clearer = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    clearer.frustumCulled = false;
    clearer.renderOrder = UNIT_ORDER - 1;
    clearer.onBeforeRender = (renderer) => renderer.clearDepth();
    clearer.raycast = () => {};
    this.unitLayer.add(clearer);
    this.group.add(this.life.group, this.caveShell.group, this.caveLife.group, this.contact.group);
    this.life.busy = (id) => this.animating.has(id);
  }

  /** Mittelpunkt eines Feldes in Brett-Koordinaten / centre of a tile in board coordinates */
  tileCenter(s: GameState | null, x: number, y: number): THREE.Vector3 {
    const off = (this.size - 1) / 2;
    const top = s ? tileTop(s.tiles[y * s.size + x]) : 0;
    return new THREE.Vector3(x - off, top, y - off);
  }

  /**
   * Standplatz einer Einheit: Feldmitte; auf einem Stadtfeld die vordere Ecke zur Kamera hin, kleiner (GARRISON).
   * Spot of a unit: the tile centre; on a city tile the front corner towards the camera, smaller (GARRISON).
   */
  private unitSpot(s: GameState, x: number, y: number): { pos: THREE.Vector3; scale: number } {
    const pos = this.tileCenter(s, x, y);
    if (s.tiles[y * s.size + x].cityId === null) return { pos, scale: 1 };
    pos.x += this.front.x * GARRISON.shift; pos.z += this.front.y * GARRISON.shift;
    return { pos, scale: GARRISON.scale };
  }

  /**
   * Blickrichtung der Kamera (Winkel um die Hochachse, wie View.angle): Besatzungen und Stadtschilder ruecken zur Kamera.
   * View direction of the camera (angle about the vertical axis, like View.angle): garrisons and city signs move towards the camera.
   */
  setViewAngle(angle: number) {
    const fx = Math.cos(angle), fz = Math.sin(angle);
    if (Math.abs(fx - this.front.x) < 1e-4 && Math.abs(fz - this.front.y) < 1e-4) return;
    this.front.set(fx, fz);
    this.placeCitySigns();
    this.placeCityMasks();
    const s = this.lastState;
    if (s) for (const u of s.units) {
      const v = this.units.get(u.id);
      if (!v || this.isAnimating(u.id) || s.tiles[u.y * s.size + u.x]?.cityId == null) continue;
      const y = v.group.position.y;
      v.group.position.copy(this.unitSpot(s, u.x, u.y).pos).setY(y);
    }
    // Markierungen an Besatzungen ruecken mit / highlights at garrisons move along
    if (s && this.lastHighlights.some((h) => this.garrisonAt(s, h.x, h.y))) this.setHighlights(s, this.lastHighlights);
    this.dirty = true;
  }

  /** Steht auf dem Stadtfeld eine sichtbare Einheit? / is there a visible unit on the city tile? */
  private garrisonAt(s: GameState, x: number, y: number): boolean {
    if (s.tiles[y * s.size + x]?.cityId == null) return false;
    return s.units.some((u) => u.x === x && u.y === y && this.units.has(u.id));
  }

  /** Tiefenmasken entlang der Blickachse nach hinten schieben (CITY_MASK) / push the depth masks back along the view axis (CITY_MASK) */
  private placeCityMasks() {
    const c = Math.cos(CAMERA.elevation) * CITY_MASK.push, sy = Math.sin(CAMERA.elevation) * CITY_MASK.push;
    for (const m of this.cityMasks) m.mesh.position.set(m.base.x - this.front.x * c, m.base.y - sy, m.base.z - this.front.y * c);
    // Rotoren der Windraeder: eine gemeinsame Maske, dieselbe Verschiebung / wind turbine rotors: one shared mask, the same shift
    this.town.rotorMask?.position.set(-this.front.x * c, -sy, -this.front.y * c);
  }

  /**
   * Stadtschilder setzen: unter die vordere Ecke; steht auf dem Feld davor eine Einheit, an die freie vordere Kante
   * (links vor rechts; sind beide besetzt, links).
   * Place the city signs: below the front corner; if a unit stands on the tile in front, at the free front edge
   * (left before right; if both are taken, left).
   */
  private placeCitySigns() {
    const f = this.front, n = this.size, off = (n - 1) / 2;
    // rechts auf dem Bildschirm / right on screen
    const rx = f.y, rz = -f.x;
    const taken = (dx: number, dz: number, c: { x: number; y: number }) => {
      const x = c.x + Math.round(dx), y = c.y + Math.round(dz);
      return x >= 0 && y >= 0 && x < n && y < n && this.occupiedTiles.has(y * n + x);
    };
    for (const c of this.citySigns) {
      let ox = f.x * CITY_SIGN.front, oz = f.y * CITY_SIGN.front;
      if (taken(f.x * Math.SQRT2, f.y * Math.SQRT2, c)) {
        // links frei: links; sonst rechts, wenn frei; sonst links (dort verdeckt das Schild nur den Sockel des Nachbarn, nicht sein Gesicht)
        // left free: left; else right if free; else left (there the sign only covers the neighbour's base, not its face)
        const left = !taken((f.x - rx) * Math.SQRT1_2, (f.y - rz) * Math.SQRT1_2, c);
        const right = !left && !taken((f.x + rx) * Math.SQRT1_2, (f.y + rz) * Math.SQRT1_2, c);
        const side = right ? 1 : -1;
        ox = f.x * CITY_SIGN.side + side * rx * CITY_SIGN.across; oz = f.y * CITY_SIGN.side + side * rz * CITY_SIGN.across;
      }
      c.sprite.position.set(c.x - off + ox, c.top - CITY_SIGN.drop, c.y - off + oz);
    }
  }

  private snowy = false;
  /** Heimatwelt der Zyrr (Thema 'alien') / Zyrr homeworld (theme 'alien') */
  private alien = false;
  /** Welt der Vergessenen (Thema 'desert') / world of the Forgotten (theme 'desert') */
  private desert = false;
  /**
   * Wuestenpalette nach Landschaft: rote Duenen, dunkles Geroell, helle Salzpfannen, ockerne Duenenkaemme; kein Gruen.
   * Desert palette by biome: red dunes, dark scree, pale salt flats, ochre dune ridges; no green.
   */
  private desertColors(terrain: TerrainId, biome?: BiomeId): { top: string; side: string } {
    switch (terrain) {
      case 'mountain': return { top: semantic.desertRock, side: semantic.desertRockDark };
      case 'forest': return { top: mix(semantic.desertScree, semantic.desertThorn, 0.35), side: semantic.desertScreeDark };
      case 'shallow': return { top: semantic.desertPoolShore, side: semantic.desertPool };
      case 'ocean': return { top: semantic.desertPool, side: semantic.desertPoolDeep };
      default: break;
    }
    if (biome === 'tundra') return { top: semantic.desertSalt, side: semantic.desertSaltCrust };
    if (biome === 'steppe') return { top: semantic.desertScree, side: semantic.desertScreeDark };
    if (biome === 'hills') return { top: semantic.desertOchre, side: semantic.desertSandDark };
    return { top: semantic.desertSand, side: semantic.desertSandDark };
  }
  /** Faerbung der Heimat einer Fraktion / home tint of a faction */
  private tintOf(s: GameState, t: Tile): string | null {
    const homeFaction = t.home !== null && s.factions[t.home] ? s.factions[t.home].id : null;
    return homeFaction && !t.xeno ? factionTokens[homeFaction].terrain : null;
  }
  /** Ober- und Seitenfarbe eines Feldes / top and side colour of a tile */
  private tileColors(terrain: TerrainId, tint: string | null, biome?: BiomeId, xeno = false): { top: string; side: string } {
    if (this.theme === 'cavern') return this.caveColors(terrain, tint, biome, xeno);
    if (this.desert) return this.desertColors(terrain, biome);
    let topColor: string;
    let side: string = semantic.terrainPlainSide;
    switch (terrain) {
      case 'plain': topColor = semantic.terrainPlain; break;
      case 'forest': topColor = semantic.terrainForest; break;
      case 'mountain': topColor = semantic.terrainMountain; side = semantic.terrainMountainDark; break;
      case 'shallow': topColor = semantic.terrainShallow; side = semantic.terrainOcean; break;
      default: topColor = semantic.terrainOcean; side = semantic.terrainDeep; break;
    }
    const bt = biomeTop(terrain, biome);
    const lush = !biome || biome === 'grassland' || biome === 'hills';
    if (bt) { topColor = bt.top; if (bt.side) side = bt.side; }
    if (tint && (terrain === 'plain' || terrain === 'forest')) topColor = mix(topColor, tint, lush ? 0.5 : 0.18);
    if (tint && terrain === 'mountain') topColor = mix(topColor, tint, 0.15);
    // Heimatwelt der Zyrr: eigene Palette, Landschaften nur als Hauch / Zyrr homeworld: own palette, biomes only as a hint
    if (this.alien) {
      const land: Partial<Record<TerrainId, [string, string, number]>> = {
        plain: [semantic.alienGround, semantic.alienGroundDark, 0.1],
        forest: [mix(semantic.alienGround, semantic.alienMoss, 0.55), semantic.alienGroundDark, 0.08],
        mountain: [mix(semantic.alienRock, semantic.alienCrystalDark, 0.35), semantic.alienRockDark, 0.05],
        shallow: [semantic.alienWaterShallow, semantic.alienWaterOcean, 0],
        ocean: [semantic.alienWaterOcean, semantic.alienWaterDeep, 0],
      };
      const [base, edge, hint] = land[terrain] ?? land.plain!;
      return { top: mix(base, topColor, hint), side: edge };
    }
    // Xeno-Boden: violett mit dunkler Kante / xeno ground: violet with a dark edge
    if (xeno && terrain !== 'shallow' && terrain !== 'ocean') {
      topColor = mix(semantic.xenoGround, topColor, terrain === 'mountain' ? 0.35 : 0.15);
      side = semantic.xenoGroundDark;
    } else if (xeno) topColor = mix(topColor, semantic.xenoGlow, 0.35);
    // Schneewetter: Land leicht verschneit / snow weather: land lightly snow-covered
    if (this.snowy && terrain !== 'shallow' && terrain !== 'ocean') topColor = mix(topColor, semantic.snow, 0.5);
    return { top: topColor, side };
  }
  /**
   * Hoehlenpalette: Boden, Moos, Fels und Teich bleiben deutlich unterscheidbar; Landschaft und Heimat faerben nur leicht,
   * der Krater ist versengt (crater = Ring 0..2).
   * Cavern palette: floor, moss, rock and pool stay clearly distinguishable; biome and home tint only lightly,
   * the crater is scorched (crater = ring 0..2).
   */
  private caveColors(terrain: TerrainId, tint: string | null, biome?: BiomeId, xeno = false, crater = -1): { top: string; side: string } {
    let top: string, side: string = semantic.caveFloorSide;
    switch (terrain) {
      case 'plain': top = semantic.caveFloor; break;
      case 'forest': top = semantic.caveMoss; break;
      case 'mountain': top = semantic.caveRock; side = semantic.caveRockDark; break;
      default: top = semantic.cavePool; side = semantic.cavePoolDeep; break;
    }
    const land = terrain !== 'shallow' && terrain !== 'ocean';
    const bt = biomeTop(terrain, biome);
    if (bt && land) top = mix(top, bt.top, 0.1);
    if (tint && land) top = mix(top, tint, 0.12);
    if (xeno && land) top = mix(semantic.xenoGround, top, 0.45);
    if (crater >= 0 && land) top = mix(top, semantic.craterScorch, [0.7, 0.55, 0.35][crater] ?? 0);
    return { top, side };
  }

  /** scar: Schlachtfeld-Stufe fuer die Farbe (scarKeyTier), Teil des Schluessels / scar: battlefield tier for the colour (scarKeyTier), part of the key */
  private tileGeo(terrain: TerrainId | 'fog', tint: string | null, biome?: BiomeId, peak = 2, xeno = false, crater = -1, scar: ScarTier = 0): THREE.BufferGeometry {
    const key = `${terrain}-${tint}-${biome}-${peak}-${this.snowy}-${xeno}-${this.theme}-${crater}-${scar}`;
    let g = this.tileGeoCache.get(key);
    if (g) return g;
    if (terrain === 'fog') {
      const cave = this.theme === 'cavern';
      g = coloredBox(0.98, 0.32, 0.98, cave ? semantic.caveFogShade : semantic.cloudShade, cave ? semantic.caveWallDark : semantic.neutralDark);
      g.translate(0, 0.32 / 2 + TILE_BOTTOM, 0);
    } else {
      // Wasserfelder: Kasten unter der animierten Oberflaeche (water.ts) / water tiles: box below the animated surface
      const top = terrain === 'shallow' || terrain === 'ocean' ? WATER_BOX_TOP
        : TILE_TOP[terrain] + (biome ? BIOME_LIFT[biome] : 0) + (terrain === 'mountain' ? PEAK_LIFT[peak] : 0) - (crater >= 0 && terrain !== 'mountain' ? CRATER_DIP[crater] : 0);
      const h = top - TILE_BOTTOM;
      const base = this.theme === 'cavern' ? this.caveColors(terrain, tint, biome, xeno, crater) : this.tileColors(terrain, tint, biome, xeno);
      // Schlachtfeld: aufgewuehlte oder verwuestete Erde / battlefield: churned or devastated earth
      const c = scar ? scarColors(base, scar, scarGround(terrain, biome, this.theme, this.snowy)) : base;
      g = coloredBox(0.98, h, 0.98, c.top, c.side);
      g.translate(0, TILE_BOTTOM + h / 2, 0);
    }
    // Xeno-Boden glimmt nachts / xeno ground glimmers at night
    withGlow(g, xeno && terrain !== 'fog' && terrain !== 'shallow' && terrain !== 'ocean' ? 'xenoGround' : 'none');
    this.tileGeoCache.set(key, g);
    return g;
  }

  /** Grenzsegment, einmal gebaut / border segment, built once */
  private borderGeo: THREE.BufferGeometry | null = null;
  private slab: { key: string; geo: THREE.BufferGeometry } | null = null;
  /**
   * Scholle je Kartengroesse und Thema einmal bauen; die alte samt Kontur freigeben (sonst GPU-Leck bei jedem Neuaufbau).
   * Build the slab once per map size and theme; dispose the old one with its outline (otherwise a GPU leak on every rebuild).
   */
  private slabGeometry(size: number, cave: boolean): THREE.BufferGeometry {
    const key = `${size}|${cave}`;
    if (this.slab?.key === key) return this.slab.geo;
    if (this.slab) { hullGeometry(this.slab.geo).dispose(); this.slab.geo.dispose(); }
    const geo = withGlow(paint(new THREE.BoxGeometry(size + 0.1, SLAB_DEPTH, size + 0.1).toNonIndexed(), cave ? semantic.caveWallDark : semantic.soil), 'none');
    this.slab = { key, geo };
    return geo;
  }

  private clearGroup(g: THREE.Group) {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse((o) => {
        if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
        // eigene Geometrien je Neuaufbau (Wasser, Uebergaenge) / per-rebuild geometries (water, transitions)
        if (o.userData.dispose) (o as THREE.Mesh).geometry.dispose();
      });
    }
  }

  /** Statische Ebene neu aufbauen / rebuild static layer */
  rebuild(s: GameState, viewer: number) {
    this.size = s.size;
    const cave = isCavern(s);
    const low = this.quality === 'low';
    const theme = s.config.theme ?? null;
    if (theme !== this.theme) {
      this.theme = theme;
      this.fogFx.reset();
      setWaterTheme(theme === 'cavern' || theme === 'desert' ? theme : null);
    }
    this.alien = theme === 'alien';
    this.desert = theme === 'desert';
    const desert = this.desert;
    this.weatherFx.set(weather(s), s.size, cave, low);
    // unter Tage kein Schnee auf dem Boden / no snow on the ground underground
    this.snowy = !cave && weather(s) === 'snow';
    // Krater um das Artefakt (nur Optik): Ring je Feld, Absenkung fuer tileTop / crater around the artifact (visual only): ring per tile, dip for tileTop
    const crater = new Map<number, number>();
    const art = cave ? s.campaign?.artifact : undefined;
    if (art) {
      for (let dy = -CRATER_RADIUS; dy <= CRATER_RADIUS; dy++) for (let dx = -CRATER_RADIUS; dx <= CRATER_RADIUS; dx++) {
        const x = art.x + dx, y = art.y + dy;
        if (x < 0 || y < 0 || x >= s.size || y >= s.size) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        crater.set(y * s.size + x, ring);
        const t = s.tiles[y * s.size + x];
        if (t.terrain === 'plain' || t.terrain === 'forest') craterDip.set(t, CRATER_DIP[ring]);
      }
    }
    const glowSpots: NonNullable<TownInput['glow']> = [];
    const creatures: CreatureSpot[] = [];
    const glowC = [semantic.caveGlowTeal, semantic.caveGlowMagenta, semantic.caveGlowLime].map((h) => new THREE.Color(hex(h)));
    const amber = new THREE.Color(hex(semantic.caveLantern)), eye = new THREE.Color(hex(semantic.verdanEye));
    const relic = new THREE.Color(hex(semantic.artifactGlow)), gold = new THREE.Color(hex(semantic.artifactGold));
    const xenoLight = new THREE.Color(hex(semantic.xenoGlow));
    const templeFire = new THREE.Color(hex(semantic.templeFire));
    const seed = s.config.seed;
    this.clearGroup(this.staticLayer);
    this.artifactOrbit = null;
    this.academyObjs.clear();
    this.clearGroup(this.labelLayer);
    this.pickMeshes = [];
    this.cityProxies = [];
    this.citySigns = [];
    this.cityMasks = [];
    const size = s.size;
    const explored = (x: number, y: number) => viewer < 0 || isExplored(s, viewer, x, y);
    this.round = s.round;
    this.staticVersion++;
    ATMO.uHazeHalf.value = size / 2;
    this.revealFog(s, viewer, explored);

    // Scholle / slab
    const slab = outlined(this.slabGeometry(size, cave), OUTLINE.tile, landMaterial());
    slab.position.y = TILE_BOTTOM - SLAB_DEPTH / 2 + 0.001;
    this.staticLayer.add(slab);

    // Felder gruppiert nach Geometrie / tiles grouped by geometry
    const groups = new Map<THREE.BufferGeometry, { tiles: number[]; mats: THREE.Matrix4[]; tones: (THREE.Color | null)[]; toned: boolean }>();
    const add = (geo: THREE.BufferGeometry | null, m: THREE.Matrix4, tile: number, tone: THREE.Color | null = null) => {
      if (!geo) return;
      let gr = groups.get(geo);
      if (!gr) { gr = { tiles: [], mats: [], tones: [], toned: false }; groups.set(geo, gr); }
      gr.tiles.push(tile); gr.mats.push(m); gr.tones.push(tone);
      if (tone) gr.toned = true;
    };
    // Natuerliche Landschaft nur in der Standardwelt: Bodenton je Feld, Wiesenflecken, Waldsaum, Strand und Sandbank
    // natural landscape in the default world only: ground tone per tile, meadow patches, forest fringe, beach and sand shoal
    const natural = !cave && !this.alien && !this.desert;
    const tones: (THREE.Color | null)[] = new Array(s.tiles.length).fill(null);
    /** Feld mit eigener Schlachtfeld-Farbe: bleibt ohne Saeume und Ton / tile with its own battlefield colour: stays without fringes and tone */
    const scarred = (t: Tile) => scarKeyTier(scarTier(t), scarGround(t.terrain, t.biome, this.theme, this.snowy)) > 0;
    const builtOn = (t: Tile) => t.cityId !== null || !!t.building || !!t.grandProject || !!t.outpost || !!t.feature || !!t.turret || !!t.turretRuin || !!t.temple;
    const decoGroups = new Map<THREE.BufferGeometry, THREE.Matrix4[]>();
    const swayGroups = new Map<THREE.BufferGeometry, THREE.Matrix4[]>();
    const addDeco = (geo: THREE.BufferGeometry | null, m: THREE.Matrix4, sway = false, kind: GlowKind = 'nature') => {
      if (!geo) return;
      withGlow(geo, kind);
      const map = sway ? swayGroups : decoGroups;
      let list = map.get(geo);
      if (!list) { list = []; map.set(geo, list); }
      list.push(m);
    };
    const fishTiles: { x: number; z: number; y: number }[] = [];
    const occupied = new Set(s.units.filter((u) => viewer < 0 || canSeeUnit(s, viewer, u)).map((u) => u.y * size + u.x));
    this.occupiedTiles = new Set(occupied);
    // fallen gelassene Kriegsplaene (m4) halten das Feld frei wie eine Einheit / dropped war plans (m4) keep the tile clear like a unit
    const dropped = s.campaign?.plans?.at === 'dropped' ? s.campaign.plans : null;
    if (dropped) occupied.add(dropped.y! * size + dropped.x!);
    const lavaSpots: TownInput['lava'] = [];
    const decals = new Map<THREE.BufferGeometry, THREE.Matrix4[]>();
    const roadSegs: THREE.Matrix4[] = [];
    const roadNodes: THREE.Matrix4[] = [];
    const riverSegs: THREE.Matrix4[] = [];
    const borderSegs: { m: THREE.Matrix4; color: string }[] = [];
    const clouds: THREE.Matrix4[] = [];
    const off = (size - 1) / 2;
    const artifact = s.campaign && !s.campaign.result ? s.campaign.artifact : undefined;
    const portal = s.campaign?.portal;
    const alien = this.alien;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const k = y * size + x;
        const t = s.tiles[k];
        const pos = new THREE.Matrix4().makeTranslation(x - off, 0, y - off);
        if (!explored(x, y)) {
          add(this.tileGeo('fog', null), pos, k);
          const v = (x * 7 + y * 13) % 3;
          const cm = new THREE.Matrix4().compose(
            new THREE.Vector3(x - off, CLOUD_Y + ((x + y) % 2) * 0.04, y - off),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (v * Math.PI) / 2),
            new THREE.Vector3(1, 1, 1));
          clouds.push(cm);
          continue;
        }
        const homeFaction = t.home !== null && s.factions[t.home] ? s.factions[t.home].id : null;
        const ring = crater.get(k) ?? -1;
        // Schlachtfeld-Stufe (0 unberuehrt .. 3 verwuestet) / battlefield tier (0 untouched .. 3 devastated)
        const scar = scarTier(t);
        const ground = scarGround(t.terrain, t.biome, this.theme, this.snowy);
        // vernarbte Felder ohne Heimatfaerbung (verbrannte Erde; die Grenzlinien zeigen das Gebiet weiter): spart Feldgeometrien und Draw-Calls
        // scarred tiles without the home tint (scorched earth; the border lines still show the territory): saves tile geometries and draw calls
        const scarKey = scarKeyTier(scar, ground);
        if (natural && !scarKey && !t.xeno && (t.terrain === 'plain' || t.terrain === 'forest')) tones[k] = groundTone(x, y, seed);
        add(this.tileGeo(t.terrain, homeFaction && !t.xeno && !scarKey ? factionTokens[homeFaction].terrain : null, t.biome, t.peak ?? 2, !!t.xeno, ring, scarKey), pos, k, tones[k]);
        const top = tileTop(t);
        const ps = t.terrain === 'mountain' ? PEAK_SCALE[t.peak ?? 2] : 1;
        const at = (dy = 0) => new THREE.Matrix4().compose(
          new THREE.Vector3(x - off, top + dy, y - off),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x * 3 + y * 5) % 4) * (Math.PI / 2)),
          new THREE.Vector3(Math.min(1.15, 0.85 + ps * 0.15), ps, Math.min(1.15, 0.85 + ps * 0.15)));
        const variant = (x * 7 + y * 13) % 3;
        const hasStructure = t.cityId !== null || t.building || t.grandProject || t.outpost || t.feature || t.turret || t.turretRuin || t.temple;
        // Auf Feldern mit Einheit keine Baeume, Graeser oder Felsen, damit die Einheit frei steht
        // no trees, grass or rocks on tiles with a unit so the unit stands out
        const occ = occupied.has(k);
        // Pflanzen wiegen sich / plants sway
        const plant = t.terrain === 'forest' || t.resource === 'farmland' || (t.terrain === 'plain' && !t.resource);
        const jungle = t.terrain === 'forest' && t.biome === 'jungle';
        // schwer umkaempfter Wald wird zu Baumstuempfen (nicht in Hoehle und Alienwelt) / heavily fought-over forest turns into stumps (not in the cavern or alien world)
        const stumps = scar >= 3 && t.terrain === 'forest' && !t.resource && !cave && !alien;
        if (t.volcano) {
          // Vulkan statt Berggipfel, Rauch darueber / volcano instead of the peak, smoke above
          addDeco(volcanoGeometry(variant), at(), false, 'lava');
          lavaSpots.push({ x: x - off, y: top, z: y - off, size: 1.15 });
          addDeco(volcanoSmokeGeometry(), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top + 0.78, y - off), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)), true);
        } else if (cave && (!t.xeno || t.terrain === 'mountain')) {
          // Hoehle: Felssaeulen, Leuchtpilzwald, Hoehlenboden statt Bergen, Wald und Wiese
          // cavern: rock pillars, glowing mushroom forest, cave floor instead of mountains, forest and meadow
          const corner = (sc: number, h: number) => new THREE.Matrix4().compose(new THREE.Vector3(x - off - 0.28, top, y - off - 0.28), new THREE.Quaternion(), new THREE.Vector3(sc, h, sc));
          const free = !hasStructure || t.building === 'road';
          if (t.terrain === 'mountain') {
            if (occ) addDeco(rockPillars(variant, false), corner(0.45, 0.6));
            else if (free) addDeco(rockPillars((x * 5 + y * 11) % 4, t.resource === 'ore'), at());
          } else if (t.terrain === 'forest' && free) {
            const mv = (x * 5 + y * 11) % 4;
            addDeco(mushroomForest(mv, low || occ), occ ? corner(0.5, 0.8) : at(), true);
            if (!low || (x + y) % 2 === 0) glowSpots.push({ x: x - off, y: top, z: y - off, size: 1.15, color: glowC[(mv + x) % 3] });
          } else if (t.terrain === 'plain' && !occ && !hasStructure && !t.resource && !t.road && !t.remains && !t.barrier && ring < 0) {
            if (!low || (x + y) % 2 === 0) addDeco(caveFloorDeco((x * 7 + y * 13 + x * y) % 8), at(), true);
          }
          if (t.terrain === 'shallow' && (!low || (x + y) % 2 === 0)) glowSpots.push({ x: x - off, y: top, z: y - off, size: 0.95, color: glowC[0] });
          // Skelette, deterministisch aus dem Seed; dichter rund um den Krater / skeletons, deterministic from the seed; denser around the crater
          const d = art ? dist(art, { x, y }) : 99;
          if ((t.terrain === 'plain' || t.terrain === 'forest') && !occ && !hasStructure && !t.resource && !t.remains && d > 1) {
            const dens = (d >= 2 && d <= 6 ? 0.22 : 0.075) * (low ? 0.5 : 1);
            if (tileHash(x, y, seed, 5) < dens) {
              const h3 = tileHash(x, y, seed, 7);
              const kind: 0 | 1 | 2 = t.terrain === 'plain' && h3 < 0.22 ? 2 : h3 < 0.62 ? 0 : 1;
              const sc = t.terrain === 'forest' ? 0.75 : 1;
              const sx = t.terrain === 'forest' ? 0.24 : (tileHash(x, y, seed, 9) - 0.5) * 0.3;
              addDeco(caveBones(kind, Math.floor(tileHash(x, y, seed, 11) * 3)), new THREE.Matrix4().compose(
                new THREE.Vector3(x - off + sx, top, y - off + (t.terrain === 'forest' ? 0.26 : 0)),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tileHash(x, y, seed, 13) * Math.PI * 2), new THREE.Vector3(sc, sc, sc)));
            }
          }
          // leuchtende Hoehlentiere / glowing cavern creatures
          if (!occ && !hasStructure && t.terrain !== 'mountain') {
            const hc = tileHash(x, y, seed, 17) * (low ? 2 : 1);
            const kind = t.terrain === 'forest' ? (hc < 0.09 ? 'moth' : hc < 0.16 ? 'drifter' : null)
              : t.terrain === 'shallow' ? (hc < 0.07 ? 'drifter' : null)
                : t.terrain === 'plain' ? (hc < 0.045 ? 'crawler' : hc < 0.075 ? 'lizard' : null) : null;
            if (kind) creatures.push({ kind, x: x - off, y: top, z: y - off, phase: tileHash(x, y, seed, 19) });
          }
          // Krater: glimmende Risse, Truemmerring am Rand / crater: glowing cracks, debris ring at the rim
          if (art && ring >= 0) {
            addDeco(craterCracks(ring, (x + y * 3) % 3), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top + 0.001, y - off),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(x - art.x, y - art.y)), new THREE.Vector3(1, 1, 1)));
            if (ring > 0) glowSpots.push({ x: x - off, y: top, z: y - off, size: 0.9, color: (x + y) % 2 ? relic : gold });
          }
          if (art && (d === CRATER_RADIUS || d === CRATER_RADIUS + 1) && !occ && !hasStructure && t.terrain !== 'shallow' && t.terrain !== 'mountain') {
            const ox = Math.sign(x - art.x) * 0.22, oz = Math.sign(y - art.y) * 0.22;
            addDeco(craterDebris((x * 3 + y) % 3), new THREE.Matrix4().makeTranslation(x - off + ox, top, y - off + oz));
          }
        } else if (desert && t.terrain !== 'shallow' && t.terrain !== 'ocean') {
          // Welt der Vergessenen: Tafelberge statt Gipfeln, Dornengestruepp statt Wald, Duenen, Salz, Ruinen und Knochen
          // world of the Forgotten: mesas instead of peaks, thorn scrub instead of forest, dunes, salt, ruins and bones
          const free = !hasStructure || t.building === 'road';
          const corner = (sc: number, h: number) => new THREE.Matrix4().compose(new THREE.Vector3(x - off - 0.28, top, y - off - 0.28), new THREE.Quaternion(), new THREE.Vector3(sc, h, sc));
          // die Felswand hinter dem Hoehleneingang zeichnet das Schlund-Modell / the cave model draws the rock wall behind the entrance
          const cv = s.campaign?.cave;
          const wall = !!cv && dist(cv, { x, y }) === 1 && x <= cv.x && y <= cv.y;
          if (t.terrain === 'mountain' && wall) { /* Klippe des Schlunds / cliff of the maw */ }
          else if (t.terrain === 'mountain') {
            if (occ) addDeco(mesaGeometry(variant), corner(0.45, 0.6));
            else if (free) addDeco(mesaGeometry((x * 5 + y * 11) % 4), at());
          } else if (stumps && free) { if (!occ) addDeco(stumpsGeometry((x * 5 + y * 11) % 4), at()); }
          else if (t.terrain === 'forest' && free) addDeco(thornScrubGeometry((x * 5 + y * 11) % 4, low || occ), occ ? corner(0.5, 0.8) : at());
          else if (t.terrain === 'plain' && !occ && !hasStructure && !t.resource && !t.road && !t.remains && !t.barrier && scar < 3) {
            const site = s.campaign?.sites?.some((p) => p.x === x && p.y === y) || (s.campaign?.cave?.x === x && s.campaign?.cave?.y === y);
            const h1 = tileHash(x, y, seed, 23), h2 = tileHash(x, y, seed, 29);
            const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tileHash(x, y, seed, 31) * Math.PI * 2);
            if (site) { /* Staette und Schlund zeichnet der Kampagnenteil / site and maw come from the campaign part */ }
            else if (h1 < (low ? 0.05 : 0.09)) addDeco(verdanDesertRuin(Math.floor(h2 * 4)), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), rot, new THREE.Vector3(1, 1, 1)), false, 'built');
            else if (h1 < (low ? 0.08 : 0.14)) addDeco(giantSkeletonGeometry(Math.floor(h2 * 3)), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), rot, new THREE.Vector3(1.2, 1.2, 1.2)));
            else if (t.biome === 'tundra' ? (x * 3 + y) % 3 === 0 : !low || (x + y) % 2 === 0) addDeco(desertGroundDeco((x * 7 + y * 13 + x * y) % 8, t.biome === 'tundra'), at());
          }
        } else if (alien && t.terrain !== 'shallow' && t.terrain !== 'ocean') {
          // Heimatwelt der Zyrr: Kristalltuerme statt Gipfeln, grosse Pflanzen statt Baeumen, kleine Flora
          // Zyrr homeworld: crystal spires instead of peaks, big plants instead of trees, small flora
          const h = x * 7 + y * 13 + x * y;
          if (t.terrain === 'mountain') {
            addDeco(crystalSpireGeometry(variant), occ ? new THREE.Matrix4().compose(new THREE.Vector3(x - off - 0.3, top, y - off - 0.3), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.6, 0.45)) : at());
          } else if (!occ && (!hasStructure || t.building === 'road')) {
            if (t.terrain === 'forest') addDeco(alienPlantGeometry(h % 4), at(), true);
            else if (t.resource === 'supplies') addDeco(decorationGeometry(t.terrain, t.resource, variant), at());
            else if (h % 3 !== 0) addDeco(xenoDecoration(h % 6), at(), true);
          }
        } else if (occ && t.terrain === 'mountain') {
          // Berg bleibt erkennbar: kleiner Gipfel in der hinteren Ecke / mountain stays readable: small peak in the back corner
          addDeco(decorationGeometry(t.terrain, null, variant), new THREE.Matrix4().compose(new THREE.Vector3(x - off - 0.3, top, y - off - 0.3), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.6, 0.45)));
        } else if (t.xeno && t.terrain !== 'mountain' && t.terrain !== 'shallow' && t.terrain !== 'ocean') {
          // Xeno-Flora statt Baeumen und Graesern / xeno flora instead of trees and grass
          if (!occ && (!hasStructure || t.building === 'road')) addDeco(t.resource ? decorationGeometry(t.terrain, t.resource, variant) : xenoDecoration((x * 7 + y * 13 + x * y) % 6), at(), !t.resource);
        } else if (stumps) {
          // zerschossener Wald / shot-up forest
          if (!occ && (!hasStructure || t.building === 'road')) addDeco(stumpsGeometry((x * 5 + y * 11) % 4), at());
        } else if (jungle && !t.resource) {
          // dichter Dschungel, auch neben Einheiten sichtbar am Rand / dense jungle, kept at the edge next to units
          if (!hasStructure || t.building === 'road') addDeco(jungleDecoration((x * 5 + y * 11) % 4), occ ? new THREE.Matrix4().compose(new THREE.Vector3(x - off - 0.28, top, y - off - 0.28), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.8, 0.45)) : at(), true);
        } else if (!occ && (!hasStructure || t.building === 'road') && t.terrain === 'plain' && !t.resource && scar >= 2) {
          // umkaempfte Wiese: verbranntes Gras (mittel) oder nackte Erde (schwer) / fought-over meadow: burnt grass (medium) or bare earth (heavy)
          if (scar === 2) addDeco(burntGrassGeometry((x * 7 + y * 13) % 2), at());
        } else if (!occ && (!hasStructure || t.building === 'road') && !(alien && t.resource === 'fish')) addDeco(decorationGeometry(t.terrain, t.resource, variant), at(), plant);
        // brennende Lava nach einem Ausbruch, Raketenbrand (Schattenflotte) mit denselben Flammen / burning lava after an eruption, rocket fire (shadow fleet) with the same flames
        if (burning(s, t) || onFire(s, t)) {
          addDeco(lavaGeometry((x + y * 3) % 3), new THREE.Matrix4().makeTranslation(x - off, top + 0.005, y - off), false, 'lava');
          lavaSpots.push({ x: x - off, y: top, z: y - off, size: 1.9 });
        }
        if (!cave && !desert && !jungle && !t.xeno && !occ && !hasStructure && !t.resource && !t.road && !t.remains && !t.barrier && scar < 2) {
          // Wiese der Standardwelt: mehr Sorten, aus dem Seed gewuerfelt (niedrige Qualitaet: die bisherigen acht) / meadow of the default world: more kinds, rolled from the seed (low quality: the previous eight)
          const meadow = natural && !low && t.terrain === 'plain' && (!t.biome || t.biome === 'grassland' || t.biome === 'jungle');
          addDeco(biomeDecoration(t.terrain, t.biome, meadow ? meadowVariant(tileHash(x, y, seed, 71)) : (x * 7 + y * 13 + x * y) % 8), at(), true);
          // Waldsaum: ein kleiner Baum an der Kante zu erkundetem Wald auf gleicher Hoehe, hoechstens zwei je Feld
          // forest fringe: one small tree at the edge towards explored forest on the same level, at most two per tile
          // nicht auf Feldern mit Fluss, Portal oder einer fuer den Betrachter sichtbaren Mine / not on tiles with a river, the portal or a mine the viewer can see
          const marked = (!!t.mine && (viewer < 0 || canSeeMine(s, viewer, x, y))) || (!!portal && portal.x === x && portal.y === y);
          if (natural && !low && t.terrain === 'plain' && !t.river && !marked) {
            let n = 0;
            for (const [i, [dx, dy]] of ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const).entries()) {
              const nx = x + dx, ny = y + dy;
              if (n >= NATURAL.fringe.max || nx < 0 || ny < 0 || nx >= size || ny >= size || !explored(nx, ny)) continue;
              const o = s.tiles[ny * size + nx];
              if (o.terrain !== 'forest' || o.biome === 'jungle' || o.xeno || (builtOn(o) && o.building !== 'road') || scarTier(o) >= 3 || Math.abs(tileTop(o) - top) >= CLIFF_STEP) continue;
              if (tileHash(x, y, seed, 73 + i) >= NATURAL.fringe.chance) continue;
              n++;
              const d = NATURAL.fringe.near + (NATURAL.fringe.far - NATURAL.fringe.near) * tileHash(x, y, seed, 79 + i), side = (tileHash(x, y, seed, 89 + i) - 0.5) * 0.56, sc = 0.9 + tileHash(x, y, seed, 97 + i) * 0.2;
              addDeco(fringeGeometry(Math.floor(tileHash(x, y, seed, 101 + i) * NATURAL.fringe.variants)), new THREE.Matrix4().compose(
                new THREE.Vector3(x - off + dx * d - dy * side, top, y - off + dy * d + dx * side),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tileHash(x, y, seed, 107 + i) * Math.PI * 2), new THREE.Vector3(sc, sc, sc)), true);
            }
          }
        }
        // Fische (die Brandung zeichnet der Wasser-Shader) / fish (the surf is drawn by the water shader)
        if ((t.terrain === 'shallow' || t.terrain === 'ocean') && t.resource === 'fish' && !t.building && !alien) fishTiles.push({ x: x - off, z: y - off, y: top });
        // Krater und Brandflecken, groesser je Schlachtfeld-Stufe / craters and scorch marks, larger per battlefield tier
        const ms = SCAR_MARK_SCALE[scar];
        for (const [i, mk] of (t.marks ?? []).entries()) {
          const geo = mk.k === 'crater' ? craterGeometry((x + y + i) % 3) : scorchGeometry((x * 3 + y + i) % 3);
          if (!decals.has(geo)) decals.set(geo, []);
          decals.get(geo)!.push(new THREE.Matrix4().compose(new THREE.Vector3(x - off + mk.ox, top, y - off + mk.oz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), mk.a), new THREE.Vector3(ms, 1, ms)));
        }
        // Schlachtfeld ab mittlerer Stufe: Truemmer, Zaeune, Trichter, Strassenschaeden, Rauch, Oel auf See
        // battlefield from the medium tier: debris, fences, shell holes, road damage, smoke, oil at sea
        if (scar >= 2) {
          // wenige Varianten je Modell (jede Variante kostet einen Draw-Call), Drehung sorgt fuer Abwechslung
          // few variants per model (each variant costs a draw call), rotation adds variety
          const sv = Math.floor(tileHash(x, y, seed, 41) * 6);
          const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tileHash(x, y, seed, 43) * Math.PI * 2);
          const put = (geo: THREE.BufferGeometry, m: THREE.Matrix4) => { if (!decals.has(geo)) decals.set(geo, []); decals.get(geo)!.push(m); };
          if (ground === 'water') {
            if (!t.building && !alien) put(oilSlickGeometry(sv % 2, scar >= 3), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top + 0.004, y - off), rot, new THREE.Vector3(1, 1, 1)));
          } else if (t.terrain !== 'mountain') {
            // Bauwerke, Ressourcen und Sonderorte bleiben frei lesbar / structures, resources and special sites stay readable
            const clear = (!hasStructure || t.building === 'road') && !t.resource && !t.volcano;
            if (scar >= 3) put(shellHolesGeometry(sv % 3), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), rot, new THREE.Vector3(1, 1, 1)));
            if (clear && (scar >= 3 || tileHash(x, y, seed, 47) < 0.6)) addDeco(debrisGeometry(sv % 3), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), rot, new THREE.Vector3(1, 1, 1)));
            if (clear && scar === 2 && t.terrain === 'plain' && !t.road && !cave && !alien && tileHash(x, y, seed, 53) < 0.4) {
              const side = Math.floor(tileHash(x, y, seed, 59) * 4) * (Math.PI / 2);
              addDeco(brokenFenceGeometry(sv % 2), new THREE.Matrix4().compose(new THREE.Vector3(x - off + Math.sin(side) * 0.4, top, y - off + Math.cos(side) * 0.4),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side), new THREE.Vector3(1, 1, 1)));
            }
            if (t.road) put(roadDamageGeometry(sv % 2), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), rot, new THREE.Vector3(1, 1, 1)));
            // Rauch in der hinteren Ecke, nur kurz nach dem Kampf / smoke in the back corner, only shortly after the fight
            if (clear && scarSmokes(scar, t.scar?.r, s.round, WAR_MARKS.scar.smokeRounds) && tileHash(x, y, seed, 61) < (low ? 0.25 : 0.5)) {
              addDeco(smokeWispGeometry(sv % 2), new THREE.Matrix4().makeTranslation(x - off - 0.3, top, y - off - 0.3), true);
            }
          }
        }
        // Kettenspuren / track marks
        for (const m of t.tracks ?? []) {
          const age = s.round - m.r;
          const geo = trackGeometry(age <= 1 ? semantic.trackFresh : semantic.trackOld);
          if (!decals.has(geo)) decals.set(geo, []);
          decals.get(geo)!.push(new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.a), new THREE.Vector3(1, 1, 1)));
        }
        // Fluesse / rivers
        if (t.river) {
          const wet = (xx: number, yy: number) => {
            if (xx < 0 || yy < 0 || xx >= size || yy >= size) return false;
            // nur erkundete Nachbarn: der Fluss verraet kein Wasser unter dem Nebel / explored neighbours only: the river reveals no water under the fog
            if (!explored(xx, yy)) return false;
            const o = s.tiles[yy * size + xx];
            return !!o.river || o.terrain === 'shallow' || o.terrain === 'ocean';
          };
          let any = false;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (!wet(x + dx, y + dy)) continue;
            any = true;
            riverSegs.push(new THREE.Matrix4().compose(new THREE.Vector3(x - off + dx * 0.25, top + 0.008, y - off + dy * 0.25),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dy)), new THREE.Vector3(1, 1, 0.56)));
          }
          if (!any) riverSegs.push(new THREE.Matrix4().compose(new THREE.Vector3(x - off, top + 0.008, y - off), new THREE.Quaternion(), new THREE.Vector3(1, 1, 0.3)));
        }
        // Hoehle: nur die Ressourcen-Requisiten (Fels und Pilze zeichnet der Hoehlenzweig) / cavern: only resource props (rock and mushrooms come from the cavern branch)
        // Alienwelt: keine Rinder und Felder, Fremdtiere grasen dort / alien world: no cattle and fields, critters graze there
        // Wueste: nur Erz und Vorraete, keine Felder und Rinder / desert: only ore and supplies, no fields and cattle
        else if (!occ && t.resource && !t.building && t.cityId === null && !(cave && t.terrain === 'mountain') && (!alien || t.resource === 'ore') && (!desert || t.resource === 'ore' || t.resource === 'supplies')) {
          const rg = decorationGeometry(cave && t.terrain === 'forest' ? 'plain' : t.terrain, t.resource, variant);
          addDeco(desert && rg ? sandify(rg, `res${t.terrain}${t.resource}${variant}`) : rg, at());
        }
        // Verdan-Geschuetz, zum Artefakt gedreht; Truemmer nach der Zerstoerung / Verdan gun facing the artifact; rubble after destruction
        if (t.turret && t.turret.hp > 0 && t.turret.kind === 'silo') {
          // Raketensilo (Meridon): Deckel offen, Rakete sichtbar / rocket silo (Meridon): hatch open, rocket visible
          const sf = s.factions[t.turret.owner ?? 0]?.id ?? 'meridon';
          const sg = siloGeometry(sf);
          addDeco(desert && sg ? sandify(sg, `silo${sf}`) : sg, new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x * 3 + y) % 4) * (Math.PI / 2)), new THREE.Vector3(1.1, 1.1, 1.1)), false, 'built');
        } else if (t.turret && t.turret.hp > 0 && t.turret.kind === 'hack') {
          // Hackturm (NEXUS): Schuessel zur naechsten Grenze, leuchtet heller, solange er eine Einheit haelt
          // hack tower (NEXUS): dish towards the nearest border, glows brighter while it holds a unit
          const hf = s.factions[t.turret.owner ?? 0]?.id ?? 'nexus';
          const linked = t.turret.link !== undefined && s.units.some((o) => o.id === t.turret!.link && o.hijack);
          let home: { x: number; y: number } | null = null, hd = Infinity;
          for (const c of s.cities) if (c.owner === t.turret.owner) { const d = Math.max(Math.abs(c.x - x), Math.abs(c.y - y)); if (d < hd) { hd = d; home = c; } }
          const face = home && hd > 0 ? Math.atan2(x - home.x, y - home.y) : ((x * 3 + y) % 8) * (Math.PI / 4);
          const hg = hackTowerGeometry(hf, linked);
          addDeco(desert && hg ? sandify(hg, `hackTower${hf}${linked}`) : hg, new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), face), new THREE.Vector3(1.1, 1.1, 1.1)), false, 'built');
          glowSpots.push({ x: x - off, y: top, z: y - off, size: linked ? 1.5 : 0.9, color: new THREE.Color(hex(factionTokens[hf].marker)) });
        } else if (t.turret && t.turret.hp > 0 && t.turret.owner !== undefined) {
          // Geschuetzstellung: Rohr weg von der naechsten eigenen Stadt (zur Grenze) / gun emplacement: barrel away from the nearest own city (towards the border)
          const ef = s.factions[t.turret.owner]?.id ?? 'dravon';
          let home: { x: number; y: number } | null = null, hd = Infinity;
          for (const c of s.cities) if (c.owner === t.turret.owner) { const d = Math.max(Math.abs(c.x - x), Math.abs(c.y - y)); if (d < hd) { hd = d; home = c; } }
          const face = home && hd > 0 ? Math.atan2(x - home.x, y - home.y) : ((x * 3 + y) % 8) * (Math.PI / 4);
          const eg = emplacementGeometry(ef);
          addDeco(desert && eg ? sandify(eg, `emplacement${ef}`) : eg, new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), face), new THREE.Vector3(1.15, 1.15, 1.15)), false, 'built');
        } else if (t.turret && t.turret.hp > 0) {
          // zum bewachten Punkt gedreht (Artefakt oder Ruinenstaette) / facing the guarded point (artifact or ruin site)
          const g = art ?? (s.campaign?.sites?.length ? turretGuard(s, { x, y }) : undefined);
          const face = g ? Math.atan2(g.x - x, g.y - y) : 0;
          const tg = verdanTurretGeometry(t.turret.active);
          addDeco(desert && tg ? sandify(tg, `turret${t.turret.active}`) : tg, new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), face), new THREE.Vector3(1.2, 1.25, 1.2)), false, 'built');
          if (t.turret.active) glowSpots.push({ x: x - off, y: top, z: y - off, size: 1.6, color: eye });
        } else if (t.turretRuin && t.turretRuinOwner !== undefined) {
          // Truemmer einer Geschuetzstellung / rubble of a gun emplacement
          addDeco(emplacementRuinGeometry(s.factions[t.turretRuinOwner]?.id ?? null), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x * 3 + y) % 8) * (Math.PI / 4)), new THREE.Vector3(1.1, 1.1, 1.1)), false, 'built');
        } else if (t.turretRuin) addDeco(verdanRuinGeometry(), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (x * 3 + y) % 4), new THREE.Vector3(1, 1, 1)), false, 'built');
        const owner = t.territory !== null ? cityById(s, t.territory)?.owner ?? null : null;
        const ownerFaction = owner !== null ? s.factions[owner].id : null;
        if (t.building && t.building !== 'road') {
          let rot = 0;
          if (t.building === 'bridge') {
            const landAt = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < size && yy < size && !['shallow', 'ocean'].includes(s.tiles[yy * size + xx].terrain);
            if (landAt(x - 1, y) || landAt(x + 1, y)) rot = Math.PI / 2;
          }
          addDeco(buildingGeometry(t.building, ownerFaction), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1)), false, 'built');
        }
        if (t.grandProject) addDeco(buildingGeometry(t.grandProject, ownerFaction), new THREE.Matrix4().makeTranslation(x - off, top, y - off), false, 'built');
        if (t.outpost) addDeco(buildingGeometry('outpost', s.factions[t.outpost.owner]?.id ?? null), new THREE.Matrix4().makeTranslation(x - off, top, y - off), false, 'built');
        if (t.feature === 'labRuin') addDeco(labRuinGeometry((x + y) % 2), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x + y * 3) % 4) * (Math.PI / 2)), new THREE.Vector3(1, 1, 1)));
        else if (t.feature === 'crashSite') addDeco(crashSiteGeometry((x + y) % 2), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x * 3 + y) % 4) * (Math.PI / 2)), new THREE.Vector3(1, 1, 1)));
        else if (t.feature === 'mothership') {
          // Mutterschiff (m2): ein Modell ueber 2x2 Feldern, an der linken oberen Ecke gesetzt, auf dem tiefsten der vier Felder
          // mothership (m2): one model over 2x2 tiles, set at the top-left corner, on the lowest of the four tiles
          const sh = s.campaign?.ship;
          if (sh && sh.x === x && sh.y === y) {
            let ty = Infinity;
            for (const q of shipTiles(sh)) ty = Math.min(ty, tileTop(s.tiles[q.y * size + q.x]));
            const m = new THREE.Matrix4().compose(new THREE.Vector3(x - off + 0.5, ty, y - off + 0.5), SHIP_TURN, new THREE.Vector3(1, 1, 1));
            addDeco(mothershipGeometry(low), m, false, 'built');
            addDeco(mothershipSmokeGeometry(low), m, true);
            glowSpots.push({ x: x - off + 0.5, y: ty, z: y - off + 0.5, size: 2.4, color: xenoLight });
            // Wettlauf (m2): Stand aller Fraktionen ueber dem Wrack / race (m2): every faction's progress above the wreck
            if (this.showLabels && s.campaign?.race) {
              const rows = raceStandings(s).map((e) => ({ color: factionTokens[s.factions[e.faction].id].primary, have: Math.min(e.work, M2.workRounds), out: !e.alive && !e.pending }));
              const badge = raceBadge(rows, M2.workRounds);
              badge.position.set(x - off + 0.5, ty + 1.35, y - off + 0.5);
              badge.center.set(0.5, 0);
              this.labelLayer.add(badge);
            }
          }
        } else if (t.feature) { const fg = featureGeometry(t.feature); addDeco(desert && fg ? sandify(fg, `feature${t.feature}`) : fg, new THREE.Matrix4().makeTranslation(x - off, top, y - off), false, 'built'); }
        // Ruinenstaette (m13): leuchtet, sobald entziffert / ruin site (m13): glows once deciphered
        const si = s.campaign?.sites?.findIndex((p) => p.x === x && p.y === y) ?? -1;
        if (si >= 0) {
          const done = !!s.campaign?.siteDone?.[si];
          addDeco(ruinSiteGeometry(done), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), new THREE.Vector3(1.15, 1.15, 1.15)), false, 'built');
          glowSpots.push({ x: x - off, y: top, z: y - off, size: done ? 2.2 : 1.1, color: relic });
        }
        // Hoehleneingang (m14): der Schlund schaut zur offenen Seite / cave entrance (m14): the maw faces the open side
        const cv = s.campaign?.cave;
        if (cv && cv.x === x && cv.y === y) {
          let fx = 0, fz = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const o = s.tiles[(y + dy) * size + (x + dx)];
            if (x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size || !o || o.terrain !== 'mountain') continue;
            fx -= dx; fz -= dy;
          }
          const face = Math.atan2(fx, fz);
          addDeco(caveMouthGeometry(), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), face), new THREE.Vector3(1.2, 1.2, 1.2)), false, 'built');
          glowSpots.push({ x: x - off, y: top, z: y - off, size: 1.8, color: relic });
        }
        // Fanatiker-Tempel (m4): ein Modell ueber 2x2 Felder am Anker, Feuerschalen leuchten nachts
        // Fanatic temple (m4): one model over 2x2 tiles at the anchor, braziers glow at night
        const tp = s.campaign?.temple;
        if (tp && tp.x === x && tp.y === y) {
          addDeco(templeGeometry(low), new THREE.Matrix4().makeTranslation(x + 0.5 - off, top, y + 0.5 - off), false, 'built');
          for (const [dx, dz] of [[0.66, 0.66], [-0.66, 0.66], [0.66, -0.66], [-0.66, -0.66]]) glowSpots.push({ x: x + 0.5 - off + dx, y: top, z: y + 0.5 - off + dz, size: 1.3, color: templeFire });
        }
        // fallen gelassene Kriegsplaene (m4) / dropped war plans (m4)
        const pl = s.campaign?.plans;
        if (pl?.at === 'dropped' && pl.x === x && pl.y === y) {
          addDeco(plansGeometry('dropped', low), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion(), new THREE.Vector3(1.6, 1.6, 1.6)), false, 'built');
          glowSpots.push({ x: x - off, y: top, z: y - off, size: 1.1, color: templeFire });
        }
        // Dimensionsportal der Kampagne (begehbar) / campaign dimensional portal (walkable)
        if (portal && portal.x === x && portal.y === y) {
          addDeco(portalGeometry(), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), new THREE.Vector3(UNIT_SCALE, UNIT_SCALE, UNIT_SCALE)), false, 'bright');
        }
        // Artefakt: schwingt leicht mit (Sway-Gruppe) / artifact: sways gently (sway group)
        if (artifact && artifact.x === x && artifact.y === y) {
          addDeco(artifactMarker(), new THREE.Matrix4().makeTranslation(x - off, top, y - off), false, 'built');
          const orbit = outlined(withGlow(artifactGeometry('orbit'), 'built'), OUTLINE.building, landMaterial());
          orbit.position.set(x - off, top + ARTIFACT_ORBIT_Y, y - off);
          if (cave) glowSpots.push({ x: x - off, y: top, z: y - off, size: 5.5, color: relic });
          this.artifactOrbit = orbit;
          this.staticLayer.add(orbit);
        }
        if (t.barrier) {
          const bf = s.factions[t.barrier.owner]?.id;
          addDeco(safe(barrierGeometry, semantic.metal, bf ? factionTokens[bf].secondary : semantic.metal), new THREE.Matrix4().makeTranslation(x - off, top, y - off));
        }
        // Mine: nur fuer den Besitzer und Einheiten daneben sichtbar / mine: only visible to the owner and adjacent units
        if (t.mine && (viewer < 0 || canSeeMine(s, viewer, x, y))) {
          addDeco(models.mineGeometry(s.factions[t.mine.owner]?.id ?? null), new THREE.Matrix4().makeTranslation(x - off, top, y - off));
        }
        // Ueberreste: Fleck + Skelett oder Wrack / remains: splat + skeleton or wreck
        if (t.remains) {
          const rem = t.remains;
          const fid = s.factions[rem.faction]?.id ?? 'korvat';
          const v = (x * 5 + y * 3) % 3;
          const splat = splatGeometry(rem.kind === 'wreck' ? semantic.oil : semantic.splatter, v);
          const dm = new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), v * 2.1), new THREE.Vector3(1, 1, 1));
          if (!decals.has(splat)) decals.set(splat, []);
          decals.get(splat)!.push(dm);
          const hasStruct = t.building || t.outpost || t.grandProject;
          const sc = hasStruct ? 0.7 : 1;
          if (rem.kind === 'wreck') {
            addDeco(safe(wreckGeometry, factionTokens[fid].primary, rem.unit, fid, v), new THREE.Matrix4().compose(
              new THREE.Vector3(x - off + (hasStruct ? 0.24 : 0), top, y - off + (hasStruct ? 0.24 : 0)), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc)));
          }
          // Skelette bleiben dauerhaft, bis zu drei sichtbar / skeletons are permanent, up to three visible
          const count = Math.min(3, rem.skeletons ?? (rem.kind === 'skeleton' ? 1 : 0));
          const sf = s.factions[rem.skeletonFaction ?? rem.faction]?.id ?? fid;
          const spots = rem.kind === 'wreck' ? [[-0.26, 0.24], [0.26, -0.22], [-0.24, -0.26]] : [[0, 0], [0.22, -0.2], [-0.22, 0.18]];
          for (let i = 0; i < count; i++) {
            const k = 0.85 * (rem.kind === 'wreck' || i > 0 ? 0.75 : 1) * sc;
            addDeco(safe(skeletonGeometry, semantic.bone, sf, (v + i) % 3), new THREE.Matrix4().compose(
              new THREE.Vector3(x - off + spots[i][0] + (hasStruct ? 0.2 : 0), top, y - off + spots[i][1] + (hasStruct ? 0.2 : 0)), new THREE.Quaternion(), new THREE.Vector3(k, k, k)));
          }
        }
        // Mahnmal des Kults in der seitlichen Feldecke, neben der Einheit sichtbar / cult memorial in the side corner of the tile, visible next to the unit
        const mem = memorialAt(s, x, y);
        if (mem) {
          const mf = s.factions[mem.faction]?.id ?? 'korvat';
          addDeco(safe(models.memorialGeometry, semantic.bone, mf), new THREE.Matrix4().compose(
            new THREE.Vector3(x - off + 0.33, top, y - off - 0.33), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.6), new THREE.Vector3(1.3, 1.3, 1.3)));
        }
        // Strassen / roads
        const roadLike = (xx: number, yy: number) => {
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) return false;
          const o = s.tiles[yy * size + xx];
          return (o.road || o.cityId !== null) && explored(xx, yy);
        };
        if (t.road || t.cityId !== null) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if ((!dx && !dy) || !roadLike(x + dx, y + dy)) continue;
              if (!t.road && !s.tiles[(y + dy) * size + x + dx].road) continue;
              const len = Math.hypot(dx, dy) / 2;
              const ang = Math.atan2(dx, dy);
              const m = new THREE.Matrix4().compose(
                new THREE.Vector3(x - off + dx * 0.25, top + 0.002, y - off + dy * 0.25),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang),
                new THREE.Vector3(1, 1, len));
              roadSegs.push(m);
            }
          }
          if (t.road) roadNodes.push(new THREE.Matrix4().makeTranslation(x - off, top + 0.003, y - off));
        }
        // Grenzen / borders
        if (owner !== null) {
          const color = factionTokens[s.factions[owner].id].primary;
          const dirs: [number, number, number][] = [[0, -1, 0], [1, 0, Math.PI / 2], [0, 1, Math.PI], [-1, 0, -Math.PI / 2]];
          for (const [dx, dy, rot] of dirs) {
            const nx = x + dx, ny = y + dy;
            let other: number | null = null;
            if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
              const nt = s.tiles[ny * size + nx];
              other = nt.territory !== null ? cityById(s, nt.territory)?.owner ?? null : null;
            }
            if (other === owner) continue;
            const m = new THREE.Matrix4().compose(
              new THREE.Vector3(x - off + dx * 0.44, Math.max(top, 0) + 0.03, y - off + dy * 0.44),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot),
              new THREE.Vector3(1, 1, 1));
            borderSegs.push({ m, color });
          }
        }
      }
    }

    for (const [geo, gr] of groups) {
      const { mesh, line } = outlinedInstanced(geo, gr.mats.length, OUTLINE.tile, landMaterial());
      mesh.receiveShadow = true;
      gr.mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      // Bodenton je Feld als Instanzfarbe (kostet weder Dreiecke noch Draw-Calls) / ground tone per tile as instance colour (costs neither triangles nor draw calls)
      if (gr.toned) { gr.tones.forEach((c, i) => mesh.setColorAt(i, c ?? WHITE)); mesh.instanceColor!.needsUpdate = true; }
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.staticLayer.add(mesh, line);
      this.pickMeshes.push({ mesh, tiles: gr.tiles });
    }
    for (const [geo, mats] of decoGroups) {
      const { mesh, line } = outlinedInstanced(geo, mats.length, sceneryLine(geo), landMaterial());
      mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.raycast = () => {};
      // Gebaeude, Berge und Baeume werfen Schatten (nur bei hoher Qualitaet aktiv) / buildings, mountains and trees cast shadows (high quality only)
      mesh.castShadow = true;
      this.staticLayer.add(mesh, line);
    }
    for (const [geo, mats] of swayGroups) {
      const { mesh, line } = outlinedInstanced(geo, mats.length, sceneryLine(geo), swayMaterial(), swayOutline(sceneryLine(geo)));
      mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.raycast = () => {};
      mesh.castShadow = true;
      // Hoehle, niedrige Qualitaet: Pilze und Bodendeko ohne Tuschelinie (halbiert die Dreiecke) / cavern, low quality: mushrooms and floor decoration without ink line (halves the triangles)
      if (cave && low && geo.name.startsWith('cave|')) { line.dispose(); this.staticLayer.add(mesh); } else this.staticLayer.add(mesh, line);
    }
    // Bodenschatten unter Baeumen, Felsen und anderer stehender Dekoration / contact shadows under trees, rocks and other standing decoration
    this.contact.buildDeco([decoGroups, swayGroups]);
    this.ambient.build(fishTiles);
    for (const [geo, mats] of decals) {
      const mesh = new THREE.InstancedMesh(withGlow(geo, 'none'), decalMaterial(), mats.length);
      mesh.receiveShadow = true;
      mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.raycast = () => {};
      this.staticLayer.add(mesh);
    }
    if (riverSegs.length) {
      // Alienwelt: violette Baeche / alien world: violet streams
      // Wueste: ausgetrocknete Flussbetten / desert: dried-up riverbeds
      const g = alien ? alienTint(riverSegment(), 'river', semantic.alienWaterShallow, 0.85) : desert ? alienTint(riverSegment(), 'dryRiver', semantic.desertScreeDark, 0.9) : riverSegment();
      const { mesh, line } = outlinedInstanced(g, riverSegs.length, OUTLINE.highlight);
      riverSegs.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.raycast = () => {};
      this.staticLayer.add(mesh, line);
    }
    for (const [geo, list] of [[roadSegment(), roadSegs], [roadJunction(), roadNodes]] as [THREE.BufferGeometry, THREE.Matrix4[]][]) {
      if (!list.length) continue;
      const { mesh, line } = outlinedInstanced(geo, list.length, OUTLINE.highlight);
      list.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.raycast = () => {};
      this.staticLayer.add(mesh, line);
    }
    if (borderSegs.length) {
      const g = this.borderGeo ??= paint(new THREE.BoxGeometry(0.98, 0.05, 0.07).toNonIndexed(), semantic.white);
      const mesh = new THREE.InstancedMesh(g, toonMaterial(), borderSegs.length);
      borderSegs.forEach((b, i) => { mesh.setMatrixAt(i, b.m); mesh.setColorAt(i, new THREE.Color(hex(b.color))); });
      mesh.raycast = () => {};
      const line = new THREE.InstancedMesh(hullGeometry(g), outlineMaterial(OUTLINE.highlight), borderSegs.length);
      borderSegs.forEach((b, i) => line.setMatrixAt(i, b.m));
      line.raycast = () => {};
      this.staticLayer.add(mesh, line);
    }
    if (clouds.length) {
      // Hoehle und Alienwelt: Nebel in eigenen Toenen / cavern and alien world: fog in their own tones
      const geos = [0, 1, 2].map((v) => (cave ? caveCloudGeometry(v) : alien ? alienCloud(cloudGeometry(v), v) : desert ? alienTint(cloudGeometry(v), `dustCloud${v}`, semantic.desertCloud, 0.5) : cloudGeometry(v)));
      const byVariant: THREE.Matrix4[][] = [[], [], []];
      clouds.forEach((m, i) => byVariant[i % 3].push(m));
      byVariant.forEach((list, v) => {
        if (!list.length) return;
        const { mesh, line } = outlinedInstanced(withGlow(geos[v], 'none'), list.length, OUTLINE.cloud, cloudMaterial(), cloudOutline(OUTLINE.cloud));
        list.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
        mesh.raycast = () => {};
        this.staticLayer.add(mesh, line);
      });
    }

    // Staedte / cities
    const townCities: TownInput['cities'] = [];
    const relayLamps: THREE.Vector3[] = [];
    for (const c of s.cities) {
      if (!explored(c.x, c.y)) continue;
      const fid = c.owner !== null ? s.factions[c.owner].id : null;
      const level = c.owner === null ? 1 : c.level;
      // Schwebende Akademie und Forschungsposten (Velkar) / floating academy and research post (Velkar)
      if ((c.academy || c.post) && fid && !cave && !alien && !desert) { this.buildAcademy(s, c, fid, townCities); continue; }
      const flags = { hq: c.isHQ && c.hqOf === c.owner, factory: c.factory, bunkerRing: c.bunkerRing, govQuarter: c.govQuarter };
      // Fensterlicht: groessere Staedte haben mehr beleuchtete Fenster / window light: larger cities have more lit windows
      // Hoehle: Nachschublinie statt Stadt, Hauptschacht groesser / cavern: supply line instead of a city, main shaft bigger
      // Alienwelt: neutrale Siedlungen in gedaempfter Zyrr-Bauweise / alien world: neutral settlements in muted Zyrr style
      // Stuetzpunkt (City.base, nur Standardwelt): eigenes Modell je Art, geht dem Sendeturm vor
      // base (City.base, default world only): its own model per kind, takes precedence over the transmitter tower
      const kind: BaseKind | null = !cave && !alien && !desert && !flags.hq ? c.base ?? null : null;
      const tower = !!c.tower && !kind;
      const windows = Math.min(0.85, 0.4 + Math.min(8, level) * 0.06);
      const g = cave ? withGlow(supplyLineGeometry(fid, flags.hq), 'built', 0)
        : kind ? withGlow(baseModelGeometry(kind, fid, level, flags, kind === 'navalStation' ? seaSide(s, c.x, c.y) : 0, this.animations), 'built', windows)
        // Wueste: alle Orte sind Aussenposten der Verdan (Kuppelbunker, Relaismast, Wappen) / desert: every place is a Verdan outpost (domed bunker, relay mast, emblem)
        // Sendeturm je Welt / transmitter tower per world
        : tower ? withGlow(towerGeometry(alien ? 'alien' : desert ? 'desert' : 'earth', fid), 'built', 0.4)
        // Alienwelt: alle Orte sind Hoehlen, in die sich Einheiten eingraben / alien world: every place is a burrow units dig into
        : withGlow(alien ? alienBurrowGeometry(fid, level, flags.hq)
          : desert ? verdanOutpostGeometry(fid, level, flags.hq) : cityGeometry(fid, level, flags),
          'built', windows);
      const meta = kind ? models.baseMeta(g) : undefined;
      const obj = outlined(g, OUTLINE.building, landMaterial());
      obj.position.copy(this.tileCenter(s, c.x, c.y));
      // Siedlungen der anderen Welten etwas groesser, wie die Staedte / settlements of the other worlds a little larger, like the cities
      if (cave || ((alien || desert) && !tower)) obj.scale.setScalar(SETTLEMENT_SCALE);
      // Hoehlen und Aussenposten schauen mit Oeffnung und Wappen zur Standardkamera / burrows and outposts face the default camera with opening and emblem
      if (alien || desert) obj.rotation.y = Math.PI / 4;
      obj.traverse((o) => { o.raycast = () => {}; if (o === obj.userData.mesh) o.castShadow = true; });
      this.staticLayer.add(obj);
      if (cave) glowSpots.push({ x: obj.position.x, y: obj.position.y, z: obj.position.z, size: flags.hq ? 1.7 : 1.35, color: amber });
      else townCities.push({ x: obj.position.x, y: obj.position.y, z: obj.position.z, level, faction: fid, hq: flags.hq, govQuarter: flags.govQuarter, geo: g,
        ...(!alien && !desert && !tower ? { beacon: hqMastTop(level) } : {}),
        // Stuetzpunkt: Rauch nur an den Schloten des Modells; verlassen = dunkel / base: smoke only at the model's stacks; abandoned = dark
        ...(meta ? { smoke: meta.smoke, dark: fid === null, rotors: meta.rotors } : {}) });
      // Tiefenmaske: dieselbe Geometrie, nur Tiefe, nach dem Leeren des Tiefenpuffers und vor den Einheiten
      // depth mask: the same geometry, depth only, after the depth clear and before the units
      if (!low && !cave && !alien && !desert) {
        const mask = new THREE.Mesh(g, maskMaterial());
        mask.renderOrder = UNIT_ORDER - 0.8;
        mask.raycast = () => {};
        this.staticLayer.add(mask);
        this.cityMasks.push({ mesh: mask, base: obj.position.clone() });
      }
      // Trefferkoerper: breiter Sockel der Haeuser und schlankes Wahrzeichen / hit bodies: broad base of the houses and slim landmark
      if (!cave && (tower || (!alien && !desert))) {
        const h = tower ? 0.95 : cityHeight(level, fid === null);
        // [Breite, Hoehe, Versatz x, Versatz z]; Stuetzpunkt: Platz und Wahrzeichen aus dem Modell / [width, height, offset x, offset z]; base: plaza and landmark from the model
        const bodies: [number, number, number, number][] = meta ? meta.hit.map(([hx, hz, w, bh]) => [w, bh, hx, hz])
          : tower ? [[0.26, h, 0, 0]] : [[0.78, Math.min(h, 0.14 + level * 0.03), 0, 0], [0.26, h, 0, 0]];
        for (const [w, bh, hx, hz] of bodies) {
          const proxy = new THREE.Mesh(proxyGeometry(), proxyMaterial());
          proxy.position.copy(obj.position);
          proxy.position.x += hx; proxy.position.z += hz;
          proxy.scale.set(w, bh, w);
          proxy.userData.tile = c.y * size + c.x;
          this.staticLayer.add(proxy);
          this.cityProxies.push(proxy);
        }
      }
      // Stadt-Ausbauten / city upgrades
      for (const [slot, up] of (c.upgrades ?? []).entries()) {
        const perk = outlined(withGlow(perkGeometry(up, fid), 'built'), OUTLINE.building, landMaterial());
        const [px, pz] = SLOT_SPOT[slot % SLOT_SPOT.length];
        perk.position.copy(this.tileCenter(s, c.x, c.y)).add(new THREE.Vector3(px, 0, pz));
        perk.scale.setScalar(PERK_SCALE);
        perk.traverse((o) => { o.raycast = () => {}; if (o === perk.userData.mesh) o.castShadow = true; });
        this.staticLayer.add(perk);
        if (up === 'satRelay') relayLamps.push(perk.position.clone().add(new THREE.Vector3(...RELAY_LAMP).multiplyScalar(PERK_SCALE)));
      }
      // Stadt-Hack (HACK.city): Stoerbild-Marke mit Restrunden ueber der Stadt, Leuchten in der Farbe des Hackers
      // city hack (HACK.city): glitch mark with the rounds left above the city, glow in the hacker's colour
      const hk = cityHackRoundsLeft(s, c);
      if (hk > 0 && c.hacked) {
        const hf = s.factions[c.hacked.by]?.id ?? 'nexus';
        const hb = hackBadge(hk, factionTokens[hf].primary, factionTokens[hf].marker);
        hb.position.copy(this.tileCenter(s, c.x, c.y)).add(new THREE.Vector3(0.18, 1.15, -0.18));
        hb.center.set(0.5, 0);
        this.labelLayer.add(hb);
        glowSpots.push({ x: c.x - off, y: tileTop(s.tiles[c.y * size + c.x]), z: c.y - off, size: 1.7, color: new THREE.Color(hex(factionTokens[hf].marker)) });
      }
      const cname = this.showLabels ? cityNameOf(s, c.id) : '';
      if (cname) {
        const color = fid ? factionTokens[fid].primary : semantic.neutral;
        const ink = fid ? factionTokens[fid].ink : semantic.text;
        // Stufe und Fortschritt zur naechsten Stufe (nur fuer Staedte von Fraktionen) / level and progress to the next level (faction cities only)
        // Nachschublinien wachsen nicht: kein Stufenkreis, kein Fortschritt / supply lines do not grow: no level, no progress
        // Sendetuerme wachsen nicht: ohne Stufe wie Nachschublinien / transmitter towers do not grow: no level, like supply lines
        const need = c.owner !== null && !cave && !tower ? levelUpCost(s, c) : 0;
        // Stuetzpunkt: Symbol und Name der Art auf dem Schild, auch neutral / base: icon and name of the kind on the sign, neutral too
        const label = cityLabel(cname, cave || tower ? '' : c.owner === null ? 0 : c.level, color, ink, c.isHQ && c.hqOf === c.owner, c.pop, need,
          kind ? { icon: BASE_ICON[kind], name: baseName(kind) } : undefined);
        label.center.set(0.5, 1);
        this.labelLayer.add(label);
        this.citySigns.push({ sprite: label, x: c.x, y: c.y, top: obj.position.y });
      }
    }
    this.placeCitySigns();
    this.placeCityMasks();

    // Animiertes Wasser / animated water
    const water = buildWater(s, explored, 5, natural ? (l, w) => beachCoast(l, tileTop(l), tileTop(w)) : undefined);
    if (water) this.staticLayer.add(water);
    // Weiche Uebergaenge und Felsabbrueche / soft transitions and rock cliffs
    const land = buildLandscape({
      size, tiles: s.tiles, explored, top: tileTop,
      topColor: (t) => (t.terrain === 'shallow' || t.terrain === 'ocean' ? null : this.tileColors(t.terrain, this.tintOf(s, t), t.biome, !!t.xeno).top),
      ...(natural ? { natural: {
        seed, segments: low ? NATURAL.segments.low : NATURAL.segments.high,
        rank: (t) => (scarred(t) ? null : growthRank(t)),
        tone: (x, y) => tones[y * size + x],
        meadow: (t) => t.terrain === 'plain' && !t.xeno && !t.resource && !builtOn(t) && !scarred(t),
      } } : {}),
    });
    if (land.strips) {
      const strips = new THREE.Mesh(land.strips, landMaterial());
      strips.receiveShadow = true;
      strips.raycast = () => {};
      strips.userData.dispose = true;
      this.staticLayer.add(strips);
    }
    if (land.cliffs.length) {
      const { mesh, line } = outlinedInstanced(cliffRock(), land.cliffs.length, OUTLINE.tile, landMaterial());
      land.cliffs.forEach((c, i) => { mesh.setMatrixAt(i, c.m); line.setMatrixAt(i, c.m); mesh.setColorAt(i, c.color); });
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.raycast = () => {};
      this.staticLayer.add(mesh, line);
    }
    // Stadtlichter, Lava-Schein, Rauch / city lights, lava glow, smoke
    this.town.build({ cities: townCities, lava: lavaSpots, glow: glowSpots, ...(low ? {} : { rotorMask: { material: maskMaterial(), order: UNIT_ORDER - 0.8 } }) });
    this.placeCityMasks();
    this.orbital.setRelays(relayLamps);
    // Hoehlenhuelle und Getier / cave shell and creatures
    if (cave) { this.caveShell.build(size, seed, low); this.caveLife.build(creatures); } else { this.caveShell.clear(); this.caveLife.clear(); }
    // Heimatwelt der Zyrr: schwebende Felsen und Fremdtiere / Zyrr homeworld: floating rocks and critters
    if (alien) this.alienFx.build({ s, explored, top: tileTop, occupied });
    else if (this.alienFx.active) this.alienFx.clear();
    // Welt der Vergessenen / world of the Forgotten
    if (desert) this.desertFx.build({ s, explored, top: tileTop, occupied, low });
    else if (this.desertFx.active) this.desertFx.clear();
    // Riss: bleibt nach dem Aufreissen stehen; neue Partie ohne Riss raeumt ihn / rift: stays after tearing open; a new game without a rift clears it
    const rf = s.campaign?.rift;
    if (!rf) { if (this.rift.active) this.rift.clear(); }
    else if (this.rift.key !== `${rf.x - off},${rf.y - off}`) this.rift.show(new THREE.Vector3(rf.x - off, tileTop(s.tiles[rf.y * size + rf.x]), rf.y - off), false);
    this.dirty = true;
  }

  /**
   * Frisch aufgedeckte Felder: Wolke loest sich kurz auf (nur bei gleichem Betrachter und Spiel, mit Animationen).
   * Freshly revealed tiles: the cloud dissolves briefly (only for the same viewer and game, with animations).
   */
  private revealFog(s: GameState, viewer: number, explored: (x: number, y: number) => boolean) {
    const size = s.size, off = (size - 1) / 2;
    const fog = new Set<number>();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!explored(x, y)) fog.add(y * size + x);
    const prev = this.prevFog;
    if (prev && this.animations && prev.viewer === viewer && prev.size === size && prev.seed === s.tiles) {
      const list: { x: number; y: number; z: number; rot: number; variant: number }[] = [];
      for (const k of prev.set) {
        if (fog.has(k) || list.length >= 60) continue;
        const x = k % size, y = Math.floor(k / size);
        const v = (x * 7 + y * 13) % 3;
        list.push({ x: x - off, y: CLOUD_Y + ((x + y) % 2) * 0.04, z: y - off, rot: (v * Math.PI) / 2, variant: list.length % 3 });
      }
      this.fogFx.reveal(list, performance.now());
    } else if (!this.animations) this.fogFx.clear();
    this.prevFog = { set: fog, viewer, size, seed: s.tiles };
  }

  /** Einheiten abgleichen / sync units */
  syncUnits(s: GameState, viewer: number) {
    // neue Partie: gemerkte Ausrichtungen gelten nicht mehr / new game: remembered facings no longer apply
    if (this.facingGame !== s.tiles) {
      if (this.facingGame) {
        this.facing.clear(); this.turretAim.clear();
        for (const v of this.units.values()) { const m = v.group.getObjectByName('model'); if (m) { m.rotation.y = 0; aimTurrets(m, undefined); } }
      }
      this.facingGame = s.tiles;
    }
    this.lastState = s;
    const seen = new Set<number>();
    // Detailstufe der Einheitenmodelle folgt der Qualitaet (im Schluessel: Wechsel baut die Modelle neu) / unit model detail follows the quality (in the key: a change rebuilds the models)
    models.setUnitQuality(this.quality);
    for (const u of s.units) {
      if (viewer >= 0 && !canSeeUnit(s, viewer, u)) continue;
      seen.add(u.id);
      // uebernommene Einheit (HACK.tower): Modell, Sockel und Plakette des eigentlichen Besitzers, Ring der hackenden Fraktion
      // taken-over unit (HACK.tower): model, base and badge of the actual owner, ring of the hacking faction
      const f = s.factions[trueOwner(u)].id;
      const cf = s.factions[u.owner].id;
      const stage = u.wonder?.stage ?? 0;
      const key = `${u.type}-${f}-${cf}-${u.carried}-${viewer < 0 || u.owner === viewer}-${stage}-${this.quality}`;
      let v = this.units.get(u.id);
      if (v && v.key !== key) { this.unitLayer.remove(v.group); v = undefined; }
      if (!v) {
        const grp = new THREE.Group();
        // Alle Einheiten mit schwarzer Tuschelinie; eigene erkennt man am Bodenring
        // all units with a black ink line; own units are recognised by their ground ring
        const own = viewer >= 0 && u.owner === viewer;
        const ugeo = unitGeometry(u.type, f, u.carried, stage);
        // Velkar: leuchtende Lichter (Leuchtmaske in der Geometrie) / Velkar: glowing lights (glow mask in the geometry)
        const model = unitModel(ugeo, ugeo.userData.unitGlow ? unitGlowMaterial() : unitMaterial());
        this.techParts.attach(u.id, model, u.type, f, ugeo.userData.finishScale ?? 1, this.quality === 'low');
        // Miniatur-Sockel: dunkle Platte mit Rand in Fraktionsfarbe / miniature base: dark plate with faction-coloured rim
        const base = outlined(baseGeometry(factionTokens[f].primary), OUTLINE.unit, baseMaterial());
        base.name = 'base';
        base.traverse((o) => { o.raycast = () => {}; o.renderOrder = UNIT_ORDER - 0.6; });
        grp.add(base);
        model.scale.setScalar(UNIT_SCALE);
        model.name = 'model';
        // Fusionskraftwerk nie drehen, sonst passt die 2x2-Flaeche nicht / never rotate the fusion plant or its 2x2 footprint breaks
        // Wanne nach der Ausrichtung im Spielstand, sonst gemerkt / hull from the facing in the game state, else remembered
        model.rotation.y = u.type === 'fusionPlant' ? 0 : coreHeading(u) ?? this.facing.get(u.id) ?? 0;
        if (coreHeading(u) !== undefined) this.facing.set(u.id, coreHeading(u)!);
        // Drehtuerme behalten ihr letztes Ziel / turrets keep their last target
        aimTurrets(model, this.turretAim.get(u.id));
        grp.add(model);
        grp.add(this.groundMarker(cf, own));
        // Uebernahme: leuchtender Doppelring in der Farbe der hackenden Fraktion / takeover: glowing double ring in the hacker's colour
        if (u.hijack) grp.add(this.hijackMarker(cf));
        grp.userData.unitId = u.id;
        // Reihenfolge: Bodenring, Schatten, Einheit / order: ground ring, shadow, unit
        grp.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.renderOrder === 0) o.renderOrder = UNIT_ORDER; });
        grp.position.copy(this.unitSpot(s, u.x, u.y).pos);
        v = { id: u.id, group: grp, key, badge: null, badgeKey: '' };
        this.units.set(u.id, v);
        this.unitLayer.add(grp);
      }
      if (!this.isAnimating(u.id)) {
        // Besatzung einer Stadt: vordere Ecke, kleiner / garrison of a city: front corner, smaller
        const spot = this.unitSpot(s, u.x, u.y);
        v.group.position.copy(spot.pos);
        const wo = WONDER_OFFSET[u.type];
        if (wo) { v.group.position.x += wo.x; v.group.position.z += wo.z; }
        // Zyrr unter Wasser: halb eingetaucht / Zyrr under water: half submerged
        if (isWading(s, u)) v.group.position.y -= WADE_SINK;
        v.group.scale.setScalar(spot.scale);
        if (v.badge) fitBadge(v.badge, spot.scale);
      }
      // Kriegsplaene (m4): Koecher am Traeger / war plans (m4): case at the carrier
      const carry = s.campaign?.plans?.at === 'carried' && s.campaign.plans.unit === u.id;
      const pm = v.group.getObjectByName('plans');
      if (carry && !pm) {
        // eigenes Material: wird bei erschoepften Einheiten nicht abgeblendet; schwebt ueber dem Lebensbalken
        // own material: not dimmed on exhausted units; floats above the health badge
        const m = outlined(plansGeometry('carried', this.quality === 'low'), OUTLINE.unit, toonMaterial());
        m.name = 'plans';
        m.position.set(0, u.type === 'heli' || u.type === 'octocopter' ? 1.3 : 1.08, 0);
        m.traverse((o) => { o.raycast = () => {}; });
        v.group.add(m);
      } else if (!carry && pm) v.group.remove(pm);
      const ft = factionTokens[f];
      // keine Aktion mehr moeglich (nur im Zug eines Menschen) / no action left (only during a human turn)
      const done = u.owner === s.current && s.factions[s.current].human &&
        (u.exhausted || u.fresh || u.attacked || (u.moved && attackTargets(s, u).length === 0));
      // Heiliges Alvenia: Suendenzeichen und Segen auf der Plakette / Holy Alvenia: sinner mark and blessing on the badge
      const sin = isSinner(s, u.owner) && judgeAlive(s), blessed = blessingOf(s, u) > 0;
      const hj = u.hijack ? hijackRoundsLeft(s, u) : 0;
      const badgeKey = `${u.type}-${u.hp}-${u.maxHp}-${u.veteran}-${done}-${u.fuel}-${sin}-${blessed}-${hj}`;
      if (v.badgeKey !== badgeKey) {
        if (v.badge) v.group.remove(v.badge);
        // Rollensymbol links auf der Plakette (unitRoles.ts) / role icon on the left of the badge (unitRoles.ts)
        v.badge = hpBadge({ hp: u.hp, maxHp: u.maxHp, color: ft.primary, ink: ft.ink, veteran: u.veteran, done, fuel: u.fuel, maxFuel: FUEL.tank, sin, blessed, icon: unitRoleIcon(u.type),
          ...(hj ? { hijack: { n: hj, color: factionTokens[cf].primary } } : {}) });
        // Endgegner: Balken ueber der Krone / boss: badge above the crown
        v.badge.position.set(0, u.type === 'heli' || u.type === 'octocopter' ? 1.02 : u.type === 'swarmMother' ? 2.15 : 0.8, 0);
        v.badge.userData.size = v.badge.scale.clone();
        fitBadge(v.badge, v.group.scale.x);
        v.group.add(v.badge);
        v.badgeKey = badgeKey;
      }
      // Hubschrauber schwebt / helicopter hovers
      const model = v.group.getObjectByName('model')!;
      model.position.y = (u.type === 'heli' || u.type === 'octocopter' ? 0.1 : 0) + BASE_H;
      const submerged = u.type === 'submarine' && !u.revealed;
      // Radarkontakt unter den Wolken: ueber der Wolkendecke, halb durchsichtig; eigene Getarnte halb durchsichtig
      // radar contact under the clouds: above the cloud deck, half transparent; own camouflaged units half transparent
      const echo = viewer >= 0 && radarEcho(s, viewer, u);
      const hidden = submerged || echo || (camouflaged(u) && (viewer < 0 || u.owner === viewer));
      if (echo && !this.isAnimating(u.id)) v.group.position.y = CLOUD_Y + RADAR_ECHO_LIFT;
      // kein Bodenschatten fuer Radarkontakte und getauchte U-Boote / no contact shadow for radar contacts and submerged submarines
      v.group.userData.noShadow = echo || submerged;
      this.life.track(u, v.group, model, model.position.y, UNIT_SCALE, submerged);
      const opts = hidden ? { transparent: true, opacity: echo ? 0.7 : 0.55 } : done ? { dim: true, transparent: true, opacity: DONE_OPACITY } : {};
      const mat = unitMaterial(opts);
      // leuchtende Teile behalten ihr Leuchtmaterial / glowing parts keep their glow material
      const glowMat = unitGlowMaterial(opts);
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const cur = mesh.isMesh ? (mesh.material as THREE.Material) : null;
        if (!cur?.userData?.unitMat) return;
        const want = cur.userData.unitGlow ? glowMat : mat;
        if (cur !== want) mesh.material = want;
      });
    }
    // Wanne folgt der Ausrichtung im Spielstand (ausser waehrend einer Animation) / hull follows the facing in the game state (except while animating)
    for (const u of s.units) {
      const h = coreHeading(u);
      if (h === undefined || this.isAnimating(u.id)) continue;
      this.facing.set(u.id, h);
      const m = this.units.get(u.id)?.group.getObjectByName('model');
      if (m && Math.abs(angleDelta(m.rotation.y, h)) > 1e-3) m.rotation.y = h;
    }
    // Ausrichtung bleibt auch fuer verdeckte Einheiten erhalten, nur Gefallene werden vergessen
    // facing survives for hidden units too, only fallen units are forgotten
    const alive = new Set(s.units.map((u) => u.id));
    for (const [id, v] of this.units) {
      if (!seen.has(id) && !this.isAnimating(id)) { this.unitLayer.remove(v.group); this.units.delete(id); this.techParts.detach(id); }
    }
    for (const m of [this.facing, this.turretAim]) for (const id of m.keys()) if (!alive.has(id) && !this.isAnimating(id)) m.delete(id);
    // Plaketten-Zwischenspeicher begrenzen: nicht mehr gezeigte Plaketten freigeben (BADGE.cacheMax)
    // bound the badge cache: release badges no longer shown (BADGE.cacheMax)
    const shown = new Set<THREE.Material>();
    for (const v of this.units.values()) if (v.badge) shown.add(v.badge.material);
    pruneBadgeCache(shown);
    this.life.endSync(seen);
    this.updateShadows();
    this.dirty = true;
  }

  private markerCache = new Map<string, THREE.Group>();
  /**
   * Markierung einer uebernommenen Einheit (HACK.tower): zwei schmale Ringe ausserhalb des Bodenrings in der Farbe der
   * hackenden Fraktion, gestrichelt wie ein Datensignal; ohne Licht (MeshBasicMaterial), also in jeder Szene gleich hell.
   * Marker of a taken-over unit (HACK.tower): two slim rings outside the ground ring in the hacker's colour, dashed like a
   * data signal; unlit (MeshBasicMaterial), so equally bright in every scene.
   */
  private hijackMarker(f: FactionId): THREE.Object3D {
    const key = `hijack-${f}`;
    let tpl = this.markerCache.get(key);
    if (!tpl) {
      tpl = new THREE.Group();
      const color = hex(factionTokens[f].primary);
      const mat = new THREE.MeshBasicMaterial({ color, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const glow = new THREE.MeshBasicMaterial({ color: hex(factionTokens[f].marker), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
      const ink = new THREE.MeshBasicMaterial({ color: hex(semantic.ink), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const r = MARKER.own.outer;
      tpl.add(new THREE.Mesh(new THREE.RingGeometry(r + 0.01, r + 0.075, MARKER.segments).rotateX(-Math.PI / 2), ink));
      // gestrichelter Aussenring: 12 Bogenstuecke / dashed outer ring: 12 arc pieces
      for (let i = 0; i < 12; i++) {
        tpl.add(new THREE.Mesh(new THREE.RingGeometry(r + 0.015, r + 0.07, 4, 1, (i * Math.PI) / 6, Math.PI / 9).rotateX(-Math.PI / 2), glow));
      }
      tpl.add(new THREE.Mesh(new THREE.RingGeometry(r + 0.09, r + 0.12, MARKER.segments).rotateX(-Math.PI / 2), mat));
      tpl.position.y = MARKER.lift + 0.004;
      tpl.traverse((o) => { o.raycast = () => {}; o.renderOrder = UNIT_ORDER - 0.65; });
      this.markerCache.set(key, tpl);
    }
    const m = tpl.clone();
    m.name = 'hijack';
    return m;
  }

  private groundMarker(f: FactionId, own: boolean): THREE.Object3D {
    const key = `${f}-${own}`;
    let tpl = this.markerCache.get(key);
    if (!tpl) {
      tpl = new THREE.Group();
      const flat = (inner: number, outer: number, color: string) => new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, MARKER.segments).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: hex(color), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      if (own) {
        // schlanker Ring direkt am Sockel: weiss / Markierungsfarbe / Tusche; keine Flaeche, der Boden bleibt sichtbar
        // slim ring right at the base: white / marker colour / ink; no fill, the ground stays visible
        const r = MARKER.own;
        tpl.add(flat(r.inner, r.white, semantic.white), flat(r.white, r.band, factionTokens[f].marker), flat(r.band, r.outer, semantic.ink));
        tpl.userData.pulse = true;
      } else {
        const r = MARKER.foreign;
        tpl.add(flat(r.inner, r.band, factionTokens[f].primary), flat(r.band, r.outer, semantic.ink));
      }
      tpl.position.y = MARKER.lift;
      tpl.traverse((o) => { o.raycast = () => {}; o.renderOrder = UNIT_ORDER - 0.7; });
      this.markerCache.set(key, tpl);
    }
    const m = tpl.clone();
    m.name = 'marker';
    return m;
  }

  /** Bodenschatten folgen den Einheiten und schrumpfen mit sterbenden / contact shadows follow the units and shrink with dying ones */
  updateShadows() {
    this.contact.beginUnits(this.units.size);
    let i = 0;
    for (const v of this.units.values()) {
      const g = v.group;
      if (!g.visible || g.userData.noShadow || g.scale.x <= 0.3) continue;
      this.contact.unit(i++, g.position, Math.min(1, g.scale.x));
    }
    this.contact.endUnits(i);
  }

  /** Eigene Ringe pulsieren leicht / own rings pulse gently */
  pulseMarkers(time: number) {
    this.updateShadows();
    for (const o of this.highlightLayer.children) {
      if (o.userData.bob !== undefined) {
        o.position.y = o.userData.bob + Math.sin(time * 4) * 0.035;
        const k = 0.36 * (1 + Math.sin(time * 4) * 0.06);
        o.scale.set(k, k, 1);
      }
    }
    const k = 1 + Math.sin(time * MARKER.pulseSpeed) * MARKER.pulse;
    for (const v of this.units.values()) {
      const m = v.group.getObjectByName('marker');
      if (m && m.userData.pulse) m.scale.set(k, 1, k);
    }
  }

  unitObject(id: number): THREE.Group | undefined {
    return this.units.get(id)?.group;
  }

  private animating = new Set<number>();
  private isAnimating(id: number) { return this.animating.has(id); }

  private addAnim(dur: number, update: (t: number) => void): Promise<void> {
    if (!this.animations) { update(1); this.dirty = true; return Promise.resolve(); }
    return new Promise((resolve) => this.anims.push({ update, start: performance.now(), dur, resolve }));
  }

  animateMove(s: GameState, unitId: number, from: { x: number; y: number }, path: { x: number; y: number }[]): Promise<void> {
    const v = this.units.get(unitId);
    if (!v || !path.length) return Promise.resolve();
    // Standplaetze statt Feldmitten: in Staedten vorn und kleiner / spots instead of tile centres: in cities at the front and smaller
    const spots = [this.unitSpot(s, from.x, from.y), ...path.map((p) => this.unitSpot(s, p.x, p.y))];
    const pts = spots.map((p) => p.pos);
    this.animating.add(unitId);
    const dur = Math.min(ANIM.maxTotal, ANIM.move * Math.max(1, path.length) * 0.6);
    const last = pts[pts.length - 1];
    const model = v.group.getObjectByName('model');
    // sanft in Laufrichtung drehen, Ergebnis merken / turn smoothly into the walking direction, remember the result
    const h0 = model ? model.rotation.y : this.facing.get(unitId) ?? 0;
    const walk = pathFacing(pts, h0);
    // Ziel ist die Ausrichtung im Spielstand; weicht sie von der Laufrichtung ab (Rueckzug: Front zum Feind), ohne Drehen zuruecksetzen
    // the goal is the facing in the game state; if it differs from the walking direction (retreat: front to the enemy), back off without turning
    const want = coreHeading(s.units.find((x) => x.id === unitId));
    const backing = want !== undefined && Math.abs(angleDelta(walk(pts.length - 1), want)) > 0.3;
    const face = backing ? (f: number) => lerpAngle(h0, want, Math.min(1, f / Math.max(1, pts.length - 1))) : walk;
    this.facing.set(unitId, want ?? face(pts.length - 1));
    // Drehtuerme schwenken beim Fahren zurueck nach vorn / turrets swing back to the front while driving
    this.turretAim.delete(unitId);
    const turns = turretsIn(model).map((tu) => ({ tu, turn: turretTurn(tu, undefined) }));
    this.life.startMove(s, unitId, [from, ...path]);
    return this.addAnim(dur, (t) => {
      const f = t * (pts.length - 1);
      const i = Math.max(0, Math.min(pts.length - 2, Math.floor(f)));
      const local = f - i;
      v.group.position.lerpVectors(pts[i], pts[i + 1], local);
      const sc = spots[i].scale + (spots[i + 1].scale - spots[i].scale) * local;
      if (sc !== v.group.scale.x) { v.group.scale.setScalar(sc); if (v.badge) fitBadge(v.badge, sc); }
      // Gangart je Einheitenart statt eines festen Hopsers / gait per unit kind instead of a fixed hop
      this.life.moveFrame(unitId, t, f);
      if (model) model.rotation.y = t >= 1 && want !== undefined ? want : face(f);
      for (const { tu, turn } of turns) tu.rotation.y = turn.at(Math.min(1, t / 0.45));
      if (t >= 1) { v.group.position.copy(last); this.animating.delete(unitId); }
    });
  }

  private fxHost: FxHost = {
    unitObject: (id) => this.units.get(id)?.group,
    anim: (dur, update) => this.addAnim(dur, update),
    hold: (id, on) => { if (on) this.animating.add(id); else this.animating.delete(id); },
    facing: (id) => this.facing.get(id) ?? 0,
    setFacing: (id, a) => { this.facing.set(id, a); },
    setTurretAim: (id, rel) => { if (rel === undefined) this.turretAim.delete(id); else this.turretAim.set(id, rel); },
  };

  /** Hat die Einheit Drehtuerme? (auch ohne sichtbares Modell) / does the unit have turrets? (also without a visible model) */
  private hasTurret(s: GameState, u: Unit): boolean {
    const model = this.units.get(u.id)?.group.getObjectByName('model');
    if (model) return turretsIn(model).length > 0;
    return models.turretsOf(unitGeometry(u.type, s.factions[u.owner].id, u.carried)).length > 0;
  }

  /**
   * Ohne Animation (schnelle KI, Animationen aus, verdeckte Einheit): Ausrichtung zum Ziel sofort setzen.
   * Einheiten mit Turm drehen nur den Turm, alle anderen die ganze Einheit.
   * Without animation (fast AI, animations off, hidden unit): set the facing towards the target at once.
   * Units with a turret only turn the turret, all others the whole unit.
   */
  faceTarget(s: GameState, unitId: number, target: { x: number; y: number }) {
    const u = s.units.find((x) => x.id === unitId);
    if (!u || u.type === 'fusionPlant' || (u.x === target.x && u.y === target.y)) return;
    const a = this.tileCenter(s, u.x, u.y), b = this.tileCenter(s, target.x, target.y);
    const heading = headingOf(b.x - a.x, b.z - a.z);
    const model = this.units.get(unitId)?.group.getObjectByName('model');
    // Wanne: Ausrichtung im Spielstand (8 Richtungen) / hull: facing in the game state (8 directions)
    const core = coreHeading(u);
    if (this.hasTurret(s, u)) {
      const hull = core ?? (model ? model.rotation.y : this.facing.get(unitId) ?? 0);
      if (core !== undefined) { this.facing.set(unitId, core); if (model) model.rotation.y = core; }
      const rel = angleDelta(hull, heading);
      this.turretAim.set(unitId, rel);
      aimTurrets(model, rel);
    } else {
      this.facing.set(unitId, core ?? heading);
      if (model) model.rotation.y = core ?? heading;
    }
    this.dirty = true;
  }

  /**
   * Ohne Animation gefahren: Wanne in die letzte Fahrtrichtung, Tuerme nach vorn.
   * Moved without animation: hull towards the last driving direction, turrets to the front.
   */
  faceMove(s: GameState, unitId: number, from: { x: number; y: number }, path: { x: number; y: number }[]) {
    if (!path.length) return;
    const pts = [this.tileCenter(s, from.x, from.y), ...path.map((p) => this.tileCenter(s, p.x, p.y))];
    const heading = coreHeading(s.units.find((x) => x.id === unitId)) ?? pathFacing(pts, this.facing.get(unitId) ?? 0)(pts.length - 1);
    this.facing.set(unitId, heading);
    this.turretAim.delete(unitId);
    const model = this.units.get(unitId)?.group.getObjectByName('model');
    if (model && s.units.find((x) => x.id === unitId)?.type !== 'fusionPlant') { model.rotation.y = heading; aimTurrets(model, undefined); }
    this.dirty = true;
  }

  /**
   * Angriff mit Waffeneffekten (siehe combat.ts); ohne Angaben nur Ausrichten und Ausfall.
   * Attack with weapon effects (see combat.ts); without details only turning and a lunge.
   */
  animateAttack(attackerId: number, targetId: number, info?: AttackInfo): Promise<void> {
    if (!this.animations) {
      info?.onFire?.(); info?.onImpact?.();
      if (info?.retaliate) { info.onReturnFire?.(); info.onReturnImpact?.(); }
      return Promise.resolve();
    }
    return playAttack(this.fxHost, this.combat, attackerId, targetId, info);
  }

  /**
   * Kampf mit einem Verdan-Geschuetz ueber die normalen Kampfeffekte: Das Geschuetz ist ein unsichtbarer Stellvertreter
   * auf seinem Feld (schwere Kanone). gunFires = Geschuetz schiesst auf die Einheit, sonst greift die Einheit an.
   * Fight with a Verdan gun through the normal combat effects: the gun is an invisible stand-in on its tile
   * (heavy cannon). gunFires = the gun shoots at the unit, otherwise the unit attacks.
   */
  animateTurret(s: GameState, gun: { x: number; y: number }, unitId: number, gunFires: boolean,
    o: { unitType: Unit['type']; unitFaction: FactionId; retaliate: boolean; onImpact?: () => void; onReturnFire?: () => void; onReturnImpact?: () => void; gunFaction?: FactionId; unitHull?: number }): Promise<void> {
    const GUN = -1;
    const proxy = new THREE.Group();
    proxy.position.copy(this.tileCenter(s, gun.x, gun.y)).add(new THREE.Vector3(0, 0.12, 0));
    const host: FxHost = {
      ...this.fxHost,
      unitObject: (id) => (id === GUN ? proxy : this.fxHost.unitObject(id)),
      hold: (id, on) => { if (id !== GUN) this.fxHost.hold(id, on); },
      facing: (id) => (id === GUN ? 0 : this.fxHost.facing(id)),
      setFacing: (id, a) => { if (id !== GUN) this.fxHost.setFacing(id, a); },
      setTurretAim: (id, rel) => { if (id !== GUN) this.fxHost.setTurretAim?.(id, rel); },
    };
    const water = (x: number, y: number) => { const tt = s.tiles[y * s.size + x].terrain; return tt === 'shallow' || tt === 'ocean'; };
    const u = s.units.find((x) => x.id === unitId);
    const uw = u ? water(u.x, u.y) : false;
    // Geschuetzstellung: Muendungsfeuer in der Optik ihrer Fraktion / gun emplacement: muzzle flash in its faction's look
    const gf: FactionId = o.gunFaction ?? 'nexus';
    const info: AttackInfo = gunFires
      ? { attacker: 'tank', target: o.unitType, attackerFaction: gf, targetFaction: o.unitFaction, attackerWater: false, targetWater: uw, retaliate: false, onImpact: o.onImpact }
      : { attacker: o.unitType, target: 'tank', attackerFaction: o.unitFaction, targetFaction: gf, attackerWater: uw, targetWater: false, retaliate: o.retaliate, attackerHull: o.unitHull,
        onImpact: o.onImpact, onReturnFire: o.onReturnFire, onReturnImpact: o.onReturnImpact };
    if (!this.animations) {
      info.onImpact?.();
      if (info.retaliate) { info.onReturnFire?.(); info.onReturnImpact?.(); }
      return Promise.resolve();
    }
    return gunFires ? playAttack(host, this.combat, GUN, unitId, info) : playAttack(host, this.combat, unitId, GUN, info);
  }

  /**
   * Sterbeanimation im Comic-Stil (hoechstens 400 ms): Fusstruppen fliegen hoch, drehen sich und kippen um,
   * dazu Blutstropfen; Fahrzeuge explodieren mit Feuerball; Schiffe sinken.
   * Comic death animation (at most 400 ms): foot units fly up, spin and topple with blood droplets;
   * vehicles explode with a fireball; ships sink.
   */
  animateDeath(unitId: number, kind: 'wreck' | 'skeleton' | null = null): Promise<void> {
    const v = this.units.get(unitId);
    if (!v) return Promise.resolve();
    this.animating.add(unitId);
    this.life.untrack(unitId);
    const start = v.group.position.clone();
    // Besatzungen sterben in ihrer verkleinerten Groesse / garrisons die at their reduced size
    const size0 = v.group.scale.x;
    const model = v.group.getObjectByName('model');
    if (v.badge) v.badge.visible = false;
    const fx = new THREE.Group();
    fx.position.copy(start);
    this.unitLayer.add(fx);
    const drops: { o: THREE.Object3D; vel: THREE.Vector3 }[] = [];
    let fire: THREE.Object3D | null = null;
    if (kind === 'skeleton') {
      for (let i = 0; i < 9; i++) {
        const o = outlined(dropletGeometry(i % 3 ? semantic.splatter : semantic.splatterDark), 0.008);
        const a = (i / 9) * Math.PI * 2 + unitId;
        o.position.set(0, 0.22, 0);
        o.scale.setScalar(0.7 + (i % 3) * 0.35);
        fx.add(o);
        drops.push({ o, vel: new THREE.Vector3(Math.cos(a) * (0.6 + (i % 4) * 0.2), 1.6 + (i % 3) * 0.5, Math.sin(a) * (0.6 + (i % 4) * 0.2)) });
      }
    } else if (kind === 'wreck') {
      fire = outlined(fireballGeometry(), 0.012);
      fire.position.set(0, 0.2, 0);
      fx.add(fire);
      for (let i = 0; i < 6; i++) {
        const o = outlined(dropletGeometry(i % 2 ? semantic.char : semantic.fire), 0.008);
        const a = (i / 6) * Math.PI * 2;
        o.position.set(0, 0.2, 0);
        fx.add(o);
        drops.push({ o, vel: new THREE.Vector3(Math.cos(a) * 1.1, 1.8, Math.sin(a) * 1.1) });
      }
    }
    fx.traverse((o) => { o.renderOrder = UNIT_ORDER; });
    return this.addAnim(ANIM.death, (t) => {
      if (kind === 'skeleton' && model) {
        // hochschleudern, drehen, umkippen / launch, spin, topple
        v.group.position.copy(start);
        v.group.position.y += Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.35;
        model.rotation.z = Math.min(1, t * 1.5) * (Math.PI / 2);
        model.rotation.y = t * Math.PI * 2;
        v.group.scale.setScalar(size0 * (t > 0.75 ? Math.max(0.001, 1 - (t - 0.75) * 4) : 1));
      } else if (kind === 'wreck') {
        v.group.position.copy(start);
        v.group.position.y += Math.sin(Math.min(1, t * 2) * Math.PI) * 0.18;
        if (model) model.rotation.z = t * 0.4;
        v.group.scale.setScalar(size0 * (t > 0.5 ? Math.max(0.001, 1 - (t - 0.5) * 2) : 1));
        if (fire) fire.scale.setScalar(t < 0.4 ? 0.3 + t * 3 : Math.max(0.001, 1.5 - (t - 0.4) * 2.5));
      } else {
        v.group.position.copy(start);
        v.group.position.y -= t * 0.3;
        v.group.rotation.z = t * 0.5;
        v.group.scale.setScalar(size0 * Math.max(0.001, 1 - t * 0.8));
      }
      const dt = t * (ANIM.death / 1000);
      for (const d of drops) {
        d.o.position.set(d.vel.x * dt, 0.22 + d.vel.y * dt - 4.5 * dt * dt, d.vel.z * dt);
        if (d.o.position.y < 0.02) { d.o.position.y = 0.02; d.o.scale.set(1.6, 0.25, 1.6); }
      }
      if (t >= 1) {
        this.unitLayer.remove(v.group); this.unitLayer.remove(fx);
        this.units.delete(unitId); this.animating.delete(unitId); this.facing.delete(unitId); this.techParts.detach(unitId);
      }
    });
  }

  private highlightLooks = new Map<HighlightKind, { geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial }>();

  /** Pfeil der Ausrichtung je Markierungsart / facing arrow per highlight kind */
  private facingLooks = new Map<HighlightKind, { geos: THREE.BufferGeometry[]; mat: THREE.MeshBasicMaterial }>();

  /**
   * Markierungen; facing = Ausrichtung der Einheit auf dem Feld (0-7): kleiner Pfeil aussen am Ring.
   * Highlights; facing = facing of the unit on the tile (0-7): a small arrow outside the ring.
   */
  setHighlights(s: GameState | null, list: { x: number; y: number; kind: HighlightKind; facing?: number }[]) {
    this.clearGroup(this.highlightLayer);
    this.lastHighlights = s ? list : [];
    if (!s || !list.length) { this.dirty = true; return; }
    // Auswahl, Ziel und Hinweis gelten der Einheit: an einer Besatzung sitzt der Ring an ihrem Standplatz, in ihrer Groesse
    // select, target and hint are about the unit: at a garrison the ring sits at its spot, at its size
    const spotOf = (h: { x: number; y: number; kind: HighlightKind }) =>
      (h.kind === 'select' || h.kind === 'target' || h.kind === 'attack' || h.kind === 'hint') && this.garrisonAt(s, h.x, h.y) ? this.unitSpot(s, h.x, h.y) : { pos: this.tileCenter(s, h.x, h.y), scale: 1 };
    const colors: Record<HighlightKind, string> = {
      move: semantic.highlightMove, attack: semantic.highlightAttack, safe: semantic.highlightSafe, unsafe: semantic.highlightUnsafe,
      select: semantic.highlightSelect, target: semantic.highlightAttack, hint: semantic.highlightSelect, build: semantic.highlightSafe, reach: factionTokens.nexus.marker,
    };
    const byKind = new Map<HighlightKind, THREE.Matrix4[]>();
    for (const h of list) {
      const spot = spotOf(h), p = spot.pos;
      p.y = Math.max(p.y, TILE_TOP.shallow) + 0.02;
      const m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
      if (spot.scale !== 1) m.scale(new THREE.Vector3(spot.scale, 1, spot.scale));
      if (!byKind.has(h.kind)) byKind.set(h.kind, []);
      byKind.get(h.kind)!.push(m);
    }
    for (const [kind, mats] of byKind) {
      // Ring und Material je Art einmal bauen (sonst GPU-Leck bei jeder Auswahl) / ring and material built once per kind (otherwise a GPU leak on every selection)
      let look = this.highlightLooks.get(kind);
      if (!look) {
        const big = kind === 'select' || kind === 'target' || kind === 'hint';
        const ring = new THREE.RingGeometry(big ? 0.36 : 0.22, big ? 0.46 : 0.32, 20, 1).rotateX(-Math.PI / 2);
        look = {
          geo: paint(ring.toNonIndexed(), colors[kind]),
          mat: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: kind === 'move' || kind === 'safe' || kind === 'unsafe' || kind === 'build' ? 0.85 : kind === 'reach' ? 0.6 : 1, depthWrite: false, side: THREE.DoubleSide }),
        };
        ring.dispose();
        this.highlightLooks.set(kind, look);
      }
      const mesh = new THREE.InstancedMesh(look.geo, look.mat, mats.length);
      mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.renderOrder = 5;
      mesh.raycast = () => {};
      this.highlightLayer.add(mesh);
    }
    // Ausrichtung: Pfeil aussen am Ring, in der Farbe des Rings, mit dunklem Rand / facing: arrow outside the ring, in the ring's colour, with a dark rim
    for (const h of list) {
      const d = h.facing !== undefined ? FACING_DIRS[h.facing] : undefined;
      if (!d) continue;
      let look = this.facingLooks.get(h.kind);
      if (!look) {
        const tri = (w: number, z0: number, z1: number, color: string) => paint(new THREE.BufferGeometry().setAttribute('position',
          new THREE.Float32BufferAttribute([-w, 0, z0, 0, 0, z1, w, 0, z0], 3)), color);
        const geos = [tri(0.105, 0.455, 0.625, semantic.ink), tri(0.07, 0.48, 0.59, colors[h.kind]).translate(0, 0.002, 0)];
        look = { geos, mat: new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false, side: THREE.DoubleSide }) };
        this.facingLooks.set(h.kind, look);
      }
      const spot = spotOf(h), p = spot.pos;
      p.y = Math.max(p.y, TILE_TOP.shallow) + 0.022;
      const arrow = new THREE.Group();
      arrow.scale.setScalar(spot.scale);
      look.geos.forEach((g, i) => { const m = new THREE.Mesh(g, look!.mat); m.renderOrder = 6 + i; m.raycast = () => {}; arrow.add(m); });
      arrow.position.copy(p);
      arrow.rotation.y = headingOf(d.x, d.y);
      arrow.name = 'facing';
      this.highlightLayer.add(arrow);
    }
    // Fadenkreuz ueber Feinden in Reichweite / crosshair above enemies in range
    for (const h of list) {
      if (h.kind !== 'attack' && h.kind !== 'target') continue;
      const icon = attackIcon(h.kind === 'target');
      const spot = spotOf(h);
      icon.position.copy(spot.pos).add(new THREE.Vector3(0, spot.scale === 1 ? 0.98 : 0.84, 0));
      icon.userData.bob = icon.position.y;
      this.highlightLayer.add(icon);
    }
    this.dirty = true;
  }

  /** Feld unter dem Strahl / tile under the ray */
  pick(ray: THREE.Raycaster): { x: number; y: number } | null {
    const unitHits = ray.intersectObjects(this.unitLayer.children, true);
    if (unitHits.length) {
      let o: THREE.Object3D | null = unitHits[0].object;
      while (o && o.userData.unitId === undefined) o = o.parent;
      if (o) {
        const local = this.group.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
        const off = (this.size - 1) / 2;
        return { x: Math.round(local.x + off), y: Math.round(local.z + off) };
      }
    }
    const hits = ray.intersectObjects([...this.pickMeshes.map((p) => p.mesh), ...this.cityProxies], false);
    if (!hits.length) return null;
    const h = hits[0];
    // hohe Stadt oder Sendeturm getroffen: ihr Feld / hit a tall city or transmitter tower: its tile
    const ct = h.object.userData.tile as number | undefined;
    if (ct !== undefined) return { x: ct % this.size, y: Math.floor(ct / this.size) };
    const entry = this.pickMeshes.find((p) => p.mesh === h.object);
    if (!entry || h.instanceId === undefined) return null;
    const k = entry.tiles[h.instanceId];
    return { x: k % this.size, y: Math.floor(k / this.size) };
  }

  /** Animationen fortschreiben; true, wenn neu gezeichnet werden muss / advance animations; true if redraw needed */
  tick(now: number): boolean {
    const fx = this.combat.update();
    let lived = this.life.update(now, this.animations);
    // Schwebende Akademie: sanftes Auf und Ab / floating academy: gentle bob
    if (this.animations) {
      const t = now / 1000;
      for (const [id, a] of this.academyObjs) {
        // Radarantenne dreht, Terraform-Strahl flackert, Bodenring kreist / radar array spins, terraform beam flickers, ground ring circles
        if (a.radar) a.radar.rotation.y = t * 1.1 + id;
        if (a.beam) (a.beam.material as THREE.MeshBasicMaterial).opacity = 0.38 + 0.1 * Math.sin(t * 9 + id) + 0.04 * Math.sin(t * 23);
        if (a.ring) { a.ring.rotation.z = t * 0.8; const k = 1 + 0.06 * Math.sin(t * 3.2); a.ring.scale.set(k, k, 1); }
        if (a.radar || a.beam) lived = true;
        if (!a.hover || a.animating) continue;
        a.obj.position.y = a.baseY + Math.sin((t * Math.PI * 2) / ACADEMY_MODEL.bobPeriod + id) * ACADEMY_MODEL.bob;
        this.followBeacon(id, a);
        lived = true;
      }
    }
    if (this.techParts.update(now, this.animations)) lived = true;
    // Artefakt: langsame Drehung und leichtes Schweben / artifact: slow spin and gentle bob
    if (this.artifactOrbit && this.animations) {
      const t = now / 1000;
      this.artifactOrbit.rotation.y = t * 0.35;
      this.artifactOrbit.position.y = (this.artifactOrbit.userData.baseY ??= this.artifactOrbit.position.y) + Math.sin(t * 1.3) * 0.03;
      lived = true;
    }
    if (!this.anims.length) { const d = this.dirty || fx || lived; this.dirty = false; return d; }
    for (const a of [...this.anims]) {
      // rAF-Zeit kann vor dem Start liegen: auf 0..1 begrenzen / rAF time can precede the start: clamp to 0..1
      const t = Math.max(0, Math.min(1, (now - a.start) / a.dur));
      try { a.update(t); } catch (e) { console.error(e); this.anims.splice(this.anims.indexOf(a), 1); a.resolve(); continue; }
      if (t >= 1) { this.anims.splice(this.anims.indexOf(a), 1); a.resolve(); }
    }
    // Bodenschatten folgen der Bewegung im selben Bild / contact shadows follow the move within the same frame
    this.updateShadows();
    this.dirty = false;
    return true;
  }

  get busy() { return this.anims.length > 0 || this.combat.active; }

  /**
   * Akademie oder Forschungsposten aufbauen: Modell (am Boden, abhebend, schwebend), Bodenschatten und Schutzschild mit
   * LP-Anzeige (Deckkraft und Farbe), Lichter, Trefferkoerper und Schild mit Namen.
   * Build an academy or research post: model (grounded, lifting, floating), ground shadow and shield showing its HP
   * (opacity and colour), lights, hit bodies and the name sign.
   */
  private buildAcademy(s: GameState, c: City, fid: FactionId, townCities: TownInput['cities']) {
    const air = !!c.academy && !!c.air;
    const pose = c.academy ? academyPose(c.air) : 'ground';
    const low = this.quality === 'low';
    // Ausbau-Module sichtbar am Modell (ACADEMY.modules) / upgrade modules visible on the model (ACADEMY.modules)
    const g = withGlow(c.post ? researchPostGeometry(fid, !!c.relay) : academyGeometry(fid, c.level, pose, low, c.mods ?? {}), 'built', 0.6);
    const group = new THREE.Group();
    group.position.copy(this.tileCenter(s, c.x, c.y));
    const obj = outlined(g, OUTLINE.building, landMaterial());
    obj.traverse((o) => { o.raycast = () => {}; if (o === obj.userData.mesh) o.castShadow = true; });
    // etwas groesser als ein Feldmodell: die Hauptstadt ist das wichtigste Objekt der Karte / a little larger than a tile model: the capital is the most important object on the map
    if (c.academy) obj.scale.setScalar(ACADEMY_MODEL.scale);
    const baseY = poseY(pose);
    obj.position.y = baseY;
    group.add(obj);
    // drehende Radarantenne auf dem Laborturm (eigenes Teil, mit Tuschelinie) / rotating radar array on the lab tower (own part, with ink line)
    let radar: THREE.Object3D | null = null;
    if (c.academy) {
      radar = outlined(withGlow(academyRadarGeometry(), 'built', 0.6), OUTLINE.building * 0.8, landMaterial());
      radar.position.set(...academyRadarAt(c.level, pose));
      radar.traverse((o) => { o.raycast = () => {}; });
      obj.add(radar);
    }
    // Terraformen: Strahl vom Projektor zum Zielfeld und flimmernder Ring am Boden / terraforming: beam from the projector to the target tile and a shimmering ring on the ground
    let beam: THREE.Mesh | null = null, ring: THREE.Mesh | null = null;
    if (c.academy && c.air?.phase === 'terraform') {
      const at = c.air.at ?? { x: c.x, y: c.y };
      const fx = this.terraformFx(s, group.position, at, baseY);
      beam = fx.beam; ring = fx.ring;
      group.add(beam, ring);
    }
    if (air) {
      // Bodenschatten: kleiner und blasser, je hoeher sie schwebt / ground shadow: smaller and paler the higher it floats
      const k = 1 - baseY * 0.6;
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(ACADEMY_MODEL.radius * k, 24), academyMat('shadow', () => new THREE.MeshBasicMaterial({ color: hoverShadowColor(), transparent: true, opacity: 0.32, depthWrite: false })));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.012;
      shadow.raycast = () => {};
      shadow.userData.dispose = true;
      group.add(shadow);
    }
    const sh = c.academy && c.shield && c.shield.hp > 0 ? c.shield : null;
    if (sh) {
      // Schild: Kuppel ueber der Plattform, Deckkraft nach LP, schwach in Warnfarbe / shield: dome over the platform, opacity by HP, weak in the warning colour
      // LP in fuenf Stufen (Deckkraft), unter 35 % in Warnfarbe / HP in five steps (opacity), below 35 % in the warning colour
      const step = Math.max(1, Math.ceil((sh.hp / Math.max(1, sh.max)) * 5));
      const weak = sh.hp / Math.max(1, sh.max) < 0.35;
      const color = () => (weak ? new THREE.Color(hex(semantic.warning)) : shieldColor());
      const bubble = new THREE.Mesh(shieldGeometry(), academyMat(`bubble${step}${weak}`, () => new THREE.MeshBasicMaterial({ color: color(), transparent: true, opacity: 0.04 + 0.025 * step, depthWrite: false, side: THREE.DoubleSide })));
      const edges = new THREE.LineSegments(shieldEdges(), academyMat(`edges${step}${weak}`, () => new THREE.LineBasicMaterial({ color: color(), transparent: true, opacity: 0.15 + 0.1 * step, depthWrite: false })));
      for (const m of [bubble, edges]) { m.position.y = air ? 0.05 : ACADEMY_MODEL.legs + 0.05; m.scale.set(1, 0.8, 1); m.raycast = () => {}; obj.add(m); }
    }
    this.staticLayer.add(group);
    // Terraformen: ruhig verankert, kein Auf und Ab / terraforming: steadily anchored, no bob
    if (c.academy) this.academyObjs.set(c.id, { group, obj, hover: air && pose !== 'terraform', baseY, animating: false, base: group.position.clone(), radar, beam, ring });
    // Lichtschein am Boden, Leuchtfeuer an der Antenne, kein Schornsteinrauch / light pool on the ground, beacon on the antenna, no chimney smoke
    townCities.push({ x: group.position.x, y: group.position.y, z: group.position.z, level: c.post ? 1 : c.level, faction: fid, hq: !!c.academy, govQuarter: false, geo: g, smoke: [],
      ...(c.academy ? { beacon: academyBeacon(c.level, baseY, pose), beaconKey: c.id } : {}) });
    // Trefferkoerper ueber dem ganzen Modell / hit body over the whole model
    const h = c.post ? 0.5 : baseY + 0.75;
    const proxy = new THREE.Mesh(proxyGeometry(), proxyMaterial());
    proxy.position.copy(group.position);
    proxy.scale.set(0.8, h, 0.8);
    proxy.userData.tile = c.y * s.size + c.x;
    this.staticLayer.add(proxy);
    this.cityProxies.push(proxy);
    const cname = this.showLabels ? cityNameOf(s, c.id) : '';
    if (cname) {
      const color = factionTokens[fid].primary, ink = factionTokens[fid].ink;
      const label = cityLabel(cname, c.post ? '' : c.level, color, ink, !!c.academy, c.post ? 0 : c.pop, c.post ? 0 : levelUpCost(s, c));
      label.center.set(0.5, 1);
      this.labelLayer.add(label);
      this.citySigns.push({ sprite: label, x: c.x, y: c.y, top: group.position.y + (air ? baseY : 0) });
    }
  }

  /**
   * Uebergang der Akademie: Abheben, Schweben, Ziehen, Landen, Notlandung (das Brett baut danach neu).
   * Academy transition: lift-off, floating, moving, landing, emergency landing (the board rebuilds afterwards).
   */
  animateAcademy(s: GameState, c: City, what: string, from: { x: number; y: number } | null, animate: boolean): Promise<void> {
    const a = this.academyObjs.get(c.id);
    if (!a || !animate || what === 'transfer') return Promise.resolve();
    a.animating = true;
    const y0 = a.obj.position.y;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const id = c.id;
    if (what === 'move' && from) {
      const p0 = this.tileCenter(s, from.x, from.y), p1 = this.tileCenter(s, c.x, c.y);
      return this.addAnim(ANIM.move * 2, (t) => { a.group.position.lerpVectors(p0, p1, ease(t)); this.followBeacon(id, a); });
    }
    if (what === 'terraform') {
      // absinken auf Arbeitshoehe, Strahl waechst zum Zielfeld / sink to working height, the beam grows towards the target tile
      const at = { x: c.air?.at?.x ?? c.x, y: c.air?.at?.y ?? c.y };
      const fx = this.terraformFx(s, a.group.position, at, ACADEMY_MODEL.terraformY);
      a.group.add(fx.beam, fx.ring);
      return this.addAnim(ANIM.move * 3, (t) => {
        const k = ease(t);
        a.obj.position.y = y0 + (ACADEMY_MODEL.terraformY - y0) * k;
        fx.beam.scale.set(k, k, k);
        fx.ring.scale.set(k, k, 1);
        this.followBeacon(id, a);
      });
    }
    const y1 = what === 'lift' ? ACADEMY_MODEL.liftY : what === 'float' || what === 'cancel' || what === 'abort' ? ACADEMY_MODEL.airY : 0;
    const p0 = a.group.position.clone(), p1 = this.tileCenter(s, c.x, c.y);
    if (what === 'land') {
      // Landung nach dem Terraformen: Strahl erlischt, Lichtwelle formt das Feld um, sanftes Aufsetzen
      // landing after terraforming: the beam fades, a wave of light reshapes the tile, gentle touch-down
      const wave = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), academyMat('wave', () => new THREE.MeshBasicMaterial({ color: terraformColor(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
      wave.rotation.x = -Math.PI / 2;
      wave.position.copy(p1).sub(a.group.position).setY(0.03);
      wave.userData.dispose = true;
      a.group.add(wave);
      const beam = a.beam, ring = a.ring;
      return this.addAnim(ANIM.move * 3.5, (t) => {
        const k = ease(t);
        a.obj.position.y = y0 + (y1 - y0) * k;
        a.group.position.lerpVectors(p0, p1, k);
        wave.position.copy(p1).sub(a.group.position).setY(0.03);
        const w = Math.min(1, t * 1.6);
        wave.scale.setScalar(0.3 + 0.9 * w);
        (wave.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
        if (beam) beam.scale.setScalar(Math.max(0.001, 1 - k));
        if (ring) ring.scale.set(1 + k, 1 + k, 1);
        this.followBeacon(id, a);
      });
    }
    return this.addAnim(what === 'forced' ? ANIM.death * 1.5 : ANIM.move * 2.5, (t) => {
      const k = what === 'forced' ? t * t : ease(t);
      a.obj.position.y = y0 + (y1 - y0) * k;
      if (what === 'forced') a.group.position.lerpVectors(p0, p1, k);
      if ((what === 'cancel' || what === 'abort') && a.beam) a.beam.scale.setScalar(Math.max(0.001, 1 - k));
      this.followBeacon(id, a);
    });
  }

  /** Leuchtfeuer der Akademie folgt Auf und Ab und Uebergang / the academy's beacon follows the bob and the transition */
  private followBeacon(id: number, a: { group: THREE.Group; obj: THREE.Object3D; baseY: number; base: THREE.Vector3 }) {
    this.town.shiftBeacon(id, a.group.position.x - a.base.x, a.obj.position.y - a.baseY, a.group.position.z - a.base.z);
  }

  /**
   * Terraform-Effekt (Gruppe der Akademie als Bezug): Lichtkegel vom Projektor unter dem Rumpf (Hoehe hover) zum Zielfeld
   * at und ein flimmernder Ring auf dessen Boden. Additiv, ohne Tiefenschreiben, Farbe aus dem Token.
   * Terraform effect (relative to the academy's group): light cone from the projector below the hull (height hover) to
   * the target tile at and a shimmering ring on its ground. Additive, no depth write, colour from the token.
   */
  private terraformFx(s: GameState, origin: THREE.Vector3, at: { x: number; y: number }, hover: number): { beam: THREE.Mesh; ring: THREE.Mesh } {
    const k = ACADEMY_MODEL.scale;
    const top = new THREE.Vector3(0, hover - (ACADEMY_MODEL.hull + 0.04) * k, 0);
    const ground = this.tileCenter(s, at.x, at.y).sub(origin).setY(0.03);
    const dir = top.clone().sub(ground);
    const len = Math.max(0.05, dir.length());
    const geo = new THREE.CylinderGeometry(0.06, 0.42, len, 20, 1, true);
    geo.translate(0, len / 2, 0);
    const beam = new THREE.Mesh(geo, academyMat('beam', () => new THREE.MeshBasicMaterial({ color: terraformColor(), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })));
    beam.position.copy(ground);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    beam.userData.dispose = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.47, 6, 1), academyMat('ring', () => new THREE.MeshBasicMaterial({ color: terraformColor(), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(ground);
    ring.userData.dispose = true;
    for (const m of [beam, ring]) { m.raycast = () => {}; m.renderOrder = 5; }
    return { beam, ring };
  }

  /** Zielvorschau des Orbitallasers (leere Liste = aus) / orbital laser target preview (empty list = off) */
  showOrbitalPreview(s: GameState, tiles: { x: number; y: number }[], cols: number, tags: { x: number; y: number; text: string; own: boolean }[], blocked: boolean) {
    if (!tiles.length) this.orbital.clearPreview();
    else {
      const t: OrbitalTag[] = tags.map((g) => ({ pos: this.tileCenter(s, g.x, g.y), text: g.text, own: g.own }));
      this.orbital.showPreview(tiles.map((p) => this.tileCenter(s, p.x, p.y)), cols, t, blocked);
    }
    this.dirty = true;
  }

  /**
   * Strahl auf die Flaeche; onImpact beim Einschlag. Ohne Animationen: stiller Einschlag ohne Strahl, kurz sichtbar.
   * Beam onto the area; onImpact at the moment of impact. Without animations: still impact without the beam, briefly visible.
   */
  animateOrbital(s: GameState, tiles: { x: number; y: number }[], cols: number, faction: FactionId | null, animate: boolean, onImpact: () => void): Promise<void> {
    this.orbital.clearPreview();
    const c = tiles.reduce((a: THREE.Vector3, p) => a.add(this.tileCenter(s, p.x, p.y)), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, tiles.length));
    const r = 0.5 * cols + 0.15;
    if (!animate || !this.animations) {
      this.orbital.still(c, r, faction);
      onImpact();
      this.orbital.endLater(1100, () => { this.dirty = true; });
      this.dirty = true;
      return Promise.resolve();
    }
    this.orbital.begin(c, r, faction);
    let hit = false;
    return this.addAnim(ORBITAL_FX.ms, (t) => {
      this.orbital.frame(t);
      if (!hit && t >= ORBITAL_FX.impact) { hit = true; onImpact(); }
      if (t >= 1) this.orbital.end();
    });
  }

  /**
   * Raketenstart: Bogen vom Silo zur Flaeche, onImpact beim Einschlag. Ohne Animationen: stiller Einschlag.
   * Rocket launch: arc from the silo to the area, onImpact at the moment of impact. Without animations: still impact.
   */
  animateSilo(s: GameState, from: { x: number; y: number }, tiles: { x: number; y: number }[], faction: FactionId | null, animate: boolean, onImpact: () => void): Promise<void> {
    this.orbital.clearPreview();
    const c = tiles.reduce((a: THREE.Vector3, p) => a.add(this.tileCenter(s, p.x, p.y)), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, tiles.length));
    const r = 1.15;
    if (!animate || !this.animations) {
      this.rocket.still(c, r, faction);
      onImpact();
      this.rocket.endLater(1100, () => { this.dirty = true; });
      this.dirty = true;
      return Promise.resolve();
    }
    const start = this.tileCenter(s, from.x, from.y);
    start.y += 0.3;
    this.rocket.begin(start, c, r, faction);
    let hit = false;
    return this.addAnim(ROCKET_FX.ms, (t) => {
      this.rocket.frame(t);
      if (!hit && t >= ROCKET_FX.impact) { hit = true; onImpact(); }
      if (t >= 1) this.rocket.end();
    });
  }

  /**
   * Goettlicher Funke: Lichtbogen von der Linse des Geschuetzes zur 2x2-Flaeche, onImpact beim Einschlag. Ohne Animationen:
   * stiller Einschlag.
   * Divine Spark: arc of light from the gun's lens to the 2x2 area, onImpact at the moment of impact. Without animations:
   * still impact.
   */
  animateSpark(s: GameState, from: { x: number; y: number }, tiles: { x: number; y: number }[], faction: FactionId | null, animate: boolean, onImpact: () => void): Promise<void> {
    this.orbital.clearPreview();
    const c = tiles.reduce((a: THREE.Vector3, p) => a.add(this.tileCenter(s, p.x, p.y)), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, tiles.length));
    const size = Math.sqrt(Math.max(1, tiles.length));
    if (!animate || !this.animations) {
      this.spark.still(c, size, faction);
      onImpact();
      this.spark.endLater(1100, () => { this.dirty = true; });
      this.dirty = true;
      return Promise.resolve();
    }
    const start = this.tileCenter(s, from.x, from.y);
    start.y += 0.55;
    this.spark.begin(start, c, size, faction);
    let hit = false;
    return this.addAnim(SPARK_FX.ms, (t) => {
      this.spark.frame(t);
      if (!hit && t >= SPARK_FX.impact) { hit = true; onImpact(); }
      if (t >= 1) this.spark.end();
    });
  }

  /**
   * Fernuebernahme (NEXUS): Datensaeule und drei aufsteigende Signalringe in der Markierungsfarbe ueber dem Ort.
   * Remote takeover (NEXUS): a data column and three rising signal rings in the marker colour above the place.
   */
  animateHack(s: GameState, c: { x: number; y: number }, faction: FactionId | null): Promise<void> {
    const color = hex(factionTokens[faction ?? 'nexus'].marker);
    const grp = new THREE.Group();
    grp.position.copy(this.tileCenter(s, c.x, c.y));
    const mats: THREE.MeshBasicMaterial[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const mk = (g: THREE.BufferGeometry) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
      mats.push(m); geos.push(g);
      const o = new THREE.Mesh(g, m); o.raycast = () => {}; grp.add(o); return o;
    };
    const column = mk(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 10, 1, true));
    column.position.y = 0.8;
    const rings = [0, 1, 2].map(() => mk(new THREE.RingGeometry(0.32, 0.4, 32).rotateX(-Math.PI / 2)));
    this.unitLayer.add(grp);
    return this.addAnim(760, (t) => {
      column.scale.set(1, Math.min(1, t * 2.5), 1);
      mats[0].opacity = 0.85 * (1 - t);
      rings.forEach((r, i) => {
        const k = Math.max(0, Math.min(1, t * 1.6 - i * 0.25));
        r.position.y = 0.1 + k * 1.1;
        r.scale.setScalar(0.6 + k * 0.9);
        mats[i + 1].opacity = 0.9 * (1 - k);
      });
      if (t >= 1) { this.unitLayer.remove(grp); for (const m of mats) m.dispose(); for (const g of geos) g.dispose(); }
      this.dirty = true;
    });
  }

  /**
   * Uebernahme (Hackturm): Signalstrahl vom Sendekopf des Turms zur Einheit, dann ein Ring um die Einheit.
   * Takeover (hack tower): signal beam from the tower's emitter head to the unit, then a ring around the unit.
   */
  animateHijack(s: GameState, tower: { x: number; y: number }, u: { x: number; y: number }, faction: FactionId | null): Promise<void> {
    const color = hex(factionTokens[faction ?? 'nexus'].marker);
    const a = this.tileCenter(s, tower.x, tower.y).add(new THREE.Vector3(0, 1.05, 0));
    const b = this.tileCenter(s, u.x, u.y).add(new THREE.Vector3(0, 0.35, 0));
    const len = a.distanceTo(b);
    const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const beamGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6, 1, true);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.raycast = () => {};
    beam.position.copy(a).add(b).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ringGeo = new THREE.RingGeometry(0.4, 0.5, 32).rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.raycast = () => {};
    ring.position.copy(this.tileCenter(s, u.x, u.y)).add(new THREE.Vector3(0, 0.05, 0));
    this.unitLayer.add(beam, ring);
    return this.addAnim(640, (t) => {
      // Strahl waechst vom Turm zur Einheit, flackert, verblasst / the beam grows from the tower to the unit, flickers, fades
      const grow = Math.min(1, t * 2.2);
      beam.scale.set(1, len * grow, 1);
      beam.position.copy(a).lerp(b, grow * 0.5);
      beamMat.opacity = (t < 0.7 ? 0.9 : 0.9 * (1 - (t - 0.7) / 0.3)) * (0.75 + 0.25 * Math.sin(t * 40));
      const k = Math.max(0, (t - 0.4) / 0.6);
      ring.scale.setScalar(1.3 - 0.4 * k);
      ringMat.opacity = k < 0.8 ? k : (1 - k) * 4;
      if (t >= 1) { this.unitLayer.remove(beam, ring); beamMat.dispose(); beamGeo.dispose(); ringMat.dispose(); ringGeo.dispose(); }
      this.dirty = true;
    });
  }

  /**
   * Neutronenstrahl (ACADEMY.beam): Ladekugel an der Linse der Tesla-Spule, Strahl mit hellem Kern und weichem Mantel zum
   * Ziel, Einschlag mit Blitzring; folgt dem Auf und Ab der schwebenden Akademie. onImpact beim Einschlag (Zahlen, Beben).
   * Ohne Animation sofort onImpact. Farben aus den Tokens (Tech-Leuchten der Velkar, Lichtbogen).
   * Neutron beam (ACADEMY.beam): charge sphere at the lens of the tesla spire, beam with a bright core and a soft sheath to
   * the target, impact with a flash ring; follows the bob of the floating academy. onImpact at the impact (numbers, shake).
   * Without animation onImpact at once. Colours from the tokens (Velkar tech glow, arc).
   */
  animateNeutron(s: GameState, c: City, target: { x: number; y: number }, animate: boolean, onImpact: () => void): Promise<void> {
    const a = this.academyObjs.get(c.id);
    if (!animate || !this.animations) { onImpact(); return Promise.resolve(); }
    const pose = academyPose(c.air);
    const origin = () => {
      const base = a ? a.group.position.clone() : this.tileCenter(s, c.x, c.y);
      const hover = a ? a.obj.position.y : poseY(pose);
      const [ex, ey, ez] = academyEmitter(c.level, hover, pose);
      return base.add(new THREE.Vector3(ex, ey, ez));
    };
    const b = this.tileCenter(s, target.x, target.y).add(new THREE.Vector3(0, 0.3, 0));
    const glow = new THREE.Color(hex(semantic.velkarTechGlow)), arc = new THREE.Color(hex(semantic.velkarTechArc));
    const coreMat = new THREE.MeshBasicMaterial({ color: arc, transparent: true, opacity: 0, depthWrite: false });
    const sheathMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0, depthWrite: false });
    const flashMat = new THREE.MeshBasicMaterial({ color: arc, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const coreGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true);
    const sheathGeo = new THREE.CylinderGeometry(0.095, 0.095, 1, 10, 1, true);
    const ballGeo = new THREE.SphereGeometry(0.09, 12, 8);
    const ringGeo = new THREE.RingGeometry(0.18, 0.3, 32).rotateX(-Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, coreMat), sheath = new THREE.Mesh(sheathGeo, sheathMat);
    const ball = new THREE.Mesh(ballGeo, sheathMat), hitBall = new THREE.Mesh(ballGeo, flashMat), ring = new THREE.Mesh(ringGeo, flashMat);
    ring.position.copy(this.tileCenter(s, target.x, target.y)).add(new THREE.Vector3(0, 0.05, 0));
    hitBall.position.copy(b);
    const parts = [core, sheath, ball, hitBall, ring];
    for (const m of parts) { m.raycast = () => {}; m.visible = false; }
    this.unitLayer.add(...parts);
    let hit = false;
    const up = new THREE.Vector3(0, 1, 0);
    return this.addAnim(NEUTRON_FX.ms, (t) => {
      const o = origin();
      // Laden: Kugel waechst an der Linse / charge: the sphere grows at the lens
      const charge = Math.min(1, t / NEUTRON_FX.charge);
      ball.visible = t < NEUTRON_FX.fade;
      ball.position.copy(o);
      ball.scale.setScalar(0.3 + 0.9 * charge * (t > NEUTRON_FX.charge ? 0.7 + 0.3 * Math.sin(t * 60) : 1));
      sheathMat.opacity = 0.45 + 0.4 * charge;
      // Strahl: schiesst zum Ziel, flackert, verblasst / beam: shoots to the target, flickers, fades
      const k = t < NEUTRON_FX.charge ? 0 : Math.min(1, (t - NEUTRON_FX.charge) / (NEUTRON_FX.impact - NEUTRON_FX.charge));
      const tip = o.clone().lerp(b, k);
      const len = Math.max(1e-3, o.distanceTo(tip));
      for (const m of [core, sheath]) {
        m.visible = k > 0 && t < 1;
        m.position.copy(o).add(tip).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(up, tip.clone().sub(o).normalize());
        m.scale.set(1, len, 1);
      }
      const fade = t < NEUTRON_FX.fade ? 1 : Math.max(0, 1 - (t - NEUTRON_FX.fade) / (1 - NEUTRON_FX.fade));
      coreMat.opacity = 0.95 * fade * (0.8 + 0.2 * Math.sin(t * 90));
      sheath.scale.x = sheath.scale.z = 1 + 0.25 * Math.sin(t * 50);
      if (k >= 1 && !hit) { hit = true; onImpact(); }
      // Einschlag: Blitzkugel und Ring breiten sich aus / impact: flash ball and ring spread out
      const h = t < NEUTRON_FX.impact ? 0 : (t - NEUTRON_FX.impact) / (1 - NEUTRON_FX.impact);
      hitBall.visible = ring.visible = h > 0 && t < 1;
      hitBall.scale.setScalar(0.6 + 1.6 * h);
      ring.scale.setScalar(0.6 + 1.8 * h);
      flashMat.opacity = 0.9 * (1 - h);
      if (t >= 1) {
        if (!hit) onImpact();
        this.unitLayer.remove(...parts);
        for (const m of [coreMat, sheathMat, flashMat]) m.dispose();
        for (const g of [coreGeo, sheathGeo, ballGeo, ringGeo]) g.dispose();
      }
      this.dirty = true;
    });
  }

  finishAnimations() {
    this.combat.clear();
    this.orbital.end();
    this.rocket.end();
    this.spark.end();
    for (const a of [...this.anims]) { try { a.update(1); } catch { /* weiter / continue */ } a.resolve(); }
    this.anims = [];
    this.dirty = true;
  }
}

export type { Unit };

/** Ablauf des Neutronenstrahls (Anteile der Dauer ms) / timing of the neutron beam (shares of the duration ms) */
export const NEUTRON_FX = { ms: 820, charge: 0.3, impact: 0.45, fade: 0.7 };

/** Materialien der Akademie (Schatten, Schild je LP-Stufe), einmal je Art / academy materials (shadow, shield per HP step), once per kind */
const ACADEMY_MATS = new Map<string, THREE.Material>();
function academyMat(key: string, make: () => THREE.Material): THREE.Material {
  let m = ACADEMY_MATS.get(key);
  if (!m) { m = make(); ACADEMY_MATS.set(key, m); }
  return m;
}
/** Kanten des Schilds (Wabenlinien), einmal berechnet / shield edges (honeycomb lines), computed once */
let SHIELD_EDGES: THREE.BufferGeometry | null = null;
const shieldEdges = () => (SHIELD_EDGES ??= new THREE.EdgesGeometry(shieldGeometry(), 1));
