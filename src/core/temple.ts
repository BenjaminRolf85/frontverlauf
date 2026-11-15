/**
 * Kampagne m4 "Die Kriegsplaene": Fanatiker-Tempel (2x2, unpassierbar) und die Kriegsplaene darin. Eine Landeinheit
 * des Spielers neben dem Tempel birgt die Plaene (Kommando seizePlans, beendet ihren Zug) und traegt sie; neben oder in
 * dem eigenen Hauptquartier sind sie abgeliefert. Stirbt der Traeger, fallen die Plaene auf sein Feld; eine
 * Spielereinheit auf oder neben dem Feld hebt sie mit derselben Aktion auf, eine feindliche Einheit darauf bringt sie
 * zurueck in den Tempel. Solange die Plaene unterwegs sind, schickt der Kult Verfolgerwellen (TEMPLE_PLANS).
 * Alles ist eine reine Funktion des Spielstands und damit deterministisch.
 * Campaign m4 "The War Plans": Fanatic temple (2x2, impassable) and the war plans inside. A player land unit next to
 * the temple seizes the plans (command seizePlans, ends its turn) and carries them; next to or inside the own HQ they
 * are delivered. If the carrier dies, the plans fall onto its tile; a player unit on or next to that tile picks them
 * up with the same action, a hostile unit on it takes them back into the temple. While the plans are on the move the
 * cult sends pursuit waves (TEMPLE_PLANS). Everything is a pure function of the state and therefore deterministic.
 */
import { TEMPLE_PLANS, UNITS, type UnitTypeId } from '../data/balance';
import { dist, isLand, neighbors, tileAt } from './grid';
import { has, hqOf, isHostile, isShip, unitAt } from './queries';
import { nearestTile, revealArea } from './spawn';
import type { CampaignState, ErrorCode, GameEvent, GameState, PlansState, Pos, Unit } from './types';

const PLAYER = 0;
const T = TEMPLE_PLANS;

/** Die vier Felder des Tempels ab dem Anker (oben links) / the four temple tiles from the anchor (top left) */
export const templeTiles = (a: Pos): Pos[] => [{ x: a.x, y: a.y }, { x: a.x + 1, y: a.y }, { x: a.x, y: a.y + 1 }, { x: a.x + 1, y: a.y + 1 }];

/** Abstand eines Feldes zum naechsten Tempelfeld (Schachbrett) / distance of a tile to the nearest temple tile (Chebyshev) */
export function templeDist(a: Pos, q: Pos): number {
  const dx = q.x < a.x ? a.x - q.x : q.x > a.x + 1 ? q.x - a.x - 1 : 0;
  const dy = q.y < a.y ? a.y - q.y : q.y > a.y + 1 ? q.y - a.y - 1 : 0;
  return Math.max(dx, dy);
}

/** Feld gehoert zum Tempel? / tile belongs to the temple? */
export const isTempleTile = (s: GameState, x: number, y: number) => !!tileAt(s, x, y)?.temple;

/** Mitte des Tempels (Weltkoordinaten der Felder) / centre of the temple (tile coordinates) */
export const templeCenter = (a: Pos) => ({ x: a.x + 0.5, y: a.y + 0.5 });

/**
 * Freie Landfelder rund um den Tempel (Abstand 1), zum Hauptquartier des Spielers hin sortiert; dort kann geborgen werden.
 * Free land tiles around the temple (distance 1), sorted towards the player's HQ; seizing works from there.
 */
export function templeRing(s: GameState): Pos[] {
  const a = s.campaign?.temple;
  if (!a) return [];
  const hq = hqOf(s, PLAYER);
  const out: Pos[] = [];
  for (let y = a.y - 1; y <= a.y + 2; y++) for (let x = a.x - 1; x <= a.x + 2; x++) {
    const t = tileAt(s, x, y);
    if (!t || t.temple || !isLand(t) || t.terrain === 'mountain') continue;
    out.push({ x, y });
  }
  // naechstes zuerst, bei Gleichstand das geradlinig naechste / nearest first, ties by straight-line distance
  const e = (p: Pos) => (hq ? (p.x - hq.x) ** 2 + (p.y - hq.y) ** 2 : 0);
  return out.sort((p, q) => (hq ? dist(p, hq) - dist(q, hq) : 0) || e(p) - e(q) || p.y - q.y || p.x - q.x);
}

// ---------- Platzierung / placement ----------

/** Feld fuer den Tempel geeignet? (vor dem Planieren) / tile suitable for the temple? (before levelling) */
function siteOk(s: GameState, q: Pos): boolean {
  const t = tileAt(s, q.x, q.y);
  return !!t && isLand(t) && t.cityId === null && !t.feature && !t.turret && !t.wonderOf && !t.volcano && !t.outpost && !t.grandProject && !unitAt(s, q.x, q.y);
}

