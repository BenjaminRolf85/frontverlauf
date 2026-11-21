/**
 * Meridon, Spielerwunsch "Silos statt Panzerfabrik, keine Artillerie, Marines statt Soldaten, nicht mehr zwei gleichzeitig":
 * kein Panzer, keine Artillerie, keine Geschuetzgiesserei und kein Panzerwerk; Marines ersetzen die Infanterie in jeder
 * Quelle; der Lenkflugkoerper kommt aus dem Raketensilo (Preis, Platz, Stadtlimit, einmal je Zug, unabhaengig vom Start);
 * erobertes Panzerwerk baut Lenkflugkoerper, Geschuetzwerk bringt Sterne; Marines sind amphibisch; die KI bildet Marines
 * aus, baut ein Silo und kauft dort.
 * Meridon, player request "silos instead of a tank factory, no artillery, marines instead of soldiers, no longer two at
 * once": no tank, no artillery, no foundry and no tank works; marines replace the infantry in every source; the Guided
 * Missile comes from the rocket silo (price, placement, city limit, once per turn, independent of the launch); a captured
 * tank factory builds Guided Missiles, gun works bring stars; marines are amphibious; the AI trains marines, builds a silo
 * and buys there.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, baseStars, buildCheck, canAttackNow, cityIncome, cloneState, createGame, defaultConfig, factionVariant, missionConfig, rosterUnits,
  siloBuyCheck, siteUseful, supportedUnits, trainCheck, unitCost, unitLimit, type City, type CommandResult, type GameEvent, type GameState,
} from '../src/core';
import { BASES, INCOME, MARINES, PRODUCTION, SILO, UNITS, UPKEEP, VARIANTS, type BaseKind, type FactionId } from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { siloCards } from '../src/ui/troops';
import { setLanguage, t } from '../src/i18n/i18n';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile, unit } from './helpers';

/** Meridon (0) gegen Korvat (1), Meridon-Hauptquartier mit Silo daneben / Meridon (0) against Korvat (1), Meridon HQ with a silo next to it */
function siloGame(o: { stars?: number; level?: number } = {}) {
  const s = blankGame({ factions: ['meridon', 'korvat'], stars: o.stars ?? 200 });
  const hq = addCity(s, 2, 2, 0, { hq: true, level: o.level ?? 3 });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  tile(s, 3, 3).turret = { hp: SILO.hp, active: true, owner: 0, kind: 'silo', ready: s.round };
  return { s, hq, silo: { x: 3, y: 3 } };
}
const buy = (x: number, y: number) => ({ type: 'siloBuy' as const, x, y, unitType: 'guidedMissile' as const });
const bought = (r: CommandResult) => r.events.find((e): e is Extract<GameEvent, { t: 'siloBuy' }> => e.t === 'siloBuy')!;
function addBase(s: GameState, x: number, y: number, owner: number | null, kind: BaseKind): City {
  const c = addCity(s, x, y, owner);
  c.base = kind;
  return c;
}

