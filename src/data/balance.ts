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
/**
 * Wunder der Siegbedingungen: vier Bauwerke (unbeweglich) und der Erdkernbohrer (beweglich).
 * Wonders of the victory conditions: four structures (immobile) and the earth-core drill (mobile).
 */
export type WonderKind = 'portal' | 'hackRelay' | 'fusionPlant' | 'waal';
export type WonderUnitId = WonderKind | 'coreDrill';
/** Endgegner der Kampagne (nicht ausbildbar) / campaign bosses (not trainable) */
export type BossUnitId = 'swarmMother';
export type UnitTypeId = LandUnitId | ShipId | AlienUnitId | CultUnitId | RobotUnitId | UniqueUnitId | WonderUnitId | BossUnitId;
export type Ability =
  | 'dash' | 'escape' | 'persist' | 'fortify' | 'heal' | 'convert' | 'noRetaliate' | 'ignoreOutpost'
  | 'invisible' | 'uprising' | 'fly' | 'fuel' | 'submerged' | 'splash' | 'carry' | 'terraform' | 'deathRay' | 'walker' | 'preach' | 'burn' | 'wade'
  // Konter: Flugabwehr-Feuerzone, Minen legen / counters: anti-air fire zone, lay mines
  | 'flak' | 'mines'
  // Einzigartige Einheiten: Sturmangriff ohne Gegenschlag, Selbstheilung, Kaperbeute
  // unique units: shock assault without retaliation, self-repair, prize money
  | 'shock' | 'mend' | 'plunder'
  // Wunder der Siegbedingungen: kein Sold, kein Stadtlimit, nicht bekehrbar / victory wonders: no upkeep, no city limit, not convertible
  | 'wonder'
  // Endgegner: kein Sold, nicht bekehrbar, nimmt nichts ein, Faehigkeiten siehe SWARM_MOTHER / boss: no upkeep, not convertible, captures nothing, abilities see SWARM_MOTHER
  | 'boss';
export type TechId =
  | 'motorization' | 'roadbuilding' | 'logistics' | 'aerodynamics' | 'armyAviation'
  | 'supply' | 'agritech' | 'foodIndustry' | 'fortification' | 'intelligence'
  | 'mountainTraining' | 'mining' | 'armsIndustry' | 'highAltitude' | 'cybernetics'
  | 'coastalEconomy' | 'diving' | 'navalArtillery' | 'shipbuilding' | 'coastalDefense'
  | 'livestock' | 'camouflage' | 'fieldResearch' | 'forestry' | 'ballistics'
  // Siegtechnologien, je Fraktion eine (Stufe 3) / victory techs, one per faction (tier 3)
  | VictoryTechId;
/** Siegtechnologien / victory techs */
export type VictoryTechId =
  | 'fiveYearPlan' | 'waalProgram' | 'leagueCharter' | 'tradeMonopoly' | 'fusionResearch' | 'dimensionalRift' | 'coreDrilling' | 'singularity';
export type BuildingId =
  | 'storehouse' | 'ranch' | 'fishery' | 'lumberCamp' | 'farm' | 'mine'
  | 'materialsPlant' | 'foodFactory' | 'steelMill' | 'logisticsCenter'
  | 'navalBase' | 'road' | 'bridge' | 'researchCenter'
  | 'xenoHive' | 'xenoHarvester' | 'shrine' | 'dataCenter' | 'powerPlant'
  // Einzigartige Gebaeude der klassischen Fraktionen / unique buildings of the classic factions
  | 'kolkhoz' | 'mercenaryBarracks' | 'embassyPalace' | 'tradingPost' | 'testLab'
  // Ressourcengebaeude der Fraktionen (je eins, siehe RESOURCE) / faction resource buildings (one each, see RESOURCE)
  | 'tractorStation' | 'deepMine' | 'hillVineyard' | 'tradeHarbour' | 'polarStation' | 'wreckSmelter' | 'pilgrimSite' | 'depotNode';
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
/**
 * Einheitenklasse (Schiffe bekommen nie Konter-Boni; Bauwerke = Wunder-Bauwerke, fuer Konter wie COUNTER.structureAs)
 * unit class (ships never receive counter bonuses; structures = wonder structures, for counters like COUNTER.structureAs)
 */
export type UnitClass = CounterClass | 'ship' | 'structure';

/**
 * Fraktions-Siegbedingungen (zusaetzlich zu Punkten und Eroberung). Runden zaehlen zu Beginn des eigenen Zuges.
 * Faction victory conditions (in addition to points and conquest). Rounds count at the start of the own turn.
 */
