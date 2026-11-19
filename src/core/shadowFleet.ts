/**
 * Schattenflotte der Handelsliga Meridon: Sabotage des Schattenkommandos, Radarimpuls des Radarwagens, Start des
 * Raketensilos und der Brand danach. Reine Abfragen und die Anwendung; rules.ts reicht seine internen Helfer (Tod,
 * Riss-Schonung, Wunder-Unterbrechung, Kriegsspuren, Aussenposten, Verbindungen) als ShadowKit herein, wie beim
 * Orbitallaser. Deterministisch, ohne Zufall. Zahlen: SABOTAGE, RADAR, SILO, SIGHTING in balance.ts.
 * Shadow fleet of the Meridon Trade League: the Shadow Commando's sabotage, the Radar Truck's sweep, the rocket silo's
 * launch and the fire afterwards. Pure queries and their application; rules.ts passes its internal helpers (death, rift
 * sparing, wonder interruption, war marks, outposts, connections) in as a ShadowKit, as for the orbital laser.
 * Deterministic, without randomness. Numbers: SABOTAGE, RADAR, SILO, SIGHTING in balance.ts.
 */
import { RADAR, SABOTAGE, SIGHTING, SILO, type BuildingId } from '../data/balance';
import { dist, inBounds, isLand, tileAt } from './grid';
import { canActStill, canSeeUnit, has, isExplored, isHostile, sightedBy, territoryOwner, unitAt, unitById } from './queries';
import type { ErrorCode, Faction, GameEvent, GameState, OrbitalHit, Pos, Tile, Unit } from './types';

/** Interne Helfer aus rules.ts / internal helpers from rules.ts */
export interface ShadowKit {
  kill(u: Unit, ev: GameEvent[]): void;
  spare(u: Unit): void;
  interrupt(u: Unit, ev: GameEvent[]): void;
  /** Krater und Schlachtfeld-Narbe / crater and battlefield scar */
  mark(x: number, y: number): void;
  /** Aussenposten freigeben (Gebiet zurueck) / release an outpost (territory back) */
  releaseOutpost(t: Tile): void;
  /** Strassennetz der Fraktion neu pruefen / re-check the faction's road network */
  connections(f: number, ev: GameEvent[]): void;
  /** Geschuetz getroffen: Linie wecken / gun hit: wake the line */
  wake(p: Pos, ev: GameEvent[]): void;
}

// ---------- Sichtungen und Radar / sightings and radar ----------

/** Sichtung fuer Fraktion f anlegen (Drohne, Funkturm, Radar) / add a sighting for faction f (drone, radio tower, radar) */
export function addSighting(s: GameState, f: number, x: number, y: number, r: number, rounds = SIGHTING.rounds, unit?: number) {
  const fa = s.factions[f];
  if (!fa) return;
  const until = s.round + rounds - 1;
  fa.sightings = [...(fa.sightings ?? []).filter((z) => z.until >= s.round && (unit === undefined || z.unit !== unit)), { x, y, r, until, ...(unit !== undefined ? { unit } : {}) }];
}

/** Abgelaufene Sichtungen entfernen (Zugbeginn) / remove expired sightings (start of the turn) */
export function pruneSightings(fa: Faction, round: number) {
  if (!fa.sightings) return;
  const keep = fa.sightings.filter((z) => z.until >= round);
  if (keep.length) fa.sightings = keep; else delete fa.sightings;
}

/** Radarimpulse folgen dem Radarwagen / radar sweeps follow the Radar Truck */
export function followSightings(s: GameState, u: Unit) {
  for (const z of s.factions[u.owner]?.sightings ?? []) if (z.unit === u.id) { z.x = u.x; z.y = u.y; }
}

/** Radarimpulse einer Einheit beenden (gefallen, bekehrt) / end the radar sweeps of a unit (fallen, converted) */
export function dropSightings(s: GameState, unitId: number) {
  for (const fa of s.factions) {
    if (!fa.sightings?.some((z) => z.unit === unitId)) continue;
    fa.sightings = fa.sightings.filter((z) => z.unit !== unitId);
    if (!fa.sightings.length) delete fa.sightings;
  }
}

/** Laufender Radarimpuls der Einheit (bis Runde) oder null / running radar sweep of the unit (until round) or null */
export function sweepOf(s: GameState, u: Unit): number | null {
  const z = s.factions[u.owner]?.sightings?.find((q) => q.unit === u.id && q.until >= s.round);
  return z ? z.until : null;
}

