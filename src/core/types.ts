import type {
  BiomeId, BuildingId, CityUpgradeId, Difficulty, FactionId, GameMode, GrandProjectId, MapSize, MapType, ResourceId, TechId, TerrainId,
  UnitTypeId, BunkerReward,
} from '../data/balance';

export interface Pos { x: number; y: number }

export interface Tile {
  terrain: TerrainId;
  resource: ResourceId | null;
  building: BuildingId | null;
  road: boolean;
  /** Stadt auf diesem Feld / city on this tile */
  cityId: number | null;
  /** Stadtgebiet / territory of city */
  territory: number | null;
  feature: 'bunker' | 'radar' | 'crashSite' | 'labRuin' | null;
  /** Index der Fraktion, deren Heimatgebiet hier liegt / index of the faction whose home region is here */
  home: number | null;
  outpost: { owner: number } | null;
  grandProject: GrandProjectId | null;
  /** Runde, in der das Forschungszentrum gebaut wurde / round in which the research centre was built */
  researchBuilt: number | null;
  /** Wrack oder Skelett einer gefallenen Einheit / wreck or skeleton of a fallen unit */
  remains?: Remains | null;
  /** Landschaftszone (optisch) / biome (visual) */
  biome?: BiomeId;
  /** Berghoehe 1-3 (optisch) / mountain height 1-3 (visual) */
  peak?: number;
  /** Krater und Brandflecken (optisch) / craters and scorch marks (visual) */
  marks?: { k: 'crater' | 'scorch'; a: number; ox: number; oz: number }[];
  /** Kettenspuren: Winkel und Runde (optisch) / track marks: angle and round (visual) */
  tracks?: { a: number; r: number }[];
  /** Fluss (optisch) / river (visual) */
  river?: boolean;
  /** Panzersperre / tank barrier */
  barrier?: { owner: number } | null;
  /** terraformt: Xeno-Boden der Zyrr / terraformed: Zyrr xeno ground */
  xeno?: boolean;
  /** Vulkan auf diesem Bergfeld / volcano on this mountain tile */
  volcano?: boolean;
  /** brennt bis einschliesslich dieser Runde (Lava) / burns until and including this round (lava) */
  lava?: number;
  /** Absturzstelle bereits geborgen / crash site already salvaged */
  looted?: boolean;
}

/** Ueberreste bleiben dauerhaft / remains are permanent. skeletons = Anzahl gefallener Fusstruppen / number of fallen foot soldiers */
export interface Remains { kind: 'wreck' | 'skeleton'; unit: UnitTypeId; faction: number; round: number; skeletons?: number; skeletonFaction?: number }

export interface City {
  id: number;
  x: number;
  y: number;
  owner: number | null; // null = neutrale Siedlung / neutral settlement
  level: number;
  pop: number;
  radius: number;
  isHQ: boolean;
  /** urspruenglicher Besitzer des Hauptquartiers / original owner of the HQ */
  hqOf: number | null;
  factory: boolean;
  bunkerRing: boolean;
  govQuarter: boolean;
  connected: boolean;
  noIncomeNext: boolean;
  /** gekaufte Ausbauten (hoechstens 3) / bought upgrades (at most 3) */
  upgrades?: CityUpgradeId[];
  nameIndex: number;
}

export interface Unit {
  id: number;
  type: UnitTypeId;
  /** getragene Landeinheit bei Schiffen / carried land unit on ships */
  carried: UnitTypeId | null;
  owner: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  homeCity: number | null;
  kills: number;
  veteran: boolean;
  moved: boolean;
  attacked: boolean;
  /** Bewegung beendet (z. B. durch Wald) / movement finished */
  moveDone: boolean;
  /** kann in diesem Zug nicht mehr handeln / cannot act this turn */
  exhausted: boolean;
  /** erst im naechsten Zug aktiv / active from next turn */
  fresh: boolean;
  fuel: number | null;
  /** aufgetaucht bis zum naechsten eigenen Zug / surfaced until next own turn */
  revealed: boolean;
  /** durch Panzersperre gebremst: diese Runde / slowed by a tank barrier: this round */
  slowed?: boolean;
  /** ab der naechsten eigenen Runde gebremst / slowed from the next own round */
  slowedNext?: boolean;
  /** stand zu Beginn des Zuges hier (fuer Einnahme) / stood here at turn start (for capture) */
  startX: number;
  startY: number;
}

export type Relation = 'war' | 'peace' | 'breaking';

export interface Faction {
  index: number;
  id: FactionId;
  human: boolean;
  difficulty: Difficulty;
  stars: number;
  techs: TechId[];
  explored: number[]; // Bitfeld als Zahlenliste (0/1) / bit field as number list (0/1)
  alive: boolean;
  contacts: number[];
  /** Beziehungen je Fraktionsindex / relations per faction index */
  relations: Relation[];
  breakRound: (number | null)[];
  peaceOffers: number[]; // Indizes, die Frieden anbieten / indices offering peace
  embassies: number[]; // Fraktionsindizes, bei denen eine Botschaft steht / factions hosting our embassy
  kills: number;
  lastAttackRound: number;
  grandProjectsBuilt: GrandProjectId[];
  grandProjectsUnlocked: GrandProjectId[];
  radarsFound: number[];
  maxStars: number;
  eliminatedRound: number | null;
}

export interface PendingReward {
  cityId: number;
  level: number;
}

export interface GameConfig {
  seed: number;
  size: MapSize;
  mapType: MapType;
  mode: GameMode;
  factions: { id: FactionId; human: boolean; difficulty: Difficulty }[];
  startStars: number;
  /** Wetter an (Standard) / weather on (default) */
  weather?: boolean;
  /** Kartenbesonderheiten: Vulkane, Absturzstellen, Wracks, Dschungel / map gimmicks */
  hazards?: 'none' | 'normal' | 'many';
  /** Spielrundenlimit (Punktemodus) / round limit (points mode) */
  roundLimit: number | null;
}

