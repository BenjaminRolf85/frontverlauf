/**
 * Kampagne m2 (Das Mutterschiff, alle gegen alle): sechs Fraktionen und die Zyrr auf 28x28 Feldern (Ecken, Kantenmitten,
 * Schiff in der Mitte, kein NEXUS), Wrack auf 2x2 unpassierbaren Feldern, Waffenruhe bis zur ersten Probe, danach Krieg
 * aller gegen alle, Wettlauf um M2.workRounds (Sieg und Niederlage), Tod des Wissenschaftlers, Fall des Hauptquartiers,
 * Wellen, Speichern und alte Spielstaende, Geschuetzstellungen und Orbitallaser am Wrack sowie ein KI-Lauf ohne Fehlbefehle.
 * Campaign m2 (The Mothership, free-for-all): six factions and the Zyrr on 28x28 tiles (corners, edge midpoints, ship in
 * the centre, no NEXUS), wreck on 2x2 impassable tiles, truce until the first sample, then war of all against all, race
 * for M2.workRounds (win and loss), the scientist's death, the fall of the HQ, waves, saving and old saves, gun
 * emplacements and the orbital laser at the wreck, and an AI run without failed commands.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, centreShip, createGame, defenseBonus, dist, hullCover, emplacementCheck, hqOf, isLand, isSampler, missionById, missionConfig, nextToShip,
  convertTargets, objectiveProgress, outdatedCampaign, raceStandings, reachable, samplerOf, shipDist, shipReachable, shipTiles, tileAt, unitAt, workCheck, workSpots,
  CAMPAIGN_FACTIONS, type GameEvent, type GameState, type Pos, type Unit,
} from '../src/core';
import { aiDebug, planNextCommand } from '../src/ai/ai';
import { AI, CITY_UPGRADES, M2, type FactionId } from '../src/data/balance';
import { isValidState, migrateState } from '../src/save/save';
import { freeFor, revealArea } from '../src/core/spawn';

const game = (f: FactionId = 'korvat') => createGame(missionConfig('m2', f));
const sci = (s: GameState) => s.units.find((u) => u.id === s.campaign!.scientist)!;
const ZYRR = 1;

/** Einheit bereit auf ein Feld setzen / put a unit, ready, onto a tile */
function placeAt(s: GameState, u: Unit, p: Pos) {
  s.units = s.units.filter((o) => o === u || !(o.x === p.x && o.y === p.y));
  Object.assign(u, { x: p.x, y: p.y, startX: p.x, startY: p.y, fresh: false, exhausted: false, moved: false, attacked: false, moveDone: false });
}
/** Zug beenden (offene Belohnungen vorher waehlen) / end the turn (choose open rewards first) */
function endTurn(s: GameState): GameEvent[] {
  for (const x of s.factions) x.human = true;
  for (const p of [...s.pendingRewards]) if (s.cities.find((c) => c.id === p.cityId)?.owner === s.current) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
  const r = applyCommand(s, { type: 'endTurn' });
  expect(r.ok).toBe(true);
  return r.events;
}
/** Zug beenden, bis der Spieler wieder dran ist (alle passen) / end turns until the player moves again (everyone passes) */
function passRound(s: GameState) {
  do endTurn(s); while (s.current !== 0 && !s.over);
}
/** Zuege beenden, bis Fraktion f dran ist / end turns until faction f moves */
function toTurn(s: GameState, f: number) {
  while (s.current !== f && !s.over) endTurn(s);
}
/** freier, begehbarer Arbeitsplatz (oder das eigene Feld von u) / free walkable work spot (or u's own tile) */
const spot = (s: GameState, u?: Unit) => workSpots(s).find((p) => (u && p.x === u.x && p.y === u.y) || (!unitAt(s, p.x, p.y) && isLand(tileAt(s, p.x, p.y)!) && tileAt(s, p.x, p.y)!.terrain !== 'mountain'))!;
/** Alle Paare ausser den Zyrr / all pairs except the Zyrr */
const pairs = (s: GameState) => s.factions.filter((a) => a.index !== ZYRR).flatMap((a) => s.factions.filter((b) => b.index !== ZYRR && b !== a).map((b) => [a, b] as const));
/** Wissenschaftler eines Rivalen an einen Arbeitsplatz setzen und arbeiten lassen (in seinem Zug) / put a rival's scientist on a work spot and let it work (on its turn) */
function rivalWorks(s: GameState, f: number) {
  toTurn(s, f);
  const u = samplerOf(s, f)!;
  placeAt(s, u, spot(s, u));
  u.hp = u.maxHp;
  const r = applyCommand(s, { type: 'workShip', unit: u.id });
  expect(r.ok, `${f} ${r.error}`).toBe(true);
  return r;
}

