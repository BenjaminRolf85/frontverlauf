/**
 * Kartenbesonderheiten: Vulkane, Absturzstellen, alte Wracks und Dschungel. Eigener Zufallsstrom, damit die
 * uebrige Karte gleich bleibt. Rein deterministisch aus dem Seed.
 * Map gimmicks: volcanoes, crash sites, old wrecks and jungle. Separate random stream so the rest of the map
 * stays the same. Fully deterministic from the seed.
 */
import { HAZARDS, VOLCANO, type HazardLevel, type UnitTypeId } from '../data/balance';
import { dist, idx, neighbors } from './grid';
import { nextRandom } from './rng';
import type { GameState, Pos, Tile } from './types';

const SALT = 0x5eed7a11;
const OLD_WRECKS: UnitTypeId[] = ['tank', 'tank', 'jeep', 'artillery', 'heli'];

export function addHazards(s: GameState, level: HazardLevel) {
  if (level === 'none') return;
  const rng = { rng: (s.config.seed ^ SALT) | 0 };
  const size = s.size;
  const per100 = (size * size) / 100;
  const hqs: Pos[] = s.cities.filter((c) => c.isHQ).map((c) => ({ x: c.x, y: c.y }));
  const farFromStart = (p: Pos) => hqs.every((h) => dist(h, p) >= HAZARDS.startDistance);
  const free = (t: Tile) => t.cityId === null && !t.feature && !t.building && !t.outpost;
  const shuffled = () => {
    const all: Pos[] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) all.push({ x, y });
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(nextRandom(rng) * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return all;
  };
  const tileOf = (p: Pos) => s.tiles[idx(size, p.x, p.y)];
  const count = (v: number) => Math.round(v * per100 + nextRandom(rng) * 0.6);

  // Vulkane auf freien Bergen fern der Startpunkte / volcanoes on free mountains away from the starts
  const volcanoes: Pos[] = [];
  const vTarget = count(HAZARDS.volcanoes[level]);
  for (const p of shuffled()) {
    if (volcanoes.length >= vTarget) break;
    const t = tileOf(p);
    if (t.terrain !== 'mountain' || !free(t) || !farFromStart(p)) continue;
    if (volcanoes.some((v) => dist(v, p) < 5)) continue;
    // keine Stadt im Ausbruchsradius / no city within the eruption radius
    if (neighbors(size, p.x, p.y).some((q) => tileOf(q).cityId !== null)) continue;
    t.volcano = true; t.resource = null; t.peak = 3;
    volcanoes.push(p);
  }

  // Absturzstellen / crash sites
  const crashes: Pos[] = [];
  const cTarget = count(HAZARDS.crashSites[level]);
  for (const p of shuffled()) {
    if (crashes.length >= cTarget) break;
    const t = tileOf(p);
    if ((t.terrain !== 'plain' && t.terrain !== 'forest') || !free(t) || t.volcano || !farFromStart(p)) continue;
    if (crashes.some((c) => dist(c, p) < 5) || volcanoes.some((v) => dist(v, p) < 3)) continue;
    t.feature = 'crashSite'; t.resource = null; t.terrain = 'plain';
    crashes.push(p);
  }

  // verlassene Forschungseinrichtungen / abandoned research facilities
  const labs: Pos[] = [];
  const lTarget = count(HAZARDS.labs[level]);
  for (const p of shuffled()) {
    if (labs.length >= lTarget) break;
    const t = tileOf(p);
    if (t.terrain !== 'plain' || !free(t) || t.volcano || !farFromStart(p)) continue;
    if ([...labs, ...crashes].some((c) => dist(c, p) < 5)) continue;
    t.feature = 'labRuin'; t.resource = null;
    labs.push(p);
  }

  // alte Wracks eines frueheren Krieges (Deckung +1) / old wrecks from an earlier war (cover +1)
  const wTarget = count(HAZARDS.wrecks[level]);
  let wrecks = 0;
  for (const p of shuffled()) {
    if (wrecks >= wTarget) break;
    const t = tileOf(p);
    if ((t.terrain !== 'plain' && t.terrain !== 'forest') || !free(t) || t.remains || t.volcano) continue;
    if (hqs.some((h) => dist(h, p) < 2)) continue;
    const unit = OLD_WRECKS[Math.floor(nextRandom(rng) * OLD_WRECKS.length)];
    t.remains = { kind: 'wreck', unit, faction: -1, round: 0 };
    wrecks++;
  }

  // Dschungel: zusammenhaengende Waldgebiete, bevorzugt warm und feucht / jungle: connected forest areas, warm and wet first
  const share = HAZARDS.jungle[level];
  const forests = shuffled().filter((p) => { const t = tileOf(p); return t.terrain === 'forest' && t.biome !== 'tundra' && free(t); });
  const target = Math.round(forests.length * share);
  let made = 0;
  const seeds = forests.filter((p) => { const b = tileOf(p).biome; return b === 'swamp' || b === 'grassland' || b === 'steppe'; });
  for (const start of seeds) {
    if (made >= target) break;
    if (tileOf(start).biome === 'jungle' || !farFromStart(start)) continue;
    // Flutfuellung ueber benachbarte Waldfelder / flood fill over adjacent forest tiles
    const stack = [start];
    let grown = 0;
    while (stack.length && made < target && grown < 7) {
      const p = stack.pop()!;
      const t = tileOf(p);
      if (t.terrain !== 'forest' || t.biome === 'jungle' || !free(t) || t.biome === 'tundra') continue;
      t.biome = 'jungle'; made++; grown++;
      for (const q of neighbors(size, p.x, p.y)) stack.push(q);
    }
  }
}

/** Bricht dieser Vulkan in Runde r aus? / does this volcano erupt in round r? */
export function erupts(x: number, y: number, round: number): boolean {
  if (round < VOLCANO.firstRound) return false;
  const offset = (x * 7 + y * 3) % VOLCANO.interval;
  return (round + offset) % VOLCANO.interval === 0;
}

/** Runden bis zum naechsten Ausbruch (0 = diese Runde) / rounds until the next eruption (0 = this round) */
export function roundsToEruption(x: number, y: number, round: number): number {
  for (let i = 0; i <= VOLCANO.interval + VOLCANO.firstRound; i++) if (erupts(x, y, round + i)) return i;
  return VOLCANO.interval;
}

/** brennt das Feld gerade? / is the tile burning right now? */
export const burning = (s: GameState, t: Tile) => t.lava !== undefined && t.lava >= s.round;

/** Dschungelfeld (Wald im Dschungel-Biom, ohne Strasse) / jungle tile (forest in the jungle biome, without road) */
export const isJungle = (t: Tile) => t.terrain === 'forest' && t.biome === 'jungle' && !t.road;
