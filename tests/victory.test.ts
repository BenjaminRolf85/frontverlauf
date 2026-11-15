/**
 * Fraktions-Siegbedingungen: Technologien, Bauplaetze, Fortschritt, Unterbrechung, Siege und KI.
 * Faction victory conditions: techs, sites, progress, interruption, victories and AI.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, attackTargets, continueEndless, convertTargets, createGame, cultUnits, defaultConfig, paidUnits, reachable, recruitCheck,
  techVisible, trainCheck, unitUpkeep, victoryStatus, korvatShareFor, wonderCheck, meridonNeedFor, type GameEvent, type GameState, type Unit,
} from '../src/core';
import {
  AI, ALL_TECH_IDS, FACTION_IDS, TECHS, TECH_IDS, UNITS, VICTORY_TECH, WONDERS, type FactionId, type WonderKind,
} from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { migrateState } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile, untilTurnOf } from './helpers';

/** Spiel mit zwei Fraktionen, Hauptquartier bei (2,2) bzw. (8,8), Radius 2 / game with two factions, HQs at (2,2) and (8,8), radius 2 */
function game(a: FactionId, b: FactionId = 'korvat', stars = 500, extra: Partial<Parameters<typeof blankGame>[0]> = {}): GameState {
  const s = blankGame({ factions: [a, b], stars, ...extra });
  addCity(s, 2, 2, 0, { hq: true, radius: 2 });
  addCity(s, 8, 8, 1, { hq: true, radius: 2 });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}
const giveTech = (s: GameState, f: number) => { s.factions[f].techs.push(VICTORY_TECH[s.factions[f].id]); };
const wonderOf = (s: GameState, f: number) => s.units.find((u) => u.owner === f && UNITS[u.type].abilities.includes('wonder'))!;
/** n eigene Zugbeginne der Fraktion f weiter / n own turn starts of faction f further */
function rounds(s: GameState, f: number, n: number) { for (let i = 0; i < n && !s.over; i++) untilTurnOf(s, f); }
/** Zug an Fraktion f geben, ohne Zugbeginn zu verarbeiten / hand the turn to faction f without processing a turn start */
const actAs = (s: GameState, f: number) => { s.current = f; for (const u of s.units) if (u.owner === f) { u.fresh = false; u.exhausted = false; u.moved = false; u.attacked = false; u.moveDone = false; } };

describe('Siegtechnologien / victory techs', () => {
  it('eine Stufe-3-Technologie je Fraktion, nur fuer diese sichtbar / one tier-3 tech per faction, visible only to it', () => {
    expect(TECH_IDS).toHaveLength(25);
    expect(ALL_TECH_IDS).toHaveLength(33);
    for (const f of FACTION_IDS) {
      const tech = VICTORY_TECH[f];
      expect(TECHS[tech].tier).toBe(3);
      expect(TECHS[tech].faction).toBe(f);
      expect(TECH_IDS).not.toContain(tech);
    }
    // Zyrr und NEXUS: ohne Vorgaenger / Zyrr and NEXUS: no parent
    expect(TECHS.dimensionalRift.parent).toBeNull();
    expect(TECHS.singularity.parent).toBeNull();
    const s = game('korvat', 'dravon');
    expect(techVisible(s, 0, 'fiveYearPlan')).toBe(true);
    expect(techVisible(s, 0, 'waalProgram')).toBe(false);
    expect(techVisible(s, 1, 'waalProgram')).toBe(true);
  });

  it('fremde Siegtechnologie verboten, eigene braucht den Vorgaenger / foreign victory tech forbidden, own one needs its parent', () => {
    const s = game('korvat', 'dravon');
    fails(s, { type: 'research', tech: 'waalProgram' }, 'wrongFaction');
    fails(s, { type: 'research', tech: 'fiveYearPlan' }, 'parentMissing');
    s.factions[0].techs.push('supply', 'agritech');
    ok(s, { type: 'research', tech: 'fiveYearPlan' });
    expect(s.factions[0].techs).toContain('fiveYearPlan');
  });

  it('Zyrr und NEXUS erforschen genau ihre Siegtechnologie / Zyrr and NEXUS research exactly their victory tech', () => {
    const s = game('zyrr', 'nexus');
    fails(s, { type: 'research', tech: 'motorization' }, 'noResearch');
    fails(s, { type: 'research', tech: 'singularity' }, 'wrongFaction');
    expect(techVisible(s, 0, 'dimensionalRift')).toBe(true);
    expect(techVisible(s, 0, 'motorization')).toBe(false);
    ok(s, { type: 'research', tech: 'dimensionalRift' });
    actAs(s, 1);
    fails(s, { type: 'research', tech: 'diving' }, 'noResearch');
    fails(s, { type: 'research', tech: 'logistics' }, 'noResearch');
    ok(s, { type: 'research', tech: 'singularity' });
  });

  it('ohne Technologie kein Wunder / no wonder without the tech', () => {
    const s = game('zyrr');
    fails(s, { type: 'wonder', kind: 'portal', x: 3, y: 3 }, 'techMissing');
    // fremdes Wunder / foreign wonder
    giveTech(s, 0);
    fails(s, { type: 'wonder', kind: 'waal', x: 3, y: 3 }, 'wrongFaction');
  });
});

