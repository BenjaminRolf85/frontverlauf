/**
 * KI der Schattenflotte (Meridon): Silo-Start auf Haeufungen ohne eigene Einheiten, Radarimpuls bei erwarteten Gegnern,
 * Sabotage lohnender Ziele, Absetzen nach dem Angriff, Respekt vor der Tarnung und ganze KI-Partien ohne Fehlbefehle.
 * Shadow fleet AI (Meridon): silo launch at clusters without own units, radar sweep when enemies are expected, sabotage of
 * worthwhile targets, withdrawal after attacking, respect for camouflage and whole AI games without failed commands.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, defaultConfig, siloArea, type GameState } from '../src/core';
import { AI, SILO, type FactionId } from '../src/data/balance';
import { aiDebug, planNextCommand } from '../src/ai/ai';
import { buildCtx } from '../src/ai/analysis';
import { planRadar, planSabotage, planSilo } from '../src/ai/shadowFleet';
import { addCity, addUnit, blankGame, ok, revealAll, tile } from './helpers';

function duel(): GameState {
  const s = blankGame({ factions: ['meridon', 'korvat'], stars: 200, size: 14 });
  addCity(s, 2, 2, 0, { hq: true });
  addCity(s, 11, 11, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  for (const f of s.factions) f.human = false;
  return s;
}

describe('KI der Schattenflotte / shadow fleet AI', () => {
  it('Silo: Start auf die Haeufung, nie auf eigene Einheiten / silo: launch at the cluster, never at own units', () => {
    const s = duel();
    tile(s, 3, 3).turret = { hp: SILO.hp, active: true, owner: 0, kind: 'silo', ready: s.round };
    for (const [x, y] of [[8, 8], [9, 8], [8, 9]]) addUnit(s, 'mg', 1, x, y);
    const single = addUnit(s, 'infantry', 1, 5, 9);
    addUnit(s, 'infantry', 0, 5, 10);
    const cmd = planSilo(buildCtx(s, 0), new Set());
    expect(cmd?.type).toBe('siloLaunch');
    const c = cmd as { tx: number; ty: number };
    const area = siloArea(s, c.tx, c.ty);
    expect(area.filter((p) => s.units.some((u) => u.owner === 1 && u.x === p.x && u.y === p.y)).length).toBeGreaterThanOrEqual(2);
    expect(area.some((p) => p.x === single.x && p.y === single.y)).toBe(false);
    expect(area.some((p) => s.units.some((u) => u.owner === 0 && u.x === p.x && u.y === p.y))).toBe(false);
    ok(s, cmd!);
    // danach nachladen: kein zweiter Start / then reloading: no second launch
    expect(planSilo(buildCtx(s, 0), new Set())).toBeNull();
  });

  it('Radar: Impuls bei Gegnern in der Naehe, nicht ohne eigene Kaempfer / radar: sweep with enemies nearby, not without own fighters', () => {
    const s = duel();
    const radar = addUnit(s, 'radarTruck', 0, 6, 6);
    addUnit(s, 'infantry', 1, 9, 9);
    addUnit(s, 'infantry', 1, 10, 9);
    expect(planRadar(buildCtx(s, 0), new Set())).toBeNull();
    addUnit(s, 'infantry', 0, 7, 6);
    expect(planRadar(buildCtx(s, 0), new Set())).toEqual({ type: 'radarSweep', unit: radar.id });
  });

  it('Sabotage: Produktionsstaette vor Strasse / sabotage: production site before road', () => {
    const s = duel();
    tile(s, 10, 10).road = true;
    tile(s, 10, 11).building = 'armory';
    const c = addUnit(s, 'shadowCommando', 0, 9, 10);
    expect(planSabotage(buildCtx(s, 0), new Set())).toEqual({ type: 'sabotage', unit: c.id, x: 10, y: 11 });
  });

  it('Tarnung: die KI sieht das getarnte Kommando nicht und greift es nicht an / camouflage: the AI does not see the camouflaged commando', () => {
    const s = duel();
    s.current = 1;
    addUnit(s, 'shadowCommando', 0, 7, 7);
    addUnit(s, 'artillery', 1, 9, 9);
    const ctx = buildCtx(s, 1);
    expect(ctx.enemies.some((u) => u.type === 'shadowCommando')).toBe(false);
  });

  it('Absetzen: nach dem Angriff zieht die KI aus der Reichweite / withdrawal: after attacking the AI moves out of reach', () => {
    const s = duel();
    const u = addUnit(s, 'infantry', 0, 6, 6);
    const k = addUnit(s, 'mg', 1, 7, 6, { hp: 15 });
    addUnit(s, 'mg', 1, 8, 6);
    ok(s, { type: 'attack', unit: u.id, target: k.id });
    expect(s.units.find((o) => o.id === u.id)?.withdraw).toBe(true);
    let moved = false;
    for (let i = 0; i < 40; i++) {
      const cmd = planNextCommand(s, 0);
      if (cmd.type === 'endTurn') break;
      const r = applyCommand(s, cmd);
      expect(r.ok).toBe(true);
      if (cmd.type === 'move' && cmd.unit === u.id) { moved = true; break; }
    }
    expect(moved).toBe(true);
    const after = s.units.find((o) => o.id === u.id)!;
    expect(Math.max(Math.abs(after.x - 7), Math.abs(after.y - 6))).toBeGreaterThanOrEqual(2);
  });
});

describe('KI-Partien mit Meridon / AI games with Meridon', () => {
  // mehrere Eroberungspartien, alle Fraktionen KI: keine Fehlbefehle, KI-Zug unter 1 s, die Schattenflotte im Einsatz
  // several conquest games, all factions AI: no failed commands, AI turn under 1 s, the shadow fleet in action
  const games: { seed: number; ids: FactionId[] }[] = [
    { seed: 6, ids: ['vesper', 'meridon', 'nexus', 'zyrr'] },
    { seed: 5, ids: ['meridon', 'korvat', 'dravon'] },
    { seed: 21, ids: ['meridon', 'alvenia', 'velkar'] },
  ];
  for (const g of games) {
    it(`Seed ${g.seed}: ${g.ids.join(', ')}`, () => {
      const s = createGame(defaultConfig({ seed: g.seed, size: 14, mode: 'conquest', mapType: 'continents', factionVictory: false, events: true, hazards: 'normal',
        factions: g.ids.map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));
      let fails = 0, worst = 0;
      const seen = new Set<string>();
      const errors = aiDebug.errors;
      while (!s.over && s.round <= 70) {
        const f = s.current;
        const t0 = performance.now();
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          // Absetzen: Bewegung einer Einheit, die nach ihrem Angriff zurueckweicht / withdrawal: move of a unit falling back after its attack
          const withdraw = cmd.type === 'move' && !!s.units.find((u) => u.id === cmd.unit)?.withdraw;
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (r.ok && withdraw) seen.add('withdraw');
          for (const e of r.events) if (['siloLaunch', 'sabotage', 'radarSweep', 'emplacement'].includes(e.t) && s.factions[f].id === 'meridon') seen.add(e.t);
          if (cmd.type === 'endTurn' && r.ok) break;
        }
        worst = Math.max(worst, performance.now() - t0);
      }
      expect(fails).toBe(0);
      expect(aiDebug.errors).toBe(errors);
      expect(worst).toBeLessThan(1000);
      // die Schattenflotte kommt zum Einsatz (mindestens eine ihrer Aktionen) / the shadow fleet comes into play (at least one of its actions)
      expect(seen.size).toBeGreaterThan(0);
    }, 180_000);
  }
});
