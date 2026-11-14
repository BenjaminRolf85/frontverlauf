/**
 * Lagebild der KI: nur Sichtbares, Bedrohung, Wegefelder (Land/See), Ziele und Zuteilung.
 * AI situation picture: only visible things, threat, path fields (land/sea), goals and assignment.
 */
import {
  counterFactor, area, canSeeUnit, cityById, dist, has, hasTech, idx, isExplored, isHostile, isRefuelSpot, isShip, isWater,
  neighbors, supportedUnits, territoryOwner, unitAt, unitLimit, type City, type Faction, type GameState, type Unit, isJungle, netIncome } from '../core';
import { AI, DEFENSE_BONUS, INFANTRY_TYPES, REMAINS, TERRAIN_DEFENSE_TECH, UNITS, XENO, type UnitTypeId } from '../data/balance';
import { hashNoise, profileFor, type Profile } from './profile';

export type GoalKind =
  | 'village' | 'city' | 'bunker' | 'explore' | 'defend' | 'hunt' | 'stage' | 'refuel' | 'retreat' | 'home'
  | 'uprising' | 'support';

export interface Goal {
  kind: GoalKind;
  /** Zielfeld oder -1 bei Mehrfachquellen / target tile or -1 for multi-source goals */
  x: number;
  y: number;
  value: number;
  cap: number;
  /** Strafe je Zug Entfernung / penalty per turn of distance */
  distW: number;
  /** Schluessel des Wegefelds / path field key */
  src: string;
  water: boolean;
  targetId?: number;
}

export interface Ctx {
  s: GameState;
  f: number;
  fa: Faction;
  prof: Profile;
  n: number;
  size: number;
  my: Unit[];
  myCities: City[];
  /** sichtbare Kriegsgegner-Einheiten / visible hostile units */
  enemies: Unit[];
  hostileCities: City[];
  neutralCities: City[];
  /** je Feld: Indizes in enemies, die es naechste Runde angreifen koennen / per tile: enemies able to hit it next round */
  threat: number[][];
  points: boolean;
  conquest: boolean;
  roundsLeft: number;
  /** Sterne-Gegenwert eines Punktes / star equivalent of one score point */
  pf: number;
  landOk: Uint8Array;
  seaOk: Uint8Array;
  landCost: Uint8Array;
  seaCost: Uint8Array;
  navalOwn: Uint8Array;
  realLand: Uint8Array;
  fields: Map<string, Float32Array>;
  goals: Map<number, Goal>;
  /** Ziele, die nur ueber See erreichbar sind / goals only reachable by sea */
  navalNeed: boolean;
  /** gewuenschte Armeegroesse / desired army size */
  desiredArmy: number;
  /** Belagerungsmodus: volle Armee greift entschlossen an / siege mode: full army attacks decisively */
  siege: boolean;
  /** Faktor, um den die Vorsicht im Belagerungsmodus sinkt / factor by which caution drops in siege mode */
  siegeCaution: number;
  /** Staedte, die gleich ausbilden koennen / cities that can train right away */
  trainable: Set<number>;
}

// Feldcache je Zustand und Zug / field cache per state and turn
const fieldCache = new WeakMap<GameState, { key: string; fields: Map<string, Float32Array> }>();

export function worth(u: Unit): number {
  const base = (t: UnitTypeId) => (t === 'tank' ? 60 : UNITS[t].cost ?? 10);
  let w = u.carried ? base(u.carried) + (UNITS[u.type].cost ?? 0) : base(u.type);
  if (u.veteran) w += 8;
  return Math.max(8, w);
}

/** Bewegungsleistung in Feldkosten je Zug / movement in field cost units per turn */
export function speedOf(u: Unit): number {
  const st = UNITS[u.type];
  if (has(u, 'fly') || st.ship) return st.move;
  return 2 * st.move;
}

