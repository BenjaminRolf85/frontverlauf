/**
 * Truppenkarten im Stadtfeld: jede Truppengattung der Fraktion (Land, Luft, See) als Karte in einer waagerecht
 * wischbaren Leiste. Verfuegbare Karten bilden mit einem Tippen aus, gesperrte bleiben sichtbar (gedimmt, mit Grund).
 * Reihenfolge: verfuegbar vor gesperrt, darin Land, Luft, See und jeweils nach Preis. Am eigenen Marinestuetzpunkt
 * zeigt die Leiste nur die Schiffe der Stadt, zu der der Stuetzpunkt gehoert.
 * Troop cards in the city panel: every troop type of the faction (land, air, sea) as a card in a horizontally swipeable
 * strip. Available cards train with one tap, locked ones stay visible (dimmed, with the reason). Order: available before
 * locked, within that land, air, sea and each by price. At an own naval base the strip shows only the ships of the city
 * the base belongs to.
 */
import {
  isAlienFaction, noTraining, rosterShips, rosterUnits, siloBuyCheck, trainCheck, trainTechNeed, unitCost, unitRange,
  type City, type GameState, type SiloBuyCheck, type TrainCheck, trainSlots } from '../core';
import { SHIPYARD, SILO, SPARK, UNITS, type FactionId, type UnitTypeId } from '../data/balance';
import { sparkVars } from './divineSpark';
import { has as hasText, num, t } from '../i18n/i18n';
import { esc, price, type ActionItem } from './components';
import { icon } from './icons';
import { trainLockReason } from './production';
import { techT } from './terms';
import { UNIT_ICON, unitNickname } from './hud';

/** Gattung einer Karte / class of a card */
export type TroopClass = 'land' | 'air' | 'sea';
const CLASS_ORDER: TroopClass[] = ['land', 'air', 'sea'];

/** Karte = Aktion plus Anzeige / card = action plus display */
export interface TroopCard extends ActionItem { type: UnitTypeId; cls: TroopClass; check: TrainCheck | SiloBuyCheck }

export const troopClass = (type: UnitTypeId): TroopClass => (UNITS[type].ship ? 'sea' : UNITS[type].abilities.includes('fly') ? 'air' : 'land');

/** Lebenspunkte auf der Karte: Schiffe kommen leer mit Rumpf-LP (SHIPYARD) / HP on the card: ships come empty with hull HP (SHIPYARD) */
const cardHp = (type: UnitTypeId): number => (UNITS[type].ship ? SHIPYARD.hullHp[type] ?? 0 : UNITS[type].hp);

/**
 * Sperrgrund einer Karte in der Wortwahl der Fraktion, leer wenn verfuegbar. 'invalid' ohne Grund heisst: Karte nicht zeigen.
 * Lock reason of a card in the faction's wording, empty when available. 'invalid' without a reason means: do not show the card.
 */
function lockReason(s: GameState, c: City, type: UnitTypeId, chk: TrainCheck, fid: FactionId): string | null {
  const err = (code: string) => techT(`errors.${code}`, fid);
  switch (chk) {
    case 'ok': return '';
    case 'techMissing': {
      const tech = trainTechNeed(s, c.owner!, type);
      return tech ? techT('hud.needsTech', fid, { tech: t(`techs.${tech}`) }) : err(chk);
    }
    case 'buildingMissing': return trainLockReason(s, c, type);
    case 'computeMissing': return t('nexus.computeNeed', { n: UNITS[type].compute ?? 0 });
    // Meridon: Lenkflugkoerper kommen aus dem Raketensilo / Meridon: Guided Missiles come from the rocket silo
    case 'siloOnly': return t('shadow.silo.onlyHere');
    // Goettlicher Funke: Limit je Fraktion / Divine Spark: limit per faction
    case 'sparkLimit': return t('errors.sparkLimit');
    // Akademie: alle Ausbildungen dieser Runde vergeben oder kein freies Feld / academy: all trainings of this round used or no free tile
    case 'occupied': return c.academy ? t('academy.slotsUsed', { max: trainSlots(s, c) }) : err(chk);
    case 'invalid':
      // Zyrr: erst das Stadtfeld terraformen; sonst gehoert die Karte nicht in die Leiste / Zyrr: terraform the city tile first; otherwise the card does not belong in the strip
      return isAlienFaction(s, c.owner!) && !UNITS[type].ship ? t('xeno.cityNeedsTerraform') : null;
    default: return err(chk);
  }
}

/**
 * Karten der Stadt c fuer den Betrachter am Zug. ships: nur Schiffe (Marinestuetzpunkt). run: Ausbildung ausloesen.
 * Cards of city c for the viewer to move. ships: ships only (naval base). run: trigger the training.
 */
