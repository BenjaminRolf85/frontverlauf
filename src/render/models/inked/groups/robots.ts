/**
 * Gruppe Roboter und Kultfahrzeuge: Drohnen, Laeufer, Maschinen der Roboterfraktion und die Schrottfahrzeuge des
 * Kults. Zwei Atlanten: 'robot' (Laufwerk aus dem Fahrzeug-Baukasten, Embleme, Flaechen der Maschinen) und 'scrap'
 * (Fahrzeug-Baukasten, Besatzung in halber Groesse, Embleme, Flaechen der Schrottfahrzeuge). Jede Einheit kommt mit
 * EINEM Atlas aus. Die Typen gelten fuer alle Fraktionen: Ueberlaeufer und uebernommene Einheiten tragen die Farben
 * ihres neuen Besitzers (look.ts), wie bei den bisherigen Modellen.
 * Group robots and cult vehicles: drones, walkers, machines of the robot faction and the cult's scrap vehicles. Two
 * atlases: 'robot' (running gear of the vehicle kit, emblems, the machines' surfaces) and 'scrap' (vehicle kit, crew
 * at half size, emblems, the scrap vehicles' surfaces). Every unit gets by with ONE atlas. The types apply to all
 * factions: defectors and taken-over units wear their new owner's colours (look.ts), as the previous models did.
 */
import { robotCells } from '../robotPaint';
import { titan } from '../robotsTitan';
import { flameTank, railgun } from '../robotsTracked';
import { flakDrone, kamikazeDrone, quadDrone, spider } from '../robotsWalkers';
import type { InkedGroup } from '../types';

export const robots: InkedGroup = {
  atlases: () => [['robot', robotCells()]],
  types: {
    railgun: { atlas: 'robot', build: railgun, maxEdge: 0.085, voxel: 0.0065 },
    flameTank: { atlas: 'robot', build: flameTank, maxEdge: 0.085, voxel: 0.0065 },
    spider: { atlas: 'robot', build: spider, maxEdge: 0.085, voxel: 0.006 },
    kamikazeDrone: { atlas: 'robot', build: kamikazeDrone, maxEdge: 0.085, voxel: 0.006 },
    flakDrone: { atlas: 'robot', build: flakDrone, maxEdge: 0.085, voxel: 0.006 },
    quadDrone: { atlas: 'robot', build: quadDrone, maxEdge: 0.085, voxel: 0.006 },
    titan: { atlas: 'robot', build: titan, maxEdge: 0.085, voxel: 0.0065 },
  },
};
