/**
 * Geschichte der Fraktionen als Comic-Seiten (Bilder in public/lore/<fraktion>.webp), mit Text-Fassung fuer
 * Screenreader und Englisch. Neue Seite: Bild ablegen und die Fraktion in LORE_PAGES eintragen.
 * Faction lore as comic pages (images in public/lore/<faction>.webp), with a text version for
 * screen readers and English. New page: add the image and list the faction in LORE_PAGES.
 */
import { audio } from '../audio/audio';
import type { FactionId } from '../data/balance';
import { has, t } from '../i18n/i18n';
import { dialogTitle, esc, openDialog } from './components';
import { icon } from './icons';

/** Vorhandene Comic-Seiten / available comic pages */
const LORE_PAGES: readonly FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'vesper', 'nexus'];

const BASE = `${import.meta.env.BASE_URL ?? '/'}lore/`;

export const hasLore = (f: FactionId) => LORE_PAGES.includes(f);

/**
 * Gesprochene Geschichten (public/lore/audio/<id>.mp3, deutsch gesprochen) mit Laenge in Minuten (gerundet).
 * Neue Aufnahme: als MP3 (Mono, 64 kbit/s) ablegen und hier eintragen.
 * Narrated stories (public/lore/audio/<id>.mp3, German narration) with length in minutes (rounded).
 * New recording: add it as MP3 (mono, 64 kbit/s) and list it here.
 */
const NARRATIONS: Readonly<Record<string, number>> = {
  korvat: 6, dravon: 9, alvenia: 6, meridon: 7, velkar: 6, vesper: 6, nexus: 8, epilog: 3,
};

export const hasNarration = (id: string) => id in NARRATIONS;

/**
 * Abspieler fuer eine gesprochene Geschichte (leer, wenn es keine gibt). Laedt erst beim Abspielen.
 * Player for a narrated story (empty without one). Loads only when played.
 */
export function narrationHtml(id: string): string {
  const min = NARRATIONS[id];
  if (min === undefined) return '';
  return `<div class="lore-audio">
    <div class="lore-audio-head">${icon('soundOn', 'icon-sm')}<span>${esc(t('lore.listen'))}</span><span class="lore-audio-note">${esc(t('lore.listenNote', { min }))}</span></div>
    <audio controls preload="none" src="${BASE}audio/${id}.mp3"></audio>
  </div>`;
}

/** gerade laufende Geschichte / story currently playing */
let playing: HTMLAudioElement | null = null;

/**
 * Waehrend eine Geschichte laeuft, wird die Musik leise; es laeuft immer nur eine. Die Ereignisse haengen am Element,
 * damit auch das Schliessen des Fensters (Element entfernt) die Musik zurueckholt.
 * While a story plays the music is turned down; only one plays at a time. The listeners sit on the element so that
 * closing the dialog (element removed) also brings the music back.
 */
function onNarrationPlay(e: Event) {
  const a = e.target;
  if (!(a instanceof HTMLAudioElement) || !a.closest('.lore-audio')) return;
  if (playing && playing !== a) playing.pause();
  playing = a;
  audio.music.narration(true);
  const stop = () => {
    if (playing !== a) return;
    playing = null;
    audio.music.narration(false);
  };
  a.addEventListener('pause', stop, { once: true });
  a.addEventListener('ended', stop, { once: true });
}
if (typeof document !== 'undefined') document.addEventListener('play', onNarrationPlay, true);

/** Geschichte anhalten (beim Schliessen eines Fensters) / pause the story (when a dialog closes) */
function pauseIn(node: HTMLElement) {
  node.querySelectorAll('audio').forEach((a) => a.pause());
}

/** Knopf "Comic ansehen" (leer, wenn es keine Seite gibt) / "view comic" button (empty without a page) */
export function loreButton(f: FactionId): string {
  if (!hasLore(f)) return '';
  // mit Hoergeschichte anderer Titel / with an audio story a different label
  const label = hasNarration(f) ? t('lore.buttonAudio') : t('lore.button');
  return `<button type="button" class="btn secondary lore-btn" data-lore="${f}">${icon('book', 'icon-sm')}<span>${esc(label)}</span></button>`;
}

/** Comic-Seite oeffnen / open the comic page */
export function openLore(root: HTMLElement, f: FactionId) {
  const name = t(`factions.${f}.name`);
  const text = has(`lore.text.${f}`) ? t(`lore.text.${f}`) : '';
  let node: HTMLElement | null = null;
  const d = openDialog(root, `${dialogTitle(t('lore.title', { name }))}
    ${narrationHtml(f)}
    <figure class="lore-page">
      <img src="${BASE}${f}.webp" alt="${esc(text || name)}" decoding="async" loading="lazy">
      ${text ? `<figcaption><details><summary>${esc(t('lore.textToggle'))}</summary><p>${esc(text)}</p></details></figcaption>` : ''}
    </figure>`, { wide: true, onClose: () => { if (node) pauseIn(node); } });
  node = d.node;
  d.node.classList.add('lore-dialog');
  d.node.parentElement?.classList.add('above-screen');
  d.node.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-action="close"]')) { d.close(); return; }
    // Antippen vergroessert das Bild (Handy) / tapping zooms the image (phone)
    if (el.tagName === 'IMG') el.closest('.lore-page')?.classList.toggle('zoomed');
  });
}

/**
 * Prolog "Der Sternfall": beim ersten Start und im Hauptmenue. onClose wird beim Schliessen aufgerufen.
 * Prologue "The Starfall": on first start and in the main menu. onClose is called when it closes.
 */
export function openPrologue(root: HTMLElement, onClose?: () => void) {
  const text = t('lore.prologueText');
  const d = openDialog(root, `${dialogTitle(t('lore.prologueTitle'))}
    <figure class="lore-page">
      <img src="${BASE}prolog.webp" alt="${esc(text)}" decoding="async">
      <figcaption><details><summary>${esc(t('lore.textToggle'))}</summary><p>${esc(text)}</p></details></figcaption>
    </figure>
    <div class="row lore-actions"><button type="button" class="btn" data-action="close">${icon('play', 'icon-sm')}<span>${esc(t('lore.prologueContinue'))}</span></button></div>`, { wide: true, onClose });
  d.node.classList.add('lore-dialog', 'prologue');
  // ueber dem Hauptmenue anzeigen / show above the main menu
  d.node.parentElement?.classList.add('above-screen');
  d.node.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-action="close"]')) { d.close(); return; }
    if (el.tagName === 'IMG') el.closest('.lore-page')?.classList.toggle('zoomed');
  });
}

export { pauseIn as pauseNarration };
