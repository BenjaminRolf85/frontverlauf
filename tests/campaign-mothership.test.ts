/**
 * Kampagne m2 (Das Mutterschiff): Wrack auf 2x2 unpassierbaren Feldern, Einrichtung fuer alle Menschen-Fraktionen,
 * Arbeit nur direkt daneben und zusammengezaehlt bis M2.workRounds, Tod des Wissenschaftlers, Wellen, Speichern,
 * Geschuetzstellungen und Orbitallaser am Wrack sowie ein KI-Lauf ohne Fehlbefehle.
 * Campaign m2 (The Mothership): wreck on 2x2 impassable tiles, setup for every human faction, work only right next to it
 * and cumulative up to M2.workRounds, the scientist's death, waves, saving, gun emplacements and the orbital laser at
 * the wreck, and an AI run without failed commands.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, createGame, dist, emplacementCheck, hqOf, isLand, missionById, missionConfig, nextToShip, objectiveProgress, outdatedCampaign,
  reachable, shipDist, shipTiles, tileAt, unitAt, workCheck, workSpots, CAMPAIGN_FACTIONS, type GameState, type Pos, type Unit,
} from '../src/core';
import { aiDebug, planNextCommand } from '../src/ai/ai';
import { AI, CITY_UPGRADES, M2, UNITS, type FactionId } from '../src/data/balance';
import { isValidState, migrateState } from '../src/save/save';
import { freeFor } from '../src/core/spawn';

const game = (f: FactionId = 'korvat') => createGame(missionConfig('m2', f));
const sci = (s: GameState) => s.units.find((u) => u.id === s.campaign!.scientist)!;

/** Einheit bereit auf ein Feld setzen / put a unit, ready, onto a tile */
function placeAt(s: GameState, u: Unit, p: Pos) {
  s.units = s.units.filter((o) => o === u || !(o.x === p.x && o.y === p.y));
  Object.assign(u, { x: p.x, y: p.y, startX: p.x, startY: p.y, fresh: false, exhausted: false, moved: false, attacked: false, moveDone: false });
}
/** Zug beenden, bis der Spieler wieder dran ist (alle passen) / end turns until the player moves again (everyone passes) */
function passRound(s: GameState) {
  for (const f of s.factions) f.human = true;
  do {
    for (const p of [...s.pendingRewards]) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
    expect(applyCommand(s, { type: 'endTurn' }).ok).toBe(true);
  } while (s.current !== 0 && !s.over);
}
/** freier Arbeitsplatz / free work spot */
const spot = (s: GameState) => workSpots(s).find((p) => !unitAt(s, p.x, p.y) && isLand(tileAt(s, p.x, p.y)!) && tileAt(s, p.x, p.y)!.terrain !== 'mountain')!;

