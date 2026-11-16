/**
 * Schlachtfeld-Narben (optisch): Intensitaet je Feld, Gewichte nach Waffe, Deckel, Erholung, alte Spielstaende.
 * Battlefield scars (visual): intensity per tile, weights by weapon, cap, recovery, old saves.
 */
import { describe, expect, it } from 'vitest';
import { addBattleScar, cloneState, healScars, scarTier, scarTierOf } from '../src/core';
import { WAR_MARKS } from '../src/data/balance';
import { migrateState } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, ok, revealAll, setTerrain, tile, untilTurnOf } from './helpers';

const S = WAR_MARKS.scar;

function g() {
  const s = blankGame({ stars: 100 });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Schlachtfeld-Intensitaet / battlefield intensity', () => {
  it('Stufen nach Schwellen / tiers by thresholds', () => {
    expect(scarTierOf(0)).toBe(0);
    expect(scarTierOf(S.light)).toBe(1);
    expect(scarTierOf(S.medium - 1)).toBe(1);
    expect(scarTierOf(S.medium)).toBe(2);
    expect(scarTierOf(S.heavy - 1)).toBe(2);
    expect(scarTierOf(S.heavy)).toBe(3);
    expect(scarTierOf(S.max)).toBe(3);
    expect(S.light).toBeLessThan(S.medium);
    expect(S.medium).toBeLessThan(S.heavy);
    expect(S.heavy).toBeLessThanOrEqual(S.max);
  });

  it('leichte Waffe: Treffer zaehlt hit, Gegenfeuer zeichnet das Feld des Angreifers / light weapon: hit counts, return fire scars the attacker tile', () => {
    const s = g();
    const victim = addUnit(s, 'infantry', 1, 5, 5);
    const att = addUnit(s, 'infantry', 0, 4, 5);
    const r = ok(s, { type: 'attack', unit: att.id, target: victim.id });
    const ev = r.events.find((e) => e.t === 'attack') as { ret: number };
    expect(tile(s, 5, 5).scar).toEqual({ v: S.hit, r: s.round });
    if (ev.ret > 0) expect(tile(s, 4, 5).scar?.v).toBe(S.returnFire);
    expect(victim.hp).toBeGreaterThan(0);
  });

  it('schwere Waffe wiegt mehr, ein Tod und ein Wrack zusaetzlich / heavy weapons weigh more, a death and a wreck add', () => {
    const s = g();
    const victim = addUnit(s, 'jeep', 1, 5, 5, { hp: 1 });
    const art = addUnit(s, 'artillery', 0, 3, 5);
    ok(s, { type: 'attack', unit: art.id, target: victim.id });
    expect(tile(s, 5, 5).scar?.v).toBe(S.heavyHit + S.wreck);
    const s2 = g();
    const foot = addUnit(s2, 'infantry', 1, 5, 5, { hp: 1 });
    const inf = addUnit(s2, 'infantry', 0, 4, 5);
    ok(s2, { type: 'attack', unit: inf.id, target: foot.id });
    expect(tile(s2, 5, 5).scar?.v).toBe(S.hit + S.death);
  });

  it('Seeschlacht: Wasserfelder sammeln Intensitaet, aber keine Krater / sea battle: water tiles gain intensity but no craters', () => {
    const s = g();
    setTerrain(s, 5, 5, 'ocean'); setTerrain(s, 4, 5, 'ocean');
    const ship = addUnit(s, 'destroyer', 1, 5, 5, { hp: 1 });
    const att = addUnit(s, 'destroyer', 0, 4, 5);
    ok(s, { type: 'attack', unit: att.id, target: ship.id });
    expect(tile(s, 5, 5).scar!.v).toBe(S.hit + S.wreck);
    expect(tile(s, 5, 5).marks ?? []).toHaveLength(0);
  });

  it('Staedte bleiben unberuehrt, Deckel bei max / cities stay untouched, cap at max', () => {
    const s = g();
    addBattleScar(s, 1, 1, 10);
    expect(tile(s, 1, 1).scar).toBeUndefined();
    for (let i = 0; i < 40; i++) addBattleScar(s, 5, 5, S.blast);
    expect(tile(s, 5, 5).scar!.v).toBe(S.max);
    expect(scarTier(tile(s, 5, 5))).toBe(3);
    // ungueltige Gewichte und Felder ausserhalb aendern nichts / invalid weights and out-of-map tiles change nothing
    addBattleScar(s, 6, 6, 0); addBattleScar(s, 6, 6, -3); addBattleScar(s, -1, 40, 5);
    expect(tile(s, 6, 6).scar).toBeUndefined();
  });

  it('Mine: Krater plus Explosionsgewicht / mine: crater plus blast weight', () => {
    const s = g();
    tile(s, 6, 5).mine = { owner: 1 };
    const inf = addUnit(s, 'infantry', 0, 5, 5, { hp: 10 });
    ok(s, { type: 'move', unit: inf.id, to: { x: 6, y: 5 } });
    expect(tile(s, 6, 5).scar!.v).toBeGreaterThanOrEqual(S.mine);
    expect(tile(s, 6, 5).marks!.some((m) => m.k === 'crater')).toBe(true);
  });
});

