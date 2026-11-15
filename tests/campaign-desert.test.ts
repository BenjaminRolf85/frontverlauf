/**
 * Welt der Vergessenen (m12 bis m14): Einrichtung fuer alle Menschen-Fraktionen, Landetrupp in m12, Ruinenstaetten
 * mit Verdan-Wachen in m13, Hoehleneingang in m14, Verbuendete zaehlen, KI-Laeufe mit Zugzeiten.
 * World of the Forgotten (m12 to m14): setup for every human faction, landing party in m12, ruin sites with Verdan
 * sentinels in m13, cave entrance in m14, allies count, AI runs with turn times.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, cityAt, createGame, dist, hqOf, isLand, missionById, missionConfig, objectiveProgress, ownCities, turretGuard,
  CAMPAIGN_FACTIONS, type GameState, type Unit,
} from '../src/core';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI, RUINS, VERDAN } from '../src/data/balance';

const game = (id: string, f: (typeof CAMPAIGN_FACTIONS)[number] = 'korvat') => createGame(missionConfig(id, f));
const allHuman = (s: GameState) => { for (const f of s.factions) f.human = true; };
function endTurn(s: GameState) {
  for (const p of [...s.pendingRewards]) if (s.cities.find((c) => c.id === p.cityId)?.owner === s.current) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
  const r = applyCommand(s, { type: 'endTurn' });
  expect(r.ok).toBe(true);
  return r;
}
function passRound(s: GameState) {
  const ev = [...endTurn(s).events];
  while (s.current !== 0 && !s.over) ev.push(...endTurn(s).events);
  return ev;
}
function placeAt(s: GameState, u: Unit, p: { x: number; y: number }) {
  s.units = s.units.filter((o) => o === u || !(o.x === p.x && o.y === p.y));
  Object.assign(u, { x: p.x, y: p.y, startX: p.x, startY: p.y, fresh: false, exhausted: false, moved: false, attacked: false, moveDone: false });
}

describe('Welt der Vergessenen: Einrichtung / world of the Forgotten: setup', () => {
  it('m12 bis m14 fuer alle Menschen-Fraktionen: Wueste, drei Gegner untereinander im Krieg / m12 to m14 for every human faction: desert, three enemies at war with each other', () => {
    for (const id of ['m12', 'm13', 'm14']) for (const f of CAMPAIGN_FACTIONS) {
      const s = game(id, f);
      const tag = `${id}/${f}`;
      expect(s.config.theme, tag).toBe('desert');
      expect(s.factions.slice(1, 4).map((x) => x.id).sort(), tag).toEqual(['nexus', 'vesper', 'zyrr']);
      for (const a of [1, 2, 3]) for (const b of [0, 1, 2, 3]) if (a !== b) expect(s.factions[a].relations[b], tag).toBe('war');
      // kein Meer, hoechstens ein paar Tuempel / no sea, at most a few pools
      expect(s.tiles.filter((t) => t.terrain === 'ocean').length, tag).toBe(0);
      expect(s.tiles.filter((t) => t.terrain === 'shallow').length, tag).toBeLessThan(s.tiles.length * 0.06);
      expect(s.tiles.some((t) => t.biome === 'jungle'), tag).toBe(false);
      expect(JSON.stringify(s)).toBe(JSON.stringify(game(id, f)));
    }
  });

  it('m12: verstreute Landetrupps ohne Stadt, verlassener Aussenposten als Ziel / scattered landing parties without a city, abandoned outpost as the target', () => {
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game('m12', f);
      const c = s.campaign!;
      expect(c.landing, f).toBe(true);
      expect(ownCities(s, 0)).toHaveLength(0);
      const out = cityAt(s, c.targets[0].x, c.targets[0].y)!;
      expect(out.owner, f).toBeNull();
      const own = s.units.filter((u) => u.owner === 0);
      expect(own.length, f).toBe(4);
      // mindestens zwei getrennte Landeplaetze / at least two separate landing spots
      const far = own.some((a) => own.some((b) => dist(a, b) >= 3));
      expect(far, f).toBe(true);
      for (const u of own) expect(dist(u, out), f).toBeGreaterThanOrEqual(2);
      // die anderen sind auch da, mit je einer Zuflucht / the others are here too, with one refuge each
      for (const e of [1, 2, 3]) expect(hqOf(s, e), f).toBeDefined();
    }
  });

  it('m12: kein Ausscheiden vor der Landung, Aussenposten wird Hauptquartier / no elimination before landing, the outpost becomes the HQ', () => {
    const s = game('m12', 'alvenia');
    allHuman(s);
    for (let i = 0; i < 3; i++) passRound(s);
    expect(s.factions[0].alive).toBe(true);
    expect(s.campaign!.result).toBeNull();
    const out = cityAt(s, s.campaign!.targets[0].x, s.campaign!.targets[0].y)!;
    s.units = s.units.filter((u) => !(u.x === out.x && u.y === out.y));
    out.owner = null;
    const inf = s.units.find((u) => u.owner === 0 && u.type === 'infantry')!;
    placeAt(s, inf, out);
    expect(applyCommand(s, { type: 'capture', unit: inf.id }).ok).toBe(true);
    expect(hqOf(s, 0)?.id).toBe(out.id);
    expect(s.campaign!.landing).toBe(false);
    expect(s.campaign!.status[0]).toBe('done');
    // dann die weiteren Aussenposten / then the further outposts
    const need = missionById('m12')!.objectives[1];
    expect(need.k).toBe('cities');
    for (const v of s.cities.filter((x) => x.owner === null).slice(0, need.k === 'cities' ? need.n - 1 : 0)) v.owner = 0;
    const hu = s.units.find((u) => u.owner === 0 && u.id !== inf.id)!;
    hu.hp -= 1;
    applyCommand(s, { type: 'heal', unit: hu.id });
    expect(s.campaign!.result).toBe('won');
    // ohne Einheiten verloren / lost without units
    const w = game('m12');
    allHuman(w);
    w.units = w.units.filter((u) => u.owner !== 0);
    endTurn(w);
    expect(w.campaign!.result).toBe('lost');
  });
});

describe('Welt der Vergessenen: Ziele / world of the Forgotten: objectives', () => {
  it('m13: Ruinenstaetten mit schlafenden Wachen; drei entziffert = Sieg / ruin sites with dormant sentinels; three deciphered = win', () => {
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game('m13', f);
      const c = s.campaign!;
      expect(c.sites!.length, f).toBe(RUINS.sites);
      expect(c.siteDone).toEqual(c.sites!.map(() => false));
      for (const [i, p] of c.sites!.entries()) {
        expect(isLand(s.tiles[p.y * s.size + p.x]), f).toBe(true);
        for (const o of c.sites!.slice(i + 1)) expect(dist(o, p), f).toBeGreaterThanOrEqual(RUINS.spacing);
        for (const city of s.cities) expect(dist(city, p), f).toBeGreaterThanOrEqual(RUINS.cityDistance);
        expect(s.factions[0].explored[p.y * s.size + p.x]).toBe(1);
      }
      // Wachen schlafen, jede bewacht ihre naechste Staette / sentinels sleep, each guards its nearest site
      const guns = s.tiles.map((t, k) => ({ t, x: k % s.size, y: Math.floor(k / s.size) })).filter((g) => g.t.turret);
      expect(guns.length, f).toBeGreaterThanOrEqual(RUINS.sites - 1);
      for (const g of guns) {
        expect(g.t.turret!.active).toBe(false);
        expect(dist(turretGuard(s, g), g), f).toBe(RUINS.sentinelDistance);
      }
    }
    const s = game('m13', 'dravon');
    allHuman(s);
    const c = s.campaign!;
    const m = missionById('m13')!;
    const own = s.units.filter((u) => u.owner === 0);
    // eine Einheit auf der Staette weckt deren Wache; Wachen ohne Einheit in der Naehe ihrer Staette schlafen weiter
    // a unit on the site wakes its sentinel; sentinels without a unit near their site keep sleeping
    placeAt(s, own[0], c.sites![0]);
    own[1].hp -= 1;
    applyCommand(s, { type: 'heal', unit: own[1].id });
    const awake = s.tiles.map((t, k) => ({ t, x: k % s.size, y: Math.floor(k / s.size) })).filter((g) => g.t.turret?.active);
    expect(awake.length).toBeGreaterThanOrEqual(1);
    expect(awake.some((g) => turretGuard(s, g).x === c.sites![0].x && turretGuard(s, g).y === c.sites![0].y)).toBe(true);
    for (const g of awake) expect(s.units.some((u) => dist(u, turretGuard(s, g)) <= VERDAN.wakeRange)).toBe(true);
    // erst zu Beginn des naechsten Spielerzugs entziffert / deciphered only at the start of the next player turn
    expect(c.siteDone![0]).toBe(false);
    own[0].hp = own[0].maxHp; // die Wache soll ihn nicht toeten / the sentinel must not kill it
    for (const g of awake) g.t.turret = null;
    const ev = passRound(s);
    expect(c.siteDone![0]).toBe(true);
    expect(ev.some((e) => e.t === 'ruin' && e.index === 0)).toBe(true);
    expect(objectiveProgress(s, m.objectives[0], m.rounds)).toEqual({ have: 1, need: 3 });
    expect(c.result).toBeNull();
    placeAt(s, own[1], c.sites![1]); placeAt(s, own[2], c.sites![2]);
    for (const t of s.tiles) t.turret = null;
    passRound(s);
    expect(c.siteDone!.filter(Boolean).length).toBeGreaterThanOrEqual(3);
    expect(c.status).toEqual(['done', 'done']);
    expect(c.result).toBe('won');
  });

  it('m14: Hoehleneingang mit Felswand, drei Runden halten = Sieg, Abzug setzt zurueck / cave entrance with rock wall, holding three rounds wins, leaving resets', () => {
    for (const f of CAMPAIGN_FACTIONS) {
      const s = game('m14', f);
      const c = s.campaign!;
      const p = c.cave!;
      expect(c.targets).toContainEqual(p);
      expect(s.tiles[p.y * s.size + p.x].terrain, f).toBe('plain');
      // Felswand im Nordwesten, Zugang von den anderen Seiten / rock wall to the north-west, access from the other sides
      expect(s.tiles[(p.y - 1) * s.size + p.x - 1].terrain, f).toBe('mountain');
      for (const h of s.cities.filter((x) => x.isHQ)) expect(dist(h, p), f).toBeGreaterThanOrEqual(4);
      for (const fa of s.factions) expect(fa.explored[p.y * s.size + p.x], f).toBe(1);
      expect(s.campaign!.spawns!.length).toBe(4);
    }
    const s = game('m14', 'meridon');
    allHuman(s);
    const c = s.campaign!;
    const u = s.units.find((x) => x.owner === 0 && x.type === 'mg')!;
    placeAt(s, u, c.cave!);
    passRound(s);
    expect(c.caveHold).toBe(1);
    placeAt(s, u, { x: c.cave!.x + 1, y: c.cave!.y + 1 });
    passRound(s);
    expect(c.caveHold).toBe(0);
    placeAt(s, u, c.cave!);
    for (let i = 0; i < 3 && !c.result; i++) { s.units = s.units.filter((x) => x.owner === 0 || dist(x, c.cave!) > 2); passRound(s); }
    expect(c.status[0]).toBe('done');
    expect(c.result).toBe('won');
    // der Verbuendete haelt fuer den Spieler / the ally holds for the player
    const a = game('m14', 'alvenia');
    allHuman(a);
    const ally = a.campaign!.allies![0];
    const au = a.units.find((x) => x.owner === ally)!;
    placeAt(a, au, a.campaign!.cave!);
    passRound(a);
    expect(a.campaign!.caveHold).toBe(1);
  });

  it('Verbuendete: eingenommene Zielstadt zaehlt fuer den Spieler (m5, m7) / allies: a captured target city counts for the player (m5, m7)', () => {
    const s = game('m5', 'meridon');
    const ally = s.campaign!.allies![0];
    const t = s.campaign!.targets[0];
    cityAt(s, t.x, t.y)!.owner = ally;
    const hu = s.units.find((u) => u.owner === 0)!;
    hu.hp -= 1;
    applyCommand(s, { type: 'heal', unit: hu.id });
    expect(s.campaign!.status[0]).toBe('done');
    expect(s.campaign!.result).toBe('won');
  });
});

describe('Welt der Vergessenen: KI / world of the Forgotten: AI', () => {
  it('m12 bis m14 x 2 Fraktionen: keine Fehlbefehle, Zuege unter 1 s / m12 to m14 x 2 factions: no failed commands, turns under 1 s', () => {
    const errors = aiDebug.errors;
    for (const id of ['m12', 'm13', 'm14']) for (const f of ['alvenia', 'velkar'] as const) {
      const s = game(id, f);
      s.factions[0].human = false;
      let fails = 0, guard = 0, worst = 0;
      while (!s.over && s.round <= missionById(id)!.rounds && guard++ < 30000) {
        const fi = s.current;
        const t0 = performance.now();
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          if (cmd.type === 'endTurn' && r.ok) break;
        }
        worst = Math.max(worst, performance.now() - t0);
      }
      expect(fails, `${id}/${f}`).toBe(0);
      expect(worst, `${id}/${f}`).toBeLessThan(1000);
      expect(s.over, `${id}/${f}`).toBe(true);
    }
    expect(aiDebug.errors).toBe(errors);
  }, 300_000);
});

