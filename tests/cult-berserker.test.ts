/**
 * Berserker des Kults: zwei Hiebe je Zug mit fester Schlagkraft (9 gegen Fusstruppen, wenig gegen Panzerung), keine
 * Verteidigung, Selbstsprengung (20 gegen Panzer, Fahrzeuge und Roboter), nur fuer den Kult, KI, Modell und Rolle.
 * The cult's berserker: two blows per turn with fixed striking power (9 against foot troops, little against armour), no
 * defence, self-detonation (20 against tanks, vehicles and robots), cult only, AI, model and role.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, combatPreview, createGame, defaultConfig, detonateTargets, recruitCheck, rosterUnits, strikeKind, trainCheck,
  type GameEvent, type GameState,
} from '../src/core';
import { AI, BERSERKER, CULT, CULT_UNITS, PERKS2, TWIN_STRIKE, UNITS, type FactionId, type UnitTypeId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { buildCtx } from '../src/ai/analysis';
import { detonateValue } from '../src/ai/tactics';
import { getUnitQuality, setUnitQuality, unitGeometry } from '../src/render/models';
import { hasIcon } from '../src/ui/icons';
import { UNIT_ROLE, unitRoleIcon } from '../src/ui/unitRoles';
import { addCity, addUnit, blankGame, fails, ok, revealAll, setTerrain, unit } from './helpers';

/** Kult gegen eine Fraktion, beide mit Hauptquartier, alles aufgedeckt / cult against one faction, both with HQs, all revealed */
function cultVs(b: FactionId = 'dravon', o: Parameters<typeof blankGame>[0] = {}): GameState {
  const s = blankGame({ factions: ['vesper', b], stars: 200, ...o });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}
type AttackEv = Extract<GameEvent, { t: 'attack' }>;
const attackEv = (ev: GameEvent[]) => ev.find((e) => e.t === 'attack') as AttackEv;

describe('Berserker: Werte / berserker: stats', () => {
  it('Kult-Einheit ohne Verteidigung, zwei Hiebe, 9 gegen Fusstruppen, Sprengung 20 / cult unit without defence, two blows, 9 vs foot troops, detonation 20', () => {
    const st = UNITS.berserker;
    expect(CULT_UNITS).toContain('berserker');
    expect(st.faction).toBe('vesper');
    expect(st.defense).toBe(0);
    expect(st.abilities).not.toContain('fortify');
    expect(st.abilities).toEqual(expect.arrayContaining(['dash', 'twinStrike', 'detonate']));
    expect(TWIN_STRIKE.strikes).toBe(2);
    expect(st.strike?.foot).toBe(9);
    // relativ wirkungslos gegen Panzer / relatively ineffective against tanks
    expect(st.strike!.armour).toBeLessThanOrEqual(2);
    expect(BERSERKER.detonate.armour).toBe(20);
    expect(BERSERKER.detonate.other).toBeLessThan(BERSERKER.detonate.armour);
    // Eiferer und Propheten rufen ihn / zealots and prophets call him up
    expect(CULT.recruiters.zealot).toContain('berserker');
    expect(CULT.recruiters.prophet).toContain('berserker');
  });

  it('Panzerung: Fahrzeuge, Laeufer, Mechs und Roboter; Fusstruppen; Flieger und Schiffe sonst / armour: vehicles, walkers, mechs and robots; foot; flyers and ships other', () => {
    for (const t of ['tank', 'steppeColossus', 'teslaTank', 'reliquary', 'doomCrawler', 'jeep', 'mech', 'tripod', 'titan', 'spider', 'flameTank', 'android', 'cyborg', 'kamikazeDrone', 'protoWalker'] as UnitTypeId[]) expect(strikeKind(t), t).toBe('armour');
    for (const t of ['infantry', 'mg', 'sniper', 'zealot', 'grey', 'marine', 'lightWarden', 'berserker'] as UnitTypeId[]) expect(strikeKind(t), t).toBe('foot');
    for (const t of ['heli', 'quadDrone', 'destroyer', 'portal', 'swarmMother'] as UnitTypeId[]) expect(strikeKind(t), t).toBe('other');
  });
});

