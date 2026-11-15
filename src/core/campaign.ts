/**
 * Kampagne: Missionen als Daten (Karte, Gegner, Verbuendete, Einrichtung, Ziele, Wellen) und die deterministische
 * Auswertung der Ziele nach jedem Kommando und jedem Zugwechsel.
 * Campaign: missions as data (map, enemies, allies, setup, objectives, waves) and the deterministic evaluation of
 * the objectives after every command and every turn change.
 *
 * Die Kampagne spielt auf drei Scheibenwelten (WORLDS in worlds.ts): Erde, Heimatwelt der Zyrr und die rote Wueste der
 * Vergessenen. MISSIONS steht in dieser Spielreihenfolge; act ist die Nummer der Welt (1 bis 3).
 * The campaign is played on three disc worlds (WORLDS in worlds.ts): Earth, the Zyrr homeworld and the red desert of
 * the Forgotten. MISSIONS is in this play order; act is the number of the world (1 to 3).
 *
 * Der Spieler waehlt eine menschliche Fraktion und ist immer Fraktion 0; die Gegner sind nur Sonderfraktionen
 * (Zyrr, Kult, NEXUS). Manche Missionen bringen eine verbuendete Menschen-Fraktion (KI, im Frieden mit dem Spieler,
 * geteilte Karte); sie steht immer hinter den Gegnern. Die Einrichtung setzt nur allgemeine Menschen-Einheiten
 * (Infanterie, MG, Jeep, Panzer, Artillerie), damit jede Mission fuer alle fuenf Menschen-Fraktionen funktioniert.
 * The player picks a human faction and is always faction 0; the enemies are special factions only
 * (Zyrr, cult, NEXUS). Some missions add an allied human faction (AI, at peace with the player, shared map);
 * it always comes after the enemies. The setup places only generic human units (infantry, MG, jeep, tank,
 * artillery), so every mission works for all five human factions.
 *
 * "Halten"-Ziele gelten bis zum Missionsende (Rundenlimit) oder bis alle "Erreichen"-Ziele erfuellt sind;
 * "Erreichen"-Ziele muessen vor dem Rundenlimit erfuellt sein.
 * "Hold" objectives last until the end of the mission (round limit) or until all "achieve" objectives are met;
 * "achieve" objectives must be met before the round limit.
 */
import {
  CAMPAIGN_SETTLEMENTS, CITY, FACTION_IDS, ROSTERS, RUINS, SWARM_MOTHER, TOWER, VERDAN, type CityUpgradeId, type Difficulty, type FactionId, type HazardLevel, type MapSize, type MapType, type UnitTypeId,
} from '../data/balance';
import { dist, isLand, neighbors, tileAt } from './grid';
import { cityAt, hqOf, isHostile, ownCities, score, unitAt } from './queries';
import { freeFor, grantCity, nearestTile, placeUnit, revealArea } from './spawn';
import type { CampaignState, City, GameConfig, GameEvent, GameState, ObjectiveStatus, Pos, Unit } from './types';
import { WORLDS, worldOf } from './worlds';

/**
 * Stand der Missionsdaten; aeltere Kampagnen-Spielstaende werden beim Laden zu freien Partien.
 * 3 = Akt I mit fuenf Einsaetzen (Portal, Alienwelt, Schwarmmutter); 4 = drei Welten, Riss und Wueste der Vergessenen.
 * Revision of the mission data; older campaign saves become free games on load.
 * 3 = act I with five missions (portal, alien world, Swarm Mother); 4 = three worlds, rift and desert of the Forgotten.
 */
export const CAMPAIGN_REV = 4;
/** Spielbare Fraktionen der Kampagne: die Menschen / playable campaign factions: the humans */
export const CAMPAIGN_FACTIONS: FactionId[] = FACTION_IDS.filter((f) => !ROSTERS[f]);
/** Gegner der Kampagne: die Sonderfraktionen / campaign enemies: the special factions */
export const CAMPAIGN_ENEMIES: FactionId[] = FACTION_IDS.filter((f) => !!ROSTERS[f]);
export const isCampaignFaction = (f: unknown): f is FactionId => typeof f === 'string' && CAMPAIGN_FACTIONS.includes(f as FactionId);

/** Missionsziel / mission objective */
export type ObjectiveDef =
  // Halten bis zum Ende / hold until the end
  | { k: 'holdHq' }
  | { k: 'holdCities' }
  | { k: 'survive' }
  | { k: 'holdTile'; target: number }
  // Erreichen / achieve
  | { k: 'capture'; target: number }
  | { k: 'salvage'; target: number }
  | { k: 'cities'; n: number }
  | { k: 'points'; n: number }
  | { k: 'kills'; n: number }
  | { k: 'eliminate'; faction: number }
  /** markierte Einheit zerstoeren (Index in CampaignState.units) / destroy the marked unit (index into CampaignState.units) */
  | { k: 'destroyUnit'; unit: number; type: UnitTypeId }
  /**
   * Artefakt so viele Runden in Folge besetzen (gezaehlt zu Beginn des Spielerzugs). Schafft das ein Gegner zuerst,
   * ist das Ziel verfehlt.
   * Occupy the artifact for this many consecutive rounds (counted at the start of the player's turn). If an enemy
   * manages it first, the objective fails.
   */
  | { k: 'artifact'; rounds: number }
  /**
   * Dimensionsportal so viele Runden in Folge mit einer eigenen Einheit besetzen (gezaehlt zu Beginn des Spielerzugs).
   * Occupy the dimensional portal with an own unit for this many consecutive rounds (counted at the start of the player's turn).
   */
  | { k: 'portal'; rounds: number }
  /** eine eigene Einheit bis auf range Felder an das Zielfeld bringen / bring an own unit within range tiles of the target tile */
  | { k: 'reach'; target: number; range: number }
  /**
   * Endgegner bis auf SWARM_MOTHER.riftHp LP bringen (Index in CampaignState.units); dann reisst der Riss auf.
   * Bring the boss down to SWARM_MOTHER.riftHp HP (index into CampaignState.units); then the rift tears open.
   */
  | { k: 'rift'; unit: number }
  /**
   * So viele Ruinenstaetten entziffern: eine eigene Einheit steht zu Beginn des Spielerzugs darauf (CampaignState.sites).
   * Decipher this many ruin sites: an own unit stands on one at the start of the player's turn (CampaignState.sites).
   */
  | { k: 'ruins'; n: number }
  /**
   * Hoehleneingang so viele Runden in Folge mit einer eigenen Einheit besetzen (gezaehlt zu Beginn des Spielerzugs).
   * Occupy the cave entrance with an own unit for this many consecutive rounds (counted at the start of the player's turn).
   */
  | { k: 'cave'; rounds: number }
  // nur Bonus / bonus only
  | { k: 'fast'; rounds: number }
  | { k: 'keepHq' }
  | { k: 'noCityLost' };

const HOLD_KINDS = new Set(['holdHq', 'holdCities', 'survive', 'holdTile']);
/** Halten-Ziel? / hold objective? */
export const isHoldObjective = (o: ObjectiveDef) => HOLD_KINDS.has(o.k);

/**
 * Sprecher eines Comic-Panels: eigener Anfuehrer, feindlicher Anfuehrer, Spaeher, verbuendeter Anfuehrer.
 * Speaker of a comic panel: own leader, enemy leader, scout, allied leader.
 */
export type Speaker = 'hq' | 'enemy' | 'scout' | 'ally';
/** Panel der Besprechung; enemy = Index in MissionDef.enemies (Standard 0) / briefing panel; enemy = index into MissionDef.enemies (default 0) */
export type BriefPanel = Speaker | { speaker: 'enemy'; enemy: number };
/** Sprecher und Gegner-Index eines Panels / speaker and enemy index of a panel */
export const panelOf = (p: BriefPanel): { speaker: Speaker; enemy: number } => (typeof p === 'string' ? { speaker: p, enemy: 0 } : p);

/** Werkzeuge fuer die Einrichtung / setup toolkit */
export interface SetupKit {
  s: GameState;
  hq(f: number): City;
  mid(a: Pos, b: Pos): Pos;
  /** Punkt n Felder von a in Richtung b / point n tiles from a towards b */
  toward(a: Pos, b: Pos, n: number): Pos;
  /** naechstes freies Landfeld (ohne Stadt, ohne Berg) / nearest free land tile (no city, no mountain) */
  landNear(p: Pos, extra?: (q: Pos) => boolean): Pos;
  /**
   * Einheit nahe einem Punkt aufstellen, nie auf fremden Staedten und nie auf dem Artefakt; min = Mindestabstand.
   * Place a unit near a point, never on foreign cities and never on the artifact; min = minimum distance.
   */
  spawn(type: UnitTypeId, owner: number, near: Pos, opts?: { carried?: UnitTypeId | null; min?: number }): Unit | null;
  /** naechste neutrale Siedlung an eine Fraktion / nearest neutral settlement to a faction */
  grantNear(owner: number, near: Pos, minDist?: number): City | null;
  /** Zielfeld (wird markiert) / target tile (gets highlighted) */
  target(p: Pos): number;
  /** Zieleinheit fuer destroyUnit / target unit for destroyUnit */
  mark(u: Unit): number;
  /** Ankunftspunkt fuer Wellen / arrival point for waves */
  point(p: Pos): number;
  /** Dimensionsportal der Zyrr auf ein Feld stellen (Modell, begehbar) / put the Zyrr dimensional portal on a tile (model, walkable) */
  portal(p: Pos): void;
  /** Stadtausbau setzen / add a city upgrade */
  upgrade(c: City, id: CityUpgradeId): void;
  /**
   * Ruinenstaette der Vergessenen nahe einem Punkt anlegen, mit einer schlafenden Verdan-Wache daneben.
   * Lay out a ruin site of the Forgotten near a point, with a dormant Verdan sentinel next to it.
   */
  ruin(near: Pos): Pos | null;
  /**
   * Hoehleneingang nahe der Kartenmitte: Felswand auf der von from abgewandten Seite, alle kennen ihn (Zielfeld).
   * Cave entrance near the map centre: rock wall on the side away from from, everyone knows it (target tile).
   */
  caveMouth(from: Pos): Pos;
}

