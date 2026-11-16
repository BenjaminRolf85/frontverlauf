import type {
  BiomeId, BuildingId, CityUpgradeId, Difficulty, ProductionSiteId, FactionId, GameMode, GrandProjectId, MapSize, MapType, ResourceId, TechId, TerrainId,
  UnitTypeId, BunkerReward, HitKind, WonderKind, WonderUnitId, SinDeed,
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
  /** mothership = Feld des Zyrr-Mutterschiffs (Kampagne m2, unpassierbar) / tile of the Zyrr mothership (campaign m2, impassable) */
  feature: 'bunker' | 'radar' | 'crashSite' | 'labRuin' | 'mothership' | null;
  /** Index der Fraktion, deren Heimatgebiet hier liegt / index of the faction whose home region is here */
  home: number | null;
  /**
   * Aussenposten; claims = Felder (Index), die er dem Gebiet von Stadt city hinzugefuegt hat.
   * Outpost; claims = tiles (index) it added to the territory of city city.
   */
  outpost: { owner: number; city?: number; claims?: number[] } | null;
  grandProject: GrandProjectId | null;
  /** Runde, in der das Forschungszentrum gebaut wurde / round in which the research centre was built */
  researchBuilt: number | null;
  /** Wrack oder Skelett einer gefallenen Einheit / wreck or skeleton of a fallen unit */
  remains?: Remains | null;
  /** Mahnmal des Kults: zur Schau gestellte Leiche eines Soldaten (CULT.memorialRounds) / cult memorial: a soldier's corpse on display */
  memorial?: Memorial | null;
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
  /** verdeckte Mine (nur Besitzer und Nachbareinheiten sehen sie) / hidden mine (only the owner and adjacent units see it) */
  mine?: { owner: number } | null;
  /** terraformt: Xeno-Boden der Zyrr / terraformed: Zyrr xeno ground */
  xeno?: boolean;
  /** Vulkan auf diesem Bergfeld / volcano on this mountain tile */
  volcano?: boolean;
  /** brennt bis einschliesslich dieser Runde (Lava) / burns until and including this round (lava) */
  lava?: number;
  /** Absturzstelle bereits geborgen / crash site already salvaged */
  looted?: boolean;
  /** Teil der Grundflaeche eines Wunders (Fusionskraftwerk): Einheiten-ID; unpassierbar / part of a wonder footprint (fusion plant): unit id; impassable */
  wonderOf?: number | null;
  /**
   * Geschuetz der alten Verdan-Verteidigungslinie (neutral, unpassierbar); active = erwacht und feuert.
   * Mit owner: Geschuetzstellung dieser Fraktion (Festungsbau, EMPLACEMENT), immer aktiv; fehlt = neutral (alte Spielstaende).
   * Gun of the old Verdan defence line (neutral, impassable); active = awake and firing.
   * With owner: gun emplacement of that faction (fortification, EMPLACEMENT), always active; missing = neutral (old saves).
   */
  turret?: { hp: number; active: boolean; owner?: number } | null;
  /** Truemmer eines zerstoerten Geschuetzes (optisch) / rubble of a destroyed gun (visual) */
  turretRuin?: boolean;
  /** Fraktion der zerstoerten Stellung (nur Optik der Truemmer) / faction of the destroyed emplacement (rubble look only) */
  turretRuinOwner?: number;
  /**
   * Teil des Fanatiker-Tempels (Kampagne m4, 2x2): unpassierbar, nicht einnehmbar, nicht angreifbar, nicht bebaubar.
   * Part of the Fanatic temple (campaign m4, 2x2): impassable, not capturable, not attackable, not buildable.
   */
  temple?: boolean;
}

/** Ueberreste bleiben dauerhaft / remains are permanent. skeletons = Anzahl gefallener Fusstruppen / number of fallen foot soldiers */
export interface Remains { kind: 'wreck' | 'skeleton'; unit: UnitTypeId; faction: number; round: number; skeletons?: number; skeletonFaction?: number }

/**
 * Mahnmal des Kults: wirkt bis einschliesslich Runde until; unit und faction = der Gefallene (nur Optik).
 * Cult memorial: active until and including round until; unit and faction = the fallen (visual only).
 */
