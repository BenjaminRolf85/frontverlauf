/**
 * Operative Ebene der KI: benannte Taktiken ueber mehrere Zuege (Sturmangriff, Ablenkungsangriff, Einkreisen,
 * Rueckenangriff, vorgetaeuschter Rueckzug, Hinterhalt).
 * Operational AI layer: named tactics over several turns (storm assault, diversion, encirclement, rear attack,
 * feigned retreat, ambush).
 *
 * Plaene liegen im KI-Gedaechtnis je Spielzustand (WeakMap, nicht im Spielstand): nach dem Laden beginnt die KI einfach
 * neue Plaene. refreshOps laeuft einmal je Zug und Fraktion (Plaene pruefen, abschliessen, neue starten), applyOps bei
 * jedem Befehl (Ziele der Mitglieder ueberschreiben, Rollen fuer die Haken in tactics.ts: opTileValue in evalTile,
 * opAttackValue in planAttack, opCaution in cautionFor). Ohne Taktik (setAiTactics aus) bleibt alles wie zuvor.
 * Plans live in the AI memory per game state (WeakMap, not in the save): after loading the AI simply starts new plans.
 * refreshOps runs once per turn and faction (check plans, finish them, start new ones), applyOps on every command
 * (override the members' goals, roles for the hooks in tactics.ts: opTileValue in evalTile, opAttackValue in planAttack,
 * opCaution in cautionFor). Without tactics (setAiTactics off) everything stays as before.
 *
 * Deterministisch (hashNoise statt Math.random), sieht nur, was die Fraktion sieht (ctx.enemies, erkundete Staedte).
 * Deterministic (hashNoise instead of Math.random), only sees what the faction sees (ctx.enemies, explored cities).
 */
import {
  canAttackNow, canMove, cityById, dist, effectiveRange, facingTowards, has, idx, inRearArc, isBoss, isEntrenched,
  isHostile, isJungle, isShip, isWater, isWonder, moveFireMult, neighbors, reachable, retreatTile, turretList,
  unitAt, type City, type GameState, type Pos, type Unit,
} from '../core';
import { AI_TACTICS, EMPLACEMENT, TACTIC_KINDS, UNITS, type TacticKind } from '../data/balance';
import { fieldAt, fieldFor, speedOf, worth, type Ctx, type Goal } from './analysis';
import { hashNoise } from './profile';

export type OpRole = 'striker' | 'raider' | 'pin' | 'hammer' | 'flanker' | 'bait' | 'killzone' | 'ambusher';
export type OpStage = 'gather' | 'strike';

export interface OpMember { id: number; role: OpRole; slot?: Pos }

/** Laufende Operation / running operation */
export interface Op {
  id: number;
  kind: TacticKind;
  /** Startrunde und spaetestes Ende / start round and latest end */
  start: number;
  until: number;
  stage: OpStage;
  /** Zielfeld (Stadt, Gegner, Anmarsch) / target tile (city, enemy, approach) */
  x: number;
  y: number;
  /** Zieleinheit (Einkreisen, Rueckenangriff) / target unit (encirclement, rear attack) */
  unit?: number;
  /** Zielstadt (Sturm, Ablenkung) / target city (storm, diversion) */
  city?: number;
  /** Hauptfront der Ablenkung / main front of the diversion */
  front?: Pos;
  /** Feuerzone (vorgetaeuschter Rueckzug): Feld und Reichweite / kill zone (feigned retreat): tile and range */
  zone?: (Pos & { r: number; w: number })[];
  /** Hinterhalt ausgeloest (Runde) / ambush sprung (round) */
  sprung?: number;
  members: OpMember[];
}

/** Rolle einer Einheit fuer diesen Befehl / role of a unit for this command */
export interface OpSlot { op: Op; role: OpRole; slot?: Pos }

export type TacticCount = Record<TacticKind, number>;
export interface TacticStats {
  started: TacticCount;
  completed: TacticCount;
  aborted: TacticCount;
  /** Staedte, die eine Ablenkungsgruppe bzw. ein Sturm genommen hat / cities taken by a diversion group or a storm */
  diversionCaptures: number;
  stormCaptures: number;
}

/** Meldung fuer die Oberflaeche (grosse Operation beginnt) / notice for the UI (a big operation begins) */
export interface OpNews { round: number; faction: number; kind: TacticKind; x: number; y: number; city?: number; target?: number; units: number[] }

interface Memory {
  on: boolean;
  turn: string;
  ops: Op[];
  nextId: number;
  stats: TacticStats;
  news: OpNews[];
}

const memory = new WeakMap<GameState, Memory[]>();
const zero = (): TacticCount => ({ storm: 0, diversion: 0, encircle: 0, rear: 0, feint: 0, ambush: 0 });

function mem(s: GameState, f: number): Memory {
  let list = memory.get(s);
  if (!list) { list = []; memory.set(s, list); }
  let m = list[f];
  if (!m) {
    m = { on: true, turn: '', ops: [], nextId: 1, stats: { started: zero(), completed: zero(), aborted: zero(), diversionCaptures: 0, stormCaptures: 0 }, news: [] };
    list[f] = m;
  }
  return m;
}

/**
 * Taktiken fuer eine Fraktion an- oder ausschalten (Vergleich neue gegen alte KI, Tests). Standard: an.
 * Turn tactics on or off for a faction (new vs old AI comparison, tests). Default: on.
 */
export function setAiTactics(s: GameState, f: number, on: boolean): void {
  const m = mem(s, f);
  m.on = on;
  if (!on) m.ops = [];
}

/** Statistik der Fraktion (Messung) / statistics of the faction (measurement) */
export function tacticStats(s: GameState, f: number): TacticStats {
  return mem(s, f).stats;
}

/** Laufende Operationen (Tests, Diagnose) / running operations (tests, diagnostics) */
export function activeOps(s: GameState, f: number): readonly Op[] {
  return mem(s, f).ops;
}

/** Rolle einer Einheit in einer laufenden Operation / role of a unit in a running operation */
export function opRoleOf(s: GameState, f: number, unitId: number): { kind: TacticKind; role: OpRole } | null {
  for (const op of mem(s, f).ops) {
    const mb = op.members.find((m) => m.id === unitId);
    if (mb) return { kind: op.kind, role: mb.role };
  }
  return null;
}

/**
 * Meldungen seit dem letzten Abruf (alle Fraktionen) und leeren; die Oberflaeche zeigt nur, was der Mensch sieht.
 * Notices since the last call (all factions), then cleared; the UI only shows what the human can see.
 */
export function takeOpNews(s: GameState): OpNews[] {
  const list = memory.get(s);
  if (!list) return [];
  const out: OpNews[] = [];
  for (const m of list) if (m && m.news.length) { out.push(...m.news); m.news = []; }
  return out;
}

type Cfg = (typeof AI_TACTICS.difficulty)['normal'];

