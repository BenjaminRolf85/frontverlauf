/**
 * Wirtschaft und Diplomatie: Belohnungen, Forschung, Gebaeude, Ausbildung, Botschaften, Frieden.
 * Economy and diplomacy: rewards, research, buildings, training, embassies, peace.
 */
import {
  unitClass, twinCheck, upkeepFactor, netIncome, canResearch, computePower, computeStats, isCultFaction, isRobotFaction, recruitCheck, recruitSpot, recruitTypes, recruitWait, hordeCount, rosterUnits,
  aliveFactions, buildCheck, cityUpgradeCheck, isAlienFaction, terraformCheck, radioTargets, cityById, cityTiles, dist, embassyCost, grandProjectCheck, hasTech, hqOf, idx,
  income, isLand, isShip, isWater, neighbors, researchCost, supportedUnits, territoryOwner, trainCheck, unitAt,
  unitCost, unitLimit, upgradeCheck, rewardOptions, expandRadius, freeRingTiles, buyLevelCheck, buyLevelCost, levelUpCost, harbourCities, hasCityUpgrade, type City, type Command, type GameState, type Unit,
  factionVictoryOn, isWonder, victoryStatus, victoryTechOf, judges, deedSinner, sinnerCount, wonderKindOf, wonderSites, wondersOf, researchAllowed, korvatNeed, meridonNeed, ownCities,
  baseBuilding, countBuildings, inContact, pilgrimVeteranAt, resourceSiteOk, usesSites, shipUpgradeCost, siteOf, citySites, diplomacyLocked,
} from '../core';
import {
  AI, CULT, UPKEEP, ROSTERS, ORBITAL, ALIEN_UNITS, XENO, BUILDINGS, RESOURCE, CITY_UPGRADES, CITY_UPGRADE_IDS, GRAND_PROJECT_IDS, LOGISTICS_SOURCES, RESEARCH_CENTER_TECH, TECHS, TECH_IDS, UNIQUE, UNITS,
  WONDERS, DOCTRINE, VEHICLE_UNITS, PRODUCTION, FACTIONS, type BuildingId, type TechId, type UnitTypeId, type WonderKind,
} from '../data/balance';
import { worth, type Ctx } from './analysis';
import { relayTechBonus, relayValue } from './orbital';
import { hashNoise } from './profile';
import { cmdKey } from './tactics';
import { emplacementPioneerShare, emplacementTechBonus } from './emplacements';
import { materialBonus, productionBuys, siteFor } from './production';

type Failed = Set<string>;

// ---------- Belohnungen / rewards ----------

export function chooseReward(ctx: Ctx, c: City, level: number): 'a' | 'b' {
  const { s, prof } = ctx;
  if (prof.sloppy > 0 && hashNoise(c.id, level, 3) < prof.sloppy * 0.5) return hashNoise(c.id, level) < 0.5 ? 'a' : 'b';
  const threatened = ctx.enemies.some((e) => dist(e, c) <= 3);
  switch (level) {
    case 2: return 'a'; // Fabrik: +Einkommen / factory: +income
    // Bunkerring nur bei Bedrohung, in der Eroberung nur fuers HQ (sonst Stellungskrieg)
    // bunker ring only when threatened, in conquest only for the HQ (avoids trench stalemates)
    case 3: return threatened && (!ctx.conquest || c.isHQ) ? 'a' : 'b';
    case 4: {
      // schon 7x7: Sterne oder Bevoelkerung, Bevoelkerung waechst weiter / already 7x7: stars or population, population keeps growing
      if (rewardOptions(c, level)[0] !== 'expand') return 'b';
      // Velkar mit Kernfusion: Platz fuer das 2x2-Kraftwerk / Velkar with fusion: room for the 2x2 power plant
      if (ctx.fa.id === 'velkar' && factionVictoryOn(s) && !wondersOf(s, ctx.f).length && !wonderSites(s, ctx.f, 'fusionPlant', true).length) return 'a';
      // Ausdehnung, wenn genug neue Felder bis zum Zielradius / expand if enough new tiles up to the target radius
      let free = 0;
      for (let r = c.radius + 1; r <= expandRadius(c); r++) free += freeRingTiles(s, c, r).length;
      return free >= 4 ? 'a' : 'b';
    }
    default: {
      // Regierungsviertel oder Panzer / government quarter or tank
      const tankSpot = !unitAt(s, c.x, c.y) || neighbors(s.size, c.x, c.y).some((p) => !unitAt(s, p.x, p.y) && isLand(s.tiles[idx(s.size, p.x, p.y)]));
      if (!c.govQuarter) return ctx.conquest && threatened && tankSpot ? 'b' : 'a';
      return tankSpot ? 'b' : 'a';
    }
  }
}

export function planRewards(ctx: Ctx, failed: Failed): Command | null {
  for (const p of ctx.s.pendingRewards) {
    const c = cityById(ctx.s, p.cityId);
    if (!c || c.owner !== ctx.f) continue;
    const choice = chooseReward(ctx, c, p.level);
    const cmd: Command = { type: 'reward', city: c.id, choice };
    if (!failed.has(cmdKey(cmd))) return cmd;
    const alt: Command = { type: 'reward', city: c.id, choice: choice === 'a' ? 'b' : 'a' };
    if (!failed.has(cmdKey(alt))) return alt;
  }
  return null;
}

// ---------- Grossprojekte / grand projects ----------

export function planGrandProject(ctx: Ctx, failed: Failed): Command | null {
  const { s, f, fa } = ctx;
  for (const id of GRAND_PROJECT_IDS) {
    if (!fa.grandProjectsUnlocked.includes(id) || fa.grandProjectsBuilt.includes(id)) continue;
    const cities = ctx.myCities.slice().sort((a, b) => b.level - a.level || a.id - b.id);
    for (const c of cities) {
      for (const p of cityTiles(s, c)) {
        if (!grandProjectCheck(s, f, id, p.x, p.y)) continue;
        const cmd: Command = { type: 'grandProject', id, x: p.x, y: p.y };
        if (!failed.has(cmdKey(cmd))) return cmd;
      }
    }
  }
  return null;
}

// ---------- Staerke / strength ----------

export function strength(ctx: Ctx, g: number): number {
  const { s, f } = ctx;
  if (g === f) {
    let v = 25 * ctx.myCities.length;
    for (const u of ctx.my) if (!isWonder(u)) v += worth(u);
    return v;
  }
  let v = 0;
  for (const c of s.cities) if (c.owner === g && ctx.fa.explored[idx(s.size, c.x, c.y)]) v += 25;
  for (const u of s.units) {
    if (u.owner !== g || isWonder(u)) continue;
    // nur sichtbare Einheiten / only visible units
    if (ctx.enemies.includes(u) || (ctx.fa.explored[idx(s.size, u.x, u.y)] && !UNITS[u.type].abilities.includes('invisible') && !UNITS[u.type].abilities.includes('submerged'))) v += worth(u) * 1.3;
  }
  return Math.max(v, 30);
}

// ---------- Diplomatie / diplomacy ----------

/**
 * Eroberung: Frieden mit einem starken Nachbarn, um den schwaechsten Gegner zu erledigen (Zweifrontenkrieg vermeiden).
 * Conquest: peace with a strong neighbour to finish off the weakest enemy (avoid two-front wars).
 */
function focusPeace(ctx: Ctx, g: number): boolean {
  const { s, f, fa } = ctx;
  if (!ctx.conquest || aliveFactions(s).length <= 2 || s.round > 60) return false;
  const atWar = fa.contacts.filter((o) => s.factions[o].alive && fa.relations[o] === 'war');
  if (atWar.length < 2) return false;
  let weakest = -1, ws = Infinity;
  for (const o of atWar) { const st = strength(ctx, o); if (st < ws) { ws = st; weakest = o; } }
  return g !== weakest && strength(ctx, g) >= strength(ctx, f) * 0.6;
}

export function planPeaceResponses(ctx: Ctx, failed: Failed): Command | null {
  const { fa, prof } = ctx;
  for (const g of fa.peaceOffers.slice().sort((a, b) => a - b)) {
    if (!ctx.s.factions[g]?.alive || !inContact(ctx.s, ctx.f, g) || fa.relations[g] !== 'war') continue;
    // Wettlauf (m2): keine Angebote annehmen, nur ablehnen / race (m2): accept no offers, only decline
    if (diplomacyLocked(ctx.s, ctx.f, g)) {
      const no: Command = { type: 'diplomacy', action: 'declinePeace', target: g };
      if (!failed.has(cmdKey(no))) return no;
      continue;
    }
    const mine = strength(ctx, ctx.f), theirs = strength(ctx, g);
    let accept: boolean;
    if (prof.difficulty === 'easy') accept = true;
    // keinen Frieden mit einer Fraktion kurz vor dem Sieg / no peace with a faction close to victory
    else if (nearVictory(ctx, g)) accept = false;
    // Heiliges Alvenia: kein Frieden mit Suendern einer Tat, ausser in echter Not; mit Gottlosen wie mit allen
    // Holy Alvenia: no peace with sinners of a deed, except in real need; with the godless as with everyone
    else if (judges(ctx.s, ctx.f) && deedSinner(ctx.s, g)) accept = mine < theirs * 0.7 && warCount(ctx) >= 2;
    else if (ctx.conquest) accept = focusPeace(ctx, g) || (mine < theirs * 0.7 && aliveFactions(ctx.s).length > 2 && ctx.s.round <= 60);
    // Kult: lebt von der Beute, Frieden nur in echter Not / cult: lives off loot, peace only in real need
    else if (isCultFaction(ctx.s, ctx.f)) accept = mine < theirs * AI.cultPeaceStrength && warCount(ctx) >= 2;
    else accept = mine < theirs * 1.4 || warCount(ctx) >= 2;
    const cmd: Command = { type: 'diplomacy', action: accept ? 'acceptPeace' : 'declinePeace', target: g };
    if (!failed.has(cmdKey(cmd))) return cmd;
  }
  return null;
}