/** Runden bis der Radarimpuls wieder bereit ist (0 = bereit) / rounds until the radar sweep is ready again (0 = ready) */
export const radarWait = (s: GameState, u: Unit): number => Math.max(0, (u.sweepReady ?? 0) - s.round);

export type RadarCheck = 'ok' | Extract<ErrorCode, 'cannotBuild' | 'unitExhausted' | 'radarCooldown'>;

/** Darf u jetzt einen Radarimpuls senden? / may u send a radar sweep now? */
export function radarCheck(s: GameState, u: Unit): RadarCheck {
  if (!has(u, 'radar')) return 'cannotBuild';
  if (!canActStill(u)) return 'unitExhausted';
  if (radarWait(s, u) > 0) return 'radarCooldown';
  return 'ok';
}

/** Radarimpuls senden (radarCheck vorher 'ok') / send a radar sweep (radarCheck 'ok' beforehand) */
export function applyRadar(s: GameState, u: Unit, ev: GameEvent[]) {
  addSighting(s, u.owner, u.x, u.y, RADAR.radius, RADAR.rounds, u.id);
  u.exhausted = true;
  u.sweepReady = s.round + RADAR.cooldown;
  ev.push({ t: 'radarSweep', unit: u.id, x: u.x, y: u.y, radius: RADAR.radius, until: s.round + RADAR.rounds - 1, faction: u.owner });
}

/** Feindliche Einheiten, die f gerade nur dank Radar oder Sichtung sieht / hostile units f currently sees only thanks to radar or sightings */
export function radarContacts(s: GameState, f: number): Unit[] {
  return s.units.filter((u) => u.owner !== f && isHostile(s, f, u.owner) && canSeeUnit(s, f, u) &&
    (!isExplored(s, f, u.x, u.y) || has(u, 'camo') || has(u, 'invisible') || has(u, 'submerged')));
}

// ---------- Sabotage / sabotage ----------

/** Was eine Sabotage auf dem Feld zerstoeren wuerde / what a sabotage would destroy on the tile */
export interface SabotageThing { what: 'outpost' | 'building' | 'road'; victim: number; building?: BuildingId }

/**
 * Ziel der Sabotage von f auf (x, y): feindlicher Aussenposten, sonst Gebaeude im feindlichen Gebiet, sonst feindliche
 * Strasse. Nie Staedte, Grossprojekte, Wunder oder Geschuetze; Bruecken nur ohne Einheit darauf.
 * Target of f's sabotage at (x, y): hostile outpost, otherwise a building in hostile territory, otherwise a hostile road.
 * Never cities, grand projects, wonders or guns; bridges only without a unit on them.
 */
export function sabotageThing(s: GameState, f: number, x: number, y: number): SabotageThing | null {
  const t = tileAt(s, x, y);
  if (!t || t.cityId !== null || t.temple || t.wonderOf || t.turret) return null;
  if (t.outpost && t.outpost.owner !== f && isHostile(s, f, t.outpost.owner)) return { what: 'outpost', victim: t.outpost.owner };
  const o = territoryOwner(s, t);
  if (o === null || o === f || !isHostile(s, f, o)) return null;
  // Bruecke mit Einheit darauf: die Einheit stuende im Wasser / bridge with a unit on it: the unit would stand in the water
  if (t.building === 'bridge' && unitAt(s, x, y)) return null;
  if (t.building) return { what: 'building', victim: o, building: t.building };
  if (t.road && isLand(t)) return { what: 'road', victim: o };
  return null;
}

/** Runden bis die Sabotage wieder moeglich ist / rounds until sabotage is possible again */
export const sabotageWait = (s: GameState, u: Unit): number => Math.max(0, (u.sabotageReady ?? 0) - s.round);

export type SabotageCheck = 'ok' | Extract<ErrorCode, 'cannotBuild' | 'unitExhausted' | 'sabotageCooldown' | 'outOfRange' | 'noTarget'>;

/** Darf u auf (x, y) sabotieren? Eigenes Feld oder Nachbarfeld / may u sabotage on (x, y)? own tile or adjacent */
export function sabotageCheck(s: GameState, u: Unit, x: number, y: number): SabotageCheck {
  if (!has(u, 'sabotage')) return 'cannotBuild';
  if (!canActStill(u)) return 'unitExhausted';
  if (sabotageWait(s, u) > 0) return 'sabotageCooldown';
  if (!inBounds(s.size, x, y) || dist(u, { x, y }) > 1) return 'outOfRange';
  return sabotageThing(s, u.owner, x, y) ? 'ok' : 'noTarget';
}

