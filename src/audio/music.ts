/**
 * Musik aus Dateien (public/music): Wiedergabelisten je Lage mit Ueberblendung, kurze Stinger ueber der Musik.
 * Ohne Dateien (offline, Fehler) bleibt die prozedurale Musik der Audio-Engine aktiv.
 * Music from files (public/music): playlists per situation with crossfades, short stingers over the music.
 * Without files (offline, errors) the procedural music of the audio engine stays active.
 */
import type { FactionId } from '../data/balance';

/** Lage, nach der die Wiedergabeliste gewaehlt wird / situation that selects the playlist */
export type MusicMood = 'menu' | 'briefing' | 'calm' | 'leading' | 'tense' | 'battle' | 'finale' | 'victory' | 'defeat';
export type MusicSting = 'cityWon' | 'cityLost';

const BASE = `${import.meta.env.BASE_URL ?? '/'}music/`;

/** Wiedergabelisten (Dateinamen ohne Endung) / playlists (file names without extension) */
const LISTS: Record<MusicMood, string[]> = {
  menu: ['calm-close-victory'],
  briefing: ['briefing'],
  calm: ['calm-triumph-in-the-ranks'],
  leading: ['calm-triumph-in-the-ranks'],
  tense: ['tense-1', 'tense-2'],
  battle: ['battle-1', 'battle-city-attacked', 'final-stand-1', 'battle-2', 'final-stand-2'],
  finale: ['final-stand-1', 'final-stand-2'],
  victory: ['victory-triumphal-march'],
  defeat: ['menu-last-trumpet-call'],
};

/** Fraktionsthemen fuer ruhige Runden / faction themes for calm rounds */
const FACTION: Partial<Record<FactionId, string[]>> = {
  korvat: ['faction-korvat'],
  dravon: ['faction-dravon'],
  alvenia: ['faction-alvenia'],
  meridon: ['faction-meridon'],
  velkar: ['faction-velkar'],
  zyrr: ['faction-zyrr-1', 'faction-zyrr-2', 'faction-zyrr-3'],
  nexus: ['faction-nexus'],
};

const STINGS: Record<MusicSting, string[]> = {
  cityWon: ['sting-city-won-1', 'sting-city-won-2'],
  cityLost: ['sting-city-lost-1', 'sting-city-lost-2'],
};

/** Mindestspielzeit eines Stuecks vor einem Lagewechsel / minimum play time before a mood change */
const MIN_PLAY_MS = 25000;
/** So lange muss es ruhig bleiben, bevor die Musik entspannt / how long it must stay calm before the music relaxes */
const CALM_HOLD_MS = 45000;
/** Ueberblendzeit in ms / crossfade time in ms */
const FADE_MS = 1800;
/** Lautstaerke der Musik (0..1) / music volume (0..1) */
const VOLUME = 0.55;
/** Musik waehrend eines Stingers / music level during a stinger */
const DUCK = 0.2;

export class MusicPlayer {
  /** Dateien spielbar? Wird beim ersten Fehler auf false gesetzt / files playable? set to false on the first error */
  available = typeof Audio !== 'undefined';
  private current: HTMLAudioElement | null = null;
  private mood: MusicMood | null = null;
  private faction: FactionId | null = null;
  private track = '';
  private duck = 1;
  private enabled = true;
  private unlocked = false;
  private counter = 0;
  private fades = new Map<HTMLAudioElement, number>();
  private pendingTimer = 0;
  private switchedAt = -1e9;