/** Steht Fraktion g kurz vor ihrem Fraktionssieg? / is faction g close to its faction victory? */
export function nearVictory(ctx: Ctx, g: number): boolean {
  if (!factionVictoryOn(ctx.s) || ctx.prof.difficulty === 'easy') return false;
  const st = victoryStatus(ctx.s, g);
  return st.tech && st.ratio >= WONDERS.aiNearVictory;
}

function warCount(ctx: Ctx): number {
  let n = 0;
  for (const g of ctx.fa.contacts) if (ctx.s.factions[g].alive && ctx.fa.relations[g] === 'war') n++;
  return n;
}

export function planDiplomacy(ctx: Ctx, failed: Failed): Command | null {
  const { s, f, fa, prof } = ctx;
  const alive = aliveFactions(s).length;
  for (const g of fa.contacts.slice().sort((a, b) => a - b)) {
    const ga = s.factions[g];
    // Kampagne: Buendnis und Wettlauf (m2) stehen fest / campaign: alliance and race (m2) are fixed
    if (!ga.alive || diplomacyLocked(s, f, g)) continue;
    const mine = strength(ctx, f), theirs = strength(ctx, g);
    const rel = fa.relations[g];
    // Friedensstifter bieten regelmaessig Frieden an; Alvenia nie einem Suender / peacemakers offer peace regularly; Alvenia never to a sinner
    // Suender einer Tat (nicht die dauerhaft Gottlosen) / sinners of a deed (not the permanently godless)
    const sinner = judges(s, f) && deedSinner(s, g);
    if (rel === 'war' && prof.peacemaker && !sinner && (s.round + f) % 2 === 0 && !ga.peaceOffers.includes(f) && !fa.peaceOffers.includes(g)) {
      const cmd: Command = { type: 'diplomacy', action: 'proposePeace', target: g };
      if (!failed.has(cmdKey(cmd))) return cmd;
    }
    if (rel === 'war' && prof.difficulty !== 'easy' && !sinner && (s.round + f) % 4 === 0 && !ga.peaceOffers.includes(f) && !fa.peaceOffers.includes(g) && !nearVictory(ctx, g)) {
      // Frieden anbieten, wenn schwach und bedroht oder zur Schwerpunktbildung
      // propose peace when weak and threatened, or to focus on one enemy
      const pressed = ctx.enemies.some((e) => e.owner === g && ctx.myCities.some((c) => dist(c, e) <= 3));
      const weak = mine < theirs * (ctx.conquest ? 0.5 : 0.7) && pressed && !(ctx.conquest && (alive <= 2 || s.round > 60));
      if (weak || focusPeace(ctx, g)) {
        const cmd: Command = { type: 'diplomacy', action: 'proposePeace', target: g };
        if (!failed.has(cmdKey(cmd))) return cmd;
      }
    }
    if (rel === 'peace') {
      // Frieden brechen: Eroberung erzwingt am Ende Krieg / break peace: conquest eventually forces war
      const noWar = !fa.contacts.some((o) => s.factions[o].alive && fa.relations[o] === 'war');
      // Frieden brechen, wenn der Partner kurz vor dem Fraktionssieg steht; Alvenia bricht nie (Friedensbruch ist Suende)
      // break peace when the partner is close to its faction victory; Alvenia never breaks (breaking a peace is a sin)
      // Kult: ohne Krieg keine Beute / cult: no war, no loot
      const cultBreak = isCultFaction(s, f) && ctx.roundsLeft > 3 && (noWar || mine > theirs * AI.cultBreakStrength);
      const brk = judges(s, f) ? false : nearVictory(ctx, g) || cultBreak || (ctx.conquest
        ? alive <= 2 || noWar || s.round > 60
        : prof.difficulty === 'extreme' && mine > theirs * 2 && ctx.roundsLeft > 8);
      if (brk) {
        const cmd: Command = { type: 'diplomacy', action: 'announceBreak', target: g };
        if (!failed.has(cmdKey(cmd))) return cmd;
      }
    }
  }
  return null;
}

// ---------- Kaeufe / purchases ----------

/** horizon: so viele Runden Einkommen darf die KI ansparen (Standard 1,5) / horizon: rounds of income the AI may save up (default 1.5) */
interface Buy { cmd: Command; cost: number; value: number; save: boolean; horizon?: number }

const POP_BUILDINGS: BuildingId[] = ['storehouse', 'ranch', 'fishery', 'lumberCamp', 'farm', 'mine', 'materialsPlant', 'foodFactory', 'steelMill', 'logisticsCenter', 'navalBase', 'researchCenter'];

/** Gebaeude ohne Technik-/Sternepruefung moeglich? / building possible ignoring tech and stars? */
function siteOk(s: GameState, f: number, b: BuildingId, x: number, y: number): boolean {
  const t = s.tiles[idx(s.size, x, y)];
  const st = BUILDINGS[b];
  if (territoryOwner(s, t) !== f || t.cityId !== null || t.feature || t.grandProject || t.outpost || t.building) return false;
  if (b === 'researchCenter') return t.terrain !== 'ocean';
  if (!st.terrain.includes(t.terrain)) return false;
  if (st.resource && t.resource !== st.resource) return false;
  if (!st.resource && t.resource) return false;
  if (t.road) return false;
  return true;
}

/** Bevoelkerungsgewinn eines Gebaeudes / population gain of a building */
function popGain(s: GameState, f: number, b: BuildingId, x: number, y: number): number {
  const st = BUILDINGS[b];
  let p = st.pop;
  if (st.adjacency) for (const n of neighbors(s.size, x, y)) { const nb = s.tiles[idx(s.size, n.x, n.y)].building; if (nb && baseBuilding(nb) === st.adjacency.building) p += st.adjacency.pop; }
  for (const n of neighbors(s.size, x, y)) {
    const nt = s.tiles[idx(s.size, n.x, n.y)];
    if (!nt.building) continue;
    const adj = BUILDINGS[nt.building].adjacency;
    if (adj && adj.building === b && territoryOwner(s, nt) === f) p += adj.pop;
  }
  return p;
}

function siteCounts(ctx: Ctx): Record<BuildingId, number> {
  const { s, f } = ctx;
  const out = {} as Record<BuildingId, number>;
  for (const b of POP_BUILDINGS) out[b] = 0;
  for (const c of ctx.myCities) {
    for (const p of cityTiles(s, c)) {
      for (const b of POP_BUILDINGS) {
        if (!siteOk(s, f, b, p.x, p.y)) continue;
        if (BUILDINGS[b].adjacency) {
          const src = BUILDINGS[b].adjacency!.building;
          const n = neighbors(s.size, p.x, p.y).filter((q) => {
            const t = s.tiles[idx(s.size, q.x, q.y)];
            return t.building === src || (src === 'farm' && t.resource === 'farmland') || (src === 'mine' && t.resource === 'ore') || (src === 'lumberCamp' && t.terrain === 'forest' && !t.resource);
          }).length;
          if (n >= 1) out[b] += Math.min(1, n / 2);
        } else out[b]++;
      }
    }
  }
  return out;
}

const MIL: Partial<Record<TechId, number>> = {
  motorization: 14, armsIndustry: 30, ballistics: 24, armyAviation: 22, camouflage: 10, fortification: 15,
  cybernetics: 24, intelligence: 14, mountainTraining: 8, highAltitude: 6, coastalEconomy: 4, diving: 5,
  shipbuilding: 7, navalArtillery: 7, coastalDefense: 4, aerodynamics: 6, roadbuilding: 8, logistics: 6,
  fieldResearch: 3, forestry: 2, livestock: 2, supply: 2, agritech: 2, foodIndustry: 2, mining: 3,
};

/**
 * Menschen: Doktrinen statt Einheiten (Grundwert; dazu doctrineValue nach eigener Armee und Gebaeuden).
 * Humans: doctrines instead of units (base value; plus doctrineValue by own army and buildings).
 */
