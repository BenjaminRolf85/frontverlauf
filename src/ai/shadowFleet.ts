/**
 * KI der Schattenflotte (Meridon): Raketensilo bauen und starten, Radarimpuls, Sabotage des Schattenkommandos, Ziele fuer
 * Silo-Pioniere, Kommandos und den Radarwagen. Sieht nur, was die Fraktion sieht (siloPreview, ctx.enemies, erkundete
 * Felder); deterministisch, Gleichstand nach Feld und ID.
 * Shadow fleet AI (Meridon): build and launch the rocket silo, radar sweep, the Shadow Commando's sabotage, goals for silo
 * pioneers, commandos and the Radar Truck. Only sees what the faction sees (siloPreview, ctx.enemies, explored tiles);
 * deterministic, ties broken by tile and id.
 */
import {
  buildsSilos, dist, emplacementCheck, emplacementLimit, emplacementTargets, idx, isBoss, isProductionSite, isWonder, radarCheck, readySilos, sabotageTargets, sabotageThing,
  siloBuyCheck, siloPreview, silosOf, siloUnit, territoryOwner, unitById, unitCost, type City, type Command, type Pos, type Unit,
} from '../core';
import { RADAR, SABOTAGE, SILO, UNITS, VERDAN, WONDERS, type UnitTypeId } from '../data/balance';
import { worth, type Ctx, type Goal } from './analysis';

type Failed = Set<string>;
const key = (c: Command) => JSON.stringify(c);
const A = SILO.ai;

// ---------- Raketensilo: Start / rocket silo: launch ----------

/** Wert eines Starts auf (tx, ty) aus Sicht der KI (Sterne-Gegenwert) / value of a launch at (tx, ty) from the AI's view (star equivalent) */
export function siloShotValue(ctx: Ctx, from: Pos, tx: number, ty: number): { value: number; enemyHits: number; ok: boolean } {
  const { s, f } = ctx;
  const pre = siloPreview(s, f, from.x, from.y, tx, ty);
  let value = 0, enemyHits = 0;
  for (const h of pre.hits) {
    let w: number, maxHp: number, hp: number;
    if (h.turret) { w = A.gunWorth; maxHp = VERDAN.hp; hp = h.dmg + 1; }
    else {
      const u = unitById(s, h.unit!);
      if (!u) continue;
      w = isBoss(u) ? 120 : worth(u);
      maxHp = Math.max(1, u.maxHp);
      hp = u.hp;
      if (!h.own && isWonder(u) && WONDERS.interruptible[u.type as keyof typeof WONDERS.interruptible]) value += A.wonderInterrupt;
      // Verteidiger einer feindlichen Stadt: der Start bereitet den Sturm vor / defender of a hostile city: the launch prepares the assault
      if (!h.own && s.tiles[idx(s.size, u.x, u.y)].cityId !== null) value += 6;
    }
    // Brand: Folgeschaden, falls das Ziel stehen bleibt (gewichtet) / fire: follow-up damage if the target stays (weighted)
    const burn = !h.turret && !h.killed && pre.fire.some((p) => p.x === h.x && p.y === h.y) ? Math.min(hp - h.dmg, SILO.fireDamage * SILO.fireRounds) * A.fireWeight : 0;
    const v = h.killed ? w * (1 + A.killBonus) : ((h.dmg + burn) / maxHp) * w * A.damageWeight;
    if (h.own) value -= v * A.ownWeight;
    else { value += v; enemyHits++; }
  }
  return { value, enemyHits, ok: pre.check === 'ok' };
}

/**
 * Start planen: Kandidaten sind die Ecken um jeden sichtbaren Feind in Reichweite eines bereiten Silos; bester Nettowert ab
 * SILO.ai.minValue, eigene Einheiten im Ziel nur, wenn es klar lohnt (ownWeight).
 * Plan a launch: candidates are the corners around every visible enemy within range of a ready silo; best net value from
 * SILO.ai.minValue, own units in the target only when it clearly pays off (ownWeight).
 */
