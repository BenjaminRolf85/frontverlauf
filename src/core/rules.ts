/**
 * Spielkern: Zustand anlegen und Kommandos anwenden. Reines TypeScript, deterministisch.
 * Game core: create state and apply commands. Pure TypeScript, deterministic.
 */
import {
  CRASH, VOLCANO, ROSTERS, BARRIER, CITY_UPGRADES, TRACKS, WAR_MARKS, XENO, BUILDINGS, BUNKER, BUNKER_REWARDS, CITY, REMAINS, COMBAT, ECON, FACTIONS, FUEL, GRAND_PROJECTS, GRAND_PROJECT_IDS, HEALING,
  MODES, START, TECHS, TECH_IDS, UNITS, VETERAN, VISION, type BunkerReward, type TechId, type UnitTypeId,
} from '../data/balance';
import { area, dist, idx, isLand, isWater, neighbors, tileAt } from './grid';
import { generateMap } from './mapgen';
import { addHazards, erupts } from './hazards';
import { evaluateCampaign, setupMission } from './campaign';
import { processRandomEvents } from './events';
import {
  recruitCheck, recruitHome,
  upkeep, attackTargets, submerged, barrierCheck, terraformCheck, buildCheck, cityUpgradeCheck, cityUpgrades, hasCityUpgrade, canAttackNow, canHeal, captureKind, cityById, combatPreview, contactStars,
  convertTargets, canActStill, canSeeUnit, embassyCost, grandProjectCheck, grandProjectConditionMet, has, healAmount,
  hqOf, income, isHostile, weather, fuelBurn, isRefuelSpot, levelUpCost, outpostCheck, ownCities, reachable, researchCost,
  rewardOptions, score, trainCheck, unitAt, unitById, unitCost, upgradeCheck, veteranKills, visionRadius, visionRadiusAt,
} from './queries';
import { nextRandom, randInt } from './rng';
import type { City, Command, CommandResult, ErrorCode, Faction, GameConfig, GameEvent, GameState, Unit } from './types';

const fail = (error: ErrorCode): CommandResult => ({ ok: false, error, events: [] });

export function createGame(config: GameConfig): GameState {
  const ids = config.factions.map((f) => f.id);
  const map = generateMap(config.seed, config.size, config.mapType, ids);
  const n = config.size * config.size;
  const s: GameState = {
    version: 1,
    config,
    rng: (config.seed ^ 0x5bd1e995) | 0,
    size: config.size,
    tiles: map.tiles,
    cities: [],
    units: [],
    factions: [],
    round: 1,
    current: 0,
    nextId: 1,
    pendingRewards: [],
    radars: map.radars,
    bunkerRewardsTaken: 0,
    winner: null,
    over: false,
    log: [],
  };
  config.factions.forEach((fc, i) => {
    const f: Faction = {
      index: i, id: fc.id, human: fc.human, difficulty: fc.difficulty, stars: config.startStars,
      techs: [...(FACTIONS[fc.id].startTech ? [FACTIONS[fc.id].startTech!] : []), ...(FACTIONS[fc.id].extraTechs ?? [])], explored: new Array(n).fill(0), alive: true, contacts: [],
      relations: config.factions.map(() => 'war'), breakRound: config.factions.map(() => null), peaceOffers: [],
      embassies: [], kills: 0, lastAttackRound: 0, grandProjectsBuilt: [], grandProjectsUnlocked: [], radarsFound: [],
      maxStars: config.startStars, eliminatedRound: null,
    };
    s.factions.push(f);
  });
  let nameIndex = 0;
  map.starts.forEach((p, i) => {
    const c = addCity(s, p.x, p.y, i, nameIndex++);
    c.isHQ = true; c.hqOf = i; c.level = START.hqLevel;
    claimTerritory(s, c, CITY.baseRadius);
  });
  for (const v of map.villages) addCity(s, v.x, v.y, null, nameIndex++);
  map.starts.forEach((p, i) => {
    const alien = s.factions[i].id === XENO.faction;
    // Zyrr: Hauptquartier startet terraformt / Zyrr: HQ starts terraformed
    if (alien) for (const q of area(s.size, p.x, p.y, CITY.baseRadius)) { const tt = tileAt(s, q.x, q.y)!; if (tt.terrain !== 'ocean') tt.xeno = true; }
    const u = spawnUnit(s, ROSTERS[s.factions[i].id]?.start ?? START.unit, i, p.x, p.y, s.cities[i].id);
    u.fresh = false;
  });
  addHazards(s, config.hazards ?? 'none');
  for (const f of s.factions) {
    const hq = hqOf(s, f.index)!;
    reveal(s, f.index, hq.x, hq.y, hq.radius + VISION.cityExtra, []);
  }
  startTurn(s, []);
  // Kampagne: feste Einrichtung der Mission / campaign: fixed mission setup
  if (config.campaign) setupMission(s);
  return s;
}

function addCity(s: GameState, x: number, y: number, owner: number | null, nameIndex: number): City {
  const c: City = {
    id: s.nextId++, x, y, owner, level: 1, pop: 0, radius: CITY.baseRadius, isHQ: false, hqOf: null, factory: false,
    bunkerRing: false, govQuarter: false, connected: false, noIncomeNext: false, nameIndex,
  };
  s.cities.push(c);
  const t = tileAt(s, x, y)!;
  t.cityId = c.id; t.resource = null; t.feature = null; t.road = false;
  return c;
}

function claimTerritory(s: GameState, c: City, radius: number) {
  c.radius = radius;
  for (const p of area(s.size, c.x, c.y, radius)) {
    const t = tileAt(s, p.x, p.y)!;
    if (t.territory === null && (t.cityId === null || t.cityId === c.id)) t.territory = c.id;
  }
  tileAt(s, c.x, c.y)!.territory = c.id;
}

