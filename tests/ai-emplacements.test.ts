/**
 * KI und Geschuetzstellungen: Dravon baut Stellungen ohne Fehlbefehle (Punkte und Eroberung), Gegner greifen sie an,
 * schwache Einheiten meiden die Schussweite; Kampagne mit Dravon als Spielerfraktion.
 * AI and gun emplacements: Dravon builds emplacements without failed commands (points and conquest), opponents attack
 * them, weak units avoid the range; campaign with Dravon as the player faction.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, createGame, defaultConfig, emplacementCheck, emplacementsOf, missionConfig, turretList, type Command, type GameState,
} from '../src/core';
import { AI, EMPLACEMENT, VERDAN, type FactionId, type GameMode } from '../src/data/balance';
import { aiDebug, planNextCommand } from '../src/ai/ai';
import { addCity, addUnit, blankGame, revealAll } from './helpers';

/** Spielt wie die Oberflaeche und zaehlt Fehlbefehle und Stellungs-Ereignisse / plays like the UI and counts failed commands and emplacement events */
function run(s: GameState, maxRounds: number) {
  const st = { fails: 0, built: 0, shots: 0, hits: 0 };
  while (!s.over && s.round <= maxRounds) {
    const f = s.current;
    for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
      const cmd = planNextCommand(s, f);
      const res = applyCommand(s, cmd);
      if (!res.ok) st.fails++;
      for (const e of res.events) {
        if (e.t === 'emplacement') st.built++;
        if (e.t === 'turretFire' && e.owner !== undefined) st.shots++;
        if (e.t === 'turretHit' && e.owner !== undefined) st.hits++;
      }
      if (cmd.type === 'endTurn' && res.ok) break;
    }
  }
  return st;
}

const game = (seed: number, ids: FactionId[], mode: GameMode) => createGame(defaultConfig({
  seed, size: 14, mapType: mode === 'points' ? (seed % 2 ? 'continents' : 'continent') : 'continent', mode, roundLimit: mode === 'conquest' ? null : undefined,
  factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' })),
}));

