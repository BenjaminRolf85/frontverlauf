/**
 * Modellexport fuer den Introfilm (nur Entwicklung): baut die prozeduralen Spielmodelle aus src/render/models und gibt
 * sie als Rohdaten an tools/intro-film/export-models.mjs. So nutzt der Blender-Film dieselben Modelle und Farben wie
 * das Spiel.
 * - Gelaende, Bauwerke, Requisiten: Positionen, Normalen, Vertexfarben, Leuchtmaske (dump).
 * - Einheiten: die GEZEICHNETEN Modelle (src/render/models/inked) in hoher Qualitaet (dumpInked): je Teil (Wanne,
 *   Drehtuerme) die Flaeche mit uv, fx (Glanz, Verdeckung), Vertexfarbe, Normale und Leuchtmaske, dazu die Tusche aus
 *   dem Tuschebauer des Spiels (inkFor): Huelle fuer den Umriss und die Knickkanten der Innenlinien. Die Atlanten
 *   (Zeichnung RGBA, Tusche als Abstandsfeld) gibt atlas() als Rohbytes heraus, export-models.mjs schreibt PNGs.
 * Model export for the intro film (development only): builds the procedural game models from src/render/models and
 * hands them as raw data to tools/intro-film/export-models.mjs. The Blender film thus uses the same models and colours
 * as the game.
 * - terrain, buildings, props: positions, normals, vertex colours, glow mask (dump).
 * - units: the INKED models (src/render/models/inked) at high quality (dumpInked): per part (hull, turrets) the fill
 *   with uv, fx (gloss, occlusion), vertex colour, normal and glow mask, plus the ink from the game's ink builder
 *   (inkFor): the hull for the silhouette and the crease edges of the inner lines. atlas() hands out the atlases
 *   (drawing RGBA, ink as a distance field) as raw bytes; export-models.mjs writes PNGs.
 */
import * as THREE from 'three';
import type { FactionId, UnitTypeId } from '../../../src/data/balance';
import { components, factionTokens, primitives, semantic } from '../../../src/design/tokens';
import { withGlow, type GlowKind } from '../../../src/render/atmosphere';
import {
  baseGeometry, buildingGeometry, cityGeometry, cloudGeometry, crashSiteGeometry, decorationGeometry, emplacementGeometry,
  emplacementRuinGeometry, leaderGeometry, mineGeometry, mothershipGeometry, setUnitQuality, splitTurrets, techParts, unitGeometry, verdanRuinGeometry, verdanTurretGeometry,
} from '../../../src/render/models/index';
import { setFilmSegments, withDetail } from '../../../src/render/models/kit';
import { figureExtras } from './figureKit';
import { FIGURES } from './figures';
import { academyGeometry } from '../../../src/render/models/academy';
import { atlasDef, atlasSize, atlasTextures, flushAtlases, SDF_RANGE } from '../../../src/render/models/inked/atlas';
import { crewCells, crewExtraCells } from '../../../src/render/models/inked/figurePaint';
import { CREASE_HALF_WIDTH, inkFor, inkGeometry, OUTLINE_MAX_PX } from '../../../src/render/models/inked/ink';
import { Builder, splitTurrets as kitSplit, type TurretRange } from '../../../src/render/models/kit';
import { addEmblem } from '../../../src/render/models/emblems';
import { REF } from '../../../src/render/models/inked/uvkit';
import { OCTO_BLADE, rotorBlades, surveyDrone, TESLA_TOPS } from '../../../src/render/models/velkarTech';
import { OUTLINE } from '../../../src/render/config';
import { wreckGeometry } from '../../../src/render/remains';
import { TOON_RAMP, UNIT_BRIGHTNESS } from '../../../src/render/toon';
import { verdanDesertRuin, verdanOutpostGeometry } from '../../../src/render/models/desert';
import { verdanRemains } from '../../../src/render/models/cavern';
import { siloGeometry } from '../../../src/render/models/shadowFleet';
import { templeGeometry } from '../../../src/render/models/temple';
import { wonderGeometry } from '../../../src/render/models/wonders';
import { hackTowerGeometry } from '../../../src/render/models/hacking';
import { bellTower, conifer, leafy, house, smokestack, sandbags } from '../../../src/render/overworld/props';

