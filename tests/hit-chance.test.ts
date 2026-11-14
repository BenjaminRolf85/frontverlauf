import { describe, expect, it } from 'vitest';
import { combatPreview, hitOdds, hitRace, rollHit, type GameEvent } from '../src/core';
import { HIT, HIT_KINDS } from '../src/data/balance';
import { addUnit, blankGame, ok, revealAll } from './helpers';

function duel(weather = false) {
  const s = blankGame({ factions: ['korvat', 'nexus'], hitChance: true, weather });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}
const mean = (o: Record<string, number>) => HIT_KINDS.reduce((a, k) => a + o[k] * HIT.mult[k], 0);

describe('Trefferglueck / hit luck', () => {
  it('odds of every race sum to 1; races follow the unit type', () => {
    for (const odds of Object.values(HIT.odds)) expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(hitRace('infantry')).toBe('human');
    expect(hitRace('grey')).toBe('alien');
    expect(hitRace('android')).toBe('robot');
    expect(hitRace('zealot')).toBe('cult');
  });

  it('aliens crit more and miss more than robots; robots are the most precise', () => {
    const a = HIT.odds.alien, r = HIT.odds.robot, h = HIT.odds.human;
    expect(a.crit).toBeGreaterThan(h.crit);
    expect(a.miss).toBeGreaterThan(h.miss);
    expect(r.miss).toBeLessThan(h.miss);
    expect(r.crit).toBeLessThan(h.crit);
    expect(r.full).toBeGreaterThan(h.full);
  });

  it('bad weather lowers the expected damage; robots are hit less by it', () => {
    const s = duel(true);
    const inf = addUnit(s, 'infantry', 0, 2, 2);
    const bot = addUnit(s, 'android', 1, 4, 4);
    // eine Runde mit Regen suchen / find a rainy round
    const clear = { human: mean(HIT.odds.human), robot: mean(HIT.odds.robot) };
    let found = false;
    for (let r = 2; r < 60 && !found; r++) {
      s.round = r;
      const ho = hitOdds(s, inf);
      if (Math.abs(mean(ho) - clear.human) < 1e-9) continue;
      found = true;
      const dropHuman = clear.human - mean(ho);
      const dropRobot = clear.robot - mean(hitOdds(s, bot));
      expect(dropHuman).toBeGreaterThan(0);
      expect(dropRobot).toBeLessThan(dropHuman);
    }
    expect(found).toBe(true);
  });

  it('rollHit maps random numbers to hit kinds in order', () => {
    const o = { miss: 0.1, graze: 0.1, partial: 0.2, full: 0.5, crit: 0.1 };
    expect(rollHit(o, 0.05)).toBe('miss');
    expect(rollHit(o, 0.15)).toBe('graze');
    expect(rollHit(o, 0.3)).toBe('partial');
    expect(rollHit(o, 0.7)).toBe('full');
    expect(rollHit(o, 0.95)).toBe('crit');
  });

  it('attacks roll a hit kind, apply its factor and report it in the event', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const s = blankGame({ factions: ['korvat', 'dravon'], hitChance: true, seed });
      revealAll(s, 0);
      const a = addUnit(s, 'infantry', 0, 5, 5);
      const d = addUnit(s, 'infantry', 1, 6, 5);
      const pre = combatPreview(s, a, d);
      const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
      const e = r.events.find((x): x is Extract<GameEvent, { t: 'attack' }> => x.t === 'attack')!;
      expect(e.hit).toBeDefined();
      expect(e.dmg).toBe(Math.round(pre.toDefender * HIT.mult[e.hit!]));
      seen.add(e.hit!);
    }
    // ueber viele Partien kommen alle Trefferarten vor / over many games all hit kinds occur
    expect(seen.size).toBe(5);
  });

  it('the preview gives expected damage, range and kill chance', () => {
    const s = duel();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'android', 1, 6, 5);
    d.hp = 3;
    const p = combatPreview(s, a, d);
    expect(p.min).toBe(0);
    expect(p.max).toBe(Math.round(p.toDefender * 1.5));
    expect(p.expected).toBeGreaterThan(0);
    expect(p.expected).toBeLessThan(p.max);
    expect(p.killChance).toBeGreaterThan(0);
    expect(p.killChance).toBeLessThanOrEqual(1);
  });

  it('is off when the setting is off: always a full hit', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], hitChance: false });
    const a = addUnit(s, 'infantry', 0, 5, 5);
    expect(hitOdds(s, a)).toEqual({ miss: 0, graze: 0, partial: 0, full: 1, crit: 0 });
  });
});
