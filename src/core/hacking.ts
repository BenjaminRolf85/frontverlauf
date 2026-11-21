/**
 * Hacken der NEXUS (HACK in balance.ts): Fernuebernahme neutraler Orte und der Hackturm, der feindliche mechanisierte
 * Einheiten fuer zwei Zuege uebernimmt. Reine Abfragen und die Anwendung; rules.ts reicht seine internen Helfer (Tod,
 * Aufdecken, Einnahme) als HackKit herein, wie beim Orbitallaser und der Schattenflotte. Deterministisch, ohne Zufall.
 * Nur in freien Partien (nicht in der Kampagne), damit die Einsaetze unveraendert bleiben.
 * NEXUS hacking (HACK in balance.ts): remote takeover of neutral places and the hack tower, which takes over hostile
 * mechanised units for two turns. Pure queries and their application; rules.ts passes its internal helpers (death,
 * reveal, capture) in as a HackKit, as for the orbital laser and the shadow fleet. Deterministic, without randomness.
 * Only in free games (not in the campaign), so the missions stay unchanged.
 */
import { HACK, UNITS, type UnitTypeId } from '../data/balance';
import { dist, inBounds, tileAt } from './grid';
import { trainHome } from './queries';
import { burning } from './hazards';
import {
  canSeeUnit, cityById, computeStats, has, isBoss, isExplored, isHostile, isWonder, ownCities, sightedBy, territoryOwner, turretList, unitAt, unitById,
  unitClass,
} from './queries';
import type { City, ErrorCode, GameEvent, GameState, Pos, Tile, Unit } from './types';

/** Interne Helfer aus rules.ts / internal helpers from rules.ts */
export interface HackKit {
  /** Einheit entfernen (ohne Ueberreste) / remove a unit (without remains) */
  kill(u: Unit, ev: GameEvent[]): void;
  /** Einheit zerstoeren mit Wrack, ohne Abschuss / destroy a unit with a wreck, without a kill */
  wreck(u: Unit, ev: GameEvent[]): void;
  /** Zufallszahl aus dem Zufallsstrom des Spiels / random number from the game's random stream */
  roll(): number;
  /** Felder fuer f aufdecken / reveal tiles for f */
  reveal(f: number, x: number, y: number, r: number, ev: GameEvent[]): void;
  /** Ort fuer f einnehmen wie mit einer Einheit / capture the place for f as with a unit */
  capture(f: number, c: City, ev: GameEvent[]): void;
}

/** Hackt diese Fraktion (NEXUS, freie Partie)? / does this faction hack (NEXUS, free game)? */
export const hacksOn = (s: GameState, f: number): boolean => !!s.factions[f] && HACK.factions.includes(s.factions[f].id) && !s.config.campaign;

// ---------- Fernuebernahme neutraler Orte / remote takeover of neutral places ----------

/** Hacks der letzten HACK.place.recharge Runden (Runden) / hacks of the last HACK.place.recharge rounds (rounds) */
export function recentHacks(s: GameState, f: number): number[] {
  return (s.factions[f]?.hacks ?? []).filter((r) => r > s.round - HACK.place.recharge);
}

/** Rechenzentren im eigenen Gebiet = Ladungen / data centres in own territory = charges */
export const hackCapacity = (s: GameState, f: number): number => computeStats(s, f).dataCenters;

/** Verfuegbare Ladungen: Rechenzentren minus Hacks im Ladefenster / available charges: data centres minus hacks in the recharge window */
export const hackCharges = (s: GameState, f: number): number => Math.max(0, hackCapacity(s, f) - recentHacks(s, f).length);

/**
 * Runden bis zur naechsten Ladung (0 = eine bereit; null = kein Rechenzentrum oder alle Ladungen belegt ohne Ende).
 * Rounds until the next charge (0 = one ready; null = no data centre).
 */