describe('Meridon: Liste ohne Panzer und Artillerie / Meridon: roster without tanks and artillery', () => {
  it('kein Panzer, keine Artillerie, kein Panzerwerk und keine Geschuetzgiesserei / no tank, no artillery, no tank works and no foundry', () => {
    const { s, hq } = siloGame({ stars: 500 });
    const list = rosterUnits(s, 0);
    for (const u of ['tank', 'artillery', 'infantry', 'sunLance', 'teslaTank'] as const) expect(list, u).not.toContain(u);
    // keine Ersatzeinheit fuer die Artillerie in der Giesserei, keine fuer den Panzer im Panzerwerk / no substitute in the foundry or the tank works
    expect(PRODUCTION.units.foundry.some((u) => list.includes(u))).toBe(false);
    expect(PRODUCTION.units.tankWorks.some((u) => list.includes(u))).toBe(false);
    expect(siteUseful(s, 0, 'foundry')).toBe(false);
    expect(siteUseful(s, 0, 'tankWorks')).toBe(false);
    // Bauliste: beide fehlen fuer Meridon (wrongFaction blendet sie aus), andere Fraktionen bauen sie / build list: both are missing for Meridon, other factions build them
    expect(buildCheck(s, 0, 'foundry', 3, 1)).toMatchObject({ ok: false, error: 'wrongFaction' });
    expect(buildCheck(s, 0, 'tankWorks', 3, 1)).toMatchObject({ ok: false, error: 'wrongFaction' });
    expect(buildCheck(s, 0, 'armory', 3, 1)).toMatchObject({ ok: true });
    const k = addCity(s, 6, 2, 1);
    s.factions[1].stars = 500;
    // Korvat: nur die Voraussetzung (Forstbetrieb) fehlt, die Giesserei steht in der Liste / Korvat: only the prerequisite (lumber camp) is missing, the foundry is listed
    expect(buildCheck(s, 1, 'foundry', 7, 2)).toMatchObject({ ok: false, error: 'buildingMissing' });
    expect(siteUseful(s, 1, 'foundry')).toBe(true);
    // auch mit eingebauten Staetten keine Ausbildung / no training even with built-in sites
    hq.works = ['foundry', 'tankWorks'];
    for (const u of ['tank', 'artillery'] as const) expect(trainCheck(s, hq, u), u).toBe('invalid');
    expect(trainCheck(s, hq, 'guidedMissile')).toBe('siloOnly');
    expect(trainCheck(s, k, 'guidedMissile')).toBe('invalid');
  });
});