const DOCTRINE_MIL: Partial<Record<TechId, number>> = {
  motorization: 14, armsIndustry: 26, ballistics: 22, armyAviation: 16, camouflage: 10, fortification: 15,
  cybernetics: 24, intelligence: 14, mountainTraining: 8, highAltitude: 6, coastalEconomy: 4, diving: 5,
  shipbuilding: 7, navalArtillery: 7, coastalDefense: 4, aerodynamics: 8, roadbuilding: 8, logistics: 6,
  fieldResearch: 3, forestry: 8, livestock: 2, supply: 2, agritech: 2, foodIndustry: 2, mining: 10,
};

/**
 * Wert einer Doktrin nach eigener Armee und eigenen Gebaeuden (DOCTRINE), in Sternen.
 * Worth of a doctrine by own army and own buildings (DOCTRINE), in stars.
 */
function doctrineValue(ctx: Ctx, t: TechId): number {
  const { s } = ctx;
  const n = (types: UnitTypeId[]) => ctx.my.filter((u) => types.includes(u.carried ?? u.type)).length;
  switch (t) {
    case 'motorization': return n(VEHICLE_UNITS) * 6;
    case 'aerodynamics': return n(['antiAir']) * 6 + enemyMix(ctx).air * 4;
    case 'armyAviation': return n(['heli', 'octocopter']) * 8;
    case 'fortification': return n(['mineLayer']) * 6;
    case 'intelligence': return n(['spy']) * 6;
    // Rabatte auf Panzer und Geschuetze: nach vorhandener Staette / discounts on tanks and guns: by existing site
    case 'mining': return (ctx.myCities.some((c) => citySites(s, c).includes('tankWorks')) ? 18 : 0) + n(PRODUCTION.units.tankWorks) * 6;
    case 'forestry': return (ctx.myCities.some((c) => citySites(s, c).includes('foundry')) ? 14 : 0) + n(PRODUCTION.units.foundry) * 6;
    case 'armsIndustry': return n(DOCTRINE.armsIndustryUnits) * 6;
    case 'cybernetics': return n(['medic']) * 6;
    case 'navalArtillery': return ctx.my.filter((u) => UNITS[u.type].ship).length * 6;
    case 'shipbuilding': return ctx.my.filter((u) => UNITS[u.type].ship).length * 4;
    case 'ballistics': return n(DOCTRINE.ballisticsUnits) * 9;
    default: return 0;
  }
}

/**
 * Kult: Forschung nur fuer Einheiten (und Wege dorthin), Staedte wachsen ohnehin nicht.
 * Cult: research only for units (and the way there), cities do not grow anyway.
 */
const CULT_MIL: Partial<Record<TechId, number>> = {
  forestry: 70, camouflage: 90, motorization: 6, ballistics: 65, armsIndustry: 75, mountainTraining: 25, mining: 25,
};

function techBase(ctx: Ctx, t: TechId, sites: Record<BuildingId, number>, unconnected: number): number {
  const { prof } = ctx;
  if (isCultFaction(ctx.s, ctx.f)) {
    let mil = (CULT_MIL[t] ?? 0) * prof.militaryW;
    if (t === 'armsIndustry') mil += counterShares(ctx).antiVehicle * 70 * prof.militaryW;
    if (factionVictoryOn(ctx.s) && t === TECHS[victoryTechOf(ctx.s, ctx.f)].parent && ctx.s.round >= WONDERS.aiResearchRound - 4) mil += 40;
    return mil;
  }
  const popVal = 10 * prof.buildW;
  let econ = 0;
  for (const b of POP_BUILDINGS) {
    if (BUILDINGS[b].tech !== t || b === 'researchCenter') continue;
    if (b === 'logisticsCenter') { econ += Math.min(3, sites[b]) * 12; continue; }
    if (b === 'navalBase') { econ += ctx.navalNeed ? 45 : Math.min(1, sites[b]) * 4; continue; }
    econ += Math.min(5, sites[b]) * (BUILDINGS[b].pop || 1) * popVal * 0.45;
  }
  // Menschen: Doktrinen; sonst Forschung fuer Einheiten / humans: doctrines; otherwise research for units
  const human = usesSites(ctx.s, ctx.f);
  let mil = ((human ? DOCTRINE_MIL : MIL)[t] ?? 0) * prof.militaryW * (ctx.conquest ? 1.3 : 1);
  if (human) mil += doctrineValue(ctx, t) * prof.militaryW;
  else {
    if (t === 'ballistics' && ctx.hostileCities.length) mil += 12;
    // Konter-Technologien, wenn die sichtbare Gegnerarmee sie verlangt / counter techs when the visible enemy army calls for them
    if (t === 'armsIndustry' || t === 'aerodynamics') {
      const ct = counterShares(ctx);
      mil += (t === 'armsIndustry' ? ct.antiVehicle : ct.antiAir) * 70 * prof.militaryW;
    }
  }
  if (t === 'intelligence') mil += ctx.fa.contacts.length * 12 * prof.embassyW;
  // Vorgaenger der eigenen Siegtechnologie ab der Spielmitte / parent of the own victory tech from mid game
  if (factionVictoryOn(ctx.s) && t === TECHS[victoryTechOf(ctx.s, ctx.f)].parent && ctx.s.round >= WONDERS.aiResearchRound - 4) mil += 40;
  if (t === 'roadbuilding') mil += unconnected * 12;
  // Festungsbau braucht Pioniere (bei Fraktionen, die sie erforschen) / fortification needs pioneers (for factions that research them)
  const pt = UNITS.pioneer.tech;
  if (pt && t === pt) mil += emplacementTechBonus(ctx);
  else if (pt && t === TECHS[pt].parent && !ctx.fa.techs.includes(pt)) mil += emplacementTechBonus(ctx) * 0.6;
  mil += relayTechBonus(ctx, t);
  if (t === 'mountainTraining' || t === 'highAltitude') {
    let m = 0;
    for (const c of ctx.myCities) for (const p of cityTiles(ctx.s, c)) if (ctx.s.tiles[idx(ctx.s.size, p.x, p.y)].terrain === 'mountain') m++;
    mil += m * 2;
  }
  if ((t === 'shipbuilding' || t === 'diving') && ctx.navalNeed) mil += human ? (t === 'diving' ? 10 : 3) : 10;
  // Technik der einzigartigen Einheit oder des einzigartigen Gebaeudes / tech of the unique unit or building
  const uu = UNIQUE.units[ctx.fa.id], ub = UNIQUE.buildings[ctx.fa.id];
  if (uu && UNITS[uu].tech === t) mil += 12 * prof.militaryW;
  if (ub && BUILDINGS[ub].tech === t) mil += 8;
  // Technik des Ressourcengebaeudes, je passendem Feld im eigenen Gebiet / tech of the resource building, per fitting own tile
  const rb = RESOURCE.buildings[ctx.fa.id];
  if (BUILDINGS[rb].tech === t) mil += 6 + Math.min(3, resourceSites(ctx, rb)) * 6;
  if (ctx.points && ctx.roundsLeft >= 6 && Object.values(RESEARCH_CENTER_TECH).includes(t)) mil += 10;
  return econ + mil;
}

/** Passende Felder fuer das Ressourcengebaeude im eigenen Gebiet (ohne Technik und Sterne) / fitting own tiles for the resource building (ignoring tech and stars) */
function resourceSites(ctx: Ctx, b: BuildingId): number {
  let n = 0;
  for (const c of ctx.myCities) for (const p of cityTiles(ctx.s, c)) if (resourceSiteOk(ctx.s, b, p.x, p.y)) n++;
  return n;
}

/**
 * Wert eines Ressourcengebaeudes auf (x, y): Bevoelkerung (beim Ausbau nur die Differenz), Sterne ueber den Horizont,
 * Forschungsrabatt, Veteranen-Rekruten, Rechenleistung.
 * Worth of a resource building at (x, y): population (on an upgrade only the difference), stars over the horizon,
 * research discount, veteran recruits, compute.
 */