export function buildCtx(s: GameState, f: number): Ctx {
  const fa = s.factions[f];
  const size = s.size;
  const n = size * size;
  const my = s.units.filter((u) => u.owner === f);
  const myCities = s.cities.filter((c) => c.owner === f);
  const enemies = s.units.filter((u) => u.owner !== f && isHostile(s, f, u.owner) && canSeeUnit(s, f, u));
  // Ab Runde AI.intelRound kennt die KI alle feindlichen Staedte (Aufklaerung), damit Partien nicht im Nebel stocken
  // from round AI.intelRound the AI knows all hostile cities (intelligence) so games do not stall in the fog
  const intel = s.round >= AI.intelRound;
  const hostileCities = s.cities.filter((c) => c.owner !== null && c.owner !== f && isHostile(s, f, c.owner) && (intel || isExplored(s, f, c.x, c.y)));
  const neutralCities = s.cities.filter((c) => c.owner === null && isExplored(s, f, c.x, c.y));
  const threat: number[][] = Array.from({ length: n }, () => []);
  enemies.forEach((e, i) => {
    const st = UNITS[e.type];
    if (st.attack <= 0 || st.range <= 0) return;
    const reach = st.move + st.range;
    for (const p of area(size, e.x, e.y, reach)) threat[idx(size, p.x, p.y)].push(i);
  });
  const limit = s.config.roundLimit;
  const points = s.config.mode !== 'conquest' && limit !== null;
  const roundsLeft = limit !== null ? Math.max(0, limit - s.round) : 99;
  const progress = limit !== null ? Math.min(1, s.round / limit) : 0;
  const pf = points ? 0.12 + 0.45 * progress * progress * progress + (roundsLeft === 0 ? 0.4 : 0) : 0.02;

  // Zyrr: alle Bodeneinheiten sind Laeufer und waten durchs Wasser / Zyrr: all ground units walk mountains and wade
  const wader = fa.id === XENO.faction;
  const hasMountain = hasTech(s, f, 'mountainTraining') || wader;
  const hasDiving = hasTech(s, f, 'diving');
  const hasCoastal = hasTech(s, f, 'coastalEconomy');
  const landOk = new Uint8Array(n), seaOk = new Uint8Array(n), landCost = new Uint8Array(n), seaCost = new Uint8Array(n);
  const navalOwn = new Uint8Array(n), realLand = new Uint8Array(n);
  let structs = 0;
  for (let k = 0; k < n; k++) {
    const t = s.tiles[k];
    if (t.building === 'bridge' || t.building === 'navalBase') structs += k + 1;
    if (!fa.explored[k]) {
      // unbekannt: optimistisch passierbar, ohne Vorteil / unknown: optimistically passable, no advantage
      landOk[k] = 1; seaOk[k] = 1; landCost[k] = 2; seaCost[k] = 2; realLand[k] = 1;
      continue;
    }
    const water = isWater(t);
    const bridge = t.building === 'bridge';
    let lok = !water || bridge;
    if (t.terrain === 'mountain' && !hasMountain) lok = false;
    if (t.cityId !== null) {
      const c = cityById(s, t.cityId);
      if (c && c.owner !== null && c.owner !== f && !isHostile(s, f, c.owner)) lok = false;
    }
    if (water && !bridge && wader) lok = true;
    // Vulkangipfel und Lava meiden / avoid volcano peaks and lava
    if (t.volcano || (t.lava !== undefined && t.lava >= s.round)) lok = false;
    landOk[k] = lok ? 1 : 0;
    realLand[k] = !water && lok ? 1 : 0;
    landCost[k] = t.road || t.cityId !== null || bridge ? 1 : isJungle(t) ? 5 : (t.terrain === 'forest' || t.terrain === 'mountain') ? 3 : water && wader ? 4 : 2;
    seaOk[k] = water && (t.terrain !== 'ocean' || hasDiving) ? 1 : 0;
    seaCost[k] = 1;
    if (t.building === 'navalBase' && hasCoastal && territoryOwner(s, t) === f) navalOwn[k] = 1;
  }
  const key = `${s.round}:${f}:${structs}:${myCities.length}:${fa.techs.length}:${fa.relations.join('')}`;
  let fc = fieldCache.get(s);
  if (!fc || fc.key !== key) { fc = { key, fields: new Map() }; fieldCache.set(s, fc); }

  const ctx: Ctx = {
    s, f, fa, prof: profileFor(s, f), n, size, my, myCities, enemies, hostileCities, neutralCities, threat,
    points, conquest: !points, roundsLeft, pf,
    landOk, seaOk, landCost, seaCost, navalOwn, realLand, fields: fc.fields, goals: new Map(), navalNeed: false,
    desiredArmy: 0, trainable: new Set(), siege: false, siegeCaution: 1,
  };
  const prof = ctx.prof;
  // Punktemodus: Wirtschaft vor Militaer / points mode: economy before military
  let desired = Math.ceil(myCities.length * prof.armyPerCity * (points ? 0.6 : 1));
  if (ctx.conquest) desired += Math.floor((s.round / 8) * prof.aggression);
  desired += Math.min(4, enemies.filter((e) => myCities.some((c) => dist(c, e) <= 3)).length);
  if (neutralCities.length) desired += 1;
  ctx.desiredArmy = desired;
  // Volle Armee oder voller Sternespeicher: Stillstand aufbrechen und angreifen
  // full army or a big star bank: break the standstill and attack
  let capacity = 0;
  for (const c of myCities) capacity += unitLimit(s, c);
  const saturation = capacity > 0 ? my.length / capacity : 0;
  // Armee kann nicht weiter wachsen (Sold frisst das Einkommen) oder genug Truppen fuer einen Vorstoss
  // army cannot grow further (upkeep eats the income) or enough troops for a push
  const stalled = netIncome(s, f) < 4 && my.length >= 6;
  const strongEnough = my.length >= 8 && s.round >= 18;
  if (saturation >= 0.8 || (fa.stars > 250 && my.length >= desired) || stalled || strongEnough) {
    const push = Math.min(1, Math.max(saturation - 0.6, fa.stars / 1000));
    prof.aggression += 0.6 * push + 0.3;
    ctx.siegeCaution = 1 - 0.75 * push;
    prof.caution *= ctx.siegeCaution;
    prof.attackMin -= 2 + 6 * push;
    prof.retreatHp *= 1 - push;
    ctx.siege = true;
  }
  if (desired > my.length && fa.stars >= 10) {
    for (const c of myCities) if (supportedUnits(s, c) < unitLimit(s, c)) ctx.trainable.add(c.id);
  }
  ctx.navalNeed = computeNavalNeed(ctx);
  assignGoals(ctx);
  return ctx;
}