export function planSilo(ctx: Ctx, failed: Failed): Command | null {
  const { s, f } = ctx;
  if (!buildsSilos(s, f) || !ctx.enemies.length) return null;
  const silos = readySilos(s, f);
  if (!silos.length) return null;
  let best: Command | null = null, bv = A.minValue - 1e-9;
  for (const from of silos) {
    const seen = new Set<number>();
    for (const e of ctx.enemies) {
      if (dist(e, from) > SILO.launchRange + 1) continue;
      for (let dy = -SILO.area.h + 1; dy <= 0; dy++) for (let dx = -SILO.area.w + 1; dx <= 0; dx++) {
        const tx = Math.max(0, Math.min(e.x + dx, s.size - SILO.area.w)), ty = Math.max(0, Math.min(e.y + dy, s.size - SILO.area.h));
        const k = ty * s.size + tx;
        if (seen.has(k)) continue;
        seen.add(k);
        const cmd: Command = { type: 'siloLaunch', x: from.x, y: from.y, tx, ty };
        if (failed.has(key(cmd))) continue;
        const r = siloShotValue(ctx, from, tx, ty);
        if (!r.ok || !r.enemyHits || r.value <= bv) continue;
        bv = r.value; best = cmd;
      }
    }
  }
  return best;
}

// ---------- Raketensilo: Bau / rocket silo: building ----------

/** Freie Silo-Plaetze / free silo slots */
export function freeSiloSlots(ctx: Ctx): number {
  if (!buildsSilos(ctx.s, ctx.f)) return 0;
  return Math.max(0, emplacementLimit(ctx.s, ctx.f) - silosOf(ctx.s, ctx.f).length);
}

/** Lohnt ein Silo jetzt? Staedte, Armee, Sterne, ein bekannter Gegner / is a silo worth it now? cities, army, stars, a known enemy */
function siloWanted(ctx: Ctx, ignoreStars = false): boolean {
  if (!freeSiloSlots(ctx) || ctx.myCities.length < A.minCities) return false;
  if (!ignoreStars && ctx.fa.stars < SILO.cost + A.reserve) return false;
  if (ctx.my.length < ctx.desiredArmy * A.armyShare) return false;
  return ctx.hostileCities.length > 0 || ctx.enemies.length > 0;
}

/** Abstand zum naechsten bekannten Gegner oder zur naechsten feindlichen Stadt / distance to the nearest known enemy or hostile city */
function frontDistance(ctx: Ctx, p: Pos): number {
  let d = 20;
  for (const e of ctx.enemies) if (UNITS[e.type].attack > 0) d = Math.min(d, dist(e, p));
  for (const h of ctx.hostileCities) d = Math.min(d, dist(h, p));
  return d;
}

/**
 * Bester Silo-Bauplatz neben u (Pionier): sicher (nicht bedroht, nicht direkt an der Front), aber mit feindlichen Staedten in
 * Raketenreichweite; null = nicht bauen.
 * Best silo site next to u (pioneer): safe (not threatened, not right at the front) but with hostile cities within rocket
 * range; null = do not build.
 */
export function siloOption(ctx: Ctx, u: Unit, ignoreStars = false): { x: number; y: number; v: number } | null {
  if (!siloWanted(ctx, ignoreStars)) return null;
  const { s } = ctx;
  let best: { x: number; y: number; v: number } | null = null;
  const sites = ignoreStars ? siloSitesIgnoringStars(ctx, u) : emplacementTargets(s, u);
  for (const p of sites) {
    if (ctx.threat[idx(s.size, p.x, p.y)].length) continue;
    const front = frontDistance(ctx, p);
    if (front < 3) continue;
    let inRange = 0;
    for (const h of ctx.hostileCities) if (dist(h, p) <= SILO.launchRange) inRange++;
    const t = s.tiles[idx(s.size, p.x, p.y)];
    const v = 12 + Math.min(front, 7) + inRange * 3 - (t.road ? 3 : 0);
    if (!best || v > best.v || (v === best.v && idx(s.size, p.x, p.y) < idx(s.size, best.x, best.y))) best = { x: p.x, y: p.y, v };
  }
  return best;
}

/** Bauplaetze neben u, auch wenn die Sterne noch fehlen / sites next to u, even while stars are still missing */
function siloSitesIgnoringStars(ctx: Ctx, u: Unit): Pos[] {
  const out: Pos[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const c = emplacementCheck(ctx.s, u, u.x + dx, u.y + dy);
    if (c === 'ok' || c === 'notEnoughStars') out.push({ x: u.x + dx, y: u.y + dy });
  }
  return out;
}

/**
 * Kaufwunsch fuer ein Silo (Sparziel): ein Pionier steht neben einem guten Bauplatz, die Sterne duerfen noch fehlen.
 * Purchase wish for a silo (savings goal): a pioneer stands next to a good site, stars may still be missing.
 */
export function siloBuy(ctx: Ctx): { cmd: Command; cost: number; value: number } | null {
  if (!siloWanted(ctx, true)) return null;
  let best: { cmd: Command; v: number } | null = null;
  for (const u of ctx.my) {
    if (u.fresh || u.exhausted || u.attacked || !SILO.builders.includes(u.type)) continue;
    const o = siloOption(ctx, u, true);
    if (o && (!best || o.v > best.v)) best = { cmd: { type: 'emplacement', unit: u.id, x: o.x, y: o.y }, v: o.v };
  }
  return best ? { cmd: best.cmd, cost: SILO.cost, value: SILO.cost * A.buyValue } : null;
}

