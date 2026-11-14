import { afterEach, describe, expect, it } from 'vitest';
import { cloneState, createGame, defaultConfig } from '../src/core';
import { FACTION_IDS, UNITS, type FactionId, type UnitTypeId } from '../src/data/balance';
import { cityCulture, cityNameOf, cityNameSlots } from '../src/i18n/cityNames';
import { setLanguage, tList } from '../src/i18n/i18n';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import { addCity, addUnit, blankGame, ok } from './helpers';

const names = (s: ReturnType<typeof createGame>) => s.cities.map((c) => cityNameOf(s, c.id));

function standard(seed: number, factions: FactionId[], size: 14 | 16 | 18 = 16) {
  return createGame(defaultConfig({
    seed, size, mapType: 'continents', mode: 'points',
    factions: factions.map((id, i) => ({ id, human: i === 0, difficulty: 'normal' as const })),
  }));
}

afterEach(() => setLanguage('de'));

describe('Regionale Stadtnamen / regional city names', () => {
  it('every faction has a DE and EN list of the same length, no overlap with the general list', () => {
    for (const f of FACTION_IDS) {
      const d = (de.cityNamesFaction as Record<string, string[]>)[f];
      const e = (en.cityNamesFaction as Record<string, string[]>)[f];
      expect(d.length).toBeGreaterThanOrEqual(20);
      expect(e.length).toBe(d.length);
      expect(new Set(d).size).toBe(d.length);
      for (const n of d) expect(de.cityNames).not.toContain(n);
    }
  });

  it('HQs get the first name of their faction list', () => {
    const s = standard(7, ['korvat', 'zyrr', 'nexus', 'vesper', 'alvenia']);
    for (const c of s.cities.filter((x) => x.isHQ)) {
      const fid = s.factions[c.hqOf!].id;
      expect(cityCulture(s, c)).toBe(fid);
      expect(cityNameOf(s, c.id)).toBe(tList(`cityNamesFaction.${fid}`)[0]);
    }
  });

  it('no duplicate names on standard maps (several seeds, both languages)', () => {
    for (const seed of [1, 2, 3, 11, 42, 12345]) {
      const s = standard(seed, ['dravon', 'meridon', 'velkar', 'korvat', 'vesper'], 18);
      for (const lang of ['de', 'en'] as const) {
        setLanguage(lang);
        const list = names(s);
        expect(list.every((n) => n.length > 0)).toBe(true);
        expect(new Set(list).size).toBe(list.length);
      }
      // Staedte nahe einem Hauptquartier tragen Namen dieser Fraktion / cities near an HQ carry that faction's names
      const regional = s.cities.filter((c) => cityNameSlots(s).get(c.id)!.list !== null);
      expect(regional.length).toBeGreaterThan(s.factions.length);
    }
  });

  it('names stay the same after a capture, after cloning and after the HQ falls', () => {
    const s = blankGame({ factions: ['korvat', 'nexus'], stars: 0 });
    const hq0 = addCity(s, 1, 1, 0, { hq: true });
    const hq1 = addCity(s, 9, 9, 1, { hq: true });
    const near0 = addCity(s, 3, 2, null);
    const tie = addCity(s, 5, 5, null);
    const before = s.cities.map((c) => cityNameOf(s, c.id));
    expect(cityNameOf(s, hq0.id)).toBe(tList('cityNamesFaction.korvat')[0]);
    expect(cityNameOf(s, hq1.id)).toBe(tList('cityNamesFaction.nexus')[0]);
    expect(cityCulture(s, near0)).toBe('korvat');
    // gleich weit von beiden Hauptquartieren: allgemeine Liste / equally far from both HQs: general list
    expect(cityCulture(s, tie)).toBeNull();
    expect(tList('cityNames')).toContain(cityNameOf(s, tie.id));
    // NEXUS nimmt die Siedlung und das Korvat-Hauptquartier ein / NEXUS takes the village and the Korvat HQ
    const a = addUnit(s, 'android', 1, near0.x, near0.y);
    const b = addUnit(s, 'android', 1, hq0.x, hq0.y);
    s.current = 1;
    ok(s, { type: 'capture', unit: a.id });
    ok(s, { type: 'capture', unit: b.id });
    expect(near0.owner).toBe(1);
    expect(hq0.owner).toBe(1);
    expect(s.cities.map((c) => cityNameOf(s, c.id))).toEqual(before);
    const copy = cloneState(s);
    expect(copy.cities.map((c) => cityNameOf(copy, c.id))).toEqual(before);
  });

  it('cities far from every HQ use the general list', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], size: 26 });
    addCity(s, 1, 1, 0, { hq: true });
    addCity(s, 3, 24, 1, { hq: true });
    const far = addCity(s, 24, 12, null);
    expect(cityCulture(s, far)).toBeNull();
  });
});

describe('Einheiten-Spitznamen / unit nicknames', () => {
  it('every faction has a DE and EN nickname for every unit type', () => {
    const types = Object.keys(UNITS) as UnitTypeId[];
    for (const f of FACTION_IDS) {
      for (const t of types) {
        expect((de.unitNicknames as Record<string, Record<string, string>>)[f][t], `${f}.${t}`).toBeTruthy();
        expect((en.unitNicknames as Record<string, Record<string, string>>)[f][t], `${f}.${t}`).toBeTruthy();
      }
    }
  });
});