describe('Bauplaetze / sites', () => {
  it('Hacker-Relais: Berg im eigenen Gebiet oder mit eigenem Aussenposten / hacker relay: mountain in own territory or with an own outpost', () => {
    const s = game('nexus');
    giveTech(s, 0);
    expect(wonderCheck(s, 0, 'hackRelay', 3, 3)).toBe('invalidTile'); // Ebene / plain
    setTerrain(s, 3, 3, 'mountain');
    setTerrain(s, 6, 1, 'mountain');
    expect(wonderCheck(s, 0, 'hackRelay', 6, 1)).toBe('notInTerritory');
    tile(s, 6, 1).outpost = { owner: 1 };
    expect(wonderCheck(s, 0, 'hackRelay', 6, 1)).toBe('invalidTile');
    tile(s, 6, 1).outpost = { owner: 0 };
    expect(wonderCheck(s, 0, 'hackRelay', 6, 1)).toBe('ok');
    expect(wonderCheck(s, 0, 'hackRelay', 3, 3)).toBe('ok');
    addUnit(s, 'android', 0, 3, 3);
    expect(wonderCheck(s, 0, 'hackRelay', 3, 3)).toBe('occupied');
    ok(s, { type: 'wonder', kind: 'hackRelay', x: 6, y: 1 });
    expect(s.factions[0].stars).toBe(500 - WONDERS.cost.hackRelay);
    // ein Wunder zur Zeit / one wonder at a time
    expect(wonderCheck(s, 0, 'hackRelay', 3, 3)).toBe('alreadyBuilt');
  });

  it('Fusionskraftwerk: 2x2 freies Land (auch Berge) im eigenen Gebiet, Grundflaeche unpassierbar / fusion plant: 2x2 free land (mountains too) in own territory, footprint impassable', () => {
    const s = game('velkar');
    giveTech(s, 0);
    // (4,4)+1 liegt ausserhalb von Radius 2 / (4,4)+1 is outside radius 2
    expect(wonderCheck(s, 0, 'fusionPlant', 4, 4)).toBe('notInTerritory');
    expect(wonderCheck(s, 0, 'fusionPlant', 1, 1)).toBe('invalidTile'); // Stadt bei (2,2) / city at (2,2)
    tile(s, 4, 1).building = 'farm';
    expect(wonderCheck(s, 0, 'fusionPlant', 3, 0)).toBe('invalidTile');
    tile(s, 4, 1).building = null;
    // Berge sind erlaubt, Wasser nicht / mountains are allowed, water is not
    setTerrain(s, 4, 1, 'mountain');
    expect(wonderCheck(s, 0, 'fusionPlant', 3, 0)).toBe('ok');
    setTerrain(s, 4, 1, 'shallow');
    expect(wonderCheck(s, 0, 'fusionPlant', 3, 0)).toBe('invalidTile');
    setTerrain(s, 4, 1, 'forest');
    const blocker = addUnit(s, 'infantry', 0, 4, 1);
    expect(wonderCheck(s, 0, 'fusionPlant', 3, 0)).toBe('occupied');
    s.units = s.units.filter((u) => u !== blocker);
    expect(wonderCheck(s, 0, 'fusionPlant', 3, 0)).toBe('ok');
    s.factions[0].stars = WONDERS.cost.fusionPlant - 1;
    expect(wonderCheck(s, 0, 'fusionPlant', 3, 0)).toBe('notEnoughStars');
    s.factions[0].stars = 500;
    ok(s, { type: 'wonder', kind: 'fusionPlant', x: 3, y: 3 });
    const plant = wonderOf(s, 0);
    expect([tile(s, 4, 3).wonderOf, tile(s, 3, 4).wonderOf, tile(s, 4, 4).wonderOf]).toEqual([plant.id, plant.id, plant.id]);
    expect(tile(s, 3, 3).wonderOf ?? null).toBeNull();
    // kein Durchgang, kein Bau / no passage, no building
    const inf = addUnit(s, 'infantry', 0, 5, 4);
    expect(reachable(s, inf).some((r) => r.x === 4 && r.y === 4)).toBe(false);
    expect(applyCommand(s, { type: 'build', building: 'researchCenter', x: 4, y: 4 }).ok).toBe(false);
    // Zerstoerung gibt die Felder frei / destruction releases the tiles
    actAs(s, 1);
    plant.hp = 1;
    const att = addUnit(s, 'infantry', 1, 2, 3);
    ok(s, { type: 'attack', unit: att.id, target: plant.id });
    expect(s.units.some((u) => u.id === plant.id)).toBe(false);
    expect([tile(s, 4, 3).wonderOf, tile(s, 3, 4).wonderOf, tile(s, 4, 4).wonderOf].every((w) => !w)).toBe(true);
  });

  it('Portal und Waal: freies Land im eigenen Gebiet / portal and Waal: free land in own territory', () => {
    const s = game('zyrr', 'dravon');
    giveTech(s, 0); giveTech(s, 1);
    expect(wonderCheck(s, 0, 'portal', 2, 2)).toBe('invalidTile');
    expect(wonderCheck(s, 0, 'portal', 6, 6)).toBe('notInTerritory');
    setTerrain(s, 3, 3, 'shallow');
    expect(wonderCheck(s, 0, 'portal', 3, 3)).toBe('invalidTile');
    expect(wonderCheck(s, 0, 'portal', 1, 3)).toBe('ok');
    expect(wonderCheck(s, 1, 'waal', 7, 7)).toBe('ok');
  });
});

