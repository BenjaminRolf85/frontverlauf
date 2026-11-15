/**
 * KI fuer Geschuetzstellungen (Festungsbau, Dravon): Bauplaetze an bedrohten Grenzstaedten, Engstellen und nahe der Front,
 * Pioniere zu diesen Staedten schicken, Technik und Ausbildung. Gegner meiden Stellungen mit schwachen Einheiten und
 * greifen sie an, wenn es sich lohnt (gunAttackValue, gunDanger in tactics.ts).
 * AI for gun emplacements (fortification, Dravon): sites at threatened border cities, chokepoints and near the front,
 * sending pioneers to those cities, tech and training. Opponents avoid emplacements with weak units and attack them
 * when worthwhile (gunAttackValue, gunDanger in tactics.ts).
 */
import {
  area, dist, emplacementLimit, emplacementTargets, emplacementsOf, factionVictoryOn, hasFortification, idx, isLand, neighbors, territoryOwner, victoryTechOf,
  type City, type Pos, type Unit,
} from '../core';
import { EMPLACEMENT, UNITS } from '../data/balance';
import type { Ctx, Goal } from './analysis';

const A = EMPLACEMENT.ai;

/** Freie Plaetze fuer Stellungen / free emplacement slots */
export function freeEmplacementSlots(ctx: Ctx): number {
  if (!hasFortification(ctx.s, ctx.f)) return 0;
  return Math.max(0, emplacementLimit(ctx.s, ctx.f) - emplacementsOf(ctx.s, ctx.f).length);
}

/** Durchgang fuer Landeinheiten (fuer Engstellen) / passage for land units (for chokepoints) */
function open(ctx: Ctx, x: number, y: number): boolean {
  const t = ctx.s.tiles[idx(ctx.size, x, y)];
  return isLand(t) && !t.turret && !t.wonderOf;
}

/**
 * Wuerde eine Stellung auf p einen Durchgang trennen? Die offenen Nachbarfelder muessen untereinander verbunden bleiben
 * (8er-Nachbarschaft), sonst sperrt sie den eigenen Truppen den Weg.
 * Would an emplacement on p cut a passage? The open neighbour tiles must stay connected to each other
 * (8-neighbourhood), otherwise it blocks the own troops' way.
 */
function cutsPassage(ctx: Ctx, p: Pos): boolean {
  const ring = neighbors(ctx.size, p.x, p.y).filter((q) => open(ctx, q.x, q.y));
  if (ring.length <= 1) return false;
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const i = stack.pop()!;
    ring.forEach((q, j) => { if (!seen.has(j) && dist(q, ring[i]) === 1) { seen.add(j); stack.push(j); } });
  }
  return seen.size < ring.length;
}

/**
 * Bedrohung einer Stadt: naechster sichtbarer Gegner oder feindliche Stadt (kleiner = bedrohter).
 * Threat to a city: nearest visible enemy or hostile city (smaller = more threatened).
 */
function cityThreat(ctx: Ctx, c: Pos): number {
  let d = 20;
  for (const e of ctx.enemies) if (UNITS[e.type].attack > 0) d = Math.min(d, dist(e, c));
  for (const h of ctx.hostileCities) d = Math.min(d, dist(h, c) + 1);
  return d;
}

/** Hat die Stadt schon eine eigene Stellung in der Naehe? / does the city already have an own emplacement nearby? */
const covered = (ctx: Ctx, c: Pos) => emplacementsOf(ctx.s, ctx.f).some((g) => dist(g, c) <= A.cityRange);

/**
 * Bester Bauplatz neben u mit Wert, oder null: Gegner im Anmarsch, Grenzfelder, Engstellen, Strassen, Stadt in Schussweite.
 * Ohne Bedrohung nur an Grenzstaedten und mit Sternepolster. Die Stadt bleibt zugaenglich.
 * Best site next to u with its value, or null: approaching enemies, border tiles, chokepoints, roads, city within range.
 * Without a threat only at border cities and with a star cushion. The city stays accessible.
 */