describe('m2: Aufbau / setup', () => {
  it('sechs Fraktionen und die Zyrr auf 28x28: Ecken, Kantenmitten, Schiff in der Mitte, kein NEXUS / six factions and the Zyrr on 28x28: corners, edge midpoints, ship in the centre, no NEXUS', () => {
    const m = missionById('m2')!;
    expect(m.level).toBe('easy');
    expect(m.size).toBe(28);
    expect(m.objectives).toEqual([{ k: 'work', rounds: M2.workRounds }, { k: 'scientist' }, { k: 'holdHq' }]);
    expect(m.rounds).toBe(M2.missionRounds);
    const n = M2.size, lo = M2.startInset, hi = n - 1 - M2.startInset;
    const corners = [`${lo},${lo}`, `${hi},${lo}`, `${lo},${hi}`, `${hi},${hi}`];
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game(f);
      const c = s.campaign!;
      expect(s.size, f).toBe(28);
      // Teilnehmer: Spieler, Zyrr, Kult und die anderen vier Menschen; kein NEXUS / participants: player, Zyrr, cult and the other four humans; no NEXUS
      expect(s.factions.length).toBe(7);
      expect(s.factions.map((x) => x.id).sort()).toEqual([...CAMPAIGN_FACTIONS, 'zyrr', 'vesper'].sort());
      expect(s.factions.some((x) => x.id === 'nexus')).toBe(false);
      expect(s.factions[0].id).toBe(f);
      expect(s.factions[0].human).toBe(true);
      for (const x of s.factions.slice(1)) expect(x.human).toBe(false);
      // Schiff genau in der Mitte / ship exactly in the centre
      expect(c.ship).toEqual(centreShip(n));
      expect(c.ship).toEqual({ x: 13, y: 13 });
      for (const q of shipTiles(c.ship!)) expect(tileAt(s, q.x, q.y)!.feature).toBe('mothership');
      // Zyrr ohne Basis, aber im Spiel / Zyrr without a base, but in the game
      expect(s.cities.some((x) => x.owner === ZYRR)).toBe(false);
      expect(s.factions[ZYRR].alive).toBe(true);
      expect(c.race!.swarm).toBe(ZYRR);
      // Hauptquartiere: vier Ecken und zwei gegenueberliegende Kantenmitten, der Spieler in einer Ecke
      // HQs: four corners and two opposite edge midpoints, the player in a corner
      const hqs = s.factions.filter((x) => x.index !== ZYRR).map((x) => hqOf(s, x.index)!);
      const keys = hqs.map((h) => `${h.x},${h.y}`);
      expect(corners.every((k) => keys.includes(k)), f).toBe(true);
      expect(corners).toContain(keys[0]);
      const mids = hqs.filter((h) => !corners.includes(`${h.x},${h.y}`));
      expect(mids.length).toBe(2);
      // gegenueberliegende Kanten: beide in der Kartenmitte, eine oben, eine unten / opposite edges: both at the middle, one at the top, one at the bottom
      for (const h of mids) expect(Math.abs(h.x - (n - 1) / 2)).toBeLessThanOrEqual(0.5);
      expect(mids.map((h) => h.y).sort((a, b) => a - b)).toEqual([lo, hi]);
      // jedes Hauptquartier erreicht das Schiff ueber Land, gleich weit (Schachbrettmass) / every HQ reaches the ship over land, equally far (Chebyshev)
      for (const h of hqs) {
        expect(shipReachable(s, h), `${f} ${h.x},${h.y}`).toBe(true);
        expect(shipDist(c.ship!, h)).toBe(shipDist(c.ship!, hqs[0]));
      }
      // Wissenschaftler: Spieler und jede Fraktion ausser den Zyrr, auch der Kult / scientists: the player and every faction but the Zyrr, the cult too
      expect(sci(s).owner).toBe(0);
      expect(c.race!.rivals.map((r) => r.faction)).toEqual([2, 3, 4, 5, 6]);
      for (const r of c.race!.rivals) {
        const u = samplerOf(s, r.faction)!;
        expect(u.type, `${f} ${r.faction}`).toBe('scientist');
        expect(u.owner).toBe(r.faction);
        expect(dist(u, hqOf(s, r.faction)!)).toBeLessThanOrEqual(1);
        expect(r.work).toBe(0);
      }
      expect(raceStandings(s).map((e) => e.faction)).toEqual([0, 2, 3, 4, 5, 6]);
      // Waffenruhe zwischen allen ausser den Zyrr, die mit allen im Krieg sind / truce between everyone but the Zyrr, who are at war with all
      expect(c.race!.truce).toBe(true);
      for (const [a, b] of pairs(s)) { expect(a.relations[b.index]).toBe('peace'); expect(a.contacts).toContain(b.index); }
      for (const x of s.factions) if (x.index !== ZYRR) { expect(x.relations[ZYRR]).toBe('war'); expect(s.factions[ZYRR].relations[x.index]).toBe('war'); }
      expect(c.allies).toEqual([]);
      // Wachen der Zyrr am Wrack, Landepunkte an allen vier Seiten / Zyrr guards at the wreck, landing points on all four sides
      expect(s.units.filter((x) => x.owner === ZYRR && shipDist(c.ship!, x) <= 2).length).toBe(M2.guards.length);
      expect(c.spawns!.length).toBe(4);
      for (const p of c.spawns!) expect(shipDist(c.ship!, p)).toBe(M2.waveDistance);
      // Arbeitsplaetze: begehbares Land im Krater / work spots: walkable land in the crater
      const spots = workSpots(s);
      expect(spots.length).toBe(12);
      for (let y = c.ship!.y - M2.crater; y < c.ship!.y + 2 + M2.crater; y++) for (let x = c.ship!.x - M2.crater; x < c.ship!.x + 2 + M2.crater; x++) {
        if (shipDist(c.ship!, { x, y }) > 0) expect(tileAt(s, x, y)!.terrain, `${x},${y}`).not.toBe('mountain');
      }
      // alle kennen das Wrack / everyone knows the wreck
      for (const fa of s.factions) for (const q of shipTiles(c.ship!)) expect(fa.explored[q.y * s.size + q.x]).toBe(1);
    }
  });

  it('das Schiff belegt vier unpassierbare, nicht einnehmbare, nicht angreifbare Felder / the ship occupies four impassable, uncapturable, unattackable tiles', () => {
    const s = game();
    const ship = s.campaign!.ship!;
    const tiles = shipTiles(ship);
    for (const q of tiles) {
      const t = tileAt(s, q.x, q.y)!;
      expect(t.feature).toBe('mothership');
      expect(t.cityId).toBeNull();
      expect(unitAt(s, q.x, q.y)).toBeUndefined();
      expect(freeFor(s, 'infantry', q)).toBe(false);
      expect(freeFor(s, 'skimmer', q)).toBe(false);
    }
    const u = s.units.find((x) => x.owner === 0 && x.type === 'jeep')!;
    placeAt(s, u, spot(s));
    for (const r of reachable(s, u)) expect(shipDist(ship, r), `${r.x},${r.y}`).toBeGreaterThan(0);
    // Korvat: Steppenkoloss statt Panzer (VARIANTS) / Korvat: Steppe Colossus instead of the tank (VARIANTS)
    const flyer = s.units.find((x) => x.owner === 0 && x.type === 'steppeColossus')!;
    Object.assign(flyer, { type: 'heli', fuel: 5 });
    placeAt(s, flyer, spot(s));
    for (const r of reachable(s, flyer)) expect(shipDist(ship, r)).toBeGreaterThan(0);
    expect(applyCommand(s, { type: 'move', unit: u.id, to: tiles[0] }).ok).toBe(false);
  });

  it('die Huelle deckt nur den Wissenschaftler direkt am Schiff / the hull covers only the scientist right at the ship', () => {
    const s = game('meridon');
    const u = sci(s);
    const away = defenseBonus(s, u);
    placeAt(s, u, spot(s));
    expect(defenseBonus(s, u)).toBeCloseTo(away + M2.hullCover);
    const inf = s.units.find((x) => x.owner === 0 && x.type === 'infantry')!;
    placeAt(s, inf, spot(s));
    expect(hullCover(s, inf)).toBe(0);
    expect(hullCover(s, u)).toBe(M2.hullCover);
  });
});