/**
 * Welle: zu Beginn des Spielerzugs in Runde round treffen Einheiten von owner am Punkt at ein (bereit ab ihrem
 * naechsten Zug); stars deckt den Sold. owner 0 = Verstaerkung fuer den Spieler.
 * Wave: at the start of the player's turn in round round, units of owner arrive at point at (ready from their
 * next turn); stars covers the upkeep. owner 0 = reinforcements for the player.
 */
export interface WaveDef { round: number; owner: number; units: UnitTypeId[]; at: number; stars?: number }

export interface MissionDef {
  id: string;
  /** Nummer der Welt (ab 1), aus WORLDS abgeleitet / number of the world (from 1), derived from WORLDS */
  act: number;
  /** Schwierigkeit (Anzeige) / difficulty (display) */
  level: Difficulty;
  enemies: { id: FactionId; difficulty: Difficulty }[];
  seed: number;
  size: MapSize;
  mapType: MapType;
  hazards: HazardLevel;
  weather: boolean;
  events: boolean;
  startStars: number;
  /** Missionsdauer in Runden / mission length in rounds */
  rounds: number;
  objectives: ObjectiveDef[];
  bonus: ObjectiveDef[];
  /** Comic-Panels der Einsatzbesprechung (ohne Verbuendeten) / comic panels of the briefing (without the ally) */
  briefing: BriefPanel[];
  /** verbuendete Gegner (Fraktionsindizes, im Frieden) / allied enemies (faction indices, at peace) */
  allied?: [number, number][];
  waves?: WaveDef[];
  /** Artefakt in der Kartenmitte (Finale) / artifact in the map centre (finale) */
  artifact?: boolean;
  /** Ueberzeugen lohnt sich hier (Hinweis in der Besprechung fuer Alvenia und Meridon) / persuasion matters here (briefing tip for Alvenia and Meridon) */
  persuade?: boolean;
  /**
   * Kartenthema: 'alien' = Heimatwelt der Zyrr, ganz Xeno-Boden; 'desert' = rote Wueste der Vergessenen; 'cavern' = Hoehle.
   * Map theme: 'alien' = Zyrr homeworld, all xeno ground; 'desert' = red desert of the Forgotten; 'cavern' = cave.
   */
  theme?: 'cavern' | 'alien' | 'desert';
  /** Landetrupp: der Spieler beginnt ohne Stadt (siehe CampaignState.landing) / landing party: the player starts without a city */
  landing?: boolean;
  /**
   * Endgegner: taucht am Zielfeld at auf, sobald eine Spielereinheit nahe kommt oder ab einer Runde (SWARM_MOTHER), und wird
   * als Zieleinheit markiert (CampaignState.units).
   * Boss: emerges at target tile at once a player unit comes close or from a round (SWARM_MOTHER), and is marked as a
   * target unit (CampaignState.units).
   */
  boss?: { unit: UnitTypeId; owner: number; at: number };
  /** Verdan-Verteidigungslinie um das Artefakt / Verdan defence line around the artifact */
  turrets?: boolean;
  /** Siedlungsfaktor (fehlt = CAMPAIGN_SETTLEMENTS des Themas) / settlement factor (missing = CAMPAIGN_SETTLEMENTS of the theme) */
  settlements?: number;
  /** Anzahl Sendetuerme (fehlt = aus der Kartengroesse, TOWER; in der Hoehle keine) / number of transmitter towers (missing = from the map size, TOWER; none in the cavern) */
  towers?: number;
  /**
   * Riss: der Endgegner stirbt nicht, bei SWARM_MOTHER.riftHp LP reisst der Riss auf (Ziel 'rift').
   * Rift: the boss does not die, at SWARM_MOTHER.riftHp HP the rift tears open (objective 'rift').
   */
  rift?: boolean;
  setup?(k: SetupKit): void;
}

// ---------- Verbuendete / allies ----------

/**
 * Verbuendete Menschen-Fraktion je Spielerfraktion und Mission (fest, nie die eigene). Die diplomatischen Fraktionen
 * bekommen oefter Hilfe: Alvenia in 7, Meridon in 6, die anderen in 2 Missionen. Auf der Alienwelt helfen sich nur
 * die beiden Diplomaten gegenseitig (m11); die Landetrupps (m10, m12) sind allein; in der Wueste stehen ihnen andere
 * gestrandete Menschen bei (m13, m14).
 * Allied human faction per player faction and mission (fixed, never the own one). The diplomatic factions
 * get help more often: Alvenia in 7, Meridon in 6, the others in 2 missions. On the alien world only the two
 * diplomats help each other (m11); the landing parties (m10, m12) are alone; in the desert other stranded humans
 * stand by them (m13, m14).
 */
export const CAMPAIGN_ALLIES: Partial<Record<FactionId, Record<string, FactionId>>> = {
  alvenia: { m2: 'meridon', m4: 'korvat', m6: 'velkar', m8: 'dravon', m11: 'meridon', m14: 'korvat', m9: 'meridon' },
  meridon: { m5: 'dravon', m7: 'velkar', m3: 'alvenia', m11: 'alvenia', m13: 'velkar', m9: 'alvenia' },
  korvat: { m6: 'alvenia', m9: 'dravon' },
  dravon: { m8: 'velkar', m9: 'meridon' },
  velkar: { m3: 'dravon', m9: 'alvenia' },
};
/** Verbuendeter einer Mission fuer die Spielerfraktion / ally of a mission for the player faction */
export const allyFor = (mission: string, faction: FactionId): FactionId | null => CAMPAIGN_ALLIES[faction]?.[mission] ?? null;

// ---------- Missionen / missions ----------

/** freies Landfeld im Abstand lo..hi von a, moeglichst nahe an p / free land tile at distance lo..hi from a, as close to p as possible */
function ringNear(k: SetupKit, a: Pos, p: Pos, lo: number, hi: number): Pos {
  return k.landNear(p, (q) => dist(q, a) >= lo && dist(q, a) <= hi);
}

