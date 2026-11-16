/**
 * Ausrichtung der Einheiten und Angriffe von hinten (COMBAT.rearAttack).
 * Ausrichtung = eine der 8 Nachbarrichtungen des Schachbrett-Gitters, 0 = Norden (y - 1), im Uhrzeigersinn.
 * Fehlt Unit.facing (alte Spielstaende, Bauwerke), ist die Ausrichtung unbekannt: nie "von hinten".
 * Facing of units and attacks from behind (COMBAT.rearAttack).
 * Facing = one of the 8 neighbour directions of the square grid, 0 = north (y - 1), clockwise.
 * Without Unit.facing (old saves, structures) the facing is unknown: never "from behind".
 */
import { COMBAT, UNITS } from '../data/balance';
import type { Pos, Unit } from './types';

/** Richtungsvektoren je Ausrichtung (0 = Norden, im Uhrzeigersinn) / direction vectors per facing (0 = north, clockwise) */
export const FACING_DIRS: readonly Pos[] = [
  { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
];

/**
 * Kann sich die Einheit drehen? Bauwerke und Wunder (auch der Erdkernbohrer) und alles ohne Bewegung nicht.
 * Can the unit turn? Structures and wonders (the earth-core drill too) and anything without movement cannot.
 */
export function canFace(u: Pick<Unit, 'type'>): boolean {
  const st = UNITS[u.type];
  return st.move > 0 && !st.abilities.includes('wonder');
}

/**
 * Ausrichtung von from nach to, auf die naechste der 8 Richtungen gerundet (auch fuer Ziele in Reichweite 2+);
 * undefined bei gleichem Feld.
 * Facing from from towards to, rounded to the nearest of the 8 directions (also for targets at range 2+);
 * undefined on the same tile.
 */
export function facingTowards(from: Pos, to: Pos): number | undefined {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy === 0) return undefined;
  // Winkel im Uhrzeigersinn ab Norden (y waechst nach Sueden) / clockwise angle from north (y grows southwards)
  const a = Math.atan2(dx, -dy);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

/**
 * Steht ein Angreifer auf from im Rueckenbereich von def? Rueckenbereich = mindestens 135 Grad von der Blickrichtung
 * entfernt: im Nahkampf die drei Felder hinter der Einheit, auf Distanz derselbe Kegel (90 Grad, Rand eingeschlossen).
 * Flanken (90 Grad) zaehlen nicht. Ohne Ausrichtung oder bei Bauwerken nie.
 * Is an attacker on from in def's rear arc? Rear arc = at least 135 degrees away from the facing: in melee the three
 * tiles behind the unit, at range the same cone (90 degrees, edges included). Flanks (90 degrees) do not count.
 * Never without a facing or for structures.
 */
export function inRearArc(def: Pick<Unit, 'type' | 'x' | 'y' | 'facing'>, from: Pos): boolean {
  if (def.facing === undefined || def.facing === null || !canFace(def)) return false;
  const f = FACING_DIRS[def.facing];
  if (!f) return false;
  const vx = from.x - def.x, vy = from.y - def.y;
  if (vx === 0 && vy === 0) return false;
  // Winkel >= 135 Grad <=> dot < 0 und dot^2 >= |f|^2 |v|^2 / 2 (ganzzahlig, ohne Rundungsfehler)
  // angle >= 135 degrees <=> dot < 0 and dot^2 >= |f|^2 |v|^2 / 2 (integer, no rounding errors)
  const dot = f.x * vx + f.y * vy;
  if (dot >= 0) return false;
  return 2 * dot * dot >= (f.x * f.x + f.y * f.y) * (vx * vx + vy * vy);
}

/**
 * Zusatzschaden fuer einen Angriff von att auf def (0 = keiner, sonst COMBAT.rearAttack). Es zaehlt die Ausrichtung
 * des Verteidigers vor dem Angriff. Nur fuer den eigenen Angriff, nie fuer den Gegenschlag.
 * Extra damage for an attack by att on def (0 = none, else COMBAT.rearAttack). The defender's facing before the
 * attack counts. Only for one's own attack, never for return fire.
 */
export function rearAttackBonus(att: Pos, def: Pick<Unit, 'type' | 'x' | 'y' | 'facing'>): number {
  return inRearArc(def, att) ? COMBAT.rearAttack : 0;
}

/**
 * Ausrichtung u nach to setzen (nur Einheiten, die sich drehen koennen; gleiches Feld aendert nichts).
 * Turn u towards to (only units that can turn; the same tile changes nothing).
 */
export function faceTowards(u: Unit, to: Pos): void {
  if (!canFace(u)) return;
  const f = facingTowards(u, to);
  if (f !== undefined) u.facing = f;
}

/**
 * Ausrichtung neuer Einheiten: zur Kartenmitte (dort liegt meist die Front); in der Mitte selbst nach Sueden.
 * Facing of new units: towards the map centre (where the front usually is); at the centre itself south.
 */
export function spawnFacing(size: number, u: Unit): void {
  if (!canFace(u)) return;
  const c = (size - 1) / 2;
  u.facing = facingTowards(u, { x: c, y: c }) ?? 4;
}
