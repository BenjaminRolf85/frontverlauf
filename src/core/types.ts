import type {
  BaseKind, BiomeId, BuildingId, CityUpgradeId, Difficulty, ProductionSiteId, FactionId, GameMode, GrandProjectId, MapSize, MapType, ResourceId, TechId, TerrainId,
  UnitTypeId, BunkerReward, HitKind, WonderKind, WonderUnitId, SinDeed, AcademyModule,
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
  /**
   * Schlachtfeld (optisch): Kampfintensitaet v (WAR_MARKS.scar) und Runde r des letzten Kampfes; fehlt = unberuehrt
   * (auch in alten Spielstaenden). Battlefield (visual): fighting intensity v and round r of the last fight; missing = untouched.
   */
  scar?: { v: number; r: number };
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
  turret?: { hp: number; active: boolean; owner?: number;
    /**
     * Art des Bauwerks: fehlt = Geschuetz (Verdan oder Stellung); 'silo' = Raketensilo (Meridon, SILO), feuert nie von selbst;
     * ready = Runde, ab der das Silo wieder starten kann; bought = Runde des letzten Kaufs (SILO.units, einer je Zug).
     * Kind of structure: missing = gun (Verdan or emplacement); 'silo' = rocket silo (Meridon, SILO), never fires on its own;
     * ready = round from which the silo can launch again; bought = round of the last purchase (SILO.units, one per turn).
     * 'hack' = Hackturm (NEXUS, HACK.tower), feuert nie; ready = Runde, ab der er wieder uebernehmen kann; link = ID der
     * gerade uebernommenen Einheit (fehlt = keine).
     * 'hack' = hack tower (NEXUS, HACK.tower), never fires; ready = round from which it can take over again; link = id of
     * the unit currently taken over (missing = none).
     */
    kind?: 'silo' | 'hack'; ready?: number; bought?: number; link?: number } | null;
  /**
   * Brand nach einem Raketeneinschlag (SILO): brennt bis einschliesslich Runde until; owner = Fraktion des Silos (Abschuesse).
   * Fehlt = brennt nicht (auch alte Spielstaende).
   * Fire after a rocket impact (SILO): burns until and including round until; owner = faction of the silo (kills).
   * Missing = not burning (old saves too).
   */
  fire?: { until: number; owner: number } | null;
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
  /** Runde, in der zuletzt eine Stufe mit Sternen gekauft wurde (fehlt = nie) / round in which a level was last bought with stars (missing = never) */
  levelBought?: number;
  /**
   * Sendeturm der Kampagne: bildet aus wie eine Nachschublinie, waechst nicht, keine Ausbauten (TOWER).
   * Campaign transmitter tower: trains like a supply line, does not grow, no upgrades (TOWER).
   */
  tower?: boolean;
  /**
   * Stuetzpunkt: Art des Orts mit eigener Eigenschaft (BASES); bleibt beim Besitzwechsel. Fehlt = gewoehnliche Stadt
   * (Hauptquartiere, andere Welten, Kampagne, Sendetuerme dort, alte Spielstaende).
   * Base: kind of the place with its own property (BASES); stays when the owner changes. Missing = ordinary city
   * (headquarters, other worlds, campaign, transmitter towers there, old saves).
   */
  base?: BaseKind;
  /** Kult: Runde der letzten Pluenderung (fehlt = nie gepluendert) / cult: round of the last plunder (missing = never plundered) */
  plundered?: number;
  /**
   * Stadt-Hack der NEXUS (HACK.city): Fraktion by sieht die Stadt bis einschliesslich Runde until; fehlt = nie (auch alte Spielstaende).
   * NEXUS city hack (HACK.city): faction by sees the city until and including round until; missing = never (old saves too).
   */
  hacked?: { by: number; until: number };
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
  /**
   * Schwebende Akademie (Velkar, ACADEMY): Hauptstadt, die abheben, fliegen und landen kann; fehlt = gewoehnliche Stadt
   * (Kampagne, alte Spielstaende). Geht beim Verlust der Stadt verloren (ein Posten wird zur neuen Akademie).
   * Floating academy (Velkar, ACADEMY): capital that can lift off, fly and land; missing = ordinary city (campaign, old
   * saves). Is lost with the city (a post becomes the new academy).
   */
  academy?: boolean;
  /** Forschungsposten (Velkar): ein Feld, Sterne und Sicht, keine Produktion / research post (Velkar): one tile, stars and vision, no production */
  post?: boolean;
  /**
   * Akademie in der Luft: lifting = hebt ab (zieht ab dem naechsten eigenen Zug), flying = schwebt; steps = Felder, die in
   * diesem Zug noch gehen. Fehlt = am Boden.
   * Academy in the air: lifting = lifting off (moves from the next own turn), flying = floating; steps = tiles left this
   * turn. Missing = on the ground.
   * terraform = formt das Feld fuer die Landung um (ACADEMY.terraform): schwebt weiter, zieht nicht; left = eigene Zugbeginne
   * bis zur Landung (fehlt = 1). terraform = reshapes the tile for landing (ACADEMY.terraform): keeps floating, does not move;
   * left = own turn starts until the landing (missing = 1). at = Landeziel, wenn es ein benachbarter neutraler Ort ist
   * (fehlt = das eigene Feld) / at = landing target when it is an adjacent neutral place (missing = the own tile).
   */
  air?: { phase: 'lifting' | 'flying' | 'terraform'; steps: number; left?: number; at?: Pos };
  /** Produktion ruht bis vor diese Runde (Landung, Notlandung) / production rests until before this round (landing, emergency landing) */
  calm?: number;
  /** Schutzschild der Akademie (LP); fehlt = keiner / the academy's shield (HP); missing = none */
  shield?: { hp: number; max: number };
  /** Schild wieder baubar ab dieser Runde (nach der Zerstoerung) / shield buildable again from this round (after its destruction) */
  shieldReady?: number;
  /** Ausbildungen in dieser Runde (Akademie: mehrere je Zug) / trainings this round (academy: several per turn) */
  trained?: { round: number; n: number };
  /** Beamer-Relay auf dem Forschungsposten (ACADEMY.beamer) / beam relay on the research post (ACADEMY.beamer) */
  relay?: boolean;
  /** Runde des letzten Beamvorgangs zu diesem Relay (einer je Runde) / round of the last beam to this relay (one per round) */
  beamed?: number;
  /**
   * Ausbau der Akademie (ACADEMY.modules): gekaufte Stufe je Modul (fehlt = 0; Neutronenstrahl Stufe 1 ist eingebaut);
   * moduleRound = Runde des letzten Kaufs je Modul (eine Stufe je Zug).
   * Academy upgrades (ACADEMY.modules): bought level per module (missing = 0; neutron beam level 1 is built in);
   * moduleRound = round of the last purchase per module (one level per turn).
   */
  mods?: Partial<Record<AcademyModule, number>>;
  moduleRound?: Partial<Record<AcademyModule, number>>;
  /** Rumpf der gepanzerten Akademie (ACADEMY.modules.armour) / hull of the armoured academy */
  hull?: { hp: number; max: number };
  /** Abfaenge der Abwehrraketen seit dem letzten eigenen Zugbeginn / interceptions of the defence missiles since the last own turn start */
  pdUsed?: number;
  /** Neutronenstrahl: Schuesse in dieser Runde (ACADEMY.beam) / neutron beam: shots this round (ACADEMY.beam) */
  ray?: { round: number; n: number };
  /** Neutronenstrahl wieder bereit ab dieser Runde (ACADEMY.beam.cooldown) / neutron beam ready again from this round */
  rayReady?: number;
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
  /**
   * Berserker (TWIN_STRIKE): Hiebe in diesem Zug (fehlt = keiner); zu Beginn des eigenen Zuges geloescht.
   * Berserker (TWIN_STRIKE): blows struck this turn (missing = none); cleared at the start of the own turn.
   */
  strikes?: number;
  /**
   * Goettlicher Funke (SPARK): wieder schussbereit ab dieser Runde (fehlt = bereit).
   * Divine Spark (SPARK): ready to fire again from this round (missing = ready).
   */
  sparkReady?: number;
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
  /**
   * Ausrichtung 0-7 (0 = Norden, im Uhrzeigersinn, siehe core/facing.ts): Richtung des letzten Schritts, beim Angriff zum
   * Ziel, beim Gegenschlag zum Angreifer. Fehlt = unbekannt (alte Spielstaende, Bauwerke): nie von hinten angreifbar.
   * Facing 0-7 (0 = north, clockwise, see core/facing.ts): direction of the last step, on attack towards the target, on
   * return fire towards the attacker. Missing = unknown (old saves, structures): never attackable from behind.
   */
  facing?: number;
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
  /**
   * Verschanzt (ENTRENCH, Korvat): am Ende des eigenen Zuges gesetzt, wenn die Einheit in diesem Zug nicht gezogen ist;
   * faellt mit der naechsten Bewegung (fehlt = nein).
   * Entrenched (ENTRENCH, Korvat): set at the end of the own turn if the unit did not move during that turn; falls with
   * the next move (missing = no).
   */
  entrenched?: boolean;
  /**
   * Absetzen (WITHDRAW, Meridon): nach dem eigenen Angriff ohne vorherige Bewegung darf die Einheit noch zurueckweichen
   * (fehlt = nein). Faellt mit der Bewegung und zu Beginn des naechsten eigenen Zuges.
   * Withdraw (WITHDRAW, Meridon): after its own attack without a prior move the unit may still fall back (missing = no).
   * Falls with the move and at the start of the next own turn.
   */
  withdraw?: boolean;
  /** Sabotage wieder moeglich ab dieser Runde (fehlt = sofort) / sabotage possible again from this round (missing = now) */
  sabotageReady?: number;
  /** Radarimpuls wieder moeglich ab dieser Runde (fehlt = sofort) / radar sweep possible again from this round (missing = now) */
  sweepReady?: number;
  /**
   * Vom Hackturm uebernommen (HACK.tower): owner ist waehrenddessen die hackende Fraktion; from = eigentlicher Besitzer,
   * until = letzte Runde unter fremder Steuerung (Rueckgabe am Ende dieses Zuges der hackenden Fraktion), (x, y) = Turm.
   * Fehlt = nicht uebernommen (auch alte Spielstaende).
   * Taken over by a hack tower (HACK.tower): owner is the hacking faction meanwhile; from = actual owner, until = last
   * round under foreign control (returned at the end of the hacking faction's turn in that round), (x, y) = tower.
   * Missing = not taken over (old saves too).
   */
  hijack?: { from: number; until: number; x: number; y: number };
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
  /**
   * Korruption (CORRUPTION): Runden der letzten Faelle im Fenster; fehlt = keine (auch alte Spielstaende).
   * Corruption (CORRUPTION): rounds of the last hits within the window; missing = none (old saves too).
   */
  corruptionHits?: number[];
  /** Kult: insgesamt erbeutete Sterne (Punkte) / cult: total plundered stars (points) */
  plunder?: number;
  /** Orbitallaser (Velkar): bereit ab dieser Runde (fehlt = kein Relay gebaut) / orbital laser (Velkar): ready from this round (missing = no relay built) */
  orbitalReady?: number;
  /**
   * Sichtungen (SIGHTING: Aufklaerungsdrohne, Funkturm): im Umkreis r um (x, y) sieht die Fraktion bis einschliesslich Runde
   * until alle feindlichen Einheiten (fehlt = keine, auch alte Spielstaende).
   * Sightings (SIGHTING: recon drone, radio tower): within radius r of (x, y) the faction sees all hostile units until and
   * including round until (missing = none, old saves too).
   * Radarimpuls (RADAR): unit = Radarwagen, (x, y) folgt ihm; faellt er, endet der Impuls.
   * Radar sweep (RADAR): unit = Radar Truck, (x, y) follows it; if it falls, the sweep ends.
   */
  sightings?: { x: number; y: number; r: number; until: number; unit?: number }[];
  /**
   * Fernuebernahmen neutraler Orte (HACK.place): Runde jedes Hacks; fehlt = keiner (auch alte Spielstaende).
   * Remote takeovers of neutral places (HACK.place): round of every hack; missing = none (old saves too).
   */
  hacks?: number[];
  /** Stadt-Hack wieder moeglich ab dieser Runde (HACK.city; fehlt = sofort) / city hack possible again from this round (HACK.city; missing = now) */
  cityHackReady?: number;
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
  /**
   * Sendetuerme in freien Partien (fehlt = an; Anzahl nach Kartengroesse, TOWER); das Tutorial schaltet sie ab, die Kampagne
   * setzt ihre eigenen (MissionDef.towers). Mit Stuetzpunkten (bases) stehen an denselben Feldern Stuetzpunkte statt der
   * Tuerme; false laesst auch diese Orte weg.
   * Transmitter towers in free games (missing = on; count by map size, TOWER); the tutorial turns them off, the campaign
   * places its own (MissionDef.towers). With bases the same tiles carry bases instead of the towers; false leaves out
   * these places too.
   */
  towers?: boolean;
  /**
   * Stuetzpunkte statt neutraler Siedlungen (fehlt = an in freien Partien der Standardwelt, sonst aus; BASES). Das Tutorial
   * schaltet sie ab. Wirkt nur beim Anlegen der Partie: die Art steht danach an jedem Ort (City.base).
   * Bases instead of neutral villages (missing = on in free games on the default world, otherwise off; BASES). The tutorial
   * turns them off. Only matters when the game is created: afterwards the kind is stored on every place (City.base).
   */
  bases?: boolean;
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
  /**
   * Gebeamte Einheiten unterwegs (Velkar, ACADEMY.beamer): erscheinen zu Beginn des naechsten Zuges ihrer Fraktion am Relay
   * (relay = Posten), sonst an der Akademie. Fehlt = keine (auch alte Spielstaende).
   * Beamed units in transit (Velkar, ACADEMY.beamer): appear at the start of their faction's next turn at the relay
   * (relay = post), otherwise at the academy. Missing = none (old saves too).
   */
  transit?: { unit: Unit; relay: number; round: number }[];
  /**
   * Von der Akademie eingeebnete neutrale Orte (ACADEMY.terraform): nur fuer die Namensvergabe, damit die uebrigen Orte
   * ihre Namen behalten. Fehlt = keine (auch alte Spielstaende).
   * Neutral places levelled by the academy (ACADEMY.terraform): only for naming, so the remaining places keep their names.
   * Missing = none (old saves too).
   */
  razed?: City[];
}

