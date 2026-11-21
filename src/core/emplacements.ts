/**
 * Festungsbau (Dravon): Geschuetzstellungen. Eine Stellung ist ein Geschuetz auf dem Feld (Tile.turret mit owner), dieselbe
 * Mechanik wie die neutralen Verdan-Geschuetze (Rundenfeuer, Trefferglueck, attackTurret), aber mit Besitzer:
 * - Bau: Pionier oder Minenleger auf ein freies Nachbarfeld im eigenen Gebiet, Preis EMPLACEMENT.cost, hoechstens
 *   EMPLACEMENT.perCity je eigener Stadt, Mindestabstand EMPLACEMENT.minSpacing.
 * - Feuer: zu Rundenbeginn einmal auf eine sichtbare Einheit im Krieg mit dem Besitzer in Reichweite (nie im Frieden,
 *   nie Verbuendete); toedliche Treffer zuerst, dann die einer eigenen Stadt naechste, dann die schwaechste.
 * - Kein Einheit: zaehlt nicht zu Limits, Sold, Punkten, Abschuessen oder Diplomatie.
 * - Gebiet verloren (Stadt erobert, Gebiet neutral) oder Besitzer ausgeschieden: die Stellung wird geschleift (Truemmer).
 * Fortification (Dravon): gun emplacements. An emplacement is a gun on the tile (Tile.turret with owner), the same
 * mechanics as the neutral Verdan guns (round fire, hit luck, attackTurret), but with an owner:
 * - building: a pioneer or mine layer on a free adjacent tile in own territory, price EMPLACEMENT.cost, at most
 *   EMPLACEMENT.perCity per own city, minimum spacing EMPLACEMENT.minSpacing.
 * - fire: once at the start of the round at a visible unit at war with the owner in range (never at peace, never
 *   allies); lethal hits first, then the one closest to an own city, then the weakest.
 * - not a unit: does not count towards limits, upkeep, score, kills or diplomacy.
 * - territory lost (city captured, territory neutral) or owner eliminated: the emplacement is razed (rubble).
 * Raketensilo (Meridon, SILO): derselbe Bau ueber den Befehl 'emplacement' (Pioniere), aber mit kind 'silo': feuert nie von
 * selbst, sondern startet Raketen auf Befehl (shadowFleet.ts), eigene Grenzen (SILO.perCity, SILO.max, SILO.minSpacing).
 * Rocket silo (Meridon, SILO): the same construction through the 'emplacement' command (pioneers), but with kind 'silo':
 * never fires on its own, launches rockets on command instead (shadowFleet.ts), own limits (SILO.perCity, SILO.max,
 * SILO.minSpacing).
 */
import { EMPLACEMENT, SILO } from '../data/balance';
import { dist, inBounds, tileAt } from './grid';
import { burning } from './hazards';
import {
  canSeeUnit, isHostile, isWonder, ownCities, submerged, territoryOwner, turretList, turretShotDamage, unitAt,
} from './queries';
import type { ErrorCode, GameEvent, GameState, Pos, Tile, Unit } from './types';

/** Hat die Fraktion Festungsbau (Geschuetzstellungen, Dravon)? / does the faction have fortification (gun emplacements, Dravon)? */
export const hasFortification = (s: GameState, f: number) => !!s.factions[f] && EMPLACEMENT.factions.includes(s.factions[f].id);
/** Baut die Fraktion Raketensilos (Meridon)? / does the faction build rocket silos (Meridon)? */
export const buildsSilos = (s: GameState, f: number) => !!s.factions[f] && SILO.factions.includes(s.factions[f].id);
/** Bauwerk der Fraktion: Geschuetzstellung oder Raketensilo / structure of the faction: gun emplacement or rocket silo */
const specOf = (s: GameState, f: number) => (buildsSilos(s, f) ? SILO : EMPLACEMENT);
/** Kann diese Einheit Stellungen oder Silos bauen (Typ und Fraktion)? / can this unit build emplacements or silos (type and faction)? */
export const isEmplacementBuilder = (s: GameState, u: Unit) =>
  (hasFortification(s, u.owner) && EMPLACEMENT.builders.includes(u.type)) || (buildsSilos(s, u.owner) && SILO.builders.includes(u.type));
