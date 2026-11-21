/**
 * Oberflaeche des Hackens (NEXUS, HACK): Aktion "Hacken" an neutralen Orten mit Ladungen und Sperrgruenden, Bauaktion und
 * Feldpanel des Hackturms, die Zielauswahl "Einheit uebernehmen" mit Reichweite, die Marke an uebernommenen Einheiten mit
 * dem Countdown und die Meldungen. Zahlen aus balance.ts (HACK), Texte aus hack.* (DE und EN). Alles per Tippen bedienbar.
 * Hacking UI (NEXUS, HACK): the "Hack" action at neutral places with charges and blocking reasons, the build action and
 * tile panel of the hack tower, the "take over unit" targeting with reach, the tag on taken-over units with the countdown
 * and the messages. Numbers from balance.ts (HACK), texts from hack.* (DE and EN). Everything works by tapping.
 */
import {
  cityById, cityHackCheck, cityHackRadius, cityHackRoundsLeft, cityHackWait, cityHackedBy, cityIncome, hasCityUpgrade, supportedUnits, unitLimit, hackCapacity, hackCharges, hackCheck, hackCost, hackRechargeIn, hackTowerCheck, hackTowerLimit, hackTowersOf, hacksOn, hijackCheck,
  hijackRoundsLeft, hijackTargets, towerLink, towerWait, turretAt, unitById,
  type City, type GameEvent, type GameState, type Unit,
} from '../core';
import { DEFENSE_BONUS, HACK } from '../data/balance';
import type { Controller } from '../game/controller';
import { num, t } from '../i18n/i18n';
import { cityNameOf } from '../i18n/cityNames';
import { actionButton, esc, factionBadge, iconButton, progress, type ActionItem } from './components';
import { icon } from './icons';

const fname = (s: GameState, i: number) => t(`factions.${s.factions[i].id}.short`);
const uname = (u: Unit) => t(`units.${u.type}`);

/** Platzhalter der Hacktexte / placeholders of the hack texts */
export const hackVars = () => ({ reach: HACK.tower.reach, recharge: HACK.place.recharge });

/** "bereit" oder "bereit in n Runden" / "ready" or "ready in n rounds" */
export const towerWaitText = (n: number) => (n <= 0 ? t('hack.tower.ready') : n === 1 ? t('hack.tower.wait1') : t('hack.tower.wait', { n }));

/** Ladungen als kurzer Text / charges as a short text */
export function chargesText(s: GameState, f: number): string {
  return t('hack.place.charges', { n: hackCharges(s, f), max: hackCapacity(s, f) });
}

/** Grund, warum gerade kein Hack geht, als Text / why no hack is possible right now, as a text */
function hackReason(s: GameState, f: number, c: City, err: (code: string) => string): string {
  const chk = hackCheck(s, f, c);
  const cost = hackCost(s, f, c);
  if (chk === 'ok') return t('hack.place.desc', { cost, recharge: HACK.place.recharge });
  if (chk === 'hackCharges') {
    if (hackCapacity(s, f) <= 0) return t('hack.place.noDc');
    const n = hackRechargeIn(s, f) ?? 0;
    return `${err('hackCharges')} ${n <= 1 ? t('hack.place.rechargeIn1') : t('hack.place.rechargeIn', { n })}`;
  }
  if (chk === 'notVisible') return t('hack.place.visibleOnly');
  return err(chk);
}

/**
 * Aktion "Hacken" fuer einen neutralen Ort (nur NEXUS am Zug, freie Partie): gesperrt mit Grund, sonst mit Preis und Ladungen.
 * The "Hack" action for a neutral place (only NEXUS on turn, free game): locked with a reason, otherwise with price and charges.
 */
