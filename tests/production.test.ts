/**
 * Produktionsstaetten und Doktrinen (Menschen): Staetten schalten genau ihre Einheiten frei, nur in ihrer Stadt; Panzerwerk
 * braucht einen Tagebau auf Erz; Kaserne im Hauptquartier eingebaut; Forschung schaltet keine Einheiten frei; jede Doktrin
 * wirkt; alte Spielstaende bekommen passende Staetten; Eroberer uebernehmen Staetten (nur Menschen); KI ohne Fehlbefehle.
 * Production sites and doctrines (humans): sites unlock exactly their units, only in their city; tank works needs a mine
 * on ore; barracks built into the HQ; research unlocks no units; every doctrine works; old saves get matching sites;
 * conquerors take over sites (humans only); AI without failed commands.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, buildCheck, citySites, createGame, defaultConfig, effectiveAttack, effectiveMove, effectiveRange,
  fuelBurnAt, heliWillCrash, reachable, rosterUnits, shipUpgradeCost, siteOf, techUnlocks, trainCheck, unitCost, upgradeCheck, usesSites,
  type GameState,
} from '../src/core';
import {
  AI, BUILDINGS, COUNTER, CITY_UPGRADES, DOCTRINE, FACTION_IDS, HEALING, LAND_UNITS, PRODUCTION, ROSTERS, TECH_IDS, UNITS, VEHICLE_UNITS,
  type FactionId, type ProductionSiteId, type UnitTypeId,
} from '../src/data/balance';
import { planNextCommand } from '../src/ai/ai';
import { LEGACY_UNIT_TECH, migrateState } from '../src/save/save';
import { addCity, addUnit, blankGame, endTurn, fails, ok, revealAll, setTerrain, tile, unit } from './helpers';

const HUMANS: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'];

/** Zwei Fraktionen, Hauptquartier und eine zweite Stadt ohne eingebaute Kaserne / two factions, HQ and a second city without built-in barracks */
function game(f: FactionId = 'alvenia', g: FactionId = f === 'meridon' ? 'alvenia' : 'meridon') {
  const s = blankGame({ factions: [f, g], stars: 500 });
  revealAll(s, 0); revealAll(s, 1);
  const hq = addCity(s, 2, 2, 0, { hq: true, level: 5 });
  const c = addCity(s, 6, 2, 0, { level: 5 });
  const e = addCity(s, 9, 9, 1, { hq: true, level: 3 });
  return { s, hq, c, e };
}

/** Landeinheiten, die Fraktion f ausbilden darf (Liste mit eigenen Bauarten, ohne Schiffe) / land units faction f may train */
const trainable = (s: GameState, f: number) => rosterUnits(s, f).filter((u) => UNITS[u].cost !== null && !UNITS[u].ship);

