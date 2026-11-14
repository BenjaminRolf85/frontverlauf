/**
 * Lesende Abfragen des Spielkerns (kein Schreibzugriff auf den Zustand).
 * Read-only queries of the game core (never mutate the state).
 */
import {
  COUNTER, type UnitClass, JUNGLE, UPKEEP, ROSTERS, CULT, NEXUS, LAND_UNITS, BARRIER, CITY_UPGRADES, WEATHER, XENO, type CityUpgradeId, type WeatherId, BUILDINGS, CITY, COMBAT, DEFENSE_BONUS, REMAINS, ECON, FACTIONS, FUEL, GRAND_PROJECTS, GRAND_PROJECT_IDS, HEALING, INCOME,
  INFANTRY_TYPES, LOGISTICS_SOURCES, PERKS, PERKS2, RESEARCH_CENTER_TECH, SCORE, TECHS, TECH_IDS, TERRAIN_DEFENSE_TECH, UNITS,
  UNIQUE, VETERAN, VISION, type BuildingId, type FactionId, type GrandProjectId, type Perk2Id, type TechId, type UnitStats, type UnitTypeId,
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

/** Gebaeude eines Typs im Gebiet der Fraktion / buildings of a type in the faction's territory */
export function countBuildings(s: GameState, f: number, b: BuildingId): number {
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

/** Sold einer Einheit pro Runde (ohne Freikontingent) / upkeep of one unit per round (before the free quota) */
export function unitUpkeep(u: Unit): number {
  const flat = UPKEEP.flat[u.type];
  if (flat !== undefined) return flat;
  // Landungsboot: Wert der getragenen Einheit / landing boat: value of the carried unit
  const type = u.type === 'landingBoat' && u.carried ? u.carried : u.type;
  const fl = UPKEEP.flat[type];
  if (fl !== undefined) return fl;
  return Math.ceil((UNITS[type].cost ?? 0) * UPKEEP.share);
}
/** Einheiten, die Sold kosten: alle ausser den aeltesten freien / units that cost upkeep: all but the oldest free ones */
export function paidUnits(s: GameState, f: number): Unit[] {
  return s.units.filter((u) => u.owner === f).sort((a, b) => a.id - b.id).slice(UPKEEP.freeUnits);
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
          if (t.building === 'navalBase' && territoryOwner(s, t) === f && hasTech(s, f, 'coastalEconomy')) {
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
      // Lava und Vulkangipfel sind unpassierbar / lava and volcano peaks are impassable
      if (t.volcano || burning(s, t)) continue;
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
  // Dschungel: Hinterhalt fuer Fusstruppen / jungle: ambush cover for foot troops
  if (isJungle(t) && !JUNGLE.vehicles.includes(def.type) && !isShip(def)) b = Math.max(b, JUNGLE.footDefense);
  return b;
}

export interface CombatPreview { toDefender: number; toAttacker: number; kills: boolean; retaliates: boolean }

export function combatPreview(s: GameState, att: Unit, def: Unit): CombatPreview {
  const d = UNITS[def.type];
  // Todesstrahl ignoriert Deckung / death ray ignores cover
  const bonus = (has(att, 'deathRay') || has(att, 'burn')) ? DEFENSE_BONUS.open : defenseBonus(s, def, att);
  const defense = effectiveDefense(s, def);
  const atk = effectiveAttack(s, att);
  const attackForce = atk * (att.hp / att.maxHp);
  const defenseForce = defense * (def.hp / def.maxHp) * bonus;
  const total = attackForce + defenseForce;
  // Konter-Faktor gegen die Zielklasse / counter factor against the target class
  const toDefender = total > 0 ? Math.round((attackForce / total) * atk * COMBAT.damageFactor * counterFactor(att.type, def.type)) : 0;
  const kills = toDefender >= def.hp;
  // Sturmangriff (shock): das Ziel schlaegt nicht zurueck / shock assault: the target does not strike back
  const retaliates = !kills && !has(att, 'shock') && !has(def, 'noRetaliate') && !submerged(s, def) && d.range > 0 && dist(att, def) <= effectiveRange(s, def);
  const toAttacker = retaliates && total > 0 ? Math.round((defenseForce / total) * defense * COMBAT.damageFactor * counterFactor(def.type, att.type)) : 0;
  return { toDefender, toAttacker, kills, retaliates };
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
  return s.units.filter((o) => o.owner !== u.owner && isHostile(s, u.owner, o.owner) && dist(u, o) === 1 && canSeeUnit(s, u.owner, o));
}

export function healAmount(s: GameState, u: Unit): number {
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
  if (t.cityId !== null || t.feature !== null || t.grandProject || t.outpost) return { ok: false, error: 'invalidTile', cost };
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
  'ok' | 'techMissing' | 'notEnoughStars' | 'occupied' | 'unitLimit' | 'invalid' | 'cultRecruit' | 'computeMissing' {
  if (c.owner === null) return 'invalid';
  const st = UNITS[type];
  if (st.ship || st.cost === null) return 'invalid';
  // Fraktionseinheiten / faction units
  const alien = isAlienFaction(s, c.owner);
  const roster = ROSTERS[s.factions[c.owner].id];
  if ((st.faction && st.faction !== s.factions[c.owner].id) || (roster && !st.faction)) return 'invalid';
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
  if (!BARRIER.terrain.includes(t.terrain) || t.cityId !== null || t.barrier || t.outpost || t.feature) return 'invalidTile';
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
  if (st.faction !== CULT.faction || st.ship || st.cost === null) return 'invalid';
  if (!inBounds(s.size, x, y) || dist(u, { x, y }) !== 1) return 'outOfRange';
  const t = tileAt(s, x, y)!;
  if (!isLand(t)) return 'invalidTile';
  if (t.terrain === 'mountain' && !hasTech(s, f, 'mountainTraining')) return 'invalidTile';
  if (unitAt(s, x, y)) return 'occupied';
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
  return COUNTER.vehicles.includes(type) ? 'vehicle' : 'foot';
}

/** Schadensfaktor des Angreifertyps gegen den Zieltyp (1 = neutral) / damage factor of the attacker type against the target type */
export function counterFactor(attacker: UnitTypeId, target: UnitTypeId): number {
  const bonus = UNITS[attacker].bonusVs;
  if (!bonus) return 1;
  const cls = unitClass(target);
  return cls === 'ship' ? 1 : bonus[cls] ?? 1;
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
  if (!COUNTER.mine.terrain.includes(t.terrain) || t.cityId !== null || t.mine || t.outpost || t.feature || burning(s, t) || t.volcano) return 'invalidTile';
  if (unitAt(s, x, y)) return 'occupied';
  if (mineCount(s, u.owner) >= COUNTER.mine.maxPerFaction) return 'unitLimit';
  if (s.factions[u.owner].stars < COUNTER.mine.cost) return 'notEnoughStars';
  return 'ok';
}

export function mineTargets(s: GameState, u: Unit): Pos[] {
  return neighbors(s.size, u.x, u.y).filter((p) => mineCheck(s, u, p.x, p.y) === 'ok');
}