function configFor(ctx: Ctx): Cfg | null {
  const m = mem(ctx.s, ctx.f);
  if (!m.on) return null;
  return AI_TACTICS.difficulty[ctx.fa.difficulty] ?? AI_TACTICS.difficulty.normal;
}

const weightOf = (ctx: Ctx, k: TacticKind): number => AI_TACTICS.weights[ctx.fa.id]?.[k] ?? 1;
const tileSrc = (ctx: Ctx, p: Pos) => `t${p.y * ctx.size + p.x}l`;
const hpShare = (u: Unit) => u.hp / Math.max(1, u.maxHp);
const strength = (u: Unit) => worth(u) * hpShare(u);
const isFighter = (u: Unit) => UNITS[u.type].attack > 0 && UNITS[u.type].range > 0 && !isWonder(u) && !isBoss(u);
/** kann Staedte einnehmen / can capture cities */
const capturer = (u: Unit) => !has(u, 'fly') && !isShip(u) && !['spy', 'artillery', 'sunLance', 'divineSpark', 'medic', 'rocketCart', 'railgun'].includes(u.type) && !has(u, 'kamikaze');
/** volle Wirkung nach Bewegung (Dravon, Steppenreiter) oder Kamikaze / full effect after moving (Dravon, Steppe Riders) or kamikaze */
const fullMover = (s: GameState, u: Unit) => has(u, 'dash') && (has(u, 'kamikaze') || moveFireMult(s, u) >= 0.99);
/** Fernkaempfer / ranged unit */
const ranged = (u: Unit) => UNITS[u.type].range >= 2;

/** Ziele, aus denen eine Einheit fuer eine Operation abgezogen werden darf / goals a unit may be taken from for an operation */
const GENERIC = new Set<Goal['kind']>(['city', 'village', 'hunt', 'stage', 'explore', 'home', 'defend']);

/** Freie Einheit fuer Operationen? / free unit for operations? */
function free(ctx: Ctx, u: Unit, busy: Set<number>, allowDefend: boolean, garrison = !allowDefend): boolean {
  if (busy.has(u.id) || !isFighter(u) || isShip(u) || u.fuel !== null || u.carried) return false;
  // Besatzung einer eigenen Stadt bleibt fuer oertliche Taktiken drin / the garrison of an own city stays in for local tactics
  if (!garrison) { const c = ctx.s.tiles[idx(ctx.size, u.x, u.y)].cityId; if (c !== null && ctx.myCities.some((m) => m.id === c)) return false; }
  if (u.type === 'medic' || u.type === 'spy' || has(u, 'mines') || has(u, 'wonder')) return false;
  const g = ctx.goals.get(u.id);
  if (!g || !GENERIC.has(g.kind) || g.hold) return false;
  if (g.kind === 'defend' && !allowDefend) return false;
  // Kampagne: Missionsziele (Halte- und Begleitziele) haben Vorrang / campaign: mission goals (hold and escort goals) come first
  if (ctx.s.campaign && g.kind === 'defend') return false;
  return u.hp >= u.maxHp * 0.4;
}

// ---------- pro Befehl / per command ----------

/**
 * Operationen fuer diesen Befehl anwenden: einmal je Zug neu planen, dann Ziele der Mitglieder ueberschreiben.
 * Apply operations for this command: re-plan once per turn, then override the members' goals.
 */
export function applyOps(ctx: Ctx): void {
  const cfg = configFor(ctx);
  if (!cfg) return;
  ctx.coordinate = cfg.coordinate;
  const m = mem(ctx.s, ctx.f);
  const key = `${ctx.s.round}:${ctx.f}`;
  if (m.turn !== key) {
    m.turn = key;
    refresh(ctx, m, cfg);
  }
  if (!m.ops.length) return;
  const byId = new Map<number, Unit>();
  for (const u of ctx.my) byId.set(u.id, u);
  for (const op of m.ops) {
    for (const mb of op.members) {
      const u = byId.get(mb.id);
      if (!u) continue;
      const slot: OpSlot = { op, role: mb.role, slot: mb.slot };
      ctx.ops.set(u.id, slot);
      const g = goalFor(ctx, slot, u);
      if (g) ctx.goals.set(u.id, g);
    }
  }
}

function goalFor(ctx: Ctx, o: OpSlot, u: Unit): Goal | null {
  const { op } = o;
  const base = { value: 100, cap: 99, distW: 0, water: false, op: o };
  const at = (kind: Goal['kind'], p: Pos, targetId?: number): Goal => ({ ...base, kind, x: p.x, y: p.y, src: tileSrc(ctx, p), ...(targetId !== undefined ? { targetId } : {}) });
  switch (o.role) {
    case 'striker': return capturer(u) ? at('city', op, op.city) : at('stage', op);
    case 'raider': {
      const c = op.city !== undefined ? cityById(ctx.s, op.city) : undefined;
      return at(c && c.owner === null ? 'village' : 'city', op, op.city);
    }
    case 'pin': {
      if (!op.front) return null;
      // Bindegruppe: sichtbarer Angriff auf die Hauptfront / pinning group: visible attack on the main front
      const fc = ctx.s.tiles[idx(ctx.size, op.front.x, op.front.y)].cityId;
      return capturer(u) && fc !== null ? at('city', op.front, fc) : at('stage', op.front);
    }
    case 'hammer': return at('hunt', o.slot ?? op, op.unit);
    case 'flanker': return at('hunt', o.slot ?? op, op.unit);
    case 'bait': return o.slot ? at('stage', o.slot) : null;
    case 'killzone': return at('stage', o.slot ?? u);
    case 'ambusher': return o.slot ? at('stage', o.slot) : null;
  }
  return null;
}

/** Vorsicht fuer Mitglieder (null = normale Regel) / caution for members (null = normal rule) */
export function opCaution(ctx: Ctx, g: Goal, u?: Unit): number | null {
  const o = g.op;
  if (!o) return null;
  const T = AI_TACTICS;
  switch (o.role) {
    case 'striker': return o.op.stage === 'strike' ? T.storm.strikeCaution : 1.1;
    case 'raider': return u && dist(u, o.op) > 2 ? T.diversion.routeCaution : T.diversion.nearCaution;
    case 'pin': return T.diversion.pinCaution;
    case 'hammer': return T.encircle.caution;
    case 'flanker': return 0.7;
    case 'ambusher': return T.ambush.caution;
    default: return null;
  }
}

const enemyCache = new WeakMap<Ctx, Map<number, Unit>>();
function visibleEnemy(ctx: Ctx, id: number | undefined): Unit | undefined {
  if (id === undefined) return undefined;
  let m = enemyCache.get(ctx);
  if (!m) { m = new Map(); for (const e of ctx.enemies) m.set(e.id, e); enemyCache.set(ctx, m); }
  return m.get(id);
}