describe('m2: Waffenruhe / truce', () => {
  it('haelt bis zur ersten Probe und laesst sich nicht brechen / holds until the first sample and cannot be broken', () => {
    const s = game('dravon');
    for (let i = 0; i < 3; i++) passRound(s);
    expect(s.campaign!.race!.truce).toBe(true);
    for (const [a, b] of pairs(s)) expect(a.relations[b.index]).toBe('peace');
    // weder Bruch noch Friedensangebot an die Zyrr / neither a break nor a peace offer to the Zyrr
    expect(applyCommand(s, { type: 'diplomacy', action: 'announceBreak', target: 3 }).ok).toBe(false);
    s.factions[0].contacts.push(ZYRR);
    expect(applyCommand(s, { type: 'diplomacy', action: 'proposePeace', target: ZYRR }).ok).toBe(false);
    // Arbeit anderer Einheiten oder weit weg zaehlt nicht / work by other units or far away does not count
    expect(applyCommand(s, { type: 'workShip', unit: sci(s).id }).ok).toBe(false);
    expect(s.campaign!.race!.truce).toBe(true);
  });

  it('die erste Probe des Spielers bricht sie: alle gegen alle / the player\'s first sample breaks it: everyone against everyone', () => {
    const s = game('alvenia');
    const u = sci(s);
    placeAt(s, u, spot(s));
    const r = applyCommand(s, { type: 'workShip', unit: u.id });
    expect(r.ok).toBe(true);
    expect(r.events.filter((e) => e.t === 'truceBroken')).toEqual([{ t: 'truceBroken', faction: 0, round: s.round }]);
    const race = s.campaign!.race!;
    expect(race.truce).toBe(false);
    expect(race.opener).toBe(0);
    for (const a of s.factions) for (const b of s.factions) if (a !== b) expect(a.relations[b.index], `${a.index}-${b.index}`).toBe('war');
    // danach kein Frieden mehr / no more peace afterwards
    expect(applyCommand(s, { type: 'diplomacy', action: 'proposePeace', target: 3 }).ok).toBe(false);
    // die zweite Arbeit bricht nichts mehr / the second work breaks nothing any more
    passRound(s);
    placeAt(s, u, spot(s, u));
    const r2 = applyCommand(s, { type: 'workShip', unit: u.id });
    expect(r2.ok).toBe(true);
    expect(r2.events.some((e) => e.t === 'truceBroken')).toBe(false);
  });

  it('die erste Probe einer KI bricht sie ebenso / an AI\'s first sample breaks it as well', () => {
    for (const f of [2, 5]) {
      const s = game('velkar');
      const r = rivalWorks(s, f);
      expect(r.events.find((e) => e.t === 'truceBroken')).toMatchObject({ faction: f });
      expect(s.campaign!.race!.opener).toBe(f);
      for (const a of s.factions) for (const b of s.factions) if (a !== b) expect(a.relations[b.index]).toBe('war');
      expect(s.campaign!.race!.rivals.find((x) => x.faction === f)!.work).toBe(1);
      expect(s.campaign!.work).toBe(0);
    }
  });
});

