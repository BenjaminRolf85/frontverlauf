/**
 * Einheitenrollen: jeder Einheitentyp gehoert zu genau einer Rolle, jede Rolle hat ein Symbol (icons.ts). Gleiche Rolle =
 * gleiches Symbol ueber alle Fraktionen, damit man es einmal lernt: auf der LP-Plakette ueber der Einheit, in der
 * Kaufleiste, im Einheitenfeld und in der Legende der Regeln. Die Rolle folgt der Aufgabe im Kampf (Faehigkeiten,
 * Reichweite), nicht dem Modell.
 * Unit roles: every unit type belongs to exactly one role, every role has one icon (icons.ts). Same role = same icon
 * across all factions so it is learnt once: on the HP badge above the unit, in the shop strip, in the unit panel and in
 * the legend of the rules. The role follows the job in combat (abilities, range), not the model.
 */
import type { UnitTypeId } from '../data/balance';
import type { IconName } from './icons';

/** Rollen in der Reihenfolge der Legende / roles in legend order */
export const UNIT_ROLES = [
  'infantry', 'sniper', 'mg', 'antiTank', 'flame', 'medic', 'engineer', 'spy', 'commando', 'scientist',
  'artillery', 'tank', 'walker', 'antiAir', 'mines', 'recon', 'radar', 'air', 'kamikaze',
  'transport', 'submarine', 'warship', 'battleship', 'wonder', 'boss',
] as const;
export type UnitRole = (typeof UNIT_ROLES)[number];

/** Symbol je Rolle, alle verschieden / icon per role, all different */
export const ROLE_ICON: Record<UnitRole, IconName> = {
  infantry: 'roleInfantry', sniper: 'roleSniper', mg: 'roleMg', antiTank: 'roleAntiTank', flame: 'fire', medic: 'roleMedic',
  engineer: 'roleEngineer', spy: 'roleSpy', commando: 'roleCommando', scientist: 'roleScientist',
  artillery: 'roleArtillery', tank: 'roleTank', walker: 'roleWalker', antiAir: 'roleAntiAir', mines: 'roleMine',
  recon: 'roleRecon', radar: 'roleRadar', air: 'roleAir', kamikaze: 'roleKamikaze',
  transport: 'roleTransport', submarine: 'roleSubmarine', warship: 'roleWarship', battleship: 'roleBattleship',
  wonder: 'roleWonder', boss: 'roleBoss',
};

/**
 * Rolle je Einheitentyp (vollstaendig: der Typ Record verlangt jeden UnitTypeId).
 * Role per unit type (complete: the Record type demands every UnitTypeId).
 */
export const UNIT_ROLE: Record<UnitTypeId, UnitRole> = {
  // Linieninfanterie aller Fraktionen, auch Reiter, Ordenswacht und Sturmbrecher (Fusstruppen im Nahkampf)
  // line infantry of every faction, also riders, Order Guard and Stormbreakers (foot troops in close combat)
  infantry: 'infantry', lightWarden: 'infantry', grey: 'infantry', zealot: 'infantry', android: 'infantry', cyborg: 'infantry',
  steppeRider: 'infantry', peacekeeper: 'infantry', stormbreaker: 'infantry',
  sniper: 'sniper', railSniper: 'sniper',
  mg: 'mg',
  antiTank: 'antiTank', faustZealot: 'antiTank',
  // Flammen (Faehigkeit burn: ignoriert Deckung) / flames (ability burn: ignores cover)
  torchbearer: 'flame', flameTank: 'flame',
  medic: 'medic', prophet: 'medic',
  pioneer: 'engineer', terraformer: 'engineer',
  spy: 'spy',
  shadowCommando: 'commando',
  scientist: 'scientist',
  // Fernkampf ohne Gegenschlag ab Reichweite 3 / ranged fire without retaliation from range 3
  artillery: 'artillery', rocketCart: 'artillery', railgun: 'artillery', sunLance: 'artillery',
  tank: 'tank', teslaTank: 'tank', reliquary: 'tank', steppeColossus: 'tank', doomCrawler: 'tank',
  // schwere Laeufer / heavy walkers
  mech: 'walker', tripod: 'walker', titan: 'walker', spider: 'walker', protoWalker: 'walker',
  antiAir: 'antiAir', flakDrone: 'antiAir',
  mineLayer: 'mines',
  jeep: 'recon', doomBuggy: 'recon',
  radarTruck: 'radar',
  heli: 'air', octocopter: 'air', skimmer: 'air', quadDrone: 'air',
  // explodiert beim Angriff / explodes when attacking
  kamikazeDrone: 'kamikaze', guidedMissile: 'kamikaze',
  landingBoat: 'transport', fogCutter: 'transport',
  submarine: 'submarine',
  destroyer: 'warship', privateer: 'warship',
  battleship: 'battleship',
  portal: 'wonder', hackRelay: 'wonder', fusionPlant: 'wonder', waal: 'wonder', coreDrill: 'wonder',
  swarmMother: 'boss',
};

/** Symbol eines Einheitentyps / icon of a unit type */
export const unitRoleIcon = (type: UnitTypeId): IconName => ROLE_ICON[UNIT_ROLE[type]];
