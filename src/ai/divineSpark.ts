/**
 * KI fuer den Goettlichen Funken (Alvenia, SPARK): auf lohnende Haufen feuern (Wert nach Erwartungswert des Treffergluecks,
 * eigene Einheiten stark negativ), sonst langsam hinter der eigenen Linie in Schussweite ruecken, Nahkampf meiden. Kauf:
 * Anteil an der Armee, sobald eine Front besteht (economy.ts). Deterministisch, Gleichstand nach Feld.
 * AI for the Divine Spark (Alvenia, SPARK): fire at worthwhile clusters (value by the expected hit luck, own units strongly
 * negative), otherwise move slowly behind the own line into firing range, avoid close combat. Purchase: a share of the
 * army once a front exists (economy.ts). Deterministic, ties broken by tile.
 */
import {
  cityById, dist, hitChanceOn, hitDamage, hitOdds, isBoss, isSpark, isWonder, reachable, sparkPreview, sparkReady, sparkSpotted, sparkArea,
  sparkFaction, sparkGeometry, sparksOf, trainCheck, unitById, unitCost, type City, type Command, type Pos, type Unit,
} from '../core';
import { HIT_KINDS, ORBITAL, SPARK, UNITS, UPKEEP, VERDAN, WONDERS } from '../data/balance';
import { expectedDamage, fieldAt, goalField, layerOf, worth, type Ctx } from './analysis';

type Failed = Set<string>;
const key = (c: Command) => JSON.stringify(c);

/** Eigene Geschuetze, die jetzt handeln koennen / own guns that can act now */
const ownSparks = (ctx: Ctx): Unit[] => ctx.my.filter((u) => isSpark(u));

/**
 * Wert eines Schusses von u auf die Flaeche mit Ecke (x, y) (Sterne-Gegenwert): je sichtbarem Ziel Abschusschance mal Wert
 * (mit Bonus) plus erwarteter Schaden ohne Abschuss; eigene Einheiten zaehlen ownWeight-fach negativ.
 * Value of a shot by u at the area with corner (x, y) (star equivalent): per visible target the kill chance times the worth
 * (with a bonus) plus the expected damage without a kill; own units count ownWeight times negative.
 */
export function sparkShotValue(ctx: Ctx, u: Unit, x: number, y: number): { value: number; enemyHits: number; ok: boolean } {
  const { s } = ctx;
  const A = SPARK.ai;
  const pre = sparkPreview(s, u, x, y);
  if (pre.check !== 'ok') return { value: 0, enemyHits: 0, ok: false };
  const odds = hitOdds(s, u, true);
  let value = 0, enemyHits = 0;
  for (const h of pre.hits) {
    let w: number, hp: number, maxHp: number;
    if (h.turret) { w = A.gunWorth; hp = s.tiles[h.y * s.size + h.x].turret?.hp ?? VERDAN.hp; maxHp = VERDAN.hp; }
    else {
      const o = unitById(s, h.unit!);
      if (!o) continue;
      w = isBoss(o) ? ORBITAL.ai.bossWorth : worth(o);
      hp = o.hp; maxHp = Math.max(1, o.maxHp);
      if (!h.own && isWonder(o) && WONDERS.interruptible[o.type as keyof typeof WONDERS.interruptible]) value += A.wonderInterrupt;
    }
    // Trefferglueck: Abschusschance und erwarteter Schaden ueber die Trefferarten / hit luck: kill chance and expected damage over the hit kinds
    let kill = 0, dmg = 0;
    if (hitChanceOn(s)) {
      // Grundschaden je Ziel aus der Vorschau (Panzerung: SPARK.vehicleDamage) / base damage per target from the preview (armour: SPARK.vehicleDamage)
      for (const k of HIT_KINDS) { const d = hitDamage(h.dmg, k); if (d >= hp) kill += odds[k]; else dmg += odds[k] * d; }
    } else if (h.dmg >= hp) kill = 1; else dmg = h.dmg;
    const v = kill * w * (1 + A.killBonus) + (dmg / maxHp) * w * A.damageWeight;
    if (h.own) value -= v * A.ownWeight;
    else { value += v; enemyHits++; }
  }
  return { value, enemyHits, ok: true };
}

