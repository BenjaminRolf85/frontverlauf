/**
 * KI fuer die Kampagne m2 (Das Mutterschiff): die Spieler-Seite fuehrt den Wissenschaftler an einen sicheren Platz neben
 * dem Schiff, laesst ihn arbeiten und eskortiert ihn; Verbuendete bewachen den Schiffsbereich. Die Zyrr jagen den
 * Wissenschaftler, ein paar Wachen bleiben am Wrack. Zahlen aus M2.ai.
 * AI for campaign m2 (The Mothership): the player side leads the scientist to a safe spot next to the ship, lets it work
 * and escorts it; allies guard the ship area. The Zyrr hunt the scientist, a few guards stay at the wreck. Numbers from M2.ai.
 */
import { isHostile, scientistOf, shipDist, unitAt, workCheck, workSpots, type Command, type Pos, type Unit } from '../core';
import { M2 } from '../data/balance';
import { expectedDamage, type Ctx, type Goal } from './analysis';

type Failed = Set<string>;
const key = (c: Command) => JSON.stringify(c);
const tile = (ctx: Ctx, p: Pos) => `t${p.y * ctx.size + p.x}l`;

/** Der Wissenschaftler der Partie? / the game's scientist? */
export const isScientist = (ctx: Ctx, u: Unit) => u.type === 'scientist' && ctx.s.campaign?.scientist === u.id;

/** Spieler-Seite: Spieler und seine Kampagnen-Verbuendeten / player side: the player and its campaign allies */
const playerSide = (ctx: Ctx) => ctx.f === 0 || !!ctx.s.campaign?.allies?.includes(ctx.f);

/**
 * Bester Arbeitsplatz fuer den Wissenschaftler: frei (oder sein eigenes Feld), wenig Gefahr, nahe an ihm.
 * Best work spot for the scientist: free (or its own tile), little danger, close to it.
 */
export function bestWorkSpot(ctx: Ctx, u: Unit): Pos | null {
  let best: Pos | null = null, bv = Infinity;
  for (const p of workSpots(ctx.s)) {
    const occ = unitAt(ctx.s, p.x, p.y);
    if (occ && occ.id !== u.id) continue;
    if (!ctx.landOk[p.y * ctx.size + p.x]) continue;
    const v = expectedDamage(ctx, u, p.x, p.y) * 4 + Math.max(Math.abs(p.x - u.x), Math.abs(p.y - u.y)) - (occ ? 1 : 0);
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
  const p = bestWorkSpot(ctx, u) ?? { x: ship.x, y: ship.y };
  return { kind: 'bunker', x: p.x, y: p.y, value: 100, cap: 1, distW: 0, src: tile(ctx, p), water: false, hold: true };
}

/**
 * Kampagnenziele rund um das Mutterschiff: Eskorte und Schiffswache fuer die Spieler-Seite, Jagd und Wache fuer die Gegner.
 * Campaign goals around the mothership: escort and ship guard for the player side, hunt and guard for the enemies.
 */
export function mothershipGoals(ctx: Ctx): Goal[] {
  const { s, f } = ctx;
  const c = s.campaign;
  if (!c?.ship || c.result) return [];
  const A = M2.ai;
  const sci = scientistOf(s);
  const out: Goal[] = [];
  // Wachpunkt am Schiff: Arbeitsplatz zur Seite des Wissenschaftlers (oder der erste) / guard point at the ship: work spot on the scientist's side (or the first)
  const spots = workSpots(s);
  const near = sci ? spots.slice().sort((a, b) => Math.max(Math.abs(a.x - sci.x), Math.abs(a.y - sci.y)) - Math.max(Math.abs(b.x - sci.x), Math.abs(b.y - sci.y)))[0] : spots[0];
  if (playerSide(ctx)) {
    if (sci) out.push({ kind: 'defend', x: sci.x, y: sci.y, value: A.escortValue, cap: A.escortCap, distW: 6, src: tile(ctx, sci), water: false });
    // Verbuendete: den Schiffsbereich sichern / allies: secure the ship area
    if (f !== 0 && near) out.push({ kind: 'defend', x: near.x, y: near.y, value: A.shipValue, cap: A.shipCap, distW: 6, src: tile(ctx, near), water: false });
    // Wachen am Schiff vertreiben, damit der Wissenschaftler arbeiten kann / drive off the guards at the ship so the scientist can work
    for (const e of ctx.enemies) {
      if (shipDist(c.ship, e) > A.clearRange) continue;
      out.push({ kind: 'hunt', x: e.x, y: e.y, value: A.clearValue, cap: A.clearCap, distW: 5, src: tile(ctx, e), water: false, targetId: e.id });
    }
    return out;
  }
  if (!isHostile(s, f, 0)) return out;
  if (sci) out.push({ kind: 'hunt', x: sci.x, y: sci.y, value: A.huntValue, cap: A.huntCap, distW: 4, src: tile(ctx, sci), water: false, targetId: sci.id });
  // Wachen bleiben am Wrack / guards stay at the wreck
  if (near && shipDist(c.ship, near) === 1) out.push({ kind: 'defend', x: near.x, y: near.y, value: A.guardValue, cap: A.guardCap, distW: 10, src: tile(ctx, near), water: false });
  return out;
}

/** Angriffszuschlag der Gegner auf den Wissenschaftler / attack bonus of the enemies against the scientist */
export function scientistAttackBonus(ctx: Ctx, d: Unit): number {
  return d.type === 'scientist' && ctx.s.campaign?.scientist === d.id && !playerSide(ctx) ? M2.ai.attackBonus : 0;
}

/** Spieler-Seite: steht der Wissenschaftler am Schiff, arbeitet er / player side: if the scientist stands at the ship, it works */
export function planMothership(ctx: Ctx, failed: Failed): Command | null {
  if (ctx.f !== 0) return null;
  const u = scientistOf(ctx.s);
  if (!u || u.owner !== ctx.f || workCheck(ctx.s, u) !== 'ok') return null;
  const c: Command = { type: 'workShip', unit: u.id };
  return failed.has(key(c)) ? null : c;
}