export interface Memorial { until: number; unit: UnitTypeId; faction: number }

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
  /**
   * Sendeturm der Kampagne: bildet aus wie eine Nachschublinie, waechst nicht, keine Ausbauten (TOWER).
   * Campaign transmitter tower: trains like a supply line, does not grow, no upgrades (TOWER).
   */
  tower?: boolean;
  /** Kult: Runde der letzten Pluenderung (fehlt = nie gepluendert) / cult: round of the last plunder (missing = never plundered) */
  plundered?: number;
  /** Kult: wie oft diese Stadt schon gepluendert wurde (fehlt = nie) / cult: how often this city has been plundered (missing = never) */
  plunderCount?: number;
  /**
   * Eingebaute Produktionsstaetten ohne eigenes Feld (alte Spielstaende, Kampagne), zusaetzlich zu den Gebaeuden im Stadtgebiet
   * und der eingebauten Kaserne des Hauptquartiers (PRODUCTION.builtIn). Gehen mit der Stadt an den Eroberer.
   * Built-in production sites without a tile of their own (old saves, campaign), in addition to the buildings in the city
   * territory and the HQ's built-in barracks (PRODUCTION.builtIn). Pass to the conqueror with the city.
   */
  works?: ProductionSiteId[];
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
  /** Geordneter Rueckzug wieder moeglich ab dieser Runde / orderly retreat available again from this round */
  retreatReady?: number;
  /** Kult: Rekrutieren wieder moeglich ab dieser Runde / cult: recruiting available again from this round */
  recruitReady?: number;
  /** Verbleibende Raketen (Mech; fehlt = voll) / rockets left (mech; missing = full) */
  rockets?: number;
  /**
   * Fortschritt eines Wunders: Phase (Index in WONDERS.phases) und Runden in der Phase.
   * Progress of a wonder: phase (index into WONDERS.phases) and rounds within the phase.
   */
  wonder?: { stage: number; progress: number };
  /** Erdkernbohrer: Runden in Folge ohne Bewegung / earth-core drill: consecutive rounds without moving */
  stillRounds?: number;
  /** Maertyrer-Segen (Alvenia): gesegnet bis einschliesslich dieser Runde (fehlt = nie) / Martyr's Blessing (Alvenia): blessed until and including this round (missing = never) */
  blessed?: number;
  /** Endgegner: Runden, ab denen Schrei und Brut wieder bereit sind / boss: rounds from which scream and brood are ready again */
  boss?: { scream: number; brood: number; hp?: number };
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
  /**
   * Suendenzeichen (SIN): letzte Tat und letzte Runde des Zeichens (inklusive); fehlt = nie gezeichnet (auch alte Spielstaende).
   * Sinner mark (SIN): last deed and last round of the mark (inclusive); missing = never marked (old saves too).
   */
  sin?: { deed: SinDeed; until: number };
  /** Alvenia, Grosses Strafgericht: vernichtete Einheiten von Suendern (fehlt = 0) / Great Judgement: destroyed units of sinners (missing = 0) */
  judged?: number;
  /** Kult: insgesamt erbeutete Sterne (Punkte) / cult: total plundered stars (points) */
  plunder?: number;
  /** Orbitallaser (Velkar): bereit ab dieser Runde (fehlt = kein Relay gebaut) / orbital laser (Velkar): ready from this round (missing = no relay built) */
  orbitalReady?: number;
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
  /** Zufallsereignisse an (Einrichtung: Standard an) / random events on (setup: default on) */
  events?: boolean;
  /** Trefferglueck an (fehlt = an) / hit luck on (missing = on) */
  hitChance?: boolean;
  /** Fraktions-Siegbedingungen an (fehlt = an; in Kampagnen immer aus) / faction victory conditions on (missing = on; always off in campaigns) */
  factionVictory?: boolean;
  /** Kampagnenmission / campaign mission */
  campaign?: { mission: string };
  /** Anteil neutraler Siedlungen (fehlt = 1, freie Partien); Kampagne siehe CAMPAIGN_SETTLEMENTS / share of neutral settlements (missing = 1, free games); campaign see CAMPAIGN_SETTLEMENTS */
  settlements?: number;
  /**
   * Kartenthema (fehlt = Oberflaeche); 'alien' = Heimatwelt der Zyrr (nur Darstellung); 'desert' = rote Wuestenwelt der Vergessenen
   * (Darstellung, Kartenerzeugung ohne Meer und Sandsturm-Wetter).
   * Map theme (missing = surface); 'alien' = Zyrr homeworld (render only); 'desert' = red desert world of the Forgotten
   * (render, map generation without sea and dust-storm weather).
   */
  theme?: 'cavern' | 'alien' | 'desert';
}