/**
 * Schuss planen: Kandidaten sind die vier Ecken um jeden sichtbaren Feind und jedes Geschuetz; bester Nettowert ab
 * SPARK.ai.minValue. Mehrere Geschuetze schiessen nacheinander (jeder Aufruf ein Befehl).
 * Plan a shot: candidates are the four corners around every visible enemy and gun; best net value from SPARK.ai.minValue.
 * Several guns fire one after another (one command per call).
 */
export function planSparkShot(ctx: Ctx, failed: Failed): Command | null {
  const { s } = ctx;
  const guns = ownSparks(ctx).filter((u) => sparkReady(s, u) === 'ok');
  if (!guns.length) return null;
  const pts: Pos[] = ctx.enemies.map((e) => ({ x: e.x, y: e.y }));
  s.tiles.forEach((t, k) => { if (t.turret && t.turret.hp > 0) pts.push({ x: k % s.size, y: Math.floor(k / s.size) }); });
  let best: Command | null = null, bv = SPARK.ai.minValue - 1e-9;
  for (const u of guns) {
    const seen = new Set<number>();
    for (const p of pts) {
      if (dist(u, p) > SPARK.range || dist(u, p) < SPARK.minRange) continue;
      for (let dy = -SPARK.area.h + 1; dy <= 0; dy++) for (let dx = -SPARK.area.w + 1; dx <= 0; dx++) {
        const x = p.x + dx, y = p.y + dy;
        const k = y * s.size + x;
        if (seen.has(k) || sparkGeometry(s, u, x, y) !== 'ok') continue;
        seen.add(k);
        const cmd: Command = { type: 'divineSpark', unit: u.id, x, y };
        if (failed.has(key(cmd))) continue;
        const r = sparkShotValue(ctx, u, x, y);
        if (!r.ok || !r.enemyHits || r.value <= bv) continue;
        bv = r.value; best = cmd;
      }
    }
  }
  return best;
}

/**
 * Bewertung eines Standfelds fuer den naechsten Schuss: Wert der Gegner im Wirkungsband (mit Beobachter), Gefahr (stark
 * gewichtet), Abstand zu Gegnern (Nahkampf meiden), Naehe zur eigenen Truppe, freie Ausbildungsfelder; ohne Gegner im Band
 * Fortschritt auf dem Weg zur Front.
 * Rating of a standing tile for the next shot: worth of the enemies in the reach band (with a spotter), danger (weighted
 * heavily), distance to enemies (avoid close combat), proximity to the own troops, free training tiles; without enemies in
 * the band progress on the way to the front.
 */
function sparkTile(ctx: Ctx, u: Unit, x: number, y: number, fld: Float32Array | null): number {
  const { s, f } = ctx;
  const A = SPARK.ai;
  const p = { x, y };
  let v = 0, inBand = 0;
  for (const e of ctx.enemies) {
    const d = dist(e, p);
    if (d <= A.keepAway && UNITS[e.type].attack > 0) v -= d <= 1 ? 30 : 12;
    if (d < SPARK.minRange || d > SPARK.range) continue;
    // eine gueltige Flaeche mit Beobachter um den Gegner / a valid area with a spotter around the enemy
    let shot = false;
    for (let dy = -SPARK.area.h + 1; dy <= 0 && !shot; dy++) for (let dx = -SPARK.area.w + 1; dx <= 0 && !shot; dx++) {
      if (sparkGeometry(s, p, e.x + dx, e.y + dy) === 'ok' && sparkSpotted(s, f, u.id, sparkArea(e.x + dx, e.y + dy))) shot = true;
    }
    if (shot) { v += worth(e) * A.targetWeight; inBand++; }
  }
  for (const c of ctx.hostileCities) { const d = dist(c, p); if (d >= SPARK.minRange && d <= SPARK.range) v += 3; }
  const dmg = expectedDamage(ctx, u, x, y);
  if (dmg > 0) v -= (dmg >= u.hp ? (worth(u) + 12) * 1.4 : (dmg / u.hp) * worth(u) * 1.1) * A.dangerWeight * ctx.prof.caution;
  let support = 0;
  for (const o of ctx.my) if (o.id !== u.id && UNITS[o.type].attack > 0 && dist(o, p) <= 2) support++;
  v += Math.min(3, support) * 2;
  const t = s.tiles[y * s.size + x];
  if (t.cityId !== null) { const c = cityById(s, t.cityId); if (c && c.owner === f && ctx.trainable.has(c.id)) v -= ctx.fa.stars >= 40 ? 50 : 18; }
  // ohne Gegner im Band: zur Front ruecken / without enemies in the band: advance to the front
  if (!inBand && fld) { const fd = fieldAt(ctx, fld, x, y, 0); v -= (Number.isFinite(fd) ? fd : 400) * 3; }
  return v;
}

