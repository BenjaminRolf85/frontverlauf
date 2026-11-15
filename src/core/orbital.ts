/**
 * Orbitallaser der Velkar: Satelliten-Relay (Stadt-Ausbau) und der Schuss aus dem Orbit auf eine Flaeche von
 * ORBITAL.area Feldern. Reine Abfragen und die Anwendung des Schusses; rules.ts reicht seine internen Helfer (Tod,
 * Riss-Schonung, Wunder-Unterbrechung, Kriegsspuren) als OrbitalKit herein. Deterministisch, ohne Zufall.
 * Velkar orbital laser: satellite relay (city upgrade) and the shot from orbit on an area of ORBITAL.area tiles.
 * Pure queries and the application of the shot; rules.ts passes its internal helpers (death, rift sparing, wonder
 * interruption, war marks) in as an OrbitalKit. Deterministic, without randomness.
 */
import { CITY_UPGRADES, ORBITAL } from '../data/balance';
import { inBounds, tileAt } from './grid';
import { canSeeUnit, hasCityUpgrade, isExplored, isHostile, turretGuard, turretList, unitById } from './queries';
import type { City, ErrorCode, GameEvent, GameState, OrbitalHit, Pos, Tile, Unit } from './types';

/** Darf Fraktion f ueberhaupt ein Relay besitzen? (Velkar) / may faction f own a relay at all? (Velkar) */
export const orbitalFaction = (s: GameState, f: number): boolean =>
  !!s.factions[f] && s.factions[f].id === (CITY_UPGRADES.faction[ORBITAL.relay] ?? ORBITAL.faction);

/**
 * Stadt mit dem Relay der Fraktion f. Ein erobertes Relay gibt es nicht mehr (captureCity entfernt es), dazu
 * zaehlt es ohnehin nur fuer die Relay-Fraktion.
 * City holding faction f's relay. A captured relay no longer exists (captureCity removes it), besides it only
 * counts for the relay faction anyway.
 */
export function relayCity(s: GameState, f: number): City | null {
  if (!orbitalFaction(s, f)) return null;
  return s.cities.find((c) => c.owner === f && hasCityUpgrade(c, ORBITAL.relay)) ?? null;
}

/** Runden bis der Laser bereit ist (0 = bereit), null = kein Relay / rounds until the laser is ready (0 = ready), null = no relay */
export function orbitalWait(s: GameState, f: number): number | null {
  if (!relayCity(s, f)) return null;
  return Math.max(0, (s.factions[f].orbitalReady ?? s.round) - s.round);
}

/**
 * Linke obere Ecke der Flaeche: das Zielfeld, am Kartenrand nach innen geschoben (die Flaeche hat immer w x h Felder).
 * Top-left corner of the area: the target tile, shifted inwards at the map edge (the area always has w x h tiles).
 */
export function orbitalAnchor(s: GameState, x: number, y: number): Pos {
  const { w, h } = ORBITAL.area;
  return { x: Math.max(0, Math.min(x, s.size - w)), y: Math.max(0, Math.min(y, s.size - h)) };
}

/** Felder der Flaeche, zeilenweise ab der Ecke / tiles of the area, row by row from the corner */
export function orbitalArea(s: GameState, x: number, y: number): Pos[] {
  const a = orbitalAnchor(s, x, y);
  const out: Pos[] = [];
  for (let dy = 0; dy < ORBITAL.area.h; dy++) for (let dx = 0; dx < ORBITAL.area.w; dx++) out.push({ x: a.x + dx, y: a.y + dy });
  return out;
}

/** Besitzer eines Geschuetzes (Verdan: keiner; spaetere Stellungen koennen einen haben) / owner of a gun (Verdan: none; later emplacements may have one) */
const gunOwner = (t: Tile): number | null => (t.turret as { owner?: number } | null | undefined)?.owner ?? null;

/** Steht p in der Flaeche? / is p inside the area? */
const inArea = (tiles: Pos[], p: Pos) => tiles.some((q) => q.x === p.x && q.y === p.y);

/** Ziele in der Flaeche: Einheiten (auch Wunder ueber ihre Grundflaeche, nach ID) und Geschuetze / targets in the area: units (wonders via their footprint too, by id) and guns */
function contents(s: GameState, tiles: Pos[]): { units: Unit[]; guns: Pos[] } {
  const ids = new Set<number>();
  for (const u of s.units) if (inArea(tiles, u)) ids.add(u.id);
  for (const p of tiles) { const w = tileAt(s, p.x, p.y)?.wonderOf; if (w && unitById(s, w)) ids.add(w); }
  const units = s.units.filter((u) => ids.has(u.id)).sort((a, b) => a.id - b.id);
  const guns = tiles.filter((p) => { const t = tileAt(s, p.x, p.y); return !!t?.turret && t.turret.hp > 0; });
  return { units, guns };
}

/**
 * Wer wird getroffen? Alles in der Flaeche ausser Einheiten von Fraktionen, mit denen f nicht im Krieg ist (Frieden,
 * angekuendigter Bruch, Verbuendete); sichtbare davon sperren den Schuss (wie ein Angriff: Fehler 'peace'), verdeckte
 * werden verschont. Eigene Einheiten, Kriegsgegner, Endgegner und neutrale Geschuetze nehmen Schaden.
 * Who is hit? Everything in the area except units of factions f is not at war with (peace, announced break, allies);
 * visible ones block the shot (like an attack: error 'peace'), hidden ones are spared. Own units, enemies at war,
 * bosses and neutral guns take damage.
 */