// Film: immer die hohe Detailstufe der Einheiten / film: always the high unit detail level
setUnitQuality('high');
// Filmstufe (export-models.mjs --quality film, ?seg=2): runde Teile mit mehr Segmenten und Ringen, nur in diesem Export;
// ohne Angabe genau die Modelle des Spiels / film level (?seg=2): round parts with more segments and rings, only in this
// export; without it exactly the game's models
const FILM_SEG = Number(new URLSearchParams(location.search).get('seg') ?? '1');
if (FILM_SEG > 1) setFilmSegments(FILM_SEG);

type Maker = () => THREE.BufferGeometry;
const HUMANS: FactionId[] = ['korvat', 'alvenia', 'dravon', 'velkar', 'meridon'];
const flagsAll = { hq: true, factory: true, bunkerRing: true, govQuarter: true };
const flagsNone = { hq: false, factory: false, bunkerRing: false, govQuarter: false };

/** Name -> [Erzeuger, Leuchtart] / name -> [maker, glow kind] */
const MODELS: Record<string, [Maker, GlowKind]> = {};
const add = (name: string, make: Maker, glow: GlowKind = 'nature') => { MODELS[name] = [make, glow]; };
/** Einheiten: Name -> [Typ, Fraktion, Ladung] (gezeichnet, siehe dumpInked) / units: name -> [type, faction, cargo] (inked, see dumpInked) */
const UNITS: Record<string, [UnitTypeId, FactionId, UnitTypeId | null, boolean]> = {};
const unit = (t: UnitTypeId, f: FactionId, cargo: UnitTypeId | null = null) => { UNITS[`${t}_${f}${cargo ? `_${cargo}` : ''}`] = [t, f, cargo, false]; };
/** Fahrzeug ohne Besatzung (siehe stripCrew) / vehicle without crew (see stripCrew) */
const hulk = (t: UnitTypeId, f: FactionId) => { UNITS[`hulk_${t}_${f}`] = [t, f, null, true]; };

// Verdan: Reich, Stillstand, Ruinen / Verdan: empire, standstill, ruins
add('city_neutral_8', () => cityGeometry(null, 8, flagsAll), 'built');
add('city_neutral_5', () => cityGeometry(null, 5, { ...flagsNone, factory: true }), 'built');
add('city_neutral_3', () => cityGeometry(null, 3, flagsNone), 'built');
add('verdan_outpost_3', () => verdanOutpostGeometry(null, 3, true), 'built');
add('verdan_outpost_2', () => verdanOutpostGeometry(null, 2, false), 'built');
add('verdan_turret_on', () => verdanTurretGeometry(true), 'bright');
add('verdan_turret_off', () => verdanTurretGeometry(false));
add('verdan_ruin', () => verdanRuinGeometry());
for (const v of [0, 1, 2, 3]) add(`verdan_desert_ruin_${v}`, () => verdanDesertRuin(v));
for (const v of [0, 1, 2]) add(`verdan_remains_${v}`, () => verdanRemains(v));
add('factory_neutral', () => baseGeometry('factory', null, 6, {} as never), 'built');
add('nuclear_neutral', () => baseGeometry('nuclearPlant', null, 6, {} as never), 'built');
add('smokestack', () => smokestack(0.4));
add('bell_tower', () => bellTower());
add('sandbags', () => sandbags());
add('house_red', () => house(semantic.stamp));
for (const v of [0, 1, 2]) add(`conifer_${v}`, () => conifer(v));
for (const v of [0, 1]) add(`leafy_${v}`, () => leafy(v));
for (const v of [0, 1, 2]) add(`cloud_${v}`, () => cloudGeometry(v));
add('forest_0', () => decorationGeometry('forest', null, 0)!);
add('forest_1', () => decorationGeometry('forest', null, 1)!);

