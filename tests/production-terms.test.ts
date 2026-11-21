/**
 * Wortwahl Forschung / Produktion: Menschen-Fraktionen schalten Produktionsfaehigkeiten frei, Zyrr, NEXUS und Kult
 * forschen. Nur Texte, gleiche Platzhalter, gleiche Schluessel in DE und EN.
 * Wording research / production: human factions unlock production capabilities, the Zyrr, NEXUS and the cult
 * research. Texts only, same placeholders, same keys in DE and EN.
 */
import { afterAll, describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import { factionRace } from '../src/core';
import { FACTION_IDS, HIT, ROSTERS } from '../src/data/balance';
import { has, setLanguage, t } from '../src/i18n/i18n';
import { rulesHtml } from '../src/ui/rules';
import { techT, usesProduction } from '../src/ui/terms';
import { CAMPAIGN_FACTIONS } from '../src/core';

type Tree = Record<string, unknown>;
const flat = (o: Tree, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) =>
  (v && typeof v === 'object' && !Array.isArray(v) ? flat(v as Tree, `${p}${k}.`) : [[`${p}${k}`, String(v)] as [string, string]]));
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const HUMANS = FACTION_IDS.filter((f) => !ROSTERS[f]);

describe('Forschung / Produktion / research / production', () => {
  afterAll(() => setLanguage('de'));

  it('Rasse: fuenf Menschen sagen Produktion, Zyrr, NEXUS und Kult Forschung / race: five humans say production, Zyrr, NEXUS and cult research', () => {
    expect(HUMANS).toEqual(['korvat', 'dravon', 'alvenia', 'meridon', 'velkar']);
    expect(HUMANS).toEqual(CAMPAIGN_FACTIONS);
    for (const f of FACTION_IDS) {
      expect(factionRace(f), f).toBe(HIT.race[f] ?? 'human');
      expect(usesProduction(f), f).toBe(HUMANS.includes(f));
    }
    expect(usesProduction(null)).toBe(false);
  });

  it('jede Menschen-Fassung hat einen Grundtext mit denselben Platzhaltern, in DE und EN / every human variant has a base text with the same placeholders, in DE and EN', () => {
    for (const [lang, dict] of [['de', de], ['en', en]] as const) {
      const all = new Map(flat(dict as Tree));
      const prod = flat((dict as Tree).production as Tree);
      expect(prod.length, lang).toBeGreaterThan(20);
      for (const [k, v] of prod) {
        const base = all.get(k);
        expect(base, `${lang} ${k}`).toBeDefined();
        expect(vars(v), `${lang} ${k}`).toEqual(vars(base!));
        // die Menschen-Fassung forscht nicht / the human variant does not research
        expect(v, `${lang} ${k}`).not.toMatch(/forsch|research|technolog/i);
      }
    }
    expect(flat((de as Tree).production as Tree).map(([k]) => k)).toEqual(flat((en as Tree).production as Tree).map(([k]) => k));
  });

  it('HUD, Dialog und Hinweis je Rasse / HUD, dialog and toast by race', () => {
    setLanguage('de');
    // Menschen: Doktrinen (Einheiten kommen aus Produktionsstaetten) / humans: doctrines (units come from production sites)
    for (const f of HUMANS) {
      expect(techT('hud.research', f)).toBe('Doktrinen');
      expect(techT('tech.title', f)).toBe('Doktrinen');
      expect(techT('events.research', f, { tech: 'X' })).toBe('X eingeführt');
    }
    for (const f of ['zyrr', 'nexus', 'vesper'] as const) {
      expect(techT('hud.research', f)).toBe('Forschung');
      expect(techT('events.research', f, { tech: 'X' })).toBe('X erforscht');
    }
    // ohne Menschen-Fassung: der normale Text / without a human variant: the normal text
    expect(has('production.hud.endTurn')).toBe(false);
    expect(techT('hud.endTurn', 'korvat')).toBe(t('hud.endTurn'));
    setLanguage('en');
    expect(techT('hud.research', 'velkar')).toBe('Doctrines');
    expect(techT('tech.title', 'dravon')).toBe('Doctrines');
    expect(techT('tech.researched', 'meridon')).toBe('adopted');
    expect(techT('hud.research', 'nexus')).toBe('Research');
    expect(techT('tech.researched', 'zyrr')).toBe('researched');
  });

  it('HUD-Knopf bleibt kurz (390 px) / HUD button stays short (390 px)', () => {
    for (const lang of ['de', 'en'] as const) {
      setLanguage(lang);
      expect(techT('hud.research', 'korvat').length).toBeLessThanOrEqual(t('hud.research').length + 2);
    }
  });

  it('Regelseite: Menschen lesen Produktion, die anderen Forschung, ohne Partie ein Hinweis / rules page: humans read production, the others research, without a game a note', () => {
    for (const lang of ['de', 'en'] as const) {
      setLanguage(lang);
      const human = rulesHtml(null, 'alvenia');
      // "Forschungsposten" / "research post" ist der Name der eroberten Orte der Velkar (Wunsch des Auftraggebers), keine Forschung
      // "Forschungsposten" / "research post" is the name of Velkar's captured places (client's wish), not research
      expect(human, lang).not.toMatch(lang === 'de' ? /Forschung(?!sposten)|erforsch/ : /research(?! post)/i);
      expect(human, lang).toMatch(lang === 'de' ? /Produktion/ : /production/i);
      expect(human).not.toContain(t('rules.productionNote'));
      const alien = rulesHtml(null, 'zyrr');
      expect(alien, lang).toMatch(lang === 'de' ? /Forschung/ : /research/i);
      expect(alien).not.toContain(t('rules.productionNote'));
      expect(rulesHtml()).toContain(t('rules.productionNote'));
      expect(human).not.toMatch(/\{\w+\}/);
    }
  });

  it('Velkar-Texte sprechen von Produktion / Velkar texts talk about production', () => {
    setLanguage('de');
    expect(t('factions.velkar.perkDesc')).toBe('Alle Doktrinen kosten 12 % weniger.');
    // ausser dem Namen der Forschungsposten (Wunsch des Auftraggebers) / except the name of the research posts (client's wish)
    for (const k of ['perk', 'perkDesc', 'style', 'aiStyle', 'alignment', 'lore']) expect(t(`factions.velkar.${k}`), k).not.toMatch(/forsch(?!ungsposten)/i);
    setLanguage('en');
    for (const k of ['perk', 'perkDesc', 'style', 'aiStyle', 'alignment', 'lore']) expect(t(`factions.velkar.${k}`), k).not.toMatch(/research(?! post)/i);
    // die anderen Rassen bleiben bei Forschung / the other races stay with research
    expect(t('xeno.noResearch')).toMatch(/research/i);
    expect(t('nexus.noResearch')).toMatch(/research/i);
  });
});
