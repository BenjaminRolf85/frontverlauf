/**
 * Oberflaeche der Kriegsplaene (Kampagne m4): Aktion "Kriegsplaene bergen", Marke im Einheitenfeld, Feldfeld des
 * Tempels und der fallen gelassenen Plaene, Zeile im Ziel-Panel und Hinweise bei Ereignissen.
 * UI of the war plans (campaign m4): action "Seize the war plans", tag in the unit panel, tile panel of the temple and
 * of dropped plans, line in the objective panel and toasts on events.
 */
import { carriesPlans, seizeCheck, seizeInReach, type GameEvent, type GameState, type Unit } from '../core';
import { TEMPLE_PLANS, type FactionId } from '../data/balance';
import { t } from '../i18n/i18n';
import { esc, toast, type ActionItem } from './components';
import { icon } from './icons';

/** Aktion fuer die gewaehlte Einheit, wenn Tempel oder Plaene in Reichweite sind / action for the selected unit when the temple or plans are in reach */
export function plansAction(s: GameState, u: Unit, err: (code: string) => string, run: () => void): ActionItem | null {
  if (!seizeInReach(s, u)) return null;
  const check = seizeCheck(s, u);
  const picked = s.campaign?.plans?.at === 'dropped';
  const desc = t('actions.seizePlansDesc');
  return {
    id: 'seizePlans', icon: 'book', variant: 'primary', label: t(picked ? 'actions.pickPlans' : 'actions.seizePlans'),
    enabled: check === 'ok', desc, reason: check === 'ok' ? desc : `${err(check)}. ${desc}`, run,
  };
}

/** Marke im Einheitenfeld des Traegers / tag in the carrier's unit panel */
export function plansUnitTag(s: GameState, u: Unit): string {
  if (!carriesPlans(s, u)) return '';
  return `<div class="row"><span class="tag ok" title="${esc(t('temple.carrierDesc'))}">${icon('book', 'icon-sm')}${esc(t('temple.carrier'))}</span></div>
    <p class="muted sheet-more">${esc(t('temple.carrierDesc'))}</p>`;
}

/** Feldfeld des Tempels (Kopf und Text) oder null / tile panel of the temple (head and body) or null */
export function templeSheet(s: GameState, x: number, y: number): { head: string; body: string } | null {
  if (!s.tiles[y * s.size + x]?.temple) return null;
  const inside = s.campaign?.plans?.at === 'temple';
  const head = `<span class="unit-badge">${icon('bell')}</span><div class="grow"><h3 class="display">${esc(t('temple.name'))}</h3>
    <div class="muted unit-sub">${esc(t('temple.sub'))} · ${esc(t('factions.vesper.short'))}</div></div>`;
  const body = `<div class="row"><span class="tag ${inside ? 'ok' : ''}">${icon('book', 'icon-sm')}${esc(t(inside ? 'temple.plansInside' : 'temple.plansGone'))}</span></div>
    <p class="muted sheet-more">${esc(t('temple.desc'))}</p>`;
  return { head, body };
}

/** Marke fuer fallen gelassene Plaene auf diesem Feld (Feldfeld) / tag for dropped plans on this tile (tile panel) */
export function droppedPlansTag(s: GameState, x: number, y: number): string | null {
  const p = s.campaign?.plans;
  return p?.at === 'dropped' && p.x === x && p.y === y ? `${t('temple.dropped')}: ${t('temple.droppedDesc')}` : null;
}

/** Zeile des Hauptziels im Ziel-Panel mit dem Zustand der Plaene / main objective line in the objective panel with the state of the plans */
export function plansPanelText(s: GameState, base: string): string {
  const p = s.campaign?.plans;
  if (!p) return base;
  const u = p.at === 'carried' ? s.units.find((x) => x.id === p.unit) : undefined;
  const state = p.at === 'carried' ? t('campaign.obj.plansCarried', { unit: u ? t(`units.${u.type}`) : '' })
    : t(p.at === 'dropped' ? 'campaign.obj.plansDropped' : p.at === 'delivered' ? 'campaign.obj.plansDelivered' : 'campaign.obj.plansTemple');
  return `${base} (${state})`;
}

/** Hinweis des Spaehers in der Besprechung / the scout's briefing tip */
export const plansTip = () => t('campaign.plansTip', { n: TEMPLE_PLANS.pursuitEvery });

/** Hinweise bei Ereignissen der Kriegsplaene; beim Bergen spricht der Anfuehrer des Kults / toasts on war-plans events; on seizing the cult leader speaks */
export function plansToast(root: HTMLElement, s: GameState, e: Extract<GameEvent, { t: 'plans' }>, say: (f: FactionId, text: string) => void) {
  const key = { seized: 'plansSeized', picked: 'plansPicked', dropped: 'plansDropped', returned: 'plansReturned', delivered: 'plansDelivered' }[e.what];
  toast(root, t(`campaign.${key}`), e.what === 'dropped' || e.what === 'returned' ? 'warning' : 'book');
  const owner = s.campaign?.plans?.owner;
  const f = owner !== undefined ? s.factions[owner]?.id : undefined;
  if (e.what === 'seized' && f) say(f, t('campaign.plansLine'));
}