describe('Marines ersetzen die Infanterie / marines replace the infantry', () => {
  it('Werte: stark, aber sehr teuer; amphibisch; Kaserne / stats: strong but very expensive; amphibious; barracks', () => {
    const m = UNITS.marine, inf = UNITS.infantry;
    expect(m.faction).toBe('meridon');
    expect(MARINES.unit).toBe('marine');
    expect(VARIANTS.meridon?.infantry).toBe('marine');
    // mehr als doppelt so teuer wie die Infanterie, auch im Sold (gemessen: 24 Sterne, Sold 5) / more than twice the infantry's price, upkeep too (measured: 24 stars, upkeep 5)
    expect(m.cost!).toBeGreaterThan(inf.cost! * 2);
    expect(UPKEEP.flat.marine!).toBeGreaterThan(Math.ceil(inf.cost! * UPKEEP.share));
    expect(m.hp).toBeGreaterThan(inf.hp);
    expect(m.attack).toBeGreaterThan(inf.attack);
    expect(m.defense).toBeGreaterThan(inf.defense);
    expect(m.abilities).toEqual(expect.arrayContaining(['dash', 'fortify', 'amphibious']));
    expect(PRODUCTION.units.trainingCamp).toContain('marine');
  });

  it('Start, Kampagne und KI-Liste: Marines statt Infanterie / start, campaign and AI roster: marines instead of infantry', () => {
    const g = createGame(defaultConfig({ seed: 5, size: 14, factions: (['meridon', 'korvat'] as FactionId[]).map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));
    const own = g.units.filter((u) => u.owner === 0);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((u) => u.type === 'marine')).toBe(true);
    expect(g.units.filter((u) => u.owner === 1).every((u) => u.type === 'infantry')).toBe(true);
    expect(factionVariant(g, 0, 'infantry')).toBe('marine');
    expect(rosterUnits(g, 0)).toContain('marine');
    // Kampagne: Verstaerkungen und Startaufstellung kommen als Marines / campaign: reinforcements and starting set come as marines
    const c = createGame(missionConfig('m1', 'meridon'));
    expect(c.units.filter((u) => u.owner === 0 && u.type === 'infantry')).toEqual([]);
    expect(c.units.some((u) => u.owner === 0 && u.type === 'marine')).toBe(true);
  });

  it('Aufstand des Spions bringt Marines / the spy uprising brings marines', () => {
    const s = blankGame({ factions: ['meridon', 'korvat'], stars: 100 });
    addCity(s, 1, 1, 0, { hq: true });
    const c = addCity(s, 6, 6, 1, { level: 2 });
    const spy = addUnit(s, 'spy', 0, 4, 6);
    const r = ok(s, { type: 'move', unit: spy.id, to: { x: 6, y: 6 } });
    expect(r.events.find((e) => e.t === 'uprising')).toMatchObject({ city: c.id, spawned: 2 });
    expect(s.units.filter((u) => u.owner === 0 && u.type === 'marine')).toHaveLength(2);
    expect(s.units.some((u) => u.owner === 0 && u.type === 'infantry')).toBe(false);
  });

  it('Bunker "Zerstoerer" traegt Marines / bunker "destroyer" carries marines', () => {
    const base = blankGame({ factions: ['meridon', 'korvat'] });
    addCity(base, 1, 1, 0, { hq: true, level: 9 });
    addCity(base, 9, 9, 1, { hq: true });
    for (let y = 3; y < 8; y++) for (let x = 5; x < 9; x++) setTerrain(base, x, y, 'shallow');
    tile(base, 6, 5).feature = 'bunker';
    const heli = addUnit(base, 'heli', 0, 4, 5);
    let found = false;
    for (let k = 0; k < 5000 && !found; k++) {
      const s = cloneState(base);
      s.rng = k;
      const r = applyCommand(s, { type: 'move', unit: heli.id, to: { x: 6, y: 5 } });
      const ev = r.events.find((e) => e.t === 'bunker');
      if (!ev || ev.t !== 'bunker' || ev.reward !== 'destroyer') continue;
      found = true;
      const d = s.units.find((u) => u.owner === 0 && u.type === 'destroyer')!;
      expect(d.carried).toBe('marine');
      expect(d.hp).toBe(UNITS.marine.hp);
    }
    expect(found).toBe(true);
  });

  it('amphibisch: Anlanden erschoepft nicht, Angriff im selben Zug; Infanterie bleibt erschoepft / amphibious: landing does not exhaust, attack in the same turn; infantry stays exhausted', () => {
    for (const [carried, amph] of [['marine', true], ['infantry', false]] as const) {
      const s = blankGame({ factions: ['meridon', 'korvat'] });
      addCity(s, 1, 1, 0, { hq: true });
      addCity(s, 9, 9, 1, { hq: true });
      for (let y = 0; y < s.size; y++) setTerrain(s, 4, y, 'shallow');
      const boat = addUnit(s, 'landingBoat', 0, 4, 5, { carried });
      const foe = addUnit(s, 'infantry', 1, 6, 5);
      const r = ok(s, { type: 'move', unit: boat.id, to: { x: 5, y: 5 } });
      expect(r.events.some((e) => e.t === 'disembark')).toBe(true);
      const u = unit(s, boat.id)!;
      expect(u.type).toBe(carried);
      expect(u.exhausted, carried).toBe(!amph);
      expect(canAttackNow(u), carried).toBe(amph);
      if (amph) {
        ok(s, { type: 'attack', unit: u.id, target: foe.id });
        // weiterziehen geht nicht: die Bewegung ist verbraucht / moving on is not possible: the move is used up
        fails(s, { type: 'move', unit: u.id, to: { x: 5, y: 6 } });
      } else fails(s, { type: 'attack', unit: u.id, target: foe.id });
    }
  });
});

