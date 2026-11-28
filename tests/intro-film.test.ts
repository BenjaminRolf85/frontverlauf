// Introfilm: Zeitleiste lueckenlos und gemeinsam mit den Blender-Skripten, Untertitel lesbar und zweisprachig, die ganze
// Vorgeschichte abgedeckt, Wahl zwischen Film, 2D-Intro und Diashow, deterministische Klangspur.
// Intro film: timeline contiguous and shared with the Blender scripts, captions readable and bilingual, the whole
// backstory covered, choice between film, 2D intro and slideshow, deterministic soundtrack.
import { describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import { FILM, FILM_FILES, FILM_PANELS, captionAt, chooseIntro, filmSources, overlayAt, overlayKey, shotStart } from '../src/intro/film';
import { buildFilmScore } from '../src/intro/filmScore';

const lookup = (d: unknown, key: string) => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), d);
// ohne @types/node: Dateisystem dynamisch laden / without @types/node: load the file system dynamically
type Fs = { existsSync: (p: string) => boolean; statSync: (p: string) => { size: number } };
const FS_MODULE = 'node:fs';
const { existsSync, statSync } = (await import(/* @vite-ignore */ FS_MODULE)) as Fs;

describe('Introfilm-Zeitleiste / intro film timeline', () => {
  it('dauert 90 bis 150 Sekunden, Einstellungen lueckenlos / lasts 90 to 150 seconds, shots contiguous', () => {
    expect(FILM.duration).toBeGreaterThanOrEqual(90);
    expect(FILM.duration).toBeLessThanOrEqual(150);
    expect(FILM.shots[0].start).toBe(0);
    for (let i = 1; i < FILM.shots.length; i++) expect(FILM.shots[i].start).toBe(FILM.shots[i - 1].end);
    expect(FILM.shots[FILM.shots.length - 1].end).toBe(FILM.duration);
    // ganze Einzelbilder bei der Renderrate / whole frames at the render rate
    for (const s of FILM.shots) expect(((s.end - s.start) * FILM.renderFps) % 1).toBe(0);
    expect(FILM.fps % FILM.renderFps).toBe(0);
  });

  it('jede Einstellung hat ein Blender-Skript / every shot has a Blender script', () => {
    for (const s of FILM.shots) {
      const files = s.id === 'awaken' ? ['awaken_nexus', 'awaken_vesper', 'awaken_zyrr'] : [s.id];
      for (const f of files) expect(existsSync(`tools/intro-film/fv/shots/${f}.py`)).toBe(true);
    }
    expect(FILM_PANELS).toHaveLength(3);
    const aw = FILM.shots.find((s) => s.id === 'awaken')!;
    for (const p of FILM_PANELS) expect(p).toBeLessThan(aw.end - aw.start);
  });

  it('Untertitel: in einer Einstellung, 3 s und mehr, ohne Ueberlappung, lesbar, DE und EN / captions: inside one shot, 3 s or more, no overlap, readable, DE and EN', () => {
    FILM.captions.forEach((c, i) => {
      expect(c.end - c.start).toBeGreaterThanOrEqual(3);
      if (i > 0) expect(c.start).toBeGreaterThanOrEqual(FILM.captions[i - 1].end);
      expect(FILM.shots.some((s) => c.start >= s.start && c.end <= s.end)).toBe(true);
      for (const lang of [de, en]) {
        const text = lookup(lang, `intro.film.sub.${c.key}`);
        expect(typeof text).toBe('string');
        // hoechstens 17 Zeichen je Sekunde / at most 17 characters per second
        expect((text as string).length / (c.end - c.start)).toBeLessThanOrEqual(17);
      }
    });
    for (const o of FILM.overlays) {
      expect(typeof lookup(de, overlayKey(o.key))).toBe('string');
      expect(typeof lookup(en, overlayKey(o.key))).toBe('string');
    }
  });

  it('Untertitel und Einblendungen zur Zeit t / captions and overlays at time t', () => {
    expect(captionAt(0.2)).toBeNull();
    expect(captionAt(2)?.key).toBe('oldWorld');
    expect(captionAt(shotStart('velkar') + 1)?.key).toBe('velkar');
    expect(captionAt(FILM.duration - 0.5)).toBeNull();
    expect(overlayAt(shotStart('crash') + 1.5)?.key).toBe('boom');
    expect(overlayAt(FILM.duration - 0.5)?.key).toBe('tagline');
    expect(overlayAt(10)).toBeNull();
    // Erzaehlerkarte ab der ersten Sekunde / narrator card from the first second
    expect(overlayAt(0.5)?.key).toBe('narrator');
    expect(overlayKey('narrator')).toBe('intro.film.narrator');
    expect(() => shotStart('nope')).toThrow();
  });

  it('die ganze Vorgeschichte in beiden Sprachen, in der Reihenfolge der Chronik (docs/lore.md) / the whole backstory in both languages, in the order of the chronicle (docs/lore.md)', () => {
    const all = (d: unknown) => FILM.captions.map((c) => lookup(d, `intro.film.sub.${c.key}`) as string).join(' ');
    const inOrder = (text: string, words: string[]) => {
      let at = -1;
      for (const w of words) {
        const i = text.indexOf(w, at + 1);
        expect(i, w).toBeGreaterThan(at);
        at = i;
      }
    };
    // alte Welt, Stillstand, Verteilungskriege, Gruendung Verdans, Sternfall, Wettlauf / old world, standstill, distribution wars, founding of Verdan, Starfall, race
    inOrder(all(de), ['Weltrepublik Meridon', 'Banken', 'Große Stillstand', 'NEXUS', 'Grenzen', 'Verteilungskriege', 'Fünf Völker', 'Verdan', 'Frieden', '500 Jahren',
      'Sternfall', 'Raumschiff', 'Kult der Letzten Stunde', 'Glocke', 'NEXUS', 'wartet', 'Zyrr', 'zweiten Heimat', 'Frieden zerbricht', 'Wrack',
      'Korvat', 'Alvenia', 'Dravon', 'Velkar', 'Meridon', 'Rivalen', 'Front wandert wieder']);
    inOrder(all(en), ['world republic of Meridon', 'banks', 'Great Standstill', 'NEXUS', 'Borders', 'distribution wars', 'Five peoples', 'Verdan', 'peace', '500 years',
      'Starfall', 'alien ship', 'Cult of the Final Hour', 'bell', 'NEXUS', 'waits', 'Zyrr', 'second home', 'peace breaks', 'wreck',
      'Korvat', 'Alvenia', 'Dravon', 'Velkar', 'Meridon', 'rivals', 'front is moving again']);
    // wer erzaehlt / who narrates
    expect(lookup(de, 'intro.film.narrator')).toBe('Aus der Chronik von Verdan');
    expect(lookup(en, 'intro.film.narrator')).toBe('From the Chronicle of Verdan');
  });
});

