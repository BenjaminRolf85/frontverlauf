/**
 * Stadtwachstum je Stufe, weniger Siedlungen, Sendetuerme in freien Partien, schnellere Einheiten.
 * City growth per level, fewer settlements, transmitter towers in free games, faster units.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, cityTiles, createGame, defaultConfig, dist, expandRadius, generateMap, rewardOptions, towerCountFor, type City, type GameConfig, type GameState,
} from '../src/core';
import { chooseReward } from '../src/ai/economy';
import { buildCtx } from '../src/ai/analysis';
import { planNextCommand } from '../src/ai/ai';
import { AI, CITY, MAPGEN, MAP_SIZES, TOWER, UNITS, VISION, type FactionId, type MapType } from '../src/data/balance';
import { TUTORIAL_CONFIG } from '../src/ui/tutorial';
import { addCity, addUnit, blankGame, ok, tile } from './helpers';

const FOUR: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon'];

describe('Siedlungsabstand / settlement spacing', () => {
  it('neutrale Siedlungen mindestens villageSpacing auseinander, jede Startinsel hat ihre Heimatsiedlung / neutral villages at least villageSpacing apart, every start island has its home village', () => {
    // die pauschale Kuerzung ist durch den Abstand ersetzt / the flat cut is replaced by the spacing
    expect(MAPGEN.villageShare).toBe(1);
    expect(MAPGEN.villageSpacing).toBe(4);
    let pairs = 0, close = 0;
    for (const type of ['continent', 'lakes', 'continents'] as MapType[]) {
      for (const size of MAP_SIZES) for (const seed of [1, 2, 3, 4]) {
        const m = generateMap(seed * 17 + size, size, type, FOUR);
        expect(m.villages.length).toBeGreaterThanOrEqual(m.starts.length);
        const v = m.villages;
        for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) {
          pairs++;
          // nur eine Heimatsiedlung ohne anderen Platz darf naeher liegen / only a home village with no other spot may lie closer
          if (dist(v[a], v[b]) < MAPGEN.villageSpacing) { close++; expect(a, `${type} ${size} ${seed}`).toBeLessThan(m.starts.length); }
          expect(dist(v[a], v[b])).toBeGreaterThanOrEqual(MAPGEN.minCityDistance);
        }
      }
    }
    // die Ausnahme ist selten / the exception is rare
    expect(close / pairs).toBeLessThan(0.01);
  });
});

const towers = (s: GameState) => s.cities.filter((c) => c.tower);
const freeGame = (seed: number, size: GameConfig['size'], mapType: MapType, mode: GameConfig['mode'] = 'conquest', ids: FactionId[] = ['vesper', 'korvat', 'dravon']) =>
  // ohne Stuetzpunkte (bases: false): mit ihnen werden die Orte der Sendetuerme zu Stuetzpunkten (bases.test.ts); die
  // Turm-Regeln gelten weiter fuer Partien ohne Stuetzpunkte, die Kampagne und alte Spielstaende
  // without bases (bases: false): with them the transmitter towers' places become bases (bases.test.ts); the tower rules
  // still apply to games without bases, the campaign and old saves
  createGame(defaultConfig({ seed, size, mapType, mode, bases: false, factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));

describe('Sendetuerme in freien Partien / transmitter towers in free games', () => {
  it('2 bis 4 je nach Kartengroesse, mit den Abstaenden aus TOWER, deterministisch / 2 to 4 by map size, with the distances from TOWER, deterministic', () => {
    expect(MAP_SIZES.map(towerCountFor)).toEqual([2, 3, 4, 4, 4, 4]);
    let total = 0, planned = 0;
    for (const size of MAP_SIZES) for (const mapType of ['continent', 'lakes', 'continents'] as MapType[]) for (const mode of ['conquest', 'points'] as const) {
      const s = freeGame(size * 7 + 3, size, mapType, mode);
      const list = towers(s);
      const tag = `${size} ${mapType} ${mode}`;
      expect(list.length, tag).toBeLessThanOrEqual(towerCountFor(size));
      expect(list.length, tag).toBeGreaterThanOrEqual(TOWER.min);
      total += list.length; planned += towerCountFor(size);
      for (const t of list) {
        expect(t.owner, tag).toBeNull();
        expect(t.level).toBe(1);
        const tile = s.tiles[t.y * s.size + t.x];
        expect(tile.cityId).toBe(t.id);
        expect(tile.terrain).toBe('plain');
        expect(tile.territory).toBeNull();
        for (const c of s.cities) {
          if (c === t) continue;
          // erst TOWER.hqDistance, auf engen Karten fuer die uebrigen TOWER.freeHqDistance / first TOWER.hqDistance, on tight maps TOWER.freeHqDistance for the rest
          if (c.isHQ) expect(dist(c, t), tag).toBeGreaterThanOrEqual(TOWER.freeHqDistance);
          else if (c.tower) expect(dist(c, t), tag).toBeGreaterThanOrEqual(TOWER.spacing);
          else expect(dist(c, t), tag).toBeGreaterThanOrEqual(TOWER.cityDistance);
        }
        expect(s.units.some((u) => u.x === t.x && u.y === t.y)).toBe(false);
      }
      // gleiche Konfiguration, gleiche Tuerme / same configuration, same towers
      expect(JSON.stringify(towers(freeGame(size * 7 + 3, size, mapType, mode)))).toBe(JSON.stringify(list));
    }
    // fast immer so viele wie vorgesehen / almost always as many as planned
    expect(total / planned).toBeGreaterThan(0.9);
  });

  it('nicht im Tutorial, Siedlung des Tutorials bleibt eine echte Siedlung / not in the tutorial, the tutorial village stays a real village', () => {
    expect(TUTORIAL_CONFIG.towers).toBe(false);
    const s = createGame(TUTORIAL_CONFIG);
    expect(towers(s)).toHaveLength(0);
    expect(s.cities.filter((c) => c.owner === null).length).toBeGreaterThanOrEqual(1);
  });

  it('KI nimmt freie Tuerme ein und bildet dort aus, ohne Fehlbefehle / AI captures free towers and trains there, without failed commands', () => {
    let captured = 0, trained = 0, fails = 0;
    for (const seed of [3, 8]) {
      const s = freeGame(seed, 14, 'continent', 'conquest', ['vesper', 'korvat', 'meridon', 'velkar']);
      const ids = new Set(towers(s).map((c) => c.id));
      expect(ids.size).toBe(3);
      while (!s.over && s.round <= 30) {
        const f = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          for (const e of r.events) {
            if (e.t === 'capture' && ids.has(e.city)) captured++;
            if (e.t === 'train' && cmd.type === 'train' && ids.has(cmd.city)) trained++;
          }
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
    }
    expect(fails).toBe(0);
    expect(captured).toBeGreaterThan(0);
    expect(trained).toBeGreaterThan(0);
  }, 120_000);
});

/** Stufe kaufen und die Belohnung nehmen (Grenzerweiterung nur, wenn gewuenscht) / buy a level and take the reward (border expansion only if wanted) */
function levelUp(s: GameState, c: City, expand = false) {
  c.levelBought = undefined;
  s.factions[c.owner!].stars = 10_000;
  ok(s, { type: 'buyLevel', city: c.id });
  const p = s.pendingRewards.find((r) => r.cityId === c.id)!;
  const [a] = rewardOptions(c, p.level);
  ok(s, { type: 'reward', city: c.id, choice: expand && a === 'expand' ? 'a' : 'b' });
}
const ring = (c: City, r: number) => (p: { x: number; y: number }) => dist(c, p) === r;
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