/**
 * Zusatzwert eines Endfelds fuer ein Mitglied (Haken in evalTile).
 * Extra value of a destination tile for a member (hook in evalTile).
 */
export function opTileValue(ctx: Ctx, u: Unit, g: Goal, x: number, y: number): number {
  const o = g.op;
  if (!o) return 0;
  const { op } = o;
  const T = AI_TACTICS;
  const p = { x, y };
  const k = y * ctx.size + x;
  const w = weightOf(ctx, op.kind);
  switch (o.role) {
    case 'striker': {
      const d = dist(op, p);
      const threatened = ctx.threat[k].length > 0;
      if (op.stage === 'gather') {
        // ausserhalb der Gefahr sammeln, nicht einzeln hineinlaufen / gather outside the danger, do not trickle in
        const here = x === u.x && y === u.y;
        if (d <= 3 && threatened && !here) return -T.storm.gatherPenalty;
        const ring = ranged(u) ? d <= effectiveRange(ctx.s, u) + 1 : d >= 2 && d <= 3;
        return ring && !threatened ? T.storm.ringBonus : 0;
      }
      return d === 1 ? T.storm.ringBonus : 0;
    }
    case 'raider': {
      // unterwegs keinen Kampf suchen / avoid fights en route
      if (dist(op, p) <= 2) return 0;
      let n = 0;
      for (const e of ctx.enemies) if (dist(e, p) === 1 && UNITS[e.type].attack > 0) n++;
      return -6 * n;
    }
    case 'hammer': {
      const e = visibleEnemy(ctx, op.unit);
      let v = o.slot && o.slot.x === x && o.slot.y === y ? T.encircle.slotBonus : 0;
      if (e && dist(e, p) === 1) v += T.encircle.adjBonus + (inRearArc(e, p) ? 3 : 0);
      return v;
    }
    case 'flanker': {
      const e = visibleEnemy(ctx, op.unit);
      if (!e) return 0;
      let v = 0;
      if (inRearArc(e, p) && dist(e, p) <= Math.max(1, effectiveRange(ctx.s, u))) v += T.rear.tileBonus * w;
      if (o.slot && o.slot.x === x && o.slot.y === y) v += 4;
      return v;
    }
    case 'bait': {
      if (op.stage !== 'gather') return 0;
      let v = o.slot && o.slot.x === x && o.slot.y === y ? T.feint.tileBonus : 0;
      v += zoneCover(op, p) * T.feint.coverBonus;
      return v;
    }
    case 'killzone':
      // Stellung halten (verschanzt bleiben, ohne Abzug feuern) / hold the position (stay entrenched, fire without penalty)
      return op.stage === 'gather' && x === u.x && y === u.y ? T.feint.holdBonus : 0;
    case 'ambusher': {
      if (!o.slot || o.slot.x !== x || o.slot.y !== y) return 0;
      return T.ambush.slotBonus + (x === u.x && y === u.y ? T.ambush.holdBonus : 0);
    }
    default: return 0;
  }
}

/** Deckung durch die Feuerzone: wie viele Schuetzen treffen ein Nachbarfeld von p / kill zone cover: how many shooters reach a neighbour of p */
function zoneCover(op: Op, p: Pos): number {
  let c = 0;
  for (const z of op.zone ?? []) if (dist(z, p) <= z.r + 1 && !(z.x === p.x && z.y === p.y)) c += z.w;
  return c;
}

/**
 * Zusatzwert eines Angriffs von u auf t (Haken in planAttack): Reihenfolge im Sturm, Hinterhalt, Einkreisen, Feuerzone.
 * Extra value of an attack by u on t (hook in planAttack): order in a storm, ambush, encirclement, kill zone.
 */
export function opAttackValue(ctx: Ctx, u: Unit, t: Unit): number {
  const o = ctx.ops.get(u.id);
  if (!o) return 0;
  const { op } = o;
  const T = AI_TACTICS;
  switch (o.role) {
    case 'striker': {
      if (op.stage === 'strike') return dist(t, op) <= 1 ? T.storm.strikeBonus + T.storm.attackRelax : 0;
      const g = ctx.goals.get(u.id);
      return u.moved && g && opHoldsFire(ctx, u, g) ? -8 : 0;
    }
    case 'hammer': case 'flanker': {
      // Sammelphase: kein Angriff nach Bewegung mit halbem Schaden / gathering: no half-damage attack after moving
      const g = ctx.goals.get(u.id);
      if (u.moved && g && opHoldsFire(ctx, u, g)) return -8;
      return t.id === op.unit ? T.encircle.attackBonus : 0;
    }
    case 'ambusher': return T.ambush.attackBonus;
    case 'bait': case 'killzone': return op.stage === 'strike' ? T.feint.strikeBonus : 0;
    case 'raider': return t.x === op.x && t.y === op.y ? 2 : -3;
    default: return 0;
  }
}

/**
 * Rang im Sturm (nur fuer die Reihenfolge): Kamikaze und Fernkampf eroeffnen, dann schwere Einheiten, die Infanterie
 * greift zuletzt an und nimmt ein.
 * Rank in a storm (order only): kamikaze and ranged units open, then heavy units, the infantry attacks last and captures.
 */
export function opAttackOrder(ctx: Ctx, u: Unit, t: Unit): number {
  const o = ctx.ops.get(u.id);
  if (!o || o.role !== 'striker' || o.op.stage !== 'strike' || dist(t, o.op) > 1) return 0;
  const T = AI_TACTICS.storm.order;
  const st = UNITS[u.type];
  return has(u, 'kamikaze') ? T.opener : st.range >= 2 && !has(u, 'dash') ? T.ranged : st.range >= 2 || st.attack >= 4 ? T.heavy : 0;
}

/** Geordneter Rueckzug des Koeders in die Feuerzone / the bait's orderly retreat into the kill zone */
export function opRetreatValue(ctx: Ctx, u: Unit, t: Unit): number {
  const o = ctx.ops.get(u.id);
  if (!o) return 0;
  // Einkreisen und Sturm: gesunde Mitglieder halten ihre Felder statt auszuweichen / encirclement and storm: healthy members hold their tiles instead of backing off
  if ((o.role === 'hammer' || o.role === 'striker' || o.role === 'flanker') && u.hp >= u.maxHp * 0.45) return -100;
  if (o.role !== 'bait' || o.op.stage !== 'gather') return 0;
  const to = retreatTile(ctx.s, u, t);
  return to && zoneCover(o.op, to) > 0 ? AI_TACTICS.feint.retreatBonus : 0;
}

// ---------- einmal je Zug / once per turn ----------

interface Cand { kind: TacticKind; score: number; key: string; make: () => Op }

