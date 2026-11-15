/**
 * Klangspur des Intros: eine sortierte Liste von Ereignissen auf der Zeitleiste. Dieselbe Liste spielt live im Spiel
 * (vorausschauend geplant) und offline im Videoexport (OfflineAudioContext); die Klaenge kommen aus der Audio-Engine.
 * Intro soundtrack: a sorted list of events on the timeline. The same list plays live in the game (scheduled ahead)
 * and offline in the video export (OfflineAudioContext); the sounds come from the audio engine.
 */
import type { AudioEngine, Intensity, ScoreCue } from '../audio/audio';
import type { FactionId } from '../data/balance';
import { BEAT, FACTION_BEAT, HUMANS, SCENES } from './timeline';

/** Musik oder Effekt: folgt den Einstellungen Musik bzw. Effekte / music or effect: follows the music or effects setting */
export type ScoreBus = 'music' | 'sfx';
export interface ScoreEvent { at: number; bus: ScoreBus; label: string; play(e: AudioEngine, when: number): void }

/** Achtel (Schritt der Fraktionsmusik) / eighth note (step of the faction music) */
const STEP = BEAT / 2;

export function buildScore(): ScoreEvent[] {
  const ev: ScoreEvent[] = [];
  const cue = (at: number, kind: ScoreCue, f?: FactionId, vol?: number) =>
    ev.push({ at, bus: 'sfx', label: kind, play: (e, w) => e.scoreCue(kind, w, f, vol) });
  const pad = (at: number, freq: number, dur: number, vol?: number) =>
    ev.push({ at, bus: 'music', label: `pad${freq}`, play: (e, w) => e.scorePad(freq, w, dur, vol) });
  /** Fraktionsmusik von a bis b, Schritte ab 0 (Muster beginnen am Schnitt) / faction music from a to b, steps from 0 (patterns start at the cut) */
  const theme = (f: FactionId, lvl: Intensity, a: number, b: number, from = 0) => {
    for (let k = 0; a + k * STEP < b - 1e-6; k++) {
      const step = from + k;
      ev.push({ at: a + k * STEP, bus: 'music', label: `${f}${lvl}`, play: (e, w) => e.scoreMusic(f, lvl, step, w, STEP) });
    }
  };

  // Stillstand: Grollen, Funkrauschen, Herzschlag / standstill: rumble, radio static, heartbeat
  cue(0, 'drone');
  pad(0.2, 98, 5.8, 0.08);
  cue(0.7, 'radio', 'dravon', 0.8);
  cue(2, 'kick', undefined, 0.5); cue(4, 'kick', undefined, 0.6); cue(5, 'kick', undefined, 0.5);
  cue(3.2, 'radio', 'alvenia', 0.6);

  // Sternfall: Zyrr-Thema, pfeifende Truemmer, Triebwerksgrollen, Steigerung / starfall: Zyrr theme, whistling debris, engine rumble, build-up
  theme('zyrr', 1, 6, 11);
  for (const at of [6.3, 7, 7.7, 8.3, 8.9, 9.5, 10.1]) cue(at, 'whistle', undefined, 0.8);
  cue(7.5, 'heavyEngine', undefined, 0.8); cue(9, 'heavyEngine', undefined, 1);
  cue(9, 'riser', undefined, 0.9);
  cue(10, 'roll');

  // Einschlag / impact
  cue(11, 'explosion', undefined, 1.25); cue(11, 'boom'); cue(11, 'crash');
  pad(11.2, 49, 2.8, 0.1);
  cue(11.5, 'crackle'); cue(12.8, 'crackle', undefined, 0.8);

  // Die Front zerbricht: Glocke, Riss, Wirbel / the front breaks: bell, crack, roll
  cue(14, 'bell'); cue(15, 'bell', undefined, 0.8);
  pad(14, 73.4, 4, 0.08);
  cue(16, 'boom'); cue(16, 'crash'); cue(16, 'kick');
  theme('korvat', 0, 16, 18);
  cue(17, 'roll');

  // Fraktionsauftritte / faction beats
  for (const f of HUMANS) {
    const s = SCENES.find((x) => x.id === f)!.start;
    theme(f, 1, s, s + 4);
    theme(f, 2, s + 4, s + FACTION_BEAT, 16);
    cue(s, 'crash', undefined, 0.7);
    cue(s + 1, 'kick');
    cue(s + 2, 'stab', f);
    cue(s + 5.5, 'roll', undefined, 0.7);
    switch (f) {
      case 'korvat':
        cue(s + 0.3, 'radio', f, 0.7);
        cue(s + 2, 'hooves'); cue(s + 2.4, 'cry', f, 0.9); cue(s + 4, 'hooves', undefined, 1.1);
        break;
      case 'alvenia':
        cue(s + 0.3, 'radio', f, 0.7);
        cue(s + 2, 'shield');
        for (const d of [2.6, 3.2, 4.4, 5]) { cue(s + d - 0.05, 'gunshot', undefined, 0.6); cue(s + d, 'boom', undefined, 0.35); }
        break;
      case 'dravon':
        cue(s + 0.2, 'heavyEngine', undefined, 0.9);
        cue(s + 2.5, 'mg'); cue(s + 3.1, 'mg', undefined, 0.8);
        cue(s + 4.1, 'beep'); cue(s + 4.6, 'beep');
        cue(s + 5, 'explosion', undefined, 0.8);
        break;
      case 'velkar':
        cue(s + 0.3, 'radio', f, 0.8);
        cue(s + 2.1, 'beep'); cue(s + 2.5, 'charge');
        cue(s + 3.5, 'laser'); cue(s + 3.6, 'explosion', undefined, 0.9);
        cue(s + 4.2, 'crackle', undefined, 0.7);
        break;
      case 'meridon':
        cue(s + 0.3, 'radio', f, 0.7);
        cue(s + 2, 'horn'); cue(s + 3, 'boom', undefined, 0.5);
        cue(s + 4, 'coins'); cue(s + 4.6, 'coins', undefined, 0.8);
        break;
    }
  }

  // Fuenf Banner: Fanfare / five banners: fanfare
  cue(48, 'crash'); cue(48, 'fanfare');
  theme('alvenia', 2, 48, 52);
  pad(48, 110, 4, 0.1); pad(50, 146.8, 2, 0.08);
  cue(51, 'roll');

  // Logo: Schlag, Fanfare, Schlussakkord / logo: slam, fanfare, final chord
  cue(52, 'boom'); cue(52, 'crash'); cue(52, 'stab', 'korvat'); cue(52, 'explosion', undefined, 0.7);
  cue(52.5, 'fanfare');
  cue(53.5, 'kick'); cue(53.5, 'stab', 'korvat', 0.8);
  pad(52, 98, 5.6, 0.12); pad(52, 146.8, 5.6, 0.08); pad(53.5, 196, 4.1, 0.06);
  cue(54.5, 'bell', undefined, 0.7);

  // stabil nach Zeit sortieren / stable sort by time
  return ev.map((e, i) => ({ e, i })).sort((a, b) => a.e.at - b.e.at || a.i - b.i).map((x) => x.e);
}
