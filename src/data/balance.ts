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
/** Sondereinheiten einzelner Kampagnen-Einsaetze (nicht ausbildbar) / special units of single campaign missions (not trainable) */
export type CampaignUnitId = 'scientist';
/**
 * Fraktionsvarianten der Velkar (ersetzen Panzer, Hubschrauber und Scharfschuetze in ihrer Liste, siehe VARIANTS).
 * Velkar faction variants (replace tank, helicopter and sniper in their roster, see VARIANTS).
 */
export type VelkarUnitId = 'teslaTank' | 'octocopter' | 'railSniper';
/**
 * Fraktionsvarianten des Heiligen Alvenia (ersetzen Infanterie, Panzer und Artillerie in seiner Liste, siehe VARIANTS).
 * Holy Alvenia faction variants (replace infantry, tank and artillery in its roster, see VARIANTS).
 */
export type AlveniaUnitId = 'lightWarden' | 'reliquary' | 'sunLance';
export type UnitTypeId = LandUnitId | ShipId | AlienUnitId | CultUnitId | RobotUnitId | UniqueUnitId | WonderUnitId | BossUnitId | CampaignUnitId | VelkarUnitId | AlveniaUnitId;
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
  | 'fiveYearPlan' | 'waalProgram' | 'greatJudgement' | 'tradeMonopoly' | 'fusionResearch' | 'dimensionalRift' | 'coreDrilling' | 'singularity';
export type BuildingId =
  | 'storehouse' | 'ranch' | 'fishery' | 'lumberCamp' | 'farm' | 'mine'
  | 'materialsPlant' | 'foodFactory' | 'steelMill' | 'logisticsCenter'
  | 'navalBase' | 'road' | 'bridge' | 'researchCenter'
  | 'xenoHive' | 'xenoHarvester' | 'shrine' | 'dataCenter' | 'powerPlant'
  // Einzigartige Gebaeude der klassischen Fraktionen / unique buildings of the classic factions
  | 'kolkhoz' | 'mercenaryBarracks' | 'embassyPalace' | 'tradingPost' | 'testLab'
  // Ressourcengebaeude der Fraktionen (je eins, siehe RESOURCE) / faction resource buildings (one each, see RESOURCE)
  | 'tractorStation' | 'deepMine' | 'hillVineyard' | 'tradeHarbour' | 'polarStation' | 'wreckSmelter' | 'pilgrimSite' | 'depotNode'
  // Produktionsstaetten der Menschen (siehe PRODUCTION; dazu der Marinestuetzpunkt) / human production sites (see PRODUCTION; plus the naval base)
  | 'trainingCamp' | 'armory' | 'motorPool' | 'tankWorks' | 'foundry' | 'airfield' | 'dryDock';
export type GrandProjectId =
  | 'peaceMonument' | 'stateBank' | 'victoryColumn' | 'worldTradeCenter' | 'governmentPalace' | 'academy'
  | 'satelliteCenter';
/** 28 nur fuer die Kampagne m2 (Alle gegen alle am Mutterschiff), nicht in der Spielauswahl / 28 only for campaign m2 (free-for-all at the mothership), not in the game setup */
export type MapSize = 11 | 14 | 16 | 18 | 22 | 26 | 28;
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
  /**
   * Forschung, die die Einheit freischaltet (Kult, NEXUS, Zyrr und Schiffe der Sonderfraktionen); null = von Beginn an.
   * Menschen-Einheiten haben null: sie kommen aus Produktionsstaetten (PRODUCTION), nicht aus der Forschung.
   * Research that unlocks the unit (cult, NEXUS, Zyrr and the special factions' ships); null = available from start.
   * Human units have null: they come from production sites (PRODUCTION), not from research.
   */
  tech: TechId | null;
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
  /** Sternepreis je Wunder (Bohrer: Rekrutierungspreis) / star price per wonder (drill: recruit price) */
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
  /**
   * Alvenia, Grosses Strafgericht: so viele vernichtete Einheiten von Suendern (SIN) je Kartengroesse; es zaehlen nur Abschuesse
   * mit erforschter Siegtechnologie.
   * Alvenia, Great Judgement: this many destroyed units of sinners (SIN) per map size; only kills with the victory tech
   * researched count.
   */
  judgementKills: { 11: 18, 14: 22, 16: 24, 18: 26, 22: 29, 26: 33, 28: 35 } as Record<MapSize, number>,
  /**
   * Faktor auf das Ziel nach Zahl der Gegner (Index = Gegner, danach 1): im Zweikampf richtet Alvenia nur einen Gegner, aber
   * oft (Kult). Wie beim Kult und bei Korvat skaliert die Bedingung mit der Fraktionszahl.
   * Factor on the goal by number of rivals (index = rivals, then 1): in a duel Alvenia judges only one rival, but often (cult).
   * As for the cult and Korvat, the condition scales with the number of factions.
   */
  judgementByRivals: [1.5, 1.5, 1.2, 1] as number[],
  /** KI: Siegtechnologie ab dieser Runde erforschen; Wert eines feindlichen Wunders / AI: research the victory tech from this round; worth of a hostile wonder */
  aiResearchRound: 10,
  aiWorth: 150,
  /** KI spart fuer Siegtechnologie und Wunder bis zu so viele Runden Einkommen an / AI saves up to this many rounds of income for the victory tech and wonder */
  aiSaveRounds: 6,
  /**
   * KI: Gegner gilt ab diesem Gesamtfortschritt als kurz vor dem Sieg (kein Frieden, Frieden brechen).
   * AI: a rival counts as close to victory from this overall progress (no peace, break peace).
   */
  aiNearVictory: 0.5,
  /** KI: Bohrer erst ab so vielen eigenen Staedten / AI: drill only from this many own cities */
  aiDrillMinCities: 2,
  /** KI Korvat: Fuenfjahresplan erst ab diesem Anteil der benoetigten Staedte / AI Korvat: Five-Year Plan only from this share of the needed cities */
  aiKorvatResearchShare: 0.35,
  /** KI Meridon: ab diesem Anteil des Sterneziels nur noch Dringendes kaufen / AI Meridon: only urgent buys from this share of the star target */
  aiMeridonHoardShare: 0.4,
};
/** Siegtechnologie je Fraktion / victory tech per faction */
export const VICTORY_TECH: Record<FactionId, VictoryTechId> = {
  korvat: 'fiveYearPlan', dravon: 'waalProgram', alvenia: 'greatJudgement', meridon: 'tradeMonopoly',
  velkar: 'fusionResearch', zyrr: 'dimensionalRift', vesper: 'coreDrilling', nexus: 'singularity',
};
export const WONDER_UNITS: WonderUnitId[] = ['portal', 'hackRelay', 'fusionPlant', 'waal', 'coreDrill'];

