/**
 * Fraktions-Siegbedingungen in der Oberflaeche: Texte, Wunder-Infofeld, Siegverfolgung, Spielende-Grund.
 * Faction victory conditions in the UI: texts, wonder info panel, victory tracker, game-over reason.
 */
import { MODES, SIN, UNITS, VICTORY_TECH, WONDERS, type FactionId, type WonderUnitId } from '../data/balance';
import {
  factionVictoryOn, isWonder, judgementNeed, korvatShareFor, meridonNeed, meridonNeedFor, score, victoryStatus, waalArmed, wonderPhases, type GameState, type Unit, type VictoryStatus, type Victory,
} from '../core';
import { has, t } from '../i18n/i18n';
import { dialogTitle, esc, factionChip, openDialog, progress } from './components';
import { icon } from './icons';
import { techT } from './terms';

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/**
 * Platzhalter fuer die Siegtexte einer Fraktion (alle Zahlen aus balance.ts). Ohne Spielstand (Auswahl, Fraktionsinfo):
 * Meridon zeigt das Ziel im Punktespiel (n) und ohne Rundenlimit (m).
 * Placeholders for a faction's victory texts (all numbers from balance.ts). Without a game state (setup, faction info):
 * Meridon shows the target in a points game (n) and without a round limit (m).
 */
export function victoryParams(f: FactionId, s?: GameState): Record<string, number> {
  const P = WONDERS.phases;
  switch (f) {
    case 'korvat': return { pct: Math.round((s ? korvatShareFor(s) : WONDERS.korvatShare) * 100) };
    case 'dravon': return { arm: P.waal[0], total: sum(P.waal), range: UNITS.waal.range };
    // Grosses Strafgericht: Ziel je Kartengroesse (ohne Spiel: mittlere Karte, dazu die Spanne) / Great Judgement: goal per map size (without a game: medium map, plus the range)
    case 'alvenia': return { n: s ? judgementNeed(s) : WONDERS.judgementKills[14], min: WONDERS.judgementKills[11], max: WONDERS.judgementKills[26], pct: Math.round(SIN.judgement * 100), rounds: SIN.rounds };
    case 'meridon': return { n: s ? meridonNeed(s) : meridonNeedFor(MODES.pointsRounds), m: WONDERS.meridonStars };
    case 'velkar': return { n: sum(P.fusionPlant) };
    case 'zyrr': return { build: P.portal[0], charge: P.portal[1] };
    case 'vesper': return { n: WONDERS.drillRounds };
    case 'nexus': return { build: P.hackRelay[0], hack: P.hackRelay[1] };
  }
}

/** Textschluessel: ohne Spielstand die allgemeine Fassung, falls vorhanden / text key: without a game state the general version, if any */
const goalKey = (group: string, f: FactionId, s?: GameState) => (!s && has(`victory.${group}.${f}Any`) ? `victory.${group}.${f}Any` : `victory.${group}.${f}`);
/** Langtext der Siegbedingung / long text of the victory condition */
export const victoryGoalText = (f: FactionId, s?: GameState) => t(goalKey('goal', f, s), victoryParams(f, s));
/** Kurzname der Siegbedingung / short name of the victory condition */
export const victoryShortText = (f: FactionId, s?: GameState) => t(goalKey('short', f, s), victoryParams(f, s));

/** Phase als Text, z. B. "Aufladen 5/8" / phase as text, e.g. "Charging 5/8" */
export function phaseText(st: VictoryStatus): string {
  return t(`victory.phase.${st.phase}`, { have: st.have, need: st.need });
}

/** Regel zur Unterbrechung eines Wunders / interruption rule of a wonder */
export function wonderRule(type: WonderUnitId): string {
  if (type === 'coreDrill') return t('victory.ruleDrill');
  const rule = !WONDERS.interruptible[type] ? t('victory.ruleNoInterrupt') : wonderPhases(type).length > 1 ? t('victory.ruleInterrupt') : t('victory.ruleReset');
  return type === 'waal' ? `${rule} ${t('victory.ruleWaal', { r: UNITS.waal.range })}` : rule;
}

/** Infofeld fuer ein Wunder im Einheitenfenster / info block for a wonder in the unit panel */
export function wonderPanel(s: GameState, u: Unit): string {
  if (!isWonder(u)) return '';
  const st = victoryStatus(s, u.owner);
  const type = u.type as WonderUnitId;
  const phases = wonderPhases(type);
  const stage = type === 'coreDrill' ? 0 : Math.min(u.wonder?.stage ?? 0, phases.length - 1);
  const left = st.unit === u.id && st.roundsLeft !== null ? st.roundsLeft : null;
  const armed = type === 'waal' && waalArmed(u);
  const paused = st.unit === u.id && st.paused;
  return `<div class="wonder-info" role="group" aria-label="${esc(t('victory.unitTitle'))}">
    <div class="row">${icon('trophy', 'icon-sm')}<strong>${esc(phaseText(st))}</strong>
      <span class="tag">${esc(t('victory.stage', { n: stage + 1, max: phases.length }))}</span>
      ${paused ? `<span class="tag warn">${icon('warning', 'icon-sm')}${esc(t('victory.paused'))}</span>` : ''}
      ${left !== null ? `<span class="tag ${left <= 3 ? 'warn' : ''}">${esc(t('victory.roundsTotal', { n: left }))}</span>` : ''}
      ${armed ? `<span class="tag warn">${icon('attack', 'icon-sm')}${esc(t('victory.armed'))}</span>` : ''}</div>
    ${progress(st.have, st.need, '', phaseText(st))}
    <p class="muted">${esc(wonderRule(type))}</p>
  </div>`;
}

