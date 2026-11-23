/**
 * KI der Produktionsstaetten (nur Menschen): welche Stadt welche Staette baut. Jede ausbildende Stadt braucht eine Kaserne,
 * je eine Staette jeder Art wird frueh gesucht (Ruestungswerk und Fahrzeugwerk zuerst), spaeter Panzerwerk und Flugfeld;
 * die Stadt mit den meisten freien Plaetzen und den wenigsten Staetten bekommt den Zuschlag (Spezialisierung).
 * Dazu die Rohstoffe: Tagebau fuer das Panzerwerk, Forstbetrieb fuer die Geschuetzgiesserei.
 * AI of the production sites (humans only): which city builds which site. Every training city needs barracks, one site
 * of each kind is wanted early (armoury and motor pool first), later tank works and airfield; the city with the most
 * free slots and the fewest sites gets the job (specialisation). Plus the raw materials: a mine for the tank works, a
 * lumber camp for the foundry.
 */
import {
  buildCheck, citySites, cityTiles, factionVariant, freeUnitSlots, noTraining, rosterUnits, siteNeed, siteOf, usesSites, type City, type Command, type GameState,
} from '../core';
import { AI, BUILDINGS, PRODUCTION, SPARK, type BuildingId, type ProductionSiteId, type UnitTypeId } from '../data/balance';
import type { Ctx } from './analysis';
import { hashNoise } from './profile';
import { sparkFront } from './divineSpark';

/** Kaufwunsch wie in economy.ts / purchase wish as in economy.ts */
export interface SiteBuy { cmd: Command; cost: number; value: number; save: boolean }

/** Staetten in fester Reihenfolge der Prioritaet / sites in fixed order of priority */
const ORDER: ProductionSiteId[] = ['trainingCamp', 'armory', 'motorPool', 'foundry', 'tankWorks', 'airfield', 'navalBase', 'dryDock'];

/** Anzahl Staedte der Fraktion mit dieser Staette / number of the faction's cities with this site */
function siteCount(ctx: Ctx, site: ProductionSiteId): number {
  return ctx.myCities.filter((c) => citySites(ctx.s, c).includes(site)).length;
}

/** Hat irgendeine eigene Stadt die Staette? / does any own city have the site? */
export function factionHasSite(ctx: Ctx, site: ProductionSiteId): boolean {
  return siteCount(ctx, site) > 0;
}

/**
 * Grundwert einer Staette fuer die Fraktion (vor Stadtwahl): erste Staette jeder Art viel, weitere wenig.
 * Base worth of a site for the faction (before choosing the city): the first site of each kind a lot, further ones little.
 */
function siteWorth(ctx: Ctx, site: ProductionSiteId, counters: { antiVehicle: number; antiAir: number }): number {
  const { s } = ctx;
  const n = siteCount(ctx, site);
  const cities = ctx.myCities.length;
  const r = s.round;
  // keine eigene Einheit aus dieser Staette (Meridon: kein Panzerwerk) / no own unit from this site (Meridon: no tank works)
  if (site !== 'navalBase' && site !== 'dryDock' && !rosterUnits(s, ctx.f).some((t) => PRODUCTION.units[site].includes(t))) return 0;
  switch (site) {
    // erste Staette jeder Art: etwa so wertvoll wie ein Wirtschaftsgebaeude, ab Runde 2 / first site of each kind: about as worth as an economy building, from round 2
    case 'armory': return n === 0 ? (r >= 2 ? 40 : 0) + (counters.antiVehicle + counters.antiAir) * 40 : cities >= 4 && n < 2 ? 8 : 0;
    case 'motorPool': return n === 0 ? (r >= 2 ? 26 : 0) + (r >= 2 && ctx.fa.explored.some((e) => !e) ? 6 : 0) : cities >= 5 && n < 2 ? 6 : 0;
    // Alvenia: der Goettliche Funke kommt aus der Giesserei (SPARK.ai.foundryBonus) / Alvenia: the Divine Spark comes from the foundry (SPARK.ai.foundryBonus)
    case 'foundry': {
      const spark = r >= SPARK.ai.minRound && rosterUnits(s, ctx.f).includes(SPARK.unit) && sparkFront(ctx) ? SPARK.ai.foundryBonus : 0;
      return n === 0 ? (r >= 4 ? 22 : 0) + (r >= 4 && ctx.hostileCities.length ? 12 : 0) + spark : cities >= 5 && n < 2 ? 6 : 0;
    }
    // Korvat: der Steppenkoloss macht das Panzerwerk wertvoller (AI.colossusWorks) / Korvat: the Steppe Colossus makes the tank works worth more (AI.colossusWorks)
    case 'tankWorks': {
      const heavy = factionVariant(s, ctx.f, 'tank') === 'steppeColossus' ? AI.colossusWorks : 0;
      return n === 0 ? (r >= 5 ? 44 + Math.min(20, r) + heavy : 0) : cities >= (heavy ? 4 : 5) && n < 2 ? 14 + heavy : 0;
    }
    case 'airfield': return n === 0 && r >= 8 ? 40 : 0;
    case 'dryDock': return n === 0 && ctx.navalNeed && r >= 8 ? 16 : 0;
    default: return 0;
  }
}

