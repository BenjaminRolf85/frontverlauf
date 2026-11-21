/**
 * Oberflaeche der schwebenden Akademie (Velkar, ACADEMY): Kopf und Werte im Stadtfeld (Zustand, Schild, Ausbildung,
 * Posten, Beamer), Aktionen Abheben, Ziehen, Landen, Schutzschild und Beamer, Einheiten-Aktionen Beamen und Akademie
 * angreifen, Meldungen. Zahlen aus ACADEMY, Texte aus academy.* und beam.* (DE und EN).
 * UI of the floating academy (Velkar, ACADEMY): head and values in the city panel (state, shield, training, posts,
 * beamer), actions lift off, move, land, shield and beamer, unit actions beam and attack academy, toasts. Numbers from
 * ACADEMY, texts from academy.* and beam.* (DE and EN).
 */
import {
  academyAttackCheck, academyAttackPreview, academyBusy, academyMoves, academyOf, beamCheck, beamerCheck, cityById, cityIncome, landCheck, liftCheck,
  postsOf, shieldCheck, shieldHp, trainSlots, trainedNow, unitLimit, supportedUnits, type City, type GameEvent, type GameState, type Unit,
} from '../core';
import { ACADEMY } from '../data/balance';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { cityNameOf } from '../i18n/cityNames';
import { esc, factionBadge, progress, type ActionItem } from './components';
import { icon } from './icons';

const cname = (s: GameState, id: number) => (cityById(s, id) ? cityNameOf(s, id) : '');

/** Zustandszeile der Akademie / state line of the academy */
export function academyState(s: GameState, c: City): string {
  if (c.air?.phase === 'lifting') return t('academy.lifting');
  if (c.air) return c.air.steps <= 0 ? t('academy.flyingDone') : c.air.steps === 1 ? t('academy.flying1') : t('academy.flying', { n: c.air.steps });
  if (academyBusy(s, c)) return t('academy.calm');
  return t('academy.grounded');
}

/** Schildzeile mit Balken (oder "kein Schild" und Wartezeit) / shield line with a bar (or "no shield" and the wait) */
export function shieldLine(s: GameState, c: City): string {
  const hp = shieldHp(c);
  if (hp > 0) {
    const txt = t('academy.shieldHp', { hp, max: c.shield!.max });
    return `<div class="row academy-shield">${icon('shield', 'icon-sm')}<span>${esc(txt)}</span><div class="grow">${progress(hp, c.shield!.max, 'shield', txt)}</div></div>`;
  }
  const wait = c.shieldReady !== undefined ? c.shieldReady - s.round : 0;
  return `<div class="row academy-shield muted">${icon('shield', 'icon-sm')}<span>${esc(wait > 0 ? t('academy.shieldWait', { n: wait }) : t('academy.noShield'))}</span></div>`;
}

/**
 * Kopf und Werte fuer Akademie und Posten (fuer alle Betrachter; Gegner sehen Zustand und Schild).
 * Head and values for academy and post (for every viewer; opponents see state and shield).
 */
