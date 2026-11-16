/**
 * Taktik: Einnahmen, Angriffe, Bekehrungen, Bewegungen, Heilung und Aussenposten je Einheit.
 * Tactics: captures, attacks, conversions, moves, healing and outposts per unit.
 */
import {
  canSeeMine, mineTargets, erupts, retreatCheck, retreatDamage, repairCheck, repairAmount, alienHealBlocked, rocketTargets, fuelBurn, area, attackTargets, barrierTargets, terraformTargets, canActStill, canAttackNow, canHeal, captureKind, persuadeCheck, persuadeTargets, cityById, combatPreview, convertTargets,
  dist, effectiveRange, unitRange, has, healAmount, heliSafe, idx, isRefuelSpot, isShip, outpostCheck, reachable, territoryOwner, isWonder, victoryStatus,
  turretList, turretTargets, turretPreview, hitDamage, weatherAt, weatherHurts, homeDefenseAt, memorialMult, gunHostile, gunStats, type Command, type Reach, type Unit, type Pos,
} from '../core';
import { emplacementOption } from './emplacements';
import { scientistAttackBonus, truceExposure, workSpotPenalty } from './mothership';
import { carrierAttackBonus, planSeize } from './temple';
import { AI, ALVENIA_UNITS, BARRIER, CAMPAIGN_AI, COUNTER, ECON, EMPLACEMENT, HIT_KINDS, INFANTRY_TYPES, UNITS, VERDAN, WONDERS, type AlveniaUnitId, type WonderUnitId } from '../data/balance';
import {
  defBonusAt, expectedDamage, fieldAt, goalField, layerOf, worth, type Ctx, type Goal,
} from './analysis';
import { hashNoise } from './profile';
// Endgegner der Kampagne / campaign boss
import { isBoss } from '../core';
import { SWARM_MOTHER } from '../data/balance';
import { bossHome } from './analysis';

type Failed = Set<string>;
export const cmdKey = (c: Command) => JSON.stringify(c);
const ok = (failed: Failed, c: Command) => !failed.has(cmdKey(c));

// ---------- Angriffe / attacks ----------

/** Wert eines Angriffs (Sterne-Gegenwert) / value of an attack (star equivalent) */
export function attackValue(ctx: Ctx, a: Unit, d: Unit, ax = a.x, ay = a.y): number {
  const { s } = ctx;
  // von einem anderen Feld: erst ziehen, dann feuern, also mit dem Schaden nach Bewegung (MOVE_FIRE)
  // from another tile: move first, then fire, so with the damage after moving (MOVE_FIRE)
  const att = ax === a.x && ay === a.y ? a : { ...a, x: ax, y: ay, moved: true };
  const p = combatPreview(s, att, d);
  // Trefferglueck: Vernichtungschance und Erwartungswerte statt fester Treffer / hit luck: kill chance and expected values instead of fixed hits
  const dmgNoKill = p.killChance < 1 ? (p.expected - p.killChance * d.hp) / (1 - p.killChance) : 0;
  let v = p.killChance * (worth(d) + 8) + (1 - p.killChance) * Math.min(1, Math.max(0, dmgNoKill) / d.hp) * worth(d) * 0.75;
  if (p.retFull > 0) {
    const ret = p.expectedRet / Math.max(0.01, 1 - p.killChance);
    v -= (1 - p.killChance) * (ret >= a.hp ? worth(a) + 6 : (ret / a.hp) * worth(a) * 0.7);
  }
  const t = s.tiles[idx(s.size, d.x, d.y)];
  if (t.cityId !== null) {
    const c = cityById(s, t.cityId);
    if (c && c.owner === ctx.f) v += 30; // Feind in eigener Stadt / enemy inside own city
    else if (c) v += 4 + p.killChance * 10; // Verteidiger einer Zielstadt / defender of a target city
  }
  for (const c of ctx.myCities) if (dist(c, d) === 1) { v += 6; break; }
  // Feindliches Wunder: jeder Treffer zaehlt (Unterbrechung oder Zerstoerung) / hostile wonder: every hit counts (interruption or destruction)
  if (isWonder(d) && d.owner !== ctx.f) v += 45 + victoryStatus(s, d.owner).ratio * 60 + (WONDERS.interruptible[d.type as WonderUnitId] ? 25 : 0);
  // Kampagne: der markierte Endgegner ist das Missionsziel, jeder Treffer zaehlt / campaign: the marked boss is the objective, every hit counts
  if (isBoss(d) && s.campaign?.units?.includes(d.id) && (ctx.f === 0 || s.campaign.allies?.includes(ctx.f))) v += CAMPAIGN_AI.bossAttackBonus;
  // Kampagne m2: die Zyrr wollen den Wissenschaftler / campaign m2: the Zyrr want the scientist
  v += scientistAttackBonus(ctx, d);
  // Kampagne m4: der Traeger der Kriegsplaene ist das Ziel des Kults / campaign m4: the carrier of the war plans is the cult's target
  v += carrierAttackBonus(ctx, d) * (p.killChance + 0.4);
  // Heiliges Alvenia: Suender zuerst richten / Holy Alvenia: judge sinners first
  if (p.judgement > 0) v += AI.sinnerTarget * (0.5 + p.killChance);
  // Kamikaze: die Drohne ist danach verbraucht / kamikaze: the drone is spent afterwards
  if (has(a, 'kamikaze')) v -= worth(a) * AI.kamikazeCost;
  return v;
}