export interface GameState {
  version: 1;
  config: GameConfig;
  rng: number;
  size: number;
  tiles: Tile[];
  cities: City[];
  units: Unit[];
  factions: Faction[];
  round: number;
  current: number;
  nextId: number;
  pendingRewards: PendingReward[];
  radars: Pos[];
  bunkerRewardsTaken: number;
  winner: number | null;
  over: boolean;
  log: GameEvent[];
}

export type GameEvent =
  | { t: 'move'; unit: number; path: Pos[] }
  | { t: 'attack'; unit: number; target: number; dmg: number; ret: number; splash?: { unit: number; dmg: number }[] }
  | { t: 'killed'; unit: number; by: number | null; remains?: 'wreck' | 'skeleton' | null; x?: number; y?: number }
  | { t: 'capture'; city: number; faction: number; from: number | null }
  | { t: 'outpostCapture'; x: number; y: number; faction: number }
  | { t: 'cityLevel'; city: number; level: number }
  | { t: 'reward'; city: number; choice: 'a' | 'b'; level: number }
  | { t: 'train'; unit: number; city: number }
  | { t: 'build'; building: BuildingId | 'outpost' | GrandProjectId; x: number; y: number; faction: number }
  | { t: 'research'; tech: TechId; faction: number }
  | { t: 'heal'; unit: number; amount: number }
  | { t: 'convert'; unit: number; target: number }
  | { t: 'veteran'; unit: number }
  | { t: 'bunker'; x: number; y: number; reward: BunkerReward; faction: number }
  | { t: 'radar'; index: number; faction: number }
  | { t: 'contact'; a: number; b: number; stars: number }
  | { t: 'crash'; unit: number }
  | { t: 'flak'; city: number; unit: number; dmg: number }
  | { t: 'barrier'; x: number; y: number; faction: number }
  | { t: 'cityUpgrade'; city: number; upgrade: CityUpgradeId; faction: number; target?: Pos }
  | { t: 'terraform'; x: number; y: number; faction: number; unit?: number }
  | { t: 'barrierHit'; unit: number; x: number; y: number }
  | { t: 'uprising'; city: number; faction: number; spawned: number }
  | { t: 'embark'; unit: number }
  | { t: 'disembark'; unit: number }
  | { t: 'upgrade'; unit: number; to: UnitTypeId }
  | { t: 'peace'; a: number; b: number }
  | { t: 'peaceOffer'; from: number; to: number }
  | { t: 'peaceDeclined'; from: number; to: number }
  | { t: 'breakAnnounced'; from: number; to: number }
  | { t: 'war'; a: number; b: number }
  | { t: 'embassy'; from: number; to: number }
  | { t: 'grandProject'; id: GrandProjectId; faction: number }
  | { t: 'unlockGrand'; id: GrandProjectId; faction: number }
  | { t: 'connected'; city: number }
  | { t: 'eliminated'; faction: number }
  | { t: 'turn'; faction: number; round: number; income: number; weather?: string }
  | { t: 'eruption'; x: number; y: number; tiles: Pos[] }
  | { t: 'salvage'; x: number; y: number; faction: number; kind: 'crashSite' | 'labRuin'; tech?: TechId; stars?: number; unit?: number }
  | { t: 'gameOver'; winner: number | null };

export type DiplomacyAction = 'proposePeace' | 'acceptPeace' | 'declinePeace' | 'announceBreak' | 'embassy';

export type Command =
  | { type: 'move'; unit: number; to: Pos }
  | { type: 'attack'; unit: number; target: number }
  | { type: 'heal'; unit: number }
  | { type: 'medicHeal'; unit: number }
  | { type: 'convert'; unit: number; target: number }
  | { type: 'capture'; unit: number }
  | { type: 'train'; city: number; unitType: UnitTypeId }
  | { type: 'build'; building: BuildingId; x: number; y: number }
  | { type: 'grandProject'; id: GrandProjectId; x: number; y: number }
  | { type: 'outpost'; unit: number }
  | { type: 'barrier'; unit: number; x: number; y: number }
  | { type: 'cityUpgrade'; city: number; upgrade: CityUpgradeId; target?: Pos }
  | { type: 'terraform'; x: number; y: number; unit?: number }
  | { type: 'recruit'; unit: number; unitType: UnitTypeId; x: number; y: number }
  | { type: 'upgrade'; unit: number; to: UnitTypeId }
  | { type: 'research'; tech: TechId }
  | { type: 'reward'; city: number; choice: 'a' | 'b' }
  | { type: 'diplomacy'; action: DiplomacyAction; target: number }
  | { type: 'endTurn' };

export type ErrorCode =
  | 'gameOver' | 'notYourUnit' | 'noUnit' | 'unitExhausted' | 'unreachable' | 'outOfRange' | 'invalidTarget'
  | 'peace' | 'cannotAttack' | 'alreadyMoved' | 'alreadyAttacked' | 'notEnoughStars' | 'techMissing'
  | 'invalidTile' | 'occupied' | 'unitLimit' | 'notYourCity' | 'alreadyResearched' | 'parentMissing'
  | 'cannotCapture' | 'pendingReward' | 'noReward' | 'onePerCity' | 'notInTerritory' | 'alreadyBuilt'
  | 'notUnlocked' | 'noContact' | 'invalid' | 'fresh' | 'noResearch' | 'notTerraformed' | 'wrongFaction'
  | 'notPreacher' | 'computeMissing' | 'cultRecruit';

export interface CommandResult {
  ok: boolean;
  error?: ErrorCode;
  events: GameEvent[];
}
