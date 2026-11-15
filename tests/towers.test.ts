/**
 * Sendetuerme der Kampagne: Platzierung (deterministisch, verteilt, nicht in der Hoehle, nicht in freien Partien),
 * Einnahme, Ausbildung, kein Wachstum, keine Ausbauten, festes Einkommen, Zaehlung als Ort, KI ohne Fehlbefehle.
 * Campaign transmitter towers: placement (deterministic, spread out, not in the cavern, not in free games), capture,
 * training, no growth, no upgrades, fixed income, counted as a place, AI without failed commands.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyCommand, cityIncome, cityUpgradeCheck, createGame, defaultConfig, dist, missionConfig, missionById, towerCount, unitLimit, MISSIONS,
  CAMPAIGN_FACTIONS, type City, type GameState, type Unit,
} from '../src/core';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI, TOWER } from '../src/data/balance';
import { towerGeometry } from '../src/render/models/towers';
import { withGlow } from '../src/render/atmosphere';

const towers = (s: GameState) => s.cities.filter((c) => c.tower);
function placeAt(s: GameState, u: Unit, p: { x: number; y: number }) {
  s.units = s.units.filter((o) => o === u || !(o.x === p.x && o.y === p.y));
  Object.assign(u, { x: p.x, y: p.y, startX: p.x, startY: p.y, fresh: false, exhausted: false, moved: false, attacked: false, moveDone: false });
}

describe('Sendetuerme / transmitter towers', () => {
  it('Platzierung: deterministisch, verteilt, fern der Hauptquartiere; nicht in der Hoehle und nicht in freien Partien / placement: deterministic, spread, away from HQs; not in the cavern, not in free games', () => {
    for (const m of MISSIONS) for (const f of ['korvat', 'meridon'] as const) {
      const s = createGame(missionConfig(m.id, f));
      const list = towers(s);
      const tag = `${m.id}/${f}`;
      if (m.theme === 'cavern') { expect(list, tag).toHaveLength(0); continue; }
      // so viele wie vorgesehen, auf engen Karten mindestens TOWER.min / as many as planned, on tight maps at least TOWER.min
      expect(list.length, tag).toBeLessThanOrEqual(towerCount(m));
      expect(list.length, tag).toBeGreaterThanOrEqual(TOWER.min);
      expect(list.length, tag).toBeLessThanOrEqual(TOWER.max);
      for (const t of list) {
        expect(t.owner, tag).toBeNull();
        expect(s.tiles[t.y * s.size + t.x].cityId).toBe(t.id);
        for (const h of s.cities.filter((c) => c.isHQ)) expect(dist(h, t), tag).toBeGreaterThanOrEqual(TOWER.hqDistance);
        for (const o of list) if (o !== t) expect(dist(o, t), tag).toBeGreaterThanOrEqual(TOWER.spacing);
      }
      expect(JSON.stringify(towers(createGame(missionConfig(m.id, f)))), tag).toBe(JSON.stringify(list));
    }
    const free = createGame(defaultConfig({ seed: 5, size: 16, mapType: 'continent', factions: [{ id: 'korvat', human: true, difficulty: 'normal' }, { id: 'zyrr', human: false, difficulty: 'normal' }] }));
    expect(towers(free)).toHaveLength(0);
  });

  it('Einnahme, Ausbildung, festes Einkommen, kein Wachstum, keine Ausbauten / capture, training, fixed income, no growth, no upgrades', () => {
    const s = createGame(missionConfig('m4', 'dravon'));
    for (const f of s.factions) f.human = true;
    const t = towers(s)[0] as City;
    const inf = s.units.find((u) => u.owner === 0 && u.type === 'infantry') ?? s.units.find((u) => u.owner === 0)!;
    placeAt(s, inf, t);
    const r = applyCommand(s, { type: 'capture', unit: inf.id });
    expect(r.ok).toBe(true);
    expect(t.owner).toBe(0);
    expect(cityIncome(s, t)).toBe(TOWER.income);
    expect(unitLimit(s, t)).toBe(TOWER.unitLimit);
    expect(cityUpgradeCheck(s, 0, t, 'bunker')).toBe('noSlot');
    // ausbilden auf einem freien Nachbarfeld / train with the tower tile cleared
    const n = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]].map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy }))
      .find((p) => { const tt = s.tiles[p.y * s.size + p.x]; return tt && tt.terrain !== 'mountain' && tt.terrain !== 'ocean' && tt.terrain !== 'shallow' && tt.cityId === null && !s.units.some((u) => u.x === p.x && u.y === p.y); })!;
    placeAt(s, inf, n);
    s.factions[0].stars = 99;
    expect(applyCommand(s, { type: 'train', city: t.id, unitType: 'infantry' }).ok).toBe(true);
    // kein Wachstum, auch nicht durch Runden / no growth, not even over rounds
    const level = t.level;
    for (let i = 0; i < 4; i++) for (let k = 0; k < s.factions.length; k++) {
      for (const p of [...s.pendingRewards]) if (s.cities.find((c) => c.id === p.cityId)?.owner === s.current) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
      applyCommand(s, { type: 'endTurn' });
    }
    expect(t.level).toBe(level);
    expect(t.pop).toBe(0);
    expect(s.pendingRewards.some((p) => p.cityId === t.id)).toBe(false);
  });

  it('Zaehlt bei Staedte-Zielen mit (m12) / counts for cities objectives (m12)', () => {
    const s = createGame(missionConfig('m12', 'korvat'));
    const need = missionById('m12')!.objectives[1];
    expect(need.k).toBe('cities');
    const n = need.k === 'cities' ? need.n : 0;
    // Aussenposten der Landung, dann Tuerme vor anderen Orten / the landing outpost, then towers before other places
    const out = s.cities.find((c) => c.x === s.campaign!.targets[0].x && c.y === s.campaign!.targets[0].y)!;
    out.owner = 0;
    const list = [...towers(s), ...s.cities.filter((c) => c.owner === null && !c.tower)].slice(0, n - 1);
    expect(list.filter((c) => c.tower).length).toBeGreaterThan(0);
    for (const c of list) c.owner = 0;
    const u = s.units.find((x) => x.owner === 0)!;
    u.hp -= 1;
    expect(applyCommand(s, { type: 'heal', unit: u.id }).ok).toBe(true);
    expect(s.campaign!.result).toBe('won');
  });

  it('Modelle je Welt mit Licht und Fraktionsmarke / models per world with light and faction marker', () => {
    for (const w of ['earth', 'alien', 'desert'] as const) {
      const free = towerGeometry(w, null), own = towerGeometry(w, 'velkar');
      expect(free.getAttribute('position').count).toBeGreaterThan(50);
      expect(own.getAttribute('position').count).toBeGreaterThan(free.getAttribute('position').count);
      const g = withGlow(free.clone(), 'built').getAttribute('glow');
      let lit = 0;
      for (let i = 0; i < g.count; i++) if (g.getX(i) > 0) lit++;
      expect(lit, w).toBeGreaterThan(0);
    }
    void THREE;
  });

  it('KI nimmt Tuerme ein und bildet dort aus, ohne Fehlbefehle / AI captures towers and trains there, without failed commands', () => {
    const errors = aiDebug.errors;
    let held = 0;
    for (const id of ['m1', 'm4', 'm10', 'm13']) for (const f of ['korvat', 'meridon'] as const) {
      const s = createGame(missionConfig(id, f));
      s.factions[0].human = false;
      let fails = 0, guard = 0;
      while (!s.over && s.round <= 10 && guard++ < 20000) {
        const fi = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
      expect(fails, `${id}/${f}`).toBe(0);
      held += towers(s).filter((c) => c.owner !== null).length;
    }
    expect(held).toBeGreaterThan(0);
    expect(aiDebug.errors).toBe(errors);
    void CAMPAIGN_FACTIONS;
  }, 300_000);
});
