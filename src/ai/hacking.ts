/**
 * KI fuer das Hacken der NEXUS (HACK): wertvollste sichtbare neutrale Orte fernuebernehmen (als Kauf in der Einkaufsliste),
 * Hacktuerme an der Front bauen (ebenso) und starke feindliche Fahrzeuge in Reichweite uebernehmen, bevor die Angriffe
 * geplant werden, damit die Einheit im selben Zug noch kaempft. Deterministisch, Gleichstand nach Feld bzw. ID.
 * AI for NEXUS hacking (HACK): remote takeover of the most valuable visible neutral places (as a purchase in the shopping
 * list), hack towers at the front (likewise) and taking over strong hostile vehicles within reach before the attacks are
 * planned, so the unit still fights in the same turn. Deterministic, ties broken by tile or id.
 */
import {
  cityHackCheck, cityHackRadius, cityHackTargets, cityHackedBy, cityTiles, dist, hackCheck, hackCost, hackTargets, hackTowerCheck, hackTowerLimit, hackTowersOf, hacksOn, hijackTargets, isMechanised, towerLink, towerWait, unitAt,
  type Command, type Unit,
} from '../core';
import { HACK, UNITS } from '../data/balance';
import { worth, type Ctx } from './analysis';

type Failed = Set<string>;
const key = (c: Command) => JSON.stringify(c);

/** Kaufvorschlag wie in economy.ts / purchase proposal as in economy.ts */
export interface HackBuy { cmd: Command; cost: number; value: number; save: boolean }

/**
 * Bester Hack eines neutralen Orts als Kauf: Grundwert, Stuetzpunkte mehr, Orte, die eine eigene Einheit gleich einnimmt,
 * weniger; weit weg von eigenen Staedten weniger (schwer zu halten).
 * Best hack of a neutral place as a purchase: base value, bases more, places an own unit is about to take less; far from
 * own cities less (hard to hold).
 */
export function hackPlaceBuy(ctx: Ctx): HackBuy | null {
  const { s, f } = ctx;
  if (!hacksOn(s, f)) return null;
  const A = HACK.ai;
  let best: HackBuy | null = null;
  for (const c of hackTargets(s, f)) {
    const chk = hackCheck(s, f, c);
    if (chk !== 'ok' && chk !== 'notEnoughStars') continue;
    let v = A.placeValue + (c.base ? A.baseBonus : 0);
    // eigene Einheit darauf oder daneben: sie nimmt ihn ohne Kosten ein / own unit on it or next to it: it takes it for free
    if (ctx.my.some((u) => dist(u, c) <= 1 && UNITS[u.type].attack > 0)) v *= 0.3;
    let dc = 20;
    for (const m of ctx.myCities) dc = Math.min(dc, dist(m, c));
    v -= Math.max(0, dc - 4) * 3;
    // feindliche Einheiten in der Naehe: schnell wieder verloren / hostile units nearby: quickly lost again
    if (ctx.enemies.some((e) => dist(e, c) <= 2 && UNITS[e.type].attack > 0)) v *= 0.6;
    if (v <= 0) continue;
    const cost = hackCost(s, f, c);
    if (!best || v / cost > best.value / best.cost || (v / cost === best.value / best.cost && c.id < (best.cmd as { city: number }).city)) {
      best = { cmd: { type: 'hack', city: c.id }, cost, value: v, save: true };
    }
  }
  return best;
}

/**
 * Stadt-Hack als Kauf: die feindliche Stadt nahe der eigenen Front (eigene Einheiten oder Staedte hoechstens cityRange
 * entfernt), deren Umgebung am wenigsten bekannt ist; nur mit Sternepolster.
 * City hack as a purchase: the hostile city near the own front (own units or cities at most cityRange away) whose
 * surroundings are least known; only with a star cushion.
 */
export function hackCityBuy(ctx: Ctx): HackBuy | null {
  const { s, f } = ctx;
  const A = HACK.ai;
  if (!hacksOn(s, f) || ctx.fa.stars < HACK.city.cost + A.reserve * 2) return null;
  let best: HackBuy | null = null;
  for (const c of cityHackTargets(s, f)) {
    if (cityHackedBy(s, c, f) || cityHackCheck(s, f, c) !== 'ok') continue;
    let near = 99;
    for (const m of ctx.myCities) near = Math.min(near, dist(m, c));
    for (const u of ctx.my) near = Math.min(near, dist(u, c));
    if (near > A.cityRange) continue;
    const r = cityHackRadius(c);
    let unknown = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (x >= 0 && y >= 0 && x < s.size && y < s.size && !ctx.fa.explored[y * s.size + x]) unknown++;
    }
    const v = A.cityValue + unknown * 1.5 + (c.isHQ ? 6 : 0) - near;
    if (!best || v > best.value) best = { cmd: { type: 'hackCity', city: c.id }, cost: HACK.city.cost, value: v, save: false };
  }
  return best;
}