/** Ziel fuer Pioniere, solange ein Silo-Platz frei ist: die sicherste eigene Stadt / goal for pioneers while a silo slot is free: the safest own city */
export function siloGoal(ctx: Ctx, u: Unit): Goal | null {
  if (u.type !== 'pioneer' || !siloWanted(ctx, true)) return null;
  // nur ein Pionier je freiem Platz / only one pioneer per free slot
  const builders = ctx.my.filter((o) => o.type === 'pioneer').sort((a, b) => a.id - b.id);
  if (builders.indexOf(u) >= freeSiloSlots(ctx)) return null;
  let best: City | null = null, bs = -Infinity;
  for (const c of ctx.myCities) {
    if (silosOf(ctx.s, ctx.f).some((g) => dist(g, c) <= 2)) continue;
    const sc = Math.min(frontDistance(ctx, c), 8) * 2 - dist(u, c) * 0.6 + (c.isHQ ? 2 : 0);
    if (sc > bs) { bs = sc; best = c; }
  }
  if (!best) return null;
  return { kind: 'support', x: best.x, y: best.y, value: 25, cap: 99, distW: 0, src: `t${best.y * ctx.size + best.x}l`, water: false, targetId: best.id };
}

/**
 * Kaufwuensche fuer Lenkflugkoerper an den eigenen Silos (SILO.units, einer je Silo und Zug): bis zum Zielanteil an der
 * Armee (SILO.ai.missileShare mit bekanntem Gegner, sonst missileQuiet), nur wenn das Netto-Einkommen den Sold traegt;
 * Wert wie bei der Ausbildung in der Stadt (Fehlbestand der Armee), mal missileValue.
 * Purchase wishes for Guided Missiles at the own silos (SILO.units, one per silo and turn): up to the target share of the
 * army (SILO.ai.missileShare with a known enemy, otherwise missileQuiet), only if net income carries the upkeep; value as
 * for training in a city (army deficit), times missileValue.
 */
export function siloMissileBuys(ctx: Ctx, net: number, upFor: (t: UnitTypeId) => number, deficit: number): { cmd: Command; cost: number; value: number; save: boolean }[] {
  const { s, f, prof } = ctx;
  if (!buildsSilos(s, f)) return [];
  const army = Math.max(1, ctx.my.length);
  const want = (ctx.enemies.length || ctx.hostileCities.length ? A.missileShare : A.missileQuiet) * (prof.pref.guidedMissile ?? 1);
  let have = ctx.my.filter((u) => siloUnit(u.type)).length;
  const out: { cmd: Command; cost: number; value: number; save: boolean }[] = [];
  for (const g of silosOf(s, f)) {
    for (const type of SILO.units) {
      if (have / army >= want) return out;
      const chk = siloBuyCheck(s, f, g.x, g.y, type);
      if (chk !== 'ok' && chk !== 'notEnoughStars') continue;
      if (net - upFor(type) < 0) continue;
      const cost = unitCost(s, f, type)!;
      const base = deficit > 0 ? cost * (1.15 + 0.08 * Math.min(deficit, 5)) * prof.militaryW : cost * 0.25;
      out.push({ cmd: { type: 'siloBuy', x: g.x, y: g.y, unitType: type }, cost, value: base * A.missileValue + cost * ctx.pf, save: true });
      have++;
    }
  }
  return out;
}

/** Zusaetzlicher Pionier-Anteil fuer Silos / extra pioneer share for silos */
export function siloPioneerShare(ctx: Ctx): number {
  if (!siloWanted(ctx, true)) return 0;
  return ctx.my.some((o) => o.type === 'pioneer') ? 0 : 0.3;
}

// ---------- Radar / radar ----------

/**
 * Radarimpuls, wenn Gegner in der Naehe erwartet werden: feindliche Stadt oder mehrere bekannte Gegner im Umkreis, eigene
 * Kampfeinheiten daneben (vor einem Angriff) oder angeschlagene eigene Einheiten (Beschuss aus dem Nebel).
 * Radar sweep when enemies are expected nearby: a hostile city or several known enemies in the radius, own combat units
 * next to it (before an attack) or battered own units (fire out of the fog).
 */