export function hackPlaceAction(s: GameState, c: City, g: Controller, err: (code: string) => string): ActionItem | null {
  const f = s.current;
  if (!g.isHumanTurn || !hacksOn(s, f) || c.owner !== null) return null;
  const chk = hackCheck(s, f, c);
  return {
    id: 'hack', icon: 'hack', variant: 'primary', label: t('hack.place.action'), sub: chargesText(s, f), cost: hackCost(s, f, c), enabled: chk === 'ok',
    desc: t('hack.place.desc', { cost: hackCost(s, f, c), recharge: HACK.place.recharge }), reason: hackReason(s, f, c, err),
    run: () => void g.exec({ type: 'hack', city: c.id }),
  };
}

/**
 * Aktion "Hacken" an einer feindlichen Stadt (Stadt-Hack, HACK.city): aufdecken statt einnehmen; gesperrt mit Grund.
 * The "Hack" action at a hostile city (city hack, HACK.city): reveal instead of capture; locked with a reason.
 */
export function hackCityAction(s: GameState, c: City, g: Controller, err: (code: string) => string): ActionItem | null {
  const f = s.current;
  if (!g.isHumanTurn || !hacksOn(s, f) || c.owner === null || c.owner === f) return null;
  const chk = cityHackCheck(s, f, c);
  // im Frieden nicht anbieten / not offered at peace
  if (chk === 'peace') return null;
  const desc = t('hack.city.desc', { r: cityHackRadius(c) });
  const wait = cityHackWait(s, f);
  const reason = chk === 'ok' ? desc : chk === 'cityHackCooldown' ? (wait <= 1 ? t('hack.city.wait1') : t('hack.city.wait', { n: wait })) : err(chk);
  return {
    id: 'hackCity', icon: 'hack', variant: 'primary', label: t('hack.city.action'), sub: wait > 0 ? (wait <= 1 ? t('hack.city.wait1') : t('hack.city.wait', { n: wait })) : undefined,
    cost: HACK.city.cost, enabled: chk === 'ok', desc, reason, run: () => void g.exec({ type: 'hackCity', city: c.id }),
  };
}

/**
 * Hack-Marke und Hack-Daten einer Stadt: die Marke fuer alle (der Besitzer sieht, dass seine Stadt gehackt ist), die Daten
 * nur fuer den Hacker (Kasse des Besitzers, Einkommen, getragene Einheiten, Verteidigung).
 * Hack mark and hack data of a city: the mark for everyone (the owner sees that the city is hacked), the data only for the
 * hacker (owner's treasury, income, supported units, defence).
 */
export function cityHackHtml(s: GameState, c: City, viewer: number): string {
  const n = cityHackRoundsLeft(s, c);
  if (!n || !c.hacked || c.owner === null) return '';
  const by = c.hacked.by;
  let html = `<div class="row"><span class="tag warn">${icon('hack', 'icon-sm')}${esc(t('hack.city.tag', { name: fname(s, by), n }))}</span></div>`;
  if (viewer >= 0 && !cityHackedBy(s, c, viewer)) return html;
  const units = s.units.filter((u) => u.homeCity === c.id && u.owner === c.owner);
  const names = units.length ? units.map((u) => `${uname(u)} ${u.hp}/${u.maxHp}`).join(', ') : t('hack.city.none');
  const def = hasCityUpgrade(c, 'bunker') || c.bunkerRing ? DEFENSE_BONUS.cityWithBunker : DEFENSE_BONUS.city;
  html += `<div class="hack-intel"><p class="icon-line"><strong>${esc(t('hack.city.intel', { n }))}</strong></p>
    <div class="stats"><span class="stat">${icon('star', 'icon-sm')}${esc(t('hack.city.treasury', { name: fname(s, c.owner), stars: s.factions[c.owner].stars }))}</span>
    <span class="stat">${icon('star', 'icon-sm')}${esc(t('hack.city.income', { n: cityIncome(s, c) }))}</span>
    <span class="stat">${icon('shield', 'icon-sm')}${esc(t('hack.city.defense', { def: num(def) }))}</span>
    <span class="stat">${icon('helmet', 'icon-sm')}${esc(t('hack.city.units', { n: supportedUnits(s, c), max: unitLimit(s, c) }))}</span></div>
    <p class="muted">${esc(names)}</p></div>`;
  return html;
}

