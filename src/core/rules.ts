/**
 * Spielkern: Zustand anlegen und Kommandos anwenden. Reines TypeScript, deterministisch.
 * Game core: create state and apply commands. Pure TypeScript, deterministic.
 */
import {
  BASES, COUNTER, ENTRENCH, CRASH, CULT, VOLCANO, WEATHER, ROSTERS, BARRIER, CITY_UPGRADES, TRACKS, WAR_MARKS, XENO, BUILDINGS, BUNKER, BUNKER_REWARDS, CITY, REMAINS, COMBAT, FACTIONS, FUEL, GRAND_PROJECTS, GRAND_PROJECT_IDS,
  MODES, MARTYR, ORBITAL, TOWER, PERKS2, RETREAT, SIN, ROCKETS, START, SWARM_MOTHER, VERDAN, TECHS, TECH_IDS, UNIQUE, UNITS, VETERAN, VISION, WONDERS, VICTORY_TECH, type BunkerReward, type HitKind, type SinDeed, type TechId, type UnitTypeId,
  type WonderUnitId, SHIPYARD, SIGHTING, REWARD_HEAVY, ACADEMY,
} from '../data/balance';
import { area, dist, idx, isLand, isWater, neighbors, tileAt } from './grid';
import { assignBaseKinds, generateMap } from './mapgen';
import { addHazards, burning, erupts } from './hazards';
import { placeTowers, towerCountFor } from './towers';
import { noteCapture, noteDeath, recordRound } from './history';
import { evaluateCampaign, landingPartyHolds, missionStarts, riftSpares, setupMission, spawnBlocked, swarmHolds } from './campaign';
import { processCorruption, processRandomEvents } from './events';
import { buildEmplacement, clearEmplacements, emplacementTarget, sweepEmplacements } from './emplacements';
import { fireOrbital, orbitalCheck, relayBuilt, wakeGunsAt } from './orbital';
import { addSighting, applyRadar, applySabotage, buySilo, dropSightings, fireSilo, followSightings, processFires, pruneSightings, radarCheck, sabotageCheck, siloBuyCheck, siloCheck, type ShadowKit } from './shadowFleet';
import { doWork, workCheck } from './mothership';
import { academyAttackCheck, academyAttackPreview, academyMissed, academyMoveCheck, arrivalSpot, beamCheck, beamerCheck, cancelTerraformCheck, forcedSpot, landCheck, landingOk, landTarget, liftCheck, nearestStand, razedKind, shieldCheck, shieldOver } from './academy';
import { applyCityHack, applyHack, applyHijack, buildHackTower, cityHackCheck, endHijacks, hackCheck, hackTowerCheck, hijackCheck, releaseHijacks, sweepHijacks, type HackKit } from './hacking';
import { addBattleScar, healScars } from './scars';
import { seizeCheck, seizePlans } from './temple';
import { canFace, faceTowards, facingTowards, spawnFacing } from './facing';
import {
  recruitCheck, plunderValue, isCultFaction, cultUnits, cultInGame, leavesMemorial, supplyLines, turretGuard, turretTargets, weatherHurts, quakeLocked, turretPreview, turretShotDamage, turretTarget, turretList, raceOdds, withEntrench, entrenchMiss, canEntrench, effectiveRange, mineCheck, mineTriggers,
  upkeep, attackTargets, submerged, barrierCheck, terraformCheck, buildCheck, cityUpgradeCheck, cityUpgrades, hasCityUpgrade, canAttackNow, canHeal, captureKind, cityById, combatPreview, contactStars,
  convertTargets, canActStill, canSeeUnit, embassyCost, grandProjectCheck, grandProjectConditionMet, has, healAmount,
  hasTech, hqOf, inContact, income, isHostile, weather, isRefuelSpot, levelUpCost, outpostCheck, ownCities, reachable, researchCost,
  rewardOptions, expandRadius, freeRingTiles, buyLevelCheck, buyLevelCost, score, trainCheck, unitAt, unitById, unitCost, upgradeCheck, veteranKills, visionRadius, visionRadiusAt,
  barrierCost, cityTiles, outpostClaim, outpostCost, perk2Of, factionVariant, hitChanceOn, hitDamage, hitOdds, rollHit, retreatCheck, retreatDamage, retreatTile, repairCheck, repairWreck, repairAmount, alienHealBlocked, rocketTargets, rocketsLeft,
  isWonder, factionVictoryOn, wonderCheck, wonderFootprint, wonderPhases, researchAllowed, korvatNeed, judgementNeed, judges, judgeAlive, isSinner, meridonNeed,
  cityAt, isBoss, isWonderStructure, gunHostile, gunStats, medicCanHeal, paidUnits, returnFire, buildingWorksFor, wonderGroundOk, baseBuilding, pilgrimVeteranAt, persuadeCheck, persuadeCost,
  basesOn, factoryXenoTiles, freeUnitSlots, recruitFootHp, trainFootHp, trainHome, academyOf, postsOf, trainSpot, trainedNow,
  medicHealAmount, flakDamage, mineDamage, fuelBurnAt, shipUpgradeCost, diplomacyLocked, emptyShipAt, shipSpawnTile, canWithdrawAfterAttack,
} from './queries';
import { nextRandom, randInt } from './rng';
import type { Reach } from './queries';
import type { City, Command, CommandResult, ErrorCode, Faction, GameConfig, GameEvent, GameState, Pos, Tile, Unit, Victory } from './types';

const fail = (error: ErrorCode): CommandResult => ({ ok: false, error, events: [] });

export function createGame(cfg: GameConfig): GameState {
  // neue Spiele: Trefferglueck und Fraktionssiege ausdruecklich an, wenn nicht anders gewaehlt (alte Spielstaende ohne Feld: aus, siehe save.ts)
  // new games: hit luck and faction victories explicitly on unless chosen otherwise (old saves without the field: off, see save.ts)
  const config: GameConfig = { ...cfg, hitChance: cfg.hitChance ?? true, factionVictory: cfg.factionVictory ?? true };
  const ids = config.factions.map((f) => f.id);
  // Kampagne m2: feste Startpunkte (Ecken, Kantenmitten, die Zyrr in der Mitte) / campaign m2: fixed start points (corners, edge midpoints, the Zyrr in the centre)
  const map = generateMap(config.seed, config.size, config.mapType, ids, config.theme === 'cavern' || config.theme === 'desert' ? config.theme : undefined, config.settlements ?? 1, missionStarts(config) ?? undefined);
  const n = config.size * config.size;
  const s: GameState = {
    version: 1,
    // Produktionsstaetten und Doktrinen (alte Spielstaende ohne Feld gleicht migrateState an) / production sites and doctrines (old saves without the field are migrated)
    sites: 1,
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
    // Velkar: die Hauptstadt ist die schwebende Akademie (ACADEMY), nur in freien Partien der Oberflaeche; die Kampagne und
    // die Hoehle behalten die alten Regeln / Velkar: the capital is the floating academy (ACADEMY), only in free games on
    // the surface; the campaign and the cavern keep the old rules
    if (config.factions[i].id === ACADEMY.faction && !config.campaign && config.theme !== 'cavern') c.academy = true;
  });
  const neutral = map.villages.map((v) => addCity(s, v.x, v.y, null, nameIndex++));
  map.starts.forEach((p, i) => {
    const alien = s.factions[i].id === XENO.faction;
    // Zyrr: Hauptquartier startet terraformt / Zyrr: HQ starts terraformed
    if (alien) for (const q of area(s.size, p.x, p.y, CITY.baseRadius)) { const tt = tileAt(s, q.x, q.y)!; if (tt.terrain !== 'ocean') tt.xeno = true; }
    const cult = isCultFaction(s, i);
    // Kult: Einheiten gehoeren zu keiner Stadt / cult: units belong to no city
    // eigene Bauart (VARIANTS, z. B. Alvenia: Lichtschuetzen) / own design (VARIANTS, e.g. Alvenia: Light Wardens)
    const u = spawnUnit(s, ROSTERS[s.factions[i].id]?.start ?? factionVariant(s, i, START.unit), i, p.x, p.y, cult ? null : s.cities[i].id);
    u.fresh = false;
    // weitere Starteinheiten der Fraktion (z. B. Dravon: Jeep), nur in der freien Partie / extra faction start units (e.g. Dravon: jeep), free game only
    if (!config.campaign) {
      for (const type of FACTIONS[s.factions[i].id].startExtra ?? []) {
        const q = freeNeighbor(s, p.x, p.y, false);
        if (!q) break;
        const e = spawnUnit(s, type, i, q.x, q.y, s.cities[i].id);
        e.fresh = false;
      }
    }
    // Kult: Starthorde auf freien Feldern neben dem Hauptquartier / cult: starting horde on free tiles next to the HQ
    if (cult) {
      for (const type of CULT.startUnits) {
        const q = freeNeighbor(s, p.x, p.y, false);
        if (!q) break;
        const h = spawnUnit(s, type, i, q.x, q.y, null);
        h.fresh = false;
      }
    }
  });
  addHazards(s, config.hazards ?? 'none');
  // Freie Partie: Sendetuerme nach Kartengroesse (TOWER), nach Siedlungen, Starteinheiten und Gefahren, damit sie nichts
  // verdraengen; die Kampagne setzt ihre eigenen (setupMission), die Hoehle hat keine, das Tutorial schaltet sie ab
  // free game: transmitter towers by map size (TOWER), after villages, start units and hazards so they displace nothing;
  // the campaign places its own (setupMission), the cavern has none, the tutorial turns them off
  const bases = basesOn(config);
  if (!config.campaign && config.theme !== 'cavern' && config.towers !== false) {
    const placed = placeTowers(s, towerCountFor(s.size), undefined, [TOWER.hqDistance, TOWER.freeHqDistance]);
    // Stuetzpunkte an (Spielerwunsch: Vielfalt auf allen Karten): die Orte der Sendetuerme werden Stuetzpunkte wie alle
    // anderen, an denselben Feldern; sie wachsen, lassen sich ausbauen und bekommen eine Art statt der Turm-Regeln (TOWER)
    // bases on (player request: variety on all maps): the transmitter towers' places become bases like all others, on the
    // same tiles; they grow, can be upgraded and get a kind instead of the tower rules (TOWER)
    if (bases) for (const c of placed) { delete c.tower; neutral.push(c); }
  }
  // Stuetzpunkte: jeder neutrale Ort bekommt seine Art (BASES, assignBaseKinds); sonst gewoehnliche Siedlungen und Sendetuerme
  // bases: every neutral place gets its kind (BASES, assignBaseKinds); otherwise ordinary villages and transmitter towers
  if (bases) {
    const kinds = assignBaseKinds(config.seed, s.size, s.tiles, neutral, map.homes, ids);
    neutral.forEach((c, i) => { c.base = kinds[i]; });
  }
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

/** Aussenposten erweitert das Gebiet, wenn er an eigenes Gebiet grenzt / outpost extends territory if it borders own territory */
function claimOutpost(s: GameState, f: number, x: number, y: number) {
  const t = tileAt(s, x, y)!;
  const claim = outpostClaim(s, f, x, y);
  if (!claim || !t.outpost) return;
  for (const k of claim.tiles) s.tiles[k].territory = claim.city;
  t.outpost.city = claim.city;
  t.outpost.claims = claim.tiles;
}

