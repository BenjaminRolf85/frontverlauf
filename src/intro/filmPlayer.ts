/**
 * Introfilm im Spiel: Vollbild-Dialog mit dem in Blender gerenderten Film (public/intro), Untertiteln und Einblendungen
 * als HTML in der Spielsprache, Bedienung wie beim 2D-Intro (Knopf, Escape, zweites Antippen oder Gedrueckthalten zum
 * Ueberspringen), am Ende "Nochmal ansehen". Waehlt ueber chooseIntro zwischen Film, 2D-Intro und Diashow und faellt bei
 * einem Videofehler auf das 2D-Intro zurueck. Laedt nur Metadaten vor, der Spielstart wartet nie auf das Video.
 * Intro film in the game: full-screen dialog with the film rendered in Blender (public/intro), captions and overlays as
 * HTML in the game language, controls like the 2D intro (button, Escape, a second tap or press-and-hold to skip), "Watch
 * again" at the end. Picks film, 2D intro or slideshow via chooseIntro and falls back to the 2D intro on a video error.
 * Preloads metadata only; the game start never waits for the video.
 */
import '../ui/intro.css';
import { audio } from '../audio/audio';
import { components, ms, primitives } from '../design/tokens';
import { t } from '../i18n/i18n';
import { esc, openDialog } from '../ui/components';
import { icon } from '../ui/icons';
import { FILM, FILM_FILES, captionAt, chooseIntro, filmSources, overlayAt, overlayKey, type IntroMode } from './film';
import type { IntroOptions } from './player';

const HOLD_MS = ms(components.intro.holdMs);
const HINT_MS = ms(components.intro.hintMs);
const STALL_MS = ms(components.intro.filmStallMs);
const BASE = import.meta.env.BASE_URL ?? '/';

/** Film in dieser Sitzung gescheitert: danach gleich das 2D-Intro / film failed in this session: go straight to the 2D intro afterwards */
let filmFailed = false;

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Intro passend zu Einstellungen und Geraet / intro matching the settings and the device */
export function introMode(opts: Pick<IntroOptions, 'animations'>): IntroMode {
  const probe = typeof document !== 'undefined' ? document.createElement('video') : null;
  return chooseIntro({
    animations: opts.animations, reducedMotion: reducedMotion(), filmFailed,
    canPlayType: probe && typeof probe.canPlayType === 'function' ? (type) => probe.canPlayType(type) : undefined,
  });
}

/** Einstieg fuer Menue und ersten Kampagnenstart / entry point for the menu and the first campaign start */
export function playIntroFilm(root: HTMLElement, opts: IntroOptions): { close: () => void } {
  const mode = introMode(opts);
  if (mode !== 'film') {
    // 2D-Intro oder Diashow (eigener Baustein, nur bei Bedarf geladen) / 2D intro or slideshow (own chunk, loaded on demand)
    let inner: { close: () => void } | null = null;
    let closed = false;
    void import('./player').then((m) => { if (!closed) inner = m.playIntro(root, { ...opts, animations: mode === 'canvas' }); }).catch(() => opts.onClose?.());
    return { close: () => { closed = true; inner?.close(); } };
  }
  return playFilm(root, opts);
}