// ---------- Wegefelder / path fields ----------

class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop(): [number, number] {
    const k = this.k, v = this.v;
    const rk = k[0], rv = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0;
      const len = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= len) break;
        if (c + 1 < len && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return [rk, rv];
  }
}

/**
 * Rueckwaerts-Dijkstra von den Quellen: Kosten bis zum Ziel je Knoten. Knoten = Ebene*n + Feld (0 Land, 1 See).
 * Reverse Dijkstra from the sources: cost to the goal per node. Node = layer*n + tile (0 land, 1 sea).
 */
function computeField(ctx: Ctx, sources: { k: number; layer: number }[], fly: boolean): Float32Array {
  const { n, size } = ctx;
  const d = new Float32Array(2 * n).fill(Infinity);
  const heap = new Heap();
  for (const src of sources) {
    const node = src.layer * n + src.k;
    if (d[node] > 0) { d[node] = 0; heap.push(0, node); }
  }
  while (heap.size) {
    const [cd, node] = heap.pop();
    if (cd > d[node]) continue;
    const layer = node >= n ? 1 : 0;
    const k = node - layer * n;
    const x = k % size, y = (k / size) | 0;
    for (const p of neighbors(size, x, y)) {
      const a = p.y * size + p.x;
      if (fly) {
        if (cd + 1 < d[a]) { d[a] = cd + 1; heap.push(cd + 1, a); }
        continue;
      }
      if (layer === 0) {
        if (ctx.landOk[a]) {
          const nd = cd + ctx.landCost[k];
          if (nd < d[a]) { d[a] = nd; heap.push(nd, a); }
        }
        // Ausschiffen von a nach k / disembark from a onto k
        if (ctx.seaOk[a] && ctx.realLand[k]) {
          const nd = cd + 2;
          if (nd < d[n + a]) { d[n + a] = nd; heap.push(nd, n + a); }
        }
      } else {
        if (ctx.seaOk[a]) {
          const nd = cd + ctx.seaCost[k];
          if (nd < d[n + a]) { d[n + a] = nd; heap.push(nd, n + a); }
        }
        // Einschiffen von a in den Stuetzpunkt k / embark from a into naval base k
        // Einschiffen kostet extra: Landwege bevorzugen / embarking costs extra: prefer land routes
        if (ctx.navalOwn[k] && ctx.landOk[a]) {
          const nd = cd + 6;
          if (nd < d[a]) { d[a] = nd; heap.push(nd, a); }
        }
      }
    }
  }
  if (fly) d.copyWithin(n, 0, n);
  return d;
}