/** Vom Aussenposten erweiterte Felder wieder freigeben / release the tiles an outpost added */
function releaseOutpost(s: GameState, t: Tile) {
  const o = t.outpost;
  if (!o?.claims) return;
  for (const k of o.claims) {
    const q = s.tiles[k];
    // nur freigeben, wenn das Feld noch zu dieser Stadt gehoert, kein Gebaeude traegt und ausserhalb des Stadtradius liegt
    // only release if the tile still belongs to that city, carries no building and lies outside the city radius
    if (q.territory !== o.city || q.building) continue;
    const c = cityById(s, o.city!);
    if (c && dist(c, { x: k % s.size, y: Math.floor(k / s.size) }) <= c.radius) continue;
    q.territory = null;
  }
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
  // Wunder: Fortschritt ab 0, Waal mit wenig LP im Bau / wonders: progress from 0, the Waal with few HP while building
  if (type === 'coreDrill') u.stillRounds = 0;
  else if (st.abilities.includes('wonder')) {
    u.wonder = { stage: 0, progress: 0 };
    u.homeCity = null;
    if (type === 'waal') { u.hp = WONDERS.waalBuildHp; u.maxHp = WONDERS.waalBuildHp; }
  }
  // Ausrichtung zur Kartenmitte (Bauwerke ohne) / facing towards the map centre (structures without)
  spawnFacing(s.size, u);
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

/**
 * Freies Nachbarfeld fuer eine neue Einheit: kein Vulkan, keine Lava, nicht das Artefakt.
 * Free adjacent tile for a new unit: no volcano, no lava, not the artifact.
 */
function freeNeighbor(s: GameState, x: number, y: number, water: boolean): { x: number; y: number } | null {
  for (const p of neighbors(s.size, x, y)) {
    const t = tileAt(s, p.x, p.y)!;
    if (unitAt(s, p.x, p.y) || t.wonderOf || t.turret || t.temple || spawnBlocked(s, p)) continue;
    if (water ? !isWater(t) : !isLand(t)) continue;
    if (!water && (t.terrain === 'mountain' || t.volcano || burning(s, t))) continue;
    return p;
  }
  return null;
}

/** Aufstieg um eine Stufe mit Belohnungswahl (wie durch Bevoelkerung) / level-up by one with a reward choice (as by population) */
function raiseLevel(s: GameState, c: City, ev: GameEvent[], bought = false) {
  c.level++;
  ev.push({ t: 'cityLevel', city: c.id, level: c.level, ...(bought ? { bought: true as const } : {}) });
  growTerritory(s, c, ev);
  if (c.owner !== null) s.pendingRewards.push({ cityId: c.id, level: c.level });
}

/**
 * Wachstum je Stufe (CITY.growTiles): bis zu growTiles freie Felder im naechsten Ring, die naechsten zuerst; ein voller Ring
 * wird zum Radius, der Rest waechst im naechsten weiter, hoechstens bis CITY.growMaxRadius. Fremde Felder bleiben fremd.
 * Neue Felder werden fuer den Besitzer aufgedeckt (wie bei der Grenzerweiterung).
 * Growth per level (CITY.growTiles): up to growTiles free tiles in the next ring, nearest first; a full ring becomes the
 * radius, the rest grows on in the next one, at most up to CITY.growMaxRadius. Foreign tiles stay foreign. New tiles are
 * revealed for the owner (as with the border expansion).
 */
function growTerritory(s: GameState, c: City, ev: GameEvent[]) {
  const f = c.owner;
  // Kult, Sendetuerme und Nachschublinien wachsen nicht / cult, transmitter towers and supply lines do not grow
  if (f === null || c.tower || c.post || supplyLines(s) || isCultFaction(s, f)) return;
  let left = CITY.growTiles;
  while (left > 0 && c.radius < CITY.growMaxRadius) {
    const ring = c.radius + 1;
    const free = freeRingTiles(s, c, ring);
    for (const p of free.slice(0, left)) {
      tileAt(s, p.x, p.y)!.territory = c.id;
      reveal(s, f, p.x, p.y, VISION.cityExtra, ev);
    }
    if (free.length > left) break;
    left -= free.length;
    c.radius = ring;
  }
}

function addPop(s: GameState, c: City, amount: number, ev: GameEvent[]) {
  // Forschungsposten wachsen nicht: ihre Bevoelkerung geht an die Akademie / research posts do not grow: their population goes to the academy
  if (c.post && c.owner !== null) {
    const ac = academyOf(s, c.owner);
    if (ac) addPop(s, ac, amount, ev);
    return;
  }
  // Nachschublinien, Sendetuerme und Kult-Staedte wachsen nicht / supply lines, transmitter towers and cult cities do not grow
  if (supplyLines(s) || c.tower || (c.owner !== null && isCultFaction(s, c.owner))) return;
  c.pop += amount;
  while (c.pop >= levelUpCost(s, c)) {
    c.pop -= levelUpCost(s, c);
    raiseLevel(s, c, ev);
  }
}

/**
 * Riss (Kampagne m11): die Schwarmmutter stirbt nicht, sie bleibt mit 1 LP stehen; die Auswertung oeffnet dann den Riss.
 * Rift (campaign m11): the Swarm Mother does not die, she stays on 1 HP; the evaluation then opens the rift.
 */
function spare(s: GameState, u: Unit | undefined) {
  if (u && u.hp <= 0 && riftSpares(s, u)) u.hp = 1;
}

function killUnit(s: GameState, u: Unit, by: number | null, ev: GameEvent[], leaveRemains = true) {
  s.units = s.units.filter((o) => o.id !== u.id);
  // Radarimpuls endet mit dem Radarwagen / the radar sweep ends with the Radar Truck
  if (has(u, 'radar')) dropSightings(s, u.id);
  if (leaveRemains) noteDeath(s, u); // Statistik / statistics
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
    // Kult im Spiel: der gefallene Soldat wird zum Mahnmal, ein neuer Tod erneuert die Dauer (kein Stapeln)
    // cult in the game: the fallen soldier becomes a memorial, a new death refreshes the duration (no stacking)
    if (leavesMemorial(u.type) && cultInGame(s)) t.memorial = { until: s.round + CULT.memorialRounds, unit: u.type, faction: u.owner };
  }
  // Schlachtfeld: Tod hinterlaesst Spuren, Wracks (auch Schiffe auf See) mehr / battlefield: a death scars the tile, wrecks (ships at sea too) more
  if (leaveRemains) addBattleScar(s, u.x, u.y, REMAINS.wreckUnits.includes(u.type) || UNITS[u.type].ship ? WAR_MARKS.scar.wreck : WAR_MARKS.scar.death);
  ev.push({ t: 'killed', unit: u.id, by, remains: kind, x: u.x, y: u.y });
  // Wunder zerstoert: Grundflaeche freigeben / wonder destroyed: release its footprint
  if (isWonder(u)) {
    clearWonderMarks(s);
    ev.push({ t: 'wonder', what: 'destroyed', kind: u.type as WonderUnitId, unit: u.id, faction: u.owner, x: u.x, y: u.y, stage: u.wonder?.stage });
  }
  // Vesper, Maertyrertum: im Kampf Gefallene bringen Sterne / martyrdom: units fallen in battle bring stars
  if (by !== null && leaveRemains && perk2Of(s, u.owner) === 'martyrdom' && s.factions[u.owner].alive) s.factions[u.owner].stars += PERKS2.martyrdomStars;
  // Grosses Strafgericht: eine richtende Fraktion mit Siegtechnologie vernichtet eine Einheit eines Suenders
  // Great Judgement: a judging faction with the victory tech destroys a unit of a sinner
  const killer = by !== null ? unitById(s, by) : undefined;
  if (killer && killer.owner !== u.owner && judges(s, killer.owner) && isSinner(s, u.owner) && factionVictoryOn(s) && hasTech(s, killer.owner, VICTORY_TECH[s.factions[killer.owner].id])) {
    const jf = s.factions[killer.owner];
    jf.judged = (jf.judged ?? 0) + 1;
  }
  // Alvenia, Maertyrer-Segen: im Kampf Gefallene segnen eigene Nachbarn / Martyr's Blessing: units fallen in battle bless own neighbours
  if (by !== null && leaveRemains && perk2Of(s, u.owner) === 'martyrBlessing') martyrBlessing(s, u, ev);
}

/**
 * Maertyrer-Segen: eigene Einheiten neben der gefallenen Einheit u heilen MARTYR.heal LP und sind bis zum Ende der
 * naechsten Runde gesegnet (Verteidigung, MARTYR). Wunder-Bauwerke nicht. Ohne Nachbarn kein Ereignis.
 * Martyr's Blessing: own units next to the fallen unit u heal MARTYR.heal HP and are blessed until the end of the next
 * round (defence, MARTYR). Not wonder structures. No event without neighbours.
 */
function martyrBlessing(s: GameState, u: Unit, ev: GameEvent[]) {
  const until = s.round + MARTYR.rounds - 1;
  const units: { unit: number; heal: number }[] = [];
  for (const o of s.units) {
    if (o.owner !== u.owner || dist(o, u) !== 1 || isWonderStructure(o) || o.hp <= 0) continue;
    const heal = Math.max(0, Math.min(MARTYR.heal, o.maxHp - o.hp));
    o.hp += heal;
    o.blessed = until;
    units.push({ unit: o.id, heal });
  }
  if (units.length) ev.push({ t: 'blessing', unit: u.id, faction: u.owner, x: u.x, y: u.y, until, units });
}

/**
 * Suendentat der Fraktion f: Zeichen fuer SIN.rounds Runden (frischt auf). Nur, solange eine richtende Fraktion lebt; die
 * richtende Fraktion selbst wird nie gezeichnet.
 * Sinful deed of faction f: mark for SIN.rounds rounds (refreshes). Only while a judging faction lives; the judging faction
 * itself is never marked.
 */
export function markSin(s: GameState, f: number, deed: SinDeed, ev: GameEvent[]) {
  if (!s.factions[f] || judges(s, f) || !judgeAlive(s)) return;
  // gottlose Fraktionen sind ohnehin Suender: keine neue Meldung / godless factions are sinners anyway: no new toast
  const fresh = !isSinner(s, f);
  const until = s.round + SIN.rounds - 1;
  s.factions[f].sin = { deed, until };
  ev.push({ t: 'sin', faction: f, deed, until, fresh });
}

/** Markierungen von Wundern entfernen, die es nicht mehr gibt / remove marks of wonders that no longer exist */
function clearWonderMarks(s: GameState) {
  for (const t of s.tiles) if (t.wonderOf && !unitById(s, t.wonderOf)) t.wonderOf = null;
}

/**
 * Angriff auf ein Wunder: unterbrechbare Wunder (WONDERS.interruptible: Portal, Relais, Kraftwerk, Bohrer) verlieren den Fortschritt der laufenden Phase (fertige Phasen bleiben).
 * Attack on a wonder: interruptible wonders (WONDERS.interruptible: portal, relay, power plant, drill) lose the progress of the current phase (finished phases are kept).
 */
function interruptWonder(s: GameState, u: Unit, ev: GameEvent[]) {
  if (!isWonder(u) || !WONDERS.interruptible[u.type as WonderUnitId] || !unitById(s, u.id)) return;
  let lost = false;
  if (u.type === 'coreDrill') { lost = (u.stillRounds ?? 0) > 0; u.stillRounds = 0; }
  else if (u.wonder) { lost = u.wonder.progress > 0; u.wonder.progress = 0; }
  if (lost) ev.push({ t: 'wonder', what: 'interrupted', kind: u.type as WonderUnitId, unit: u.id, faction: u.owner, x: u.x, y: u.y, stage: u.wonder?.stage });
}

/** Sieg festhalten und Spiel beenden / record the victory and end the game */
function declareWinner(s: GameState, winner: number | null, kind: Victory['kind'], ev: GameEvent[]) {
  s.over = true;
  s.winner = winner;
  const victory: Victory | undefined = winner !== null ? { kind, faction: s.factions[winner].id } : undefined;
  s.victory = victory;
  ev.push({ t: 'gameOver', winner, ...(victory ? { victory } : {}) });
}

/**
 * Siegbedingungen der Fraktion f zu Beginn ihres Zuges: Wunder schreiten fort, dann Korvat, Meridon und Alvenia.
 * Victory conditions of faction f at the start of its turn: wonders progress, then Korvat, Meridon and Alvenia.
 */
function processFactionVictory(s: GameState, f: number, stillDrills: Set<number>, ev: GameEvent[]) {
  if (!factionVictoryOn(s) || s.over) return;
  const fa = s.factions[f];
  for (const u of s.units) {
    if (u.owner !== f || !isWonder(u)) continue;
    if (u.type === 'coreDrill') {
      // nur wer im letzten eigenen Zug nicht gefahren ist, bohrt weiter / only a drill that did not move last own turn keeps drilling
      u.stillRounds = stillDrills.has(u.id) ? (u.stillRounds ?? 0) + 1 : 0;
      if (u.stillRounds >= WONDERS.drillRounds) { declareWinner(s, f, 'faction', ev); return; }
      continue;
    }
    const w = u.wonder ?? (u.wonder = { stage: 0, progress: 0 });
    // Fortschritt ruht, solange das Ankerfeld nicht im eigenen Gebiet liegt / progress pauses while the anchor tile is not own territory
    if (!wonderGroundOk(s, u)) continue;
    const phases = wonderPhases(u.type as WonderUnitId);
    w.progress++;
    if (w.progress < phases[w.stage]) continue;
    w.stage++;
    w.progress = 0;
    if (u.type === 'waal') {
      // Waal: bewaffnet mit mehr LP, fertig mit vollen LP / Waal: armed with more HP, finished with full HP
      const max = w.stage >= phases.length ? UNITS.waal.hp : WONDERS.waalArmedHp;
      u.hp += max - u.maxHp;
      u.maxHp = max;
    }
    ev.push({ t: 'wonder', what: 'phase', kind: u.type as WonderUnitId, unit: u.id, faction: f, x: u.x, y: u.y, stage: w.stage });
    if (w.stage >= phases.length) { declareWinner(s, f, 'faction', ev); return; }
  }
  if (!fa.techs.includes(VICTORY_TECH[fa.id])) return;
  if (fa.id === 'korvat' && ownCities(s, f).length >= korvatNeed(s)) { declareWinner(s, f, 'faction', ev); return; }
  if (fa.id === 'meridon' && fa.stars >= meridonNeed(s)) { declareWinner(s, f, 'faction', ev); return; }
  // Alvenia, Grosses Strafgericht: genug Einheiten von Suendern vernichtet / Great Judgement: enough units of sinners destroyed
  if (fa.id === 'alvenia' && (fa.judged ?? 0) >= judgementNeed(s)) declareWinner(s, f, 'faction', ev);
}

function gainKill(s: GameState, u: Unit, ev: GameEvent[]) {
  u.kills++;
  s.factions[u.owner].kills++;
  // Kaperschiff: Beute je Abschuss / privateer: prize money per kill
  if (has(u, 'plunder')) s.factions[u.owner].stars += UNIQUE.plunderStars;
  // Tote Schuetzen (Gegenschlag beim Flaechenschaden) und Endgegner werden nie befoerdert oder geheilt
  // dead shooters (return fire during splash) and bosses are never promoted or healed
  // Kamikaze-Drohnen sind nach dem Angriff verbraucht / kamikaze drones are spent after the attack
  if (u.hp <= 0 || isBoss(u) || has(u, 'kamikaze')) return;
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
  // keine Grossprojekte an Nachschublinien und beim Kult / no grand projects at supply lines and for the cult
  if (supplyLines(s) || isCultFaction(s, f)) return;
  for (const id of GRAND_PROJECT_IDS) {
    if (fa.grandProjectsUnlocked.includes(id)) continue;
    if (grandProjectConditionMet(s, f, id)) { fa.grandProjectsUnlocked.push(id); ev.push({ t: 'unlockGrand', id, faction: f }); }
  }
}

/**
 * Ausgeschieden? Normal ohne Stadt (der Landetrupp der Kampagne lebt, solange er Einheiten hat, die Zyrr in m2 haben
 * nie eine Basis); der Kult ohne Einheit (Wunder zaehlen nicht), seine Staedte werden dann neutral.
 * Eliminated? Normally without a city (the campaign landing party lives while it has units, the Zyrr in m2 never have
 * a base); the cult without a unit (wonders do not count), its cities then turn neutral.
 */
function eliminatedNow(s: GameState, f: number): boolean {
  if (isCultFaction(s, f)) return cultUnits(s, f).length === 0;
  return ownCities(s, f).length === 0 && !landingPartyHolds(s, f) && !swarmHolds(s, f);
}

