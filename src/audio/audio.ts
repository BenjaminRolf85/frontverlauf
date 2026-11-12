/**
 * Klang: alles prozedural per WebAudio erzeugt (eigene Schoepfung). Ein Musikthema je Fraktion,
 * kurze Toene fuer Auswahl, Bewegung, Kampf und Zugende. Stumm schaltbar.
 * Sound: everything generated procedurally with WebAudio (own creation). One music theme per faction,
 * short sounds for select, move, combat and end of turn. Can be muted.
 */
import type { FactionId } from '../data/balance';

export type Sfx = 'select' | 'move' | 'attack' | 'hit' | 'kill' | 'endTurn' | 'capture' | 'levelUp' | 'error' | 'build' | 'research' | 'click';

interface Theme { tempo: number; root: number; scale: number[]; pattern: number[]; bass: number[]; wave: OscillatorType }
const THEMES: Record<FactionId, Theme> = {
  korvat: { tempo: 104, root: 196, scale: [0, 2, 3, 5, 7, 8, 10], pattern: [0, 2, 4, 2, 0, 4, 5, 4], bass: [0, 0, 5, 3], wave: 'square' },
  dravon: { tempo: 92, root: 174.6, scale: [0, 1, 3, 5, 7, 8, 10], pattern: [0, 0, 3, 1, 0, 5, 4, 3], bass: [0, 5, 0, 1], wave: 'sawtooth' },
  alvenia: { tempo: 112, root: 220, scale: [0, 2, 4, 5, 7, 9, 11], pattern: [0, 2, 4, 6, 5, 4, 2, 4], bass: [0, 3, 4, 4], wave: 'triangle' },
  meridon: { tempo: 124, root: 246.9, scale: [0, 2, 4, 7, 9], pattern: [0, 1, 2, 4, 3, 2, 1, 3], bass: [0, 2, 3, 1], wave: 'triangle' },
  velkar: { tempo: 98, root: 164.8, scale: [0, 2, 3, 5, 7, 9, 10], pattern: [0, 4, 2, 5, 4, 6, 2, 1], bass: [0, 3, 5, 4], wave: 'sine' },
  vesper: { tempo: 76, root: 130.8, scale: [0, 1, 3, 5, 6, 8, 10], pattern: [0, 0, 1, 0, 3, 2, 1, 0], bass: [0, 0, 1, 0], wave: 'sawtooth' },
  nexus: { tempo: 132, root: 207.7, scale: [0, 2, 3, 7, 10], pattern: [0, 2, 4, 2, 1, 3, 0, 4], bass: [0, 0, 3, 2], wave: 'square' },
  zyrr: { tempo: 86, root: 138.6, scale: [0, 1, 4, 6, 7, 10], pattern: [0, 3, 1, 5, 2, 4, 0, 5], bass: [0, 1, 0, 3], wave: 'sine' },
};