/** Felder, auf denen u jetzt sabotieren kann / tiles u can sabotage on now */
export function sabotageTargets(s: GameState, u: Unit): Pos[] {
  if (!has(u, 'sabotage') || !canActStill(u) || sabotageWait(s, u) > 0) return [];
  const out: Pos[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = u.x + dx, y = u.y + dy;
    if (inBounds(s.size, x, y) && sabotageThing(s, u.owner, x, y)) out.push({ x, y });
  }
  return out;
}

/** Sabotage ausfuehren (sabotageCheck vorher 'ok') / carry out the sabotage (sabotageCheck 'ok' beforehand) */
export function applySabotage(s: GameState, u: Unit, x: number, y: number, ev: GameEvent[], kit: ShadowKit) {
  const t = tileAt(s, x, y)!;
  const thing = sabotageThing(s, u.owner, x, y)!;
  if (thing.what === 'outpost') { kit.releaseOutpost(t); t.outpost = null; }
  else if (thing.what === 'building') {
    if (t.building === 'bridge') t.road = false;
    if (t.building === 'researchCenter') t.researchBuilt = null;
    t.building = null;
  } else t.road = false;
  // Kriegsspur am Ziel, Kommando enttarnt und erschoepft / war mark at the target, commando revealed and exhausted
  kit.mark(x, y);
  u.exhausted = true;
  u.revealed = true;
  u.sabotageReady = s.round + SABOTAGE.cooldown + 1;
  s.factions[u.owner].lastAttackRound = s.round;
  ev.push({ t: 'sabotage', unit: u.id, x, y, what: thing.what, ...(thing.building ? { building: thing.building } : {}), faction: u.owner, victim: thing.victim });
  if (thing.what !== 'outpost') kit.connections(thing.victim, ev);
}

// ---------- Raketensilo / rocket silo ----------

/** Silo der Fraktion f auf (x, y) oder null / silo of faction f at (x, y) or null */
export function siloOf(s: GameState, f: number, x: number, y: number): NonNullable<Tile['turret']> | null {
  const g = tileAt(s, x, y)?.turret;
  return g && g.hp > 0 && g.kind === 'silo' && g.owner === f ? g : null;
}

/** Runden bis das Silo auf (x, y) starten kann (0 = bereit), null = kein Silo / rounds until the silo can launch (0 = ready), null = no silo */
export function siloWait(s: GameState, x: number, y: number): number | null {
  const g = tileAt(s, x, y)?.turret;
  if (!g || g.hp <= 0 || g.kind !== 'silo') return null;
  return Math.max(0, (g.ready ?? s.round) - s.round);
}

/** Linke obere Ecke der Flaeche, am Kartenrand nach innen geschoben / top-left corner of the area, shifted inwards at the map edge */
export function siloAnchor(s: GameState, x: number, y: number): Pos {
  const { w, h } = SILO.area;
  return { x: Math.max(0, Math.min(x, s.size - w)), y: Math.max(0, Math.min(y, s.size - h)) };
}

/** Felder der Einschlagsflaeche (Zielfeld, rechts, unten, diagonal) / tiles of the impact area (target, right, below, diagonal) */
export function siloArea(s: GameState, x: number, y: number): Pos[] {
  const a = siloAnchor(s, x, y);
  const out: Pos[] = [];
  for (let dy = 0; dy < SILO.area.h; dy++) for (let dx = 0; dx < SILO.area.w; dx++) out.push({ x: a.x + dx, y: a.y + dy });
  return out;
}

/** Felder der Flaeche, die danach brennen (Land ohne Stadt) / tiles of the area that burn afterwards (land without a city) */
export function siloFireTiles(s: GameState, tiles: Pos[]): Pos[] {
  return tiles.filter((p) => { const t = tileAt(s, p.x, p.y)!; return isLand(t) && t.cityId === null && !t.temple; });
}

const inArea = (tiles: Pos[], p: Pos) => tiles.some((q) => q.x === p.x && q.y === p.y);