export const WONDERS = {
  /** Sternepreis je Wunder (Bohrer: Ausbildungspreis) / star price per wonder (drill: training price) */
  cost: { portal: 100, hackRelay: 80, fusionPlant: 120, waal: 90, coreDrill: 80 } as Record<WonderUnitId, number>,
  /** Fraktion je Wunder / faction per wonder */
  faction: { portal: 'zyrr', hackRelay: 'nexus', fusionPlant: 'velkar', waal: 'dravon', coreDrill: 'vesper' } as Record<WonderUnitId, FactionId>,
  /** Wunder je Fraktion / wonder per faction */
  ofFaction: { zyrr: 'portal', nexus: 'hackRelay', velkar: 'fusionPlant', dravon: 'waal', vesper: 'coreDrill' } as Partial<Record<FactionId, WonderUnitId>>,
  /**
   * Phasen in Runden: Portal Bau + Aufladen, Relais Bau + Hacken, Kraftwerk ein Bau, Waal Bau bis bewaffnet + Fertigstellung.
   * Phases in rounds: portal build + charge, relay build + hack, power plant one build, Waal build until armed + completion.
   */
  phases: { portal: [9, 10], hackRelay: [8, 9], fusionPlant: [14], waal: [8, 8] } as Record<WonderKind, number[]>,
  /**
   * Gelaende des Bauplatzes (Kraftwerk: alle vier Felder) / terrain of the site (power plant: all four tiles)
   */
  terrain: { portal: ['plain', 'forest'], hackRelay: ['mountain'], fusionPlant: ['plain', 'forest', 'mountain'], waal: ['plain', 'forest'] } as Record<WonderKind, TerrainId[]>,
  /** Angriffe setzen die laufende Phase auf 0 / attacks reset the current phase to 0 */
  interruptible: { portal: true, hackRelay: true, fusionPlant: true, waal: false, coreDrill: true } as Record<WonderUnitId, boolean>,
  /** Waal: LP im Bau, nach der ersten Phase (bewaffnet); fertig = volle LP / Waal: HP while building, after the first phase (armed); done = full HP */
  waalBuildHp: 15,
  waalArmedHp: 30,
  /** Erdkernbohrer: Runden Stillstand bis zum Weltende, hoechstens so viele gleichzeitig / earth-core drill: rounds standing still, at most this many at once */
  drillRounds: 14,
  drillMax: 1,
  /** Korvat: Anteil aller Staedte (inkl. Siedlungen), der ueberschritten werden muss / Korvat: share of all cities (incl. villages) that must be exceeded */
  korvatShare: 0.4,
  /** bei wenigen Fraktionen hoeher: Anteil mindestens korvatSharePerFaction / Fraktionen (2: 80 %, 3: 53 %, 4+: 40 %) / higher with few factions */
  korvatSharePerFaction: 1.6,
  /**
   * Meridon: Sterne in der Kasse ohne Rundenlimit; mit Rundenlimit Runden x meridonStarsPerRound, begrenzt auf meridonStarsMin..meridonStars.
   * Meridon: stars in the treasury without a round limit; with a round limit rounds x meridonStarsPerRound, clamped to meridonStarsMin..meridonStars.
   */
  meridonStars: 1000,
  meridonStarsPerRound: 11,
  meridonStarsMin: 300,
  /** Alvenia, Voelkerbund: Runden in Folge, Mindestzahl bekannter lebender Fraktionen / League of Nations: consecutive rounds, minimum known living factions */
  alveniaRounds: 5,
  alveniaMinFactions: 2,
  /** KI: Siegtechnologie ab dieser Runde erforschen; Wert eines feindlichen Wunders / AI: research the victory tech from this round; worth of a hostile wonder */
  aiResearchRound: 10,
  aiWorth: 150,
  /** KI spart fuer Siegtechnologie und Wunder bis zu so viele Runden Einkommen an / AI saves up to this many rounds of income for the victory tech and wonder */
  aiSaveRounds: 6,
  /**
   * KI: Gegner gilt ab diesem Gesamtfortschritt als kurz vor dem Sieg (kein Frieden, Frieden brechen); Voelkerbund eigener Wert.
   * AI: a rival counts as close to victory from this overall progress (no peace, break peace); the League has its own value.
   */
  aiNearVictory: 0.5,
  aiNearVictoryLeague: 0.8,
  /** KI bricht den Voelkerbund nur mit mindestens diesem Anteil an Alvenias Staerke / AI breaks the League only with at least this share of Alvenia's strength */
  aiLeagueBreakStrength: 1.5,
  /** KI: Bohrer erst ab so vielen eigenen Staedten / AI: drill only from this many own cities */
  aiDrillMinCities: 2,
  /** KI Korvat: Fuenfjahresplan erst ab diesem Anteil der benoetigten Staedte / AI Korvat: Five-Year Plan only from this share of the needed cities */
  aiKorvatResearchShare: 0.35,
  /** KI Meridon: ab diesem Anteil des Sterneziels nur noch Dringendes kaufen / AI Meridon: only urgent buys from this share of the star target */
  aiMeridonHoardShare: 0.4,
};
/** Siegtechnologie je Fraktion / victory tech per faction */
export const VICTORY_TECH: Record<FactionId, VictoryTechId> = {
  korvat: 'fiveYearPlan', dravon: 'waalProgram', alvenia: 'leagueCharter', meridon: 'tradeMonopoly',
  velkar: 'fusionResearch', zyrr: 'dimensionalRift', vesper: 'coreDrilling', nexus: 'singularity',
};
export const WONDER_UNITS: WonderUnitId[] = ['portal', 'hackRelay', 'fusionPlant', 'waal', 'coreDrill'];

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
  // Wunder der Siegbedingungen (siehe WONDERS): Bauwerke mit eigenen LP, Bewegung 0 / victory wonders (see WONDERS): structures with own HP, movement 0
  portal: { cost: null, hp: 40, attack: 0, defense: 3, move: 0, range: 0, vision: 2, abilities: ['wonder'], tech: 'dimensionalRift', ship: false, faction: 'zyrr' },
  hackRelay: { cost: null, hp: 30, attack: 0, defense: 2.5, move: 0, range: 0, vision: 2, abilities: ['wonder'], tech: 'singularity', ship: false, faction: 'nexus' },
  fusionPlant: { cost: null, hp: 45, attack: 0, defense: 3, move: 0, range: 0, vision: 2, abilities: ['wonder'], tech: 'fusionResearch', ship: false, faction: 'velkar' },
  // Waal: schiesst erst nach der ersten Bauphase (Reichweite 2), faehrt nie / Waal: fires only after the first build phase (range 2), never drives
  waal: { cost: null, hp: 60, attack: 5, defense: 4, move: 0, range: 2, vision: 2, abilities: ['wonder'], tech: 'waalProgram', ship: false, faction: 'dravon' },
  // Erdkernbohrer: beweglich, wird in der Stadt ausgebildet / earth-core drill: mobile, trained in a city
  coreDrill: { cost: WONDERS.cost.coreDrill, hp: 25, attack: 0, defense: 2.5, move: 1, range: 0, vision: 1, abilities: ['wonder'], tech: 'coreDrilling', ship: false, faction: 'vesper' },
  // Endgegner: Schwarmmutter Xyl'Tharra, schwebt, Reichweite 2, Faehigkeiten siehe SWARM_MOTHER / boss: Swarm Mother Xyl'Tharra, floats, range 2, abilities see SWARM_MOTHER
  swarmMother: { cost: null, hp: 60, attack: 5, defense: 4, move: 1, range: 2, vision: 2, abilities: ['boss', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
};

/**
 * Schwarmmutter (Endgegner Akt I): alle Faehigkeiten wirken zu Beginn ihres eigenen Zuges, deterministisch, ohne Wurf.
 * Swarm Mother (boss of act I): all abilities trigger at the start of her own turn, deterministic, without a roll.
 */
export const SWARM_MOTHER = {
  /** Heilung je eigenem Zug auf Xeno-Boden, nur ohne Schaden seit dem letzten Zug / healing per own turn on xeno ground, only without damage since her last turn */
  xenoHeal: 4,
  /** Gegenschlag gedaempft (Anteil) / return fire dampened (share) */
  returnFactor: 0.55,
  /** Brut: alle so viele Runden so viele Graue auf Nachbarfeldern / brood: every this many rounds this many greys on adjacent tiles */
  broodEvery: 3,
  broodCount: 2,
  broodUnit: 'grey' as UnitTypeId,
  /** keine Brut mehr ab so vielen eigenen Einheiten / no more brood from this many own units */
  broodCap: 14,
  /** Psychischer Schrei: Schaden an allen feindlichen Einheiten im Umkreis, danach Abklingzeit / psychic scream: damage to all hostile units in range, then a cooldown */
  screamDamage: 4,
  screamRange: 1,
  screamEvery: 2,
  /** Auftauchen: eine Spielereinheit so nah am Hauptquartier oder ab dieser Runde / emergence: a player unit this close to the HQ or from this round */
  emergeRange: 3,
  emergeRound: 7,
  /** KI: sie verlaesst ihr Hauptquartier hoechstens so weit / AI: she leaves her HQ at most this far */
  aiLeash: 3,
  /**
   * Riss (Kampagne m11): bei so wenigen LP stirbt sie nicht, ein Riss reisst auf und der Einsatz ist gewonnen.
   * Rift (campaign m11): at this few HP she does not die, a rift tears open and the mission is won.
   */
  riftHp: 25,
};

/** Einheiten der Zyrr / Zyrr roster */
export const ALIEN_UNITS: AlienUnitId[] = ['grey', 'terraformer', 'skimmer', 'mech', 'tripod'];
export const CULT_UNITS: CultUnitId[] = ['zealot', 'torchbearer', 'prophet', 'doomBuggy', 'rocketCart', 'doomCrawler', 'faustZealot'];
export const ROBOT_UNITS: RobotUnitId[] = ['android', 'spider', 'quadDrone', 'railgun', 'titan', 'flakDrone'];
export const UNIQUE_UNITS: UniqueUnitId[] = ['steppeRider', 'stormbreaker', 'peacekeeper', 'privateer', 'protoWalker'];
export const UNIQUE_BUILDINGS: BuildingId[] = ['kolkhoz', 'mercenaryBarracks', 'embassyPalace', 'tradingPost', 'testLab'];

/**
 * Die eine Fahrzeugliste (Klasse 'vehicle', inkl. Laeufer, Mechs und Erdkernbohrer). Konter, Panzersperre, Schnee,
 * Dschungel und Wracks lesen alle diese Liste. Wunder-Bauwerke (auch der Waal) sind Klasse 'structure', nicht hier.
 * The one vehicle list (class 'vehicle', incl. walkers, mechs and the earth-core drill). Counters, tank barrier, snow,
 * jungle and wrecks all read this list. Wonder structures (the Waal too) are class 'structure', not listed here.
 */
export const VEHICLE_UNITS: UnitTypeId[] = [
  'jeep', 'tank', 'artillery', 'antiAir', 'mineLayer', 'doomBuggy', 'rocketCart', 'doomCrawler',
  'spider', 'railgun', 'titan', 'flakDrone', 'mech', 'tripod', 'protoWalker', 'coreDrill',
];
/** Flieger (Faehigkeit 'fly') / flyers (ability 'fly') */
export const AIR_UNITS = (Object.keys(UNITS) as UnitTypeId[]).filter((k) => UNITS[k].abilities.includes('fly'));

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
  palacePerPeace: 3,
  /** Handelskontor: Sterne je verbundener Hafenstadt und Runde / trading post: stars per connected harbour city and round */
  tradingPostPerHarbour: 2,
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
  // alle Fahrzeuge (VEHICLE_UNITS) / all vehicles (VEHICLE_UNITS)
  vehicles: VEHICLE_UNITS,
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
  terraformCost: 7,
  /** Verteidigungsbonus fuer Alien-Einheiten auf Xeno-Boden / defence bonus for alien units on xeno ground */
  groundDefense: 1.5,
  /** zusaetzliche Heilung auf Xeno-Boden / extra healing on xeno ground */
  groundHeal: 2,
  /** Punkte je terraformtem Feld / points per terraformed tile */
  tilePoints: 6,
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
  /**
   * Rasse je Fraktion (Fraktionseinheiten nach Bauart, Schiffe nach Besitzer); fehlt = Menschen
   * race per faction (faction units by type, ships by owner); missing = humans
   */
  race: { zyrr: 'alien', nexus: 'robot', vesper: 'cult' } as Partial<Record<FactionId, HitRace>>,
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
    // Sandsturm (Welt der Vergessenen): Staub in Optik und Gelenken / dust storm (world of the Forgotten): dust in sights and joints
    dust: { miss: 0.08, graze: 0.06, full: -0.14 },
    // Meteorschauer: Blitze am Himmel lenken ab / meteor shower: flashes in the sky distract
    meteor: { miss: 0.03, full: -0.03 },
    // Saeureregen trifft wie Regen / acid rain hits like rain
    acid: { miss: 0.05, graze: 0.05, full: -0.1 },
    quake: {},
  } as Record<WeatherId, Partial<Record<HitKind, number>>>,
  /** Wie stark das Wetter je Rasse wirkt / how strongly weather affects each race */
  weatherFactor: { human: 1, alien: 1, robot: 0.4, cult: 1 } as Record<HitRace, number>,
  /** Ausserirdische frieren: Schnee wirkt staerker / aliens freeze: snow hits harder */
  alienSnowFactor: 1.6,
  /** Fanatiker in Lebensgefahr: unter diesem LP-Anteil mehr kritische Treffer / fanatics near death: more crits below this HP share */
  cultFrenzyHp: 0.2,
  cultFrenzyCrit: 0.5,
  /** Roboter: Verschiebung bei 20 % LP, linear ab vollen LP / robots: shift at 20 % HP, linear from full HP */
  robotDamagedAt: 0.2,
  robotDamaged: { miss: 0.08, graze: 0.07, partial: 0.1, full: -0.25 } as Partial<Record<HitKind, number>>,
};