  /** Musik an oder aus (Einstellung) / music on or off (setting) */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopAll();
    else this.restart();
  }

  /** Nach einer Nutzergeste: Wiedergabe erlauben / after a user gesture: allow playback */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.restart();
  }

  /**
   * Lage und Fraktion setzen. Ein Fraktionswechsel unterbricht kein laufendes Stueck; Lagewechsel im Spiel
   * werden beruhigt: Steigerung fruehestens nach MIN_PLAY_MS, Entspannung erst nach CALM_HOLD_MS ohne neue Spannung.
   * Set situation and faction. A faction change never interrupts a running piece; in-game mood changes are
   * smoothed: escalation at the earliest after MIN_PLAY_MS, relaxing only after CALM_HOLD_MS without new tension.
   */
  set(mood: MusicMood, faction: FactionId | null = this.faction) {
    this.faction = faction;
    if (this.pendingTimer) { clearTimeout(this.pendingTimer); this.pendingTimer = 0; }
    if (mood === this.mood) return;
    const inGame = (m: MusicMood | null) => m === 'calm' || m === 'leading' || m === 'tense' || m === 'battle';
    if (!inGame(mood) || !inGame(this.mood)) { this.apply(mood); return; }
    const rank = (m: MusicMood | null) => (m === 'battle' ? 2 : m === 'tense' ? 1 : 0);
    const since = performance.now() - this.switchedAt;
    const wait = rank(mood) > rank(this.mood) ? Math.max(0, MIN_PLAY_MS - since) : Math.max(CALM_HOLD_MS, MIN_PLAY_MS - since);
    if (wait <= 0) { this.apply(mood); return; }
    this.pendingTimer = window.setTimeout(() => { this.pendingTimer = 0; this.apply(mood); }, wait);
  }

  private apply(mood: MusicMood) {
    this.mood = mood;
    this.switchedAt = performance.now();
    this.next(true);
  }

  /** kurzer Stinger ueber der Musik (Stadt erobert/verloren) / short stinger over the music (city won/lost) */
  sting(kind: MusicSting) {
    if (!this.ready()) return;
    const list = STINGS[kind];
    const a = this.element(list[this.counter++ % list.length]);
    a.volume = VOLUME;
    this.duckTo(DUCK);
    a.addEventListener('ended', () => this.duckTo(1), { once: true });
    a.play().catch(() => this.duckTo(1));
  }

  private ready() { return this.available && this.enabled && this.unlocked; }

  private playlist(): string[] {
    const m = this.mood;
    if (!m) return [];
    // ruhige Runden: Fraktionsthema im Wechsel mit allgemeinen Stuecken / calm rounds: faction theme alternating with general pieces
    if (m === 'calm' && this.faction && FACTION[this.faction]) return [...FACTION[this.faction]!, ...LISTS.calm];
    return LISTS[m];
  }

  private next(force = false) {
    if (!this.ready()) return;
    const list = this.playlist();
    if (!list.length) { this.fadeOut(this.current); this.current = null; this.track = ''; return; }
    // laufendes Stueck passt noch: weiterspielen / current piece still fits: keep playing
    if (force && this.current && list.includes(this.track) && !this.current.paused) return;
    const pick = list.length === 1 ? list[0] : list.filter((t) => t !== this.track)[this.counter++ % (list.length - 1)];
    const a = this.element(pick);
    a.volume = 0;
    // einmalige Stuecke (Sieg, Niederlage) nicht wiederholen / one-shot pieces (victory, defeat) do not repeat
    const oneShot = this.mood === 'victory' || this.mood === 'defeat';
    a.addEventListener('ended', () => { if (this.current === a && !oneShot) this.next(); }, { once: true });
    a.play().then(() => {
      this.fadeOut(this.current === a ? null : this.current);
      this.current = a;
      this.track = pick;
      this.fade(a, VOLUME * this.duck);
    }).catch(() => {
      // Datei fehlt oder Wiedergabe blockiert / file missing or playback blocked
      if (a.error) this.available = false;
    });
  }

  private restart() {
    if (!this.ready()) return;
    this.track = '';
    this.next();
  }

  private element(name: string): HTMLAudioElement {
    const a = new Audio(`${BASE}${name}.mp3`);
    a.preload = 'auto';
    a.addEventListener('error', () => { if (a === this.current || this.current === null) this.available = false; });
    return a;
  }

  private duckTo(level: number) {
    this.duck = level;
    if (this.current) this.fade(this.current, VOLUME * level, 400);
  }

  private fade(a: HTMLAudioElement, to: number, ms = FADE_MS) {
    const old = this.fades.get(a);
    if (old) clearInterval(old);
    const from = a.volume, start = performance.now();
    const id = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t >= 1) { clearInterval(id); this.fades.delete(a); if (to === 0) { a.pause(); a.src = ''; } }
    }, 50);
    this.fades.set(a, id);
  }

  private fadeOut(a: HTMLAudioElement | null) { if (a) this.fade(a, 0); }

  private stopAll() {
    if (this.current) { this.current.pause(); this.current = null; }
    this.track = '';
  }
}