export function hackRechargeIn(s: GameState, f: number): number | null {
  const cap = hackCapacity(s, f);
  if (cap <= 0) return null;
  const recent = recentHacks(s, f).sort((a, b) => a - b);
  if (recent.length < cap) return 0;
  // die aelteste noetige Ladung wird frei / the oldest needed charge frees up
  const k = recent.length - cap;
  return recent[k] + HACK.place.recharge - s.round;
}

/** Preis eines Hacks auf c: Grundpreis, Stufe, bereits gehackte Orte / price of a hack on c: base, level, places already hacked */
export function hackCost(s: GameState, f: number, c: City): number {
  const P = HACK.place;
  return P.cost + P.perLevel * Math.max(0, c.level - 1) + P.perHacked * (s.factions[f]?.hacks?.length ?? 0);
}

/** Ist der Ort fuer f sichtbar (aufgedeckt oder in einer Sichtung)? / is the place visible to f (explored or in a sighting)? */
export const placeVisible = (s: GameState, f: number, c: Pos): boolean => isExplored(s, f, c.x, c.y) || sightedBy(s, f, c);

export type HackCheck = 'ok' | Extract<ErrorCode,
  'gameOver' | 'wrongFaction' | 'invalidTarget' | 'notVisible' | 'occupied' | 'hackEarly' | 'hackTurn' | 'hackCharges' | 'notEnoughStars'>;

/**
 * Darf f den Ort c hacken? Reihenfolge: Fraktion, neutral, sichtbar, fremde Einheit darauf, Runde, schon in diesem Zug,
 * Ladung, Sterne.
 * May f hack the place c? Order: faction, neutral, visible, foreign unit on it, round, already this turn, charge, stars.
 */
export function hackCheck(s: GameState, f: number, c: City): HackCheck {
  if (s.over) return 'gameOver';
  if (!hacksOn(s, f)) return 'wrongFaction';
  if (c.owner !== null) return 'invalidTarget';
  if (!placeVisible(s, f, c)) return 'notVisible';
  const occ = unitAt(s, c.x, c.y);
  if (occ && occ.owner !== f) return 'occupied';
  if (s.round < HACK.place.firstRound) return 'hackEarly';
  if ((s.factions[f].hacks ?? []).filter((r) => r === s.round).length >= HACK.place.perTurn) return 'hackTurn';
  if (hackCharges(s, f) <= 0) return 'hackCharges';
  if (s.factions[f].stars < hackCost(s, f, c)) return 'notEnoughStars';
  return 'ok';
}

/** Neutrale Orte, die f gerade sieht (ohne Sterne- und Ladungspruefung) / neutral places f currently sees (no star or charge check) */
export function hackTargets(s: GameState, f: number): City[] {
  if (!hacksOn(s, f)) return [];
  return s.cities.filter((c) => c.owner === null && placeVisible(s, f, c));
}

/** Hack anwenden (hackCheck vorher 'ok') / apply the hack (hackCheck 'ok' beforehand) */
export function applyHack(s: GameState, f: number, c: City, ev: GameEvent[], kit: HackKit) {
  const fa = s.factions[f];
  fa.stars -= hackCost(s, f, c);
  // Fenster kuerzen: nur Runden, die noch zaehlen oder fuer den Preis noetig sind / keep the list: every hack counts for the price
  fa.hacks = [...(fa.hacks ?? []), s.round];
  kit.capture(f, c, ev);
}

// ---------- Stadt-Hack: feindliche Stadt aufdecken / city hack: reveal a hostile city ----------

/** Runden bis der naechste Stadt-Hack moeglich ist (0 = jetzt) / rounds until the next city hack is possible (0 = now) */
export const cityHackWait = (s: GameState, f: number): number => Math.max(0, (s.factions[f]?.cityHackReady ?? 0) - s.round);

/** Ist die Stadt gerade von f gehackt? / is the city currently hacked by f? */
export const cityHackedBy = (s: GameState, c: City, f: number): boolean => !!c.hacked && c.hacked.by === f && c.hacked.until >= s.round && c.owner !== f;

