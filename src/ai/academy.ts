/**
 * KI der schwebenden Akademie (Velkar, ACADEMY): umziehen, wenn ein Landeplatz deutlich naeher an den Zielen liegt oder die
 * Akademie von einer Uebermacht bedroht ist; fliegen und landen ohne Hin und Her (ein Ziel je Flug, Pause nach der Landung).
 * Dazu fuer alle Fraktionen: feindliche Akademien angreifen (Schild, in der Luft Notlandung).
 * AI of the floating academy (Velkar, ACADEMY): relocate when a landing site lies clearly closer to the objectives or the
 * academy is threatened by a superior force; fly and land without dithering (one target per flight, a pause after
 * landing). Plus for all factions: attack hostile academies (shield, in the air an emergency landing).
 * Deterministisch, Gleichstand nach Feldindex / deterministic, ties broken by tile index.
 */
import {
  academyMoves, academyOf, academyTargets, airborne, area, beamTargets, canHitAirborne, dist, shieldHp, idx, isWonder, landCheck, landingOk, liftCheck, type City, type Command,
  type GameState, type Pos, type Unit,
} from '../core';
import { ACADEMY, UNITS } from '../data/balance';
import { worth, type Ctx } from './analysis';
import { cmdKey } from './tactics';

type Failed = Set<string>;
const ok = (failed: Failed, c: Command) => !failed.has(cmdKey(c));

/** Flugziel je Partie und Fraktion / flight target per game and faction */
const targets = new WeakMap<GameState, Map<number, Pos>>();
/** Entscheidung zum Abheben, einmal je Zug / lift decision, once per turn */
const liftMemo = new WeakMap<GameState, Map<number, { key: string; to: Pos | null }>>();

function targetOf(s: GameState, f: number): Pos | undefined { return targets.get(s)?.get(f); }
function setTarget(s: GameState, f: number, p: Pos | null) {
  let m = targets.get(s);
  if (!m) { m = new Map(); targets.set(s, m); }
  if (p) m.set(f, p); else m.delete(f);
}

/** Staerke feindlicher bzw. eigener Einheiten im Umkreis r / strength of hostile or own units within radius r */
function strengthNear(units: Unit[], p: Pos, r: number): number {
  let n = 0;
  for (const u of units) if (!isWonder(u) && UNITS[u.type].attack > 0 && dist(u, p) <= r) n += worth(u) * (u.hp / Math.max(1, u.maxHp));
  return n;
}

/**
 * Guete eines Standorts: nahe an den Zielen (neutrale und feindliche Orte), aber nicht naeher als ACADEMY.ai.frontKeep;
 * Bedrohung und feindliche Staerke kosten, freies Land zum Wachsen bringt etwas.
 * Quality of a site: close to the objectives (neutral and hostile places) but not closer than ACADEMY.ai.frontKeep;
 * threat and hostile strength cost, free land to grow into helps.
 */
function siteScore(ctx: Ctx, p: Pos): number {
  const { s } = ctx;
  let front = 99;
  for (const c of ctx.neutralCities) front = Math.min(front, dist(c, p));
  for (const c of ctx.hostileCities) front = Math.min(front, dist(c, p));
  if (front === 99) front = 6;
  let free = 0;
  for (const q of area(s.size, p.x, p.y, 2)) {
    const t = s.tiles[idx(s.size, q.x, q.y)];
    if (t.territory === null && t.cityId === null && t.terrain !== 'ocean' && t.terrain !== 'shallow') free++;
  }
  const threat = ctx.threat[idx(s.size, p.x, p.y)].length;
  const foes = strengthNear(ctx.enemies, p, 3);
  return -Math.max(front, ACADEMY.ai.frontKeep) - 2.5 * threat - foes / 40 + 0.25 * free;
}

