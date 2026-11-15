/**
 * Feuern nach Bewegung: halber Schaden nach einer Bewegung im selben Zug, Korvat-Bonus Steppensturm, KI.
 * Firing after moving: half damage after a move in the same turn, Korvat bonus Steppe Storm, AI.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, combatPreview, createGame, defaultConfig, hitDamage, moveFireFactor, moveFireMult, movedThisTurn, retreatDamage, returnFire,
  turretPreview, type GameState, type Unit,
} from '../src/core';
import { AI, FACTION_IDS, MOVE_FIRE, RETREAT, VERDAN, type FactionId, type UnitTypeId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { buildCtx } from '../src/ai/analysis';
import { attackValue } from '../src/ai/tactics';
import { migrateState, isValidState } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, tile, unit, untilTurnOf } from './helpers';

function game(factions: FactionId[] = ['alvenia', 'dravon'], hitChance = false): GameState {
  const s = blankGame({ factions, size: 11, hitChance });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

/** Angriff mit fester Ausgangslage: stehend auf (5,5) oder von (4,5) nach (5,5) gezogen / attack from a fixed setup: standing on (5,5) or moved from (4,5) to (5,5) */
function duel(o: { moved: boolean; type?: UnitTypeId; factions?: FactionId[]; target?: UnitTypeId; hitChance?: boolean }) {
  const s = game(o.factions, o.hitChance);
  const a = addUnit(s, o.type ?? 'tank', 0, o.moved ? 4 : 5, 5);
  const d = addUnit(s, o.target ?? 'tank', 1, 6, 5);
  if (o.moved) ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 5 } });
  const au = unit(s, a.id)!;
  const pre = combatPreview(s, au, d);
  const before = { hp: d.hp, att: { ...au }, def: { ...d } };
  const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
  const ev = r.events.find((e) => e.t === 'attack')! as Extract<typeof r.events[number], { t: 'attack' }>;
  return { s, a: au, d, pre, before, ev };
}

