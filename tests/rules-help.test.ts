/**
 * Regeln-Seite und neue Hilfetexte: alle Platzhalter aufgeloest, Zahlen aus balance.ts.
 * Rules page and new help texts: all placeholders resolved, numbers from balance.ts.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { MODES, RETREAT, UPKEEP } from '../src/data/balance';
import { setLanguage, t } from '../src/i18n/i18n';
import { rulesHtml } from '../src/ui/rules';
import { TUTORIAL_CONFIG } from '../src/ui/tutorial';

describe('Regeln / rules', () => {
  afterAll(() => setLanguage('de'));
  for (const lang of ['de', 'en'] as const) {
    it(`${lang}: every section renders without open placeholders`, () => {
      setLanguage(lang);
      const html = rulesHtml();
      expect(html).not.toMatch(/\{\w+\}/);
      expect(html).not.toContain('rules.');
      // 19 Abschnitte: dazu Schiffe und Werft, die Schattenflotte der Meridon und die Stuetzpunkte / 19 sections: plus ships and shipyard, the Meridon shadow fleet and the bases
      expect((html.match(/<details/g) ?? []).length).toBe(19);
      expect(html).toContain('data-rule="bases"');
      expect(html).toContain('data-rule="shadowFleet"');
    });
    it(`${lang}: numbers come from balance.ts`, () => {
      setLanguage(lang);
      const html = rulesHtml();
      expect(html).toContain(String(MODES.pointsRounds));
      expect(html).toContain(`${Math.round(UPKEEP.share * 100)} %`);
      expect(html).toContain(`${Math.round(RETREAT.damage * 100)} %`);
    });
  }
  it('needsTech names the tech', () => {
    setLanguage('de');
    expect(t('hud.needsTech', { tech: t('techs.fiveYearPlan') })).toBe('Benötigt: Großer Fünfjahresplan');
  });
});

describe('Tutorial', () => {
  it('runs without faction victories but with hit luck', () => {
    expect(TUTORIAL_CONFIG.factionVictory).toBe(false);
    expect(TUTORIAL_CONFIG.hitChance).toBe(true);
  });
});