function spawnUnit(s: GameState, type: UnitTypeId, owner: number, x: number, y: number, home: number | null): Unit {
  const st = UNITS[type];
  const u: Unit = {
    id: s.nextId++, type, carried: null, owner, x, y, hp: st.hp, maxHp: st.hp, homeCity: home, kills: 0, veteran: false,
    moved: false, attacked: false, moveDone: false, exhausted: true, fresh: true,
    fuel: st.abilities.includes('fuel') ? FUEL.tank : null, revealed: false, startX: x, startY: y,
  };
  s.units.push(u);
  return u;
}

function reveal(s: GameState, f: number, x: number, y: number, r: number, ev: GameEvent[]) {
  const fa = s.factions[f];
  for (const p of area(s.size, x, y, r)) {
    const k = idx(s.size, p.x, p.y);
    if (fa.explored[k]) continue;
    fa.explored[k] = 1;
    const t = s.tiles[k];
    if (t.feature === 'radar') {
      const ri = s.radars.findIndex((rp) => rp.x === p.x && rp.y === p.y);
      if (ri >= 0 && !fa.radarsFound.includes(ri)) { fa.radarsFound.push(ri); ev.push({ t: 'radar', index: ri, faction: f }); }
    }
  }
}

function freeNeighbor(s: GameState, x: number, y: number, water: boolean): { x: number; y: number } | null {
  for (const p of neighbors(s.size, x, y)) {
    const t = tileAt(s, p.x, p.y)!;
    if (unitAt(s, p.x, p.y)) continue;
    if (water ? !isWater(t) : !isLand(t)) continue;
    if (!water && t.terrain === 'mountain') continue;
    return p;
  }
  return null;
}

function addPop(s: GameState, c: City, amount: number, ev: GameEvent[]) {
  c.pop += amount;
  while (c.pop >= levelUpCost(s, c)) {
    c.pop -= levelUpCost(s, c);
    c.level++;
    ev.push({ t: 'cityLevel', city: c.id, level: c.level });
    if (c.owner !== null) s.pendingRewards.push({ cityId: c.id, level: c.level });
  }
}

function killUnit(s: GameState, u: Unit, by: number | null, ev: GameEvent[], leaveRemains = true) {
  s.units = s.units.filter((o) => o.id !== u.id);
  const t = tileAt(s, u.x, u.y)!;
  let kind: 'wreck' | 'skeleton' | null = null;
  // Ueberreste nur an Land und nicht in Staedten / remains only on land and not in cities
  if (leaveRemains && isLand(t) && t.cityId === null) {
    const prev = t.remains ?? null;
    const prevSkeletons = prev ? prev.skeletons ?? (prev.kind === 'skeleton' ? 1 : 0) : 0;
    if (REMAINS.wreckUnits.includes(u.type)) {
      kind = 'wreck';
      t.remains = { kind, unit: u.type, faction: u.owner, round: s.round, skeletons: prevSkeletons, skeletonFaction: prev?.skeletonFaction ?? prev?.faction };
    } else if (REMAINS.skeletonUnits.includes(u.type)) {
      kind = 'skeleton';
      // Skelette bleiben dauerhaft und sammeln sich; ein Wrack bleibt erhalten / skeletons stay and pile up; a wreck is kept
      if (prev) { prev.skeletons = prevSkeletons + 1; prev.skeletonFaction = u.owner; }
      else t.remains = { kind, unit: u.type, faction: u.owner, round: s.round, skeletons: 1, skeletonFaction: u.owner };
    }
  }
  ev.push({ t: 'killed', unit: u.id, by, remains: kind, x: u.x, y: u.y });
}

function gainKill(s: GameState, u: Unit, ev: GameEvent[]) {
  u.kills++;
  s.factions[u.owner].kills++;
  if (!u.veteran && u.kills >= veteranKills(s, u)) {
    u.veteran = true;
    u.maxHp += VETERAN.bonusHp;
    u.hp = u.maxHp;
    ev.push({ t: 'veteran', unit: u.id });
  }
}

function updateContacts(s: GameState, f: number, ev: GameEvent[]) {
  const fa = s.factions[f];
  for (const g of s.factions) {
    if (g.index === f || !g.alive || fa.contacts.includes(g.index)) continue;
    const seen = s.units.some((u) => u.owner === g.index && canSeeUnit(s, f, u)) ||
      s.cities.some((c) => c.owner === g.index && fa.explored[idx(s.size, c.x, c.y)]);
    if (!seen) continue;
    fa.contacts.push(g.index);
    const stars = contactStars(s, g.index);
    fa.stars += stars;
    ev.push({ t: 'contact', a: f, b: g.index, stars });
  }
}

function updateConnections(s: GameState, f: number, ev: GameEvent[]) {
  const hq = hqOf(s, f);
  const own = ownCities(s, f);
  if (!hq) { for (const c of own) c.connected = false; return; }
  const size = s.size;
  const ownTile = (x: number, y: number) => {
    const t = tileAt(s, x, y)!;
    if (t.territory === null) return false;
    return cityById(s, t.territory)?.owner === f;
  };
  const connector = (x: number, y: number) => {
    const t = tileAt(s, x, y)!;
    if (t.cityId !== null) return cityById(s, t.cityId)!.owner === f;
    if (!ownTile(x, y)) return false;
    return t.road || t.building === 'bridge' || t.building === 'navalBase';
  };
  // Wasserkomponenten fuer Marinestuetzpunkte / water components for naval bases
  const comp = new Int32Array(size * size).fill(-1);
  let cid = 0;
  for (let i = 0; i < size * size; i++) {
    if (comp[i] !== -1 || !isWater(s.tiles[i])) continue;
    const stack = [i];
    comp[i] = cid;
    while (stack.length) {
      const k = stack.pop()!;
      for (const p of neighbors(size, k % size, Math.floor(k / size))) {
        const kk = idx(size, p.x, p.y);
        if (comp[kk] === -1 && isWater(s.tiles[kk])) { comp[kk] = cid; stack.push(kk); }
      }
    }
    cid++;
  }
  const visited = new Uint8Array(size * size);
  const start = idx(size, hq.x, hq.y);
  const queue = [start];
  visited[start] = 1;
  const portComps = new Set<number>();
  const ports: number[] = [];
  for (let i = 0; i < size * size; i++) if (s.tiles[i].building === 'navalBase' && connector(i % size, Math.floor(i / size))) ports.push(i);
  while (queue.length) {
    const k = queue.shift()!;
    const kx = k % size, ky = Math.floor(k / size);
    const nexts = neighbors(size, kx, ky).map((p) => idx(size, p.x, p.y));
    if (s.tiles[k].building === 'navalBase' && !portComps.has(comp[k])) {
      portComps.add(comp[k]);
      for (const p of ports) if (comp[p] === comp[k]) nexts.push(p);
    }
    for (const kk of nexts) {
      if (visited[kk] || !connector(kk % size, Math.floor(kk / size))) continue;
      visited[kk] = 1;
      queue.push(kk);
    }
  }
  for (const c of own) {
    if (c.id === hq.id) continue;
    const now = visited[idx(size, c.x, c.y)] === 1;
    if (now && !c.connected) {
      c.connected = true;
      addPop(s, c, CITY.connectionPopulation, ev);
      addPop(s, hq, CITY.connectionPopulation, ev);
      ev.push({ t: 'connected', city: c.id });
    } else if (!now) c.connected = false;
  }
}

