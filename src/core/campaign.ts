/**
 * Kampagne: Missionen als Daten (Karte, Fraktionen, Einrichtung, Ziele) und die deterministische
 * Auswertung der Ziele nach jedem Kommando und jedem Zugwechsel.
 * Campaign: missions as data (map, factions, setup, objectives) and the deterministic evaluation of
 * the objectives after every command and every turn change.
 *
 * Der Spieler ist immer Fraktion 0. "Halten"-Ziele gelten bis zum Missionsende (Rundenlimit) oder bis
 * alle "Erreichen"-Ziele erfuellt sind; "Erreichen"-Ziele muessen vor dem Rundenlimit erfuellt sein.
 * The player is always faction 0. "Hold" objectives last until the end of the mission (round limit) or
 * until all "achieve" objectives are met; "achieve" objectives must be met before the round limit.
 */
import type { Difficulty, FactionId, HazardLevel, MapSize, MapType, UnitTypeId } from '../data/balance';
import { dist, isLand, neighbors, tileAt } from './grid';
import { cityAt, hqOf, isHostile, ownCities, score } from './queries';
import { freeFor, grantCity, nearestTile, placeUnit, revealArea } from './spawn';
import type { CampaignState, City, GameConfig, GameEvent, GameState, ObjectiveStatus, Pos } from './types';

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
  // nur Bonus / bonus only
  | { k: 'fast'; rounds: number }
  | { k: 'keepHq' }
  | { k: 'noCityLost' };

const HOLD_KINDS = new Set(['holdHq', 'holdCities', 'survive', 'holdTile']);
/** Halten-Ziel? / hold objective? */
export const isHoldObjective = (o: ObjectiveDef) => HOLD_KINDS.has(o.k);

/** Sprecher eines Comic-Panels / speaker of a comic panel */
export type Speaker = 'hq' | 'enemy' | 'scout';

/** Werkzeuge fuer die Einrichtung / setup toolkit */
export interface SetupKit {
  s: GameState;
  hq(f: number): City;
  mid(a: Pos, b: Pos): Pos;
  /** naechstes freies Landfeld (ohne Stadt, ohne Berg) / nearest free land tile (no city, no mountain) */
  landNear(p: Pos, extra?: (q: Pos) => boolean): Pos;
  spawn(type: UnitTypeId, owner: number, near: Pos, carried?: UnitTypeId | null): void;
  /** naechste neutrale Siedlung an eine Fraktion / nearest neutral settlement to a faction */
  grantNear(owner: number, near: Pos, minDist?: number): City | null;
  target(p: Pos): number;
}

export interface MissionDef {
  id: string;
  faction: FactionId;
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
  /** Comic-Panels der Einsatzbesprechung / comic panels of the briefing */
  briefing: Speaker[];
  /** Gegner untereinander im Frieden / enemies at peace with each other */
  alliedEnemies?: boolean;
  setup?(k: SetupKit): void;
}