/** cultOnly: nur den Kult pruefen (nach jedem Kommando und Zugwechsel) / only check the cult (after every command and turn change) */
function checkElimination(s: GameState, ev: GameEvent[], cultOnly = false) {
  for (const f of s.factions) {
    if (!f.alive || (cultOnly && !isCultFaction(s, f.index))) continue;
    if (eliminatedNow(s, f.index)) {
      f.alive = false;
      f.eliminatedRound = s.round;
      // Hacker scheidet aus: uebernommene Einheiten kehren vorher zurueck / hacker eliminated: taken-over units return first
      releaseHijacks(s, f.index, ev, hackKit(s));
      // verbliebene Einheiten verschwinden mit Ereignis (Wunder: auch 'destroyed') / remaining units vanish with an event (wonders: also 'destroyed')
      for (const u of s.units.filter((o) => o.owner === f.index)) killUnit(s, u, null, ev, false);
      // gebeamte Einheiten unterwegs verschwinden mit / beamed units in transit vanish too
      if (s.transit) { s.transit = s.transit.filter((b) => b.unit.owner !== f.index); if (!s.transit.length) delete s.transit; }
      // Minen und Sperren verschwinden, Aussenposten werden frei / mines and barriers vanish, outposts are released
      for (const t of s.tiles) {
        if (t.mine?.owner === f.index) t.mine = null;
        if (t.barrier?.owner === f.index) t.barrier = null;
        if (t.outpost?.owner === f.index) { releaseOutpost(s, t); t.outpost = null; }
      }
      // Geschuetzstellungen werden geschleift / gun emplacements are razed
      clearEmplacements(s, f.index, ev);
      clearWonderMarks(s);
      s.pendingRewards = s.pendingRewards.filter((p) => cityById(s, p.cityId)?.owner !== f.index);
      // Kult: verlassene Staedte werden neutrale Siedlungen ohne Gebiet / cult: abandoned cities turn into neutral settlements without territory
      for (const c of ownCities(s, f.index)) {
        c.owner = null; c.connected = false;
        for (const t of s.tiles) if (t.territory === c.id) t.territory = null;
      }
      ev.push({ t: 'eliminated', faction: f.index });
    }
  }
  const alive = s.factions.filter((f) => f.alive);
  if (alive.length <= 1 && !s.over) declareWinner(s, alive.length ? alive[0].index : null, 'conquest', ev);
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
    const gross = income(s, f);
    // Sold nicht bezahlbar: die neuesten bezahlten Einheiten desertieren, bis der Rest bezahlbar ist (Wunder nie)
    // upkeep unaffordable: the newest paid units desert until the rest is affordable (never wonders)
    for (let paid = paidUnits(s, f); paid.length && fa.stars + gross - upkeep(s, f) < 0; paid = paidUnits(s, f)) {
      const u = paid[paid.length - 1];
      killUnit(s, u, null, ev, false);
      ev.push({ t: 'deserted', unit: u.id, unitType: u.type, faction: f, x: u.x, y: u.y });
    }
    // Einkommen minus Sold; Sterne fallen nie unter 0 / income minus upkeep; stars never drop below 0
    inc = gross - upkeep(s, f);
    fa.stars = Math.max(0, fa.stars + inc);
  }
  // Korruption (Meridon): Zufallsereignis nach dem Einkommen (CORRUPTION) / corruption (Meridon): random event after income (CORRUPTION)
  processCorruption(s, f, ev);
  // abgelaufene Sichtungen und Radarimpulse / expired sightings and radar sweeps
  pruneSightings(fa, s.round);
  for (const c of ownCities(s, f)) c.noIncomeNext = false;
  // Erdkernbohrer, die im letzten eigenen Zug stillstanden / earth-core drills that stood still during the last own turn
  const stillDrills = new Set(s.units.filter((u) => u.owner === f && u.type === 'coreDrill' && !u.moved).map((u) => u.id));
  // Kolchose: alle paar Runden Bevoelkerung fuer ihre Stadt / kolkhoz: population for its city every few rounds
  if (s.round > 1 && s.round % UNIQUE.kolkhozInterval === 0) {
    for (const c of ownCities(s, f)) {
      if (buildingWorksFor(s, f, 'kolkhoz') && cityTiles(s, c).some((p) => tileAt(s, p.x, p.y)!.building === 'kolkhoz')) addPop(s, c, UNIQUE.kolkhozPop, ev);
    }
  }
  // gebeamte Einheiten erscheinen vor dem Zuruecksetzen und sind sofort einsatzbereit / beamed units appear before the reset and are ready at once
  beamArrivals(s, f, ev);
  for (const u of s.units) {
    if (u.owner !== f) continue;
    // Selbstheilung (Friedenswacht) / self-repair (peacekeepers)
    if (has(u, 'mend') && u.hp < u.maxHp) {
      const amount = Math.min(UNIQUE.mendHp, u.maxHp - u.hp);
      u.hp += amount;
      ev.push({ t: 'heal', unit: u.id, amount });
    }
    u.moved = false; u.attacked = false; u.moveDone = false; u.exhausted = false; u.fresh = false;
    u.startX = u.x; u.startY = u.y; u.revealed = false;
    if (u.withdraw) delete u.withdraw;
    u.slowed = !!u.slowedNext; u.slowedNext = false;
    if (u.fuel !== null && isRefuelSpot(s, f, u.x, u.y)) u.fuel = FUEL.tank;
    // Raketen nachladen nur in eigener Stadt mit Depot / reload rockets only in an own city with a depot
    if (ROCKETS.units.includes(u.type) && (u.rockets ?? ROCKETS.max) < ROCKETS.max) {
      const c = s.cities.find((cc) => cc.x === u.x && cc.y === u.y);
      // Ausbau Depot oder Stuetzpunkt Nachschubdepot (BASES.builtInUpgrade) / depot upgrade or supply depot base (BASES.builtInUpgrade)
      if (c && c.owner === f && ((c.upgrades ?? []).includes('depot') || (c.base !== undefined && BASES.builtInUpgrade[c.base] === 'depot'))) u.rockets = ROCKETS.max;
    }
  }
  // Akademie: hebt ab -> schwebt, Felder fuer diesen Zug, Schild laedt auf / academy: lifting -> floating, tiles for this turn, the shield recharges
  const ac = academyOf(s, f);
  if (ac) academyTurn(s, ac, ev);
  ev.push({ t: 'turn', faction: f, round: s.round, income: inc, weather: weather(s) });
  for (const u of s.units.filter((o) => o.owner === f && isBoss(o))) bossTurn(s, u, ev);
  afterAction(s, f, ev);
  processFactionVictory(s, f, stillDrills, ev);
}

/** Akademie zu Beginn des eigenen Zuges / academy at the start of the own turn */
function academyTurn(s: GameState, c: City, ev: GameEvent[]) {
  if (c.air?.phase === 'terraform') {
    // Terraformen: zu Beginn des naechsten eigenen Zuges landen; geht es nicht mehr (fremdes Gebiet, fremde Einheit, neuer Ort
    // daneben ...), schwebt sie weiter mit vollen Feldern
    // terraforming: land at the start of the next own turn; if that is no longer possible (foreign territory, foreign unit,
    // new place next to it ...), it keeps floating with full tiles
    const left = (c.air.left ?? 1) - 1;
    if (left > 0) c.air.left = left;
    else {
      const at = landTarget(s, c);
      if (landingOk(s, c, at)) touchDown(s, c, at, ev);
      else {
        c.air = { phase: 'flying', steps: ACADEMY.move };
        ev.push({ t: 'academy', what: 'abort', city: c.id, faction: c.owner!, x: c.x, y: c.y });
      }
    }
  } else if (c.air) {
    if (c.air.phase === 'lifting') ev.push({ t: 'academy', what: 'float', city: c.id, faction: c.owner!, x: c.x, y: c.y });
    c.air = { phase: 'flying', steps: ACADEMY.move };
  }
  if (c.shield && c.shield.hp < c.shield.max) {
    c.shield.hp = Math.min(c.shield.max, c.shield.hp + ACADEMY.shield.regen);
    ev.push({ t: 'shield', what: 'regen', city: c.id, faction: c.owner!, hp: c.shield.hp });
  }
}

/**
 * Neutralen Ort v einebnen (ACADEMY.terraform): er verschwindet aus dem Spiel, sein Gebiet wird Akademie-Gebiet; kein
 * Einnehmen, keine Belohnung. Er bleibt in GameState.razed, damit die uebrigen Orte ihre Namen behalten.
 * Level the neutral place v (ACADEMY.terraform): it vanishes from the game, its territory becomes academy territory; no
 * capture, no reward. It stays in GameState.razed so the other places keep their names.
 */
function razePlace(s: GameState, c: City, v: City) {
  for (const t of s.tiles) {
    if (t.territory === v.id) t.territory = c.id;
    if (t.cityId === v.id) t.cityId = null;
  }
  for (const u of s.units) if (u.homeCity === v.id) u.homeCity = null;
  s.cities = s.cities.filter((o) => o.id !== v.id);
  (s.razed ??= []).push({ ...v, upgrades: undefined, works: undefined });
}

/**
 * Landung nach dem Terraformen auf p (eigenes Feld oder benachbarter neutraler Ort): Ort einebnen, Rohstoff aufnehmen
 * (ACADEMY.terraform.resourcePop Bevoelkerung), neutrale Gebaeude, Merkmale, Truemmer und Spuren raeumen, Gelaende wird
 * Ebene (bleibt nach dem Abheben so). Dann wie bisher: Feld und freies Umland (ACADEMY.landClaim) werden Akademie-Gebiet,
 * Produktion ab dem naechsten eigenen Zug.
 * Landing after terraforming on p (own tile or adjacent neutral place): level the place, absorb the resource
 * (ACADEMY.terraform.resourcePop population), clear neutral buildings, features, debris and marks, the terrain becomes
 * plain (and stays so after lift-off). Then as before: the tile and free surroundings (ACADEMY.landClaim) become academy
 * territory, production from the next own turn.
 */
function touchDown(s: GameState, c: City, p: Pos, ev: GameEvent[]) {
  const f = c.owner!;
  const t = tileAt(s, p.x, p.y)!;
  const terrain = t.terrain;
  const v = t.cityId !== null && t.cityId !== c.id ? cityById(s, t.cityId) : undefined;
  const razed = v ? razedKind(v) : undefined;
  if (v) razePlace(s, c, v);
  const from = { x: c.x, y: c.y };
  if (p.x !== c.x || p.y !== c.y) {
    tileAt(s, c.x, c.y)!.cityId = null;
    c.x = p.x; c.y = p.y;
  }
  t.cityId = c.id;
  delete c.air;
  const resource = t.resource ?? undefined;
  if (t.resource) t.resource = null;
  const cleared = (t.building && t.building !== 'road' ? t.building : null) ?? t.feature ?? undefined;
  if (t.building && t.building !== 'road') { t.building = null; t.researchBuilt = null; }
  t.feature = null; delete t.looted;
  t.remains = null; t.barrier = null; t.xeno = false; t.memorial = null;
  delete t.marks; delete t.scar; delete t.tracks; delete t.turretRuin; delete t.turretRuinOwner;
  // Gelaende wird Ebene, Landschaft wird Wiese (Laborrasen; sichtbare Terraform-Spur, die bleibt) / terrain becomes plain, biome becomes grassland (lab lawn; a visible terraform mark that stays)
  const biome = t.biome && t.biome !== 'grassland' ? t.biome : undefined;
  t.terrain = 'plain';
  t.biome = 'grassland';
  delete t.peak;
  if (resource) addPop(s, c, ACADEMY.terraform.resourcePop, ev);
  // Landen: Feld und neutrales Umland (ACADEMY.landClaim) werden Akademie-Gebiet; Produktion ab dem naechsten eigenen Zug
  // landing: the tile and neutral surroundings (ACADEMY.landClaim) become academy territory; production from the next own turn
  c.radius = ACADEMY.landClaim;
  for (const q of area(s.size, c.x, c.y, ACADEMY.landClaim)) {
    const o = tileAt(s, q.x, q.y)!;
    if (o.territory === null && o.cityId === null) o.territory = c.id;
  }
  t.territory = c.id;
  // Landung zu Beginn des eigenen Zuges: Produktion nach ACADEMY.terraform.calmAfter Runden (0 = sofort)
  // landing at the start of the own turn: production after ACADEMY.terraform.calmAfter rounds (0 = at once)
  c.calm = s.round + ACADEMY.terraform.calmAfter;
  reveal(s, f, c.x, c.y, c.radius + VISION.cityExtra, ev);
  ev.push({ t: 'academy', what: 'land', city: c.id, faction: f, x: c.x, y: c.y, ...(from.x !== c.x || from.y !== c.y ? { from } : {}),
    ...(terrain !== 'plain' ? { terrain } : {}), ...(biome ? { biome } : {}), ...(razed ? { razed } : {}), ...(resource ? { resource } : {}), ...(cleared ? { cleared } : {}) });
  updateConnections(s, f, ev);
}

/**
 * Schild der Akademie faengt bis zu dmg Schaden ab (Angriff auf eine Einheit auf ihrem Feld); liefert den Rest.
 * The academy's shield absorbs up to dmg damage (attack on a unit on its tile); returns the rest.
 */
function shieldTake(s: GameState, c: City, dmg: number, by: number | null, ev: GameEvent[]): number {
  const sh = c.shield;
  if (!sh || sh.hp <= 0 || dmg <= 0) return dmg;
  const took = Math.min(sh.hp, dmg);
  sh.hp -= took;
  ev.push({ t: 'shield', what: 'hit', city: c.id, faction: c.owner!, hp: sh.hp, dmg: took, ...(by !== null ? { unit: by } : {}) });
  if (sh.hp <= 0) {
    delete c.shield;
    c.shieldReady = s.round + ACADEMY.shield.rebuildRounds;
    ev.push({ t: 'shield', what: 'down', city: c.id, faction: c.owner!, hp: 0 });
  }
  return dmg - took;
}

/**
 * Notlandung: die Akademie setzt auf dem naechsten freien Land auf; ihre Produktion ruht bis nach dem naechsten eigenen Zug.
 * Emergency landing: the academy touches down on the nearest free land; its production rests until after the next own turn.
 */
function forceLanding(s: GameState, c: City, by: number, ev: GameEvent[]) {
  const p = forcedSpot(s, c);
  const from = { x: c.x, y: c.y };
  if (p && (p.x !== c.x || p.y !== c.y)) {
    tileAt(s, c.x, c.y)!.cityId = null;
    c.x = p.x; c.y = p.y;
    tileAt(s, c.x, c.y)!.cityId = c.id;
  }
  const t = tileAt(s, c.x, c.y)!;
  t.territory = c.id; t.resource = null;
  delete c.air;
  const own = c.owner!;
  // naechster eigener Zug: diese Runde, wenn die Fraktion noch dran kommt, sonst die naechste / next own turn: this round if the faction still moves, else the next
  c.calm = (own > s.current ? s.round : s.round + 1) + 1;
  ev.push({ t: 'academy', what: 'forced', city: c.id, faction: own, x: c.x, y: c.y, from, by });
}

/**
 * Endgegner zu Beginn seines Zuges: Heilung auf Xeno-Boden, psychischer Schrei gegen alle feindlichen Nachbarn,
 * Brut auf freien Nachbarfeldern. Alles deterministisch, ohne Wurf; Zahlen in SWARM_MOTHER.
 * Boss at the start of its turn: healing on xeno ground, psychic scream against all hostile neighbours,
 * brood on free adjacent tiles. All deterministic, without a roll; numbers in SWARM_MOTHER.
 */