/** Feindliche Einheiten in Uebernahme-Reichweite von p (mechanisiert, nach Wert) / hostile units within takeover reach of p */
function prey(ctx: Ctx, x: number, y: number): number {
  let v = 0;
  for (const e of ctx.enemies) if (dist(e, { x, y }) <= HACK.tower.reach + 1 && isMechanised(e.type)) v += worth(e) * 0.2;
  return v;
}

/**
 * Hackturm als Kauf: an der eigenen Stadt mit dem naechsten Feind (frontRange), Feld mit den meisten Zielen in Reichweite
 * und nicht neben der Stadt (Zugang frei). Erst ab minCities Staedten und mit reserve Sternen Polster.
 * Hack tower as a purchase: at the own city with the closest enemy (frontRange), the tile with most targets in reach and
 * not right next to the city (access stays free). Only from minCities cities and with a reserve star cushion.
 */
export function hackTowerBuy(ctx: Ctx): HackBuy | null {
  const { s, f } = ctx;
  const A = HACK.ai;
  if (!hacksOn(s, f) || ctx.myCities.length < A.minCities || hackTowersOf(s, f).length >= hackTowerLimit(s, f)) return null;
  if (ctx.fa.stars < HACK.tower.cost + A.reserve) return null;
  const towers = hackTowersOf(s, f);
  let best: HackBuy | null = null, bestScore = -Infinity;
  for (const c of ctx.myCities) {
    let front = 99;
    for (const e of ctx.enemies) if (UNITS[e.type].attack > 0) front = Math.min(front, dist(e, c));
    for (const h of ctx.hostileCities) front = Math.min(front, dist(h, c) + 1);
    if (front > A.frontRange) continue;
    // schon ein Turm an dieser Stadt / already a tower at this city
    if (towers.some((g) => dist(g, c) <= HACK.tower.reach)) continue;
    for (const p of cityTiles(s, c)) {
      if (dist(p, c) < 1 || unitAt(s, p.x, p.y)) continue;
      const chk = hackTowerCheck(s, f, p.x, p.y);
      if (chk !== 'ok') continue;
      const sc = prey(ctx, p.x, p.y) - front * 2 - dist(p, c) * 0.5 - (s.tiles[p.y * s.size + p.x].road ? 3 : 0);
      if (sc > bestScore) {
        bestScore = sc;
        best = { cmd: { type: 'hackTower', x: p.x, y: p.y }, cost: HACK.tower.cost, value: A.towerValue + Math.max(0, sc), save: true };
      }
    }
  }
  return best;
}

/**
 * Uebernahme planen: je bereitem Turm das wertvollste Ziel (Wert, LP-Anteil, Naehe zu eigenen Einheiten und Staedten,
 * damit es sofort kaempft); ab HACK.ai.minValue.
 * Plan a takeover: per ready tower the most valuable target (worth, HP share, closeness to own units and cities so it
 * fights at once); from HACK.ai.minValue.
 */
export function planHijack(ctx: Ctx, failed: Failed): Command | null {
  const { s, f } = ctx;
  if (!hacksOn(s, f)) return null;
  let best: Command | null = null, bv = HACK.ai.minValue - 1e-9;
  for (const g of hackTowersOf(s, f)) {
    if (towerLink(s, g.x, g.y) || (towerWait(s, g.x, g.y) ?? 1) > 0) continue;
    for (const u of hijackTargets(s, f, g.x, g.y)) {
      const cmd: Command = { type: 'hijack', x: g.x, y: g.y, target: u.id };
      if (failed.has(key(cmd))) continue;
      const v = hijackValue(ctx, u);
      if (v > bv || (v === bv && best && u.id < (best as { target: number }).target)) { bv = v; best = cmd; }
    }
  }
  return best;
}

/** Wert einer Uebernahme / value of a takeover */
function hijackValue(ctx: Ctx, u: Unit): number {
  let v = worth(u) * (0.5 + 0.5 * u.hp / Math.max(1, u.maxHp));
  // bedroht eigene Staedte oder Einheiten: doppelt lohnend / threatens own cities or units: doubly worthwhile
  if (ctx.myCities.some((c) => dist(c, u) <= 3)) v *= 1.4;
  // andere Feinde in Reichweite: die Einheit kann sofort zuschlagen / other enemies within reach: the unit can strike at once
  if (ctx.enemies.some((e) => e.id !== u.id && dist(e, u) <= Math.max(2, UNITS[u.type].range + 1))) v *= 1.2;
  return v;
}
