/**
 * Gesprochene Geschichten: jede eingetragene Aufnahme liegt in public/lore/audio, der Abspieler erscheint nur dort,
 * wo es eine gibt, und die Musik wird waehrend der Geschichte leise.
 * Narrated stories: every listed recording exists in public/lore/audio, the player appears only where there is one,
 * and the music is turned down during the story.
 */
import { describe, expect, it } from 'vitest';
import { MusicPlayer } from '../src/audio/music';
import { setLanguage } from '../src/i18n/i18n';
import { hasNarration, narrationHtml } from '../src/ui/lore';

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
    expect(html).toContain('preload="none"');
    expect(html).toContain('6 Minuten');
    // Zyrr haben noch keine Aufnahme / the Zyrr have no recording yet
    expect(hasNarration('zyrr')).toBe(false);
    expect(narrationHtml('zyrr')).toBe('');
    setLanguage('en');
    expect(narrationHtml('epilog')).toContain('narrated in German');
    setLanguage('de');
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
