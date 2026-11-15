/**
 * Kampagne m4 "Die Kriegsplaene": Fanatiker-Tempel (2x2, unpassierbar), Bergen nur daneben, Traeger im Spielstand,
 * Abliefern, Fallenlassen und Aufheben, Rueckholung durch den Kult, Verfolgerwellen, Determinismus und KI-Lauf.
 * Campaign m4 "The War Plans": Fanatic temple (2x2, impassable), seizing only next to it, carrier in the save,
 * delivery, dropping and picking up, recovery by the cult, pursuit waves, determinism and an AI run.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, CAMPAIGN_FACTIONS, convertTargets, createGame, dist, hqOf, isLand, missionConfig, plansCarrier, plansHints, reachable,
  seizeCheck, templeDist, templeRing, templeTiles, unitAt, type GameEvent, type GameState, type Pos, type Unit,
} from '../src/core';
import { freeFor } from '../src/core/spawn';
import { isValidState, migrateState } from '../src/save/save';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI, TEMPLE_PLANS, type FactionId } from '../src/data/balance';

const game = (f: FactionId = 'korvat') => createGame(missionConfig('m4', f));

/** Einheit bereit auf ein Feld setzen (Besetzer weg) / put a unit, ready, onto a tile (occupant removed) */
function placeAt(s: GameState, u: Unit, p: Pos) {
  s.units = s.units.filter((o) => o === u || !(o.x === p.x && o.y === p.y));
  Object.assign(u, { x: p.x, y: p.y, startX: p.x, startY: p.y, fresh: false, exhausted: false, moved: false, attacked: false, moveDone: false });
}
/** Zug beenden, Belohnungen vorher / end the turn, rewards first */
function endTurn(s: GameState) {
  for (const p of [...s.pendingRewards]) if (s.cities.find((c) => c.id === p.cityId)?.owner === s.current) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
  const r = applyCommand(s, { type: 'endTurn' });
  expect(r.ok).toBe(true);
  return r;
}
/** Bis Fraktion 0 wieder am Zug ist / until faction 0 moves again */
function passRound(s: GameState): GameEvent[] {
  const ev = [...endTurn(s).events];
  while (s.current !== 0 && !s.over) ev.push(...endTurn(s).events);
  return ev;
}
/** die acht Nachbarn / the eight neighbours */
const around = (s: GameState, p: Pos): Pos[] => [...Array(9).keys()].map((i) => ({ x: p.x + (i % 3) - 1, y: p.y + Math.floor(i / 3) - 1 }))
  .filter((q) => dist(q, p) === 1 && q.x >= 0 && q.y >= 0 && q.x < s.size && q.y < s.size);
/** begehbares Feld fuer Fusstruppen und Jeeps / walkable tile for foot troops and jeeps */
const walk = (s: GameState, q: Pos) => { const t = s.tiles[q.y * s.size + q.x]; return !!t && q.x >= 0 && q.y >= 0 && q.x < s.size && q.y < s.size && isLand(t) && t.terrain !== 'mountain' && !t.temple && t.cityId === null; };
const jeepOf = (s: GameState) => s.units.find((u) => u.owner === 0 && u.type === 'jeep')!;
/** Jeep neben den Tempel stellen und bergen / put the jeep next to the temple and seize */
function seize(s: GameState): Unit {
  const j = jeepOf(s);
  placeAt(s, j, templeRing(s)[0]);
  const r = applyCommand(s, { type: 'seizePlans', unit: j.id });
  expect(r.ok).toBe(true);
  return j;
}