describe('m2: Wettlauf / race', () => {
  it('Arbeit zaehlt nur direkt daneben, einmal je Runde; der Spieler gewinnt, wenn er zuerst fertig ist / work counts only right next to it, once per round; the player wins if he finishes first', () => {
    const s = game('meridon');
    const u = sci(s);
    expect(workCheck(s, u)).toBe('outOfRange');
    expect(applyCommand(s, { type: 'workShip', unit: u.id }).ok).toBe(false);
    const jeep = s.units.find((x) => x.owner === 0 && x.type === 'jeep')!;
    placeAt(s, jeep, spot(s));
    expect(applyCommand(s, { type: 'workShip', unit: jeep.id }).ok).toBe(false);
    placeAt(s, u, spot(s));
    expect(nextToShip(s, u)).toBe(true);
    const r = applyCommand(s, { type: 'workShip', unit: u.id });
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.t === 'shipWork' && e.have === 1 && e.need === M2.workRounds && e.faction === 0)).toBe(true);
    expect(s.campaign!.work).toBe(1);
    u.exhausted = false;
    expect(workCheck(s, u)).toBe('unitExhausted');
    // ein Rivale holt auf, bleibt aber eine Runde zurueck / a rival catches up but stays one round behind
    s.campaign!.race!.rivals.find((x) => x.faction === 4)!.work = M2.workRounds - 2;
    passRound(s);
    for (let i = 2; i <= M2.workRounds; i++) {
      if (i > 2) passRound(s);
      placeAt(s, u, spot(s, u));
      u.hp = u.maxHp;
      expect(applyCommand(s, { type: 'workShip', unit: u.id }).ok, `round ${s.round}`).toBe(true);
      expect(s.campaign!.work).toBe(i);
      if (i < M2.workRounds) expect(s.campaign!.result).toBeNull();
    }
    expect(objectiveProgress(s, { k: 'work', rounds: M2.workRounds }, M2.missionRounds)).toEqual({ have: M2.workRounds, need: M2.workRounds });
    expect(s.campaign!.status).toEqual(['done', 'done', 'done']);
    expect(s.campaign!.result).toBe('won');
    expect(s.campaign!.race!.winner).toBe(0);
    expect(s.winner).toBe(0);
    expect(s.campaign!.bonus[1]).toBe('done');
  });

  it('erreicht eine KI zuerst M2.workRounds, ist der Einsatz verloren / if an AI reaches M2.workRounds first, the mission is lost', () => {
    for (const f of [2, 3]) {
      const s = game('korvat');
      s.campaign!.work = M2.workRounds - 1;
      s.campaign!.race!.rivals.find((x) => x.faction === f)!.work = M2.workRounds - 1;
      rivalWorks(s, f);
      expect(s.campaign!.race!.winner).toBe(f);
      expect(s.campaign!.status[0]).toBe('failed');
      expect(s.campaign!.result).toBe('lost');
      expect(s.over).toBe(true);
      expect(s.winner).toBe(f);
    }
  });

  it('faellt der Wissenschaftler oder das Hauptquartier, ist der Einsatz verloren / if the scientist or the HQ falls, the mission is lost', () => {
    const s = game('dravon');
    const u = sci(s);
    placeAt(s, u, spot(s));
    toTurn(s, ZYRR);
    const g = s.units.find((x) => x.owner === ZYRR && x.type === 'grey')!;
    const free = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy }))
      .find((p) => (freeFor(s, 'grey', p) || unitAt(s, p.x, p.y)?.owner === ZYRR) && tileAt(s, p.x, p.y)!.cityId === null)!;
    placeAt(s, g, free);
    u.hp = 1;
    const res = applyCommand(s, { type: 'attack', unit: g.id, target: u.id });
    expect(res.ok).toBe(true);
    if (s.units.some((x) => x.id === u.id)) {
      // Fehlschuss (Trefferglueck): der Wissenschaftler faellt auf andere Weise / a miss (hit luck): the scientist falls another way
      s.units = s.units.filter((x) => x.id !== u.id);
      endTurn(s);
    }
    expect(s.campaign!.status[1]).toBe('failed');
    expect(s.campaign!.result).toBe('lost');
    // Hauptquartier verloren / HQ lost
    const h = game('alvenia');
    const hq = hqOf(h, 0)!;
    hq.owner = 3;
    endTurn(h);
    expect(h.campaign!.status[2]).toBe('failed');
    expect(h.campaign!.result).toBe('lost');
  });

  it('Wissenschaftler im Wettlauf lassen sich nicht bekehren / scientists in the race cannot be converted', () => {
    const s = game('korvat');
    rivalWorks(s, 2); // Waffenruhe vorbei / truce over
    const own = sci(s);
    const rival = samplerOf(s, 4)!;
    const preacher = s.units.find((u) => u.owner === 2 && u.id !== samplerOf(s, 2)!.id)!;
    preacher.type = 'prophet';
    for (const target of [own, rival]) {
      placeAt(s, preacher, { x: target.x + 1, y: target.y });
      revealArea(s, 2, target.x, target.y, 1);
      expect(convertTargets(s, preacher).some((t) => t.id === target.id), `${target.owner}`).toBe(false);
    }
  });

  it('gefallene Forscher der KI scheiden aus dem Wettlauf aus / fallen AI researchers drop out of the race', () => {
    const s = game('korvat');
    const id = samplerOf(s, 4)!.id;
    s.units = s.units.filter((x) => x.id !== id);
    endTurn(s);
    const r = s.campaign!.race!.rivals.find((x) => x.faction === 4)!;
    expect(r.unit).toBeNull();
    expect(r.fallen).toBe(true);
    expect(raceStandings(s).find((e) => e.faction === 4)).toMatchObject({ alive: false, pending: false });
    expect(s.campaign!.result).toBeNull();
  });

  it('Wellen landen deterministisch rund um das Schiff und wachsen / waves land deterministically around the ship and grow', () => {
    const m = missionById('m2')!;
    const waves = m.waves!;
    expect(waves.length).toBe(M2.waves.length);
    for (let i = 1; i < waves.length; i++) {
      expect(waves[i].round).toBeGreaterThan(waves[i - 1].round);
      expect(waves[i].units.length).toBeGreaterThanOrEqual(waves[0].units.length);
      expect(waves[i].owner).toBe(ZYRR);
    }
    expect(new Set(waves.map((w) => w.at))).toEqual(new Set([0, 1, 2, 3]));
    expect(waves.at(-1)!.round).toBeLessThanOrEqual(m.rounds);
    const run = () => {
      const s = game('velkar');
      const seen: string[] = [];
      while (s.round < waves[1].round + 1) {
        passRound(s);
        for (const u of s.units) if (u.owner === ZYRR) seen.push(`${s.round}:${u.id}:${u.type}:${u.x},${u.y}`);
      }
      return { s, seen };
    };
    const a = run(), b = run();
    expect(a.seen).toEqual(b.seen);
    expect(a.s.campaign!.waves).toBe(2);
    expect(a.s.factions[ZYRR].alive).toBe(true);
    const ship = a.s.campaign!.ship!;
    for (const u of a.s.units) expect(shipDist(ship, u)).toBeGreaterThan(0);
  });
});