describe('Fortschritt und Sieg / progress and victory', () => {
  const expectWin = (s: GameState, f: number, ev?: GameEvent[]) => {
    expect(s.over).toBe(true);
    expect(s.winner).toBe(f);
    expect(s.victory).toEqual({ kind: 'faction', faction: s.factions[f].id });
    if (ev) expect(ev.some((e) => e.t === 'gameOver' && e.victory?.kind === 'faction')).toBe(true);
  };

  it('Portal: 9 Runden Bau, 10 Runden Aufladen, dann Sieg der Zyrr / portal: 9 rounds build, 10 charge, then Zyrr win', () => {
    expect(WONDERS.phases.portal).toEqual([9, 10]);
    const s = game('zyrr');
    giveTech(s, 0);
    const r = ok(s, { type: 'wonder', kind: 'portal', x: 3, y: 3 });
    expect(r.events.some((e) => e.t === 'wonder' && e.what === 'started')).toBe(true);
    const p = wonderOf(s, 0);
    rounds(s, 0, 8);
    expect(p.wonder).toEqual({ stage: 0, progress: 8 });
    rounds(s, 0, 1);
    expect(p.wonder).toEqual({ stage: 1, progress: 0 });
    expect(victoryStatus(s, 0).phase).toBe('charge');
    rounds(s, 0, 9);
    expect(s.over).toBe(false);
    expect(victoryStatus(s, 0)).toMatchObject({ phase: 'charge', have: 9, need: 10, roundsLeft: 1 });
    endTurn(s);
    const last = applyCommand(s, { type: 'endTurn' });
    expectWin(s, 0, last.events);
  });

  it('Hacker-Relais: 8 + 9 Runden / hacker relay: 8 + 9 rounds', () => {
    expect(WONDERS.phases.hackRelay).toEqual([8, 9]);
    const s = game('nexus');
    giveTech(s, 0);
    setTerrain(s, 3, 3, 'mountain');
    ok(s, { type: 'wonder', kind: 'hackRelay', x: 3, y: 3 });
    rounds(s, 0, 8);
    expect(wonderOf(s, 0).wonder).toEqual({ stage: 1, progress: 0 });
    expect(victoryStatus(s, 0).phase).toBe('hack');
    rounds(s, 0, 8);
    expect(s.over).toBe(false);
    rounds(s, 0, 1);
    expectWin(s, 0);
  });

  it('Fusionskraftwerk: 14 Runden / fusion plant: 14 rounds', () => {
    expect(WONDERS.phases.fusionPlant).toEqual([14]);
    const s = game('velkar');
    giveTech(s, 0);
    ok(s, { type: 'wonder', kind: 'fusionPlant', x: 3, y: 3 });
    rounds(s, 0, 13);
    expect(s.over).toBe(false);
    expect(wonderOf(s, 0).wonder).toEqual({ stage: 0, progress: 13 });
    rounds(s, 0, 1);
    expectWin(s, 0);
  });

  it('Waal: nach 8 Runden schussbereit, bewegt sich nie, nach 16 Runden Sieg / Waal: armed after 8 rounds, never moves, wins after 16', () => {
    const s = game('dravon');
    giveTech(s, 0);
    ok(s, { type: 'wonder', kind: 'waal', x: 3, y: 3 });
    const w = wonderOf(s, 0);
    expect(w.hp).toBe(WONDERS.waalBuildHp);
    const enemy = addUnit(s, 'infantry', 1, 5, 3);
    rounds(s, 0, 1);
    expect(attackTargets(s, w)).toHaveLength(0);
    fails(s, { type: 'attack', unit: w.id, target: enemy.id }, 'cannotAttack');
    fails(s, { type: 'move', unit: w.id, to: { x: 3, y: 4 } }, 'unreachable');
    rounds(s, 0, 7);
    expect(w.wonder).toEqual({ stage: 1, progress: 0 });
    expect(w.maxHp).toBe(WONDERS.waalArmedHp);
    expect(attackTargets(s, w).map((u) => u.id)).toContain(enemy.id);
    fails(s, { type: 'move', unit: w.id, to: { x: 3, y: 4 } }, 'unreachable');
    ok(s, { type: 'attack', unit: w.id, target: enemy.id });
    rounds(s, 0, 7);
    expect(s.over).toBe(false);
    rounds(s, 0, 1);
    expectWin(s, 0);
  });

  it('Erdkernbohrer: von einem Propheten im Feld gerufen, 14 Runden Stillstand / earth-core drill: called up in the field by a prophet, 14 rounds standing still', () => {
    expect(WONDERS.drillRounds).toBe(14);
    const s = game('vesper');
    const hq = s.cities[0];
    // der Kult bildet nichts in Staedten aus, auch den Bohrer nicht / the cult trains nothing in cities, not the drill either
    expect(trainCheck(s, hq, 'coreDrill')).toBe('cultRecruit');
    s.factions[0].techs.push('camouflage');
    const p = addUnit(s, 'prophet', 0, 4, 4);
    const p2 = addUnit(s, 'prophet', 0, 5, 5);
    expect(recruitCheck(s, 0, p.id, 'coreDrill', 4, 5)).toBe('techMissing');
    giveTech(s, 0);
    // nur Propheten rufen den Bohrer, nur einer zugleich / only prophets call up the drill, only one at a time
    const z = addUnit(s, 'zealot', 0, 6, 6);
    expect(recruitCheck(s, 0, z.id, 'coreDrill', 6, 7)).toBe('invalid');
    ok(s, { type: 'recruit', unit: p.id, unitType: 'coreDrill', x: 4, y: 5 });
    const d = wonderOf(s, 0);
    expect(d.type).toBe('coreDrill');
    expect(recruitCheck(s, 0, p2.id, 'coreDrill', 5, 6)).toBe('alreadyBuilt');
    // zaehlt nicht zum Kult-Limit / does not count towards the cult cap
    expect(cultUnits(s, 0).some((u) => u.id === d.id)).toBe(false);
    rounds(s, 0, 2);
    expect(d.stillRounds).toBe(2);
    // Bewegung setzt zurueck / moving resets
    ok(s, { type: 'move', unit: d.id, to: { x: 3, y: 5 } });
    expect(d.stillRounds).toBe(0);
    rounds(s, 0, 1);
    expect(d.stillRounds).toBe(0);
    rounds(s, 0, 13);
    expect(d.stillRounds).toBe(13);
    expect(s.over).toBe(false);
    rounds(s, 0, 1);
    expectWin(s, 0);
  });
});

