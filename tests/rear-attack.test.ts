/**
 * Angriff von hinten: Ausrichtung als Spielzustand (Bewegung, Angriff, Gegenschlag, neue Einheiten), Rueckenbereich
 * (Nahkampf, diagonal, Fernkampf), +50 % in Vorschau und echtem Schaden (mit und ohne Trefferglueck), kein Bonus ohne
 * Ausrichtung (alte Spielstaende, Bauwerke), kein Bonus auf den Gegenschlag.
 * Attack from behind: facing as game state (move, attack, return fire, new units), rear arc (melee, diagonal, ranged),
 * +50 % in preview and real damage (with and without hit luck), no bonus without a facing (old saves, structures),
 * no bonus on return fire.
 */
import { describe, expect, it } from 'vitest';
import {
  FACING_DIRS, canFace, combatPreview, facingTowards, hitDamage, inRearArc, rearAttackBonus, returnFire, type GameState, type Unit,
} from '../src/core';
import { COMBAT, type FactionId, type UnitTypeId } from '../src/data/balance';
import { isValidState, migrateState } from '../src/save/save';
import { addCity, addUnit, blankGame, giveSites, ok, revealAll, unit } from './helpers';

function game(factions: FactionId[] = ['alvenia', 'dravon'], hitChance = false): GameState {
  const s = blankGame({ factions, size: 11, hitChance });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

/** Ziel auf (5,5) mit Ausrichtung / target on (5,5) with a facing */
const at = (facing: number | undefined, type: UnitTypeId = 'infantry'): Pick<Unit, 'type' | 'x' | 'y' | 'facing'> => ({ type, x: 5, y: 5, facing });
const N = 0, NE = 1, E = 2, SE = 3, S = 4, SW = 5, W = 6, NW = 7;

describe('Ausrichtung / facing', () => {
  it('Richtungen: 0 = Norden, im Uhrzeigersinn; auf Distanz gerundet / directions: 0 = north, clockwise; rounded at range', () => {
    expect(FACING_DIRS).toHaveLength(8);
    FACING_DIRS.forEach((d, i) => expect(facingTowards({ x: 5, y: 5 }, { x: 5 + d.x, y: 5 + d.y })).toBe(i));
    expect(facingTowards({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeUndefined();
    // Springerzug: naechste Richtung / knight's move: nearest direction
    expect(facingTowards({ x: 5, y: 5 }, { x: 7, y: 4 })).toBe(NE);
    expect(facingTowards({ x: 5, y: 5 }, { x: 8, y: 4 })).toBe(E);
    expect(facingTowards({ x: 5, y: 5 }, { x: 6, y: 2 })).toBe(N);
    expect(facingTowards({ x: 5, y: 5 }, { x: 3, y: 7 })).toBe(SW);
    expect(facingTowards({ x: 5, y: 5 }, { x: 7, y: 7 })).toBe(SE);
  });

  it('Bauwerke und Wunder drehen sich nicht / structures and wonders do not turn', () => {
    expect(canFace({ type: 'infantry' })).toBe(true);
    expect(canFace({ type: 'tank' })).toBe(true);
    expect(canFace({ type: 'destroyer' })).toBe(true);
    for (const t of ['fusionPlant', 'waal', 'portal', 'hackRelay', 'coreDrill'] as UnitTypeId[]) expect(canFace({ type: t })).toBe(false);
  });

  it('Bewegung: Richtung des letzten Schritts / move: direction of the last step', () => {
    const s = game();
    const a = addUnit(s, 'jeep', 0, 5, 5);
    ok(s, { type: 'move', unit: a.id, to: { x: 6, y: 4 } });
    expect(unit(s, a.id)!.facing).toBe(NE);
    // zwei Schritte: es zaehlt der letzte / two steps: the last one counts
    const b = addUnit(s, 'jeep', 0, 2, 7);
    ok(s, { type: 'move', unit: b.id, to: { x: 4, y: 8 } });
    const bu = unit(s, b.id)!;
    expect([E, SE]).toContain(bu.facing);
  });

  it('Angriff: Angreifer zum Ziel, Gegenschlag zum Angreifer / attack: attacker towards the target, return fire towards the attacker', () => {
    const s = game();
    const a = addUnit(s, 'tank', 0, 5, 5);
    const d = addUnit(s, 'tank', 1, 6, 6);
    d.facing = N;
    const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
    const ev = r.events.find((e) => e.t === 'attack') as { ret: number };
    expect(ev.ret).toBeGreaterThan(0);
    expect(unit(s, a.id)!.facing).toBe(SE);
    expect(unit(s, d.id)!.facing).toBe(NW);
  });

  it('ohne Gegenschlag dreht sich das Ziel nicht / without return fire the target does not turn', () => {
    const s = game();
    // Scharfschuetze auf Distanz 2: Infanterie kann nicht zurueckschiessen / sniper at range 2: infantry cannot return fire
    const a = addUnit(s, 'sniper', 0, 3, 5);
    const d = addUnit(s, 'infantry', 1, 5, 5);
    d.facing = E;
    const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect((r.events.find((e) => e.t === 'attack') as { ret: number }).ret).toBe(0);
    expect(unit(s, a.id)!.facing).toBe(E);
    expect(unit(s, d.id)!.facing).toBe(E);
  });

  it('neue Einheiten blicken zur Kartenmitte, Wunder ohne Ausrichtung / new units face the map centre, wonders have none', () => {
    const s = game(['korvat', 'dravon']);
    s.factions[0].stars = 200;
    giveSites(s.cities[0], 'trainingCamp');
    const r = ok(s, { type: 'train', city: s.cities[0].id, unitType: 'infantry' });
    const id = (r.events.find((e) => e.t === 'train') as { unit: number }).unit;
    // Stadt auf (1,1), Mitte (5,5): Suedosten / city on (1,1), centre (5,5): south-east
    expect(unit(s, id)!.facing).toBe(SE);
  });
});

describe('Rueckenbereich / rear arc', () => {
  it('Nahkampf: die drei Felder hinter der Einheit, Flanken nicht / melee: the three tiles behind, not the flanks', () => {
    // Blick nach Norden: hinten = Sueden / facing north: rear = south
    expect(inRearArc(at(N), { x: 4, y: 6 })).toBe(true);
    expect(inRearArc(at(N), { x: 5, y: 6 })).toBe(true);
    expect(inRearArc(at(N), { x: 6, y: 6 })).toBe(true);
    expect(inRearArc(at(N), { x: 4, y: 5 })).toBe(false);
    expect(inRearArc(at(N), { x: 6, y: 5 })).toBe(false);
    expect(inRearArc(at(N), { x: 5, y: 4 })).toBe(false);
    expect(inRearArc(at(N), { x: 4, y: 4 })).toBe(false);
    // genau drei der acht Nachbarn, fuer jede Richtung / exactly three of eight neighbours, for every direction
    for (let f = 0; f < 8; f++) {
      const rear = FACING_DIRS.filter((d) => inRearArc(at(f), { x: 5 + d.x, y: 5 + d.y }));
      expect(rear).toHaveLength(3);
      // die Mitte ist die Gegenrichtung / the middle one is the opposite direction
      expect(rear).toContainEqual(FACING_DIRS[(f + 4) % 8]);
    }
  });

  it('diagonal: Blick nach Nordosten, hinten = Westen, Suedwesten, Sueden / diagonal: facing north-east, rear = west, south-west, south', () => {
    expect(inRearArc(at(NE), { x: 4, y: 5 })).toBe(true);
    expect(inRearArc(at(NE), { x: 4, y: 6 })).toBe(true);
    expect(inRearArc(at(NE), { x: 5, y: 6 })).toBe(true);
    // Flanken / flanks
    expect(inRearArc(at(NE), { x: 6, y: 6 })).toBe(false);
    expect(inRearArc(at(NE), { x: 4, y: 4 })).toBe(false);
    expect(inRearArc(at(NE), { x: 6, y: 4 })).toBe(false);
  });

  it('Fernkampf: Richtung vom Ziel zum Angreifer, 135 Grad oder mehr / ranged: direction from target to attacker, 135 degrees or more', () => {
    expect(inRearArc(at(N), { x: 5, y: 7 })).toBe(true);
    expect(inRearArc(at(N), { x: 6, y: 7 })).toBe(true); // ~153 Grad / ~153 degrees
    expect(inRearArc(at(N), { x: 7, y: 7 })).toBe(true); // genau 135 Grad / exactly 135 degrees
    expect(inRearArc(at(N), { x: 7, y: 6 })).toBe(false); // ~117 Grad / ~117 degrees
    expect(inRearArc(at(N), { x: 7, y: 5 })).toBe(false); // Flanke / flank
    expect(inRearArc(at(NE), { x: 3, y: 6 })).toBe(true);
    expect(inRearArc(at(NE), { x: 4, y: 7 })).toBe(true);
    expect(inRearArc(at(NE), { x: 6, y: 7 })).toBe(false);
    expect(inRearArc(at(W), { x: 7, y: 4 })).toBe(true);
    expect(inRearArc(at(W), { x: 6, y: 3 })).toBe(false);
  });

  it('ohne Ausrichtung oder bei Bauwerken nie / never without a facing or for structures', () => {
    expect(inRearArc(at(undefined), { x: 5, y: 6 })).toBe(false);
    expect(inRearArc(at(N, 'fusionPlant'), { x: 5, y: 6 })).toBe(false);
    expect(inRearArc(at(N, 'waal'), { x: 5, y: 6 })).toBe(false);
    expect(rearAttackBonus({ x: 5, y: 6 }, at(N))).toBe(COMBAT.rearAttack);
    expect(rearAttackBonus({ x: 5, y: 4 }, at(N))).toBe(0);
    expect(COMBAT.rearAttack).toBe(0.5);
  });
});

describe('Schaden von hinten / damage from behind', () => {
  /** Panzer greift Infanterie auf (6,5) von (5,5) an; Ziel blickt weg (Osten) oder her (Westen) / tank attacks infantry */
  function duel(facing: number | undefined, hitChance = false, seed = 0) {
    const s = game(['alvenia', 'dravon'], hitChance);
    if (seed) s.rng = (s.rng ^ Math.imul(seed, 0x9e3779b1)) | 0;
    const a = addUnit(s, 'mg', 0, 5, 5);
    const d = addUnit(s, 'tank', 1, 6, 5);
    d.facing = facing;
    const pre = combatPreview(s, a, d);
    const def = { ...d }, att = { ...a };
    const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
    const ev = r.events.find((e) => e.t === 'attack') as { dmg: number; ret: number; hit?: 'miss' | 'graze' | 'partial' | 'full' | 'crit' };
    return { s, pre, ev, def, att };
  }

  it('x1,5 in Vorschau und echtem Schaden / x1.5 in preview and real damage', () => {
    const back = duel(E), front = duel(W), side = duel(N), old = duel(undefined);
    expect(back.pre.rear).toBe(0.5);
    expect(front.pre.rear).toBe(0);
    expect(side.pre.rear).toBe(0);
    expect(old.pre.rear).toBe(0);
    expect(front.pre.toDefender).toBeGreaterThan(0);
    expect(Math.abs(back.pre.toDefender - front.pre.toDefender * 1.5)).toBeLessThanOrEqual(1);
    expect(back.pre.toDefender).toBeGreaterThan(front.pre.toDefender);
    expect(side.pre.toDefender).toBe(front.pre.toDefender);
    expect(old.pre.toDefender).toBe(front.pre.toDefender);
    expect(back.ev.dmg).toBe(back.pre.toDefender);
    expect(front.ev.dmg).toBe(front.pre.toDefender);
  });

  it('kein Bonus auf den Gegenschlag / no bonus on return fire', () => {
    const back = duel(E), front = duel(W);
    // gleicher Rest-LP: gleicher Gegenschlag, egal von wo / same HP left: same return fire, wherever from
    const left = back.def.hp - back.ev.dmg;
    expect(left).toBeGreaterThan(0);
    expect(returnFire(back.s, back.att, { ...back.def, facing: E }, left)).toBe(returnFire(front.s, front.att, { ...front.def, facing: W }, left));
    expect(back.ev.ret).toBe(returnFire(back.s, back.att, back.def, left));
  });

  it('mit Trefferglueck: Wurf auf den erhoehten Schaden, Vorschau passt / with hit luck: roll on the raised damage, preview matches', () => {
    let rearExp = 0, frontExp = 0;
    for (let k = 1; k <= 8; k++) {
      const back = duel(E, true, k), front = duel(W, true, k);
      expect(back.ev.hit).toBeDefined();
      expect(back.ev.dmg).toBe(hitDamage(back.pre.toDefender, back.ev.hit!));
      expect(front.ev.dmg).toBe(hitDamage(front.pre.toDefender, front.ev.hit!));
      expect(back.pre.max).toBeGreaterThan(front.pre.max);
      rearExp += back.pre.expected; frontExp += front.pre.expected;
    }
    expect(rearExp).toBeGreaterThan(frontExp * 1.3);
  });

  it('Fernkampf von hinten: Scharfschuetze auf Distanz 2 / ranged from behind: sniper at range 2', () => {
    const s = game();
    const a = addUnit(s, 'sniper', 0, 4, 7);
    const d = addUnit(s, 'infantry', 1, 5, 5);
    d.facing = N;
    const pre = combatPreview(s, a, d);
    expect(pre.rear).toBe(0.5);
    d.facing = S;
    expect(combatPreview(s, a, d).rear).toBe(0);
  });

  it('es zaehlt die Ausrichtung vor dem Angriff; danach blickt das Ziel zum Angreifer / the facing before the attack counts; afterwards the target faces the attacker', () => {
    const back = duel(E);
    expect(back.ev.ret).toBeGreaterThan(0);
    const d = back.s.units.find((u) => u.owner === 1)!;
    expect(d.facing).toBe(W);
    // zweiter Angriff aus derselben Richtung ist nicht mehr von hinten / a second attack from the same side is no longer from behind
    const a = back.s.units.find((u) => u.owner === 0)!;
    expect(combatPreview(back.s, a, d).rear).toBe(0);
  });

  it('Bauwerke: nie von hinten / structures: never from behind', () => {
    const s = game();
    const a = addUnit(s, 'tank', 0, 5, 6);
    const w = addUnit(s, 'waal', 1, 5, 5);
    w.facing = N;
    expect(combatPreview(s, a, w).rear).toBe(0);
  });

  it('alte Spielstaende ohne Ausrichtung laden, kein Bonus; Ausrichtung uebersteht Speichern / old saves without facing load, no bonus; facing survives saving', () => {
    const s = game();
    const a = addUnit(s, 'mg', 0, 5, 5);
    const d = addUnit(s, 'tank', 1, 6, 5);
    d.facing = E;
    const pre = combatPreview(s, a, d);
    expect(pre.rear).toBe(0.5);
    const saved = JSON.parse(JSON.stringify(s));
    expect(isValidState(saved)).toBe(true);
    const m = migrateState(saved);
    const md = m.units.find((u: Unit) => u.id === d.id)!;
    expect(md.facing).toBe(E);
    expect(combatPreview(m, m.units.find((u: Unit) => u.id === a.id)!, md).toDefender).toBe(pre.toDefender);
    const old = JSON.parse(JSON.stringify(s));
    for (const u of old.units) delete u.facing;
    const mo = migrateState(old);
    const od = mo.units.find((u: Unit) => u.id === d.id)!;
    expect(od.facing).toBeUndefined();
    expect(combatPreview(mo, mo.units.find((u: Unit) => u.id === a.id)!, od).rear).toBe(0);
  });
});
