/**
 * Lesende Abfragen des Spielkerns (kein Schreibzugriff auf den Zustand).
 * Read-only queries of the game core (never mutate the state).
 */
import {
  COUNTER, type UnitClass, JUNGLE, UPKEEP, ROSTERS, CULT, NEXUS, LAND_UNITS, BARRIER, CITY_UPGRADES, WEATHER, XENO, type CityUpgradeId, type WeatherId, BUILDINGS, CITY, COMBAT, DEFENSE_BONUS, REMAINS, ECON, FACTIONS, FUEL, GRAND_PROJECTS, GRAND_PROJECT_IDS, HEALING, INCOME,
  INFANTRY_TYPES, LOGISTICS_SOURCES, PERKS, PERKS2, RESEARCH_CENTER_TECH, SCORE, TECHS, TECH_IDS, TERRAIN_DEFENSE_TECH, UNITS,
  UNIQUE, VETERAN, VISION, HIT, HIT_KINDS, RETREAT, REPAIR, ROCKETS, RANGED_COVER, WONDERS, VICTORY_TECH, type WonderKind, type WonderUnitId, type HitKind, type HitRace, type BuildingId, type FactionId, type GrandProjectId, type Perk2Id, type TechId, type UnitStats, type UnitTypeId,
} from '../data/balance';
import { area, dist, idx, inBounds, isLand, isWater, neighbors, tileAt } from './grid';
import { burning, isJungle } from './hazards';
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
/** Zweites Fraktionsmerkmal der Fraktion f / second faction trait of faction f */
export const perk2Of = (s: GameState, f: number): Perk2Id | null => (s.factions[f] ? FACTIONS[s.factions[f].id].perk2 : null);
/** Einzigartige Einheit der Fraktion (nur klassische Fraktionen) / unique unit of the faction (classic factions only) */
export const uniqueUnitOf = (id: FactionId): UnitTypeId | null => UNIQUE.units[id] ?? null;
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
// Wunder zaehlen nicht zum Stadtlimit / wonders do not count towards the city limit
export const supportedUnits = (s: GameState, c: City) => s.units.filter((u) => u.homeCity === c.id && u.owner === c.owner && !isWonder(u)).length;

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
  // Versuchslabore / test labs
  const labs = Math.min(UNIQUE.testLabMax, countBuildings(s, f, 'testLab'));
  if (labs) factor *= 1 - UNIQUE.testLabDiscount * labs;
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
  // + Reichweite der Aussenposten, die das Gebiet erweitern / + reach of outposts that extend the territory
  for (const p of area(s.size, c.x, c.y, c.radius + OUTPOST_REACH)) if (tileAt(s, p.x, p.y)!.territory === c.id) out.push(p);
  return out;
}

/** Wie weit ein Aussenposten das Gebiet ueber den Stadtradius hinaus tragen kann / how far an outpost can extend territory beyond the city radius */
const OUTPOST_REACH = 2;

/**
 * Gebietserweiterung durch einen Aussenposten auf (x, y): nur wenn das Feld im eigenen Gebiet liegt oder daran grenzt.
 * Erweitert wird die angrenzende eigene Stadt (die naechste), um freie Felder im 3x3 um den Posten.
 * Territory extension by an outpost at (x, y): only if the tile lies in or borders own territory.
 * The adjacent own city (the nearest) gains the free tiles in the 3x3 around the outpost.
 */
export function outpostClaim(s: GameState, f: number, x: number, y: number): { city: number; tiles: number[] } | null {
  let city: City | null = null, best = Infinity;
  for (const p of area(s.size, x, y, 1)) {
    const t = tileAt(s, p.x, p.y)!;
    if (territoryOwner(s, t) !== f) continue;
    const c = cityById(s, t.territory!)!;
    // nicht weiter als die Reichweite von der Stadt / not further than the reach from the city
    if (dist(c, { x, y }) > c.radius + OUTPOST_REACH - 1) continue;
    const d = dist(c, { x, y });
    if (d < best) { best = d; city = c; }
  }
  if (!city) return null;
  const tiles: number[] = [];
  for (const p of area(s.size, x, y, 1)) {
    const t = tileAt(s, p.x, p.y)!;
    if (t.territory === null && t.cityId === null) tiles.push(p.y * s.size + p.x);
  }
  return { city: city.id, tiles };
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

/**
 * Wirkt ein Gebaeude fuer Fraktion f? Fraktionsgebaeude (FACTION_BUILDINGS) nur fuer ihre eigene Fraktion; eroberte geben nur
 * ihre Bevoelkerung (beim Bau).
 * Does a building work for faction f? Faction buildings (FACTION_BUILDINGS) only for their own faction; captured ones give
 * nothing but their population (on construction).
 */
export function buildingWorksFor(s: GameState, f: number, b: BuildingId): boolean {
  const own = FACTION_BUILDINGS[b];
  return !own || own === s.factions[f]?.id;
}

/** Wirksame Gebaeude eines Typs im Gebiet der Fraktion / working buildings of a type in the faction's territory */
export function countBuildings(s: GameState, f: number, b: BuildingId): number {
  if (!buildingWorksFor(s, f, b)) return 0;
  let n = 0;
  for (const t of s.tiles) if (t.building === b && territoryOwner(s, t) === f) n++;
  return n;
}

/** Aktive Friedensvertraege / active peace treaties */
export function peaceTreaties(s: GameState, f: number): number {
  const fa = s.factions[f];
  return fa.relations.filter((r, g) => g !== f && r === 'peace' && s.factions[g]?.alive).length;
}

/** Verbundene Hafenstaedte (Marinestuetzpunkt im Stadtgebiet, mit dem HQ verbunden) / connected harbour cities */
export function harbourCities(s: GameState, f: number): number {
  let n = 0;
  for (const c of ownCities(s, f)) {
    if (!(c.connected || (c.isHQ && c.hqOf === f))) continue;
    if (cityTiles(s, c).some((p) => tileAt(s, p.x, p.y)!.building === 'navalBase')) n++;
  }
  return n;
}

/** Einkommen aus Botschaftspalast und Handelskontor / income from embassy palace and trading post */
export function uniqueBuildingIncome(s: GameState, f: number): number {
  let inc = 0;
  if (countBuildings(s, f, 'embassyPalace')) inc += UNIQUE.palacePerPeace * peaceTreaties(s, f);
  if (countBuildings(s, f, 'tradingPost')) inc += UNIQUE.tradingPostPerHarbour * harbourCities(s, f);
  return inc;
}

export function income(s: GameState, f: number): number {
  let inc = 0;
  for (const c of ownCities(s, f)) inc += cityIncome(s, c);
  inc += embassyIncome(s, f);
  inc += uniqueBuildingIncome(s, f);
  const fa = s.factions[f];
  if (!fa.human) inc += INCOME.aiBonus[fa.difficulty];
  return inc;
}

/** Sold eines Einheitentyps (pauschal oder Anteil am Preis) / upkeep of a unit type (flat or share of the price) */
const typeUpkeep = (type: UnitTypeId) => UPKEEP.flat[type] ?? Math.ceil((UNITS[type].cost ?? 0) * UPKEEP.share);

/** Sold einer Einheit pro Runde (ohne Freikontingent) / upkeep of one unit per round (before the free quota) */
export function unitUpkeep(u: Unit): number {
  if (isWonder(u)) return 0;
  // Landungsboot: Wert der getragenen Einheit / landing boat: value of the carried unit
  const own = typeUpkeep(u.type === 'landingBoat' && u.carried ? u.carried : u.type);
  // Schiffe kosten mindestens den Sold der getragenen Einheit / ships cost at least the upkeep of the carried unit
  return UNITS[u.type].ship && u.carried ? Math.max(own, typeUpkeep(u.carried)) : own;
}
/** Einheiten, die Sold kosten: alle ausser den aeltesten freien / units that cost upkeep: all but the oldest free ones */
export function paidUnits(s: GameState, f: number): Unit[] {
  // Wunder kosten keinen Sold und belegen kein Freikontingent / wonders cost no upkeep and take no free slot
  return s.units.filter((u) => u.owner === f && !isWonder(u)).sort((a, b) => a.id - b.id).slice(UPKEEP.freeUnits);
}
/** Gesamtsold pro Runde / total upkeep per round */
export function upkeep(s: GameState, f: number): number {
  let sum = 0;
  for (const u of paidUnits(s, f)) sum += unitUpkeep(u);
  return sum;
}
/** Netto-Einkommen nach Sold / net income after upkeep */
export const netIncome = (s: GameState, f: number) => income(s, f) - upkeep(s, f);

export function researchCenterPoints(s: GameState, t: Tile): number {
  if (t.researchBuilt === null) return 0;
  const steps = Math.floor((s.round - t.researchBuilt) / SCORE.researchCenterInterval);
  return Math.min(SCORE.researchCenterMax, SCORE.researchCenterBase + steps * SCORE.researchCenterStep);
}

export function unitScore(u: Unit): number {
  if (isWonder(u)) return 0;
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
  if (isAlienFaction(s, f)) for (const c of ownCities(s, f)) for (const pos of cityTiles(s, c)) if (tileAt(s, pos.x, pos.y)!.xeno) p += XENO.tilePoints;
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
  // Waal schiesst erst nach der ersten Bauphase / the Waal fires only after its first build phase
  if (u.type === 'waal' && !waalArmed(u)) return false;
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
          if (t.terrain === 'mountain' && !hasTech(s, f, 'mountainTraining') && !has(u, 'walker')) continue;
          disembark = true; stop = true;
        }
      } else {
        // Zyrr waten langsam durchs Wasser: jedes Wasserfeld beendet die Bewegung
        // Zyrr wade slowly through water: every water tile ends the movement
        if (has(u, 'wade') && !walkable(t)) {
          stop = true;
        } else if (!walkable(t)) {
          if (t.building === 'navalBase' && territoryOwner(s, t) === f && hasTech(s, f, 'coastalEconomy') && !has(u, 'wonder')) {
            embark = true; stop = true;
          } else continue;
        } else {
          if (t.terrain === 'mountain' && !hasTech(s, f, 'mountainTraining') && !has(u, 'walker')) continue;
          if ((t.terrain === 'forest' || t.terrain === 'mountain') && !t.road) stop = true;
          if (roadLike(fromTile) && roadLike(t) && (fromTile.road || t.road || isBridge(t) || isBridge(fromTile))) cost = 0.5;
        }
      }
      // aus dem Wasser an Land: ebenfalls Halt / out of the water onto land: stop as well
      if (has(u, 'wade') && !walkable(fromTile)) stop = true;
      // Lava, Vulkangipfel und Wunder-Grundflaechen sind unpassierbar / lava, volcano peaks and wonder footprints are impassable
      if (t.volcano || burning(s, t) || t.wonderOf) continue;
      // Dschungel: Fahrzeuge nur als ersten Schritt, jeder Schritt hinein oder heraus endet die Bewegung
      // jungle: vehicles only as the first step, every step in or out ends the move
      if (!fly && !ship) {
        if (isJungle(t)) {
          if (JUNGLE.vehicles.includes(u.type) && cur.cost > 0) continue;
          stop = true;
        }
        if (isJungle(fromTile)) stop = true;
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
  // Xeno-Boden schuetzt Alien-Einheiten / xeno ground protects alien units
  if (t.xeno && isAlien(def)) b = Math.max(b, XENO.groundDefense);
  // Wrack als Deckung: +1 fuer Landeinheiten / wreck as cover: +1 for land units
  if ((t.remains?.kind === 'wreck' || t.feature === 'crashSite' || t.feature === 'labRuin') && !isShip(def)) b += REMAINS.wreckDefenseBonus;
  // Dschungel: Hinterhalt nur fuer Fusstruppen (keine Fahrzeuge, Schiffe oder Bauwerke) / jungle: ambush cover for foot troops only (no vehicles, ships or structures)
  if (isJungle(t) && unitClass(def.type) === 'foot') b = Math.max(b, JUNGLE.footDefense);
  return b;
}

