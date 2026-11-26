/**
 * Gruppe Figuren: Fusstruppen, Kult, einzigartige Einheiten zu Fuss. Zwei Atlanten:
 * - 'figure': die sechs Grundtypen aller Fraktionen (Koerper in voller Aufloesung, alle Kopfbedeckungen, Ruestung).
 * - 'figure2': alle uebrigen Typen der Gruppe. Dieselbe Figur in kleineren Zellen, dazu Kutte, nackte Haut, das
 *   allgemeine Beiwerk und die eigenen Flaechen der Sonderfiguren.
 * Group figures: foot troops, cult, unique units on foot. Two atlases:
 * - 'figure': the six basic types of all factions (body at full resolution, all headgear, armour).
 * - 'figure2': all other types of the group. The same figure in smaller cells, plus robe, bare skin, the generic
 *   props and the own surfaces of the special figures.
 */
import { armourCells } from '../armourPaint';
import { android, cyborg, grey } from '../beings';
import { berserker, faustZealot, prophet, torchbearer, zealot } from '../cult';
import { cultCells } from '../cultPaint';
import { emblemCells } from '../emblem';
import { bodyCellsAt, figureCells, robeCells } from '../figurePaint';
import { headCells } from '../headPaint';
import { propCells } from '../propPaint';
import { antiTank, lightWarden, marine, railSniper, scientist, shadowCommando } from '../specials';
import type { InkedGroup } from '../types';
import { uniqueCells } from '../uniquePaint';
import { peacekeeper, protoWalker, steppeRider, stormbreaker } from '../uniques';
import { infantry, medic, mgTeam, pioneer, sniper, spy } from '../units';

/** groesste Kante der Figuren vor der Unterteilung (hohe Qualitaet) / longest edge of the figures before the subdivision (high quality) */
const FIGURE_EDGE = 0.09;

export const figures: InkedGroup = {
  atlases: () => [
    ['figure', figureCells()],
    ['figure2', [
      ...bodyCellsAt(0.56, { nose: 1, ear: 1, head: 0.5, 'head:dravon': 0.45 }), ...headCells(0.5), ...armourCells(0.45), ...robeCells(0.62), ...propCells(0.7), ...cultCells(0.7), ...uniqueCells(0.75), ...emblemCells(40),
    ]],
  ],
  types: {
    infantry: { atlas: 'figure', build: infantry, maxEdge: FIGURE_EDGE },
    sniper: { atlas: 'figure', build: sniper, maxEdge: FIGURE_EDGE },
    pioneer: { atlas: 'figure', build: pioneer, maxEdge: FIGURE_EDGE },
    mg: { atlas: 'figure', build: mgTeam, maxEdge: 0.14 },
    medic: { atlas: 'figure', build: medic, maxEdge: FIGURE_EDGE },
    spy: { atlas: 'figure', build: spy, maxEdge: FIGURE_EDGE },
    // Sonderfiguren der Fraktionen und der Kampagne / special figures of the factions and the campaign
    scientist: { atlas: 'figure2', build: scientist, maxEdge: FIGURE_EDGE },
    marine: { atlas: 'figure2', build: marine, maxEdge: FIGURE_EDGE },
    shadowCommando: { atlas: 'figure2', build: shadowCommando, maxEdge: FIGURE_EDGE },
    antiTank: { atlas: 'figure2', build: antiTank, maxEdge: 0.12 },
    railSniper: { atlas: 'figure2', build: railSniper, maxEdge: 0.12 },
    lightWarden: { atlas: 'figure2', build: lightWarden, maxEdge: 0.12 },
    // einzigartige Einheiten / unique units
    steppeRider: { atlas: 'figure2', build: steppeRider, maxEdge: FIGURE_EDGE },
    stormbreaker: { atlas: 'figure2', build: stormbreaker, maxEdge: 0.12 },
    peacekeeper: { atlas: 'figure2', build: peacekeeper, maxEdge: 0.12 },
    protoWalker: { atlas: 'figure2', build: protoWalker, maxEdge: 0.085, voxel: 0.006 },
    // Fremde und Maschinen zu Fuss / aliens and machines on foot
    grey: { atlas: 'figure2', build: grey, maxEdge: FIGURE_EDGE },
    android: { atlas: 'figure2', build: android, maxEdge: FIGURE_EDGE },
    cyborg: { atlas: 'figure2', build: cyborg, maxEdge: FIGURE_EDGE },
    // Kult / cult
    zealot: { atlas: 'figure2', build: zealot, maxEdge: FIGURE_EDGE },
    torchbearer: { atlas: 'figure2', build: torchbearer, maxEdge: FIGURE_EDGE },
    prophet: { atlas: 'figure2', build: prophet, maxEdge: FIGURE_EDGE },
    berserker: { atlas: 'figure2', build: berserker, maxEdge: FIGURE_EDGE },
    faustZealot: { atlas: 'figure2', build: faustZealot, maxEdge: FIGURE_EDGE },
  },
};