function bossTurn(s: GameState, u: Unit, ev: GameEvent[]) {
  const B = SWARM_MOTHER;
  const ready = u.boss ?? (u.boss = { scream: s.round, brood: s.round });
  // Heilung nur, wenn sie seit ihrem letzten Zug keinen Schaden genommen hat / heals only if she took no damage since her last turn
  const unhurt = ready.hp === undefined || u.hp >= ready.hp;
  if (tileAt(s, u.x, u.y)!.xeno && u.hp < u.maxHp && unhurt) {
    const amount = Math.min(B.xenoHeal, u.maxHp - u.hp);
    u.hp += amount;
    ev.push({ t: 'heal', unit: u.id, amount });
  }
  ready.hp = u.hp;
  const foes = s.units.filter((o) => o.owner !== u.owner && isHostile(s, u.owner, o.owner) && dist(o, u) <= B.screamRange && !isWonder(o) && !submerged(s, o))
    .sort((a, b) => a.id - b.id);
  if (foes.length && s.round >= ready.scream) {
    const hits = foes.map((o) => ({ unit: o.id, dmg: Math.min(o.hp, B.screamDamage) }));
    ready.scream = s.round + B.screamEvery;
    ev.push({ t: 'boss', what: 'scream', unit: u.id, faction: u.owner, x: u.x, y: u.y, hits });
    for (const o of foes) {
      o.hp -= B.screamDamage;
      if (o.hp <= 0) { killUnit(s, o, u.id, ev); gainKill(s, u, ev); }
    }
  }
  if (s.round >= ready.brood && s.units.filter((o) => o.owner === u.owner).length < B.broodCap) {
    let count = 0;
    for (const p of neighbors(s.size, u.x, u.y)) {
      if (count >= B.broodCount) break;
      const t = tileAt(s, p.x, p.y)!;
      if (!isLand(t) || t.terrain === 'mountain' || t.volcano || t.wonderOf || t.temple || burning(s, t) || unitAt(s, p.x, p.y) || spawnBlocked(s, p)) continue;
      const c = cityAt(s, p.x, p.y);
      if (c && c.owner !== u.owner) continue;
      spawnUnit(s, B.broodUnit, u.owner, p.x, p.y, null);
      count++;
    }
    ready.brood = s.round + B.broodEvery;
    if (count) ev.push({ t: 'boss', what: 'brood', unit: u.id, faction: u.owner, x: u.x, y: u.y, count });
  }
}

function endTurnProcessing(s: GameState, ev: GameEvent[]) {
  const f = s.current;
  // Verschanzen (ENTRENCH): wer diesen ganzen Zug nicht gezogen hat und nicht neu ist, ist verschanzt
  // entrenching (ENTRENCH): a unit that did not move during this whole turn and is not new is entrenched
  if ((ENTRENCH.bonus[s.factions[f].id] ?? 0) > 0) {
    for (const u of s.units) if (u.owner === f) u.entrenched = canEntrench(u) && !u.moved && !u.fresh;
  }
  for (const u of s.units.slice()) {
    if (u.owner !== f || u.fuel === null) continue;
    if (isRefuelSpot(s, f, u.x, u.y)) continue;
    // Doktrin Heeresflieger: im eigenen Gebiet kein Sprit / army aviation doctrine: no fuel in own territory
    u.fuel -= fuelBurnAt(s, f, u.x, u.y);
    if (u.fuel <= 0) { killUnit(s, u, null, ev); ev.push({ t: 'crash', unit: u.id }); }
  }
  // Flugabwehr feindlicher Staedte trifft Hubschrauber, die hier ihren Zug beenden
  // flak of hostile cities hits helicopters ending their turn nearby
  for (const u of s.units.slice()) {
    if (u.owner !== f || !UNITS[u.type].abilities.includes('fly')) continue;
    const c = s.cities.find((cc) => cc.owner !== null && cc.owner !== f && isHostile(s, f, cc.owner) && (cc.upgrades ?? []).includes('flak') && dist(cc, u) <= CITY_UPGRADES.flakRange);
    if (!c) continue;
    const dmg = flakDamage(s, c.owner!, CITY_UPGRADES.flakDamage);
    u.hp -= dmg;
    ev.push({ t: 'flak', city: c.id, unit: u.id, dmg });
    if (u.hp <= 0) killUnit(s, u, null, ev);
  }
  flakZones(s, f, ev);
}

/**
 * Flak-Feuerzone der Konter-Einheiten: feindliche Flieger, die neben einer Flak ihren Zug beenden, nehmen Schaden.
 * Flak zone of counter units: hostile flyers ending their turn next to a flak unit take damage.
 */
function flakZones(s: GameState, f: number, ev: GameEvent[]) {
  for (const u of s.units.slice()) {
    if (u.owner !== f || !UNITS[u.type].abilities.includes('fly')) continue;
    const aa = s.units.find((o) => o.owner !== f && isHostile(s, f, o.owner) && has(o, 'flak') && dist(o, u) <= COUNTER.flak.range);
    if (!aa) continue;
    // Doktrin Aerodynamik des Flak-Besitzers: mehr Schaden / aerodynamics doctrine of the flak's owner: more damage
    const dmg = flakDamage(s, aa.owner, COUNTER.flak.damage);
    u.hp -= dmg;
    ev.push({ t: 'aaFire', unit: aa.id, target: u.id, dmg });
    if (u.hp <= 0) { killUnit(s, u, aa.id, ev); gainKill(s, aa, ev); }
  }
}

/**
 * Erste feindliche Mine auf dem Weg: die Bewegung endet dort. Felder mit anderer Einheit (Flieger darueber) loesen nicht aus.
 * First hostile mine on the path: the move ends there. Tiles holding another unit (a flyer above) do not trigger.
 */
function cutAtMine(s: GameState, u: Unit, r: Reach): { reach: Reach; mine: boolean } {
  const last = r.path.length - 1;
  for (let i = 0; i <= last; i++) {
    const p = r.path[i];
    const t = tileAt(s, p.x, p.y)!;
    if (!t.mine || !isLand(t)) continue;
    // Landungsboot: nur beim Anlanden auf dem letzten Feld / landing boat: only when disembarking on the last tile
    const probe = isShipUnit(u) && i === last && r.disembark && u.carried ? { ...u, type: u.carried } : u;
    if (!mineTriggers(s, probe, p.x, p.y)) continue;
    if (i < last && unitAt(s, p.x, p.y)) continue;
    return { reach: { ...r, x: p.x, y: p.y, path: r.path.slice(0, i + 1), embark: false, board: false, disembark: i === last ? r.disembark : false }, mine: true };
  }
  return { reach: r, mine: false };
}
const isShipUnit = (u: Unit) => UNITS[u.type].ship;
/** Schlachtfeld-Gewicht eines Treffers nach Waffe / battlefield weight of a hit by weapon */
const scarWeight = (u: Unit, rocket = false) => (rocket || WAR_MARKS.craterUnits.includes(u.type) ? WAR_MARKS.scar.heavyHit : WAR_MARKS.scar.hit);

/** Mine explodiert unter der Einheit / mine explodes under the unit. true = Einheit vernichtet / unit destroyed */
function detonateMine(s: GameState, u: Unit, ev: GameEvent[]): boolean {
  const t = tileAt(s, u.x, u.y)!;
  const owner = t.mine!.owner;
  t.mine = null;
  // Doktrin Befestigung des Minenbesitzers: mehr Schaden / fortification doctrine of the mine's owner: more damage
  const dmg = mineDamage(s, owner, u.type);
  u.hp -= dmg;
  u.moveDone = true;
  addMark(s, u.x, u.y, 'crater', WAR_MARKS.scar.mine);
  ev.push({ t: 'mineHit', unit: u.id, x: u.x, y: u.y, dmg, owner });
  spare(s, u);
  if (u.hp > 0) return false;
  killUnit(s, u, null, ev);
  return true;
}

/**
 * Kriegsspur auf einem Feld hinterlassen; weight erhoeht die Schlachtfeld-Intensitaet (scars.ts, auch auf Wasser).
 * Leave a war mark on a tile; weight raises the battlefield intensity (scars.ts, on water too).
 */
function addMark(s: GameState, x: number, y: number, k: 'crater' | 'scorch', weight: number) {
  addBattleScar(s, x, y, weight);
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
  // nach einem Fraktionssieg keine weiteren Fraktionssiege / no further faction victories after a faction victory
  if (s.victory?.kind === 'faction') s.config.factionVictory = false;
  // Ein Fraktionssieg faellt am Ende von startTurn, der Zug laeuft also schon; nur das Rundenlimit (Punktesieg)
  // endet vor startTurn. / A faction victory is declared at the end of startTurn, so the turn is already running;
  // only the round limit (points victory) ends before startTurn.
  const turnStarted = s.victory?.kind !== 'points';
  s.victory = undefined;
  s.config.roundLimit = null;
  s.config.mode = 'endless';
  if (!turnStarted) startTurn(s, ev);
  return ev;
}

function advance(s: GameState, ev: GameEvent[]) {
  const count = s.factions.length;
  // Verluste am Zugende (Absturz, Flak) koennen den Kult ausscheiden lassen / losses at the end of the turn (crash, flak) can eliminate the cult
  checkElimination(s, ev, true);
  if (s.over) return;
  let next = s.current;
  let wrapped = false;
  for (let i = 0; i < count; i++) {
    next = (next + 1) % count;
    if (next === 0) wrapped = true;
    if (s.factions[next].alive) break;
  }
  // Rundenende fuer die Statistik festhalten / record the round end for statistics
  if (wrapped) {
    recordRound(s); s.round++; expireMemorials(s); healScars(s); processVolcanoes(s, ev); processFires(s, ev, shadowKit(s)); processMeteors(s, ev); processTurrets(s, ev); processRandomEvents(s, ev);
    // Vulkane und Geschuetze koennen den Kult ausscheiden lassen / volcanoes and guns can eliminate the cult
    checkElimination(s, ev, true);
    if (s.over) return;
    for (let i = 0; i < count && !s.factions[next].alive; i++) next = (next + 1) % count;
  }
  s.current = next;
  const limit = s.config.roundLimit;
  if (limit !== null && s.round > limit) {
    let best = -1, bestScore = -1;
    for (const f of s.factions) {
      if (!f.alive) continue;
      const sc = score(s, f.index);
      if (sc > bestScore) { bestScore = sc; best = f.index; }
    }
    declareWinner(s, best, 'points', ev);
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

/** Abgelaufene Mahnmale des Kults entfernen (Rundenbeginn) / remove expired cult memorials (start of a round) */
function expireMemorials(s: GameState) {
  for (const t of s.tiles) if (t.memorial && t.memorial.until < s.round) t.memorial = null;
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
      else interruptWonder(s, u, ev); // Lava unterbricht Wunder wie ein Treffer / lava interrupts wonders like a hit
    }
  }
}

/**
 * Verdan-Verteidigungslinie: ein Geschuetz erwacht, sobald eine Einheit seinem bewachten Punkt (Artefakt oder
 * Ruinenstaette, turretGuard) nahe kommt; alle Geschuetze desselben Punkts erwachen gemeinsam (nach jedem Kommando).
 * Verdan defence line: a gun wakes up once a unit comes close to its guarded point (artifact or ruin site,
 * turretGuard); all guns of the same point wake together (after every command).
 */
function wakeTurrets(s: GameState, ev: GameEvent[]) {
  if (!s.campaign?.artifact && !s.campaign?.sites?.length) return;
  const woken = new Set<string>();
  for (const p of turretList(s)) {
    if (p.active) continue;
    const g = turretGuard(s, p);
    const near = s.units.filter((u) => dist(u, g) <= VERDAN.wakeRange).sort((a, b) => a.id - b.id)[0];
    if (!near) continue;
    tileAt(s, p.x, p.y)!.turret!.active = true;
    const key = `${g.x},${g.y}`;
    if (!woken.has(key)) { woken.add(key); ev.push({ t: 'verdanActive', faction: near.owner }); }
  }
}

/**
 * Zu Rundenbeginn feuert jedes wache Geschuetz einmal auf die dem Artefakt naechste Einheit in Reichweite (jede Fraktion).
 * Normale Kampfformel, Trefferglueck einer Maschine aus dem Zufallsstrom des Spiels.
 * Geschuetzstellungen (mit Besitzer) waehlen ihr Ziel selbst (emplacementTarget) und schiessen mit ihren eigenen Werten.
 * At the start of each round every awake gun fires once at the unit in range closest to the artifact (any faction).
 * Normal combat formula, machine hit luck from the game's random stream.
 * Gun emplacements (with owner) pick their own target (emplacementTarget) and fire with their own stats.
 */
function processTurrets(s: GameState, ev: GameEvent[]) {
  for (const p of turretList(s)) {
    // Raketensilos feuern nur auf Befehl, Hacktuerme nie / rocket silos only fire on command, hack towers never
    if (!p.active || p.kind === 'silo' || p.kind === 'hack') continue;
    const G = gunStats(p);
    const u = p.owner !== undefined ? emplacementTarget(s, p) : turretTarget(s, p);
    if (!u) continue;
    const base = turretShotDamage(s, p.hp, u, G);
    // verschanztes Ziel (Korvat): mehr Fehlschuesse / entrenched target (Korvat): more misses
    const hit: HitKind = hitChanceOn(s) ? rollHit(withEntrench(raceOdds(s, G.race, p.hp / G.hp, true), entrenchMiss(s, u)), nextRandom(s)) : 'full';
    const dmg = hitDamage(base, hit);
    u.hp -= dmg;
    if (dmg > 0) addMark(s, u.x, u.y, 'scorch', WAR_MARKS.scar.turret);
    ev.push({ t: 'turretFire', x: p.x, y: p.y, target: u.id, dmg, ...(hitChanceOn(s) ? { hit } : {}), ...(p.owner !== undefined ? { owner: p.owner, victim: u.owner } : {}) });
    spare(s, u);
    if (u.hp <= 0) killUnit(s, u, null, ev);
    else if (dmg > 0) interruptWonder(s, u, ev);
  }
}

/**
 * Schadenswetter zu Rundenbeginn: Meteorschauer (Wueste, ungepanzerte Einheiten) und Saeureregen (Alienwelt, alles ausser
 * Zyrr); leichter Schaden ohne Deckung, nie toedlich. Wurf aus dem Zufallsstrom des Spiels.
 * Damaging weather at the start of the round: meteor shower (desert, unarmoured units) and acid rain (alien world,
 * everything but the Zyrr); light damage without cover, never lethal. Roll from the game's random stream.
 */
function processMeteors(s: GameState, ev: GameEvent[]) {
  const w = weather(s);
  if (w !== 'meteor' && w !== 'acid') return;
  const M = WEATHER[w];
  const hits: { unit: number; dmg: number; x: number; y: number }[] = [];
  for (const u of [...s.units].sort((a, b) => a.id - b.id)) {
    if (!weatherHurts(s, w, u)) continue;
    const roll = nextRandom(s);
    const dmg = Math.min(u.hp - M.minHp, M.damage + (roll < M.extraChance ? 1 : 0));
    if (dmg <= 0) continue;
    u.hp -= dmg;
    if (w === 'meteor') addMark(s, u.x, u.y, 'scorch', WAR_MARKS.scar.meteor);
    hits.push({ unit: u.id, dmg, x: u.x, y: u.y });
  }
  ev.push({ t: 'weatherHit', kind: w, hits });
}