/**
 * Kampfvorschau. toDefender/toAttacker = Schaden bei vollem Treffer; expected = Erwartungswert mit Trefferglueck;
 * killChance = Wahrscheinlichkeit, das Ziel zu vernichten; odds = Wahrscheinlichkeiten der Trefferarten des Angreifers.
 * Combat preview. toDefender/toAttacker = damage on a full hit; expected = expected value with hit luck;
 * killChance = chance to destroy the target; odds = attacker's hit-kind odds.
 */
export interface CombatPreview {
  toDefender: number; toAttacker: number; kills: boolean; retaliates: boolean;
  expected: number; expectedRet: number; killChance: number; min: number; max: number; odds: Record<HitKind, number>;
  /** Gegenschlag bei vollem Treffer, falls das Ziel ueberlebt / return fire on a full hit if the target survives */
  retFull: number;
}

/** Deckungsfaktor gegen Fernangriffe (1 = keine) / cover factor against ranged attacks (1 = none) */
export function rangedCover(s: GameState, att: Unit, def: Unit): number {
  if (dist(att, def) < 2) return 1;
  const cls = unitClass(def.type);
  if (cls !== 'foot' && cls !== 'vehicle') return 1;
  const t = tileAt(s, def.x, def.y)!;
  return t.terrain === 'forest' || t.cityId !== null ? RANGED_COVER.factor : 1;
}

/** Verbleibende Raketen / rockets left */
export const rocketsLeft = (u: Unit) => (ROCKETS.units.includes(u.type) ? u.rockets ?? ROCKETS.max : 0);

/** Ziele fuer Raketen: sichtbare Feinde genau zwei Felder entfernt / rocket targets: visible enemies exactly two tiles away */
export function rocketTargets(s: GameState, u: Unit): Unit[] {
  if (rocketsLeft(u) <= 0 || !canAttackNow(u) || submerged(s, u)) return [];
  return s.units.filter((o) => o.owner !== u.owner && isHostile(s, u.owner, o.owner) && dist(u, o) === ROCKETS.range && canSeeUnit(s, u.owner, o));
}

/**
 * Trefferglueck aktiv? Nur wenn ausdruecklich an: neue Spiele setzen das Feld (createGame), alte Spielstaende ohne Feld sind aus
 * (save.ts migrateState). Hit luck active? Only when explicitly on: new games set the field (createGame), old saves without it are off.
 */
export const hitChanceOn = (s: GameState) => s.config.hitChance === true;

/**
 * Rasse einer Einheit fuer die Treffsicherheit: Fraktionseinheiten nach Bauart, allgemeine Schiffe nach der Fraktion ihres Besitzers.
 * Race of a unit for accuracy: faction units by type, common ships by their owner's faction.
 */
export function hitRace(type: UnitTypeId, owner?: FactionId): HitRace {
  const st = UNITS[type];
  const f = st.faction ?? (st.ship ? owner : undefined);
  return (f && HIT.race[f]) || 'human';
}
/** Rasse einer konkreten Einheit (Schiffe: Besitzer) / race of a concrete unit (ships: owner) */
export const unitRace = (s: GameState, u: Unit): HitRace => hitRace(u.type, s.factions[u.owner]?.id);

/**
 * Wahrscheinlichkeiten der Trefferarten fuer einen Angreifer bei aktuellem Wetter; ranged = Fernangriff (z. B. Mech-Raketen).
 * Hit-kind odds for an attacker in the current weather; ranged = ranged attack (e.g. mech rockets).
 */
export function hitOdds(s: GameState, u: Unit, ranged = false): Record<HitKind, number> {
  if (!hitChanceOn(s)) return { miss: 0, graze: 0, partial: 0, full: 1, crit: 0 };
  const race = unitRace(s, u);
  const base = HIT.odds[race];
  const w = weather(s);
  // Wind trifft nur Fernkaempfer, Fernangriffe und Flieger / wind only affects ranged units, ranged attacks and fliers
  const windOk = w !== 'wind' || ranged || UNITS[u.type].range >= 2 || has(u, 'fly');
  let f = windOk ? HIT.weatherFactor[race] : 0;
  if (race === 'alien' && w === 'snow') f *= HIT.alienSnowFactor;
  const shift = HIT.weather[w];
  const out = {} as Record<HitKind, number>;
  let sum = 0;
  const hpShare = u.hp / Math.max(1, u.maxHp);
  // Roboter: je beschaedigter, desto ungenauer (0 bei vollen LP, 1 bei 20 % LP) / robots: less accurate the more damaged
  const worn = race === 'robot' ? Math.min(1, Math.max(0, (1 - hpShare) / (1 - HIT.robotDamagedAt))) : 0;
  for (const k of HIT_KINDS) {
    out[k] = Math.max(0, base[k] + (shift[k] ?? 0) * f + (HIT.robotDamaged[k] ?? 0) * worn);
    sum += out[k];
  }
  for (const k of HIT_KINDS) out[k] /= sum || 1;
  // Fanatiker in Lebensgefahr: 50 % mehr kritische Treffer, auf Kosten voller Treffer / fanatics near death: 50 % more crits, taken from full hits
  if (race === 'cult' && hpShare < HIT.cultFrenzyHp) {
    const extra = Math.min(out.full, out.crit * HIT.cultFrenzyCrit);
    out.crit += extra; out.full -= extra;
  }
  return out;
}

