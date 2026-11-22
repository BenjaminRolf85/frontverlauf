/** Oeffentliche Schnittstelle des Spielkerns / public API of the game core */
export * from './types';
export * from './queries';
export * from './emplacements';
export * from './facing';
export { applyCommand, createGame, cloneState, continueEndless, defaultConfig, replay } from './rules';
export { assignBaseKinds, generateMap } from './mapgen';
export { towerCountFor } from './towers';
export { hashSeed } from './rng';
export { dist, idx, inBounds, isLand, isWater, neighbors, tileAt, area } from './grid';
export * from './hazards';
export * from './history';
export * from './orbital';
// Goettlicher Funke (Alvenia) / Divine Spark (Alvenia)
export * from './divineSpark';
// Schlachtfeld-Narben (optisch) / battlefield scars (visual)
export * from './scars';
// Kriegsplaene und Fanatiker-Tempel (m4) / war plans and Fanatic temple (m4)
export * from './temple';
export {
  MISSIONS, MISSION_IDS, missionById, missionConfig, objectiveProgress, isHoldObjective, missionRoundsLeft,
  CAMPAIGN_FACTIONS, CAMPAIGN_ENEMIES, CAMPAIGN_ALLIES, CAMPAIGN_REV, FINALE_ID, allyFor, isCampaignFaction, isCampaignAlly, panelOf,
  UNPLACED_MISSIONS, worldNumber, missionNumber, riftSpares, towerCount, towersHeld, outdatedCampaign, missionStarts, rivalsFor, swarmHolds,
  type MissionDef, type ObjectiveDef, type Speaker, type BriefPanel, type WaveDef,
} from './campaign';
export { WORLDS, worldOf, type WorldId } from './worlds';
export * from './mothership';
export { RANDOM_EVENTS, eventRounds, randomEventFor, nextEventRound, triggerRandomEvent } from './events';
export * from './shadowFleet';
// Schwebende Akademie (Velkar) / floating academy (Velkar)
export * from './academy';
// Hacken der NEXUS: Fernuebernahme und Hackturm / NEXUS hacking: remote takeover and hack tower
export * from './hacking';
