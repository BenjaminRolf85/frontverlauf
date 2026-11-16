/**
 * Velkar "Labor im Feld": Tesla-Panzer (hoher Schaden, oft daneben), Railgun-Schuetze (Reichweite 3, nur aus dem Stand),
 * Oktokopter (Werte des Hubschraubers), Liste, Belohnung, Speichern und KI.
 * Velkar "lab in the field": Tesla tank (high damage, often misses), railgun marksman (range 3, stationary only),
 * octocopter (helicopter values), roster, reward, save/load and AI.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, attackTargets, canAttackNow, combatPreview, createGame, defaultConfig, expectedHitMult, hitDamage, hitOdds, rollHit,
  rosterUnits, siteOf, techUnlocks, trainCheck, unitLuckFactor, type GameState, type Unit,
} from '../src/core';
import { nextRandom } from '../src/core/rng';
import { AI, FACTION_IDS, HIT, HIT_KINDS, LAND_UNITS, ROSTERS, UNITS, VARIANTS, type FactionId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { isValidState, migrateState } from '../src/save/save';
import { unitGeometry, techParts } from '../src/render/models';
import { addCity, addUnit, blankGame, fails, giveSites, ok, revealAll, unit } from './helpers';

function game(factions: FactionId[] = ['velkar', 'korvat'], hitChance = true): GameState {
  const s = blankGame({ factions, size: 11, hitChance });
  addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

/** Angriff mit Vorhersage des Wurfs: Vorschau und tatsaechlicher Schaden / attack with the roll predicted: preview and actual damage */
function attackOnce(s: GameState, a: Unit, d: Unit) {
  const pre = combatPreview(s, a, d);
  const kind = s.config.hitChance ? rollHit(pre.odds, nextRandom({ rng: s.rng })) : 'full';
  const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
  const ev = r.events.find((e) => e.t === 'attack')! as Extract<typeof r.events[number], { t: 'attack' }>;
  return { pre, kind, ev };
}