/** Rasender Fanatiker (unter 20 % LP)? race = Rasse der Einheit / frenzied fanatic (below 20 % HP)? race = the unit's race */
export const cultFrenzy = (u: Unit, race: HitRace = hitRace(u.type)) => race === 'cult' && u.hp / Math.max(1, u.maxHp) < HIT.cultFrenzyHp;

/** Kann die Einheit sich geordnet zurueckziehen (menschliche Bodentruppen)? / can the unit retreat in order (human ground troops)? */
export function canOrderlyRetreat(u: Unit): boolean {
  const st = UNITS[u.type];
  return hitRace(u.type) === 'human' && !st.ship && !has(u, 'fly') && st.attack > 0 && !has(u, 'wonder');
}

/** Feld fuer den Rueckzug: ein Schritt weg vom Ziel, sonst null / tile for the retreat: one step away from the target, else null */
export function retreatTile(s: GameState, u: Unit, target: Unit): Pos | null {
  const d0 = dist(u, target);
  let best: Pos | null = null, bestScore = -Infinity;
  for (const r of reachable(s, u, true)) {
    if (r.path.length !== 1 || r.embark || r.disembark) continue;
    const t = tileAt(s, r.x, r.y)!;
    if (!walkable(t)) continue;
    const d = dist(r, target);
    if (d <= d0) continue;
    // weiter weg, eigenes Gebiet und Deckung bevorzugt / further away, own territory and cover preferred
    const score = d * 10 + (territoryOwner(s, t) === u.owner ? 3 : 0) + (t.terrain === 'forest' || t.terrain === 'mountain' ? 2 : 0) - idx(s.size, r.x, r.y) * 1e-6;
    if (score > bestScore) { bestScore = score; best = { x: r.x, y: r.y }; }
  }
  return best;
}

/** Schaden beim Rueckzug (20 % des vollen Treffers, mindestens 1) / damage of a retreat (20 % of a full hit, at least 1) */
export function retreatDamage(s: GameState, u: Unit, target: Unit): number {
  const full = combatPreview(s, u, target).toDefender;
  return full > 0 ? Math.max(1, Math.round(full * RETREAT.damage)) : 0;
}

/**
 * Pruefung des geordneten Rueckzugs. Er ist ein Angriff samt Schritt: nur, solange die Einheit noch angreifen kann
 * (nicht nach einem Angriff) und ihre Bewegung nicht beendet wurde (z. B. durch eine Mine).
 * Check of the orderly retreat. It is an attack plus a step: only while the unit can still attack
 * (not after an attack) and its movement has not been ended (e.g. by a mine).
 */
export function retreatCheck(s: GameState, u: Unit, target: Unit): 'ok' | 'cannotRetreat' | 'retreatCooldown' | 'unitExhausted' | 'outOfRange' | 'noRetreatTile' {
  if (!canOrderlyRetreat(u)) return 'cannotRetreat';
  if ((u.retreatReady ?? 0) > s.round) return 'retreatCooldown';
  if (!canAttackNow(u) || u.moveDone) return 'unitExhausted';
  if (!attackTargets(s, u).some((o) => o.id === target.id)) return 'outOfRange';
  if (!retreatTile(s, u, target)) return 'noRetreatTile';
  return 'ok';
}

/** Schaden nach Trefferart (gerundet) / damage by hit kind (rounded) */
export const hitDamage = (base: number, k: HitKind) => Math.round(base * HIT.mult[k]);

/** Trefferart aus einer Zufallszahl 0..1 / hit kind from a random number 0..1 */
export function rollHit(odds: Record<HitKind, number>, r: number): HitKind {
  let acc = 0;
  for (const k of HIT_KINDS) { acc += odds[k]; if (r < acc) return k; }
  return 'full';
}

/** Deckung des Ziels gegen diesen Angreifer (Todesstrahl und Brand ignorieren sie) / the target's cover against this attacker (death ray and burn ignore it) */
function coverBonus(s: GameState, att: Unit, def: Unit): number {
  if (has(att, 'deathRay') || has(att, 'burn')) return DEFENSE_BONUS.open;
  // Deckung gegen Fernangriffe: Panzer und Truppen in Wald oder Stadt / cover against ranged attacks: tanks and troops in forest or city
  return defenseBonus(s, def, att) * rangedCover(s, att, def);
}

/** Kann das Ziel ueberhaupt zurueckschlagen? / can the target strike back at all? */
function canReturnFire(s: GameState, att: Unit, def: Unit): boolean {
  // Sturmangriff (shock): das Ziel schlaegt nicht zurueck / shock assault: the target does not strike back
  return !has(att, 'shock') && !has(def, 'noRetaliate') && !submerged(s, def) && UNITS[def.type].range > 0 && dist(att, def) <= effectiveRange(s, def);
}

/**
 * Gegenschlag (voller Treffer) eines Verteidigers, der nach dem Angriff noch defHp LP hat: seine Kraft sinkt mit den
 * verbleibenden LP. 0, wenn er vernichtet ist oder nicht zurueckschlagen kann.
 * Return fire (full hit) of a defender left with defHp HP after the attack: its force scales with the remaining HP.
 * 0 if it is destroyed or cannot strike back.
 */
export function returnFire(s: GameState, att: Unit, def: Unit, defHp: number): number {
  if (defHp <= 0 || !canReturnFire(s, att, def)) return 0;
  const defense = effectiveDefense(s, def);
  const attackForce = effectiveAttack(s, att) * (att.hp / att.maxHp);
  const defenseForce = defense * (defHp / def.maxHp) * coverBonus(s, att, def);
  const total = attackForce + defenseForce;
  return total > 0 ? Math.round((defenseForce / total) * defense * COMBAT.damageFactor * counterFactor(def.type, att.type)) : 0;
}

/** Kampfvorschau; rocket = Mech-Raketen (Fernangriff fuer den Wind) / combat preview; rocket = mech rockets (ranged for the wind) */
export function combatPreview(s: GameState, att: Unit, def: Unit, rocket = false): CombatPreview {
  const bonus = coverBonus(s, att, def);
  const defense = effectiveDefense(s, def);
  const atk = effectiveAttack(s, att);
  const attackForce = atk * (att.hp / att.maxHp);
  const defenseForce = defense * (def.hp / def.maxHp) * bonus;
  const total = attackForce + defenseForce;
  // Konter-Faktor gegen die Zielklasse / counter factor against the target class
  const toDefender = total > 0 ? Math.round((attackForce / total) * atk * COMBAT.damageFactor * counterFactor(att.type, def.type)) : 0;
  const kills = toDefender >= def.hp;
  // Gegenschlag mit den LP nach dem vollen Treffer / return fire with the HP left after a full hit
  const retFull = kills ? 0 : returnFire(s, att, def, def.hp - toDefender);
  const retaliates = !kills && canReturnFire(s, att, def);
  const toAttacker = retaliates ? retFull : 0;
  // Trefferglueck: Erwartungswert, Spanne und Vernichtungschance; Gegenschlag je Trefferart mit den LP danach
  // hit luck: expected value, range and kill chance; return fire per hit kind with the HP left afterwards
  const odds = hitOdds(s, att, rocket || dist(att, def) >= 2);
  let expected = 0, killChance = 0, expectedRet = 0, min = Infinity, max = 0;
  for (const k of HIT_KINDS) {
    if (odds[k] <= 0) continue;
    const dmg = hitDamage(toDefender, k);
    expected += odds[k] * dmg;
    min = Math.min(min, dmg); max = Math.max(max, dmg);
    if (dmg >= def.hp) { killChance += odds[k]; continue; }
    const rb = returnFire(s, att, def, def.hp - dmg);
    if (rb <= 0) continue;
    const defOdds = hitOdds(s, { ...def, hp: def.hp - dmg });
    expectedRet += odds[k] * HIT_KINDS.reduce((a, j) => a + defOdds[j] * hitDamage(rb, j), 0);
  }
  return { toDefender, toAttacker, kills, retaliates, expected, expectedRet, killChance, min: min === Infinity ? 0 : min, max, odds, retFull };
}

/** Angriffswert inkl. Veteranenbonus (Dravon, kampferprobt) / attack value incl. veteran bonus (Dravon, battle-hardened) */
export function effectiveAttack(s: GameState, u: Unit): number {
  const a = UNITS[u.type].attack;
  return u.veteran && a > 0 && perk2Of(s, u.owner) === 'battleHardened' ? a + PERKS2.battleHardenedAttack : a;
}