/** Bester Angriff von hypothetischer Position / best attack from a hypothetical position */
function bestAttackFrom(ctx: Ctx, u: Unit, x: number, y: number): number {
  const st = UNITS[u.type];
  if (st.attack <= 0 || st.range <= 0) return 0;
  // Reichweite inkl. Wetter und Fraktionsbonus (Korvat-Artillerie) / range incl. weather and faction bonus (Korvat artillery)
  const range = effectiveRange(ctx.s, u);
  let best = 0;
  for (const e of ctx.enemies) {
    if (dist(e, { x, y }) > range) continue;
    best = Math.max(best, attackValue(ctx, u, e, x, y));
  }
  return best;
}

export function planCapture(ctx: Ctx, failed: Failed): Command | null {
  // Kampagne m4: Kriegsplaene bergen oder aufheben / campaign m4: seize or pick up the war plans
  const seize = planSeize(ctx, (c) => ok(failed, c));
  if (seize) return seize;
  for (const u of ctx.my) {
    if (!captureKind(ctx.s, u)) continue;
    const c: Command = { type: 'capture', unit: u.id };
    if (ok(failed, c)) return c;
  }
  // Kampagne, Alvenia und Meridon: Siedlungen ueberzeugen statt erobern / campaign, Alvenia and Meridon: persuade settlements instead of capturing
  for (const u of ctx.my) {
    for (const city of persuadeTargets(ctx.s, u)) {
      if (persuadeCheck(ctx.s, u, city) !== 'ok') continue;
      const c: Command = { type: 'persuade', unit: u.id, city: city.id };
      if (ok(failed, c)) return c;
    }
  }
  return null;
}

export function planConvert(ctx: Ctx, failed: Failed): Command | null {
  let best: Command | null = null;
  let bv = -Infinity;
  for (const u of ctx.my) {
    if (!has(u, 'convert')) continue;
    for (const t of convertTargets(ctx.s, u)) {
      // Hubschrauber ohne Rueckflugmoeglichkeit nicht uebernehmen (wuerde abstuerzen)
      // do not convert helicopters that could not get back to refuel (they would crash)
      if (t.fuel !== null && !heliSafe(ctx.s, { ...t, owner: ctx.f }, t.x, t.y)) continue;
      const v = worth(t) + t.hp * 0.2;
      const c: Command = { type: 'convert', unit: u.id, target: t.id };
      if (v > bv && ok(failed, c)) { bv = v; best = c; }
    }
  }
  return best;
}

export function planAttack(ctx: Ctx, failed: Failed): Command | null {
  const { s, prof } = ctx;
  let best: Command | null = null;
  let bv = -Infinity;
  for (const u of ctx.my) {
    if (!canAttackNow(u)) continue;
    // Hubschrauber: ohne Bewegung danach nur von sicherem Feld / helicopter: only from a safe tile
    if (u.fuel !== null && !u.moved && !heliSafe(s, u, u.x, u.y)) continue;
    if (lazyUnit(ctx, u)) continue;
    for (const t of attackTargets(s, u)) {
      let v = attackValue(ctx, u, t);
      // Kamikaze nur, wenn es sich lohnt (der Wert der Drohne ist schon abgezogen) / kamikaze only when worth it (the drone's worth is already subtracted)
      if (has(u, 'kamikaze') && v < AI.kamikazeMin) continue;
      // Fernkampf ohne Gegenschlag zuerst / ranged first (no retaliation)
      if (UNITS[u.type].range > 1) v += 1;
      const c: Command = { type: 'attack', unit: u.id, target: t.id };
      if (v > bv && ok(failed, c)) { bv = v; best = c; }
      // Menschen: geordneter Rueckzug, wenn angeschlagen oder der Angriff sich nicht lohnt / humans: orderly retreat when battered or the attack is not worth it
      if ((u.hp < u.maxHp * 0.45 || v < 0) && retreatCheck(s, u, t) === 'ok') {
        const rv = (retreatDamage(s, u, t) / t.hp) * worth(t) * 0.6 + (u.hp < u.maxHp * 0.45 ? 4 : 1);
        const rc: Command = { type: 'retreat', unit: u.id, target: t.id };
        if (rv > bv && ok(failed, rc)) { bv = rv; best = rc; }
      }
    }
  }
  // Verdan-Geschuetze: lohnende Ziele, besonders wach / Verdan guns: worthwhile targets, especially when awake
  for (const u of ctx.my) {
    if (lazyUnit(ctx, u)) continue;
    if (u.fuel !== null && !u.moved && !heliSafe(s, u, u.x, u.y)) continue;
    for (const p of turretTargets(s, u)) {
      const v = gunAttackValue(ctx, u, p);
      if (has(u, 'kamikaze') && v < AI.kamikazeMin) continue;
      const c: Command = { type: 'attackTurret', unit: u.id, x: p.x, y: p.y };
      if (v > bv && ok(failed, c)) { bv = v; best = c; }
    }
  }
  // Mech-Raketen: nur lohnende Ziele, Munition ist knapp / mech rockets: only worthwhile targets, ammo is scarce
  for (const u of ctx.my) {
    if (lazyUnit(ctx, u)) continue;
    for (const t of rocketTargets(s, u)) {
      const v = attackValue(ctx, u, t) - 2;
      const c: Command = { type: 'rocket', unit: u.id, target: t.id };
      if (v > bv && ok(failed, c)) { bv = v; best = c; }
    }
  }
  return best && bv >= prof.attackMin ? best : null;
}

// ---------- Verdan-Geschuetze / Verdan guns ----------