/** Lebende Geschuetzstellungen der Fraktion f (ohne Silos) / living gun emplacements of faction f (without silos) */
export const emplacementsOf = (s: GameState, f: number) => turretList(s).filter((p) => p.owner === f && !p.kind);
/** Lebende Raketensilos der Fraktion f / living rocket silos of faction f */
export const silosOf = (s: GameState, f: number) => turretList(s).filter((p) => p.owner === f && p.kind === 'silo');
/** Eigene Bauwerke der Bauart der Fraktion (Stellungen oder Silos) / own structures of the faction's kind (emplacements or silos) */
export const structuresOf = (s: GameState, f: number) => (buildsSilos(s, f) ? silosOf(s, f) : emplacementsOf(s, f));
/** Hoechstzahl: je eigener Stadt eine (Silos zusaetzlich hoechstens SILO.max) / maximum: one per own city (silos also at most SILO.max) */
export const emplacementLimit = (s: GameState, f: number) =>
  buildsSilos(s, f) ? Math.min(SILO.max, ownCities(s, f).length * SILO.perCity) : ownCities(s, f).length * EMPLACEMENT.perCity;
/** Ist das Feld eine Geschuetzstellung oder ein Silo (nicht Verdan)? / is the tile a gun emplacement or a silo (not Verdan)? */
export const isEmplacementTile = (t: Tile | undefined) => !!t?.turret && t.turret.hp > 0 && t.turret.owner !== undefined;
/** Ist das Feld ein lebendes Raketensilo? / is the tile a living rocket silo? */
export const isSiloTile = (t: Tile | undefined) => !!t?.turret && t.turret.hp > 0 && t.turret.kind === 'silo';

export type EmplacementCheck = 'ok' | Extract<ErrorCode,
  'wrongFaction' | 'cannotBuild' | 'unitExhausted' | 'outOfRange' | 'invalidTile' | 'occupied' | 'notInTerritory' | 'emplacementLimit' | 'emplacementSpacing' | 'notEnoughStars'>;

/**
 * Freier Bauplatz: passierbares Land ohne Stadt, Gebaeude, Ressource, Besonderheit, Aussenposten, Grossprojekt, Sperre,
 * eigene Mine, Geschuetz, Wunder, Vulkan oder Lava. Wracks, Strassen und Truemmer stoeren nicht (Wracks werden geraeumt).
 * Free site: passable land without city, building, resource, feature, outpost, grand project, barrier, own mine, gun,
 * wonder, volcano or lava. Wrecks, roads and rubble do not matter (wrecks are cleared).
 */
function siteFree(s: GameState, t: Tile, f: number): boolean {
  return specOf(s, f).terrain.includes(t.terrain) && t.cityId === null && !t.building && !t.resource && !t.feature && !t.outpost &&
    !t.grandProject && !t.barrier && t.mine?.owner !== f && !t.turret && !t.wonderOf && !t.temple && !t.volcano && !burning(s, t);
}

/** Kann u eine Stellung auf (x, y) bauen? / can u build an emplacement on (x, y)? */
export function emplacementCheck(s: GameState, u: Unit, x: number, y: number): EmplacementCheck {
  if (!hasFortification(s, u.owner) && !buildsSilos(s, u.owner)) return 'wrongFaction';
  const spec = specOf(s, u.owner);
  if (!spec.builders.includes(u.type)) return 'cannotBuild';
  if (u.fresh || u.exhausted || u.attacked) return 'unitExhausted';
  if (!inBounds(s.size, x, y) || dist(u, { x, y }) !== 1) return 'outOfRange';
  const t = tileAt(s, x, y)!;
  if (!siteFree(s, t, u.owner)) return 'invalidTile';
  if (unitAt(s, x, y)) return 'occupied';
  if (territoryOwner(s, t) !== u.owner) return 'notInTerritory';
  const own = structuresOf(s, u.owner);
  if (own.length >= emplacementLimit(s, u.owner)) return 'emplacementLimit';
  if (own.some((p) => dist(p, { x, y }) < spec.minSpacing)) return 'emplacementSpacing';
  if (s.factions[u.owner].stars < spec.cost) return 'notEnoughStars';
  return 'ok';
}

/** Nachbarfelder, auf die u jetzt bauen kann / adjacent tiles u can build on now */
export function emplacementTargets(s: GameState, u: Unit): Pos[] {
  if (!isEmplacementBuilder(s, u)) return [];
  const out: Pos[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((dx || dy) && emplacementCheck(s, u, u.x + dx, u.y + dy) === 'ok') out.push({ x: u.x + dx, y: u.y + dy });
  }
  return out;
}

/**
 * Grund, warum u gerade nirgends bauen kann (fuer die Oberflaeche): der erste Fehler, der nicht am Feld liegt, sonst invalidTile.
 * Why u cannot build anywhere right now (for the UI): the first error not caused by the tile, otherwise invalidTile.
 */
