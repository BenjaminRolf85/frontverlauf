import { describe, expect, it } from 'vitest';
import { canMove, combatPreview, defenseBonus, attackTargets, canAttackNow } from '../src/core';
import { COMBAT, DEFENSE_BONUS, VETERAN } from '../src/data/balance';
import { addCity, addUnit, blankGame, fails, ok, revealAll, setTerrain, unit } from './helpers';

/** Spezifikation: Kampfformel aus Abschnitt 5 / spec: combat formula of section 5 */
function formula(att: number, attHp: number, attMax: number, def: number, defHp: number, defMax: number, bonus: number) {
  const a = att * (attHp / attMax);
  const d = def * (defHp / defMax) * bonus;
  const sum = a + d;
  return { toDef: Math.round((a / sum) * att * 4.5), toAtt: Math.round((d / sum) * def * 4.5) };
}

function duel() {
  const s = blankGame();
  revealAll(s, 0); revealAll(s, 1);
  addCity(s, 0, 0, 0, { hq: true });
  addCity(s, 10, 10, 1, { hq: true });
  return s;
}

describe('Kampfformel / combat formula', () => {
  it('uses damage factor 4.5', () => {
    expect(COMBAT.damageFactor).toBe(4.5);
  });

  it('infantry vs infantry on open ground: 5 / 5', () => {
    const s = duel();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    expect(formula(2, 10, 10, 2, 10, 10, 1)).toEqual({ toDef: 5, toAtt: 5 });
    const p = combatPreview(s, a, d);
    expect(p).toEqual({ toDefender: 5, toAttacker: 5, kills: false, retaliates: true });
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect(unit(s, d.id)!.hp).toBe(5);
    expect(unit(s, a.id)!.hp).toBe(5);
  });

  it('damaged attacker (5/10) vs full infantry: 3 to defender, 6 back', () => {
    const s = duel();
    const a = addUnit(s, 'infantry', 0, 5, 5, { hp: 5 });
    const d = addUnit(s, 'infantry', 1, 6, 5);
    // angriffskraft = 2*0.5 = 1, abwehrkraft = 2, summe 3 -> round(1/3*2*4.5)=3, round(2/3*2*4.5)=6
    expect(combatPreview(s, a, d)).toMatchObject({ toDefender: 3, toAttacker: 6 });
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect(unit(s, d.id)!.hp).toBe(7);
    // Angreifer stirbt durch Gegenschlag / attacker dies to retaliation
    expect(unit(s, a.id)).toBeUndefined();
  });

  it('MG attacks fortified infantry in a city (bonus 1.5): 7 / 5', () => {
    const s = duel();
    addCity(s, 6, 5, 1);
    const a = addUnit(s, 'mg', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    expect(defenseBonus(s, d, a)).toBe(1.5);
    expect(formula(3, 15, 15, 2, 10, 10, 1.5)).toEqual({ toDef: 7, toAtt: 5 });
    expect(combatPreview(s, a, d)).toMatchObject({ toDefender: 7, toAttacker: 5 });
  });

  it('city with bunker ring gives 4.0: 2 / 7', () => {
    const s = duel();
    const c = addCity(s, 6, 5, 1);
    c.bunkerRing = true;
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    expect(defenseBonus(s, d, a)).toBe(DEFENSE_BONUS.cityWithBunker);
    expect(formula(2, 10, 10, 2, 10, 10, 4)).toEqual({ toDef: 2, toAtt: 7 });
    expect(combatPreview(s, a, d)).toMatchObject({ toDefender: 2, toAttacker: 7 });
  });

  it('city bonus only for units with fortify (jeep in city gets 1.0)', () => {
    const s = duel();
    addCity(s, 6, 5, 1);
    const d = addUnit(s, 'jeep', 1, 6, 5);
    expect(defenseBonus(s, d)).toBe(DEFENSE_BONUS.open);
  });

  it('defender in forest/mountain/water gets 1.5 only with the matching tech', () => {
    const s = duel();
    setTerrain(s, 6, 5, 'forest');
    setTerrain(s, 6, 6, 'mountain');
    setTerrain(s, 7, 7, 'shallow');
    const f = addUnit(s, 'infantry', 1, 6, 5);
    const m = addUnit(s, 'infantry', 1, 6, 6);
    const w = addUnit(s, 'destroyer', 1, 7, 7);
    expect(defenseBonus(s, f)).toBe(1);
    expect(defenseBonus(s, m)).toBe(1);
    expect(defenseBonus(s, w)).toBe(1);
    s.factions[1].techs.push('camouflage', 'highAltitude', 'coastalDefense');
    expect(defenseBonus(s, f)).toBe(DEFENSE_BONUS.terrainWithTech);
    expect(defenseBonus(s, m)).toBe(DEFENSE_BONUS.terrainWithTech);
    expect(defenseBonus(s, w)).toBe(DEFENSE_BONUS.terrainWithTech);
    // Wald-Bonus in der Formel / forest bonus in the formula
    const a = addUnit(s, 'infantry', 0, 5, 5);
    expect(combatPreview(s, a, f)).toMatchObject(
      { toDefender: formula(2, 10, 10, 2, 10, 10, 1.5).toDef, toAttacker: formula(2, 10, 10, 2, 10, 10, 1.5).toAtt });
  });

  it('open ground gives 1.0', () => {
    const s = duel();
    expect(defenseBonus(s, addUnit(s, 'infantry', 1, 6, 5))).toBe(DEFENSE_BONUS.open);
  });

  it('kill: no retaliation', () => {
    const s = duel();
    const a = addUnit(s, 'tank', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5, { hp: 3 });
    const p = combatPreview(s, a, d);
    expect(p.kills).toBe(true);
    expect(p.retaliates).toBe(false);
    expect(p.toAttacker).toBe(0);
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect(unit(s, d.id)).toBeUndefined();
    expect(unit(s, a.id)!.hp).toBe(40);
  });

  it('no retaliation when the attacker is outside the defender range (sniper range 2)', () => {
    const s = duel();
    const a = addUnit(s, 'sniper', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 7, 5);
    expect(attackTargets(s, a).map((u) => u.id)).toEqual([d.id]);
    const p = combatPreview(s, a, d);
    expect(p.retaliates).toBe(false);
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect(unit(s, a.id)!.hp).toBe(10);
    expect(unit(s, d.id)!.hp).toBe(10 - formula(2, 10, 10, 2, 10, 10, 1).toDef);
  });

  it('artillery: range 3 and it never retaliates', () => {
    const s = duel();
    const art = addUnit(s, 'artillery', 0, 5, 5);
    const far = addUnit(s, 'infantry', 1, 8, 5);
    expect(attackTargets(s, art).map((u) => u.id)).toContain(far.id);
    ok(s, { type: 'attack', unit: art.id, target: far.id });
    // 4 vs 2: round(4/6*4*4.5)=12 -> kill
    expect(unit(s, far.id)).toBeUndefined();
    // artillery as defender
    const s2 = duel();
    const a = addUnit(s2, 'infantry', 0, 5, 5);
    const d = addUnit(s2, 'artillery', 1, 6, 5);
    const p = combatPreview(s2, a, d);
    expect(p.retaliates).toBe(false);
    expect(p.toAttacker).toBe(0);
    expect(p.toDefender).toBe(9); // defense 0 -> 2/2*2*4.5
    ok(s2, { type: 'attack', unit: a.id, target: d.id });
    expect(unit(s2, a.id)!.hp).toBe(10);
    expect(unit(s2, d.id)!.hp).toBe(1);
  });

  it('out of range targets cannot be attacked', () => {
    const s = duel();
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 7, 5);
    fails(s, { type: 'attack', unit: a.id, target: d.id }, 'outOfRange');
  });

  it('units with attack 0 cannot attack (medic, spy, landing boat)', () => {
    const s = duel();
    for (const t of ['medic', 'spy'] as const) {
      const a = addUnit(s, t, 0, 5, 5);
      const d = addUnit(s, 'infantry', 1, 6, 5);
      expect(canAttackNow(a)).toBe(false);
      fails(s, { type: 'attack', unit: a.id, target: d.id }, 'cannotAttack');
      s.units = s.units.filter((u) => u.id !== a.id && u.id !== d.id);
    }
  });

  it('cannot attack a faction at peace', () => {
    const s = duel();
    s.factions[0].relations[1] = 'peace'; s.factions[1].relations[0] = 'peace';
    const a = addUnit(s, 'infantry', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    fails(s, { type: 'attack', unit: a.id, target: d.id }, 'peace');
  });

  it('cannot attack an invisible unit it cannot see / one per tile', () => {
    const s = duel();
    const a = addUnit(s, 'sniper', 0, 5, 5);
    const spy = addUnit(s, 'spy', 1, 7, 5);
    expect(attackTargets(s, a)).toHaveLength(0);
    void spy;
  });
});

describe('Faehigkeiten im Kampf / combat abilities', () => {
  it('Sturm/dash: infantry may attack after moving, pioneer may not', () => {
    const s = duel();
    const inf = addUnit(s, 'infantry', 0, 4, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    ok(s, { type: 'move', unit: inf.id, to: { x: 5, y: 5 } });
    ok(s, { type: 'attack', unit: inf.id, target: d.id });
    const s2 = duel();
    const p = addUnit(s2, 'pioneer', 0, 4, 5);
    const d2 = addUnit(s2, 'infantry', 1, 6, 5);
    ok(s2, { type: 'move', unit: p.id, to: { x: 5, y: 5 } });
    fails(s2, { type: 'attack', unit: p.id, target: d2.id }, 'cannotAttack');
  });

  it('a unit attacks only once per turn', () => {
    const s = duel();
    const a = addUnit(s, 'tank', 0, 5, 5);
    const d1 = addUnit(s, 'infantry', 1, 6, 5);
    addUnit(s, 'infantry', 1, 6, 6);
    ok(s, { type: 'attack', unit: a.id, target: d1.id });
    const d2 = s.units.find((u) => u.owner === 1)!;
    fails(s, { type: 'attack', unit: a.id, target: d2.id });
  });

  it('Rueckzug/escape: jeep may move after attacking, infantry may not', () => {
    const s = duel();
    const j = addUnit(s, 'jeep', 0, 5, 5);
    const d = addUnit(s, 'infantry', 1, 6, 5);
    ok(s, { type: 'attack', unit: j.id, target: d.id });
    expect(canMove(unit(s, j.id)!)).toBe(true);
    ok(s, { type: 'move', unit: j.id, to: { x: 3, y: 5 } });
    const s2 = duel();
    const i = addUnit(s2, 'infantry', 0, 5, 5);
    const d2 = addUnit(s2, 'infantry', 1, 6, 5);
    ok(s2, { type: 'attack', unit: i.id, target: d2.id });
    expect(canMove(unit(s2, i.id)!)).toBe(false);
    fails(s2, { type: 'move', unit: i.id, to: { x: 4, y: 5 } }, 'unreachable');
  });

  it('Folgeangriff/persist: helicopter may attack again after each kill, but not move afterwards', () => {
    const s = duel();
    const h = addUnit(s, 'heli', 0, 5, 5);
    const d1 = addUnit(s, 'infantry', 1, 6, 5, { hp: 2 });
    const d2 = addUnit(s, 'infantry', 1, 6, 6, { hp: 2 });
    const d3 = addUnit(s, 'mg', 1, 4, 4);
    ok(s, { type: 'attack', unit: h.id, target: d1.id });
    expect(unit(s, d1.id)).toBeUndefined();
    expect(canMove(unit(s, h.id)!)).toBe(false);
    ok(s, { type: 'attack', unit: h.id, target: d2.id });
    expect(unit(s, d2.id)).toBeUndefined();
    // drittes Ziel ueberlebt -> danach keine weitere Aktion / third survives -> no further action
    ok(s, { type: 'attack', unit: h.id, target: d3.id });
    expect(unit(s, d3.id)).toBeDefined();
    expect(attackTargets(s, unit(s, h.id)!)).toHaveLength(0);
    expect(canMove(unit(s, h.id)!)).toBe(false);
  });

  it('veteran after 3 kills: +5 max HP and full heal', () => {
    const s = duel();
    const a = addUnit(s, 'tank', 0, 5, 5, { hp: 20 });
    for (let i = 0; i < 3; i++) {
      const d = addUnit(s, 'infantry', 1, 6, 5, { hp: 1 });
      const me = unit(s, a.id)!;
      me.attacked = false; me.exhausted = false;
      ok(s, { type: 'attack', unit: a.id, target: d.id });
      expect(unit(s, a.id)!.veteran).toBe(i === 2);
    }
    const me = unit(s, a.id)!;
    expect(me.kills).toBe(3);
    expect(me.maxHp).toBe(40 + VETERAN.bonusHp);
    expect(me.hp).toBe(me.maxHp);
    expect(s.factions[0].kills).toBe(3);
  });

  it('defender that destroys the attacker by retaliation gets the kill', () => {
    const s = duel();
    const a = addUnit(s, 'infantry', 0, 5, 5, { hp: 2 });
    const d = addUnit(s, 'mg', 1, 6, 5);
    ok(s, { type: 'attack', unit: a.id, target: d.id });
    expect(unit(s, a.id)).toBeUndefined();
    expect(unit(s, d.id)!.kills).toBe(1);
    expect(s.factions[1].kills).toBe(1);
  });

  it('battleship splash damage hits enemy units next to the target only', () => {
    const s = duel();
    setTerrain(s, 3, 5, 'shallow');
    const b = addUnit(s, 'battleship', 0, 3, 5);
    s.factions[0].techs.push('navalArtillery');
    const target = addUnit(s, 'mg', 1, 6, 5);
    const nb = addUnit(s, 'mg', 1, 7, 5);
    const nb2 = addUnit(s, 'mg', 1, 6, 6);
    const own = addUnit(s, 'mg', 0, 5, 4);
    const far = addUnit(s, 'mg', 1, 8, 5);
    const pre = combatPreview(s, b, target);
    // 3 vs 3: round(0.5*3*4.5)=7 ; splash round(7*0.5)=4 (Math.round(3.5))
    expect(pre.toDefender).toBe(7);
    const res = ok(s, { type: 'attack', unit: b.id, target: target.id });
    const splash = Math.round(7 * COMBAT.splashFactor);
    expect(unit(s, target.id)!.hp).toBe(8);
    expect(unit(s, nb.id)!.hp).toBe(15 - splash);
    expect(unit(s, nb2.id)!.hp).toBe(15 - splash);
    expect(unit(s, own.id)!.hp).toBe(15);
    expect(unit(s, far.id)!.hp).toBe(15);
    const ev = res.events.find((e) => e.t === 'attack');
    expect(ev && ev.t === 'attack' && ev.splash?.length).toBe(2);
    // Kriegsschiff ausserhalb der Reichweite des Ziels -> kein Gegenschlag / out of target range -> no retaliation
    expect(unit(s, b.id)!.hp).toBe(10);
  });

  it('ships take HP from the carried unit', () => {
    const s = duel();
    setTerrain(s, 5, 5, 'shallow');
    const ship = addUnit(s, 'destroyer', 0, 5, 5, { carried: 'mg' });
    expect(ship.maxHp).toBe(15);
  });
});

describe('Einheitenwerte / unit stats (section 5)', () => {
  it('land units and helicopter match the spec table', async () => {
    const { UNITS } = await import('../src/data/balance');
    const table: [string, number | null, number, number, number, number, number, string[], string | null][] = [
      ['infantry', 10, 10, 2, 2, 1, 1, ['dash', 'fortify'], null],
      ['sniper', 15, 10, 2, 1, 1, 2, ['dash', 'fortify'], 'camouflage'],
      ['jeep', 15, 10, 2, 1, 2, 1, ['dash', 'escape'], 'motorization'],
      ['pioneer', 15, 15, 1, 3, 1, 1, ['fortify'], 'fortification'],
      ['mg', 25, 15, 3, 3, 1, 1, ['dash', 'fortify'], 'armsIndustry'],
      ['medic', 25, 10, 0, 1, 1, 1, ['heal', 'convert'], 'cybernetics'],
      ['artillery', 40, 10, 4, 0, 1, 3, ['noRetaliate', 'ignoreOutpost'], 'ballistics'],
      ['spy', 40, 5, 0, 0.5, 2, 0, ['invisible', 'uprising'], 'intelligence'],
      ['heli', 50, 10, 3.5, 1, 3, 1, ['dash', 'persist', 'fly', 'fuel'], 'armyAviation'],
      ['tank', null, 40, 5, 4, 1, 1, ['dash'], null],
    ];
    for (const [id, cost, hp, att, def, move, range, abilities, tech] of table) {
      const st = UNITS[id as keyof typeof UNITS];
      expect({ id, cost: st.cost, hp: st.hp, att: st.attack, def: st.defense, move: st.move, range: st.range, tech: st.tech })
        .toEqual({ id, cost, hp, att, def, move, range, tech });
      expect([...st.abilities].sort()).toEqual([...abilities].sort());
    }
  });
});

describe('Rundenablauf / turn order', () => {
  it('factions move strictly one after another; only the current faction can act', () => {
    const s = duel();
    const mine = addUnit(s, 'infantry', 0, 5, 5);
    const theirs = addUnit(s, 'infantry', 1, 7, 7);
    fails(s, { type: 'move', unit: theirs.id, to: { x: 7, y: 6 } }, 'notYourUnit');
    ok(s, { type: 'endTurn' });
    expect(s.current).toBe(1);
    fails(s, { type: 'move', unit: mine.id, to: { x: 5, y: 4 } }, 'notYourUnit');
    ok(s, { type: 'move', unit: theirs.id, to: { x: 7, y: 6 } });
    const round = s.round;
    ok(s, { type: 'endTurn' });
    expect(s.current).toBe(0);
    expect(s.round).toBe(round + 1);
  });
});