export function academySheet(s: GameState, c: City): { head: string; body: string } {
  const fid = s.factions[c.owner!].id;
  const name = cname(s, c.id);
  const sub = (kind: string, extra = '') => `<div class="muted unit-sub">${esc(kind)}${extra} · ${esc(t(`factions.${fid}.short`))}</div>`;
  if (c.post) {
    const ac = academyOf(s, c.owner!);
    const head = `${factionBadge(fid, 'researchPost')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>${sub(t('academy.post'), c.base ? ` · ${t(`bases.name.${c.base}`)}` : '')}</div>`;
    const relay = c.relay ? `<span class="tag">${icon('beam', 'icon-sm')}${esc(t('beam.built'))}</span>` : '';
    const arriving = (s.transit ?? []).filter((b) => b.relay === c.id).length;
    const body = `<div class="row"><span class="stat">${icon('star', 'icon-sm')}${esc(t('hud.income'))} +${cityIncome(s, c)}</span>${relay}${arriving ? `<span class="tag">${esc(t('beam.pending', { n: arriving }))}</span>` : ''}</div>
      <p class="muted">${esc(t('academy.postDesc'))}${ac ? ` ${esc(t('academy.postOf', { city: cname(s, ac.id) }))}` : ''}</p>`;
    return { head, body };
  }
  const head = `${factionBadge(fid, 'academy')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>${sub(t('academy.name'), ` · ${t('hud.level', { n: c.level })}`)}</div>`;
  const posts = postsOf(s, c.owner!).length;
  const transit = (s.transit ?? []).filter((b) => b.unit.owner === c.owner).length;
  const state = academyState(s, c);
  const air = !!c.air;
  const body = `<div class="row academy-state ${air ? 'airborne' : ''}">${icon(air ? 'liftOff' : 'academy', 'icon-sm')}<strong>${esc(state)}</strong></div>
    ${shieldLine(s, c)}
    <div class="stats sheet-more"><span class="stat">${icon('helmet', 'icon-sm')}${esc(t('hud.units', { n: supportedUnits(s, c), max: unitLimit(s, c) }))}</span>
      <span class="stat">${icon('train', 'icon-sm')}${esc(t('academy.slots', { n: trainedNow(s, c), max: trainSlots(s, c) }))}</span>
      <span class="stat">${icon('researchPost', 'icon-sm')}${esc(t('academy.posts', { n: posts }))}</span>
      ${transit ? `<span class="stat">${icon('beam', 'icon-sm')}${esc(t('academy.transit', { n: transit }))}</span>` : ''}</div>
    <p class="muted sheet-more">${esc(t('academy.desc'))} ${esc(t('academy.airRule'))}</p>`;
  return { head, body };
}

/** Aktionen der eigenen Akademie / actions of the own academy */
export function academyActions(s: GameState, g: Controller, c: City, err: (code: string) => string): ActionItem[] {
  const out: ActionItem[] = [];
  const f = c.owner!;
  if (!c.air) {
    const chk = liftCheck(s, f, c);
    out.push({ id: 'academy-lift', icon: 'liftOff', label: t('academy.lift'), variant: 'primary', enabled: chk === 'ok', desc: t('academy.liftDesc'),
      reason: chk === 'ok' ? t('academy.liftDesc') : err(chk), run: () => void g.exec({ type: 'liftAcademy', city: c.id }) });
  } else {
    const moves = academyMoves(s, c);
    const active = g.academyMoveCity === c.id;
    const moveReason = c.air.phase === 'lifting' ? err('lifting') : c.air.steps <= 0 ? err('noSteps') : t('academy.moveDesc', { n: c.air.steps });
    out.push({ id: 'academy-move', icon: 'move', label: active ? t('actions.cancel') : t('academy.move'), variant: 'primary', enabled: active || moves.length > 0,
      desc: t('academy.moveDesc', { n: c.air.steps }), reason: moveReason, run: () => g.toggleAcademyMove(c.id) });
    const chk = landCheck(s, f, c);
    out.push({ id: 'academy-land', icon: 'land', label: t('academy.land'), variant: 'primary', enabled: chk === 'ok', desc: t('academy.landDesc'),
      reason: chk === 'ok' ? t('academy.landDesc') : err(chk), run: () => void g.exec({ type: 'landAcademy', city: c.id }) });
  }
  const sh = shieldCheck(s, f, c);
  if (sh !== 'alreadyBuilt') {
    const wait = c.shieldReady !== undefined && c.shieldReady > s.round && !academyBusy(s, c);
    out.push({ id: 'academy-shield', icon: 'shield', label: t('academy.shield'), cost: ACADEMY.shield.cost, variant: 'primary', enabled: sh === 'ok', desc: t('academy.shieldDesc'),
      reason: sh === 'ok' ? t('academy.shieldDesc') : wait ? t('academy.shieldWait', { n: c.shieldReady! - s.round }) : err(sh), run: () => void g.exec({ type: 'academyShield', city: c.id }) });
  }
  return out;
}

/** Aktion des eigenen Postens: Beamer bauen / action of the own post: build the beamer */
export function postActions(s: GameState, g: Controller, c: City, err: (code: string) => string): ActionItem[] {
  if (c.relay) return [];
  const chk = beamerCheck(s, c.owner!, c);
  if (chk === 'invalidTarget') return [];
  return [{ id: 'beam-build', icon: 'beam', label: t('beam.build'), cost: ACADEMY.beamer.cost, variant: 'primary', enabled: chk === 'ok', desc: t('beam.buildDesc'),
    reason: chk === 'ok' ? t('beam.buildDesc') : err(chk), run: () => void g.exec({ type: 'buildBeamer', city: c.id }) }];
}