/** Siegart: Punkte, Eroberung oder Fraktions-Siegbedingung / victory kind: points, conquest or faction condition */
export interface Victory { kind: 'points' | 'conquest' | 'faction'; faction: FactionId }

/** Wunder-Ereignis: begonnen, Phase gewechselt, unterbrochen, zerstoert / wonder event: started, phase changed, interrupted, destroyed */
export type WonderEventKind = 'started' | 'phase' | 'interrupted' | 'destroyed';

export type GameEvent =
  | { t: 'move'; unit: number; path: Pos[] }
  | { t: 'attack'; unit: number; target: number; dmg: number; ret: number; splash?: { unit: number; dmg: number }[]; hit?: HitKind; retHit?: HitKind; retreat?: boolean; rocket?: boolean; intercepted?: boolean;
    /** Kamikaze-Drohne: der Angriff war die Explosion, die Drohne ist danach zerstoert / kamikaze drone: the attack was the explosion, the drone is destroyed afterwards */
    kamikaze?: boolean;
    /**
     * Berserker: Nummer des Hiebs in diesem Zug (1 oder 2, TWIN_STRIKE) bzw. Selbstsprengung (detonate, der Berserker ist
     * danach tot, kein Gegenschlag) / berserker: number of the blow this turn (1 or 2, TWIN_STRIKE) or self-detonation
     * (detonate, the berserker is dead afterwards, no return fire)
     */
    strike?: number; detonate?: boolean }
  | { t: 'killed'; unit: number; by: number | null; remains?: 'wreck' | 'skeleton' | null; x?: number; y?: number }
  /** plunder = vom Kult erbeutete Sterne (fehlt = keine Beute) / plunder = stars taken by the cult (missing = no loot) */
  | { t: 'capture'; city: number; faction: number; from: number | null; plunder?: number;
    /** per Fernuebernahme gehackt (HACK.place) / hacked by remote takeover (HACK.place) */
    hack?: boolean }
  | { t: 'outpostCapture'; x: number; y: number; faction: number }
  | { t: 'cityLevel'; city: number; level: number; bought?: true }
  | { t: 'reward'; city: number; choice: 'a' | 'b'; level: number }
  | { t: 'train'; unit: number; city: number }
  /** Raketensilo (x, y) hat eine Einheit gebaut; city = Heimatstadt / rocket silo (x, y) built a unit; city = home city */
  | { t: 'siloBuy'; unit: number; x: number; y: number; city: number | null; faction: number }
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
  /** Korruption (Meridon): Sterne abgezweigt / corruption (Meridon): stars siphoned off */
  | { t: 'corruption'; faction: number; stars: number }
  | { t: 'flak'; city: number; unit: number; dmg: number }
  | { t: 'barrier'; x: number; y: number; faction: number }
  | { t: 'cityUpgrade'; city: number; upgrade: CityUpgradeId; faction: number; target?: Pos }
  | { t: 'terraform'; x: number; y: number; faction: number; unit?: number }
  | { t: 'barrierHit'; unit: number; x: number; y: number }
  | { t: 'mine'; x: number; y: number; faction: number }
  | { t: 'mineHit'; unit: number; x: number; y: number; dmg: number; owner: number }
  | { t: 'aaFire'; unit: number; target: number; dmg: number }
  | { t: 'uprising'; city: number; faction: number; spawned: number }
  // boat: leeres Schiff, auf das die Einheit stieg (danach entfernt) / boat: empty ship the unit boarded (removed afterwards)
  | { t: 'embark'; unit: number; boat?: number }
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
  | { t: 'emplacement'; x: number; y: number; faction: number; kind?: 'silo' | 'hack' }
  /**
   * Hackturm (x, y) uebernimmt die Einheit unit von from bis Runde until / hack tower (x, y) takes over unit from from until round until
   */
  | { t: 'hijack'; unit: number; faction: number; from: number; x: number; y: number; until: number }
  /** Stadt-Hack (HACK.city): faction sieht die Stadt city von victim bis Runde until / city hack: faction sees victim's city until round until */
  | { t: 'cityHack'; city: number; faction: number; victim: number; until: number; x: number; y: number }
  /**
   * Uebernahme beendet: zurueck an faction (time = Zeit um, tower = Turm gefallen, eliminated = Hacker ausgeschieden);
   * lost = der Besitzer ist ausgeschieden, die Einheit zerfaellt.
   * Takeover ended: back to faction (time = time is up, tower = tower fell, eliminated = hacker eliminated); lost = the owner
   * is eliminated, the unit falls apart.
   */
  | { t: 'hijackEnd'; unit: number; faction: number; by: number; reason: 'time' | 'tower' | 'eliminated'; lost?: boolean;
    /**
     * Ausgang am regulaeren Ende (HACK.tower): kept = bleibt dauerhaft bei by, shutdown = abgeschaltet (zerstoert, Wrack);
     * fehlt = zurueckgegeben. x, y = Feld der Einheit (fuer den Effekt nach dem Abschalten).
     * Outcome at the regular end (HACK.tower): kept = stays with by for good, shutdown = switched off (destroyed, wreck);
     * missing = returned. x, y = the unit's tile (for the effect after the shutdown).
     */
    outcome?: 'kept' | 'shutdown'; x?: number; y?: number; unitType?: UnitTypeId }
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
  /**
   * Schattenflotte (Meridon): Sabotage (what = zerstoerte Sache, victim = Fraktion), Radarimpuls, Raketenstart (from = Silo,
   * x, y = linke obere Ecke der Flaeche), Brandschaden zu Rundenbeginn.
   * Shadow fleet (Meridon): sabotage (what = destroyed thing, victim = faction), radar sweep, rocket launch (from = silo,
   * x, y = top-left corner of the area), fire damage at the start of the round.
   */
  | { t: 'sabotage'; unit: number; x: number; y: number; what: 'outpost' | 'building' | 'road'; building?: BuildingId; faction: number; victim: number }
  | { t: 'radarSweep'; unit: number; x: number; y: number; radius: number; until: number; faction: number }
  | { t: 'siloLaunch'; faction: number; from: Pos; x: number; y: number; tiles: Pos[]; hits: OrbitalHit[]; intercepted?: boolean }
  /**
   * Goettlicher Funke (SPARK): Schuss des Geschuetzes unit von from auf die Flaeche (Ecke x, y); jeder Treffer mit eigenem
   * Trefferglueck (hit) / Divine Spark (SPARK): shot of the gun unit from from onto the area (corner x, y); every hit with its
   * own hit luck (hit)
   */
  | { t: 'divineSpark'; unit: number; faction: number; from: Pos; x: number; y: number; tiles: Pos[]; hits: (OrbitalHit & { hit?: HitKind })[] }
  | { t: 'fireHit'; hits: { unit: number; dmg: number; x: number; y: number }[] }
  /**
   * Schwebende Akademie: abgehoben, schwebt, gezogen (from -> x, y), gelandet, notgelandet (by = Angreifer), verlegt (neue
   * Akademie nach dem Verlust der alten).
   * Floating academy: lifted, floating, moved (from -> x, y), landed, emergency landing (by = attacker), moved over (new
   * academy after losing the old one).
   */
  /**
   * terraform = Terraformen begonnen, cancel = abgebrochen (schwebt weiter), abort = Landung zu Zugbeginn nicht mehr
   * moeglich (schwebt weiter). Bei land: terrain = Gelaende vorher (fehlt = unveraendert Ebene), razed = eingeebneter neutraler
   * Ort (Art), resource = aufgenommener Rohstoff, cleared = eingeebnetes Bauwerk oder Merkmal, biome = Landschaft vorher.
   * terraform = terraforming started, cancel = cancelled (keeps floating), abort = landing no longer possible at turn start
   * (keeps floating). With land: terrain = terrain before (missing = unchanged plain), razed = levelled neutral place
   * (kind), resource = absorbed resource, cleared = levelled structure or feature, biome = biome before.
   */
  | { t: 'academy'; what: 'lift' | 'float' | 'move' | 'land' | 'forced' | 'transfer' | 'terraform' | 'cancel' | 'abort'; city: number; faction: number; x: number; y: number; from?: Pos; by?: number;
      terrain?: TerrainId; biome?: BiomeId; razed?: 'village' | 'base' | 'tower'; resource?: ResourceId; cleared?: string }
  /** Schutzschild der Akademie: gebaut, getroffen (dmg, unit = Angreifer), zerstoert, aufgeladen / academy shield: built, hit, destroyed, recharged */
  | { t: 'shield'; what: 'built' | 'hit' | 'down' | 'regen'; city: number; faction: number; hp: number; dmg?: number; unit?: number; hit?: HitKind }
  /**
   * Beamer: Einheit gebeamt (depart, x, y = Abflug, city = Relay), angekommen (arrive), zur Akademie zurueckgekehrt (return,
   * Relay verloren oder kein Platz), Relay gebaut (built).
   * Beamer: unit beamed (depart, x, y = departure, city = relay), arrived (arrive), returned to the academy (return, relay
   * lost or no room), relay built (built).
   */
  | { t: 'beam'; what: 'built' | 'depart' | 'arrive' | 'return'; city: number; faction: number; x: number; y: number; unit?: number; unitType?: UnitTypeId }
  /**
   * Neutronenstrahl der Akademie city auf (x, y): Einheit (unit) oder Bauwerk (turret); dmg, Trefferart, killed = vernichtet.
   * Neutron beam of academy city at (x, y): unit (unit) or structure (turret); dmg, hit kind, killed = destroyed.
   */
  | { t: 'neutron'; city: number; faction: number; from: Pos; x: number; y: number; dmg: number; killed: boolean; unit?: number; turret?: boolean; hit?: HitKind; victim?: number }
  /** Rumpf der gepanzerten Akademie: getroffen, zerstoert (0 LP), aufgeladen / hull of the armoured academy: hit, down (0 HP), recharged */
  | { t: 'hull'; what: 'hit' | 'down' | 'regen'; city: number; faction: number; hp: number; dmg?: number; unit?: number; hit?: HitKind }
  /** Abwehrraketen der Akademie fangen einen Angriff ab (unit = Angreifer, silo = Rakete) / defence missiles intercept an attack */
  | { t: 'intercept'; city: number; faction: number; x: number; y: number; from: Pos; unit?: number; silo?: boolean; left: number }
  /** Modul der Akademie gekauft (Stufe level) / academy module bought (level) */
  | { t: 'module'; city: number; faction: number; module: AcademyModule; level: number }
  /** Ort als Forschungsposten eingenommen: pop = Bevoelkerung fuer die Akademie, tiles = uebergebene Felder / place taken as a research post */
  | { t: 'post'; city: number; academy: number; faction: number; pop: number; tiles: number }
  | { t: 'gameOver'; winner: number | null; victory?: Victory };

