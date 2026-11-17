/**
 * Werft der Kuestenstaedte: Schiffe kaufen, leere Transportboote, Einsteigen, Speichern (SHIPYARD).
 * Shipyard of coastal cities: buying ships, empty transport boats, boarding, saving (SHIPYARD).
 */
import { describe, expect, it } from 'vitest';
import {
  attackTargets, isCoastalCity, reachable, rosterShips, score, shipSpawnTile, supportedUnits, trainCheck, unitUpkeep,
} from '../src/core';
import { SHIPYARD, UNITS, type FactionId } from '../src/data/balance';
import { isValidState, migrateState } from '../src/save/save';
import { addCity, addUnit, blankGame, fails, giveSites, ok, setTerrain, unit } from './helpers';

/** Kueste: Land x<=4, Flachwasser x=5..7, Ozean x>=8; Stadt auf (4, 5) / coast: land x<=4, shallow 5..7, ocean >=8; city on (4, 5) */
function coast(factions: FactionId[] = ['meridon', 'dravon']) {
  const s = blankGame({ factions, stars: 500 });
  for (let y = 0; y < 11; y++) for (let x = 5; x < 11; x++) setTerrain(s, x, y, x <= 7 ? 'shallow' : 'ocean');
  setTerrain(s, 10, 0, 'plain');
  const hq = addCity(s, 4, 5, 0, { hq: true });
  addCity(s, 10, 0, 1, { hq: true });
  return { s, hq };
}

