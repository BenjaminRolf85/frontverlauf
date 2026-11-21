/**
 * Schwebende Akademie (Velkar, ACADEMY): lesende Pruefungen fuer Abheben, Ziehen, Landen, Schild und Angriff.
 * Die Regeln selbst (Zustandsaenderung) stehen in rules.ts.
 * Floating academy (Velkar, ACADEMY): read-only checks for lift-off, moving, landing, shield and attack.
 * The rules themselves (state changes) live in rules.ts.
 */
import { ACADEMY, COMBAT, HIT, UNITS, type HitKind } from '../data/balance';
import { area, dist, inBounds, isLand, tileAt } from './grid';
import { burning } from './hazards';
import {
  academyBusy, academyOf, airborne, canAttackNow, hasTech, canHitAirborne, cityById, effectiveAttack, effectiveRange, firepowerFactor, hitOdds, isExplored,
  isHostile, memorialMult, moveFireFactor, shieldHp, submerged, territoryOwner, unitAt, unitLuckFactor, movedThisTurn, has,
} from './queries';
import type { City, ErrorCode, GameState, Pos, Unit } from './types';

/** Akademie c der Fraktion f am Zug? / academy c of faction f to move? */
function ownAcademy(s: GameState, f: number, c: City | undefined): ErrorCode | null {
  if (!c || c.owner !== f) return 'notYourCity';
  if (!c.academy) return 'notAcademy';
  return null;
}

/** Abheben: am Boden, nicht in der Runde einer Landung / lift-off: on the ground, not in the round of a landing */
export function liftCheck(s: GameState, f: number, c: City | undefined): 'ok' | ErrorCode {
  const e = ownAcademy(s, f, c);
  if (e) return e;
  if (c!.air) return 'airborne';
  if (c!.calm !== undefined && c!.calm > s.round) return 'academyBusy';
  return 'ok';
}

/**
 * Feld, auf das die schwebende Akademie ziehen darf: auf der Karte, keine Stadt, keine fremde Einheit, kein Geschuetz,
 * Wunder, Tempel oder Mutterschiff (fliegt ueber Wasser und Gelaende).
 * Tile the floating academy may move to: on the map, no city, no foreign unit, no gun, wonder, temple or mothership
 * (flies over water and terrain).
 */
export function hoverOk(s: GameState, c: City, p: Pos): boolean {
  if (!inBounds(s.size, p.x, p.y)) return false;
  const t = tileAt(s, p.x, p.y)!;
  if ((t.cityId !== null && t.cityId !== c.id) || t.turret || t.wonderOf || t.temple || t.feature === 'mothership') return false;
  const o = unitAt(s, p.x, p.y);
  return !o || o.owner === c.owner;
}

/** Ziehen der schwebenden Akademie nach p / moving the floating academy to p */
export function academyMoveCheck(s: GameState, f: number, c: City | undefined, p: Pos): 'ok' | ErrorCode {
  const e = ownAcademy(s, f, c);
  if (e) return e;
  if (!c!.air) return 'grounded';
  if (c!.air.phase === 'lifting') return 'lifting';
  const d = dist(c!, p);
  if (d === 0) return 'invalidTile';
  if (d > c!.air.steps) return c!.air.steps <= 0 ? 'noSteps' : 'outOfRange';
  if (!hoverOk(s, c!, p)) return 'invalidTile';
  return 'ok';
}

/** Felder, auf die die schwebende Akademie jetzt ziehen kann / tiles the floating academy can move to now */
export function academyMoves(s: GameState, c: City): Pos[] {
  if (!c.air || c.air.phase !== 'flying' || c.air.steps <= 0 || c.owner === null) return [];
  return area(s.size, c.x, c.y, c.air.steps).filter((p) => (p.x !== c.x || p.y !== c.y) && hoverOk(s, c, p));
}

/**
 * Landeplatz p fuer die Akademie c: flaches Land oder Wald ohne Gebaeude, Rohstoff, Merkmal, Strasse zum Hafen, Geschuetz und
 * fremde Einheit; nicht im fremden Gebiet; mindestens ACADEMY.landGap Felder von jedem anderen Ort.
 * Landing site p for academy c: flat land or forest without building, resource, feature, gun and foreign unit; not in
 * foreign territory; at least ACADEMY.landGap tiles from every other place.
 */
export function landingOk(s: GameState, c: City, p: Pos, forced = false): boolean {
  if (!inBounds(s.size, p.x, p.y)) return false;
  const t = tileAt(s, p.x, p.y)!;
  if (!isLand(t) || t.volcano || burning(s, t) || t.turret || t.wonderOf || t.temple || (t.cityId !== null && t.cityId !== c.id)) return false;
  const o = unitAt(s, p.x, p.y);
  if (o && o.owner !== c.owner) return false;
  // Notlandung: jedes freie Land genuegt / emergency landing: any free land will do
  if (forced) return !t.feature && !t.outpost && !t.building;
  if (t.terrain === 'mountain' || t.building || t.resource || t.feature || t.outpost || t.grandProject) return false;
  const owner = territoryOwner(s, t);
  if (owner !== null && owner !== c.owner) return false;
  return s.cities.every((o2) => o2.id === c.id || dist(o2, p) >= ACADEMY.landGap);
}