describe('Produktionsstaetten / production sites', () => {
  it('nur die fuenf Menschen-Fraktionen haben Staetten / only the five human factions use sites', () => {
    expect(PRODUCTION.factions).toEqual(HUMANS);
    for (const f of FACTION_IDS) expect(PRODUCTION.factions.includes(f)).toBe(!ROSTERS[f]);
    // jede kaeufliche Menschen-Einheit hat genau eine Staette / every purchasable human unit has exactly one site
    for (const u of [...LAND_UNITS, 'steppeRider', 'stormbreaker', 'peacekeeper', 'protoWalker', 'teslaTank', 'octocopter', 'railSniper', 'lightWarden', 'reliquary', 'sunLance'] as UnitTypeId[]) {
      expect(siteOf(u), u).not.toBeNull();
      expect(PRODUCTION.sites.filter((x) => PRODUCTION.units[x].includes(u)), u).toHaveLength(1);
    }
    // jede Staette: eine je Stadt, ohne Forschung / every site: one per city, no research
    for (const site of PRODUCTION.sites) {
      expect(BUILDINGS[site].tech, site).toBeNull();
      if (site !== 'navalBase') expect(BUILDINGS[site].onePerCity, site).toBe(true);
    }
  });

  for (const f of HUMANS) {
    it(`${f}: jede Staette schaltet genau ihre Einheiten frei, nur in ihrer Stadt / every site unlocks exactly its units, only in its city`, () => {
      const { s, hq, c } = game(f);
      const units = trainable(s, 0);
      // Korvat und Dravon haben in jeder Stadt eine Kaserne (PRODUCTION.citySites) / Korvat and Dravon have barracks in every city
      const free = (u: UnitTypeId) => !!PRODUCTION.citySites[f]?.includes('trainingCamp') && siteOf(u) === 'trainingCamp';
      // ohne Staette: nichts / without a site: nothing
      for (const u of units) expect(trainCheck(s, c, u), `${f} ${u}`).toBe(free(u) ? 'ok' : 'buildingMissing');
      for (const site of PRODUCTION.sites.filter((x) => x !== 'navalBase' && x !== 'dryDock')) {
        c.works = [site];
        for (const u of units) expect(trainCheck(s, c, u), `${f} ${site} ${u}`).toBe(siteOf(u) === site || free(u) ? 'ok' : 'buildingMissing');
        // die Staette der anderen Stadt hilft hier nicht / the other city's site does not help here
        if (site !== 'trainingCamp' && !(f === 'dravon' && site === 'motorPool')) {
          for (const u of units.filter((x) => siteOf(x) === site)) expect(trainCheck(s, hq, u), `${f} hq ${u}`).toBe('buildingMissing');
        }
      }
    });
  }

  it('eine gebaute Staette auf einem Feld wirkt fuer die Stadt ihres Gebiets / a built site on a tile works for the city of its territory', () => {
    // Velkar statt Meridon: Meridon hat das Schattenkommando statt des MG / Velkar instead of Meridon: Meridon has the Shadow Commando instead of the MG
    const { s, hq, c } = game('velkar');
    expect(trainCheck(s, c, 'mg')).toBe('buildingMissing');
    // Ruestungswerk im Gebiet von c, Kaserne fuer c / armoury in c's territory, barracks for c
    ok(s, { type: 'build', building: 'armory', x: 7, y: 3 });
    ok(s, { type: 'build', building: 'trainingCamp', x: 5, y: 3 });
    expect(citySites(s, c)).toEqual(['trainingCamp', 'armory']);
    expect(trainCheck(s, c, 'mg')).toBe('ok');
    expect(trainCheck(s, c, 'infantry')).toBe('ok');
    expect(trainCheck(s, hq, 'mg')).toBe('buildingMissing');
    // eine je Stadt / one per city
    fails(s, { type: 'build', building: 'armory', x: 7, y: 1 }, 'onePerCity');
    // Preis / price
    expect(s.factions[0].stars).toBe(500 - BUILDINGS.armory.cost - BUILDINGS.trainingCamp.cost);
  });

  it('Kaserne im Hauptquartier eingebaut und frei, andere Staedte brauchen eine / barracks built into the HQ for free, other cities need one', () => {
    const { s, hq, c } = game('meridon');
    expect(citySites(s, hq)).toEqual(['trainingCamp']);
    expect(trainCheck(s, hq, 'infantry')).toBe('ok');
    expect(trainCheck(s, c, 'infantry')).toBe('buildingMissing');
    // kein zweites Mal im Hauptquartier / not a second time in the HQ
    expect(buildCheck(s, 0, 'trainingCamp', 3, 3)).toMatchObject({ ok: false, error: 'onePerCity' });
    expect(buildCheck(s, 0, 'trainingCamp', 7, 3)).toMatchObject({ ok: true, cost: BUILDINGS.trainingCamp.cost });
    // jede Menschen-Fraktion startet mit Kaserne im Hauptquartier und nur dort / every human faction starts with barracks in its HQ
    const g = createGame(defaultConfig({ factions: FACTION_IDS.map((id) => ({ id, human: false, difficulty: 'normal' as const })), size: 22 }));
    for (const fa of g.factions) {
      const home = g.cities.find((x) => x.isHQ && x.hqOf === fa.index)!;
      if (!usesSites(g, fa.index)) continue;
      expect(citySites(g, home), fa.id).toContain('trainingCamp');
      expect(trainCheck(g, home, fa.id === 'alvenia' ? 'lightWarden' : 'infantry'), fa.id).not.toBe('buildingMissing');
    }
  });

  it('Panzerwerk braucht Tagebau oder Tiefbauzeche auf Erz im Stadtgebiet; Panzer kostet Sterne / tank works needs a mine or deep mine on ore; the tank costs stars', () => {
    // Velkar statt Meridon (Meridon baut keine Panzer); Velkars Bauart aus dem Panzerwerk ist der Tesla-Panzer zum Panzerpreis
    // Velkar instead of Meridon (Meridon builds no tanks); Velkar's design from the tank works is the Tesla tank at the tank price
    const { s, c } = game('velkar');
    expect(buildCheck(s, 0, 'tankWorks', 7, 3)).toMatchObject({ ok: false, error: 'buildingMissing' });
    // Tagebau ohne Forschung, nur auf Erz / mine without research, only on ore
    setTerrain(s, 5, 1, 'mountain', { resource: null });
    expect(buildCheck(s, 0, 'mine', 5, 1).ok).toBe(false);
    setTerrain(s, 5, 1, 'mountain', { resource: 'ore' });
    expect(s.factions[0].techs).not.toContain('mining');
    ok(s, { type: 'build', building: 'mine', x: 5, y: 1 });
    ok(s, { type: 'build', building: 'tankWorks', x: 7, y: 3 });
    ok(s, { type: 'build', building: 'trainingCamp', x: 7, y: 1 });
    expect(UNITS.tank.cost).toBe(60);
    expect(UNITS.teslaTank.cost).toBe(UNITS.tank.cost);
    const before = s.factions[0].stars;
    ok(s, { type: 'train', city: c.id, unitType: 'teslaTank' });
    expect(s.factions[0].stars).toBe(before - 60);
    // Tagebau im Gebiet einer anderen Stadt hilft nicht / a mine in another city's territory does not help
    const g2 = game('velkar');
    setTerrain(g2.s, 1, 1, 'mountain', { resource: 'ore' });
    ok(g2.s, { type: 'build', building: 'mine', x: 1, y: 1 });
    expect(buildCheck(g2.s, 0, 'tankWorks', 7, 3)).toMatchObject({ ok: false, error: 'buildingMissing' });
    expect(buildCheck(g2.s, 0, 'tankWorks', 3, 3)).toMatchObject({ ok: true });
  });

  it('Geschuetzgiesserei braucht einen Forstbetrieb, Trockendock einen Marinestuetzpunkt / foundry needs a lumber camp, dry dock a naval base', () => {
    const { s } = game('velkar');
    expect(buildCheck(s, 0, 'foundry', 7, 3)).toMatchObject({ ok: false, error: 'buildingMissing' });
    setTerrain(s, 5, 1, 'forest');
    ok(s, { type: 'build', building: 'lumberCamp', x: 5, y: 1 });
    expect(buildCheck(s, 0, 'foundry', 7, 3)).toMatchObject({ ok: true });
    setTerrain(s, 7, 1, 'shallow'); setTerrain(s, 7, 2, 'shallow');
    expect(buildCheck(s, 0, 'dryDock', 7, 1)).toMatchObject({ ok: false, error: 'buildingMissing' });
    ok(s, { type: 'build', building: 'navalBase', x: 7, y: 2 });
    expect(buildCheck(s, 0, 'dryDock', 7, 1)).toMatchObject({ ok: true });
  });

  it('Schiffe: Marinestuetzpunkt fuer Zerstoerer und Einschiffen, Trockendock fuer U-Boot und Schlachtschiff / ships: naval base, dry dock', () => {
    const s = blankGame({ factions: ['dravon', 'korvat'], stars: 500 });
    for (let y = 0; y < 11; y++) for (let x = 5; x < 11; x++) setTerrain(s, x, y, 'shallow');
    setTerrain(s, 10, 0, 'plain');
    addCity(s, 4, 5, 0, { hq: true });
    addCity(s, 10, 0, 1, { hq: true });
    const b = addUnit(s, 'landingBoat', 0, 5, 5);
    for (const to of ['destroyer', 'submarine', 'battleship'] as const) expect(upgradeCheck(s, b, to)).toBe('buildingMissing');
    // Einschiffen ohne Kuestenwirtschaft am eigenen Marinestuetzpunkt / embarking without coastal economy at an own naval base
    ok(s, { type: 'build', building: 'navalBase', x: 5, y: 4 });
    const inf = addUnit(s, 'infantry', 0, 4, 4);
    expect(s.factions[0].techs).not.toContain('coastalEconomy');
    expect(reachable(s, inf).some((r) => r.x === 5 && r.y === 4 && r.embark)).toBe(true);
    expect(upgradeCheck(s, b, 'destroyer')).toBe('ok');
    expect(upgradeCheck(s, b, 'submarine')).toBe('buildingMissing');
    ok(s, { type: 'build', building: 'dryDock', x: 5, y: 6 });
    expect(upgradeCheck(s, b, 'submarine')).toBe('ok');
    expect(upgradeCheck(s, b, 'battleship')).toBe('ok');
  });

  it('Forschung schaltet fuer Menschen keine Einheiten frei; Kult und NEXUS unveraendert / research unlocks no units for humans; cult and NEXUS unchanged', () => {
    for (const f of HUMANS) {
      for (const tech of TECH_IDS) {
        const un = techUnlocks(tech, f).units;
        expect(un, `${f} ${tech}`).toEqual([]);
      }
    }
    for (const u of Object.keys(UNITS) as UnitTypeId[]) {
      const st = UNITS[u];
      const human = !st.faction || HUMANS.includes(st.faction);
      if (human && !st.ship && st.cost !== null && !st.abilities.includes('wonder')) expect(st.tech, u).toBeNull();
    }
    // Kult forscht weiter fuer Einheiten, NEXUS fuer Schiffe / the cult still researches units, NEXUS ships
    expect(UNITS.torchbearer.tech).toBe('forestry');
    expect(techUnlocks('armsIndustry', 'vesper').units).toContain('doomCrawler');
    expect(techUnlocks('diving', 'nexus').units).toEqual(['submarine']);
    // mit allen Technologien, aber ohne Staette: nichts / with every tech but no site: nothing
    const { s, c } = game('meridon');
    s.factions[0].techs = [...TECH_IDS];
    for (const u of trainable(s, 0)) expect(trainCheck(s, c, u), u).toBe('buildingMissing');
  });

  it('Kult, Zyrr und NEXUS bauen keine Staetten und brauchen keine / cult, Zyrr and NEXUS build no sites and need none', () => {
    for (const f of ['vesper', 'nexus', 'zyrr'] as FactionId[]) {
      const { s } = game(f, 'korvat');
      for (const site of PRODUCTION.sites) if (site !== 'navalBase') expect(buildCheck(s, 0, site, 3, 3).ok, `${f} ${site}`).toBe(false);
      expect(usesSites(s, 0)).toBe(false);
    }
    const { s, hq } = game('nexus', 'korvat');
    expect(trainCheck(s, hq, 'android')).toBe('ok');
  });

  it('Eroberung: das Panzerwerk dient dem neuen Besitzer, nur Menschen / capture: the tank works serves the new owner, humans only', () => {
    for (const g of ['dravon', 'nexus', 'vesper'] as FactionId[]) {
      // Velkar statt Meridon (Meridon baut keine Panzer): Velkar bildet im Panzerwerk den Tesla-Panzer aus
      // Velkar instead of Meridon (Meridon builds no tanks): Velkar trains the Tesla tank at the tank works
      const s = blankGame({ factions: ['velkar', g], stars: 500 });
      revealAll(s, 0); revealAll(s, 1);
      addCity(s, 1, 1, 0, { hq: true });
      const c = addCity(s, 5, 5, 0, { level: 3 });
      addCity(s, 9, 9, 1, { hq: true });
      // der Kult lebt nur mit Einheiten / the cult lives only with units
      addUnit(s, ROSTERS[g]?.infantry ?? 'infantry', 1, 9, 8);
      setTerrain(s, 4, 4, 'mountain', { resource: 'ore' });
      ok(s, { type: 'build', building: 'mine', x: 4, y: 4 });
      ok(s, { type: 'build', building: 'tankWorks', x: 6, y: 6 });
      ok(s, { type: 'build', building: 'trainingCamp', x: 6, y: 4 });
      expect(trainCheck(s, c, 'teslaTank')).toBe('ok');
      // Fraktion g nimmt die Stadt / faction g takes the city
      s.current = 1;
      const u = addUnit(s, ROSTERS[g]?.infantry ?? 'infantry', 1, 5, 5);
      u.startX = 5; u.startY = 5;
      ok(s, { type: 'capture', unit: u.id });
      expect(c.owner).toBe(1);
      s.units = s.units.filter((x) => x.id !== u.id);
      expect(tile(s, 6, 6).building).toBe('tankWorks');
      if (g === 'dravon') {
        expect(trainCheck(s, c, 'tank')).toBe('ok');
        expect(trainCheck(s, c, 'infantry')).toBe('ok');
      } else {
        // Sonderfraktionen: die Staette nuetzt nichts, ihre eigenen Regeln gelten / special factions: the site is of no use
        expect(trainCheck(s, c, 'tank')).toBe('invalid');
      }
    }
  });

  it('Fraktions-Extras: Dravon-Hauptquartier mit Fahrzeugwerk, Korvat- und Dravon-Staedte mit Kaserne / faction extras', () => {
    const d = game('dravon', 'korvat');
    expect(citySites(d.s, d.hq)).toEqual(['trainingCamp', 'motorPool']);
    expect(trainCheck(d.s, d.hq, 'jeep')).toBe('ok');
    expect(trainCheck(d.s, d.c, 'jeep')).toBe('buildingMissing');
    // Dravon: Kaserne auch in jeder weiteren Stadt (neu erobert oder gegruendet) / Dravon: barracks in every further city too (newly captured or founded)
    expect(citySites(d.s, d.c)).toEqual(['trainingCamp']);
    expect(trainCheck(d.s, d.c, 'infantry')).toBe('ok');
    const k = game('korvat', 'dravon');
    expect(citySites(k.s, k.c)).toEqual(['trainingCamp']);
    expect(trainCheck(k.s, k.c, 'infantry')).toBe('ok');
    // erobert Dravon eine Korvat-Stadt, gilt Dravons eigene Kaserne / if Dravon takes a Korvat city, Dravon's own barracks applies
    k.c.owner = 1;
    expect(citySites(k.s, k.c)).toEqual(['trainingCamp']);
  });
});