describe('Unterbrechung / interruption', () => {
  /** Wunder bauen, n Runden laufen lassen, dann von Fraktion 1 angreifen / build a wonder, run n rounds, then attack from faction 1 */
  function attackAfter(id: FactionId, kind: WonderKind | 'coreDrill', n: number) {
    const s = game(id);
    giveTech(s, 0);
    if (kind === 'hackRelay') setTerrain(s, 3, 3, 'mountain');
    if (kind === 'coreDrill') { s.factions[0].techs.push('camouflage'); const p = addUnit(s, 'prophet', 0, 2, 3); ok(s, { type: 'recruit', unit: p.id, unitType: 'coreDrill', x: 3, y: 3 }); }
    else ok(s, { type: 'wonder', kind, x: 3, y: 3 });
    const w = wonderOf(s, 0);
    rounds(s, 0, n);
    if (kind === 'coreDrill' && (w.x !== 3 || w.y !== 3)) { w.x = 3; w.y = 3; }
    endTurn(s); // Fraktion 1 am Zug / faction 1 to move
    const att = addUnit(s, 'infantry', 1, 4, 4);
    const r = ok(s, { type: 'attack', unit: att.id, target: w.id });
    return { s, w, r };
  }

  it('Portal: laufende Phase auf 0, fertiger Bau bleibt / portal: current phase to 0, finished construction is kept', () => {
    const a = attackAfter('zyrr', 'portal', 5);
    expect(a.w.wonder).toEqual({ stage: 0, progress: 0 });
    expect(a.r.events.some((e) => e.t === 'wonder' && e.what === 'interrupted')).toBe(true);
    const b = attackAfter('zyrr', 'portal', 11);
    expect(b.w.wonder).toEqual({ stage: 1, progress: 0 });
  });

  it('Fusionskraftwerk und Bohrer verlieren den Fortschritt / fusion plant and drill lose their progress', () => {
    expect(attackAfter('velkar', 'fusionPlant', 9).w.wonder).toEqual({ stage: 0, progress: 0 });
    expect(attackAfter('vesper', 'coreDrill', 6).w.stillRounds).toBe(0);
  });

  it('Relais verliert die laufende Phase, Waal wird nicht unterbrochen / relay loses the current phase, Waal is not interrupted', () => {
    const r = attackAfter('nexus', 'hackRelay', 5);
    expect(r.w.wonder).toEqual({ stage: 0, progress: 0 });
    expect(r.w.hp).toBeLessThan(r.w.maxHp);
    expect(r.r.events.some((e) => e.t === 'wonder' && e.what === 'interrupted')).toBe(true);
    // fertiger Bau bleibt, das Hacken beginnt von vorn / finished construction is kept, hacking starts over
    expect(attackAfter('nexus', 'hackRelay', 11).w.wonder).toEqual({ stage: 1, progress: 0 });
    expect(attackAfter('dravon', 'waal', 3).w.wonder).toEqual({ stage: 0, progress: 3 });
  });
});

