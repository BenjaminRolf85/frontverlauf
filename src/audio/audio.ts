/**
 * Klang: fast alles prozedural per WebAudio erzeugt; einzige Aufnahmen sind die Sprachzeilen beim Anklicken
 * von Einheiten (public/audio/voices/<art>/NN.mp3, siehe ASSETS.md).
 * - Musik je Fraktion mit drei Spannungsstufen (ruhig, angespannt, Gefecht) und Stingern (Eroberung, Verlust, Alarm, Sieg)
 * - Waffengeraeusche je Einheitentyp, Einschlaege, Todesschreie, Kampfschreie im Chor
 * - Atmosphaere je Wetter (Regen, Wind, Schnee, Vogel, Brandung) und ferner Gefechtslaerm
 * Sound: almost everything generated procedurally with WebAudio; the only recordings are the voice lines when
 * clicking units (public/audio/voices/<kind>/NN.mp3, see ASSETS.md).
 * - per-faction music with three tension levels (calm, tense, battle) and stingers (capture, loss, alarm, victory)
 * - weapon sounds per unit type, impacts, death screams, battle-cry choirs
 * - ambience per weather (rain, wind, snow, birds, surf) and distant battle noise
 */
import { UNITS, type FactionId, type UnitTypeId } from '../data/balance';
import { unitClass } from '../core/queries';
import { MusicPlayer, type MusicMood } from './music';

export type Sfx = 'select' | 'move' | 'attack' | 'hit' | 'kill' | 'endTurn' | 'capture' | 'levelUp' | 'error' | 'build' | 'research' | 'click';
export type Sting = 'cityWon' | 'cityLost' | 'alarm' | 'victory' | 'defeat' | 'turnStart' | 'levelUp';
export type Intensity = 0 | 1 | 2;
export type Ambience = 'clear' | 'rain' | 'snow' | 'wind';

/** Waffenklang / weapon sound */
export type Weapon =
  | 'rifle' | 'sniper' | 'mg' | 'cannon' | 'artillery' | 'rocket' | 'heliRockets' | 'naval' | 'bigNaval' | 'torpedo'
  | 'laser' | 'plasma' | 'deathRay' | 'flame' | 'railgun' | 'energy' | 'buzz' | 'none';

export const WEAPON: Record<UnitTypeId, Weapon> = {
  infantry: 'rifle', sniper: 'sniper', jeep: 'mg', pioneer: 'rifle', mg: 'mg', medic: 'none', artillery: 'artillery',
  spy: 'none', heli: 'heliRockets', tank: 'cannon', landingBoat: 'rifle', submarine: 'torpedo', destroyer: 'naval', battleship: 'bigNaval',
  grey: 'laser', terraformer: 'none', skimmer: 'laser', mech: 'plasma', tripod: 'deathRay',
  zealot: 'rifle', torchbearer: 'flame', prophet: 'none', doomBuggy: 'mg', rocketCart: 'rocket', doomCrawler: 'cannon',
  android: 'energy', spider: 'buzz', quadDrone: 'laser', railgun: 'railgun', titan: 'plasma',
  // Konter-Einheiten / counter units
  antiTank: 'rocket', antiAir: 'mg', mineLayer: 'rifle', faustZealot: 'rocket', flakDrone: 'mg',
  // Einzigartige Einheiten / unique units
  steppeRider: 'rifle', stormbreaker: 'mg', peacekeeper: 'rifle', privateer: 'naval', protoWalker: 'cannon',
  // Wunder der Siegbedingungen / victory wonders
  portal: 'none', hackRelay: 'none', fusionPlant: 'none', waal: 'cannon', coreDrill: 'none',
  // Endgegner / boss
  swarmMother: 'deathRay',
};

/** Fusstruppen (Fleisch) statt Fahrzeuge (Metall) / foot troops (flesh) instead of vehicles (metal) */
export const FLESH = new Set<UnitTypeId>(['infantry', 'sniper', 'pioneer', 'mg', 'medic', 'spy', 'zealot', 'torchbearer', 'prophet', 'grey', 'terraformer', 'antiTank', 'faustZealot', 'steppeRider', 'stormbreaker', 'peacekeeper']);

interface Theme { tempo: number; root: number; scale: number[]; pattern: number[]; tense: number[]; bass: number[]; wave: OscillatorType }
const THEMES: Record<FactionId, Theme> = {
  korvat: { tempo: 104, root: 196, scale: [0, 2, 3, 5, 7, 8, 10], pattern: [0, 2, 4, 2, 0, 4, 5, 4], tense: [0, 0, 1, 0, 3, 2, 1, 0], bass: [0, 0, 5, 3], wave: 'square' },
  dravon: { tempo: 92, root: 174.6, scale: [0, 1, 3, 5, 7, 8, 10], pattern: [0, 0, 3, 1, 0, 5, 4, 3], tense: [0, 1, 0, 1, 4, 3, 1, 0], bass: [0, 5, 0, 1], wave: 'sawtooth' },
  alvenia: { tempo: 112, root: 220, scale: [0, 2, 4, 5, 7, 9, 11], pattern: [0, 2, 4, 6, 5, 4, 2, 4], tense: [0, 2, 1, 2, 4, 3, 2, 1], bass: [0, 3, 4, 4], wave: 'triangle' },
  meridon: { tempo: 124, root: 246.9, scale: [0, 2, 4, 7, 9], pattern: [0, 1, 2, 4, 3, 2, 1, 3], tense: [0, 0, 2, 1, 3, 1, 0, 1], bass: [0, 2, 3, 1], wave: 'triangle' },
  velkar: { tempo: 98, root: 164.8, scale: [0, 2, 3, 5, 7, 9, 10], pattern: [0, 4, 2, 5, 4, 6, 2, 1], tense: [0, 1, 2, 1, 4, 2, 1, 0], bass: [0, 3, 5, 4], wave: 'sine' },
  zyrr: { tempo: 86, root: 138.6, scale: [0, 1, 4, 6, 7, 10], pattern: [0, 3, 1, 5, 2, 4, 0, 5], tense: [0, 1, 0, 3, 1, 5, 0, 1], bass: [0, 1, 0, 3], wave: 'sine' },
  vesper: { tempo: 76, root: 130.8, scale: [0, 1, 3, 5, 6, 8, 10], pattern: [0, 0, 1, 0, 3, 2, 1, 0], tense: [0, 1, 0, 1, 4, 1, 0, 6], bass: [0, 0, 1, 0], wave: 'sawtooth' },
  nexus: { tempo: 132, root: 207.7, scale: [0, 2, 3, 7, 10], pattern: [0, 2, 4, 2, 1, 3, 0, 4], tense: [0, 0, 3, 0, 1, 0, 4, 3], bass: [0, 0, 3, 2], wave: 'square' },
};

/** Stimme je Fraktion: Grundton, Wellenform, Formant, Art / voice per faction: pitch, wave, formant, kind */
type VoiceKind = 'human' | 'alien' | 'robot' | 'cult';
const VOICES: Record<FactionId, { pitch: number; wave: OscillatorType; formant: number; kind: VoiceKind }> = {
  korvat: { pitch: 150, wave: 'square', formant: 900, kind: 'human' },
  dravon: { pitch: 105, wave: 'sawtooth', formant: 650, kind: 'human' },
  alvenia: { pitch: 210, wave: 'triangle', formant: 1300, kind: 'human' },
  meridon: { pitch: 240, wave: 'square', formant: 1600, kind: 'human' },
  velkar: { pitch: 180, wave: 'sine', formant: 2200, kind: 'human' },
  zyrr: { pitch: 320, wave: 'sine', formant: 2600, kind: 'alien' },
  vesper: { pitch: 120, wave: 'sawtooth', formant: 700, kind: 'cult' },
  nexus: { pitch: 260, wave: 'square', formant: 3000, kind: 'robot' },
};