export function troopCards(s: GameState, c: City, run: (type: UnitTypeId) => void, ships = false): TroopCard[] {
  const f = c.owner;
  if (f === null) return [];
  // Wohnbloecke und Supermarkt bilden nie aus: keine Leiste voller gesperrter Karten, das Stadtfeld zeigt stattdessen den Hinweis (supplyNoteHtml)
  // residential blocks and supermarket never train: no strip full of locked cards, the city panel shows the note instead (supplyNoteHtml)
  if (noTraining(c)) return [];
  const fid = s.factions[f].id;
  const types = [...(ships ? [] : rosterUnits(s, f)), ...rosterShips(s, f)];
  const cards: TroopCard[] = [];
  types.forEach((type) => {
    const st = UNITS[type];
    if (st.cost === null) return;
    // Wunder (Erdkernbohrer) ruft der Prophet, keine Karte / wonders (earth-core drill) are called by the prophet, no card
    if (st.abilities.includes('wonder')) return;
    const chk = trainCheck(s, c, type);
    const reason = lockReason(s, c, type, chk, fid);
    if (reason === null) return;
    const shipNote = type === 'landingBoat' ? t('troops.boatNote') : st.ship ? t('troops.shipNote') : '';
    cards.push(card(s, f, type, chk, reason, shipNote, `train-${type}`, run));
  });
  const rank = (x: TroopCard) => (x.enabled ? 0 : 1) * 10 + CLASS_ORDER.indexOf(x.cls);
  // stabil: gleiche Gruppe nach Preis, sonst Listenreihenfolge / stable: same group by price, otherwise list order
  return cards.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || (a.x.cost ?? 0) - (b.x.cost ?? 0) || a.i - b.i).map((e) => e.x);
}

/** Eine Karte (Ausbildung oder Silo-Kauf) / one card (training or silo purchase) */
function card(s: GameState, f: number, type: UnitTypeId, chk: TrainCheck | SiloBuyCheck, reason: string, note: string, id: string, run: (type: UnitTypeId) => void): TroopCard {
  const fid = s.factions[f].id;
  const desc = [note, hasText(`unitDesc.${type}`) ? t(`unitDesc.${type}`) : ''].filter(Boolean).join(' ');
  return {
    id, type, cls: troopClass(type), check: chk, icon: UNIT_ICON[type] ?? 'helmet',
    label: t(`units.${type}`), sub: unitNickname(fid, type),
    cost: unitCost(s, f, type)!, enabled: chk === 'ok', desc, reason: reason || undefined,
    run: () => run(type),
  };
}

/**
 * Kaufkarten am eigenen Raketensilo (x, y), Meridon (SILO.units): einmal je Zug, Preis, Werte und Sperrgrund wie in der
 * Stadt. run: Kauf ausloesen.
 * Purchase cards at the own rocket silo (x, y), Meridon (SILO.units): once per turn, price, stats and lock reason as in
 * the city. run: trigger the purchase.
 */
export function siloCards(s: GameState, x: number, y: number, run: (type: UnitTypeId) => void): TroopCard[] {
  const f = s.current;
  if (f < 0 || !s.factions[f]) return [];
  const fid = s.factions[f].id;
  return SILO.units.filter((type) => !UNITS[type].faction || UNITS[type].faction === fid).map((type) => {
    const chk = siloBuyCheck(s, f, x, y, type);
    const reason = chk === 'ok' ? '' : chk === 'alreadyBought' ? t('shadow.silo.bought') : chk === 'noRoom' ? t('shadow.silo.noRoom') : techT(`errors.${chk}`, fid);
    return card(s, f, type, chk, reason, t('shadow.silo.buyNote'), `siloBuy-${type}`, run);
  });
}

/** Werte einer Karte mit Symbolen / stats of a card with icons */
function statsHtml(type: UnitTypeId, fid: FactionId): string {
  const st = UNITS[type];
  const range = unitRange(type, fid);
  const stat = (ic: string, label: string, v: string) => `<span class="troop-stat" title="${esc(label)}">${icon(ic, 'icon-sm')}<span class="sr-only">${esc(label)} </span>${esc(v)}</span>`;
  // ohne Reichweite ein Strich statt des Worts (das Wort sprengte die schmale Karte), vorgelesen wird das Wort
  // without range a dash instead of the word (the word overflowed the narrow card); screen readers get the word
  const none = `<span class="troop-stat" title="${esc(t('stats.range'))}: ${esc(t('stats.noRange'))}">${icon('range', 'icon-sm')}<span class="sr-only">${esc(t('stats.range'))} ${esc(t('stats.noRange'))}</span><span aria-hidden="true">&ndash;</span></span>`;
  // Goettlicher Funke: Flaechenschaden statt Angriff, Reichweite mit Mindestabstand / Divine Spark: area damage instead of attack, range with minimum distance
  if (type === SPARK.unit) {
    return [
      stat('hp', t('stats.hp'), num(cardHp(type))),
      stat('divineSpark', t('spark.statDesc', sparkVars()), `${SPARK.damage} · ${SPARK.area.w}×${SPARK.area.h}`),
      stat('shield', t('stats.defense'), num(st.defense)),
      stat('boot', t('stats.move'), num(st.move)),
      stat('range', t('stats.range'), `${SPARK.minRange}-${SPARK.range}`),
    ].join('');
  }
  return [
    stat('hp', t('stats.hp'), num(cardHp(type))),
    stat('sword', t('stats.attack'), num(st.attack)),
    stat('shield', t('stats.defense'), num(st.defense)),
    stat('boot', t('stats.move'), num(st.move)),
    range ? stat('range', t('stats.range'), num(range)) : none,
  ].join('');
}

