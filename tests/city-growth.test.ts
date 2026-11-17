/**
 * Stadtwachstum je Stufe, weniger Siedlungen, Sendetuerme in freien Partien, schnellere Einheiten.
 * City growth per level, fewer settlements, transmitter towers in free games, faster units.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, defaultConfig, dist, generateMap, towerCountFor, type GameConfig, type GameState } from '../src/core';
import { planNextCommand } from '../src/ai/ai';
import { AI, MAPGEN, MAP_SIZES, TOWER, type FactionId, type MapType } from '../src/data/balance';
import { TUTORIAL_CONFIG } from '../src/ui/tutorial';

const FOUR: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon'];

describe('Weniger Siedlungen / fewer settlements', () => {
  it('30 % weniger neutrale Siedlungen, Heimatsiedlungen bleiben / 30 % fewer neutral settlements, home villages stay', () => {
    expect(MAPGEN.villageShare).toBe(0.7);
    for (const type of ['continent', 'lakes', 'continents'] as MapType[]) {
      let now = 0, before = 0;
      for (const size of MAP_SIZES) for (const seed of [1, 2, 3, 4]) {
        const m = generateMap(seed * 17 + size, size, type, FOUR);
        // vorher: alle platzierten Siedlungen bleiben / before: all placed settlements stay
        const share = MAPGEN.villageShare;
        MAPGEN.villageShare = 1;
        let o;
        try { o = generateMap(seed * 17 + size, size, type, FOUR); } finally { MAPGEN.villageShare = share; }
        // jede Startinsel hat ihre Heimatsiedlung, dieselbe wie vorher / every start island keeps its home village, the same as before
        expect(m.villages.length).toBeGreaterThanOrEqual(m.starts.length);
        expect(m.villages.slice(0, m.starts.length)).toEqual(o.villages.slice(0, m.starts.length));
        expect(m.villages.length).toBe(Math.max(m.starts.length, Math.round(o.villages.length * 0.7)));
        now += m.villages.length; before += o.villages.length;
      }
      // insgesamt etwa 30 % weniger (Heimatsiedlungen als Untergrenze) / about 30 % fewer in total (home villages as the floor)
      expect(now / before, type).toBeGreaterThan(0.65);
      expect(now / before, type).toBeLessThan(0.75);
    }
  });
});

const towers = (s: GameState) => s.cities.filter((c) => c.tower);
const freeGame = (seed: number, size: GameConfig['size'], mapType: MapType, mode: GameConfig['mode'] = 'conquest', ids: FactionId[] = ['vesper', 'korvat', 'dravon']) =>
  createGame(defaultConfig({ seed, size, mapType, mode, factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));

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
