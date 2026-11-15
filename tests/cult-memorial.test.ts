/**
 * Kult: Mahnmal. Gefallene Soldaten werden zur Schau gestellt; vom Mahnmal-Feld aus greift der Kult staerker an,
 * menschliche Angreifer schwaecher (Furcht); Roboter und Ausserirdische bleiben unberuehrt.
 * Cult: memorial. Fallen soldiers are put on display; from the memorial tile the cult attacks harder, human attackers
 * weaker (fear); robots and aliens are unaffected.
 */
import { describe, expect, it } from 'vitest';
import { combatPreview, leavesMemorial, memorialAt, memorialEffect, memorialMult, returnFire, type GameState } from '../src/core';
import { CULT, type FactionId } from '../src/data/balance';
import { setLanguage } from '../src/i18n/i18n';
import { memorialGeometry } from '../src/render/models';
import { rulesHtml } from '../src/ui/rules';
import { addCity, addUnit, blankGame, endTurn, ok, revealAll, tile } from './helpers';

/** Partie mit Kult (Index 0) und weiteren Fraktionen, Hauptquartiere weit weg / game with the cult (index 0) and others, HQs far away */
function game(others: FactionId[] = ['korvat'], withCult = true): GameState {
  const ids: FactionId[] = withCult ? ['vesper', ...others] : others;
  const s = blankGame({ factions: ids, size: 11 });
  ids.forEach((_, i) => addCity(s, i * 2, 10, i, { hq: true, radius: 0 }));
  ids.forEach((_, i) => revealAll(s, i));
  return s;
}

describe('Mahnmal entsteht / memorial is created', () => {
  it('beim Tod eines Soldaten, nicht eines Fahrzeugs / on a soldier death, not a vehicle death', () => {
    const s = game();
    const z1 = addUnit(s, 'zealot', 0, 4, 5);
    addUnit(s, 'infantry', 1, 5, 5, { hp: 1 });
    ok(s, { type: 'attack', unit: z1.id, target: s.units[1].id });
    expect(s.units.some((u) => u.x === 5 && u.y === 5)).toBe(false);
    expect(tile(s, 5, 5).memorial).toEqual({ until: s.round + CULT.memorialRounds, unit: 'infantry', faction: 1 });
    expect(memorialAt(s, 5, 5)).not.toBeNull();

    const z2 = addUnit(s, 'zealot', 0, 4, 7);
    addUnit(s, 'jeep', 1, 5, 7, { hp: 1 });
    ok(s, { type: 'attack', unit: z2.id, target: s.units.find((u) => u.type === 'jeep')!.id });
    expect(tile(s, 5, 7).remains?.kind).toBe('wreck');
    expect(tile(s, 5, 7).memorial ?? null).toBeNull();
  });

  it('auch fuer gefallene Fanatiker (Maertyrer) / also for fallen fanatics (martyrs)', () => {
    const s = game();
    const inf = addUnit(s, 'infantry', 1, 4, 5);
    addUnit(s, 'zealot', 0, 5, 5, { hp: 1 });
    s.current = 1;
    ok(s, { type: 'attack', unit: inf.id, target: s.units[1].id });
    expect(tile(s, 5, 5).memorial?.unit).toBe('zealot');
    expect(tile(s, 5, 5).memorial?.faction).toBe(0);
  });

  it('nur Fusstruppen hinterlassen ein Mahnmal / only foot troops leave a memorial', () => {
    for (const t of ['infantry', 'sniper', 'zealot', 'grey', 'android', 'steppeRider'] as const) expect(leavesMemorial(t), t).toBe(true);
    for (const t of ['tank', 'jeep', 'heli', 'mech', 'titan', 'doomCrawler', 'destroyer', 'portal', 'swarmMother'] as const) expect(leavesMemorial(t), t).toBe(false);
  });

  it('ohne Kult im Spiel kein Mahnmal / no memorial without a cult in the game', () => {
    const s = game(['korvat', 'dravon'], false);
    const a = addUnit(s, 'infantry', 0, 4, 5);
    addUnit(s, 'infantry', 1, 5, 5, { hp: 1 });
    ok(s, { type: 'attack', unit: a.id, target: s.units[1].id });
    expect(tile(s, 5, 5).memorial ?? null).toBeNull();
  });

  it('nicht in Staedten / not in cities', () => {
    const s = game();
    addCity(s, 5, 5, 1, { radius: 0 });
    const z = addUnit(s, 'zealot', 0, 4, 5);
    addUnit(s, 'infantry', 1, 5, 5, { hp: 1 });
    ok(s, { type: 'attack', unit: z.id, target: s.units[1].id });
    expect(tile(s, 5, 5).memorial ?? null).toBeNull();
  });

  it('ein neuer Tod erneuert die Dauer, kein Stapeln / a new death refreshes the duration, no stacking', () => {
    const s = game();
    tile(s, 5, 5).memorial = { until: s.round + 1, unit: 'infantry', faction: 1 };
    const z = addUnit(s, 'zealot', 0, 4, 5);
    addUnit(s, 'mg', 1, 5, 5, { hp: 1 });
    ok(s, { type: 'attack', unit: z.id, target: s.units[1].id });
    expect(tile(s, 5, 5).memorial).toEqual({ until: s.round + CULT.memorialRounds, unit: 'mg', faction: 1 });
    expect(memorialMult(s, { ...z, x: 5, y: 5 })).toBe(1 + CULT.memorialAttack);
  });
});

