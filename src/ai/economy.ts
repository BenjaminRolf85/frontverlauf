/**
 * Wirtschaft und Diplomatie: Belohnungen, Forschung, Gebaeude, Ausbildung, Botschaften, Frieden.
 * Economy and diplomacy: rewards, research, buildings, training, embassies, peace.
 */
import {
  aliveFactions, buildCheck, cityUpgradeCheck, radioTargets, cityById, cityTiles, dist, embassyCost, grandProjectCheck, hasTech, hqOf, idx,
  income, isLand, isShip, isWater, neighbors, researchCost, supportedUnits, territoryOwner, trainCheck, unitAt,
  unitCost, unitLimit, upgradeCheck, type City, type Command, type GameState, type Unit,
} from '../core';
import {
  BUILDINGS, CITY_UPGRADES, CITY_UPGRADE_IDS, GRAND_PROJECT_IDS, LAND_UNITS, LOGISTICS_SOURCES, RESEARCH_CENTER_TECH, TECHS, TECH_IDS, UNITS,
  type BuildingId, type TechId, type UnitTypeId,
} from '../data/balance';
import { worth, type Ctx } from './analysis';
import { hashNoise } from './profile';
import { cmdKey } from './tactics';

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
      // Ausdehnung, wenn genug neue Felder / expand if enough new tiles
      let free = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= s.size || y >= s.size) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 2 && s.tiles[idx(s.size, x, y)].territory === null) free++;
      }
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
    for (const u of ctx.my) v += worth(u);
    return v;
  }
  let v = 0;
  for (const c of s.cities) if (c.owner === g && ctx.fa.explored[idx(s.size, c.x, c.y)]) v += 25;
  for (const u of s.units) {
    if (u.owner !== g) continue;
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
    if (!ctx.s.factions[g]?.alive || !fa.contacts.includes(g) || fa.relations[g] !== 'war') continue;
    const mine = strength(ctx, ctx.f), theirs = strength(ctx, g);
    let accept: boolean;
    if (prof.difficulty === 'easy') accept = true;
    else if (ctx.conquest) accept = focusPeace(ctx, g) || (mine < theirs * 0.7 && aliveFactions(ctx.s).length > 2 && ctx.s.round <= 60);
    else accept = mine < theirs * 1.4 || warCount(ctx) >= 2;
    const cmd: Command = { type: 'diplomacy', action: accept ? 'acceptPeace' : 'declinePeace', target: g };
    if (!failed.has(cmdKey(cmd))) return cmd;
  }
  return null;
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
    if (!ga.alive) continue;
    const mine = strength(ctx, f), theirs = strength(ctx, g);
    const rel = fa.relations[g];
    if (rel === 'war' && prof.difficulty !== 'easy' && (s.round + f) % 4 === 0 && !ga.peaceOffers.includes(f) && !fa.peaceOffers.includes(g)) {
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
      const brk = ctx.conquest
        ? alive <= 2 || noWar || s.round > 60
        : prof.difficulty === 'extreme' && mine > theirs * 2 && ctx.roundsLeft > 8;
      if (brk) {
        const cmd: Command = { type: 'diplomacy', action: 'announceBreak', target: g };
        if (!failed.has(cmdKey(cmd))) return cmd;
      }
    }
  }
  return null;
}

// ---------- Kaeufe / purchases ----------

interface Buy { cmd: Command; cost: number; value: number; save: boolean }

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
  if (st.adjacency) for (const n of neighbors(s.size, x, y)) if (s.tiles[idx(s.size, n.x, n.y)].building === st.adjacency.building) p += st.adjacency.pop;
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

function techBase(ctx: Ctx, t: TechId, sites: Record<BuildingId, number>, unconnected: number): number {
  const { prof } = ctx;
  const popVal = 10 * prof.buildW;
  let econ = 0;
  for (const b of POP_BUILDINGS) {
    if (BUILDINGS[b].tech !== t || b === 'researchCenter') continue;
    if (b === 'logisticsCenter') { econ += Math.min(3, sites[b]) * 12; continue; }
    if (b === 'navalBase') { econ += ctx.navalNeed ? 45 : Math.min(1, sites[b]) * 4; continue; }
    econ += Math.min(5, sites[b]) * (BUILDINGS[b].pop || 1) * popVal * 0.45;
  }
  let mil = (MIL[t] ?? 0) * prof.militaryW * (ctx.conquest ? 1.3 : 1);
  if (t === 'ballistics' && ctx.hostileCities.length) mil += 12;
  if (t === 'intelligence') mil += ctx.fa.contacts.length * 12 * prof.embassyW;
  if (t === 'roadbuilding') mil += unconnected * 12;
  if (t === 'mountainTraining' || t === 'highAltitude') {
    let m = 0;
    for (const c of ctx.myCities) for (const p of cityTiles(ctx.s, c)) if (ctx.s.tiles[idx(ctx.s.size, p.x, p.y)].terrain === 'mountain') m++;
    mil += m * 2;
  }
  if ((t === 'shipbuilding' || t === 'diving') && ctx.navalNeed) mil += 10;
  if (ctx.points && ctx.roundsLeft >= 6 && Object.values(RESEARCH_CENTER_TECH).includes(t)) mil += 10;
  return econ + mil;
}

