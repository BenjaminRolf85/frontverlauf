/**
 * Lesende Abfragen des Spielkerns (kein Schreibzugriff auf den Zustand).
 * Read-only queries of the game core (never mutate the state).
 */
import {
  BARRIER, CITY_UPGRADES, WEATHER, type CityUpgradeId, type WeatherId, BUILDINGS, CITY, COMBAT, DEFENSE_BONUS, REMAINS, ECON, FACTIONS, FUEL, GRAND_PROJECTS, GRAND_PROJECT_IDS, HEALING, INCOME,
  INFANTRY_TYPES, LOGISTICS_SOURCES, PERKS, RESEARCH_CENTER_TECH, SCORE, TECHS, TECH_IDS, TERRAIN_DEFENSE_TECH, UNITS,
  VETERAN, VISION, type BuildingId, type GrandProjectId, type TechId, type UnitStats, type UnitTypeId,
} from '../data/balance';
import { area, dist, idx, inBounds, isLand, isWater, neighbors, tileAt } from './grid';
import type { City, Faction, GameState, Pos, Tile, Unit } from './types';

export const fac = (s: GameState, i: number): Faction => s.factions[i];
export const hasTech = (s: GameState, f: number, t: TechId) => s.factions[f].techs.includes(t);
export const unitById = (s: GameState, id: number) => s.units.find((u) => u.id === id);
export const cityById = (s: GameState, id: number) => s.cities.find((c) => c.id === id);
export const unitAt = (s: GameState, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y);
export const cityAt = (s: GameState, x: number, y: number) => {
  const t = tileAt(s, x, y);
  return t && t.cityId !== null ? cityById(s, t.cityId) : undefined;
};
export const ownCities = (s: GameState, f: number) => s.cities.filter((c) => c.owner === f);
export const ownUnits = (s: GameState, f: number) => s.units.filter((u) => u.owner === f);
export const hqOf = (s: GameState, f: number) => s.cities.find((c) => c.isHQ && c.hqOf === f && c.owner === f);

export function stats(u: Unit): UnitStats {
  return UNITS[u.type];
}
export const has = (u: Unit, a: UnitStats['abilities'][number]) => UNITS[u.type].abilities.includes(a);
export const isShip = (u: Unit) => UNITS[u.type].ship;

/** Gebiet der Fraktion? / territory of faction? */
export function territoryOwner(s: GameState, t: Tile): number | null {
  if (t.territory === null) return null;
  const c = cityById(s, t.territory);
  return c ? c.owner : null;
}

export function isHostile(s: GameState, a: number, b: number): boolean {
  if (a === b) return false;
  return s.factions[a].relations[b] === 'war';
}

export function isExplored(s: GameState, f: number, x: number, y: number): boolean {
  return s.factions[f].explored[idx(s.size, x, y)] === 1;
}

/** Sieht Fraktion f die Einheit u? / does faction f see unit u? */
export function canSeeUnit(s: GameState, f: number, u: Unit): boolean {
  if (u.owner === f) return true;
  if (!isExplored(s, f, u.x, u.y)) return false;
  const hidden = has(u, 'invisible') || (has(u, 'submerged') && !u.revealed);
  if (!hidden) return true;
  return s.units.some((o) => o.owner === f && dist(o, u) <= 1) ||
    s.cities.some((c) => c.owner === f && dist(c, u) <= 1);
}

export function unitCost(s: GameState, f: number, type: UnitTypeId): number | null {
  const base = UNITS[type].cost;
  if (base === null) return null;
  const fs = FACTIONS[s.factions[f].id];
  return fs.discountUnit === type ? Math.ceil(base * (1 - fs.discount)) : base;
}

export function unitLimit(s: GameState, c: City): number {
  const extra = c.owner !== null && FACTIONS[s.factions[c.owner].id].perk === 'massMobilization'
    ? PERKS.massMobilizationExtraUnits : 0;
  return c.level + CITY.unitLimitExtra + extra;
}
export const supportedUnits = (s: GameState, c: City) => s.units.filter((u) => u.homeCity === c.id && u.owner === c.owner).length;

export function levelUpCost(s: GameState, c: City): number {
  let cost = CITY.levelUpCost(c.level);
  if (c.owner !== null && FACTIONS[s.factions[c.owner].id].perk === 'boom') cost = Math.max(1, cost - PERKS.boomLevelReduction);
  return cost;
}

