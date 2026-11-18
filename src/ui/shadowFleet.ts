/**
 * Oberflaeche der Schattenflotte (Meridon): Marken fuer Tarnung, Absetzen und Radar im Einheitenpanel, Aktionen fuer
 * Sabotage und Radarimpuls, Feldpanel des Raketensilos und die Zielauswahl mit Vorschau. Zahlen aus balance.ts (SILO, RADAR,
 * SABOTAGE, WITHDRAW, FIREPOWER), Texte aus shadow.* (DE und EN). Alles per Tippen bedienbar (Handy).
 * Shadow fleet UI (Meridon): tags for camouflage, withdrawal and radar in the unit panel, actions for sabotage and the
 * radar sweep, the rocket silo's tile panel and the targeting with preview. Numbers from balance.ts (SILO, RADAR, SABOTAGE,
 * WITHDRAW, FIREPOWER), texts from shadow.* (DE and EN). Everything works by tapping (phone).
 */
import {
  buildsSilos, radarContacts, type GameEvent,
  camouflaged, canWithdrawAfterAttack, firepowerFactor, has, radarCheck, radarWait, sabotageTargets, sabotageWait, siloPreview, siloWait, sweepOf, turretAt,
  type GameState, type Unit,
} from '../core';
import { RADAR, SABOTAGE, SILO, UNITS } from '../data/balance';
import type { Controller } from '../game/controller';
import { num, t } from '../i18n/i18n';
import { actionButton, esc, factionBadge, iconButton, progress, type ActionItem } from './components';
import { icon } from './icons';

/** Platzhalter der Silo-Texte / placeholders of the silo texts */
export const siloVars = () => ({ range: SILO.launchRange, dmg: SILO.damage, w: SILO.area.w, h: SILO.area.h, fire: SILO.fireRounds, burn: SILO.fireDamage, cd: SILO.cooldown });

/** "startbereit" oder "bereit in n Runden" / "ready to launch" or "ready in n rounds" */
export const siloWaitText = (n: number) => (n <= 0 ? t('shadow.silo.ready') : n === 1 ? t('shadow.silo.wait1') : t('shadow.silo.wait', { n }));

/**
 * Marken im Einheitenpanel: getarnt oder enttarnt (nur der Besitzer sieht den Zustand), Absetzen moeglich, Radar aktiv
 * oder in Pause, Sabotage in Pause, leichte Bewaffnung.
 * Tags in the unit panel: camouflaged or revealed (only the owner sees the state), withdrawal possible, radar active or
 * paused, sabotage paused, light armament.
 */
export function shadowTags(s: GameState, u: Unit, viewer: number): string {
  const tags: string[] = [];
  const mine = viewer < 0 || u.owner === viewer;
  if (has(u, 'camo') && mine) {
    tags.push(camouflaged(u)
      ? `<span class="tag" title="${esc(t('shadow.camo.hidden'))}">${icon('camo', 'icon-sm')}${esc(t('shadow.camo.tag'))}</span>`
      : `<span class="tag warn" title="${esc(t('shadow.camo.revealed'))}">${icon('eye', 'icon-sm')}${esc(t('shadow.camo.tagRevealed'))}</span>`);
  }
  if (mine && u.withdraw && u.attacked) tags.push(`<span class="tag" title="${esc(t('shadow.withdraw.desc'))}">${icon('withdraw', 'icon-sm')}${esc(t('shadow.withdraw.hint'))}</span>`);
  if (has(u, 'radar') && mine) {
    const until = sweepOf(s, u);
    if (until !== null) tags.push(`<span class="tag">${icon('radar', 'icon-sm')}${esc(t('shadow.radar.active', { n: until }))}</span>`);
    else if (radarWait(s, u) > 0) tags.push(`<span class="tag muted">${icon('hourglass', 'icon-sm')}${esc(t('shadow.radar.cooldown', { n: radarWait(s, u) }))}</span>`);
  }
  if (has(u, 'sabotage') && mine && sabotageWait(s, u) > 0) tags.push(`<span class="tag muted">${icon('hourglass', 'icon-sm')}${esc(t('shadow.sabotage.cooldown', { n: sabotageWait(s, u) }))}</span>`);
  const fp = firepowerFactor(s, u);
  if (fp < 1 && UNITS[u.type].attack > 0) tags.push(`<span class="tag warn" title="${esc(t('shadow.firepower.desc', { firepowerPct: Math.round((1 - fp) * 100) }))}">${esc(t('shadow.firepower.note', { firepowerPct: Math.round((1 - fp) * 100) }))}</span>`);
  return tags.length ? `<div class="row">${tags.join('')}</div>` : '';
}