const gunCache = new WeakMap<Ctx, (Pos & { hp: number; active: boolean; owner?: number })[]>();
/**
 * Bekannte (aufgedeckte) feindliche Geschuetze: Verdan und Stellungen von Kriegsgegnern (eigene und befreundete nicht).
 * Known (explored) hostile guns: Verdan and emplacements of enemies at war (not own or friendly ones).
 */
function knownGuns(ctx: Ctx) {
  let g = gunCache.get(ctx);
  if (!g) { g = turretList(ctx.s).filter((p) => ctx.fa.explored[idx(ctx.size, p.x, p.y)] && gunHostile(ctx.s, p, ctx.f)); gunCache.set(ctx, g); }
  return g;
}

/**
 * Wert eines Angriffs auf ein Geschuetz: Schaden und Zerstoerung zaehlen, wache Geschuetze mehr, Gegenschlag kostet.
 * Value of an attack on a gun: damage and destruction count, awake guns more, return fire costs.
 */
function gunAttackValue(ctx: Ctx, u: Unit, p: Pos): number {
  const gun = ctx.s.tiles[idx(ctx.size, p.x, p.y)].turret!;
  const pre = turretPreview(ctx.s, u, p);
  let expected = 0, kill = 0, ret = 0;
  for (const k of HIT_KINDS) {
    const o = pre.odds[k];
    if (o <= 0) continue;
    const d = hitDamage(pre.toTurret, k);
    expected += o * Math.min(d, gun.hp);
    if (d >= gun.hp) kill += o; else ret += o * pre.ret(gun.hp - d);
  }
  // Stellungen: eigener Preis, mehr wenn sie eigene Einheiten oder Staedte bedrohen / emplacements: own prize, more when they threaten own units or cities
  const own = gun.owner !== undefined;
  const near = own ? ctx.my.filter((o) => dist(o, p) <= EMPLACEMENT.range).length + ctx.myCities.filter((c) => dist(c, p) <= EMPLACEMENT.range + 1).length * 2 : 0;
  const prize = own ? EMPLACEMENT.ai.prize + near * 3 : gun.active ? 34 : 14;
  let v = (expected / gunStats(gun).hp) * prize + kill * prize;
  v -= ret >= u.hp ? worth(u) + 6 : (ret / u.hp) * worth(u) * 0.7;
  // Kamikaze: die Drohne ist danach verbraucht / kamikaze: the drone is spent afterwards
  if (has(u, 'kamikaze')) v -= worth(u) * AI.kamikazeCost;
  return v;
}

/** Gefahr durch wache Verdan-Geschuetze auf (x, y) / danger from awake Verdan guns at (x, y) */
function gunDanger(ctx: Ctx, x: number, y: number): number {
  let n = 0;
  for (const g of knownGuns(ctx)) if (g.active && g.owner === undefined && dist(g, { x, y }) <= VERDAN.range) n++;
  return n;
}
/** Feindliche Geschuetzstellungen in Schussweite von (x, y) / hostile gun emplacements within range of (x, y) */
function emplacementDanger(ctx: Ctx, x: number, y: number): number {
  let n = 0;
  for (const g of knownGuns(ctx)) if (g.owner !== undefined && dist(g, { x, y }) <= EMPLACEMENT.range) n++;
  return n;
}

function lazyUnit(ctx: Ctx, u: Unit): boolean {
  const l = ctx.prof.lazy;
  return l > 0 && hashNoise(u.id, ctx.s.round, 7) < 1 / l;
}

// ---------- Wunder / wonders ----------

/**
 * Eigene Wunder: heilen, wenn beschaedigt; Erdkernbohrer faehrt auf ein sicheres Feld im eigenen Gebiet und bleibt dann stehen.
 * Own wonders: heal when damaged; the earth-core drill drives to a safe tile in own territory and then stands still.
 */
export function planWonderUnits(ctx: Ctx, failed: Failed): Command | null {
  const { s, f } = ctx;
  for (const u of ctx.my) {
    if (!isWonder(u) || u.fresh || u.exhausted) continue;
    if (u.type === 'coreDrill') {
      const t = s.tiles[idx(s.size, u.x, u.y)];
      const danger = expectedDamage(ctx, u, u.x, u.y);
      const safeHere = territoryOwner(s, t) === f && t.cityId === null && danger === 0;
      // stehen bleiben, solange es sicher ist (oder schon gebohrt wird und keine Lebensgefahr besteht)
      // stay while safe (or while drilling and not in mortal danger)
      const stay = safeHere || ((u.stillRounds ?? 0) > 0 && danger < u.hp * 0.6 && t.cityId === null);
      if (!stay && !u.moved) {
        let best: { x: number; y: number } | null = null, bv = -Infinity;
        for (const r of reachable(s, u)) {
          const rt = s.tiles[idx(s.size, r.x, r.y)];
          if (rt.cityId !== null || r.embark || r.disembark) continue;
          let v = -expectedDamage(ctx, u, r.x, r.y) * 10 + (territoryOwner(s, rt) === f ? 20 : 0);
          let near = 99;
          for (const e of ctx.enemies) near = Math.min(near, dist(e, r));
          v += Math.min(6, near);
          if (v > bv) { bv = v; best = r; }
        }
        if (best) {
          const c: Command = { type: 'move', unit: u.id, to: best };
          if (ok(failed, c)) return c;
        }
      }
    }
    if (canHeal(u) && !u.moved && u.hp < u.maxHp && !alienHealBlocked(s, u)) {
      const c: Command = { type: 'heal', unit: u.id };
      if (ok(failed, c)) return c;
    }
  }
  return null;
}

// ---------- Bewegung / movement ----------

