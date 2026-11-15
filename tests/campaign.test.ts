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
  WORLDS, worldOf, worldNumber, missionNumber, UNPLACED_MISSIONS, towersHeld,
  type GameEvent, type GameState, type Unit,
} from '../src/core';
import { isValidState, migrateState } from '../src/save/save';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI, PERSUADE, SWARM_MOTHER, TOWER_HOLD, UNITS, type FactionId } from '../src/data/balance';

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
  it('14 Missionen auf drei Welten in WORLDS-Reihenfolge, steigende Schwierigkeit je Welt / 14 missions on three worlds in WORLDS order, rising difficulty per world', () => {
    expect(MISSIONS.length).toBe(14);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(14);
    // Reihenfolge und Welt kommen allein aus WORLDS / order and world come from WORLDS alone
    expect(MISSION_IDS).toEqual(WORLDS.flatMap((w) => w.missions));
    expect(MISSION_IDS).toEqual(['m1', 'm2', 'm4', 'm5', 'm6', 'm7', 'm8', 'm3', 'm10', 'm11', 'm12', 'm13', 'm14', 'm9']);
    expect(UNPLACED_MISSIONS).toEqual([]);
    for (const m of MISSIONS) {
      expect(m.act, m.id).toBe(WORLDS.findIndex((w) => w.id === worldOf(m.id)) + 1);
      expect(worldNumber(m.id)).toBe(m.act);
      expect(missionNumber(m.id)).toBe(MISSION_IDS.indexOf(m.id) + 1);
    }
    expect(MISSIONS.map((m) => m.act)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3]);
    const rank = { easy: 0, normal: 1, hard: 2, extreme: 3 };
    // Schwierigkeit steigt entlang WORLDS innerhalb jeder Welt / difficulty rises along WORLDS inside each world
    for (const w of WORLDS) {
      const ms = w.missions.map((id) => missionById(id)!);
      for (let i = 1; i < ms.length; i++) expect(rank[ms[i].level], ms[i].id).toBeGreaterThanOrEqual(rank[ms[i - 1].level]);
      // jede Welt endet mit einem schweren Einsatz / every world ends with a hard mission
      expect(rank[ms.at(-1)!.level], w.id).toBeGreaterThanOrEqual(rank.hard);
    }
    // ueber die Welten hinweg nie leichter als am Ende der vorigen Welt minus eins / across worlds never easier than the end of the previous one minus one
    for (let i = 1; i < WORLDS.length; i++) {
      const prev = missionById(WORLDS[i - 1].missions.at(-1)!)!, first = missionById(WORLDS[i].missions[0])!;
      expect(rank[first.level]).toBeGreaterThanOrEqual(rank[prev.level] - 1);
    }
    expect(MISSIONS[0].level).toBe('easy');
    expect(MISSIONS.at(-1)!.level).toBe('extreme');
    expect(FINALE_ID).toBe('m9');
    expect(FINALE_ID).toBe(WORLDS.at(-1)!.missions.at(-1));
    expect(new Set(MISSIONS.map((m) => m.seed)).size).toBe(14);
    expect(new Set(MISSIONS.map((m) => m.mapType)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(MISSIONS.map((m) => m.size)).size).toBeGreaterThanOrEqual(3);
    // Erde: Zyrr, Kult, NEXUS, dann wieder Zyrr am Portal; Alienwelt: Zyrr; Wueste: alle drei / Earth: Zyrr, cult, NEXUS, then Zyrr again at the portal; alien world: Zyrr; desert: all three
    const foes = (id: string) => missionById(id)!.enemies.map((e) => e.id);
    for (const id of ['m1', 'm2', 'm3', 'm10', 'm11']) expect(foes(id), id).toEqual(['zyrr']);
    for (const id of ['m4', 'm5', 'm6']) expect(foes(id), id).toEqual(['vesper']);
    for (const id of ['m7', 'm8']) expect(foes(id), id).toEqual(['nexus']);
    for (const id of ['m12', 'm13', 'm14', 'm9']) expect(new Set(foes(id)), id).toEqual(new Set(['zyrr', 'nexus', 'vesper']));
    // Themen: Alienwelt m10 und m11, Wueste m12 bis m14, Hoehle m9 / themes: alien m10 and m11, desert m12 to m14, cavern m9
    expect(MISSIONS.filter((m) => m.theme === 'alien').map((m) => m.id)).toEqual(['m10', 'm11']);
    expect(MISSIONS.filter((m) => m.theme === 'desert').map((m) => m.id)).toEqual(['m12', 'm13', 'm14']);
    expect(MISSIONS.filter((m) => m.theme === 'cavern').map((m) => m.id)).toEqual(['m9']);
    expect(missionConfig('m10').theme).toBe('alien');
    expect(missionConfig('m13').theme).toBe('desert');
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
    expect(count('alvenia')).toBe(7);
    expect(count('meridon')).toBe(6);
    // jede Mission mit Verbuendetem hat ihre Funkzeile; Verbuendete nur in bekannten Missionen / every mission with an ally has its radio line; allies only in known missions
    for (const list of Object.values(CAMPAIGN_ALLIES)) for (const id of Object.keys(list!)) expect(MISSION_IDS, id).toContain(id);
    // die Landetrupps sind allein / the landing parties are alone
    for (const f of CAMPAIGN_FACTIONS) { expect(allyFor('m10', f)).toBeNull(); expect(allyFor('m12', f)).toBeNull(); }
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

  it('besondere Einrichtung: Mutterschiff, Bohrer, Depots, Bunker, Artefakt / special setup: mothership, drill, depots, bunker, artifact', () => {
    // Einzelheiten zum Mutterschiff in campaign-mothership.test.ts / mothership details in campaign-mothership.test.ts
    const m2 = game('m2');
    const site = m2.campaign!.ship!;
    expect(m2.tiles[site.y * m2.size + site.x].feature).toBe('mothership');
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
  it('m1: alle Sendetuerme 5 Runden halten = Sieg mit 3 Sternen, Verlust setzt zurueck, Zeitlimit = Niederlage / m1: holding all towers for 5 rounds wins with 3 stars, a loss resets, time limit = defeat', () => {
    const m = missionById('m1')!;
    expect(m.objectives).toEqual([{ k: 'towers', rounds: TOWER_HOLD.m1Rounds }]);
    for (const f of CAMPAIGN_FACTIONS) {
      const g = game('m1', f);
      const tw = g.cities.filter((c) => c.tower);
      expect(tw.length, f).toBe(TOWER_HOLD.m1Towers);
      // markiert und bekannt / marked and known
      for (const t of tw) {
        expect(g.campaign!.targets, f).toContainEqual({ x: t.x, y: t.y });
        expect(g.factions[0].explored[t.y * g.size + t.x], f).toBe(1);
      }
      expect(towersHeld(g)).toEqual({ held: 0, total: TOWER_HOLD.m1Towers });
    }
    const s = game('m1', 'dravon');
    allHuman(s);
    const tw = s.cities.filter((c) => c.tower);
    for (const t of tw) t.owner = 0;
    expect(towersHeld(s)).toEqual({ held: tw.length, total: tw.length });
    passRound(s);
    expect(s.campaign!.towerHold).toBe(1);
    expect(objectiveProgress(s, m.objectives[0], m.rounds)).toEqual({ have: 1, need: TOWER_HOLD.m1Rounds });
    // ein Turm geht verloren: die Zaehlung beginnt von vorn / one tower is lost: the count starts over
    tw[0].owner = 1;
    passRound(s);
    expect(s.campaign!.towerHold).toBe(0);
    tw[0].owner = 0;
    for (let i = 1; i < TOWER_HOLD.m1Rounds; i++) { passRound(s); expect(s.campaign!.result).toBeNull(); }
    const ev = passRound(s);
    expect(s.campaign!.towerHold).toBe(TOWER_HOLD.m1Rounds);
    expect(ev.some((e) => e.t === 'objective' && !e.bonus && e.status === 'done')).toBe(true);
    expect(s.campaign!.result).toBe('won');
    expect(s.winner).toBe(0);
    expect(s.round).toBeLessThanOrEqual(TOWER_HOLD.m1FastRound);
    expect(s.campaign!.stars).toBe(3);
    expect(ev.filter((e) => e.t === 'gameOver').length).toBe(1);
    expect(applyCommand(s, { type: 'endTurn' }).ok).toBe(false);

    // Tuerme des Verbuendeten zaehlen mit / the ally's towers count too
    const al = game('m1', 'korvat');
    const at = al.cities.filter((c) => c.tower);
    at[0].owner = 0; at[1].owner = 1;
    expect(towersHeld(al).held).toBe(1);
    al.campaign!.allies = [1];
    expect(towersHeld(al).held).toBe(2);

    const late = game('m1');
    late.round = m.rounds;
    allHuman(late);
    passRound(late);
    expect(late.campaign!.result).toBe('lost');
    expect(late.campaign!.stars).toBe(0);
    expect(late.winner).toBe(1);
  });

  it('m1: Ueberfall der Zyrr landet neben dem abgelegensten Turm / m1: the Zyrr raid lands next to the most remote tower', () => {
    const m = missionById('m1')!;
    const raid = m.waves!.find((w) => w.round === TOWER_HOLD.m1RaidRound)!;
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game('m1', f);
      const far = s.cities.find((c) => c.tower)!;
      const p = s.campaign!.spawns![raid.at];
      expect(dist(p, far), f).toBeGreaterThanOrEqual(TOWER_HOLD.m1RaidDistance);
      expect(dist(p, far), f).toBeLessThanOrEqual(TOWER_HOLD.m1RaidDistance + 1);
    }
  });

  it('m3: Portal zwei Runden halten = Sieg, Abzug setzt zurueck, Nachschub kommt durchs Portal / holding the portal two rounds wins, leaving resets, reinforcements come through the portal', () => {
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game('m3', f);
      const p = s.campaign!.portal!;
      expect(s.campaign!.targets[0]).toEqual(p);
      // Nachschub tritt neben dem Portal aus, nie darauf / reinforcements step out next to the portal, never onto it
      expect(dist(s.campaign!.spawns![0], p), f).toBeGreaterThanOrEqual(2);
      expect(dist(s.campaign!.spawns![0], p), f).toBeLessThanOrEqual(3);
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
    // Runde 4: die erste Welle tritt neben dem Portal aus, nicht auf dem Halter / round 4: the first wave steps out next to the portal, not onto the holder
    const ev = passRound(s);
    expect(s.round).toBe(4);
    expect(s.campaign!.portalHold).toBe(1);
    expect(s.campaign!.result).toBeNull();
    const wave = ev.find((e) => e.t === 'wave' && e.faction === 1);
    expect(wave && wave.t === 'wave' ? dist(wave, p) : 0).toBeGreaterThanOrEqual(2);
    expect(unitAt(s, p.x, p.y)?.id).toBe(u.id);
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

    // nie eine Runde zu spaet: gehalten erst zu Beginn der Runde nach dem Limit zaehlt nicht mehr
    // never one round late: held only at the start of the round after the limit no longer counts
    const edge = game('m3');
    allHuman(edge);
    const ep = edge.campaign!.portal!;
    edge.units = edge.units.filter((x) => !(x.owner === 1 && dist(x, ep) <= 1));
    const eu = edge.units.find((x) => x.owner === 0 && x.type === 'mg')!;
    placeAt(edge, eu, ep);
    const m3 = missionById('m3')!;
    edge.round = m3.rounds;
    edge.campaign!.waves = m3.waves!.length;
    edge.campaign!.portalHold = 1;
    passRound(edge);
    expect(edge.round).toBe(m3.rounds + 1);
    expect(edge.campaign!.portalHold).toBe(1);
    expect(edge.campaign!.result).toBe('lost');
    // im letzten Zug gehalten zaehlt / held at the last turn counts
    const ok = game('m3');
    allHuman(ok);
    ok.units = ok.units.filter((x) => !(x.owner === 1 && dist(x, ep) <= 1));
    const ou = ok.units.find((x) => x.owner === 0 && x.type === 'mg')!;
    placeAt(ok, ou, ok.campaign!.portal!);
    ok.round = m3.rounds - 1;
    ok.campaign!.waves = m3.waves!.length;
    ok.campaign!.portalHold = 1;
    passRound(ok);
    expect(ok.round).toBe(m3.rounds);
    expect(ok.campaign!.result).toBe('won');
  });

  it('m4: Abschuesse; alle Gegner ausgeschieden = Sieg (der Kult mit seiner letzten Einheit) / kills; all enemies eliminated = win (the cult with its last unit)', () => {
    const s = game('m4');
    s.factions[0].kills = 7;
    poke(s);
    expect(s.campaign!.result).toBeNull();
    s.factions[0].kills = 8;
    poke(s);
    expect(s.campaign!.result).toBe('won');

    const e = game('m4');
    expect(ownCities(e, 1).length).toBe(1);
    const hq = ownCities(e, 1)[0];
    const u = e.units.find((x) => x.owner === 0 && x.type === 'infantry')!;
    placeAt(e, u, hq);
    // die Hauptstadt faellt, der Kult lebt in seiner Horde weiter / the capital falls, the cult lives on in its horde
    expect(applyCommand(e, { type: 'capture', unit: u.id }).ok).toBe(true);
    expect(e.factions[1].alive).toBe(true);
    expect(e.campaign!.result).toBeNull();
    // die letzte Einheit faellt: ausgeschieden / the last unit falls: eliminated
    e.units = e.units.filter((x) => x.owner !== 1);
    const r = applyCommand(e, { type: 'endTurn' });
    expect(r.ok).toBe(true);
    expect(e.factions[1].alive).toBe(false);
    expect(e.campaign!.result).toBe('won');
    expect(r.events.filter((x) => x.t === 'gameOver').length).toBe(1);
    // Sieg ohne Gegner: offene Hauptziele gelten als erfuellt, nie als verfehlt / win without enemies: open primary objectives count as met, never failed
    expect(e.campaign!.status).toEqual(['done']);
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

  it('m8: HQ verloren = Niederlage, Abschuesse bei gehaltenem HQ = Sieg, Verstaerkung trifft ein / HQ lost = defeat, kills with the HQ held = win, reinforcements arrive', () => {
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

    const m8 = missionById('m8')!;
    const need = m8.objectives.find((o) => o.k === 'kills')!;
    const won = game('m8');
    won.factions[0].kills = need.k === 'kills' ? need.n : 0;
    poke(won);
    expect(won.campaign!.result).toBe('won');
    // nur ueberleben reicht nicht mehr / merely surviving is no longer enough
    const idle = game('m8');
    allHuman(idle);
    idle.round = m8.rounds;
    idle.campaign!.waves = m8.waves!.length;
    passRound(idle);
    expect(idle.campaign!.result).toBe('lost');
    // die beiden Angriffsrichtungen liegen fuer jede Fraktion auf verschiedenen Feldern / the two attack directions lie on different tiles for every faction
    for (const f of CAMPAIGN_FACTIONS) {
      const g = game('m8', f);
      const [p0, p1] = g.campaign!.spawns!;
      expect(dist(p0, p1), f).toBeGreaterThanOrEqual(3);
    }
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
    // Kult ohne Einheit: ausgeschieden / cult without a unit: eliminated
    a.units = a.units.filter((x) => x.owner !== 1);
    expect(applyCommand(a, { type: 'endTurn' }).ok).toBe(true);
    expect(a.factions[1].alive).toBe(false);
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
      for (const u of own) { expect(dist(u, c.portal!), f).toBeLessThanOrEqual(3); expect(dist(u, c.portal!), f).toBeGreaterThanOrEqual(1); }
      // Vorposten: Zyrr-Stadt mit Besatzung, das alte Hauptquartier des Spielers / outpost: Zyrr city with a garrison, the player's old HQ
      const out = cityAt(s, c.targets[0].x, c.targets[0].y)!;
      expect(out.owner).toBe(1);
      expect(out.hqOf).toBe(0);
      // die Hoehle ist verlassen, die Zyrr kommen mit der ersten Welle / the burrow is deserted, the Zyrr come with the first wave
      expect(unitAt(s, out.x, out.y)).toBeUndefined();
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
    placeAt(s, jeep, landAt(s, c.targets[1], 3));
    poke(s);
    expect(c.status[1]).toBe('pending');
    placeAt(s, jeep, landAt(s, c.targets[1], 2));
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
    expect(objectiveProgress(s, missionById('m11')!.objectives[0], 16)).toEqual({ have: 0, need: boss.maxHp - SWARM_MOTHER.riftHp });
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
    // Brut nur auf freien Nachbarfeldern / brood only on free adjacent tiles
    const room = Math.min(SWARM_MOTHER.broodCount, free(8).length);
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
    expect(room).toBeGreaterThanOrEqual(1);
    expect(brood && brood.t === 'boss' ? brood.count : 0).toBe(room);
    const greys = s.units.filter((u) => u.owner === 1 && u.type === 'grey' && dist(u, boss) === 1 && u.fresh);
    expect(greys.length).toBe(room);
    expect(s.units.filter((u) => u.owner === 1).length).toBe(zyrr + room);
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

  it('m11: der Riss: am Rand des Todes stirbt sie nicht, der Einsatz ist gewonnen; HQ verloren = Niederlage / the rift: at the brink of death she does not die, the mission is won; HQ lost = defeat', () => {
    const { s, boss } = withBoss('alvenia');
    s.config.hitChance = false;
    expect(missionById('m11')!.objectives[0]).toEqual({ k: 'rift', unit: 0 });
    const tank = s.units.find((u) => u.owner === 0 && u.type === 'tank')!;
    const p = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: boss.x + dx, y: boss.y + dy }))
      .find((q) => { const t = s.tiles[q.y * s.size + q.x]; return t && isLand(t) && t.cityId === null && !unitAt(s, q.x, q.y); })!;
    placeAt(s, tank, p);
    // knapp ueber der Schwelle: kein Riss / just above the threshold: no rift
    boss.hp = SWARM_MOTHER.riftHp + 1;
    poke(s);
    expect(s.campaign!.rift).toBeUndefined();
    expect(s.campaign!.result).toBeNull();
    // ein Treffer, der sie toeten wuerde: sie bleibt stehen, der Riss reisst auf, gewonnen / a hit that would kill her: she stays, the rift tears open, won
    boss.hp = 1;
    const r = applyCommand(s, { type: 'attack', unit: tank.id, target: boss.id });
    expect(r.ok).toBe(true);
    const alive = s.units.find((u) => u.id === boss.id);
    expect(alive).toBeDefined();
    expect(alive!.hp).toBeGreaterThanOrEqual(1);
    expect(alive!.hp).toBeLessThanOrEqual(SWARM_MOTHER.riftHp);
    expect(r.events.some((e) => e.t === 'killed' && e.unit === boss.id)).toBe(false);
    const rift = r.events.find((e) => e.t === 'rift');
    expect(rift && rift.t === 'rift' ? rift.unit : -1).toBe(boss.id);
    expect(s.campaign!.rift).toEqual({ x: boss.x, y: boss.y, round: s.round });
    // der Riss kommt vor dem Spielende (die Darstellung zeigt ihn vor dem Ergebnis) / the rift comes before game over (the view shows it before the result)
    expect(r.events.findIndex((e) => e.t === 'rift')).toBeLessThan(r.events.findIndex((e) => e.t === 'gameOver'));
    expect(s.campaign!.status).toEqual(['done', 'done']);
    expect(s.campaign!.result).toBe('won');
    expect(s.winner).toBe(0);
    expect(r.events.filter((e) => e.t === 'gameOver')).toHaveLength(1);

    // Schwelle direkt erreicht (ohne toedlichen Treffer) / threshold reached directly (without a lethal hit)
    const t2 = withBoss('velkar');
    t2.boss.hp = SWARM_MOTHER.riftHp;
    poke(t2.s);
    expect(t2.s.campaign!.result).toBe('won');
    // gedaempfter Gegenschlag und Heilung nur ohne frischen Schaden / dampened return fire and healing only without fresh damage
    expect(SWARM_MOTHER.returnFactor).toBeLessThan(1);
    const t3 = withBoss('korvat');
    allHuman(t3.s);
    t3.boss.hp = 40;
    endTurn(t3.s); // Zyrr: heilt (unverletzt seit dem letzten Zug) / Zyrr: heals (unhurt since the last turn)
    expect(t3.boss.hp).toBe(40 + SWARM_MOTHER.xenoHeal);
    endTurn(t3.s);
    t3.boss.hp -= 5; // Spieler trifft sie / the player hits her
    const before = t3.boss.hp;
    endTurn(t3.s);
    expect(t3.boss.hp).toBe(before);

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
