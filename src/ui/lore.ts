/**
 * Geschichte der Fraktionen als Comic-Seiten (Bilder in public/lore/<fraktion>.webp), mit Text-Fassung fuer
 * Screenreader und Englisch. Neue Seite: Bild ablegen und die Fraktion in LORE_PAGES eintragen.
 * Faction lore as comic pages (images in public/lore/<faction>.webp), with a text version for
 * screen readers and English. New page: add the image and list the faction in LORE_PAGES.
 */
import type { FactionId } from '../data/balance';
import { has, t } from '../i18n/i18n';
import { dialogTitle, esc, openDialog } from './components';
import { icon } from './icons';

/** Vorhandene Comic-Seiten / available comic pages */
const LORE_PAGES: readonly FactionId[] = ['korvat', 'dravon', 'alvenia', 'zyrr', 'vesper', 'nexus'];

const BASE = `${import.meta.env.BASE_URL ?? '/'}lore/`;

export const hasLore = (f: FactionId) => LORE_PAGES.includes(f);

/** Knopf "Comic ansehen" (leer, wenn es keine Seite gibt) / "view comic" button (empty without a page) */
export function loreButton(f: FactionId): string {
  if (!hasLore(f)) return '';
  return `<button type="button" class="btn secondary lore-btn" data-lore="${f}">${icon('book', 'icon-sm')}<span>${esc(t('lore.button'))}</span></button>`;
}

/** Comic-Seite oeffnen / open the comic page */
export function openLore(root: HTMLElement, f: FactionId) {
  const name = t(`factions.${f}.name`);
  const text = has(`lore.text.${f}`) ? t(`lore.text.${f}`) : '';
  const d = openDialog(root, `${dialogTitle(t('lore.title', { name }))}
    <figure class="lore-page">
      <img src="${BASE}${f}.webp" alt="${esc(text || name)}" decoding="async" loading="lazy">
      ${text ? `<figcaption><details><summary>${esc(t('lore.textToggle'))}</summary><p>${esc(text)}</p></details></figcaption>` : ''}
    </figure>`, { wide: true });
  d.node.classList.add('lore-dialog');
  d.node.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-action="close"]')) { d.close(); return; }
    // Antippen vergroessert das Bild (Handy) / tapping zooms the image (phone)
    if (el.tagName === 'IMG') el.closest('.lore-page')?.classList.toggle('zoomed');
  });
}