function growGame() {
  const s = blankGame({ size: 16 });
  const hq = addCity(s, 8, 8, 0, { hq: true });
  addCity(s, 14, 14, 1, { hq: true });
  return { s, hq };
}

describe('Stadtwachstum je Stufe / city growth per level', () => {
  it('jede Stufe bis zu 4 Felder im naechsten Ring, die naechsten zuerst, aufgedeckt / every level up to 4 tiles in the next ring, nearest first, revealed', () => {
    expect(CITY.growTiles).toBe(4);
    expect(CITY.growMaxRadius).toBe(3);
    const { s, hq } = growGame();
    expect(cityTiles(s, hq)).toHaveLength(9);
    levelUp(s, hq);
    const tiles = cityTiles(s, hq);
    expect(tiles).toHaveLength(13);
    expect(hq.radius).toBe(1);
    // die vier geraden Nachbarn im Ring 2 (euklidisch am naechsten) / the four straight ring-2 neighbours (euclidean nearest)
    expect(tiles.filter(ring(hq, 2)).map(key).sort()).toEqual(['10,8', '6,8', '8,10', '8,6']);
    for (const p of tiles.filter(ring(hq, 2))) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      expect(s.factions[0].explored[(p.y + dy) * s.size + p.x + dx], key(p)).toBe(1);
    }
    expect(VISION.cityExtra).toBe(1);
  });

  it('voller Ring wird zum Radius, Obergrenze 7x7 / a full ring becomes the radius, cap 7x7', () => {
    const { s, hq } = growGame();
    // Ring 2: 16 Felder = 4 Aufstiege / ring 2: 16 tiles = 4 level-ups
    for (let i = 0; i < 3; i++) levelUp(s, hq);
    expect(hq.radius).toBe(1);
    expect(cityTiles(s, hq)).toHaveLength(9 + 12);
    levelUp(s, hq);
    expect(hq.radius).toBe(2);
    expect(cityTiles(s, hq)).toHaveLength(25);
    // Ring 3: 24 Felder = 6 Aufstiege / ring 3: 24 tiles = 6 level-ups
    for (let i = 0; i < 5; i++) levelUp(s, hq);
    expect(hq.radius).toBe(2);
    expect(cityTiles(s, hq)).toHaveLength(25 + 20);
    levelUp(s, hq);
    expect(hq.radius).toBe(3);
    expect(cityTiles(s, hq)).toHaveLength(49);
    // danach waechst nichts mehr / nothing grows afterwards
    levelUp(s, hq);
    expect(hq.radius).toBe(3);
    expect(cityTiles(s, hq)).toHaveLength(49);
    expect(hq.level).toBe(12);
  });

  it('fremdes Gebiet und fremde Orte bleiben fremd, der Rest des Rings fuellt sich / foreign territory and places stay foreign, the rest of the ring fills up', () => {
    const { s, hq } = growGame();
    // feindliche Stadt drei Felder rechts: ihr 3x3 deckt die rechte Haelfte des Rings 2 / hostile city three tiles to the right: its 3x3 covers the right half of ring 2
    const foe = addCity(s, 11, 8, 1);
    const village = addCity(s, 8, 6, null);
    const foeTiles = cityTiles(s, foe).map(key).sort();
    let grown = 0;
    while (hq.radius < 2) { levelUp(s, hq); grown++; }
    expect(cityTiles(s, foe).map(key).sort()).toEqual(foeTiles);
    expect(tile(s, village.x, village.y).territory).toBeNull();
    // Ring 2 hat 16 Felder; 3 gehoeren der feindlichen Stadt, 1 ist die Siedlung: 12 frei = 3 Aufstiege
    // ring 2 has 16 tiles; 3 belong to the hostile city, 1 is the village: 12 free = 3 level-ups
    expect(grown).toBe(3);
    expect(cityTiles(s, hq).filter(ring(hq, 2))).toHaveLength(12);
    // naechster Aufstieg waechst in Ring 3 weiter / the next level-up grows on in ring 3
    levelUp(s, hq);
    expect(cityTiles(s, hq).filter(ring(hq, 3))).toHaveLength(4);
  });

  it('am Kartenrand nur Felder auf der Karte / at the map edge only tiles on the map', () => {
    const s = blankGame({ size: 14 });
    const hq = addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 12, 12, 1, { hq: true });
    // Ring 2 um (1,1) auf der Karte: 7 Felder (x oder y = 3) / ring 2 around (1,1) on the map: 7 tiles (x or y = 3)
    levelUp(s, hq);
    expect(cityTiles(s, hq).filter(ring(hq, 2))).toHaveLength(4);
    levelUp(s, hq);
    expect(hq.radius).toBe(2);
    expect(cityTiles(s, hq).filter(ring(hq, 3))).toHaveLength(1);
  });

  it('Kult und Sendetuerme wachsen nicht / cult and towers do not grow', () => {
    const s = blankGame({ size: 14, factions: ['vesper', 'korvat'] });
    const hq = addCity(s, 4, 4, 0, { hq: true });
    addCity(s, 11, 11, 1, { hq: true });
    s.factions[0].stars = 1000;
    expect(applyCommand(s, { type: 'buyLevel', city: hq.id }).ok).toBe(false);
    expect(cityTiles(s, hq)).toHaveLength(9);
  });

  it('erobert: neutrale Siedlung neu mit 3x3, Fraktionsstadt behaelt ihr Gebiet / captured: neutral village anew with 3x3, faction city keeps its territory', () => {
    const { s, hq } = growGame();
    for (let i = 0; i < 6; i++) levelUp(s, hq);
    const n = cityTiles(s, hq).length;
    expect(n).toBe(9 + 24);
    const u = addUnit(s, 'infantry', 1, hq.x, hq.y);
    s.current = 1;
    ok(s, { type: 'capture', unit: u.id });
    expect(hq.owner).toBe(1);
    expect(cityTiles(s, hq)).toHaveLength(n);
    expect(hq.radius).toBe(2);
  });
});

