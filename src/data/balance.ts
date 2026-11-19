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
export type RobotUnitId = 'android' | 'spider' | 'quadDrone' | 'railgun' | 'titan' | 'flakDrone' | 'cyborg' | 'flameTank' | 'kamikazeDrone';
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
/**
 * Fraktionsvariante der Korvat: Steppenkoloss statt Panzer (siehe VARIANTS).
 * Korvat faction variant: Steppe Colossus instead of the tank (see VARIANTS).
 */
export type KorvatUnitId = 'steppeColossus';
/**
 * Schattenflotte der Handelsliga Meridon: Schattenkommando statt MG, Lenkflugkoerper statt Artillerie (und statt des Panzers,
 * den Meridon nicht baut), Nebelkutter statt Transportboot, dazu der Radarwagen (siehe VARIANTS, ROSTER_EXTRA, SHADOW_FLEET).
 * Shadow fleet of the Meridon Trade League: Shadow Commando instead of the MG, Guided Missile instead of artillery (and
 * instead of the tank Meridon does not build), Fog Cutter instead of the transport boat, plus the Radar Truck (see VARIANTS,
 * ROSTER_EXTRA, SHADOW_FLEET).
 */
export type MeridonUnitId = 'shadowCommando' | 'fogCutter' | 'guidedMissile' | 'radarTruck';
export type UnitTypeId = LandUnitId | ShipId | AlienUnitId | CultUnitId | RobotUnitId | UniqueUnitId | WonderUnitId | BossUnitId | CampaignUnitId | VelkarUnitId | AlveniaUnitId | KorvatUnitId | MeridonUnitId;
export type Ability =
  | 'dash' | 'escape' | 'persist' | 'fortify' | 'heal' | 'convert' | 'noRetaliate' | 'ignoreOutpost'
  | 'invisible' | 'uprising' | 'fly' | 'fuel' | 'submerged' | 'splash' | 'carry' | 'terraform' | 'deathRay' | 'walker' | 'preach' | 'burn' | 'wade'
  // Konter: Flugabwehr-Feuerzone, Minen legen / counters: anti-air fire zone, lay mines
  | 'flak' | 'mines'
  // Einzigartige Einheiten: Sturmangriff ohne Gegenschlag, Selbstheilung, Kaperbeute
  // unique units: shock assault without retaliation, self-repair, prize money
  | 'shock' | 'mend' | 'plunder'
  // Kamikaze (NEXUS-Laufdrohne): der Angriff ist die Explosion, kein Gegenschlag, die Einheit ist danach zerstoert (KAMIKAZE)
  // kamikaze (NEXUS walker drone): the attack is the explosion, no return fire, the unit is destroyed afterwards (KAMIKAZE)
  | 'kamikaze'
  // Meridon: Tarnung (unsichtbar ohne Nachbarn, siehe CAMO), Sabotage (SABOTAGE), Radarimpuls (RADAR)
  // Meridon: camouflage (invisible without neighbours, see CAMO), sabotage (SABOTAGE), radar sweep (RADAR)
  | 'camo' | 'sabotage' | 'radar'
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
  /**
   * Hoechster Abstand fuer den Gegenschlag, falls kleiner als die Reichweite (fehlt = Reichweite). Panzer: Angriff auf 2 Felder,
   * Gegenschlag nur auf 1 Feld (der Turm muss erst richten), damit Panzerabwehr und Scharfschuetzen aus 2 Feldern ihren Konter behalten.
   * Largest distance for return fire if smaller than the range (missing = range). Tanks: attack at 2 tiles, return fire only
   * at 1 tile (the turret has to traverse first), so anti-tank squads and snipers keep their counter from 2 tiles.
   */
  returnRange?: number;
  /**
   * Zusaetzlicher Schadensfaktor gegen Ziele bestimmter Rassen (HitRace der Zieleinheit), optional nur gegen eine Klasse;
   * der erste passende Eintrag gilt, zusaetzlich zu bonusVs (Angriff und Gegenschlag).
   * Extra damage multiplier against targets of certain races (the target unit's HitRace), optionally only against one class;
   * the first matching entry applies, on top of bonusVs (attack and return fire).
   */
  bonusRace?: { races: HitRace[]; cls?: CounterClass; factor: number }[];
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

/**
 * Bewegung (Spielerwunsch, Einheiten waren zu langsam): Grundinfanterie aller Fraktionen (Infanterie, Graue, Eiferer,
 * Androiden, Cyborgs) sowie Scharfschuetzen, Lichtschuetzen, Railgun-Schuetzen und Sanitaeter ziehen 2 Felder, alle
 * anderen Fusstruppen (MG, Pioniere, Panzerabwehr usw.) bleiben bei 1; Panzer (auch Tesla-Panzer, Reliquiar,
 * Steppenkoloss, Flammenwerferpanzer) fahren 3, der Jeep 4.
 * Movement (player request, units were too slow): basic infantry of every faction (infantry, Greys, zealots, androids,
 * cyborgs) plus snipers, Light Wardens, railgun marksmen and medics move 2 tiles, all other foot troops (MG, pioneers,
 * anti-tank etc.) stay at 1; tanks (also Tesla tank, Reliquary, Steppe Colossus, flamethrower tank) drive 3, the jeep 4.
 */