/** Stand eines Missionsziels / state of a mission objective */
export type ObjectiveStatus = 'pending' | 'done' | 'failed';

/** Kampagnenstand im Spielstand / campaign state inside the game state */
export interface CampaignState {
  mission: string;
  /** Zielfelder, von der Einrichtung festgelegt / target tiles set by the setup */
  targets: Pos[];
  /** Status der Hauptziele / status of the primary objectives */
  status: ObjectiveStatus[];
  /** Status der Bonusziele / status of the bonus objectives */
  bonus: ObjectiveStatus[];
  /** Staedte des Spielers nach der Einrichtung / player cities after the setup */
  startCities: number[];
  result: 'won' | 'lost' | null;
  /** 0-3 Sterne / 0-3 stars */
  stars: number;
  /** Stand der Missionsdaten (fehlt = alte Kampagne vor der Menschen-Kampagne) / revision of the mission data (missing = old campaign) */
  rev?: number;
  /** Zieleinheiten (IDs), von der Einrichtung markiert / target units (ids) marked by the setup */
  units?: number[];
  /** Ankunftspunkte der Wellen / arrival points of the waves */
  spawns?: Pos[];
  /** Anzahl bereits eingetroffener Wellen / number of waves that already arrived */
  waves?: number;
  /** verbuendete Fraktionen des Spielers (Indizes) / allied factions of the player (indices) */
  allies?: number[];
  /** Artefakt der Uralten (Finale) / artifact of the ancients (finale) */
  artifact?: Pos;
  /** wer das Artefakt wie viele Runden in Folge besetzt / who occupies the artifact for how many consecutive rounds */
  hold?: { faction: number | null; n: number };
  /** Dimensionsportal der Zyrr (Modell auf dem Feld) / dimensional portal of the Zyrr (model on the tile) */
  portal?: Pos;
  /** Runden in Folge, die der Spieler das Portal besetzt / consecutive rounds the player occupies the portal */
  portalHold?: number;
  /**
   * Landetrupp: der Spieler startet ohne Stadt und scheidet erst aus, wenn er keine Einheit mehr hat; endet mit der ersten eigenen Stadt.
   * Landing party: the player starts without a city and is only eliminated once no unit is left; ends with the first own city.
   */
  landing?: boolean;
  /** Endgegner aufgetaucht (Runde) / boss emerged (round) */
  bossRound?: number;
  /**
   * Riss (m11): aufgerissen an dieser Stelle in dieser Runde; die Mission ist damit gewonnen.
   * Rift (m11): torn open at this spot in this round; the mission is won with it.
   */
  rift?: Pos & { round: number };
  /** Ruinenstaetten der Vergessenen (m13) / ruin sites of the Forgotten (m13) */
  sites?: Pos[];
  /** je Staette: vom Spieler entziffert / per site: deciphered by the player */
  siteDone?: boolean[];
  /** Hoehleneingang (m14) / cave entrance (m14) */
  cave?: Pos;
  /** Runden in Folge, die der Spieler den Hoehleneingang besetzt / consecutive rounds the player occupies the cave entrance */
  caveHold?: number;
  /** Runden in Folge, die der Spieler (mit Verbuendeten) alle Sendetuerme besitzt / consecutive rounds the player (with allies) owns all transmitter towers */
  towerHold?: number;
  /** Mutterschiff der Zyrr (m2): linke obere Ecke der 2x2 Felder / Zyrr mothership (m2): top-left corner of the 2x2 tiles */
  ship?: Pos;
  /** Wissenschaftler (m2): Einheiten-ID / scientist (m2): unit id */
  scientist?: number;
  /** geleistete Arbeitsrunden am Mutterschiff (zusammengezaehlt) / work rounds done on the mothership (cumulative) */
  work?: number;
  /** Runde der letzten Arbeit (einmal je Runde) / round of the last work (once per round) */
  workRound?: number;
  /**
   * Wettlauf um die Probe (m2, alle gegen alle); scientist, work und workRound oben gelten fuer den Spieler.
   * Race for the sample (m2, free-for-all); scientist, work and workRound above are the player's.
   */
  race?: RaceState;
  /** Fanatiker-Tempel (m4): Ankerfeld oben links der 2x2-Flaeche / Fanatic temple (m4): top-left anchor tile of the 2x2 footprint */
  temple?: Pos;
  /** Kriegsplaene (m4) / war plans (m4) */
  plans?: PlansState;
}

