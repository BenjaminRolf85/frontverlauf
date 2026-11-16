/**
 * KI fuer die Kampagne m2 (Das Mutterschiff, alle gegen alle): jede Fraktion mit Wissenschaftler fuehrt ihn an einen
 * sicheren Platz neben dem Schiff, laesst ihn arbeiten und eskortiert ihn; nach dem Ende der Waffenruhe jagt sie die
 * Wissenschaftler der anderen (je weiter sie sind, desto lieber). Die Zyrr jagen alle Wissenschaftler, ein paar Wachen
 * bleiben am Wrack. Zahlen aus M2.ai.
 * AI for campaign m2 (The Mothership, free-for-all): every faction with a scientist leads it to a safe spot next to the
 * ship, lets it work and escorts it; once the truce is over it hunts the other factions' scientists (the further they
 * are, the keener). The Zyrr hunt every scientist, a few guards stay at the wreck. Numbers from M2.ai.
 */
import { isSampler, samplerOf, shipDist, unitAt, workCheck, workOf, workSpots, type Command, type Pos, type Unit } from '../core';
import { M2, UNITS } from '../data/balance';
import { expectedDamage, type Ctx, type Goal } from './analysis';

type Failed = Set<string>;
const key = (c: Command) => JSON.stringify(c);
const tile = (ctx: Ctx, p: Pos) => `t${p.y * ctx.size + p.x}l`;
const cheb = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Der eigene Wissenschaftler dieser Fraktion? / this faction's own scientist? */
export const isScientist = (ctx: Ctx, u: Unit) => u.owner === ctx.f && isSampler(ctx.s, u);

/**
 * Bester Arbeitsplatz fuer den Wissenschaftler: frei (oder sein eigenes Feld), wenig Gefahr, nahe an ihm.
 * Best work spot for the scientist: free (or its own tile), little danger, close to it.
 */
export function bestWorkSpot(ctx: Ctx, u: Unit): Pos | null {
  let best: Pos | null = null, bv = Infinity;
  for (const p of workSpots(ctx.s)) {
    const occ = unitAt(ctx.s, p.x, p.y);
    // fremd besetzte Plaetze nie, eigene nur notfalls (die Einheit zieht weiter) / never spots held by others, own ones only if need be (the unit moves on)
    if (occ && occ.id !== u.id && occ.owner !== u.owner) continue;
    if (!ctx.landOk[p.y * ctx.size + p.x]) continue;
    const v = expectedDamage(ctx, u, p.x, p.y) * 4 + cheb(p, u) + (occ && occ.id !== u.id ? 6 : occ ? -1 : 0);
    if (v < bv) { bv = v; best = p; }
  }
  return best;
}

/**
 * Ziel des Wissenschaftlers: zum besten Arbeitsplatz (Haltefeld), sonst zum Schiff hin.
 * Goal of the scientist: the best work spot (hold tile), else towards the ship.
 */
export function scientistGoal(ctx: Ctx, u: Unit): Goal | null {
  const ship = ctx.s.campaign?.ship;
  if (!ship) return null;
  let p = bestWorkSpot(ctx, u) ?? { x: ship.x, y: ship.y };
  // unterwegs: auf die Eskorte warten (kein eigener Kaempfer in escortGap) und vor dem Schiff warten, solange dort mehr
  // Gegner stehen als eigene Kaempfer (die Eskorte raeumt zuerst)
  // on the way: wait for the escort (no own fighter within escortGap) and wait in front of the ship while more enemies
  // than own fighters stand there (the escort clears first)
  const A = M2.ai;
  if (shipDist(ship, u) > 1) {
    const fighter = (o: Unit) => o.id !== u.id && UNITS[o.type].attack > 0;
    const own = ctx.my.filter(fighter);
    const alone = own.length > 0 && !own.some((o) => cheb(o, u) <= A.escortGap);
    const near = (list: Unit[]) => list.filter((o) => fighter(o) && cheb(o, p) <= A.waitRange).length;
    if (alone || (cheb(u, p) <= A.waitDistance && near(ctx.enemies) > near(own))) p = { x: u.x, y: u.y };
  }
  return { kind: 'bunker', x: p.x, y: p.y, value: 100, cap: 1, distW: 0, src: tile(ctx, p), water: false, hold: true };
}

/** Sichtbare feindliche Wissenschaftler im Wettlauf / visible hostile scientists in the race */
const hostileSamplers = (ctx: Ctx) => ctx.enemies.filter((e) => isSampler(ctx.s, e));

/**
 * Kampagnenziele rund um das Mutterschiff: Eskorte, freie Arbeitsplaetze und die Jagd auf fremde Wissenschaftler fuer
 * jede Fraktion mit eigenem Wissenschaftler; Jagd und Wache fuer die Zyrr.
 * Campaign goals around the mothership: escort, clear work spots and the hunt for foreign scientists for every faction
 * with its own scientist; hunt and guard for the Zyrr.
 */
