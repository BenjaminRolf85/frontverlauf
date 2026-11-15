/**
 * KI fuer die Kriegsplaene (Kampagne m4): Spieler-Seite (Spieler als KI und Verbuendete) laeuft den Tempel an, birgt
 * die Plaene, bringt den Traeger zum Hauptquartier, eskortiert ihn und hebt fallen gelassene Plaene auf. Der Kult
 * bewacht vorher den Tempel, jagt danach den Traeger und holt fallen gelassene Plaene zurueck.
 * AI for the war plans (campaign m4): the player side (player as AI and allies) heads for the temple, seizes the
 * plans, brings the carrier to the HQ, escorts it and picks up dropped plans. The cult guards the temple before,
 * hunts the carrier afterwards and recovers dropped plans.
 */
import { canCarryPlans, dist, hqOf, isHostile, neighbors, plansCarrier, seizeCheck, templeRing, unitAt, type Command, type Pos, type Unit } from '../core';
import { CAMPAIGN_AI, UNITS } from '../data/balance';
import type { Ctx, Goal } from './analysis';

const A = CAMPAIGN_AI;
const src = (ctx: Ctx, p: Pos) => `t${p.y * ctx.size + p.x}l`;

/** Gehoert f zur Spieler-Seite? / does f belong to the player side? */
const playerSide = (ctx: Ctx) => ctx.f === 0 || !!ctx.s.campaign?.allies?.includes(ctx.f);

/**
 * Kampagnenziele rund um die Kriegsplaene (fuer campaignGoals).
 * Campaign goals around the war plans (for campaignGoals).
 */
export function plansGoals(ctx: Ctx): Goal[] {
  const { s, f } = ctx;
  const c = s.campaign;
  const p = c?.plans;
  if (!c || !p || !c.temple || c.result || p.at === 'delivered') return [];
  const out: Goal[] = [];
  const side = playerSide(ctx);
  const goal = (kind: Goal['kind'], at: Pos, value: number, cap: number, extra: Partial<Goal> = {}): Goal =>
    ({ kind, x: at.x, y: at.y, value, cap, distW: A.plansDistW, src: src(ctx, at), water: false, ...extra });
  if (side) {
    if (p.at === 'temple') {
      // Tempelwache vertreiben, die Armee sammelt sich vor dem Tempel / drive off the temple guard, the army gathers in front of the temple
      const ring = templeRing(s);
      for (const e of ctx.enemies) if (c.temple && ring.some((q) => q.x === e.x && q.y === e.y)) out.push(goal('hunt', e, A.plansSeizeValue, A.plansSeizeCap, { targetId: e.id }));
      if (ring[0]) out.push(goal('defend', ring[0], A.plansGatherValue, A.plansGatherCap));
    }
    if (p.at === 'carried') {
      const u = plansCarrier(s);
      if (u) out.push(goal('defend', u, A.plansEscortValue, A.plansEscortCap));
    }
    if (p.at === 'dropped' && p.x !== undefined && p.y !== undefined) {
      const at = { x: p.x, y: p.y };
      const occ = unitAt(s, at.x, at.y);
      if (occ && occ.owner !== f && isHostile(s, f, occ.owner)) out.push(goal('hunt', at, A.plansPickValue, A.plansPickCap + 1, { targetId: occ.id }));
      else if (f === 0) out.push(goal('bunker', at, A.plansPickValue, A.plansPickCap, { hold: true }));
      else out.push(goal('defend', at, A.plansEscortValue, A.plansEscortCap));
    }
    return out;
  }
  // Gegner der Spieler-Seite / opponents of the player side
  if (!isHostile(s, f, 0)) return out;
  if (p.at === 'temple') {
    const front = templeRing(s)[0];
    if (front && f === p.owner) out.push(goal('defend', front, A.plansGuardValue, A.plansGuardCap));
  } else if (p.at === 'carried') {
    const u = plansCarrier(s);
    if (u) out.push(goal('hunt', u, A.plansHuntValue, A.plansHuntCap, { distW: A.plansDistW - 1, targetId: u.id }));
  } else if (p.at === 'dropped' && p.x !== undefined && p.y !== undefined) {
    const at = { x: p.x, y: p.y };
    const occ = unitAt(s, at.x, at.y);
    if (occ && occ.owner !== f && isHostile(s, f, occ.owner)) out.push(goal('hunt', at, A.plansReturnValue, A.plansReturnCap + 1, { targetId: occ.id }));
    else if (!occ) out.push(goal('bunker', at, A.plansReturnValue, A.plansReturnCap));
  }
  return out;
}

