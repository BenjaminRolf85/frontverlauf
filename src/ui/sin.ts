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
  // gottlos: dauerhaft statt Restrunden / godless: permanent instead of rounds left
  const n = sinRoundsLeft(s, f);
  const left = Number.isFinite(n) ? t('sin.rounds', { n }) : t('sin.permanent');
  const tip = t(Number.isFinite(n) ? 'sin.tagDesc' : 'sin.tagDescGodless', { deed: t(`sin.deed.${deed}`), n, pct: Math.round(SIN.judgement * 100) });
  return `<span class="stat tag sin" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('sin', 'icon-sm')}${esc(t('sin.tag'))}: ${esc(t(`sin.deed.${deed}`))} · ${esc(left)}</span>`;
}

