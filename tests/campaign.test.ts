/**
 * Kampagne: Einrichtung fuer alle Menschen-Fraktionen, Gegner nur Sonderfraktionen, Verbuendete, Ziele (Sieg und
 * Niederlage), Wellen, Artefakt, Ueberzeugen, Speicherung und KI-Laeufe.
 * Campaign: setup for every human faction, special-race enemies only, allies, objectives (win and loss), waves,
 * artifact, persuasion, saving and AI runs.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, cityAt, createGame, dist, factionVictoryOn, hqOf, isLand, MISSIONS, missionById, missionConfig, ownCities, unitAt,
  CAMPAIGN_ALLIES, CAMPAIGN_ENEMIES, CAMPAIGN_FACTIONS, allyFor, persuadeCost, defaultConfig, type GameState, type Unit,
} from '../src/core';
import { isValidState, migrateState } from '../src/save/save';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI, PERSUADE, UNITS, type FactionId } from '../src/data/balance';

const game = (id: string, f: FactionId = 'korvat') => createGame(missionConfig(id, f));

/** Zug beenden, offene Belohnungen vorher waehlen / end the turn, choosing open rewards first */
function endTurn(s: GameState) {
  for (const p of [...s.pendingRewards]) if (s.cities.find((c) => c.id === p.cityId)?.owner === s.current) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
  const r = applyCommand(s, { type: 'endTurn' });
  expect(r.ok).toBe(true);
  return r;
}
/** Bis Fraktion 0 wieder am Zug ist, alle Fraktionen passen / until faction 0 moves again, all factions pass */
function passRound(s: GameState) {
  const events = [...endTurn(s).events];
  while (s.current !== 0 && !s.over) events.push(...endTurn(s).events);
  return events;
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
/** Einheit bereit auf ein Feld setzen / put a unit, ready, onto a tile */
function placeAt(s: GameState, u: Unit, p: { x: number; y: number }) {
  s.units = s.units.filter((o) => o === u || !(o.x === p.x && o.y === p.y));
  Object.assign(u, { x: p.x, y: p.y, startX: p.x, startY: p.y, fresh: false, exhausted: false, moved: false, attacked: false, moveDone: false });
}
const allHuman = (s: GameState) => { for (const f of s.factions) f.human = true; };

describe('Kampagne: Aufbau / campaign: structure', () => {
  it('9 Missionen in drei Akten, steigende Schwierigkeit, wechselnde Karten / 9 missions in three acts, rising difficulty, varied maps', () => {
    expect(MISSIONS.length).toBe(9);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(9);
    expect(MISSIONS.map((m) => m.act)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    const rank = { easy: 0, normal: 1, hard: 2, extreme: 3 };
    for (let i = 1; i < MISSIONS.length; i++) expect(rank[MISSIONS[i].level]).toBeGreaterThanOrEqual(rank[MISSIONS[i - 1].level]);
    expect(MISSIONS[0].level).toBe('easy');
    expect(MISSIONS[8].level).toBe('extreme');
    expect(new Set(MISSIONS.map((m) => m.seed)).size).toBe(9);
    expect(new Set(MISSIONS.map((m) => m.mapType)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(MISSIONS.map((m) => m.size)).size).toBeGreaterThanOrEqual(3);
    // Akt I gegen die Zyrr, Akt II gegen den Kult, Akt III gegen NEXUS und alle / act I vs Zyrr, II vs cult, III vs NEXUS and all
    for (const m of MISSIONS.filter((x) => x.act === 1)) expect(m.enemies.map((e) => e.id)).toEqual(['zyrr']);
    for (const m of MISSIONS.filter((x) => x.act === 2)) expect(m.enemies.map((e) => e.id)).toEqual(['vesper']);
    expect(MISSIONS[6].enemies.map((e) => e.id)).toEqual(['nexus']);
    expect(new Set(MISSIONS[8].enemies.map((e) => e.id))).toEqual(new Set(['zyrr', 'nexus', 'vesper']));
    expect(CAMPAIGN_FACTIONS).toEqual(['korvat', 'dravon', 'alvenia', 'meridon', 'velkar']);
    expect(CAMPAIGN_ENEMIES).toEqual(['zyrr', 'vesper', 'nexus']);
  });

  it('jede Mission laesst sich fuer jede Menschen-Fraktion einrichten / every mission can be set up for every human faction', () => {
    for (const m of MISSIONS) for (const f of CAMPAIGN_FACTIONS) {
      const tag = `${m.id}/${f}`;
      const a = game(m.id, f), b = game(m.id, f);
      expect(JSON.stringify(a), tag).toBe(JSON.stringify(b));
      expect(a.campaign?.mission).toBe(m.id);
      expect(a.config.campaign).toEqual({ mission: m.id });
      expect(a.factions[0].id).toBe(f);
      expect(a.factions[0].human).toBe(true);
      expect(factionVictoryOn(a)).toBe(false);
      // Gegner: nur Sonderfraktionen, im Krieg mit dem Spieler / enemies: special factions only, at war with the player
      const enemies = a.factions.slice(1, 1 + m.enemies.length);
      for (const e of enemies) {
        expect(CAMPAIGN_ENEMIES, tag).toContain(e.id);
        expect(e.relations[0], tag).toBe('war');
        expect(e.human).toBe(false);
      }
      // Verbuendete: Menschen, nie die eigene Fraktion, Frieden mit dem Spieler, Krieg mit den Gegnern
      // allies: humans, never the own faction, peace with the player, war with the enemies
      const allies = a.factions.slice(1 + m.enemies.length);
      expect(allies.length, tag).toBe(allyFor(m.id, f) ? 1 : 0);
      for (const al of allies) {
        expect(CAMPAIGN_FACTIONS).toContain(al.id);
        expect(al.id).not.toBe(f);
        expect(al.relations[0]).toBe('peace');
        expect(a.factions[0].relations[al.index]).toBe('peace');
        for (const e of enemies) expect(al.relations[e.index]).toBe('war');
        expect(a.campaign!.allies).toEqual([al.index]);
        // geteilte Karte / shared map
        al.explored.forEach((v, k) => { if (v && a.tiles[k].feature !== 'radar') expect(a.factions[0].explored[k]).toBe(1); });
      }
      expect(a.campaign!.status).toEqual(m.objectives.map(() => 'pending'));
      for (const o of [...m.objectives, ...m.bonus]) {
        if ('target' in o) expect(a.campaign!.targets[o.target], tag).toBeDefined();
        if (o.k === 'destroyUnit') expect(a.units.some((u) => u.id === a.campaign!.units![o.unit] && u.type === o.type), tag).toBe(true);
      }
      for (const w of m.waves ?? []) expect(a.campaign!.spawns![w.at], tag).toBeDefined();
      expect(a.campaign!.startCities.length).toBe(ownCities(a, 0).length);
      // nur allgemeine Menschen-Einheiten fuer den Spieler / only generic human units for the player
      for (const u of a.units.filter((x) => x.owner === 0)) expect(UNITS[u.type].faction, `${tag} ${u.type}`).toBeUndefined();
      // keine zwei Einheiten auf einem Feld, keine Einheit auf einer fremden Stadt / no two units on one tile, no unit on a foreign city
      const pos = a.units.map((u) => `${u.x},${u.y}`);
      expect(new Set(pos).size, tag).toBe(pos.length);
      for (const u of a.units) { const c = cityAt(a, u.x, u.y); if (c) expect(c.owner, tag).toBe(u.owner); }
    }
  });

  it('Verbuendete: diplomatische Fraktionen oefter, fest je Mission / allies: diplomatic factions more often, fixed per mission', () => {
    const count = (f: FactionId) => MISSIONS.filter((m) => allyFor(m.id, f)).length;
    expect(count('alvenia')).toBeGreaterThanOrEqual(4);
    expect(count('alvenia')).toBeLessThanOrEqual(5);
    expect(count('meridon')).toBeGreaterThanOrEqual(3);
    expect(count('meridon')).toBeLessThanOrEqual(4);
    for (const f of ['korvat', 'dravon', 'velkar'] as const) { expect(count(f)).toBeGreaterThanOrEqual(1); expect(count(f)).toBeLessThanOrEqual(2); }
    for (const [f, list] of Object.entries(CAMPAIGN_ALLIES)) for (const al of Object.values(list!)) expect(al).not.toBe(f);
    // Spieler kann das Buendnis nicht brechen / the player cannot break the alliance
    const s = game('m2', 'alvenia');
    const r = applyCommand(s, { type: 'diplomacy', action: 'announceBreak', target: s.campaign!.allies![0] });
    expect(r.ok).toBe(false);
  });

  it('Spielstand mit Kampagne ist speicherbar, alte Kampagnenstaende werden frei / campaign state survives save, old campaign saves become free games', () => {
    const s = game('m3', 'meridon');
    const copy = JSON.parse(JSON.stringify(s));
    expect(isValidState(copy)).toBe(true);
    expect(migrateState(copy).campaign?.mission).toBe('m3');
    expect(copy.campaign.targets).toEqual(s.campaign!.targets);
    passRound(copy);
    expect(copy.campaign.result).toBeNull();
    // alter Stand ohne Fassungsnummer / old save without a revision
    const old = JSON.parse(JSON.stringify(s));
    delete old.campaign.rev;
    const m = migrateState(old);
    expect(m.campaign).toBeUndefined();
    expect(m.config.campaign).toBeUndefined();
    expect(m.config.factionVictory).toBe(false);
  });

  it('besondere Einrichtung: Absturzstelle, Bohrer, Depots, Bunker, Artefakt / special setup: crash site, drill, depots, bunker, artifact', () => {
    const m2 = game('m2');
    const site = m2.campaign!.targets[0];
    expect(m2.tiles[site.y * m2.size + site.x].feature).toBe('crashSite');
    const m6 = game('m6', 'velkar');
    expect(m6.units.find((u) => u.id === m6.campaign!.units![0])!.owner).toBe(1);
    const m7 = game('m7');
    for (const p of m7.campaign!.targets) { const c = cityAt(m7, p.x, p.y)!; expect(c.owner).toBe(1); expect(c.upgrades).toContain('depot'); }
    expect(hqOf(game('m8'), 0)!.upgrades).toContain('bunker');
    for (const f of CAMPAIGN_FACTIONS) {
      const m9 = game('m9', f);
      const art = m9.campaign!.artifact!;
      expect(isLand(m9.tiles[art.y * m9.size + art.x])).toBe(true);
      expect(dist(art, { x: m9.size / 2, y: m9.size / 2 })).toBeLessThanOrEqual(3);
      expect(unitAt(m9, art.x, art.y)).toBeUndefined();
      // alle drei Rassen sind Feinde des Spielers und untereinander / all three races are enemies of the player and of each other
      for (const a of [1, 2, 3]) for (const b of [0, 1, 2, 3]) if (a !== b) expect(m9.factions[a].relations[b]).toBe('war');
      // jeder kennt das Artefakt / everyone knows the artifact
      for (const fa of m9.factions) expect(fa.explored[art.y * m9.size + art.x]).toBe(1);
    }
  });
});

describe('Kampagne: Ziele / campaign: objectives', () => {
  it('m1: drei Staedte = Sieg mit 3 Sternen, Zeitlimit = Niederlage / three cities = win with 3 stars, time limit = defeat', () => {
    const s = game('m1', 'dravon');
    for (const c of s.cities.filter((x) => x.owner === null).slice(0, 2)) c.owner = 0;
    const r = poke(s);
    expect(r.events.some((e) => e.t === 'objective' && e.status === 'done')).toBe(true);
    expect(s.campaign!.result).toBe('won');
    expect(s.winner).toBe(0);
    expect(s.campaign!.stars).toBe(3);
    expect(r.events.filter((e) => e.t === 'gameOver').length).toBe(1);
    expect(applyCommand(s, { type: 'endTurn' }).ok).toBe(false);

    const late = game('m1');
    late.round = missionById('m1')!.rounds;
    allHuman(late);
    passRound(late);
    expect(late.campaign!.result).toBe('lost');
    expect(late.campaign!.stars).toBe(0);
    expect(late.winner).toBe(1);
  });

  it('m2: Bergung durch den Spieler = Sieg, durch die Zyrr = Niederlage / salvage by player wins, by the Zyrr loses', () => {
    const win = game('m2');
    const site = win.campaign!.targets[0];
    const free = (s: GameState) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: site.x + dx, y: site.y + dy }))
      .find((p) => { const t = s.tiles[p.y * s.size + p.x]; return t && isLand(t) && t.terrain !== 'mountain' && !unitAt(s, p.x, p.y) && t.cityId === null; })!;
    const u = win.units.find((x) => x.owner === 0 && x.type === 'jeep')!;
    placeAt(win, u, free(win));
    const r = applyCommand(win, { type: 'move', unit: u.id, to: site });
    expect(r.ok).toBe(true);
    expect(win.campaign!.result).toBe('won');

    const lose = game('m2');
    allHuman(lose);
    endTurn(lose); // Zyrr am Zug / Zyrr to move
    const z = lose.units.find((x) => x.owner === 1)!;
    placeAt(lose, z, free(lose));
    expect(applyCommand(lose, { type: 'move', unit: z.id, to: site }).ok).toBe(true);
    expect(lose.campaign!.status[0]).toBe('failed');
    expect(lose.campaign!.result).toBe('lost');
  });

  it('m3: Wellen treffen ein, Stadtverlust = Niederlage, Halten = Sieg / waves arrive, losing a city = defeat, holding = win', () => {
    const s = game('m3');
    allHuman(s);
    const before = s.units.filter((u) => u.owner === 1).length;
    passRound(s);
    const ev = passRound(s); // Beginn Runde 3 / start of round 3
    expect(ev.some((e) => e.t === 'wave' && e.faction === 1)).toBe(true);
    expect(s.campaign!.waves).toBe(1);
    expect(s.units.filter((u) => u.owner === 1).length).toBeGreaterThan(before);
    // Wellen-Einheiten nie auf fremden Staedten / wave units never on foreign cities
    for (const u of s.units) { const c = cityAt(s, u.x, u.y); if (c) expect(c.owner).toBe(u.owner); }
    const c = s.cities.find((x) => x.id === s.campaign!.startCities[1])!;
    c.owner = 1;
    poke(s);
    expect(s.campaign!.result).toBe('lost');

    const held = game('m3');
    allHuman(held);
    held.units = held.units.filter((u) => u.owner !== 1);
    held.round = missionById('m3')!.rounds;
    held.campaign!.waves = missionById('m3')!.waves!.length;
    passRound(held);
    expect(held.campaign!.result).toBe('won');
    expect(held.campaign!.status).toEqual(['done']);
  });

  it('m4: Abschuesse; alle Gegner ausgeschieden = Sieg / kills; all enemies eliminated = win', () => {
    const s = game('m4');
    s.factions[0].kills = 5;
    poke(s);
    expect(s.campaign!.result).toBeNull();
    s.factions[0].kills = 6;
    poke(s);
    expect(s.campaign!.result).toBe('won');

    const e = game('m4');
    expect(ownCities(e, 1).length).toBe(1);
    const hq = ownCities(e, 1)[0];
    const u = e.units.find((x) => x.owner === 0 && x.type === 'infantry')!;
    placeAt(e, u, hq);
    const r = applyCommand(e, { type: 'capture', unit: u.id });
    expect(r.ok).toBe(true);
    expect(e.campaign!.result).toBe('won');
    expect(r.events.filter((x) => x.t === 'gameOver').length).toBe(1);
  });

  it('m5/m7: Eroberung der Zielstaedte / capturing the target cities', () => {
    const m5 = game('m5', 'meridon');
    const t = m5.campaign!.targets[0];
    expect(cityAt(m5, t.x, t.y)!.isHQ).toBe(true);
    cityAt(m5, t.x, t.y)!.owner = 0;
    poke(m5);
    expect(m5.campaign!.result).toBe('won');

    const s = game('m7');
    const [a, b] = s.campaign!.targets;
    cityAt(s, a.x, a.y)!.owner = 0;
    poke(s);
    expect(s.campaign!.status).toEqual(['done', 'pending']);
    expect(s.campaign!.result).toBeNull();
    cityAt(s, b.x, b.y)!.owner = 0;
    poke(s);
    expect(s.campaign!.result).toBe('won');
  });

  it('m6: Bohrer zerstoert = Sieg, Bohrer steht am Ende = Niederlage / drill destroyed = win, drill standing at the end = defeat', () => {
    const s = game('m6', 'alvenia');
    const id = s.campaign!.units![0];
    const drill = s.units.find((u) => u.id === id)!;
    drill.hp = 10;
    const m = missionById('m6')!;
    expect(s.campaign!.units).toHaveLength(1);
    s.units = s.units.filter((u) => u.id !== id);
    poke(s);
    expect(s.campaign!.status).toEqual(['done']);
    expect(s.campaign!.result).toBe('won');

    const late = game('m6');
    allHuman(late);
    late.round = m.rounds;
    passRound(late);
    expect(late.campaign!.result).toBe('lost');
  });

  it('m8: HQ verloren = Niederlage, Ueberleben = Sieg, Verstaerkung trifft ein / HQ lost = defeat, surviving = win, reinforcements arrive', () => {
    const lost = game('m8');
    hqOf(lost, 0)!.owner = 1;
    poke(lost);
    expect(lost.campaign!.result).toBe('lost');

    const s = game('m8');
    allHuman(s);
    const own = s.units.filter((u) => u.owner === 0).length;
    s.round = 6;
    s.campaign!.waves = 2;
    const ev = passRound(s);
    expect(ev.some((e) => e.t === 'wave' && e.faction === 0)).toBe(true);
    expect(s.units.filter((u) => u.owner === 0).length).toBe(own + 2);
    expect(s.units.some((u) => u.owner === 0 && u.type === 'tank')).toBe(true);

    const won = game('m8');
    allHuman(won);
    won.round = missionById('m8')!.rounds;
    won.campaign!.waves = missionById('m8')!.waves!.length;
    passRound(won);
    expect(won.campaign!.result).toBe('won');
  });

  it('m9: Artefakt drei Runden besetzt = Sieg, ein Gegner zuerst = Niederlage / artifact held three rounds = win, an enemy first = defeat', () => {
    const s = game('m9');
    allHuman(s);
    const art = s.campaign!.artifact!;
    const u = s.units.find((x) => x.owner === 0 && x.type === 'mg')!;
    placeAt(s, u, art);
    passRound(s);
    expect(s.campaign!.hold).toEqual({ faction: 0, n: 1 });
    passRound(s);
    expect(s.campaign!.result).toBeNull();
    passRound(s);
    expect(s.campaign!.status[0]).toBe('done');
    expect(s.campaign!.result).toBe('won');
    expect(s.winner).toBe(0);

    const e = game('m9', 'velkar');
    allHuman(e);
    const z = e.units.find((x) => x.owner === 2)!;
    placeAt(e, z, e.campaign!.artifact!);
    passRound(e); passRound(e);
    expect(e.campaign!.result).toBeNull();
    passRound(e);
    expect(e.campaign!.status[0]).toBe('failed');
    expect(e.campaign!.result).toBe('lost');
    expect(e.winner).toBe(2);

    // Wechsel des Besetzers setzt den Zaehler zurueck / a change of occupant resets the count
    const c = game('m9');
    allHuman(c);
    const mine = c.units.find((x) => x.owner === 0 && x.type === 'mg')!;
    placeAt(c, mine, c.campaign!.artifact!);
    passRound(c); passRound(c);
    const foe = c.units.find((x) => x.owner === 1)!;
    c.units = c.units.filter((x) => x !== mine);
    placeAt(c, foe, c.campaign!.artifact!);
    passRound(c);
    expect(c.campaign!.hold).toEqual({ faction: 1, n: 1 });
    expect(c.campaign!.result).toBeNull();
  });

  it('Spieler ausgeschieden = Niederlage, Verbuendete zaehlen nicht als Gegner / player eliminated = defeat, allies do not count as enemies', () => {
    const s = game('m7');
    s.factions[0].alive = false;
    poke(s);
    expect(s.campaign!.result).toBe('lost');
    expect(s.winner).not.toBe(0);

    const a = game('m4', 'alvenia');
    const hq = ownCities(a, 1)[0];
    const u = a.units.find((x) => x.owner === 0 && x.type === 'infantry')!;
    placeAt(a, u, hq);
    expect(applyCommand(a, { type: 'capture', unit: u.id }).ok).toBe(true);
    expect(a.factions[2].alive).toBe(true); // Verbuendeter lebt / the ally is alive
    expect(a.campaign!.result).toBe('won');
  });
});