/** Missionsdaten; Reihenfolge und Welt kommen allein aus WORLDS / mission data; order and world come from WORLDS alone */
const DEFS: Omit<MissionDef, 'act'>[] = [
  // ---------- Welt I: Erde, die Fraktionen kaempfen (Sternfall, Glocke, Erwachen, Portal) ----------
  // ---------- World I: Earth, where the factions fight (Starfall, Bell, Awakening, Portal) ----------
  {
    id: 'm1', level: 'easy', enemies: [{ id: 'zyrr', difficulty: 'easy' }],
    seed: 1101, size: 11, mapType: 'continent', hazards: 'normal', weather: true, events: false, startStars: 30, rounds: 14,
    objectives: [{ k: 'cities', n: 4 }], bonus: [{ k: 'fast', rounds: 9 }, { k: 'keepHq' }],
    briefing: ['hq', 'scout', 'enemy'], persuade: true,
    waves: [{ round: 4, owner: 1, units: ['grey', 'grey'], at: 0, stars: 10 }],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      k.spawn('infantry', 0, a); k.spawn('jeep', 0, a);
      // Sonden der Zyrr schwaermen frueh aus / Zyrr probes swarm out early
      k.spawn('grey', 1, b, { min: 1 });
      k.point(ringNear(k, a, k.toward(a, b, 4), 3, 5));
    },
  },
  {
    // Wettlauf zum Wrack, dazu die Landekapseln der alten m3 / race to the wreck, plus the landing pods of the old m3
    id: 'm2', level: 'easy', enemies: [{ id: 'zyrr', difficulty: 'normal' }],
    seed: 2202, size: 14, mapType: 'continent', hazards: 'none', weather: true, events: false, startStars: 30, rounds: 12,
    objectives: [{ k: 'salvage', target: 0 }, { k: 'holdCities' }], bonus: [{ k: 'fast', rounds: 7 }, { k: 'kills', n: 4 }],
    briefing: ['scout', 'hq', 'enemy'], persuade: true,
    waves: [
      { round: 2, owner: 1, units: ['grey', 'grey'], at: 0, stars: 10 },
      { round: 4, owner: 1, units: ['grey', 'skimmer'], at: 1, stars: 15 },
      { round: 7, owner: 1, units: ['grey', 'grey', 'skimmer'], at: 0, stars: 15 },
    ],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      const site = k.landNear(k.mid(a, b), (q) => !neighbors(k.s.size, q.x, q.y).some((n) => tileAt(k.s, n.x, n.y)!.cityId !== null));
      Object.assign(tileAt(k.s, site.x, site.y)!, { feature: 'crashSite', terrain: 'plain', resource: null, building: null, looted: false });
      k.target(site);
      const v = k.grantNear(0, a) ?? a;
      k.spawn('jeep', 0, a); k.spawn('infantry', 0, a); k.spawn('mg', 0, a);
      if (v !== a) k.spawn('infantry', 0, v);
      k.spawn('skimmer', 1, b);
      revealArea(k.s, 0, site.x, site.y, 1);
      // Landekapseln vor den eigenen Staedten / landing pods in front of the own cities
      k.point(ringNear(k, a, k.toward(a, b, 4), 3, 5));
      k.point(ringNear(k, v, k.toward(v, b, 3), 3, 4));
    },
  },
  // Kapitel Die Glocke (gegen den Kult) / chapter The Bell (vs the cult)
  {
    id: 'm4', level: 'normal', enemies: [{ id: 'vesper', difficulty: 'easy' }],
    seed: 4404, size: 14, mapType: 'continent', hazards: 'none', weather: true, events: true, startStars: 30, rounds: 14,
    objectives: [{ k: 'kills', n: 8 }], bonus: [{ k: 'noCityLost' }, { k: 'fast', rounds: 10 }],
    briefing: ['scout', 'enemy', 'hq'],
    waves: [
      { round: 4, owner: 1, units: ['zealot', 'zealot'], at: 0, stars: 10 },
      { round: 7, owner: 1, units: ['zealot', 'torchbearer'], at: 1, stars: 10 },
    ],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      const v = k.grantNear(0, a) ?? a;
      k.spawn('mg', 0, a); k.spawn('infantry', 0, v);
      // weitere Pilgerzuege vor beiden Staedten / more pilgrim trains in front of both cities
      const p0 = ringNear(k, a, k.toward(a, b, 3), 2, 4);
      k.point(p0);
      k.point(k.landNear(k.toward(v, b, 3), (q) => dist(q, v) >= 2 && dist(q, v) <= 4 && dist(q, p0) >= 2));
      // Pilger werden zu Eiferern, mitten im eigenen Land / pilgrims turn into zealots right inside the own land
      for (const c of v === a ? [a] : [a, v]) {
        const p = k.toward(c, b, 2);
        k.spawn('zealot', 1, p, { min: 1 }); k.spawn('zealot', 1, p, { min: 1 });
        revealArea(k.s, 0, p.x, p.y, 2);
      }
    },
  },
  {
    id: 'm5', level: 'normal', enemies: [{ id: 'vesper', difficulty: 'normal' }],
    seed: 5505, size: 14, mapType: 'lakes', hazards: 'normal', weather: true, events: true, startStars: 35, rounds: 20,
    objectives: [{ k: 'capture', target: 0 }], bonus: [{ k: 'fast', rounds: 15 }, { k: 'keepHq' }],
    briefing: ['hq', 'enemy', 'scout'],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      k.target(b);
      k.grantNear(1, b);
      k.spawn('jeep', 0, a); k.spawn('infantry', 0, a); k.spawn('mg', 0, a);
      k.spawn('zealot', 1, b, { min: 1 }); k.spawn('torchbearer', 1, b, { min: 1 });
      revealArea(k.s, 0, b.x, b.y, 1);
    },
  },
  {
    id: 'm6', level: 'normal', enemies: [{ id: 'vesper', difficulty: 'normal' }],
    seed: 6606, size: 16, mapType: 'continent', hazards: 'normal', weather: true, events: true, startStars: 35, rounds: 14,
    objectives: [{ k: 'destroyUnit', unit: 0, type: 'coreDrill' }], bonus: [{ k: 'kills', n: 5 }, { k: 'noCityLost' }],
    briefing: ['scout', 'enemy', 'hq'],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      // der Bohrer steht zwischen den Fronten, bewacht von Eiferern / the drill stands between the fronts, guarded by zealots
      const p = k.landNear(k.mid(a, b), (q) => dist(q, b) >= 2);
      const drill = k.spawn('coreDrill', 1, p);
      if (drill) { k.mark(drill); revealArea(k.s, 0, drill.x, drill.y, 2); }
      k.spawn('zealot', 1, p, { min: 1 }); k.spawn('faustZealot', 1, p, { min: 1 });
      k.spawn('tank', 0, a); k.spawn('artillery', 0, a); k.spawn('jeep', 0, a);
    },
  },
  // Kapitel Erwachen (gegen NEXUS) / chapter Awakening (vs NEXUS)
  {
    id: 'm7', level: 'normal', enemies: [{ id: 'nexus', difficulty: 'normal' }],
    seed: 7707, size: 16, mapType: 'lakes', hazards: 'none', weather: true, events: true, startStars: 35, rounds: 18,
    objectives: [{ k: 'capture', target: 0 }, { k: 'capture', target: 1 }], bonus: [{ k: 'kills', n: 6 }, { k: 'fast', rounds: 13 }],
    briefing: ['scout', 'enemy', 'hq'],
    setup(k) {
      const a = k.hq(0);
      // alte Reichsdepots, von NEXUS besetzt / old empire depots held by NEXUS
      for (let i = 0; i < 2; i++) {
        const c = k.grantNear(1, a, 3);
        if (!c) continue;
        k.target(c);
        k.upgrade(c, 'depot');
        k.spawn('android', 1, c);
        revealArea(k.s, 0, c.x, c.y, 1);
      }
      k.spawn('mg', 0, a); k.spawn('jeep', 0, a); k.spawn('artillery', 0, a);
    },
  },
  {
    id: 'm8', level: 'hard', enemies: [{ id: 'nexus', difficulty: 'hard' }],
    seed: 8808, size: 14, mapType: 'continents', hazards: 'normal', weather: true, events: false, startStars: 35, rounds: 12,
    objectives: [{ k: 'holdHq' }, { k: 'kills', n: 5 }], bonus: [{ k: 'noCityLost' }, { k: 'kills', n: 9 }],
    briefing: ['hq', 'enemy', 'scout'],
    waves: [
      { round: 3, owner: 1, units: ['android', 'spider'], at: 0, stars: 10 },
      { round: 5, owner: 1, units: ['android', 'quadDrone'], at: 1, stars: 15 },
      { round: 7, owner: 0, units: ['tank', 'infantry'], at: 2, stars: 30 },
      { round: 8, owner: 1, units: ['spider', 'railgun', 'android'], at: 0, stars: 20 },
      { round: 10, owner: 1, units: ['titan', 'android'], at: 1, stars: 25 },
    ],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      k.upgrade(a, 'bunker');
      k.spawn('mg', 0, a); k.spawn('mg', 0, a); k.spawn('infantry', 0, a);
      // zwei getrennte Angriffsrichtungen (nie dasselbe Feld) / two separate attack directions (never the same tile)
      const p0 = ringNear(k, a, k.toward(a, b, 4), 3, 5);
      k.point(p0);
      k.point(k.landNear({ x: k.s.size - 1 - a.x, y: a.y }, (q) => dist(q, a) >= 3 && dist(q, a) <= 5 && dist(q, p0) >= 3));
      k.point(k.landNear(a, (q) => dist(q, a) >= 1));
    },
  },
  // Kapitel Das Portal: Ende der Erde, das Tor in die Heimatwelt der Zyrr / chapter The Portal: end of Earth, the gate to the Zyrr homeworld
  {
    // Garnison schlagen, Portal halten; Nachschub der Zyrr kommt durch das Portal / beat the garrison, hold the portal; Zyrr reinforcements come through the portal
    id: 'm3', level: 'hard', enemies: [{ id: 'zyrr', difficulty: 'hard' }],
    seed: 3313, size: 14, mapType: 'lakes', hazards: 'none', weather: true, events: false, startStars: 40, rounds: 14,
    objectives: [{ k: 'portal', rounds: 2 }], bonus: [{ k: 'kills', n: 7 }, { k: 'noCityLost' }],
    briefing: ['scout', 'enemy', 'hq'],
    waves: [
      { round: 4, owner: 1, units: ['grey', 'grey'], at: 0, stars: 10 },
      { round: 7, owner: 1, units: ['grey', 'skimmer'], at: 0, stars: 15 },
      { round: 10, owner: 1, units: ['grey', 'tripod', 'mech'], at: 0, stars: 20 },
    ],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      // das Portal steht vor dem Zyrr-Lager, frei von Staedten / the portal stands in front of the Zyrr camp, clear of cities
      const p = k.landNear(k.toward(b, a, 3), (q) => dist(q, b) >= 2 && !neighbors(k.s.size, q.x, q.y).some((n) => tileAt(k.s, n.x, n.y)!.cityId !== null));
      Object.assign(tileAt(k.s, p.x, p.y)!, { terrain: 'plain', resource: null, building: null });
      k.portal(p);
      k.target(p);
      // Nachschub tritt neben dem Portal aus, auf der Seite der Zyrr: der Halter wird nicht ueberrannt
      // reinforcements step out next to the portal, on the Zyrr side: the holder is not overrun
      k.point(ringNear(k, p, k.toward(p, b, 2), 2, 3));
      // Garnison: ein Mech auf dem Portal, Graue daneben / garrison: a mech on the portal, greys next to it
      k.spawn('mech', 1, p);
      k.spawn('grey', 1, p, { min: 1 }); k.spawn('grey', 1, p, { min: 1 });
      const v = k.grantNear(0, a) ?? a;
      k.spawn('mg', 0, a); k.spawn('artillery', 0, a); k.spawn('jeep', 0, a); k.spawn('tank', 0, a);
      if (v !== a) k.spawn('infantry', 0, v);
      // alle kennen das Portal, der Spieler sieht auch die Wache / everyone knows the portal, the player also sees the guard
      for (const f of k.s.factions) revealArea(k.s, f.index, p.x, p.y, f.index === 0 ? 2 : 1);
    },
  },
  // ---------- Welt II: Heimatwelt der Zyrr / World II: Zyrr homeworld ----------
  {
    // Jenseits des Portals: Landetrupp ohne Stadt auf der Heimatwelt der Zyrr / beyond the portal: landing party without a city on the Zyrr homeworld
    id: 'm10', level: 'normal', enemies: [{ id: 'zyrr', difficulty: 'easy' }],
    seed: 10010, size: 16, mapType: 'continent', hazards: 'none', weather: false, events: false, startStars: 45, rounds: 20,
    objectives: [{ k: 'capture', target: 0 }, { k: 'reach', target: 1, range: 2 }], bonus: [{ k: 'fast', rounds: 13 }, { k: 'kills', n: 6 }],
    briefing: ['scout', 'enemy', 'hq'], theme: 'alien', landing: true,
    waves: [
      { round: 5, owner: 1, units: ['grey', 'grey'], at: 0, stars: 10 },
      { round: 9, owner: 1, units: ['skimmer', 'grey'], at: 1, stars: 15 },
      { round: 12, owner: 1, units: ['mech', 'grey'], at: 1, stars: 20 },
    ],
    setup(k) {
      const s = k.s;
      const out = k.hq(0), b = k.hq(1);
      // der Startplatz des Spielers ist ein Vorposten der Zyrr; erobert wird er wieder zum Hauptquartier
      // the player's start site is a Zyrr outpost; once captured it becomes the HQ again
      s.units = s.units.filter((u) => u.owner !== 0);
      out.owner = 1;
      out.level = 2;
      revealArea(s, 1, out.x, out.y, out.radius + 1);
      k.target(out);
      k.target(b);
      // Ankunft: drei Felder vom Vorposten, auf der vom Hauptquartier abgewandten Seite / arrival: three tiles from the outpost, away from the HQ
      const clamp = (v: number) => Math.max(0, Math.min(s.size - 1, v));
      const away = { x: clamp(2 * out.x - b.x), y: clamp(2 * out.y - b.y) };
      const gate = ringNear(k, out, k.toward(out, away, 3), 3, 4);
      k.portal(gate);
      // vier Trupps: alle im Freibetrag des Solds, ohne Einkommen desertiert sonst einer / four squads: all within the upkeep allowance, without income one would desert otherwise
      for (const t of ['infantry', 'mg', 'jeep', 'artillery'] as UnitTypeId[]) k.spawn(t, 0, gate, { min: 1 });
      revealArea(s, 0, gate.x, gate.y, 2);
      revealArea(s, 0, out.x, out.y, 1);
      revealArea(s, 0, b.x, b.y, 1);
      // die Hoehle ist verlassen, die Zyrr kommen mit der ersten Welle zurueck; die Schwarmstadt ist besetzt
      // the burrow is deserted, the Zyrr return with the first wave; the hive city is garrisoned
      k.grantNear(1, b, 2); k.grantNear(1, b, 2);
      k.upgrade(b, 'bunker');
      k.spawn('mech', 1, b); k.spawn('tripod', 1, b, { min: 1 }); k.spawn('grey', 1, b, { min: 1 });
      // Wellen: Gegenstoss am Vorposten, dann aus der Schwarmstadt / waves: counter-attack at the outpost, then from the hive
      k.point(ringNear(k, out, k.toward(out, b, 3), 2, 4));
      k.point(ringNear(k, b, k.toward(b, out, 3), 2, 4));
    },
  },
  {
    // Die Schwarmmutter: Hauptquartier der Zyrr; Xyl'Tharra taucht spaeter selbst auf; kurz vor ihrem Tod reisst der Riss auf
    // the Swarm Mother: Zyrr HQ; Xyl'Tharra emerges later herself; just before her death the rift tears open
    id: 'm11', level: 'hard', enemies: [{ id: 'zyrr', difficulty: 'easy' }],
    seed: 11011, size: 14, mapType: 'continent', hazards: 'none', weather: false, events: false, startStars: 50, rounds: 16,
    objectives: [{ k: 'rift', unit: 0 }, { k: 'holdHq' }], bonus: [{ k: 'kills', n: 8 }, { k: 'fast', rounds: 12 }],
    briefing: ['scout', 'enemy', 'hq'], theme: 'alien', boss: { unit: 'swarmMother', owner: 1, at: 0 }, rift: true,
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      k.target(b);
      // das Portal, durch das der Spieler kam, steht neben seiner Basis / the portal the player came through stands next to the base
      k.portal(ringNear(k, a, k.toward(a, { x: k.s.size - 1 - b.x, y: k.s.size - 1 - b.y }, 2), 1, 2));
      k.upgrade(a, 'bunker');
      k.spawn('tank', 0, a); k.spawn('tank', 0, a); k.spawn('mg', 0, a); k.spawn('artillery', 0, a); k.spawn('artillery', 0, a); k.spawn('infantry', 0, a);
      k.upgrade(b, 'bunker');
      k.grantNear(1, b, 2); k.grantNear(1, b, 2);
      k.spawn('mech', 1, b); k.spawn('tripod', 1, b, { min: 1 }); k.spawn('grey', 1, b, { min: 1 });
      k.spawn('skimmer', 1, k.toward(b, a, 3));
      revealArea(k.s, 0, b.x, b.y, 1);
    },
  },
  // ---------- Welt III: Welt der Vergessenen, rote Wueste (alle gegen alle) / World III: world of the Forgotten, red desert (everyone vs everyone) ----------
  {
    // Gestrandet: verstreute Landetrupps ohne Stadt; ein verlassener Verdan-Aussenposten wird die Basis
    // Stranded: scattered landing parties without a city; an abandoned Verdan outpost becomes the base
    id: 'm12', level: 'hard',
    enemies: [{ id: 'zyrr', difficulty: 'normal' }, { id: 'nexus', difficulty: 'normal' }, { id: 'vesper', difficulty: 'normal' }],
    seed: 12012, size: 16, mapType: 'continent', hazards: 'normal', weather: true, events: false, startStars: 40, rounds: 18,
    objectives: [{ k: 'capture', target: 0 }, { k: 'cities', n: 4 }], bonus: [{ k: 'fast', rounds: 10 }, { k: 'kills', n: 6 }],
    briefing: ['scout', 'enemy', { speaker: 'enemy', enemy: 1 }, { speaker: 'enemy', enemy: 2 }, 'hq'], theme: 'desert', landing: true,
    setup(k) {
      const s = k.s;
      const out = k.hq(0);
      s.units = s.units.filter((u) => u.owner !== 0);
      // das alte Hauptquartier wird ein verlassener Aussenposten der Verdan (neutral); erobert wird er das Hauptquartier
      // the old HQ becomes an abandoned Verdan outpost (neutral); once taken it becomes the HQ
      out.owner = null;
      for (const t of s.tiles) if (t.territory === out.id) t.territory = null;
      s.factions[0].explored.fill(0);
      k.target(out);
      revealArea(s, 0, out.x, out.y, 0);
      // drei verstreute Landeplaetze rund um den Aussenposten, weg von der Kartenmitte
      // three scattered landing spots around the outpost, away from the map centre
      const c = (s.size - 1) / 2;
      const base = Math.atan2(out.y - c, out.x - c);
      const drops: UnitTypeId[][] = [['infantry', 'artillery'], ['mg'], ['jeep']];
      drops.forEach((units, i) => {
        const a = base + (i - 1) * (Math.PI * 0.62);
        const want = { x: Math.round(out.x + Math.cos(a) * 4), y: Math.round(out.y + Math.sin(a) * 4) };
        const p = ringNear(k, out, { x: Math.max(0, Math.min(s.size - 1, want.x)), y: Math.max(0, Math.min(s.size - 1, want.y)) }, 3, 5);
        for (const t of units) k.spawn(t, 0, p);
        revealArea(s, 0, p.x, p.y, 2);
      });
      // die anderen sind ebenso gestrandet: je ein Trupp an ihrer Zuflucht / the others are stranded too: one squad each at their refuge
      for (let f = 1; f <= 3; f++) for (const t of [['grey', 'skimmer'], ['android', 'spider'], ['zealot', 'torchbearer']][f - 1] as UnitTypeId[]) k.spawn(t, f, k.hq(f), { min: 1 });
    },
  },
  {
    // Ruinen der Vergessenen: drei von vier Ruinenstaetten entziffern, schlafende Verdan-Wachen daneben
    // Ruins of the Forgotten: decipher three of four ruin sites, dormant Verdan sentinels next to them
    id: 'm13', level: 'hard',
    enemies: [{ id: 'zyrr', difficulty: 'hard' }, { id: 'nexus', difficulty: 'normal' }, { id: 'vesper', difficulty: 'normal' }],
    seed: 13013, size: 18, mapType: 'lakes', hazards: 'normal', weather: true, events: true, startStars: 40, rounds: 20,
    objectives: [{ k: 'ruins', n: 3 }, { k: 'holdHq' }], bonus: [{ k: 'kills', n: 8 }, { k: 'noCityLost' }],
    briefing: ['scout', 'enemy', { speaker: 'enemy', enemy: 1 }, 'scout', 'hq'], theme: 'desert',
    setup(k) {
      const s = k.s;
      const a = k.hq(0);
      k.grantNear(0, a);
      k.spawn('mg', 0, a); k.spawn('jeep', 0, a); k.spawn('artillery', 0, a); k.spawn('infantry', 0, a);
      // Staetten: Kartenmitte und auf halbem Weg zu den drei anderen / sites: map centre and halfway to the three others
      const mid = { x: Math.floor(s.size / 2), y: Math.floor(s.size / 2) };
      const wants = [mid, ...[1, 2, 3].map((f) => k.mid(a, k.hq(f)))].slice(0, RUINS.sites);
      for (const w of wants) k.ruin(w);
    },
  },
  {
    // Der Hoehleneingang: den Schlund in der Schlucht drei Runden halten, alle wollen hinein
    // The cave entrance: hold the mouth in the canyon for three rounds, everyone wants in
    id: 'm14', level: 'hard',
    enemies: [{ id: 'zyrr', difficulty: 'hard' }, { id: 'nexus', difficulty: 'hard' }, { id: 'vesper', difficulty: 'normal' }],
    seed: 14014, size: 18, mapType: 'continents', hazards: 'normal', weather: true, events: true, startStars: 45, rounds: 20,
    objectives: [{ k: 'cave', rounds: 3 }, { k: 'holdHq' }], bonus: [{ k: 'kills', n: 8 }, { k: 'fast', rounds: 15 }],
    briefing: ['scout', 'enemy', { speaker: 'enemy', enemy: 1 }, { speaker: 'enemy', enemy: 2 }, 'hq'], theme: 'desert',
    waves: [
      { round: 6, owner: 1, units: ['grey', 'skimmer'], at: 0, stars: 15 },
      { round: 7, owner: 2, units: ['android', 'spider'], at: 1, stars: 15 },
      { round: 8, owner: 3, units: ['zealot', 'torchbearer'], at: 2, stars: 10 },
      { round: 9, owner: 0, units: ['tank', 'mg'], at: 3, stars: 30 },
    ],
    setup(k) {
      const a = k.hq(0);
      k.upgrade(a, 'bunker');
      k.grantNear(0, a);
      k.spawn('mg', 0, a); k.spawn('jeep', 0, a); k.spawn('artillery', 0, a); k.spawn('infantry', 0, a);
      const mouth = k.caveMouth(a);
      // alle kennen den Schlund; Ankunftspunkte zwischen ihm und den Basen / everyone knows the mouth; arrival points between it and the bases
      for (let f = 1; f <= 3; f++) k.point(ringNear(k, mouth, k.toward(mouth, k.hq(f), 5), 4, 6));
      k.point(k.landNear(a, (q) => dist(q, a) >= 1));
    },
  },
  {
    // Finale: alle gegen alle um das Artefakt der Vergessenen, tief unter dem Hoehleneingang
    // finale: everyone against everyone for the artifact of the Forgotten, deep below the cave entrance
    id: 'm9', level: 'extreme',
    enemies: [{ id: 'zyrr', difficulty: 'hard' }, { id: 'nexus', difficulty: 'hard' }, { id: 'vesper', difficulty: 'normal' }],
    // groesste Karte, in einer Hoehle unter der Wueste; mehr Runden fuer die weiten Wege / largest map, in a cave below the desert; more rounds for the long roads
    // unter Tage kein normales Wetter, nur Erdbeben (weatherFor) / underground no normal weather, only earthquakes (weatherFor)
    seed: 9916, size: 26, mapType: 'continent', hazards: 'normal', weather: true, events: true, startStars: 40, rounds: 30,
    objectives: [{ k: 'artifact', rounds: 3 }, { k: 'holdHq' }], bonus: [{ k: 'kills', n: 10 }, { k: 'noCityLost' }],
    briefing: ['scout', 'enemy', { speaker: 'enemy', enemy: 1 }, { speaker: 'enemy', enemy: 2 }, 'scout', 'hq'],
    artifact: true, persuade: true, theme: 'cavern', turrets: true,
    waves: [
      { round: 8, owner: 1, units: ['skimmer', 'grey'], at: 0, stars: 15 },
      { round: 9, owner: 2, units: ['quadDrone', 'android'], at: 1, stars: 15 },
      { round: 10, owner: 0, units: ['tank', 'mg'], at: 3, stars: 30 },
      { round: 11, owner: 3, units: ['zealot', 'torchbearer'], at: 2, stars: 10 },
    ],
    setup(k) {
      const a = k.hq(0);
      k.upgrade(a, 'bunker');
      k.grantNear(0, a);
      k.spawn('mg', 0, a); k.spawn('jeep', 0, a); k.spawn('artillery', 0, a);
      // Ankunftspunkte zwischen Artefakt und den Basen der drei Rassen, ausserhalb der Verdan-Linie
      // arrival points between the artifact and the three races' bases, outside the Verdan line
      const art = k.s.campaign!.artifact!;
      for (let f = 1; f <= 3; f++) k.point(ringNear(k, art, k.toward(art, k.hq(f), 6), 5, 7));
      k.point(k.landNear(a, (q) => dist(q, a) >= 1));
    },
  },
];