/** Treffer des Orbitallasers: Einheit oder Geschuetz auf (x, y) / hit of the orbital laser: unit or gun at (x, y) */
export interface OrbitalHit { unit?: number; turret?: boolean; x: number; y: number; dmg: number; killed: boolean }

export type DiplomacyAction = 'proposePeace' | 'acceptPeace' | 'declinePeace' | 'announceBreak' | 'embassy';

export type Command =
  | { type: 'move'; unit: number; to: Pos }
  | { type: 'attack'; unit: number; target: number }
  | { type: 'retreat'; unit: number; target: number }
  | { type: 'rocket'; unit: number; target: number }
  /** Berserker: Selbstsprengung am Nachbarziel (BERSERKER.detonate) / berserker: self-detonation at the adjacent target */
  | { type: 'detonate'; unit: number; target: number }
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
  /** Stufe der Stadt mit Sternen kaufen (CITY.buyLevelCost) / buy the city's next level with stars (CITY.buyLevelCost) */
  | { type: 'buyLevel'; city: number }
  | { type: 'diplomacy'; action: DiplomacyAction; target: number }
  /** Orbitallaser auf die Flaeche mit der linken oberen Ecke (x, y) / orbital laser on the area with top-left corner (x, y) */
  | { type: 'orbitalStrike'; x: number; y: number }
  /** Goettlicher Funke: Flaechenschuss, (x, y) = linke obere Ecke der 2x2-Flaeche (SPARK) / Divine Spark: area shot, (x, y) = top-left corner of the 2x2 area (SPARK) */
  | { type: 'divineSpark'; unit: number; x: number; y: number }
  /** Kampagne m2: der Wissenschaftler arbeitet am Mutterschiff (beendet seinen Zug) / campaign m2: the scientist works on the mothership (ends its turn) */
  | { type: 'workShip'; unit: number }
  /** Kampagne m4: Kriegsplaene am Tempel bergen oder fallen gelassene aufheben / campaign m4: seize the war plans at the temple or pick up dropped ones */
  | { type: 'seizePlans'; unit: number }
  /** Schattenkommando: Sabotage auf (x, y) / Shadow Commando: sabotage on (x, y) */
  | { type: 'sabotage'; unit: number; x: number; y: number }
  /** Radarwagen: Radarimpuls / Radar Truck: radar sweep */
  | { type: 'radarSweep'; unit: number }
  /** Raketensilo auf (x, y) startet auf das Zielfeld (tx, ty) / rocket silo at (x, y) launches at the target tile (tx, ty) */
  | { type: 'siloLaunch'; x: number; y: number; tx: number; ty: number }
  /** Raketensilo auf (x, y) baut eine Einheit (SILO.units) / rocket silo at (x, y) builds a unit (SILO.units) */
  | { type: 'siloBuy'; x: number; y: number; unitType: UnitTypeId }
  /** Schwebende Akademie: abheben, ziehen (bis ACADEMY.move Felder je Zug), landen, Schild bauen / floating academy: lift off, move, land, build the shield */
  | { type: 'liftAcademy'; city: number }
  | { type: 'moveAcademy'; city: number; to: Pos }
  /** Terraformen und landen; at = benachbarter neutraler Ort (fehlt = eigenes Feld) / terraform and land; at = adjacent neutral place (missing = own tile) */
  | { type: 'landAcademy'; city: number; at?: Pos }
  /** Terraformen abbrechen: schwebt weiter, die Felder dieses Zuges sind verbraucht / cancel terraforming: keeps floating, this turn's tiles are used up */
  | { type: 'cancelTerraform'; city: number }
  | { type: 'academyShield'; city: number }
  /** Neutronenstrahl der Akademie auf das Ziel auf (x, y) / neutron beam of the academy at the target on (x, y) */
  | { type: 'academyBeam'; city: number; x: number; y: number }
  /** Modul der Akademie um eine Stufe ausbauen / upgrade an academy module by one level */
  | { type: 'academyModule'; city: number; module: AcademyModule }
  /** Beamer-Relay auf einem Posten bauen; Einheit zum Relay beamen / build a beam relay on a post; beam a unit to the relay */
  | { type: 'buildBeamer'; city: number }
  | { type: 'beam'; unit: number; city: number }
  /** Akademie angreifen: Schild, in der Luft ohne Schild Notlandung / attack the academy: shield, in the air without a shield an emergency landing */
  | { type: 'attackAcademy'; unit: number; city: number }
  /** NEXUS: neutralen Ort fernuebernehmen (HACK.place) / NEXUS: remote takeover of a neutral place (HACK.place) */
  | { type: 'hack'; city: number }
  /** NEXUS: Hackturm auf (x, y) bauen (HACK.tower) / NEXUS: build a hack tower on (x, y) (HACK.tower) */
  | { type: 'hackTower'; x: number; y: number }
  /** NEXUS: Hackturm auf (x, y) uebernimmt die Einheit target / NEXUS: hack tower at (x, y) takes over the unit target */
  | { type: 'hijack'; x: number; y: number; target: number }
  /** NEXUS: feindliche Stadt hacken und aufdecken (HACK.city) / NEXUS: hack and reveal a hostile city (HACK.city) */
  | { type: 'hackCity'; city: number }
  | { type: 'endTurn' };

