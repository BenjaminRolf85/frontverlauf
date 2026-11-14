/**
 * Funksprueche der Anfuehrer: reine Logik ohne DOM (welcher Anlass, wer spricht, welche Zeile).
 * Leader dispatches: pure logic without DOM (which occasion, who speaks, which line).
 */
import type { FactionId, GrandProjectId } from '../data/balance';
import type { GameEvent, GameState } from '../core';
import type { LeaderMood } from './leaders';

export type DispatchOccasion =
  | 'briefing' | 'contact' | 'break' | 'war' | 'peaceOffer' | 'peaceAccepted' | 'peaceRejected'
  | 'cityLost' | 'cityTaken' | 'eliminated' | 'grandProject' | 'victory' | 'defeat';

export const DISPATCH_OCCASIONS: DispatchOccasion[] = [
  'briefing', 'contact', 'break', 'war', 'peaceOffer', 'peaceAccepted', 'peaceRejected',
  'cityLost', 'cityTaken', 'eliminated', 'grandProject', 'victory', 'defeat',
];

/** Vorrang in der Warteschlange (hoeher bleibt laenger) / queue priority (higher stays longer) */
export const DISPATCH_PRIORITY: Record<DispatchOccasion, number> = {
  briefing: 3, war: 3, break: 3, peaceOffer: 3, victory: 3, defeat: 3,
  cityLost: 2, cityTaken: 2, eliminated: 2,
  peaceRejected: 1, peaceAccepted: 1, grandProject: 1, contact: 1,
};

/** Wer gibt sich beim ersten Kontakt herablassend? / who is smug at first contact? */
const SMUG_GREETING: ReadonlySet<FactionId> = new Set<FactionId>(['meridon', 'zyrr', 'vesper']);
/** Wer wird beim Stadtverlust wuetend statt fassungslos? / who gets angry instead of shocked on losing a city? */
const ANGRY_LOSER: ReadonlySet<FactionId> = new Set<FactionId>(['korvat', 'dravon', 'vesper']);

/** Stimmung je Anlass und Sprecher / mood per occasion and speaker */
export function dispatchMood(occasion: DispatchOccasion, speaker: FactionId): LeaderMood {
  switch (occasion) {
    case 'contact': return SMUG_GREETING.has(speaker) ? 'smug' : 'neutral';
    case 'cityLost': return ANGRY_LOSER.has(speaker) ? 'angry' : 'shocked';
    case 'break': case 'war': case 'peaceRejected': return 'angry';
    case 'peaceAccepted': case 'cityTaken': case 'grandProject': case 'victory': return 'smug';
    case 'eliminated': case 'defeat': return 'shocked';
    default: return 'neutral';
  }
}

/** Geplanter Funkspruch: Sprecher und angesprochener Mensch (Fraktionsindizes) / planned dispatch: speaker and addressed human */
export interface DispatchPlan {
  occasion: DispatchOccasion;
  speaker: number;
  target: number;
  /** betroffene Stadt (Eroberung) / city involved (capture) */
  city?: number;
  /** Grossprojekt / grand project */
  project?: GrandProjectId;
}

/**
 * Welche Funksprueche loest ein Ereignis aus? Nur Ereignisse, die einen Menschen betreffen oder die er sehen kann.
 * Which dispatches does an event trigger? Only events that involve a human or that a human can see.
 */
export function planDispatches(e: GameEvent, s: GameState): DispatchPlan[] {
  const human = (i: number | null | undefined) => i !== null && i !== undefined && !!s.factions[i]?.human;
  const plan = (occasion: DispatchOccasion, speaker: number, target: number, extra: Partial<DispatchPlan> = {}): DispatchPlan[] =>
    speaker === target || !s.factions[speaker] || !human(target) ? [] : [{ occasion, speaker, target, ...extra }];
  // ein Mensch, der die Fraktion kennt (bevorzugt der Betrachter-Kandidat am Zug) / a human who knows the faction
  const knownBy = (f: number) => {
    const list = s.factions.filter((h) => h.human && h.index !== f && h.contacts.includes(f));
    return list.find((h) => h.index === s.current) ?? list[0];
  };
  switch (e.t) {
    case 'contact': return human(e.a) ? plan('contact', e.b, e.a) : [];
    case 'breakAnnounced': return plan('break', e.from, e.to);
    // a ist der Ankuendigende (sein Zug beginnt) / a announced the break (its turn starts)
    case 'war': return human(e.b) ? plan('war', e.a, e.b) : plan('war', e.b, e.a);
    case 'peaceOffer': return plan('peaceOffer', e.from, e.to);
    case 'peace':
      if (human(e.a) && !human(e.b)) return plan('peaceAccepted', e.b, e.a);
      if (human(e.b) && !human(e.a)) return plan('peaceAccepted', e.a, e.b);
      return [];
    // from lehnt das Angebot von to ab / from declines the offer of to
    case 'peaceDeclined': return human(e.from) ? plan('peaceRejected', e.to, e.from) : [];
    case 'capture':
      if (e.from === null || e.from === e.faction) return [];
      if (human(e.faction)) return plan('cityLost', e.from, e.faction, { city: e.city });
      return plan('cityTaken', e.faction, e.from, { city: e.city });
    case 'eliminated': {
      const h = knownBy(e.faction);
      if (h) return plan('eliminated', e.faction, h.index);
      // ein Mensch faellt: seine eigenen letzten Worte / a human falls: their own last words
      return human(e.faction) ? [{ occasion: 'eliminated', speaker: e.faction, target: e.faction }] : [];
    }
    case 'grandProject': {
      if (human(e.faction)) return [];
      const h = knownBy(e.faction);
      return h ? plan('grandProject', e.faction, h.index, { project: e.id }) : [];
    }
    default: return [];
  }
}

/**
 * Zeile waehlen: bestimmt durch Runde und Fraktion, nie zweimal hintereinander dieselbe.
 * Choose a line: deterministic by round and faction, never the same twice in a row.
 */
export function pickLine(count: number, round: number, speaker: number, last: number | undefined): number {
  if (count <= 0) return -1;
  let i = (round + speaker) % count;
  if (count > 1 && i === last) i = (i + 1) % count;
  return i;
}

/** Fuer das Spielende: wer spricht und mit welchem Anlass / for game over: who speaks and on which occasion */
export function gameOverSpeaker(s: GameState, viewer: number): { faction: number; occasion: 'victory' | 'defeat' } | null {
  if (s.winner !== null && s.factions[s.winner]?.human) return { faction: s.winner, occasion: 'victory' };
  const me = viewer >= 0 && s.factions[viewer]?.human ? viewer : s.factions.find((f) => f.human)?.index;
  return me === undefined ? null : { faction: me, occasion: 'defeat' };
}
