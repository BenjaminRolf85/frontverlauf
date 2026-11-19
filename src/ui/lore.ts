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

const storyUrl = (id: string) => `${BASE}audio/${id}.mp3`;

/** m:ss fuer die Zeitanzeige / m:ss for the time display */
export function storyClock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Der eine Abspieler aller Hoergeschichten: ein Audio-Element fuer das ganze Spiel, damit eine auf der Fraktionskarte
 * gestartete Geschichte weiterlaeuft, wenn man das Fraktionsfenster oeffnet, und dort denselben Stand zeigt. Es laeuft
 * immer nur eine Geschichte. Geladen wird erst beim ersten Abspielen.
 * The single player of all audio stories: one audio element for the whole game, so that a story started on the faction
 * card keeps playing when the faction window opens and shows the same position there. Only one story plays at a time.
 * Nothing is loaded before the first play.
 */
let player: HTMLAudioElement | null = null;
let current: string | null = null;
let watcher: MutationObserver | null = null;

/** Laeuft die Geschichte gerade? / is the story playing right now? */
export const storyPlaying = (id: string) => current === id && !!player && !player.paused;

const storyControls = (id: string) => document.querySelectorAll<HTMLElement>(`[data-story="${id}"], [data-story-player="${id}"]`);

/** Knoepfe und Leisten im Dokument an den Abspieler angleichen / bring buttons and bars in the document in line with the player */
function syncStory() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLElement>('[data-story]').forEach((b) => {
    const on = storyPlaying(b.dataset.story!);
    b.setAttribute('aria-pressed', String(on));
    const ic = b.querySelector('.story-icon');
    if (ic && ic.getAttribute('data-on') !== String(on)) { ic.setAttribute('data-on', String(on)); ic.innerHTML = icon(on ? 'pause' : 'play', 'icon-sm'); }
    const label = b.querySelector('.story-label');
    if (label) label.textContent = t(on ? 'lore.pause' : 'lore.play');
    else b.setAttribute('aria-label', t(on ? 'lore.pause' : 'lore.play'));
  });
  document.querySelectorAll<HTMLElement>('[data-story-player]').forEach((box) => {
    const id = box.dataset.storyPlayer!;
    const mine = current === id && !!player;
    const total = mine && Number.isFinite(player!.duration) && player!.duration > 0 ? player!.duration : NARRATIONS[id] * 60;
    const now = mine ? player!.currentTime : 0;
    const seek = box.querySelector<HTMLInputElement>('.story-seek');
    if (seek) {
      seek.disabled = !mine;
      // waehrend des Ziehens nicht ueberschreiben / do not overwrite while dragging
      if (!seek.matches(':active')) seek.value = String(Math.round((now / total) * 1000));
      seek.style.setProperty('--story-progress', `${Math.min(100, (now / total) * 100)}%`);
      seek.setAttribute('aria-valuetext', `${storyClock(now)} / ${storyClock(total)}`);
    }
    const a = box.querySelector('[data-story-now]'), b = box.querySelector('[data-story-total]');
    if (a) a.textContent = storyClock(now);
    if (b) b.textContent = storyClock(total);
    box.classList.toggle('playing', storyPlaying(id));
  });
}

function ensurePlayer(): HTMLAudioElement {
  if (player) return player;
  const a = new Audio();
  a.preload = 'none';
  a.addEventListener('play', () => { audio.music.narration(true); watchStory(true); syncStory(); });
  const rest = () => { audio.music.narration(false); watchStory(false); syncStory(); };
  a.addEventListener('pause', rest);
  a.addEventListener('ended', () => { a.currentTime = 0; rest(); });
  a.addEventListener('timeupdate', syncStory);
  a.addEventListener('loadedmetadata', syncStory);
  a.addEventListener('error', rest);
  player = a;
  return a;
}

/**
 * Verschwindet der letzte Knopf der laufenden Geschichte (Fenster geschlossen, Partie gestartet), haelt sie an, sonst
 * liefe sie weiter, ohne dass man sie stoppen koennte.
 * If the last control of the playing story disappears (dialog closed, game started), it pauses; otherwise it would keep
 * playing with no way to stop it.
 */
function watchStory(on: boolean) {
  if (typeof MutationObserver === 'undefined') return;
  if (!on) { watcher?.disconnect(); watcher = null; return; }
  if (watcher) return;
  watcher = new MutationObserver(() => { if (current && player && !player.paused && !storyControls(current).length) player.pause(); });
  watcher.observe(document.body, { childList: true, subtree: true });
}