/** Watende Einheit unter Wasser: greift nicht an, schlaegt nicht zurueck / wading unit under water: no attack, no retaliation */
export function submerged(s: GameState, u: Unit): boolean {
  if (!has(u, 'wade')) return false;
  return !walkable(tileAt(s, u.x, u.y)!);
}

export function attackTargets(s: GameState, u: Unit): Unit[] {
  if (!canAttackNow(u) || submerged(s, u)) return [];
  const r = effectiveRange(s, u);
  return s.units.filter((o) =>
    o.owner !== u.owner && isHostile(s, u.owner, o.owner) && dist(u, o) <= r && canSeeUnit(s, u.owner, o));
}

export function convertTargets(s: GameState, u: Unit): Unit[] {
  if (!has(u, 'convert') || !canActStill(u)) return [];
  // Wunder lassen sich nicht bekehren / wonders cannot be converted
  return s.units.filter((o) => o.owner !== u.owner && isHostile(s, u.owner, o.owner) && dist(u, o) === 1 && canSeeUnit(s, u.owner, o) && !isWonder(o));
}

/** Ausserirdische heilen nur auf Xeno-Boden (terraformt) / aliens heal only on xeno (terraformed) ground */
export const alienHealBlocked = (s: GameState, u: Unit) => isAlien(u) && !tileAt(s, u.x, u.y)!.xeno;

export function healAmount(s: GameState, u: Unit): number {
  if (alienHealBlocked(s, u)) return 0;
  const t = tileAt(s, u.x, u.y)!;
  const own = territoryOwner(s, t) === u.owner || (t.outpost !== null && t.outpost.owner === u.owner);
  let h = own ? HEALING.ownTerritory : HEALING.elsewhere;
  if (t.xeno && isAlien(u)) h += XENO.groundHeal;
  // Lazarett auf oder neben der Stadt / hospital on or next to the city
  if (s.cities.some((c) => c.owner === u.owner && dist(c, u) <= 1 && (c.upgrades ?? []).includes('hospital'))) h += CITY_UPGRADES.hospitalHeal;
  // Zweite Merkmale: Feldlazarette (Alvenia), Waldbrut im Wald (Zyrr) / second traits: field hospitals, forest spawn in forests
  const p2 = perk2Of(s, u.owner);
  if (p2 === 'fieldHospitals') h += PERKS2.fieldHospitalsHeal;
  if (p2 === 'forestSpawn' && t.terrain === 'forest') h += PERKS2.forestSpawnHeal;
  return h;
}

/** Wrack fuer die Notreparatur: eigenes Feld zuerst, dann Nachbarn / wreck for the emergency repair: own tile first, then neighbours */
export function repairWreck(s: GameState, u: Unit): Pos | null {
  for (const p of [{ x: u.x, y: u.y }, ...neighbors(s.size, u.x, u.y)]) {
    if (tileAt(s, p.x, p.y)!.remains?.kind === 'wreck') return p;
  }
  return null;
}

/** Heilung der Notreparatur (50 % mehr als normal) / healing of the emergency repair (50 % more than normal) */
export const repairAmount = (s: GameState, u: Unit) => Math.min(Math.round(healAmount(s, u) * REPAIR.factor), u.maxHp - u.hp);

/** Pruefung der Notreparatur (nur Roboter) / check of the emergency repair (robots only) */
export function repairCheck(s: GameState, u: Unit): 'ok' | 'cannotRepair' | 'unitExhausted' | 'noWreck' {
  // Wunder-Bauwerke lassen sich nicht reparieren / wonder structures cannot be repaired
  if (hitRace(u.type) !== 'robot' || UNITS[u.type].ship || isWonderStructure(u)) return 'cannotRepair';
  if (!canHeal(u)) return 'unitExhausted';
  if (!repairWreck(s, u)) return 'noWreck';
  return 'ok';
}

/** Kann die Einheit sich jetzt heilen? Wunder-Bauwerke nie / can the unit heal now? wonder structures never */
export function canHeal(u: Unit): boolean {
  return !u.fresh && !u.exhausted && !u.moved && !u.attacked && u.hp < u.maxHp && !isWonderStructure(u);
}
/** Kann ein Sanitaeter diese Einheit heilen? Nicht Bauwerke, nicht Ausserirdische abseits von Xeno-Boden / can a medic heal this unit? */
export const medicCanHeal = (s: GameState, o: Unit) => o.hp < o.maxHp && !isWonderStructure(o) && !alienHealBlocked(s, o);

export function veteranKills(s: GameState, u: Unit): number {
  return FACTIONS[s.factions[u.owner].id].perk === 'drill' ? VETERAN.killsDravon : VETERAN.kills;
}

// ---------- Einnahme / capture ----------

export type CaptureKind = 'village' | 'city' | 'outpost';
export function captureKind(s: GameState, u: Unit): CaptureKind | null {
  if (u.fresh || u.exhausted || u.moved || u.attacked) return null;
  if (u.x !== u.startX || u.y !== u.startY) return null;
  if (isShip(u) || has(u, 'fly') || has(u, 'uprising') || has(u, 'wonder')) return null;
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
  let fuel = u.fuel - fuelBurn(s);
  if (fuel <= 0) return false;
  // Rueckflug mit dem vorhersagbaren Wetter der naechsten Runden (Regen bremst, Wind verbraucht mehr Sprit)
  // return flight with the predictable weather of the next rounds (rain slows, wind burns more fuel)
  const wx = (r: number): WeatherId => (s.config.weather === false ? 'clear' : weatherFor(s.config.seed, r));
  let range = 0;
  for (let i = 1; i <= 12 && fuel > 0; i++) {
    const w = wx(s.round + i);
    let mv = UNITS[u.type].move;
    if (w === 'rain' && WEATHER.rain.moveUnits.includes(u.type)) mv = Math.max(1, mv + WEATHER.rain.moveDelta);
    range += mv;
    for (let yy = Math.max(0, y - range); yy <= Math.min(s.size - 1, y + range); yy++) {
      for (let xx = Math.max(0, x - range); xx <= Math.min(s.size - 1, x + range); xx++) {
        if (isRefuelSpot(s, u.owner, xx, yy)) return true;
      }
    }
    fuel -= w === 'wind' ? WEATHER.wind.fuelBurn : 1;
  }
  return false;
}

export function heliWillCrash(s: GameState, u: Unit): boolean {
  return u.fuel !== null && u.fuel <= fuelBurn(s) && !isRefuelSpot(s, u.owner, u.x, u.y);
}

export const MAX_FUEL = FUEL.tank;

// ---------- Bauen / building ----------

export type BuildCheck = { ok: true; cost: number } | { ok: false; error: 'techMissing' | 'invalidTile' | 'notInTerritory' | 'onePerCity' | 'notEnoughStars' | 'alreadyBuilt' | 'wrongFaction'; cost: number };

