/**
 * Schlachtfeld-Narben im Bild: reine Hilfsfunktionen fuer Untergrund, Farbmischung und Dichte je Stufe (Tile.scar,
 * src/core/scars.ts). Die Modelle (Stuempfe, Truemmer, Rauch ...) liegen in remains.ts, gezeichnet wird in board.ts.
 * Battlefield scars on screen: pure helpers for ground, colour blending and density per tier (Tile.scar,
 * src/core/scars.ts). The models (stumps, debris, smoke ...) live in remains.ts, drawing happens in board.ts.
 *
 * Stufen / tiers:
 *  1 leicht: nur Krater und Brandflecken / light: craters and scorch marks only
 *  2 mittel: aufgewuehlte, dunklere Erde, groessere Krater, Truemmer, verbranntes Gras, kaputte Zaeune, Strassenschaeden
 *    medium: churned darker earth, larger craters, debris, burnt grass, broken fences, damaged roads
 *  3 schwer: verwuestetes Land, Baumstuempfe statt Wald, Granattrichter, Rauchfahnen nach frischem Kampf, kein Gras
 *    heavy: devastated land, tree stumps instead of forest, shell holes, smoke after fresh fighting, no grass
 */
import * as THREE from 'three';
import type { BiomeId, TerrainId } from '../data/balance';
import type { ScarTier } from '../core';
import { hex, semantic } from '../design/tokens';

/** Untergrund fuer die Narbenfarbe / ground for the scar colour */
export type ScarGround = 'earth' | 'snow' | 'sand' | 'alien' | 'cave' | 'rock' | 'water';

/** Anteil der Narbenfarbe an der Oberseite je Stufe (Stufe 1 bleibt unverfaerbt) / share of the scar colour on the top per tier (tier 1 keeps its colour) */
export const SCAR_TINT: readonly number[] = [0, 0, 0.36, 0.62];
/** Groesse der Krater je Stufe / crater size per tier */
export const SCAR_MARK_SCALE: readonly number[] = [1, 1.1, 1.25, 1.4];

/**
 * Untergrund eines Feldes: Wasser, Hoehle, Alienwelt, Wueste, Schnee (Wetter oder Tundra), Fels oder Erde.
 * Ground of a tile: water, cavern, alien world, desert, snow (weather or tundra), rock or earth.
 */
export function scarGround(terrain: TerrainId, biome: BiomeId | undefined, theme: string | null, snowy: boolean): ScarGround {
  if (terrain === 'shallow' || terrain === 'ocean') return 'water';
  if (theme === 'cavern') return 'cave';
  if (theme === 'alien') return 'alien';
  if (theme === 'desert' || biome === 'desert') return 'sand';
  if (snowy || biome === 'tundra') return 'snow';
  if (terrain === 'mountain') return 'rock';
  return 'earth';
}

/** Zielfarben mittel / schwer je Untergrund / medium / heavy target colours per ground */
const TARGET: Record<Exclude<ScarGround, 'water'>, [string, string]> = {
  earth: [semantic.battleChurned, semantic.battleDevastated],
  snow: [semantic.battleSnowChurned, semantic.battleSnowDevastated],
  sand: [semantic.battleSandChurned, semantic.battleSandDevastated],
  alien: [semantic.battleAlienDevastated, semantic.battleAlienDevastated],
  cave: [semantic.battleCaveDevastated, semantic.battleCaveDevastated],
  rock: [semantic.battleRockDevastated, semantic.battleRockDevastated],
};
/** Fels und Fremdboden faerben schwaecher (Lesbarkeit des Gelaendes) / rock and alien ground tint less (terrain readability) */
const GROUND_FACTOR: Record<ScarGround, number> = { earth: 1, snow: 1, sand: 0.9, alien: 0.7, cave: 0.7, rock: 0.45, water: 0 };

const ca = new THREE.Color(), cb = new THREE.Color();
/** Farbmischung als Hex-Text / colour blend as hex text */
export function mixColor(a: string, b: string, t: number): string {
  ca.setHex(hex(a)); cb.setHex(hex(b));
  return `#${ca.lerp(cb, Math.min(1, Math.max(0, t))).getHexString()}`;
}

/**
 * Ober- und Seitenfarbe eines vernarbten Feldes; Wasser und Stufe 0/1 bleiben unveraendert.
 * Top and side colour of a scarred tile; water and tier 0/1 stay unchanged.
 */
export function scarColors(c: { top: string; side: string }, tier: ScarTier, ground: ScarGround): { top: string; side: string } {
  const f = SCAR_TINT[tier] * GROUND_FACTOR[ground];
  if (f <= 0 || ground === 'water') return c;
  const target = TARGET[ground][tier >= 3 ? 1 : 0];
  return { top: mixColor(c.top, target, f), side: tier >= 3 ? mixColor(c.side, target, f * 0.3) : c.side };
}

/**
 * Stufe fuer den Schluessel der Feldgeometrie: nur Stufen mit eigener Farbe (2, 3), sonst 0 (teilt die Geometrie).
 * Tier for the tile geometry key: only tiers with their own colour (2, 3), else 0 (shares the geometry).
 */
export function scarKeyTier(tier: ScarTier, ground: ScarGround): ScarTier {
  return SCAR_TINT[tier] * GROUND_FACTOR[ground] > 0 ? tier : 0;
}

/**
 * Rauchfahnen nur nach frischem schwerem Kampf / smoke wisps only after fresh heavy fighting.
 */
export function scarSmokes(tier: ScarTier, lastRound: number | undefined, round: number, keep: number): boolean {
  return tier >= 3 && lastRound !== undefined && round - lastRound <= keep;
}