/**
 * Alle Missionen in Spielreihenfolge der Welten (WORLDS); act = Nummer der Welt (ab 1). Eine neue Mission braucht nur
 * ihre Daten in DEFS, ihre ID an der richtigen Stelle in WORLDS und ihre Texte.
 * All missions in the play order of the worlds (WORLDS); act = number of the world (from 1). A new mission only needs
 * its data in DEFS, its id at the right spot in WORLDS and its texts.
 */
export const MISSIONS: MissionDef[] = WORLDS.flatMap((w, wi) => w.missions.flatMap((id) => {
  const d = DEFS.find((x) => x.id === id);
  return d ? [{ ...d, act: wi + 1 }] : [];
}));
/** Missionsdaten ohne Platz in WORLDS (sollte leer sein) / mission data without a place in WORLDS (should be empty) */
export const UNPLACED_MISSIONS = DEFS.filter((d) => !WORLDS.some((w) => w.missions.includes(d.id))).map((d) => d.id);
/** Nummer der Welt (ab 1) einer Mission / number of the world (from 1) of a mission */
export const worldNumber = (id: string) => WORLDS.findIndex((w) => w.id === worldOf(id)) + 1;
/** Laufende Nummer eines Einsatzes in der Spielreihenfolge (ab 1, 0 = unbekannt) / running number of a mission in play order (from 1, 0 = unknown) */
export const missionNumber = (id: string, order: readonly string[] = MISSION_IDS) => order.indexOf(id) + 1;