/**
 * Wer wird getroffen? Alle Einheiten der Flaeche (auch Wunder ueber ihre Grundflaeche) und Geschuetze, ausser denen von
 * Fraktionen, mit denen f nicht im Krieg ist: sichtbare davon sperren den Start ('peace'), verdeckte bleiben verschont.
 * Who is hit? All units of the area (wonders via their footprint too) and guns, except those of factions f is not at
 * war with: visible ones block the launch ('peace'), hidden ones are spared.
 */
function struck(s: GameState, f: number, tiles: Pos[]): { units: Unit[]; guns: Pos[]; blocked: boolean } {
  const ids = new Set<number>();
  for (const u of s.units) if (inArea(tiles, u)) ids.add(u.id);
  for (const p of tiles) { const w = tileAt(s, p.x, p.y)?.wonderOf; if (w && unitById(s, w)) ids.add(w); }
  let blocked = false;
  const units = s.units.filter((u) => ids.has(u.id)).sort((a, b) => a.id - b.id).filter((u) => {
    if (u.owner === f || isHostile(s, f, u.owner)) return true;
    if (canSeeUnit(s, f, u)) blocked = true;
    return false;
  });
  const guns = tiles.filter((p) => {
    const g = tileAt(s, p.x, p.y)?.turret;
    if (!g || g.hp <= 0) return false;
    if (g.owner === undefined || g.owner === f || isHostile(s, f, g.owner)) return true;
    if (isExplored(s, f, p.x, p.y)) blocked = true;
    return false;
  });
  return { units, guns, blocked };
}

/** Darf f vom Silo (x, y) auf das Zielfeld (tx, ty) starten? / may f launch from the silo (x, y) at the target tile (tx, ty)? */
export function siloCheck(s: GameState, f: number, x: number, y: number, tx: number, ty: number): 'ok' | ErrorCode {
  if (s.over) return 'gameOver';
  if (!siloOf(s, f, x, y)) return 'noUnit';
  if ((siloWait(s, x, y) ?? 0) > 0) return 'siloCooldown';
  if (!inBounds(s.size, tx, ty)) return 'invalidTile';
  if (dist({ x, y }, { x: tx, y: ty }) > SILO.launchRange) return 'outOfRange';
  // das Zielfeld muss aufgedeckt sein oder im Radarimpuls liegen (Zieldaten), der Rest der Flaeche trifft auch im Nebel
  // the target tile must be revealed or inside a radar sweep (targeting data), the rest of the area hits in fog too
  if (!isExplored(s, f, tx, ty) && !sightedBy(s, f, { x: tx, y: ty })) return 'notVisible';
  if (struck(s, f, siloArea(s, tx, ty)).blocked) return 'peace';
  return 'ok';
}

export interface SiloPreview {
  tiles: Pos[];
  /** Felder, die danach brennen / tiles that burn afterwards */
  fire: Pos[];
  /** sichtbare Treffer aus Sicht von f / visible hits from f's point of view */
  hits: (OrbitalHit & { own: boolean })[];
  check: 'ok' | ErrorCode;
}

/** Vorschau fuer die Zielauswahl (nur Sichtbares) / preview for targeting (only what is visible) */
export function siloPreview(s: GameState, f: number, x: number, y: number, tx: number, ty: number): SiloPreview {
  const tiles = siloArea(s, tx, ty);
  const st = struck(s, f, tiles);
  const dmg = SILO.damage;
  const hits: SiloPreview['hits'] = [];
  for (const u of st.units) {
    if (!canSeeUnit(s, f, u)) continue;
    hits.push({ unit: u.id, x: u.x, y: u.y, dmg, killed: u.hp <= dmg, own: u.owner === f });
  }
  for (const p of st.guns) {
    if (!isExplored(s, f, p.x, p.y)) continue;
    const g = tileAt(s, p.x, p.y)!.turret!;
    hits.push({ turret: true, x: p.x, y: p.y, dmg, killed: g.hp <= dmg, own: g.owner === f });
  }
  return { tiles, fire: siloFireTiles(s, tiles), hits, check: siloCheck(s, f, x, y, tx, ty) };
}

/** Bereite Silos der Fraktion f / ready silos of faction f */
export function readySilos(s: GameState, f: number): Pos[] {
  const out: Pos[] = [];
  s.tiles.forEach((t, k) => {
    const g = t.turret;
    if (g && g.hp > 0 && g.kind === 'silo' && g.owner === f && (g.ready ?? s.round) <= s.round) out.push({ x: k % s.size, y: Math.floor(k / s.size) });
  });
  return out;
}