function refresh(ctx: Ctx, m: Memory, cfg: Cfg) {
  // 1. laufende Plaene pruefen / check running plans
  const keep: Op[] = [];
  for (const op of m.ops) {
    if (!cfg.kinds.includes(op.kind)) { m.stats.aborted[op.kind]++; continue; }
    const r = check(ctx, m, op);
    if (r === 'keep') keep.push(op);
    else if (r === 'done') m.stats.completed[op.kind]++;
    else m.stats.aborted[op.kind]++;
  }
  m.ops = keep;
  if (m.ops.length >= cfg.maxOps) return;
  // 2. neue Gelegenheiten / new opportunities
  const busy = new Set<number>();
  for (const op of m.ops) for (const mb of op.members) busy.add(mb.id);
  const targets = new Set(m.ops.map((o) => `${o.kind}:${o.x},${o.y}`));
  // Schwierigkeit: nur ein Teil der Gelegenheiten wird genutzt / difficulty: only a share of the opportunities is taken
  let kinds = TACTIC_KINDS.filter((kind, ki) => cfg.kinds.includes(kind) && (cfg.chance >= 1 || hashNoise(ctx.s.round, ctx.f, ki, 31) < cfg.chance));
  // zweiter Durchgang fuer Taktiken, deren Einheiten eine bessere Operation schon gebunden hat
  // second pass for tactics whose units a better operation has already taken
  for (let pass = 0; pass < 2 && kinds.length && m.ops.length < cfg.maxOps; pass++) {
    const cands: Cand[] = [];
    for (const kind of kinds) for (const c of GEN[kind](ctx, busy, cfg, weightOf(ctx, kind))) cands.push(c);
    cands.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    const retry = new Set<TacticKind>();
    for (const c of cands) {
      if (m.ops.length >= cfg.maxOps || c.score <= 0) break;
      const op = c.make();
      const tk = `${op.kind}:${op.x},${op.y}`;
      if (targets.has(tk) || !op.members.length) continue;
      if (op.members.some((mb) => busy.has(mb.id))) { retry.add(c.kind); continue; }
      op.id = m.nextId++;
      m.ops.push(op);
      targets.add(tk);
      for (const mb of op.members) busy.add(mb.id);
      m.stats.started[op.kind]++;
      if (op.kind === 'storm' && op.stage === 'strike') news(ctx, m, op);
      else if (op.kind === 'diversion' || op.kind === 'encircle') news(ctx, m, op);
    }
    kinds = kinds.filter((k) => retry.has(k));
  }
}

function news(ctx: Ctx, m: Memory, op: Op) {
  m.news.push({
    round: ctx.s.round, faction: ctx.f, kind: op.kind, x: op.x, y: op.y, units: op.members.map((mb) => mb.id),
    ...(op.city !== undefined ? { city: op.city } : {}), ...(op.unit !== undefined ? { target: op.unit } : {}),
  });
  if (m.news.length > 20) m.news.splice(0, m.news.length - 20);
}

function alive(ctx: Ctx, op: Op): Unit[] {
  const out: Unit[] = [];
  op.members = op.members.filter((mb) => {
    const u = ctx.my.find((x) => x.id === mb.id);
    if (u) out.push(u);
    return !!u;
  });
  return out;
}

/** Plan pruefen und Phase fortschreiben / check a plan and advance its stage */
function check(ctx: Ctx, m: Memory, op: Op): 'keep' | 'done' | 'fail' {
  const { s, f } = ctx;
  const units = alive(ctx, op);
  const T = AI_TACTICS;
  switch (op.kind) {
    case 'storm': {
      const c = op.city !== undefined ? cityById(s, op.city) : undefined;
      if (!c) return 'fail';
      if (c.owner === f) { m.stats.stormCaptures++; return 'done'; }
      if (c.owner === null || !isHostile(s, f, c.owner)) return 'fail';
      if (units.length < 2 || s.round > op.until) return 'fail';
      if (op.stage === 'gather') {
        const ready = units.filter((u) => dist(u, c) <= Math.max(3, effectiveRange(s, u) + 1)).length;
        if (ready >= units.length * T.storm.readyShare || s.round - op.start >= T.storm.gatherTurns) {
          op.stage = 'strike';
          op.until = s.round + T.storm.strikeTurns;
          news(ctx, m, op);
        }
      } else {
        // Sturm abbrechen, wenn die Kraft nicht mehr reicht / abort the storm when the force no longer suffices
        let own = 0;
        for (const u of units) own += strength(u);
        if (own < cityOpp(ctx, c) * 0.7) return 'fail';
      }
      return 'keep';
    }
    case 'diversion': {
      const c = op.city !== undefined ? cityById(s, op.city) : undefined;
      if (!c) return 'fail';
      if (c.owner === f) {
        if (units.some((u) => u.x === c.x && u.y === c.y && op.members.some((mb) => mb.id === u.id && mb.role === 'raider'))) m.stats.diversionCaptures++;
        return 'done';
      }
      if (c.owner !== null && !isHostile(s, f, c.owner)) return 'fail';
      const raiders = units.filter((u) => op.members.some((mb) => mb.id === u.id && mb.role === 'raider'));
      if (!raiders.length || s.round > op.until) return 'fail';
      let opp = 0;
      for (const e of ctx.enemies) if (dist(e, c) <= 1) opp += strength(e);
      let own = 0;
      for (const u of raiders) own += strength(u);
      if (opp > own * 1.2 + 5) return 'fail';
      return 'keep';
    }
    case 'encircle': case 'rear': {
      const target = s.units.find((u) => u.id === op.unit);
      if (!target) return 'done';
      const e = visibleEnemy(ctx, op.unit);
      if (!e || s.round > op.until || !units.length) return 'fail';
      if (op.kind === 'encircle' && units.length < 2) return 'fail';
      if (units.every((u) => dist(u, e) > 6)) return 'fail';
      op.x = e.x; op.y = e.y;
      // Felder neu verteilen (das Ziel kann gezogen sein) / re-distribute the tiles (the target may have moved)
      if (op.kind === 'encircle') {
        assignRing(ctx, e, units, op.members);
        // zuschlagen, sobald zwei Mitglieder angreifen koennen (oder nach zwei Zuegen) / strike once two members can attack (or after two turns)
        if (op.stage === 'gather' && (inContact(ctx, e, units) >= 2 || s.round - op.start >= 2)) op.stage = 'strike';
      }
      else for (const mb of op.members) { const u = units.find((x) => x.id === mb.id); if (u) mb.slot = rearSlot(ctx, e, u, null) ?? undefined; }
      return 'keep';
    }
    case 'feint': {
      if (op.stage === 'gather') {
        // der Verfolger ist in die Feuerzone gefolgt? sonst abbrechen / did the pursuer follow into the kill zone? else abort
        op.stage = 'strike';
        const followed = ctx.enemies.some((e) => UNITS[e.type].attack > 0 && zoneCover(op, e) > 0);
        return units.length && followed ? 'keep' : 'fail';
      }
      return 'done';
    }
    case 'ambush': {
      if (op.sprung !== undefined) return 'done';
      if (!units.length || s.round > op.until) return 'fail';
      // ausgeloest: ein Gegner steht in Reichweite eines Mitglieds / sprung: an enemy is within reach of a member
      for (const u of units) {
        const r = effectiveRange(s, u) + (fullMover(s, u) ? UNITS[u.type].move : 0);
        if (ctx.enemies.some((e) => dist(e, u) <= r && UNITS[e.type].attack > 0)) { op.sprung = s.round; break; }
      }
      if (op.sprung === undefined && !ctx.enemies.some((e) => dist(e, op) <= 7)) return 'fail';
      return 'keep';
    }
  }
  return 'fail';
}