describe('Tesla-Panzer / Tesla tank', () => {
  it('eigenes Trefferprofil: oft daneben, kritisch moeglich / own hit profile: often misses, crits possible', () => {
    const p = HIT.unit.teslaTank!;
    expect(HIT_KINDS.reduce((a, k) => a + p[k], 0)).toBeCloseTo(1, 6);
    expect(p.miss).toBeGreaterThanOrEqual(0.35);
    expect(p.miss).toBeLessThanOrEqual(0.4);
    expect(p.crit).toBeGreaterThan(0);
    const s = game();
    const t = addUnit(s, 'teslaTank', 0, 5, 5);
    const o = hitOdds(s, t);
    for (const k of HIT_KINDS) expect(o[k]).toBeCloseTo(p[k], 6);
    // Fehlschussquote im Wurf (deterministisch, 4000 Wuerfe) / miss rate when rolled (deterministic, 4000 rolls)
    const r = { rng: 4242 };
    let miss = 0;
    for (let i = 0; i < 4000; i++) if (rollHit(o, nextRandom(r)) === 'miss') miss++;
    expect(miss / 4000).toBeGreaterThan(0.35);
    expect(miss / 4000).toBeLessThan(0.41);
  });

  it('deutlich mehr Schaden je Treffer, Erwartungswert etwa wie der Panzer / clearly more damage per hit, expected value about the tank', () => {
    expect(UNITS.teslaTank.attack / UNITS.tank.attack).toBeGreaterThanOrEqual(1.4);
    expect(UNITS.teslaTank.attack / UNITS.tank.attack).toBeLessThanOrEqual(1.6);
    for (const target of ['tank', 'infantry', 'mg', 'jeep'] as const) {
      const s = game();
      const t = addUnit(s, 'teslaTank', 0, 5, 5);
      const k = addUnit(s, 'tank', 0, 5, 3);
      const d = addUnit(s, target, 1, 6, 5);
      const d2 = addUnit(s, target, 1, 6, 3);
      const pt = combatPreview(s, t, d), pk = combatPreview(s, k, d2);
      // voller Treffer klar staerker (wenn das Ziel nicht ohnehin faellt) / full hit clearly stronger (unless the target dies anyway)
      if (pk.toDefender < d.hp) expect(pt.toDefender / pk.toDefender).toBeGreaterThanOrEqual(1.4);
      // Erwartungswert gleich bis leicht hoeher / expected value equal to slightly higher
      const ratio = pt.expected / pk.expected;
      expect(ratio, target).toBeGreaterThanOrEqual(0.95);
      expect(ratio, target).toBeLessThanOrEqual(1.25);
      expect(pt.max).toBeGreaterThan(pk.max);
      expect(pt.min).toBe(0);
    }
  });

  it('Vorschau gleich tatsaechlichem Schaden, auch nach Bewegung / preview equals actual damage, also after moving', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = game();
      s.rng = seed * 7919;
      const t = addUnit(s, 'teslaTank', 0, 4, 5);
      const d = addUnit(s, 'tank', 1, 6, 5);
      if (seed % 2) ok(s, { type: 'move', unit: t.id, to: { x: 5, y: 5 } });
      else { t.x = 5; t.startX = 5; }
      const { pre, kind, ev } = attackOnce(s, unit(s, t.id)!, d);
      expect(pre.moveFire).toBe(seed % 2 === 1);
      expect(ev.hit).toBe(kind);
      expect(ev.dmg).toBe(hitDamage(pre.toDefender, kind));
    }
  });

  it('ohne Trefferglueck: Erwartungswert statt Glueck / without hit luck: expected value instead of luck', () => {
    const s = game(['velkar', 'korvat'], false);
    const t = addUnit(s, 'teslaTank', 0, 5, 5);
    const f = unitLuckFactor(s, t);
    expect(f).toBeCloseTo(expectedHitMult(HIT.unit.teslaTank!) / expectedHitMult(HIT.odds.human), 6);
    expect(f).toBeLessThan(1);
    const d = addUnit(s, 'tank', 1, 6, 5);
    const { pre, ev } = attackOnce(s, t, d);
    expect(ev.dmg).toBe(pre.toDefender);
  });

  it('Stadtbelohnung, Sold, Punkte wie der Panzer / city reward, upkeep, score like the tank', () => {
    const s = game();
    const c = s.cities[0];
    c.level = 5;
    // Stufe 5: Wahl b = Panzer (rewardOptions) / level 5: choice b = tank (rewardOptions)
    s.pendingRewards = [{ cityId: c.id, level: 5 }];
    ok(s, { type: 'reward', city: c.id, choice: 'b' });
    expect(s.units.some((u) => u.owner === 0 && u.type === 'teslaTank')).toBe(true);
    // Korvat bekommt weiter den Panzer / Korvat still gets the tank
    const k = s.cities[1];
    k.level = 5;
    s.current = 1;
    s.pendingRewards = [{ cityId: k.id, level: 5 }];
    ok(s, { type: 'reward', city: k.id, choice: 'b' });
    expect(s.units.some((u) => u.owner === 1 && u.type === 'tank')).toBe(true);
    // kaeuflich im Panzerwerk wie der Panzer / for sale at the tank works like the tank
    expect(UNITS.teslaTank.cost).toBe(UNITS.tank.cost);
    expect(UNITS.teslaTank.hp).toBe(UNITS.tank.hp);
  });
});

