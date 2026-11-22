/**
 * Schwebende Akademie (Velkar, ACADEMY): lesende Pruefungen fuer Abheben, Ziehen, Landen, Schild und Angriff.
 * Die Regeln selbst (Zustandsaenderung) stehen in rules.ts.
 * Floating academy (Velkar, ACADEMY): read-only checks for lift-off, moving, landing, shield and attack.
 * The rules themselves (state changes) live in rules.ts.
 */
import { ACADEMY, COMBAT, HIT, UNITS, type AcademyModule, type HitKind } from '../data/balance';
import { area, dist, inBounds, isLand, tileAt } from './grid';
import { burning } from './hazards';
import {
  academyBusy, academyOf, airborne, canAttackNow, hasTech, canHitAirborne, cityById, effectiveAttack, effectiveRange, firepowerFactor, hitOdds, isExplored,
  isHostile, memorialMult, moveFireFactor, shieldHp, submerged, territoryOwner, unitAt, unitLuckFactor, has, movesFireFree, strikeDamage,
  beamFired, beamShots, canSeeUnit, entrenchFactor, entrenchMiss, hitChanceOn, hitDamage, hullHp, interceptsLeft, moduleLevel, moduleMax, raceOdds, unitById, withEntrench,
} from './queries';
import type { City, ErrorCode, GameState, Pos, Unit } from './types';
import type { ResourceId, TerrainId } from '../data/balance';

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
  if (c!.air.phase === 'terraform') return 'terraforming';
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
 * Neutraler Ort o, den die Akademie c beim Terraformen einebnen darf (Spielerwunsch: "fuer die Wissenschaft ist alles
 * rational ok"): Siedlung, Stuetzpunkt oder Sendeturm ohne Besitzer, kein (ehemaliges) Hauptquartier.
 * Neutral place o the academy c may level when terraforming (player request: "for science everything is rationally
 * fine"): settlement, base or transmitter tower without an owner, no (former) headquarters.
 */
export function razable(c: City, o: City): boolean {
  return o.id !== c.id && o.owner === null && !o.isHQ && o.hqOf === null && !o.academy && !o.post;
}

/**
 * Landeplatz p fuer die Akademie c (mit Terraformen, ACADEMY.terraform): Land oder Flachwasser, kein tiefes Meer, kein
 * Vulkan, kein Brand; Berg, Wald und Wasser werden zu Ebene. Nicht im fremden Gebiet, keine fremde Einheit, kein Geschuetz,
 * Wunder, Tempel, Mutterschiff, Aussenposten, Grossprojekt, keine fremde Sperre, kein eigenes Gebaeude (ausser Strasse).
 * Neutrale Orte, neutrale Gebaeude, Rohstoffe und Merkmale werden eingeebnet. Abstand ACADEMY.landGap nur zu Orten mit
 * Besitzer (neutrale sperren nicht mehr). forced = Notlandung: jedes freie Land ohne Merkmal, Aussenposten und Gebaeude
 * (ohne Terraformen, unveraendert).
 * Landing site p for academy c (with terraforming, ACADEMY.terraform): land or shallow water, no deep ocean, no volcano,
 * no fire; mountain, forest and water become plain. Not in foreign territory, no foreign unit, no gun, wonder, temple,
 * mothership, outpost, grand project, no foreign barrier, no own building (except a road). Neutral places, neutral
 * buildings, resources and features are levelled. Distance ACADEMY.landGap only to places with an owner (neutral ones no
 * longer block). forced = emergency landing: any free land without feature, outpost and building (no terraforming,
 * unchanged).
 */
export function landingOk(s: GameState, c: City, p: Pos, forced = false): boolean {
  if (!inBounds(s.size, p.x, p.y)) return false;
  const t = tileAt(s, p.x, p.y)!;
  if (t.volcano || burning(s, t) || t.turret || t.wonderOf || t.temple || t.feature === 'mothership') return false;
  const o = unitAt(s, p.x, p.y);
  if (o && o.owner !== c.owner) return false;
  // Notlandung: jedes freie Land genuegt / emergency landing: any free land will do
  if (forced) return isLand(t) && (t.cityId === null || t.cityId === c.id) && !t.feature && !t.outpost && !t.building;
  if (t.terrain === 'ocean' || t.outpost || t.grandProject) return false;
  if (t.cityId !== null && t.cityId !== c.id) {
    const v = cityById(s, t.cityId);
    if (!v || !razable(c, v)) return false;
  }
  if (t.barrier && t.barrier.owner !== c.owner) return false;
  if (t.memorial && t.memorial.until >= s.round) return false;
  const owner = territoryOwner(s, t);
  if (owner !== null && owner !== c.owner) return false;
  // eigene Gebaeude bleiben stehen (nie eingeebnet); neutrale werden eingeebnet / own buildings stay (never levelled); neutral ones are levelled
  if (t.building && t.building !== 'road' && owner !== null) return false;
  return s.cities.every((o2) => o2.id === c.id || o2.owner === null || dist(o2, p) >= ACADEMY.landGap);
}

/**
 * Was das Terraformen auf p veraendert (Vorschau fuer Oberflaeche und KI): Gelaende vorher, ob es umgeformt wird,
 * eingeebneter neutraler Ort, aufgenommener Rohstoff, eingeebnetes Gebaeude oder Merkmal.
 * What terraforming changes on p (preview for the UI and the AI): terrain before, whether it is reshaped, levelled neutral
 * place, absorbed resource, levelled building or feature.
 */
export function terraformPlan(s: GameState, c: City, p: Pos): { terrain: TerrainId; reshape: boolean; razed: City | null; resource: ResourceId | null; cleared: string | null } {
  const t = tileAt(s, p.x, p.y)!;
  const v = t.cityId !== null && t.cityId !== c.id ? cityById(s, t.cityId) ?? null : null;
  const cleared = t.building && t.building !== 'road' ? t.building : t.feature;
  return { terrain: t.terrain, reshape: t.terrain !== 'plain' || (!!t.biome && t.biome !== 'grassland'), razed: v, resource: t.resource, cleared: cleared ?? null };
}

/** Art eines eingeebneten Orts (Meldung) / kind of a levelled place (toast) */
export const razedKind = (v: City): 'village' | 'base' | 'tower' => (v.tower ? 'tower' : v.base ? 'base' : 'village');

/** Landeziel: das eigene Feld oder ein benachbarter neutraler Ort (wird eingeebnet) / landing target: the own tile or an adjacent neutral place (levelled) */
export function landTarget(s: GameState, c: City, at?: Pos): Pos {
  return at ?? (c.air?.phase === 'terraform' && c.air.at ? c.air.at : { x: c.x, y: c.y });
}

/**
 * Terraformen und landen auf dem jetzigen Feld oder (at) einem benachbarten neutralen Ort, den die Akademie nicht
 * ueberfliegen kann (Ort auf dem Feld).
 * Terraform and land on the current tile or (at) an adjacent neutral place the academy cannot hover over (a place on the
 * tile).
 */
export function landCheck(s: GameState, f: number, c: City | undefined, at?: Pos): 'ok' | ErrorCode {
  const e = ownAcademy(s, f, c);
  if (e) return e;
  if (!c!.air) return 'grounded';
  if (c!.air.phase === 'lifting') return 'lifting';
  if (c!.air.phase === 'terraform') return 'terraforming';
  if (at && (at.x !== c!.x || at.y !== c!.y)) {
    if (!inBounds(s.size, at.x, at.y) || dist(c!, at) > 1) return 'outOfRange';
    const id = tileAt(s, at.x, at.y)!.cityId;
    if (id === null) return 'invalidTile';
  }
  if (!landingOk(s, c!, at ?? c!)) return 'landingSite';
  return 'ok';
}

/** Terraformen abbrechen / cancel terraforming */
export function cancelTerraformCheck(s: GameState, f: number, c: City | undefined): 'ok' | ErrorCode {
  const e = ownAcademy(s, f, c);
  if (e) return e;
  if (c!.air?.phase !== 'terraform') return 'notTerraforming';
  return 'ok';
}

/**
 * Landeziele der schwebenden Akademie in diesem Zug: Felder, die sie erreichen und dort terraformen kann (dazu das eigene
 * Feld und benachbarte neutrale Orte); reshape = das Feld wird umgeformt, razed = ein neutraler Ort wird eingeebnet.
 * Landing targets of the floating academy this turn: tiles it can reach and terraform there (plus the own tile and
 * adjacent neutral places); reshape = the tile is reshaped, razed = a neutral place is levelled.
 */
export function landingTargets(s: GameState, c: City): { x: number; y: number; reshape: boolean; razed: boolean }[] {
  if (!c.air || c.air.phase !== 'flying' || c.owner === null) return [];
  const out: { x: number; y: number; reshape: boolean; razed: boolean }[] = [];
  const seen = new Set<number>();
  const push = (p: Pos) => {
    const k = p.y * s.size + p.x;
    if (seen.has(k) || !landingOk(s, c, p)) return;
    seen.add(k);
    const plan = terraformPlan(s, c, p);
    out.push({ x: p.x, y: p.y, reshape: plan.reshape, razed: !!plan.razed });
  };
  push(c);
  for (const p of academyMoves(s, c)) push(p);
  for (const p of area(s.size, c.x, c.y, 1)) if (tileAt(s, p.x, p.y)!.cityId !== null) push(p);
  return out;
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
 * am Boden nur auf Schild oder Rumpf (ohne beides wird sie eingenommen, nicht beschossen).
 * Attack of unit u on academy c: hostile, in range, visible; while floating only flyers, flak and tanks; on the ground only
 * on the shield or the hull (without both it is captured, not shot).
 */
export function academyAttackCheck(s: GameState, u: Unit, c: City | undefined): 'ok' | ErrorCode {
  if (!c || !c.academy || c.owner === null || c.owner === u.owner) return 'invalidTarget';
  if (!isHostile(s, u.owner, c.owner)) return 'peace';
  if (!isExplored(s, u.owner, c.x, c.y)) return 'notVisible';
  if (!canAttackNow(u) || submerged(s, u) || has(u, 'kamikaze') && !airborne(c) && shieldHp(c) <= 0 && hullHp(c) <= 0) return 'cannotAttack';
  if (dist(u, c) > effectiveRange(s, u)) return 'outOfRange';
  if (airborne(c)) return canHitAirborne(u) ? 'ok' : 'airTarget';
  return shieldHp(c) > 0 || hullHp(c) > 0 ? 'ok' : 'invalidTarget';
}

/** Akademien, die u jetzt angreifen kann / academies u can attack now */
export function academyTargets(s: GameState, u: Unit): City[] {
  return s.cities.filter((c) => c.academy && academyAttackCheck(s, u, c) === 'ok');
}

/**
 * Schaden eines Angriffs auf die Akademie: zuerst auf den Schild (Angriff gegen ACADEMY.shield.defense), ohne Schild auf
 * den Rumpf (ACADEMY.modules.armour.defense); ohne beides in der Luft zaehlt nur der Treffer (Notlandung). intercept =
 * die Abwehrraketen fangen den Angriff ab (Flieger). Kein Gegenschlag: die Akademie schiesst nur mit
 * dem Neutronenstrahl im eigenen Zug.
 * Damage of an attack on the academy: first on the shield (attack against ACADEMY.shield.defense), without a shield on the
 * hull (ACADEMY.modules.armour.defense); without both in the air only the hit counts (emergency landing). intercept = the
 * defence missiles intercept the attack (flyer). No return fire: the academy only fires its neutron beam in
 * its own turn.
 */
export function academyAttackPreview(s: GameState, u: Unit, c: City): { toShield: number; odds: Record<HitKind, number>; forced: boolean; moveFire: boolean; layer: 'shield' | 'hull' | 'none'; intercept: boolean } {
  const atk = effectiveAttack(s, u);
  const attackForce = atk * (u.hp / Math.max(1, u.maxHp));
  const layer = shieldHp(c) > 0 ? 'shield' : hullHp(c) > 0 ? 'hull' : 'none';
  const sh = layer === 'hull' ? c.hull : c.shield;
  const base = layer === 'hull' ? ACADEMY.modules.armour.defense : ACADEMY.shield.defense;
  const def = base * (sh ? sh.hp / Math.max(1, sh.max) : 1);
  const total = attackForce + def;
  // Berserker: feste Schlagkraft (UNITS.strike.other) / berserker: fixed striking power (UNITS.strike.other)
  const fixed = strikeDamage(u.type, null);
  const toShield = fixed !== null ? fixed : total > 0 ? Math.max(1, Math.round((attackForce / total) * atk * COMBAT.damageFactor * moveFireFactor(s, u) * unitLuckFactor(s, u) * memorialMult(s, u) * firepowerFactor(s, u))) : 0;
  return { toShield, odds: hitOdds(s, u, dist(u, c) >= 2), forced: airborne(c) && layer === 'none', moveFire: !movesFireFree(u), layer,
    intercept: c.owner !== null && !!interceptor(s, u, c, c.owner) };
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

// ---------- Ausbau und Neutronenstrahl (ACADEMY.modules, ACADEMY.beam) / upgrades and neutron beam ----------

/** Preis der naechsten Stufe eines Moduls (Infinity = hoechste Stufe) / price of the next level of a module (Infinity = top level) */
export const moduleCost = (c: City, m: AcademyModule): number => ACADEMY.modules[m].costs[moduleLevel(c, m)] ?? Infinity;

/** Modul m der Akademie c um eine Stufe ausbauen / upgrade module m of academy c by one level */
export function moduleCheck(s: GameState, f: number, c: City | undefined, m: AcademyModule): 'ok' | ErrorCode {
  const e = ownAcademy(s, f, c);
  if (e) return e;
  if (!(m in ACADEMY.modules)) return 'invalid';
  if (moduleLevel(c, m) >= moduleMax(m)) return 'moduleMax';
  if (c!.moduleRound?.[m] === s.round) return 'alreadyBought';
  if (s.factions[f].stars < moduleCost(c!, m)) return 'notEnoughStars';
  return 'ok';
}

/**
 * Abwehrraketen: Akademie der Fraktion owner, die den Angriff von att auf das Feld p abfaengt (Flieger, auch Drohnen und
 * Lenkflugkoerper, oder Raketen der Mechs; p ist die Akademie oder ein Nachbarfeld; noch ein Abfang uebrig), sonst null.
 * Bodenbeschuss (Panzer, Artillerie) nicht (gemessen: mit Fernangriffen aus 2 Feldern war die Festung zu stark).
 * Defence missiles: the academy of faction owner that intercepts att's attack on tile p (flyers, drones and guided
 * missiles too, or mech rockets; p is the academy or an adjacent tile; an interception left), otherwise null. Ground fire
 * (tanks, artillery) not (measured: with ranged attacks from 2 tiles the fortress was too strong).
 */
export function interceptor(s: GameState, att: Unit, p: Pos, owner: number, rocket = false): City | null {
  if (!has(att, 'fly') && !rocket) return null;
  const ac = academyOf(s, owner);
  if (!ac || interceptsLeft(ac) <= 0 || dist(ac, p) > 1 || !isHostile(s, att.owner, owner)) return null;
  return ac;
}

/** Abwehrraketen gegen eine Silo-Rakete der Fraktion f auf tiles (erste Akademie nach ID) / defence missiles against a silo rocket of f on tiles (first academy by id) */
export function siloInterceptor(s: GameState, f: number, tiles: Pos[]): City | null {
  for (const c of [...s.cities].sort((a, b) => a.id - b.id)) {
    if (!c.academy || c.owner === null || c.owner === f || !isHostile(s, f, c.owner) || interceptsLeft(c) <= 0) continue;
    if (tiles.some((p) => dist(p, c) <= 1)) return c;
  }
  return null;
}

/**
 * Ziel des Neutronenstrahls der Fraktion f auf (x, y): sichtbare feindliche Einheit (Wunder ueber ihre Grundflaeche, kein
 * getauchter Mech) oder sichtbares feindliches Bauwerk (Geschuetz, Silo, Hackturm). Verdeckte Einheiten zaehlen nicht
 * (kein Hinweis auf sie). Keine Staedte.
 * Target of faction f's neutron beam on (x, y): visible hostile unit (wonders via their footprint, no submerged mech) or
 * visible hostile structure (gun, silo, hack tower). Hidden units do not count (no hint at them). No cities.
 */
export function rayTargetAt(s: GameState, f: number, x: number, y: number): { unit?: Unit; gun?: Pos } | ErrorCode {
  const t = tileAt(s, x, y);
  if (!t) return 'invalidTile';
  const u = unitAt(s, x, y) ?? (t.wonderOf ? unitById(s, t.wonderOf) : undefined);
  if (u && canSeeUnit(s, f, u)) {
    if (u.owner === f) return 'invalidTarget';
    if (!isHostile(s, f, u.owner)) return 'peace';
    if (submerged(s, u)) return 'invalidTarget';
    return { unit: u };
  }
  const g = t.turret;
  if (g && g.hp > 0 && g.owner !== undefined && g.owner !== f && isExplored(s, f, x, y)) {
    if (!isHostile(s, f, g.owner)) return 'peace';
    return { gun: { x, y } };
  }
  return isExplored(s, f, x, y) ? 'rayNoTarget' : 'notVisible';
}

/** Strahl bereit (ohne Ziel)? / beam ready (without a target)? */
export function rayReadyCheck(s: GameState, f: number, c: City | undefined): 'ok' | ErrorCode {
  const e = ownAcademy(s, f, c);
  if (e) return e;
  if (c!.air?.phase === 'lifting') return 'lifting';
  // im Zug des Schusses: verbraucht; danach: Ruhe / in the turn of the shot: used; afterwards: rest
  if (beamFired(s, c!) >= beamShots(c!)) return 'rayUsed';
  if (c!.rayReady !== undefined && s.round < c!.rayReady) return 'rayCooldown';
  return 'ok';
}

/** Neutronenstrahl der Akademie c auf (x, y) / neutron beam of academy c at (x, y) */
export function rayCheck(s: GameState, f: number, c: City | undefined, x: number, y: number): 'ok' | ErrorCode {
  const r = rayReadyCheck(s, f, c);
  if (r !== 'ok') return r;
  if (!inBounds(s.size, x, y)) return 'invalidTile';
  if (dist(c!, { x, y }) > ACADEMY.beam.range) return 'outOfRange';
  const tg = rayTargetAt(s, f, x, y);
  return typeof tg === 'string' ? tg : 'ok';
}

/** Felder mit Zielen des Strahls in Reichweite (nur wenn er bereit ist) / tiles with beam targets in range (only when ready) */
export function rayTargets(s: GameState, c: City): Pos[] {
  if (c.owner === null || rayReadyCheck(s, c.owner, c) !== 'ok') return [];
  return area(s.size, c.x, c.y, ACADEMY.beam.range).filter((p) => typeof rayTargetAt(s, c.owner!, p.x, p.y) !== 'string');
}

/** Felder in Reichweite des Strahls (Anzeige) / tiles within the beam's range (display) */
export const rayReach = (s: GameState, c: City): Pos[] => area(s.size, c.x, c.y, ACADEMY.beam.range).filter((p) => p.x !== c.x || p.y !== c.y);

/**
 * Trefferchancen des Strahls: Rasse ACADEMY.beam.race mit Wetter (ohne Wind), kritische Treffer werden zu vollen, ein
 * verschanztes Ziel verschiebt wie sonst zu Fehlschuessen. Ohne Trefferglueck immer voll.
 * Hit odds of the beam: race ACADEMY.beam.race with weather (without wind), critical hits become full, an entrenched target
 * shifts to misses as usual. Without hit luck always full.
 */
export function rayOdds(s: GameState, target?: Unit): Record<HitKind, number> {
  if (!hitChanceOn(s)) return { miss: 0, graze: 0, partial: 0, full: 1, crit: 0 };
  const o = raceOdds(s, ACADEMY.beam.race, 1, false);
  const folded = { ...o, full: o.full + o.crit, crit: 0 };
  return target ? withEntrench(folded, entrenchMiss(s, target)) : folded;
}

/** Schaden des Strahls je Trefferart, hoechstens ACADEMY.beam.damage / beam damage per hit kind, at most ACADEMY.beam.damage */
export function rayDamage(s: GameState, hit: HitKind, target?: Unit): number {
  const D = ACADEMY.beam.damage;
  if (hitChanceOn(s)) return Math.min(D, hitDamage(D, hit));
  // ohne Trefferglueck: verschanztes Ziel ueber den Erwartungswert (wie der Rueckzug) / without hit luck: entrenched target via the expected value (like the retreat)
  const trench = target ? entrenchFactor(s, HIT.odds[ACADEMY.beam.race], target, true) : 1;
  return Math.min(D, Math.round(D * trench));
}

/** Vorschau: voller Schaden, Trefferchancen, ob ein voller Treffer vernichtet / preview: full damage, odds, whether a full hit destroys */
export function rayPreview(s: GameState, f: number, c: City, x: number, y: number): { dmg: number; odds: Record<HitKind, number>; kill: boolean; hp: number; check: 'ok' | ErrorCode; unit?: Unit; gun?: Pos } {
  const check = rayCheck(s, f, c, x, y);
  const tg = rayTargetAt(s, f, x, y);
  const unit = typeof tg === 'string' ? undefined : tg.unit;
  const gun = typeof tg === 'string' ? undefined : tg.gun;
  const dmg = rayDamage(s, 'full', unit);
  const hp = unit ? unit.hp : gun ? tileAt(s, gun.x, gun.y)!.turret!.hp : 0;
  return { dmg, odds: rayOdds(s, unit), kill: hp > 0 && dmg >= hp, hp, check, ...(unit ? { unit } : {}), ...(gun ? { gun } : {}) };
}
