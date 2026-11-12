/** Deterministischer Seed-Generator (mulberry32) / deterministic seeded generator (mulberry32). */
export function nextRandom(state: { rng: number }): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state: { rng: number }, maxExclusive: number): number {
  return Math.floor(nextRandom(state) * maxExclusive);
}

export function pick<T>(state: { rng: number }, list: readonly T[]): T {
  return list[randInt(state, list.length)];
}

export function shuffle<T>(state: { rng: number }, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Text-Seed zu Zahl / text seed to number */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
