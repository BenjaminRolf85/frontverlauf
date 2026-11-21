/**
 * Rollensymbole der Einheiten: jeder Typ, den das Spiel bauen kann, hat eine Rolle mit einem vorhandenen Symbol, und
 * verschiedene Rollen haben verschiedene Symbole. Dazu die Lage der Teile auf der LP-Plakette.
 * Role icons of the units: every type the game can build has a role with an existing icon, and different roles have
 * different icons. Plus the layout of the parts on the HP badge.
 */
import { describe, expect, it } from 'vitest';
import { createGame, defaultConfig, rosterShips, rosterUnits } from '../src/core';
import { FACTION_IDS, UNITS, WONDER_UNITS, type UnitTypeId } from '../src/data/balance';
import { has, setLanguage } from '../src/i18n/i18n';
import { hasIcon } from '../src/ui/icons';
import { ROLE_ICON, UNIT_ROLE, UNIT_ROLES, unitRoleIcon } from '../src/ui/unitRoles';
import { UNIT_ICON } from '../src/ui/hud';
import { badgeLayout } from '../src/render/labels';
import { BADGE } from '../src/render/config';

describe('Einheitenrollen / unit roles', () => {
  it('jede baubare Einheit jeder Fraktion hat ein Rollensymbol / every buildable unit of every faction has a role icon', () => {
    const built = new Set<UnitTypeId>();
    // je Fraktion eine Partie: Kaufliste an Land und zur See / one game per faction: shop list on land and at sea
    for (const id of FACTION_IDS) {
      const s = createGame(defaultConfig({ seed: 3, size: 16, factions: [{ id, human: false, difficulty: 'normal' }, { id: id === 'korvat' ? 'dravon' : 'korvat', human: false, difficulty: 'normal' }] }));
      for (const t of [...rosterUnits(s, 0), ...rosterShips(s, 0)]) built.add(t);
    }
    // Wunder (auch der Erdkernbohrer, den der Prophet ruft) / wonders (also the earth-core drill the prophet calls up)
    for (const w of WONDER_UNITS) built.add(w);
    built.add('coreDrill');
    expect(built.size).toBeGreaterThan(40);
    for (const t of built) {
      expect(UNIT_ROLE[t], t).toBeDefined();
      expect(hasIcon(unitRoleIcon(t)), `${t} -> ${unitRoleIcon(t)}`).toBe(true);
      // Kaufleiste und Einheitenfeld zeigen dasselbe Symbol / shop strip and unit panel show the same icon
      expect(UNIT_ICON[t]).toBe(unitRoleIcon(t));
    }
  });

  it('auch Sondereinheiten ohne Kaufkarte haben ein Symbol (keine Luecke) / special units without a shop card have an icon too (no gap)', () => {
    for (const t of Object.keys(UNITS) as UnitTypeId[]) {
      expect(UNIT_ROLES, t).toContain(UNIT_ROLE[t]);
      expect(hasIcon(unitRoleIcon(t)), t).toBe(true);
    }
  });

  it('verschiedene Rollen haben verschiedene Symbole, jede Rolle wird genutzt / different roles have different icons, every role is used', () => {
    const icons = UNIT_ROLES.map((r) => ROLE_ICON[r]);
    expect(new Set(icons).size).toBe(UNIT_ROLES.length);
    const used = new Set(Object.values(UNIT_ROLE));
    for (const r of UNIT_ROLES) expect(used.has(r), r).toBe(true);
  });

  it('gleiche Aufgabe, gleiches Symbol ueber Fraktionen / same job, same icon across factions', () => {
    const same = (a: UnitTypeId, b: UnitTypeId) => expect(unitRoleIcon(a), `${a} ~ ${b}`).toBe(unitRoleIcon(b));
    same('infantry', 'lightWarden'); same('infantry', 'android'); same('infantry', 'zealot'); same('infantry', 'grey');
    same('tank', 'teslaTank'); same('tank', 'steppeColossus'); same('tank', 'reliquary'); same('tank', 'doomCrawler');
    same('artillery', 'rocketCart'); same('artillery', 'sunLance'); same('artillery', 'railgun');
    same('antiTank', 'faustZealot'); same('antiAir', 'flakDrone'); same('medic', 'prophet'); same('heli', 'octocopter');
    same('sniper', 'railSniper'); same('landingBoat', 'fogCutter'); same('kamikazeDrone', 'guidedMissile');
  });

  it('Rollennamen in beiden Sprachen / role names in both languages', () => {
    for (const lang of ['de', 'en'] as const) {
      setLanguage(lang);
      for (const r of UNIT_ROLES) expect(has(`unitRoles.${r}`), `${lang} ${r}`).toBe(true);
    }
    setLanguage('de');
  });
});

describe('LP-Plakette / HP badge', () => {
  it('ohne Symbol wie bisher / without an icon as before', () => {
    expect(badgeLayout(20, false, false, false).pill).toBe(BADGE.minPill);
    expect(badgeLayout(50, false, false, false).pill).toBe(50 + BADGE.pad * 2);
  });

  it('Kappe links, dann Zahl, Stern, Suendenzeichen, alles im Schild / cap on the left, then number, star, sinner mark, all inside the pill', () => {
    const tw = 46;
    const L = badgeLayout(tw, true, true, true);
    expect(L.textX - tw / 2).toBeGreaterThanOrEqual(BADGE.cap);
    expect(L.starX - BADGE.star / 2).toBeGreaterThanOrEqual(L.textX + tw / 2);
    expect(L.sinX - BADGE.sin / 2).toBeGreaterThanOrEqual(L.starX + BADGE.star / 2);
    expect(L.sinX + BADGE.sin / 2).toBeLessThanOrEqual(L.pill);
    expect(L.width).toBeGreaterThan(L.pill);
    // die Kappe macht die Plakette nur um ihre Breite breiter, nicht hoeher / the cap only adds its width, not height
    const plain = badgeLayout(tw, true, false, false);
    expect(plain.pill).toBeLessThanOrEqual(BADGE.cap + BADGE.gap + tw + BADGE.padEnd);
  });
});