// ---------- Missionen / missions ----------

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1', faction: 'korvat', enemies: [{ id: 'dravon', difficulty: 'easy' }],
    seed: 1101, size: 11, mapType: 'continent', hazards: 'none', weather: true, events: false, startStars: 30, rounds: 14,
    objectives: [{ k: 'cities', n: 3 }], bonus: [{ k: 'fast', rounds: 9 }, { k: 'keepHq' }],
    briefing: ['hq', 'hq', 'enemy'],
    setup(k) { k.spawn('infantry', 0, k.hq(0)); },
  },
  {
    id: 'm2', faction: 'velkar', enemies: [{ id: 'dravon', difficulty: 'easy' }],
    seed: 2202, size: 14, mapType: 'continent', hazards: 'normal', weather: true, events: false, startStars: 25, rounds: 12,
    objectives: [{ k: 'holdTile', target: 0 }, { k: 'holdHq' }], bonus: [{ k: 'kills', n: 4 }, { k: 'noCityLost' }],
    briefing: ['hq', 'scout', 'enemy'],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      const pass = k.landNear(k.mid(a, b));
      k.target(pass);
      // Vulkan zwei Felder neben dem Pass / volcano two tiles next to the pass
      const v = nearestTile(k.s, pass, (q) => {
        const t = tileAt(k.s, q.x, q.y)!;
        return dist(q, pass) === 2 && isLand(t) && t.cityId === null && !t.feature && dist(q, a) > 2 && dist(q, b) > 2 &&
          !neighbors(k.s.size, q.x, q.y).some((n) => tileAt(k.s, n.x, n.y)!.cityId !== null);
      }, 2);
      if (v) Object.assign(tileAt(k.s, v.x, v.y)!, { terrain: 'mountain', volcano: true, peak: 3, resource: null, building: null, road: false });
      k.spawn('infantry', 0, pass); k.spawn('mg', 0, pass); k.spawn('infantry', 0, pass);
      k.spawn('infantry', 1, k.mid(pass, b)); k.spawn('jeep', 1, k.mid(pass, b)); k.spawn('infantry', 1, k.mid(pass, b));
      revealArea(k.s, 0, pass.x, pass.y, 2);
    },
  },
  {
    id: 'm3', faction: 'meridon', enemies: [{ id: 'alvenia', difficulty: 'normal' }],
    seed: 3303, size: 14, mapType: 'continents', hazards: 'none', weather: true, events: false, startStars: 30, rounds: 15,
    objectives: [{ k: 'holdCities' }], bonus: [{ k: 'kills', n: 5 }, { k: 'cities', n: 5 }],
    briefing: ['hq', 'scout', 'hq'],
    setup(k) {
      const a = k.hq(0);
      k.grantNear(0, a); k.grantNear(0, a);
      k.spawn('mg', 0, a); k.spawn('artillery', 0, a);
      // Landungsflotte vor der eigenen Kueste / landing fleet off the own coast
      const water = (q: Pos) => freeFor(k.s, 'landingBoat', q) && dist(q, a) >= 2;
      for (let i = 0; i < 2; i++) { const p = nearestTile(k.s, a, water); if (p) placeUnit(k.s, 'landingBoat', 1, p.x, p.y, false, 'infantry'); }
      const d = nearestTile(k.s, a, (q) => freeFor(k.s, 'destroyer', q) && dist(q, a) >= 3);
      if (d) placeUnit(k.s, 'destroyer', 1, d.x, d.y, false, 'infantry');
      k.spawn('infantry', 1, k.hq(1)); k.spawn('tank', 1, k.hq(1));
    },
  },
  {
    id: 'm4', faction: 'alvenia', enemies: [{ id: 'zyrr', difficulty: 'normal' }],
    seed: 4404, size: 14, mapType: 'continent', hazards: 'none', weather: true, events: false, startStars: 25, rounds: 10,
    objectives: [{ k: 'salvage', target: 0 }], bonus: [{ k: 'fast', rounds: 6 }, { k: 'noCityLost' }],
    briefing: ['scout', 'hq', 'enemy'],
    setup(k) {
      const a = k.hq(0), b = k.hq(1);
      const site = k.landNear(k.mid(a, b), (q) => !neighbors(k.s.size, q.x, q.y).some((n) => tileAt(k.s, n.x, n.y)!.cityId !== null));
      Object.assign(tileAt(k.s, site.x, site.y)!, { feature: 'crashSite', terrain: 'plain', resource: null, building: null, looted: false });
      k.target(site);
      k.spawn('jeep', 0, a);
      k.spawn('skimmer', 1, b);
      revealArea(k.s, 0, site.x, site.y, 1);
    },
  },
  {
    id: 'm5', faction: 'dravon', enemies: [{ id: 'vesper', difficulty: 'normal' }],
    seed: 5505, size: 14, mapType: 'lakes', hazards: 'normal', weather: true, events: false, startStars: 30, rounds: 25,
    objectives: [{ k: 'capture', target: 0 }], bonus: [{ k: 'fast', rounds: 18 }, { k: 'keepHq' }],
    briefing: ['hq', 'enemy', 'hq'],
    setup(k) {
      const b = k.hq(1);
      k.target(b);
      k.spawn('jeep', 0, k.hq(0)); k.spawn('infantry', 0, k.hq(0));
      k.spawn('zealot', 1, b); k.spawn('zealot', 1, b);
      revealArea(k.s, 0, b.x, b.y, 1);
    },
  },
  {
    id: 'm6', faction: 'korvat', enemies: [{ id: 'nexus', difficulty: 'normal' }],
    seed: 6606, size: 14, mapType: 'continent', hazards: 'none', weather: true, events: false, startStars: 30, rounds: 20,
    objectives: [{ k: 'capture', target: 0 }, { k: 'capture', target: 1 }], bonus: [{ k: 'kills', n: 6 }, { k: 'fast', rounds: 14 }],
    briefing: ['scout', 'enemy', 'hq'],
    setup(k) {
      const a = k.hq(0);
      for (let i = 0; i < 2; i++) {
        const c = k.grantNear(1, a, 3);
        if (!c) continue;
        k.target(c);
        k.spawn('android', 1, c);
        revealArea(k.s, 0, c.x, c.y, 1);
      }
      k.spawn('infantry', 0, a); k.spawn('mg', 0, a);
    },
  },
  {
    id: 'm7', faction: 'vesper', enemies: [{ id: 'meridon', difficulty: 'normal' }, { id: 'velkar', difficulty: 'easy' }],
    seed: 7707, size: 16, mapType: 'continents', hazards: 'normal', weather: true, events: true, startStars: 30, rounds: 22,
    objectives: [{ k: 'points', n: 3000 }], bonus: [{ k: 'cities', n: 5 }, { k: 'noCityLost' }],
    briefing: ['hq', 'hq', 'enemy'],
    setup(k) { k.spawn('zealot', 0, k.hq(0)); },
  },
  {
    id: 'm8', faction: 'zyrr', enemies: [{ id: 'korvat', difficulty: 'normal' }],
    seed: 8808, size: 14, mapType: 'continent', hazards: 'normal', weather: true, events: true, startStars: 30, rounds: 20,
    objectives: [{ k: 'kills', n: 8 }], bonus: [{ k: 'capture', target: 0 }, { k: 'fast', rounds: 14 }],
    briefing: ['hq', 'enemy', 'hq'],
    setup(k) {
      const b = k.hq(1);
      k.target(b);
      k.spawn('skimmer', 0, k.hq(0)); k.spawn('grey', 0, k.hq(0));
      k.spawn('infantry', 1, b); k.spawn('mg', 1, b);
    },
  },
  {
    id: 'm9', faction: 'dravon', enemies: [{ id: 'zyrr', difficulty: 'hard' }, { id: 'nexus', difficulty: 'normal' }],
    seed: 9909, size: 14, mapType: 'continent', hazards: 'many', weather: true, events: true, startStars: 35, rounds: 15,
    objectives: [{ k: 'holdHq' }, { k: 'survive' }], bonus: [{ k: 'kills', n: 6 }, { k: 'noCityLost' }],
    briefing: ['scout', 'enemy', 'hq'], alliedEnemies: true,
    setup(k) {
      const a = k.hq(0);
      a.upgrades = [...(a.upgrades ?? []), 'bunker'];
      k.spawn('mg', 0, a); k.spawn('mg', 0, a); k.spawn('infantry', 0, a);
      // Vorhut der Invasion / invasion vanguard
      const front = nearestTile(k.s, a, (q) => dist(q, a) === 4 && freeFor(k.s, 'grey', q)) ?? k.mid(a, k.hq(1));
      k.spawn('grey', 1, front); k.spawn('grey', 1, front); k.spawn('skimmer', 1, front);
    },
  },
];

