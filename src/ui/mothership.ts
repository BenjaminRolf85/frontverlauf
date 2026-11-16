/**
 * Oberflaeche der Kampagne m2 (Das Mutterschiff, alle gegen alle): Knopf "Am Schiff arbeiten" fuer den Wissenschaftler,
 * Feldpanel des Wracks mit dem Wettlauf aller Fraktionen, Wettlauf-Liste fuer das Ziel-Panel, Hinweise nach jeder
 * Arbeitsrunde und die Schlagzeile, wenn die Waffenruhe bricht. Texte aus mothership.* (DE und EN), Zahlen aus M2.
 * UI of campaign m2 (The Mothership, free-for-all): "Work on the ship" button for the scientist, tile panel of the wreck
 * with every faction's race, race list for the objective panel, toasts after every work round and the headline when the
 * truce breaks. Texts from mothership.* (DE and EN), numbers from M2.
 */
import { isSampler, raceOf, raceStandings, shipWork, workCheck, type GameEvent, type GameState, type Unit } from '../core';
import { M2 } from '../data/balance';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { esc, progress, toast, type ActionItem } from './components';
import { showHeadline } from './events';
import { icon } from './icons';

/** Platzhalter der Texte (Fraktion f, Standard der Spieler) / text placeholders (faction f, default the player) */
const vars = (s: GameState, f = 0) => ({ ...shipWork(s, f), share: Math.round(M2.hpShare * 100), cover: M2.hullCover });
/** Kurzname einer Fraktion / short name of a faction */
const fname = (s: GameState, f: number) => t(`factions.${s.factions[f].id}.short`);

/** Grund, warum der Wissenschaftler gerade nicht arbeiten kann / reason why the scientist cannot work right now */
function reason(code: string, err: (c: string) => string): string {
  if (code === 'outOfRange') return t('mothership.notAdjacent');
  if (code === 'unitExhausted') return t('mothership.done');
  return err(code);
}

/**
 * Aktion "Am Schiff arbeiten" (nur fuer den Wissenschaftler seiner Fraktion in einer Partie mit Mutterschiff), sonst null.
 * Action "Work on the ship" (only for its faction's scientist in a game with a mothership), otherwise null.
 */
export function workAction(s: GameState, u: Unit, g: Controller, err: (c: string) => string): ActionItem | null {
  if (!s.campaign?.ship || !isSampler(s, u)) return null;
  const chk = workCheck(s, u);
  const v = vars(s, u.owner);
  // in der Waffenruhe warnt der Knopf: die erste Probe bricht sie / during the truce the button warns: the first sample breaks it
  const desc = `${t('mothership.workDesc', v)}${raceOf(s)?.truce ? ` ${t('mothership.workTruce')}` : ''}`;
  return {
    id: 'workShip', icon: 'research', variant: 'primary', label: t('mothership.work'), sub: t('mothership.progress', v), enabled: chk === 'ok',
    desc, reason: chk === 'ok' ? desc : `${reason(chk, err)} ${desc}`,
    run: () => void g.exec({ type: 'workShip', unit: u.id }),
  };
}

/** Zeile zum Stand der Waffenruhe / line about the state of the truce */
export function truceLine(s: GameState): string {
  const r = raceOf(s);
  if (!r) return '';
  return r.truce ? t('mothership.truce') : t('mothership.war', { name: r.opener !== null ? fname(s, r.opener) : '', round: r.round ?? s.round });
}

/**
 * Wettlauf als Liste: je Fraktion Farbmarke, Name, Balken und Stand (gefallen, unterwegs); die eigene Zeile hervorgehoben.
 * Race as a list: per faction a colour mark, name, bar and state (fallen, on the way); the own row highlighted.
 */
export function raceList(s: GameState, viewer = 0): string {
  const need = M2.workRounds;
  const rows = raceStandings(s).map((e) => {
    const id = s.factions[e.faction].id;
    const name = fname(s, e.faction);
    const state = !e.alive && !e.pending ? t('mothership.fallen') : e.pending ? t('mothership.coming') : `${Math.min(e.work, need)}/${need}`;
    const label = t('mothership.raceRow', { name, have: Math.min(e.work, need), need });
    return `<li class="race-row ${e.faction === viewer ? 'own' : ''} ${!e.alive && !e.pending ? 'fallen' : ''}" style="--race-color:var(--faction-${id}-primary)">
      <span class="race-mark" aria-hidden="true"></span><span class="race-name">${esc(name)}</span>
      ${progress(Math.min(e.work, need), need, 'race-bar', label)}<span class="race-state">${esc(state)}</span></li>`;
  }).join('');
  return `<ul class="race-list" aria-label="${esc(t('mothership.race'))}">${rows}</ul>`;
}

/** Feldpanel des Wracks: Name, Lage, Wettlauf, Waffenruhe, Beschreibung / tile panel of the wreck: name, state, race, truce, description */
export function shipSheet(s: GameState, viewer = 0): { head: string; body: string } {
  const v = vars(s, Math.max(0, viewer));
  const head = `<span class="unit-badge">${icon('research')}</span><div class="grow"><h3 class="display">${esc(t('mothership.name'))}</h3>
    <div class="muted unit-sub">${esc(t('mothership.sub'))}</div></div>`;
  const race = raceOf(s)
    ? `<p class="race-truce ${raceOf(s)!.truce ? '' : 'war'}">${icon(raceOf(s)!.truce ? 'diplomacy' : 'warning', 'icon-sm')}<span>${esc(truceLine(s))}</span></p>${raceList(s, viewer)}`
    : `<div class="row">${icon('research', 'icon-sm')}<span>${esc(t('mothership.progress', v))}</span><div class="grow">${progress(v.have, v.need, '', t('mothership.progress', v))}</div></div>`;
  const body = `${race}<p class="muted sheet-more">${esc(t('mothership.tileDesc', v))}</p>`;
  return { head, body };
}

/**
 * Hinweis nach einer Arbeitsrunde: eigene Arbeit immer, fremde nur kurz vor dem Ziel (M2.raceWarn) oder am Ziel.
 * Toast after a work round: own work always, foreign work only close to the goal (M2.raceWarn) or at the goal.
 */
export function shipWorkToast(root: HTMLElement, s: GameState, e: Extract<GameEvent, { t: 'shipWork' }>, viewer = 0) {
  const f = e.faction ?? 0;
  if (f === viewer || viewer < 0) {
    toast(root, t(e.have >= e.need ? 'mothership.toastDone' : 'mothership.toast', { have: e.have, need: e.need }), 'research');
    return;
  }
  const left = e.need - e.have;
  if (left <= 0) toast(root, t('mothership.rivalDone', { name: fname(s, f) }), 'warning');
  else if (left <= M2.raceWarn) toast(root, t('mothership.rivalToast', { name: fname(s, f), left, have: e.have, need: e.need }), 'warning');
}

/**
 * Schlagzeile: die Waffenruhe ist gebrochen, wer die erste Probe genommen hat; der eigene Bruch klingt anders.
 * Headline: the truce is broken, who took the first sample; the own break reads differently.
 */
export function truceHeadline(root: HTMLElement, s: GameState, e: Extract<GameEvent, { t: 'truceBroken' }>, viewer = 0) {
  const own = e.faction === viewer;
  showHeadline(root, {
    kicker: t('mothership.truceKicker'), round: e.round, icon: 'warning', bad: !own,
    title: t('mothership.truceTitle'), body: t(own ? 'mothership.truceBodyOwn' : 'mothership.truceBody', { name: fname(s, e.faction) }),
    sound: 'alarm', ms: 6500,
  });
}
