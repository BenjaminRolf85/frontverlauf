import { describe, expect, it } from 'vitest';
import { canSeeUnit, reachable, visionRadius, createGame, defaultConfig, hqOf } from '../src/core';
import { VISION } from '../src/data/balance';
import { addCity, addUnit, blankGame, explored, fails, ok, revealAll, setTerrain, untilTurnOf } from './helpers';

function mv() {
  const s = blankGame();
  addCity(s, 0, 0, 0, { hq: true });
  addCity(s, 10, 10, 1, { hq: true });
  return s;
}
const keys = (r: { x: number; y: number }[]) => r.map((p) => `${p.x},${p.y}`).sort();

describe('Bewegung / movement', () => {
  it('infantry moves 1 tile (8 neighbours), jeep 2', () => {
    const s = mv();
    const i = addUnit(s, 'infantry', 0, 5, 5);
    expect(reachable(s, i)).toHaveLength(8);
    const j = addUnit(s, 'jeep', 0, 2, 5);
    const r = keys(reachable(s, j));
    expect(r).toContain('4,5');
    expect(r).not.toContain('5,5'); // eigene Einheit, kein Endfeld / own unit, no end tile
    expect(r).not.toContain('2,8');
  });

  it('a unit moves once per turn', () => {
    const s = mv();
    const i = addUnit(s, 'jeep', 0, 5, 5);
    ok(s, { type: 'move', unit: i.id, to: { x: 6, y: 5 } });
    fails(s, { type: 'move', unit: i.id, to: { x: 7, y: 5 } }, 'unreachable');
  });

  it('entering forest or mountain ends the movement, except on a road', () => {
    const s = mv();
    s.factions[0].techs.push('mountainTraining');
    setTerrain(s, 5, 5, 'forest');
    setTerrain(s, 5, 4, 'forest');
    setTerrain(s, 5, 6, 'forest');
    const j = addUnit(s, 'jeep', 0, 4, 5);
    const r = keys(reachable(s, j));
    expect(r).toContain('5,5');
    // hinter dem Wald nur ueber freie Felder / behind forest only via open tiles
    expect(r).not.toContain('6,5');
    setTerrain(s, 5, 4, 'mountain');
    setTerrain(s, 5, 6, 'mountain');
    expect(keys(reachable(s, j))).not.toContain('6,5');
    // Strasse im Wald: kein Halt / road in forest: no stop
    setTerrain(s, 5, 5, 'forest', { road: true });
    expect(keys(reachable(s, j))).toContain('6,5');
  });

  it('roads halve the movement cost', () => {
    const s = mv();
    const i = addUnit(s, 'infantry', 0, 3, 5);
    for (const x of [3, 4, 5]) setTerrain(s, x, 5, 'plain', { road: true });
    const r = reachable(s, i);
    expect(r.find((p) => p.x === 5 && p.y === 5)?.cost).toBe(1);
    expect(r.find((p) => p.x === 4 && p.y === 5)?.cost).toBe(0.5);
    expect(keys(r)).not.toContain('6,5');
    ok(s, { type: 'move', unit: i.id, to: { x: 5, y: 5 } });
  });

  it('mountains need mountain training', () => {
    const s = mv();
    setTerrain(s, 6, 5, 'mountain');
    const i = addUnit(s, 'infantry', 0, 5, 5);
    expect(keys(reachable(s, i))).not.toContain('6,5');
    fails(s, { type: 'move', unit: i.id, to: { x: 6, y: 5 } }, 'unreachable');
    s.factions[0].techs.push('mountainTraining');
    ok(s, { type: 'move', unit: i.id, to: { x: 6, y: 5 } });
  });

  it('land units cannot enter water', () => {
    const s = mv();
    setTerrain(s, 6, 5, 'shallow');
    setTerrain(s, 4, 5, 'ocean');
    const i = addUnit(s, 'infantry', 0, 5, 5);
    const r = keys(reachable(s, i));
    expect(r).not.toContain('6,5');
    expect(r).not.toContain('4,5');
  });

  it('zone of control: entering a tile next to an enemy stops the unit', () => {
    const s = mv();
    revealAll(s, 0);
    const j = addUnit(s, 'jeep', 0, 3, 5);
    addUnit(s, 'infantry', 1, 5, 3);
    const r = keys(reachable(s, j));
    // (4,4) liegt neben dem Gegner -> (5,5) ueber (4,4) nicht, aber ueber (4,5) / (4,4) is adjacent to the enemy
    expect(r).toContain('4,4');
    expect(r).not.toContain('5,3');
    const s2 = mv();
    revealAll(s2, 0);
    const j2 = addUnit(s2, 'jeep', 0, 3, 3);
    addUnit(s2, 'infantry', 1, 5, 3);
    // jede Route zu (5,1) fuehrt durch (4,x) neben dem Gegner / every route to (5,1) passes next to the enemy... check 6,3 unreachable
    expect(keys(reachable(s2, j2))).not.toContain('5,1');
    expect(keys(reachable(s2, j2))).not.toContain('5,5');
  });

  it('zone of control does not apply to factions at peace', () => {
    const s = mv();
    revealAll(s, 0);
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    const j = addUnit(s, 'jeep', 0, 3, 3);
    addUnit(s, 'infantry', 1, 5, 3);
    expect(keys(reachable(s, j))).toContain('5,1');
  });

  it('cannot pass enemy units; may pass own units; one unit per tile', () => {
    const s = mv();
    revealAll(s, 0);
    const j = addUnit(s, 'jeep', 0, 3, 5);
    addUnit(s, 'infantry', 0, 4, 5);
    expect(keys(reachable(s, j))).toContain('5,5');
    expect(keys(reachable(s, j))).not.toContain('4,5');
  });

  it('enemy units block the path', () => {
    const s = mv();
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) if (y !== 5) setTerrain(s, x, y, 'shallow');
    revealAll(s, 0);
    const j = addUnit(s, 'jeep', 0, 3, 5);
    s.factions[1].relations[0] = 'peace'; s.factions[0].relations[1] = 'peace'; // keine ZOC / no ZOC
    addUnit(s, 'infantry', 1, 4, 5);
    expect(keys(reachable(s, j))).toEqual(['1,5', '2,5']);
  });

  it('fresh or exhausted units do not move', () => {
    const s = mv();
    const f = addUnit(s, 'infantry', 0, 5, 5, { fresh: true });
    expect(reachable(s, f)).toHaveLength(0);
    fails(s, { type: 'move', unit: f.id, to: { x: 5, y: 4 } }, 'fresh');
  });

  it('cannot move units of other factions', () => {
    const s = mv();
    const e = addUnit(s, 'infantry', 1, 5, 5);
    fails(s, { type: 'move', unit: e.id, to: { x: 5, y: 4 } }, 'notYourUnit');
    fails(s, { type: 'move', unit: 9999, to: { x: 5, y: 4 } }, 'noUnit');
  });
});