describe('Doktrinen / doctrines', () => {
  /** Doktrin fuer Fraktion 0 einfuehren (und Fraktion 1 = Kult zum Vergleich) / adopt a doctrine for faction 0 */
  const adopt = (s: GameState, t: (typeof TECH_IDS)[number]) => { if (!s.factions[0].techs.includes(t)) s.factions[0].techs.push(t); };

  it('Motorisierung: Fahrzeuge billiger, nur fuer Menschen / motorization: cheaper vehicles, humans only', () => {
    const { s } = game('meridon', 'vesper');
    expect(unitCost(s, 0, 'tank')).toBe(60);
    adopt(s, 'motorization');
    expect(unitCost(s, 0, 'tank')).toBe(Math.ceil(60 * (1 - DOCTRINE.motorizationDiscount)));
    expect(unitCost(s, 0, 'infantry')).toBe(10);
    expect(VEHICLE_UNITS).toContain('jeep');
    // der Kult forscht Motorisierung fuer Untergangsbuggys, ohne Rabatt / the cult researches motorization for doom buggies, without discount
    s.factions[1].techs.push('motorization');
    expect(unitCost(s, 1, 'doomBuggy')).toBe(UNITS.doomBuggy.cost);
  });

  it('Ruestungsindustrie: MG und Panzerabwehr greifen staerker an / arms industry: MG and anti-tank attack harder', () => {
    const { s } = game();
    const mg = addUnit(s, 'mg', 0, 4, 4);
    const inf = addUnit(s, 'infantry', 0, 4, 5);
    expect(effectiveAttack(s, mg)).toBe(UNITS.mg.attack);
    adopt(s, 'armsIndustry');
    expect(effectiveAttack(s, mg)).toBeCloseTo(UNITS.mg.attack * (1 + DOCTRINE.armsIndustryAttack));
    expect(effectiveAttack(s, inf)).toBe(UNITS.infantry.attack);
  });

  it('Ballistik: Artillerie und Sonnenlanze weiter / ballistics: artillery and sun lance reach further', () => {
    const { s } = game('alvenia');
    const a = addUnit(s, 'sunLance', 0, 4, 4);
    expect(effectiveRange(s, a)).toBe(UNITS.sunLance.range);
    adopt(s, 'ballistics');
    expect(effectiveRange(s, a)).toBe(UNITS.sunLance.range + DOCTRINE.ballisticsRange);
  });

  it('Heeresflieger: kein Sprit im eigenen Gebiet / army aviation: no fuel in own territory', () => {
    const { s } = game();
    const h = addUnit(s, 'heli', 0, 7, 3, { fuel: 1 });
    expect(fuelBurnAt(s, 0, 7, 3)).toBe(1);
    adopt(s, 'armyAviation');
    expect(fuelBurnAt(s, 0, 7, 3)).toBe(DOCTRINE.armyAviationHomeBurn);
    expect(fuelBurnAt(s, 0, 9, 6)).toBe(1);
    expect(heliWillCrash(s, h)).toBe(false);
    endTurn(s);
    expect(unit(s, h.id)?.fuel).toBe(1);
  });

  it('Kybernetik: Sanitaeter heilen mehr / cybernetics: medics heal more', () => {
    const { s } = game();
    adopt(s, 'cybernetics');
    const m = addUnit(s, 'medic', 0, 4, 4);
    const w = addUnit(s, 'infantry', 0, 4, 5, { hp: 1 });
    ok(s, { type: 'medicHeal', unit: m.id });
    expect(unit(s, w.id)!.hp).toBe(1 + HEALING.medic + DOCTRINE.cyberneticsMedic);
  });

  it('Aerodynamik: Flak macht mehr Schaden / aerodynamics: flak deals more damage', () => {
    const { s, e } = game('alvenia', 'korvat');
    s.factions[1].techs.push('aerodynamics');
    e.upgrades = ['flak'];
    const h = addUnit(s, 'heli', 0, 8, 8, { fuel: 4 });
    endTurn(s);
    expect(unit(s, h.id)!.hp).toBe(10 - CITY_UPGRADES.flakDamage - DOCTRINE.aerodynamicsFlak);
    const s2 = game('alvenia', 'korvat').s;
    s2.factions[1].techs.push('aerodynamics');
    addUnit(s2, 'antiAir', 1, 5, 7);
    const h2 = addUnit(s2, 'heli', 0, 5, 6, { fuel: 4 });
    endTurn(s2);
    expect(unit(s2, h2.id)!.hp).toBe(10 - COUNTER.flak.damage - DOCTRINE.aerodynamicsFlak);
  });

  it('Befestigung: eigene Minen machen mehr Schaden / fortification: own mines deal more damage', () => {
    const { s } = game('korvat', 'dravon');
    s.factions[1].techs.push('fortification');
    tile(s, 4, 5).mine = { owner: 1 };
    const u = addUnit(s, 'infantry', 0, 4, 4);
    const r = applyCommand(s, { type: 'move', unit: u.id, to: { x: 4, y: 5 } });
    expect(r.ok).toBe(true);
    const hit = r.events.find((x) => x.t === 'mineHit');
    expect(hit && hit.t === 'mineHit' && hit.dmg).toBe(COUNTER.mine.damageFoot + DOCTRINE.fortificationMine);
  });

  it('Nachrichtendienst: Spione ziehen weiter / intelligence: spies move further', () => {
    const { s } = game();
    const spy = addUnit(s, 'spy', 0, 4, 4);
    expect(effectiveMove(s, spy)).toBe(UNITS.spy.move);
    adopt(s, 'intelligence');
    expect(effectiveMove(s, spy)).toBe(UNITS.spy.move + DOCTRINE.intelligenceSpyMove);
  });

  it('Bergbau und Forstwirtschaft: Panzer und Geschuetze billiger / mining and forestry: cheaper tanks and guns', () => {
    const { s } = game('alvenia');
    expect(unitCost(s, 0, 'reliquary')).toBe(60);
    adopt(s, 'mining');
    expect(unitCost(s, 0, 'reliquary')).toBe(Math.ceil(60 * (1 - DOCTRINE.miningDiscount)));
    expect(unitCost(s, 0, 'jeep')).toBe(UNITS.jeep.cost);
    // Alvenia: Sonnenlanze schon mit Fraktionsrabatt, dazu die Forstwirtschaft / Alvenia: Sun Lance already with the faction discount, plus forestry
    const before = unitCost(s, 0, 'sunLance')!;
    adopt(s, 'forestry');
    expect(unitCost(s, 0, 'sunLance')).toBe(Math.ceil(before * (1 - DOCTRINE.forestryDiscount)));
  });

  it('Marineartillerie und Schiffbau: Schiffe staerker, Aufruesten billiger / naval artillery and shipbuilding', () => {
    // Velkar statt Meridon: die Schattenflotte zahlt fuer Schiffe weniger (SEA_POWER) / Velkar instead of Meridon: the shadow fleet pays less for ships (SEA_POWER)
    const { s } = game('velkar');
    setTerrain(s, 3, 3, 'shallow');
    const d = addUnit(s, 'destroyer', 0, 3, 3);
    expect(effectiveAttack(s, d)).toBe(UNITS.destroyer.attack);
    adopt(s, 'navalArtillery');
    expect(effectiveAttack(s, d)).toBeCloseTo(UNITS.destroyer.attack * (1 + DOCTRINE.navalArtilleryAttack));
    expect(shipUpgradeCost(s, 0, 'battleship')).toBe(UNITS.battleship.cost);
    adopt(s, 'shipbuilding');
    expect(shipUpgradeCost(s, 0, 'battleship')).toBe(Math.ceil(UNITS.battleship.cost! * (1 - DOCTRINE.shipbuildingDiscount)));
  });

  it('Doktrinen wirken nicht fuer den Kult / doctrines do not work for the cult', () => {
    const { s } = game('vesper', 'korvat');
    s.factions[0].techs.push('armsIndustry', 'ballistics');
    const c = addUnit(s, 'doomCrawler', 0, 4, 4);
    const r = addUnit(s, 'rocketCart', 0, 4, 5);
    expect(effectiveAttack(s, c)).toBe(UNITS.doomCrawler.attack);
    expect(effectiveRange(s, r)).toBe(UNITS.rocketCart.range);
  });
});