function updateGrandProjects(s: GameState, f: number, ev: GameEvent[]) {
  const fa = s.factions[f];
  for (const id of GRAND_PROJECT_IDS) {
    if (fa.grandProjectsUnlocked.includes(id)) continue;
    if (grandProjectConditionMet(s, f, id)) { fa.grandProjectsUnlocked.push(id); ev.push({ t: 'unlockGrand', id, faction: f }); }
  }
}

function checkElimination(s: GameState, ev: GameEvent[]) {
  for (const f of s.factions) {
    if (!f.alive) continue;
    if (ownCities(s, f.index).length === 0) {
      f.alive = false;
      f.eliminatedRound = s.round;
      s.units = s.units.filter((u) => u.owner !== f.index);
      s.pendingRewards = s.pendingRewards.filter((p) => cityById(s, p.cityId)?.owner !== f.index);
      ev.push({ t: 'eliminated', faction: f.index });
    }
  }
  const alive = s.factions.filter((f) => f.alive);
  if (alive.length <= 1 && !s.over) {
    s.over = true;
    s.winner = alive.length ? alive[0].index : null;
    ev.push({ t: 'gameOver', winner: s.winner });
  }
}

function afterAction(s: GameState, f: number, ev: GameEvent[]) {
  updateContacts(s, f, ev);
  updateGrandProjects(s, f, ev);
  const fa = s.factions[f];
  fa.maxStars = Math.max(fa.maxStars, fa.stars);
}

function startTurn(s: GameState, ev: GameEvent[]) {
  const f = s.current;
  const fa = s.factions[f];
  // angekuendigte Brueche werden zum Krieg / announced breaks become war
  fa.relations.forEach((r, g) => {
    if (r === 'breaking' && fa.breakRound[g] !== null && s.round > fa.breakRound[g]!) {
      fa.relations[g] = 'war'; s.factions[g].relations[f] = 'war';
      fa.breakRound[g] = null;
      ev.push({ t: 'war', a: f, b: g });
    }
  });
  let inc = 0;
  if (s.round > 1) {
    // Einkommen minus Sold; Sterne fallen nie unter 0 / income minus upkeep; stars never drop below 0
    inc = income(s, f) - upkeep(s, f);
    fa.stars = Math.max(0, fa.stars + inc);
  }
  for (const c of ownCities(s, f)) c.noIncomeNext = false;
  for (const u of s.units) {
    if (u.owner !== f) continue;
    u.moved = false; u.attacked = false; u.moveDone = false; u.exhausted = false; u.fresh = false;
    u.startX = u.x; u.startY = u.y; u.revealed = false;
    u.slowed = !!u.slowedNext; u.slowedNext = false;
    if (u.fuel !== null && isRefuelSpot(s, f, u.x, u.y)) u.fuel = FUEL.tank;
  }
  ev.push({ t: 'turn', faction: f, round: s.round, income: inc, weather: weather(s) });
  afterAction(s, f, ev);
}

function endTurnProcessing(s: GameState, ev: GameEvent[]) {
  const f = s.current;
  for (const u of s.units.slice()) {
    if (u.owner !== f || u.fuel === null) continue;
    if (isRefuelSpot(s, f, u.x, u.y)) continue;
    u.fuel -= fuelBurn(s);
    if (u.fuel <= 0) { killUnit(s, u, null, ev); ev.push({ t: 'crash', unit: u.id }); }
  }
  // Flugabwehr feindlicher Staedte trifft Hubschrauber, die hier ihren Zug beenden
  // flak of hostile cities hits helicopters ending their turn nearby
  for (const u of s.units.slice()) {
    if (u.owner !== f || !UNITS[u.type].abilities.includes('fly')) continue;
    const c = s.cities.find((cc) => cc.owner !== null && cc.owner !== f && isHostile(s, f, cc.owner) && (cc.upgrades ?? []).includes('flak') && dist(cc, u) <= CITY_UPGRADES.flakRange);
    if (!c) continue;
    u.hp -= CITY_UPGRADES.flakDamage;
    ev.push({ t: 'flak', city: c.id, unit: u.id, dmg: CITY_UPGRADES.flakDamage });
    if (u.hp <= 0) killUnit(s, u, null, ev);
  }
}

/** Kriegsspur auf einem Feld hinterlassen / leave a war mark on a tile */
function addMark(s: GameState, x: number, y: number, k: 'crater' | 'scorch') {
  const t = tileAt(s, x, y);
  if (!t || !isLand(t) || t.cityId !== null) return;
  const n = (t.marks ?? []).length;
  const h = (x * 73 + y * 37 + n * 11 + s.round * 5) % 97;
  const mark = { k, a: (h / 97) * Math.PI * 2, ox: ((h % 7) - 3) * 0.07, oz: (((h >> 3) % 7) - 3) * 0.07 };
  t.marks = [...(t.marks ?? []), mark].slice(-WAR_MARKS.maxPerTile);
}

