/** Oeffentliche Schnittstelle des Spielkerns / public API of the game core */
export * from './types';
export * from './queries';
export { applyCommand, createGame, cloneState, continueEndless, defaultConfig, replay } from './rules';
export { generateMap } from './mapgen';
export { hashSeed } from './rng';
export { dist, idx, inBounds, isLand, isWater, neighbors, tileAt, area } from './grid';
export * from './hazards';
export {
  MISSIONS, MISSION_IDS, missionById, missionConfig, objectiveProgress, isHoldObjective, missionRoundsLeft,
  type MissionDef, type ObjectiveDef, type Speaker,
} from './campaign';
export { RANDOM_EVENTS, eventRounds, randomEventFor, nextEventRound, triggerRandomEvent } from './events';