/** Angriff auf ein Verdan-Geschuetz / attack on a Verdan gun */
function doAttackTurret(s: GameState, u: Unit, x: number, y: number, ev: GameEvent[]): CommandResult {
  const t = tileAt(s, x, y);
  if (!t?.turret || t.turret.hp <= 0) return fail('invalidTarget');
  // eigene oder befreundete Stellung / own or friendly emplacement
  if (!gunHostile(s, t.turret, u.owner)) return fail(t.turret.owner === u.owner ? 'invalidTarget' : 'peace');
  if (!turretTargets(s, u).some((p) => p.x === x && p.y === y)) {
    if (!canAttackNow(u) || submerged(s, u)) return fail('cannotAttack');
    return fail(dist(u, { x, y }) > effectiveRange(s, u) ? 'outOfRange' : 'invalidTarget');
  }
  const pre = turretPreview(s, u, { x, y });
  const hit: HitKind = hitChanceOn(s) ? rollHit(pre.odds, nextRandom(s)) : 'full';
  const dealt = hitDamage(pre.toTurret, hit);
  const left = t.turret.hp - dealt;
  // ein Angriff weckt die ganze Linie; Gegenschlag einer Maschine / an attack wakes the whole line; return fire of a machine
  const wasAwake = t.turret.active;
  const owner = t.turret.owner;
  const G = gunStats(t.turret);
  const retBase = left > 0 ? pre.ret(left) : 0;
  const retHit: HitKind = retBase > 0 && hitChanceOn(s) ? rollHit(withEntrench(raceOdds(s, G.race, left / G.hp, true), entrenchMiss(s, u)), nextRandom(s)) : 'full';
  const ret = retBase > 0 ? hitDamage(retBase, retHit) : 0;
  // Ausrichtung zum Geschuetz / facing towards the gun
  faceTowards(u, { x, y });
  t.turret.hp = Math.max(0, left);
  if (!wasAwake && owner === undefined) {
    // Geschuetze desselben bewachten Punkts erwachen mit / guns of the same guarded point wake up as well
    const g = turretGuard(s, { x, y });
    for (const q of turretList(s)) { const gq = turretGuard(s, q); if (gq.x === g.x && gq.y === g.y) tileAt(s, q.x, q.y)!.turret!.active = true; }
    ev.push({ t: 'verdanActive', faction: u.owner });
  }
  const destroyed = t.turret.hp <= 0;
  if (destroyed) { t.turret = null; t.turretRuin = true; if (owner !== undefined) t.turretRuinOwner = owner; }
  if (ret > 0) u.hp -= ret;
  // Kriegsspuren an der Stellung und beim Angreifer / war marks at the emplacement and at the attacker
  addMark(s, x, y, WAR_MARKS.craterUnits.includes(u.type) ? 'crater' : 'scorch', has(u, 'kamikaze') ? WAR_MARKS.scar.blast : scarWeight(u));
  if (ret > 0) addMark(s, u.x, u.y, 'scorch', WAR_MARKS.scar.returnFire);
  ev.push({ t: 'turretHit', unit: u.id, x, y, dmg: dealt, ret, destroyed, ...(hitChanceOn(s) ? { hit, ...(retBase > 0 ? { retHit } : {}) } : {}), ...(owner !== undefined ? { owner } : {}), ...(has(u, 'kamikaze') ? { kamikaze: true } : {}) });
  s.factions[u.owner].lastAttackRound = s.round;
  if (has(u, 'submerged') || has(u, 'camo')) u.revealed = true;
  // Absetzen (Meridon): vor dem Setzen von attacked pruefen / withdrawal (Meridon): check before attacked is set
  const withdraw = canWithdrawAfterAttack(s, u);
  // Geschuetze zaehlen nie als Abschuss (Punkte, Statistik, Bonusziele) / guns never count as kills (score, stats, bonus objectives)
  if (u.hp <= 0) { killUnit(s, u, null, ev); return { ok: true, events: ev }; }
  // Kamikaze: auch am Geschuetz explodiert die Drohne / kamikaze: the drone explodes at a gun too
  if (has(u, 'kamikaze')) { killUnit(s, u, null, ev, false); return { ok: true, events: ev }; }
  u.attacked = true;
  if (withdraw) u.withdraw = true;
  else if (!(has(u, 'escape') && !u.moved)) u.exhausted = true;
  if (u.moved && u.attacked) u.exhausted = true;
  return { ok: true, events: ev };
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
      // Nachschublinien wachsen nicht: dann Sterne / supply lines do not grow: stars instead
      const hq = hqOf(s, f) ?? ownCities(s, f)[0];
      if (hq && !supplyLines(s) && !isCultFaction(s, f)) addPop(s, hq, BUNKER.population, ev); else giveStars();
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
        // eigene Bauart (Meridon: Marines) / own design (Meridon: marines)
        const inf = ROSTERS[fa.id]?.infantry ?? factionVariant(s, f, 'infantry');
        d.carried = inf; d.hp = UNITS[inf].hp; d.maxHp = UNITS[inf].hp;
      } else giveStars();
      break;
    }
  }
  s.bunkerRewardsTaken++;
  ev.push({ t: 'bunker', x: u.x, y: u.y, reward, faction: f });
}

/** Einnahme durch u (eine Einheit oder, beim Hacken, nur die Fraktion) / capture by u (a unit or, when hacking, just the faction) */
function captureCity(s: GameState, u: Pick<Unit, 'owner'>, c: City, ev: GameEvent[], hack = false) {
  const from = c.owner;
  // Velkar mit Akademie: der Ort wird ein Forschungsposten (ACADEMY) / Velkar with an academy: the place becomes a research post (ACADEMY)
  const academy = academyOf(s, u.owner);
  const level = c.level;
  const lostAcademy = !!c.academy;
  const wasPost = !!c.post;
  // Kult: Pluenderung vor dem Besitzwechsel (Stufe der Stadt zaehlt) / cult: plunder before the change of owner (the city's level counts)
  const plunder = plunderValue(s, u.owner, c);
  c.owner = u.owner;
  if (isCultFaction(s, u.owner)) {
    if (plunder > 0) { c.plundered = s.round; c.plunderCount = (c.plunderCount ?? 0) + 1; }
    const fa = s.factions[u.owner];
    fa.stars += plunder;
    fa.plunder = (fa.plunder ?? 0) + plunder;
  }
  // Satelliten-Relay geht mit der Stadt verloren (abgebaut), der Slot wird frei / the satellite relay is lost with the city (dismantled), the slot frees up
  if (c.upgrades?.includes(ORBITAL.relay)) c.upgrades = c.upgrades.filter((x) => x !== ORBITAL.relay);
  // Akademie oder Posten wechselt den Besitzer: der Ort wird eine gewoehnliche Stadt / academy or post changes hands: the place becomes an ordinary city
  if (lostAcademy || wasPost) dropAcademyState(c);
  if (from === null) {
    if (!academy) {
      c.level = 1; c.pop = 0;
      claimTerritory(s, c, CITY.baseRadius);
    }
  } else {
    for (const o of s.units) if (o.homeCity === c.id) o.homeCity = null;
    s.pendingRewards = s.pendingRewards.filter((p) => p.cityId !== c.id);
    c.connected = false;
    if (c.isHQ && c.hqOf !== null) {
      // Botschaften im verlorenen Hauptquartier enden / embassies in a lost HQ end
      for (const f of s.factions) f.embassies = f.embassies.filter((g) => g !== c.hqOf);
    }
  }
  if (academy) makePost(s, c, academy, from, level, ev);
  // verlorene Akademie: ein Posten wird die neue Akademie; ein eroberter Posten nimmt sein Umland mit
  // lost academy: a post becomes the new academy; a captured post takes its surroundings along
  if (lostAcademy && from !== null) transferAcademy(s, c, from, ev);
  if (wasPost && from !== null && !academy) reclaimAround(s, c, from);
  // Zyrr nehmen eine Fabrik ein: Stadtfeld und Gebiet werden sofort zu Xeno-Boden (BASES.zyrrFactoryXeno)
  // the Zyrr capture a factory: city tile and territory turn to xeno ground at once (BASES.zyrrFactoryXeno)
  for (const p of factoryXenoTiles(s, c)) tileAt(s, p.x, p.y)!.xeno = true;
  ev.push({ t: 'capture', city: c.id, faction: u.owner, from, ...(isCultFaction(s, u.owner) ? { plunder } : {}), ...(hack ? { hack: true } : {}) });
  // Suende: Pluendern (Kult mit Beute) oder Erobern einer Stadt einer anderen Fraktion / sin: plundering (cult with loot) or capturing a city of another faction
  if (isCultFaction(s, u.owner) && plunder > 0) markSin(s, u.owner, 'plunder', ev);
  else if (from !== null && from !== u.owner) markSin(s, u.owner, 'capture', ev);
  noteCapture(s, u.owner); // Statistik / statistics
  reveal(s, u.owner, c.x, c.y, c.post ? ACADEMY.postVision : c.radius + VISION.cityExtra, ev);
  updateConnections(s, u.owner, ev);
  if (from !== null) updateConnections(s, from, ev);
  checkElimination(s, ev);
}

/** Zustand der Akademie und des Postens entfernen / remove the academy and post state */
function dropAcademyState(c: City) {
  delete c.academy; delete c.post; delete c.air; delete c.calm; delete c.shield; delete c.shieldReady; delete c.trained;
  delete c.relay; delete c.beamed;
}

/**
 * Gebeamte Einheiten der Fraktion f kommen an (Zugbeginn): am Relay, sonst (Relay verloren, kein Platz) an der Akademie,
 * sonst auf dem naechsten freien Feld. Keine Einheit geht unbemerkt verloren.
 * Beamed units of faction f arrive (turn start): at the relay, otherwise (relay lost, no room) at the academy, otherwise on
 * the nearest free tile. No unit is lost silently.
 */
function beamArrivals(s: GameState, f: number, ev: GameEvent[]) {
  const list = s.transit?.filter((b) => b.unit.owner === f) ?? [];
  if (!list.length) return;
  s.transit = s.transit!.filter((b) => b.unit.owner !== f);
  if (!s.transit.length) delete s.transit;
  for (const b of list) {
    const u = b.unit;
    const relay = cityById(s, b.relay);
    let at = relay && relay.owner === f && relay.relay ? arrivalSpot(s, u, relay.x, relay.y) : null;
    let what: 'arrive' | 'return' = 'arrive';
    if (!at) {
      what = 'return';
      const ac = academyOf(s, f);
      const home = ac ?? relay ?? { x: u.x, y: u.y };
      at = (ac ? arrivalSpot(s, u, ac.x, ac.y) : null) ?? nearestStand(s, u, home.x, home.y);
    }
    if (!at) continue;
    u.x = at.x; u.y = at.y; u.startX = at.x; u.startY = at.y;
    s.units.push(u);
    ev.push({ t: 'beam', what, city: what === 'arrive' ? b.relay : academyOf(s, f)?.id ?? b.relay, faction: f, x: at.x, y: at.y, unit: u.id, unitType: u.type });
  }
}

/**
 * Eingenommener Ort wird Forschungsposten der Akademie ac: ein Feld, Stufe 1, kein Wachstum; sein Gebiet (neutral: der
 * Umkreis CITY.baseRadius) und Bevoelkerung (ACADEMY.postPop + postPopPerLevel je Stufe ueber 1) gehen an die Akademie.
 * Captured place becomes a research post of academy ac: one tile, level 1, no growth; its territory (neutral: the radius
 * CITY.baseRadius) and population (ACADEMY.postPop + postPopPerLevel per level above 1) pass to the academy.
 */
function makePost(s: GameState, c: City, ac: City, from: number | null, level: number, ev: GameEvent[]) {
  c.post = true; c.level = 1; c.pop = 0; c.radius = 0; c.connected = false;
  let tiles = 0;
  if (from === null) {
    for (const p of area(s.size, c.x, c.y, CITY.baseRadius)) {
      const t = tileAt(s, p.x, p.y)!;
      if (t.territory === null && t.cityId === null) { t.territory = ac.id; tiles++; }
    }
  } else {
    for (const p of area(s.size, c.x, c.y, CITY.growMaxRadius + 2)) {
      const t = tileAt(s, p.x, p.y)!;
      if (t.territory === c.id && t.cityId !== c.id) { t.territory = ac.id; tiles++; }
    }
  }
  tileAt(s, c.x, c.y)!.territory = c.id;
  const pop = ACADEMY.postPop + ACADEMY.postPopPerLevel * Math.max(0, (from === null ? 1 : level) - 1);
  ev.push({ t: 'post', city: c.id, academy: ac.id, faction: ac.owner!, pop, tiles });
  addPop(s, ac, pop, ev);
}

/**
 * Akademie verloren: ihr Umland (Radius, mindestens 1) bleibt bei der Stadt; der naechste Posten wird die neue Akademie
 * (halbe Stufe, am Boden) und erbt das uebrige Gebiet. Ohne Posten wird das uebrige Gebiet frei.
 * Academy lost: its surroundings (radius, at least 1) stay with the city; the nearest post becomes the new academy (half
 * the level, on the ground) and inherits the remaining territory. Without a post the remaining territory turns neutral.
 */
function transferAcademy(s: GameState, c: City, f: number, ev: GameEvent[]) {
  const keep = Math.max(1, c.radius);
  const next = postsOf(s, f).sort((a, b) => dist(a, c) - dist(b, c) || a.id - b.id)[0];
  if (next) {
    delete next.post;
    next.academy = true;
    next.level = Math.max(1, Math.floor(c.level / 2));
    next.pop = 0;
    next.radius = 1;
    for (const p of area(s.size, next.x, next.y, 1)) {
      const t = tileAt(s, p.x, p.y)!;
      if (t.territory === null && t.cityId === null) t.territory = next.id;
    }
  }
  for (let k = 0; k < s.tiles.length; k++) {
    const t = s.tiles[k];
    if (t.territory !== c.id || t.cityId === c.id) continue;
    if (dist(c, { x: k % s.size, y: Math.floor(k / s.size) }) <= keep) continue;
    t.territory = next ? next.id : null;
  }
  if (next) ev.push({ t: 'academy', what: 'transfer', city: next.id, faction: f, x: next.x, y: next.y, from: { x: c.x, y: c.y } });
}

/** Eroberter Posten: das Umland im Radius 1, das noch der alten Akademie gehoert, kommt mit / captured post: the surroundings within radius 1 still held by the old academy come along */
function reclaimAround(s: GameState, c: City, from: number) {
  const ac = academyOf(s, from);
  c.radius = CITY.baseRadius;
  for (const p of area(s.size, c.x, c.y, CITY.baseRadius)) {
    const t = tileAt(s, p.x, p.y)!;
    if (t.cityId !== null && t.cityId !== c.id) continue;
    if (t.territory === null || (ac && t.territory === ac.id && !t.building)) t.territory = c.id;
  }
}

