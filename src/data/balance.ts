/**
 * Balancing-Daten / balancing data.
 * Die einzige Datei mit Zahlenwerten fuer die Spielregeln. Der Regelcode liest alles von hier.
 * The single file holding rule numbers. Rule code reads everything from here.
 * Beschreibung / description: BALANCING.md
 */

export type TerrainId = 'plain' | 'forest' | 'mountain' | 'shallow' | 'ocean';
/** Landschaftszonen (rein optisch, Regeln folgen dem Gelaende) / biomes (visual only, rules follow terrain) */
export type BiomeId = 'grassland' | 'hills' | 'desert' | 'steppe' | 'tundra' | 'swamp' | 'jungle';
export const BIOMES: BiomeId[] = ['grassland', 'hills', 'desert', 'steppe', 'tundra', 'swamp'];
export type ResourceId = 'supplies' | 'livestock' | 'fish' | 'farmland' | 'ore';
export type FactionId = 'korvat' | 'dravon' | 'alvenia' | 'meridon' | 'velkar' | 'zyrr' | 'vesper' | 'nexus';
export type LandUnitId =
  | 'infantry' | 'sniper' | 'jeep' | 'pioneer' | 'mg' | 'medic' | 'artillery' | 'spy' | 'heli' | 'tank'
  // Konter-Einheiten / counter units
  | 'antiTank' | 'antiAir' | 'mineLayer';
export type ShipId = 'landingBoat' | 'submarine' | 'destroyer' | 'battleship';
/** Ausserirdische Einheiten (nur Zyrr) / alien units (Zyrr only) */
export type AlienUnitId = 'grey' | 'terraformer' | 'skimmer' | 'mech' | 'tripod';
/** Einheiten des Weltuntergangskults (nur Vesper) / doomsday cult units (Vesper only) */
export type CultUnitId = 'zealot' | 'torchbearer' | 'prophet' | 'doomBuggy' | 'rocketCart' | 'doomCrawler' | 'faustZealot';
/** Robotereinheiten (nur NEXUS) / robot units (NEXUS only) */
export type RobotUnitId = 'android' | 'spider' | 'quadDrone' | 'railgun' | 'titan' | 'flakDrone';
/** Einzigartige Einheiten der fuenf klassischen Fraktionen (je eine) / unique units of the five classic factions (one each) */
export type UniqueUnitId = 'steppeRider' | 'stormbreaker' | 'peacekeeper' | 'privateer' | 'protoWalker';
export type UnitTypeId = LandUnitId | ShipId | AlienUnitId | CultUnitId | RobotUnitId | UniqueUnitId;
export type Ability =
  | 'dash' | 'escape' | 'persist' | 'fortify' | 'heal' | 'convert' | 'noRetaliate' | 'ignoreOutpost'
  | 'invisible' | 'uprising' | 'fly' | 'fuel' | 'submerged' | 'splash' | 'carry' | 'terraform' | 'deathRay' | 'walker' | 'preach' | 'burn' | 'wade'
  // Konter: Flugabwehr-Feuerzone, Minen legen / counters: anti-air fire zone, lay mines
  | 'flak' | 'mines'
  // Einzigartige Einheiten: Sturmangriff ohne Gegenschlag, Selbstheilung, Kaperbeute
  // unique units: shock assault without retaliation, self-repair, prize money
  | 'shock' | 'mend' | 'plunder';
export type TechId =
  | 'motorization' | 'roadbuilding' | 'logistics' | 'aerodynamics' | 'armyAviation'
  | 'supply' | 'agritech' | 'foodIndustry' | 'fortification' | 'intelligence'
  | 'mountainTraining' | 'mining' | 'armsIndustry' | 'highAltitude' | 'cybernetics'
  | 'coastalEconomy' | 'diving' | 'navalArtillery' | 'shipbuilding' | 'coastalDefense'
  | 'livestock' | 'camouflage' | 'fieldResearch' | 'forestry' | 'ballistics';
export type BuildingId =
  | 'storehouse' | 'ranch' | 'fishery' | 'lumberCamp' | 'farm' | 'mine'
  | 'materialsPlant' | 'foodFactory' | 'steelMill' | 'logisticsCenter'
  | 'navalBase' | 'road' | 'bridge' | 'researchCenter'
  | 'xenoHive' | 'xenoHarvester' | 'shrine' | 'dataCenter' | 'powerPlant'
  // Einzigartige Gebaeude der klassischen Fraktionen / unique buildings of the classic factions
  | 'kolkhoz' | 'mercenaryBarracks' | 'embassyPalace' | 'tradingPost' | 'testLab';
export type GrandProjectId =
  | 'peaceMonument' | 'stateBank' | 'victoryColumn' | 'worldTradeCenter' | 'governmentPalace' | 'academy'
  | 'satelliteCenter';
export type MapSize = 11 | 14 | 16 | 18 | 22 | 26;
export type MapType = 'continent' | 'lakes' | 'continents' | 'islands' | 'waterworld';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';
export type GameMode = 'points' | 'conquest' | 'sandbox' | 'endless';

export interface UnitStats {
  cost: number | null; // null = nicht kaeuflich / not purchasable
  hp: number;
  attack: number;
  defense: number;
  move: number;
  range: number; // 0 = kann nicht angreifen / cannot attack
  vision: number;
  abilities: Ability[];
  tech: TechId | null; // null = von Beginn an / available from start
  ship: boolean;
  /** nur fuer diese Fraktion / only for this faction */
  faction?: FactionId;
  /** benoetigte Rechenleistung (NEXUS) / required compute (NEXUS) */
  compute?: number;
  /**
   * Schadensfaktor gegen Zielklassen (Konter, siehe COUNTER) / damage multiplier against target classes (counters, see COUNTER).
   * 2.5 = +150 % gegen diese Klasse, 0.6 = -40 % / 2.5 = +150 % against this class, 0.6 = -40 %.
   */
  bonusVs?: Partial<Record<CounterClass, number>>;
}

/** Zielklassen fuer Konter-Boni / target classes for counter bonuses */
export type CounterClass = 'foot' | 'vehicle' | 'air';
/** Einheitenklasse (Schiffe bekommen nie Konter-Boni) / unit class (ships never receive counter bonuses) */
export type UnitClass = CounterClass | 'ship';

