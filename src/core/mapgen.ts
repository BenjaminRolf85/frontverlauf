import {
  BIOMES, FACTIONS, MAPGEN, MAP_TYPES, type BiomeId, type FactionId, type MapSize, type MapType, type ResourceId, type TerrainId,
} from '../data/balance';
import { area, dist, idx, inBounds, neighbors } from './grid';
import { nextRandom, randInt, shuffle } from './rng';
import type { Pos, Tile } from './types';

export interface GeneratedMap {
  tiles: Tile[];
  starts: Pos[];
  villages: Pos[];
  bunkers: Pos[];
  radars: Pos[];
}

function emptyTile(): Tile {
  return {
    terrain: 'ocean', resource: null, building: null, road: false, cityId: null, territory: null, feature: null,
    home: null, outpost: null, grandProject: null, researchBuilt: null, remains: null,
  };
}

/** Startpunkte mit fairen Abstaenden (Farthest-Point-Sampling) / start points with fair spacing */
function chooseStarts(rng: { rng: number }, size: number, count: number): Pos[] {
  const margin = size >= 14 ? 2 : 1;
  const candidates: Pos[] = [];
  for (let y = margin; y < size - margin; y++) for (let x = margin; x < size - margin; x++) candidates.push({ x, y });
  // mehrere Durchlaeufe, der mit dem groessten Mindestabstand gewinnt / several runs, the largest minimum distance wins
  let result: Pos[] = [];
  let resultD = -1;
  for (let attempt = 0; attempt < MAPGEN.startAttempts; attempt++) {
    const starts: Pos[] = [candidates[randInt(rng, candidates.length)]];
    while (starts.length < count) {
      let best: Pos[] = [];
      let bestD = -1;
      for (const c of candidates) {
        const d = Math.min(...starts.map((s) => dist(s, c)));
        if (d > bestD) { bestD = d; best = [c]; } else if (d === bestD) best.push(c);
      }
      starts.push(best[randInt(rng, best.length)]);
    }
    let minD = Infinity;
    for (let i = 0; i < starts.length; i++) for (let j = i + 1; j < starts.length; j++) minD = Math.min(minD, dist(starts[i], starts[j]));
    if (minD > resultD) { resultD = minD; result = starts; }
  }
  return result;
}