describe('Nebel und Sicht / fog and vision', () => {
  it('units see 1 tile, on a mountain 2 tiles', () => {
    expect(VISION.unit).toBe(1);
    expect(VISION.mountain).toBe(2);
    const s = mv();
    s.factions[0].techs.push('mountainTraining');
    const i = addUnit(s, 'infantry', 0, 5, 5);
    expect(visionRadius(s, i)).toBe(1);
    ok(s, { type: 'move', unit: i.id, to: { x: 6, y: 5 } });
    expect(explored(s, 0, 7, 5)).toBe(true);
    expect(explored(s, 0, 8, 5)).toBe(false);
    untilTurnOf(s, 0);
    setTerrain(s, 7, 5, 'mountain');
    ok(s, { type: 'move', unit: i.id, to: { x: 7, y: 5 } });
    expect(explored(s, 0, 9, 5)).toBe(true);
    expect(explored(s, 0, 9, 7)).toBe(true);
    expect(explored(s, 0, 10, 5)).toBe(false);
  });

  it('path tiles reveal with the vision of their own terrain', () => {
    const s = mv();
    s.factions[0].techs.push('mountainTraining');
    for (const x of [4, 5, 6]) setTerrain(s, x, 5, 'plain', { road: true });
    setTerrain(s, 6, 5, 'mountain', { road: true });
    const i = addUnit(s, 'infantry', 0, 4, 5);
    ok(s, { type: 'move', unit: i.id, to: { x: 6, y: 5 } });
    expect(explored(s, 0, 8, 5)).toBe(true); // vom Berg / from the mountain
    // Durchgangsfeld (5,5) ist Ebene: sieht nur 1 weit / the plain path tile (5,5) sees only 1
    expect(explored(s, 0, 3, 7)).toBe(false);
  });

  it('cities reveal their area plus 1 at start, explored tiles stay visible', () => {
    const s = createGame(defaultConfig({ seed: 11 }));
    const hq = hqOf(s, 0)!;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = hq.x + dx, y = hq.y + dy;
      if (x >= 0 && y >= 0 && x < s.size && y < s.size) expect(explored(s, 0, x, y)).toBe(true);
    }
    const before = s.factions[0].explored.slice();
    const u = s.units.find((o) => o.owner === 0)!;
    const r = reachable(s, u);
    ok(s, { type: 'move', unit: u.id, to: r[0] });
    s.factions[0].explored.forEach((e, k) => { if (before[k]) expect(e).toBe(1); });
  });

  it('units on unexplored tiles are not visible', () => {
    const s = mv();
    const e = addUnit(s, 'infantry', 1, 5, 5);
    expect(canSeeUnit(s, 0, e)).toBe(false);
    revealAll(s, 0);
    expect(canSeeUnit(s, 0, e)).toBe(true);
  });

  it('invisible spy is only seen from an adjacent tile', () => {
    const s = mv();
    revealAll(s, 0);
    const spy = addUnit(s, 'spy', 1, 5, 5);
    const watcher = addUnit(s, 'infantry', 0, 7, 5);
    expect(canSeeUnit(s, 0, spy)).toBe(false);
    watcher.x = 6;
    expect(canSeeUnit(s, 0, spy)).toBe(true);
  });

  it('submerged submarine is only seen from an adjacent tile, but surfaces after attacking', () => {
    const s = mv();
    revealAll(s, 0); revealAll(s, 1);
    for (let x = 0; x < 11; x++) setTerrain(s, x, 6, 'shallow');
    const sub = addUnit(s, 'submarine', 1, 5, 6);
    const watcher = addUnit(s, 'infantry', 0, 3, 5);
    expect(canSeeUnit(s, 0, sub)).toBe(false);
    s.current = 1;
    ok(s, { type: 'attack', unit: sub.id, target: watcher.id });
    expect(canSeeUnit(s, 0, s.units.find((u) => u.id === sub.id)!)).toBe(true);
  });
});
