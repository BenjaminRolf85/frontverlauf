/**
 * Introfilm "Die Vorgeschichte": Zeitleiste (src/intro/film.json, gemeinsam mit den Blender-Skripten in tools/intro-film),
 * Untertitel und Einblendungen je Zeitpunkt, Videoquellen und die Wahl zwischen Film, 2D-Intro und Diashow.
 * Reine Daten und Funktionen ohne DOM, damit sie testbar sind.
 * Intro film "The backstory": timeline (src/intro/film.json, shared with the Blender scripts in tools/intro-film),
 * captions and overlays per moment, video sources and the choice between film, 2D intro and slideshow.
 * Pure data and functions without DOM so they are testable.
 */
import data from './film.json';

export interface FilmShot { id: string; start: number; end: number }
export interface FilmCue { key: string; start: number; end: number }
export interface Film {
  fps: number;
  renderFps: number;
  duration: number;
  shots: readonly FilmShot[];
  captions: readonly FilmCue[];
  /** Erscheinen der drei Comicfelder in der Einstellung "awaken" (Sekunden ab Einstellungsbeginn) / appearance of the three comic panels in the "awaken" shot (seconds from shot start) */
  panels: readonly number[];
  /** Sprachabhaengige Einblendungen ueber dem Bild (Lautmalerei, Slogan) / language-dependent overlays on the picture (onomatopoeia, tagline) */
  overlays: readonly FilmCue[];
}

export const FILM: Film = data;
export const FILM_PANELS = FILM.panels;

/** Beginn einer Einstellung in Sekunden / start of a shot in seconds */
export function shotStart(id: string): number {
  const s = FILM.shots.find((x) => x.id === id);
  if (!s) throw new Error(`unknown film shot ${id}`);
  return s.start;
}

const cueAt = (list: readonly FilmCue[], t: number) => list.find((c) => t >= c.start && t < c.end) ?? null;
/** Untertitel zur Zeit t (Schluessel unter intro.film.sub) / caption at time t (key under intro.film.sub) */
export const captionAt = (t: number) => cueAt(FILM.captions, t);
/** Einblendung zur Zeit t (boom: intro.boom, tagline: intro.tagline) / overlay at time t */
export const overlayAt = (t: number) => cueAt(FILM.overlays, t);

/** Sprachschluessel einer Einblendung / language key of an overlay */
export const overlayKey = (key: string) => (key === 'boom' ? 'intro.boom' : key === 'tagline' ? 'intro.tagline' : `intro.film.${key}`);

/** Videodateien unter public/intro (WebM mit VP9 zuerst, MP4 mit H.264 als Ersatz) / video files under public/intro (WebM with VP9 first, MP4 with H.264 as fallback) */
export const FILM_FILES = {
  webm: 'intro/frontverlauf-intro.webm',
  mp4: 'intro/frontverlauf-intro.mp4',
  poster: 'intro/frontverlauf-intro-poster.webp',
} as const;

export interface FilmSource { src: string; type: string }
export function filmSources(base: string): FilmSource[] {
  return [
    { src: `${base}${FILM_FILES.webm}`, type: 'video/webm; codecs="vp9, opus"' },
    { src: `${base}${FILM_FILES.mp4}`, type: 'video/mp4; codecs="avc1.640028, mp4a.40.2"' },
  ];
}

export type IntroMode = 'film' | 'canvas' | 'slides';
export interface IntroEnv {
  /** Einstellung Animationen / animations setting */
  animations: boolean;
  /** prefers-reduced-motion des Systems / the system's prefers-reduced-motion */
  reducedMotion: boolean;
  /** HTMLMediaElement.canPlayType ('' | 'maybe' | 'probably'); fehlt ohne Video-Unterstuetzung / missing without video support */
  canPlayType?: (type: string) => string;
  /** Der Film ist in dieser Sitzung schon einmal gescheitert / the film already failed once in this session */
  filmFailed?: boolean;
}

/**
 * Welches Intro? Ohne Animationen oder mit reduzierter Bewegung die Diashow (Standbilder, eigenes Tempo); sonst der Film,
 * wenn der Browser eine der Videoquellen abspielen kann; sonst (oder nach einem Fehler) das 2D-Intro auf dem Canvas.
 * Which intro? Without animations or with reduced motion the slideshow (stills, own pace); otherwise the film if the
 * browser can play one of the video sources; otherwise (or after an error) the 2D intro on the canvas.
 */
export function chooseIntro(env: IntroEnv): IntroMode {
  if (!env.animations || env.reducedMotion) return 'slides';
  if (env.filmFailed || !env.canPlayType) return 'canvas';
  return filmSources('').some((s) => env.canPlayType!(s.type) !== '') ? 'film' : 'canvas';
}
