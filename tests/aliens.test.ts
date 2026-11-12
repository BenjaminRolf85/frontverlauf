import { describe, expect, it } from 'vitest';
import { combatPreview, createGame, defaultConfig, defenseBonus, healAmount, reachable, score, trainCheck } from '../src/core';
import { DEFENSE_BONUS, HEALING, UNITS, XENO } from '../src/data/balance';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile, untilTurnOf } from './helpers';

function g(stars = 100) {
  const s = blankGame({ stars, factions: ['zyrr', 'korvat'] });
  const hq = addCity(s, 2, 2, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return { s, hq };
}

describe('Zyrr: Start und Forschung / start and research', () => {
  it('starten ohne Technologie, mit Laser-Alien und terraformtem Hauptquartier / start without tech, with grey and terraformed HQ', () => {
    const s = createGame(defaultConfig({ seed: 3, size: 14, factions: [{ id: 'zyrr', human: true, difficulty: 'normal' }, { id: 'velkar', human: false, difficulty: 'normal' }] }));
    expect(s.factions[0].techs).toEqual([]);
    expect(s.units.find((u) => u.owner === 0)!.type).toBe(XENO.startUnit);
    const hq = s.cities.find((c) => c.owner === 0)!;
    expect(s.tiles[hq.y * s.size + hq.x].xeno).toBe(true);
  });
  it('koennen nicht forschen / cannot research', () => {
    const { s } = g();
    fails(s, { type: 'research', tech: 'motorization' }, 'noResearch');
  });
});

describe('Zyrr: Einheiten / units', () => {
  it('bilden nur Alien-Einheiten aus, Menschen nie Alien-Einheiten / train only alien units, humans never', () => {
    const { s, hq } = g();
    s.tiles[hq.y * s.size + hq.x].xeno = true;
    expect(trainCheck(s, hq, 'infantry')).toBe('invalid');
    expect(trainCheck(s, hq, 'mech')).toBe('ok');
    ok(s, { type: 'train', city: hq.id, unitType: 'tripod' });
    expect(s.factions[0].stars).toBe(100 - UNITS.tripod.cost!);
    const human = s.cities.find((c) => c.owner === 1)!;
    expect(trainCheck(s, human, 'grey')).toBe('invalid');
  });
  it('alle Alien-Einheiten sind teurer als ihr menschliches Gegenstueck / alien units cost more', () => {
    expect(UNITS.grey.cost!).toBeGreaterThan(UNITS.infantry.cost!);
    expect(UNITS.skimmer.cost!).toBeLessThan(UNITS.heli.cost!); // kein Sprit, aber schwaecher / no fuel but weaker
    expect(UNITS.tripod.cost!).toBeGreaterThan(UNITS.artillery.cost!);
  });
  it('Ausbildung nur in terraformten Staedten / training only in terraformed cities', () => {
    const { s, hq } = g();
    s.tiles[hq.y * s.size + hq.x].xeno = false;
    expect(trainCheck(s, hq, 'grey')).toBe('invalid');
    ok(s, { type: 'terraform', x: hq.x, y: hq.y });
    expect(trainCheck(s, hq, 'grey')).toBe('ok');
  });
  it('Laeufer gehen ohne Technologie ins Gebirge / walkers enter mountains without tech', () => {
    const { s } = g();
    setTerrain(s, 6, 5, 'mountain');
    const m = addUnit(s, 'mech', 0, 5, 5);
    expect(reachable(s, m).some((r) => r.x === 6 && r.y === 5)).toBe(true);
  });
  it('Todesstrahl ignoriert Deckung / death ray ignores cover', () => {
    const { s } = g();
    s.factions[1].techs.push('camouflage');
    setTerrain(s, 6, 5, 'forest');
    const def = addUnit(s, 'infantry', 1, 6, 5);
    expect(defenseBonus(s, def)).toBe(DEFENSE_BONUS.terrainWithTech);
    const tri = addUnit(s, 'tripod', 0, 4, 5);
    const mech = addUnit(s, 'mech', 0, 5, 6);
    // gleiche Formel, aber Bonus 1,0 / same formula but bonus 1.0
    const p = combatPreview(s, tri, def);
    const expected = Math.round((4.5 / (4.5 + 2)) * 4.5 * 4.5);
    expect(p.toDefender).toBe(expected);
    expect(combatPreview(s, mech, def).toDefender).toBeLessThan(Math.round((4 / (4 + 2)) * 4 * 4.5));
  });
});

describe('Zyrr: Terraformen / terraforming', () => {
  it('per Sterne im eigenen Gebiet / by stars in own territory', () => {
    const { s } = g(20);
    ok(s, { type: 'terraform', x: 3, y: 3 });
    expect(tile(s, 3, 3).xeno).toBe(true);
    expect(s.factions[0].stars).toBe(20 - XENO.terraformCost);
    fails(s, { type: 'terraform', x: 6, y: 6 }, 'notInTerritory');
    fails(s, { type: 'terraform', x: 3, y: 3 }, 'alreadyBuilt');
  });
  it('per Terraformer kostenlos auch ausserhalb, verbraucht den Zug / by terraformer for free also outside, consumes the turn', () => {
    const { s } = g(0);
    const tf = addUnit(s, 'terraformer', 0, 6, 6);
    ok(s, { type: 'terraform', x: 7, y: 6, unit: tf.id });
    expect(tile(s, 7, 6).xeno).toBe(true);
    fails(s, { type: 'terraform', x: 6, y: 6, unit: tf.id });
  });
  it('Menschen koennen nicht terraformen / humans cannot terraform', () => {
    const { s } = g();
    endTurn(s); untilTurnOf(s, 1);
    fails(s, { type: 'terraform', x: 9, y: 8 }, 'wrongFaction');
  });
  it('Xeno-Boden: Deckung und Heilung fuer Alien-Einheiten / xeno ground: cover and healing for alien units', () => {
    const { s } = g();
    tile(s, 5, 5).xeno = true;
    const grey = addUnit(s, 'grey', 0, 5, 5, { hp: 3 });
    expect(defenseBonus(s, grey)).toBe(XENO.groundDefense);
    expect(healAmount(s, grey)).toBe(HEALING.elsewhere + XENO.groundHeal);
    const inf = addUnit(s, 'infantry', 1, 5, 5 + 1);
    tile(s, 5, 6).xeno = true;
    expect(defenseBonus(s, inf)).toBe(DEFENSE_BONUS.open);
  });
  it('Xeno-Gebaeude nur fuer Zyrr und nur auf Xeno-Boden / xeno buildings only for Zyrr and only on xeno ground', () => {
    const { s } = g();
    fails(s, { type: 'build', building: 'xenoHive', x: 3, y: 2 });
    ok(s, { type: 'terraform', x: 3, y: 2 });
    ok(s, { type: 'build', building: 'xenoHive', x: 3, y: 2 });
    tile(s, 1, 2).resource = 'ore'; tile(s, 1, 2).terrain = 'mountain';
    ok(s, { type: 'terraform', x: 1, y: 2 });
    ok(s, { type: 'build', building: 'xenoHarvester', x: 1, y: 2 });
    fails(s, { type: 'build', building: 'storehouse', x: 2, y: 3 });
  });
  it('terraformte Felder im Gebiet bringen Punkte / terraformed tiles in territory give points', () => {
    const { s } = g();
    const before = score(s, 0);
    ok(s, { type: 'terraform', x: 3, y: 3 });
    expect(score(s, 0)).toBe(before + XENO.tilePoints);
  });
});

describe('Zyrr: Bunker / bunker', () => {
  it('Bunker-Technologie wird fuer Zyrr zu Sternen / bunker tech becomes stars for the Zyrr', () => {
    for (let seed = 1; seed < 60; seed++) {
      const { s } = g(0);
      s.rng = seed;
      tile(s, 5, 5).feature = 'bunker';
      const u = addUnit(s, 'grey', 0, 4, 5);
      ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 5 } });
      expect(s.factions[0].techs).toEqual([]);
    }
  });
});
