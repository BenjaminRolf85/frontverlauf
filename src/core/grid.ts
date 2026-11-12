import type { GameState, Pos, Tile } from './types';

export const idx = (size: number, x: number, y: number) => y * size + x;
export const inBounds = (size: number, x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size;
export const tileAt = (s: GameState, x: number, y: number): Tile | undefined =>
  inBounds(s.size, x, y) ? s.tiles[idx(s.size, x, y)] : undefined;

/** Schachbrett-Distanz (8 Nachbarn) / Chebyshev distance (8 neighbours) */
export const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const DIRS: Pos[] = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
];

export function neighbors(size: number, x: number, y: number): Pos[] {
  const out: Pos[] = [];
  for (const d of DIRS) {
    const nx = x + d.x, ny = y + d.y;
    if (inBounds(size, nx, ny)) out.push({ x: nx, y: ny });
  }
  return out;
}

export function area(size: number, x: number, y: number, r: number): Pos[] {
  const out: Pos[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(size, nx, ny)) out.push({ x: nx, y: ny });
    }
  }
  return out;
}

export const isWater = (t: Tile) => t.terrain === 'shallow' || t.terrain === 'ocean';
export const isLand = (t: Tile) => !isWater(t);
