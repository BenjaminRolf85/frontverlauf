import { expect, it } from 'vitest';
import { createGame, defaultConfig } from '../src/core';
import { playAiTurn } from '../src/ai/ai';

it('KI kauft Stadt-Ausbauten / AI buys city upgrades', () => {
  // mehrere Partien: seit den Produktionsstaetten konkurrieren Ausbauten mit den Werken / several games: since production sites, upgrades compete with the works
  let upgrades = 0;
  for (const seed of [3, 4, 5, 6]) {
    const s = createGame(defaultConfig({ seed, size: 14, factions: [{ id: 'korvat', human: false, difficulty: 'hard' }, { id: 'velkar', human: false, difficulty: 'hard' }, { id: 'dravon', human: false, difficulty: 'normal' }] }));
    for (let i = 0; i < 90 && !s.over; i++) playAiTurn(s);
    upgrades += s.cities.flatMap((c) => c.upgrades ?? []).length;
  }
  expect(upgrades).toBeGreaterThan(0);
}, 240000);