export const MISSION_IDS = MISSIONS.map((m) => m.id);
export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
/** Letzte Mission (Finale) / last mission (finale) */
export const FINALE_ID = MISSION_IDS[MISSION_IDS.length - 1];

/** Spielkonfiguration einer Mission fuer eine Menschen-Fraktion / game configuration of a mission for a human faction */
export function missionConfig(id: string, faction: FactionId = CAMPAIGN_FACTIONS[0]): GameConfig {
  const m = missionById(id);
  if (!m) throw new Error(`unknown mission ${id}`);
  if (!isCampaignFaction(faction)) throw new Error(`not a campaign faction: ${faction}`);
  const ally = allyFor(id, faction);
  return {
    seed: m.seed, size: m.size, mapType: m.mapType, mode: 'conquest',
    factions: [
      { id: faction, human: true, difficulty: 'normal' },
      ...m.enemies.map((e) => ({ id: e.id, human: false, difficulty: e.difficulty })),
      ...(ally ? [{ id: ally, human: false, difficulty: 'normal' as Difficulty }] : []),
    ],
    startStars: m.startStars, roundLimit: null, weather: m.weather, hazards: m.hazards, events: m.events,
    // Fraktionssiege bleiben in Kampagnen aus / faction victories stay off in campaigns
    factionVictory: false,
    campaign: { mission: m.id },
    settlements: m.settlements ?? CAMPAIGN_SETTLEMENTS[m.theme ?? 'surface'],
    ...(m.theme ? { theme: m.theme } : {}),
  };
}

// ---------- Einrichtung / setup ----------

const PLAYER = 0;

/** Darf hier nichts entstehen (das Artefakt)? / may nothing appear here (the artifact)? */
export function spawnBlocked(s: GameState, q: Pos): boolean {
  const art = s.campaign?.artifact;
  return !!art && art.x === q.x && art.y === q.y;
}

/** Feld fuer eine Einheit von owner frei (keine fremde Stadt, nicht das Artefakt)? / tile free for a unit of owner (no foreign city, not the artifact)? */
function spawnOk(s: GameState, type: UnitTypeId, owner: number, q: Pos): boolean {
  if (!freeFor(s, type, q) || spawnBlocked(s, q)) return false;
  const c = cityAt(s, q.x, q.y);
  return !c || c.owner === owner;
}

/** Einheit nahe p aufstellen / place a unit near p */
function spawnNear(s: GameState, type: UnitTypeId, owner: number, near: Pos, carried: UnitTypeId | null, min: number): Unit | null {
  const p = nearestTile(s, near, (q) => dist(q, near) >= min && spawnOk(s, type, owner, q));
  if (!p) return null;
  // Spieler (am Zug) sofort bereit, andere ab ihrem Zug / player (to move) ready at once, others from their turn
  const u = placeUnit(s, type, owner, p.x, p.y, owner === s.current, carried);
  if (owner === PLAYER) revealArea(s, PLAYER, p.x, p.y, 1);
  return u;
}

function kit(s: GameState, c: CampaignState): SetupKit {
  const clamp = (v: number) => Math.max(0, Math.min(s.size - 1, v));
  return {
    s,
    hq: (f) => hqOf(s, f) ?? ownCities(s, f)[0],
    mid: (a, b) => ({ x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) }),
    toward: (a, b, n) => {
      const f = Math.min(1, n / Math.max(1, dist(a, b)));
      return { x: clamp(Math.round(a.x + (b.x - a.x) * f)), y: clamp(Math.round(a.y + (b.y - a.y) * f)) };
    },
    landNear: (p, extra) => nearestTile(s, p, (q) => {
      const t = tileAt(s, q.x, q.y)!;
      return isLand(t) && t.cityId === null && t.terrain !== 'mountain' && !t.volcano && !t.feature && !cityAt(s, q.x, q.y) && (!extra || extra(q));
    }) ?? p,
    spawn: (type, owner, near, opts = {}) => spawnNear(s, type, owner, near, opts.carried ?? null, opts.min ?? 0),
    grantNear: (owner, near, minDist = 0) => {
      const city = s.cities.filter((x) => x.owner === null && !x.tower && dist(x, near) >= minDist).sort((a, b) => dist(a, near) - dist(b, near) || a.id - b.id)[0];
      if (!city) return null;
      grantCity(s, city, owner);
      return city;
    },
    target: (p) => { c.targets.push({ x: p.x, y: p.y }); return c.targets.length - 1; },
    mark: (u) => { (c.units ??= []).push(u.id); return c.units.length - 1; },
    point: (p) => { (c.spawns ??= []).push({ x: p.x, y: p.y }); return c.spawns.length - 1; },
    portal: (p) => { c.portal = { x: p.x, y: p.y }; c.portalHold = 0; },
    upgrade: (city, id) => { if (!(city.upgrades ?? []).includes(id)) city.upgrades = [...(city.upgrades ?? []), id]; },
    ruin: (near) => placeRuin(s, c, near),
    caveMouth: (from) => {
      const p = placeCaveMouth(s, from);
      c.cave = p; c.caveHold = 0;
      c.targets.push({ x: p.x, y: p.y });
      for (const f of s.factions) revealArea(s, f.index, p.x, p.y, 1);
      return p;
    },
  };
}

/** Freies, flaches Land ohne Stadt, Merkmal, Geschuetz und Einheit / free flat land without city, feature, gun and unit */
function openLand(s: GameState, q: Pos): boolean {
  const t = tileAt(s, q.x, q.y);
  return !!t && isLand(t) && t.cityId === null && t.terrain !== 'mountain' && !t.volcano && !t.feature && !t.turret && !t.wonderOf && !unitAt(s, q.x, q.y);
}

/**
 * Ruinenstaette (m13) nahe near: Abstand zu Staedten und anderen Staetten (RUINS), Feld wird geraeumte Ebene; daneben
 * im Abstand RUINS.sentinelDistance eine schlafende Verdan-Wache (Geschuetz), die diese Staette bewacht.
 * Ruin site (m13) near near: distance to cities and other sites (RUINS), the tile becomes cleared plain; next to it at
 * distance RUINS.sentinelDistance a dormant Verdan sentinel (gun) guarding this site.
 */
