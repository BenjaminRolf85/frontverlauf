/**
 * Kampagne: Einrichtung, Ziele (Sieg und Niederlage), Speicherung und KI-Laeufe.
 * Campaign: setup, objectives (win and loss), saving and AI runs.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, cityAt, createGame, hqOf, MISSIONS, missionById, missionConfig, ownCities, type GameState,
} from '../src/core';
import { isValidState } from '../src/save/save';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI } from '../src/data/balance';

const game = (id: string) => createGame(missionConfig(id));

/** Zug beenden, offene Belohnungen vorher waehlen / end the turn, choosing open rewards first */
function endTurn(s: GameState) {
  for (const p of [...s.pendingRewards]) if (s.cities.find((c) => c.id === p.cityId)?.owner === s.current) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
  const r = applyCommand(s, { type: 'endTurn' });
  expect(r.ok).toBe(true);
  return r;
}
/** Bis Fraktion 0 wieder am Zug ist, alle Fraktionen passen / until faction 0 moves again, all factions pass */
function passRound(s: GameState) {
  endTurn(s);
  while (s.current !== 0 && !s.over) endTurn(s);
}
/** Ein harmloses Kommando, damit die Auswertung laeuft / a harmless command to trigger the evaluation */
function poke(s: GameState) {
  const u = s.units.find((x) => x.owner === s.current && !x.exhausted && !x.fresh && !x.moved && !x.attacked);
  if (!u) return applyCommand(s, { type: 'endTurn' });
  u.hp = Math.max(1, u.hp - 1);
  const r = applyCommand(s, { type: 'heal', unit: u.id });
  expect(r.ok).toBe(true);
  u.exhausted = false;
  return r;
}

describe('Kampagne: Einrichtung / campaign: setup', () => {
  it('hat 9 Missionen mit wechselnden Fraktionen / has 9 missions with varied factions', () => {
    expect(MISSIONS.length).toBeGreaterThanOrEqual(6);
    expect(MISSIONS.length).toBeLessThanOrEqual(10);
    const players = new Set(MISSIONS.map((m) => m.faction));
    for (const f of ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'vesper'] as const) {
      expect(players.has(f) || MISSIONS.some((m) => m.enemies.some((e) => e.id === f))).toBe(true);
    }
    expect(MISSIONS.some((m) => m.enemies.some((e) => e.id === 'nexus'))).toBe(true);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
  });

  it('jede Mission ist deterministisch und vollstaendig eingerichtet / every mission is deterministic and fully set up', () => {
    for (const m of MISSIONS) {
      const a = game(m.id), b = game(m.id);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.campaign?.mission).toBe(m.id);
      expect(a.config.campaign).toEqual({ mission: m.id });
      expect(a.factions[0].id).toBe(m.faction);
      expect(a.factions[0].human).toBe(true);
      expect(a.campaign!.status).toEqual(m.objectives.map(() => 'pending'));
      // jedes Ziel mit Zielfeld hat ein Zielfeld / every objective with a target has a target tile
      for (const o of [...m.objectives, ...m.bonus]) if ('target' in o) expect(a.campaign!.targets[o.target]).toBeDefined();
      expect(a.campaign!.startCities.length).toBe(ownCities(a, 0).length);
      // keine zwei Einheiten auf einem Feld / no two units on one tile
      const pos = a.units.map((u) => `${u.x},${u.y}`);
      expect(new Set(pos).size).toBe(pos.length);
    }
  });

  it('Spielstand mit Kampagne ist speicherbar und fortsetzbar / campaign state survives save and resume', () => {
    const s = game('m2');
    const copy = JSON.parse(JSON.stringify(s));
    expect(isValidState(copy)).toBe(true);
    expect(copy.config.campaign.mission).toBe('m2');
    expect(copy.campaign.targets).toEqual(s.campaign!.targets);
    passRound(copy);
    expect(copy.campaign.result).toBeNull();
  });

  it('besondere Einrichtung: Absturzstelle, Vulkanpass, Bunker / special setup: crash site, volcano pass, bunker', () => {
    const m4 = game('m4');
    const site = m4.campaign!.targets[0];
    expect(m4.tiles[site.y * m4.size + site.x].feature).toBe('crashSite');
    const m2 = game('m2');
    expect(m2.tiles.some((t) => t.volcano)).toBe(true);
    const m9 = game('m9');
    expect(hqOf(m9, 0)!.upgrades).toContain('bunker');
    // Gegner in m9 untereinander im Frieden / enemies in m9 at peace with each other
    expect(m9.factions[1].relations[2]).toBe('peace');
    const m6 = game('m6');
    for (const p of m6.campaign!.targets) expect(cityAt(m6, p.x, p.y)!.owner).toBe(1);
  });
});