/**
 * Eigenes Ziel einer Einheit (nur der Spieler als KI): der Traeger laeuft zum Hauptquartier; liegen die Plaene im Tempel
 * oder am Boden, laeuft die schnellste Traegereinheit als Laeufer zum naechsten freien Feld daneben.
 * Own goal of one unit (only the player as AI): the carrier heads for the HQ; while the plans lie in the temple or on
 * the ground, the fastest carrier unit runs to the nearest free tile next to them.
 */
export function carrierGoal(ctx: Ctx): { unit: Unit; goal: Goal } | null {
  const { s } = ctx;
  const c = s.campaign;
  const p = c?.plans;
  if (ctx.f !== 0 || !c || !p || !c.temple || c.result) return null;
  const mk = (at: Pos): Goal => ({ kind: 'bunker', x: at.x, y: at.y, value: A.plansCarryValue, cap: 1, distW: 0, src: src(ctx, at), water: false });
  if (p.at === 'carried') {
    const u = plansCarrier(s);
    const hq = hqOf(s, 0);
    return u && hq && u.owner === 0 ? { unit: u, goal: mk(hq) } : null;
  }
  const r = pickRunner(ctx);
  if (!r) return null;
  // erst losrennen, wenn Begleitschutz am Ziel steht; vorher zieht der Laeufer mit der Armee / only dash once an escort stands at the target; before that the runner moves with the army
  const escort = ctx.my.filter((o) => o.id !== r.unit.id && UNITS[o.type].attack > 0 && dist(o, r.spot) <= A.plansEscortRange).length;
  if (escort < A.plansEscortMin && dist(r.unit, r.spot) > 1) return null;
  return { unit: r.unit, goal: mk(r.spot) };
}

/**
 * Laeufer fuer Plaene im Tempel oder am Boden: die schnellste Traegereinheit (dann die naechste) und ihr naechstes freies Feld.
 * Runner for plans in the temple or on the ground: the fastest carrier unit (then the nearest) and its nearest free tile.
 */
function pickRunner(ctx: Ctx): { unit: Unit; spot: Pos } | null {
  const { s } = ctx;
  const p = s.campaign?.plans;
  if (!p || (p.at !== 'temple' && p.at !== 'dropped')) return null;
  const spots = (p.at === 'temple' ? templeRing(s) : [{ x: p.x!, y: p.y! }, ...neighbors(s.size, p.x!, p.y!)])
    .filter((q) => { const o = unitAt(s, q.x, q.y); return !o || o.owner === 0; });
  const runners = ctx.my.filter((u) => canCarryPlans(u) && u.hp >= u.maxHp * 0.4);
  if (!spots.length || !runners.length) return null;
  const near = (u: Unit) => Math.min(...spots.map((q) => dist(u, q)));
  const unit = runners.sort((a, b) => UNITS[b.type].move - UNITS[a.type].move || near(a) - near(b) || b.hp - a.hp || a.id - b.id)[0];
  const spot = spots.slice().sort((a, b) => dist(unit, a) - dist(unit, b) || a.y - b.y || a.x - b.x)[0];
  return { unit, spot };
}

/**
 * Bergen, sobald eine Einheit in Reichweite ist: am liebsten die schnellste und gesuendeste.
 * Seize as soon as a unit is in reach: preferably the fastest and healthiest.
 */
export function planSeize(ctx: Ctx, ok: (c: Command) => boolean): Command | null {
  if (ctx.f !== 0 || !ctx.s.campaign?.plans) return null;
  const list = ctx.my.filter((u) => seizeCheck(ctx.s, u) === 'ok')
    .sort((a, b) => UNITS[b.type].move - UNITS[a.type].move || b.hp - a.hp || a.id - b.id);
  // ein schnellerer Traeger in der Naehe bekommt den Vortritt / a faster carrier close by gets precedence
  const runner = pickRunner(ctx)?.unit;
  for (const u of list) {
    if (runner && runner.id !== u.id && UNITS[runner.type].move > UNITS[u.type].move && dist(runner, u) <= A.plansWaitRange) continue;
    const c: Command = { type: 'seizePlans', unit: u.id };
    if (ok(c)) return c;
  }
  return null;
}

/** Angriffsbonus der Gegner gegen den Traeger / attack bonus of the enemies against the carrier */
export function carrierAttackBonus(ctx: Ctx, d: Unit): number {
  const p = ctx.s.campaign?.plans;
  if (!p || p.at !== 'carried' || p.unit !== d.id || playerSide(ctx)) return 0;
  return A.plansCarrierAttackBonus;
}