/** Mech-Raketen: Fernangriff aufs uebernaechste Feld, begrenzte Munition / mech rockets: ranged attack two tiles away, limited ammo */
export const ROCKETS = {
  units: ['mech'] as UnitTypeId[],
  /** Abstand des Ziels / target distance */
  range: 2,
  /** Raketen pro Ladung / rockets per load */
  max: 2,
};

/** Deckung gegen Fernangriffe: Panzer und Truppen in Wald und Stadt / cover against ranged attacks: tanks and troops in forests and cities */
export const RANGED_COVER = {
  /** Faktor auf die Verteidigung bei Angriffen aus 2+ Feldern / factor on defence against attacks from 2+ tiles */
  factor: 1.4,
};

/** Notreparatur der Roboter aus Wracks / emergency repair of robots from wrecks */
export const REPAIR = {
  /** Faktor auf die normale Heilung / factor on normal healing */
  factor: 2,
};

/** Geordneter Rueckzug (menschliche Truppen) / orderly retreat (human troops) */
export const RETREAT = {
  /** Anteil des vollen Schadens / share of full damage */
  damage: 0.2,
  /** Runden, in denen die Faehigkeit danach gesperrt ist / rounds the ability is locked afterwards */
  cooldown: 2,
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
  /** Wracks: alle Fahrzeuge und Flieger (Maschinen); Wunder-Bauwerke hinterlassen keins / wrecks: all vehicles and flyers (machines); wonder structures leave none */
  wreckUnits: [...VEHICLE_UNITS, ...AIR_UNITS] as UnitTypeId[],
  skeletonUnits: ['infantry', 'sniper', 'pioneer', 'mg', 'medic', 'spy', 'antiTank', 'steppeRider', 'stormbreaker', 'peacekeeper'] as UnitTypeId[],
};

