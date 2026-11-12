import { describe, expect, it } from 'vitest';
import { score, unitScore } from '../src/core';
import { SCORE, UNITS, type UnitTypeId } from '../src/data/balance';
import { addCity, addUnit, blankGame } from './helpers';

function sg() {
  const s = blankGame({ factions: ['korvat', 'dravon'] });
  // Fraktion 0 hat nur die Starttechnologie Viehwirtschaft (Stufe 1) / only the start tech (tier 1)
  return s;
}

describe('Punkte / score table', () => {
  it('values of the spec', () => {
    expect(SCORE).toMatchObject({
      revealedTile: 5, territoryTile: 20, cityLevel: 50, techPerTier: 100, tankUnit: 50, researchCenterBase: 100,
      researchCenterStep: 50, researchCenterInterval: 3, researchCenterMax: 300, govQuarter: 250, grandProject: 400,
    });
  });

  it('empty faction: only researched technology (100 per tier)', () => {
    const s = sg();
    expect(score(s, 0)).toBe(100);
    s.factions[0].techs.push('roadbuilding' as never, 'logistics' as never);
    expect(score(s, 0)).toBe(100 + 200 + 300);
  });

  it('5 per revealed tile', () => {
    const s = sg();
    for (let i = 0; i < 7; i++) s.factions[0].explored[i] = 1;
    expect(score(s, 0)).toBe(100 + 35);
  });

  it('20 per tile of own city area and 50 per city level', () => {
    const s = sg();
    addCity(s, 5, 5, 0, { level: 3 });
    expect(score(s, 0)).toBe(100 + 9 * 20 + 3 * 50);
    addCity(s, 0, 0, 0, { level: 1 }); // Ecke: 4 Felder / corner: 4 tiles
    expect(score(s, 0)).toBe(100 + 9 * 20 + 150 + 4 * 20 + 50);
    // neutrale Siedlungen zaehlen nicht / neutral settlements do not count
    addCity(s, 9, 9, null);
    expect(score(s, 0)).toBe(100 + 9 * 20 + 150 + 4 * 20 + 50);
  });

  it('units: 1 per star of their base price, tank 50', () => {
    const types: UnitTypeId[] = ['infantry', 'sniper', 'jeep', 'pioneer', 'mg', 'medic', 'artillery', 'spy', 'heli'];
    for (const t of types) {
      const s = sg();
      addUnit(s, t, 0, 5, 5);
      expect(score(s, 0) - 100).toBe(UNITS[t].cost);
    }
    const s = sg();
    addUnit(s, 'tank', 0, 5, 5);
    expect(score(s, 0)).toBe(150);
    // Grundpreis, nicht der Rabattpreis (Korvat-Infanterie kostet 8) / base price, not the discounted one
    const k = sg();
    expect(unitScore(addUnit(k, 'infantry', 0, 1, 1))).toBe(10);
  });

  it('government quarter 250, grand project 400, research centre 100+', () => {
    const s = sg();
    const c = addCity(s, 5, 5, 0);
    const base = score(s, 0);
    c.govQuarter = true;
    expect(score(s, 0)).toBe(base + 250);
    s.factions[0].grandProjectsBuilt.push('stateBank');
    expect(score(s, 0)).toBe(base + 650);
    const t = s.tiles[4 * s.size + 4];
    t.building = 'researchCenter'; t.researchBuilt = s.round;
    expect(score(s, 0)).toBe(base + 750);
    s.round += 3;
    expect(score(s, 0)).toBe(base + 800);
  });
});