/** Bester Landeplatz im Suchradius (null = keiner) / best landing site within the search radius (null = none) */
function bestSite(ctx: Ctx, ac: City, from: Pos, flee: boolean, radius: number = ACADEMY.ai.search): { p: Pos; v: number } | null {
  const { s } = ctx;
  let best: { p: Pos; v: number } | null = null;
  for (const p of area(s.size, from.x, from.y, radius)) {
    if (!landingOk(s, ac, p)) continue;
    // Flugzeit kostet: keine Produktion, solange sie fliegt / flight time costs: no production while flying
    const turns = 1 + Math.ceil(dist(from, p) / ACADEMY.move);
    const v = flee ? -2.5 * ctx.threat[idx(s.size, p.x, p.y)].length - strengthNear(ctx.enemies, p, 3) / 20 - 0.2 * turns
      : siteScore(ctx, p) - 0.6 * turns;
    if (!best || v > best.v + 1e-9) best = { p, v };
  }
  return best;
}

/**
 * Schwebende Akademie: zum Ziel ziehen und landen. Ohne gueltiges Ziel ein neues waehlen; ist keins zu finden, landet sie,
 * wo sie kann.
 * Floating academy: move towards the target and land. Without a valid target pick a new one; if none can be found, it
 * lands where it can.
 */
export function planAcademyFlight(ctx: Ctx, failed: Failed): Command | null {
  const { s, f } = ctx;
  const ac = academyOf(s, f);
  if (!ac || !ac.air || ac.air.phase !== 'flying') return null;
  let goal = targetOf(s, f);
  if (!goal || !landingOk(s, ac, goal)) {
    // im Suchradius nichts frei: auf der ganzen Karte suchen, damit sie nie ohne Ziel schwebt / nothing free within the search radius: search the whole map so it never floats without a goal
    goal = (bestSite(ctx, ac, ac, false) ?? bestSite(ctx, ac, ac, false, s.size))?.p;
    setTarget(s, f, goal ?? null);
  }
  const land: Command = { type: 'landAcademy', city: ac.id };
  if (goal && goal.x === ac.x && goal.y === ac.y) {
    if (landCheck(s, f, ac) === 'ok' && ok(failed, land)) { setTarget(s, f, null); return land; }
  }
  if (goal) {
    let step: Pos | null = null, bd = dist(ac, goal);
    for (const p of academyMoves(s, ac)) {
      const d = dist(p, goal);
      if (d < bd || (d === bd && step && idx(s.size, p.x, p.y) < idx(s.size, step.x, step.y))) { bd = d; step = p; }
    }
    if (step) {
      const cmd: Command = { type: 'moveAcademy', city: ac.id, to: step };
      if (ok(failed, cmd)) return cmd;
    }
  }
  // kein Fortschritt mehr moeglich: landen, wenn es hier geht / no more progress possible: land if possible here
  if ((!goal || ac.air.steps <= 0 || !academyMoves(s, ac).length) && landCheck(s, f, ac) === 'ok' && ok(failed, land)) {
    if (!goal || (goal.x === ac.x && goal.y === ac.y) || !academyMoves(s, ac).length) { setTarget(s, f, null); return land; }
  }
  return null;
}

/**
 * Abheben: nach der Ausbildung des Zuges, wenn ein Landeplatz um ACADEMY.ai.minGain besser ist (hoechstens alle
 * ACADEMY.ai.cooldown Runden) oder eine Uebermacht (ACADEMY.ai.threatRatio) die Akademie bedroht.
 * Lift-off: after the turn's training, when a landing site is better by ACADEMY.ai.minGain (at most every
 * ACADEMY.ai.cooldown rounds) or a superior force (ACADEMY.ai.threatRatio) threatens the academy.
 */