describe('Raketensilo baut Lenkflugkoerper / rocket silo builds Guided Missiles', () => {
  it('Preis, Platz neben dem Silo, Heimatstadt, frisch / price, tile next to the silo, home city, fresh', () => {
    const { s, hq, silo } = siloGame();
    const before = s.factions[0].stars;
    expect(siloBuyCheck(s, 0, silo.x, silo.y, 'guidedMissile')).toBe('ok');
    const r = ok(s, buy(silo.x, silo.y));
    const e = bought(r);
    expect(e).toMatchObject({ x: silo.x, y: silo.y, city: hq.id, faction: 0 });
    expect(s.factions[0].stars).toBe(before - unitCost(s, 0, 'guidedMissile')!);
    expect(unitCost(s, 0, 'guidedMissile')).toBe(UNITS.guidedMissile.cost);
    const u = unit(s, e.unit)!;
    expect(u.type).toBe('guidedMissile');
    expect(Math.max(Math.abs(u.x - silo.x), Math.abs(u.y - silo.y))).toBe(1);
    expect(tile(s, u.x, u.y).territory).toBe(hq.id);
    expect(u.homeCity).toBe(hq.id);
    expect(u.fresh).toBe(true);
    expect(supportedUnits(s, hq)).toBe(1);
  });

  it('einmal je Zug, im naechsten Zug wieder; unabhaengig vom Start / once per turn, again next turn; independent of the launch', () => {
    const { s, silo } = siloGame({ stars: 300 });
    ok(s, buy(silo.x, silo.y));
    fails(s, buy(silo.x, silo.y), 'alreadyBought');
    // der Kauf laedt das Silo nicht nach, Start bleibt bereit / the purchase does not reload the silo, the launch stays ready
    expect(tile(s, silo.x, silo.y).turret!.ready).toBe(s.round);
    addUnit(s, 'infantry', 1, 8, 6);
    ok(s, { type: 'siloLaunch', x: silo.x, y: silo.y, tx: 8, ty: 6 });
    endTurn(s); endTurn(s);
    expect(s.current).toBe(0);
    // nach dem Start gesperrt, kaufen geht trotzdem / locked after the launch, buying still works
    expect(tile(s, silo.x, silo.y).turret!.ready).toBeGreaterThan(s.round);
    ok(s, buy(silo.x, silo.y));
  });

  it('Gruende: fremdes oder kein Silo, falsche Einheit, Limit, kein Feld, Sterne / reasons: foreign or no silo, wrong unit, limit, no tile, stars', () => {
    const { s, hq, silo } = siloGame({ level: 1 });
    expect(siloBuyCheck(s, 0, 5, 5, 'guidedMissile')).toBe('noUnit');
    expect(siloBuyCheck(s, 1, silo.x, silo.y, 'guidedMissile')).toBe('noUnit');
    expect(siloBuyCheck(s, 0, silo.x, silo.y, 'marine')).toBe('invalid');
    // Stadtlimit voll / city limit full
    for (let i = 0; i < unitLimit(s, hq); i++) addUnit(s, 'jeep', 0, 6 + (i % 3), 1 + Math.floor(i / 3), { homeCity: hq.id });
    expect(siloBuyCheck(s, 0, silo.x, silo.y, 'guidedMissile')).toBe('unitLimit');
    fails(s, buy(silo.x, silo.y), 'unitLimit');
    s.units = [];
    // kein freies Feld neben dem Silo / no free tile next to the silo
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) addUnit(s, 'jeep', silo.x + dx === hq.x && silo.y + dy === hq.y ? 0 : 1, silo.x + dx, silo.y + dy);
    expect(siloBuyCheck(s, 0, silo.x, silo.y, 'guidedMissile')).toBe('noRoom');
    s.units = [];
    s.factions[0].stars = UNITS.guidedMissile.cost! - 1;
    expect(siloBuyCheck(s, 0, silo.x, silo.y, 'guidedMissile')).toBe('notEnoughStars');
  });

  it('Kaufkarte am Silo: Preis, gesperrt mit Grund nach dem Kauf / purchase card at the silo: price, locked with a reason after buying', () => {
    setLanguage('de');
    const { s, silo } = siloGame();
    const run: string[] = [];
    const cards = siloCards(s, silo.x, silo.y, (type) => run.push(type));
    expect(cards.map((c) => c.type)).toEqual(['guidedMissile']);
    expect(cards[0]).toMatchObject({ enabled: true, cost: UNITS.guidedMissile.cost, id: 'siloBuy-guidedMissile' });
    cards[0].run();
    expect(run).toEqual(['guidedMissile']);
    ok(s, buy(silo.x, silo.y));
    const after = siloCards(s, silo.x, silo.y, () => undefined);
    expect(after[0].enabled).toBe(false);
    expect(after[0].reason).toBe(t('shadow.silo.bought'));
  });
});