// ---------- Gelegenheiten / opportunities ----------

type Gen = (ctx: Ctx, busy: Set<number>, cfg: Cfg, w: number) => Cand[];

function newOp(ctx: Ctx, kind: TacticKind, rounds: number, at: Pos, extra: Partial<Op> = {}): Op {
  return { id: 0, kind, start: ctx.s.round, until: ctx.s.round + rounds, stage: 'gather', x: at.x, y: at.y, members: [], ...extra };
}

/** Kraft einer feindlichen Stadt: Verteidiger, Gegner im Umkreis 3 und Stadtzuschlag / strength of a hostile city */
function cityOpp(ctx: Ctx, c: City): number {
  let opp = c.bunkerRing ? AI_TACTICS.storm.bunkerOpp : AI_TACTICS.storm.cityOpp;
  for (const e of ctx.enemies) if (dist(e, c) <= 3 && !(isWonder(e) && e.type !== 'waal')) opp += strength(e);
  return opp;
}

/** Sturmangriff auf eine Stadt / storm assault on a city */
const genStorm: Gen = (ctx, busy, cfg, w) => {
  const T = AI_TACTICS.storm;
  const out: Cand[] = [];
  const pool = ctx.my.filter((u) => free(ctx, u, busy, false));
  if (pool.length < T.minUnits) return out;
  for (const c of ctx.hostileCities) {
    const fld = fieldFor(ctx, tileSrc(ctx, c), false);
    const list: { u: Unit; d: number }[] = [];
    let own = 0;
    for (const u of pool) {
      const d = dist(u, c);
      if (d > T.radius) continue;
      const turns = fieldAt(ctx, fld, u.x, u.y, 0) / speedOf(u);
      if (!(turns <= T.maxTurns)) continue;
      list.push({ u, d });
      own += strength(u);
    }
    if (list.length < T.minUnits) continue;
    const opp = cityOpp(ctx, c);
    const need = T.ratio / Math.sqrt(w);
    const ratio = own / Math.max(1, opp);
    if (ratio < need) continue;
    const score = (40 + 8 * c.level + (c.isHQ ? 20 : 0)) * Math.min(2, ratio / need) * w;
    out.push({
      kind: 'storm', score, key: `s${c.id}`,
      make: () => {
        list.sort((a, b) => a.d - b.d || a.u.id - b.u.id);
        const mem = list.slice(0, cfg.maxMembers + 2);
        const near = mem.every((x) => x.d <= 3);
        return newOp(ctx, 'storm', T.gatherTurns + T.strikeTurns, c, {
          city: c.id, stage: near ? 'strike' : 'gather', members: mem.map((x) => ({ id: x.u.id, role: 'striker' as OpRole })),
        });
      },
    });
  }
  return out;
};

/** Hauptfront: Stadt, auf die die meisten Einheiten zielen / main front: the city most units are heading for */
function mainFront(ctx: Ctx): City | null {
  const m = mem(ctx.s, ctx.f);
  const storm = m.ops.find((o) => o.kind === 'storm');
  if (storm && storm.city !== undefined) { const c = cityById(ctx.s, storm.city); if (c) return c; }
  const count = new Map<number, number>();
  for (const g of ctx.goals.values()) if (g.kind === 'city' && g.targetId !== undefined) count.set(g.targetId, (count.get(g.targetId) ?? 0) + 1);
  let best: City | null = null, bn = 1;
  for (const c of ctx.hostileCities) { const n = count.get(c.id) ?? 0; if (n > bn) { bn = n; best = c; } }
  return best;
}

/** Ablenkungsangriff: kleine schnelle Gruppe nimmt eine entlegene Stadt / diversion: a small fast group takes a remote city */
const genDiversion: Gen = (ctx, busy, _cfg, w) => {
  const T = AI_TACTICS.diversion;
  const front = mainFront(ctx);
  if (!front) return [];
  const pool = ctx.my.filter((u) => free(ctx, u, busy, false));
  // ein Sturm auf die Front bindet den Gegner schon; sonst binden freie Einheiten an der Front
  // a storm on the front already pins the enemy; otherwise free units at the front pin it
  const storm = mem(ctx.s, ctx.f).ops.some((o) => o.kind === 'storm' && o.city === front.id);
  const pins = storm ? [] : pool.filter((u) => dist(u, front) <= 4).sort((a, b) => dist(a, front) - dist(b, front) || a.id - b.id);
  if (!storm && pins.length < T.pins) return [];
  // schnelle Einnehmer zuerst, sonst Fusstruppen in der Naehe / fast capturers first, else foot troops nearby
  const raiders = pool.filter((u) => capturer(u) && !pins.slice(0, T.pins).includes(u));
  if (!raiders.length) return [];
  let best: { c: City; u: Unit[]; sc: number } | null = null;
  for (const c of [...ctx.hostileCities, ...ctx.neutralCities]) {
    if (c.id === front.id || dist(c, front) < T.remote) continue;
    const occ = unitAt(ctx.s, c.x, c.y);
    if (occ && occ.owner !== ctx.f) continue;
    let opp = 0;
    for (const e of ctx.enemies) if (dist(e, c) <= 2) opp += strength(e);
    if (opp > T.maxOpp) continue;
    const fld = fieldFor(ctx, tileSrc(ctx, c), false);
    const cand = raiders.map((u) => ({ u, t: fieldAt(ctx, fld, u.x, u.y, 0) / speedOf(u) })).filter((x) => x.t <= T.maxTurns && dist(x.u, front) >= 3)
      .sort((a, b) => a.t - b.t || UNITS[b.u.type].move - UNITS[a.u.type].move || a.u.id - b.u.id);
    if (!cand.length) continue;
    const hostile = c.owner !== null;
    const sc = ((hostile ? 45 + 8 * c.level : 30 + 5 * c.level) - 7 * cand[0].t) * w;
    const n = hostile && (c.level >= 2 || opp > 0) ? T.raiders : 1;
    if (!best || sc > best.sc) best = { c, u: cand.slice(0, n).map((x) => x.u), sc };
  }
  if (!best) return [];
  const b = best;
  return [{
    kind: 'diversion', score: b.sc, key: `d${b.c.id}`,
    make: () => newOp(ctx, 'diversion', T.rounds, b.c, {
      city: b.c.id, front: { x: front.x, y: front.y },
      members: [
        ...b.u.map((u) => ({ id: u.id, role: 'raider' as OpRole })),
        ...pins.filter((u) => !b.u.includes(u)).slice(0, T.pins).map((u) => ({ id: u.id, role: 'pin' as OpRole })),
      ],
    }),
  }];
};

