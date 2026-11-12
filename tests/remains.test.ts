import { describe, expect, it } from 'vitest';
import { combatPreview, defenseBonus } from '../src/core';
import { DEFENSE_BONUS, REMAINS, type UnitTypeId } from '../src/data/balance';
import { addCity, addUnit, blankGame, ok, revealAll, setTerrain, tile } from './helpers';

function g() {
  const s = blankGame({ stars: 100 });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}

/** Laesst eine Einheit des Typs `type` (Fraktion 1) auf (5,5) sterben / kills a unit of `type` (faction 1) on (5,5) */
function killAt(type: UnitTypeId, x = 5, y = 5) {
  const s = g();
  const victim = addUnit(s, type, 1, x, y, { hp: 1 });
  const att = addUnit(s, 'infantry', 0, x - 1, y);
  const r = ok(s, { type: 'attack', unit: att.id, target: victim.id });
  return { s, r };
}

describe('Ueberreste / remains', () => {
  it('Panzer, Jeep, Artillerie und Hubschrauber hinterlassen ein Wrack / vehicles leave a wreck', () => {
    for (const type of ['tank', 'jeep', 'artillery', 'heli'] as UnitTypeId[]) {
      const { s, r } = killAt(type);
      expect(tile(s, 5, 5).remains).toMatchObject({ kind: 'wreck', unit: type, faction: 1 });
      expect(r.events.find((e) => e.t === 'killed')).toMatchObject({ remains: 'wreck', x: 5, y: 5 });
    }
  });

  it('Infanterietypen, Sanitaeter und Spion hinterlassen ein Skelett / foot units leave a skeleton', () => {
    for (const type of REMAINS.skeletonUnits) {
      const { s } = killAt(type);
      expect(tile(s, 5, 5).remains).toMatchObject({ kind: 'skeleton', unit: type });
    }
  });

  it('keine Ueberreste auf Wasser oder in Staedten / no remains on water or in cities', () => {
    const s = g();
    setTerrain(s, 5, 5, 'shallow');
    s.factions[0].techs.push('armyAviation');
    const heli = addUnit(s, 'heli', 1, 5, 5, { hp: 1 });
    const att = addUnit(s, 'heli', 0, 4, 5);
    ok(s, { type: 'attack', unit: att.id, target: heli.id });
    expect(tile(s, 5, 5).remains ?? null).toBeNull();
    const s2 = g();
    const def = addUnit(s2, 'infantry', 1, 9, 9, { hp: 1 });
    const a2 = addUnit(s2, 'mg', 0, 8, 9);
    ok(s2, { type: 'attack', unit: a2.id, target: def.id });
    expect(tile(s2, 9, 9).remains ?? null).toBeNull();
  });

  it('ein Wrack gibt Landeinheiten +1 Schutz / a wreck gives land units +1 cover', () => {
    const { s } = killAt('tank');
    const d = addUnit(s, 'infantry', 1, 5, 5);
    expect(defenseBonus(s, d)).toBe(DEFENSE_BONUS.open + REMAINS.wreckDefenseBonus);
    const a = addUnit(s, 'infantry', 0, 6, 6);
    const withWreck = combatPreview(s, a, d).toDefender;
    tile(s, 5, 5).remains = null;
    expect(combatPreview(s, a, d).toDefender).toBeGreaterThan(withWreck);
  });

  it('der Wrack-Bonus addiert sich zu Gelaende- und Aussenpostenbonus / the wreck bonus adds to other bonuses', () => {
    const { s } = killAt('jeep');
    s.factions[1].techs.push('fortification');
    tile(s, 5, 5).outpost = { owner: 1 };
    const d = addUnit(s, 'mg', 1, 5, 5);
    expect(defenseBonus(s, d)).toBe(DEFENSE_BONUS.outpost + REMAINS.wreckDefenseBonus);
  });

  it('Skelette und fliegende Einheiten erhalten keinen Schutz / skeletons give no cover, helicopters get none', () => {
    const { s } = killAt('infantry');
    const d = addUnit(s, 'infantry', 1, 5, 5);
    expect(defenseBonus(s, d)).toBe(DEFENSE_BONUS.open);
    const w = killAt('artillery').s;
    w.factions[1].techs.push('armyAviation');
    const heli = addUnit(w, 'heli', 1, 5, 5);
    expect(defenseBonus(w, heli)).toBe(DEFENSE_BONUS.open);
  });

  it('ein Skelett ersetzt kein Wrack / a skeleton does not replace a wreck', () => {
    const { s } = killAt('tank');
    const v = addUnit(s, 'infantry', 1, 5, 5, { hp: 1 });
    const att = addUnit(s, 'artillery', 0, 5, 3);
    ok(s, { type: 'attack', unit: att.id, target: v.id });
    expect(tile(s, 5, 5).remains).toMatchObject({ kind: 'wreck', unit: 'tank' });
  });

  it('der Spion beim Aufstand hinterlaesst nichts / the spy consumed by an uprising leaves nothing', () => {
    const s = g();
    s.factions[0].techs.push('intelligence');
    const spy = addUnit(s, 'spy', 0, 8, 8);
    ok(s, { type: 'move', unit: spy.id, to: { x: 9, y: 9 } });
    expect(tile(s, 9, 9).remains ?? null).toBeNull();
    expect(tile(s, 8, 8).remains ?? null).toBeNull();
  });

  it('ein abgestuerzter Hubschrauber hinterlaesst ein Wrack / a crashed helicopter leaves a wreck', () => {
    const s = g();
    s.factions[0].techs.push('armyAviation');
    addUnit(s, 'heli', 0, 5, 5, { fuel: 1 });
    ok(s, { type: 'endTurn' });
    expect(tile(s, 5, 5).remains).toMatchObject({ kind: 'wreck', unit: 'heli' });
  });
});

describe('Skelette bleiben dauerhaft / skeletons are permanent', () => {
  it('Skelette sammeln sich und bleiben ueber Runden / skeletons pile up and stay over rounds', () => {
    const { s } = killAt('infantry');
    expect(tile(s, 5, 5).remains).toMatchObject({ kind: 'skeleton', skeletons: 1 });
    const v = addUnit(s, 'mg', 1, 5, 5, { hp: 1 });
    const a = addUnit(s, 'artillery', 0, 5, 3);
    ok(s, { type: 'attack', unit: a.id, target: v.id });
    expect(tile(s, 5, 5).remains).toMatchObject({ kind: 'skeleton', skeletons: 2 });
    for (let i = 0; i < 6; i++) ok(s, { type: 'endTurn' });
    expect(tile(s, 5, 5).remains).toMatchObject({ kind: 'skeleton', skeletons: 2 });
  });

  it('ein Wrack uebernimmt vorhandene Skelette / a wreck keeps existing skeletons', () => {
    const { s } = killAt('sniper');
    const t = addUnit(s, 'tank', 1, 5, 5, { hp: 1 });
    const a = addUnit(s, 'artillery', 0, 5, 3);
    ok(s, { type: 'attack', unit: a.id, target: t.id });
    expect(tile(s, 5, 5).remains).toMatchObject({ kind: 'wreck', unit: 'tank', skeletons: 1 });
  });
});
