import { expect, it } from 'vitest';
import { createGame, defaultConfig } from '../src/core';
import { playAiTurn } from '../src/ai/ai';

it('KI kauft Stadt-Ausbauten / AI buys city upgrades', () => {
  const s = createGame(defaultConfig({ seed: 3, size: 14, factions: [{ id: 'korvat', human: false, difficulty: 'hard' }, { id: 'velkar', human: false, difficulty: 'hard' }, { id: 'dravon', human: false, difficulty: 'normal' }] }));
  for (let i = 0; i < 90 && !s.over; i++) playAiTurn(s);
  expect(s.cities.flatMap((c) => c.upgrades ?? []).length).toBeGreaterThan(0);
}, 120000);