describe('Kampagne: Ueberzeugen / campaign: persuasion', () => {
  /** Eigene Einheit neben eine neutrale Siedlung stellen / put an own unit next to a neutral settlement */
  function nextToVillage(s: GameState) {
    for (const c of s.cities.filter((x) => x.owner === null)) {
      const p = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }))
        .find((q) => { const t = s.tiles[q.y * s.size + q.x]; return t && isLand(t) && t.terrain !== 'mountain' && !t.volcano && t.cityId === null && !unitAt(s, q.x, q.y); });
      if (!p) continue;
      const u = s.units.find((x) => x.owner === 0 && x.type === 'infantry')!;
      placeAt(s, u, p);
      return { c, u };
    }
    throw new Error('no village');
  }

  it('Alvenia und Meridon gewinnen eine Siedlung ohne Kampf / Alvenia and Meridon win a settlement without combat', () => {
    for (const f of PERSUADE.factions) {
      const s = game('m1', f);
      const { c, u } = nextToVillage(s);
      const stars = s.factions[0].stars;
      const r = applyCommand(s, { type: 'persuade', unit: u.id, city: c.id });
      expect(r.ok, f).toBe(true);
      expect(c.owner).toBe(0);
      expect(s.factions[0].stars).toBe(stars - persuadeCost(c));
      expect(u.exhausted).toBe(true);
      expect(r.events.some((e) => e.t === 'capture' && e.city === c.id && e.from === null)).toBe(true);
      // zweimal geht nicht / not twice
      expect(applyCommand(s, { type: 'persuade', unit: u.id, city: c.id }).ok).toBe(false);
    }
  });

  it('Pruefungen: Fraktion, nur Kampagne, Reichweite, Sterne / checks: faction, campaign only, range, stars', () => {
    const k = game('m1', 'korvat');
    const a = nextToVillage(k);
    expect(applyCommand(k, { type: 'persuade', unit: a.u.id, city: a.c.id }).error).toBe('wrongFaction');

    const free = createGame(defaultConfig({ seed: 1101, size: 11, mapType: 'continent', factions: [{ id: 'alvenia', human: true, difficulty: 'normal' }, { id: 'zyrr', human: false, difficulty: 'easy' }] }));
    const b = nextToVillage(free);
    expect(applyCommand(free, { type: 'persuade', unit: b.u.id, city: b.c.id }).error).toBe('wrongFaction');

    const s = game('m1', 'meridon');
    const c = nextToVillage(s);
    s.factions[0].stars = persuadeCost(c.c) - 1;
    expect(applyCommand(s, { type: 'persuade', unit: c.u.id, city: c.c.id }).error).toBe('notEnoughStars');
    s.factions[0].stars = 99;
    placeAt(s, c.u, { x: c.c.x + 3 < s.size ? c.c.x + 3 : c.c.x - 3, y: c.c.y });
    expect(applyCommand(s, { type: 'persuade', unit: c.u.id, city: c.c.id }).error).toBe('outOfRange');
  });
});

describe('Kampagne: KI spielt alle Missionen / AI plays all missions', () => {
  it('jede Mission x 2 Fraktionen, 15 Runden ohne Fehlbefehle / every mission x 2 factions, 15 rounds without failed commands', () => {
    const errors = aiDebug.errors;
    for (const m of MISSIONS) for (const f of ['alvenia', 'dravon'] as const) {
      const s = game(m.id, f);
      s.factions[0].human = false;
      let fails = 0, guard = 0;
      while (!s.over && s.round <= 15 && guard++ < 30000) {
        const fi = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
      expect(fails, `${m.id}/${f}`).toBe(0);
      expect(s.round, `${m.id}/${f}`).toBeLessThanOrEqual(m.rounds + 1);
      // Verbuendete bleiben Verbuendete / allies stay allies
      for (const i of s.campaign!.allies ?? []) expect(s.factions[0].relations[i], `${m.id}/${f}`).toBe('peace');
    }
    expect(aiDebug.errors).toBe(errors);
  }, 300_000);
});
