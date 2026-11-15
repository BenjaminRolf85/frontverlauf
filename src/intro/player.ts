/**
 * Intro im Spiel: Vollbild-Dialog (openDialog: Fokusfalle, Escape schliesst) mit Canvas, Untertiteln in der Spielsprache
 * und Klangspur nach den Einstellungen Musik und Effekte. Ueberspringen: Knopf, Escape, zweites Antippen oder Gedrueckthalten.
 * Ohne Animationen (Einstellung) zeigt es eine Diashow mit einem Standbild je Szene. Wird per dynamischem Import geladen.
 * Intro in the game: full-screen dialog (openDialog: focus trap, Escape closes) with a canvas, subtitles in the game language
 * and a soundtrack following the music and effects settings. Skip: button, Escape, a second tap or press-and-hold.
 * Without animations (setting) it shows a slideshow with one still per scene. Loaded via dynamic import.
 */
import '../ui/intro.css';
import { audio } from '../audio/audio';
import { components, ms } from '../design/tokens';
import { t } from '../i18n/i18n';
import { esc, openDialog } from '../ui/components';
import { icon } from '../ui/icons';
import { loadIntroAssets, type IntroAssets } from './assets';
import { SLIDES, renderAt } from './render';
import { LiveScore } from './sound';
import { introTexts, type IntroTexts } from './texts';
import { DURATION, subtitleAt } from './timeline';

export interface IntroOptions {
  music: boolean;
  effects: boolean;
  animations: boolean;
  /** nach dem Ende oder Ueberspringen / after the end or skipping */
  onClose?: () => void;
  /** 3D-Szene dahinter anhalten / pause the 3D scene behind */
  pause?: (on: boolean) => void;
}

const HOLD_MS = ms(components.intro.holdMs);
const HINT_MS = ms(components.intro.hintMs);

