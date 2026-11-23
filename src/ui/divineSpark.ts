/**
 * Goettlicher Funke (Alvenia) in der Oberflaeche: Werte und Marken im Einheitenfeld (Flaechenschaden, Reichweite mit
 * Mindestabstand, Nachladen, wehrlos im Nahkampf), die Aktion "Funken schleudern" mit Sperrgrund, die Zielauswahl mit
 * Reichweite und 2x2-Vorschau (eigene Einheiten als Warnung) und die Meldung fuer den Betrachter. Zahlen aus balance.ts
 * (SPARK, UNITS.divineSpark), Texte aus spark.* (DE und EN). Alles per Tippen bedienbar (Handy).
 * Divine Spark (Alvenia) in the UI: stats and tags in the unit panel (area damage, range with minimum distance, reload,
 * defenceless in close combat), the action "Hurl spark" with its lock reason, the targeting with reach and 2x2 preview
 * (own units as a warning) and the message for the viewer. Numbers from balance.ts (SPARK, UNITS.divineSpark), texts from
 * spark.* (DE and EN). Everything works by tapping (phone).
 */
import { SPARK, type UnitTypeId } from '../data/balance';
import { isSpark, sparkPreview, sparkReady, sparksOf, sparkWait, unitById, type GameEvent, type GameState, type Unit } from '../core';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { actionButton, esc, iconButton, type ActionItem } from './components';
import { icon } from './icons';

/** Platzhalter der Funken-Texte / placeholders of the spark texts */
export const sparkVars = () => ({ range: SPARK.range, min: SPARK.minRange, w: SPARK.area.w, h: SPARK.area.h, dmg: SPARK.damage, vdmg: SPARK.vehicleDamage, cd: SPARK.cooldown, spot: SPARK.spot, max: SPARK.max });

/** "schussbereit" oder "bereit in n Runden" / "ready to fire" or "ready in n rounds" */
export const sparkWaitText = (n: number) => (n <= 0 ? t('spark.ready') : n === 1 ? t('spark.wait1') : t('spark.wait', { n }));

/** Hat der Typ den Flaechenschuss? / does the type have the area shot? */
export const sparkType = (type: UnitTypeId): boolean => type === SPARK.unit;

/**
 * Werte im Einheitenfeld statt Angriff und Reichweite: Funke (Schaden, Flaeche) und Reichweite "2 bis 5".
 * Stats in the unit panel instead of attack and range: spark (damage, area) and range "2 to 5".
 */
export function sparkStats(): { attack: string; range: string } {
  const v = sparkVars();
  const tip = t('spark.statDesc', v), rtip = t('spark.rangeDesc', v);
  return {
    attack: `<span class="stat" title="${esc(tip)}" aria-label="${esc(tip)}">${icon('divineSpark', 'icon-sm')}${esc(t('spark.stat', v))}</span>`,
    range: `<span class="stat" title="${esc(rtip)}" aria-label="${esc(rtip)}">${icon('range', 'icon-sm')}${esc(t('stats.range'))} ${esc(t('spark.range', v))}</span>`,
  };
}

/**
 * Marken im Einheitenfeld: schussbereit oder Nachladen (nur Besitzer), wehrlos im Nahkampf, Anzahl im Feld.
 * Tags in the unit panel: ready or recharging (owner only), defenceless in close combat, number in the field.
 */
export function sparkTags(s: GameState, u: Unit, viewer: number): string {
  if (!isSpark(u)) return '';
  const tags: string[] = [];
  const mine = viewer < 0 || u.owner === viewer;
  if (mine) {
    const wait = sparkWait(s, u);
    const cd = t('spark.cooldownDesc', sparkVars());
    tags.push(wait > 0
      ? `<span class="tag muted" title="${esc(cd)}">${icon('hourglass', 'icon-sm')}${esc(t('spark.cooldownTag', { n: wait }))}</span>`
      : `<span class="tag" title="${esc(cd)}">${icon('divineSpark', 'icon-sm')}${esc(t('spark.readyTag'))}</span>`);
    tags.push(`<span class="tag" title="${esc(t('errors.sparkLimit'))}">${esc(t('spark.limitTag', { n: sparksOf(s, u.owner).length, max: SPARK.max }))}</span>`);
  }
  tags.push(`<span class="tag warn" title="${esc(t('spark.defencelessDesc'))}">${icon('warning', 'icon-sm')}${esc(t('spark.defenceless'))}</span>`);
  return `<div class="row">${tags.join('')}</div>`;
}

/**
 * Aktion "Funken schleudern": startet die Zielauswahl; gesperrt mit Grund (frisch, gezogen, erschoepft, laedt nach).
 * Action "Hurl spark": starts the targeting; locked with a reason (fresh, moved, exhausted, recharging).
 */
