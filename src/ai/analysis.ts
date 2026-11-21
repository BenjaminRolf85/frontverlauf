/**
 * Lagebild der KI: nur Sichtbares, Bedrohung, Wegefelder (Land/See), Ziele und Zuteilung.
 * AI situation picture: only visible things, threat, path fields (land/sea), goals and assignment.
 */
import {
  counterFactor, unitRange, entrenchFactor, area, canSeeUnit, cityById, canEmbark, citySites, usesSites, dist, has, hasTech, idx, isExplored, isHostile, isRefuelSpot, isShip, isWater,
  neighbors, freeUnitSlots, noTraining, territoryOwner, unitAt, unitLimit, type City, type Faction, type GameState, type Unit, isJungle, netIncome,
  isWonder, waalArmed, victoryStatus, hqOf, isBoss, missionById, moveFireMult, homeDefenseAt, isCultFaction, hordeCount, plunderValue, judges, isSinner, hullCover, rearAttackBonus, type Pos } from '../core';
import { AI, CAMPAIGN_AI, DEFENSE_BONUS, HIT, M2, INFANTRY_TYPES, REMAINS, SIN, SWARM_MOTHER, TERRAIN_DEFENSE_TECH, UNITS, WONDERS, XENO, type UnitTypeId } from '../data/balance';
import { hashNoise, profileFor, type Profile } from './profile';
import { emplacementGoal } from './emplacements';
import { baseAttackWorth, baseCaptureWorth, baseDefendWorth } from './bases';
import { radarGoal, sabotageGoal, siloGoal } from './shadowFleet';
import { isScientist, mothershipGoals, scientistGoal } from './mothership';
import { carrierGoal, plansGoals } from './temple';
import type { OpSlot } from './operations';

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
  /** Kampagnen-Haltefeld: Artillerie haelt nicht / campaign hold tile: artillery does not hold */
  hold?: boolean;
  /** Rolle in einer Operation (operations.ts) / role in an operation (operations.ts) */
  op?: OpSlot;
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
  /** Rollen in Operationen je Einheit (leer ohne Taktik) / roles in operations per unit (empty without tactics) */
  ops: Map<number, OpSlot>;
  /** Angriffsreihenfolge abstimmen (Rueckenangriffe) / coordinate the attack order (rear attacks) */
  coordinate: boolean;
}

// Feldcache je Zustand und Zug / field cache per state and turn
const fieldCache = new WeakMap<GameState, { key: string; fields: Map<string, Float32Array> }>();

