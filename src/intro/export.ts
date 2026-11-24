/**
 * Nur Entwicklung: Exportseite fuer das Intro-Video (?intro-export=1&lang=de&w=1920&h=1080&t=12.5). Zeichnet ein Bild
 * zur Zeit t und stellt window.__intro fuer scripts/intro-export.mjs bereit (Bilder als JPEG, Klangspur als WAV).
 * Wird nur ueber import.meta.env.DEV geladen und landet nicht im Produktions-Build.
 * Development only: export page for the intro video (?intro-export=1&lang=de&w=1920&h=1080&t=12.5). Draws one frame at
 * time t and exposes window.__intro for scripts/intro-export.mjs (frames as JPEG, soundtrack as WAV).
 * Only loaded via import.meta.env.DEV and not part of the production build.
 */
import { components } from '../design/tokens';
import { setLanguage } from '../i18n/i18n';
import { loadIntroAssets } from './assets';
import { renderAt } from './render';
import { renderFilmSoundtrack } from './filmScore';
import { renderSoundtrack, wavBytes } from './sound';
import { introTexts } from './texts';
import { DURATION, SCENES, SUBTITLES } from './timeline';

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function bootExport(params: URLSearchParams) {
  setLanguage(params.get('lang') === 'en' ? 'en' : 'de');
  const W = Number(params.get('w')) || 1920, H = Number(params.get('h')) || 1080;
  document.getElementById('app')?.remove();
  document.body.style.background = components.intro.bg;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const [assets] = await Promise.all([loadIntroAssets()]);
  const texts = introTexts();
  const draw = (t: number) => renderAt(ctx, t, W, H, assets, texts);
  draw(Number(params.get('t')) || 0);
  (window as unknown as { __intro: unknown }).__intro = {
    ready: true,
    duration: DURATION,
    scenes: SCENES,
    subtitles: SUBTITLES.map((s) => ({ ...s, text: texts.subs[s.key] })),
    draw,
    frame(t: number, quality = 0.93) { draw(t); return canvas.toDataURL('image/jpeg', quality); },
    async wav() { return base64(wavBytes(await renderSoundtrack(48000))); },
    /** Klangspur des Introfilms (tools/intro-film/soundtrack.mjs) / soundtrack of the intro film (tools/intro-film/soundtrack.mjs) */
    async filmWav() { return base64(wavBytes(await renderFilmSoundtrack(48000))); },
  };
}