/** Panzersperre des Pioniertrupps / tank barrier of the pioneer squad */
export const BARRIER = {
  cost: 10,
  builders: ['pioneer'] as UnitTypeId[],
  /** betroffene Fahrzeuge: alle (VEHICLE_UNITS) / affected vehicles: all (VEHICLE_UNITS) */
  vehicles: VEHICLE_UNITS,
  /** Bewegung in der naechsten Runde / movement in the next round */
  slowedMove: 1,
  terrain: ['plain', 'forest', 'mountain'] as TerrainId[],
};

/**
 * Konter-Einheiten (Schere-Stein-Papier) / counter units (rock-paper-scissors).
 * Klassen: Flieger = Faehigkeit 'fly', Schiffe = ship, Bauwerke = Wunder-Bauwerke, Fahrzeuge = VEHICLE_UNITS (inkl. Laeufer
 * und Mechs), sonst Fusstruppen.
 * Classes: air = ability 'fly', ships = ship, structures = wonder structures, vehicles = VEHICLE_UNITS (incl. walkers and
 * mechs), otherwise foot troops.
 * Der Faktor bonusVs der Einheit multipliziert den Schaden gegen die Klasse (Angriff und Gegenschlag).
 * The unit's bonusVs factor multiplies its damage against the class (attack and retaliation).
 */