function resourceValue(ctx: Ctx, c: City, b: BuildingId, x: number, y: number, popVal: number, horizon: number): number {
  const { s, f, fa } = ctx;
  const st = BUILDINGS[b];
  const t = s.tiles[idx(s.size, x, y)];
  const replaced = t.building && t.building === st.upgrades ? t.building : null;
  let pop = st.pop - (replaced ? BUILDINGS[replaced].pop : 0);
  if (st.adjacency) for (const n of neighbors(s.size, x, y)) { const nb = s.tiles[idx(s.size, n.x, n.y)].building; if (nb && baseBuilding(nb) === st.adjacency.building) pop += st.adjacency.pop; }
  if (!replaced) {
    for (const n of neighbors(s.size, x, y)) {
      const nt = s.tiles[idx(s.size, n.x, n.y)];
      const adj = nt.building ? BUILDINGS[nt.building].adjacency : undefined;
      if (adj && adj.building === baseBuilding(b) && territoryOwner(s, nt) === f) pop += adj.pop;
    }
  }
  let value = pop * popVal;
  let stars = st.stars ?? 0;
  if (b === 'tradeHarbour' && cityTiles(s, c).some((p) => s.tiles[idx(s.size, p.x, p.y)].building === 'navalBase')) stars += RESOURCE.harbourNavalBonus;
  // Klosterweingut: Heilung im Stadtgebiet / monastery vineyard: healing in the city territory
  if (b === 'hillVineyard') value += RESOURCE.vineyardHeal * Math.min(horizon, 15) * 0.3;
  value += stars * Math.min(horizon, 15) * 0.45;
  if (b === 'polarStation' && countBuildings(s, f, b) < RESOURCE.polarMax) {
    value += TECH_IDS.filter((tt) => !fa.techs.includes(tt)).length * RESOURCE.polarDiscount * 45 * Math.min(1, horizon / 12);
  }
  // Pilgerstaette: Veteranen, wenn noch keine in Reichweite / pilgrimage site: veterans if none in reach yet
  if (b === 'pilgrimSite' && !pilgrimVeteranAt(s, f, x, y)) value += 8 * ctx.prof.militaryW;
  // Depotknoten: Rechenleistung fuer groessere Roboter / depot node: compute for bigger robots
  if (b === 'depotNode') value += computeStats(s, f).compute < 4 ? 40 : 15;
  return value;
}

function techValue(ctx: Ctx, t: TechId, sites: Record<BuildingId, number>, unconnected: number): number {
  let v = techBase(ctx, t, sites, unconnected);
  let child = 0;
  for (const c of TECH_IDS) if (TECHS[c].parent === t) child = Math.max(child, techBase(ctx, c, sites, unconnected));
  v += child * 0.45;
  v += ctx.pf * 100 * TECHS[t].tier;
  // Menschen: Doktrinen konkurrieren mit den Produktionsstaetten um Sterne, daher hoeher gewichtet (AI.doctrineW); Velkar weniger,
  // sein Forschungsrabatt (researchLead) macht Doktrinen ohnehin guenstig
  // humans: doctrines compete with the production sites for stars, hence weighted higher (AI.doctrineW); Velkar less, its
  // research discount (researchLead) makes doctrines cheap anyway
  const w = !usesSites(ctx.s, ctx.f) ? 1 : FACTIONS[ctx.fa.id].perk === 'researchLead' ? AI.doctrineWLead : AI.doctrineW;
  return v * ctx.prof.researchW * w;
}

/**
 * Zusammensetzung der sichtbaren Gegner: Anteil Fahrzeuge und Flieger (fuer Konter-Einheiten).
 * Composition of the visible enemies: vehicles and flyers (for counter units).
 */
export function enemyMix(ctx: Ctx, near?: { x: number; y: number }, radius = 99): { vehicle: number; air: number; total: number } {
  let vehicle = 0, air = 0, total = 0;
  for (const e of ctx.enemies) {
    if (UNITS[e.type].attack <= 0 || (near && dist(e, near) > radius)) continue;
    const cls = unitClass(e.carried ?? e.type);
    total++;
    if (cls === 'vehicle') vehicle++;
    else if (cls === 'air') air++;
  }
  return { vehicle, air, total };
}

/** Zielanteile der Konter-Einheiten / target shares of the counter units */
function counterShares(ctx: Ctx): { antiVehicle: number; antiAir: number; vehRatio: number; airRatio: number } {
  const mix = enemyMix(ctx);
  const vehRatio = mix.total ? mix.vehicle / Math.max(3, mix.total) : 0;
  const antiVehicle = mix.vehicle >= 2 ? Math.min(0.45, 0.1 + 0.5 * vehRatio) : mix.vehicle ? 0.06 : 0;
  const airRatio = mix.total ? mix.air / Math.max(3, mix.total) : 0;
  const antiAir = mix.air ? Math.min(0.4, 0.12 + 0.12 * mix.air) : 0;
  return { antiVehicle, antiAir, vehRatio, airRatio };
}

/** Wunschtyp fuer eine Stadt / desired unit type for a city */
export function chooseUnitType(ctx: Ctx, c: City, urgent: boolean): UnitTypeId | null {
  const { s, f, prof } = ctx;
  if (isAlienFaction(s, f)) return chooseAlienUnit(ctx, urgent);
  if (ROSTERS[ctx.fa.id]) return chooseRosterUnit(ctx, urgent);
  const count = (t: UnitTypeId) => ctx.my.filter((u) => u.type === t || u.carried === t).length;
  const army = Math.max(1, ctx.my.length);
  const unexplored = ctx.fa.explored.some((e) => !e);
  // Menschen: nur, wofuer die Stadt eine Produktionsstaette hat / humans: only what the city has a production site for
  const avail = (t: UnitTypeId) => UNITS[t].cost !== null && (!UNITS[t].tech || hasTech(s, f, UNITS[t].tech!)) && siteFor(s, c, t);
  // Konter: Anteile nach sichtbaren Fahrzeugen und Fliegern / counters: shares by visible vehicles and flyers
  const ct = counterShares(ctx);
  const soft = 1 - 0.5 * Math.min(1, ct.vehRatio + ct.airRatio);
  // Zielanteile der Armee / target shares of the army
  const share: Partial<Record<UnitTypeId, number>> = {
    infantry: (avail('mg') ? 0.15 : 0.45) * soft,
    mg: 0.35 * soft,
    antiTank: ct.antiVehicle,
    antiAir: ct.antiAir,
    mineLayer: army >= 4 && (ctx.enemies.length > 0 || ctx.conquest) ? 0.08 : 0,
    jeep: unexplored ? 0.2 : 0.08,
    sniper: 0.06,
    // Velkar-Bauarten wie ihre Grundtypen (VARIANTS) / Velkar designs like their base types (VARIANTS)
    railSniper: 0.07,
    // Alvenia: Lichtschuetzen als Kern der Armee, Sonnenlanzen gegen Staedte und zur Verteidigung / Alvenia: Light Wardens as the core of the army, Sun Lances against cities and for defence
    lightWarden: (avail('mg') ? 0.3 : 0.55) * soft,
    sunLance: ctx.hostileCities.length ? 0.16 : 0.08,
    // Festungsbau: Pionier, solange Stellungsplaetze frei sind / fortification: a pioneer while emplacement slots are free
    pioneer: 0.05 + emplacementPioneerShare(ctx),
    artillery: ctx.hostileCities.length ? 0.16 : 0.04,
    medic: army >= 4 ? 0.08 : 0,
    spy: ctx.hostileCities.length && army >= 4 ? 0.06 : 0,
    heli: army >= 4 ? 0.1 : 0,
    octocopter: army >= 4 ? 0.1 : 0,
    // Panzerwerk: schwere Panzer, sobald die Armee steht / tank works: heavy tanks once the army stands
    tank: army >= 4 ? 0.14 : 0.05,
    teslaTank: army >= 4 ? 0.14 : 0.05,
    reliquary: army >= 4 ? 0.14 : 0.05,
    steppeColossus: army >= 4 ? 0.2 : 0.08,
    // einzigartige Einheiten / unique units
    steppeRider: unexplored ? 0.18 : 0.1,
    stormbreaker: ctx.hostileCities.length || ctx.enemies.length ? 0.22 : 0.1,
    peacekeeper: 0.2,
    protoWalker: ctx.hostileCities.length ? 0.15 : 0.06,
  };
  // Qualitaet je Typ / quality per type
  const quality: Partial<Record<UnitTypeId, number>> = {
    infantry: 0.5, mg: 1, jeep: 0.6, sniper: 0.6, pioneer: 0.5, artillery: 0.9, medic: 0.8, spy: 0.6, heli: 0.9, railSniper: 0.7, octocopter: 0.9,
    lightWarden: 0.7, sunLance: 1, tank: 1.2, teslaTank: 1.2, reliquary: 1.2, steppeColossus: 1.3,
    antiTank: 0.8, antiAir: 0.8, mineLayer: 0.6,
    steppeRider: 0.6, stormbreaker: 1, peacekeeper: 0.9, protoWalker: 1,
  };
  // Bedrohung der Stadt: Fahrzeuge oder Flieger in der Naehe / threat to the city: vehicles or flyers nearby
  const local = enemyMix(ctx, c, 3);
  let best: UnitTypeId | null = null;
  let bs = -Infinity;
  const list = rosterUnits(s, f);
  for (const t of list) {
    if (!avail(t)) continue;
    const counterUrgent = (t === 'antiTank' && local.vehicle > 0) || (t === 'antiAir' && local.air > 0);
    if (urgent && !['infantry', 'mg', 'pioneer', 'sniper', 'railSniper', 'lightWarden', 'peacekeeper', 'stormbreaker'].includes(t) && !counterUrgent) continue;
    const target = (share[t] ?? 0) * (prof.pref[t] ?? 1);
    if (target <= 0 && !urgent) continue;
    // Meridon: zwei zum Preis von einer, wenn beide passen / Meridon: two for the price of one if both fit
    const twin = twinCheck(s, c, t) === 'twin' ? AI.twinValue : 1;
    let sc = (target - count(t) / army) * 4 + (quality[t] ?? 0.3) * 0.5 * twin;
    // Pioniere nur noch knapp vor der Infanterie: sie kommen jetzt aus jeder Kaserne / pioneers only just ahead of infantry: they now come from every barracks
    if (urgent) sc = counterUrgent ? 2.2 : t === 'mg' || t === 'peacekeeper' ? 2 : t === 'stormbreaker' ? 1.8 : t === 'pioneer' ? (usesSites(s, f) ? 1.15 : 1.6) : t === 'infantry' || t === 'lightWarden' ? 1.2 : 1;
    if (!prof.specials && (t === 'medic' || t === 'spy' || t === 'artillery' || t === 'sunLance')) sc -= 0.6;
    if (prof.sloppy > 0) sc += (hashNoise(c.id, s.round, list.indexOf(t)) - 0.5) * prof.sloppy * 2;
    sc -= unitCost(s, f, t)! / 250 / twin;
    if (sc > bs) { bs = sc; best = t; }
  }
  return best;
}