export function generateMap(seed: number, size: MapSize, mapType: MapType, factions: FactionId[]): GeneratedMap {
  const rng = { rng: seed | 0 };
  const params = MAP_TYPES[mapType];
  const n = size * size;
  const tiles: Tile[] = Array.from({ length: n }, emptyTile);
  const starts = chooseStarts(rng, size, factions.length);

  // Heimatgebiete: naechster Startpunkt / home regions: nearest start
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bestI = 0, bestD = Infinity;
      starts.forEach((s, i) => {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bestD) { bestD = d; bestI = i; }
      });
      tiles[idx(size, x, y)].home = bestI;
    }
  }

  // Landmaske aus Erhebungen / land mask from blobs
  const centers: { x: number; y: number; r: number }[] = [];
  const bigR = size * (params.lumps === 1 ? 0.75 : 0.9 / Math.sqrt(params.lumps));
  for (let i = 0; i < params.lumps; i++) {
    centers.push({ x: nextRandom(rng) * size, y: nextRandom(rng) * size, r: bigR * (0.7 + nextRandom(rng) * 0.6) });
  }
  if (params.lumps === 1) { centers[0].x = size / 2 - 0.5; centers[0].y = size / 2 - 0.5; }
  for (const s of starts) centers.push({ x: s.x, y: s.y, r: Math.max(2.5, size * 0.22) });
  const value = new Float64Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const c of centers) v = Math.max(v, 1 - Math.hypot(c.x - x, c.y - y) / c.r);
      const home = FACTIONS[factions[tiles[idx(size, x, y)].home!]].home;
      v += (nextRandom(rng) - 0.5) * 0.35 - (home.water - 0.1) * 0.5;
      value[idx(size, x, y)] = v;
    }
  }
  // Seen: Loecher stanzen / lakes: punch holes
  if (mapType === 'lakes') {
    const holes = Math.round(size / 3);
    for (let i = 0; i < holes; i++) {
      const hx = randInt(rng, size), hy = randInt(rng, size);
      for (const p of area(size, hx, hy, 1)) value[idx(size, p.x, p.y)] -= nextRandom(rng) * 0.9;
    }
  }
  const sorted = Array.from(value).sort((a, b) => b - a);
  const threshold = sorted[Math.min(n - 1, Math.floor(n * params.landRatio))];
  const land = new Uint8Array(n);
  for (let i = 0; i < n; i++) land[i] = value[i] > threshold ? 1 : 0;
  for (const s of starts) for (const p of area(size, s.x, s.y, 1)) land[idx(size, p.x, p.y)] = 1;
  const radars: Pos[] = [
    { x: 0, y: 0 }, { x: size - 1, y: 0 }, { x: 0, y: size - 1 }, { x: size - 1, y: size - 1 },
  ];
  for (const r of radars) land[idx(size, r.x, r.y)] = 1;

  // Gelaende / terrain
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = tiles[idx(size, x, y)];
      if (!land[idx(size, x, y)]) continue;
      const home = FACTIONS[factions[t.home!]].home;
      const total = home.plain + home.forest + home.mountain;
      const r = nextRandom(rng) * total;
      let terrain: TerrainId = 'plain';
      if (r < home.forest) terrain = 'forest';
      else if (r < home.forest + home.mountain) terrain = 'mountain';
      t.terrain = terrain;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (land[idx(size, x, y)]) continue;
      let nearLand = false;
      for (const p of area(size, x, y, MAPGEN.oceanDistance - 1)) if (land[idx(size, p.x, p.y)]) nearLand = true;
      tiles[idx(size, x, y)].terrain = nearLand ? 'shallow' : 'ocean';
    }
  }

  const resourceFits: Record<ResourceId, TerrainId[]> = {
    farmland: ['plain'], livestock: ['plain', 'forest'], supplies: ['plain', 'forest'], ore: ['mountain'], fish: ['shallow'],
  };
  const pickResource = (t: Tile): ResourceId | null => {
    const weights = FACTIONS[factions[t.home!]].home.res;
    const base: Record<ResourceId, number> = { farmland: 0.2, livestock: 0.2, supplies: 0.2, ore: 0.2, fish: 0.3 };
    const options = (Object.keys(resourceFits) as ResourceId[]).filter((r) => resourceFits[r].includes(t.terrain));
    if (!options.length) return null;
    let total = 0;
    const w = options.map((r) => { const v = base[r] + (weights[r] ?? 0) * 2; total += v; return v; });
    let roll = nextRandom(rng) * total;
    for (let i = 0; i < options.length; i++) { roll -= w[i]; if (roll <= 0) return options[i]; }
    return options[options.length - 1];
  };
  for (let i = 0; i < n; i++) {
    const t = tiles[i];
    if (t.terrain === 'ocean') continue;
    if (nextRandom(rng) < MAPGEN.resourceChance) t.resource = pickResource(t);
  }

  // Startfelder vorbereiten, faire Ressourcen / prepare start tiles, fair resources
  for (const s of starts) {
    const c = tiles[idx(size, s.x, s.y)];
    c.terrain = 'plain'; c.resource = null;
    const ring = area(size, s.x, s.y, 1).filter((p) => p.x !== s.x || p.y !== s.y);
    let count = ring.filter((p) => tiles[idx(size, p.x, p.y)].resource).length;
    for (const p of shuffle(rng, ring)) {
      if (count >= 3) break;
      const t = tiles[idx(size, p.x, p.y)];
      if (t.resource) continue;
      const r = pickResource(t);
      if (r) { t.resource = r; count++; }
    }
  }

  // Siedlungen: zuerst eine je Startpunkt im Abstand 3, dann der Rest / villages: one per start at distance 3, then the rest
  const villages: Pos[] = [];
  const cityOk = (p: Pos) => {
    const t = tiles[idx(size, p.x, p.y)];
    if (t.terrain === 'shallow' || t.terrain === 'ocean') return false;
    if (radars.some((r) => r.x === p.x && r.y === p.y)) return false;
    return [...starts, ...villages].every((o) => dist(o, p) > MAPGEN.minCityDistance - 0 && dist(o, p) >= MAPGEN.minCityDistance);
  };
  for (const s of starts) {
    const ring: Pos[] = [];
    for (const p of area(size, s.x, s.y, 3)) if (dist(p, s) === 3 && cityOk(p)) ring.push(p);
    if (ring.length) villages.push(ring[randInt(rng, ring.length)]);
  }
  const target = Math.round(n * MAPGEN.villagesPerTile);
  const all: Pos[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) all.push({ x, y });
  shuffle(rng, all);
  for (const p of all) {
    if (villages.length >= target) break;
    if (cityOk(p) && starts.every((s) => dist(s, p) >= 3)) villages.push(p);
  }
  for (const v of villages) {
    const t = tiles[idx(size, v.x, v.y)];
    t.resource = null;
    if (t.terrain !== 'plain' && t.terrain !== 'forest') t.terrain = 'plain';
  }

  // Bunker
  const bunkers: Pos[] = [];
  const bunkerTarget = Math.max(2, Math.round(n * MAPGEN.bunkersPerTile));
  for (const p of shuffle(rng, all.slice())) {
    if (bunkers.length >= bunkerTarget) break;
    if (radars.some((r) => r.x === p.x && r.y === p.y)) continue;
    if ([...starts, ...villages].some((o) => dist(o, p) < 2)) continue;
    if (bunkers.some((b) => dist(b, p) < 3)) continue;
    const t = tiles[idx(size, p.x, p.y)];
    if (t.terrain === 'ocean' && nextRandom(rng) < 0.6) continue;
    bunkers.push(p);
  }
  for (const b of bunkers) { const t = tiles[idx(size, b.x, b.y)]; t.feature = 'bunker'; t.resource = null; }
  for (const r of radars) {
    const t = tiles[idx(size, r.x, r.y)];
    t.feature = 'radar'; t.resource = null;
    if (t.terrain === 'shallow' || t.terrain === 'ocean') t.terrain = 'plain';
    // Ecke etwas zugaenglicher / make corner a bit more reachable
    for (const p of neighbors(size, r.x, r.y)) {
      const nt = tiles[idx(size, p.x, p.y)];
      if (nt.terrain === 'ocean') nt.terrain = 'shallow';
    }
  }
  // Inseln ohne Kuestenzugang vermeiden: Ozean neben Land wird Flachwasser / ocean next to land becomes shallow
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = tiles[idx(size, x, y)];
      if (t.terrain !== 'ocean') continue;
      if (neighbors(size, x, y).some((p) => { const o = tiles[idx(size, p.x, p.y)]; return o.terrain !== 'ocean' && o.terrain !== 'shallow'; })) {
        t.terrain = 'shallow';
      }
    }
  }
  if (!inBounds(size, 0, 0)) throw new Error('invalid size');
  assignBiomes(seed, size, tiles, factions);
  return { tiles, starts, villages, bunkers, radars };
}

