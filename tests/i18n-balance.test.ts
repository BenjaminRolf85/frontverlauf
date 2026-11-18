/**
 * Zahlen in Beschreibungen kommen aus balance.ts (BALANCE_VARS): Texte ohne Aufrufer-Werte bleiben ohne offene Platzhalter.
 * Numbers in descriptions come from balance.ts (BALANCE_VARS): texts without caller values keep no open placeholders.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { BARRIER, CITY_UPGRADES, HEALING, UNITS, VETERAN } from '../src/data/balance';
import { BALANCE_VARS } from '../src/i18n/balanceVars';
import de from '../src/i18n/de.json';
import { setLanguage, t } from '../src/i18n/i18n';

/** Texte, die ohne Aufrufer-Werte angezeigt werden / texts shown without caller values */
const PLAIN = (k: string) => k.startsWith('unitDesc.') || /^(abilities|rewards)\..*Desc$/.test(k) || /^grand\.(\w+Cond|desc)$/.test(k) || k === 'features.wreckCover';
const keysOf = (o: Record<string, unknown>, p: string): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keysOf(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));

describe('Balance-Platzhalter / balance placeholders', () => {
  afterAll(() => setLanguage('de'));
  it('are finite numbers', () => {
    for (const [k, v] of Object.entries(BALANCE_VARS)) expect(Number.isFinite(v), k).toBe(true);
  });
  for (const lang of ['de', 'en'] as const) {
    it(`${lang}: plain descriptions resolve every placeholder`, () => {
      setLanguage(lang);
      const d = de as unknown as Record<string, Record<string, unknown>>;
      for (const key of keysOf(d, '').filter(PLAIN)) expect(t(key), key).not.toMatch(/\{\w+\}/);
      for (const f of Object.keys(d.factions)) for (const k of ['perkDesc', 'perk2Desc', 'drawbackDesc']) expect(t(`factions.${f}.${k}`), `${f}.${k}`).not.toMatch(/\{\w+\}/);
    });
  }
  it('texts follow balance.ts', () => {
    setLanguage('de');
    expect(t('unitDesc.jeep')).toContain(`${UNITS.jeep.move} Felder`);
    expect(t('unitDesc.tank')).toContain(`${UNITS.tank.move} Felder`);
    expect(t('abilities.healDesc')).toContain(`${HEALING.medic} LP`);
    expect(t('cityUpgrades.barracksDesc')).toContain(`+${VETERAN.bonusHp}`);
    expect(t('cityUpgrades.full')).toContain(String(CITY_UPGRADES.slots));
    expect(t('hud.slowed')).toContain(String(BARRIER.slowedMove));
    // Kommazahl in der Spielsprache / decimal in the game language
    expect(t('factions.dravon.perk2Desc')).toContain('+0,5');
    setLanguage('en');
    expect(t('factions.dravon.perk2Desc')).toContain('+0.5');
  });
  it('caller values win over balance values', () => {
    setLanguage('de');
    expect(t('unitDesc.jeep', { jeepMove: 9 })).toContain('9 Felder');
  });
});