/** Hinweis nach dem Angriff: Absetzen moeglich / hint after attacking: withdrawal possible */
export function withdrawHint(s: GameState, u: Unit): string | null {
  return u.withdraw && u.attacked ? t('shadow.withdraw.hint') : canWithdrawAfterAttack(s, u) && !u.attacked ? t('shadow.withdraw.desc') : null;
}

/**
 * Aktionen der Schattenflotte fuer die gewaehlte Einheit: Sabotage (Zielwahl auf der Karte) und Radarimpuls.
 * Shadow fleet actions for the selected unit: sabotage (target choice on the map) and radar sweep.
 */
export function shadowUnitActions(s: GameState, u: Unit, g: Controller, err: (code: string) => string, rerender: () => void): ActionItem[] {
  const out: ActionItem[] = [];
  if (has(u, 'sabotage')) {
    const targets = sabotageTargets(s, u);
    const wait = sabotageWait(s, u);
    const active = g.sabotageMode;
    const reason = active ? t('shadow.sabotage.hint') : wait > 0 ? t('shadow.sabotage.cooldown', { n: wait }) : u.exhausted || u.attacked || u.fresh ? err('unitExhausted') : targets.length ? t('shadow.sabotage.hint') : t('shadow.sabotage.none');
    out.push({ id: 'sabotage', icon: 'sabotage', variant: 'danger', label: active ? t('actions.cancel') : t('shadow.sabotage.action'), enabled: active || targets.length > 0,
      desc: t('abilities.sabotageDesc', { sabotageCooldown: SABOTAGE.cooldown }), reason,
      run: () => { if (g.sabotageMode) { g.sabotageMode = false; g.updateHighlights(); rerender(); } else { g.startSabotage(); g.ui.toast(t('shadow.sabotage.hint'), 'sabotage'); } } });
  }
  if (has(u, 'radar')) {
    const chk = radarCheck(s, u);
    const until = sweepOf(s, u);
    const reason = chk === 'ok' ? t('abilities.radarDesc', { radarRadius: RADAR.radius, radarRounds: RADAR.rounds, radarCooldown: RADAR.cooldown })
      : chk === 'radarCooldown' ? t('shadow.radar.cooldown', { n: radarWait(s, u) }) : err(chk);
    out.push({ id: 'radarSweep', icon: 'radar', variant: 'primary', label: t('shadow.radar.action'), sub: until !== null ? t('shadow.radar.active', { n: until }) : undefined, enabled: chk === 'ok',
      desc: t('abilities.radarDesc', { radarRadius: RADAR.radius, radarRounds: RADAR.rounds, radarCooldown: RADAR.cooldown }), reason,
      run: () => void g.exec({ type: 'radarSweep', unit: u.id }) });
  }
  return out;
}

/**
 * Feldpanel eines Raketensilos: Besitzer, Panzerung, Reichweite, Ladezustand; fuer das eigene Silo der Start.
 * Tile panel of a rocket silo: owner, armour, range, charge state; for the own silo the launch.
 */
