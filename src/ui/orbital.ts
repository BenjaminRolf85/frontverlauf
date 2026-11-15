/**
 * Oberflaeche des Orbitallasers: Knopf unter der Kartensteuerung mit Abklingzeit-Abzeichen (nur mit Relay) und das
 * Zielfeld-Infofeld mit Vorschau, Feuer und Abbrechen. Zahlen aus ORBITAL, Texte aus orbital.* (DE und EN).
 * Orbital laser UI: button below the map controls with a cooldown badge (only with a relay) and the targeting panel with
 * preview, fire and cancel. Numbers from ORBITAL, texts from orbital.* (DE and EN).
 */
import './orbital.css';
import { orbitalPreview, orbitalWait, type GameState } from '../core';
import { ORBITAL } from '../data/balance';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { actionButton, esc, iconButton, type ActionItem } from './components';
import { icon } from './icons';

/** Platzhalter fuer Relay- und Laser-Texte / placeholders for relay and laser texts */
export const orbitalVars = () => ({ cd: ORBITAL.cooldown, dmg: ORBITAL.damage, w: ORBITAL.area.w, h: ORBITAL.area.h });

/** "bereit" oder "in n Runden" / "ready" or "in n rounds" */
export const orbitalWaitText = (n: number) => (n <= 0 ? t('orbital.ready') : n === 1 ? t('orbital.wait1') : t('orbital.wait', { n }));

/**
 * Knopf "Orbitallaser" unter der Kartensteuerung fuer die betrachtende Fraktion (leer ohne Relay); kurzes Abzeichen auf schmalen Bildschirmen.
 * "Orbital laser" button below the map controls for the viewing faction (empty without a relay); short badge on narrow screens.
 */
export function orbitalButton(s: GameState, g: Controller): string {
  const f = g.viewer >= 0 ? g.viewer : s.current;
  const wait = orbitalWait(s, f);
  if (wait === null) return '';
  const ready = wait === 0;
  const long = orbitalWaitText(wait);
  const short = ready ? t('orbital.ready') : t('orbital.waitShort', { n: wait });
  const title = `${t('orbital.name')}: ${long}. ${t('orbital.desc', orbitalVars())}`;
  const usable = ready && g.isHumanTurn && f === s.current;
  return `<button type="button" class="orbital-btn ${ready ? 'ready' : ''}" data-action="orbital" aria-pressed="${g.orbitalMode}" ${usable || g.orbitalMode ? '' : 'aria-disabled="true"'} title="${esc(title)}" aria-label="${esc(title)}">${icon('satellite')}<span class="orbital-label">${esc(t('orbital.name'))}</span><em class="orbital-badge ${ready ? 'ready' : ''}"><b class="long">${esc(long)}</b><b class="short">${esc(short)}</b></em></button>`;
}

/**
 * Infofeld der Zielauswahl: Kopf, Statuszeile (Hinweis, Treffer, Warnung bei eigenen Einheiten), Feuer und Abbrechen.
 * Targeting panel: head, status line (hint, hits, warning for own units), fire and cancel.
 */
export function orbitalSheet(s: GameState, g: Controller, err: (code: string) => string): { html: string; actions: ActionItem[] } {
  const aim = g.orbitalAim;
  const pre = aim ? orbitalPreview(s, s.current, aim.x, aim.y) : null;
  let status = t('orbital.pick'), cls = '';
  if (pre) {
    const own = pre.hits.filter((h) => h.own).length;
    const kills = pre.hits.filter((h) => h.killed && !h.own).length;
    if (pre.check === 'peace') { status = t('orbital.blocked'); cls = 'warn'; }
    else if (pre.check !== 'ok') { status = err(pre.check); cls = 'warn'; }
    else {
      status = pre.hits.length ? t(pre.hits.length === 1 ? 'orbital.hits1' : 'orbital.hits', { n: pre.hits.length, kills }) : t('orbital.noHits');
      if (own) { status += ` · ${t(own === 1 ? 'orbital.own1' : 'orbital.own', { n: own })}`; cls = 'warn'; }
      status += `. ${t('orbital.confirm')}`;
    }
  }
  const ok = !!pre && pre.check === 'ok';
  const actions: ActionItem[] = [
    { id: 'orbitalFire', icon: 'satellite', variant: 'danger', label: t('orbital.fire'), enabled: ok, desc: t('orbital.desc', orbitalVars()), reason: pre ? status : t('orbital.pick'), run: () => void g.fireOrbital() },
    { id: 'orbitalCancel', icon: 'close', label: t('actions.cancel'), enabled: true, run: () => g.cancelOrbital() },
  ];
  const head = `<div class="sheet-head"><span class="unit-badge orbital-head">${icon('satellite')}</span><div class="grow"><h3 class="display">${esc(t('orbital.title'))}</h3>
    <div class="muted unit-sub">${esc(t('orbital.area', orbitalVars()))} · -${ORBITAL.damage}</div></div>${iconButton('close', t('actions.cancel'), 'orbitalCancel')}</div>`;
  const body = `<p class="orbital-status ${cls}" role="status" aria-live="polite">${cls ? icon('warning', 'icon-sm') : icon('info', 'icon-sm')}<span>${esc(status)}</span></p>`;
  const bar = `<div class="action-wrap"><div class="action-bar" role="toolbar">${actions.map(actionButton).join('')}</div></div>`;
  return { html: `${head}${body}${bar}`, actions };
}