/** Endlos weiterspielen nach Ablauf des Rundenlimits / continue endlessly after the round limit */
export function continueEndless(s: GameState): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!s.over || s.factions.filter((f) => f.alive).length < 2) return ev;
  s.over = false;
  s.winner = null;
  s.config.roundLimit = null;
  s.config.mode = 'endless';
  startTurn(s, ev);
  return ev;
}

function advance(s: GameState, ev: GameEvent[]) {
  const count = s.factions.length;
  let next = s.current;
  let wrapped = false;
  for (let i = 0; i < count; i++) {
    next = (next + 1) % count;
    if (next === 0) wrapped = true;
    if (s.factions[next].alive) break;
  }
  if (wrapped) { s.round++; processVolcanoes(s, ev); processRandomEvents(s, ev); }
  s.current = next;
  const limit = s.config.roundLimit;
  if (limit !== null && s.round > limit) {
    s.over = true;
    let best = -1, bestScore = -1;
    for (const f of s.factions) {
      if (!f.alive) continue;
      const sc = score(s, f.index);
      if (sc > bestScore) { bestScore = sc; best = f.index; }
    }
    s.winner = best;
    ev.push({ t: 'gameOver', winner: best });
    return;
  }
  startTurn(s, ev);
}

/**
 * Bergung einer Absturzstelle oder verlassenen Forschungseinrichtung: eine Gratis-Technologie bis Stufe 3,
 * sonst Sterne; Aufklaerung; Zyrr finden an Absturzstellen eine Untertasse.
 * Salvage a crash site or abandoned research facility: a free tech up to tier 3, otherwise stars; recon;
 * the Zyrr find a saucer at crash sites.
 */
function salvage(s: GameState, u: Unit, ev: GameEvent[]) {
  const t = tileAt(s, u.x, u.y)!;
  const kind = t.feature as 'crashSite' | 'labRuin';
  t.looted = true;
  const f = u.owner;
  const fa = s.factions[f];
  let tech: TechId | undefined;
  if (ROSTERS[fa.id]?.research !== false) {
    const options = TECH_IDS.filter((x) => TECHS[x].tier <= CRASH.maxTier && !fa.techs.includes(x) && (!TECHS[x].parent || fa.techs.includes(TECHS[x].parent!)));
    if (options.length) { tech = options[randInt(s, options.length)]; fa.techs.push(tech); }
  }
  const stars = tech ? undefined : CRASH.stars;
  if (stars) fa.stars += stars;
  reveal(s, f, u.x, u.y, CRASH.revealRadius, ev);
  let unit: number | undefined;
  if (kind === 'crashSite' && fa.id === XENO.faction) {
    const p = freeNeighbor(s, u.x, u.y, false);
    if (p) unit = spawnUnit(s, CRASH.alienUnit, f, p.x, p.y, null).id;
  }
  ev.push({ t: 'salvage', x: u.x, y: u.y, faction: f, kind, tech, stars, unit });
}

/** Vulkanausbrueche zu Rundenbeginn / volcano eruptions at the start of a round */
function processVolcanoes(s: GameState, ev: GameEvent[]) {
  for (let k = 0; k < s.tiles.length; k++) {
    const t = s.tiles[k];
    if (!t.volcano) continue;
    const x = k % s.size, y = Math.floor(k / s.size);
    if (!erupts(x, y, s.round)) continue;
    const hit: { x: number; y: number }[] = [];
    for (const p of area(s.size, x, y, VOLCANO.radius)) {
      const nt = tileAt(s, p.x, p.y)!;
      if ((p.x === x && p.y === y) || isWater(nt) || nt.cityId !== null) continue;
      nt.lava = s.round + VOLCANO.burnRounds - 1;
      hit.push(p);
    }
    ev.push({ t: 'eruption', x, y, tiles: hit });
    for (const p of hit) {
      const u = unitAt(s, p.x, p.y);
      if (!u) continue;
      u.hp -= VOLCANO.damage;
      if (u.hp <= 0) killUnit(s, u, null, ev);
    }
  }
}

function exploreBunker(s: GameState, u: Unit, ev: GameEvent[]) {
  const t = tileAt(s, u.x, u.y)!;
  if (t.feature !== 'bunker') return;
  t.feature = null;
  const f = u.owner;
  const fa = s.factions[f];
  let reward: BunkerReward;
  if (isWater(t) && nextRandom(s) < BUNKER.waterDestroyerChance) reward = 'destroyer';
  else reward = BUNKER_REWARDS[randInt(s, BUNKER_REWARDS.length)];
  const giveStars = () => { fa.stars += BUNKER.stars; reward = 'stars'; };
  switch (reward) {
    case 'stars': giveStars(); break;
    case 'tech': {
      if (ROSTERS[fa.id]?.research === false) { giveStars(); break; }
      const options = TECH_IDS.filter((tech) => !fa.techs.includes(tech) && (!TECHS[tech].parent || fa.techs.includes(TECHS[tech].parent!)));
      if (options.length) {
        options.sort((a, b) => TECHS[a].tier - TECHS[b].tier);
        const lowest = options.filter((o) => TECHS[o].tier === TECHS[options[0]].tier);
        fa.techs.push(lowest[randInt(s, lowest.length)]);
      } else giveStars();
      break;
    }
    case 'population': {
      const hq = hqOf(s, f) ?? ownCities(s, f)[0];
      if (hq) addPop(s, hq, BUNKER.population, ev); else giveStars();
      break;
    }
    case 'veteranMg': {
      const p = freeNeighbor(s, u.x, u.y, false);
      if (p) {
        const m = spawnUnit(s, ROSTERS[fa.id]?.mg ?? 'mg', f, p.x, p.y, null);
        m.veteran = true; m.maxHp += VETERAN.bonusHp; m.hp = m.maxHp;
      } else giveStars();
      break;
    }
    case 'reveal': reveal(s, f, u.x, u.y, VISION.bunkerRevealRadius, ev); break;
    case 'destroyer': {
      const p = fa.id === XENO.faction ? null : freeNeighbor(s, u.x, u.y, true);
      if (p) {
        const d = spawnUnit(s, 'destroyer', f, p.x, p.y, null);
        const inf = ROSTERS[fa.id]?.infantry ?? 'infantry';
        d.carried = inf; d.hp = UNITS[inf].hp; d.maxHp = UNITS[inf].hp;
      } else giveStars();
      break;
    }
  }
  s.bunkerRewardsTaken++;
  ev.push({ t: 'bunker', x: u.x, y: u.y, reward, faction: f });
}