describe('Berserker: zwei Hiebe / berserker: two blows', () => {
  it('zwei Angriffe je Zug, nicht drei; ein Ziel oder zwei; kein Ziehen nach dem ersten Hieb / two attacks per turn, not three; one target or two; no moving after the first blow', () => {
    const s = cultVs();
    const b = addUnit(s, 'berserker', 0, 5, 5);
    const i1 = addUnit(s, 'mg', 1, 6, 5);
    const i2 = addUnit(s, 'mg', 1, 4, 5);
    const r1 = ok(s, { type: 'attack', unit: b.id, target: i1.id });
    expect(attackEv(r1.events).strike).toBe(1);
    // nach dem ersten Hieb: kein Ziehen, aber angriffsbereit / after the first blow: no moving, but ready to attack
    fails(s, { type: 'move', unit: b.id, to: { x: 5, y: 6 } });
    const r2 = ok(s, { type: 'attack', unit: b.id, target: i2.id });
    expect(attackEv(r2.events).strike).toBe(2);
    // kein dritter Hieb / no third blow
    fails(s, { type: 'attack', unit: b.id, target: i1.id }, 'cannotAttack');
    expect(unit(s, b.id)!.exhausted).toBe(true);
    // naechster eigener Zug: wieder zwei / next own turn: two again
    ok(s, { type: 'endTurn' }); ok(s, { type: 'endTurn' });
    expect(unit(s, b.id)!.strikes).toBeUndefined();
    // dasselbe Ziel zweimal (frischer Infanterist, 10 LP: 9 + 9); der Berserker ist von den Gegenschlaegen angeschlagen
    // the same target twice (fresh infantryman, 10 HP: 9 + 9); the berserker is battered by the return fire
    unit(s, b.id)!.hp = UNITS.berserker.hp;
    const i3 = addUnit(s, 'infantry', 1, 5, 6);
    ok(s, { type: 'attack', unit: b.id, target: i3.id });
    expect(unit(s, i3.id)!.hp).toBe(UNITS.infantry.hp - 9);
    ok(s, { type: 'attack', unit: b.id, target: i3.id });
    expect(unit(s, i3.id)).toBeUndefined();
    fails(s, { type: 'attack', unit: b.id, target: i2.id }, 'cannotAttack');
  });

  it('9 Schaden je vollem Treffer gegen Fusstruppen, auch nach Bewegung und in Deckung / 9 damage per full hit vs foot troops, also after moving and in cover', () => {
    const s = cultVs();
    const b = addUnit(s, 'berserker', 0, 3, 5);
    const mg = addUnit(s, 'mg', 1, 5, 5);
    setTerrain(s, 5, 5, 'forest');
    ok(s, { type: 'move', unit: b.id, to: { x: 4, y: 5 } });
    expect(combatPreview(s, unit(s, b.id)!, mg).toDefender).toBe(9);
    expect(combatPreview(s, unit(s, b.id)!, mg).moveFire).toBe(false);
    const hp = mg.hp;
    const r = ok(s, { type: 'attack', unit: b.id, target: mg.id });
    expect(attackEv(r.events).dmg).toBe(9);
    expect(unit(s, mg.id)!.hp).toBe(hp - 9);
    // zwei Hiebe toeten einen Infanteristen sicher / two blows kill an infantryman for sure
    const s2 = cultVs();
    const b2 = addUnit(s2, 'berserker', 0, 5, 5);
    const inf = addUnit(s2, 'infantry', 1, 6, 5);
    ok(s2, { type: 'attack', unit: b2.id, target: inf.id });
    expect(unit(s2, inf.id)!.hp).toBe(UNITS.infantry.hp - 9);
    ok(s2, { type: 'attack', unit: b2.id, target: inf.id });
    expect(unit(s2, inf.id)).toBeUndefined();
  });

  it('mit Trefferglueck: voller Treffer 9, Spanne nach Trefferart / with hit luck: full hit 9, range by hit kind', () => {
    const s = cultVs('dravon', { hitChance: true });
    const b = addUnit(s, 'berserker', 0, 5, 5);
    const inf = addUnit(s, 'infantry', 1, 6, 5);
    const p = combatPreview(s, b, inf);
    expect(p.toDefender).toBe(9);
    expect(p.max).toBe(Math.round(9 * 1.5));
  });

  it('wenig Schaden gegen Panzer und Roboter, sie schlagen zurueck / little damage against tanks and robots, they strike back', () => {
    const s = cultVs('nexus');
    const b = addUnit(s, 'berserker', 0, 5, 5);
    const titan = addUnit(s, 'titan', 1, 6, 5);
    const android = addUnit(s, 'android', 1, 4, 5);
    expect(combatPreview(s, b, titan).toDefender).toBe(UNITS.berserker.strike!.armour);
    expect(combatPreview(s, b, android).toDefender).toBe(UNITS.berserker.strike!.armour);
    expect(combatPreview(s, b, titan).toDefender).toBeLessThan(combatPreview(s, b, titan).toAttacker);
    const s2 = cultVs('dravon');
    const b2 = addUnit(s2, 'berserker', 0, 5, 5);
    const tank = addUnit(s2, 'tank', 1, 6, 5);
    const r = ok(s2, { type: 'attack', unit: b2.id, target: tank.id });
    expect(attackEv(r.events).dmg).toBeLessThanOrEqual(2);
    expect(attackEv(r.events).ret).toBeGreaterThan(0);
  });

  it('Verteidigung 0: voller Schaden, kein Gegenschlag / defence 0: full damage, no return fire', () => {
    const s = cultVs();
    const b = addUnit(s, 'berserker', 0, 5, 5);
    const inf = addUnit(s, 'infantry', 1, 6, 5);
    s.current = 1;
    const p = combatPreview(s, inf, b);
    // Formel mit Verteidigung 0: Angriff x Schadensfaktor / formula with defence 0: attack x damage factor
    expect(p.toDefender).toBe(Math.round(UNITS.infantry.attack * 4.5));
    // ohne Verteidigungswert kein Gegenschlag / no defence value, no return fire
    expect(p.retFull).toBe(0);
    expect(p.toAttacker).toBe(0);
  });
});

