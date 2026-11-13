/**
 * Konter-Einheiten: Bonusschaden, Flakzone, Minen, Freischaltungen, KI-Auswahl.
 * Counter units: bonus damage, flak zone, mines, unlocks, AI choice.
 */
import { describe, expect, it } from 'vitest';
import {
  canSeeMine, combatPreview, counterFactor, mineCheck, mineTargets, reachable, techUnlocks, trainCheck, unitClass,
} from '../src/core';
import { COUNTER, UNITS, type FactionId } from '../src/data/balance';
import { buildCtx } from '../src/ai/analysis';
import { chooseUnitType } from '../src/ai/economy';
import { mineOption } from '../src/ai/tactics';
import { planNextCommand } from '../src/ai/ai';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, tile, unit, untilTurnOf } from './helpers';

function g(factions?: FactionId[]) {
  const s = blankGame({ stars: 200, factions });
  addCity(s, 1, 1, 0, { hq: true, level: 3 });
  addCity(s, 10, 10, 1, { hq: true, level: 3 });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

describe('Konter-Klassen / counter classes', () => {
  it('Fahrzeuge, Flieger, Fusstruppen und Schiffe / vehicles, flyers, foot troops and ships', () => {
    for (const t of ['tank', 'jeep', 'artillery', 'antiAir', 'mineLayer', 'mech', 'tripod', 'titan', 'doomCrawler', 'railgun', 'flakDrone'] as const) expect(unitClass(t)).toBe('vehicle');
    for (const t of ['heli', 'skimmer', 'quadDrone'] as const) expect(unitClass(t)).toBe('air');
    for (const t of ['infantry', 'antiTank', 'zealot', 'faustZealot', 'android', 'grey'] as const) expect(unitClass(t)).toBe('foot');
    expect(unitClass('destroyer')).toBe('ship');
    expect(counterFactor('antiTank', 'tank')).toBe(2.5);
    expect(counterFactor('antiTank', 'infantry')).toBe(0.6);
    expect(counterFactor('antiTank', 'destroyer')).toBe(1);
    expect(counterFactor('antiAir', 'heli')).toBe(2);
    expect(counterFactor('infantry', 'tank')).toBe(1);
    // Sonderfraktionen haben je einen Konter / special factions have one counter each
    expect(UNITS.faustZealot.bonusVs?.vehicle).toBeGreaterThan(1);
    expect(UNITS.flakDrone.bonusVs?.air).toBeGreaterThan(1);
  });
});

describe('Bonusschaden / bonus damage', () => {
  it('Panzerabwehr: grosser Bonus gegen Fahrzeuge, schwach gegen Infanterie / anti-tank: big bonus vs vehicles, weak vs infantry', () => {
    const s = g();
    const at = addUnit(s, 'antiTank', 0, 4, 5);
    const inf = addUnit(s, 'infantry', 0, 4, 7);
    const tank = addUnit(s, 'tank', 1, 6, 5);
    const foe = addUnit(s, 'infantry', 1, 5, 7);
    // 2 / (2 + 4) * 2 * 4.5 = 3, x2.5 = 7.5 -> 8; Infanterie ohne Bonus 3 / infantry without bonus 3
    const p = combatPreview(s, at, tank);
    expect(p.toDefender).toBe(8);
    expect(combatPreview(s, { ...inf, x: 5, y: 5 }, tank).toDefender).toBe(3);
    // Reichweite 2: der Panzer kann nicht zurueckschlagen / range 2: the tank cannot retaliate
    expect(p.retaliates).toBe(false);
    // gegen Infanterie: 4.5 x 0.6 = 2.7 -> 3 statt 5 / vs infantry: 3 instead of 5
    expect(combatPreview(s, { ...at, x: 4, y: 6 }, foe).toDefender).toBe(3);
    expect(combatPreview(s, inf, foe).toDefender).toBe(5);
    // Angriff wendet genau die Vorschau an / the attack applies exactly the preview
    const r = ok(s, { type: 'attack', unit: at.id, target: tank.id });
    const ev = r.events.find((e) => e.t === 'attack');
    expect(ev && ev.t === 'attack' && ev.dmg).toBe(8);
    expect(unit(s, tank.id)!.hp).toBe(40 - 8);
  });

  it('der Bonus gilt auch beim Gegenschlag / the bonus also applies to retaliation', () => {
    const s = g();
    const at = addUnit(s, 'antiTank', 1, 5, 5);
    s.factions[0].techs.push('motorization');
    const jeep = addUnit(s, 'jeep', 0, 4, 5);
    jeep.maxHp = 20; jeep.hp = 20;
    const p = combatPreview(s, jeep, at);
    // Jeep 2 vs 1.5: 5 Schaden; Gegenschlag (Vorschau mit vollen LP) 1.5/3.5*1.5*4.5 = 2.9 -> 3, x2.5 = 7.2 -> 7
    // jeep 2 vs 1.5: 5 damage; retaliation (preview with full HP) 2.9 -> 3 without bonus, 7 with it
    expect(p.toDefender).toBe(5);
    expect(p.toAttacker).toBe(7);
    expect(combatPreview(s, jeep, { ...at, type: 'zealot' }).toAttacker).toBe(3);
  });

  it('Flak: holt Hubschrauber und Drohnen herunter, schwach gegen Bodenziele / AA: downs helicopters and drones, weak vs ground', () => {
    const s = g(['korvat', 'nexus']);
    const aa = addUnit(s, 'antiAir', 0, 4, 5);
    const drone = addUnit(s, 'quadDrone', 1, 6, 5);
    const android = addUnit(s, 'android', 1, 4, 7);
    // 2 / 3 * 2 * 4.5 = 6, x2 = 12 >= 10
    expect(combatPreview(s, aa, drone)).toMatchObject({ toDefender: 12, kills: true });
    expect(combatPreview(s, aa, android).toDefender).toBe(3);
    const heli = addUnit(s, 'heli', 1, 3, 4);
    expect(combatPreview(s, aa, heli).kills).toBe(true);
  });
});

describe('Flakzone / flak zone', () => {
  it('feindliche Flieger, die neben einer Flak den Zug beenden, nehmen Schaden / hostile flyers ending their turn next to flak take damage', () => {
    const s = g();
    addUnit(s, 'antiAir', 0, 5, 5);
    const near = addUnit(s, 'heli', 1, 6, 5);
    const far = addUnit(s, 'heli', 1, 8, 8);
    endTurn(s); // Fraktion 1 am Zug / faction 1 to move
    const r = endTurn(s);
    expect(r.events.some((e) => e.t === 'aaFire' && e.target === near.id && e.dmg === COUNTER.flak.damage)).toBe(true);
    expect(unit(s, near.id)!.hp).toBe(10 - COUNTER.flak.damage);
    expect(unit(s, far.id)!.hp).toBe(10);
  });

  it('nicht im Frieden und nicht gegen Bodeneinheiten / not at peace and not vs ground units', () => {
    const s = g();
    addUnit(s, 'antiAir', 0, 5, 5);
    const heli = addUnit(s, 'heli', 1, 6, 5);
    const inf = addUnit(s, 'infantry', 1, 4, 5);
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    endTurn(s); endTurn(s);
    expect(unit(s, heli.id)!.hp).toBe(10);
    expect(unit(s, inf.id)!.hp).toBe(10);
  });
});

describe('Minen / mines', () => {
  it('Minenleger legt eine Mine fuer 10 Sterne auf ein freies Nachbarfeld / mine layer lays a mine for 10 stars on a free adjacent tile', () => {
    const s = g();
    const ml = addUnit(s, 'mineLayer', 0, 5, 5);
    const inf = addUnit(s, 'infantry', 0, 3, 3);
    addUnit(s, 'infantry', 0, 6, 6);
    expect(mineCheck(s, inf, 3, 4)).toBe('cannotCapture');
    expect(mineCheck(s, ml, 7, 5)).toBe('outOfRange');
    expect(mineCheck(s, ml, 6, 6)).toBe('occupied');
    tile(s, 4, 4).terrain = 'shallow';
    expect(mineCheck(s, ml, 4, 4)).toBe('invalidTile');
    expect(mineTargets(s, ml)).toHaveLength(6);
    ok(s, { type: 'mine', unit: ml.id, x: 6, y: 5 });
    expect(tile(s, 6, 5).mine).toEqual({ owner: 0 });
    expect(s.factions[0].stars).toBe(200 - COUNTER.mine.cost);
    // verbraucht den Zug / consumes the turn
    fails(s, { type: 'mine', unit: ml.id, x: 5, y: 6 }, 'unitExhausted');
  });

  it('Sterne und Hoechstzahl / stars and limit', () => {
    const s = g();
    const ml = addUnit(s, 'mineLayer', 0, 5, 5);
    s.factions[0].stars = 5;
    expect(mineCheck(s, ml, 6, 5)).toBe('notEnoughStars');
    s.factions[0].stars = 100;
    for (let i = 0; i < COUNTER.mine.maxPerFaction; i++) tile(s, i, 9).mine = { owner: 0 };
    expect(mineCheck(s, ml, 6, 5)).toBe('unitLimit');
  });

  it('verdeckt: nur Besitzer und Einheiten direkt daneben sehen die Mine / hidden: only the owner and adjacent units see the mine', () => {
    const s = g();
    tile(s, 5, 5).mine = { owner: 0 };
    expect(canSeeMine(s, 0, 5, 5)).toBe(true);
    expect(canSeeMine(s, 1, 5, 5)).toBe(false);
    addUnit(s, 'infantry', 1, 7, 5);
    expect(canSeeMine(s, 1, 5, 5)).toBe(false);
    addUnit(s, 'infantry', 1, 6, 4);
    expect(canSeeMine(s, 1, 5, 5)).toBe(true);
  });

  it('feindliches Fahrzeug: Bewegung endet auf der Mine, schwerer Schaden, Mine verbraucht / hostile vehicle: move ends on the mine, heavy damage, mine consumed', () => {
    const s = g();
    s.factions[0].techs.push('motorization');
    tile(s, 5, 5).mine = { owner: 1 };
    // Engpass: nur ueber das Minenfeld / bottleneck: only across the mined tile
    tile(s, 5, 4).terrain = 'shallow'; tile(s, 5, 6).terrain = 'shallow';
    const jeep = addUnit(s, 'jeep', 0, 4, 5);
    jeep.maxHp = 20; jeep.hp = 20;
    // der Weg zu (6,5) fuehrt ueber die Mine / the path to (6,5) leads over the mine
    expect(reachable(s, jeep).find((r) => r.x === 6 && r.y === 5)?.path).toEqual([{ x: 5, y: 5 }, { x: 6, y: 5 }]);
    const r = ok(s, { type: 'move', unit: jeep.id, to: { x: 6, y: 5 } });
    const j = unit(s, jeep.id)!;
    expect([j.x, j.y]).toEqual([5, 5]);
    expect(j.hp).toBe(20 - COUNTER.mine.damageVehicle);
    expect(tile(s, 5, 5).mine).toBeNull();
    expect(r.events.some((e) => e.t === 'mineHit' && e.owner === 1 && e.dmg === COUNTER.mine.damageVehicle)).toBe(true);
    // keine weitere Bewegung / no further movement
    expect(reachable(s, j)).toHaveLength(0);
  });

  it('Fusstruppen nehmen weniger Schaden, schwache Einheiten sterben / foot troops take less damage, weak units die', () => {
    const s = g();
    tile(s, 5, 5).mine = { owner: 1 };
    tile(s, 5, 7).mine = { owner: 1 };
    const inf = addUnit(s, 'infantry', 0, 4, 5);
    ok(s, { type: 'move', unit: inf.id, to: { x: 5, y: 5 } });
    expect(unit(s, inf.id)!.hp).toBe(10 - COUNTER.mine.damageFoot);
    const hurt = addUnit(s, 'infantry', 0, 4, 7, { hp: 4 });
    const r = ok(s, { type: 'move', unit: hurt.id, to: { x: 5, y: 7 } });
    expect(unit(s, hurt.id)).toBeUndefined();
    expect(r.events.some((e) => e.t === 'killed' && e.unit === hurt.id)).toBe(true);
  });

  it('Flieger, eigene Einheiten und Fraktionen im Frieden loesen nicht aus / flyers, own units and factions at peace do not trigger', () => {
    const s = g();
    s.factions[0].techs.push('armyAviation');
    tile(s, 5, 5).mine = { owner: 1 };
    tile(s, 5, 3).mine = { owner: 0 };
    const heli = addUnit(s, 'heli', 0, 4, 5);
    ok(s, { type: 'move', unit: heli.id, to: { x: 5, y: 5 } });
    expect(unit(s, heli.id)!.hp).toBe(10);
    expect(tile(s, 5, 5).mine).toEqual({ owner: 1 });
    const own = addUnit(s, 'infantry', 0, 4, 3);
    ok(s, { type: 'move', unit: own.id, to: { x: 5, y: 3 } });
    expect(unit(s, own.id)!.hp).toBe(10);
    tile(s, 5, 7).mine = { owner: 1 };
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    const calm = addUnit(s, 'infantry', 0, 4, 7);
    ok(s, { type: 'move', unit: calm.id, to: { x: 5, y: 7 } });
    expect(unit(s, calm.id)!.hp).toBe(10);
  });

  it('deterministisch in der Wiederholung / deterministic on replay', () => {
    const run = () => {
      const s = g();
      const ml = addUnit(s, 'mineLayer', 1, 6, 5);
      const inf = addUnit(s, 'infantry', 0, 3, 5);
      endTurn(s);
      ok(s, { type: 'mine', unit: ml.id, x: 5, y: 5 });
      untilTurnOf(s, 0);
      ok(s, { type: 'move', unit: inf.id, to: { x: 4, y: 5 } });
      untilTurnOf(s, 0);
      ok(s, { type: 'move', unit: inf.id, to: { x: 5, y: 5 } });
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});

describe('Freischaltungen / unlocks', () => {
  it('Menschen: Panzerabwehr mit Ruestungsindustrie, Flak mit Aerodynamik, Minenleger mit Befestigung / humans', () => {
    const s = g();
    const c = s.cities[0];
    expect(trainCheck(s, c, 'antiTank')).toBe('techMissing');
    expect(trainCheck(s, c, 'antiAir')).toBe('techMissing');
    expect(trainCheck(s, c, 'mineLayer')).toBe('techMissing');
    s.factions[0].techs.push('armsIndustry', 'aerodynamics', 'fortification');
    expect(trainCheck(s, c, 'antiTank')).toBe('ok');
    expect(trainCheck(s, c, 'antiAir')).toBe('ok');
    expect(trainCheck(s, c, 'mineLayer')).toBe('ok');
    expect(trainCheck(s, c, 'faustZealot')).toBe('invalid');
    expect(trainCheck(s, c, 'flakDrone')).toBe('invalid');
    expect(techUnlocks('aerodynamics').units).toEqual(['antiAir']);
  });

  it('Kult: Panzerfaust-Eiferer mit Ruestungsindustrie; NEXUS: Flak-Drohne mit Rechenleistung 2 / cult and NEXUS', () => {
    expect(techUnlocks('armsIndustry', 'vesper').units).toEqual(['doomCrawler', 'faustZealot']);
    const s = g(['nexus', 'korvat']);
    const c = s.cities[0];
    expect(trainCheck(s, c, 'antiAir')).toBe('invalid');
    expect(trainCheck(s, c, 'flakDrone')).toBe('computeMissing');
    for (const [x, b] of [[0, 'dataCenter'], [1, 'powerPlant'], [2, 'dataCenter'], [3, 'powerPlant']] as const) tile(s, x, 2).building = b;
    tile(s, 2, 2).territory = c.id; tile(s, 3, 2).territory = c.id;
    expect(trainCheck(s, c, 'flakDrone')).toBe('ok');
  });
});

describe('KI und Konter / AI and counters', () => {
  it('bildet Panzerabwehr gegen viele Fahrzeuge aus / trains anti-tank against many vehicles', () => {
    const s = g();
    s.factions[0].human = false;
    s.factions[0].techs.push('armsIndustry', 'motorization');
    for (let i = 0; i < 3; i++) addUnit(s, 'infantry', 0, 2 + i, 3);
    for (let i = 0; i < 4; i++) addUnit(s, 'tank', 1, 7 + (i % 2), 6 + i);
    const ctx = buildCtx(s, 0);
    expect(chooseUnitType(ctx, s.cities[0], false)).toBe('antiTank');
  });

  it('bildet Flak gegen Flieger aus, auch in Not / trains AA against flyers, also when urgent', () => {
    const s = g();
    s.factions[0].human = false;
    s.factions[0].techs.push('armsIndustry', 'aerodynamics');
    for (let i = 0; i < 3; i++) addUnit(s, 'infantry', 0, 2 + i, 4);
    addUnit(s, 'heli', 1, 3, 3);
    addUnit(s, 'heli', 1, 8, 8);
    const ctx = buildCtx(s, 0);
    expect(chooseUnitType(ctx, s.cities[0], false)).toBe('antiAir');
    expect(chooseUnitType(ctx, s.cities[0], true)).toBe('antiAir');
  });

  it('ohne Fahrzeuge keine Panzerabwehr / no anti-tank without vehicles', () => {
    const s = g();
    s.factions[0].human = false;
    s.factions[0].techs.push('armsIndustry');
    for (let i = 0; i < 3; i++) addUnit(s, 'infantry', 0, 2 + i, 3);
    for (let i = 0; i < 4; i++) addUnit(s, 'infantry', 1, 7, 5 + i);
    expect(chooseUnitType(buildCtx(s, 0), s.cities[0], false)).not.toBe('antiTank');
  });

  it('Kult und NEXUS waehlen ihre Konter / cult and NEXUS choose their counters', () => {
    const s = g(['vesper', 'dravon']);
    s.factions[0].human = false;
    s.factions[0].techs.push('armsIndustry');
    addUnit(s, 'zealot', 0, 2, 3); addUnit(s, 'prophet', 0, 3, 3); addUnit(s, 'prophet', 0, 4, 3);
    for (let i = 0; i < 4; i++) addUnit(s, 'tank', 1, 7, 5 + i);
    expect(chooseUnitType(buildCtx(s, 0), s.cities[0], false)).toBe('faustZealot');
    const n = g(['nexus', 'dravon']);
    n.factions[0].human = false;
    for (const [x, b] of [[0, 'dataCenter'], [1, 'powerPlant'], [2, 'dataCenter'], [0, 'powerPlant']] as const) tile(n, x, x === 0 && b === 'powerPlant' ? 0 : 2).building = b;
    addUnit(n, 'android', 0, 2, 3); addUnit(n, 'android', 0, 3, 3);
    addUnit(n, 'heli', 1, 6, 6); addUnit(n, 'heli', 1, 7, 7);
    expect(chooseUnitType(buildCtx(n, 0), n.cities[0], false)).toBe('flakDrone');
  });

  it('legt Minen defensiv vor eigener Stadt / lays mines defensively in front of an own city', () => {
    const s = g();
    s.factions[0].human = false;
    s.factions[0].techs.push('fortification');
    const ml = addUnit(s, 'mineLayer', 0, 2, 2);
    addUnit(s, 'tank', 1, 5, 5);
    const ctx = buildCtx(s, 0);
    const mo = mineOption(ctx, ml)!;
    expect(mo).not.toBeNull();
    // zwischen Gegner und Stadt / between the enemy and the city
    expect(Math.max(Math.abs(mo.x - 1), Math.abs(mo.y - 1))).toBeLessThanOrEqual(3);
    expect(Math.max(Math.abs(mo.x - 5), Math.abs(mo.y - 5))).toBeLessThan(Math.max(Math.abs(5 - 1), Math.abs(5 - 1)));
    // ein ganzer KI-Zug legt die Mine / a full AI turn lays the mine
    let laid = false;
    for (let i = 0; i < 60 && !laid; i++) {
      const cmd = planNextCommand(s, 0);
      if (cmd.type === 'endTurn') break;
      ok(s, cmd);
      if (cmd.type === 'mine') laid = true;
    }
    expect(laid).toBe(true);
    expect(s.tiles.some((t) => t.mine?.owner === 0)).toBe(true);
  });
});