/** Wegefeld fuer ein Ziel / path field for a goal */
export function fieldFor(ctx: Ctx, src: string, fly: boolean): Float32Array {
  const extra = src === 'unexp' ? ':' + countExplored(ctx) : '';
  const key = (fly ? 'F' : 'G') + src + extra;
  let fld = ctx.fields.get(key);
  if (fld) return fld;
  const { s, f, n, size } = ctx;
  const sources: { k: number; layer: number }[] = [];
  if (src.startsWith('t')) {
    const k = parseInt(src.slice(1), 10);
    sources.push({ k, layer: src.endsWith('s') ? 1 : 0 });
  } else if (src === 'unexp') {
    for (let k = 0; k < n; k++) if (!ctx.fa.explored[k]) { sources.push({ k, layer: 0 }, { k, layer: 1 }); }
  } else if (src === 'refuel') {
    for (let k = 0; k < n; k++) if (isRefuelSpot(s, f, k % size, (k / size) | 0)) sources.push({ k, layer: 0 });
  } else if (src === 'home') {
    for (let k = 0; k < n; k++) if (territoryOwner(s, s.tiles[k]) === f && ctx.realLand[k]) sources.push({ k, layer: 0 });
  }
  fld = computeField(ctx, sources, fly);
  ctx.fields.set(key, fld);
  return fld;
}

function countExplored(ctx: Ctx): number {
  let c = 0;
  for (const e of ctx.fa.explored) c += e;
  return c;
}

export const layerOf = (u: Unit) => (isShip(u) ? 1 : 0);

/** Feldwert einer Einheit an Position / field value of a unit at a position */
export function fieldAt(ctx: Ctx, fld: Float32Array, x: number, y: number, layer: number): number {
  return fld[layer * ctx.n + y * ctx.size + x];
}

export function goalField(ctx: Ctx, u: Unit, g: Goal): Float32Array {
  return fieldFor(ctx, g.src, has(u, 'fly'));
}

/** Zuege bis zum Ziel / turns to goal */
export function turnsTo(ctx: Ctx, u: Unit, g: Goal): number {
  const fld = goalField(ctx, u, g);
  return fieldAt(ctx, fld, u.x, u.y, layerOf(u)) / speedOf(u);
}

// ---------- Kampf-Schaetzungen / combat estimates ----------