export function buildCheck(s: GameState, f: number, b: BuildingId, x: number, y: number): BuildCheck {
  const st = BUILDINGS[b];
  const cost = st.cost;
  if (!inBounds(s.size, x, y)) return { ok: false, error: 'invalidTile', cost };
  const t = tileAt(s, x, y)!;
  if (territoryOwner(s, t) !== f) return { ok: false, error: 'notInTerritory', cost };
  // Fraktionsgebaeude nur fuer ihre Fraktion / faction buildings only for their faction
  const own = FACTION_BUILDINGS[b];
  if (own && own !== s.factions[f].id) return { ok: false, error: 'wrongFaction', cost };
  // Zyrr bauen nur Xeno-Gebaeude auf Xeno-Boden, alle anderen nie / Zyrr build only xeno buildings on xeno ground
  const xenoB = b === 'xenoHive' || b === 'xenoHarvester';
  if (xenoB !== isAlienFaction(s, f)) return { ok: false, error: 'techMissing', cost };
  if (xenoB) {
    if (!t.xeno) return { ok: false, error: 'invalidTile', cost };
    if (t.cityId !== null || t.building || t.feature || t.grandProject || t.outpost || !st.terrain.includes(t.terrain)) return { ok: false, error: 'invalidTile', cost };
    if ((b === 'xenoHarvester') !== !!t.resource) return { ok: false, error: 'invalidTile', cost };
    if (s.factions[f].stars < cost) return { ok: false, error: 'notEnoughStars', cost };
    return { ok: true, cost };
  }
  if (b === 'researchCenter') {
    const terr = t.terrain === 'ocean' ? null : (t.terrain as 'plain' | 'forest' | 'mountain' | 'shallow');
    if (!terr || !hasTech(s, f, RESEARCH_CENTER_TECH[terr])) return { ok: false, error: 'techMissing', cost };
  } else if (st.tech && !hasTech(s, f, st.tech)) return { ok: false, error: 'techMissing', cost };
  if (t.cityId !== null || t.feature !== null || t.grandProject || t.outpost || t.wonderOf) return { ok: false, error: 'invalidTile', cost };
  if (!st.terrain.includes(t.terrain)) return { ok: false, error: 'invalidTile', cost };
  if (b === 'road') {
    if (t.road) return { ok: false, error: 'alreadyBuilt', cost };
    if (t.building && t.building !== 'researchCenter' && !isLand(t)) return { ok: false, error: 'invalidTile', cost };
  } else {
    if (t.building) return { ok: false, error: 'alreadyBuilt', cost };
    if (st.resource && t.resource !== st.resource) return { ok: false, error: 'invalidTile', cost };
    if (!st.resource && t.resource && b !== 'bridge' && b !== 'powerPlant') return { ok: false, error: 'invalidTile', cost };
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
  if (st.onePerFaction && countBuildings(s, f, b) > 0) return { ok: false, error: 'alreadyBuilt', cost };
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
  return !(t.cityId !== null || t.building || t.road || t.feature || t.grandProject || t.outpost || t.resource || t.wonderOf);
}

export function grandProjectConditionMet(s: GameState, f: number, id: GrandProjectId): boolean {
  const fa = s.factions[f];
  switch (id) {
    case 'peaceMonument': return s.round - Math.max(0, fa.lastAttackRound) >= GRAND_PROJECTS.peaceRounds;
    case 'stateBank': return fa.stars >= GRAND_PROJECTS.bankStars;
    case 'victoryColumn': return fa.kills >= GRAND_PROJECTS.kills;
    case 'worldTradeCenter': return ownCities(s, f).filter((c) => c.connected && !(c.isHQ && c.hqOf === f)).length >= GRAND_PROJECTS.connectedCities;
    case 'governmentPalace': return ownCities(s, f).some((c) => c.level >= GRAND_PROJECTS.palaceLevel);
    // nur allgemeine Technologien (ohne Siegtechnologien) / common techs only (without victory techs)
    case 'academy': return TECH_IDS.every((t) => fa.techs.includes(t));
    case 'satelliteCenter': return fa.radarsFound.length >= s.radars.length;
  }
}
export { GRAND_PROJECT_IDS };

export function outpostCheck(s: GameState, u: Unit): 'ok' | 'techMissing' | 'invalidTile' | 'enemyTerritory' | 'notEnoughStars' | 'cannotCapture' {
  if (!INFANTRY_TYPES.includes(u.type)) return 'cannotCapture';
  if (u.fresh || u.exhausted || u.attacked) return 'cannotCapture';
  if (!hasTech(s, u.owner, 'fortification')) return 'techMissing';
  const t = tileAt(s, u.x, u.y)!;
  if (!['plain', 'forest', 'mountain'].includes(t.terrain)) return 'invalidTile';
  if (t.cityId !== null || t.outpost || t.building || t.feature || t.grandProject) return 'invalidTile';
  // nur auf eigenem oder neutralem Gebiet / only on own or neutral territory
  const owner = territoryOwner(s, t);
  if (owner !== null && owner !== u.owner) return 'enemyTerritory';
  if (s.factions[u.owner].stars < outpostCost(s, u.owner)) return 'notEnoughStars';
  return 'ok';
}

/** Aussenposten-Preis (Korvat, Erdwaelle: billiger) / outpost price (Korvat, earthworks: cheaper) */
export function outpostCost(s: GameState, f: number): number {
  return perk2Of(s, f) === 'earthworks' ? PERKS2.earthworksOutpostCost : ECON.outpostCost;
}

/** Panzersperren-Preis (Velkar, Ingenieurkorps: billiger) / tank barrier price (Velkar, engineer corps: cheaper) */
export function barrierCost(s: GameState, f: number): number {
  return perk2Of(s, f) === 'engineerCorps' ? PERKS2.engineerCorpsBarrierCost : BARRIER.cost;
}

export function trainCheck(s: GameState, c: City, type: UnitTypeId):
  'ok' | 'techMissing' | 'notEnoughStars' | 'occupied' | 'unitLimit' | 'invalid' | 'cultRecruit' | 'computeMissing' | 'alreadyBuilt' {
  if (c.owner === null) return 'invalid';
  const st = UNITS[type];
  if (st.ship || st.cost === null) return 'invalid';
  // Fraktionseinheiten / faction units
  const alien = isAlienFaction(s, c.owner);
  const roster = ROSTERS[s.factions[c.owner].id];
  if ((st.faction && st.faction !== s.factions[c.owner].id) || (roster && !st.faction)) return 'invalid';
  // Erdkernbohrer: in der Stadt, auch beim Kult; nur einer zugleich; ohne Stadtlimit
  // earth-core drill: in a city, also for the cult; only one at a time; no city limit
  if (st.abilities.includes('wonder')) {
    if (!factionVictoryOn(s)) return 'invalid';
    if (st.tech && !hasTech(s, c.owner, st.tech)) return 'techMissing';
    if (s.units.filter((u) => u.owner === c.owner && u.type === type).length >= WONDERS.drillMax) return 'alreadyBuilt';
    if (unitAt(s, c.x, c.y)) return 'occupied';
    if (s.factions[c.owner].stars < unitCost(s, c.owner, type)!) return 'notEnoughStars';
    return 'ok';
  }
  // Kult rekrutiert nicht in Staedten / the cult does not recruit in cities
  if (isCultFaction(s, c.owner)) return 'cultRecruit';
  if (st.compute !== undefined && computePower(s, c.owner) < st.compute) return 'computeMissing';
  if (alien && !tileAt(s, c.x, c.y)!.xeno) return 'invalid';
  if (st.tech && !hasTech(s, c.owner, st.tech)) return 'techMissing';
  if (unitAt(s, c.x, c.y)) return 'occupied';
  if (supportedUnits(s, c) >= unitLimit(s, c)) return 'unitLimit';
  if (s.factions[c.owner].stars < unitCost(s, c.owner, type)!) return 'notEnoughStars';
  return 'ok';
}

export function upgradeCheck(s: GameState, u: Unit, to: UnitTypeId): 'ok' | 'techMissing' | 'notEnoughStars' | 'invalid' | 'notInTerritory' {
  if (!isShip(u) || !UNITS[to].ship || to === u.type || to === 'landingBoat') return 'invalid';
  if (u.fresh) return 'invalid';
  // Fraktionsschiffe (Kaperschiff) nur fuer ihre Fraktion / faction ships (privateer) only for their faction
  if (UNITS[to].faction && UNITS[to].faction !== s.factions[u.owner].id) return 'invalid';
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
  const v = Math.max(UNITS[u.type].vision, t.terrain === 'mountain' ? VISION.mountain : VISION.unit);
  // NEXUS, Sensornetz / sensor net
  return perk2Of(s, u.owner) === 'sensorNet' ? v + PERKS2.sensorNetVision : v;
}

export function contactStars(s: GameState, g: number): number {
  const pts = score(s, g);
  return Math.min(ECON.firstContactMax, Math.max(1, Math.ceil(pts / 1000)) * ECON.firstContactPer1000);
}

export function techUnlocks(tech: TechId, faction?: FactionId): { units: UnitTypeId[]; buildings: BuildingId[] } {
  // Siegtechnologie: ihr Wunder / victory tech: its wonder
  if (TECHS[tech].faction) {
    const w = WONDERS.ofFaction[TECHS[tech].faction!];
    return { units: w ? [w] : [], buildings: [] };
  }
  // Menschen sehen Menschen-Einheiten, Sonderfraktionen ihre eigenen / humans see human units, special factions their own
  // klassische Fraktionen sehen zusaetzlich ihre einzigartige Einheit / classic factions also see their unique unit
  const roster = faction ? ROSTERS[faction] : undefined;
  const units = (Object.keys(UNITS) as UnitTypeId[]).filter((k) => UNITS[k].tech === tech &&
    (roster ? UNITS[k].faction === faction || (UNITS[k].ship && !UNITS[k].faction) : !UNITS[k].faction || UNITS[k].faction === faction));
  const buildings = (Object.keys(BUILDINGS) as BuildingId[]).filter((k) => BUILDINGS[k].tech === tech && (!FACTION_BUILDINGS[k] || FACTION_BUILDINGS[k] === faction));
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
  if (!BARRIER.terrain.includes(t.terrain) || t.cityId !== null || t.barrier || t.outpost || t.feature || t.wonderOf) return 'invalidTile';
  if (unitAt(s, x, y)) return 'occupied';
  if (s.factions[u.owner].stars < barrierCost(s, u.owner)) return 'notEnoughStars';
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
  // unbewaffneter Waal: keine Reichweite, kein Gegenschlag / unarmed Waal: no range, no return fire
  if (u.type === 'waal' && !waalArmed(u)) return 0;
  const base = UNITS[u.type].range;
  if (base > 0 && weather(s) === 'rain' && WEATHER.rain.rangeUnits.includes(u.type)) return Math.max(1, base + WEATHER.rain.rangeDelta);
  return base;
}

/** Bewegung inkl. Wetter und Panzersperre / movement including weather and tank barrier */
export function effectiveMove(s: GameState, u: Unit): number {
  let m = UNITS[u.type].move;
  if (weather(s) === 'rain' && WEATHER.rain.moveUnits.includes(u.type)) m = Math.max(1, m + WEATHER.rain.moveDelta);
  if (weather(s) === 'snow' && WEATHER.snow.moveUnits.includes(u.type)) m = Math.max(1, m + WEATHER.snow.moveDelta);
  // Meridon, Lotsenwesen: Landungsboote weiter / harbour pilots: landing boats further
  if (u.type === 'landingBoat' && perk2Of(s, u.owner) === 'harbourPilots') m += PERKS2.harbourPilotsMove;
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

export type CityUpgradeCheck = 'ok' | 'notYourCity' | 'alreadyBuilt' | 'noSlot' | 'notEnoughStars' | 'invalidTarget' | 'techMissing' | 'cityLevel';

export function cityUpgradeCheck(s: GameState, f: number, c: City, up: CityUpgradeId, target?: Pos): CityUpgradeCheck {
  if (c.owner !== f) return 'notYourCity';
  const ups = cityUpgrades(c);
  if (ups.includes(up)) return 'alreadyBuilt';
  if (ups.length >= CITY_UPGRADES.slots) return 'noSlot';
  const need = cityUpgradeRequirement(s, f, up);
  if (need.tech && !hasTech(s, f, need.tech)) return 'techMissing';
  if (need.level && c.level < need.level) return 'cityLevel';
  if (s.factions[f].stars < CITY_UPGRADES.cost[up]) return 'notEnoughStars';
  if (up === 'radioTower' && target && !radioTargetOk(s, c, target)) return 'invalidTarget';
  return 'ok';
}

/** Voraussetzung eines Ausbaus: Technologie oder (ohne Forschung) Stadtstufe / requirement: tech or (without research) city level */
export function cityUpgradeRequirement(s: GameState, f: number, up: CityUpgradeId): { tech?: TechId; level?: number } {
  const tech = CITY_UPGRADES.tech[up];
  if (ROSTERS[s.factions[f].id]?.research === false && !hasTech(s, f, tech)) return { level: TECHS[tech].tier + 1 };
  return { tech };
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

// ---------- Ausserirdische / aliens ----------

export const isAlienFaction = (s: GameState, f: number) => s.factions[f]?.id === XENO.faction;
export const isAlien = (u: Unit) => UNITS[u.type].faction === XENO.faction;

export type TerraformCheck = 'ok' | 'wrongFaction' | 'invalidTile' | 'alreadyBuilt' | 'notInTerritory' | 'notEnoughStars' | 'unitExhausted' | 'outOfRange';

/** Terraformen: per Sterne im eigenen Gebiet oder per Terraformer auf/neben sich / by stars in own territory or by a terraformer on/next to itself */
export function terraformCheck(s: GameState, f: number, x: number, y: number, unitId?: number): TerraformCheck {
  if (!isAlienFaction(s, f)) return 'wrongFaction';
  if (!inBounds(s.size, x, y)) return 'invalidTile';
  const t = tileAt(s, x, y)!;
  if (t.terrain === 'ocean') return 'invalidTile';
  if (t.xeno) return 'alreadyBuilt';
  if (unitId !== undefined) {
    const u = s.units.find((o) => o.id === unitId);
    if (!u || u.owner !== f || !has(u, 'terraform')) return 'wrongFaction';
    if (u.fresh || u.exhausted || u.attacked) return 'unitExhausted';
    if (dist(u, { x, y }) > 1) return 'outOfRange';
    return 'ok';
  }
  if (territoryOwner(s, t) !== f) return 'notInTerritory';
  if (s.factions[f].stars < XENO.terraformCost) return 'notEnoughStars';
  return 'ok';
}

export function terraformTargets(s: GameState, u: Unit): Pos[] {
  return area(s.size, u.x, u.y, 1).filter((p) => terraformCheck(s, u.owner, p.x, p.y, u.id) === 'ok');
}

/** Fraktionsgebaeude / faction buildings */
export const FACTION_BUILDINGS: Partial<Record<BuildingId, string>> = {
  xenoHive: XENO.faction, xenoHarvester: XENO.faction, shrine: CULT.faction, dataCenter: NEXUS.faction, powerPlant: NEXUS.faction,
  ...Object.fromEntries(Object.entries(UNIQUE.buildings).map(([f, b]) => [b, f])),
};
export const isCultFaction = (s: GameState, f: number) => s.factions[f]?.id === CULT.faction;
export const isRobotFaction = (s: GameState, f: number) => s.factions[f]?.id === NEXUS.faction;
/** Forscht diese Fraktion? / does this faction research? */
export const canResearch = (s: GameState, f: number) => ROSTERS[s.factions[f].id]?.research !== false;
/** Kaufbare Landeinheiten einer Fraktion / purchasable land units of a faction */
export function rosterUnits(s: GameState, f: number): UnitTypeId[] {
  const id = s.factions[f].id;
  const roster = ROSTERS[id]?.units;
  if (roster) return roster;
  // klassische Fraktionen: Grundliste plus einzigartige Landeinheit / classic factions: base list plus unique land unit
  const u = uniqueUnitOf(id);
  return u && !UNITS[u].ship ? [...LAND_UNITS, u] : LAND_UNITS;
}

/** Rechenzentren und Kraftwerke im eigenen Gebiet / data centers and power plants in own territory */
export function computeStats(s: GameState, f: number): { dataCenters: number; powerPlants: number; compute: number } {
  let dataCenters = 0, powerPlants = 0;
  for (const t of s.tiles) {
    if (t.building !== 'dataCenter' && t.building !== 'powerPlant') continue;
    if (territoryOwner(s, t) !== f) continue;
    if (t.building === 'dataCenter') dataCenters++; else powerPlants++;
  }
  return { dataCenters, powerPlants, compute: Math.min(dataCenters, powerPlants) };
}
export const computePower = (s: GameState, f: number) => computeStats(s, f).compute;

export type RecruitCheck = 'ok' | 'notPreacher' | 'unitExhausted' | 'outOfRange' | 'occupied' | 'invalidTile' | 'invalid' | 'techMissing' | 'unitLimit' | 'notEnoughStars';
/** Heimatstadt fuer Rekruten: naechste eigene Stadt / home city for recruits: nearest own city */
export function recruitHome(s: GameState, f: number, x: number, y: number): City | null {
  let best: City | null = null, bd = Infinity;
  for (const c of ownCities(s, f)) { const d = dist(c, { x, y }); if (d < bd) { bd = d; best = c; } }
  return best;
}
/** Kann der Prediger diese Einheit auf (x, y) rekrutieren? / can the preacher recruit this unit at (x, y)? */
export function recruitCheck(s: GameState, f: number, unitId: number, type: UnitTypeId, x: number, y: number): RecruitCheck {
  if (!isCultFaction(s, f)) return 'invalid';
  const u = s.units.find((o) => o.id === unitId);
  if (!u || u.owner !== f || !has(u, 'preach')) return 'notPreacher';
  if (u.fresh || u.exhausted || u.attacked) return 'unitExhausted';
  const st = UNITS[type];
  if (st.faction !== CULT.faction || st.ship || st.cost === null || st.abilities.includes('wonder')) return 'invalid';
  if (!inBounds(s.size, x, y) || dist(u, { x, y }) !== 1) return 'outOfRange';
  const t = tileAt(s, x, y)!;
  if (!isLand(t)) return 'invalidTile';
  if (t.terrain === 'mountain' && !hasTech(s, f, 'mountainTraining')) return 'invalidTile';
  if (unitAt(s, x, y) || t.wonderOf) return 'occupied';
  if (st.tech && !hasTech(s, f, st.tech)) return 'techMissing';
  const home = recruitHome(s, f, x, y);
  if (!home || supportedUnits(s, home) >= unitLimit(s, home)) return 'unitLimit';
  if (s.factions[f].stars < unitCost(s, f, type)!) return 'notEnoughStars';
  return 'ok';
}
/** Freies Nachbarfeld fuer eine Rekrutierung / free adjacent tile for a recruit */
export function recruitSpot(s: GameState, u: Unit, type: UnitTypeId): Pos | null {
  for (const p of neighbors(s.size, u.x, u.y)) if (recruitCheck(s, u.owner, u.id, type, p.x, p.y) === 'ok') return p;
  return null;
}

// ---------- Konter-Einheiten / counter units ----------

/** Klasse einer Einheit fuer Konter-Boni / class of a unit for counter bonuses */
export function unitClass(type: UnitTypeId): UnitClass {
  const st = UNITS[type];
  if (st.ship) return 'ship';
  if (st.abilities.includes('fly')) return 'air';
  if (isStructureType(type)) return 'structure';
  return COUNTER.vehicles.includes(type) ? 'vehicle' : 'foot';
}

/** Schadensfaktor des Angreifertyps gegen den Zieltyp (1 = neutral) / damage factor of the attacker type against the target type */
export function counterFactor(attacker: UnitTypeId, target: UnitTypeId): number {
  const bonus = UNITS[attacker].bonusVs;
  if (!bonus) return 1;
  const cls = unitClass(target);
  if (cls === 'ship') return 1;
  // Bauwerke nehmen Konter-Schaden wie Fahrzeuge / structures take counter damage like vehicles
  return bonus[cls === 'structure' ? COUNTER.structureAs : cls] ?? 1;
}

/** Sieht Fraktion f die Mine auf (x, y)? Besitzer immer, sonst nur mit eigener Einheit daneben / does faction f see the mine? */
export function canSeeMine(s: GameState, f: number, x: number, y: number): boolean {
  const m = tileAt(s, x, y)?.mine;
  if (!m) return false;
  if (m.owner === f) return true;
  return s.units.some((u) => u.owner === f && dist(u, { x, y }) <= 1);
}

/** Loest eine Mine fuer diese Einheit aus? Nur feindliche Minen und nur Bodeneinheiten / does a mine trigger for this unit? */
export function mineTriggers(s: GameState, u: Unit, x: number, y: number): boolean {
  const m = tileAt(s, x, y)?.mine;
  if (!m || m.owner === u.owner || !isHostile(s, u.owner, m.owner)) return false;
  return !has(u, 'fly') && !isShip(u);
}

export const mineCount = (s: GameState, f: number) => s.tiles.filter((t) => t.mine && t.mine.owner === f).length;

export type MineCheck = 'ok' | 'cannotCapture' | 'invalidTile' | 'notEnoughStars' | 'occupied' | 'outOfRange' | 'unitLimit';

/** Kann die Einheit eine Mine auf (x, y) legen? / can the unit lay a mine on (x, y)? */
export function mineCheck(s: GameState, u: Unit, x: number, y: number): MineCheck {
  if (!has(u, 'mines')) return 'cannotCapture';
  if (u.fresh || u.exhausted || u.attacked) return 'cannotCapture';
  if (!inBounds(s.size, x, y) || dist(u, { x, y }) !== 1) return 'outOfRange';
  const t = tileAt(s, x, y)!;
  if (!COUNTER.mine.terrain.includes(t.terrain) || t.cityId !== null || t.mine || t.outpost || t.feature || burning(s, t) || t.volcano || t.wonderOf) return 'invalidTile';
  if (unitAt(s, x, y)) return 'occupied';
  if (mineCount(s, u.owner) >= COUNTER.mine.maxPerFaction) return 'unitLimit';
  if (s.factions[u.owner].stars < COUNTER.mine.cost) return 'notEnoughStars';
  return 'ok';
}

export function mineTargets(s: GameState, u: Unit): Pos[] {
  return neighbors(s.size, u.x, u.y).filter((p) => mineCheck(s, u, p.x, p.y) === 'ok');
}

// ---------- Fraktions-Siegbedingungen / faction victory conditions ----------

/** Wunder-Einheit (Bauwerk oder Bohrer)? / wonder unit (structure or drill)? */
export function isWonder(u: Unit): boolean {
  return UNITS[u.type].abilities.includes('wonder');
}
/** Ist der Typ ein unbewegliches Wunder-Bauwerk (nicht der Bohrer)? / is the type an immobile wonder structure (not the drill)? */
export function isStructureType(type: UnitTypeId): boolean {
  return UNITS[type].abilities.includes('wonder') && type !== 'coreDrill';
}
/** Ist die Einheit ein unbewegliches Wunder-Bauwerk? / is the unit an immobile wonder structure? */
export function isWonderStructure(u: Unit): boolean {
  return isStructureType(u.type);
}
/**
 * Steht das Wunder-Bauwerk auf eigenem Boden (Ankerfeld im eigenen Gebiet, Relais auch auf eigenem Aussenposten)?
 * Sonst ruht sein Fortschritt. Der Bohrer und andere Einheiten: immer true.
 * Does the wonder structure stand on own ground (anchor tile in own territory, the relay also on an own outpost)?
 * Otherwise its progress pauses. The drill and other units: always true.
 */
export function wonderGroundOk(s: GameState, u: Unit): boolean {
  if (!isWonderStructure(u)) return true;
  const t = tileAt(s, u.x, u.y)!;
  return territoryOwner(s, t) === u.owner || (u.type === 'hackRelay' && t.outpost?.owner === u.owner);
}
/** Waal bewaffnet (erste Bauphase fertig)? / Waal armed (first build phase done)? */
export function waalArmed(u: Unit): boolean {
  return (u.wonder?.stage ?? 0) >= 1;
}
/**
 * Fraktions-Siegbedingungen aktiv? Nur wenn ausdruecklich an, Kampagnen immer aus. Neue Spiele setzen das Feld ausdruecklich,
 * alte Spielstaende ohne Feld werden beim Laden auf aus gesetzt (save.ts migrateState).
 * Faction victories active? Only when explicitly on, campaigns always off. New games set the field explicitly, old saves without it are set to off on
 * load (save.ts migrateState).
 */
export function factionVictoryOn(s: GameState): boolean {
  return s.config.factionVictory === true && !s.config.campaign;
}
/** Siegtechnologie der Fraktion / the faction's victory tech */
export const victoryTechOf = (s: GameState, f: number): TechId => VICTORY_TECH[s.factions[f].id];
/** Darf Fraktion f diese Technologie sehen? / may faction f see this tech? */
export function techVisible(s: GameState, f: number, tech: TechId): boolean {
  const own = TECHS[tech].faction;
  if (own) return own === s.factions[f].id && factionVictoryOn(s);
  return canResearch(s, f);
}
/** Darf Fraktion f diese Technologie erforschen (ohne Sterne/Vorgaenger)? / may faction f research this tech (ignoring stars/parent)? */
export function researchAllowed(s: GameState, f: number, tech: TechId): 'ok' | 'noResearch' | 'wrongFaction' | 'invalid' {
  const own = TECHS[tech].faction;
  if (own) {
    if (own !== s.factions[f].id) return 'wrongFaction';
    return factionVictoryOn(s) ? 'ok' : 'invalid';
  }
  return canResearch(s, f) ? 'ok' : 'noResearch';
}
/** Wunder der Fraktion (Bauwerk oder Bohrer), sonst null / the faction's wonder (structure or drill), otherwise null */
export const wonderKindOf = (s: GameState, f: number): WonderUnitId | null => WONDERS.ofFaction[s.factions[f].id] ?? null;
/** Lebende Wunder einer Fraktion / living wonders of a faction */
export const wondersOf = (s: GameState, f: number): Unit[] => s.units.filter((u) => u.owner === f && isWonder(u));
/** Phasenlaengen eines Wunders (Bohrer: eine Phase) / phase lengths of a wonder (drill: one phase) */
export function wonderPhases(type: WonderUnitId): number[] {
  return type === 'coreDrill' ? [WONDERS.drillRounds] : WONDERS.phases[type];
}

/** Grundflaeche eines Wunders ab dem Ankerfeld (Kraftwerk 2x2) / footprint of a wonder from its anchor (power plant 2x2) */
export function wonderFootprint(kind: WonderKind, x: number, y: number): Pos[] {
  return kind === 'fusionPlant' ? [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }] : [{ x, y }];
}

export type WonderCheck = 'ok' | 'invalid' | 'wrongFaction' | 'techMissing' | 'alreadyBuilt' | 'invalidTile' | 'notInTerritory' | 'occupied' | 'notEnoughStars';

/**
 * Kann Fraktion f das Wunder auf (x, y) bauen? Portal und Waal: freies Land im eigenen Gebiet; Relais: Berg im eigenen Gebiet
 * oder mit eigenem Aussenposten; Kraftwerk: 2x2 freies Land (auch Berge) im eigenen Gebiet (Anker + rechts, unten, diagonal).
 * Gelaende je Wunder: WONDERS.terrain.
 * Can faction f build the wonder at (x, y)? Portal and Waal: free land in own territory; relay: mountain in own territory
 * or with an own outpost; power plant: 2x2 free land (mountains too) in own territory (anchor + right, down, diagonal).
 * Terrain per wonder: WONDERS.terrain.
 */
export function wonderCheck(s: GameState, f: number, kind: WonderKind, x: number, y: number): WonderCheck {
  if (!factionVictoryOn(s) || !(WONDERS.phases as Record<string, number[]>)[kind]) return 'invalid';
  if (WONDERS.faction[kind] !== s.factions[f].id) return 'wrongFaction';
  if (!hasTech(s, f, UNITS[kind].tech!)) return 'techMissing';
  if (wondersOf(s, f).length > 0) return 'alreadyBuilt';
  for (const p of wonderFootprint(kind, x, y)) {
    if (!inBounds(s.size, p.x, p.y)) return 'invalidTile';
    const t = tileAt(s, p.x, p.y)!;
    const terrainOk = WONDERS.terrain[kind].includes(t.terrain);
    if (!terrainOk || t.cityId !== null || t.building || t.feature || t.grandProject || t.wonderOf || t.volcano || burning(s, t)) return 'invalidTile';
    // Relais darf auf einem eigenen Aussenposten stehen, die anderen nie auf Aussenposten / the relay may stand on an own outpost, others never on outposts
    if (t.outpost && !(kind === 'hackRelay' && t.outpost.owner === f)) return 'invalidTile';
    const own = territoryOwner(s, t) === f || (kind === 'hackRelay' && t.outpost?.owner === f);
    if (!own) return 'notInTerritory';
    if (unitAt(s, p.x, p.y)) return 'occupied';
  }
  if (s.factions[f].stars < WONDERS.cost[kind]) return 'notEnoughStars';
  return 'ok';
}

/** Moegliche Bauplaetze eines Wunders (fuer KI und Oberflaeche) / possible sites of a wonder (for AI and UI) */
export function wonderSites(s: GameState, f: number, kind: WonderKind, ignoreStars = false): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) {
    const t = s.tiles[y * s.size + x];
    if (territoryOwner(s, t) !== f && !(kind === 'hackRelay' && t.outpost?.owner === f)) continue;
    const c = wonderCheck(s, f, kind, x, y);
    if (c === 'ok' || (ignoreStars && c === 'notEnoughStars')) out.push({ x, y });
  }
  return out;
}