/** Landen auf dem jetzigen Feld / landing on the current tile */
export function landCheck(s: GameState, f: number, c: City | undefined): 'ok' | ErrorCode {
  const e = ownAcademy(s, f, c);
  if (e) return e;
  if (!c!.air) return 'grounded';
  if (c!.air.phase === 'lifting') return 'lifting';
  if (!landingOk(s, c!, c!)) return 'landingSite';
  return 'ok';
}

/** Schutzschild bauen / build the shield */
export function shieldCheck(s: GameState, f: number, c: City | undefined): 'ok' | ErrorCode {
  const e = ownAcademy(s, f, c);
  if (e) return e;
  if (c!.shield && c!.shield.hp > 0) return 'alreadyBuilt';
  if (academyBusy(s, c!)) return 'academyBusy';
  if (c!.shieldReady !== undefined && s.round < c!.shieldReady) return 'academyBusy';
  if (s.factions[f].stars < ACADEMY.shield.cost) return 'notEnoughStars';
  return 'ok';
}

/**
 * Angriff der Einheit u auf die Akademie c: feindlich, in Reichweite, sichtbar; schwebend nur Flieger, Flak und Panzer;
 * am Boden nur auf den Schild (ohne Schild wird sie eingenommen, nicht beschossen).
 * Attack of unit u on academy c: hostile, in range, visible; while floating only flyers, flak and tanks; on the ground only
 * on the shield (without a shield it is captured, not shot).
 */
export function academyAttackCheck(s: GameState, u: Unit, c: City | undefined): 'ok' | ErrorCode {
  if (!c || !c.academy || c.owner === null || c.owner === u.owner) return 'invalidTarget';
  if (!isHostile(s, u.owner, c.owner)) return 'peace';
  if (!isExplored(s, u.owner, c.x, c.y)) return 'notVisible';
  if (!canAttackNow(u) || submerged(s, u) || has(u, 'kamikaze') && !airborne(c) && shieldHp(c) <= 0) return 'cannotAttack';
  if (dist(u, c) > effectiveRange(s, u)) return 'outOfRange';
  if (airborne(c)) return canHitAirborne(u) ? 'ok' : 'airTarget';
  return shieldHp(c) > 0 ? 'ok' : 'invalidTarget';
}

/** Akademien, die u jetzt angreifen kann / academies u can attack now */
export function academyTargets(s: GameState, u: Unit): City[] {
  return s.cities.filter((c) => c.academy && academyAttackCheck(s, u, c) === 'ok');
}

/**
 * Schaden eines Angriffs auf den Schild (wie auf ein Geschuetz: Angriff gegen ACADEMY.shield.defense); ohne Schild in der
 * Luft zaehlt nur der Treffer (Notlandung). Kein Gegenschlag: die Akademie ist unbewaffnet.
 * Damage of an attack on the shield (like on a gun: attack against ACADEMY.shield.defense); without a shield in the air
 * only the hit counts (emergency landing). No return fire: the academy is unarmed.
 */
export function academyAttackPreview(s: GameState, u: Unit, c: City): { toShield: number; odds: Record<HitKind, number>; forced: boolean; moveFire: boolean } {
  const atk = effectiveAttack(s, u);
  const attackForce = atk * (u.hp / Math.max(1, u.maxHp));
  const sh = c.shield;
  const def = ACADEMY.shield.defense * (sh ? sh.hp / Math.max(1, sh.max) : 1);
  const total = attackForce + def;
  const toShield = total > 0 ? Math.max(1, Math.round((attackForce / total) * atk * COMBAT.damageFactor * moveFireFactor(s, u) * unitLuckFactor(s, u) * memorialMult(s, u) * firepowerFactor(s, u))) : 0;
  return { toShield, odds: hitOdds(s, u, dist(u, c) >= 2), forced: airborne(c) && shieldHp(c) <= 0, moveFire: movedThisTurn(u) && !has(u, 'kamikaze') };
}

/** Treffer bleibt ohne Wirkung? (Fehlschuss) / does the hit have no effect? (miss) */
export const academyMissed = (hit: HitKind): boolean => HIT.mult[hit] <= 0;

/**
 * Notlandeplatz: das eigene Feld, wenn es Land ist, sonst das naechste freie Land (Abstand, dann Feldindex).
 * Emergency landing site: the own tile if it is land, otherwise the nearest free land (distance, then tile index).
 */
export function forcedSpot(s: GameState, c: City): Pos | null {
  if (landingOk(s, c, c, true)) return { x: c.x, y: c.y };
  for (let r = 1; r < s.size; r++) {
    const ring = area(s.size, c.x, c.y, r).filter((p) => dist(p, c) === r && landingOk(s, c, p, true) && !unitAt(s, p.x, p.y));
    if (ring.length) return ring.sort((a, b) => (a.y * s.size + a.x) - (b.y * s.size + b.x))[0];
  }
  return null;
}