/** Verteidigungsbonus an hypothetischer Position / defense bonus at a hypothetical position */
export function defBonusAt(ctx: Ctx, u: Unit, x: number, y: number, asShip = isShip(u)): number {
  if (has(u, 'fly')) return DEFENSE_BONUS.open;
  const { s, f } = ctx;
  const t = s.tiles[idx(s.size, x, y)];
  let b = DEFENSE_BONUS.open;
  const tech = TERRAIN_DEFENSE_TECH[t.terrain];
  if (tech && hasTech(s, f, tech) && isWater(t) === asShip) b = Math.max(b, DEFENSE_BONUS.terrainWithTech);
  if (t.cityId !== null && has(u, 'fortify')) {
    const c = cityById(s, t.cityId);
    if (c && c.owner === f) b = Math.max(b, c.bunkerRing ? DEFENSE_BONUS.cityWithBunker : DEFENSE_BONUS.city);
  }
  if (t.outpost && t.outpost.owner === f && INFANTRY_TYPES.includes(u.type)) b = Math.max(b, DEFENSE_BONUS.outpost);
  // Wrack als Deckung / wreck as cover
  if (t.remains?.kind === 'wreck' && !asShip) b += REMAINS.wreckDefenseBonus;
  return b;
}

/** Erwarteter Schaden durch sichtbare Gegner an Position / expected damage from visible enemies at position */
export function expectedDamage(ctx: Ctx, u: Unit, x: number, y: number, asShip = isShip(u)): number {
  const list = ctx.threat[y * ctx.size + x];
  if (!list.length) return 0;
  const type = asShip === isShip(u) ? u.type : (u.carried ?? u.type);
  const st = UNITS[type];
  const d = st.defense * (u.hp / u.maxHp) * defBonusAt(ctx, u, x, y, asShip);
  let total = 0;
  for (const i of list) {
    const e = ctx.enemies[i];
    if (e.x === x && e.y === y) continue;
    const a = UNITS[e.type].attack;
    const A = a * (e.hp / e.maxHp);
    total += (A / (A + d || 1)) * a * 4.5 * counterFactor(e.type, type);
  }
  // nicht alle Gegner greifen dieselbe Einheit an / not every enemy hits the same unit
  return list.length > 1 ? total * 0.75 : total;
}

// ---------- Ziele / goals ----------

function computeNavalNeed(ctx: Ctx): boolean {
  const { s } = ctx;
  if (!ctx.myCities.length) return false;
  const targets = [...ctx.neutralCities, ...ctx.hostileCities];
  if (!targets.length) return false;
  // reine Landsuche von eigenen Staedten / pure land search from own cities
  const seen = new Uint8Array(ctx.n);
  const stack: number[] = [];
  for (const c of ctx.myCities) { const k = idx(s.size, c.x, c.y); seen[k] = 1; stack.push(k); }
  while (stack.length) {
    const k = stack.pop()!;
    for (const p of neighbors(s.size, k % s.size, (k / s.size) | 0)) {
      const a = p.y * s.size + p.x;
      if (seen[a] || !ctx.landOk[a]) continue;
      seen[a] = 1; stack.push(a);
    }
  }
  return targets.some((c) => !seen[idx(s.size, c.x, c.y)]);
}

function canCaptureType(u: Unit): boolean {
  const t = u.carried ?? u.type;
  return !has(u, 'fly') && t !== 'spy' && t !== 'artillery' && t !== 'medic' && u.type !== 'heli';
}
function isCombat(u: Unit): boolean {
  const t = u.type;
  return UNITS[t].attack > 0 && UNITS[t].range > 0 || (u.carried !== null && UNITS[u.carried].attack > 0);
}