describe('Feuern nach Bewegung / firing after moving', () => {
  it('halbiert den Schaden nach einer Bewegung (vor dem Trefferglueck) / halves damage after a move (before hit luck)', () => {
    const still = duel({ moved: false });
    const moved = duel({ moved: true });
    expect(still.pre.moveFire).toBe(false);
    expect(moved.pre.moveFire).toBe(true);
    expect(movedThisTurn(moved.a)).toBe(true);
    expect(MOVE_FIRE.damage).toBe(0.5);
    // gleiche Lage, nur die Bewegung unterscheidet sich / same situation, only the move differs
    expect(Math.abs(moved.pre.toDefender - still.pre.toDefender * MOVE_FIRE.damage)).toBeLessThanOrEqual(0.5);
    expect(moved.pre.toDefender).toBeLessThan(still.pre.toDefender);
    expect(moved.ev.dmg).toBe(moved.pre.toDefender);
    expect(still.ev.dmg).toBe(still.pre.toDefender);
  });

  it('stehende Angriffe bleiben unveraendert / stationary attacks stay unchanged', () => {
    const still = duel({ moved: false });
    expect(moveFireFactor(still.s, still.before.att)).toBe(1);
    const ghost = { ...still.before.att, moved: false };
    expect(combatPreview(still.s, ghost, { ...still.before.def }).toDefender).toBe(still.ev.dmg);
  });

  it('der Gegenschlag bleibt unveraendert / return fire stays unchanged', () => {
    const moved = duel({ moved: true });
    const left = moved.before.hp - moved.ev.dmg;
    expect(left).toBeGreaterThan(0);
    const att = moved.before.att, def = moved.before.def;
    // Gegenschlag haengt nicht von der Bewegung des Angreifers ab / return fire does not depend on the attacker's move
    expect(returnFire(moved.s, { ...att, moved: true }, def, left)).toBe(returnFire(moved.s, { ...att, moved: false }, def, left));
    expect(moved.ev.ret).toBe(returnFire(moved.s, att, def, left));
    expect(moved.ev.ret).toBeGreaterThan(0);
  });

  it('mit Trefferglueck: der Wurf kommt nach der Halbierung, Vorschau passt / with hit luck: the roll comes after halving, preview matches', () => {
    for (let k = 0; k < 6; k++) {
      const s = game(['alvenia', 'dravon'], true);
      s.rng = (s.rng ^ Math.imul(k + 1, 0x9e3779b1)) | 0;
      const a = addUnit(s, 'tank', 0, 4, 5);
      const d = addUnit(s, 'tank', 1, 6, 5);
      ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 5 } });
      const pre = combatPreview(s, unit(s, a.id)!, d);
      const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
      const ev = r.events.find((e) => e.t === 'attack') as { dmg: number; hit: 'miss' | 'graze' | 'partial' | 'full' | 'crit' };
      expect(ev.dmg).toBe(hitDamage(pre.toDefender, ev.hit));
      expect(ev.dmg).toBeGreaterThanOrEqual(pre.min);
      expect(ev.dmg).toBeLessThanOrEqual(pre.max);
    }
  });

  it('Raketen nach Bewegung sind halbiert / rockets after moving are halved', () => {
    const run = (moved: boolean) => {
      const s = game(['zyrr', 'dravon']);
      const m = addUnit(s, 'mech', 0, moved ? 3 : 4, 5);
      const d = addUnit(s, 'tank', 1, 6, 5);
      if (moved) ok(s, { type: 'move', unit: m.id, to: { x: 4, y: 5 } });
      const pre = combatPreview(s, unit(s, m.id)!, d, true);
      const r = ok(s, { type: 'rocket', unit: m.id, target: d.id });
      const ev = r.events.find((e) => e.t === 'attack') as { dmg: number };
      expect(ev.dmg).toBe(pre.toDefender);
      return pre.toDefender;
    };
    const still = run(false), moved = run(true);
    expect(Math.abs(moved - still * MOVE_FIRE.damage)).toBeLessThanOrEqual(0.5);
    expect(moved).toBeLessThan(still);
  });

  it('Artillerie: ohne Sturm kein Schuss nach Bewegung, der Faktor gilt trotzdem allgemein / artillery: no shot after moving without dash, the factor still applies generally', () => {
    const s = game();
    const art = addUnit(s, 'artillery', 0, 3, 5);
    const d = addUnit(s, 'tank', 1, 6, 5);
    ok(s, { type: 'move', unit: art.id, to: { x: 4, y: 5 } });
    fails(s, { type: 'attack', unit: art.id, target: d.id }, 'cannotAttack');
    const au = unit(s, art.id)!;
    const full = combatPreview(s, { ...au, moved: false }, d).toDefender;
    expect(Math.abs(combatPreview(s, au, d).toDefender - full * MOVE_FIRE.damage)).toBeLessThanOrEqual(0.5);
  });

  it('Verdan-Geschuetze: Angriff nach Bewegung halbiert / Verdan guns: attack after moving halved', () => {
    const run = (moved: boolean) => {
      const s = game();
      tile(s, 6, 5).turret = { hp: VERDAN.hp, active: false };
      const a = addUnit(s, 'tank', 0, moved ? 4 : 5, 5);
      if (moved) ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 5 } });
      const pre = turretPreview(s, unit(s, a.id)!, { x: 6, y: 5 });
      expect(pre.moveFire).toBe(moved);
      const r = ok(s, { type: 'attackTurret', unit: a.id, x: 6, y: 5 });
      const ev = r.events.find((e) => e.t === 'turretHit') as { dmg: number };
      expect(ev.dmg).toBe(pre.toTurret);
      return pre.toTurret;
    };
    const still = run(false), moved = run(true);
    expect(Math.abs(moved - still * MOVE_FIRE.damage)).toBeLessThanOrEqual(0.5);
  });

  it('Rueckzug nach Bewegung: 20 % vom halbierten Schaden, der Schritt zaehlt nicht / retreat after moving: 20 % of the halved damage, the step does not count', () => {
    const s = game();
    const a = addUnit(s, 'infantry', 0, 4, 5);
    const d = addUnit(s, 'tank', 1, 6, 5);
    ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 5 } });
    const au = unit(s, a.id)!;
    const half = combatPreview(s, au, d).toDefender;
    expect(half).toBeLessThan(combatPreview(s, { ...au, moved: false }, d).toDefender);
    const dmg = retreatDamage(s, au, d);
    expect(dmg).toBe(Math.max(1, Math.round(half * RETREAT.damage)));
    ok(s, { type: 'retreat', unit: a.id, target: d.id });
    expect(unit(s, d.id)!.hp).toBe(d.maxHp - dmg);
    // ohne vorherige Bewegung: voller Rueckzugsschuss / without a previous move: full retreat shot
    const s2 = game();
    const a2 = addUnit(s2, 'infantry', 0, 5, 5);
    const d2 = addUnit(s2, 'tank', 1, 6, 5);
    expect(retreatDamage(s2, a2, d2)).toBe(Math.max(1, Math.round(combatPreview(s2, a2, d2).toDefender * RETREAT.damage)));
  });

  it('die Markierung gilt bis zum naechsten eigenen Zug / the flag resets at the next own turn', () => {
    const s = game();
    const a = addUnit(s, 'tank', 0, 4, 5);
    const d = addUnit(s, 'tank', 1, 6, 5);
    ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 5 } });
    expect(moveFireFactor(s, unit(s, a.id)!)).toBe(MOVE_FIRE.damage);
    untilTurnOf(s, 0);
    const au = unit(s, a.id)!;
    expect(au.moved).toBe(false);
    expect(moveFireFactor(s, au)).toBe(1);
    expect(combatPreview(s, au, unit(s, d.id)!).moveFire).toBe(false);
  });

  it('Speichern und Laden; alte Spielstaende ohne Feld gelten als nicht gezogen / save and load; old saves without the field count as not moved', () => {
    const s = game();
    const a = addUnit(s, 'tank', 0, 4, 5);
    const d = addUnit(s, 'tank', 1, 6, 5);
    ok(s, { type: 'move', unit: a.id, to: { x: 5, y: 5 } });
    const pre = combatPreview(s, unit(s, a.id)!, d).toDefender;
    const loaded = JSON.parse(JSON.stringify(s));
    expect(isValidState(loaded)).toBe(true);
    const m = migrateState(loaded);
    expect(m.units.find((u: Unit) => u.id === a.id)!.moved).toBe(true);
    expect(combatPreview(m, m.units.find((u: Unit) => u.id === a.id)!, m.units.find((u: Unit) => u.id === d.id)!).toDefender).toBe(pre);
    // alter Stand: Feld fehlt / old save: field missing
    const old = JSON.parse(JSON.stringify(s));
    for (const u of old.units) delete u.moved;
    const mo = migrateState(old);
    for (const u of mo.units) expect(u.moved).toBe(false);
    expect(moveFireFactor(mo, mo.units.find((u: Unit) => u.id === a.id)!)).toBe(1);
  });
});