/** Geschichte starten oder anhalten; eine andere laufende wird abgeloest / start or pause the story; another playing one is replaced */
export function toggleStory(id: string) {
  if (!hasNarration(id)) return;
  const a = ensurePlayer();
  if (current !== id) {
    a.pause();
    current = id;
    a.src = storyUrl(id);
    void a.play().catch(() => syncStory());
  } else if (a.paused) void a.play().catch(() => syncStory());
  else a.pause();
  syncStory();
}

/** Geschichte anhalten / pause the story */
export function pauseStory() { player?.pause(); }

/** Anteil 0..1 der laufenden Geschichte anspringen / jump to share 0..1 of the current story */
function seekStory(id: string, share: number) {
  if (current !== id || !player) return;
  const total = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : NARRATIONS[id] * 60;
  player.currentTime = Math.max(0, Math.min(0.999, share)) * total;
  syncStory();
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-story]');
    if (b) toggleStory(b.dataset.story!);
  });
  document.addEventListener('input', (e) => {
    const r = e.target as HTMLInputElement | null;
    const box = r?.classList?.contains('story-seek') ? r.closest<HTMLElement>('[data-story-player]') : null;
    if (box) seekStory(box.dataset.storyPlayer!, Number(r!.value) / 1000);
  });
}

/**
 * Knopf "Geschichte anhoeren" fuer Fraktionskarten (leer, wenn es keine Aufnahme gibt): startet und haelt die Geschichte
 * direkt an, ohne ein Fenster zu oeffnen. iconOnly: nur das Symbol (enge Karten).
 * "Listen to the story" button for faction cards (empty without a recording): starts and pauses the story right there,
 * without opening a dialog. iconOnly: just the symbol (tight cards).
 */
export function storyButton(id: string, opts: { iconOnly?: boolean } = {}): string {
  const min = NARRATIONS[id];
  if (min === undefined) return '';
  const on = storyPlaying(id);
  const label = t(on ? 'lore.pause' : 'lore.play');
  return `<button type="button" class="story-btn ${opts.iconOnly ? 'icon-only' : ''}" data-story="${id}" aria-pressed="${on}" title="${esc(t('lore.listenNote', { min }))}"${opts.iconOnly ? ` aria-label="${esc(label)}"` : ''}>
    <span class="story-icon" data-on="${on}">${icon(on ? 'pause' : 'play', 'icon-sm')}</span>${opts.iconOnly ? '' : `<span class="story-label">${esc(label)}</span><span class="story-note">${esc(t('lore.minutes', { min }))}</span>`}</button>`;
}

/**
 * Abspieler fuer eine gesprochene Geschichte mit Leiste und Zeit (leer, wenn es keine gibt). Laedt erst beim Abspielen.
 * Player for a narrated story with bar and time (empty without one). Loads only when played.
 */
export function narrationHtml(id: string): string {
  const min = NARRATIONS[id];
  if (min === undefined) return '';
  const on = storyPlaying(id);
  const mine = current === id && !!player;
  const total = mine && Number.isFinite(player!.duration) && player!.duration > 0 ? player!.duration : min * 60;
  const now = mine ? player!.currentTime : 0;
  return `<div class="story-player ${on ? 'playing' : ''}" data-story-player="${id}" data-src="${storyUrl(id)}">
    <button type="button" class="icon-btn accent story-toggle" data-story="${id}" aria-pressed="${on}" aria-label="${esc(t(on ? 'lore.pause' : 'lore.play'))}"><span class="story-icon" data-on="${on}">${icon(on ? 'pause' : 'play', 'icon-sm')}</span></button>
    <div class="story-body">
      <div class="story-head">${icon('soundOn', 'icon-sm')}<strong>${esc(t('lore.listen'))}</strong><span class="story-note">${esc(t('lore.listenNote', { min }))}</span></div>
      <input type="range" class="story-seek" min="0" max="1000" step="1" value="${Math.round((now / total) * 1000)}" style="--story-progress:${Math.min(100, (now / total) * 100)}%" aria-label="${esc(t('lore.seek'))}" ${mine ? '' : 'disabled'}>
      <div class="story-time"><span data-story-now>${storyClock(now)}</span><span data-story-total>${storyClock(total)}</span></div>
    </div>
  </div>`;
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
  const d = openDialog(root, `${dialogTitle(t('lore.title', { name }))}
    ${narrationHtml(f)}
    <figure class="lore-page">
      <img src="${BASE}${f}.webp" alt="${esc(text || name)}" decoding="async" loading="lazy">
      ${text ? `<figcaption><details><summary>${esc(t('lore.textToggle'))}</summary><p>${esc(text)}</p></details></figcaption>` : ''}
    </figure>`, { wide: true });
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