function placeRuin(s: GameState, c: CampaignState, near: Pos): Pos | null {
  const sites = (c.sites ??= []);
  // nie naeher an der Wache einer anderen Staette als deren eigene Staette / never closer to another site's sentinel than its own site
  const guns = s.tiles.flatMap((t, k) => (t.turret ? [{ x: k % s.size, y: Math.floor(k / s.size) }] : []));
  const p = nearestTile(s, near, (q) => openLand(s, q) && s.cities.every((x) => dist(x, q) >= RUINS.cityDistance) && sites.every((o) => dist(o, q) >= RUINS.spacing) &&
    guns.every((g) => dist(g, q) > RUINS.sentinelDistance));
  if (!p) return null;
  Object.assign(tileAt(s, p.x, p.y)!, { terrain: 'plain', resource: null, building: null, road: false, mine: null, barrier: null, remains: null });
  sites.push({ x: p.x, y: p.y });
  (c.siteDone ??= []).push(false);
  // als Zielfeld markiert (Ring auf der Karte) / marked as a target tile (ring on the map)
  c.targets.push({ x: p.x, y: p.y });
  // Wache zur Kartenmitte hin, nie neben einer Stadt oder einem anderen Geschuetz / sentinel towards the map centre, never next to a city or another gun
  const mid = { x: Math.floor(s.size / 2), y: Math.floor(s.size / 2) };
  const want = { x: p.x + Math.sign(mid.x - p.x) * RUINS.sentinelDistance, y: p.y + Math.sign(mid.y - p.y) * RUINS.sentinelDistance };
  const g = nearestTile(s, want, (q) => dist(q, p) === RUINS.sentinelDistance && openLand(s, q) && sites.every((o) => o === sites[sites.length - 1] || dist(o, q) > RUINS.sentinelDistance) &&
    !neighbors(s.size, q.x, q.y).some((n) => { const o = tileAt(s, n.x, n.y)!; return o.cityId !== null || !!o.turret; }), RUINS.sentinelDistance * 2);
  if (g) Object.assign(tileAt(s, g.x, g.y)!, { turret: { hp: VERDAN.hp, active: false }, resource: null, building: null, road: false, mine: null, barrier: null });
  for (const f of s.factions) revealArea(s, f.index, p.x, p.y, 0);
  return p;
}

/**
 * Hoehleneingang (m14): freies Land nahe der Kartenmitte, mindestens 4 Felder von jedem Hauptquartier und nicht neben
 * einer Stadt; die drei Felder im Nordwesten werden zur Felswand (hoher Berg), sofern frei. So schaut der Schlund in
 * der Standardansicht zur Kamera; from bleibt fuer spaetere Einsaetze erhalten.
 * Cave entrance (m14): free land near the map centre, at least 4 tiles from every HQ and not next to a city; the
 * three tiles to the north-west become the rock wall (high mountain) where free. So the maw faces the camera in the
 * default view; from is kept for later missions.
 */
function placeCaveMouth(s: GameState, from: Pos): Pos {
  void from;
  const mid = { x: Math.floor(s.size / 2), y: Math.floor(s.size / 2) };
  const edge = (q: Pos) => q.x <= 1 || q.y <= 1 || q.x >= s.size - 2 || q.y >= s.size - 2;
  const back = [[-1, -1], [-1, 0], [0, -1]];
  // die Felswand braucht freie Felder (keine Stadt, kein Merkmal, keine Einheit) / the rock wall needs free tiles (no city, feature or unit)
  const wallFree = (q: Pos) => back.every(([dx, dy]) => { const t = tileAt(s, q.x + dx, q.y + dy); return !!t && t.cityId === null && !t.feature && !t.turret && !unitAt(s, q.x + dx, q.y + dy); });
  const p = nearestTile(s, mid, (q) => openLand(s, q) && !edge(q) && wallFree(q) && s.cities.filter((x) => x.isHQ).every((x) => dist(x, q) >= 4) &&
    !neighbors(s.size, q.x, q.y).some((n) => tileAt(s, n.x, n.y)!.cityId !== null)) ?? mid;
  Object.assign(tileAt(s, p.x, p.y)!, { terrain: 'plain', resource: null, building: null, road: false, mine: null, barrier: null, feature: null });
  for (const [dx, dy] of back) {
    const t = tileAt(s, p.x + dx, p.y + dy);
    if (!t || t.cityId !== null || t.feature || t.turret || unitAt(s, p.x + dx, p.y + dy)) continue;
    Object.assign(t, { terrain: 'mountain', peak: 3, building: null, road: false, river: false, mine: null, barrier: null, volcano: false });
    if (t.resource && t.resource !== 'ore') t.resource = null;
  }
  return p;
}

/** Anzahl Sendetuerme einer Mission / number of transmitter towers of a mission */
export function towerCount(m: MissionDef): number {
  if (m.towers !== undefined) return m.towers;
  if (m.theme === 'cavern') return 0;
  return Math.max(TOWER.min, Math.min(TOWER.max, Math.round((m.size * m.size) / TOWER.perTiles)));
}

/**
 * Sendetuerme verteilen: freies, flaches Land fern von Hauptquartieren, Staedten und einander; jeweils das Feld mit dem
 * groessten Mindestabstand zu Hauptquartieren und schon gesetzten Tuermen (bei Gleichstand der kleinste Index).
 * Rein deterministisch aus dem Spielstand.
 * Place transmitter towers: free flat land far from HQs, cities and each other; each time the tile with the largest
 * minimum distance to HQs and already placed towers (ties: lowest index). Purely deterministic from the state.
 */
function placeTowers(s: GameState, count: number) {
  const hqs = s.cities.filter((x) => x.isHQ);
  const placed: Pos[] = [];
  for (let i = 0; i < count; i++) {
    let best: Pos | null = null, bestD = -1;
    for (let y = 1; y < s.size - 1; y++) for (let x = 1; x < s.size - 1; x++) {
      const q = { x, y };
      const t = tileAt(s, x, y)!;
      if (!openLand(s, q) || t.terrain !== 'plain' || t.turret) continue;
      if (hqs.some((h) => dist(h, q) < TOWER.hqDistance) || s.cities.some((c) => dist(c, q) < TOWER.cityDistance)) continue;
      if (placed.some((p) => dist(p, q) < TOWER.spacing)) continue;
      if (s.campaign?.sites?.some((p) => dist(p, q) < 2) || (s.campaign?.cave && dist(s.campaign.cave, q) < 2)) continue;
      if (s.campaign?.portal && dist(s.campaign.portal, q) < 2) continue;
      const d = Math.min(...hqs.map((h) => dist(h, q)), ...placed.map((p) => dist(p, q) * 1.5));
      if (d > bestD) { bestD = d; best = q; }
    }
    if (!best) break;
    placed.push(best);
    const c: City = {
      id: s.nextId++, x: best.x, y: best.y, owner: null, level: 1, pop: 0, radius: CITY.baseRadius, isHQ: false, hqOf: null, factory: false,
      bunkerRing: false, govQuarter: false, connected: false, noIncomeNext: false, nameIndex: s.cities.length, tower: true,
    };
    s.cities.push(c);
    Object.assign(tileAt(s, best.x, best.y)!, { cityId: c.id, resource: null, feature: null, road: false, building: null });
  }
}

/** Artefakt: freies Landfeld nahe der Kartenmitte / artifact: free land tile near the map centre */
function placeArtifact(s: GameState): Pos {
  const mid = { x: Math.floor(s.size / 2), y: Math.floor(s.size / 2) };
  const p = nearestTile(s, mid, (q) => {
    const t = tileAt(s, q.x, q.y)!;
    return isLand(t) && t.cityId === null && t.terrain !== 'mountain' && !t.volcano && !unitAt(s, q.x, q.y) && !t.wonderOf &&
      !neighbors(s.size, q.x, q.y).some((n) => tileAt(s, n.x, n.y)!.cityId !== null);
  }) ?? mid;
  const t = tileAt(s, p.x, p.y)!;
  Object.assign(t, { feature: null, resource: null, building: null, terrain: 'plain', mine: null, barrier: null });
  if (t.biome === 'jungle') t.biome = 'grassland';
  // ein Leuchtfeuer, das alle sehen / a beacon everyone sees
  for (const f of s.factions) revealArea(s, f.index, p.x, p.y, 1);
  return p;
}

/**
 * Verdan-Verteidigungslinie: Geschuetze gleichmaessig im Ring um das Artefakt, auf freiem, flachem Land.
 * Verdan defence line: guns spread evenly on a ring around the artifact, on free flat land.
 */
function placeTurrets(s: GameState, art: Pos) {
  const R = VERDAN.ringDistance;
  const ok = (q: Pos) => {
    const t = tileAt(s, q.x, q.y);
    const d = dist(q, art);
    return !!t && d >= R && d <= R + 1 && isLand(t) && t.cityId === null && !t.feature && !t.volcano && !t.turret && !t.wonderOf &&
      !unitAt(s, q.x, q.y) && !neighbors(s.size, q.x, q.y).some((n) => { const o = tileAt(s, n.x, n.y)!; return o.cityId !== null || !!o.turret; });
  };
  for (let i = 0; i < VERDAN.count; i++) {
    const a = (i / VERDAN.count) * Math.PI * 2 + Math.PI / 12;
    const want = { x: Math.round(art.x + Math.cos(a) * R), y: Math.round(art.y + Math.sin(a) * R) };
    const p = nearestTile(s, want, ok, 3);
    if (!p) continue;
    const t = tileAt(s, p.x, p.y)!;
    Object.assign(t, { turret: { hp: VERDAN.hp, active: false }, resource: null, building: null, road: false, mine: null, barrier: null });
  }
}

/**
 * Wendet die Einrichtung einer Mission auf ein frisch erzeugtes Spiel an (aufgerufen von createGame).
 * Applies a mission's setup to a freshly created game (called by createGame).
 */