describe('m4: Fanatiker-Tempel / Fanatic temple', () => {
  it('belegt vier unpassierbare Felder, niemand betritt oder bebaut sie / occupies four impassable tiles nobody enters or builds on', () => {
    const s = game();
    const a = s.campaign!.temple!;
    const tiles = templeTiles(a);
    expect(tiles.length).toBe(4);
    expect(s.tiles.filter((t) => t.temple).length).toBe(4);
    for (const q of tiles) {
      const t = s.tiles[q.y * s.size + q.x];
      expect(t.temple).toBe(true);
      expect(t.terrain).toBe('plain');
      expect(t.cityId).toBeNull();
      expect(unitAt(s, q.x, q.y)).toBeUndefined();
      expect(freeFor(s, 'infantry', q)).toBe(false);
    }
    // kein Weg fuehrt hinein, auch nicht fuer Flieger / no path leads in, not even for flyers
    const j = jeepOf(s);
    placeAt(s, j, templeRing(s)[0]);
    expect(reachable(s, j).some((r) => templeDist(a, r) === 0)).toBe(false);
    expect(reachable(s, j).some((r) => templeDist(a, r) === 1)).toBe(true);
  });

  it('Einrichtung fuer alle fuenf Menschen-Fraktionen: Tempel 7 bis 10 Felder entfernt, ueber Land erreichbar, mit Wache / setup for all five human factions', () => {
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game(f);
      const c = s.campaign!;
      expect(c.temple, f).toBeDefined();
      expect(c.plans, f).toEqual({ at: 'temple', drops: 0, pursuit: 0, owner: 1 });
      const hq = hqOf(s, 0)!;
      const d = templeDist(c.temple!, hq);
      expect(d, f).toBeGreaterThanOrEqual(TEMPLE_PLANS.hqMin);
      expect(d, f).toBeLessThanOrEqual(TEMPLE_PLANS.hqMax);
      expect(templeDist(c.temple!, hqOf(s, 1)!), f).toBeGreaterThanOrEqual(TEMPLE_PLANS.enemyMin);
      expect(s.cities.every((x) => templeDist(c.temple!, x) >= TEMPLE_PLANS.cityGap), f).toBe(true);
      // Landweg ohne Berge vom Hauptquartier an den Tempel / land route without mountains from the HQ to the temple
      const seen = new Set([hq.y * s.size + hq.x]);
      const stack: Pos[] = [hq];
      let ok = false;
      while (stack.length) {
        const p = stack.pop()!;
        if (templeDist(c.temple!, p) === 1) { ok = true; break; }
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const q = { x: p.x + dx, y: p.y + dy };
          const t = s.tiles[q.y * s.size + q.x];
          if (q.x < 0 || q.y < 0 || q.x >= s.size || q.y >= s.size || !t || seen.has(q.y * s.size + q.x) || !isLand(t) || t.terrain === 'mountain' || t.temple) continue;
          seen.add(q.y * s.size + q.x); stack.push(q);
        }
      }
      expect(ok, f).toBe(true);
      // Wache des Kults am Tempel, Jeep des Spielers / cult guard at the temple, the player's jeep
      expect(s.units.filter((u) => u.owner === 1 && templeDist(c.temple!, u) <= 2).length, f).toBeGreaterThanOrEqual(TEMPLE_PLANS.guards.length);
      expect(s.units.some((u) => u.owner === 0 && u.type === 'jeep'), f).toBe(true);
      // alle kennen den Tempel / everyone knows the temple
      for (const fa of s.factions) expect(fa.explored[c.temple!.y * s.size + c.temple!.x], f).toBe(1);
    }
  });
});