// Wracks: verkohlte Scherben aus dem Wrackbauer des Spiels (aus den gezeichneten Fahrzeugen); die ganzen Fahrzeuge der
// Wrackeinstellung sind die gezeichneten Einheiten selbst ohne Besatzung (hulk), im Film rostig eingefaerbt
// wrecks: charred shards from the game's wreck builder (made from the inked vehicles); the whole vehicles of the wreck
// shot are the inked units themselves without their crew (hulk), tinted rusty in the film
for (const f of HUMANS) {
  for (const t of ['tank', 'artillery', 'heli', 'jeep'] as UnitTypeId[]) hulk(t, f);
  for (const [t, v] of [['tank', 0], ['tank', 1], ['artillery', 0], ['heli', 0], ['jeep', 0]] as [UnitTypeId, number][]) add(`wreck_${t}_${f}_${v}`, () => wreckGeometry(t, f, v), 'bright');
}
// bewegliche Teile der Velkar-Einheiten (Rotor, Messdrohne), wie das Brett sie anhaengt / moving parts of the Velkar units (rotor, survey drone) as the board attaches them
add('tech_rotor', () => rotorBlades(OCTO_BLADE).build(), 'nature');
add('tech_drone', () => surveyDrone().build(), 'nature');

// Zyrr / Zyrr
add('mothership', () => mothershipGeometry(false), 'bright');
add('crash_site_0', () => crashSiteGeometry(0), 'bright');
add('crash_site_1', () => crashSiteGeometry(1), 'bright');
add('portal_2', () => wonderGeometry('portal', 'zyrr', 2), 'bright');
add('portal_0', () => wonderGeometry('portal', 'zyrr', 0), 'bright');
for (const t of ['grey', 'terraformer', 'skimmer', 'mech', 'tripod'] as UnitTypeId[]) unit(t, 'zyrr');
add('city_zyrr_5', () => cityGeometry('zyrr', 5, { ...flagsNone, hq: true, factory: true }), 'built');

// NEXUS und Kult / NEXUS and cult
add('datacenter_nexus', () => buildingGeometry('dataCenter', 'nexus'), 'bright');
add('powerplant_nexus', () => buildingGeometry('powerPlant', 'nexus'), 'bright');
add('hacktower_nexus', () => hackTowerGeometry('nexus', true), 'bright');
add('hackrelay_2', () => wonderGeometry('hackRelay', 'nexus', 2), 'bright');
for (const t of ['android', 'cyborg', 'spider', 'titan', 'quadDrone', 'railgun'] as UnitTypeId[]) unit(t, 'nexus');
add('temple', () => templeGeometry(false), 'bright');
add('shrine_vesper', () => buildingGeometry('shrine', 'vesper'), 'bright');
for (const t of ['zealot', 'torchbearer', 'prophet', 'berserker', 'doomBuggy', 'doomCrawler'] as UnitTypeId[]) unit(t, 'vesper');

// Menschen: allgemeine Einheiten je Fraktion / humans: common units per faction
for (const f of HUMANS) {
  for (const t of ['infantry', 'tank', 'jeep', 'artillery', 'heli', 'mg'] as UnitTypeId[]) unit(t, f);
  add(`leader_${f}`, () => leaderGeometry(f, 'neutral'), 'bright');
  // Emblem der Fraktion fuer das Banner hinter dem Anfuehrer, in der Schriftfarbe der Fraktion / the faction's emblem for the banner behind the leader, in the faction's ink colour
  add(`emblem_${f}`, () => { const b = new Builder(); addEmblem(b, f, 0.1, 0.012, factionTokens[f].ink); return b.build(); }, 'none');
  add(`city_${f}_5`, () => cityGeometry(f, 5, { ...flagsNone, hq: true, factory: true }), 'built');
  add(`bunker_${f}`, () => baseGeometry('bunker', f, 4, {} as never), 'built');
}
// Anime-Schnitt: Filmfiguren mit Skelett (nur Filmexport, figures.ts) / anime cut: film figures with a skeleton (film export only)
for (const [name, make] of Object.entries(FIGURES)) add(name, () => withDetail(1.6, true, make, { smooth: true, fine: true }), 'bright');
// Korvat
for (const t of ['steppeRider', 'stormbreaker', 'steppeColossus'] as UnitTypeId[]) unit(t, 'korvat');
add('kolkhoz_korvat', () => buildingGeometry('kolkhoz', 'korvat'), 'built');
// Alvenia
for (const t of ['divineSpark', 'lightWarden', 'reliquary', 'sunLance'] as UnitTypeId[]) unit(t, 'alvenia');
// Dravon
add('emplacement_dravon', () => emplacementGeometry('dravon'), 'bright');
add('emplacement_ruin', () => emplacementRuinGeometry(null));
add('mine_dravon', () => mineGeometry('dravon'), 'bright');
for (const t of ['mineLayer', 'antiTank', 'sniper'] as UnitTypeId[]) unit(t, 'dravon');
add('barracks_dravon', () => buildingGeometry('mercenaryBarracks', 'dravon'), 'built');
// Velkar
add('academy_air', () => academyGeometry('velkar', 8, 'air'), 'bright');
add('academy_ground', () => academyGeometry('velkar', 6, 'ground'), 'bright');
for (const t of ['teslaTank', 'octocopter', 'railSniper', 'protoWalker'] as UnitTypeId[]) unit(t, 'velkar');
add('fusion_2', () => wonderGeometry('fusionPlant', 'velkar', 2), 'bright');
// Meridon
for (const t of ['privateer', 'destroyer', 'battleship', 'submarine', 'marine', 'shadowCommando', 'guidedMissile'] as UnitTypeId[]) unit(t, 'meridon');
unit('landingBoat', 'meridon', 'marine');
add('silo_meridon', () => siloGeometry('meridon'), 'bright');
add('trading_post_meridon', () => buildingGeometry('tradingPost', 'meridon'), 'built');
add('naval_meridon', () => baseGeometry('navalStation', 'meridon', 5, {} as never, 0), 'built');