export type ErrorCode =
  | 'gameOver' | 'notYourUnit' | 'noUnit' | 'unitExhausted' | 'unreachable' | 'outOfRange' | 'invalidTarget'
  | 'peace' | 'cannotAttack' | 'alreadyMoved' | 'alreadyAttacked' | 'notEnoughStars' | 'techMissing'
  | 'invalidTile' | 'occupied' | 'unitLimit' | 'notYourCity' | 'alreadyResearched' | 'parentMissing'
  | 'cannotCapture' | 'pendingReward' | 'noReward' | 'onePerCity' | 'notInTerritory' | 'alreadyBuilt'
  | 'notUnlocked' | 'noContact' | 'invalid' | 'fresh' | 'noResearch' | 'notTerraformed' | 'wrongFaction'
  | 'notPreacher' | 'recruitCooldown' | 'computeMissing' | 'cultRecruit' | 'cityLevel' | 'cannotRetreat' | 'retreatCooldown' | 'noRetreatTile' | 'cannotRepair' | 'noWreck' | 'noXenoGround' | 'noRockets'
  | 'enemyTerritory' | 'cannotBuild' | 'noTraining' | 'quake' | 'emplacementLimit' | 'emplacementSpacing' | 'outpostSpacing'
  // Orbitallaser / orbital laser
  | 'noRelay' | 'orbitalCooldown' | 'notVisible' | 'relayLimit'
  // Goettlicher Funke (SPARK): laedt nach, schon gezogen, Flaeche zu nah, kein Beobachter / Divine Spark (SPARK): recharging, already moved, area too close, no spotter
  | 'sparkCooldown' | 'sparkMoved' | 'sparkTooClose' | 'noSpotter' | 'sparkLimit'
  // Kriegsplaene (m4) / war plans (m4)
  | 'cannotCarry'
  // Berserker: kann sich nicht sprengen (keine Faehigkeit) bzw. kein gueltiges Ziel / berserker: cannot detonate (no ability) or no valid target
  | 'cannotDetonate' | 'detonateTarget'
  // Produktionsstaette fehlt (Ausbilden) oder Voraussetzung fehlt (Bauen) / production site missing (training) or prerequisite missing (building)
  | 'buildingMissing'
  // Werft: keine Kueste bzw. kein freies Wasserfeld an der Stadt / shipyard: no coast or no free water tile at the city
  | 'noCoast' | 'noWaterTile'
  // Stufe kaufen: in dieser Runde schon gekauft / buy level: already bought this round
  | 'alreadyBought'
  // Schattenflotte: Silo, Sabotage und Radar noch gesperrt, kein Ziel / shadow fleet: silo, sabotage and radar still locked, no target
  | 'siloCooldown' | 'sabotageCooldown' | 'radarCooldown' | 'noTarget' | 'siloLimit'
  // Einheit nur am Raketensilo zu haben; kein freies Feld am Silo / unit only available at a rocket silo; no free tile at the silo
  | 'siloOnly' | 'noRoom'
  // Schwebende Akademie: keine Akademie, in der Luft, am Boden, hebt noch ab, keine Felder mehr, Landeplatz ungeeignet,
  // Produktion ruht, Schild steht, schwebend nicht angreifbar fuer diese Einheit
  // floating academy: no academy, airborne, grounded, still lifting, no tiles left, landing site unsuitable, production
  // rests, shield is up, not attackable by this unit while floating
  | 'notAcademy' | 'airborne' | 'grounded' | 'lifting' | 'noSteps' | 'landingSite' | 'academyBusy' | 'shieldUp' | 'airTarget'
  // Terraformen: laeuft schon (kein Ziehen, kein zweites Landen), laeuft nicht (nichts abzubrechen)
  // terraforming: already running (no moving, no second landing), not running (nothing to cancel)
  | 'terraforming' | 'notTerraforming'
  // Beamer: kein Relay, schon gebeamt, Einheit nicht an der Akademie / beamer: no relay, already beamed, unit not at the academy
  | 'noBeamer' | 'beamUsed' | 'notAtAcademy'
  // Neutronenstrahl: Schuesse des Zuges verbraucht, Ruhezeit; Modul: hoechste Stufe, schon in diesem Zug ausgebaut
  // neutron beam: the turn's shots used, rest time; module: top level, already upgraded this turn
  | 'rayUsed' | 'rayCooldown' | 'rayNoTarget' | 'moduleMax'
  // Hacken (NEXUS): keine Ladung, zu frueh, schon gehackt in diesem Zug, uebernommene Einheit, Turm belegt, nicht mechanisiert
  // hacking (NEXUS): no charge, too early, already hacked this turn, taken-over unit, tower busy, not mechanised
  | 'hackCharges' | 'hackEarly' | 'hackTurn' | 'hijacked' | 'towerBusy' | 'towerCooldown' | 'notMechanised' | 'cityHackCooldown' | 'noDataCenter';

export interface CommandResult {
  ok: boolean;
  error?: ErrorCode;
  events: GameEvent[];
}
