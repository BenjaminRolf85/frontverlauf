/**
 * Panzer fahren 2 Felder und schiessen 2 Felder weit; Korvat-Artillerie schiesst 4 Felder weit.
 * Tanks drive 2 tiles and fire 2 tiles; Korvat artillery fires 4 tiles.
 */
import { describe, expect, it } from 'vitest';
import { attackTargets, combatPreview, effectiveMove, effectiveRange, reachable, unitRange, weatherFor } from '../src/core';
import { DOCTRINE, RANGE_BONUS, UNITS, WEATHER, type FactionId } from '../src/data/balance';
import { combatBonusTexts } from '../src/ui/factionInfo';
import { addCity, addUnit, blankGame, endTurn, ok, revealAll, tile, untilTurnOf } from './helpers';

const roundWith = (seed: number, w: string) => { for (let r = 2; r < 400; r++) if (weatherFor(seed, r) === w) return r; throw new Error('none'); };
const far = (s: ReturnType<typeof blankGame>, u: ReturnType<typeof addUnit>) => Math.max(...reachable(s, u).map((p) => Math.max(Math.abs(p.x - u.x), Math.abs(p.y - u.y))));

describe('Panzer: Bewegung 2 / tanks: move 2', () => {
  it('Panzer, Tesla-Panzer und Reliquiar fahren 2 Felder / tank, Tesla tank and reliquary drive 2 tiles', () => {
    for (const t of ['tank', 'teslaTank', 'reliquary'] as const) {
      expect(UNITS[t].move, t).toBe(2);
      const s = blankGame({ factions: [t === 'teslaTank' ? 'velkar' : t === 'reliquary' ? 'alvenia' : 'korvat', 'dravon'] });
      const u = addUnit(s, t, 0, 5, 5);
      expect(far(s, u), t).toBe(2);
    }
    // NEXUS-Titan und Kult-Kriecher bleiben schwere Laeufer mit 1 Feld / NEXUS titan and cult crawler stay at 1 tile
    expect(UNITS.titan.move).toBe(1);
    expect(UNITS.doomCrawler.move).toBe(1);
  });

  it('Schnee bremst auf 1 Feld / snow slows to 1 tile', () => {
    const s = blankGame({ weather: true });
    const u = addUnit(s, 'tank', 0, 5, 5);
    s.round = roundWith(s.config.seed, 'snow');
    expect(WEATHER.snow.moveUnits).toContain('tank');
    expect(effectiveMove(s, u)).toBe(1);
    expect(far(s, u)).toBe(1);
    s.round = roundWith(s.config.seed, 'clear');
    expect(effectiveMove(s, u)).toBe(2);
  });

  it('Strassen: 4 Felder auf der Strasse / roads: 4 tiles on a road', () => {
    const s = blankGame();
    for (let x = 1; x <= 9; x++) tile(s, x, 5).road = true;
    const u = addUnit(s, 'tank', 0, 5, 5);
    expect(reachable(s, u).some((r) => r.x === 9 && r.y === 5)).toBe(true);
    expect(reachable(s, u).some((r) => r.x === 1 && r.y === 5)).toBe(true);
  });

  it('Panzersperre: Halt und naechste Runde nur 1 Feld / barrier: stop and only 1 tile next round', () => {
    const s = blankGame({ size: 14 });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 12, 12, 1, { hq: true });
    tile(s, 5, 5).barrier = { owner: 1 };
    const u = addUnit(s, 'tank', 0, 4, 5);
    // nicht durch die Sperre hindurch / not through the barrier
    expect(reachable(s, u).some((r) => r.path.slice(0, -1).some((q) => q.x === 5 && q.y === 5))).toBe(false);
    ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 5 } });
    endTurn(s); untilTurnOf(s, 0);
    expect(u.slowed).toBe(true);
    expect(far(s, u)).toBe(1);
  });
});