/** Freies Landfeld fuer eine Einheit (nicht besetzt ausser von erlaubten) / free land tile for a unit */
function openTile(ctx: Ctx, p: Pos, allow: Set<number>): boolean {
  const k = p.y * ctx.size + p.x;
  if (!ctx.landOk[k] || !ctx.realLand[k]) return false;
  const t = ctx.s.tiles[k];
  if (t.cityId !== null) { const c = cityById(ctx.s, t.cityId); if (c && c.owner !== ctx.f && c.owner !== null) return false; }
  const o = unitAt(ctx.s, p.x, p.y);
  return !o || allow.has(o.id);
}

/** Heimatstadt eines Gegners (naechste bekannte Stadt seines Besitzers) / home city of an enemy (nearest known city of its owner) */
function enemyHome(ctx: Ctx, e: Unit): City | null {
  let best: City | null = null, bd = Infinity;
  for (const c of ctx.hostileCities) if (c.owner === e.owner) { const d = dist(c, e); if (d < bd) { bd = d; best = c; } }
  return best;
}

/**
 * Felder rund um das Ziel verteilen: Rueckenfelder und Fluchtfelder Richtung Heimat zuerst; Fernkaempfer ohne Feld.
 * Distribute the tiles around the target: rear tiles and escape tiles towards its home first; ranged units without a tile.
 */
function assignRing(ctx: Ctx, e: Unit, units: Unit[], members: OpMember[]) {
  const allow = new Set(units.map((u) => u.id));
  const home = enemyHome(ctx, e);
  const slots = neighbors(ctx.size, e.x, e.y).filter((p) => openTile(ctx, p, allow)).map((p) => ({
    p, sc: (inRearArc(e, p) ? 3 : 0) + (home && dist(p, home) < dist(e, home) ? 2 : 0),
  }));
  const used = new Set<string>();
  const melee = units.filter((u) => !(ranged(u) && !has(u, 'dash'))).sort((a, b) => dist(a, e) - dist(b, e) || a.id - b.id);
  for (const mb of members) mb.slot = undefined;
  for (const u of melee) {
    let best: Pos | null = null, bv = -Infinity;
    for (const sl of slots) {
      const key = `${sl.p.x},${sl.p.y}`;
      if (used.has(key)) continue;
      const v = sl.sc * 3 - dist(u, sl.p) * 2 + (u.x === sl.p.x && u.y === sl.p.y ? 2 : 0);
      if (v > bv) { bv = v; best = sl.p; }
    }
    if (!best) continue;
    used.add(`${best.x},${best.y}`);
    const mb = members.find((x) => x.id === u.id);
    if (mb) mb.slot = best;
  }
}

/** Mitglieder, die e ohne Bewegung angreifen koennen / members able to attack e without moving */
function inContact(ctx: Ctx, e: Unit, units: Unit[]): number {
  let n = 0;
  for (const u of units) if (dist(u, e) <= Math.max(1, effectiveRange(ctx.s, u))) n++;
  return n;
}

/**
 * Feuer zurueckhalten: Mitglieder in der Sammelphase greifen nicht nach einer Bewegung an (halber Schaden), ausser
 * Einheiten ohne Abzug (Dravon, Steppenreiter, Kamikaze); sie beziehen erst ihre Felder.
 * Hold fire: members in the gathering stage do not attack after moving (half damage), except units without the penalty
 * (Dravon, Steppe Riders, kamikaze); they take their tiles first.
 */
export function opHoldsFire(ctx: Ctx, u: Unit, g: Goal): boolean {
  const o = g.op;
  if (!o || o.op.stage !== 'gather' || fullMover(ctx.s, u)) return false;
  return o.role === 'hammer' || o.role === 'striker';
}