/** Verbleibende Runden eines Stadt-Hacks (0 = keiner) / remaining rounds of a city hack (0 = none) */
export const cityHackRoundsLeft = (s: GameState, c: City): number => (c.hacked && c.hacked.until >= s.round && c.owner !== c.hacked.by ? c.hacked.until - s.round + 1 : 0);

/** Umkreis der Sicht: Stadtradius plus HACK.city.radius / radius of the vision: city radius plus HACK.city.radius */
export const cityHackRadius = (c: City): number => c.radius + HACK.city.radius;

export type CityHackCheck = 'ok' | Extract<ErrorCode, 'gameOver' | 'wrongFaction' | 'invalidTarget' | 'peace' | 'notVisible' | 'noDataCenter' | 'cityHackCooldown' | 'notEnoughStars'>;

/**
 * Darf f die Stadt c hacken (aufdecken)? Feindliche Stadt eines Kriegsgegners, ihr Feld aufgedeckt (die Lage bekannt, sie
 * muss nicht sichtbar sein), mindestens ein Rechenzentrum, Sperre abgelaufen, genug Sterne.
 * May f hack (reveal) the city c? Hostile city of an enemy at war, its tile explored (the location known, it need not be
 * visible), at least one data centre, lock expired, enough stars.
 */
export function cityHackCheck(s: GameState, f: number, c: City): CityHackCheck {
  if (s.over) return 'gameOver';
  if (!hacksOn(s, f)) return 'wrongFaction';
  if (c.owner === null || c.owner === f) return 'invalidTarget';
  if (!isHostile(s, f, c.owner)) return 'peace';
  if (!isExplored(s, f, c.x, c.y)) return 'notVisible';
  if (hackCapacity(s, f) <= 0) return 'noDataCenter';
  if (cityHackWait(s, f) > 0) return 'cityHackCooldown';
  if (s.factions[f].stars < HACK.city.cost) return 'notEnoughStars';
  return 'ok';
}

/** Feindliche Staedte, die f hacken koennte (ohne Sterne und Sperre) / hostile cities f could hack (without stars and lock) */
export function cityHackTargets(s: GameState, f: number): City[] {
  if (!hacksOn(s, f)) return [];
  return s.cities.filter((c) => c.owner !== null && c.owner !== f && isHostile(s, f, c.owner) && isExplored(s, f, c.x, c.y));
}

/**
 * Stadt-Hack anwenden (cityHackCheck vorher 'ok'): Sichtung im Umkreis fuer rounds Runden, Felder aufdecken, Marke an der
 * Stadt, Sperre fuer die Fraktion.
 * Apply the city hack (cityHackCheck 'ok' beforehand): sighting within the radius for rounds rounds, reveal the tiles, mark
 * on the city, lock for the faction.
 */
export function applyCityHack(s: GameState, f: number, c: City, ev: GameEvent[], kit: HackKit & { sight(f: number, x: number, y: number, r: number, rounds: number): void }) {
  const fa = s.factions[f];
  fa.stars -= HACK.city.cost;
  fa.cityHackReady = s.round + HACK.city.cooldown;
  const until = s.round + HACK.city.rounds - 1;
  const r = cityHackRadius(c);
  c.hacked = { by: f, until };
  kit.sight(f, c.x, c.y, r, HACK.city.rounds);
  kit.reveal(f, c.x, c.y, r, ev);
  fa.lastAttackRound = s.round;
  ev.push({ t: 'cityHack', city: c.id, faction: f, victim: c.owner!, until, x: c.x, y: c.y });
}

// ---------- Hackturm: Bau / hack tower: construction ----------

/** Lebende Hacktuerme der Fraktion f / living hack towers of faction f */
export const hackTowersOf = (s: GameState, f: number) => turretList(s).filter((p) => p.owner === f && p.kind === 'hack');

/** Hoechstzahl: je eigener Stadt einer, insgesamt HACK.tower.max / maximum: one per own city, HACK.tower.max in total */
export const hackTowerLimit = (s: GameState, f: number): number => Math.min(HACK.tower.max, ownCities(s, f).length * HACK.tower.perCity);