describe('Wahl des Intros / choice of the intro', () => {
  const can = (answer: string) => () => answer;
  it('ohne Animationen oder mit reduzierter Bewegung die Diashow / without animations or with reduced motion the slideshow', () => {
    expect(chooseIntro({ animations: false, reducedMotion: false, canPlayType: can('probably') })).toBe('slides');
    expect(chooseIntro({ animations: true, reducedMotion: true, canPlayType: can('probably') })).toBe('slides');
  });
  it('Film, wenn eine Quelle abspielbar ist, sonst 2D-Intro / film if a source is playable, otherwise the 2D intro', () => {
    expect(chooseIntro({ animations: true, reducedMotion: false, canPlayType: can('maybe') })).toBe('film');
    expect(chooseIntro({ animations: true, reducedMotion: false, canPlayType: (t) => (t.startsWith('video/mp4') ? 'probably' : '') })).toBe('film');
    expect(chooseIntro({ animations: true, reducedMotion: false, canPlayType: can('') })).toBe('canvas');
    expect(chooseIntro({ animations: true, reducedMotion: false })).toBe('canvas');
    expect(chooseIntro({ animations: true, reducedMotion: false, canPlayType: can('probably'), filmFailed: true })).toBe('canvas');
  });
  it('Videodateien liegen vor und bleiben klein / video files exist and stay small', () => {
    let total = 0;
    for (const f of [FILM_FILES.webm, FILM_FILES.mp4, FILM_FILES.poster]) {
      const file = `public/${f}`;
      expect(existsSync(file), file).toBe(true);
      total += statSync(file).size;
    }
    // beide Fassungen zusammen unter 25 MB / both versions together below 25 MB
    expect(total).toBeLessThan(25_000_000);
  });
  it('WebM zuerst, MP4 als Ersatz, relativ zur Basis / WebM first, MP4 as fallback, relative to the base', () => {
    const s = filmSources('./');
    expect(s.map((x) => x.type.split(';')[0])).toEqual(['video/webm', 'video/mp4']);
    for (const x of s) expect(x.src.startsWith('./intro/')).toBe(true);
  });
});

describe('Klangspur des Films / film soundtrack', () => {
  it('deterministisch, sortiert, innerhalb der Laufzeit / deterministic, sorted, within the runtime', () => {
    const a = buildFilmScore(), b = buildFilmScore();
    expect(a.map((e) => `${e.at}:${e.bus}:${e.label}`)).toEqual(b.map((e) => `${e.at}:${e.bus}:${e.label}`));
    expect(a.length).toBeGreaterThan(200);
    for (const e of a) { expect(e.at).toBeGreaterThanOrEqual(0); expect(e.at).toBeLessThan(FILM.duration); }
    for (let i = 1; i < a.length; i++) expect(a[i].at).toBeGreaterThanOrEqual(a[i - 1].at);
    // Einschlag des Mutterschiffs genau beim Treffer im Bild / mothership impact exactly at the hit in the picture
    expect(a.some((e) => e.label === 'explosion' && Math.abs(e.at - (shotStart('crash') + 1)) < 1e-9)).toBe(true);
  });
});
