/**
 * Goettlicher Funke (Alvenia): Riesengeschuetz mit Flaechenschuss auf 2x2 Felder, Reichweite 5 und Mindestabstand 2,
 * Schaden je Ziel mit eigenem Trefferglueck, eigene Einheiten in der Flaeche, Beobachter, nur aus dem Stand, Nachladen,
 * Limit, nur Alvenia, KI (Kauf, Schuss, Stellung) und Modell, Rolle und Texte.
 * Divine Spark (Alvenia): giant gun with an area shot on 2x2 tiles, range 5 and minimum distance 2, damage per target with
 * its own hit luck, own units in the area, spotter, standstill only, reload, limit, Alvenia only, AI (purchase, shot,
 * position) and model, role and texts.
 */
import { describe, expect, it } from 'vitest';
import {
  addSighting, applyCommand, createGame, defaultConfig, hitDamage, rosterUnits, siteOf, sparkAnchorFor, sparkArea, sparkCheck, sparkGeometry, sparkPreview, sparkReach,
  trainCheck, unitCost, type Command, type GameEvent, type GameState,
} from '../src/core';
import { AI, ALVENIA_UNITS, HIT_KINDS, ORBITAL, PRODUCTION, ROSTER_EXTRA, SILO, SPARK, UNITS, UPKEEP, VEHICLE_UNITS, type FactionId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { buildCtx } from '../src/ai/analysis';
import { sparkShotValue } from '../src/ai/divineSpark';
import { getUnitQuality, setUnitQuality, unitGeometry, unitTriLimit } from '../src/render/models';
import { has as hasText, setLanguage, t } from '../src/i18n/i18n';
import { hasIcon } from '../src/ui/icons';
import { UNIT_ROLE, unitRoleIcon } from '../src/ui/unitRoles';
import { addCity, addUnit, blankGame, fails, giveSites, ok, revealAll, unit } from './helpers';

/** Alvenia gegen eine Fraktion, beide mit Hauptquartier, alles aufgedeckt / Alvenia against one faction, both with HQs, all revealed */
function alvVs(b: FactionId = 'korvat', o: Parameters<typeof blankGame>[0] = {}): GameState {
  const s = blankGame({ factions: ['alvenia', b], stars: 300, ...o });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}
type SparkEv = Extract<GameEvent, { t: 'divineSpark' }>;
const sparkEv = (ev: GameEvent[]) => ev.find((e) => e.t === 'divineSpark') as SparkEv;
const fire = (u: { id: number }, x: number, y: number): Command => ({ type: 'divineSpark', unit: u.id, x, y });

describe('Goettlicher Funke: Werte / Divine Spark: stats', () => {
  it('Alvenia-Einheit aus der Giesserei, Reichweite 7, Flaeche 2x2 (4 Felder), Schaden unter dem Silo, gegen Fahrzeuge deutlich mehr / Alvenia unit from the foundry, range 7, area 2x2 (4 tiles), damage below the silo, much more against vehicles', () => {
    const st = UNITS.divineSpark;
    expect(st.faction).toBe('alvenia');
    expect(ALVENIA_UNITS).toContain('divineSpark');
    expect(ROSTER_EXTRA.alvenia).toContain('divineSpark');
    expect(PRODUCTION.units.foundry).toContain('divineSpark');
    expect(siteOf('divineSpark')).toBe('foundry');
    expect(VEHICLE_UNITS).toContain('divineSpark');
    // Spielerwunsch: Reichweite 5 Felder, Schadenswirkung 4 Felder; aufgewertet: Reichweite +2 / player request: range 5 tiles, damage effect 4 tiles; upgraded: range +2
    expect(SPARK.range).toBe(7);
    expect(SPARK.area.w * SPARK.area.h).toBe(4);
    expect(SPARK.area).toEqual({ w: 2, h: 2 });
    expect(SPARK.minRange).toBeGreaterThanOrEqual(2);
    // nie staerker als die schwerste vorhandene Flaechenwaffe (Raketensilo) / never stronger than the heaviest existing area weapon (rocket silo)
    expect(SPARK.damage).toBeLessThanOrEqual(SILO.damage);
    expect(SPARK.damage).toBeGreaterThan(ORBITAL.damage);
    // Aufwertung: deutlich mehr Schaden gegen Fahrzeuge (mindestens doppelt) / upgrade: much more damage against vehicles (at least double)
    expect(SPARK.vehicleDamage).toBeGreaterThanOrEqual(2 * SPARK.damage);
    // Nachteile: langsam, kein gewoehnlicher Angriff, kaum Verteidigung, teuer, Limit / drawbacks: slow, no ordinary attack, hardly any defence, expensive, limit
    expect(st.move).toBe(1);
    expect(st.attack).toBe(0);
    expect(st.range).toBe(0);
    expect(st.defense).toBeLessThanOrEqual(0.5);
    expect(st.abilities).toContain('divineSpark');
    expect(st.abilities).not.toContain('dash');
    expect(st.cost!).toBeGreaterThan(UNITS.sunLance.cost!);
    expect(UPKEEP.flat.divineSpark!).toBeGreaterThan(UPKEEP.flat.tank!);
    // Aufwertung: feuert jede Runde / upgrade: fires every round
    expect(SPARK.cooldown).toBe(0);
    expect(SPARK.max).toBeGreaterThanOrEqual(1);
  });

  it('nur Alvenia baut ihn, in der Giesserei, hoechstens SPARK.max zugleich / only Alvenia builds it, in the foundry, at most SPARK.max at a time', () => {
    const s = alvVs();
    const hq = s.cities.find((c) => c.owner === 0)!;
    expect(rosterUnits(s, 0)).toContain('divineSpark');
    expect(trainCheck(s, hq, 'divineSpark')).toBe('buildingMissing');
    giveSites(hq, 'foundry');
    expect(trainCheck(s, hq, 'divineSpark')).toBe('ok');
    ok(s, { type: 'train', city: hq.id, unitType: 'divineSpark' });
    expect(s.factions[0].stars).toBe(300 - unitCost(s, 0, 'divineSpark')!);
    // Limit: weitere Geschuetze im Feld zaehlen mit / limit: further guns in the field count
    for (let i = 1; i < SPARK.max; i++) addUnit(s, 'divineSpark', 0, 3 + i, 3);
    const c2 = giveSites(addCity(s, 1, 6, 0), 'trainingCamp', 'foundry');
    expect(trainCheck(s, c2, 'divineSpark')).toBe('sparkLimit');
    fails(s, { type: 'train', city: c2.id, unitType: 'divineSpark' }, 'sparkLimit');
    // andere Fraktionen nie / other factions never
    for (const f of ['korvat', 'dravon', 'meridon', 'velkar'] as FactionId[]) {
      const o = blankGame({ factions: [f, 'alvenia'], stars: 300 });
      const c = giveSites(addCity(o, 3, 3, 0, { hq: true }), 'foundry');
      expect(rosterUnits(o, 0), f).not.toContain('divineSpark');
      expect(trainCheck(o, c, 'divineSpark'), f).toBe('invalid');
    }
  });
});

describe('Goettlicher Funke: Reichweite und Flaeche / Divine Spark: range and area', () => {
  it('ganze Flaeche in 2 bis 7 Feldern: Reichweite 7 drin, 8 draussen, Nachbarfelder gesperrt / whole area within 2 to 7 tiles: range 7 in, 8 out, adjacent tiles locked', () => {
    const s = alvVs();
    const g = { x: 1, y: 5 };
    // Ecke (7, 4): Felder in Abstand 6 und 7 / corner (7, 4): tiles at distance 6 and 7
    expect(sparkGeometry(s, g, 7, 4)).toBe('ok');
    expect(Math.max(...sparkArea(7, 4).map((p) => Math.max(Math.abs(p.x - g.x), Math.abs(p.y - g.y))))).toBe(7);
    // Ecke (8, 4): ein Feld in Abstand 8 / corner (8, 4): one tile at distance 8
    expect(sparkGeometry(s, g, 8, 4)).toBe('outOfRange');
    // Mindestabstand: Ecke (3, 5) liegt in Abstand 2 und 3 (ok), Ecke (2, 5) beruehrt ein Nachbarfeld / minimum distance: corner (3, 5) at 2 and 3 (ok), corner (2, 5) touches an adjacent tile
    expect(sparkGeometry(s, g, 3, 5)).toBe('ok');
    expect(sparkGeometry(s, g, 2, 5)).toBe('sparkTooClose');
    expect(sparkGeometry(s, g, 0, 4)).toBe('sparkTooClose');
    // ausserhalb der Karte / off the map
    expect(sparkGeometry(s, g, s.size - 1, 4)).toBe('invalidTile');
    // Wirkungsbereich: alle Felder in Abstand 2 bis 7 / reach: all tiles at distance 2 to 7
    const reach = sparkReach(s, g);
    expect(reach.every((p) => { const d = Math.max(Math.abs(p.x - g.x), Math.abs(p.y - g.y)); return d >= 2 && d <= 7; })).toBe(true);
    expect(reach.some((p) => p.x === 8 && p.y === 5)).toBe(true);
    expect(reach.some((p) => p.x === 9 && p.y === 5)).toBe(false);
    expect(reach.some((p) => p.x === 2 && p.y === 5)).toBe(false);
  });

  it('angetipptes Feld liegt in der Flaeche: am Rand der Reichweite dreht die Flaeche nach innen / the tapped tile lies in the area: at the edge of the range the area turns inwards', () => {
    const s = alvVs();
    const g = { x: 1, y: 5 };
    // (8, 5) ist 7 entfernt: Ecke (8, 5) waere zu weit, also (7, 5) / (8, 5) is 7 away: corner (8, 5) would be too far, so (7, 5)
    expect(sparkAnchorFor(s, g, 8, 5)).toEqual({ x: 7, y: 5 });
    expect(sparkAnchorFor(s, g, 4, 6)).toEqual({ x: 4, y: 6 });
    for (const p of sparkReach(s, g)) {
      const a = sparkAnchorFor(s, g, p.x, p.y);
      expect(sparkArea(a.x, a.y).some((q) => q.x === p.x && q.y === p.y), `${p.x},${p.y}`).toBe(true);
      expect(sparkGeometry(s, g, a.x, a.y), `${p.x},${p.y}`).toBe('ok');
    }
  });

  it('trifft genau die vier Felder mit vollem Schaden, eigene Einheiten eingeschlossen / hits exactly the four tiles with full damage, own units included', () => {
    const s = alvVs();
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    // Beobachter / spotter
    addUnit(s, 'lightWarden', 0, 3, 3);
    const inside = [addUnit(s, 'tank', 1, 4, 4), addUnit(s, 'infantry', 1, 5, 4, { hp: SPARK.damage }), addUnit(s, 'mg', 1, 4, 5), addUnit(s, 'lightWarden', 0, 5, 5, { hp: SPARK.damage - 1 })];
    const outside = [addUnit(s, 'infantry', 1, 6, 4), addUnit(s, 'infantry', 1, 4, 6), addUnit(s, 'infantry', 1, 3, 4)];
    const pre = sparkPreview(s, gun, 4, 4);
    expect(pre.check).toBe('ok');
    expect(pre.hits.filter((h) => h.own)).toHaveLength(1);
    const r = ok(s, fire(gun, 4, 4));
    const e = sparkEv(r.events);
    expect(e.tiles).toEqual([{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }]);
    expect(e.hits.map((h) => h.unit).sort()).toEqual(inside.map((u) => u.id).sort());
    // Panzer bekommen den Fahrzeugschaden, Fusstruppen den Grundschaden / tanks take the vehicle damage, foot troops the base damage
    for (const h of e.hits) expect(h.dmg).toBe(h.unit === inside[0].id ? SPARK.vehicleDamage : SPARK.damage);
    expect(unit(s, inside[2].id)!.hp).toBe(UNITS.mg.hp - SPARK.damage);
    // angeschlagene Ziele fallen: der Gegner zaehlt als Abschuss, die eigene Einheit nicht / battered targets fall: the enemy counts as a kill, the own unit does not
    expect(unit(s, inside[1].id)).toBeUndefined();
    expect(unit(s, inside[3].id)).toBeUndefined();
    for (const u of outside) expect(unit(s, u.id)!.hp).toBe(UNITS[u.type].hp);
    expect(s.factions[0].kills).toBe(1);
    expect(gun.kills).toBe(1);
    // keine Deckung: Stadt oder Wald aendern nichts, Verteidigung zaehlt nicht / no cover: city or forest change nothing, defence does not count
    expect(unit(s, inside[0].id)!.hp).toBe(UNITS.tank.hp - SPARK.vehicleDamage);
  });

  it('Trefferglueck: jedes Ziel wuerfelt einzeln, Schaden folgt der Trefferart / hit luck: every target rolls on its own, damage follows the hit kind', () => {
    const s = alvVs('korvat', { hitChance: true });
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    addUnit(s, 'lightWarden', 0, 3, 3);
    const kinds = new Set<string>();
    for (let i = 0; i < 25; i++) {
      for (const u of s.units.filter((o) => o.owner === 1)) s.units.splice(s.units.indexOf(u), 1);
      const targets = [addUnit(s, 'tank', 1, 4, 4), addUnit(s, 'tank', 1, 5, 4), addUnit(s, 'tank', 1, 4, 5), addUnit(s, 'tank', 1, 5, 5)];
      gun.attacked = false; gun.exhausted = false; gun.moved = false; delete gun.sparkReady;
      const e = sparkEv(ok(s, fire(gun, 4, 4)).events);
      expect(e.hits).toHaveLength(4);
      for (const h of e.hits) {
        expect(HIT_KINDS).toContain(h.hit);
        expect(h.dmg).toBe(hitDamage(SPARK.vehicleDamage, h.hit!));
        const tu = targets.find((u) => u.id === h.unit)!;
        expect(unit(s, tu.id)!.hp).toBe(UNITS.tank.hp - h.dmg);
        kinds.add(h.hit!);
      }
    }
    // verschiedene Trefferarten im selben Schuss moeglich / different hit kinds possible in the same shot
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it('kein gewoehnlicher Angriff, kein Gegenschlag gegen Angreifer / no ordinary attack, no return fire against attackers', () => {
    const s = alvVs();
    const gun = addUnit(s, 'divineSpark', 0, 4, 4);
    const inf = addUnit(s, 'infantry', 1, 5, 4);
    fails(s, { type: 'attack', unit: gun.id, target: inf.id });
    s.current = 1;
    const r = ok(s, { type: 'attack', unit: inf.id, target: gun.id });
    const a = r.events.find((e) => e.t === 'attack') as Extract<GameEvent, { t: 'attack' }>;
    expect(a.ret).toBe(0);
    expect(unit(s, inf.id)!.hp).toBe(UNITS.infantry.hp);
  });
});

describe('Goettlicher Funke: Bedingungen / Divine Spark: conditions', () => {
  it('Beobachter noetig: ohne eigene Einheit oder Stadt nahe der Flaeche kein Schuss, Sichtung reicht / spotter needed: no shot without an own unit or city near the area, a sighting suffices', () => {
    const s = alvVs();
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    addUnit(s, 'infantry', 1, 5, 5);
    // das Geschuetz selbst zaehlt nicht / the gun itself does not count
    expect(sparkCheck(s, gun, 4, 4)).toBe('noSpotter');
    fails(s, fire(gun, 4, 4), 'noSpotter');
    addSighting(s, 0, 6, 6, 1, 2);
    expect(sparkCheck(s, gun, 4, 4)).toBe('ok');
    s.factions[0].sightings = [];
    const spotter = addUnit(s, 'lightWarden', 0, 8, 3);
    expect(sparkCheck(s, gun, 4, 4)).toBe('noSpotter');
    spotter.x = 7; spotter.y = 3;
    expect(sparkCheck(s, gun, 4, 4)).toBe('ok');
  });

  it('nur aus dem Stand: nach Bewegung kein Schuss, nach dem Schuss keine Bewegung / standstill only: no shot after moving, no move after the shot', () => {
    const s = alvVs();
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    addUnit(s, 'lightWarden', 0, 4, 2);
    addUnit(s, 'infantry', 1, 5, 4);
    ok(s, { type: 'move', unit: gun.id, to: { x: 1, y: 4 } });
    expect(sparkCheck(s, gun, 4, 4)).toBe('sparkMoved');
    fails(s, fire(gun, 4, 4), 'sparkMoved');
    const s2 = alvVs();
    const g2 = addUnit(s2, 'divineSpark', 0, 1, 5);
    addUnit(s2, 'lightWarden', 0, 4, 2);
    addUnit(s2, 'infantry', 1, 5, 4);
    ok(s2, fire(g2, 4, 4));
    expect(applyCommand(s2, { type: 'move', unit: g2.id, to: { x: 1, y: 4 } }).ok).toBe(false);
    // frisch ausgebildet: erst im naechsten Zug / freshly trained: only next turn
    const s3 = alvVs();
    const g3 = addUnit(s3, 'divineSpark', 0, 1, 5, { fresh: true });
    addUnit(s3, 'lightWarden', 0, 4, 2);
    expect(sparkCheck(s3, g3, 4, 4)).toBe('fresh');
  });

  it('feuert jede Runde, aber nur einmal je Zug / fires every round, but only once per turn', () => {
    const s = alvVs();
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    addUnit(s, 'lightWarden', 0, 4, 2);
    addUnit(s, 'tank', 1, 5, 4, { hp: 99 });
    const start = s.round;
    ok(s, fire(gun, 4, 4));
    expect(gun.sparkReady).toBe(start + SPARK.cooldown);
    // im selben Zug kein zweiter Schuss / no second shot in the same turn
    expect(sparkCheck(s, gun, 4, 4)).toBe('unitExhausted');
    ok(s, { type: 'endTurn' });
    while (s.current !== 0) ok(s, { type: 'endTurn' });
    expect(s.round).toBe(start + 1);
    // naechste Runde wieder bereit und schiesst / ready again next round and fires
    expect(sparkCheck(s, unit(s, gun.id)!, 4, 4)).toBe('ok');
    ok(s, fire(unit(s, gun.id)!, 4, 4));
  });

  it('Fahrzeuge und Roboter nehmen den Fahrzeugschaden, Fusstruppen den Grundschaden / vehicles and robots take the vehicle damage, foot troops the base damage', () => {
    const s = alvVs('nexus');
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    addUnit(s, 'lightWarden', 0, 4, 2);
    const titan = addUnit(s, 'titan', 1, 4, 4);
    const android = addUnit(s, 'android', 1, 5, 4);
    const pre = sparkPreview(s, gun, 4, 4);
    expect(pre.hits.find((h) => h.unit === titan.id)!.dmg).toBe(SPARK.vehicleDamage);
    expect(pre.hits.find((h) => h.unit === android.id)!.dmg).toBe(SPARK.vehicleDamage);
    const s2 = alvVs();
    const gun2 = addUnit(s2, 'divineSpark', 0, 1, 5);
    addUnit(s2, 'lightWarden', 0, 4, 2);
    const inf = addUnit(s2, 'infantry', 1, 4, 4);
    expect(sparkPreview(s2, gun2, 4, 4).hits.find((h) => h.unit === inf.id)!.dmg).toBe(SPARK.damage);
  });

  it('Frieden sperrt den Schuss, nur Alvenia feuert / peace blocks the shot, only Alvenia fires', () => {
    const s = alvVs();
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    addUnit(s, 'lightWarden', 0, 4, 2);
    addUnit(s, 'infantry', 1, 5, 4);
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    expect(sparkCheck(s, gun, 4, 4)).toBe('peace');
    // bekehrtes Geschuetz in fremder Hand feuert nicht / a converted gun in foreign hands does not fire
    const k = blankGame({ factions: ['korvat', 'alvenia'], stars: 100 });
    revealAll(k, 0);
    const kg = addUnit(k, 'divineSpark', 0, 1, 5);
    addUnit(k, 'infantry', 0, 4, 2);
    addUnit(k, 'infantry', 1, 5, 4);
    expect(sparkCheck(k, kg, 4, 4)).toBe('wrongFaction');
  });
});

describe('Goettlicher Funke: KI / Divine Spark: AI', () => {
  /** Ein KI-Zug der Fraktion 0, alle Befehle muessen gelingen / one AI turn of faction 0, every command must succeed */
  function aiTurn(s: GameState): Command[] {
    const cmds: Command[] = [];
    for (let i = 0; i < 200; i++) {
      const cmd = planNextCommand(s, 0);
      const r = applyCommand(s, cmd);
      expect(r.ok, JSON.stringify(cmd)).toBe(true);
      cmds.push(cmd);
      if (cmd.type === 'endTurn') break;
    }
    return cmds;
  }

  it('feuert auf den Haufen, nicht auf eigene Einheiten / fires at the cluster, not at own units', () => {
    const s = alvVs();
    s.factions[0].human = false;
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    addUnit(s, 'lightWarden', 0, 3, 2);
    // Haufen bei (5..6, 4..5), ein eigener Lichtschuetze steht in (5, 6) / cluster at (5..6, 4..5), an own Light Warden stands at (5, 6)
    addUnit(s, 'tank', 1, 5, 4); addUnit(s, 'mg', 1, 6, 4); addUnit(s, 'infantry', 1, 5, 5);
    const own = addUnit(s, 'lightWarden', 0, 5, 6);
    const best = sparkShotValue(buildCtx(s, 0), gun, 5, 4);
    expect(best.ok).toBe(true);
    expect(best.value).toBeGreaterThan(sparkShotValue(buildCtx(s, 0), gun, 5, 5).value);
    const cmds = aiTurn(s);
    const shot = cmds.find((c) => c.type === 'divineSpark') as Extract<Command, { type: 'divineSpark' }> | undefined;
    expect(shot).toBeDefined();
    expect(sparkArea(shot!.x, shot!.y).some((p) => p.x === own.x && p.y === own.y)).toBe(false);
    expect(unit(s, own.id)!.hp).toBe(UNITS.lightWarden.hp);
    // nach dem Schuss zieht das Geschuetz nicht mehr / after the shot the gun does not move
    expect(unit(s, gun.id)!.x).toBe(1);
  });

  it('kein Schuss bei zu wenig Wert, eigene Einheiten im Haufen schrecken ab / no shot for too little value, own units in the cluster deter', () => {
    const s = alvVs();
    s.factions[0].human = false;
    const gun = addUnit(s, 'divineSpark', 0, 1, 5);
    addUnit(s, 'lightWarden', 0, 3, 2);
    addUnit(s, 'infantry', 1, 5, 4);
    addUnit(s, 'lightWarden', 0, 6, 4); addUnit(s, 'lightWarden', 0, 5, 5); addUnit(s, 'lightWarden', 0, 6, 5);
    const ctx = buildCtx(s, 0);
    for (const [x, y] of [[4, 3], [5, 3], [4, 4], [5, 4]]) {
      const v = sparkShotValue(ctx, gun, x, y);
      if (v.ok && sparkArea(x, y).some((p) => s.units.some((u) => u.owner === 0 && u.x === p.x && u.y === p.y))) expect(v.value, `${x},${y}`).toBeLessThan(SPARK.ai.minValue);
    }
  });

  it('KI-Partie: Alvenia baut den Funken, feuert und kein Befehl scheitert / AI game: Alvenia builds the spark, fires and no command fails', () => {
    // Eroberung wie in der Messung (BALANCING.md, Seed 265 der Reihe): Dravon, Kult, Alvenia / conquest as in the measurement (BALANCING.md, seed 265 of the series)
    const ids: FactionId[] = ['dravon', 'vesper', 'alvenia'];
    const s = createGame(defaultConfig({ seed: 900265, size: 14, mapType: 'continents', mode: 'conquest', roundLimit: null, weather: true, hazards: 'normal', events: true,
      hitChance: true, factionVictory: false, factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));
    const alv = ids.indexOf('alvenia');
    let built = 0, shots = 0, hits = 0, ownHits = 0;
    const errs: string[] = [];
    while (!s.over && s.round <= 80) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const owners = new Map(s.units.map((u) => [u.id, u.owner]));
        const r = applyCommand(s, cmd);
        if (!r.ok) errs.push(`${s.factions[f].id}:${cmd.type}:${r.error}`);
        else for (const e of r.events) {
          if (e.t === 'train' && unit(s, e.unit)?.type === 'divineSpark') { built++; expect(f).toBe(alv); }
          if (e.t === 'divineSpark') {
            shots++;
            hits += e.hits.length;
            ownHits += e.hits.filter((h) => h.unit !== undefined && owners.get(h.unit) === e.faction).length;
            expect(e.faction).toBe(alv);
          }
        }
        if (cmd.type === 'endTurn' && r.ok) break;
      }
      if (s.current === f && !s.over) break;
    }
    expect(errs).toEqual([]);
    expect(built).toBeGreaterThanOrEqual(1);
    expect(shots).toBeGreaterThanOrEqual(3);
    expect(hits).toBeGreaterThan(shots);
    // die KI meidet eigene Einheiten in der Flaeche / the AI avoids own units in the area
    expect(ownHits).toBeLessThanOrEqual(1);
  }, 180_000);
});

describe('Goettlicher Funke: Modell, Rolle, Texte / Divine Spark: model, role, texts', () => {
  it('Modell im Dreiecksbudget, groesser als die Artillerie, Rolle Artillerie / model within the triangle budget, larger than the artillery, artillery role', () => {
    const start = getUnitQuality();
    for (const q of ['high', 'low'] as const) {
      setUnitQuality(q);
      const g = unitGeometry('divineSpark', 'alvenia', null);
      expect(g.getAttribute('position').count / 3).toBeLessThanOrEqual(unitTriLimit(q));
      g.computeBoundingBox();
      const a = unitGeometry('artillery', 'alvenia', null);
      a.computeBoundingBox();
      const area = (b: NonNullable<typeof g.boundingBox>) => (b.max.x - b.min.x) * (b.max.z - b.min.z);
      expect(area(g.boundingBox!)).toBeGreaterThan(area(a.boundingBox!));
      expect(g.boundingBox!.max.y).toBeGreaterThan(a.boundingBox!.max.y);
    }
    setUnitQuality(start);
    expect(UNIT_ROLE.divineSpark).toBe('artillery');
    expect(unitRoleIcon('divineSpark')).toBe(unitRoleIcon('artillery'));
    expect(hasIcon('divineSpark')).toBe(true);
  });

  it('Texte in beiden Sprachen mit Zahlen aus balance.ts / texts in both languages with numbers from balance.ts', () => {
    for (const lang of ['de', 'en'] as const) {
      setLanguage(lang);
      for (const k of ['units.divineSpark', 'unitDesc.divineSpark', 'abilities.divineSpark', 'abilities.divineSparkDesc', 'spark.rule', 'spark.pick', 'spark.title',
        'errors.sparkCooldown', 'errors.sparkMoved', 'errors.sparkTooClose', 'errors.noSpotter', 'errors.sparkLimit', 'factions.alvenia.feature2', 'factions.alvenia.feature2Desc',
        'unitNicknames.korvat.divineSpark', 'unitNicknames.vesper.divineSpark', 'unitNicknames.nexus.divineSpark']) expect(hasText(k), `${lang} ${k}`).toBe(true);
      const desc = t('unitDesc.divineSpark');
      expect(desc).not.toMatch(/\{\w+\}/);
      expect(desc).toContain(String(SPARK.range));
      expect(desc).toContain(`${SPARK.area.w}×${SPARK.area.h}`);
      expect(t('spark.rule')).toContain(String(SPARK.damage));
      expect(t('spark.rule')).not.toMatch(/\{\w+\}/);
    }
    setLanguage('de');
    expect(t('units.divineSpark')).toBe('Göttlicher Funke');
    setLanguage('en');
    expect(t('units.divineSpark')).toBe('Divine Spark');
    setLanguage('de');
  });
});