export function emplacementBlock(s: GameState, u: Unit): EmplacementCheck {
  let best: EmplacementCheck = 'invalidTile';
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const c = emplacementCheck(s, u, u.x + dx, u.y + dy);
    if (c === 'ok') return c;
    if (c !== 'invalidTile' && c !== 'occupied' && c !== 'outOfRange' && c !== 'notInTerritory') return c;
    if (c === 'notInTerritory' || (c === 'occupied' && best === 'invalidTile')) best = c;
  }
  return best;
}

/** Stellung bauen (Kommando 'emplacement'); null = gelungen / build an emplacement (command 'emplacement'); null = done */
export function buildEmplacement(s: GameState, u: Unit, x: number, y: number, ev: GameEvent[]): Exclude<EmplacementCheck, 'ok'> | null {
  const check = emplacementCheck(s, u, x, y);
  if (check !== 'ok') return check;
  const f = u.owner;
  const t = tileAt(s, x, y)!;
  const silo = buildsSilos(s, f);
  s.factions[f].stars -= specOf(s, f).cost;
  // Silo: erster Start nach der Aufladezeit / silo: first launch after the charge time
  t.turret = silo ? { hp: SILO.hp, active: true, owner: f, kind: 'silo', ready: s.round + SILO.charge } : { hp: EMPLACEMENT.hp, active: true, owner: f };
  // Truemmer, Wrack und fremde Mine raeumen die Pioniere weg / the pioneers clear rubble, wreck and a foreign mine
  t.turretRuin = false;
  delete t.turretRuinOwner;
  t.remains = null;
  t.mine = null;
  u.exhausted = true;
  ev.push({ t: 'emplacement', x, y, faction: f, ...(silo ? { kind: 'silo' as const } : {}) });
  return null;
}

/**
 * Ziel einer Stellung: sichtbare Einheiten im Krieg mit dem Besitzer in Reichweite (keine Wunder, keine getauchten U-Boote).
 * Reihenfolge: ein voller Treffer vernichtet sie, dann Abstand zur naechsten eigenen Stadt, dann LP, dann ID (deterministisch).
 * Target of an emplacement: visible units at war with the owner in range (no wonders, no submerged submarines).
 * Order: a full hit destroys it, then distance to the nearest own city, then HP, then id (deterministic).
 */
export function emplacementTarget(s: GameState, p: Pos & { hp: number; owner?: number; kind?: 'silo' | 'hack' }): Unit | null {
  const f = p.owner;
  // Silos und Hacktuerme feuern nie von selbst / silos and hack towers never fire on their own
  if (f === undefined || p.kind) return null;
  const cities = ownCities(s, f);
  let best: Unit | null = null, bestKey = Infinity;
  for (const u of s.units) {
    if (dist(u, p) > EMPLACEMENT.range || !isHostile(s, f, u.owner) || isWonder(u) || submerged(s, u) || !canSeeUnit(s, f, u)) continue;
    const lethal = turretShotDamage(s, p.hp, u, EMPLACEMENT) >= u.hp ? 0 : 1;
    let dc = 99;
    for (const c of cities) dc = Math.min(dc, dist(c, u));
    const key = ((lethal * 100 + dc) * 1000 + u.hp) * 1e6 + u.id;
    if (key < bestKey) { bestKey = key; best = u; }
  }
  return best;
}

function raze(s: GameState, k: number, f: number, reason: 'territory' | 'eliminated', ev: GameEvent[]) {
  const t = s.tiles[k];
  t.turret = null;
  t.turretRuin = true;
  t.turretRuinOwner = f;
  ev.push({ t: 'emplacementLost', x: k % s.size, y: Math.floor(k / s.size), faction: f, reason });
}

/**
 * Nach jedem Kommando: Stellungen ausserhalb des eigenen Gebiets (Stadt erobert, Gebiet neutral) werden geschleift.
 * After every command: emplacements outside own territory (city captured, territory neutral) are razed.
 */
export function sweepEmplacements(s: GameState, ev: GameEvent[]) {
  for (let k = 0; k < s.tiles.length; k++) {
    const t = s.tiles[k];
    const f = t.turret?.owner;
    if (f === undefined || !t.turret || t.turret.hp <= 0) continue;
    if (!s.factions[f]?.alive) raze(s, k, f, 'eliminated', ev);
    else if (territoryOwner(s, t) !== f) raze(s, k, f, 'territory', ev);
  }
}

/** Ausgeschiedene Fraktion: alle ihre Stellungen verschwinden (wie Minen und Sperren) / eliminated faction: all its emplacements vanish (like mines and barriers) */
export function clearEmplacements(s: GameState, f: number, ev: GameEvent[]) {
  for (let k = 0; k < s.tiles.length; k++) if (s.tiles[k].turret?.owner === f) raze(s, k, f, 'eliminated', ev);
}
