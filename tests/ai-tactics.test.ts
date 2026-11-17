/**
 * Operative Ebene der KI (src/ai/operations.ts): jede Taktik in einer Lehrbuchlage, dazu ganze Partien ohne Fehlbefehle.
 * Operational AI layer (src/ai/operations.ts): every tactic in a textbook situation, plus full games without failed commands.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, combatPreview, createGame, defaultConfig, dist, inRearArc, unitById, type Command, type GameState } from '../src/core';
import { AI, AI_TACTICS, TACTIC_KINDS, type Difficulty, type FactionId } from '../src/data/balance';
import { activeOps, aiDebug, opRoleOf, planNextCommand, setAiTactics, tacticStats, takeOpNews } from '../src/ai/ai';
import { opNotice } from '../src/ui/aiOps';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import { addCity, addUnit, blankGame, revealAll, setTerrain } from './helpers';

/** Leeres Feld fuer KI-Fraktionen auf "schwer" (jede Gelegenheit wird genutzt) / empty board for AI factions on "hard" (every opportunity is taken) */
function board(factions: FactionId[], size: 11 | 14 = 11): GameState {
  const s = blankGame({ factions, size });
  for (const f of s.factions) { f.human = false; f.difficulty = 'hard'; }
  for (let i = 0; i < factions.length; i++) revealAll(s, i);
  return s;
}

interface Played { cmd: Command; unit?: string; from?: { x: number; y: number }; rear?: boolean }

/** Einen ganzen KI-Zug spielen und mitschreiben (keine Fehlbefehle) / play a whole AI turn and record it (no failed commands) */
function turn(s: GameState, f = s.current): Played[] {
  expect(s.current).toBe(f);
  const out: Played[] = [];
  for (let i = 0; i < AI.maxCommandsPerTurn + 5; i++) {
    const cmd = planNextCommand(s, f);
    const p: Played = { cmd };
    if (cmd.type === 'attack' || cmd.type === 'move') {
      const u = unitById(s, cmd.unit)!;
      p.unit = u.type; p.from = { x: u.x, y: u.y };
      if (cmd.type === 'attack') p.rear = combatPreview(s, u, unitById(s, cmd.target)!).rear > 0;
    }
    const res = applyCommand(s, cmd);
    expect(res.ok, `${JSON.stringify(cmd)} ${res.error}`).toBe(true);
    out.push(p);
    if (cmd.type === 'endTurn') break;
  }
  return out;
}

/** Zug der anderen Fraktion ohne Handlung / the other faction's turn without action */
const pass = (s: GameState) => expect(applyCommand(s, { type: 'endTurn' }).ok).toBe(true);
const opsOf = (s: GameState, f: number, kind: string) => activeOps(s, f).filter((o) => o.kind === kind);
const attacks = (p: Played[]) => p.filter((x) => x.cmd.type === 'attack');