describe('Bedingungen ohne Bauwerk / conditions without a structure', () => {
  it('Korvat: mehr als 40 % aller Staedte, bei wenigen Fraktionen mehr / Korvat: more than 40 % of all cities, more with few factions', () => {
    expect(WONDERS.korvatShare).toBe(0.4);
    const s = game('korvat', 'dravon');
    giveTech(s, 0);
    addCity(s, 5, 0, 0);
    addCity(s, 0, 9, null);
    addCity(s, 10, 3, null); // 5 Staedte, Korvat hat 2 / 5 cities, Korvat owns 2
    // zwei Fraktionen: Anteil 1,6 / 2 = 80 %, also 5 von 5 / two factions: share 80 %, so 5 of 5
    expect(korvatShareFor(s)).toBeCloseTo(0.8, 6);
    rounds(s, 0, 1);
    expect(s.over).toBe(false);
    expect(victoryStatus(s, 0)).toMatchObject({ have: 2, need: 5 });
    s.cities[3].owner = 0; s.cities[4].owner = 0; s.cities[1].owner = 0;
    rounds(s, 0, 1);
    expect(s.winner).toBe(0);
    expect(s.victory).toEqual({ kind: 'faction', faction: 'korvat' });
    // vier Fraktionen: 40 % / four factions: 40 %
    const s4 = { ...s, factions: [...s.factions, s.factions[1], s.factions[1]] } as typeof s;
    expect(korvatShareFor(s4)).toBe(0.4);
  });

  it('Meridon: ohne Rundenlimit 1000 Sterne in der Kasse / Meridon: 1000 stars in the treasury without a round limit', () => {
    const s = game('meridon', 'korvat', 0);
    giveTech(s, 0);
    s.factions[0].stars = 900;
    rounds(s, 0, 1);
    expect(s.over).toBe(false);
    s.factions[0].stars = WONDERS.meridonStars;
    rounds(s, 0, 1);
    expect(s.winner).toBe(0);
    expect(s.victory?.faction).toBe('meridon');
  });

  it('Meridon: mit Rundenlimit Runden x 11 Sterne, begrenzt auf 300 bis 1000 / Meridon: with a round limit rounds x 11 stars, clamped to 300..1000', () => {
    expect(meridonNeedFor(null)).toBe(WONDERS.meridonStars);
    expect(meridonNeedFor(30)).toBe(330);
    expect(meridonNeedFor(10)).toBe(WONDERS.meridonStarsMin);
    expect(meridonNeedFor(200)).toBe(WONDERS.meridonStars);
    const s = game('meridon', 'korvat', 0, { mode: 'points', roundLimit: 30 });
    giveTech(s, 0);
    expect(victoryStatus(s, 0)).toMatchObject({ need: 330 });
    s.factions[0].stars = 300; // plus Einkommen unter 330 / plus income below 330
    rounds(s, 0, 1);
    expect(s.over).toBe(false);
    s.factions[0].stars = 330;
    rounds(s, 0, 1);
    expect(s.winner).toBe(0);
    expect(s.victory?.faction).toBe('meridon');
  });

  it('Alvenia: Voelkerbund zaehlt 5 Runden, Krieg oder fehlende Botschaft setzt zurueck / League counts 5 rounds, war or missing embassy resets', () => {
    expect(WONDERS.alveniaRounds).toBe(5);
    const s = blankGame({ factions: ['alvenia', 'korvat', 'dravon'], stars: 50 });
    addCity(s, 2, 2, 0, { hq: true }); addCity(s, 8, 8, 1, { hq: true }); addCity(s, 2, 8, 2, { hq: true });
    giveTech(s, 0);
    const peace = (a: number, b: number) => { s.factions[a].relations[b] = 'peace'; s.factions[b].relations[a] = 'peace'; };
    peace(0, 1); peace(0, 2);
    s.factions[0].embassies = [1, 2];
    rounds(s, 0, 4);
    expect(s.factions[0].league).toBe(4);
    // Krieg setzt zurueck / war resets
    s.factions[0].relations[2] = 'war'; s.factions[2].relations[0] = 'war';
    rounds(s, 0, 1);
    expect(s.factions[0].league).toBe(0);
    peace(0, 2);
    // fehlende Botschaft setzt zurueck / a missing embassy resets
    rounds(s, 0, 2);
    expect(s.factions[0].league).toBe(2);
    s.factions[0].embassies = [1];
    rounds(s, 0, 1);
    expect(s.factions[0].league).toBe(0);
    s.factions[0].embassies = [1, 2];
    rounds(s, 0, 4);
    expect(s.over).toBe(false);
    rounds(s, 0, 1);
    expect(s.winner).toBe(0);
    expect(s.victory?.faction).toBe('alvenia');
  });

  it('Alvenia braucht mindestens zwei bekannte Fraktionen / Alvenia needs at least two known factions', () => {
    const s = game('alvenia', 'korvat', 50, { contacts: false });
    giveTech(s, 0);
    s.factions[0].contacts = [1];
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    s.factions[0].embassies = [1];
    rounds(s, 0, 7);
    expect(s.factions[0].league).toBe(0);
    expect(s.over).toBe(false);
  });
});