/** Ist das Feld ein lebender Hackturm? / is the tile a living hack tower? */
export const isHackTile = (t: Tile | undefined): boolean => !!t?.turret && t.turret.hp > 0 && t.turret.kind === 'hack';

/**
 * Freier Bauplatz wie bei Stellungen: passierbares Land ohne Stadt, Gebaeude, Ressource, Besonderheit, Aussenposten,
 * Grossprojekt, Sperre, Mine, Geschuetz, Wunder, Tempel, Vulkan oder Lava.
 * Free site as for emplacements: passable land without city, building, resource, feature, outpost, grand project,
 * barrier, mine, gun, wonder, temple, volcano or lava.
 */
function siteFree(s: GameState, t: Tile): boolean {
  return HACK.tower.terrain.includes(t.terrain) && t.cityId === null && !t.building && !t.resource && !t.feature && !t.outpost &&
    !t.grandProject && !t.barrier && !t.mine && !t.turret && !t.wonderOf && !t.temple && !t.volcano && !burning(s, t);
}

export type HackTowerCheck = 'ok' | Extract<ErrorCode,
  'gameOver' | 'wrongFaction' | 'invalidTile' | 'occupied' | 'notInTerritory' | 'emplacementLimit' | 'emplacementSpacing' | 'notEnoughStars'>;

/** Darf f auf (x, y) einen Hackturm bauen? / may f build a hack tower on (x, y)? */
export function hackTowerCheck(s: GameState, f: number, x: number, y: number): HackTowerCheck {
  if (s.over) return 'gameOver';
  if (!hacksOn(s, f)) return 'wrongFaction';
  if (!inBounds(s.size, x, y)) return 'invalidTile';
  const t = tileAt(s, x, y)!;
  if (territoryOwner(s, t) !== f) return 'notInTerritory';
  if (!siteFree(s, t)) return 'invalidTile';
  if (unitAt(s, x, y)) return 'occupied';
  const own = hackTowersOf(s, f);
  if (own.length >= hackTowerLimit(s, f)) return 'emplacementLimit';
  if (own.some((p) => dist(p, { x, y }) < HACK.tower.minSpacing)) return 'emplacementSpacing';
  if (s.factions[f].stars < HACK.tower.cost) return 'notEnoughStars';
  return 'ok';
}

/** Hackturm bauen (hackTowerCheck vorher 'ok'); sofort bereit / build a hack tower (hackTowerCheck 'ok' beforehand); ready at once */
export function buildHackTower(s: GameState, f: number, x: number, y: number, ev: GameEvent[]) {
  const t = tileAt(s, x, y)!;
  s.factions[f].stars -= HACK.tower.cost;
  t.turret = { hp: HACK.tower.hp, active: true, owner: f, kind: 'hack', ready: s.round };
  t.turretRuin = false;
  delete t.turretRuinOwner;
  t.remains = null;
  ev.push({ t: 'emplacement', x, y, faction: f, kind: 'hack' });
}

// ---------- Hackturm: Uebernahme / hack tower: takeover ----------

/** Hackturm der Fraktion f auf (x, y) oder null / hack tower of faction f at (x, y) or null */
export function hackTowerOf(s: GameState, f: number, x: number, y: number): NonNullable<Tile['turret']> | null {
  const g = tileAt(s, x, y)?.turret;
  return g && g.hp > 0 && g.kind === 'hack' && g.owner === f ? g : null;
}

/** Gerade vom Turm auf (x, y) uebernommene Einheit oder null / unit currently taken over by the tower at (x, y) or null */
export function towerLink(s: GameState, x: number, y: number): Unit | null {
  const g = tileAt(s, x, y)?.turret;
  if (!g || g.link === undefined) return null;
  const u = unitById(s, g.link);
  return u && u.hijack && u.hijack.x === x && u.hijack.y === y ? u : null;
}