/** Spielende: Grund des Sieges / game over: reason of the victory */
export function victoryReasonHtml(v: Victory | undefined): string {
  if (!v) return '';
  const kind = v.kind === 'faction' ? t('victory.kindFaction') : v.kind === 'points' ? t('victory.kindPoints') : t('victory.kindConquest');
  const reason = v.kind === 'faction' ? `<p class="display victory-reason">${esc(t(`victory.reason.${v.faction}`))}</p>` : '';
  return `<p class="row center"><span class="tag ok">${icon('crown', 'icon-sm')}${esc(kind)}</span></p>${reason}`;
}

/** Zeile der Siegverfolgung fuer eine Fraktion / victory tracker row for one faction */
function trackerRow(s: GameState, viewer: number, g: number): string {
  const fa = s.factions[g];
  const name = t(`factions.${fa.id}.short`);
  const known = viewer < 0 || g === viewer || s.factions[viewer].contacts.includes(g);
  const head = `${factionChip(fa.id, name)}<div class="grow col"><strong>${esc(name)}${g === viewer ? ` (${esc(t('victory.you'))})` : ''}</strong>`;
  if (!known) return `<div class="score-row">${head}<span class="muted">${esc(t('victory.unknown'))}</span></div></div>`;
  const goal = `<span class="muted">${esc(victoryShortText(fa.id, s))}</span>`;
  if (!fa.alive) return `<div class="score-row">${head}${goal}</div><span class="tag">${esc(t('victory.eliminated'))}</span></div>`;
  const st = victoryStatus(s, g);
  let state: string;
  // fehlende Siegtechnologie beim Namen nennen / name the missing victory tech
  if (!st.tech) state = `<span class="muted">${esc(techT('victory.noTech', fa.id))}</span><span class="tag">${icon('lock', 'icon-sm')}${esc(t('hud.needsTech', { tech: t(`techs.${VICTORY_TECH[fa.id]}`) }))}</span>`;
  else {
    const left = st.roundsLeft !== null && st.phase !== 'none' ? ` · ${t('victory.roundsLeft', { n: st.roundsLeft })}` : '';
    const note = st.paused ? ` · ${t('victory.paused')}` : '';
    state = `<span>${esc(phaseText(st) + left + note)}</span>${progress(st.ratio, 1, st.ratio >= 0.75 ? 'hp low' : '', phaseText(st))}`;
  }
  return `<div class="score-row">${head}${goal}${state}</div>${st.tech && st.ratio >= 0.75 ? `<span class="tag warn">${icon('warning', 'icon-sm')}</span>` : ''}</div>`;
}

/** Platz einer Fraktion nach Punkten (1 = vorn) / rank of a faction by points (1 = first) */
export function pointsRank(s: GameState, f: number): number {
  const mine = score(s, f);
  return 1 + s.factions.filter((o) => o.index !== f && o.alive && score(s, o.index) > mine).length;
}

/** Zeile zum Spielmodus: Punkte mit Runde und Platz oder Eroberung / game-mode row: points with round and rank, or conquest */
function modeRow(s: GameState, viewer: number): string {
  const mode = s.config.campaign ? null : s.config.mode;
  if (!mode) return '';
  const me = viewer >= 0 ? viewer : s.current;
  const limit = s.config.roundLimit;
  const line = mode === 'points' && limit
    ? t('victory.modePoints', { round: Math.min(s.round, limit), max: limit, rank: pointsRank(s, me) })
    : t(`modes.${mode}Desc`, { rounds: limit ?? '' });
  return `<div class="score-row mode-row">${icon(mode === 'points' ? 'medal' : 'capture')}<div class="grow col">
    <strong>${esc(t('victory.modeTitle'))}: ${esc(t(`modes.${mode}`))}</strong><span>${esc(line)}</span></div></div>`;
}

/** Siegverfolgung: Fortschritt aller bekannten Fraktionen / victory tracker: progress of all known factions */
export function victoryTrackerDialog(root: HTMLElement, s: GameState, viewer: number) {
  const body = factionVictoryOn(s)
    ? `<p class="muted">${esc(t('victory.hint'))}</p><div class="score-list victory-list">${s.factions.map((f) => trackerRow(s, viewer, f.index)).join('')}</div>`
    : `<p class="muted">${esc(t('victory.off'))}</p>`;
  const d = openDialog(root, `${dialogTitle(t('victory.title'))}<div class="score-list victory-list">${modeRow(s, viewer)}</div>${body}`);
  d.node.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-action="close"]')) d.close(); });
}