export function emplacementOption(ctx: Ctx, u: Unit): { x: number; y: number; v: number } | null {
  const { s, f } = ctx;
  if (!freeEmplacementSlots(ctx) || ctx.fa.stars < EMPLACEMENT.cost) return null;
  let best: { x: number; y: number; v: number } | null = null;
  for (const p of emplacementTargets(s, u)) {
    let city: City | null = null, dc = Infinity;
    for (const c of ctx.myCities) { const d = dist(c, p); if (d < dc) { dc = d; city = c; } }
    if (!city || dc > A.cityRange || covered(ctx, city)) continue;
    // Stadt nicht zubauen: genug freie Nachbarfelder bleiben / do not wall in the city: enough free neighbours stay
    let free = 0;
    for (const q of neighbors(s.size, city.x, city.y)) if ((q.x !== p.x || q.y !== p.y) && open(ctx, q.x, q.y)) free++;
    if (free < 3) continue;
    let threat = 0;
    for (const e of ctx.enemies) {
      if (UNITS[e.type].attack <= 0) continue;
      const de = dist(e, p);
      if (de <= A.threatRange && de <= dist(e, city) + 1) threat = Math.max(threat, A.threatRange + 3 - de);
    }
    // Grenze: Felder in Schussweite ausserhalb des eigenen Gebiets, feindliches Gebiet zaehlt doppelt
    // border: tiles within range outside own territory, hostile territory counts double
    let border = 0;
    for (let dy = -EMPLACEMENT.range; dy <= EMPLACEMENT.range; dy++) for (let dx = -EMPLACEMENT.range; dx <= EMPLACEMENT.range; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x < 0 || y < 0 || x >= s.size || y >= s.size) continue;
      const t = s.tiles[idx(s.size, x, y)];
      if (!isLand(t)) continue;
      const o = territoryOwner(s, t);
      if (o !== f) border += o !== null ? 2 : 1;
    }
    // nie einen Durchgang sperren; Engstelle = viel Unpassierbares in Schussweite / never block a passage; chokepoint = much impassable ground within range
    if (cutsPassage(ctx, p)) continue;
    let blocked = 0;
    for (const q of area(s.size, p.x, p.y, EMPLACEMENT.range)) if (!open(ctx, q.x, q.y)) blocked++;
    const front = cityThreat(ctx, city);
    const t = s.tiles[idx(s.size, p.x, p.y)];
    // Strassen frei halten / keep roads free
    let v = threat + border * 0.5 + blocked * 0.4 - (t.road ? 3 : 0) + (dc <= EMPLACEMENT.range ? 2 : 0) + Math.max(0, 8 - front);
    // bedroht: auch mit dem letzten Stern; sonst nur mit Polster an Grenzstaedten / threatened: even with the last star; otherwise only with a cushion at border cities
    if (!threat && (front > A.threatRange + 2 || ctx.fa.stars < EMPLACEMENT.cost + A.reserve)) continue;
    if (v < A.minValue) continue;
    if (t.terrain === 'mountain') v += 1; // Dravon liebt Berge / Dravon loves mountains
    if (!best || v > best.v) best = { x: p.x, y: p.y, v };
  }
  return best;
}

/**
 * Ziel fuer Bauer, solange ein Platz frei ist: die bedrohteste eigene Stadt ohne Stellung; null = normale Ziele.
 * Goal for builders while a slot is free: the most threatened own city without an emplacement; null = normal goals.
 */
export function emplacementGoal(ctx: Ctx, u: Unit): Goal | null {
  if (!EMPLACEMENT.builders.includes(u.type) || !freeEmplacementSlots(ctx)) return null;
  if (ctx.fa.stars < EMPLACEMENT.cost) return null;
  let best: City | null = null, bs = Infinity;
  for (const c of ctx.myCities) {
    if (covered(ctx, c)) continue;
    const sc = cityThreat(ctx, c) * 2 + dist(u, c) * 0.5;
    if (sc < bs) { bs = sc; best = c; }
  }
  if (!best || cityThreat(ctx, best) > A.threatRange + 4) return null;
  return { kind: 'support', x: best.x, y: best.y, value: 25, cap: 99, distW: 0, src: `t${best.y * ctx.size + best.x}l`, water: false, targetId: best.id };
}

/** Zusaetzlicher Pionier-Anteil, solange Plaetze frei und keine Bauer da sind / extra pioneer share while slots are free and no builders exist */
export function emplacementPioneerShare(ctx: Ctx): number {
  if (!freeEmplacementSlots(ctx)) return 0;
  const builders = ctx.my.filter((o) => EMPLACEMENT.builders.includes(o.type)).length;
  return builders ? 0 : A.pioneerShare;
}

/**
 * Zuschlag fuer die Technik der Bauer (Befestigung): erst ab der Spielmitte und mit mehreren Staedten, frueh zaehlt die Ausbreitung.
 * Bonus for the builders' tech (Fortification): only from mid game and with several cities, early on expansion counts.
 */
export function emplacementTechBonus(ctx: Ctx): number {
  if (!hasFortification(ctx.s, ctx.f) || ctx.s.round < A.techRound || ctx.myCities.length < A.techCities) return 0;
  // Punktespiel: erst die eigene Siegtechnologie (Waal), dann Festungsbau / points game: the own victory tech (Waal) first, then fortification
  if (ctx.points && factionVictoryOn(ctx.s) && !ctx.fa.techs.includes(victoryTechOf(ctx.s, ctx.f))) return 0;
  // Eroberung: Stellungen halten eroberte Grenzstaedte, die KI forscht dort sonst kaum / conquest: emplacements hold conquered border cities, the AI hardly researches there otherwise
  return A.techBonus * (ctx.conquest ? A.techConquest : 1);
}