export const COUNTER = {
  vehicles: VEHICLE_UNITS,
  /** Wunder-Bauwerke nehmen Konter-Schaden wie diese Klasse / wonder structures take counter damage like this class */
  structureAs: 'vehicle' as CounterClass,
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
export type WeatherId = 'clear' | 'rain' | 'snow' | 'wind' | 'dust' | 'meteor' | 'acid' | 'quake';
export const WEATHER = {
  cycleRounds: 3,
  weights: { clear: 0.45, rain: 0.22, snow: 0.15, wind: 0.18, dust: 0, meteor: 0, acid: 0, quake: 0 } as Record<WeatherId, number>,
  /**
   * Heimatwelt der Zyrr (Thema 'alien'): Saeureregen statt Schnee, sonst wie die Erde.
   * Zyrr homeworld (theme 'alien'): acid rain instead of snow, otherwise like Earth.
   */
  alienWeights: { clear: 0.45, rain: 0.22, snow: 0, wind: 0.18, dust: 0, meteor: 0, acid: 0.15, quake: 0 } as Record<WeatherId, number>,
  /**
   * Wuestenwelt (Kartenthema 'desert'): kein Regen, kein Schnee, kein Wind; nur klar, Sandsturm und Meteorschauer.
   * Desert world (map theme 'desert'): no rain, no snow, no wind; only clear, dust storm and meteor shower.
   */
  desertWeights: { clear: 0.5, rain: 0, snow: 0, wind: 0, dust: 0.3, meteor: 0.2, acid: 0, quake: 0 } as Record<WeatherId, number>,
  salt: 0x51ed270b,
  rain: { rangeUnits: ['artillery'] as UnitTypeId[], rangeDelta: -1, moveUnits: ['heli'] as UnitTypeId[], moveDelta: -1 },
  /** Schnee: alle Fahrzeuge (VEHICLE_UNITS) 1 Feld weniger, mindestens 1 / snow: all vehicles (VEHICLE_UNITS) 1 tile less, at least 1 */
  snow: { moveUnits: VEHICLE_UNITS, moveDelta: -1 },
  /** Wind: Hubschrauber verbrauchen 2 Tankfuellungen pro Runde / wind: helicopters burn 2 fuel per round */
  wind: { fuelBurn: 2 },
  /**
   * Sandsturm: Einheiten ab Reichweite rangeFrom 1 Feld weniger Reichweite, Hubschrauber 1 Feld weniger Bewegung.
   * Dust storm: units with range rangeFrom or more lose 1 range, helicopters lose 1 move.
   */
  dust: { rangeFrom: 2, rangeDelta: -1, moveUnits: ['heli'] as UnitTypeId[], moveDelta: -1, visionDelta: -1 },
  /**
   * Meteorschauer: zu Beginn jeder Runde trifft er jede ungepanzerte Einheit (Klasse 'foot', jede Fraktion) ausserhalb
   * von Staedten und Bunkern mit damage LP, mit extraChance einen mehr (Zufallsstrom des Spiels); nie unter minHp, nie
   * den Endgegner.
   * Meteor shower: at the start of every round it hits every unarmoured unit (class 'foot', any faction) outside cities
   * and bunkers for damage HP, with extraChance one more (the game's random stream); never below minHp, never the boss.
   */
  meteor: { damage: 1, extraChance: 0.5, minHp: 1 },
  /**
   * Saeureregen (Heimatwelt der Zyrr): wie der Meteorschauer, trifft aber jede Einheit, die nicht zu den Zyrr gehoert
   * (Bauart, nicht Besitzer); Zyrr und die Schwarmmutter sind immun.
   * Acid rain (Zyrr homeworld): like the meteor shower, but it hits every unit that is not a Zyrr unit (by type, not
   * owner); the Zyrr and the Swarm Mother are immune.
   */
  acid: { damage: 1, extraChance: 0.4, minHp: 1 },
  /**
   * Erdbeben (Hoehle): je Runde mit chance (aus Seed und Runde, eine Runde vorhersehbar); dann bewegen sich nur Fusstruppen
   * (Klasse 'foot'), Angriffe und Verdan-Geschuetze bleiben.
   * Earthquake (cavern): each round with chance (from seed and round, foreseeable one round ahead); then only foot troops
   * (class 'foot') move, attacks and Verdan guns stay.
   */
  quake: { chance: 0.22, salt: 0x2b7e1516 },
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

/**
 * Nachschublinien (Hoehlen-Finale): Staedte wachsen nicht, bringen festes Einkommen und tragen eine feste Zahl Einheiten.
 * Supply lines (cavern finale): cities do not grow, give a fixed income and support a fixed number of units.
 */
export const SUPPLY_LINE = {
  /** Einkommen je Nachschublinie und Runde / income per supply line and round */
  income: 6,
  /** Einkommen des Hauptschachts (statt Stufe + HQ-Bonus) / income of the main shaft (instead of level + HQ bonus) */
  mainShaftIncome: 14,
  /** Einheitenlimit je Nachschublinie / unit limit per supply line */
  unitLimit: 3,
  /** Einheitenlimit des Hauptschachts / unit limit of the main shaft */
  mainShaftUnitLimit: 5,
};

/**
 * Alte Verteidigungslinie der Verdan um das Artefakt: neutrale Geschuetze, die erwachen, sobald eine Einheit nahe kommt,
 * und dann zu Rundenbeginn auf alles in Reichweite feuern.
 * Old Verdan defence line around the artifact: neutral guns that wake up once a unit comes close
 * and then fire at everything in range at the start of each round.
 */
export const VERDAN = {
  hp: 24,
  attack: 3,
  defense: 3,
  /** Schussweite / firing range */
  range: 2,
  /** Abstand zum Artefakt, ab dem die Linie erwacht / distance to the artifact that wakes the line */
  wakeRange: 3,
  /** Abstand der Geschuetze zum Artefakt / distance of the guns to the artifact */
  ringDistance: 3,
  /** Anzahl Geschuetze / number of guns */
  count: 6,
  /** Treffsicherheit einer Maschine / accuracy of a machine */
  race: 'robot' as HitRace,
};

/**
 * Festungsbau (Dravon): Pioniere und Minenleger bauen Geschuetzstellungen auf ein freies Nachbarfeld im eigenen Gebiet.
 * Eine Stellung ist ein Bauwerk auf dem Feld (Tile.turret mit owner), keine Einheit: unpassierbar, feuert zu Rundenbeginn
 * wie die Verdan-Geschuetze, aber nur auf Einheiten im Krieg mit ihrem Besitzer. Etwas schwaecher als ein Verdan-Geschuetz.
 * Fortification (Dravon): pioneers and mine layers build gun emplacements on a free adjacent tile in own territory.
 * An emplacement is a structure on the tile (Tile.turret with owner), not a unit: impassable, fires at the start of the
 * round like the Verdan guns, but only at units at war with its owner. Somewhat weaker than a Verdan gun.
 */
export const EMPLACEMENT = {
  /** Fraktionen mit Festungsbau / factions with fortification */
  factions: ['dravon'] as FactionId[],
  /** bauende Einheiten / building units */
  builders: ['pioneer', 'mineLayer'] as UnitTypeId[],
  cost: 25,
  hp: 20,
  attack: 3,
  defense: 2.5,
  /** Schussweite / firing range */
  range: 2,
  /** Treffsicherheit: menschliche Geschuetzmannschaft / accuracy: human gun crew */
  race: 'human' as HitRace,
  /** baubares Gelaende (passierbares Land) / buildable terrain (passable land) */
  terrain: ['plain', 'forest', 'mountain'] as TerrainId[],
  /** hoechstens so viele Stellungen je eigener Stadt / at most this many emplacements per own city */
  perCity: 1,
  /** Mindestabstand zwischen eigenen Stellungen (Felder) / minimum distance between own emplacements (tiles) */
  minSpacing: 3,
  /**
   * KI: Sternereserve fuer Bauten ohne Bedrohung, Bedrohungsradius um das Baufeld, Hoechstabstand zur eigenen Stadt,
   * Mindestwert eines Bauplatzes, Wunschanteil Pioniere solange Plaetze frei sind, Zuschlag fuer die Technik Befestigung
   * (Faktor in der Eroberung, erst ab Runde techRound und techCities Staedten), Preis einer feindlichen Stellung fuer Angreifer.
   * AI: star reserve for builds without a threat, threat radius around the site, maximum distance to the own city,
   * minimum value of a site, desired pioneer share while slots are free, bonus for the Fortification tech (factor in
   * conquest, only from round techRound and techCities cities), prize of a hostile emplacement for attackers.
   */
  ai: { reserve: 30, threatRange: 5, cityRange: 3, minValue: 9, pioneerShare: 0.35, techBonus: 60, techConquest: 2, techRound: 8, techCities: 2, prize: 30 },
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
  // Ressourcengebaeude (siehe RESOURCE) / resource buildings (see RESOURCE)
  /** nur in diesen Landschaften / only in these biomes */
  biomes?: BiomeId[];
  /** alternativ zur Landschaft: neben einem Vulkan / alternatively to the biome: next to a volcano */
  nearVolcano?: boolean;
  /** nur auf einem Wrack oder einer geborgenen Absturzstelle, verbraucht sie / only on a wreck or a salvaged crash site, consumes it */
  wreck?: boolean;
  /** darf dieses eigene Gebaeude ersetzen (Ausbau, Preis = Differenz) / may replace this own building (upgrade, price = difference) */
  upgrades?: BuildingId;
  /** zaehlt fuer Werke, Logistikzentrum und Duerre als dieses Grundgebaeude / counts as this base building for works, logistics centre and drought */
  countsAs?: BuildingId;
  /** Sterne pro Runde fuer die Stadt / stars per round for the city */
  stars?: number;
  /** Rechenleistung (NEXUS) / compute (NEXUS) */
  compute?: number;
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
  mercenaryBarracks: { cost: 35, pop: 3, tech: 'motorization', terrain: ['plain', 'forest'], onePerCity: true },
  embassyPalace: { cost: 30, pop: 3, tech: 'supply', terrain: ['plain', 'forest'], onePerFaction: true },
  tradingPost: { cost: 30, pop: 1, tech: 'coastalEconomy', terrain: ['plain'], onePerFaction: true },
  testLab: { cost: 30, pop: 1, tech: 'highAltitude', terrain: ['plain', 'forest', 'mountain'], onePerCity: true },
  // Ressourcengebaeude der Fraktionen (siehe RESOURCE) / faction resource buildings (see RESOURCE)
  // Korvat: Traktorstation auf Ackerland, Ausbau des Agrarbetriebs / tractor station on farmland, upgrade of the farm
  tractorStation: { cost: 35, pop: 3, tech: 'agritech', terrain: ['plain'], resource: 'farmland', upgrades: 'farm', countsAs: 'farm', adjacency: { building: 'farm', pop: 1 } },
  // Dravon: Tiefbauzeche auf Erz, Ausbau des Tagebaus / deep mine on ore, upgrade of the mine
  deepMine: { cost: 40, pop: 3, tech: 'mining', terrain: ['mountain'], resource: 'ore', upgrades: 'mine', countsAs: 'mine', stars: 2 },
  // Alvenia: Huegelweingut auf Ebenen im Huegelland / hill vineyard on plains in the hills
  hillVineyard: { cost: 30, pop: 2, tech: 'agritech', terrain: ['plain'], biomes: ['hills'], onePerCity: true, stars: 2 },
  // Meridon: Handelshafen auf Fischgruenden, Ausbau der Fischerei / trade harbour on fish, upgrade of the fishery
  tradeHarbour: { cost: 30, pop: 2, tech: 'shipbuilding', terrain: ['shallow'], resource: 'fish', upgrades: 'fishery', countsAs: 'fishery', stars: 2 },
  // Velkar: Polarstation in der Tundra / polar station in the tundra
  polarStation: { cost: 25, pop: 2, tech: 'highAltitude', terrain: ['plain', 'forest', 'mountain'], biomes: ['tundra'] },
  // Zyrr: Wrackschmelze auf einem Wrack oder einer geborgenen Absturzstelle, ohne Xeno-Boden / wreck smelter on a wreck or salvaged crash site, without xeno ground
  wreckSmelter: { cost: 20, pop: 2, tech: null, terrain: ['plain', 'forest', 'mountain'], wreck: true, stars: 3 },
  // Vesper: Pilgerstaette in Wueste oder Steppe oder neben einem Vulkan / pilgrimage site in desert or steppe or next to a volcano
  pilgrimSite: { cost: 25, pop: 2, tech: 'camouflage', terrain: ['plain', 'forest'], biomes: ['desert', 'steppe'], nearVolcano: true, onePerCity: true, stars: 2 },
  // NEXUS: Depotknoten auf Erz / depot node on ore
  depotNode: { cost: 25, pop: 1, tech: null, terrain: ['mountain'], resource: 'ore', compute: 1 },
};

/**
 * Ressourcengebaeude: je Fraktion ein Gebaeude zum Rohstoff-Thema ihrer Comics. Nur die eigene Fraktion baut es und nur ihr
 * wirkt es; erobert gibt es nur die beim Bau erhaltene Bevoelkerung.
 * Resource buildings: one building per faction on the resource theme of its comics. Only the own faction builds it and only
 * for it does it work; captured, it gives nothing but the population gained on construction.
 */
export const RESOURCE = {
  /** Gebaeude je Fraktion / building per faction */
  buildings: {
    korvat: 'tractorStation', dravon: 'deepMine', alvenia: 'hillVineyard', meridon: 'tradeHarbour',
    velkar: 'polarStation', zyrr: 'wreckSmelter', vesper: 'pilgrimSite', nexus: 'depotNode',
  } as Record<FactionId, BuildingId>,
  /** Polarstation: Forschungsrabatt je Station, hoechstens so viele (eigene Grenze neben dem Versuchslabor) / polar station: research discount per station, at most this many (own cap beside the test lab) */
  polarDiscount: 0.03,
  polarMax: 3,
  /** Handelshafen: Zusatzsterne, wenn seine Stadt einen Marinestuetzpunkt hat / trade harbour: extra stars if its city has a naval base */
  harbourNavalBonus: 1,
  /** Huegelweingut: Zusatzsterne je aktiver eigener Botschaft, hoechstens so viele / hill vineyard: extra stars per active own embassy, at most this many */
  vineyardPerEmbassy: 1,
  vineyardEmbassyMax: 3,
};
export const RESOURCE_BUILDINGS: BuildingId[] = Object.values(RESOURCE.buildings);

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
  /** nur diese Fraktion sieht und erforscht die Technologie (Siegtechnologie) / only this faction sees and researches it (victory tech) */
  faction?: FactionId;
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
  // Siegtechnologien (nur die eigene Fraktion) / victory techs (own faction only)
  fiveYearPlan: { tier: 3, parent: 'agritech', branch: 1, faction: 'korvat' },
  waalProgram: { tier: 3, parent: 'roadbuilding', branch: 0, faction: 'dravon' },
  leagueCharter: { tier: 3, parent: 'fortification', branch: 1, faction: 'alvenia' },
  tradeMonopoly: { tier: 3, parent: 'shipbuilding', branch: 3, faction: 'meridon' },
  fusionResearch: { tier: 3, parent: 'highAltitude', branch: 2, faction: 'velkar' },
  coreDrilling: { tier: 3, parent: 'forestry', branch: 4, faction: 'vesper' },
  // Zyrr und NEXUS forschen sonst nicht: einzige erforschbare Technologie, ohne Voraussetzung
  // Zyrr and NEXUS do not research otherwise: their only researchable tech, without a parent
  dimensionalRift: { tier: 3, parent: null, branch: 5, faction: 'zyrr' },
  singularity: { tier: 3, parent: null, branch: 5, faction: 'nexus' },
};
/** Allgemeine Technologien (ohne Siegtechnologien) / common techs (without victory techs) */
export const TECH_IDS = (Object.keys(TECHS) as TechId[]).filter((t) => !TECHS[t].faction);
/** Alle Technologien inkl. Siegtechnologien / all techs incl. victory techs */
export const ALL_TECH_IDS = Object.keys(TECHS) as TechId[];

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
  /** weitere Starttechnologien (Sonderfraktionen ohne Forschung, Dravon) / extra start techs (special factions without research, Dravon) */
  extraTechs?: TechId[];
  /** Gewichte fuer das Heimatgebiet / weights for the home region */
  home: { plain: number; forest: number; mountain: number; water: number; res: Partial<Record<ResourceId, number>> };
}