function b64(arr: ArrayBufferView): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Ein Modell als Rohdaten (Dreiecke ohne Index) / one model as raw data (non-indexed triangles) */
function dump(name: string) {
  const [make, kind] = MODELS[name];
  let g = make();
  // Folgt das Modell dem Vertrag der gezeichneten Einheiten (userData.inked = { atlas }, userData.inkSrc, uv, fx),
  // geht es denselben Weg wie sie, ohne Sonderfall: so kommen auch gezeichnete Bauten oder Anfuehrer in den Film.
  // If the model follows the contract of the inked units (userData.inked = { atlas }, userData.inkSrc, uv, fx) it
  // takes the same path as they do, without a special case: inked structures or leaders reach the film that way too.
  if (g.userData.inked) return dumpInkedGeometry(name, g, null, null, false);
  // Muendung (z. B. Goettlicher Funke) fuer Effekte im Film / muzzle (e.g. Divine Spark) for effects in the film
  const muzzle = (g.userData.muzzle as number[] | undefined) ?? null;
  if (g.index) g = g.toNonIndexed();
  g = withGlow(g.clone(), kind);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), col = g.getAttribute('color'), glow = g.getAttribute('glow');
  const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined, n: number) => {
    const out = new Float32Array(pos.count * n);
    if (a) for (let i = 0; i < pos.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = a.getComponent(i, k);
    return out;
  };
  return { name, muzzle, count: pos.count, pos: b64(f32(pos as THREE.BufferAttribute, 3)), nor: b64(f32(nor as THREE.BufferAttribute, 3)), col: b64(f32(col as THREE.BufferAttribute, 3)), glow: b64(f32(glow as THREE.BufferAttribute, 2)) };
}

