import { describe, expect, it } from 'vitest';
import {
  buildCheck, cityIncome, cityUpgradeCheck, combatPreview, computePower, createGame, cultCap, cultSlots, cultTithe, cultUnits, defaultConfig, income,
  plunderValue, recruitCheck, trainCheck, upkeep,
} from '../src/core';
import { CITY, CULT, UNITS } from '../src/data/balance';
import { playAiTurn } from '../src/ai/ai';
import { addCity, addUnit, blankGame, fails, ok, revealAll, setTerrain, tile } from './helpers';

function g(factions: ['vesper' | 'nexus', 'korvat'], stars = 200) {
  const s = blankGame({ stars, factions });
  const hq = addCity(s, 2, 2, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return { s, hq };
}

describe('Kult der Letzten Stunde / Cult of the Final Hour', () => {
  it('startet mit Eiferer und forscht normal / starts with a zealot and researches', () => {
    const s = createGame(defaultConfig({ seed: 4, size: 14, factions: [{ id: 'vesper', human: true, difficulty: 'normal' }, { id: 'korvat', human: false, difficulty: 'normal' }] }));
    expect(s.units.find((u) => u.owner === 0)!.type).toBe('zealot');
    // Starthorde / starting horde
    expect(s.units.filter((u) => u.owner === 0)).toHaveLength(1 + CULT.startUnits.length);
    s.factions[0].stars = 50;
    ok(s, { type: 'research', tech: 'motorization' });
  });
  it('rekrutiert nicht in Staedten, sondern im Feld / recruits in the field, not in cities', () => {
    const { s, hq } = g(['vesper', 'korvat']);
    expect(trainCheck(s, hq, 'zealot')).toBe('cultRecruit');
    expect(trainCheck(s, hq, 'coreDrill')).toBe('cultRecruit');
    fails(s, { type: 'train', city: hq.id, unitType: 'zealot' }, 'cultRecruit');
    const z = addUnit(s, 'zealot', 0, 5, 5);
    expect(recruitCheck(s, 0, z.id, 'zealot', 5, 7)).toBe('outOfRange');
    expect(recruitCheck(s, 0, z.id, 'torchbearer', 5, 6)).toBe('techMissing');
    expect(recruitCheck(s, 0, z.id, 'infantry', 5, 6)).toBe('invalid');
    // Eiferer rufen nur Fusstruppen / zealots call up foot troops only
    expect(recruitCheck(s, 0, z.id, 'doomCrawler', 5, 6)).toBe('invalid');
    ok(s, { type: 'recruit', unit: z.id, unitType: 'zealot', x: 5, y: 6 });
    const n = s.units.find((u) => u.x === 5 && u.y === 6)!;
    expect(n.type).toBe('zealot');
    // Rekruten gehoeren zu keiner Stadt / recruits belong to no city
    expect(n.homeCity).toBeNull();
    expect(s.factions[0].stars).toBe(200 - UNITS.zealot.cost!);
    // Rekrutierer ist erschoepft, Rekrut ist frisch / recruiter is exhausted, recruit is fresh
    fails(s, { type: 'recruit', unit: z.id, unitType: 'zealot', x: 4, y: 5 }, 'unitExhausted');
    expect(recruitCheck(s, 0, n.id, 'zealot', 5, 7)).toBe('unitExhausted');
    expect(z.recruitReady).toBe(s.round + CULT.recruitCooldown);
  });
  it('Abklingzeit, Feldregeln und Einheitenlimit aus den Plaetzen / cooldown, tile rules and the unit cap from slots', () => {
    const { s, hq } = g(['vesper', 'korvat']);
    const z = addUnit(s, 'zealot', 0, 5, 5);
    // kein Wasser, kein Vulkan, keine Lava, keine fremde Stadt / no water, no volcano, no lava, no foreign city
    setTerrain(s, 6, 5, 'shallow');
    expect(recruitCheck(s, 0, z.id, 'zealot', 6, 5)).toBe('invalidTile');
    setTerrain(s, 4, 5, 'mountain');
    tile(s, 4, 5).volcano = true;
    expect(recruitCheck(s, 0, z.id, 'zealot', 4, 5)).toBe('invalidTile');
    tile(s, 5, 4).lava = s.round;
    expect(recruitCheck(s, 0, z.id, 'zealot', 5, 4)).toBe('invalidTile');
    // Limit: Grundzahl plus Plaetze des Hauptquartiers / cap: base plus the slots of the HQ
    expect(cultCap(s, 0)).toBe(CULT.baseCap + hq.level + CITY.unitLimitExtra + CULT.hqSlots);
    while (cultUnits(s, 0).length < cultCap(s, 0)) addUnit(s, 'zealot', 0, cultUnits(s, 0).length, 10);
    expect(recruitCheck(s, 0, z.id, 'zealot', 5, 6)).toBe('unitLimit');
    // ein Schrein bringt Plaetze / a shrine brings slots
    ok(s, { type: 'build', building: 'shrine', x: 2, y: 3 });
    expect(cultCap(s, 0)).toBe(CULT.baseCap + hq.level + CITY.unitLimitExtra + CULT.hqSlots + CULT.shrineSlots);
    ok(s, { type: 'recruit', unit: z.id, unitType: 'zealot', x: 5, y: 6 });
    // Abklingzeit: erst nach CULT.recruitCooldown Runden wieder / cooldown: again only after CULT.recruitCooldown rounds
    s.round += 1; z.exhausted = false;
    expect(recruitCheck(s, 0, z.id, 'zealot', 6, 6)).toBe('recruitCooldown');
    s.round += CULT.recruitCooldown - 1;
    s.cities[0].level = 3;
    expect(recruitCheck(s, 0, z.id, 'zealot', 6, 6)).toBe('ok');
  });
  it('nie auf ein Geschuetzfeld, Rekrut nicht gezogen / never onto a gun tile, recruit has not moved', () => {
    const { s } = g(['vesper', 'korvat']);
    const z = addUnit(s, 'zealot', 0, 5, 5);
    // Geschuetzstellung der Dravon oder Verdan-Geschuetz / Dravon emplacement or Verdan gun
    tile(s, 5, 6).turret = { hp: 10, active: true, owner: 1 };
    expect(recruitCheck(s, 0, z.id, 'zealot', 5, 6)).toBe('occupied');
    ok(s, { type: 'move', unit: z.id, to: { x: 6, y: 5 } });
    ok(s, { type: 'recruit', unit: z.id, unitType: 'zealot', x: 6, y: 6 });
    const n = s.units.find((u) => u.x === 6 && u.y === 6)!;
    // Feuern nach Bewegung: der Rekrut gilt nicht als gezogen / firing after moving: the recruit does not count as moved
    expect(n.moved).toBe(false);
  });
  it('Zehnt hoechstens CULT.titheRival je Gegner / tithe at most CULT.titheRival per rival', () => {
    const { s } = g(['vesper', 'korvat']);
    for (let i = 0; i < 10; i++) addUnit(s, 'zealot', 0, i, 10);
    expect(cultTithe(s, 0)).toBe(Math.min(CULT.titheMax, CULT.titheRival * 1, 10));
  });
  it('Kult-Stadt: kein Einkommen, kein Wachstum, keine Ausbauten, kein Sold / cult city: no income, no growth, no upgrades, no upkeep', () => {
    const { s, hq } = g(['vesper', 'korvat']);
    for (let i = 0; i < 6; i++) addUnit(s, 'zealot', 0, 5 + (i % 3), 5 + Math.floor(i / 3));
    expect(cityIncome(s, hq)).toBe(0);
    expect(income(s, 0)).toBe(cultTithe(s, 0));
    expect(cultTithe(s, 0)).toBe(Math.min(CULT.titheMax, CULT.titheRival * (s.factions.length - 1), Math.floor(6 * CULT.tithePerUnit)));
    expect(upkeep(s, 0)).toBe(0);
    expect(cityUpgradeCheck(s, 0, hq, 'bunker')).toBe('noSlot');
    // nur Kult-Gebaeude, Strassen und Bruecken / only cult buildings, roads and bridges
    expect(buildCheck(s, 0, 'storehouse', 2, 3)).toMatchObject({ ok: false, error: 'cannotBuild' });
    const pop = hq.pop;
    ok(s, { type: 'build', building: 'shrine', x: 2, y: 3 });
    expect(hq.pop).toBe(pop);
  });
  it('Pluendern: Sterne nach Stufe, die Stadt faellt an den Kult, kein doppeltes Pluendern / plunder: stars by level, the city falls to the cult, no double plunder', () => {
    const { s } = g(['vesper', 'korvat']);
    const enemy = s.cities.find((c) => c.owner === 1)!;
    enemy.level = 3;
    const z = addUnit(s, 'zealot', 0, enemy.x, enemy.y);
    const stars = s.factions[0].stars;
    const r = ok(s, { type: 'capture', unit: z.id });
    const loot = CULT.plunderBase + CULT.plunderPerLevel * 3 + CULT.plunderHq;
    expect(r.events.find((e) => e.t === 'capture')).toMatchObject({ plunder: loot });
    expect(s.factions[0].stars).toBe(stars + loot);
    expect(enemy.owner).toBe(0);
    expect(enemy.level).toBe(3);
    // Plaetze nach Stufe / slots by level
    expect(cultSlots(s, enemy)).toBe(3 + CITY.unitLimitExtra);
    // zurueckerobert und gleich wieder genommen: keine Beute / retaken and taken again at once: no loot
    enemy.owner = 1;
    s.round += CULT.replunderRounds - 1;
    expect(plunderValue(s, 0, enemy)).toBe(0);
    s.round += 1;
    expect(plunderValue(s, 0, enemy)).toBe(loot);
    // Punkte fuer die Beute / points for the loot
    expect(s.factions[0].plunder).toBe(loot);
  });
  it('ausgeschieden ohne Einheit, Staedte werden neutral / eliminated without a unit, cities turn neutral', () => {
    const { s, hq } = g(['vesper', 'korvat']);
    const z = addUnit(s, 'zealot', 0, 5, 5);
    const k = addUnit(s, 'infantry', 1, 5, 6);
    z.hp = 1;
    s.current = 1;
    ok(s, { type: 'attack', unit: k.id, target: z.id });
    expect(s.factions[0].alive).toBe(false);
    expect(hq.owner).toBeNull();
    expect(s.over).toBe(true);
    expect(s.victory).toMatchObject({ kind: 'conquest', faction: 'korvat' });
  });
  it('Nicht-Prediger und andere Fraktionen koennen nicht rekrutieren / non-preachers and others cannot recruit', () => {
    const { s } = g(['vesper', 'korvat']);
    const b = addUnit(s, 'doomBuggy', 0, 5, 5);
    expect(recruitCheck(s, 0, b.id, 'zealot', 5, 6)).toBe('notPreacher');
    const inf = addUnit(s, 'infantry', 1, 8, 8);
    expect(recruitCheck(s, 1, inf.id, 'zealot', 8, 7)).toBe('invalid');
  });
  it('Flammen ignorieren Deckung / flames ignore cover', () => {
    const { s } = g(['vesper', 'korvat']);
    setTerrain(s, 6, 5, 'forest');
    const t = addUnit(s, 'torchbearer', 0, 5, 5);
    const z = addUnit(s, 'zealot', 0, 5, 6);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    s.factions[1].techs.push('forestry');
    const burn = combatPreview(s, t, d);
    const plain = combatPreview(s, z, d);
    expect(burn.toDefender / UNITS.torchbearer.attack).toBeGreaterThan(plain.toDefender / UNITS.zealot.attack);
  });
  it('Schrein nur fuer den Kult / shrine only for the cult', () => {
    const { s } = g(['vesper', 'korvat']);
    expect(buildCheck(s, 0, 'shrine', 2, 3).ok).toBe(true);
    const human = s.cities.find((c) => c.owner === 1)!;
    expect(buildCheck(s, 1, 'shrine', human.x, human.y + 1).ok).toBe(false);
  });
});

describe('KI-Kollektiv NEXUS', () => {
  it('forscht nicht und startet mit Android / no research, starts with an android', () => {
    const s = createGame(defaultConfig({ seed: 6, size: 14, factions: [{ id: 'nexus', human: true, difficulty: 'normal' }, { id: 'korvat', human: false, difficulty: 'normal' }] }));
    expect(s.factions[0].techs).toEqual(['coastalEconomy', 'diving', 'shipbuilding']);
    expect(s.units.find((u) => u.owner === 0)!.type).toBe('android');
    fails(s, { type: 'research', tech: 'motorization' }, 'noResearch');
  });
  it('Rechenleistung aus Rechenzentrum plus Kraftwerk schaltet Einheiten frei / compute unlocks units', () => {
    const { s, hq } = g(['nexus', 'korvat']);
    expect(trainCheck(s, hq, 'android')).toBe('ok');
    expect(trainCheck(s, hq, 'spider')).toBe('computeMissing');
    expect(trainCheck(s, hq, 'infantry')).toBe('invalid');
    ok(s, { type: 'build', building: 'dataCenter', x: 2, y: 3 });
    expect(computePower(s, 0)).toBe(0);
    tile(s, 3, 3).resource = 'ore';
    ok(s, { type: 'build', building: 'powerPlant', x: 3, y: 3 });
    expect(computePower(s, 0)).toBe(1);
    expect(trainCheck(s, hq, 'spider')).toBe('ok');
    expect(trainCheck(s, hq, 'quadDrone')).toBe('computeMissing');
    const human = s.cities.find((c) => c.owner === 1)!;
    expect(buildCheck(s, 1, 'dataCenter', human.x, human.y + 1).ok).toBe(false);
  });
});

describe('KI spielt Kult und NEXUS / AI plays cult and NEXUS', () => {
  for (const id of ['vesper', 'nexus'] as const) {
    it(`${id}: volle Punkte-Partie ohne Fehler / full points game`, () => {
      const s = createGame(defaultConfig({ seed: 8, size: 14, mode: 'points', factions: [{ id, human: false, difficulty: 'hard' }, { id: 'korvat', human: false, difficulty: 'normal' }, { id: 'velkar', human: false, difficulty: 'normal' }] }));
      let failedTurns = 0;
      let peak = 0;
      while (!s.over) { const cmds = playAiTurn(s); if (!cmds.length) failedTurns++; peak = Math.max(peak, s.units.filter((u) => u.owner === 0 && UNITS[u.type].faction === id).length); }
      const mine = s.units.filter((u) => u.owner === 0).map((u) => u.type);
      const blds = s.tiles.filter((t) => t.building === 'dataCenter' || t.building === 'powerPlant' || t.building === 'shrine').length;
      console.log(`${id}: units ${mine.join(',')} buildings ${blds} techs ${s.factions[0].techs.length} compute ${computePower(s, 0)} cities ${s.cities.filter((c) => c.owner === 0).length}`);
      expect(failedTurns).toBe(0);
      // eigene Sondereinheiten im Spielverlauf (am Ende kann die Fraktion geschlagen sein) / own special units during the game (the faction may be beaten at the end)
      expect(peak).toBeGreaterThan(2);
      // NEXUS forscht nur die Siegtechnologie / NEXUS only researches its victory tech
      if (id === 'nexus') { expect(s.factions[0].techs.filter((x) => x !== 'singularity')).toEqual(['coastalEconomy', 'diving', 'shipbuilding']); expect(computePower(s, 0)).toBeGreaterThan(0); }
    }, 180000);
  }
});

describe('Zyrr waten durchs Wasser / Zyrr wade through water', () => {
  it('ein Feld pro Zug im Wasser, kein Angriff und kein Gegenschlag unter Wasser / one tile per turn in water, no attack or retaliation submerged', async () => {
    const { reachable, attackTargets, submerged } = await import('../src/core');
    const s = blankGame({ stars: 50, factions: ['zyrr', 'korvat'] });
    addCity(s, 2, 2, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true });
    revealAll(s, 0); revealAll(s, 1);
    for (let x = 4; x <= 7; x++) setTerrain(s, x, 5, 'ocean');
    const g = addUnit(s, 'mech', 0, 3, 5);
    const r = reachable(s, g);
    expect(r.some((p) => p.x === 4 && p.y === 5)).toBe(true);
    expect(r.some((p) => p.x === 5 && p.y === 5)).toBe(false);
    ok(s, { type: 'move', unit: g.id, to: { x: 4, y: 5 } });
    expect(submerged(s, g)).toBe(true);
    const e = addUnit(s, 'infantry', 1, 4, 6);
    expect(attackTargets(s, g)).toEqual([]);
    // Menschen ohne Waten koennen nicht ins Wasser / humans without wading cannot enter water
    expect(reachable(s, e).some((p) => p.x === 5 && p.y === 5)).toBe(false);
    const pre = combatPreview(s, e, g);
    expect(pre.retaliates).toBe(false);
  });
});