export const FACTION_IDS: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'vesper', 'nexus'];

export const FACTIONS: Record<FactionId, FactionStats> = {
  korvat: { perk: 'massMobilization', perk2: 'earthworks', discountUnit: 'infantry', discount: 0.2, startTech: 'livestock', home: { plain: 0.7, forest: 0.15, mountain: 0.05, water: 0.1, res: { farmland: 0.3, livestock: 0.15, supplies: 0.1 } } },
  dravon: { perk: 'drill', perk2: 'battleHardened', discountUnit: 'jeep', discount: 0.3, startTech: 'motorization', extraTechs: ['mountainTraining'], home: { plain: 0.45, forest: 0.15, mountain: 0.3, water: 0.1, res: { ore: 0.35, supplies: 0.1 } } },
  alvenia: { perk: 'alliancePolicy', perk2: 'fieldHospitals', discountUnit: 'medic', discount: 0.2, startTech: 'supply', home: { plain: 0.45, forest: 0.25, mountain: 0.2, water: 0.1, res: { supplies: 0.15, livestock: 0.15, farmland: 0.1, ore: 0.1 } } },
  meridon: { perk: 'boom', perk2: 'harbourPilots', discountUnit: 'spy', discount: 0.2, startTech: 'coastalEconomy', home: { plain: 0.4, forest: 0.15, mountain: 0.05, water: 0.4, res: { fish: 0.3, supplies: 0.1 } } },
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
  researchLeadDiscount: 0.12,
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
  /** Hoehle: eigener Zufallsstrom und Felsanteil am Kartenrand / cavern: own random stream and rock share at the map edge */
  cavernSeedSalt: 0x6c1a7e3,
  cavernEdgeRock: 0.55,
  /**
   * Wuestenwelt: eigener Zufallsstrom; das Meer ist ausgetrocknet (Salzpfannen), nur wenige rostrote Tuempel bleiben,
   * ein Teil des Walds wird zu Ebene (Dornengestruepp bleibt Wald).
   * Desert world: own random stream; the sea has dried up (salt flats), only a few rust-red pools remain,
   * part of the forest becomes plain (thorn scrub stays forest).
   */
  desertSeedSalt: 0x3d5e7a9,
  desertPool: 0.1,
  desertForestKeep: 0.5,
};

