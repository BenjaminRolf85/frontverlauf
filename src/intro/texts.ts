/**
 * Alle Texte des Intros in der aktuellen Sprache, einmal aufgeloest; der Renderer bekommt nur fertige Zeichenketten.
 * All intro texts in the current language, resolved once; the renderer only receives finished strings.
 */
import { t } from '../i18n/i18n';
import { HUMANS, SUBTITLES, type HumanFaction } from './timeline';

export interface FactionTexts { kicker: string; name: string; short: string; leader: string; leaderTitle: string; quote: string; tag: string }
export interface IntroTexts {
  logo: string;
  tagline: string;
  boom: string;
  prologue: string;
  subs: Record<string, string>;
  factions: Record<HumanFaction, FactionTexts>;
}

/** Kampfstil: Korvat und Alvenia benutzen die Namen ihrer Spielboni / combat style: Korvat and Alvenia use the names of their game bonuses */
const tagOf = (f: HumanFaction) =>
  f === 'korvat' ? t('moveFire.bonus.korvat') : f === 'alvenia' ? t('homeDefense.bonus.alvenia') : t(`intro.tag.${f}`);

export function introTexts(): IntroTexts {
  const factions = {} as Record<HumanFaction, FactionTexts>;
  for (const f of HUMANS) {
    const k = (s: string) => t(`factions.${f}.${s}`);
    factions[f] = {
      kicker: t(`intro.kicker.${f}`), name: k('name'), short: k('short'), leader: k('leader'), leaderTitle: k('leaderTitle'),
      quote: t('intro.quote', { q: k('quote') }), tag: tagOf(f),
    };
  }
  return {
    logo: t('app.title'), tagline: t('intro.tagline'), boom: t('intro.boom'), prologue: t('lore.prologueTitle'),
    subs: Object.fromEntries(SUBTITLES.map((s) => [s.key, t(`intro.sub.${s.key}`)])),
    factions,
  };
}