describe('m2: Speichern / saving', () => {
  it('Speichern und Laden; alte m2-Staende werden freie Partien / save and load; old m2 saves become free games', () => {
    const s = game('alvenia');
    const u = sci(s);
    placeAt(s, u, spot(s));
    expect(applyCommand(s, { type: 'workShip', unit: u.id }).ok).toBe(true);
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(isValidState(copy)).toBe(true);
    const back = migrateState(copy);
    expect(back.campaign?.ship).toEqual(s.campaign!.ship);
    expect(back.campaign?.work).toBe(1);
    expect(back.campaign?.race).toEqual(s.campaign!.race);
    expect(outdatedCampaign(back.campaign!)).toBe(false);
    passRound(back);
    expect(back.campaign!.result).toBeNull();
    const sc = sci(back);
    placeAt(back, sc, spot(back, sc));
    expect(applyCommand(back, { type: 'workShip', unit: sc.id }).ok).toBe(true);
    expect(back.campaign!.work).toBe(2);
    // alte Bergung ohne Mutterschiff und das Mutterschiff vor dem Wettlauf (ohne race) / old salvage without the mothership and the mothership before the race (without race)
    for (const drop of ['ship', 'race']) {
      const old = JSON.parse(JSON.stringify(s));
      delete old.campaign[drop];
      const m = migrateState(old);
      expect(m.campaign, drop).toBeUndefined();
      expect(m.config.campaign).toBeUndefined();
    }
  });
});

