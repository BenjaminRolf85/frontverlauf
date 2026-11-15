/**
 * Die Spielkarte als 3D-Diorama. Liest den Zustand, veraendert ihn nie.
 * The game map as a 3D diorama. Reads the state, never changes it.
 */
import * as THREE from 'three';
import type { BiomeId, FactionId, TerrainId } from '../data/balance';
import type { Tile } from '../core';
import { FUEL } from '../data/balance';
import { attackTargets, levelUpCost, burning, canSeeMine, canSeeUnit, submerged as isWading, cityById, isExplored, weather, isCavern, dist, type GameState, type Unit } from '../core';
import { factionTokens, hex, semantic } from '../design/tokens';
import { cityNameOf } from '../i18n/cityNames';
import { ANIM, CLOUD_Y, OUTLINE, SLAB_DEPTH, TILE_BOTTOM, TILE_TOP } from './config';
import { attackIcon, cityLabel, hpBadge } from './labels';
import * as models from './models';
import { WeatherFx } from './weather';
import { PERK_SCALE, SLOT_SPOT, perkGeometry } from './cityPerks';
import { AmbientFx, swayMaterial, swayOutline } from './ambient';
import { UnitLife } from './life';
import { BIOME_LIFT, PEAK_LIFT, PEAK_SCALE, biomeDecoration, biomeTop, riverSegment, roadJunction, roadSegment, trackGeometry } from './biomes';
import { CombatFx, pathFacing, playAttack, type AttackInfo, type FxHost } from './combat';
import { barrierGeometry, craterGeometry, dropletGeometry, fireballGeometry, scorchGeometry, skeletonGeometry, splatGeometry, wreckGeometry } from './remains';
import { artifactGeometry, ARTIFACT_ORBIT_Y } from './models/artifact';
import { ATMO, cloudMaterial, cloudOutline, decalMaterial, landMaterial, withGlow, type GlowKind } from './atmosphere';
import { WATER_BOX_TOP, buildWater } from './water';
import { buildLandscape, cliffRock } from './landscape';
import { TownFx, type TownInput } from './lights';
import { FogFx } from './fog';
import { CaveShell } from './cave';
import { CaveLife, type CreatureSpot } from './life';
import { setWaterTheme } from './water';
import { AlienWorldFx, alienCloud, alienPlantGeometry, alienTint, crystalSpireGeometry } from './alienWorld';

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
/** Versatz je Bauwerk; das Fusionskraftwerk-Modell deckt seine 2x2-Flaeche selbst ab / offset per wonder; the fusion plant model covers its 2x2 footprint itself */
const WONDER_OFFSET: Partial<Record<string, { x: number; z: number }>> = {};
const cityGeometry = (f: Parameters<typeof models.cityGeometry>[0], l: number, fl: Parameters<typeof models.cityGeometry>[2]) =>
  safe(models.cityGeometry, f ? factionTokens[f].primary : semantic.neutral, f, l, fl)!;
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
/** Deckkraft erschoepfter Einheiten / opacity of exhausted units */
const DONE_OPACITY = 0.5;
/** Eintauchtiefe watender Einheiten / sink depth of wading units */
const WADE_SINK = 0.14;
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

export type HighlightKind = 'move' | 'attack' | 'safe' | 'unsafe' | 'select' | 'target' | 'hint' | 'build';

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