/**
 * Wettlauf am Mutterschiff (m2): Waffenruhe bis zur ersten Arbeit (truce), wer sie gebrochen hat (opener, round), die
 * Forscher der KI-Fraktionen (rivals: Einheit, Arbeit, letzte Arbeitsrunde; unit null = noch nicht erschienen oder gefallen,
 * fallen = gefallen), die Fraktion ohne Basis (swarm, die Zyrr) und wer die Probe zuerst genommen hat (winner).
 * Race at the mothership (m2): truce until the first work, who broke it (opener, round), the AI factions' researchers
 * (rivals: unit, work, last work round; unit null = not yet arrived or fallen, fallen = fallen), the faction without a base
 * (swarm, the Zyrr) and who took the sample first (winner).
 */
export interface RaceState {
  truce: boolean;
  opener: number | null;
  round: number | null;
  swarm: number;
  rivals: { faction: number; unit: number | null; work: number; round: number | null; fallen: boolean }[];
  winner: number | null;
}

/**
 * Kriegsplaene (m4): im Tempel, getragen (unit), fallen gelassen (x, y) oder abgeliefert. x, y = letzte bekannte Stelle.
 * drops = wie oft verloren (Tod oder Bekehrung des Traegers); taken = Runde des ersten Bergens; next = Runde der
 * naechsten Verfolgerwelle; pursuit = Anzahl bereits eingetroffener Verfolgerwellen; owner = Fraktion des Tempels.
 * War plans (m4): in the temple, carried (unit), dropped (x, y) or delivered. x, y = last known spot.
 * drops = how often lost (death or conversion of the carrier); taken = round of the first seizure; next = round of the
 * next pursuit wave; pursuit = number of pursuit waves that already arrived; owner = faction of the temple.
 */
export interface PlansState {
  at: 'temple' | 'carried' | 'dropped' | 'delivered';
  unit?: number;
  x?: number;
  y?: number;
  drops: number;
  taken?: number;
  next?: number;
  pursuit: number;
  owner: number;
}

/** Zufallsereignis-Art / random event kind */
export type RandomEventKind = 'storm' | 'epidemic' | 'rebels' | 'convoy' | 'defector' | 'luckyFind' | 'drought';

export interface GameState {
  version: 1;
  /**
   * Regelstand der Produktionsstaetten (1 = Einheiten aus Staetten, Forschung als Doktrinen); fehlt = alter Spielstand, den
   * migrateState angleicht.
   * Rules revision of the production sites (1 = units from sites, research as doctrines); missing = old save that
   * migrateState brings up to date.
   */
  sites?: number;
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
  /** Spielverlauf fuer die Statistik (fehlt in alten Spielstaenden) / game history for statistics (missing in old saves) */
  history?: import('./history').GameHistory;
  /** Kampagnenmission (nur in Kampagnenspielen) / campaign mission (campaign games only) */
  campaign?: CampaignState;
  /** laufende Duerren: Fraktion und letzte Runde / ongoing droughts: faction and last round */
  droughts?: { faction: number; until: number }[];
  /** Art des Sieges (fehlt in alten Spielstaenden) / kind of victory (missing in old saves) */
  victory?: Victory;
}

/** Siegart: Punkte, Eroberung oder Fraktions-Siegbedingung / victory kind: points, conquest or faction condition */
export interface Victory { kind: 'points' | 'conquest' | 'faction'; faction: FactionId }

/** Wunder-Ereignis: begonnen, Phase gewechselt, unterbrochen, zerstoert / wonder event: started, phase changed, interrupted, destroyed */
export type WonderEventKind = 'started' | 'phase' | 'interrupted' | 'destroyed';