/**
 * Bewegung der Geschuetze (vor planUnitMoves, das sie auslaesst): bestes Nachbarfeld oder stehen bleiben. Ein Geschuetz,
 * das in diesem Zug noch feuern koennte und ein Ziel im Band hat, bleibt stehen.
 * Movement of the guns (before planUnitMoves, which skips them): best adjacent tile or stay. A gun that could still fire
 * this turn and has a target in the band stays put.
 */
export function planSparkMove(ctx: Ctx, failed: Failed): Command | null {
  const { s } = ctx;
  for (const u of ownSparks(ctx)) {
    if (u.fresh || u.exhausted || u.attacked || u.moved || layerOf(u) !== 0) continue;
    const g = ctx.goals.get(u.id);
    const fld = g ? goalField(ctx, u, g) : null;
    const stay = sparkTile(ctx, u, u.x, u.y, fld);
    let best: Command | null = null, bv = stay + 0.5;
    for (const r of reachable(s, u)) {
      if (r.embark || r.disembark || r.board) continue;
      const v = sparkTile(ctx, u, r.x, r.y, fld);
      const cmd: Command = { type: 'move', unit: u.id, to: { x: r.x, y: r.y } };
      if (v > bv && !failed.has(key(cmd))) { bv = v; best = cmd; }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Front fuer den Kauf: ein sichtbarer Gegner oder eine feindliche Stadt nah an einer eigenen Stadt (SPARK.ai.frontRange).
 * Front for the purchase: a visible enemy or a hostile city close to an own city (SPARK.ai.frontRange).
 */
export function sparkFront(ctx: Ctx): boolean {
  const near = (p: Pos, r: number) => ctx.myCities.some((c) => dist(c, p) <= r);
  return ctx.enemies.some((e) => UNITS[e.type].attack > 0 && near(e, SPARK.ai.frontRange)) || ctx.hostileCities.some((c) => near(c, SPARK.ai.frontRange + 2));
}

/**
 * Kaufwunsch fuer einen Funken (Sparziel wie das Silo): erst ab SPARK.ai.minRound und einer Armee von minArmy Einheiten
 * (vorher geht der Aufbau vor), mit Front, unter dem Limit, in der Giesserei-Stadt mit freiem
 * Stadtfeld, die der Front am naechsten liegt; nur wenn das Netto-Einkommen den Sold traegt. Wert = Preis x buyValue.
 * Purchase wish for a spark (savings goal like the silo): only from SPARK.ai.minRound and an army of minArmy units (the
 * build-up comes first), with a front, below the limit, in the foundry city with a free
 * city tile that lies closest to the front; only if net income carries the upkeep. Worth = price x buyValue.
 */
export function sparkBuy(ctx: Ctx, net: number): { cmd: Command; cost: number; value: number } | null {
  const { s, f } = ctx;
  if (!sparkFaction(s, f) || s.round < SPARK.ai.minRound || ctx.my.length < SPARK.ai.minArmy || !sparkFront(ctx) || sparksOf(s, f).length >= SPARK.max) return null;
  if (net - (UPKEEP.flat[SPARK.unit] ?? 0) < 0) return null;
  let best: City | null = null, bd = Infinity;
  for (const c of ctx.myCities) {
    const chk = trainCheck(s, c, SPARK.unit);
    if (chk !== 'ok' && chk !== 'notEnoughStars') continue;
    let d = 30;
    for (const e of ctx.enemies) d = Math.min(d, dist(e, c));
    for (const h of ctx.hostileCities) d = Math.min(d, dist(h, c));
    if (d < bd || (d === bd && best && c.id < best.id)) { bd = d; best = c; }
  }
  if (!best) return null;
  const cost = unitCost(s, f, SPARK.unit)!;
  return { cmd: { type: 'train', city: best.id, unitType: SPARK.unit }, cost, value: cost * SPARK.ai.buyValue * ctx.prof.militaryW };
}