const assaultCache = new WeakMap<Goal, number>();

/** Vorsichtsfaktor fuer ein Ziel: bei lokaler Ueberlegenheit Sturm / caution factor: assault on local superiority */
export function cautionFor(ctx: Ctx, g: Goal, u?: Unit): number {
  // Hubschrauber bleiben auch bei Belagerung vorsichtig / helicopters stay careful even in a siege
  if (u && u.fuel !== null && ctx.siege) return 1 / ctx.siegeCaution;
  if (g.kind === 'retreat' || g.kind === 'refuel' || g.x < 0) return 1;
  const cached = assaultCache.get(g);
  if (cached !== undefined) return cached;
  // eigene Gruppe im weiteren Umkreis gegen Gegner nahe am Ziel / own group in a wider radius vs enemies near the goal
  let own = 0, opp = 0;
  for (const u of ctx.my) if (dist(u, g) <= 5 && UNITS[u.type].attack > 0 && !isWonder(u)) own += worth(u) * (u.hp / u.maxHp);
  for (const e of ctx.enemies) if (dist(e, g) <= 3 && !(isWonder(e) && e.type !== 'waal')) opp += worth(e) * (e.hp / e.maxHp);
  if (g.kind === 'city') {
    const c = ctx.hostileCities.find((h) => h.x === g.x && h.y === g.y);
    opp += c && c.bunkerRing ? 30 : 12;
  }
  let f = 1;
  if (g.kind === 'defend') f = 0.6;
  if ((g.kind === 'city' || g.kind === 'hunt' || g.kind === 'stage') && own >= opp * 1.3 / ctx.prof.aggression) f = 0.3 * (1 - ctx.prof.late * 0.6);
  // Belagerung: volle Armee rueckt trotz Gefahr vor / siege: a full army advances despite danger
  else if (ctx.siege && (g.kind === 'city' || g.kind === 'hunt' || g.kind === 'stage')) f = 0.35;
  assaultCache.set(g, f);
  return f;
}

function canAttackAfter(u: Unit, r?: Reach): boolean {
  if (r && (r.embark || r.disembark)) return false;
  return has(u, 'dash') && !u.attacked && UNITS[u.type].attack > 0 && UNITS[u.type].range > 0;
}