export function worth(u: Unit): number {
  // Wunder: sehr wertvolles Ziel / wonders: a very valuable target
  if (isWonder(u)) return WONDERS.aiWorth;
  // Wissenschaftler (m2): der Wettlauf haengt an ihm, also vorsichtig fuehren und gern jagen / scientist (m2): the race hangs on it, so lead it carefully and hunt it keenly
  if (u.type === 'scientist') return M2.ai.scientistWorth;
  const base = (t: UnitTypeId) => (t === 'tank' || t === 'teslaTank' || t === 'reliquary' ? 60 : UNITS[t].cost ?? 10);
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
  // feindliche Wunder sind allen bekannt (Riesenbauwerke, gemeldet) / hostile wonders are known to all (huge structures, announced)
  const enemies = s.units.filter((u) => u.owner !== f && isHostile(s, f, u.owner) && (canSeeUnit(s, f, u) || isWonder(u)));
  // Ab Runde AI.intelRound kennt die KI alle feindlichen Staedte (Aufklaerung), damit Partien nicht im Nebel stocken
  // from round AI.intelRound the AI knows all hostile cities (intelligence) so games do not stall in the fog
  const intel = s.round >= AI.intelRound;
  const hostileCities = s.cities.filter((c) => c.owner !== null && c.owner !== f && isHostile(s, f, c.owner) && (intel || isExplored(s, f, c.x, c.y)));
  const neutralCities = s.cities.filter((c) => c.owner === null && isExplored(s, f, c.x, c.y));
  const threat: number[][] = Array.from({ length: n }, () => []);
  enemies.forEach((e, i) => {
    const st = UNITS[e.type];
    if (st.attack <= 0 || st.range <= 0) return;
    // unbewaffneter Waal ist keine Gefahr / an unarmed Waal is no danger
    if (e.type === 'waal' && !waalArmed(e)) return;
    // Reichweite mit Fraktionsbonus (Korvat-Artillerie) / range with the faction bonus (Korvat artillery)
    const reach = st.move + unitRange(e.type, s.factions[e.owner]?.id);
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
  // Einschiffen: Menschen am eigenen Marinestuetzpunkt, andere mit Kuestenwirtschaft / embarking: humans at an own naval base, others with coastal economy
  const hasCoastal = canEmbark(s, f);
  const landOk = new Uint8Array(n), seaOk = new Uint8Array(n), landCost = new Uint8Array(n), seaCost = new Uint8Array(n);
  const navalOwn = new Uint8Array(n), realLand = new Uint8Array(n);
  let structs = 0;
  // eigene leere Schiffe (Werft) sind Einstiegspunkte wie ein Stuetzpunkt / own empty ships (shipyard) are boarding points like a base
  const boats = new Set<number>();
  if (hasCoastal) for (const u of my) if (isShip(u) && u.carried === null) { boats.add(idx(size, u.x, u.y)); structs += 7 * (idx(size, u.x, u.y) + 1); }
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
    if (t.volcano || (t.lava !== undefined && t.lava >= s.round) || t.wonderOf || t.turret || t.feature === 'mothership' || t.temple) lok = false;
    landOk[k] = lok ? 1 : 0;
    realLand[k] = !water && lok ? 1 : 0;
    landCost[k] = t.road || t.cityId !== null || bridge ? 1 : isJungle(t) ? 5 : (t.terrain === 'forest' || t.terrain === 'mountain') ? 3 : water && wader ? 4 : 2;
    seaOk[k] = water && (t.terrain !== 'ocean' || hasDiving) ? 1 : 0;
    seaCost[k] = 1;
    if ((t.building === 'navalBase' && hasCoastal && territoryOwner(s, t) === f) || boats.has(k)) navalOwn[k] = 1;
  }
  const key = `${s.round}:${f}:${structs}:${myCities.length}:${fa.techs.length}:${fa.relations.join('')}`;
  let fc = fieldCache.get(s);
  if (!fc || fc.key !== key) { fc = { key, fields: new Map() }; fieldCache.set(s, fc); }

  const ctx: Ctx = {
    s, f, fa, prof: profileFor(s, f), n, size, my, myCities, enemies, hostileCities, neutralCities, threat,
    points, conquest: !points, roundsLeft, pf,
    landOk, seaOk, landCost, seaCost, navalOwn, realLand, fields: fc.fields, goals: new Map(), navalNeed: false,
    desiredArmy: 0, trainable: new Set(), siege: false, siegeCaution: 1, ops: new Map(), coordinate: false,
  };
  const prof = ctx.prof;
  // Punktemodus: Wirtschaft vor Militaer / points mode: economy before military
  let desired = Math.ceil(myCities.length * prof.armyPerCity * (points ? 0.6 : 1));
  if (ctx.conquest) desired += Math.floor((s.round / 8) * prof.aggression);
  desired += Math.min(4, enemies.filter((e) => myCities.some((c) => dist(c, e) <= 3)).length);
  if (neutralCities.length) desired += 1;
  // Kult: Masse, groessere Horde als andere, hoechstens bis zum Limit / cult: mass, a bigger horde than others, at most up to the cap
  const cult = isCultFaction(s, f);
  const horde = cult ? hordeCount(s, f) : null;
  if (horde) desired = Math.min(horde.cap, Math.ceil(desired * AI.cultArmyFactor) + AI.cultArmyExtra);
  ctx.desiredArmy = desired;
  // Volle Armee oder voller Sternespeicher: Stillstand aufbrechen und angreifen
  // full army or a big star bank: break the standstill and attack
  let capacity = 0;
  for (const c of myCities) capacity += unitLimit(s, c);
  if (horde) capacity = horde.cap;
  const saturation = capacity > 0 ? (horde ? horde.units : my.length) / capacity : 0;
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
  // Kult bildet nicht aus: seine Staedte muessen nicht frei bleiben / the cult does not train: its cities need not stay free
  if (desired > my.length && fa.stars >= 10 && !cult) {
    // Menschen: nur Staedte mit einer Produktionsstaette / humans: only cities with a production site
    // Wohnbloecke und Supermarkt bilden nie aus; ihre Plaetze zaehlen fuer die anderen Staedte mit (freeUnitSlots)
    // residential blocks and supermarket never train; their slots count for the other cities (freeUnitSlots)
    for (const c of myCities) if (!noTraining(c) && freeUnitSlots(s, c) > 0 && (!usesSites(s, f) || citySites(s, c).length > 0)) ctx.trainable.add(c.id);
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
  // Mutterschiff (m2): Huelle deckt den Wissenschaftler / mothership (m2): the hull covers the scientist
  b += hullCover(s, u, x, y);
  // eigenes Gebiet (Alvenia: Glaubensbollwerk) / own territory (Alvenia: Bulwark of Faith)
  return b * (1 + homeDefenseAt(s, u, x, y));
}

/** Erwarteter Schaden durch sichtbare Gegner an Position / expected damage from visible enemies at position */
/**
 * facing = Ausrichtung der Einheit auf (x, y) (fehlt = unbekannt, z. B. fremdes Feld ohne Weg): Gegner im Rueckenbereich
 * treffen mit COMBAT.rearAttack mehr (Stand der Gegner als Naeherung fuer die Seite, von der sie kommen).
 * facing = the unit's facing on (x, y) (missing = unknown, e.g. another tile without a path): enemies in the rear arc
 * hit COMBAT.rearAttack harder (the enemies' position as an approximation of the side they come from).
 */
export function expectedDamage(ctx: Ctx, u: Unit, x: number, y: number, asShip = isShip(u), facing = x === u.x && y === u.y ? u.facing : undefined): number {
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
    // Gegner ausser Reichweite muessen erst ziehen und feuern dann mit weniger Schaden (MOVE_FIRE)
    // enemies out of range must move first and then fire with less damage (MOVE_FIRE)
    const moveFire = dist(e, { x, y }) > unitRange(e.type, ctx.s.factions[e.owner]?.id) ? moveFireMult(ctx.s, e) : 1;
    // Strafgericht: Alvenia trifft Suender haerter / judgement: Alvenia hits sinners harder
    const judge = judges(ctx.s, e.owner) && isSinner(ctx.s, ctx.f) ? 1 + SIN.judgement : 1;
    // offener Ruecken / exposed rear
    const rear = 1 + rearAttackBonus(e, { type, x, y, facing });
    total += (A / (A + d || 1)) * a * 4.5 * counterFactor(e.type, type) * moveFire * judge * rear;
  }
  // verschanzt (Korvat) und bleibt stehen: weniger erwarteter Schaden wie in combatPreview (menschliche Schuetzen als Mass)
  // entrenched (Korvat) and staying put: less expected damage as in combatPreview (human shooters as the yardstick)
  if (x === u.x && y === u.y) total *= entrenchFactor(ctx.s, HIT.odds.human, u, true);
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
  return !has(u, 'fly') && t !== 'spy' && t !== 'artillery' && t !== 'sunLance' && t !== 'medic' && u.type !== 'heli' && u.type !== 'octocopter';
}
function isCombat(u: Unit): boolean {
  const t = u.type;
  return UNITS[t].attack > 0 && UNITS[t].range > 0 || (u.carried !== null && UNITS[u.carried].attack > 0);
}

/**
 * Kampagnenziele fuer die KI: Spieler-Seite (Spieler als KI und Verbuendete) besetzt Portal, Hoehleneingang und
 * Ruinenstaetten, rueckt zum Erreichen-Ziel vor und jagt den Endgegner; die Gegner streiten um Hoehleneingang und Ruinen.
 * Beim Turm-Ziel nimmt die Spieler-Seite die Sendetuerme ein und haelt sie besetzt, die Gegner greifen sie an.
 * Campaign objectives for the AI: the player side (player as AI and allies) occupies portal, cave entrance and ruin
 * sites, advances to the reach target and hunts the boss; the enemies contest the cave entrance and the ruins.
 * With the tower objective the player side takes and garrisons the transmitter towers, the enemies attack them.
 */
function campaignGoals(ctx: Ctx, tileSrc: (x: number, y: number) => string): Goal[] {
  const { s, f } = ctx;
  const c = s.campaign;
  if (!c || c.result) return [];
  const out: Goal[] = [];
  const A = CAMPAIGN_AI;
  const side = f === 0 || !!c.allies?.includes(f);
  /** Feld besetzen oder den feindlichen Besetzer vertreiben / occupy a tile or drive off the hostile occupant */
  const hold = (p: Pos, value: number, cap: number, hunt: number, huntCap: number) => {
    const occ = unitAt(s, p.x, p.y);
    if (occ && occ.owner !== f && isHostile(s, f, occ.owner)) out.push({ kind: 'hunt', x: p.x, y: p.y, value: hunt, cap: huntCap, distW: A.siteDistW, src: tileSrc(p.x, p.y), water: false, targetId: occ.id });
    else if (!occ || occ.owner === f) out.push({ kind: 'bunker', x: p.x, y: p.y, value, cap, distW: A.siteDistW, src: tileSrc(p.x, p.y), water: false, hold: true });
  };
  // nur Felder, die ein Ziel der Mission sind (das Portal in m11 ist Kulisse) / only tiles that are a mission objective (the portal in m11 is scenery)
  const objs = missionById(c.mission)?.objectives ?? [];
  const wants = (k: string) => objs.some((o) => o.k === k);
  // Mutterschiff (m2): Eskorte und Jagd auf den Wissenschaftler, eigene Datei mothership.ts / mothership (m2): escort and hunt for the scientist, own file mothership.ts
  if (wants('work')) out.push(...mothershipGoals(ctx));
  if (c.cave && wants('cave')) hold(c.cave, A.caveValue, A.caveCap, A.caveHuntValue, A.caveHuntCap);
  if (wants('ruins')) (c.sites ?? []).forEach((p, i) => { if (!(side && c.siteDone?.[i])) hold(p, A.siteValue, A.siteCap, A.siteValue, A.siteCap + 1); });
  // Turm-Ziel (m1): die Spieler-Seite haelt eigene Tuerme besetzt und nimmt die uebrigen ein; die Gegner greifen Tuerme der Spieler-Seite an
  // tower objective (m1): the player side keeps its own towers garrisoned and takes the rest; the enemies attack the player side's towers
  if (wants('towers')) for (const t of s.cities) {
    if (!t.tower) continue;
    const ours = t.owner !== null && (t.owner === 0 || !!c.allies?.includes(t.owner));
    if (side && ours) hold(t, A.towerValue, A.towerCap, A.towerHuntValue, A.towerHuntCap);
    else if (side) out.push({ kind: t.owner === null ? 'village' : 'city', x: t.x, y: t.y, value: A.towerValue, cap: A.towerCap + 1, distW: A.siteDistW, src: tileSrc(t.x, t.y), water: false, targetId: t.owner === null ? undefined : t.id });
    else if (ours && isHostile(s, f, t.owner!)) out.push({ kind: 'city', x: t.x, y: t.y, value: A.towerEnemyValue, cap: A.towerCap + 1, distW: A.siteDistW, src: tileSrc(t.x, t.y), water: false, targetId: t.id });
  }
  // Kriegsplaene (m4): Tempel, Traeger, Eskorte, fallen gelassene Plaene; beide Seiten (temple.ts) / war plans (m4): temple, carrier, escort, dropped plans; both sides (temple.ts)
  if (wants('plans')) out.push(...plansGoals(ctx));
  if (!side) return out;
  if (c.portal && wants('portal')) hold(c.portal, A.caveValue, A.caveCap, A.caveHuntValue, A.caveHuntCap);
  // Erreichen-Ziele: zum Zielfeld vorruecken, sobald kein Landetrupp mehr ohne Stadt ist / reach objectives: advance to the target tile once no landing party is left without a city
  for (const o of objs) {
    const p = o.k === 'reach' ? c.targets[o.target] : undefined;
    if (p && !c.landing) out.push({ kind: 'bunker', x: p.x, y: p.y, value: A.reachValue, cap: A.reachCap, distW: A.siteDistW, src: tileSrc(p.x, p.y), water: false });
  }
  // Endgegner jagen / hunt the boss
  for (const id of c.units ?? []) {
    const b = s.units.find((u) => u.id === id);
    if (b && isBoss(b) && isHostile(s, f, b.owner)) out.push({ kind: 'hunt', x: b.x, y: b.y, value: A.bossHuntValue, cap: A.bossHuntCap, distW: A.siteDistW, src: tileSrc(b.x, b.y), water: false, targetId: b.id });
  }
  return out;
}

function buildGoals(ctx: Ctx): Goal[] {
  const { s, f, prof, size } = ctx;
  const goals: Goal[] = [];
  const tileSrc = (x: number, y: number, water = false) => `t${y * size + x}${water ? 's' : 'l'}`;
  // Kult: Beute macht Siedlungen und Staedte lohnender / cult: loot makes villages and cities more attractive
  const loot = (c: City) => plunderValue(s, f, c) * AI.cultPlunderValue;
  for (const c of ctx.neutralCities) {
    // Stuetzpunkt: Wert nach Art und Fraktion (BASES.ai) / base: worth by kind and faction (BASES.ai)
    goals.push({ kind: 'village', x: c.x, y: c.y, value: 75 + loot(c) + baseCaptureWorth(s, f, c), cap: 1, distW: 9, src: tileSrc(c.x, c.y), water: false });
  }
  // schwaechsten Gegner zuerst ausschalten / finish off the weakest enemy first
  const cityCount = new Map<number, number>();
  for (const c of ctx.hostileCities) cityCount.set(c.owner!, (cityCount.get(c.owner!) ?? 0) + 1);
  const fewest = Math.min(...cityCount.values());
  for (const c of ctx.hostileCities) {
    const def = unitAt(s, c.x, c.y);
    const defended = !!def && def.owner !== f && canSeeUnit(s, f, def);
    const owned = s.cities.filter((o) => o.owner === c.owner).length;
    const value = (38 + 6 * c.level + (c.isHQ ? 15 : 0)) * prof.aggression + (defended ? 0 : 25 + prof.raid) +
      (cityCount.get(c.owner!) === fewest ? 8 : 0) + (owned <= 2 ? 15 : 0) + loot(c) + baseAttackWorth(s, f, c);
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
  // Kampagnen-Finale: das Artefakt besetzen oder den Besetzer vertreiben; Verbuendete des Spielers ueberlassen es ihm
  // campaign finale: occupy the artifact or drive off its occupant; the player's allies leave it to the player
  const art = s.campaign && !s.campaign.result ? s.campaign.artifact : undefined;
  if (art && !s.campaign!.allies?.includes(f)) {
    const occ = unitAt(s, art.x, art.y);
    if (occ && occ.owner !== f && isHostile(s, f, occ.owner)) {
      goals.push({ kind: 'hunt', x: art.x, y: art.y, value: CAMPAIGN_AI.artifactHuntValue, cap: CAMPAIGN_AI.artifactHuntCap, distW: CAMPAIGN_AI.artifactDistW, src: tileSrc(art.x, art.y), water: false, targetId: occ.id });
    } else if (!occ || occ.owner === f) {
      goals.push({ kind: 'bunker', x: art.x, y: art.y, value: CAMPAIGN_AI.artifactValue, cap: CAMPAIGN_AI.artifactCap, distW: CAMPAIGN_AI.artifactDistW, src: tileSrc(art.x, art.y), water: false });
    }
  }
  goals.push(...campaignGoals(ctx, tileSrc));
  for (const c of ctx.myCities) {
    const near = ctx.enemies.filter((e) => dist(e, c) <= 3 && UNITS[e.type].attack > 0);
    if (!near.length) continue;
    // Akademie (Velkar): das Herz der Fraktion, entschlossen verteidigen / academy (Velkar): the faction's heart, defend it firmly
    const value = 55 + 10 * c.level + (c.isHQ ? 25 : 0) + (c.academy ? 30 : 0) + 8 * near.length + baseDefendWorth(s, f, c);
    goals.push({ kind: 'defend', x: c.x, y: c.y, value, cap: Math.min(3, near.length + 1), distW: 12, src: tileSrc(c.x, c.y), water: false });
  }
  // Feindliche Wunder: hoechster Vorrang, jeder Treffer unterbricht oder schwaecht / hostile wonders: top priority, every hit interrupts or weakens
  for (const e of ctx.enemies) {
    if (!isWonder(e)) continue;
    const ratio = victoryStatus(s, e.owner).ratio;
    goals.push({ kind: 'hunt', x: e.x, y: e.y, value: 95 + ratio * 80, cap: 6, distW: 3, src: tileSrc(e.x, e.y), water: false, targetId: e.id });
  }
  // Eigene Wunder bewachen (den Bohrer nur der Kult mit seiner Horde) / guard own wonders (the drill only the cult with its horde)
  for (const u of ctx.my) {
    if (!isWonder(u) || (u.type === 'coreDrill' && !isCultFaction(s, f))) continue;
    const near = ctx.enemies.filter((e) => dist(e, u) <= 4 && UNITS[e.type].attack > 0).length;
    goals.push({ kind: 'defend', x: u.x, y: u.y, value: 60 + 12 * near + victoryStatus(s, f).ratio * 30, cap: 2 + Math.min(3, near), distW: 8, src: tileSrc(u.x, u.y), water: false });
  }
  for (const e of ctx.enemies) {
    if (isWonder(e)) continue;
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
    case 'bunker': return g.water ? (fly || isShip(u)) : u.type !== 'spy' && !(g.hold && (u.type === 'artillery' || u.type === 'sunLance' || fly));
    case 'defend': case 'hunt': return isCombat(u) && u.type !== 'medic';
    case 'explore': return u.type !== 'artillery' && u.type !== 'sunLance' && u.type !== 'medic' && u.type !== 'spy';
    default: return true;
  }
}

function assignGoals(ctx: Ctx) {
  const { s, f, prof } = ctx;
  const goals = buildGoals(ctx);
  // Hauptziel: erreichbare Stadt, auf die sich die Armee konzentriert / main target: a reachable city the army concentrates on
  const fighters = ctx.my.filter((u) => isCombat(u) && canCaptureType(u) && !isShip(u) && !isWonder(u));
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
  // Wunder planen eigens (planWonderUnits), Endgegner bewachen ihr Hauptquartier (bossGoal)
  // wonders are planned separately (planWonderUnits), bosses guard their HQ (bossGoal)
  // Festungsbau: Bauer ziehen zur bedrohtesten Stadt ohne Stellung / fortification: builders head to the most threatened city without an emplacement
  const builder = new Map<number, Goal>();
  for (const u of ctx.my) { const g = emplacementGoal(ctx, u) ?? siloGoal(ctx, u) ?? sabotageGoal(ctx, u); if (g) builder.set(u.id, g); }
  // Traeger der Kriegsplaene (m4): immer heim zum Hauptquartier / carrier of the war plans (m4): always home to the HQ
  const carrier = carrierGoal(ctx);
  if (carrier) builder.set(carrier.unit.id, carrier.goal);
  // leeres Transportboot (Werft): wartet ohne Ziel, bis eine Landeinheit einsteigt / empty transport boat (shipyard): waits without a goal until a land unit boards
  const ferry = (u: Unit) => (u.type === 'landingBoat' || u.type === 'fogCutter') && u.carried === null;
  const special = (u: Unit) => u.type === 'spy' || u.type === 'medic' || has(u, 'mines') || has(u, 'radar') || isWonder(u) || isBoss(u) || builder.has(u.id) || isScientist(ctx, u) || ferry(u);
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
    if (ctx.goals.has(u.id) || isWonder(u) || ferry(u)) continue;
    if (isBoss(u)) { ctx.goals.set(u.id, bossGoal(ctx, u)); continue; }
    // Wissenschaftler (m2): zum Arbeitsplatz am Mutterschiff / scientist (m2): to the work spot at the mothership
    if (isScientist(ctx, u)) { const g = scientistGoal(ctx, u); if (g) { ctx.goals.set(u.id, g); continue; } }
    if (builder.has(u.id)) { ctx.goals.set(u.id, builder.get(u.id)!); continue; }
    if (u.type === 'spy') { ctx.goals.set(u.id, spyGoal(ctx, u)); continue; }
    if (u.type === 'medic') { ctx.goals.set(u.id, medicGoal(ctx, u)); continue; }
    // Radarwagen: hinter der vordersten Kampfeinheit / Radar Truck: behind the foremost combat unit
    if (has(u, 'radar')) { ctx.goals.set(u.id, radarGoal(ctx, u, front)); continue; }
    if (has(u, 'mines')) { ctx.goals.set(u.id, minerGoal(ctx)); continue; }
    ctx.goals.set(u.id, front);
  }
}

/**
 * Endgegner: Heimatfeld ist das eigene Hauptquartier, sonst die naechste eigene Stadt, sonst das eigene Feld.
 * Boss: the home tile is the own HQ, else the nearest own city, else its own tile.
 */
export function bossHome(ctx: Ctx, u: Unit): Pos {
  const hq = hqOf(ctx.s, ctx.f) ?? ctx.myCities.slice().sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0];
  return hq ? { x: hq.x, y: hq.y } : { x: u.x, y: u.y };
}