/**
 * Kaufwuensche fuer Produktionsstaetten und ihre Rohstoffe. popVal = Wert eines Bevoelkerungspunkts (economy.ts).
 * Purchase wishes for production sites and their raw materials. popVal = worth of one population point (economy.ts).
 */
export function productionBuys(ctx: Ctx, popVal: number, counters: { antiVehicle: number; antiAir: number }): SiteBuy[] {
  const { s, f, prof } = ctx;
  if (!usesSites(s, f)) return [];
  const out: SiteBuy[] = [];
  const worth = new Map<ProductionSiteId, number>();
  for (const site of ORDER) worth.set(site, siteWorth(ctx, site, counters));
  for (const c of ctx.myCities) {
    // Wohnbloecke und Supermarkt: keine Produktionsstaetten (bilden nie aus) / residential blocks and supermarket: no production sites (they never train)
    if (noTraining(c)) continue;
    const have = citySites(s, c);
    const free = freeUnitSlots(s, c);
    for (const site of ORDER) {
      if (site === 'navalBase' || have.includes(site)) continue;
      let value: number;
      if (site === 'trainingCamp') {
        // ohne Kaserne bildet die Stadt nichts aus / without barracks the city trains nothing
        value = 8 + 6 * Math.min(4, free);
      } else {
        const w = worth.get(site) ?? 0;
        if (w <= 0) continue;
        // Spezialisierung: Stadt mit Kaserne, freien Plaetzen und wenigen Staetten / specialisation: city with barracks, free slots and few sites
        if (!have.includes('trainingCamp')) continue;
        value = w + 2 * Math.min(4, free) - 3 * (have.length - 1);
      }
      value = value * prof.militaryW + BUILDINGS[site].pop * popVal;
      const spot = siteSpot(s, f, c, site);
      if (!spot) continue;
      if (prof.sloppy > 0) value *= 1 + (hashNoise(spot.x, spot.y, s.round, 13) - 0.5) * prof.sloppy;
      out.push({ cmd: { type: 'build', building: site, x: spot.x, y: spot.y }, cost: spot.cost, value, save: true });
    }
  }
  return out;
}

/** Freies Feld fuer die Staette in Stadt c (bebaubar oder nur zu wenig Sterne) / free tile for the site in city c (buildable or only short of stars) */
function siteSpot(s: GameState, f: number, c: City, site: ProductionSiteId): { x: number; y: number; cost: number } | null {
  for (const p of cityTiles(s, c)) {
    const chk = buildCheck(s, f, site, p.x, p.y);
    if (chk.ok || chk.error === 'notEnoughStars') return { x: p.x, y: p.y, cost: chk.cost };
  }
  return null;
}

/**
 * Zuschlag fuer einen Rohstoff-Bau (Tagebau, Forstbetrieb), wenn die Fraktion eine Staette will, die ihn braucht, und in
 * dieser Stadt noch keiner steht.
 * Bonus for a raw-material building (mine, lumber camp) if the faction wants a site that needs it and this city has none yet.
 */
export function materialBonus(ctx: Ctx, c: City, b: BuildingId, counters: { antiVehicle: number; antiAir: number }): number {
  const { s, f } = ctx;
  if (!usesSites(s, f)) return 0;
  for (const site of ['tankWorks', 'foundry'] as ProductionSiteId[]) {
    const need = PRODUCTION.needs[site] ?? [];
    if (!need.includes(b) || factionHasSite(ctx, site) || !siteNeed(s, c, site)) continue;
    const w = siteWorth(ctx, site, counters);
    if (w > 0 && citySites(s, c).includes('trainingCamp')) return w * 0.6;
  }
  return 0;
}

/** Kann Stadt c diesen Typ grundsaetzlich ausbilden (Staette vorhanden)? / can city c train this type at all (site present)? */
export function siteFor(s: GameState, c: City, t: UnitTypeId): boolean {
  if (!usesSites(s, c.owner)) return true;
  const site = siteOf(t);
  return !site || citySites(s, c).includes(site);
}