describe('Alte Spielstaende / old saves', () => {
  it('migrateSites baut die Staetten der erforschten Einheiten ein / migrateSites builds in the sites of researched units', () => {
    const s = blankGame({ factions: ['velkar', 'dravon', 'vesper'], stars: 100 });
    const hq = addCity(s, 2, 2, 0, { hq: true });
    const c = addCity(s, 6, 2, 0, { level: 2 });
    setTerrain(s, 7, 1, 'shallow');
    const d = addCity(s, 2, 8, 1, { hq: true });
    const v = addCity(s, 8, 8, 2, { hq: true });
    s.factions[0].techs = ['mountainTraining', 'highAltitude', 'cybernetics', 'livestock', 'camouflage', 'coastalEconomy', 'diving'];
    s.factions[1].techs = ['motorization', 'mountainTraining', 'mining', 'armsIndustry'];
    s.factions[2].techs = ['livestock', 'forestry', 'ballistics'];
    // alter Spielstand: ohne Feld sites / old save: without the sites field
    delete (s as { sites?: number }).sites;
    const m = migrateState(JSON.parse(JSON.stringify(s)));
    expect(m.sites).toBe(1);
    const city = (id: number) => m.cities.find((x) => x.id === id)!;
    // Velkar: Kaserne (Railgun-Schuetze, Sanitaeter), Panzerwerk (Prototyp-Laeufer); Trockendock nur mit Wasser
    // Velkar: barracks (railgun marksman, medic), tank works (prototype walker); dry dock only with water
    expect(citySites(m, city(hq.id))).toEqual(['trainingCamp', 'tankWorks']);
    // Tauchtechnik: U-Boot (Trockendock). Kuestenwirtschaft gibt keinen Stuetzpunkt mehr: Transportboote kauft jede
    // Kuestenstadt ohne Staette (SHIPYARD) / diving: submarine (dry dock). Coastal economy no longer grants a naval base:
    // every coastal city buys transport boats without a site (SHIPYARD)
    expect(citySites(m, city(c.id))).toEqual(['trainingCamp', 'tankWorks', 'dryDock']);
    expect(trainCheck(m, city(c.id), 'protoWalker')).toBe('ok');
    expect(trainCheck(m, city(c.id), 'teslaTank')).toBe('ok');
    // Dravon: Jeep (Motorisierung), MG und Sturmbrecher (Ruestungsindustrie, Bergbau) / Dravon: jeep, MG and stormbreaker
    expect(citySites(m, city(d.id))).toEqual(['trainingCamp', 'armory', 'motorPool']);
    // Kult: nichts / cult: nothing
    expect(city(v.id).works).toBeUndefined();
    // die Zuordnung deckt jede frueher erforschte Einheit / the mapping covers every formerly researched unit
    for (const u of Object.keys(LEGACY_UNIT_TECH) as UnitTypeId[]) expect(siteOf(u), u).not.toBeNull();
    // ein neuer Spielstand wird nicht angefasst / a new save is not touched
    const fresh = createGame(defaultConfig({ factions: [{ id: 'korvat', human: true, difficulty: 'normal' }, { id: 'dravon', human: false, difficulty: 'normal' }] }));
    expect(migrateState(JSON.parse(JSON.stringify(fresh))).cities.every((x) => !x.works)).toBe(true);
  });
});