export function researchCost(s: GameState, f: number, tech: TechId): number {
  const cities = Math.max(1, ownCities(s, f).length);
  let cost = ECON.researchCost(TECHS[tech].tier, cities);
  let factor = 1;
  if (FACTIONS[s.factions[f].id].perk === 'researchLead') factor *= 1 - PERKS.researchLeadDiscount;
  if (hasTech(s, f, 'cybernetics')) factor *= 1 - ECON.cyberneticsDiscount;
  return Math.ceil(cost * factor - 1e-9);
}

export type TechState = 'researched' | 'available' | 'locked' | 'expensive';
export function techState(s: GameState, f: number, tech: TechId): TechState {
  if (hasTech(s, f, tech)) return 'researched';
  const parent = TECHS[tech].parent;
  if (parent && !hasTech(s, f, parent)) return 'locked';
  return s.factions[f].stars >= researchCost(s, f, tech) ? 'available' : 'expensive';
}

export function embassyCost(s: GameState, f: number): number {
  const n = s.factions[f].embassies.length;
  let cost = ECON.embassyBaseCost + n * ECON.embassyStep;
  if (FACTIONS[s.factions[f].id].perk === 'alliancePolicy') cost = Math.ceil(cost * PERKS.allianceEmbassyCostFactor);
  return cost;
}

export function logisticsIncome(s: GameState, x: number, y: number): number {
  let n = 0;
  for (const p of neighbors(s.size, x, y)) {
    const b = tileAt(s, p.x, p.y)!.building;
    if (b && LOGISTICS_SOURCES.includes(b)) n++;
  }
  return Math.min(INCOME.logisticsMax, n * INCOME.logisticsPerAdjacent);
}

export function cityTiles(s: GameState, c: City): Pos[] {
  const out: Pos[] = [];
  for (const p of area(s.size, c.x, c.y, c.radius)) if (tileAt(s, p.x, p.y)!.territory === c.id) out.push(p);
  return out;
}

export function cityIncome(s: GameState, c: City): number {
  if (c.owner === null || c.noIncomeNext) return 0;
  let inc = INCOME.perCityLevel * c.level;
  if (c.isHQ && c.hqOf === c.owner) inc += INCOME.hq;
  if (c.factory) inc += INCOME.factory;
  if (c.govQuarter) inc += INCOME.govQuarter;
  if ((c.upgrades ?? []).includes('depot')) inc += CITY_UPGRADES.depotIncome;
  for (const p of cityTiles(s, c)) {
    if (tileAt(s, p.x, p.y)!.building === 'logisticsCenter') inc += logisticsIncome(s, p.x, p.y);
  }
  return inc;
}

export function embassyIncome(s: GameState, f: number): number {
  const mult = FACTIONS[s.factions[f].id].perk === 'alliancePolicy' ? PERKS.allianceEmbassyIncomeFactor : 1;
  let inc = 0;
  for (const g of s.factions[f].embassies) if (hqOf(s, g)) inc += INCOME.embassy * mult;
  for (const other of s.factions) {
    if (other.index !== f && other.alive && other.embassies.includes(f) && hqOf(s, f)) inc += INCOME.embassy * mult;
  }
  return inc;
}

export function income(s: GameState, f: number): number {
  let inc = 0;
  for (const c of ownCities(s, f)) inc += cityIncome(s, c);
  inc += embassyIncome(s, f);
  const fa = s.factions[f];
  if (!fa.human) inc += INCOME.aiBonus[fa.difficulty];
  return inc;
}

export function researchCenterPoints(s: GameState, t: Tile): number {
  if (t.researchBuilt === null) return 0;
  const steps = Math.floor((s.round - t.researchBuilt) / SCORE.researchCenterInterval);
  return Math.min(SCORE.researchCenterMax, SCORE.researchCenterBase + steps * SCORE.researchCenterStep);
}

export function unitScore(u: Unit): number {
  if (u.type === 'tank') return SCORE.tankUnit;
  if (u.carried) return (UNITS[u.carried].cost ?? (u.carried === 'tank' ? SCORE.tankUnit : 0)) + (UNITS[u.type].cost ?? 0);
  return UNITS[u.type].cost ?? 0;
}

