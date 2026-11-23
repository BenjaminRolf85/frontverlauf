/**
 * Goettlicher Funke (Alvenia, SPARK): Riesengeschuetz mit Flaechenschuss auf 2x2 Felder, Reichweite 5. Reine Abfragen und
 * die Anwendung des Schusses; rules.ts reicht seine internen Helfer (Tod, Riss-Schonung, Wunder-Unterbrechung, Kriegsspuren,
 * Geschuetze wecken) als OrbitalKit herein. Das Trefferglueck wuerfelt jedes Ziel einzeln aus dem Zufallsstrom der Partie.
 * Divine Spark (Alvenia, SPARK): giant gun with an area shot on 2x2 tiles, range 5. Pure queries and the application of the
 * shot; rules.ts passes its internal helpers (death, rift sparing, wonder interruption, war marks, waking guns) in as an
 * OrbitalKit. Hit luck is rolled for every target separately from the game's random stream.
 */
import { SPARK } from '../data/balance';
import { faceTowards } from './facing';
import { dist, inBounds, tileAt } from './grid';
import { areaStruck, gunOwner, type OrbitalKit } from './orbital';
import { canSeeUnit, has, hitChanceOn, hitDamage, hitOdds, isExplored, movedThisTurn, rollHit, sightedBy, trueOwner } from './queries';
import { nextRandom } from './rng';
import type { HitKind } from '../data/balance';
import type { ErrorCode, GameEvent, GameState, OrbitalHit, Pos, Unit } from './types';

/** Ist u ein Goettlicher Funke? / is u a Divine Spark? */
export const isSpark = (u: Unit): boolean => has(u, 'divineSpark');

/** Darf Fraktion f den Funken bauen und abfeuern? (Alvenia) / may faction f build and fire the spark? (Alvenia) */
export const sparkFaction = (s: GameState, f: number): boolean => s.factions[f]?.id === SPARK.faction;

/** Geschuetze der Fraktion f (uebernommene beim eigentlichen Besitzer) / guns of faction f (taken-over ones with the actual owner) */
export const sparksOf = (s: GameState, f: number): Unit[] => s.units.filter((u) => u.type === SPARK.unit && trueOwner(u) === f);

/** Runden bis zum naechsten Schuss (0 = bereit) / rounds until the next shot (0 = ready) */
export const sparkWait = (s: GameState, u: Unit): number => Math.max(0, (u.sparkReady ?? s.round) - s.round);