describe('Mahnmal laeuft ab / memorial expires', () => {
  it(`nach der Todesrunde plus ${CULT.memorialRounds} Runden / after the round of death plus ${CULT.memorialRounds} rounds`, () => {
    const s = game();
    addUnit(s, 'zealot', 0, 2, 2);
    addUnit(s, 'infantry', 1, 8, 2);
    const r0 = s.round;
    tile(s, 5, 5).memorial = { until: r0 + CULT.memorialRounds, unit: 'infantry', faction: 1 };
    while (s.round < r0 + CULT.memorialRounds) { endTurn(s); endTurn(s); }
    expect(s.round).toBe(r0 + CULT.memorialRounds);
    expect(memorialAt(s, 5, 5)).not.toBeNull();
    endTurn(s); endTurn(s);
    expect(s.round).toBe(r0 + CULT.memorialRounds + 1);
    expect(memorialAt(s, 5, 5)).toBeNull();
    expect(tile(s, 5, 5).memorial).toBeNull();
  });

  it('wirkt nicht mehr, wenn der Kult ausgeschieden ist / inactive once the cult is eliminated', () => {
    const s = game();
    tile(s, 5, 5).memorial = { until: s.round + 3, unit: 'infantry', faction: 1 };
    expect(memorialAt(s, 5, 5)).not.toBeNull();
    s.factions[0].alive = false;
    expect(memorialAt(s, 5, 5)).toBeNull();
  });

  it('bleibt in Spielstand und Kopie erhalten / survives save and copy (JSON)', () => {
    const s = game();
    tile(s, 5, 5).memorial = { until: s.round + 3, unit: 'zealot', faction: 0 };
    const c = JSON.parse(JSON.stringify(s)) as GameState;
    expect(memorialAt(c, 5, 5)).toEqual({ until: s.round + 3, unit: 'zealot', faction: 0 });
  });
});