/** Mehrere Felder als ein Binaerblock: Lage und Typ je Feld, Daten als Base64 / several arrays as one binary block: place and type per array, data as base64 */
class Pack {
  private parts: Uint8Array[] = [];
  private size = 0;
  put(a: Float32Array | Uint32Array): { off: number; n: number; type: 'f32' | 'u32' } {
    const off = this.size;
    this.parts.push(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    this.size += a.byteLength;
    return { off, n: a.length, type: a instanceof Float32Array ? 'f32' : 'u32' };
  }
  b64(): string {
    const all = new Uint8Array(this.size);
    let o = 0;
    for (const p of this.parts) { all.set(p, o); o += p.byteLength; }
    return b64(all);
  }
}

const attr = (g: THREE.BufferGeometry, name: string, n: number): Float32Array => {
  const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
  const count = g.getAttribute('position').count;
  const out = new Float32Array(count * n);
  if (a) for (let i = 0; i < count; i++) for (let k = 0; k < n; k++) out[i * n + k] = a.getComponent(i, k);
  return out;
};

/**
 * Ein Teil einer gezeichneten Einheit (Wanne oder Turm): Flaeche und Tusche.
 * Tusche: inkFor() liefert Huellenecken (verschweisst, geglaettete Normalen) und je Knickkante vier Ecken
 * (a-, a+, b-, b+) mit dem Vektor zum anderen Ende und dem Gewicht; hier wieder zu Kanten (a, b, Gewicht a, Gewicht b)
 * zusammengefasst, damit Blender daraus eigene Linien baut (im Spiel faechert sie der Shader im Bildraum auf).
 * One part of an inked unit (hull or turret): fill and ink.
 * Ink: inkFor() returns hull vertices (welded, smoothed normals) and four vertices per crease edge (a-, a+, b-, b+)
 * with the vector to the other end and the weight; folded back into edges (a, b, weight a, weight b) here so Blender
 * builds its own lines from them (in the game the shader fans them out in screen space).
 */
function dumpPart(g0: THREE.BufferGeometry, pack: Pack, ig: THREE.BufferGeometry = inkFor(g0)) {
  // Attribute kopieren, userData (mit der Rohgeometrie) nicht / copy the attributes, not userData (which holds the raw geometry)
  let g = new THREE.BufferGeometry();
  const src = g0.index ? g0.toNonIndexed() : g0;
  for (const name of Object.keys(src.attributes)) g.setAttribute(name, (src.getAttribute(name) as THREE.BufferAttribute).clone());
  // Leuchtmaske wie im Spiel: nur die Schluesselfarben (Velkar, Alvenia, NEXUS-Augen, Zyrr) / glow mask as in the game: the key colours only (Velkar, Alvenia, NEXUS eyes, Zyrr)
  g = withGlow(g, 'nature');
  const ip = ig.getAttribute('position') as THREE.BufferAttribute, inor = ig.getAttribute('normal') as THREE.BufferAttribute, ink = ig.getAttribute('ink') as THREE.BufferAttribute;
  const creases = (ig.userData.creases as number) ?? 0;
  const nv = ip.count - creases * 4;
  const hullTris = (ig.userData.hullTriangles as number) ?? 0;
  const idx = ig.getIndex()!;
  const hullPos = new Float32Array(nv * 3), hullNor = new Float32Array(nv * 3), hullIdx = new Uint32Array(hullTris * 3);
  for (let i = 0; i < nv * 3; i++) { hullPos[i] = (ip.array as Float32Array)[i]; hullNor[i] = (inor.array as Float32Array)[i]; }
  for (let i = 0; i < hullTris * 3; i++) hullIdx[i] = idx.getX(i);
  const cA = new Float32Array(creases * 3), cB = new Float32Array(creases * 3), cW = new Float32Array(creases * 2);
  for (let c = 0; c < creases; c++) {
    const a = nv + c * 4, b = a + 2;
    for (let k = 0; k < 3; k++) { cA[c * 3 + k] = ip.getComponent(a, k); cB[c * 3 + k] = ip.getComponent(a, k) + inor.getComponent(a, k); }
    cW[c * 2] = ink.getZ(a); cW[c * 2 + 1] = ink.getZ(b);
  }
  return {
    count: g.getAttribute('position').count,
    pos: pack.put(attr(g, 'position', 3)), nor: pack.put(attr(g, 'normal', 3)), uv: pack.put(attr(g, 'uv', 2)), col: pack.put(attr(g, 'color', 3)),
    fx: pack.put(attr(g, 'fx', 2)), glow: pack.put(attr(g, 'glow', 2)),
    ink: { verts: nv, tris: hullTris, creases, pos: pack.put(hullPos), nor: pack.put(hullNor), idx: pack.put(hullIdx), a: pack.put(cA), b: pack.put(cB), w: pack.put(cW) },
  };
}

/** Atlanten, die exportierte Einheiten brauchen / atlases needed by exported units */
const usedAtlases = new Set<string>();

// ---------- Fahrzeuge ohne Besatzung fuer die Wrackeinstellung / vehicles without crew for the wreck shot ----------
// Die gezeichneten Fahrzeuge haben immer ihre Besatzung. Fuer rostende Wracks nimmt der Export sie hier heraus, ohne die
// Bauer des Spiels zu aendern: Dreiecke, deren Texturkoordinaten in den Zellen der Figur liegen, und neutrale Teile
// (Helm, Ruestung), die ganz im Raum einer Figur liegen. Die Tusche entsteht danach neu aus der Rohgeometrie.
// The inked vehicles always carry their crew. For rusting wrecks the export removes it here without changing the game's
// builders: triangles whose texture coordinates lie in the figure's cells, and neutral parts (helmet, armour) that lie
// wholly inside a figure's space. The ink is then rebuilt from the raw geometry.
// Zellen, aus denen die Besatzungen gebaut sind: Koerper (crewCells), Beine der Geschuetzbedienung, Kopfbedeckung und Ruestung
// cells the crews are made of: body (crewCells), legs of the gun crews, headgear and armour
const FIGURE_CELLS = new Set([...crewCells(), ...crewExtraCells()].map((c) => c.name).concat(['thigh', 'shin', 'boot']));

/** Dreiecke behalten, Turmbereiche nachfuehren / keep triangles, carry the turret ranges along */
function keepTriangles(g: THREE.BufferGeometry, keep: Uint8Array): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const count = g.getAttribute('position').count;
  const map: number[] = [];
  for (let t = 0; t < count / 3; t++) if (keep[t]) map.push(t * 3, t * 3 + 1, t * 3 + 2);
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute, n = a.itemSize;
    const arr = new Float32Array(map.length * n);
    map.forEach((v, i) => { for (let k = 0; k < n; k++) arr[i * n + k] = a.getComponent(v, k); });
    out.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  const turrets = g.userData.turrets as TurretRange[] | undefined;
  const before = (v: number) => { let c = 0; for (let t = 0; t < v / 3; t++) if (keep[t]) c += 3; return c; };
  out.userData = { ...(turrets ? { turrets: turrets.map((r) => ({ ...r, start: before(r.start), count: before(r.start + r.count) - before(r.start) })) } : {}) };
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Besatzung aus Rohgeometrie und Flaeche nehmen / remove the crew from raw geometry and fill */
function stripCrew(raw: THREE.BufferGeometry, fill: THREE.BufferGeometry, atlas: string): { raw: THREE.BufferGeometry; fill: THREE.BufferGeometry } {
  const layout = atlasDef(atlas).layout;
  const cells = [...layout.regions.values()].filter((r) => FIGURE_CELLS.has(r.name));
  const blank = layout.get('blank');
  const inside = (r: { x: number; y: number; w: number; h: number }, u: number, v: number) => u * REF >= r.x - 0.5 && u * REF <= r.x + r.w + 0.5 && v * REF >= r.y - 0.5 && v * REF <= r.y + r.h + 0.5;
  /** 2 = Figur, 1 = neutrale Zelle, 0 = Fahrzeug / 2 = figure, 1 = neutral cell, 0 = vehicle */
  const kind = (g: THREE.BufferGeometry, t: number): number => {
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const all = (r: { x: number; y: number; w: number; h: number }) => [0, 1, 2].every((k) => inside(r, uv.getX(t * 3 + k), uv.getY(t * 3 + k)));
    if (all(blank)) return 1;
    return cells.some(all) ? 2 : 0;
  };
  const pos = raw.getAttribute('position') as THREE.BufferAttribute;
  const nt = pos.count / 3;
  // zusammenhaengende Teile ueber verschweisste Ecken / connected parts via welded vertices
  const parent = new Int32Array(nt).map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const seen = new Map<string, number>();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const i = t * 3 + k, key = `${Math.round(pos.getX(i) * 20000)},${Math.round(pos.getY(i) * 20000)},${Math.round(pos.getZ(i) * 20000)}`;
    const o = seen.get(key);
    if (o === undefined) seen.set(key, t); else parent[find(t)] = find(o);
  }
  interface Part { kinds: Set<number>; box: THREE.Box3; tris: number[] }
  const parts = new Map<number, Part>();
  const p = new THREE.Vector3();
  for (let t = 0; t < nt; t++) {
    const root = find(t);
    let part = parts.get(root);
    if (!part) { part = { kinds: new Set(), box: new THREE.Box3(), tris: [] }; parts.set(root, part); }
    part.kinds.add(kind(raw, t));
    part.tris.push(t);
    for (let k = 0; k < 3; k++) part.box.expandByPoint(p.fromBufferAttribute(pos, t * 3 + k));
  }
  // Raum jeder Figur: ihre Teile, zusammengefasst wenn sie sich beruehren, mit Platz fuer Helm und Ruestung
  // space of each figure: its parts, merged where they touch, with room for helmet and armour
  let boxes = [...parts.values()].filter((q) => q.kinds.has(2)).map((q) => q.box.clone().expandByScalar(0.012));
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].intersectsBox(boxes[j])) { boxes[i].union(boxes[j]); boxes.splice(j, 1); merged = true; break outer; }
    }
  }
  boxes = boxes.map((b) => new THREE.Box3(b.min.clone().add(new THREE.Vector3(-0.006, 0, -0.006)), b.max.clone().add(new THREE.Vector3(0.006, 0.03, 0.006))));
  const keepRaw = new Uint8Array(nt).fill(1);
  const gone: THREE.Box3[] = [];
  for (const q of parts.values()) {
    const figure = q.kinds.has(2);
    const gear = !figure && q.kinds.size === 1 && q.kinds.has(1) && boxes.some((b) => b.containsBox(q.box));
    if (!figure && !gear) continue;
    for (const t of q.tris) keepRaw[t] = 0;
    if (gear) gone.push(q.box.clone().expandByScalar(0.0005));
  }
  const fp = fill.getAttribute('position') as THREE.BufferAttribute;
  const keepFill = new Uint8Array(fp.count / 3).fill(1);
  for (let t = 0; t < fp.count / 3; t++) {
    const k = kind(fill, t);
    if (k === 2) keepFill[t] = 0;
    else if (k === 1) {
      p.set(0, 0, 0);
      for (let c = 0; c < 3; c++) p.add(new THREE.Vector3().fromBufferAttribute(fp, t * 3 + c));
      p.multiplyScalar(1 / 3);
      if (gone.some((b) => b.containsPoint(p))) keepFill[t] = 0;
    }
  }
  return { raw: keepTriangles(raw, keepRaw), fill: keepTriangles(fill, keepFill) };
}