/**
 * Endgegner: jagt Eindringlinge im Umkreis SWARM_MOTHER.aiLeash um ihr Hauptquartier (die schwaechsten zuerst, dort
 * wirken Schrei und Brut), sonst bewacht sie es. Die Zuege bleiben an der Leine (planUnitMoves).
 * Boss: hunts intruders within SWARM_MOTHER.aiLeash of her HQ (the weakest first, where scream and brood work),
 * otherwise she guards it. Moves stay on the leash (planUnitMoves).
 */
function bossGoal(ctx: Ctx, u: Unit): Goal {
  const home = bossHome(ctx, u);
  const near = ctx.enemies.filter((e) => dist(e, home) <= SWARM_MOTHER.aiLeash && !isWonder(e))
    .sort((a, b) => a.hp - b.hp || dist(a, u) - dist(b, u) || a.id - b.id);
  const e = near[0];
  if (e) return { kind: 'hunt', x: e.x, y: e.y, value: 90, cap: 99, distW: 0, src: `t${e.y * ctx.size + e.x}l`, water: false, targetId: e.id };
  return { kind: 'defend', x: home.x, y: home.y, value: 60, cap: 99, distW: 0, src: `t${home.y * ctx.size + home.x}l`, water: false };
}

function frontGoal(ctx: Ctx): Goal {
  const { size } = ctx;
  // eigenes Hauptquartier, kein erobertes fremdes / own HQ, not a captured foreign one
  const hq = hqOf(ctx.s, ctx.f) ?? ctx.myCities[0];
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
