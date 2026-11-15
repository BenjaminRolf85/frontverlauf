// Zeitleiste des Intros: deterministisch, 45 bis 60 Sekunden, Schnitte im Takt, Untertitel lesbar und zweisprachig.
// Intro timeline: deterministic, 45 to 60 seconds, cuts on the beat, subtitles readable and bilingual.
import { describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import { BEAT, DURATION, HUMANS, SCENES, SUBTITLES, frameState, rng, sceneIndexAt } from '../src/intro/timeline';
import { buildScore } from '../src/intro/score';

const lookup = (d: unknown, key: string) => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), d);

describe('Intro-Zeitleiste / intro timeline', () => {
  it('dauert 45 bis 60 Sekunden / lasts 45 to 60 seconds', () => {
    expect(DURATION).toBeGreaterThanOrEqual(45);
    expect(DURATION).toBeLessThanOrEqual(60);
    expect(SCENES[SCENES.length - 1].end).toBe(DURATION);
  });

  it('gleiche Zeit ergibt gleichen Zustand / same time gives the same state', () => {
    for (const t of [0, 0.37, 6, 11.02, 16.5, 21.3, 39.51, 52.1, 57.9, DURATION]) {
      expect(frameState(t)).toEqual(frameState(t));
      expect(JSON.stringify(frameState(t))).toBe(JSON.stringify(frameState(t)));
    }
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('Szenen sind lueckenlos und schneiden auf Schlaegen / scenes are contiguous and cut on beats', () => {
    expect(SCENES[0].start).toBe(0);
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i].start).toBe(SCENES[i - 1].end);
    for (const s of SCENES) {
      expect((s.start / BEAT) % 1).toBe(0);
      expect(s.key).toBeGreaterThan(s.start);
      expect(s.key).toBeLessThan(s.end);
      expect(sceneIndexAt(s.key)).toBe(SCENES.indexOf(s));
    }
    // jede Menschenfraktion hat ihren Auftritt / every human faction gets its beat
    for (const f of HUMANS) expect(SCENES.some((s) => s.id === f)).toBe(true);
  });

  it('Untertitel: mindestens 3 Sekunden, ohne Ueberlappung, in DE und EN / subtitles: at least 3 seconds, no overlap, in DE and EN', () => {
    for (let i = 0; i < SUBTITLES.length; i++) {
      const s = SUBTITLES[i];
      expect(s.end - s.start).toBeGreaterThanOrEqual(3);
      if (i > 0) expect(s.start).toBeGreaterThanOrEqual(SUBTITLES[i - 1].end);
      expect(typeof lookup(de, `intro.sub.${s.key}`)).toBe('string');
      expect(typeof lookup(en, `intro.sub.${s.key}`)).toBe('string');
    }
    expect(frameState(20).subtitle).toBe('korvat');
    expect(frameState(5.9).subtitle).toBeNull();
  });

  it('Klangspur ist deterministisch und liegt in der Laufzeit / soundtrack is deterministic and within the runtime', () => {
    const a = buildScore(), b = buildScore();
    expect(a.map((e) => `${e.at}:${e.bus}:${e.label}`)).toEqual(b.map((e) => `${e.at}:${e.bus}:${e.label}`));
    expect(a.length).toBeGreaterThan(100);
    for (const e of a) { expect(e.at).toBeGreaterThanOrEqual(0); expect(e.at).toBeLessThan(DURATION); }
    for (let i = 1; i < a.length; i++) expect(a[i].at).toBeGreaterThanOrEqual(a[i - 1].at);
  });
});