export type GameEvent =
  | { t: 'move'; unit: number; path: Pos[] }
  | { t: 'attack'; unit: number; target: number; dmg: number; ret: number; splash?: { unit: number; dmg: number }[]; hit?: HitKind; retHit?: HitKind; retreat?: boolean; rocket?: boolean;
    /** Kamikaze-Drohne: der Angriff war die Explosion, die Drohne ist danach zerstoert / kamikaze drone: the attack was the explosion, the drone is destroyed afterwards */
    kamikaze?: boolean }
  | { t: 'killed'; unit: number; by: number | null; remains?: 'wreck' | 'skeleton' | null; x?: number; y?: number }
  /** plunder = vom Kult erbeutete Sterne (fehlt = keine Beute) / plunder = stars taken by the cult (missing = no loot) */
  | { t: 'capture'; city: number; faction: number; from: number | null; plunder?: number }
  | { t: 'outpostCapture'; x: number; y: number; faction: number }
  | { t: 'cityLevel'; city: number; level: number }
  | { t: 'reward'; city: number; choice: 'a' | 'b'; level: number }
  /**
   * twin (Meridon, TWIN_TRAINING): 'twin' = eine zweite Einheit folgt, 'second' = dies ist die zweite, 'limit'/'noRoom' = nur eine (Limit bzw. kein Feld)
   * twin (Meridon, TWIN_TRAINING): 'twin' = a second unit follows, 'second' = this is the second, 'limit'/'noRoom' = only one (limit or no tile)
   */
  | { t: 'train'; unit: number; city: number; twin?: 'twin' | 'second' | 'limit' | 'noRoom' }
  /** Kult: Einheit by ruft im Feld die Einheit unit / cult: unit by calls up unit in the field */
  | { t: 'recruit'; unit: number; by: number }
  | { t: 'build'; building: BuildingId | 'outpost' | GrandProjectId; x: number; y: number; faction: number }
  | { t: 'research'; tech: TechId; faction: number }
  | { t: 'heal'; unit: number; amount: number; repair?: boolean }
  | { t: 'convert'; unit: number; target: number }
  /**
   * Suendentat: Fraktion faction ist bis Runde until als Suender gezeichnet; fresh = vorher nicht gezeichnet (Meldung).
   * Sinful deed: faction faction is marked as a sinner until round until; fresh = not marked before (toast).
   */
  | { t: 'sin'; faction: number; deed: SinDeed; until: number; fresh: boolean }
  /**
   * Maertyrer-Segen: Einheit unit (gefallen, Besitzer faction) segnet die Nachbarn (heal = geheilte LP) bis Runde until.
   * Martyr's Blessing: unit unit (fallen, owner faction) blesses its neighbours (heal = HP healed) until round until.
   */
  | { t: 'blessing'; unit: number; faction: number; x: number; y: number; until: number; units: { unit: number; heal: number }[] }
  | { t: 'veteran'; unit: number }
  | { t: 'bunker'; x: number; y: number; reward: BunkerReward; faction: number }
  | { t: 'radar'; index: number; faction: number }
  | { t: 'contact'; a: number; b: number; stars: number }
  | { t: 'crash'; unit: number }
  /** Sold nicht bezahlt: die Einheit desertiert (vorher als 'killed' entfernt) / upkeep unpaid: the unit deserts (removed as 'killed' before) */
  | { t: 'deserted'; unit: number; unitType: UnitTypeId; faction: number; x: number; y: number }
  | { t: 'flak'; city: number; unit: number; dmg: number }
  | { t: 'barrier'; x: number; y: number; faction: number }
  | { t: 'cityUpgrade'; city: number; upgrade: CityUpgradeId; faction: number; target?: Pos }
  | { t: 'terraform'; x: number; y: number; faction: number; unit?: number }
  | { t: 'barrierHit'; unit: number; x: number; y: number }
  | { t: 'mine'; x: number; y: number; faction: number }
  | { t: 'mineHit'; unit: number; x: number; y: number; dmg: number; owner: number }
  | { t: 'aaFire'; unit: number; target: number; dmg: number }
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
  | { t: 'randomEvent'; kind: RandomEventKind; faction?: number; x?: number; y?: number; city?: number; unit?: number;
      stars?: number; tech?: TechId; other?: number; count?: number; contained?: boolean; ongoing?: boolean }
  | { t: 'objective'; index: number; bonus: boolean; status: ObjectiveStatus }
  /** Kampagne: Welle (Feind oder Verstaerkung) eingetroffen / campaign: wave (enemy or reinforcements) arrived */
  | { t: 'wave'; faction: number; count: number; x: number; y: number }
  /** Kampagne m2: der Wissenschaftler arbeitet am Mutterschiff (have von need Runden) / campaign m2: the scientist works on the mothership (have of need rounds) */
  | { t: 'shipWork'; unit: number; have: number; need: number; x: number; y: number; faction?: number }
  /** Kampagne m2: die Waffenruhe ist gebrochen, faction hat als Erste am Schiff gearbeitet / campaign m2: the truce is broken, faction worked at the ship first */
  | { t: 'truceBroken'; faction: number; round: number }
  | { t: 'wonder'; what: WonderEventKind; kind: WonderUnitId; unit: number; faction: number; x: number; y: number; stage?: number }
  /** Verdan-Verteidigungslinie erwacht (durch faction) / Verdan defence line wakes up (because of faction) */
  | { t: 'verdanActive'; faction: number }
  /** Verdan-Geschuetz feuert auf eine Einheit / Verdan gun fires at a unit */
  /** owner/victim nur bei Geschuetzstellungen: Besitzer und Fraktion des Ziels / owner/victim only for emplacements: owner and the target's faction */
  | { t: 'turretFire'; x: number; y: number; target: number; dmg: number; hit?: HitKind; owner?: number; victim?: number }
  /** Einheit greift ein Verdan-Geschuetz an / unit attacks a Verdan gun */
  | { t: 'turretHit'; unit: number; x: number; y: number; dmg: number; ret: number; hit?: HitKind; retHit?: HitKind; destroyed: boolean; owner?: number; kamikaze?: boolean }
  /** Geschuetzstellung gebaut / gun emplacement built */
  | { t: 'emplacement'; x: number; y: number; faction: number }
  /** Stellung geschleift: Gebiet verloren oder Fraktion ausgeschieden / emplacement razed: territory lost or faction eliminated */
  | { t: 'emplacementLost'; x: number; y: number; faction: number; reason: 'territory' | 'eliminated' }
  /**
   * Endgegner: aufgetaucht, Brut geschluepft (count), psychischer Schrei (hits) / boss: emerged, brood hatched (count), psychic scream (hits)
   */
  | { t: 'boss'; what: 'emerge' | 'brood' | 'scream'; unit: number; faction: number; x: number; y: number; count?: number; hits?: { unit: number; dmg: number }[] }
  /** Kampagne m11: der Riss reisst auf (an der Schwarmmutter) / campaign m11: the rift tears open (at the Swarm Mother) */
  | { t: 'rift'; unit: number; x: number; y: number }
  /** Schadenswetter zu Rundenbeginn (Meteorschauer, Saeureregen): getroffene Einheiten / damaging weather at round start (meteors, acid rain): units hit */
  | { t: 'weatherHit'; kind: 'meteor' | 'acid'; hits: { unit: number; dmg: number; x: number; y: number }[] }
  /**
   * Orbitallaser: Ziel (x, y), getroffene Flaeche, Treffer an Einheiten (unit) und Geschuetzen (turret), deterministisch.
   * Orbital laser: target (x, y), area hit, hits on units (unit) and guns (turret), deterministic.
   */
  | { t: 'orbitalStrike'; faction: number; x: number; y: number; tiles: Pos[]; hits: OrbitalHit[] }
  /** Kampagne m13: Ruinenstaette entziffert (index in CampaignState.sites) / campaign m13: ruin site deciphered */
  | { t: 'ruin'; index: number; x: number; y: number; faction: number }
  /**
   * Kampagne m4, Kriegsplaene: geborgen, aufgehoben, fallen gelassen, vom Kult zurueckgebracht, abgeliefert (x, y = Stelle).
   * Campaign m4, war plans: seized, picked up, dropped, taken back by the cult, delivered (x, y = spot).
   */
  | { t: 'plans'; what: 'seized' | 'picked' | 'dropped' | 'returned' | 'delivered'; faction: number; unit?: number; x: number; y: number }
  | { t: 'gameOver'; winner: number | null; victory?: Victory };

