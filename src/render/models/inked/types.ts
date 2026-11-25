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