export function score(s: GameState, f: number): number {
  const fa = s.factions[f];
  let p = 0;
  for (const e of fa.explored) if (e) p += SCORE.revealedTile;
  for (const c of ownCities(s, f)) {
    p += SCORE.cityLevel * c.level;
    if (c.govQuarter) p += SCORE.govQuarter;
    for (const pos of cityTiles(s, c)) {
      p += SCORE.territoryTile;
      const t = tileAt(s, pos.x, pos.y)!;
      if (t.building === 'researchCenter') p += researchCenterPoints(s, t);
    }
  }
  for (const t of fa.techs) p += SCORE.techPerTier * TECHS[t].tier;
  for (const u of ownUnits(s, f)) p += unitScore(u);
  p += SCORE.grandProject * fa.grandProjectsBuilt.length;
  return p;
}

// ---------- Bewegung / movement ----------

function isBridge(t: Tile) { return t.building === 'bridge'; }
function walkable(t: Tile) { return isLand(t) || isBridge(t); }
function roadLike(t: Tile) { return t.road || t.cityId !== null || isBridge(t); }

export interface Reach { x: number; y: number; cost: number; path: Pos[]; embark?: boolean; disembark?: boolean }

/** Kann sich die Einheit noch bewegen? / can the unit still move? */
export function canMove(u: Unit): boolean {
  if (u.fresh || u.exhausted || u.moved || u.moveDone) return false;
  if (u.attacked && !has(u, 'escape')) return false;
  return true;
}

export function canAttackNow(u: Unit): boolean {
  if (u.fresh || u.exhausted || u.attacked) return false;
  if (UNITS[u.type].attack <= 0 || UNITS[u.type].range <= 0) return false;
  if (u.moved && !has(u, 'dash')) return false;
  return true;
}

export function canActStill(u: Unit): boolean {
  return !u.fresh && !u.exhausted && !u.attacked;
}

function zoc(s: GameState, u: Unit, x: number, y: number): boolean {
  for (const o of s.units) {
    if (o.owner === u.owner || !isHostile(s, u.owner, o.owner)) continue;
    if (dist(o, { x, y }) === 1 && canSeeUnit(s, u.owner, o)) return true;
  }
  return false;
}

/** Erreichbare Felder (Dijkstra) / reachable tiles (Dijkstra) */
export function reachable(s: GameState, u: Unit, ignoreState = false): Reach[] {
  if (!ignoreState && !canMove(u)) return [];
  const st = UNITS[u.type];
  const fly = has(u, 'fly');
  const ship = st.ship;
  const f = u.owner;
  const maxMove = effectiveMove(s, u);
  const best = new Map<number, Reach>();
  const startKey = idx(s.size, u.x, u.y);
  best.set(startKey, { x: u.x, y: u.y, cost: 0, path: [] });
  const open: { key: number; x: number; y: number; cost: number; stop: boolean; path: Pos[] }[] = [
    { key: startKey, x: u.x, y: u.y, cost: 0, stop: false, path: [] },
  ];
  const results: Reach[] = [];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift()!;
    if (cur.stop) continue;
    const fromTile = tileAt(s, cur.x, cur.y)!;
    for (const n of neighbors(s.size, cur.x, cur.y)) {
      const t = tileAt(s, n.x, n.y)!;
      let cost = 1;
      let stop = false;
      let embark = false;
      let disembark = false;
      if (fly) {
        // fliegt ueber alles / flies over everything
      } else if (ship) {
        if (isWater(t)) {
          if (t.terrain === 'ocean' && !hasTech(s, f, 'diving')) continue;
        } else {
          if (t.terrain === 'mountain' && !hasTech(s, f, 'mountainTraining')) continue;
          disembark = true; stop = true;
        }
      } else {
        if (!walkable(t)) {
          if (t.building === 'navalBase' && territoryOwner(s, t) === f && hasTech(s, f, 'coastalEconomy')) {
            embark = true; stop = true;
          } else continue;
        } else {
          if (t.terrain === 'mountain' && !hasTech(s, f, 'mountainTraining')) continue;
          if ((t.terrain === 'forest' || t.terrain === 'mountain') && !t.road) stop = true;
          if (roadLike(fromTile) && roadLike(t) && (fromTile.road || t.road || isBridge(t) || isBridge(fromTile))) cost = 0.5;
        }
      }
      const total = cur.cost + cost;
      if (total > maxMove + 1e-9) continue;
      // Panzersperre stoppt feindliche Fahrzeuge / tank barrier stops hostile vehicles
      if (!fly && !ship && t.barrier && t.barrier.owner !== f && BARRIER.vehicles.includes(u.type)) stop = true;
      const other = unitAt(s, n.x, n.y);
      if (other && other.owner !== f) continue;
      // Spion darf feindliche Stadt betreten / spy may enter hostile cities
      const city = t.cityId !== null ? cityById(s, t.cityId)! : null;
      if (city && city.owner !== null && city.owner !== f && !isHostile(s, f, city.owner) && !has(u, 'uprising')) {
        // Stadt einer befriedeten Fraktion: nicht betretbar / city of faction at peace: not enterable
        continue;
      }
      if (zoc(s, u, n.x, n.y)) stop = true;
      if (has(u, 'uprising') && city && city.owner !== null && city.owner !== f && isHostile(s, f, city.owner)) stop = true;
      const key = idx(s.size, n.x, n.y);
      const prev = best.get(key);
      if (prev && prev.cost <= total) continue;
      const path = [...cur.path, { x: n.x, y: n.y }];
      const r: Reach = { x: n.x, y: n.y, cost: total, path, embark, disembark };
      best.set(key, r);
      open.push({ key, x: n.x, y: n.y, cost: total, stop, path });
    }
  }
  for (const [key, r] of best) {
    if (key === startKey) continue;
    const occupant = unitAt(s, r.x, r.y);
    if (occupant) continue; // kann nicht auf besetztem Feld enden / cannot end on occupied tile
    results.push(r);
  }
  return results;
}