/**
 * Einheiten-Aktionen: zu jedem eigenen Relay beamen (gesperrt mit Grund) und die angewaehlte feindliche Akademie angreifen.
 * Unit actions: beam to every own relay (locked with a reason) and attack the selected hostile academy.
 */
export function unitAcademyActions(s: GameState, g: Controller, u: Unit, err: (code: string) => string): ActionItem[] {
  const out: ActionItem[] = [];
  const ac = academyOf(s, u.owner);
  if (ac) {
    for (const c of s.cities) {
      if (!c.relay || c.owner !== u.owner) continue;
      const chk = beamCheck(s, u, c);
      if (chk === 'notAtAcademy' || chk === 'invalid') continue;
      const city = cname(s, c.id);
      out.push({ id: `beam-${c.id}`, icon: 'beam', label: t('beam.action', { city }), enabled: chk === 'ok', desc: t('beam.actionDesc', { city }),
        reason: chk === 'ok' ? t('beam.actionDesc', { city }) : err(chk), run: () => void g.exec({ type: 'beam', unit: u.id, city: c.id }) });
    }
  }
  const target = g.pendingAcademy !== null ? cityById(s, g.pendingAcademy) : undefined;
  if (target && target.academy) {
    const chk = academyAttackCheck(s, u, target);
    if (chk === 'ok' || chk === 'airTarget') {
      const pre = academyAttackPreview(s, u, target);
      const sub = pre.forced ? t('academy.attackForce') : t('academy.attackShield', { dmg: pre.toShield });
      out.push({ id: 'attackAcademy', icon: 'attack', variant: 'danger', label: t('academy.attack'), sub, enabled: chk === 'ok', desc: `${sub}. ${t('academy.attackDesc')}`,
        reason: chk === 'ok' ? `${sub}. ${t('academy.attackDesc')}` : err(chk), run: () => void g.exec({ type: 'attackAcademy', unit: u.id, city: target.id }) });
    }
  }
  return out;
}

/**
 * Meldung zu Akademie-, Schild-, Posten- und Beamer-Ereignissen fuer den Betrachter (null = keine).
 * Toast for academy, shield, post and beamer events for the viewer (null = none).
 */
export function academyToast(e: GameEvent, s: GameState, viewer: number): { text: string; icon: string } | null {
  const seen = (x: number, y: number) => viewer < 0 || s.factions[viewer]?.explored[y * s.size + x] === 1;
  if (e.t === 'academy') {
    const city = cname(s, e.city);
    if (e.faction !== viewer && !(e.what === 'forced' && seen(e.x, e.y))) return null;
    const key = { lift: 'toastLift', float: 'toastFloat', move: '', land: 'toastLand', forced: 'toastForced', transfer: 'toastTransfer' }[e.what];
    return key ? { text: t(`academy.${key}`, { city }), icon: e.what === 'forced' ? 'warning' : e.what === 'land' ? 'land' : 'liftOff' } : null;
  }
  if (e.t === 'shield') {
    if (e.what !== 'built' && e.what !== 'down') return null;
    const c = cityById(s, e.city);
    if (!c || (e.faction !== viewer && !seen(c.x, c.y))) return null;
    return { text: t(e.what === 'built' ? 'academy.toastShield' : 'academy.toastShieldDown', { city: cname(s, e.city) }), icon: e.what === 'built' ? 'shield' : 'warning' };
  }
  if (e.t === 'post') {
    if (e.faction !== viewer) return null;
    return { text: t('academy.toastPost', { city: cname(s, e.city), pop: e.pop }), icon: 'researchPost' };
  }
  if (e.t === 'beam') {
    if (e.faction !== viewer) return null;
    const city = cname(s, e.city);
    const unit = e.unitType ? t(`units.${e.unitType}`) : '';
    const key = { built: 'toastBuilt', depart: 'toastDepart', arrive: 'toastArrive', return: 'toastReturn' }[e.what];
    return { text: t(`beam.${key}`, { city, unit }), icon: e.what === 'return' ? 'warning' : 'beam' };
  }
  return null;
}