export function sparkActions(s: GameState, u: Unit, g: Controller, err: (code: string) => string): ActionItem[] {
  if (!isSpark(u)) return [];
  const chk = sparkReady(s, u);
  const v = sparkVars();
  const desc = t('abilities.divineSparkDesc');
  const reason = chk === 'ok' ? t('spark.pick', v) : chk === 'sparkCooldown' ? sparkWaitText(sparkWait(s, u)) : err(chk);
  return [{ id: 'divineSpark', icon: 'divineSpark', variant: 'danger', label: t('spark.action'), sub: chk === 'sparkCooldown' ? sparkWaitText(sparkWait(s, u)) : t('spark.actionSub', v),
    enabled: chk === 'ok', desc, reason, run: () => g.startSpark(u.id) }];
}

/**
 * Zielauswahl: Kopf, Statuszeile (Hinweis, Treffer, Warnung bei eigenen Einheiten, Sperrgrund), Feuern und Abbrechen.
 * Targeting: head, status line (hint, hits, warning for own units, lock reason), fire and cancel.
 */
export function sparkSheet(s: GameState, g: Controller, err: (code: string) => string): { html: string; actions: ActionItem[] } {
  const u = g.sparkUnit !== null ? unitById(s, g.sparkUnit) : undefined;
  const aim = g.sparkAim;
  const v = sparkVars();
  const pre = u && aim ? sparkPreview(s, u, aim.x, aim.y) : null;
  let status = t('spark.pick', v), cls = '';
  if (pre) {
    const own = pre.hits.filter((h) => h.own).length;
    const kills = pre.hits.filter((h) => h.killed && !h.own).length;
    if (pre.check === 'peace') { status = t('spark.blocked'); cls = 'warn'; }
    else if (pre.check === 'outOfRange') { status = t('spark.outOfRange', v); cls = 'warn'; }
    else if (pre.check !== 'ok') { status = err(pre.check); cls = 'warn'; }
    else {
      status = pre.hits.length ? t(pre.hits.length === 1 ? 'spark.hits1' : 'spark.hits', { n: pre.hits.length, kills }) : t('spark.noHits');
      if (own) { status += ` · ${t(own === 1 ? 'spark.own1' : 'spark.own', { n: own })}`; cls = 'warn'; }
      status += `. ${t('spark.confirm')}`;
    }
  }
  const ok = !!pre && pre.check === 'ok';
  const actions: ActionItem[] = [
    { id: 'sparkFire', icon: 'divineSpark', variant: 'danger', label: t('spark.fire'), enabled: ok, desc: t('abilities.divineSparkDesc'), reason: status, run: () => void g.fireSpark() },
    { id: 'sparkCancel', icon: 'close', label: t('actions.cancel'), enabled: true, run: () => g.cancelSpark() },
  ];
  const head = `<div class="sheet-head"><span class="unit-badge orbital-head">${icon('divineSpark')}</span><div class="grow"><h3 class="display">${esc(t('spark.title'))}</h3>
    <div class="muted unit-sub">${esc(t('stats.range'))} ${esc(t('spark.range', v))} · ${SPARK.area.w}×${SPARK.area.h} · -${SPARK.damage}/${SPARK.vehicleDamage}</div></div>${iconButton('close', t('actions.cancel'), 'sparkCancel')}</div>`;
  const body = `<p class="orbital-status ${cls}" role="status" aria-live="polite">${cls ? icon('warning', 'icon-sm') : icon('info', 'icon-sm')}<span>${esc(status)}</span></p>`;
  const bar = `<div class="action-wrap"><div class="action-bar" role="toolbar">${actions.map(actionButton).join('')}</div></div>`;
  return { html: `${head}${body}${bar}`, actions };
}

/**
 * Meldung fuer den Betrachter: Schuss eines Funkens, wenn er die Flaeche oder das Geschuetz sieht (eigene immer).
 * Message for the viewer: a spark's shot if they see the area or the gun (own ones always).
 */
export function sparkToast(e: GameEvent, s: GameState, viewer: number): { text: string; icon: string } | null {
  if (e.t !== 'divineSpark') return null;
  const seen = (x: number, y: number) => viewer < 0 || s.factions[viewer].explored[y * s.size + x] === 1;
  if (!(viewer < 0 || e.faction === viewer || seen(e.from.x, e.from.y) || e.tiles.some((p) => seen(p.x, p.y)))) return null;
  return { text: t('spark.toast', { name: t(`factions.${s.factions[e.faction].id}.short`) }), icon: 'divineSpark' };
}