/** Treffer des Orbitallasers: Einheit oder Geschuetz auf (x, y) / hit of the orbital laser: unit or gun at (x, y) */
export interface OrbitalHit { unit?: number; turret?: boolean; x: number; y: number; dmg: number; killed: boolean }

export type DiplomacyAction = 'proposePeace' | 'acceptPeace' | 'declinePeace' | 'announceBreak' | 'embassy';

export type Command =
  | { type: 'move'; unit: number; to: Pos }
  | { type: 'attack'; unit: number; target: number }
  | { type: 'retreat'; unit: number; target: number }
  | { type: 'rocket'; unit: number; target: number }
  /** Verdan-Geschuetz auf (x, y) angreifen / attack the Verdan gun at (x, y) */
  | { type: 'attackTurret'; unit: number; x: number; y: number }
  | { type: 'heal'; unit: number }
  | { type: 'repair'; unit: number }
  | { type: 'medicHeal'; unit: number }
  | { type: 'convert'; unit: number; target: number }
  | { type: 'capture'; unit: number }
  /** Kampagne: neutrale Siedlung ueberzeugen (Alvenia, Meridon) / campaign: persuade a neutral settlement (Alvenia, Meridon) */
  | { type: 'persuade'; unit: number; city: number }
  | { type: 'train'; city: number; unitType: UnitTypeId }
  | { type: 'build'; building: BuildingId; x: number; y: number }
  | { type: 'grandProject'; id: GrandProjectId; x: number; y: number }
  | { type: 'outpost'; unit: number }
  | { type: 'barrier'; unit: number; x: number; y: number }
  | { type: 'mine'; unit: number; x: number; y: number }
  /** Geschuetzstellung bauen (Festungsbau, Dravon) / build a gun emplacement (fortification, Dravon) */
  | { type: 'emplacement'; unit: number; x: number; y: number }
  | { type: 'cityUpgrade'; city: number; upgrade: CityUpgradeId; target?: Pos }
  | { type: 'terraform'; x: number; y: number; unit?: number }
  | { type: 'recruit'; unit: number; unitType: UnitTypeId; x: number; y: number }
  | { type: 'upgrade'; unit: number; to: UnitTypeId }
  | { type: 'research'; tech: TechId }
  /** Wunder bauen (den Bohrer ruft ein Prophet per 'recruit') / build a wonder (a prophet calls up the drill via 'recruit') */
  | { type: 'wonder'; kind: WonderKind; x: number; y: number }
  | { type: 'reward'; city: number; choice: 'a' | 'b' }
  | { type: 'diplomacy'; action: DiplomacyAction; target: number }
  /** Orbitallaser auf die Flaeche mit der linken oberen Ecke (x, y) / orbital laser on the area with top-left corner (x, y) */
  | { type: 'orbitalStrike'; x: number; y: number }
  /** Kampagne m2: der Wissenschaftler arbeitet am Mutterschiff (beendet seinen Zug) / campaign m2: the scientist works on the mothership (ends its turn) */
  | { type: 'workShip'; unit: number }
  /** Kampagne m4: Kriegsplaene am Tempel bergen oder fallen gelassene aufheben / campaign m4: seize the war plans at the temple or pick up dropped ones */
  | { type: 'seizePlans'; unit: number }
  | { type: 'endTurn' };

