/**
 * KI-Profile je Schwierigkeit, Fraktion und Spielmodus.
 * AI profiles per difficulty, faction and game mode.
 */
import type { Difficulty, FactionId, UnitTypeId } from '../data/balance';
import type { GameState } from '../core';

export interface Profile {
  difficulty: Difficulty;
  /** gewuenschte Einheiten je Stadt / desired units per city */
  armyPerCity: number;
  /** Angriffslust / aggression */
  aggression: number;
  /** Mindestwert fuer einen Angriff / minimum value for an attack */
  attackMin: number;
  /** Gewicht der Gefahr / weight of danger */
  caution: number;
  /** jede n-te Einheit bleibt pro Runde stehen (0 = nie) / every n-th unit idles per round (0 = never) */
  lazy: number;
  /** auf teure Ziele sparen / save for expensive goals */
  saving: boolean;
  /** Rueckzug unter diesem LP-Anteil / retreat below this HP share */
  retreatHp: number;
  researchW: number;
  buildW: number;
  militaryW: number;
  explorers: number;
  /** Anteil deterministisch schwacher Entscheidungen / share of deterministic weak choices */
  sloppy: number;
  /** Einheitenvorlieben / unit preferences */
  pref: Partial<Record<UnitTypeId, number>>;
  embassyW: number;
  /** Aussenposten bauen / build outposts */
  outposts: boolean;
  /** Spione/Sanitaeter gezielt einsetzen / use spies and medics deliberately */
  specials: boolean;
  /** Spaetphase der Eroberung 0..0.8 / late conquest phase 0..0.8 */
  late: number;
}

const BASE: Record<Difficulty, Omit<Profile, 'pref' | 'embassyW' | 'late'>> = {
  easy: {
    difficulty: 'easy', armyPerCity: 1.2, aggression: 0.6, attackMin: -6, caution: 0.35, lazy: 3, saving: false,
    retreatHp: 0, researchW: 1, buildW: 0.8, militaryW: 0.8, explorers: 1, sloppy: 0.35, outposts: false, specials: false,
  },
  normal: {
    difficulty: 'normal', armyPerCity: 1.8, aggression: 0.9, attackMin: -1.5, caution: 0.75, lazy: 0, saving: true,
    retreatHp: 0.3, researchW: 0.5, buildW: 1.2, militaryW: 1, explorers: 2, sloppy: 0.1, outposts: true, specials: true,
  },
  hard: {
    difficulty: 'hard', armyPerCity: 2.2, aggression: 1.05, attackMin: -0.5, caution: 1, lazy: 0, saving: true,
    retreatHp: 0.35, researchW: 0.5, buildW: 1.2, militaryW: 1.1, explorers: 2, sloppy: 0, outposts: true, specials: true,
  },
  extreme: {
    difficulty: 'extreme', armyPerCity: 2.6, aggression: 1.25, attackMin: 0, caution: 1.1, lazy: 0, saving: true,
    retreatHp: 0.4, researchW: 0.52, buildW: 1.25, militaryW: 1.2, explorers: 2, sloppy: 0, outposts: true, specials: true,
  },
};

/** Profil fuer Fraktion f im Zustand s / profile for faction f in state s */
export function profileFor(s: GameState, f: number): Profile {
  const fa = s.factions[f];
  const p: Profile = { ...BASE[fa.difficulty] ?? BASE.normal, pref: {}, embassyW: 1, late: 0 };
  const id: FactionId = fa.id;
  // Fraktions-Perks / faction perks
  switch (id) {
    case 'korvat': p.armyPerCity += 0.6; p.pref = { infantry: 1.5, steppeRider: 1.3 }; break; // Massenmobilisierung / mass mobilisation
    case 'dravon': p.aggression += 0.3; p.militaryW += 0.15; p.pref = { jeep: 1.6, mg: 1.2, stormbreaker: 1.3 }; break; // Drill
    case 'alvenia': p.embassyW = 2; p.pref = { medic: 1.6, peacekeeper: 1.3 }; break; // Buendnispolitik / alliance policy
    case 'meridon': p.buildW += 0.25; p.pref = { spy: 1.5 }; break; // Wachstum, Kueste / boom, coast
    case 'velkar': p.researchW += 0.1; p.pref = { pioneer: 1.4, protoWalker: 1.2 }; break; // Forschungsvorsprung / research lead
  }
  // Eroberung oder Sandkasten ohne Rundenlimit / conquest or sandbox without round limit
  if (s.config.mode === 'conquest' || s.config.roundLimit === null) {
    p.aggression += 0.35; p.armyPerCity += 0.6; p.militaryW += 0.2;
    // spaete Runden: Stellungskriege aufbrechen (ab Runde 20) / late rounds: break up trench wars (from round 20)
    const late = Math.min(0.8, Math.max(0, s.round - 20) * 0.02);
    p.aggression += late; p.caution *= 1 - late * 0.5; p.attackMin -= late * 3; p.late = late;
  } else if (s.config.roundLimit !== null) {
    // Punktemodus: ab der Spielmitte offensiver / points mode: more offensive from mid-game
    const late = Math.min(0.4, Math.max(0, s.round - s.config.roundLimit * 0.4) * 0.025);
    p.aggression += late; p.caution *= 1 - late * 0.5; p.attackMin -= late * 2; p.late = late;
  }
  return p;
}

/** Deterministisches Pseudo-Rauschen aus Zahlen (kein Math.random) / deterministic pseudo noise from numbers */
export function hashNoise(...xs: number[]): number {
  let h = 0x9e3779b9 | 0;
  for (const x of xs) {
    h ^= (x | 0) + 0x7f4a7c15 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  }
  h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
}
