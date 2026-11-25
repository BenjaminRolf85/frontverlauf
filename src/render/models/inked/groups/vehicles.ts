/**
 * Gruppe Fahrzeuge: Landfahrzeuge und Roboter. Atlas 'vehicle': Baukasten (trim.ts), Besatzung in halber Groesse,
 * Embleme, dazu die eigenen Flaechen einzelner Fahrzeuge. Wird er voll, kommt ein weiterer Atlas dazu ('vehicle2' ...),
 * wieder mit trimCells() und crewCells(), damit jedes Fahrzeug mit EINEM Atlas auskommt.
 * Group vehicles: land vehicles and robots. Atlas 'vehicle': kit (trim.ts), crew at half size, emblems, plus the own
 * surfaces of individual vehicles. When it is full another atlas is added ('vehicle2' ...), again with trimCells() and
 * crewCells(), so every vehicle gets by with ONE atlas.
 */
import { emblemCells } from '../emblem';
import { crewCells } from '../figurePaint';
import { korvatTank } from '../tank';
import { tankCells } from '../tankPaint';
import { trimCells } from '../trim';
import type { InkedGroup } from '../types';

export const vehicles: InkedGroup = {
  atlases: () => [['vehicle', [...trimCells(), ...crewCells(0.5), ...emblemCells(48), ...tankCells()]]],
  types: {
    // Korvat-Panzer; der Kult faehrt dieselbe Bauart / the Korvat tank; the cult drives the same design
    tank: { atlas: 'vehicle', build: korvatTank, factions: ['korvat', 'vesper'], maxEdge: 0.085, voxel: 0.0065 },
  },
};