export function setupMission(s: GameState) {
  const id = s.config.campaign?.mission;
  const m = id ? missionById(id) : undefined;
  if (!m) return;
  const allies = s.factions.filter((f) => f.index > m.enemies.length).map((f) => f.index);
  const c: CampaignState = {
    mission: m.id, targets: [], status: m.objectives.map(() => 'pending'), bonus: m.bonus.map(() => 'pending'),
    startCities: [], result: null, stars: 0, rev: CAMPAIGN_REV, units: [], spawns: [], waves: 0, allies,
  };
  s.campaign = c;
  // Heimatwelt der Zyrr: alles Land und Flachwasser ist Xeno-Boden / Zyrr homeworld: all land and shallow water is xeno ground
  if (m.theme === 'alien') for (const t of s.tiles) if (t.terrain !== 'ocean') t.xeno = true;
  if (m.landing) c.landing = true;
  if (m.artifact) { c.artifact = placeArtifact(s); c.hold = { faction: null, n: 0 }; }
  if (m.turrets && c.artifact) placeTurrets(s, c.artifact);
  const k = kit(s, c);
  m.setup?.(k);
  // Sendetuerme nach der Einrichtung, damit sie nie Einrichtungsziele verdraengen / transmitter towers after the setup so they never displace setup targets
  placeTowers(s, towerCount(m));
  for (const [a, b] of m.allied ?? []) {
    if (!s.factions[a] || !s.factions[b]) continue;
    s.factions[a].relations[b] = 'peace';
    s.factions[b].relations[a] = 'peace';
  }
  // Verbuendete: Frieden mit dem Spieler, Krieg mit den Gegnern, Kontakt und eine Verstaerkung / allies: peace with the player, war with the enemies, contact and one extra unit
  for (const i of allies) {
    s.factions[i].relations[PLAYER] = 'peace';
    s.factions[PLAYER].relations[i] = 'peace';
    for (const f of [s.factions[i], s.factions[PLAYER]]) {
      const other = f.index === i ? PLAYER : i;
      if (!f.contacts.includes(other)) f.contacts.push(other);
    }
    k.spawn('infantry', i, k.hq(i));
    const h = k.hq(i);
    if (h) revealArea(s, PLAYER, h.x, h.y, 1);
  }
  shareVision(s, c);
  c.startCities = ownCities(s, PLAYER).map((x) => x.id);
}

/** Geteilte Karte: der Spieler kennt alles, was seine Verbuendeten kennen / shared map: the player knows what its allies know */
function shareVision(s: GameState, c: CampaignState) {
  const me = s.factions[PLAYER].explored;
  for (const i of c.allies ?? []) {
    const ex = s.factions[i]?.explored;
    if (!ex) continue;
    for (let k = 0; k < ex.length; k++) if (ex[k] && !me[k] && s.tiles[k].feature !== 'radar') me[k] = 1;
  }
}

/**
 * Landetrupp ohne Stadt, aber mit Einheiten: noch nicht ausgeschieden (nur der Spieler, bis zur ersten eigenen Stadt).
 * Landing party without a city but with units: not eliminated yet (player only, until the first own city).
 */
export function landingPartyHolds(s: GameState, f: number): boolean {
  return f === PLAYER && !!s.campaign?.landing && !s.campaign.result && s.units.some((u) => u.owner === PLAYER);
}

/** Verbuendeter des Spielers in dieser Kampagnenpartie? / ally of the player in this campaign game? */
export const isCampaignAlly = (s: GameState, f: number) => !!s.campaign?.allies?.includes(f);

/**
 * Faellige Wellen eintreffen lassen (zu Beginn des Spielerzugs). Reine Funktion des Spielstands.
 * Let due waves arrive (at the start of the player's turn). Pure function of the state.
 */
function runWaves(s: GameState, c: CampaignState, m: MissionDef, ev: GameEvent[]) {
  const waves = m.waves ?? [];
  let done = c.waves ?? 0;
  while (done < waves.length && waves[done].round <= s.round) {
    const w = waves[done++];
    const at = c.spawns?.[w.at];
    const fa = s.factions[w.owner];
    if (!at || !fa?.alive) continue;
    let count = 0;
    for (const type of w.units) if (spawnNear(s, type, w.owner, at, null, 0)) count++;
    if (!count) continue;
    fa.stars += w.stars ?? 0;
    // der Spieler sieht die Ankunft / the player sees the arrival
    revealArea(s, PLAYER, at.x, at.y, 1);
    ev.push({ t: 'wave', faction: w.owner, count, x: at.x, y: at.y });
  }
  c.waves = done;
}

/**
 * Gehoert die Einheit oder Stadt dem Spieler oder seinem Kampagnen-Verbuendeten? Ziele zaehlen fuer beide, damit ein
 * Verbuendeter, der zuerst zugreift, den Einsatz nicht blockiert.
 * Does the unit or city belong to the player or the campaign ally? Objectives count for both, so an ally that grabs
 * first does not block the mission.
 */
const friendly = (s: GameState, owner: number | null | undefined) => owner === PLAYER || (owner !== null && owner !== undefined && isCampaignAlly(s, owner));

/** Besetzt der Spieler das Portal? Zaehlt die Runden in Folge (zu Beginn des Spielerzugs) / does the player occupy the portal? counts consecutive rounds */
function countPortal(s: GameState, c: CampaignState) {
  const p = c.portal;
  if (!p) return;
  c.portalHold = friendly(s, unitAt(s, p.x, p.y)?.owner) ? (c.portalHold ?? 0) + 1 : 0;
}

/** Hoehleneingang besetzt? Runden in Folge (zu Beginn des Spielerzugs) / cave entrance occupied? consecutive rounds (start of the player's turn) */
function countCave(s: GameState, c: CampaignState) {
  const p = c.cave;
  if (!p) return;
  c.caveHold = friendly(s, unitAt(s, p.x, p.y)?.owner) ? (c.caveHold ?? 0) + 1 : 0;
}

/** Ruinenstaetten entziffern (zu Beginn des Spielerzugs) / decipher ruin sites (at the start of the player's turn) */
function countRuins(s: GameState, c: CampaignState, ev: GameEvent[]) {
  (c.sites ?? []).forEach((p, i) => {
    if (c.siteDone?.[i]) return;
    const u = unitAt(s, p.x, p.y);
    if (!u || !friendly(s, u.owner)) return;
    (c.siteDone ??= [])[i] = true;
    ev.push({ t: 'ruin', index: i, x: p.x, y: p.y, faction: u.owner });
  });
}

/**
 * Riss (m11): verschont den Endgegner vor dem Tod; true, wenn u der markierte Endgegner einer Riss-Mission ist.
 * Rift (m11): spares the boss from death; true if u is the marked boss of a rift mission.
 */
export function riftSpares(s: GameState, u: Unit): boolean {
  const c = s.campaign;
  if (!c || c.result || !c.units?.length) return false;
  return !!missionById(c.mission)?.rift && c.units[0] === u.id;
}

/**
 * Endgegner auftauchen lassen: sobald eine Spielereinheit nahe am Zielfeld steht oder ab SWARM_MOTHER.emergeRound
 * (zu Beginn des Spielerzugs). Er wird als Zieleinheit markiert; Schrei und Brut sind in seinem ersten Zug bereit.
 * Let the boss emerge: once a player unit stands close to the target tile or from SWARM_MOTHER.emergeRound
 * (at the start of the player's turn). It is marked as the target unit; scream and brood are ready on its first turn.
 */
function bossEmerge(s: GameState, c: CampaignState, m: MissionDef, ev: GameEvent[], turnChange: boolean) {
  const b = m.boss;
  if (!b || c.bossRound !== undefined || s.over) return;
  const at = c.targets[b.at];
  const owner = s.factions[b.owner];
  if (!at || !owner?.alive) return;
  const near = s.units.some((u) => u.owner === PLAYER && dist(u, at) <= SWARM_MOTHER.emergeRange);
  const late = turnChange && s.current === PLAYER && s.round >= SWARM_MOTHER.emergeRound;
  if (!near && !late) return;
  const p = nearestTile(s, at, (q) => spawnOk(s, b.unit, b.owner, q));
  if (!p) return;
  const u = placeUnit(s, b.unit, b.owner, p.x, p.y, b.owner === s.current);
  u.boss = { scream: s.round, brood: s.round };
  c.bossRound = s.round;
  (c.units ??= []).push(u.id);
  revealArea(s, PLAYER, p.x, p.y, 2);
  ev.push({ t: 'boss', what: 'emerge', unit: u.id, faction: b.owner, x: p.x, y: p.y });
}

/** Wer besetzt das Artefakt? Zaehlt die Runden in Folge (zu Beginn des Spielerzugs) / who occupies the artifact? counts consecutive rounds (at the start of the player's turn) */
function countArtifact(s: GameState, c: CampaignState) {
  const p = c.artifact;
  if (!p) return;
  const u = unitAt(s, p.x, p.y);
  const holder = u ? u.owner : null;
  const prev = c.hold ?? { faction: null, n: 0 };
  c.hold = holder === null ? { faction: null, n: 0 } : { faction: holder, n: prev.faction === holder ? prev.n + 1 : 1 };
}

// ---------- Auswertung / evaluation ----------

function hostileAt(s: GameState, p: Pos): boolean {
  return s.units.some((u) => u.x === p.x && u.y === p.y && u.owner !== PLAYER && isHostile(s, PLAYER, u.owner));
}

/**
 * Neuer Status eines Ziels. turnChange = Auswertung direkt nach einem Zugwechsel.
 * New status of an objective. turnChange = evaluation right after a turn change.
 */