describe('Mahnmal im Kampf / memorial in combat', () => {
  /** Angreifer auf (4,5), Ziel auf (5,5); mit/ohne Mahnmal unter dem Angreifer / attacker on (4,5), target on (5,5) */
  function duel(attacker: Parameters<typeof addUnit>[1], owner: number, defender: Parameters<typeof addUnit>[1], defOwner: number, others: FactionId[], on: boolean) {
    const s = game(others);
    if (on) tile(s, 4, 5).memorial = { until: s.round + 2, unit: 'infantry', faction: 1 };
    const a = addUnit(s, attacker, owner, 4, 5);
    const d = addUnit(s, defender, defOwner, 5, 5);
    return { s, a, d, pre: combatPreview(s, a, d) };
  }
  const others: FactionId[] = ['korvat', 'nexus', 'zyrr'];

  it('Kult-Angreifer bekommt den Bonus / cult attacker gets the bonus', () => {
    const off = duel('torchbearer', 0, 'infantry', 1, others, false);
    const on = duel('torchbearer', 0, 'infantry', 1, others, true);
    expect(memorialEffect(on.s, on.a)).toBe('zeal');
    expect(on.pre.memorial).toBe(1 + CULT.memorialAttack);
    expect(off.pre.memorial).toBe(1);
    expect(on.pre.toDefender).toBeGreaterThan(off.pre.toDefender);
    // etwa +25 % (beide Werte gerundet) / about +25 % (both values rounded)
    expect(Math.abs(on.pre.toDefender - off.pre.toDefender * (1 + CULT.memorialAttack))).toBeLessThanOrEqual(1);
  });

  it('menschlicher Angreifer bekommt Furcht / human attacker gets fear', () => {
    const off = duel('tank', 1, 'zealot', 0, others, false);
    const on = duel('tank', 1, 'zealot', 0, others, true);
    expect(memorialEffect(on.s, on.a)).toBe('fear');
    expect(on.pre.memorial).toBe(1 - CULT.memorialFear);
    expect(on.pre.toDefender).toBeLessThan(off.pre.toDefender);
  });

  it('Roboter und Ausserirdische bleiben unberuehrt / robots and aliens are unaffected', () => {
    for (const [type, owner] of [['android', 2], ['titan', 2], ['grey', 3], ['mech', 3]] as const) {
      const off = duel(type, owner, 'zealot', 0, others, false);
      const on = duel(type, owner, 'zealot', 0, others, true);
      expect(memorialEffect(on.s, on.a), type).toBeNull();
      expect(on.pre.memorial, type).toBe(1);
      expect(on.pre.toDefender, type).toBe(off.pre.toDefender);
    }
  });

  it('nur fuer den Angriff: Mahnmal unter dem Ziel und Gegenschlag unveraendert / attack only: memorial under the target and return fire unchanged', () => {
    // Mahnmal unter dem verteidigenden Eiferer: der Panzer greift normal an / memorial under the defending zealot: the tank attacks normally
    const s = game(others);
    tile(s, 5, 5).memorial = { until: s.round + 2, unit: 'infantry', faction: 1 };
    const a = addUnit(s, 'infantry', 1, 4, 5);
    const d = addUnit(s, 'zealot', 0, 5, 5);
    const base = combatPreview(s, a, d);
    expect(base.memorial).toBe(1);
    const ret = returnFire(s, a, d, 5);
    tile(s, 5, 5).memorial = null;
    expect(combatPreview(s, a, d).toDefender).toBe(base.toDefender);
    expect(returnFire(s, a, d, 5)).toBe(ret);
  });

  it('der echte Angriff nutzt den Faktor / the actual attack uses the factor', () => {
    const on = duel('torchbearer', 0, 'mg', 1, others, true);
    const r = ok(on.s, { type: 'attack', unit: on.a.id, target: on.d.id });
    const ev = r.events.find((e) => e.t === 'attack') as { dmg: number };
    expect(ev.dmg).toBe(on.pre.toDefender);
  });
});

describe('Mahnmal in den Regeln / memorial in the rules', () => {
  it('Regelseite nennt das Mahnmal mit Zahlen / rules page names the memorial with numbers', () => {
    for (const lang of ['de', 'en'] as const) {
      setLanguage(lang);
      const html = rulesHtml('cult');
      expect(html).toContain(lang === 'de' ? 'Mahnmal' : 'Memorial');
      expect(html).toContain(`+${Math.round(CULT.memorialAttack * 100)} %`);
      expect(html).toContain(`-${Math.round(CULT.memorialFear * 100)} %`);
    }
    setLanguage('de');
  });
});

describe('Mahnmal-Modell / memorial model', () => {
  it('baut fuer jede Fraktion eine schlanke Geometrie / builds a lean geometry for every faction', () => {
    for (const f of ['korvat', 'vesper', 'nexus', 'zyrr'] as const) {
      const g = memorialGeometry(f);
      const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      expect(tris, f).toBeGreaterThan(100);
      expect(tris, f).toBeLessThan(4000);
      g.computeBoundingBox();
      // schmal genug fuer die Feldecke, nicht hoeher als 0,7 / slim enough for the tile corner, no taller than 0.7
      expect(g.boundingBox!.max.y).toBeLessThan(0.7);
      expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeLessThan(0.35);
    }
  });
});