function techValue(ctx: Ctx, t: TechId, sites: Record<BuildingId, number>, unconnected: number): number {
  let v = techBase(ctx, t, sites, unconnected);
  let child = 0;
  for (const c of TECH_IDS) if (TECHS[c].parent === t) child = Math.max(child, techBase(ctx, c, sites, unconnected));
  v += child * 0.45;
  v += ctx.pf * 100 * TECHS[t].tier;
  return v * ctx.prof.researchW;
}

/** Wunschtyp fuer eine Stadt / desired unit type for a city */
export function chooseUnitType(ctx: Ctx, c: City, urgent: boolean): UnitTypeId | null {
  const { s, f, prof } = ctx;
  const count = (t: UnitTypeId) => ctx.my.filter((u) => u.type === t || u.carried === t).length;
  const army = Math.max(1, ctx.my.length);
  const unexplored = ctx.fa.explored.some((e) => !e);
  const avail = (t: UnitTypeId) => UNITS[t].cost !== null && (!UNITS[t].tech || hasTech(s, f, UNITS[t].tech!));
  // Zielanteile der Armee / target shares of the army
  const share: Partial<Record<UnitTypeId, number>> = {
    infantry: avail('mg') ? 0.15 : 0.45,
    mg: 0.35,
    jeep: unexplored ? 0.2 : 0.08,
    sniper: 0.06,
    pioneer: 0.05,
    artillery: ctx.hostileCities.length ? 0.16 : 0.04,
    medic: army >= 4 ? 0.08 : 0,
    spy: ctx.hostileCities.length && army >= 4 ? 0.06 : 0,
    heli: army >= 4 ? 0.1 : 0,
  };
  // Qualitaet je Typ / quality per type
  const quality: Partial<Record<UnitTypeId, number>> = {
    infantry: 0.5, mg: 1, jeep: 0.6, sniper: 0.6, pioneer: 0.5, artillery: 0.9, medic: 0.8, spy: 0.6, heli: 0.9,
  };
  let best: UnitTypeId | null = null;
  let bs = -Infinity;
  for (const t of LAND_UNITS) {
    if (!avail(t)) continue;
    if (urgent && !['infantry', 'mg', 'pioneer', 'sniper'].includes(t)) continue;
    const target = (share[t] ?? 0) * (prof.pref[t] ?? 1);
    if (target <= 0 && !urgent) continue;
    let sc = (target - count(t) / army) * 4 + (quality[t] ?? 0.3) * 0.5;
    if (urgent) sc = t === 'mg' ? 2 : t === 'pioneer' ? 1.6 : t === 'infantry' ? 1.2 : 1;
    if (!prof.specials && (t === 'medic' || t === 'spy' || t === 'artillery')) sc -= 0.6;
    if (prof.sloppy > 0) sc += (hashNoise(c.id, s.round, LAND_UNITS.indexOf(t)) - 0.5) * prof.sloppy * 2;
    sc -= unitCost(s, f, t)! / 250;
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
  for (const c of ctx.myCities) {
    if (unitAt(s, c.x, c.y) || supportedUnits(s, c) >= unitLimit(s, c)) continue;
    const urgent = ctx.enemies.some((e) => dist(e, c) <= 2 && UNITS[e.type].attack > 0);
    const type = chooseUnitType(ctx, c, urgent);
    if (!type) continue;
    const front = ctx.hostileCities.length ? Math.min(...ctx.hostileCities.map((h) => dist(h, c))) : 10;
    const mk = (t: UnitTypeId, factor: number) => {
      if (trainCheck(s, c, t) !== 'ok' && trainCheck(s, c, t) !== 'notEnoughStars') return;
      const cost = unitCost(s, f, t)!;
      let value: number;
      if (urgent) value = cost * 3.5;
      else if (deficit > 0) value = cost * (1.15 + 0.08 * Math.min(deficit, 5)) * prof.militaryW;
      else value = cost * 0.25;
      value = value * factor + cost * ctx.pf - front * 0.05;
      buys.push({ cmd: { type: 'train', city: c.id, unitType: t }, cost, value, save: !urgent });
    };
    mk(type, 1);
    if (type !== 'infantry') mk('infantry', 0.8);
  }

  // Gebaeude / buildings
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
          value = pop * popVal;
        }
        if (prof.sloppy > 0) value *= 1 + (hashNoise(p.x, p.y, s.round) - 0.5) * prof.sloppy;
        buys.push({ cmd: { type: 'build', building: b, x: p.x, y: p.y }, cost: chk.cost, value, save: true });
      }
    }
  }
  // Strassen / roads
  if (hasTech(s, f, 'roadbuilding')) {
    for (const r of roadPlans(ctx)) {
      const chk = buildCheck(s, f, r.b, r.x, r.y);
      if (!chk.ok && chk.error !== 'notEnoughStars') continue;
      buys.push({ cmd: { type: 'build', building: r.b, x: r.x, y: r.y }, cost: chk.cost, value: (2 * popVal + 8) / Math.max(1, r.need), save: false });
    }
  }

  // Forschung / research
  const sites = siteCounts(ctx);
  const unconnected = ctx.myCities.filter((c) => !c.connected && !c.isHQ).length;
  for (const t of TECH_IDS) {
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
      if (cityUpgradeCheck(s, f, c, up) === 'alreadyBuilt' || cityUpgradeCheck(s, f, c, up) === 'noSlot' || cityUpgradeCheck(s, f, c, up) === 'notYourCity') continue;
      const cost = CITY_UPGRADES.cost[up];
      let value = 0;
      let cmd: Command = { type: 'cityUpgrade', city: c.id, upgrade: up };
      if (up === 'bunker') value = front ? cost * 2.2 : cost * 0.25;
      else if (up === 'barracks') value = cost * (0.55 + 0.1 * Math.min(4, c.level)) * prof.militaryW;
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

  // Botschaften / embassies
  if (hasTech(s, f, 'intelligence')) {
    const mult = fa.id === 'alvenia' ? 2 : 1;
    for (const g of fa.contacts) {
      if (fa.embassies.includes(g) || !s.factions[g].alive) continue;
      const hq = hqOf(s, g);
      if (!hq || !fa.explored[idx(s.size, hq.x, hq.y)]) continue;
      const value = 10 * mult * Math.min(ctx.roundsLeft, 15) * 0.45 * prof.embassyW;
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
    const cost = UNITS[to].cost ?? 0;
    const near = ctx.enemies.some((e) => dist(e, u) <= 4);
    if (!near) continue; // nur fuer Gefechte / only for combat
    const value = cost * 1.0;
    buys.push({ cmd: { type: 'upgrade', unit: u.id, to }, cost, value, save: false });
  }

  buys.sort((a, b) => b.value / Math.max(1, b.cost) - a.value / Math.max(1, a.cost) || (cmdKey(a.cmd) < cmdKey(b.cmd) ? -1 : 1));
  // Reichtum senkt die Schwelle / wealth lowers the threshold
  const minRatio = finalRound ? 0.01 : 0.45 * Math.min(1, 150 / Math.max(1, stars));
  for (const b of buys) {
    if (failed.has(cmdKey(b.cmd))) continue;
    const ratio = b.value / Math.max(1, b.cost);
    if (ratio < minRatio) break;
    if (b.cost <= stars) return b.cmd;
    // sparen fuer Lohnendes / save for something worthwhile
    if (prof.saving && b.save && !finalRound && ratio >= 1 && b.cost <= stars + inc * 1.5) return null;
  }
  return null;
}

function bestShip(ctx: Ctx, u: Unit): UnitTypeId | null {
  const { s, f } = ctx;
  const order: UnitTypeId[] = ['battleship', 'destroyer', 'submarine'];
  const rank = (t: UnitTypeId) => (t === 'landingBoat' ? 0 : 3 - order.indexOf(t));
  for (const t of order) {
    const tech = UNITS[t].tech;
    if (tech && !hasTech(s, f, tech)) continue;
    if (rank(t) <= rank(u.type)) return null;
    return t;
  }
  return null;
}
