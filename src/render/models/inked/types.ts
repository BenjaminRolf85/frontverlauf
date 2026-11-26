/**
 * Gezeichnete Einheiten: Eintraege der Gruppen (wer welche Typen und Atlanten beisteuert).
 * Inked units: entries of the groups (who contributes which types and atlases).
 */
import type { FactionId, UnitTypeId } from '../../../data/balance';
import type { Cell } from './atlas';
import type { AtlasLayout, UvBuilder } from './uvkit';

export interface InkedType {
  /** Atlas der Einheit (ein Atlas je Einheit = ein Material) / the unit's atlas (one atlas per unit = one material) */
  atlas: string;
  /** baut das Modell in Endgroesse; fine() (kit.ts) unterscheidet hohe und niedrige Qualitaet / builds the model at final size; fine() (kit.ts) tells high from low quality */
  build: (f: FactionId, A: AtlasLayout) => UvBuilder;
  /** nur fuer diese Fraktionen (fehlt = alle) / only for these factions (absent = all) */
  factions?: FactionId[];
  /** groesste Kante vor der Unterteilung fuer die Verdeckung, hohe Qualitaet (Standard 0.05) / longest edge before the subdivision for the occlusion, high quality (default 0.05) */
  maxEdge?: number;
  /** Voxelgroesse der Verdeckung (Standard 0.005) / voxel size of the occlusion (default 0.005) */
  voxel?: number;
  /**
   * Massstab des fertig gebauten Modells (Standard 1): fuer Typen, deren Anbaupunkte in festen
   * Koordinaten liegen (techParts: Rotoren, Lichtboegen) und die das Brett groesser zeigen soll als gebaut. buildInked
   * vergroessert Modell, Tusche, Turmdrehpunkte und userData.muzzle gemeinsam (hoechstens bis Kachel und Lebensbalken)
   * und meldet den Wert in userData.finishScale; damit sitzen auch die techParts richtig. Nicht fuer Typen mit
   * Besatzung: sie wuechse mit, und Besatzungen sind einheitlich (CREW); dort das Fahrzeug im Bauer vergroessern.
   * Scale of the built model (default 1): for types whose attach points sit at fixed coordinates
   * (techParts: rotors, arcs) and which the board should show larger than built. buildInked enlarges model, ink, turret
   * pivots and userData.muzzle together (at most up to tile and HP badge) and reports the value in
   * userData.finishScale; the techParts then sit right as well. Not for types with a crew: it would grow along, and
   * crews are uniform (CREW); enlarge the vehicle inside the builder there.
   */
  scale?: number;
}

/**
 * Beitrag einer Gruppe der Einfuehrung: ihre Atlanten (Name und Zellen) und ihre umgebauten Typen. Jede Gruppe hat
 * ihre eigene Datei unter groups/, damit parallele Arbeit nicht kollidiert.
 * Contribution of one rollout group: its atlases (name and cells) and its converted types. Every group has its own
 * file under groups/ so parallel work does not collide.
 */
export interface InkedGroup {
  atlases: () => [string, Cell[]][];
  types: Partial<Record<UnitTypeId, InkedType>>;
}
