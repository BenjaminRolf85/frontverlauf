/**
 * Zufallsereignisse fuer lange Partien. Zeitpunkt und Art kommen deterministisch aus Seed und Runde
 * (wie das Wetter), das Ziel aus dem Spielstand. Der Haupt-Zufallsstrom (s.rng) wird nicht benutzt,
 * damit Partien mit und ohne Ereignisse bis zum ersten Ereignis gleich verlaufen.
 * Random events for long games. Timing and kind come deterministically from seed and round (like the
 * weather), the target from the game state. The main random stream (s.rng) is not used, so games with
 * and without events run identically until the first event.
 */
import { ROSTERS, TECHS, TECH_IDS, UNITS, type TechId } from '../data/balance';
import { dist, neighbors, tileAt } from './grid';
import { has, hqOf, isHostile, ownCities, score } from './queries';
import { freeFor, placeUnit } from './spawn';
import type { GameEvent, GameState, RandomEventKind, Unit } from './types';

/**
 * Feinabstimmung der Ereignisse (hier statt in balance.ts, damit das Modul eigenstaendig bleibt).
 * Event tuning (kept here instead of balance.ts so the module stays self-contained).
 */
export const RANDOM_EVENTS = {
  /** erstes Ereignis zwischen diesen Runden / first event between these rounds */
  firstMin: 6, firstMax: 9,
  /** Abstand zwischen Ereignissen / gap between events */
  gapMin: 6, gapMax: 10,
  weights: { storm: 3, epidemic: 2, rebels: 1, convoy: 2, defector: 1, luckyFind: 2, drought: 2 } as Record<RandomEventKind, number>,
  /** Sturm: Radius um das Zentrum, betroffene Einheiten fahren 1 Runde nur 1 Feld / storm radius, affected units move 1 tile for a round */
  stormRadius: 2,
  /** Rebellen: ab so vielen Staedten, so viele Einheiten / rebels: from this many cities, this many units */
  rebelsMinCities: 3, rebelsUnits: 2, rebelsPopLoss: 1,
  /** Nachschubkonvoi / supply convoy */
  convoyStars: 20,
  /** Gluecksfund: Technologie bis Stufe, sonst Sterne / lucky find: tech up to tier, otherwise stars */
  luckyMaxTier: 2, luckyStars: 25,
  /** Duerre: Runden, Sterne je Hof, hoechstens / drought: rounds, stars per farm, maximum */
  droughtRounds: 2, droughtPerFarm: 3, droughtMax: 15,
  salt: 0x6e7e1a5,
};

/** Hoefe, die unter Duerre leiden / farms that suffer from drought */
const FARMS = ['farm', 'ranch', 'fishery'] as const;