export const MISSION_IDS = MISSIONS.map((m) => m.id);
export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);

/** Spielkonfiguration einer Mission / game configuration of a mission */
export function missionConfig(id: string): GameConfig {
  const m = missionById(id);
  if (!m) throw new Error(`unknown mission ${id}`);
  return {
    seed: m.seed, size: m.size, mapType: m.mapType, mode: 'conquest',
    factions: [{ id: m.faction, human: true, difficulty: 'normal' }, ...m.enemies.map((e) => ({ id: e.id, human: false, difficulty: e.difficulty }))],
    startStars: m.startStars, roundLimit: null, weather: m.weather, hazards: m.hazards, events: m.events,
    campaign: { mission: m.id },
  };
}

// ---------- Einrichtung / setup ----------

function kit(s: GameState, c: CampaignState): SetupKit {
  const k: SetupKit = {
    s,
    hq: (f) => hqOf(s, f) ?? ownCities(s, f)[0],
    mid: (a, b) => ({ x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) }),
    landNear: (p, extra) => nearestTile(s, p, (q) => {
      const t = tileAt(s, q.x, q.y)!;
      return isLand(t) && t.cityId === null && t.terrain !== 'mountain' && !t.volcano && !t.feature && !cityAt(s, q.x, q.y) && (!extra || extra(q));
    }) ?? p,
    spawn: (type, owner, near, carried = null) => {
      const p = nearestTile(s, near, (q) => freeFor(s, type, q));
      if (!p) return;
      // Spieler (am Zug) sofort bereit, Gegner ab ihrem Zug / player (to move) ready at once, enemies from their turn
      placeUnit(s, type, owner, p.x, p.y, owner === s.current, carried);
      if (owner === 0) revealArea(s, 0, p.x, p.y, 1);
    },
    grantNear: (owner, near, minDist = 0) => {
      const c = s.cities.filter((x) => x.owner === null && dist(x, near) >= minDist).sort((a, b) => dist(a, near) - dist(b, near) || a.id - b.id)[0];
      if (!c) return null;
      grantCity(s, c, owner);
      return c;
    },
    target: (p) => { c.targets.push({ x: p.x, y: p.y }); return c.targets.length - 1; },
  };
  return k;
}

