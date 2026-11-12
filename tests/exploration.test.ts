import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, defaultConfig, cloneState, type GameState, type CommandResult } from '../src/core';
import type { BunkerReward } from '../src/data/balance';
import { BUNKER, TECHS } from '../src/data/balance';
import { addCity, addUnit, blankGame, explored, ok, setTerrain, tile, unit } from './helpers';

function bunkerGame(water = false) {
  const s = blankGame({ stars: 0 });
  const hq = addCity(s, 1, 1, 0, { hq: true, level: 9 });
  addCity(s, 9, 9, 1, { hq: true });
  if (water) {
    for (let y = 3; y < 8; y++) for (let x = 5; x < 9; x++) setTerrain(s, x, y, 'shallow');
    tile(s, 6, 5).feature = 'bunker';
    addUnit(s, 'heli', 0, 4, 5);
  } else {
    tile(s, 6, 5).feature = 'bunker';
    addUnit(s, 'infantry', 0, 5, 5);
  }
  return { s, hq };
}

/** Sucht einen RNG-Zustand, der diese Belohnung liefert / finds an rng state that yields this reward */
function enterBunker(reward: BunkerReward, water = false): { s: GameState; r: CommandResult; hq: ReturnType<typeof addCity> } {
  const base = bunkerGame(water);
  const u = base.s.units.find((o) => o.owner === 0)!;
  for (let k = 0; k < 5000; k++) {
    const s = cloneState(base.s);
    s.rng = k;
    const r = applyCommand(s, { type: 'move', unit: u.id, to: { x: 6, y: 5 } });
    expect(r.ok).toBe(true);
    const ev = r.events.find((e) => e.t === 'bunker');
    if (ev && ev.t === 'bunker' && ev.reward === reward) return { s, r, hq: s.cities.find((c) => c.id === base.hq.id)! };
  }
  throw new Error('reward not found: ' + reward);
}

describe('Verlassener Bunker / abandoned bunker', () => {
  it('50 stars', () => {
    const { s } = enterBunker('stars');
    expect(BUNKER.stars).toBe(50);
    expect(s.factions[0].stars).toBe(50);
  });

  it('a free technology (lowest available tier)', () => {
    const { s } = enterBunker('tech');
    const techs = s.factions[0].techs;
    expect(techs).toHaveLength(2);
    const t = techs[1];
    expect(TECHS[t].tier).toBe(1);
    expect(s.factions[0].stars).toBe(0);
  });

  it('3 population points for the HQ', () => {
    const { hq } = enterBunker('population');
    expect(hq.pop).toBe(3);
  });

  it('an MG infantry with veteran status', () => {
    const { s } = enterBunker('veteranMg');
    const mg = s.units.find((u) => u.type === 'mg')!;
    expect(mg.owner).toBe(0);
    expect(mg.veteran).toBe(true);
    expect(mg.maxHp).toBe(20);
    expect(mg.hp).toBe(20);
    expect(Math.max(Math.abs(mg.x - 6), Math.abs(mg.y - 5))).toBe(1);
  });

  it('revealing the surroundings', () => {
    const { s } = enterBunker('reveal');
    expect(explored(s, 0, 9, 8)).toBe(true);
    expect(explored(s, 0, 3, 2)).toBe(true);
    expect(explored(s, 0, 10, 5)).toBe(false);
  });

  it('a bunker in the water can yield a destroyer instead', () => {
    const { s } = enterBunker('destroyer', true);
    const d = s.units.find((u) => u.type === 'destroyer')!;
    expect(d.owner).toBe(0);
    expect(d.carried).toBe('infantry');
    expect(tile(s, d.x, d.y).terrain).toBe('shallow');
  });

  it('land bunkers never yield a destroyer; every reward type occurs', () => {
    const seen = new Set<string>();
    const base = bunkerGame();
    const u = base.s.units.find((o) => o.owner === 0)!;
    for (let k = 0; k < 300; k++) {
      const s = cloneState(base.s);
      s.rng = k * 7919;
      const r = applyCommand(s, { type: 'move', unit: u.id, to: { x: 6, y: 5 } });
      const ev = r.events.find((e) => e.t === 'bunker');
      if (ev && ev.t === 'bunker') seen.add(ev.reward);
    }
    expect([...seen].sort()).toEqual(['population', 'reveal', 'stars', 'tech', 'veteranMg']);
  });

  it('the reward is one-time: the bunker is gone after the first unit', () => {
    const { s } = enterBunker('stars');
    expect(tile(s, 6, 5).feature).toBeNull();
    const inf = s.units.find((o) => o.owner === 0 && o.type === 'infantry')!;
    expect(s.bunkerRewardsTaken).toBe(1);
    const u2 = addUnit(s, 'infantry', 0, 7, 5);
    const me = unit(s, inf.id)!;
    me.x = 5; me.y = 7;
    const r = ok(s, { type: 'move', unit: u2.id, to: { x: 6, y: 5 } });
    expect(r.events.some((e) => e.t === 'bunker')).toBe(false);
    expect(s.factions[0].stars).toBe(50);
  });
});

describe('Radarstationen / radar stations', () => {
  it('stand in all four corners of every generated map', () => {
    for (const size of [11, 14, 16, 18] as const) {
      const s = createGame(defaultConfig({ seed: size, size }));
      const corners = [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]];
      expect(s.radars.map((r) => [r.x, r.y])).toEqual(corners);
      for (const [x, y] of corners) expect(tile(s, x, y).feature).toBe('radar');
    }
  });

  it('revealing a radar station discovers it; all four unlock the satellite centre', () => {
    const s = blankGame({ stars: 0 });
    addCity(s, 5, 5, 0, { hq: true });
    addCity(s, 5, 9, 1, { hq: true });
    for (const r of s.radars) tile(s, r.x, r.y).feature = 'radar';
    const u = addUnit(s, 'infantry', 0, 2, 1);
    const r = ok(s, { type: 'move', unit: u.id, to: { x: 1, y: 1 } });
    expect(r.events.find((e) => e.t === 'radar')).toMatchObject({ index: 0, faction: 0 });
    expect(s.factions[0].radarsFound).toEqual([0]);
    expect(s.factions[0].grandProjectsUnlocked).not.toContain('satelliteCenter');
    const placements: [number, number, number, number][] = [[9, 1, 9, 0], [1, 9, 0, 9], [9, 9, 10, 10]];
    for (const [x, y, tx, ty] of placements) {
      const v = addUnit(s, 'infantry', 0, x, y);
      ok(s, { type: 'move', unit: v.id, to: { x: tx, y: ty } });
    }
    expect([...s.factions[0].radarsFound].sort()).toEqual([0, 1, 2, 3]);
    expect(s.factions[0].grandProjectsUnlocked).toContain('satelliteCenter');
  });
});
