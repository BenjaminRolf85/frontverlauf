/**
 * Gruppe Figuren: Fusstruppen, Kult, einzigartige Einheiten zu Fuss. Atlas 'figure'.
 * Group figures: foot troops, cult, unique units on foot. Atlas 'figure'.
 */
import { figureCells } from '../figurePaint';
import type { InkedGroup } from '../types';
import { infantry, medic, mgTeam, pioneer, sniper, spy } from '../units';

/** groesste Kante der Figuren vor der Unterteilung (hohe Qualitaet) / longest edge of the figures before the subdivision (high quality) */
const FIGURE_EDGE = 0.09;

export const figures: InkedGroup = {
  atlases: () => [['figure', figureCells()]],
  types: {
    infantry: { atlas: 'figure', build: infantry, maxEdge: FIGURE_EDGE },
    sniper: { atlas: 'figure', build: sniper, maxEdge: FIGURE_EDGE },
    pioneer: { atlas: 'figure', build: pioneer, maxEdge: FIGURE_EDGE },
    mg: { atlas: 'figure', build: mgTeam, maxEdge: 0.14 },
    medic: { atlas: 'figure', build: medic, maxEdge: FIGURE_EDGE },
    spy: { atlas: 'figure', build: spy, maxEdge: FIGURE_EDGE },
  },
};
