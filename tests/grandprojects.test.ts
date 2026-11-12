import { describe, expect, it } from 'vitest';
import { grandProjectCheck, grandProjectConditionMet, score } from '../src/core';
import { GRAND_PROJECTS, GRAND_PROJECT_IDS, TECH_IDS } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, untilTurnOf } from './helpers';

function gg() {
  const s = blankGame({ stars: 0 });
  const hq = addCity(s, 2, 2, 0, { hq: true, level: 20 });
  addCity(s, 9, 9, 1, { hq: true });
  return { s, hq };
}

describe('Grossprojekte / grand projects', () => {
  it('seven projects with the spec values', () => {
    expect(GRAND_PROJECT_IDS).toHaveLength(7);
    expect(GRAND_PROJECTS).toMatchObject({ pop: 3, points: 400, peaceRounds: 5, bankStars: 500, kills: 10, connectedCities: 5, palaceLevel: 5 });
  });

  it('peace monument: nobody attacked for 5 rounds', () => {
    const { s } = gg();
    s.factions[0].lastAttackRound = s.round;
    expect(grandProjectConditionMet(s, 0, 'peaceMonument')).toBe(false);
    s.round += 4;
    expect(grandProjectConditionMet(s, 0, 'peaceMonument')).toBe(false);
    s.round += 1;
    expect(grandProjectConditionMet(s, 0, 'peaceMonument')).toBe(true);
    // ein Angriff setzt zurueck / an attack resets
    revealAll(s, 0);
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    s.factions[0].grandProjectsUnlocked = [];
    const r0 = s.round;
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect(s.factions[0].lastAttackRound).toBe(r0);
    expect(grandProjectConditionMet(s, 0, 'peaceMonument')).toBe(false);
  });

  it('state bank: 500 stars saved', () => {
    const { s } = gg();
    s.factions[0].stars = 499;
    expect(grandProjectConditionMet(s, 0, 'stateBank')).toBe(false);
    s.factions[0].stars = 500;
    expect(grandProjectConditionMet(s, 0, 'stateBank')).toBe(true);
  });

  it('victory column: 10 enemy units destroyed', () => {
    const { s } = gg();
    revealAll(s, 0);
    const a = addUnit(s, 'tank', 0, 5, 5);
    for (let i = 0; i < 10; i++) {
      expect(s.factions[0].grandProjectsUnlocked).not.toContain('victoryColumn');
      const d = addUnit(s, 'infantry', 1, 6, 5, { hp: 1 });
      const me = s.units.find((u) => u.id === a.id)!;
      me.attacked = false; me.exhausted = false;
      ok(s, { type: 'attack', unit: a.id, target: d.id });
    }
    expect(s.factions[0].kills).toBe(10);
    expect(s.factions[0].grandProjectsUnlocked).toContain('victoryColumn');
  });

  it('world trade centre: 5 cities connected to the HQ', () => {
    const { s } = gg();
    for (let i = 0; i < 5; i++) {
      const c = addCity(s, 0, 0, 0);
      c.connected = i < 4;
      // Position ist fuer die Bedingung unerheblich / position is irrelevant for the condition
    }
    expect(grandProjectConditionMet(s, 0, 'worldTradeCenter')).toBe(false);
    s.cities.filter((c) => c.owner === 0).forEach((c) => { if (!c.isHQ) c.connected = true; });
    expect(grandProjectConditionMet(s, 0, 'worldTradeCenter')).toBe(true);
  });

  it('government palace: a city brought to level 5', () => {
    const { s, hq } = gg();
    hq.level = 4;
    expect(grandProjectConditionMet(s, 0, 'governmentPalace')).toBe(false);
    hq.level = 5;
    expect(grandProjectConditionMet(s, 0, 'governmentPalace')).toBe(true);
  });

  it('academy: all technologies researched', () => {
    const { s } = gg();
    s.factions[0].techs = TECH_IDS.slice(0, 24);
    expect(grandProjectConditionMet(s, 0, 'academy')).toBe(false);
    s.factions[0].techs = TECH_IDS.slice();
    expect(grandProjectConditionMet(s, 0, 'academy')).toBe(true);
  });

  it('satellite centre: all four radar stations found', () => {
    const { s } = gg();
    s.factions[0].radarsFound = [0, 1, 2];
    expect(grandProjectConditionMet(s, 0, 'satelliteCenter')).toBe(false);
    s.factions[0].radarsFound = [0, 1, 2, 3];
    expect(grandProjectConditionMet(s, 0, 'satelliteCenter')).toBe(true);
  });

  it('unlocked automatically, free, 3 population and 400 points, once per faction', () => {
    const { s, hq } = gg();
    s.factions[0].stars = 500;
    fails(s, { type: 'grandProject', id: 'stateBank', x: 3, y: 3 }, 'notUnlocked');
    endTurn(s);
    untilTurnOf(s, 0);
    expect(s.factions[0].grandProjectsUnlocked).toContain('stateBank');
    const stars = s.factions[0].stars;
    const sc = score(s, 0);
    const r = ok(s, { type: 'grandProject', id: 'stateBank', x: 3, y: 3 });
    expect(r.events.some((e) => e.t === 'grandProject')).toBe(true);
    expect(s.factions[0].stars).toBe(stars);
    expect(hq.pop).toBe(3);
    expect(s.tiles[3 * s.size + 3].grandProject).toBe('stateBank');
    expect(score(s, 0)).toBe(sc + 400);
    fails(s, { type: 'grandProject', id: 'stateBank', x: 1, y: 1 }, 'notUnlocked');
    // eigene Fraktion unabhaengig / each faction separately
    expect(s.factions[1].grandProjectsBuilt).toEqual([]);
  });

  it('must be placed on a free land tile in own territory', () => {
    const { s } = gg();
    s.factions[0].grandProjectsUnlocked.push('academy');
    expect(grandProjectCheck(s, 0, 'academy', 6, 6)).toBe(false);
    expect(grandProjectCheck(s, 0, 'academy', 2, 2)).toBe(false); // Stadtfeld / city tile
    setTerrain(s, 1, 1, 'shallow');
    expect(grandProjectCheck(s, 0, 'academy', 1, 1)).toBe(false);
    expect(grandProjectCheck(s, 0, 'academy', 3, 1)).toBe(true);
  });
});