/**
 * Start anwenden (siloCheck vorher 'ok'): fester Schaden ohne Wurf an allen getroffenen Einheiten und Geschuetzen,
 * Abschuesse zaehlen fuer f (nicht eigene), Landfelder ohne Stadt brennen; danach die Sperrzeit des Silos.
 * Apply the launch (siloCheck 'ok' beforehand): flat damage without a roll on all struck units and guns, kills count for f
 * (not own ones), land tiles without a city burn; then the silo's lock time.
 */
export function fireSilo(s: GameState, f: number, x: number, y: number, tx: number, ty: number, ev: GameEvent[], kit: ShadowKit) {
  const fa = s.factions[f];
  const tiles = siloArea(s, tx, ty);
  const anchor = tiles[0];
  const st = struck(s, f, tiles);
  const dmg = SILO.damage;
  const hits: OrbitalHit[] = [];
  for (const u of st.units) {
    u.hp -= dmg;
    kit.spare(u);
    hits.push({ unit: u.id, x: u.x, y: u.y, dmg, killed: u.hp <= 0 });
  }
  for (const p of st.guns) {
    const t = tileAt(s, p.x, p.y)!;
    const gun = t.turret!;
    gun.hp = Math.max(0, gun.hp - dmg);
    const destroyed = gun.hp <= 0;
    hits.push({ turret: true, x: p.x, y: p.y, dmg, killed: destroyed });
    if (destroyed) { const o = gun.owner; t.turret = null; t.turretRuin = true; if (o !== undefined) t.turretRuinOwner = o; } else if (!gun.active) kit.wake(p, ev);
  }
  for (const p of tiles) kit.mark(p.x, p.y);
  for (const p of siloFireTiles(s, tiles)) tileAt(s, p.x, p.y)!.fire = { until: s.round + SILO.fireRounds, owner: f };
  const silo = siloOf(s, f, x, y);
  if (silo) silo.ready = s.round + SILO.cooldown;
  if (st.units.some((u) => u.owner !== f) || st.guns.length) fa.lastAttackRound = s.round;
  ev.push({ t: 'siloLaunch', faction: f, from: { x, y }, x: anchor.x, y: anchor.y, tiles, hits });
  for (const u of st.units) {
    if (u.hp <= 0) {
      kit.kill(u, ev);
      if (u.owner !== f) fa.kills++;
    } else kit.interrupt(u, ev);
  }
}

/** Brennt das Feld (Raketenbrand)? / is the tile burning (rocket fire)? */
export const onFire = (s: GameState, t: Tile | undefined): boolean => !!t?.fire && t.fire.until >= s.round;

/**
 * Brand zu Rundenbeginn: jede Einheit auf einem brennenden Feld verliert SILO.fireDamage LP (Abschuss fuer die Fraktion des
 * Silos, nicht die eigenen); erloschene Feuer verschwinden. Reihenfolge nach Einheiten-ID.
 * Fire at the start of the round: every unit on a burning tile loses SILO.fireDamage HP (kill for the silo's faction, not
 * own ones); extinguished fires vanish. Order by unit id.
 */
export function processFires(s: GameState, ev: GameEvent[], kit: Pick<ShadowKit, 'kill' | 'spare' | 'interrupt'>) {
  let any = false;
  for (const t of s.tiles) {
    if (!t.fire) continue;
    if (t.fire.until < s.round) { t.fire = null; continue; }
    any = true;
  }
  if (!any) return;
  const hits: { unit: number; dmg: number; x: number; y: number }[] = [];
  const burnt: { u: Unit; owner: number }[] = [];
  for (const u of [...s.units].sort((a, b) => a.id - b.id)) {
    const t = tileAt(s, u.x, u.y)!;
    if (!onFire(s, t)) continue;
    u.hp -= SILO.fireDamage;
    kit.spare(u);
    hits.push({ unit: u.id, dmg: SILO.fireDamage, x: u.x, y: u.y });
    burnt.push({ u, owner: t.fire!.owner });
  }
  if (!hits.length) return;
  ev.push({ t: 'fireHit', hits });
  for (const { u, owner } of burnt) {
    if (u.hp <= 0) {
      kit.kill(u, ev);
      if (u.owner !== owner && s.factions[owner]) s.factions[owner].kills++;
    } else kit.interrupt(u, ev);
  }
}