/** Kult und NEXUS: Armeemischung / cult and NEXUS: army mix */
const ROSTER_SHARE: Partial<Record<UnitTypeId, number>> = {
  zealot: 0.4, torchbearer: 0.2, prophet: 0.1, doomBuggy: 0.12, rocketCart: 0.12, doomCrawler: 0.18,
  android: 0.2, spider: 0.22, quadDrone: 0.12, railgun: 0.12, titan: 0.2,
  // NEXUS: Cyborgs loesen Androiden ab, Flammenwerferpanzer gegen Fusstruppen, Kamikaze-Drohnen als billige Jaeger
  // NEXUS: cyborgs take over from androids, flamethrower tanks against foot troops, kamikaze drones as cheap hunters
  cyborg: 0.35, flameTank: 0.16, kamikazeDrone: 0.11,
};
function chooseRosterUnit(ctx: Ctx, urgent: boolean, only?: UnitTypeId[]): UnitTypeId | null {
  const { s, f } = ctx;
  const army = Math.max(1, ctx.my.length);
  const count = (t: UnitTypeId) => ctx.my.filter((u) => u.type === t).length;
  // Kult: nur, was der Rekrutierer rufen kann (ohne Bohrer) / cult: only what the recruiter can call up (without the drill)
  const roster = (only ?? rosterUnits(s, f)).filter((t) => !UNITS[t].abilities.includes('wonder'));
  // Konter der Sonderfraktionen / counters of the special factions
  const ct = counterShares(ctx);
  const shareOf = (t: UnitTypeId) => {
    const bonus = UNITS[t].bonusVs;
    if (bonus?.vehicle && bonus.vehicle > 1) return Math.max(0.04, ct.antiVehicle);
    if (bonus?.air && bonus.air > 1) return Math.max(0.04, ct.antiAir);
    return (ROSTER_SHARE[t] ?? 0.1) * (ctx.prof.pref[t] ?? 1) * (1 - 0.4 * Math.min(1, ct.vehRatio + ct.airRatio));
  };
  const avail = (t: UnitTypeId) => (!UNITS[t].tech || hasTech(s, f, UNITS[t].tech!)) && (UNITS[t].compute === undefined || computePower(s, f) >= UNITS[t].compute!);
  let best: UnitTypeId | null = null, bs = -Infinity;
  for (const t of roster) {
    if (!avail(t)) continue;
    // Kult: ohne Rekrutierer kein Nachschub / cult: no reinforcements without recruiters
    const preachers = ctx.my.filter((u) => (CULT.recruiters[u.type] ?? []).length > 0).length;
    let sc = (shareOf(t) - count(t) / army) * 4 - UNITS[t].cost! / 250;
    if ((CULT.recruiters[t] ?? []).length > 0 && preachers < 3) sc += 1;
    // Propheten rufen alles, einer reicht fuer den Anfang / prophets call up everything, one is enough to start with
    if (t === 'prophet' && !count('prophet')) sc += 0.8;
    if (urgent) sc = UNITS[t].hp * 0.05 + UNITS[t].attack * 0.2 - UNITS[t].cost! / 100;
    if (sc > bs) { bs = sc; best = t; }
  }
  return best;
}

/** Zyrr: Armeemischung aus Alien-Einheiten / Zyrr: army mix of alien units */
function chooseAlienUnit(ctx: Ctx, urgent: boolean): UnitTypeId | null {
  const army = Math.max(1, ctx.my.length);
  const count = (t: UnitTypeId) => ctx.my.filter((u) => u.type === t).length;
  if (urgent) return ctx.fa.stars >= UNITS.mech.cost! ? 'mech' : 'grey';
  const share: Partial<Record<UnitTypeId, number>> = {
    grey: 0.35, terraformer: army >= 3 ? 0.12 : 0.05, skimmer: ctx.fa.explored.some((e) => !e) ? 0.15 : 0.08,
    mech: 0.22, tripod: ctx.hostileCities.length ? 0.18 : 0.05,
  };
  let best: UnitTypeId | null = null, bs = -Infinity;
  for (const t of ALIEN_UNITS) {
    const sc = ((share[t] ?? 0) * (ctx.prof.pref[t] ?? 1) - count(t) / army) * 4 - UNITS[t].cost! / 250;
    if (sc > bs) { bs = sc; best = t; }
  }
  return best;
}

/** Unverbundene Stadt: erstes fehlendes Strassenfeld / unconnected city: first missing road tile */
function roadPlans(ctx: Ctx): { x: number; y: number; b: BuildingId; need: number }[] {
  const { s, f, size } = ctx;
  const hq = hqOf(s, f);
  if (!hq) return [];
  const n = size * size;
  const own = (k: number) => territoryOwner(s, s.tiles[k]) === f;
  const connector = (k: number) => {
    const t = s.tiles[k];
    if (t.cityId !== null) return cityById(s, t.cityId)!.owner === f;
    return own(k) && (t.road || t.building === 'bridge' || t.building === 'navalBase');
  };
  const out: { x: number; y: number; b: BuildingId; need: number }[] = [];
  for (const c of ctx.myCities) {
    if (c.connected || c.id === hq.id) continue;
    // 0-1-Dijkstra von der Stadt zum verbundenen Netz (HQ) / 0-1 search from the city to the HQ network
    const d = new Float32Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const start = idx(size, c.x, c.y);
    const target = idx(size, hq.x, hq.y);
    d[start] = 0;
    const dq: number[] = [start];
    while (dq.length) {
      dq.sort((a, b) => d[a] - d[b]);
      const k = dq.shift()!;
      if (k === target) break;
      for (const p of neighbors(size, k % size, (k / size) | 0)) {
        const a = p.y * size + p.x;
        if (!own(a) && a !== target) continue;
        const t = s.tiles[a];
        let cost: number;
        if (connector(a)) cost = 0;
        else if (isLand(t) && !t.feature && !t.grandProject && !t.outpost && t.cityId === null) cost = 1;
        else if (isWater(t) && t.terrain === 'shallow' && !t.building && neighbors(size, p.x, p.y).filter((q) => isLand(s.tiles[idx(size, q.x, q.y)])).length >= 2 && !unitAt(s, p.x, p.y)) cost = 1.7;
        else continue;
        if (d[k] + cost < d[a]) { d[a] = d[k] + cost; prev[a] = k; dq.push(a); }
      }
    }
    if (!Number.isFinite(d[target]) || d[target] > 3.5) continue;
    let k = prev[target];
    while (k !== -1 && k !== start) {
      if (!connector(k)) {
        const t = s.tiles[k];
        out.push({ x: k % size, y: (k / size) | 0, b: isWater(t) ? 'bridge' : 'road', need: d[target] });
        break;
      }
      k = prev[k];
    }
  }
  return out;
}

