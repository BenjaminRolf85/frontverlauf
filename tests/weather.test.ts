import { describe, expect, it } from 'vitest';
import { attackTargets, effectiveMove, effectiveRange, reachable, weather, weatherFor } from '../src/core';
import { WEATHER } from '../src/data/balance';
import { addCity, addUnit, blankGame, revealAll } from './helpers';

/** Seed und Runde mit gewuenschtem Wetter finden / find seed and round with the wanted weather */
function roundWith(seed: number, w: string): number {
  for (let r = 2; r < 400; r++) if (weatherFor(seed, r) === w) return r;
  throw new Error('no round');
}

function g() {
  const s = blankGame({ stars: 0, weather: true });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 10, 10, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Wetter / weather', () => {
  it('ist deterministisch, Runde 1 klar, wechselt in Bloecken / deterministic, round 1 clear, changes in blocks', () => {
    expect(weatherFor(5, 1)).toBe('clear');
    for (let r = 2; r < 60; r++) expect(weatherFor(5, r)).toBe(weatherFor(5, r));
    for (let r = 2; r < 60; r++) {
      const block = Math.floor((r - 1) / WEATHER.cycleRounds);
      const first = block * WEATHER.cycleRounds + 1;
      if (first >= 2) expect(weatherFor(9, r)).toBe(weatherFor(9, first));
    }
    const all = new Set(Array.from({ length: 300 }, (_, i) => weatherFor(3, i + 2)));
    expect([...all].sort()).toEqual(['clear', 'rain', 'snow', 'wind']);
  });

  it('Regen: Artillerie 1 Feld weniger Reichweite / rain: artillery range -1', () => {
    const s = g();
    s.round = roundWith(s.config.seed, 'rain');
    expect(weather(s)).toBe('rain');
    const art = addUnit(s, 'artillery', 0, 5, 5);
    const far = addUnit(s, 'infantry', 1, 8, 5);
    const near = addUnit(s, 'infantry', 1, 7, 5);
    expect(effectiveRange(s, art)).toBe(2);
    const ids = attackTargets(s, art).map((u) => u.id);
    expect(ids).toContain(near.id);
    expect(ids).not.toContain(far.id);
    s.round = roundWith(s.config.seed, 'clear');
    expect(attackTargets(s, art).map((u) => u.id)).toContain(far.id);
  });

  it('Regen: Hubschrauber 1 Feld weniger Bewegung / rain: helicopter movement -1', () => {
    const s = g();
    s.factions[0].techs.push('armyAviation');
    const heli = addUnit(s, 'heli', 0, 5, 5);
    s.round = roundWith(s.config.seed, 'rain');
    expect(effectiveMove(s, heli)).toBe(2);
    const maxD = Math.max(...reachable(s, heli).map((p) => Math.max(Math.abs(p.x - 5), Math.abs(p.y - 5))));
    expect(maxD).toBe(2);
    s.round = roundWith(s.config.seed, 'clear');
    expect(effectiveMove(s, heli)).toBe(3);
  });

  it('Schnee und Wind aendern keine Werte / snow and wind change no values', () => {
    const s = g();
    const art = addUnit(s, 'artillery', 0, 5, 5);
    for (const w of ['snow', 'wind']) {
      s.round = roundWith(s.config.seed, w);
      expect(effectiveRange(s, art)).toBe(3);
    }
  });
});