/**
 * Sprachzeilen beim Anklicken je Stimmart: Anzahl Dateien in public/audio/voices/<art>/01.mp3 ...
 * Voice lines on click per voice kind: number of files in public/audio/voices/<kind>/01.mp3 ...
 */
const VOICE_CLIPS: Record<VoiceKind, number> = { human: 7, robot: 5, alien: 6, cult: 5 };
/** Abspielrate je Menschenfraktion: gleiche Sprecher, leicht andere Stimmlage / playback rate per human faction: same speakers, slightly different pitch */
const VOICE_RATE: Partial<Record<FactionId, number>> = { korvat: 0.95, dravon: 0.9, alvenia: 1.05, meridon: 1.08, velkar: 1 };
const VOICE_BASE = `${import.meta.env.BASE_URL ?? '/'}audio/voices/`;

/** Vokal-Formanten (F1, F2) fuer Schreie / vowel formants (F1, F2) for screams */
const VOWEL = { a: [800, 1200], o: [500, 900], u: [350, 800], e: [550, 1800] } as const;

/** Klangereignis, das eine Zeitleiste (Intro) auf einen festen Zeitpunkt legt / sound event a timeline (intro) puts at a fixed time */
export type ScoreCue =
  | 'explosion' | 'boom' | 'radio' | 'bell' | 'engine' | 'heavyEngine' | 'laser' | 'charge' | 'horn' | 'fanfare' | 'cry' | 'gunshot'
  | 'mg' | 'whistle' | 'riser' | 'drone' | 'crackle' | 'hooves' | 'beep' | 'shield' | 'coins' | 'kick' | 'snare' | 'roll' | 'crash' | 'stab';

/** Audio-Engine; eine Instanz (audio) fuer das Spiel, weitere fuer das Intro / audio engine; one instance (audio) for the game, more for the intro */
export class AudioEngine {
  private ctx: BaseAudioContext | null = null;
  /** Zufallsquelle (das Intro setzt eine mit Saat) / random source (the intro sets a seeded one) */
  private rnd: () => number = Math.random;
  /** Knoten nicht nach Wanduhr trennen (alles im Voraus geplant oder offline) / do not disconnect nodes by wall clock (all pre-scheduled or offline) */
  private keepNodes = false;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  /** Musik aus Dateien; prozedurale Musik nur als Ersatz / music from files; procedural music only as fallback */
  readonly music = new MusicPlayer();
  private musicEnabled = true;
  get musicOn() { return this.musicEnabled; }
  set musicOn(on: boolean) { this.musicEnabled = on; this.music.setEnabled(on); }
  /** Spieler liegt deutlich vorn (ruhige Runden spielen das Siegesnahe-Stueck) / player clearly leads */
  private leading = false;
  effectsOn = true;
  ambienceOn = true;
  private theme: FactionId | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private intensity: Intensity = 0;
  private duckUntil = 0;
  private ambience: Ambience = 'clear';
  private ambNodes: AudioNode[] = [];
  private lastWeapon = 0;
  private lastCry = 0;
  private lastUnitVoice = 0;
  /** geladene Sprachzeilen je Art (null = laedt noch) / loaded voice lines per kind (null = still loading) */
  private clips: Partial<Record<VoiceKind, AudioBuffer[] | null>> = {};
  private lastClip: Partial<Record<VoiceKind, number>> = {};
  private clipSource: AudioBufferSourceNode | null = null;
  private radioCurve: Float32Array | null = null;