/** Bauaktion des Hackturms auf einem eigenen Feld / build action of the hack tower on an own tile */
export function hackTowerBuildAction(s: GameState, x: number, y: number, g: Controller, err: (code: string) => string): ActionItem | null {
  const f = s.current;
  if (!hacksOn(s, f)) return null;
  const chk = hackTowerCheck(s, f, x, y);
  // ungeeignetes Feld: gar nicht anbieten / unsuitable tile: not offered at all
  if (chk === 'invalidTile' || chk === 'occupied' || chk === 'notInTerritory' || chk === 'wrongFaction' || chk === 'gameOver') return null;
  const reason = chk === 'ok' ? t('hack.tower.buildDesc') : chk === 'emplacementLimit' ? t('hack.tower.limit') : chk === 'emplacementSpacing' ? t('hack.tower.spacing') : err(chk);
  return {
    id: 'hackTower', icon: 'hackTower', label: t('hack.tower.build'), sub: t('hack.tower.count', { n: hackTowersOf(s, f).length, max: hackTowerLimit(s, f) }), cost: HACK.tower.cost,
    enabled: chk === 'ok', desc: t('hack.tower.buildDesc'), reason, run: () => void g.exec({ type: 'hackTower', x, y }),
  };
}

/**
 * Feldpanel eines Hackturms: Besitzer, LP, Reichweite, Ladezustand, gesteuerte Einheit; fuer den eigenen Turm die Uebernahme.
 * Tile panel of a hack tower: owner, HP, reach, charge state, controlled unit; for the own tower the takeover.
 */
export function hackTowerTile(s: GameState, x: number, y: number, viewer: number, g: Controller, err: (code: string) => string): { head: string; body: string; actions: ActionItem[] } | null {
  const gun = turretAt(s, x, y);
  if (!gun || gun.kind !== 'hack' || gun.owner === undefined) return null;
  const of = gun.owner;
  const fid = s.factions[of].id;
  const mine = of === viewer || viewer < 0;
  const wait = towerWait(s, x, y) ?? 0;
  const link = towerLink(s, x, y);
  const linkText = link ? t(hijackRoundsLeft(s, link) <= 1 ? 'hack.tower.linked1' : 'hack.tower.linked', { unit: uname(link), n: hijackRoundsLeft(s, link) }) : null;
  const head = `${factionBadge(fid, 'hackTower')}<div class="grow"><h3 class="display">${esc(t('hack.tower.name'))}</h3>
    <div class="muted unit-sub">${esc(t(`factions.${fid}.short`))} · ${esc(mine ? linkText ?? towerWaitText(wait) : t('hack.tower.every'))}</div></div>`;
  const hpText = t('verdan.hp', { hp: gun.hp, max: HACK.tower.hp });
  let body = `<div class="row">${icon('shield', 'icon-sm')}<span>${esc(hpText)}</span><div class="grow">${progress(gun.hp, HACK.tower.hp, 'hp', hpText)}</div></div>
    <div class="stats"><span class="stat">${icon('range', 'icon-sm')}${esc(t('stats.range'))} ${HACK.tower.reach}</span>
    <span class="stat">${icon('hourglass', 'icon-sm')}${esc(t('hack.tower.timing', { rounds: HACK.tower.rounds, cd: HACK.tower.cooldown }))}</span>
    <span class="stat">${icon('shield', 'icon-sm')}${esc(t('stats.defense'))} ${num(HACK.tower.defense)}</span>
    ${mine ? `<span class="stat">${icon('build', 'icon-sm')}${esc(t('hack.tower.count', { n: hackTowersOf(s, of).length, max: hackTowerLimit(s, of) }))}</span>` : ''}</div>`;
  if (linkText) body += `<p class="icon-line">${icon('hack', 'icon-sm')}<span>${esc(linkText)}</span></p>`;
  body += `<p class="muted sheet-more">${esc(t('hack.tower.desc', { name: t(`factions.${fid}.short`) }))}</p>`;
  const actions: ActionItem[] = [];
  if (g.isHumanTurn && of === s.current) {
    const targets = hijackTargets(s, of, x, y);
    const busy = link !== null;
    const reason = busy ? err('towerBusy') : wait > 0 ? towerWaitText(wait) : targets.length ? t('hack.tower.pick', hackVars()) : t('hack.tower.none', hackVars());
    actions.push({ id: 'hijackStart', icon: 'hack', variant: 'danger', label: t('hack.tower.take'), sub: busy ? linkText ?? undefined : wait > 0 ? towerWaitText(wait) : undefined,
      enabled: !busy && wait === 0 && targets.length > 0, desc: t('hack.tower.desc', { name: t(`factions.${fid}.short`) }), reason, run: () => g.startHijack(x, y) });
  }
  return { head, body, actions };
}