describe('KI-Taktiken: Lehrbuchlagen / AI tactics: textbook situations', () => {
  it('Sturmangriff: alle greifen in einem Zug an, die Artillerie eroeffnet / storm: all attack in one turn, the artillery opens', () => {
    const s = board(['dravon', 'korvat']);
    addCity(s, 1, 5, 0, { hq: true });
    const target = addCity(s, 7, 5, 1, { hq: true });
    addCity(s, 9, 1, 1);
    addUnit(s, 'mg', 1, 7, 5);
    const art = addUnit(s, 'artillery', 0, 4, 5);
    addUnit(s, 'tank', 0, 5, 4);
    addUnit(s, 'infantry', 0, 5, 6);
    addUnit(s, 'infantry', 0, 5, 5);
    const played = turn(s, 0);
    const storm = opsOf(s, 0, 'storm');
    expect(storm.length).toBe(1);
    expect(storm[0].city).toBe(target.id);
    expect(storm[0].stage).toBe('strike');
    expect(storm[0].members.length).toBe(4);
    const a = attacks(played);
    // Artillerie zuerst, dann der Panzer; der Verteidiger faellt im selben Zug / artillery first, then the tank; the defender falls in the same turn
    expect(a[0].unit).toBe('artillery');
    expect(a[0].cmd).toMatchObject({ unit: art.id });
    expect(a[1].unit).toBe('tank');
    expect(s.units.filter((u) => u.owner === 1).length).toBe(0);
    // die Infanterie rueckt zum Einnehmen an die Stadt / the infantry closes in to capture
    expect(s.units.filter((u) => u.owner === 0 && u.type === 'infantry').every((u) => dist(u, target) <= 1)).toBe(true);
    expect(tacticStats(s, 0).started.storm).toBe(1);
  });

  it('Sturmangriff: weit entfernt erst sammeln, niemand laeuft einzeln in den Feuerbereich / storm: gather first when far, nobody trickles into the fire zone', () => {
    const s = board(['dravon', 'korvat'], 14);
    addCity(s, 1, 7, 0, { hq: true });
    const target = addCity(s, 11, 7, 1, { hq: true });
    addCity(s, 12, 1, 1);
    addUnit(s, 'mg', 1, 11, 7);
    for (const [x, y] of [[7, 6], [7, 7], [7, 8], [6, 7]]) addUnit(s, 'infantry', 0, x, y);
    addUnit(s, 'tank', 0, 6, 6);
    turn(s, 0);
    const storm = opsOf(s, 0, 'storm');
    expect(storm.length).toBe(1);
    expect(storm[0].stage).toBe('gather');
    for (const m of storm[0].members) expect(dist(unitById(s, m.id)!, target)).toBeGreaterThanOrEqual(3);
  });

  it('Einkreisen: ein isolierter Gegner wird von zwei Seiten gefasst und von hinten getroffen / encirclement: an isolated enemy is caught from two sides and hit from behind', () => {
    const s = board(['korvat', 'dravon']);
    addCity(s, 1, 5, 0, { hq: true });
    addCity(s, 9, 9, 1, { hq: true });
    const e = addUnit(s, 'mg', 1, 5, 5); e.facing = 6;
    addUnit(s, 'infantry', 0, 3, 5);
    addUnit(s, 'infantry', 0, 3, 3);
    const rider = addUnit(s, 'steppeRider', 0, 5, 8);
    const played = turn(s, 0);
    const enc = opsOf(s, 0, 'encircle');
    expect(enc.length).toBe(1);
    expect(enc[0].unit).toBe(e.id);
    expect(enc[0].members.length).toBeGreaterThanOrEqual(2);
    // verschiedene Felder rund um das Ziel, das Feld des Reiters im Ruecken / different tiles around the target, the rider's tile behind it
    const slots = enc[0].members.filter((m) => m.slot).map((m) => `${m.slot!.x},${m.slot!.y}`);
    expect(new Set(slots).size).toBe(slots.length);
    const rs = enc[0].members.find((m) => m.id === rider.id)!.slot!;
    expect(inRearArc({ ...e, facing: 6 }, rs)).toBe(true);
    // der Reiter geht hinter das Ziel und greift von hinten an / the rider goes behind the target and attacks from behind
    expect(inRearArc({ ...e, x: 5, y: 5, facing: 6 }, rider)).toBe(true);
    expect(attacks(played).some((p) => p.unit === 'steppeRider' && p.rear)).toBe(true);
    // Ziel von zwei Seiten gefasst / target held from two sides
    expect(s.units.filter((u) => u.owner === 0 && dist(u, e) === 1).length).toBeGreaterThanOrEqual(2);
    pass(s);
    turn(s, 0);
    expect(unitById(s, e.id)).toBeUndefined();
    pass(s);
    turn(s, 0);
    expect(tacticStats(s, 0).completed.encircle).toBe(1);
  });

  it('Rueckenangriff: der Jeep faehrt hinter den gebundenen Gegner und greift dort an / rear attack: the jeep drives behind the engaged enemy and attacks there', () => {
    const s = board(['dravon', 'korvat']);
    addCity(s, 1, 5, 0, { hq: true });
    addCity(s, 9, 9, 1, { hq: true });
    const e = addUnit(s, 'mg', 1, 5, 5); e.facing = 6;
    // Begleiter: das Ziel ist nicht isoliert (kein Einkreisen) / escort: the target is not isolated (no encirclement)
    addUnit(s, 'infantry', 1, 6, 3).facing = 6;
    addUnit(s, 'infantry', 0, 4, 5);
    const jeep = addUnit(s, 'jeep', 0, 5, 8);
    const played = turn(s, 0);
    const rear = opsOf(s, 0, 'rear');
    expect(rear.length).toBe(1);
    expect(rear[0].members[0]).toMatchObject({ id: jeep.id, role: 'flanker' });
    // erst die Bewegung in den Ruecken, dann der Angriff mit +50 % / first the move into the rear, then the attack with +50 %
    const mi = played.findIndex((p) => p.cmd.type === 'move' && p.cmd.unit === jeep.id);
    const ai = played.findIndex((p) => p.cmd.type === 'attack' && p.cmd.unit === jeep.id);
    expect(mi).toBeGreaterThanOrEqual(0);
    expect(ai).toBeGreaterThan(mi);
    expect(played[ai].rear).toBe(true);
  });

  it('Abstimmung: der Frontkaempfer dreht das Ziel, der Starke trifft dann von hinten / coordination: the frontal fighter turns the target, the strong one then hits from behind', () => {
    const run = (on: boolean) => {
      const s = board(['meridon', 'korvat']);
      addCity(s, 1, 1, 0, { hq: true });
      addCity(s, 9, 9, 1, { hq: true });
      setAiTactics(s, 0, on);
      const e = addUnit(s, 'infantry', 1, 5, 5); e.facing = 0;
      addUnit(s, 'infantry', 0, 4, 5);
      addUnit(s, 'mg', 0, 6, 5);
      return attacks(turn(s, 0));
    };
    const neu = run(true), old = run(false);
    // neue KI: Infanterie zuerst (Ziel dreht sich nach Westen), dann das MG von hinten / new AI: infantry first, then the MG from behind
    expect(neu[0].unit).toBe('infantry');
    expect(neu[1]).toMatchObject({ unit: 'mg', rear: true });
    // alte KI: das MG zuerst und ohne Rueckenbonus / old AI: the MG first and without the rear bonus
    expect(old[0]).toMatchObject({ unit: 'mg', rear: false });
  });

  it('Vorgetaeuschter Rueckzug: der Koeder weicht in die Feuerzone, die Artillerie trifft den Verfolger / feigned retreat: the bait falls back into the kill zone, the artillery hits the pursuer', () => {
    const s = board(['korvat', 'dravon']);
    addCity(s, 1, 5, 0, { hq: true });
    addCity(s, 9, 9, 1, { hq: true });
    const art = addUnit(s, 'artillery', 0, 2, 5);
    const ent = addUnit(s, 'infantry', 0, 2, 4); ent.entrenched = true;
    const bait = addUnit(s, 'infantry', 0, 5, 5, { hp: 6 });
    const mg = addUnit(s, 'mg', 1, 7, 5); mg.facing = 6;
    addUnit(s, 'infantry', 1, 7, 6).facing = 6;
    const before = dist(bait, mg);
    turn(s, 0);
    expect(opsOf(s, 0, 'feint').length).toBe(1);
    expect(opRoleOf(s, 0, bait.id)?.role).toBe('bait');
    expect(opRoleOf(s, 0, art.id)?.role).toBe('killzone');
    // Koeder zurueck, Feuerzone bleibt stehen (verschanzt) / bait back, kill zone stays put (entrenched)
    expect(dist(bait, mg)).toBeGreaterThan(before);
    expect(dist(bait, art)).toBeLessThan(3);
    expect([art.x, art.y, ent.x, ent.y]).toEqual([2, 5, 2, 4]);
    // der Gegner (KI) setzt nach, die Feuerzone schlaegt zu / the enemy (AI) follows, the kill zone strikes
    turn(s, 1);
    const enemyHp = () => s.units.filter((u) => u.owner === 1).reduce((a, u) => a + u.hp, 0);
    const hp0 = enemyHp();
    const played = turn(s, 0);
    expect(attacks(played).some((p) => p.cmd.type === 'attack' && p.cmd.unit === art.id)).toBe(true);
    expect(enemyHp()).toBeLessThan(hp0);
  });

  it('Hinterhalt: der Scharfschuetze wartet im Wald ausserhalb der Reichweite und feuert ohne Bewegung / ambush: the marksman waits in the forest out of reach and fires without moving', () => {
    const s = board(['velkar', 'dravon']);
    addCity(s, 2, 8, 0, { hq: true });
    addCity(s, 9, 1, 1, { hq: true });
    setTerrain(s, 4, 5, 'forest');
    const sn = addUnit(s, 'railSniper', 0, 3, 4);
    addUnit(s, 'infantry', 1, 8, 5).facing = 5;
    addUnit(s, 'infantry', 1, 8, 6).facing = 5;
    turn(s, 0);
    const amb = opsOf(s, 0, 'ambush');
    expect(amb.length).toBe(1);
    expect(amb[0].members[0]).toMatchObject({ id: sn.id, role: 'ambusher', slot: { x: 4, y: 5 } });
    // im Wald, ausserhalb der gegnerischen Reichweite / in the forest, out of enemy reach
    expect([sn.x, sn.y]).toEqual([4, 5]);
    for (const e of s.units.filter((u) => u.owner === 1)) expect(dist(e, sn)).toBeGreaterThan(2);
    turn(s, 1);
    const played = turn(s, 0);
    const shot = played.find((p) => p.cmd.type === 'attack' && p.cmd.unit === sn.id);
    expect(shot).toBeDefined();
    // ohne Bewegung (voller Schaden) / without moving (full damage)
    expect(shot!.from).toEqual({ x: 4, y: 5 });
    expect(played.findIndex((p) => p.cmd.type === 'move' && p.cmd.unit === sn.id)).toBe(-1);
  });

  it('Ablenkung: die Hauptmacht greift an, ein Jeep nimmt die entlegene unbewachte Stadt / diversion: the main force attacks, a jeep takes the remote undefended city', () => {
    const s = board(['dravon', 'korvat'], 14);
    addCity(s, 1, 6, 0, { hq: true });
    addCity(s, 10, 2, 1, { hq: true });
    const remote = addCity(s, 10, 11, 1);
    addUnit(s, 'mg', 1, 10, 2);
    addUnit(s, 'mg', 1, 11, 3);
    for (const [x, y] of [[7, 2], [7, 3], [7, 1]]) addUnit(s, 'infantry', 0, x, y);
    const jeep = addUnit(s, 'jeep', 0, 4, 9);
    turn(s, 0);
    const div = opsOf(s, 0, 'diversion');
    expect(div.length).toBe(1);
    expect(div[0].city).toBe(remote.id);
    expect(div[0].members.find((m) => m.role === 'raider')?.id).toBe(jeep.id);
    expect(div[0].members.filter((m) => m.role === 'pin').length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 3 && remote.owner !== 0; i++) { pass(s); turn(s, 0); }
    expect(remote.owner).toBe(0);
    pass(s);
    turn(s, 0);
    expect(tacticStats(s, 0).diversionCaptures).toBe(1);
    // die Hauptmacht hat an der Front angegriffen / the main force attacked at the front
    expect(s.factions[0].lastAttackRound).toBeGreaterThanOrEqual(3);
  });

  it('ohne Taktik (alte KI) keine Operationen / without tactics (old AI) no operations', () => {
    const s = board(['dravon', 'korvat']);
    setAiTactics(s, 0, false);
    addCity(s, 1, 5, 0, { hq: true });
    addCity(s, 7, 5, 1, { hq: true });
    addUnit(s, 'mg', 1, 7, 5);
    addUnit(s, 'artillery', 0, 4, 5);
    addUnit(s, 'tank', 0, 5, 4);
    addUnit(s, 'infantry', 0, 5, 6);
    turn(s, 0);
    expect(activeOps(s, 0).length).toBe(0);
    expect(TACTIC_KINDS.every((k) => tacticStats(s, 0).started[k] === 0)).toBe(true);
  });

  it('leicht: nur einfache Taktiken, hoechstens eine Operation / easy: simple tactics only, at most one operation', () => {
    expect(AI_TACTICS.difficulty.easy.maxOps).toBe(1);
    expect(AI_TACTICS.difficulty.easy.kinds).not.toContain('diversion');
    expect(AI_TACTICS.difficulty.easy.coordinate).toBe(false);
    expect(AI_TACTICS.difficulty.hard.kinds.length).toBe(TACTIC_KINDS.length);
  });
});