describe('Berserker: Selbstsprengung / berserker: self-detonation', () => {
  it('20 Schaden an Panzer, Fahrzeug und Roboter, kein Gegenschlag, der Berserker stirbt / 20 damage to tank, vehicle and robot, no return fire, the berserker dies', () => {
    for (const [foe, type] of [['dravon', 'tank'], ['korvat', 'steppeColossus'], ['nexus', 'titan'], ['nexus', 'spider'], ['zyrr', 'mech'], ['dravon', 'jeep']] as [FactionId, UnitTypeId][]) {
      const s = cultVs(foe);
      const b = addUnit(s, 'berserker', 0, 5, 5);
      const t = addUnit(s, type, 1, 6, 5);
      const hp = t.hp, stars = s.factions[0].stars;
      const r = ok(s, { type: 'detonate', unit: b.id, target: t.id });
      const e = attackEv(r.events);
      expect(e.detonate, type).toBe(true);
      expect(e.dmg, type).toBe(20);
      expect(e.ret, type).toBe(0);
      expect(unit(s, b.id), type).toBeUndefined();
      if (hp > 20) expect(unit(s, t.id)!.hp, type).toBe(hp - 20);
      else expect(unit(s, t.id), type).toBeUndefined();
      // Maertyrertum: der Gesprengte zaehlt als Gefallener / martyrdom: the detonated one counts as fallen
      expect(s.factions[0].stars, type).toBe(stars + PERKS2.martyrdomStars);
    }
  });

  it('Roboter-Fusstruppen nehmen 20, andere Fusstruppen nur den kleinen Wert / robot foot troops take 20, other foot troops only the small value', () => {
    const s = cultVs('nexus');
    const b = addUnit(s, 'berserker', 0, 5, 5);
    const cy = addUnit(s, 'cyborg', 1, 6, 5);
    ok(s, { type: 'detonate', unit: b.id, target: cy.id });
    expect(unit(s, cy.id)).toBeUndefined();
    const s2 = cultVs('dravon');
    const b2 = addUnit(s2, 'berserker', 0, 5, 5);
    const mg = addUnit(s2, 'mg', 1, 6, 5);
    ok(s2, { type: 'detonate', unit: b2.id, target: mg.id });
    expect(unit(s2, mg.id)!.hp).toBe(UNITS.mg.hp - BERSERKER.detonate.other);
    expect(unit(s2, b2.id)).toBeUndefined();
  });

  it('keine Flieger, Schiffe, entfernten Ziele; nur einmal statt eines Hiebs / no flyers, ships, distant targets; only instead of a blow', () => {
    const s = cultVs();
    const b = addUnit(s, 'berserker', 0, 5, 5);
    const heli = addUnit(s, 'heli', 1, 6, 5);
    const far = addUnit(s, 'tank', 1, 7, 5);
    setTerrain(s, 4, 5, 'shallow');
    const ship = addUnit(s, 'destroyer', 1, 4, 5);
    fails(s, { type: 'detonate', unit: b.id, target: heli.id }, 'detonateTarget');
    fails(s, { type: 'detonate', unit: b.id, target: ship.id }, 'detonateTarget');
    fails(s, { type: 'detonate', unit: b.id, target: far.id }, 'outOfRange');
    expect(detonateTargets(s, b)).toEqual([]);
    // andere Einheiten koennen sich nicht sprengen / other units cannot detonate
    const z = addUnit(s, 'zealot', 0, 6, 6);
    fails(s, { type: 'detonate', unit: z.id, target: far.id }, 'cannotDetonate');
    // nach dem ersten Hieb noch moeglich, nach dem zweiten nicht / still possible after the first blow, not after the second
    const s2 = cultVs();
    const b2 = addUnit(s2, 'berserker', 0, 5, 5);
    const inf = addUnit(s2, 'mg', 1, 4, 5);
    const tank = addUnit(s2, 'tank', 1, 6, 5);
    ok(s2, { type: 'attack', unit: b2.id, target: inf.id });
    expect(detonateTargets(s2, b2).map((o) => o.id)).toContain(tank.id);
    ok(s2, { type: 'attack', unit: b2.id, target: inf.id });
    fails(s2, { type: 'detonate', unit: b2.id, target: tank.id }, 'cannotAttack');
  });
});