/**
 * Siedlungsfaktor der Kampagne je Kartenthema (Anteil neutraler Siedlungen gegenueber freien Partien); eine Mission kann
 * ihn mit MissionDef.settlements ueberschreiben. Die Hoehle bleibt bei ihren Nachschublinien.
 * Campaign settlement factor per map theme (share of neutral settlements compared to free games); a mission can override
 * it with MissionDef.settlements. The cavern keeps its supply lines.
 */
export const CAMPAIGN_SETTLEMENTS = { surface: 0.5, alien: 0.5, desert: 0.3, cavern: 1 };

/**
 * Sendetuerme der Kampagne (nicht in der Hoehle): neutrale Orte wie Nachschublinien, einnehmbar, bilden aus, wachsen
 * nicht, keine Ausbauten. Anzahl je Karte: Felder / perTiles, begrenzt auf min..max; MissionDef.towers ueberschreibt.
 * Abstand zu Hauptquartieren hqDistance, zu Staedten cityDistance, untereinander spacing.
 * Campaign transmitter towers (not in the cavern): neutral places like supply lines, capturable, they train, do not
 * grow, no upgrades. Count per map: tiles / perTiles, clamped to min..max; MissionDef.towers overrides.
 * Distance to HQs hqDistance, to cities cityDistance, to each other spacing.
 */