describe('Stuetzpunkte fuer Meridon / bases for Meridon', () => {
  // Korrektur des Auftraggebers: beide eroberten Produktionsarten bringen Meridon nur Sterne, das Silo bleibt die einzige Quelle
  // correction by the client: both captured production kinds give Meridon only stars, the silo stays the only source
  it('Panzerfabrik und Geschuetzwerk: Ersatz-Sterne, keine Lenkflugkoerper / tank factory and gun works: substitute stars, no Guided Missiles', () => {
    const s = blankGame({ factions: ['meridon', 'korvat'], stars: 200 });
    addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 9, 9, 1, { hq: true });
    const tf = addBase(s, 5, 2, 0, 'tankFactory');
    const gw = addBase(s, 2, 6, 0, 'gunWorks');
    expect(BASES.gap.tankFactory).toContain('meridon');
    expect(BASES.gap.gunWorks).toContain('meridon');
    for (const c of [tf, gw]) {
      expect(trainCheck(s, c, 'guidedMissile')).toBe('siloOnly');
      expect(trainCheck(s, c, 'tank')).toBe('invalid');
      expect(trainCheck(s, c, 'artillery')).toBe('invalid');
      expect(baseStars(s, c)).toBe(BASES.gapStars);
      expect(cityIncome(s, c)).toBe(INCOME.perCityLevel + BASES.gapStars);
      fails(s, { type: 'train', city: c.id, unitType: 'guidedMissile' }, 'siloOnly');
    }
    // andere Menschen: Panzer an der Panzerfabrik wie bisher, keine Sterne / other humans: tanks at the tank factory as before, no stars
    tf.owner = 1;
    expect(trainCheck(s, tf, 'guidedMissile')).toBe('invalid');
    expect(trainCheck(s, tf, 'steppeColossus')).not.toBe('invalid');
    expect(baseStars(s, tf)).toBe(0);
  });
});

describe('KI der Marines und Silos / AI of marines and silos', () => {
  it('gescriptete Partie: Marines ausgebildet, Silo gebaut, Lenkflugkoerper gekauft, keine Fehlbefehle / scripted game: marines trained, silo built, missiles bought, no failed commands', () => {
    const s = blankGame({ factions: ['meridon', 'korvat'], stars: 300, size: 14 });
    for (const f of s.factions) f.human = false;
    const hq = addCity(s, 2, 2, 0, { hq: true, level: 3 });
    addCity(s, 2, 8, 0, { level: 2 });
    addCity(s, 11, 11, 1, { hq: true, level: 2 });
    revealAll(s, 0); revealAll(s, 1);
    addUnit(s, 'pioneer', 0, hq.x + 1, hq.y, { homeCity: hq.id });
    for (const [x, y] of [[4, 4], [4, 6], [5, 3]]) addUnit(s, 'shadowCommando', 0, x, y, { homeCity: hq.id });
    for (const [x, y] of [[10, 10], [10, 11], [11, 10]]) addUnit(s, 'infantry', 1, x, y);
    let failed = 0, marines = 0, silos = 0, buys = 0;
    while (s.round < 14 && !s.over) {
      const f = s.current;
      for (let i = 0; i < 60 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const r = applyCommand(s, cmd);
        if (!r.ok) { failed++; continue; }
        if (f === 0) for (const e of r.events) {
          if (e.t === 'train' && unit(s, e.unit)?.type === 'marine') marines++;
          if (e.t === 'emplacement' && e.kind === 'silo') silos++;
          if (e.t === 'siloBuy') buys++;
        }
        if (cmd.type === 'endTurn') break;
      }
    }
    expect(failed).toBe(0);
    expect(marines).toBeGreaterThan(0);
    expect(silos).toBeGreaterThan(0);
    expect(buys).toBeGreaterThan(0);
  }, 60_000);
});
