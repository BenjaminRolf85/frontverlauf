import { describe, expect, it } from 'vitest';
import { buildCheck, combatPreview, computePower, createGame, defaultConfig, recruitCheck, trainCheck } from '../src/core';
import { UNITS } from '../src/data/balance';
import { playAiTurn } from '../src/ai/ai';
import { addCity, addUnit, blankGame, fails, ok, revealAll, setTerrain, tile } from './helpers';

function g(factions: ['vesper' | 'nexus', 'korvat'], stars = 200) {
  const s = blankGame({ stars, factions });
  const hq = addCity(s, 2, 2, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return { s, hq };
}

describe('Kult der Letzten Stunde / Cult of the Final Hour', () => {
  it('startet mit Eiferer und forscht normal / starts with a zealot and researches', () => {
    const s = createGame(defaultConfig({ seed: 4, size: 14, factions: [{ id: 'vesper', human: true, difficulty: 'normal' }, { id: 'korvat', human: false, difficulty: 'normal' }] }));
    expect(s.units.find((u) => u.owner === 0)!.type).toBe('zealot');
    s.factions[0].stars = 50;
    ok(s, { type: 'research', tech: 'motorization' });
  });
  it('rekrutiert nicht in Staedten, sondern neben Predigern / recruits next to preachers, not in cities', () => {
    const { s, hq } = g(['vesper', 'korvat']);
    expect(trainCheck(s, hq, 'zealot')).toBe('cultRecruit');
    fails(s, { type: 'train', city: hq.id, unitType: 'zealot' }, 'cultRecruit');
    const z = addUnit(s, 'zealot', 0, 5, 5);
    expect(recruitCheck(s, 0, z.id, 'zealot', 5, 7)).toBe('outOfRange');
    expect(recruitCheck(s, 0, z.id, 'torchbearer', 5, 6)).toBe('techMissing');
    expect(recruitCheck(s, 0, z.id, 'infantry', 5, 6)).toBe('invalid');
    ok(s, { type: 'recruit', unit: z.id, unitType: 'zealot', x: 5, y: 6 });
    const n = s.units.find((u) => u.x === 5 && u.y === 6)!;
    expect(n.type).toBe('zealot');
    expect(n.homeCity).toBe(hq.id);
    expect(s.factions[0].stars).toBe(200 - UNITS.zealot.cost!);
    // Prediger ist erschoepft, Rekrut ist frisch / preacher is exhausted, recruit is fresh
    fails(s, { type: 'recruit', unit: z.id, unitType: 'zealot', x: 4, y: 5 }, 'unitExhausted');
    expect(recruitCheck(s, 0, n.id, 'zealot', 5, 7)).toBe('unitExhausted');
  });
  it('Nicht-Prediger und andere Fraktionen koennen nicht rekrutieren / non-preachers and others cannot recruit', () => {
    const { s } = g(['vesper', 'korvat']);
    const b = addUnit(s, 'doomBuggy', 0, 5, 5);
    expect(recruitCheck(s, 0, b.id, 'zealot', 5, 6)).toBe('notPreacher');
    const inf = addUnit(s, 'infantry', 1, 8, 8);
    expect(recruitCheck(s, 1, inf.id, 'zealot', 8, 7)).toBe('invalid');
  });
  it('Flammen ignorieren Deckung / flames ignore cover', () => {
    const { s } = g(['vesper', 'korvat']);
    setTerrain(s, 6, 5, 'forest');
    const t = addUnit(s, 'torchbearer', 0, 5, 5);
    const z = addUnit(s, 'zealot', 0, 5, 6);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    s.factions[1].techs.push('forestry');
    const burn = combatPreview(s, t, d);
    const plain = combatPreview(s, z, d);
    expect(burn.toDefender / UNITS.torchbearer.attack).toBeGreaterThan(plain.toDefender / UNITS.zealot.attack);
  });
  it('Schrein nur fuer den Kult / shrine only for the cult', () => {
    const { s } = g(['vesper', 'korvat']);
    expect(buildCheck(s, 0, 'shrine', 2, 3).ok).toBe(true);
    const human = s.cities.find((c) => c.owner === 1)!;
    expect(buildCheck(s, 1, 'shrine', human.x, human.y + 1).ok).toBe(false);
  });
});

describe('KI-Kollektiv NEXUS', () => {
  it('forscht nicht und startet mit Android / no research, starts with an android', () => {
    const s = createGame(defaultConfig({ seed: 6, size: 14, factions: [{ id: 'nexus', human: true, difficulty: 'normal' }, { id: 'korvat', human: false, difficulty: 'normal' }] }));
    expect(s.factions[0].techs).toEqual([]);
    expect(s.units.find((u) => u.owner === 0)!.type).toBe('android');
    fails(s, { type: 'research', tech: 'motorization' }, 'noResearch');
  });
  it('Rechenleistung aus Rechenzentrum plus Kraftwerk schaltet Einheiten frei / compute unlocks units', () => {
    const { s, hq } = g(['nexus', 'korvat']);
    expect(trainCheck(s, hq, 'android')).toBe('ok');
    expect(trainCheck(s, hq, 'spider')).toBe('computeMissing');
    expect(trainCheck(s, hq, 'infantry')).toBe('invalid');
    ok(s, { type: 'build', building: 'dataCenter', x: 2, y: 3 });
    expect(computePower(s, 0)).toBe(0);
    tile(s, 3, 3).resource = 'ore';
    ok(s, { type: 'build', building: 'powerPlant', x: 3, y: 3 });
    expect(computePower(s, 0)).toBe(1);
    expect(trainCheck(s, hq, 'spider')).toBe('ok');
    expect(trainCheck(s, hq, 'quadDrone')).toBe('computeMissing');
    const human = s.cities.find((c) => c.owner === 1)!;
    expect(buildCheck(s, 1, 'dataCenter', human.x, human.y + 1).ok).toBe(false);
  });
});

describe('KI spielt Kult und NEXUS / AI plays cult and NEXUS', () => {
  for (const id of ['vesper', 'nexus'] as const) {
    it(`${id}: volle Punkte-Partie ohne Fehler / full points game`, () => {
      const s = createGame(defaultConfig({ seed: 8, size: 14, mode: 'points', factions: [{ id, human: false, difficulty: 'hard' }, { id: 'korvat', human: false, difficulty: 'normal' }, { id: 'velkar', human: false, difficulty: 'normal' }] }));
      let failedTurns = 0;
      while (!s.over) { const cmds = playAiTurn(s); if (!cmds.length) failedTurns++; }
      const mine = s.units.filter((u) => u.owner === 0).map((u) => u.type);
      const blds = s.tiles.filter((t) => t.building === 'dataCenter' || t.building === 'powerPlant' || t.building === 'shrine').length;
      console.log(`${id}: units ${mine.join(',')} buildings ${blds} techs ${s.factions[0].techs.length} compute ${computePower(s, 0)} cities ${s.cities.filter((c) => c.owner === 0).length}`);
      expect(failedTurns).toBe(0);
      expect(mine.length).toBeGreaterThan(2);
      expect(mine.every((t) => UNITS[t].faction === id || UNITS[t].ship)).toBe(true);
      if (id === 'nexus') { expect(s.factions[0].techs).toEqual([]); expect(computePower(s, 0)).toBeGreaterThan(0); }
    }, 180000);
  }
});