function applyReward(s: GameState, c: City, level: number, choice: 'a' | 'b', ev: GameEvent[]) {
  const opt = rewardOptions(c, level)[choice === 'a' ? 0 : 1];
  const f = c.owner!;
  switch (opt) {
    case 'factory': c.factory = true; break;
    // Aufklaerungsdrohne: Felder aufdecken und alle Einheiten im Umkreis bis Rundenende sehen (SIGHTING) / recon drone: reveal tiles and see all units in the radius until the end of the round (SIGHTING)
    case 'drone': reveal(s, f, c.x, c.y, VISION.droneRadius, ev); addSighting(s, f, c.x, c.y, VISION.droneRadius, SIGHTING.rounds); break;
    case 'bunkerRing': c.bunkerRing = true; break;
    case 'stars': s.factions[f].stars += CITY.rewardStars; break;
    // ganzer Ring bis expandRadius (mindestens 5x5, hoechstens 7x7) / a full ring up to expandRadius (at least 5x5, at most 7x7)
    case 'expand': claimTerritory(s, c, expandRadius(c)); reveal(s, f, c.x, c.y, c.radius + VISION.cityExtra, ev); break;
    case 'population': addPop(s, c, CITY.rewardPopulation, ev); break;
    case 'govQuarter': c.govQuarter = true; break;
    case 'tank': {
      const p = !unitAt(s, c.x, c.y) ? { x: c.x, y: c.y } : freeNeighbor(s, c.x, c.y, false);
      // volle Stadt: der Panzer gehoert zu keiner Stadt (wie ein Ueberlaeufer) / full city: the tank belongs to no city (like a defector)
      // sonst traegt ihn ein Versorger (Wohnbloecke, Supermarkt) / otherwise a supplier supports it (residential blocks, supermarket)
      const home = freeUnitSlots(s, c) > 0 ? trainHome(s, c) : null;
      // Velkar: Tesla-Panzer (VARIANTS) / Velkar: Tesla tank (VARIANTS)
      const heavy = ROSTERS[s.factions[f].id]?.tank ?? factionVariant(s, f, 'tank');
      if (p) spawnUnit(s, heavy, f, p.x, p.y, home);
      // Meridon: statt eines Panzers mehrere Lenkflugkoerper (REWARD_HEAVY), weitere auf freien Nachbarfeldern ohne Stadtbindung
      // Meridon: several Guided Missiles instead of one tank (REWARD_HEAVY), further ones on free adjacent tiles without a home city
      for (let i = 1; p && i < (REWARD_HEAVY.count[s.factions[f].id] ?? 1); i++) {
        const q = freeNeighbor(s, c.x, c.y, false);
        if (q) spawnUnit(s, heavy, f, q.x, q.y, null);
      }
      break;
    }
  }
  ev.push({ t: 'reward', city: c.id, choice, level });
}