/** Gleichverteilte Zahl in [0,1) aus Seed und zwei Schluesseln / uniform number in [0,1) from seed and two keys */
export function eventHash(seed: number, a: number, b: number): number {
  let h = (seed ^ RANDOM_EVENTS.salt ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca77)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Runden mit Ereignis bis einschliesslich maxRound / rounds with an event up to and including maxRound */
export function eventRounds(seed: number, maxRound: number): number[] {
  const E = RANDOM_EVENTS;
  const out: number[] = [];
  let r = E.firstMin + Math.floor(eventHash(seed, 0, 1) * (E.firstMax - E.firstMin + 1));
  let k = 0;
  while (r <= maxRound) {
    out.push(r);
    k++;
    r += E.gapMin + Math.floor(eventHash(seed, k, 1) * (E.gapMax - E.gapMin + 1));
  }
  return out;
}

/** Geplantes Ereignis einer Runde (ohne Ruecksicht auf den Spielstand) / scheduled event of a round (ignoring the state) */
export function randomEventFor(seed: number, round: number): RandomEventKind | null {
  if (!eventRounds(seed, round).includes(round)) return null;
  const entries = Object.entries(RANDOM_EVENTS.weights) as [RandomEventKind, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = eventHash(seed, round, 2) * total;
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[0][0];
}

/** Naechste Ereignisrunde ab dieser Runde (fuer Vorschau) / next event round from this round on (for previews) */
export function nextEventRound(seed: number, round: number): number {
  return eventRounds(seed, round + RANDOM_EVENTS.gapMax + RANDOM_EVENTS.firstMax).find((r) => r >= round) ?? round;
}

type Ctx = { s: GameState; ev: GameEvent[] };
const pickBy = <T>(s: GameState, list: T[], salt: number): T => list[Math.floor(eventHash(s.config.seed, s.round, salt) * list.length)];
const alive = (s: GameState) => s.factions.filter((f) => f.alive).map((f) => f.index);
/** schwaechste Fraktion nach Punkten (bei Gleichstand der kleinste Index) / weakest faction by points */
const weakest = (s: GameState) => alive(s).map((f) => ({ f, sc: score(s, f) })).sort((a, b) => a.sc - b.sc || a.f - b.f)[0]?.f;
const farmCount = (s: GameState, f: number) => {
  let n = 0;
  for (const t of s.tiles) {
    if (!t.building || !(FARMS as readonly string[]).includes(t.building) || t.territory === null) continue;
    if (s.cities.find((c) => c.id === t.territory)?.owner === f) n++;
  }
  return n;
};
const droughtLoss = (s: GameState, f: number) => Math.min(RANDOM_EVENTS.droughtMax, RANDOM_EVENTS.droughtPerFarm * farmCount(s, f));
const takeStars = (s: GameState, f: number, n: number) => { const fa = s.factions[f]; const loss = Math.min(fa.stars, n); fa.stars -= loss; return loss; };

// ---------- Einzelne Ereignisse / single events (true = angewendet / applied) ----------

function storm({ s, ev }: Ctx): boolean {
  const units = s.units.filter((u) => s.factions[u.owner]?.alive);
  if (!units.length) return false;
  const c = pickBy(s, units, 3);
  const hit = s.units.filter((u) => dist(u, c) <= RANDOM_EVENTS.stormRadius);
  for (const u of hit) u.slowedNext = true;
  ev.push({ t: 'randomEvent', kind: 'storm', x: c.x, y: c.y, count: hit.length, faction: c.owner });
  return true;
}

function epidemic({ s, ev }: Ctx): boolean {
  const cands = alive(s).filter((f) => ownCities(s, f).some((c) => c.level >= 2));
  if (!cands.length) return false;
  const f = pickBy(s, cands, 4);
  const city = ownCities(s, f).sort((a, b) => b.level - a.level || b.pop - a.pop || a.id - b.id)[0];
  // Sanitaeter auf oder neben der Stadt daemmen die Seuche ein / medics on or next to the city contain the epidemic
  const contained = s.units.some((u) => u.owner === f && has(u, 'heal') && dist(u, city) <= 1);
  if (!contained) city.noIncomeNext = true;
  ev.push({ t: 'randomEvent', kind: 'epidemic', faction: f, city: city.id, x: city.x, y: city.y, contained });
  return true;
}

function rebels({ s, ev }: Ctx): boolean {
  const E = RANDOM_EVENTS;
  // die groesste Macht (meiste Staedte) hat Unruhen / the largest power (most cities) has unrest
  const big = alive(s).map((f) => ({ f, n: ownCities(s, f).length, sc: score(s, f) }))
    .filter((o) => o.n >= E.rebelsMinCities).sort((a, b) => b.n - a.n || b.sc - a.sc || a.f - b.f)[0];
  if (!big) return false;
  const f = big.f;
  const city = ownCities(s, f).filter((c) => !(c.isHQ && c.hqOf === f)).sort((a, b) => b.level - a.level || b.pop - a.pop || a.id - b.id)[0];
  if (!city) return false;
  // die staerkste feindliche Macht im Krieg unterstuetzt die Rebellen / the strongest hostile power at war backs the rebels
  const backer = alive(s).filter((g) => g !== f && s.factions[f].relations[g] === 'war')
    .map((g) => ({ g, sc: score(s, g) })).sort((a, b) => b.sc - a.sc || a.g - b.g)[0]?.g;
  if (backer === undefined) return false;
  const type = ROSTERS[s.factions[backer].id]?.infantry ?? 'infantry';
  const spots = neighbors(s.size, city.x, city.y).filter((p) => freeFor(s, type, p) && tileAt(s, p.x, p.y)!.cityId === null);
  const n = Math.min(E.rebelsUnits, spots.length);
  if (n === 0) return false;
  for (let i = 0; i < n; i++) placeUnit(s, type, backer, spots[i].x, spots[i].y, false);
  city.pop = Math.max(0, city.pop - E.rebelsPopLoss);
  ev.push({ t: 'randomEvent', kind: 'rebels', faction: f, other: backer, city: city.id, x: city.x, y: city.y, count: n });
  return true;
}

function convoy({ s, ev }: Ctx): boolean {
  const f = weakest(s);
  if (f === undefined) return false;
  s.factions[f].stars += RANDOM_EVENTS.convoyStars;
  const hq = hqOf(s, f) ?? ownCities(s, f)[0];
  ev.push({ t: 'randomEvent', kind: 'convoy', faction: f, stars: RANDOM_EVENTS.convoyStars, x: hq?.x, y: hq?.y });
  return true;
}

function defector({ s, ev }: Ctx): boolean {
  const f = weakest(s);
  if (f === undefined) return false;
  const home = hqOf(s, f) ?? ownCities(s, f)[0];
  if (!home) return false;
  const cands = s.units.filter((u) => u.owner !== f && isHostile(s, f, u.owner) && !UNITS[u.type].ship && u.fuel === null && u.carried === null &&
    tileAt(s, u.x, u.y)!.cityId === null);
  if (!cands.length) return false;
  const u = cands.sort((a, b) => dist(a, home) - dist(b, home) || a.id - b.id)[0] as Unit;
  const from = u.owner;
  u.owner = f; u.homeCity = null; u.fresh = true; u.exhausted = true; u.slowedNext = false;
  ev.push({ t: 'randomEvent', kind: 'defector', faction: f, other: from, unit: u.id, x: u.x, y: u.y });
  return true;
}

function luckyFind({ s, ev }: Ctx): boolean {
  const list = alive(s);
  if (!list.length) return false;
  const f = pickBy(s, list, 5);
  const fa = s.factions[f];
  let tech: TechId | undefined;
  if (ROSTERS[fa.id]?.research !== false) {
    const opts = TECH_IDS.filter((x) => TECHS[x].tier <= RANDOM_EVENTS.luckyMaxTier && !fa.techs.includes(x) && (!TECHS[x].parent || fa.techs.includes(TECHS[x].parent!)));
    if (opts.length) { tech = pickBy(s, opts, 6); fa.techs.push(tech); }
  }
  const stars = tech ? undefined : RANDOM_EVENTS.luckyStars;
  if (stars) fa.stars += stars;
  ev.push({ t: 'randomEvent', kind: 'luckyFind', faction: f, tech, stars });
  return true;
}

function drought({ s, ev }: Ctx): boolean {
  const cands = alive(s).filter((f) => farmCount(s, f) > 0 && !(s.droughts ?? []).some((d) => d.faction === f));
  if (!cands.length) return false;
  const f = pickBy(s, cands, 7);
  s.droughts = [...(s.droughts ?? []), { faction: f, until: s.round + RANDOM_EVENTS.droughtRounds - 1 }];
  const loss = takeStars(s, f, droughtLoss(s, f));
  ev.push({ t: 'randomEvent', kind: 'drought', faction: f, stars: loss, count: farmCount(s, f) });
  return true;
}

const APPLY: Record<RandomEventKind, (c: Ctx) => boolean> = { storm, epidemic, rebels, convoy, defector, luckyFind, drought };

/** Ein Ereignis dieser Art jetzt ausloesen (Tests, Kampagne) / trigger an event of this kind now (tests, campaign) */
export function triggerRandomEvent(s: GameState, kind: RandomEventKind, ev: GameEvent[]): boolean {
  return APPLY[kind]({ s, ev });
}

/**
 * Zu Rundenbeginn (vor dem ersten Zug der Runde): laufende Duerren, dann das geplante Ereignis.
 * Passt das Ereignis nicht zum Spielstand, kommt stattdessen ein Nachschubkonvoi.
 * At the start of a round (before the first turn of the round): ongoing droughts, then the scheduled event.
 * If the event does not fit the state, a supply convoy comes instead.
 */
export function processRandomEvents(s: GameState, ev: GameEvent[]) {
  if (s.droughts?.length) {
    for (const d of s.droughts) {
      if (d.until < s.round || !s.factions[d.faction]?.alive) continue;
      const loss = takeStars(s, d.faction, droughtLoss(s, d.faction));
      ev.push({ t: 'randomEvent', kind: 'drought', faction: d.faction, stars: loss, ongoing: true });
    }
    s.droughts = s.droughts.filter((d) => d.until > s.round);
  }
  if (!s.config.events) return;
  const kind = randomEventFor(s.config.seed, s.round);
  if (!kind) return;
  if (!triggerRandomEvent(s, kind, ev) && kind !== 'convoy') triggerRandomEvent(s, 'convoy', ev);
}