describe('m2: Wrack und Waffen / wreck and weapons', () => {
  it('Geschuetzstellungen nie auf dem Wrack, der Orbitallaser trifft dort nur Einheiten / gun emplacements never on the wreck, the orbital laser only hits units there', () => {
    const s = game('dravon');
    const ship = s.campaign!.ship!;
    const pio = s.units.find((x) => x.owner === 0 && (x.type === 'infantry' || x.type === 'lightWarden'))!;
    pio.type = 'pioneer';
    placeAt(s, pio, workSpots(s).find((p) => p.x === ship.x - 1 && p.y === ship.y) ?? spot(s));
    for (const q of shipTiles(ship)) if (dist(pio, q) === 1) expect(emplacementCheck(s, pio, q.x, q.y)).not.toBe('ok');
    const v = game('velkar');
    const vs = v.campaign!.ship!;
    const hq = hqOf(v, 0)!;
    v.factions[0].techs.push(CITY_UPGRADES.tech.satRelay);
    v.factions[0].stars = 500;
    expect(applyCommand(v, { type: 'cityUpgrade', city: hq.id, upgrade: 'satRelay' }).ok).toBe(true);
    v.factions[0].orbitalReady = v.round;
    const grey = v.units.find((x) => x.owner === ZYRR && x.type === 'grey')!;
    placeAt(v, grey, { x: vs.x + 2, y: vs.y + 2 });
    const before = JSON.stringify(shipTiles(vs).map((q) => tileAt(v, q.x, q.y)!.feature));
    const hp = grey.hp;
    expect(applyCommand(v, { type: 'orbitalStrike', x: vs.x + 1, y: vs.y + 1 }).ok).toBe(true);
    expect(grey.hp).toBeLessThan(hp);
    expect(JSON.stringify(shipTiles(vs).map((q) => tileAt(v, q.x, q.y)!.feature))).toBe(before);
    for (const u of v.units) expect(shipDist(vs, u)).toBeGreaterThan(0);
  });
});