function captureCity(s: GameState, u: Unit, c: City, ev: GameEvent[]) {
  const from = c.owner;
  c.owner = u.owner;
  if (from === null) {
    c.level = 1; c.pop = 0;
    claimTerritory(s, c, CITY.baseRadius);
  } else {
    for (const o of s.units) if (o.homeCity === c.id) o.homeCity = null;
    s.pendingRewards = s.pendingRewards.filter((p) => p.cityId !== c.id);
    c.connected = false;
    if (c.isHQ && c.hqOf !== null) {
      // Botschaften im verlorenen Hauptquartier enden / embassies in a lost HQ end
      for (const f of s.factions) f.embassies = f.embassies.filter((g) => g !== c.hqOf);
    }
  }
  ev.push({ t: 'capture', city: c.id, faction: u.owner, from });
  reveal(s, u.owner, c.x, c.y, c.radius + VISION.cityExtra, ev);
  updateConnections(s, u.owner, ev);
  if (from !== null) updateConnections(s, from, ev);
  checkElimination(s, ev);
}

function applyReward(s: GameState, c: City, level: number, choice: 'a' | 'b', ev: GameEvent[]) {
  const opt = rewardOptions(c, level)[choice === 'a' ? 0 : 1];
  const f = c.owner!;
  switch (opt) {
    case 'factory': c.factory = true; break;
    case 'drone': reveal(s, f, c.x, c.y, VISION.droneRadius, ev); break;
    case 'bunkerRing': c.bunkerRing = true; break;
    case 'stars': s.factions[f].stars += CITY.rewardStars; break;
    case 'expand': claimTerritory(s, c, CITY.expandedRadius); reveal(s, f, c.x, c.y, c.radius + VISION.cityExtra, ev); break;
    case 'population': addPop(s, c, CITY.rewardPopulation, ev); break;
    case 'govQuarter': c.govQuarter = true; break;
    case 'tank': {
      const p = !unitAt(s, c.x, c.y) ? { x: c.x, y: c.y } : freeNeighbor(s, c.x, c.y, false);
      if (p) spawnUnit(s, ROSTERS[s.factions[f].id]?.tank ?? 'tank', f, p.x, p.y, c.id);
      break;
    }
  }
  ev.push({ t: 'reward', city: c.id, choice, level });
}