export function siloTile(s: GameState, x: number, y: number, viewer: number, g: Controller): { head: string; body: string; actions: ActionItem[] } | null {
  const gun = turretAt(s, x, y);
  if (!gun || gun.kind !== 'silo' || gun.owner === undefined) return null;
  const of = gun.owner;
  const fid = s.factions[of].id;
  const wait = siloWait(s, x, y) ?? 0;
  const head = `${factionBadge(fid, 'silo')}<div class="grow"><h3 class="display">${esc(t('shadow.silo.name'))}</h3>
    <div class="muted unit-sub">${esc(t(`factions.${fid}.short`))} · ${esc(of === viewer || viewer < 0 ? siloWaitText(wait) : t('shadow.silo.every'))}</div></div>`;
  const hpText = t('verdan.hp', { hp: gun.hp, max: SILO.hp });
  const body = `<div class="row">${icon('shield', 'icon-sm')}<span>${esc(hpText)}</span><div class="grow">${progress(gun.hp, SILO.hp, 'hp', hpText)}</div></div>
    <div class="stats"><span class="stat">${icon('range', 'icon-sm')}${esc(t('stats.range'))} ${SILO.launchRange}</span>
    <span class="stat">${icon('missile', 'icon-sm')}-${SILO.damage} · ${SILO.area.w}×${SILO.area.h}</span>
    <span class="stat">${icon('fire', 'icon-sm')}${SILO.fireRounds} × -${SILO.fireDamage}</span>
    <span class="stat">${icon('shield', 'icon-sm')}${esc(t('stats.defense'))} ${num(SILO.defense)}</span></div>
    <p class="muted sheet-more">${esc(t('shadow.silo.desc', { name: t(`factions.${fid}.short`) }))}</p>`;
  const actions: ActionItem[] = [];
  if (g.isHumanTurn && of === s.current) {
    actions.push({ id: 'siloLaunch', icon: 'missile', variant: 'danger', label: t('shadow.silo.launch'), sub: wait > 0 ? siloWaitText(wait) : undefined, enabled: wait === 0,
      desc: t('shadow.silo.desc', { name: t(`factions.${fid}.short`) }), reason: wait > 0 ? siloWaitText(wait) : t('shadow.silo.pick', siloVars()),
      run: () => g.startSilo(x, y) });
  }
  return { head, body, actions };
}

/**
 * Zielauswahl des Silos: Kopf, Statuszeile (Hinweis, Treffer, Warnung bei eigenen Einheiten, Reichweite), Start und Abbrechen.
 * Silo targeting: head, status line (hint, hits, warning for own units, range), launch and cancel.
 */
