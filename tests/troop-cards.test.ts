/**
 * Truppenkarten im Stadtfeld: alle Gattungen der Fraktion als Karten mit Sperrgruenden, Reihenfolge, Schiffe am Stuetzpunkt.
 * Troop cards in the city panel: every troop type of the faction as a card with lock reasons, order, ships at the base.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rosterShips, rosterUnits } from '../src/core';
import { UNITS } from '../src/data/balance';
import { setLanguage, t } from '../src/i18n/i18n';
import { troopCards, troopsHtml } from '../src/ui/troops';
import { addCity, addUnit, blankGame, giveSites, setTerrain } from './helpers';

const noop = () => {};

/** Korvat-Hauptquartier an der Kueste: Flachwasser ab x = 6 / Korvat HQ on the coast: shallow from x = 6 */
function coastal(f: 'korvat' | 'vesper' | 'nexus' | 'meridon' = 'korvat') {
  const s = blankGame({ factions: [f, 'dravon'], stars: 30 });
  for (let y = 0; y < 11; y++) for (let x = 6; x < 11; x++) setTerrain(s, x, y, 'shallow');
  const c = addCity(s, 5, 5, 0, { hq: true });
  addCity(s, 1, 1, 1, { hq: true });
  return { s, c };
}

describe('Truppenkarten / troop cards', () => {
  beforeAll(() => setLanguage('en'));
  afterAll(() => setLanguage('de'));

  it('lists every land, air and sea type of the roster with the right lock reasons', () => {
    const { s, c } = coastal();
    const cards = troopCards(s, c, noop);
    const want = [...rosterUnits(s, 0), ...rosterShips(s, 0)].filter((x) => UNITS[x].cost !== null && !UNITS[x].abilities.includes('wonder'));
    expect(cards.map((x) => x.type).sort()).toEqual([...want].sort());
    const html = troopsHtml(cards, 'korvat');
    for (const type of want) expect(html).toContain(`data-act="train-${type}"`);
    expect(html).toContain('role="list"');
    expect(html).toContain(t('troops.title'));
    const card = (type: string) => cards.find((x) => x.type === type)!;
    // eingebaute Kaserne und Werft ohne Staette / built-in barracks and shipyard without a site
    expect(card('infantry').enabled).toBe(true);
    expect(card('landingBoat').enabled).toBe(true);
    // Staette fehlt / site missing
    expect(card('jeep').reason).toContain(t('buildings.motorPool'));
    expect(card('destroyer').reason).toContain(t('buildings.navalBase'));
    expect(card('battleship').reason).toContain(t('buildings.dryDock'));
    expect(card('battleship').reason).toContain(t('buildings.navalBase'));
    // Sterne fehlen (30 Sterne, Hubschrauber 50) / not enough stars (30 stars, helicopter 50)
    giveSites(c, 'airfield');
    expect(troopCards(s, c, noop).find((x) => x.type === 'heli')!.reason).toBe(t('errors.notEnoughStars'));
    // gesperrte Karten zeigen den Grund auf der Karte / locked cards show the reason on the card
    expect(html).toContain('class="troop-lock"');
  });

  it('orders available before locked, then land, air, sea', () => {
    const { s, c } = coastal();
    giveSites(c, 'airfield', 'navalBase');
    s.factions[0].stars = 500;
    const cards = troopCards(s, c, noop);
    const firstLocked = cards.findIndex((x) => !x.enabled);
    expect(cards.slice(0, firstLocked).every((x) => x.enabled)).toBe(true);
    expect(cards.slice(firstLocked).every((x) => !x.enabled)).toBe(true);
    const order = { land: 0, air: 1, sea: 2 };
    const ready = cards.filter((x) => x.enabled).map((x) => order[x.cls]);
    expect(ready).toEqual([...ready].sort((a, b) => a - b));
    expect(cards.find((x) => x.type === 'heli')!.cls).toBe('air');
    expect(cards.find((x) => x.type === 'destroyer')!.cls).toBe('sea');
  });

  it('inland cities show the ships locked with "no water"; unit limit and occupied tile are named', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 100 });
    const c = addCity(s, 5, 5, 0, { hq: true });
    addUnit(s, 'infantry', 0, 5, 5, { homeCity: c.id });
    const cards = troopCards(s, c, noop);
    expect(cards.find((x) => x.type === 'landingBoat')!.reason).toBe(t('errors.noCoast'));
    expect(cards.find((x) => x.type === 'infantry')!.reason).toBe(t('errors.occupied'));
  });

  it('meridon: twin note on infantry, privateer card', () => {
    const { s, c } = coastal('meridon');
    const cards = troopCards(s, c, noop);
    expect(cards.find((x) => x.type === 'infantry')!.label).toBe(t('twin.label', { unit: t('units.infantry') }));
    expect(cards.some((x) => x.type === 'privateer')).toBe(true);
  });

  it('cult: land troops locked (recruiting), ships with coastal economy; NEXUS names the missing research', () => {
    const v = coastal('vesper');
    v.s.factions[0].techs = [];
    let cards = troopCards(v.s, v.c, noop);
    expect(cards.find((x) => x.type === 'zealot')!.reason).toBe(t('errors.cultRecruit'));
    expect(cards.find((x) => x.type === 'landingBoat')!.reason).toContain(t('techs.coastalEconomy'));
    v.s.factions[0].techs.push('coastalEconomy');
    cards = troopCards(v.s, v.c, noop);
    expect(cards.find((x) => x.type === 'landingBoat')!.enabled).toBe(true);
    expect(cards.find((x) => x.type === 'destroyer')!.reason).toContain(t('techs.shipbuilding'));
    const n = coastal('nexus');
    n.s.factions[0].techs = [];
    const tank = troopCards(n.s, n.c, noop).find((x) => x.type === 'titan')!;
    expect(tank.enabled).toBe(false);
    expect(tank.reason!.length).toBeGreaterThan(0);
  });

  it('at a naval base only the ship cards of its city', () => {
    const { s, c } = coastal();
    const ships = troopCards(s, c, noop, true);
    expect(ships.map((x) => x.cls).every((k) => k === 'sea')).toBe(true);
    expect(ships.map((x) => x.type).sort()).toEqual([...rosterShips(s, 0)].sort());
    expect(troopsHtml(ships, 'korvat', t('troops.ships', { city: 'X' }))).toContain(t('troops.ships', { city: 'X' }));
  });
});