export function planAcademyLift(ctx: Ctx, failed: Failed): Command | null {
  const { s, f } = ctx;
  const ac = academyOf(s, f);
  if (!ac || airborne(ac) || liftCheck(s, f, ac) !== 'ok') return null;
  const cmd: Command = { type: 'liftAcademy', city: ac.id };
  if (!ok(failed, cmd)) return null;
  const key = `${s.round}:${ctx.my.length}:${ctx.enemies.length}`;
  let m = liftMemo.get(s);
  if (!m) { m = new Map(); liftMemo.set(s, m); }
  const memo = m.get(f);
  if (memo && memo.key === key) return memo.to ? cmd : null;
  let to: Pos | null = null;
  const foes = strengthNear(ctx.enemies, ac, 2);
  const own = strengthNear(ctx.my, ac, 1);
  // Flucht nur ohne Schild und nur vor Bodentruppen: Flieger, Flak und Panzer holen sie in der Luft ohnehin herunter
  // flee only without a shield and only from ground troops: flyers, flak and tanks would bring it down in the air anyway
  const hunters = ctx.enemies.some((e) => dist(e, ac) <= 3 && canHitAirborne(e));
  if (shieldHp(ac) <= 0 && !hunters && foes > 0 && foes > ACADEMY.ai.threatRatio * (own + 10)) {
    to = bestSite(ctx, ac, ac, true)?.p ?? null;
  } else {
    const last = ac.calm !== undefined ? ac.calm - 1 : 0;
    if (s.round - last >= ACADEMY.ai.cooldown && foes === 0) {
      const best = bestSite(ctx, ac, ac, false);
      if (best && best.v - siteScore(ctx, ac) >= ACADEMY.ai.minGain) to = best.p;
    }
  }
  m.set(f, { key, to });
  if (!to) return null;
  setTarget(s, f, to);
  return cmd;
}

/**
 * Feindliche Akademie angreifen: Schild oder (schwebend ohne Schild) Notlandung erzwingen; zuerst die staerkste Einheit.
 * Attack a hostile academy: the shield or (floating without a shield) force an emergency landing; strongest unit first.
 */
export function planAcademyStrike(ctx: Ctx, failed: Failed): Command | null {
  const { s } = ctx;
  if (!s.cities.some((c) => c.academy && c.owner !== ctx.f)) return null;
  const units = ctx.my.slice().sort((a, b) => UNITS[b.type].attack - UNITS[a.type].attack || a.id - b.id);
  for (const u of units) {
    for (const c of academyTargets(s, u)) {
      // wer auf der Akademie steht, nimmt sie ein, sobald der Schild faellt: nicht selbst schiessen (sonst kein Einnehmen mehr)
      // whoever stands on the academy captures it once the shield falls: do not shoot itself (otherwise no capture any more)
      if (u.x === c.x && u.y === c.y && !c.air) continue;
      const cmd: Command = { type: 'attackAcademy', unit: u.id, city: c.id };
      if (ok(failed, cmd)) return cmd;
    }
  }
  return null;
}

/**
 * Verstaerkung per Beamer: eine Einheit an der Akademie (nicht die Besatzung auf dem Akademiefeld) springt zum Relay, das
 * ihrem Ziel am naechsten liegt, wenn es dem Ziel mindestens ACADEMY.ai.beamGain Felder naeher ist als die Einheit.
 * Reinforcement by beamer: a unit at the academy (not the garrison on the academy tile) jumps to the relay closest to its
 * goal if it is at least ACADEMY.ai.beamGain tiles closer to the goal than the unit.
 */
export function planBeam(ctx: Ctx, failed: Failed): Command | null {
  const { s, f } = ctx;
  const ac = academyOf(s, f);
  if (!ac || !s.cities.some((c) => c.relay && c.owner === f)) return null;
  for (const u of ctx.my) {
    if (u.x === ac.x && u.y === ac.y) continue;
    if (dist(u, ac) > 1) continue;
    const g = ctx.goals.get(u.id);
    if (!g || g.x < 0 || g.kind === 'defend' || g.kind === 'home' || g.kind === 'retreat' || g.kind === 'refuel') continue;
    let best: City | null = null, bd = dist(u, g) - ACADEMY.ai.beamGain;
    for (const c of beamTargets(s, u)) {
      const d = dist(c, g);
      if (d < bd || (d === bd && best && c.id < best.id)) { bd = d; best = c; }
    }
    if (!best) continue;
    const cmd: Command = { type: 'beam', unit: u.id, city: best.id };
    if (ok(failed, cmd)) return cmd;
  }
  return null;
}
