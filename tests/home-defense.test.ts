/**
 * Friedensbollwerk (Alvenia): +25 % Verteidigung auf eigenem Gebiet, nur wenn angegriffen.
 * Peace Bulwark (Alvenia): +25 % defence on own territory, only when attacked.
 */
import { describe, expect, it } from 'vitest';
import { combatPreview, counterFactor, hitDamage, homeDefenseAt, returnFire, turretShotDamage, type GameState } from '../src/core';
import { COMBAT, FACTION_IDS, HOME_DEFENSE, UNITS, VERDAN, type FactionId } from '../src/data/balance';
import { buildCtx, defBonusAt } from '../src/ai/analysis';
import { attackValue } from '../src/ai/tactics';
import { addCity, addUnit, blankGame, ok, revealAll } from './helpers';

type Ground = 'own' | 'neutral' | 'foreign';

/** Dravon-Panzer (5,5) gegen Alvenia-Infanterie (6,5) auf eigenem, neutralem oder fremdem Gebiet / Dravon tank vs Alvenia infantry on own, neutral or foreign ground */
function setup(ground: Ground, o: { defender?: FactionId; hitChance?: boolean } = {}) {
  const def = o.defender ?? 'alvenia';
  const s: GameState = blankGame({ factions: ['dravon', def], size: 11, hitChance: o.hitChance ?? false });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
  // Stadt ohne Einheit daneben: nur ihr Gebiet zaehlt (Feld 6,5 ist kein Stadtfeld) / city next to it: only its territory counts (6,5 is no city tile)
  if (ground === 'own') addCity(s, 7, 5, 1, { radius: 1 });
  if (ground === 'foreign') addCity(s, 7, 5, 0, { radius: 1 });
  revealAll(s, 0); revealAll(s, 1);
  const a = addUnit(s, 'tank', 0, 5, 5);
  const d = addUnit(s, 'infantry', 1, 6, 5);
  return { s, a, d };
}

const raw = (bonus: number) =>
  Math.round((UNITS.tank.attack / (UNITS.tank.attack + UNITS.infantry.defense * (1 + bonus))) * UNITS.tank.attack * COMBAT.damageFactor * counterFactor('tank', 'infantry'));

describe('Friedensbollwerk / Peace Bulwark', () => {
  it('wirkt auf eigenem Gebiet / active on own territory', () => {
    const { s, a, d } = setup('own');
    expect(HOME_DEFENSE.bonus.alvenia).toBe(0.25);
    expect(homeDefenseAt(s, d)).toBe(0.25);
    const pre = combatPreview(s, a, d);
    expect(pre.homeDefense).toBe(0.25);
    expect(pre.toDefender).toBe(raw(0.25));
    expect(pre.toDefender).toBeLessThan(combatPreview(setup('neutral').s, a, d).toDefender);
  });

  it('wirkt nicht auf neutralem oder fremdem Gebiet / inactive on neutral or foreign tiles', () => {
    for (const g of ['neutral', 'foreign'] as Ground[]) {
      const { s, a, d } = setup(g);
      expect(homeDefenseAt(s, d), g).toBe(0);
      const pre = combatPreview(s, a, d);
      expect(pre.homeDefense).toBe(0);
      expect(pre.toDefender).toBe(raw(0));
    }
  });

  it('wirkt nicht beim eigenen Angriff und nicht auf den Gegenschlag / inactive when attacking and for return fire', () => {
    const own = setup('own'), neutral = setup('neutral');
    // Alvenia greift von eigenem Gebiet an: Schaden wie auf neutralem Feld / Alvenia attacks from own territory: damage as on a neutral tile
    expect(combatPreview(own.s, own.d, own.a).toDefender).toBe(combatPreview(neutral.s, neutral.d, neutral.a).toDefender);
    // Gegenschlag des Verteidigers bei gleichen LP unveraendert / defender's return fire unchanged at equal HP
    for (const hp of [10, 6, 3]) expect(returnFire(own.s, own.a, own.d, hp)).toBe(returnFire(neutral.s, neutral.a, neutral.d, hp));
  });

  it('Vorschau entspricht dem echten Schaden, auch mit Trefferglueck / preview equals the actual damage, also with hit luck', () => {
    for (const hitChance of [false, true]) {
      for (let k = 0; k < 4; k++) {
        const { s, a, d } = setup('own', { hitChance });
        s.rng = (s.rng ^ Math.imul(k + 3, 0x9e3779b1)) | 0;
        const pre = combatPreview(s, a, d);
        const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
        const ev = r.events.find((e) => e.t === 'attack') as { dmg: number; hit?: 'miss' | 'graze' | 'partial' | 'full' | 'crit' };
        expect(ev.dmg).toBe(hitChance ? hitDamage(pre.toDefender, ev.hit!) : pre.toDefender);
      }
    }
  });

  it('auch gegen Verdan-Geschuetze / also against Verdan guns', () => {
    const own = setup('own'), neutral = setup('neutral');
    expect(turretShotDamage(own.s, VERDAN.hp, own.d)).toBeLessThanOrEqual(turretShotDamage(neutral.s, VERDAN.hp, neutral.d));
  });

  it('andere Fraktionen bleiben unberuehrt / other factions unaffected', () => {
    for (const f of FACTION_IDS.filter((x) => x !== 'alvenia' && x !== 'dravon')) {
      const { s, a, d } = setup('own', { defender: f });
      expect(homeDefenseAt(s, d), f).toBe(0);
      expect(combatPreview(s, a, d).homeDefense).toBe(0);
    }
  });

  it('KI: Alvenia schaetzt eigenes Gebiet, Gegner sehen das Bollwerk / AI: Alvenia values own ground, enemies see the bulwark', () => {
    const own = setup('own'), neutral = setup('neutral');
    // zaeher Verteidiger, damit der Angriff nicht in beiden Faellen sicher vernichtet / tough defender so the attack does not kill in both cases
    for (const g of [own, neutral]) { g.s.factions.forEach((f) => { f.human = false; }); Object.assign(g.d, { type: 'tank', hp: UNITS.tank.hp, maxHp: UNITS.tank.hp }); }
    expect(defBonusAt(buildCtx(own.s, 1), own.d, 6, 5)).toBeGreaterThan(defBonusAt(buildCtx(neutral.s, 1), neutral.d, 6, 5));
    expect(attackValue(buildCtx(own.s, 0), own.a, own.d)).toBeLessThan(attackValue(buildCtx(neutral.s, 0), neutral.a, neutral.d));
  });
});