/** Art der Siegbedingung je Fraktion / kind of victory condition per faction */
export type VictoryGoal = 'portal' | 'coreDrill' | 'hackRelay' | 'fusionPlant' | 'waal' | 'cities' | 'stars' | 'league';
export const VICTORY_GOAL: Record<FactionId, VictoryGoal> = {
  korvat: 'cities', dravon: 'waal', alvenia: 'league', meridon: 'stars', velkar: 'fusionPlant', zyrr: 'portal', vesper: 'coreDrill', nexus: 'hackRelay',
};

/** Stand der Siegbedingung (Siegverfolgung, KI) / state of the victory condition (victory tracker, AI) */
export interface VictoryStatus {
  faction: number;
  goal: VictoryGoal;
  /** Siegtechnologie bekannt / victory tech known */
  tech: boolean;
  /** Phase: none = noch kein Wunder; build, charge, hack, armed, drill; cities, stars, league / phase */
  phase: 'none' | 'build' | 'charge' | 'hack' | 'armed' | 'drill' | 'cities' | 'stars' | 'league';
  /** Fortschritt der Phase / progress of the phase */
  have: number;
  need: number;
  /** Gesamtfortschritt 0..1 / overall progress 0..1 */
  ratio: number;
  /** Runden bis zum Sieg (falls planbar) / rounds to victory (if predictable) */
  roundsLeft: number | null;
  unit?: number;
  /** Wunder ruht: Ankerfeld nicht im eigenen Gebiet / wonder paused: anchor tile not in own territory */
  paused?: boolean;
  /** Siegbedingung in diesem Spiel nicht moeglich (Voelkerbund mit weniger als 3 Fraktionen) / condition impossible in this game */
  unavailable?: boolean;
}