/** Bewertung eines Endfelds / evaluation of a destination tile */
export function evalTile(ctx: Ctx, u: Unit, g: Goal, fld: Float32Array, x: number, y: number, layer: number, r?: Reach): number {
  const { s, prof, size, f } = ctx;
  const k = y * size + x;
  const t = s.tiles[k];
  const fly = has(u, 'fly');
  let v = 0;
  if (u.fuel !== null) {
    if (!heliSafe(s, u, x, y)) return -1e6;
    if (!heliSecure(ctx, u, x, y)) v -= u.fuel <= 3 ? 200 : 40;
    // knapper Sprit: Tankstelle muss von dort tatsaechlich erreichbar sein (Gegner und Kontrollzonen blockieren)
    // low fuel: a refuel spot must actually be reachable from there (enemies and control zones block)
    if (u.fuel - fuelBurn(s) <= 2 && !isRefuelSpot(s, f, x, y)) {
      const ghost: Unit = { ...u, x, y, moved: false, attacked: false, exhausted: false, fresh: false, moveDone: false };
      const spots = reachable(s, ghost, true).filter((q) => isRefuelSpot(s, f, q.x, q.y)).length;
      // zu wenige Landeplaetze: ein Gegner kann den Rueckweg noch versperren / too few landing tiles: an enemy may still block the way
      // nach diesem Zug kaum Sprit: lieber an der Tankstelle bleiben / little fuel after this turn: prefer staying at a refuel spot
      v -= 100;
      if (spots === 0) v -= 300;
      else if (spots < 3) v -= 150;
    }
    // eine Runde Sprit als Reserve, falls Gegner den Rueckweg blockieren / one round of fuel in reserve in case enemies block the way back
    if (u.fuel > 1 && !isRefuelSpot(s, f, x, y) && !heliSafe(s, { ...u, fuel: u.fuel - 1 }, x, y)) v -= 60;
  }
  const fd = fieldAt(ctx, fld, x, y, layer);
  v -= (Number.isFinite(fd) ? fd : 400) * (ctx.siege && u.fuel === null ? 5 : 3);
  const onGoal = g.x === x && g.y === y;
  if (onGoal) {
    if (g.kind === 'village') v += 30;
    else if (g.kind === 'city') v += 20 + 25 * prof.aggression;
    else if (g.kind === 'defend') v += 22;
    // Kampagne: Halte- und Zielfelder (Portal, Artefakt, Hoehle, Ruinen) wirklich betreten / campaign: really step onto hold and target tiles
    else if (g.kind === 'bunker' && s.campaign) v += CAMPAIGN_AI.holdBonus;
  }
  const type = layer === 1 ? u.type : (u.carried ?? u.type);
  // Kampagne m2: den Arbeitsplatz des Wissenschaftlers freilassen / campaign m2: keep the scientist's work spot free
  v -= workSpotPenalty(ctx, u, x, y);
  // Kampagne m2: in der Waffenruhe Abstand zu fremden Truppen halten / campaign m2: keep away from foreign troops during the truce
  v -= truceExposure(ctx, u, x, y);
  // Belagerungsring: bei Sturm direkt neben die Zielstadt / siege ring: next to the target city when assaulting
  if (g.kind === 'city' && !onGoal && dist(g, { x, y }) === 1 && cautionFor(ctx, g) < 0.5) v += 12;
  if (t.feature === 'bunker' && ctx.fa.explored[k]) v += 20; // Bunkerbelohnung / bunker reward
  // feindliche Panzersperre bremst eigene Fahrzeuge / hostile tank barrier slows own vehicles
  if (r && t.barrier && t.barrier.owner !== f && ctx.fa.explored[k] && BARRIER.vehicles.includes(u.type)) v -= 15;
  // gesehene feindliche Mine meiden; Flieger meiden feindliche Flakzonen / avoid seen hostile mines; flyers avoid hostile flak zones
  if (r && t.mine && t.mine.owner !== f && !fly && layer === 0 && canSeeMine(s, f, x, y)) v -= 60;
  if (fly && ctx.enemies.some((e) => has(e, 'flak') && dist(e, { x, y }) <= COUNTER.flak.range)) v -= 12;
  if (t.cityId !== null) {
    const c = cityById(s, t.cityId)!;
    const capturer = !fly && type !== 'spy' && type !== 'artillery' && type !== 'sunLance' && type !== 'medic' && layer === 0;
    if (c.owner === f) {
      // blockiert Ausbildung; eine frische Einheit verteidigt die Stadt ebenso / blocks training; a fresh unit defends as well
      // Stadtfeld fuer Ausbildung freimachen, besonders mit vollem Sternekonto / clear the city tile for training, especially with stars to spend
      if (ctx.trainable.has(c.id)) v -= ctx.fa.stars >= 40 ? 50 : 18;
      else if (!(onGoal && g.kind === 'defend')) v -= 4;
    } else if (capturer && c.owner === null) v += 22;
    else if (capturer) v += 14 * prof.aggression;
  }
  // Gefahr / danger
  const asShip = layer === 1;
  const dmg = expectedDamage(ctx, u, x, y, asShip);
  if (dmg > 0) {
    const w = worth(u);
    let pen = dmg >= u.hp ? (w + 12) * 1.4 : (dmg / u.hp) * w * 1.1;
    if (type === 'artillery' || type === 'sunLance') pen *= 1.8;
    if (type === 'medic' || type === 'spy') pen *= 1.3;
    v -= pen * prof.caution * cautionFor(ctx, g, u);
  }
  v += (defBonusAt(ctx, u, x, y, asShip) - 1) * 3;
  // Glaubensbollwerk (Alvenia): bedroht lieber auf eigenem Gebiet stehen / Bulwark of Faith (Alvenia): when threatened, prefer own territory
  if (dmg > 0) v += homeDefenseAt(s, u, x, y) * AI.homeGround;
  // Mahnmal des Kults: der Kult kaempft gern von dort, menschliche Angreifer meiden es (Furcht), nur mit Gegnern in Reichweite
  // cult memorial: the cult likes to fight from there, human attackers avoid it (fear), only with enemies in reach
  if (UNITS[type].attack > 0 && ctx.enemies.some((e) => dist(e, { x, y }) <= UNITS[type].range + 1)) v += (memorialMult(s, u, x, y) - 1) * AI.memorialGround;
  // Meteorschauer oder Saeureregen zu Beginn der naechsten Runde: verletzte Einheiten in Staedte und Bunker
  // meteor shower or acid rain at the start of the next round: hurt units into cities and bunkers
  if (weatherHurts(s, weatherAt(s, s.round + 1), u, x, y)) v -= AI.meteorExposed + (1 - u.hp / u.maxHp) * AI.meteorHurt;
  // wache Verdan-Geschuetze feuern zu Rundenbeginn; nur Kampfeinheiten nahe genug zum Angreifen lohnt es
  // awake Verdan guns fire at the start of the round; only worth it for fighters close enough to strike
  const guns = knownGuns(ctx).length ? gunDanger(ctx, x, y) : 0;
  if (guns) v -= guns * worth(u) * 0.35 * prof.caution * (UNITS[type].attack > 0 ? 0.6 : 1.4);
  // feindliche Stellungen: schwache oder angeschlagene Einheiten bleiben draussen, starke duerfen heran
  // hostile emplacements: weak or battered units stay out, strong ones may close in
  const emp = knownGuns(ctx).length ? emplacementDanger(ctx, x, y) : 0;
  if (emp) v -= emp * worth(u) * 0.3 * prof.caution * (UNITS[type].attack <= 1 || u.hp < u.maxHp * 0.5 ? 1.5 : 0);
  // naechste Runde bricht ein Vulkan daneben aus: wegbleiben / a volcano next to it erupts next round: stay away
  for (const p of area(size, x, y, 1)) {
    const vt = s.tiles[idx(size, p.x, p.y)];
    if (vt.volcano && (erupts(p.x, p.y, s.round + 1) || erupts(p.x, p.y, s.round))) { v -= 40; break; }
  }
  // Aufklaerung / exploration
  const vr = t.terrain === 'mountain' ? 2 : 1;
  let fresh = 0;
  for (const p of area(size, x, y, vr)) if (!ctx.fa.explored[idx(size, p.x, p.y)]) fresh++;
  v += fresh * (g.kind === 'explore' ? 4 : 1);
  // Angriffsgelegenheit / attack opportunity
  if (r && canAttackAfter(u, r)) v += Math.max(0, bestAttackFrom(ctx, u, x, y)) * 0.8;
  else if (!r && canAttackNow(u)) v += Math.max(0, bestAttackFrom(ctx, u, x, y)) * 0.8;
  // Fernkampf: in Reichweite fuer die naechste Runde / ranged: in range for next round
  // Railgun-Schuetze: kein Sturm, also stellt er sich hier fuer den naechsten Zug auf und schiesst nie nach einer Bewegung (canAttackAfter)
  // railgun marksman: no dash, so it sets up here for the next turn and never fires after moving (canAttackAfter)
  // Panzer (Reichweite 2) stellen sich ebenso auf / tanks (range 2) set up the same way
  if (type === 'artillery' || type === 'sniper' || type === 'railSniper' || type === 'battleship' || type === 'protoWalker' || type === 'tank' || type === 'teslaTank' || ALVENIA_UNITS.includes(type as AlveniaUnitId)) {
    const range = unitRange(type, ctx.fa.id);
    if (ctx.enemies.some((e) => dist(e, { x, y }) <= range)) v += dmg > 0 ? 3 : 10;
    if (ctx.hostileCities.some((c) => dist(c, { x, y }) <= range)) v += 4;
  }
  // Alvenia-Fernkaempfer ohne Sturm: Abstand halten, nicht neben Gegnern enden / Alvenia ranged units without dash: keep distance, do not end next to enemies
  if (ALVENIA_UNITS.includes(type as AlveniaUnitId) && UNITS[type].range >= 2 && layer === 0 && !onGoal) {
    if (ctx.enemies.some((e) => dist(e, { x, y }) === 1 && UNITS[e.type].attack > 0)) v -= AI.keepDistance;
  }
  // Sanitaeter: Bekehrung und Heilung in Reichweite / medic: conversion and healing in reach
  if (type === 'medic') {
    let bestConv = 0, heal = 0;
    for (const e of ctx.enemies) if (dist(e, { x, y }) === 1 && !isShip(e)) bestConv = Math.max(bestConv, worth(e));
    for (const o of ctx.my) if (o.id !== u.id && dist(o, { x, y }) === 1) heal += Math.min(4, o.maxHp - o.hp);
    v += bestConv * 0.9 + heal * 1.2;
  }
  // Hubschrauber: lieber nahe Tankstelle / helicopter: prefer near refuel
  if (u.fuel !== null && isRefuelSpot(s, f, x, y)) v += u.fuel <= 2 ? 30 : 2;
  return v;
}