function doMove(s: GameState, u: Unit, to: { x: number; y: number }, ev: GameEvent[]): CommandResult {
  const options = reachable(s, u);
  const r = options.find((o) => o.x === to.x && o.y === to.y);
  if (!r) return fail('unreachable');
  const f = u.owner;
  const hadAttacked = u.attacked;
  // Kettenspuren / track marks
  if (TRACKS.units.includes(u.type)) {
    const pts = [{ x: u.x, y: u.y }, ...r.path];
    for (let i = 1; i < pts.length; i++) {
      const a = Math.atan2(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      for (const p of [pts[i - 1], pts[i]]) {
        const tt = tileAt(s, p.x, p.y)!;
        if (!isLand(tt) || tt.cityId !== null) continue;
        tt.tracks = [...(tt.tracks ?? []).filter((m) => s.round - m.r < TRACKS.keepRounds), { a, r: s.round }].slice(-TRACKS.maxPerTile);
      }
    }
  }
  u.x = r.x; u.y = r.y;
  const bt = tileAt(s, u.x, u.y)!;
  if (bt.barrier && bt.barrier.owner !== f && BARRIER.vehicles.includes(u.type)) {
    u.slowedNext = true;
    ev.push({ t: 'barrierHit', unit: u.id, x: u.x, y: u.y });
  }
  u.moved = true;
  ev.push({ t: 'move', unit: u.id, path: r.path });
  for (const p of r.path) reveal(s, f, p.x, p.y, visionRadiusAt(s, u, p.x, p.y), ev);
  if (hadAttacked) u.exhausted = true;
  const t = tileAt(s, u.x, u.y)!;
  if (r.embark) {
    u.carried = u.type; u.type = 'landingBoat'; u.exhausted = true;
    ev.push({ t: 'embark', unit: u.id });
  } else if (r.disembark) {
    u.type = u.carried!; u.carried = null; u.exhausted = true;
    ev.push({ t: 'disembark', unit: u.id });
  }
  reveal(s, f, u.x, u.y, visionRadius(s, u), ev);
  // Aufstand / uprising
  if (has(u, 'uprising') && t.cityId !== null) {
    const c = cityById(s, t.cityId)!;
    if (c.owner !== null && c.owner !== f && isHostile(s, f, c.owner)) {
      killUnit(s, u, null, ev, false);
      let spawned = 0;
      const max = Math.min(c.level, CITY.uprisingMaxUnits);
      for (const p of neighbors(s.size, c.x, c.y)) {
        if (spawned >= max) break;
        const nt = tileAt(s, p.x, p.y)!;
        if (unitAt(s, p.x, p.y) || !isLand(nt) || (nt.terrain === 'mountain' && !s.factions[f].techs.includes('mountainTraining'))) continue;
        spawnUnit(s, ROSTERS[s.factions[f].id]?.infantry ?? 'infantry', f, p.x, p.y, null);
        spawned++;
      }
      c.noIncomeNext = true;
      ev.push({ t: 'uprising', city: c.id, faction: f, spawned });
      return { ok: true, events: ev };
    }
  }
  if (t.feature === 'bunker') exploreBunker(s, u, ev);
  else if ((t.feature === 'crashSite' || t.feature === 'labRuin') && !t.looted) salvage(s, u, ev);
  return { ok: true, events: ev };
}

function doAttack(s: GameState, u: Unit, target: Unit, ev: GameEvent[]): CommandResult {
  if (target.owner !== u.owner && !isHostile(s, u.owner, target.owner)) return fail('peace');
  if (!attackTargets(s, u).some((o) => o.id === target.id)) {
    if (!canAttackNow(u) || submerged(s, u)) return fail('cannotAttack');
    return fail('outOfRange');
  }
  const pre = combatPreview(s, u, target);
  const splash: { unit: number; dmg: number }[] = [];
  if (has(u, 'splash')) {
    const dmg = Math.round(pre.toDefender * COMBAT.splashFactor);
    for (const o of s.units.slice()) {
      if (o.id === target.id || o.owner === u.owner || !isHostile(s, u.owner, o.owner) || dist(o, target) !== 1) continue;
      o.hp -= dmg;
      splash.push({ unit: o.id, dmg });
    }
  }
  target.hp -= pre.toDefender;
  if (pre.retaliates) u.hp -= pre.toAttacker;
  // Kriegsspuren / war marks
  const markKind = WAR_MARKS.craterUnits.includes(u.type) ? 'crater' : 'scorch';
  addMark(s, target.x, target.y, markKind);
  for (const sp of splash) { const o = unitById(s, sp.unit); if (o) addMark(s, o.x, o.y, 'scorch'); }
  ev.push({ t: 'attack', unit: u.id, target: target.id, dmg: pre.toDefender, ret: pre.retaliates ? pre.toAttacker : 0, splash });
  s.factions[u.owner].lastAttackRound = s.round;
  if (has(u, 'submerged')) u.revealed = true;
  let killed = false;
  if (target.hp <= 0) { killUnit(s, target, u.id, ev); gainKill(s, u, ev); killed = true; }
  for (const sp of splash) {
    const o = unitById(s, sp.unit);
    if (o && o.hp <= 0) { killUnit(s, o, u.id, ev); gainKill(s, u, ev); }
  }
  if (u.hp <= 0) {
    killUnit(s, u, target.id, ev);
    // Der Verteidiger hat den Angreifer vernichtet / the defender destroyed the attacker
    const survivor = unitById(s, target.id);
    if (survivor) gainKill(s, survivor, ev);
    return { ok: true, events: ev };
  }
  u.attacked = true;
  if (killed && has(u, 'persist')) {
    u.attacked = false; // Folgeangriff / follow-up attack
    // ohne Rueckzug keine Bewegung nach dem Angriff / no movement after attacking without escape
    if (!has(u, 'escape')) u.moveDone = true;
  } else if (!(has(u, 'escape') && !u.moved)) {
    u.exhausted = true;
  }
  if (u.moved && u.attacked) u.exhausted = true;
  return { ok: true, events: ev };
}

/**
 * Wendet ein Kommando auf den Zustand an (veraendert ihn). Ungueltige Kommandos aendern nichts.
 * Applies a command to the state (mutates it). Invalid commands change nothing.
 */
export function applyCommand(s: GameState, cmd: Command): CommandResult {
  if (s.over) return fail('gameOver');
  const f = s.current;
  const fa = s.factions[f];
  const ev: GameEvent[] = [];
  let res: CommandResult;
  const ownUnit = (id: number): Unit | ErrorCode => {
    const u = unitById(s, id);
    if (!u) return 'noUnit';
    if (u.owner !== f) return 'notYourUnit';
    return u;
  };
  switch (cmd.type) {
    case 'move': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      if (u.fresh) return fail('fresh');
      res = doMove(s, u, cmd.to, ev);
      break;
    }
    case 'attack': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const target = unitById(s, cmd.target);
      if (!target || target.owner === f) return fail('invalidTarget');
      res = doAttack(s, u, target, ev);
      break;
    }
    case 'heal': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      if (!canHeal(u)) return fail('unitExhausted');
      const amount = Math.min(healAmount(s, u), u.maxHp - u.hp);
      u.hp += amount; u.exhausted = true;
      ev.push({ t: 'heal', unit: u.id, amount });
      res = { ok: true, events: ev };
      break;
    }
    case 'medicHeal': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      if (!has(u, 'heal') || !canActStill(u)) return fail('unitExhausted');
      for (const o of s.units) {
        if (o.owner !== f || dist(o, u) !== 1 || o.hp >= o.maxHp) continue;
        const amount = Math.min(HEALING.medic, o.maxHp - o.hp);
        o.hp += amount;
        ev.push({ t: 'heal', unit: o.id, amount });
      }
      u.exhausted = true;
      res = { ok: true, events: ev };
      break;
    }
    case 'convert': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const target = unitById(s, cmd.target);
      if (!target || !convertTargets(s, u).some((o) => o.id === target.id)) return fail('invalidTarget');
      target.owner = f; target.homeCity = null; target.exhausted = true; target.fresh = true;
      u.exhausted = true;
      s.factions[f].lastAttackRound = s.round;
      ev.push({ t: 'convert', unit: u.id, target: target.id });
      res = { ok: true, events: ev };
      break;
    }
    case 'capture': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const kind = captureKind(s, u);
      if (!kind) return fail('cannotCapture');
      u.exhausted = true;
      const t = tileAt(s, u.x, u.y)!;
      if (kind === 'outpost') {
        t.outpost = { owner: f };
        ev.push({ t: 'outpostCapture', x: u.x, y: u.y, faction: f });
      } else {
        captureCity(s, u, cityById(s, t.cityId!)!, ev);
      }
      res = { ok: true, events: ev };
      break;
    }
    case 'train': {
      const c = cityById(s, cmd.city);
      if (!c || c.owner !== f) return fail('notYourCity');
      const check = trainCheck(s, c, cmd.unitType);
      if (check !== 'ok') return fail(check);
      fa.stars -= unitCost(s, f, cmd.unitType)!;
      const u = spawnUnit(s, cmd.unitType, f, c.x, c.y, c.id);
      ev.push({ t: 'train', unit: u.id, city: c.id });
      // Kaserne: Einheit startet als Veteran / barracks: unit starts as a veteran
      if (hasCityUpgrade(c, 'barracks')) {
        u.veteran = true; u.maxHp += VETERAN.bonusHp; u.hp = u.maxHp;
        ev.push({ t: 'veteran', unit: u.id });
      }
      res = { ok: true, events: ev };
      break;
    }
    case 'build': {
      const check = buildCheck(s, f, cmd.building, cmd.x, cmd.y);
      if (!check.ok) return fail(check.error);
      fa.stars -= check.cost;
      const t = tileAt(s, cmd.x, cmd.y)!;
      const st = BUILDINGS[cmd.building];
      const city = cityById(s, t.territory!)!;
      if (cmd.building === 'road') t.road = true;
      else {
        t.building = cmd.building;
        if (cmd.building === 'bridge') t.road = true;
        if (cmd.building === 'researchCenter') t.researchBuilt = s.round;
      }
      if (st.pop) addPop(s, city, st.pop, ev);
      if (st.adjacency) {
        let n = 0;
        for (const p of neighbors(s.size, cmd.x, cmd.y)) if (tileAt(s, p.x, p.y)!.building === st.adjacency.building) n++;
        if (n) addPop(s, city, n * st.adjacency.pop, ev);
      }
      // Basisgebaeude neben bestehendem Werk / base building next to existing works
      for (const p of neighbors(s.size, cmd.x, cmd.y)) {
        const nt = tileAt(s, p.x, p.y)!;
        if (!nt.building) continue;
        const adj = BUILDINGS[nt.building].adjacency;
        if (adj && adj.building === cmd.building && nt.territory !== null) {
          const wc = cityById(s, nt.territory);
          if (wc && wc.owner === f) addPop(s, wc, adj.pop, ev);
        }
      }
      ev.push({ t: 'build', building: cmd.building, x: cmd.x, y: cmd.y, faction: f });
      if (cmd.building === 'road' || cmd.building === 'bridge' || cmd.building === 'navalBase') updateConnections(s, f, ev);
      res = { ok: true, events: ev };
      break;
    }
    case 'grandProject': {
      if (!grandProjectCheck(s, f, cmd.id, cmd.x, cmd.y)) return fail('notUnlocked');
      const t = tileAt(s, cmd.x, cmd.y)!;
      t.grandProject = cmd.id;
      fa.grandProjectsBuilt.push(cmd.id);
      addPop(s, cityById(s, t.territory!)!, GRAND_PROJECTS.pop, ev);
      ev.push({ t: 'grandProject', id: cmd.id, faction: f });
      ev.push({ t: 'build', building: cmd.id, x: cmd.x, y: cmd.y, faction: f });
      res = { ok: true, events: ev };
      break;
    }
    case 'cityUpgrade': {
      const c = cityById(s, cmd.city);
      if (!c) return fail('notYourCity');
      if (cmd.upgrade === 'radioTower' && !cmd.target) return fail('invalidTarget');
      const check = cityUpgradeCheck(s, f, c, cmd.upgrade, cmd.target);
      if (check !== 'ok') return fail(check === 'noSlot' ? 'onePerCity' : check);
      fa.stars -= CITY_UPGRADES.cost[cmd.upgrade];
      c.upgrades = [...cityUpgrades(c), cmd.upgrade];
      if (cmd.upgrade === 'radioTower' && cmd.target) reveal(s, f, cmd.target.x, cmd.target.y, CITY_UPGRADES.radioRadius, ev);
      ev.push({ t: 'cityUpgrade', city: c.id, upgrade: cmd.upgrade, faction: f, target: cmd.target });
      res = { ok: true, events: ev };
      break;
    }
    case 'terraform': {
      const check = terraformCheck(s, f, cmd.x, cmd.y, cmd.unit);
      if (check !== 'ok') return fail(check === 'outOfRange' ? 'outOfRange' : check);
      if (cmd.unit === undefined) fa.stars -= XENO.terraformCost;
      else unitById(s, cmd.unit)!.exhausted = true;
      tileAt(s, cmd.x, cmd.y)!.xeno = true;
      ev.push({ t: 'terraform', x: cmd.x, y: cmd.y, faction: f, unit: cmd.unit });
      res = { ok: true, events: ev };
      break;
    }
    case 'recruit': {
      const check = recruitCheck(s, f, cmd.unit, cmd.unitType, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check);
      fa.stars -= unitCost(s, f, cmd.unitType)!;
      unitById(s, cmd.unit)!.exhausted = true;
      const home = recruitHome(s, f, cmd.x, cmd.y)!;
      const nu = spawnUnit(s, cmd.unitType, f, cmd.x, cmd.y, home.id);
      ev.push({ t: 'train', unit: nu.id, city: home.id });
      res = { ok: true, events: ev };
      break;
    }
    case 'barrier': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = barrierCheck(s, u, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check === 'cannotCapture' ? 'unitExhausted' : check);
      fa.stars -= BARRIER.cost;
      tileAt(s, cmd.x, cmd.y)!.barrier = { owner: f };
      u.exhausted = true;
      ev.push({ t: 'barrier', x: cmd.x, y: cmd.y, faction: f });
      res = { ok: true, events: ev };
      break;
    }
    case 'outpost': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = outpostCheck(s, u);
      if (check !== 'ok') return fail(check);
      fa.stars -= ECON.outpostCost;
      tileAt(s, u.x, u.y)!.outpost = { owner: f };
      u.exhausted = true;
      ev.push({ t: 'build', building: 'outpost', x: u.x, y: u.y, faction: f });
      res = { ok: true, events: ev };
      break;
    }
    case 'upgrade': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = upgradeCheck(s, u, cmd.to);
      if (check !== 'ok') return fail(check);
      fa.stars -= UNITS[cmd.to].cost ?? 0;
      u.type = cmd.to;
      ev.push({ t: 'upgrade', unit: u.id, to: cmd.to });
      res = { ok: true, events: ev };
      break;
    }
    case 'research': {
      const tech = cmd.tech as TechId;
      if (ROSTERS[fa.id]?.research === false) return fail('noResearch');
      if (!TECHS[tech]) return fail('invalid');
      if (fa.techs.includes(tech)) return fail('alreadyResearched');
      const parent = TECHS[tech].parent;
      if (parent && !fa.techs.includes(parent)) return fail('parentMissing');
      const cost = researchCost(s, f, tech);
      if (fa.stars < cost) return fail('notEnoughStars');
      fa.stars -= cost;
      fa.techs.push(tech);
      ev.push({ t: 'research', tech, faction: f });
      res = { ok: true, events: ev };
      break;
    }
    case 'reward': {
      const i = s.pendingRewards.findIndex((p) => p.cityId === cmd.city);
      if (i < 0) return fail('noReward');
      const c = cityById(s, cmd.city)!;
      if (c.owner !== f) return fail('notYourCity');
      const p = s.pendingRewards[i];
      s.pendingRewards.splice(i, 1);
      applyReward(s, c, p.level, cmd.choice, ev);
      res = { ok: true, events: ev };
      break;
    }
    case 'diplomacy': {
      const g = cmd.target;
      if (g === f || !s.factions[g] || !s.factions[g].alive) return fail('invalidTarget');
      if (!fa.contacts.includes(g)) return fail('noContact');
      const ga = s.factions[g];
      switch (cmd.action) {
        case 'proposePeace': {
          if (fa.relations[g] !== 'war') return fail('invalid');
          if (fa.peaceOffers.includes(g)) {
            makePeace(s, f, g, ev);
          } else if (!ga.peaceOffers.includes(f)) {
            ga.peaceOffers.push(f);
            ev.push({ t: 'peaceOffer', from: f, to: g });
          } else return fail('invalid');
          break;
        }
        case 'acceptPeace': {
          if (!fa.peaceOffers.includes(g)) return fail('invalid');
          makePeace(s, f, g, ev);
          break;
        }
        case 'declinePeace': {
          if (!fa.peaceOffers.includes(g)) return fail('invalid');
          fa.peaceOffers = fa.peaceOffers.filter((o) => o !== g);
          ev.push({ t: 'peaceDeclined', from: f, to: g });
          break;
        }
        case 'announceBreak': {
          if (fa.relations[g] !== 'peace') return fail('invalid');
          fa.relations[g] = 'breaking'; ga.relations[f] = 'breaking';
          fa.breakRound[g] = s.round;
          ev.push({ t: 'breakAnnounced', from: f, to: g });
          break;
        }
        case 'embassy': {
          if (!fa.techs.includes('intelligence')) return fail('techMissing');
          if (fa.embassies.includes(g)) return fail('alreadyBuilt');
          const hq = hqOf(s, g);
          if (!hq || !fa.explored[idx(s.size, hq.x, hq.y)]) return fail('invalidTarget');
          const cost = embassyCost(s, f);
          if (fa.stars < cost) return fail('notEnoughStars');
          fa.stars -= cost;
          fa.embassies.push(g);
          ev.push({ t: 'embassy', from: f, to: g });
          break;
        }
      }
      res = { ok: true, events: ev };
      break;
    }
    case 'endTurn': {
      if (s.pendingRewards.some((p) => cityById(s, p.cityId)?.owner === f)) return fail('pendingReward');
      endTurnProcessing(s, ev);
      advance(s, ev);
      if (s.campaign) evaluateCampaign(s, ev, true);
      res = { ok: true, events: ev };
      s.log.push(...ev.filter((e) => e.t !== 'move'));
      if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
      return res;
    }
    default:
      return fail('invalid');
  }
  if (res.ok && !s.over) afterAction(s, f, ev);
  if (res.ok && s.campaign) evaluateCampaign(s, ev, false);
  s.log.push(...ev.filter((e) => e.t !== 'move'));
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
  return res;
}