describe('Railgun-Schuetze / railgun marksman', () => {
  it('Reichweite 3, praezise, wenige Krits / range 3, precise, few crits', () => {
    expect(UNITS.railSniper.range).toBe(3);
    expect(UNITS.railSniper.range).toBeGreaterThan(UNITS.sniper.range);
    expect(UNITS.railSniper.attack).toBeGreaterThan(UNITS.sniper.attack);
    expect(UNITS.railSniper.abilities).not.toContain('dash');
    const p = HIT.unit.railSniper!;
    expect(p.miss).toBeLessThan(HIT.odds.human.miss);
    expect(p.crit).toBeLessThan(HIT.odds.human.crit);
    const s = game();
    const r = addUnit(s, 'railSniper', 0, 2, 5);
    const d = addUnit(s, 'infantry', 1, 5, 5);
    expect(attackTargets(s, r).map((u) => u.id)).toContain(d.id);
    const { pre, kind, ev } = attackOnce(s, r, d);
    expect(ev.dmg).toBe(hitDamage(pre.toDefender, kind));
  });

  it('nach einer Bewegung kein Angriff / no attack after moving', () => {
    const s = game();
    const r = addUnit(s, 'railSniper', 0, 2, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    ok(s, { type: 'move', unit: r.id, to: { x: 3, y: 5 } });
    const ru = unit(s, r.id)!;
    expect(canAttackNow(ru)).toBe(false);
    expect(attackTargets(s, ru)).toHaveLength(0);
    fails(s, { type: 'attack', unit: r.id, target: d.id });
    // naechster Zug aus dem Stand: Treffer moeglich / next turn from a standstill: can fire
    ok(s, { type: 'endTurn' });
    ok(s, { type: 'endTurn' });
    expect(attackTargets(s, unit(s, r.id)!).map((u) => u.id)).toContain(d.id);
  });
});

describe('Oktokopter / octocopter', () => {
  it('Werte des Kampfhubschraubers / the attack helicopter values', () => {
    const { faction, ...o } = UNITS.octocopter;
    expect(faction).toBe('velkar');
    expect(o).toEqual(UNITS.heli);
  });
});

describe('Liste der Velkar / Velkar roster', () => {
  it('Velkar: eigene Bauarten statt Panzer, Hubschrauber, Scharfschuetze / own designs instead of tank, helicopter, sniper', () => {
    const s = createGame(defaultConfig({ factions: FACTION_IDS.map((id) => ({ id, human: false, difficulty: 'normal' as const })), size: 22 }));
    const v = s.factions.findIndex((f) => f.id === 'velkar');
    const list = rosterUnits(s, v);
    expect(list).toContain('teslaTank');
    expect(list).toContain('octocopter');
    expect(list).toContain('railSniper');
    for (const t of ['tank', 'heli', 'sniper'] as const) expect(list).not.toContain(t);
    // Produktionsstaetten statt Forschung / production sites instead of research
    expect(siteOf('octocopter')).toBe('airfield');
    expect(siteOf('railSniper')).toBe('trainingCamp');
    expect(siteOf('teslaTank')).toBe('tankWorks');
    expect(techUnlocks('armyAviation', 'velkar').units).toEqual([]);
    // andere Menschen behalten Panzer, Hubschrauber, Scharfschuetze / other humans keep tank, helicopter, sniper
    for (const f of FACTION_IDS.filter((id) => !ROSTERS[id] && id !== 'velkar')) {
      const i = s.factions.findIndex((x) => x.id === f);
      const l = rosterUnits(s, i);
      // Alvenia hat eigene Bauarten fuer Panzer (Reliquiar), nicht fuer Hubschrauber und Scharfschuetze / Alvenia has its own tank design (Reliquary), not for helicopter and sniper
      for (const t of ['tank', 'heli', 'sniper'] as const) if (!(f === 'alvenia' && t === 'tank')) expect(l, f).toContain(t);
      for (const t of ['teslaTank', 'octocopter', 'railSniper'] as const) expect(l, f).not.toContain(t);
      expect(techUnlocks('armyAviation', f).units).toEqual([]);
    }
    expect(Object.keys(VARIANTS)).toEqual(['velkar', 'alvenia']);
    expect(LAND_UNITS).toContain('sniper');
  });

  it('Ausbildung: Grundtypen fuer Velkar gesperrt, Bauarten fuer andere / training: base types locked for Velkar, designs for others', () => {
    const s = game(['velkar', 'korvat']);
    giveSites(s.cities[0], 'airfield', 'tankWorks');
    giveSites(s.cities[1], 'airfield', 'tankWorks');
    s.factions[0].stars = 200; s.factions[1].stars = 200;
    expect(trainCheck(s, s.cities[0], 'sniper')).toBe('invalid');
    expect(trainCheck(s, s.cities[0], 'heli')).toBe('invalid');
    expect(trainCheck(s, s.cities[0], 'railSniper')).toBe('ok');
    expect(trainCheck(s, s.cities[0], 'octocopter')).toBe('ok');
    expect(trainCheck(s, s.cities[1], 'railSniper')).toBe('invalid');
    expect(trainCheck(s, s.cities[1], 'sniper')).toBe('ok');
    expect(trainCheck(s, s.cities[0], 'teslaTank')).toBe('ok');
    expect(trainCheck(s, s.cities[0], 'tank')).toBe('invalid');
    expect(trainCheck(s, s.cities[1], 'tank')).toBe('ok');
  });

  it('Speichern und Laden / save and load', () => {
    const s = game();
    const t = addUnit(s, 'teslaTank', 0, 5, 5);
    const r = addUnit(s, 'railSniper', 0, 3, 3);
    const o = addUnit(s, 'octocopter', 0, 4, 7);
    const d = addUnit(s, 'tank', 1, 6, 5);
    ok(s, { type: 'move', unit: r.id, to: { x: 3, y: 4 } });
    const pre = combatPreview(s, t, d);
    const loaded = JSON.parse(JSON.stringify(s));
    expect(isValidState(loaded)).toBe(true);
    const m = migrateState(loaded);
    const mt = m.units.find((u: Unit) => u.id === t.id)!;
    expect(mt.type).toBe('teslaTank');
    expect(combatPreview(m, mt, m.units.find((u: Unit) => u.id === d.id)!)).toEqual(pre);
    expect(canAttackNow(m.units.find((u: Unit) => u.id === r.id)!)).toBe(false);
    expect(m.units.find((u: Unit) => u.id === o.id)!.fuel).toBe(o.fuel);
  });
});

describe('Modelle / models', () => {
  it('eigene Modelle mit Leuchtmaske, andere Fraktionen ohne / own models with a glow mask, other factions without', () => {
    for (const t of ['teslaTank', 'octocopter', 'railSniper', 'infantry', 'jeep', 'artillery'] as const) {
      const g = unitGeometry(t, 'velkar', null);
      expect(g.getAttribute('position').count).toBeGreaterThan(0);
      expect(g.userData.unitGlow, t).toBe(true);
      const glow = g.getAttribute('glow');
      let lit = 0;
      for (let i = 0; i < glow.count; i++) if (glow.getX(i) > 0) lit++;
      expect(lit, t).toBeGreaterThan(0);
      // Dreiecksbudget wie die anderen Fraktionen / triangle budget like the other factions
      expect(g.getAttribute('position').count / 3, t).toBeLessThan(8000);
    }
    expect(unitGeometry('infantry', 'korvat', null).userData.unitGlow).toBeUndefined();
    expect(techParts('octocopter', 'velkar').filter((p) => p.kind === 'rotor')).toHaveLength(8);
    expect(techParts('teslaTank', 'velkar').some((p) => p.kind === 'arc')).toBe(true);
    expect(techParts('infantry', 'korvat')).toHaveLength(0);
  });
});

describe('KI mit Velkar / AI with Velkar', () => {
  it('KI-Partie mit Velkar: keine fehlgeschlagenen Befehle / AI game with Velkar: no failed commands', () => {
    let fails = 0, railMovedShots = 0;
    for (const seed of [3, 11]) {
      const s = createGame(defaultConfig({
        seed, size: 14, mapType: 'continent', mode: 'points',
        factions: (['velkar', 'korvat', 'nexus'] as FactionId[]).map((id) => ({ id, human: false, difficulty: 'normal' as const })),
      }));
      // Bauarten von Beginn an im Spiel / designs in play from the start
      const v = s.factions.findIndex((f) => f.id === 'velkar');
      s.factions[v].techs.push('camouflage', 'armyAviation');
      while (!s.over && s.round <= 30) {
        const f = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          const att = cmd.type === 'attack' ? s.units.find((u) => u.id === cmd.unit) : undefined;
          if (att?.type === 'railSniper' && att.moved) railMovedShots++;
          const res = applyCommand(s, cmd);
          if (!res.ok) fails++;
          if (cmd.type === 'endTurn' && res.ok) break;
        }
      }
    }
    expect(fails).toBe(0);
    expect(railMovedShots).toBe(0);
  }, 120_000);
});