describe('Kampagne: Ziele / campaign: objectives', () => {
  it('m1: drei Staedte erobern = Sieg mit 3 Sternen / three cities = win with 3 stars', () => {
    const s = game('m1');
    const villages = s.cities.filter((c) => c.owner === null).slice(0, 2);
    for (const c of villages) c.owner = 0;
    const r = poke(s);
    expect(r.events.some((e) => e.t === 'objective' && e.status === 'done')).toBe(true);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.campaign!.result).toBe('won');
    expect(s.campaign!.stars).toBe(3);
    expect(r.events.filter((e) => e.t === 'gameOver').length).toBe(1);
    // danach keine Kommandos mehr / no further commands
    expect(applyCommand(s, { type: 'endTurn' }).ok).toBe(false);
  });

  it('m1: Zeitlimit ueberschritten = Niederlage / time limit exceeded = defeat', () => {
    const s = game('m1');
    s.round = missionById('m1')!.rounds;
    for (const f of s.factions) f.human = true;
    passRound(s);
    expect(s.campaign!.result).toBe('lost');
    expect(s.campaign!.stars).toBe(0);
    expect(s.winner).toBe(1);
  });

  it('m1: spaeter Sieg verfehlt das Tempo-Bonusziel / a late win misses the speed bonus', () => {
    const s = game('m1');
    s.round = 12;
    for (const c of s.cities.filter((x) => x.owner === null).slice(0, 2)) c.owner = 0;
    poke(s);
    expect(s.campaign!.result).toBe('won');
    expect(s.campaign!.bonus).toEqual(['failed', 'done']);
    expect(s.campaign!.stars).toBe(2);
  });

  it('m2: Feind auf dem Pass zu Zugbeginn = Niederlage / enemy on the pass at turn start = defeat', () => {
    const s = game('m2');
    const pass = s.campaign!.targets[0];
    const blocker = s.units.find((u) => u.x === pass.x && u.y === pass.y);
    if (blocker) s.units = s.units.filter((u) => u !== blocker);
    const enemy = s.units.find((u) => u.owner === 1)!;
    enemy.x = pass.x; enemy.y = pass.y;
    // waehrend des eigenen Zuges noch nicht verloren / not lost during the own turn yet
    poke(s);
    expect(s.campaign!.result).toBeNull();
    for (const f of s.factions) f.human = true;
    passRound(s);
    expect(s.campaign!.status[0]).toBe('failed');
    expect(s.campaign!.result).toBe('lost');
  });

  it('m2: Pass und HQ bis zum Ende gehalten = Sieg / pass and HQ held to the end = win', () => {
    const s = game('m2');
    for (const f of s.factions) f.human = true;
    s.units = s.units.filter((u) => u.owner === 0);
    s.round = missionById('m2')!.rounds;
    passRound(s);
    expect(s.campaign!.result).toBe('won');
    expect(s.campaign!.status).toEqual(['done', 'done']);
    // Bonus "4 Abschuesse" verfehlt, "keine Stadt verloren" erfuellt / bonus kills missed, no city lost done
    expect(s.campaign!.bonus).toEqual(['failed', 'done']);
    expect(s.campaign!.stars).toBe(2);
  });

  it('m3: Verlust einer Stadt = Niederlage / losing a city = defeat', () => {
    const s = game('m3');
    const c = s.cities.find((x) => x.id === s.campaign!.startCities[1])!;
    c.owner = 1;
    poke(s);
    expect(s.campaign!.result).toBe('lost');
  });

  it('m4: Bergung durch den Spieler = Sieg, durch die Zyrr = Niederlage / salvage by player wins, by the Zyrr loses', () => {
    const win = game('m4');
    const site = win.campaign!.targets[0];
    const u = win.units.find((x) => x.owner === 0 && x.type === 'jeep')!;
    // Einheit direkt neben die Stelle setzen und hineinfahren / put the unit next to the site and drive in
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: site.x + dx, y: site.y + dy }))
      .find((p) => { const t = win.tiles[p.y * win.size + p.x]; return t && t.terrain !== 'ocean' && t.terrain !== 'shallow' && t.terrain !== 'mountain' && !win.units.some((o) => o.x === p.x && o.y === p.y); })!;
    u.x = near.x; u.y = near.y;
    const r = applyCommand(win, { type: 'move', unit: u.id, to: site });
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.t === 'salvage')).toBe(true);
    expect(win.campaign!.result).toBe('won');

    const lose = game('m4');
    for (const f of lose.factions) f.human = true;
    endTurn(lose); // Zyrr am Zug / Zyrr to move
    const z = lose.units.find((x) => x.owner === 1)!;
    z.x = near.x; z.y = near.y; z.moved = false; z.exhausted = false; z.fresh = false; z.moveDone = false;
    const r2 = applyCommand(lose, { type: 'move', unit: z.id, to: site });
    expect(r2.ok).toBe(true);
    expect(lose.campaign!.status[0]).toBe('failed');
    expect(lose.campaign!.result).toBe('lost');
  });

  it('m5/m6: Eroberung der Zielstaedte / capturing the target cities', () => {
    const s = game('m6');
    const [a, b] = s.campaign!.targets;
    cityAt(s, a.x, a.y)!.owner = 0;
    poke(s);
    expect(s.campaign!.status).toEqual(['done', 'pending']);
    expect(s.campaign!.result).toBeNull();
    cityAt(s, b.x, b.y)!.owner = 0;
    poke(s);
    expect(s.campaign!.result).toBe('won');
  });

  it('m7/m8: Punkte und Abschuesse / points and kills', () => {
    const s = game('m8');
    s.factions[0].kills = 7;
    poke(s);
    expect(s.campaign!.result).toBeNull();
    s.factions[0].kills = 8;
    poke(s);
    expect(s.campaign!.result).toBe('won');
    // Bonus: HQ nicht erobert, aber schnell / bonus: HQ not captured, but fast
    expect(s.campaign!.bonus).toEqual(['failed', 'done']);
    const p = game('m7');
    const r = poke(p);
    expect(r.ok).toBe(true);
    expect(p.campaign!.status[0]).toBe('pending');
  });

  it('m9: HQ verloren = Niederlage, Ueberleben bis zum Ende = Sieg / HQ lost = defeat, surviving = win', () => {
    const lost = game('m9');
    hqOf(lost, 0)!.owner = 1;
    poke(lost);
    expect(lost.campaign!.result).toBe('lost');
    const won = game('m9');
    for (const f of won.factions) f.human = true;
    won.round = missionById('m9')!.rounds;
    passRound(won);
    expect(won.campaign!.result).toBe('won');
  });

  it('Spieler ausgeschieden = Niederlage / player eliminated = defeat', () => {
    const s = game('m7');
    s.factions[0].alive = false;
    poke(s);
    expect(s.campaign!.result).toBe('lost');
    expect(s.winner).not.toBe(0);
  });

  it('alle Gegner ausgeschieden = Sieg / all enemies eliminated = win', () => {
    const s = game('m5');
    // der Kult besitzt nur sein Hauptquartier / the cult only owns its headquarters
    expect(ownCities(s, 1).length).toBe(1);
    const c = ownCities(s, 1)[0];
    const u = s.units.find((x) => x.owner === 0)!;
    s.units = s.units.filter((x) => x === u || !(x.x === c.x && x.y === c.y));
    u.x = c.x; u.y = c.y; u.exhausted = false; u.fresh = false; u.moved = false; u.startX = c.x; u.startY = c.y;
    const r = applyCommand(s, { type: 'capture', unit: u.id });
    expect(r.ok).toBe(true);
    expect(s.over).toBe(true);
    expect(s.campaign!.result).toBe('won');
    expect(r.events.filter((e) => e.t === 'gameOver').length).toBe(1);
  });
});

describe('Kampagne: KI spielt alle Missionen / AI plays all missions', () => {
  it('jede Mission endet ohne Fehlbefehle / every mission ends without failed commands', () => {
    const errors = aiDebug.errors;
    for (const m of MISSIONS) {
      const s = game(m.id);
      s.factions[0].human = false;
      let fails = 0, guard = 0;
      while (!s.over && guard++ < 30000) {
        const f = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
      expect(s.over, m.id).toBe(true);
      expect(s.campaign!.result, m.id).not.toBeNull();
      expect(s.round, m.id).toBeLessThanOrEqual(m.rounds + 1);
      expect(fails, m.id).toBe(0);
    }
    expect(aiDebug.errors).toBe(errors);
  }, 180_000);
});