/** Runden bis der Turm wieder uebernehmen kann (0 = bereit), null = kein Hackturm / rounds until the tower can take over again (0 = ready), null = no tower */
export function towerWait(s: GameState, x: number, y: number): number | null {
  const g = tileAt(s, x, y)?.turret;
  if (!g || g.hp <= 0 || g.kind !== 'hack') return null;
  return Math.max(0, (g.ready ?? s.round) - s.round);
}

/**
 * Mechanisiert: Fahrzeug (VEHICLE_UNITS, mit Laeufern und Mechs) oder Flieger; keine Schiffe (sie tragen Einheiten),
 * Wunder, Endgegner und keine Kamikaze-Waffen (Lenkflugkoerper).
 * Mechanised: vehicle (VEHICLE_UNITS, with walkers and mechs) or flyer; no ships (they carry units), wonders, bosses and
 * no kamikaze weapons (guided missile).
 */
export function isMechanised(type: UnitTypeId): boolean {
  const cls = unitClass(type);
  const ab = UNITS[type].abilities;
  return (cls === 'vehicle' || cls === 'air') && !ab.includes('wonder') && !ab.includes('boss') && !ab.includes('kamikaze') && !ab.includes('carry');
}

export type HijackCheck = 'ok' | Extract<ErrorCode,
  'gameOver' | 'noUnit' | 'towerBusy' | 'towerCooldown' | 'invalidTarget' | 'peace' | 'notVisible' | 'outOfRange' | 'notMechanised'>;

/**
 * Darf der Turm von f auf (x, y) die Einheit u uebernehmen? Turm frei und bereit; Ziel feindlich (Krieg), sichtbar, in
 * Reichweite, mechanisiert, nicht schon uebernommen, nicht in einer Stadt, nichts tragend.
 * May f's tower at (x, y) take over unit u? Tower free and ready; target hostile (war), visible, within reach,
 * mechanised, not already taken over, not in a city, carrying nothing.
 */
export function hijackCheck(s: GameState, f: number, x: number, y: number, u: Unit | undefined): HijackCheck {
  if (s.over) return 'gameOver';
  if (!hacksOn(s, f) || !hackTowerOf(s, f, x, y)) return 'noUnit';
  if (towerLink(s, x, y)) return 'towerBusy';
  if ((towerWait(s, x, y) ?? 0) > 0) return 'towerCooldown';
  if (!u || u.owner === f || u.hijack) return 'invalidTarget';
  if (!isHostile(s, f, u.owner)) return 'peace';
  if (!canSeeUnit(s, f, u)) return 'notVisible';
  if (dist(u, { x, y }) > HACK.tower.reach) return 'outOfRange';
  if (!isMechanised(u.type) || isWonder(u) || isBoss(u) || u.carried || has(u, 'carry')) return 'notMechanised';
  if (tileAt(s, u.x, u.y)!.cityId !== null) return 'invalidTarget';
  return 'ok';
}

/** Einheiten, die der Turm jetzt uebernehmen kann / units the tower can take over now */
export function hijackTargets(s: GameState, f: number, x: number, y: number): Unit[] {
  if (!hackTowerOf(s, f, x, y)) return [];
  return s.units.filter((u) => dist(u, { x, y }) <= HACK.tower.reach && hijackCheck(s, f, x, y, u) === 'ok');
}