function playFilm(root: HTMLElement, opts: IntroOptions): { close: () => void } {
  const sound = opts.music || opts.effects;
  const sources = filmSources(BASE).map((s) => `<source src="${esc(s.src)}" type='${s.type}'>`).join('');
  let fallback = false;
  let stop = () => {};
  const d = openDialog(root, `<div class="panel-title sr-only"><h2>${esc(t('intro.film.title'))}</h2></div>
    <div class="intro-film-stage">
      <video class="intro-video" playsinline preload="metadata" poster="${esc(BASE + FILM_FILES.poster)}" aria-hidden="true" disablepictureinpicture>${sources}</video>
      <p class="intro-film-overlay" data-overlay hidden></p>
      <p class="intro-caption" data-caption hidden></p>
    </div>
    <p class="intro-loading" role="status">${esc(t('intro.loading'))}</p>
    <p class="sr-only" aria-live="polite" data-live></p>
    <p class="intro-hint" hidden>${esc(t('intro.skipHint'))}</p>
    <div class="intro-bar">
      <button type="button" class="btn secondary" data-action="replay" hidden>${icon('rotateLeft', 'icon-sm')}<span>${esc(t('intro.replay'))}</span></button>
      <button type="button" class="btn secondary intro-skip" data-action="skip">${icon('next', 'icon-sm')}<span>${esc(t('intro.skip'))}</span></button>
    </div>
    <div class="intro-progress" aria-hidden="true"><i></i></div>`,
  {
    focus: '[data-action="skip"]',
    onClose: () => {
      stop();
      opts.pause?.(false);
      // Videofehler: 2D-Intro statt Film, onClose erst danach / video error: 2D intro instead of the film, onClose only afterwards
      if (fallback) void import('./player').then((m) => m.playIntro(root, opts)).catch(() => opts.onClose?.());
      else opts.onClose?.();
    },
  });
  opts.pause?.(true);
  const box = d.node;
  box.classList.add('intro-dialog', 'intro-film');
  box.parentElement?.classList.add('intro-overlay', 'above-screen');

  const video = box.querySelector<HTMLVideoElement>('video')!;
  const stage = box.querySelector<HTMLElement>('.intro-film-stage')!;
  const capEl = box.querySelector<HTMLElement>('[data-caption]')!;
  const ovEl = box.querySelector<HTMLElement>('[data-overlay]')!;
  const live = box.querySelector<HTMLElement>('[data-live]')!;
  const hint = box.querySelector<HTMLElement>('.intro-hint')!;
  const bar = box.querySelector<HTMLElement>('.intro-progress > i')!;
  const replay = box.querySelector<HTMLButtonElement>('[data-action="replay"]')!;
  const loading = box.querySelector<HTMLElement>('.intro-loading');
  video.muted = !sound;
  video.volume = opts.music && opts.effects ? 1 : 0.8;

  let closed = false;
  let raf = 0;
  let lastCap = '', lastOv = '';
  const prevMusic = audio.musicOn;
  if (sound) audio.musicOn = false;

  const fail = () => {
    if (closed) return;
    filmFailed = true;
    fallback = true;
    d.close();
  };
  // ohne erstes Bild nach der Wartezeit: 2D-Intro / no first frame after the wait: 2D intro
  const stall = window.setTimeout(fail, STALL_MS);
  const started = () => { clearTimeout(stall); loading?.remove(); };

  const frame = () => {
    if (closed) return;
    const time = video.currentTime;
    const cap = captionAt(time);
    const capText = cap ? t(`intro.film.sub.${cap.key}`) : '';
    if (capText !== lastCap) {
      lastCap = capText;
      capEl.textContent = capText;
      capEl.hidden = !capText;
      if (capText) live.textContent = capText;
    }
    const ov = overlayAt(time);
    const ovKey = ov?.key ?? '';
    if (ovKey !== lastOv) {
      lastOv = ovKey;
      ovEl.textContent = ov ? t(overlayKey(ov.key)) : '';
      ovEl.dataset.kind = ovKey;
      ovEl.hidden = !ov;
      if (ov?.key === 'tagline') live.textContent = `${t('app.title')}. ${t('intro.tagline')}.`;
    }
    bar.style.transform = `scaleX(${Math.min(1, time / FILM.duration)})`;
    raf = requestAnimationFrame(frame);
  };

  const play = () => {
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch((e: unknown) => {
        // Autoplay mit Ton verweigert: stumm weiter / autoplay with sound refused: continue muted
        if (e instanceof DOMException && e.name === 'NotAllowedError' && !video.muted) { video.muted = true; void video.play().catch(fail); }
        else if (!(e instanceof DOMException && e.name === 'AbortError')) fail();
      });
    }
  };

  video.addEventListener('playing', started);
  video.addEventListener('loadeddata', started, { once: true });
  // Fehler der letzten Quelle bedeutet: keine Quelle spielbar / an error on the last source means: no source is playable
  video.querySelector('source:last-of-type')?.addEventListener('error', fail);
  video.addEventListener('error', fail);
  video.addEventListener('ended', () => {
    replay.hidden = false;
    replay.focus({ preventScroll: true });
    capEl.hidden = true;
    lastCap = '';
  });

  stop = () => {
    closed = true;
    cancelAnimationFrame(raf);
    clearTimeout(stall); clearTimeout(holdTimer); clearTimeout(hintTimer);
    disarm.disconnect();
    video.pause();
    video.removeAttribute('src');
    for (const s of Array.from(video.querySelectorAll('source'))) s.remove();
    video.load();
    if (sound) audio.musicOn = prevMusic;
  };

  // ---------- Ueberspringen und Nochmal / skip and replay ----------
  let holdTimer = 0, hintTimer = 0, hintOn = false;
  const showHint = () => {
    hintOn = true; hint.hidden = false;
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { hintOn = false; hint.hidden = true; }, HINT_MS);
  };
  box.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (a === 'skip') d.close();
    else if (a === 'replay') {
      replay.hidden = true;
      video.currentTime = 0;
      box.querySelector<HTMLElement>('[data-action="skip"]')?.focus({ preventScroll: true });
      play();
    }
  });
  stage.addEventListener('pointerdown', (e) => {
    if (video.ended) return;
    e.preventDefault();
    showHint();
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => { holdTimer = 0; d.close(); }, HOLD_MS);
  });
  const release = (tap: boolean) => {
    if (!holdTimer) return;
    clearTimeout(holdTimer); holdTimer = 0;
    if (tap && hintOn && hint.dataset.armed === '1') d.close();
    hint.dataset.armed = '1';
  };
  stage.addEventListener('pointerup', () => release(true));
  stage.addEventListener('pointercancel', () => release(false));
  stage.addEventListener('pointerleave', () => release(false));
  const disarm = new MutationObserver(() => { if (hint.hidden) hint.dataset.armed = '0'; });
  disarm.observe(hint, { attributes: true, attributeFilter: ['hidden'] });

  // Schriften der Einblendungen vorab laden / preload the fonts of the overlays
  if (typeof document !== 'undefined' && document.fonts) {
    for (const spec of [`64px ${primitives.font.comic}`, `700 32px ${primitives.font.body}`]) void document.fonts.load(spec).catch(() => []);
  }
  if (sound) audio.unlock();
  play();
  raf = requestAnimationFrame(frame);
  return { close: () => d.close() };
}