function buildGoals(ctx: Ctx): Goal[] {
  const { s, f, prof, size } = ctx;
  const goals: Goal[] = [];
  const tileSrc = (x: number, y: number, water = false) => `t${y * size + x}${water ? 's' : 'l'}`;
  for (const c of ctx.neutralCities) {
    goals.push({ kind: 'village', x: c.x, y: c.y, value: 75, cap: 1, distW: 9, src: tileSrc(c.x, c.y), water: false });
  }
  // schwaechsten Gegner zuerst ausschalten / finish off the weakest enemy first
  const cityCount = new Map<number, number>();
  for (const c of ctx.hostileCities) cityCount.set(c.owner!, (cityCount.get(c.owner!) ?? 0) + 1);
  const fewest = Math.min(...cityCount.values());
  for (const c of ctx.hostileCities) {
    const def = unitAt(s, c.x, c.y);
    const defended = !!def && def.owner !== f && canSeeUnit(s, f, def);
    const owned = s.cities.filter((o) => o.owner === c.owner).length;
    const value = (38 + 6 * c.level + (c.isHQ ? 15 : 0)) * prof.aggression + (defended ? 0 : 25) +
      (cityCount.get(c.owner!) === fewest ? 8 : 0) + (owned <= 2 ? 15 : 0);
    goals.push({ kind: 'city', x: c.x, y: c.y, value: value + (ctx.siege ? 20 : 0), cap: ctx.siege ? (defended ? 5 : 3) : defended ? 4 : 2, distW: ctx.siege ? 3 : 5, src: tileSrc(c.x, c.y), water: false, targetId: c.id });
  }
  for (let k = 0; k < ctx.n; k++) {
    const t = s.tiles[k];
    if (!ctx.fa.explored[k]) continue;
    // Bergung: Absturzstelle und Forschungseinrichtung wie ein Bunker anlaufen / salvage sites are visited like bunkers
    const salvage = (t.feature === 'crashSite' || t.feature === 'labRuin') && !t.looted;
    if (t.feature !== 'bunker' && !salvage) continue;
    const x = k % size, y = (k / size) | 0;
    const water = isWater(t);
    goals.push({ kind: 'bunker', x, y, value: 45, cap: 1, distW: 9, src: tileSrc(x, y, water), water });
  }
  for (const c of ctx.myCities) {
    const near = ctx.enemies.filter((e) => dist(e, c) <= 3 && UNITS[e.type].attack > 0);
    if (!near.length) continue;
    const value = 55 + 10 * c.level + (c.isHQ ? 25 : 0) + 8 * near.length;
    goals.push({ kind: 'defend', x: c.x, y: c.y, value, cap: Math.min(3, near.length + 1), distW: 12, src: tileSrc(c.x, c.y), water: false });
  }
  for (const e of ctx.enemies) {
    let nearOwn = 99;
    for (const c of ctx.myCities) nearOwn = Math.min(nearOwn, dist(c, e));
    const onOwnCity = ctx.myCities.some((c) => c.x === e.x && c.y === e.y);
    let nearUnit = 99;
    for (const u of ctx.my) nearUnit = Math.min(nearUnit, dist(u, e));
    if (nearOwn > 3 && nearUnit > 4) continue;
    const value = 22 + worth(e) * 0.5 + (onOwnCity ? 60 : 0) + (nearOwn <= 2 ? 18 : 0);
    const water = isWater(s.tiles[idx(size, e.x, e.y)]) && !has(e, 'fly');
    goals.push({ kind: 'hunt', x: e.x, y: e.y, value, cap: onOwnCity ? 3 : 2, distW: 8, src: tileSrc(e.x, e.y, water), water, targetId: e.id });
  }
  let unexplored = 0;
  for (const e of ctx.fa.explored) if (!e) unexplored++;
  if (unexplored > 0) {
    const value = Math.max(14, 42 - s.round * 1.2);
    goals.push({ kind: 'explore', x: -1, y: -1, value, cap: prof.explorers, distW: 6, src: 'unexp', water: false });
    // Radarecken / radar corners
    if (ctx.fa.radarsFound.length < s.radars.length) {
      for (const [cx, cy] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
        if (ctx.fa.explored[idx(size, cx, cy)]) continue;
        goals.push({ kind: 'explore', x: cx, y: cy, value: 30, cap: 1, distW: 4, src: tileSrc(cx, cy), water: false });
      }
    }
  }
  return goals;
}

