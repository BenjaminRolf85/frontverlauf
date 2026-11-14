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
  /** Zusatzwert fuer unbewachte feindliche Staedte (Ueberfaelle, Flanken) / extra value for undefended enemy cities (raids, flanks) */
  raid: number;
}

const BASE: Record<Difficulty, Omit<Profile, 'pref' | 'embassyW' | 'late' | 'raid'>> = {
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
  const p: Profile = { ...BASE[fa.difficulty] ?? BASE.normal, pref: {}, embassyW: 1, late: 0, raid: 0 };
  const id: FactionId = fa.id;
  // Fraktions-Perks / faction perks
  switch (id) {
    case 'korvat': p.armyPerCity += 0.6; p.pref = { infantry: 1.5 }; break; // Massenmobilisierung / mass mobilisation
    case 'dravon': p.aggression += 0.3; p.militaryW += 0.15; p.pref = { jeep: 1.6, mg: 1.2 }; break; // Drill
    case 'alvenia': p.embassyW = 2; p.pref = { medic: 1.6 }; break; // Buendnispolitik / alliance policy
    case 'meridon': p.buildW += 0.25; p.pref = { spy: 1.5 }; break; // Wachstum, Kueste / boom, coast
    case 'velkar': p.researchW += 0.1; p.pref = { pioneer: 1.4 }; break; // Forschungsvorsprung / research lead
    // Zyrr: opportunistische Pluenderer, Gleiter und Dreibeiner umgehen die Front und suchen unbewachte Staedte
    // Zyrr: opportunistic raiders, skimmers and tripods go around the front and look for undefended cities
    case 'zyrr': p.aggression += 0.1; p.caution *= 0.9; p.explorers += 1; p.raid = 15; p.pref = { skimmer: 1.5, tripod: 1.25, grey: 1.1 }; break;
    // Kult: eifrig und angriffslustig, kaum Rueckzug, bekehrt mit Propheten / cult: zealous and aggressive, hardly retreats, converts with prophets
    case 'vesper': p.aggression += 0.25; p.caution *= 0.85; p.retreatHp *= 0.35; p.pref = { prophet: 1.6, zealot: 1.2, torchbearer: 1.3, faustZealot: 1.1 }; break;
    // NEXUS: methodisch, viel Wirtschaft, erst zurueckhaltend, spaeter unerbittlich (siehe unten)
    // NEXUS: methodical, strong economy, restrained at first, relentless later (see below)
    case 'nexus': p.buildW += 0.3; p.armyPerCity += 0.2; p.retreatHp += 0.05; p.pref = { titan: 1.3, railgun: 1.2, spider: 1.1 }; break;
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
  // NEXUS: bis Runde 8 zurueckhaltend, bis Runde 24 auf volle Haerte hochgerechnet
  // NEXUS: restrained until round 8, ramping to full resolve by round 24
  if (id === 'nexus') {
    const ramp = Math.min(1, Math.max(0, (s.round - 8) / 16));
    p.aggression += -0.2 + 0.4 * ramp; p.attackMin += 0.6 - 1.2 * ramp; p.caution *= 1.1 - 0.25 * ramp;
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
