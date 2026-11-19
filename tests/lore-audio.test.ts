/**
 * Gesprochene Geschichten: jede eingetragene Aufnahme liegt in public/lore/audio, der Abspieler erscheint nur dort,
 * wo es eine gibt, und die Musik wird waehrend der Geschichte leise.
 * Narrated stories: every listed recording exists in public/lore/audio, the player appears only where there is one,
 * and the music is turned down during the story.
 */
import { describe, expect, it } from 'vitest';
import { MusicPlayer } from '../src/audio/music';
import { setLanguage } from '../src/i18n/i18n';
import { hasNarration, narrationHtml, storyButton, storyClock } from '../src/ui/lore';
import { cardLinks, factionDetails } from '../src/ui/factionInfo';

// ohne @types/node: Dateisystem dynamisch laden / without @types/node: load the file system dynamically
type Fs = { existsSync: (p: string) => boolean; statSync: (p: string) => { size: number } };
const FS_MODULE = 'node:fs';
const { existsSync, statSync } = (await import(/* @vite-ignore */ FS_MODULE)) as Fs;

const IDS = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'vesper', 'nexus', 'epilog'];

describe('gesprochene Geschichten / narrated stories', () => {
  it('jede Aufnahme liegt vor und ist klein genug / every recording exists and is small enough', () => {
    for (const id of IDS) {
      expect(hasNarration(id)).toBe(true);
      const file = `public/lore/audio/${id}.mp3`;
      expect(existsSync(file), file).toBe(true);
      // Mono 64 kbit/s: hoechstens etwa 5 MB je Geschichte / mono 64 kbit/s: at most about 5 MB per story
      expect(statSync(file).size).toBeLessThan(5_000_000);
    }
  });

  it('Abspieler nur mit Aufnahme, laedt erst beim Abspielen / player only with a recording, loads only on play', () => {
    setLanguage('de');
    const html = narrationHtml('korvat');
    expect(html).toContain('lore/audio/korvat.mp3');
    // kein <audio> im Fenster: geladen wird erst beim Antippen / no <audio> in the dialog: loading starts on tap
    expect(html).not.toContain('<audio');
    expect(html).toContain('data-story="korvat"');
    expect(html).toContain('6 Minuten');
    expect(html).toContain('6:00');
    // Zyrr haben noch keine Aufnahme / the Zyrr have no recording yet
    expect(hasNarration('zyrr')).toBe(false);
    expect(narrationHtml('zyrr')).toBe('');
    setLanguage('en');
    expect(narrationHtml('epilog')).toContain('narrated in German');
    setLanguage('de');
  });

  it('direkt bei der Fraktion: Knopf auf der Karte und Abspieler im Fraktionsfenster / right at the faction: button on the card and player in the faction window', () => {
    setLanguage('de');
    expect(storyButton('dravon')).toContain('data-story="dravon"');
    expect(storyButton('dravon')).toContain('Geschichte anhören');
    expect(storyButton('dravon')).toContain('9 Min.');
    expect(storyButton('zyrr')).toBe('');
    // Fraktionskarten (Einsatzplanung, Auswahl) und Fraktionsfenster / faction cards (setup, picker) and faction window
    expect(cardLinks('meridon')).toContain('data-story="meridon"');
    expect(cardLinks('zyrr')).not.toContain('data-story');
    expect(cardLinks('zyrr')).toContain('data-details="zyrr"');
    expect(factionDetails('velkar')).toContain('data-story-player="velkar"');
    expect(factionDetails('zyrr')).not.toContain('data-story-player');
    setLanguage('en');
    expect(storyButton('dravon')).toContain('Listen to the story');
    setLanguage('de');
    expect(storyClock(0)).toBe('0:00');
    expect(storyClock(367.8)).toBe('6:07');
    expect(storyClock(NaN)).toBe('0:00');
  });

  it('Musik wird waehrend der Geschichte leise und danach wieder laut / music ducks during the story and recovers', () => {
    const m = new MusicPlayer();
    const duck = () => (m as unknown as { duck: number }).duck;
    expect(duck()).toBe(1);
    m.narration(true);
    expect(duck()).toBeLessThan(0.2);
    m.narration(false);
    expect(duck()).toBe(1);
  });
});