export function siloSheet(s: GameState, g: Controller, err: (code: string) => string): { html: string; actions: ActionItem[] } {
  const from = g.siloFrom!;
  const aim = g.siloAim;
  const pre = aim ? siloPreview(s, s.current, from.x, from.y, aim.x, aim.y) : null;
  let status = t('shadow.silo.pick', siloVars()), cls = '';
  if (pre) {
    const own = pre.hits.filter((h) => h.own).length;
    const kills = pre.hits.filter((h) => h.killed && !h.own).length;
    if (pre.check === 'peace') { status = t('shadow.silo.blocked'); cls = 'warn'; }
    else if (pre.check === 'outOfRange') { status = t('shadow.silo.outOfRange', siloVars()); cls = 'warn'; }
    else if (pre.check !== 'ok') { status = err(pre.check); cls = 'warn'; }
    else {
      status = pre.hits.length ? t(pre.hits.length === 1 ? 'shadow.silo.hits1' : 'shadow.silo.hits', { n: pre.hits.length, kills }) : t('shadow.silo.noHits');
      if (own) { status += ` · ${t(own === 1 ? 'shadow.silo.own1' : 'shadow.silo.own', { n: own })}`; cls = 'warn'; }
      status += `. ${t('shadow.silo.confirm')}`;
    }
  }
  const ok = !!pre && pre.check === 'ok';
  const actions: ActionItem[] = [
    { id: 'siloFire', icon: 'missile', variant: 'danger', label: t('shadow.silo.fire'), enabled: ok, desc: t('shadow.silo.desc', { name: t(`factions.${s.factions[s.current].id}.short`) }), reason: status, run: () => void g.fireSilo() },
    { id: 'siloCancel', icon: 'close', label: t('actions.cancel'), enabled: true, run: () => g.cancelSilo() },
  ];
  const head = `<div class="sheet-head"><span class="unit-badge orbital-head">${icon('silo')}</span><div class="grow"><h3 class="display">${esc(t('shadow.silo.title'))}</h3>
    <div class="muted unit-sub">${esc(t('stats.range'))} ${SILO.launchRange} · ${SILO.area.w}×${SILO.area.h} · -${SILO.damage} · ${icon('fire', 'icon-sm')}${SILO.fireRounds} × -${SILO.fireDamage}</div></div>${iconButton('close', t('actions.cancel'), 'siloCancel')}</div>`;
  const body = `<p class="orbital-status ${cls}" role="status" aria-live="polite">${cls ? icon('warning', 'icon-sm') : icon('info', 'icon-sm')}<span>${esc(status)}</span></p>`;
  const bar = `<div class="action-wrap"><div class="action-bar" role="toolbar">${actions.map(actionButton).join('')}</div></div>`;
  return { html: `${head}${body}${bar}`, actions };
}

/**
 * Meldungen der Schattenflotte fuer den Betrachter: Raketenstart (wer den Einschlag sieht), Brand an eigenen Einheiten,
 * Sabotage (Opfer und Taeter), Radarimpuls mit Zahl der Kontakte, geschleiftes Silo. null = keine Meldung.
 * Shadow fleet messages for the viewer: rocket launch (whoever sees the impact), fire on own units, sabotage (victim and
 * saboteur), radar sweep with the number of contacts, razed silo. null = no message.
 */
export function shadowToast(e: GameEvent, s: GameState, viewer: number): { text: string; icon: string } | null {
  const fname = (i: number) => t(`factions.${s.factions[i].id}.short`);
  const seen = (x: number, y: number) => viewer < 0 || s.factions[viewer].explored[y * s.size + x] === 1;
  switch (e.t) {
    case 'siloLaunch':
      return viewer < 0 || e.faction === viewer || e.tiles.some((p) => seen(p.x, p.y)) ? { text: t('shadow.silo.toast', { name: fname(e.faction) }), icon: 'missile' } : null;
    case 'fireHit': {
      const own = e.hits.filter((h) => s.units.find((u) => u.id === h.unit)?.owner === viewer).length;
      return own ? { text: t('shadow.silo.fireHit', { own, dmg: SILO.fireDamage }), icon: 'fire' } : null;
    }
    case 'sabotage': {
      const what = e.what === 'building' && e.building ? t(`buildings.${e.building}`) : t(`shadow.sabotage.${e.what}`);
      if (e.victim === viewer) return { text: t('shadow.sabotage.victim', { name: fname(e.faction), what }), icon: 'sabotage' };
      return e.faction === viewer ? { text: t('shadow.sabotage.done', { what }), icon: 'sabotage' } : null;
    }
    case 'radarSweep': {
      if (e.faction !== viewer) return null;
      const n = radarContacts(s, viewer).filter((u) => Math.max(Math.abs(u.x - e.x), Math.abs(u.y - e.y)) <= e.radius).length;
      return { text: n === 0 ? t('shadow.radar.toast0') : n === 1 ? t('shadow.radar.toast1') : t('shadow.radar.toast', { n }), icon: 'radar' };
    }
    case 'emplacementLost':
      return e.faction === viewer && e.reason === 'territory' && buildsSilos(s, e.faction) ? { text: t('shadow.silo.lost'), icon: 'warning' } : null;
    default: return null;
  }
}