/** Steht die Einheit auf ihrer eigenen Akademie mit Schild? Dann faengt der Schild zuerst ab / does the unit stand on its own academy with a shield? Then the shield absorbs first */
export function shieldOver(s: GameState, u: Unit): City | null {
  const t = tileAt(s, u.x, u.y);
  if (!t || t.cityId === null) return null;
  const c = cityById(s, t.cityId);
  return c && c.academy && c.owner === u.owner && shieldHp(c) > 0 ? c : null;
}

// ---------- Beamer-Relay (ACADEMY.beamer) / beam relay (ACADEMY.beamer) ----------

/** Beamer-Relay auf dem Posten c bauen / build a beam relay on post c */
export function beamerCheck(s: GameState, f: number, c: City | undefined): 'ok' | ErrorCode {
  if (!c || c.owner !== f) return 'notYourCity';
  if (!c.post || !academyOf(s, f)) return 'invalidTarget';
  if (c.relay) return 'alreadyBuilt';
  if (s.factions[f].stars < ACADEMY.beamer.cost) return 'notEnoughStars';
  return 'ok';
}

/**
 * Einheit u zum Relay auf dem Posten c beamen: eigene Landeinheit auf oder neben der Akademie (auch schwebend), in diesem
 * Zug noch ohne Bewegung und Angriff; ein Beamvorgang je Relay und Runde.
 * Beam unit u to the relay on post c: own land unit on or next to the academy (floating too), without a move or attack
 * this turn; one beam per relay and round.
 */
export function beamCheck(s: GameState, u: Unit, c: City | undefined): 'ok' | ErrorCode {
  if (!c || c.owner !== u.owner || !c.post || !c.relay) return 'noBeamer';
  const ac = academyOf(s, u.owner);
  if (!ac) return 'noBeamer';
  if (UNITS[u.type].ship || u.carried || has(u, 'wonder') || has(u, 'boss')) return 'invalid';
  if (dist(u, ac) > 1) return 'notAtAcademy';
  if (u.fresh) return 'fresh';
  if (u.exhausted || u.moved || u.attacked) return 'unitExhausted';
  if (c.beamed === s.round) return 'beamUsed';
  return 'ok';
}

/** Relays, zu denen u jetzt gebeamt werden kann / relays u can be beamed to now */
export function beamTargets(s: GameState, u: Unit): City[] {
  return s.cities.filter((c) => c.relay && c.owner === u.owner && beamCheck(s, u, c) === 'ok');
}

/** Darf eine Einheit u auf p erscheinen? (frei, Land ausser fuer Flieger, keine fremde Stadt, kein Hindernis) / may unit u appear on p? */
function standOk(s: GameState, u: Unit, p: Pos): boolean {
  const t = tileAt(s, p.x, p.y);
  if (!t || unitAt(s, p.x, p.y) || t.wonderOf || t.turret || t.temple || t.feature === 'mothership' || t.volcano || burning(s, t)) return false;
  if (!isLand(t) && !has(u, 'fly')) return false;
  if (t.terrain === 'mountain' && !has(u, 'fly') && !has(u, 'walker') && !hasTech(s, u.owner, 'mountainTraining')) return false;
  if (t.cityId !== null) { const c = cityById(s, t.cityId); if (c && c.owner !== u.owner) return false; }
  return true;
}

/**
 * Ankunftsfeld bei (x, y): das Feld selbst, sonst ein freies Nachbarfeld (eigenes Gebiet zuerst, dann Feldindex).
 * Arrival tile at (x, y): the tile itself, otherwise a free adjacent tile (own territory first, then tile index).
 */
export function arrivalSpot(s: GameState, u: Unit, x: number, y: number): Pos | null {
  if (standOk(s, u, { x, y })) return { x, y };
  let best: Pos | null = null, bs = -Infinity;
  for (const p of area(s.size, x, y, 1)) {
    if ((p.x === x && p.y === y) || !standOk(s, u, p)) continue;
    const sc = (territoryOwner(s, tileAt(s, p.x, p.y)!) === u.owner ? 1 : 0) - (p.y * s.size + p.x) * 1e-6;
    if (sc > bs) { bs = sc; best = p; }
  }
  return best;
}

/** Naechstes freies Feld um (x, y) in wachsenden Ringen (Notfall der Rueckkehr) / nearest free tile around (x, y) in growing rings (emergency return) */
export function nearestStand(s: GameState, u: Unit, x: number, y: number): Pos | null {
  for (let r = 0; r < s.size; r++) {
    const ring = area(s.size, x, y, r).filter((p) => dist(p, { x, y }) === r && standOk(s, u, p));
    if (ring.length) return ring.sort((a, b) => (a.y * s.size + a.x) - (b.y * s.size + b.x))[0];
  }
  return null;
}