describe('Regeln rund um Wunder / rules around wonders', () => {
  it('kein Sold, kein Stadtlimit, nicht bekehrbar / no upkeep, no city limit, not convertible', () => {
    const s = game('zyrr', 'alvenia');
    giveTech(s, 0);
    ok(s, { type: 'wonder', kind: 'portal', x: 3, y: 3 });
    const p = wonderOf(s, 0);
    expect(unitUpkeep(p)).toBe(0);
    expect(paidUnits(s, 0).some((u) => u.id === p.id)).toBe(false);
    s.factions[1].techs.push('cybernetics');
    const medic = addUnit(s, 'medic', 1, 4, 3);
    expect(convertTargets(s, medic)).toHaveLength(0);
  });

  it('Fraktionssiege aus: kein Bau, kein Sieg / faction victories off: no building, no victory', () => {
    const s = blankGame({ factions: ['zyrr', 'meridon'], stars: 500 });
    s.config.factionVictory = false;
    addCity(s, 2, 2, 0, { hq: true, radius: 2 });
    addCity(s, 8, 8, 1, { hq: true, radius: 2 });
    fails(s, { type: 'research', tech: 'dimensionalRift' }, 'invalid');
    giveTech(s, 0); giveTech(s, 1);
    fails(s, { type: 'wonder', kind: 'portal', x: 3, y: 3 }, 'invalid');
    // Wunder aus dem Spielstand schreitet nicht fort / a wonder from the state does not progress
    const p = addUnit(s, 'portal', 0, 3, 3);
    p.wonder = { stage: 1, progress: 7 };
    s.factions[1].stars = 5000;
    rounds(s, 0, 3);
    expect(s.over).toBe(false);
    expect(p.wonder).toEqual({ stage: 1, progress: 7 });
    expect(techVisible(s, 0, 'dimensionalRift')).toBe(false);
  });

  it('alte Spielstaende ohne Schalter: aus; neue Partien: an / old saves without the switch: off; new games: on', () => {
    expect(defaultConfig().factionVictory).toBe(true);
    const fresh = game('meridon');
    expect(fresh.config.factionVictory).toBe(true);
    // Spielstand von vor den Fraktionssiegen: beim Laden aus / save from before faction victories: off when loaded
    const old = game('meridon');
    delete old.config.factionVictory;
    const s = migrateState(JSON.parse(JSON.stringify(old)));
    expect(s.config.factionVictory).toBe(false);
    giveTech(s, 0);
    s.factions[0].stars = 2000;
    rounds(s, 0, 1);
    expect(s.victory?.kind).not.toBe('faction');
  });

  it('Endlos weiter nach Fraktionssieg schaltet Fraktionssiege ab / continuing endlessly after a faction victory turns them off', () => {
    const s = game('meridon', 'korvat');
    giveTech(s, 0);
    s.factions[0].stars = 2000;
    rounds(s, 0, 1);
    expect(s.over).toBe(true);
    continueEndless(s);
    expect(s.over).toBe(false);
    expect(s.victory).toBeUndefined();
    rounds(s, 0, 2);
    expect(s.over).toBe(false);
  });

  it('Punkte- und Eroberungssieg melden ihre Art / points and conquest victories report their kind', () => {
    const p = game('korvat', 'dravon', 0, { roundLimit: 2 });
    endTurn(p);
    const r = applyCommand(p, { type: 'endTurn' });
    expect(p.over).toBe(true);
    expect(p.victory?.kind).toBe('points');
    expect(r.events.find((e) => e.t === 'gameOver')).toMatchObject({ victory: { kind: 'points' } });
    const c = game('korvat', 'dravon');
    const inf = addUnit(c, 'infantry', 0, 8, 8);
    c.units = c.units.filter((u: Unit) => u.owner !== 1);
    ok(c, { type: 'capture', unit: inf.id });
    expect(c.victory).toEqual({ kind: 'conquest', faction: 'korvat' });
  });
});