// ---------- Kampf / combat ----------

export function defenseBonus(s: GameState, def: Unit, attacker?: Unit): number {
  if (has(def, 'fly')) return DEFENSE_BONUS.open;
  const t = tileAt(s, def.x, def.y)!;
  let b = DEFENSE_BONUS.open;
  const terrainTech = TERRAIN_DEFENSE_TECH[t.terrain];
  if (terrainTech && hasTech(s, def.owner, terrainTech)) {
    if (isWater(t) === isShip(def)) b = Math.max(b, DEFENSE_BONUS.terrainWithTech);
  }
  if (t.cityId !== null && has(def, 'fortify')) {
    const c = cityById(s, t.cityId)!;
    if (c.owner === def.owner) b = Math.max(b, c.bunkerRing ? DEFENSE_BONUS.cityWithBunker : DEFENSE_BONUS.city);
  }
  if (t.outpost && t.outpost.owner === def.owner && INFANTRY_TYPES.includes(def.type)) {
    if (!(attacker && has(attacker, 'ignoreOutpost'))) b = Math.max(b, DEFENSE_BONUS.outpost);
  }
  // Wrack als Deckung: +1 fuer Landeinheiten / wreck as cover: +1 for land units
  if (t.remains?.kind === 'wreck' && !isShip(def)) b += REMAINS.wreckDefenseBonus;
  return b;
}

export interface CombatPreview { toDefender: number; toAttacker: number; kills: boolean; retaliates: boolean }

export function combatPreview(s: GameState, att: Unit, def: Unit): CombatPreview {
  const a = UNITS[att.type], d = UNITS[def.type];
  const bonus = defenseBonus(s, def, att);
  const defense = effectiveDefense(s, def);
  const attackForce = a.attack * (att.hp / att.maxHp);
  const defenseForce = defense * (def.hp / def.maxHp) * bonus;
  const total = attackForce + defenseForce;
  const toDefender = total > 0 ? Math.round((attackForce / total) * a.attack * COMBAT.damageFactor) : 0;
  const kills = toDefender >= def.hp;
  const retaliates = !kills && !has(def, 'noRetaliate') && d.range > 0 && dist(att, def) <= effectiveRange(s, def);
  const toAttacker = retaliates && total > 0 ? Math.round((defenseForce / total) * defense * COMBAT.damageFactor) : 0;
  return { toDefender, toAttacker, kills, retaliates };
}

export function attackTargets(s: GameState, u: Unit): Unit[] {
  if (!canAttackNow(u)) return [];
  const r = effectiveRange(s, u);
  return s.units.filter((o) =>
    o.owner !== u.owner && isHostile(s, u.owner, o.owner) && dist(u, o) <= r && canSeeUnit(s, u.owner, o));
}

export function convertTargets(s: GameState, u: Unit): Unit[] {
  if (!has(u, 'convert') || !canActStill(u)) return [];
  return s.units.filter((o) => o.owner !== u.owner && isHostile(s, u.owner, o.owner) && dist(u, o) === 1 && canSeeUnit(s, u.owner, o));
}