/** Lesbare Beschreibung fuer Bildschirmleser / readable description for screen readers */
function ariaOf(c: TroopCard, fid: FactionId): string {
  const st = UNITS[c.type];
  const range = unitRange(c.type, fid);
  const stats = `${t('stats.hp')} ${num(cardHp(c.type))}, ${t('stats.attack')} ${num(st.attack)}, ${t('stats.defense')} ${num(st.defense)}, ${t('stats.move')} ${num(st.move)}, ${t('stats.range')} ${range ? num(range) : t('stats.noRange')}`;
  const name = c.sub && c.sub !== c.label ? `${c.label} (${c.sub})` : c.label;
  return `${name}, ${c.cost} ${t('hud.stars')}, ${t(`troops.${c.cls}`)}. ${stats}.${c.enabled ? '' : ` ${t('troops.locked')}: ${c.reason ?? ''}`}`;
}

/** Eine Karte: Kopfzeile (Symbol, Name), Spitzname und Preis, Werte mit Gattung, Sperrgrund / one card: header (icon, name), nickname and price, stats with class, lock reason */
function cardHtml(c: TroopCard, fid: FactionId): string {
  const sub = c.sub && c.sub !== c.label ? `<span class="troop-nick">${esc(c.sub)}</span>` : '';
  const tag = c.cls !== 'land' ? `<span class="troop-tag">${esc(t(`troops.${c.cls}`))}</span>` : '';
  const lock = c.enabled ? '' : `<span class="troop-lock">${icon('lock', 'icon-sm')}<span class="troop-lock-text">${esc(c.reason ?? '')}</span></span>`;
  return `<div role="listitem" class="troop-item"><button type="button" class="troop-card ${c.enabled ? '' : 'locked'}" data-act="${esc(c.id)}" data-class="${c.cls}" aria-disabled="${!c.enabled}" aria-label="${esc(ariaOf(c, fid))}" title="${esc((c.enabled ? c.desc : c.reason) || c.label)}">
    <span class="troop-top"><span class="troop-icon">${icon(c.icon)}</span><span class="troop-name">${esc(c.label)}</span></span>
    <span class="troop-line">${sub}${price(c.cost ?? 0)}</span>
    <span class="troop-stats">${statsHtml(c.type, fid)}${tag}</span>${lock}</button></div>`;
}

/**
 * Abschnitt "Truppen" mit Ueberschrift, Zaehler, Pfeilen und der Kartenleiste. title: eigene Ueberschrift (Stuetzpunkt).
 * "Troops" section with heading, counter, arrows and the card strip. title: own heading (naval base).
 */
export function troopsHtml(cards: TroopCard[], fid: FactionId, title = t('troops.title')): string {
  if (!cards.length) return '';
  const ready = cards.filter((c) => c.enabled).length;
  // Symbol der Ueberschrift: Werft (nur Schiffe), Raketensilo (Kaufkarten), sonst Kaserne / heading icon: shipyard (ships only), rocket silo (purchase cards), otherwise barracks
  const head = cards.every((c) => c.cls === 'sea') ? 'sail' : cards.every((c) => c.id.startsWith('siloBuy-')) ? 'silo' : 'helmet';
  return `<section class="troops" aria-label="${esc(title)}">
    <div class="troops-head"><h4 class="troops-title">${icon(head, 'icon-sm')}<span>${esc(title)}</span></h4>
      <span class="muted troops-count">${esc(t('troops.available', { n: ready, max: cards.length }))}</span>
      <button type="button" class="troops-nav prev" data-action="troopsPrev" aria-label="${esc(t('troops.prev'))}" title="${esc(t('troops.prev'))}">${icon('next', 'icon-sm')}</button>
      <button type="button" class="troops-nav" data-action="troopsNext" aria-label="${esc(t('troops.next'))}" title="${esc(t('troops.next'))}">${icon('next', 'icon-sm')}</button></div>
    <div class="troop-wrap"><div class="troop-strip" role="list" aria-label="${esc(title)}">${cards.map((c) => cardHtml(c, fid)).join('')}</div></div>
  </section>`;
}
