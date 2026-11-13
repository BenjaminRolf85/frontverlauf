import { describe, expect, it } from 'vitest';
import { createGame, defaultConfig, defenseBonus, erupts, reachable, roundsToEruption } from '../src/core';
import { CRASH, JUNGLE, TECHS, TECH_IDS, VOLCANO } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, ok, revealAll, setTerrain, tile, untilTurnOf } from './helpers';

function g() {
  const s = blankGame({ stars: 50, factions: ['korvat', 'dravon'] });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Kartenbesonderheiten / map gimmicks', () => {
  it('erzeugt Vulkane, Absturzstellen, Wracks und Dschungel nur auf Wunsch / generated only when enabled', () => {
    const none = createGame(defaultConfig({ seed: 4, size: 22, hazards: 'none' }));
    expect(none.tiles.some((t) => t.volcano || t.feature === 'crashSite' || t.biome === 'jungle' || t.remains)).toBe(false);
    const many = createGame(defaultConfig({ seed: 4, size: 22, hazards: 'many' }));
    expect(many.tiles.some((t) => t.volcano)).toBe(true);
    expect(many.tiles.some((t) => t.feature === 'crashSite')).toBe(true);
    expect(many.tiles.some((t) => t.feature === 'labRuin')).toBe(true);
    expect(many.tiles.filter((t) => t.remains?.kind === 'wreck').length).toBeGreaterThan(3);
    expect(many.tiles.some((t) => t.biome === 'jungle')).toBe(true);
    // gleicher Seed, gleiche Karte / same seed, same map
    const again = createGame(defaultConfig({ seed: 4, size: 22, hazards: 'many' }));
    expect(again.tiles.map((t) => `${t.volcano}${t.feature}${t.biome}`)).toEqual(many.tiles.map((t) => `${t.volcano}${t.feature}${t.biome}`));
  });

  it('Vulkan bricht regelmaessig aus, beschaedigt Einheiten und sperrt die Felder / volcano erupts, damages units, blocks tiles', () => {
    const s = g();
    setTerrain(s, 5, 5, 'mountain'); tile(s, 5, 5).volcano = true;
    const n = roundsToEruption(5, 5, s.round);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(erupts(5, 5, s.round + n)).toBe(true);
    const u = addUnit(s, 'infantry', 0, 5, 6);
    // bis zur Ausbruchsrunde spielen / play until the eruption round
    while (s.round < s.round + n && !erupts(5, 5, s.round)) { endTurn(s); untilTurnOf(s, 0); }
    expect(tile(s, 5, 6).lava).toBeGreaterThanOrEqual(s.round);
    expect(u.hp).toBe(10 - VOLCANO.damage);
    const other = addUnit(s, 'infantry', 0, 3, 6);
    expect(reachable(s, other).some((p) => p.x === 4 && p.y === 6)).toBe(false);
    expect(reachable(s, other).some((p) => p.x === 4 && p.y === 5)).toBe(false); // Nachbarfeld brennt / adjacent tile burns
  });

  it('Dschungel: Fahrzeuge nur als ersten Schritt, Fusstruppen haben Deckung / jungle: vehicles only first step, foot troops get cover', () => {
    const s = g();
    for (const [x, y] of [[5, 5], [6, 5]]) setTerrain(s, x, y, 'forest', { biome: 'jungle' });
    const jeep = addUnit(s, 'jeep', 0, 3, 5);
    s.factions[0].techs.push('motorization');
    expect(reachable(s, jeep).some((p) => p.x === 5 && p.y === 5)).toBe(false); // zweiter Schritt / second step
    const jeep2 = addUnit(s, 'jeep', 0, 4, 4);
    expect(reachable(s, jeep2).some((p) => p.x === 5 && p.y === 5)).toBe(true); // erster Schritt / first step
    const inf = addUnit(s, 'infantry', 1, 6, 5);
    expect(defenseBonus(s, inf)).toBeGreaterThanOrEqual(JUNGLE.footDefense);
  });

  it('Absturzstelle und Forschungseinrichtung: Gratis-Technologie bis Stufe 3, Deckung / free tech up to tier 3, cover', () => {
    for (const feature of ['crashSite', 'labRuin'] as const) {
      const s = g();
      setTerrain(s, 4, 4, 'plain', { feature });
      const u = addUnit(s, 'infantry', 0, 3, 4);
      const techs = s.factions[0].techs.length, stars = s.factions[0].stars;
      ok(s, { type: 'move', unit: u.id, to: { x: 4, y: 4 } });
      expect(s.factions[0].techs.length).toBe(techs + 1);
      expect(TECHS[s.factions[0].techs[s.factions[0].techs.length - 1]].tier).toBeLessThanOrEqual(CRASH.maxTier);
      expect(s.factions[0].stars).toBe(stars);
      expect(tile(s, 4, 4).looted).toBe(true);
      expect(defenseBonus(s, u)).toBeGreaterThan(1);
      // zweites Betreten bringt nichts / a second visit gives nothing
      const v = addUnit(s, 'infantry', 0, 5, 5);
      u.x = 3; u.y = 3;
      ok(s, { type: 'move', unit: v.id, to: { x: 4, y: 4 } });
      expect(s.factions[0].techs.length).toBe(techs + 1);
    }
  });

  it('ohne erforschbare Technologie gibt es Sterne / without a researchable tech it gives stars', () => {
    const s = blankGame({ stars: 10, factions: ['nexus', 'korvat'] });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    setTerrain(s, 4, 4, 'plain', { feature: 'labRuin' });
    const u = addUnit(s, 'android', 0, 3, 4);
    ok(s, { type: 'move', unit: u.id, to: { x: 4, y: 4 } });
    expect(s.factions[0].stars).toBe(10 + CRASH.stars);
    // alle Technologien bekannt: Sterne / all techs known: stars
    const h = g();
    h.factions[0].techs = [...TECH_IDS];
    setTerrain(h, 4, 4, 'plain', { feature: 'crashSite' });
    const w = addUnit(h, 'infantry', 0, 3, 4);
    const st = h.factions[0].stars;
    ok(h, { type: 'move', unit: w.id, to: { x: 4, y: 4 } });
    expect(h.factions[0].stars).toBe(st + CRASH.stars);
  });
});