export function planPurchase(ctx: Ctx, failed: Failed): Command | null {
  const { s, f, fa, prof } = ctx;
  const stars = fa.stars;
  const inc = income(s, f);
  const buys: Buy[] = [];
  const popVal = 10 * prof.buildW * (fa.id === 'meridon' ? 1.2 : 1) * (ctx.points ? 1 + Math.min(0.6, 0.02 * ctx.roundsLeft) : 1);
  const finalRound = ctx.points && ctx.roundsLeft === 0;

  // Ausbildung / training
  const deficit = ctx.desiredArmy - ctx.my.length;
  // Sold: neue Einheiten nur, wenn das Netto-Einkommen sie traegt / upkeep: new units only if net income carries them
  const net = netIncome(s, f);
  // Korvat: Fraktionsfaktor auf den Sold (UPKEEP.faction) / Korvat: faction factor on upkeep (UPKEEP.faction)
  const upFor = (t: UnitTypeId) => (ctx.my.length >= UPKEEP.freeUnits ? (UPKEEP.flat[t] ?? Math.ceil((UNITS[t].cost ?? 0) * UPKEEP.share)) * upkeepFactor(s, f) : 0);
  // Kult bildet in Staedten nicht aus / the cult does not train in cities
  for (const c of isCultFaction(s, f) ? [] : ctx.myCities) {
    if (unitAt(s, c.x, c.y) || supportedUnits(s, c) >= unitLimit(s, c)) continue;
    const urgent = ctx.enemies.some((e) => dist(e, c) <= 2 && UNITS[e.type].attack > 0);
    const type = chooseUnitType(ctx, c, urgent);
    if (!type) continue;
    const front = ctx.hostileCities.length ? Math.min(...ctx.hostileCities.map((h) => dist(h, c))) : 10;
    const mk = (t: UnitTypeId, factor: number) => {
      if (trainCheck(s, c, t) !== 'ok' && trainCheck(s, c, t) !== 'notEnoughStars') return;
      const cost = unitCost(s, f, t)!;
      // zwei Einheiten kosten doppelten Sold / two units cost double upkeep
      if (!urgent && net - upFor(t) * (twinCheck(s, c, t) === 'twin' ? 2 : 1) < 0) return;
      let value: number;
      if (urgent) value = cost * 3.5;
      else if (deficit > 0) value = cost * (1.15 + 0.08 * Math.min(deficit, 5)) * prof.militaryW;
      else value = cost * 0.25;
      // Menschen: die erste Einheit einer neuen Produktionsstaette (ausser der Kaserne) zuegig ausbilden, fuer eine gemischte Armee
      // humans: train the first unit of a new production site (except the barracks) promptly, for a mixed army
      const site = usesSites(s, f) ? siteOf(t) : null;
      if (!urgent && s.round >= 3 && site && site !== 'trainingCamp' && !ctx.my.some((u) => siteOf(u.carried ?? u.type) === site)) value = Math.max(value, cost * 2.2);
      // Meridon "Zwei fuer einen": doppelter Wert, wenn beide passen; sonst waere der zweite Platz verschenkt
      // Meridon "Two for One": double value if both fit; otherwise the second slot would be wasted
      if (twinCheck(s, c, t) === 'twin') value *= AI.twinValue;
      value = value * factor + cost * ctx.pf - front * 0.05;
      buys.push({ cmd: { type: 'train', city: c.id, unitType: t }, cost, value, save: !urgent });
    };
    mk(type, 1);
    const cheap: UnitTypeId = ROSTERS[fa.id]?.infantry ?? 'infantry';
    if (type !== cheap) mk(cheap, 0.8);
    // Menschen: je neuer Staette dieser Stadt (ohne Kaserne) die erste Einheit anbieten, auch wenn der Wunschtyp ein anderer ist
    // humans: offer the first unit of each new site of this city (except the barracks), even if the desired type is another one
    if (usesSites(s, f) && !urgent && s.round >= 3) {
      for (const site of citySites(s, c)) {
        if (site === 'trainingCamp' || ctx.my.some((u) => siteOf(u.carried ?? u.type) === site)) continue;
        const first = rosterUnits(s, f).find((t) => siteOf(t) === site && t !== type && UNITS[t].attack > 0 && trainCheck(s, c, t) !== 'buildingMissing' && trainCheck(s, c, t) !== 'invalid');
        if (first) mk(first, 1);
      }
    }
  }
  // Kult: Rekrutierer rufen bis zum Limit neue Einheiten auf Nachbarfelder / cult: recruiters call up new units onto adjacent tiles up to the cap
  // Kult: Horde und Limit einmal je Planung / cult: horde and cap once per planning
  const horde = isCultFaction(s, f) ? hordeCount(s, f) : null;
  if (horde) {
    const free = horde.cap - horde.units;
    for (const u of free > 0 ? ctx.my : []) {
      const types = recruitTypes(u).filter((t) => !UNITS[t].abilities.includes('wonder'));
      if (!types.length || u.exhausted || u.fresh || u.attacked || recruitWait(s, u) > 0) continue;
      const urgent = ctx.enemies.some((e) => dist(e, u) <= 2 && UNITS[e.type].attack > 0);
      // Wunschtyp und billigster Typ des Rekrutierers / desired type and the recruiter's cheapest type
      const cheap = types.slice().sort((a, b) => unitCost(s, f, a)! - unitCost(s, f, b)!)[0];
      const want = chooseRosterUnit(ctx, urgent, types);
      [want, cheap].forEach((t, i) => {
        if (!t || (i === 1 && t === want)) return;
        const spot = recruitSpot(s, u, t, horde);
        const p = spot ?? neighbors(s.size, u.x, u.y).find((q) => recruitCheck(s, f, u.id, t, q.x, q.y, horde) === 'notEnoughStars');
        if (!p) return;
        const cost = unitCost(s, f, t)!;
        // wie Ausbildung: Bedarf aus der Wunschgroesse der Horde / like training: demand from the desired horde size
        let value = urgent ? cost * 3.5 : deficit > 0 ? cost * (1.15 + 0.08 * Math.min(deficit, 5)) * prof.militaryW : cost * 0.25;
        value = value * (i === 0 ? 1 : 0.85) + cost * ctx.pf;
        buys.push({ cmd: { type: 'recruit', unit: u.id, unitType: t, x: p.x, y: p.y }, cost, value, save: !urgent });
      });
    }
  }

  // Gebaeude / buildings
  const counters = counterShares(ctx);
  for (const c of ctx.myCities) {
    for (const p of cityTiles(s, c)) {
      for (const b of POP_BUILDINGS) {
        if (!siteOk(s, f, b, p.x, p.y)) continue;
        const chk = buildCheck(s, f, b, p.x, p.y);
        if (!chk.ok && chk.error !== 'notEnoughStars') continue;
        let value: number;
        if (b === 'logisticsCenter') {
          let srcs = 0;
          for (const q of neighbors(s.size, p.x, p.y)) { const bb = s.tiles[idx(s.size, q.x, q.y)].building; if (bb && LOGISTICS_SOURCES.includes(bb)) srcs++; }
          value = srcs * 5 * Math.min(8, ctx.roundsLeft) * 0.8;
        } else if (b === 'researchCenter') {
          if (!ctx.points || ctx.roundsLeft < 4) continue;
          value = popVal + Math.min(300, 100 + Math.floor(ctx.roundsLeft / 3) * 50) * ctx.pf * 1.2;
        } else if (b === 'navalBase') {
          const coastLand = neighbors(s.size, p.x, p.y).some((q) => territoryOwner(s, s.tiles[idx(s.size, q.x, q.y)]) === f && isLand(s.tiles[idx(s.size, q.x, q.y)]));
          if (!coastLand) continue;
          const haveBase = ctx.navalOwn.some((v) => v === 1);
          value = popVal + (ctx.navalNeed && !haveBase ? 60 : 0);
        } else {
          const pop = popGain(s, f, b, p.x, p.y);
          if (pop <= 0) continue;
          // Rohstoff fuer eine gewuenschte Staette (Panzerwerk, Geschuetzgiesserei) / raw material for a wanted site (tank works, foundry)
          value = pop * popVal + materialBonus(ctx, c, b, counters);
        }
        if (prof.sloppy > 0) value *= 1 + (hashNoise(p.x, p.y, s.round) - 0.5) * prof.sloppy;
        buys.push({ cmd: { type: 'build', building: b, x: p.x, y: p.y }, cost: chk.cost, value, save: true });
      }
    }
  }
  // Produktionsstaetten (Menschen) / production sites (humans)
  buys.push(...productionBuys(ctx, popVal, counters));
  // Einzigartiges Gebaeude der Fraktion / the faction's unique building
  const ub = UNIQUE.buildings[fa.id];
  if (ub) {
    const horizon = ctx.points ? ctx.roundsLeft : 20;
    for (const c of ctx.myCities) {
      for (const p of cityTiles(s, c)) {
        const chk = buildCheck(s, f, ub, p.x, p.y);
        if (!chk.ok && chk.error !== 'notEnoughStars') continue;
        let value = popVal;
        if (ub === 'kolkhoz') value += popVal * 0.6 * Math.floor(Math.min(horizon, 24) / UNIQUE.kolkhozInterval);
        else if (ub === 'mercenaryBarracks') value = hasCityUpgrade(c, 'barracks') || c.level < 2 ? 0 : value + chk.cost * (0.3 + 0.08 * Math.min(4, c.level)) * prof.militaryW;
        // Lichtdom: Busszehnt je Suender (mindestens einer erwartet) / Cathedral of Light: penance tithe per sinner (at least one expected)
        else if (ub === 'embassyPalace') value += (UNIQUE.cathedralBase + UNIQUE.cathedralPerSinner * Math.max(1, Math.min(UNIQUE.cathedralMaxSinners, sinnerCount(s, f)))) * Math.min(horizon, 15) * 0.45;
        else if (ub === 'tradingPost') value += UNIQUE.tradingPostPerHarbour * harbourCities(s, f) * Math.min(horizon, 15) * 0.45;
        else if (ub === 'testLab') value += TECH_IDS.filter((t) => !fa.techs.includes(t)).length * UNIQUE.testLabDiscount * 45 * Math.min(1, horizon / 12);
        if (value <= 0) continue;
        if (prof.sloppy > 0) value *= 1 + (hashNoise(p.x, p.y, s.round, 7) - 0.5) * prof.sloppy;
        buys.push({ cmd: { type: 'build', building: ub, x: p.x, y: p.y }, cost: chk.cost, value, save: true });
      }
    }
  }
  // Ressourcengebaeude der Fraktion (auch als Ausbau) / the faction's resource building (also as an upgrade)
  {
    const rb = RESOURCE.buildings[fa.id];
    const horizon = ctx.points ? ctx.roundsLeft : 20;
    for (const c of ctx.myCities) {
      for (const p of cityTiles(s, c)) {
        if (!resourceSiteOk(s, rb, p.x, p.y)) continue;
        const chk = buildCheck(s, f, rb, p.x, p.y);
        if (!chk.ok && chk.error !== 'notEnoughStars') continue;
        let value = resourceValue(ctx, c, rb, p.x, p.y, popVal, horizon);
        if (value <= 0) continue;
        if (prof.sloppy > 0) value *= 1 + (hashNoise(p.x, p.y, s.round, 11) - 0.5) * prof.sloppy;
        buys.push({ cmd: { type: 'build', building: rb, x: p.x, y: p.y }, cost: chk.cost, value, save: true });
      }
    }
  }

  // Strassen / roads
  // Kult: Verbindungen bringen nichts (keine Bevoelkerung) / cult: connections bring nothing (no population)
  if (hasTech(s, f, 'roadbuilding') && !isCultFaction(s, f)) {
    for (const r of roadPlans(ctx)) {
      const chk = buildCheck(s, f, r.b, r.x, r.y);
      if (!chk.ok && chk.error !== 'notEnoughStars') continue;
      buys.push({ cmd: { type: 'build', building: r.b, x: r.x, y: r.y }, cost: chk.cost, value: (2 * popVal + 8) / Math.max(1, r.need), save: false });
    }
  }

  // Zyrr: Terraformen und Xeno-Gebaeude / Zyrr: terraforming and xeno buildings
  if (isAlienFaction(s, f)) {
    for (const c of ctx.myCities) {
      for (const p of cityTiles(s, c)) {
        const t = s.tiles[idx(s.size, p.x, p.y)];
        if (!t.xeno) {
          if (terraformCheck(s, f, p.x, p.y) !== 'ok' && terraformCheck(s, f, p.x, p.y) !== 'notEnoughStars') continue;
          // Stadtfeld zuerst (sonst keine Ausbildung), dann Ressourcen, dann der Rest
          // city tile first (otherwise no training), then resources, then the rest
          // Terraformen ohne Ressource erst, wenn die Armee steht / terraforming without a resource only once the army stands
          const armyOk = ctx.my.length >= ctx.myCities.length * ctx.prof.armyPerCity;
          const value = t.cityId !== null ? 200 : t.resource ? 2 * popVal * 0.6 + 6 : armyOk ? popVal * 0.5 + 4 : popVal * 0.15;
          buys.push({ cmd: { type: 'terraform', x: p.x, y: p.y }, cost: XENO.terraformCost, value, save: t.cityId !== null ? false : true });
          continue;
        }
        for (const b of ['xenoHive', 'xenoHarvester'] as BuildingId[]) {
          const chk = buildCheck(s, f, b, p.x, p.y);
          if (!chk.ok && chk.error !== 'notEnoughStars') continue;
          buys.push({ cmd: { type: 'build', building: b, x: p.x, y: p.y }, cost: chk.cost, value: BUILDINGS[b].pop * popVal, save: true });
        }
      }
    }
  }

  // Kult: Schrein; NEXUS: Rechenzentren und Kraftwerke / cult: shrine; NEXUS: data centers and power plants
  if (isCultFaction(s, f) || isRobotFaction(s, f)) {
    const cs = computeStats(s, f);
    const list: BuildingId[] = isCultFaction(s, f) ? ['shrine'] : ['dataCenter', 'powerPlant'];
    for (const c of ctx.myCities) {
      for (const p of cityTiles(s, c)) {
        for (const b of list) {
          const chk = buildCheck(s, f, b, p.x, p.y);
          if (!chk.ok && chk.error !== 'notEnoughStars') continue;
          let value = BUILDINGS[b].pop * popVal;
          // Schrein: Plaetze, wertvoll, wenn das Limit bald voll ist / shrine: slots, valuable once the cap is nearly full
          if (b === 'shrine' && horde) value = CULT.shrineSlots * (horde.cap - horde.units <= 1 ? 22 : 6) * prof.militaryW;
          // Rechenleistung ausgleichen / balance compute
          if (b === 'dataCenter') value += cs.dataCenters <= cs.powerPlants ? 30 : 0;
          if (b === 'powerPlant') value += cs.powerPlants < cs.dataCenters ? 40 : 0;
          buys.push({ cmd: { type: 'build', building: b, x: p.x, y: p.y }, cost: chk.cost, value, save: true });
        }
      }
    }
  }

  // Siegbedingung: Technologie, Wunder, Bohrer / victory condition: tech, wonder, drill
  victoryBuys(ctx, buys);

  // Forschung / research
  const sites = siteCounts(ctx);
  // erobertes fremdes Hauptquartier zaehlt wie jede andere Stadt / a captured foreign HQ counts like any other city
  const unconnected = ctx.myCities.filter((c) => !c.connected && !(c.isHQ && c.hqOf === f)).length;
  for (const t of TECH_IDS) {
    if (!canResearch(s, f)) break;
    if (fa.techs.includes(t)) continue;
    const parent = TECHS[t].parent;
    if (parent && !fa.techs.includes(parent)) continue;
    let value = techValue(ctx, t, sites, unconnected);
    if (prof.sloppy > 0) value *= 1 + (hashNoise(TECH_IDS.indexOf(t), s.round, f) - 0.5) * prof.sloppy * 1.5;
    buys.push({ cmd: { type: 'research', tech: t }, cost: researchCost(s, f, t), value, save: true });
  }

  // Stadt-Ausbauten: Bunker an der Front, Kaserne in Ausbildungsstaedten, Funkturm bei viel Nebel
  // city upgrades: bunker at the front, barracks in training cities, radio tower when much is hidden
  for (const c of ctx.myCities) {
    const front = ctx.enemies.some((e) => dist(e, c) <= 3 && UNITS[e.type].attack > 0);
    for (const up of CITY_UPGRADE_IDS) {
      const uc = cityUpgradeCheck(s, f, c, up);
      if (uc !== 'ok' && uc !== 'notEnoughStars' && uc !== 'invalidTarget') continue;
      const cost = CITY_UPGRADES.cost[up];
      let value = 0;
      let cmd: Command = { type: 'cityUpgrade', city: c.id, upgrade: up };
      if (up === 'bunker') value = front ? cost * 2.2 : cost * 0.25;
      else if (up === 'depot') value = CITY_UPGRADES.depotIncome * Math.min(ctx.points ? ctx.roundsLeft : 20, 20) * 0.45;
      else if (up === 'hospital') value = front ? cost * 1.2 : cost * 0.3;
      else if (up === 'flak') value = ctx.enemies.some((e) => (e.type === 'heli' || e.type === 'octocopter') && dist(e, c) <= 4) ? cost * 2 : cost * 0.1;
      // Satelliten-Relay (Velkar): Wert aus ai/orbital.ts / satellite relay (Velkar): value from ai/orbital.ts
      else if (up === ORBITAL.relay) { value = relayValue(ctx, c); if (!value) continue; }
      else if (up === 'barracks') value = cityTiles(s, c).some((p) => s.tiles[idx(s.size, p.x, p.y)].building === 'mercenaryBarracks') ? 0 : cost * (0.55 + 0.1 * Math.min(4, c.level)) * prof.militaryW;
      else {
        const targets = radioTargets(s, f, c);
        if (!targets.length) continue;
        // Ziel mit den meisten unerforschten Feldern / target with most unexplored tiles
        let best = targets[0], bestN = -1;
        for (const p of targets) {
          let n = 0;
          for (let dy = -CITY_UPGRADES.radioRadius; dy <= CITY_UPGRADES.radioRadius; dy++) for (let dx = -CITY_UPGRADES.radioRadius; dx <= CITY_UPGRADES.radioRadius; dx++) {
            const x = p.x + dx, y = p.y + dy;
            if (x >= 0 && y >= 0 && x < s.size && y < s.size && !fa.explored[idx(s.size, x, y)]) n++;
          }
          if (n > bestN) { bestN = n; best = p; }
        }
        value = bestN * 1.1;
        cmd = { type: 'cityUpgrade', city: c.id, upgrade: up, target: best };
      }
      if (prof.difficulty === 'easy') value *= 0.5;
      buys.push({ cmd, cost, value, save: up !== 'bunker' || !front });
    }
  }

  // Stufe kaufen: so viel wert wie die Bevoelkerung, die der Aufstieg sonst braucht (popVal je Punkt), plus Platz fuer
  // Einheiten, wenn die Stadt voll ist und Truppen fehlen. Der Preis ist gut doppelt so hoch, also kauft die KI erst, wenn
  // sie reich ist (minRatio sinkt mit dem Vorrat); nicht in bedrohten Staedten.
  // buy level: worth as much as the population the level-up would otherwise need (popVal per point), plus room for units
  // when the city is full and troops are missing. The price is a good twice as high, so the AI only buys when rich
  // (minRatio falls with the treasury); not in threatened cities.
  for (const c of ctx.myCities) {
    const chk = buyLevelCheck(s, f, c);
    if (chk !== 'ok' && chk !== 'notEnoughStars') continue;
    if (ctx.enemies.some((e) => dist(e, c) <= 2 && UNITS[e.type].attack > 0)) continue;
    let value = levelUpCost(s, c) * popVal * 0.9;
    if (deficit > 0 && supportedUnits(s, c) >= unitLimit(s, c)) value += 15 * prof.militaryW;
    if (prof.difficulty === 'easy') value *= 0.5;
    buys.push({ cmd: { type: 'buyLevel', city: c.id }, cost: buyLevelCost(c), value, save: false });
  }

  // Botschaften / embassies
  if (hasTech(s, f, 'intelligence')) {
    for (const g of fa.contacts) {
      if (fa.embassies.includes(g) || !s.factions[g].alive) continue;
      const hq = hqOf(s, g);
      if (!hq || !fa.explored[idx(s.size, hq.x, hq.y)]) continue;
      const value = 10 * Math.min(ctx.roundsLeft, 15) * 0.45 * prof.embassyW;
      buys.push({ cmd: { type: 'diplomacy', action: 'embassy', target: g }, cost: embassyCost(s, f), value, save: true });
    }
  }

  // Schiffe aufruesten / upgrade ships
  for (const u of ctx.my) {
    if (!isShip(u) || u.fresh) continue;
    const to = bestShip(ctx, u);
    if (!to) continue;
    const chk = upgradeCheck(s, u, to);
    if (chk !== 'ok' && chk !== 'notEnoughStars') continue;
    const cost = shipUpgradeCost(s, f, to);
    const near = ctx.enemies.some((e) => dist(e, u) <= 4);
    if (!near) continue; // nur fuer Gefechte / only for combat
    const value = cost * 1.0;
    buys.push({ cmd: { type: 'upgrade', unit: u.id, to }, cost, value, save: false });
  }

  buys.sort((a, b) => b.value / Math.max(1, b.cost) - a.value / Math.max(1, a.cost) || (cmdKey(a.cmd) < cmdKey(b.cmd) ? -1 : 1));
  // Reichtum senkt die Schwelle / wealth lowers the threshold
  const minRatio = finalRound ? 0.01 : 0.45 * Math.min(1, 150 / Math.max(1, stars));
  // Meridon mit Monopol und vollem Speicher: nur noch Dringendes kaufen / Meridon with the monopoly and a full treasury: only urgent buys
  const hoard = fa.id === 'meridon' && factionVictoryOn(s) && hasTech(s, f, victoryTechOf(s, f)) && stars >= meridonNeed(s) * WONDERS.aiMeridonHoardShare;
  for (const b of buys) {
    if (failed.has(cmdKey(b.cmd))) continue;
    const ratio = b.value / Math.max(1, b.cost);
    if (hoard && ratio < 3) continue;
    if (ratio < minRatio) break;
    if (b.cost <= stars) return b.cmd;
    // sparen fuer Lohnendes / save for something worthwhile
    if (prof.saving && b.save && !finalRound && ratio >= 1 && b.cost <= stars + inc * (b.horizon ?? 1.5)) return null;
  }
  return null;
}