/** Benoetigte Staedte fuer Korvat: mehr als WONDERS.korvatShare aller Staedte / cities Korvat needs: more than WONDERS.korvatShare of all cities */
export const korvatNeed = (s: GameState) => Math.floor(s.cities.length * WONDERS.korvatShare) + 1;

/**
 * Sterneziel fuer Meridon: ohne Rundenlimit WONDERS.meridonStars, sonst Runden x meridonStarsPerRound (begrenzt).
 * Star target for Meridon: WONDERS.meridonStars without a round limit, otherwise rounds x meridonStarsPerRound (clamped).
 */
export function meridonNeedFor(roundLimit: number | null): number {
  if (roundLimit === null) return WONDERS.meridonStars;
  return Math.min(WONDERS.meridonStars, Math.max(WONDERS.meridonStarsMin, Math.round(roundLimit * WONDERS.meridonStarsPerRound)));
}
export const meridonNeed = (s: GameState) => meridonNeedFor(s.config.roundLimit);

/** Kennen sich a und b? Kontakt in einer Richtung genuegt / do a and b know each other? contact in either direction counts */
export const knows = (s: GameState, a: number, b: number) => s.factions[a].contacts.includes(b) || s.factions[b].contacts.includes(a);

/** Voelkerbund nur mit mindestens 3 Fraktionen im Spiel / League of Nations only with at least 3 factions in the game */
export const leagueAvailable = (s: GameState) => s.factions.length - 1 >= WONDERS.alveniaMinFactions;

