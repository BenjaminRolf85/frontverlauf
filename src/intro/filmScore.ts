/**
 * Klangspur des Introfilms: dieselben prozeduralen Klaenge wie das 2D-Intro (Audio-Engine), auf der Zeitleiste des Films
 * (src/intro/film.json). Sie wird nur in der Entwicklung offline gerechnet (export.ts, tools/intro-film) und als Tonspur
 * in das Video gemischt; im Spiel spielt das Video sie ab. Deterministisch: gleiche Saat, gleiche Liste.
 * Soundtrack of the intro film: the same procedural sounds as the 2D intro (audio engine), on the film's timeline
 * (src/intro/film.json). It is only rendered offline in development (export.ts, tools/intro-film) and mixed into the
 * video as its audio track; in the game the video plays it. Deterministic: same seed, same list.
 */
import { AudioEngine, type Intensity, type ScoreCue } from '../audio/audio';
import type { FactionId } from '../data/balance';
import { FILM, FILM_PANELS, shotStart } from './film';
import type { ScoreEvent } from './score';
import { output, SEED } from './sound';
import { BEAT, rng } from './timeline';

const STEP = BEAT / 2;

export function buildFilmScore(): ScoreEvent[] {
  const ev: ScoreEvent[] = [];
  const cue = (at: number, kind: ScoreCue, f?: FactionId, vol?: number) =>
    ev.push({ at, bus: 'sfx', label: kind, play: (e, w) => e.scoreCue(kind, w, f, vol) });
  const pad = (at: number, freq: number, dur: number, vol?: number) =>
    ev.push({ at, bus: 'music', label: `pad${freq}`, play: (e, w) => e.scorePad(freq, w, dur, vol) });
  const theme = (f: FactionId, lvl: Intensity, a: number, b: number, from = 0) => {
    for (let k = 0; a + k * STEP < b - 1e-6; k++) {
      const step = from + k;
      ev.push({ at: a + k * STEP, bus: 'music', label: `${f}${lvl}`, play: (e, w) => e.scoreMusic(f, lvl, step, w, STEP) });
    }
  };
  const S = shotStart;

  // 1 Verdan: Marsch der Maschinen, dann der Stillstand (8,4 s) / Verdan: march of the machines, then the standstill (8.4 s)
  theme('dravon', 1, 0, 8);
  pad(0, 98, 8, 0.06);
  cue(0.5, 'heavyEngine', undefined, 0.7); cue(3, 'heavyEngine', undefined, 0.8); cue(5.5, 'horn', undefined, 0.6);
  cue(8.4, 'boom'); cue(8.4, 'crash', undefined, 0.6); cue(8.5, 'drone');
  cue(9.4, 'radio', 'dravon', 0.7);
  for (const at of [11, 12, 13.5, 15]) cue(at, 'kick', undefined, 0.5);
  pad(9, 73.4, 7, 0.07);

  // 2 Wracks / wrecks
  const w = S('wrecks');
  pad(w, 61.7, 8, 0.08);
  theme('korvat', 0, w + 2, w + 8);
  cue(w + 0.5, 'crackle', undefined, 0.6); cue(w + 3, 'radio', 'alvenia', 0.5); cue(w + 6, 'crackle', undefined, 0.5);

  // 3 Kreide / chalk
  const c = S('chalk');
  theme('alvenia', 0, c, c + 8);
  pad(c, 110, 8, 0.06);
  for (const at of [0.8, 2.2, 3.6, 5.0]) cue(c + at, 'snare', undefined, 0.35);

  // 4 Der Himmel brennt / the sky burns
  const b = S('skyburns');
  theme('zyrr', 1, b, b + 6);
  for (const at of [0.3, 1, 1.7, 2.3, 2.9, 3.5, 4.1, 4.7]) cue(b + at, 'whistle', undefined, 0.8);
  cue(b + 1.5, 'heavyEngine', undefined, 0.9); cue(b + 3, 'heavyEngine', undefined, 1);
  cue(b + 3.5, 'riser', undefined, 0.9); cue(b + 5, 'roll');

  // 5 Absturz / crash
  const k = S('crash') + 1;
  cue(k, 'explosion', undefined, 1.25); cue(k, 'boom'); cue(k, 'crash');
  cue(k + 0.4, 'explosion', undefined, 0.8);
  pad(k + 0.2, 49, 4, 0.1);
  cue(k + 0.6, 'crackle'); cue(k + 2, 'crackle', undefined, 0.8);
  theme('zyrr', 0, k + 3, S('bell'));

  // 6 Die Glocke / the bell
  const g = S('bell');
  for (const at of [0.9, 1.9, 2.8, 3.7, 4.6]) cue(g + at, 'bell', undefined, 0.85);
  pad(g, 73.4, 6, 0.08);

  // 7 Erwachen (drei Felder) / awakening (three panels)
  const [p1, p2, p3] = FILM_PANELS.map((p) => S('awaken') + p);
  cue(p1, 'crash', undefined, 0.6); theme('nexus', 1, p1, p2); cue(p1 + 0.6, 'beep'); cue(p1 + 1.2, 'beep'); cue(p1 + 2.8, 'heavyEngine', undefined, 0.8);
  cue(p2, 'crash', undefined, 0.6); theme('vesper', 1, p2, p3); cue(p2 + 0.8, 'cry', 'vesper', 0.8); cue(p2 + 1.6, 'bell', undefined, 0.5);
  cue(p3, 'crash', undefined, 0.6); theme('zyrr', 1, p3, S('gate')); cue(p3 + 1.4, 'charge'); cue(p3 + 1.4, 'riser', undefined, 0.6);

  // 8 Das Tor / the gate
  const o = S('gate');
  theme('zyrr', 2, o, o + 8);
  cue(o + 1.6, 'riser'); cue(o + 2.6, 'crash'); cue(o + 2.6, 'boom', undefined, 0.6);
  cue(o + 4.4, 'riser', undefined, 0.8); cue(o + 5.2, 'crash'); cue(o + 5.2, 'boom', undefined, 0.6);
  pad(o + 5.2, 55, 2.8, 0.09);

  // 9 Die Front zerbricht / the front breaks
  const f = S('fracture');
  cue(f, 'bell'); pad(f, 73.4, 6, 0.08);
  cue(f + 1.2, 'boom'); cue(f + 1.2, 'crash'); cue(f + 1.2, 'kick');
  theme('korvat', 0, f + 2, f + 6);
  cue(f + 5.4, 'roll');

  // 10-14 Fraktionen / factions
  const humans: FactionId[] = ['korvat', 'alvenia', 'dravon', 'velkar', 'meridon'];
  for (const h of humans) {
    const s = S(h);
    theme(h, 1, s, s + 4.5);
    theme(h, 2, s + 4.5, s + 7, 16);
    cue(s, 'crash', undefined, 0.7);
    cue(s + 6.4, 'roll', undefined, 0.6);
    switch (h) {
      case 'korvat':
        cue(s + 0.4, 'hooves'); cue(s + 2, 'hooves', undefined, 1.1); cue(s + 2.4, 'cry', h, 0.9); cue(s + 4, 'hooves', undefined, 1.1);
        cue(s + 2.9, 'boom', undefined, 0.8); cue(s + 5, 'boom', undefined, 0.7);
        break;
      case 'alvenia':
        cue(s + 0.4, 'shield'); cue(s + 1, 'charge'); cue(s + 2.6, 'stab', h);
        cue(s + 3.4, 'explosion', undefined, 0.9); cue(s + 3.4, 'boom'); cue(s + 3.6, 'bell', undefined, 0.6);
        break;
      case 'dravon':
        for (const at of [1.2, 2.6, 4.0]) { cue(s + at, 'gunshot', undefined, 0.8); cue(s + at, 'boom', undefined, 0.6); cue(s + at + 0.7, 'explosion', undefined, 0.5); }
        cue(s + 3.3, 'beep'); cue(s + 4.4, 'beep');
        cue(s + 5, 'explosion', undefined, 0.9);
        break;
      case 'velkar':
        cue(s + 0.3, 'radio', h, 0.6); cue(s + 1.8, 'charge'); cue(s + 2.4, 'laser'); cue(s + 2.5, 'explosion', undefined, 0.9);
        cue(s + 4.1, 'charge', undefined, 0.6); cue(s + 4.6, 'laser'); cue(s + 4.75, 'explosion', undefined, 0.8);
        break;
      case 'meridon':
        cue(s + 0.4, 'horn'); cue(s + 1.6, 'beep'); cue(s + 2.2, 'riser'); cue(s + 2.2, 'heavyEngine');
        cue(s + 4.2, 'coins'); cue(s + 4.8, 'coins', undefined, 0.8);
        break;
    }
  }

  // 15 Fuenf Banner / five banners
  const n = S('banners');
  cue(n, 'crash'); cue(n, 'fanfare');
  theme('alvenia', 2, n, n + 6);
  pad(n, 110, 6, 0.1); pad(n + 3, 146.8, 3, 0.08);
  cue(n + 5.4, 'roll');

  // 16 Titel / title
  const t = S('title') + 0.5;
  cue(t, 'boom'); cue(t, 'crash'); cue(t, 'stab', 'korvat'); cue(t, 'explosion', undefined, 0.7);
  cue(t + 0.5, 'fanfare');
  cue(t + 1.5, 'kick'); cue(t + 1.5, 'stab', 'korvat', 0.8);
  pad(t, 98, 6.4, 0.12); pad(t, 146.8, 6.4, 0.08); pad(t + 1.5, 196, 4.9, 0.06);
  cue(t + 2.4, 'bell', undefined, 0.7);

  return ev.filter((e) => e.at < FILM.duration).map((e, i) => ({ e, i })).sort((a, z) => a.e.at - z.e.at || a.i - z.i).map((x) => x.e);
}

/**
 * Ganze Klangspur des Films offline rechnen; `buses` waehlt die Spuren (ohne Angabe beide). Der Film nutzt nur 'sfx':
 * die Musik kommt aus den Stuecken des Spiels (tools/intro-film/music.json).
 * Render the film's whole soundtrack offline; `buses` picks the tracks (both if omitted). The film uses only 'sfx':
 * the music comes from the game's tracks (tools/intro-film/music.json).
 */
export async function renderFilmSoundtrack(sampleRate = 48000, buses?: readonly ScoreEvent['bus'][]): Promise<AudioBuffer> {
  const D = FILM.duration;
  const ctx = new OfflineAudioContext(2, Math.ceil(D * sampleRate), sampleRate);
  const out = output(ctx);
  out.fade.gain.setValueAtTime(1, D - 2);
  out.fade.gain.linearRampToValueAtTime(0, D);
  const eng = new AudioEngine();
  eng.attach(ctx, out, { rnd: rng(SEED), music: 0.42 });
  for (const e of buildFilmScore()) if (!buses || buses.includes(e.bus)) e.play(eng, e.at);
  return ctx.startRendering();
}