function check(s: GameState, c: CampaignState, o: ObjectiveDef, prev: ObjectiveStatus, ev: GameEvent[], turnChange: boolean): ObjectiveStatus {
  if (prev !== 'pending') return prev;
  const fa = s.factions[PLAYER];
  const tgt = (i: number) => c.targets[i];
  switch (o.k) {
    case 'holdHq': case 'keepHq': return hqOf(s, PLAYER) ? 'pending' : 'failed';
    case 'holdCities': case 'noCityLost': return c.startCities.every((id) => s.cities.find((x) => x.id === id)?.owner === PLAYER) ? 'pending' : 'failed';
    case 'survive': return fa.alive ? 'pending' : 'failed';
    case 'holdTile': {
      const p = tgt(o.target);
      return p && turnChange && s.current === PLAYER && hostileAt(s, p) ? 'failed' : 'pending';
    }
    case 'capture': {
      const p = tgt(o.target);
      return p && friendly(s, cityAt(s, p.x, p.y)?.owner) ? 'done' : 'pending';
    }
    case 'salvage': {
      const p = tgt(o.target);
      if (!p) return 'pending';
      for (const e of ev) if (e.t === 'salvage' && e.x === p.x && e.y === p.y) return friendly(s, e.faction) ? 'done' : 'failed';
      return tileAt(s, p.x, p.y)!.looted ? 'failed' : 'pending';
    }
    case 'cities': return ownCities(s, PLAYER).length >= o.n ? 'done' : 'pending';
    case 'points': return score(s, PLAYER) >= o.n ? 'done' : 'pending';
    case 'kills': return fa.kills >= o.n ? 'done' : 'pending';
    case 'eliminate': return s.factions[o.faction] && !s.factions[o.faction].alive ? 'done' : 'pending';
    case 'destroyUnit': {
      const id = c.units?.[o.unit];
      return id !== undefined && !s.units.some((u) => u.id === id) ? 'done' : 'pending';
    }
    case 'artifact': {
      const h = c.hold;
      if (!h || h.faction === null || h.n < o.rounds) return 'pending';
      if (h.faction === PLAYER) return 'done';
      return isHostile(s, PLAYER, h.faction) ? 'failed' : 'pending';
    }
    case 'portal': return (c.portalHold ?? 0) >= o.rounds ? 'done' : 'pending';
    case 'cave': return (c.caveHold ?? 0) >= o.rounds ? 'done' : 'pending';
    case 'ruins': return (c.siteDone ?? []).filter(Boolean).length >= o.n ? 'done' : 'pending';
    case 'rift': {
      const id = c.units?.[o.unit];
      const u = id !== undefined ? s.units.find((x) => x.id === id) : undefined;
      return u && u.hp <= SWARM_MOTHER.riftHp ? 'done' : 'pending';
    }
    case 'reach': {
      const p = tgt(o.target);
      return p && s.units.some((u) => friendly(s, u.owner) && dist(u, p) <= o.range) ? 'done' : 'pending';
    }
    case 'fast': return s.round > o.rounds ? 'failed' : 'pending';
  }
}

/** Fortschritt eines Ziels als Zahlenpaar (fuer die Anzeige) / progress of an objective as a pair (for display) */
export function objectiveProgress(s: GameState, o: ObjectiveDef, rounds: number): { have: number; need: number } | null {
  switch (o.k) {
    case 'cities': return { have: ownCities(s, PLAYER).length, need: o.n };
    case 'points': return { have: score(s, PLAYER), need: o.n };
    case 'kills': return { have: s.factions[PLAYER].kills, need: o.n };
    case 'fast': return { have: Math.min(s.round, o.rounds), need: o.rounds };
    case 'holdHq': case 'holdCities': case 'survive': case 'holdTile': return { have: Math.min(s.round, rounds), need: rounds };
    case 'artifact': {
      const h = s.campaign?.hold;
      return { have: h && h.faction === PLAYER ? Math.min(h.n, o.rounds) : 0, need: o.rounds };
    }
    case 'portal': return { have: Math.min(s.campaign?.portalHold ?? 0, o.rounds), need: o.rounds };
    case 'cave': return { have: Math.min(s.campaign?.caveHold ?? 0, o.rounds), need: o.rounds };
    case 'ruins': return { have: Math.min((s.campaign?.siteDone ?? []).filter(Boolean).length, o.n), need: o.n };
    case 'rift': {
      const id = s.campaign?.units?.[o.unit];
      const u = s.units.find((x) => x.id === id);
      const need = u ? u.maxHp - SWARM_MOTHER.riftHp : 0;
      return u ? { have: Math.min(need, u.maxHp - u.hp), need } : null;
    }
    case 'destroyUnit': {
      const id = s.campaign?.units?.[o.unit];
      const u = s.units.find((x) => x.id === id);
      return u ? { have: u.maxHp - u.hp, need: u.maxHp } : null;
    }
    default: return null;
  }
}

/**
 * Ziele auswerten und die Mission ggf. beenden. Wird von applyCommand nach jedem gelungenen Kommando
 * aufgerufen (turnChange = true nach Zugende). Reine Funktion des Spielstands und der Ereignisse.
 * Evaluate objectives and end the mission if decided. Called by applyCommand after every successful
 * command (turnChange = true after an end of turn). Pure function of the state and the events.
 */
export function evaluateCampaign(s: GameState, ev: GameEvent[], turnChange: boolean) {
  const c = s.campaign;
  if (!c || c.result) return;
  const m = missionById(c.mission);
  if (!m) return;
  // Zu Beginn des Spielerzugs: Wellen, Artefakt, Portal, Hoehle und Ruinen zaehlen. Nach dem Rundenlimit zaehlt nichts mehr:
  // die Mission endet dann am Limit, ein Halten-Sieg faellt nie eine Runde zu spaet.
  // At the start of the player's turn: waves, count artifact, portal, cave and ruins. After the round limit nothing counts
  // any more: the mission then ends at the limit, a hold win never lands one round late.
  const expired = s.round > m.rounds;
  if (turnChange && s.current === PLAYER && !s.over && !expired) {
    runWaves(s, c, m, ev);
    countArtifact(s, c);
    countPortal(s, c);
    countCave(s, c);
    countRuins(s, c, ev);
  }
  bossEmerge(s, c, m, ev, turnChange);
  // Landetrupp: mit der ersten eigenen Stadt gelten die normalen Regeln / landing party: the first own city brings back the normal rules
  if (c.landing && ownCities(s, PLAYER).length) c.landing = false;
  if (turnChange) shareVision(s, c);
  const update = (list: ObjectiveStatus[], defs: ObjectiveDef[], bonus: boolean) => {
    defs.forEach((o, i) => {
      const next = check(s, c, o, list[i], ev, turnChange);
      if (next !== list[i]) { list[i] = next; ev.push({ t: 'objective', index: i, bonus, status: next }); }
    });
  };
  update(c.status, m.objectives, false);
  update(c.bonus, m.bonus, true);
  // Riss: die Schwarmmutter am Rand des Todes reisst den Raum auf / rift: the Swarm Mother at death's door tears space open
  const ri = m.objectives.findIndex((o) => o.k === 'rift');
  const ro = m.objectives[ri];
  if (ro && ro.k === 'rift' && c.status[ri] === 'done' && !c.rift) {
    const boss = s.units.find((u) => u.id === c.units?.[ro.unit]);
    if (boss) {
      c.rift = { x: boss.x, y: boss.y, round: s.round };
      ev.push({ t: 'rift', unit: boss.id, x: boss.x, y: boss.y });
    }
  }

  const player = s.factions[PLAYER];
  // Verbuendete zaehlen nicht als Gegner / allies do not count as enemies
  const enemiesAlive = s.factions.some((f) => f.index !== PLAYER && f.alive && !isCampaignAlly(s, f.index));
  const achieve = m.objectives.map((o, i) => ({ o, i })).filter((x) => !isHoldObjective(x.o));
  let result: 'won' | 'lost' | null = null;
  // Landetrupp aufgerieben: keine Stadt, keine Einheit / landing party wiped out: no city, no unit
  const wiped = !!c.landing && !s.units.some((u) => u.owner === PLAYER);
  if (!player.alive || wiped || c.status.includes('failed')) result = 'lost';
  else if (!enemiesAlive) result = 'won';
  else if (achieve.length && achieve.every((x) => c.status[x.i] === 'done')) result = 'won';
  else if (s.round > m.rounds) result = achieve.length ? 'lost' : 'won';
  if (!result) return;

  // offene Ziele abschliessen / close open objectives
  const close = (list: ObjectiveStatus[], defs: ObjectiveDef[], bonus: boolean) => {
    defs.forEach((o, i) => {
      if (list[i] !== 'pending') return;
      // Sieg: offene Hauptziele gelten als erfuellt (auch beim Sieg, weil kein Gegner mehr lebt) / win: open primary objectives count as met (also when no enemy is left)
      const done = result === 'won' && (!bonus || isHoldObjective(o) || o.k === 'keepHq' || o.k === 'noCityLost' || (o.k === 'fast' && s.round <= o.rounds));
      list[i] = done ? 'done' : 'failed';
      ev.push({ t: 'objective', index: i, bonus, status: list[i] });
    });
  };
  close(c.status, m.objectives, false);
  close(c.bonus, m.bonus, true);
  c.result = result;
  c.stars = result === 'won' ? 1 + c.bonus.filter((b) => b === 'done').length : 0;
  // Sieger bei Niederlage: wer das Artefakt hielt, sonst der erste lebende Gegner / winner on defeat: the artifact holder, else the first living enemy
  const holder = c.hold?.faction ?? null;
  const enemyWinner = holder !== null && holder !== PLAYER && isHostile(s, PLAYER, holder) && c.status.includes('failed') && m.objectives.some((o) => o.k === 'artifact')
    ? holder
    : (s.factions.find((f) => f.index !== PLAYER && f.alive && !isCampaignAlly(s, f.index))?.index ?? null);
  const winner = result === 'won' ? PLAYER : enemyWinner;
  if (!s.over) {
    s.over = true;
    s.winner = winner;
    ev.push({ t: 'gameOver', winner });
  } else s.winner = winner;
}

/** Runden bis zum Missionsende / rounds until the end of the mission */
export function missionRoundsLeft(s: GameState): number | null {
  const m = s.campaign ? missionById(s.campaign.mission) : undefined;
  return m ? Math.max(0, m.rounds - s.round + 1) : null;
}
