/**
 * Oberflaeche der Kampagne m2 (Das Mutterschiff): Knopf "Am Schiff arbeiten" fuer den Wissenschaftler, Feldpanel des
 * Wracks mit Arbeitsfortschritt und Hinweis nach jeder Arbeitsrunde. Texte aus mothership.* (DE und EN), Zahlen aus M2.
 * UI of campaign m2 (The Mothership): "Work on the ship" button for the scientist, tile panel of the wreck with the work
 * progress and a toast after every work round. Texts from mothership.* (DE and EN), numbers from M2.
 */
import { shipWork, workCheck, type GameEvent, type GameState, type Unit } from '../core';
import { M2 } from '../data/balance';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { esc, progress, toast, type ActionItem } from './components';
import { icon } from './icons';

/** Platzhalter der Texte / text placeholders */
const vars = (s: GameState) => ({ ...shipWork(s), share: Math.round(M2.hpShare * 100) });

/** Grund, warum der Wissenschaftler gerade nicht arbeiten kann / reason why the scientist cannot work right now */
function reason(code: string, err: (c: string) => string): string {
  if (code === 'outOfRange') return t('mothership.notAdjacent');
  if (code === 'unitExhausted') return t('mothership.done');
  return err(code);
}

/**
 * Aktion "Am Schiff arbeiten" (nur fuer den Wissenschaftler einer Partie mit Mutterschiff), sonst null.
 * Action "Work on the ship" (only for the scientist of a game with a mothership), otherwise null.
 */
export function workAction(s: GameState, u: Unit, g: Controller, err: (c: string) => string): ActionItem | null {
  if (u.type !== 'scientist' || !s.campaign?.ship || s.campaign.scientist !== u.id) return null;
  const chk = workCheck(s, u);
  const v = vars(s);
  const desc = t('mothership.workDesc', v);
  return {
    id: 'workShip', icon: 'research', variant: 'primary', label: t('mothership.work'), sub: t('mothership.progress', v), enabled: chk === 'ok',
    desc, reason: chk === 'ok' ? desc : `${reason(chk, err)} ${desc}`,
    run: () => void g.exec({ type: 'workShip', unit: u.id }),
  };
}

/** Feldpanel des Wracks: Name, Lage, Fortschritt, Beschreibung / tile panel of the wreck: name, state, progress, description */
export function shipSheet(s: GameState): { head: string; body: string } {
  const v = vars(s);
  const head = `<span class="unit-badge">${icon('research')}</span><div class="grow"><h3 class="display">${esc(t('mothership.name'))}</h3>
    <div class="muted unit-sub">${esc(t('mothership.sub'))}</div></div>`;
  const body = `<div class="row">${icon('research', 'icon-sm')}<span>${esc(t('mothership.progress', v))}</span><div class="grow">${progress(v.have, v.need, '', t('mothership.progress', v))}</div></div>
    <p class="muted sheet-more">${esc(t('mothership.tileDesc', v))}</p>`;
  return { head, body };
}

/** Hinweis nach einer Arbeitsrunde / toast after a work round */
export function shipWorkToast(root: HTMLElement, e: Extract<GameEvent, { t: 'shipWork' }>) {
  toast(root, t(e.have >= e.need ? 'mothership.toastDone' : 'mothership.toast', { have: e.have, need: e.need }), 'research');
}
