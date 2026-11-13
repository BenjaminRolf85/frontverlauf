/**
 * Die Spielkarte als 3D-Diorama. Liest den Zustand, veraendert ihn nie.
 * The game map as a 3D diorama. Reads the state, never changes it.
 */
import * as THREE from 'three';
import type { BiomeId, FactionId, TerrainId } from '../data/balance';
import type { Tile } from '../core';
import { FUEL } from '../data/balance';
import { attackTargets, levelUpCost, burning, canSeeUnit, submerged as isWading, cityById, isExplored, weather, type GameState, type Unit } from '../core';
import { factionTokens, hex, semantic } from '../design/tokens';
import { tList } from '../i18n/i18n';
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

/** Platzhalter, solange ein Modell fehlt: Grundkoerper in Fraktionsfarbe / placeholder while a model is missing */
const placeholderCache = new Map<string, THREE.BufferGeometry>();
function placeholder(color: string, h = 0.3): THREE.BufferGeometry {
  const key = `${color}-${h}`;
  let g = placeholderCache.get(key);
  if (!g) { g = paint(new THREE.CylinderGeometry(0.18, 0.22, h, 8).toNonIndexed(), color); g.translate(0, h / 2, 0); placeholderCache.set(key, g); }
  return g;
}
function safe<T extends unknown[]>(fn: (...a: T) => THREE.BufferGeometry | null, fallback: string | null, ...args: T): THREE.BufferGeometry | null {
  try { return fn(...args); } catch { return fallback ? placeholder(fallback) : null; }
}
const unitGeometry = (type: Parameters<typeof models.unitGeometry>[0], f: Parameters<typeof models.unitGeometry>[1], c: Parameters<typeof models.unitGeometry>[2]) =>
  safe(models.unitGeometry, factionTokens[f].primary, type, f, c)!;
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
  return TILE_TOP[t.terrain] + (t.biome && t.terrain !== 'shallow' && t.terrain !== 'ocean' ? BIOME_LIFT[t.biome] : 0) +
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
  private units = new Map<number, UnitView>();
  private pickMeshes: { mesh: THREE.InstancedMesh; tiles: number[] }[] = [];
  private anims: Anim[] = [];
  private tileGeoCache = new Map<string, THREE.BufferGeometry>();
  size = 0;
  animations = true;
  showLabels = true;
  dirty = true;

  constructor() {
    this.group.add(this.staticLayer, this.highlightLayer, this.unitLayer, this.labelLayer, this.weatherFx.group, this.ambient.group, this.combat.group);
    // Tiefenpuffer vor den Einheiten leeren: Gebaeude, Baeume und Berge verdecken keine Einheiten mehr
    // clear the depth buffer before units: buildings, trees and mountains no longer hide units
    const clearer = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    clearer.frustumCulled = false;
    clearer.renderOrder = UNIT_ORDER - 1;
    clearer.onBeforeRender = (renderer) => renderer.clearDepth();
    clearer.raycast = () => {};
    this.unitLayer.add(clearer);
    this.group.add(this.life.group);
    this.life.busy = (id) => this.animating.has(id);
  }

  /** Mittelpunkt eines Feldes in Brett-Koordinaten / centre of a tile in board coordinates */
  tileCenter(s: GameState | null, x: number, y: number): THREE.Vector3 {
    const off = (this.size - 1) / 2;
    const top = s ? tileTop(s.tiles[y * s.size + x]) : 0;
    return new THREE.Vector3(x - off, top, y - off);
  }

  private snowy = false;
  private tileGeo(terrain: TerrainId | 'fog', tint: string | null, biome?: BiomeId, peak = 2, xeno = false): THREE.BufferGeometry {
    const key = `${terrain}-${tint}-${biome}-${peak}-${this.snowy}-${xeno}`;
    let g = this.tileGeoCache.get(key);
    if (g) return g;
    if (terrain === 'fog') {
      g = coloredBox(0.98, 0.32, 0.98, semantic.cloudShade, semantic.neutralDark);
      g.translate(0, 0.32 / 2 + TILE_BOTTOM, 0);
    } else {
      const top = TILE_TOP[terrain] + (biome && terrain !== 'shallow' && terrain !== 'ocean' ? BIOME_LIFT[biome] : 0) + (terrain === 'mountain' ? PEAK_LIFT[peak] : 0);
      const h = top - TILE_BOTTOM;
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
      // Xeno-Boden: violett mit dunkler Kante / xeno ground: violet with a dark edge
      if (xeno && terrain !== 'shallow' && terrain !== 'ocean') {
        topColor = mix(semantic.xenoGround, topColor, terrain === 'mountain' ? 0.35 : 0.15);
        side = semantic.xenoGroundDark;
      } else if (xeno) topColor = mix(topColor, semantic.xenoGlow, 0.35);
      // Schneewetter: Land leicht verschneit / snow weather: land lightly snow-covered
      if (this.snowy && terrain !== 'shallow' && terrain !== 'ocean') topColor = mix(topColor, semantic.snow, 0.5);
      g = coloredBox(0.98, h, 0.98, topColor, side);
      g.translate(0, TILE_BOTTOM + h / 2, 0);
    }
    this.tileGeoCache.set(key, g);
    return g;
  }

  private clearGroup(g: THREE.Group) {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse((o) => {
        if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      });
    }
  }

  /** Statische Ebene neu aufbauen / rebuild static layer */
  rebuild(s: GameState, viewer: number) {
    this.size = s.size;
    this.weatherFx.set(weather(s), s.size);
    this.snowy = weather(s) === 'snow';
    this.clearGroup(this.staticLayer);
    this.clearGroup(this.labelLayer);
    this.pickMeshes = [];
    const size = s.size;
    const explored = (x: number, y: number) => viewer < 0 || isExplored(s, viewer, x, y);

    // Scholle / slab
    const slab = outlined(paint(new THREE.BoxGeometry(size + 0.1, SLAB_DEPTH, size + 0.1).toNonIndexed(), semantic.soil), OUTLINE.tile);
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
    const addDeco = (geo: THREE.BufferGeometry | null, m: THREE.Matrix4, sway = false) => {
      if (!geo) return;
      const map = sway ? swayGroups : decoGroups;
      let list = map.get(geo);
      if (!list) { list = []; map.set(geo, list); }
      list.push(m);
    };
    const fishTiles: { x: number; z: number; y: number }[] = [];
    const occupied = new Set(s.units.filter((u) => viewer < 0 || canSeeUnit(s, viewer, u)).map((u) => u.y * size + u.x));
    const coast: { x: number; z: number; y: number; nx: number; nz: number }[] = [];
    const decals = new Map<THREE.BufferGeometry, THREE.Matrix4[]>();
    const roadSegs: THREE.Matrix4[] = [];
    const roadNodes: THREE.Matrix4[] = [];
    const riverSegs: THREE.Matrix4[] = [];
    const borderSegs: { m: THREE.Matrix4; color: string }[] = [];
    const clouds: THREE.Matrix4[] = [];
    const off = (size - 1) / 2;

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
        add(this.tileGeo(t.terrain, homeFaction && !t.xeno ? factionTokens[homeFaction].terrain : null, t.biome, t.peak ?? 2, !!t.xeno), pos, k);
        const top = tileTop(t);
        const ps = t.terrain === 'mountain' ? PEAK_SCALE[t.peak ?? 2] : 1;
        const at = (dy = 0) => new THREE.Matrix4().compose(
          new THREE.Vector3(x - off, top + dy, y - off),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x * 3 + y * 5) % 4) * (Math.PI / 2)),
          new THREE.Vector3(Math.min(1.15, 0.85 + ps * 0.15), ps, Math.min(1.15, 0.85 + ps * 0.15)));
        const variant = (x * 7 + y * 13) % 3;
        const hasStructure = t.cityId !== null || t.building || t.grandProject || t.outpost || t.feature;
        // Auf Feldern mit Einheit keine Baeume, Graeser oder Felsen, damit die Einheit frei steht
        // no trees, grass or rocks on tiles with a unit so the unit stands out
        const occ = occupied.has(k);
        // Pflanzen wiegen sich / plants sway
        const plant = t.terrain === 'forest' || t.resource === 'farmland' || (t.terrain === 'plain' && !t.resource);
        const jungle = t.terrain === 'forest' && t.biome === 'jungle';
        if (t.volcano) {
          // Vulkan statt Berggipfel, Rauch darueber / volcano instead of the peak, smoke above
          addDeco(volcanoGeometry(variant), at());
          addDeco(volcanoSmokeGeometry(), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top + 0.78, y - off), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)), true);
        } else if (occ && t.terrain === 'mountain') {
          // Berg bleibt erkennbar: kleiner Gipfel in der hinteren Ecke / mountain stays readable: small peak in the back corner
          addDeco(decorationGeometry(t.terrain, null, variant), new THREE.Matrix4().compose(new THREE.Vector3(x - off - 0.3, top, y - off - 0.3), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.6, 0.45)));
        } else if (t.xeno && t.terrain !== 'mountain' && t.terrain !== 'shallow' && t.terrain !== 'ocean') {
          // Xeno-Flora statt Baeumen und Graesern / xeno flora instead of trees and grass
          if (!occ && (!hasStructure || t.building === 'road')) addDeco(t.resource ? decorationGeometry(t.terrain, t.resource, variant) : xenoDecoration((x * 7 + y * 13 + x * y) % 6), at(), !t.resource);
        } else if (jungle && !t.resource) {
          // dichter Dschungel, auch neben Einheiten sichtbar am Rand / dense jungle, kept at the edge next to units
          if (!hasStructure || t.building === 'road') addDeco(jungleDecoration((x * 5 + y * 11) % 4), occ ? new THREE.Matrix4().compose(new THREE.Vector3(x - off - 0.28, top, y - off - 0.28), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.8, 0.45)) : at(), true);
        } else if (!occ && (!hasStructure || t.building === 'road')) addDeco(decorationGeometry(t.terrain, t.resource, variant), at(), plant);
        // brennende Lava nach einem Ausbruch / burning lava after an eruption
        if (burning(s, t)) addDeco(lavaGeometry((x + y * 3) % 3), new THREE.Matrix4().makeTranslation(x - off, top + 0.005, y - off));
        if (!jungle && !t.xeno && !occ && !hasStructure && !t.resource && !t.road && !t.remains && !t.barrier) addDeco(biomeDecoration(t.terrain, t.biome, (x * 7 + y * 13 + x * y) % 8), at(), true);
        // Fische und Kueste / fish and coast
        if (t.terrain === 'shallow' || t.terrain === 'ocean') {
          if (t.resource === 'fish' && !t.building) fishTiles.push({ x: x - off, z: y - off, y: top });
          if (!t.building) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
              const nt = s.tiles[ny * size + nx];
              if (nt.terrain !== 'shallow' && nt.terrain !== 'ocean' && explored(nx, ny)) coast.push({ x: x - off, z: y - off, y: top, nx: dx, nz: dy });
            }
          }
        }
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
        else if (!occ && t.resource && !t.building && t.cityId === null) addDeco(decorationGeometry(t.terrain, t.resource, variant), at());
        const owner = t.territory !== null ? cityById(s, t.territory)?.owner ?? null : null;
        const ownerFaction = owner !== null ? s.factions[owner].id : null;
        if (t.building && t.building !== 'road') {
          let rot = 0;
          if (t.building === 'bridge') {
            const landAt = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < size && yy < size && !['shallow', 'ocean'].includes(s.tiles[yy * size + xx].terrain);
            if (landAt(x - 1, y) || landAt(x + 1, y)) rot = Math.PI / 2;
          }
          addDeco(buildingGeometry(t.building, ownerFaction), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1)));
        }
        if (t.grandProject) addDeco(buildingGeometry(t.grandProject, ownerFaction), new THREE.Matrix4().makeTranslation(x - off, top, y - off));
        if (t.outpost) addDeco(buildingGeometry('outpost', s.factions[t.outpost.owner]?.id ?? null), new THREE.Matrix4().makeTranslation(x - off, top, y - off));
        if (t.feature === 'labRuin') addDeco(labRuinGeometry((x + y) % 2), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x + y * 3) % 4) * (Math.PI / 2)), new THREE.Vector3(1, 1, 1)));
        else if (t.feature === 'crashSite') addDeco(crashSiteGeometry((x + y) % 2), new THREE.Matrix4().compose(new THREE.Vector3(x - off, top, y - off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x * 3 + y) % 4) * (Math.PI / 2)), new THREE.Vector3(1, 1, 1)));
        else if (t.feature) addDeco(featureGeometry(t.feature), new THREE.Matrix4().makeTranslation(x - off, top, y - off));
        if (t.barrier) {
          const bf = s.factions[t.barrier.owner]?.id;
          addDeco(safe(barrierGeometry, semantic.metal, bf ? factionTokens[bf].secondary : semantic.metal), new THREE.Matrix4().makeTranslation(x - off, top, y - off));
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
      const { mesh, line } = outlinedInstanced(geo, gr.mats.length, OUTLINE.tile);
      mesh.receiveShadow = true;
      gr.mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.staticLayer.add(mesh, line);
      this.pickMeshes.push({ mesh, tiles: gr.tiles });
    }
    for (const [geo, mats] of decoGroups) {
      const { mesh, line } = outlinedInstanced(geo, mats.length, OUTLINE.building);
      mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.raycast = () => {};
      this.staticLayer.add(mesh, line);
    }
    for (const [geo, mats] of swayGroups) {
      const { mesh, line } = outlinedInstanced(geo, mats.length, OUTLINE.building, swayMaterial(), swayOutline(OUTLINE.building));
      mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
      mesh.raycast = () => {};
      this.staticLayer.add(mesh, line);
    }
    this.ambient.build(fishTiles, coast);
    const decalMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const [geo, mats] of decals) {
      const mesh = new THREE.InstancedMesh(geo, decalMat, mats.length);
      mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.raycast = () => {};
      this.staticLayer.add(mesh);
    }
    if (riverSegs.length) {
      const g = riverSegment();
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
      const g = paint(new THREE.BoxGeometry(0.98, 0.05, 0.07).toNonIndexed(), semantic.white);
      const mesh = new THREE.InstancedMesh(g, toonMaterial(), borderSegs.length);
      borderSegs.forEach((b, i) => { mesh.setMatrixAt(i, b.m); mesh.setColorAt(i, new THREE.Color(hex(b.color))); });
      mesh.raycast = () => {};
      const line = new THREE.InstancedMesh(hullGeometry(g), outlineMaterial(OUTLINE.highlight), borderSegs.length);
      borderSegs.forEach((b, i) => line.setMatrixAt(i, b.m));
      line.raycast = () => {};
      this.staticLayer.add(mesh, line);
    }
    if (clouds.length) {
      const geos = [0, 1, 2].map((v) => cloudGeometry(v));
      const byVariant: THREE.Matrix4[][] = [[], [], []];
      clouds.forEach((m, i) => byVariant[i % 3].push(m));
      byVariant.forEach((list, v) => {
        if (!list.length) return;
        const { mesh, line } = outlinedInstanced(geos[v], list.length, OUTLINE.cloud);
        list.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
        mesh.raycast = () => {};
        this.staticLayer.add(mesh, line);
      });
    }

    // Staedte / cities
    const names = tList('cityNames');
    for (const c of s.cities) {
      if (!explored(c.x, c.y)) continue;
      const fid = c.owner !== null ? s.factions[c.owner].id : null;
      const g = cityGeometry(fid, c.owner === null ? 1 : c.level, { hq: c.isHQ && c.hqOf === c.owner, factory: c.factory, bunkerRing: c.bunkerRing, govQuarter: c.govQuarter });
      const obj = outlined(g, OUTLINE.building);
      obj.position.copy(this.tileCenter(s, c.x, c.y));
      obj.traverse((o) => { o.raycast = () => {}; });
      this.staticLayer.add(obj);
      // Stadt-Ausbauten / city upgrades
      for (const [slot, up] of (c.upgrades ?? []).entries()) {
        const perk = outlined(perkGeometry(up, fid), OUTLINE.building);
        const [px, pz] = SLOT_SPOT[slot % SLOT_SPOT.length];
        perk.position.copy(this.tileCenter(s, c.x, c.y)).add(new THREE.Vector3(px, 0, pz));
        perk.scale.setScalar(PERK_SCALE);
        perk.traverse((o) => { o.raycast = () => {}; });
        this.staticLayer.add(perk);
      }
      if (this.showLabels && names.length) {
        const color = fid ? factionTokens[fid].primary : semantic.neutral;
        const ink = fid ? factionTokens[fid].ink : semantic.text;
        // Stufe und Fortschritt zur naechsten Stufe (nur fuer Staedte von Fraktionen) / level and progress to the next level (faction cities only)
        const need = c.owner !== null ? levelUpCost(s, c) : 0;
        const label = cityLabel(names[c.nameIndex % names.length], c.owner === null ? 0 : c.level, color, ink, c.isHQ && c.hqOf === c.owner, c.pop, need);
        label.position.copy(this.tileCenter(s, c.x, c.y)).add(new THREE.Vector3(0, -0.05, 0.42));
        label.center.set(0.5, 1);
        this.labelLayer.add(label);
      }
    }
    this.dirty = true;
  }

  /** Einheiten abgleichen / sync units */
  syncUnits(s: GameState, viewer: number) {
    const seen = new Set<number>();
    for (const u of s.units) {
      if (viewer >= 0 && !canSeeUnit(s, viewer, u)) continue;
      seen.add(u.id);
      const f = s.factions[u.owner].id;
      const key = `${u.type}-${f}-${u.carried}-${viewer < 0 || u.owner === viewer}`;
      let v = this.units.get(u.id);
      if (v && v.key !== key) { this.unitLayer.remove(v.group); v = undefined; }
      if (!v) {
        const grp = new THREE.Group();
        // Alle Einheiten mit schwarzer Tuschelinie; eigene erkennt man am Bodenring
        // all units with a black ink line; own units are recognised by their ground ring
        const own = viewer >= 0 && u.owner === viewer;
        const model = outlined(unitGeometry(u.type, f, u.carried), OUTLINE.unit, unitMaterial());
        // Miniatur-Sockel: dunkle Platte mit Rand in Fraktionsfarbe / miniature base: dark plate with faction-coloured rim
        const base = outlined(baseGeometry(factionTokens[f].primary), OUTLINE.unit, baseMaterial());
        base.name = 'base';
        base.traverse((o) => { o.raycast = () => {}; o.renderOrder = UNIT_ORDER - 0.6; });
        grp.add(base);
        model.scale.setScalar(UNIT_SCALE);
        model.name = 'model';
        model.rotation.y = this.facing.get(u.id) ?? 0;
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
        v.badge.position.set(0, u.type === 'heli' ? 1.02 : 0.8, 0);
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
      const big = kind === 'select' || kind === 'target' || kind === 'hint';
      const ring = new THREE.RingGeometry(big ? 0.36 : 0.22, big ? 0.46 : 0.32, 20, 1).rotateX(-Math.PI / 2);
      const flat = paint(ring.toNonIndexed(), colors[kind]);
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: kind === 'move' || kind === 'safe' || kind === 'unsafe' || kind === 'build' ? 0.85 : 1, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.InstancedMesh(flat, mat, mats.length);
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
    const lived = this.life.update(now, this.animations);
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