export type ErrorCode =
  | 'gameOver' | 'notYourUnit' | 'noUnit' | 'unitExhausted' | 'unreachable' | 'outOfRange' | 'invalidTarget'
  | 'peace' | 'cannotAttack' | 'alreadyMoved' | 'alreadyAttacked' | 'notEnoughStars' | 'techMissing'
  | 'invalidTile' | 'occupied' | 'unitLimit' | 'notYourCity' | 'alreadyResearched' | 'parentMissing'
  | 'cannotCapture' | 'pendingReward' | 'noReward' | 'onePerCity' | 'notInTerritory' | 'alreadyBuilt'
  | 'notUnlocked' | 'noContact' | 'invalid' | 'fresh' | 'noResearch' | 'notTerraformed' | 'wrongFaction'
  | 'notPreacher' | 'recruitCooldown' | 'computeMissing' | 'cultRecruit' | 'cityLevel' | 'cannotRetreat' | 'retreatCooldown' | 'noRetreatTile' | 'cannotRepair' | 'noWreck' | 'noXenoGround' | 'noRockets'
  | 'enemyTerritory' | 'cannotBuild' | 'quake' | 'emplacementLimit' | 'emplacementSpacing'
  // Orbitallaser / orbital laser
  | 'noRelay' | 'orbitalCooldown' | 'notVisible' | 'relayLimit'
  // Kriegsplaene (m4) / war plans (m4)
  | 'cannotCarry'
  // Produktionsstaette fehlt (Ausbilden) oder Voraussetzung fehlt (Bauen) / production site missing (training) or prerequisite missing (building)
  | 'buildingMissing';

export interface CommandResult {
  ok: boolean;
  error?: ErrorCode;
  events: GameEvent[];
}