function eligible(u: Unit, g: Goal): boolean {
  const fly = has(u, 'fly');
  switch (g.kind) {
    case 'village': case 'city': return canCaptureType(u);
    case 'bunker': return g.water ? (fly || isShip(u)) : u.type !== 'spy';
    case 'defend': case 'hunt': return isCombat(u) && u.type !== 'medic';
    case 'explore': return u.type !== 'artillery' && u.type !== 'medic' && u.type !== 'spy';
    default: return true;
  }
}

function assignGoals(ctx: Ctx) {
  const { s, f, prof } = ctx;
  const goals = buildGoals(ctx);
  // Hauptziel: erreichbare Stadt, auf die sich die Armee konzentriert / main target: a reachable city the army concentrates on
  const fighters = ctx.my.filter((u) => isCombat(u) && canCaptureType(u) && !isShip(u));
  let main: Goal | null = null, bestMain = -Infinity;
  for (const g of goals) {
    if (g.kind !== 'city') continue;
    let n = 0, sum = 0;
    for (const u of fighters) { const t = turnsTo(ctx, u, g); if (Number.isFinite(t)) { n++; sum += t; } }
    if (!n) continue;
    const sc = n * 2 - (sum / n) * 3 + g.value * 0.2;
    if (sc > bestMain) { bestMain = sc; main = g; }
  }
  if (main) { main.value += 25; main.cap = ctx.siege ? 14 : 8; main.distW = 2; }
  const pairs: { u: Unit; g: number; sc: number }[] = [];
  const special = (u: Unit) => u.type === 'spy' || u.type === 'medic' || has(u, 'mines');
  for (const u of ctx.my) {
    if (special(u)) continue;
    // Rueckzug / retreat
    if (prof.retreatHp > 0 && u.hp < u.maxHp * prof.retreatHp && !has(u, 'fly')) {
      ctx.goals.set(u.id, { kind: 'retreat', x: -1, y: -1, value: 100, cap: 99, distW: 0, src: 'home', water: false });
      continue;
    }
    // Hubschrauber mit wenig Sprit / helicopter low on fuel
    if (u.fuel !== null && u.fuel <= 3 && !isRefuelSpot(s, f, u.x, u.y)) {
      ctx.goals.set(u.id, { kind: 'refuel', x: -1, y: -1, value: 100, cap: 99, distW: 0, src: 'refuel', water: false });
      continue;
    }
    goals.forEach((g, gi) => {
      if (!eligible(u, g)) return;
      if (has(u, 'fly') && g.kind !== 'hunt' && g.kind !== 'defend' && g.kind !== 'explore' && g.kind !== 'bunker') return;
      const t = turnsTo(ctx, u, g);
      if (!Number.isFinite(t)) return;
      let sc = g.value - g.distW * t;
      if (g.kind === 'explore' && UNITS[u.type].move > 1) sc += 8;
      if (prof.sloppy > 0) sc += (hashNoise(u.id, gi, s.round) - 0.5) * 30 * prof.sloppy;
      pairs.push({ u, g: gi, sc });
    });
  }
  pairs.sort((a, b) => b.sc - a.sc || a.u.id - b.u.id || a.g - b.g);
  const used = new Array(goals.length).fill(0);
  for (const p of pairs) {
    if (ctx.goals.has(p.u.id) || used[p.g] >= goals[p.g].cap) continue;
    used[p.g]++;
    ctx.goals.set(p.u.id, goals[p.g]);
  }
  // Rest: Sammeln an der Front oder Heimat / rest: stage at the front or home
  const front = frontGoal(ctx);
  for (const u of ctx.my) {
    if (ctx.goals.has(u.id)) continue;
    if (u.type === 'spy') { ctx.goals.set(u.id, spyGoal(ctx, u)); continue; }
    if (u.type === 'medic') { ctx.goals.set(u.id, medicGoal(ctx, u)); continue; }
    if (has(u, 'mines')) { ctx.goals.set(u.id, minerGoal(ctx)); continue; }
    ctx.goals.set(u.id, front);
  }
}