/** Landweg (ohne Berge) vom Hauptquartier zu einem Feld neben dem Tempel? / land route (no mountains) from the HQ to a tile next to the temple? */
function landRoute(s: GameState, from: Pos, a: Pos): boolean {
  const seen = new Uint8Array(s.size * s.size);
  const stack: Pos[] = [from];
  seen[from.y * s.size + from.x] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    if (templeDist(a, p) === 1) return true;
    for (const n of neighbors(s.size, p.x, p.y)) {
      const k = n.y * s.size + n.x;
      if (seen[k]) continue;
      const t = s.tiles[k];
      if (!isLand(t) || t.terrain === 'mountain' || t.volcano || templeDist(a, n) === 0) continue;
      seen[k] = 1;
      stack.push(n);
    }
  }
  return false;
}

/**
 * Tempelplatz waehlen: alle 2x2-Anker, deren Felder Land ohne Stadt, Merkmal und Einheit sind, mindestens cityGap von
 * jeder Stadt, hqMin..hqMax vom Hauptquartier des Spielers, mindestens enemyMin vom Kult und ueber Land erreichbar.
 * Bewertung: Abstand nahe hqDistance, zum Kult nahe enemyPref, wenig Berg und Wald; bei Gleichstand der kleinste Index.
 * Findet sich nichts, werden die Grenzen schrittweise gelockert.
 * Choose the temple site: every 2x2 anchor whose tiles are land without city, feature and unit, at least cityGap from
 * every city, hqMin..hqMax from the player's HQ, at least enemyMin from the cult and reachable over land. Score:
 * distance close to hqDistance, to the cult close to enemyPref, little mountain and forest; ties: lowest index. If
 * nothing fits, the bounds are relaxed step by step.
 */