describe('Steppensturm (Korvat) / Steppe Storm (Korvat)', () => {
  it('Korvat-Einheiten nach Bewegung 75 % / Korvat units after moving 75 %', () => {
    const still = duel({ moved: false, type: 'infantry', factions: ['korvat', 'dravon'] });
    const moved = duel({ moved: true, type: 'infantry', factions: ['korvat', 'dravon'] });
    expect(MOVE_FIRE.bonus.korvat?.all).toBe(0.75);
    expect(moveFireMult(moved.s, moved.a)).toBe(0.75);
    expect(Math.abs(moved.pre.toDefender - still.pre.toDefender * 0.75)).toBeLessThanOrEqual(0.5);
    expect(moved.ev.dmg).toBe(moved.pre.toDefender);
  });

  it('Steppenreiter nach Bewegung 100 % / Steppe Riders after moving 100 %', () => {
    const still = duel({ moved: false, type: 'steppeRider', factions: ['korvat', 'dravon'], target: 'infantry' });
    const moved = duel({ moved: true, type: 'steppeRider', factions: ['korvat', 'dravon'], target: 'infantry' });
    expect(moveFireMult(moved.s, moved.a)).toBe(1);
    expect(moved.pre.moveFire).toBe(true);
    expect(moved.pre.toDefender).toBe(still.pre.toDefender);
    expect(moved.ev.dmg).toBe(still.ev.dmg);
  });

  it('alle anderen Fraktionen bleiben bei 50 %, auch ein bekehrter Steppenreiter / all other factions stay at 50 %, also a converted Steppe Rider', () => {
    for (const f of FACTION_IDS.filter((x) => x !== 'korvat')) {
      const s = game([f, 'korvat']);
      for (const type of ['infantry', 'tank', 'steppeRider'] as UnitTypeId[]) {
        const u = addUnit(s, type, 0, 5, 5);
        u.moved = true;
        expect(moveFireMult(s, u), `${f} ${type}`).toBe(MOVE_FIRE.damage);
        expect(moveFireFactor(s, u)).toBe(MOVE_FIRE.damage);
      }
    }
  });
});