/** Heimat-Vorlieben fuer Landschaften / home preferences for biomes */
const HOME_BIOME: Record<FactionId, Partial<Record<BiomeId, number>>> = {
  korvat: { steppe: 0.35, grassland: 0.25 },
  dravon: { desert: 0.3, steppe: 0.3 },
  alvenia: { hills: 0.4, grassland: 0.2 },
  meridon: { swamp: 0.25, grassland: 0.3 },
  velkar: { tundra: 0.45, hills: 0.25 },
  zyrr: { desert: 0.25, steppe: 0.2 },
  vesper: { desert: 0.3, steppe: 0.25 },
  nexus: { tundra: 0.25, hills: 0.2 },
};

/**
 * Landschaftszonen und Fluesse in einem eigenen Zufallsstrom (veraendert die uebrige Karte nicht).
 * Biomes and rivers on a separate random stream (does not change the rest of the map).
 */
function assignBiomes(seed: number, size: number, tiles: Tile[], factions: FactionId[]) {
  const rng = { rng: (seed ^ MAPGEN.biomeSeedSalt) | 0 };
  const land = (t: Tile) => t.terrain !== 'shallow' && t.terrain !== 'ocean';
  const nearWater = (x: number, y: number) => neighbors(size, x, y).some((p) => !land(tiles[idx(size, p.x, p.y)]));
  const nearMountain = (x: number, y: number) => neighbors(size, x, y).some((p) => tiles[idx(size, p.x, p.y)].terrain === 'mountain');
  // Klima: Norden kalt, Sueden trocken, plus Rauschen / climate: north cold, south dry, plus noise
  const noise = Array.from({ length: 6 }, () => ({ x: nextRandom(rng) * size, y: nextRandom(rng) * size, v: nextRandom(rng) - 0.5 }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = tiles[idx(size, x, y)];
      if (!land(t)) continue;
      let n = 0;
      for (const c of noise) n += c.v * Math.max(0, 1 - Math.hypot(c.x - x, c.y - y) / (size * 0.45));
      const lat = y / Math.max(1, size - 1) + n * 0.5;
      const w: Record<BiomeId, number> = {
        grassland: 0.35,
        hills: nearMountain(x, y) ? MAPGEN.hillChance : 0.06,
        desert: Math.max(0, lat - 0.62) * 1.6,
        steppe: Math.max(0, 0.45 - Math.abs(lat - 0.62)) * 0.9,
        tundra: Math.max(0, 0.32 - lat) * 2.2,
        swamp: nearWater(x, y) && t.terrain !== 'mountain' ? 0.18 : 0,
        jungle: 0,
      };
      const home = t.home !== null ? HOME_BIOME[factions[t.home]] : {};
      for (const [b, v] of Object.entries(home)) w[b as BiomeId] += v as number;
      if (t.terrain === 'mountain') { w.swamp = 0; w.desert *= 0.5; }
      if (t.terrain === 'forest') { w.desert *= 0.2; }
      let total = 0;
      for (const b of BIOMES) total += w[b];
      let r = nextRandom(rng) * total;
      let pick: BiomeId = 'grassland';
      for (const b of BIOMES) { r -= w[b]; if (r <= 0) { pick = b; break; } }
      t.biome = pick;
    }
  }
  // Glaetten: Mehrheit der Nachbarn / smoothing: neighbour majority
  for (let pass = 0; pass < 2; pass++) {
    const next = tiles.map((t) => t.biome);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const t = tiles[idx(size, x, y)];
      if (!land(t) || t.biome === 'hills') continue;
      const count = new Map<BiomeId, number>();
      for (const p of neighbors(size, x, y)) { const b = tiles[idx(size, p.x, p.y)].biome; if (b && b !== 'hills') count.set(b, (count.get(b) ?? 0) + 1); }
      let best: BiomeId = t.biome!, bestN = 2;
      for (const [b, c] of count) if (c > bestN) { best = b; bestN = c; }
      next[idx(size, x, y)] = best;
    }
    next.forEach((b, i) => { if (b) tiles[i].biome = b; });
  }
  // Berghoehen: mehr Bergnachbarn = hoeher / mountain heights: more mountain neighbours = higher
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const t = tiles[idx(size, x, y)];
    if (t.terrain !== 'mountain') continue;
    const n = neighbors(size, x, y).filter((p) => tiles[idx(size, p.x, p.y)].terrain === 'mountain').length;
    const roll = nextRandom(rng);
    t.peak = n >= 3 ? (roll < 0.65 ? 3 : 2) : n >= 1 ? (roll < 0.5 ? 2 : roll < 0.8 ? 1 : 3) : (roll < 0.6 ? 1 : 2);
  }
  // Fluesse von den Bergen zum Wasser / rivers from mountains to water
  const sources = tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.terrain === 'mountain');
  const rivers = Math.round(size * MAPGEN.riversPerSize);
  for (let r = 0; r < rivers && sources.length; r++) {
    const start = sources.splice(randInt(rng, sources.length), 1)[0].i;
    let cx = start % size, cy = Math.floor(start / size);
    const path: number[] = [];
    for (let step = 0; step < size * 2; step++) {
      const opts = neighbors(size, cx, cy).filter((p) => Math.abs(p.x - cx) + Math.abs(p.y - cy) === 1);
      if (opts.some((p) => !land(tiles[idx(size, p.x, p.y)]))) break;
      // naechstes Feld Richtung naechstes Wasser / next tile towards nearest water
      let best: { x: number; y: number } | null = null, bestD = Infinity;
      for (const p of opts) {
        const k = idx(size, p.x, p.y);
        const tt = tiles[k];
        if (path.includes(k) || tt.terrain === 'mountain' || tt.cityId !== null) continue;
        let d = Infinity;
        for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) if (!land(tiles[idx(size, xx, yy)])) d = Math.min(d, Math.abs(xx - p.x) + Math.abs(yy - p.y));
        d += nextRandom(rng) * 0.9;
        if (d < bestD) { bestD = d; best = p; }
      }
      if (!best) break;
      cx = best.x; cy = best.y;
      path.push(idx(size, cx, cy));
    }
    if (path.length >= 2) for (const k of path) { tiles[k].river = true; if (tiles[k].biome === 'desert') tiles[k].biome = 'steppe'; }
  }
}