describe('KI und Wunder / AI and wonders', () => {
  it('greift ein feindliches Wunder bevorzugt an / prefers attacking a hostile wonder', () => {
    const s = game('korvat', 'zyrr');
    s.factions[0].human = false;
    giveTech(s, 1);
    const portal = addUnit(s, 'portal', 1, 4, 4);
    portal.wonder = { stage: 1, progress: 4 };
    addUnit(s, 'grey', 1, 6, 4);
    addUnit(s, 'infantry', 0, 5, 4);
    s.factions[0].explored = s.factions[0].explored.map(() => 1);
    const cmd = planNextCommand(s, 0);
    expect(cmd).toMatchObject({ type: 'attack', target: portal.id });
  });

  it('Prophet ruft den Bohrer im eigenen Gebiet, der Bohrer bleibt stehen / a prophet calls up the drill in own territory, the drill stays', () => {
    const s = game('vesper');
    s.factions[0].human = false;
    s.factions[0].techs.push('camouflage');
    giveTech(s, 0);
    addCity(s, 2, 7, 0);
    addUnit(s, 'prophet', 0, 2, 3);
    addUnit(s, 'zealot', 0, 1, 1);
    let called = 0, moved = 0;
    for (let i = 0; i < 7; i++) {
      untilTurnOf(s, 0);
      for (let k = 0; k < 200 && s.current === 0; k++) {
        const cmd = planNextCommand(s, 0);
        if (cmd.type === 'recruit' && cmd.unitType === 'coreDrill') called++;
        const d = s.units.find((u) => u.type === 'coreDrill');
        if (cmd.type === 'move' && d && cmd.unit === d.id) moved++;
        applyCommand(s, cmd);
        if (cmd.type === 'endTurn') break;
      }
    }
    const d = wonderOf(s, 0);
    expect(called).toBe(1);
    expect(moved).toBeLessThanOrEqual(1);
    expect(s.tiles[d.y * s.size + d.x].cityId).toBeNull();
    expect(d.stillRounds).toBeGreaterThanOrEqual(4);
  });

  /** KI-Zug von Fraktion f spielen, Befehle sammeln / play faction f's AI turn and collect its commands */
  function aiTurn(s: GameState, f: number) {
    const cmds = [];
    for (let k = 0; k < 300 && s.current === f && !s.over; k++) {
      const cmd = planNextCommand(s, f);
      cmds.push(cmd);
      applyCommand(s, cmd);
      if (cmd.type === 'endTurn') break;
    }
    return cmds;
  }

  it('Bohrer erst ab zwei eigenen Staedten / drill only from two own cities', () => {
    const s = game('vesper', 'korvat', 500);
    s.factions[0].human = false;
    s.factions[0].techs.push('camouflage');
    giveTech(s, 0);
    addUnit(s, 'prophet', 0, 2, 3);
    const drill = (c: { type: string; unitType?: string }) => c.type === 'recruit' && c.unitType === 'coreDrill';
    expect(aiTurn(s, 0).some(drill)).toBe(false);
    untilTurnOf(s, 0);
    addCity(s, 2, 7, 0);
    s.factions[0].stars = 500;
    for (const u of s.units) if (u.owner === 0) u.recruitReady = 0;
    expect(aiTurn(s, 0).some(drill)).toBe(true);
  });

  it('Voelkerbund: Rivalen brechen den Frieden erst spaet und nur mit Uebermacht / League: rivals break peace only late and only when much stronger', () => {
    const setup = (league: number, rivalInf: number) => {
      const s = blankGame({ factions: ['korvat', 'alvenia', 'dravon'], stars: 0, mode: 'points', roundLimit: 30 });
      addCity(s, 2, 2, 0, { hq: true }); addCity(s, 8, 8, 1, { hq: true }); addCity(s, 2, 8, 2, { hq: true });
      revealAll(s, 0);
      s.factions[0].human = false;
      s.factions[1].techs.push('leagueCharter');
      for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) { s.factions[a].relations[b] = 'peace'; s.factions[b].relations[a] = 'peace'; }
      s.factions[1].embassies = [0, 2];
      s.factions[1].league = league;
      for (let i = 0; i < rivalInf; i++) addUnit(s, 'infantry', 0, 1 + i, 1);
      addUnit(s, 'infantry', 1, 8, 7);
      return s;
    };
    const breaks = (s: GameState) => aiTurn(s, 0).some((c) => c.type === 'diplomacy' && c.action === 'announceBreak' && c.target === 1);
    expect(WONDERS.aiNearVictoryLeague).toBeGreaterThan(WONDERS.aiNearVictory);
    // 3 von 5: noch kein Bruch / 3 of 5: no break yet
    expect(breaks(setup(3, 4))).toBe(false);
    // 4 von 5 und deutlich staerker: Bruch / 4 of 5 and clearly stronger: break
    expect(breaks(setup(4, 4))).toBe(true);
    // 4 von 5, aber nicht stark genug: kein Bruch / 4 of 5 but not strong enough: no break
    expect(breaks(setup(4, 0))).toBe(false);
  });

  for (const ids of [['zyrr', 'nexus', 'velkar', 'dravon'], ['vesper', 'korvat', 'alvenia', 'meridon']] as FactionId[][]) {
    it(`KI-Partie ${ids.join('/')}, 40 Runden ohne Fehlbefehl / AI game, 40 rounds without failed commands`, () => {
      const s = createGame(defaultConfig({
        seed: 21, size: 14, mode: 'sandbox', mapType: 'continent', roundLimit: null,
        factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' as const })),
      }));
      let failed = 0, maxTurn = 0;
      const seen = new Set<string>();
      while (!s.over && s.round <= 40) {
        const f = s.current;
        const t0 = performance.now();
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          const res = applyCommand(s, cmd);
          if (!res.ok) failed++;
          for (const e of res.events) if (e.t === 'wonder' || e.t === 'research') seen.add(e.t === 'wonder' ? `wonder:${e.what}` : `research:${e.tech}`);
          if (cmd.type === 'endTurn' && res.ok) break;
        }
        maxTurn = Math.max(maxTurn, performance.now() - t0);
      }
      expect(failed).toBe(0);
      expect(maxTurn).toBeLessThan(AI.maxMillis * 1.5);
      // mindestens eine Fraktion verfolgt ihre Siegbedingung, oder die Partie endet vorher durch Eroberung
      // at least one faction pursues its victory condition, or the game ends earlier by conquest
      expect(ids.some((id) => seen.has(`research:${VICTORY_TECH[id]}`)) || s.victory?.kind === 'conquest').toBe(true);
    }, 180_000);
  }
});
