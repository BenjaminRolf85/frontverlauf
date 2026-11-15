/**
 * KI fuer den Orbitallaser der Velkar: Relay bauen (Wert je Stadt), passende Technik bevorzugen und schiessen, wenn
 * der Nettowert lohnt. Nur sichtbare Einheiten zaehlen (orbitalPreview); deterministisch, Gleichstand nach Feld.
 * AI for the Velkar orbital laser: build the relay (value per city), prefer the fitting tech and fire when the net value
 * pays off. Only visible units count (orbitalPreview); deterministic, ties broken by tile.
 */
import {
  dist, isBoss, isWonder, orbitalFaction, orbitalPreview, orbitalWait, relayCity, unitById, type City, type Command, type Pos,
} from '../core';
import { CITY_UPGRADES, ORBITAL, TECHS, VERDAN, WONDERS, type TechId } from '../data/balance';
import { worth, type Ctx } from './analysis';

type Failed = Set<string>;
const key = (c: Command) => JSON.stringify(c);

/** Wert eines Schusses mit Ecke (x, y) aus Sicht der KI (Sterne-Gegenwert) / value of a shot with corner (x, y) from the AI's view (star equivalent) */
export function orbitalShotValue(ctx: Ctx, x: number, y: number): { value: number; enemyHits: number; ok: boolean } {
  const { s, f } = ctx;
  const A = ORBITAL.ai;
  const pre = orbitalPreview(s, f, x, y);
  let value = 0, enemyHits = 0;
  for (const h of pre.hits) {
    let w: number, maxHp: number;
    if (h.turret) { w = A.gunWorth; maxHp = VERDAN.hp; }
    else {
      const u = unitById(s, h.unit!);
      if (!u) continue;
      w = isBoss(u) ? A.bossWorth : worth(u);
      maxHp = Math.max(1, u.maxHp);
      // Wunder: jeder Treffer setzt die laufende Phase zurueck / wonders: every hit resets the current phase
      if (!h.own && isWonder(u) && WONDERS.interruptible[u.type as keyof typeof WONDERS.interruptible]) value += A.wonderInterrupt;
    }
    const v = h.killed ? w * (1 + A.killBonus) : (h.dmg / maxHp) * w * A.damageWeight;
    if (h.own) value -= v * A.ownWeight;
    else { value += v; enemyHits++; }
  }
  return { value, enemyHits, ok: pre.check === 'ok' };
}

/**
 * Schuss planen: Kandidaten sind die Ecken um jeden sichtbaren Feind und jedes Geschuetz; bester Nettowert ab
 * ORBITAL.ai.minValue. Eigene Einheiten im Ziel nur, wenn der Tausch klar lohnt (ownWeight).
 * Plan a shot: candidates are the corners around every visible enemy and gun; best net value from ORBITAL.ai.minValue.
 * Own units in the target only when the trade clearly pays off (ownWeight).
 */
export function planOrbital(ctx: Ctx, failed: Failed): Command | null {
  const { s, f } = ctx;
  if (orbitalWait(s, f) !== 0) return null;
  const pts: Pos[] = [...ctx.enemies.map((e) => ({ x: e.x, y: e.y }))];
  s.tiles.forEach((t, k) => { if (t.turret && t.turret.hp > 0) pts.push({ x: k % s.size, y: Math.floor(k / s.size) }); });
  const seen = new Set<number>();
  let best: Command | null = null, bv = ORBITAL.ai.minValue - 1e-9;
  for (const p of pts) {
    for (let dy = -ORBITAL.area.h + 1; dy <= 0; dy++) for (let dx = -ORBITAL.area.w + 1; dx <= 0; dx++) {
      const x = Math.max(0, Math.min(p.x + dx, s.size - ORBITAL.area.w)), y = Math.max(0, Math.min(p.y + dy, s.size - ORBITAL.area.h));
      const k = y * s.size + x;
      if (seen.has(k)) continue;
      seen.add(k);
      const cmd: Command = { type: 'orbitalStrike', x, y };
      if (failed.has(key(cmd))) continue;
      const r = orbitalShotValue(ctx, x, y);
      if (!r.ok || !r.enemyHits || r.value <= bv) continue;
      bv = r.value; best = cmd;
    }
  }
  return best;
}

/**
 * Wert des Relays in Stadt c fuer die Kaufliste (0 = nicht kaufen): Schuesse bis zum Spielende, sichere Stadt bevorzugt.
 * Value of the relay in city c for the shopping list (0 = do not buy): shots until the game ends, safe city preferred.
 */
export function relayValue(ctx: Ctx, c: City): number {
  const { s, f } = ctx;
  if (!orbitalFaction(s, f) || relayCity(s, f)) return 0;
  const horizon = Math.min(ctx.roundsLeft, ORBITAL.ai.horizon);
  if (horizon <= ORBITAL.cooldown) return 0;
  const shots = Math.floor((horizon - ORBITAL.cooldown) / ORBITAL.cooldown) + 1;
  let v = shots * ORBITAL.ai.shotStars;
  // nah an Feinden geht es leicht verloren / close to enemies it is easily lost
  const near = ctx.enemies.reduce((m, e) => Math.min(m, dist(e, c)), 99);
  if (near <= 2) v *= 0.35;
  else if (near <= 4) v *= 0.7;
  if (c.isHQ && c.hqOf === f) v *= 1.15;
  if (ctx.prof.difficulty === 'easy') v *= 0.6;
  return v;
}

/** Zuschlag fuer die Technik des Relays (nur Velkar, solange es fehlt) / bonus for the relay's tech (Velkar only, while missing) */
export function relayTechBonus(ctx: Ctx, t: TechId): number {
  if (!orbitalFaction(ctx.s, ctx.f) || CITY_UPGRADES.tech[ORBITAL.relay] !== t || relayCity(ctx.s, ctx.f)) return 0;
  return ORBITAL.ai.techBonus * TECHS[t].tier;
}
