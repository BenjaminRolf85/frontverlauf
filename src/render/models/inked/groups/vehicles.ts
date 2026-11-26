/**
 * Gruppe Fahrzeuge: Landfahrzeuge und Roboter. Atlas 'vehicle': Baukasten (trim.ts), Besatzung in halber Groesse,
 * Embleme, dazu die eigenen Flaechen einzelner Fahrzeuge. Wird er voll, kommt ein weiterer Atlas dazu ('vehicle2' ...),
 * wieder mit trimCells() und crewCells(), damit jedes Fahrzeug mit EINEM Atlas auskommt.
 * Group vehicles: land vehicles and robots. Atlas 'vehicle': kit (trim.ts), crew at half size, emblems, plus the own
 * surfaces of individual vehicles. When it is full another atlas is added ('vehicle2' ...), again with trimCells() and
 * crewCells(), so every vehicle gets by with ONE atlas.
 */
import type { Cell } from '../atlas';
import { fieldCar } from '../car';
import { carCells } from '../carPaint';
import { emblemCells } from '../emblem';
import { crewCells, figureCells } from '../figurePaint';
import { fieldGun, gunCells } from '../gun';
import { radarTruck, steppeColossus } from '../heavy';
import { gunship, heliCells } from '../heli';
import { korvatTank } from '../tank';
import { flak, mineCarrier, supportCells } from '../support';
import { hullCells, tankCells, turretCells } from '../tankPaint';
import { factionTank } from '../tanks';
import { trimCells } from '../trim';
import { coilLauncher, OCTO_SCALE, octocopter, sensorCarrier, TESLA_SCALE, teslaTank } from '../velkar';
import { velkarCells } from '../velkarPaint';
import type { InkedGroup } from '../types';

/** Beine der Geschuetzbedienungen (stehen neben dem Geschuetz), halbe Groesse wie die uebrigen Besatzungszellen / legs of the gun crews (standing beside the gun), half size like the other crew cells */
function crewLegCells(k = 0.5): Cell[] {
  const keep = new Set(['thigh', 'shin', 'boot']);
  return figureCells().filter((c) => keep.has(c.name)).map((c): Cell => ({ ...c, design: c.design ?? [c.w, c.h], w: Math.round(c.w * k), h: Math.round(c.h * k) }));
}

const ARMOUR_DROP = new Set(['plate', 'plateMud', 'rivets', 'hatchSquare', 'glass', 'grille']);

export const vehicles: InkedGroup = {
  atlases: () => [
    // Panzer aller Fraktionen: Baukasten ohne die allgemeinen Platten (die Wannen haben eigene Zellen), dazu je Fraktion die Turmzelle
    // tanks of all factions: the kit without the generic plates (the hulls have cells of their own), plus one turret cell per faction
    ['vehicle', [...trimCells().filter((c) => !ARMOUR_DROP.has(c.name)), ...crewCells(0.5), ...emblemCells(48), ...tankCells(), ...turretCells()]],
    // Kettenfahrzeuge auf dem Wannenbau der Panzer: Flugabwehr, Minenleger, Tesla-Panzer / tracked vehicles on the tanks' hull construction: anti-air, mine layer, Tesla tank
    ['vehicle2', [...trimCells().filter((c) => c.name !== 'tarp'), ...crewCells(0.5), ...emblemCells(48), ...hullCells(0.85), ...supportCells(), ...velkarCells()]],
    // Radfahrzeuge, Geschuetze, Fluggeraet / wheeled vehicles, guns, aircraft
    ['vehicle3', [...trimCells(), ...crewCells(0.5), ...crewLegCells(), ...emblemCells(48), ...carCells(), ...velkarCells(), ...gunCells(), ...heliCells()]],
  ],
  types: {
    // Panzer: Korvat (der Kult faehrt dieselbe Bauart), dazu Dravon, Alvenia, Meridon und die Hightech-Bauart
    // tanks: Korvat (the cult drives the same design), plus Dravon, Alvenia, Meridon and the hi-tech design
    tank: { atlas: 'vehicle', build: (f, A) => (f === 'korvat' || f === 'vesper' ? korvatTank(f, A) : factionTank(f, A)), maxEdge: 0.085, voxel: 0.0065 },
    // Gelaendewagen: je Fraktion eigene Form; die Velkar fahren den Sensortraeger / field car: own shape per faction; Velkar drive the sensor carrier
    // Feldgeschuetz mit zwei Mann Bedienung; die Velkar fahren den Spulenwerfer / field gun with two crew; Velkar drive the coil launcher
    artillery: { atlas: 'vehicle3', build: (f, A) => (f === 'velkar' ? coilLauncher(f, A) : fieldGun(f, A)), maxEdge: 0.085, voxel: 0.0065 },
    // Kampfhubschrauber: je Fraktion eigene Form / combat helicopter: own shape per faction
    heli: { atlas: 'vehicle3', build: gunship, maxEdge: 0.11, voxel: 0.0065 },
    // Flugabwehr und Minenleger auf Panzerwannen / anti-air and mine layer on tank hulls
    antiAir: { atlas: 'vehicle2', build: flak, maxEdge: 0.085, voxel: 0.0065 },
    mineLayer: { atlas: 'vehicle2', build: mineCarrier, maxEdge: 0.085, voxel: 0.0065 },
    // Velkar: Tesla-Panzer (Lichtboegen an TESLA_TOPS) und Oktokopter (Rotoren an den Armen) / Velkar: Tesla tank (arcs at TESLA_TOPS) and octocopter (rotors at the arms)
    // beide mit Massstab wie bisher (1.25 / 1.1): Anbaupunkte und Modell wachsen gemeinsam / both with the previous scale (1.25 / 1.1): attach points and model grow together
    teslaTank: { atlas: 'vehicle2', build: teslaTank, maxEdge: 0.085, voxel: 0.0065, scale: TESLA_SCALE },
    octocopter: { atlas: 'vehicle3', build: octocopter, maxEdge: 0.11, voxel: 0.0065, scale: OCTO_SCALE },
    // Meridon: Radarwagen; Korvat: Steppenkoloss mit den Zellen des Korvat-Panzers / Meridon: radar truck; Korvat: Steppe Colossus with the Korvat tank's cells
    radarTruck: { atlas: 'vehicle3', build: radarTruck, maxEdge: 0.11, voxel: 0.0065 },
    steppeColossus: { atlas: 'vehicle', build: steppeColossus, maxEdge: 0.085, voxel: 0.0065 },
    jeep: { atlas: 'vehicle3', build: (f, A) => (f === 'velkar' ? sensorCarrier(f, A) : fieldCar(f, A)), maxEdge: 0.085, voxel: 0.0065 },
  },
};