describe('m2: KI / AI', () => {
  it('alle fuenf Fraktionen als KI: ohne Fehlbefehle, Wettlauf mit Waffenruhe, spielbare Rechenzeit / all five factions as AI: no failed commands, race with truce, playable compute time', () => {
    const errors = aiDebug.errors;
    let worked = 0, broken = 0, rivalWork = 0;
    const rounds: number[] = [];
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game(f);
      s.factions[0].human = false;
      let fails = 0, guard = 0, last = s.round, t0 = performance.now();
      while (!s.over && guard++ < 60000) {
        const fi = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
        if (s.round !== last) { rounds.push(performance.now() - t0); t0 = performance.now(); last = s.round; }
      }
      expect(fails, f).toBe(0);
      expect(s.campaign!.result, f).not.toBeNull();
      expect(s.round, f).toBeLessThanOrEqual(M2.missionRounds + 1);
      worked += s.campaign!.work ?? 0;
      rivalWork += s.campaign!.race!.rivals.reduce((a, r) => a + r.work, 0);
      if (!s.campaign!.race!.truce) broken++;
      // die Rivalen arbeiten mit ihrem eigenen Wissenschaftler / the rivals work with their own scientist
      for (const u of s.units) if (u.type === 'scientist') expect(isSampler(s, u)).toBe(true);
    }
    expect(worked + rivalWork).toBeGreaterThan(M2.workRounds);
    expect(rivalWork).toBeGreaterThan(0);
    expect(broken).toBeGreaterThanOrEqual(4);
    expect(aiDebug.errors).toBe(errors);
    // eine volle Runde aller sieben Fraktionen bleibt deutlich unter einer Sekunde im Mittel / a full round of all seven factions stays well below a second on average
    const avg = rounds.reduce((a, b) => a + b, 0) / Math.max(1, rounds.length);
    expect(avg).toBeLessThan(1500);
  }, 300_000);
});