export function playIntro(root: HTMLElement, opts: IntroOptions): { close: () => void } {
  const slides = !opts.animations;
  const T: IntroTexts = introTexts();
  const controls = slides
    ? `<button type="button" class="btn secondary" data-action="prev">${icon('rotateLeft', 'icon-sm')}<span>${esc(t('intro.back'))}</span></button>
       <span class="intro-count" data-count></span>
       <button type="button" class="btn" data-action="next">${icon('next', 'icon-sm')}<span>${esc(t('intro.next'))}</span></button>
       <button type="button" class="btn secondary" data-action="skip">${icon('close', 'icon-sm')}<span>${esc(t('actions.close'))}</span></button>`
    : `<button type="button" class="btn secondary intro-skip" data-action="skip">${icon('next', 'icon-sm')}<span>${esc(t('intro.skip'))}</span></button>`;
  let stop = () => {};
  const d = openDialog(root, `<div class="panel-title sr-only"><h2>${esc(t('intro.title'))}</h2></div>
    <canvas class="intro-canvas" aria-hidden="true"></canvas>
    <p class="intro-loading" role="status">${esc(t('intro.loading'))}</p>
    <p class="sr-only" aria-live="polite" data-live></p>
    <p class="intro-hint" hidden>${esc(t('intro.skipHint'))}</p>
    <div class="intro-bar">${controls}</div>
    ${slides ? '' : '<div class="intro-progress" aria-hidden="true"><i></i></div>'}`,
  { focus: slides ? '[data-action="next"]' : '[data-action="skip"]', onClose: () => { stop(); opts.pause?.(false); opts.onClose?.(); } });
  opts.pause?.(true);
  const box = d.node;
  box.classList.add('intro-dialog');
  if (slides) box.classList.add('intro-slides');
  box.parentElement?.classList.add('intro-overlay', 'above-screen');

  const canvas = box.querySelector<HTMLCanvasElement>('.intro-canvas')!;
  const ctx = canvas.getContext('2d');
  const live = box.querySelector<HTMLElement>('[data-live]')!;
  const hint = box.querySelector<HTMLElement>('.intro-hint')!;
  const bar = box.querySelector<HTMLElement>('.intro-progress > i');
  const count = box.querySelector<HTMLElement>('[data-count]');
  let assets: IntroAssets | null = null;
  let size = { w: 1, h: 1 };
  let closed = false;

  const resize = () => {
    const r = box.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    canvas.width = Math.round(size.w * dpr); canvas.height = Math.round(size.h * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { resize(); if (slides) drawSlide(); }) : null;
  ro?.observe(box);
  resize();

  const draw = (time: number) => { if (ctx && assets) renderAt(ctx, time, size.w, size.h, assets, T); };
  let lastSub: string | null = null;
  const announce = (time: number) => {
    const s = subtitleAt(time);
    const key = s?.key ?? null;
    if (key !== lastSub) { lastSub = key; if (key) live.textContent = T.subs[key]; }
  };

  // ---------- Diashow / slideshow ----------
  let slide = 0;
  function drawSlide() {
    if (!assets) return;
    const time = SLIDES[slide];
    draw(time);
    const sub = subtitleAt(time);
    live.textContent = sub ? T.subs[sub.key] : `${T.logo}. ${T.tagline}.`;
    if (count) count.textContent = t('intro.slide', { n: slide + 1, total: SLIDES.length });
    box.querySelector<HTMLButtonElement>('[data-action="prev"]')!.disabled = slide === 0;
    box.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled = slide === SLIDES.length - 1;
  }
  const step = (dir: number) => { slide = Math.max(0, Math.min(SLIDES.length - 1, slide + dir)); drawSlide(); };

  // ---------- Wiedergabe / playback ----------
  let raf = 0;
  let score: LiveScore | null = null;
  let start = 0;
  const prevMusic = audio.musicOn;
  const frame = () => {
    if (closed) return;
    const time = (performance.now() - start) / 1000;
    if (time >= DURATION) { d.close(); return; }
    score?.pump(time);
    draw(Math.max(0, time));
    announce(time);
    if (bar) bar.style.transform = `scaleX(${Math.max(0, time) / DURATION})`;
    raf = requestAnimationFrame(frame);
  };
  const play = () => {
    if (opts.music || opts.effects) {
      audio.unlock();
      const ac = audio.context();
      if (ac) {
        // Spielmusik pausieren, die Intro-Klangspur bringt eigene Musik / pause game music, the intro brings its own
        audio.musicOn = false;
        score = new LiveScore(ac, { music: opts.music, effects: opts.effects });
      }
    }
    start = performance.now() + 120;
    raf = requestAnimationFrame(frame);
  };

  stop = () => {
    closed = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    clearTimeout(holdTimer); clearTimeout(hintTimer);
    disarm.disconnect();
    if (score) { score.stop(); score = null; audio.musicOn = prevMusic; }
  };

  // ---------- Ueberspringen: Knoepfe, Antippen, Halten / skip: buttons, tap, hold ----------
  let holdTimer = 0, hintTimer = 0, hintOn = false;
  const showHint = () => {
    hintOn = true; hint.hidden = false;
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { hintOn = false; hint.hidden = true; }, HINT_MS);
  };
  box.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (a === 'skip') d.close();
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (slides) return;
    e.preventDefault();
    showHint();
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => { holdTimer = 0; d.close(); }, HOLD_MS);
  });
  const release = (tap: boolean) => {
    if (slides) return;
    if (!holdTimer) return;
    clearTimeout(holdTimer); holdTimer = 0;
    if (tap && hintOn && hint.dataset.armed === '1') d.close();
    hint.dataset.armed = '1';
  };
  canvas.addEventListener('pointerup', () => release(true));
  canvas.addEventListener('pointercancel', () => release(false));
  canvas.addEventListener('pointerleave', () => release(false));
  // zweiter Tipp nur innerhalb der Hinweiszeit / second tap only within the hint time
  const disarm = new MutationObserver(() => { if (hint.hidden) hint.dataset.armed = '0'; });
  disarm.observe(hint, { attributes: true, attributeFilter: ['hidden'] });
  // Diashow: Antippen blaettert weiter, Pfeiltasten / slideshow: tap advances, arrow keys
  if (slides) {
    canvas.addEventListener('click', () => step(1));
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    });
  }

  void loadIntroAssets().then((a) => {
    if (closed) return;
    assets = a;
    box.querySelector('.intro-loading')?.remove();
    if (slides) drawSlide(); else play();
  });
  return { close: () => d.close() };
}