/**
 * Strengere Rueckflugpruefung: Tankstelle in Reichweite, die nicht bedroht ist, oder zwei Tankstellen.
 * Stricter return check: a refuel source in range that is not threatened, or two sources.
 */
function heliSecure(ctx: Ctx, u: Unit, x: number, y: number): boolean {
  const { s, f } = ctx;
  if (isRefuelSpot(s, f, x, y)) return true;
  const range = ((u.fuel ?? 0) - 1) * UNITS[u.type].move + 1;
  let n = 0, secure = false;
  const check = (sx: number, sy: number) => {
    if (dist({ x, y }, { x: sx, y: sy }) > range) return;
    n++;
    if (!ctx.enemies.some((e) => dist(e, { x: sx, y: sy }) <= 2)) secure = true;
  };
  for (const c of ctx.myCities) check(c.x, c.y);
  for (let k = 0; k < ctx.n; k++) {
    const o = s.tiles[k].outpost;
    if (o && o.owner === f) check(k % s.size, (k / s.size) | 0);
  }
  return secure || n >= 2;
}

/** Naechste Einheitenhandlung (Bewegen/Heilen/Aussenposten/Sanitaeter) / next unit action */
export function planUnitMoves(ctx: Ctx, failed: Failed): Command | null {
  const { s } = ctx;
  const units = ctx.my.slice().sort((a, b) => {
    const ca = s.tiles[idx(s.size, a.x, a.y)].cityId !== null ? 0 : 1;
    const cb = s.tiles[idx(s.size, b.x, b.y)].cityId !== null ? 0 : 1;
    return ca - cb || a.id - b.id;
  });
  for (const u of units) {
    if (u.fresh || u.exhausted) continue;
    const g = ctx.goals.get(u.id);
    if (!g) continue;
    const lazy = lazyUnit(ctx, u) && !(u.fuel !== null && !heliSafe(s, u, u.x, u.y));
    if (lazy) continue;
    const fld = goalField(ctx, u, g);
    const layer = layerOf(u);
    const spy = u.type === 'spy';
    const stay = spy ? spyTile(ctx, u, fld, u.x, u.y) : evalTile(ctx, u, g, fld, u.x, u.y, layer);
    let bestCmd: Command | null = null;
    let bestV = stay;
    // Bewegung / movement
    let dests = reachable(s, u);
    // Endgegner an der Leine ums Hauptquartier / boss on a leash around the HQ
    if (isBoss(u)) { const home = bossHome(ctx, u); dests = dests.filter((r) => dist(r, home) <= SWARM_MOTHER.aiLeash); }
    // Hubschrauber mit wenig Sprit landet sicher, sobald eine Tankstelle erreichbar ist
    // a low-fuel helicopter lands as soon as a refuel spot is reachable
    if (g.kind === 'refuel') {
      const land = dests.filter((r) => isRefuelSpot(s, u.owner, r.x, r.y));
      if (land.length) dests = land;
    }
    for (const r of dests) {
      const nl = r.embark ? 1 : r.disembark ? 0 : layer;
      // Spion: Aufstand in feindlicher Stadt / spy: uprising in hostile city
      const v = spy ? spyTile(ctx, u, fld, r.x, r.y) : evalTile(ctx, u, g, fld, r.x, r.y, nl, r);
      const c: Command = { type: 'move', unit: u.id, to: { x: r.x, y: r.y } };
      if (v > bestV + 0.25 && ok(failed, c)) { bestV = v; bestCmd = c; }
    }
    // Heilen statt Bewegen / heal instead of moving
    // Hubschrauber mit wenig Sprit heilt nicht abseits der Tankstelle / low-fuel helicopter never heals away from refuel
    const heliLow = u.fuel !== null && u.fuel <= 2 && !isRefuelSpot(s, u.owner, u.x, u.y);
    if (canHeal(u) && !u.moved && stay > -1e5 && !heliLow && !alienHealBlocked(s, u)) {
      const amt = Math.min(healAmount(s, u), u.maxHp - u.hp);
      const hv = stay + (amt / u.maxHp) * worth(u) * 1.6 + (u.hp < u.maxHp / 2 ? 4 : 0);
      const c: Command = { type: 'heal', unit: u.id };
      if (hv > bestV + 0.5 && ok(failed, c)) { bestV = hv; bestCmd = c; }
    }
    // Roboter: Notreparatur aus einem Wrack heilt mehr / robots: emergency repair from a wreck heals more
    if (repairCheck(s, u) === 'ok' && stay > -1e5) {
      const amt = repairAmount(s, u);
      const rv = stay + (amt / u.maxHp) * worth(u) * 1.6 + (u.hp < u.maxHp / 2 ? 4 : 0);
      const c: Command = { type: 'repair', unit: u.id };
      if (rv > bestV + 0.5 && ok(failed, c)) { bestV = rv; bestCmd = c; }
    }
    // Sanitaeter heilt Nachbarn / medic heals neighbours
    if (has(u, 'heal') && canActStill(u)) {
      let heal = 0;
      for (const o of ctx.my) if (o.id !== u.id && dist(o, u) === 1) heal += Math.min(4, o.maxHp - o.hp);
      const c: Command = { type: 'medicHeal', unit: u.id };
      if (heal > 0 && stay + heal * 1.2 > bestV - 2 && ok(failed, c) && !bestCmdIsMoveTowardConvert(ctx, bestCmd)) return c;
    }
    // Panzersperre / tank barrier
    const bo = barrierOption(ctx, u);
    if (bo) {
      const c: Command = { type: 'barrier', unit: u.id, x: bo.x, y: bo.y };
      if (stay + bo.v > bestV && ok(failed, c)) { bestV = stay + bo.v; bestCmd = c; }
    }
    // Minenleger: Mine vor eigener Stadt / mine layer: mine in front of an own city
    const mo = mineOption(ctx, u);
    if (mo) {
      const c: Command = { type: 'mine', unit: u.id, x: mo.x, y: mo.y };
      if (stay + mo.v > bestV && ok(failed, c)) { bestV = stay + mo.v; bestCmd = c; }
    }
    // Festungsbau: Geschuetzstellung an bedrohter Stadt / fortification: gun emplacement at a threatened city
    const eo = emplacementOption(ctx, u);
    if (eo) {
      const c: Command = { type: 'emplacement', unit: u.id, x: eo.x, y: eo.y };
      if (stay + eo.v > bestV && ok(failed, c)) { bestV = stay + eo.v; bestCmd = c; }
    }
    // Terraformer: Feld umwandeln, bevorzugt Staedte und Ressourcen / terraformer: convert a tile, cities and resources first
    if (has(u, 'terraform')) {
      for (const p of terraformTargets(s, u)) {
        const t = s.tiles[p.y * s.size + p.x];
        const v = t.cityId !== null ? 40 : t.resource ? 10 : t.territory !== null ? 7 : 4;
        const c: Command = { type: 'terraform', x: p.x, y: p.y, unit: u.id };
        if (stay + v > bestV && ok(failed, c)) { bestV = stay + v; bestCmd = c; }
      }
    }
    // Aussenposten / outpost
    const oc = outpostOption(ctx, u);
    if (oc !== null) {
      const c: Command = { type: 'outpost', unit: u.id };
      if (stay + oc > bestV && ok(failed, c)) { bestV = stay + oc; bestCmd = c; }
    }
    if (bestCmd) return bestCmd;
  }
  // nach der Bewegung: Aussenposten und Sanitaeter / after moving: outposts and medics
  for (const u of units) {
    if (u.fresh || u.exhausted || !u.moved || u.attacked) continue;
    const bo = barrierOption(ctx, u);
    if (bo) {
      const c: Command = { type: 'barrier', unit: u.id, x: bo.x, y: bo.y };
      if (ok(failed, c)) return c;
    }
    const mo = mineOption(ctx, u);
    if (mo) {
      const c: Command = { type: 'mine', unit: u.id, x: mo.x, y: mo.y };
      if (ok(failed, c)) return c;
    }
    const eo = emplacementOption(ctx, u);
    if (eo) {
      const c: Command = { type: 'emplacement', unit: u.id, x: eo.x, y: eo.y };
      if (ok(failed, c)) return c;
    }
    const oc = outpostOption(ctx, u);
    if (oc !== null && oc > 8) {
      const c: Command = { type: 'outpost', unit: u.id };
      if (ok(failed, c)) return c;
    }
    if (has(u, 'heal') && canActStill(u)) {
      if (ctx.my.some((o) => o.id !== u.id && dist(o, u) === 1 && o.hp < o.maxHp)) {
        const c: Command = { type: 'medicHeal', unit: u.id };
        if (ok(failed, c)) return c;
      }
    }
  }
  return null;
}