/** Bewegung; step = Rueckzugsschritt als Teil des Rueckzugs (ohne Bewegungsstatus) / move; step = retreat step as part of the retreat (ignoring movement state) */
function doMove(s: GameState, u: Unit, to: { x: number; y: number }, ev: GameEvent[], step = false): CommandResult {
  const options = step ? reachable(s, u, true).filter((o) => o.path.length === 1) : reachable(s, u);
  const found = options.find((o) => o.x === to.x && o.y === to.y);
  if (!found) return fail('unreachable');
  // Minen beenden die Bewegung vorzeitig / mines end the move early
  const { reach: r, mine } = cutAtMine(s, u, found);
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
  // Ausrichtung = Richtung des letzten Schritts / facing = direction of the last step
  const prev = r.path.length > 1 ? r.path[r.path.length - 2] : { x: u.x, y: u.y };
  // leeres eigenes Schiff am Ziel (Einsteigen), vor dem Umsetzen merken / own empty ship at the target (boarding), remember before moving
  const boat = r.board && !mine ? emptyShipAt(s, f, r.x, r.y) : undefined;
  u.x = r.x; u.y = r.y;
  if (canFace(u)) u.facing = facingTowards(prev, u) ?? u.facing;
  // wer zieht, verlaesst seine Stellung (ENTRENCH) / whoever moves leaves its position (ENTRENCH)
  if (u.entrenched) u.entrenched = false;
  // Bewegung setzt den Erdkernbohrer zurueck / moving resets the earth-core drill
  if (u.type === 'coreDrill') u.stillRounds = 0;
  const bt = tileAt(s, u.x, u.y)!;
  if (bt.barrier && bt.barrier.owner !== f && BARRIER.vehicles.includes(u.type)) {
    u.slowedNext = true;
    ev.push({ t: 'barrierHit', unit: u.id, x: u.x, y: u.y });
  }
  u.moved = true;
  // Absetzen verbraucht (hadAttacked erschoepft unten) / withdrawal used up (hadAttacked exhausts below)
  if (u.withdraw) delete u.withdraw;
  // Radarimpuls folgt dem Wagen / the radar sweep follows the truck
  if (has(u, 'radar')) followSightings(s, u);
  ev.push({ t: 'move', unit: u.id, path: r.path });
  for (const p of r.path) reveal(s, f, p.x, p.y, visionRadiusAt(s, u, p.x, p.y), ev);
  if (hadAttacked) u.exhausted = true;
  const t = tileAt(s, u.x, u.y)!;
  if (boat) {
    // Einsteigen: das leere Schiff nimmt die Einheit auf (Kennung, LP und Erfahrung der Einheit bleiben) / boarding: the empty ship takes the unit in (the unit's id, HP and experience stay)
    s.units = s.units.filter((o) => o.id !== boat.id);
    u.carried = u.type; u.type = boat.type; u.exhausted = true;
    if (canFace(u)) u.facing = boat.facing ?? u.facing;
    ev.push({ t: 'embark', unit: u.id, boat: boat.id });
  } else if (r.embark) {
    u.carried = u.type; u.type = 'landingBoat'; u.exhausted = true;
    ev.push({ t: 'embark', unit: u.id });
  } else if (r.disembark) {
    // amphibisch (Marines): Anlanden erschoepft nicht, die Bewegung ist verbraucht, der Angriff bleibt (MARINES)
    // amphibious (marines): landing does not exhaust, the move is used up, the attack stays (MARINES)
    u.type = u.carried!; u.carried = null; u.exhausted = !has(u, 'amphibious') || hadAttacked;
    ev.push({ t: 'disembark', unit: u.id });
  }
  reveal(s, f, u.x, u.y, visionRadius(s, u), ev);
  if (mine && detonateMine(s, u, ev)) return { ok: true, events: ev };
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
        if (unitAt(s, p.x, p.y) || nt.wonderOf || nt.turret || nt.temple || !isLand(nt) || (nt.terrain === 'mountain' && !s.factions[f].techs.includes('mountainTraining'))) continue;
        // kein Vulkangipfel, keine Lava, nicht das Artefakt / no volcano peak, no lava, not the artifact
        if (nt.volcano || burning(s, nt) || spawnBlocked(s, p)) continue;
        spawnUnit(s, ROSTERS[s.factions[f].id]?.infantry ?? factionVariant(s, f, 'infantry'), f, p.x, p.y, null);
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

function doAttack(s: GameState, u: Unit, target: Unit, ev: GameEvent[], rocket = false): CommandResult {
  if (target.owner !== u.owner && !isHostile(s, u.owner, target.owner)) return fail('peace');
  if (rocket) {
    // Mech-Raketen: genau zwei Felder, Munition noetig / mech rockets: exactly two tiles, ammo needed
    if (rocketsLeft(u) <= 0) return fail('noRockets');
    if (!rocketTargets(s, u).some((o) => o.id === target.id)) {
      if (!canAttackNow(u) || submerged(s, u)) return fail('cannotAttack');
      return fail('outOfRange');
    }
    u.rockets = rocketsLeft(u) - 1;
  } else if (!attackTargets(s, u).some((o) => o.id === target.id)) {
    if (!canAttackNow(u) || submerged(s, u)) return fail('cannotAttack');
    return fail('outOfRange');
  }
  const pre = combatPreview(s, u, target, rocket);
  // Trefferglueck des Angreifers / attacker's hit luck
  const hit: HitKind = hitChanceOn(s) ? rollHit(pre.odds, nextRandom(s)) : 'full';
  // Schutzschild der Akademie faengt zuerst ab (ACADEMY.shield) / the academy's shield absorbs first (ACADEMY.shield)
  const guard = shieldOver(s, target);
  const dealt = guard ? shieldTake(s, guard, hitDamage(pre.toDefender, hit), u.id, ev) : hitDamage(pre.toDefender, hit);
  const kills = dealt >= target.hp;
  // Gegenschlag nur, wenn das Ziel ueberlebt, mit den LP nach dem Treffer; eigenes Trefferglueck des Verteidigers
  // return fire only if the target survives, with the HP left after the hit; defender's own hit luck
  const retBase = kills ? 0 : returnFire(s, u, target, target.hp - dealt);
  // Gegenschlag auf einen verschanzten Angreifer (Korvat): mehr Fehlschuesse / return fire on an entrenched attacker (Korvat): more misses
  const retHit: HitKind = retBase > 0 && hitChanceOn(s) ? rollHit(hitOdds(s, { ...target, hp: target.hp - dealt }, false, u), nextRandom(s)) : 'full';
  const ret = retBase > 0 ? hitDamage(retBase, retHit) : 0;
  // Ausrichtung erst nach der Vorschau (es zaehlt die Ausrichtung des Ziels vor dem Angriff): Angreifer zum Ziel,
  // ein zurueckschlagendes Ziel (auch bei Fehlschuss) zum Angreifer
  // facing only after the preview (the target's facing before the attack counts): attacker towards the target,
  // a target that returns fire (a miss included) towards the attacker
  faceTowards(u, target);
  if (retBase > 0) faceTowards(target, u);
  const splash: { unit: number; dmg: number }[] = [];
  if (has(u, 'splash')) {
    const dmg = Math.round(dealt * COMBAT.splashFactor);
    for (const o of s.units.slice()) {
      if (o.id === target.id || o.owner === u.owner || !isHostile(s, u.owner, o.owner) || dist(o, target) !== 1) continue;
      const g = shieldOver(s, o);
      const d = g ? shieldTake(s, g, dmg, u.id, ev) : dmg;
      o.hp -= d;
      splash.push({ unit: o.id, dmg: d });
    }
  }
  target.hp -= dealt;
  if (ret > 0) u.hp -= ret;
  spare(s, target); spare(s, u);
  for (const sp of splash) spare(s, unitById(s, sp.unit));
  // Angriffe mit Schaden unterbrechen Wunder (auch Flaechenschaden); ein Fehlschuss nicht
  // attacks that deal damage interrupt wonders (splash included); a miss does not
  if (dealt > 0 && target.hp > 0) interruptWonder(s, target, ev);
  for (const sp of splash) { const o = unitById(s, sp.unit); if (sp.dmg > 0 && o && o.hp > 0) interruptWonder(s, o, ev); }
  // Kriegsspuren / war marks
  const markKind = WAR_MARKS.craterUnits.includes(u.type) ? 'crater' : 'scorch';
  // Kamikaze-Drohne: Explosion wiegt schwer / kamikaze drone: the blast weighs heavily
  addMark(s, target.x, target.y, markKind, has(u, 'kamikaze') ? WAR_MARKS.scar.blast : scarWeight(u, rocket));
  for (const sp of splash) { const o = unitById(s, sp.unit); if (o) addMark(s, o.x, o.y, 'scorch', WAR_MARKS.scar.splash); }
  if (ret > 0) addMark(s, u.x, u.y, 'scorch', WAR_MARKS.scar.returnFire);
  ev.push({ t: 'attack', unit: u.id, target: target.id, dmg: dealt, ret, splash, ...(rocket ? { rocket: true } : {}), ...(has(u, 'kamikaze') ? { kamikaze: true } : {}), ...(hitChanceOn(s) ? { hit, ...(retBase > 0 ? { retHit } : {}) } : {}) });
  s.factions[u.owner].lastAttackRound = s.round;
  // Suende: Brandschatzen (Brand-Angriff) oder Frevel (Angriff auf die richtende Fraktion), erst nach dem Treffer
  // sin: burning (burn attack) or sacrilege (attack on the judging faction), only after the hit
  if (has(u, 'burn')) markSin(s, u.owner, 'burn', ev);
  else if (judges(s, target.owner)) markSin(s, u.owner, 'sacrilege', ev);
  if (has(u, 'submerged') || has(u, 'camo')) u.revealed = true;
  // Absetzen (Meridon): vor dem Setzen von attacked pruefen / withdrawal (Meridon): check before attacked is set
  const withdraw = canWithdrawAfterAttack(s, u);
  let killed = false;
  if (target.hp <= 0) { killUnit(s, target, u.id, ev); gainKill(s, u, ev); killed = true; }
  for (const sp of splash) {
    const o = unitById(s, sp.unit);
    if (o && o.hp <= 0) { killUnit(s, o, u.id, ev); gainKill(s, u, ev); }
  }
  // Kamikaze: die Drohne ist mit der Explosion verbraucht (kein Wrack, kein Verlust in der Statistik) / kamikaze: the drone is spent with the explosion (no wreck, no loss in the statistics)
  if (has(u, 'kamikaze') && u.hp > 0) {
    killUnit(s, u, null, ev, false);
    return { ok: true, events: ev };
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
  } else if (withdraw) {
    // Absetzen: bis zu WITHDRAW.tiles zurueck, danach kein Angriff mehr (attacked bleibt) / withdraw: up to WITHDRAW.tiles back, no attack afterwards (attacked stays)
    u.withdraw = true;
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
  // uebernommene Einheiten (HACK.tower): nur ziehen, kaempfen und rasten / taken-over units (HACK.tower): only move, fight and rest
  if ('unit' in cmd && typeof cmd.unit === 'number' && !HIJACK_COMMANDS.includes(cmd.type) && unitById(s, cmd.unit)?.hijack) return fail('hijacked');
  switch (cmd.type) {
    case 'move': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      if (u.fresh) return fail('fresh');
      if (quakeLocked(s, u)) return fail('quake');
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
    case 'attackTurret': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      res = doAttackTurret(s, u, cmd.x, cmd.y, ev);
      break;
    }
    case 'rocket': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const target = unitById(s, cmd.target);
      if (!target || target.owner === f) return fail('invalidTarget');
      res = doAttack(s, u, target, ev, true);
      break;
    }
    case 'retreat': {
      // Geordneter Rueckzug: 20 % Schaden, kein Gegenschlag, ein Schritt zurueck / orderly retreat: 20 % damage, no return fire, one step back
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const target = unitById(s, cmd.target);
      if (!target || target.owner === f) return fail('invalidTarget');
      if (!isHostile(s, f, target.owner)) return fail('peace');
      const check = retreatCheck(s, u, target);
      if (check !== 'ok') return fail(check);
      const to = retreatTile(s, u, target)!;
      const guard = shieldOver(s, target);
      const dmg = guard ? shieldTake(s, guard, retreatDamage(s, u, target), u.id, ev) : retreatDamage(s, u, target);
      // Rueckzug: Schuss zum Ziel, der Schritt zurueck behaelt die Ausrichtung (Front zum Feind)
      // retreat: shot towards the target, the step back keeps the facing (front towards the enemy)
      const foe = { x: target.x, y: target.y };
      target.hp -= dmg;
      spare(s, target);
      addMark(s, target.x, target.y, 'scorch', scarWeight(u));
      ev.push({ t: 'attack', unit: u.id, target: target.id, dmg, ret: 0, retreat: true });
      // Frevel: Angriff auf die richtende Fraktion / sacrilege: attack on the judging faction
      if (judges(s, target.owner)) markSin(s, f, 'sacrilege', ev);
      if (dmg > 0 && target.hp > 0) interruptWonder(s, target, ev);
      fa.lastAttackRound = s.round;
      if (target.hp <= 0) { killUnit(s, target, u.id, ev); gainKill(s, u, ev); }
      // Schritt zurueck als Teil des Rueckzugs (auch nach einer Bewegung), mit normaler Bewegungslogik (Minen, Sperren, Sicht);
      // er setzt keinen Bewegungsstatus zurueck, danach ist die Einheit erschoepft
      // step back as part of the retreat (also after a move), with the normal move logic (mines, barriers, vision);
      // it resets no movement state, afterwards the unit is exhausted
      if (unitById(s, u.id)) { doMove(s, u, to, ev, true); faceTowards(u, foe); }
      u.attacked = true; u.moved = true; u.moveDone = true; u.exhausted = true;
      if (has(u, 'camo')) u.revealed = true;
      u.retreatReady = s.round + RETREAT.cooldown + 1;
      res = { ok: true, events: ev };
      break;
    }
    case 'repair': {
      // Notreparatur: Roboter schlachten ein Wrack aus, ganze Runde, kein Kampf / emergency repair: robots salvage a wreck, whole turn, no combat
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = repairCheck(s, u);
      if (check !== 'ok') return fail(check);
      const w = repairWreck(s, u)!;
      const amount = repairAmount(s, u);
      u.hp += amount; u.exhausted = true;
      // Wrack verbraucht; gefallene Fusstruppen bleiben als Gebeine / wreck used up; fallen foot soldiers remain as bones
      const wt = tileAt(s, w.x, w.y)!;
      const r = wt.remains!;
      wt.remains = r.skeletons ? { kind: 'skeleton', unit: r.unit, faction: r.skeletonFaction ?? r.faction, round: r.round, skeletons: r.skeletons, skeletonFaction: r.skeletonFaction } : null;
      ev.push({ t: 'heal', unit: u.id, amount, repair: true });
      res = { ok: true, events: ev };
      break;
    }
    case 'heal': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      if (isWonderStructure(u)) return fail('invalid'); // Bauwerke heilen nicht / structures do not heal
      if (!canHeal(u)) return fail('unitExhausted');
      if (alienHealBlocked(s, u)) return fail('noXenoGround');
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
        // keine Bauwerke, keine Ausserirdischen abseits von Xeno-Boden / no structures, no aliens off xeno ground
        if (o.owner !== f || dist(o, u) !== 1 || !medicCanHeal(s, o)) continue;
        // Doktrin Kybernetik: mehr Heilung / cybernetics doctrine: more healing
        const amount = Math.min(medicHealAmount(s, f), o.maxHp - o.hp);
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
      if (has(target, 'radar')) dropSightings(s, target.id);
      target.owner = f; target.homeCity = null; target.exhausted = true; target.fresh = true;
      if (target.entrenched) target.entrenched = false;
      u.exhausted = true;
      s.factions[f].lastAttackRound = s.round;
      ev.push({ t: 'convert', unit: u.id, target: target.id });
      // Suende: Bekehren einer feindlichen Einheit / sin: converting a hostile unit
      markSin(s, f, 'convert', ev);
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
        releaseOutpost(s, t);
        t.outpost = { owner: f };
        claimOutpost(s, f, u.x, u.y);
        ev.push({ t: 'outpostCapture', x: u.x, y: u.y, faction: f });
      } else {
        captureCity(s, u, cityById(s, t.cityId!)!, ev);
      }
      res = { ok: true, events: ev };
      break;
    }
    case 'persuade': {
      // Kampagne: Siedlung ohne Kampf gewinnen / campaign: win a settlement without combat
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const c = cityById(s, cmd.city);
      if (!c) return fail('invalidTarget');
      const chk = persuadeCheck(s, u, c);
      if (chk !== 'ok') return fail(chk);
      fa.stars -= persuadeCost(c);
      u.exhausted = true;
      captureCity(s, u, c, ev);
      res = { ok: true, events: ev };
      break;
    }
    case 'train': {
      const c = cityById(s, cmd.city);
      if (!c || c.owner !== f) return fail('notYourCity');
      const check = trainCheck(s, c, cmd.unitType);
      if (check !== 'ok') return fail(check);
      fa.stars -= unitCost(s, f, cmd.unitType)!;
      // Werft: leeres Schiff auf freiem Wasserfeld an der Stadt, Rumpf-LP; keine Veteranen (SHIPYARD)
      // shipyard: empty ship on a free water tile at the city, hull HP; no veterans (SHIPYARD)
      if (UNITS[cmd.unitType].ship) {
        const at = shipSpawnTile(s, c)!;
        // Kult: die Horde gehoert keiner Stadt / cult: the horde belongs to no city
        const ship = spawnUnit(s, cmd.unitType, f, at.x, at.y, isCultFaction(s, f) ? null : trainHome(s, c));
        ship.hp = ship.maxHp = SHIPYARD.hullHp[cmd.unitType] ?? 1;
        ev.push({ t: 'train', unit: ship.id, city: c.id });
        res = { ok: true, events: ev };
        break;
      }
      // volle Stadt: ein Versorger (Wohnbloecke, Supermarkt) traegt die Einheit / full city: a supplier (residential blocks, supermarket) supports the unit
      // Akademie: auf dem Akademiefeld oder einem freien Nachbarfeld, mehrere je Zug (ACADEMY) / academy: on the academy tile or a free adjacent tile, several per turn (ACADEMY)
      const at = c.academy ? trainSpot(s, c)! : { x: c.x, y: c.y };
      const u = spawnUnit(s, cmd.unitType, f, at.x, at.y, trainHome(s, c));
      if (c.academy) c.trained = { round: s.round, n: trainedNow(s, c) + 1 };
      ev.push({ t: 'train', unit: u.id, city: c.id });
      if (isWonder(u)) {
        ev.push({ t: 'wonder', what: 'started', kind: u.type as WonderUnitId, unit: u.id, faction: f, x: u.x, y: u.y, stage: 0 });
        res = { ok: true, events: ev };
        break;
      }
      // Kaserne oder Soeldnerkaserne: Einheit startet als Veteran / barracks or mercenary barracks: unit starts as a veteran
      if (hasCityUpgrade(c, 'barracks') || (buildingWorksFor(s, f, 'mercenaryBarracks') && cityTiles(s, c).some((p) => tileAt(s, p.x, p.y)!.building === 'mercenaryBarracks'))) {
        u.veteran = true; u.maxHp += VETERAN.bonusHp; u.hp = u.maxHp;
        ev.push({ t: 'veteran', unit: u.id });
      }
      // Stuetzpunkt Kaserne: Fusstruppen starten mit mehr LP (BASES.footHp) / barracks base: foot troops start with more HP (BASES.footHp)
      const drill = trainFootHp(c, cmd.unitType);
      if (drill > 0) { u.maxHp += drill; u.hp = u.maxHp; }
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
      // Ausbau eines Grundgebaeudes (Ressourcengebaeude): nur die Differenz an Bevoelkerung
      // upgrade of a base building (resource buildings): only the population difference
      const replaced = t.building && t.building === st.upgrades ? t.building : null;
      if (cmd.building === 'road') t.road = true;
      else {
        t.building = cmd.building;
        if (cmd.building === 'bridge') t.road = true;
        if (cmd.building === 'researchCenter') t.researchBuilt = s.round;
      }
      // Wrackschmelze verbraucht Wrack oder Absturzstelle / wreck smelter consumes the wreck or crash site
      if (st.wreck) {
        t.remains = null;
        if (t.feature === 'crashSite') t.feature = null;
      }
      const pop = replaced ? st.pop - BUILDINGS[replaced].pop : st.pop;
      if (pop > 0) addPop(s, city, pop, ev);
      if (st.adjacency) {
        let n = 0;
        for (const p of neighbors(s.size, cmd.x, cmd.y)) { const nb = tileAt(s, p.x, p.y)!.building; if (nb && baseBuilding(nb) === st.adjacency.building) n++; }
        if (n) addPop(s, city, n * st.adjacency.pop, ev);
      }
      // Basisgebaeude neben bestehendem Werk (nicht beim Ausbau, das Grundgebaeude zaehlte schon; eroberte Fraktionsgebaeude nie)
      // base building next to existing works (not on an upgrade, the base building already counted; never captured faction buildings)
      for (const p of replaced ? [] : neighbors(s.size, cmd.x, cmd.y)) {
        const nt = tileAt(s, p.x, p.y)!;
        if (!nt.building || !buildingWorksFor(s, f, nt.building)) continue;
        const adj = BUILDINGS[nt.building].adjacency;
        if (adj && adj.building === baseBuilding(cmd.building) && nt.territory !== null) {
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
      if (cmd.upgrade === 'radioTower' && cmd.target) {
        reveal(s, f, cmd.target.x, cmd.target.y, CITY_UPGRADES.radioRadius, ev);
        // Funkturm: auch getarnte Einheiten im Umkreis bis Rundenende (SIGHTING) / radio tower: camouflaged units in the radius too until the end of the round (SIGHTING)
        addSighting(s, f, cmd.target.x, cmd.target.y, CITY_UPGRADES.radioRadius, SIGHTING.rounds);
      }
      if (cmd.upgrade === ORBITAL.relay) relayBuilt(s, f);
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
      // Kult: im Feld rekrutieren, auch den Erdkernbohrer (Prophet) / cult: recruit in the field, the earth-core drill too (prophet)
      const check = recruitCheck(s, f, cmd.unit, cmd.unitType, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check);
      fa.stars -= unitCost(s, f, cmd.unitType)!;
      const by = unitById(s, cmd.unit)!;
      by.exhausted = true;
      by.recruitReady = s.round + CULT.recruitCooldown;
      // Rekruten gehoeren zu keiner Stadt, das Kult-Limit zaehlt alle Einheiten / recruits belong to no city, the cult cap counts all units
      const nu = spawnUnit(s, cmd.unitType, f, cmd.x, cmd.y, null);
      ev.push({ t: 'recruit', unit: nu.id, by: by.id });
      if (isWonder(nu)) {
        ev.push({ t: 'wonder', what: 'started', kind: nu.type as WonderUnitId, unit: nu.id, faction: f, x: nu.x, y: nu.y, stage: 0 });
        res = { ok: true, events: ev };
        break;
      }
      // Pilgerstaette: Rekruten daneben starten als Veteranen / pilgrimage site: recruits next to it start as veterans
      if (pilgrimVeteranAt(s, f, cmd.x, cmd.y)) {
        nu.veteran = true; nu.maxHp += VETERAN.bonusHp; nu.hp = nu.maxHp;
        ev.push({ t: 'veteran', unit: nu.id });
      }
      // Stuetzpunkt Kaserne: Rekruten auf oder neben ihr starten mit mehr LP / barracks base: recruits on or next to it start with more HP
      const drill = recruitFootHp(s, f, cmd.unitType, cmd.x, cmd.y);
      if (drill > 0) { nu.maxHp += drill; nu.hp = nu.maxHp; }
      res = { ok: true, events: ev };
      break;
    }
    case 'barrier': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = barrierCheck(s, u, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check);
      fa.stars -= barrierCost(s, f);
      tileAt(s, cmd.x, cmd.y)!.barrier = { owner: f };
      u.exhausted = true;
      ev.push({ t: 'barrier', x: cmd.x, y: cmd.y, faction: f });
      res = { ok: true, events: ev };
      break;
    }
    case 'mine': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = mineCheck(s, u, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check);
      fa.stars -= COUNTER.mine.cost;
      tileAt(s, cmd.x, cmd.y)!.mine = { owner: f };
      u.exhausted = true;
      ev.push({ t: 'mine', x: cmd.x, y: cmd.y, faction: f });
      res = { ok: true, events: ev };
      break;
    }
    case 'emplacement': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const err = buildEmplacement(s, u, cmd.x, cmd.y, ev);
      if (err) return fail(err);
      res = { ok: true, events: ev };
      break;
    }
    case 'outpost': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = outpostCheck(s, u);
      if (check !== 'ok') return fail(check);
      fa.stars -= outpostCost(s, f);
      tileAt(s, u.x, u.y)!.outpost = { owner: f };
      claimOutpost(s, f, u.x, u.y);
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
      fa.stars -= shipUpgradeCost(s, f, cmd.to);
      // leeres Schiff: Rumpf-LP des neuen Typs, Schaden bleibt / empty ship: hull HP of the new type, damage stays
      if (!u.carried) {
        const lost = u.maxHp - u.hp;
        u.maxHp = SHIPYARD.hullHp[cmd.to] ?? u.maxHp;
        u.hp = Math.max(1, u.maxHp - lost);
      }
      u.type = cmd.to;
      ev.push({ t: 'upgrade', unit: u.id, to: cmd.to });
      res = { ok: true, events: ev };
      break;
    }
    case 'research': {
      const tech = cmd.tech as TechId;
      if (!TECHS[tech]) return fail('invalid');
      // Siegtechnologien nur fuer die eigene Fraktion, auch ohne normale Forschung / victory techs only for their faction, also without normal research
      const allowed = researchAllowed(s, f, tech);
      if (allowed !== 'ok') return fail(allowed);
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
    case 'wonder': {
      const check = wonderCheck(s, f, cmd.kind, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check);
      fa.stars -= WONDERS.cost[cmd.kind];
      const u = spawnUnit(s, cmd.kind, f, cmd.x, cmd.y, null);
      // Kraftwerk: drei weitere Felder werden unpassierbar / power plant: three more tiles become impassable
      for (const p of wonderFootprint(cmd.kind, cmd.x, cmd.y).slice(1)) tileAt(s, p.x, p.y)!.wonderOf = u.id;
      ev.push({ t: 'wonder', what: 'started', kind: cmd.kind, unit: u.id, faction: f, x: cmd.x, y: cmd.y, stage: 0 });
      res = { ok: true, events: ev };
      break;
    }
    case 'buyLevel': {
      // Stufe mit Sternen kaufen: Bevoelkerung bleibt, Belohnung wie beim normalen Aufstieg
      // buy a level with stars: population stays, reward as with a normal level-up
      const c = cityById(s, cmd.city);
      if (!c) return fail('notYourCity');
      const check = buyLevelCheck(s, f, c);
      if (check !== 'ok') return fail(check);
      fa.stars -= buyLevelCost(c);
      c.levelBought = s.round;
      raiseLevel(s, c, ev, true);
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
      // Kontakt in eine Richtung genuegt (sonst bleibt ein Friedensangebot unbeantwortbar)
      // contact in either direction suffices (otherwise a peace offer could not be answered)
      if (!inContact(s, f, g)) return fail('noContact');
      // Kampagne: Buendnis mit dem Verbuendeten und Wettlauf in m2 (Waffenruhe, dann alle gegen alle) stehen fest
      // campaign: the alliance with the ally and the race in m2 (truce, then everyone against everyone) are fixed
      if (cmd.action !== 'embassy' && cmd.action !== 'declinePeace' && diplomacyLocked(s, f, g)) return fail('invalid');
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
          // Suende: Friedensbruch / sin: breaking a peace
          markSin(s, f, 'breakPeace', ev);
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
    // Orbitallaser (Velkar): eigene Datei orbital.ts / orbital laser (Velkar): own file orbital.ts
    case 'orbitalStrike': {
      const check = orbitalCheck(s, f, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check);
      fireOrbital(s, f, cmd.x, cmd.y, ev, {
        kill: (u, e) => killUnit(s, u, null, e),
        spare: (u) => spare(s, u),
        interrupt: (u, e) => interruptWonder(s, u, e),
        mark: (x, y) => addMark(s, x, y, 'scorch', WAR_MARKS.scar.orbital),
        wake: (p, e) => { if (wakeGunsAt(s, p)) e.push({ t: 'verdanActive', faction: f }); },
      });
      checkElimination(s, ev);
      res = { ok: true, events: ev };
      break;
    }
    // Kampagne m2: Wissenschaftler am Mutterschiff, eigene Datei mothership.ts / campaign m2: scientist at the mothership, own file mothership.ts
    case 'workShip': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = workCheck(s, u);
      if (check !== 'ok') return fail(check);
      doWork(s, u, ev);
      res = { ok: true, events: ev };
      break;
    }
    // Kriegsplaene (Kampagne m4): eigene Datei temple.ts / war plans (campaign m4): own file temple.ts
    case 'seizePlans': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = seizeCheck(s, u);
      if (check !== 'ok') return fail(check);
      seizePlans(s, u, ev);
      res = { ok: true, events: ev };
      break;
    }
    // Schattenflotte (Meridon): eigene Datei shadowFleet.ts / shadow fleet (Meridon): own file shadowFleet.ts
    case 'sabotage': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = sabotageCheck(s, u, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check);
      applySabotage(s, u, cmd.x, cmd.y, ev, shadowKit(s));
      res = { ok: true, events: ev };
      break;
    }
    case 'radarSweep': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const check = radarCheck(s, u);
      if (check !== 'ok') return fail(check);
      applyRadar(s, u, ev);
      res = { ok: true, events: ev };
      break;
    }
    case 'siloLaunch': {
      const check = siloCheck(s, f, cmd.x, cmd.y, cmd.tx, cmd.ty);
      if (check !== 'ok') return fail(check);
      fireSilo(s, f, cmd.x, cmd.y, cmd.tx, cmd.ty, ev, shadowKit(s));
      checkElimination(s, ev);
      res = { ok: true, events: ev };
      break;
    }
    case 'siloBuy': {
      // Raketensilo als Produktionsstaette: eine Einheit je Zug, unabhaengig vom Start (SILO.units)
      // rocket silo as a production site: one unit per turn, independent of the launch (SILO.units)
      const check = siloBuyCheck(s, f, cmd.x, cmd.y, cmd.unitType);
      if (check !== 'ok') return fail(check);
      buySilo(s, f, cmd.x, cmd.y, cmd.unitType, ev, (type, x, y, home) => spawnUnit(s, type, f, x, y, home));
      res = { ok: true, events: ev };
      break;
    }
    case 'liftAcademy': {
      const c = cityById(s, cmd.city);
      const chk = liftCheck(s, f, c);
      if (chk !== 'ok') return fail(chk);
      c!.air = { phase: 'lifting', steps: 0 };
      ev.push({ t: 'academy', what: 'lift', city: c!.id, faction: f, x: c!.x, y: c!.y });
      res = { ok: true, events: ev };
      break;
    }
    case 'moveAcademy': {
      const c = cityById(s, cmd.city);
      const chk = academyMoveCheck(s, f, c, cmd.to);
      if (chk !== 'ok') return fail(chk);
      const from = { x: c!.x, y: c!.y };
      tileAt(s, from.x, from.y)!.cityId = null;
      c!.x = cmd.to.x; c!.y = cmd.to.y;
      tileAt(s, c!.x, c!.y)!.cityId = c!.id;
      c!.air!.steps -= dist(from, cmd.to);
      reveal(s, f, c!.x, c!.y, ACADEMY.postVision, ev);
      ev.push({ t: 'academy', what: 'move', city: c!.id, faction: f, x: c!.x, y: c!.y, from });
      res = { ok: true, events: ev };
      break;
    }
    case 'landAcademy': {
      const c = cityById(s, cmd.city);
      const chk = landCheck(s, f, c, cmd.at);
      if (chk !== 'ok') return fail(chk);
      // Terraformen: schwebt weiter, landet zu Beginn des naechsten eigenen Zuges (academyTurn) / terraforming: keeps floating, lands at the start of the next own turn (academyTurn)
      const at = cmd.at && (cmd.at.x !== c!.x || cmd.at.y !== c!.y) ? { x: cmd.at.x, y: cmd.at.y } : undefined;
      c!.air = { phase: 'terraform', steps: 0, ...(ACADEMY.terraform.rounds !== 1 ? { left: ACADEMY.terraform.rounds } : {}), ...(at ? { at } : {}) };
      const plan = at ?? { x: c!.x, y: c!.y };
      const pt = tileAt(s, plan.x, plan.y)!;
      ev.push({ t: 'academy', what: 'terraform', city: c!.id, faction: f, x: plan.x, y: plan.y, from: { x: c!.x, y: c!.y }, terrain: pt.terrain });
      res = { ok: true, events: ev };
      break;
    }
    case 'cancelTerraform': {
      const c = cityById(s, cmd.city);
      const chk = cancelTerraformCheck(s, f, c);
      if (chk !== 'ok') return fail(chk);
      // zurueck zum Schweben, die Felder dieses Zuges sind verbraucht / back to floating, this turn's tiles are used up
      c!.air = { phase: 'flying', steps: 0 };
      ev.push({ t: 'academy', what: 'cancel', city: c!.id, faction: f, x: c!.x, y: c!.y });
      res = { ok: true, events: ev };
      break;
    }
    case 'academyShield': {
      const c = cityById(s, cmd.city);
      const chk = shieldCheck(s, f, c);
      if (chk !== 'ok') return fail(chk);
      fa.stars -= ACADEMY.shield.cost;
      c!.shield = { hp: ACADEMY.shield.hp, max: ACADEMY.shield.hp };
      delete c!.shieldReady;
      ev.push({ t: 'shield', what: 'built', city: c!.id, faction: f, hp: c!.shield.hp });
      res = { ok: true, events: ev };
      break;
    }
    case 'buildBeamer': {
      const c = cityById(s, cmd.city);
      const chk = beamerCheck(s, f, c);
      if (chk !== 'ok') return fail(chk);
      fa.stars -= ACADEMY.beamer.cost;
      c!.relay = true;
      ev.push({ t: 'beam', what: 'built', city: c!.id, faction: f, x: c!.x, y: c!.y });
      res = { ok: true, events: ev };
      break;
    }
    case 'beam': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const c = cityById(s, cmd.city);
      const chk = beamCheck(s, u, c);
      if (chk !== 'ok') return fail(chk);
      // Einheit verlaesst die Karte fuer eine Runde (Radarimpuls endet, Verschanzung faellt) / the unit leaves the map for one round (radar sweep ends, entrenchment falls)
      if (has(u, 'radar')) dropSightings(s, u.id);
      if (u.entrenched) u.entrenched = false;
      s.units = s.units.filter((o) => o.id !== u.id);
      u.exhausted = true; u.moved = true;
      (s.transit ??= []).push({ unit: u, relay: c!.id, round: s.round });
      c!.beamed = s.round;
      ev.push({ t: 'beam', what: 'depart', city: c!.id, faction: f, x: u.x, y: u.y, unit: u.id, unitType: u.type });
      res = { ok: true, events: ev };
      break;
    }
    case 'attackAcademy': {
      const u = ownUnit(cmd.unit);
      if (typeof u === 'string') return fail(u);
      const c = cityById(s, cmd.city);
      const chk = academyAttackCheck(s, u, c);
      if (chk !== 'ok') return fail(chk);
      const pre = academyAttackPreview(s, u, c!);
      const hit: HitKind = hitChanceOn(s) ? rollHit(pre.odds, nextRandom(s)) : 'full';
      faceTowards(u, c!);
      if (pre.forced) {
        // schwebend ohne Schild: jeder Treffer erzwingt die Notlandung / floating without a shield: every hit forces an emergency landing
        if (!academyMissed(hit)) forceLanding(s, c!, u.id, ev);
        else ev.push({ t: 'shield', what: 'hit', city: c!.id, faction: c!.owner!, hp: 0, dmg: 0, unit: u.id, hit });
      } else {
        const dmg = hitDamage(pre.toShield, hit);
        if (dmg > 0) shieldTake(s, c!, dmg, u.id, ev);
        else ev.push({ t: 'shield', what: 'hit', city: c!.id, faction: c!.owner!, hp: c!.shield!.hp, dmg: 0, unit: u.id, hit });
      }
      addMark(s, c!.x, c!.y, 'scorch', scarWeight(u));
      fa.lastAttackRound = s.round;
      if (has(u, 'submerged') || has(u, 'camo')) u.revealed = true;
      if (has(u, 'kamikaze')) { killUnit(s, u, null, ev, false); res = { ok: true, events: ev }; break; }
      const withdraw = canWithdrawAfterAttack(s, u);
      u.attacked = true;
      if (withdraw) u.withdraw = true;
      else if (!(has(u, 'escape') && !u.moved)) u.exhausted = true;
      if (u.moved && u.attacked) u.exhausted = true;
      res = { ok: true, events: ev };
      break;
    }
    case 'hack': {
      // NEXUS: neutralen Ort fernuebernehmen (HACK.place) / NEXUS: remote takeover of a neutral place (HACK.place)
      const c = cityById(s, cmd.city);
      if (!c) return fail('invalidTarget');
      const check = hackCheck(s, f, c);
      if (check !== 'ok') return fail(check);
      applyHack(s, f, c, ev, hackKit(s));
      res = { ok: true, events: ev };
      break;
    }
    case 'hackCity': {
      // NEXUS: feindliche Stadt aufdecken, nicht einnehmen (HACK.city) / NEXUS: reveal a hostile city, not capture it (HACK.city)
      const c = cityById(s, cmd.city);
      if (!c) return fail('invalidTarget');
      const check = cityHackCheck(s, f, c);
      if (check !== 'ok') return fail(check);
      applyCityHack(s, f, c, ev, { ...hackKit(s), sight: (g, x, y, r, rounds) => addSighting(s, g, x, y, r, rounds) });
      res = { ok: true, events: ev };
      break;
    }
    case 'hackTower': {
      const check = hackTowerCheck(s, f, cmd.x, cmd.y);
      if (check !== 'ok') return fail(check);
      buildHackTower(s, f, cmd.x, cmd.y, ev);
      res = { ok: true, events: ev };
      break;
    }
    case 'hijack': {
      const target = unitById(s, cmd.target);
      const check = hijackCheck(s, f, cmd.x, cmd.y, target);
      if (check !== 'ok') return fail(check);
      applyHijack(s, f, cmd.x, cmd.y, target!, ev, hackKit(s));
      res = { ok: true, events: ev };
      break;
    }
    case 'endTurn': {
      if (s.pendingRewards.some((p) => cityById(s, p.cityId)?.owner === f)) return fail('pendingReward');
      endTurnProcessing(s, ev);
      // Uebernahmen (HACK.tower) enden am Ende des Zuges der hackenden Fraktion / takeovers (HACK.tower) end at the end of the hacking faction's turn
      endHijacks(s, f, ev, hackKit(s));
      advance(s, ev);
      if (s.campaign) evaluateCampaign(s, ev, true);
      wakeTurrets(s, ev);
      sweepEmplacements(s, ev);
      sweepHijacks(s, ev, hackKit(s));
      res = { ok: true, events: ev };
      s.log.push(...ev.filter((e) => e.t !== 'move'));
      if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
      return res;
    }
    default:
      return fail('invalid');
  }
  // Kult: der letzte Mann kann im eigenen Zug fallen / cult: the last man can fall during the own turn
  if (res.ok && !s.over) checkElimination(s, ev, true);
  if (res.ok && !s.over) afterAction(s, f, ev);
  if (res.ok) { wakeTurrets(s, ev); sweepEmplacements(s, ev); sweepHijacks(s, ev, hackKit(s)); }
  if (res.ok && s.campaign) evaluateCampaign(s, ev, false);
  s.log.push(...ev.filter((e) => e.t !== 'move'));
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
  return res;
}