describe('m4: Kriegsplaene / war plans', () => {
  it('Bergen nur direkt neben dem Tempel; beendet den Zug; Flieger und fremde Einheiten nie / seizing only right next to the temple; ends the turn', () => {
    const s = game();
    const a = s.campaign!.temple!;
    const j = jeepOf(s);
    const two = templeRing(s).map((q) => ({ x: q.x + (q.x < a.x ? -1 : q.x > a.x + 1 ? 1 : 0), y: q.y + (q.y < a.y ? -1 : q.y > a.y + 1 ? 1 : 0) }))
      .find((q) => templeDist(a, q) === 2 && isLand(s.tiles[q.y * s.size + q.x]) && s.tiles[q.y * s.size + q.x].terrain !== 'mountain')!;
    placeAt(s, j, two);
    expect(seizeCheck(s, j)).toBe('outOfRange');
    expect(applyCommand(s, { type: 'seizePlans', unit: j.id }).error).toBe('outOfRange');
    expect(s.campaign!.plans!.at).toBe('temple');
    placeAt(s, j, templeRing(s)[0]);
    expect(seizeCheck(s, j)).toBe('ok');
    const r = applyCommand(s, { type: 'seizePlans', unit: j.id });
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.t === 'plans' && e.what === 'seized' && e.unit === j.id)).toBe(true);
    expect(s.campaign!.plans).toMatchObject({ at: 'carried', unit: j.id, taken: s.round, next: s.round + 1 });
    expect(plansCarrier(s)?.id).toBe(j.id);
    expect(j.exhausted).toBe(true);
    // schon getragen: kein zweites Bergen / already carried: no second seizure
    const inf = s.units.find((u) => u.owner === 0 && (u.type === 'infantry' || u.type === 'lightWarden'))!;
    placeAt(s, inf, templeRing(s)[1] ?? templeRing(s)[0]);
    expect(seizeCheck(s, inf)).toBe('invalid');
    // Hinweis aufs Hauptquartier / hint at the HQ
    const hq = hqOf(s, 0)!;
    expect(plansHints(s)).toEqual([{ x: hq.x, y: hq.y }]);
    // Kultisten koennen nicht bergen / cultists cannot seize
    const z = s.units.find((u) => u.owner === 1)!;
    expect(seizeCheck(s, z)).not.toBe('ok');
  });

  it('Abliefern am Hauptquartier gewinnt sofort / delivery at the HQ wins at once', () => {
    const s = game();
    const j = seize(s);
    const hq = hqOf(s, 0)!;
    const spot = around(s, hq).find((q) => walk(s, q) && walk(s, { x: 2 * q.x - hq.x, y: 2 * q.y - hq.y }))!;
    // zwei Felder vor dem Hauptquartier, dann ein Schritt hinein in die Abgabezone / two tiles out, then one step into the delivery zone
    placeAt(s, j, { x: spot.x + (spot.x - hq.x), y: spot.y + (spot.y - hq.y) });
    passRound(s);
    expect(s.campaign!.result).toBeNull();
    const r = applyCommand(s, { type: 'move', unit: j.id, to: spot });
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.t === 'plans' && e.what === 'delivered')).toBe(true);
    expect(s.campaign!.plans!.at).toBe('delivered');
    expect(s.campaign!.result).toBe('won');
    expect(s.campaign!.status).toEqual(['done', 'done']);
    // nie fallen gelassen: Bonus erfuellt / never dropped: bonus met
    expect(s.campaign!.bonus[1]).toBe('done');
  });

  it('Tod des Traegers: Plaene fallen, Aufheben neben dem Feld, Bonus verfehlt / carrier death: plans drop, pick up next to the tile, bonus failed', () => {
    const s = game();
    const j = seize(s);
    const at = { x: j.x, y: j.y };
    // ein Eiferer erschlaegt den Traeger / a zealot strikes the carrier down
    passRound(s);
    const z = s.units.find((u) => u.owner === 1)!;
    j.hp = 1;
    s.current = 1;
    s.config.hitChance = false;
    s.factions[1].explored.fill(1);
    const spot = around(s, j).find((q) => walk(s, q) && !unitAt(s, q.x, q.y))!;
    placeAt(s, z, spot);
    const r = applyCommand(s, { type: 'attack', unit: z.id, target: j.id });
    expect(r.ok).toBe(true);
    expect(s.units.some((u) => u.id === j.id)).toBe(false);
    expect(r.events.some((e) => e.t === 'plans' && e.what === 'dropped' && e.x === at.x && e.y === at.y)).toBe(true);
    expect(s.campaign!.plans).toMatchObject({ at: 'dropped', x: at.x, y: at.y, drops: 1 });
    expect(s.campaign!.bonus[1]).toBe('failed');
    expect(plansHints(s)).toEqual([at]);
    // Spieler: eine Einheit neben dem Feld hebt sie auf / player: a unit next to the tile picks them up
    s.current = 0;
    s.units = s.units.filter((u) => u.owner !== 1 || dist(u, at) > 1);
    const inf = s.units.find((u) => u.owner === 0 && (u.type === 'infantry' || u.type === 'lightWarden'))!;
    const next = around(s, at).find((q) => walk(s, q) && !unitAt(s, q.x, q.y))!;
    placeAt(s, inf, next);
    const p = applyCommand(s, { type: 'seizePlans', unit: inf.id });
    expect(p.ok).toBe(true);
    expect(p.events.some((e) => e.t === 'plans' && e.what === 'picked')).toBe(true);
    expect(s.campaign!.plans).toMatchObject({ at: 'carried', unit: inf.id, drops: 1 });
  });

  it('Kultist auf fallen gelassenen Plaenen bringt sie zurueck in den Tempel / a cultist on dropped plans takes them back to the temple', () => {
    const s = game();
    const j = seize(s);
    const at = { x: j.x, y: j.y };
    // Traeger verschwindet (z. B. Desertion): Plaene bleiben an seiner letzten Stelle / carrier vanishes (e.g. desertion): plans stay at its last spot
    s.units = s.units.filter((u) => u.id !== j.id && !(u.owner === 1 && dist(u, at) <= 2));
    const inf = s.units.find((u) => u.owner === 0 && (u.type === 'infantry' || u.type === 'lightWarden'))!;
    inf.hp = inf.maxHp - 1;
    expect(applyCommand(s, { type: 'heal', unit: inf.id }).events.some((e) => e.t === 'plans' && e.what === 'dropped')).toBe(true);
    expect(s.campaign!.plans).toMatchObject({ at: 'dropped', x: at.x, y: at.y, drops: 1 });
    // ein Kultist tritt darauf / a cultist steps onto it
    s.current = 1;
    const z = s.units.find((u) => u.owner === 1)!;
    const from = around(s, at).find((q) => walk(s, q) && !unitAt(s, q.x, q.y))!;
    placeAt(s, z, from);
    const r = applyCommand(s, { type: 'move', unit: z.id, to: at });
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.t === 'plans' && e.what === 'returned')).toBe(true);
    expect(s.campaign!.plans).toMatchObject({ at: 'temple', drops: 1 });
    expect(plansHints(s)).toEqual([]);
  });

  it('der Traeger laesst sich nicht bekehren / the carrier cannot be converted', () => {
    const s = game();
    const j = seize(s);
    const p = s.units.find((u) => u.owner === 1)!;
    p.type = 'prophet';
    s.current = 1;
    const spot = around(s, j).find((q) => walk(s, q) && !unitAt(s, q.x, q.y))!;
    placeAt(s, p, spot);
    expect(convertTargets(s, p).some((u) => u.id === j.id)).toBe(false);
  });

  it('Traeger und Plaene ueberstehen Speichern und Laden; alte m4-Spielstaende ohne Tempel beginnen neu / carrier and plans survive save and load; old m4 saves without a temple restart', () => {
    const s = game();
    const j = seize(s);
    const loaded = migrateState(JSON.parse(JSON.stringify(s)));
    expect(isValidState(loaded)).toBe(true);
    expect(loaded.campaign?.plans).toEqual(s.campaign!.plans);
    expect(loaded.campaign?.temple).toEqual(s.campaign!.temple);
    expect(plansCarrier(loaded)?.id).toBe(j.id);
    expect(loaded.tiles.filter((t) => t.temple).length).toBe(4);
    // alte Fassung (Abschussziel, kein Tempel): wird zur freien Partie / old version (kills objective, no temple): becomes a free game
    const old = JSON.parse(JSON.stringify(game())) as GameState;
    delete old.campaign!.temple;
    delete old.campaign!.plans;
    const m = migrateState(old);
    expect(m.campaign).toBeUndefined();
  });
});