export const TOWER = { income: 2, unitLimit: 2, perTiles: 70, min: 2, max: 4, hqDistance: 4, cityDistance: 2, spacing: 4 };

/**
 * Turm-Ziel der Kampagne (m1 Funkenregen): alle Sendetuerme gleichzeitig m1Rounds Runden in Folge halten; m1Towers Tuerme
 * auf der Karte; Bonus fuer einen Sieg bis Runde m1FastRound; Missionsdauer m1MissionRounds; in Runde m1RaidRound landen
 * zwei Graue m1RaidDistance Felder neben dem abgelegensten Turm.
 * Campaign tower objective (m1 Starfall): hold all transmitter towers at the same time for m1Rounds consecutive rounds;
 * m1Towers towers on the map; bonus for a win by round m1FastRound; mission length m1MissionRounds; in round m1RaidRound
 * two Greys land m1RaidDistance tiles off the most remote tower.
 */
export const TOWER_HOLD = { m1Rounds: 5, m1Towers: 2, m1FastRound: 12, m1MissionRounds: 16, m1RaidRound: 8, m1RaidDistance: 2 };

/**
 * Aussenposten der Vergessenen (Wuestenwelt): weniger Orte, dafuer mehr Einkommen je Aussenposten.
 * Outposts of the Forgotten (desert world): fewer places, therefore more income per outpost.
 */
export const DESERT_OUTPOST = { incomeBonus: 2 };

export const SANDBOX = {
  startStarsOptions: [10, 25, 50, 100, 200],
};

export const AI = {
  /** ab dieser Runde kennt die KI alle feindlichen Staedte / from this round the AI knows all hostile cities */
  intelRound: 30,
  maxMillis: 2000,
  maxCommandsPerTurn: 400,
  /**
   * Meteorschauer in der naechsten Runde: Strafe fuer ungepanzerte Einheiten ohne Deckung, plus Zuschlag je fehlendem LP-Anteil.
   * Meteor shower next round: penalty for unarmoured units without cover, plus a surcharge per missing HP share.
   */
  meteorExposed: 6,
  meteorHurt: 18,
};

export const PLAYER_LIMITS = { min: 2, max: 5 };

/**
 * Kampagne: Ueberzeugen. Diplomatische Fraktionen gewinnen neutrale Siedlungen neben einer eigenen Einheit ohne Kampf,
 * gegen Sterne (Grundpreis plus Aufschlag je Stufe ueber 1). Nur in Kampagnenpartien.
 * Campaign: persuasion. Diplomatic factions win neutral settlements next to an own unit without combat,
 * for stars (base price plus a surcharge per level above 1). Campaign games only.
 */
/** KI im Kampagnen-Finale: Ziele rund um das Artefakt / AI in the campaign finale: goals around the artifact */
export const CAMPAIGN_AI = {
  artifactValue: 100, artifactCap: 2, artifactHuntValue: 120, artifactHuntCap: 4, artifactDistW: 4,
  /** Ruinenstaetten (m13) und Hoehleneingang (m14): besetzen oder Besetzer vertreiben / ruin sites (m13) and cave entrance (m14): occupy or drive off */
  siteValue: 70, siteCap: 1, caveValue: 130, caveCap: 3, caveHuntValue: 135, caveHuntCap: 4, siteDistW: 5,
  /** Spieler-Seite: Endgegner jagen / player side: hunt the boss */
  bossHuntValue: 105, bossHuntCap: 5, reachValue: 90, reachCap: 3,
  /**
   * Turm-Ziel (m1): Spieler-Seite nimmt Tuerme ein und haelt je einen Wachposten; die Gegner greifen Tuerme der Spieler-Seite an.
   * Tower objective (m1): the player side takes towers and keeps one guard on each; the enemies attack the player side's towers.
   */
  towerValue: 110, towerCap: 1, towerHuntValue: 120, towerHuntCap: 2, towerEnemyValue: 70,
  /** Zugwert fuer das Betreten eines Halte- oder Zielfelds / move value for stepping onto a hold or target tile */
  holdBonus: 45,
  /** Angriffswert gegen den markierten Endgegner (Spieler-Seite) / attack value against the marked boss (player side) */
  bossAttackBonus: 40,
};

/**
 * Ruinen der Vergessenen (Kampagne m13): Staetten auf der Karte, je eine schlafende Verdan-Wache daneben.
 * Eine Staette gilt als entziffert, wenn zu Beginn des Spielerzugs eine eigene Einheit darauf steht.
 * Ruins of the Forgotten (campaign m13): sites on the map, each with a dormant Verdan sentinel next to it.
 * A site counts as deciphered when an own unit stands on it at the start of the player's turn.
 */
export const RUINS = {
  sites: 4,
  /** Mindestabstand der Staetten zu Staedten und untereinander / minimum distance of the sites to cities and to each other */
  cityDistance: 2,
  spacing: 4,
  /**
   * Abstand der Wache zur Staette: ausserhalb ihrer Schussweite (VERDAN.range), sie bewacht den Zugang, nicht die Staette selbst.
   * Distance of the sentinel to the site: beyond its firing range (VERDAN.range), it guards the approach, not the site itself.
   */
  sentinelDistance: 3,
};

export const PERSUADE = { factions: ['alvenia', 'meridon'] as FactionId[], cost: 20, perLevel: 5, range: 1 };