function frontGoal(ctx: Ctx): Goal {
  const { size } = ctx;
  const hq = ctx.myCities.find((c) => c.isHQ) ?? ctx.myCities[0];
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  if (hq) {
    for (const c of ctx.hostileCities) { const d = dist(c, hq); if (d < bd) { bd = d; best = c; } }
    if (!best) for (const e of ctx.enemies) { const d = dist(e, hq); if (d < bd) { bd = d; best = e; } }
  }
  if (best) {
    return { kind: 'stage', x: best.x, y: best.y, value: 10, cap: 99, distW: 0, src: `t${best.y * size + best.x}l`, water: false };
  }
  const unexplored = ctx.fa.explored.some((e) => !e);
  if (unexplored) return { kind: 'explore', x: -1, y: -1, value: 10, cap: 99, distW: 0, src: 'unexp', water: false };
  return { kind: 'home', x: -1, y: -1, value: 5, cap: 99, distW: 0, src: 'home', water: false };
}

/**
 * Minenleger: zur eigenen Stadt, die Gegnern oder feindlichen Staedten am naechsten liegt.
 * Mine layer: towards the own city closest to enemies or hostile cities.
 */
function minerGoal(ctx: Ctx): Goal {
  let best: City | null = null;
  let bs = Infinity;
  for (const c of ctx.myCities) {
    let d = 20;
    for (const e of ctx.enemies) d = Math.min(d, dist(e, c));
    for (const h of ctx.hostileCities) d = Math.min(d, dist(h, c) + 1);
    if (d < bs) { bs = d; best = c; }
  }
  if (!best) return frontGoal(ctx);
  return { kind: 'support', x: best.x, y: best.y, value: 20, cap: 99, distW: 0, src: `t${best.y * ctx.size + best.x}l`, water: false, targetId: best.id };
}

function spyGoal(ctx: Ctx, u: Unit): Goal {
  let best: City | null = null;
  let bs = -Infinity;
  for (const c of ctx.hostileCities) {
    const sc = Math.min(c.level, 4) * 10 - dist(u, c) * 3 + (c.isHQ ? 5 : 0);
    if (sc > bs) { bs = sc; best = c; }
  }
  if (!best) return frontGoal(ctx);
  return { kind: 'uprising', x: best.x, y: best.y, value: 50, cap: 1, distW: 0, src: `t${best.y * ctx.size + best.x}l`, water: false, targetId: best.id };
}

function medicGoal(ctx: Ctx, u: Unit): Goal {
  // naechster wertvoller Gegner nahe eigener Truppen, sonst verletzte eigene Einheit / nearest valuable enemy near own troops, else injured unit
  let best: Unit | null = null;
  let bs = -Infinity;
  for (const e of ctx.enemies) {
    if (isShip(e) || has(e, 'fly')) continue;
    const support = ctx.my.filter((o) => o.id !== u.id && dist(o, e) <= 3 && isCombat(o)).length;
    if (!support) continue;
    const sc = worth(e) - dist(u, e) * 6;
    if (sc > bs) { bs = sc; best = e; }
  }
  if (!best) {
    for (const o of ctx.my) {
      if (o.id === u.id || o.hp >= o.maxHp) continue;
      const sc = (o.maxHp - o.hp) - dist(u, o) * 3;
      if (sc > bs) { bs = sc; best = o; }
    }
  }
  if (!best) {
    for (const o of ctx.my) {
      if (o.id === u.id || !isCombat(o)) continue;
      const g = ctx.goals.get(o.id);
      if (!g || (g.kind !== 'city' && g.kind !== 'hunt' && g.kind !== 'stage')) continue;
      const sc = -dist(u, o);
      if (sc > bs) { bs = sc; best = o; }
    }
  }
  if (!best) return frontGoal(ctx);
  return { kind: 'support', x: best.x, y: best.y, value: 30, cap: 99, distW: 0, src: `t${best.y * ctx.size + best.x}l`, water: false, targetId: best.id };
}
