/**
 * Oberwelt der Kampagne: drei Scheibenwelten mit ihren Einsaetzen in Spielreihenfolge.
 * Campaign overworld: three disc worlds with their missions in play order.
 */
export type WorldId = 'earth' | 'alien' | 'forgotten';

export const WORLDS: readonly { id: WorldId; missions: readonly string[] }[] = [
  { id: 'earth', missions: ['m1', 'm2', 'm4', 'm5', 'm6', 'm7', 'm8', 'm3'] },
  { id: 'alien', missions: ['m10', 'm11'] },
  { id: 'forgotten', missions: ['m12', 'm13', 'm14', 'm9'] },
];

/** Welt eines Einsatzes / world of a mission */
export const worldOf = (missionId: string): WorldId =>
  WORLDS.find((w) => w.missions.includes(missionId))?.id ?? 'earth';