export class Board {
  readonly group = new THREE.Group();
  private staticLayer = new THREE.Group();
  /** schwebender Teil des Artefakts (Kampagnenfinale) / floating part of the artifact (campaign finale) */
  private artifactOrbit: THREE.Object3D | null = null;
  private unitLayer = new THREE.Group();
  private highlightLayer = new THREE.Group();
  private labelLayer = new THREE.Group();
  readonly weatherFx = new WeatherFx();
  readonly ambient = new AmbientFx();
  /** Kampfeffekte (Muendungsfeuer, Geschosse, Einschlaege) / combat effects (muzzle flashes, projectiles, impacts) */
  readonly combat = new CombatFx();
  /** gemerkte Blickrichtung (rotation.y des Modells) je Einheit / remembered facing (model rotation.y) per unit */
  private facing = new Map<number, number>();
  /** Leerlauf, Gangarten, Rauch und Flammen der Einheiten / unit idle, gaits, smoke and flames */
  readonly life = new UnitLife();
  /** Stadtlichter, Lava-Schein, Leuchtfeuer, Schornsteinrauch / city lights, lava glow, beacons, chimney smoke */
  readonly town = new TownFx();
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
  theme: 'cavern' | 'alien' | null = null;
  /** Heimatwelt der Zyrr: schwebende Felsen und Fremdtiere / Zyrr homeworld: floating rocks and critters */
  readonly alienFx = new AlienWorldFx();
  private prevFog: { set: Set<number>; viewer: number; size: number; seed: unknown } | null = null;
  private units = new Map<number, UnitView>();
  private pickMeshes: { mesh: THREE.InstancedMesh; tiles: number[] }[] = [];
  private anims: Anim[] = [];
  private tileGeoCache = new Map<string, THREE.BufferGeometry>();
  size = 0;
  animations = true;
  showLabels = true;
  dirty = true;

  constructor() {
    this.group.add(this.staticLayer, this.highlightLayer, this.unitLayer, this.labelLayer, this.weatherFx.group, this.ambient.group, this.combat.group, this.town.group, this.fogFx.group, this.alienFx.group);
    // Tiefenpuffer vor den Einheiten leeren: Gebaeude, Baeume und Berge verdecken keine Einheiten mehr
    // clear the depth buffer before units: buildings, trees and mountains no longer hide units
    const clearer = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    clearer.frustumCulled = false;
    clearer.renderOrder = UNIT_ORDER - 1;
    clearer.onBeforeRender = (renderer) => renderer.clearDepth();
    clearer.raycast = () => {};
    this.unitLayer.add(clearer);
    this.group.add(this.life.group, this.caveShell.group, this.caveLife.group);
    this.life.busy = (id) => this.animating.has(id);
  }

  /** Mittelpunkt eines Feldes in Brett-Koordinaten / centre of a tile in board coordinates */
  tileCenter(s: GameState | null, x: number, y: number): THREE.Vector3 {
    const off = (this.size - 1) / 2;
    const top = s ? tileTop(s.tiles[y * s.size + x]) : 0;
    return new THREE.Vector3(x - off, top, y - off);
  }