describe('Berserker: nur der Kult / berserker: cult only', () => {
  it('Eiferer ruft ihn, andere Fraktionen haben ihn nicht / a zealot calls him up, other factions do not have him', () => {
    const s = cultVs();
    const z = addUnit(s, 'zealot', 0, 2, 2);
    expect(recruitCheck(s, 0, z.id, 'berserker', 3, 2)).toBe('ok');
    const r = ok(s, { type: 'recruit', unit: z.id, unitType: 'berserker', x: 3, y: 2 });
    expect(r.events.some((e) => e.t === 'recruit')).toBe(true);
    expect(rosterUnits(s, 0)).toContain('berserker');
    for (const f of ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'nexus'] as FactionId[]) {
      const t = blankGame({ factions: [f, 'vesper'], stars: 200 });
      const c = addCity(t, 2, 2, 0, { hq: true });
      expect(rosterUnits(t, 0), f).not.toContain('berserker');
      expect(trainCheck(t, c, 'berserker'), f).toBe('invalid');
    }
  });
});

describe('Berserker: KI / berserker: AI', () => {
  /** Zug der KI ausspielen, Befehle sammeln / play the AI's turn, collect commands */
  function aiTurn(s: GameState) {
    const cmds: { type: string; unit?: number; target?: number }[] = [];
    for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
      const cmd = planNextCommand(s, 0);
      const r = applyCommand(s, cmd);
      expect(r.ok, JSON.stringify(cmd)).toBe(true);
      cmds.push(cmd as { type: string; unit?: number; target?: number });
      if (cmd.type === 'endTurn') break;
    }
    return cmds;
  }

  it('Fusstruppen: zwei Hiebe statt Sprengung; voller Panzer: Sprengung lohnt / foot troops: two blows instead of detonation; full tank: detonation pays', () => {
    const s = cultVs();
    s.factions[0].human = false;
    const b = addUnit(s, 'berserker', 0, 5, 5);
    addUnit(s, 'infantry', 1, 6, 5);
    addUnit(s, 'infantry', 1, 6, 6);
    const cmds = aiTurn(s);
    expect(cmds.filter((c) => c.type === 'attack' && c.unit === b.id)).toHaveLength(2);
    expect(cmds.some((c) => c.type === 'detonate')).toBe(false);
    const s2 = cultVs();
    s2.factions[0].human = false;
    const b2 = addUnit(s2, 'berserker', 0, 5, 5);
    const tank = addUnit(s2, 'tank', 1, 6, 5);
    expect(detonateValue(buildCtx(s2, 0), b2, tank)).toBeGreaterThanOrEqual(BERSERKER.ai.detonateMin);
    const cmds2 = aiTurn(s2);
    expect(cmds2.some((c) => c.type === 'detonate' && c.unit === b2.id && c.target === tank.id)).toBe(true);
    // nicht verschwenderisch: kein Sprengen an einem Infanteristen / not wasteful: no detonation at an infantryman
    const s3 = cultVs();
    s3.factions[0].human = false;
    const b3 = addUnit(s3, 'berserker', 0, 5, 5);
    const inf = addUnit(s3, 'infantry', 1, 6, 5);
    expect(detonateValue(buildCtx(s3, 0), b3, inf)).toBeLessThan(BERSERKER.ai.detonateMin);
  });

  it('KI-Partie: der Kult ruft Berserker, schlaegt doppelt zu und sprengt, ohne Fehlbefehl / AI game: the cult calls up berserkers, strikes twice and detonates, without a failed command', () => {
    const ids: FactionId[] = ['vesper', 'korvat', 'nexus', 'dravon'];
    const s = createGame(defaultConfig({ seed: 5, size: 14, mode: 'conquest', mapType: 'continent', factionVictory: false,
      factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));
    let failed = 0, recruited = 0, second = 0, detonations = 0;
    while (!s.over && s.round <= 60) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const r = applyCommand(s, cmd);
        if (!r.ok) failed++;
        if (r.ok && cmd.type === 'recruit' && cmd.unitType === 'berserker') recruited++;
        for (const e of r.events) {
          if (e.t === 'attack' && e.strike === 2) second++;
          if (e.t === 'attack' && e.detonate) detonations++;
        }
        if (cmd.type === 'endTurn' && r.ok) break;
      }
    }
    expect(failed).toBe(0);
    expect(recruited).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
    expect(detonations).toBeGreaterThan(0);
  }, 120_000);
});

