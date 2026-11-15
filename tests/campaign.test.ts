/**
 * Kampagne: Einrichtung fuer alle Menschen-Fraktionen, Gegner nur Sonderfraktionen, Verbuendete, Ziele (Sieg und
 * Niederlage), Wellen, Portal, Landetrupp, Schwarmmutter, Artefakt, Ueberzeugen, Speicherung und KI-Laeufe.
 * Campaign: setup for every human faction, special-race enemies only, allies, objectives (win and loss), waves,
 * portal, landing party, Swarm Mother, artifact, persuasion, saving and AI runs.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, cityAt, createGame, dist, factionVictoryOn, hqOf, isLand, MISSIONS, missionById, missionConfig, ownCities, unitAt,
  CAMPAIGN_ALLIES, CAMPAIGN_ENEMIES, CAMPAIGN_FACTIONS, allyFor, persuadeCost, defaultConfig, objectiveProgress, FINALE_ID, MISSION_IDS,
  type GameEvent, type GameState, type Unit,
} from '../src/core';
import { isValidState, migrateState } from '../src/save/save';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI, PERSUADE, SWARM_MOTHER, UNITS, type FactionId } from '../src/data/balance';

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
  it('11 Missionen in drei Akten, steigende Schwierigkeit je Akt, wechselnde Karten / 11 missions in three acts, rising difficulty per act, varied maps', () => {
    expect(MISSIONS.length).toBe(11);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(11);
    // IDs bleiben stabil, neue werden angehaengt / ids stay stable, new ones are appended
    expect(MISSION_IDS).toEqual(['m1', 'm2', 'm3', 'm10', 'm11', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9']);
    expect(MISSIONS.map((m) => m.act)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
    const rank = { easy: 0, normal: 1, hard: 2, extreme: 3 };
    for (let i = 1; i < MISSIONS.length; i++) {
      if (MISSIONS[i].act !== MISSIONS[i - 1].act) continue;
      expect(rank[MISSIONS[i].level], MISSIONS[i].id).toBeGreaterThanOrEqual(rank[MISSIONS[i - 1].level]);
    }
    // jeder Akt endet mit einem schweren Einsatz / every act ends with a hard mission
    for (const a of [1, 2, 3]) expect(rank[MISSIONS.filter((m) => m.act === a).at(-1)!.level]).toBeGreaterThanOrEqual(rank.hard);
    expect(MISSIONS[0].level).toBe('easy');
    expect(MISSIONS.at(-1)!.level).toBe('extreme');
    expect(FINALE_ID).toBe('m9');
    expect(new Set(MISSIONS.map((m) => m.seed)).size).toBe(11);
    expect(new Set(MISSIONS.map((m) => m.mapType)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(MISSIONS.map((m) => m.size)).size).toBeGreaterThanOrEqual(3);
    // Akt I gegen die Zyrr, Akt II gegen den Kult, Akt III gegen NEXUS und alle / act I vs Zyrr, II vs cult, III vs NEXUS and all
    for (const m of MISSIONS.filter((x) => x.act === 1)) expect(m.enemies.map((e) => e.id)).toEqual(['zyrr']);
    for (const m of MISSIONS.filter((x) => x.act === 2)) expect(m.enemies.map((e) => e.id)).toEqual(['vesper']);
    expect(missionById('m7')!.enemies.map((e) => e.id)).toEqual(['nexus']);
    expect(new Set(missionById('m9')!.enemies.map((e) => e.id))).toEqual(new Set(['zyrr', 'nexus', 'vesper']));
    // die Alienwelt: Thema nur fuer m10 und m11, im Spiel gesetzt / the alien world: theme only for m10 and m11, set in the game
    expect(MISSIONS.filter((m) => m.theme === 'alien').map((m) => m.id)).toEqual(['m10', 'm11']);
    expect(missionConfig('m10').theme).toBe('alien');
    expect(missionConfig('m1').theme).toBeUndefined();
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
        // der Endgegner taucht erst spaeter auf / the boss only emerges later
        if (o.k === 'destroyUnit' && !m.boss) expect(a.units.some((u) => u.id === a.campaign!.units![o.unit] && u.type === o.type), tag).toBe(true);
        if (o.k === 'portal') expect(a.campaign!.portal, tag).toBeDefined();
      }
      if (m.boss) expect(a.campaign!.targets[m.boss.at], tag).toBeDefined();
      // Alienwelt: ganz Xeno-Boden; sonst nur rund um die Zyrr / alien world: all xeno ground; otherwise only around the Zyrr
      if (m.theme === 'alien') for (const t of a.tiles) if (t.terrain !== 'ocean') expect(t.xeno, tag).toBe(true);
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
    expect(count('alvenia')).toBeGreaterThanOrEqual(5);
    expect(count('alvenia')).toBeLessThanOrEqual(6);
    expect(count('meridon')).toBeGreaterThanOrEqual(4);
    expect(count('meridon')).toBeLessThanOrEqual(5);
    // der Landetrupp ist allein / the landing party is alone
    for (const f of CAMPAIGN_FACTIONS) expect(allyFor('m10', f)).toBeNull();
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

  it('m2: Landekapseln treffen ein, Stadtverlust = Niederlage / landing pods arrive, losing a city = defeat', () => {
    const s = game('m2');
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
  });

  it('m3: Portal zwei Runden halten = Sieg, Abzug setzt zurueck, Nachschub kommt durchs Portal / holding the portal two rounds wins, leaving resets, reinforcements come through the portal', () => {
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game('m3', f);
      const p = s.campaign!.portal!;
      expect(s.campaign!.targets[0]).toEqual(p);
      expect(s.campaign!.spawns![0]).toEqual(p);
      // Garnison auf dem Portal, das Portal ist allen bekannt / garrison on the portal, everyone knows the portal
      expect(unitAt(s, p.x, p.y)?.owner, f).toBe(1);
      for (const fa of s.factions) expect(fa.explored[p.y * s.size + p.x]).toBe(1);
      expect(objectiveProgress(s, missionById('m3')!.objectives[0], 14)).toEqual({ have: 0, need: 2 });
    }
    const s = game('m3');
    allHuman(s);
    const p = s.campaign!.portal!;
    // Garnison geschlagen: eigene Einheit auf dem Portal / garrison beaten: own unit on the portal
    s.units = s.units.filter((u) => !(u.owner === 1 && dist(u, p) <= 1));
    const u = s.units.find((x) => x.owner === 0 && x.type === 'mg')!;
    placeAt(s, u, p);
    passRound(s);
    expect(s.campaign!.portalHold).toBe(1);
    expect(s.campaign!.result).toBeNull();
    // kurz weg: der Zaehler beginnt von vorn / briefly away: the count starts over
    placeAt(s, u, { x: p.x === 0 ? 1 : p.x - 1, y: p.y });
    passRound(s);
    expect(s.campaign!.portalHold).toBe(0);
    placeAt(s, u, p);
    // Runde 4: die erste Welle kommt durchs Portal, neben das besetzte Feld / round 4: the first wave comes through the portal, next to the occupied tile
    const ev = passRound(s);
    expect(s.round).toBe(4);
    expect(s.campaign!.portalHold).toBe(1);
    expect(s.campaign!.result).toBeNull();
    const wave = ev.find((e) => e.t === 'wave' && e.faction === 1);
    expect(wave && wave.t === 'wave' ? dist(wave, p) : 99).toBe(0);
    expect(s.units.filter((x) => x.owner === 1 && dist(x, p) === 1).length).toBeGreaterThanOrEqual(1);
    passRound(s);
    expect(s.campaign!.status[0]).toBe('done');
    expect(s.campaign!.result).toBe('won');
    expect(s.winner).toBe(0);

    const late = game('m3');
    allHuman(late);
    late.round = missionById('m3')!.rounds;
    late.campaign!.waves = missionById('m3')!.waves!.length;
    passRound(late);
    expect(late.campaign!.result).toBe('lost');
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

describe('Kampagne: Alienwelt / campaign: alien world', () => {
  /** Freies Landfeld im Abstand d von p / free land tile at distance d from p */
  function landAt(s: GameState, p: { x: number; y: number }, d: number) {
    for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) {
      const t = s.tiles[y * s.size + x];
      if (dist({ x, y }, p) === d && isLand(t) && t.terrain !== 'mountain' && t.cityId === null && !unitAt(s, x, y)) return { x, y };
    }
    throw new Error('no tile');
  }

  it('m10: Landetrupp ohne Stadt neben dem Portal, fuer alle Fraktionen / landing party without a city next to the portal, for every faction', () => {
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game('m10', f);
      const c = s.campaign!;
      expect(ownCities(s, 0), f).toHaveLength(0);
      expect(c.landing, f).toBe(true);
      expect(c.startCities).toEqual([]);
      const own = s.units.filter((u) => u.owner === 0);
      expect(own.map((u) => u.type).sort(), f).toEqual(['artillery', 'infantry', 'jeep', 'mg']);
      // alle neben dem Portal, nicht darauf / all next to the portal, not on it
      for (const u of own) { expect(dist(u, c.portal!), f).toBeLessThanOrEqual(2); expect(dist(u, c.portal!), f).toBeGreaterThanOrEqual(1); }
      // Vorposten: Zyrr-Stadt mit Besatzung, das alte Hauptquartier des Spielers / outpost: Zyrr city with a garrison, the player's old HQ
      const out = cityAt(s, c.targets[0].x, c.targets[0].y)!;
      expect(out.owner).toBe(1);
      expect(out.hqOf).toBe(0);
      expect(unitAt(s, out.x, out.y)?.owner).toBe(1);
      expect(dist(out, c.portal!)).toBeGreaterThanOrEqual(3);
      // Ziel 2: das Hauptquartier der Zyrr / objective 2: the Zyrr HQ
      expect(c.targets[1]).toEqual({ x: hqOf(s, 1)!.x, y: hqOf(s, 1)!.y });
      expect(s.factions[0].explored[c.targets[1].y * s.size + c.targets[1].x]).toBe(1);
      // der Sold frisst den Landetrupp nicht auf / upkeep does not eat the landing party
      expect(own.length).toBeLessThanOrEqual(4);
    }
  });

  it('m10: der Landetrupp scheidet vor der ersten Einnahme nicht aus / the landing party is not eliminated before the first capture', () => {
    const s = game('m10', 'velkar');
    allHuman(s);
    for (let i = 0; i < 3; i++) passRound(s);
    expect(s.factions[0].alive).toBe(true);
    expect(s.campaign!.result).toBeNull();
    // eine Einnahme der Zyrr prueft das Ausscheiden aller Fraktionen / a Zyrr capture checks every faction for elimination
    endTurn(s);
    const village = s.cities.find((c) => c.owner === null)!;
    const z = s.units.find((u) => u.owner === 1 && u.type === 'grey')!;
    placeAt(s, z, village);
    expect(applyCommand(s, { type: 'capture', unit: z.id }).ok).toBe(true);
    expect(village.owner).toBe(1);
    expect(s.factions[0].alive).toBe(true);
    expect(s.units.filter((u) => u.owner === 0)).toHaveLength(4);
    expect(s.campaign!.result).toBeNull();

    // ohne Einheiten ist der Landetrupp verloren / without units the landing party is lost
    const w = game('m10');
    allHuman(w);
    w.units = w.units.filter((u) => u.owner !== 0);
    endTurn(w);
    expect(w.campaign!.result).toBe('lost');
    expect(w.winner).toBe(1);
  });

  it('m10: Vorposten erobert = eigene Basis, Ausbilden moeglich; Hauptquartier erreicht = Sieg / outpost captured = own base, training possible; HQ reached = win', () => {
    const s = game('m10', 'meridon');
    const c = s.campaign!;
    const out = cityAt(s, c.targets[0].x, c.targets[0].y)!;
    // ausbilden geht vorher nicht / training is impossible before
    expect(applyCommand(s, { type: 'train', city: out.id, unitType: 'infantry' }).ok).toBe(false);
    s.units = s.units.filter((u) => !(u.owner === 1 && u.x === out.x && u.y === out.y));
    const inf = s.units.find((u) => u.owner === 0 && u.type === 'infantry')!;
    placeAt(s, inf, out);
    const r = applyCommand(s, { type: 'capture', unit: inf.id });
    expect(r.ok).toBe(true);
    expect(out.owner).toBe(0);
    // die eroberte Stadt ist das neue Hauptquartier, der Landetrupp gilt als gelandet / the captured city is the new HQ, the landing is over
    expect(hqOf(s, 0)?.id).toBe(out.id);
    expect(c.landing).toBe(false);
    expect(c.status).toEqual(['done', 'pending']);
    expect(c.result).toBeNull();
    placeAt(s, inf, landAt(s, out, 1));
    expect(applyCommand(s, { type: 'train', city: out.id, unitType: 'infantry' }).ok).toBe(true);
    // bis an das Hauptquartier der Zyrr / up to the Zyrr HQ
    const jeep = s.units.find((u) => u.owner === 0 && u.type === 'jeep')!;
    placeAt(s, jeep, landAt(s, c.targets[1], 2));
    poke(s);
    expect(c.status[1]).toBe('pending');
    placeAt(s, jeep, landAt(s, c.targets[1], 1));
    poke(s);
    expect(c.status).toEqual(['done', 'done']);
    expect(c.result).toBe('won');
    expect(s.winner).toBe(0);

    // nach der Landung gelten die normalen Regeln: Stadt verloren = ausgeschieden / after landing the normal rules apply: city lost = eliminated
    const l = game('m10');
    allHuman(l);
    const o2 = cityAt(l, l.campaign!.targets[0].x, l.campaign!.targets[0].y)!;
    l.units = l.units.filter((u) => !(u.owner === 1 && u.x === o2.x && u.y === o2.y));
    const i2 = l.units.find((u) => u.owner === 0 && u.type === 'infantry')!;
    placeAt(l, i2, o2);
    expect(applyCommand(l, { type: 'capture', unit: i2.id }).ok).toBe(true);
    placeAt(l, i2, landAt(l, o2, 1));
    endTurn(l);
    const g = l.units.find((u) => u.owner === 1 && u.type === 'grey')!;
    placeAt(l, g, o2);
    expect(applyCommand(l, { type: 'capture', unit: g.id }).ok).toBe(true);
    expect(l.factions[0].alive).toBe(false);
    expect(l.campaign!.result).toBe('lost');
  });

  /** Mission m11 mit aufgetauchter Schwarmmutter / mission m11 with the Swarm Mother emerged */
  function withBoss(f: FactionId = 'korvat') {
    const s = game('m11', f);
    allHuman(s);
    const hq = s.campaign!.targets[0];
    const u = s.units.find((x) => x.owner === 0 && x.type === 'infantry')!;
    placeAt(s, u, landAt(s, hq, SWARM_MOTHER.emergeRange));
    const r = poke(s);
    const boss = s.units.find((x) => x.type === 'swarmMother')!;
    return { s, hq, boss, events: r.events };
  }

  it('m11: die Schwarmmutter fehlt zu Beginn und taucht nahe ihrem Hauptquartier auf / the Swarm Mother is absent at first and emerges near her HQ', () => {
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game('m11', f);
      expect(s.units.some((u) => u.type === 'swarmMother'), f).toBe(false);
      expect(s.campaign!.status).toEqual(['pending', 'pending']);
      expect(s.campaign!.targets[0]).toEqual({ x: hqOf(s, 1)!.x, y: hqOf(s, 1)!.y });
      expect(s.campaign!.portal).toBeDefined();
    }
    const { s, hq, boss, events } = withBoss();
    expect(boss.owner).toBe(1);
    expect(dist(boss, hq)).toBeLessThanOrEqual(1);
    expect(boss.hp).toBe(UNITS.swarmMother.hp);
    expect(UNITS.swarmMother.hp).toBeGreaterThanOrEqual(60);
    expect(UNITS.swarmMother.range).toBe(2);
    expect(s.campaign!.units).toEqual([boss.id]);
    expect(s.campaign!.bossRound).toBe(1);
    expect(events.some((e) => e.t === 'boss' && e.what === 'emerge' && e.unit === boss.id)).toBe(true);
    expect(s.factions[0].explored[boss.y * s.size + boss.x]).toBe(1);
    expect(objectiveProgress(s, missionById('m11')!.objectives[0], 16)).toEqual({ have: 0, need: boss.maxHp });
    // nur einmal / only once
    poke(s);
    expect(s.units.filter((u) => u.type === 'swarmMother')).toHaveLength(1);
    // ohne Annaeherung spaetestens in Runde emergeRound / without an approach at round emergeRound at the latest
    const late = game('m11');
    allHuman(late);
    late.round = SWARM_MOTHER.emergeRound - 1;
    passRound(late);
    expect(late.units.some((u) => u.type === 'swarmMother')).toBe(true);
    expect(late.campaign!.bossRound).toBe(SWARM_MOTHER.emergeRound);
  });

  it('m11: Faehigkeiten: Heilung auf Xeno-Boden, Schrei, Brut, Abklingzeiten / abilities: xeno healing, scream, brood, cooldowns', () => {
    const { s, boss } = withBoss();
    expect(s.tiles[boss.y * s.size + boss.x].xeno).toBe(true);
    boss.hp = 40;
    // zwei Spielereinheiten neben ihr / two player units next to her
    const free = (n: number) => {
      const out: { x: number; y: number }[] = [];
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const p = { x: boss.x + d[0], y: boss.y + d[1] };
        const t = s.tiles[p.y * s.size + p.x];
        if (t && isLand(t) && t.terrain !== 'mountain' && t.cityId === null && !unitAt(s, p.x, p.y)) out.push(p);
      }
      return out.slice(0, n);
    };
    const spots = free(3);
    expect(spots.length).toBeGreaterThanOrEqual(3);
    const mg = s.units.find((u) => u.owner === 0 && u.type === 'mg')!;
    const inf = s.units.find((u) => u.owner === 0 && u.type === 'infantry')!;
    placeAt(s, mg, spots[0]); placeAt(s, inf, spots[1]);
    const mgHp = mg.hp, infHp = inf.hp;
    const zyrr = s.units.filter((u) => u.owner === 1).length;
    const ev = endTurn(s).events; // Zug der Zyrr beginnt / the Zyrr turn starts
    expect(s.current).toBe(1);
    expect(boss.hp).toBe(40 + SWARM_MOTHER.xenoHeal);
    expect(ev.some((e) => e.t === 'heal' && e.unit === boss.id && e.amount === SWARM_MOTHER.xenoHeal)).toBe(true);
    const scream = ev.find((e): e is Extract<GameEvent, { t: 'boss' }> => e.t === 'boss' && e.what === 'scream')!;
    expect(scream.hits!.map((h) => h.unit).sort()).toEqual([mg.id, inf.id].sort());
    expect(mg.hp).toBe(mgHp - SWARM_MOTHER.screamDamage);
    expect(inf.hp).toBe(infHp - SWARM_MOTHER.screamDamage);
    const brood = ev.find((e) => e.t === 'boss' && e.what === 'brood');
    expect(brood && brood.t === 'boss' ? brood.count : 0).toBe(SWARM_MOTHER.broodCount);
    const greys = s.units.filter((u) => u.owner === 1 && u.type === 'grey' && dist(u, boss) === 1 && u.fresh);
    expect(greys.length).toBe(SWARM_MOTHER.broodCount);
    expect(s.units.filter((u) => u.owner === 1).length).toBe(zyrr + SWARM_MOTHER.broodCount);
    // naechste Runde: Schrei und Brut klingen ab / next round: scream and brood are cooling down
    endTurn(s); // Zyrr fertig, Spieler am Zug / Zyrr done, player to move
    const ev2 = endTurn(s).events;
    expect(ev2.some((e) => e.t === 'boss')).toBe(false);
    expect(mg.hp).toBe(mgHp - SWARM_MOTHER.screamDamage);
    // nach screamEvery Runden schreit sie wieder / after screamEvery rounds she screams again
    for (let i = 1; i < SWARM_MOTHER.screamEvery; i++) { endTurn(s); endTurn(s); }
    expect(s.current).toBe(1);
    // die Einheiten stehen noch daneben / the units still stand next to her
    expect(dist(mg, boss)).toBe(1);
    expect(boss.boss!.scream).toBeGreaterThan(s.round);
    // nicht bekehrbar, kein Sold, nimmt nichts ein / not convertible, no upkeep, captures nothing
    expect(UNITS.swarmMother.abilities).toContain('boss');
    expect(UNITS.swarmMother.cost).toBeNull();
  });

  it('m11: Schrei kann toeten und zaehlt als Abschuss / the scream can kill and counts as a kill', () => {
    const { s, boss } = withBoss('dravon');
    const inf = s.units.find((u) => u.owner === 0 && u.type === 'infantry')!;
    const p = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].map(([dx, dy]) => ({ x: boss.x + dx, y: boss.y + dy }))
      .find((q) => { const t = s.tiles[q.y * s.size + q.x]; return t && isLand(t) && t.cityId === null && !unitAt(s, q.x, q.y); })!;
    placeAt(s, inf, p);
    inf.hp = SWARM_MOTHER.screamDamage;
    const ev = endTurn(s).events;
    expect(s.units.includes(inf)).toBe(false);
    expect(ev.some((e) => e.t === 'killed' && e.unit === inf.id && e.by === boss.id)).toBe(true);
    expect(boss.kills).toBe(1);
  });

  it('m11: Schwarmmutter besiegt = Sieg, Hauptquartier verloren = Niederlage / Swarm Mother defeated = win, HQ lost = defeat', () => {
    const { s, boss } = withBoss('alvenia');
    s.config.hitChance = false;
    const tank = s.units.find((u) => u.owner === 0 && u.type === 'tank')!;
    const p = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: boss.x + dx, y: boss.y + dy }))
      .find((q) => { const t = s.tiles[q.y * s.size + q.x]; return t && isLand(t) && t.cityId === null && !unitAt(s, q.x, q.y); })!;
    placeAt(s, tank, p);
    boss.hp = 1;
    const r = applyCommand(s, { type: 'attack', unit: tank.id, target: boss.id });
    expect(r.ok).toBe(true);
    expect(s.units.some((u) => u.id === boss.id)).toBe(false);
    expect(s.campaign!.status[0]).toBe('done');
    expect(s.campaign!.result).toBe('won');
    expect(s.winner).toBe(0);
    expect(r.events.filter((e) => e.t === 'gameOver')).toHaveLength(1);

    const lost = game('m11');
    hqOf(lost, 0)!.owner = 1;
    poke(lost);
    expect(lost.campaign!.result).toBe('lost');

    const late = game('m11');
    allHuman(late);
    late.round = missionById('m11')!.rounds;
    passRound(late);
    expect(late.campaign!.result).toBe('lost');
  });

  it('m11: die KI fuehrt die Schwarmmutter nahe ihrem Hauptquartier / the AI keeps the Swarm Mother near her HQ', () => {
    const errors = aiDebug.errors;
    for (const f of ['korvat', 'velkar'] as const) {
      const s = game('m11', f);
      s.factions[0].human = false;
      let fails = 0, guard = 0, seen = 0, far = 0;
      const hq = s.campaign!.targets[0];
      while (!s.over && s.round <= 14 && guard++ < 30000) {
        const fi = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
        const b = s.units.find((u) => u.type === 'swarmMother');
        if (b) { seen++; if (dist(b, hq) > SWARM_MOTHER.aiLeash + 1) far++; }
      }
      expect(fails, f).toBe(0);
      expect(seen, f).toBeGreaterThan(0);
      expect(far, f).toBe(0);
    }
    expect(aiDebug.errors).toBe(errors);
  }, 120_000);
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
