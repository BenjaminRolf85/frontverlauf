/**
 * Hoehlen-Finale (m9): Kartenthema, Hoehlen-Kartengenerator, Nachschublinien statt Staedten, Verdan-Verteidigungslinie
 * und KI-Laeufe auf der grossen Karte.
 * Cavern finale (m9): map theme, cavern map generator, supply lines instead of cities, Verdan defence line
 * and AI runs on the big map.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, cityIncome, cityUpgradeCheck, cloneState, createGame, defaultConfig, dist, generateMap, grandProjectCheck, hqOf, isCavern,
  missionById, missionConfig, ownCities, reachable, score, supplyLines, turretList, turretTargets, unitLimit, type GameState, type Unit,
} from '../src/core';
import { isValidState, migrateState } from '../src/save/save';
import { planNextCommand, aiDebug } from '../src/ai/ai';
import { AI, FACTION_IDS, MAP_SIZES, SUPPLY_LINE, VERDAN, type FactionId } from '../src/data/balance';

const m9 = (f: FactionId = 'korvat') => createGame(missionConfig('m9', f));

function endTurn(s: GameState) {
  for (const p of [...s.pendingRewards]) if (s.cities.find((c) => c.id === p.cityId)?.owner === s.current) applyCommand(s, { type: 'reward', city: p.cityId, choice: 'a' });
  const r = applyCommand(s, { type: 'endTurn' });
  expect(r.ok).toBe(true);
  return r;
}
function passRound(s: GameState) {
  const events = [...endTurn(s).events];
  while (s.current !== 0 && !s.over) events.push(...endTurn(s).events);
  return events;
}
function placeAt(s: GameState, u: Unit, p: { x: number; y: number }) {
  s.units = s.units.filter((o) => o === u || !(o.x === p.x && o.y === p.y));
  Object.assign(u, { x: p.x, y: p.y, startX: p.x, startY: p.y, fresh: false, exhausted: false, moved: false, attacked: false, moveDone: false });
}
const allHuman = (s: GameState) => { for (const f of s.factions) f.human = true; };

describe('Hoehlen-Thema / cavern theme', () => {
  it('m9 ist eine Hoehle auf der groessten Karte, andere Missionen nicht / m9 is a cave on the largest map, other missions are not', () => {
    const cfg = missionConfig('m9', 'velkar');
    expect(cfg.theme).toBe('cavern');
    expect(cfg.size).toBe(Math.max(...MAP_SIZES));
    expect(missionById('m9')!.rounds).toBeGreaterThanOrEqual(28);
    expect(missionConfig('m1', 'velkar').theme).toBeUndefined();
    expect(defaultConfig().theme).toBeUndefined();
    expect(isCavern(m9())).toBe(true);
    expect(isCavern(createGame(defaultConfig()))).toBe(false);
  });

  it('Hoehlen-Karte: kein Ozean, Felswand am Rand, deterministisch; Oberflaeche unveraendert / cavern map: no ocean, rock wall at the edge, deterministic; surface unchanged', () => {
    for (const seed of [3, 77, 9916]) {
      const a = generateMap(seed, 22, 'continents', ['korvat', 'zyrr', 'nexus'], 'cavern');
      const b = generateMap(seed, 22, 'continents', ['korvat', 'zyrr', 'nexus'], 'cavern');
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.tiles.some((t) => t.terrain === 'ocean')).toBe(false);
      const edge = a.tiles.filter((_, k) => { const x = k % 22, y = Math.floor(k / 22); return x === 0 || y === 0 || x === 21 || y === 21; });
      expect(edge.filter((t) => t.terrain === 'mountain').length).toBeGreaterThan(edge.length * 0.4);
      // Startpunkte und Siedlungen bleiben gleich / starts and villages stay the same
      const plain = generateMap(seed, 22, 'continents', ['korvat', 'zyrr', 'nexus']);
      expect(a.starts).toEqual(plain.starts);
      expect(a.villages).toEqual(plain.villages);
      // ohne Thema: exakt wie bisher / without a theme: exactly as before
      expect(JSON.stringify(generateMap(seed, 22, 'continents', ['korvat', 'zyrr', 'nexus'], undefined))).toBe(JSON.stringify(plain));
    }
  });

  it('alte Spielstaende ohne Thema bleiben gueltig / old saves without a theme stay valid', () => {
    const s = m9();
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    delete old.config.theme;
    for (const t of old.tiles) { delete t.turret; delete t.turretRuin; }
    const back = migrateState(old);
    expect(back && isValidState(back)).toBeTruthy();
    expect(isCavern(back!)).toBe(false);
    const saved = migrateState(JSON.parse(JSON.stringify(s)));
    expect(saved && isCavern(saved)).toBe(true);
  });
});

describe('Nachschublinien / supply lines', () => {
  it('festes Einkommen und Einheitenlimit, Hauptschacht groesser / fixed income and unit limit, main shaft bigger', () => {
    const s = m9();
    expect(supplyLines(s)).toBe(true);
    const hq = hqOf(s, 0)!;
    expect(cityIncome(s, hq)).toBe(SUPPLY_LINE.mainShaftIncome);
    expect(unitLimit(s, hq)).toBeGreaterThanOrEqual(SUPPLY_LINE.mainShaftUnitLimit);
    const line = ownCities(s, 0).find((c) => c.id !== hq.id)!;
    expect(cityIncome(s, line)).toBe(SUPPLY_LINE.income);
    // nur ein Feld Gebiet / only one ring of territory
    for (const c of s.cities) expect(c.radius).toBeLessThanOrEqual(1);
  });

  it('kein Wachstum, keine Belohnungen, Ausbauten oder Grossprojekte / no growth, rewards, upgrades or grand projects', () => {
    const s = m9();
    allHuman(s);
    const hq = hqOf(s, 0)!;
    s.factions[0].stars = 999;
    expect(cityUpgradeCheck(s, 0, hq, 'hospital')).not.toBe('ok');
    s.factions[0].grandProjectsUnlocked = ['stateBank'];
    for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) expect(grandProjectCheck(s, 0, 'stateBank', x, y)).toBe(false);
    for (let r = 0; r < 6; r++) passRound(s);
    expect(s.pendingRewards.length).toBe(0);
    for (const c of s.cities) { expect(c.level).toBe(1); expect(c.pop).toBe(0); }
    expect(s.factions.every((f) => f.grandProjectsUnlocked.length === 0 || f.index === 0)).toBe(true);
    // normale Partie: Ausbau weiter moeglich / normal game: upgrades still possible
    const n = createGame(defaultConfig());
    n.factions[0].stars = 999;
    expect(cityUpgradeCheck(n, 0, hqOf(n, 0)!, 'hospital')).not.toBe('noSlot');
  });

  it('Nachschublinien werden wie Staedte erobert / supply lines are captured like cities', () => {
    const s = m9();
    allHuman(s);
    const target = s.cities.find((c) => c.owner === null)!;
    const u = s.units.find((x) => x.owner === 0 && x.type === 'mg')!;
    placeAt(s, u, target);
    const r = applyCommand(s, { type: 'capture', unit: u.id });
    expect(r.ok).toBe(true);
    expect(target.owner).toBe(0);
    expect(target.level).toBe(1);
    expect(cityIncome(s, target)).toBe(SUPPLY_LINE.income);
  });
});

describe('Verdan-Verteidigungslinie / Verdan defence line', () => {
  it('Ring aus schlafenden Geschuetzen um das Artefakt, unpassierbar / ring of dormant guns around the artifact, impassable', () => {
    const s = m9();
    const art = s.campaign!.artifact!;
    const guns = turretList(s);
    expect(guns.length).toBe(VERDAN.count);
    for (const g of guns) {
      expect(dist(g, art)).toBeGreaterThanOrEqual(VERDAN.ringDistance);
      expect(dist(g, art)).toBeLessThanOrEqual(VERDAN.ringDistance + 1);
      expect(g.active).toBe(false);
      expect(g.hp).toBe(VERDAN.hp);
    }
    // keine Fraktion, kein Zug, keine Punkte / no faction, no turn, no score
    expect(s.factions.length).toBe(5);
    for (const u of s.units) {
      if (u.owner !== s.current) continue;
      for (const r of reachable(s, u)) expect(guns.some((g) => g.x === r.x && g.y === r.y)).toBe(false);
    }
    // Normale Partie: keine Geschuetze / normal game: no guns
    expect(turretList(createGame(defaultConfig())).length).toBe(0);
  });

  it('erwacht, wenn eine Einheit dem Artefakt nahe kommt, und feuert zu Rundenbeginn / wakes when a unit comes close to the artifact and fires at round start', () => {
    const s = m9();
    allHuman(s);
    const art = s.campaign!.artifact!;
    const gun = turretList(s)[0];
    const u = s.units.find((x) => x.owner === 0 && x.type === 'mg')!;
    // Feld in Reichweite des Geschuetzes, aber nicht neben dem Artefakt / tile in range of the gun
    const spot = { x: gun.x + Math.sign(art.x - gun.x), y: gun.y + Math.sign(art.y - gun.y) };
    placeAt(s, u, spot);
    expect(dist(spot, art)).toBeLessThanOrEqual(VERDAN.wakeRange);
    u.hp = u.maxHp - 1;
    const r = applyCommand(s, { type: 'heal', unit: u.id });
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.t === 'verdanActive')).toBe(true);
    expect(turretList(s).every((g) => g.active)).toBe(true);
    const hp = u.hp;
    const before = s.factions.map((f) => f.alive);
    const twin = cloneState(s);
    const ev = passRound(s);
    const shots = ev.filter((e) => e.t === 'turretFire');
    expect(shots.length).toBeGreaterThan(0);
    const mine = shots.filter((e) => e.t === 'turretFire' && e.target === u.id);
    expect(mine.length).toBeGreaterThan(0);
    const after = s.units.find((x) => x.id === u.id);
    const dealt = mine.reduce((a, e) => a + (e.t === 'turretFire' ? e.dmg : 0), 0);
    if (after) expect(after.hp).toBeLessThanOrEqual(hp - dealt + 4);
    // deterministisch / deterministic
    const ev2 = passRound(twin);
    expect(JSON.stringify(ev2.filter((e) => e.t === 'turretFire'))).toBe(JSON.stringify(shots));
    // Zugfolge und Sieg unberuehrt / turn order and victory untouched
    expect(s.current).toBe(0);
    expect(s.factions.map((f) => f.alive)).toEqual(before);
    expect(s.over).toBe(false);
  });

  it('Geschuetze koennen angegriffen und zerstoert werden / guns can be attacked and destroyed', () => {
    const s = m9();
    allHuman(s);
    s.config.hitChance = false;
    const gun = turretList(s)[0];
    const u = s.units.find((x) => x.owner === 0 && x.type === 'artillery')!;
    const free = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2]].map(([dx, dy]) => ({ x: gun.x + dx, y: gun.y + dy }))
      .find((p) => p.x >= 0 && p.y >= 0 && p.x < s.size && p.y < s.size && !s.tiles[p.y * s.size + p.x].turret && s.tiles[p.y * s.size + p.x].cityId === null)!;
    placeAt(s, u, free);
    s.factions[0].explored.fill(1);
    expect(turretTargets(s, u).some((p) => p.x === gun.x && p.y === gun.y)).toBe(true);
    const r = applyCommand(s, { type: 'attackTurret', unit: u.id, x: gun.x, y: gun.y });
    expect(r.ok).toBe(true);
    const hit = r.events.find((e) => e.t === 'turretHit');
    expect(hit && hit.t === 'turretHit' && hit.dmg).toBeGreaterThan(0);
    const t = s.tiles[gun.y * s.size + gun.x];
    expect(t.turret!.hp).toBeLessThan(VERDAN.hp);
    // ein Angriff weckt die Linie / an attack wakes the line
    expect(turretList(s).every((g) => g.active)).toBe(true);
    // zweiter Angriff im selben Zug geht nicht / no second attack in the same turn
    expect(applyCommand(s, { type: 'attackTurret', unit: u.id, x: gun.x, y: gun.y }).ok).toBe(false);
    // fast zerstoert: naechster Treffer vernichtet / almost destroyed: the next hit destroys
    t.turret!.hp = 1;
    Object.assign(u, { attacked: false, exhausted: false, moved: false });
    const kills = s.factions[0].kills;
    const p0 = score(s, 0);
    const r2 = applyCommand(s, { type: 'attackTurret', unit: u.id, x: gun.x, y: gun.y });
    expect(r2.ok).toBe(true);
    expect(t.turret).toBeNull();
    expect(t.turretRuin).toBe(true);
    expect(turretList(s).length).toBe(VERDAN.count - 1);
    expect(s.factions[0].kills).toBe(kills + 1);
    expect(score(s, 0)).toBeGreaterThanOrEqual(p0);
    // ausser Reichweite / out of range
    const far = turretList(s)[0];
    expect(applyCommand(s, { type: 'attackTurret', unit: s.units.find((x) => x.owner === 0 && x.type === 'jeep')!.id, x: far.x, y: far.y }).ok).toBe(false);
  });
});

describe('Hoehlen-Finale: KI / cavern finale: AI', () => {
  it('KI spielt m9 auf der grossen Karte fuer zwei Spielerfraktionen ohne Fehlbefehle, schnell / AI plays m9 on the big map for two player factions without failed commands, fast', () => {
    const errors = aiDebug.errors;
    const timing: string[] = [];
    for (const f of ['alvenia', 'velkar'] as const) {
      const s = m9(f);
      s.factions[0].human = false;
      let fails = 0, guard = 0, turns = 0, worst = 0, total = 0;
      const shots = { fire: 0, hit: 0 };
      while (!s.over && guard++ < 40000) {
        const fi = s.current;
        const t0 = performance.now();
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, fi);
          const r = applyCommand(s, cmd);
          if (!r.ok) fails++;
          for (const e of r.events) { if (e.t === 'turretFire') shots.fire++; if (e.t === 'turretHit') shots.hit++; }
          if (cmd.type === 'endTurn' && r.ok) break;
        }
        const ms = performance.now() - t0;
        turns++; total += ms; worst = Math.max(worst, ms);
      }
      expect(fails, f).toBe(0);
      expect(s.over, f).toBe(true);
      timing.push(`${f}: ${turns} turns, rounds ${s.round}, avg ${(total / turns).toFixed(1)} ms, max ${worst.toFixed(0)} ms, result ${s.campaign!.result}, gunFire ${shots.fire}, gunHits ${shots.hit}`);
      expect(worst, f).toBeLessThan(1000);
    }
    console.log(timing.join('\n'));
    expect(aiDebug.errors).toBe(errors);
  }, 600_000);

  it('alle Fraktions-IDs bleiben unberuehrt / all faction ids stay untouched', () => {
    expect(FACTION_IDS.length).toBe(8);
  });
});