export const UNITS: Record<UnitTypeId, UnitStats> = {
  infantry: { cost: 10, hp: 10, attack: 2, defense: 2, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false },
  sniper: { cost: 15, hp: 10, attack: 2, defense: 1, move: 1, range: 2, vision: 1, abilities: ['dash', 'fortify'], tech: 'camouflage', ship: false },
  jeep: { cost: 15, hp: 10, attack: 2, defense: 1, move: 2, range: 1, vision: 1, abilities: ['dash', 'escape'], tech: 'motorization', ship: false },
  pioneer: { cost: 15, hp: 15, attack: 1, defense: 3, move: 1, range: 1, vision: 1, abilities: ['fortify'], tech: 'fortification', ship: false },
  mg: { cost: 25, hp: 15, attack: 3, defense: 3, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: 'armsIndustry', ship: false },
  medic: { cost: 25, hp: 10, attack: 0, defense: 1, move: 1, range: 1, vision: 1, abilities: ['heal', 'convert'], tech: 'cybernetics', ship: false },
  artillery: { cost: 40, hp: 10, attack: 4, defense: 0, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: 'ballistics', ship: false },
  spy: { cost: 40, hp: 5, attack: 0, defense: 0.5, move: 2, range: 0, vision: 1, abilities: ['invisible', 'uprising'], tech: 'intelligence', ship: false },
  heli: { cost: 50, hp: 10, attack: 3.5, defense: 1, move: 3, range: 1, vision: 1, abilities: ['dash', 'persist', 'fly', 'fuel'], tech: 'armyAviation', ship: false },
  tank: { cost: null, hp: 40, attack: 5, defense: 4, move: 1, range: 1, vision: 1, abilities: ['dash'], tech: null, ship: false },
  // Schiffe: LP kommen von der getragenen Einheit; cost = Aufruestpreis.
  // Ships: HP come from the carried unit; cost = upgrade price.
  landingBoat: { cost: 0, hp: 0, attack: 0, defense: 1, move: 2, range: 0, vision: 1, abilities: ['carry'], tech: 'coastalEconomy', ship: true },
  submarine: { cost: 25, hp: 0, attack: 2, defense: 1, move: 3, range: 2, vision: 2, abilities: ['carry', 'submerged'], tech: 'diving', ship: true },
  destroyer: { cost: 25, hp: 0, attack: 3, defense: 3, move: 3, range: 1, vision: 1, abilities: ['carry', 'dash'], tech: 'shipbuilding', ship: true },
  battleship: { cost: 75, hp: 0, attack: 3, defense: 2, move: 2, range: 3, vision: 1, abilities: ['carry', 'splash'], tech: 'navalArtillery', ship: true },
  // Ausserirdische: keine Forschung, dafuer teurer / aliens: no research, but more expensive
  grey: { cost: 15, hp: 10, attack: 2.5, defense: 1.5, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  terraformer: { cost: 20, hp: 10, attack: 0, defense: 2, move: 1, range: 0, vision: 1, abilities: ['terraform', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  skimmer: { cost: 40, hp: 12, attack: 3, defense: 1, move: 3, range: 1, vision: 2, abilities: ['dash', 'fly'], tech: null, ship: false, faction: 'zyrr' },
  mech: { cost: 45, hp: 30, attack: 4, defense: 3.5, move: 1, range: 1, vision: 1, abilities: ['dash', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  zealot: { cost: 10, hp: 10, attack: 2, defense: 1.5, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify', 'preach'], tech: null, ship: false, faction: 'vesper' },
  torchbearer: { cost: 20, hp: 10, attack: 3.5, defense: 1, move: 1, range: 1, vision: 1, abilities: ['dash', 'burn'], tech: 'forestry', ship: false, faction: 'vesper' },
  prophet: { cost: 30, hp: 10, attack: 0, defense: 1.5, move: 1, range: 1, vision: 2, abilities: ['heal', 'convert', 'preach'], tech: 'camouflage', ship: false, faction: 'vesper' },
  doomBuggy: { cost: 18, hp: 10, attack: 2.5, defense: 1, move: 2, range: 1, vision: 1, abilities: ['dash', 'escape'], tech: 'motorization', ship: false, faction: 'vesper' },
  rocketCart: { cost: 40, hp: 10, attack: 4, defense: 0, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: 'ballistics', ship: false, faction: 'vesper' },
  doomCrawler: { cost: 55, hp: 30, attack: 4, defense: 3, move: 1, range: 1, vision: 1, abilities: ['dash'], tech: 'armsIndustry', ship: false, faction: 'vesper' },
  android: { cost: 12, hp: 10, attack: 2, defense: 2, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false, faction: 'nexus', compute: 0 },
  spider: { cost: 25, hp: 12, attack: 3, defense: 2, move: 1, range: 1, vision: 1, abilities: ['dash', 'walker'], tech: null, ship: false, faction: 'nexus', compute: 1 },
  quadDrone: { cost: 35, hp: 10, attack: 3, defense: 1, move: 3, range: 1, vision: 2, abilities: ['dash', 'fly'], tech: null, ship: false, faction: 'nexus', compute: 2 },
  railgun: { cost: 45, hp: 10, attack: 4.5, defense: 0.5, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: null, ship: false, faction: 'nexus', compute: 3 },
  titan: { cost: 60, hp: 35, attack: 4.5, defense: 3.5, move: 1, range: 1, vision: 1, abilities: ['dash'], tech: null, ship: false, faction: 'nexus', compute: 4 },
  tripod: { cost: 55, hp: 25, attack: 4.5, defense: 2, move: 1, range: 2, vision: 2, abilities: ['deathRay', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  // Konter-Einheiten (Schere-Stein-Papier, siehe COUNTER) / counter units (rock-paper-scissors, see COUNTER)
  // Panzerabwehr-Trupp: muss stehen bleiben (kein Sturm), Reichweite 2, stark gegen Fahrzeuge, schwach gegen Infanterie
  // anti-tank squad: must stand still (no dash), range 2, strong vs vehicles, weak vs infantry
  antiTank: { cost: 20, hp: 10, attack: 2, defense: 1.5, move: 1, range: 2, vision: 1, abilities: ['fortify'], tech: 'armsIndustry', ship: false, bonusVs: { vehicle: 2.5, foot: 0.6 } },
  // Flakpanzer: stark gegen Flieger, Feuerzone trifft Flieger, die daneben ihren Zug beenden / AA vehicle: strong vs flyers, fire zone hits flyers ending their turn next to it
  antiAir: { cost: 30, hp: 15, attack: 2, defense: 2.5, move: 1, range: 2, vision: 2, abilities: ['dash', 'flak'], tech: 'aerodynamics', ship: false, bonusVs: { air: 2, vehicle: 0.6, foot: 0.6 } },
  // Minenleger: legt verdeckte Minen auf Nachbarfelder / mine layer: lays hidden mines on adjacent tiles
  mineLayer: { cost: 25, hp: 12, attack: 1, defense: 2, move: 1, range: 1, vision: 1, abilities: ['mines'], tech: 'fortification', ship: false },
  // Kult: Panzerfaust-Eiferer / cult: rocket zealot
  faustZealot: { cost: 20, hp: 10, attack: 2, defense: 1.5, move: 1, range: 2, vision: 1, abilities: ['fortify'], tech: 'armsIndustry', ship: false, faction: 'vesper', bonusVs: { vehicle: 2.5, foot: 0.6 } },
  // NEXUS: Flak-Drohne (Bodenplattform, fliegt selbst nicht) / NEXUS: flak drone (ground platform, does not fly itself)
  flakDrone: { cost: 30, hp: 12, attack: 2, defense: 2, move: 1, range: 2, vision: 2, abilities: ['dash', 'flak'], tech: null, ship: false, faction: 'nexus', compute: 2, bonusVs: { air: 2, vehicle: 0.6, foot: 0.6 } },
  // Einzigartige Einheiten (siehe UNIQUE) / unique units (see UNIQUE)
  // Korvat: Steppenreiter, billig und schnell, Fusstruppe (kein Fahrzeug) / Steppe Riders, cheap and fast, foot troops (no vehicle)
  steppeRider: { cost: 14, hp: 10, attack: 2, defense: 1, move: 2, range: 1, vision: 1, abilities: ['dash'], tech: 'livestock', ship: false, faction: 'korvat' },
  // Dravon: Sturmbrecher, Angriffe ohne Gegenschlag, aber verwundbar / Stormbreakers, attacks draw no retaliation, but vulnerable
  stormbreaker: { cost: 30, hp: 15, attack: 4, defense: 1.5, move: 1, range: 1, vision: 1, abilities: ['dash', 'shock'], tech: 'mining', ship: false, faction: 'dravon' },
  // Alvenia: Friedenswacht, Verteidiger mit Selbstheilung / Peacekeepers, defenders with self-repair
  peacekeeper: { cost: 20, hp: 15, attack: 2, defense: 3, move: 1, range: 1, vision: 1, abilities: ['fortify', 'mend'], tech: 'fortification', ship: false, faction: 'alvenia' },
  // Meridon: Kaperschiff (Aufruestung wie andere Schiffe), Beute je Abschuss / Privateer (upgrade like other ships), prize per kill
  privateer: { cost: 20, hp: 0, attack: 2.5, defense: 1.5, move: 4, range: 1, vision: 2, abilities: ['carry', 'dash', 'plunder'], tech: 'coastalEconomy', ship: true, faction: 'meridon' },
  // Velkar: Prototyp-Laeufer, Flaechenschaden auf Reichweite 2, teuer / Prototype Walker, splash at range 2, expensive
  protoWalker: { cost: 60, hp: 25, attack: 4, defense: 2.5, move: 1, range: 2, vision: 2, abilities: ['splash', 'walker'], tech: 'cybernetics', ship: false, faction: 'velkar' },
};

/** Einheiten der Zyrr / Zyrr roster */
export const ALIEN_UNITS: AlienUnitId[] = ['grey', 'terraformer', 'skimmer', 'mech', 'tripod'];
export const CULT_UNITS: CultUnitId[] = ['zealot', 'torchbearer', 'prophet', 'doomBuggy', 'rocketCart', 'doomCrawler', 'faustZealot'];
export const ROBOT_UNITS: RobotUnitId[] = ['android', 'spider', 'quadDrone', 'railgun', 'titan', 'flakDrone'];
export const UNIQUE_UNITS: UniqueUnitId[] = ['steppeRider', 'stormbreaker', 'peacekeeper', 'privateer', 'protoWalker'];
export const UNIQUE_BUILDINGS: BuildingId[] = ['kolkhoz', 'mercenaryBarracks', 'embassyPalace', 'tradingPost', 'testLab'];

/**
 * Einzigartige Einheiten und Gebaeude der klassischen Fraktionen.
 * Unique units and buildings of the classic factions.
 */
export const UNIQUE = {
  /** Einheit je Fraktion / unit per faction */
  units: { korvat: 'steppeRider', dravon: 'stormbreaker', alvenia: 'peacekeeper', meridon: 'privateer', velkar: 'protoWalker' } as Partial<Record<FactionId, UniqueUnitId>>,
  /** Gebaeude je Fraktion / building per faction */
  buildings: { korvat: 'kolkhoz', dravon: 'mercenaryBarracks', alvenia: 'embassyPalace', meridon: 'tradingPost', velkar: 'testLab' } as Partial<Record<FactionId, BuildingId>>,
  /** Selbstheilung zu Beginn des eigenen Zuges / self-repair at the start of the own turn */
  mendHp: 2,
  /** Kaperbeute je vernichteter Einheit / prize money per destroyed unit */
  plunderStars: 10,
  /** Kolchose: +1 Bevoelkerung alle 5 Runden / kolkhoz: +1 population every 5 rounds */
  kolkhozInterval: 5,
  kolkhozPop: 1,
  /** Botschaftspalast: Sterne je Friedensvertrag und Runde / embassy palace: stars per peace treaty and round */
  palacePerPeace: 4,
  /** Handelskontor: Sterne je verbundener Hafenstadt und Runde / trading post: stars per connected harbour city and round */
  tradingPostPerHarbour: 3,
  /** Versuchslabor: Forschungsrabatt je Labor, hoechstens so viele Labore / test lab: research discount per lab, at most this many labs */
  testLabDiscount: 0.05,
  testLabMax: 3,
};

/**
 * Ersatzeinheiten der Sonderfraktionen fuer Start, Belohnungen und Aufstaende.
 * Replacement units of the special factions for start, rewards and uprisings.
 */
export interface RosterStats { units: UnitTypeId[]; start: UnitTypeId; infantry: UnitTypeId; mg: UnitTypeId; tank: UnitTypeId; research: boolean }
export const ROSTERS: Partial<Record<FactionId, RosterStats>> = {
  zyrr: { units: ALIEN_UNITS, start: 'grey', infantry: 'grey', mg: 'grey', tank: 'mech', research: false },
  vesper: { units: CULT_UNITS, start: 'zealot', infantry: 'zealot', mg: 'zealot', tank: 'doomCrawler', research: true },
  nexus: { units: ROBOT_UNITS, start: 'android', infantry: 'android', mg: 'android', tank: 'titan', research: false },
};

/**
 * Sold: laufende Kosten je Runde. Die ersten Einheiten (aelteste zuerst) sind frei, jede weitere kostet
 * einen Anteil ihres Kaufpreises (aufgerundet); Panzer kosten pauschal.
 * Upkeep: running cost per round. The first units (oldest first) are free, each further one costs
 * a share of its price (rounded up); tanks cost a flat amount.
 */
export const UPKEEP = { freeUnits: 4, share: 0.3, flat: { tank: 12 } as Partial<Record<UnitTypeId, number>> };

/** Kartenbesonderheiten / map hazards and gimmicks */
export type HazardLevel = 'none' | 'normal' | 'many';
export const HAZARDS = {
  /** Anzahl je Stufe, skaliert mit der Kartengroesse (pro 100 Felder) / count per level, scaled per 100 tiles */
  volcanoes: { none: 0, normal: 0.35, many: 0.8 } as Record<HazardLevel, number>,
  crashSites: { none: 0, normal: 0.3, many: 0.7 } as Record<HazardLevel, number>,
  labs: { none: 0, normal: 0.25, many: 0.6 } as Record<HazardLevel, number>,
  wrecks: { none: 0, normal: 2.5, many: 5 } as Record<HazardLevel, number>,
  /** Anteil der Waldfelder, die zu Dschungel werden / share of forest tiles that become jungle */
  jungle: { none: 0, normal: 0.3, many: 0.55 } as Record<HazardLevel, number>,
  /** Mindestabstand zu Hauptquartieren / minimum distance to headquarters */
  startDistance: 4,
};
/** Vulkan: bricht alle `interval` Runden aus, Lava brennt `burnRounds` Runden / erupts every `interval` rounds, lava burns `burnRounds` rounds */
export const VOLCANO = { interval: 5, firstRound: 4, burnRounds: 2, damage: 6, radius: 1 };
/** Absturzstelle: einmalige Bergung / crash site: one-time salvage */
/** Bergung (Absturzstelle, verlassene Forschungseinrichtung): Gratis-Technologie bis Stufe maxTier, sonst Sterne
 *  salvage (crash site, abandoned research facility): free tech up to tier maxTier, otherwise stars */
export const CRASH = { stars: 30, revealRadius: 3, alienUnit: 'skimmer' as UnitTypeId, maxTier: 3 };
/** Dschungel: Fahrzeuge nur als erster Schritt, jeder Schritt aus dem Dschungel endet die Bewegung, Deckung fuer Fusstruppen
 *  jungle: vehicles only as first step, every step out of the jungle ends the move, cover for foot troops */
export const JUNGLE = {
  vehicles: ['jeep', 'tank', 'artillery', 'doomBuggy', 'rocketCart', 'doomCrawler', 'railgun', 'titan', 'mech', 'antiAir', 'mineLayer', 'flakDrone', 'protoWalker'] as UnitTypeId[],
  footDefense: 1.5,
};

/** Kult: Rekrutieren neben Predigern statt in Staedten / cult: recruit next to preachers instead of in cities */
export const CULT = { faction: 'vesper' as FactionId };

/** NEXUS: Rechenleistung aus Rechenzentren mit Energie / NEXUS: compute from powered data centers */
export const NEXUS = { faction: 'nexus' as FactionId };

/** Terraformen und Xeno-Boden / terraforming and xeno ground */
export const XENO = {
  faction: 'zyrr' as FactionId,
  /** Preis je Feld im eigenen Gebiet / price per tile in own territory */
  terraformCost: 5,
  /** Verteidigungsbonus fuer Alien-Einheiten auf Xeno-Boden / defence bonus for alien units on xeno ground */
  groundDefense: 1.5,
  /** zusaetzliche Heilung auf Xeno-Boden / extra healing on xeno ground */
  groundHeal: 2,
  /** Punkte je terraformtem Feld / points per terraformed tile */
  tilePoints: 10,
  startUnit: 'grey' as UnitTypeId,
  /** Ersatz fuer menschliche Belohnungen / replacement for human rewards */
  rewardTank: 'mech' as UnitTypeId,
  uprisingUnit: 'grey' as UnitTypeId,
};

export const LAND_UNITS: LandUnitId[] = ['infantry', 'sniper', 'jeep', 'pioneer', 'mg', 'medic', 'artillery', 'spy', 'heli', 'tank', 'antiTank', 'antiAir', 'mineLayer'];
export const SHIP_UPGRADES: ShipId[] = ['submarine', 'destroyer', 'battleship'];
/** Infanterietypen fuer Aussenposten / infantry types for outposts */
export const INFANTRY_TYPES: UnitTypeId[] = ['infantry', 'mg', 'sniper', 'pioneer'];

export const COMBAT = {
  damageFactor: 4.5,
  splashFactor: 0.5, // Kriegsschiff: Anteil des Schadens auf Nachbarfelder / share of damage on neighbours
};

/** Trefferart eines Angriffs / hit kind of an attack */
export type HitKind = 'miss' | 'graze' | 'partial' | 'full' | 'crit';
/** Rasse fuer die Treffsicherheit / race for accuracy */
export type HitRace = 'human' | 'alien' | 'robot' | 'cult';
export const HIT_KINDS: HitKind[] = ['miss', 'graze', 'partial', 'full', 'crit'];

/**
 * Trefferglueck: jede Rasse hat eigene Wahrscheinlichkeiten, das Wetter verschiebt sie.
 * Hit luck: each race has its own odds, the weather shifts them.
 */
export const HIT = {
  /** Schadensfaktor je Trefferart / damage factor per hit kind */
  mult: { miss: 0, graze: 0.5, partial: 0.8, full: 1, crit: 1.5 } as Record<HitKind, number>,
  /** Grundwahrscheinlichkeiten je Rasse (Summe 1) / base odds per race (sum 1) */
  odds: {
    // Menschen: solide, gelegentlich kritisch / humans: solid, occasionally critical
    human: { miss: 0.06, graze: 0.1, partial: 0.2, full: 0.54, crit: 0.1 },
    // Ausserirdische: wuchtig, aber ungenau / aliens: powerful but inaccurate
    alien: { miss: 0.16, graze: 0.1, partial: 0.08, full: 0.38, crit: 0.28 },
    // Roboter: praezise, kaum kritisch / robots: precise, hardly ever critical
    robot: { miss: 0.02, graze: 0.03, partial: 0.12, full: 0.8, crit: 0.03 },
    // Kult: fanatisch und unberechenbar / cult: fanatic and unpredictable
    cult: { miss: 0.1, graze: 0.12, partial: 0.12, full: 0.44, crit: 0.22 },
  } as Record<HitRace, Record<HitKind, number>>,
  /** Wetter: Verschiebung der Wahrscheinlichkeiten / weather: shift of the odds */
  weather: {
    clear: {},
    rain: { miss: 0.05, graze: 0.05, full: -0.1 },
    snow: { miss: 0.04, partial: 0.08, full: -0.08, crit: -0.04 },
    // Wind trifft nur Fernkaempfer und Flieger / wind only affects ranged units and fliers
    wind: { miss: 0.08, graze: 0.04, full: -0.12 },
  } as Record<WeatherId, Partial<Record<HitKind, number>>>,
  /** Wie stark das Wetter je Rasse wirkt / how strongly weather affects each race */
  weatherFactor: { human: 1, alien: 1, robot: 0.4, cult: 1 } as Record<HitRace, number>,
  /** Ausserirdische frieren: Schnee wirkt staerker / aliens freeze: snow hits harder */
  alienSnowFactor: 1.6,
};

export const DEFENSE_BONUS = {
  open: 1.0,
  terrainWithTech: 1.5,
  city: 1.5,
  outpost: 3.0,
  cityWithBunker: 4.0,
};

/** Ueberreste gefallener Einheiten / remains of fallen units */
export const REMAINS = {
  /** Wracks geben +1 auf den Verteidigungsbonus / wrecks add +1 to the defense bonus */
  wreckDefenseBonus: 1,
  wreckUnits: ['tank', 'jeep', 'artillery', 'heli', 'antiAir', 'mineLayer', 'protoWalker'] as UnitTypeId[],
  skeletonUnits: ['infantry', 'sniper', 'pioneer', 'mg', 'medic', 'spy', 'antiTank', 'steppeRider', 'stormbreaker', 'peacekeeper'] as UnitTypeId[],
};

/** Panzersperre des Pioniertrupps / tank barrier of the pioneer squad */
export const BARRIER = {
  cost: 10,
  builders: ['pioneer'] as UnitTypeId[],
  /** betroffene Fahrzeuge / affected vehicles */
  vehicles: ['tank', 'jeep', 'artillery', 'antiAir', 'mineLayer'] as UnitTypeId[],
  /** Bewegung in der naechsten Runde / movement in the next round */
  slowedMove: 1,
  terrain: ['plain', 'forest', 'mountain'] as TerrainId[],
};

/**
 * Konter-Einheiten (Schere-Stein-Papier) / counter units (rock-paper-scissors).
 * Klassen: Flieger = Faehigkeit 'fly', Schiffe = ship, Fahrzeuge = Liste unten (inkl. Laeufer und Mechs), sonst Fusstruppen.
 * Classes: air = ability 'fly', ships = ship, vehicles = list below (incl. walkers and mechs), otherwise foot troops.
 * Der Faktor bonusVs der Einheit multipliziert den Schaden gegen die Klasse (Angriff und Gegenschlag).
 * The unit's bonusVs factor multiplies its damage against the class (attack and retaliation).
 */
export const COUNTER = {
  vehicles: [
    'jeep', 'tank', 'artillery', 'antiAir', 'mineLayer', 'doomBuggy', 'rocketCart', 'doomCrawler',
    'spider', 'railgun', 'titan', 'flakDrone', 'mech', 'tripod', 'protoWalker',
  ] as UnitTypeId[],
  /** Flak-Feuerzone: feindliche Flieger, die im Umkreis ihren Zug beenden, nehmen Schaden / flak zone: hostile flyers ending their turn within range take damage */
  flak: { range: 1, damage: 3 },
  /**
   * Minen: verdeckt (sichtbar fuer den Besitzer und Einheiten direkt daneben), loesen bei feindlichen Bodeneinheiten aus.
   * Mines: hidden (visible to the owner and units right next to them), trigger on hostile ground units.
   */
  mine: {
    cost: 10,
    damageFoot: 6,
    damageVehicle: 15,
    terrain: ['plain', 'forest', 'mountain'] as TerrainId[],
    /** hoechstens so viele Minen je Fraktion / at most this many mines per faction */
    maxPerFaction: 8,
  },
};

/** Kettenspuren (optisch) / track marks (visual) */
export const TRACKS = {
  units: ['tank'] as UnitTypeId[],
  keepRounds: 8,
  maxPerTile: 3,
};

/** Wetter: gilt fuer die ganze Karte, wechselt alle `cycleRounds` Runden / weather: map-wide, changes every `cycleRounds` rounds */
export type WeatherId = 'clear' | 'rain' | 'snow' | 'wind';
export const WEATHER = {
  cycleRounds: 3,
  weights: { clear: 0.45, rain: 0.22, snow: 0.15, wind: 0.18 } as Record<WeatherId, number>,
  salt: 0x51ed270b,
  rain: { rangeUnits: ['artillery'] as UnitTypeId[], rangeDelta: -1, moveUnits: ['heli'] as UnitTypeId[], moveDelta: -1 },
  /** Schnee: Fahrzeuge 1 Feld weniger / snow: vehicles 1 tile less */
  snow: { moveUnits: ['jeep', 'tank', 'artillery', 'antiAir', 'mineLayer'] as UnitTypeId[], moveDelta: -1 },
  /** Wind: Hubschrauber verbrauchen 2 Tankfuellungen pro Runde / wind: helicopters burn 2 fuel per round */
  wind: { fuelBurn: 2 },
};

/** Stadt-Ausbauten in Slots / city upgrades in slots */
export type CityUpgradeId = 'radioTower' | 'bunker' | 'barracks' | 'hospital' | 'flak' | 'depot';
export const CITY_UPGRADE_IDS: CityUpgradeId[] = ['radioTower', 'bunker', 'barracks', 'hospital', 'flak', 'depot'];
export const CITY_UPGRADES = {
  slots: 3,
  cost: { radioTower: 15, bunker: 25, barracks: 35, hospital: 20, flak: 30, depot: 30 } as Record<CityUpgradeId, number>,
  /**
   * Freischaltung durch Forschung; Fraktionen ohne Forschung brauchen stattdessen die Stadtstufe (Stufe der Technologie + 1).
   * Unlock by research; factions without research need the city level instead (tech tier + 1).
   */
  tech: { hospital: 'supply', barracks: 'mountainTraining', radioTower: 'aerodynamics', bunker: 'fortification', flak: 'ballistics', depot: 'logistics' } as Record<CityUpgradeId, TechId>,
  /** Lazarett: zusaetzliche Heilung auf und neben der Stadt / hospital: extra healing on and next to the city */
  hospitalHeal: 2,
  /** Flugabwehr: Schaden an feindlichen Hubschraubern, die ihren Zug im Umkreis beenden / flak: damage to hostile helicopters ending their turn within range */
  flakDamage: 3,
  flakRange: 1,
  /** Depot: Sterne pro Runde / depot: stars per round */
  depotIncome: 5,
  /** Funkturm: Reichweite fuer das Ziel und Radius des aufgedeckten Bereichs / radio tower: target range and reveal radius */
  radioRange: 6,
  radioRadius: 2,
  /** Bunker: Verteidigung fuer eigene Einheiten in der Stadt / bunker: defence for own units in the city */
  bunkerDefense: 2,
};

/** Kriegsspuren (optisch): Krater von schweren Waffen, Brandflecken von allen anderen / war marks (visual) */
export const WAR_MARKS = {
  craterUnits: ['artillery', 'battleship', 'tank'] as UnitTypeId[],
  maxPerTile: 4,
};

export const HEALING = {
  ownTerritory: 4,
  elsewhere: 2,
  medic: 4,
};

export const VETERAN = {
  kills: 3,
  killsDravon: 2,
  bonusHp: 5,
};

export const FUEL = {
  tank: 4,
};

export const VISION = {
  unit: 1,
  mountain: 2,
  cityExtra: 1, // Stadt sieht ihr Gebiet plus 1 / city sees its territory plus 1
  droneRadius: 4, // Aufklaerungsdrohne / recon drone
  bunkerRevealRadius: 3,
};

export const START = {
  stars: 25,
  hqLevel: 1,
  unit: 'infantry' as UnitTypeId,
};

/** Einkommen: gegenueber der Vorlage gesenkt, damit Armeen langsamer wachsen / income: lowered vs the brief so armies grow slower */
export const INCOME = {
  perCityLevel: 3,
  hq: 4,
  factory: 4,
  govQuarter: 4,
  logisticsPerAdjacent: 3,
  logisticsMax: 24,
  embassy: 6,
  embassyAlveniaMultiplier: 2,
  aiBonus: { easy: 0, normal: 0, hard: 3, extreme: 6 } as Record<Difficulty, number>,
};

export const CITY = {
  /** Aufstieg von Stufe n auf n+1 braucht n+1 Punkte / level n -> n+1 needs n+1 points */
  levelUpCost: (level: number) => level + 1,
  baseRadius: 1, // 3x3
  expandedRadius: 2, // 5x5
  unitLimitExtra: 1, // Stufe + 1 / level + 1
  rewardStars: 15,
  rewardPopulation: 3,
  bunkerRingLevel: 3,
  govQuarterPoints: 250,
  uprisingMaxUnits: 4,
  connectionPopulation: 1,
};

export const ECON = {
  /** (Stufe x Staedte + 4) x 5 */
  researchCost: (tier: number, cities: number) => (tier * cities + 4) * 5,
  embassyBaseCost: 25,
  embassyStep: 25,
  outpostCost: 25,
  firstContactPer1000: 15,
  firstContactMax: 60,
  cyberneticsDiscount: 0.33,
};

export interface BuildingStats {
  cost: number;
  pop: number;
  tech: TechId | null;
  /** Gelaende / terrain */
  terrain: TerrainId[];
  resource?: ResourceId;
  onePerCity?: boolean;
  /** nur einmal je Fraktion / only once per faction */
  onePerFaction?: boolean;
  /** Bevoelkerung je angrenzendem Gebaeude dieses Typs / population per adjacent building of this type */
  adjacency?: { building: BuildingId; pop: number };
}

export const BUILDINGS: Record<BuildingId, BuildingStats> = {
  storehouse: { cost: 10, pop: 1, tech: 'supply', terrain: ['plain', 'forest'], resource: 'supplies' },
  ranch: { cost: 10, pop: 1, tech: 'livestock', terrain: ['plain', 'forest'], resource: 'livestock' },
  fishery: { cost: 10, pop: 1, tech: 'coastalEconomy', terrain: ['shallow'], resource: 'fish' },
  lumberCamp: { cost: 15, pop: 1, tech: 'forestry', terrain: ['forest'] },
  farm: { cost: 25, pop: 2, tech: 'agritech', terrain: ['plain'], resource: 'farmland' },
  mine: { cost: 25, pop: 2, tech: 'mining', terrain: ['mountain'], resource: 'ore' },
  materialsPlant: { cost: 25, pop: 0, tech: 'ballistics', terrain: ['plain'], onePerCity: true, adjacency: { building: 'lumberCamp', pop: 1 } },
  foodFactory: { cost: 25, pop: 0, tech: 'foodIndustry', terrain: ['plain'], onePerCity: true, adjacency: { building: 'farm', pop: 1 } },
  steelMill: { cost: 25, pop: 0, tech: 'armsIndustry', terrain: ['plain'], onePerCity: true, adjacency: { building: 'mine', pop: 2 } },
  logisticsCenter: { cost: 25, pop: 0, tech: 'logistics', terrain: ['plain'], onePerCity: true },
  navalBase: { cost: 35, pop: 1, tech: 'coastalEconomy', terrain: ['shallow'] },
  road: { cost: 15, pop: 0, tech: 'roadbuilding', terrain: ['plain', 'forest', 'mountain'] },
  bridge: { cost: 25, pop: 0, tech: 'roadbuilding', terrain: ['shallow'] },
  researchCenter: { cost: 100, pop: 1, tech: null, terrain: ['plain', 'forest', 'mountain', 'shallow'], onePerCity: true },
  // Nur Zyrr, nur auf Xeno-Boden / Zyrr only, only on xeno ground
  xenoHive: { cost: 15, pop: 2, tech: null, terrain: ['plain', 'forest', 'mountain'] },
  shrine: { cost: 20, pop: 2, tech: null, terrain: ['plain', 'forest'], onePerCity: true },
  dataCenter: { cost: 20, pop: 2, tech: null, terrain: ['plain', 'forest'] },
  powerPlant: { cost: 15, pop: 1, tech: null, terrain: ['plain', 'forest', 'mountain', 'shallow'] },
  xenoHarvester: { cost: 15, pop: 2, tech: null, terrain: ['plain', 'forest', 'mountain', 'shallow'] },
  // Einzigartige Gebaeude (siehe UNIQUE) / unique buildings (see UNIQUE)
  kolkhoz: { cost: 35, pop: 1, tech: 'livestock', terrain: ['plain'], onePerCity: true },
  mercenaryBarracks: { cost: 35, pop: 2, tech: 'motorization', terrain: ['plain', 'forest'], onePerCity: true },
  embassyPalace: { cost: 30, pop: 3, tech: 'supply', terrain: ['plain', 'forest'], onePerFaction: true },
  tradingPost: { cost: 30, pop: 1, tech: 'coastalEconomy', terrain: ['plain'], onePerFaction: true },
  testLab: { cost: 30, pop: 1, tech: 'highAltitude', terrain: ['plain', 'forest', 'mountain'], onePerCity: true },
};

/** Basisgebaeude der Werke, die das Logistikzentrum zaehlt / base buildings counted by the logistics centre */
export const LOGISTICS_SOURCES: BuildingId[] = ['lumberCamp', 'farm', 'mine'];

/** Welche Technologie erlaubt das Forschungszentrum auf welchem Gelaende / which tech allows the research centre on which terrain */
export const RESEARCH_CENTER_TECH: Record<'plain' | 'forest' | 'mountain' | 'shallow', TechId> = {
  plain: 'aerodynamics',
  forest: 'fieldResearch',
  mountain: 'highAltitude',
  shallow: 'coastalDefense',
};

export const GRAND_PROJECTS = {
  pop: 3,
  points: 400,
  peaceRounds: 5,
  bankStars: 500,
  kills: 10,
  connectedCities: 5,
  palaceLevel: 5,
};
export const GRAND_PROJECT_IDS: GrandProjectId[] = [
  'peaceMonument', 'stateBank', 'victoryColumn', 'worldTradeCenter', 'governmentPalace', 'academy', 'satelliteCenter',
];

export interface TechStats {
  tier: 1 | 2 | 3;
  parent: TechId | null;
  branch: number;
}

export const TECHS: Record<TechId, TechStats> = {
  motorization: { tier: 1, parent: null, branch: 0 },
  roadbuilding: { tier: 2, parent: 'motorization', branch: 0 },
  logistics: { tier: 3, parent: 'roadbuilding', branch: 0 },
  aerodynamics: { tier: 2, parent: 'motorization', branch: 0 },
  armyAviation: { tier: 3, parent: 'aerodynamics', branch: 0 },
  supply: { tier: 1, parent: null, branch: 1 },
  agritech: { tier: 2, parent: 'supply', branch: 1 },
  foodIndustry: { tier: 3, parent: 'agritech', branch: 1 },
  fortification: { tier: 2, parent: 'supply', branch: 1 },
  intelligence: { tier: 3, parent: 'fortification', branch: 1 },
  mountainTraining: { tier: 1, parent: null, branch: 2 },
  mining: { tier: 2, parent: 'mountainTraining', branch: 2 },
  armsIndustry: { tier: 3, parent: 'mining', branch: 2 },
  highAltitude: { tier: 2, parent: 'mountainTraining', branch: 2 },
  cybernetics: { tier: 3, parent: 'highAltitude', branch: 2 },
  coastalEconomy: { tier: 1, parent: null, branch: 3 },
  diving: { tier: 2, parent: 'coastalEconomy', branch: 3 },
  navalArtillery: { tier: 3, parent: 'diving', branch: 3 },
  shipbuilding: { tier: 2, parent: 'coastalEconomy', branch: 3 },
  coastalDefense: { tier: 3, parent: 'shipbuilding', branch: 3 },
  livestock: { tier: 1, parent: null, branch: 4 },
  camouflage: { tier: 2, parent: 'livestock', branch: 4 },
  fieldResearch: { tier: 3, parent: 'camouflage', branch: 4 },
  forestry: { tier: 2, parent: 'livestock', branch: 4 },
  ballistics: { tier: 3, parent: 'forestry', branch: 4 },
};
export const TECH_IDS = Object.keys(TECHS) as TechId[];

/** Verteidigungsbonus-Technologien je Gelaende / defense bonus techs per terrain */
export const TERRAIN_DEFENSE_TECH: Partial<Record<TerrainId, TechId>> = {
  forest: 'camouflage',
  mountain: 'highAltitude',
  shallow: 'coastalDefense',
  ocean: 'coastalDefense',
};

/** Zweites Fraktionsmerkmal / second faction trait */
export type Perk2Id = 'earthworks' | 'battleHardened' | 'fieldHospitals' | 'harbourPilots' | 'engineerCorps' | 'forestSpawn' | 'martyrdom' | 'sensorNet';

export interface FactionStats {
  perk: 'massMobilization' | 'drill' | 'alliancePolicy' | 'boom' | 'researchLead' | 'xenotech' | 'zealotry' | 'hivemind';
  /** zweites Merkmal (kleiner Dauerbonus) / second trait (small passive bonus) */
  perk2: Perk2Id;
  discountUnit: UnitTypeId;
  discount: number;
  startTech: TechId | null;
  /** weitere Starttechnologien (Sonderfraktionen ohne Forschung) / extra start techs (special factions without research) */
  extraTechs?: TechId[];
  /** Gewichte fuer das Heimatgebiet / weights for the home region */
  home: { plain: number; forest: number; mountain: number; water: number; res: Partial<Record<ResourceId, number>> };
}

export const FACTION_IDS: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'vesper', 'nexus'];

export const FACTIONS: Record<FactionId, FactionStats> = {
  korvat: { perk: 'massMobilization', perk2: 'earthworks', discountUnit: 'infantry', discount: 0.2, startTech: 'livestock', home: { plain: 0.7, forest: 0.15, mountain: 0.05, water: 0.1, res: { farmland: 0.3, livestock: 0.15, supplies: 0.1 } } },
  dravon: { perk: 'drill', perk2: 'battleHardened', discountUnit: 'jeep', discount: 0.2, startTech: 'motorization', home: { plain: 0.45, forest: 0.15, mountain: 0.3, water: 0.1, res: { ore: 0.35, supplies: 0.1 } } },
  alvenia: { perk: 'alliancePolicy', perk2: 'fieldHospitals', discountUnit: 'medic', discount: 0.2, startTech: 'supply', home: { plain: 0.45, forest: 0.25, mountain: 0.2, water: 0.1, res: { supplies: 0.15, livestock: 0.15, farmland: 0.1, ore: 0.1 } } },
  meridon: { perk: 'boom', perk2: 'harbourPilots', discountUnit: 'spy', discount: 0.2, startTech: 'coastalEconomy', home: { plain: 0.4, forest: 0.15, mountain: 0.05, water: 0.4, res: { fish: 0.4, supplies: 0.1 } } },
  zyrr: { perk: 'xenotech', perk2: 'forestSpawn', discountUnit: 'grey', discount: 0, startTech: null, home: { plain: 0.45, forest: 0.2, mountain: 0.25, water: 0.1, res: { ore: 0.2, supplies: 0.15 } } },
  vesper: { perk: 'zealotry', perk2: 'martyrdom', discountUnit: 'zealot', discount: 0, startTech: 'livestock', home: { plain: 0.5, forest: 0.25, mountain: 0.15, water: 0.1, res: { livestock: 0.2, supplies: 0.15 } } },
  nexus: { perk: 'hivemind', perk2: 'sensorNet', discountUnit: 'android', discount: 0, startTech: 'coastalEconomy', extraTechs: ['diving', 'shipbuilding'], home: { plain: 0.55, forest: 0.1, mountain: 0.25, water: 0.1, res: { ore: 0.3, supplies: 0.1 } } },
  velkar: { perk: 'researchLead', perk2: 'engineerCorps', discountUnit: 'pioneer', discount: 0.2, startTech: 'mountainTraining', home: { plain: 0.25, forest: 0.35, mountain: 0.35, water: 0.05, res: { ore: 0.2, supplies: 0.1 } } },
};

export const PERKS = {
  massMobilizationExtraUnits: 1,
  drillKills: 2,
  allianceEmbassyCostFactor: 0.5,
  allianceEmbassyIncomeFactor: 2,
  boomLevelReduction: 1,
  researchLeadDiscount: 0.2,
};

/** Zweite Fraktionsmerkmale / second faction traits */
export const PERKS2 = {
  /** Korvat, Erdwaelle: Aussenposten-Preis / earthworks: outpost price */
  earthworksOutpostCost: 15,
  /** Dravon, kampferprobt: Angriff der Veteranen / battle-hardened: veteran attack bonus */
  battleHardenedAttack: 0.5,
  /** Alvenia, Feldlazarette: zusaetzliche Heilung / field hospitals: extra healing */
  fieldHospitalsHeal: 1,
  /** Meridon, Lotsenwesen: Landungsboote fahren weiter / harbour pilots: landing boats move further */
  harbourPilotsMove: 1,
  /** Velkar, Ingenieurkorps: Panzersperren-Preis / engineer corps: tank barrier price */
  engineerCorpsBarrierCost: 5,
  /** Zyrr, Waldbrut: zusaetzliche Heilung im Wald / forest spawn: extra healing in forests */
  forestSpawnHeal: 1,
  /** Vesper, Maertyrertum: Sterne je im Kampf gefallener eigener Einheit / martyrdom: stars per own unit fallen in battle */
  martyrdomStars: 3,
  /** NEXUS, Sensornetz: Sichtweite aller Einheiten / sensor net: vision of all units */
  sensorNetVision: 1,
};

export const SCORE = {
  revealedTile: 5,
  territoryTile: 20,
  cityLevel: 50,
  techPerTier: 100,
  tankUnit: 50,
  researchCenterBase: 100,
  researchCenterStep: 50,
  researchCenterInterval: 3,
  researchCenterMax: 300,
  govQuarter: 250,
  grandProject: 400,
};

export const MODES = {
  pointsRounds: 30,
};

export const BUNKER_REWARDS = ['stars', 'tech', 'population', 'veteranMg', 'reveal'] as const;
export type BunkerReward = (typeof BUNKER_REWARDS)[number] | 'destroyer';
export const BUNKER = {
  stars: 35,
  population: 3,
  /** Wahrscheinlichkeit eines Zerstoerers bei Wasserbunkern / chance of a destroyer for water bunkers */
  waterDestroyerChance: 0.5,
};

export interface MapGenParams {
  landRatio: number;
  lumps: number;
}
export const MAP_TYPES: Record<MapType, MapGenParams> = {
  continent: { landRatio: 0.85, lumps: 1 },
  lakes: { landRatio: 0.68, lumps: 1 },
  continents: { landRatio: 0.55, lumps: 3 },
  islands: { landRatio: 0.42, lumps: 8 },
  waterworld: { landRatio: 0.22, lumps: 12 },
};
export const MAP_SIZES: MapSize[] = [11, 14, 16, 18, 22, 26];

export const MAPGEN = {
  villagesPerTile: 1 / 13,
  bunkersPerTile: 1 / 22,
  minCityDistance: 2,
  resourceChance: 0.28,
  forestChance: 0.22,
  mountainChance: 0.14,
  oceanDistance: 2, // Wasser mit Abstand >= 2 zum Land wird Ozean / water with distance >= 2 to land becomes ocean
  /** Versuche fuer faire Startpunkte (bester Mindestabstand gewinnt) / attempts for fair start points (best min distance wins) */
  startAttempts: 12,
  /** Landschaften und Fluesse / biomes and rivers */
  biomeSeedSalt: 0x2f6a9d1,
  riversPerSize: 1 / 6,
  hillChance: 0.35,
  /** Mindestgroesse der Startinsel in Feldern / minimum size of the start island in tiles */
  minStartIsland: 18,
  /** Startinseln unter dieser Groesse bekommen ein Wasserfeld im Stadtgebiet (Hafen) / start islands below this size get a water tile in the city area (harbour) */
  coastalStartBelow: 25,
};

export const SANDBOX = {
  startStarsOptions: [10, 25, 50, 100, 200],
};

export const AI = {
  /** ab dieser Runde kennt die KI alle feindlichen Staedte / from this round the AI knows all hostile cities */
  intelRound: 30,
  maxMillis: 2000,
  maxCommandsPerTurn: 400,
};

export const PLAYER_LIMITS = { min: 2, max: 5 };
