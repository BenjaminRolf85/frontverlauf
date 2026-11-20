/**
 * KI: Wert eines Stuetzpunkts (BASES) nach Art und Fraktion, zusaetzlich zum Wert des Orts. Fuer Einnahme-, Angriffs- und
 * Verteidigungsziele (analysis.ts). Zahlen: BASES.ai.
 * AI: worth of a base (BASES) by kind and faction, on top of the worth of the place. For capture, attack and defence goals
 * (analysis.ts). Numbers: BASES.ai.
 */
import { baseGap, holdsBase, isAlienFaction, rosterUnits, usesSites, type City, type GameState } from '../core';
import { BASES, NEXUS, PRODUCTION, type BaseKind } from '../data/balance';

/**
 * Was Fraktion f von diesem Stuetzpunkt sachlich haette (0 fuer gewoehnliche Orte): Sterne, Energie (NEXUS), eingebaute
 * Staette (Menschen, nur wenn sie Einheiten daraus haben und die Staette nicht ohnehin ueberall haben), Rabatt (Zyrr, Kult,
 * NEXUS, nur der erste Stuetzpunkt der Art), Ersatz-Sterne ohne passende Einheit, getragene Einheiten, Schutz, Heilung,
 * staerkere Fusstruppen, Xeno-Boden der Fabrik (Zyrr).
 * What faction f would objectively get from this base (0 for ordinary places): stars, energy (NEXUS), built-in site
 * (humans, only if they have units from it and do not have the site everywhere anyway), discount (Zyrr, cult, NEXUS, only
 * the first base of the kind), substitute stars without a matching unit, supported units, protection, healing, stronger
 * foot troops, the factory's xeno ground (Zyrr).
 */
export function baseWorth(s: GameState, f: number, c: City): number {
  const kind = c.base;
  const fa = s.factions[f];
  if (!kind || !fa) return 0;
  const A = BASES.ai;
  let v = 0;
  const energy = BASES.energy[kind];
  if (energy !== undefined && fa.id === NEXUS.faction) v += energy * A.perEnergy;
  else v += (BASES.stars[kind] ?? 0) * A.perStar;
  const site = BASES.sites[kind];
  if (baseGap(kind, fa.id)) v += BASES.gapStars * A.perStar;
  else if (site && usesSites(s, f)) {
    const everywhere = PRODUCTION.citySites[fa.id]?.includes(site);
    const useful = site === 'navalBase' || rosterUnits(s, f).some((t) => PRODUCTION.units[site].includes(t));
    if (useful && !everywhere) v += A.site;
  } else if (BASES.discountUnits[kind] && (!holdsBase(s, f, kind) || c.owner === f)) v += A.discount;
  v += (BASES.units[kind] ?? 0) * A.perUnit;
  v += (BASES.defense[kind] ?? 0) * A.perDefense;
  if (kind === 'fieldHospital') v += A.heal;
  if (kind === 'barracks') v += A.footHp;
  if (kind === 'factory' && isAlienFaction(s, f)) v += A.xeno;
  return v;
}

/**
 * Vorliebe der Fraktionsgruppe fuer diese Art (Spielerwunsch): Menschen ziehen die militaerischen Stuetzpunkte vor, die Zyrr
 * die Fabrik, NEXUS die Kraftwerke; der Kult hat keine. Fester, kleiner Zuschlag (BASES.ai.prefer).
 * Preference of the faction group for this kind (player request): humans prefer the military bases, the Zyrr the factory,
 * NEXUS the power kinds; the cult has none. A small fixed bonus (BASES.ai.prefer).
 */
export function basePreference(s: GameState, f: number, kind: BaseKind | undefined): number {
  const fa = s.factions[f];
  if (!kind || !fa) return 0;
  const P = BASES.ai.prefer;
  if (usesSites(s, f)) return BASES.military.includes(kind) ? P.human : 0;
  if (isAlienFaction(s, f)) return kind === 'factory' ? P.zyrr : 0;
  if (fa.id === NEXUS.faction) return BASES.energy[kind] !== undefined ? P.nexus : 0;
  return 0;
}

/** Zuschlag fuer das Einnehmen eines neutralen Stuetzpunkts: sachlicher Wert plus Vorliebe / bonus for capturing a neutral base: objective worth plus preference */
export const baseCaptureWorth = (s: GameState, f: number, c: City): number => baseWorth(s, f, c) + basePreference(s, f, c.base);

/**
 * Zuschlag fuer den Angriff auf einen feindlichen Stuetzpunkt: der eigene Nutzen samt Vorliebe und, wenn er NEXUS Energie
 * liefert, der Schaden fuer NEXUS (die Kraftwerke sind sein Ziel: wer eines wegnimmt, nimmt ihm Rechenleistung).
 * Bonus for attacking a hostile base: the own benefit with the preference and, if it gives NEXUS energy, the damage to
 * NEXUS (the power kinds are its target: taking one away takes compute from it).
 */
export function baseAttackWorth(s: GameState, f: number, c: City): number {
  if (!c.base || c.owner === null) return 0;
  let v = baseCaptureWorth(s, f, c);
  const energy = BASES.energy[c.base];
  if (energy !== undefined && s.factions[c.owner]?.id === NEXUS.faction) v += energy * BASES.ai.denyEnergy;
  return v;
}

/** Zuschlag fuer die Verteidigung eines eigenen Stuetzpunkts (Anteil BASES.ai.defendShare) / bonus for defending an own base (share BASES.ai.defendShare) */
export const baseDefendWorth = (s: GameState, f: number, c: City): number => baseCaptureWorth(s, f, c) * BASES.ai.defendShare;