describe('m4: Verfolgung / pursuit', () => {
  it('keine Verfolgung vor dem Bergen, danach Wellen am Tempel und an einer Kultstadt / no pursuit before the seizure, waves afterwards', () => {
    const s = game();
    for (let i = 0; i < 3; i++) expect(passRound(s).some((e) => e.t === 'wave')).toBe(false);
    expect(s.campaign!.plans!.pursuit).toBe(0);
    seize(s);
    const n1 = s.units.filter((u) => u.owner === 1).length;
    const ev = passRound(s);
    const waves = ev.filter((e) => e.t === 'wave' && e.faction === 1);
    expect(waves.length).toBeGreaterThanOrEqual(1);
    expect(s.campaign!.plans!.pursuit).toBe(1);
    expect(s.campaign!.plans!.next).toBe(s.round + TEMPLE_PLANS.pursuitEvery);
    // die erste Welle tritt neben dem Tempel aus / the first wave steps out next to the temple
    const w = waves[0] as Extract<GameEvent, { t: 'wave' }>;
    expect(templeDist(s.campaign!.temple!, w) <= 1 || s.cities.some((c) => c.owner === 1 && c.x === w.x && c.y === w.y)).toBe(true);
    expect(s.units.filter((u) => u.owner === 1).length).toBeGreaterThan(n1 - 3);
    // naechste Welle erst nach pursuitEvery Runden / next wave only after pursuitEvery rounds
    if (TEMPLE_PLANS.pursuitEvery > 1) expect(passRound(s).filter((e) => e.t === 'wave' && e.faction === 1).length).toBe(0);
  });

  it('Wellen sind deterministisch / waves are deterministic', () => {
    const run = () => {
      const s = game('dravon');
      seize(s);
      const out: string[] = [];
      for (let i = 0; i < 6 && !s.over; i++) for (const e of passRound(s)) if (e.t === 'wave') out.push(`${s.round}:${e.faction}:${e.count}@${e.x},${e.y}`);
      return { out, units: s.units.filter((u) => u.owner === 1).map((u) => `${u.type}@${u.x},${u.y}`).join(' '), pursuit: s.campaign!.plans!.pursuit };
    };
    const a = run(), b = run();
    expect(a.out.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
    expect(a.pursuit).toBeLessThanOrEqual(TEMPLE_PLANS.pursuitWaves);
  });

  it('der Kult jagt nach dem Bergen den Traeger / the cult hunts the carrier after the seizure', async () => {
    const { buildCtx } = await import('../src/ai/analysis');
    const s = game();
    const before = buildCtx(s, 1);
    expect([...before.goals.values()].some((g) => g.kind === 'hunt' && g.targetId === jeepOf(s).id)).toBe(false);
    const j = seize(s);
    s.current = 1;
    for (const u of s.units) if (u.owner === 1) { u.fresh = false; u.exhausted = false; }
    const ctx = buildCtx(s, 1);
    const hunters = [...ctx.goals.values()].filter((g) => g.kind === 'hunt' && g.targetId === j.id).length;
    expect(hunters).toBeGreaterThanOrEqual(2);
  });
});

describe('m4: KI / AI', () => {
  it('Spieler als KI und Kult spielen ohne Fehlbefehle; die KI birgt die Plaene / player as AI and the cult play without failed commands; the AI seizes the plans', () => {
    const errors = aiDebug.errors;
    let seized = 0;
    for (const f of ['korvat', 'alvenia'] as FactionId[]) {
      const s = game(f);
      s.factions[0].human = false;
      let fails = 0;
      while (!s.over && s.round <= 14) {
        const fi = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (r.events.some((e) => e.t === 'plans' && e.what === 'seized')) seized++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
      expect(fails, f).toBe(0);
    }
    expect(seized).toBeGreaterThan(0);
    expect(aiDebug.errors).toBe(errors);
  }, 120000);
});
