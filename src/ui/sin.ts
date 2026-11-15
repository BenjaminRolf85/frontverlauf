/**
 * Heiliges Alvenia: Suendenzeichen als Marke (Einheitenfeld, Diplomatie, Siegverfolgung).
 * Holy Alvenia: sinner mark as a tag (unit panel, diplomacy, victory tracker).
 */
import { SIN } from '../data/balance';
import { judgeAlive, sinDeed, sinRoundsLeft, type GameState } from '../core';
import { t } from '../i18n/i18n';
import { esc } from './components';
import { icon } from './icons';

/**
 * Marke: Fraktion als Suender gezeichnet (Tat, verbleibende Runden, Strafgericht) / tag: faction marked as a sinner (deed, rounds left, judgement)
 */
export function sinTag(s: GameState, f: number): string {
  const deed = sinDeed(s, f);
  // nur, solange eine richtende Fraktion lebt / only while a judging faction lives
  if (!deed || !judgeAlive(s)) return '';
  const tip = t('sin.tagDesc', { deed: t(`sin.deed.${deed}`), n: sinRoundsLeft(s, f), pct: Math.round(SIN.judgement * 100) });
  return `<span class="stat tag sin" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('sin', 'icon-sm')}${esc(t('sin.tag'))}: ${esc(t(`sin.deed.${deed}`))} · ${esc(t('sin.rounds', { n: sinRoundsLeft(s, f) }))}</span>`;
}

