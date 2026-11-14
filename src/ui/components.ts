/**
 * UI-Komponenten. Gestaltung ausschliesslich ueber Klassen aus styles.css (Design-Tokens).
 * UI components. Styling only via classes from styles.css (design tokens).
 */
import { factionTokens } from '../design/tokens';
import type { FactionId } from '../data/balance';
import { t } from '../i18n/i18n';
import { FACTION_EMBLEM, icon } from './icons';

export const esc = (s: string | number) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Schaltflaeche / button */
export function button(label: string, opts: { variant?: 'primary' | 'secondary' | 'danger'; icon?: string; action?: string; disabled?: boolean; block?: boolean; extra?: string; cls?: string; title?: string } = {}): string {
  const cls = ['btn', opts.variant && opts.variant !== 'primary' ? opts.variant : '', opts.block ? 'block' : '', opts.cls ?? ''].join(' ').trim();
  return `<button type="button" class="${cls}" ${opts.action ? `data-action="${esc(opts.action)}"` : ''} ${opts.disabled ? 'disabled aria-disabled="true"' : ''} ${opts.title ? `title="${esc(opts.title)}"` : ''}>${opts.icon ? icon(opts.icon) : ''}<span>${esc(label)}</span>${opts.extra ?? ''}</button>`;
}

/** Symbolschaltflaeche / icon button */
export function iconButton(name: string, label: string, action: string, opts: { accent?: boolean; lg?: boolean; pressed?: boolean } = {}): string {
  return `<button type="button" class="icon-btn ${opts.accent ? 'accent' : ''} ${opts.lg ? 'lg' : ''}" data-action="${esc(action)}" aria-label="${esc(label)}" title="${esc(label)}" ${opts.pressed !== undefined ? `aria-pressed="${opts.pressed}"` : ''}>${icon(name)}</button>`;
}

/** Preis mit Stern / price with star */
export function price(n: number): string {
  return `<span class="price">${icon('star', 'icon-sm')}${n === 0 ? esc(t('actions.free')) : n}</span>`;
}

/** Ressourcenanzeige / resource display */
export function resource(iconName: string, value: string | number, sub = '', label = ''): string {
  return `<span class="res" ${label ? `aria-label="${esc(label)}: ${esc(value)} ${esc(sub)}"` : ''}><span class="${iconName === 'star' ? 'star' : ''}">${icon(iconName)}</span><span class="val">${esc(value)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>`;
}

/** Fortschrittsbalken / progress bar */
export function progress(value: number, max: number, cls = '', label = ''): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="progress ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}" ${label ? `aria-label="${esc(label)}"` : ''}><i style="width:${pct}%"></i></div>`;
}

/** Fraktionsemblem im Kreis / faction emblem badge */
export function factionBadge(f: FactionId, iconName?: string): string {
  const ft = factionTokens[f];
  return `<span class="unit-badge" style="background:var(--faction-${f}-primary);color:var(--faction-${f}-ink)" data-ink="${ft.ink}">${icon(iconName ?? FACTION_EMBLEM[f])}</span>`;
}

export function factionChip(f: FactionId, label: string): string {
  return `<span class="faction-chip" style="background:var(--faction-${f}-primary);color:var(--faction-${f}-ink)" title="${esc(label)}">${icon(FACTION_EMBLEM[f], 'icon-sm')}<span class="label">${esc(label)}</span></span>`;
}

/** Aktionsknopf in der Aktionsleiste / action in the action bar */
/** sub: kleine Zweitzeile unter dem Namen (z. B. Fraktions-Spitzname) / small second line below the label (e.g. faction nickname) */
export interface ActionItem { id: string; label: string; sub?: string; icon: string; cost?: number; enabled: boolean; reason?: string; variant?: 'primary' | 'danger'; run: () => void }
export function actionButton(a: ActionItem): string {
  const sub = a.sub && a.sub !== a.label ? `<small class="action-sub">${esc(a.sub)}</small>` : '';
  return `<button type="button" class="action ${a.variant ?? ''}" data-act="${esc(a.id)}" aria-disabled="${!a.enabled}" title="${esc(a.reason ?? (a.sub ? `${a.label} (${a.sub})` : a.label))}">${icon(a.icon)}<span>${esc(a.label)}</span>${sub}${a.cost !== undefined ? price(a.cost) : ''}</button>`;
}

/** Dialog / dialog */
/** Offene Dialoge, oberster zuletzt; Escape schliesst nur den obersten / open dialogs, topmost last; Escape closes only the topmost */
const dialogStack: { overlay: HTMLElement; close: () => void; dismissable: boolean }[] = [];
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // entfernte Dialoge aufraeumen / clean up removed dialogs
    for (let i = dialogStack.length - 1; i >= 0; i--) if (!dialogStack[i].overlay.isConnected) dialogStack.splice(i, 1);
    const top = dialogStack[dialogStack.length - 1];
    if (top?.dismissable) { e.preventDefault(); top.close(); }
  });
}

export function openDialog(root: HTMLElement, html: string, opts: { wide?: boolean; onClose?: () => void; dismissable?: boolean } = {}): { close: () => void; node: HTMLElement } {
  const overlay = el('div', 'overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const box = el('div', `panel dialog ${opts.wide ? 'wide' : ''}`, html);
  overlay.appendChild(box);
  root.appendChild(overlay);
  const close = () => {
    const i = dialogStack.findIndex((d) => d.overlay === overlay);
    if (i >= 0) dialogStack.splice(i, 1);
    overlay.remove(); opts.onClose?.();
  };
  dialogStack.push({ overlay, close, dismissable: opts.dismissable !== false });
  if (opts.dismissable !== false) {
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  }
  const focusable = box.querySelector<HTMLElement>('button, [tabindex]');
  focusable?.focus();
  return { close, node: box };
}

export function dialogTitle(title: string, closeAction = 'close'): string {
  return `<div class="panel-title"><h2 class="display">${esc(title)}</h2>${iconButton('close', t('actions.close'), closeAction)}</div>`;
}

/** Hinweis / toast */
export function toast(root: HTMLElement, text: string, iconName = 'info') {
  let box = root.querySelector<HTMLElement>('.toasts');
  if (!box) { box = el('div', 'toasts'); box.setAttribute('aria-live', 'polite'); root.appendChild(box); }
  const n = el('div', 'toast', `${icon(iconName)}<span>${esc(text)}</span>`);
  box.appendChild(n);
  while (box.children.length > 3) box.firstElementChild?.remove();
  setTimeout(() => n.remove(), 2800);
}

/** Segment-Auswahl / segmented choice */
export function segmented(name: string, options: { value: string; label: string }[], current: string): string {
  return `<div class="seg" role="group">${options.map((o) =>
    `<button type="button" data-seg="${esc(name)}" data-value="${esc(o.value)}" aria-pressed="${o.value === current}">${esc(o.label)}</button>`).join('')}</div>`;
}