/** Felder der Flaeche ab der linken oberen Ecke (x, y), zeilenweise / tiles of the area from the top-left corner (x, y), row by row */
export function sparkArea(x: number, y: number): Pos[] {
  const out: Pos[] = [];
  for (let dy = 0; dy < SPARK.area.h; dy++) for (let dx = 0; dx < SPARK.area.w; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

/**
 * Lage der Flaeche mit Ecke (x, y) zum Geschuetz g: ganz auf der Karte, kein Feld naeher als minRange, keines weiter als range.
 * Position of the area with corner (x, y) relative to the gun g: entirely on the map, no tile closer than minRange, none
 * further than range.
 */
export function sparkGeometry(s: GameState, g: Pos, x: number, y: number): 'ok' | 'invalidTile' | 'outOfRange' | 'sparkTooClose' {
  const tiles = sparkArea(x, y);
  if (tiles.some((p) => !inBounds(s.size, p.x, p.y))) return 'invalidTile';
  if (tiles.some((p) => dist(g, p) < SPARK.minRange)) return 'sparkTooClose';
  if (tiles.some((p) => dist(g, p) > SPARK.range)) return 'outOfRange';
  return 'ok';
}

/**
 * Ecke der Flaeche fuer ein angetipptes Feld (x, y): die erste der vier Flaechen, die (x, y) enthalten und gueltig liegen
 * (zuerst (x, y) als linke obere Ecke, dann nach links, nach oben, diagonal); keine gueltig: (x, y) am Kartenrand nach innen
 * geschoben. Das angetippte Feld liegt so immer in der Flaeche, wo das moeglich ist.
 * Corner of the area for a tapped tile (x, y): the first of the four areas that contain (x, y) and lie validly (first (x, y)
 * as the top-left corner, then to the left, upwards, diagonally); none valid: (x, y) shifted inwards at the map edge. The
 * tapped tile thus always lies inside the area where possible.
 */
export function sparkAnchorFor(s: GameState, g: Pos, x: number, y: number): Pos {
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const a = { x: x + dx * (SPARK.area.w - 1), y: y + dy * (SPARK.area.h - 1) };
    if (sparkGeometry(s, g, a.x, a.y) === 'ok') return a;
  }
  return { x: Math.max(0, Math.min(x, s.size - SPARK.area.w)), y: Math.max(0, Math.min(y, s.size - SPARK.area.h)) };
}

/** Felder im Wirkungsbereich des Geschuetzes (Abstand minRange bis range) / tiles in the gun's reach (distance minRange to range) */
export function sparkReach(s: GameState, g: Pos): Pos[] {
  const out: Pos[] = [];
  for (let y = g.y - SPARK.range; y <= g.y + SPARK.range; y++) for (let x = g.x - SPARK.range; x <= g.x + SPARK.range; x++) {
    if (!inBounds(s.size, x, y)) continue;
    const d = dist(g, { x, y });
    if (d >= SPARK.minRange && d <= SPARK.range) out.push({ x, y });
  }
  return out;
}

/**
 * Beobachter: eine andere eigene Einheit oder eine eigene Stadt hoechstens SPARK.spot Felder von einem Feld der Flaeche,
 * oder ein Radarimpuls bzw. eine Drohnensichtung ueber einem Feld der Flaeche.
 * Spotter: another own unit or an own city at most SPARK.spot tiles from a tile of the area, or a radar sweep or drone
 * sighting over a tile of the area.
 */
export function sparkSpotted(s: GameState, f: number, gunId: number, tiles: Pos[]): boolean {
  const near = (p: Pos) => tiles.some((q) => dist(p, q) <= SPARK.spot);
  if (s.units.some((o) => o.owner === f && o.id !== gunId && near(o))) return true;
  if (s.cities.some((c) => c.owner === f && near(c))) return true;
  return tiles.some((p) => sightedBy(s, f, p));
}

/**
 * Darf das Geschuetz u jetzt auf die Flaeche mit Ecke (x, y) feuern? Reihenfolge der Gruende: Spielende, keine Faehigkeit,
 * falsche Fraktion, frisch, gezogen, erschoepft, laedt nach, Lage der Flaeche, Beobachter, Frieden.
 * May the gun u fire at the area with corner (x, y) now? Order of reasons: game over, no ability, wrong faction, fresh,
 * moved, exhausted, recharging, position of the area, spotter, peace.
 */
export function sparkCheck(s: GameState, u: Unit, x: number, y: number): 'ok' | ErrorCode {
  if (s.over) return 'gameOver';
  if (!isSpark(u)) return 'cannotAttack';
  if (!sparkFaction(s, u.owner) || u.hijack) return 'wrongFaction';
  if (u.fresh) return 'fresh';
  if (movedThisTurn(u)) return 'sparkMoved';
  if (u.attacked || u.exhausted) return 'unitExhausted';
  if (sparkWait(s, u) > 0) return 'sparkCooldown';
  const geo = sparkGeometry(s, u, x, y);
  if (geo !== 'ok') return geo;
  const tiles = sparkArea(x, y);
  if (!sparkSpotted(s, u.owner, u.id, tiles)) return 'noSpotter';
  if (areaStruck(s, u.owner, tiles).blocked) return 'peace';
  return 'ok';
}

/**
 * Grund, warum das Geschuetz gerade gar nicht feuern kann (ohne Ziel), sonst 'ok'.
 * Reason why the gun cannot fire at all right now (without a target), else 'ok'.
 */
export function sparkReady(s: GameState, u: Unit): 'ok' | ErrorCode {
  if (s.over) return 'gameOver';
  if (!isSpark(u)) return 'cannotAttack';
  if (!sparkFaction(s, u.owner) || u.hijack) return 'wrongFaction';
  if (u.fresh) return 'fresh';
  if (movedThisTurn(u)) return 'sparkMoved';
  if (u.attacked || u.exhausted) return 'unitExhausted';
  if (sparkWait(s, u) > 0) return 'sparkCooldown';
  return 'ok';
}

export interface SparkPreview {
  /** Felder der Flaeche / tiles of the area */
  tiles: Pos[];
  /** sichtbare Treffer aus Sicht des Besitzers (Schaden bei vollem Treffer) / visible hits from the owner's view (damage on a full hit) */
  hits: (OrbitalHit & { own: boolean })[];
  check: 'ok' | ErrorCode;
}

/**
 * Vorschau fuer die Zielauswahl: nur was der Besitzer sieht, Schaden bei vollem Treffer, Abschuss wenn er reicht.
 * Preview for targeting: only what the owner sees, damage on a full hit, kill if it suffices.
 */
export function sparkPreview(s: GameState, u: Unit, x: number, y: number): SparkPreview {
  const f = u.owner;
  const tiles = sparkArea(x, y);
  const onMap = tiles.filter((p) => inBounds(s.size, p.x, p.y));
  const st = areaStruck(s, f, onMap);
  const dmg = SPARK.damage;
  const hits: SparkPreview['hits'] = [];
  for (const o of st.units) {
    if (!canSeeUnit(s, f, o)) continue;
    hits.push({ unit: o.id, x: o.x, y: o.y, dmg, killed: o.hp <= dmg, own: o.owner === f });
  }
  for (const p of st.guns) {
    if (!isExplored(s, f, p.x, p.y)) continue;
    const t = tileAt(s, p.x, p.y)!;
    hits.push({ turret: true, x: p.x, y: p.y, dmg, killed: t.turret!.hp <= dmg, own: gunOwner(t) === f });
  }
  return { tiles, hits, check: sparkCheck(s, u, x, y) };
}

/**
 * Schuss anwenden (sparkCheck vorher 'ok'): jedes Ziel wuerfelt sein Trefferglueck (Grundschaden SPARK.damage), Abschuesse
 * zaehlen fuer den Besitzer und das Geschuetz (nicht eigene), keine Befoerderung; Geschuetze werden zu Truemmern. Danach ist
 * das Geschuetz erschoepft und laedt SPARK.cooldown Runden.
 * Apply the shot (sparkCheck 'ok' beforehand): every target rolls its hit luck (base damage SPARK.damage), kills count for
 * the owner and the gun (not own ones), no promotion; guns become rubble. Then the gun is exhausted and recharges for
 * SPARK.cooldown rounds.
 */
export function fireSpark(s: GameState, u: Unit, x: number, y: number, ev: GameEvent[], kit: OrbitalKit) {
  const f = u.owner;
  const fa = s.factions[f];
  const tiles = sparkArea(x, y);
  const st = areaStruck(s, f, tiles);
  const roll = (target?: Unit): HitKind => (hitChanceOn(s) ? rollHit(hitOdds(s, u, true, target), nextRandom(s)) : 'full');
  const hits: (OrbitalHit & { hit?: HitKind })[] = [];
  for (const o of st.units) {
    const hit = roll(o);
    const dmg = hitDamage(SPARK.damage, hit);
    o.hp -= dmg;
    kit.spare(o);
    hits.push({ unit: o.id, x: o.x, y: o.y, dmg, killed: o.hp <= 0, hit });
  }
  for (const p of st.guns) {
    const t = tileAt(s, p.x, p.y)!;
    const gun = t.turret!;
    const hit = roll();
    const dmg = hitDamage(SPARK.damage, hit);
    gun.hp = Math.max(0, gun.hp - dmg);
    const destroyed = gun.hp <= 0;
    hits.push({ turret: true, x: p.x, y: p.y, dmg, killed: destroyed, hit });
    // Truemmer einer Geschuetzstellung merken sich den Besitzer (Optik) / rubble of a gun emplacement remembers the owner (look)
    if (destroyed) { const o = gunOwner(t); t.turret = null; t.turretRuin = true; if (o !== null) t.turretRuinOwner = o; } else if (!gun.active && dmg > 0) kit.wake(p, ev);
  }
  for (const p of tiles) kit.mark(p.x, p.y);
  // Geschuetz zur Flaeche drehen, erschoepft, Nachladen / turn the gun towards the area, exhausted, recharge
  faceTowards(u, { x: x + (SPARK.area.w - 1) / 2, y: y + (SPARK.area.h - 1) / 2 });
  u.attacked = true;
  u.exhausted = true;
  u.sparkReady = s.round + SPARK.cooldown;
  if (st.units.some((o) => o.owner !== f) || st.guns.length) fa.lastAttackRound = s.round;
  ev.push({ t: 'divineSpark', unit: u.id, faction: f, from: { x: u.x, y: u.y }, x, y, tiles, hits });
  for (const o of st.units) {
    if (o.hp <= 0) {
      kit.kill(o, ev);
      // Abschuss fuer Fraktion und Geschuetz, keine Befoerderung / kill for the faction and the gun, no promotion
      if (o.owner !== f) { fa.kills++; u.kills++; }
    } else kit.interrupt(o, ev);
  }
}