  private ensure(): BaseAudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.build(new Ctx(), null);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** Busse, Kompressor und Hall auf einem Kontext aufbauen / build buses, compressor and reverb on a context */
  private build(ctx: BaseAudioContext, dest: AudioNode | null, music = 0.16) {
    this.ctx = ctx;
    // Kompressor gegen Uebersteuern bei vielen gleichzeitigen Klaengen / compressor against clipping with many sounds
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(dest ?? ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(comp);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = music; this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.voiceBus = ctx.createGain(); this.voiceBus.gain.value = 0.8; this.voiceBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.22; this.ambBus.connect(this.master);
    // kuenstlicher Hall / synthetic reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(1.8, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    this.reverb.connect(wet); wet.connect(this.master);
    this.noiseBuf = this.makeNoise(4);
  }

  /**
   * Eigene Instanz an einen fremden Kontext haengen (Intro: live oder OfflineAudioContext). Alles wird im Voraus geplant,
   * deshalb trennt sie keine Knoten nach Wanduhr, und der Zufall kommt aus rnd (mit Saat: gleiche Klangspur bei jedem Lauf).
   * Attach this instance to an external context (intro: live or OfflineAudioContext). Everything is scheduled ahead,
   * so it never disconnects nodes by wall clock, and randomness comes from rnd (seeded: the same soundtrack on every run).
   */
  attach(ctx: BaseAudioContext, dest: AudioNode, opts: { music?: number; rnd?: () => number } = {}) {
    this.keepNodes = true;
    if (opts.rnd) this.rnd = opts.rnd;
    this.build(ctx, dest, opts.music ?? 0.3);
  }

  /** Laufender Spielkontext (nach einer Nutzergeste) / running game context (after a user gesture) */
  context(): BaseAudioContext | null { return this.ensure(); }

  /** Knoten spaeter trennen (nur im Spiel) / disconnect a node later (game only) */
  private release(node: AudioNode, ms: number) {
    if (!this.keepNodes) window.setTimeout(() => node.disconnect(), ms);
  }

  /** Nach einer Nutzergeste aufrufen / call after a user gesture */
  unlock() {
    this.music.unlock();
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') (ctx as AudioContext).resume().catch(() => {});
    this.applyAmbience();
  }

  // ---------- Bausteine / building blocks ----------

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
    return buf;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 99991;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, decay); }
    }
    return buf;
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, slide = 0, attack = 0.01) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest);
    o.start(start); o.stop(start + dur + 0.05);
    return o;
  }

  /** gefiltertes Rauschen mit Huellkurve / filtered noise with envelope */
  private noise(start: number, dur: number, vol: number, freq: number, dest: AudioNode, o: { type?: BiquadFilterType; q?: number; freqEnd?: number; attack?: number; offset?: number } = {}) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'lowpass'; f.frequency.setValueAtTime(freq, start); f.Q.value = o.q ?? 0.7;
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.freqEnd), start + dur);
    const g = ctx.createGain();
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + a);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(start, o.offset ?? (start * 7.3) % 1.2, dur + 0.05);
  }

  private get sfx() { return this.sfxBus!; }
  private wetSend(node: AudioNode, amount: number) {
    const g = this.ctx!.createGain(); g.gain.value = amount; node.connect(g); g.connect(this.reverb!);
  }
  /** Ziel fuer einen Effekt mit Hall / destination for an effect with reverb */
  private fxOut(amount = 0.4): GainNode {
    const g = this.ctx!.createGain(); g.gain.value = 1; g.connect(this.sfx); this.wetSend(g, amount);
    this.release(g, 6000);
    return g;
  }

  private ready(): BaseAudioContext | null {
    if (!this.effectsOn) return null;
    const ctx = this.ensure();
    if (!ctx || !this.master) return null;
    // Sprachzeilen frueh im Hintergrund laden, damit schon der erste Klick sie hat / load voice lines early so the first click has them
    for (const k of Object.keys(VOICE_CLIPS) as VoiceKind[]) if (this.clips[k] === undefined) this.loadClips(k);
    return ctx;
  }

  // ---------- Bedienklaenge / UI sounds ----------

  play(s: Sfx) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01, m = this.sfx;
    switch (s) {
      case 'click': this.tone(660, t, 0.05, 'square', 0.08, m); break;
      case 'select': this.tone(520, t, 0.07, 'triangle', 0.2, m); this.tone(780, t + 0.05, 0.08, 'triangle', 0.18, m); break;
      case 'move': this.noise(t, 0.18, 0.12, 500, m, { type: 'bandpass', q: 1.2, freqEnd: 900 }); this.tone(300, t, 0.12, 'triangle', 0.12, m, 1.6); break;
      case 'attack': this.noise(t, 0.25, 0.5, 1800, m); this.tone(140, t, 0.2, 'square', 0.2, m, 0.4); break;
      case 'hit': this.noise(t, 0.12, 0.35, 900, m); break;
      case 'kill': this.explosion(t, 0.7); break;
      case 'endTurn': [392, 523, 659].forEach((f, i) => this.tone(f, t + i * 0.08, 0.14, 'square', 0.12, m)); break;
      case 'capture': this.fanfare(t, true); break;
      case 'levelUp': [440, 554, 659, 880].forEach((f, i) => this.tone(f, t + i * 0.06, 0.18, 'triangle', 0.2, m)); break;
      case 'build': this.noise(t, 0.08, 0.3, 2500, m); this.noise(t + 0.12, 0.08, 0.3, 2500, m); this.tone(180, t + 0.24, 0.1, 'square', 0.1, m, 0.8); break;
      case 'research': this.tone(880, t, 0.25, 'sine', 0.18, m, 1.5); this.tone(1320, t + 0.12, 0.25, 'sine', 0.12, m, 1.3); break;
      case 'error': this.tone(180, t, 0.18, 'square', 0.15, m, 0.7); break;
    }
  }

  // ---------- Waffen / weapons ----------

  /** Schuss einer Einheit / shot of a unit */
  weapon(type: UnitTypeId) {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastWeapon < 0.05) return;
    this.lastWeapon = now;
    const t = now + 0.01;
    const out = this.fxOut(0.35);
    switch (WEAPON[type]) {
      case 'rifle':
        for (let i = 0; i < 3; i++) this.gunshot(t + i * 0.11, 0.95, 2400, out);
        break;
      case 'sniper':
        this.noise(t, 0.05, 1, 6000, out, { type: 'highpass', q: 0.5 });
        this.gunshot(t, 1, 3000, out);
        this.tone(1800, t, 0.06, 'square', 0.3, out, 0.3);
        this.noise(t + 0.02, 0.6, 0.25, 1200, out, { freqEnd: 300 }); // Echo / echo
        break;
      case 'mg':
        for (let i = 0; i < 9; i++) this.gunshot(t + i * 0.065, 0.75, 2000 + (i % 2) * 500, out);
        break;
      case 'cannon':
        this.boom(t, 0.9, 90, out);
        this.noise(t, 0.08, 0.7, 4000, out, { type: 'highpass' });
        break;
      case 'artillery':
        this.boom(t, 0.7, 70, out);
        // Pfeifen im Anflug / incoming whistle
        this.tone(2200, t + 0.25, 0.6, 'sine', 0.12, out, 0.35, 0.05);
        this.explosion(t + 0.85, 0.8);
        break;
      case 'rocket':
        for (let i = 0; i < 3; i++) {
          this.noise(t + i * 0.12, 0.45, 0.35, 900, out, { type: 'bandpass', q: 1.5, freqEnd: 3500, attack: 0.02 });
        }
        this.explosion(t + 0.6, 0.6);
        break;
      case 'heliRockets':
        this.rotor(t, 0.9, out);
        this.noise(t + 0.1, 0.4, 0.35, 1200, out, { type: 'bandpass', q: 1.4, freqEnd: 4000, attack: 0.02 });
        this.noise(t + 0.25, 0.4, 0.35, 1200, out, { type: 'bandpass', q: 1.4, freqEnd: 4000, attack: 0.02 });
        this.explosion(t + 0.6, 0.45);
        break;
      case 'naval':
        this.boom(t, 0.8, 80, out); this.boom(t + 0.22, 0.6, 85, out);
        this.splash(t + 0.7, 0.5, out);
        break;
      case 'bigNaval':
        this.boom(t, 1, 55, out); this.boom(t + 0.05, 0.8, 75, out); this.boom(t + 0.12, 0.7, 65, out);
        this.explosion(t + 0.9, 1);
        break;
      case 'torpedo':
        this.noise(t, 0.9, 0.25, 400, out, { type: 'bandpass', q: 3, freqEnd: 700, attack: 0.1 });
        this.tone(60, t + 0.9, 0.7, 'sine', 0.6, out, 0.5);
        this.splash(t + 0.95, 0.7, out);
        break;
      case 'laser':
        for (let i = 0; i < 3; i++) this.tone(2400 - i * 200, t + i * 0.12, 0.14, 'sawtooth', 0.16, out, 0.25, 0.003);
        break;
      case 'plasma':
        this.tone(900, t, 0.35, 'sawtooth', 0.25, out, 0.15);
        this.tone(120, t, 0.4, 'square', 0.25, out, 0.5);
        this.noise(t + 0.3, 0.4, 0.5, 1200, out, { freqEnd: 200 });
        break;
      case 'deathRay': {
        // anschwellender Strahl mit Vibrato / swelling beam with vibrato
        const o = this.tone(300, t, 1.1, 'sawtooth', 0.22, out, 3, 0.15);
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = 18; lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency);
        lfo.start(t); lfo.stop(t + 1.2);
        this.tone(75, t, 1.1, 'square', 0.18, out, 1.2, 0.1);
        this.explosion(t + 1.05, 0.5);
        break;
      }
      case 'flame':
        this.noise(t, 0.9, 0.55, 700, out, { type: 'lowpass', freqEnd: 1600, attack: 0.08 });
        this.noise(t, 0.9, 0.2, 3000, out, { type: 'highpass', attack: 0.1 });
        break;
      case 'railgun':
        this.tone(200, t, 0.45, 'sine', 0.2, out, 8, 0.4); // Aufladen / charge
        this.noise(t + 0.45, 0.06, 1, 7000, out, { type: 'highpass' });
        this.tone(3000, t + 0.45, 0.25, 'square', 0.2, out, 0.1);
        this.boom(t + 0.5, 0.5, 110, out);
        break;
      case 'energy':
        for (let i = 0; i < 2; i++) { this.tone(1400, t + i * 0.15, 0.12, 'square', 0.14, out, 0.4); this.noise(t + i * 0.15, 0.08, 0.3, 5000, out, { type: 'highpass' }); }
        break;
      case 'buzz':
        for (let i = 0; i < 6; i++) this.tone(700 + (i % 2) * 300, t + i * 0.06, 0.05, 'square', 0.14, out, 0.7, 0.002);
        break;
      case 'none': break;
    }
  }

  private gunshot(t: number, vol: number, freq: number, out: AudioNode) {
    this.noise(t, 0.07, vol, freq, out, { type: 'bandpass', q: 0.8, freqEnd: freq * 0.4 });
    this.tone(180, t, 0.05, 'square', vol * 0.3, out, 0.4, 0.002);
  }

  private boom(t: number, vol: number, freq: number, out: AudioNode) {
    this.tone(freq, t, 0.6, 'sine', vol, out, 0.35, 0.004);
    this.noise(t, 0.5, vol * 0.7, 800, out, { freqEnd: 120 });
  }

  private explosion(t: number, vol: number) {
    const out = this.fxOut(0.5);
    this.tone(70, t, 0.9, 'sine', vol, out, 0.3, 0.004);
    this.noise(t, 1.1, vol * 0.9, 1800, out, { freqEnd: 80 });
    this.noise(t + 0.05, 0.25, vol * 0.4, 4000, out, { type: 'highpass' });
    // Truemmer / debris
    for (let i = 0; i < 4; i++) this.noise(t + 0.25 + i * 0.09, 0.05, vol * 0.18, 3000, out, { type: 'bandpass', q: 4 });
  }

  /** Vulkanausbruch: tiefes Grollen, Explosion, prasselnde Brocken / eruption: deep rumble, blast, raining debris */
  eruption() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    const out = this.fxOut(0.6);
    this.noise(t, 2.6, 0.7, 140, out, { freqEnd: 50, attack: 0.4 });
    this.tone(38, t, 2.4, 'sine', 0.6, out, 0.7, 0.3);
    this.explosion(t + 0.5, 1);
    for (let i = 0; i < 10; i++) this.noise(t + 0.9 + i * 0.12, 0.08, 0.2, 1800, out, { type: 'bandpass', q: 3 });
  }

  private splash(t: number, vol: number, out: AudioNode) {
    this.noise(t, 0.7, vol, 2500, out, { type: 'bandpass', q: 0.6, freqEnd: 400, attack: 0.02 });
  }

  private rotor(t: number, dur: number, out: AudioNode) {
    for (let i = 0; i < Math.floor(dur / 0.07); i++) this.noise(t + i * 0.07, 0.05, 0.18, 300, out, { type: 'lowpass' });
  }

  /** Einschlag beim Ziel / impact at the target */
  impact(target: UnitTypeId, killed: boolean, faction?: FactionId) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    const out = this.fxOut(0.3);
    const flesh = FLESH.has(target);
    if (killed) {
      if (flesh) { this.noise(t, 0.2, 0.5, 600, out); if (faction) this.deathCry(faction, t + 0.03); }
      else this.explosion(t, 0.9);
      return;
    }
    if (flesh) {
      this.noise(t, 0.12, 0.45, 500, out);
      if (faction && this.rnd() < 0.5) this.pain(faction, t + 0.05);
    } else {
      // metallischer Treffer / metallic hit
      this.tone(420, t, 0.3, 'square', 0.18, out, 0.6, 0.002);
      this.tone(1270, t, 0.25, 'triangle', 0.15, out, 0.8, 0.002);
      this.noise(t, 0.15, 0.4, 3500, out, { type: 'bandpass', q: 2 });
    }
  }

  // ---------- Stimmen / voices ----------

  /** Formant-Stimme: Saegezahn durch zwei Bandpaesse / formant voice: sawtooth through two bandpasses */
  private voice(f: FactionId, t: number, dur: number, pitch: number, slide: number, vowel: keyof typeof VOWEL, vol: number, dest: AudioNode, vibrato = 6) {
    const ctx = this.ctx!;
    const v = VOICES[f];
    const o = ctx.createOscillator();
    o.type = v.kind === 'robot' ? 'square' : 'sawtooth';
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.linearRampToValueAtTime(pitch * slide, t + dur);
    const lfo = ctx.createOscillator(); const lg = ctx.createGain();
    lfo.frequency.value = v.kind === 'alien' ? 14 : v.kind === 'robot' ? 40 : vibrato;
    lg.gain.value = v.kind === 'alien' ? pitch * 0.12 : v.kind === 'robot' ? pitch * 0.25 : pitch * 0.03;
    lfo.connect(lg); lg.connect(o.frequency);
    const [f1, f2] = VOWEL[vowel];
    const shift = v.kind === 'alien' ? 1.6 : v.kind === 'robot' ? 1.3 : v.kind === 'cult' ? 0.85 : 1;
    const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = f1 * shift; b1.Q.value = 6;
    const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = f2 * shift; b2.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
  }

  private voiceOut(): GainNode {
    const g = this.ctx!.createGain(); g.gain.value = 1; g.connect(this.voiceBus!); this.wetSend(g, 0.35);
    this.release(g, 6000);
    return g;
  }

  /** Kampfschrei im Chor: Hurraaa / battle-cry choir: hurraaa */
  battleCry(f: FactionId, big = false) {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (!big && now - this.lastCry < 2.5) return;
    this.lastCry = now;
    this.cry(f, now + 0.05, big, this.voiceOut());
  }

  private cry(f: FactionId, t: number, big: boolean, out: AudioNode) {
    const v = VOICES[f];
    const n = big ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const p = v.pitch * (0.85 + this.rnd() * 0.35);
      const d = t + this.rnd() * 0.12;
      // "Hu-" kurz, dann langes "-raaa" mit steigender Tonhoehe / short "hu-", then long rising "-raaa"
      this.voice(f, d, 0.16, p, 1.05, 'u', 0.24, out);
      this.voice(f, d + 0.16, big ? 1.1 : 0.75, p * 1.12, big ? 1.35 : 1.2, 'a', 0.32, out);
    }
    // Trampeln und Klappern / stomping and rattling
    for (let i = 0; i < (big ? 8 : 4); i++) this.noise(t + i * 0.09, 0.06, 0.12, 400, out);
  }

  /** Todesschrei / death scream */
  deathCry(f: FactionId, t?: number) {
    const ctx = this.ready();
    if (!ctx) return;
    const at = t ?? ctx.currentTime + 0.02;
    const v = VOICES[f];
    const out = this.voiceOut();
    if (v.kind === 'robot') {
      // Abschaltgeraeusch / shutdown sound
      this.tone(v.pitch * 2, at, 0.6, 'square', 0.18, out, 0.1);
      this.noise(at + 0.1, 0.3, 0.25, 4000, out, { type: 'bandpass', q: 6 });
      return;
    }
    this.voice(f, at, 0.7, v.pitch * 1.9, 0.45, 'a', 0.26, out, 9);
  }

  private pain(f: FactionId, t: number) {
    const v = VOICES[f];
    this.voice(f, t, 0.28, v.pitch * 1.5, 0.7, 'o', 0.18, this.voiceOut(), 10);
  }

  /**
   * Comic-Laut zur Sprechblase: gebrabbelte Silben mit Fraktionsstimme, bei Fluechen ein Zeichensalat-Geraeusch.
   * Comic sound for a speech bubble: babbled syllables in the faction voice, a grawlix noise for curses.
   */
  bark(faction: FactionId, text: string) {
    const ctx = this.ready();
    if (!ctx) return;
    // laeuft gerade ein Funkspruch, nicht doppelt brabbeln / a radio call is playing: do not babble twice
    if (ctx.currentTime - this.lastUnitVoice < 1.2) return;
    const v = VOICES[faction];
    let t = ctx.currentTime + 0.02;
    const words = Math.max(2, Math.min(7, text.split(/\s+/).length));
    let seed = text.length * 31 + text.charCodeAt(0);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const g = ctx.createGain();
    g.gain.value = 0.55;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = v.formant; f.Q.value = 1.4;
    g.connect(f); f.connect(this.voiceBus!);
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
      this.noise(t + 0.02, 0.12, 0.25, 3000, this.voiceBus!);
      [1.8, 1.2, 2.1, 0.9].forEach((m, i) => this.tone(v.pitch * m, t + 0.03 + i * 0.05, 0.05, 'square', 0.15, this.voiceBus!, 0.6));
    }
  }

  // ---------- Auswahl-Geraeusche / selection sounds ----------

  /**
   * Geraeusch beim Anklicken einer eigenen Einheit: Funkspruch fuer Fusstruppen, Motor fuer Fahrzeuge,
   * Rotor fuer Hubschrauber, Horn oder Sonar fuer Schiffe, Servos fuer Roboter, Summen fuer Ausserirdische.
   * Sound when clicking an own unit: radio call for foot troops, engine for vehicles, rotor for helicopters,
   * horn or sonar for ships, servos for robots, humming for aliens.
   */
  unitVoice(type: UnitTypeId, f: FactionId) {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastUnitVoice < 0.45) return;
    this.lastUnitVoice = now;
    const t = now + 0.03;
    const out = ctx.createGain(); out.gain.value = 0.9; out.connect(this.sfxBus!); this.wetSend(out, 0.2);
    this.release(out, 4000);
    const u = UNITS[type];
    const kind = VOICES[f].kind;
    const walker = u.abilities.includes('walker');
    if (u.ship) {
      if (type === 'submarine') this.sonar(t, out);
      else this.horn(t, type === 'battleship' ? 62 : type === 'landingBoat' ? 110 : 82, out);
      if (kind === 'human') this.voiceLine(f, t + 0.6, 2);
      return;
    }
    if (u.abilities.includes('fly')) {
      if (kind === 'alien') { this.hover(t, out); this.voiceLine(f, t + 0.35, 0); }
      else if (kind === 'robot') { this.buzz(t, out); this.voiceLine(f, t + 0.35, 0); }
      else { this.rotor(t, 0.9, out); this.tone(900, t, 0.9, 'sawtooth', 0.04, out, 1.3, 0.2); this.voiceLine(f, t + 0.5, 2); }
      return;
    }
    if (walker) { this.servo(t, out, kind === 'robot' ? 1.4 : 1); if (kind === 'alien') this.hover(t + 0.25, out); this.voiceLine(f, t + 0.45, 0); return; }
    // Fahrzeuge und Wunder-Bauwerke: Maschinenklang / vehicles and wonder structures: machine sound
    if (unitClass(type) === 'vehicle' || unitClass(type) === 'structure') {
      const heavy = u.hp >= 20;
      this.engine(t, heavy ? 38 : 62, heavy ? 1.1 : 0.8, heavy, out);
      if (kind === 'robot') this.chirps(t + 0.5, out, 3);
      this.voiceLine(f, t + 0.55, 2);
      return;
    }
    // Fusstruppen / foot troops
    if (kind === 'robot') { this.servo(t, out, 1.6); this.chirps(t + 0.2, out, 4); this.voiceLine(f, t + 0.3, 0); return; }
    if (kind === 'alien') { this.hover(t, out); this.chirps(t + 0.1, out, 3, 0.6); this.voiceLine(f, t + 0.25, 0); return; }
    if (kind === 'cult') { this.bell(t, out); this.voiceLine(f, t + 0.25, 3); return; }
    this.voiceLine(f, t, 3 + Math.floor(this.rnd() * 2));
  }

  /**
   * Sprachzeile der Fraktion: zufaellige Aufnahme ihrer Stimmart (nie zweimal dieselbe hintereinander); Menschen und
   * Kult klingen wie ueber Funk. Solange die Aufnahmen laden, ersetzt der gebrabbelte Funkspruch sie (words > 0).
   * Faction voice line: a random recording of its voice kind (never the same twice in a row); humans and the cult
   * sound like over the radio. While recordings load, the babbled radio call stands in (words > 0).
   */
  private voiceLine(f: FactionId, t: number, words: number) {
    const ctx = this.ctx!;
    const kind = VOICES[f].kind;
    const list = this.clips[kind];
    if (!list) {
      if (list === undefined) this.loadClips(kind);
      if (words > 0) this.radio(f, t, words);
      return;
    }
    if (!list.length) { if (words > 0) this.radio(f, t, words); return; }
    let i = Math.floor(this.rnd() * list.length);
    if (list.length > 1 && i === this.lastClip[kind]) i = (i + 1) % list.length;
    this.lastClip[kind] = i;
    // vorherige Zeile abbrechen, damit nichts uebereinander spricht / stop the previous line so nothing talks over it
    try { this.clipSource?.stop(); } catch { /* schon beendet / already ended */ }
    const src = ctx.createBufferSource();
    src.buffer = list[i];
    src.playbackRate.value = VOICE_RATE[f] ?? 1;
    const g = ctx.createGain(); g.gain.value = 1.1;
    src.connect(g);
    if (kind === 'human' || kind === 'cult') {
      // Funkfilter und Sprechtaste / radio filter and push-to-talk click
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = kind === 'human' ? 320 : 220;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'human' ? 3600 : 4800;
      g.connect(hp); hp.connect(lp); lp.connect(this.voiceBus!);
      this.noise(t, 0.035, 0.3, 2500, this.voiceBus!, { type: 'highpass' });
      const end = t + 0.05 + list[i].duration / src.playbackRate.value;
      if (kind === 'human') { this.tone(1250, end + 0.02, 0.06, 'sine', 0.1, this.voiceBus!); this.noise(end + 0.08, 0.1, 0.15, 2000, this.voiceBus!, { type: 'bandpass', q: 0.6 }); }
      src.start(t + 0.05);
    } else {
      g.connect(this.voiceBus!); this.wetSend(g, kind === 'alien' ? 0.45 : 0.2);
      src.start(t);
    }
    this.clipSource = src;
    src.onended = () => { g.disconnect(); if (this.clipSource === src) this.clipSource = null; };
  }

  /** Aufnahmen einer Stimmart laden (einmal, im Hintergrund) / load the recordings of one voice kind (once, in the background) */
  private loadClips(kind: VoiceKind) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.clips[kind] = null;
    const urls = Array.from({ length: VOICE_CLIPS[kind] }, (_, i) => `${VOICE_BASE}${kind}/${String(i + 1).padStart(2, '0')}.mp3`);
    Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(u)))).then((b) => ctx.decodeAudioData(b)).catch(() => null)))
      .then((bufs) => { this.clips[kind] = bufs.filter((b): b is AudioBuffer => !!b); });
  }

  /** Funkspruch: Rauschen, gebrabbelte Silben durch ein Funkfilter, Quittungston / radio call: static, babbled syllables through a radio filter, roger beep */
  private radio(f: FactionId, t: number, words: number) {
    const ctx = this.ctx!;
    if (!this.radioCurve) {
      const c = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3); }
      this.radioCurve = c;
    }
    const v = VOICES[f];
    const g = ctx.createGain(); g.gain.value = 0.5;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const ws = ctx.createWaveShaper(); ws.curve = this.radioCurve as Float32Array<ArrayBuffer>;
    g.connect(hp); hp.connect(ws); ws.connect(lp); lp.connect(this.voiceBus!);
    this.release(lp, 5000);
    // Sprechtaste / push-to-talk click
    this.noise(t, 0.035, 0.35, 2500, g, { type: 'highpass' });
    let at = t + 0.06;
    const start = at;
    for (let i = 0; i < words; i++) {
      const syl = 1 + Math.floor(this.rnd() * 2);
      for (let k = 0; k < syl; k++) {
        const dur = 0.05 + this.rnd() * 0.07;
        this.tone(v.pitch * (0.9 + this.rnd() * 0.35), at, dur, v.wave, 0.32, g, 0.8 + this.rnd() * 0.5);
        at += dur + 0.015;
      }
      at += 0.05;
    }
    // Rauschen unter der Stimme / static under the voice
    this.noise(start, at - start, 0.05, 1800, g, { type: 'bandpass', q: 0.8 });
    // Quittungston und Rauschschwanz / roger beep and static tail
    this.tone(1250, at + 0.02, 0.06, 'sine', 0.12, g);
    this.noise(at + 0.08, 0.12, 0.2, 2000, g, { type: 'bandpass', q: 0.6 });
  }

  /** Motor anlassen und hochdrehen / start and rev an engine */
  private engine(t: number, base: number, dur: number, heavy: boolean, out: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 0.7, t);
    o.frequency.linearRampToValueAtTime(base * 1.9, t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(base * 1.2, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = heavy ? 380 : 650; lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(heavy ? 0.5 : 0.38, t + 0.08);
    g.gain.setValueAtTime(heavy ? 0.5 : 0.38, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
    // Anlasser und Brummen / starter and rumble
    this.noise(t, 0.12, 0.18, 1400, out, { type: 'bandpass', q: 3 });
    this.noise(t, dur, heavy ? 0.3 : 0.18, 180, out, { type: 'lowpass' });
    // Kettengerassel / track clatter
    if (heavy) for (let i = 0; i < Math.floor(dur / 0.07); i++) this.noise(t + 0.2 + i * 0.07, 0.025, 0.12, 3200, out, { type: 'highpass' });
  }

  /** Schiffshorn / ship horn */
  private horn(t: number, freq: number, out: AudioNode) {
    this.tone(freq, t, 1.0, 'sawtooth', 0.22, out, 1, 0.08);
    this.tone(freq * 1.5, t, 1.0, 'sawtooth', 0.12, out, 1, 0.08);
    this.noise(t, 1.0, 0.05, 300, out, { type: 'lowpass' });
  }

  /** Sonar-Ping / sonar ping */
  private sonar(t: number, out: AudioNode) {
    this.tone(1180, t, 0.7, 'sine', 0.25, out, 0.98, 0.005);
    this.tone(1180, t + 0.45, 0.6, 'sine', 0.08, out, 0.98, 0.005);
    this.wetSend(out, 0.6);
  }

  /** Servo-Surren und Hydraulik / servo whir and hydraulics */
  private servo(t: number, out: AudioNode, pitch: number) {
    this.tone(320 * pitch, t, 0.22, 'square', 0.08, out, 1.6);
    this.tone(480 * pitch, t + 0.24, 0.18, 'square', 0.07, out, 0.7);
    this.noise(t + 0.4, 0.18, 0.18, 5000, out, { type: 'highpass' });
    this.tone(70, t + 0.42, 0.2, 'sine', 0.3, out, 0.5, 0.005);
  }

  /** Datenzirpen / data chirps */
  private chirps(t: number, out: AudioNode, n: number, vol = 1) {
    for (let i = 0; i < n; i++) this.tone(1400 + this.rnd() * 1600, t + i * 0.07, 0.04, 'square', 0.07 * vol, out);
  }

  /** Schwebendes Summen (Ausserirdische) / hovering hum (aliens) */
  private hover(t: number, out: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(620, t + 0.6);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lg = ctx.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.8); lfo.start(t); lfo.stop(t + 0.8);
  }

  /** Drohnen-Brummen / drone buzz */
  private buzz(t: number, out: AudioNode) {
    for (let i = 0; i < 10; i++) this.tone(180 + (i % 2) * 12, t + i * 0.06, 0.06, 'sawtooth', 0.08, out);
    this.chirps(t + 0.65, out, 2);
  }

  /** Kleine Glocke (Kult) / small bell (cult) */
  private bell(t: number, out: AudioNode) {
    [1, 2.76, 5.4].forEach((m, i) => this.tone(420 * m, t, 1.1 - i * 0.3, 'sine', 0.16 / (i + 1), out, 1, 0.003));
  }

  // ---------- Stinger / stingers ----------

  private fanfare(t: number, major: boolean) {
    const out = this.fxOut(0.45);
    const root = 262;
    const notes = major ? [0, 4, 7, 12, 7, 12] : [12, 10, 7, 6, 3, 0];
    const times = [0, 0.12, 0.24, 0.36, 0.6, 0.72];
    notes.forEach((n, i) => {
      const f = root * Math.pow(2, n / 12);
      const d = i === notes.length - 1 ? 0.9 : 0.2;
      this.tone(f, t + times[i], d, 'sawtooth', 0.12, out, 1, 0.02);
      this.tone(f * 2, t + times[i], d, 'square', 0.05, out, 1, 0.02);
    });
    // Pauke / timpani
    this.tone(major ? 98 : 73, t + 0.72, 1, 'sine', 0.45, out, 0.8);
  }

  sting(kind: Sting, f?: FactionId) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.03;
    this.duckUntil = ctx.currentTime + 2.2;
    this.duck();
    const out = this.fxOut(0.45);
    // Stinger aus Dateien, falls vorhanden / stingers from files when available
    if (this.music.available && this.musicEnabled && (kind === 'cityWon' || kind === 'cityLost')) {
      this.music.sting(kind);
      if (kind === 'cityWon' && f) this.battleCry(f, true);
      return;
    }
    switch (kind) {
      case 'cityWon':
        this.fanfare(t, true);
        if (f) this.battleCry(f, true);
        break;
      case 'cityLost':
        this.fanfare(t, false);
        this.alarm(t + 0.1, 2);
        break;
      case 'alarm': this.alarm(t, 3); break;
      case 'victory': {
        this.fanfare(t, true); this.fanfare(t + 1.1, true);
        if (f) this.battleCry(f, true);
        break;
      }
      case 'defeat': {
        [0, -2, -5, -7, -12].forEach((n, i) => this.tone(196 * Math.pow(2, n / 12), t + i * 0.4, 0.6, 'triangle', 0.18, out, 0.98, 0.05));
        this.tone(49, t + 1.6, 2, 'sine', 0.4, out, 0.9);
        break;
      }
      case 'turnStart':
        // Trommelwirbel / snare roll
        for (let i = 0; i < 10; i++) this.noise(t + i * 0.035, 0.05, 0.06 + i * 0.012, 2500, out, { type: 'bandpass', q: 0.9 });
        this.noise(t + 0.38, 0.25, 0.25, 2000, out, { type: 'bandpass', q: 0.7 });
        this.tone(110, t + 0.38, 0.35, 'sine', 0.35, out, 0.6);
        break;
      case 'levelUp': this.play('levelUp'); break;
    }
  }

  private alarm(t: number, cycles: number) {
    const out = this.fxOut(0.3);
    for (let i = 0; i < cycles; i++) {
      this.tone(660, t + i * 0.5, 0.25, 'square', 0.07, out, 1, 0.02);
      this.tone(880, t + i * 0.5 + 0.25, 0.25, 'square', 0.07, out, 1, 0.02);
    }
  }

  private duck() {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(0.05, ctx.currentTime, 0.05);
    g.setTargetAtTime(this.musicLevel(), ctx.currentTime + 2, 0.4);
  }

  private musicLevel() { return 0.14 + this.intensity * 0.025; }


  // ---------- Zeitleiste (Intro) / timeline (intro) ----------

  /**
   * Ein Achtel der prozeduralen Fraktionsmusik zum Zeitpunkt when (Takt beat in Sekunden je Achtel).
   * One eighth note of the procedural faction music at time when (beat = seconds per eighth).
   */
  scoreMusic(f: FactionId, lvl: Intensity, step: number, when: number, beat: number) {
    if (!this.ctx || !this.musicBus) return;
    this.musicStep(THEMES[f], lvl, step, when, beat, this.musicBus);
  }

  /** Langer Grundton unter der Musik / long pad note under the music */
  scorePad(freq: number, when: number, dur: number, vol = 0.12) {
    if (!this.ctx || !this.musicBus) return;
    this.tone(freq, when, dur, 'sawtooth', vol, this.musicBus, 1, Math.min(0.6, dur / 3));
    this.tone(freq * 1.5, when, dur, 'triangle', vol * 0.7, this.musicBus, 1, Math.min(0.6, dur / 3));
  }

  /** Effekt zum Zeitpunkt when / effect at time when */
  scoreCue(kind: ScoreCue, when: number, f: FactionId = 'korvat', vol = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const t = when;
    const out = ctx.createGain(); out.gain.value = vol; out.connect(this.sfxBus); this.wetSend(out, 0.35);
    this.release(out, 6000);
    switch (kind) {
      case 'explosion': this.explosionTo(t, 1, out); break;
      case 'boom': this.boom(t, 0.9, 60, out); break;
      case 'radio': this.radio(f, t, 4); break;
      case 'bell': this.bigBell(t, out); break;
      case 'engine': this.engine(t, 62, 1.2, false, out); break;
      case 'heavyEngine': this.engine(t, 38, 1.6, true, out); break;
      case 'laser': this.laserZap(t, out); break;
      case 'charge': this.charge(t, out); break;
      case 'horn': this.horn(t, 82, out); break;
      case 'fanfare': this.fanfareTo(t, true, out); break;
      case 'cry': this.cry(f, t, true, out); break;
      case 'gunshot': this.gunshot(t, 0.5, 1400, out); break;
      case 'mg': for (let i = 0; i < 7; i++) this.gunshot(t + i * 0.075, 0.32, 1700, out); break;
      case 'whistle': this.tone(1800, t, 1.1, 'sine', 0.09, out, 0.35, 0.2); this.noise(t, 1.1, 0.06, 2500, out, { type: 'bandpass', q: 3, freqEnd: 700, attack: 0.3 }); break;
      case 'riser': this.noise(t, 2, 0.35, 300, out, { type: 'bandpass', q: 1.4, freqEnd: 5000, attack: 1.8 }); this.tone(90, t, 2, 'sawtooth', 0.12, out, 4, 1.8); break;
      case 'drone': this.tone(55, t, 6, 'sawtooth', 0.12, out, 1.02, 1.5); this.noise(t, 6, 0.12, 220, out, { attack: 2 }); break;
      case 'crackle': for (let i = 0; i < 16; i++) this.noise(t + i * 0.11 + this.rnd() * 0.05, 0.03, 0.14, 2500 + this.rnd() * 2500, out, { type: 'bandpass', q: 4 }); this.noise(t, 2, 0.18, 500, out, { attack: 0.3 }); break;
      case 'hooves': for (let i = 0; i < 12; i++) { const at = t + i * 0.16 + (i % 3) * 0.035; this.tone(95, at, 0.09, 'sine', 0.3, out, 0.5, 0.002); this.noise(at, 0.05, 0.14, 700, out); } break;
      case 'beep': this.tone(1320, t, 0.08, 'square', 0.08, out); this.tone(1320, t + 0.16, 0.08, 'square', 0.08, out); break;
      case 'shield': this.tone(220, t, 1.2, 'triangle', 0.18, out, 2, 0.05); this.tone(660, t, 0.9, 'sine', 0.1, out, 1.5, 0.05); this.noise(t, 0.6, 0.12, 3000, out, { type: 'bandpass', q: 5, freqEnd: 6000 }); break;
      case 'coins': for (let i = 0; i < 9; i++) { const at = t + i * 0.07; this.tone(2400 + (i % 3) * 420, at, 0.18, 'triangle', 0.07, out, 1, 0.002); this.tone(3900 + (i % 2) * 300, at, 0.1, 'sine', 0.04, out, 1, 0.002); } break;
      case 'kick': this.kick(t, out, 0.8); this.tone(55, t, 0.5, 'sine', 0.5, out, 0.5, 0.004); break;
      case 'snare': this.snare(t, out, 0.45); break;
      case 'roll': for (let i = 0; i < 16; i++) this.noise(t + i * 0.0625, 0.06, 0.05 + i * 0.016, 2500, out, { type: 'bandpass', q: 0.9 }); break;
      case 'crash': this.noise(t, 1.6, 0.3, 6000, out, { type: 'highpass', attack: 0.002 }); this.noise(t, 0.4, 0.2, 3000, out, { type: 'bandpass', q: 0.6 }); break;
      case 'stab': { const th = THEMES[f]; for (const n of [0, 7, 12, 16]) this.tone(th.root * Math.pow(2, n / 12), t, 0.5, 'sawtooth', 0.09, out, 1, 0.01); this.kick(t, out, 0.7); break; }
    }
  }

  /** Grosse Glocke (Sternfall) / big bell (Starfall) */
  private bigBell(t: number, out: AudioNode) {
    [1, 2.01, 2.76, 4.07, 5.4].forEach((m, i) => this.tone(196 * m, t, 4.2 - i * 0.7, 'sine', 0.3 / (i + 1), out, 1, 0.004));
    this.tone(98, t, 3.5, 'sine', 0.25, out, 1, 0.01);
    this.noise(t, 0.05, 0.2, 4000, out, { type: 'bandpass', q: 2 });
    this.wetSend(out, 0.8);
  }

  /** Laserschuss: abfallender Pfeifton mit Knistern / laser zap: falling whistle with crackle */
  private laserZap(t: number, out: AudioNode) {
    this.tone(2600, t, 0.55, 'sawtooth', 0.16, out, 0.12, 0.003);
    this.tone(1300, t, 0.7, 'square', 0.1, out, 0.2, 0.003);
    this.noise(t, 1.2, 0.35, 5000, out, { type: 'bandpass', q: 1.5, freqEnd: 400 });
    this.tone(48, t + 0.05, 1.4, 'sine', 0.6, out, 0.6, 0.01);
  }

  /** Aufladen: steigender Ton / charge-up: rising tone */
  private charge(t: number, out: AudioNode) {
    this.tone(180, t, 1, 'sawtooth', 0.06, out, 6, 0.6);
    this.tone(360, t, 1, 'sine', 0.08, out, 6, 0.6);
  }

  private explosionTo(t: number, vol: number, out: AudioNode) {
    this.tone(70, t, 0.9, 'sine', vol, out, 0.3, 0.004);
    this.tone(42, t, 2.2, 'sine', vol * 0.8, out, 0.6, 0.01);
    this.noise(t, 1.6, vol * 0.9, 1800, out, { freqEnd: 60 });
    this.noise(t + 0.05, 0.25, vol * 0.4, 4000, out, { type: 'highpass' });
    for (let i = 0; i < 6; i++) this.noise(t + 0.25 + i * 0.09, 0.05, vol * 0.18, 3000, out, { type: 'bandpass', q: 4 });
  }

  private fanfareTo(t: number, major: boolean, out: AudioNode) {
    const notes = major ? [0, 4, 7, 12, 7, 12] : [12, 10, 7, 6, 3, 0];
    const times = [0, 0.125, 0.25, 0.375, 0.75, 1];
    notes.forEach((n, i) => {
      const fr = 262 * Math.pow(2, n / 12);
      const d = i === notes.length - 1 ? 1.6 : 0.2;
      this.tone(fr, t + times[i], d, 'sawtooth', 0.12, out, 1, 0.02);
      this.tone(fr * 2, t + times[i], d, 'square', 0.05, out, 1, 0.02);
    });
    this.tone(major ? 98 : 73, t + 1, 1.4, 'sine', 0.45, out, 0.8);
  }

  // ---------- Musik / music ----------

  /** Fraktionsthema abspielen / play faction theme */
  setTheme(f: FactionId | null) {
    this.theme = f;
    this.step = 0;
    this.music.set(this.moodFor(), f);
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 110);
  }

  /** Spannungsstufe: 0 ruhig, 1 angespannt, 2 Gefecht / tension level: 0 calm, 1 tense, 2 battle */
  setIntensity(level: Intensity) {
    if (level === this.intensity) return;
    const rising = level > this.intensity;
    this.intensity = level;
    this.music.set(this.moodFor());
    const ctx = this.ctx;
    if (ctx && this.musicBus && ctx.currentTime > this.duckUntil) this.musicBus.gain.setTargetAtTime(this.musicLevel(), ctx.currentTime, 0.5);
    if (rising && level === 2) this.sting('alarm');
    this.applyAmbience();
  }

  private moodFor(): MusicMood {
    return this.intensity === 2 ? 'battle' : this.intensity === 1 ? 'tense' : this.leading ? 'leading' : 'calm';
  }

  /** Spieler liegt kurz vor dem Sieg / player is close to victory */
  setLeading(on: boolean) {
    if (on === this.leading) return;
    this.leading = on;
    this.music.set(this.moodFor());
  }

  /** Hauptmenue- und Briefing-Musik / main menu and briefing music */
  menuMusic() { this.theme = null; this.music.set('menu', null); }
  briefingMusic() { this.music.set('briefing', null); }

  private schedule() {
    // Dateimusik hat Vorrang; prozedural nur als Ersatz / file music first; procedural only as fallback
    if (this.music.available) return;
    if (!this.musicOn || !this.theme) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicBus) return;
    const th = THEMES[this.theme];
    const lvl = this.intensity;
    const tempo = th.tempo * (1 + lvl * 0.12);
    const beat = 60 / tempo / 2;
    const m = this.musicBus;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.4) {
      this.musicStep(th, lvl, this.step, this.nextTime, beat, m);
      this.nextTime += beat;
      this.step++;
    }
  }

  /** Ein Achtel der Fraktionsmusik / one eighth note of the faction music */
  private musicStep(th: Theme, lvl: Intensity, step: number, t: number, beat: number, m: AudioNode) {
    const pat = lvl >= 1 ? th.tense : th.pattern;
    const i = step % pat.length;
    const bar = Math.floor(step / 16);
    const deg = pat[i] + (lvl === 2 && bar % 2 === 1 ? 1 : 0);
    const semis = th.scale[deg % th.scale.length] + 12 * Math.floor(deg / th.scale.length);
    const freq = th.root * Math.pow(2, semis / 12);
    // Melodie / melody
    if (step % 16 < 14 || lvl > 0) this.tone(freq, t, beat * 0.9, th.wave, lvl === 2 ? 0.17 : 0.22, m);
    // Bass: ruhig lange Noten, angespannt Ostinato / bass: calm long notes, tense ostinato
    const b = th.bass[Math.floor(step / 8) % th.bass.length];
    const bf = th.root / 2 * Math.pow(2, th.scale[b % th.scale.length] / 12);
    if (lvl === 0 && i % 2 === 0) this.tone(bf, t, beat * 1.8, 'triangle', 0.3, m);
    if (lvl >= 1) this.tone(bf, t, beat * 0.8, lvl === 2 ? 'sawtooth' : 'triangle', 0.22, m);
    // Schlagzeug / drums
    if (lvl >= 1) {
      if (i % 4 === 0) this.kick(t, m);
      if (i % 4 === 2) this.snare(t, m, lvl === 2 ? 0.35 : 0.2);
      if (lvl === 2) this.hat(t, m);
      else if (i % 2 === 1) this.hat(t, m);
      if (lvl === 2 && i === 7 && bar % 2 === 1) { this.snare(t + beat / 2, m, 0.25); this.snare(t + beat * 0.75, m, 0.3); }
    } else if (i === 0 && bar % 2 === 0) this.kick(t, m, 0.25);
    // Blaeser-Stoesse im Gefecht / brass stabs in battle
    if (lvl === 2 && i === 0) {
      for (const n of [0, 7, 12]) this.tone(th.root * Math.pow(2, n / 12), t, beat * 1.5, 'sawtooth', 0.08, m, 1, 0.01);
    }
  }

  private kick(t: number, dest: AudioNode, vol = 0.55) { this.tone(110, t, 0.25, 'sine', vol, dest, 0.35, 0.003); }
  private snare(t: number, dest: AudioNode, vol: number) {
    this.noise(t, 0.14, vol, 2600, dest, { type: 'bandpass', q: 0.8 });
    this.tone(190, t, 0.08, 'triangle', vol * 0.5, dest, 0.7, 0.002);
  }
  private hat(t: number, dest: AudioNode) { this.noise(t, 0.035, 0.08, 8000, dest, { type: 'highpass' }); }

  /** Siegesmusik oder Niederlage am Spielende / victory or defeat music at game end */
  gameOver(win: boolean, f?: FactionId) {
    this.setIntensity(0);
    this.sting(win ? 'victory' : 'defeat', f);
    this.music.set(win ? 'victory' : 'defeat');
  }

  // ---------- Atmosphaere / ambience ----------

  setAmbienceOn(on: boolean) { this.ambienceOn = on; this.applyAmbience(); }

  setAmbience(w: Ambience) {
    if (w === this.ambience && this.ambNodes.length) return;
    this.ambience = w;
    this.applyAmbience();
  }

  private stopAmbience() {
    for (const n of this.ambNodes) {
      try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* bereits gestoppt / already stopped */ }
      try { n.disconnect(); } catch { /* egal / ignore */ }
    }
    this.ambNodes = [];
  }

  private applyAmbience() {
    const ctx = this.ctx;
    if (!ctx || !this.ambBus) return;
    this.stopAmbience();
    if (!this.effectsOn || !this.ambienceOn || !this.theme) return;
    const loop = (freq: number, type: BiquadFilterType, q: number, vol: number, lfoRate = 0, lfoDepth = 0) => {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.ambBus!);
      src.start();
      this.ambNodes.push(src, f, g);
      if (lfoRate) {
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = lfoRate; lg.gain.value = lfoDepth;
        lfo.connect(lg); lg.connect(f.frequency); lfo.start();
        this.ambNodes.push(lfo, lg);
      }
    };
    switch (this.ambience) {
      case 'rain': loop(3500, 'highpass', 0.5, 0.35); loop(900, 'lowpass', 0.5, 0.25); break;
      case 'wind': loop(500, 'bandpass', 1.2, 0.5, 0.15, 300); loop(1400, 'bandpass', 4, 0.12, 0.27, 600); break;
      case 'snow': loop(700, 'bandpass', 0.8, 0.22, 0.1, 200); break;
      default: loop(400, 'lowpass', 0.7, 0.12, 0.08, 150); break; // leises Rauschen von Wind und Brandung / soft wind and surf
    }
    // ferner Gefechtslaerm / distant battle noise
    if (this.intensity >= 1) loop(160, 'lowpass', 0.7, 0.18 * this.intensity, 0.3, 60);
    this.scheduleDetails();
  }

  private detailTimer: number | null = null;
  /** einzelne Details: Vogel, Donner, ferne Einschlaege / single details: birds, thunder, distant impacts */
  private scheduleDetails() {
    if (this.detailTimer !== null) window.clearTimeout(this.detailTimer);
    const tick = () => {
      this.detailTimer = window.setTimeout(tick, 2500 + this.rnd() * 4500);
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running' || !this.effectsOn || !this.ambienceOn || !this.theme) return;
      const t = ctx.currentTime + 0.05;
      const out = this.ctx!.createGain(); out.gain.value = 0.6; out.connect(this.ambBus!); this.wetSend(out, 0.6);
      this.release(out, 5000);
      if (this.intensity >= 1 && this.rnd() < 0.55 + this.intensity * 0.15) {
        // ferner Einschlag oder MG-Salve / distant impact or MG burst
        if (this.rnd() < 0.5) { this.tone(55, t, 1.2, 'sine', 0.35, out, 0.5); this.noise(t, 1.2, 0.25, 300, out, { freqEnd: 60 }); }
        else for (let i = 0; i < 6; i++) this.noise(t + i * 0.07, 0.05, 0.12, 900, out, { type: 'bandpass', q: 1 });
      } else if (this.ambience === 'clear' && this.rnd() < 0.6) {
        // Vogelgezwitscher / bird chirps
        const base = 2600 + this.rnd() * 1400;
        for (let i = 0; i < 2 + Math.floor(this.rnd() * 3); i++) this.tone(base, t + i * 0.13, 0.08, 'sine', 0.05, out, 1.25 + this.rnd() * 0.3, 0.005);
      } else if (this.ambience === 'rain' && this.rnd() < 0.25) {
        // Donner / thunder
        this.noise(t, 2.5, 0.4, 200, out, { freqEnd: 50, attack: 0.3 });
        this.tone(40, t, 2.2, 'sine', 0.3, out, 0.7, 0.2);
      }
    };
    tick();
  }
}

export const audio = new AudioEngine();