describe('KI-Taktiken: Meldungen / AI tactics: notices', () => {
  /** Mensch (0) gegen KI (1), die eine Stadt des Menschen stuermt / human (0) vs AI (1) storming a city of the human */
  function stormOnHuman(seeAttackers: boolean) {
    const s = board(['korvat', 'dravon']);
    s.factions[0].human = true;
    const city = addCity(s, 7, 5, 0, { hq: true });
    addCity(s, 1, 5, 1, { hq: true });
    addUnit(s, 'mg', 0, 7, 5);
    for (const [t, x, y] of [['artillery', 4, 5], ['tank', 5, 4], ['infantry', 5, 6], ['infantry', 5, 5]] as const) addUnit(s, t, 1, x, y);
    if (!seeAttackers) s.factions[0].explored = s.factions[0].explored.map((_, k) => (k % s.size >= 6 ? 1 : 0));
    pass(s);
    // die Oberflaeche holt die Meldungen gleich nach dem ersten Befehl ab (vor den Zuegen) / the UI takes the notices right after the first command (before the moves)
    const first = planNextCommand(s, 1);
    const news = takeOpNews(s);
    const notices = news.map((n) => ({ n, human: opNotice(n, s, 0), ai: opNotice(n, s, 1) }));
    expect(applyCommand(s, first).ok).toBe(true);
    turn(s, 1);
    return { s, city, notices };
  }

  it('meldet einen sichtbaren Sturm auf die eigene Stadt (DE+EN) / reports a visible storm on an own city (DE+EN)', () => {
    const { s, city, notices } = stormOnHuman(true);
    const n = notices.find((x) => x.n.kind === 'storm');
    expect(n).toBeDefined();
    expect(n!.human).toEqual({ key: 'storm', faction: 1, city: city.id });
    // die KI selbst bekommt nichts / the AI itself gets nothing
    expect(n!.ai).toBeNull();
    expect(de.aiOps.storm).toContain('{city}');
    expect(en.aiOps.storm).toContain('{city}');
    expect(Object.keys(de.aiOps).sort()).toEqual(Object.keys(en.aiOps).sort());
    // einmal abgeholt ist die Liste leer / once taken the list is empty
    expect(takeOpNews(s)).toEqual([]);
  });

  it('verraet nichts aus dem Nebel / reveals nothing from the fog', () => {
    const { notices } = stormOnHuman(false);
    const n = notices.find((x) => x.n.kind === 'storm');
    expect(n).toBeDefined();
    expect(n!.human).toBeNull();
  });
});