describe('KI baut Geschuetzstellungen / AI builds gun emplacements', () => {
  it('Punkte und Eroberung, mehrere Seeds: keine Fehlbefehle, Stellungen gebaut und im Einsatz / points and conquest, several seeds: no failed commands, emplacements built and used', () => {
    const errors = aiDebug.errors;
    const runs: [number, FactionId[], GameMode][] = [
      [9, ['dravon', 'korvat', 'zyrr'], 'points'],
      [114, ['dravon', 'nexus', 'velkar'], 'points'],
      [33, ['dravon', 'alvenia', 'velkar'], 'points'],
      [75, ['dravon', 'meridon', 'alvenia'], 'points'],
      [1, ['dravon', 'korvat', 'alvenia'], 'conquest'],
      [9, ['dravon', 'korvat', 'alvenia'], 'conquest'],
      [3, ['velkar', 'dravon', 'meridon'], 'sandbox'],
    ];
    let built = 0, shots = 0;
    for (const [seed, ids, mode] of runs) {
      const s = game(seed, ids, mode);
      const st = run(s, 40);
      expect(st.fails, `seed ${seed} ${mode}`).toBe(0);
      built += st.built; shots += st.shots;
      // nie mehr Stellungen als Staedte / never more emplacements than cities
      const d = ids.indexOf('dravon');
      if (s.factions[d].alive) expect(emplacementsOf(s, d).length).toBeLessThanOrEqual(s.cities.filter((c) => c.owner === d).length * EMPLACEMENT.perCity);
    }
    expect(built).toBeGreaterThanOrEqual(4);
    expect(shots).toBeGreaterThan(0);
    expect(aiDebug.errors).toBe(errors);
  }, 120_000);

  it('baut an der bedrohten Grenzstadt / builds at the threatened border city', () => {
    const s = blankGame({ factions: ['dravon', 'korvat'], stars: 120 });
    for (const f of s.factions) { f.human = false; revealAll(s, f.index); }
    s.factions[0].techs.push('fortification');
    addCity(s, 2, 5, 0, { hq: true });
    addCity(s, 9, 5, 1, { hq: true });
    const pio = addUnit(s, 'pioneer', 0, 3, 5);
    addUnit(s, 'infantry', 1, 7, 5);
    addUnit(s, 'infantry', 1, 7, 4);
    const cmds: Command[] = [];
    for (let i = 0; i < 40 && s.current === 0; i++) {
      const c = planNextCommand(s, 0);
      const r = applyCommand(s, c);
      expect(r.ok, JSON.stringify(c)).toBe(true);
      cmds.push(c);
    }
    const built = cmds.find((c) => c.type === 'emplacement');
    expect(built).toBeDefined();
    expect(built).toMatchObject({ unit: pio.id });
    expect(emplacementsOf(s, 0).length).toBe(1);
  });

  it('Gegner greifen eine Stellung an, schwache Einheiten bleiben draussen / opponents attack an emplacement, weak units stay out', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 0 });
    for (const f of s.factions) { f.human = false; revealAll(s, f.index); }
    addCity(s, 2, 5, 0, { hq: true });
    addCity(s, 8, 5, 1, { hq: true });
    s.tiles[5 * s.size + 7].turret = { hp: 4, active: true, owner: 1 };
    // Artillerie in Reichweite 3, ausserhalb des Gegenfeuers / artillery in range 3, outside the return fire
    const art = addUnit(s, 'artillery', 0, 4, 5);
    const c = planNextCommand(s, 0);
    expect(c).toMatchObject({ type: 'attackTurret', unit: art.id, x: 7, y: 5 });
    expect(applyCommand(s, c).ok).toBe(true);
    // Sanitaeter (kein Angriff) meidet die Schussweite / medic (no attack) avoids the range
    const s2 = blankGame({ factions: ['korvat', 'dravon'], stars: 0 });
    for (const f of s2.factions) { f.human = false; revealAll(s2, f.index); }
    addCity(s2, 1, 5, 0, { hq: true });
    addCity(s2, 9, 9, 1, { hq: true });
    s2.tiles[5 * s2.size + 6].turret = { hp: EMPLACEMENT.hp, active: true, owner: 1 };
    const med = addUnit(s2, 'medic', 0, 3, 5);
    for (let i = 0; i < 20 && s2.current === 0; i++) {
      const cmd = planNextCommand(s2, 0);
      expect(applyCommand(s2, cmd).ok).toBe(true);
    }
    expect(Math.max(Math.abs(med.x - 6), Math.abs(med.y - 5))).toBeGreaterThan(EMPLACEMENT.range);
  });
});

describe('Kampagne / campaign', () => {
  it('Dravon als Spielerfraktion baut in der Kampagne, Verdan-Geschuetze in m9 bleiben neutral / Dravon as the player faction builds in the campaign, Verdan guns in m9 stay neutral', () => {
    const s = createGame(missionConfig('m8', 'dravon'));
    expect(s.factions[0].id).toBe('dravon');
    const city = s.cities.find((c) => c.owner === 0)!;
    s.factions[0].techs.push('fortification');
    s.factions[0].stars = 100;
    const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: city.x + dx, y: city.y + dy }));
    let done = false;
    for (const p of spots) {
      if (done || s.units.some((u) => u.x === p.x && u.y === p.y)) continue;
      const u = addUnit(s, 'pioneer', 0, p.x, p.y);
      for (const q of spots.concat([{ x: city.x + 2, y: city.y }, { x: city.x, y: city.y + 2 }, { x: city.x - 2, y: city.y }, { x: city.x, y: city.y - 2 }])) {
        if (emplacementCheck(s, u, q.x, q.y) !== 'ok') continue;
        expect(applyCommand(s, { type: 'emplacement', unit: u.id, x: q.x, y: q.y }).ok).toBe(true);
        done = true;
        break;
      }
      if (!done) s.units = s.units.filter((o) => o.id !== u.id);
    }
    expect(done).toBe(true);
    expect(emplacementsOf(s, 0).length).toBe(1);
    const m9 = createGame(missionConfig('m9', 'dravon'));
    expect(turretList(m9).length).toBe(VERDAN.count);
    expect(turretList(m9).every((p) => p.owner === undefined)).toBe(true);
  });
});