describe('Erholung / recovery', () => {
  it('nach healAfter ruhigen Runden alle healEvery Runden ein Punkt weniger, bei 0 verschwinden Krater / one point less every healEvery rounds after healAfter quiet rounds, craters vanish at 0', () => {
    const s = g();
    addBattleScar(s, 5, 5, 3);
    tile(s, 5, 5).marks = [{ k: 'crater', a: 0, ox: 0, oz: 0 }, { k: 'scorch', a: 1, ox: 0, oz: 0 }, { k: 'scorch', a: 2, ox: 0, oz: 0 }];
    const start = s.round;
    const at = (r: number) => { s.round = r; healScars(s); return tile(s, 5, 5); };
    for (let r = start + 1; r <= start + S.healAfter; r++) expect(at(r).scar!.v).toBe(3);
    expect(at(start + S.healAfter + 1).scar!.v).toBe(3);
    expect(at(start + S.healAfter + S.healEvery).scar!.v).toBe(2);
    // ein Krater je zwei Punkte, der aelteste geht zuerst / one crater per two points, the oldest goes first
    expect(tile(s, 5, 5).marks!.map((m) => m.a)).toEqual([2]);
    expect(at(start + S.healAfter + 2 * S.healEvery).scar!.v).toBe(1);
    const t = at(start + S.healAfter + 3 * S.healEvery);
    expect(t.scar).toBeUndefined();
    expect(t.marks).toEqual([]);
  });

  it('neuer Kampf setzt die Erholung zurueck / a new fight resets the recovery', () => {
    const s = g();
    addBattleScar(s, 5, 5, 4);
    s.round += S.healAfter + S.healEvery;
    healScars(s);
    expect(tile(s, 5, 5).scar!.v).toBe(3);
    addBattleScar(s, 5, 5, 1);
    expect(tile(s, 5, 5).scar).toEqual({ v: 4, r: s.round });
    s.round += 1; healScars(s);
    expect(tile(s, 5, 5).scar!.v).toBe(4);
  });

  it('laeuft mit dem Rundenwechsel / runs with the round change', () => {
    const s = g();
    addBattleScar(s, 5, 5, 1);
    const r0 = s.round;
    while (s.round <= r0 + S.healAfter + S.healEvery) { endTurn(s); untilTurnOf(s, 0); }
    expect(tile(s, 5, 5).scar).toBeUndefined();
  });
});

describe('Spielstaende / saves', () => {
  it('alte Spielstaende ohne scar laden, Krater zaehlen als leicht; scar ueberlebt JSON / old saves without scar load, craters count as light; scar survives JSON', () => {
    const s = g();
    tile(s, 4, 4).marks = [{ k: 'scorch', a: 0, ox: 0, oz: 0 }];
    const old = migrateState(JSON.parse(JSON.stringify(s)));
    expect(old.tiles.every((t) => t.scar === undefined)).toBe(true);
    expect(scarTier(old.tiles[4 * old.size + 4])).toBe(1);
    expect(scarTier(old.tiles[5 * old.size + 5])).toBe(0);
    // ohne scar heilt nichts: alte Krater bleiben wie bisher / without scar nothing heals: old craters stay as before
    old.round += 50; healScars(old);
    expect(old.tiles[4 * old.size + 4].marks).toHaveLength(1);
    addBattleScar(s, 6, 6, 7);
    const back = JSON.parse(JSON.stringify(cloneState(s)));
    expect(back.tiles[6 * s.size + 6].scar).toEqual({ v: 7, r: s.round });
    expect(scarTier(back.tiles[6 * s.size + 6])).toBe(2);
  });
});