/** Stimme je Fraktion: Grundton, Wellenform, Formant / voice per faction */
const VOICES: Record<FactionId, { pitch: number; wave: OscillatorType; formant: number }> = {
  korvat: { pitch: 150, wave: 'square', formant: 900 },
  dravon: { pitch: 105, wave: 'sawtooth', formant: 650 },
  alvenia: { pitch: 210, wave: 'triangle', formant: 1300 },
  meridon: { pitch: 240, wave: 'square', formant: 1600 },
  velkar: { pitch: 180, wave: 'sine', formant: 2200 },
  vesper: { pitch: 120, wave: 'sawtooth', formant: 700 },
  nexus: { pitch: 260, wave: 'square', formant: 3000 },
  zyrr: { pitch: 320, wave: 'sine', formant: 2600 },
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  musicOn = true;
  effectsOn = true;
  private theme: FactionId | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** Nach einer Nutzergeste aufrufen / call after a user gesture */
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, slide = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest);
    o.start(start); o.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, vol: number, cutoff: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; data[i] = ((seed / 2147483647) * 2 - 1) * (1 - i / len); }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master!);
    src.start(start);
  }

  play(s: Sfx) {
    if (!this.effectsOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + 0.01, m = this.master;
    switch (s) {
      case 'click': this.tone(660, t, 0.05, 'square', 0.08, m); break;
      case 'select': this.tone(520, t, 0.07, 'triangle', 0.2, m); this.tone(780, t + 0.05, 0.08, 'triangle', 0.18, m); break;
      case 'move': this.tone(300, t, 0.12, 'triangle', 0.18, m, 1.6); break;
      case 'attack': this.noise(t, 0.25, 0.5, 1800); this.tone(140, t, 0.2, 'square', 0.2, m, 0.4); break;
      case 'hit': this.noise(t, 0.12, 0.35, 900); break;
      case 'kill': this.noise(t, 0.4, 0.6, 600); this.tone(110, t, 0.35, 'sawtooth', 0.18, m, 0.3); break;
      case 'endTurn': [392, 523, 659].forEach((f, i) => this.tone(f, t + i * 0.08, 0.14, 'square', 0.12, m)); break;
      case 'capture': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.07, 0.16, 'square', 0.14, m)); break;
      case 'levelUp': [440, 554, 659, 880].forEach((f, i) => this.tone(f, t + i * 0.06, 0.18, 'triangle', 0.2, m)); break;
      case 'build': this.noise(t, 0.08, 0.3, 2500); this.noise(t + 0.12, 0.08, 0.3, 2500); break;
      case 'research': this.tone(880, t, 0.25, 'sine', 0.18, m, 1.5); break;
      case 'error': this.tone(180, t, 0.18, 'square', 0.15, m, 0.7); break;
    }
  }

  /**
   * Comic-Laut zur Sprechblase: gebrabbelte Silben mit Fraktionsstimme, bei Fluechen ein Zeichensalat-Geraeusch.
   * Comic sound for a speech bubble: babbled syllables in the faction voice, a grawlix noise for curses.
   */
  bark(faction: FactionId, text: string) {
    if (!this.effectsOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const v = VOICES[faction];
    let t = ctx.currentTime + 0.02;
    const words = Math.max(2, Math.min(7, text.split(/\s+/).length));
    let seed = text.length * 31 + text.charCodeAt(0);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const g = ctx.createGain();
    g.gain.value = 0.55;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = v.formant; f.Q.value = 1.4;
    g.connect(f); f.connect(this.master);
    for (let i = 0; i < words; i++) {
      const dur = 0.06 + rnd() * 0.06;
      const base = v.pitch * (0.85 + rnd() * 0.4);
      this.tone(base, t, dur, v.wave, 0.35, g, 0.75 + rnd() * 0.6);
      t += dur + 0.025;
    }
    // Ausrufezeichen hebt die Stimme / exclamation raises the voice
    if (text.trim().endsWith('!')) this.tone(v.pitch * 1.5, t, 0.12, v.wave, 0.3, g, 1.4);
    // Fluch: Zeichensalat / curse: grawlix
    if (/[#@%]/.test(text)) {
      this.noise(t + 0.02, 0.12, 0.25, 3000);
      [1.8, 1.2, 2.1, 0.9].forEach((m, i) => this.tone(v.pitch * m, t + 0.03 + i * 0.05, 0.05, 'square', 0.15, this.master!, 0.6));
    }
  }

  /** Fraktionsthema abspielen / play faction theme */
  setTheme(f: FactionId | null) {
    this.theme = f;
    this.step = 0;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 120);
  }

  private schedule() {
    if (!this.musicOn || !this.theme) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicGain) return;
    const th = THEMES[this.theme];
    const beat = 60 / th.tempo / 2;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.4) {
      const i = this.step % th.pattern.length;
      const deg = th.pattern[i];
      const semis = th.scale[deg % th.scale.length] + 12 * Math.floor(deg / th.scale.length);
      const freq = th.root * Math.pow(2, semis / 12);
      if (this.step % 16 < 14) this.tone(freq, this.nextTime, beat * 0.9, th.wave, 0.22, this.musicGain);
      if (i % 2 === 0) {
        const b = th.bass[Math.floor(this.step / 8) % th.bass.length];
        const bs = th.scale[b % th.scale.length];
        this.tone(th.root / 2 * Math.pow(2, bs / 12), this.nextTime, beat * 1.8, 'triangle', 0.3, this.musicGain);
      }
      this.nextTime += beat;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