/**
 * Wendet die Einrichtung einer Mission auf ein frisch erzeugtes Spiel an (aufgerufen von createGame).
 * Applies a mission's setup to a freshly created game (called by createGame).
 */
export function setupMission(s: GameState) {
  const id = s.config.campaign?.mission;
  const m = id ? missionById(id) : undefined;
  if (!m) return;
  const c: CampaignState = {
    mission: m.id, targets: [], status: m.objectives.map(() => 'pending'), bonus: m.bonus.map(() => 'pending'),
    startCities: [], result: null, stars: 0,
  };
  s.campaign = c;
  m.setup?.(kit(s, c));
  if (m.alliedEnemies) {
    for (const a of s.factions) for (const b of s.factions) {
      if (a.index === 0 || b.index === 0 || a.index === b.index) continue;
      a.relations[b.index] = 'peace';
    }
  }
  c.startCities = ownCities(s, 0).map((x) => x.id);
}

// ---------- Auswertung / evaluation ----------

const PLAYER = 0;

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
      return p && cityAt(s, p.x, p.y)?.owner === PLAYER ? 'done' : 'pending';
    }
    case 'salvage': {
      const p = tgt(o.target);
      if (!p) return 'pending';
      for (const e of ev) if (e.t === 'salvage' && e.x === p.x && e.y === p.y) return e.faction === PLAYER ? 'done' : 'failed';
      return tileAt(s, p.x, p.y)!.looted ? 'failed' : 'pending';
    }
    case 'cities': return ownCities(s, PLAYER).length >= o.n ? 'done' : 'pending';
    case 'points': return score(s, PLAYER) >= o.n ? 'done' : 'pending';
    case 'kills': return fa.kills >= o.n ? 'done' : 'pending';
    case 'eliminate': return s.factions[o.faction] && !s.factions[o.faction].alive ? 'done' : 'pending';
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
  const update = (list: ObjectiveStatus[], defs: ObjectiveDef[], bonus: boolean) => {
    defs.forEach((o, i) => {
      const next = check(s, c, o, list[i], ev, turnChange);
      if (next !== list[i]) { list[i] = next; ev.push({ t: 'objective', index: i, bonus, status: next }); }
    });
  };
  update(c.status, m.objectives, false);
  update(c.bonus, m.bonus, true);

  const player = s.factions[PLAYER];
  const enemiesAlive = s.factions.some((f) => f.index !== PLAYER && f.alive);
  const achieve = m.objectives.map((o, i) => ({ o, i })).filter((x) => !isHoldObjective(x.o));
  let result: 'won' | 'lost' | null = null;
  if (!player.alive || c.status.includes('failed')) result = 'lost';
  else if (!enemiesAlive) result = 'won';
  else if (achieve.length && achieve.every((x) => c.status[x.i] === 'done')) result = 'won';
  else if (s.round > m.rounds) result = achieve.length ? 'lost' : 'won';
  if (!result) return;

  // offene Ziele abschliessen / close open objectives
  const close = (list: ObjectiveStatus[], defs: ObjectiveDef[], bonus: boolean) => {
    defs.forEach((o, i) => {
      if (list[i] !== 'pending') return;
      const done = result === 'won' && (isHoldObjective(o) || o.k === 'keepHq' || o.k === 'noCityLost' || (o.k === 'fast' && s.round <= o.rounds));
      list[i] = done ? 'done' : 'failed';
      ev.push({ t: 'objective', index: i, bonus, status: list[i] });
    });
  };
  close(c.status, m.objectives, false);
  close(c.bonus, m.bonus, true);
  c.result = result;
  c.stars = result === 'won' ? 1 + c.bonus.filter((b) => b === 'done').length : 0;
  const winner = result === 'won' ? PLAYER : (s.factions.find((f) => f.index !== PLAYER && f.alive)?.index ?? null);
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