/** Eine gezeichnete Einheit: Wanne und Drehtuerme getrennt (Drehpunkt, Ruhewinkel), Massstab, Muendung, bewegliche Teile / one inked unit: hull and turrets apart (pivot, rest heading), scale, muzzle, moving parts */
function dumpInked(name: string) {
  const [type, f, cargo, hulk] = UNITS[name];
  const g = unitGeometry(type, f, cargo);
  if (!g.userData.inked) throw new Error(`${name}: not an inked unit`);
  return dumpInkedGeometry(name, g, type, f, hulk);
}

/** Eine Geometrie nach dem Vertrag der gezeichneten Einheiten (Einheit, Anfuehrer, ...) / a geometry following the inked units' contract (unit, leader, ...) */
function dumpInkedGeometry(name: string, g: THREE.BufferGeometry, type: UnitTypeId | null, f: FactionId | null, hulk: boolean) {
  const inked = g.userData.inked as { atlas: string };
  usedAtlases.add(inked.atlas);
  const pack = new Pack();
  type PartHead = { role: string; pivot: number[]; yaw: number; arc: number | null };
  let parts: (PartHead & ReturnType<typeof dumpPart>)[];
  if (hulk) {
    const bare = stripCrew(g.userData.inkSrc as THREE.BufferGeometry, g.index ? g.toNonIndexed() : g, inked.atlas);
    const fs = kitSplit(bare.fill), rs = kitSplit(bare.raw);
    const ink = (r: THREE.BufferGeometry) => inkGeometry(r, { creases: true });
    parts = fs && rs
      ? [{ role: 'hull', pivot: [0, 0, 0], yaw: 0, arc: null, ...dumpPart(fs.hull, pack, ink(rs.hull)) },
        ...fs.turrets.map((t, i) => ({ role: 'turret', pivot: t.pivot.toArray(), yaw: t.yaw, arc: t.arc ?? null, ...dumpPart(t.geometry, pack, ink(rs.turrets[i].geometry)) }))]
      : [{ role: 'hull', pivot: [0, 0, 0], yaw: 0, arc: null, ...dumpPart(bare.fill, pack, ink(bare.raw)) }];
  } else {
    const split = splitTurrets(g);
    parts = split
      ? [{ role: 'hull', pivot: [0, 0, 0], yaw: 0, arc: null, ...dumpPart(split.hull, pack) },
        ...split.turrets.map((t) => ({ role: 'turret', pivot: t.pivot.toArray(), yaw: t.yaw, arc: t.arc ?? null, ...dumpPart(t.geometry, pack) }))]
      : [{ role: 'hull', pivot: [0, 0, 0], yaw: 0, arc: null, ...dumpPart(g, pack) }];
  }
  const k = (g.userData.finishScale as number | undefined) ?? 1;
  g.computeBoundingBox();
  return {
    name, kind: 'inked', type, faction: f, atlas: inked.atlas, finishScale: k,
    muzzle: (g.userData.muzzle as number[] | undefined) ?? null,
    bounds: [g.boundingBox!.min.toArray(), g.boundingBox!.max.toArray()],
    // bewegliche Teile wie TechParts.attach: Ort mal finishScale / moving parts as in TechParts.attach: place times finishScale
    tech: type && f ? techParts(type, f).map((p) => ({ kind: p.kind, p: p.p.map((v) => v * k), dir: p.dir ?? 1, variant: p.variant ?? 0, scale: k })) : [],
    // Spulenkoepfe des Tesla-Panzers fuer die Lichtboegen des Films / coil tops of the Tesla tank for the film's arcs
    teslaTops: type === 'teslaTank' ? TESLA_TOPS.map((p) => p.map((v) => v * k)) : null,
    tris: parts.reduce((n, p) => n + p.count / 3, 0), inkTris: parts.reduce((n, p) => n + p.ink.tris + p.ink.creases * 2, 0),
    // Filmfiguren: Skelett und Gewichte (figureKit.ts) / film figures: skeleton and weights
    figure: g.userData.figure ? figureExtras(g, pack) : null,
    parts, data: pack.b64(),
  };
}