/**
 * Zielauswahl "Einheit uebernehmen": Kopf, Statuszeile (Hinweis, angepeiltes Ziel, Sperrgrund), Uebernehmen und Abbrechen.
 * "Take over unit" targeting: head, status line (hint, aimed target, blocking reason), take over and cancel.
 */
export function hijackSheet(s: GameState, g: Controller, err: (code: string) => string): { html: string; actions: ActionItem[] } {
  const from = g.hackFrom!;
  const aim = g.hackAim !== null ? unitById(s, g.hackAim) : undefined;
  const f = s.current;
  const n = hijackTargets(s, f, from.x, from.y).length;
  let status = n ? t('hack.tower.pick', hackVars()) : t('hack.tower.none', hackVars()), cls = n ? '' : 'warn';
  let ok = false;
  if (aim) {
    const chk = hijackCheck(s, f, from.x, from.y, aim);
    ok = chk === 'ok';
    status = ok ? `${t('hack.tower.target', { unit: uname(aim), name: fname(s, aim.owner), hp: aim.hp })}. ${t('hack.tower.confirm')}` : err(chk);
    cls = ok ? '' : 'warn';
  }
  const actions: ActionItem[] = [
    { id: 'hijackGo', icon: 'hack', variant: 'danger', label: t('hack.tower.go'), enabled: ok, desc: t('hack.tower.desc', { name: fname(s, f) }), reason: status, run: () => void g.fireHijack() },
    { id: 'hijackCancel', icon: 'close', label: t('actions.cancel'), enabled: true, run: () => g.cancelHijack() },
  ];
  const head = `<div class="sheet-head"><span class="unit-badge orbital-head">${icon('hackTower')}</span><div class="grow"><h3 class="display">${esc(t('hack.tower.title'))}</h3>
    <div class="muted unit-sub">${esc(t('stats.range'))} ${HACK.tower.reach} · ${esc(t('hack.tower.name'))}</div></div>${iconButton('close', t('actions.cancel'), 'hijackCancel')}</div>`;
  const body = `<p class="orbital-status ${cls}" role="status" aria-live="polite">${cls ? icon('warning', 'icon-sm') : icon('info', 'icon-sm')}<span>${esc(status)}</span></p>`;
  const bar = `<div class="action-wrap"><div class="action-bar" role="toolbar">${actions.map(actionButton).join('')}</div></div>`;
  return { html: `${head}${body}${bar}`, actions };
}

/**
 * Marke im Einheitenpanel einer uebernommenen Einheit: wer steuert, wie viele Zuege noch (fuer alle sichtbar).
 * Tag in the unit panel of a taken-over unit: who controls it, how many turns are left (visible to everyone).
 */
export function hijackTag(s: GameState, u: Unit): string {
  if (!u.hijack) return '';
  const n = hijackRoundsLeft(s, u);
  const label = t(n <= 1 ? 'hack.hijack.tag1' : 'hack.hijack.tag', { name: fname(s, u.owner), n });
  const desc = `${t('hack.hijack.desc', { name: fname(s, u.owner), round: u.hijack.until })} ${t('hack.hijack.chance', { name: fname(s, u.owner), keep: Math.round(HACK.tower.keepChance * 100), off: Math.round(HACK.tower.shutdownChance * 100) })}`;
  return `<div class="row"><span class="tag warn" title="${esc(desc)}">${icon('hack', 'icon-sm')}${esc(label)}</span></div><p class="muted sheet-more">${esc(desc)}</p>`;
}

