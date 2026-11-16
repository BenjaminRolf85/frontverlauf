/**
 * Scharfschuetze: toedlich gegen Fusstruppen, schwach gegen Panzerung (Konter-System, UNITS.bonusVs).
 * Sniper: deadly against foot troops, weak against armour (counter system, UNITS.bonusVs).
 */
import { describe, expect, it } from 'vitest';
import { combatPreview, counterFactor, unitClass, type GameState } from '../src/core';
import type { FactionId, UnitTypeId } from '../src/data/balance';
import { addUnit, blankGame } from './helpers';

/** Ziel-Fraktion je Zieltyp (Fraktionseinheiten brauchen ihre Fraktion) / target faction per target type */
const OWNER: Partial<Record<UnitTypeId, FactionId>> = { android: 'nexus', titan: 'nexus', spider: 'nexus', grey: 'zyrr', mech: 'zyrr', zealot: 'vesper' };

/** Vorschau auf offener Ebene, beide mit vollen LP, Abstand 2 / preview on open plain, both at full HP, distance 2 */
export function sniperShot(attacker: UnitTypeId, target: UnitTypeId, hitChance: boolean, owner: FactionId = 'korvat'): ReturnType<typeof combatPreview> {
  const s: GameState = blankGame({ factions: [owner, OWNER[target] ?? 'dravon'], hitChance });
  const a = addUnit(s, attacker, 0, 2, 2);
  const d = addUnit(s, target, 1, 4, 2);
  return combatPreview(s, a, d);
}

const FOOT: UnitTypeId[] = ['infantry', 'android', 'grey', 'zealot'];
const ARMOUR: UnitTypeId[] = ['tank', 'mech', 'titan'];

describe('Scharfschuetze gegen Fusstruppen und Panzerung / sniper against foot troops and armour', () => {
  it('nutzt das Konter-System / uses the counter system', () => {
    for (const t of FOOT) expect(unitClass(t)).toBe('foot');
    for (const t of [...ARMOUR, 'jeep'] as UnitTypeId[]) expect(unitClass(t)).toBe('vehicle');
    expect(counterFactor('sniper', 'infantry')).toBeGreaterThan(1.5);
    expect(counterFactor('sniper', 'tank')).toBe(1);
    expect(counterFactor('railSniper', 'grey')).toBeGreaterThan(1);
    expect(counterFactor('railSniper', 'titan')).toBeLessThan(1);
  });

  it('7 bis 10 Schaden gegen ungepanzerte Ziele, mit und ohne Trefferglueck / 7 to 10 damage against unarmoured targets, with and without hit luck', () => {
    for (const t of FOOT) {
      const fixed = sniperShot('sniper', t, false);
      expect(fixed.toDefender, t).toBeGreaterThanOrEqual(7);
      expect(fixed.toDefender, t).toBeLessThanOrEqual(10);
      const luck = sniperShot('sniper', t, true);
      expect(luck.expected, t).toBeGreaterThanOrEqual(7);
      expect(luck.expected, t).toBeLessThanOrEqual(10);
    }
  });

  it('2 bis 3 Schaden gegen gepanzerte Ziele, mit und ohne Trefferglueck / 2 to 3 damage against armoured targets, with and without hit luck', () => {
    for (const t of ARMOUR) {
      const fixed = sniperShot('sniper', t, false);
      expect(fixed.toDefender, t).toBeGreaterThanOrEqual(2);
      expect(fixed.toDefender, t).toBeLessThanOrEqual(3);
      const luck = sniperShot('sniper', t, true);
      // fester Schaden 2 ergibt mit Trefferglueck 1,88 (Streifschuss 1, Teiltreffer 2, kritisch 3) / fixed 2 gives 1.88 with hit luck
      expect(luck.expected, t).toBeGreaterThanOrEqual(1.85);
      expect(luck.expected, t).toBeLessThanOrEqual(3);
    }
  });

  it('der Velkar-Railgun-Schuetze folgt demselben Muster / the Velkar railgun marksman follows the same pattern', () => {
    for (const t of FOOT) {
      const fixed = sniperShot('railSniper', t, false, 'velkar');
      expect(fixed.toDefender, t).toBeGreaterThanOrEqual(7);
      expect(fixed.toDefender, t).toBeLessThanOrEqual(10);
      const luck = sniperShot('railSniper', t, true, 'velkar');
      expect(luck.expected, t).toBeGreaterThanOrEqual(7);
      expect(luck.expected, t).toBeLessThanOrEqual(10);
    }
    for (const t of ARMOUR) {
      const fixed = sniperShot('railSniper', t, false, 'velkar');
      expect(fixed.toDefender, t).toBeGreaterThanOrEqual(2);
      expect(fixed.toDefender, t).toBeLessThanOrEqual(3);
      const luck = sniperShot('railSniper', t, true, 'velkar');
      // fester Schaden 2 ergibt mit Trefferglueck 1,88 (Streifschuss 1, Teiltreffer 2, kritisch 3) / fixed 2 gives 1.88 with hit luck
      expect(luck.expected, t).toBeGreaterThanOrEqual(1.85);
      expect(luck.expected, t).toBeLessThanOrEqual(3);
    }
  });

  it('der Gegenschlag des Scharfschuetzen bleibt klein / the sniper\'s return fire stays small', () => {
    // Infanterie stuermt den Scharfschuetzen im Nahkampf: er schlaegt mit seiner schwachen Verteidigung zurueck
    // infantry storms the sniper in melee: it strikes back with its weak defence
    const s = blankGame({ factions: ['dravon', 'korvat'] });
    const inf = addUnit(s, 'infantry', 0, 2, 2);
    const sn = addUnit(s, 'sniper', 1, 3, 2);
    const p = combatPreview(s, inf, sn);
    expect(p.retaliates).toBe(true);
    expect(p.toAttacker).toBeGreaterThan(0);
    expect(p.toAttacker).toBeLessThanOrEqual(2);
    // ein Panzer, der den Scharfschuetzen angreift, bekommt kaum etwas zurueck / a tank attacking the sniper gets hardly anything back
    const t = addUnit(s, 'tank', 0, 3, 3);
    expect(combatPreview(s, t, sn).toAttacker).toBeLessThanOrEqual(1);
  });
});