describe('Werft / shipyard', () => {
  it('a coastal city buys an empty transport boat without a naval base; it spawns on adjacent shallow water', () => {
    const { s, hq } = coast();
    expect(isCoastalCity(s, hq)).toBe(true);
    expect(trainCheck(s, hq, 'landingBoat')).toBe('ok');
    const r = ok(s, { type: 'train', city: hq.id, unitType: 'landingBoat' });
    const ev = r.events.find((e) => e.t === 'train')!;
    const b = unit(s, (ev as { unit: number }).unit)!;
    expect(b.type).toBe('landingBoat');
    expect(b.carried).toBeNull();
    expect(b.x).toBe(5);
    expect(Math.abs(b.y - 5)).toBeLessThanOrEqual(1);
    expect(b.hp).toBe(SHIPYARD.hullHp.landingBoat);
    expect(b.maxHp).toBe(SHIPYARD.hullHp.landingBoat);
    expect(b.homeCity).toBe(hq.id);
    expect(b.fresh).toBe(true);
    expect(s.factions[0].stars).toBe(500 - SHIPYARD.transportCost);
    // belegt einen Platz im Stadtlimit, kostet Sold wie ein Schiff / takes a slot of the city limit, costs upkeep like a ship
    expect(supportedUnits(s, hq)).toBe(1);
    expect(unitUpkeep(b)).toBe(Math.ceil(SHIPYARD.transportCost * 0.3));
    // Punkte: Kaufpreis / points: purchase price
    s.factions[0].explored = s.factions[0].explored.map(() => 0);
    const before = score(s, 0);
    s.units = s.units.filter((u) => u.id !== b.id);
    expect(before - score(s, 0)).toBe(SHIPYARD.transportCost);
  });

  it('the city tile itself may be occupied: the ship spawns on water', () => {
    const { s, hq } = coast();
    addUnit(s, 'infantry', 0, 4, 5);
    expect(trainCheck(s, hq, 'infantry')).toBe('occupied');
    expect(trainCheck(s, hq, 'landingBoat')).toBe('ok');
  });

  it('a city without water cannot buy ships; the command fails with noCoast', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 200 });
    const c = addCity(s, 5, 5, 0, { hq: true });
    expect(isCoastalCity(s, c)).toBe(false);
    for (const t of ['landingBoat', 'destroyer', 'submarine', 'battleship'] as const) expect(trainCheck(s, c, t), t).toBe('noCoast');
    fails(s, { type: 'train', city: c.id, unitType: 'landingBoat' }, 'noCoast');
  });

  it('warships need the naval base (destroyer, privateer) or the dry dock (submarine, battleship) of the city', () => {
    const { s, hq } = coast();
    expect(trainCheck(s, hq, 'destroyer')).toBe('buildingMissing');
    expect(trainCheck(s, hq, 'privateer')).toBe('buildingMissing');
    expect(trainCheck(s, hq, 'battleship')).toBe('buildingMissing');
    giveSites(hq, 'navalBase');
    expect(trainCheck(s, hq, 'destroyer')).toBe('ok');
    expect(trainCheck(s, hq, 'privateer')).toBe('ok');
    expect(trainCheck(s, hq, 'battleship')).toBe('buildingMissing');
    giveSites(hq, 'dryDock');
    const r = ok(s, { type: 'train', city: hq.id, unitType: 'battleship' });
    const b = unit(s, (r.events.find((e) => e.t === 'train') as { unit: number }).unit)!;
    expect(b.type).toBe('battleship');
    expect(b.hp).toBe(SHIPYARD.hullHp.battleship);
    // Preis = Preis aus UNITS (keine Doktrin) / price = UNITS price (no doctrine)
    expect(s.factions[0].stars).toBe(500 - UNITS.battleship.cost!);
    // Kriegsschiff ohne Besatzung schiesst trotzdem / warship without crew still fires
    expect(UNITS.battleship.attack).toBeGreaterThan(0);
  });

  it('only Meridon has the privateer; the Zyrr have no ships at all', () => {
    const k = coast(['korvat', 'dravon']);
    giveSites(k.hq, 'navalBase');
    expect(trainCheck(k.s, k.hq, 'privateer')).toBe('invalid');
    expect(rosterShips(k.s, 0)).not.toContain('privateer');
    expect(rosterShips(coast(['meridon', 'dravon']).s, 0)).toContain('privateer');
    const z = coast(['zyrr', 'dravon']);
    z.s.factions[0].techs.push('coastalEconomy');
    expect(rosterShips(z.s, 0)).toEqual([]);
    expect(trainCheck(z.s, z.hq, 'landingBoat')).toBe('invalid');
  });

  it('cult and NEXUS need coastal economy for boats and the ship research for warships', () => {
    for (const f of ['vesper', 'nexus'] as const) {
      const { s, hq } = coast([f, 'dravon']);
      // Starttechnologien entfernen (NEXUS beginnt mit einigen) / drop the start techs (NEXUS starts with some)
      s.factions[0].techs = [];
      expect(trainCheck(s, hq, 'landingBoat'), f).toBe('techMissing');
      s.factions[0].techs.push('coastalEconomy');
      expect(trainCheck(s, hq, 'landingBoat'), f).toBe('ok');
      expect(trainCheck(s, hq, 'destroyer'), f).toBe('techMissing');
      s.factions[0].techs.push('shipbuilding');
      expect(trainCheck(s, hq, 'destroyer'), f).toBe('ok');
      ok(s, { type: 'train', city: hq.id, unitType: 'destroyer' });
    }
  });

  it('the cult buys ships only within the horde cap', () => {
    const { s, hq } = coast(['vesper', 'dravon']);
    s.factions[0].techs.push('coastalEconomy');
    for (let i = 0; i < 40 && trainCheck(s, hq, 'landingBoat') === 'ok'; i++) addUnit(s, 'zealot', 0, i % 4, Math.floor(i / 4));
    expect(trainCheck(s, hq, 'landingBoat')).toBe('unitLimit');
  });

  it('spawn tile: adjacent shallow before ocean, else the nearest free water in the territory; none free: noWaterTile', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 200 });
    const c = addCity(s, 5, 5, 0, { hq: true, radius: 2 });
    // nur Wasser im Gebiet, zwei Felder entfernt / only water in the territory, two tiles away
    setTerrain(s, 7, 7, 'shallow');
    setTerrain(s, 7, 3, 'shallow');
    expect(shipSpawnTile(s, c)).toEqual({ x: 7, y: 3 });
    addUnit(s, 'landingBoat', 0, 7, 3, { carried: null, hp: 6 });
    expect(shipSpawnTile(s, c)).toEqual({ x: 7, y: 7 });
    addUnit(s, 'landingBoat', 0, 7, 7, { carried: null, hp: 6 });
    expect(shipSpawnTile(s, c)).toBeNull();
    expect(trainCheck(s, c, 'landingBoat')).toBe('noWaterTile');
    // Ozean am Stadtfeld nur mit Tauchen, Flachwasser zuerst / ocean next to the city only with diving, shallow first
    setTerrain(s, 6, 6, 'ocean');
    expect(shipSpawnTile(s, c)).toBeNull();
    s.factions[0].techs.push('diving');
    expect(shipSpawnTile(s, c)).toEqual({ x: 6, y: 6 });
    setTerrain(s, 4, 4, 'shallow');
    expect(shipSpawnTile(s, c)).toEqual({ x: 4, y: 4 });
  });

  it('a land unit boards an empty boat from an adjacent tile; the boat merges into it', () => {
    const { s, hq } = coast();
    const r = ok(s, { type: 'train', city: hq.id, unitType: 'landingBoat' });
    const boatId = (r.events.find((e) => e.t === 'train') as { unit: number }).unit;
    const boat = unit(s, boatId)!;
    const mg = addUnit(s, 'mg', 0, 4, boat.y);
    mg.veteran = true;
    const opt = reachable(s, mg).find((p) => p.x === boat.x && p.y === boat.y);
    expect(opt?.board).toBe(true);
    const units = s.units.length;
    const mv = ok(s, { type: 'move', unit: mg.id, to: { x: boat.x, y: boat.y } });
    expect(mv.events.some((e) => e.t === 'embark' && e.boat === boatId)).toBe(true);
    expect(s.units.length).toBe(units - 1);
    expect(unit(s, boatId)).toBeUndefined();
    const u = unit(s, mg.id)!;
    expect(u.type).toBe('landingBoat');
    expect(u.carried).toBe('mg');
    expect(u.hp).toBe(UNITS.mg.hp);
    expect(u.veteran).toBe(true);
    expect(u.exhausted).toBe(true);
    // der Platz des Boots wird frei / the boat's slot becomes free
    expect(supportedUnits(s, hq)).toBe(0);
  });

  it('an empty boat cannot go ashore or attack; disembarking still works after boarding', () => {
    const { s } = coast();
    const b = addUnit(s, 'landingBoat', 0, 5, 3, { carried: null, hp: 6 });
    addUnit(s, 'infantry', 1, 6, 3);
    expect(reachable(s, b).some((p) => p.x <= 4)).toBe(false);
    expect(attackTargets(s, b)).toEqual([]);
    // Kriegsschiff leer: an Land nein, Angriff ja / empty warship: no going ashore, attacking yes
    const d = addUnit(s, 'destroyer', 0, 5, 7, { carried: null, hp: 10 });
    expect(reachable(s, d).some((p) => p.x <= 4)).toBe(false);
    // Einsteigen, dann im naechsten Zug an Land / board, then go ashore next turn
    const inf = addUnit(s, 'infantry', 0, 4, 3);
    ok(s, { type: 'move', unit: inf.id, to: { x: 5, y: 3 } });
    const u = unit(s, inf.id)!;
    u.exhausted = false; u.moved = false; u.fresh = false;
    ok(s, { type: 'move', unit: inf.id, to: { x: 4, y: 2 } });
    expect(unit(s, inf.id)!.type).toBe('infantry');
    expect(unit(s, inf.id)!.carried).toBeNull();
  });

  it('flyers, ships and foreign units do not board; non-humans need coastal economy to board', () => {
    const { s } = coast(['vesper', 'meridon']);
    addUnit(s, 'landingBoat', 0, 5, 3, { carried: null, hp: 6 });
    const z = addUnit(s, 'zealot', 0, 4, 3);
    expect(reachable(s, z).some((p) => p.x === 5 && p.y === 3)).toBe(false);
    s.factions[0].techs.push('coastalEconomy');
    expect(reachable(s, z).some((p) => p.x === 5 && p.y === 3 && p.board)).toBe(true);
    const foe = addUnit(s, 'infantry', 1, 4, 2);
    expect(reachable(s, foe).some((p) => p.x === 5 && p.y === 3)).toBe(false);
    const other = addUnit(s, 'landingBoat', 0, 6, 3, { carried: 'infantry' });
    expect(reachable(s, other).some((p) => p.x === 5 && p.y === 3)).toBe(false);
  });

  it('upgrading an empty boat gives the hull HP of the new type, damage stays', () => {
    const { s, hq } = coast();
    giveSites(hq, 'navalBase');
    const b = addUnit(s, 'landingBoat', 0, 5, 5, { carried: null, hp: 4 });
    b.maxHp = 6;
    ok(s, { type: 'upgrade', unit: b.id, to: 'destroyer' });
    expect(unit(s, b.id)!.maxHp).toBe(SHIPYARD.hullHp.destroyer);
    expect(unit(s, b.id)!.hp).toBe(SHIPYARD.hullHp.destroyer! - 2);
    expect(unit(s, b.id)!.carried).toBeNull();
  });

  it('save and load keep empty ships', () => {
    const { s, hq } = coast();
    ok(s, { type: 'train', city: hq.id, unitType: 'landingBoat' });
    const raw = JSON.parse(JSON.stringify(s));
    expect(isValidState(raw)).toBe(true);
    const m = migrateState(raw);
    const boat = m.units.find((u) => u.type === 'landingBoat')!;
    expect(boat.carried).toBeNull();
    expect(boat.hp).toBe(SHIPYARD.hullHp.landingBoat);
    // weiterspielen: einsteigen im geladenen Stand / keep playing: board in the loaded state
    const inf = addUnit(m, 'infantry', 0, 4, boat.y);
    ok(m, { type: 'move', unit: inf.id, to: { x: boat.x, y: boat.y } });
    expect(m.units.find((u) => u.id === inf.id)!.carried).toBe('infantry');
  });
});