function makePeace(s: GameState, a: number, b: number, ev: GameEvent[]) {
  const fa = s.factions[a], fb = s.factions[b];
  fa.relations[b] = 'peace'; fb.relations[a] = 'peace';
  fa.peaceOffers = fa.peaceOffers.filter((o) => o !== b);
  fb.peaceOffers = fb.peaceOffers.filter((o) => o !== a);
  fa.breakRound[b] = null; fb.breakRound[a] = null;
  ev.push({ t: 'peace', a, b });
}

export function defaultConfig(partial: Partial<GameConfig> = {}): GameConfig {
  const mode = partial.mode ?? 'points';
  return {
    seed: partial.seed ?? 12345,
    size: partial.size ?? 14,
    mapType: partial.mapType ?? 'continents',
    mode,
    factions: partial.factions ?? [
      { id: 'korvat', human: true, difficulty: 'normal' },
      { id: 'dravon', human: false, difficulty: 'normal' },
    ],
    startStars: partial.startStars ?? START.stars,
    roundLimit: partial.roundLimit !== undefined ? partial.roundLimit : mode === 'points' ? MODES.pointsRounds : null,
    weather: partial.weather ?? true,
    hazards: partial.hazards ?? 'none',
    events: partial.events ?? false,
    ...(partial.campaign ? { campaign: partial.campaign } : {}),
  };
}

/** Zustand tief kopieren / deep copy state */
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s));
}

/** Wiederholung: Konfiguration + Kommandofolge / replay: config + command sequence */
export function replay(config: GameConfig, commands: Command[]): GameState {
  const s = createGame(config);
  for (const c of commands) applyCommand(s, c);
  return s;
}