function bestCmdIsMoveTowardConvert(ctx: Ctx, c: Command | null): boolean {
  if (!c || c.type !== 'move') return false;
  return ctx.enemies.some((e) => dist(e, c.to) === 1 && !isShip(e));
}

function spyTile(ctx: Ctx, u: Unit, fld: Float32Array, x: number, y: number): number {
  const { s, f } = ctx;
  const t = s.tiles[idx(s.size, x, y)];
  if (t.cityId !== null) {
    const c = cityById(s, t.cityId)!;
    if (c.owner !== null && c.owner !== f && ctx.s.factions[f].relations[c.owner] === 'war') return 1000 + c.level * 10;
  }
  const fd = fieldAt(ctx, fld, x, y, 0);
  return -(Number.isFinite(fd) ? fd : 400) * 3 - expectedDamage(ctx, u, x, y) * 0.5;
}

/**
 * Panzersperre auf einem Anmarschfeld zwischen feindlichem Fahrzeug und eigener Stadt.
 * Tank barrier on an approach tile between a hostile vehicle and an own city.
 */
function barrierOption(ctx: Ctx, u: Unit): { x: number; y: number; v: number } | null {
  const { s, prof } = ctx;
  if (!prof.outposts || !BARRIER.builders.includes(u.type)) return null;
  if (ctx.fa.stars < BARRIER.cost + 15) return null;
  const vehicles = ctx.enemies.filter((e) => BARRIER.vehicles.includes(e.type));
  if (!vehicles.length) return null;
  let best: { x: number; y: number; v: number } | null = null;
  for (const p of barrierTargets(s, u)) {
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const q = s.tiles[idx(s.size, Math.min(s.size - 1, Math.max(0, p.x + dx)), Math.min(s.size - 1, Math.max(0, p.y + dy)))];
      if (q.barrier && q.barrier.owner === ctx.f) { near = true; break; }
    }
    if (near) continue;
    for (const c of ctx.myCities) {
      if (dist(c, p) > 3) continue;
      for (const e of vehicles) {
        const de = dist(e, p);
        if (de <= 4 && de < dist(e, c)) {
          const v = 12 + worth(e) * 0.1 - de;
          if (!best || v > best.v) best = { x: p.x, y: p.y, v };
        }
      }
    }
  }
  return best;
}