/** Einkreisen eines isolierten Gegners / encirclement of an isolated enemy */
const genEncircle: Gen = (ctx, busy, cfg, w) => {
  const T = AI_TACTICS.encircle;
  const pool = ctx.my.filter((u) => free(ctx, u, busy, true));
  if (pool.length < 2) return [];
  const out: Cand[] = [];
  for (const e of ctx.enemies) {
    if (isWonder(e) || isBoss(e) || isShip(e) || has(e, 'fly')) continue;
    const t = ctx.s.tiles[idx(ctx.size, e.x, e.y)];
    if (t.cityId !== null || isWater(t)) continue;
    let support = 0;
    for (const o of ctx.enemies) if (o.id !== e.id && dist(o, e) <= 2 && UNITS[o.type].attack > 0) support += strength(o);
    if (support > worth(e) * T.isolated) continue;
    const near = pool.filter((u) => dist(u, e) <= T.reach).sort((a, b) => dist(a, e) - dist(b, e) || a.id - b.id).slice(0, Math.min(cfg.maxMembers, 4 + (w > 1.2 ? 1 : 0)));
    if (near.length < 2) continue;
    let own = 0, dsum = 0;
    for (const u of near) { own += strength(u); dsum += dist(u, e); }
    if (own < strength(e) * T.ratio) continue;
    const score = (worth(e) * (1 + 0.25 * Math.min(4, near.length)) - (dsum / near.length) * 3) * w;
    out.push({
      kind: 'encircle', score, key: `e${e.id}`,
      make: () => {
        const members: OpMember[] = near.map((u) => ({ id: u.id, role: 'hammer' as OpRole }));
        assignRing(ctx, e, near, members);
        return newOp(ctx, 'encircle', T.rounds, e, { unit: e.id, members, stage: inContact(ctx, e, near) >= 2 ? 'strike' : 'gather' });
      },
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 2);
};

/**
 * Bestes Feld im Rueckenbereich von e fuer u: jetzt hinten oder hinten, nachdem e sich zum Frontkaempfer (anvil) gedreht hat.
 * Best tile in e's rear arc for u: behind now, or behind once e has turned towards the frontal fighter (anvil).
 */
function rearSlot(ctx: Ctx, e: Unit, u: Unit, anvil: Unit | null): Pos | null {
  const turned = anvil ? { ...e, facing: facingTowards(e, anvil) } : null;
  let best: Pos | null = null, bv = -Infinity;
  const allow = new Set([u.id]);
  for (const p of neighbors(ctx.size, e.x, e.y)) {
    const now = inRearArc(e, p), after = !!turned && inRearArc(turned, p);
    if (!now && !after) continue;
    if (!openTile(ctx, p, allow)) continue;
    const v = (now ? 2 : 0) + (after ? 1 : 0) - dist(u, p) * 0.5;
    if (v > bv) { bv = v; best = p; }
  }
  return best;
}

/** Rueckenangriff schneller Einheiten auf Gegner im Kontakt / rear attack by fast units on enemies in contact */
const genRear: Gen = (ctx, busy, _cfg, w) => {
  const T = AI_TACTICS.rear;
  const fast = ctx.my.filter((u) => free(ctx, u, busy, true) && UNITS[u.type].move >= 2 && has(u, 'dash') && !has(u, 'kamikaze'));
  if (!fast.length) return [];
  const out: Cand[] = [];
  for (const e of ctx.enemies) {
    if (isWonder(e) || isBoss(e) || isShip(e) || has(e, 'fly') || e.facing === undefined) continue;
    if (ctx.s.tiles[idx(ctx.size, e.x, e.y)].cityId !== null) continue;
    // Frontkaempfer: eigene Einheit, die e schon bindet, nicht der Flankierer selbst; seit die Grundinfanterie 2 Felder zieht,
    // zaehlt sie als schnell und kann Frontkaempfer und Flankierer sein
    // frontal fighter: an own unit already engaging e, not the flanker itself; since basic infantry moves 2 tiles it counts as
    // fast and can be both frontal fighter and flanker
    const engaged: Unit[] = [];
    for (const o of ctx.my) {
      if (!isFighter(o) || dist(o, e) > Math.max(1, effectiveRange(ctx.s, o))) continue;
      engaged.push(o);
    }
    if (!engaged.length) continue;
    engaged.sort((a, b) => dist(a, e) - dist(b, e) || a.id - b.id);
    for (const u of fast) {
      const anvil = engaged.find((o) => o.id !== u.id);
      if (!anvil) continue;
      if (dist(u, e) > UNITS[u.type].move + T.reach) continue;
      const slot = rearSlot(ctx, e, u, anvil);
      if (!slot) continue;
      const score = (worth(e) * (inRearArc(e, slot) ? 1.2 : 1) - dist(u, slot) * 2) * w;
      out.push({
        kind: 'rear', score, key: `r${e.id}:${u.id}`,
        make: () => newOp(ctx, 'rear', T.rounds, e, { unit: e.id, members: [{ id: u.id, role: 'flanker', slot }] }),
      });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).slice(0, 2);
};

/** Feuerzone: eigene Schuetzen, die stehen bleiben koennen / kill zone: own shooters that can stand still */
function killZone(ctx: Ctx): (Pos & { r: number; w: number; id?: number })[] {
  const { s, f } = ctx;
  const out: (Pos & { r: number; w: number; id?: number })[] = [];
  for (const u of ctx.my) {
    if (!isFighter(u) || isShip(u) || has(u, 'fly')) continue;
    const adj = ctx.enemies.some((e) => dist(e, u) === 1);
    if (adj) continue;
    if (ranged(u)) out.push({ x: u.x, y: u.y, r: effectiveRange(s, u), w: 1, id: u.id });
    else if (isEntrenched(s, u)) out.push({ x: u.x, y: u.y, r: 1, w: 1, id: u.id });
  }
  for (const g of turretList(s)) if (g.owner === f && !g.kind) out.push({ x: g.x, y: g.y, r: EMPLACEMENT.range, w: 1.5 });
  for (const c of ctx.myCities) {
    const d = unitAt(s, c.x, c.y);
    if (d && d.owner === f && isFighter(d) && !out.some((z) => z.id === d.id)) out.push({ x: c.x, y: c.y, r: effectiveRange(s, d), w: 1, id: d.id });
  }
  return out;
}

/** Vorgetaeuschter Rueckzug in die Feuerzone / feigned retreat into the kill zone */
const genFeint: Gen = (ctx, busy, _cfg, w) => {
  const T = AI_TACTICS.feint;
  const { s } = ctx;
  const out: Cand[] = [];
  let zone: ReturnType<typeof killZone> | null = null;
  let tried = 0;
  for (const b of ctx.my) {
    if (tried >= 3) break;
    if (!free(ctx, b, busy, true) || ranged(b) || !canMove(b)) continue;
    const k = b.y * ctx.size + b.x;
    if (!ctx.threat[k].length || s.tiles[k].cityId !== null) continue;
    // Verfolger: Gegner mit Angriff im Umkreis 2 / pursuer: an enemy with an attack within 2
    let pursuer: Unit | null = null, opp = 0, own = 0;
    for (const e of ctx.enemies) {
      if (UNITS[e.type].attack <= 0 || dist(e, b) > 2) continue;
      opp += strength(e);
      if (!pursuer || dist(e, b) < dist(pursuer, b)) pursuer = e;
    }
    if (!pursuer) continue;
    for (const o of ctx.my) if (dist(o, b) <= 2 && isFighter(o)) own += strength(o);
    if (opp < own && b.hp >= b.maxHp * 0.7) continue;
    zone ??= killZone(ctx);
    const z = zone.filter((q) => q.id !== b.id && dist(q, b) <= 5);
    if (!z.length) continue;
    tried++;
    const tmp = newOp(ctx, 'feint', T.rounds, b, { zone: z });
    let best: Pos | null = null, bv = -Infinity, bc = 0;
    for (const r of reachable(s, b)) {
      if (r.embark || r.disembark || r.board) continue;
      const gain = dist(r, pursuer) - dist(b, pursuer);
      if (gain <= 0) continue;
      const cover = zoneCover(tmp, r);
      if (cover < T.minCover) continue;
      const v = cover * 3 + gain * 2 - r.cost * 0.1;
      if (v > bv) { bv = v; best = { x: r.x, y: r.y }; bc = cover; }
    }
    if (!best) continue;
    const slot = best, p = pursuer;
    const score = (bc * 8 + worth(b) * 0.3) * w;
    out.push({
      kind: 'feint', score, key: `f${b.id}`,
      make: () => {
        const members: OpMember[] = [{ id: b.id, role: 'bait', slot }];
        for (const q of z) {
          if (q.id === undefined || busy.has(q.id) || members.length > 4) continue;
          const u = ctx.my.find((x) => x.id === q.id);
          if (u && free(ctx, u, busy, true, true)) members.push({ id: q.id, role: 'killzone', slot: { x: q.x, y: q.y } });
        }
        return newOp(ctx, 'feint', T.rounds, p, { zone: z.map(({ x, y, r, w: zw }) => ({ x, y, r, w: zw })), members });
      },
    });
  }
  return out;
};

/**
 * Vermuteter naechster Standort eines anrueckenden Gegners: Schritte entlang des Heimatfelds (eigenes Gebiet).
 * Presumed next position of an approaching enemy: steps along the home field (own territory).
 */
function predictStep(ctx: Ctx, e: Unit, home: Float32Array): { p: Pos; facing: number | undefined } {
  let cur: Pos = { x: e.x, y: e.y };
  let facing = e.facing;
  // Gleichstand (Schachbrettmass): Richtung der naechsten eigenen Stadt / tie (chessboard metric): towards the nearest own city
  let goal: Pos = cur, gd = Infinity;
  for (const c of ctx.myCities) { const d = dist(c, e); if (d < gd) { gd = d; goal = c; } }
  const tie = (p: Pos) => ((p.x - goal.x) ** 2 + (p.y - goal.y) ** 2) * 1e-3;
  for (let i = 0; i < UNITS[e.type].move; i++) {
    const here = fieldAt(ctx, home, cur.x, cur.y, 0);
    let next: Pos | null = null, nv = here + tie(cur);
    for (const n of neighbors(ctx.size, cur.x, cur.y)) {
      const v = fieldAt(ctx, home, n.x, n.y, 0) + tie(n);
      const o = unitAt(ctx.s, n.x, n.y);
      if (v < nv && (!o || o.id === e.id)) { nv = v; next = n; }
    }
    if (!next) break;
    facing = facingTowards(cur, next) ?? facing;
    cur = next;
    const t = ctx.s.tiles[idx(ctx.size, cur.x, cur.y)];
    if (t.terrain === 'forest' || t.terrain === 'mountain' || fieldAt(ctx, home, cur.x, cur.y, 0) === 0) break;
  }
  return { p: cur, facing };
}

/** Hinterhalt am vermuteten Anmarschweg / ambush next to the presumed approach path */
const genAmbush: Gen = (ctx, busy, _cfg, w) => {
  const T = AI_TACTICS.ambush;
  const { s, size } = ctx;
  const approaching: { e: Unit; p: Pos; facing: number | undefined }[] = [];
  let home: Float32Array | null = null;
  for (const e of ctx.enemies) {
    if (!isFighter(e) || isShip(e) || has(e, 'fly')) continue;
    if (ctx.my.some((u) => dist(u, e) <= 1)) continue;
    let dc = 99, du = 99;
    for (const c of ctx.myCities) dc = Math.min(dc, dist(c, e));
    for (const u of ctx.my) du = Math.min(du, dist(u, e));
    if (dc > T.approach && du > T.approachUnit) continue;
    home ??= fieldFor(ctx, 'home', false);
    approaching.push({ e, ...predictStep(ctx, e, home) });
  }
  if (!approaching.length) return [];
  const cands = ctx.my.filter((u) => free(ctx, u, busy, true) && (ranged(u) || (fullMover(s, u) && UNITS[u.type].move >= 2)) && !ctx.threat[u.y * size + u.x].length)
    .filter((u) => approaching.some((a) => dist(a.p, u) <= 8))
    .sort((a, b) => a.id - b.id).slice(0, 6);
  const picks: { u: Unit; slot: Pos; v: number }[] = [];
  const taken = new Set<string>();
  for (const u of cands) {
    const reach = ranged(u) && !fullMover(s, u) ? effectiveRange(s, u) : UNITS[u.type].move + effectiveRange(s, u);
    const tiles: Pos[] = [{ x: u.x, y: u.y }];
    if (canMove(u)) for (const r of reachable(s, u)) if (!r.embark && !r.disembark && !r.board) tiles.push({ x: r.x, y: r.y });
    let best: Pos | null = null, bv = 0;
    for (const p of tiles) {
      const k = p.y * size + p.x;
      if (ctx.threat[k].length || taken.has(`${p.x},${p.y}`)) continue;
      const t = s.tiles[k];
      if (isWater(t)) continue;
      let v = 0;
      for (const a of approaching) {
        if (dist(p, a.p) > reach) continue;
        v += worth(a.e) * 0.2;
        if (!s.factions[a.e.owner]?.explored[k]) v += T.hidden;
        if (a.facing !== undefined && inRearArc({ type: a.e.type, x: a.p.x, y: a.p.y, facing: a.facing }, p)) v += T.rearArc;
      }
      if (v <= 0) continue;
      if (t.terrain === 'forest' || isJungle(t)) v += T.cover;
      v -= dist(u, p) * 0.5;
      if (v > bv) { bv = v; best = p; }
    }
    if (best) { picks.push({ u, slot: best, v: bv }); taken.add(`${best.x},${best.y}`); }
  }
  if (!picks.length) return [];
  picks.sort((a, b) => b.v - a.v || a.u.id - b.u.id);
  const use = picks.slice(0, T.maxUnits);
  const anchor = approaching.sort((a, b) => worth(b.e) - worth(a.e) || a.e.id - b.e.id)[0].p;
  let score = 0;
  for (const p of use) score += p.v;
  return [{
    kind: 'ambush', score: score * w, key: `a${anchor.x},${anchor.y}`,
    make: () => newOp(ctx, 'ambush', T.rounds, anchor, { members: use.map((p) => ({ id: p.u.id, role: 'ambusher' as OpRole, slot: p.slot })) }),
  }];
};

const GEN: Record<TacticKind, Gen> = {
  storm: genStorm, diversion: genDiversion, encircle: genEncircle, rear: genRear, feint: genFeint, ambush: genAmbush,
};

/**
 * Abstimmung der Angriffsreihenfolge: ein Gegenschlag dreht das Ziel zum Angreifer. Gewinn, wenn danach eine andere eigene
 * Einheit (ohne Bewegung) von hinten trifft; Verlust, wenn ihr Rueckenangriff dadurch verloren geht.
 * Coordination of the attack order: return fire turns the target towards the attacker. Gain if afterwards another own unit
 * (without moving) hits from behind; loss if its rear attack is lost by it.
 */
export function coordinationValue(ctx: Ctx, u: Unit, t: Unit, value: (a: Unit, d: Unit) => number, retaliates: () => number): number {
  if (!ctx.coordinate || isWonder(t) || !UNITS[t.type].move) return 0;
  const nf = facingTowards(t, u);
  if (nf === undefined || nf === t.facing) return 0;
  const turned = { ...t, facing: nf };
  const followers = ctx.my.filter((v) => v.id !== u.id && canAttackNow(v) && dist(v, t) <= effectiveRange(ctx.s, v) && inRearArc(t, v) !== inRearArc(turned, v));
  if (!followers.length) return 0;
  // nur wenn das Ziel ueberlebt und zurueckschlaegt, dreht es sich / it only turns when it survives and returns fire
  const p = retaliates();
  if (p <= 0) return 0;
  let gain = 0, loss = 0;
  for (const v of followers) {
    const d = value(v, turned) - value(v, t);
    if (d > gain) gain = d;
    if (-d > loss) loss = -d;
  }
  return AI_TACTICS.coordinate.gain * p * (gain - loss);
}