/** Feldsatz in Reichweite des Turms (Anzeige) / tiles within the tower's reach (display) */
export function hackReachTiles(s: GameState, x: number, y: number): Pos[] {
  const out: Pos[] = [];
  const r = HACK.tower.reach;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((dx || dy) && inBounds(s.size, x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
  return out;
}

/** Verbleibende NEXUS-Zuege einer uebernommenen Einheit (inklusive dem laufenden) / remaining NEXUS turns of a taken-over unit (incl. the current one) */
export const hijackRoundsLeft = (s: GameState, u: Unit): number => (u.hijack ? Math.max(0, u.hijack.until - s.round + 1) : 0);

/**
 * Uebernahme anwenden (hijackCheck vorher 'ok'): die Einheit gehoert bis zum Ende des NEXUS-Zuges in Runde until der
 * hackenden Fraktion und ist sofort bereit; der Turm ist belegt und laedt ab jetzt.
 * Apply the takeover (hijackCheck 'ok' beforehand): the unit belongs to the hacking faction until the end of its turn in
 * round until and is ready at once; the tower is busy and recharges from now.
 */
export function applyHijack(s: GameState, f: number, x: number, y: number, u: Unit, ev: GameEvent[], kit: HackKit) {
  const g = hackTowerOf(s, f, x, y)!;
  const from = u.owner;
  const until = s.round + HACK.tower.rounds - 1;
  u.hijack = { from, until, x, y };
  u.owner = f;
  u.moved = false; u.attacked = false; u.moveDone = false; u.exhausted = false; u.fresh = false;
  u.startX = u.x; u.startY = u.y;
  if (u.withdraw) delete u.withdraw;
  if (u.entrenched) u.entrenched = false;
  g.link = u.id;
  g.ready = s.round + HACK.tower.cooldown;
  s.factions[f].lastAttackRound = s.round;
  ev.push({ t: 'hijack', unit: u.id, faction: f, from, x, y, until });
  kit.reveal(f, u.x, u.y, Math.max(1, UNITS[u.type].vision), ev);
}

/**
 * Einheit an den eigentlichen Besitzer zurueckgeben: erschoepft, mit ihren LP; ist er ausgeschieden, zerfaellt sie.
 * Return the unit to its actual owner: exhausted, with its HP; if the owner is eliminated, it falls apart.
 */
function giveBack(s: GameState, u: Unit, reason: 'time' | 'tower' | 'eliminated', ev: GameEvent[], kit: HackKit) {
  const h = u.hijack!;
  const by = u.owner;
  const g = tileAt(s, h.x, h.y)?.turret;
  if (g && g.link === u.id) delete g.link;
  delete u.hijack;
  u.owner = h.from;
  u.moved = true; u.attacked = true; u.moveDone = true; u.exhausted = true;
  u.startX = u.x; u.startY = u.y;
  if (u.withdraw) delete u.withdraw;
  const lost = !s.factions[h.from]?.alive;
  ev.push({ t: 'hijackEnd', unit: u.id, faction: h.from, by, reason, x: u.x, y: u.y, unitType: u.type, ...(lost ? { lost: true } : {}) });
  if (lost) kit.kill(u, ev);
}

/**
 * Ausgang einer regulaer endenden Uebernahme wuerfeln: dauerhaft behalten, abschalten oder zurueckgeben (HACK.tower).
 * Ein Wurf je Einheit, nach Einheiten-ID, damit der Zufallsstrom deterministisch bleibt.
 * Roll the outcome of a takeover ending regularly: keep for good, shut down or return (HACK.tower). One roll per unit,
 * by unit id, so the random stream stays deterministic.
 */
export function hijackOutcome(roll: number): 'kept' | 'shutdown' | 'returned' {
  const T = HACK.tower;
  if (roll < T.keepChance) return 'kept';
  if (roll < T.keepChance + T.shutdownChance) return 'shutdown';
  return 'returned';
}

/**
 * Dauerhaft bei der hackenden Fraktion: eine gewoehnliche Einheit, Heimatstadt die naechste eigene Stadt mit freiem Platz
 * (sonst ein Versorger, sonst ohne), zaehlt fuer Sold und Limits; erschoepft bis zum naechsten eigenen Zug.
 * Kept for good by the hacking faction: an ordinary unit, home city the nearest own city with a free slot (else a
 * supplier, else none), counts for upkeep and limits; exhausted until the next own turn.
 */
function keep(s: GameState, u: Unit, ev: GameEvent[]) {
  const h = u.hijack!;
  const g = tileAt(s, h.x, h.y)?.turret;
  if (g && g.link === u.id) delete g.link;
  delete u.hijack;
  let home: number | null = null, best = Infinity;
  for (const c of ownCities(s, u.owner)) {
    const d = dist(c, u);
    if (d < best && trainHome(s, c) === c.id) { best = d; home = c.id; }
  }
  if (home === null) { const c = ownCities(s, u.owner)[0]; home = c ? trainHome(s, c) : null; }
  u.homeCity = home;
  u.moved = true; u.attacked = true; u.moveDone = true; u.exhausted = true;
  ev.push({ t: 'hijackEnd', unit: u.id, faction: h.from, by: u.owner, reason: 'time', outcome: 'kept', x: u.x, y: u.y, unitType: u.type });
}

/**
 * Abgeschaltet: die Einheit faellt an ihren eigentlichen Besitzer zurueck und wird sofort zerstoert (Wrack, kein Abschuss,
 * keine Sterne, Verlust in der Statistik des Besitzers).
 * Shut down: the unit falls back to its actual owner and is destroyed at once (wreck, no kill, no stars, a loss in the
 * owner's statistics).
 */
function shutDown(s: GameState, u: Unit, ev: GameEvent[], kit: HackKit) {
  const h = u.hijack!;
  const by = u.owner;
  const g = tileAt(s, h.x, h.y)?.turret;
  if (g && g.link === u.id) delete g.link;
  delete u.hijack;
  u.owner = h.from;
  ev.push({ t: 'hijackEnd', unit: u.id, faction: h.from, by, reason: 'time', outcome: 'shutdown', x: u.x, y: u.y, unitType: u.type });
  kit.wreck(u, ev);
}

/**
 * Ende des Zuges von f: abgelaufene Uebernahmen enden mit Wurf (behalten, abschalten, zurueckgeben); ist der Besitzer
 * ausgeschieden, zerfaellt die Einheit ohne Wurf.
 * End of f's turn: expired takeovers end with a roll (keep, shut down, return); if the owner is eliminated, the unit
 * falls apart without a roll.
 */
export function endHijacks(s: GameState, f: number, ev: GameEvent[], kit: HackKit) {
  const due = s.units.filter((u) => u.hijack && u.owner === f && u.hijack.until <= s.round).sort((a, b) => a.id - b.id);
  for (const u of due) {
    if (!s.factions[u.hijack!.from]?.alive) { giveBack(s, u, 'time', ev, kit); continue; }
    const out = hijackOutcome(kit.roll());
    if (out === 'kept') keep(s, u, ev);
    else if (out === 'shutdown') shutDown(s, u, ev, kit);
    else giveBack(s, u, 'time', ev, kit);
  }
}

/**
 * Nach jedem Befehl: Einheiten, deren Turm gefallen ist (oder den Besitzer gewechselt hat), kehren sofort zurueck;
 * verwaiste Verknuepfungen (Einheit gefallen) werden geloescht.
 * After every command: units whose tower has fallen (or changed hands) return at once; orphaned links (unit fallen) are
 * cleared.
 */
export function sweepHijacks(s: GameState, ev: GameEvent[], kit: HackKit) {
  for (const u of s.units.slice()) {
    if (!u.hijack) continue;
    const g = tileAt(s, u.hijack.x, u.hijack.y)?.turret;
    if (!g || g.hp <= 0 || g.kind !== 'hack' || g.owner !== u.owner || g.link !== u.id) giveBack(s, u, 'tower', ev, kit);
  }
  for (const t of s.tiles) {
    const g = t.turret;
    if (g?.kind === 'hack' && g.link !== undefined && !unitById(s, g.link)?.hijack) delete g.link;
  }
}

/** Hacker f scheidet aus: alle Uebernahmen enden sofort / hacker f is eliminated: all takeovers end at once */
export function releaseHijacks(s: GameState, f: number, ev: GameEvent[], kit: HackKit) {
  for (const u of s.units.slice()) if (u.hijack && u.owner === f) giveBack(s, u, 'eliminated', ev, kit);
}

/** Stadt, in deren Gebiet der Turm steht (Anzeige) / city in whose territory the tower stands (display) */
export function hackTowerCity(s: GameState, x: number, y: number): City | null {
  const t = tileAt(s, x, y);
  return t && t.territory !== null ? cityById(s, t.territory) ?? null : null;
}