describe('KI und Feuern nach Bewegung / AI and firing after moving', () => {
  it('bewertet Ziehen-und-Feuern niedriger als Stehen-und-Feuern / values move-then-fire below stand-and-fire', () => {
    const s = game(['dravon', 'alvenia']);
    s.factions.forEach((f) => { f.human = false; });
    const a = addUnit(s, 'tank', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    const ctx = buildCtx(s, 0);
    // gleicher Abstand zum Ziel, aber von einem anderen Feld (erst ziehen) / same distance to the target, but from another tile (move first)
    expect(attackValue(ctx, a, d, 5, 4)).toBeLessThan(attackValue(ctx, a, d));
    // Korvat-Steppenreiter verliert durch die Bewegung nichts / a Korvat Steppe Rider loses nothing by moving
    const k = game(['korvat', 'alvenia']);
    const r = addUnit(k, 'steppeRider', 0, 5, 5);
    const e = addUnit(k, 'infantry', 1, 6, 5);
    const kctx = buildCtx(k, 0);
    expect(attackValue(kctx, r, e, 5, 4)).toBeCloseTo(attackValue(kctx, r, e), 5);
  });

  it('greift lieber mit einer Einheit an, die schon in Reichweite steht / prefers attacking with a unit already in range', () => {
    const s = game(['dravon', 'alvenia']);
    s.factions.forEach((f) => { f.human = false; });
    const near = addUnit(s, 'tank', 0, 5, 5);
    const mover = addUnit(s, 'tank', 0, 4, 4);
    addUnit(s, 'infantry', 1, 6, 5);
    // die zweite ist schon gezogen und steht ebenfalls daneben / the second one already moved and also stands next to it
    mover.x = 6; mover.y = 4; mover.moved = true;
    const cmd = planNextCommand(s, 0);
    expect(cmd.type).toBe('attack');
    expect((cmd as { unit: number }).unit).toBe(near.id);
  });

  it('KI-Partie ohne Fehlbefehle, mit Einnahmen / AI game without failed commands, with captures', () => {
    const s = createGame(defaultConfig({
      seed: 21, size: 14, mode: 'points', mapType: 'continent', roundLimit: 18,
      factions: (['korvat', 'zyrr', 'nexus', 'alvenia'] as FactionId[]).map((id) => ({ id, human: false, difficulty: 'normal' as const })),
    }));
    let failed = 0, moveAttacks = 0, attacks = 0, captures = 0;
    while (!s.over && s.round <= 18) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const moved = 'unit' in cmd && cmd.type === 'attack' ? !!s.units.find((u) => u.id === cmd.unit)?.moved : false;
        const r = applyCommand(s, cmd);
        if (!r.ok) failed++;
        else if (cmd.type === 'attack') { attacks++; if (moved) moveAttacks++; }
        captures += r.events.filter((e) => e.t === 'capture').length;
        if (cmd.type === 'endTurn' && r.ok) break;
      }
    }
    expect(failed).toBe(0);
    expect(attacks).toBeGreaterThan(0);
    expect(moveAttacks).toBeLessThan(attacks);
    expect(captures).toBeGreaterThan(0);
  }, 60_000);
});