export function mothershipGoals(ctx: Ctx): Goal[] {
  const { s, f } = ctx;
  const c = s.campaign;
  if (!c?.ship || c.result) return [];
  const A = M2.ai;
  const out: Goal[] = [];
  // fremde Wissenschaftler jagen, je mehr Arbeit, desto lieber (vor dem Ende der Waffenruhe nur die Zyrr)
  // hunt foreign scientists, the more work the keener (before the truce ends only the Zyrr)
  // nur am Schiff oder neben eigenen Einheiten; die Angriffslust (Schwierigkeit) skaliert den Wert
  // only at the ship or next to own units; aggression (difficulty) scales the value
  const prey = hostileSamplers(ctx);
  for (const e of prey) {
    if (shipDist(c.ship, e) > A.huntRange && !ctx.my.some((u) => cheb(u, e) <= 2)) continue;
    const value = (A.huntValue + A.huntProgress * workOf(s, e.owner)) * Math.min(1, ctx.prof.aggression) * (c.race?.swarm === f ? A.swarmHunt : 1);
    if (value <= 0) continue;
    out.push({ kind: 'hunt', x: e.x, y: e.y, value, cap: A.huntCap, distW: 4, src: tile(ctx, e), water: false, targetId: e.id });
  }
  const sci = samplerOf(s, f);
  if (sci) {
    // Leibwache beim Wissenschaftler, ein Vortrupp am Arbeitsplatz, den er ansteuert
    // bodyguard with the scientist, a vanguard at the work spot it is heading for
    out.push({ kind: 'defend', x: sci.x, y: sci.y, value: A.escortValue, cap: A.escortCap, distW: 6, src: tile(ctx, sci), water: false });
    const spot = shipDist(c.ship, sci) === 1 ? null : bestWorkSpot(ctx, sci);
    if (spot) out.push({ kind: 'defend', x: spot.x, y: spot.y, value: A.escortValue - 10, cap: A.vanguardCap, distW: 6, src: tile(ctx, spot), water: false });
    // Gegner am Schiff und am Wissenschaftler vertreiben, damit er arbeiten kann / drive off the enemies at the ship and at the scientist so it can work
    for (const e of ctx.enemies) {
      if ((shipDist(c.ship, e) > A.clearRange && cheb(e, sci) > A.waitRange) || isSampler(s, e)) continue;
      out.push({ kind: 'hunt', x: e.x, y: e.y, value: A.clearValue, cap: A.clearCap, distW: 5, src: tile(ctx, e), water: false, targetId: e.id });
    }
    return out;
  }
  // Wachen bleiben am Wrack (nur der Schwarm ohne Basis): am Platz des weitesten Wissenschaftlers / guards stay at the wreck (only the swarm without a base): at the spot of the furthest scientist
  if (c.race?.swarm !== f) return out;
  const lead = prey.slice().sort((a, b) => workOf(s, b.owner) - workOf(s, a.owner) || a.id - b.id)[0];
  const spots = workSpots(s);
  const near = lead ? spots.slice().sort((a, b) => cheb(a, lead) - cheb(b, lead))[0] : spots[0];
  if (near) out.push({ kind: 'defend', x: near.x, y: near.y, value: A.guardValue, cap: A.guardCap, distW: 10, src: tile(ctx, near), water: false });
  return out;
}

const spotCache = new WeakMap<Ctx, Pos | null>();
/**
 * Abzug fuer andere eigene Einheiten auf dem Arbeitsplatz, den der eigene Wissenschaftler ansteuert (der Platz bleibt frei).
 * Penalty for other own units on the work spot the own scientist is heading for (the spot stays free).
 */
export function workSpotPenalty(ctx: Ctx, u: Unit, x: number, y: number): number {
  const c = ctx.s.campaign;
  if (!c?.ship || u.type === 'scientist') return 0;
  if (!spotCache.has(ctx)) {
    const sci = samplerOf(ctx.s, ctx.f);
    spotCache.set(ctx, sci && shipDist(c.ship, sci) > 1 ? bestWorkSpot(ctx, sci) : null);
  }
  const p = spotCache.get(ctx);
  return p && p.x === x && p.y === y ? M2.ai.spotPenalty : 0;
}

/**
 * Waffenruhe (m2): der eigene Wissenschaftler meidet Felder, die bewaffnete Truppen anderer Fraktionen im naechsten Zug
 * erreichen; bricht die Waffenruhe, schlagen sie sofort zu.
 * Truce (m2): the own scientist avoids tiles that armed troops of other factions reach next turn; once the truce breaks
 * they strike at once.
 */
export function truceExposure(ctx: Ctx, u: Unit, x: number, y: number): number {
  const r = ctx.s.campaign?.race;
  if (!r?.truce || !isScientist(ctx, u)) return 0;
  let n = 0;
  for (const o of ctx.s.units) {
    if (o.owner === ctx.f || o.owner === r.swarm || UNITS[o.type].attack <= 0) continue;
    if (cheb(o, { x, y }) <= UNITS[o.type].move + UNITS[o.type].range) n++;
  }
  return n * M2.ai.truceExposure * ctx.prof.caution;
}

/** Angriffszuschlag auf fremde Wissenschaftler / attack bonus against foreign scientists */
export function scientistAttackBonus(ctx: Ctx, d: Unit): number {
  if (d.owner === ctx.f || !isSampler(ctx.s, d)) return 0;
  return M2.ai.attackBonus * (ctx.s.campaign?.race?.swarm === ctx.f ? M2.ai.swarmHunt : 1);
}

/** Steht der eigene Wissenschaftler am Schiff, arbeitet er / if the own scientist stands at the ship, it works */
export function planMothership(ctx: Ctx, failed: Failed): Command | null {
  const u = samplerOf(ctx.s, ctx.f);
  if (!u || workCheck(ctx.s, u) !== 'ok') return null;
  const c: Command = { type: 'workShip', unit: u.id };
  return failed.has(key(c)) ? null : c;
}