/**
 * Meldungen des Hackens fuer den Betrachter: gehackter Ort, uebernommene oder zurueckgekehrte Einheit, geschleifter Turm.
 * Hacking messages for the viewer: hacked place, taken-over or returned unit, razed tower.
 */
export function hackToast(e: GameEvent, s: GameState, viewer: number): { text: string; icon: string } | null {
  switch (e.t) {
    case 'capture': {
      if (!e.hack) return null;
      const c = cityById(s, e.city);
      const city = c ? cityNameOf(s, c.id) : '';
      if (e.faction === viewer) return { text: t('hack.place.toastOwn', { city }), icon: 'hack' };
      return viewer >= 0 && c && s.factions[viewer].explored[c.y * s.size + c.x] ? { text: t('hack.place.toast', { name: fname(s, e.faction), city }), icon: 'hack' } : null;
    }
    case 'cityHack': {
      const city = cityNameOf(s, e.city);
      if (e.faction === viewer) return { text: t('hack.city.toastOwn', { city, name: fname(s, e.victim), n: HACK.city.rounds }), icon: 'hack' };
      if (e.victim === viewer) return { text: t('hack.city.toastVictim', { city, name: fname(s, e.faction), n: HACK.city.rounds }), icon: 'warning' };
      return null;
    }
    case 'hijack': {
      const u = unitById(s, e.unit);
      if (!u) return null;
      if (e.faction === viewer) return { text: t('hack.hijack.toastOwn', { unit: uname(u), name: fname(s, e.from) }), icon: 'hack' };
      if (e.from === viewer) return { text: t('hack.hijack.toastVictim', { unit: uname(u), name: fname(s, e.faction), n: HACK.tower.rounds }), icon: 'hack' };
      return null;
    }
    case 'hijackEnd': {
      const u = unitById(s, e.unit);
      const unit = e.unitType ? t(`units.${e.unitType}`) : u ? uname(u) : '';
      if (e.lost) return e.by === viewer ? { text: t('hack.hijack.lostUnit', { unit }), icon: 'warning' } : null;
      // dauerhaft uebernommen oder abgeschaltet (HACK.tower) / permanently taken over or shut down (HACK.tower)
      if (e.outcome === 'kept') {
        if (e.by === viewer) return { text: t('hack.hijack.kept', { unit, name: fname(s, e.faction) }), icon: 'hack' };
        return e.faction === viewer ? { text: t('hack.hijack.keptVictim', { unit, name: fname(s, e.by) }), icon: 'warning' } : null;
      }
      if (e.outcome === 'shutdown') {
        if (e.faction === viewer) return { text: t('hack.hijack.shutdownVictim', { unit }), icon: 'warning' };
        return e.by === viewer ? { text: t('hack.hijack.shutdown', { unit, name: fname(s, e.faction) }), icon: 'hack' } : null;
      }
      if (e.faction === viewer) return { text: t(e.reason === 'tower' ? 'hack.hijack.backTower' : 'hack.hijack.back', { unit }), icon: 'hack' };
      if (e.by === viewer) return { text: t('hack.hijack.released', { unit, name: fname(s, e.faction) }), icon: 'hack' };
      return null;
    }
    // NEXUS baut keine anderen Bauwerke: ein geschleiftes Bauwerk der NEXUS ist ein Hackturm / NEXUS builds no other structures: a razed NEXUS structure is a hack tower
    case 'emplacementLost':
      return e.faction === viewer && e.reason === 'territory' && hacksOn(s, e.faction) ? { text: t('hack.tower.lost'), icon: 'warning' } : null;
    default: return null;
  }
}