/** Kenngroessen des gezeichneten Stils, damit Blender nichts abschreibt / figures of the inked style so Blender copies nothing by hand */
function style() {
  return {
    ref: REF, sdfRange: SDF_RANGE, unitBrightness: UNIT_BRIGHTNESS, toonRamp: TOON_RAMP.hard,
    outline: OUTLINE.unit, outlineMaxPx: OUTLINE_MAX_PX, creaseHalfWidth: CREASE_HALF_WIDTH, filmSegments: FILM_SEG,
    atlases: [...usedAtlases].sort(), hero: [...usedAtlases].filter((id) => atlasDef(id).hero).sort(),
  };
}

/** Texturen eines Atlas in der Kantenlaenge size fertig zeichnen; die Rohbytes holt atlasChunk / paint an atlas at edge length size; atlasChunk fetches the raw bytes */
function atlas(id: string, wanted: number) {
  const size = atlasEdge(id, wanted);
  const t = atlasTextures(id, size);
  flushAtlases();
  const blank = atlasDef(id).layout.get('blank');
  return { id, size, ready: t.ready, paintBytes: (t.paint.image.data as Uint8Array).length, inkBytes: (t.ink.image.data as Uint8Array).length, blank: [blank.x / REF, blank.y / REF, blank.w / REF, blank.h / REF] };
}
/**
 * Kantenlaenge, in der ein Atlas exportiert wird: die gewuenschte, mindestens aber seine eigene hohe Stufe
 * (atlasSize: Heldenatlanten der Anfuehrer nennen 2048, Atlanten des Bretts 1024).
 * Edge length an atlas is exported at: the wanted one, but at least its own high level (atlasSize: the leaders' hero
 * atlases state 2048, board atlases 1024).
 */
function atlasEdge(id: string, wanted: number): number {
  return Math.max(wanted, atlasSize(id, 'high'));
}
function atlasChunk(id: string, wanted: number, layer: 'paint' | 'ink', off: number, len: number): string {
  const t = atlasTextures(id, atlasEdge(id, wanted));
  const data = (layer === 'paint' ? t.paint.image.data : t.ink.image.data) as Uint8Array;
  return b64(data.subarray(off, Math.min(data.length, off + len)));
}

(window as unknown as { __models: unknown }).__models = {
  ready: true,
  names: Object.keys(MODELS),
  units: Object.keys(UNITS),
  /** Farben fuer den Film (einzige Farbquelle: tokens.ts) / colours for the film (single colour source: tokens.ts) */
  tokens: () => ({ color: primitives.color, semantic, faction: factionTokens, intro: components.intro }),
  dump(name: string) {
    try { return dump(name); } catch (e) { return { name, error: String(e) }; }
  },
  dumpInked(name: string) {
    try { return dumpInked(name); } catch (e) { return { name, error: String(e) }; }
  },
  style, atlas, atlasChunk,
};