export function chooseTempleSite(s: GameState, home: Pos, enemy: Pos | null): Pos | null {
  for (let relax = 0; relax <= 4; relax++) {
    let best: Pos | null = null, bestV = Infinity;
    for (let y = 1; y < s.size - 2; y++) for (let x = 1; x < s.size - 2; x++) {
      const a = { x, y };
      const tiles = templeTiles(a);
      if (!tiles.every((q) => siteOk(s, q))) continue;
      if (s.cities.some((c) => templeDist(a, c) < T.cityGap)) continue;
      const dh = templeDist(a, home);
      if (dh < T.hqMin - relax || dh > T.hqMax + relax) continue;
      const de = enemy ? templeDist(a, enemy) : T.enemyPref;
      if (de < Math.max(2, T.enemyMin - relax)) continue;
      // mindestens vier begehbare Felder rundherum / at least four walkable tiles around it
      let ring = 0;
      for (let yy = y - 1; yy <= y + 2; yy++) for (let xx = x - 1; xx <= x + 2; xx++) {
        const t = tileAt(s, xx, yy);
        if (t && templeDist(a, { x: xx, y: yy }) === 1 && isLand(t) && t.terrain !== 'mountain') ring++;
      }
      if (ring < 4 || !landRoute(s, home, a)) continue;
      const rough = tiles.reduce((n, q) => { const t = tileAt(s, q.x, q.y)!; return n + (t.terrain === 'mountain' ? 2 : t.terrain === 'forest' ? 0.5 : 0); }, 0);
      const v = Math.abs(dh - T.hqDistance) * 4 + Math.abs(de - T.enemyPref) * 1.5 + rough;
      if (v < bestV) { bestV = v; best = a; }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Tempel setzen: vier Felder werden planierte Ebene (Landschaft des Ankers), Plaene liegen im Tempel; alle kennen den
 * Tempel, der Spieler sieht auch seine Umgebung.
 * Place the temple: four tiles become levelled plain (biome of the anchor), the plans lie inside; everyone knows the
 * temple, the player also sees its surroundings.
 */
export function placeTemple(s: GameState, c: CampaignState, a: Pos, owner: number) {
  const biome = tileAt(s, a.x, a.y)!.biome === 'jungle' ? 'grassland' : tileAt(s, a.x, a.y)!.biome;
  for (const q of templeTiles(a)) {
    const t = tileAt(s, q.x, q.y)!;
    Object.assign(t, {
      terrain: 'plain', resource: null, building: null, road: false, river: false, mine: null, barrier: null, remains: null,
      feature: null, outpost: null, marks: [], tracks: [], temple: true, biome,
    });
    delete t.peak;
  }
  c.temple = { x: a.x, y: a.y };
  c.plans = { at: 'temple', drops: 0, pursuit: 0, owner };
  for (const f of s.factions) revealArea(s, f.index, a.x, a.y, 0);
  for (const q of templeTiles(a)) for (const f of s.factions) revealArea(s, f.index, q.x, q.y, f.index === PLAYER ? 1 : 0);
}

// ---------- Bergen / seizing ----------

/** Darf diese Einheit Plaene tragen? Landeinheiten ohne Flieger, Spione, Wunder und Endgegner / may this unit carry plans? land units except flyers, spies, wonders and bosses */
export function canCarryPlans(u: Unit): boolean {
  return !isShip(u) && !has(u, 'fly') && !has(u, 'wonder') && !has(u, 'boss') && !has(u, 'invisible');
}

/** Traeger der Kriegsplaene (falls getragen) / carrier of the war plans (if carried) */
export function plansCarrier(s: GameState): Unit | undefined {
  const p = s.campaign?.plans;
  return p?.at === 'carried' ? s.units.find((u) => u.id === p.unit) : undefined;
}

/** Traegt diese Einheit die Kriegsplaene? / does this unit carry the war plans? */
export const carriesPlans = (s: GameState, u: Unit) => s.campaign?.plans?.at === 'carried' && s.campaign.plans.unit === u.id;

/** Kann u die Plaene jetzt bergen oder aufheben? / can u seize or pick up the plans right now? */
export function seizeCheck(s: GameState, u: Unit): 'ok' | ErrorCode {
  const c = s.campaign;
  const p = c?.plans;
  if (!c || !p || c.result || s.over) return 'invalid';
  if (u.owner !== PLAYER) return 'wrongFaction';
  if (p.at === 'carried' || p.at === 'delivered') return 'invalid';
  if (!canCarryPlans(u)) return 'cannotCarry';
  const near = p.at === 'temple' ? !!c.temple && templeDist(c.temple, u) <= T.seizeRange : dist(u, { x: p.x ?? -99, y: p.y ?? -99 }) <= T.seizeRange;
  if (!near) return 'outOfRange';
  if (u.fresh || u.exhausted || u.attacked) return 'unitExhausted';
  return 'ok';
}

/** Ziel fuer die Bergen-Aktion: Tempel oder fallen gelassene Plaene in Reichweite? / target of the seize action: temple or dropped plans in reach? */
export function seizeInReach(s: GameState, u: Unit): boolean {
  const r = seizeCheck(s, u);
  return r === 'ok' || r === 'unitExhausted' || r === 'cannotCarry';
}

/** Kommando seizePlans anwenden (vorher seizeCheck) / apply the seizePlans command (seizeCheck first) */
export function seizePlans(s: GameState, u: Unit, ev: GameEvent[]) {
  const c = s.campaign!;
  const p = c.plans!;
  const picked = p.at === 'dropped';
  c.plans = { ...p, at: 'carried', unit: u.id, x: u.x, y: u.y, taken: p.taken ?? s.round, next: Math.max(p.next ?? 0, s.round + 1) };
  u.exhausted = true;
  u.moveDone = true;
  ev.push({ t: 'plans', what: picked ? 'picked' : 'seized', faction: u.owner, unit: u.id, x: u.x, y: u.y });
}

// ---------- Auswertung / evaluation ----------

/** Plaene zurueck in den Tempel / plans back into the temple */
function backToTemple(s: GameState, p: PlansState, ev: GameEvent[], by: number) {
  const a = s.campaign!.temple!;
  s.campaign!.plans = { at: 'temple', drops: p.drops, taken: p.taken, next: p.next, pursuit: p.pursuit, owner: p.owner };
  ev.push({ t: 'plans', what: 'returned', faction: by, x: a.x, y: a.y });
}

/** Stelle fuer fallen gelassene Plaene: das Feld selbst oder das naechste Landfeld ohne Tempel / spot for dropped plans: the tile itself or the nearest land tile without temple */
function dropSpot(s: GameState, at: Pos): Pos {
  return nearestTile(s, at, (q) => { const t = tileAt(s, q.x, q.y)!; return isLand(t) && !t.temple && !t.turret && !t.wonderOf; }) ?? at;
}

/**
 * Zustand der Plaene nach jedem Kommando nachfuehren: Tod oder Bekehrung des Traegers, Abliefern, Rueckholung durch
 * eine feindliche Einheit auf den fallen gelassenen Plaenen.
 * Update the plans after every command: death or conversion of the carrier, delivery, recovery by a hostile unit on
 * the dropped plans.
 */
export function updatePlans(s: GameState, c: CampaignState, ev: GameEvent[]) {
  const p = c.plans;
  if (!p || !c.temple || p.at === 'delivered' || p.at === 'temple') return;
  if (p.at === 'carried') {
    const u = s.units.find((x) => x.id === p.unit);
    if (!u) {
      // gefallen: Plaene liegen auf seinem Feld / fallen: the plans lie on its tile
      const k = ev.find((e) => e.t === 'killed' && e.unit === p.unit);
      const at = k && k.t === 'killed' && k.x !== undefined && k.y !== undefined ? { x: k.x, y: k.y } : { x: p.x ?? c.temple.x, y: p.y ?? c.temple.y };
      const q = dropSpot(s, at);
      c.plans = { ...p, at: 'dropped', unit: undefined, x: q.x, y: q.y, drops: p.drops + 1 };
      revealArea(s, PLAYER, q.x, q.y, 1);
      ev.push({ t: 'plans', what: 'dropped', faction: PLAYER, unit: p.unit, x: q.x, y: q.y });
    } else if (u.owner !== PLAYER) {
      // bekehrt: der Kult hat die Plaene wieder / converted: the cult has the plans again
      backToTemple(s, { ...p, drops: p.drops + 1 }, ev, u.owner);
      return;
    } else {
      p.x = u.x; p.y = u.y;
      const hq = hqOf(s, PLAYER);
      if (hq && dist(u, hq) <= T.deliverRange) {
        c.plans = { ...p, at: 'delivered' };
        ev.push({ t: 'plans', what: 'delivered', faction: PLAYER, unit: u.id, x: u.x, y: u.y });
      }
      return;
    }
  }
  const d = c.plans!;
  if (d.at !== 'dropped') return;
  const occ = unitAt(s, d.x!, d.y!);
  if (occ && occ.owner !== PLAYER && isHostile(s, PLAYER, occ.owner)) backToTemple(s, d, ev, occ.owner);
}

/**
 * Verfolgerwelle faellig? Zu Beginn des Spielerzugs, solange die Plaene unterwegs sind (getragen oder fallen gelassen):
 * Einheiten am Tempel und an den naechsten Kultstaedten, abwechselnd aus TEMPLE_PLANS.pursuitTemple.
 * Pursuit wave due? At the start of the player's turn while the plans are on the move (carried or dropped): units at
 * the temple and at the nearest cult cities, cycling through TEMPLE_PLANS.pursuitTemple.
 */
export function runPursuit(s: GameState, c: CampaignState, ev: GameEvent[], spawn: (type: UnitTypeId, owner: number, near: Pos) => Unit | null) {
  const p = c.plans;
  if (!p || !c.temple || (p.at !== 'carried' && p.at !== 'dropped')) return;
  if (p.pursuit >= T.pursuitWaves || p.next === undefined || s.round < p.next) return;
  const owner = p.owner;
  const fa = s.factions[owner];
  if (!fa?.alive) return;
  const target = { x: p.x ?? c.temple.x, y: p.y ?? c.temple.y };
  const at = templeRing(s).sort((a, b) => dist(a, target) - dist(b, target) || a.y - b.y || a.x - b.x)[0] ?? c.temple;
  const groups: { at: Pos; units: UnitTypeId[] }[] = [{ at, units: T.pursuitTemple[p.pursuit % T.pursuitTemple.length] }];
  const cities = s.cities.filter((x) => x.owner === owner).sort((a, b) => dist(a, target) - dist(b, target) || a.id - b.id).slice(0, T.pursuitCities);
  for (const city of cities) groups.push({ at: city, units: T.pursuitCity });
  let any = false;
  for (const g of groups) {
    let count = 0;
    for (const type of g.units) if (UNITS[type] && spawn(type, owner, g.at)) count++;
    if (!count) continue;
    any = true;
    revealArea(s, PLAYER, g.at.x, g.at.y, 1);
    ev.push({ t: 'wave', faction: owner, count, x: g.at.x, y: g.at.y });
  }
  if (any) fa.stars += T.pursuitStars;
  p.pursuit++;
  p.next = s.round + T.pursuitEvery;
}

/**
 * Felder, die die Oberflaeche markiert: das Hauptquartier, solange die Plaene getragen werden; die Stelle fallen
 * gelassener Plaene. Den Tempel markiert sein Modell selbst.
 * Tiles the UI highlights: the HQ while the plans are carried; the spot of dropped plans. The temple's model marks itself.
 */
export function plansHints(s: GameState): Pos[] {
  const c = s.campaign;
  const p = c?.plans;
  if (!c || !p || c.result || !c.temple) return [];
  // der Tempel selbst ist auffaellig genug; Ringe darauf verdecken ihn / the temple itself stands out; rings on it would hide it
  if (p.at === 'temple') return [];
  if (p.at === 'dropped') return [{ x: p.x!, y: p.y! }];
  if (p.at === 'carried') { const hq = hqOf(s, PLAYER); return hq ? [{ x: hq.x, y: hq.y }] : []; }
  return [];
}