describe('Panzer: Reichweite 2 / tanks: range 2', () => {
  it('Panzer und Tesla-Panzer schiessen 2 Felder weit, auch nach der Bewegung (Sturm) / tank and Tesla tank fire 2 tiles, also after moving (dash)', () => {
    for (const t of ['tank', 'teslaTank'] as const) {
      expect(UNITS[t].range, t).toBe(2);
      expect(UNITS[t].abilities, t).toContain('dash');
    }
    const s = blankGame();
    revealAll(s, 0);
    const u = addUnit(s, 'tank', 0, 3, 5);
    const e = addUnit(s, 'infantry', 1, 7, 5);
    expect(attackTargets(s, u)).toHaveLength(0);
    ok(s, { type: 'move', unit: u.id, to: { x: 5, y: 5 } });
    expect(attackTargets(s, u).map((o) => o.id)).toEqual([e.id]);
    // nach der Bewegung mit verringertem Schaden (Feuern nach Bewegung) / after moving with reduced damage (firing after moving)
    expect(combatPreview(s, u, e).moveFire).toBe(true);
    ok(s, { type: 'attack', unit: u.id, target: e.id });
  });

  it('aus 2 Feldern schlagen nur Ziele mit Reichweite 2 zurueck / from 2 tiles only targets with range 2 strike back', () => {
    const s = blankGame({ factions: ['korvat', 'alvenia'] });
    const u = addUnit(s, 'tank', 0, 3, 5);
    const inf = addUnit(s, 'infantry', 1, 5, 5);
    const at = addUnit(s, 'antiTank', 1, 3, 7);
    const rel = addUnit(s, 'reliquary', 1, 1, 7);
    expect(combatPreview(s, u, inf).retaliates).toBe(false);
    // ein Ziel mit Reichweite 2, das den Treffer uebersteht, schlaegt zurueck / a range-2 target surviving the hit strikes back
    expect(combatPreview(s, u, rel).kills).toBe(false);
    expect(combatPreview(s, u, rel).retaliates).toBe(true);
    // Nahkampf wie bisher mit Gegenschlag / melee with return fire as before
    const adj = addUnit(s, 'mg', 1, 4, 4);
    expect(combatPreview(s, u, adj).retaliates).toBe(true);
    // als Verteidiger schlaegt der Panzer nur auf 1 Feld zurueck (Konter der Panzerabwehr bleibt) / as defender the tank strikes back only at 1 tile (the anti-tank counter stays)
    expect(UNITS.tank.returnRange).toBe(1);
    expect(UNITS.teslaTank.returnRange).toBe(1);
    expect(combatPreview(s, at, u).retaliates).toBe(false);
    expect(combatPreview(s, adj, u).retaliates).toBe(true);
    // das Reliquiar (schon vorher Reichweite 2) schlaegt weiter auf 2 Felder zurueck / the reliquary (range 2 before) still strikes back at 2 tiles
    const a2 = blankGame({ factions: ['korvat', 'alvenia'] });
    const at2 = addUnit(a2, 'antiTank', 0, 3, 5);
    const rel2 = addUnit(a2, 'reliquary', 1, 5, 5);
    expect(combatPreview(a2, at2, rel2).retaliates).toBe(true);
  });

  it('Sandsturm und Regen kuerzen wie bei anderen Fernkaempfern / dust storm cuts like for other ranged units', () => {
    const s = blankGame({ weather: true });
    s.config.theme = 'desert';
    const u = addUnit(s, 'tank', 0, 5, 5);
    let r = 2;
    for (; r < 400; r++) if (weatherFor(s.config.seed, r, 'desert') === 'dust') break;
    s.round = r;
    expect(effectiveRange(s, u)).toBe(1);
  });
});

describe('Korvat-Artillerie: Reichweite 4 / Korvat artillery: range 4', () => {
  const art = (f: FactionId) => {
    const s = blankGame({ factions: [f, f === 'korvat' ? 'dravon' : 'korvat'], weather: true });
    s.round = roundWith(s.config.seed, 'clear');
    return { s, u: addUnit(s, 'artillery', 0, 2, 5) };
  };

  it('nur Korvat schiesst 4 Felder weit / only Korvat fires 4 tiles', () => {
    expect(RANGE_BONUS.bonus.korvat?.artillery).toBe(1);
    expect(unitRange('artillery', 'korvat')).toBe(4);
    expect(unitRange('artillery', 'dravon')).toBe(3);
    expect(unitRange('artillery')).toBe(3);
    const k = art('korvat');
    revealAll(k.s, 0);
    expect(effectiveRange(k.s, k.u)).toBe(4);
    const e = addUnit(k.s, 'infantry', 1, 6, 5);
    expect(attackTargets(k.s, k.u).map((o) => o.id)).toEqual([e.id]);
    for (const f of ['dravon', 'alvenia', 'meridon', 'velkar'] as const) {
      const o = art(f);
      expect(effectiveRange(o.s, o.u), f).toBe(3);
    }
  });

  it('Regen kuerzt weiter um 1, die Doktrin Ballistik bringt +1 / rain still cuts 1, the ballistics doctrine adds 1', () => {
    const k = art('korvat');
    k.s.round = roundWith(k.s.config.seed, 'rain');
    expect(effectiveRange(k.s, k.u)).toBe(3);
    k.s.round = roundWith(k.s.config.seed, 'clear');
    k.s.factions[0].techs.push('ballistics');
    expect(effectiveRange(k.s, k.u)).toBe(4 + DOCTRINE.ballisticsRange);
  });

  it('eine bekehrte Artillerie verliert den Bonus (der Besitzer zaehlt) / a converted artillery loses the bonus (the owner counts)', () => {
    const k = art('korvat');
    k.u.owner = 1;
    expect(effectiveRange(k.s, k.u)).toBe(3);
  });

  it('steht in den Fraktionsmerkmalen / is listed in the faction traits', () => {
    const texts = combatBonusTexts('korvat').map((b) => b.desc).join(' ');
    expect(texts).toContain('4');
    expect(combatBonusTexts('dravon').some((b) => b.icon === 'range')).toBe(false);
  });
});
