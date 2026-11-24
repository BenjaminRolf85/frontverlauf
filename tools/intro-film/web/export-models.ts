/**
 * Modellexport fuer den Introfilm (nur Entwicklung): baut die prozeduralen Spielmodelle aus src/render/models und gibt
 * sie als Rohdaten (Positionen, Normalen, Vertexfarben, Leuchtmaske) an tools/intro-film/export-models.mjs. So nutzt
 * der Blender-Film dieselben Modelle und Farben wie das Spiel.
 * Model export for the intro film (development only): builds the procedural game models from src/render/models and
 * hands them as raw data (positions, normals, vertex colours, glow mask) to tools/intro-film/export-models.mjs. The
 * Blender film thus uses the same models and colours as the game.
 */
import type * as THREE from 'three';
import type { FactionId, UnitTypeId } from '../../../src/data/balance';
import { components, factionTokens, primitives, semantic } from '../../../src/design/tokens';
import { withGlow, type GlowKind } from '../../../src/render/atmosphere';
import {
  baseGeometry, buildingGeometry, cityGeometry, cloudGeometry, crashSiteGeometry, decorationGeometry, emplacementGeometry,
  emplacementRuinGeometry, leaderGeometry, mineGeometry, mothershipGeometry, unitGeometry, verdanRuinGeometry, verdanTurretGeometry,
} from '../../../src/render/models/index';
import { academyGeometry } from '../../../src/render/models/academy';
import { verdanDesertRuin, verdanOutpostGeometry } from '../../../src/render/models/desert';
import { verdanRemains } from '../../../src/render/models/cavern';
import { siloGeometry } from '../../../src/render/models/shadowFleet';
import { templeGeometry } from '../../../src/render/models/temple';
import { wonderGeometry } from '../../../src/render/models/wonders';
import { hackTowerGeometry } from '../../../src/render/models/hacking';
import { bellTower, conifer, leafy, house, smokestack, sandbags } from '../../../src/render/overworld/props';

type Maker = () => THREE.BufferGeometry;
const HUMANS: FactionId[] = ['korvat', 'alvenia', 'dravon', 'velkar', 'meridon'];
const flagsAll = { hq: true, factory: true, bunkerRing: true, govQuarter: true };
const flagsNone = { hq: false, factory: false, bunkerRing: false, govQuarter: false };

/** Name -> [Erzeuger, Leuchtart] / name -> [maker, glow kind] */
const MODELS: Record<string, [Maker, GlowKind]> = {};
const add = (name: string, make: Maker, glow: GlowKind = 'nature') => { MODELS[name] = [make, glow]; };
const unit = (t: UnitTypeId, f: FactionId, cargo: UnitTypeId | null = null) => add(`${t}_${f}${cargo ? `_${cargo}` : ''}`, () => unitGeometry(t, f, cargo), 'bright');

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
add('house_red', () => house('#b03a2e'));
for (const v of [0, 1, 2]) add(`conifer_${v}`, () => conifer(v));
for (const v of [0, 1]) add(`leafy_${v}`, () => leafy(v));
for (const v of [0, 1, 2]) add(`cloud_${v}`, () => cloudGeometry(v));
add('forest_0', () => decorationGeometry('forest', null, 0)!);
add('forest_1', () => decorationGeometry('forest', null, 1)!);

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
  add(`city_${f}_5`, () => cityGeometry(f, 5, { ...flagsNone, hq: true, factory: true }), 'built');
  add(`bunker_${f}`, () => baseGeometry('bunker', f, 4, {} as never), 'built');
}
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

(window as unknown as { __models: unknown }).__models = {
  ready: true,
  names: Object.keys(MODELS),
  /** Farben fuer den Film (einzige Farbquelle: tokens.ts) / colours for the film (single colour source: tokens.ts) */
  tokens: () => ({ color: primitives.color, semantic, faction: factionTokens, intro: components.intro }),
  dump(name: string) {
    try { return dump(name); } catch (e) { return { name, error: String(e) }; }
  },
};