function struck(s: GameState, f: number, tiles: Pos[]): { units: Unit[]; guns: Pos[]; blocked: boolean } {
  const all = contents(s, tiles);
  let blocked = false;
  const units = all.units.filter((u) => {
    if (u.owner === f || isHostile(s, f, u.owner)) return true;
    if (canSeeUnit(s, f, u)) blocked = true;
    return false;
  });
  const guns = all.guns.filter((p) => {
    const o = gunOwner(tileAt(s, p.x, p.y)!);
    if (o === null || o === f || isHostile(s, f, o)) return true;
    if (isExplored(s, f, p.x, p.y)) blocked = true;
    return false;
  });
  return { units, guns, blocked };
}

/** Darf f jetzt auf (x, y) schiessen? / may f fire at (x, y) now? */
export function orbitalCheck(s: GameState, f: number, x: number, y: number): 'ok' | ErrorCode {
  if (s.over) return 'gameOver';
  if (!orbitalFaction(s, f)) return 'wrongFaction';
  if (!relayCity(s, f)) return 'noRelay';
  if (!inBounds(s.size, x, y)) return 'invalidTile';
  if ((orbitalWait(s, f) ?? 0) > 0) return 'orbitalCooldown';
  // Sicht gilt fuer das Zielfeld; der Rest der Flaeche wird auch im Nebel getroffen / vision applies to the target tile; the rest of the area is hit even in fog
  if (ORBITAL.needsVision && !isExplored(s, f, x, y)) return 'notVisible';
  if (struck(s, f, orbitalArea(s, x, y)).blocked) return 'peace';
  return 'ok';
}

export interface OrbitalPreview {
  /** Felder der Flaeche / tiles of the area */
  tiles: Pos[];
  /** sichtbare Treffer aus Sicht von f / visible hits from f's point of view */
  hits: (OrbitalHit & { own: boolean })[];
  check: 'ok' | ErrorCode;
}

/**
 * Vorschau fuer die Zielauswahl: nur was f sieht (verdeckte Feinde bleiben verdeckt), mit Schaden und Abschuss.
 * Preview for targeting: only what f sees (hidden enemies stay hidden), with damage and kill.
 */
export function orbitalPreview(s: GameState, f: number, x: number, y: number): OrbitalPreview {
  const tiles = orbitalArea(s, x, y);
  const st = struck(s, f, tiles);
  const dmg = ORBITAL.damage;
  const hits: OrbitalPreview['hits'] = [];
  for (const u of st.units) {
    if (!canSeeUnit(s, f, u)) continue;
    hits.push({ unit: u.id, x: u.x, y: u.y, dmg, killed: u.hp <= dmg, own: u.owner === f });
  }
  for (const p of st.guns) {
    if (!isExplored(s, f, p.x, p.y)) continue;
    const t = tileAt(s, p.x, p.y)!;
    hits.push({ turret: true, x: p.x, y: p.y, dmg, killed: t.turret!.hp <= dmg, own: gunOwner(t) === f });
  }
  return { tiles, hits, check: orbitalCheck(s, f, x, y) };
}

/** Bauen des Relays: Aufladezeit beginnt / building the relay: the charge time starts */
export function relayBuilt(s: GameState, f: number) {
  s.factions[f].orbitalReady = s.round + ORBITAL.cooldown;
}

/** Interne Helfer aus rules.ts / internal helpers from rules.ts */
export interface OrbitalKit {
  kill(u: Unit, ev: GameEvent[]): void;
  spare(u: Unit): void;
  interrupt(u: Unit, ev: GameEvent[]): void;
  mark(x: number, y: number): void;
  /** Geschuetz getroffen: Linie wecken / gun hit: wake the line */
  wake(p: Pos, ev: GameEvent[]): void;
}

/**
 * Schuss anwenden (orbitalCheck vorher 'ok'): fester Schaden ohne Wurf, Abschuesse zaehlen fuer f (nicht eigene),
 * keine Befoerderung; Geschuetze werden zu Truemmern. Danach Abklingzeit.
 * Apply the shot (orbitalCheck 'ok' beforehand): flat damage without a roll, kills count for f (not own ones),
 * no promotion; guns become rubble. Then the cooldown.
 */
export function fireOrbital(s: GameState, f: number, x: number, y: number, ev: GameEvent[], kit: OrbitalKit) {
  const fa = s.factions[f];
  const tiles = orbitalArea(s, x, y);
  const anchor = tiles[0];
  const st = struck(s, f, tiles);
  const dmg = ORBITAL.damage;
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
    if (destroyed) { t.turret = null; t.turretRuin = true; } else if (!gun.active) kit.wake(p, ev);
  }
  for (const p of tiles) kit.mark(p.x, p.y);
  fa.orbitalReady = s.round + ORBITAL.cooldown;
  if (st.units.some((u) => u.owner !== f) || st.guns.length) fa.lastAttackRound = s.round;
  ev.push({ t: 'orbitalStrike', faction: f, x: anchor.x, y: anchor.y, tiles, hits });
  for (const u of st.units) {
    if (u.hp <= 0) {
      kit.kill(u, ev);
      // Abschuss fuer die Fraktion, keine Befoerderung (kein Schuetze) / kill for the faction, no promotion (no shooter)
      if (u.owner !== f) fa.kills++;
    } else kit.interrupt(u, ev);
  }
}

/** Geschuetze desselben bewachten Punkts wecken / wake the guns of the same guarded point */
export function wakeGunsAt(s: GameState, p: Pos): boolean {
  const g = turretGuard(s, p);
  let woke = false;
  for (const q of turretList(s)) {
    const gq = turretGuard(s, q);
    const t = tileAt(s, q.x, q.y)!.turret!;
    if (gq.x === g.x && gq.y === g.y && !t.active && gunOwner(tileAt(s, q.x, q.y)!) === null) { t.active = true; woke = true; }
  }
  return woke;
}