export function planRadar(ctx: Ctx, failed: Failed): Command | null {
  const { s } = ctx;
  for (const u of ctx.my) {
    if (radarCheck(s, u) !== 'ok') continue;
    const near = (p: Pos) => dist(p, u) <= RADAR.radius;
    const enemies = ctx.enemies.filter((e) => dist(e, u) <= RADAR.ai.enemyRange).length;
    const cities = ctx.hostileCities.filter(near).length;
    const own = ctx.my.filter((o) => o.id !== u.id && near(o) && UNITS[o.type].attack > 0);
    const hurt = own.filter((o) => o.hp < o.maxHp).length;
    if (!own.length) continue;
    if (enemies < RADAR.ai.nearEnemies && !cities && !hurt) continue;
    const cmd: Command = { type: 'radarSweep', unit: u.id };
    if (!failed.has(key(cmd))) return cmd;
  }
  return null;
}

/** Ziel des Radarwagens: hinter der vordersten eigenen Kampfeinheit / goal of the Radar Truck: behind the foremost own combat unit */
export function radarGoal(ctx: Ctx, u: Unit, front: Goal): Goal {
  let best: Unit | null = null, bs = Infinity;
  for (const o of ctx.my) {
    if (o.id === u.id || UNITS[o.type].attack <= 0 || o.type === 'guidedMissile') continue;
    const g = ctx.goals.get(o.id);
    if (!g || (g.kind !== 'city' && g.kind !== 'hunt' && g.kind !== 'stage' && g.kind !== 'defend')) continue;
    const sc = dist(o, g.x >= 0 ? g : o) * 2 + dist(u, o);
    if (sc < bs) { bs = sc; best = o; }
  }
  if (!best) return front;
  return { kind: 'support', x: best.x, y: best.y, value: 25, cap: 99, distW: 0, src: `t${best.y * ctx.size + best.x}l`, water: false, targetId: best.id };
}

// ---------- Sabotage / sabotage ----------

/** Wert einer Sabotage auf (x, y) / value of a sabotage on (x, y) */
export function sabotageValue(ctx: Ctx, x: number, y: number): number {
  const { s, f } = ctx;
  const th = sabotageThing(s, f, x, y);
  if (!th) return 0;
  const S = SABOTAGE.ai;
  if (th.what === 'outpost') return S.outpost;
  if (th.what === 'road') {
    // Strasse an einer feindlichen Stadt trennt die Verbindung eher / a road next to a hostile city more likely cuts the connection
    return S.road + (ctx.hostileCities.some((c) => dist(c, { x, y }) <= 1) ? S.connectBonus : 0);
  }
  return isProductionSite(th.building) ? S.site : S.building;
}

/** Sabotage, sobald sich ein Ziel lohnt / sabotage once a target is worth it */
export function planSabotage(ctx: Ctx, failed: Failed): Command | null {
  let best: Command | null = null, bv = SABOTAGE.ai.minValue - 1e-9;
  for (const u of ctx.my) {
    for (const p of sabotageTargets(ctx.s, u)) {
      const v = sabotageValue(ctx, p.x, p.y);
      const cmd: Command = { type: 'sabotage', unit: u.id, x: p.x, y: p.y };
      if (v > bv && !failed.has(key(cmd))) { bv = v; best = cmd; }
    }
  }
  return best;
}

/**
 * Ziel fuer Schattenkommandos: jedes zweite Kommando zieht zum wertvollsten bekannten Sabotageziel im Umkreis (Aussenposten,
 * Produktionsstaette, Gebaeude, Strasse im feindlichen Gebiet); die anderen kaempfen mit der Armee.
 * Goal for Shadow Commandos: every second commando heads for the most valuable known sabotage target nearby (outpost,
 * production site, building, road in hostile territory); the others fight with the army.
 */
export function sabotageGoal(ctx: Ctx, u: Unit): Goal | null {
  if (u.type !== 'shadowCommando' || u.id % 2 === 0) return null;
  const { s, f, size } = ctx;
  let best: Pos | null = null, bs = 0;
  for (let k = 0; k < ctx.n; k++) {
    if (!ctx.fa.explored[k]) continue;
    const t = s.tiles[k];
    if (!t.outpost && !t.building && !t.road) continue;
    const x = k % size, y = Math.floor(k / size);
    const d = dist(u, { x, y });
    if (d > 10) continue;
    const o = t.outpost?.owner ?? territoryOwner(s, t);
    if (o === null || o === f) continue;
    const sc = sabotageValue(ctx, x, y) - d * 1.5;
    if (sc > bs) { bs = sc; best = { x, y }; }
  }
  if (!best) return null;
  return { kind: 'support', x: best.x, y: best.y, value: 22, cap: 1, distW: 0, src: `t${best.y * size + best.x}l`, water: false };
}