describe('Grenzerweiterung (Stufe 4) / border expansion (level 4)', () => {
  it('ganzer Ring bis mindestens 5x5, mit Radius 2 bis 7x7 / a full ring up to at least 5x5, with radius 2 up to 7x7', () => {
    const { s, hq } = growGame();
    for (let i = 0; i < 2; i++) levelUp(s, hq);
    // Stufe 4: 12 Felder im Ring 2 vom Wachstum, die Erweiterung schliesst ihn / level 4: 12 ring-2 tiles from growth, the expansion closes it
    levelUp(s, hq, true);
    expect(hq.level).toBe(4);
    expect(hq.radius).toBe(2);
    expect(cityTiles(s, hq)).toHaveLength(25);

    const b = blankGame({ size: 16 });
    const c = addCity(b, 8, 8, 0, { hq: true, radius: 2, level: 3 });
    addCity(b, 14, 14, 1, { hq: true });
    expect(expandRadius(c)).toBe(3);
    levelUp(b, c, true);
    expect(c.radius).toBe(3);
    expect(cityTiles(b, c)).toHaveLength(49);
  });

  it('schon 7x7: Sterne statt Grenzerweiterung, nie kleiner / already 7x7: stars instead of the expansion, never smaller', () => {
    const b = blankGame({ size: 16 });
    const c = addCity(b, 8, 8, 0, { hq: true, radius: 3, level: 3 });
    addCity(b, 14, 14, 1, { hq: true });
    expect(expandRadius(c)).toBe(3);
    expect(rewardOptions(c, 4)).toEqual(['stars', 'population']);
    b.factions[0].stars = 1000;
    ok(b, { type: 'buyLevel', city: c.id });
    const before = b.factions[0].stars;
    ok(b, { type: 'reward', city: c.id, choice: 'a' });
    expect(b.factions[0].stars).toBe(before + CITY.rewardStars);
    expect(c.radius).toBe(3);
    // KI waehlt dann Bevoelkerung / the AI then picks population
    b.factions[0].human = false;
    expect(chooseReward(buildCtx(b, 0), c, 4)).toBe('b');
  });
});

describe('Bewegung / movement', () => {
  it('schnelle Infanterie 2, schwere 1, Panzer 3, Jeep 4 / fast infantry 2, heavy 1, tanks 3, jeep 4', () => {
    for (const t of ['infantry', 'grey', 'zealot', 'android', 'cyborg', 'sniper', 'lightWarden', 'railSniper', 'medic'] as const) expect(UNITS[t].move, t).toBe(2);
    for (const t of ['mg', 'stormbreaker', 'peacekeeper', 'antiTank', 'pioneer', 'mineLayer', 'torchbearer', 'prophet', 'faustZealot'] as const) expect(UNITS[t].move, t).toBe(1);
    for (const t of ['tank', 'teslaTank', 'reliquary', 'steppeColossus', 'flameTank'] as const) expect(UNITS[t].move, t).toBe(3);
    expect(UNITS.jeep.move).toBe(4);
  });
});
