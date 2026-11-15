/**
 * Klangspur abspielen: live im Spiel (vorausschauend geplant, folgt den Einstellungen Musik und Effekte) oder offline
 * fuer den Videoexport (OfflineAudioContext, danach als WAV). Beide nutzen dieselbe Ereignisliste und dieselbe Saat.
 * Play the soundtrack: live in the game (scheduled ahead, follows the music and effects settings) or offline for the
 * video export (OfflineAudioContext, then as WAV). Both use the same event list and the same seed.
 */
import { AudioEngine } from '../audio/audio';
import { buildScore, type ScoreEvent } from './score';
import { DURATION, rng } from './timeline';

const SEED = 1847;
/** Vorlauf beim Planen in Sekunden / scheduling look-ahead in seconds */
const LOOKAHEAD = 0.8;

/**
 * Ausgang der Klangspur: Vorverstaerkung und Begrenzer gegen Uebersteuern, dann Ausblendung.
 * Soundtrack output: pre-gain and limiter against clipping, then the fade.
 */
function output(ctx: BaseAudioContext): GainNode & { fade: GainNode } {
  const pre = ctx.createGain(); pre.gain.value = 2.2;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -9; lim.knee.value = 4; lim.ratio.value = 16; lim.attack.value = 0.002; lim.release.value = 0.2;
  const fade = ctx.createGain();
  pre.connect(lim); lim.connect(fade); fade.connect(ctx.destination);
  return Object.assign(pre, { fade });
}

/** Ausklang am Ende / fade at the end */
function endFade(fade: GainNode, t0: number) {
  fade.gain.setValueAtTime(1, t0 + DURATION - 1.4);
  fade.gain.linearRampToValueAtTime(0, t0 + DURATION);
}

export class LiveScore {
  private eng = new AudioEngine();
  private out: GainNode & { fade: GainNode };
  private events: ScoreEvent[];
  private next = 0;
  /** Kontextzeit von t = 0 / context time of t = 0 */
  readonly t0: number;

  constructor(private ctx: BaseAudioContext, opts: { music: boolean; effects: boolean }, start = 0) {
    this.out = output(ctx);
    this.eng.attach(ctx, this.out, { rnd: rng(SEED), music: 0.42 });
    this.events = buildScore().filter((e) => (e.bus === 'music' ? opts.music : opts.effects));
    this.t0 = ctx.currentTime + 0.12 - start;
    endFade(this.out.fade, this.t0);
    // Ereignisse vor dem Start ueberspringen / skip events before the start
    while (this.next < this.events.length && this.events[this.next].at < start - 0.02) this.next++;
  }

  /** Ereignisse bis elapsed + Vorlauf planen / schedule events up to elapsed + look-ahead */
  pump(elapsed: number) {
    while (this.next < this.events.length && this.events[this.next].at < elapsed + LOOKAHEAD) {
      const e = this.events[this.next++];
      e.play(this.eng, Math.max(this.ctx.currentTime, this.t0 + e.at));
    }
  }

  /** Sanft ausblenden und trennen / fade out gently and disconnect */
  stop() {
    const now = this.ctx.currentTime, g = this.out.fade.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.25);
    this.next = this.events.length;
    window.setTimeout(() => this.out.fade.disconnect(), 400);
  }
}

/** Ganze Klangspur offline rechnen / render the whole soundtrack offline */
export async function renderSoundtrack(sampleRate = 48000): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(DURATION * sampleRate), sampleRate);
  const out = output(ctx);
  endFade(out.fade, 0);
  const eng = new AudioEngine();
  eng.attach(ctx, out, { rnd: rng(SEED), music: 0.42 });
  for (const e of buildScore()) e.play(eng, e.at);
  return ctx.startRendering();
}

/** AudioBuffer als 16-Bit-WAV / AudioBuffer as 16-bit WAV */
export function wavBytes(buf: AudioBuffer): Uint8Array {
  const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Uint8Array(data.buffer);
}