describe('KI-Taktiken: ganze Partien / AI tactics: full games', () => {
  it('Eroberung auf allen Schwierigkeiten: keine Fehlbefehle, Operationen laufen / conquest on all difficulties: no failed commands, operations run', () => {
    const errors = aiDebug.errors;
    const facs: FactionId[] = ['dravon', 'korvat', 'vesper', 'zyrr'];
    for (const d of ['easy', 'normal', 'hard', 'extreme'] as Difficulty[]) {
      const s = createGame(defaultConfig({
        seed: 77, size: 14, mapType: 'continent', mode: 'conquest', factionVictory: false,
        factions: facs.map((id) => ({ id, human: false, difficulty: d })),
      }));
      let fails = 0;
      while (!s.over && s.round <= 40) {
        const f = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          const res = applyCommand(s, cmd);
          if (!res.ok) fails++;
          if (cmd.type === 'endTurn' && res.ok) break;
        }
        // leicht: nie mehr als eine Operation je Fraktion / easy: never more than one operation per faction
        if (d === 'easy') expect(activeOps(s, f).length).toBeLessThanOrEqual(1);
      }
      expect(fails, d).toBe(0);
      let started = 0;
      for (let i = 0; i < facs.length; i++) for (const k of TACTIC_KINDS) started += tacticStats(s, i).started[k];
      expect(started, d).toBeGreaterThan(0);
    }
    expect(aiDebug.errors).toBe(errors);
  }, 120_000);
});
