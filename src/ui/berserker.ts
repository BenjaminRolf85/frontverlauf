/**
 * Berserker des Kults im Einheitenfeld: feste Schlagkraft, verbleibende Hiebe, keine Verteidigung und die Aktion
 * "Sprengen" mit Zielwahl auf der Karte und Schadensvorschau. Zahlen aus balance.ts (UNITS.berserker, BERSERKER, TWIN_STRIKE).
 * The cult's berserker in the unit panel: fixed striking power, blows left, no defence and the "Detonate" action with
 * target choice on the map and a damage preview. Numbers from balance.ts (UNITS.berserker, BERSERKER, TWIN_STRIKE).
 */
import { BERSERKER, TWIN_STRIKE, UNITS, type UnitTypeId } from '../data/balance';
import { detonateCheck, detonateDamage, detonateTargets, has, strikesLeft, unitById, type GameState, type Unit } from '../core';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { esc, type ActionItem } from './components';
import { icon } from './icons';

/** Werte der festen Schlagkraft fuer Texte / values of the fixed striking power for texts */
export function strikeVars(type: UnitTypeId): { foot: number; armour: number; other: number } | null {
  const st = UNITS[type].strike;
  return st ? { foot: st.foot, armour: st.armour, other: st.other } : null;
}

/** Konter-Marken der festen Schlagkraft (stark gegen Fusstruppen, schwach gegen Panzerung) / counter tags of the fixed striking power */
export function strikeTags(type: UnitTypeId): { text: string; good: boolean }[] {
  const v = strikeVars(type);
  if (!v) return [];
  return [{ text: t('berserker.vsFoot', { n: v.foot }), good: true }, { text: t('berserker.vsArmour', { n: v.armour }), good: false }];
}

/**
 * Werte im Einheitenfeld: Schlagkraft statt Angriff, Hiebe dieses Zugs, keine Verteidigung (als Warnung).
 * Stats in the unit panel: striking power instead of attack, blows this turn, no defence (as a warning).
 */
export function berserkerStats(s: GameState, u: Unit): string {
  const v = strikeVars(u.type);
  if (!v) return '';
  const tip = t('berserker.strikeStatDesc', v);
  let out = `<span class="stat" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('sword', 'icon-sm')}${esc(t('berserker.strikeStat', v))}</span>`;
  if (has(u, 'twinStrike') && u.owner === s.current) {
    const left = strikesLeft(u);
    out += `<span class="stat ${left > 0 && left < TWIN_STRIKE.strikes ? 'tag' : ''}" title="${esc(t('berserker.strikesDesc'))}">${icon('roleBerserker', 'icon-sm')}${esc(t('berserker.strikes', { n: left, max: TWIN_STRIKE.strikes }))}</span>`;
  }
  if (UNITS[u.type].defense <= 0) out += `<span class="stat tag warn" title="${esc(t('berserker.noDefenseDesc'))}">${icon('warning', 'icon-sm')}${esc(t('berserker.noDefense'))}</span>`;
  return out;
}

/**
 * Aktionen des Berserkers: Sprengen am angewaehlten Ziel (mit Vorschau) oder Zielwahl auf der Karte.
 * Berserker actions: detonate at the selected target (with preview) or target choice on the map.
 */
export function berserkerActions(s: GameState, u: Unit, g: Controller, err: (code: string) => string, rerender: () => void): ActionItem[] {
  if (!has(u, 'detonate')) return [];
  const out: ActionItem[] = [];
  const target = g.pendingTarget !== null ? unitById(s, g.pendingTarget) : undefined;
  // angewaehltes Ziel: Sprengen mit genauer Vorschau / selected target: detonate with an exact preview
  if (target && detonateCheck(s, u, target) === 'ok') {
    const dmg = detonateDamage(s, target);
    const kill = dmg >= target.hp;
    const desc = t('berserker.desc', { dmg });
    out.push({ id: 'detonate', icon: 'roleKamikaze', variant: 'danger', enabled: true, label: t('berserker.action'),
      sub: kill ? t('berserker.actionKill') : t('berserker.actionSub', { dmg }), desc, reason: desc,
      run: () => void g.exec({ type: 'detonate', unit: u.id, target: target.id }) });
    return out;
  }
  const targets = detonateTargets(s, u);
  const active = g.detonateMode;
  const pick = t('berserker.pick', { blastArmour: BERSERKER.detonate.armour, blastOther: BERSERKER.detonate.other });
  const reason = active ? pick : strikesLeft(u) <= 0 ? err('unitExhausted') : targets.length ? pick : t('berserker.none');
  const best = targets.reduce((m, o) => Math.max(m, detonateDamage(s, o)), 0);
  out.push({ id: 'detonate', icon: 'roleKamikaze', variant: 'danger', label: active ? t('actions.cancel') : t('berserker.action'),
    sub: !active && best ? t('berserker.actionSub', { dmg: best }) : undefined, enabled: active || targets.length > 0,
    desc: t('abilities.detonateDesc'), reason,
    run: () => { if (g.detonateMode) { g.detonateMode = false; g.updateHighlights(); rerender(); } else { g.startDetonate(); g.ui.toast(pick, 'roleKamikaze'); } } });
  return out;
}