/**
 * Siegbedingung der KI: Siegtechnologie ab der Spielmitte, dann das Wunder auf einem sicheren Bauplatz bzw. den Bohrer in einer ruhigen Stadt.
 * AI victory condition: the victory tech from mid game, then the wonder on a safe site or the drill in a quiet city.
 */
function victoryBuys(ctx: Ctx, buys: Buy[]) {
  const { s, f, fa } = ctx;
  if (!factionVictoryOn(s)) return;
  const tech = victoryTechOf(s, f);
  if (!fa.techs.includes(tech)) {
    const parent = TECHS[tech].parent;
    // Kult: der Bohrer braucht 14 Runden, also frueher forschen / cult: the drill needs 14 rounds, so research earlier
    const from = isCultFaction(s, f) ? AI.cultDrillResearchRound : WONDERS.aiResearchRound;
    if (s.round < from || (parent && !fa.techs.includes(parent)) || researchAllowed(s, f, tech) !== 'ok') return;
    // Korvat: nur, wenn das Staedteziel in Reichweite ist / Korvat: only when the city target is within reach
    if (fa.id === 'korvat' && ownCities(s, f).length < korvatNeed(s) * WONDERS.aiKorvatResearchShare) return;
    const cost = researchCost(s, f, tech);
    buys.push({ cmd: { type: 'research', tech }, cost, value: cost * 2.5, save: true, horizon: WONDERS.aiSaveRounds });
    return;
  }
  const kind = wonderKindOf(s, f);
  if (!kind || wondersOf(s, f).length) return;
  if (kind === 'coreDrill') {
    // erst mit Hinterland und Horde: allein wird der Bohrer sofort angegriffen / only with a hinterland and a horde: alone the drill is attacked at once
    if (ctx.myCities.length < WONDERS.aiDrillMinCities) return;
    // ein Prophet im eigenen Gebiet, moeglichst weit weg von Gegnern, ruft ihn auf ein freies Nachbarfeld
    // a prophet in own territory, as far from enemies as possible, calls it onto a free adjacent tile
    let best: { u: Unit; x: number; y: number } | null = null, bv = -Infinity;
    for (const u of ctx.my) {
      if (!recruitTypes(u).includes('coreDrill')) continue;
      for (const q of neighbors(s.size, u.x, u.y)) {
        const r = recruitCheck(s, f, u.id, 'coreDrill', q.x, q.y);
        if (r !== 'ok' && r !== 'notEnoughStars') continue;
        let d = 8;
        for (const e of ctx.enemies) if (UNITS[e.type].attack > 0) d = Math.min(d, dist(e, q));
        const own = territoryOwner(s, s.tiles[idx(s.size, q.x, q.y)]) === f;
        // eigenes Gebiet oder weit weg von Gegnern / own territory or far away from enemies
        if (!own && d < 4) continue;
        const v = Math.min(6, d) * 3 + (own ? 6 : 0);
        if (v > bv) { bv = v; best = { u, x: q.x, y: q.y }; }
      }
    }
    if (best) buys.push({ cmd: { type: 'recruit', unit: best.u.id, unitType: 'coreDrill', x: best.x, y: best.y }, cost: unitCost(s, f, 'coreDrill')!, value: WONDERS.cost.coreDrill * 3, save: true, horizon: WONDERS.aiSaveRounds });
    return;
  }
  const sites = wonderSites(s, f, kind as WonderKind, true);
  let best: { x: number; y: number } | null = null, bv = -Infinity;
  for (const p of sites) {
    let de = 12, dh = 12, dc = 12;
    for (const e of ctx.enemies) if (UNITS[e.type].attack > 0) de = Math.min(de, dist(e, p));
    for (const c of ctx.hostileCities) dh = Math.min(dh, dist(c, p));
    for (const c of ctx.myCities) dc = Math.min(dc, dist(c, p));
    const v = Math.min(6, de) * 3 + Math.min(6, dh) * 2 - dc * 1.5 - ctx.threat[p.y * s.size + p.x].length * 5;
    if (v > bv) { bv = v; best = p; }
  }
  if (!best) return;
  buys.push({ cmd: { type: 'wonder', kind: kind as WonderKind, x: best.x, y: best.y }, cost: WONDERS.cost[kind], value: WONDERS.cost[kind] * 3, save: true, horizon: WONDERS.aiSaveRounds });
}

function bestShip(ctx: Ctx, u: Unit): UnitTypeId | null {
  const { s, f } = ctx;
  // Meridon: Kaperschiff vor Zerstoerer / Meridon: privateer before destroyer
  const order: UnitTypeId[] = UNIQUE.units[ctx.fa.id] === 'privateer' ? ['battleship', 'privateer', 'destroyer', 'submarine'] : ['battleship', 'destroyer', 'submarine'];
  const rank = (t: UnitTypeId) => (t === 'landingBoat' ? 0 : order.length - order.indexOf(t));
  for (const t of order) {
    // Menschen: Staette im Gebiet unter dem Schiff; sonst Forschung / humans: site in the territory under the ship; otherwise research
    if (usesSites(s, f)) {
      const chk = upgradeCheck(s, u, t);
      if (chk !== 'ok' && chk !== 'notEnoughStars') continue;
    } else {
      const tech = UNITS[t].tech;
      if (tech && !hasTech(s, f, tech)) continue;
    }
    if (rank(t) <= rank(u.type)) return null;
    return t;
  }
  return null;
}
