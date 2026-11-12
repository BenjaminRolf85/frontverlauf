import { expect, it } from 'vitest';
import { createGame, defaultConfig } from '../src/core';
import { playAiTurn } from '../src/ai/ai';

it('KI spielt die Zyrr: terraformt, baut, bildet aus, ohne Fehler / AI plays the Zyrr', () => {
  const s = createGame(defaultConfig({ seed: 5, size: 14, mode: 'points', factions: [{ id: 'zyrr', human: false, difficulty: 'hard' }, { id: 'korvat', human: false, difficulty: 'normal' }, { id: 'velkar', human: false, difficulty: 'normal' }] }));
  let failedTurns = 0;
  while (!s.over) { const cmds = playAiTurn(s); if (!cmds.length) failedTurns++; }
  const xeno = s.tiles.filter((t) => t.xeno).length;
  const aliens = s.units.filter((u) => u.owner === 0).map((u) => u.type);
  const hives = s.tiles.filter((t) => t.building === 'xenoHive' || t.building === 'xenoHarvester').length;
  console.log(`xeno ${xeno} hives ${hives} units ${aliens.join(',')} cities ${s.cities.filter((c) => c.owner === 0).length} winner ${s.winner}`);
  expect(failedTurns).toBe(0);
  expect(xeno).toBeGreaterThan(9);
  expect(s.factions[0].techs).toEqual([]);
  expect(aliens.every((t) => ['grey', 'terraformer', 'skimmer', 'mech', 'tripod'].includes(t) || t === 'landingBoat')).toBe(true);
}, 180000);