describe('Berserker: Modell und Rolle / berserker: model and role', () => {
  it('eigene Rolle mit Symbol, Modell im Budget und auf dem Feld / own role with icon, model within budget and on the tile', () => {
    expect(UNIT_ROLE.berserker).toBe('berserker');
    expect(unitRoleIcon('berserker')).toBe('roleBerserker');
    expect(hasIcon('roleBerserker')).toBe(true);
    const start = getUnitQuality();
    for (const q of ['high', 'low'] as const) {
      setUnitQuality(q);
      const g = unitGeometry('berserker', 'vesper', null);
      const tris = g.getAttribute('position').count / 3;
      // hoch: Detailrunde 4 (Gesicht, Bart, Bemalung), siehe BUDGET in unit-model-budget / high: detail round 4 (face, beard, paint), see BUDGET in unit-model-budget
      expect(tris).toBeLessThan(q === 'high' ? 8500 : 3200);
      g.computeBoundingBox();
      expect(g.boundingBox!.max.y).toBeLessThanOrEqual(0.625);
      // eigener Umriss: nicht dasselbe Modell wie der Eiferer / own outline: not the same model as the zealot
      expect(tris).not.toBe(unitGeometry('zealot', 'vesper', null).getAttribute('position').count / 3);
    }
    setUnitQuality(start);
  });
});
