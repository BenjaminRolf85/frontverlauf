/**
 * Regionale Stadtnamen: Jede Stadt bekommt die Namensliste der Fraktion, deren Hauptquartier ihr
 * zu Spielbeginn am naechsten lag. Gleichstand oder grosse Entfernung: allgemeine Liste.
 * Die Zuordnung haengt nur von unveraenderlichen Startdaten ab (Stadtpositionen, Hauptquartiere, Fraktionen, Seed)
 * und bleibt daher auch nach einer Eroberung, nach Laden und Sprachwechsel gleich.
 *
 * Regional city names: every city takes the name list of the faction whose HQ was nearest to it
 * at game start. Ties or large distances: the general list. The assignment only depends on immutable
 * start data (city positions, HQs, factions, seed), so it stays the same after capture, loading and language switch.
 */
import type { FactionId } from '../data/balance';
import type { City, GameState } from '../core/types';
import { dist } from '../core/grid';
import { tList } from './i18n';

/** Namensplatz einer Stadt: Liste (Fraktion oder allgemein) und Index / name slot of a city: list (faction or general) and index */
export interface CityNameSlot { list: FactionId | null; index: number }

/** Groesste Entfernung zum naechsten Hauptquartier fuer einen Fraktionsnamen / max distance to the nearest HQ for a faction name */
export function cultureRange(size: number): number {
  return Math.max(4, Math.ceil(size / 3));
}

const factionList = (id: FactionId) => tList(`cityNamesFaction.${id}`);
const generalList = () => tList('cityNames');

/**
 * Kultur einer Stadt: Fraktions-ID oder null (allgemein). Rein aus den Startdaten.
 * Culture of a city: faction id or null (general). Purely from start data.
 */
export function cityCulture(s: GameState, c: City): FactionId | null {
  if (c.isHQ && c.hqOf !== null && s.factions[c.hqOf]) return s.factions[c.hqOf].id;
  let best = Infinity;
  let owners = new Set<FactionId>();
  for (const h of s.cities) {
    if (!h.isHQ || h.hqOf === null || !s.factions[h.hqOf]) continue;
    const d = dist(c, h);
    if (d < best) { best = d; owners = new Set([s.factions[h.hqOf].id]); }
    else if (d === best) owners.add(s.factions[h.hqOf].id);
  }
  if (owners.size !== 1 || best > cultureRange(s.size)) return null;
  return [...owners][0];
}

interface SlotCache { count: number; lens: string; slots: Map<number, CityNameSlot> }
const cache = new WeakMap<GameState, SlotCache>();

/**
 * Namensplaetze aller Staedte, je Spielzustand zwischengespeichert. Keine Doppelungen, solange die Listen reichen.
 * Name slots of all cities, cached per game state. No duplicates as long as the lists last.
 */
export function cityNameSlots(s: GameState): Map<number, CityNameSlot> {
  const general = generalList().length;
  const lens = `${general}:${(s.factions.map((f) => factionList(f.id).length)).join(',')}`;
  const hit = cache.get(s);
  if (hit && hit.count === s.cities.length && hit.lens === lens) return hit.slots;
  const slots = new Map<number, CityNameSlot>();
  const seed = Math.abs(s.config.seed | 0);
  const byOrder = (a: City, b: City) => a.nameIndex - b.nameIndex || a.id - b.id;
  const pools = new Map<FactionId, { c: City; d: number; hq: boolean }[]>();
  const rest: City[] = [];
  for (const c of [...s.cities].sort(byOrder)) {
    const fid = cityCulture(s, c);
    if (!fid) { rest.push(c); continue; }
    const hqs = s.cities.filter((h) => h.isHQ && h.hqOf !== null && s.factions[h.hqOf]?.id === fid);
    const d = Math.min(...hqs.map((h) => dist(c, h)));
    const hq = c.isHQ && c.hqOf !== null;
    if (!pools.has(fid)) pools.set(fid, []);
    pools.get(fid)!.push({ c, d, hq });
  }
  for (const [fid, list] of pools) {
    const len = factionList(fid).length;
    // Hauptquartier zuerst, dann nach Entfernung / HQ first, then by distance
    list.sort((a, b) => Number(b.hq) - Number(a.hq) || (a.c.hqOf ?? 0) - (b.c.hqOf ?? 0) || a.d - b.d || byOrder(a.c, b.c));
    // Seed verschiebt die Reihenfolge der uebrigen Namen, damit nicht jede Partie gleich heisst
    // the seed rotates the remaining names so that not every game uses the same ones
    const shift = len > 1 ? seed % (len - 1) : 0;
    list.forEach((e, i) => {
      if (i >= len) { rest.push(e.c); return; }
      slots.set(e.c.id, { list: fid, index: i === 0 ? 0 : 1 + ((i - 1 + shift) % (len - 1)) });
    });
  }
  rest.sort(byOrder);
  const shift = general ? seed % general : 0;
  rest.forEach((c, i) => slots.set(c.id, { list: null, index: general ? (i + shift) % general : 0 }));
  cache.set(s, { count: s.cities.length, lens, slots });
  return slots;
}

/** Name einer Stadt in der aktuellen Sprache / name of a city in the current language */
export function cityNameOf(s: GameState, cityId: number): string {
  const slot = cityNameSlots(s).get(cityId);
  if (!slot) return '';
  const names = slot.list ? factionList(slot.list) : generalList();
  return names[slot.index] ?? '';
}