export function healAmount(s: GameState, u: Unit): number {
  const t = tileAt(s, u.x, u.y)!;
  const own = territoryOwner(s, t) === u.owner || (t.outpost !== null && t.outpost.owner === u.owner);
  let h = own ? HEALING.ownTerritory : HEALING.elsewhere;
  // Lazarett auf oder neben der Stadt / hospital on or next to the city
  if (s.cities.some((c) => c.owner === u.owner && dist(c, u) <= 1 && (c.upgrades ?? []).includes('hospital'))) h += CITY_UPGRADES.hospitalHeal;
  return h;
}

export function canHeal(u: Unit): boolean {
  return !u.fresh && !u.exhausted && !u.moved && !u.attacked && u.hp < u.maxHp;
}

export function veteranKills(s: GameState, u: Unit): number {
  return FACTIONS[s.factions[u.owner].id].perk === 'drill' ? VETERAN.killsDravon : VETERAN.kills;
}

// ---------- Einnahme / capture ----------

export type CaptureKind = 'village' | 'city' | 'outpost';
export function captureKind(s: GameState, u: Unit): CaptureKind | null {
  if (u.fresh || u.exhausted || u.moved || u.attacked) return null;
  if (u.x !== u.startX || u.y !== u.startY) return null;
  if (isShip(u) || has(u, 'fly') || has(u, 'uprising')) return null;
  const t = tileAt(s, u.x, u.y)!;
  if (t.cityId !== null) {
    const c = cityById(s, t.cityId)!;
    if (c.owner === null) return 'village';
    if (c.owner !== u.owner && isHostile(s, u.owner, c.owner)) return 'city';
    return null;
  }
  if (t.outpost && t.outpost.owner !== u.owner && INFANTRY_TYPES.includes(u.type) && isHostile(s, u.owner, t.outpost.owner)) {
    return 'outpost';
  }
  return null;
}

// ---------- Hubschrauber / helicopter ----------

export function isRefuelSpot(s: GameState, f: number, x: number, y: number): boolean {
  for (const p of area(s.size, x, y, 1)) {
    const t = tileAt(s, p.x, p.y)!;
    if (t.cityId !== null && cityById(s, t.cityId)!.owner === f) return true;
    if (t.outpost && t.outpost.owner === f) return true;
  }
  return false;
}

/** Felder, von denen aus noch ein Rueckflug moeglich ist / tiles that still allow a safe return */
export function heliSafe(s: GameState, u: Unit, x: number, y: number): boolean {
  if (u.fuel === null) return true;
  if (isRefuelSpot(s, u.owner, x, y)) return true;
  const fuelAfter = u.fuel - fuelBurn(s);
  if (fuelAfter <= 0) return false;
  const range = fuelAfter * UNITS[u.type].move;
  for (let yy = 0; yy < s.size; yy++) {
    for (let xx = 0; xx < s.size; xx++) {
      if (dist({ x, y }, { x: xx, y: yy }) <= range && isRefuelSpot(s, u.owner, xx, yy)) return true;
    }
  }
  return false;
}

export function heliWillCrash(s: GameState, u: Unit): boolean {
  return u.fuel !== null && u.fuel <= fuelBurn(s) && !isRefuelSpot(s, u.owner, u.x, u.y);
}

export const MAX_FUEL = FUEL.tank;

// ---------- Bauen / building ----------

export type BuildCheck = { ok: true; cost: number } | { ok: false; error: 'techMissing' | 'invalidTile' | 'notInTerritory' | 'onePerCity' | 'notEnoughStars' | 'alreadyBuilt'; cost: number };