/**
 * Voelkerbund-Bedingung jetzt erfuellt? Jede andere lebende Fraktion zaehlt (nicht nur getroffene): bekannt, im Frieden
 * und mit Botschaft; eine Fraktion ohne Hauptquartier (keine Botschaft moeglich) braucht nur Frieden.
 * League of Nations condition met now? Every other living faction counts (not only met ones): known, at peace and with an
 * embassy; a faction without an HQ (no embassy possible) only needs peace.
 */
export function leagueMet(s: GameState, f: number): boolean {
  if (!leagueAvailable(s)) return false;
  const fa = s.factions[f];
  const others = s.factions.filter((g) => g.index !== f && g.alive).map((g) => g.index);
  if (others.length < WONDERS.alveniaMinFactions) return false;
  return others.every((g) => knows(s, f, g) && fa.relations[g] === 'peace' && (fa.embassies.includes(g) || !hqOf(s, g)));
}

export function victoryStatus(s: GameState, f: number): VictoryStatus {
  const fa = s.factions[f];
  const goal = VICTORY_GOAL[fa.id];
  const tech = hasTech(s, f, VICTORY_TECH[fa.id]);
  const base = { faction: f, goal, tech };
  switch (goal) {
    case 'cities': {
      const have = ownCities(s, f).length, need = korvatNeed(s);
      return { ...base, phase: 'cities', have, need, ratio: Math.min(1, have / need), roundsLeft: null };
    }
    case 'stars': {
      const need = meridonNeed(s);
      return { ...base, phase: 'stars', have: fa.stars, need, ratio: Math.min(1, fa.stars / need), roundsLeft: null };
    }
    case 'league': {
      const have = fa.league ?? 0, need = WONDERS.alveniaRounds;
      const unavailable = !leagueAvailable(s);
      return { ...base, phase: 'league', have, need, ratio: have / need, roundsLeft: leagueMet(s, f) ? need - have : null, ...(unavailable ? { unavailable } : {}) };
    }
    default: {
      const u = s.units.find((o) => o.owner === f && o.type === goal);
      const phases = wonderPhases(goal);
      const total = phases.reduce((a, b) => a + b, 0);
      if (!u) return { ...base, phase: 'none', have: 0, need: phases[0], ratio: 0, roundsLeft: null };
      if (goal === 'coreDrill') {
        const have = u.stillRounds ?? 0;
        return { ...base, phase: 'drill', have, need: total, ratio: have / total, roundsLeft: total - have, unit: u.id };
      }
      const stage = Math.min(u.wonder?.stage ?? 0, phases.length - 1);
      const have = u.wonder?.progress ?? 0;
      const done = phases.slice(0, stage).reduce((a, b) => a + b, 0) + have;
      const phase = stage === 0 ? 'build' : goal === 'portal' ? 'charge' : goal === 'hackRelay' ? 'hack' : 'armed';
      // ruhender Fortschritt: keine Prognose / paused progress: no forecast
      const paused = !wonderGroundOk(s, u);
      return { ...base, phase, have, need: phases[stage], ratio: done / total, roundsLeft: paused ? null : total - done, unit: u.id, ...(paused ? { paused } : {}) };
    }
  }
}