describe('m2: das Mutterschiff / the mothership', () => {
  it('Einrichtung fuer alle fuenf Menschen-Fraktionen / setup for all five human factions', () => {
    const m = missionById('m2')!;
    expect(m.objectives).toEqual([{ k: 'work', rounds: M2.workRounds }, { k: 'scientist' }]);
    expect(m.rounds).toBe(M2.missionRounds);
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game(f);
      const c = s.campaign!;
      const ship = c.ship!;
      expect(ship, f).toBeDefined();
      // 6 bis 8 Felder vom Hauptquartier (eins Spielraum auf engen Karten) / 6 to 8 tiles from the HQ (one slack on tight maps)
      const hq = hqOf(s, 0)!;
      expect(shipDist(ship, hq), f).toBeGreaterThanOrEqual(M2.shipMin - 1);
      expect(shipDist(ship, hq), f).toBeLessThanOrEqual(M2.shipMax);
      expect(shipDist(ship, hqOf(s, 1)!), f).toBeGreaterThanOrEqual(M2.zyrrDistance - 1);
      // Wissenschaftler des Spielers, Ziele offen, Arbeit 0 / the player's scientist, objectives open, work 0
      const u = sci(s);
      expect(u.owner).toBe(0);
      expect(u.type).toBe('scientist');
      expect(UNITS.scientist.attack).toBe(0);
      expect(c.work).toBe(0);
      expect(c.status).toEqual(['pending', 'pending']);
      // Wachen der Zyrr am Wrack / Zyrr guards at the wreck
      const guards = s.units.filter((x) => x.owner === 1 && shipDist(ship, x) <= 2);
      expect(guards.length, f).toBeGreaterThanOrEqual(M2.guards.length);
      expect(guards.some((x) => x.type === 'mech'), f).toBe(true);
      // Arbeitsplaetze: begehbares Land, keine Stadt, kein Sendeturm direkt daneben / work spots: walkable land, no city, no transmitter tower next to it
      const spots = workSpots(s);
      expect(spots.length, f).toBe(12);
      expect(spots.filter((p) => { const t = tileAt(s, p.x, p.y)!; return isLand(t) && t.terrain !== 'mountain' && t.cityId === null; }).length, f).toBeGreaterThanOrEqual(M2.ringLand - 2);
      for (const tw of s.cities.filter((x) => x.tower)) expect(shipDist(ship, tw), f).toBeGreaterThanOrEqual(3);
      // Landepunkte der Wellen weg vom Schiff, nie naeher an uns als das Schiff / wave landing points away from the ship, never closer to us than the ship
      for (const p of c.spawns!) {
        expect(shipDist(ship, p), f).toBeGreaterThanOrEqual(M2.waveDistance);
        expect(dist(p, hq), f).toBeGreaterThanOrEqual(shipDist(ship, hq));
      }
      // alle kennen das Wrack / everyone knows the wreck
      for (const fa of s.factions) for (const q of shipTiles(ship)) expect(fa.explored[q.y * s.size + q.x]).toBe(1);
    }
  });

  it('das Schiff belegt vier unpassierbare, nicht einnehmbare, nicht angreifbare Felder / the ship occupies four impassable, uncapturable, unattackable tiles', () => {
    const s = game();
    const ship = s.campaign!.ship!;
    const tiles = shipTiles(ship);
    expect(tiles).toHaveLength(4);
    for (const q of tiles) {
      const t = tileAt(s, q.x, q.y)!;
      expect(t.feature).toBe('mothership');
      expect(t.cityId).toBeNull();
      expect(unitAt(s, q.x, q.y)).toBeUndefined();
      expect(freeFor(s, 'infantry', q)).toBe(false);
      expect(freeFor(s, 'skimmer', q)).toBe(false);
    }
    // weder zu Fuss noch fliegend betretbar / not enterable on foot or flying
    const u = s.units.find((x) => x.owner === 0 && x.type === 'jeep')!;
    const p = spot(s);
    placeAt(s, u, p);
    for (const r of reachable(s, u)) expect(shipDist(ship, r), `${r.x},${r.y}`).toBeGreaterThan(0);
    const flyer = s.units.find((x) => x.owner === 0 && x.type === 'tank')!;
    Object.assign(flyer, { type: 'heli', fuel: 5 });
    placeAt(s, flyer, workSpots(s).find((q) => !unitAt(s, q.x, q.y))!);
    for (const r of reachable(s, flyer)) expect(shipDist(ship, r)).toBeGreaterThan(0);
    expect(applyCommand(s, { type: 'move', unit: u.id, to: tiles[0] }).ok).toBe(false);
  });

  it('Arbeit zaehlt nur direkt daneben, einmal je Runde, zusammengezaehlt bis zum Sieg / work counts only right next to it, once per round, cumulative up to the win', () => {
    const s = game('meridon');
    const u = sci(s);
    // weit weg: nicht erlaubt / far away: not allowed
    expect(workCheck(s, u)).toBe('outOfRange');
    expect(applyCommand(s, { type: 'workShip', unit: u.id }).ok).toBe(false);
    // andere Einheiten koennen nicht arbeiten / other units cannot work
    const jeep = s.units.find((x) => x.owner === 0 && x.type === 'jeep')!;
    placeAt(s, jeep, spot(s));
    expect(applyCommand(s, { type: 'workShip', unit: jeep.id }).ok).toBe(false);
    placeAt(s, u, spot(s));
    expect(nextToShip(s, u)).toBe(true);
    const r = applyCommand(s, { type: 'workShip', unit: u.id });
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.t === 'shipWork' && e.have === 1 && e.need === M2.workRounds)).toBe(true);
    expect(s.campaign!.work).toBe(1);
    expect(u.exhausted).toBe(true);
    // einmal je Runde / once per round
    u.exhausted = false;
    expect(workCheck(s, u)).toBe('unitExhausted');
    // Unterbrechung: zwei Runden weg vom Schiff, nichts geht verloren / interruption: two rounds away from the ship, nothing is lost
    passRound(s);
    placeAt(s, u, hqOf(s, 0)!);
    passRound(s);
    expect(s.campaign!.work).toBe(1);
    expect(objectiveProgress(s, { k: 'work', rounds: M2.workRounds }, M2.missionRounds)).toEqual({ have: 1, need: M2.workRounds });
    for (let i = 2; i <= M2.workRounds; i++) {
      passRound(s);
      placeAt(s, u, workSpots(s).find((p) => !unitAt(s, p.x, p.y) || (p.x === u.x && p.y === u.y))!);
      // unversehrt halten (die Wellen kommen trotzdem) / keep it unhurt (the waves come anyway)
      u.hp = u.maxHp;
      expect(applyCommand(s, { type: 'workShip', unit: u.id }).ok, `round ${s.round}`).toBe(true);
      expect(s.campaign!.work).toBe(i);
      if (i < M2.workRounds) expect(s.campaign!.result).toBeNull();
    }
    expect(s.campaign!.status).toEqual(['done', 'done']);
    expect(s.campaign!.result).toBe('won');
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    // unversehrt: Bonus fuer die LP / unhurt: HP bonus
    expect(s.campaign!.bonus[1]).toBe('done');
    expect(s.campaign!.stars).toBeGreaterThanOrEqual(2);
  });

  it('faellt der Wissenschaftler, ist der Einsatz verloren; unter halben LP ist der Bonus weg / if the scientist falls the mission is lost; below half HP the bonus is gone', () => {
    const s = game('dravon');
    const u = sci(s);
    placeAt(s, u, spot(s));
    // ein Grauer verwundet ihn: Bonus verfehlt / a grey wounds it: bonus missed
    for (const f of s.factions) f.human = true;
    applyCommand(s, { type: 'endTurn' });
    expect(s.current).toBe(1);
    const g = s.units.find((x) => x.owner === 1 && x.type === 'grey')!;
    // Nachbarfeld, das die Zyrr kennen (rund ums Wrack) / adjacent tile the Zyrr know (around the wreck)
    const free = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy }))
      .find((p) => { const t = tileAt(s, p.x, p.y); return !!t && (freeFor(s, 'grey', p) || unitAt(s, p.x, p.y)?.owner === 1) && t.cityId === null && s.factions[1].explored[p.y * s.size + p.x] === 1; })!;
    placeAt(s, g, free);
    u.hp = Math.ceil(u.maxHp * M2.hpShare);
    const res = applyCommand(s, { type: 'attack', unit: g.id, target: u.id });
    expect(res.error ?? 'ok').toBe('ok');
    if (s.units.some((x) => x.id === u.id)) {
      expect(s.campaign!.bonus[1]).toBe('failed');
      expect(s.campaign!.result).toBeNull();
      s.units = s.units.filter((x) => x.id !== u.id);
      g.attacked = false; g.exhausted = false;
      applyCommand(s, { type: 'move', unit: g.id, to: g });
      expect(applyCommand(s, { type: 'endTurn' }).ok).toBe(true);
    }
    expect(s.campaign!.status[1]).toBe('failed');
    expect(s.campaign!.result).toBe('lost');
    expect(s.over).toBe(true);
    // unter halben LP: Bonus verfehlt, der Einsatz laeuft weiter / below half HP: bonus missed, the mission goes on
    const h = game('korvat');
    sci(h).hp = Math.ceil(sci(h).maxHp * M2.hpShare) - 1;
    const jeep = h.units.find((x) => x.owner === 0 && x.type === 'jeep')!;
    expect(applyCommand(h, { type: 'move', unit: jeep.id, to: reachable(h, jeep)[0] }).ok).toBe(true);
    expect(h.campaign!.bonus[1]).toBe('failed');
    expect(h.campaign!.result).toBeNull();
  });

  it('Wellen landen deterministisch nahe dem Schiff und wachsen / waves land deterministically near the ship and grow', () => {
    const m = missionById('m2')!;
    const waves = m.waves!;
    expect(waves.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < waves.length; i++) {
      expect(waves[i].round - waves[i - 1].round).toBe(3);
      expect(waves[i].units.length).toBeGreaterThanOrEqual(waves[i - 1].units.length);
    }
    expect(waves.at(-1)!.round).toBeLessThanOrEqual(m.rounds);
    const run = () => {
      const s = game('velkar');
      const seen: string[] = [];
      while (s.round < waves[1].round + 1) {
        passRound(s);
        for (const u of s.units) if (u.owner === 1) seen.push(`${s.round}:${u.id}:${u.type}:${u.x},${u.y}`);
      }
      return { s, seen };
    };
    const a = run(), b = run();
    expect(a.seen).toEqual(b.seen);
    expect(a.s.campaign!.waves).toBe(2);
    // die Wellen stehen am Landepunkt, nicht auf dem Schiff / the waves stand at the landing point, not on the ship
    const ship = a.s.campaign!.ship!;
    for (const u of a.s.units) expect(shipDist(ship, u)).toBeGreaterThan(0);
  });

  it('Speichern und Laden; alte m2-Staende (Bergung) werden freie Partien / save and load; old m2 saves (salvage) become free games', () => {
    const s = game('alvenia');
    const u = sci(s);
    placeAt(s, u, spot(s));
    expect(applyCommand(s, { type: 'workShip', unit: u.id }).ok).toBe(true);
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(isValidState(copy)).toBe(true);
    const back = migrateState(copy);
    expect(back.campaign?.ship).toEqual(s.campaign!.ship);
    expect(back.campaign?.work).toBe(1);
    expect(outdatedCampaign(back.campaign!)).toBe(false);
    passRound(back);
    expect(back.campaign!.result).toBeNull();
    const sc = sci(back);
    placeAt(back, sc, workSpots(back).find((p) => !unitAt(back, p.x, p.y) || (p.x === sc.x && p.y === sc.y))!);
    expect(applyCommand(back, { type: 'workShip', unit: sc.id }).ok).toBe(true);
    expect(back.campaign!.work).toBe(2);
    // alter Stand der Bergung ohne Mutterschiff / old salvage save without the mothership
    const old = JSON.parse(JSON.stringify(s));
    delete old.campaign.ship;
    const m = migrateState(old);
    expect(m.campaign).toBeUndefined();
    expect(m.config.campaign).toBeUndefined();
  });

  it('Geschuetzstellungen nie auf dem Wrack, der Orbitallaser trifft dort nur Einheiten / gun emplacements never on the wreck, the orbital laser only hits units there', () => {
    const s = game('dravon');
    const ship = s.campaign!.ship!;
    const pio = s.units.find((x) => x.owner === 0 && (x.type === 'infantry' || x.type === 'lightWarden'))!;
    pio.type = 'pioneer';
    placeAt(s, pio, workSpots(s).find((p) => p.x === ship.x - 1 && p.y === ship.y) ?? spot(s));
    for (const q of shipTiles(ship)) if (dist(pio, q) === 1) expect(emplacementCheck(s, pio, q.x, q.y)).not.toBe('ok');
    // Orbitallaser (Velkar) auf das Wrack: nur die Einheit daneben verliert LP / orbital laser (Velkar) on the wreck: only the unit next to it loses HP
    const v = game('velkar');
    const vs = v.campaign!.ship!;
    const hq = hqOf(v, 0)!;
    v.factions[0].techs.push(CITY_UPGRADES.tech.satRelay);
    v.factions[0].stars = 500;
    expect(applyCommand(v, { type: 'cityUpgrade', city: hq.id, upgrade: 'satRelay' }).ok).toBe(true);
    v.factions[0].orbitalReady = v.round;
    const target = { x: vs.x + 1, y: vs.y + 1 };
    const grey = v.units.find((x) => x.owner === 1 && x.type === 'grey')!;
    placeAt(v, grey, { x: vs.x + 2, y: vs.y + 2 });
    const before = JSON.stringify(shipTiles(vs).map((q) => tileAt(v, q.x, q.y)!.feature));
    const hp = grey.hp;
    const r = applyCommand(v, { type: 'orbitalStrike', x: target.x, y: target.y });
    expect(r.ok).toBe(true);
    expect(grey.hp).toBeLessThan(hp);
    expect(JSON.stringify(shipTiles(vs).map((q) => tileAt(v, q.x, q.y)!.feature))).toBe(before);
    for (const u of v.units) expect(shipDist(vs, u)).toBeGreaterThan(0);
  });
});

describe('m2: KI / AI', () => {
  it('alle fuenf Fraktionen als KI: ohne Fehlbefehle, der Wissenschaftler arbeitet / all five factions as AI: no failed commands, the scientist works', () => {
    const errors = aiDebug.errors;
    let worked = 0;
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game(f);
      s.factions[0].human = false;
      let fails = 0, guard = 0;
      while (!s.over && guard++ < 30000) {
        const fi = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
      }
      expect(fails, f).toBe(0);
      expect(s.campaign!.result, f).not.toBeNull();
      expect(s.round, f).toBeLessThanOrEqual(M2.missionRounds + 1);
      worked += s.campaign!.work ?? 0;
    }
    expect(worked).toBeGreaterThan(M2.workRounds);
    expect(aiDebug.errors).toBe(errors);
  }, 300_000);
});