export function buildCheck(s: GameState, f: number, b: BuildingId, x: number, y: number): BuildCheck {
  const st = BUILDINGS[b];
  const cost = st.cost;
  if (!inBounds(s.size, x, y)) return { ok: false, error: 'invalidTile', cost };
  const t = tileAt(s, x, y)!;
  if (territoryOwner(s, t) !== f) return { ok: false, error: 'notInTerritory', cost };
  if (b === 'researchCenter') {
    const terr = t.terrain === 'ocean' ? null : (t.terrain as 'plain' | 'forest' | 'mountain' | 'shallow');
    if (!terr || !hasTech(s, f, RESEARCH_CENTER_TECH[terr])) return { ok: false, error: 'techMissing', cost };
  } else if (st.tech && !hasTech(s, f, st.tech)) return { ok: false, error: 'techMissing', cost };
  if (t.cityId !== null || t.feature !== null || t.grandProject || t.outpost) return { ok: false, error: 'invalidTile', cost };
  if (!st.terrain.includes(t.terrain)) return { ok: false, error: 'invalidTile', cost };
  if (b === 'road') {
    if (t.road) return { ok: false, error: 'alreadyBuilt', cost };
    if (t.building && t.building !== 'researchCenter' && !isLand(t)) return { ok: false, error: 'invalidTile', cost };
  } else {
    if (t.building) return { ok: false, error: 'alreadyBuilt', cost };
    if (st.resource && t.resource !== st.resource) return { ok: false, error: 'invalidTile', cost };
    if (!st.resource && t.resource && b !== 'bridge') return { ok: false, error: 'invalidTile', cost };
    if (t.road && b !== 'bridge') return { ok: false, error: 'invalidTile', cost };
  }
  if (b === 'bridge') {
    const landN = neighbors(s.size, x, y).filter((p) => isLand(tileAt(s, p.x, p.y)!)).length;
    if (landN < 2) return { ok: false, error: 'invalidTile', cost };
    if (unitAt(s, x, y)) return { ok: false, error: 'invalidTile', cost };
  }
  if (st.onePerCity) {
    const c = cityById(s, t.territory!)!;
    if (cityTiles(s, c).some((p) => tileAt(s, p.x, p.y)!.building === b)) return { ok: false, error: 'onePerCity', cost };
  }
  if (s.factions[f].stars < cost) return { ok: false, error: 'notEnoughStars', cost };
  return { ok: true, cost };
}

export function grandProjectCheck(s: GameState, f: number, id: GrandProjectId, x: number, y: number): boolean {
  const fa = s.factions[f];
  if (!fa.grandProjectsUnlocked.includes(id) || fa.grandProjectsBuilt.includes(id)) return false;
  if (!inBounds(s.size, x, y)) return false;
  const t = tileAt(s, x, y)!;
  if (territoryOwner(s, t) !== f) return false;
  if (!isLand(t) || t.terrain === 'mountain') return false;
  return !(t.cityId !== null || t.building || t.road || t.feature || t.grandProject || t.outpost || t.resource);
}

export function grandProjectConditionMet(s: GameState, f: number, id: GrandProjectId): boolean {
  const fa = s.factions[f];
  switch (id) {
    case 'peaceMonument': return s.round - Math.max(0, fa.lastAttackRound) >= GRAND_PROJECTS.peaceRounds;
    case 'stateBank': return fa.stars >= GRAND_PROJECTS.bankStars;
    case 'victoryColumn': return fa.kills >= GRAND_PROJECTS.kills;
    case 'worldTradeCenter': return ownCities(s, f).filter((c) => c.connected && !(c.isHQ && c.hqOf === f)).length >= GRAND_PROJECTS.connectedCities;
    case 'governmentPalace': return ownCities(s, f).some((c) => c.level >= GRAND_PROJECTS.palaceLevel);
    case 'academy': return TECH_IDS.every((t) => fa.techs.includes(t));
    case 'satelliteCenter': return fa.radarsFound.length >= s.radars.length;
  }
}
export { GRAND_PROJECT_IDS };

export function outpostCheck(s: GameState, u: Unit): 'ok' | 'techMissing' | 'invalidTile' | 'notEnoughStars' | 'cannotCapture' {
  if (!INFANTRY_TYPES.includes(u.type)) return 'cannotCapture';
  if (u.fresh || u.exhausted || u.attacked) return 'cannotCapture';
  if (!hasTech(s, u.owner, 'fortification')) return 'techMissing';
  const t = tileAt(s, u.x, u.y)!;
  if (!['plain', 'forest', 'mountain'].includes(t.terrain)) return 'invalidTile';
  if (t.cityId !== null || t.outpost || t.building || t.feature || t.grandProject) return 'invalidTile';
  if (s.factions[u.owner].stars < ECON.outpostCost) return 'notEnoughStars';
  return 'ok';
}