/**
 * Befehle, die eine vom Hackturm uebernommene Einheit ausfuehren darf (sonst 'hijacked'): ziehen, kaempfen, rasten.
 * Commands a unit taken over by a hack tower may carry out (otherwise 'hijacked'): move, fight, rest.
 */
const HIJACK_COMMANDS: Command['type'][] = ['move', 'attack', 'attackTurret', 'attackAcademy', 'retreat', 'rocket', 'heal', 'repair'];

/** Interne Helfer fuer das Hacken (hacking.ts) / internal helpers for hacking (hacking.ts) */
function hackKit(s: GameState): HackKit {
  return {
    kill: (u, e) => killUnit(s, u, null, e, false),
    wreck: (u, e) => killUnit(s, u, null, e, true),
    roll: () => nextRandom(s),
    reveal: (f, x, y, r, e) => reveal(s, f, x, y, r, e),
    capture: (f, c, e) => captureCity(s, { owner: f }, c, e, true),
  };
}

/** Interne Helfer fuer die Schattenflotte (shadowFleet.ts) / internal helpers for the shadow fleet (shadowFleet.ts) */
function shadowKit(s: GameState): ShadowKit {
  return {
    kill: (u, e) => killUnit(s, u, null, e),
    spare: (u) => spare(s, u),
    interrupt: (u, e) => interruptWonder(s, u, e),
    mark: (x, y) => addMark(s, x, y, 'crater', WAR_MARKS.scar.blast),
    releaseOutpost: (t) => releaseOutpost(s, t),
    connections: (g, e) => updateConnections(s, g, e),
    wake: (p, e) => { if (wakeGunsAt(s, p)) e.push({ t: 'verdanActive', faction: s.current }); },
  };
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
    hitChance: partial.hitChance ?? true,
    factionVictory: partial.factionVictory ?? true,
    ...(partial.towers === false ? { towers: false } : {}),
    // Stuetzpunkte ausdruecklich an oder aus (fehlt = an in freien Partien der Standardwelt, BASES) / bases explicitly on or off (missing = on in free games on the default world, BASES)
    ...(partial.bases !== undefined ? { bases: partial.bases } : {}),
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