  private snowy = false;
  /** Heimatwelt der Zyrr (Thema 'alien') / Zyrr homeworld (theme 'alien') */
  private alien = false;
  /** Faerbung der Heimat einer Fraktion / home tint of a faction */
  private tintOf(s: GameState, t: Tile): string | null {
    const homeFaction = t.home !== null && s.factions[t.home] ? s.factions[t.home].id : null;
    return homeFaction && !t.xeno ? factionTokens[homeFaction].terrain : null;
  }
  /** Ober- und Seitenfarbe eines Feldes / top and side colour of a tile */
  private tileColors(terrain: TerrainId, tint: string | null, biome?: BiomeId, xeno = false): { top: string; side: string } {
    if (this.theme === 'cavern') return this.caveColors(terrain, tint, biome, xeno);
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

  private tileGeo(terrain: TerrainId | 'fog', tint: string | null, biome?: BiomeId, peak = 2, xeno = false, crater = -1): THREE.BufferGeometry {
    const key = `${terrain}-${tint}-${biome}-${peak}-${this.snowy}-${xeno}-${this.theme}-${crater}`;
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
      const c = this.theme === 'cavern' ? this.caveColors(terrain, tint, biome, xeno, crater) : this.tileColors(terrain, tint, biome, xeno);
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
      setWaterTheme(cave);
    }
    this.alien = theme === 'alien';
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
    const seed = s.config.seed;
    this.clearGroup(this.staticLayer);
    this.artifactOrbit = null;
    this.clearGroup(this.labelLayer);
    this.pickMeshes = [];
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
    const groups = new Map<THREE.BufferGeometry, { tiles: number[]; mats: THREE.Matrix4[] }>();
    const add = (geo: THREE.BufferGeometry | null, m: THREE.Matrix4, tile: number) => {
      if (!geo) return;
      let gr = groups.get(geo);
      if (!gr) { gr = { tiles: [], mats: [] }; groups.set(geo, gr); }
      gr.tiles.push(tile); gr.mats.push(m);
    };
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
        add(this.tileGeo(t.terrain, homeFaction && !t.xeno ? factionTokens[homeFaction].terrain : null, t.biome, t.peak ?? 2, !!t.xeno, ring), pos, k);
        const top = tileTop(t);
        const ps = t.terrain === 'mountain' ? PEAK_SCALE[t.peak ?? 2] : 1;
        const at = (dy = 0) => new THREE.Matrix4().compose(
          new THREE.Vector3(x - off, top + dy, y - off),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x * 3 + y * 5) % 4) * (Math.PI / 2)),
          new THREE.Vector3(Math.min(1.15, 0.85 + ps * 0.15), ps, Math.min(1.15, 0.85 + ps * 0.15)));
        const variant = (x * 7 + y * 13) % 3;
        const hasStructure = t.cityId !== null || t.building || t.grandProject || t.outpost || t.feature || t.turret || t.turretRuin;
        // Auf Feldern mit Einheit keine Baeume, Graeser oder Felsen, damit die Einheit frei steht
        // no trees, grass or rocks on tiles with a unit so the unit stands out
        const occ = occupied.has(k);
        // Pflanzen wiegen sich / plants sway
        const plant = t.terrain === 'forest' || t.resource === 'farmland' || (t.terrain === 'plain' && !t.resource);
        const jungle = t.terrain === 'forest' && t.biome === 'jungle';
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
        } else if (jungle && !t.resource) {
          // dichter Dschungel, auch neben Einheiten sichtbar am Rand / dense jungle, kept at the edge next to units
          if (!hasStructure || t.building === 'road') addDeco(jungleDecoration((x * 5 + y * 11) % 4), occ ? new THREE.Matrix4().compose(new THREE.Vector3(x - off - 0.28, top, y - off - 0.28), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.8, 0.45)) : at(), true);
        } else if (!occ && (!hasStructure || t.building === 'road') && !(alien && t.resource === 'fish')) addDeco(decorationGeometry(t.terrain, t.resource, variant), at(), plant);
        // brennende Lava nach einem Ausbruch / burning lava after an eruption
        if (burning(s, t)) {
          addDeco(lavaGeometry((x + y * 3) % 3), new THREE.Matrix4().makeTranslation(x - off, top + 0.005, y - off), false, 'lava');
          lavaSpots.push({ x: x - off, y: top, z: y - off, size: 1.9 });
        }
        if (!cave && !jungle && !t.xeno && !occ && !hasStructure && !t.resource && !t.road && !t.remains && !t.barrier) addDeco(biomeDecoration(t.terrain, t.biome, (x * 7 + y * 13 + x * y) % 8), at(), true);
        // Fische (die Brandung zeichnet der Wasser-Shader) / fish (the surf is drawn by the water shader)
        if ((t.terrain === 'shallow' || t.terrain === 'ocean') && t.resource === 'fish' && !t.building && !alien) fishTiles.push({ x: x - off, z: y - off, y: top });
        // Krater und Brandflecken / craters and scorch marks
        for (const [i, mk] of (t.marks ?? []).entries()) {
          const geo = mk.k === 'crater' ? craterGeometry((x + y + i) % 3) : scorchGeometry((x * 3 + y + i) % 3);
          if (!decals.has(geo)) decals.set(geo, []);
          decals.get(geo)!.push(new THREE.Matrix4().compose(new THREE.Vector3(x - off + mk.ox, top, y - off + mk.oz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), mk.a), new THREE.Vector3(1, 1, 1)));
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
        else if (!occ && t.resource && !t.building && t.cityId === null && !(cave && t.terrain === 'mountain') && (!alien || t.resource === 'ore')) addDeco(decorationGeometry(cave && t.terrain === 'forest' ? 'plain' : t.terrain, t.resource, variant), at());
        // Verdan-Geschuetz, zum Artefakt gedreht; Truemmer nach der Zerstoerung / Verdan gun facing the artifact; rubble after destruction
        if (t.turret && t.turret.hp > 0) {
          const face = art ? Math.atan2(art.x - x, art.y - y) : 0;
          addDeco(verdanTurretGeometry(t.turret.active), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), face), new THREE.Vector3(1.2, 1.25, 1.2)), false, 'built');
          if (t.turret.active) glowSpots.push({ x: x - off, y: top, z: y - off, size: 1.6, color: eye });
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
        else if (t.feature) addDeco(featureGeometry(t.feature), new THREE.Matrix4().makeTranslation(x - off, top, y - off), false, 'built');
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
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.staticLayer.add(mesh, line);
      this.pickMeshes.push({ mesh, tiles: gr.tiles });
    }
    for (const [geo, mats] of decoGroups) {
      const { mesh, line } = outlinedInstanced(geo, mats.length, OUTLINE.building, landMaterial());
      mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.raycast = () => {};
      // Gebaeude, Berge und Baeume werfen Schatten (nur bei hoher Qualitaet aktiv) / buildings, mountains and trees cast shadows (high quality only)
      mesh.castShadow = true;
      this.staticLayer.add(mesh, line);
    }
    for (const [geo, mats] of swayGroups) {
      const { mesh, line } = outlinedInstanced(geo, mats.length, OUTLINE.building, swayMaterial(), swayOutline(OUTLINE.building));
      mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.raycast = () => {};
      mesh.castShadow = true;
      // Hoehle, niedrige Qualitaet: Pilze und Bodendeko ohne Tuschelinie (halbiert die Dreiecke) / cavern, low quality: mushrooms and floor decoration without ink line (halves the triangles)
      if (cave && low && geo.name.startsWith('cave|')) { line.dispose(); this.staticLayer.add(mesh); } else this.staticLayer.add(mesh, line);
    }
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
      const g = alien ? alienTint(riverSegment(), 'river', semantic.alienWaterShallow, 0.85) : riverSegment();
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
      const geos = [0, 1, 2].map((v) => (cave ? caveCloudGeometry(v) : alien ? alienCloud(cloudGeometry(v), v) : cloudGeometry(v)));
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
    for (const c of s.cities) {
      if (!explored(c.x, c.y)) continue;
      const fid = c.owner !== null ? s.factions[c.owner].id : null;
      const level = c.owner === null ? 1 : c.level;
      const flags = { hq: c.isHQ && c.hqOf === c.owner, factory: c.factory, bunkerRing: c.bunkerRing, govQuarter: c.govQuarter };
      // Fensterlicht: groessere Staedte haben mehr beleuchtete Fenster / window light: larger cities have more lit windows
      // Hoehle: Nachschublinie statt Stadt, Hauptschacht groesser / cavern: supply line instead of a city, main shaft bigger
      // Alienwelt: neutrale Siedlungen in gedaempfter Zyrr-Bauweise / alien world: neutral settlements in muted Zyrr style
      const g = cave ? withGlow(supplyLineGeometry(fid, flags.hq), 'built', 0)
        : withGlow(alien && fid === null ? alienTint(cityGeometry('zyrr', level, flags), `village${level}`, semantic.alienRock, 0.45) : cityGeometry(fid, level, flags),
          'built', Math.min(0.85, 0.4 + Math.min(8, level) * 0.06));
      const obj = outlined(g, OUTLINE.building, landMaterial());
      obj.position.copy(this.tileCenter(s, c.x, c.y));
      if (cave) obj.scale.setScalar(1.15);
      obj.traverse((o) => { o.raycast = () => {}; if (o === obj.userData.mesh) o.castShadow = true; });
      this.staticLayer.add(obj);
      if (cave) glowSpots.push({ x: obj.position.x, y: obj.position.y, z: obj.position.z, size: flags.hq ? 1.7 : 1.35, color: amber });
      else townCities.push({ x: obj.position.x, y: obj.position.y, z: obj.position.z, level, faction: fid, hq: flags.hq, govQuarter: flags.govQuarter, geo: g });
      // Stadt-Ausbauten / city upgrades
      for (const [slot, up] of (c.upgrades ?? []).entries()) {
        const perk = outlined(withGlow(perkGeometry(up, fid), 'built'), OUTLINE.building, landMaterial());
        const [px, pz] = SLOT_SPOT[slot % SLOT_SPOT.length];
        perk.position.copy(this.tileCenter(s, c.x, c.y)).add(new THREE.Vector3(px, 0, pz));
        perk.scale.setScalar(PERK_SCALE);
        perk.traverse((o) => { o.raycast = () => {}; if (o === perk.userData.mesh) o.castShadow = true; });
        this.staticLayer.add(perk);
      }
      const cname = this.showLabels ? cityNameOf(s, c.id) : '';
      if (cname) {
        const color = fid ? factionTokens[fid].primary : semantic.neutral;
        const ink = fid ? factionTokens[fid].ink : semantic.text;
        // Stufe und Fortschritt zur naechsten Stufe (nur fuer Staedte von Fraktionen) / level and progress to the next level (faction cities only)
        // Nachschublinien wachsen nicht: kein Stufenkreis, kein Fortschritt / supply lines do not grow: no level, no progress
        const need = c.owner !== null && !cave ? levelUpCost(s, c) : 0;
        const label = cityLabel(cname, cave ? '' : c.owner === null ? 0 : c.level, color, ink, c.isHQ && c.hqOf === c.owner, c.pop, need);
        label.position.copy(this.tileCenter(s, c.x, c.y)).add(new THREE.Vector3(0, -0.05, 0.42));
        label.center.set(0.5, 1);
        this.labelLayer.add(label);
      }
    }

    // Animiertes Wasser / animated water
    const water = buildWater(s, explored);
    if (water) this.staticLayer.add(water);
    // Weiche Uebergaenge und Felsabbrueche / soft transitions and rock cliffs
    const land = buildLandscape({
      size, tiles: s.tiles, explored, top: tileTop,
      topColor: (t) => (t.terrain === 'shallow' || t.terrain === 'ocean' ? null : this.tileColors(t.terrain, this.tintOf(s, t), t.biome, !!t.xeno).top),
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
    this.town.build({ cities: townCities, lava: lavaSpots, glow: glowSpots });
    // Hoehlenhuelle und Getier / cave shell and creatures
    if (cave) { this.caveShell.build(size, seed, low); this.caveLife.build(creatures); } else { this.caveShell.clear(); this.caveLife.clear(); }
    // Heimatwelt der Zyrr: schwebende Felsen und Fremdtiere / Zyrr homeworld: floating rocks and critters
    if (alien) this.alienFx.build({ s, explored, top: tileTop, occupied });
    else if (this.alienFx.active) this.alienFx.clear();
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
    const seen = new Set<number>();
    for (const u of s.units) {
      if (viewer >= 0 && !canSeeUnit(s, viewer, u)) continue;
      seen.add(u.id);
      const f = s.factions[u.owner].id;
      const stage = u.wonder?.stage ?? 0;
      const key = `${u.type}-${f}-${u.carried}-${viewer < 0 || u.owner === viewer}-${stage}`;
      let v = this.units.get(u.id);
      if (v && v.key !== key) { this.unitLayer.remove(v.group); v = undefined; }
      if (!v) {
        const grp = new THREE.Group();
        // Alle Einheiten mit schwarzer Tuschelinie; eigene erkennt man am Bodenring
        // all units with a black ink line; own units are recognised by their ground ring
        const own = viewer >= 0 && u.owner === viewer;
        const model = outlined(unitGeometry(u.type, f, u.carried, stage), OUTLINE.unit, unitMaterial());
        // Miniatur-Sockel: dunkle Platte mit Rand in Fraktionsfarbe / miniature base: dark plate with faction-coloured rim
        const base = outlined(baseGeometry(factionTokens[f].primary), OUTLINE.unit, baseMaterial());
        base.name = 'base';
        base.traverse((o) => { o.raycast = () => {}; o.renderOrder = UNIT_ORDER - 0.6; });
        grp.add(base);
        model.scale.setScalar(UNIT_SCALE);
        model.name = 'model';
        // Fusionskraftwerk nie drehen, sonst passt die 2x2-Flaeche nicht / never rotate the fusion plant or its 2x2 footprint breaks
        model.rotation.y = u.type === 'fusionPlant' ? 0 : this.facing.get(u.id) ?? 0;
        grp.add(model);
        grp.add(this.groundMarker(f, own));
        grp.userData.unitId = u.id;
        // Reihenfolge: Bodenring, Schatten, Einheit / order: ground ring, shadow, unit
        grp.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.renderOrder === 0) o.renderOrder = UNIT_ORDER; });
        grp.position.copy(this.tileCenter(s, u.x, u.y));
        v = { id: u.id, group: grp, key, badge: null, badgeKey: '' };
        this.units.set(u.id, v);
        this.unitLayer.add(grp);
      }
      if (!this.isAnimating(u.id)) {
        v.group.position.copy(this.tileCenter(s, u.x, u.y));
        const wo = WONDER_OFFSET[u.type];
        if (wo) { v.group.position.x += wo.x; v.group.position.z += wo.z; }
        // Zyrr unter Wasser: halb eingetaucht / Zyrr under water: half submerged
        if (isWading(s, u)) v.group.position.y -= WADE_SINK;
        v.group.scale.setScalar(1);
      }
      const ft = factionTokens[f];
      // keine Aktion mehr moeglich (nur im Zug eines Menschen) / no action left (only during a human turn)
      const done = u.owner === s.current && s.factions[s.current].human &&
        (u.exhausted || u.fresh || u.attacked || (u.moved && attackTargets(s, u).length === 0));
      const badgeKey = `${u.hp}-${u.maxHp}-${u.veteran}-${done}-${u.fuel}`;
      if (v.badgeKey !== badgeKey) {
        if (v.badge) v.group.remove(v.badge);
        v.badge = hpBadge({ hp: u.hp, maxHp: u.maxHp, color: ft.primary, ink: ft.ink, veteran: u.veteran, done, fuel: u.fuel, maxFuel: FUEL.tank });
        // Endgegner: Balken ueber der Krone / boss: badge above the crown
        v.badge.position.set(0, u.type === 'heli' ? 1.02 : u.type === 'swarmMother' ? 2.15 : 0.8, 0);
        v.group.add(v.badge);
        v.badgeKey = badgeKey;
      }
      // Hubschrauber schwebt / helicopter hovers
      const model = v.group.getObjectByName('model')!;
      model.position.y = (u.type === 'heli' ? 0.1 : 0) + BASE_H;
      const submerged = u.type === 'submarine' && !u.revealed;
      this.life.track(u, v.group, model, model.position.y, UNIT_SCALE, submerged);
      const mat = submerged ? unitMaterial({ transparent: true, opacity: 0.55 }) : done ? unitMaterial({ dim: true, transparent: true, opacity: DONE_OPACITY }) : unitMaterial();
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && (mesh.material as THREE.Material).userData?.unitMat && mesh.material !== mat) mesh.material = mat;
      });
    }
    for (const [id, v] of this.units) {
      if (!seen.has(id) && !this.isAnimating(id)) { this.unitLayer.remove(v.group); this.units.delete(id); this.facing.delete(id); }
    }
    this.life.endSync(seen);
    this.updateShadows();
    this.dirty = true;
  }

  private markerCache = new Map<string, THREE.Group>();
  private groundMarker(f: FactionId, own: boolean): THREE.Object3D {
    const key = `${f}-${own}`;
    let tpl = this.markerCache.get(key);
    if (!tpl) {
      tpl = new THREE.Group();
      const flat = (inner: number, outer: number, color: string, opacity = 1) => new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: hex(color), transparent: opacity < 1, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      if (own) {
        // dicker Ring: schwarz / Markierungsfarbe / weiss / schwarz, dazu leichte Flaeche
        // thick ring: black / marker colour / white / black, plus a light fill
        const mk = factionTokens[f].marker;
        tpl.add(flat(0.465, 0.49, semantic.ink), flat(0.37, 0.465, mk), flat(0.345, 0.37, semantic.white), flat(0.33, 0.345, semantic.ink));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(0.33, 40).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: hex(mk), transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        tpl.add(fill);
        tpl.userData.pulse = true;
      } else {
        tpl.add(flat(0.4, 0.43, factionTokens[f].primary), flat(0.43, 0.445, semantic.ink));
      }
      tpl.position.y = 0.012;
      tpl.traverse((o) => { o.raycast = () => {}; o.renderOrder = UNIT_ORDER - 0.7; });
      this.markerCache.set(key, tpl);
    }
    const m = tpl.clone();
    m.name = 'marker';
    return m;
  }

  /** Eigene Ringe pulsieren leicht / own rings pulse gently */
  /** Schatten mit sterbenden Einheiten ausblenden / hide shadows of dying units */
  updateShadows() {
    for (const v of this.units.values()) {
      const sh = v.group.getObjectByName('shadow');
      if (sh) sh.visible = v.group.scale.x > 0.3;
    }
  }

  pulseMarkers(time: number) {
    this.updateShadows();
    for (const o of this.highlightLayer.children) {
      if (o.userData.bob !== undefined) {
        o.position.y = o.userData.bob + Math.sin(time * 4) * 0.035;
        const k = 0.36 * (1 + Math.sin(time * 4) * 0.06);
        o.scale.set(k, k, 1);
      }
    }
    const k = 1 + Math.sin(time * 3.2) * 0.045;
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
    const pts = [this.tileCenter(s, from.x, from.y), ...path.map((p) => this.tileCenter(s, p.x, p.y))];
    this.animating.add(unitId);
    const dur = Math.min(ANIM.maxTotal, ANIM.move * Math.max(1, path.length) * 0.6);
    const last = pts[pts.length - 1];
    const model = v.group.getObjectByName('model');
    // sanft in Laufrichtung drehen, Ergebnis merken / turn smoothly into the walking direction, remember the result
    const face = pathFacing(pts, model ? model.rotation.y : this.facing.get(unitId) ?? 0);
    this.facing.set(unitId, face(pts.length - 1));
    this.life.startMove(s, unitId, [from, ...path]);
    return this.addAnim(dur, (t) => {
      const f = t * (pts.length - 1);
      const i = Math.max(0, Math.min(pts.length - 2, Math.floor(f)));
      const local = f - i;
      v.group.position.lerpVectors(pts[i], pts[i + 1], local);
      // Gangart je Einheitenart statt eines festen Hopsers / gait per unit kind instead of a fixed hop
      this.life.moveFrame(unitId, t, f);
      if (model) model.rotation.y = face(f);
      if (t >= 1) { v.group.position.copy(last); this.animating.delete(unitId); }
    });
  }

  private fxHost: FxHost = {
    unitObject: (id) => this.units.get(id)?.group,
    anim: (dur, update) => this.addAnim(dur, update),
    hold: (id, on) => { if (on) this.animating.add(id); else this.animating.delete(id); },
    facing: (id) => this.facing.get(id) ?? 0,
    setFacing: (id, a) => { this.facing.set(id, a); },
  };

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
    o: { unitType: Unit['type']; unitFaction: FactionId; retaliate: boolean; onImpact?: () => void; onReturnFire?: () => void; onReturnImpact?: () => void }): Promise<void> {
    const GUN = -1;
    const proxy = new THREE.Group();
    proxy.position.copy(this.tileCenter(s, gun.x, gun.y)).add(new THREE.Vector3(0, 0.12, 0));
    const host: FxHost = {
      ...this.fxHost,
      unitObject: (id) => (id === GUN ? proxy : this.fxHost.unitObject(id)),
      hold: (id, on) => { if (id !== GUN) this.fxHost.hold(id, on); },
      facing: (id) => (id === GUN ? 0 : this.fxHost.facing(id)),
      setFacing: (id, a) => { if (id !== GUN) this.fxHost.setFacing(id, a); },
    };
    const water = (x: number, y: number) => { const tt = s.tiles[y * s.size + x].terrain; return tt === 'shallow' || tt === 'ocean'; };
    const u = s.units.find((x) => x.id === unitId);
    const uw = u ? water(u.x, u.y) : false;
    const info: AttackInfo = gunFires
      ? { attacker: 'tank', target: o.unitType, attackerFaction: 'nexus', targetFaction: o.unitFaction, attackerWater: false, targetWater: uw, retaliate: false, onImpact: o.onImpact }
      : { attacker: o.unitType, target: 'tank', attackerFaction: o.unitFaction, targetFaction: 'nexus', attackerWater: uw, targetWater: false, retaliate: o.retaliate,
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
        v.group.scale.setScalar(t > 0.75 ? Math.max(0.001, 1 - (t - 0.75) * 4) : 1);
      } else if (kind === 'wreck') {
        v.group.position.copy(start);
        v.group.position.y += Math.sin(Math.min(1, t * 2) * Math.PI) * 0.18;
        if (model) model.rotation.z = t * 0.4;
        v.group.scale.setScalar(t > 0.5 ? Math.max(0.001, 1 - (t - 0.5) * 2) : 1);
        if (fire) fire.scale.setScalar(t < 0.4 ? 0.3 + t * 3 : Math.max(0.001, 1.5 - (t - 0.4) * 2.5));
      } else {
        v.group.position.copy(start);
        v.group.position.y -= t * 0.3;
        v.group.rotation.z = t * 0.5;
        v.group.scale.setScalar(Math.max(0.001, 1 - t * 0.8));
      }
      const dt = t * (ANIM.death / 1000);
      for (const d of drops) {
        d.o.position.set(d.vel.x * dt, 0.22 + d.vel.y * dt - 4.5 * dt * dt, d.vel.z * dt);
        if (d.o.position.y < 0.02) { d.o.position.y = 0.02; d.o.scale.set(1.6, 0.25, 1.6); }
      }
      if (t >= 1) {
        this.unitLayer.remove(v.group); this.unitLayer.remove(fx);
        this.units.delete(unitId); this.animating.delete(unitId); this.facing.delete(unitId);
      }
    });
  }

  private highlightLooks = new Map<HighlightKind, { geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial }>();

  /** Markierungen / highlights */
  setHighlights(s: GameState | null, list: { x: number; y: number; kind: HighlightKind }[]) {
    this.clearGroup(this.highlightLayer);
    if (!s || !list.length) { this.dirty = true; return; }
    const colors: Record<HighlightKind, string> = {
      move: semantic.highlightMove, attack: semantic.highlightAttack, safe: semantic.highlightSafe, unsafe: semantic.highlightUnsafe,
      select: semantic.highlightSelect, target: semantic.highlightAttack, hint: semantic.highlightSelect, build: semantic.highlightSafe,
    };
    const byKind = new Map<HighlightKind, THREE.Matrix4[]>();
    for (const h of list) {
      const p = this.tileCenter(s, h.x, h.y);
      p.y = Math.max(p.y, TILE_TOP.shallow) + 0.02;
      const m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
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
          mat: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: kind === 'move' || kind === 'safe' || kind === 'unsafe' || kind === 'build' ? 0.85 : 1, depthWrite: false, side: THREE.DoubleSide }),
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
    // Fadenkreuz ueber Feinden in Reichweite / crosshair above enemies in range
    for (const h of list) {
      if (h.kind !== 'attack' && h.kind !== 'target') continue;
      const icon = attackIcon(h.kind === 'target');
      icon.position.copy(this.tileCenter(s, h.x, h.y)).add(new THREE.Vector3(0, 0.98, 0));
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
    const hits = ray.intersectObjects(this.pickMeshes.map((p) => p.mesh), false);
    if (!hits.length) return null;
    const h = hits[0];
    const entry = this.pickMeshes.find((p) => p.mesh === h.object);
    if (!entry || h.instanceId === undefined) return null;
    const k = entry.tiles[h.instanceId];
    return { x: k % this.size, y: Math.floor(k / this.size) };
  }

  /** Animationen fortschreiben; true, wenn neu gezeichnet werden muss / advance animations; true if redraw needed */
  tick(now: number): boolean {
    const fx = this.combat.update();
    let lived = this.life.update(now, this.animations);
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
    this.dirty = false;
    return true;
  }

  get busy() { return this.anims.length > 0 || this.combat.active; }

  finishAnimations() {
    this.combat.clear();
    for (const a of [...this.anims]) { try { a.update(1); } catch { /* weiter / continue */ } a.resolve(); }
    this.anims = [];
    this.dirty = true;
  }
}

export type { Unit };
