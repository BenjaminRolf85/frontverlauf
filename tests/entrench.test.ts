/**
 * Korvat verschanzt sich: wer einen ganzen eigenen Zug stillsteht, wird seltener getroffen (ENTRENCH).
 * Korvat entrenches: a unit standing still for a whole own turn is hit less often (ENTRENCH).
 */
import { describe, expect, it } from 'vitest';
import { combatPreview, entrenchMiss, expectedHitMult, hitOdds, isEntrenched, turretShotDamage } from '../src/core';
import { ENTRENCH, HIT, VERDAN } from '../src/data/balance';
import { expectedDamage, buildCtx } from '../src/ai/analysis';
import { combatBonusTexts } from '../src/ui/factionInfo';
import { addCity, addUnit, blankGame, endTurn, ok, untilTurnOf } from './helpers';

function g(hitChance = true) {
  const s = blankGame({ factions: ['korvat', 'dravon'], hitChance, size: 14 });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 12, 12, 1, { hq: true });
  return s;
}

describe('Verschanzen / entrenching', () => {
  it('ein ganzer eigener Zug ohne Bewegung verschanzt, die naechste Bewegung beendet es / a whole own turn without moving entrenches, the next move ends it', () => {
    const s = g();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const b = addUnit(s, 'infantry', 0, 7, 7);
    expect(isEntrenched(s, a)).toBe(false);
    ok(s, { type: 'move', unit: b.id, to: { x: 7, y: 8 } });
    endTurn(s);
    // am Ende des eigenen Zuges: a stand still, b ist gezogen / at the end of the own turn: a stood still, b moved
    expect(isEntrenched(s, a)).toBe(true);
    expect(isEntrenched(s, b)).toBe(false);
    expect(entrenchMiss(s, a)).toBe(ENTRENCH.bonus.korvat);
    untilTurnOf(s, 0);
    // weiter verschanzt, auch nach einem Angriff ohne Bewegung; die Bewegung beendet es / still entrenched; moving ends it
    expect(isEntrenched(s, a)).toBe(true);
    ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 6 } });
    expect(isEntrenched(s, a)).toBe(false);
    endTurn(s);
    expect(isEntrenched(s, a)).toBe(false);
    expect(isEntrenched(s, b)).toBe(true);
  });

  it('frisch ausgebildete Einheiten, Schiffe, Flieger und andere Fraktionen nicht / not freshly trained units, ships, flyers or other factions', () => {
    const s = g();
    const fresh = addUnit(s, 'infantry', 0, 5, 5, { fresh: true });
    const heli = addUnit(s, 'heli', 0, 6, 6, { fuel: 4 });
    const foe = addUnit(s, 'infantry', 1, 9, 9);
    endTurn(s);
    expect(isEntrenched(s, fresh)).toBe(false);
    expect(isEntrenched(s, heli)).toBe(false);
    endTurn(s);
    expect(isEntrenched(s, foe)).toBe(false);
    expect(foe.entrenched).toBeUndefined();
    // im naechsten eigenen Zug steht die neue Einheit still: dann verschanzt / next own turn the new unit stands still: then entrenched
    endTurn(s);
    expect(isEntrenched(s, fresh)).toBe(true);
  });

  it('Trefferglueck: +20 Punkte daneben, von den vollen Treffern / hit luck: +20 points miss, taken from full hits', () => {
    const s = g();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const foe = addUnit(s, 'infantry', 1, 6, 5);
    const before = combatPreview(s, foe, a);
    a.entrenched = true;
    const o = hitOdds(s, foe, false, a);
    // Dravon-Schuetze: Gezielter Schuss schon abgezogen / Dravon shooter: aimed shot already moved
    const base = hitOdds(s, foe);
    expect(o.miss).toBeCloseTo(base.miss + 0.2, 9);
    expect(o.full).toBeCloseTo(base.full - 0.2, 9);
    expect(base.miss).toBe(HIT.odds.human.miss);
    const after = combatPreview(s, foe, a);
    expect(after.entrenched).toBe(0.2);
    expect(after.toDefender).toBe(before.toDefender);
    expect(after.expected).toBeLessThan(before.expected);
    // gilt fuer jeden Angriff auf sie: auch der Gegenschlag auf einen verschanzten Angreifer / any attack on it: return fire on an entrenched attacker too
    const atk = combatPreview(s, a, foe);
    a.entrenched = false;
    const atkOpen = combatPreview(s, a, foe);
    expect(atk.expectedRet).toBeLessThan(atkOpen.expectedRet);
  });

  it('ohne Trefferglueck sinkt der Schaden um den Erwartungswert / without hit luck damage drops by the expected value', () => {
    const s = g(false);
    const a = addUnit(s, 'mg', 0, 5, 5);
    const foe = addUnit(s, 'tank', 1, 6, 5);
    const open = combatPreview(s, foe, a).toDefender;
    a.entrenched = true;
    const dug = combatPreview(s, foe, a).toDefender;
    const human = HIT.odds.human;
    const factor = expectedHitMult({ ...human, full: human.full - 0.2, miss: human.miss + 0.2 }) / expectedHitMult(human);
    expect(factor).toBeCloseTo(0.778, 2);
    expect(dug).toBeLessThan(open);
    expect(Math.abs(dug - open * factor)).toBeLessThanOrEqual(1);
    // auch Geschuetze treffen weniger / guns hit less as well
    a.entrenched = false;
    const gunOpen = turretShotDamage(s, VERDAN.hp, a);
    a.entrenched = true;
    expect(turretShotDamage(s, VERDAN.hp, a)).toBeLessThan(gunOpen);
  });

  it('die KI rechnet damit / the AI accounts for it', () => {
    const s = g();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    addUnit(s, 'mg', 1, 6, 6);
    s.factions[0].explored = s.factions[0].explored.map(() => 1);
    const open = expectedDamage(buildCtx(s, 0), a, 5, 5);
    a.entrenched = true;
    const dug = expectedDamage(buildCtx(s, 0), a, 5, 5);
    expect(dug).toBeLessThan(open);
  });

  it('alte Spielstaende ohne Feld, Fraktionsmerkmal mit Zahl / old saves without the field, faction trait with the number', () => {
    const s = g();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const old = JSON.parse(JSON.stringify(s));
    expect(old.units.find((u: { id: number }) => u.id === a.id).entrenched).toBeUndefined();
    expect(isEntrenched(old, old.units.find((u: { id: number }) => u.id === a.id))).toBe(false);
    expect(combatBonusTexts('korvat').map((b) => b.desc).join(' ')).toContain('20');
    expect(combatBonusTexts('dravon').some((b) => b.desc.includes('20 '))).toBe(false);
  });
});