export function trainCheck(s: GameState, c: City, type: UnitTypeId):
  'ok' | 'techMissing' | 'notEnoughStars' | 'occupied' | 'unitLimit' | 'invalid' {
  if (c.owner === null) return 'invalid';
  const st = UNITS[type];
  if (st.ship || st.cost === null) return 'invalid';
  if (st.tech && !hasTech(s, c.owner, st.tech)) return 'techMissing';
  if (unitAt(s, c.x, c.y)) return 'occupied';
  if (supportedUnits(s, c) >= unitLimit(s, c)) return 'unitLimit';
  if (s.factions[c.owner].stars < unitCost(s, c.owner, type)!) return 'notEnoughStars';
  return 'ok';
}

export function upgradeCheck(s: GameState, u: Unit, to: UnitTypeId): 'ok' | 'techMissing' | 'notEnoughStars' | 'invalid' | 'notInTerritory' {
  if (!isShip(u) || !UNITS[to].ship || to === u.type || to === 'landingBoat') return 'invalid';
  if (u.fresh) return 'invalid';
  const t = tileAt(s, u.x, u.y)!;
  if (territoryOwner(s, t) !== u.owner) return 'notInTerritory';
  if (UNITS[to].tech && !hasTech(s, u.owner, UNITS[to].tech!)) return 'techMissing';
  if (s.factions[u.owner].stars < (UNITS[to].cost ?? 0)) return 'notEnoughStars';
  return 'ok';
}

/** Belohnungsoptionen beim Stadtaufstieg / reward options when a city levels up */
export type RewardId = 'factory' | 'drone' | 'bunkerRing' | 'stars' | 'expand' | 'population' | 'govQuarter' | 'tank';
export function rewardOptions(c: City, level: number): [RewardId, RewardId] {
  if (level === 2) return ['factory', 'drone'];
  if (level === 3) return ['bunkerRing', 'stars'];
  if (level === 4) return ['expand', 'population'];
  return [c.govQuarter ? 'stars' : 'govQuarter', 'tank'];
}

export function visionRadius(s: GameState, u: Unit): number {
  return visionRadiusAt(s, u, u.x, u.y);
}

/** Sichtweite der Einheit, wenn sie auf (x, y) stuende / vision of the unit if it stood on (x, y) */
export function visionRadiusAt(s: GameState, u: Unit, x: number, y: number): number {
  const t = tileAt(s, x, y)!;
  return Math.max(UNITS[u.type].vision, t.terrain === 'mountain' ? VISION.mountain : VISION.unit);
}

export function contactStars(s: GameState, g: number): number {
  const pts = score(s, g);
  return Math.min(ECON.firstContactMax, Math.max(1, Math.ceil(pts / 1000)) * ECON.firstContactPer1000);
}

export function techUnlocks(tech: TechId): { units: UnitTypeId[]; buildings: BuildingId[] } {
  const units = (Object.keys(UNITS) as UnitTypeId[]).filter((k) => UNITS[k].tech === tech);
  const buildings = (Object.keys(BUILDINGS) as BuildingId[]).filter((k) => BUILDINGS[k].tech === tech);
  for (const [terr, t] of Object.entries(RESEARCH_CENTER_TECH)) if (t === tech && terr) buildings.push('researchCenter');
  return { units, buildings };
}

export function aliveFactions(s: GameState): number[] {
  return s.factions.filter((f) => f.alive).map((f) => f.index);
}

// ---------- Panzersperre / tank barrier ----------

export type BarrierCheck = 'ok' | 'cannotCapture' | 'techMissing' | 'invalidTile' | 'notEnoughStars' | 'occupied' | 'outOfRange';

/** Kann die Einheit eine Panzersperre auf (x,y) bauen? / can the unit build a tank barrier on (x,y)? */
export function barrierCheck(s: GameState, u: Unit, x: number, y: number): BarrierCheck {
  if (!BARRIER.builders.includes(u.type)) return 'cannotCapture';
  if (u.fresh || u.exhausted || u.attacked) return 'cannotCapture';
  if (!hasTech(s, u.owner, 'fortification')) return 'techMissing';
  if (!inBounds(s.size, x, y) || dist(u, { x, y }) !== 1) return 'outOfRange';
  const t = tileAt(s, x, y)!;
  if (!BARRIER.terrain.includes(t.terrain) || t.cityId !== null || t.barrier || t.outpost || t.feature) return 'invalidTile';
  if (unitAt(s, x, y)) return 'occupied';
  if (s.factions[u.owner].stars < BARRIER.cost) return 'notEnoughStars';
  return 'ok';
}