/**
 * Mine auf ein Anmarschfeld nahe einer eigenen Stadt (defensiv): bevorzugt Felder zwischen Gegnern und Stadt und Strassen.
 * Mine on an approach tile near an own city (defensive): prefers tiles between enemies and the city, and roads.
 */
export function mineOption(ctx: Ctx, u: Unit): { x: number; y: number; v: number } | null {
  const { s, f } = ctx;
  if (!has(u, 'mines') || ctx.fa.stars < COUNTER.mine.cost + 10) return null;
  const ground = ctx.enemies.filter((e) => !has(e, 'fly') && !isShip(e) && UNITS[e.type].attack > 0);
  const ownMine = (x: number, y: number) => { const t = s.tiles[idx(s.size, x, y)]; return !!t.mine && t.mine.owner === f; };
  let best: { x: number; y: number; v: number } | null = null;
  for (const p of mineTargets(s, u)) {
    let city = ctx.myCities[0];
    let dc = Infinity;
    for (const c of ctx.myCities) { const d = dist(c, p); if (d < dc) { dc = d; city = c; } }
    if (!city || dc > 3) continue;
    // Abstand zwischen eigenen Minen / spacing between own mines
    if (area(s.size, p.x, p.y, 1).some((q) => ownMine(q.x, q.y))) continue;
    const t = s.tiles[idx(s.size, p.x, p.y)];
    let v = 3 + (t.road ? 3 : 0) + (dc === 1 ? 1 : 0);
    let threat = 0;
    for (const e of ground) {
      const de = dist(e, p);
      if (de <= 5 && de < dist(e, city)) threat = Math.max(threat, 8 + worth(e) * 0.05 - de);
    }
    v += threat;
    // ohne Bedrohung nur wenige Minen je Stadt / without a threat only a few mines per city
    if (!threat) {
      let near = 0;
      for (const q of area(s.size, city.x, city.y, 3)) if (ownMine(q.x, q.y)) near++;
      if (near >= 2 || ctx.fa.stars < COUNTER.mine.cost + 30) continue;
    }
    if (!best || v > best.v) best = { x: p.x, y: p.y, v };
  }
  return best;
}

/** Wert eines Aussenpostens hier oder null / value of an outpost here or null */
function outpostOption(ctx: Ctx, u: Unit): number | null {
  const { s, f, prof } = ctx;
  if (!prof.outposts || !INFANTRY_TYPES.includes(u.type)) return null;
  if (outpostCheck(s, u) !== 'ok') return null;
  if (ctx.fa.stars < ECON.outpostCost + 15) return null;
  const t = s.tiles[idx(s.size, u.x, u.y)];
  if (territoryOwner(s, t) === f) return null;
  let own = 0;
  for (let k = 0; k < ctx.n; k++) {
    const o = s.tiles[k].outpost;
    if (!o || o.owner !== f) continue;
    own++;
    if (dist({ x: k % s.size, y: (k / s.size) | 0 }, u) <= 3) return null;
  }
  if (own >= ctx.myCities.length) return null;
  if (ctx.myCities.some((c) => dist(c, u) <= 2)) return null;
  const nearHostile = ctx.hostileCities.some((c) => dist(c, u) <= 3) || ctx.enemies.some((e) => dist(e, u) <= 3);
  const helis = ctx.my.some((o) => o.fuel !== null);
  if (!nearHostile && !helis) return null;
  return (nearHostile ? 14 : 6) + (helis ? 6 : 0);
}