export const UNITS: Record<UnitTypeId, UnitStats> = {
  infantry: { cost: 10, hp: 10, attack: 2, defense: 2, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false },
  sniper: { cost: 15, hp: 10, attack: 2, defense: 1, move: 1, range: 2, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false },
  jeep: { cost: 15, hp: 10, attack: 2, defense: 1, move: 2, range: 1, vision: 1, abilities: ['dash', 'escape'], tech: null, ship: false },
  pioneer: { cost: 15, hp: 15, attack: 1, defense: 3, move: 1, range: 1, vision: 1, abilities: ['fortify'], tech: null, ship: false },
  mg: { cost: 25, hp: 15, attack: 3, defense: 3, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false },
  medic: { cost: 25, hp: 10, attack: 0, defense: 1, move: 1, range: 1, vision: 1, abilities: ['heal', 'convert'], tech: null, ship: false },
  artillery: { cost: 40, hp: 10, attack: 4, defense: 0, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: null, ship: false },
  spy: { cost: 40, hp: 5, attack: 0, defense: 0.5, move: 2, range: 0, vision: 1, abilities: ['invisible', 'uprising'], tech: null, ship: false },
  heli: { cost: 50, hp: 10, attack: 3.5, defense: 1, move: 3, range: 1, vision: 1, abilities: ['dash', 'persist', 'fly', 'fuel'], tech: null, ship: false },
  tank: { cost: 60, hp: 40, attack: 5, defense: 4, move: 1, range: 1, vision: 1, abilities: ['dash'], tech: null, ship: false },
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
  // Kult: Masse statt Klasse, etwa 20 % weniger LP und Angriff als vergleichbare Einheiten, dafuer billiger (CULT)
  // cult: mass over class, about 20 % less HP and attack than comparable units, but cheaper (CULT)
  zealot: { cost: 7, hp: 7, attack: 1.6, defense: 1.5, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify', 'preach'], tech: null, ship: false, faction: 'vesper' },
  torchbearer: { cost: 14, hp: 7, attack: 2.8, defense: 1, move: 1, range: 1, vision: 1, abilities: ['dash', 'burn', 'preach'], tech: 'forestry', ship: false, faction: 'vesper' },
  prophet: { cost: 22, hp: 7, attack: 0, defense: 1.5, move: 1, range: 1, vision: 2, abilities: ['heal', 'convert', 'preach'], tech: 'camouflage', ship: false, faction: 'vesper' },
  doomBuggy: { cost: 13, hp: 7, attack: 2, defense: 1, move: 2, range: 1, vision: 1, abilities: ['dash', 'escape'], tech: 'motorization', ship: false, faction: 'vesper' },
  rocketCart: { cost: 30, hp: 7, attack: 3.2, defense: 0, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: 'ballistics', ship: false, faction: 'vesper' },
  doomCrawler: { cost: 40, hp: 21, attack: 3.2, defense: 3, move: 1, range: 1, vision: 1, abilities: ['dash', 'preach'], tech: 'armsIndustry', ship: false, faction: 'vesper' },
  android: { cost: 12, hp: 10, attack: 2, defense: 2, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false, faction: 'nexus', compute: 0 },
  spider: { cost: 25, hp: 12, attack: 3, defense: 2, move: 1, range: 1, vision: 1, abilities: ['dash', 'walker'], tech: null, ship: false, faction: 'nexus', compute: 1 },
  quadDrone: { cost: 35, hp: 10, attack: 3, defense: 1, move: 3, range: 1, vision: 2, abilities: ['dash', 'fly'], tech: null, ship: false, faction: 'nexus', compute: 2 },
  railgun: { cost: 45, hp: 10, attack: 4.5, defense: 0.5, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: null, ship: false, faction: 'nexus', compute: 3 },
  titan: { cost: 60, hp: 35, attack: 4.5, defense: 3.5, move: 1, range: 1, vision: 1, abilities: ['dash'], tech: null, ship: false, faction: 'nexus', compute: 4 },
  tripod: { cost: 55, hp: 25, attack: 4.5, defense: 2, move: 1, range: 2, vision: 2, abilities: ['deathRay', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  // Konter-Einheiten (Schere-Stein-Papier, siehe COUNTER) / counter units (rock-paper-scissors, see COUNTER)
  // Panzerabwehr-Trupp: muss stehen bleiben (kein Sturm), Reichweite 2, stark gegen Fahrzeuge, schwach gegen Infanterie
  // anti-tank squad: must stand still (no dash), range 2, strong vs vehicles, weak vs infantry
  antiTank: { cost: 20, hp: 10, attack: 2, defense: 1.5, move: 1, range: 2, vision: 1, abilities: ['fortify'], tech: null, ship: false, bonusVs: { vehicle: 2.5, foot: 0.6 } },
  // Flakpanzer: stark gegen Flieger, Feuerzone trifft Flieger, die daneben ihren Zug beenden / AA vehicle: strong vs flyers, fire zone hits flyers ending their turn next to it
  antiAir: { cost: 30, hp: 15, attack: 2, defense: 2.5, move: 1, range: 2, vision: 2, abilities: ['dash', 'flak'], tech: null, ship: false, bonusVs: { air: 2, vehicle: 0.6, foot: 0.6 } },
  // Minenleger: legt verdeckte Minen auf Nachbarfelder / mine layer: lays hidden mines on adjacent tiles
  mineLayer: { cost: 25, hp: 12, attack: 1, defense: 2, move: 1, range: 1, vision: 1, abilities: ['mines'], tech: null, ship: false },
  // Kult: Panzerfaust-Eiferer / cult: rocket zealot
  faustZealot: { cost: 14, hp: 7, attack: 1.6, defense: 1.5, move: 1, range: 2, vision: 1, abilities: ['fortify', 'preach'], tech: 'armsIndustry', ship: false, faction: 'vesper', bonusVs: { vehicle: 2.5, foot: 0.6 } },
  // NEXUS: Flak-Drohne (Bodenplattform, fliegt selbst nicht) / NEXUS: flak drone (ground platform, does not fly itself)
  flakDrone: { cost: 30, hp: 12, attack: 2, defense: 2, move: 1, range: 2, vision: 2, abilities: ['dash', 'flak'], tech: null, ship: false, faction: 'nexus', compute: 2, bonusVs: { air: 2, vehicle: 0.6, foot: 0.6 } },
  // Einzigartige Einheiten (siehe UNIQUE) / unique units (see UNIQUE)
  // Korvat: Steppenreiter, billig und schnell, Fusstruppe (kein Fahrzeug) / Steppe Riders, cheap and fast, foot troops (no vehicle)
  steppeRider: { cost: 14, hp: 10, attack: 2, defense: 1, move: 2, range: 1, vision: 1, abilities: ['dash'], tech: null, ship: false, faction: 'korvat' },
  // Dravon: Sturmbrecher, Angriffe ohne Gegenschlag, aber verwundbar / Stormbreakers, attacks draw no retaliation, but vulnerable
  stormbreaker: { cost: 30, hp: 15, attack: 4, defense: 1.5, move: 1, range: 1, vision: 1, abilities: ['dash', 'shock'], tech: null, ship: false, faction: 'dravon' },
  // Alvenia: Ordenswacht (ID aus alten Spielstaenden), Verteidiger mit Selbstheilung / Order Guard (ID from old saves), defenders with self-repair
  peacekeeper: { cost: 20, hp: 15, attack: 2, defense: 3, move: 1, range: 1, vision: 1, abilities: ['fortify', 'mend'], tech: null, ship: false, faction: 'alvenia' },
  // Meridon: Kaperschiff (Aufruestung wie andere Schiffe), Beute je Abschuss / Privateer (upgrade like other ships), prize per kill
  privateer: { cost: 20, hp: 0, attack: 2.5, defense: 1.5, move: 4, range: 1, vision: 2, abilities: ['carry', 'dash', 'plunder'], tech: null, ship: true, faction: 'meridon' },
  // Velkar: Prototyp-Laeufer, Flaechenschaden auf Reichweite 2, teuer / Prototype Walker, splash at range 2, expensive
  protoWalker: { cost: 60, hp: 25, attack: 4, defense: 2.5, move: 1, range: 2, vision: 2, abilities: ['splash', 'walker'], tech: null, ship: false, faction: 'velkar' },
  // Velkar-Varianten (siehe VARIANTS, Treffsicherheit HIT.unit) / Velkar variants (see VARIANTS, accuracy HIT.unit)
  // Tesla-Panzer: wie der Panzer, aber Angriff +40 % und eigene Trefferchancen (oft daneben) / Tesla tank: like the tank, but attack +40 % and own hit odds (often misses)
  teslaTank: { cost: 60, hp: 40, attack: 7, defense: 4, move: 1, range: 1, vision: 1, abilities: ['dash'], tech: null, ship: false, faction: 'velkar' },
  // Oktokopter: Werte des Kampfhubschraubers / octocopter: the attack helicopter's values
  octocopter: { cost: 50, hp: 10, attack: 3.5, defense: 1, move: 3, range: 1, vision: 1, abilities: ['dash', 'persist', 'fly', 'fuel'], tech: null, ship: false, faction: 'velkar' },
  // Railgun-Schuetze: Reichweite 3, schiesst nur aus dem Stand (kein Sturm), praezise / railgun marksman: range 3, fires only from a standstill (no dash), precise
  railSniper: { cost: 20, hp: 10, attack: 2.5, defense: 1, move: 1, range: 3, vision: 1, abilities: ['fortify'], tech: null, ship: false, faction: 'velkar' },
  // Alvenia-Varianten (siehe VARIANTS): Fernkampf aus dem Stand, starke Verteidigung / Alvenia variants (see VARIANTS): ranged from a standstill, strong defence
  // Lichtschuetzen: Reichweite 2, schiessen nur aus dem Stand (kein Sturm), gute Verteidigung, schwacher Angriff / Light Wardens: range 2, fire only from a standstill (no dash), good defence, weak attack
  lightWarden: { cost: 12, hp: 10, attack: 1.6, defense: 2.5, move: 1, range: 2, vision: 1, abilities: ['fortify'], tech: null, ship: false, faction: 'alvenia' },
  // Reliquiar: Panzer mit Reichweite 2 und schwerer Panzerung, schiesst nur aus dem Stand / Reliquary: tank with range 2 and heavy armour, fires only from a standstill
  reliquary: { cost: 60, hp: 40, attack: 4.5, defense: 5.5, move: 1, range: 2, vision: 1, abilities: [], tech: null, ship: false, faction: 'alvenia' },
  // Sonnenlanze: Artillerie mit Reichweite 4 / Sun Lance: artillery with range 4
  sunLance: { cost: 45, hp: 10, attack: 4, defense: 0.5, move: 1, range: 4, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: null, ship: false, faction: 'alvenia' },
  // Wunder der Siegbedingungen (siehe WONDERS): Bauwerke mit eigenen LP, Bewegung 0 / victory wonders (see WONDERS): structures with own HP, movement 0
  portal: { cost: null, hp: 40, attack: 0, defense: 3, move: 0, range: 0, vision: 2, abilities: ['wonder'], tech: 'dimensionalRift', ship: false, faction: 'zyrr' },
  hackRelay: { cost: null, hp: 30, attack: 0, defense: 2.5, move: 0, range: 0, vision: 2, abilities: ['wonder'], tech: 'singularity', ship: false, faction: 'nexus' },
  fusionPlant: { cost: null, hp: 45, attack: 0, defense: 3, move: 0, range: 0, vision: 2, abilities: ['wonder'], tech: 'fusionResearch', ship: false, faction: 'velkar' },
  // Waal: schiesst erst nach der ersten Bauphase (Reichweite 2), faehrt nie / Waal: fires only after the first build phase (range 2), never drives
  waal: { cost: null, hp: 60, attack: 5, defense: 4, move: 0, range: 2, vision: 2, abilities: ['wonder'], tech: 'waalProgram', ship: false, faction: 'dravon' },
  // Erdkernbohrer: beweglich, von einem Propheten im Feld gerufen (CULT.recruiters) / earth-core drill: mobile, called up in the field by a prophet (CULT.recruiters)
  coreDrill: { cost: WONDERS.cost.coreDrill, hp: 20, attack: 0, defense: 2.5, move: 1, range: 0, vision: 1, abilities: ['wonder'], tech: 'coreDrilling', ship: false, faction: 'vesper' },
  // Endgegner: Schwarmmutter Xyl'Tharra, schwebt, Reichweite 2, Faehigkeiten siehe SWARM_MOTHER / boss: Swarm Mother Xyl'Tharra, floats, range 2, abilities see SWARM_MOTHER
  swarmMother: { cost: null, hp: 60, attack: 5, defense: 4, move: 1, range: 2, vision: 2, abilities: ['boss', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  // Kampagne m2: Wissenschaftler, kaempft nicht, arbeitet am Mutterschiff (M2); Bewegung 2 fuer den weiten Weg zur Kartenmitte,
  // Schutzanzug (18 LP, Verteidigung 3), weil ihn im Wettlauf alle jagen
  // campaign m2: scientist, no combat, works on the mothership (M2); movement 2 for the long way to the map centre,
  // protective suit (18 HP, defence 3) because everyone hunts it in the race
  scientist: { cost: null, hp: 18, attack: 0, defense: 3, move: 2, range: 0, vision: 1, abilities: [], tech: null, ship: false },
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
export const VELKAR_UNITS: VelkarUnitId[] = ['teslaTank', 'octocopter', 'railSniper'];
export const ALVENIA_UNITS: AlveniaUnitId[] = ['lightWarden', 'reliquary', 'sunLance'];

/**
 * Fraktionsvarianten: die eigene Bauart ersetzt eine Grundeinheit in Liste, Stadtbelohnung und Kampagnen-Verstaerkung.
 * Velkar: Tesla-Panzer statt Panzer, Oktokopter statt Kampfhubschrauber, Railgun-Schuetze statt Scharfschuetze.
 * Faction variants: the own design replaces a base unit in the roster, the city reward and campaign reinforcements.
 * Velkar: Tesla tank instead of tank, octocopter instead of attack helicopter, railgun marksman instead of sniper.
 */
export const VARIANTS: Partial<Record<FactionId, Partial<Record<UnitTypeId, UnitTypeId>>>> = {
  velkar: { tank: 'teslaTank', heli: 'octocopter', sniper: 'railSniper' },
  // Heiliges Alvenia: Lichtschuetzen statt Infanterie, Reliquiar statt Panzer, Sonnenlanze statt Artillerie
  // Holy Alvenia: Light Wardens instead of infantry, Reliquary instead of the tank, Sun Lance instead of artillery
  alvenia: { infantry: 'lightWarden', tank: 'reliquary', artillery: 'sunLance' },
};

/**
 * Die eine Fahrzeugliste (Klasse 'vehicle', inkl. Laeufer, Mechs und Erdkernbohrer). Konter, Panzersperre, Schnee,
 * Dschungel und Wracks lesen alle diese Liste. Wunder-Bauwerke (auch der Waal) sind Klasse 'structure', nicht hier.
 * The one vehicle list (class 'vehicle', incl. walkers, mechs and the earth-core drill). Counters, tank barrier, snow,
 * jungle and wrecks all read this list. Wonder structures (the Waal too) are class 'structure', not listed here.
 */
export const VEHICLE_UNITS: UnitTypeId[] = [
  'jeep', 'tank', 'artillery', 'antiAir', 'mineLayer', 'doomBuggy', 'rocketCart', 'doomCrawler',
  'spider', 'railgun', 'titan', 'flakDrone', 'mech', 'tripod', 'protoWalker', 'coreDrill', 'teslaTank', 'reliquary', 'sunLance',
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
  /**
   * Lichtdom (ID embassyPalace aus alten Spielstaenden): Opfergaben (feste Sterne je Runde) und Busszehnt (Sterne je Runde und je als
   * Suender gezeichneter Fraktion, hoechstens so viele Fraktionen).
   * Cathedral of Light (ID embassyPalace from old saves): offerings (fixed stars per round) and penance tithe (stars per round per
   * faction marked as a sinner, at most this many factions).
   */
  cathedralBase: 2,
  cathedralPerSinner: 3,
  cathedralMaxSinners: 3,
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
export const UPKEEP = { freeUnits: 4, share: 0.3, flat: { tank: 12, teslaTank: 12, reliquary: 12 } as Partial<Record<UnitTypeId, number>> };

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

/**
 * Kult der Letzten Stunde: pluendert Staedte statt sie zu bewirtschaften und rekrutiert nur im Feld.
 * Cult of the Final Hour: plunders cities instead of running them and recruits in the field only.
 * Kult-Staedte bringen kein Einkommen, wachsen nicht, bilden nicht aus und haben keine Ausbauten oder Grossprojekte;
 * sie stellen nur Plaetze fuer das Einheitenlimit (Stadtlimit wie bei allen: Stufe + 1). Der Kult zahlt keinen Sold.
 * Cult cities bring no income, do not grow, do not train and have no upgrades or grand projects; they only provide
 * slots for the unit cap (city limit as for everyone: level + 1). The cult pays no upkeep.
 */
export const CULT = {
  faction: 'vesper' as FactionId,
  /**
   * Pluenderung beim Einnehmen: base + perLevel x Stufe (+ hq fuer ein Hauptquartier). Dieselbe Stadt zahlt erst wieder,
   * wenn ihre letzte Pluenderung mindestens replunderRounds Runden her ist (kein Hin-und-her-Farmen).
   * Plunder on capture: base + perLevel x level (+ hq for a headquarters). The same city pays again only once its last
   * plunder is at least replunderRounds rounds ago (no back-and-forth farming).
   */
  plunderBase: 20,
  plunderPerLevel: 12,
  plunderHq: 40,
  replunderRounds: 6,
  /**
   * Abnehmende Beute: die n-te Pluenderung derselben Stadt zahlt plunderDecay[n] (danach der letzte Wert). Gegen das
   * Melken weniger Staedte im Zweikampf.
   * Diminishing loot: the n-th plunder of the same city pays plunderDecay[n] (then the last value). Against milking
   * a few cities in a duel.
   */
  plunderDecay: [1, 0.5, 0.25],
  /** Punkte je gepluendertem Stern bei vier und mehr Gegnern (Beute zaehlt dauerhaft) / points per plundered star with four or more rivals (loot counts permanently) */
  plunderScore: 7,
  /** Punkte je Stern nach Zahl der Gegner (Index = Gegner, danach plunderScore) / points per star by number of rivals (index = rivals, then plunderScore) */
  plunderScoreByRivals: [7, 4, 5, 6, 7],
  /**
   * Einheitenlimit des Kults: baseCap plus die Plaetze seiner Staedte (Stadtlimit, eigenes Hauptquartier + hqSlots,
   * Schrein im Stadtgebiet + shrineSlots). Wunder zaehlen nicht.
   * Unit cap of the cult: baseCap plus the slots of its cities (city limit, own headquarters + hqSlots, shrine in the
   * city territory + shrineSlots). Wonders do not count.
   */
  baseCap: 3,
  hqSlots: 1,
  shrineSlots: 2,
  /**
   * Rekrutieren im Feld: wer welche Einheiten auf ein freies Nachbarfeld ruft. Danach ist der Rekrutierer fuer diesen Zug
   * erschoepft und erst nach recruitCooldown Runden wieder bereit; der Rekrut handelt ab dem naechsten Zug.
   * Recruiting in the field: who calls which units onto a free adjacent tile. Afterwards the recruiter is exhausted for
   * this turn and ready again only after recruitCooldown rounds; the recruit acts from the next turn.
   */
  recruiters: {
    zealot: ['zealot', 'torchbearer', 'faustZealot', 'prophet'],
    torchbearer: ['zealot'],
    faustZealot: ['zealot'],
    prophet: ['zealot', 'torchbearer', 'faustZealot', 'prophet', 'doomBuggy', 'rocketCart', 'doomCrawler', 'coreDrill'],
    doomCrawler: ['zealot', 'doomBuggy', 'rocketCart'],
  } as Partial<Record<UnitTypeId, UnitTypeId[]>>,
  recruitCooldown: 2,
  /** Zehnt der Horde: Sterne je Runde pro Einheit (abgerundet), hoechstens titheMax / tithe of the horde: stars per round per unit (rounded down), at most titheMax */
  tithePerUnit: 1,
  titheMax: 16,
  /**
   * Zehnt hoechstens titheRival je gegnerischer Fraktion der Partie (Zweikampf 4, drei Fraktionen 8, vier 12, fuenf titheMax): mit
   * nur einem Opfer reicht die Beute auch ohne vollen Zehnt.
   * Tithe at most titheRival per rival faction of the game (duel 4, three factions 8, four 12, five titheMax): with only one
   * victim the loot suffices even without the full tithe.
   */
  titheRival: 4,
  /** Starthorde zusaetzlich zur Starteinheit, auf freien Feldern neben dem Hauptquartier / starting horde in addition to the start unit, on free tiles next to the HQ */
  startUnits: ['zealot', 'zealot', 'zealot'] as UnitTypeId[],
  /** Gebaeude, die der Kult bauen darf / buildings the cult may build */
  buildings: ['shrine', 'pilgrimSite', 'road', 'bridge'] as BuildingId[],
  /**
   * Mahnmal: stirbt ein Soldat (Fusstruppe jeder Fraktion, auch des Kults) an Land ausserhalb von Staedten, stellt der Kult
   * seine Leiche zur Schau, solange er im Spiel ist. Das Mahnmal haelt die Todesrunde plus memorialRounds Runden; ein neuer
   * Tod auf dem Feld erneuert die Dauer (kein Stapeln). Wer vom Mahnmal-Feld aus angreift: Kult-Einheiten +memorialAttack
   * Schaden, Einheiten menschlicher Rasse -memorialFear (Furcht); Roboter und Ausserirdische bleiben unberuehrt.
   * Memorial: when a soldier (foot troop of any faction, the cult's own included) dies on land outside cities, the cult
   * puts the corpse on display, as long as it is in the game. The memorial lasts the round of death plus memorialRounds
   * rounds; a new death on the tile refreshes the duration (no stacking). Attacking from the memorial tile: cult units
   * +memorialAttack damage, units of human race -memorialFear (fear); robots and aliens are unaffected.
   */
  memorialRounds: 6,
  memorialAttack: 0.2,
  memorialFear: 0.2,
};

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
export const INFANTRY_TYPES: UnitTypeId[] = ['infantry', 'mg', 'sniper', 'pioneer', 'railSniper', 'lightWarden'];

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
  /**
   * Eigene Grundwahrscheinlichkeiten einzelner Einheitentypen (Summe 1), ersetzen die der Rasse; Wetter wirkt wie bei der Rasse.
   * Ohne Trefferglueck skaliert der Erwartungswert dieser Tabelle gegenueber der Rassentabelle den Schaden (unitLuckFactor).
   * Own base odds of single unit types (sum 1), replacing the race odds; weather works as for the race.
   * Without hit luck, the expected value of this table relative to the race table scales the damage (unitLuckFactor).
   */
  unit: {
    // Tesla-Panzer: wuchtige Entladung, aber 38 % daneben; Erwartungswert 0,61 statt 0,90 (Mensch) / Tesla tank: huge discharge, but 38 % misses; expected 0.61 instead of 0.90 (human)
    teslaTank: { miss: 0.38, graze: 0.06, partial: 0.12, full: 0.36, crit: 0.08 },
    // Railgun-Schuetze: maschinengenau, kaum daneben, kaum kritisch; Erwartungswert 0,95 / railgun marksman: machine precision, hardly any misses or crits; expected 0.95
    railSniper: { miss: 0.02, graze: 0.04, partial: 0.14, full: 0.76, crit: 0.04 },
  } as Partial<Record<UnitTypeId, Record<HitKind, number>>>,
  /**
   * Fraktionsbonus auf kritische Treffer (nach Besitzer, nur menschliche Einheiten): dieser Anteil wandert von vollen zu
   * kritischen Treffern. Dravon "Gezielter Schuss": +8 Punkte (10 % -> 18 %). Ohne Trefferglueck steigt der Schaden um den
   * Erwartungswert (unitLuckFactor).
   * Faction bonus on critical hits (by owner, human units only): this share moves from full to critical hits.
   * Dravon "Aimed Shot": +8 points (10 % -> 18 %). Without hit luck, damage rises by the expected value (unitLuckFactor).
   */
  factionCrit: { dravon: 0.08 } as Partial<Record<FactionId, number>>,
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

/**
 * Feuern nach Bewegung: Wer in diesem Zug gezogen ist (Befehl Bewegen) und danach angreift, macht nur diesen Anteil des
 * Schadens, vor dem Trefferglueck. Gilt fuer jeden eigenen Angriff (Nahkampf, Fernkampf, Raketen, Geschuetze, Flaechenschaden),
 * nicht fuer den Gegenschlag des Verteidigers.
 * Firing after moving: a unit that moved this turn (move command) and attacks afterwards deals only this share of the
 * damage, before hit luck. Applies to every own attack (melee, ranged, rockets, guns, splash), not to the defender's return fire.
 */
export const MOVE_FIRE = {
  damage: 0.5,
  /**
   * Fraktionsbonus nach Besitzer: all = Faktor fuer alle Einheiten, units = eigener Faktor je Einheitentyp.
   * Korvat "Steppensturm": alle 75 %, Steppenreiter 100 %. Ein bekehrter Steppenreiter verliert ihn (Besitzer zaehlt).
   * Dravon "Feuer und Bewegung": alle 100 %, kein Abzug nach Bewegung (die am besten ausgebildeten Soldaten).
   * Faction bonus by owner: all = factor for all units, units = own factor per unit type.
   * Korvat "Steppe Storm": all 75 %, Steppe Riders 100 %. A converted Steppe Rider loses it (the owner counts).
   * Dravon "Fire and Manoeuvre": all 100 %, no penalty after moving (the best-trained soldiers).
   */
  bonus: {
    korvat: { all: 0.75, units: { steppeRider: 1 } },
    dravon: { all: 1 },
  } as Partial<Record<FactionId, { all: number; units?: Partial<Record<UnitTypeId, number>> }>>,
};

/**
 * Verteidigung auf eigenem Gebiet je Fraktion (Anteil): wirkt auf den Verteidigungswert, wenn die Einheit angegriffen wird,
 * als eigener Faktor nach Deckung, Stadt, Gelaende und Fernkampfdeckung; nicht beim eigenen Angriff, nicht fuer den Gegenschlag.
 * Alvenia "Glaubensbollwerk": +30 % (vorher Friedensbollwerk +25 %).
 * Defence on own territory per faction (share): applies to the defence value when the unit is attacked, as its own factor
 * after cover, city, terrain and ranged cover; not when attacking, not for return fire. Alvenia "Bulwark of Faith": +30 % (formerly Peace Bulwark +25 %).
 */
export const HOME_DEFENSE = {
  bonus: { alvenia: 0.3 } as Partial<Record<FactionId, number>>,
};

/** Suendentaten / sinful deeds */
export type SinDeed = 'plunder' | 'burn' | 'convert' | 'capture' | 'breakPeace' | 'sacrilege' | 'godless';
export const SIN_DEEDS: SinDeed[] = ['plunder', 'burn', 'convert', 'capture', 'breakPeace', 'sacrilege', 'godless'];

/**
 * Suende und Strafgericht (Heiliges Alvenia). Eine Fraktion, die eine Suendentat begeht, ist rounds Runden als Suender
 * gezeichnet (die Runde der Tat zaehlt mit); jede neue Tat frischt das Zeichen auf. Taten: Pluendern (Kult), Brandschatzen
 * (Brand-Angriff), Bekehren feindlicher Einheiten, Erobern einer Stadt einer anderen Fraktion, Friedensbruch (Ankuendigung),
 * Frevel (Angriff auf eine Einheit der richtenden Fraktion; gezeichnet erst nach dem Angriff, die Vorschau bleibt genau).
 * Gezeichnet wird nur, solange eine richtende Fraktion (Merkmal 'judgement') lebt; sie selbst wird nie gezeichnet.
 * Strafgericht: Einheiten der richtenden Fraktion machen gegen Einheiten von Suendern judgement mehr Schaden (Angriff und
 * Gegenschlag), vor dem Trefferglueck.
 * Sin and Judgement (Holy Alvenia). A faction that commits a sinful deed is marked as a sinner for rounds rounds (the round
 * of the deed counts); every new deed refreshes the mark. Deeds: plundering (cult), burning (burn attack), converting hostile
 * units, capturing a city of another faction, breaking a peace (announcement), sacrilege (attacking a unit of the judging
 * faction; marked only after the attack, so the preview stays exact). Marks are only given while a judging faction
 * (perk 'judgement') lives; it is never marked itself.
 * Judgement: units of the judging faction deal judgement more damage to units of sinners (attack and return fire), before
 * hit luck.
 * Gottlos: Fraktionen der Rassen in godless (Ausserirdische, Roboter: Zyrr und NEXUS) sind ohne Tat dauerhaft Suender,
 * solange eine richtende Fraktion lebt ("gottlose Kreaturen"). Der Busszehnt des Lichtdoms zaehlt nur Suender mit einer Tat.
 * Godless: factions of the races in godless (aliens, robots: Zyrr and NEXUS) are permanent sinners without a deed while a
 * judging faction lives ("godless creatures"). The Cathedral of Light's penance tithe counts only sinners with a deed.
 */
export const SIN = {
  godless: ['alien', 'robot'] as HitRace[],
  rounds: 2,
  judgement: 0.35,
};

/**
 * Maertyrer-Segen (Alvenia, zweites Merkmal): faellt eine eigene Einheit im Kampf, heilen eigene Einheiten daneben heal LP
 * und verteidigen sich rounds Runden (diese und die naechste) mit +defense, als Faktor auf den Verteidigungswert.
 * Martyr's Blessing (Alvenia, second trait): when an own unit falls in battle, own adjacent units heal heal HP and defend
 * with +defense for rounds rounds (this one and the next), as a factor on the defence value.
 */
export const MARTYR = {
  heal: 3,
  defense: 0.3,
  rounds: 2,
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
  skeletonUnits: ['infantry', 'sniper', 'pioneer', 'mg', 'medic', 'spy', 'antiTank', 'steppeRider', 'stormbreaker', 'peacekeeper', 'scientist', 'railSniper', 'lightWarden'] as UnitTypeId[],
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
  units: ['tank', 'teslaTank', 'reliquary'] as UnitTypeId[],
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
  rain: { rangeUnits: ['artillery', 'sunLance'] as UnitTypeId[], rangeDelta: -1, moveUnits: ['heli', 'octocopter'] as UnitTypeId[], moveDelta: -1 },
  /** Schnee: alle Fahrzeuge (VEHICLE_UNITS) 1 Feld weniger, mindestens 1 / snow: all vehicles (VEHICLE_UNITS) 1 tile less, at least 1 */
  snow: { moveUnits: VEHICLE_UNITS, moveDelta: -1 },
  /** Wind: Hubschrauber verbrauchen 2 Tankfuellungen pro Runde / wind: helicopters burn 2 fuel per round */
  wind: { fuelBurn: 2 },
  /**
   * Sandsturm: Einheiten ab Reichweite rangeFrom 1 Feld weniger Reichweite, Hubschrauber 1 Feld weniger Bewegung.
   * Dust storm: units with range rangeFrom or more lose 1 range, helicopters lose 1 move.
   */
  dust: { rangeFrom: 2, rangeDelta: -1, moveUnits: ['heli', 'octocopter'] as UnitTypeId[], moveDelta: -1, visionDelta: -1 },
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

/**
 * Orbitallaser der Velkar: ein Satelliten-Relay (Stadt-Ausbau, siehe CITY_UPGRADES) erlaubt alle cooldown Runden einen
 * Schuss aus dem Orbit auf eine Flaeche area (w x h Felder, Zielfeld = linke obere Ecke, am Kartenrand nach innen
 * geschoben). Fester Schaden an allem in der Flaeche, auch an eigenen Einheiten; ohne Trefferglueck.
 * Velkar orbital laser: a satellite relay (city upgrade, see CITY_UPGRADES) allows one shot from orbit every cooldown
 * rounds on an area (w x h tiles, target tile = top-left corner, shifted inwards at the map edge). Flat damage to
 * everything in the area, own units included; without hit luck.
 */
export const ORBITAL = {
  faction: 'velkar' as FactionId,
  relay: 'satRelay' as const,
  /** Preis des Relays (Stadt-Ausbau) / price of the relay (city upgrade) */
  relayCost: 40,
  /** Runden zwischen zwei Schuessen; auch die Aufladezeit nach dem Bau / rounds between two shots; also the charge time after building */
  cooldown: 5,
  /** Flaeche in Feldern (Breite x Hoehe) / area in tiles (width x height) */
  area: { w: 2, h: 2 },
  /** fester Schaden je Treffer / flat damage per hit */
  damage: 2,
  /** Zielfeld muss fuer den Schuetzen aufgedeckt sein / the target tile must be revealed for the shooter */
  needsVision: true,
  /**
   * KI: Schuss nur bei Nettowert >= minValue (Sterne-Gegenwert: Schaden/LP x Wert x damageWeight, Abschuss = Wert x (1 + killBonus));
   * eigene Einheiten zaehlen ownWeight-fach negativ. Relay-Wert: shotStars je Schuss bis horizon Runden; techBonus je Stufe der Technik.
   * AI: fire only at a net value >= minValue (star equivalent: damage/HP x worth x damageWeight, kill = worth x (1 + killBonus));
   * own units count ownWeight times negative. Relay value: shotStars per shot up to horizon rounds; techBonus per tier of the tech.
   */
  ai: {
    minValue: 4, ownWeight: 1.6, killBonus: 1, damageWeight: 1.5, bossWorth: 120, gunWorth: 40, wonderInterrupt: 25,
    horizon: 25, shotStars: 18, techBonus: 10,
    /** Relay erst ab so vielen eigenen Staedten (vorher geht Wachstum vor) / relay only from this many own cities (growth first) */
    minCities: 3,
  },
};

/** Stadt-Ausbauten in Slots / city upgrades in slots */
export type CityUpgradeId = 'radioTower' | 'bunker' | 'barracks' | 'hospital' | 'flak' | 'depot' | 'satRelay';
export const CITY_UPGRADE_IDS: CityUpgradeId[] = ['radioTower', 'bunker', 'barracks', 'hospital', 'flak', 'depot', 'satRelay'];
export const CITY_UPGRADES = {
  slots: 3,
  cost: { radioTower: 15, bunker: 25, barracks: 35, hospital: 20, flak: 30, depot: 30, satRelay: ORBITAL.relayCost } as Record<CityUpgradeId, number>,
  /**
   * Freischaltung durch Forschung; Fraktionen ohne Forschung brauchen stattdessen die Stadtstufe (Stufe der Technologie + 1).
   * Unlock by research; factions without research need the city level instead (tech tier + 1).
   */
  tech: { hospital: 'supply', barracks: 'mountainTraining', radioTower: 'aerodynamics', bunker: 'fortification', flak: 'ballistics', depot: 'logistics', satRelay: 'highAltitude' } as Record<CityUpgradeId, TechId>,
  /** Ausbauten nur fuer eine Fraktion (Satelliten-Relay: Velkar) / upgrades for one faction only (satellite relay: Velkar) */
  faction: { satRelay: 'velkar' } as Partial<Record<CityUpgradeId, FactionId>>,
  /** hoechstens so viele je Fraktion zugleich / at most this many per faction at a time */
  perFaction: { satRelay: 1 } as Partial<Record<CityUpgradeId, number>>,
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
  craterUnits: ['artillery', 'battleship', 'tank', 'reliquary', 'sunLance'] as UnitTypeId[],
  maxPerTile: 4,
  /**
   * Schlachtfeld (optisch, Tile.scar): Kampfintensitaet je Feld in Punkten. Jeder Treffer, jeder Tod und jede Explosion
   * erhoeht sie (gewichtet nach Waffe), gedeckelt bei max. Ab light / medium / heavy Punkten zeigt die Karte leichte
   * Spuren, aufgewuehlte Erde oder verwuestetes Land. Nach healAfter Runden ohne Kampf holt sich die Natur das Feld
   * zurueck: alle healEvery Runden ein Punkt weniger; bei 0 verschwinden auch die Krater. Keine Wirkung auf die Regeln.
   * Battlefield (visual, Tile.scar): fighting intensity per tile in points. Every hit, death and explosion raises it
   * (weighted by weapon), capped at max. From light / medium / heavy points the map shows light marks, churned earth or
   * devastated land. After healAfter rounds without fighting nature reclaims the tile: one point less every healEvery
   * rounds; at 0 the craters vanish too. No effect on the rules.
   */
  scar: {
    /** Treffer leichter Waffen (Gewehr, MG, Jeep ...) / hit by light weapons (rifle, MG, jeep ...) */
    hit: 1,
    /** Treffer schwerer Waffen (craterUnits) und Raketen / hit by heavy weapons (craterUnits) and rockets */
    heavyHit: 3,
    /** Flaechenschaden auf Nachbarfeldern / splash damage on adjacent tiles */
    splash: 1,
    /** Gegenfeuer auf das Feld des Angreifers / return fire on the attacker's tile */
    returnFire: 1,
    /** Tod einer Einheit (Skelett) / death of a unit (skeleton) */
    death: 2,
    /** Zerstoertes Fahrzeug, Schiff oder Flieger (Wrack) / destroyed vehicle, ship or flyer (wreck) */
    wreck: 3,
    /** Minenexplosion / mine explosion */
    mine: 4,
    /** Orbitalschlag je getroffenem Feld / orbital strike per struck tile */
    orbital: 5,
    /** Treffer eines Geschuetzes (Verdan-Linie, Geschuetzstellung) / hit by a gun (Verdan line, emplacement) */
    turret: 2,
    /** Meteoreinschlag (Wetter) / meteor impact (weather) */
    meteor: 1,
    /** Grosse Explosion (fuer kuenftige Kamikaze-/Sprengeffekte, addBattleScar) / big blast (for future kamikaze/blast effects, addBattleScar) */
    blast: 4,
    max: 30,
    light: 1,
    medium: 6,
    heavy: 16,
    healAfter: 8,
    healEvery: 2,
    /** Rauchfahnen ueber schwer umkaempften Feldern, solange der letzte Kampf so viele Runden her ist / smoke over heavy tiles while the last fight is this many rounds ago */
    smokeRounds: 2,
  },
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
   * (erst ab Runde techRound und techCities Staedten; Faktor in der Eroberung 0, weil der Forschungsschub dort die Endspiele
   * messbar verschleppte), Mindestanteil der Wunscharmee, Preis einer feindlichen Stellung fuer Angreifer.
   * AI: star reserve for builds without a threat, threat radius around the site, maximum distance to the own city,
   * minimum value of a site, desired pioneer share while slots are free, bonus for the Fortification tech (only from round
   * techRound and techCities cities; factor 0 in conquest because the research push measurably dragged out the endgames),
   * minimum share of the desired army, prize of a hostile emplacement for attackers.
   */
  ai: { reserve: 30, armyShare: 0.8, threatRange: 5, cityRange: 3, minValue: 9, pioneerShare: 0.35, techBonus: 60, techConquest: 0, techRound: 8, techCities: 2, prize: 30 },
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
  // Marinestuetzpunkt: Einschiffung und Produktionsstaette der Schiffe (PRODUCTION), ohne Forschung / naval base: embarking and production site of ships (PRODUCTION), no research
  navalBase: { cost: 35, pop: 1, tech: null, terrain: ['shallow'] },
  road: { cost: 15, pop: 0, tech: 'roadbuilding', terrain: ['plain', 'forest', 'mountain'] },
  bridge: { cost: 25, pop: 0, tech: 'roadbuilding', terrain: ['shallow'] },
  researchCenter: { cost: 100, pop: 1, tech: null, terrain: ['plain', 'forest', 'mountain', 'shallow'], onePerCity: true },
  // Nur Zyrr, nur auf Xeno-Boden / Zyrr only, only on xeno ground
  xenoHive: { cost: 15, pop: 2, tech: null, terrain: ['plain', 'forest', 'mountain'] },
  // Schrein: Plaetze fuer das Einheitenlimit (CULT.shrineSlots), keine Bevoelkerung (Kult-Staedte wachsen nicht) / shrine: slots for the unit cap (CULT.shrineSlots), no population (cult cities do not grow)
  shrine: { cost: 20, pop: 0, tech: null, terrain: ['plain', 'forest'], onePerCity: true },
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
  // Alvenia: Klosterweingut (ID hillVineyard aus alten Spielstaenden) auf Ebenen im Huegelland / monastery vineyard (ID hillVineyard from old saves) on plains in the hills
  hillVineyard: { cost: 30, pop: 2, tech: 'agritech', terrain: ['plain'], biomes: ['hills'], onePerCity: true, stars: 2 },
  // Meridon: Handelshafen auf Fischgruenden, Ausbau der Fischerei / trade harbour on fish, upgrade of the fishery
  tradeHarbour: { cost: 30, pop: 2, tech: 'shipbuilding', terrain: ['shallow'], resource: 'fish', upgrades: 'fishery', countsAs: 'fishery', stars: 2 },
  // Velkar: Polarstation in der Tundra / polar station in the tundra
  polarStation: { cost: 25, pop: 2, tech: 'highAltitude', terrain: ['plain', 'forest', 'mountain'], biomes: ['tundra'] },
  // Zyrr: Wrackschmelze auf einem Wrack oder einer geborgenen Absturzstelle, ohne Xeno-Boden / wreck smelter on a wreck or salvaged crash site, without xeno ground
  wreckSmelter: { cost: 20, pop: 2, tech: null, terrain: ['plain', 'forest', 'mountain'], wreck: true, stars: 3 },
  // Vesper: Pilgerstaette in Wueste oder Steppe oder neben einem Vulkan / pilgrimage site in desert or steppe or next to a volcano
  // Pilgerstaette: Rekruten daneben starten als Veteranen; keine Sterne, keine Bevoelkerung / pilgrimage site: recruits next to it start as veterans; no stars, no population
  pilgrimSite: { cost: 25, pop: 0, tech: 'camouflage', terrain: ['plain', 'forest'], biomes: ['desert', 'steppe'], nearVolcano: true, onePerCity: true },
  // NEXUS: Depotknoten auf Erz / depot node on ore
  depotNode: { cost: 25, pop: 1, tech: null, terrain: ['mountain'], resource: 'ore', compute: 1 },
  // Produktionsstaetten der Menschen (PRODUCTION): eine je Stadt, ohne Forschung / human production sites (PRODUCTION): one per city, no research
  trainingCamp: { cost: 10, pop: 0, tech: null, terrain: ['plain', 'forest'], onePerCity: true },
  armory: { cost: 20, pop: 0, tech: null, terrain: ['plain', 'forest'], onePerCity: true },
  motorPool: { cost: 20, pop: 0, tech: null, terrain: ['plain'], onePerCity: true },
  tankWorks: { cost: 40, pop: 0, tech: null, terrain: ['plain'], onePerCity: true },
  foundry: { cost: 30, pop: 0, tech: null, terrain: ['plain', 'forest'], onePerCity: true },
  airfield: { cost: 45, pop: 0, tech: null, terrain: ['plain'], onePerCity: true },
  dryDock: { cost: 30, pop: 0, tech: null, terrain: ['shallow'], onePerCity: true },
};

/** Produktionsstaetten / production sites */
export type ProductionSiteId = 'trainingCamp' | 'armory' | 'motorPool' | 'tankWorks' | 'foundry' | 'airfield' | 'navalBase' | 'dryDock';

/**
 * Produktionsstaetten der fuenf Menschen-Fraktionen: eine Stadt bildet eine Einheit nur aus, wenn in ihrem Gebiet die
 * passende Staette steht (Schiffe: Aufruesten im Gebiet einer solchen Stadt). Erobert man die Stadt, gehoert die Staette
 * dem neuen Besitzer (wirkt nur fuer Menschen). Kult, Zyrr und NEXUS behalten ihre Systeme (Stadtstufe, Horde, Rechenleistung).
 * Production sites of the five human factions: a city trains a unit only if the matching site stands in its territory
 * (ships: upgrading in the territory of such a city). Capturing the city hands the site to the new owner (works for
 * humans only). Cult, Zyrr and NEXUS keep their systems (city level, horde, compute).
 */
export const PRODUCTION = {
  /** Fraktionen mit Produktionsstaetten (statt Forschung fuer Einheiten) / factions with production sites (instead of research for units) */
  factions: ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'] as FactionId[],
  sites: ['trainingCamp', 'armory', 'motorPool', 'tankWorks', 'foundry', 'airfield', 'navalBase', 'dryDock'] as ProductionSiteId[],
  /**
   * Einheiten je Staette (Grundtypen und Fraktionsvarianten). Der Sturmbrecher (Dravon, Fusstruppe mit schwerer Ausruestung)
   * kommt aus dem Ruestungswerk: im Fahrzeugwerk passt er nicht, in der Kaserne waere er ab Runde 1 im HQ zu haben.
   * Units per site (base types and faction variants). The Stormbreaker (Dravon, foot troop with heavy gear) comes from the
   * armoury: it does not fit the motor pool, and in the barracks it would be available at the HQ from round 1.
   */
  units: {
    trainingCamp: ['infantry', 'pioneer', 'medic', 'sniper', 'spy', 'steppeRider', 'peacekeeper', 'lightWarden', 'railSniper'],
    armory: ['mg', 'antiTank', 'mineLayer', 'antiAir', 'stormbreaker'],
    motorPool: ['jeep'],
    tankWorks: ['tank', 'teslaTank', 'reliquary', 'protoWalker'],
    foundry: ['artillery', 'sunLance'],
    airfield: ['heli', 'octocopter'],
    navalBase: ['landingBoat', 'destroyer', 'privateer'],
    dryDock: ['submarine', 'battleship'],
  } as Record<ProductionSiteId, UnitTypeId[]>,
  /**
   * Eingebaute Kaserne: jedes Hauptquartier (auch ein erobertes), Sendetuerme und Nachschublinien bilden ohne eigenes Gebaeude
   * Infanterie aus.
   * Built-in barracks: every HQ (a captured one too), transmitter towers and supply lines train infantry without a building of their own.
   */
  builtIn: 'trainingCamp' as ProductionSiteId,
  /**
   * Zusaetzlich eingebaut im eigenen Hauptquartier je Fraktion: Dravon (Jeep-Rabatt, startete mit Motorisierung und Jeeps)
   * behaelt sein Fahrzeugwerk. Gilt nur, solange das Hauptquartier dem Gruender gehoert.
   * Additionally built into the own HQ per faction: Dravon (jeep discount, started with motorization and jeeps) keeps
   * its motor pool. Only while the HQ belongs to its founder.
   */
  hqSites: { dravon: ['motorPool'] } as Partial<Record<FactionId, ProductionSiteId[]>>,
  /**
   * Eingebaut in jeder Stadt der Fraktion, solange sie ihr gehoert: Korvat (Massenmobilisierung, Volksarmee) und Dravon
   * (Drill, auch in neu eroberten Staedten und Depots) haben ueberall eine Kaserne; der Eroberer bekommt sie nicht.
   * Built into every city of the faction while it owns it: Korvat (mass mobilisation, people's army) and Dravon (drill,
   * also in newly captured cities and depots) have barracks everywhere; the conqueror does not get them.
   */
  citySites: { korvat: ['trainingCamp'], dravon: ['trainingCamp'] } as Partial<Record<FactionId, ProductionSiteId[]>>,
  /**
   * Voraussetzung im Stadtgebiet beim Bau: eines dieser Gebaeude. Panzerwerk: Tagebau oder Tiefbauzeche (beide nur auf Erz),
   * Geschuetzgiesserei: Forstbetrieb (Holz fuer Lafetten), Trockendock: Marinestuetzpunkt. Geht die Voraussetzung spaeter
   * verloren, arbeitet die Staette weiter.
   * Prerequisite in the city territory when building: one of these buildings. Tank works: mine or deep mine (both only on
   * ore), foundry: lumber camp (wood for gun carriages), dry dock: naval base. If the prerequisite is lost later, the site keeps working.
   */
  needs: { tankWorks: ['mine', 'deepMine'], foundry: ['lumberCamp'], dryDock: ['navalBase'] } as Partial<Record<ProductionSiteId, BuildingId[]>>,
  /** Gebaeude, die Menschen ohne Forschung bauen (Rohstoffe der Staetten) / buildings humans build without research (raw materials of the sites) */
  noTech: ['mine', 'lumberCamp'] as BuildingId[],
};

/**
 * Doktrinen: Forschung der Menschen schaltet keine Einheiten mehr frei, sondern Vorteile. Je Doktrin eine Zahl; sie wirkt
 * nur fuer Fraktionen mit Produktionsstaetten (PRODUCTION.factions), Kult und NEXUS behalten die alte Forschung.
 * Doctrines: human research no longer unlocks units but advantages. One number per doctrine; it works only for factions
 * with production sites (PRODUCTION.factions), the cult and NEXUS keep the old research.
 */
export const DOCTRINE = {
  /** Motorisierung: Fahrzeuge (VEHICLE_UNITS) so viel billiger / motorization: vehicles this much cheaper */
  motorizationDiscount: 0.15,
  /** Aerodynamik: Flak (Flakpanzer und Flugabwehr-Ausbau) macht so viel mehr Schaden / aerodynamics: flak (AA vehicles and flak upgrade) deals this much more damage */
  aerodynamicsFlak: 2,
  /** Heeresflieger: Sprit pro Runde im eigenen Gebiet / army aviation: fuel burned per round in own territory */
  armyAviationHomeBurn: 0,
  /** Befestigung: eigene Minen machen so viel mehr Schaden / fortification: own mines deal this much more damage */
  fortificationMine: 3,
  /** Nachrichtendienst: Spione ziehen so viel weiter / intelligence: spies move this much further */
  intelligenceSpyMove: 1,
  /** Bergbau: Panzer aus dem Panzerwerk (Erz fuer Panzerstahl) so viel billiger / mining: tanks from the tank works (ore for armour steel) this much cheaper */
  miningDiscount: 0.1,
  /** Ruestungsindustrie: Angriff dieser Einheiten / arms industry: attack of these units */
  armsIndustryAttack: 0.1,
  armsIndustryUnits: ['mg', 'antiTank'] as UnitTypeId[],
  /** Kybernetik: Sanitaeter heilen so viel mehr (dazu der Forschungsrabatt ECON.cyberneticsDiscount) / cybernetics: medics heal this much more (plus the research discount) */
  cyberneticsMedic: 2,
  /** Marineartillerie: Angriff aller Schiffe / naval artillery: attack of all ships */
  navalArtilleryAttack: 0.2,
  /** Schiffbau: Aufruesten von Schiffen so viel billiger / shipbuilding: ship upgrades this much cheaper */
  shipbuildingDiscount: 0.25,
  /** Forstwirtschaft: Geschuetze aus der Giesserei (Holz fuer Lafetten) so viel billiger / forestry: guns from the foundry (wood for carriages) this much cheaper */
  forestryDiscount: 0.15,
  /** Ballistik: Reichweite dieser Einheiten / ballistics: range of these units */
  ballisticsRange: 1,
  ballisticsUnits: ['artillery', 'sunLance'] as UnitTypeId[],
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
  /** Klosterweingut: eigene Einheiten im Gebiet seiner Stadt heilen so viele LP mehr / monastery vineyard: own units in its city's territory heal this many HP more */
  vineyardHeal: 1,
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
  greatJudgement: { tier: 3, parent: 'fortification', branch: 1, faction: 'alvenia' },
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
export type Perk2Id = 'earthworks' | 'battleHardened' | 'martyrBlessing' | 'harbourPilots' | 'engineerCorps' | 'forestSpawn' | 'martyrdom' | 'sensorNet';

export interface FactionStats {
  perk: 'massMobilization' | 'drill' | 'judgement' | 'boom' | 'researchLead' | 'xenotech' | 'zealotry' | 'hivemind';
  /** zweites Merkmal (kleiner Dauerbonus) / second trait (small passive bonus) */
  perk2: Perk2Id;
  discountUnit: UnitTypeId;
  discount: number;
  startTech: TechId | null;
  /** weitere Starttechnologien (Sonderfraktionen ohne Forschung, Dravon) / extra start techs (special factions without research, Dravon) */
  extraTechs?: TechId[];
  /** weitere Starteinheiten neben dem Hauptquartier (freie Partie, nicht Kampagne) / extra start units next to the HQ (free game, not campaign) */
  startExtra?: UnitTypeId[];
  /** Gewichte fuer das Heimatgebiet / weights for the home region */
  home: { plain: number; forest: number; mountain: number; water: number; res: Partial<Record<ResourceId, number>> };
}

export const FACTION_IDS: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'vesper', 'nexus'];

export const FACTIONS: Record<FactionId, FactionStats> = {
  korvat: { perk: 'massMobilization', perk2: 'earthworks', discountUnit: 'infantry', discount: 0.2, startTech: 'livestock', home: { plain: 0.7, forest: 0.15, mountain: 0.05, water: 0.1, res: { farmland: 0.3, livestock: 0.15, supplies: 0.1 } } },
  dravon: { perk: 'drill', perk2: 'battleHardened', discountUnit: 'jeep', discount: 0.3, startTech: 'motorization', extraTechs: ['mountainTraining'], home: { plain: 0.45, forest: 0.15, mountain: 0.3, water: 0.1, res: { ore: 0.35, supplies: 0.1 } } },
  alvenia: { perk: 'judgement', perk2: 'martyrBlessing', discountUnit: 'sunLance', discount: 0.2, startTech: 'supply', home: { plain: 0.45, forest: 0.25, mountain: 0.2, water: 0.1, res: { supplies: 0.15, livestock: 0.15, farmland: 0.1, ore: 0.1 } } },
  meridon: { perk: 'boom', perk2: 'harbourPilots', discountUnit: 'spy', discount: 0.2, startTech: 'coastalEconomy', home: { plain: 0.4, forest: 0.15, mountain: 0.05, water: 0.4, res: { fish: 0.3, supplies: 0.1 } } },
  zyrr: { perk: 'xenotech', perk2: 'forestSpawn', discountUnit: 'grey', discount: 0, startTech: null, home: { plain: 0.45, forest: 0.2, mountain: 0.25, water: 0.1, res: { ore: 0.2, supplies: 0.15 } } },
  vesper: { perk: 'zealotry', perk2: 'martyrdom', discountUnit: 'zealot', discount: 0, startTech: 'livestock', home: { plain: 0.5, forest: 0.25, mountain: 0.15, water: 0.1, res: { livestock: 0.2, supplies: 0.15 } } },
  nexus: { perk: 'hivemind', perk2: 'sensorNet', discountUnit: 'android', discount: 0, startTech: 'coastalEconomy', extraTechs: ['diving', 'shipbuilding'], home: { plain: 0.55, forest: 0.1, mountain: 0.25, water: 0.1, res: { ore: 0.3, supplies: 0.1 } } },
  velkar: { perk: 'researchLead', perk2: 'engineerCorps', discountUnit: 'pioneer', discount: 0.2, startTech: 'mountainTraining', home: { plain: 0.25, forest: 0.35, mountain: 0.35, water: 0.05, res: { ore: 0.2, supplies: 0.1 } } },
};

export const PERKS = {
  massMobilizationExtraUnits: 1,
  drillKills: 2,
  boomLevelReduction: 1,
  researchLeadDiscount: 0.12,
};

/** Zweite Fraktionsmerkmale / second faction traits */
export const PERKS2 = {
  /** Korvat, Erdwaelle: Aussenposten-Preis / earthworks: outpost price */
  earthworksOutpostCost: 15,
  /** Dravon, kampferprobt: Angriff der Veteranen / battle-hardened: veteran attack bonus */
  battleHardenedAttack: 0.5,
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
  /** Siedlungen je Feld (vorher 1/13, leicht verringert) / villages per tile (before 1/13, slightly reduced) */
  villagesPerTile: 1 / 15,
  /** Mindestabstand neutraler Siedlungen zum Kartenrand in Feldern / minimum distance of neutral villages to the map edge in tiles */
  villageEdge: 2,
  /**
   * Ausnahme Heimatsiedlung: hat die Startinsel kein Feld mit 2 Feldern Randabstand, reicht 1 (nie direkt am Rand), damit niemand ohne Wachstum startet.
   * Exception home village: if the start island has no tile 2 tiles from the edge, 1 is enough (never right at the edge) so nobody starts without growth.
   */
  villageEdgeHome: 1,
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
 * Kampagne m2 (Das Mutterschiff, alle gegen alle): Karte size x size, das abgestuerzte Zyrr-Mutterschiff (2x2 Felder,
 * unpassierbar) liegt genau in der Mitte. Sechs Fraktionen starten startInset Felder vom Rand: vier in den Ecken (der
 * Spieler immer in einer Ecke), zwei an den Mitten zweier gegenueberliegender Kanten. Die Zyrr haben keine Basis, ihre
 * Wellen landen waveDistance Felder vom Schiff. Jede Fraktion hat einen Wissenschaftler (der Kult einen abtruennigen
 * Forscher, gleiche Einheit); wer zuerst workRounds Arbeitsrunden (zusammengezaehlt) schafft, gewinnt die Probe. Bis zur
 * ersten Arbeit am Schiff herrscht Waffenruhe zwischen allen ausser den Zyrr, danach Krieg aller gegen alle. Bonus: Sieg
 * bis fastRound, der Wissenschaftler faellt nie unter hpShare seiner LP.
 * Campaign m2 (The Mothership, free-for-all): map size x size, the crashed Zyrr mothership (2x2 tiles, impassable) lies
 * exactly in the centre. Six factions start startInset tiles from the edge: four in the corners (the player always in a
 * corner), two at the midpoints of two opposite edges. The Zyrr have no base, their waves land waveDistance tiles from
 * the ship. Every faction has a scientist (the cult a renegade researcher, same unit); whoever first manages workRounds
 * work rounds (cumulative) wins the sample. Until the first work at the ship there is a truce between everyone but the
 * Zyrr, then war of all against all. Bonus: win by fastRound, the scientist never drops below hpShare of its HP.
 */
export const M2 = {
  workRounds: 8,
  missionRounds: 26,
  fastRound: 20,
  hpShare: 0.5,
  /** Kartengroesse und Abstand der Startpunkte vom Rand / map size and distance of the start points from the edge */
  size: 28 as MapSize,
  startInset: 3,
  /** Krater: der Aufprall hat die Berge bis so weit um das Schiff eingeebnet / crater: the impact levelled the mountains this far around the ship */
  crater: 3,
  /** Landepunkte der Wellen: Abstand zum Schiff / wave landing points: distance to the ship */
  waveDistance: 3,
  /** Truppe des Spielers am Hauptquartier (dazu der Wissenschaftler) / the player's troops at the HQ (plus the scientist) */
  playerUnits: ['tank', 'jeep', 'infantry', 'mg'] as UnitTypeId[],
  /** Truppe jeder KI-Menschenfraktion (dazu Starteinheit und Wissenschaftler) / troops of every AI human faction (plus start unit and scientist) */
  rivalUnits: ['jeep', 'mg'] as UnitTypeId[],
  /** Truppe des Kults (dazu seine Starthorde und der Forscher) / troops of the cult (plus its starting horde and the researcher) */
  cultUnits: [] as UnitTypeId[],
  /** Sterne der Zyrr zu Beginn (keine Basis, sie leben von den Wellen) / Zyrr stars at the start (no base, they live off the waves) */
  zyrrStars: 0,
  /** Wachen am Schiff zu Beginn / guards at the ship at the start */
  guards: ['grey', 'grey', 'grey'] as UnitTypeId[],
  /**
   * Wellen der Zyrr: Runde, Einheiten, Landepunkt (0 Norden, 1 Osten, 2 Sueden, 3 Westen des Schiffs), Sterne fuer den Sold.
   * Zyrr waves: round, units, landing point (0 north, 1 east, 2 south, 3 west of the ship), stars for the upkeep.
   */
  waves: [
    { round: 3, units: ['grey', 'grey'], at: 0, stars: 4 },
    { round: 5, units: ['grey', 'grey'], at: 1, stars: 4 },
    { round: 7, units: ['grey', 'skimmer'], at: 2, stars: 5 },
    { round: 9, units: ['grey', 'grey', 'skimmer'], at: 3, stars: 5 },
    { round: 11, units: ['grey', 'grey', 'mech'], at: 0, stars: 6 },
    { round: 13, units: ['grey', 'skimmer', 'mech'], at: 1, stars: 6 },
    { round: 15, units: ['grey', 'grey', 'skimmer'], at: 2, stars: 6 },
    { round: 17, units: ['grey', 'grey', 'mech'], at: 3, stars: 6 },
    { round: 19, units: ['grey', 'skimmer', 'mech'], at: 0, stars: 6 },
    { round: 21, units: ['grey', 'grey', 'mech'], at: 1, stars: 6 },
    { round: 23, units: ['grey', 'skimmer', 'mech'], at: 2, stars: 6 },
  ] as { round: number; units: UnitTypeId[]; at: number; stars: number }[],
  /**
   * Wettlauf: die Forscher der KI-Fraktionen erscheinen erst zu Beginn dieser Runde an ihrem Hauptquartier (1 = sofort);
   * Warnhinweis, sobald einer Fraktion nur noch raceWarn Runden fehlen.
   * Race: the AI factions' researchers only appear at their HQ at the start of this round (1 = at once); warning toast
   * once a faction is only raceWarn rounds short.
   */
  rivalStartRound: 1,
  raceWarn: 2,
  /**
   * Deckung der Huelle: Verteidigungsbonus (wie ein Wrack) fuer einen Wissenschaftler direkt neben dem Schiff.
   * Hull cover: defence bonus (like a wreck) for a scientist right next to the ship.
   */
  hullCover: 2,
  /**
   * KI: Jaeger auf feindliche Wissenschaftler (Wert steigt mit deren Fortschritt), Wachen am Schiff, Eskorte des eigenen.
   * AI: hunters on hostile scientists (value rises with their progress), guards at the ship, escort of the own one.
   */
  ai: {
    huntValue: 125, huntCap: 2, huntProgress: 6, attackBonus: 35, guardValue: 75, guardCap: 2, escortValue: 115, escortCap: 3,
    clearValue: 95, clearCap: 2, clearRange: 3, spotPenalty: 40,
    /** Jagd nur auf Wissenschaftler hoechstens so weit vom Schiff (oder neben eigenen Einheiten) / hunt only scientists at most this far from the ship (or next to own units) */
    huntRange: 4,
    /** Wissenschaftler wartet bis zu waitDistance vor dem Arbeitsplatz, solange in waitRange mehr Gegner als eigene Kaempfer stehen / the scientist waits up to waitDistance before the work spot while more enemies than own fighters stand within waitRange */
    waitDistance: 4, waitRange: 2,
    /** unterwegs wartet er, wenn kein eigener Kaempfer so nah ist; Vortrupp am angesteuerten Arbeitsplatz / on the way it waits if no own fighter is this close; vanguard at the targeted work spot */
    escortGap: 1, vanguardCap: 2,
    /** Anteil von Jagdwert und Angriffszuschlag fuer die Zyrr (sie verteidigen das Wrack gegen alle) / share of hunt value and attack bonus for the Zyrr (they defend the wreck against everyone) */
    swarmHunt: 0,
    /** Waffenruhe: Abzug je fremder bewaffneter Einheit, die das Feld des eigenen Wissenschaftlers erreicht / truce: penalty per foreign armed unit that reaches the own scientist's tile */
    truceExposure: 12,
    /** Wert des Wissenschaftlers fuer Vorsicht und Angriff (sonst 10 wie eine billige Einheit) / scientist's worth for caution and attacks (otherwise 10 like a cheap unit) */
    scientistWorth: 30,
  },
};

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
  /** Kult: Zielwert je Beutestern einer Stadt oder Siedlung / cult: goal value per loot star of a city or village */
  cultPlunderValue: 1.5,
  /** Kult: Wunschgroesse der Horde = normale Wunschgroesse x Faktor + Zuschlag (hoechstens das Limit) / cult: desired horde = normal desired size x factor + extra (at most the cap) */
  cultArmyFactor: 1.4,
  cultArmyExtra: 1,
  /** Kult: Frieden nur unter diesem Staerkeverhaeltnis, Bruch ab diesem (Punktespiel) / cult: peace only below this strength ratio, break from this one (points game) */
  cultPeaceStrength: 0.8,
  cultBreakStrength: 1.2,
  /** Kult: Siegtechnologie ab dieser Runde (der Bohrer braucht WONDERS.drillRounds) / cult: victory tech from this round (the drill needs WONDERS.drillRounds) */
  cultDrillResearchRound: 4,
  /**
   * Meteorschauer in der naechsten Runde: Strafe fuer ungepanzerte Einheiten ohne Deckung, plus Zuschlag je fehlendem LP-Anteil.
   * Meteor shower next round: penalty for unarmoured units without cover, plus a surcharge per missing HP share.
   */
  meteorExposed: 6,
  meteorHurt: 18,
  /**
   * Bedrohtes Feld auf eigenem Gebiet mit Verteidigungsbonus (HOME_DEFENSE): Zuschlag je Bonusanteil, damit Alvenia dort kaempft.
   * Threatened tile on own territory with a defence bonus (HOME_DEFENSE): bonus per bonus share so Alvenia fights there.
   */
  homeGround: 12,
  /**
   * Heiliges Alvenia: Zuschlag fuer Angriffe auf Einheiten von Suendern; Fernkaempfer ohne Sturm meiden Felder neben Gegnern
   * (Abstand halten) und suchen Felder mit Gegnern in Reichweite.
   * Holy Alvenia: bonus for attacks on units of sinners; ranged units without dash avoid tiles next to enemies (keep
   * distance) and seek tiles with enemies in range.
   */
  sinnerTarget: 6,
  keepDistance: 8,
  /**
   * Mahnmal des Kults: Zuschlag je Schadensanteil fuer ein Feld, von dem aus die Einheit angreifen kann (Kult sucht es,
   * menschliche Fraktionen meiden es); der Angriffswert selbst sieht den Faktor schon ueber combatPreview.
   * Cult memorial: bonus per damage share for a tile the unit can attack from (the cult seeks it, human factions avoid
   * it); the attack value itself already sees the factor via combatPreview.
   */
  memorialGround: 16,
  /**
   * Menschen: Gewicht der Doktrinen in der Kaufliste (Doktrinen konkurrieren mit den Produktionsstaetten um Sterne);
   * doctrineWLead fuer die Fraktion mit Forschungsrabatt (Velkar), die Doktrinen ohnehin guenstig bekommt.
   * Humans: weight of doctrines in the purchase list (doctrines compete with the production sites for stars);
   * doctrineWLead for the faction with the research discount (Velkar), which gets doctrines cheaply anyway.
   */
  doctrineW: 1.45,
  doctrineWLead: 1.15,
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
  /**
   * Kriegsplaene (m4): Spieler-Seite laeuft die Tempelfelder an, eskortiert den Traeger und hebt fallen gelassene Plaene auf;
   * der Kult bewacht den Tempel, jagt den Traeger und bringt fallen gelassene Plaene zurueck.
   * War plans (m4): the player side heads for the temple, escorts the carrier and picks up dropped plans; the cult guards
   * the temple, hunts the carrier and takes dropped plans back.
   */
  plansSeizeValue: 150, plansSeizeCap: 2, plansGatherValue: 140, plansGatherCap: 6, plansEscortValue: 150, plansEscortCap: 4, plansPickValue: 150, plansPickCap: 2,
  plansGuardValue: 75, plansGuardCap: 3, plansHuntValue: 160, plansHuntCap: 8, plansReturnValue: 150, plansReturnCap: 3, plansDistW: 2,
  /** Der Laeufer wartet, bis so viele eigene Kampfeinheiten nahe am Tempel stehen / the runner waits until this many own fighters stand near the temple */
  plansEscortMin: 2, plansEscortRange: 3,
  /** Zielwert des Traegers zum Hauptquartier (immer zugeteilt) / goal value of the carrier towards the HQ (always assigned) */
  plansCarryValue: 400,
  /** Angriffswert gegen den Traeger (Gegner) / attack value against the carrier (enemies) */
  plansCarrierAttackBonus: 45,
  /** Langsame Einheiten bergen nicht, wenn ein schnellerer Laeufer so nahe ist / slow units do not seize while a faster runner is this close */
  plansWaitRange: 4,
};

/**
 * Kriegsplaene aus dem Fanatiker-Tempel (Kampagne m4, "Die Kriegsplaene"): 2x2-Tempel, Bergen neben dem Tempel,
 * Abliefern am eigenen Hauptquartier, Verfolgerwellen des Kults, solange die Plaene unterwegs sind.
 * War plans from the Fanatic temple (campaign m4, "The War Plans"): 2x2 temple, seizing next to the temple,
 * delivery at the own HQ, cult pursuit waves while the plans are on the move.
 */
export const TEMPLE_PLANS = {
  /** Abstand des Tempels (naechstes Tempelfeld) zum Hauptquartier des Spielers, Wunschwert und Grenzen / distance of the temple (nearest temple tile) to the player's HQ, preferred value and bounds */
  hqDistance: 8, hqMin: 7, hqMax: 10,
  /** Abstand zum Hauptquartier des Kults: Mindestwert, Wunschwert / distance to the cult HQ: minimum, preferred value */
  enemyMin: 3, enemyPref: 5,
  /** Abstand zu jeder Stadt (auch Siedlungen) / distance to every city (settlements too) */
  cityGap: 2,
  /** Bergen: Abstand zu einem Tempelfeld oder zu fallen gelassenen Plaenen / seizing: distance to a temple tile or to dropped plans */
  seizeRange: 1,
  /** Abliefern: Abstand zum eigenen Hauptquartier / delivery: distance to the own HQ */
  deliverRange: 1,
  /** Tempelwache zu Beginn / temple guard at the start */
  guards: ['zealot', 'zealot'] as UnitTypeId[],
  /**
   * Verfolgung: die erste Welle zu Beginn des naechsten Spielerzugs nach dem Bergen, dann alle pursuitEvery Runden,
   * hoechstens pursuitWaves Wellen; je Welle Einheiten am Tempel (abwechselnd aus pursuitTemple) und an den
   * pursuitCities naechsten Kultstaedten (pursuitCity), dazu pursuitStars Sterne fuer den Sold.
   * Pursuit: the first wave at the start of the next player turn after the seizure, then every pursuitEvery rounds,
   * at most pursuitWaves waves; per wave units at the temple (cycling through pursuitTemple) and at the pursuitCities
   * nearest cult cities (pursuitCity), plus pursuitStars stars for the upkeep.
   */
  pursuitEvery: 2, pursuitWaves: 4,
  pursuitTemple: [['zealot', 'zealot'], ['zealot', 'doomBuggy'], ['zealot', 'torchbearer'], ['doomBuggy', 'zealot']] as UnitTypeId[][],
  pursuitCity: ['zealot'] as UnitTypeId[], pursuitCities: 1, pursuitStars: 10,
  /** m4: Missionsdauer und Bonus "Abliefern bis Runde" / m4: mission length and bonus "deliver by round" */
  m4Rounds: 18, m4FastRound: 13,
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