describe('KI / AI', () => {
  it('baut Staetten, bildet gemischt aus, forscht Doktrinen, ohne Fehlbefehle / builds sites, trains a mixed army, adopts doctrines, no failed commands', () => {
    const facs: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'];
    // ohne Stuetzpunkte: mit ihnen hat jede Fraktion die Kaserne schon in ihrem Heimat-Stuetzpunkt und baut in 20 Runden keine
    // (Stuetzpunkte und eingebaute Staetten prueft bases.test.ts)
    // without bases: with them every faction already has barracks in its home base and builds none within 20 rounds
    // (bases and built-in sites are covered by bases.test.ts)
    const s = createGame(defaultConfig({ seed: 77, size: 16, mapType: 'continent', mode: 'points', roundLimit: 20, bases: false,
      factions: [...facs, 'vesper' as FactionId].map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));
    let failed = 0;
    const trained = new Set<UnitTypeId>();
    const built = new Set<ProductionSiteId>();
    while (!s.over && s.round <= 20) {
      const f = s.current;
      for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
        const cmd = planNextCommand(s, f);
        const r = applyCommand(s, cmd);
        if (!r.ok) failed++;
        for (const e of r.events) {
          if (e.t === 'train') { const u = s.units.find((x) => x.id === e.unit); if (u && usesSites(s, u.owner)) trained.add(u.type); }
          if (e.t === 'build' && PRODUCTION.sites.includes(e.building as ProductionSiteId) && usesSites(s, e.faction)) built.add(e.building as ProductionSiteId);
        }
        if (cmd.type === 'endTurn' && r.ok) break;
      }
    }
    expect(failed).toBe(0);
    expect(built.has('armory')).toBe(true);
    expect(built.has('trainingCamp')).toBe(true);
    // gemischte Armee: mehr als nur Kasernen-Truppen / mixed army: more than barracks troops
    expect([...trained].filter((u) => siteOf(u) !== 'trainingCamp').length).toBeGreaterThanOrEqual(2);
    for (const fa of s.factions) if (usesSites(s, fa.index)) expect(fa.techs.length, fa.id).toBeGreaterThan(1);
  }, 120_000);
});
