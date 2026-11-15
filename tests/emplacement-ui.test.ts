/**
 * Texte zur Geschuetzstellung: Fraktionsmerkmal, Regelseite und Panel-Texte ohne offene Platzhalter, Zahlen aus balance.ts.
 * Gun emplacement texts: faction trait, rules page and panel texts without open placeholders, numbers from balance.ts.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { EMPLACEMENT } from '../src/data/balance';
import { setLanguage, t } from '../src/i18n/i18n';
import { factionTraits } from '../src/ui/factionInfo';
import { rulesHtml } from '../src/ui/rules';
import { emplacementCount, emplacementDesc, emplacementName, emplacementStats } from '../src/ui/emplacement';
import { addCity, blankGame } from './helpers';

describe('Geschuetzstellung: Texte / gun emplacement: texts', () => {
  afterAll(() => setLanguage('de'));
  for (const lang of ['de', 'en'] as const) {
    it(`${lang}: Festungsbau als Merkmal nur bei Dravon / fortress building as a trait for Dravon only`, () => {
      setLanguage(lang);
      const f = factionTraits('dravon').find((tr) => tr.kind === 'feature')!;
      expect(f.value).toBe(t('factions.dravon.feature'));
      expect(f.desc).toContain(String(EMPLACEMENT.cost));
      expect(f.desc).not.toMatch(/\{\w+\}/);
      expect(factionTraits('korvat').some((tr) => tr.kind === 'feature')).toBe(false);
    });
    it(`${lang}: Regelseite und Panel / rules page and panel`, () => {
      setLanguage(lang);
      const html = rulesHtml();
      expect(html).toContain('data-rule="emplacements"');
      expect(html).toContain(String(EMPLACEMENT.cost));
      const s = blankGame({ factions: ['dravon', 'korvat'] });
      addCity(s, 3, 3, 0, { hq: true });
      for (const txt of [emplacementName(s, 0), emplacementDesc(s, 0), emplacementStats(EMPLACEMENT.hp), emplacementCount(s, 0), t('emplacement.fires', { name: 'Dravon', dmg: 4 })]) {
        expect(txt).not.toMatch(/\{\w+\}/);
        expect(txt).not.toContain('emplacement.');
      }
      expect(emplacementCount(s, 0)).toContain('0/1');
    });
  }
});