export function barrierTargets(s: GameState, u: Unit): Pos[] {
  return neighbors(s.size, u.x, u.y).filter((p) => barrierCheck(s, u, p.x, p.y) === 'ok');
}

// ---------- Wetter / weather ----------

/** Wetter einer Runde, deterministisch aus Seed und Runde / weather of a round, deterministic from seed and round */
export function weatherFor(seed: number, round: number): WeatherId {
  if (round <= 1) return 'clear';
  const block = Math.floor((round - 1) / WEATHER.cycleRounds);
  let h = (seed ^ WEATHER.salt ^ Math.imul(block + 1, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  const r = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  let acc = 0;
  for (const [w, p] of Object.entries(WEATHER.weights) as [WeatherId, number][]) { acc += p; if (r < acc) return w; }
  return 'clear';
}
export const weather = (s: GameState): WeatherId => (s.config.weather === false ? 'clear' : weatherFor(s.config.seed, s.round));

/** Reichweite inkl. Wetter / range including weather */
export function effectiveRange(s: GameState, u: Unit): number {
  const base = UNITS[u.type].range;
  if (base > 0 && weather(s) === 'rain' && WEATHER.rain.rangeUnits.includes(u.type)) return Math.max(1, base + WEATHER.rain.rangeDelta);
  return base;
}

/** Bewegung inkl. Wetter und Panzersperre / movement including weather and tank barrier */
export function effectiveMove(s: GameState, u: Unit): number {
  let m = UNITS[u.type].move;
  if (weather(s) === 'rain' && WEATHER.rain.moveUnits.includes(u.type)) m = Math.max(1, m + WEATHER.rain.moveDelta);
  if (weather(s) === 'snow' && WEATHER.snow.moveUnits.includes(u.type)) m = Math.max(1, m + WEATHER.snow.moveDelta);
  if (u.slowed) m = Math.min(m, BARRIER.slowedMove);
  return m;
}

// ---------- Stadt-Ausbauten / city upgrades ----------

export const cityUpgrades = (c: City): CityUpgradeId[] => c.upgrades ?? [];
export const hasCityUpgrade = (c: City, u: CityUpgradeId) => cityUpgrades(c).includes(u);

/** Verteidigungswert inkl. Bunker der eigenen Stadt / defence value incl. bunker of the own city */
export function effectiveDefense(s: GameState, u: Unit): number {
  let d = UNITS[u.type].defense;
  const t = tileAt(s, u.x, u.y);
  if (t && t.cityId !== null && !isShip(u) && !has(u, 'fly')) {
    const c = cityById(s, t.cityId);
    if (c && c.owner === u.owner && hasCityUpgrade(c, 'bunker')) d += CITY_UPGRADES.bunkerDefense;
  }
  return d;
}

export type CityUpgradeCheck = 'ok' | 'notYourCity' | 'alreadyBuilt' | 'noSlot' | 'notEnoughStars' | 'invalidTarget';

export function cityUpgradeCheck(s: GameState, f: number, c: City, up: CityUpgradeId, target?: Pos): CityUpgradeCheck {
  if (c.owner !== f) return 'notYourCity';
  const ups = cityUpgrades(c);
  if (ups.includes(up)) return 'alreadyBuilt';
  if (ups.length >= CITY_UPGRADES.slots) return 'noSlot';
  if (s.factions[f].stars < CITY_UPGRADES.cost[up]) return 'notEnoughStars';
  if (up === 'radioTower' && target && !radioTargetOk(s, c, target)) return 'invalidTarget';
  return 'ok';
}

export function radioTargetOk(s: GameState, c: City, p: Pos): boolean {
  return inBounds(s.size, p.x, p.y) && dist(c, p) <= CITY_UPGRADES.radioRange;
}

/** Sinnvolle Funkturm-Ziele: Felder mit mindestens einem unerforschten Feld im Radius / useful radio targets */
export function radioTargets(s: GameState, f: number, c: City): Pos[] {
  const out: Pos[] = [];
  for (const p of area(s.size, c.x, c.y, CITY_UPGRADES.radioRange)) {
    if (area(s.size, p.x, p.y, CITY_UPGRADES.radioRadius).some((q) => !isExplored(s, f, q.x, q.y))) out.push(p);
  }
  return out;
}

/** Sprit pro Runde (Wind: mehr) / fuel burned per round (wind: more) */
export function fuelBurn(s: GameState): number {
  return weather(s) === 'wind' ? WEATHER.wind.fuelBurn : 1;
}