export const UNITS: Record<UnitTypeId, UnitStats> = {
  infantry: { cost: 10, hp: 10, attack: 2, defense: 2, move: 2, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false },
  // Scharfschuetze: toedlich gegen Fusstruppen (+90 %: 7 bis 10 Schaden), gegen Panzerung bleibt es bei 2 bis 3 (siehe COUNTER)
  // sniper: deadly against foot troops (+90 %: 7 to 10 damage), against armour it stays at 2 to 3 (see COUNTER)
  sniper: { cost: 15, hp: 10, attack: 2, defense: 1, move: 2, range: 2, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false, bonusVs: { foot: 1.9 } },
  // Jeep: 4 Felder (Spielerwunsch, vorher 3, davor 2); Schnee und Panzersperre bremsen wie bei allen Fahrzeugen / jeep: 4 tiles (player request, before 3, earlier 2); snow and barriers slow it like all vehicles
  jeep: { cost: 15, hp: 10, attack: 2, defense: 1, move: 4, range: 1, vision: 1, abilities: ['dash', 'escape'], tech: null, ship: false },
  pioneer: { cost: 15, hp: 15, attack: 1, defense: 3, move: 1, range: 1, vision: 1, abilities: ['fortify'], tech: null, ship: false },
  mg: { cost: 25, hp: 15, attack: 3, defense: 3, move: 1, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false },
  medic: { cost: 25, hp: 10, attack: 0, defense: 1, move: 2, range: 1, vision: 1, abilities: ['heal', 'convert'], tech: null, ship: false },
  artillery: { cost: 40, hp: 10, attack: 4, defense: 0, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: null, ship: false },
  spy: { cost: 40, hp: 5, attack: 0, defense: 0.5, move: 2, range: 0, vision: 1, abilities: ['invisible', 'uprising'], tech: null, ship: false },
  heli: { cost: 50, hp: 10, attack: 3.5, defense: 1, move: 3, range: 1, vision: 1, abilities: ['dash', 'persist', 'fly', 'fuel'], tech: null, ship: false },
  // Panzer: faehrt 3 Felder und schiesst 2 Felder weit (Schnee bremst auf 2, eine Panzersperre auf BARRIER.slowedMove), Gegenschlag nur auf 1 Feld
  // tank: drives 3 tiles and fires 2 tiles (snow slows it to 2, a barrier to BARRIER.slowedMove), return fire only at 1 tile
  tank: { cost: 60, hp: 40, attack: 5, defense: 4, move: 3, range: 2, vision: 1, abilities: ['dash'], tech: null, ship: false, returnRange: 1 },
  // Schiffe: LP kommen von der getragenen Einheit; cost = Aufruestpreis.
  // Ships: HP come from the carried unit; cost = upgrade price.
  landingBoat: { cost: 0, hp: 0, attack: 0, defense: 1, move: 2, range: 0, vision: 1, abilities: ['carry'], tech: 'coastalEconomy', ship: true },
  submarine: { cost: 25, hp: 0, attack: 2, defense: 1, move: 3, range: 2, vision: 2, abilities: ['carry', 'submerged'], tech: 'diving', ship: true },
  destroyer: { cost: 25, hp: 0, attack: 3, defense: 3, move: 3, range: 1, vision: 1, abilities: ['carry', 'dash'], tech: 'shipbuilding', ship: true },
  battleship: { cost: 75, hp: 0, attack: 3, defense: 2, move: 2, range: 3, vision: 1, abilities: ['carry', 'splash'], tech: 'navalArtillery', ship: true },
  // Ausserirdische: keine Forschung, dafuer teurer / aliens: no research, but more expensive
  grey: { cost: 15, hp: 10, attack: 2.5, defense: 1.5, move: 2, range: 1, vision: 1, abilities: ['dash', 'fortify', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  terraformer: { cost: 20, hp: 10, attack: 0, defense: 2, move: 1, range: 0, vision: 1, abilities: ['terraform', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  skimmer: { cost: 40, hp: 12, attack: 3, defense: 1, move: 3, range: 1, vision: 2, abilities: ['dash', 'fly'], tech: null, ship: false, faction: 'zyrr' },
  mech: { cost: 45, hp: 30, attack: 4, defense: 3.5, move: 1, range: 1, vision: 1, abilities: ['dash', 'walker', 'wade'], tech: null, ship: false, faction: 'zyrr' },
  // Kult: Masse statt Klasse, etwa 20 % weniger LP und Angriff als vergleichbare Einheiten, dafuer billiger (CULT)
  // cult: mass over class, about 20 % less HP and attack than comparable units, but cheaper (CULT)
  zealot: { cost: 7, hp: 7, attack: 1.6, defense: 1.5, move: 2, range: 1, vision: 1, abilities: ['dash', 'fortify', 'preach'], tech: null, ship: false, faction: 'vesper' },
  torchbearer: { cost: 14, hp: 7, attack: 2.8, defense: 1, move: 1, range: 1, vision: 1, abilities: ['dash', 'burn', 'preach'], tech: 'forestry', ship: false, faction: 'vesper' },
  prophet: { cost: 22, hp: 7, attack: 0, defense: 1.5, move: 1, range: 1, vision: 2, abilities: ['heal', 'convert', 'preach'], tech: 'camouflage', ship: false, faction: 'vesper' },
  doomBuggy: { cost: 13, hp: 7, attack: 2, defense: 1, move: 2, range: 1, vision: 1, abilities: ['dash', 'escape'], tech: 'motorization', ship: false, faction: 'vesper' },
  rocketCart: { cost: 30, hp: 7, attack: 3.2, defense: 0, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: 'ballistics', ship: false, faction: 'vesper' },
  doomCrawler: { cost: 40, hp: 21, attack: 3.2, defense: 3, move: 1, range: 1, vision: 1, abilities: ['dash', 'preach'], tech: 'armsIndustry', ship: false, faction: 'vesper' },
  android: { cost: 12, hp: 10, attack: 2, defense: 2, move: 2, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false, faction: 'nexus', compute: 0 },
  spider: { cost: 25, hp: 12, attack: 3, defense: 2, move: 1, range: 1, vision: 1, abilities: ['dash', 'walker'], tech: null, ship: false, faction: 'nexus', compute: 1 },
  quadDrone: { cost: 35, hp: 10, attack: 3, defense: 1, move: 3, range: 1, vision: 2, abilities: ['dash', 'fly'], tech: null, ship: false, faction: 'nexus', compute: 2 },
  railgun: { cost: 45, hp: 10, attack: 4.5, defense: 0.5, move: 1, range: 3, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: null, ship: false, faction: 'nexus', compute: 3 },
  titan: { cost: 60, hp: 35, attack: 4.5, defense: 3.5, move: 1, range: 1, vision: 1, abilities: ['dash'], tech: null, ship: false, faction: 'nexus', compute: 4 },
  // Cyborg-Infanterie: robuster und staerker als der Androide, teurer, von Beginn an (Rechenleistung 0 wie der Androide)
  // cyborg infantry: sturdier and stronger than the android, more expensive, from the start (compute 0 like the android)
  cyborg: { cost: 18, hp: 15, attack: 2.8, defense: 2.5, move: 2, range: 1, vision: 1, abilities: ['dash', 'fortify'], tech: null, ship: false, faction: 'nexus', compute: 0 },
  // Flammenwerferpanzer: Reichweite 1, Flammen ignorieren Deckung (burn: Wald, Stadt, Aussenposten), stark gegen Fusstruppen;
  // Bewegung 3 wie die Panzer der Menschen
  // flamethrower tank: range 1, flames ignore cover (burn: forest, city, outposts), strong against foot troops; move 3 like the human tanks
  flameTank: { cost: 40, hp: 26, attack: 4, defense: 2.5, move: 3, range: 1, vision: 1, abilities: ['dash', 'burn'], tech: null, ship: false, faction: 'nexus', compute: 2, bonusVs: { foot: 1.5 } },
  // Kamikaze-Laufdrohne: 3 Felder, explodiert beim Angriff (KAMIKAZE), stark gegen menschliche Fusstruppen und Zyrr
  // kamikaze walker drone: 3 tiles, explodes when attacking (KAMIKAZE), strong against human foot troops and Zyrr
  kamikazeDrone: { cost: 12, hp: 6, attack: 4.5, defense: 1, move: 3, range: 1, vision: 1, abilities: ['dash', 'walker', 'kamikaze'], tech: null, ship: false, faction: 'nexus', compute: 1,
    bonusRace: [{ races: ['human', 'cult'], cls: 'foot', factor: 2 }, { races: ['alien'], factor: 1.8 }] },
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
  teslaTank: { cost: 60, hp: 40, attack: 7, defense: 4, move: 3, range: 2, vision: 1, abilities: ['dash'], tech: null, ship: false, faction: 'velkar', returnRange: 1 },
  // Oktokopter: Werte des Kampfhubschraubers / octocopter: the attack helicopter's values
  octocopter: { cost: 50, hp: 10, attack: 3.5, defense: 1, move: 3, range: 1, vision: 1, abilities: ['dash', 'persist', 'fly', 'fuel'], tech: null, ship: false, faction: 'velkar' },
  // Railgun-Schuetze: Reichweite 3, schiesst nur aus dem Stand (kein Sturm), praezise; wie der Scharfschuetze stark gegen
  // Fusstruppen (+30 %) und schwach gegen Panzerung (-35 %), etwas weniger ausgepraegt, weil Angriff und Reichweite hoeher sind
  // railgun marksman: range 3, fires only from a standstill (no dash), precise; like the sniper strong against foot troops
  // (+30 %) and weak against armour (-35 %), a little less pronounced because attack and range are higher
  railSniper: { cost: 20, hp: 10, attack: 2.5, defense: 1, move: 2, range: 3, vision: 1, abilities: ['fortify'], tech: null, ship: false, faction: 'velkar', bonusVs: { foot: 1.3, vehicle: 0.65 } },
  // Alvenia-Varianten (siehe VARIANTS): Fernkampf aus dem Stand, starke Verteidigung / Alvenia variants (see VARIANTS): ranged from a standstill, strong defence
  // Lichtschuetzen: Reichweite 2, schiessen nur aus dem Stand (kein Sturm), gute Verteidigung, schwacher Angriff / Light Wardens: range 2, fire only from a standstill (no dash), good defence, weak attack
  lightWarden: { cost: 12, hp: 10, attack: 1.6, defense: 2.5, move: 2, range: 2, vision: 1, abilities: ['fortify'], tech: null, ship: false, faction: 'alvenia' },
  // Reliquiar: Panzer mit Reichweite 2 und schwerer Panzerung, faehrt 3 Felder, schiesst nur aus dem Stand / Reliquary: tank with range 2 and heavy armour, drives 3 tiles, fires only from a standstill
  reliquary: { cost: 60, hp: 40, attack: 4.5, defense: 5.5, move: 3, range: 2, vision: 1, abilities: [], tech: null, ship: false, faction: 'alvenia' },
  // Sonnenlanze: Artillerie mit Reichweite 4 / Sun Lance: artillery with range 4
  sunLance: { cost: 45, hp: 10, attack: 4, defense: 0.5, move: 1, range: 4, vision: 1, abilities: ['noRetaliate', 'ignoreOutpost'], tech: null, ship: false, faction: 'alvenia' },
  // Korvat: Steppenkoloss statt Panzer: die meisten LP und der staerkste Angriff aller Panzer; Preis, Sold, Bewegung 3 und
  // Reichweite 2 wie der Panzer (gemessen, siehe BALANCING.md)
  // Korvat: Steppe Colossus instead of the tank: the most HP and the strongest attack of all tanks; price, upkeep, move 3 and
  // range 2 like the tank (measured, see BALANCING.md)
  steppeColossus: { cost: 60, hp: 55, attack: 7.5, defense: 4.5, move: 3, range: 2, vision: 1, abilities: ['dash'], tech: null, ship: false, faction: 'korvat', returnRange: 1 },
  // Meridon-Schattenflotte (siehe SHADOW_FLEET) / Meridon shadow fleet (see SHADOW_FLEET)
  // Schattenkommando statt MG: leicht, 2 Felder, getarnt (CAMO), schwacher Angriff, sabotiert Strassen, Aussenposten und Gebaeude
  // Shadow Commando instead of the MG: light, 2 tiles, camouflaged (CAMO), weak attack, sabotages roads, outposts and buildings
  shadowCommando: { cost: 20, hp: 10, attack: 2.5, defense: 2.5, move: 2, range: 1, vision: 1, abilities: ['dash', 'fortify', 'camo', 'sabotage'], tech: null, ship: false, faction: 'meridon' },
  // Nebelkutter statt Transportboot: getarnt, traegt eine Einheit (Kaufpreis SHIPYARD.fogCutterCost, cost = Aufruestpreis 0 wie beim Landungsboot)
  // Fog Cutter instead of the transport boat: camouflaged, carries one unit (price SHIPYARD.fogCutterCost, cost = upgrade price 0 as for the landing boat)
  fogCutter: { cost: 0, hp: 0, attack: 0, defense: 1, move: 2, range: 0, vision: 1, abilities: ['carry', 'camo'], tech: null, ship: true, faction: 'meridon' },
  // Lenkflugkoerper statt Artillerie: fliegt 5 Felder, explodiert beim Angriff (Kamikaze, ein Ziel), keine Rassen-Boni;
  // 3 LP: die Flak (COUNTER.flak, CITY_UPGRADES.flakDamage) holt ihn mit einem Treffer herunter
  // Guided Missile instead of artillery: flies 5 tiles, explodes when attacking (kamikaze, one target), no race bonuses;
  // 3 HP: flak (COUNTER.flak, CITY_UPGRADES.flakDamage) brings it down with one hit
  guidedMissile: { cost: 20, hp: 3, attack: 3.2, defense: 0.5, move: 5, range: 1, vision: 1, abilities: ['dash', 'fly', 'kamikaze'], tech: null, ship: false, faction: 'meridon' },
  // Radarwagen: unbewaffnet, Radarimpuls (RADAR) zeigt feindliche Einheiten im Umkreis auch unter den Wolken
  // Radar Truck: unarmed, radar sweep (RADAR) shows hostile units in the radius even under the clouds
  radarTruck: { cost: 25, hp: 10, attack: 0, defense: 1.5, move: 2, range: 0, vision: 2, abilities: ['radar'], tech: null, ship: false, faction: 'meridon' },
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
export const ROBOT_UNITS: RobotUnitId[] = ['android', 'cyborg', 'kamikazeDrone', 'spider', 'quadDrone', 'flakDrone', 'railgun', 'flameTank', 'titan'];
export const UNIQUE_UNITS: UniqueUnitId[] = ['steppeRider', 'stormbreaker', 'peacekeeper', 'privateer', 'protoWalker'];
export const UNIQUE_BUILDINGS: BuildingId[] = ['kolkhoz', 'mercenaryBarracks', 'embassyPalace', 'tradingPost', 'testLab'];
export const VELKAR_UNITS: VelkarUnitId[] = ['teslaTank', 'octocopter', 'railSniper'];
export const ALVENIA_UNITS: AlveniaUnitId[] = ['lightWarden', 'reliquary', 'sunLance'];
export const KORVAT_UNITS: KorvatUnitId[] = ['steppeColossus'];
export const MERIDON_UNITS: MeridonUnitId[] = ['shadowCommando', 'fogCutter', 'guidedMissile', 'radarTruck'];

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
  // Korvat: Steppenkoloss statt Panzer / Korvat: Steppe Colossus instead of the tank
  korvat: { tank: 'steppeColossus' },
  // Meridon: Schattenkommando statt MG, Lenkflugkoerper statt Artillerie; Meridon baut keine Panzer, an ihrer Stelle stehen
  // das Raketensilo (Bauwerk, SILO) und fuer Stadtbelohnung und Kampagnen-Verstaerkung ebenfalls ein Lenkflugkoerper
  // Meridon: Shadow Commando instead of the MG, Guided Missile instead of artillery; Meridon builds no tanks, their place
  // is taken by the rocket silo (structure, SILO) and, for the city reward and campaign reinforcements, a Guided Missile too
  meridon: { mg: 'shadowCommando', artillery: 'guidedMissile', tank: 'guidedMissile' },
};

/**
 * Zusaetzliche Landeinheiten einer Fraktion in der Kaufliste (nach den Grundtypen, vor der einzigartigen Einheit).
 * Meridon: Radarwagen (eigene Einheit statt eines Ersatzes, damit die Konter-Einheiten bleiben).
 * Extra land units of a faction in the shop list (after the base types, before the unique unit).
 * Meridon: Radar Truck (an own unit rather than a replacement so the counter units stay).
 */
export const ROSTER_EXTRA: Partial<Record<FactionId, UnitTypeId[]>> = {
  meridon: ['radarTruck'],
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
  'steppeColossus', 'flameTank', 'radarTruck',
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
export const UPKEEP = {
  freeUnits: 4, share: 0.3, flat: { tank: 12, teslaTank: 12, reliquary: 12, steppeColossus: 12 } as Partial<Record<UnitTypeId, number>>,
  /**
   * Faktor auf den Gesamtsold einer Fraktion (Besitzer zaehlt). Korvat "Volksarmee": 33 % weniger Sold. Gerundet wird die
   * Summe (aufgerundet), nicht jede Einheit: sonst bliebe Infanterie bei 3 Sternen (3 x 0,67 = 2,01, aufgerundet 3).
   * Factor on a faction's total upkeep (the owner counts). Korvat "People's Army": 33 % less upkeep. The total is rounded
   * (up), not each unit: otherwise infantry would stay at 3 stars (3 x 0.67 = 2.01, rounded up 3).
   */
  faction: { korvat: 0.67 } as Partial<Record<FactionId, number>>,
};

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

/**
 * Kamikaze-Laufdrohne (NEXUS, Faehigkeit 'kamikaze'): der Angriff ist die Explosion. Schaden nach der normalen Formel mit
 * Rassen-Bonus (UNITS.bonusRace), nur das Ziel (keine Nachbarn), kein Gegenschlag, kein Abzug fuer Feuern nach Bewegung (die Drohne
 * laeuft ins Ziel). Trefferglueck wie bei Robotern: ein Fehlschuss ist ein Blindgaenger, die Drohne ist trotzdem verbraucht.
 * Die Drohne hinterlaesst kein Wrack und zaehlt nicht als Verlust in der Statistik; Kampagnen-Effekte wie Maertyrertum loest sie nicht aus.
 * Kamikaze walker drone (NEXUS, ability 'kamikaze'): the attack is the explosion. Damage by the normal formula with the race
 * bonus (UNITS.bonusRace), target only (no neighbours), no return fire, no penalty for firing after moving (the drone walks
 * into the target). Hit luck as for robots: a miss is a dud, the drone is spent anyway. The drone leaves no wreck and does not
 * count as a loss in the statistics; it triggers no death effects such as martyrdom.
 */
export const KAMIKAZE = {
  /** Abstand der Explosion: nur direkt daneben / explosion distance: right next to it only */
  range: 1,
};

/**
 * Meridon "Zwei fuer einen": bildet eine Stadt eine dieser Einheiten aus, erscheint eine zweite gleiche Einheit auf einem
 * freien Nachbarfeld an Land (eigenes Gebiet zuerst), zum Preis von einer. Die zweite zaehlt fuer Sold und Stadtlimit;
 * passt sie nicht mehr ins Limit oder ist kein Feld frei, kommt nur eine. Nur die Grundinfanterie der Kaserne.
 * Meridon "Two for One": when a city trains one of these units, a second identical unit appears on a free adjacent land
 * tile (own territory first), for the price of one. The second counts for upkeep and the city limit; if it no longer fits
 * the limit or no tile is free, only one comes. Basic barracks infantry only.
 */
export const TWIN_TRAINING = {
  units: { meridon: ['infantry'] } as Partial<Record<FactionId, UnitTypeId[]>>,
};

/**
 * Schattenflotte der Handelsliga Meridon: Tarnung, Absetzen, schwaechere Feuerkraft, Seemacht, Sabotage, Radar und
 * Raketensilo. Alle Zahlen hier; Entscheidungen in ANNAHMEN.md (Schattenflotte), Werte in BALANCING.md.
 * Shadow fleet of the Meridon Trade League: camouflage, withdrawal, weaker firepower, sea power, sabotage, radar and rocket
 * silo. All numbers here; decisions in ANNAHMEN.md (shadow fleet), values in BALANCING.md.
 */
export const SHADOW_FLEET = { faction: 'meridon' as FactionId };

/**
 * Stadtbelohnung "Panzer" (ab Stufe 5): so viele Einheiten der Bauart (fehlt = 1). Meridon baut keine Panzer, seine Bauart ist
 * der Lenkflugkoerper (20 statt 60 Sterne), deshalb kommen mehrere; die weiteren auf freie Nachbarfelder, ohne Stadtbindung.
 * City reward "tank" (from level 5): this many units of the design (missing = 1). Meridon builds no tanks, its design is the
 * Guided Missile (20 instead of 60 stars), hence several; the further ones on free adjacent tiles, without a home city.
 */
export const REWARD_HEAVY = {
  count: { meridon: 3 } as Partial<Record<FactionId, number>>,
};

/**
 * Tarnung (Faehigkeit 'camo', nur Schattenkommando und Nebelkutter): fuer Gegner unsichtbar, solange keine ihrer Einheiten,
 * Staedte oder Bauwerke (Geschuetz, Silo) direkt daneben stehen; ein eigener Angriff oder eine Sabotage enttarnt die Einheit
 * bis zu ihrem naechsten eigenen Zug (wie das aufgetauchte U-Boot, Unit.revealed), also durch alle gegnerischen Zuege.
 * Radarimpuls (RADAR) sowie Aufklaerungsdrohne und Funkturm (Sichtung SIGHTING) zeigen getarnte Einheiten ebenfalls.
 * Camouflage (ability 'camo', only the Shadow Commando and the Fog Cutter): invisible to enemies while none of their units,
 * cities or structures (gun, silo) stand right next to it; an own attack or sabotage reveals the unit until its next own
 * turn (like the surfaced submarine, Unit.revealed), i.e. through all enemy turns. The radar sweep (RADAR) as well as the
 * recon drone and the radio tower (sighting, SIGHTING) show camouflaged units too.
 */
export const CAMO = {
  /** Abstand, ab dem ein Nachbar die Tarnung bricht / distance at which a neighbour breaks the camouflage */
  revealRange: 1,
};

/**
 * Sichtung durch Aufklaerungsdrohne (Stadtbelohnung) und Funkturm (Stadt-Ausbau): zusaetzlich zum Aufdecken der Felder sieht
 * die Fraktion im selben Umkreis bis zum Ende der Runde alle feindlichen Einheiten, auch getarnte, getauchte und Spione.
 * Sighting by the recon drone (city reward) and the radio tower (city upgrade): on top of revealing the tiles the faction
 * sees all hostile units within the same radius until the end of the round, camouflaged, submerged ones and spies too.
 */
export const SIGHTING = {
  /** Runden der Sichtung (1 = nur diese Runde) / rounds of the sighting (1 = this round only) */
  rounds: 1,
};

/**
 * Absetzen (Meridon, Hit and Run): nach dem eigenen Angriff darf eine Landeinheit, die in diesem Zug noch nicht gezogen
 * ist, bis zu tiles Bewegungspunkte zurueckweichen (normale Kosten, Wald und Kontrollzonen halten an), danach kein Angriff
 * mehr. Nicht beim Gegenschlag. Ausgenommen: Flieger (Treibstoff, Folgeangriff), Schiffe, Bauwerke; Einheiten mit eigenem
 * Rueckzug nach dem Angriff (Jeep, 'escape') behalten ihre volle Bewegung.
 * Withdraw (Meridon, hit and run): after its own attack a land unit that has not moved this turn may fall back up to tiles
 * movement points (normal costs, forests and control zones stop it), no attack afterwards. Not on return fire. Excluded:
 * flyers (fuel, follow-up attack), ships, structures; units with their own move after attacking (jeep, 'escape') keep
 * their full movement.
 */
export const WITHDRAW = {
  factions: ['meridon'] as FactionId[],
  tiles: 2,
};

/**
 * Feuerkraft je Fraktion (Faktor auf den Schaden von Angriff und Gegenschlag, wie die anderen Fraktionsfaktoren vor dem
 * Trefferglueck). Meridon: Landeinheiten -10 % (Tuning 3, vorher -15 %); Schiffe, Lenkflugkoerper (exempt) und das Raketensilo (Bauwerk) nicht.
 * Firepower per faction (factor on the damage of attack and return fire, like the other faction factors before hit luck).
 * Meridon: land units -10 % (tuning 3, before -15 %); ships, Guided Missiles (exempt) and the rocket silo (structure) are not affected.
 */
export const FIREPOWER = {
  land: { meridon: 0.9 } as Partial<Record<FactionId, number>>,
  exempt: ['guidedMissile'] as UnitTypeId[],
};

/**
 * Seemacht: Rabatt der Fraktion auf alle Schiffe (Kauf in der Werft, Aufruesten, auch Kaperschiff und Nebelkutter) und
 * auf die Gebaeude in buildings. Meridon: 20 %, Marinestuetzpunkt.
 * Sea power: the faction's discount on all ships (shipyard purchase, upgrades, privateer and Fog Cutter too) and on the
 * buildings in buildings. Meridon: 20 %, naval base.
 */
export const SEA_POWER = {
  discount: { meridon: 0.2 } as Partial<Record<FactionId, number>>,
  buildings: ['navalBase'] as BuildingId[],
};

/**
 * Sabotage (Faehigkeit 'sabotage', Schattenkommando): zerstoert auf dem eigenen Feld oder einem Nachbarfeld einen
 * feindlichen Aussenposten, sonst ein Gebaeude im feindlichen Gebiet, sonst eine feindliche Strasse (in dieser Reihenfolge,
 * eins je Sabotage). Nie Staedte, Grossprojekte, Wunder oder Geschuetze. Nur gegen Fraktionen im Krieg; kostet die Aktion
 * (erschoepft), enttarnt die Einheit und ist erst nach cooldown Runden wieder moeglich.
 * Sabotage (ability 'sabotage', Shadow Commando): destroys on the own tile or an adjacent one a hostile outpost, otherwise a
 * building in hostile territory, otherwise a hostile road (in this order, one per sabotage). Never cities, grand projects,
 * wonders or guns. Only against factions at war; costs the action (exhausted), reveals the unit and is possible again only
 * after cooldown rounds.
 */
export const SABOTAGE = {
  cooldown: 2,
  /** KI: Wert je Art (Sterne-Gegenwert) / AI: value per kind (star equivalent) */
  ai: { outpost: 22, building: 16, site: 30, road: 7, connectBonus: 8, minValue: 8 },
};

/**
 * Radarimpuls (Faehigkeit 'radar', Radarwagen): fuer rounds Runden (diese und die naechste) sieht die Fraktion alle
 * feindlichen Einheiten im Umkreis radius um den Radarwagen (folgt ihm), auch getarnte, getauchte und Spione und auch unter
 * den Wolken; die Felder selbst bleiben unerkundet. Kostet die Aktion, danach cooldown Runden Pause.
 * Radar sweep (ability 'radar', Radar Truck): for rounds rounds (this one and the next) the faction sees all hostile units
 * within radius of the Radar Truck (follows it), camouflaged, submerged ones and spies too, and also under the clouds; the
 * tiles themselves stay unexplored. Costs the action, then a cooldown of cooldown rounds.
 */
export const RADAR = {
  radius: 6,
  rounds: 2,
  cooldown: 4,
  /** KI: Impuls, wenn so viele Gegner in enemyRange erwartet werden / AI: sweep when this many enemies are expected within enemyRange */
  ai: { nearEnemies: 2, enemyRange: 8 },
};

/**
 * Raketensilo (Meridon, statt Panzer): Bauwerk wie die Geschuetzstellung (Tile.turret mit owner und kind 'silo'): Pioniere
 * bauen es auf ein freies Nachbarfeld im eigenen Gebiet, hoechstens perCity je eigener Stadt und max insgesamt, Mindestabstand
 * minSpacing; unpassierbar, angreifbar (kein Gegenschlag, feuert nie von selbst), geschleift bei Gebietsverlust.
 * Start: ein Zielfeld in Reichweite launchRange (Schachbrett-Abstand vom Silo, aufgedeckt); die Rakete trifft die 2x2-Flaeche
 * aus Zielfeld, rechts, unten und diagonal (am Kartenrand nach innen geschoben, wie der Orbitallaser) mit damage an JEDER
 * Einheit (auch eigene, ohne Wurf; Einheiten im Frieden sperren den Start wie beim Orbitallaser) und an Geschuetzen; Staedte
 * und Gebaeude bleiben. Landfelder brennen danach fireRounds Runden: zu Beginn jeder dieser Runden verliert jede Einheit auf
 * einem brennenden Feld fireDamage LP. Nach dem Start ist das Silo cooldown Runden gesperrt (nach dem Bau charge Runden).
 * Rocket silo (Meridon, instead of tanks): a structure like the gun emplacement (Tile.turret with owner and kind 'silo'):
 * pioneers build it on a free adjacent tile in own territory, at most perCity per own city and max in total, minimum
 * spacing minSpacing; impassable, attackable (no return fire, never fires on its own), razed on loss of territory.
 * Launch: a target tile within launchRange (Chebyshev distance from the silo, explored); the rocket hits the 2x2 area of
 * target tile, right, below and diagonal (shifted inwards at the map edge, like the orbital laser) for damage on EVERY unit
 * (own ones too, no roll; units at peace block the launch as for the orbital laser) and on guns; cities and buildings stay.
 * Land tiles then burn for fireRounds rounds: at the start of each of those rounds every unit on a burning tile loses
 * fireDamage HP. After a launch the silo is locked for cooldown rounds (after building, charge rounds).
 */
export const SILO = {
  factions: ['meridon'] as FactionId[],
  builders: ['pioneer'] as UnitTypeId[],
  cost: 60,
  hp: 20,
  attack: 0,
  defense: 2.5,
  /** kein Gegenschlag: Schussweite des Bauwerks 0 / no return fire: the structure's firing range is 0 */
  range: 0,
  race: 'human' as HitRace,
  terrain: ['plain', 'forest', 'mountain'] as TerrainId[],
  perCity: 1,
  max: 3,
  minSpacing: 3,
  /** Raketenreichweite in Feldern / rocket range in tiles */
  launchRange: 12,
  area: { w: 2, h: 2 },
  damage: 9,
  fireRounds: 3,
  fireDamage: 2,
  cooldown: 3,
  charge: 1,
  /**
   * KI: Start ab Nettowert minValue (wie ORBITAL.ai), eigene Einheiten ownWeight-fach negativ; Bau erst ab minCities Staedten
   * und armyShare der Wunscharmee, direkt mit reserve Sternen Polster, sonst als Sparziel (Wert buyValue x Preis, bis zu
   * saveRounds Runden Einkommen).
   * AI: launch from net value minValue (as ORBITAL.ai), own units count ownWeight times negative; build only from minCities
   * cities and armyShare of the desired army, directly with a reserve star cushion, otherwise as a savings goal (value
   * buyValue x price, up to saveRounds rounds of income).
   */
  ai: { minValue: 6, ownWeight: 2.5, killBonus: 1, damageWeight: 1.5, fireWeight: 0.5, gunWorth: 40, wonderInterrupt: 25, minCities: 2, reserve: 15, armyShare: 0.5, buyValue: 1.6, saveRounds: 4 },
};

/**
 * Werft der Kuestenstaedte: eine Stadt mit Wasser im Gebiet oder direkt neben dem Stadtfeld kauft Schiffe. Das Schiff
 * erscheint leer (ohne getragene Einheit) auf einem freien Wasserfeld an der Stadt; eine Landeinheit steigt ein, indem sie
 * von einem Nachbarfeld auf das leere Schiff zieht (danach wie beim Einschiffen: LP der Einheit, erschoepft).
 * Transportboote brauchen weder Marinestuetzpunkt noch Forschung (Menschen); Kult und NEXUS brauchen Kuestenwirtschaft
 * wie beim Einschiffen, die Zyrr waten und haben keine Schiffe. Kriegsschiffe kosten ihren Preis aus UNITS und brauchen
 * die Produktionsstaette (Menschen) bzw. die Forschung (andere) wie beim Aufruesten. Keine Zwillinge, keine Veteranen.
 * Shipyard of coastal cities: a city with water in its territory or right next to the city tile buys ships. The ship
 * appears empty (no carried unit) on a free water tile at the city; a land unit boards by moving from an adjacent tile
 * onto the empty ship (then as when embarking: the unit's HP, exhausted). Transport boats need neither a naval base nor
 * research (humans); the cult and NEXUS need coastal economy as for embarking, the Zyrr wade and have no ships. Warships
 * cost their UNITS price and need the production site (humans) or the research (others) as for upgrading. No twins, no veterans.
 */
export const SHIPYARD = {
  /** Kaufpreis des leeren Transportboots (UNITS.landingBoat.cost bleibt 0: Einschiffen am Stuetzpunkt ist frei) / price of the empty transport boat (UNITS.landingBoat.cost stays 0: embarking at a base is free) */
  transportCost: 10,
  /**
   * Meridon: Nebelkutter statt Transportboot (getarnt, CAMO); Kaufpreis vor dem Flottenrabatt (SEA_POWER).
   * Meridon: Fog Cutter instead of the transport boat (camouflaged, CAMO); price before the fleet discount (SEA_POWER).
   */
  fogCutterCost: 14,
  /** Transportboot je Fraktion (fehlt = Landungsboot) / transport boat per faction (missing = landing boat) */
  transport: { meridon: 'fogCutter' } as Partial<Record<FactionId, UnitTypeId>>,
  /**
   * Rumpf-LP eines leeren Schiffs (sonst kommen die LP von der getragenen Einheit). Steigt eine Einheit ein, gelten ihre LP.
   * Hull HP of an empty ship (otherwise HP come from the carried unit). When a unit boards, its HP apply.
   */
  hullHp: { landingBoat: 6, submarine: 10, destroyer: 10, battleship: 12, privateer: 10, fogCutter: 6 } as Partial<Record<UnitTypeId, number>>,
  /** KI: hoechstens so viele leere Transportboote zugleich / AI: at most this many empty transport boats at once */
  aiMaxEmpty: 2,
  /** KI: ab dieser Runde Transportboote kaufen / AI: buy transport boats from this round */
  aiFromRound: 3,
};

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
export const INFANTRY_TYPES: UnitTypeId[] = ['infantry', 'mg', 'sniper', 'pioneer', 'railSniper', 'lightWarden', 'shadowCommando'];

export const COMBAT = {
  damageFactor: 4.5,
  splashFactor: 0.5, // Kriegsschiff: Anteil des Schadens auf Nachbarfelder / share of damage on neighbours
  /**
   * Angriff von hinten (Angreifer im Rueckenbereich des Ziels, siehe core/facing.ts): +50 % Schaden, nicht fuer den Gegenschlag.
   * Attack from behind (attacker in the target's rear arc, see core/facing.ts): +50 % damage, not for return fire.
   */
  rearAttack: 0.5,
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

/**
 * Reichweitenbonus nach Besitzer und Einheitentyp (Felder). Korvat "Lange Rohre": Artillerie 4 statt 3 Felder. Gilt vor dem
 * Wetter (Regen und Sandsturm kuerzen weiter um 1) und stapelt mit der Doktrin Ballistik (+1). Eine bekehrte Einheit
 * verliert ihn (der Besitzer zaehlt).
 * Range bonus by owner and unit type (tiles). Korvat "Long Barrels": artillery 4 instead of 3 tiles. Applies before the
 * weather (rain and dust storm still cut 1) and stacks with the ballistics doctrine (+1). A converted unit loses it
 * (the owner counts).
 */
export const ENTRENCH = {
  /**
   * Verschanzen nach Besitzer: Anteil, der bei Angriffen auf eine verschanzte Einheit von den vollen Treffern zu den
   * Fehlschuessen wandert (Korvat: +20 Punkte daneben). Verschanzt ist eine Bodeneinheit (kein Schiff, Flieger, Bauwerk,
   * Endgegner), die einen ganzen eigenen Zug nicht gezogen hat: das Zeichen wird am Ende des eigenen Zuges gesetzt, wenn
   * sie in diesem Zug weder gezogen noch neu aufgestellt wurde, und faellt mit der naechsten Bewegung. Gilt fuer jeden
   * Angriff auf sie (auch Gegenschlag und Geschuetze); ohne Trefferglueck sinkt der Schaden um den Erwartungswert.
   * Entrenching by owner: share that moves from full hits to misses for attacks on an entrenched unit (Korvat: +20 points
   * miss). A ground unit (no ship, flyer, structure, boss) is entrenched once it has not moved for a whole own turn: the mark
   * is set at the end of the own turn if it neither moved nor was newly placed during that turn, and it falls with the next
   * move. Applies to every attack on it (return fire and guns too); without hit luck damage drops by the expected value.
   */
  bonus: { korvat: 0.2 } as Partial<Record<FactionId, number>>,
};

export const RANGE_BONUS = {
  bonus: { korvat: { artillery: 1 } } as Partial<Record<FactionId, Partial<Record<UnitTypeId, number>>>>,
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
  skeletonUnits: ['infantry', 'sniper', 'pioneer', 'mg', 'medic', 'spy', 'antiTank', 'steppeRider', 'stormbreaker', 'peacekeeper', 'scientist', 'railSniper', 'lightWarden', 'shadowCommando'] as UnitTypeId[],
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
  units: ['tank', 'teslaTank', 'reliquary', 'steppeColossus', 'flameTank'] as UnitTypeId[],
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
  craterUnits: ['artillery', 'battleship', 'tank', 'reliquary', 'sunLance', 'steppeColossus', 'kamikazeDrone', 'guidedMissile'] as UnitTypeId[],
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
    hit: 2,
    /** Treffer schwerer Waffen (craterUnits) und Raketen / hit by heavy weapons (craterUnits) and rockets */
    heavyHit: 4,
    /** Flaechenschaden auf Nachbarfeldern / splash damage on adjacent tiles */
    splash: 1,
    /** Gegenfeuer auf das Feld des Angreifers / return fire on the attacker's tile */
    returnFire: 1,
    /** Tod einer Einheit (Skelett) / death of a unit (skeleton) */
    death: 3,
    /** Zerstoertes Fahrzeug, Schiff oder Flieger (Wrack) / destroyed vehicle, ship or flyer (wreck) */
    wreck: 4,
    /** Minenexplosion / mine explosion */
    mine: 5,
    /** Orbitalschlag je getroffenem Feld / orbital strike per struck tile */
    orbital: 6,
    /** Treffer eines Geschuetzes (Verdan-Linie, Geschuetzstellung) / hit by a gun (Verdan line, emplacement) */
    turret: 2,
    /** Meteoreinschlag (Wetter) / meteor impact (weather) */
    meteor: 1,
    /** Grosse Explosion (fuer kuenftige Kamikaze-/Sprengeffekte, addBattleScar) / big blast (for future kamikaze/blast effects, addBattleScar) */
    blast: 5,
    max: 30,
    light: 1,
    medium: 7,
    heavy: 18,
    healAfter: 12,
    healEvery: 3,
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
  /**
   * Stufe kaufen: Sternepreis fuer den Aufstieg von Stufe n auf n+1 = buyLevelBase x (n + 1), hoechstens einmal je Stadt und
   * Runde; nicht fuer den Kult, Sendetuerme und Nachschublinien (sie wachsen nicht). Ein Bevoelkerungspunkt kostet ueber
   * Gebaeude etwa 10 bis 12,5 Sterne, ein normaler Aufstieg also etwa 11 x (n + 1); gekauft ist er gut doppelt so teuer.
   * Buy level: star price for the step from level n to n+1 = buyLevelBase x (n + 1), at most once per city and round; not
   * for the cult, transmitter towers and supply lines (they do not grow). A population point costs about 10 to 12.5 stars
   * through buildings, so a normal level-up costs about 11 x (n + 1); bought it is a good twice as expensive.
   */
  buyLevelBase: 25,
  buyLevelCost: (level: number) => CITY.buyLevelBase * (level + 1),
  baseRadius: 1, // 3x3
  /**
   * Belohnung Grenzerweiterung (Stufe 4): ganzer Ring bis max(expandedRadius, radius + 1), hoechstens growMaxRadius.
   * Border expansion reward (level 4): a full ring up to max(expandedRadius, radius + 1), at most growMaxRadius.
   */
  expandedRadius: 2, // 5x5
  /**
   * Wachstum je Stufe (Spielerwunsch): jeder Aufstieg (auch gekauft) nimmt bis zu growTiles freie Felder im naechsten Ring
   * (Chebyshev-Abstand radius + 1), die naechsten zuerst (euklidisch, Gleichstand nach Feldindex); nur Felder ohne Gebiet und
   * ohne fremde Stadt. Ist der Ring voll (kein freies Feld mehr), wird er zum Radius und der Rest waechst im naechsten Ring
   * weiter, hoechstens bis growMaxRadius (7x7). Kult, Sendetuerme und Nachschublinien wachsen nicht.
   * Growth per level (player request): every level-up (bought ones too) takes up to growTiles free tiles in the next ring
   * (Chebyshev distance radius + 1), nearest first (euclidean, ties by tile index); only tiles without territory and without
   * another city. Once the ring is full (no free tile left) it becomes the radius and the rest grows on into the next ring,
   * at most up to growMaxRadius (7x7). Cult, transmitter towers and supply lines do not grow.
   */
  growTiles: 4,
  growMaxRadius: 3, // 7x7
  unitLimitExtra: 1, // Stufe + 1 / level + 1
  /** jeder Stadt-Ausbau (CITY_UPGRADES) traegt eine Einheit mehr / every city upgrade (CITY_UPGRADES) supports one more unit */
  unitLimitPerUpgrade: 1,
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
  /** Mindestabstand zwischen zwei Aussenposten (jeder Fraktion) in Feldern, Spielerwunsch / minimum distance between two outposts (any faction) in tiles, player request */
  outpostSpacing: 4,
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
    armory: ['mg', 'antiTank', 'mineLayer', 'antiAir', 'stormbreaker', 'shadowCommando'],
    motorPool: ['jeep', 'radarTruck'],
    tankWorks: ['tank', 'teslaTank', 'reliquary', 'steppeColossus', 'protoWalker'],
    foundry: ['artillery', 'sunLance', 'guidedMissile'],
    airfield: ['heli', 'octocopter'],
    // Transportboote brauchen keine Staette (SHIPYARD); der Stuetzpunkt bleibt Einschiffungsort / transport boats need no site (SHIPYARD); the base stays the embarking point
    navalBase: ['destroyer', 'privateer'],
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
  perk: 'massMobilization' | 'drill' | 'judgement' | 'shadowBank' | 'researchLead' | 'xenotech' | 'zealotry' | 'hivemind';
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
  meridon: { perk: 'shadowBank', perk2: 'harbourPilots', discountUnit: 'spy', discount: 0.3, startTech: 'coastalEconomy', home: { plain: 0.4, forest: 0.15, mountain: 0.05, water: 0.4, res: { fish: 0.3, supplies: 0.1 } } },
  zyrr: { perk: 'xenotech', perk2: 'forestSpawn', discountUnit: 'grey', discount: 0, startTech: null, home: { plain: 0.45, forest: 0.2, mountain: 0.25, water: 0.1, res: { ore: 0.2, supplies: 0.15 } } },
  vesper: { perk: 'zealotry', perk2: 'martyrdom', discountUnit: 'zealot', discount: 0, startTech: 'livestock', home: { plain: 0.5, forest: 0.25, mountain: 0.15, water: 0.1, res: { livestock: 0.2, supplies: 0.15 } } },
  nexus: { perk: 'hivemind', perk2: 'sensorNet', discountUnit: 'android', discount: 0, startTech: 'coastalEconomy', extraTechs: ['diving', 'shipbuilding'], home: { plain: 0.55, forest: 0.1, mountain: 0.25, water: 0.1, res: { ore: 0.3, supplies: 0.1 } } },
  velkar: { perk: 'researchLead', perk2: 'engineerCorps', discountUnit: 'pioneer', discount: 0.2, startTech: 'mountainTraining', home: { plain: 0.25, forest: 0.35, mountain: 0.35, water: 0.05, res: { ore: 0.2, supplies: 0.1 } } },
};

export const PERKS = {
  massMobilizationExtraUnits: 1,
  drillKills: 2,
  /**
   * Meridon "Schattenbank" (vorher "Boom"): verdeckte Investitionen in die eigenen Staedte, jeder Stadtaufstieg braucht so
   * viele Bevoelkerungspunkte weniger, mindestens 1 (Wirkung wie Boom; Tuning 2, vorher 3 Sterne je Kuestenstadt).
   * Meridon "Shadow Bank" (formerly "Boom"): covert investment in its own cities, every city level-up needs this many
   * population points less, at least 1 (same effect as Boom; tuning 2, before 3 stars per coastal city).
   */
  shadowBankLevelReduction: 1,
  researchLeadDiscount: 0.12,
};

/** Zweite Fraktionsmerkmale / second faction traits */
export const PERKS2 = {
  /** Korvat, Erdwaelle: Aussenposten-Preis / earthworks: outpost price */
  earthworksOutpostCost: 15,
  /** Dravon, kampferprobt: Angriff der Veteranen / battle-hardened: veteran attack bonus */
  battleHardenedAttack: 0.5,
  /** Meridon, Lotsenwesen: Landungsboote und Nebelkutter fahren weiter / harbour pilots: landing boats and Fog Cutters move further */
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

/** Regel eines Korruptions-Nachteils / rule of a corruption drawback */
export interface CorruptionRule {
  /** Chance je Runde zu Beginn des eigenen Zuges / chance per round at the start of the own turn */
  chance: number;
  /** Anteil der Sterne, abgerundet / share of the stars, rounded down */
  share: number;
  /** mindestens so viele Sterne (hat die Fraktion weniger, alle) / at least this many stars (all, if the faction has fewer) */
  min: number;
  /** hoechstens so viele Sterne je Mal / at most this many stars each time */
  max: number;
  /** hoechstens so viele Faelle ... / at most this many hits ... */
  cap: number;
  /** ... in so vielen aufeinanderfolgenden Runden (gleitendes Fenster) / ... in this many consecutive rounds (sliding window) */
  window: number;
}

/**
 * Korruption, Nachteil der Handelsliga Meridon, als Zufallsereignis: Zu Beginn jedes eigenen Zuges (nicht in Runde 1) schlaegt
 * sie mit `chance` zu; dann verliert die Fraktion nach Einkommen und Sold `share` ihrer Sterne (abgerundet), mindestens `min`
 * (hat sie weniger, alle), hoechstens `max`; die Kasse faellt nie unter 0. Nie oefter als `cap`-mal in `window`
 * aufeinanderfolgenden Runden (gleitendes Fenster ueber die Runden der letzten Faelle, Faction.corruptionHits). Nur mit
 * eingeschalteten Zufallsereignissen (cfg.events), auch in der Kampagne. Der Wurf kommt wie bei den anderen Ereignissen aus
 * Seed, Runde und Fraktion (eventHash mit Schluessel `salt` + Fraktionsindex), nicht aus dem Hauptstrom s.rng. Die Obergrenze
 * `max` haelt den Handelsmonopol-Sieg (Sterne in der Kasse) erreichbar. Je Fraktion angelegt, damit spaeter weitere
 * Fraktionen einen solchen Nachteil bekommen koennen. Messung in BALANCING.md und ANNAHMEN.md (Korruption).
 * Corruption, drawback of the Meridon Trade League, as a random event: at the start of each own turn (not in round 1) it
 * strikes with `chance`; the faction then loses, after income and upkeep, `share` of its stars (rounded down), at least `min`
 * (all, if it has fewer), at most `max`; the treasury never drops below 0. Never more often than `cap` times in `window`
 * consecutive rounds (sliding window over the rounds of the last hits, Faction.corruptionHits). Only with random events on
 * (cfg.events), in the campaign too. The roll comes, as for the other events, from seed, round and faction (eventHash with key
 * `salt` + faction index), not from the main stream s.rng. The cap `max` keeps the Trade Monopoly victory (stars in the
 * treasury) reachable. Keyed per faction so other factions can get such a drawback later. Measurement in BALANCING.md and
 * ANNAHMEN.md (corruption).
 */
export const CORRUPTION = {
  /** Schluessel des Wurfs (eventHash), plus Fraktionsindex / key of the roll (eventHash), plus faction index */
  salt: 100,
  faction: {
    meridon: { chance: 0.25, share: 0.25, min: 5, max: 50, cap: 3, window: 10 },
  } as Partial<Record<FactionId, CorruptionRule>>,
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
  /** Siedlungen je Feld, Obergrenze (vorher 1/13) / villages per tile, upper bound (before 1/13) */
  villagesPerTile: 1 / 15,
  /**
   * Anteil der platzierten Siedlungen, der bleibt: 30 % weniger (Spielerwunsch, Staedte wachsen dafuer je Stufe,
   * CITY.growTiles). Gilt fuer alle neutralen Siedlungen einer Karte (Heimatsiedlungen eingeschlossen), nachdem Dichte
   * (villagesPerTile) und Abstaende sie begrenzt haben; auf 14x14 und 16x16 begrenzen meist die Abstaende, nicht die Dichte,
   * deshalb wirkt der Anteil auf das Ergebnis. Heimatsiedlungen bleiben immer. Die Kampagne skaliert zusaetzlich mit
   * CAMPAIGN_SETTLEMENTS.
   * Share of the placed villages that stays: 30 % fewer (player request, cities grow per level instead, CITY.growTiles).
   * Applies to all neutral villages of a map (home villages included) after density (villagesPerTile) and spacing have
   * limited them; on 14x14 and 16x16 spacing rather than density is usually the limit, which is why the share acts on the
   * result. Home villages always stay. The campaign additionally scales with CAMPAIGN_SETTLEMENTS.
   */
  villageShare: 1,
  /**
   * Mindestabstand zwischen zwei neutralen Siedlungen (Heimatsiedlungen eingeschlossen) in Feldern, Schachbrett-Abstand
   * (Spielerwunsch). Nur wenn eine Startinsel sonst keine Heimatsiedlung bekaeme, gilt fuer sie minCityDistance.
   * Minimum distance between two neutral villages (home villages included) in tiles, Chebyshev distance (player request).
   * Only if a start island would otherwise get no home village does minCityDistance apply to it.
   */
  villageSpacing: 4,
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
 * Sendetuerme der Kampagne (nicht in der Hoehle) und freier Partien (Spielerwunsch; nicht im Tutorial): neutrale Orte wie
 * Nachschublinien, einnehmbar, bilden aus, wachsen nicht, keine Ausbauten. Anzahl je Karte: Felder / perTiles, begrenzt
 * auf min..max (11x11: 2, 14x14: 3, ab 16x16: 4); MissionDef.towers ueberschreibt. Abstand zu Hauptquartieren
 * hqDistance, zu Staedten cityDistance, untereinander spacing. Freie Partien: reicht der Platz nicht (viele Fraktionen
 * auf kleiner Karte), duerfen die uebrigen Tuerme bis freeHqDistance an ein Hauptquartier heran.
 * Transmitter towers of the campaign (not in the cavern) and of free games (player request; not in the tutorial):
 * neutral places like supply lines, capturable, they train, do not grow, no upgrades. Count per map: tiles / perTiles,
 * clamped to min..max (11x11: 2, 14x14: 3, from 16x16: 4); MissionDef.towers overrides. Distance to HQs hqDistance, to
 * cities cityDistance, to each other spacing. Free games: if there is not enough room (many factions on a small map), the
 * remaining towers may come as close as freeHqDistance to an HQ.
 */
export const TOWER = { income: 2, unitLimit: 2, perTiles: 70, min: 2, max: 4, hqDistance: 4, freeHqDistance: 3, cityDistance: 2, spacing: 4 };

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
  /**
   * Kamikaze-Drohne: der Angriff kostet die Drohne, also zieht die KI ihren Wert mal diesem Faktor ab; sie sprengt sich nur,
   * wenn Vernichtung oder Schaden am Ziel das aufwiegen (zusaetzlich zur Mindestschwelle des Profils).
   * Kamikaze drone: the attack costs the drone, so the AI subtracts its worth times this factor; it only blows itself up
   * when the kill or the damage on the target outweighs that (on top of the profile's minimum threshold).
   */
  kamikazeCost: 1,
  /** Kamikaze: Mindestwert eines Angriffs (Sterne-Gegenwert nach Abzug der Drohne) / kamikaze: minimum value of an attack (star equivalent after subtracting the drone) */
  kamikazeMin: 3,
  /**
   * Meridon "Zwei fuer einen": Wertfaktor einer Ausbildung, die zwei Einheiten bringt; passt nur eine (Limit, kein Feld),
   * gilt der Faktor nicht (der zweite Platz waere verschenkt).
   * Meridon "Two for One": value factor of a training that brings two units; if only one fits (limit, no tile), the factor
   * does not apply (the second slot would be wasted).
   */
  twinValue: 1.8,
  /**
   * Korvat: Zuschlag auf den Wert des Panzerwerks, weil dort der Steppenkoloss entsteht (die Korvat haben selten Erz).
   * Korvat: bonus on the worth of the tank works because the Steppe Colossus is built there (Korvat rarely has ore).
   */
  colossusWorks: 24,
};

/** Benannte Taktiken der KI (operative Ebene, src/ai/operations.ts) / named AI tactics (operational layer, src/ai/operations.ts) */
export type TacticKind = 'ambush' | 'encircle' | 'rear' | 'feint' | 'storm' | 'diversion';
export const TACTIC_KINDS: TacticKind[] = ['storm', 'diversion', 'encircle', 'rear', 'feint', 'ambush'];

/**
 * Operative Ebene der KI: Taktiken ueber mehrere Zuege mit Plaenen im KI-Gedaechtnis (nicht im Spielstand).
 * Operational AI layer: tactics over several turns with plans in the AI memory (not in the save).
 */
export const AI_TACTICS = {
  /**
   * Je Schwierigkeit: erlaubte Taktiken, gleichzeitige Operationen, Anteil der genutzten Gelegenheiten (deterministisches
   * Rauschen), Abstimmung der Angriffsreihenfolge (Frontalangriff dreht das Ziel, dann von hinten) und Mitglieder je Operation.
   * Per difficulty: allowed tactics, concurrent operations, share of opportunities taken (deterministic noise),
   * coordination of the attack order (a frontal attack turns the target, then from behind) and members per operation.
   */
  difficulty: {
    easy: { kinds: ['storm', 'ambush', 'encircle'] as TacticKind[], maxOps: 1, chance: 0.35, coordinate: false, maxMembers: 3 },
    normal: { kinds: TACTIC_KINDS, maxOps: 2, chance: 0.75, coordinate: true, maxMembers: 5 },
    hard: { kinds: TACTIC_KINDS, maxOps: 3, chance: 1, coordinate: true, maxMembers: 7 },
    extreme: { kinds: TACTIC_KINDS, maxOps: 4, chance: 1, coordinate: true, maxMembers: 8 },
  } as Record<Difficulty, { kinds: TacticKind[]; maxOps: number; chance: number; coordinate: boolean; maxMembers: number }>,
  /**
   * Vorlieben je Fraktion (Faktor auf den Wert einer Gelegenheit; unter 0,5 wird sie nur bei sehr guter Lage gewaehlt).
   * Korvat: verschanzen, Rueckzug in die Feuerzone; Dravon: Sturm und Rueckenangriffe mit Jeeps; Velkar: Hinterhalte mit
   * Fernkaempfern; Alvenia: Hinterhalt und Rueckzug ins eigene Gebiet; Meridon: Ablenkung zur Kueste und Hinterhalte (Schattenflotte); Zyrr: Wellen und
   * Ueberfaelle; Kult: Schwaerme kreisen ein; NEXUS: Kamikaze-Drohnen eroeffnen Hinterhalte und Stuerme.
   * Preferences per faction (factor on the value of an opportunity; below 0.5 it is only chosen when the situation is very good).
   * Korvat: entrench, retreat into the fire zone; Dravon: storm and rear attacks with jeeps; Velkar: ambushes with ranged
   * units; Alvenia: ambush and retreat into own territory; Meridon: diversions along the coast and ambushes (shadow fleet); Zyrr: waves and raids;
   * cult: swarms encircle; NEXUS: kamikaze drones open ambushes and storms.
   */
  weights: {
    korvat: { storm: 0.9, diversion: 0.8, encircle: 0.9, rear: 1.1, feint: 1.6, ambush: 1.2 },
    dravon: { storm: 1.4, diversion: 1.1, encircle: 1, rear: 1.5, feint: 0.6, ambush: 0.8 },
    alvenia: { storm: 0.8, diversion: 0.7, encircle: 0.8, rear: 0.8, feint: 1.4, ambush: 1.3 },
    meridon: { storm: 1, diversion: 1.5, encircle: 0.9, rear: 1, feint: 0.9, ambush: 1.4 },
    velkar: { storm: 0.9, diversion: 0.9, encircle: 0.9, rear: 0.8, feint: 1.1, ambush: 1.6 },
    zyrr: { storm: 1.4, diversion: 1.4, encircle: 1, rear: 1.2, feint: 0.4, ambush: 0.6 },
    vesper: { storm: 1.3, diversion: 0.9, encircle: 1.6, rear: 0.9, feint: 0.3, ambush: 0.6 },
    nexus: { storm: 1.3, diversion: 1, encircle: 1, rear: 1, feint: 0.8, ambush: 1.3 },
  } as Record<FactionId, Record<TacticKind, number>>,
  /**
   * Sturmangriff: Kraeftevergleich im Umkreis (eigene Einheiten bis radius Felder, Gegner bis 3 Felder um die Stadt plus
   * Stadtzuschlag), Mindestverhaeltnis und Mindestzahl; Sammeln hoechstens gatherTurns Zuege ausserhalb der Gefahr, dann
   * Sturm (alle Einheiten in einem Zug: Fernkampf und Kamikaze zuerst, dann schwere Einheiten, dann Infanterie zum Einnehmen).
   * Storm assault: force ratio in the area (own units within radius tiles, enemies within 3 tiles of the city plus a city
   * surcharge), minimum ratio and minimum count; gather at most gatherTurns turns outside the danger, then storm (all units
   * in one turn: ranged and kamikaze first, then heavy units, then infantry to capture).
   */
  storm: { radius: 6, maxTurns: 4, ratio: 1.5, minUnits: 3, gatherTurns: 3, strikeTurns: 3, cityOpp: 12, bunkerOpp: 30, readyShare: 0.6, strikeCaution: 0.2, gatherPenalty: 18, ringBonus: 6, order: { opener: 30, ranged: 20, heavy: 10 }, strikeBonus: 2, attackRelax: 4 },
  /**
   * Ablenkung: eine kleine schnelle Gruppe nimmt eine entlegene, schwach verteidigte Stadt oder Siedlung (mindestens
   * remote Felder von der Hauptfront), waehrend die Hauptmacht dort sichtbar angreift.
   * Diversion: a small fast group takes a remote, weakly defended city or village (at least remote tiles away from the main
   * front) while the main force attacks visibly there.
   */
  diversion: { remote: 5, maxTurns: 4, maxOpp: 16, raiders: 2, pins: 2, routeCaution: 1.4, nearCaution: 0.5, pinCaution: 0.6, rounds: 6 },
  /**
   * Einkreisen: isoliertes Ziel (Unterstuetzung im Umkreis 2 unter isolated x Wert), 2+ Einheiten auf verschiedene
   * Nachbarfelder, bevorzugt Rueckenfelder und Fluchtfelder Richtung Heimat; slotBonus fuer das zugeteilte Feld.
   * Encirclement: isolated target (support within 2 below isolated x worth), 2+ units on different neighbour tiles,
   * preferably rear tiles and escape tiles towards its home; slotBonus for the assigned tile.
   */
  encircle: { reach: 4, isolated: 0.6, ratio: 1.2, slotBonus: 10, adjBonus: 3, caution: 0.5, rounds: 4, attackBonus: 2 },
  /**
   * Rueckenangriff: schnelle Einheit (mindestens 2 Felder Bewegung, Sturm) auf ein Feld im Rueckenbereich eines Gegners,
   * der schon Kontakt mit eigenen Truppen hat (der Frontalangriff dreht ihn zusaetzlich zum Angreifer).
   * Rear attack: a fast unit (at least 2 tiles of movement, dash) onto a tile in the rear arc of an enemy already in
   * contact with own troops (the frontal attack also turns it towards the attacker).
   */
  rear: { reach: 2, tileBonus: 12, rounds: 3 },
  /**
   * Vorgetaeuschter Rueckzug: ein Koeder im Kontakt zieht sich auf ein Feld zurueck, dessen Nachbarfelder von der Feuerzone
   * (Fernkaempfer, verschanzte Einheiten, Geschuetzstellungen, verteidigte Staedte) bestrichen werden; die Feuerzone haelt
   * die Stellung und schlaegt in der naechsten Runde zu.
   * Feigned retreat: a bait in contact pulls back onto a tile whose neighbours are covered by the kill zone (ranged units,
   * entrenched units, gun emplacements, defended cities); the kill zone holds its position and strikes next round.
   */
  feint: { minCover: 2, coverBonus: 6, tileBonus: 14, holdBonus: 14, retreatBonus: 8, strikeBonus: 3, rounds: 2 },
  /**
   * Hinterhalt: Fernkaempfer und Einheiten ohne Abzug fuer Feuern nach Bewegung warten ausserhalb der gegnerischen
   * Reichweite (bevorzugt Wald und vom Gegner unerkundete Felder) neben dem vermuteten Anmarschweg und schlagen zu, sobald
   * Gegner in Reichweite ziehen. approach = Gegner so nah an eigenen Staedten (bzw. Einheiten) gilt als anrueckend.
   * Ambush: ranged units and units without a move-fire penalty wait outside enemy reach (preferably forest and tiles the
   * enemy has not explored) next to the presumed approach path and strike once enemies move into range.
   * approach = an enemy this close to own cities (or units) counts as approaching.
   */
  ambush: { approach: 6, approachUnit: 5, maxUnits: 3, slotBonus: 15, cover: 4, hidden: 6, rearArc: 5, holdBonus: 10, attackBonus: 3, caution: 1.5, rounds: 3 },
  /** Abstimmung: Gewicht des Gewinns eines Folgeangriffs von hinten / coordination: weight of a follow-up attack's gain from behind */
  coordinate: { gain: 0.8 },
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
